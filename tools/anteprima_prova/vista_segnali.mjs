// Screenshot ravvicinati dei cartelli: si parte 12 m prima di uno STOP / di una precedenza / di una zona 30 e si guarda avanti.
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const uscita = process.argv[2]; fs.mkdirSync(uscita, { recursive: true });
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
p.setDefaultTimeout(240000);
await p.addInitScript(() => localStorage.setItem("mrw-qualita", "media"));
await p.goto("http://localhost:" + server.address().port + "/index.html");
await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 5);
for (const [nome, indice] of [["stop", 3], ["cedere", 5]]) {
  await p.evaluate(async ([nome, indice]) => {
    const d = await (await fetch("dati/dettagli.json")).json();
    const lista = nome === "stop" ? d.stop : d.precedenza;
    window.__mrw.vaiA(lista[indice * 2], lista[indice * 2 + 1]);
    const m = window.__mrw.moto;
    m.x += Math.sin(m.angolo) * 12; m.z += Math.cos(m.angolo) * 12; m.velocita = 0;
  }, [nome, indice]);
  const f0 = await p.evaluate(() => window.__mrw.fotogrammi);
  await p.waitForFunction((f) => window.__mrw.fotogrammi > f + 28, f0);
  await p.screenshot({ path: path.join(uscita, nome + ".png"), timeout: 240000 });
}
await b.close(); server.close();
