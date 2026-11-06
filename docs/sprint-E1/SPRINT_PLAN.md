# Sprint E1 – Prestazioni e impostazioni (settore pilota)

Data: 6 novembre 2026 · Release: 0.5.0

## Obiettivo

Fare nel pilota la parte dello Sprint E: misurare le prestazioni e poterle regolare.

## Elementi del backlog

| ID | Elemento |
|---|---|
| TI-18 | Ottimizzazione (qualità regolabile, dettaglio del terreno, alberi) |
| TI-22 | Misura prestazioni (FPS, triangoli, disegni, memoria) |

## Compiti

1. Menu **Impostazioni** (tasto Esc o pulsante): qualità Bassa / Media / Alta, ricordata per la volta dopo.
2. La qualità regola: risoluzione (pixel ratio), distanza e densità degli alberi, visibilità (nebbia), distanza del terreno a dettaglio pieno.
3. Contatore **FPS** (tasto F) con triangoli e disegni (draw call).
4. **Test prestazioni** automatico di 40 s: la telecamera vola su Locarno, Ascona, Ponte Brolla, i boschi sopra Orselina e Minusio; alla fine mostra FPS medi, FPS dell'1 % più lento, triangoli, disegni, memoria. Pulsante "Copia".

## Definition of Done

- [x] Menu, contatore e test funzionano nell'app Electron (prova con i dati veri).
- [x] Release 0.5.0 per Mac e Windows.
- [ ] Simone esegue il test sul suo MacBook Air M2 (almeno con qualità Media) e manda il risultato.
- [ ] Risultati scritti nello Sprint Report; se la Media sta sotto i 30 FPS, Sprint E2 di ottimizzazione.
