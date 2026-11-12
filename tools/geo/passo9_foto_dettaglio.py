# PASSO 9 - Foto aeree di DETTAGLIO (0.5 m/pixel) solo vicino alle strade
#
# La foto del passo 8 e' a 2 m/pixel: da vicino alla moto e' sfocata. Qui si crea un secondo livello di dettaglio:
# tasselli da 500 m (immagine da 1024 x 1024 pixel che copre 512 m, con 6 m di margine per lato per non avere
# righe visibili tra un tassello e l'altro), a 0.5 m/pixel, presi dalle SWISSIMAGE 10 cm di swisstopo.
# I tasselli si fanno SOLO dove c'e' una strada entro 220 m: boschi e montagne restano a 2 m (le foto servono
# solo vicino al giocatore, e cosi' i file e la memoria restano piccoli).
# I file SWISSIMAGE 10 cm sono "cloud optimized": si leggono a finestre (qualche MB per tassello), senza scaricarli interi.
#
# Uso:
#   python passo9_foto_dettaglio.py --anteprima     (dopo i passi 7 e 8)
# Scrive in anteprima/dati/foto_hd/ i file hd_<colonna>_<riga>.jpg e indice.json.
# Il gioco (src/terreno_hd.js) carica i 4 tasselli attorno al giocatore e li sfuma con la foto a 2 m.
#
# Fonte: Ufficio federale di topografia swisstopo (Open Government Data), SWISSIMAGE 10 cm

import json
import math
import os

import numpy as np
import rasterio
import requests
from PIL import Image
from rasterio.merge import merge

import config
import utilita

CARTELLA_DATI_GIOCO = config.CARTELLA_SCRIPT.parent.parent / "anteprima" / "dati"
CARTELLA_HD = CARTELLA_DATI_GIOCO / "foto_hd"
STAC = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissimage-dop10/items"

LATO_M = 500            # lato di un tassello (metri)
MARGINE_M = 6           # margine per lato (metri)
RISOLUZIONE_M = 0.5     # metri per pixel
DISTANZA_STRADA_M = 220  # si fa il tassello se c'e' una strada entro questa distanza dal suo bordo

# lettura a finestre di file remoti (cloud optimized GeoTIFF)
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")
for nome in ("CURL_CA_BUNDLE", "REQUESTS_CA_BUNDLE"):
    if nome in os.environ:
        os.environ.setdefault("GDAL_HTTP_CAINFO", os.environ[nome])


def cerca_tasselli(area):
    # tasselli SWISSIMAGE 10 cm che toccano l'area (un anno solo per tassello: il piu' recente)
    margine = 600
    lon_min, lat_min, lon_max, lat_max = utilita.area_in_wgs84((area[0] - margine, area[1] + margine, area[2] - margine, area[3] + margine))
    url = STAC
    parametri = {"bbox": ",".join(str(v) for v in (lon_min, lat_min, lon_max, lat_max)), "limit": 100}
    migliori = {}
    while url:
        r = requests.get(url, params=parametri, timeout=120, headers={"User-Agent": config.NOME_PROGRAMMA})
        r.raise_for_status()
        dati = r.json()
        for f in dati.get("features", []):
            sigla = f["id"].split("_")[-1]
            anno = int(f["id"].split("_")[1])
            href = None
            for nome, risorsa in f.get("assets", {}).items():
                if "_0.1_" in nome:
                    href = risorsa["href"]
            if href and (sigla not in migliori or anno > migliori[sigla][0]):
                migliori[sigla] = (anno, href)
        url = None
        parametri = None
        for l in dati.get("links", []):
            if l.get("rel") == "next":
                url = l["href"]
    return migliori


def strade_locali():
    percorso = CARTELLA_DATI_GIOCO / "strade.json"
    return json.loads(percorso.read_text(encoding="utf-8"))["strade"]


