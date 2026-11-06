# Strade e ferrovie per l'anteprima (usato dal passo 7)
#
# 1) Profilo liscio: la quota della strada e' una media sui punti vicini,
#    ma agli incroci e alle estremita' resta "agganciata" al terreno vero:
#    cosi' due strade che si incontrano hanno la stessa quota (niente scalini).
# 2) Larghezza: nelle vie strette la strada non puo' entrare nelle case.
# 3) Terreno: sotto le strade il terreno viene scavato o riempito fino alla strada
#    (niente erba in mezzo all'asfalto), con un raccordo morbido ai lati.

import numpy as np
from shapely import STRtree
from shapely.geometry import LineString, Point
from shapely.ops import linemerge

PASSO_PUNTI_M = 4          # un punto ogni 4 m
FINESTRA_MEDIA = 6         # media su 6 punti prima e 6 dopo (circa 50 m in tutto)
SOTTO_STRADA_M = 0.15      # il terreno sta 15 cm sotto la strada
BANCHINA_M = 2.5          # terreno piatto oltre il bordo della strada
RACCORDO_M = 3.0           # poi raccordo morbido verso il terreno vero


class Griglia:
    # Una griglia di quote con il punto (0, 0) in (est_min, nord_max)
    def __init__(self, quote, est_min, nord_max, passo):
        self.quote = quote
        self.est_min = est_min
        self.nord_max = nord_max
        self.passo = passo

    def quota(self, est, nord):
        colonna = (est - self.est_min) / self.passo
        riga = (self.nord_max - nord) / self.passo
        colonna = min(max(colonna, 0), self.quote.shape[1] - 1.001)
        riga = min(max(riga, 0), self.quote.shape[0] - 1.001)
        c0 = int(colonna)
        r0 = int(riga)
        fx = colonna - c0
        fy = riga - r0
        q = self.quote
        sopra = q[r0, c0] * (1 - fx) + q[r0, c0 + 1] * fx
        sotto = q[r0 + 1, c0] * (1 - fx) + q[r0 + 1, c0 + 1] * fx
        return float(sopra * (1 - fy) + sotto * fy)


def pezzi_di_linea(geometria):
    if geometria.is_empty:
        return []
    if geometria.geom_type == "LineString":
        return [geometria]
    return [g for g in getattr(geometria, "geoms", []) if g.geom_type == "LineString"]


def raccogli_pezzi(elementi, zona, trasforma, filtro):
    # Way OSM -> pezzi (linea fitta ogni 4 m, tag, ponte, galleria, nodi di incrocio)
    # Prima conto quante way usano ogni nodo: un nodo usato da 2 o piu' way e' un incrocio
    uso = {}
    scelte = [e for e in elementi if e.get("type") == "way" and "geometry" in e and filtro(e.get("tags", {}))]
    for elemento in scelte:
        for nodo in elemento.get("nodes", []):
            uso[nodo] = uso.get(nodo, 0) + 1

    pezzi = []
    for elemento in scelte:
        tag = elemento.get("tags", {})
        punti = [trasforma(p["lon"], p["lat"]) for p in elemento["geometry"]]
        if len(punti) < 2:
            continue
        incroci = set()
        for nodo, punto in zip(elemento.get("nodes", []), punti):
            if uso.get(nodo, 0) >= 2:
                incroci.add((round(punto[0], 3), round(punto[1], 3)))
        for pezzo in pezzi_di_linea(LineString(punti).intersection(zona)):
            pezzi.append({
                "linea": pezzo.segmentize(PASSO_PUNTI_M),
                "tag": tag,
                "ponte": tag.get("bridge") not in (None, "no"),
                "galleria": tag.get("tunnel") not in (None, "no") or tag.get("covered") == "yes",
                "incroci": incroci,
            })
    return pezzi


def profilo_liscio(grezzo, ancore):
    # Media mobile, poi correzione lineare tra un'ancora e l'altra:
    # nelle ancore (estremita' e incroci) la quota torna uguale a quella vera
    n = len(grezzo)
    liscio = []
    for i in range(n):
        vicine = grezzo[max(0, i - FINESTRA_MEDIA): i + FINESTRA_MEDIA + 1]
        liscio.append(sum(vicine) / len(vicine))
    ancore = sorted(set([0, n - 1] + list(ancore)))
    correzione = [0.0] * n
    for k in range(len(ancore) - 1):
        a = ancore[k]
        b = ancore[k + 1]
        ca = grezzo[a] - liscio[a]
        cb = grezzo[b] - liscio[b]
        for i in range(a, b + 1):
            parte = (i - a) / (b - a) if b > a else 0
            correzione[i] = ca + (cb - ca) * parte
    return [liscio[i] + correzione[i] for i in range(n)]


