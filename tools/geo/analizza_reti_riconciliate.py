# TABELLA PER RETE di ponti e gallerie cambiati dalla riconciliazione: prima (originali) e dopo (riconciliati).
#
# Una "rete" = vertici collegati da tratti consecutivi dello stesso tipo (ponte o galleria), in tutte le regioni (stessa unione
# usata da riconcilia_opere.py). Per ogni rete con vertici cambiati si misura:
#  - scarto tra le copie dello stesso vertice in regioni diverse (prima e dopo): e' il difetto di confine che la riconciliazione corregge;
#  - cambio massimo di quota;
#  - pendenza massima tra vertici consecutivi (|dy|/ds, vertici a piu' di 2 m): un valore fisicamente impossibile = rete rotta;
#  - rispetto al terreno (terreno.bin, vicino piu' vicino): gallerie sopra il terreno e ponti sotto il terreno di oltre 0,5 m;
#  - numero di rami (vertici con 3 o piu' vicini): rete ramificata si/no.
# Per i ponti la verita' indipendente (swissSURFACE3D) e' in verifica_ponti_dsm.py: qui si prende il suo json con --dsm.
#
# Uso: python analizza_reti_riconciliate.py <orig> <dopo> <uscita.json> [--dsm dsm_ponti.json]
import json
import math
import sys
from pathlib import Path

import numpy as np


def carica(cartella):
    out = {}
    for d in sorted(p for p in Path(cartella).glob("R_*") if p.is_dir()):
        t = json.load(open(d / "terreno.json"))
        s = json.load(open(d / "strade.json"))["strade"]
        out[d.name] = (t, s, d)
    return out


class Terreno:
    def __init__(self, t, d):
        self.t = t
        self.cx, self.cy = t["centro_lv95"]
        self.v = np.memmap(d / "terreno.bin", dtype="<u2", mode="r", shape=(t["righe"], t["colonne"]))

    def quota(self, e, n):
        t = self.t
        i = int(round((e - (self.cx - t["lato_x_m"] / 2)) / t["passo_m"]))
        j = int(round(((self.cy + t["lato_z_m"] / 2) - n) / t["passo_m"]))
        if 0 <= i < t["colonne"] and 0 <= j < t["righe"]:
            return t["quota_base"] + float(self.v[j, i]) * t["scala_quota"]
        return None


