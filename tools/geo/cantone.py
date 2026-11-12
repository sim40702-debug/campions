# TICINO COMPLETO - tutto il cantone diviso in regioni (branch feature/ticino-completo)
#
# Il cantone e' diviso in regioni quadrate (vedi config.py: cuore 16 x 16 km + margine 4 km = 24 x 24 km).
# Ogni regione viene preparata con gli stessi passi dell'anteprima (1, 3, 6, 7, 8), una alla volta.
# Questo file fa il lavoro "attorno":
#
#   python cantone.py scarica            scarica da OpenStreetMap confini, strade, edifici... di TUTTO il cantone
#                                        (a blocchi, cosi' ogni richiesta resta piccola) in dati/download/osm/cantone
#   python cantone.py regioni            decide quali regioni servono (quelle che toccano il cantone)
#                                        e scrive dati/cantone/regioni.json
#   python cantone.py area R_2696_1106   stampa il rettangolo della regione, da mettere in MRW_AREA
#   python cantone.py prepara            (con MRW_AREA) ritaglia i dati OpenStreetMap della regione e scrive le zone
#   python cantone.py chiudi R_2696_1106 (con MRW_AREA, dopo i passi 7 e 8) controlla la regione, crea il rilievo
#                                        piccolo per la mappa del cantone e il pacchetto regione_R_....tar.gz
#   python cantone.py panoramica         crea i dati della mappa di tutto il cantone (confine, distretti, localita',
#                                        strade principali, laghi) e controlla che le strade siano collegate
#   python cantone.py unisci CARTELLA    unisce i rilievi e i controlli di tutte le regioni (ultimo lavoro)
#
# Dati: (c) OpenStreetMap contributors (ODbL), Ufficio federale di topografia swisstopo

import json
import sys
import tarfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from shapely.geometry import LineString, Point, box, mapping
from shapely.ops import unary_union
from shapely.prepared import prep

import config
import utilita

CARTELLA_BLOCCHI = config.CARTELLA_DOWNLOAD / "osm" / "cantone"
CARTELLA_CANTONE = config.CARTELLA_DATI / "cantone"
CARTELLA_ANTEPRIMA = config.CARTELLA_SCRIPT.parent.parent / "anteprima" / "dati"

# I tipi di dati OpenStreetMap (gli stessi nomi dei file del passo 2)
TIPI = ["strade", "edifici", "verde", "dettagli", "acqua", "trasporti", "uso_suolo", "opere"]

# Blocchi per lo scaricamento: 3 colonne x 4 righe sopra tutta la griglia delle regioni (margini compresi)
BLOCCHI_COLONNE = 3
BLOCCHI_RIGHE = 4

# Nomi delle zone nel gioco: i distretti del cantone con il nome con cui si chiama la regione
NOMI_ZONE = {
    "Bellinzona": "Bellinzonese", "Blenio": "Valle di Blenio", "Leventina": "Leventina", "Locarno": "Locarnese",
    "Lugano": "Luganese", "Mendrisio": "Mendrisiotto", "Riviera": "Riviera", "Vallemaggia": "Vallemaggia",
}


# --- Griglia delle regioni --------------------------------------------------------------------------------

