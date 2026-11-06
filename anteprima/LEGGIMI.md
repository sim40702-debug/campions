# Anteprima Ticino (Three.js + Electron)

Versione giocabile leggera del settore pilota di Locarno. Progetto: `docs/anteprima/PROGETTO_ANTEPRIMA.pdf`.

## Per giocare

Scarica l'app già pronta dalla pagina **Releases** della repository (file `.dmg` per Mac, `.exe` per Windows).
Le release le crea GitHub da solo: vedi sotto.

## Come nasce una release

1. Si crea un tag `anteprima-vX.Y.Z` (per esempio `anteprima-v0.1.0`).
2. Il workflow `.github/workflows/release-anteprima.yml`:
   - scarica i dati veri (swisstopo, OpenStreetMap) ed esegue i passi 1–7 di `tools/geo`;
   - costruisce l'app su un Mac e su un PC Windows;
   - pubblica i file nella pagina Releases.
3. Nella pagina del workflow (Actions) c'è anche il registro dei passi con le misure delle strade.

## Per provarla dal codice (facoltativo)

Servono Node.js 20 e i dati del passo 7 in `anteprima/dati`:

```
cd tools/geo
python3 avvia_pilota.py
python3 passo7_esporta_anteprima.py
cd ../../anteprima
npm install
npm start
```

Su Windows scrivi `python` al posto di `python3`.

## File

| File | Cosa fa |
|---|---|
| `main.js` | Finestra Electron |
| `index.html`, `stile.css` | Pagina e scritte sullo schermo |
| `src/gioco.js` | Scena, telecamera, tastiera, ciclo del gioco |
| `src/terreno.js` | Terreno e lago |
| `src/strade.js` | Strade e ricerca della strada sotto la moto |
| `src/moto.js` | Modello e guida della moto |
| `src/interfaccia.js` | Velocità, quota, coordinate, minimappa |
| `NOTE_RELEASE.md` | Testo della pagina della release |
