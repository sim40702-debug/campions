# Prova sul tuo PC Windows con scheda video vera

**Stato: NON ESEGUITA.** Fino a quando non c'è un risultato vero di questa prova, nessun numero di prestazioni di questa versione è "superato". I numeri misurati qui sono in grafica software (CPU) e servono solo a confrontare versioni, mai a dire quanti FPS farà il tuo PC.

## A. Prova rapida dentro il gioco (nessuna installazione di strumenti)
1. Installa la versione di prova (quando sarà disponibile) oppure avvia il gioco dal codice (punto B).
2. Esc → scegli il profilo (Bassa, Media, Alta, Ultra) → **"Benchmark ripetibile (8 scenari)"**. Il gioco registra FPS, tempi, chiamate di disegno, triangoli e memoria per scenario.
3. Ripeti per ogni profilo. Mentre gira, apri **Gestione attività → Prestazioni → GPU** e annota **"Memoria GPU dedicata"** (è la VRAM) a gioco fermo e durante la corsa.
4. Manda i risultati.

## B. Prova completa e ripetibile (consigliata): `benchmark_profili.mjs`
Serve Node.js 20 e Git. Da PowerShell:
```powershell
git clone https://github.com/sim40702-debug/swissgass.git
cd swissgass
git checkout claude/brave-turing-mztbtd
cd anteprima; npm install; cd ..
npm --prefix tools/anteprima_prova install playwright
npx --prefix tools/anteprima_prova playwright install chromium
```
Servono i dati di una regione in `anteprima/dati` (cartella `dati` della release `dati-anteprima.zip`, oppure un pacchetto `regione_R_2696_1106.tar.gz` della pre-release `ticino-completo-dati` scompattato lì) e la cartella `anteprima/cantone` (da `cantone.tar.gz`).
Poi:
```powershell
node tools/anteprima_prova/benchmark_profili.mjs --gpu --canale chrome --risoluzione 1920x1080 --secondi 60
```
- `--gpu` usa la scheda video (senza, usa la grafica software: non sono FPS veri).
- `--canale chrome` usa il tuo Chrome (consigliato su Windows).
- Con scheda **NVIDIA** il programma legge la VRAM con `nvidia-smi` prima e dopo ogni profilo. Con AMD/Intel la VRAM va letta a mano da Gestione attività (punto A.3).
- Per confrontare con la 0.15.5: `git worktree add ..\mrw-0155 3a01a01`, mettere gli stessi `dati` e `cantone`, poi `set RADICE_APP=..\mrw-0155\anteprima` (PowerShell: `$env:RADICE_APP="..\mrw-0155\anteprima"`) e rilanciare il comando: i file `.md` e `.json` finiscono in `docs/anteprima/fase4/misure` (o `--uscita cartella`).
- Per provare il LOD lontano on/off: `node tools/anteprima_prova/prova_lontano.mjs anteprima <cartella uscita>` (chiamate di disegno e triangoli con e senza).

## C. Cosa mandarmi
- I file `benchmark_*.md` e `benchmark_*.json` (dicono su che scheda/CPU sono stati misurati).
- La memoria GPU dedicata letta da Gestione attività (se non NVIDIA).
- Se qualcosa scatta: profilo, punto della mappa e se stavi cambiando regione.

## D. Criteri per dichiarare la prova superata (da decidere insieme prima di guardare i numeri)
Proposta: Alta ≥ 60 FPS medi e 1 % low ≥ 40 FPS a 1920×1080 sulla tua scheda; nessun errore in console; VRAM sotto la memoria dedicata della scheda con almeno 1 GB di margine; nessun peggioramento di oltre il 10 % rispetto alla 0.15.5 sullo stesso profilo e stessa regione. Se i valori non ti sembrano giusti dimmelo: sono una proposta, non una soglia già verificata.
