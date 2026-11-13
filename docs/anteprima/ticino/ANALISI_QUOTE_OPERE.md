# Analisi delle quote di ponti e gallerie (13/11/2026)

Dati analizzati: i pacchetti **pubblicati** il 13/11/2026 (dopo la riconciliazione), 19 regioni, confrontati con i pacchetti pubblicati il 12/11/2026 (originali, SHA-256 in `pubblicato_prima_sha256.txt`).
Tre concetti restano **distinti** in tutta l'analisi: **quota della superficie stradale** (`y` del vertice di `strade.json`), **terreno** (`terreno.bin`, griglia a 4 m, vicino più vicino) e **struttura** (ponte o galleria, con la sua volta e i suoi portali). Nessun ponte e nessuna galleria è stata forzata sul terreno.
Misure **[M]**; interpretazioni **[I]**. Script: `tools/geo/analizza_quote_opere.py`, `confronta_opere_prima_dopo.py`, `opere_cambi_grandi.py`, `opere_nuovi_scalini_condivisi.py`, `opere_mostra_rete.py`. Dati grezzi: `quote_opere/`.

---

## 1. I 493 vertici di galleria sopra il terreno e i 455 di ponte sotto il terreno

Soglia: più di 0,5 m (galleria sopra il terreno, ponte sotto il terreno). Il conteggio per tratto (un tratto presente in due regioni conta due volte) dà 493 vertici di galleria in 368 tratti e 452 di ponte in 328 tratti (i 455 del report precedente includevano 3 pareggi di arrotondamento).

| | Gallerie sopra il terreno | Ponti sotto il terreno |
|---|---|---|
| Vertici / tratti | 493 / 368 | 452 / 328 |
| Scarto massimo del tratto ≤ 2 m | 432 vertici | 361 vertici |
| 2–5 m | 55 | 80 |
| > 5 m | 6 | 11 |
| Vertici in tratti che stanno interamente entro 100 m da un capo | **493 su 493** | 418 su 452 |
| Distanza mediana dal capo (tratti) | 4 m | 4 m |

**[M] Non sono un effetto della riconciliazione.**
- Nei pacchetti pubblicati prima erano 513 (gallerie) e 601 (ponti).
- La riconciliazione ha cambiato 10 170 vertici: **166 erano fuori soglia prima, 0 dopo**; 6 279 migliorati, 3 891 invariati, **0 peggiorati** (`confronta_opere_prima_dopo.py`).
- I tre casi peggiori hanno quote **identiche** prima e dopo (verificato byte per byte sul `p` del tratto): galleria "1. Maccagno inferiore" (19,5 m), imbocco di Via San Gottardo ad Airolo (14,5 m), Ponte Ribellasca (8,3 m).

