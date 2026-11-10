# Sprint V2 – Anteprima 0.14.1 – Report

Partenza: commit `a6bb508`, branch `claude/magical-hopper-j4az9x` (nessun lavoro più recente sul remoto, working tree pulito).

## Ambiente di misura (da leggere prima dei numeri)

Cloud Linux, 4 core, **nessuna scheda video**: Chromium 153 con grafica software SwiftShader. Gli **FPS non rappresentano un PC vero**
(0,2–8 FPS qui): servono per confrontare versioni sulla stessa macchina. Triangoli, chiamate, tempi di caricamento, memoria e
tempi di disegno della mappa (CPU) sono invece indicativi. Dati: **dati di prova** (8 paesi, 28 000 edifici), non i dati veri di OpenStreetMap.

## Fase 1 – Dati geografici: cosa è stato (e non è stato) possibile

- Analizzati `tools/geo`: il passo 7 dipende dai passi 1 e 3 (terreno) e 2 (OSM); `chiedi_overpass` **riusa i file già scaricati**, quindi rilanciare il passo 2 scarica solo l'uso del suolo e non sovrascrive nulla.
- **Rigenerazione reale NON eseguita**: in questo ambiente `tools/geo/dati` non esiste e i server Overpass (4 provati) non rispondono (swisstopo sì). Non ho finto la rigenerazione.
- Verificato invece: la funzione `esporta_uso_suolo` su un file OSM nel formato vero (parco e zona industriale → poligoni corretti); nuovo `tools/geo/verifica_uso_suolo.py` (controlla tipi, contorni, limiti del terreno) provato sul file di prova; procedura "solo parchi" in `tools/geo/LEGGIMI.md`.
- Caricamento nel mondo: parchi, prati, campi sportivi e cimiteri ora sono **in 3D** (maschera a 8 m: prato curato, alberi, cipressi) e sulla mappa (verificato con `uso_suolo.json` di prova).

## Fase 2 – Meteo

8 condizioni (sereno, parzialmente nuvoloso, nuvoloso, nebbia, pioggia leggera/intensa, neve leggera/intensa) + Automatico, scelte da Impostazioni.
Pioggia e neve: particelle 3D (calcolate dalla scheda video), intensità per condizione, vento. Asfalto bagnato (più scuro, pozzanghere lucide, riflessi di lampioni più forti, riflessi del cielo smorzati col cielo grigio). Neve a terra su tetti, prati, strade, marciapiedi e alberi, con transizione graduale di 240 m in quota e accumulo/scioglimento nel tempo; la neve di stagione sulle cime (dal mese) non è più "dipinta" nel terreno.
Geografia: quota della neve permanente e della neve in caduta per mese; con "Meteo realistico" una perturbazione da neve **piove sotto la quota di caduta** (Locarno a novembre) e nevica sopra (1 628 m provati). Senza la spunta, nevica ovunque. In galleria non piove. Automatico: nuova situazione ogni 10 minuti, pesata sul mese.

## Fase 3 – Prestazioni

Colli di bottiglia trovati (conteggio degli oggetti visibili e profilo): terreno vicino (4 pezzi da 524 k triangoli), lampioni (1,1 M triangoli sempre disegnati), ombre che ridisegnavano interi pezzi di città lontani, disegno vettoriale degli edifici sulla mappa (1,7 s a zoom medio), scritture DOM a ogni fotogramma, luce del faro sempre nei materiali, **heap JavaScript 601 MB** (copie CPU delle geometrie).

| Intervento | Effetto misurato |
|---|---|
| Arredo/segnali in celle da 400 m | niente più 1,1 M triangoli sempre disegnati; 4,0 M → 2,9 M triangoli/fotogramma (0.14.0→) |
| Terreno a mezzo dettaglio oltre 1 km (soglia di ritorno 900 m) | −75% triangoli sui pezzi lontani |
| Ombre degli edifici solo per i pezzi vicini; particolari fini oltre 1,4 km nascosti | meno oggetti nella mappa delle ombre |
| Geometrie statiche liberate dopo il caricamento (`memoria.js`) | heap JS dopo GC **601 → 470 MB** (−22%); nel benchmark ~375 MB |
| Mappa: edifici come riquadri sotto 1,4 punti/m, quartieri come immagine interpolata | disegno a zoom 0,3: **1 700 ms → 20 ms**; zoom 1: 166 → 6 ms; minimappa più leggera |
| Scritte HUD 10 volte al secondo, faro spento di giorno | meno lavoro CPU per fotogramma |

Non toccato perché non misurabile qui: texture (le più grandi sono le foto aeree, assenti nei dati di prova; i 24 atlanti di facciata + asfalto occupano ~30 MB), costo reale delle ombre e degli shader su GPU. Costo medio di una cella di alberi: 3,4–3,9 ms (CPU).

