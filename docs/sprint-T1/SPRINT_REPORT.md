# Sprint T1 – Ticino completo (branch `feature/ticino-completo`) – Report

Versione di prova: **0.16.0-ticino.2**. Il branch `main` (anteprima 0.15.2) non è stato toccato e non c'è stato nessun merge.

## Ambiente di misura (da leggere prima dei numeri)

Cloud Linux, **nessuna scheda video** (grafica software SwiftShader, 0,2–0,3 FPS): gli **FPS non rappresentano un PC o un Mac vero**.
Memoria, tempi di caricamento, triangoli e chiamate sono invece indicativi. **Non provato su un Mac vero** (le app per Mac le costruisce GitHub).
I dati usati nelle prove sono quelli **veri** pubblicati nella pre-release `ticino-completo-dati`.

## Dati geografici

| Dato | Fonte | Licenza |
|---|---|---|
| Terreno (quote, griglia 3,94 m) | swisstopo swissALTI3D | OGD swisstopo |
| Foto aeree | swisstopo SWISSIMAGE | OGD swisstopo |
| Strade, ponti, gallerie, edifici, località, laghi, fiumi, boschi, uso del suolo, ferrovie | OpenStreetMap (Overpass) | ODbL |
| Confine cantonale e distretti (zone) | OpenStreetMap (relazioni amministrative) | ODbL |

Niente è stato preso da Google Maps o Street View.

## Cosa c'è

- **19 regioni** da 24 × 24 km (cuore 16 × 16 km + margine 4 km), tutte nelle stesse coordinate LV95: **2 812,1 km² su 2 812,2 km² del cantone** (0 punti di terreno senza dati dentro il confine).
- **5 719 km di strade** nei cuori delle regioni (3 692 km dentro il confine cantonale), **262 549 edifici**, 1 007 località, 78 laghi, 552 tratti di fiume, 68,7 km di ponti e 43,4 km di gallerie.
- **Rete stradale collegata al 99,34 %** (3 667,7 km in un solo gruppo). Restano **47 gruppi staccati** (il più grande 8,15 km): sono strade che in OpenStreetMap si collegano al resto solo con tratti non importati (piste, strade private, tratti in Italia). Non sono stati inventati collegamenti.
- Pacchetti: **1,93 GB in tutto** (68–118 MB per regione, compressi; 130–180 MB aperti). Dentro l'app c'è la regione di Locarno, le altre si scaricano entrando.
- Mappa del cantone (tasto K): rilievo, confine, distretti, strade principali, laghi, ricerca di ogni località, coordinate svizzere, quota, partenza in qualsiasi regione.

## Problema trovato e corretto in questo sprint: memoria (BUG-009)

Nelle regioni fitte il gioco costruiva subito **tutti** gli edifici e **tutte** le strade della regione:
Mendrisiotto (90 881 edifici, 16 936 tratti di strada) → **2,5 GB** di memoria, e il caricamento poteva chiudersi per memoria esaurita.

Correzione: edifici (pezzi da 500 m) e disegno delle strade (pezzi da 1 km) si costruiscono **solo vicino alla moto**, pochi millisecondi per fotogramma, e i pezzi lontani si tolgono (anche dalla memoria della scheda video).
I dati per collisioni, quote, minimappa e ricerca restano tutti caricati.

| Regione | Prima | Dopo |
|---|---|---|
| Mendrisiotto (Chiasso) | 2 547 MB | 572 MB |
| Luganese (Lugano) | 1 565 MB | 520 MB |

## Prova di guida con i dati veri (tutte le 19 regioni)

Per ogni luogo: partenza scelta in coordinate svizzere, caricamento, moto sulla strada, gas per alcuni secondi, nessun errore.

