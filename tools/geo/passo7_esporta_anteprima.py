# PASSO 7 - Prepara i dati del settore pilota per l'anteprima Three.js
#
# Legge:
#   dati/per_unreal/pilota/terreno_pilota.png   (passo 3)
#   dati/download/osm/strade_pilota.json         (passo 2)
# Scrive in anteprima/dati/:
#   terreno.bin   quote ogni 3.94 m (circa 4 m), numeri a 16 bit
#   terreno.json  informazioni per leggere terreno.bin
#   strade.json   strade in coordinate locali (metri), con le quote
#   edifici.json  contorni degli edifici con quota di base e di tetto (Sprint D1)
#   bosco.bin     dove c'e' bosco (1) o no (0), stessa griglia del terreno
#   alberi.json   alberi singoli mappati in OSM
#   dettagli.json semafori, stop, precedenze, lampioni, strisce, localita' (Sprint D2)
#
# Coordinate dell'anteprima (metri), centro = centro del settore pilota:
#   x verso EST, y verso l'ALTO (quota reale), z verso SUD
#
# Uso:  python passo7_esporta_anteprima.py

import json

import numpy as np
from PIL import Image
from rasterio.features import rasterize
from rasterio.transform import Affine
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import linemerge, polygonize, unary_union

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


def esporta_edifici(percorso, quote, area, zona, centro_est, centro_nord):
    est_min, est_max, nord_min, nord_max = area
    edifici = []
    for elemento in utilita.leggi_json(percorso).get("elements", []):
        if elemento.get("type") != "way":
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
        poligono = poligono.simplify(0.3)
        anello = list(poligono.exterior.coords)[:-1]
        if len(anello) < 3:
            continue
        sotto = [quota_nel_punto(quote, est_min, nord_max, e, n) for e, n in anello]
        tag = elemento.get("tags", {})
        piatta = []
        for e, n in anello:
            piatta.append(round(e - centro_est, 1))
            piatta.append(round(-(n - centro_nord), 1))
        edifici.append({
            "p": piatta,
            "b": round(min(sotto) - 0.5, 1),
            "h": round(max(sotto) + altezza_edificio(tag, poligono.area), 1),
            "c": elemento.get("id", 0) % 6,
            "t": 1 if tag.get("building", "yes") in TIPI_TETTO_A_TEGOLE else 0,
        })
    return edifici


def esporta_verde(percorso, area, zona, punti, passo, centro_est, centro_nord):
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
        maschera = rasterize(forme, out_shape=(punti, punti), transform=trasformazione, fill=0, dtype="uint8")
    else:
        maschera = np.zeros((punti, punti), dtype=np.uint8)
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


def quota_nel_punto(quote, est_min, nord_max, est, nord):
    # Interpolazione tra i 4 punti vicini della heightmap
    colonna = (est - est_min) / config.PASSO_M
    riga = (nord_max - nord) / config.PASSO_M
    colonna = min(max(colonna, 0), quote.shape[1] - 1.001)
    riga = min(max(riga, 0), quote.shape[0] - 1.001)
    c0 = int(colonna)
    r0 = int(riga)
    fx = colonna - c0
    fy = riga - r0
    sopra = quote[r0, c0] * (1 - fx) + quote[r0, c0 + 1] * fx
    sotto = quote[r0 + 1, c0] * (1 - fx) + quote[r0 + 1, c0 + 1] * fx
    return float(sopra * (1 - fy) + sotto * fy)


def pezzi_di_linea(geometria):
    # Il taglio con il bordo del pilota puo' dare piu' pezzi
    if geometria.is_empty:
        return []
    if geometria.geom_type == "LineString":
        return [geometria]
    if geometria.geom_type == "MultiLineString":
        return list(geometria.geoms)
    return [g for g in getattr(geometria, "geoms", []) if g.geom_type == "LineString"]


