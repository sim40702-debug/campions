# PASSO 3 - Crea le heightmap (PNG a 16 bit) da importare in Unreal
#
# - Settore pilota: 1 file da 4065 x 4065 punti (8 x 8 km)
# - Tutto il mondo: 1 file per settore da 2033 x 2033 punti (4 x 4 km),
#   con i nomi _x0_y0, _x1_y0 ... che Unreal capisce da solo
#
# Distanza tra i punti: 1.9685 m (circa 2 m, decisione D2)
#
# Uso:
#   python passo3_crea_terreno.py --pilota
#   python passo3_crea_terreno.py

import numpy as np
import rasterio
from PIL import Image
from rasterio.merge import merge
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject

import config
import utilita

VUOTO = -9999.0


def indice_swissalti3d():
    # Legge i confini di ogni tassello scaricato (una volta sola)
    cartella = config.CARTELLA_DOWNLOAD / "swissalti3d"
    indice = []
    for percorso in sorted(cartella.glob("*.tif")):
        with rasterio.open(percorso) as file:
            indice.append((percorso, file.bounds))
    return indice


def file_copernicus():
    cartella = config.CARTELLA_DOWNLOAD / "copernicus"
    return sorted(cartella.glob("*.tif"))


def crea_griglia(indice, copernicus, est_min, nord_max, punti, punti_y=None):
    # Restituisce una griglia di quote (metri) di punti x punti_y
    if punti_y is None:
        punti_y = punti
    passo = config.PASSO_M
    est_max = est_min + passo * (punti - 1)
    nord_min = nord_max - passo * (punti_y - 1)

    # Ogni punto della griglia e' il CENTRO di un pixel: per questo il mezzo passo
    trasformazione = Affine(passo, 0, est_min - passo / 2, 0, -passo, nord_max + passo / 2)
    quote = np.full((punti_y, punti), np.nan, dtype=np.float32)

    # 1) swissALTI3D (2 m)
    margine = 10
    utili = []
    for percorso, confini in indice:
        if confini.right < est_min - margine or confini.left > est_max + margine:
            continue
        if confini.top < nord_min - margine or confini.bottom > nord_max + margine:
            continue
        utili.append(percorso)

    if utili:
        mosaico, trasf_mosaico = merge(
            utili,
            bounds=(est_min - margine, nord_min - margine, est_max + margine, nord_max + margine),
            nodata=VUOTO,
        )
        reproject(
            source=mosaico[0], destination=quote,
            src_transform=trasf_mosaico, src_crs="EPSG:2056", src_nodata=VUOTO,
            dst_transform=trasformazione, dst_crs="EPSG:2056", dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )

    # 2) Copernicus (30 m) dove swissALTI3D non c'e' (fuori dalla Svizzera)
    if np.isnan(quote).any() and copernicus:
        for percorso in copernicus:
            riempimento = np.full((punti_y, punti), np.nan, dtype=np.float32)
            with rasterio.open(percorso) as file:
                reproject(
                    source=rasterio.band(file, 1), destination=riempimento,
                    dst_transform=trasformazione, dst_crs="EPSG:2056", dst_nodata=np.nan,
                    resampling=Resampling.bilinear,
                )
            buchi = np.isnan(quote) & ~np.isnan(riempimento)
            quote[buchi] = riempimento[buchi]

    # 3) Dove manca ancora tutto: quota fissa (e lo diciamo)
    mancanti = int(np.isnan(quote).sum())
    quote[np.isnan(quote)] = config.QUOTA_SE_MANCA_M
    return quote, mancanti


def salva_png_16bit(quote, percorso):
    valori = utilita.quote_in_valori_16bit(quote)
    percorso.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(valori).save(percorso)


