> **Superato: vedi `REPORT_BUILD_E_DATI_0.16.0.md` (report valido e unico). Aggiornamento precedente: `REPORT_FASE_FINALE_0.16.0.md`** (rigenerazione dati, prove rifatte, stato del ramo). Le sezioni 2, 4, 7 e 8 qui sotto sono superate.

# Ticino completo + Fasi 2–4 → 0.16.0: report di validazione

**La 0.16.0 NON è pubblicata e NON è dichiarata completa.** Nessun tag, nessuna GitHub Release. Tutte le misure sono in **grafica software** (CPU, SwiftShader): gli FPS non dicono nulla di un PC o Mac vero. Nessuna prova su GPU hardware, su Windows o su Mac.

Legenda: **[M]** misurato qui · **[S]** stima di calcolo · **[–]** non fatto/non misurato.

## 1. Attività completate
| Attività | Dove |
|---|---|
| Merge di `main` (0.15.5, Ticino completo dei collaboratori) con le Fasi 2–4, conflitti risolti | commit `cf615ea`, `016050f` (storia riscritta dai metadati, vedi 7) |
| Foto HD 0,5 m per regione: `passo9` regionale e parallelo, pacchetto `hd_<regione>` facoltativo, download in secondo piano nel gioco | `tools/geo/passo9_foto_dettaglio.py`, `cantone.py`, `anteprima/regioni_main.js`, `regioni.js` |
| Tasselli HD generati con dati veri per tutte le 19 regioni (7 296 tasselli, 2,1 GB) **solo locali, non caricati** | – |
| Riconciliazione globale delle quote di ponti e gallerie tra regioni | `tools/geo/riconcilia_opere.py` (+ passo nel workflow) |
| LOD lontano: sagome delle città e strade principali tra i dettagli e la nebbia | `anteprima/src/lontano.js`, profili in `impostazioni.js` |
| Download dei pacchetti con **ripresa** (HTTP Range) e controllo di integrità | `anteprima/regioni_main.js` |
| Verifica automatica di tutto il cantone | `tools/geo/verifica_cantone.py` |
| Analisi pacchetti HD, procedura per il PC Windows | `ANALISI_PACCHETTI_HD.md`, `PROVA_WINDOWS_GPU.md` |
| Workflow dati e release aggiornati (**non eseguiti**) | `.github/workflows/` |

