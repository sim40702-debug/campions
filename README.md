# MOTO RACING WORLD

Gioco di moto open world. La prima mappa esplorabile è il **Canton Ticino** (Svizzera), ricostruito da dati geografici aperti: terreno di swisstopo, strade ed edifici di OpenStreetMap.

Il progetto ha due parti:

- **Anteprima Ticino** – versione giocabile leggera (Three.js + Electron) del **Locarnese**, 16 × 12 km. È quella che si scarica e si gioca oggi.
- **Versione Unreal Engine 5** – il gioco principale, in costruzione (cartella `unreal/`).

## Giocare l'anteprima

Scarica l'ultima versione dalla pagina [**Releases**](https://github.com/sim40702-debug/swissgass/releases/latest):

| Computer | File |
|---|---|
| Mac con chip Apple (M1, M2, M3, …) | `...-Mac-arm64.dmg` |
| Mac con Intel | `...-Mac-x64.dmg` |
| Windows (installazione, consigliato) | `...-Windows-Installazione.exe` |
| Windows (senza installare) | `...-Windows-Portatile.exe` |

Dopo la prima installazione basta il pulsante **Aggiorna** dentro il gioco: controlla se c'è una versione nuova, la scarica e la installa.

Le novità di ogni versione e le istruzioni per il primo avvio (Mac non firmato, avviso di Windows) sono in [`anteprima/NOTE_RELEASE.md`](anteprima/NOTE_RELEASE.md).

### Comandi

| Tasto | Cosa fa |
|---|---|
| Frecce / WASD | guida (S: freno davanti) |
| Spazio | freno dietro / derapata (in macchina: freno a mano) |
| Shift | peso dietro (impennata) |
| E | peso avanti (stoppie) |
| C | telecamera (dietro, alta, casco) |
| R | torna sulla strada |
| G | garage |
| P / N | mappa e partenza |
| T | ora del giorno |
| M | suono sì/no |
| F | FPS |
| F11 | schermo intero |
| Esc | impostazioni |
| H | lista dei comandi |

### Cosa c'è nell'anteprima

- **Territorio vero**: terreno swissALTI3D, foto aeree SWISSIMAGE, Lago Maggiore, fiumi e torrenti.
- **Strade vere** con quote calcolate su tutta la rete, incroci, rotonde, ponti, gallerie e sottopassi; **A13** con due carreggiate, svincoli, spartitraffico e barriera centrale.
- **Città e paesi** ognuno con la sua identità (colori, facciate, tetti), edifici di OpenStreetMap, boschi, alberi, parchi.
- **Segnaletica svizzera**, lampioni, strisce, guardrail, arredo urbano; teleferiche, funicolare e ferrovie.
- **Garage**: moto e una macchina da drift, con fisica (aderenza, derapate, impennate, cadute e danni).
- **Giorno e notte, meteo** (sereno, nuvole, nebbia, pioggia, neve) e qualità grafica da Bassa a Ultra 4K.
- **Minimappa e mappa grande** con ricerca dei luoghi e scelta del punto di partenza.

Non ci sono ancora: avversari, multiplayer, il resto del Ticino.

## Struttura della repository

| Cartella | Contenuto |
|---|---|
| [`anteprima/`](anteprima/) | L'anteprima giocabile: pagina, codice del gioco (`src/`), app Electron. Vedi [`anteprima/LEGGIMI.md`](anteprima/LEGGIMI.md) |
| [`tools/geo/`](tools/geo/) | Script Python che scaricano i dati (swisstopo, OpenStreetMap) e li preparano. Vedi [`tools/geo/LEGGIMI.md`](tools/geo/LEGGIMI.md) |
| [`tools/moto/`](tools/moto/) | Script Blender che creano i modelli 3D di moto, auto e alberi |
| [`tools/anteprima_prova/`](tools/anteprima_prova/) | Prove automatiche dell'anteprima (screenshot, quote delle strade, benchmark) |
| [`unreal/`](unreal/) | Progetto Unreal Engine 5. Vedi [`docs/GUIDA_UNREAL.md`](docs/GUIDA_UNREAL.md) e [`docs/unreal/`](docs/unreal/) |
| [`docs/`](docs/) | Stima, backlog, bug, licenze, piani e report degli sprint |

## Come nasce una release