**Benchmark ripetibile** (`benchmark.js`, pulsante in Impostazioni, `window.__mrw.eseguiBenchmark`, `tools/anteprima_prova/benchmark.mjs`, confronto con `confronta_benchmark.mjs`): 8 scenari (centro storico di Locarno, lungolago, residenziale, industriale, montano, panorama, notte, pioggia e neve), punti scelti dai dati, stessa traiettoria della telecamera. Misura FPS medi/minimi, 1% low, frame time (medio, p95, p99, max), memoria JS, triangoli, chiamate, caricamento, e **scrive l'ambiente di misura**. Risultati: `benchmark/benchmark_media.{md,json}` e `benchmark_bassa.{md,json}` (caricamento 7,9–10 s; 150–970 chiamate; 0,9–3,5 M triangoli per scenario). I valori di FPS sono molto rumorosi in grafica software (un fotogramma = secondi): non vanno letti come prestazioni reali.

## Fasi 4–6 – Grafica, località, mappa

- Lago: **corretto un errore di 0.14.0** (il programma delle onde non compilava e il lago non si disegnava) – trovato dalla suite di test.
- Parchi e giardini 3D, cimiteri con cipressi, campi sportivi liberi; riflessi smorzati in pioggia; luci e pozze luminose più forti sul bagnato.
- Località: tabella manuale estesa da 11 a 29 paesi (Mendrisio, Chiasso, Biasca, Airolo, Faido, Morcote, Gandria, Paradiso, Orselina, Intragna…), le altre derivano dal nome. Provato su **134 località ticinesi**: 134 profili validi, 129 distinti, coerenza (Airolo pietra, Ascona/Morcote palme, Chiasso moderno). Le posizioni di strade ed edifici non sono state modificate.
- Mappa: coordinate LV95, quota e nome della strada sotto il cursore; tempi di disegno misurati (tutto il mondo 29 ms, città 20 ms, zoom 1 6 ms, zoom 3 6 ms, sotto i 120 ms richiesti).
- **Non fatto** (dati non disponibili): rotatorie (OSM non è esportato con il tag), ulteriori tipi di ponte/galleria oltre a quelli già disegnati.

## Fase 7 – Electron

- Procedura: `electron-builder` con la configurazione esistente (non modificata); dipendenze già a posto (electron 33.4.11).
- **Linux (non-pacchetto del progetto, solo per provare)**: ricostruito `/tmp/claude-0/dist/linux-unpacked/moto-racing-world-anteprima-ticino` (329 MB, 0.14.1): tutti i 33 moduli `src/*.js`, `terzi/`, `modelli/`, `dati/` (incluso `uso_suolo.json`) presenti.
- **Windows portatile**: cross-compilato `/tmp/claude-0/dist-win/MRW-Anteprima-Ticino-0.14.1-Windows-Portatile.exe` (80 MB) con `-c.win.signAndEditExecutable=false` (senza wine non si può modificare l'icona/metadati; **non eseguibile qui, non provato**). L'installatore NSIS e il DMG Mac **non sono costruibili** qui (servono wine / macOS): li produce il workflow `release-anteprima.yml`, ora con un controllo in più (ogni `src/*.js` deve essere nell'app).
- I file in `/tmp` sono temporanei (non in Git: sono ~330 MB); i pacchetti ufficiali nascono dalla release.
- **App impacchettata provata sotto xvfb** (`prova_electron.mjs`, 8/8): avvio in 21 s, versione 0.14.1, minimappa disegnata (233 colori), ricerca della mappa, pioggia intensa dal menu (particelle e bagnato attivi), impostazioni salvate, benchmark eseguibile, **nessun errore di runtime**, **persistenza dopo il riavvio** (qualità, meteo, ora).

## Fase 8 – Test (tutti eseguiti)

| Suite | Esito |
|---|---|
| `prova_completa.mjs` (browser) | **36/36**: 4 qualità (carica senza errori), 8 località (profili distinti, scene diverse, nessun errore), giorno>tramonto>notte, tutti gli 8 meteo coerenti, meteo realistico (pioggia a 200 m, neve a 1 628 m), automatico, minimappa, mappa (ricerca, segnaposto, coordinate, filtri, "Parti da qui", partenza ricordata, tempi), persistenza dopo ricaricamento, benchmark |
| `prova_luoghi.mjs` | 134 località, tutte valide |
| `prova_electron.mjs` | 8/8 (+ riavvio) |
| Python `verifica_uso_suolo.py`, `py_compile` | OK |

Errori trovati e corretti in questo sprint: lago non compilato (0.14.0), mappa lenta (1,7 s), "p" scritta nella ricerca, luminanza misurata su canvas vuoto (errore del test), puddles troppo bianche.
Screenshot in `screenshot/`, esiti in `test/`.

## Problemi rimasti

- **Nessuna misura su GPU reale e nessun dato OSM vero**: FPS e aspetto sui dati veri vanno verificati sul PC di Simone (Impostazioni → Benchmark ripetibile, poi incollare il risultato).
- Dati veri di parchi/prati: da rigenerare con `passo2` + `passo7` sul PC con internet (procedura in `tools/geo/LEGGIMI.md`).
- Pacchetti Mac/Windows installabili: solo dalla release (CI). Il portatile cross-compilato non è provato.
- Rotatorie non distinte; pioggia senza suono e senza spruzzi; niente lampi.
- L'heap resta ~375–470 MB sui dati di prova (griglia del terreno, dati OSM, mappa): con i dati veri va misurato.
