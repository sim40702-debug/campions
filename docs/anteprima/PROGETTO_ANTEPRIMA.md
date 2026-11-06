---
title: "MOTO RACING WORLD – Anteprima Ticino"
subtitle: "Progetto da valutare prima del codice · versione giocabile in Three.js + Electron (Mac e Windows) · 6 novembre 2026"
---

# 1. Cos'è

Una **versione leggera e giocabile** del settore pilota di Locarno, fatta in **Three.js** e compilata con **Electron**, come la Imola Edition.

- Funziona sul tuo **MacBook Air** e su qualsiasi PC Windows normale.
- Usa **gli stessi dati veri** degli script dello Sprint A (terreno swisstopo, strade OpenStreetMap).
- **Non sostituisce** la versione Unreal: serve per provare subito la mappa e per controllare che i dati siano giusti.

# 2. Cosa c'è nella prima versione (0.1)

| Parte | Contenuto |
|---|---|
| Mappa | Settore pilota 8 × 8 km: Locarno, Ascona, Ponte Brolla, Muralto, Minusio |
| Terreno | Terreno vero swissALTI3D, un punto ogni **4 m** (più leggero dei 2 m di Unreal) |
| Strade | Strade OSM come nastri di asfalto, larghezza in base al tipo, linee di mezzeria |
| Lago | Lago Maggiore come superficie d'acqua a 193 m |
| Moto | Guida **arcade** semplice: accelera, frena, sterza, piega in curva, segue le salite |
| Telecamera | Terza persona dietro la moto, tasto per cambiarla |
| Schermo | Velocità, quota reale, coordinate LV95, nome della strada |
| Minimappa | Vista dall'alto con le strade e la posizione della moto |
| Comandi | Tastiera (frecce o WASD), R per tornare sulla strada più vicina |

**Non c'è** (arriverà dopo o solo in Unreal): edifici, alberi, gallerie scavate nel terreno, avversari, multiplayer.

# 3. Come funziona

1. Gli script dello Sprint A creano i dati del pilota (passi 1–6).
2. Un nuovo **passo 7** prepara i dati per l'anteprima: terreno a 4 m (PNG) e strade (JSON) nella cartella `anteprima/dati`.
3. L'anteprima li carica e costruisce il mondo 3D.
4. Tu la compili con Electron per **Mac** e **Windows**, come la Imola Edition.

**Cartelle nella repo `campions`**

| Cartella | Contenuto |
|---|---|
| `tools/geo/passo7_esporta_anteprima.py` | Prepara i dati per l'anteprima |
| `anteprima/` | Gioco Three.js + Electron |
| `anteprima/dati/` | Dati creati dal passo 7 (non vanno su Git) |

# 4. Prestazioni previste

- Terreno: circa 2'000 × 2'000 punti, diviso in 16 pezzi da 2 × 2 km (si disegnano solo quelli vicini con il dettaglio pieno).
- Strade: qualche centinaio di km nel pilota.
- Obiettivo: **60 FPS** sul MacBook Air M2 a risoluzione normale.

# 5. Scrum

- Nuovo elemento del backlog **TI-24 – Anteprima giocabile (Three.js + Electron)**, nello Sprint A, perché serve anche a verificare i dati.
- Release **0.1** quando si può guidare sul pilota. Poi ogni miglioramento è una versione piccola (0.1.1, 0.1.2, …).
- Lo Sprint A si chiude solo quando il pilota è stato controllato con i dati veri.

# 6. Scelte da fare

| # | Scelta | Proposta |
|---|---|---|
| P1 | Dettaglio del terreno nell'anteprima | 4 m |
| P2 | Tipo di guida | Arcade semplice (non una simulazione) |
| P3 | Moto e codice della Imola Edition | **Riusare** la moto e i comandi della Imola Edition (repo `moto`), se mi dai accesso; altrimenti faccio una moto semplice nuova |
| P4 | Cosa provi per primo | Giro Locarno – Ascona – Ponte Brolla sulle strade vere |

# 7. Cosa devi fare tu

1. Lanciare `python3 avvia_pilota.py` (vedi `tools/geo/LEGGIMI.md`) e poi il passo 7.
2. Avviare l'anteprima con `npm install` e `npm start`, oppure compilarla con Electron.
3. Dirmi cosa non va (strade storte, terreno strano, comandi).

**Nota:** le strade saranno "appoggiate" sul terreno. In alcuni punti (ponti, gallerie, strade molto ripide) all'inizio potranno sembrare strane: è proprio quello che vogliamo scoprire prima di farle in Unreal nello Sprint B.