def calcola_profili(pezzi, griglia, zona):
    # Ponti e gallerie: linea dritta tra i due VERI ingressi (pezzi uniti con linemerge).
    # Strade normali: profilo liscio agganciato agli incroci.
    def catene(chiave):
        linee = [p["linea"] for p in pezzi if p[chiave]]
        if not linee:
            return []
        risultato = []
        for linea in pezzi_di_linea(linemerge(linee)):
            inizio = linea.coords[0]
            fine = linea.coords[-1]
            q_inizio = griglia.quota(inizio[0], inizio[1])
            q_fine = griglia.quota(fine[0], fine[1])
            if zona.exterior.distance(Point(inizio)) < 1:
                q_inizio = q_fine
            if zona.exterior.distance(Point(fine)) < 1:
                q_fine = q_inizio
            risultato.append((linea, q_inizio, q_fine))
        return risultato

    tutte = {"ponte": catene("ponte"), "galleria": catene("galleria")}

    def quota_su_catena(lista, e, n):
        punto = Point(e, n)
        for linea, q_inizio, q_fine in lista:
            if linea.distance(punto) < 0.5:
                parte = linea.project(punto) / linea.length if linea.length else 0
                return q_inizio + (q_fine - q_inizio) * parte
        return None

    for pezzo in pezzi:
        coordinate = list(pezzo["linea"].coords)
        grezzo = [griglia.quota(e, n) for e, n in coordinate]
        if pezzo["ponte"] or pezzo["galleria"]:
            lista = tutte["ponte"] if pezzo["ponte"] else tutte["galleria"]
            profilo = []
            for (e, n), q_terreno in zip(coordinate, grezzo):
                q = quota_su_catena(lista, e, n)
                if q is None:
                    q = q_terreno
                q = min(q, q_terreno) if pezzo["galleria"] else max(q, q_terreno)
                profilo.append(q)
        else:
            ancore = [i for i, (e, n) in enumerate(coordinate)
                      if (round(e, 3), round(n, 3)) in pezzo["incroci"]]
            profilo = profilo_liscio(grezzo, ancore)
        pezzo["coordinate"] = coordinate
        pezzo["profilo"] = profilo


def limita_larghezze(pezzi, edifici, larghezza_di):
    # Per ogni punto: meta' larghezza <= distanza dalla casa piu' vicina - 0.4 m
    albero = STRtree(edifici) if edifici else None
    for pezzo in pezzi:
        piena = larghezza_di(pezzo["tag"])
        larghezze = []
        for e, n in pezzo["coordinate"]:
            meta = piena / 2
            if albero is not None and not pezzo["galleria"]:
                indice, distanza = albero.query_nearest(Point(e, n), return_distance=True, max_distance=piena)
                if len(distanza) > 0 and distanza[0] > 0:
                    meta = min(meta, max(1.5, float(distanza[0]) - 0.4))
            larghezze.append(round(meta * 2, 1))
        pezzo["larghezza"] = piena
        pezzo["larghezze"] = larghezze


def scava_terreno(ridotte, pezzi, est_min, nord_max, passo):
    # Modifica la griglia "ridotte" (circa 4 m) sotto le strade e le ferrovie
    righe, colonne = ridotte.shape
    originale = ridotte.copy()
    distanza_min = np.full(ridotte.shape, np.inf, dtype=np.float32)
    obiettivo = np.zeros(ridotte.shape, dtype=np.float32)
    meta_min = np.zeros(ridotte.shape, dtype=np.float32)

    for pezzo in pezzi:
        if pezzo["ponte"] or pezzo["galleria"]:
            continue
        coord = pezzo["coordinate"]
        prof = pezzo["profilo"]
        larg = pezzo["larghezze"]
        for i in range(len(coord) - 1):
            ae, an = coord[i]
            be, bn = coord[i + 1]
            meta = max(larg[i], larg[i + 1]) / 2
            raggio = meta + BANCHINA_M + RACCORDO_M
            c0 = max(int((min(ae, be) - raggio - est_min) / passo), 0)
            c1 = min(int((max(ae, be) + raggio - est_min) / passo) + 1, colonne - 1)
            r0 = max(int((nord_max - max(an, bn) - raggio) / passo), 0)
            r1 = min(int((nord_max - min(an, bn) + raggio) / passo) + 1, righe - 1)
            if c1 < c0 or r1 < r0:
                continue
            ee = est_min + np.arange(c0, c1 + 1) * passo
            nn = nord_max - np.arange(r0, r1 + 1) * passo
            E, N = np.meshgrid(ee, nn)
            dx = be - ae
            dn = bn - an
            lungo = dx * dx + dn * dn
            t = np.clip(((E - ae) * dx + (N - an) * dn) / lungo, 0, 1) if lungo > 0 else np.zeros_like(E)
            d = np.hypot(E - (ae + dx * t), N - (an + dn * t))
            y = prof[i] + (prof[i + 1] - prof[i]) * t - SOTTO_STRADA_M
            finestra = (slice(r0, r1 + 1), slice(c0, c1 + 1))
            migliore = (d < distanza_min[finestra]) & (d <= raggio)
            distanza_min[finestra] = np.where(migliore, d, distanza_min[finestra])
            obiettivo[finestra] = np.where(migliore, y, obiettivo[finestra])
            meta_min[finestra] = np.where(migliore, meta, meta_min[finestra])

    toccati = np.isfinite(distanza_min)
    nucleo = meta_min + BANCHINA_M
    peso = np.clip((distanza_min - nucleo) / RACCORDO_M, 0, 1)   # 0 = strada, 1 = terreno vero
    nuovo = obiettivo * (1 - peso) + originale * peso
    ridotte[toccati] = nuovo[toccati]
    return int(toccati.sum())
