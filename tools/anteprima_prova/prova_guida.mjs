// Prova di guida automatica della macchina: un "pilota" che usa solo i tasti (sinistra/destra/gas, come un giocatore)
// segue una strada per 60 secondi simulati. Riporta urti, tempo fuori strada, velocita' e sbandamento massimo.
//   node tools/anteprima_prova/prova_guida.mjs
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 480, height: 270 } });
p.setDefaultTimeout(300000);
p.on("pageerror", (e) => console.log("pageerror: " + e.message));
await p.addInitScript(() => { localStorage.setItem("mrw-qualita", "bassa"); localStorage.setItem("mrw-moto", "driftgt"); });
await p.goto("http://localhost:" + server.address().port + "/index.html");
await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 3);
let fallite = 0;
for (const nome of ["Via Locarno-Ascona", "Via Cantonale", "Locarno via 0", "Via alla Cimetta"]) {
  const r = await p.evaluate(async (nome) => {
    const { aggiornaAuto } = await import("/src/auto.js");
    const m = window.__mrw, auto = m.moto, strade = m.strade;
    if (auto.scheda.tipo !== "auto") return { errore: "non e' la macchina: " + auto.scheda.nome };
    const s = strade.lista.find((x) => x.n === nome);
    const q = s.p, n = q.length / 3;
    auto.x = q[0]; auto.y = q[1]; auto.z = q[2];
    auto.angolo = auto.direzione = Math.atan2(-(q[3] - q[0]), -(q[5] - q[2]));
    auto.velocita = 0; auto.caduta = 0; auto.giroAuto = 0; auto.sterzoDolce = 0; auto.beccheggio = 0; auto.piega = 0;
    const ris = { nome: nome, urti: 0, motivo: "", fuoriStrada: 0, vmax: 0, sbandata: 0, saltoQuota: 0, arrivato: false, secondi: 0 };
    let k = 0;
    const dt = 1 / 60;
    for (let passo = 0; passo < 60 * 60; passo++) {
      // punto della strada piu' vicino (avanzando) e punto da mirare piu' avanti
      while (k < n - 2 && Math.hypot(q[k * 3 + 3] - auto.x, q[k * 3 + 5] - auto.z) < Math.hypot(q[k * 3] - auto.x, q[k * 3 + 2] - auto.z)) k++;
      if (k >= n - 6) { ris.arrivato = true; break; }
      let avanti = 10 + Math.abs(auto.velocita) * 0.7, j = k;
      while (j < n - 1 && avanti > 0) { avanti -= Math.hypot(q[j * 3 + 3] - q[j * 3], q[j * 3 + 5] - q[j * 3 + 2]); j++; }
      const voluto = Math.atan2(-(q[j * 3] - auto.x), -(q[j * 3 + 2] - auto.z));
      let err = voluto - auto.angolo;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const tasti = { su: Math.abs(err) < 0.5, giu: Math.abs(err) > 0.9 && auto.velocita > 12, sinistra: err > 0.04, destra: err < -0.04, frenoDietro: false };
      const yPrima = auto.y;
      aggiornaAuto(auto, tasti, dt, m.terreno, strade, m.edifici);
      ris.secondi += dt;
      if (auto.nuovaCaduta || auto.caduta > 0) { ris.urti++; ris.motivo = auto.motivoCaduta; break; }
      if (!auto.suStrada) ris.fuoriStrada += dt;
      ris.vmax = Math.max(ris.vmax, auto.velocita * 3.6);
      ris.sbandata = Math.max(ris.sbandata, Math.hypot(auto.x - q[k * 3], auto.z - q[k * 3 + 2]));
      ris.saltoQuota = Math.max(ris.saltoQuota, Math.abs(auto.y - yPrima));
    }
    for (const c of ["fuoriStrada", "vmax", "sbandata", "saltoQuota", "secondi"]) ris[c] = +ris[c].toFixed(2);
    return ris;
  }, nome);
  console.log(JSON.stringify(r));
  if (r.errore || r.urti > 0 || r.fuoriStrada > 1 || r.sbandata > 8) fallite++;
}
await b.close(); server.close();
process.exit(fallite > 0 ? 1 : 0);
