# Prova sul tuo PC Windows con scheda video vera (0.16.0 in preparazione)

**Stato: NON ESEGUITA.** Fino a quando non c'è un tuo risultato vero, nessun numero di prestazioni della 0.16.0 è "superato". Tutti i numeri misurati finora sono in grafica software (CPU, SwiftShader): servono solo a confrontare versioni sulla stessa macchina, mai a dire quanti FPS farà il tuo PC.

Questa procedura **non pubblica niente** e non richiede la release 0.16.0 (che non esiste): si prova il codice dal ramo di sviluppo.

---

## 1. Quale build usare

| Cosa | Valore |
|---|---|
| Ramo | `claude/brave-turing-mztbtd` (contiene la 0.16.0 in sviluppo **unita a `main` 0.15.7**) |
| Versione nell'app | `0.16.0` (finestra "Esc", e `anteprima/package.json`) |
| Confronto | **0.15.7** = ultimo commit di `main` (`041c676`) |
| Dati geografici | **già pubblicati** nella pre-release `ticino-completo-dati` (quote di ponti e gallerie riconciliate, 16 pacchetti, SHA-256 in `pubblicato_dopo_sha256.txt`): l'app li scarica da sola |

### Opzione A (consigliata): installer di prova da GitHub Actions — NON è una release
L'installer è costruito dal workflow **"Build di prova (NESSUNA pubblicazione)"** e vive solo come artefatto temporaneo (7 giorni).
1. Apri il [run #2 del build di prova](https://github.com/sim40702-debug/swissgass/actions/runs/43405255833) (tutti i job verdi, commit `7a7bc1e`; scade il 20/11/2026) → **Artifacts**, oppure direttamente: https://github.com/sim40702-debug/swissgass/actions/runs/43405255833/artifacts/14026468865
2. Scarica **`installer-windows-PROVA-NON-UFFICIALE`** (zip): dentro ci sono `…-Windows-Installazione.exe` (installer) e `…-Windows-Portatile.exe`.
3. Esegui l'installer. Non è firmato: Windows mostrerà **"Windows ha protetto il PC"** → *Ulteriori informazioni* → *Esegui comunque*.
4. Avvia **"MRW Anteprima Ticino"** dal menu Start.
Cosa ha verificato la CI su questo installer (Windows Server, **grafica software**, non la tua GPU): installato in silenzio, avviato, caricamento di Locarno, quattro profili grafici, LOD lontano, download di Lugano e passaggio di regione, nessun errore in console. **Il portatile è stato solo avviato e tenuto in esecuzione 60 s, senza controllare l'interfaccia.** Quello che nessuna CI può dire: prestazioni, VRAM, aspetto sulla tua scheda.

### Opzione B: dal sorgente (serve per i test ripetibili del punto 4 e per il confronto con la 0.15.7)
Servono Node.js 20 e Git. PowerShell:
```powershell
git clone https://github.com/sim40702-debug/swissgass.git
cd swissgass
git checkout claude/brave-turing-mztbtd
cd anteprima; npm install; cd ..
npm --prefix tools/anteprima_prova install playwright
```
Dati di Locarno e mappa del cantone (poi le altre regioni le scarica il gioco):
```powershell
mkdir anteprima\dati, anteprima\cantone
# da https://github.com/sim40702-debug/swissgass/releases/tag/ticino-completo-dati
tar -xzf regione_R_2696_1106.tar.gz -C anteprima\dati
tar -xzf cantone.tar.gz -C anteprima\cantone
cd anteprima; npm start
```
**Foto HD 0,5 m:** i pacchetti `hd_*` NON sono pubblicati (decisione tua). Senza, i profili Media/Alta/Ultra girano **senza** le foto HD: il loro costo su GPU **non verrà misurato**. Segnalalo nel giudizio finale.

### Controllo che stia davvero usando la GPU (prima di misurare)
Nel gioco: F = FPS. Poi apri **Gestione attività → Prestazioni → GPU**: durante la guida "3D" deve salire. Il benchmark ripetibile scrive anche `scheda_video`: se contiene *SwiftShader*, *llvmpipe* o *Microsoft Basic Render*, **sta usando la CPU: i numeri non valgono** (punto 7).

## 2. Come avviarla
- **Opzione A:** menu Start → "MRW Anteprima Ticino". Partenza di Locarno; tasto `K` apre la mappa del cantone per partire da un'altra regione (si scarica la prima volta, serve internet).
- **Opzione B:** `cd anteprima; npm start`.
- Dati già aggiornati: Lugano, Airolo e le altre regioni scaricate dal gioco hanno già le quote riconciliate.

## 3. Come selezionare i profili grafici
- **Dentro il gioco:** `Esc` → impostazioni → pulsanti **Bassa / Media / Alta / Ultra 4K**. La scelta resta salvata.
- **Nei test automatici:** `--qualita bassa,media,alta,ultra` (default tutti e 4).
- Cosa cambia: Bassa = alberi solo vicino, niente HD, LOD lontano spento; Media/Alta = più alberi, HD e LOD lontano; Ultra = ombre lunghe, erba, dettagli delle città a grande distanza, HD 240.

## 4. Scenari da provare

**A. Benchmark interno (5 minuti, nessuna installazione extra)** — `Esc` → **"Benchmark ripetibile (8 scenari)"**: centro storico, lungolago, area residenziale, zona industriale, zona montana, vista panoramica, notte, pioggia/neve. Non toccare nulla finché non finisce; poi **Copia** e incolla il testo in un file `.md`. Ripeti per ogni profilo.

**B. Corsa misurata, 4 profili (consigliata)**
```powershell
node tools/anteprima_prova/benchmark_profili.mjs --gpu --canale chrome --risoluzione 1920x1080 --secondi 60 --uscita risultati_0160
```
Con scheda **NVIDIA** legge la VRAM da solo (`nvidia-smi`); con AMD/Intel leggila da Gestione attività → GPU → "Memoria GPU dedicata" a gioco fermo e a fine corsa.

**C. Confronto con la 0.15.7 (serve per il criterio "nessun peggioramento > 10 %")**
```powershell
git worktree add ..\mrw-0157 041c676
# copia lì gli stessi anteprima\dati e anteprima\cantone
$env:RADICE_APP="..\mrw-0157\anteprima"
node tools/anteprima_prova/benchmark_profili.mjs --gpu --canale chrome --risoluzione 1920x1080 --secondi 60 --uscita risultati_0157
Remove-Item Env:RADICE_APP
```
**D. LOD lontano acceso/spento (giudizio visivo e costo)**
```powershell
node tools/anteprima_prova/prova_lontano.mjs anteprima risultati_lontano
```
Guarda a occhio le immagini: dice se le sagome delle città (0,4–4 km) si vedono e migliorano la scena o no. **Questo giudizio è tuo**: in software non si distingue.

**E. A mano, in gioco (10 minuti)**
1. Partenza a Locarno, profilo Alta: guida 2 minuti. Nota scatti.
2. `K` (mappa del cantone) → parti a **Lugano**: la regione si scarica (serve internet), la partita si ricarica. Nota tempi e scatti.
3. Guida fino al bordo di una regione e **passa il confine guidando**: nota eventuali scatti, salti della strada, ricaricamento.
4. Nel tratto Airolo (regione nord) prova la **galleria del San Gottardo** (partenza vicino a Airolo): la strada deve scendere dritta, senza salti, ed entrare/uscire dal terreno senza gradini. Giudizio visivo mai fatto finora.
5. Prova **un ponte lungo** (A2, viadotti della Biaschina, partenza vicino a Giornico) e **una galleria lunga**: sono i punti dove le quote sono state corrette. Guarda soprattutto, e annotalo nel `note.md`:
   - **Svincolo di Monte Carasso** (partenza a LV95 2721127 / 1116742, o `K` e scegli Monte Carasso): la riconciliazione ha alzato tutto lo svincolo di 7–15 m; dimmi se sembra giusto o rotto (rampe sospese, salti).
   - **Viadotti della Biaschina** (A2): i capi sono stati alzati fino a 60 m; guida da una parte all'altra e dimmi se l'impalcato è continuo.
   - **Galleria "1. Maccagno inferiore"** (partenza a LV95 2701281 / 1098777): c'è una lastra bianca accanto alla moto, preesistente.
   - **Imbocco di Airolo / Via San Gottardo** (LV95 2691297 / 1153282): la strada entra in una trincea; nessun salto atteso.
6. Foto: confronta WebP/JPEG delle foto HD **solo se** hai un pacchetto HD (vedi punto 1).

## 5. Metriche da raccogliere
Per ogni profilo, 0.16.0 **e** 0.15.7, stessa regione, stessa risoluzione:
- FPS medi, **1 % low**, tempi di fotogramma (mediana / p95 / p99 / max), numero di scatti > 33 ms e > 50 ms;
- tempo di caricamento (all'avvio e al cambio regione);
- chiamate di disegno e triangoli;
- memoria JavaScript (heap), RAM del browser, **VRAM** (massimo durante la corsa);
- scheda video, driver, CPU, RAM, risoluzione (li scrive già il benchmark);
- errori in console: li conta `benchmark_profili.mjs` (campo errori nel `.md`/`.json`); l'app Electron non espone gli strumenti sviluppatore, quindi in gioco non si leggono.

### Criteri proposti (da confermare da te PRIMA di guardare i numeri)
- Alta: ≥ 60 FPS medi e 1 % low ≥ 40 FPS a 1920×1080;
- nessun errore in console;
- VRAM con almeno 1 GB di margine sotto la memoria dedicata;
- nessun peggioramento oltre il 10 % rispetto alla 0.15.7 (stesso profilo, stessa regione).
In software la 0.16.0 usa circa +5 % di chiamate/triangoli e +70–110 MB di heap (+2–7 % chiamate e triangoli nel confronto con la 0.15.7 fatto dalla CI) rispetto alla 0.15.7: la prova serve a dire se sulla tua GPU conta.

## 6. Come salvare il report
1. Cartelle `risultati_0160`, `risultati_0157`, `risultati_lontano` (file `benchmark_*.md`, `benchmark_*.json`, immagini).
2. Il testo copiato dal benchmark interno (`Esc → Benchmark`), uno per profilo.
3. Uno screenshot di Gestione attività → GPU durante la corsa (uso 3D e memoria dedicata) e di `chrome://gpu` (stato "Hardware accelerated" per WebGL).
4. Un file `note.md` con: scheda, driver, Windows, note a mano (punto 4.E), dove scatta.
5. Comprimi tutto in uno zip e consegnalo (o mettilo in `docs/anteprima/ticino/prova_windows/` e fai commit sul ramo).

## 7. Come distinguere problemi del gioco da limiti del rendering o dei driver

| Sintomo | Probabile causa | Controllo |
|---|---|---|
| `scheda_video` = SwiftShader / llvmpipe / Basic Render | **Nessuna GPU in uso** (driver o Chrome) | `chrome://gpu`; aggiorna driver; in `benchmark_profili.mjs` serve `--gpu` |
| FPS bassi, **GPU 3D vicina al 100 %** | Limite di riempimento/geometria della GPU (profilo troppo alto per la scheda) | Scende molto passando a Media/Bassa? Allora è carico grafico: guarda triangoli/chiamate |
| FPS bassi, **GPU 3D bassa**, un core CPU al 100 % | **Gioco** (JavaScript, chiamate di disegno, garbage collection) | Confronto con 0.15.7: peggiora → è la 0.16.0. Heap che cresce → perdita di memoria |
| Scatti **solo al cambio regione o dopo pochi secondi di guida** | **Gioco** (streaming di edifici/strade, download in secondo piano) | Si ripete nello stesso punto? Guarda p99/max e il tempo di caricamento |
| Uguale alla 0.15.7 sullo stesso profilo | Non è una regressione della 0.16.0 | Eventuale limite generale della scheda/del motore |
| Errori `WebGL context lost`, `GL_OUT_OF_MEMORY`, schermo nero, errori di compilazione degli shader | **Driver / VRAM** | Annota scheda e driver; prova driver aggiornato; riduci profilo; guarda la VRAM massima |
| Funziona in Chrome (`--canale chrome`) ma non in Electron (o viceversa) | Differenza Electron/Chrome (ANGLE, flag) | Ripeti con `--canale chrome` e con `npm start` e confronta |
| FPS a gradini (30/60/144) | V-Sync del sistema | Il benchmark li disattiva (`--disable-gpu-vsync`); in gioco dipende dal monitor |
| Strada che salta, gradini di quota, buchi nei ponti o nelle gallerie | **Dati** (non rendering) | Indica punto e regione: si verifica con `verifica_cantone.py` |

Regola pratica: **un problema è del gioco solo se è riproducibile, se peggiora rispetto alla 0.15.7 sullo stesso hardware, e se non compaiono errori di WebGL/driver.** Se manca anche solo uno di questi tre elementi, non lo dichiaro bug del gioco senza altre prove.

## 8. Cosa NON dichiaro finché non mi mandi i risultati
Prestazioni su GPU, VRAM, confronto con 0.15.7, giudizio visivo su LOD lontano, ponti/gallerie, WebP/JPEG delle foto HD, download reale da GitHub dal tuo PC, installer Mac (arm64 provato solo in CI) e Windows sulla tua macchina.
