// Carica OGNUNA delle regioni del cantone (dati veri) nel gioco, in una pagina nuova, e controlla che parta senza errori:
// tempo di caricamento, errori, richieste fallite, memoria JavaScript, chiamate di disegno, triangoli, moto sulla strada,
// numero di strade/edifici caricati e sagome del LOD lontano. Poi la moto accelera qualche secondo.
//   node tools/anteprima_prova/prova_tutte_regioni.mjs <cartella app (senza dati)> <cartella con le regioni R_*> <uscita> [profilo] [R_xxxx_yyyy,...]
// <cartella app>: copia di anteprima/ con "cantone"; "dati" viene servito dalla regione in prova (nessun file da copiare).
// Grafica software: contano gli esiti (errori, caricamento, conteggi), NON gli FPS.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [radice, cartellaRegioni, uscita, profilo = "media", solo] = process.argv.slice(2);
if (!radice || !cartellaRegioni || !uscita) { console.error("Uso: node prova_tutte_regioni.mjs <app> <regioni> <uscita> [profilo] [id,id]"); process.exit(2); }
fs.mkdirSync(uscita, { recursive: true });
const regioni = fs.readdirSync(cartellaRegioni).filter((n) => /^R_\d{4}_\d{4}$/.test(n)).filter((n) => !solo || solo.split(",").includes(n)).sort();
let attuale = regioni[0];
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".bin": "application/octet-stream" };
const server = http.createServer((q, s) => {
  const url = decodeURIComponent(q.url.split("?")[0]);
  const f = url.startsWith("/dati/") ? path.join(cartellaRegioni, attuale, url.slice(6)) : path.join(path.resolve(radice), url);
  fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => {
    if (e) { s.writeHead(404); s.end("no"); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d);
  });
}).listen(0);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--js-flags=--expose-gc"] });   // expose-gc: con FORZA_GC=1 si libera la spazzatura prima di misurare la memoria JS
const risultati = [];
for (const id of regioni) {
  attuale = id;
  const p = await browser.newPage({ viewport: { width: 640, height: 360 } });
  p.setDefaultTimeout(900000);
  const errori = [], mancanti = [];
  p.on("pageerror", (e) => errori.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errori.push(m.text()); });
  p.on("response", (r) => { if (r.status() >= 400) mancanti.push(r.status() + " " + r.url().replace(/^http:\/\/localhost:\d+\//, "")); });
  await p.addInitScript((q) => { localStorage.setItem("mrw-qualita", q); localStorage.setItem("mrw-meteo", "sereno"); }, profilo);
  const t0 = Date.now();
  let esito = { id, ok: false };
  try {
    await p.goto("http://localhost:" + server.address().port + "/index.html");
    await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
    const caricamentoS = (Date.now() - t0) / 1000;
    await p.waitForFunction(() => window.__mrw && window.__mrw.strade && window.__mrw.fotogrammi > 4);
    const dati = await p.evaluate(async (FORZA_GC) => {
      const m = window.__mrw;
      m.moto.velocita = 0;
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", key: "ArrowUp" }));
      const f0 = m.fotogrammi;
      await new Promise((r) => { const t = setInterval(() => { if (m.fotogrammi > f0 + 6) { clearInterval(t); r(); } }, 200); });
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp", key: "ArrowUp" }));
      if (window.gc && FORZA_GC) { window.gc(); await new Promise((r) => setTimeout(r, 500)); window.gc(); }
      const i = m.disegnatore.info;
      const nan = [m.moto.x, m.moto.y, m.moto.z].some((v) => !Number.isFinite(v));
      return {
        strade: m.strade.lista.length, edifici: m.edifici.lista.length, motoSuStrada: !!m.moto.suStrada, motoNaN: nan,
        quota: Math.round(m.moto.y), nomeStrada: m.moto.nomeStrada || "", sagome: m.lontano ? m.lontano.visibili : null,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
        chiamate: i.render.calls, triangoli: i.render.triangles, texture: i.memory.textures, geometrie: i.memory.geometries,
        fotogrammi: m.fotogrammi, centro: m.terreno.info.centro_lv95
      };
    }, process.env.FORZA_GC === "1");
    esito = { id, ok: errori.length === 0 && !dati.motoNaN && dati.fotogrammi > 6, caricamento_s: +caricamentoS.toFixed(1), ...dati, errori: errori.slice(0, 3), richiesteFallite: Array.from(new Set(mancanti)).slice(0, 5) };
  } catch (e) {
    esito = { id, ok: false, errore: e.message.slice(0, 200), errori: errori.slice(0, 3) };
  }
  risultati.push(esito);
  console.log((esito.ok ? "OK      " : "FALLITO ") + id + " " + JSON.stringify(esito).slice(0, 360));
  await p.close();
}
await browser.close();
server.close();
fs.writeFileSync(path.join(uscita, "tutte_le_regioni_" + profilo + ".json"), JSON.stringify(risultati, null, 1));
const ko = risultati.filter((r) => !r.ok);
console.log("\n" + (risultati.length - ko.length) + " regioni su " + risultati.length + " partono senza errori");
process.exit(ko.length ? 1 : 0);