def main():
    argomenti = utilita.leggi_argomenti("Foto aeree di dettaglio per l'anteprima")
    if not argomenti.pilota:
        argomenti.pilota = True
    area = utilita.area_di_lavoro(True)
    est_min, est_max, nord_min, nord_max = area
    centro_est = (est_min + est_max) / 2
    centro_nord = (nord_min + nord_max) / 2
    meta_x = (est_max - est_min) / 2
    meta_z = (nord_max - nord_min) / 2

    print("1) Strade del gioco (per sapere dove servono i tasselli)...")
    colonne = int(math.ceil((est_max - est_min) / LATO_M))
    righe = int(math.ceil((nord_max - nord_min) / LATO_M))
    serve = np.zeros((righe, colonne), dtype=bool)
    raggio = int(math.ceil(DISTANZA_STRADA_M / LATO_M))
    for s in strade_locali():
        if s.get("g"):
            continue
        p = s["p"]
        for i in range(0, len(p), 3):
            c = int((p[i] + meta_x) // LATO_M)
            r = int((p[i + 2] + meta_z) // LATO_M)
            if 0 <= c < colonne and 0 <= r < righe:
                # segna questo tassello e quelli vicini se la strada e' entro DISTANZA_STRADA_M dal loro bordo
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        cc, rr = c + dc, r + dr
                        if 0 <= cc < colonne and 0 <= rr < righe:
                            x0, z0 = cc * LATO_M - meta_x, rr * LATO_M - meta_z
                            dx = max(x0 - p[i], 0, p[i] - (x0 + LATO_M))
                            dz = max(z0 - p[i + 2], 0, p[i + 2] - (z0 + LATO_M))
                            if math.hypot(dx, dz) <= DISTANZA_STRADA_M:
                                serve[rr, cc] = True
    print("   tasselli da fare: " + str(int(serve.sum())) + " di " + str(colonne * righe))

    print("2) Cerco le SWISSIMAGE 10 cm...")
    tasselli = cerca_tasselli(area)
    print("   trovati " + str(len(tasselli)) + " tasselli da 1 km")
    aperti = {}

    def apri(sigla):
        if sigla not in aperti:
            aperti[sigla] = rasterio.open("/vsicurl/" + tasselli[sigla][1])
        return aperti[sigla]

    CARTELLA_HD.mkdir(parents=True, exist_ok=True)
    indice = []
    pixel = int(round((LATO_M + 2 * MARGINE_M) / RISOLUZIONE_M))
    fatti = 0
    for r in range(righe):
        for c in range(colonne):
            if not serve[r, c]:
                continue
            # rettangolo del tassello in LV95 (nord_max in alto: la riga 0 e' a NORD in coordinate di gioco z crescente = sud)
            x_min = c * LATO_M - meta_x - MARGINE_M
            z_min = r * LATO_M - meta_z - MARGINE_M
            e0 = centro_est + x_min
            e1 = e0 + LATO_M + 2 * MARGINE_M
            n_alto = centro_nord - z_min          # z cresce verso sud
            n_basso = n_alto - (LATO_M + 2 * MARGINE_M)
            # sigle dei tasselli da 1 km che toccano il rettangolo, es. "2704-1113"
            sigle = []
            for ee in range(int(e0 // 1000), int(e1 // 1000) + 1):
                for nn in range(int(n_basso // 1000), int(n_alto // 1000) + 1):
                    sigla = str(ee) + "-" + str(nn)
                    if sigla in tasselli:
                        sigle.append(sigla)
            if not sigle:
                continue
            try:
                sorgenti = [apri(s) for s in sigle]
                mosaico, _ = merge(sorgenti, bounds=(e0, n_basso, e1, n_alto), res=RISOLUZIONE_M)
            except Exception as errore:
                print("   tassello " + str(c) + "," + str(r) + " non letto: " + str(errore))
                continue
            immagine = np.transpose(mosaico[:3, :pixel, :pixel], (1, 2, 0)).astype(np.uint8)
            if immagine.shape[0] != pixel or immagine.shape[1] != pixel:
                grande = np.zeros((pixel, pixel, 3), dtype=np.uint8)
                grande[:immagine.shape[0], :immagine.shape[1]] = immagine
                immagine = grande
            Image.fromarray(immagine).save(CARTELLA_HD / ("hd_" + str(c) + "_" + str(r) + ".jpg"), quality=82)
            indice.append([c, r])
            fatti += 1
            if fatti % 10 == 0:
                print("   " + str(fatti) + " tasselli...")
    for f in aperti.values():
        f.close()
    utilita.scrivi_json({
        "lato_m": LATO_M, "margine_m": MARGINE_M, "pixel": pixel, "risoluzione_m": RISOLUZIONE_M,
        "meta_x": meta_x, "meta_z": meta_z, "colonne": colonne, "righe": righe, "tasselli": indice,
        "fonte": "Ufficio federale di topografia swisstopo, SWISSIMAGE 10 cm"
    }, CARTELLA_HD / "indice.json")
    print("Fatto: " + str(fatti) + " tasselli in " + str(CARTELLA_HD))


if __name__ == "__main__":
    main()
