# PASSO 6 - Verifica: il terreno per Unreal segue i dati di swisstopo?
#
# Prende punti a caso nelle heightmap create al passo 3 e confronta la quota
# con quella originale di swissALTI3D nello stesso punto.
# Obiettivo (stima Sprint 0): errore sotto 1 m nel 99 % dei punti.
#
# Uso:
#   python passo6_verifica_terreno.py --pilota
#   python passo6_verifica_terreno.py

import random

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window

import config
import utilita

PUNTI_DA_CONTROLLARE = 2000
LIMITE_ERRORE_M = 1.0


def quota_originale(indice, est, nord):
    # Quota swissALTI3D nel punto (interpolazione tra i 4 pixel vicini)
    for percorso, confini in indice:
        if confini.left <= est < confini.right and confini.bottom <= nord < confini.top:
            with rasterio.open(percorso) as file:
                colonna, riga = ~file.transform * (est, nord)
                colonna = colonna - 0.5
                riga = riga - 0.5
                c0 = int(np.floor(colonna))
                r0 = int(np.floor(riga))
                if c0 < 0 or r0 < 0 or c0 + 1 >= file.width or r0 + 1 >= file.height:
                    return None
                blocco = file.read(1, window=Window(c0, r0, 2, 2)).astype(np.float64)
                if file.nodata is not None and (blocco == file.nodata).any():
                    return None
                fx = colonna - c0
                fy = riga - r0
                sopra = blocco[0, 0] * (1 - fx) + blocco[0, 1] * fx
                sotto = blocco[1, 0] * (1 - fx) + blocco[1, 1] * fx
                return sopra * (1 - fy) + sotto * fy
    return None


def immagini_da_controllare(pilota):
    # Restituisce una lista di (percorso PNG, est_min, nord_max)
    if pilota:
        area = utilita.area_di_lavoro(True)
        percorso = config.CARTELLA_UNREAL / "pilota" / "terreno_pilota.png"
        return [(percorso, area[0], area[3])]
    cartella = config.CARTELLA_UNREAL / "ticino" / "terreno"
    lista = []
    for settore in utilita.elenco_settori(utilita.area_di_lavoro(False)):
        percorso = cartella / ("terreno_x" + str(settore["x"]) + "_y" + str(settore["y"]) + ".png")
        if percorso.exists():
            lista.append((percorso, settore["est_min"], settore["nord_max"]))
    return lista


def main():
    argomenti = utilita.leggi_argomenti("Verifica il terreno rispetto a swissALTI3D")
    cartella = config.CARTELLA_DOWNLOAD / "swissalti3d"
    indice = []
    for percorso in sorted(cartella.glob("*.tif")):
        with rasterio.open(percorso) as file:
            indice.append((percorso, file.bounds))
    immagini = immagini_da_controllare(argomenti.pilota)
    if not indice or not immagini:
        print("Mancano i dati: esegui prima i passi 1 e 3.")
        return

    random.seed(42)
    errori = []
    tentativi = 0
    while len(errori) < PUNTI_DA_CONTROLLARE and tentativi < PUNTI_DA_CONTROLLARE * 5:
        # Apro un'immagine a caso e controllo 50 punti (aprirla e' la parte lenta)
        percorso, est_min, nord_max = random.choice(immagini)
        valori = np.array(Image.open(percorso))
        for _ in range(50):
            tentativi = tentativi + 1
            riga = random.randrange(valori.shape[0])
            colonna = random.randrange(valori.shape[1])
            est = est_min + colonna * config.PASSO_M
            nord = nord_max - riga * config.PASSO_M
            originale = quota_originale(indice, est, nord)
            if originale is None:
                continue   # punto fuori dalla Svizzera: non c'e' swissALTI3D per confrontare
            nostra = utilita.valori_16bit_in_quote(valori[riga, colonna])
            errori.append(abs(float(nostra) - originale))

    if not errori:
        print("Nessun punto confrontabile.")
        return
    errori = np.array(errori)
    percento_ok = (errori < LIMITE_ERRORE_M).mean() * 100
    print("Punti controllati: " + str(len(errori)))
    print("Errore medio:      " + str(round(float(errori.mean()), 3)) + " m")
    print("Errore massimo:    " + str(round(float(errori.max()), 3)) + " m")
    print("Sotto " + str(LIMITE_ERRORE_M) + " m:       " + str(round(float(percento_ok), 2)) + " %")
    if percento_ok >= 99:
        print("RISULTATO: OK, il terreno segue i dati altimetrici.")
    else:
        print("RISULTATO: NON OK, controllare il passo 3.")


if __name__ == "__main__":
    main()
