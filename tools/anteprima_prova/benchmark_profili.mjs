// BENCHMARK DEI PROFILI (Bassa / Media / Alta / Ultra) CON LA MOTO CHE VA DAVVERO.
// Va lanciato sul TUO computer con la scheda video vera. Ogni profilo: pagina nuova, caricamento misurato, poi la moto
// (fisica e comandi veri: acceleratore premuto) percorre un tratto dritto di strada, e si registrano i tempi di ogni fotogramma.
// Misure: FPS medi, 1% low (due definizioni), tempi di fotogramma (mediana, p95, p99, massimo), numero di scatti (> 33 ms e > 50 ms),
// tempo di caricamento, memoria JavaScript, RAM del browser (se il sistema la da'), VRAM (solo con nvidia-smi, altrimenti stima),
// chiamate di disegno, triangoli, geometrie e texture.
//
// USO (dalla cartella principale del progetto, dopo "npm install" in anteprima/ e con i dati veri in anteprima/dati):
//   cd anteprima && npm install && cd ..
//   npm --prefix tools/anteprima_prova install playwright        (una volta sola; poi: npx playwright install chromium)
//   node tools/anteprima_prova/benchmark_profili.mjs --gpu --risoluzione 1920x1080 --secondi 40
// Opzioni:
//   --qualita bassa,media,alta,ultra    quali profili (default tutti)
//   --secondi 40                        durata della corsa misurata per profilo
//   --risoluzione 1920x1080             dimensione della finestra
//   --gpu                               usa la scheda video (senza: grafica software, solo per prove: NON sono FPS veri)
//   --canale chrome                     usa il Chrome installato invece di Chromium di Playwright (consigliato su Windows/Mac)
//   --uscita cartella                   dove scrivere benchmark_<data>.json e .md (default docs/anteprima/fase4/misure)
// I risultati dicono SEMPRE su che macchina sono stati misurati. Non vengono inventati numeri: se una misura non e' possibile
// (per esempio la VRAM senza nvidia-smi), il campo resta vuoto con la spiegazione.

import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const argomenti = process.argv.slice(2);
const opz = (nome, difetto) => { const i = argomenti.indexOf("--" + nome); return i >= 0 && argomenti[i + 1] && !argomenti[i + 1].startsWith("--") ? argomenti[i + 1] : (i >= 0 ? true : difetto); };
const profili = String(opz("qualita", "bassa,media,alta,ultra")).split(",");
const secondi = +opz("secondi", 40);
const [larghezza, altezza] = String(opz("risoluzione", "1920x1080")).split("x").map(Number);
const conGpu = opz("gpu", false) === true;
const canale = opz("canale", null);
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const uscita = path.resolve(String(opz("uscita", path.join(import.meta.dirname, "../../docs/anteprima/fase4/misure"))));
fs.mkdirSync(uscita, { recursive: true });

const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg", ".bin": "application/octet-stream" };
const server = http.createServer((q, s) => {
  const f = path.join(radice, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => {
    if (e) { s.writeHead(404); s.end("no"); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d);
  });
}).listen(0);
const porta = server.address().port;

function nvidiaSmi() {
  try {
    const t = execSync("nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader,nounits", { timeout: 5000 }).toString().trim().split("\n")[0].split(",").map((x) => x.trim());
    return { nome: t[0], usataMB: +t[1], totaleMB: +t[2] };
  } catch (e) { return null; }
}
function ramBrowser(pid) {
  // RAM (RSS) del browser e dei suoi processi figli, in MB. Solo Linux/Mac (ps); su Windows resta vuoto
  try {
    if (process.platform === "win32") return null;
    const righe = execSync("ps -A -o pid=,ppid=,rss=", { timeout: 5000 }).toString().trim().split("\n").map((r) => r.trim().split(/\s+/).map(Number));
    const figli = new Set([pid]);
    let cambiato = true;
    while (cambiato) { cambiato = false; for (const [p, pp] of righe) if (figli.has(pp) && !figli.has(p)) { figli.add(p); cambiato = true; } }
    return Math.round(righe.filter((r) => figli.has(r[0])).reduce((a, r) => a + r[2], 0) / 1024);
  } catch (e) { return null; }
}

const argsBrowser = conGpu
  ? ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--enable-zero-copy", "--enable-precise-memory-info", "--disable-frame-rate-limit", "--disable-gpu-vsync"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"];
const browser = await chromium.launch({ headless: !conGpu, channel: canale || undefined, args: argsBrowser });
const pidBrowser = browser.process() ? browser.process().pid : null;

