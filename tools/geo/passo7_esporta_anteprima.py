# PASSO 7 - Prepara i dati del settore pilota per l'anteprima Three.js
#
# Legge:
#   dati/per_unreal/<area>/terreno_<area>.png    (passo 3)
#   dati/download/osm/strade_<area>....json      (passo 2, vedi utilita.file_osm)
# Scrive in anteprima/dati/:
#   terreno.bin   quote ogni 3.94 m (circa 4 m), numeri a 16 bit
#   terreno.json  informazioni per leggere terreno.bin
#   strade.json   strade in coordinate locali (metri), con le quote
#   edifici.json  contorni degli edifici con quota di base e di tetto (Sprint D1)
#   bosco.bin     dove c'e' bosco (1) o no (0), stessa griglia del terreno
#   alberi.json   alberi singoli mappati in OSM
#   dettagli.json semafori, stop, precedenze, lampioni, strisce, localita' (Sprint D2)
#   uso_suolo.json parchi, giardini, prati, cimiteri e zone residenziali/commerciali/industriali (per la mappa)
#   acqua.json    fiumi, torrenti, stagni (Sprint C1)
#   ferrovie.json binari e funicolari; funivie.json teleferiche e seggiovie (Sprint F1)
#
# Sprint F1: strade lisce agganciate agli incroci, terreno spianato sotto le strade,
# strade piu' strette dove ci sono le case (vedi anteprima_strade.py)
#
# Coordinate dell'anteprima (metri), centro = centro del settore pilota:
#   x verso EST, y verso l'ALTO (quota reale), z verso SUD
#
# Uso:  python passo7_esporta_anteprima.py --anteprima   (Locarnese e Valle Verzasca 16 x 32 km)
#       python passo7_esporta_anteprima.py --pilota      (solo il pilota 8 x 8 km)

import json

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None   # le heightmap grandi non sono un pericolo
from rasterio.features import rasterize
from rasterio.transform import Affine
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union

import anteprima_edifici
import anteprima_strade as vie
import config
import utilita

CARTELLA_ANTEPRIMA = config.CARTELLA_SCRIPT.parent.parent / "anteprima" / "dati"

QUOTA_BASE = 100        # quota che corrisponde al valore 0 nel file
SCALA_QUOTA = 0.1       # 1 unita' = 10 cm
PASSO_STRADE_M = 4      # un punto della strada ogni 4 m
SOPRA_TERRENO_M = 0.2   # la strada sta 20 cm sopra il terreno

# Larghezze di base per tipo di strada (metri), se OSM non la dice
LARGHEZZE = {
    "motorway": 11, "trunk": 9, "primary": 7.5, "secondary": 7, "tertiary": 6.5,
    "unclassified": 5, "residential": 5, "living_street": 4.5,
    "motorway_link": 6, "trunk_link": 6, "primary_link": 6,
    "secondary_link": 6, "tertiary_link": 5.5,
}


# Altezza degli edifici se OSM non la dice: piani per tipo di edificio
PIANI_PER_TIPO = {
    "house": 2, "detached": 2, "semidetached_house": 2, "terrace": 2, "bungalow": 1,
    "residential": 3, "apartments": 4, "commercial": 3, "retail": 2, "office": 4,
    "hotel": 4, "school": 3, "hospital": 5, "industrial": 2, "warehouse": 2,
    "garage": 1, "garages": 1, "shed": 1, "carport": 1, "roof": 1, "hut": 1,
    "church": 4, "chapel": 2, "farm_auxiliary": 1, "barn": 1, "stable": 1,
}
TIPI_TETTO_A_TEGOLE = {"house", "detached", "semidetached_house", "terrace", "bungalow",
                       "church", "chapel", "hut", "barn", "farm_auxiliary", "stable"}


def numero(testo):
    # "12 m" -> 12.0 ; testo non valido -> None
    try:
        return float(str(testo).replace("m", "").replace(",", ".").strip())
    except ValueError:
        return None


def altezza_edificio(tag, superficie):
    altezza = numero(tag.get("height", ""))
    if altezza and 2 < altezza < 120:
        return altezza
    piani = numero(tag.get("building:levels", ""))
    if not piani or piani <= 0 or piani > 40:
        tipo = tag.get("building", "yes")
        piani = PIANI_PER_TIPO.get(tipo)
        if piani is None:
            piani = 3 if superficie > 300 else 2
    return piani * 3.2 + 1.0


