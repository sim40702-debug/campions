import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, "/home/user/swissgass/tools/geo")
from verifica_cantone import Regione
new = Path("/tmp/claude-0/rinnovo"); old = Path("/tmp/claude-0/orig_min")
elenco = json.load(open(new/"cantone"/"regioni.json"))["regioni"]
tot = dict(cambiati=0, fuori_prima=0, fuori_dopo=0, migliorati=0, peggiorati=0, uguali=0); peggio=[]
for info in elenco:
    rn = Regione(new/info["id"], info); ro = Regione(old/info["id"], info)
    sn, so = rn.strade(), ro.strade()
    for k,(a,b) in enumerate(zip(so, sn)):
        if not (a.get("g") or a.get("b")): continue
        pa = np.array(a["p"],float).reshape(-1,3); pb = np.array(b["p"],float).reshape(-1,3)
        ch = np.abs(pa[:,1]-pb[:,1])>1e-6
        if not ch.any(): continue
        E = rn.cx+pb[:,0]; N = rn.cy-pb[:,2]; ter = rn.quota_metri(E,N)
        sign = 1 if a.get("g") else -1
        ea = sign*(pa[:,1]-ter); eb = sign*(pb[:,1]-ter)
        for i in np.where(ch & ~np.isnan(ter))[0]:
            tot["cambiati"]+=1; fa = ea[i]>0.5; fb = eb[i]>0.5
            tot["fuori_prima"]+=fa; tot["fuori_dopo"]+=fb
            if eb[i]>ea[i]+0.5 and fb: tot["peggiorati"]+=1; peggio.append((info["id"], "g" if a.get("g") else "b", round(float(ea[i]),1), round(float(eb[i]),1)))
            elif eb[i]<ea[i]-0.5: tot["migliorati"]+=1
            else: tot["uguali"]+=1
    rn.libera(); ro.libera()
print(tot); print("peggiorati e fuori soglia dopo:", len(peggio)); print(sorted(peggio,key=lambda x:-x[3])[:10])
