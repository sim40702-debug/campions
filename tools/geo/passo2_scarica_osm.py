# PASSO 2 - Scarica da OpenStreetMap i confini e le strade
#
# - Confine del Canton Ticino e degli 8 distretti (le nostre regioni)
# - Strade pubbliche asfaltate (decisione D3)
# - Solo per il pilota: edifici, boschi e alberi (Sprint D1),
#   segnaletica, lampioni, localita' (Sprint D2), fiumi e acqua (Sprint C1)
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


def filtro_pilota():
    area = utilita.area_di_lavoro(True)
    lon_min, lat_min, lon_max, lat_max = utilita.area_in_wgs84(area)
    return "(" + str(lat_min) + "," + str(lon_min) + "," + str(lat_max) + "," + str(lon_max) + ")"


def query_edifici():
    return "[out:json][timeout:900];\nway[\"building\"]" + filtro_pilota() + ";\nout geom;\n"


def query_verde():
    f = filtro_pilota()
    return ("[out:json][timeout:900];\n(\n"
            + '  way["landuse"="forest"]' + f + ";\n"
            + '  way["natural"="wood"]' + f + ";\n"
            + '  relation["landuse"="forest"]' + f + ";\n"
            + '  relation["natural"="wood"]' + f + ";\n"
            + '  node["natural"="tree"]' + f + ";\n"
            + ");\nout geom;\n")


def query_dettagli():
    f = filtro_pilota()
    return ("[out:json][timeout:900];\n(\n"
            + '  node["highway"~"^(traffic_signals|stop|give_way|street_lamp|crossing)$"]' + f + ";\n"
            + '  node["place"~"^(city|town|village|suburb|hamlet|neighbourhood|quarter)$"]' + f + ";\n"
            + ");\nout;\n")


def query_acqua():
    f = filtro_pilota()
    return ("[out:json][timeout:900];\n(\n"
            + '  way["natural"="water"]' + f + ";\n"
            + '  relation["natural"="water"]' + f + ";\n"
            + '  way["waterway"~"^(river|stream|canal)$"]' + f + ";\n"
            + ");\nout geom;\n")


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

    if argomenti.pilota:
        print("3) Edifici del pilota...")
        edifici = utilita.chiedi_overpass(query_edifici(), cartella / "edifici_pilota.json")
        print("   Edifici scaricati: " + str(len(edifici.get("elements", []))))

        print("4) Boschi e alberi del pilota...")
        verde = utilita.chiedi_overpass(query_verde(), cartella / "verde_pilota.json")
        print("   Elementi scaricati: " + str(len(verde.get("elements", []))))

        print("5) Segnaletica, lampioni e localita' del pilota...")
        dettagli = utilita.chiedi_overpass(query_dettagli(), cartella / "dettagli_pilota.json")
        print("   Elementi scaricati: " + str(len(dettagli.get("elements", []))))

        print("6) Laghi, fiumi e torrenti del pilota...")
        acqua = utilita.chiedi_overpass(query_acqua(), cartella / "acqua_pilota.json")
        print("   Elementi scaricati: " + str(len(acqua.get("elements", []))))

    print("Fatto. I file sono in: " + str(cartella))


if __name__ == "__main__":
    main()
