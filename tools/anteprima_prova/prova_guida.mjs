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
// le strade di prova: le 6 piu' lunghe (non gallerie), qualunque siano i dati (di prova o veri)
const nomi = await p.evaluate(() => window.__mrw.strade.lista.map((s, i) => [i, s.p.length, s.g || s.b]).filter((v) => !v[2]).sort((a, b) => b[1] - a[1]).slice(0, 6).map((v) => v[0]));
for (const nome of nomi) {
  const r = await p.evaluate(async (nome) => {
    const { aggiornaAuto } = await import("/src/auto.js");
    const m = window.__mrw, auto = m.moto, strade = m.strade;
    if (auto.scheda.tipo !== "auto") return { errore: "non e' la macchina: " + auto.scheda.nome };
    const s = strade.lista[nome];
    nome = s.n + " (" + s.t + ")";
    const q = s.p, n = q.length / 3;
    // si parte dal primo punto ad almeno 30 m dal bordo della mappa (li' il gioco non lascia passare)
    let k = 0;
    while (k < n - 8 && (Math.abs(q[k * 3]) > m.terreno.metaX - 30 || Math.abs(q[k * 3 + 2]) > m.terreno.metaZ - 30)) k++;
    auto.x = q[k * 3]; auto.y = q[k * 3 + 1]; auto.z = q[k * 3 + 2];
    auto.angolo = auto.direzione = Math.atan2(-(q[k * 3 + 3] - q[k * 3]), -(q[k * 3 + 5] - q[k * 3 + 2]));
    auto.velocita = 0; auto.caduta = 0; auto.nuovaCaduta = false; auto.riparti = false; auto.senzaAsfalto = 0; auto.giroAuto = 0; auto.sterzoDolce = 0; auto.beccheggio = 0; auto.piega = 0;
    const ris = { nome: nome, urti: 0, motivo: "", fuoriStrada: 0, vmax: 0, sbandata: 0, saltoQuota: 0, arrivato: false, secondi: 0 };
    const dt = 1 / 60;
    for (let passo = 0; passo < 60 * 60; passo++) {
      // punto della strada piu' vicino (avanzando) e punto da mirare piu' avanti
      while (k < n - 2 && Math.hypot(q[k * 3 + 3] - auto.x, q[k * 3 + 5] - auto.z) < Math.hypot(q[k * 3] - auto.x, q[k * 3 + 2] - auto.z)) k++;
      if (k >= n - 6) { ris.arrivato = true; break; }
      let avanti = 5 + Math.abs(auto.velocita) * 0.45, j = k;
      while (j < n - 1 && avanti > 0) { avanti -= Math.hypot(q[j * 3 + 3] - q[j * 3], q[j * 3 + 5] - q[j * 3 + 2]); j++; }
      const voluto = Math.atan2(-(q[j * 3] - auto.x), -(q[j * 3 + 2] - auto.z));
      let err = voluto - auto.angolo;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      // il pilota guarda le curve nei prossimi 70 m e frena prima, come farebbe una persona
      let vOk = 70;
      for (let a = k, fatta = 0; a + 2 < n && fatta < 70; a++) {
        const l1 = Math.hypot(q[a * 3 + 3] - q[a * 3], q[a * 3 + 5] - q[a * 3 + 2]), l2 = Math.hypot(q[a * 3 + 6] - q[a * 3 + 3], q[a * 3 + 8] - q[a * 3 + 5]);
        fatta += l1;
        if (l1 < 0.5 || l2 < 0.5) continue;
        let da = Math.atan2(q[a * 3 + 6] - q[a * 3 + 3], q[a * 3 + 8] - q[a * 3 + 5]) - Math.atan2(q[a * 3 + 3] - q[a * 3], q[a * 3 + 5] - q[a * 3 + 2]);
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const raggio = (l1 + l2) / 2 / Math.max(Math.abs(da), 0.001);
        // velocita' in curva (0.6 g) + quanto si riesce ancora a frenare prima di arrivarci
        vOk = Math.min(vOk, Math.sqrt(Math.max(6 * raggio, 16) + 2 * 6 * fatta));
      }
      const tasti = { su: auto.velocita < vOk - 1 && Math.abs(err) < 0.5, giu: auto.velocita > vOk + 1, sinistra: err > 0.04, destra: err < -0.04, frenoDietro: false };
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
