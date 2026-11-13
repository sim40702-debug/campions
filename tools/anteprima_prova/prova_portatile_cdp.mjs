// Prova dell'INTERFACCIA della versione portatile (Windows): il portatile e' un lanciatore che estrae l'app in una cartella
// temporanea e avvia un processo figlio, quindi Playwright non puo' lanciarlo direttamente. Qui lo si avvia come farebbe un
// utente, con --remote-debugging-port (il lanciatore passa gli argomenti all'app) e ci si collega via CDP alla finestra vera.
//   node prova_portatile_cdp.mjs <portatile.exe> <uscita> [versione attesa] [porta]
// Controlla: l'app risponde, la versione, la regione inclusa si carica e il gioco disegna, i profili Bassa e Alta si
// selezionano e restano salvati, il LOD lontano e' spento in Bassa e attivo in Alta, nessun errore in console.
// Grafica software (CI): contano gli esiti, NON gli FPS.
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [portatile, uscita, versioneAttesa, portaArg] = process.argv.slice(2);
if (!portatile || !uscita) { console.error("uso: prova_portatile_cdp.mjs <portatile.exe> <uscita> [versione] [porta]"); process.exit(2); }
const porta = portaArg || "9333";
fs.mkdirSync(uscita, { recursive: true });
const esiti = [];
const prova = (nome, ok, dettaglio) => { esiti.push({ nome, ok, dettaglio }); console.log((ok ? "OK      " : "FALLITO ") + nome + (dettaglio ? " - " + dettaglio : "")); };
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

const datiUtente = fs.mkdtempSync(path.join(os.tmpdir(), "mrw-portatile-"));
const figlio = spawn(portatile, [
  "--remote-debugging-port=" + porta, "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--enable-precise-memory-info", "--user-data-dir=" + datiUtente
], { env: { ...process.env, MRW_URL_PACCHETTI: "http://127.0.0.1:9/" }, stdio: "ignore", detached: false });
let uscito = null;
figlio.on("exit", (c) => { uscito = c; });
console.log("portatile avviato (pid " + figlio.pid + "), attendo l'estrazione e la porta di debug " + porta);

const chiudi = () => {
  try { execSync('taskkill /F /T /IM "MRW*" 2>nul', { stdio: "ignore", shell: "cmd.exe" }); } catch { /* niente da chiudere */ }
  try { figlio.kill(); } catch { /* gia' chiuso */ }
};

let browser = null;
const t0 = Date.now();
while (Date.now() - t0 < 300000) {
  try {
    const r = await fetch("http://127.0.0.1:" + porta + "/json/version");
    if (r.ok) { browser = await chromium.connectOverCDP("http://127.0.0.1:" + porta); break; }
  } catch { /* non ancora pronto */ }
  await attesa(2000);
}
prova("il portatile si avvia e apre la porta di debug", !!browser, Math.round((Date.now() - t0) / 1000) + " s");
if (!browser) { chiudi(); console.log("\n0 prove riuscite, 1 fallita"); process.exit(1); }

const contesto = browser.contexts()[0];
let finestra = contesto.pages().find((p) => /index\.html/.test(p.url())) || contesto.pages()[0];
for (let i = 0; i < 60 && !finestra; i++) { await attesa(1000); finestra = contesto.pages()[0]; }
prova("la finestra del gioco esiste", !!finestra, finestra ? finestra.url().slice(0, 100) : "");
const errori = [];
finestra.on("pageerror", (e) => errori.push("pageerror: " + e.message));
finestra.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errori.push(m.text()); });
await finestra.setViewportSize({ width: 800, height: 450 }).catch(() => {});

const versione = await finestra.evaluate(() => window.aggiornamenti.versione());
prova("versione dell'app portatile", !versioneAttesa || versione === versioneAttesa, "trovata " + versione + (versioneAttesa ? ", attesa " + versioneAttesa : ""));

const t1 = Date.now();
await finestra.waitForFunction(() => document.getElementById("caricamento") && document.getElementById("caricamento").style.display === "none" && window.__mrw && window.__mrw.fotogrammi > 2, null, { timeout: 420000 });
prova("avvio e caricamento della regione inclusa (Locarno)", true, Math.round((Date.now() - t1) / 1000) + " s");
const info = await finestra.evaluate(async () => { const s = await window.regioniApp.stato(); return { attuale: s.attuale, inclusa: s.inclusa }; });
prova("regione attuale = regione inclusa", info.attuale === info.inclusa && !!info.attuale, JSON.stringify(info));

for (const q of ["bassa", "alta"]) {
  const pulsante = "button[data-qualita=" + q + "]";
  if (!(await finestra.locator(pulsante).isVisible())) { await finestra.keyboard.press("Escape"); await finestra.waitForTimeout(500); }
  await finestra.click(pulsante, { timeout: 420000 });
  await finestra.waitForTimeout(1500);
  const f0 = await finestra.evaluate(() => window.__mrw.fotogrammi);
  let vis = null, salvata = null;
  for (let i = 0; i < 12; i++) {
    await finestra.waitForTimeout(2500);
    const r = await finestra.evaluate(() => ({ q: localStorage.getItem("mrw-qualita"), vis: window.__mrw.lontano ? window.__mrw.lontano.visibili : null }));
    salvata = r.q; vis = r.vis;
    if (q === "bassa" || (vis && vis > 0)) break;
  }
  await finestra.waitForFunction((n) => window.__mrw.fotogrammi > n, f0, { timeout: 180000 }).catch(() => {});
  const f1 = await finestra.evaluate(() => window.__mrw.fotogrammi);
  prova("portatile, profilo " + q + ": selezionato e salvato", salvata === q, "salvato " + salvata);
  prova("portatile, profilo " + q + ": il gioco continua a disegnare", f1 > f0, (f1 - f0) + " fotogrammi");
  if (q === "bassa") prova("portatile, profilo bassa: LOD lontano spento", !vis, "sagome " + vis);
  else prova("portatile, profilo " + q + ": LOD lontano attivo", vis > 0, "sagome " + vis);
  await finestra.screenshot({ path: path.join(uscita, "portatile_" + q + ".png"), timeout: 240000 }).catch(() => {});
}
console.log("          (informativo) lanciatore: " + (uscito === null ? "ancora attivo" : "uscito con codice " + uscito + ", normale se ha passato il controllo al processo figlio"));
prova("nessun errore di runtime in console", errori.length === 0, errori.slice(0, 5).join(" | "));
await browser.close().catch(() => {});
chiudi();
fs.writeFileSync(path.join(uscita, "portatile.json"), JSON.stringify({ versione, info, errori, esiti }, null, 1));
const ko = esiti.filter((e) => !e.ok).length;
console.log("\n" + (esiti.length - ko) + " prove riuscite, " + ko + " fallite");
process.exit(ko ? 1 : 0);
