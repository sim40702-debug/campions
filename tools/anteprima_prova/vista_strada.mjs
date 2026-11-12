// Screenshot "dalla sella": per ogni voce "x,z,altezza,distanza,nome,verso" mette la telecamera sopra la strada
// piu' vicina a (x, z), "distanza" metri indietro lungo la strada e "altezza" metri sopra l'asfalto, e guarda avanti.
// "verso" = 1 (come nei dati) oppure -1 (al contrario). Carica il gioco una volta sola: serve per controllare
// tanti punti di una valle (muri, parapetti, case ai bordi) senza ripartire ogni volta.
//   node tools/anteprima_prova/vista_strada.mjs <cartella> "x,z,alt,dist,nome,verso" ...
// Variabili: QUALITA (bassa, media, alta), LARGO e ALTO (pixel dell'immagine)
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const uscita = process.argv[2]; fs.mkdirSync(uscita, { recursive: true });
const LARGO = +(process.env.LARGO || 800), ALTO = +(process.env.ALTO || 450);
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: LARGO, height: ALTO } });
p.setDefaultTimeout(600000);
p.on("pageerror", (e) => console.log("pageerror: " + e.message));
await p.addInitScript((q) => { localStorage.setItem("mrw-qualita", q); }, process.env.QUALITA || "media");
await p.goto("http://localhost:" + server.address().port + "/index.html");
await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
await p.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 3);
for (const voce of process.argv.slice(3)) {
  const [x, z, alt, dist, nome, verso] = voce.split(",");
  await p.evaluate(([x, z]) => { window.__mrw.vaiA(+x, +z); window.__mrw.moto.velocita = 0; }, [x, z]);
  const f0 = await p.evaluate(() => window.__mrw.fotogrammi);
  await p.waitForFunction((f) => window.__mrw.fotogrammi > f + 10, f0);
  const dati = await p.evaluate(async ([alt, dist, verso, largo, alto]) => {
    const THREE = await import("three");
    const m = window.__mrw;
    const x = m.moto.x, y = m.moto.y, z = m.moto.z;
    // direzione della strada sotto la moto: il pezzo piu' vicino
    let migliore = Infinity, dx = 0, dz = 1;
    for (const s of m.strade.lista) {
      const q = s.p;
      for (let i = 0; i + 5 < q.length; i += 3) {
        const d = Math.hypot(q[i] - x, q[i + 2] - z);
        if (d < migliore) { migliore = d; dx = q[i + 3] - q[i]; dz = q[i + 5] - q[i + 2]; }
      }
    }
    const l = (Math.hypot(dx, dz) || 1) * (+verso === -1 ? -1 : 1);
    dx /= l; dz /= l;
    const cam = new THREE.PerspectiveCamera(62, largo / alto, 0.3, 9000);
    cam.position.set(x - dx * +dist, y + +alt, z - dz * +dist);
    cam.lookAt(x + dx * 14, y + 1.0, z + dz * 14);
    m.moto.modello.visible = false;
    m.disegnatore.render(m.scena, cam);
    const url = m.disegnatore.domElement.toDataURL("image/png");
    m.moto.modello.visible = true;
    return url;
  }, [alt, dist, verso || 1, LARGO, ALTO]);
  fs.writeFileSync(path.join(uscita, nome + ".png"), Buffer.from(dati.split(",")[1], "base64"));
  console.log("fatto " + nome);
}
await b.close(); server.close();
