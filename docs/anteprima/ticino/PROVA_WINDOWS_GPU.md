# Prova sul tuo PC Windows con scheda video vera (0.16.0 in preparazione)

**Stato: NON ESEGUITA.** Fino a quando non c'è un tuo risultato vero, nessun numero di prestazioni della 0.16.0 è "superato". Tutti i numeri misurati finora sono in grafica software (CPU, SwiftShader): servono solo a confrontare versioni sulla stessa macchina, mai a dire quanti FPS farà il tuo PC.

Questa procedura **non pubblica niente** e non richiede la release 0.16.0 (che non esiste): si prova il codice dal ramo di sviluppo.

---

## 1. Quale build usare

| Cosa | Valore |
|---|---|
| Ramo | `claude/brave-turing-mztbtd` |
| Codice del gioco | cartella `anteprima/` (invariata da `e24f508` in poi; i commit successivi toccano solo workflow, prove e documenti) |
| Verifica che sia quello giusto | `git log -1 --format=%H` deve mostrare l'ultimo commit del ramo (lo scrivo nel report di consegna) |
| Versione nel gioco | `0.16.0` (`anteprima/package.json`) |
| Confronto | **0.15.5** = commit `3a01a01` (stessa macchina, stessi dati, stesso profilo) |

**Non esiste un installer 0.16.0**: la procedura usa il codice sorgente (Electron + Node). Un installer di prova Windows si può far costruire al workflow, ma richiederebbe un'altra tua autorizzazione (il workflow attuale lo pubblicherebbe come pre-release con tag).

### Dati da usare (importante: quelli *riconciliati*)
I ponti/gallerie con le quote corrette stanno nei pacchetti rigenerati dal run `43385897633` (artefatto `riconciliati`, valido 7 giorni dal 13/11/2026), **non ancora** nella pre-release `ticino-completo-dati`. Per la prova GPU basta la regione di Locarno + la mappa del cantone:
1. GitHub → Actions → run "Ticino completo" #5 (ramo `claude/brave-turing-mztbtd`) → Artifacts → `riconciliati` (1,9 GB; ne serve solo `regione_R_2696_1106.tar.gz`).
2. `cantone.tar.gz` dalla pre-release `ticino-completo-dati` (non cambia).
3. Se nel frattempo i pacchetti sono stati promossi nella pre-release, prendi tutto da lì.

Scompatta (PowerShell, `tar` è incluso in Windows 10/11):
```powershell
mkdir anteprima\dati, anteprima\cantone
tar -xzf regione_R_2696_1106.tar.gz -C anteprima\dati
tar -xzf cantone.tar.gz -C anteprima\cantone
```
**Foto HD 0,5 m:** i pacchetti `hd_*` NON sono pubblicati (decisione tua). Senza, i profili Media/Alta/Ultra girano **senza** le foto HD: il loro costo su GPU **non verrà misurato** da questa prova. Segnalalo nel giudizio finale; se vuoi misurarlo servirà un'altra decisione su come farti avere un pacchetto HD.

## 2. Come avviarla

Servono Node.js 20 e Git. PowerShell:
```powershell
git clone https://github.com/sim40702-debug/swissgass.git
cd swissgass
git checkout claude/brave-turing-mztbtd
cd anteprima; npm install; cd ..
# (scompatta qui i dati come sopra)
cd anteprima; npm start        # apre il gioco in Electron con la tua scheda video
```
Per i test ripetibili (punto 4) servono anche Playwright e Chrome:
```powershell
npm --prefix tools/anteprima_prova install playwright
```
Il tuo Chrome installato viene usato con `--canale chrome` (non serve scaricare Chromium).

### Controllo che stia davvero usando la GPU (prima di misurare)
Nel gioco: F = FPS. Poi apri **Gestione attività → Prestazioni → GPU**: durante la guida "3D" deve salire. Il benchmark ripetibile scrive anche il nome della scheda (`scheda_video`): se contiene *SwiftShader*, *llvmpipe* o *Microsoft Basic Render*, **sta usando la CPU: i numeri non valgono** (vedi punto 6).

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

