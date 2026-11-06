# Sprint F1 – Correzioni e punti di interesse (settore pilota)

Data: 6 novembre 2026 · Release: 0.6.0

## Problemi segnalati da Simone (0.5.0)

- Strade con l'erba in mezzo.
- Strade non piane: la moto "saltella".
- Case sopra le strade.
- Piante sulle strade.
- Mancano teleferiche, chiese ecc.

## Cause trovate

| Problema | Causa |
|---|---|
| Erba sulle strade | L'asfalto era solo appoggiato sul terreno: dove il terreno (griglia di 4 m) era più alto della strada, l'erba passava sopra. Misura: 16,9 % dei punti controllati. |
| Saltelli | Profilo della strada poco liscio (media su 5 punti) e quota diversa tra due strade allo stesso incrocio. |
| Case sulle strade | Larghezze standard (per esempio 5 m per le vie di quartiere) troppo grandi per le vie strette della città vecchia. |
| Piante sulle strade | Gli alberi potevano nascere fino a 0,5 m dal bordo dell'asfalto: la chioma copriva la strada. |

## Soluzioni

1. Profilo liscio (media su circa 50 m) agganciato al terreno vero agli **incroci** e alle estremità: due strade che si incontrano hanno la stessa quota.
2. **Terreno spianato** sotto strade e binari: 15 cm sotto l'asfalto, banchina piatta di 2,5 m, raccordo di 3 m verso il terreno vero.
3. **Larghezza per punto**: la strada non entra nelle case (almeno 40 cm di distanza, minimo 3 m di larghezza).
4. Sulla strada niente collisione con gli edifici (portici, passaggi sotto le case).
5. Alberi almeno **3,5 m** lontani dal bordo dell'asfalto.
6. Moto: inclinazione avanti/indietro ammorbidita.
7. Terreno lontano: preso dal punto più basso dei vicini, così non copre le strade lontane.
8. Edifici: niente tettoie, edifici sotterranei o in costruzione.

## Nuovi elementi del backlog

| ID | Elemento |
|---|---|
| TI-28 | Teleferiche, cabinovie e seggiovie con cabine che si muovono |
| TI-29 | Funicolari con le vetture che si incrociano |
| TI-30 | Ferrovie (massicciata e binari) |
| TI-31 | Chiese (tetto a due falde) e campanili (guglia) |
| TI-32 | Tetti a due falde e a padiglione per le case |

## Prova (con il terreno vero di Locarno e strade ed edifici veri)

| Controllo | 0.5.0 | 0.6.0 |
|---|---|---|
| Punti della strada con il terreno sopra l'asfalto | 16,9 % | **0,6 %** |
| Variazione di pendenza tra un punto e l'altro (99 % dei punti) | 0,18 m | **0,13 m** |
| Strade ristrette per non entrare nelle case | – | 402 tratti |

## Definition of Done

- [x] Prova nell'app Electron: strade in collina senza erba, tetti, chiese con campanile, funi della teleferica.
- [ ] Release 0.6.0 con i dati veri di teleferiche, funicolare e ferrovie (numeri nello Sprint Report).
- [ ] Simone conferma che erba, saltelli, case e piante sulle strade sono risolti.
