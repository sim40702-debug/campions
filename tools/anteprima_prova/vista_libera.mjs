// Screenshot con telecamera libera: per ogni voce "x,z,altezza,distanza,angoloGradi,nome" guarda il punto (x, z)
// da "distanza" metri e "altezza" metri sopra la strada. Serve per controllare incroci e strade da vicino.
//   node tools/anteprima_prova/vista_libera.mjs <cartella> "x,z,alt,dist,ang,nome" ...
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const uscita = process.argv[2]; fs.mkdirSync(uscita, { recursive: true });
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } });
p.setDefaultTimeout(400000);
p.on("pageerror", (e) => console.log("pageerror: " + e.message));
await p.addInitScript(() => { localStorage.setItem("mrw-qualita", "media"); });
await p.goto("http://localhost:" + server.address().port + "/index.html");
await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 3);
for (const voce of process.argv.slice(3)) {
  const [x, z, alt, dist, ang, nome] = voce.split(",");
  await p.evaluate(([x, z]) => { window.__mrw.vaiA(+x, +z); window.__mrw.moto.velocita = 0; }, [x, z]);
  const f0 = await p.evaluate(() => window.__mrw.fotogrammi);
  await p.waitForFunction((f) => window.__mrw.fotogrammi > f + 12, f0);
  // aspetto le foto aeree vicine (si caricano a poco a poco): senza, il terreno e' ancora fatto di soli colori calcolati
  try { await p.waitForFunction(() => { const t = window.__mrw.terrenoMesh; return !t || t.pezzi === undefined || t.fotoCaricate >= 1; }, null, { timeout: 120000 }); } catch (e) { console.log('foto non caricate'); }
  try { await p.waitForFunction(() => { const u = window.__mrw.fotoHD; return !u || u.uHDok.value.x + u.uHDok.value.y + u.uHDok.value.z + u.uHDok.value.w >= 1; }, null, { timeout: 90000 }); } catch (e) { console.log('foto HD non caricate'); }
  { const f1 = await p.evaluate(() => window.__mrw.fotogrammi); await p.waitForFunction((f) => window.__mrw.fotogrammi > f + 6, f1); }
  if (process.env.HD_OFF) await p.evaluate(() => { window.__mrw.fotoHD.uHDraggio.value = 0; });
  const dati = await p.evaluate(async ([x, z, alt, dist, ang]) => {
    const THREE = await import("three");
    const m = window.__mrw;
    const y = m.moto.y;
    x = m.moto.x; z = m.moto.z;   // il punto di strada piu' vicino a quello chiesto
    const cam = new THREE.PerspectiveCamera(60, 800 / 450, 0.3, 6000);
    const a = +ang * Math.PI / 180;
    cam.position.set(+x + Math.sin(a) * +dist, y + +alt, +z + Math.cos(a) * +dist);
    cam.lookAt(+x, y, +z);
    m.moto.modello.visible = false;
    m.disegnatore.render(m.scena, cam);
    const url = m.disegnatore.domElement.toDataURL("image/png");
    m.moto.modello.visible = true;
    return url;
  }, [x, z, alt, dist, ang]);
  fs.writeFileSync(path.join(uscita, nome + ".png"), Buffer.from(dati.split(",")[1], "base64"));
  console.log("fatto " + nome);
}
await b.close(); server.close();
