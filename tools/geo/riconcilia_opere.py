# RICONCILIA PONTI E GALLERIE TRA LE REGIONI (Ticino completo)
#
# PROBLEMA (misurato con verifica_cantone.py): il passo 7 calcola la quota di un ponte o di una galleria come
# LINEA DRITTA TRA I DUE INGRESSI VERI, ma lo fa sul pezzo di opera che sta DENTRO la regione (il resto e' ritagliato
# via). Se l'opera esce dalla regione, il "capo" tagliato viene trattato come un ingresso: la quota diventa piatta
# (uguale all'altro capo) e la rampa di copertura della galleria riparte dal taglio. La regione vicina taglia l'opera
# in un altro punto e ottiene un'altra linea: nella sovrapposizione la stessa galleria ha quote diverse (fino a 52 m
# nel tunnel del San Gottardo).
#
# SOLUZIONE (una sola regola per tutto il cantone, al posto di correzioni locali):
#  1. si uniscono i pezzi di ponte e di galleria di TUTTE le regioni in catene complete (stessi vertici = stesso punto);
#  2. gli ingressi veri sono i capi della catena che non cadono sul bordo dei dati (area di una regione o limite
#     dei dati scaricati): la loro quota e' quella vera del terreno, gia' calcolata dal passo 7 dentro una regione;
#  3. ponte: linea dritta tra gli ingressi, mai sotto il terreno; galleria: linea dritta, almeno 7 m sotto il terreno
#     (meno vicino agli ingressi, rampa di 80 m), sempre misurata dagli ingressi VERI, poi lisciata come nel passo 7;
#  4. ogni vertice riceve UNA quota, uguale in tutte le regioni che lo contengono.
# Le catene con un capo tagliato dal limite dei dati restano piatte da quel lato (come prima): ma lo stesso in ogni
# regione.
# Non si forza nessuna strada sul terreno: ponti e gallerie mantengono la loro geometria.
#
# REGOLE DI SICUREZZA PER LE RETI RAMIFICATE (aggiunte il 13/11/2026, versione 2 della riconciliazione):
# la prima versione portava ogni rete ramificata (svincoli, viadotti con carreggiate unite) a un unico piano per interpolazione.
# Il confronto con swissSURFACE3D (verifica_ponti_dsm.py) ha mostrato che per lo svincolo di Monte Carasso peggiorava (mediana
# dell'errore da -0,01 a +3,5 m) e un controllo delle pendenze ha trovato rami trascinati fino a 222 m piu' in basso. Percio':
#  A. una rete ramificata (piu' di un tratto) si riscrive SOLO se le copie dei suoi vertici in regioni diverse discordano di almeno
#     SOGLIA_BORDO_RAMIFICATE_M (la soglia della verifica dei confini): senza discordanza non c'e' niente da riconciliare e i dati
#     originali restano. Le catene semplici (un solo tratto) si riconciliano sempre, come prima.
#  B. controllo per tratto dopo il calcolo: se la pendenza massima su 20 m del tratto riconciliato supera il 30 % e peggiora di piu'
#     di 10 punti rispetto agli originali, il tratto torna ai dati originali. Se un tratto riconciliato vicino resterebbe con un
#     gradino di oltre 1 m rispetto alla giunzione ripristinata, torna all'originale anche lui (propagazione).
#
# Uso:
#   python riconcilia_opere.py <cartella con le regioni e "cantone/"> [--applica] [--json esito.json]
#   python riconcilia_opere.py --pacchetti <cartella con regione_R_*.tar.gz> --cantone <cartella con cantone.json, regioni.json>
# Senza --applica fa solo l'analisi (non scrive niente). Con --applica riscrive la lista "p" di strade.json nelle regioni.
# Nella pipeline va eseguito dopo che tutte le regioni sono pronte, prima di creare i pacchetti (vedi workflow).

import json
import math
import os
import sys
from pathlib import Path

import numpy as np

from verifica_cantone import Regione, carica_json

