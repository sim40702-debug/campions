# Fase 3: terreno ad alta risoluzione e ambiente

Tutto e' stato provato nel gioco vero (Three.js) con i dati veri di Locarno-Muralto (swissALTI3D, SWISSIMAGE, OpenStreetMap, area 4 x 4 km), non con dati di prova. Le immagini sono in `screenshot/`.

## 1. Terreno ad alta risoluzione (priorita' 1)
- **Fonte**: SWISSIMAGE 10 cm di swisstopo (GeoTIFF "cloud optimized"). Si leggono a finestre, senza scaricare i file interi (circa 1 s per tassello).
- **Nuovo passo 9** (`tools/geo/passo9_foto_dettaglio.py`): tasselli da 500 m a **0,5 m/pixel** (1024 x 1024 px, 6 m di margine per lato contro le righe tra i tasselli), **solo dove c'e' una strada entro 220 m**. Nell'area provata: 62 tasselli, 19 MB, circa 1 minuto.
- **Gioco** (`src/terreno_hd.js`): carica i **4 tasselli attorno al giocatore** (blocco 2 x 2) e li sfuma nel programma del terreno con la foto a 2 m (piena nitidezza vicino, sfumatura tra il 55 % e il 100 % del raggio, nessuno stacco). L'altezza resta swissALTI3D, intatta. Vicino alla foto HD la grana di prova del terreno si spegne.
- **Memoria**: 4 texture da circa 5,6 MB (mipmap incluse), fino a 6 nei cambi di blocco: circa 22-34 MB, indipendente dalla grandezza della mappa. I tasselli lontani si scaricano.
- **Raggio per qualita'**: Bassa spenta, Media 170 m, Alta 215 m, Ultra 240 m.
- **Risultato** (`terreno_2m_senza_HD.png` contro `terreno_con_HD_0.5m.png`): erba e bordi della strada visibilmente piu' definiti e verdi.
- **Limite**: a 0,5 m/pixel da molto vicino resta morbido (un pixel = 50 cm) e sui pendii ripidi la foto, proiettata dall'alto, si allunga a strisce. Per piu' nitidezza servono tasselli a 0,25 m o una proiezione triplanare: non fatti.

## 2. Strade sopra il terreno (i 136 punti)
Confrontati con i tag OpenStreetMap: **nessuno e' marcato bridge, embankment o cutting** (uno solo e' un ponte vero). Guardati nel gioco:
- **A13 / strada 13 (8 m sopra il terreno)**: e' un **viadotto vero** (A13 sopra la valle, con pile, gallerie sotto). OSM non lo marca come ponte ma il gioco lo costruisce come struttura elevata (`viadotto_A13_reale.png`). Non va forzato al terreno.
- **Via ai Monti, Via Patocchi, Via dei Fiori, Via Monte Bre ecc.**: strade di mezza costa su muri di sostegno, gia' costruiti dal gioco (`muro_via_ai_monti.png`). Non sono errori di allineamento.
Cambiato: i **muri di sostegno** hanno ora cemento/pietra con macchie, grana e rilievo (prima una superficie piatta e scura).
Non toccato: nessun ponte o viadotto e' stato abbassato al terreno.

## 3. Ambiente
| Cosa | Fatto | Verificato guardando il gioco |
|---|---|---|
| Alberi | puntini di foglie, grumi di colore e normale ruvida da vicino (`alberi_fogliame.png`) | si |
| Facciate | zoccolo scuro al piano terra e patina per campata (fase 2) | poco visibile |
| Lampioni di notte | pozze di luce additive sull'asfalto sotto ogni lampione | **no** (nessun lampione vicino nelle prove) |
| Sole | riverbero (alone) quando il sole e' davanti alla camera | **no** (il sole non era in inquadratura) |
| Meteo | transizioni dolci di nuvole/nebbia/sole/grigio (~5-10 s); grading meno saturo con meteo brutto | **no** |
| Nuvole | strato alto di cirri | **no** |
Notte e finestre illuminate erano gia' buone (`prima_notte.png` / `dopo_notte.png`).
**Non fatto**: balconi e dettagli architettonici (i dati OSM non li hanno), erba/vegetazione bassa a istanze, ombre a cascata, fermate dell'autobus nuove (nel gioco ci sono gia' pensiline: non verificate caso per caso), bordo dell'asfalto fuori dal centro, nuvole volumetriche.

## 4. Strade e segni
- **Frecce direzionali**: solo dove OpenStreetMap ha `turn:lanes`. Nella zona sono **7 strade su 331 con le corsie** (Via Orelli, Lungolago Motta, Via Stazione, Via Simen, Via Varenna e due tratti senza nome). Il passo 7 ora esporta `tf`, `tb` (corsie di svolta nei due versi) e `lf`, `lb` (corsie per verso); `incroci.js` disegna una freccia per corsia (dritta, sinistra, destra, combinate) a 11 m o piu' dall'incrocio (`frecce_turn_lanes.png`). Dove i dati mancano non si disegna niente. Controllato con una sola immagine: la direzione della freccia sembra giusta ma non e' stata verificata su tutte e 7.
- Invariato dalle fasi precedenti: strisce, STOP, precedenze, tombini, caditoie, toppe, righe consumate.

