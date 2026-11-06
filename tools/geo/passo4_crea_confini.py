# PASSO 4 - Confini del Ticino e delle 8 regioni
#
# Crea:
# - confini in coordinate LV95 (GeoJSON), per controllarli anche in QGIS
# - elenco dei settori: quali toccano il Ticino e a quale regione appartengono
# - layer "Confine" per Unreal (PNG 8 bit): una striscia di 8 m lungo il confine
# - controlli: il Ticino sta nel rettangolo del mondo? La superficie e' giusta?
#
# Uso:
#   python passo4_crea_confini.py --pilota
#   python passo4_crea_confini.py

import numpy as np
from PIL import Image
from rasterio.features import rasterize
from rasterio.transform import Affine
from shapely.geometry import LineString, box, mapping
from shapely.ops import polygonize, unary_union

import config
import utilita

# Le 8 regioni del Product Backlog (si riconoscono dal nome del distretto)
REGIONI = [
    ("R1", "Mendrisio"),
    ("R2", "Lugano"),
    ("R3", "Locarno"),
    ("R4", "Vallemaggia"),
    ("R5", "Bellinzona"),
    ("R6", "Riviera"),
    ("R7", "Blenio"),
    ("R8", "Leventina"),
]

SUPERFICIE_UFFICIALE_KM2 = 2812


def poligono_da_relazione(relazione):
    # Una relazione OSM e' fatta di tanti pezzi di linea: li uniamo in un poligono
    esterni = []
    interni = []
    for membro in relazione.get("members", []):
        if membro.get("type") != "way" or "geometry" not in membro:
            continue
        punti = []
        for punto in membro["geometry"]:
            est, nord = utilita.DA_WGS84_A_LV95.transform(punto["lon"], punto["lat"])
            punti.append((est, nord))
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


def codice_regione(nome_distretto):
    for codice, parola in REGIONI:
        if parola.lower() in nome_distretto.lower():
            return codice
    return None


def scrivi_geojson(elementi, percorso):
    # elementi = lista di (nome, poligono)
    geojson = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::2056"}},
        "features": [],
    }
    for nome, poligono in elementi:
        geojson["features"].append({"type": "Feature", "properties": {"nome": nome},
                                    "geometry": mapping(poligono)})
    utilita.scrivi_json(geojson, percorso)


def crea_layer_confine(linea, est_min, nord_max, punti, percorso, anche_se_vuoto):
    # Stessa griglia della heightmap: 255 = confine, 0 = niente.
    # Con i tasselli servono TUTTI i file (anche vuoti), altrimenti Unreal non li importa.
    passo = config.PASSO_M
    trasformazione = Affine(passo, 0, est_min - passo / 2, 0, -passo, nord_max + passo / 2)
    zona = box(est_min - passo, nord_max - passo * punti, est_min + passo * punti, nord_max + passo)
    striscia = linea.intersection(zona)
    if striscia.is_empty:
        if not anche_se_vuoto:
            return False
        immagine = np.zeros((punti, punti), dtype=np.uint8)
    else:
        immagine = rasterize([(striscia, 255)], out_shape=(punti, punti), transform=trasformazione,
                             fill=0, all_touched=True, dtype="uint8")
    percorso.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(immagine.astype(np.uint8)).save(percorso)
    return not striscia.is_empty