SOPRA_TERRENO_M = 0.2       # come passo7_esporta_anteprima.py
COPERTURA_GALLERIA_M = 7.0  # come anteprima_strade.py
RAMPA_GALLERIA_M = 80.0
TOLLERANZA_BORDO_M = 3.0    # un capo a meno di 3 m dal bordo dei dati e' "tagliato", non un ingresso
SOGLIA_BORDO_RAMIFICATE_M = 1.0   # come la verifica dei confini (verifica_cantone.py): sotto questa discordanza tra regioni non si tocca la rete ramificata
FINESTRA_PENDENZA_M = 20.0        # pendenza misurata su almeno 20 m di strada (i vertici a 3-4 m danno valori rumorosi)
SOGLIA_PENDENZA = 0.30            # un tratto riconciliato con pendenza su 20 m oltre il 30 %...
PEGGIORAMENTO_PENDENZA = 0.10     # ...e peggiorata di oltre 10 punti rispetto agli originali, torna all'originale
SOGLIA_GRADINO_GIUNZIONE_M = 1.0  # gradino massimo ammesso tra un tratto ripristinato e uno riconciliato che si toccano
SOGLIA_GIUNZIONE_FALSA_M = 5.0    # se negli originali due tratti che si toccano hanno gia' un salto di oltre 5 m, non sono davvero collegati


def pendenza_finestra(s, y, finestra=FINESTRA_PENDENZA_M):
    # pendenza massima |dy|/ds su tratti di almeno `finestra` metri lungo la strada (s = distanze progressive)
    m = 0.0
    j = 0
    n = len(s)
    for i in range(n):
        if j <= i:
            j = i + 1
        while j < n and s[j] - s[i] < finestra:
            j += 1
        if j >= n:
            break
        m = max(m, abs(y[j] - y[i]) / (s[j] - s[i]))
    if m == 0.0 and n >= 2 and s[-1] > 2 and s[-1] < finestra:
        m = abs(y[-1] - y[0]) / s[-1]     # tratto piu' corto della finestra: pendenza dell'intero tratto
    return m


class Nodi:
    # vertici unici: due punti a meno di ~1 m sono lo stesso vertice (anche se arrotondati diversamente)
    def __init__(self):
        self.griglia = {}
        self.pos = []

    def id(self, e, n):
        ke, kn = int(round(e)), int(round(n))
        for de in (0, -1, 1):
            for dn in (0, -1, 1):
                v = self.griglia.get((ke + de, kn + dn))
                if v is not None and abs(self.pos[v][0] - e) < 1.0 and abs(self.pos[v][1] - n) < 1.0:
                    return v
        self.pos.append((e, n))
        self.griglia[(ke, kn)] = len(self.pos) - 1
        return len(self.pos) - 1


def distanza_dal_bordo(r, e, n):
    a = r.area
    return min(e - a[0], a[1] - e, n - a[2], a[3] - n)


