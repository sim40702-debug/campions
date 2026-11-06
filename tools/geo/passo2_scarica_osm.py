# PASSO 2 - Scarica da OpenStreetMap i confini e le strade
#
# - Confine del Canton Ticino e degli 8 distretti (le nostre regioni)
# - Strade pubbliche asfaltate (decisione D3)
#
# Uso:
#   python passo2_scarica_osm.py --pilota   (strade solo nel settore pilota)
#   python passo2_scarica_osm.py            (strade di tutto il Ticino)
#
# Dati: (c) OpenStreetMap contributors, licenza ODbL

import config
import utilita


def query_confini():
    # Il Ticino ha il codice ISO "CH-TI". I distretti in Svizzera hanno admin_level 6.
    return """
[out:json][timeout:600];
area["ISO3166-2"="CH-TI"]->.ti;
(
  relation["boundary"="administrative"]["ISO3166-2"="CH-TI"];
  relation["boundary"="administrative"]["admin_level"="6"](area.ti);
);
out geom;
"""


def query_strade(pilota):
    tipi = "|".join(config.TIPI_STRADA)
    if pilota:
        area = utilita.area_di_lavoro(True)
        lon_min, lat_min, lon_max, lat_max = utilita.area_in_wgs84(area)
        filtro = "(" + str(lat_min) + "," + str(lon_min) + "," + str(lat_max) + "," + str(lon_max) + ")"
        inizio = "[out:json][timeout:900];\n"
    else:
        filtro = "(area.ti)"
        inizio = '[out:json][timeout:900];\narea["ISO3166-2"="CH-TI"]->.ti;\n'
    return inizio + 'way["highway"~"^(' + tipi + ')$"]' + filtro + ";\nout geom;\n"


def main():
    argomenti = utilita.leggi_argomenti("Scarica confini e strade da OpenStreetMap")
    utilita.crea_cartelle()
    cartella = config.CARTELLA_DOWNLOAD / "osm"
    cartella.mkdir(parents=True, exist_ok=True)

    print("1) Confini del Ticino e dei distretti...")
    confini = utilita.chiedi_overpass(query_confini(), cartella / "confini.json")
    for elemento in confini.get("elements", []):
        nome = elemento.get("tags", {}).get("name", "?")
        livello = elemento.get("tags", {}).get("admin_level", "?")
        print("   - " + nome + " (admin_level " + livello + ")")

    print("2) Strade (" + utilita.nome_area(argomenti.pilota) + ")... puo' durare qualche minuto")
    nome_file = "strade_" + utilita.nome_area(argomenti.pilota) + ".json"
    strade = utilita.chiedi_overpass(query_strade(argomenti.pilota), cartella / nome_file)
    print("   Tratti di strada scaricati: " + str(len(strade.get("elements", []))))

    print("Fatto. I file sono in: " + str(cartella))


if __name__ == "__main__":
    main()
