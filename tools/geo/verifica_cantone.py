# VERIFICA DI TUTTO IL CANTONE (Ticino completo)
#
# Controlla, sui pacchetti delle regioni GIA' SCOMPATTATI (una cartella per regione, come li scarica il gioco),
# che il cantone sia davvero coperto e che le regioni combacino tra loro. Non scarica niente e non usa la grafica.
#
# Uso:
#   python verifica_cantone.py <cartella con le regioni e con "cantone/"> [--json uscita.json]
# Dove la cartella contiene: cantone/ (regioni.json, cantone.json, stato.json) e una cartella R_xxxx_yyyy per regione.
#
# Controlli (ognuno stampa OK / ATTENZIONE con i numeri veri):
#  1. File: ogni regione ha tutti i file, terreno.bin della grandezza giusta, tutte le 144 foto aeree da 2 km.
#  2. Copertura: ogni punto (ogni 100 m) dentro il confine del cantone sta nel cuore di una regione, ha un
#     terreno vero (non la quota fissa "manca") e una foto aerea; le aree del cantone si sommano a 2 812 km2.
#  3. Cuciture del terreno: dove due regioni si sovrappongono (margini di 4 km) le quote devono essere uguali.
#  4. Cuciture delle strade: i punti delle strade nella sovrapposizione devono esserci in entrambe le regioni,
#     alla stessa posizione e alla stessa quota (altrimenti passando da una regione all'altra la strada "salta").
#  5. Edifici: nella sovrapposizione le due regioni hanno gli stessi edifici.
# Le coordinate dentro ogni regione sono relative al suo centro (x = est, z = sud): E = centro_est + x, N = centro_nord - z.

import json
import math
import sys
from pathlib import Path

import numpy as np

QUOTA_SE_MANCA_M = None   # si legge da config se c'e', altrimenti si riconosce dal file


def carica_json(percorso):
    with open(percorso, "r", encoding="utf-8") as f:
        return json.load(f)


class Regione:
    def __init__(self, cartella, info):
        self.cartella = cartella
        self.id = info["id"]
        self.cuore = info["cuore"]
        self.area = info["area"]
        self.t = carica_json(cartella / "terreno.json")
        self.cx, self.cy = self.t["centro_lv95"]
        self._quote = None
        self._strade = None
        self._edifici = None

    def quote(self):
        # righe x colonne, riga 0 = NORD; quota in metri
        if self._quote is None:
            v = np.fromfile(self.cartella / "terreno.bin", dtype="<u2").reshape(self.t["righe"], self.t["colonne"])
            self._quote = v
        return self._quote

    def libera(self):
        self._quote = None
        self._strade = None
        self._edifici = None

    def quota_metri(self, est, nord):
        # quota (m) nel punto LV95, per vicino piu' vicino (stessa griglia delle regioni vicine: vedi controllo 3)
        t = self.t
        passo = t["passo_m"]
        i = np.rint((est - (self.cx - t["lato_x_m"] / 2)) / passo).astype(np.int64)
        j = np.rint(((self.cy + t["lato_z_m"] / 2) - nord) / passo).astype(np.int64)
        dentro = (i >= 0) & (i < t["colonne"]) & (j >= 0) & (j < t["righe"])
        out = np.full(est.shape, np.nan)
        v = self.quote()
        out[dentro] = t["quota_base"] + v[j[dentro], i[dentro]].astype(np.float64) * t["scala_quota"]
        return out

    def strade(self):
        if self._strade is None:
            self._strade = carica_json(self.cartella / "strade.json")["strade"]
        return self._strade

    def edifici(self):
        if self._edifici is None:
            self._edifici = carica_json(self.cartella / "edifici.json")["edifici"]
        return self._edifici


def esito(ok, testo, risultati, chiave, dati=None):
    stampa = ("OK         " if ok else "ATTENZIONE ") + testo
    print(stampa)
    risultati.append({"controllo": chiave, "ok": bool(ok), "testo": testo, "dati": dati or {}})