1. Si cambia la versione in `anteprima/package.json` (e in `anteprima/src/gioco.js`) e si aggiorna `anteprima/NOTE_RELEASE.md`.
2. Si fa il push su `main`.
3. Il workflow [`release-anteprima.yml`](.github/workflows/release-anteprima.yml) scarica i dati veri, esegue i passi di `tools/geo`, costruisce l'app su Mac e Windows e pubblica i file nella pagina Releases con il tag `anteprima-vX.Y.Z`. Ci mette circa un quarto d'ora.

## Provare l'anteprima dal codice

Servono Node.js 20 e i dati in `anteprima/dati` (non sono nella repository: sono troppo grandi).

Con i dati veri, creati dagli script (serve Python 3):

```bash
cd tools/geo
python3 avvia_pilota.py
python3 passo7_esporta_anteprima.py
cd ../../anteprima
npm install
npm start
```

Oppure, senza scaricare niente, con dati di prova finti (8 paesi inventati, stesso formato):

```bash
node tools/anteprima_prova/genera_dati_prova.mjs
```

I dati veri già pronti si trovano anche in ogni release, nel file `dati-anteprima.zip`: basta scompattarlo in `anteprima/dati`.

Controllo veloce delle strade (senza aprire il gioco):

```bash
node tools/anteprima_prova/prova_quote.mjs
```

## Documenti

- Stima del mondo: [`docs/stima/stima-mondo-ticino.md`](docs/stima/stima-mondo-ticino.md) (anche in PDF)
- Progetto dell'anteprima: [`docs/anteprima/PROGETTO_ANTEPRIMA.md`](docs/anteprima/PROGETTO_ANTEPRIMA.md)
- Piano tecnico Unreal: [`docs/unreal/PIANO_TECNICO_UE5.md`](docs/unreal/PIANO_TECNICO_UE5.md), come aprirlo: [`docs/unreal/COME_APRIRE.md`](docs/unreal/COME_APRIRE.md)
- Product Backlog: [`docs/PRODUCT_BACKLOG.md`](docs/PRODUCT_BACKLOG.md)
- Bug Tracker: [`docs/BUG_TRACKER.md`](docs/BUG_TRACKER.md)
- Fonti e licenze: [`docs/FONTI_E_LICENZE.md`](docs/FONTI_E_LICENZE.md)
- Sprint (piano e report in ogni cartella):
  - Anteprima: [`V2`](docs/sprint-V2/) (meteo, benchmark, prestazioni), [`V1`](docs/sprint-V1/) (upgrade grafico), [`H3`](docs/sprint-H3/) (moto e piloti 3D, case, alberi), [`H2`](docs/sprint-H2/) (fisica, cadute, nuove moto), [`H1`](docs/sprint-H1/) (Tenero, gallerie, foto aeree), [`G1`](docs/sprint-G1/) (garage), [`F1`](docs/sprint-F1/) (correzioni, teleferiche, chiese), [`E1`](docs/sprint-E1/) (prestazioni), [`D2`](docs/sprint-D2/) (segnaletica), [`D1`](docs/sprint-D1/) (edifici e boschi), [`C1`](docs/sprint-C1/) (acqua, gallerie, ponti)
  - Unreal: [`U2`](docs/sprint-U2/), [`U1`](docs/sprint-U1/)
  - Inizio: [`A`](docs/sprint-A/) (dati geografici, terreno), [`0`](docs/sprint-0/) (stima e decisioni)

Dalla versione 0.14.2 le novità dell'anteprima sono scritte solo in [`anteprima/NOTE_RELEASE.md`](anteprima/NOTE_RELEASE.md).

## Metodo di lavoro: Scrum

- Si lavora **uno Sprint alla volta**.
- All'inizio di ogni Sprint: `docs/sprint-X/SPRINT_PLAN.md`.
- Alla fine di ogni Sprint: `docs/sprint-X/SPRINT_REPORT.md`, poi si aggiornano Product Backlog e Bug Tracker.
- Uno Sprint è finito solo se tutti i punti della sua "Definition of Done" sono veri.
- Non si dichiara completata una parte della mappa se è stata fatta solo in parte.

## Attribuzioni

Dati: © OpenStreetMap contributors (ODbL) · Fonte: Ufficio federale di topografia swisstopo (swissALTI3D, SWISSIMAGE).
Dettagli in [`docs/FONTI_E_LICENZE.md`](docs/FONTI_E_LICENZE.md).