def poligono_osm(elemento):
    # Way chiusa o relazione (multipolygon) -> poligono in LV95
    if elemento.get("type") == "way":
        punti = [utilita.DA_WGS84_A_LV95.transform(p["lon"], p["lat"]) for p in elemento.get("geometry", [])]
        if len(punti) < 4:
            return None
        poligono = Polygon(punti)
        return poligono if poligono.is_valid else poligono.buffer(0)
    esterni = []
    interni = []
    for membro in elemento.get("members", []):
        if membro.get("type") != "way" or "geometry" not in membro:
            continue
        punti = [utilita.DA_WGS84_A_LV95.transform(p["lon"], p["lat"]) for p in membro["geometry"]]
        if len(punti) < 2:
            continue
        if membro.get("role") == "inner":
            interni.append(LineString(punti))
        else:
            esterni.append(LineString(punti))
    poligono = unary_union(list(polygonize(esterni)))
    if interni:
        poligono = poligono.difference(unary_union(list(polygonize(interni))))
    return poligono


TIPI_CHIESA = {"church", "chapel", "cathedral", "basilica"}
TIPI_CAMPANILE = {"bell_tower", "tower", "campanile"}
TIPI_SENZA_MURI = {"roof", "carport", "construction", "ruins"}


def poligoni_edifici(percorso, zona):
    # Elenco (poligono LV95, tag, id) degli edifici del pilota
    risultato = []
    for elemento in utilita.leggi_json(percorso).get("elements", []):
        if elemento.get("type") != "way":
            continue
        tag = elemento.get("tags", {})
        if tag.get("building") in TIPI_SENZA_MURI or tag.get("location") == "underground":
            continue
        if numero(tag.get("layer", "0")) is not None and numero(tag.get("layer", "0")) < 0:
            continue
        poligono = poligono_osm(elemento)
        if poligono is None or poligono.is_empty or poligono.area < 6:
            continue
        if not zona.contains(poligono.centroid):
            continue
        poligono = poligono.intersection(zona)
        if poligono.geom_type == "MultiPolygon":
            poligono = max(poligono.geoms, key=lambda g: g.area)
        if poligono.geom_type != "Polygon":
            continue
        risultato.append((poligono.simplify(0.3), tag, elemento.get("id", 0)))
    return risultato


def esporta_edifici(lista, suolo, centro_est, centro_nord):
    edifici = []
    for poligono, tag, ident in lista:
        anello = list(poligono.exterior.coords)[:-1]
        if len(anello) < 3:
            continue
        sotto = [suolo.quota(e, n) for e, n in anello]
        tipo = tag.get("building", "yes")
        if tipo in TIPI_CHIESA or tag.get("amenity") == "place_of_worship":
            genere = 1
        elif tipo in TIPI_CAMPANILE or tag.get("man_made") in ("tower", "campanile") or tag.get("tower:type") == "bell_tower":
            genere = 2
        else:
            genere = 0
        altezza = altezza_edificio(tag, poligono.area)
        if genere == 2 and numero(tag.get("height", "")) is None:
            altezza = 24   # campanile: se OSM non dice l'altezza
        piatta = []
        for e, n in anello:
            piatta.append(round(e - centro_est, 1))
            piatta.append(round(-(n - centro_nord), 1))
        edifici.append({
            "p": piatta,
            "b": round(min(sotto) - 0.5, 1),
            "h": round(max(sotto) + altezza, 1),
            "c": ident % 6,
            "t": 1 if tipo in TIPI_TETTO_A_TEGOLE or genere > 0 else 0,
            "k": genere,
        })
    return edifici


