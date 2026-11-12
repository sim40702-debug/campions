# Ticino completo + Fase 4 → 0.16.0 (in preparazione, NON pubblicata)

Ramo `claude/brave-turing-mztbtd`. Nessun push, tag o release fatto in questa attività.
**Tutte le misure sono senza scheda video** (grafica software SwiftShader): gli FPS non dicono nulla di un PC o Mac vero. Nessuna prova su Mac/Windows veri.

## 1. Il lavoro dei collaboratori (trovato)
Era già su `origin/main` (0.15.5) e nel ramo `feature/ticino-completo`, autori Simone e nathansalvade:
- **Valle Verzasca** (0.15.0–0.15.2): rustici in sasso, diga di Contra, strade/ponti/muri secondo OSM, area 16×32 km.
- **Ticino completo** (0.15.3–0.15.5, sprint T1): `tools/geo/cantone.py`, `src/regioni.js`, `regioni_main.js`, `src/cantone.js`, `src/sfondo.js`; edifici e strade costruiti a pezzi vicino alla moto (BUG-009); mappa del cantone (tasto K); montagne lontane.
- **Dati veri** nella pre-release `ticino-completo-dati`: 19 regioni da 24×24 km (cuore 16 km + 4 km di margine), 1,93 GB, terreno swissALTI3D (griglia 3,94 m), foto SWISSIMAGE a 2 m, strade/edifici/laghi/fiumi OSM (ODbL). Nessun dato sintetico.

## 2. Analisi tecnica (misurata da me, `tools/geo/verifica_cantone.py`, risultati in `verifica_cantone.json`)
Scaricate e controllate tutte le 19 regioni.
| Controllo | Esito |
|---|---|
| 19 regioni presenti, file completi, `terreno.bin` della grandezza giusta, foto 2 m di ogni pezzo che tocca il cantone | OK |
| Area del confine (griglia 100 m) | 2 814,9 km² (dichiarati 2 812,2) |
| Punti del cantone senza terreno vero / senza foto 2 m | 0 / 0 |
| Punti fuori da ogni cuore | 1 cella da 100 m (E 2728050, N 1084550), dentro l'area di una regione: il gioco usa il margine, non è un buco |
| Cuciture del terreno (50 coppie, 639 485 punti, esclusi 300 m dal bordo) | media 0,008 m, 99,9 % sotto 0,5 m, max 1,4 m |
| Cuciture delle strade: punti in comune | 100 % (1 578 057 punti) alla stessa posizione |
| Quota delle strade normali nei punti in comune | media 0,005 m, 99,9 % sotto 0,46 m, max 7,3 m |
| Edifici nella sovrapposizione | 255 722 / 255 721 |
| **Limite noto**: ponti e gallerie lunghi tagliati dal bordo regione | 3 561 punti su 47 252 con scarto > 1 m, fino a 52,8 m (tunnel del San Gottardo, gallerie Verzasca). Causa: la quota è interpolata sulla parte di opera dentro la regione. Non corretto (richiede di rifare il passo 7 su tutte le regioni). Al passaggio la moto si rimette sulla strada della regione nuova. |

