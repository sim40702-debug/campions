import json, sys, numpy as np
sys.path.insert(0,"/home/user/swissgass/tools/geo")
from pathlib import Path
from verifica_cantone import Regione
rid=sys.argv[1]; E0=float(sys.argv[2]); N0=float(sys.argv[3]); R=float(sys.argv[4])
new=Path("/tmp/claude-0/rinnovo"); old=Path("/tmp/claude-0/orig_min")
info=[i for i in json.load(open(new/"cantone"/"regioni.json"))["regioni"] if i["id"]==rid][0]
rn=Regione(new/rid,info); so=json.load(open(old/rid/"strade.json"))["strade"]; sn=rn.strade()
for k,(a,b) in enumerate(zip(so,sn)):
    pa=np.array(a["p"],float).reshape(-1,3); pb=np.array(b["p"],float).reshape(-1,3)
    E=rn.cx+pb[:,0]; N=rn.cy-pb[:,2]
    if np.min(np.hypot(E-E0,N-N0))>R: continue
    tipo="g" if a.get("g") else ("b" if a.get("b") else "-")
    ter=rn.quota_metri(E,N)
    d=np.concatenate([[0],np.cumsum(np.hypot(np.diff(E),np.diff(N)))])
    ch=np.abs(pa[:,1]-pb[:,1])>1e-6
    print(f"[{k}] {tipo} {a.get('t','')} {a.get('n','')[:25]!r} pt={len(pa)} L={d[-1]:.0f} m  cambiati={int(ch.sum())}")
    if tipo!="-" and len(pa)<=40:
        for i in range(len(pa)):
            print(f"     {i:2d} d={d[i]:6.1f} E{E[i]:.0f} N{N[i]:.0f}  y prima {pa[i,1]:6.1f} dopo {pb[i,1]:6.1f}  terreno {ter[i]:6.1f}")
