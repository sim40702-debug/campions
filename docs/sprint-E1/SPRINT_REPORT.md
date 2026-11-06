# Sprint E1 – Report

Stato: **in attesa del test di Simone** sul MacBook Air M2.

## Misure fatte qui (senza scheda video, quindi gli FPS non contano)

Vista sopra Ascona verso Locarno, dati veri della 0.4.0:

| Qualità | Triangoli | Disegni (draw call) |
|---|---|---|
| Bassa | 1'876k | 72 |
| Media | 2'867k | 70 |
| Alta | 3'888k | 71 |

Memoria JavaScript durante il test: circa 325 MB.

I disegni sono pochi (circa 70) perché edifici, alberi, cartelli e strade sono uniti in pochi oggetti: questo aiuta molto le prestazioni.
La parte più pesante è il terreno vicino (circa 0,5 milioni di triangoli per ogni pezzo da 2 × 2 km a dettaglio pieno).

## Risultati del MacBook Air M2 (da compilare)

| Qualità | FPS medi | FPS 1 % più lento | Note |
|---|---|---|---|
| Bassa | | | |
| Media | | | |
| Alta | | | |