const risultati = [];
for (const qualita of profili) {
  console.log("== " + qualita);
  const vramPrima = nvidiaSmi();
  const p = await browser.newPage({ viewport: { width: larghezza, height: altezza } });
  p.setDefaultTimeout(900000);
  const errori = [];
  p.on("pageerror", (e) => errori.push(e.message));
  await p.addInitScript((q) => { localStorage.setItem("mrw-qualita", q); localStorage.setItem("mrw-meteo", "sereno"); localStorage.setItem("mrw-ora", "15"); }, qualita);
  const t0 = Date.now();
  await p.goto("http://localhost:" + porta + "/index.html");
  await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
  const caricamentoS = (Date.now() - t0) / 1000;
  await p.waitForFunction(() => window.__mrw && window.__mrw.strade && window.__mrw.fotogrammi > 5);

  // tratto dritto piu' lungo (strada di almeno 5 m, non in galleria ne' su ponte) e partenza da li'
  const tratto = await p.evaluate(() => {
    const L = window.__mrw.strade.lista;
    let migliore = null;
    for (const s of L) {
      if (s.g || s.b || s.riemp || s.w < 5) continue;
      const q = s.p, n = q.length / 3;
      let i = 0;
      while (i < n - 1) {
        const ux = q[i * 3 + 3] - q[i * 3], uz = q[i * 3 + 5] - q[i * 3 + 2];
        const l0 = Math.hypot(ux, uz) || 1;
        let j = i + 1, lung = l0;
        while (j < n - 1) {
          const dx = q[j * 3 + 3] - q[j * 3], dz = q[j * 3 + 5] - q[j * 3 + 2];
          const l = Math.hypot(dx, dz) || 1;
          // scarto laterale dal primo tratto
          const lat = Math.abs((q[j * 3 + 3] - q[i * 3]) * (-uz / l0) + (q[j * 3 + 5] - q[i * 3 + 2]) * (ux / l0));
          if (lat > 2.5) break;
          lung += l; j++;
        }
        if (!migliore || lung > migliore.lung) migliore = { x: q[i * 3], z: q[i * 3 + 2], dx: ux / l0, dz: uz / l0, lung: lung, nome: s.n };
        i = Math.max(j, i + 1);
      }
    }
    return migliore;
  });
  console.log("   tratto: " + (tratto.nome || "senza nome") + ", " + Math.round(tratto.lung) + " m");

  const misura = await p.evaluate(async ([t, secondi]) => {
    const m = window.__mrw;
    const metti = () => {
      m.vaiA(t.x + t.dx * 6, t.z + t.dz * 6);
      m.moto.angolo = Math.atan2(-t.dx, -t.dz);
      m.moto.velocita = 0;
    };
    metti();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", key: "ArrowUp" }));
    await new Promise((f) => setTimeout(f, 4000));   // riscaldamento: alberi, erba, terreno e foto si creano a poco a poco
    const tempi = [];
    let precedente = performance.now(), fine = precedente + secondi * 1000, ritorni = 0;
    const f0 = m.fotogrammi;
    await new Promise((finito) => {
      const giro = (ora) => {
        tempi.push(ora - precedente);
        precedente = ora;
        // velocita' di crociera ~80 km/h: si molla l'acceleratore, si rimette l'acceleratore sotto i 70
        const kmh = Math.abs(m.moto.velocita) * 3.6;
        if (kmh > 85) window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp", key: "ArrowUp" }));
        else if (kmh < 70) window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", key: "ArrowUp" }));
        // fine del tratto dritto: si riparte dall'inizio (la moto non esce dalla strada)
        const percorso = (m.moto.x - t.x) * t.dx + (m.moto.z - t.z) * t.dz;
        if (percorso > t.lung - 25 || percorso < -20) { metti(); ritorni++; }
        if (ora >= fine) finito(); else requestAnimationFrame(giro);
      };
      requestAnimationFrame(giro);
    });
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowUp", key: "ArrowUp" }));
    const gl = m.disegnatore.getContext();
    const est = gl.getExtension("WEBGL_debug_renderer_info");
    const scheda = est ? gl.getParameter(est.UNMASKED_RENDERER_WEBGL) : "sconosciuta";
    const i = m.disegnatore.info;
    const mem = performance.memory ? { heapUsatoMB: Math.round(performance.memory.usedJSHeapSize / 1048576), heapTotaleMB: Math.round(performance.memory.totalJSHeapSize / 1048576) } : null;
    return {
      tempi: tempi.slice(2), fotogrammiGioco: m.fotogrammi - f0, ritorniAllInizio: ritorni, scheda: scheda, memoriaJS: mem,
      render: { chiamate: i.render.calls, triangoli: i.render.triangles, geometrie: i.memory.geometries, texture: i.memory.textures, programmi: i.programs ? i.programs.length : 0 },
      erba: m.erba ? { celle: m.erba.statistiche.celle, msCella: +m.erba.statistiche.ms.toFixed(2) } : null,
      pixelRatio: m.disegnatore.getPixelRatio(), moto: { kmh: Math.round(Math.abs(m.moto.velocita) * 3.6) }
    };
  }, [tratto, secondi]);

  const ord = misura.tempi.slice().sort((a, b) => a - b);
  const pct = (q) => ord[Math.min(ord.length - 1, Math.max(0, Math.ceil(q * ord.length) - 1))];
  const media = ord.reduce((a, c) => a + c, 0) / ord.length;
  const peggiori = ord.slice(Math.floor(ord.length * 0.99));
  const mediaPeggiori = peggiori.reduce((a, c) => a + c, 0) / Math.max(1, peggiori.length);
  const software = /swiftshader|llvmpipe|software/i.test(misura.scheda);
  const vramDopo = nvidiaSmi();
  const r = {
    qualita, caricamento_s: +caricamentoS.toFixed(1), scheda_video: misura.scheda, grafica_software: software,
    risoluzione: larghezza + "x" + altezza, pixel_ratio: misura.pixelRatio, secondi_misurati: secondi, fotogrammi: ord.length,
    fps_medi: +(1000 / media).toFixed(1),
    fps_1pc_low_p99: +(1000 / pct(0.99)).toFixed(1),                 // 1000 / tempo del 99% dei fotogrammi
    fps_1pc_low_media_peggiori: +(1000 / mediaPeggiori).toFixed(1),   // media dell'1% di fotogrammi piu' lenti
    tempo_fotogramma_ms: { mediana: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), p99: +pct(0.99).toFixed(1), massimo: +ord[ord.length - 1].toFixed(1) },
    scatti_oltre_33ms: ord.filter((x) => x > 33.4).length, scatti_oltre_50ms: ord.filter((x) => x > 50).length,
    memoria_js: misura.memoriaJS, ram_browser_MB: pidBrowser ? ramBrowser(pidBrowser) : null,
    vram_nvidia_smi_MB: vramDopo && vramPrima ? { prima: vramPrima.usataMB, dopo: vramDopo.usataMB, differenza: vramDopo.usataMB - vramPrima.usataMB, totale: vramDopo.totaleMB } : "non disponibile (serve una scheda NVIDIA con nvidia-smi: altrimenti guarda Gestione attivita' > GPU > memoria dedicata durante la corsa)",
    render: misura.render, erba: misura.erba, ritorni_all_inizio_del_tratto: misura.ritorniAllInizio, errori_console: errori.slice(0, 5)
  };
  risultati.push(r);
  console.log("   " + (software ? "[GRAFICA SOFTWARE, NON FPS VERI] " : "") + r.fps_medi + " fps medi, 1% low " + r.fps_1pc_low_p99 + ", caricamento " + r.caricamento_s + " s");
  await p.close();
}
await browser.close();
server.close();

