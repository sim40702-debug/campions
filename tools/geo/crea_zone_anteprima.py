# Crea zone_anteprima.json: i contorni delle zone dell'anteprima (Locarnese, Valle Verzasca, Valle Maggia)
# e la parte da escludere (Leventina), calcolati dal terreno vero con gli spartiacque.
#
# Come funziona: si "allaga" il terreno partendo dai punti piu' bassi (lago, fiumi): ogni punto finisce
# nella zona del lago o del fiume in cui scende l'acqua che ci cade sopra.
#   - Valle Verzasca: tutto quello che scende nel Lago di Vogorno (sopra la diga);
#   - Valle Maggia: quello che scende nella Maggia a nord di Ponte Brolla (e i fianchi a ovest);
#   - Leventina: quello che scende nel Ticino a nord (Giornico) e i versanti verso est/nord: solo paesaggio;
#   - Locarnese: il resto (Lago Maggiore, Melezza, Piano di Magadino).
#
# Non fa parte dei passi automatici (le zone cambiano solo se cambia l'area): si lancia a mano dopo i passi 1-3
# e si salva zone_anteprima.json nella repository. Il passo 7 lo legge (vedi config.py).
#
# Uso:  python crea_zone_anteprima.py --anteprima

import heapq
import json

import numpy as np
from PIL import Image
from rasterio.features import rasterize, shapes
from rasterio.transform import Affine
from shapely.geometry import LineString, shape
from shapely.ops import unary_union

import config
import utilita
from passo7_esporta_anteprima import poligono_osm

Image.MAX_IMAGE_PIXELS = None
RIDUZIONE = 8            # un punto ogni 8 del terreno (circa 16 m): basta per gli spartiacque
SEMPLIFICA_M = 60        # contorni semplificati (gli spartiacque sono creste: nessuna strada)

LOCARNESE, VERZASCA, MAGGIA, LEVENTINA, BORDO = 1, 2, 3, 4, 9

# Punto dove scrivere il nome sulla mappa (LV95)
ETICHETTE = {
    "Locarnese": (2_707_000, 1_111_800),
    "Valle Verzasca": (2_706_200, 1_129_500),
    "Valle Maggia": (2_698_300, 1_123_200),
}


