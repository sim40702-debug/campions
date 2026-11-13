# Quote di ponti e gallerie del Ticino — analisi e chiusura (13/11/2026, riconciliazione v2)

Questo documento sostituisce la versione del mattino. **Stato dei dati: pubblicata la v2** (vedi §7 per la data/ora e gli SHA-256; fino alla pubblicazione la pre-release conteneva la v1). Le misure sono marcate **[M]** (misurate con uno script riproducibile) o **[I]** (interpretazione). Nessuna quota è stata modificata a mano: ogni cambio viene da una regola del codice (`tools/geo/riconcilia_opere.py`) e ogni regola ha una prova.

Tre concetti restano **distinti** in tutta l'analisi: *quota della superficie stradale* (la `y` dei vertici di `strade.json`), *terreno* (`terreno.bin`, griglia a 4 m, vicino più vicino) e *opera* (ponte, viadotto o galleria, con rampe e portali). Nessun ponte e nessuna galleria è stata forzata sul terreno.

---

## 1. Perché le reti ramificate finivano su un piano unico (causa nel codice)

**[M] Dal codice della v1 (`riconcilia_opere.py`, `riconcilia()`).**
1. Tutti i vertici di ponti (o di gallerie) di tutte le regioni vengono uniti per posizione (a meno di 1 m = stesso nodo). Due strade diverse che passano nello stesso punto *in pianta* diventano un solo nodo, anche se una scavalca l'altra.
2. Si formano **gruppi** di tratti collegati. Per ogni gruppo gli «ingressi veri» (capi liberi lontani dal bordo dei dati) ricevono la quota del terreno.
3. Le quote dei **nodi di giunzione** non vengono misurate: si propagano per **interpolazione lineare sulla lunghezza** lungo il «percorso più lungo» tra due nodi già fissati, finché tutti i nodi hanno *una* quota. Poi ogni tratto è la retta tra le due quote dei suoi estremi (ponte: mai sotto il terreno; galleria: almeno 7 m sotto il terreno).
4. Conseguenza: in uno svincolo con rampe, cavalcavia e raccordi, la forma reale (rampa che sale da terra, cavalcavia che scavalca un'altra strada, raccordo che torna a terra) viene sostituita da *una superficie interpolata tra pochi ingressi*. Dove i nodi di giunzione sono falsi (una strada passa sopra l'altra) il «piano» tira su o giù rami che non c'entrano.

**[M] Cosa era scritto nel codice e cosa faceva davvero.** L'intestazione della v1 diceva «le opere ramificate non si toccano»; il codice invece le riscriveva tutte quando le copie nelle regioni discordavano di più di 0,3 m. Questo è il difetto di progetto, ora corretto.

## 2. È possibile ricostruire le ramificazioni con le quote reali?

**No, non con i dati che il progetto possiede [M].** I pacchetti contengono la quota della superficie stradale *calcolata* dal passo 7, non la quota dell'impalcato misurata. Né OpenStreetMap né il terreno 4 m danno l'altezza di un cavalcavia. Una ricostruzione affidabile richiederebbe la quota dell'impalcato di swissTLM3D (strade in 3D) o del modello di superficie, per ogni ramo, e un modello di rampa verificato visivamente. **Non è stata implementata**: richiederebbe nuovi dati e una verifica sul gioco, e non è indispensabile alla 0.16.0. È un'attività futura, segnata tra i problemi aperti (§8).

## 3. Fonte autorevole usata per verificare

| Fonte | Esito |
|---|---|
| **swissTLM3D** (strade 3D) tramite le API `identify` di swisstopo | Raggiungibile, ma restituisce solo geometria 2D e attributi (niente quota Z, niente attributo di ponte/galleria). **Non utilizzabile.** Il file completo è di vari GB: non scaricabile nell'ambiente di lavoro (disco da 3 GB). |
| **swissALTI3D** (servizio `height`, modello del terreno a 2 m) | Usata per i punti singoli (§6). Raggiungibile. |
| **swissSURFACE3D raster 0,5 m** (modello di superficie, GeoTIFF cloud-optimized, letto con richieste a intervalli) | **Usata come verità indipendente per i ponti**: la superficie vista dall'alto contiene l'impalcato. Per ogni vertice si prende il **minimo della finestra 3×3 pixel (1,5 m)** (esclude veicoli e lampioni). Script: `tools/geo/verifica_ponti_dsm.py`. |
| Gallerie | **Nessuna verità indipendente**: dall'alto si vede il terreno sopra la galleria. Si verificano solo criteri interni (continuità tra regioni, pendenza, copertura). |
| Italia e bordi | 15 reti di ponti (quasi tutte piccole; la più grande è la Tangenziale di Varese, 145 vertici) sono fuori dalla copertura swisstopo: **nessuna misura indipendente**. |

