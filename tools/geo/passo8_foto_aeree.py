# PASSO 8 - Foto aeree SWISSIMAGE (swisstopo) per il terreno dell'anteprima
#
# Scarica le foto aeree a 2 m e crea una foto JPEG per ogni pezzo di terreno
# da 2 x 2 km (gli stessi pezzi che usa il gioco).
#
# Uso:
#   python passo8_foto_aeree.py --anteprima
#
# Fonte: Ufficio federale di topografia swisstopo (SWISSIMAGE, Open Government Data)

import re

import numpy as np
import rasterio
import requests
from PIL import Image
from rasterio.merge import merge

import config
import utilita

STAC_SWISSIMAGE = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissimage-dop10/items"
LATO_PEZZO_M = 2000      # come i pezzi di terreno del gioco
RISOLUZIONE_M = 2        # foto a 2 m: 1000 x 1000 pixel per pezzo
CARTELLA_FOTO = config.CARTELLA_SCRIPT.parent.parent / "anteprima" / "dati" / "foto"


def cerca_tasselli(area):
    margine = 1000
    area_larga = (area[0] - margine, area[1] + margine, area[2] - margine, area[3] + margine)
    lon_min, lat_min, lon_max, lat_max = utilita.area_in_wgs84(area_larga)
    url = STAC_SWISSIMAGE
    parametri = {"bbox": str(lon_min) + "," + str(lat_min) + "," + str(lon_max) + "," + str(lat_max), "limit": 100}
    migliori = {}
    while url:
        risposta = requests.get(url, params=parametri, timeout=120, headers={"User-Agent": config.NOME_PROGRAMMA})
        risposta.raise_for_status()
        dati = risposta.json()
        for elemento in dati.get("features", []):
            for nome, asset in elemento.get("assets", {}).items():
                if not nome.endswith(".tif"):
                    continue
                if asset.get("eo:gsd") != 2.0 and "_2_2056" not in nome:
                    continue
                trovato = re.search(r"_(\d{4})_(\d{4})-(\d{4})_", nome)
                if not trovato:
                    continue
                anno = int(trovato.group(1))
                chiave = trovato.group(2) + "-" + trovato.group(3)
                if chiave not in migliori or migliori[chiave]["anno"] < anno:
                    migliori[chiave] = {"anno": anno, "nome": nome, "url": asset["href"]}
        url = None
        parametri = None
        for link in dati.get("links", []):
            if link.get("rel") == "next":
                url = link["href"]
    return list(migliori.values())


def main():
    argomenti = utilita.leggi_argomenti("Foto aeree SWISSIMAGE per l'anteprima")
    if not argomenti.pilota:
        argomenti.pilota = True
    area = utilita.area_di_lavoro(True)
    est_min, est_max, nord_min, nord_max = area

    print("1) Cerco le foto aeree SWISSIMAGE (2 m)...")
    tasselli = cerca_tasselli(area)
    print("   Trovati " + str(len(tasselli)) + " tasselli")
    cartella = config.CARTELLA_DOWNLOAD / "swissimage"
    anni = {}
    for tassello in tasselli:
        utilita.scarica_file(tassello["url"], cartella / tassello["nome"])
        anni[tassello["anno"]] = anni.get(tassello["anno"], 0) + 1
    print("   Anni delle foto: " + ", ".join(str(a) + " (" + str(n) + ")" for a, n in sorted(anni.items())))

    print("2) Creo una foto per ogni pezzo da 2 x 2 km...")
    indice = []
    for percorso in sorted(cartella.glob("*.tif")):
        with rasterio.open(percorso) as file:
            indice.append((percorso, file.bounds))
    CARTELLA_FOTO.mkdir(parents=True, exist_ok=True)
    colonne = (est_max - est_min) // LATO_PEZZO_M
    righe = (nord_max - nord_min) // LATO_PEZZO_M
    pixel = LATO_PEZZO_M // RISOLUZIONE_M
    fatte = 0
    for y in range(righe):
        for x in range(colonne):
            e0 = est_min + x * LATO_PEZZO_M
            n1 = nord_max - y * LATO_PEZZO_M
            confini = (e0, n1 - LATO_PEZZO_M, e0 + LATO_PEZZO_M, n1)
            utili = [p for p, b in indice
                     if b.right > confini[0] and b.left < confini[2] and b.top > confini[1] and b.bottom < confini[3]]
            if not utili:
                continue
            mosaico, _ = merge(utili, bounds=confini, res=RISOLUZIONE_M)
            immagine = np.transpose(mosaico[:3, :pixel, :pixel], (1, 2, 0)).astype(np.uint8)
            Image.fromarray(immagine).save(CARTELLA_FOTO / ("foto_x" + str(x) + "_y" + str(y) + ".jpg"), quality=85)
            fatte = fatte + 1
    print("   Foto create: " + str(fatte) + " di " + str(colonne * righe))
    print("Fatto. File in: " + str(CARTELLA_FOTO))


if __name__ == "__main__":
    main()
