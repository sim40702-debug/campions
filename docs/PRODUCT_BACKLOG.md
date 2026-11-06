# Product Backlog – MOTO RACING WORLD

Ultimo aggiornamento: Sprint F1 (6 novembre 2026)

Priorità: **1 = più importante**. Stato: Da fare / In corso / Fatto.

## Epic principale: MAPPA COMPLETA DEL CANTON TICINO

Obiettivo: il mondo principale del gioco è tutto il Canton Ticino, in scala reale, con la rete stradale reale percorribile in moto.

### Le regioni (8 distretti del Ticino)

Le aree chieste nel documento sono raggruppate negli 8 distretti ufficiali, così ogni regione è un modulo separato:

| Regione (modulo) | Contiene |
|---|---|
| R1 Mendrisio | Mendrisiotto, Chiasso e Basso Mendrisiotto |
| R2 Lugano | Lugano e Luganese, Lago di Lugano |
| R3 Locarno | Locarno e Locarnese, Valle Verzasca, Centovalli, Onsernone, Gambarogno, Lago Maggiore |
| R4 Vallemaggia | Valle Maggia con le valli laterali (Bavona, Lavizzara, Rovana, Campo) |
| R5 Bellinzona | Bellinzona e Bellinzonese |
| R6 Riviera | Biasca e la Riviera |
| R7 Blenio | Valle di Blenio |
| R8 Leventina | Leventina e passi dell'Alto Ticino |

"Alto Ticino" = R6 + R7 + R8. Nel documento "Valle Maggia" e "Vallemaggia e le sue valli laterali" sono la stessa regione: è una sola voce (R4).

## Elementi del backlog