Limiti di questa verifica [I]: il DSM può includere altre strutture sopra l'impalcato (un altro cavalcavia) e l'impalcato misurato è la superficie, non l'asse della carreggiata (±1–2 m). Per questo si leggono **mediane su centinaia di vertici**, non valori singoli.

## 4. Risultati per rete (ponti, con swissSURFACE3D)

Errore = quota della strada − 0,2 m (altezza sopra l'impalcato) − DSM; mediana su tutti i vertici misurati. **Prima** = originali del 12/11; **v1** = riconciliazione del mattino (pubblicata fino ad oggi); **v2** = regole di sicurezza.

| Rete (LV95) | Vertici | Prima | v1 | v2 | Decisione |
|---|---|---|---|---|---|
| **Svincolo di Monte Carasso** (2721099/1116737) | 323 | **−0,01 m** (58 % entro 2 m) | **+3,53 m** (48 %) | = prima | **v1 peggiorava → ripristinato l'originale** |
| **Viadotti della Biaschina** (2709277/1141574) | 442 | −7,16 m (5 %) | −3,04 m (18 %) | = v1 | v1 migliora → tenuto |
| **Viadotti della Biaschina** (2709295/1141565) | 436 | −7,79 m (5 %) | −2,38 m (44 %) | = v1 | v1 migliora → tenuto |
| Viadotto Brogeda (2725227/1077586) | 230 (32 misurati) | −2,75 m | −1,88 m | = prima | senza discordanza tra regioni → originale |
| A2 in R_2712_1106 (2717905/1112159) | 183 | −13,65 m (6 %) | −4,78 m (20 %) | = prima | senza discordanza tra regioni → originale (**problema aperto**, §8) |
| Via San Gottardo (2715994/1097234) | 14 | −1,77 m | −3,06 m | = prima | v1 peggiorava → originale |
| Altre 20 reti piccole | ≤ 72 | invariato o ±1 m | | | cambi sotto 1 m |

[M] Per le due reti della Biaschina il difetto di partenza era un salto fino a **61 m** tra le copie in regioni diverse, con 30 e 55 vertici sotto il terreno: dopo la riconciliazione **0 vertici sotto il terreno** e nessun salto. L'errore residuo di circa −2…−3 m rispetto all'impalcato misurato è **un limite noto** (la retta tra gli ingressi non segue il profilo reale del viadotto).

## 5. Regole della v2 (nel codice, con prova)

| Regola | Prova |
|---|---|
| **A.** Una rete ramificata (più di un tratto) si riscrive **solo se** le copie dei suoi vertici in regioni diverse discordano di **almeno 1 m** (la stessa soglia della verifica dei confini). Altrimenti non c'è niente da riconciliare e restano i dati originali. Le catene semplici (un solo tratto) si riconciliano sempre. | 9 reti ramificate tornano originali (tra cui Monte Carasso, Brogeda, A2 in R_2712_1106, Varese); il controllo dei confini resta a **0 punti > 1 m**. |
| **B.** Dopo il calcolo, se la pendenza massima su **20 m** di un tratto riconciliato supera il **30 %** e peggiora di oltre **10 punti** rispetto agli originali, il tratto **torna agli originali** (per arco, non per nodo). Se un tratto vicino resterebbe con un gradino di oltre 1 m rispetto alla giunzione ripristinata, torna all'originale anche lui; le **giunzioni false** (negli originali già un salto di oltre 5 m: strada di superficie marcata galleria che tocca la galleria in pianta) non propagano. | Ripristinati 2 tratti: la «Gotthardstrasse» (507 m, pendenza 11 % → 37 %, cambio fino a 222 m) e un raccordo di 181 m (16 % → 139 %). La galleria principale del San Gottardo (14,5 km) **resta riconciliata** e il suo massimo cambio passa da 222 m a 28,5 m. |

Altro prova che il codice è affidabile [M]: eseguita sugli originali verificati, la **v1** riproduce **byte per byte 19/19** i `strade.json` pubblicati il mattino; la **v2** è **deterministica** (due esecuzioni → 19/19 identici).

Gruppi toccati: v1 36 reti (110 tratti, 10 170 vertici cambiati); **v2 27 reti (53 tratti, 6 468 vertici cambiati)**; 3 702 vertici differiscono tra v1 e v2, in 7 regioni (`R_2664_1122`, `R_2680_1154`, `R_2696_1090`, `R_2696_1106`, `R_2712_1074`, `R_2712_1090`, `R_2712_1106`); `R_2664_1122` torna **identica all'originale**.

## 6. Anomalie note: difetto, geometria legittima, da verificare

Numeri sui dati **v2** (v1 tra parentesi). Soglia: oltre 0,5 m rispetto al terreno a 4 m.

| Anomalia | v2 | Classificazione |
|---|---|---|
| Vertici di galleria sopra il terreno | **505** in 375 tratti (493 in v1; 513 negli originali) | **505 su 505 sono in tratti interamente entro 100 m da un capo**; 438 sono ≤ 2 m. [I] Per lo più **geometria legittima**: portali a quota d'ingresso su un terreno a 4 m, dove una parete o una trincea varia di qualche metro in 4 m. |
| Vertici di ponte sotto il terreno | **473** in 336 tratti (452 in v1; 598 negli originali) | Legittimi nei casi di forra (§ sotto). L'aumento da 452 a 473 è il costo del ripristino degli originali nelle reti ramificate non toccate (Monte Carasso: 5 vertici, Brogeda: 19 …). |
| Scalini tra carreggiate sovrapposte | **202** su 113 866 punti (max 2,74 m), **identici prima/v1/v2** | [M] Sono tutti tra strade **normali** (non ponti né gallerie), concentrati in 7 regioni; dall'esame dei casi (`DBG` di `prova_quote.mjs`, R_2712_1074) sono **giunzioni laterali** (l'estremo di una strada tocca la carreggiata di un'altra a 2–3 m dall'asse, con dislivello fino a 2,7 m) e raccordi `primary_link`. [I] Difetto di giunzione già presente, **non causato dalla riconciliazione, non corretto**. Impatto in gioco non verificato. |
| Lastra bianca nella galleria di Maccagno | 1 caso | [M] Difetto visivo **reale e preesistente**; il tratto («1. Maccagno inferiore», 118 m) sta **8,7 m sopra la superficie ufficiale swisstopo** al suo capo, e il terreno a 4 m è 19,5 m più in basso. [I] Causa probabile: errore di quota del portale. **Non corretto, non verificato visivamente su GPU.** |

