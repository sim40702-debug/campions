# Controlla il file dei parchi e delle zone d'uso del suolo creato dal passo 7 (anteprima/dati/uso_suolo.json).
# Non serve nessuna libreria: solo Python.
#
# Uso (Mac):     python3 verifica_uso_suolo.py [cartella_dati]
# Uso (Windows): python verifica_uso_suolo.py [cartella_dati]
#
# Controlla: il file c'e' ed e' leggibile; ogni area ha tipo e contorno validi (almeno 3 punti, numeri finiti);
# tutte le aree stanno dentro l'area del terreno (terreno.json); le aree non sono tutte nello stesso punto;
# stampa quante aree ci sono per tipo e la superficie totale. Esce con errore se qualcosa non torna.

import json
import math
import sys
from pathlib import Path

TIPI = {"parco", "prato", "sport", "cimitero", "residenziale", "commerciale", "industriale"}


def area(anello):
    somma = 0.0
    n = len(anello) // 2
    for i in range(n):
        j = (i + 1) % n
        somma += anello[i * 2] * anello[j * 2 + 1] - anello[j * 2] * anello[i * 2 + 1]
    return abs(somma) / 2


def main():
    cartella = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent.parent / "anteprima" / "dati"
    percorso = cartella / "uso_suolo.json"
    if not percorso.exists():
        print("MANCA " + str(percorso) + ": esegui prima passo2_scarica_osm.py --pilota e passo7_esporta_anteprima.py")
        return 1
    dati = json.loads(percorso.read_text(encoding="utf-8"))
    info = json.loads((cartella / "terreno.json").read_text(encoding="utf-8"))
    meta_x = (info.get("lato_x_m") or info.get("lato_m")) / 2
    meta_z = (info.get("lato_z_m") or info.get("lato_m")) / 2
    errori = []
    per_tipo = {}
    superficie = {}
    centri = set()
    for i, a in enumerate(dati.get("aree", [])):
        if a.get("t") not in TIPI:
            errori.append("area " + str(i) + ": tipo sconosciuto " + str(a.get("t")))
            continue
        anelli = [a["o"]] + list(a.get("f", []))
        for k, anello in enumerate(anelli):
            if len(anello) < 6 or len(anello) % 2:
                errori.append("area " + str(i) + ": contorno non valido")
                break
            for v in anello:
                if not isinstance(v, (int, float)) or not math.isfinite(v):
                    errori.append("area " + str(i) + ": numero non valido")
                    break
        else:
            xs = a["o"][0::2]
            zs = a["o"][1::2]
            if min(xs) < -meta_x - 1 or max(xs) > meta_x + 1 or min(zs) < -meta_z - 1 or max(zs) > meta_z + 1:
                errori.append("area " + str(i) + " (" + a["t"] + "): fuori dall'area del terreno")
            per_tipo[a["t"]] = per_tipo.get(a["t"], 0) + 1
            superficie[a["t"]] = superficie.get(a["t"], 0) + area(a["o"]) - sum(area(f) for f in a.get("f", []))
            centri.add((round(sum(xs) / len(xs) / 50), round(sum(zs) / len(zs) / 50)))
    totale = sum(per_tipo.values())
    print("Aree: " + str(totale))
    for t in sorted(per_tipo):
        print("  " + t + ": " + str(per_tipo[t]) + " aree, " + str(round(superficie[t] / 10000, 1)) + " ettari")
    if totale == 0:
        errori.append("nessuna area: il file e' vuoto")
    elif len(centri) < max(1, totale // 4):
        errori.append("molte aree nello stesso punto: dati sospetti")
    if errori:
        print("PROBLEMI:")
        for e in errori[:20]:
            print("  - " + e)
        return 1
    print("OK: il file e' coerente con il terreno.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
