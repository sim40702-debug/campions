# Sprint V1 – Upgrade grafico dell'anteprima (0.14.0) – Report

Richiesta di Simone: upgrade grafico sostanziale di tutto il progetto (grafica, realismo, minimappa, **tutte** le città, dettagli, prestazioni).

## Fatto

**Luce e atmosfera** (`ambiente.js`): ora del giorno (tasto T, cursore, ciclo automatico), sole e luna astronomici per Locarno, cielo con stelle, nuvole procedurali, nebbia e 4 meteo, riflessi presi dal cielo vero (PMREM rifatto quando cambia l'ora), ombre fino a 75 m anche dagli edifici, faro della moto di notte.

**Città** (`luoghi.js`, `facciate.js`, `edifici.js`): l'identità di ogni paese nasce dal nome (palette dei muri e dei tetti, mix di facciate, balconi, palme, alberi di strada; tabella per Locarno, Muralto, Ascona, Minusio, Tenero, Gordola, Losone, Ponte Brolla, Tegna, Bellinzona, Lugano). I quartieri (centro storico, commerciale, industriale, residenziale, periferia) si ricavano dalla densità e dalla grandezza degli edifici, quindi valgono per **ogni** città dei dati. Facciate: 8 tipi × 4 varianti scelte per ogni finestra dalla scheda video, vetri riflettenti, finestre e vetrine che si accendono di notte, negozi al piano terra sulle vie del centro, zoccoli, cornicioni, parapetti, gronde, comignoli, pannelli solari, balconi, impianti sui tetti, ardesia in quota.

**Strade e arredo** (`strade.js`, `arredo.js`, `dettagli.js`): asfalto con grana, rattoppi e carreggiate; mezzeria e righe di bordo che si fermano agli incroci; marciapiedi con cordolo (interrotti agli incroci, stretti vicino ai muri); lampioni accesi con alone e macchia di luce; panchine, cestini, pensiline, cartelli "pedoni", cartello di località con limite 50.

**Verde, acqua, terreno** (`alberi.js`, `onde.js`, `acqua.js`, `terreno.js`): 7 specie con tinta e scala diverse, vento, verde urbano per paese (palme sul lungolago); lago e fiumi con onde e riflessi; terreno con grana a due scale e palette ricca (neve, roccia, ghiaia, fondale).

**Minimappa e mappa** (`mappa.js`, `partenza.js`): un solo motore vettoriale (rilievo, lago e boschi dal terreno con marching squares, acque OSM, quartieri, edifici, strade gerarchiche con bordo, ponti, gallerie, ferrovie, teleferiche, nomi lungo le strade, nomi dei paesi senza sovrapposizioni, POI). Minimappa rotonda 240 px che ruota con la moto o resta a nord, zoom con rotellina e pulsanti, palette scura di notte. Mappa grande (P / N): trascinamento, zoom sul cursore, ricerca di paesi/strade/luoghi, 10 livelli attivabili, segnaposto con strada/zona/quota/LV95, "Parti da qui" o doppio clic. Il file opzionale `uso_suolo.json` (esportato da `tools/geo`) aggiunge parchi e giardini.

**Impostazioni** (`impostazioni.js`): qualità Bassa / Media / Alta / Ultra 4K con distanza di vista degli edifici, distanza dei dettagli (LOD), area delle ombre, nuvole; ora, meteo, nuvole e ombre degli edifici regolabili.

## Ottimizzazioni

- Edifici in pezzi da 500 m con culling per distanza; balconi, comignoli, impianti e pannelli solari in pezzi da 250 m visibili solo vicino alla moto.
- Lampioni, segnali e arredo "instanced" divisi in celle da 400 m (la scheda video scarta quelli fuori schermo e fuori dalle ombre).
- Terreno "vicino" a mezzo dettaglio (un punto ogni 8 m) oltre 1 km dalla moto.
- Minimappa: la mappa si ridisegna solo quando la moto si sposta di un quarto di schermata, non ad ogni fotogramma.
- Strade e marciapiedi in pezzi da 1 km.
- Misurato sui dati di prova (Media): triangoli per fotogramma 4,0 M → 2,9 M (-26%) con le celle e il terreno a mezzo dettaglio.

## Provato

Browser Chromium senza scheda video (SwiftShader), con `tools/anteprima_prova`: 8 paesi finti di carattere diverso (28 000 edifici, 374 strade, lago, fiume, boschi, ferrovia) nello stesso formato dei dati veri.

| Prova | Esito |
|---|---|
| Caricamento (Bassa / Media / Alta / Ultra) | 12–19 s, nessun errore né avviso in console (solo il 404 atteso delle foto aeree) |
| Giorno, tramonto, notte; centro storico, lungolago, industriale, borgo di pietra | schermate controllate a mano |
| Minimappa (giorno e notte) e mappa grande con ricerca, segnaposto, zoom | funzionano |
| Menu Impostazioni (ora, meteo, nuvole, ombre) | funziona |
| Contatori Media | 493–878 chiamate, 2,4–2,9 M triangoli per fotogramma |
| Esportazione Python `uso_suolo` | provata su un file OSM d'esempio |

Errori trovati e corretti durante le prove: puntini casuali sulle finestre (variabile del programma grafico interpolata: ora `flat`), righe di bordo che attraversavano gli incroci, lettera "p" scritta nella ricerca aprendo la mappa, menu più alto dello schermo.

## Limiti e cose da fare

- **Non provato su una scheda video vera né con i dati veri di OpenStreetMap** (Overpass non raggiungibile da qui): gli FPS veri vanno misurati sui computer di Simone (menu Impostazioni → Test prestazioni).
- I quartieri vengono dall'analisi degli edifici: con l'uso del suolo OSM (`uso_suolo.json`) si possono rendere ancora più fedeli.
- App Electron impacchettata non ricostruita in questo ambiente: i file nuovi stanno tutti in `src/` (già inclusi dal pacchetto) e non servono altre librerie.
- Pioggia e neve non ci sono (solo sereno, variabile, nuvoloso, nebbia).
