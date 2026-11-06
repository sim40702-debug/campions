# Anteprima Ticino (Three.js + Electron)

Versione giocabile leggera del settore pilota di Locarno. Progetto: `docs/anteprima/PROGETTO_ANTEPRIMA.pdf`.

## Per giocare

Scarica l'app già pronta dalla pagina **Releases** della repository (file `.dmg` per Mac, `.exe` per Windows).
Le release le crea GitHub da solo: vedi sotto.

## Come nasce una release

1. Si cambia la versione in `anteprima/package.json` (per esempio da 0.1.0 a 0.1.1) e si fa il push su `main`. Il tag `anteprima-vX.Y.Z` lo crea GitHub.
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
| `aggiornamenti.js` | Pulsante Aggiorna: controlla, scarica e installa la nuova release |
| `preload.js` | Collega il pulsante della pagina con Electron |
| `index.html`, `stile.css` | Pagina e scritte sullo schermo |
| `src/gioco.js` | Scena, telecamera, tastiera, ciclo del gioco |
| `src/terreno.js` | Terreno e lago |
| `src/strade.js` | Strade e ricerca della strada sotto la moto |
| `src/moto.js` | Modello e guida della moto |
| `src/interfaccia.js` | Velocità, quota, coordinate, minimappa |
| `src/edifici.js` | Edifici e collisioni |
| `src/alberi.js` | Boschi e alberi vicino alla moto |
| `src/aggiorna.js` | Pulsante e pannello "Aggiorna" |
| `src/dettagli.js` | Semafori, cartelli, lampioni, strisce, località |
| `src/acqua.js` | Fiumi, torrenti, stagni |
| `src/opere.js` | Gallerie (tubo, luci, portali) e piloni dei ponti |
| `src/impostazioni.js` | Menu qualità grafica |
| `src/prestazioni.js` | Contatore FPS e test prestazioni |
| `src/moto_modelli.js` | Le 5 moto: prestazioni e modelli 3D |
| `src/garage.js` | Menu garage |
| `src/audio.js` | Suono del motore |
| `src/trasporti.js` | Ferrovie, funicolari, teleferiche con cabine in movimento |
| `NOTE_RELEASE.md` | Testo della pagina della release |
