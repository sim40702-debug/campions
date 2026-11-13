# 0.16.0 — fase finale di validazione: report aggiornato (13/11/2026)

**La 0.16.0 NON è pubblicata e NON è dichiarata completa.** Nessun tag, nessuna release creata o modificata, nessun pacchetto HD caricato, release 0.15.x intatte. Tutti gli FPS e i tempi sono in **grafica software** (CPU): non valgono per un PC vero. **Prova GPU Windows: non eseguita** (nessun risultato tuo).

Legenda: **[M]** misurato in questa sessione · **[–]** non fatto.
Sostituisce, per i punti qui trattati, le sezioni 2, 4, 7 e 8 di `REPORT_TICINO_0.16.0.md`.

## 1. Commit e identità Git
- I tre commit `0075b5c`, `a947158`, `874ea9f` restano come sono (nessun force-push, nessuna riscrittura).
- Variabili d'ambiente `GIT_AUTHOR_*`/`GIT_COMMITTER_*` presenti nella sessione con la tua email: **le sovrascrivo esplicitamente a ogni commit** con `Claude <noreply@anthropic.com>` e controllo `git log -1 --format=fuller` prima del push. Verificato sul commit `978f640` (autore e committer corretti).

## 2. Cosa avrebbe fatto il workflow (controllo prima di lanciarlo) e cosa ho fatto
Controllo prima dell'esecuzione: lanciare il workflow esistente con `dati=true` avrebbe
- rifatto da OpenStreetMap **tutte** le 19 regioni, **creando anche le foto HD** e **caricandole** (`cp hd_*.tar.gz` nel job `pubblica`) → vietato;
- fatto partire `app` e `release` → pre-release dell'app **con tag** → vietato;
- sovrascritto (`--clobber`) i pacchetti della pre-release `ticino-completo-dati`, che le release già pubblicate (0.15.5 e anche 0.15.6 e 0.15.7, uscite dopo l'ultimo allineamento del mio ramo) scaricano a runtime.

Per questo ho aggiunto al workflow una modalità dedicata (commit `978f640`): **`solo_riconcilia`**. Scarica i pacchetti già pubblicati (sola lettura), esegue `riconcilia_opere.py`, le 11 verifiche **prima e dopo**, salva i risultati come artefatto. `osm`, `regione`, `pubblica`, `app`, `release` restano **saltati**; il passo di caricamento nella pre-release è spento di default (`pubblica_riconciliati=false`) e, se acceso, carica solo `regione_R_*.tar.gz` modificati, mai `hd_*`.

**Run:** [#5, id 43385897633](https://github.com/sim40702-debug/swissgass/actions/runs/43385897633), ramo `claude/brave-turing-mztbtd`, ~4 minuti, esito *success*.
Generato/aggiornato: **solo** l'artefatto `riconciliati` (16 pacchetti `regione_R_*.tar.gz` riscritti + 3 non modificati, verifiche e impronte; 1,9 GB, scade dopo 7 giorni). **Nessuna release toccata.**

**Dati pubblicati nella pre-release `ticino-completo-dati`: NO, ancora le quote vecchie.** Vedi punto 8: serve una tua conferma.

## 3. Risultati dei dati geografici [M]
| Controllo | Risultato |
|---|---|
| Riconciliazione in CI | 36 reti (110 segmenti), **10 170 vertici in 16 regioni**; scarto massimo prima 197,3 m (galleria del San Gottardo) |
| `verifica_cantone.py` in CI, dopo | **11 controlli su 11 OK**, 0 attenzioni |
| Ponti/gallerie nei punti in comune (47 252 punti) | **0 con scarto > 1 m**, massimo 0,3 m |
| Rigenerazione locale indipendente (dai pacchetti pubblicati originali) | stessi numeri; **19 su 19 `strade.json` identici byte per byte** a quelli della CI (impronte in `strade_sha256_riconciliate.txt`) |
| Verifica con script indipendente (`tools/geo/verifica_opere_indipendente.py`, non usa il riconciliatore) | **dopo:** ponti 14 496 punti in comune, **0** > 1 m (max 0,29 m); gallerie 9 372, **0** > 1 m (max 0,10 m). **Prima (pacchetti pubblicati):** ponti **588** > 1 m (max 60,0 m); gallerie **1 831** > 1 m (max 27,8 m) |
| **San Gottardo** (R_2680_1154, 16 489 m) | da 1 146,6 m (Airolo) a 1 072,6 m; **nessun tratto in salita**, salto max 0,25 m tra vertici; copertura minima 25 m lontano dagli ingressi; la galleria vicina in R_2680_1138 (4 903 m) rientra nel controllo globale (scarto max di tutte le gallerie 0,10 m) |
| Altre opere che attraversano i confini | tutte le 36 reti riconciliate rientrano nel controllo "0 punti > 1 m" |
| Continuità tra regioni | strade: 100 % dei punti in comune presenti in entrambe (1 578 057); terreno 0,008 m medio, max 1,4 m; edifici 255 722 / 255 721 |

### Limiti dichiarati (non nascosti)
- **Il "0 sopra/sotto il terreno" del report precedente non regge a una soglia di 0,5 m.** Lo script indipendente trova 493 vertici di galleria sopra il terreno (3 oltre 10 m, max 19,5 m) e 455 di ponte sotto il terreno (max 8,3 m) con terreno a 4 m. **Non sono una regressione**: nei pacchetti pubblicati erano 513 e 601. Sono soprattutto gli ingressi/rampe in forte pendenza e il campionamento a 4 m. Non li ho corretti.
- San Gottardo: lato nord tagliato dal limite dei dati: quota piatta da quel lato, ma uguale in tutte le regioni.
- Un tunnel/ponte con copertura determinata dal terreno a 4 m invece di 2 m può differire di qualche decimetro da quanto calcolato dal passo 7 (non misurato opera per opera).
- Il **giudizio visivo** del passaggio su ponti e gallerie lunghe resta **non fatto** [–].

## 4. Test sul codice aggiornato [M, grafica software, dati riconciliati]
Nessun risultato precedente è stato riutilizzato: tutto rieseguito (codice `anteprima/` del ramo, dati riconciliati e HD locali).

| Prova | Risultato |
|---|---|
| 11 controlli geografici (`verifica_cantone.py`) | **11/11** (locale e CI) |
| `prova_ticino_regioni.mjs` (Electron, dati veri, server locale) | **16/16**: avvio Locarno profilo Alta (51 s), partenza a Lugano con download regione (82 s), **download HD in secondo piano** e caricamento senza riavvio (raggio 215, 4 tasselli in memoria), preparazione della regione vicina a 1,5 km dal bordo, **passaggio guidando (0 m di scarto)**, un solo terreno in memoria, **nessun errore in console** |
| `prova_ripresa_download.mjs` | **7/7**: caduta a metà → riparte da `Range`; senza Range → da zero; 404 leggibile; pacchetto troncato rifiutato; SHA-256 identico |
| `prova_tutte_regioni.mjs` (profilo Media, pagina nuova per regione) | **19/19**: 0 errori, 0 NaN, moto sulla strada in tutte; caricamento 13,1–59,2 s; 218–2 447 chiamate; 2,26–4,17 M triangoli; 41–126 texture |
| Memoria JS con GC forzata, 19 regioni | **339–755 MB, mediana 412 MB**. Confronto con la misura precedente: Mendrisiotto 755 MB (era 755), Lugano 573 MB (era 577); 0.15.5: 601 / 478 MB → **+25 % / +20 %, invariato rispetto a prima** |
| `prova_quote.mjs` (Locarno, Lugano, Gottardo) | 0 edifici sull'asfalto; nodi e scalini **identici prima e dopo** la riconciliazione (nessuna regressione); gli "scalini" tra carreggiate sovrapposte (3 a Locarno, 40 a Lugano, max 2,6 m) sono **preesistenti** e fanno uscire la prova con codice 1: non causati da questa modifica e non risolti |
| `prova_luoghi.mjs` | OK (134 luoghi) |
| LOD lontano, Lugano, 4 profili | **0 errori**; sagome 0 / 58 / 205 / 343 e 80 836 vertici di strade **identici** alla misura precedente. Differenza di chiamate acceso/spento: Bassa +57 con LOD **spento** (rumore di streaming), Media +12, Alta +28, Ultra +58: **non distinguibile dal rumore**; nessuna regressione rilevata, costo del LOD non misurabile con precisione in software |
| Errori in console | 0 in tutte le prove; le 22 richieste 404 sono foto aeree da 2 km fuori dal cantone (Italia, nessuna foto swisstopo), attese |

Risorse caricate (Media): geometrie 205–636, texture 41–126; scaricamento dopo il cambio regione verificato (un solo terreno in memoria).

## 5. Pacchetti HD
Mantenuti i 2,1 GB **solo locali, non caricati**. Resta facoltativo e in background; il download a tasselli con richieste `Range` rimane un miglioramento da valutare, non blocca. Conseguenza per la tua prova: **senza pacchetto HD sul tuo PC il costo delle foto 0,5 m su GPU non sarà misurato** (vedi `PROVA_WINDOWS_GPU.md`, punto 1).

## 6. Procedura Windows
`PROVA_WINDOWS_GPU.md` riscritto: build/ramo da usare, avvio, selezione profili, scenari (benchmark interno, corsa misurata, confronto con 0.15.5, LOD, passaggio regione, San Gottardo, ponti), metriche, criteri proposti, come salvare il report, tabella per distinguere problemi del gioco da limiti del rendering o dei driver.
**Attenzione:** in gioco, le regioni diverse da Locarno si scaricano dalla pre-release, che ha ancora le **quote vecchie**: per provare gallerie e ponti corretti serve promuovere i pacchetti (punto 8) oppure usare `MRW_URL_PACCHETTI` con un server locale (spiegato nel documento).

## 7. Stato del ramo
`origin/claude/brave-turing-mztbtd`. `main` non toccato; nessun tag. **Nota:** su `main` sono uscite nel frattempo le release 0.15.6 e 0.15.7 che il mio ramo non contiene: prima della 0.16.0 servirà un nuovo merge di `main` (non fatto, fuori dall'ambito).

## 8. Stato e decisioni che servono da te
Release **non pronta**. Da fare, nell'ordine che hai indicato:
1. **Dati geografici aggiornati — pronti, non pubblicati.** I pacchetti riconciliati sono nell'artefatto `riconciliati` del run 43385897633 (scade ~20/11/2026). **Decisione tua:** promuoverli nella pre-release `ticino-completo-dati`. Attenzione: quella pre-release è la stessa da cui scaricano le regioni anche le 0.15.5, 0.15.6 e 0.15.7 già pubblicate; il cambio tocca solo le quote di ponti/gallerie nel `strade.json` di 16 regioni (formato invariato), ma è un cambiamento visibile a chi usa quelle versioni. Ho gli originali con SHA-256 per tornare indietro. Se confermi, rilancio il workflow con `pubblica_riconciliati=true` (carica solo `regione_R_*` modificati, nessun HD, nessun tag).
2. Test automatici aggiornati e superati — **fatto** (punto 4). Da rifare dopo il merge con `main` 0.15.6/0.15.7.
3. **Test GPU reale sul tuo PC** — [–], con `PROVA_WINDOWS_GPU.md`.
4. Verifica finale del build unito (installer Mac/Windows) — [–]: il workflow attuale lo pubblicherebbe come pre-release con tag; serve una modalità "solo artefatto" e una tua autorizzazione.

Problemi noti non risolti: scalini preesistenti tra carreggiate sovrapposte (prova_quote), vertici di opere sopra/sotto il terreno (punto 3), 1 testa di ponte con 0,91 m di scalino (Via Europa), 47 gruppi di strade staccati dalla rete, LOD della vegetazione non fatto, ricaricamento della pagina al cambio regione.
