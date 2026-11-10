# Sprint V2 – Anteprima 0.14.1: meteo completo, benchmark, mondo più curato

Parte da: commit `a6bb508` (0.14.0), branch `claude/magical-hopper-j4az9x`.

| Fase | Contenuto | Esito atteso |
|---|---|---|
| 1 | Dati geografici (parchi, prati) | Verifica pipeline `tools/geo`, uso del suolo caricato in 3D e sulla mappa |
| 2 | Meteo | 8 condizioni + automatico; pioggia e neve 3D; asfalto bagnato; neve per quota e stagione |
| 3 | Prestazioni | Analisi colli di bottiglia, ottimizzazioni, benchmark ripetibile (8 scenari) |
| 4 | Qualità grafica | Verde urbano e parchi, correzione del lago, riflessi in pioggia |
| 5 | Tutte le località | Profili per ogni località dei dati (prova su 134 nomi ticinesi) |
| 6 | Mappa | Coordinate/quota sotto il cursore, tempi di disegno misurati |
| 7 | Electron | Ricostruzione del pacchetto e prova dell'app impacchettata |
| 8 | Test | Suite automatica (`prova_completa.mjs`, `prova_luoghi.mjs`, `prova_electron.mjs`) |
| 9 | GitHub | Commit e push sul branch, nessuna PR, nessun force |
