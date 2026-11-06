---
title: "MOTO RACING WORLD – Stima della mappa del Canton Ticino"
subtitle: "Sprint 0 · Dimensione del mondo, settori, memoria e prestazioni · 6 novembre 2026"
---

# 1. In breve

Questa è la stima chiesta **prima di sviluppare**. Non c'è ancora codice: prima decidiamo insieme i punti del capitolo 11.

**Le cifre principali**

- Ticino reale: **2'812 km²**, circa **90 km** da nord a sud e **60 km** da est a ovest.
- Mondo di gioco proposto: rettangolo di **64 × 96 km** (6'144 km²), in **scala 1:1**. Il Ticino occupa circa il 46 %; il resto è bordo (Italia, Grigioni, Uri) solo come sfondo.
- Dislivello: da **193 m** (Lago Maggiore) a **3'402 m** (Adula).
- Strade da ricostruire: circa **1'050 km** di strade cantonali + **160 km** di strade nazionali + strade comunali. Totale stimato **4'000–6'000 km** (il numero vero lo misuriamo nello Sprint A).
- Bosco: oltre **140'000 ettari**, più del 50 % del cantone. Vuol dire decine di milioni di alberi: vanno generati, non piazzati a mano.

**Cosa consiglio**

1. Scala **1:1**, terreno a **2 m** di risoluzione.
2. Dividere il mondo in **settori di dati da 4 × 4 km** (384 in totale, circa 230 toccano il Ticino) e in **8 regioni** (gli 8 distretti), ognuna come modulo separato.
3. Iniziare lo Sprint A con un **settore pilota di 8 × 8 km** (Locarno – Ascona – Ponte Brolla) per provare tutta la catena prima di fare il cantone intero.
4. Obiettivo prestazioni: **60 FPS a 1080p** su un PC da gioco medio (16 GB RAM, scheda video 8 GB).

**Una cosa da sapere subito**

Un mondo di queste dimensioni è un lavoro **molto grande**: giochi commerciali simili sono fatti da squadre di decine di persone. Con script che generano quasi tutto in automatico è fattibile arrivare a un Ticino **percorribile e riconoscibile**, ma non a un Ticino dettagliato a mano metro per metro. In questa stima tengo conto di questo.

# 2. Dimensione del mondo

| Dato | Valore | Note |
|---|---|---|
| Superficie Ticino | 2'812 km² | Dato ufficiale |
| Estensione | ~90 km N–S, ~60 km E–O | Dato ufficiale USTAT |
| Rettangolo di gioco | 64 × 96 km = 6'144 km² | Multiplo di 4 km, con margine |
| Quota minima / massima | 193 m / 3'402 m | Dislivello 3'209 m |
| Confine con l'Italia | 218 km | Strade che escono: finiscono al confine |
| Coordinate | LV95 (EPSG:2056) | Le stesse di swisstopo: 1 unità = 1 cm in Unreal |

**Perché la scala 1:1**

- Le strade e le pendenze restano vere: il documento chiede che la ricostruzione sia **verificabile** rispetto alle fonti.
- È un mondo grande ma giocabile in moto: da Chiasso ad Airolo sono circa 110 km di strada, cioè circa un'ora a 100 km/h.
- Una scala ridotta (per esempio 1:2) farebbe tornanti impossibili e salite sbagliate.

**Altezze in Unreal**

Il Landscape di Unreal salva le altezze a 16 bit. Con una scala verticale di 700 si coprono circa 3'580 m di dislivello con passi di circa **5,5 cm**: più che sufficiente.

# 3. Terreno

I dati swissALTI3D esistono a 0,5 m e a 2 m. Ho confrontato tre risoluzioni per il Landscape di Unreal:

| Risoluzione | Punti (rettangolo intero) | Dati terreno nel progetto | Giudizio |
|---|---|---|---|
| 1 m | 6,1 miliardi | 45–65 GB | Troppo pesante da modificare e da importare |
| **2 m** | **1,5 miliardi** | **11–16 GB** | **Consigliata** |
| 4 m | 0,4 miliardi | 3–4 GB | Leggera, ma pendii e scarpate meno credibili |

"Dati terreno nel progetto" = altezze + normali + 4 strati di materiale (erba, roccia, terra, asfalto), con i livelli di dettaglio. Solo la parte del Ticino a 2 m pesa circa la metà (6–8 GB).

**Come si fa con 2 m e le strade?** Le strade non sono "dipinte" sul terreno: sono **mesh separate** (vedi capitolo 4). Il terreno vicino alla strada viene solo abbassato o alzato per raccordarsi. Così le strade restano lisce anche se il terreno è a 2 m.

**Fuori dal Ticino**: un anello di terreno a bassa risoluzione (30 m, dati Copernicus per l'Italia) serve solo per vedere le montagne all'orizzonte. Non è percorribile.

# 4. Rete stradale

**Stima dei chilometri**

| Tipo | km | Fonte |
|---|---|---|
| Strade nazionali (A2, A13) | ~160 | Cantone Ticino (altri conteggi arrivano a 277 km, contando diversamente) |
| Strade cantonali | ~1'050 | Cantone Ticino |
| Strade comunali asfaltate | ~2'500–4'500 | **Stima mia**, da misurare con OSM nello Sprint A |
| **Totale percorribile** | **~4'000–6'000** | |
| Strade forestali / sterrate | Non incluse all'inizio | Opzione per dopo (decisione D3) |

**Come diventano strade 3D**

1. Uno script Python legge le strade da OpenStreetMap (tipo, corsie, larghezza, ponte, galleria, senso unico).
2. Ogni strada diventa una **spline** in coordinate LV95, con le altezze prese da swissALTI3D e poi lisciate (niente gradini).
3. In Unreal le spline diventano mesh di asfalto con la larghezza giusta, bordi, guardrail e linee.
4. **Incroci, rotatorie e svincoli** sono il pezzo più difficile: servono pezzi speciali generati a parte. È il rischio tecnico numero 1 (capitolo 10).

**Numero di elementi (stima)**

- Pezzi di strada (way OSM): ~40'000–80'000.
- Incroci: ~30'000–50'000. Rotatorie: alcune centinaia.
- Gallerie e ponti: alcune centinaia. Tra i più importanti: galleria Mappo-Morettina, diga di Melide, gallerie della Leventina e dell'A2.

# 5. Suddivisione in settori

Ci sono **tre livelli** di suddivisione, ognuno con uno scopo diverso.

## 5.1 Regioni (moduli del mondo)

Le 8 regioni (distretti) sono **moduli separati**: ognuna ha i suoi dati, i suoi script e i suoi contenuti. Aggiungere o rifare una regione **non tocca le altre**. Più avanti si potranno aggiungere nuove regioni (per esempio la Mesolcina) allo stesso modo.

| Regione | Contenuto principale |
|---|---|
| R1 Mendrisio | Mendrisiotto, Chiasso |
| R2 Lugano | Luganese, Lago di Lugano |
| R3 Locarno | Locarnese, Verzasca, Centovalli, Gambarogno |
| R4 Vallemaggia | Valle Maggia e valli laterali |
| R5 Bellinzona | Bellinzonese |
| R6 Riviera | Biasca e Riviera |
| R7 Blenio | Valle di Blenio |
| R8 Leventina | Leventina, Alto Ticino |

## 5.2 Settori di dati: 4 × 4 km

- Il rettangolo 64 × 96 km diventa una griglia di **16 × 24 = 384 settori**.
- Circa **230** toccano il Ticino (dettaglio pieno). Gli altri sono solo sfondo.
- Nome dei settori: dalla coordinata LV95 dell'angolo, per esempio `S_2700_1112`.
- Ogni settore ha i suoi file: altezze, strade, edifici, vegetazione. Si possono rigenerare **uno alla volta**.

## 5.3 Griglie di caricamento in gioco (World Partition)

Mentre si gioca, Unreal carica solo le celle vicine al giocatore. Propongo griglie diverse per tipo di contenuto:

| Griglia | Cella | Distanza di caricamento | Cosa contiene |
|---|---|---|---|
| Terreno e strade | 512 m | 2 km | Landscape, strade, collisioni, ponti, gallerie |
| Edifici | 256 m | 1 km | Case e capannoni |
| Dettagli | 128 m | 400 m | Segnali, guardrail piccoli, oggetti |
| Vegetazione | generata dal PCG | 300–600 m | Alberi e cespugli vicini |
| Orizzonte (HLOD) | sempre caricato | tutto il mondo | Montagne lontane, città lontane semplificate |

**Perché 2 km per le strade?** A 300 km/h in autostrada la moto fa 83 m al secondo: per arrivare al bordo del caricamento ci mette 24 secondi, abbastanza per caricare le celle successive senza schermate di attesa. Nelle valli di montagna (velocità più basse) c'è ancora più margine.

# 6. Memoria e prestazioni

**PC obiettivo per giocare**: 16 GB di RAM, scheda video con 8 GB (classe RTX 3060 / 4060), SSD. Obiettivo **60 FPS a 1080p**.

**Budget di memoria durante il gioco (stima)**

| Parte | RAM | Memoria video |
|---|---|---|
| Terreno vicino (altezze, materiali, collisioni) | 150–300 MB | 150–300 MB |
| Orizzonte e terreno lontano | 200–400 MB | 300–500 MB |
| Strade, ponti, gallerie | 100–200 MB | 100–200 MB |
| Edifici (Nanite, pezzi riutilizzati) | 300–600 MB | 0,5–1 GB |
| Vegetazione | 200–500 MB | 0,5–1 GB |
| Texture (streaming) | – | 1,5–2,5 GB |
| Luci e ombre (Lumen, ombre virtuali) | – | 1–1,5 GB |
| Moto, gioco, audio, rete, interfaccia | 0,5–1 GB | 0,2–0,4 GB |
| Motore Unreal di base | 1,5–2 GB | – |
| **Totale** | **circa 3–5 GB** | **circa 4,5–7,5 GB** |

Con 16 GB di RAM e 8 GB di memoria video ci stiamo, ma la memoria video è **al limite**. Per questo servono:

- un preset grafico **senza Lumen** (luce precalcolata più semplice) per le schede video più deboli;
- vegetazione e ombre regolabili nelle impostazioni.

**Il trucco principale**: in ogni momento è caricata in dettaglio solo un'area di circa **13–16 km²** (meno dell'1 % del Ticino). Tutto il resto è o non caricato o semplificato nell'orizzonte.

**Alberi**: oltre 140'000 ettari di bosco vogliono dire circa **40 milioni di alberi**. Non si possono salvare uno per uno: il sistema PCG di Unreal li **genera mentre giochi** vicino a te, partendo dalla mappa dei boschi. Lontano diventano "macchie" di bosco semplificate.

# 7. Spazio su disco

| Cosa | Dimensione stimata |
|---|---|
| Dati geografici scaricati (OSM, swissALTI3D 2 m, confini) | 5–15 GB |
| Progetto Unreal in sviluppo (con cache) | 60–150 GB |
| **Gioco finito da installare** | **15–30 GB** |

**PC per sviluppare**: per lavorare a questo progetto in Unreal servono almeno **32 GB di RAM** (meglio 64), un SSD da **1 TB** libero e una scheda video da 8 GB o più. Il tuo MacBook Air M2 da 8 GB e 256 GB **non basta** per l'editor di Unreal con un mondo così: va bene per gli script Python e per i documenti, non per il progetto Unreal. Questo è un punto da decidere (D7).

# 8. Multiplayer

- Consiglio un **server dedicato** (il server comanda, i giocatori si collegano).
- Problema dei mondi grandi: il server deve caricare le zone attorno a **ogni** giocatore. Se tutti sono vicini costa poco; se sono sparsi in tutto il Ticino, il server carica tante zone.
- Stima server: circa **300–600 MB per ogni zona attiva**. Con 16 giocatori sparsi: 5–10 GB di RAM; con 16 giocatori nello stesso posto: circa 1–2 GB.
- Proposta: iniziare con **massimo 8 giocatori** per sessione, poi alzare dopo i test dello Sprint E.
- Il server carica solo terreno, strade e collisioni, **non** grafica, alberi e decorazioni: molto più leggero dei client.

# 9. Piano degli Sprint

| Sprint | Obiettivo | Cosa si vede alla fine |
|---|---|---|
| 0 | Stima e decisioni (questo documento) | Documenti approvati |
| A | Dati, licenze, confini, terreno + settore pilota | Settore Locarno 8×8 km esplorabile con il terreno vero; poi terreno di tutto il Ticino |
| B | Rete stradale | Strade del settore pilota percorribili in moto, poi regione per regione |
| C | Montagne, laghi, fiumi, ponti, gallerie | Laghi Maggiore e Lugano, gallerie e ponti funzionanti |
| D | Edifici, vegetazione, segnaletica | Paesi e boschi generati, guardrail e cartelli |
| E | Ottimizzazione e test | Misure di FPS, memoria, caricamenti, multiplayer |

**Tempi**: gli Sprint B, C e D quasi sicuramente vanno **divisi per regioni** (per esempio B1 = Locarno, B2 = Bellinzona, …). Dopo il settore pilota misuriamo quanto ci vuole per 64 km² e calcoliamo il resto. Prima di quel momento, ogni data sarebbe inventata.

**Ordine delle regioni proposto**: R3 Locarno (pilota) → R5 Bellinzona → R2 Lugano → R1 Mendrisio → R6 Riviera → R8 Leventina → R7 Blenio → R4 Vallemaggia. Così le regioni collegate dall'A2 e dalle cantonali principali arrivano per prime.

**Come verifichiamo la precisione** (richiesta del documento):

- **Strade**: uno script confronta la posizione delle strade nel gioco con quella OSM. Obiettivo: errore sotto i **2 m**.
- **Terreno**: lo script prende punti a caso fuori dalle strade e confronta l'altezza con swissALTI3D. Obiettivo: errore sotto **1 m**.
- **Collegamenti**: lo script controlla che dal centro di ogni località si possa arrivare in moto alle altre (nessun pezzo di strada isolato per errore, nessun collegamento inventato).

# 10. Rischi principali

| Rischio | Gravità | Cosa facciamo |
|---|---|---|
| Incroci, rotatorie e svincoli generati male | Alta | Provarli bene nel settore pilota; pezzi speciali per le rotatorie |
| Dati OSM incompleti (larghezze, corsie mancanti) | Media | Valori standard per tipo di strada; controllo con le foto aeree solo come riferimento |
| Gallerie: il terreno va "bucato" | Media | Usare i volumi per nascondere il terreno all'ingresso della galleria |
| Memoria video al limite | Media | Preset senza Lumen, vegetazione regolabile |
| Server multiplayer con giocatori sparsi | Media | Limite giocatori iniziale, il server carica solo collisioni |
| PC di sviluppo non adatto | Alta | Decisione D7 prima dello Sprint A |
| Lavoro troppo grande per i tempi disponibili | Alta | Tutto generato da script, regione per regione; ogni regione finita è giocabile da sola |

# 11. Decisioni da prendere prima dello Sprint A

| # | Decisione | Proposta |
|---|---|---|
| D1 | Scala del mondo | 1:1 |
| D2 | Risoluzione terreno | 2 m |
| D3 | Strade incluse | Tutte le strade pubbliche asfaltate; sterrate più avanti |
| D4 | Strade che escono dal Ticino (Gottardo, Lucomagno, Novena, confini con l'Italia, Mesolcina) | Finiscono al confine con una barriera e un punto per girare |
| D5 | Settore pilota | Locarno – Ascona – Ponte Brolla (lago, città, rotatorie, valle, ponti, galleria Mappo-Morettina) |
| D6 | Numero di giocatori iniziale | Massimo 8 |
| D7 | PC di sviluppo per Unreal | Almeno 32 GB RAM, SSD 1 TB, scheda video 8 GB |
| D8 | Versione di Unreal Engine | L'ultima versione stabile di UE5 al momento dello Sprint A, poi fissa |

**Cosa posso fare io e cosa fai tu**

- **Io**: script Python per scaricare e trasformare i dati, script Python per l'editor di Unreal, codice C++/Blueprint, documenti Scrum, test automatici sui dati.
- **Tu**: aprire il progetto in Unreal sul tuo PC, lanciare gli script nell'editor, compilare, provare in moto e segnalare i problemi nel Bug Tracker. Unreal Engine non gira nell'ambiente dove lavoro io.

# 12. Fonti dei numeri

- Superficie, estensione 90 × 60 km, confine con l'Italia 218 km: USTAT, *Territorio e ambiente* (ti.ch).
- Quote 193 m e 3'402 m (Adula): dati geografici pubblici sul Canton Ticino.
- Bosco oltre 140'000 ha (oltre il 50 %): Gran Consiglio del Canton Ticino.
- Strade cantonali ~1'050 km e nazionali ~160 km: Cantone Ticino, comunicato sul risanamento fonico; RSI cita 277 km di strade nazionali (conteggio diverso).
- swisstopo: dati Open Government Data gratuiti dal 1° marzo 2021, obbligo di citare la fonte.
- OpenStreetMap: licenza ODbL, attribuzione "© OpenStreetMap contributors".
- Tutte le altre cifre (memoria, disco, numero di elementi) sono **stime mie** e vanno misurate negli Sprint A ed E.
