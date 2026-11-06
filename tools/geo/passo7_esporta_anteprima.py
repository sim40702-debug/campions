# PASSO 7 - Prepara i dati del settore pilota per l'anteprima Three.js
#
# Legge:
#   dati/per_unreal/pilota/terreno_pilota.png   (passo 3)
#   dati/download/osm/strade_pilota.json         (passo 2)
# Scrive in anteprima/dati/:
#   terreno.bin   quote ogni 3.94 m (circa 4 m), numeri a 16 bit
#   terreno.json  informazioni per leggere terreno.bin
#   strade.json   strade in coordinate locali (metri), con le quote
#
# Coordinate dell'anteprima (metri), centro = centro del settore pilota:
#   x verso EST, y verso l'ALTO (quota reale), z verso SUD
#
# Uso:  python passo7_esporta_anteprima.py

import json

import numpy as np
from PIL import Image
from shapely.geometry import LineString, Point, box
from shapely.ops import linemerge

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
    print("Fatto. File in: " + str(CARTELLA_ANTEPRIMA))


if __name__ == "__main__":
    main()
