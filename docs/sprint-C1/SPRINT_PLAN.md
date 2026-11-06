# Sprint C1 – Fiumi, gallerie, ponti (settore pilota)

Data: 6 novembre 2026 · Release: 0.4.0

## Obiettivo

Fare nel pilota la parte dello Sprint C: acqua, gallerie vere e ponti con i piloni.

## Elementi del backlog

| ID | Elemento |
|---|---|
| TI-12 | Laghi e fiumi |
| TI-13 | Ponti e gallerie (Mappo-Morettina, ponti sulla Maggia) |

## Compiti

1. Passo 2: scaricare da OSM superfici d'acqua (natural=water) e corsi d'acqua (fiumi, torrenti, canali).
2. Passo 7: esportare `acqua.json` (il Lago Maggiore resta la superficie piatta a 193,3 m; stagni piatti; fiumi che seguono il terreno).
3. Anteprima: superfici d'acqua e torrenti.
4. Anteprima: gallerie vere: tubo in cemento con pavimento, soffitto e luci ogni 24 m, portali agli ingressi.
5. Anteprima: il terreno si vede solo da sopra, così dentro la montagna si vede la galleria.
6. Anteprima: in galleria la telecamera resta bassa e dentro il tubo.
7. Anteprima: piloni sotto i ponti (ogni 28 m circa, dove il ponte è più alto di 3 m sul terreno).

## Definition of Done

- [x] Prova nell'app Electron con i dati veri: dentro la galleria Mappo-Morettina si vedono tubo, luci e strada; il ponte sulla Maggia ha i piloni.
- [x] Release 0.4.0 per Mac e Windows.
- [ ] Numero di superfici e corsi d'acqua scritto nello Sprint Report (dal registro della release).
- [ ] Simone ha provato la 0.4.0 (aggiornando con il pulsante).
