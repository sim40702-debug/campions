# PASSO 1 - Scarica i dati delle altezze
#
# - swissALTI3D di swisstopo, risoluzione 2 m (tasselli da 1 x 1 km)
# - Copernicus DEM 30 m solo per il bordo fuori dalla Svizzera (Italia)
#
# Uso:
#   python passo1_scarica_altimetria.py --pilota   (solo Locarno 8 x 8 km)
#   python passo1_scarica_altimetria.py --anteprima (Locarnese 16 x 12 km)
#   python passo1_scarica_altimetria.py            (tutto il mondo 68 x 96 km)
#
# Fonte: Ufficio federale di topografia swisstopo (Open Government Data)

import re

import requests

import config
import utilita


def cerca_tasselli_swissalti3d(area):
    # Chiede al catalogo STAC di swisstopo tutti i tasselli dentro l'area
    margine = 1000
    area_larga = (area[0] - margine, area[1] + margine, area[2] - margine, area[3] + margine)
    lon_min, lat_min, lon_max, lat_max = utilita.area_in_wgs84(area_larga)
    url = config.STAC_SWISSALTI3D
    parametri = {"bbox": str(lon_min) + "," + str(lat_min) + "," + str(lon_max) + "," + str(lat_max),
                 "limit": 100}

    # Per ogni tassello (per esempio "2700-1112") teniamo solo l'anno piu' recente
    migliori = {}
    pagina = 1
    while url:
        print("  Catalogo swisstopo, pagina " + str(pagina) + "...")
        risposta = requests.get(url, params=parametri, timeout=120,
                                headers={"User-Agent": config.NOME_PROGRAMMA})
        risposta.raise_for_status()
        dati = risposta.json()

        for elemento in dati.get("features", []):
            for nome, asset in elemento.get("assets", {}).items():
                # Vogliamo solo i file GeoTIFF a 2 m
                if not nome.endswith(".tif"):
                    continue
                if asset.get("eo:gsd") != 2.0 and "_2_2056_" not in nome:
                    continue
                trovato = re.search(r"_(\d{4})_(\d{4})-(\d{4})_", nome)
                if not trovato:
                    continue
                anno = int(trovato.group(1))
                est_km = int(trovato.group(2))
                nord_km = int(trovato.group(3))
                # Scarto i tasselli troppo lontani dall'area
                if est_km * 1000 < area_larga[0] - 1000 or est_km * 1000 > area_larga[1]:
                    continue
                if nord_km * 1000 < area_larga[2] - 1000 or nord_km * 1000 > area_larga[3]:
                    continue
                chiave = str(est_km) + "-" + str(nord_km)
                if chiave not in migliori or migliori[chiave]["anno"] < anno:
                    migliori[chiave] = {"anno": anno, "nome": nome, "url": asset["href"]}

        # Pagina successiva (il catalogo restituisce al massimo 100 elementi alla volta)
        url = None
        parametri = None
        for link in dati.get("links", []):
            if link.get("rel") == "next":
                url = link["href"]
        pagina = pagina + 1

    return list(migliori.values())


def scarica_copernicus():
    # 4 tasselli da 1 x 1 grado coprono tutto il rettangolo del mondo
    cartella = config.CARTELLA_DOWNLOAD / "copernicus"
    for lat in [45, 46]:
        for lon in [8, 9]:
            nome = "Copernicus_DSM_COG_10_N" + str(lat) + "_00_E00" + str(lon) + "_00_DEM"
            url = config.COPERNICUS_URL + "/" + nome + "/" + nome + ".tif"
            percorso = cartella / (nome + ".tif")
            print("  " + nome)
            utilita.scarica_file(url, percorso)


def main():
    argomenti = utilita.leggi_argomenti("Scarica i dati delle altezze")
    utilita.crea_cartelle()
    area = utilita.area_di_lavoro(argomenti.pilota)

    print("1) Cerco i tasselli swissALTI3D (2 m)...")
    tasselli = cerca_tasselli_swissalti3d(area)
    print("   Trovati " + str(len(tasselli)) + " tasselli.")
    if len(tasselli) == 0:
        print("   ATTENZIONE: nessun tassello trovato. Controlla la connessione o l'indirizzo STAC in config.py")
        return

    print("2) Scarico i tasselli (quelli gia' scaricati vengono saltati)...")
    cartella = config.CARTELLA_DOWNLOAD / "swissalti3d"
    nuovi = 0
    for numero, tassello in enumerate(tasselli, start=1):
        if utilita.scarica_file(tassello["url"], cartella / tassello["nome"]):
            nuovi = nuovi + 1
        if numero % 50 == 0:
            print("   " + str(numero) + " / " + str(len(tasselli)))
    print("   Nuovi file scaricati: " + str(nuovi))

    if not argomenti.pilota:
        print("3) Scarico Copernicus DEM 30 m per il bordo fuori dalla Svizzera...")
        scarica_copernicus()

    print("Fatto. I file sono in: " + str(config.CARTELLA_DOWNLOAD))


if __name__ == "__main__":
    main()
