// Prova dell'app Electron IMPACCHETTATA (non del codice sorgente): avvio, caricamento, minimappa, meteo, impostazioni salvate,
// benchmark, errori di runtime.
//   xvfb-run -a node tools/anteprima_prova/prova_electron.mjs <eseguibile> <cartella_screenshot>
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [eseguibile, uscita] = process.argv.slice(2);
fs.mkdirSync(uscita, { recursive: true });
const esiti = [];
const prova = (nome, ok, dettaglio) => { esiti.push({ nome, ok, dettaglio }); console.log((ok ? "OK    " : "FALLITO ") + nome + (dettaglio ? " - " + dettaglio : "")); };

async function avvia() {
  return electron.launch({ executablePath: eseguibile, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
}

const app = await avvia();
const errori = [];
const finestra = await app.firstWindow();
finestra.on("pageerror", (e) => errori.push("pageerror: " + e.message));
finestra.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errori.push(m.text()); });
await finestra.setViewportSize({ width: 800, height: 450 });
const t0 = Date.now();
try {
  await finestra.waitForFunction(() => document.getElementById("caricamento") && document.getElementById("caricamento").style.display === "none", null, { timeout: 300000 });
  prova("avvio e caricamento del mondo", true, Math.round((Date.now() - t0) / 1000) + " s");
} catch (e) {
  prova("avvio e caricamento del mondo", false, await finestra.textContent("#stato"));
}
await finestra.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 3, null, { timeout: 200000 }).catch(() => {});
prova("la versione dell'app e' quella attesa", (await app.evaluate(({ app }) => app.getVersion())) === process.env.VERSIONE_ATTESA, await app.evaluate(({ app }) => app.getVersion()));

// minimappa: il canvas ha disegnato qualcosa (non e' vuoto) e contiene colori diversi
const mini = await finestra.evaluate(() => {
  const c = document.getElementById("minimappa");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  const colori = new Set();
  for (let i = 0; i < d.length; i += 4 * 97) colori.add(d[i] + "," + d[i + 1] + "," + d[i + 2]);
  return { larghezza: c.width, colori: colori.size };
});
prova("minimappa disegnata nel pacchetto", mini.colori > 12, mini.larghezza + " px, " + mini.colori + " colori");

// mappa grande: apri con P, cerca, seleziona
await finestra.keyboard.press("KeyP");
await finestra.waitForTimeout(800);
await finestra.keyboard.type("Asc");
await finestra.waitForFunction(() => document.getElementById("cercaMappa").value === "Asc", null, { timeout: 60000 }).catch(() => {});
const ris = await finestra.evaluate(() => [...document.querySelectorAll("#risultatiMappa button span:first-child")].map((b) => b.textContent));
prova("mappa grande: la ricerca 'Asc' filtra e trova Ascona", ris.includes("Ascona") && ris.every((n) => /asc/i.test(n)), ris.length + " risultati: " + ris.slice(0, 3).join(", "));
await finestra.screenshot({ path: path.join(uscita, "mappa.png"), timeout: 240000 });
await finestra.keyboard.press("Escape");

// meteo: pioggia intensa dal menu e controllo dei valori
await finestra.keyboard.press("Escape");
await finestra.click("button[data-meteo=pioggia_intensa]");
await finestra.waitForFunction(() => window.__mrw.ambiente.pioggia > 0.2, null, { timeout: 240000 }).catch(() => {});
const pioggia = await finestra.evaluate(() => ({ meteo: window.__mrw.ambiente.meteo, pioggia: window.__mrw.ambiente.pioggia, bagnato: window.__mrw.ambiente.uniformi.bagnato.value }));
prova("meteo: pioggia intensa attiva (particelle e asfalto bagnato)", pioggia.pioggia > 0.2 && pioggia.bagnato > 0, JSON.stringify(pioggia));
await finestra.click("#cursoreOra").catch(() => {});
await finestra.evaluate(() => { const c = document.getElementById("cursoreOra"); c.value = 22; c.dispatchEvent(new Event("input")); });
await finestra.click("#sceltaQualita button[data-qualita=alta]");
await finestra.waitForTimeout(1500);
await finestra.screenshot({ path: path.join(uscita, "pioggia_notte_alta.png"), timeout: 240000 });
const salvate = await finestra.evaluate(() => ({ q: localStorage.getItem("mrw-qualita"), m: localStorage.getItem("mrw-meteo"), o: localStorage.getItem("mrw-ora") }));
prova("impostazioni salvate (qualita', meteo, ora)", salvate.q === "alta" && salvate.m === "pioggia_intensa" && salvate.o === "22.00", JSON.stringify(salvate));
const wm = await finestra.evaluate(async () => {
  const r = await window.__mrw.eseguiBenchmark({ fotogrammi: 6, durata: 0, riscaldamento: 0, scenari: ["centro_storico"] });
  return { n: r.risultati.length, fps: r.risultati[0].fps_medi, grafica: r.ambiente.grafica_software };
});
prova("benchmark eseguibile nel pacchetto", wm.n === 1 && wm.fps > 0, JSON.stringify(wm));
prova("nessun errore di runtime in console", errori.length === 0, errori.slice(0, 3).join(" | "));
await app.close();

// seconda esecuzione: le impostazioni devono essere ancora li' (persistenza fra un avvio e l'altro)
const app2 = await avvia();
const f2 = await app2.firstWindow();
await f2.waitForFunction(() => document.getElementById("caricamento") && document.getElementById("caricamento").style.display === "none", null, { timeout: 300000 }).catch(() => {});
const dopo = await f2.evaluate(() => ({ q: localStorage.getItem("mrw-qualita"), m: localStorage.getItem("mrw-meteo"), meteoAttivo: window.__mrw && window.__mrw.ambiente.meteo, ora: window.__mrw && window.__mrw.ambiente.ora }));
prova("persistenza dopo il riavvio dell'app", dopo.q === "alta" && dopo.m === "pioggia_intensa" && dopo.meteoAttivo === "pioggia_intensa" && Math.abs(dopo.ora - 22) < 0.1, JSON.stringify(dopo));
await app2.close();
fs.writeFileSync(path.join(uscita, "esiti_electron.json"), JSON.stringify(esiti, null, 2));
process.exit(esiti.every((e) => e.ok) ? 0 : 1);
