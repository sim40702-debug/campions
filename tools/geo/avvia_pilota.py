# Lancia TUTTI i passi (1-6) per il settore pilota, uno dopo l'altro.
# Se un passo da' errore si ferma.
# Tutto quello che appare sullo schermo viene salvato anche in:
#   dati/registro_pilota.txt   <- questo file va mandato a Claude
#
# Uso (Mac):     python3 avvia_pilota.py
# Uso (Windows): python avvia_pilota.py

import subprocess
import sys
from datetime import datetime

import config

PASSI = [
    "passo1_scarica_altimetria.py",
    "passo2_scarica_osm.py",
    "passo3_crea_terreno.py",
    "passo4_crea_confini.py",
    "passo5_misura_strade.py",
    "passo6_verifica_terreno.py",
]


def main():
    config.CARTELLA_DATI.mkdir(parents=True, exist_ok=True)
    registro = config.CARTELLA_DATI / "registro_pilota.txt"

    with open(registro, "w", encoding="utf-8") as file:
        file.write("Registro settore pilota - " + datetime.now().strftime("%Y-%m-%d %H:%M") + "\n")
        file.write("Python " + sys.version.split()[0] + " su " + sys.platform + "\n\n")

        for passo in PASSI:
            titolo = "===== " + passo + " ====="
            print(titolo)
            file.write(titolo + "\n")
            file.flush()

            # sys.executable = lo stesso Python che sta eseguendo questo file (Mac e Windows)
            processo = subprocess.Popen(
                [sys.executable, "-u", str(config.CARTELLA_SCRIPT / passo), "--pilota"],
                cwd=config.CARTELLA_SCRIPT,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace",
            )
            for riga in processo.stdout:
                print(riga, end="")
                file.write(riga)
            processo.wait()

            if processo.returncode != 0:
                messaggio = "\nERRORE nel " + passo + ". Mi fermo qui.\n"
                print(messaggio)
                file.write(messaggio)
                break
        else:
            print("\nTutti i passi sono finiti.")
            file.write("\nTutti i passi sono finiti.\n")

    print("Registro salvato in: " + str(registro))
    print("Manda questo file a Claude.")


if __name__ == "__main__":
    main()
