## MOTO RACING WORLD – Anteprima Ticino

Versione giocabile **leggera** del **Locarnese** (16 × 12 km), con il terreno vero di swisstopo e le strade vere di OpenStreetMap.
La versione principale del gioco resta quella in Unreal Engine 5.

### Novità di questa versione (0.14.0) – grande upgrade grafico

- **Città tutte diverse**: ogni città e paese ha un'identità sua (colori dei muri e dei tetti, tipo di facciata, balconi, palme, alberi di strada), ricavata dal nome: Locarno ocra e terracotta, Ascona mediterranea con palme, Muralto pastello, Tenero moderno, Losone alpino, Ponte Brolla di granito… e lo stesso vale per qualsiasi altro paese dei dati.
- **Quartieri riconosciuti da soli** (centro storico, commerciale, industriale, residenziale, periferia): palazzi con negozi al piano terra, cornicioni, capannoni di lamiera con lucernari, uffici a vetri, case con gronda, comignoli e pannelli solari, balconi, impianti sui tetti, tetti di pietra in quota.
- **Facciate che non si ripetono**: 8 tipi di facciata e per ogni finestra una variante diversa (persiane aperte o chiuse, tende, fioriere, avvolgibili, vetri riflettenti).
- **Ora del giorno e notte**: tasto **T** o cursore nelle Impostazioni (alba, giorno, tramonto, notte; anche "il tempo scorre"). Sole e luna veri per Locarno, cielo con stelle, nuvole, **meteo** (sereno, variabile, nuvoloso, nebbia). Di notte si accendono **finestre, vetrine, lampioni (con alone e macchia di luce) e il faro della moto**.
- **Strade**: asfalto con grana, rattoppi e carreggiate consumate, righe di bordo e mezzeria che si interrompono agli incroci, **marciapiedi con cordolo** nei quartieri abitati.
- **Arredo urbano**: panchine, cestini, pensiline dell'autobus, cartelli "attenzione pedoni", cartello con il nome del paese e limite 50 all'ingresso.
- **Verde**: 7 specie (latifoglie, abeti, cipressi, **palme**, cespugli), tinte e grandezze diverse, chiome che ondeggiano al vento, viali e giardini nei paesi.
- **Acqua**: lago, fiumi e stagni con onde che si muovono e riflessi del cielo; terreno con grana, neve in alta quota, ghiaia sulle rive, fondale del lago.
- **Ombre molto più estese** (fino a 75 m) e anche gli edifici fanno ombra; riflessi dal cielo vero su metalli e vetri.
- **Minimappa nuova**: rotonda, disegnata dai dati veri (rilievo, lago, boschi, edifici, strade con bordo e gerarchia, ponti, gallerie, ferrovie, nomi), che ruota con la moto o resta con il nord in alto (clic), zoom con + / − o rotellina, colori scuri di notte.
- **Mappa grande** (tasto **P** o **N**, pulsante Mappa): trascina e ingrandisci, **cerca** paesi, strade e luoghi, **livelli** (rilievo, quartieri, edifici, boschi, acque, strade, nomi, ferrovie, luoghi, punti di interesse), segnaposto con nome della strada, quota e coordinate, "Parti da qui" o doppio clic.
- **Prestazioni**: edifici in pezzi da 500 m con culling per distanza, dettagli dei tetti e dei balconi solo vicino (LOD), tutto "instanced"; Impostazioni con distanze e ombre diverse per Bassa / Media / Alta / Ultra, e nuvole e ombre degli edifici attivabili.
- **Dati** (per chi crea la release): il passo 7 esporta anche parchi, giardini e prati (`uso_suolo.json`) che compaiono sulla mappa.

### Novità della 0.13.1


- **Si cade molto meno facilmente**:
  - sterzo al massimo = tutta l'aderenza delle gomme, non di più: tenendo lo sterzo in curva non si scivola più (provato a 120 km/h);
  - si scivola solo frenando forte in piega a lungo, o sul prato (che ora tiene di più);
  - contro gli edifici si cade solo sopra i 29 km/h (prima 18);
  - atterraggi: si cade solo da salti molto più alti;
  - derapata: highside solo sopra i 120 km/h molto di traverso.