def esporta_verde(percorso, area, zona, forma, passo, centro_est, centro_nord):
    est_min, est_max, nord_min, nord_max = area
    boschi = []
    alberi = []
    for elemento in utilita.leggi_json(percorso).get("elements", []):
        if elemento.get("type") == "node":
            e, n = utilita.DA_WGS84_A_LV95.transform(elemento["lon"], elemento["lat"])
            if zona.contains(Point(e, n)):
                alberi.append(round(e - centro_est, 1))
                alberi.append(round(-(n - centro_nord), 1))
            continue
        poligono = poligono_osm(elemento)
        if poligono is not None and not poligono.is_empty:
            boschi.append(poligono.intersection(zona))
    trasformazione = Affine(passo, 0, est_min - passo / 2, 0, -passo, nord_max + passo / 2)
    forme = [(g, 1) for g in boschi if not g.is_empty]
    if forme:
        maschera = rasterize(forme, out_shape=forma, transform=trasformazione, fill=0, dtype="uint8")
    else:
        maschera = np.zeros(forma, dtype=np.uint8)
    return maschera, alberi


def esporta_dettagli(percorso, zona, centro_est, centro_nord):
    # Nodi OSM -> liste di coordinate locali [x, z, x, z, ...] per tipo
    risultato = {"semafori": [], "stop": [], "precedenza": [], "lampioni": [], "strisce": [], "localita": []}
    tipi = {"traffic_signals": "semafori", "stop": "stop", "give_way": "precedenza",
            "street_lamp": "lampioni", "crossing": "strisce"}
    for elemento in utilita.leggi_json(percorso).get("elements", []):
        if elemento.get("type") != "node":
            continue
        e, n = utilita.DA_WGS84_A_LV95.transform(elemento["lon"], elemento["lat"])
        if not zona.contains(Point(e, n)):
            continue
        x = round(e - centro_est, 1)
        z = round(-(n - centro_nord), 1)
        tag = elemento.get("tags", {})
        if "place" in tag and tag.get("name"):
            risultato["localita"].append({"n": tag["name"], "t": tag["place"], "x": x, "z": z})
        elif tag.get("highway") in tipi:
            lista = risultato[tipi[tag["highway"]]]
            lista.append(x)
            lista.append(z)
    return risultato


LARGHEZZA_CORSO_ACQUA = {"river": 14, "canal": 6, "stream": 2.5}


def esporta_acqua(percorso, suolo, zona, centro_est, centro_nord):
    # Poligoni d'acqua (fiumi larghi, stagni) e corsi d'acqua come linee.
    # Il Lago Maggiore e' gia' nel gioco come superficie piatta: qui lo salto.
    poligoni = []
    linee = []

    def locali(coordinate):
        piatta = []
        for e, n in coordinate:
            piatta.append(round(e - centro_est, 1))
            piatta.append(round(-(n - centro_nord), 1))
        return piatta

    for elemento in utilita.leggi_json(percorso).get("elements", []):
        tag = elemento.get("tags", {})
        if tag.get("waterway") in LARGHEZZA_CORSO_ACQUA and elemento.get("type") == "way":
            punti = [utilita.DA_WGS84_A_LV95.transform(p["lon"], p["lat"]) for p in elemento.get("geometry", [])]
            if len(punti) < 2:
                continue
            for pezzo in pezzi_di_linea(LineString(punti).intersection(zona)):
                if tag.get("tunnel") not in (None, "no"):
                    continue   # tratti intubati: non si vedono
                linee.append({"w": LARGHEZZA_CORSO_ACQUA[tag["waterway"]],
                              "p": locali(pezzo.segmentize(6).coords)})
            continue
        if tag.get("natural") != "water":
            continue
        poligono = poligono_osm(elemento)
        if poligono is None or poligono.is_empty:
            continue
        if poligono.area > 5_000_000 or tag.get("water") == "lake" and poligono.area > 1_000_000:
            continue   # Lago Maggiore
        poligono = poligono.intersection(zona)
        parti = list(poligono.geoms) if poligono.geom_type == "MultiPolygon" else [poligono]
        for parte in parti:
            if parte.geom_type != "Polygon" or parte.area < 20:
                continue
            parte = parte.simplify(0.5)
            if parte.is_empty or parte.geom_type != "Polygon":
                continue
            # Stagni e laghetti: superficie piatta alla quota piu' bassa della riva
            riva = [suolo.quota(e, n) for e, n in parte.exterior.coords]
            piatto = round(min(riva) + 0.2, 2) if tag.get("water") in ("pond", "lake", "reservoir") else None
            poligoni.append({
                "o": locali(list(parte.exterior.coords)[:-1]),
                "f": [locali(list(buco.coords)[:-1]) for buco in parte.interiors],
                "piatto": piatto,
            })
    return {"poligoni": poligoni, "fiumi": linee}