def scrivi_impostazioni(cartella, est_min, nord_max, punti_x, punti_y, tasselli_x, tasselli_y):
    # Valori da inserire in Unreal quando si importa il terreno (vedi GUIDA_UNREAL.md)
    x, y, z = utilita.da_lv95_a_unreal(est_min, nord_max, config.QUOTA_CENTRO_M)
    impostazioni = {
        "posizione_landscape_cm": {"X": x, "Y": y, "Z": z},
        "scala_landscape": {"X": round(config.PASSO_M * 100, 4),
                            "Y": round(config.PASSO_M * 100, 4),
                            "Z": config.SCALA_Z},
        "quad_per_sezione": 127,
        "sezioni_per_componente": "1x1",
        "punti_totali": {"X": punti_x, "Y": punti_y},
        "tasselli": {"X": tasselli_x, "Y": tasselli_y},
        "nota": "Z del mondo in cm = quota reale in metri x 100",
    }
    utilita.scrivi_json(impostazioni, cartella / "impostazioni_unreal.json")
    return impostazioni


def main():
    argomenti = utilita.leggi_argomenti("Crea le heightmap per Unreal")
    utilita.crea_cartelle()

    print("1) Leggo i tasselli scaricati...")
    indice = indice_swissalti3d()
    copernicus = file_copernicus()
    print("   swissALTI3D: " + str(len(indice)) + " file, Copernicus: " + str(len(copernicus)) + " file")
    if not indice:
        print("   Nessun tassello swissALTI3D: prima esegui il passo 1.")
        return

    if argomenti.pilota:
        area = utilita.area_di_lavoro(True)
        nome = utilita.nome_area(True)
        cartella = config.CARTELLA_UNREAL / nome
        punti_x = (area[1] - area[0]) // config.LATO_SETTORE_M * config.QUAD_PER_SETTORE + 1
        punti_y = (area[3] - area[2]) // config.LATO_SETTORE_M * config.QUAD_PER_SETTORE + 1
        print("2) Creo la heightmap (" + nome + ", " + str(punti_x) + " x " + str(punti_y) + ")...")
        quote, mancanti = crea_griglia(indice, copernicus, area[0], area[3], punti_x, punti_y)
        salva_png_16bit(quote, cartella / ("terreno_" + nome + ".png"))
        print("   Quota minima " + str(round(float(quote.min()), 1)) + " m, massima " + str(round(float(quote.max()), 1)) + " m")
        if mancanti:
            print("   ATTENZIONE: " + str(mancanti) + " punti senza dati")
        impostazioni = scrivi_impostazioni(cartella, area[0], area[3], punti_x, punti_y, 1, 1)
    else:
        area = utilita.area_di_lavoro(False)
        cartella = config.CARTELLA_UNREAL / "ticino" / "terreno"
        settori = utilita.elenco_settori(area)
        print("2) Creo " + str(len(settori)) + " heightmap da 2033 x 2033 (puo' durare a lungo)...")
        totale_mancanti = 0
        for numero, settore in enumerate(settori, start=1):
            nome = "terreno_x" + str(settore["x"]) + "_y" + str(settore["y"]) + ".png"
            percorso = cartella / nome
            if percorso.exists():
                continue
            quote, mancanti = crea_griglia(indice, copernicus, settore["est_min"], settore["nord_max"],
                                           config.PUNTI_PER_SETTORE)
            salva_png_16bit(quote, percorso)
            totale_mancanti = totale_mancanti + mancanti
            print("   " + str(numero) + "/" + str(len(settori)) + " " + settore["nome"] + " -> " + nome)
        if totale_mancanti:
            print("   ATTENZIONE: " + str(totale_mancanti) + " punti senza dati in totale")
        colonne = (area[1] - area[0]) // config.LATO_SETTORE_M
        righe = (area[3] - area[2]) // config.LATO_SETTORE_M
        impostazioni = scrivi_impostazioni(cartella, area[0], area[3],
                                           colonne * config.QUAD_PER_SETTORE + 1,
                                           righe * config.QUAD_PER_SETTORE + 1, colonne, righe)

    print("3) Impostazioni per Unreal (salvate anche in impostazioni_unreal.json):")
    print("   Posizione: " + str(impostazioni["posizione_landscape_cm"]))
    print("   Scala:     " + str(impostazioni["scala_landscape"]))
    print("Fatto. File in: " + str(cartella))


if __name__ == "__main__":
    main()
