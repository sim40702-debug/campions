## MOTO RACING WORLD – Anteprima Ticino

Versione giocabile **leggera** del **Locarnese** (16 × 12 km), con il terreno vero di swisstopo e le strade vere di OpenStreetMap.
La versione principale del gioco resta quella in Unreal Engine 5.

### Novità di questa versione (0.9.0) – Sprint H2

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
