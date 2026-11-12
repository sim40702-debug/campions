// Prova del LOD lontano (src/lontano.js) sui dati veri di una regione: chiamate di disegno, triangoli, memoria e immagini
// con il LOD acceso e spento, dallo stesso punto, per ogni profilo.
//   node tools/anteprima_prova/prova_lontano.mjs <cartella app con dati> <uscita> [x,z]
// <cartella app con dati>: copia di anteprima/ con "dati" = regione (per esempio Lugano). Grafica software: contano chiamate,
// triangoli e memoria, NON gli FPS.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [radice, uscita, punto] = process.argv.slice(2);
fs.mkdirSync(uscita, { recursive: true });
const [px, pz] = (punto || "-1000,-5000").split(",").map(Number);
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".bin": "application/octet-stream" };
const server = http.createServer((q, s) => {
  const f = path.join(path.resolve(radice), decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => {
    if (e) { s.writeHead(404); s.end("no"); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d);
  });
}).listen(0);
const risultati = [];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
for (const profilo of (process.env.PROFILI || "bassa,media,alta,ultra").split(",")) {
  const p = await browser.newPage({ viewport: { width: 800, height: 450 } });
  p.setDefaultTimeout(600000);
  const errori = [];
  p.on("pageerror", (e) => errori.push(e.message));
  await p.addInitScript((q) => { localStorage.setItem("mrw-qualita", q); localStorage.setItem("mrw-meteo", "sereno"); }, profilo);
  await p.goto("http://localhost:" + server.address().port + "/index.html");
  await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
  await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 3);
  await p.evaluate(([x, z]) => { window.__mrw.vaiA(x, z); window.__mrw.moto.velocita = 0; }, [px, pz]);
  const f0 = await p.evaluate(() => window.__mrw.fotogrammi);
  await p.waitForFunction((f) => window.__mrw.fotogrammi > f + 40, f0, { timeout: 900000 });   // il terreno si costruisce a poco a poco: si aspetta che sia pronto, cosi' spento e acceso sono confrontabili
  const misura = async (acceso) => p.evaluate(async (acceso) => {
    const THREE = await import("three");
    const m = window.__mrw;
    const l = m.lontano;
    const q = JSON.parse(JSON.stringify({ visibilita: m.ambiente.visibilita }));
    l.attivo = acceso;
    l.ultimoX = 1e9; l.attesa = 0;
    if (!acceso) { if (l.mesh) { l.mesh.visible = false; l.mesh.count = 0; } if (l.linee) l.linee.visible = false; }
    // un paio di fotogrammi perche' il LOD si aggiorni
    await new Promise((r) => { const f = m.fotogrammi; const t = setInterval(() => { if (m.fotogrammi > f + 2) { clearInterval(t); r(); } }, 200); });
    const cam = new THREE.PerspectiveCamera(60, 800 / 450, 1, q.visibilita + 2000);
    cam.position.set(m.moto.x, m.moto.y + 60, m.moto.z);
    cam.lookAt(m.moto.x + 2500 * 0.7, m.moto.y - 40, m.moto.z + 2500 * 0.7);   // verso sud-est: la citta'
    m.moto.modello.visible = false;
    m.disegnatore.info.reset();
    m.disegnatore.render(m.scena, cam);
    const info = { chiamate: m.disegnatore.info.render.calls, triangoli: m.disegnatore.info.render.triangles };
    const url = m.disegnatore.domElement.toDataURL("image/png");
    m.moto.modello.visible = true;
    return { info, url, sagome: l.visibili, celle: l.stat.celle, vertici: l.stat.vertici, linee: l.linee ? l.linee.visible : false,
      memoriaJS: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
      geometrie: m.disegnatore.info.memory.geometries, texture: m.disegnatore.info.memory.textures };
  }, acceso);
  await misura(false);                 // riscaldamento (il terreno lontano si completa)
  const spento = await misura(false);
  const acceso = await misura(true);
  // vista dall'alto (solo diagnostica): dove stanno le sagome rispetto agli edifici veri e al terreno
  const alto = await p.evaluate(async () => {
    const THREE = await import("three");
    const m = window.__mrw;
    const cam = new THREE.PerspectiveCamera(50, 800 / 450, 10, 40000);
    cam.position.set(m.moto.x, m.moto.y + 9000, m.moto.z + 4000);
    cam.lookAt(m.moto.x, m.moto.y, m.moto.z - 1000);
    const nebbiaFar = m.scena.fog.far;
    m.scena.fog.far = 60000; m.scena.fog.near = 50000;
    m.moto.modello.visible = false;
    m.disegnatore.render(m.scena, cam);
    const url = m.disegnatore.domElement.toDataURL("image/png");
    m.scena.fog.far = nebbiaFar; m.scena.fog.near = nebbiaFar * 0.18;
    m.moto.modello.visible = true;
    return url;
  });
  fs.writeFileSync(path.join(uscita, "lontano_" + profilo + "_dall_alto.png"), Buffer.from(alto.split(",")[1], "base64"));
  fs.writeFileSync(path.join(uscita, "lontano_" + profilo + "_spento.png"), Buffer.from(spento.url.split(",")[1], "base64"));
  fs.writeFileSync(path.join(uscita, "lontano_" + profilo + "_acceso.png"), Buffer.from(acceso.url.split(",")[1], "base64"));
  const r = {
    profilo, celleTotali: acceso.celle, sagomeVisibili: acceso.sagome, verticiStrade: acceso.vertici,
    chiamate: [spento.info.chiamate, acceso.info.chiamate], triangoli: [spento.info.triangoli, acceso.info.triangoli],
    geometrie: [spento.geometrie, acceso.geometrie], texture: [spento.texture, acceso.texture], memoriaJS_MB: [spento.memoriaJS, acceso.memoriaJS], errori
  };
  risultati.push(r);
  console.log(JSON.stringify(r));
  await p.close();
}
fs.writeFileSync(path.join(uscita, "esiti_lontano.json"), JSON.stringify(risultati, null, 2));
await browser.close();
server.close();