def riconcilia(base, applica, uscita_json=None):
    # Ritorna l'insieme degli id delle regioni il cui strade.json e' stato riscritto
    riscritte = set()
    elenco = carica_json(base / "cantone" / "regioni.json")["regioni"]
    cantone = carica_json(base / "cantone" / "cantone.json")
    limite_dati = cantone["rettangolo"]
    regioni = [Regione(base / i["id"], i) for i in elenco if (base / i["id"]).exists()]
    print("Regioni: " + str(len(regioni)))

    nodi = Nodi()
    # per ogni tipo ("b" ponte, "g" galleria): lista di pezzi (regione, indice strada, [id nodi])
    pezzi = {"b": [], "g": []}
    dati_regione = {}
    for r in regioni:
        strade = carica_json(r.cartella / "strade.json")
        dati_regione[r.id] = strade
        for k, s in enumerate(strade["strade"]):
            tipo = "b" if s.get("b") else ("g" if s.get("g") else None)
            if tipo is None:
                continue
            p = s["p"]
            ids = [nodi.id(r.cx + p[i], r.cy - p[i + 2]) for i in range(0, len(p), 3)]
            pezzi[tipo].append((r, k, ids))
    print("Vertici unici di ponti e gallerie: " + str(len(nodi.pos)) + "; pezzi: ponti " + str(len(pezzi["b"])) + ", gallerie " + str(len(pezzi["g"])))

    # per ogni nodo: la regione dove e' piu' lontano dal bordo dell'area, e la sua quota (stored y) li'
    quota_nodo = {}      # (tipo, nodo) -> (distanza dal bordo migliore, y salvata)
    ys_per_nodo = {}     # (tipo, nodo) -> lista di y salvate (per misurare lo scarto di partenza)
    ys_per_regione = {}  # (tipo, nodo) -> {id regione: prima y salvata}: discordanza TRA REGIONI (il difetto dei confini)
    for tipo in ("b", "g"):
        for r, k, ids in pezzi[tipo]:
            p = dati_regione[r.id]["strade"][k]["p"]
            for j, nid in enumerate(ids):
                e, n = nodi.pos[nid]
                d = distanza_dal_bordo(r, e, n)
                y = p[j * 3 + 1]
                ys_per_nodo.setdefault((tipo, nid), []).append(y)
                ys_per_regione.setdefault((tipo, nid), {}).setdefault(r.id, y)
                if (tipo, nid) not in quota_nodo or d > quota_nodo[(tipo, nid)][0]:
                    quota_nodo[(tipo, nid)] = (d, y, r)

    # profilo ORIGINALE di ogni arco (due vertici consecutivi di una strada): (distanza dal bordo, y primo vertice, y secondo vertice), copia piu' interna.
    # Serve a misurare le pendenze e i gradini di un tratto con le quote della SUA strada, non con quelle di un'altra che passa nello stesso punto.
    y_arco = {}
    for tipo in ("b", "g"):
        for r, k, ids in pezzi[tipo]:
            p = dati_regione[r.id]["strade"][k]["p"]
            for j in range(len(ids) - 1):
                a, b = ids[j], ids[j + 1]
                if a == b:
                    continue
                d = min(distanza_dal_bordo(r, *nodi.pos[a]), distanza_dal_bordo(r, *nodi.pos[b]))
                v = (d, p[j * 3 + 1], p[(j + 1) * 3 + 1])
                for chiave, val in (((tipo, a, b), v), ((tipo, b, a), (d, v[2], v[1]))):
                    if chiave not in y_arco or d > y_arco[chiave][0]:
                        y_arco[chiave] = val

    def y_originale_segmento(tipo, ordine):
        ys = [y_arco[(tipo, ordine[j], ordine[j + 1])][1] for j in range(len(ordine) - 1)]
        ys.append(y_arco[(tipo, ordine[-2], ordine[-1])][2])
        return ys

    nuovo_y = {}         # (tipo, nodo) -> y nuova
    archi_ripristinati = set()   # (tipo, a, b) degli archi dei tratti ripristinati agli originali: i loro vertici non si riscrivono (per arco, non per nodo:
                                 # un'altra strada che passa dallo stesso nodo, per esempio la galleria principale, si riscrive normalmente)
    statistiche = {"segmenti": 0, "gruppi_corretti": 0, "segmenti_corretti": 0, "gruppi_senza_ingressi": 0, "cambio_max_m": 0.0, "scarto_prima_max_m": 0.0,
                   "gruppi_ramificati_non_toccati": 0, "segmenti_ripristinati": 0}
    dettagli = []
    esclusi = []         # reti ramificate lasciate ai dati originali e tratti ripristinati dal controllo delle pendenze
    SOGLIA_SCARTO_M = 0.3
    for tipo in ("b", "g"):
        # grafo: archi tra vertici consecutivi
        vicini = {}
        for r, k, ids in pezzi[tipo]:
            for a, b in zip(ids, ids[1:]):
                if a == b:
                    continue
                vicini.setdefault(a, set()).add(b)
                vicini.setdefault(b, set()).add(a)

        def distanza(a, b):
            return math.hypot(nodi.pos[a][0] - nodi.pos[b][0], nodi.pos[a][1] - nodi.pos[b][1])

        # Si taglia nei nodi che non hanno esattamente 2 vicini (capi e giunzioni): "segmenti", come i pezzi di linemerge nel passo 7.
        capi = {v for v, w in vicini.items() if len(w) != 2}
        percorsi = set()
        segmenti = []          # ognuno: lista ordinata di nodi, primo e ultimo sono capi
        for c in sorted(capi):
            for primo in sorted(vicini[c]):
                if (c, primo) in percorsi:
                    continue
                ordine = [c, primo]
                percorsi.add((c, primo))
                while len(vicini[ordine[-1]]) == 2:
                    corrente = ordine[-1]
                    prossimo = [w for w in vicini[corrente] if w != ordine[-2]][0]
                    ordine.append(prossimo)
                percorsi.add((ordine[-1], ordine[-2]))
                segmenti.append(ordine)
        statistiche["segmenti"] += len(segmenti)
        lunghezze = []
        for ordine in segmenti:
            s = [0.0]
            for a, b in zip(ordine, ordine[1:]):
                s.append(s[-1] + distanza(a, b))
            lunghezze.append(s)

        # gruppi di segmenti collegati tra loro (la rete di gallerie o di rampe)
        gruppo_di = {}
        gruppi = []
        for i, ordine in enumerate(segmenti):
            tocchi = {gruppo_di[v] for v in (ordine[0], ordine[-1]) if v in gruppo_di}
            if not tocchi:
                gruppi.append([i])
                nuovo_g = len(gruppi) - 1
            else:
                nuovo_g = min(tocchi)
                gruppi[nuovo_g].append(i)
                for g in tocchi:
                    if g != nuovo_g:
                        gruppi[nuovo_g].extend(gruppi[g])
                        gruppi[g] = []
            for g, elenco_g in enumerate(gruppi):
                pass
            for v in (ordine[0], ordine[-1]):
                gruppo_di[v] = nuovo_g
            # ricolloca anche i capi dei segmenti spostati
            for j in gruppi[nuovo_g]:
                for v in (segmenti[j][0], segmenti[j][-1]):
                    gruppo_di[v] = nuovo_g

        def e_ingresso(v):
            # capo (un solo vicino) che non sta sul bordo dei dati: ingresso vero, quota vera del terreno dal passo 7
            if len(vicini[v]) != 1:
                return False
            e, n = nodi.pos[v]
            if e < limite_dati[0] + TOLLERANZA_BORDO_M or e > limite_dati[1] - TOLLERANZA_BORDO_M or \
                    n < limite_dati[2] + TOLLERANZA_BORDO_M or n > limite_dati[3] - TOLLERANZA_BORDO_M:
                return False
            return quota_nodo[(tipo, v)][0] > TOLLERANZA_BORDO_M

        for gruppo in gruppi:
            if not gruppo:
                continue
            scarto_prima = 0.0
            for i in gruppo:
                for v in segmenti[i]:
                    ys = ys_per_nodo[(tipo, v)]
                    scarto_prima = max(scarto_prima, max(ys) - min(ys))
            statistiche["scarto_prima_max_m"] = max(statistiche["scarto_prima_max_m"], scarto_prima)
            if scarto_prima <= SOGLIA_SCARTO_M:
                continue            # le copie nelle regioni gia' combaciano: non si tocca niente
            if len(gruppo) > 1:
                # rete ramificata: discordanza TRA REGIONI (stesso vertice in regioni diverse)
                scarto_regioni = 0.0
                for i in gruppo:
                    for v in segmenti[i]:
                        vals = list(ys_per_regione[(tipo, v)].values())
                        if len(vals) > 1:
                            scarto_regioni = max(scarto_regioni, max(vals) - min(vals))
                if scarto_regioni < SOGLIA_BORDO_RAMIFICATE_M:
                    statistiche["gruppi_ramificati_non_toccati"] += 1
                    nodo0 = segmenti[gruppo[0]][0]
                    esclusi.append({"tipo": tipo, "motivo": "rete ramificata senza discordanza tra regioni (< " + str(SOGLIA_BORDO_RAMIFICATE_M) + " m): dati originali",
                                    "segmenti": len(gruppo), "lunghezza_totale_m": round(sum(lunghezze[i][-1] for i in gruppo)),
                                    "scarto_regioni_m": round(scarto_regioni, 2), "scarto_copie_m": round(scarto_prima, 2),
                                    "esempio_LV95": [round(nodi.pos[nodo0][0]), round(nodi.pos[nodo0][1])]})
                    continue
            # --- rete ridotta: nodi capo e segmenti con conduttanza 1/lunghezza
            nodi_capo = sorted({v for i in gruppo for v in (segmenti[i][0], segmenti[i][-1])})
            indice = {v: k for k, v in enumerate(nodi_capo)}
            ancore = {v: quota_nodo[(tipo, v)][1] - SOPRA_TERRENO_M for v in nodi_capo if e_ingresso(v)}
            if not ancore:
                statistiche["gruppi_senza_ingressi"] += 1
                continue
            # Quote dei nodi capo: la linea PRINCIPALE (il percorso piu' lungo tra ingressi veri) decide le quote delle giunzioni;
            # i rami laterali (cunicoli, rampe) si adattano. Cosi' un cunicolo che sale in superficie non tira su la galleria principale.
            # Ripetuto: "orecchio" piu' lungo tra due nodi gia' fissati attraverso nodi liberi (linea dritta per lunghezza),
            # oppure ramo che finisce nel nulla (capo tagliato dal limite dei dati): piatto alla quota del nodo da cui parte.
            adiacenti = {}
            for i in gruppo:
                a_, b_ = segmenti[i][0], segmenti[i][-1]
                if a_ == b_:
                    continue
                adiacenti.setdefault(a_, []).append((b_, lunghezze[i][-1], i))
                adiacenti.setdefault(b_, []).append((a_, lunghezze[i][-1], i))
            fissati = dict(ancore)           # nodo -> quota
            liberi_n = [v for v in nodi_capo if v not in fissati]
            guardia = 0
            while liberi_n and guardia < 1000:
                guardia += 1
                migliore = None              # (lunghezza, percorso nodi, nodo finale fissato o None)

                def meglio(candidato):
                    if migliore is None:
                        return True
                    if (candidato[2] is not None) != (migliore[2] is not None):
                        return candidato[2] is not None     # un orecchio vale piu' di un ramo che finisce nel nulla
                    return candidato[0] > migliore[0]

                def cerca(percorso, lungh, visti_n):
                    nonlocal migliore
                    corrente = percorso[-1]
                    for (w, l, i) in adiacenti.get(corrente, []):
                        if w in visti_n:
                            continue
                        if w in fissati:
                            candidato = (lungh + l, percorso + [w], w)
                            if w != percorso[0] and meglio(candidato):
                                migliore = candidato
                        else:
                            seguiti = [x for x in adiacenti.get(w, []) if x[0] != corrente]
                            if not seguiti:
                                candidato = (lungh + l, percorso + [w], None)
                                if meglio(candidato):
                                    migliore = candidato
                            else:
                                cerca(percorso + [w], lungh + l, visti_n | {w})

                for f in list(fissati):
                    cerca([f], 0.0, {f})
                if migliore is None:
                    break
                lungh_tot, percorso, fine = migliore
                lungh_parz = [0.0]
                for u, w in zip(percorso, percorso[1:]):
                    l = [x[1] for x in adiacenti[u] if x[0] == w][0]
                    lungh_parz.append(lungh_parz[-1] + l)
                q_inizio = fissati[percorso[0]]
                for u, lp in zip(percorso[1:], lungh_parz[1:]):
                    if u in fissati:
                        continue
                    if fine is None:
                        fissati[u] = q_inizio
                    else:
                        fissati[u] = q_inizio + (fissati[fine] - q_inizio) * (lp / lungh_tot if lungh_tot else 0)
                liberi_n = [v for v in nodi_capo if v not in fissati]
            if liberi_n:
                # percorsi rimasti fuori (anelli, nodi raggiungibili solo da un lato): media dei vicini gia' fissati
                statistiche["gruppi_con_media"] = statistiche.get("gruppi_con_media", 0) + 1
                for _ in range(len(liberi_n) + 2):
                    for v in list(liberi_n):
                        vals = [fissati[w] for (w, l, i) in adiacenti.get(v, []) if w in fissati]
                        if vals:
                            fissati[v] = sum(vals) / len(vals)
                    liberi_n = [v for v in nodi_capo if v not in fissati]
                    if not liberi_n:
                        break
            if liberi_n:
                statistiche["gruppi_senza_ingressi"] += 1
                continue
            x = np.array([fissati[v] for v in nodi_capo])
            # distanza dal piu' vicino ingresso vero (Dijkstra sulla rete ridotta) per la rampa di copertura
            dist = {v: (0.0 if v in ancore else 1e9) for v in nodi_capo}
            cambiato = True
            while cambiato:
                cambiato = False
                for i in gruppo:
                    a, b = segmenti[i][0], segmenti[i][-1]
                    l = lunghezze[i][-1]
                    if dist[a] + l < dist[b] - 1e-9:
                        dist[b] = dist[a] + l; cambiato = True
                    if dist[b] + l < dist[a] - 1e-9:
                        dist[a] = dist[b] + l; cambiato = True

            massimo_cambio = 0.0
            proposte = {}        # indice segmento -> lista di y nuove (con SOPRA_TERRENO_M)
            for i in gruppo:
                ordine, s = segmenti[i], lunghezze[i]
                L_seg = s[-1]
                qa, qb = float(x[indice[ordine[0]]]), float(x[indice[ordine[-1]]])
                da, db = dist[ordine[0]], dist[ordine[-1]]
                terreno = []
                for v in ordine:
                    e, n = nodi.pos[v]
                    terreno.append(float(quota_nodo[(tipo, v)][2].quota_metri(np.array([e]), np.array([n]))[0]))
                base = [qa + (qb - qa) * (si / L_seg if L_seg else 0) for si in s]
                if tipo == "b":
                    nuova = [max(b_, t_) for b_, t_ in zip(base, terreno)]
                else:
                    limiti = []
                    nuova = []
                    for j, sj in enumerate(s):
                        dai_capi = min(da + sj, db + (L_seg - sj))
                        limite = terreno[j] - COPERTURA_GALLERIA_M * min(1.0, dai_capi / RAMPA_GALLERIA_M)
                        limiti.append(limite)
                        nuova.append(min(base[j], limite))
                    if len(nuova) > 2:
                        liscio = []
                        for j in range(len(nuova)):
                            vic = nuova[max(0, j - 4): j + 5]
                            liscio.append(min(sum(vic) / len(vic), limiti[j]))
                        liscio[0] = nuova[0]
                        liscio[-1] = nuova[-1]
                        nuova = liscio
                proposte[i] = [round(qn + SOPRA_TERRENO_M, 2) for qn in nuova]

            # --- regola B: controllo delle pendenze per tratto e ripristino degli originali dove la riconciliazione peggiora
            def estremi(i):
                return (segmenti[i][0], segmenti[i][-1])
            rifiutati = {}
            originali = {i: y_originale_segmento(tipo, segmenti[i]) for i in proposte}
            for i, ys_nuove in proposte.items():
                prima_y = originali[i]
                g_prima = pendenza_finestra(lunghezze[i], prima_y)
                g_dopo = pendenza_finestra(lunghezze[i], ys_nuove)
                if g_dopo > SOGLIA_PENDENZA and g_dopo > g_prima + PEGGIORAMENTO_PENDENZA:
                    rifiutati[i] = "pendenza su " + str(int(FINESTRA_PENDENZA_M)) + " m " + str(round(g_prima * 100)) + " % -> " + str(round(g_dopo * 100)) + " %"
            cambiato = bool(rifiutati)
            while cambiato:
                cambiato = False
                for i, ys_nuove in proposte.items():
                    if i in rifiutati:
                        continue
                    for pos_v, v in ((0, segmenti[i][0]), (-1, segmenti[i][-1])):
                        for j in list(rifiutati):
                            if v in estremi(j):
                                # y originale del tratto ripristinato j nella giunzione v, e del tratto i
                                y_j = originali[j][0 if segmenti[j][0] == v else -1]
                                gradino_nuovo = abs(ys_nuove[pos_v] - y_j)
                                gradino_orig = abs(originali[i][pos_v] - y_j)
                                # si propaga solo se la riconciliazione AUMENTA il gradino: una giunzione gia' discontinua negli originali
                                # (strade di superficie che toccano la galleria nello stesso punto 2D) non e' una vera giunzione: non si propaga
                                if os.environ.get("RICONCILIA_DEBUG"):
                                    print("   giunzione", [round(c) for c in nodi.pos[v]], "tratto", i, "L", round(lunghezze[i][-1]), "y orig", round(originali[i][pos_v], 1), "y nuova", round(ys_nuove[pos_v], 1),
                                          "| ripristinato", j, "L", round(lunghezze[j][-1]), "y orig", round(y_j, 1), "| gradino orig", round(gradino_orig, 1), "nuovo", round(gradino_nuovo, 1))
                                if gradino_orig <= SOGLIA_GIUNZIONE_FALSA_M and gradino_nuovo > SOGLIA_GRADINO_GIUNZIONE_M and gradino_nuovo > gradino_orig + SOGLIA_GRADINO_GIUNZIONE_M:
                                    rifiutati[i] = "il gradino alla giunzione con un tratto ripristinato aumenterebbe di oltre " + str(SOGLIA_GRADINO_GIUNZIONE_M) + " m"
                                    cambiato = True
                                    break
                        if i in rifiutati:
                            break
            for i, ys_nuove in proposte.items():
                if i in rifiutati:
                    for a_, b_ in zip(segmenti[i], segmenti[i][1:]):
                        archi_ripristinati.add((tipo, a_, b_))
                        archi_ripristinati.add((tipo, b_, a_))
                    statistiche["segmenti_ripristinati"] += 1
                    nodo0 = segmenti[i][0]
                    esclusi.append({"tipo": tipo, "motivo": "tratto ripristinato ai dati originali: " + rifiutati[i], "segmenti": 1, "lunghezza_totale_m": round(lunghezze[i][-1]),
                                    "esempio_LV95": [round(nodi.pos[nodo0][0]), round(nodi.pos[nodo0][1])]})
                    continue
                for v, y, y_orig in zip(segmenti[i], ys_nuove, originali[i]):
                    nuovo_y[(tipo, v)] = y
                    massimo_cambio = max(massimo_cambio, abs(y - y_orig))      # rispetto alla quota della STESSA strada (non di un'altra che passa nel nodo)
                statistiche["segmenti_corretti"] += 1
            if len(rifiutati) == len(proposte):
                continue
            statistiche["gruppi_corretti"] += 1
            statistiche["cambio_max_m"] = max(statistiche["cambio_max_m"], massimo_cambio)
            tot_l = sum(lunghezze[i][-1] for i in gruppo)
            dettagli.append({"tipo": tipo, "segmenti": len(gruppo), "lunghezza_totale_m": round(tot_l), "ingressi_veri": len(ancore), "scarto_prima_m": round(scarto_prima, 1),
                             "cambio_max_m": round(massimo_cambio, 1), "esempio_LV95": [round(nodi.pos[nodi_capo[0]][0]), round(nodi.pos[nodi_capo[0]][1])]})

    print("\nSegmenti di ponti/gallerie (tratti tra capi e giunzioni): " + str(statistiche["segmenti"]) + "; gruppi (reti collegate) corretti: " + str(statistiche["gruppi_corretti"]) +
          " (" + str(statistiche["segmenti_corretti"]) + " segmenti); gruppi senza ingressi veri (non toccati): " + str(statistiche["gruppi_senza_ingressi"]))
    print("Reti ramificate lasciate ai dati originali (nessuna discordanza tra regioni): " + str(statistiche["gruppi_ramificati_non_toccati"]) + "; tratti ripristinati dal controllo delle pendenze: " + str(statistiche["segmenti_ripristinati"]))
    print("Scarto massimo tra le copie PRIMA: " + str(round(statistiche["scarto_prima_max_m"], 1)) + " m; cambio massimo di quota applicato a un vertice: " + str(round(statistiche["cambio_max_m"], 1)) + " m")
    for d in sorted(dettagli, key=lambda x: -x["scarto_prima_m"])[:14]:
        print("   " + ("galleria" if d["tipo"] == "g" else "ponte") + ": " + str(d["segmenti"]) + " segmenti, " + str(d["lunghezza_totale_m"]) + " m, " + str(d["ingressi_veri"]) + " ingressi veri, scarto prima " + str(d["scarto_prima_m"]) + " m, cambio max " + str(d["cambio_max_m"]) + " m, vicino a " + str(d["esempio_LV95"]))
    if uscita_json:
        Path(uscita_json).write_text(json.dumps({"statistiche": statistiche, "segmenti_corretti": dettagli, "non_toccati_o_ripristinati": esclusi}, indent=1, ensure_ascii=False), encoding="utf-8")

    if not applica:
        print("\n(analisi: niente e' stato scritto; usa --applica)")
        return riscritte
    # riscrive le quote nelle regioni
    modificati = 0
    for r in regioni:
        strade = dati_regione[r.id]
        cambiato = False
        for tipo in ("b", "g"):
            for rr, k, ids in pezzi[tipo]:
                if rr is not r:
                    continue
                p = strade["strade"][k]["p"]
                for j, nid in enumerate(ids):
                    y = nuovo_y.get((tipo, nid))
                    if (j > 0 and (tipo, ids[j - 1], nid) in archi_ripristinati) or (j < len(ids) - 1 and (tipo, nid, ids[j + 1]) in archi_ripristinati):
                        continue          # vertice di un tratto ripristinato agli originali
                    if y is not None and p[j * 3 + 1] != y:
                        p[j * 3 + 1] = y
                        cambiato = True
                        modificati += 1
        if cambiato:
            with open(r.cartella / "strade.json", "w", encoding="utf-8") as f:
                json.dump(strade, f, ensure_ascii=False, separators=(",", ":"))
            riscritte.add(r.id)
    print("\nVertici riscritti: " + str(modificati) + " in " + str(len(riscritte)) + " regioni")
    return riscritte