**[I] Perché succede.** Quasi tutti sono capi: i portali e le teste di ponte stanno a quota terreno per costruzione (la rampa di 80 m parte dal terreno dell'ingresso); con un terreno a 4 m su pendii ripidi il vicino più vicino può stare da qualche decimetro a qualche metro più in alto o più in basso. Ponte Ribellasca: pendenza del terreno 3,5 (74°), cioè il vertice di terreno più vicino è sulla parete della forra, il ponte è alla quota giusta. Imbocco di Airolo: pendenza 3,0, scavo a trincea.

### Difetti visivi e di collisione
- **Collisione [I da codice, non da prova fisica]:** `quotaSuolo` (`anteprima/src/moto.js`) usa la quota della strada se la differenza con la moto è sotto 6 m; la moto segue quindi la **superficie della struttura**, non il terreno. Un vertice di struttura sopra o sotto il terreno non produce urti con il terreno. Il terreno è disegnato solo dall'alto (`terreno.js`), per non coprire il tubo delle gallerie.
- **Visivo [M, 3 casi, grafica software, immagini in `quote_opere/`]:** Ponte Ribellasca e imbocco di Airolo non mostrano difetti evidenti (impalcato visibile, trincea d'imbocco credibile). A **Maccagno inferiore** si vede dentro la galleria una **lastra bianca** accanto alla moto (non blocca la strada): è un difetto visivo reale, preesistente, vicino a un tratto con 2 vertici fuori di 19,5 m a 0–30 m da un capo su terreno poco ripido (pendenza 0,22): **causa non individuata**, non corretto.
- **Non verificato:** gli altri 360+ tratti non sono stati guardati uno a uno; i casi lievi (≤ 2 m, 88 % dei vertici) sono nell'ordine di grandezza del campionamento del terreno.

### Cosa non si può correggere senza peggiorare la geometria reale
- Teste di ponte e portali su pendii ripidi o forre: il valore "fuori" è un artefatto del confronto con un terreno a 4 m, non un errore dell'opera. Forzare l'opera sul terreno rovinerebbe l'impalcato (ponte) o la copertura (galleria).
- Per correggerli davvero servirebbe il terreno a 2 m dentro il confronto o la quota dell'ingresso dall'opera vera, non dal vicino più vicino.

---

## 2. Scalini tra carreggiate sovrapposte (separati dalla riconciliazione)

`prova_quote.mjs` su tutte le 19 regioni, con i dati pubblicati e con gli originali (`quote_opere/scalini_carreggiate_*.txt`):

| | Prima | Dopo |
|---|---|---|
| Punti di sovrapposizione controllati | 113 866 | 113 866 |
| Scalini > 5 cm | **202** (0,18 %) | **202** |
| Scalino massimo | 2,74 m | 2,74 m |
| Nodi con quote diverse (0,02–0,03 m) | 10 | 10 |

Distribuzione: R_2712_1074 78, R_2712_1090 40, R_2696_1090 23, R_2712_1106 15, R_2664_1106 9, R_2712_1122 9, R_2680_1154 7, il resto 0–5. I più alti (2,5–2,7 m) sono in R_2664_1106 (2,74 m), R_2712_1074 (2,70 m), R_2712_1090 (2,61 m) e R_2696_1090 (2,49 m). **[I, causa non verificata]** Probabilmente carreggiate di strade diverse a livelli diversi che il test considera sovrapposte (soglia di 3 m). **Preesistenti e invariati dalla riconciliazione.** Non corretti.

La prova esce con codice 1 per questi scalini: è un limite noto, non un errore della riconciliazione.

---

## 3. PROBLEMA APERTO introdotto (o possibile) dalla riconciliazione: reti ramificate di ponti (svincoli)

Questo è emerso nell'analisi e **non era nel report precedente**.

**[M] Osservazione.** Per 61 opere il cambio di quota supera 3 m (`quote_opere/opere_con_cambio_oltre_3m.json`). In diverse reti con **più rami e giunzioni** (svincoli) la riconciliazione ha portato **tutta la rete a un unico piano**, dedotto dalla retta tra gli ingressi veri:
- **Svincolo di Monte Carasso (R_2712_1106, ~LV95 2721050/1116740):** 13 tratti di soli ponti con cambio superiore a 3 m; prima stavano a terreno (224,3–224,8 m; un ramo a 216,8 m dove il terreno è a 216,6 m), ora **tutti a 231,4–231,5 m** (+6,9 m su terreno piano, +14,7 m sul ramo basso). Nessun capo libero a terra. Immagini prima/dopo in `quote_opere/lugano_nord_*.png`: la rampa e il cavalcavia cambiano molto.
- **Viadotto Brogeda / Chiasso (R_2712_1074):** capi da 216,9 m a 229,5 m (+12,7 m), terreno a 216,7 m.
- **Autostrada A2 / viadotti della Biaschina (R_2696_1122, R_2712_1122):** fino a **+60 m** (capo da 485,7 a 546,3 m con terreno a 455,5 m, poi 512,7 m dall'altra parte).
- **Tangenziale di Varese (R_2712_1074):** +5,2 m. **A2 in R_2712_1106 (~2717680/1112105):** +18 m.

**[I] Non so dire quali siano migliori della versione precedente.** Alcune potrebbero essere plausibili (un cavalcavia che scavalca l'A2 deve stare sopra l'autostrada; i ponti che prima stavano esattamente a quota terreno erano forse sbagliati), altre no (un'intera rampa su un piano unico, un capo che dovrebbe stare a terra e invece è 15–60 m più in alto). **Manca la verità di riferimento**: non c'è un'altra fonte di quote dell'impalcato nei dati. Il controllo dei confini (0 punti > 1 m) è soddisfatto in ogni caso; la plausibilità della forma no.

**[M] Non rilevati altri scalini nuovi nei punti in comune:** solo 14 punti condivisi con scalino nuovo > 0,5 m (3 sopra 1 m): Via Rovedo / A13 a Locarno (10,8 m), Galleria Mappo Moretti / Via del Sole (3,8 m), Viadotto Biaschina (0,94 m).

**Effetto sulle misure del gioco [M]:** in R_2712_1106 la pendenza massima rilevata da `prova_quote` passa da 2,97 a 4,31 e lo spigolo da 3,16 a 4,28 (raccordi autostradali `motorway_link` dello svincolo). È l'unica regione in cui le metriche cambiano.

**Rischio.** I pacchetti riconciliati sono **già pubblicati** nella pre-release `ticino-completo-dati` e li scaricano anche 0.15.5, 0.15.6 e 0.15.7. Il miglioramento (0 punti > 1 m tra regioni, prima 2 419) è certo; la qualità di queste ~10 reti ramificate è incerta.

**Opzioni (decisione tua):**
1. **Tenere** i dati pubblicati e segnare le reti come da rivedere (nessun intervento).
2. **Escludere le reti ramificate** dalla riconciliazione (riscrivere solo le reti a catena semplice: ponti e gallerie singoli come il San Gottardo) e ripubblicare i pacchetti: si perderebbe la riconciliazione delle reti ramificate, che sarebbero di nuovo diverse tra regioni dove attraversano un bordo (Biaschina).
3. **Tornare agli originali** (SHA-256 e copia sicura già pronti: artefatto `originali-pubblicati`, 90 giorni, e `pubblicato_prima_sha256.txt`).
4. **Indagare** con un criterio di verità (per esempio le quote dell'impalcato da swisstopo swissTLM3D o dal modello di superficie) prima di decidere.

**Non ho ripubblicato né fatto marcia indietro**: la tua autorizzazione copriva la pubblicazione dei 16 pacchetti riconciliati, non una seconda modifica.
