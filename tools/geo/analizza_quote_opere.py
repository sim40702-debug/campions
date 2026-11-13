# Analisi dei vertici di opere (ponti/gallerie) fuori posto rispetto al terreno: per tratto, vicino agli ingressi o no, pendenza.
import json, sys, math, collections
from pathlib import Path
import numpy as np
sys.path.insert(0, "/home/user/swissgass/tools/geo")
from verifica_cantone import Regione
base = Path(sys.argv[1])
elenco = json.load(open(base/"cantone"/"regioni.json"))["regioni"]
casi = []
for info in elenco:
    r = Regione(base/info["id"], info)
    for k, s in enumerate(r.strade()):
        tipo = "g" if s.get("g") else ("b" if s.get("b") else None)
        if not tipo: continue
        p = np.array(s["p"], float).reshape(-1, 3)
        E = r.cx + p[:, 0]; N = r.cy - p[:, 2]; Y = p[:, 1]
        ter = r.quota_metri(E, N)
        d = np.concatenate([[0], np.cumsum(np.hypot(np.diff(E), np.diff(N)))])
        L = d[-1]
        # pendenza del terreno (4 m): differenza locale
        ex = (Y - ter) if tipo == "g" else (ter - Y)       # eccesso: galleria sopra / ponte sotto
        ok = ~np.isnan(ex)
        bad = ok & (ex > 0.5)
        if not bad.any(): continue
        dist_capo = np.minimum(d, L - d)
        pend = np.abs(np.gradient(ter, d, edge_order=1)) if len(d) > 2 else np.zeros_like(d)
        idx = np.where(bad)[0]
        casi.append(dict(regione=r.id, i=k, tipo=tipo, nome=s.get("n", ""), lung_m=round(L), vertici=len(p), fuori=int(bad.sum()),
            max_m=round(float(ex[bad].max()), 1), dist_capo_min_m=round(float(dist_capo[idx].min())), dist_capo_max_m=round(float(dist_capo[idx].max())),
            pend_terreno_max=round(float(np.nanmax(pend[idx])), 2), E=round(float(E[idx[np.argmax(ex[idx])]])), N=round(float(N[idx[np.argmax(ex[idx])]])),
            y=round(float(Y[idx[np.argmax(ex[idx])]]), 1), terreno=round(float(ter[idx[np.argmax(ex[idx])]]), 1),
            x_gioco=round(float(p[idx[np.argmax(ex[idx])], 0]), 1), z_gioco=round(float(p[idx[np.argmax(ex[idx])], 2]), 1)))
    r.libera()
json.dump(casi, open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
for tipo, nome in (("g", "GALLERIE sopra il terreno"), ("b", "PONTI sotto il terreno")):
    c = [x for x in casi if x["tipo"] == tipo]
    v = sum(x["fuori"] for x in c)
    print(f"\n{nome}: {len(c)} tratti, {v} vertici")
    cl = collections.Counter()
    for x in c:
        if x["max_m"] <= 2: cl["lieve (<= 2 m)"] += x["fuori"]
        elif x["max_m"] <= 5: cl["medio (2-5 m)"] += x["fuori"]
        else: cl["forte (> 5 m)"] += x["fuori"]
    print("  per gravita' del tratto (vertici):", dict(cl))
    capo = sum(x["fuori"] for x in c if x["dist_capo_max_m"] <= 100); print("  vertici in tratti che stanno interamente entro 100 m da un capo:", capo)
    for x in sorted(c, key=lambda z: -z["max_m"])[:8]: print("  ", x["regione"], x["nome"] or "-", f"L={x['lung_m']} m, fuori {x['fuori']}/{x['vertici']}, max {x['max_m']} m, dal capo {x['dist_capo_min_m']}-{x['dist_capo_max_m']} m, pend.terreno {x['pend_terreno_max']}, LV95 {x['E']},{x['N']}")