### Novità della 0.13.0

- **Derapate in moto** (come in supermotard): in velocità tieni **Spazio** (freno dietro) e sterza: la ruota dietro scivola fuori, la moto entra di traverso e chiude la curva. Lasci Spazio e torna dritta. Sopra i 100 km/h di traverso si cade (highside).
- **Segni neri delle gomme** sull'asfalto e **rumore delle gomme** che strisciano.
- **Nuova macchina da drift: MRW Drift GT** (nel garage, ultima): coupé a trazione dietro con 340 CV. **Spazio** = freno a mano per iniziare la derapata, tanto gas in curva la tiene di traverso, controsterzo per tenerla. In prima persona si vedono cruscotto, volante e cofano.
- **Grafica Ultra 4K** (Impostazioni): disegna a circa 3840 x 2160 punti anche su uno schermo normale (bordi lisci e dettagli nitidi), ombre più fini, alberi e vista più lontani. **F11** = schermo intero.

### Novità della 0.12.2

- **Corretto: il gioco si fermava su "Caricamento del territorio..."** (dalla 0.10.0). Nell'app installata mancavano tre file di three.js (caricamento dei modelli 3D, cielo, riflessi). Ora sono dentro l'app, e prima di pubblicare una versione viene controllato che ci siano.

### Novità della 0.12.1

- **Schermata di caricamento animata**: una ruota che gira e la strada che scorre, la barra dei passi fatti e i secondi passati. La ruota gira anche quando il programma lavora sodo: se resta ferma a lungo, il programma è bloccato.

### Novità della 0.12.0

- **Scegli dove partire** (pulsante Partenza o tasto P): clic su un punto della mappa (si parte dalla strada più vicina) oppure su uno dei 35 paesi della lista. La scelta viene ricordata: la volta dopo il gioco parte da lì.
- **Aggiornamento pulito**: dalla prossima volta il pulsante Aggiorna toglie la versione vecchia, installa la nuova e la riapre, senza lasciare file in giro.
  - Mac: l'app vecchia viene cancellata e la nuova messa nello stesso posto (in Applicazioni se la vecchia girava dal .dmg).
  - Windows (installazione): il programma di installazione lavora in silenzio, toglie la vecchia versione e riapre il gioco.
  - Windows (portatile): quando il gioco si chiude, il nuovo .exe prende il posto del vecchio e si riapre.
  - Vengono cancellati anche i vecchi programmi di installazione rimasti nella cartella Download.

### Novità della 0.11.0

- **Tutte le moto del garage in 3D vero** (fatte con Blender, disegni originali MRW): SM 690, Strada 700, Naked 890, Sport 1000 RR (carena intera e semimanubri), Enduro 450 (gomme tassellate) e Scooter 125, ognuna con il suo pilota (casco da cross o integrale, posizione di guida diversa per ogni moto).
- **Case con finestre vere**: cornici, vetri, davanzali e persiane verdi come in Ticino (altre case con finestre senza persiane), capannoni con lamiera e finestre a nastro, tetti di coppi.
- **Alberi più realistici**: latifoglie con tronco, rami e chioma a "nuvole" in due verdi diversi; abeti a piani di rami.

### Novità della 0.10.0

- **MRW SM 450 con il modello 3D vero** (fatto con Blender dal disegno di Simone): motore con coperchi e viti, radiatori, forcella oro, ruote a raggi con gomme tassellate e dischi, due scarichi, sella con cuciture.
- **Pilota 3D vero** sulla SM 450: tuta nera e rossa, casco da cross con frontino e mascherina, stivali, guanti. Quando cadi è lui che vola giù dalla moto.
- **Grafica migliorata**: cielo vero con il sole, ombra della moto e del pilota sulla strada, riflessi sui metalli, colori "da film" (tone mapping).

### Novità della 0.9.1

- **Cadute vere**: il pilota si stacca dalla moto, vola avanti facendo la capriola, rimbalza e striscia sull'asfalto, poi resta a terra; la moto scivola per conto suo.
- **Niente più saltelli sulla strada**: la moto si stacca da terra solo su creste e dossi veri (almeno 25 cm), non sui piccoli cambi di pendenza.
- **Prima persona migliorata** (tasto C, terza vista): si vedono manubrio, forcella, tabella e serbatoio; la vista piega con la moto in curva e si alza nelle impennate.
- **Scoppiettii su tutte le moto** quando chiudi il gas di colpo a giri alti.