# Uso del suolo per la mappa: tipo breve -> (tag OSM che lo identificano)
TIPI_USO_SUOLO = {
    "parco": [("leisure", ("park", "garden", "playground", "golf_course")), ("landuse", ("recreation_ground", "village_green"))],
    "prato": [("landuse", ("grass", "meadow", "orchard", "vineyard", "allotments"))],
    "sport": [("leisure", ("pitch", "stadium"))],
    "cimitero": [("landuse", ("cemetery",))],
    "residenziale": [("landuse", ("residential",))],
    "commerciale": [("landuse", ("commercial", "retail"))],
    "industriale": [("landuse", ("industrial",))],
}


def esporta_uso_suolo(percorso, zona, centro_est, centro_nord):
    # Poligoni di parchi, prati e zone d'uso del suolo (coordinate locali), semplificati
    aree = []

    def locali(coordinate):
        piatta = []
        for e, n in coordinate:
            piatta.append(round(e - centro_est, 1))
            piatta.append(round(-(n - centro_nord), 1))
        return piatta

    for elemento in utilita.leggi_json(percorso).get("elements", []):
        tag = elemento.get("tags", {})
        tipo = None
        for nome, regole in TIPI_USO_SUOLO.items():
            for chiave, valori in regole:
                if tag.get(chiave) in valori:
                    tipo = nome
        if tipo is None:
            continue
        poligono = poligono_osm(elemento)
        if poligono is None or poligono.is_empty:
            continue
        poligono = poligono.intersection(zona)
        parti = list(poligono.geoms) if poligono.geom_type == "MultiPolygon" else [poligono]
        for parte in parti:
            if parte.geom_type != "Polygon" or parte.area < 60:
                continue
            parte = parte.simplify(1.0)
            if parte.is_empty or parte.geom_type != "Polygon":
                continue
            aree.append({
                "t": tipo,
                "n": tag.get("name", ""),
                "o": locali(list(parte.exterior.coords)[:-1]),
                "f": [locali(list(buco.coords)[:-1]) for buco in parte.interiors],
            })
    return {"aree": aree}


def esporta_funivie(percorso, zona, suolo, centro_est, centro_nord):
    # Teleferiche e seggiovie: punti della fune (stazioni e piloni) con la quota del terreno
    elementi = utilita.leggi_json(percorso).get("elements", [])
    stazioni = set(e["id"] for e in elementi if e.get("type") == "node" and e.get("tags", {}).get("aerialway") == "station")
    funivie = []
    for elemento in elementi:
        tag = elemento.get("tags", {})
        if elemento.get("type") != "way" or "aerialway" not in tag:
            continue
        punti = []
        for nodo, g in zip(elemento.get("nodes", []), elemento.get("geometry", [])):
            e, n = utilita.DA_WGS84_A_LV95.transform(g["lon"], g["lat"])
            if not zona.contains(Point(e, n)):
                continue
            punti.append([round(e - centro_est, 1), round(suolo.quota(e, n), 1),
                          round(-(n - centro_nord), 1), 1 if nodo in stazioni else 0])
        if len(punti) < 2:
            continue
        punti[0][3] = 1
        punti[-1][3] = 1
        funivie.append({"n": tag.get("name", ""), "t": tag["aerialway"], "p": [v for punto in punti for v in punto]})
    return funivie


def esporta_zone(giocabile, centro_est, centro_nord):
    # Zone con un nome (Locarnese, Valle Verzasca...): contorno in coordinate del gioco, tagliato sull'area giocabile.
    # Nel gioco: scritta quando si entra, nome sulla minimappa e sulla mappa grande, ricerca (vedi src/zone.js).
    zone = []
    for voce in getattr(config, "ZONE_ANTEPRIMA", []):
        forma = Polygon(voce["contorno"]).buffer(0).intersection(giocabile)
        if forma.is_empty:
            continue
        if forma.geom_type != "Polygon":
            forma = max(forma.geoms, key=lambda g: g.area)
        forma = forma.simplify(20)
        piatta = []
        for e, n in list(forma.exterior.coords)[:-1]:
            piatta.append(round(e - centro_est))
            piatta.append(round(-(n - centro_nord)))
        etichetta = voce.get("etichetta") or (forma.representative_point().x, forma.representative_point().y)
        zone.append({
            "nome": voce["nome"],
            "contorno": piatta,
            "etichetta": [round(etichetta[0] - centro_est), round(-(etichetta[1] - centro_nord))],
            "verticale": bool(voce.get("verticale", False)),
        })
        print("   zona " + voce["nome"] + ": " + str(round(forma.area / 1_000_000, 1)) + " km2")
    return zone