def da_pacchetti(cartella_pacchetti, cartella_cantone, uscita_json=None):
    # Pipeline (job "riconcilia" del workflow): apre i pacchetti regione_R_*.tar.gz, riconcilia, e riscrive SOLO i pacchetti
    # cambiati (stesso contenuto, con il nuovo strade.json)
    import shutil
    import tarfile
    import tempfile
    pacchetti = sorted(Path(cartella_pacchetti).glob("regione_R_*.tar.gz"))
    if not pacchetti:
        raise SystemExit("Nessun pacchetto regione_R_*.tar.gz in " + str(cartella_pacchetti))
    base = Path(tempfile.mkdtemp(prefix="riconcilia-"))
    try:
        shutil.copytree(cartella_cantone, base / "cantone")
        for pacchetto in pacchetti:
            ident = pacchetto.name[len("regione_"):-len(".tar.gz")]
            (base / ident).mkdir()
            with tarfile.open(pacchetto, "r:gz") as a:
                a.extractall(base / ident, filter="data")
        riscritte = riconcilia(base, True, uscita_json)
        for ident in sorted(riscritte):
            origine = Path(cartella_pacchetti) / ("regione_" + ident + ".tar.gz")
            nuovo = origine.with_suffix(".nuovo")
            with tarfile.open(origine, "r:gz") as vecchio, tarfile.open(nuovo, "w:gz", compresslevel=6) as dopo:
                for membro in vecchio:
                    if membro.name in ("strade.json", "./strade.json"):
                        dopo.add(base / ident / "strade.json", arcname="strade.json")
                    elif membro.isfile():
                        dopo.addfile(membro, vecchio.extractfile(membro))
                    else:
                        dopo.addfile(membro)
            nuovo.replace(origine)
            print("   pacchetto riscritto: " + origine.name)
    finally:
        shutil.rmtree(base, ignore_errors=True)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    uscita_json = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    if "--pacchetti" in sys.argv:
        # python riconcilia_opere.py --pacchetti <cartella dei pacchetti> --cantone <cartella con cantone.json e regioni.json>
        da_pacchetti(sys.argv[sys.argv.index("--pacchetti") + 1], sys.argv[sys.argv.index("--cantone") + 1], uscita_json)
        return
    riconcilia(Path(sys.argv[1]), "--applica" in sys.argv, uscita_json)


if __name__ == "__main__":
    main()