## 2. Testato e superato [M]
| Prova | Risultato |
|---|---|
| `verifica_cantone.py` su 19 regioni (dati dopo la riconciliazione) | **11 controlli su 11 OK**: 0 punti senza terreno/foto; strade 100 % combacianti; terreno nelle sovrapposizioni media 0,008 m (max 1,4 m ai bordi); strade normali media 0,005 m; **ponti/gallerie nei punti in comune: 0 su 47 252 con scarto > 1 m (max 0,3 m)**, prima 3 494 con scarto fino a 31,8 m |
| Riconciliazione in modalità pacchetti (apre i `.tar.gz`, riscrive solo `strade.json`, richiude) | il `strade.json` risultante è identico a quello della modalità su cartelle (2 regioni confrontate byte per byte) |
| Plausibilità dopo la riconciliazione | gallerie corrette: 12 445 vertici, **0** sopra il terreno; ponti: 4 543 vertici, **0** sotto il terreno; San Gottardo: discesa dritta da 1 147 m (Airolo) a 1 073 m su 16 km |
| `prova_ticino_regioni.mjs` (Electron dal sorgente, dati veri, server locale): avvio Locarno profilo Alta, partenza a Lugano con download regione, download HD in secondo piano e caricamento senza riavvio, preparazione della regione vicina a 1,5 km dal bordo, passaggio guidando (0 m di scarto), un solo terreno in memoria, nessun errore | **16/16** (eseguito prima del LOD e del nuovo download con ripresa: **da rifare** con il codice attuale) |
| `prova_ripresa_download.mjs`: connessione che cade a metà → riparte da `Range`; server senza Range → da zero; 404 leggibile; pacchetto troncato rifiutato | **7/7** |
| `prova_tutte_regioni.mjs` (profilo Media, pagina nuova per regione, dati riconciliati): **tutte le 19 regioni** partono senza errori, moto sulla strada, nessun NaN | **19/19** (caricamento 14,6–67 s, 3,0–4,2 M triangoli, 199–2 402 chiamate) |
| `prova_quote.mjs` (quote strade, edifici sull'asfalto) sulle 19 regioni | 0 edifici sull'asfalto; 10 nodi con quote diverse (sotto) |
| `prova_luoghi.mjs` | OK |

### Nodi stradali con quote diverse (10) [M]
Indagati: 9 differiscono di 0,02–0,03 m (arrotondamenti nei nodi condivisi, A2 e un nodo in Val Bedretto); **1** di 0,91 m a una testa di ponte (Via Europa, Ponte Tresa). Non corretti: sono sotto la soglia del test (3 m) e non visibili.

### Benchmark: build unito contro 0.15.5 [M, grafica software]
Stesso computer (4 core, 16 GB), regione di Locarno, 800×450, 40 s per profilo, 1 esecuzione per profilo (rumorosa: i picchi p95 dipendono dalla CPU condivisa). `benchmark_software/`.
| Profilo | FPS 0.15.5 → 0.16.0 dev | Chiamate | Triangoli | Caricamento |
|---|---|---|---|---|
| Bassa | 0,7 → 0,7 | 981 → 996 (+1,5 %) | 2,99 → 3,03 M (+1,3 %) | 20,1 → 25,1 s |
| Media | 0,7 → 0,5 | 1 597 → 1 701 (+6,5 %) | 3,70 → 3,91 M (+5,7 %) | 18,8 → 30,5 s |
| Alta | 0,3 → 0,4 | 1 791 → 1 893 (+5,7 %) | 4,57 → 4,79 M (+4,8 %) | 22,6 → 27,0 s |
| Ultra | 0,4 → 0,3 | 1 789 → 1 897 (+6,0 %) | 4,81 → 5,03 M (+4,6 %) | 24,0 → 31,7 s |
Memoria JavaScript con spazzatura liberata (Lugano/Mendrisiotto, Media): **577 / 755 MB contro 478 / 601 MB** della 0.15.5 (+21 % / +25 %); caricamento 37,5 / 63,4 s contro 34,1 / 53,6 s. (Senza liberare la spazzatura la misura è molto più alta e inaffidabile: 2–3 GB.)
**Lettura onesta:** il build nuovo è un po' più pesante (circa +5 % di chiamate e triangoli, +100–150 MB di heap JS, caricamento più lungo). È coerente con le funzioni aggiunte (incroci, erba, HD, LOD lontano) ma **non so quanta parte sia "ingiustificata"**: gli FPS software non rispondono. Il giudizio sulle prestazioni spetta alla prova su GPU vera.

### LOD lontano [M, software]
Lugano, punto di vista a 7 km, stesso stato del terreno, acceso/spento: Bassa spento per profilo; Media +3 chiamate, +0,7 k triangoli (58 sagome); Alta +3 / +2,5 k (205); Ultra +22 chiamate / +15 k triangoli / +343 sagome; 80 836 vertici di strade principali (1 chiamata); nessun errore. **L'effetto visivo non è dimostrato**: nelle immagini di prova le sagome non si distinguono dagli edifici veri e dalla nebbia (la fascia utile è ~0,4–4 km, oltre il limite degli edifici veri a 6,5 km e prima della nebbia a 7–11 km).

## 3. Da testare sul tuo PC Windows (nessun risultato esiste) [–]
Procedura in `PROVA_WINDOWS_GPU.md`. Servono: benchmark per profilo con GPU, VRAM reale, confronto con la 0.15.5, giudizio visivo su LOD lontano e su WebP/JPEG delle foto HD, download reale da GitHub, build Mac/Windows impacchettato, rifare `prova_ticino_regioni.mjs` con il codice attuale. **Non dichiarare superata questa prova senza un risultato vero.**

## 4. Problemi geografici
**Risolto (nei dati locali, non ancora nei dati pubblicati):** le gallerie e i ponti che attraversano il bordo di una regione avevano quote diverse nelle due regioni (3 494 punti con scarto > 1 m, fino a 31,8 m; il "52 m" detto prima contava anche strade sopra/sotto le opere nello stesso punto, ora confrontate per tipo). **Causa**: il passo 7 calcola la linea dritta tra gli ingressi sul pezzo ritagliato dalla regione e tratta il taglio come un ingresso; in più nelle reti di gallerie (San Gottardo e cunicoli) le giunzioni venivano agganciate al terreno in superficie. **Soluzione unica per tutta la pipeline** (`riconcilia_opere.py`): si ricostruiscono le opere intere unendo i pezzi di tutte le regioni; gli ingressi veri sono i capi non sul bordo dei dati; la **linea principale** (percorso più lungo tra ingressi) decide le quote delle giunzioni e i rami laterali si adattano; poi ponte mai sotto il terreno e galleria ≥ 7 m sotto (rampa 80 m dagli ingressi), liscio come nel passo 7; **una sola quota per vertice** in tutte le regioni. Non forza niente sul terreno. Tocca 36 reti (110 segmenti, 10 170 vertici, 16 regioni); il resto è invariato.
**Ancora presente:**
- I dati **pubblicati** hanno ancora le quote vecchie: serve rilanciare il workflow dati (passo nuovo nel job `pubblica`, che ora scarica anche le regioni non rifatte). **Non eseguito.**
- Fedeltà: la regola nuova ricostruisce le quote con il terreno a 4 m (`terreno.bin`), il passo 7 usava quello a 2 m; per le 36 reti corrette le quote possono differire di qualche decimetro dal calcolo del passo 7 (non misurato opera per opera). Un ponte o una galleria che ha una copertura determinata dal terreno vicino a un lago può cambiare più di un metro.
- Dove il capo di un'opera è tagliato dal limite dei dati scaricati (per esempio il lato nord del San Gottardo) la quota resta piatta da quel lato, come prima, ma uguale in tutte le regioni.
- 1 testa di ponte con 0,91 m di scalino (Via Europa); 47 gruppi di strade staccati dalla rete (0,66 % dei km); elementi fatti a mano solo in Verzasca.
- Al passaggio di regione c'è ancora un ricaricamento della pagina (non un mondo unico).
- Non verificato **visivamente** il passaggio su un ponte o dentro una galleria lunga in nessuna regione (verificati solo i numeri).

## 5. Pacchetti HD: decisione tecnica consigliata
(Dettagli in `ANALISI_PACCHETTI_HD.md`.) 2 108 MB in 19 pacchetti (7–249 MB). Compressione: −8 % senza perdita, −31 % con WebP q70 (qualità non verificata a occhio). GitHub Releases: file fino a 2 GiB, `Range` funzionante (206 misurato). **Consiglio:** non renderli obbligatori e non caricarli ora; dopo la prova su PC vero, caricarli come `hd_R_*.tar.gz` ricompressi senza perdita nella pre-release dei dati (facoltativi, in secondo piano, ora con ripresa); come passo successivo un archivio per regione con indice e richieste `Range` per scaricare solo i tasselli vicini. **Non caricati.**

## 6. LOD e vegetazione
Fatto: sagome delle città (celle da 250 m: superficie, altezza e base medie, un solo InstancedMesh) e strade principali come linee (spente dallo shader dove ci sono le strade vere); attivi in Media/Alta/Ultra, spenti in Bassa; si ricalcolano ogni 120 m. Già presente e non modificato: edifici a pezzi da 500 m costruiti entro min(vista, 6 km)+500 m e scaricati oltre +1,2 km; strade a pezzi da 1 km; foto 2 m per profilo con scarico; foto HD 2×2 con dissolvenza.
**Non fatto:** LOD della vegetazione (oltre 0,45–1,6 km gli alberi sono solo colore del terreno: una chioma a bassa definizione costerebbe chiamate e triangoli non misurati); città delle regioni vicine (oltre il bordo si vede solo il rilievo); distanza di rendering configurabile dall'utente (resta per profilo).

## 7. Stato del ramo remoto
`origin/claude/brave-turing-mztbtd` = `e24f508` + questo report. Per consentire il push ho riscritto autore e committer dei **10 commit locali non ancora pubblicati** (tutti già con la stessa identità sul remoto dopo il push; nessun commit pubblicato è stato riscritto; backup locale `backup-prima-riscrittura-autori`). **Errore mio:** i commit `0075b5c`, `a947158`, `874ea9f` sono stati pubblicati con la tua email come autore/committer (le variabili d'ambiente prevalgono sulla configurazione); da `fd709c9` in poi l'identità è `Claude <noreply@anthropic.com>`. Correggerli richiede un force-push che non ho fatto.
`main` non è toccato; nessun tag.

## 8. Stato della preparazione alla 0.16.0
**Codice: pronto per essere provato su una GPU vera; release: NON pronta.** Mancano:
1. Prova su PC Windows con scheda video (prestazioni, VRAM, confronto con la 0.15.5) e giudizio sul costo di +5 % chiamate/triangoli.
2. Rilancio del workflow dati con la riconciliazione e verifica dei dati pubblicati con `verifica_cantone.py`.
3. Rifare le prove Electron (`prova_ticino_regioni.mjs`) con il codice attuale e provare il download reale da GitHub, il build Mac/Windows.
4. Decisione sui pacchetti HD (consigliata dopo il punto 1).
5. Decisione sull'autore dei tre commit pubblicati con la tua email.
6. Rivedere visivamente LOD lontano e passaggi su ponti/gallerie.
