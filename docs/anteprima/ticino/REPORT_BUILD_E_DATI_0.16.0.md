# Moto Racing World 0.16.0 — report conclusivo (13/11/2026)

**STATO FINALE (13/11/2026, dopo la pubblicazione): la 0.16.0 è PUBBLICATA.** Release ufficiale: https://github.com/sim40702-debug/swissgass/releases/tag/anteprima-v0.16.0 (tag `anteprima-v0.16.0`, commit `266cdb8` di `main`). Autorizzazione dell'utente ricevuta dopo la **prova sul suo PC Windows, dichiarata «funziona tutto»**: l'esito è una dichiarazione dell'utente, **non sono state consegnate metriche** (FPS, VRAM, confronto con la 0.15.7), quindi **nessun numero di prestazioni su GPU è riportato in questo report**. Le sezioni qui sotto descrivono i test automatici eseguiti prima della pubblicazione (build di prova #3) e restano valide; dove parlano di «sospesa» o «non pubblicata» vale questo stato finale. Gli installer ufficiali (§6-bis) sono stati **ricostruiti** dal workflow di release e **non sono stati riprovati** come i file di prova: stesso codice (nessun file dell'app cambiato tra `b6ffe9a` e `266cdb8`), stesso processo di build, impronte diverse.

**Tag:** la release usa `anteprima-v0.16.0`, non `v0.16.0`: l'aggiornamento automatico dell'app legge `releases/latest` e toglie il prefisso `anteprima-v`; una release `v0.16.0` come «ultima» lo romperebbe per chi ha la 0.15.x. Il tag `v0.16.0` è creato come alias sullo stesso commit (vedi stato nel report finale in chat).

*Valutazione prima della pubblicazione (13/11, mattina): GO CON LIMITAZIONI sul piano tecnico; pubblicazione sospesa in attesa della prova GPU dell'utente.*

Documenti collegati (coerenti tra loro): `ANALISI_QUOTE_OPERE.md` (quote di ponti e gallerie), `PROVA_WINDOWS_GPU.md` (come provare sul PC), `SHA256_INSTALLER_0.16.0.txt` (impronte degli installer). I report `REPORT_FASE_FINALE_0.16.0.md` e `REPORT_TICINO_0.16.0.md` sono segnati come superati.

Legenda: **[M]** misurato con uno script/CI riproducibile · **[I]** interpretazione.

## 1. Versione e commit