const macchina = { sistema: os.platform() + " " + os.release(), cpu: os.cpus()[0].model, core: os.cpus().length, ram_GB: Math.round(os.totalmem() / 1073741824), nodo: process.version, data: new Date().toISOString() };
const quando = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
fs.writeFileSync(path.join(uscita, "benchmark_" + quando + ".json"), JSON.stringify({ macchina, risultati }, null, 1));
let md = "# Benchmark profili (moto in corsa)\n\n" + macchina.sistema + ", " + macchina.cpu + ", " + macchina.core + " core, " + macchina.ram_GB + " GB RAM. " + larghezza + "x" + altezza + ", " + secondi + " s per profilo.\n";
if (risultati.some((r) => r.grafica_software)) md += "\n**ATTENZIONE: grafica software (CPU): questi non sono FPS di una scheda video. Valgono solo come confronto tra versioni sulla stessa macchina.**\n";
md += "\n| Profilo | FPS medi | 1% low (p99) | 1% low (media) | ms mediana / p95 / p99 / max | Scatti >33 / >50 ms | Caricamento | Heap JS | RAM browser | Chiamate | Triangoli |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
for (const r of risultati) md += "| " + r.qualita + " | " + r.fps_medi + " | " + r.fps_1pc_low_p99 + " | " + r.fps_1pc_low_media_peggiori + " | " + r.tempo_fotogramma_ms.mediana + " / " + r.tempo_fotogramma_ms.p95 + " / " + r.tempo_fotogramma_ms.p99 + " / " + r.tempo_fotogramma_ms.massimo + " | " + r.scatti_oltre_33ms + " / " + r.scatti_oltre_50ms + " | " + r.caricamento_s + " s | " + (r.memoria_js ? r.memoria_js.heapUsatoMB + " MB" : "-") + " | " + (r.ram_browser_MB ? r.ram_browser_MB + " MB" : "-") + " | " + r.render.chiamate + " | " + (r.render.triangoli / 1e6).toFixed(2) + " M |\n";
md += "\nVRAM: " + (typeof risultati[0].vram_nvidia_smi_MB === "string" ? risultati[0].vram_nvidia_smi_MB : "vedi il file JSON (differenza della VRAM usata prima/dopo ogni profilo, con nvidia-smi)") + "\n";
fs.writeFileSync(path.join(uscita, "benchmark_" + quando + ".md"), md);
console.log("\nFatto. File in " + uscita);
console.log(md);