### Novità della 0.9.0 – Sprint H2

- **Le case non toccano più l'asfalto**: dove il contorno di una casa entrava nella strada, il muro ora parte dal bordo (circa 2300 case sistemate; prima 957 toccavano la strada, ora 1).
- **Fisica più vera**: la moto non è più incollata alla strada. Gravità vera, salti su dossi e creste, sospensioni che si schiacciano all'atterraggio.
- **Aderenza delle gomme**: in velocità non si fanno i tornanti. Se si sterza troppo forte la moto allarga la curva e, se si insiste (sopra i 72 km/h) o si frena in piega, si scivola e si cade. Sul prato le gomme tengono meno.
- **Cadute e danni**: sotto i 30 km/h ti rialzi; tra 30 e 75 km/h sei ferito e la vista si annebbia per un po'; sopra i 75 km/h sei morto (schermo nero) e si riparte dalla strada.
- **Impennate e stoppie**: Shift = peso dietro (impennata), E = peso avanti (stoppie), Spazio = freno dietro (riporta giù la ruota). Oltre il punto di equilibrio si va all'indietro!
- **Scoppiettii** dallo scarico quando chiudi il gas di colpo a giri alti (monocilindrici e bicilindrici).
- **Nuove moto nel garage**: **MRW SM 450** (il disegno di Simone: rossa e nera, forcella oro, due scarichi) e **MRW Strada 700** (stradale bicilindrica con piccolo parabrezza).

### Novità della 0.8.0 – Sprint H1

- **Mappa più grande: Locarnese 16 × 12 km**, fino a **Tenero e Gordola**, Losone, Tegna, Verscio, Cardada e Cimetta.
- **Foto aeree SWISSIMAGE** di swisstopo sul terreno: dall'alto il gioco assomiglia alla realtà.
- **Gallerie** sempre sotto terra (almeno 7 m di montagna sopra): non passano più sopra le strade.
- Terreno dettagliato creato solo vicino alla moto: meno memoria.

### Novità della 0.7.0 – Sprint G1

- **Garage** (tasto G o pulsante "Garage"): 5 moto originali con prestazioni diverse:
  MRW SM 690 (supermotard), MRW Naked 890, MRW Sport 1000 RR (sportiva), MRW Enduro 450, MRW Scooter 125.
- **Marce e contagiri** (cambio automatico).
- **Suono del motore** che segue i giri (tasto M per spegnerlo).
- Moto più curate: ruote con razze e dischi, forcella che sterza, ruote che girano, piega in curva realistica.

### Novità della 0.6.1

- Funicolare: i 18 pezzi di OpenStreetMap ora sono uniti in un solo percorso con le sue due vetture.
- Download più sicuro: se il server di OpenStreetMap non risponde se ne usa un altro.

### Novità della 0.6.0 – Sprint F1

**Correzioni**
- Niente più **erba sulle strade**: il terreno sotto strade e binari viene spianato.
- **Strade lisce**: la moto non saltella più, anche agli incroci.
- Niente più **case sulle strade**: nelle vie strette la strada si restringe.
- Niente più **piante sulle strade**: gli alberi stanno ad almeno 3,5 m dall'asfalto.

**Novità**
- **Teleferiche, cabinovie e seggiovie** di OpenStreetMap, con piloni, stazioni e cabine che si muovono.
- **Funicolare** con le due vetture che si incrociano.
- **Ferrovie**: massicciata e binari.
- **Chiese** con il tetto a due falde e **campanili** con la guglia.
- **Tetti** a due falde o a padiglione per le case.
- Ferrovie e teleferiche sulla minimappa.

### Novità della 0.5.0 – Sprint E1

- **Impostazioni** (tasto Esc o pulsante in alto a destra): qualità grafica Bassa, Media o Alta. Regola risoluzione, alberi, visibilità e dettaglio del terreno; viene ricordata.
- **Contatore FPS** (tasto F), con triangoli e disegni.
- **Test prestazioni** (nelle Impostazioni): 40 secondi di volo sopra il pilota, poi il risultato da copiare e mandare.

