# Sprint F1 – Report

Stato: **fatto**, manca la conferma di Simone su erba, saltelli, case e piante.

## Dati veri (release 0.6.0 / 0.6.1)

| Elemento | Valore |
|---|---|
| Punti del terreno spianati sotto strade e binari | 220'175 |
| Strade ristrette per non entrare nelle case | 384 tratti |
| Edifici (senza tettoie e sotterranei) | 13'778 |
| Chiese / campanili | 53 / 9 |
| Binari | 109 tratti (53 ferrovia normale, 38 scartamento ridotto, 18 funicolare) |
| Funivia Orselina – Cardada | 6 punti (stazioni e piloni) |
| Seggiovia Cardada – Cimetta | 10 punti |

## Prova con i dati veri (app Electron)

- Funivia Orselina – Cardada con le funi sopra la collina, seggiovia fino alla Cimetta con le sedie.
- Funicolare Locarno – Madonna del Sasso con la vettura rossa sul binario.
- Strada in collina (Via Orselina) senza erba sull'asfalto.

## Problemi durante lo Sprint

- Il server Overpass ha risposto "502 Bad Gateway": la release 0.6.0 non era uscita. Ora si usano server di riserva e i dati già scaricati vengono riusati.
- La funicolare in OSM è divisa in 18 pezzi: nella 0.6.0 ogni pezzo aveva le sue vetture. Corretto nella 0.6.1 (pezzi uniti).