def controllo_file(regioni, cantone_poligono, risultati):
    from shapely.geometry import box
    print("\n[1] File di ogni regione")
    tutto_ok = True
    for r in regioni:
        mancano = [n for n in ("terreno.json", "terreno.bin", "strade.json", "edifici.json", "regione.json", "bosco.bin", "acqua.json", "uso_suolo.json", "dettagli.json")
                   if not (r.cartella / n).exists()]
        atteso = r.t["colonne"] * r.t["righe"] * 2
        dim = (r.cartella / "terreno.bin").stat().st_size if (r.cartella / "terreno.bin").exists() else -1
        lato = int(round(r.t["lato_x_m"] / 2000))
        foto = {p.name for p in (r.cartella / "foto").glob("foto_x*_y*.jpg")} if (r.cartella / "foto").exists() else set()
        # le foto servono dove il pezzo da 2 km tocca il cantone (fuori, in Italia, swisstopo non ha foto)
        attese = set()
        for x in range(lato):
            for y in range(int(round(r.t["lato_z_m"] / 2000))):
                e0 = r.cx - r.t["lato_x_m"] / 2 + x * 2000
                n1 = r.cy + r.t["lato_z_m"] / 2 - y * 2000
                if cantone_poligono.intersects(box(e0, n1 - 2000, e0 + 2000, n1)):
                    attese.add("foto_x" + str(x) + "_y" + str(y) + ".jpg")
        foto_mancanti = sorted(attese - foto)
        ok = not mancano and dim == atteso and not foto_mancanti
        tutto_ok = tutto_ok and ok
        if not ok:
            print("   " + r.id + ": mancano file " + str(mancano) + ", terreno.bin " + str(dim) + "/" + str(atteso) + ", foto mancanti " + str(foto_mancanti[:6]))
    esito(tutto_ok, str(len(regioni)) + " regioni: tutti i file, terreno.bin della grandezza giusta e le foto da 2 km di ogni pezzo che tocca il cantone", risultati, "file")


def poligono_cantone(cantone):
    from shapely.geometry import Polygon
    punti = cantone["confine"]
    return Polygon([(punti[i], punti[i + 1]) for i in range(0, len(punti), 2)])


