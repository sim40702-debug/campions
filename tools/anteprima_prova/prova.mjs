// Prova visiva automatica: avvia l'anteprima in Chromium (senza Electron), parte da un paese,
// fa uno screenshot e riporta gli errori della console.
//   node tools/anteprima_prova/prova.mjs <cartella_screenshot> "<x,z,qualita,ora,telecamera,nome>" ...
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const radice = path.resolve(import.meta.dirname, "../../anteprima");
const uscita = process.argv[2];
fs.mkdirSync(uscita, { recursive: true });
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".bin": "application/octet-stream", ".glb": "model/gltf-binary" };
const server = http.createServer((q, s) => {
  const f = path.join(radice, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => {
    if (e) { s.writeHead(404); s.end("no"); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d);
  });
}).listen(0);
const porta = server.address().port;

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const voce of process.argv.slice(3)) {
  const [x, z, qualita, ora, cam, nome, azione] = voce.split(",");
  const pagina = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errori = [];
  pagina.on("console", (m) => { if (["error", "warning"].includes(m.type())) errori.push(m.type() + ": " + m.text()); });
  pagina.on("pageerror", (e) => errori.push("pageerror: " + e.message));
  await pagina.addInitScript((d) => { window.__dbg = d; }, process.env.DBG || "");
  await pagina.addInitScript((m) => { if (m) { localStorage.setItem("mrw-meteo", m.split(":")[0]); if (m.split(":")[1] === "0") localStorage.setItem("mrw-meteo-realistico", "0"); } }, process.env.METEO || "");
  await pagina.addInitScript(([x, z, q, o]) => {
    localStorage.setItem("mrw-partenza", JSON.stringify({ x: +x, z: +z, nome: "prova" }));
    localStorage.setItem("mrw-qualita", q || "media");
    if (o) localStorage.setItem("mrw-ora", o);
    if (window.__dbg) localStorage.setItem("mrw-debug", window.__dbg);
  }, [x, z, qualita, ora]);
  const t0 = Date.now();
  await pagina.goto("http://localhost:" + porta + "/index.html");
  try {
    await pagina.waitForFunction(() => document.getElementById("caricamento").style.display === "none", null, { timeout: 240000 });
  } catch (e) { errori.push("TIMEOUT caricamento: " + (await pagina.textContent("#stato"))); }
  const tCarica = Date.now() - t0;
  for (let i = 0; i < +(cam || 0); i++) await pagina.keyboard.press("KeyC");
  if (azione) { for (const a of azione.split("+")) { if (a.startsWith("scrivi:")) await pagina.keyboard.type(a.slice(7)); else if (a.startsWith("clic:")) await pagina.click(a.slice(5), { timeout: 120000 }); else await pagina.keyboard.press(a); await pagina.waitForTimeout(500); } }
  // aspetto che la telecamera arrivi dietro la moto (alcuni fotogrammi: con la grafica software sono lenti)
  try { await pagina.waitForFunction(() => window.__mrw.fotogrammi > 14, null, { timeout: 200000 }); } catch (e) { errori.push('pochi fotogrammi'); }
  const file = path.join(uscita, (nome || "shot") + ".png");
  await pagina.screenshot({ path: file, timeout: 240000 });
  const fps = await pagina.evaluate(() => { const i = window.__mrw.disegnatore.info; return JSON.stringify({ chiamate: i.render.calls, triangoli: i.render.triangles, geometrie: i.memory.geometries, texture: i.memory.textures, programmi: i.programs.length }); });
  if (process.env.DOM) console.log("DOM", await pagina.evaluate(() => JSON.stringify({ mappa: document.getElementById('mappaGrande').style.display, risultati: document.getElementById('risultatiMappa').innerHTML.slice(0, 300), focus: document.activeElement && document.activeElement.id, val: document.getElementById('cercaMappa').value })));
  if (process.env.STATS) {
    const righe = await pagina.evaluate(() => {
      const ris = [];
      window.__mrw.scena.traverse((o) => {
        if (!o.isMesh && !o.isPoints) return;
        let v = o.visible; let p = o.parent; while (p && v) { v = v && p.visible; p = p.parent; }
        if (!v) return;
        const g = o.geometry; const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
        const tris = (o.isInstancedMesh ? o.count : 1) * n / 3;
        ris.push({ t: o.isInstancedMesh ? "inst" + o.count : (o.isPoints ? "punti" : "mesh"), tris: Math.round(tris), mat: o.material.type + (o.material.map ? "+map" : "") });
      });
      ris.sort((a, b) => b.tris - a.tris);
      const tot = ris.reduce((s, r) => s + r.tris, 0);
      return { totale: tot, oggetti: ris.length, top: ris.slice(0, 14) };
    });
    console.log(JSON.stringify(righe));
  }
  console.log(nome, "caricato in", Math.round(tCarica / 1000), "s", "errori:", JSON.stringify(errori.slice(0, 8)), fps);
  await pagina.close();
}
await browser.close(); server.close();
