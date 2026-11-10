# Sprint V1 – Upgrade grafico dell'anteprima (0.14.0)

Obiettivo: portare la qualità visiva dell'anteprima Three.js al massimo raggiungibile con la tecnologia attuale
(Three.js + Electron, dati swisstopo/OpenStreetMap), senza perdere fluidità, e fare in modo che **tutte** le città
del Locarnese (e ogni paese che arriverà con i dati) ne traggano vantaggio.

## Analisi dello stato di partenza (0.13.1)

| Area | Problema |
|---|---|
| Edifici | 4 texture ripetute (una finestra ogni 3 m), muri tutti uguali, 6 colori, tetti senza gronda né dettagli, nessuna notte |
| Città | nessuna differenza tra Locarno, Ascona, Tenero…: stessi colori, stesse facciate, stessi tetti |
| Luce | un solo sole fisso, ombre solo 40 × 40 m, niente ora del giorno, niente notte, cielo fisso |
| Strade | un colore piatto, nessun marciapiede, righe di bordo mancanti |
| Arredo | lampioni spenti, nessun alone, nessuna panchina/cestino/pensilina, nessun cartello di località |
| Verde | 3 forme di albero, tutte uguali tra loro, nessun verde urbano, nessuna palma |
| Acqua | lago e fiumi in colore piatto |
| Terreno | senza foto aerea: colori a pochi livelli, nessuna grana |
| Minimappa | 220 px, strade bianche di 1 px, nessun edificio/bosco/lago, nessuno zoom, mappa grande = stessa immagine ingrandita |

## Piano tecnico

1. `ambiente.js`: ora del giorno (sole e luna astronomici per Locarno), cielo, stelle, nuvole procedurali, nebbia, meteo, variabile `notte` condivisa.
2. `luoghi.js`: identità di ogni paese (famiglia di colori, mix di facciate, balconi, palme, alberi di strada) da nome/tabella; vale per qualsiasi località OSM.
3. `facciate.js` + `edifici.js`: 8 tipi di facciata × 4 varianti scelte per ogni finestra dalla scheda video, finestre che si accendono di notte, vetri riflettenti; quartieri (storico/commerciale/industriale/residenziale/periferia) ricavati dalla densità degli edifici; negozi al piano terra, zoccoli, cornicioni, parapetti, gronde, comignoli, pannelli solari, balconi, impianti sui tetti, ardesia in quota.
4. `strade.js`: asfalto con grana/rattoppi/carreggiate, righe di bordo, marciapiedi con cordolo (interrotti agli incroci e stretti vicino ai muri), pezzi da 1 km.
5. `arredo.js`: lampioni accesi con alone e macchia di luce, panchine, cestini, pensiline, cartelli pedoni, ingresso paese con limite 50.
6. `alberi.js`: 7 specie, tinte e grandezze diverse, vento, verde urbano per paese.
7. `terreno.js`, `onde.js`, `acqua.js`: grana a due scale, palette ricca (neve, roccia, ghiaia, fondale), lago e fiumi con onde e riflessi del cielo.
8. `mappa.js` + `partenza.js`: motore unico vettoriale per minimappa e mappa grande (rilievo, lago e boschi dal terreno, acque, quartieri, edifici, strade gerarchiche, ponti/gallerie, ferrovie, nomi, POI, ricerca, filtri, zoom, rotazione).
9. `impostazioni.js`: ora, meteo, nuvole, ombre degli edifici; qualità con LOD di edifici e dettagli.
10. Dati: `tools/geo` esporta anche parchi/giardini/prati (`uso_suolo.json`, opzionale).
11. Test: dati di prova (`tools/anteprima_prova`) con 8 paesi diversi + prove visive automatiche in Chromium.

## Definition of Done

- Tutte le città dei dati (con nomi qualsiasi) ricevono identità, quartieri, arredo e verde.
- Giorno, tramonto e notte provati; la notte accende finestre, lampioni e faro.
- Minimappa e mappa grande funzionano e mostrano il mondo vero.
- Nessun errore in console, il gioco carica; contatori delle chiamate alla scheda video misurati.
- Report con i limiti rimasti (non provato su GPU vera: vedi report).
