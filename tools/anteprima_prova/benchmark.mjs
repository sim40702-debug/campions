// Benchmark ripetibile dell'anteprima, da riga di comando (Chromium + Playwright).
//   node tools/anteprima_prova/benchmark.mjs <cartella_risultati> [qualita=media] [fotogrammi=40] [durata_s=0] [riscaldamento_s=0] [larghezza=640] [altezza=360]
// Scrive <cartella>/benchmark_<qualita>.json e .md con l'AMBIENTE di misura (scheda video, browser, core).
// Con la grafica software (SwiftShader) gli FPS non rappresentano un PC vero: servono per confrontare versioni sulla stessa macchina.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const radice = path.resolve(import.meta.dirname, "../../anteprima");
const [uscita, qualita = "media", fotogrammi = "40", durata = "0", riscaldamento = "0", larg = "640", alt = "360"] = process.argv.slice(2);
fs.mkdirSync(uscita, { recursive: true });
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((q, s) => {
  const f = path.join(radice, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => {
    if (e) { s.writeHead(404); s.end("no"); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d);
  });
}).listen(0);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const pagina = await browser.newPage({ viewport: { width: +larg, height: +alt } });
const errori = [];
pagina.on("pageerror", (e) => errori.push(e.message));
pagina.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errori.push(m.text()); });
await pagina.addInitScript((q) => { localStorage.setItem("mrw-qualita", q); }, qualita);
const t0 = Date.now();
await pagina.goto("http://localhost:" + server.address().port + "/index.html");
await pagina.waitForFunction(() => document.getElementById("caricamento").style.display === "none", null, { timeout: 300000 });
const caricamento = (Date.now() - t0) / 1000;
await pagina.waitForFunction(() => window.__mrw && window.__mrw.eseguiBenchmark, null, { timeout: 60000 });
const r = await pagina.evaluate(async (o) => {
  const risultato = await window.__mrw.eseguiBenchmark(o);
  risultato.markdown = window.__mrw.benchmarkMarkdown(risultato);
  return risultato;
}, { fotogrammi: +fotogrammi, durata: +durata, riscaldamento: +riscaldamento });
r.caricamento_misurato_s = +caricamento.toFixed(2);
r.errori_console = errori;
fs.writeFileSync(path.join(uscita, "benchmark_" + qualita + ".json"), JSON.stringify(r, null, 2));
fs.writeFileSync(path.join(uscita, "benchmark_" + qualita + ".md"), r.markdown + "\n\nErrori in console: " + (errori.length ? errori.join("; ") : "nessuno") + "\n");
console.log(r.markdown);
await browser.close(); server.close();
