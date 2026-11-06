# Sprint 0 – Report

Stato: **CHIUSO** (6 novembre 2026)

## Fatto

- Struttura Scrum creata nella repository.
- Stima del mondo scritta: `docs/stima/stima-mondo-ticino.md` e `docs/stima/stima-mondo-ticino.pdf`.
- Product Backlog con le 8 regioni.
- Fonti e licenze: prima verifica di OpenStreetMap (ODbL) e swisstopo (OGD, citare la fonte).
- Simone ha accettato tutte le proposte (D1–D8).

## Risultati principali della stima

- Mondo in scala 1:1, terreno a circa 2 m.
- Area caricata in dettaglio attorno al giocatore: circa 13–16 km².
- Memoria in gioco stimata: 3–5 GB RAM, 4,5–7,5 GB memoria video.
- Gioco installato stimato: 15–30 GB.

## Correzione dopo la chiusura della stima

Calcolando le coordinate LV95 reali dei punti estremi del Ticino, il rettangolo di 64 km da est a ovest era **troppo stretto** (il Ticino va da circa 2'672 km a 2'733 km est, quasi senza margine).
Nuovo rettangolo: **68 × 96 km** (est 2'668–2'736 km, nord 1'074–1'170 km), quindi **408 settori** (17 × 24).
La stima è stata aggiornata. Lo script del passo 4 controlla in automatico che il Ticino stia tutto dentro.

## Decisioni prese

| # | Decisione | Scelta |
|---|---|---|
| D1 | Scala | 1:1 |
| D2 | Risoluzione terreno | circa 2 m (esattamente 1,9685 m, per avere 4 km = 2032 quad) |
| D3 | Strade incluse | Strade pubbliche asfaltate; sterrate più avanti |
| D4 | Strade che escono dal Ticino | Finiscono al confine con barriera e punto per girare |
| D5 | Settore pilota | Locarno – Ascona – Ponte Brolla (est 2'700–2'708 km, nord 1'110–1'118 km) |
| D6 | Giocatori iniziali | Massimo 8 |
| D7 | PC di sviluppo | Almeno 32 GB RAM, SSD 1 TB, scheda video 8 GB |
| D8 | Versione Unreal | Ultima versione stabile di UE5 all'inizio dello Sprint A, poi fissa |

## Nuovo requisito

- Il gioco e gli strumenti devono funzionare **sia su Mac sia su Windows** (aggiunto al backlog come TI-23).

## Bug trovati

Nessuno (nessun codice in questo Sprint).