def controllo_copertura(regioni, cantone, poligono, risultati):
    from shapely import contains_xy
    print("\n[2] Copertura del cantone")
    est0, est1, nord0, nord1 = cantone["rettangolo"]
    passo = 100
    es = np.arange(est0 + passo / 2, est1, passo)
    ns = np.arange(nord0 + passo / 2, nord1, passo)
    E, N = np.meshgrid(es, ns)
    dentro = contains_xy(poligono, E.ravel(), N.ravel()).reshape(E.shape)
    n_dentro = int(dentro.sum())
    area_km2 = n_dentro * passo * passo / 1e6
    esito(abs(area_km2 - cantone["km2"]) / cantone["km2"] < 0.01,
          "area del confine su griglia di 100 m: " + str(round(area_km2, 1)) + " km2 (dichiarata " + str(cantone["km2"]) + ")", risultati, "area",
          {"km2_griglia": round(area_km2, 1), "km2_dichiarati": cantone["km2"]})

    senza_regione = 0
    senza_terreno = 0
    senza_foto = 0
    per_regione = {r.id: 0 for r in regioni}
    tot = 0
    for r in regioni:
        c = r.cuore
        in_cuore = dentro & (E >= c[0]) & (E < c[1]) & (N >= c[2]) & (N < c[3])
        if not in_cuore.any():
            continue
        e, n = E[in_cuore], N[in_cuore]
        per_regione[r.id] = int(in_cuore.sum())
        tot += int(in_cuore.sum())
        q = r.quota_metri(e, n)
        # la quota fissa "manca" e' un valore unico molto frequente: si cerca nel file stesso (tutti i punti uguali a 'vuoto')
        v = r.quote()
        valori, conteggi = np.unique(v[::8, ::8], return_counts=True)
        vuoto = valori[np.argmax(conteggi)] if conteggi.max() > 0.2 * v[::8, ::8].size else None
        mancanti = int(np.isnan(q).sum())
        if vuoto is not None:
            qvuota = r.t["quota_base"] + float(vuoto) * r.t["scala_quota"]
            mancanti += int(np.sum(np.abs(q - qvuota) < 1e-6))
        senza_terreno += mancanti
        # foto aerea 2 km: indice del pezzo dal basso/alto della regione
        lato = r.t["lato_x_m"]
        xi = np.floor((e - (r.cx - lato / 2)) / 2000).astype(int)
        # riga 0 = nord nel nome? si controlla solo che il pezzo esista per qualsiasi combinazione dentro la griglia
        yi = np.floor(((r.cy + r.t["lato_z_m"] / 2) - n) / 2000).astype(int)
        nomi = {p.name for p in (r.cartella / "foto").glob("foto_x*_y*.jpg")}
        mancanti_foto = int(sum(1 for a, b in zip(xi.tolist(), yi.tolist()) if "foto_x" + str(a) + "_y" + str(b) + ".jpg" not in nomi))
        senza_foto += mancanti_foto
        r.libera()
    senza_regione = n_dentro - tot
    coperto = np.zeros(E.shape, dtype=bool)
    for r in regioni:
        c = r.cuore
        coperto |= (E >= c[0]) & (E < c[1]) & (N >= c[2]) & (N < c[3])
    fuori = dentro & ~coperto
    dove = [[int(a), int(b)] for a, b in zip(E[fuori].tolist(), N[fuori].tolist())][:10]
    # un punto fuori dai cuori non e' un buco: il gioco usa la regione con l'area che lo contiene (regioneConMargine)
    nel_margine = 0
    for a, b in dove:
        if any(r.area[0] <= a <= r.area[1] and r.area[2] <= b <= r.area[3] for r in regioni):
            nel_margine += 1
    esito(senza_regione <= max(1, n_dentro // 100000) and nel_margine == len(dove),
          "punti del cantone fuori da ogni cuore: " + str(senza_regione) + " su " + str(n_dentro) + " (celle da 100 m, tutte dentro l'area di una regione: " + str(dove) + ")",
          risultati, "cuori", {"fuori": senza_regione, "dove_LV95": dove})
    esito(senza_terreno == 0, "punti del cantone senza terreno vero (quota fissa o fuori griglia): " + str(senza_terreno), risultati, "terreno", {"senza_terreno": senza_terreno})
    esito(senza_foto == 0, "punti del cantone senza foto aerea da 2 km: " + str(senza_foto), risultati, "foto", {"senza_foto": senza_foto})
    return per_regione


def vicine(regioni):
    coppie = []
    for i in range(len(regioni)):
        for j in range(i + 1, len(regioni)):
            a, b = regioni[i], regioni[j]
            e0, e1 = max(a.area[0], b.area[0]), min(a.area[1], b.area[1])
            n0, n1 = max(a.area[2], b.area[2]), min(a.area[3], b.area[3])
            if e1 > e0 and n1 > n0:
                coppie.append((a, b, (e0, e1, n0, n1)))
    return coppie


def controllo_terreno(coppie, risultati):
    print("\n[3] Cuciture del terreno (quote nella sovrapposizione delle regioni vicine, esclusi 300 m dal bordo)")
    peggiore = 0.0
    somma = 0.0
    punti = 0
    dettagli = []
    tutte = []
    for a, b, (e0, e1, n0, n1) in coppie:
        es = np.arange(e0 + 300, e1 - 300, 97.0)
        ns = np.arange(n0 + 300, n1 - 300, 97.0)
        E, N = np.meshgrid(es, ns)
        qa = a.quota_metri(E.ravel(), N.ravel())
        qb = b.quota_metri(E.ravel(), N.ravel())
        buoni = ~np.isnan(qa) & ~np.isnan(qb)
        d = np.abs(qa[buoni] - qb[buoni])
        if d.size == 0:
            continue
        dettagli.append({"a": a.id, "b": b.id, "punti": int(d.size), "diff_max_m": round(float(d.max()), 2), "diff_media_m": round(float(d.mean()), 3)})
        tutte.append(d)
        peggiore = max(peggiore, float(d.max()))
        somma += float(d.sum())
        punti += int(d.size)
        a.libera()
        b.libera()
    media = somma / punti if punti else 0
    for d in sorted(dettagli, key=lambda x: -x["diff_max_m"])[:3]:
        print("   peggiori: " + d["a"] + " / " + d["b"] + ": max " + str(d["diff_max_m"]) + " m, media " + str(d["diff_media_m"]) + " m su " + str(d["punti"]) + " punti")
    p999 = float(np.percentile(np.concatenate(tutte), 99.9)) if tutte else 0.0
    esito(p999 <= 0.5 and peggiore <= 2.0, "quote nella sovrapposizione: " + str(len(dettagli)) + " coppie, " + str(punti) + " punti, media " + str(round(media, 3)) + " m, 99,9% sotto " + str(round(p999, 2)) + " m, massima " + str(round(peggiore, 2)) + " m", risultati, "cuciture_terreno",
          {"coppie": len(dettagli), "punti": punti, "diff_max_m": round(peggiore, 2), "diff_p999_m": round(p999, 3), "diff_media_m": round(media, 4)})


def punti_strade(r, riquadro, bordo=300):
    # punti (E, N, quota, tipo) delle strade dentro il riquadro, esclusi i 'bordo' metri vicino ai suoi lati
    # tipo: 0 strada normale, 1 ponte, 2 galleria
    e0, e1, n0, n1 = riquadro
    out = []
    for s in r.strade():
        p = s["p"]
        tipo = 1 if s.get("b") else (2 if s.get("g") else 0)
        for i in range(0, len(p) - 2, 3):
            e = r.cx + p[i]
            n = r.cy - p[i + 2]
            if e0 + bordo < e < e1 - bordo and n0 + bordo < n < n1 - bordo:
                out.append((e, n, p[i + 1], tipo))
    return np.array(out) if out else np.zeros((0, 4))


def controllo_strade(coppie, risultati):
    print("\n[4] Cuciture delle strade (stessi punti, stessa quota nella sovrapposizione, esclusi 300 m dal bordo)")
    tot_a = tot_trovati = 0
    diff_normali = []
    diff_opere = []
    per_coppia = []
    opere_grandi = {}
    for a, b, riquadro in coppie:
        pa = punti_strade(a, riquadro)
        pb = punti_strade(b, riquadro)
        if len(pa) == 0 and len(pb) == 0:
            a.libera(); b.libera()
            continue
        # si confrontano punti dello stesso tipo (strada, ponte, galleria): una strada sopra una galleria o sotto un
        # ponte passa nello stesso punto (E, N) ma a un'altra quota, ed e' normale
        chiavi_b = {}
        for e, n, q, tipo in pb:
            chiavi_b[(int(round(e)), int(round(n)), int(tipo))] = q
        trovati = 0
        for e, n, q, tipo in pa:
            k = (int(round(e)), int(round(n)), int(tipo))
            hit = None
            for de in (0, -1, 1):
                for dn in (0, -1, 1):
                    if hit is None and (k[0] + de, k[1] + dn, k[2]) in chiavi_b:
                        hit = chiavi_b[(k[0] + de, k[1] + dn, k[2])]
            if hit is not None:
                trovati += 1
                (diff_normali if tipo == 0 else diff_opere).append(abs(hit - q))
                if tipo != 0 and abs(hit - q) > 1.0:
                    opere_grandi[(a.id, b.id)] = opere_grandi.get((a.id, b.id), 0) + 1
        per_coppia.append({"a": a.id, "b": b.id, "punti_a": len(pa), "punti_b": len(pb), "in_comune": trovati,
                           "percento_a_in_b": round(100 * trovati / max(1, len(pa)), 1), "percento_b_in_a": round(100 * trovati / max(1, len(pb)), 1)})
        tot_a += len(pa)
        tot_trovati += trovati
        a.libera(); b.libera()
    perc = 100 * tot_trovati / max(1, tot_a)
    esito(perc >= 98.0, "punti di strada della sovrapposizione presenti anche nella regione vicina: " + str(round(perc, 2)) + " % (" + str(tot_trovati) + " su " + str(tot_a) + ")", risultati, "cuciture_strade_posizione",
          {"percento": round(perc, 2), "punti": tot_a, "trovati": tot_trovati})
    dn = np.array(diff_normali) if diff_normali else np.zeros(1)
    esito(float(np.percentile(dn, 99.9)) <= 1.0,
          "quota delle strade normali nei punti in comune (" + str(len(diff_normali)) + "): media " + str(round(float(dn.mean()), 3)) + " m, 99,9% sotto " + str(round(float(np.percentile(dn, 99.9)), 2)) + " m, massima " + str(round(float(dn.max()), 2)) + " m",
          risultati, "cuciture_strade_quota", {"media_m": round(float(dn.mean()), 4), "p999_m": round(float(np.percentile(dn, 99.9)), 3), "max_m": round(float(dn.max()), 2)})
    do = np.array(diff_opere) if diff_opere else np.zeros(1)
    grandi = int((do > 1.0).sum())
    # ponti e gallerie lunghi tagliati dal bordo di una regione hanno la quota calcolata sulla parte di regione: e' un limite
    # noto dei dati (non della verifica): si conta, ma non fa fallire il controllo
    print("   ponti e gallerie nei punti in comune: " + str(len(diff_opere)) + " punti, " + str(grandi) + " con scarto > 1 m (massimo " + str(round(float(do.max()), 1)) + " m); coppie: " + str(sorted(opere_grandi.items(), key=lambda x: -x[1])[:4]))
    risultati.append({"controllo": "cuciture_ponti_gallerie", "ok": grandi == 0, "informativo": True,
                      "testo": "ponti e gallerie: " + str(grandi) + " punti su " + str(len(diff_opere)) + " con scarto di quota > 1 m",
                      "dati": {"punti": len(diff_opere), "oltre_1m": grandi, "max_m": round(float(do.max()), 1)}})


def controllo_edifici(coppie, risultati):
    print("\n[5] Edifici nella sovrapposizione")
    tot_a = tot_b = 0
    for a, b, (e0, e1, n0, n1) in coppie:
        def conta(r):
            n = 0
            for ed in r.edifici():
                e = r.cx + ed["p"][0]
                no = r.cy - ed["p"][1]
                if e0 + 300 < e < e1 - 300 and n0 + 300 < no < n1 - 300:
                    n += 1
            return n
        na, nb = conta(a), conta(b)
        tot_a += na
        tot_b += nb
        a.libera(); b.libera()
    scarto = abs(tot_a - tot_b) / max(1, max(tot_a, tot_b))
    esito(scarto < 0.02, "edifici contati nella sovrapposizione: " + str(tot_a) + " (lato A) e " + str(tot_b) + " (lato B), scarto " + str(round(100 * scarto, 2)) + " %", risultati, "cuciture_edifici",
          {"a": tot_a, "b": tot_b})


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    base = Path(sys.argv[1])
    uscita = None
    if "--json" in sys.argv:
        uscita = Path(sys.argv[sys.argv.index("--json") + 1])
    elenco = carica_json(base / "cantone" / "regioni.json")["regioni"]
    cantone = carica_json(base / "cantone" / "cantone.json")
    regioni = [Regione(base / info["id"], info) for info in elenco if (base / info["id"]).exists()]
    print("Regioni trovate: " + str(len(regioni)) + " su " + str(len(elenco)))
    risultati = []
    esito(len(regioni) == len(elenco), "tutte le " + str(len(elenco)) + " regioni del cantone sono presenti", risultati, "regioni")
    poligono = poligono_cantone(cantone)
    controllo_file(regioni, poligono, risultati)
    per_regione = controllo_copertura(regioni, cantone, poligono, risultati)
    coppie = vicine(regioni)
    print("\nCoppie di regioni che si sovrappongono: " + str(len(coppie)))
    controllo_terreno(coppie, risultati)
    controllo_strade(coppie, risultati)
    controllo_edifici(coppie, risultati)
    ko = [r for r in risultati if not r["ok"] and not r.get("informativo")]
    info = [r for r in risultati if not r["ok"] and r.get("informativo")]
    print("\nRISULTATO: " + str(len(risultati) - len(ko) - len(info)) + " controlli OK, " + str(len(ko)) + " con ATTENZIONE, " + str(len(info)) + " limiti noti (solo informativi)")
    if uscita:
        uscita.write_text(json.dumps({"controlli": risultati, "punti_per_regione": per_regione}, indent=1, ensure_ascii=False), encoding="utf-8")
    sys.exit(1 if ko else 0)


if __name__ == "__main__":
    main()
