# Ticino Motorcycle Simulator - scarica i dati del Locarnese nella cartella "Dati" del progetto
#
# Da lanciare DENTRO l'editor di Unreal: Tools -> Execute Python Script... -> questo file
#
# Prende dati-anteprima.zip dall'ultima release del repository su GitHub
# (gli stessi dati dell'anteprima: terreno swisstopo, strade OpenStreetMap, foto aeree SWISSIMAGE)
# e lo estrae in MotoRacingWorld/Dati. Il gioco legge da li' (AMRWTerreno).
#
# Se non funziona (rete, certificati): scarica dati-anteprima.zip a mano da
# https://github.com/sim40702-debug/campions/releases e scompattalo nella cartella Dati del progetto.

import io
import json
import os
import urllib.request
import zipfile

import unreal

RELEASE = "https://api.github.com/repos/sim40702-debug/campions/releases"
NOME_FILE = "dati-anteprima.zip"


def scrivi(testo):
    unreal.log("[MRW] " + testo)


def leggi(url):
    richiesta = urllib.request.Request(url, headers={"User-Agent": "MotoRacingWorld-editor"})
    with urllib.request.urlopen(richiesta, timeout=120) as risposta:
        return risposta.read()


def trova_indirizzo_zip():
    # Le release sono in ordine dalla piu' nuova: prendo la prima che ha lo zip dei dati
    for release in json.loads(leggi(RELEASE)):
        for allegato in release.get("assets", []):
            if allegato["name"] == NOME_FILE:
                scrivi("Release: " + release["name"])
                return allegato["browser_download_url"]
    return None


def scarica():
    progetto = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
    cartella = os.path.join(progetto, "Dati")

    with unreal.ScopedSlowTask(3, "Scarico i dati del Ticino...") as compito:
        compito.make_dialog(True)

        compito.enter_progress_frame(1, "Cerco l'ultima release su GitHub...")
        indirizzo = trova_indirizzo_zip()
        if indirizzo is None:
            scrivi("Nessuna release con " + NOME_FILE + " trovata")
            return

        compito.enter_progress_frame(1, "Scarico " + NOME_FILE + " (puo' volerci qualche minuto)...")
        dati = leggi(indirizzo)

        compito.enter_progress_frame(1, "Estraggo in " + cartella)
        os.makedirs(cartella, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(dati)) as archivio:
            archivio.extractall(cartella)

    if os.path.exists(os.path.join(cartella, "terreno.json")):
        scrivi("Dati pronti in " + cartella)
    else:
        scrivi("ATTENZIONE: terreno.json non trovato in " + cartella)


try:
    scarica()
except Exception as errore:
    scrivi("Errore: " + str(errore))
    scrivi("Scarica dati-anteprima.zip a mano da https://github.com/sim40702-debug/campions/releases "
           "e scompattalo nella cartella Dati del progetto.")