def main():
    utilita.leggi_argomenti("Zone dell'anteprima dagli spartiacque")
    area = utilita.area_di_lavoro(True)
    est_min, est_max, nord_min, nord_max = area
    nome = utilita.nome_area(True)
    quote = utilita.valori_16bit_in_quote(np.array(Image.open(
        config.CARTELLA_UNREAL / nome / ("terreno_" + nome + ".png"))))
    r = quote[::RIDUZIONE, ::RIDUZIONE].astype(np.float32)
    righe, colonne = r.shape
    passo = config.PASSO_M * RIDUZIONE
    trasf = Affine(passo, 0, est_min - passo / 2, 0, -passo, nord_max + passo / 2)
    nord = nord_max - np.arange(righe) * passo
    est = est_min + np.arange(colonne) * passo

    print("1) Laghi e fiumi da cui parte l'acqua...")
    semi = np.zeros((righe, colonne), np.uint8)
    forme = {LOCARNESE: [], VERZASCA: [], MAGGIA: [], LEVENTINA: []}
    for elemento in utilita.leggi_json(utilita.file_osm("acqua", True)).get("elements", []):
        tag = elemento.get("tags", {})
        if tag.get("name") == "Lago di Vogorno":
            forme[VERZASCA].append(poligono_osm(elemento))
        elif tag.get("name") == "Lago Maggiore":
            forme[LOCARNESE].append(poligono_osm(elemento))
        elif tag.get("waterway") == "river" and tag.get("name") in ("Maggia", "Ticino") and elemento.get("type") == "way":
            linea = LineString([utilita.DA_WGS84_A_LV95.transform(p["lon"], p["lat"]) for p in elemento["geometry"]])
            forme[MAGGIA if tag["name"] == "Maggia" else LEVENTINA].append(linea.buffer(25))
    for etichetta, lista in forme.items():
        lista = [f for f in lista if f is not None and not f.is_empty]
        if not lista:
            raise SystemExit("Manca " + str(etichetta) + " nei dati dell'acqua: esegui prima il passo 2")
        maschera = rasterize([(f, 1) for f in lista], out_shape=r.shape, transform=trasf, fill=0, dtype="uint8")
        semi[(maschera == 1) & (semi == 0)] = etichetta
    # La Maggia sotto Ponte Brolla e il Ticino del Piano di Magadino sono Locarnese
    semi[(semi == MAGGIA) & (nord[:, None] < 1_117_600)] = LOCARNESE
    semi[(semi == LEVENTINA) & (nord[:, None] < 1_130_000)] = LOCARNESE

    print("2) Spartiacque (allagamento dal punto piu' basso)...")
    zone = np.zeros(r.shape, np.uint8)
    fatto = np.zeros(r.shape, bool)
    coda = [(float(r[y, x]), int(y), int(x), int(semi[y, x])) for y, x in zip(*np.nonzero(semi))]
    for y in range(righe):
        for x in range(colonne):
            if (y in (0, righe - 1) or x in (0, colonne - 1)) and not semi[y, x]:
                coda.append((float(r[y, x]), y, x, BORDO))   # acqua che esce dal rettangolo
    heapq.heapify(coda)
    while coda:
        z, y, x, etichetta = heapq.heappop(coda)
        if fatto[y, x]:
            continue
        fatto[y, x] = True
        zone[y, x] = etichetta
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                yy, xx = y + dy, x + dx
                if 0 <= yy < righe and 0 <= xx < colonne and not fatto[yy, xx]:
                    heapq.heappush(coda, (max(z, float(r[yy, xx])), yy, xx, etichetta))

    # L'acqua che esce dal rettangolo: a ovest e' Valle Maggia (Lavizzara, Val di Lodano),
    # a nord e a est (verso Leventina e Riviera) e' paesaggio da escludere; vicino al lago resta Locarnese.
    bordo = zone == BORDO
    ovest = est[None, :] < 2_702_000
    in_alto = nord[:, None] > 1_125_000
    zone[bordo & ovest & in_alto] = MAGGIA
    zone[bordo & ~ovest & in_alto] = LEVENTINA
    zone[bordo] = np.where(zone[bordo] == BORDO, LOCARNESE, zone[bordo])

    print("3) Contorni...")
    def contorni(etichetta, tutti=False):
        # tutti=False: solo il pezzo piu' grande (una zona); tutti=True: tutti i pezzi sopra 0.2 km2
        parti = [shape(g) for g, v in shapes(zone, mask=zone == etichetta, transform=trasf) if v == etichetta]
        forma = unary_union(parti).buffer(passo).buffer(-passo)   # chiude i buchi di un punto
        pezzi = list(forma.geoms) if forma.geom_type == "MultiPolygon" else [forma]
        pezzi = sorted(pezzi, key=lambda g: -g.area)
        pezzi = [g for g in pezzi if g.area > 200_000] if tutti else pezzi[:1]
        risultato = []
        for g in pezzi:
            g = g.simplify(SEMPLIFICA_M)
            print("   " + str(etichetta) + ": " + str(round(g.area / 1_000_000, 1)) + " km2, "
                  + str(len(g.exterior.coords)) + " punti")
            risultato.append([[round(e), round(n)] for e, n in list(g.exterior.coords)[:-1]])
        return risultato

    def contorno(etichetta):
        return contorni(etichetta)[0]

    risultato = {
        "nota": "Creato da crea_zone_anteprima.py (spartiacque dal terreno swissALTI3D). Coordinate LV95.",
        "area": [est_min, est_max, nord_min, nord_max],
        "zone": [
            {"nome": "Valle Verzasca", "contorno": contorno(VERZASCA), "etichetta": ETICHETTE["Valle Verzasca"]},
            {"nome": "Valle Maggia", "contorno": contorno(MAGGIA), "etichetta": ETICHETTE["Valle Maggia"]},
            {"nome": "Locarnese", "contorno": contorno(LOCARNESE), "etichetta": ETICHETTE["Locarnese"]},
        ],
        "esclusi": [{"nome": "Leventina", "contorno": c} for c in contorni(LEVENTINA, True)],
    }
    percorso = config.CARTELLA_SCRIPT / "zone_anteprima.json"
    with open(percorso, "w", encoding="utf-8") as file:
        json.dump(risultato, file, ensure_ascii=False, separators=(",", ":"))
    print("Fatto: " + str(percorso))


if __name__ == "__main__":
    main()