### Novità della 0.4.0 – Sprint C1

- **Gallerie vere**: dentro la montagna c'è il tubo in cemento con le luci sul soffitto e i portali agli ingressi (per esempio la galleria Mappo-Morettina). In galleria la telecamera resta bassa.
- **Piloni** sotto i ponti (per esempio i ponti sulla Maggia).
- **Fiumi, torrenti e stagni** di OpenStreetMap.

### Novità della 0.3.1 – Sprint D2

- **Segnaletica** di OpenStreetMap: semafori, stop, precedenze, sul bordo della strada e girati verso chi arriva.
- **Lampioni** con il braccio sopra la strada.
- **Strisce pedonali gialle**, come in Svizzera.
- **Guardrail** dove la strada ha una scarpata di lato.
- **Nome della località** sullo schermo (sopra il nome della strada) e **nomi dei paesi** sulla minimappa.

### Novità della 0.3.0

- **Pulsante "Aggiorna"** in alto a destra: controlla su GitHub se c'è una versione nuova, la scarica e la installa.
  - Mac: sostituisce l'app in Applicazioni e la riavvia (non serve più il comando `xattr`).
  - Windows: avvia l'installazione della nuova versione (con la versione portatile scarica il nuovo file in Download).
- All'avvio il gioco controlla da solo: se c'è una versione nuova il pulsante diventa rosso.
- Questa versione va installata **a mano una volta**: dalle prossime basta il pulsante.

### Novità della 0.2.1

- La telecamera non entra più dentro i muri degli edifici: se dietro la moto c'è un edificio, si avvicina.

### Novità della 0.2.0 – Sprint D1

- **Edifici veri** di OpenStreetMap: case, palazzi, chiese, capannoni, con l'altezza presa da OSM (piani o altezza) o stimata dal tipo di edificio.
- **Boschi**: gli alberi compaiono vicino alla moto (latifoglie in basso, abeti sopra i 1'100 m); da lontano il bosco si vede dal colore verde scuro del terreno.
- **Alberi singoli** mappati in OpenStreetMap (viali, piazze).
- **Parapetti** sui ponti.
- **Collisioni**: la moto non passa più dentro gli edifici.

### Quale file scaricare

| Computer | File |
|---|---|
| Mac con chip Apple (M1, M2, M3, …) | `...-Mac-arm64.dmg` |
| Mac con Intel | `...-Mac-x64.dmg` |
| Windows (installazione) | `...-Windows-Installazione.exe` |
| Windows (senza installare) | `...-Windows-Portatile.exe` |

### Primo avvio su Mac

L'app non è firmata da Apple, quindi il Mac la blocca la prima volta:

1. Apri il `.dmg` e trascina l'app in **Applicazioni**.
2. In Applicazioni fai **clic destro sull'app → Apri → Apri**.
3. Se dice che l'app è "danneggiata", apri il Terminale e scrivi:
   `xattr -cr "/Applications/MRW Anteprima Ticino.app"`, poi riprova.

### Primo avvio su Windows

Se compare "Windows ha protetto il PC": **Ulteriori informazioni → Esegui comunque**.

### Comandi

- Frecce o **WASD**: guida
- **C**: cambia telecamera (dietro, alta, casco)
- **R**: torna sulla strada più vicina
- **G**: garage (scegli la moto)
- **M**: suono sì/no
- **F**: mostra gli FPS
- **Esc**: impostazioni
- **H**: nasconde l'aiuto

### Cosa c'è

- Terreno swissALTI3D (un punto ogni 4 m circa)
- Strade OpenStreetMap, con ponti e gallerie
- Lago Maggiore
- Edifici, boschi e alberi di OpenStreetMap
- Velocità, quota reale, coordinate LV95 (si possono confrontare con map.geo.admin.ch) e minimappa

### Cosa non c'è ancora

Avversari, multiplayer, il resto del Ticino.

### Fonti

Fonte: Ufficio federale di topografia swisstopo (swissALTI3D, SWISSIMAGE) · © OpenStreetMap contributors (ODbL)