**Verifica puntuale con il modello del terreno swisstopo a 2 m (servizio `height`) dei 23 tratti con scarto > 3 m [M]:**
- **Ponte Ribellasca**: strada 534,1 m, superficie ufficiale 534,4 m, terreno del gioco (4 m) 542,4 m → **il ponte è giusto, è il terreno a 4 m ad essere sulla parete della forra**. Idem Località Viasco (28,8 m sopra il fondo, corretto per un viadotto di forra), Furkastrasse (galleria 14,7 m sotto la superficie: corretto).
- **Via San Gottardo ad Airolo** (galleria, 14,5 m «sopra» il terreno a 4 m): sopra la superficie ufficiale solo di **2,9 m** (imbocco di una trincea).
- Davvero alti sulla superficie ufficiale: **Maccagno** (+8,7 m), **SS340 a Lanzo/Menaggio** (+11,8 m, capo tagliato dal limite dei dati a 2742324 E), A2 presso 2704546/1147924 (+3,3 m). Questi **restano da verificare/correggere** (§8).

## 7. Controlli sui 19 pacchetti e dati pubblicati

Esito finale e SHA-256: vedi `REPORT_BUILD_E_DATI_0.16.0.md` §2. Riepilogo [M]:
- **Confini:** 47 252 punti di ponti e gallerie nelle sovrapposizioni tra regioni: **0 con scarto > 1 m** (originali: 3 561 nella CI, 3 494 nel ricalcolo locale; v1 e v2: 0). Strade normali: 1 530 805 punti in comune, posizione 100 %, quota media 0,005 m, massimo 1,89 m (invariati: la riconciliazione non li tocca).
- **Originali conservati:** artefatto `originali-pubblicati` (run [43397221897](https://github.com/sim40702-debug/swissgass/actions/runs/43397221897), 90 giorni, digest `143ade98…8e0`); v1 conservata come artefatto `pubblicati-v1` (90 giorni) prima della sostituzione; SHA-256 in `pubblicato_prima_sha256.txt`, `pubblicato_dopo_sha256.txt` (v1) e `strade_sha256_v2.txt`.

## 8. Problemi aperti sulle quote

1. **A2 in R_2712_1106 (2717905/1112159):** impalcato originale mediana −13,7 m rispetto al DSM, probabilmente sbagliato; la v1 lo portava a −4,8 m ma non si può provare che la forma fosse giusta; lasciato originale.
2. Capo della SS340 vicino a Lanzo/Menaggio (+11,8 m sulla superficie ufficiale, al limite dei dati), Maccagno (+8,7 m): da correggere con la quota del portale ufficiale.
3. Reti di ponti in Italia senza verità indipendente: non verificate (cambi della v2 ≤ 1,6 m).
4. 202 scalini di giunzione tra strade normali; 47 gruppi di strade staccati dalla rete.
5. Ricostruzione vera delle rampe (richiede swissTLM3D 3D completo).
6. Giudizio visivo su ponti e gallerie sul PC: **non eseguito** (vedi `PROVA_WINDOWS_GPU.md`).
