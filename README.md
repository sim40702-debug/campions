# MOTO RACING WORLD

Gioco di moto open world in Unreal Engine 5.
La prima mappa esplorabile è il **Canton Ticino** (Svizzera), ricostruito da dati geografici aperti.

## Stato attuale

**Sprint A – Dati geografici, licenze, confini, terreno** (in corso).
Sprint 0 chiuso: stima approvata, decisioni D1–D8 accettate.

**Anteprima giocabile** (Mac e Windows): scaricala dalla pagina Releases, vedi `anteprima/LEGGIMI.md`.

Funziona su **Mac e Windows**: script Python in `tools/geo` (vedi `tools/geo/LEGGIMI.md`), import in Unreal con `docs/GUIDA_UNREAL.md`.

- Stima del mondo: [`docs/stima/stima-mondo-ticino.md`](docs/stima/stima-mondo-ticino.md) (anche in PDF nella stessa cartella)
- Product Backlog: [`docs/PRODUCT_BACKLOG.md`](docs/PRODUCT_BACKLOG.md)
- Sprint attuale: [`docs/sprint-D1/`](docs/sprint-D1/) (edifici e boschi del pilota). Sprint A: [`docs/sprint-A/`](docs/sprint-A/) (parte Unreal in attesa del PC, D7). Sprint 0: [`docs/sprint-0/`](docs/sprint-0/)
- Bug Tracker: [`docs/BUG_TRACKER.md`](docs/BUG_TRACKER.md)
- Fonti e licenze: [`docs/FONTI_E_LICENZE.md`](docs/FONTI_E_LICENZE.md)

## Metodo di lavoro: Scrum

- Si lavora **uno Sprint alla volta**.
- All'inizio di ogni Sprint: `docs/sprint-X/SPRINT_PLAN.md`.
- Alla fine di ogni Sprint: `docs/sprint-X/SPRINT_REPORT.md`, poi si aggiornano Product Backlog e Bug Tracker.
- Uno Sprint è finito solo se tutti i punti della sua "Definition of Done" sono veri.
- Non si dichiara completata una parte della mappa se è stata fatta solo in parte.

## Sprint previsti

| Sprint | Contenuto |
|---|---|
| 0 | Stima, settori, costi, decisioni (chiuso) |
| A | Dati geografici, licenze, confini, terreno (con settore pilota) – in corso |
| B | Rete stradale 3D e collegamenti |
| C | Montagne, laghi, fiumi, ponti, gallerie |
| D | Edifici, vegetazione, segnaletica, dettagli |
| E | Ottimizzazione, test esplorazione, collegamenti, prestazioni |

## Attribuzioni

Dati: © OpenStreetMap contributors (ODbL) · Fonte: Ufficio federale di topografia swisstopo.
Dettagli in [`docs/FONTI_E_LICENZE.md`](docs/FONTI_E_LICENZE.md).