def tutte_le_celle():
    celle = []
    for riga in range(config.REGIONI_RIGHE):
        for colonna in range(config.REGIONI_COLONNE):
            est = config.REGIONI_EST_0 + colonna * config.REGIONE_CUORE_M
            nord = config.REGIONI_NORD_0 + riga * config.REGIONE_CUORE_M
            celle.append({
                "id": "R_" + str(est // 1000) + "_" + str(nord // 1000),
                "cuore": [est, est + config.REGIONE_CUORE_M, nord, nord + config.REGIONE_CUORE_M],
            })
    return celle


def area_regione(cuore):
    m = config.REGIONE_MARGINE_M
    return [cuore[0] - m, cuore[1] + m, cuore[2] - m, cuore[3] + m]


def rettangolo_totale():
    m = config.REGIONE_MARGINE_M
    return (config.REGIONI_EST_0 - m,
            config.REGIONI_EST_0 + config.REGIONI_COLONNE * config.REGIONE_CUORE_M + m,
            config.REGIONI_NORD_0 - m,
            config.REGIONI_NORD_0 + config.REGIONI_RIGHE * config.REGIONE_CUORE_M + m)


def leggi_regioni():
    return utilita.leggi_json(CARTELLA_CANTONE / "regioni.json")["regioni"]


def regione_con_id(ident):
    for cella in tutte_le_celle():
        if cella["id"] == ident:
            return cella
    raise SystemExit("Regione sconosciuta: " + ident)


# --- Confini -------------------------------------------------------------------------------------------------

def leggi_confini():
    # Ritorna (poligono del cantone, {nome del distretto: poligono}) in LV95
    from passo7_esporta_anteprima import poligono_osm
    dati = utilita.leggi_json(config.CARTELLA_DOWNLOAD / "osm" / "confini.json")
    cantone = None
    distretti = {}
    for elemento in dati.get("elements", []):
        tag = elemento.get("tags", {})
        forma = poligono_osm(elemento)
        if forma is None or forma.is_empty:
            continue
        if tag.get("ISO3166-2") == "CH-TI":
            cantone = forma
        elif tag.get("admin_level") == "6":
            nome = tag.get("name", "").replace("Distretto di ", "").replace("Distretto ", "").strip()
            distretti[nome] = forma
    if cantone is None:
        raise SystemExit("Nel file dei confini manca il Canton Ticino: rilancia 'python cantone.py scarica'")
    return cantone, distretti


# --- Scaricamento a blocchi -----------------------------------------------------------------------------------

def elenco_blocchi():
    est_min, est_max, nord_min, nord_max = rettangolo_totale()
    lato_x = (est_max - est_min) / BLOCCHI_COLONNE
    lato_y = (nord_max - nord_min) / BLOCCHI_RIGHE
    blocchi = []
    for riga in range(BLOCCHI_RIGHE):
        for colonna in range(BLOCCHI_COLONNE):
            blocchi.append({
                "nome": "b" + str(colonna) + str(riga),
                "area": (int(est_min + colonna * lato_x), int(est_min + (colonna + 1) * lato_x),
                         int(nord_min + riga * lato_y), int(nord_min + (riga + 1) * lato_y)),
            })
    return blocchi


def query_del_tipo(tipo, area):
    # Le stesse richieste del passo 2, ma sul rettangolo del blocco
    import passo2_scarica_osm as passo2
    lon_min, lat_min, lon_max, lat_max = utilita.area_in_wgs84(area)
    filtro = "(" + str(lat_min) + "," + str(lon_min) + "," + str(lat_max) + "," + str(lon_max) + ")"
    vecchio = passo2.filtro_pilota
    passo2.filtro_pilota = lambda: filtro
    try:
        if tipo == "strade":
            tipi = "|".join(config.TIPI_STRADA)
            return '[out:json][timeout:900];\nway["highway"~"^(' + tipi + ')$"]' + filtro + ";\nout geom;\n"
        return getattr(passo2, "query_" + tipo)()
    finally:
        passo2.filtro_pilota = vecchio


def scarica():
    import passo2_scarica_osm as passo2
    CARTELLA_BLOCCHI.mkdir(parents=True, exist_ok=True)
    config.OVERPASS_ATTESA_S = 600   # i blocchi sono piu' grandi dell'anteprima: si aspetta di piu'

    print("1) Confini del Ticino e dei distretti...")
    utilita.chiedi_overpass(passo2.query_confini(), config.CARTELLA_DOWNLOAD / "osm" / "confini.json")
    cantone, distretti = leggi_confini()
    print("   Cantone: " + str(round(cantone.area / 1e6, 1)) + " km2, distretti: " + ", ".join(sorted(distretti)))
    vicino = cantone.buffer(config.REGIONE_MARGINE_M + 2000)

    lavori = []
    for blocco in elenco_blocchi():
        a = blocco["area"]
        if not vicino.intersects(box(a[0], a[2], a[1], a[3])):
            print("   blocco " + blocco["nome"] + ": lontano dal cantone, saltato")
            continue
        for tipo in TIPI:
            lavori.append((tipo, blocco))

    print("2) Dati di tutto il cantone: " + str(len(lavori)) + " richieste (quelle gia' fatte vengono saltate)...")
    falliti = []

    def uno(lavoro):
        tipo, blocco = lavoro
        percorso = CARTELLA_BLOCCHI / (tipo + "_" + blocco["nome"] + ".json")
        try:
            dati = utilita.chiedi_overpass(query_del_tipo(tipo, blocco["area"]), percorso,
                                           giri=1 if tipo == "opere" else 3)
            print("   " + percorso.name + ": " + str(len(dati.get("elements", []))) + " elementi", flush=True)
        except RuntimeError as errore:
            if tipo != "opere":   # le dighe sono un di piu'
                falliti.append(percorso.name)
            print("   " + percorso.name + ": NON scaricato (" + str(errore) + ")", flush=True)

    # Overpass permette 2 richieste insieme dallo stesso computer
    with ThreadPoolExecutor(2) as lavoratori:
        list(lavoratori.map(uno, lavori))
    if falliti:
        print("ERRORE: " + str(len(falliti)) + " blocchi non scaricati: " + ", ".join(falliti))
        raise SystemExit(1)
    print("Fatto. File in: " + str(CARTELLA_BLOCCHI))


def dentro_rettangolo(elemento, lon_min, lat_min, lon_max, lat_max):
    if elemento.get("type") == "node":
        return lon_min <= elemento.get("lon", 999) <= lon_max and lat_min <= elemento.get("lat", 999) <= lat_max
    b = elemento.get("bounds")
    if not b:
        return True
    return not (b["maxlon"] < lon_min or b["minlon"] > lon_max or b["maxlat"] < lat_min or b["minlat"] > lat_max)


def elementi_del_tipo(tipo, area=None):
    # Tutti gli elementi di un tipo, presi dai blocchi (senza doppioni), se serve solo dentro un rettangolo LV95
    limiti = None
    if area is not None:
        m = 300
        limiti = utilita.area_in_wgs84((area[0] - m, area[1] + m, area[2] - m, area[3] + m))
    visti = set()
    risultato = []
    for blocco in elenco_blocchi():
        if area is not None:
            a = blocco["area"]
            if a[1] < area[0] or a[0] > area[1] or a[3] < area[2] or a[2] > area[3]:
                continue
        percorso = CARTELLA_BLOCCHI / (tipo + "_" + blocco["nome"] + ".json")
        if not percorso.exists():
            continue
        for elemento in utilita.leggi_json(percorso).get("elements", []):
            chiave = (elemento.get("type"), elemento.get("id"))
            if chiave in visti:
                continue
            if limiti is not None and not dentro_rettangolo(elemento, *limiti):
                continue
            visti.add(chiave)
            risultato.append(elemento)
    return risultato


# --- Regioni ----------------------------------------------------------------------------------------------------

def regioni():
    cantone, distretti = leggi_confini()
    elenco = []
    for cella in tutte_le_celle():
        c = cella["cuore"]
        parte = cantone.intersection(box(c[0], c[2], c[1], c[3]))
        km2 = parte.area / 1e6
        if km2 < 0.05:
            continue
        nomi = []
        for nome, forma in distretti.items():
            if forma.intersection(box(c[0], c[2], c[1], c[3])).area > 2e6:
                nomi.append(NOMI_ZONE.get(nome, nome))
        elenco.append({"id": cella["id"], "cuore": c, "area": area_regione(c),
                       "km2_cantone": round(km2, 1), "zone": sorted(nomi)})
    CARTELLA_CANTONE.mkdir(parents=True, exist_ok=True)
    utilita.scrivi_json({
        "nota": "Regioni del Ticino completo. Coordinate LV95 in metri: [est_min, est_max, nord_min, nord_max].",
        "cuore_m": config.REGIONE_CUORE_M, "margine_m": config.REGIONE_MARGINE_M,
        "km2_cantone": round(cantone.area / 1e6, 1),
        "regioni": elenco,
    }, CARTELLA_CANTONE / "regioni.json")
    print("Regioni che toccano il cantone: " + str(len(elenco)) + " (cantone " + str(round(cantone.area / 1e6, 1)) + " km2)")
    for r in elenco:
        print("   " + r["id"] + ": " + str(r["km2_cantone"]) + " km2 di cantone - " + ", ".join(r["zone"]))
    # per il workflow di GitHub: elenco degli id
    print("MATRICE=" + json.dumps([r["id"] for r in elenco]))


def prepara():
    # Con MRW_AREA impostata: ritaglia i dati OSM della regione (stessi nomi di file del passo 2) e scrive le zone
    if not config.AREA_DA_FUORI:
        raise SystemExit("Manca MRW_AREA (vedi 'python cantone.py area R_...')")
    utilita.MODO_PICCOLO = "anteprima"
    area = utilita.area_di_lavoro(True)
    print("Regione " + str(area))
    for tipo in TIPI:
        elementi = elementi_del_tipo(tipo, area)
        percorso = utilita.file_osm(tipo, True)
        percorso.parent.mkdir(parents=True, exist_ok=True)
        if tipo == "opere" and not elementi:
            continue
        with open(percorso, "w", encoding="utf-8") as file:
            json.dump({"elements": elementi}, file)
        print("   " + tipo + ": " + str(len(elementi)) + " elementi")

    cantone, distretti = leggi_confini()
    rettangolo = box(area[0], area[2], area[1], area[3])
    zone = []
    # La Valle Verzasca (spartiacque veri, calcolati per l'anteprima) viene prima del Locarnese: e' una sua parte
    vecchie = config.CARTELLA_SCRIPT / "zone_anteprima.json"
    if vecchie.exists():
        for voce in utilita.leggi_json(vecchie)["zone"]:
            if voce["nome"] == "Valle Verzasca":
                from shapely.geometry import Polygon
                if Polygon(voce["contorno"]).buffer(0).intersection(rettangolo).area > 1e6:
                    zone.append({"nome": voce["nome"], "contorno": voce["contorno"], "verticale": True})
    for nome in sorted(distretti):
        forma = distretti[nome].intersection(rettangolo)
        if forma.area < 1e6:
            continue
        if forma.geom_type != "Polygon":
            forma = max(forma.geoms, key=lambda g: g.area)
        forma = forma.simplify(25)
        zone.append({"nome": NOMI_ZONE.get(nome, nome),
                     "contorno": [[round(e), round(n)] for e, n in list(forma.exterior.coords)[:-1]]})
    utilita.scrivi_json({"nota": "Zone della regione (distretti del Canton Ticino, OpenStreetMap). LV95.",
                         "area": list(area), "zone": zone, "esclusi": []}, config.CARTELLA_DATI / "zone_regione.json")
    print("   zone: " + ", ".join(z["nome"] for z in zone))


RIDUZIONE_RILIEVO = 16     # il rilievo della mappa del cantone ha un punto ogni 16 del terreno (63 m)


def chiudi(ident):
    # Dopo i passi 7 e 8: controlla la regione, crea il rilievo piccolo e il pacchetto da scaricare nel gioco
    regione = regione_con_id(ident)
    cuore = regione["cuore"]
    area = area_regione(cuore)
    info = utilita.leggi_json(CARTELLA_ANTEPRIMA / "terreno.json")
    colonne, righe, passo = info["colonne"], info["righe"], info["passo_m"]
    atteso = [(area[0] + area[1]) / 2, (area[2] + area[3]) / 2]
    if info["centro_lv95"] != atteso:
        raise SystemExit("I dati in anteprima/dati non sono di " + ident + ": centro " + str(info["centro_lv95"]))
    valori = np.fromfile(CARTELLA_ANTEPRIMA / "terreno.bin", dtype="<u2").reshape(righe, colonne)

    # rilievo del cuore: un punto ogni 16 (riga 0 = nord)
    salto = RIDUZIONE_RILIEVO
    primo = int(round(config.REGIONE_MARGINE_M / passo))
    quanti = int(round(config.REGIONE_CUORE_M / passo)) // salto + 1
    rilievo = valori[primo:primo + (quanti - 1) * salto + 1:salto, primo:primo + (quanti - 1) * salto + 1:salto]
    assert rilievo.shape == (quanti, quanti), rilievo.shape

    # Controllo della copertura: dentro il cantone il terreno deve venire da swissALTI3D
    # (dove manca tutto il passo 3 mette la quota fissa QUOTA_SE_MANCA_M)
    cantone, distretti = leggi_confini()
    from rasterio.features import rasterize
    from rasterio.transform import Affine
    p = passo * salto
    trasf = Affine(p, 0, cuore[0] - p / 2, 0, -p, cuore[3] + p / 2)
    parte = cantone.intersection(box(cuore[0], cuore[2], cuore[1], cuore[3]))
    dentro = rasterize([(mapping(parte), 1)], out_shape=rilievo.shape, transform=trasf, fill=0, dtype="uint8") == 1
    valore_vuoto = int(round((config.QUOTA_SE_MANCA_M - info["quota_base"]) / info["scala_quota"]))
    punti_dentro = int(dentro.sum())
    vuoti = int(((rilievo == valore_vuoto) & dentro).sum())
    quote = info["quota_base"] + rilievo[dentro].astype(np.float64) * info["scala_quota"] if punti_dentro else np.array([0.0])

    def conta(nome, chiave):
        percorso = CARTELLA_ANTEPRIMA / nome
        if not percorso.exists():
            return 0
        return len(utilita.leggi_json(percorso).get(chiave, []))

    # strade della regione: chilometri, ponti e gallerie (solo la parte nel cuore, per non contarle due volte)
    km = km_ponti = km_gallerie = 0.0
    tratti = 0
    meta_x = info["lato_x_m"] / 2 - config.REGIONE_MARGINE_M
    meta_z = info["lato_z_m"] / 2 - config.REGIONE_MARGINE_M
    percorso_strade = CARTELLA_ANTEPRIMA / "strade.json"
    if percorso_strade.exists():
        for strada in utilita.leggi_json(percorso_strade)["strade"]:
            punti = strada["p"]
            n = len(punti) // 3
            lunghezza = 0.0
            for i in range(n - 1):
                x0, z0 = punti[i * 3], punti[i * 3 + 2]
                x1, z1 = punti[i * 3 + 3], punti[i * 3 + 5]
                if abs((x0 + x1) / 2) <= meta_x and abs((z0 + z1) / 2) <= meta_z:
                    lunghezza = lunghezza + ((x1 - x0) ** 2 + (z1 - z0) ** 2) ** 0.5
            if lunghezza > 0:
                tratti = tratti + 1
                km = km + lunghezza / 1000
                if strada.get("b"):
                    km_ponti = km_ponti + lunghezza / 1000
                if strada.get("g"):
                    km_gallerie = km_gallerie + lunghezza / 1000

    # edifici nel cuore (quelli nel margine ci sono anche nella regione vicina: non vanno contati due volte)
    edifici_nel_cuore = 0
    percorso_edifici = CARTELLA_ANTEPRIMA / "edifici.json"
    if percorso_edifici.exists():
        for edificio in utilita.leggi_json(percorso_edifici)["edifici"]:
            if abs(edificio["p"][0]) <= meta_x and abs(edificio["p"][1]) <= meta_z:
                edifici_nel_cuore = edifici_nel_cuore + 1

    foto = len(list((CARTELLA_ANTEPRIMA / "foto").glob("*.jpg"))) if (CARTELLA_ANTEPRIMA / "foto").exists() else 0
    # le foto di dettaglio (passo 9) stanno in un pacchetto a parte, facoltativo: non contano nei dati della regione
    cartella_hd = CARTELLA_ANTEPRIMA / "foto_hd"
    foto_hd = len(list(cartella_hd.glob("hd_*.jpg"))) if cartella_hd.exists() else 0
    bytes_dati = sum(f.stat().st_size for f in CARTELLA_ANTEPRIMA.rglob("*") if f.is_file() and cartella_hd not in f.parents)
    controllo = {
        "id": ident, "cuore": cuore, "area": area,
        "km2_cantone": round(parte.area / 1e6, 1),
        "terreno_punti_nel_cantone": punti_dentro,
        "terreno_punti_senza_dati": vuoti,
        "quota_min_m": round(float(quote.min()), 1), "quota_max_m": round(float(quote.max()), 1),
        "strade_tratti_nel_cuore": tratti, "strade_km_nel_cuore": round(km, 1),
        "ponti_km": round(km_ponti, 1), "gallerie_km": round(km_gallerie, 1),
        "edifici": conta("edifici.json", "edifici"),
        "edifici_nel_cuore": edifici_nel_cuore,
        "localita": conta("dettagli.json", "localita"),
        "foto_aeree": foto,
        "foto_dettaglio_hd": foto_hd,
        "dati_MB": round(bytes_dati / 1e6, 1),
    }
    # una regione e' "completa" solo se il terreno copre tutto il pezzo di cantone e ci sono le foto
    controllo["completa"] = bool(vuoti == 0 and punti_dentro > 0 and foto > 0)

    uscita = CARTELLA_CANTONE / "regioni_fatte"
    uscita.mkdir(parents=True, exist_ok=True)
    rilievo.astype("<u2").tofile(uscita / ("rilievo_" + ident + ".bin"))

    # nel pacchetto finisce anche il controllo: il gioco lo mostra nella mappa del cantone
    utilita.scrivi_json(controllo, CARTELLA_ANTEPRIMA / "regione.json")
    pacchetto = uscita / ("regione_" + ident + ".tar.gz")
    with tarfile.open(pacchetto, "w:gz", compresslevel=6) as archivio:
        for file in sorted(CARTELLA_ANTEPRIMA.rglob("*")):
            if file.is_file() and cartella_hd not in file.parents:
                archivio.add(file, arcname=str(file.relative_to(CARTELLA_ANTEPRIMA)).replace("\\", "/"))
    controllo["pacchetto_MB"] = round(pacchetto.stat().st_size / 1e6, 1)
    # pacchetto facoltativo delle foto di dettaglio (0,5 m): il gioco lo scarica solo con i profili Media, Alta, Ultra.
    # Dentro ci sono i file "foto_hd/..." (indice.json compreso), che si aprono dentro la cartella della regione.
    if foto_hd > 0 and (cartella_hd / "indice.json").exists():
        pacchetto_hd = uscita / ("hd_" + ident + ".tar.gz")
        with tarfile.open(pacchetto_hd, "w:gz", compresslevel=1) as archivio:     # (i JPEG non si comprimono: livello 1)
            for file in sorted(cartella_hd.rglob("*")):
                if file.is_file():
                    archivio.add(file, arcname="foto_hd/" + str(file.relative_to(cartella_hd)).replace("\\", "/"))
        controllo["pacchetto_hd_MB"] = round(pacchetto_hd.stat().st_size / 1e6, 1)
    utilita.scrivi_json(controllo, uscita / ("controllo_" + ident + ".json"))
    print("Controllo della regione " + ident + ":")
    for chiave, valore in controllo.items():
        print("   " + chiave + ": " + str(valore))
    if not controllo["completa"]:
        print("ATTENZIONE: la regione NON e' completa (terreno senza dati dentro il cantone o foto mancanti)")


# --- Panoramica del cantone (mappa grande del gioco) e controllo delle strade ---------------------------------

def anello(forma, semplifica):
    # contorno esterno piu' grande, come lista piatta [est, nord, est, nord...]
    if forma.geom_type != "Polygon":
        forma = max(forma.geoms, key=lambda g: g.area)
    forma = forma.simplify(semplifica)
    piatta = []
    for e, n in list(forma.exterior.coords)[:-1]:
        piatta.append(round(e))
        piatta.append(round(n))
    return piatta


def panoramica():
    from passo7_esporta_anteprima import poligono_osm
    cantone, distretti = leggi_confini()
    dentro_cantone = prep(cantone.buffer(30))
    trasforma = utilita.DA_WGS84_A_LV95.transform
    CARTELLA_CANTONE.mkdir(parents=True, exist_ok=True)

    print("1) Confine e distretti...")
    zone = []
    for nome in sorted(distretti):
        punto = distretti[nome].representative_point()
        zone.append({"nome": NOMI_ZONE.get(nome, nome), "contorno": anello(distretti[nome], 60),
                     "etichetta": [round(punto.x), round(punto.y)],
                     "km2": round(distretti[nome].area / 1e6, 1)})

    print("2) Strade di tutto il cantone: collegamenti...")
    strade = elementi_del_tipo("strade")
    genitori = {}

    def trova(nodo):
        while genitori[nodo] != nodo:
            genitori[nodo] = genitori[genitori[nodo]]
            nodo = genitori[nodo]
        return nodo

    principali = []
    tratti = []          # (chiave del primo nodo, km, tipo, distretto, ponte, galleria)
    forme_distretti = [(NOMI_ZONE.get(nome, nome), prep(forma)) for nome, forma in distretti.items()]
    for elemento in strade:
        geometria = elemento.get("geometry", [])
        if len(geometria) < 2:
            continue
        tag = elemento.get("tags", {})
        punti = [trasforma(p["lon"], p["lat"]) for p in geometria]
        linea = LineString(punti)
        meta = linea.interpolate(0.5, normalized=True)
        if not dentro_cantone.contains(meta):
            continue
        chiavi = [(round(p["lon"], 7), round(p["lat"], 7)) for p in geometria]
        for chiave in chiavi:
            if chiave not in genitori:
                genitori[chiave] = chiave
        radice = trova(chiavi[0])
        for chiave in chiavi[1:]:
            altra = trova(chiave)
            if altra != radice:
                genitori[altra] = radice
        distretto = ""
        for nome, forma in forme_distretti:
            if forma.contains(meta):
                distretto = nome
                break
        tipo = tag.get("highway", "")
        tratti.append((chiavi[0], linea.length / 1000, tipo, distretto,
                       tag.get("bridge") not in (None, "no"), tag.get("tunnel") not in (None, "no")))
        if tipo in ("motorway", "motorway_link", "trunk", "trunk_link", "primary", "secondary", "tertiary"):
            semplice = linea.simplify(12)
            piatta = []
            for e, n in semplice.coords:
                piatta.append(round(e))
                piatta.append(round(n))
            classe = 0 if tipo.startswith("motorway") or tipo.startswith("trunk") else (1 if tipo == "primary" else 2)
            principali.append({"c": classe, "n": tag.get("ref") or tag.get("name") or "", "p": piatta})

    gruppi = {}
    km_totali = 0.0
    per_tipo = {}
    per_distretto = {}
    km_ponti = km_gallerie = 0.0
    for chiave, km, tipo, distretto, ponte, galleria in tratti:
        radice = trova(chiave)
        gruppi[radice] = gruppi.get(radice, 0.0) + km
        km_totali = km_totali + km
        per_tipo[tipo] = per_tipo.get(tipo, 0.0) + km
        voce = per_distretto.setdefault(distretto or "?", {"km": 0.0, "tratti": 0})
        voce["km"] = voce["km"] + km
        voce["tratti"] = voce["tratti"] + 1
        if ponte:
            km_ponti = km_ponti + km
        if galleria:
            km_gallerie = km_gallerie + km
    ordinati = sorted(gruppi.values(), reverse=True)
    rete = ordinati[0] if ordinati else 0.0
    # I pezzi staccati: in OpenStreetMap alcune strade si raggiungono solo da strade di servizio o sterrate,
    # che non scarichiamo (decisione D3: strade pubbliche asfaltate), oppure dall'Italia.
    verifica = {
        "strade_tratti": len(tratti), "strade_km": round(km_totali, 1),
        "km_per_tipo": {tipo: round(km, 1) for tipo, km in sorted(per_tipo.items(), key=lambda v: -v[1])},
        "km_per_zona": {nome: {"km": round(v["km"], 1), "tratti": v["tratti"]} for nome, v in sorted(per_distretto.items())},
        "ponti_km": round(km_ponti, 1), "gallerie_km": round(km_gallerie, 1),
        "gruppi_collegati": len(ordinati),
        "rete_principale_km": round(rete, 1),
        "rete_principale_percento": round(100 * rete / km_totali, 2) if km_totali else 0,
        "gruppi_staccati_piu_grandi_km": [round(v, 2) for v in ordinati[1:11]],
    }
    print("   " + str(len(tratti)) + " tratti, " + str(round(km_totali, 1)) + " km nel cantone")
    print("   rete principale collegata: " + str(verifica["rete_principale_km"]) + " km ("
          + str(verifica["rete_principale_percento"]) + " %), gruppi staccati: " + str(len(ordinati) - 1))
    for nome, voce in verifica["km_per_zona"].items():
        print("   " + nome + ": " + str(voce["km"]) + " km, " + str(voce["tratti"]) + " tratti")

    print("3) Localita' (comuni, paesi, frazioni, nuclei)...")
    localita = []
    visti = set()
    for elemento in elementi_del_tipo("dettagli"):
        tag = elemento.get("tags", {})
        if elemento.get("type") != "node" or "place" not in tag or not tag.get("name"):
            continue
        e, n = trasforma(elemento["lon"], elemento["lat"])
        if not dentro_cantone.contains(Point(e, n)):
            continue
        chiave = (tag["name"], round(e / 200), round(n / 200))
        if chiave in visti:
            continue
        visti.add(chiave)
        voce = {"n": tag["name"], "t": tag["place"], "e": round(e), "o": round(n)}
        if tag.get("population", "").isdigit():
            voce["a"] = int(tag["population"])
        localita.append(voce)
    per_tipo_loc = {}
    for voce in localita:
        per_tipo_loc[voce["t"]] = per_tipo_loc.get(voce["t"], 0) + 1
    print("   " + str(len(localita)) + " localita': " + ", ".join(t + " " + str(n) for t, n in sorted(per_tipo_loc.items())))

    print("4) Laghi e fiumi...")
    laghi = []
    fiumi = []
    totale = box(*[rettangolo_totale()[i] for i in (0, 2, 1, 3)])
    for elemento in elementi_del_tipo("acqua"):
        tag = elemento.get("tags", {})
        if tag.get("waterway") == "river" and elemento.get("type") == "way":
            linea = LineString([trasforma(p["lon"], p["lat"]) for p in elemento.get("geometry", [])]).simplify(25)
            piatta = []
            for e, n in linea.coords:
                piatta.append(round(e))
                piatta.append(round(n))
            fiumi.append(piatta)
        elif tag.get("natural") == "water":
            try:
                forma = poligono_osm(elemento)
            except Exception:
                continue
            if forma is None or forma.is_empty or forma.area < 150_000:
                continue
            forma = forma.buffer(0).intersection(totale)
            if forma.is_empty:
                continue
            for parte in (forma.geoms if hasattr(forma, "geoms") else [forma]):
                if parte.geom_type == "Polygon" and parte.area > 150_000:
                    laghi.append({"n": tag.get("name", ""), "p": anello(parte, 30)})
    print("   laghi: " + str(len(laghi)) + ", tratti di fiume: " + str(len(fiumi)))

    dati = {
        "nota": "Mappa di tutto il Canton Ticino. Coordinate svizzere LV95 in metri (est, nord).",
        "fonte": "(c) OpenStreetMap contributors, ODbL - Ufficio federale di topografia swisstopo",
        "rettangolo": list(rettangolo_totale()),
        "km2": round(cantone.area / 1e6, 1),
        "confine": anello(cantone, 40),
        "zone": zone, "strade": principali, "localita": localita, "laghi": laghi, "fiumi": fiumi,
        "verifica_strade": verifica,
    }
    with open(CARTELLA_CANTONE / "cantone.json", "w", encoding="utf-8") as file:
        json.dump(dati, file, ensure_ascii=False, separators=(",", ":"))
    utilita.scrivi_json(verifica, CARTELLA_CANTONE / "verifica_strade.json")
    print("Fatto: " + str(CARTELLA_CANTONE / "cantone.json") + " ("
          + str(round((CARTELLA_CANTONE / "cantone.json").stat().st_size / 1e6, 1)) + " MB)")


def unisci(cartella):
    # Ultimo lavoro: unisce i rilievi delle regioni in un solo rilievo del cantone e riassume i controlli
    from pathlib import Path
    cartella = Path(cartella)
    quad = int(round(config.REGIONE_CUORE_M / (config.PASSO_M * 2))) // RIDUZIONE_RILIEVO     # 254
    colonne = config.REGIONI_COLONNE * quad + 1
    righe = config.REGIONI_RIGHE * quad + 1
    tutto = np.zeros((righe, colonne), dtype="<u2")     # 0 = nessun dato (regione non preparata)
    controlli = []
    for regione in leggi_regioni():
        ident = regione["id"]
        percorso = cartella / ("rilievo_" + ident + ".bin")
        controllo = cartella / ("controllo_" + ident + ".json")
        if not percorso.exists() or not controllo.exists():
            controlli.append({"id": ident, "completa": False, "mancante": True, "km2_cantone": regione["km2_cantone"]})
            continue
        pezzo = np.fromfile(percorso, dtype="<u2").reshape(quad + 1, quad + 1)
        colonna = (regione["cuore"][0] - config.REGIONI_EST_0) // config.REGIONE_CUORE_M
        riga_da_nord = config.REGIONI_RIGHE - 1 - (regione["cuore"][2] - config.REGIONI_NORD_0) // config.REGIONE_CUORE_M
        tutto[riga_da_nord * quad:riga_da_nord * quad + quad + 1, colonna * quad:colonna * quad + quad + 1] = np.maximum(pezzo, 1)
        controlli.append(utilita.leggi_json(controllo))
    CARTELLA_CANTONE.mkdir(parents=True, exist_ok=True)
    tutto.tofile(CARTELLA_CANTONE / "rilievo.bin")
    fatte = [c for c in controlli if c.get("completa")]
    riassunto = {
        "rilievo": {"colonne": colonne, "righe": righe, "passo_m": config.PASSO_M * 2 * RIDUZIONE_RILIEVO,
                    "est_min": config.REGIONI_EST_0,
                    "nord_max": config.REGIONI_NORD_0 + config.REGIONI_RIGHE * config.REGIONE_CUORE_M,
                    "quota_base": 100, "scala_quota": 0.1},
        "regioni_totali": len(controlli), "regioni_complete": len(fatte),
        "km2_ricostruiti": round(sum(c.get("km2_cantone", 0) for c in fatte), 1),
        "km2_mancanti": round(sum(c.get("km2_cantone", 0) for c in controlli if not c.get("completa")), 1),
        "edifici": sum(c.get("edifici_nel_cuore", 0) for c in fatte),
        "strade_km": round(sum(c.get("strade_km_nel_cuore", 0) for c in fatte), 1),
        "pacchetti_MB": round(sum(c.get("pacchetto_MB", 0) for c in fatte), 1),
        "controlli": controlli,
    }
    utilita.scrivi_json(riassunto, CARTELLA_CANTONE / "stato.json")
    print("Regioni complete: " + str(len(fatte)) + " su " + str(len(controlli)))
    print("Superficie di cantone ricostruita: " + str(riassunto["km2_ricostruiti"]) + " km2, mancante: " + str(riassunto["km2_mancanti"]) + " km2")
    for c in controlli:
        if not c.get("completa"):
            print("   NON completa: " + c["id"] + (" (dati mancanti)" if c.get("mancante") else ""))


def main():
    comando = sys.argv[1] if len(sys.argv) > 1 else ""
    if comando == "scarica":
        scarica()
    elif comando == "regioni":
        regioni()
    elif comando == "area":
        print(",".join(str(v) for v in area_regione(regione_con_id(sys.argv[2])["cuore"])))
    elif comando == "prepara":
        prepara()
    elif comando == "chiudi":
        chiudi(sys.argv[2])
    elif comando == "panoramica":
        panoramica()
    elif comando == "unisci":
        unisci(sys.argv[2])
    else:
        print(__doc__ or "Uso: python cantone.py scarica | regioni | area ID | prepara | chiudi ID | panoramica | unisci CARTELLA")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