def main():
    argomenti = utilita.leggi_argomenti("Confini del Ticino e delle regioni")
    utilita.crea_cartelle()
    percorso_osm = config.CARTELLA_DOWNLOAD / "osm" / "confini.json"
    if not percorso_osm.exists():
        print("Manca confini.json: prima esegui il passo 2.")
        return
    dati = utilita.leggi_json(percorso_osm)

    print("1) Costruisco i poligoni...")
    ticino = None
    distretti = []
    for elemento in dati.get("elements", []):
        tag = elemento.get("tags", {})
        if tag.get("ISO3166-2") == "CH-TI":
            ticino = poligono_da_relazione(elemento)
        elif tag.get("admin_level") == "6":
            codice = codice_regione(tag.get("name", ""))
            if codice:
                distretti.append((codice + " " + tag.get("name", ""), poligono_da_relazione(elemento)))
    if ticino is None or ticino.is_empty:
        print("   Confine del Ticino non trovato in confini.json.")
        return
    distretti.sort()

    # Controllo 1: superficie
    superficie = ticino.area / 1_000_000
    differenza = abs(superficie - SUPERFICIE_UFFICIALE_KM2) / SUPERFICIE_UFFICIALE_KM2 * 100
    print("   Superficie Ticino: " + str(round(superficie)) + " km2 (ufficiale " + str(SUPERFICIE_UFFICIALE_KM2)
          + ", differenza " + str(round(differenza, 1)) + " %)")
    print("   Regioni trovate: " + str(len(distretti)) + " di 8")
    for nome, poligono in distretti:
        print("     " + nome + ": " + str(round(poligono.area / 1_000_000)) + " km2")

    # Controllo 2: il Ticino sta nel rettangolo del mondo?
    e1, n1, e2, n2 = ticino.bounds
    dentro = (e1 >= config.MONDO_EST_MIN and e2 <= config.MONDO_EST_MAX
              and n1 >= config.MONDO_NORD_MIN and n2 <= config.MONDO_NORD_MAX)
    print("   Estensione Ticino LV95: est " + str(round(e1)) + "-" + str(round(e2))
          + ", nord " + str(round(n1)) + "-" + str(round(n2)))
    if dentro:
        print("   OK: il Ticino sta tutto nel rettangolo del mondo.")
    else:
        print("   ATTENZIONE: il Ticino esce dal rettangolo del mondo! Correggere config.py")

    nome = utilita.nome_area(argomenti.pilota)
    cartella = config.CARTELLA_UNREAL / nome / "confini"
    scrivi_geojson([("Ticino", ticino)], cartella / "ticino_lv95.geojson")
    scrivi_geojson(distretti, cartella / "regioni_lv95.geojson")

    print("2) Elenco dei settori...")
    area = utilita.area_di_lavoro(argomenti.pilota)
    settori = utilita.elenco_settori(area)
    nel_ticino = 0
    for settore in settori:
        quadrato = box(settore["est_min"], settore["nord_min"], settore["est_max"], settore["nord_max"])
        parte = quadrato.intersection(ticino).area / quadrato.area
        settore["percento_ticino"] = round(parte * 100, 1)
        settore["nel_ticino"] = parte > 0
        settore["regione"] = None
        migliore = 0
        for nome_distretto, poligono in distretti:
            comune = quadrato.intersection(poligono).area
            if comune > migliore:
                migliore = comune
                settore["regione"] = nome_distretto.split(" ")[0]
        if settore["nel_ticino"]:
            nel_ticino = nel_ticino + 1
    utilita.scrivi_json(settori, cartella / "settori.json")
    print("   Settori totali: " + str(len(settori)) + ", che toccano il Ticino: " + str(nel_ticino))

    print("3) Layer 'Confine' per Unreal...")
    linea = ticino.boundary.buffer(config.LARGHEZZA_CONFINE_M / 2)
    if argomenti.pilota:
        punti = (area[1] - area[0]) // config.LATO_SETTORE_M * config.QUAD_PER_SETTORE + 1
        fatto = crea_layer_confine(linea, area[0], area[3], punti, cartella / "confine_pilota.png", False)
        if not fatto:
            print("   Il confine non passa nel settore pilota: nessun layer da creare.")
    else:
        con_confine = 0
        for settore in settori:
            nome_png = "confine_x" + str(settore["x"]) + "_y" + str(settore["y"]) + ".png"
            if crea_layer_confine(linea, settore["est_min"], settore["nord_max"],
                                  config.PUNTI_PER_SETTORE, cartella / "layer_confine" / nome_png, True):
                con_confine = con_confine + 1
        print("   Layer creati: " + str(len(settori)) + " (il confine passa in " + str(con_confine) + ")")

    print("Fatto. File in: " + str(cartella))


if __name__ == "__main__":
    main()
