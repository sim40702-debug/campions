## MOTO RACING WORLD – Anteprima Ticino

Versione giocabile **leggera** del settore pilota di **Locarno** (8 × 8 km), con il terreno vero di swisstopo e le strade vere di OpenStreetMap.
La versione principale del gioco resta quella in Unreal Engine 5.

### Novità di questa versione (0.2.0) – Sprint D1

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
- **H**: nasconde l'aiuto

### Cosa c'è

- Terreno swissALTI3D (un punto ogni 4 m circa)
- Strade OpenStreetMap, con i ponti; le gallerie sono in marrone (per ora passano dentro la montagna)
- Lago Maggiore
- Edifici, boschi e alberi di OpenStreetMap
- Velocità, quota reale, coordinate LV95 (si possono confrontare con map.geo.admin.ch) e minimappa

### Cosa non c'è ancora

Gallerie vere, segnaletica, avversari, multiplayer.

### Fonti

Fonte: Ufficio federale di topografia swisstopo · © OpenStreetMap contributors (ODbL)
