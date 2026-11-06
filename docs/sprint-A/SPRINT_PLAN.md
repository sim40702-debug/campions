# Sprint A – Dati geografici, licenze, confini, terreno

Data inizio: 6 novembre 2026

## Obiettivo dello Sprint

Avere i dati geografici scaricati e verificati, e il **settore pilota di Locarno (8 × 8 km)** esplorabile in Unreal con il terreno vero. Poi preparare il terreno di tutto il Ticino.

## Elementi del backlog

| ID | Elemento | Chi |
|---|---|---|
| TI-01 | Scaricare OSM, swissALTI3D, confini; registrare versioni e date | Script (Claude) + esecuzione (Simone) |
| TI-02 | Verifica licenze e testo attribuzioni | Claude |
| TI-03 | Script Python che trasformano i dati per Unreal | Claude |
| TI-04 | Settore pilota 8 × 8 km | Claude + Simone |
| TI-05 | Progetto UE5 con World Partition e griglie di caricamento | Simone (con la guida) |
| TI-06 | Confini cantonali importati | Claude + Simone |
| TI-07 | Terreno di tutto il Ticino | Claude + Simone |
| TI-23 | Funziona su Mac e Windows | Claude |

## Compiti

### Fatti da Claude in questo Sprint

1. Script in `tools/geo` (passi 1–6), uguali per Mac e Windows. **Fatto.**
2. Prova dei passi 3–6 con dati di prova (vedi Sprint Report). **Fatto.**
3. Guida per l'import in Unreal: `docs/GUIDA_UNREAL.md`. **Fatto.**
4. `.gitignore` e Git LFS per i file di Unreal. **Fatto.**

### Da fare da Simone

1. Installare Python e preparare l'ambiente (`tools/geo/LEGGIMI.md`).
2. Eseguire i passi 1–6 con `--pilota` e mandare a Claude quello che scrivono.
3. Creare il progetto Unreal e importare il terreno pilota (`docs/GUIDA_UNREAL.md`).
4. Controllare le quote di Piazza Grande e del lago (capitolo 5 della guida).
5. Se va tutto bene: eseguire i passi senza `--pilota` per tutto il Ticino e importarlo.

## Definition of Done

- [ ] Dati pilota scaricati, con data di download annotata nello Sprint Report.
- [ ] Passo 6 sul pilota: almeno il 99 % dei punti con errore sotto 1 m.
- [ ] Settore pilota importato in Unreal, quote di controllo corrette.
- [ ] Passo 4 su tutto il Ticino: superficie vicina a 2'812 km² e "il Ticino sta tutto nel rettangolo".
- [ ] Le 8 regioni trovate e assegnate ai settori (`settori.json`).
- [ ] Passo 5 su tutto il Ticino: km di strade **misurati** scritti nel Report e nella stima.
- [ ] Terreno di tutto il Ticino importato in Unreal, con il layer Confine.
- [ ] Funziona su Mac e su Windows (almeno gli script provati su uno dei due, il progetto aperto sull'altro quando possibile).
- [ ] Product Backlog, Sprint Report e Bug Tracker aggiornati.
