// Misura il costo CPU (JavaScript) per fotogramma mentre ci si sposta: aggiornamenti e invio dei disegni.
// A differenza degli FPS, e' indicativo anche con la grafica software: i "colpi" (hitch) sono lavoro JS bloccante.
//   node tools/anteprima_prova/tempi_cpu.mjs [qualita=bassa]
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const qualita = process.argv[2] || "bassa";
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 480, height: 270 } });
p.setDefaultTimeout(240000);
await p.addInitScript((q) => localStorage.setItem("mrw-qualita", q), qualita);
await p.goto("http://localhost:" + server.address().port + "/index.html");
await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 20);
await p.evaluate(() => { window.__mrw.tempi.js.length = 0; window.__mrw.tempi.render.length = 0; });
// teletrasporti lungo la mappa (nuovi pezzi di terreno, alberi) e guida avanti
for (const [x, z] of [[600, 1050], [3600, 500], [-1900, 1300], [5600, 800], [-4300, -2800]]) {
  await p.evaluate(([x, z]) => window.__mrw.vaiA(x, z), [x, z]);
  await p.keyboard.down("ArrowUp");
  const f0 = await p.evaluate(() => window.__mrw.fotogrammi);
  await p.waitForFunction((f) => window.__mrw.fotogrammi > f + 25, f0);
  await p.keyboard.up("ArrowUp");
}
const r = await p.evaluate(() => {
  const st = (a) => { const o = a.slice().sort((x, y) => x - y); const m = a.reduce((s, v) => s + v, 0) / a.length; return { n: a.length, medio_ms: +m.toFixed(1), p95_ms: +o[Math.floor(o.length * 0.95)].toFixed(1), max_ms: +o[o.length - 1].toFixed(1) }; };
  const t = window.__mrw.tempi; return { js_aggiornamenti: st(t.js), invio_disegni: st(t.render) };
});
console.log(qualita, JSON.stringify(r));
await b.close(); server.close();