**C. Confronto con la 0.15.5 (serve per il criterio "nessun peggioramento > 10 %")**
```powershell
git worktree add ..\mrw-0155 3a01a01
# copia lì gli stessi anteprima\dati e anteprima\cantone
$env:RADICE_APP="..\mrw-0155\anteprima"
node tools/anteprima_prova/benchmark_profili.mjs --gpu --canale chrome --risoluzione 1920x1080 --secondi 60 --uscita risultati_0155
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
   **Attenzione ai dati:** quando in gioco scegli una partenza in un'altra regione (Lugano, Airolo...), il gioco scarica il pacchetto dalla pre-release `ticino-completo-dati`, che **oggi ha ancora le quote vecchie**. Per provare ponti e gallerie corretti prima della promozione, metti tutti i `regione_R_*.tar.gz` dell'artefatto `riconciliati` in una cartella e:
   ```powershell
   cd cartella_pacchetti; python -m http.server 8000
   # in un altro PowerShell:
   $env:MRW_URL_PACCHETTI="http://127.0.0.1:8000/"; cd anteprima; npm start
   ```
5. Prova **un ponte lungo** (per esempio sulla A2) e **una galleria lunga**: sono i punti dove le quote sono state corrette.
6. Foto: confronta WebP/JPEG delle foto HD **solo se** hai un pacchetto HD (vedi punto 1).

## 5. Metriche da raccogliere
Per ogni profilo, 0.16.0 **e** 0.15.5, stessa regione, stessa risoluzione:
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
- nessun peggioramento oltre il 10 % rispetto alla 0.15.5 (stesso profilo, stessa regione).
In software la 0.16.0 usa circa +5 % di chiamate/triangoli e +100–150 MB di heap rispetto alla 0.15.5: la prova serve a dire se sulla tua GPU conta.

## 6. Come salvare il report
1. Cartelle `risultati_0160`, `risultati_0155`, `risultati_lontano` (file `benchmark_*.md`, `benchmark_*.json`, immagini).
2. Il testo copiato dal benchmark interno (`Esc → Benchmark`), uno per profilo.
3. Uno screenshot di Gestione attività → GPU durante la corsa (uso 3D e memoria dedicata) e di `chrome://gpu` (stato "Hardware accelerated" per WebGL).
4. Un file `note.md` con: scheda, driver, Windows, note a mano (punto 4.E), dove scatta.
5. Comprimi tutto in uno zip e consegnalo (o mettilo in `docs/anteprima/ticino/prova_windows/` e fai commit sul ramo).

## 7. Come distinguere problemi del gioco da limiti del rendering o dei driver

| Sintomo | Probabile causa | Controllo |
|---|---|---|
| `scheda_video` = SwiftShader / llvmpipe / Basic Render | **Nessuna GPU in uso** (driver o Chrome) | `chrome://gpu`; aggiorna driver; in `benchmark_profili.mjs` serve `--gpu` |
| FPS bassi, **GPU 3D vicina al 100 %** | Limite di riempimento/geometria della GPU (profilo troppo alto per la scheda) | Scende molto passando a Media/Bassa? Allora è carico grafico: guarda triangoli/chiamate |
| FPS bassi, **GPU 3D bassa**, un core CPU al 100 % | **Gioco** (JavaScript, chiamate di disegno, garbage collection) | Confronto con 0.15.5: peggiora → è la 0.16.0. Heap che cresce → perdita di memoria |
| Scatti **solo al cambio regione o dopo pochi secondi di guida** | **Gioco** (streaming di edifici/strade, download in secondo piano) | Si ripete nello stesso punto? Guarda p99/max e il tempo di caricamento |
| Uguale alla 0.15.5 sullo stesso profilo | Non è una regressione della 0.16.0 | Eventuale limite generale della scheda/del motore |
| Errori `WebGL context lost`, `GL_OUT_OF_MEMORY`, schermo nero, errori di compilazione degli shader | **Driver / VRAM** | Annota scheda e driver; prova driver aggiornato; riduci profilo; guarda la VRAM massima |
| Funziona in Chrome (`--canale chrome`) ma non in Electron (o viceversa) | Differenza Electron/Chrome (ANGLE, flag) | Ripeti con `--canale chrome` e con `npm start` e confronta |
| FPS a gradini (30/60/144) | V-Sync del sistema | Il benchmark li disattiva (`--disable-gpu-vsync`); in gioco dipende dal monitor |
| Strada che salta, gradini di quota, buchi nei ponti o nelle gallerie | **Dati** (non rendering) | Indica punto e regione: si verifica con `verifica_cantone.py` |

Regola pratica: **un problema è del gioco solo se è riproducibile, se peggiora rispetto alla 0.15.5 sullo stesso hardware, e se non compaiono errori di WebGL/driver.** Se manca anche solo uno di questi tre elementi, non lo dichiaro bug del gioco senza altre prove.

## 8. Cosa NON dichiaro finché non mi mandi i risultati
Prestazioni su GPU, VRAM, confronto con 0.15.5, giudizio visivo su LOD lontano, ponti/gallerie, WebP/JPEG delle foto HD, download reale da GitHub (la riconciliazione non è ancora nella pre-release), build Mac/Windows impacchettato.
