// Prova dei PROFILI GRAFICI e del LOD lontano su un'app Electron (dal sorgente oppure INSTALLATA/impacchettata).
//   node tools/anteprima_prova/prova_profili_lod.mjs <eseguibile electron o app installata> <cartella dell'app (dove sta "dati")> <uscita> [versione attesa]
// Per ogni profilo (Bassa, Media, Alta, Ultra): lo seleziona, controlla che sia salvato, che il gioco continui a disegnare,
// che il LOD lontano sia spento in Bassa e (con il tempo) attivo negli altri, e che non ci siano errori in console.
// Controlla anche la versione dell'app. Grafica software: contano gli esiti, NON gli FPS.
import { _electron as electron } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [eseguibile, cartellaApp, uscita, versioneAttesa] = process.argv.slice(2);
if (!eseguibile || !cartellaApp || !uscita) { console.error("uso: prova_profili_lod.mjs <eseguibile> <cartella app> <uscita> [versione]"); process.exit(2); }
fs.mkdirSync(uscita, { recursive: true });
const esiti = [];
const prova = (nome, ok, dettaglio) => { esiti.push({ nome, ok, dettaglio }); console.log((ok ? "OK      " : "FALLITO ") + nome + (dettaglio ? " - " + dettaglio : "")); };

const datiUtente = fs.mkdtempSync(path.join(os.tmpdir(), "mrw-profili-"));
const sorgente = fs.existsSync(path.join(cartellaApp, "main.js")) && fs.existsSync(path.join(cartellaApp, "node_modules", "electron")) && eseguibile.includes("electron");
const app = await electron.launch({
  executablePath: eseguibile,
  args: [...(sorgente ? [cartellaApp] : []), "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--user-data-dir=" + datiUtente],
  env: { ...process.env, MRW_URL_PACCHETTI: "http://127.0.0.1:9/" }   // nessun download: si prova la regione inclusa
});
const errori = [];
const finestra = await app.firstWindow();
finestra.on("pageerror", (e) => errori.push("pageerror: " + e.message));
finestra.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errori.push(m.text()); });
await finestra.setViewportSize({ width: 800, height: 450 });

const versione = await app.evaluate(({ app: a }) => a.getVersion());
prova("versione dell'app", !versioneAttesa || versione === versioneAttesa, "trovata " + versione + (versioneAttesa ? ", attesa " + versioneAttesa : ""));
prova("l'app gira dalla cartella attesa", true, await app.evaluate(({ app: a }) => a.getAppPath()));

const t0 = Date.now();
await finestra.waitForFunction(() => document.getElementById("caricamento") && document.getElementById("caricamento").style.display === "none" && window.__mrw && window.__mrw.fotogrammi > 2, null, { timeout: 420000 });
prova("avvio e caricamento della regione inclusa (Locarno)", true, Math.round((Date.now() - t0) / 1000) + " s");
const info = await finestra.evaluate(async () => { const s = await window.regioniApp.stato(); return { attuale: s.attuale, inclusa: s.inclusa }; });
prova("regione attuale = regione inclusa", info.attuale === info.inclusa && !!info.attuale, JSON.stringify(info));
const scheda = await finestra.evaluate(() => { const gl = window.__mrw.disegnatore.getContext(); const e = gl.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; });
console.log("          rendering: " + scheda + " (grafica software in CI: gli FPS non contano)");

const risultati = {};
for (const q of (process.env.PROFILI || "bassa,media,alta,ultra").split(",")) {
  // il pulsante sta nel menu (Esc): se e' chiuso lo si apre; il cambio di profilo ricostruisce la scena e in software puo' richiedere minuti
  const pulsante = "button[data-qualita=" + q + "]";
  if (!(await finestra.locator(pulsante).isVisible())) { await finestra.keyboard.press("Escape"); await finestra.waitForTimeout(500); }
  await finestra.click(pulsante, { timeout: 420000 });
  await finestra.waitForTimeout(1500);
  const f0 = await finestra.evaluate(() => window.__mrw.fotogrammi);
  // il LOD si ricalcola con il movimento: si lascia girare e, se serve, si sposta la moto
  let vis = null, salvata = null;
  for (let i = 0; i < 12; i++) {
    await finestra.waitForTimeout(2500);
    const r = await finestra.evaluate(() => ({ q: localStorage.getItem("mrw-qualita"), vis: window.__mrw.lontano ? window.__mrw.lontano.visibili : null, f: window.__mrw.fotogrammi }));
    salvata = r.q; vis = r.vis;
    if (q === "bassa" || (vis && vis > 0)) break;
  }
  // in grafica software un fotogramma puo' richiedere decine di secondi: si aspetta il successivo
  await finestra.waitForFunction((n) => window.__mrw.fotogrammi > n, f0, { timeout: 180000 }).catch(() => {});
  const f1 = await finestra.evaluate(() => window.__mrw.fotogrammi);
  risultati[q] = { salvata, sagomeLOD: vis, fotogrammi: f1 - f0 };
  prova("profilo " + q + ": selezionato e salvato", salvata === q, "salvato " + salvata);
  prova("profilo " + q + ": il gioco continua a disegnare", f1 > f0, (f1 - f0) + " fotogrammi");
  if (q === "bassa") prova("profilo bassa: LOD lontano spento", !vis, "sagome " + vis);
  else prova("profilo " + q + ": LOD lontano attivo (sagome della citta')", vis > 0, "sagome " + vis);
  await finestra.screenshot({ path: path.join(uscita, "profilo_" + q + ".png"), timeout: 240000 }).catch(() => {});
}
prova("nessun errore di runtime in console", errori.length === 0, errori.slice(0, 5).join(" | "));
await app.close().catch(() => {});
fs.writeFileSync(path.join(uscita, "profili_lod.json"), JSON.stringify({ versione, scheda, risultati, errori, esiti }, null, 1));
const ko = esiti.filter((e) => !e.ok).length;
console.log("\n" + (esiti.length - ko) + " prove riuscite, " + ko + " fallite");
process.exit(ko ? 1 : 0);
