# VERIFICA INDIPENDENTE DELLE QUOTE DEI PONTI CON swissSURFACE3D (swisstopo)
#
# Perche': la riconciliazione (riconcilia_opere.py) ha cambiato la quota di 10 170 vertici di ponti e gallerie. Per i ponti
# esiste una verita' indipendente: il modello di superficie swissSURFACE3D (raster 0,5 m, cloud-optimized, dati ufficiali
# swisstopo) contiene gli impalcati. Questo script confronta, per ogni rete di ponti con vertici cambiati, la quota prima
# (originali pubblicati il 12/11) e dopo (riconciliata) con la quota dell'impalcato misurata da swisstopo.
#
# Cosa misura: per ogni vertice la finestra 3x3 pixel (1,5 m) attorno al punto, MINIMO (esclude veicoli, alberi, lampioni).
# Un impalcato e' liscio: se il vertice e' sull'impalcato, il minimo e' l'impalcato. Se il vertice e' fuori dall'impalcato
# (strada piu' larga, errore di posizione OSM) il valore puo' essere il suolo sotto: per questo si guarda la MEDIANA su tutta
# la rete e la percentuale di vertici entro tolleranza, non il singolo vertice.
# Le gallerie NON hanno verita' in questo modello (la superficie e' il terreno sopra la galleria): qui non si misurano.
#
# Uso: python verifica_ponti_dsm.py <cartella originali> <cartella pubblicati/riconciliati> <uscita.json> [--tolleranza 2.0]
#   ognuna delle due cartelle contiene R_xxxx_yyyy/strade.json e terreno.json (come i pacchetti estratti), piu' <orig>/../cantone o
#   <orig>/cantone non necessario: servono solo strade.json e terreno.json.
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

STAC = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swisssurface3d-raster/items?bbox={w},{s},{e},{n}&limit=100"


def lv95_a_wgs84(e, n):
    # approssimazione swisstopo (precisione ~1 m): basta per cercare le tessere
    y = (e - 2600000) / 1e6
    x = (n - 1200000) / 1e6
    lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y ** 3
    lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x ** 3
    return lon * 100 / 36, lat * 100 / 36


