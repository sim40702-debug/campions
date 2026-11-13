import json, sys, numpy as np
sys.path.insert(0,"/home/user/swissgass/tools/geo")
from pathlib import Path
from verifica_cantone import Regione
new=Path("/tmp/claude-0/rinnovo"); old=Path("/tmp/claude-0/orig_min")
rows=[]
for info in json.load(open(new/"cantone"/"regioni.json"))["regioni"]:
    rid=info["id"]; rn=Regione(new/rid,info); so=json.load(open(old/rid/"strade.json"))["strade"]; sn=rn.strade()
    for k,(a,b) in enumerate(zip(so,sn)):
        if not (a.get("g") or a.get("b")): continue
        pa=np.array(a["p"],float).reshape(-1,3); pb=np.array(b["p"],float).reshape(-1,3)
        dy=pb[:,1]-pa[:,1]
        if np.abs(dy).max()<3: continue
        E=rn.cx+pb[:,0]; N=rn.cy-pb[:,2]; ter=rn.quota_metri(E,N)
        L=float(np.sum(np.hypot(np.diff(E),np.diff(N))))
        m=len(pa)//2
        rows.append(dict(r=rid,k=k,t="g" if a.get("g") else "b",tipo=a.get("t",""),n=(a.get("n","") or "")[:24],L=round(L),pt=len(pa),mx=round(float(np.abs(dy).max()),1),
            a0=(round(pa[0,1],1),round(pb[0,1],1),round(float(ter[0]),1)),am=(round(pa[m,1],1),round(pb[m,1],1),round(float(ter[m]),1)),a1=(round(pa[-1,1],1),round(pb[-1,1],1),round(float(ter[-1]),1)),E=round(float(E[m])),N=round(float(N[m]))))
    rn.libera()
rows.sort(key=lambda x:(x["E"]//200,x["N"]//200))
print(len(rows),"opere con cambio massimo > 3 m (prima, dopo, terreno) per capo/meta'/capo")
for x in rows: print(x["r"],x["t"],x["tipo"][:12],repr(x["n"]),"L",x["L"],"max",x["mx"],"| capo0",x["a0"],"| meta'",x["am"],"| capo1",x["a1"],"| LV95",x["E"],x["N"])
json.dump(rows,open(sys.argv[1],"w"))
