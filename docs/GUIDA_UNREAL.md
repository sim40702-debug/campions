# Guida: importare il terreno in Unreal Engine 5 (Mac e Windows)

I passi sono **uguali su Mac e Windows**. Cambiano solo le scorciatoie: su Mac `Cmd` al posto di `Ctrl`.

Prima di iniziare: esegui gli script in `tools/geo` (vedi `tools/geo/LEGGIMI.md`) con `--pilota`.

## 1. Programmi da installare (una volta sola)

| Programma | Mac | Windows |
|---|---|---|
| Epic Games Launcher + Unreal Engine 5 (ultima versione stabile, decisione D8) | Sì | Sì |
| Git LFS (per i file grandi di Unreal) | `brew install git-lfs` poi `git lfs install` | installer da git-lfs.com poi `git lfs install` |
| Per il codice C++ (dallo Sprint B, se serve) | Xcode | Visual Studio 2022 con "Game development with C++" |

Scrivi nello Sprint Report la versione esatta di Unreal che usi: tutti devono usare la **stessa**.

## 2. Creare il progetto

1. Epic Games Launcher → Unreal Engine → Avvia.
2. **Games → Blank**, progetto **Blueprint** (il C++ si aggiunge dopo, se serve).
3. Nome: `MotoRacingWorld`. Cartella: `unreal/` dentro la repository `campions`.
4. Edit → Plugins: attiva **Python Editor Script Plugin** e **Procedural Content Generation Framework**. Riavvia.

## 3. Creare la mappa del settore pilota

1. File → New Level → **Empty Open World** (ha già World Partition).
2. Salva come `Content/Mappe/Ticino_Pilota`.

## 4. Importare il terreno

1. Modalità **Landscape** (Shift+2) → **New** → **Import from File**.
2. Heightmap File: `tools/geo/dati/per_unreal/pilota/terreno_pilota.png`.
3. Inserisci i valori del file `impostazioni_unreal.json` (stessa cartella):

| Campo in Unreal | Valore pilota |
|---|---|
| Location X / Y / Z | -200000 / 400000 / 180000 |
| Scale X / Y / Z | 196.8504 / 196.8504 / 700 |
| Section Size | 127x127 Quads |
| Sections Per Component | 1x1 Section |
| World Partition Grid Size | 2 (= circa 500 m) |

4. Il numero di componenti deve risultare **32 x 32** (4065 punti). Premi **Import**.

## 5. Controllare che sia giusto

Con il gioco avviato o nell'editor, guarda le coordinate:

- **Piazza Grande a Locarno**: X circa 270000, Y circa 780000. La Z deve essere circa **20000** (circa 200 m sul mare).
- **Superficie del Lago Maggiore**: Z circa **19300** (193 m).
- Il nord è in alto nella vista dall'alto (Y diminuisce andando a nord).

Regola facile: **Z in centimetri = quota reale in metri × 100**.

Se i numeri non tornano, scrivilo nel Bug Tracker con uno screenshot.

## 6. Griglie di caricamento (World Partition)

Window → World Settings → World Partition Setup → Runtime Partitions. Crea queste griglie (valori in cm):

| Nome griglia | Cell Size | Loading Range |
|---|---|---|
| Terreno_Strade | 51200 | 204800 |
| Edifici | 25600 | 102400 |
| Dettagli | 12800 | 40960 |

Per ora c'è solo il terreno; le altre griglie servono dallo Sprint B in poi.

## 7. Layer "Confine" (solo per tutto il Ticino)

Nel settore pilota il confine cantonale non passa, quindi questo layer serve solo quando si importa tutto il Ticino:

1. Crea un materiale `M_Terreno_Base` con un nodo **Landscape Layer Blend** e due layer: `Terreno` (grigio/verde) e `Confine` (rosso).
2. Assegnalo al Landscape.
3. Nella finestra di import, al layer `Confine` assegna i file `confine_x0_y0.png`, … della cartella `confini/layer_confine`.

## 8. Tutto il Ticino (solo dopo che il pilota è OK)

- Stessi passi, ma scegli il file `terreno/terreno_x0_y0.png`: Unreal riconosce da solo i tasselli `_x?_y?`.
- Usa i valori di `dati/per_unreal/ticino/terreno/impostazioni_unreal.json`.
- Servono almeno 32 GB di RAM (meglio 64) e molto spazio sul disco (decisione D7).

## 9. Mac e Windows: cosa cambia

- Il **progetto** è lo stesso e si apre su tutti e due.
- Per creare il **gioco finito** per Windows serve un PC Windows. Per creare quello per Mac serve un Mac con Xcode.
- Il multiplayer funziona tra giocatori Mac e Windows solo se hanno la **stessa versione** del gioco.