class Dsm:
    def __init__(self):
        self.tessere = {}   # (km_e, km_n) -> dataset o None

    def _apri(self, ke, kn):
        if (ke, kn) in self.tessere:
            return self.tessere[(ke, kn)]
        lon, lat = lv95_a_wgs84(ke * 1000 + 500, kn * 1000 + 500)
        d = 0.002
        url = STAC.format(w=lon - d, s=lat - d, e=lon + d, n=lat + d)
        ds = None
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                feat = json.load(r)["features"]
            trovati = [f for f in feat if f["id"].split("_")[-1] == str(ke) + "-" + str(kn)]
            trovati.sort(key=lambda f: f["properties"]["datetime"], reverse=True)
            for f in trovati:
                for a in f["assets"].values():
                    if a["href"].endswith("_0.5_2056_5728.tif"):
                        ds = rasterio.open("/vsicurl/" + a["href"])
                        break
                if ds:
                    break
        except Exception as ex:  # tessera non disponibile: i vertici li' restano senza misura
            print("tessera " + str(ke) + "-" + str(kn) + " non disponibile: " + str(ex))
        self.tessere[(ke, kn)] = ds
        return ds

    def minimo3(self, e, n):
        ke, kn = int(e // 1000), int(n // 1000)
        ds = self._apri(ke, kn)
        if ds is None:
            return None
        col = int((e - ds.bounds.left) / 0.5)
        riga = int((ds.bounds.top - n) / 0.5)
        if col < 1 or riga < 1 or col > ds.width - 2 or riga > ds.height - 2:
            return None     # bordo tessera: si salta (pochi vertici)
        w = ds.read(1, window=Window(col - 1, riga - 1, 3, 3))
        w = w[w > -1000]
        return float(w.min()) if w.size else None


def carica(cartella):
    out = {}
    for d in sorted(p for p in Path(cartella).glob("R_*") if p.is_dir()):
        t = json.load(open(d / "terreno.json"))
        s = json.load(open(d / "strade.json"))["strade"]
        out[d.name] = (t["centro_lv95"], s)
    return out


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
    tol = float(sys.argv[sys.argv.index("--tolleranza") + 1]) if "--tolleranza" in sys.argv else 2.0
    prima = carica(sys.argv[1])
    dopo = carica(sys.argv[2])
    uf = Uf()
    vert = {}           # chiave (est, nord interi) -> dict(prima=[], dopo=[])
    cambiati = set()
    for rid, (c, strade_d) in dopo.items():
        cx, cy = c
        strade_p = prima[rid][1]
        assert len(strade_p) == len(strade_d)
        for sp, sd in zip(strade_p, strade_d):
            if not sd.get("b"):
                continue
            pd_, pp = sd["p"], sp["p"]
            assert len(pd_) == len(pp)
            chiavi = []
            for i in range(0, len(pd_), 3):
                e, n = cx + pd_[i], cy - pd_[i + 2]
                k = (int(round(e)), int(round(n)))
                v = vert.setdefault(k, {"prima": [], "dopo": [], "e": e, "n": n})
                v["prima"].append(pp[i + 1])
                v["dopo"].append(pd_[i + 1])
                chiavi.append(k)
                if abs(pd_[i + 1] - pp[i + 1]) > 1e-6:
                    cambiati.add(k)
            for a, b in zip(chiavi, chiavi[1:]):
                uf.unisci(a, b)
    comp = {}
    for k in vert:
        comp.setdefault(uf.trova(k), []).append(k)
    reti = [ks for ks in comp.values() if any(k in cambiati for k in ks)]
    print("Reti di ponti con vertici cambiati: " + str(len(reti)) + " (vertici totali " + str(sum(len(r) for r in reti)) + ")")
    dsm = Dsm()
    esito = []
    for ks in sorted(reti, key=lambda r: -len(r)):
        dp, dd, dt, ne = [], [], [], 0
        pos = []
        for k in ks:
            v = vert[k]
            m = dsm.minimo3(v["e"], v["n"])
            if m is None:
                continue
            ne += 1
            yp, yd = float(np.mean(v["prima"])), float(np.mean(v["dopo"]))
            dp.append(yp - 0.2 - m)
            dd.append(yd - 0.2 - m)
            pos.append((v["e"], v["n"]))
        if not dp:
            cx_ = np.mean([vert[k]["e"] for k in ks]); cy_ = np.mean([vert[k]["n"] for k in ks])
            print(str(round(cx_)) + "/" + str(round(cy_)) + " v=" + str(len(ks)) + " NESSUNA MISURA (tessera mancante o bordo)", flush=True)
            esito.append({"est": round(float(cx_)), "nord": round(float(cy_)), "vertici": len(ks), "misurati": 0})
            continue
        dp, dd = np.array(dp), np.array(dd)
        cambio = max(abs(np.mean(vert[k]["dopo"]) - np.mean(vert[k]["prima"])) for k in ks)
        esito.append({
            "est": round(float(np.mean([p[0] for p in pos]))), "nord": round(float(np.mean([p[1] for p in pos]))),
            "vertici": len(ks), "misurati": ne, "cambio_max_m": round(float(cambio), 1),
            "prima_mediana_m": round(float(np.median(dp)), 2), "prima_p10_p90": [round(float(np.percentile(dp, 10)), 1), round(float(np.percentile(dp, 90)), 1)],
            "prima_entro_tol": round(float(np.mean(np.abs(dp) <= tol)), 3),
            "dopo_mediana_m": round(float(np.median(dd)), 2), "dopo_p10_p90": [round(float(np.percentile(dd, 10)), 1), round(float(np.percentile(dd, 90)), 1)],
            "dopo_entro_tol": round(float(np.mean(np.abs(dd) <= tol)), 3),
        })
        e = esito[-1]
        print(str(e["est"]) + "/" + str(e["nord"]) + " v=" + str(e["vertici"]) + " misurati=" + str(e["misurati"]) + " cambio_max=" + str(e["cambio_max_m"]) +
              " | PRIMA med " + str(e["prima_mediana_m"]) + " entro" + str(tol) + "m " + str(round(e["prima_entro_tol"] * 100)) + "% | DOPO med " + str(e["dopo_mediana_m"]) +
              " entro " + str(round(e["dopo_entro_tol"] * 100)) + "%", flush=True)
    Path(sys.argv[3]).write_text(json.dumps({"tolleranza_m": tol, "reti": esito}, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