| Luogo | Regione | Dove dice di essere il gioco | Quota m | Caricamento s | Memoria MB | Guida ok |
|---|---|---|---|---|---|---|
| Chiasso | R_2712_1074 | Chiasso · Mendrisiotto – Via Valdani | 234 | 92 | 572 | sì |
| Mendrisio | R_2712_1074 | Mendrisio · Mendrisiotto – Via Beroldingen | 338 | 91 | 557 | sì |
| Muggio | R_2712_1074 | Cabbio · Mendrisiotto – Strada senza nome | 563 | 88 | 578 | sì |
| Morcote | R_2712_1074 | Cuasso al Lago – Via Casamora | 275 | 89 | 603 | sì |
| Lugano | R_2712_1090 | Lugano · Luganese – Via della Posta | 273 | 55 | 520 | sì |
| Tesserete | R_2712_1090 | Bigorio · Luganese – Strada senza nome | 619 | 64 | 516 | sì |
| Rivera | R_2712_1106 | Soresina · Luganese – Strada senza nome | 559 | 53 | 463 | sì |
| Bellinzona | R_2712_1106 | Bellinzona · Bellinzonese – Largo Elvezia | 228 | 43 | 474 | sì |
| Carena | R_2728_1106 | Carena · Bellinzonese – Via della Dogana | 955 | 34 | 442 | sì |
| Biasca | R_2712_1122 | Biasca · Riviera – Via Monda del Turco | 295 | 40 | 453 | sì |
| Acquarossa | R_2712_1138 | Corzoneso · Valle di Blenio – Via Cumiasca | 778 | 31 | 396 | sì |
| Olivone | R_2712_1154 | Olivone · Valle di Blenio – Via Chiesa San Martino | 902 | 26 | 379 | sì |
| Faido | R_2696_1138 | Faido · Leventina – Strada senza nome | 728 | 35 | 419 | sì |
| Airolo | R_2680_1138 | Airolo · Leventina – Via Olimpia | 1155 | 29 | 410 | sì |
| Bedretto | R_2680_1138 | Bedretto · Leventina – Via Bedretto | 1417 | 25 | 385 | sì |
| Sonogno | R_2696_1122 | Sonogno · Valle Verzasca – Strada de Redòrta | 936 | 23 | 392 | sì |
| Cevio | R_2680_1122 | Cevio Vecchio · Vallemaggia – Via Valmaggina | 416 | 25 | 392 | sì |
| BoscoGurin | R_2680_1122 | Bosco/Gurin · Vallemaggia – Dar Èdilwijss-Wagg | 1504 | 23 | 363 | sì |
| Peccia | R_2680_1138 | Piano di Peccia · Vallemaggia – Strada senza nome | 1042 | 24 | 355 | sì |
| SanCarloBavona | R_2680_1138 | San Carlo · Vallemaggia – Strada senza nome | 962 | 23 | 381 | sì |
| Intragna | R_2696_1106 | Intragna · Locarnese – Via Gottardo Piazzoni | 390 | 39 | 458 | sì |
| Russo | R_2680_1106 | Vocaglia · Locarnese – Strada senza nome | 982 | 24 | 416 | sì |
| Locarno | R_2696_1106 | Locarno · Locarnese – Via Borghese | 208 | 40 | 434 | sì |
| Caslano | R_2696_1090 | Ponte Tresa · Luganese – Via Mistomi | 393 | 62 | 476 | sì |
| CimalmottoCampo | R_2664_1122 | Pianelli di Sotto · Vallemaggia – Cavá | 1569 | 24 | 369 | sì |
| BordoOvest | – | passa subito alla regione vicina (vedi nota) | | | | |
| AllAcqua | R_2664_1138 | Leventina – Strada del Passo della Novena | 2099 | 10 | 367 | sì |
| PassoSanGottardo | R_2680_1154 | Leventina – Strada senza nome | 2086 | 25 | 361 | sì |
| PassoLucomagno | R_2696_1154 | Valle di Blenio – 416 | 1909 | 26 | 357 | sì |
| Cadenazzo | R_2696_1106 | Quartino · Locarnese – Via Centro Sportivo | 197 | 36 | 455 | sì |

Nota "BordoOvest": la regione R_2664_1106 contiene solo 1,1 km² di cantone, senza strade; il gioco mette la moto sulla strada più vicina, che è nella regione accanto, e ci passa (un caricamento in più, nessun ciclo).

**Passaggio di regione guidando** (da Locarnese a Bellinzonese, Piano di Magadino): stesso punto LV95 prima e dopo (2 715 375 / 1 113 352), moto sulla strada a Contone.

## Benchmark

`benchmark/benchmark_lugano_media_software.md`: 9 scenari nella regione di Lugano, qualità media. Gira senza errori; 3,1–3,9 milioni di triangoli, 320–1 880 chiamate, 405–463 MB di memoria JavaScript.
Gli FPS (0,14–0,30) sono di grafica software e **non dicono nulla** su una scheda video vera: il benchmark va rifatto dal menu del gioco su Mac e su PC.

## Cosa NON è fatto o non è verificato

- **Non provato su Mac o Windows veri**: prestazioni, fluidità mentre i pezzi si costruiscono, scaricamento delle regioni da GitHub (qui provato con un server locale e gli stessi pacchetti).
- **Il passaggio tra regioni ha un caricamento** (20–90 s qui, senza scheda video): non è ancora un mondo unico senza interruzioni.
- Edifici oltre 6 km e strade oltre circa 4 km (qualità media) non si disegnano: manca un livello di dettaglio semplice per le città lontane.
- 47 piccoli gruppi di strade staccati dalla rete (0,66 % dei km).
- Dighe, funivie e particolari fatti a mano esistono solo dove c'erano già (Verzasca); le altre regioni hanno gli elementi generati dai dati.
- Versione Unreal: non toccata in questo sprint.