## 5. Tutta la mappa 16 x 32 km (valutazione, non eseguita)
Eseguita solo l'area 4 x 4 km di Locarno-Muralto. Stime per 512 km2 (da misure su 16 km2):
- swissALTI3D: 51 MB per 62 tasselli (4 x 4 km con margine): circa 0,7-1 GB in tutto, pochi minuti.
- Terreno del gioco: 4065 x 8129 punti x 2 byte = circa 66 MB.
- Foto a 2 m: invariate (128 pezzi, caricati solo entro la distanza di visibilita': il budget massimo di circa 700 MB scritto in `terreno.js` non e' cambiato).
- **Foto HD**: fino a 1024 tasselli da 500 m (la mappa ne ha 2048), solo vicino alle strade. A Locarno ne servono il 97 % (62 su 64); in valle e nei boschi molti meno. A circa 300 KB l'uno: da circa 100 MB (25 % misurato altrove: ipotesi) a circa 600 MB. **Da misurare dopo il passo 7 sull'area completa**; passo 9 circa 1 s per tassello. In memoria video il costo resta di 4-6 tasselli.
- Rischi: Overpass sull'area intera puo' andare in timeout (il passo 2 ha gia' piu' server di riserva; `overpass-api.de` non e' raggiungibile da qui, e' stato usato `overpass.osm.ch`).

## 6. Prestazioni (grafica software: solo confronti tra versioni, NON FPS)
`tools/anteprima_prova/misura_fotogrammi.mjs`, 800 x 450, stessa macchina, dati veri. ms/fotogramma in SwiftShader; chiamate; triangoli. "Prima" = commit dd513fd (0.15.0), "Ora" = questa versione.
| Scena | Prima media | Ora bassa | Ora media | Ora alta* |
|---|---|---|---|---|
| Centro | 1276 ms, 591, 1,53 M | 1225, 548, 1,38 M | 1591, 681, 1,76 M | 1805, 664, 2,07 M |
| Strada principale | 1470, 774, 1,50 M | 1469, 717, 1,48 M | 1665, 845, 1,73 M | 1847, 848, 1,86 M |
| Collina | 1731, 239, 2,68 M | 1065, 212, 1,55 M | 2052, 309, 2,89 M | 2319, 351, 3,82 M |
| Notte | 1336, 615, 1,72 M | 1136, 556, 1,57 M | 1747, 706, 1,98 M | 1917, 720, 2,39 M |
| Panoramica | 2236, 1348, 1,91 M | 1536, 1208, 1,54 M | 2282, 1416, 2,15 M | 2666, 1478, 3,32 M |
\* Alta disegna a 1,5 x i pixel: non confrontabile con le altre colonne.
- **Media contro Prima**: +2 %...+31 % di tempo software (centro +25 %, principale +13 %, collina +19 %, notte +31 %, panoramica +2 %), chiamate +8...+17 %, triangoli +11...+18 %. Il costo e' in gran parte dei passaggi a schermo intero (AO, bagliore, immagine finale) e della geometria degli incroci.
- **Bassa** e' piu' veloce di Prima (-4...-38 %) ma perche' disegna a 0,75 x i pixel e senza post-elaborazione e ombre: e' il profilo, non un'ottimizzazione del codice.
- Texture delle scene: 39 MB in tutte (la stima non include foto aeree e buffer di disegno). Programmi grafici 42 -> circa 83, compilati durante il caricamento.
- **Nessun FPS e' stato misurato**: una scheda video vera puo' dare un rapporto molto diverso. Il costo di memoria video della post-elaborazione resta una stima (circa 125 MB a 1080p, circa 500 MB a 4K).

## Profili di qualita' (`src/impostazioni.js`)
| | Bassa | Media | Alta | Ultra 4K |
|---|---|---|---|---|
| Pixel | 0,75 | 1,0 | 1,5 | fino a 3840 x 2160 |
| Post (HDR, 4x MSAA, AO, bagliore, grading) | spenta | si (bagliore 80 %) | si | si |
| Foto HD (raggio) | spenta | 170 m | 215 m | 240 m |
| Ombre (risoluzione, area) | spente | 2048, 40 m | 4096, 55 m | 4096, 75 m |
| Alberi (raggio) | 450 m | 900 m | 1300 m | 1600 m |
| Vista | 3500 m | 7000 m | 9000 m | 11000 m |

## Limiti noti
- Test fatti solo a 800 x 450 e con grafica software; nessuna GPU vera.
- I tempi di caricamento degli alberi e delle foto dipendono dai fotogrammi: con la grafica software ci vogliono decine di secondi (in uno screenshot di confronto gli alberi mancavano per questo: non era una regressione, verificato).
- Effetti non verificati a vista: pozze di luce dei lampioni, riverbero del sole, transizioni di meteo, cirri.
- Il passo 9 non e' stato eseguito sull'area completa 16 x 32 km, ne' il passo 1-8.
- I tasselli HD vicini alla camera non sono sempre a fuoco sui pendii ripidi (proiezione dall'alto).
- Resta da fare sul tuo computer: FPS reali a tutte le qualita', memoria video, il passo 9 sull'area intera, un giro in moto negli incroci e sulle strade rialzate.
