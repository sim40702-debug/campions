# Sprint D2 – Report

Stato: **fatto** (manca solo la prova di Simone).

## Dati veri del pilota (release 0.3.1)

| Elemento OSM | Quanti |
|---|---|
| Semafori | 24 |
| Stop | 84 |
| Precedenze | 109 |
| Lampioni | 194 |
| Strisce pedonali | 325 |
| Località | 20 |

## Prove

- App Electron con dati di prova: cartelli, semafori, lampioni e strisce gialle visibili e al bordo della strada; nome della località sullo schermo; nomi dei paesi sulla minimappa. Nessun errore.
- Con i dati veri (durante lo Sprint C1): minimappa con 20 località, scritta "Brione sopra Minusio" vicino alla galleria Mappo-Morettina.

## Note

- I lampioni mappati in OSM sono pochi (194 in 64 km²): molte strade non ne hanno. Si potranno aggiungere in automatico più avanti.
- Il guardrail è calcolato dal terreno (scarpata di più di 1,5 m a lato), non da OSM.
