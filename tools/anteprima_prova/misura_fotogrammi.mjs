// Misura la fluidita' del gioco vero: tempo medio per fotogramma, chiamate di disegno, triangoli e memoria delle texture.
//   node tools/anteprima_prova/misura_fotogrammi.mjs <cartella_anteprima> <qualita> "x,z,ora,nome" ...
// ATTENZIONE: con la grafica software (SwiftShader) i millisecondi NON sono quelli di una scheda video vera: servono solo
// per confrontare due versioni (stessa macchina, stessa scena). Triangoli, chiamate e memoria invece sono validi ovunque.
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(process.argv[2]);
const qualita = process.argv[3];
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg" };
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end("no"); return; } s.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const centro = JSON.parse(fs.readFileSync(path.join(radice, "dati/terreno.json"), "utf8")).centro_lv95;
const risultati = [];
for (const voce of process.argv.slice(4)) {
  const [x, z, ora, nome] = voce.split(",");
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  p.setDefaultTimeout(600000);
  await p.addInitScript(([x, z, q, o, c]) => { localStorage.setItem("mrw-partenza", JSON.stringify({ x: +x, z: +z, nome: "m", est: c[0] + +x, nord: c[1] - +z })); localStorage.setItem("mrw-qualita", q); localStorage.setItem("mrw-ora", o); localStorage.setItem("mrw-meteo", "sereno"); }, [x, z, qualita, ora, centro]);
  await p.goto("http://localhost:" + server.address().port + "/index.html");
  await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
  await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 10);
  try { await p.waitForFunction(() => { const t = window.__mrw.terrenoMesh; return !t || t.fotoCaricate >= 1; }, null, { timeout: 60000 }); } catch (e) {}
  try { await p.waitForFunction(() => { const u = window.__mrw.fotoHD; return !u || u.uHDok.value.x + u.uHDok.value.y + u.uHDok.value.z + u.uHDok.value.w >= 1; }, null, { timeout: 60000 }); } catch (e) {}
  await p.waitForTimeout(process.env.SHOT ? +(process.env.ATTESA || 20000) : 3000);
  if (process.env.SHOT) { fs.mkdirSync(process.env.SHOT, { recursive: true }); await p.screenshot({ path: path.join(process.env.SHOT, nome + ".png"), timeout: 240000 }); }
  const r = await p.evaluate(async () => {
    const m = window.__mrw;
    const f0 = m.fotogrammi, t0 = performance.now();
    await new Promise((fine) => { const v = () => { if (m.fotogrammi >= f0 + 40) fine(); else setTimeout(v, 50); }; v(); });
    const ms = (performance.now() - t0) / (m.fotogrammi - f0);
    const i = m.disegnatore.info;
    // memoria delle texture (stima: larghezza x altezza x 4 byte, +33% con le mipmap), solo quelle caricate sulla scheda video
    const viste = new Set(); let byte = 0;
    m.scena.traverse((o) => { const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const mt of mats) for (const k of ["map", "normalMap", "roughnessMap", "emissiveMap", "alphaMap"]) { const t = mt[k]; if (t && !viste.has(t) && t.image && t.image.width) { viste.add(t); byte += t.image.width * t.image.height * 4 * (t.generateMipmaps !== false ? 1.33 : 1); } } });
    const tm = m.tempi;
    const js = tm && tm.js.length ? tm.js.slice(-40).reduce((a, c) => a + c, 0) / Math.min(40, tm.js.length) : 0;
    return { ms_fotogramma: +ms.toFixed(0), ms_cpu_js: +js.toFixed(1), chiamate: i.render.calls, triangoli: i.render.triangles, geometrie: i.memory.geometries, texture: i.memory.textures, programmi: i.programs ? i.programs.length : 0, texture_MB: +(byte / 1048576).toFixed(0) };
  });
  risultati.push({ nome, ...r });
  console.log(nome, JSON.stringify(r));
  await p.close();
}
await b.close(); server.close();