## 3. Cosa è stato integrato/modificato
- Merge di `main` (0.15.5) nel ramo Fasi 2–4: conflitti risolti in `NOTE_RELEASE.md`, `package.json`, `gioco.js`, `interfaccia.js`, `opere.js`, `strade.js`, `stile.css` (commit `fe83593`, `a11eb64`). Mantenute le funzioni di entrambe le parti (tombini Fase 4 dentro la costruzione a pezzi di T1).
- **Foto HD 0,5 m per regione**: `passo9_foto_dettaglio.py` ora accetta `MRW_CARTELLA_DATI`, lavora in parallelo (6 thread, ritenta 3 volte) e nelle regioni fa solo cuore + 2 km. `cantone.py chiudi` crea il pacchetto **facoltativo** `hd_<regione>.tar.gz` (non allarga il pacchetto base). Il gioco lo scarica **in secondo piano** solo con Media/Alta/Ultra (`regioni_main.js`, IPC `regioni-scarica-hd`, `regioni.js: richiediFotoHD`), lo controlla (indice + tutti i tasselli), lo carica senza riavviare. Senza pacchetto/internet non cambia nulla.
- Workflow `ticino-completo.yml` (passo 9 per regione, pacchetti HD pubblicati) e `release-anteprima.yml` (Locarno con HD nell'app). **Non eseguiti.**
- Nessuna seconda pipeline geografica: stessi passi 1–9 e stesse coordinate LV95.

## 4. Copertura
Tutto il cantone (19/19 regioni, 0 km² di terreno senza dati dentro il confine). Per Locarnese, Vallemaggia, Bellinzonese/Tre Valli, Luganese, Mendrisiotto, Leventina, Blenio, Riviera, Malcantone e zone montane i dati reali ci sono (vedi `stato.json`: 5 719 km di strade nei cuori, 262 549 edifici).
**Foto HD generate qui con dati veri per tutte le 19 regioni: 7 296 tasselli, circa 2,0 GB** (da 1 MB a 239 MB per regione; Lugano 812 tasselli/239 MB, Locarno 673/189 MB, Mendrisiotto 713/175 MB; le regioni di confine con l'Italia ne hanno meno perché swisstopo non ha foto fuori dalla Svizzera). Sono file locali in questo container: **non sono stati caricati** nella pre-release.

## 5. Zone incomplete / non fatto
- Gli elementi fatti a mano (dighe, funivie, rustici) esistono solo dove c'erano già (Verzasca); altrove sono generati dai dati OSM.
- 47 gruppi di strade staccati dalla rete (0,66 % dei km, dati OSM, non inventati).
- **Nessun LOD semplice per città/strade lontane** (edifici oltre ~6 km e strade oltre ~4 km non si disegnano; resta il paesaggio di sfondo): non fatto.
- Mondo non unico: al passaggio di regione c'è un ricaricamento (la pagina si ricarica, stessa posizione).
- Quote di ponti/gallerie ai bordi regione (sopra).

## 6. Miglioramenti grafici/ottimizzazioni (Fasi 2–4, ora in ogni regione)
Incroci/rotonde/raccordi, frecce `turn:lanes`, foto HD con dissolvenza, foto 2 m per profilo (raggio 3/4,5/6/8 km) con scarico delle lontane, ombre stabili, erba/vegetazione bassa, banchine e cemento dei ponti, atmosfera e fogliame. Dal lavoro T1: edifici/strade a pezzi, mappa grande fluida. I dettagli di ciascuna fase sono nei rispettivi report (`fase2/`, `fase3/`, `fase4/VRAM_STIME.md`).

## 7. Test eseguiti
| Test | Risultato |
|---|---|
| `verifica_cantone.py` sulle 19 regioni | 10 controlli OK, 0 fallimenti, 1 limite noto (sopra) |
| `prova_quote.mjs` (quote strade, edifici sull'asfalto) sulle 19 regioni con il `strade.js` unito: 67 555 strade, 527 702 edifici | edifici ancora sull'asfalto: **0**; nodi con quote diverse: **10** (in 5 regioni: 2680_1154, 2696_1090, 2696_1122, 2696_1138, 2712_1122/1138, non indagati); scalini max 2,7 m |
| `prova_luoghi.mjs` | OK |
| **Electron dal sorgente, dati veri, server locale con gli stessi pacchetti** (`prova_ticino_regioni.mjs`): avvio Locarno profilo Alta; partenza a Lugano con download regione (107 s); download HD in secondo piano, apertura e controllo, HD caricati senza riavvio (4 tasselli in memoria); preparazione della regione nord a 1,5 km dal bordo e passaggio guidando a R_2712_1106 nello stesso punto (0 m), un solo terreno in memoria; nessun errore in console | **16 prove riuscite, 0 fallite** |
| Benchmark profili (Fase 4, ramo **prima** del merge, 800×450, 60 s, software) | Bassa 0,8 fps / 11 s; Media 0,5 / 16 s; Alta 0,5 / 14 s; Ultra 0,3 / 16 s; heap JS 150–163 MB; confronto utile solo tra versioni, non FPS veri |

**Non misurato**: benchmark per profilo sul build **dopo** il merge; VRAM reale (`VRAM_STIME.md` sono stime di calcolo); prestazioni su GPU; scaricamento da GitHub vero (provato solo con un server locale); build Mac/Windows impacchettato; screenshot nuovi oltre a `lugano_alta*.png` e `dopo_passaggio.png` del test (non copiati nel repo).

## 8. Problemi e limiti
Vedi sezioni 2 e 5. Inoltre: il pacchetto HD ha dimensioni elevate (fino a 239 MB per regione, ~2 GB in tutto): il caricamento di tutte le regioni HD su GitHub è una decisione tua (spazio e tempo di download).

## 9. Commit
Ramo `claude/brave-turing-mztbtd`, 20 commit locali non pubblicati sopra `origin/claude/brave-turing-mztbtd` (82daa0a): ultimo `bce4fca`; merge `fe83593`, `a11eb64`. I commit hanno l'email dell'utente come committer (GitHub li mostrerebbe "Unverified": da sistemare prima del push).

## 10. Stato per la 0.16.0
Pronto nel codice e provato in Electron (dati veri, grafica software). Per pubblicare restano: (1) benchmark per profilo del build unito e prova su un PC/Mac vero; (2) decisione sul caricamento dei pacchetti `hd_*` (2 GB) e sul rilancio del workflow dati; (3) sistemare l'autore dei commit e fare il push; (4) alzare/confermare la versione (`package.json` e `gioco.js` sono già 0.16.0) e aggiornare i testi. Tag e release non creati.