def larghezza_strada(tag):
    # 1) larghezza scritta in OSM  2) corsie x 3.3 m  3) valore di base
    try:
        return max(3.0, min(25.0, float(tag["width"].replace("m", "").strip())))
    except (KeyError, ValueError):
        pass
    try:
        return int(tag["lanes"]) * 3.3
    except (KeyError, ValueError):
        pass
    return LARGHEZZE.get(tag.get("highway"), 5)


def pezzi_di_linea(geometria):
    # Il taglio con il bordo del pilota puo' dare piu' pezzi
    if geometria.is_empty:
        return []
    if geometria.geom_type == "LineString":
        return [geometria]
    if geometria.geom_type == "MultiLineString":
        return list(geometria.geoms)
    return [g for g in getattr(geometria, "geoms", []) if g.geom_type == "LineString"]


def locali_3d(pezzo, centro_est, centro_nord, sopra):
    piatta = []
    for (e, n), q in zip(pezzo["coordinate"], pezzo["profilo"]):
        piatta.append(round(e - centro_est, 1))
        piatta.append(round(q + sopra, 2))
        piatta.append(round(-(n - centro_nord), 1))
    return piatta


def scrivi(nome, dati):
    dati["fonte"] = "(c) OpenStreetMap contributors, ODbL"
    with open(CARTELLA_ANTEPRIMA / nome, "w", encoding="utf-8") as file:
        json.dump(dati, file, ensure_ascii=False, separators=(",", ":"))


