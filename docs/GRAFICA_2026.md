# Grafica 2026: miglioramenti al gioco (anteprima/)

Tutto e' nel gioco vero (Three.js), non in una demo a parte. Fisica, comandi e dati delle moto non sono toccati.

## Cosa e' stato fatto
| Area | Cosa | File |
|---|---|---|
| Rendering | Scena disegnata in HDR (HalfFloat) con anti-aliasing 4x, poi un passaggio finale: tone mapping ACES, curva a S, saturazione, ombre fredde / luci calde, vignettatura, nitidezza leggera, rumore anti-banding | `src/postprocesso.js` (nuovo) |
| Bagliore | Bloom a due livelli sulle luci forti (lampioni, finestre, fari, riflessi del sole); piu' forte di notte | `src/postprocesso.js` |
| Occlusione ambientale | AO dallo spazio schermo (solo profondita', 10 campioni, meta' risoluzione, sfocatura che rispetta i bordi, sfuma oltre 90-160 m) | `src/postprocesso.js` |
| Luce | Sole piu' intenso e caldo, emisfero piu' basso: ombre piu' marcate; riflessi del cielo piu' forti | `src/ambiente.js` |
| Superfici | Asfalto, marciapiedi e terreno: macchie di usura, grana, lucidita' variabile e rilievo (bump) calcolato dalla GPU, con sfumatura a distanza | `src/superfici.js` (nuovo), `src/strade.js`, `src/terreno.js` |
| Moto | Riflessi del cielo per materiale (vernice con clearcoat piu' forte, metalli, gomma opaca); le moto semplici di riserva passano da Phong/Lambert a PBR | `src/modelli3d.js`, `src/moto_modelli.js`, `src/gioco.js` |
| Effetti | Fumo delle gomme in derapata/frenata, polvere fuori strada, spruzzi sul bagnato: un solo disegno, 360 particelle | `src/particelle.js` (nuovo) |
| Interfaccia | HUD, minimappa, barre, finestre, garage, caricamento ridisegnati con variabili CSS, focus da tastiera, ARIA, schermi piccoli, riduzione del movimento | `stile.css`, `index.html`, `src/interfaccia.js` |

## Qualita'
Bassa: come prima (niente post-elaborazione). Media: HDR + MSAA + bagliore 80% + AO. Alta e Ultra: bagliore 100%.

## Prestazioni (da verificare su una GPU vera)
Le prove automatiche girano con grafica software (SwiftShader), quindi gli FPS non sono significativi.
Misurato: 902 -> ~1000 chiamate di disegno a Locarno (i passaggi della post-elaborazione e le particelle), triangoli invariati.
Costo atteso su GPU: un fotogramma in piu' a schermo intero con MSAA 4x in half-float, un passaggio AO e 6 passaggi piccoli.
Se serve piu' margine: ridurre `N` dei campioni AO, spegnere `post.ao`, o usare Bassa.
Eseguire il benchmark ripetibile (Impostazioni > Benchmark) prima e dopo per confrontare.

## Non fatto
- Texture ad alta risoluzione / normal map vere per edifici e alberi: le facciate sono gia' texture procedurali; cambiarle serve nuovi asset.
- Nuvole volumetriche: le nuvole sono un piano con rumore (leggero); volumetriche costerebbero troppo.
- Riflessi in tempo reale (SSR): costosi; restano i riflessi del cielo.
- Nuovi modelli 3D: i .glb delle moto sono gia' PBR con clearcoat, non sostituiti.
- Motion blur e profondita' di campo: non aggiunti (peggiorano la leggibilita' a velocita').
- Nessuna prova su GPU reale ne' con i dati veri swisstopo/OSM (usati i dati di prova di `tools/anteprima_prova/genera_dati_prova.mjs`).

## Da controllare giocando
Intensita' di AO e bagliore, fumo delle gomme, leggibilita' dell'HUD su sole forte, FPS in citta' con qualita' Alta/Ultra.
