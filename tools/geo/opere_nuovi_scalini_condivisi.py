import json, sys, collections, numpy as np
from pathlib import Path
new=Path("/tmp/claude-0/rinnovo"); old=Path("/tmp/claude-0/orig_min")
elenco=json.load(open(new/"cantone"/"regioni.json"))["regioni"]
risultati=[]
for info in elenco:
    rid=info["id"]; so=json.load(open(old/rid/"strade.json"))["strade"]; sn=json.load(open(new/rid/"strade.json"))["strade"]
    c=json.load(open(new/rid/"terreno.json"))["centro_lv95"]
    m=collections.defaultdict(list)
    for k,(a,b) in enumerate(zip(so,sn)):
        pa=np.array(a["p"],float).reshape(-1,3); pb=np.array(b["p"],float).reshape(-1,3)
        tipo="g" if a.get("g") else ("b" if a.get("b") else "-")
        for i in range(len(pa)):
            m[(round(pa[i,0]*2),round(pa[i,2]*2))].append((k,tipo,a.get("n","") or a.get("t",""),pa[i,1],pb[i,1],pa[i,0],pa[i,2]))
    for key,v in m.items():
        if len(v)<2: continue
        if not any(abs(x[3]-x[4])>1e-6 for x in v): continue
        s0=max(x[3] for x in v)-min(x[3] for x in v); s1=max(x[4] for x in v)-min(x[4] for x in v)
        if s1>0.5 and s1>s0+0.3:
            risultati.append((rid,round(s0,2),round(s1,2),round(c[0]+v[0][5]),round(c[1]-v[0][6]),[(x[1],x[2][:22],round(x[3],1),round(x[4],1)) for x in v][:4]))
print("punti condivisi con NUOVO scalino > 0,5 m dopo la riconciliazione:",len(risultati))
print("  > 1 m:",sum(1 for r in risultati if r[2]>1),"; > 3 m:",sum(1 for r in risultati if r[2]>3),"; > 10 m:",sum(1 for r in risultati if r[2]>10))
# raggruppa per posizione (stessa opera) arrotondando a 50 m
gr=collections.defaultdict(list)
for r in risultati: gr[(r[0],r[3]//50,r[4]//50)].append(r)
print("gruppi (aree da 50 m):",len(gr))
for k,v in sorted(gr.items(),key=lambda kv:-max(x[2] for x in kv[1]))[:14]:
    x=max(v,key=lambda z:z[2]); print(" ",x[0],"LV95",x[3],x[4],"punti",len(v),"scalino prima",x[1],"-> dopo",x[2],x[5])
json.dump(risultati,open(sys.argv[1],"w"))