def main():
    argomenti = utilita.leggi_argomenti("Prepara i dati per l'anteprima")
    if not argomenti.pilota:
        argomenti.pilota = True   # senza opzioni: il pilota
    nome = utilita.nome_area(True)
    area = utilita.area_di_lavoro(True)
    est_min, est_max, nord_min, nord_max = area
    centro_est = (est_min + est_max) / 2
    centro_nord = (nord_min + nord_max) / 2
    zona = box(est_min, nord_min, est_max, nord_max)
    # Parte giocabile: il rettangolo senza gli angoli di altre valli (Leventina) che non fanno parte del gioco.
    # Li' resta solo il paesaggio (terreno, foto aeree, boschi, fiumi): niente strade, case, binari, cartelli.
    giocabile = zona
    for contorno in getattr(config, "ESCLUSI_ANTEPRIMA", []):
        giocabile = giocabile.difference(Polygon(contorno).buffer(0))
    if giocabile.geom_type != "Polygon":
        giocabile = max(giocabile.geoms, key=lambda g: g.area)
    print("Area giocabile: " + str(round(giocabile.area / 1_000_000, 1)) + " km2 su " + str(round(zona.area / 1_000_000, 1)))

    percorso_png = config.CARTELLA_UNREAL / nome / ("terreno_" + nome + ".png")
    percorso_strade = utilita.file_osm("strade", True)
    if not percorso_png.exists() or not percorso_strade.exists():
        print("Mancano i dati: esegui prima i passi 1, 2 e 3 con --" + nome + ".")
        raise SystemExit(1)
    CARTELLA_ANTEPRIMA.mkdir(parents=True, exist_ok=True)

    print("1) Terreno...")
    quote = utilita.valori_16bit_in_quote(np.array(Image.open(percorso_png)))
    vero = vie.Griglia(quote, est_min, nord_max, config.PASSO_M)          # 2 m, terreno vero
    ridotte = quote[::2, ::2].copy()                                       # circa 4 m

    print("2) Edifici (servono per la larghezza delle strade)...")
    percorso_edifici = utilita.file_osm("edifici", True)
    lista_edifici = []
    vie_edifici = []
    if percorso_edifici.exists():
        lista_edifici = poligoni_edifici(percorso_edifici, giocabile)
        vie_edifici = [poligono for poligono, tag, ident in lista_edifici]
    print("   " + str(len(lista_edifici)) + " edifici")

    print("3) Strade: profilo liscio, larghezza, terreno spianato...")
    trasforma = utilita.DA_WGS84_A_LV95.transform
    pezzi = vie.raccogli_pezzi(utilita.leggi_json(percorso_strade).get("elements", []), giocabile, trasforma,
                               lambda tag: "highway" in tag)
    vie.calcola_profili(pezzi, vero, giocabile)
    vie.limita_larghezze(pezzi, vie_edifici, larghezza_strada)

    pezzi_ferrovia = []
    percorso_trasporti = utilita.file_osm("trasporti", True)
    if percorso_trasporti.exists():
        elementi = utilita.leggi_json(percorso_trasporti).get("elements", [])
        pezzi_ferrovia = vie.raccogli_pezzi(elementi, giocabile, trasforma, lambda tag: "railway" in tag)
        vie.calcola_profili(pezzi_ferrovia, vero, giocabile)
        for pezzo in pezzi_ferrovia:
            pezzo["larghezze"] = [3.4] * len(pezzo["coordinate"])

    toccati = vie.scava_terreno(ridotte, pezzi + pezzi_ferrovia, est_min, nord_max, config.PASSO_M * 2)
    print("   punti del terreno spianati sotto strade e binari: " + str(toccati))

    strade = []
    km = 0.0
    strette = 0
    for pezzo in pezzi:
        tag = pezzo["tag"]
        voce = {
            "n": tag.get("name") or tag.get("ref") or "",
            "t": tag.get("highway", ""),
            "w": round(pezzo["larghezza"], 1),
            "b": pezzo["ponte"],
            "g": pezzo["galleria"],
            "p": locali_3d(pezzo, centro_est, centro_nord, SOPRA_TERRENO_M),
        }
        if tag.get("junction") in ("roundabout", "circular"):
            voce["j"] = "roundabout"   # rotonda: nel gioco ha l'isola centrale e il cordolo
        # numero di corsie e senso unico veri di OpenStreetMap: li usa la grafica delle righe e degli incroci (0.15.3)
        try:
            corsie = int(str(tag.get("lanes", "")).split(";")[0])
            if 1 <= corsie <= 8:
                voce["l"] = corsie
        except ValueError:
            pass
        if tag.get("oneway") in ("yes", "1", "true") or tag.get("junction") in ("roundabout", "circular"):
            voce["o"] = 1
        elif tag.get("oneway") == "-1":
            voce["o"] = -1
        if min(pezzo["larghezze"]) < pezzo["larghezza"] - 0.05:
            voce["ww"] = pezzo["larghezze"]
            strette = strette + 1
        strade.append(voce)
        km = km + pezzo["linea"].length / 1000
    scrivi("strade.json", {"strade": strade})
    print("   " + str(len(strade)) + " strade, " + str(round(km, 1)) + " km, " + str(strette) + " ristrette dalle case")

    ferrovie = []
    for pezzo in pezzi_ferrovia:
        ferrovie.append({
            "n": pezzo["tag"].get("name", ""),
            "t": pezzo["tag"].get("railway", ""),
            "b": pezzo["ponte"],
            "g": pezzo["galleria"],
            "p": locali_3d(pezzo, centro_est, centro_nord, 0.1),
        })
    scrivi("ferrovie.json", {"ferrovie": ferrovie})
    print("   binari: " + str(len(ferrovie)) + " tratti")

    print("4) Terreno per l'anteprima (spianato)...")
    valori = np.clip(np.round((ridotte - QUOTA_BASE) / SCALA_QUOTA), 0, 65535).astype("<u2")
    valori.tofile(CARTELLA_ANTEPRIMA / "terreno.bin")
    info = {
        "colonne": int(ridotte.shape[1]),
        "righe": int(ridotte.shape[0]),
        "passo_m": config.PASSO_M * 2,
        "lato_x_m": est_max - est_min,
        "lato_z_m": nord_max - nord_min,
        "area": nome,
        "quota_base": QUOTA_BASE,
        "scala_quota": SCALA_QUOTA,
        "centro_lv95": [centro_est, centro_nord],
        "livello_lago": 193.3,
        "zone": esporta_zone(giocabile, centro_est, centro_nord),
        "fonte": "Fonte: Ufficio federale di topografia swisstopo",
    }
    utilita.scrivi_json(info, CARTELLA_ANTEPRIMA / "terreno.json")
    print("   " + str(ridotte.shape[0]) + " x " + str(ridotte.shape[1]) + " punti, quota "
          + str(round(float(ridotte.min()))) + " - " + str(round(float(ridotte.max()))) + " m")
    suolo = vie.Griglia(ridotte, est_min, nord_max, config.PASSO_M * 2)

    print("5) Edifici...")
    edifici = esporta_edifici(lista_edifici, suolo, centro_est, centro_nord)
    edifici, ritagliati, tolti = anteprima_edifici.stacca_dalle_strade(edifici, strade)
    print("   case staccate dall'asfalto: " + str(ritagliati) + " ritagliate, " + str(tolti) + " tolte (quasi tutte sulla strada)")
    scrivi("edifici.json", {"edifici": edifici})
    chiese = sum(1 for e in edifici if e["k"] == 1)
    campanili = sum(1 for e in edifici if e["k"] == 2)
    print("   " + str(len(edifici)) + " edifici, chiese: " + str(chiese) + ", campanili: " + str(campanili))

    print("6) Boschi e alberi...")
    percorso_verde = utilita.file_osm("verde", True)
    if percorso_verde.exists():
        maschera, alberi = esporta_verde(percorso_verde, area, zona, ridotte.shape,
                                         config.PASSO_M * 2, centro_est, centro_nord)
        maschera.astype(np.uint8).tofile(CARTELLA_ANTEPRIMA / "bosco.bin")
        scrivi("alberi.json", {"alberi": alberi})
        superficie = float(maschera.mean()) * (est_max - est_min) * (nord_max - nord_min) / 1_000_000
        print("   Bosco: " + str(round(superficie, 1)) + " km2, alberi singoli: " + str(len(alberi) // 2))

    print("7) Segnaletica, lampioni e localita'...")
    percorso_dettagli = utilita.file_osm("dettagli", True)
    if percorso_dettagli.exists():
        dettagli = esporta_dettagli(percorso_dettagli, giocabile, centro_est, centro_nord)
        scrivi("dettagli.json", dettagli)
        for chiave in ["semafori", "stop", "precedenza", "lampioni", "strisce"]:
            print("   " + chiave + ": " + str(len(dettagli[chiave]) // 2))
        print("   localita': " + str(len(dettagli["localita"])))

    print("8) Fiumi, torrenti e stagni...")
    percorso_acqua = utilita.file_osm("acqua", True)
    if percorso_acqua.exists():
        acqua = esporta_acqua(percorso_acqua, suolo, zona, centro_est, centro_nord)
        scrivi("acqua.json", acqua)
        print("   superfici d'acqua: " + str(len(acqua["poligoni"])) + ", corsi d'acqua: " + str(len(acqua["fiumi"])))

    print("9) Teleferiche e seggiovie...")
    if percorso_trasporti.exists():
        funivie = esporta_funivie(percorso_trasporti, giocabile, suolo, centro_est, centro_nord)
        scrivi("funivie.json", {"funivie": funivie})
        for funivia in funivie:
            print("   " + funivia["t"] + ": " + (funivia["n"] or "senza nome") + " (" + str(len(funivia["p"]) // 4) + " punti)")

    print("10) Parchi, giardini e zone d'uso del suolo...")
    percorso_uso = utilita.file_osm("uso_suolo", True)
    if percorso_uso.exists():
        uso = esporta_uso_suolo(percorso_uso, giocabile, centro_est, centro_nord)
        scrivi("uso_suolo.json", uso)
        print("   aree: " + str(len(uso["aree"])))
    else:
        print("   (non scaricato: rilancia il passo 2 per avere parchi e zone sulla mappa)")

    print("Fatto. File in: " + str(CARTELLA_ANTEPRIMA))


if __name__ == "__main__":
    main()