| Cosa | Valore |
|---|---|
| Versione applicativa | **0.16.0** (`anteprima/package.json`, `VERSIONE` in `src/gioco.js`; l'app installata la riporta: Windows installato, Windows portatile, Mac arm64, Mac x64) |
| Ramo | `claude/brave-turing-mztbtd` (pubblicato, nessun force-push) |
| Commit da cui sono costruiti gli installer | **`b6ffe9a`** (build di prova #3). I commit successivi toccano solo documentazione e due report: nessun file dell'app. |
| Commit di partenza della sessione | `b182fc7` |
| Riferimento di sicurezza | ramo `sicurezza/prima-merge-main-0.15.7` = `8368aae` (locale e remoto); ramo `backup-prima-riscrittura-autori` (locale) intatto; nessun ramo eliminato |
| Nota sull'identità | Il commit **`0445120`** è stato pubblicato con autore e committer `carcifosupr3mo` (identità di ambiente) invece di `Claude <noreply@anthropic.com>`. Non è stato corretto perché richiederebbe riscrivere la storia pubblicata. Tutti i commit successivi hanno `Claude <noreply@anthropic.com>` sia come autore sia come committer. |

## 2. Dati geografici (v2) — stato definitivo, non modificati ulteriormente

- **Pubblicati nella pre-release `ticino-completo-dati`** dal workflow «Ticino completo» [run #8 (43426809247)](https://github.com/sim40702-debug/swissgass/actions/runs/43426809247), modalità `da_originali`: parte dagli originali verificati per SHA-256 (artefatto `originali-pubblicati`, 90 giorni), conserva i pacchetti v1 oggi sostituiti (artefatto `pubblicati-v1`, 90 giorni), controlla che i `strade.json` prodotti in CI siano **identici a quelli calcolati in locale (19/19)**, carica un file alla volta con riscaricamento e confronto.
- **[M] 7 pacchetti aggiornati su 79**: `regione_R_2664_1122`, `R_2680_1154`, `R_2696_1090`, `R_2696_1106`, `R_2712_1074`, `R_2712_1090`, `R_2712_1106`. Gli altri 72 asset sono invariati; **nessun `hd_*`**; nessun asset aggiunto o tolto. SHA-256 dei 79 asset: `pubblicato_dopo_v2_sha256.txt` (v1: `pubblicato_dopo_sha256.txt`; originali: `pubblicato_prima_sha256.txt`; `strade.json` v2: `strade_sha256_v2.txt`).
- **[M] SHA-256 verificati** in modo indipendente: i digest dell'API coincidono con il registro; i 7 pacchetti scaricati **anonimamente** (come fa il gioco) hanno l'SHA-256 atteso e sono archivi validi. `R_2664_1122` è tornato **identico, byte per byte, all'originale** (stesso SHA-256).
- **Monte Carasso ripristinato**: lo svincolo (2721099/1116737) è tornato com'era prima della riconciliazione; il confronto con swissSURFACE3D mostrava che la v1 lo peggiorava (errore mediano da −0,01 m a +3,53 m).
- **San Gottardo e Biaschina riconciliati**: la galleria principale del San Gottardo (14,5 km, copie discordanti fino a 197 m) e i due viadotti della Biaschina (salti fino a 61 m) restano riconciliati; per la Biaschina il confronto con swisstopo migliora (errore mediano da −7,2/−7,8 m a −3,0/−2,4 m).
- **Gotthardstrasse non più trascinata 222 m in basso**: il ramo di strada di superficie (507 m) e un raccordo (181 m) sono tornati agli originali; il cambio massimo della rete del Gottardo passa da 222 m a 28,5 m.
- **[M] Confini: 0 punti con scarto > 1 m su 47 252** punti di ponti e gallerie nelle sovrapposizioni (massimo 0,3 m). Prima della riconciliazione: 3 561 punti (CI). Le **11 verifiche del cantone: 11/11 OK** sui dati pubblicati (copertura 19/19 regioni, terreno senza buchi, 1 578 057 punti di strade in comune presenti al 100 %, edifici nelle sovrapposizioni 255 722 contro 255 721).
- Modifiche involontarie: confrontati gli originali con la v2, **cambia solo la `y` di vertici di ponti e gallerie in `strade.json`** (6 468 vertici; stesse chiavi, stesso `x`/`z`, stessa lunghezza); i membri diversi da `strade.json` di ogni pacchetto cambiato sono controllati dalla CI e identici a quelli pubblicati. Compatibile con 0.15.5/0.15.6/0.15.7 (usano la dimensione solo per la barra di avanzamento).
- **Dati territoriali e immagini**: presenti in tutte le 19 regioni (verifica 1 dei file: terreno della grandezza giusta e foto aeree da 2 km complete); le foto HD a 0,5 m **non sono pubblicate**.
- **Download e ripresa [M]**: prova di ripresa del download: passo superato nel run #3, `Range` → 206 (verificato in anonimo sulla release); passaggio da Lugano a R_2712_1106 guidando, la moto resta nello stesso punto (0 m), un solo terreno in memoria.

## 3. Reti ramificate (sintesi; dettagli in `ANALISI_QUOTE_OPERE.md`)

Causa: la v1 portava ogni rete ramificata a un'unica interpolazione tra pochi ingressi, anche dove i nodi di giunzione erano falsi. Regole della v2: (A) rete ramificata riscritta solo se le copie in regioni diverse discordano di ≥ 1 m; (B) tratto ripristinato se la pendenza su 20 m supera il 30 % e peggiora di oltre 10 punti. Risultato: 27 reti toccate (v1: 36), 6 468 vertici cambiati (v1: 10 170). Il codice è riproducibile: sugli originali la v1 rigenera **19/19** `strade.json` pubblicati il mattino byte per byte, la v2 è deterministica (19/19). **Non ho potuto dimostrare la forma corretta** delle reti ramificate con swissTLM3D (nessuna quota Z accessibile): ho scelto la soluzione meno rischiosa dove manca la prova.

## 4. Build di prova #3 e test

Workflow «Build di prova (NESSUNA pubblicazione)» [run #3 (43427840083)](https://github.com/sim40702-debug/swissgass/actions/runs/43427840083), commit `b6ffe9a`: **5 job su 5 completati con successo**; l'esito di ogni test è stato letto dai log, non dedotto dal colore del job.

### Test superati [M] (grafica software: contano gli esiti, non gli FPS)
| Cosa | Esito |
|---|---|
| **Windows, installer NSIS** (installato in silenzio in `C:\mrw-prova`, avviato) | versione 0.16.0; profili Bassa/Media/Alta/Ultra + LOD: **17/17**; download di Lugano, passaggio di regione, memoria: **14/14**; 0 errori in console |
| **Windows portatile — interfaccia** (avviato come un utente con `--remote-debugging-port`, collegato alla finestra vera via CDP) | **12/12**: apre la porta in 15 s, versione 0.16.0, Locarno caricata in 55 s, profili **Bassa** (LOD spento, 0 sagome) e **Alta** (LOD attivo, 118 sagome) selezionati e salvati, il gioco continua a disegnare, 0 errori. Profili Media e Ultra non provati sul portatile. |
| **macOS arm64** (.dmg montato, copiato in /Applications, avviato) | versione 0.16.0; **17/17** e **14/14**; 0 errori |
| **macOS x64 su runner Intel nativo** (`macos-15-intel`, `uname -m` = x86_64, `lipo` conferma x86_64) | versione 0.16.0; **17/17** (LOD Ultra 208 sagome) e **14/14**; 0 errori |
| Controlli su Linux dai sorgenti | 11 verifiche del cantone **11/11**; ponti/gallerie indipendente: OK (0 punti > 1 m, galleria San Gottardo: 0 tratti in salita, salto massimo 0,25 m, copertura minima 25,3 m a > 150 m dagli ingressi); Electron dal sorgente con dati veri **14/14**; Locarno/Lugano/Gottardo **3/3**; profili/LOD **17/17**; download con ripresa e luoghi OK |
| Integrità degli artefatti | gli zip scaricati hanno gli SHA-256 dichiarati da GitHub; `unzip -t` senza errori; contenuto dell'app controllato in CI (dati, 11 file critici, tutti i `src/*.js`) |

### Test non superati
- **Nessuno nel run #3.** (Nel run #1 del mattino fallivano browser di Playwright, riassunti e portatile: corretti senza indebolire i controlli; vedi la storia dei commit.) Resta **informativa e con esito 1 per costruzione** la prova delle quote delle strade: 202 scalini preesistenti tra carreggiate (§7).

### Test non eseguiti o non conclusivi
- **Prova su scheda video vera (GPU), FPS, 1 % low, VRAM, aspetto dei profili:** **non eseguita** (§10).
- **Interfaccia del portatile** per i profili Media e Ultra; **portatile** su un Windows non-Server.
- **macOS su un Mac vero** (arm64 e Intel provati solo su runner di CI, in grafica software).
- **Giudizio visivo** su ponti, gallerie, LOD lontano, Biaschina, San Gottardo, lastra di Maccagno: non eseguito.
- **HD 0,5 m:** non pubblicati, quindi nessuna misura (costo GPU, WebP/JPEG).
- **Installer firmati / SmartScreen / Gatekeeper:** non firmati; non provato il comportamento degli avvisi.
- **Aggiornamento automatico** da 0.15.x a 0.16.0: non provato (richiede una release vera).
- **swissTLM3D 3D** e giunzioni degli svincoli: non verificabili qui (§3 e `ANALISI_QUOTE_OPERE.md`).

## 5. Prestazioni e compatibilità: 0.16.0 contro 0.15.7

Software SwiftShader su 4 core, Locarno, 800×450, 20 s per profilo, **stessa macchina e stessi dati** per le due versioni. Due giri indipendenti: run #2 (dati v1) e run #3 (dati v2). **Sono benchmark software: gli FPS non si riportano (0,5–0,9 in tutti i casi) e non dicono nulla di una GPU.** Tra due giri la variazione è dell'ordine di ±5 %.

| Profilo | Chiamate di disegno (run #3) | Triangoli (run #3) | Variazione chiamate nei due giri | Heap JS totale MB (run #3) | Caricamento s (run #3) | Programmi shader | Texture | Errori |
|---|---|---|---|---|---|---|---|---|
| Bassa | 960 → 982 (+2,3 %) | 2,95 → 3,01 M (+1,9 %) | −0,6 / +2,3 % | 438 → 524 | 22 → 25 | 41→52 | 99→72 | 0 |
| Media | 1602 → 1733 (+8,2 %) | 3,70 → 3,91 M (+5,9 %) | +6,2 / +8,2 % | 451 → 522 | 21,5 → 31,3 | 43→107 | 120→102 | 0 |
| Alta | 1766 → 1877 (+6,3 %) | 4,54 → 4,75 M (+4,7 %) | +5,1 / +6,3 % | 426 → 522 | 26,6 → 30,2 | 44→106 | 144→101 | 0 |
| Ultra | 1749 → 1679 (−4,0 %) | 4,71 → 4,63 M (−1,7 %) | +6,2 / −4,0 % | 488 → 627 | 29,8 → 34,3 | 43→105 | 153→91 | 0 |

- **Draw calls e triangoli:** fino a +8 % (soglia di allarme 15 %): **non è una regressione oltre soglia**, coerente con incroci, erba e LOD aggiunti.
- **Heap:** +70…+140 MB (software, regione di Locarno). Nella regione più fitta (Chiasso, R_2712_1074) già nel confronto con la 0.15.5 l'heap era 601 → 755 MB e il caricamento 53,6 → 63,4 s: **regressione di memoria e di tempo di caricamento reale ma contenuta**, da rivalutare sulla tua macchina.
- **Programmi shader:** da circa 43 a circa 106 nei profili Media, Alta e Ultra (+140 %): **possibile costo di compilazione al primo avvio / cambio profilo su GPU reale**. Non misurato.
- **Texture:** meno texture caricate (le foto a 2 m dipendono dal profilo); i profili Media/Alta/Ultra non includono HD perché i pacchetti non sono pubblicati.
- **Gestione della memoria:** prova di passaggio tra regioni: un solo terreno in memoria dopo il passaggio (la regione vecchia viene scaricata). Nessuna perdita di memoria misurata nelle prove, ma 20 s non provano la stabilità su sessioni lunghe.
- **Profili grafici e LOD:** i quattro profili si selezionano e restano salvati; il LOD è spento in Bassa e acceso in Media/Alta/Ultra (23/23/208 sagome a Locarno su Mac; 118 sulla Alta del portatile).
- **Regressioni funzionali rispetto alla 0.15.7:** nessuna trovata (0 errori in tutte le prove). `audio.js` (suono della SM 450 di 0.15.7) è identico a quello di `main`.

## 6. Installer DI PROVA (build #3, artefatti temporanei, scadono il **20/11/2026**, serve il login GitHub)

| File | Dimensione (byte) | SHA-256 |
|---|---|---|
| `MRW-Anteprima-Ticino-0.16.0-Windows-Installazione.exe` | 169 373 288 | `e92559d03306f9cdd08cd0d15490a23c9972a3079e25deead5c2972efbeaa7ef` |
| `MRW-Anteprima-Ticino-0.16.0-Windows-Portatile.exe` | 169 145 371 | `5162b41be4f0bda09d42468ee4b5b407b46b2877f0b1e92ba74d5ee4af4e2bfd` |
| `MRW-Anteprima-Ticino-0.16.0-Mac-arm64.dmg` | 214 115 821 | `1f08893104455db69d59e47c8be59e37042f4a87eae8fc958619c0c3d487bb0e` |
| `MRW-Anteprima-Ticino-0.16.0-Mac-x64.dmg` | 218 684 120 | `378eb43a878a9c12621967fd234f7a6f0c87e685fb12ffd2543d0d3c3ce7a675` |

- **Windows** (zip 338 519 069 byte, SHA-256 `28f4885a…5b5c98`): https://github.com/sim40702-debug/swissgass/actions/runs/43427840083/artifacts/14037908299
- **macOS** (zip 432 800 307 byte, SHA-256 `781d26f7…c550f880f`): https://github.com/sim40702-debug/swissgass/actions/runs/43427840083/artifacts/14036759329
- Run: https://github.com/sim40702-debug/swissgass/actions/runs/43427840083 — risultati dei test: artefatti `prove-installer-windows`, `prove-installer-mac`, `prove-installer-mac-x64`, `controlli-risultati`, `regressione-0157`.
- Il file `SHA256_INSTALLER_0.16.0.txt` contiene le stesse impronte. Gli hash sono stati calcolati sui file **estratti dagli artefatti scaricati** (stessi byte che scarichi tu); gli installer provati in CI sono quelli costruiti nello stesso job.
- Gli installer **non sono firmati**: SmartScreen (Windows) e Gatekeeper (macOS) mostreranno un avviso.

## 6-bis. Installer UFFICIALI (release `anteprima-v0.16.0`, pubblici, nessun login)

Workflow «Release anteprima Ticino» [run #49 (43435336806)](https://github.com/sim40702-debug/swissgass/actions/runs/43435336806) su `main` `266cdb8`: 4 job su 4 verdi (versione, app Windows, app Mac, release). SHA-256 ricalcolati sui file scaricati in anonimo: coincidono con i digest di GitHub.

| File | Byte | SHA-256 |
|---|---|---|
| [`MRW-Anteprima-Ticino-0.16.0-Windows-Installazione.exe`](https://github.com/sim40702-debug/swissgass/releases/download/anteprima-v0.16.0/MRW-Anteprima-Ticino-0.16.0-Windows-Installazione.exe) | 169 373 305 | `efba3fd58ada4c2b98c7d9cf8e337da547fcbebe61ccd8a2abfc5d2993a28d8a` |
| [`MRW-Anteprima-Ticino-0.16.0-Windows-Portatile.exe`](https://github.com/sim40702-debug/swissgass/releases/download/anteprima-v0.16.0/MRW-Anteprima-Ticino-0.16.0-Windows-Portatile.exe) | 169 145 366 | `faad29b42bb3d230be04c38539c59a4c29c4810b8d0279bfeebe3f2b325e0206` |
| [`MRW-Anteprima-Ticino-0.16.0-Mac-arm64.dmg`](https://github.com/sim40702-debug/swissgass/releases/download/anteprima-v0.16.0/MRW-Anteprima-Ticino-0.16.0-Mac-arm64.dmg) | 214 096 340 | `8e1a4b11b1a4daa37cee252fe5c80e54d0933851e1e2725afaef9b6c4a0d885d` |
| [`MRW-Anteprima-Ticino-0.16.0-Mac-x64.dmg`](https://github.com/sim40702-debug/swissgass/releases/download/anteprima-v0.16.0/MRW-Anteprima-Ticino-0.16.0-Mac-x64.dmg) | 218 687 939 | `4129c2f897105cb64746b11cce936ad25aecbc6a9d429b95c64d0042ab734bfc` |

Verificato qui: i due `.exe` sono installer NSIS PE32; i `.dmg` hanno nome `arm64`/`x64` e dimensioni coerenti con quelli di prova (214,1 e 218,7 MB). **Non verificato qui:** l'architettura interna dei `.dmg` ufficiali (non montabili su Linux) e l'avvio degli installer ufficiali in CI; l'architettura dei file di prova era stata confermata con `lipo` (x64 su Intel). Gli installer non sono firmati.

## 7. Problemi conosciuti e ancora aperti

1. **Prova GPU reale sul PC Windows** (§10): blocco alla pubblicazione.
2. Foto HD a 0,5 m non pubblicate (≈ 2,1 GB, impatto sul tuo PC da verificare); in questa versione i profili Media/Alta/Ultra usano la foto a 2 m.
3. Quote: A2 in R_2712_1106 (originale 13,7 m sotto l'impalcato misurato), capo SS340 vicino a Lanzo/Menaggio (+11,8 m sulla superficie ufficiale), galleria di Maccagno (+8,7 m e lastra bianca visiva), reti di ponti in Italia senza verità indipendente, 202 scalini preesistenti tra carreggiate (giunzioni laterali), 47 gruppi di strade staccati dalla rete, 505 vertici di galleria sopra e 473 di ponte sotto il terreno a 4 m (per lo più capi/portali: legittimi o ≤ 2 m). Dettagli e classificazione in `ANALISI_QUOTE_OPERE.md`.
4. Biaschina: l'impalcato riconciliato resta mediamente 2–3 m sotto la superficie misurata da swisstopo.
5. Possibile costo di caricamento e compilazione shader (da 43 a 106 programmi) e +70…+140 MB di heap: da misurare su GPU.
6. Installer non firmati; Mac non provati su macchine vere.
7. Il workflow di build non è avviabile a mano finché non è in `main`: parte con un push che modifichi il suo file.
8. Identità del commit `0445120` (§1).
9. Il merge in `main` farebbe partire il workflow di release ufficiale (tag e Latest): per questo non è stato fatto.

## 8. Git, release e merge con `main`

- `main` (`041c676`, 0.15.7) è **antenato** del ramo: un merge sarebbe un **fast-forward**, senza conflitti. Le funzioni 0.16.0 e le modifiche 0.15.6/0.15.7 sono tutte presenti (`audio.js` identico a `main`; `moto_modelli.js` differisce solo per i materiali PBR della 0.16.0).
- **Stato prima della pubblicazione (poi autorizzata ed eseguita, vedi inizio):** nessun merge in `main`, nessun tag, nessuna Release. **Mai fatti:** pacchetti HD, force-push, riscrittura della storia.
- Pronti per la release: versione, `NOTE_RELEASE.md` (changelog e note: HD esclusi, dati v2, prestazioni, installer non firmati), installer con SHA-256, pacchetti geografici con SHA-256, documentazione, controlli finali.
- Quando dirai «GO»: merge fast-forward in `main` (il workflow di release costruisce e pubblica gli installer ufficiali e il tag `anteprima-v0.16.0`). Gli installer ufficiali saranno **ricostruiti** dal workflow di release: avranno impronte diverse da quelle di prova.

## 9. Istruzioni di installazione e prova (versione breve)

1. Scarica lo zip Windows dal link del §6 (serve il login GitHub) ed estrailo.
2. Verifica l'impronta: `Get-FileHash .\MRW-Anteprima-Ticino-0.16.0-Windows-Installazione.exe -Algorithm SHA256` → `e92559d0…eaa7ef`.
3. Esegui l'installer (SmartScreen: *Ulteriori informazioni → Esegui comunque*), avvia «MRW Anteprima Ticino»; `Esc` mostra la versione 0.16.0.
4. Segui `PROVA_WINDOWS_GPU.md`: controllo che usi la GPU (Gestione attività), benchmark interno (`Esc` → Benchmark), corsa misurata, confronto con 0.15.7, prove a mano (Biaschina, San Gottardo, Monte Carasso, Maccagno, passaggio di regione).

## 10. Cosa manca per la pubblicazione ufficiale (blocco GPU)

La 0.16.0 **non è validata su GPU reale**. Per sbloccarla servono, dal **tuo PC Windows**: (1) installer avviato e 5 minuti di guida a Locarno con profilo **Alta** senza chiusure né schermo nero; (2) metriche del §5 di `PROVA_WINDOWS_GPU.md` per **Alta** (0.16.0 e 0.15.7): FPS medi, 1 % low, VRAM, tempo di caricamento; (3) assenza di errori WebGL/driver; (4) passaggio di almeno una regione; (5) Biaschina e San Gottardo senza salti. Le soglie proposte (60 FPS medi e 1 % low ≥ 40 a 1920×1080, 1 GB di margine VRAM, nessun peggioramento > 10 %) **vanno confermate da te prima di guardare i numeri**. Con un tuo «GO» scritto procedo con merge, tag e release; se un punto fallisce, la valutazione diventa NO-GO per quel punto.

## 11. Criteri di accettazione e valutazione finale

| Criterio | Stato |
|---|---|
| Versione 0.16.0 nell'app (4 installer) | ✔ verificato |
| Dati geografici v2 pubblicati e verificati (7/79, SHA-256, 11/11, 0 punti > 1 m su 47 252) | ✔ verificato |
| Installer Windows (NSIS e portatile) e macOS (arm64 e x64) avviano, profili e LOD, regioni, 0 errori in console | ✔ verificato **in grafica software su CI** |
| Download e ripresa, passaggio tra regioni | ✔ verificato |
| Nessuna regressione oltre soglia (software) | ✔ (+8,2 % al massimo contro 15 %) |
| Prestazioni, VRAM, aspetto su scheda video vera | ✘ **non eseguito** |
| Installer firmati; Mac veri; giudizio visivo; HD | ✘ non eseguito / escluso |

**GO CON LIMITAZIONI** sul piano tecnico: la versione è distribuibile come **prova** e pronta per essere provata sul tuo PC; **non** è dichiarata validata su GPU reale e **non** è pubblicata. Nessun problema tecnico trovato rende rischiosa la pubblicazione (nessun NO-GO), ma la pubblicazione ufficiale resta sospesa fino al tuo esito della prova GPU.