class Uf:
    def __init__(self):
        self.p = {}

    def trova(self, a):
        self.p.setdefault(a, a)
        while self.p[a] != a:
            self.p[a] = self.p[self.p[a]]
            a = self.p[a]
        return a

    def unisci(self, a, b):
        self.p[self.trova(a)] = self.trova(b)


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    prima, dopo = carica(sys.argv[1]), carica(sys.argv[2])
    dsm = {}
    if "--dsm" in sys.argv:
        for r in json.load(open(sys.argv[sys.argv.index("--dsm") + 1]))["reti"]:
            dsm[(r["est"], r["nord"])] = r
    terreni = {rid: Terreno(t, d) for rid, (t, s, d) in dopo.items()}
    risultati = []
    for tipo, chiave in (("ponte", "b"), ("galleria", "g")):
        uf = Uf()
        vert = {}
        coppie = []        # (k1, k2, ds, id regione, idx pezzo) per pendenze
        vicini = {}
        for rid, (t, sd, _) in dopo.items():
            cx, cy = t["centro_lv95"]
            sp = prima[rid][1]
            for a, b in zip(sp, sd):
                if not b.get(chiave):
                    continue
                pb, pa = b["p"], a["p"]
                ks = []
                for i in range(0, len(pb), 3):
                    e, n = cx + pb[i], cy - pb[i + 2]
                    k = (int(round(e)), int(round(n)))
                    v = vert.setdefault(k, {"e": e, "n": n, "prima": {}, "dopo": {}})
                    v["prima"][rid] = pa[i + 1]
                    v["dopo"][rid] = pb[i + 1]
                    ks.append(k)
                for k1, k2 in zip(ks, ks[1:]):
                    if k1 != k2:
                        uf.unisci(k1, k2)
                        vicini.setdefault(k1, set()).add(k2)
                        vicini.setdefault(k2, set()).add(k1)
                        coppie.append((k1, k2))
        comp = {}
        for k in vert:
            comp.setdefault(uf.trova(k), []).append(k)
        for ks in comp.values():
            camb = [max(abs(x - y) for x in v["dopo"].values() for y in v["prima"].values()) for v in (vert[k] for k in ks)]
            if max(camb) < 1e-6:
                continue
            kset = set(ks)
            spread = lambda campo: max((max(vert[k][campo].values()) - min(vert[k][campo].values())) for k in ks)
            def pendenza(campo):
                m = 0.0
                for k1, k2 in coppie:
                    if k1 in kset:
                        ds = math.hypot(vert[k1]["e"] - vert[k2]["e"], vert[k1]["n"] - vert[k2]["n"])
                        if ds > 2:
                            y1 = np.mean(list(vert[k1][campo].values())); y2 = np.mean(list(vert[k2][campo].values()))
                            m = max(m, abs(y1 - y2) / ds)
                return m
            def fuori(campo):
                # galleria sopra il terreno (>0.5 m) o ponte sotto (>0.5 m): quanti vertici
                n_f = 0
                for k in ks:
                    v = vert[k]
                    rid = max(v[campo], key=lambda r: 0)  # una regione qualsiasi che lo contiene
                    for rid in v[campo]:
                        q = terreni[rid].quota(v["e"], v["n"])
                        if q is None:
                            continue
                        y = v[campo][rid] - 0.2
                        if (tipo == "galleria" and y - q > 0.5) or (tipo == "ponte" and q - y > 0.5):
                            n_f += 1
                        break
                return n_f
            rami = sum(1 for k in ks if len(vicini.get(k, ())) >= 3)
            cx_ = float(np.mean([vert[k]["e"] for k in ks])); cy_ = float(np.mean([vert[k]["n"] for k in ks]))
            lunghezza = 0.0
            for k1, k2 in coppie:
                if k1 in kset:
                    lunghezza += math.hypot(vert[k1]["e"] - vert[k2]["e"], vert[k1]["n"] - vert[k2]["n"])
            riga = {
                "tipo": tipo, "est": round(cx_), "nord": round(cy_), "vertici": len(ks), "lunghezza_m": round(lunghezza),
                "regioni": sorted({r for k in ks for r in vert[k]["prima"]}),
                "ramificata": rami > 0, "giunzioni": rami,
                "scarto_copie_prima_m": round(spread("prima"), 1), "scarto_copie_dopo_m": round(spread("dopo"), 1),
                "cambio_max_m": round(max(camb), 1),
                "pendenza_max_prima": round(pendenza("prima"), 3), "pendenza_max_dopo": round(pendenza("dopo"), 3),
                "fuori_terreno_prima": fuori("prima"), "fuori_terreno_dopo": fuori("dopo"),
            }
            if tipo == "ponte":
                for (e, n), r in dsm.items():
                    if abs(e - riga["est"]) <= 3 and abs(n - riga["nord"]) <= 3:
                        riga["dsm"] = {x: r.get(x) for x in ("misurati", "prima_mediana_m", "dopo_mediana_m", "prima_entro_tol", "dopo_entro_tol")}
            risultati.append(riga)
    risultati.sort(key=lambda r: (r["tipo"], -r["cambio_max_m"]))
    Path(sys.argv[3]).write_text(json.dumps(risultati, indent=1, ensure_ascii=False), encoding="utf-8")
    for r in risultati:
        d = r.get("dsm")
        print(r["tipo"][:3] + " " + str(r["est"]) + "/" + str(r["nord"]) + " v" + str(r["vertici"]) + " L" + str(r["lunghezza_m"]) + " " + ("RAMIF" if r["ramificata"] else "catena") +
              " regioni=" + str(len(r["regioni"])) + " scarto " + str(r["scarto_copie_prima_m"]) + "->" + str(r["scarto_copie_dopo_m"]) + " cambio " + str(r["cambio_max_m"]) +
              " pend " + str(r["pendenza_max_prima"]) + "->" + str(r["pendenza_max_dopo"]) + " fuori " + str(r["fuori_terreno_prima"]) + "->" + str(r["fuori_terreno_dopo"]) +
              (" DSM " + str(d["prima_mediana_m"]) + "->" + str(d["dopo_mediana_m"]) if d and d.get("misurati") else ""))


if __name__ == "__main__":
    main()