| ID | Elemento | Sprint | Priorità | Stato |
|---|---|---|---|---|
| TI-00 | Stima dimensione mondo, settori, memoria e prestazioni | 0 | 1 | Fatto |
| TI-01 | Scaricare dati OSM, swissALTI3D, confini; registrare versioni e date | A | 1 | In corso |
| TI-02 | Verifica licenze e testo attribuzioni nei crediti | A | 1 | In corso |
| TI-03 | Script (Python) che trasforma i dati in tasselli per Unreal | A | 1 | In corso |
| TI-04 | Settore pilota 8×8 km (proposta: Locarno–Ascona–Ponte Brolla) | A | 1 | In corso |
| TI-05 | Progetto UE5 con World Partition, griglie di streaming, coordinate LV95 | A | 1 | In corso |
| TI-06 | Confini cantonali importati e visibili | A | 2 | In corso |
| TI-07 | Terreno di tutto il Ticino a 2 m dai dati altimetrici | A | 2 | In corso |
| TI-08 | Importazione rete stradale OSM (strade pubbliche percorribili) | B | 1 | Da fare |
| TI-09 | Generazione strade 3D: larghezza, curve, pendenze, asfalto | B | 1 | Da fare |
| TI-10 | Incroci, rotatorie, svincoli funzionanti | B | 1 | Da fare |
| TI-11 | Collegamento di tutte le località; strade che escono dal Ticino finiscono al confine | B | 2 | Da fare |
| TI-12 | Laghi (Maggiore, Lugano) e fiumi principali | C | 2 | Pilota fatto (0.4.0); resto del Ticino da fare |
| TI-13 | Ponti e gallerie (inclusa Mappo-Morettina, diga di Melide) | C | 1 | Pilota fatto (0.4.0); resto del Ticino da fare |
| TI-14 | Montagne lontane visibili (terreno lontano / HLOD) | C | 2 | Da fare |
| TI-15 | Edifici generati dai contorni OSM (moduli riutilizzabili) | D | 3 | Pilota fatto (0.2.0); resto del Ticino da fare |
| TI-16 | Boschi e vegetazione generati (PCG) | D | 3 | Pilota fatto (0.2.0); resto del Ticino da fare |
| TI-17 | Guardrail, barriere, segnaletica lungo le strade | D | 2 | Pilota fatto (0.3.1); resto del Ticino da fare |
| TI-18 | Ottimizzazione streaming e HLOD | E | 1 | Pilota: qualità regolabile (0.5.0); Unreal da fare |
| TI-19 | Test di esplorazione di tutte le regioni | E | 1 | Da fare |
| TI-20 | Verifica automatica strade e terreno rispetto alle fonti | E | 1 | Da fare |
| TI-21 | Test multiplayer (server dedicato) | E | 1 | Da fare |
| TI-22 | Misura prestazioni (FPS, RAM, VRAM, tempi di caricamento) | E | 1 | Pilota: test nell'app (0.5.0), aspetta i risultati del Mac |
| TI-23 | Funziona su Mac e su Windows (script, progetto Unreal, gioco finito) | A–E | 1 | In corso |
| TI-24 | Anteprima giocabile del pilota (Three.js + Electron), release automatiche su GitHub | A | 1 | Fatto (0.1.0–0.1.4) |
| TI-25 | Collisioni della moto con gli edifici | D | 2 | Fatto (0.2.0) |
| TI-26 | Pulsante "Aggiorna" nell'app (controlla, scarica e installa da GitHub) | D1 | 1 | Fatto (0.3.0) |
| TI-27 | Nome della località sullo schermo e paesi sulla minimappa | D2 | 3 | Fatto (0.3.1) |
| TI-28 | Teleferiche, cabinovie e seggiovie con cabine che si muovono | F1 | 2 | Fatto (0.6.0) |
| TI-29 | Funicolari con le vetture che si incrociano | F1 | 2 | Fatto (0.6.0) |
| TI-30 | Ferrovie (massicciata e binari) | F1 | 2 | Fatto (0.6.0) |
| TI-31 | Chiese (tetto a due falde) e campanili (guglia) | F1 | 3 | Fatto (0.6.0) |
| TI-32 | Tetti a due falde e a padiglione per le case | F1 | 3 | Fatto (0.6.0) |
| TI-33 | Garage con 5 moto originali | G1 | 1 | Fatto (0.7.0) |
| TI-34 | Prestazioni diverse per moto | G1 | 1 | Fatto (0.7.0) |
| TI-35 | Cambio automatico, marce e contagiri | G1 | 2 | Fatto (0.7.0) |
| TI-36 | Suono del motore | G1 | 2 | Fatto (0.7.0) |
| TI-37 | Modelli 3D delle moto più curati | G1 | 2 | Fatto (0.7.0) |
| TI-46 | Case staccate dall'asfalto (contorni ritagliati) | H2 | 1 | Fatto (0.9.0) |
| TI-47 | Gravità vera: salti, atterraggi, sospensioni | H2 | 1 | Fatto (0.9.0) |
| TI-48 | Aderenza: niente tornanti a 200 km/h, scivolate | H2 | 1 | Fatto (0.9.0) |
| TI-49 | Cadute con ferite (vista annebbiata) e morte | H2 | 1 | Fatto (0.9.0) |
| TI-50 | Impennate e stoppie (Shift, E, Spazio) | H2 | 1 | Fatto (0.9.0) |
| TI-51 | Scoppiettii in rilascio | H2 | 2 | Fatto (0.9.0) |
| TI-52 | MRW SM 450 e MRW Strada 700 nel garage | H2 | 2 | Fatto (0.9.0) |
| TI-38 | Piano tecnico Unreal Engine 5 | U1 | 1 | Fatto |
| TI-39 | Progetto UE 5.8 Windows + Mac (Lumen, Nanite, VSM, TSR) | U1 | 1 | Scritto, da compilare |
| TI-40 | Giorno/notte e meteo con strade bagnate | U1 | 1 | Scritto, da compilare |
| TI-41 | 5 preset grafici e benchmark automatico | U1 | 1 | Scritto, da compilare |
| TI-42 | Terreno, strade e lago del Locarnese in Unreal | U1 | 1 | Scritto, da compilare |
| TI-43 | Fisica della moto (freni separati, piega, impennata, stoppie, cadute, bagnato) | U1 | 1 | Scritto, da compilare |
| TI-44 | Comandi, telecamere, interfaccia di guida | U1 | 1 | Scritto, da compilare |
| TI-45 | Script editor: scarica dati, crea livello e materiali | U1 | 1 | Scritto, da provare |

Nota: gli Sprint B, C e D saranno probabilmente divisi in più Sprint (una o due regioni alla volta). Lo decidiamo alla fine dello Sprint A, quando sapremo quanto tempo serve per il settore pilota.

## Test di accettazione dell'Epic

La mappa **non** è completata finché:

1. Tutto il territorio ticinese previsto è rappresentato (8 regioni).
2. Le regioni principali sono collegate tra loro.
3. Le strade importate sono percorribili.
4. Il terreno segue i dati altimetrici (controllo automatico a campione).
5. Si esplora senza caricamenti troppo invasivi.
6. Funziona in multiplayer.
7. Le prestazioni sono misurate e documentate.
8. Fonti e licenze sono documentate.