def main():
    area = utilita.area_di_lavoro(True)
    est_min, est_max, nord_min, nord_max = area
    centro_est = (est_min + est_max) / 2
    centro_nord = (nord_min + nord_max) / 2

    percorso_png = config.CARTELLA_UNREAL / "pilota" / "terreno_pilota.png"
    percorso_strade = config.CARTELLA_DOWNLOAD / "osm" / "strade_pilota.json"
    if not percorso_png.exists() or not percorso_strade.exists():
        print("Mancano i dati: esegui prima i passi 1, 2 e 3 con --pilota.")
        raise SystemExit(1)
    CARTELLA_ANTEPRIMA.mkdir(parents=True, exist_ok=True)

    print("1) Terreno...")
    quote = utilita.valori_16bit_in_quote(np.array(Image.open(percorso_png)))
    ridotte = quote[::2, ::2]   # un punto su due: da circa 2 m a circa 4 m
    valori = np.clip(np.round((ridotte - QUOTA_BASE) / SCALA_QUOTA), 0, 65535).astype("<u2")
    valori.tofile(CARTELLA_ANTEPRIMA / "terreno.bin")
    info = {
        "punti": int(ridotte.shape[0]),
        "passo_m": config.PASSO_M * 2,
        "lato_m": est_max - est_min,
        "quota_base": QUOTA_BASE,
        "scala_quota": SCALA_QUOTA,
        "centro_lv95": [centro_est, centro_nord],
        "livello_lago": 193.3,
        "fonte": "Fonte: Ufficio federale di topografia swisstopo",
    }
    utilita.scrivi_json(info, CARTELLA_ANTEPRIMA / "terreno.json")
    print("   " + str(ridotte.shape[0]) + " x " + str(ridotte.shape[1]) + " punti, quota "
          + str(round(float(ridotte.min()))) + " - " + str(round(float(ridotte.max()))) + " m")

    print("2) Strade...")
    zona = box(est_min, nord_min, est_max, nord_max)

    # Prima raccolgo tutti i pezzi di strada (tagliati al bordo del pilota)
    pezzi = []
    for elemento in utilita.leggi_json(percorso_strade).get("elements", []):
        if elemento.get("type") != "way" or "geometry" not in elemento:
            continue
        tag = elemento.get("tags", {})
        punti = [utilita.DA_WGS84_A_LV95.transform(p["lon"], p["lat"]) for p in elemento["geometry"]]
        if len(punti) < 2:
            continue
        ponte = tag.get("bridge") not in (None, "no")
        galleria = tag.get("tunnel") not in (None, "no")
        for pezzo in pezzi_di_linea(LineString(punti).intersection(zona)):
            pezzi.append({"linea": pezzo.segmentize(PASSO_STRADE_M), "tag": tag,
                          "ponte": ponte, "galleria": galleria})

    # Ponti e gallerie in OSM sono spesso divisi in piu' pezzi.
    # Li unisco: la quota va calcolata tra i due VERI ingressi (non a ogni pezzo).
    def catene(tipo):
        linee = [p["linea"] for p in pezzi if p[tipo]]
        if not linee:
            return []
        unite = linemerge(linee)
        lista = pezzi_di_linea(unite)
        risultato = []
        for linea in lista:
            inizio = linea.coords[0]
            fine = linea.coords[-1]
            q_inizio = quota_nel_punto(quote, est_min, nord_max, inizio[0], inizio[1])
            q_fine = quota_nel_punto(quote, est_min, nord_max, fine[0], fine[1])
            # Se un capo e' tagliato dal bordo del pilota, la sua quota non vale: uso l'altro capo
            if zona.exterior.distance(Point(inizio)) < 1:
                q_inizio = q_fine
            if zona.exterior.distance(Point(fine)) < 1:
                q_fine = q_inizio
            risultato.append((linea, q_inizio, q_fine))
        return risultato

    catene_ponti = catene("ponte")
    catene_gallerie = catene("galleria")

    def quota_su_catena(lista, e, n):
        punto = Point(e, n)
        for linea, q_inizio, q_fine in lista:
            if linea.distance(punto) < 0.5:
                parte = linea.project(punto) / linea.length if linea.length else 0
                return q_inizio + (q_fine - q_inizio) * parte
        return None

    strade = []
    km = 0.0
    for pezzo in pezzi:
        coordinate = list(pezzo["linea"].coords)
        terreno = [quota_nel_punto(quote, est_min, nord_max, e, n) for e, n in coordinate]

        if pezzo["ponte"] or pezzo["galleria"]:
            lista = catene_ponti if pezzo["ponte"] else catene_gallerie
            quote_strada = []
            for (e, n), q_terreno in zip(coordinate, terreno):
                q = quota_su_catena(lista, e, n)
                if q is None:
                    q = q_terreno
                if pezzo["galleria"]:
                    q = min(q, q_terreno)   # una galleria non passa mai SOPRA il terreno
                else:
                    q = max(q, q_terreno)   # un ponte non passa mai SOTTO il terreno
                quote_strada.append(q)
        else:
            # Strade normali: media su 5 punti per togliere i piccoli scalini
            quote_strada = []
            for i in range(len(terreno)):
                vicine = terreno[max(0, i - 2): i + 3]
                quote_strada.append(sum(vicine) / len(vicine))

        piatta = []
        for (e, n), q in zip(coordinate, quote_strada):
            piatta.append(round(e - centro_est, 1))
            piatta.append(round(q + SOPRA_TERRENO_M, 2))
            piatta.append(round(-(n - centro_nord), 1))

        tag = pezzo["tag"]
        strade.append({
            "n": tag.get("name") or tag.get("ref") or "",
            "t": tag.get("highway", ""),
            "w": round(larghezza_strada(tag), 1),
            "b": pezzo["ponte"],
            "g": pezzo["galleria"],
            "p": piatta,
        })
        km = km + pezzo["linea"].length / 1000

    with open(CARTELLA_ANTEPRIMA / "strade.json", "w", encoding="utf-8") as file:
        json.dump({"fonte": "(c) OpenStreetMap contributors, ODbL", "strade": strade},
                  file, ensure_ascii=False, separators=(",", ":"))
    print("   " + str(len(strade)) + " strade, " + str(round(km, 1)) + " km")

    print("3) Edifici...")
    percorso_edifici = config.CARTELLA_DOWNLOAD / "osm" / "edifici_pilota.json"
    if percorso_edifici.exists():
        edifici = esporta_edifici(percorso_edifici, quote, area, zona, centro_est, centro_nord)
        with open(CARTELLA_ANTEPRIMA / "edifici.json", "w", encoding="utf-8") as file:
            json.dump({"fonte": "(c) OpenStreetMap contributors, ODbL", "edifici": edifici},
                      file, separators=(",", ":"))
        print("   " + str(len(edifici)) + " edifici")
    else:
        print("   Manca edifici_pilota.json (passo 2): niente edifici")

    print("4) Boschi e alberi...")
    percorso_verde = config.CARTELLA_DOWNLOAD / "osm" / "verde_pilota.json"
    if percorso_verde.exists():
        maschera, alberi = esporta_verde(percorso_verde, area, zona, int(ridotte.shape[0]),
                                         config.PASSO_M * 2, centro_est, centro_nord)
        maschera.astype(np.uint8).tofile(CARTELLA_ANTEPRIMA / "bosco.bin")
        with open(CARTELLA_ANTEPRIMA / "alberi.json", "w", encoding="utf-8") as file:
            json.dump({"fonte": "(c) OpenStreetMap contributors, ODbL", "alberi": alberi},
                      file, separators=(",", ":"))
        superficie = float(maschera.mean()) * (est_max - est_min) * (nord_max - nord_min) / 1_000_000
        print("   Bosco: " + str(round(superficie, 1)) + " km2, alberi singoli: " + str(len(alberi) // 2))
    else:
        print("   Manca verde_pilota.json (passo 2): niente boschi")

    print("5) Segnaletica, lampioni e localita'...")
    percorso_dettagli = config.CARTELLA_DOWNLOAD / "osm" / "dettagli_pilota.json"
    if percorso_dettagli.exists():
        dettagli = esporta_dettagli(percorso_dettagli, zona, centro_est, centro_nord)
        dettagli["fonte"] = "(c) OpenStreetMap contributors, ODbL"
        with open(CARTELLA_ANTEPRIMA / "dettagli.json", "w", encoding="utf-8") as file:
            json.dump(dettagli, file, ensure_ascii=False, separators=(",", ":"))
        for chiave in ["semafori", "stop", "precedenza", "lampioni", "strisce"]:
            print("   " + chiave + ": " + str(len(dettagli[chiave]) // 2))
        print("   localita': " + str(len(dettagli["localita"])))
    else:
        print("   Manca dettagli_pilota.json (passo 2)")

    print("Fatto. File in: " + str(CARTELLA_ANTEPRIMA))


if __name__ == "__main__":
    main()
