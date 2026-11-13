# VERIFICA INDIPENDENTE DI PONTI E GALLERIE (Ticino completo)
# Non usa riconcilia_opere.py ne' i controlli di verifica_cantone.py (solo la lettura dei pacchetti): rilegge i vertici di
# ponti e gallerie di tutte le regioni e controlla (1) ogni punto presente in piu' regioni (scarto massimo, quanti > 1 m, per tipo),
# (2) gallerie sopra il terreno e ponti sotto il terreno (soglia 0,5 m, terreno a 4 m: e' una misura, non un'idoneita'),
# (3) il profilo della galleria piu' lunga nell'area del San Gottardo.
# Uso:  python verifica_opere_indipendente.py <cartella con le regioni scompattate e cantone/>   (esce con 1 se uno scarto > 1 m)
import json, sys, math, collections
from pathlib import Path
import numpy as np
sys.path.insert(0, "/home/user/swissgass/tools/geo")
from verifica_cantone import Regione
base = Path(sys.argv[1])
elenco = json.load(open(base/"cantone"/"regioni.json"))["regioni"]
pts = {"b": collections.defaultdict(dict), "g": collections.defaultdict(dict)}   # tipo -> (E,N arrot. 1 m) -> {regione: y}
sopra = {"g": 0, "b": 0}; tot = {"g": 0, "b": 0}; sotto_b = 0; gallerie_sup = []
gott = []
ecc = {"g": [], "b": []}
for info in elenco:
    r = Regione(base/info["id"], info)
    for s in r.strade():
        for tipo in ("b", "g"):
            if not s.get(tipo): continue
            p = np.array(s["p"], dtype=float).reshape(-1, 3)
            E = r.cx + p[:, 0]; N = r.cy - p[:, 2]; Y = p[:, 1]
            ter = r.quota_metri(E, N)
            for e, n, y, t in zip(E, N, Y, ter):
                tot[tipo] += 1
                pts[tipo][(round(e), round(n))][r.id] = y
                if not math.isnan(t):
                    if tipo == "g": ecc["g"].append(y - t)
                    else: ecc["b"].append(t - y)
                    if tipo == "g" and y > t + 0.5: sopra["g"] += 1
                    if tipo == "b" and y < t - 0.5: sotto_b += 1
            if tipo == "g" and (len(p) > 5):
                L = float(np.sum(np.hypot(np.diff(E), np.diff(N))))
                if L > 1500 and 2680000 < E.min() and E.max() < 2692000 and N.max() > 1140000 and N.min() > 1140000:
                    gott.append((r.id, L, E, N, Y, ter))
    r.libera()
print("vertici gallerie:", tot["g"], " sopra il terreno (>0.5 m):", sopra["g"])
print("vertici ponti:", tot["b"], " sotto il terreno (<-0.5 m):", sotto_b)
for k, nome in (("g", "galleria sopra terreno"), ("b", "ponte sotto terreno")):
    a = np.array(ecc[k]); print(f"{nome}: max {a.max():.1f} m; > 0.5: {(a>0.5).sum()}; > 2: {(a>2).sum()}; > 5: {(a>5).sum()}; > 10: {(a>10).sum()}")
esito_ok = True
for tipo, nome in (("b", "ponti"), ("g", "gallerie")):
    comuni = 0; peggio = 0.0; fuori = 0; coppie = collections.Counter()
    for k, d in pts[tipo].items():
        if len(d) > 1:
            comuni += 1
            vals = list(d.values()); sc = max(vals) - min(vals); peggio = max(peggio, sc)
            if sc > 1.0:
                fuori += 1
    print(f"{nome}: punti presenti in piu' regioni: {comuni}; con scarto > 1 m: {fuori}; scarto massimo: {peggio:.3f} m")
    if fuori: esito_ok = False
# San Gottardo: il tratto piu' lungo
gott.sort(key=lambda x: -x[1])
print("\nCandidati San Gottardo (gallerie > 1,5 km nell'area di Airolo):", [(g[0], round(g[1])) for g in gott[:6]])
if gott:
    # tutti i pezzi collegati: prendo la galleria piu' lunga e traccio il profilo
    r_id, L, E, N, Y, ter = gott[0]
    d = np.concatenate([[0], np.cumsum(np.hypot(np.diff(E), np.diff(N)))])
    print(f"regione {r_id}, lunghezza {L:.0f} m, da E{E[0]:.0f} N{N[0]:.0f} (y {Y[0]:.1f}) a E{E[-1]:.0f} N{N[-1]:.0f} (y {Y[-1]:.1f})")
    for f in np.linspace(0, len(d) - 1, 9).astype(int):
        print(f"  {d[f]:7.0f} m  y={Y[f]:7.2f}  terreno={ter[f]:7.1f}  copertura={ter[f]-Y[f]:6.1f}")
    dy = np.diff(Y); print("  tratti in salita > 0.5 m:", int(np.sum(dy > 0.5)), "; salto massimo tra vertici consecutivi:", f"{np.max(np.abs(dy)):.2f} m")
    # copertura minima lontano dagli ingressi (>150 m)
    centro = (d > 150) & (d < d[-1] - 150)
    if centro.any(): print(f"  copertura minima a >150 m dagli ingressi: {np.nanmin(ter[centro]-Y[centro]):.1f} m")
print("\nESITO:", "OK (nessuno scarto > 1 m)" if esito_ok else "ATTENZIONE")
sys.exit(0 if esito_ok else 1)
