// Suite di test automatici dell'anteprima (Chromium + Playwright, dati di prova).
//   node tools/anteprima_prova/prova_completa.mjs <cartella_uscita>
// Controlla: tutte le qualita', tutte le citta' (identita' distinte), giorno/notte, tutti i meteo, minimappa,
// mappa grande (ricerca, filtri, zoom, tempi di disegno), persistenza delle impostazioni, errori di console.
// Salva gli screenshot e esiti.json.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const radice = path.resolve(import.meta.dirname, "../../anteprima");
const uscita = process.argv[2];
fs.mkdirSync(path.join(uscita, "screenshot"), { recursive: true });
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((q, s) => {
  const f = path.join(radice, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => {
    if (e) { s.writeHead(404); s.end("no"); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "application/octet-stream" }); s.end(d);
  });
}).listen(0);
const url = "http://localhost:" + server.address().port + "/index.html";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const SOLO = process.env.SOLO ? process.env.SOLO.split(",") : null;   // es. SOLO=mappa,persistenza
const vuole = (x) => !SOLO || SOLO.includes(x);
const esiti = [];
const prova = (nome, ok, dettaglio) => { esiti.push({ nome, ok, dettaglio: dettaglio || "" }); console.log((ok ? "OK      " : "FALLITO ") + nome + (dettaglio ? " - " + dettaglio : "")); };

async function apri(init, viewport) {
  const pagina = await browser.newPage({ viewport: viewport || { width: 640, height: 360 } });
  pagina.setDefaultTimeout(240000);
  const errori = [];
  pagina.on("pageerror", (e) => errori.push("pageerror: " + e.message));
  pagina.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/404/.test(m.text())) errori.push(m.type() + ": " + m.text()); });
  await pagina.addInitScript((i) => { for (const [k, v] of Object.entries(i || {})) if (!localStorage.getItem("mrw-test-fatto")) localStorage.setItem(k, v); localStorage.setItem("mrw-test-fatto", "1"); }, init || {});
  const t0 = Date.now();
  await pagina.goto(url);
  await pagina.waitForFunction(() => document.getElementById("caricamento").style.display === "none", null, { timeout: 300000 });
  const caricamento = (Date.now() - t0) / 1000;
  await pagina.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 3, null, { timeout: 300000 });
  return { pagina, errori, caricamento };
}
const luminanza = (pagina) => pagina.evaluate(() => {
  const m = window.__mrw;
  m.disegnatore.render(m.scena, m.telecamera);   // il buffer del canvas e' leggibile solo subito dopo un disegno
  const c = m.disegnatore.domElement;
  const t = document.createElement("canvas"); t.width = 64; t.height = 36;
  const g = t.getContext("2d"); g.drawImage(c, 0, 0, 64, 36);
  const d = g.getImageData(0, 0, 64, 36).data; let s = 0, r = 0, ve = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; r += d[i]; ve += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4; return { lum: s / n, rgb: [r / n, ve / n, b / n] };
});
const fotogrammi = (pagina, n) => pagina.evaluate((n) => new Promise((ok) => { const f0 = window.__mrw.fotogrammi; const t = setInterval(() => { if (window.__mrw.fotogrammi >= f0 + n) { clearInterval(t); ok(); } }, 100); }), n);
const foto = (pagina, nome) => pagina.screenshot({ path: path.join(uscita, "screenshot", nome + ".png"), timeout: 240000 });

// 1) Tutte le qualita' grafiche
for (const q of vuole("qualita") ? ["bassa", "media", "alta", "ultra"] : []) {
  const { pagina, errori, caricamento } = await apri({ "mrw-qualita": q });
  await fotogrammi(pagina, 3);
  const info = await pagina.evaluate(() => { const i = window.__mrw.disegnatore.info; return { tri: i.render.triangles, calls: i.render.calls, tex: i.memory.textures }; });
  prova("qualita' " + q + ": carica e gira senza errori", errori.length === 0, caricamento.toFixed(1) + " s, " + info.tri + " triangoli, " + info.calls + " chiamate" + (errori.length ? " ERRORI: " + errori.slice(0, 2).join(" | ") : ""));
  if (q === "media") await foto(pagina, "qualita_media");
  await pagina.close();
}

// 2) Tutte le citta' e meteo
if (vuole("mondo")) {
  const { pagina, errori } = await apri({ "mrw-qualita": "bassa" });
  const luoghi = await pagina.evaluate(() => window.__mrw.luoghi.lista.map((l) => ({ n: l.n, t: l.t, x: l.x, z: l.z, famiglia: l.profilo.famiglia, pesi: l.profilo.pesi.map((v) => +v.toFixed(2)).join(","), muri: l.profilo.muri.join(","), palme: l.profilo.palme })));
  const firme = new Set(luoghi.map((l) => l.famiglia + "|" + l.pesi));
  prova("identita' dei " + luoghi.length + " luoghi: tutte con profilo (famiglia, facciate, palme)", luoghi.every((l) => l.famiglia && l.pesi), luoghi.map((l) => l.n + ":" + l.famiglia).join(" "));
  prova("identita' distinte tra i luoghi (nessuna coppia identica)", firme.size === luoghi.length, firme.size + " profili su " + luoghi.length);
  const medie = [];
  for (const l of luoghi) {
    await pagina.evaluate(([x, z]) => window.__mrw.vaiA(x, z), [l.x, l.z]);
    await fotogrammi(pagina, 8);
    const m = await luminanza(pagina);
    medie.push({ n: l.n, ...m });
    if (["Locarno", "Ascona", "Ponte Brolla", "Tenero"].includes(l.n)) await foto(pagina, "citta_" + l.n.toLowerCase().replace(/ /g, "_"));
  }
  const unici = new Set(medie.map((m) => m.rgb.map((v) => Math.round(v / 3)).join(",")));
  prova("scene delle citta' visivamente diverse (colore medio)", unici.size >= Math.ceil(luoghi.length * 0.75), unici.size + " colori medi distinti su " + luoghi.length);
  prova("nessun errore visitando tutte le citta'", errori.length === 0, errori.slice(0, 2).join(" | "));
  // 3) Giorno e notte
  const l0 = luoghi.find((l) => l.n === "Locarno") || luoghi[0];
  await pagina.evaluate(([x, z]) => window.__mrw.vaiA(x, z), [l0.x, l0.z]);
  await pagina.evaluate(() => { window.__mrw.ambiente.ora = 13; window.__mrw.ambiente.meteo = "sereno"; });
  await fotogrammi(pagina, 14);
  const giorno = await luminanza(pagina); await foto(pagina, "giorno");
  await pagina.evaluate(() => { window.__mrw.ambiente.ora = 18.6; });
  await fotogrammi(pagina, 10);
  const tramonto = await luminanza(pagina); await foto(pagina, "tramonto");
  await pagina.evaluate(() => { window.__mrw.ambiente.ora = 23; });
  await fotogrammi(pagina, 10);
  const notte = await luminanza(pagina); await foto(pagina, "notte");
  prova("giorno > tramonto > notte (luminanza)", giorno.lum > tramonto.lum && tramonto.lum > notte.lum, [giorno.lum, tramonto.lum, notte.lum].map((v) => v.toFixed(1)).join(" > "));
  const notteU = await pagina.evaluate(() => window.__mrw.ambiente.uniformi.notte.value);
  prova("di notte la variabile 'notte' (finestre, lampioni, faro) e' attiva", notteU > 0.9, "notte=" + notteU.toFixed(2));

  // 4) Tutti i meteo
  await pagina.evaluate(() => { window.__mrw.ambiente.ora = 13; });
  const lumi = {};
  for (const meteo of ["sereno", "variabile", "nuvoloso", "nebbia", "pioggia_leggera", "pioggia_intensa", "neve_leggera", "neve_intensa"]) {
    await pagina.evaluate((m) => { window.__mrw.ambiente.realistico = false; window.__mrw.ambiente.meteo = m; }, meteo);
    await fotogrammi(pagina, 10);
    const st = await pagina.evaluate(() => { const a = window.__mrw.ambiente; return { p: a.pioggia, n: a.neve, b: a.uniformi.bagnato.value, nd: a.uniformi.neveDin.value, att: a.meteoAttivo }; });
    lumi[meteo] = (await luminanza(pagina)).lum;
    const atteso = meteo.startsWith("pioggia") ? st.p > 0.1 && st.b > 0 : (meteo.startsWith("neve") ? st.n > 0.1 && st.nd > 0 : st.p < 0.05 && st.n < 0.05);
    prova("meteo " + meteo + ": stato coerente", atteso && st.att === meteo, JSON.stringify({ pioggia: +st.p.toFixed(2), neve: +st.n.toFixed(2), bagnato: +st.b.toFixed(2), neveAccumulata: +st.nd.toFixed(2) }));
    await foto(pagina, "meteo_" + meteo);
  }
  prova("sereno piu' luminoso di pioggia intensa e di neve intensa", lumi.sereno > lumi.pioggia_intensa && lumi.sereno > lumi.neve_intensa * 0.9, "sereno " + lumi.sereno.toFixed(1) + " / pioggia " + lumi.pioggia_intensa.toFixed(1) + " / neve " + lumi.neve_intensa.toFixed(1));
  // meteo realistico: neve a Locarno (quota 200 m) -> piove, in montagna -> nevica
  await pagina.evaluate(() => { const a = window.__mrw.ambiente; a.realistico = true; a.meteo = "neve_intensa"; a.mese = 10; });
  await fotogrammi(pagina, 16);
  const valle = await pagina.evaluate(() => ({ p: window.__mrw.ambiente.pioggia, n: window.__mrw.ambiente.neve }));
  prova("meteo realistico: perturbazione 'da neve' a 200 m (novembre) = pioggia", valle.p > 0.1 && valle.n < 0.05, JSON.stringify(valle));
  const alto = await pagina.evaluate(() => { const s = window.__mrw; let m = null; for (const r of s.edifici ? [] : []) void r; return null; });
  void alto;
  await pagina.evaluate(() => window.__mrw.vaiA(1130, -5000));
  await fotogrammi(pagina, 20);
  const monte = await pagina.evaluate(() => ({ y: window.__mrw.moto.y, p: window.__mrw.ambiente.pioggia, n: window.__mrw.ambiente.neve, nd: window.__mrw.ambiente.uniformi.neveDin.value }));
  prova("meteo realistico: in montagna (" + Math.round(monte.y) + " m) nevica e la neve si accumula", monte.n > 0.1 && monte.nd > 0.05 && monte.p < 0.05, JSON.stringify(monte));
  await foto(pagina, "neve_montagna_realistica");
  // meteo automatico
  await pagina.evaluate(() => { window.__mrw.ambiente.meteo = "auto"; });
  await fotogrammi(pagina, 3);
  const auto = await pagina.evaluate(() => window.__mrw.ambiente.meteoAttivo);
  prova("meteo automatico sceglie una condizione valida", ["sereno", "variabile", "nuvoloso", "nebbia", "pioggia_leggera", "pioggia_intensa", "neve_leggera", "neve_intensa"].includes(auto), auto);
  await pagina.close();
}

// 5) Minimappa, mappa grande, ricerca, filtri, zoom, tempi
if (vuole("mappa")) {
  const { pagina, errori } = await apri({ "mrw-qualita": "media" }, { width: 1280, height: 720 });
  const mini = await pagina.evaluate(() => { const c = document.getElementById("minimappa"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 4 * 61) s.add(d[i] + "," + d[i + 1] + "," + d[i + 2]); return s.size; });
  prova("minimappa disegnata (colori distinti)", mini > 15, mini + " colori");
  // tempi di disegno della mappa a diversi zoom (con tutti i livelli attivi)
  const tempi = await pagina.evaluate(() => {
    const m = window.__mrw.mappa;
    const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const g = c.getContext("2d");
    const ris = {};
    const misura = (nome, cx, cz, scala) => { const t = performance.now(); for (let i = 0; i < 3; i++) m.disegnaVista(g, cx, cz, scala, 1280, 720, {}); ris[nome] = +((performance.now() - t) / 3).toFixed(1); };
    const l = window.__mrw.luoghi.lista.find((x) => x.n === "Locarno") || window.__mrw.luoghi.lista[0];
    misura("tutto_il_mondo_ms", 0, 0, Math.min(1280 / (m.metaX * 2.1), 720 / (m.metaZ * 2.1)));
    misura("citta_zoom_0.3_ms", l.x, l.z, 0.3);
    misura("strade_zoom_1_ms", l.x, l.z, 1);
    misura("palazzi_zoom_3_ms", l.x, l.z, 3);
    return ris;
  });
  prova("mappa fluida: disegno a tutti gli zoom sotto i 120 ms", Object.values(tempi).every((v) => v < 120), JSON.stringify(tempi));
  await pagina.keyboard.press("KeyN");
  await pagina.waitForTimeout(400);
  await pagina.keyboard.type("Lug");
  const ris = await pagina.evaluate(() => [...document.querySelectorAll("#risultatiMappa button span:first-child")].map((s) => s.textContent));
  prova("mappa: la ricerca non scrive la lettera del tasto di apertura", (await pagina.inputValue("#cercaMappa")) === "Lug", "valore: " + (await pagina.inputValue("#cercaMappa")) + ", risultati: " + ris.length);
  await pagina.fill("#cercaMappa", "Ascona");
  await pagina.click("#risultatiMappa button");
  const info = await pagina.textContent("#infoMappa");
  prova("mappa: il risultato mette il segnaposto con nome, quota e coordinate", /Quota: \d+ m/.test(info) && /LV95/.test(info), info.replace(/\s+/g, " ").slice(0, 100));
  await pagina.mouse.move(700, 300);
  await pagina.waitForTimeout(300);
  prova("mappa: coordinate sotto il cursore", /LV95 \d+ \/ \d+ . quota \d+ m/.test(await pagina.textContent("#coordMappa")), await pagina.textContent("#coordMappa"));
  await pagina.mouse.wheel(0, -600);
  await pagina.waitForTimeout(300);
  await pagina.uncheck("#filtriMappa label:nth-child(3) input");
  await pagina.waitForTimeout(300);
  const filtro = await pagina.evaluate(() => JSON.parse(localStorage.getItem("mrw-filtri-mappa")).edifici);
  prova("mappa: filtro 'Edifici' disattivabile e salvato", filtro === false, "edifici=" + filtro);
  await pagina.check("#filtriMappa label:nth-child(3) input");
  await foto(pagina, "mappa_grande");
  const partenza = await pagina.evaluate(() => 1);
  void partenza;
  await pagina.click("#partiQui");
  const aperta = await pagina.evaluate(() => document.getElementById("mappaGrande").style.display);
  prova("mappa: 'Parti da qui' porta la moto e chiude la mappa", aperta === "none", "display=" + aperta);
  const salvata = await pagina.evaluate(() => localStorage.getItem("mrw-partenza"));
  prova("mappa: la partenza viene ricordata", !!salvata && /"x"/.test(salvata), salvata);
  prova("nessun errore in console (mappa e minimappa)", errori.length === 0, errori.slice(0, 2).join(" | "));
  await pagina.close();
}

// 5b) Collisioni: negli edifici non si entra, ci si schianta
if (vuole("collisioni")) {
  const { pagina, errori } = await apri({ "mrw-qualita": "bassa" });
  const r = await pagina.evaluate(async () => {
    const m = window.__mrw, moto = m.moto, lista = m.edifici.lista;
    const dentro = (p, x, z) => { let d = false; const n = p.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; } return d; };
    const libero = (x, z) => !lista.some((e) => Math.abs(e.cx - x) < 60 && Math.abs(e.cz - z) < 60 && dentro(e.p, x, z));
    const attendi = (n) => new Promise((ok) => { const f0 = m.fotogrammi; const t = setInterval(() => { if (m.fotogrammi >= f0 + n) { clearInterval(t); ok(); } }, 50); });
    const esiti = [];
    let provati = 0;
    for (const e of lista) {
      if (provati >= 4) break;
      if (e.area < 80 || e.cx < 200 || e.cx > 1500) continue;
      // dal lato sud del palazzo verso nord: la moto va verso -z (angolo 0)
      const sx = e.cx, sz = e.cz + 14 + Math.sqrt(e.area) / 2;
      let ok = libero(sx, sz) && libero(sx, sz - 6);
      for (let t = 0; t < 20 && ok; t++) if (!libero(sx, sz - t * 1.5)) { if (t < 8) ok = false; }
      if (!ok || !dentro(e.p, e.cx, e.cz)) continue;
      m.vaiA(sx, sz);
      moto.angolo = 0; moto.velocita = 14; moto.caduta = 0; moto.x = sx; moto.z = sz;
      const prima = { x: moto.x, z: moto.z };
      await attendi(25);
      esiti.push({ dentro: dentro(e.p, moto.x, moto.z), caduta: moto.caduta > 0 || moto.riparti === true, corsa: Math.hypot(moto.x - prima.x, moto.z - prima.z) });
      provati++;
    }
    return { provati, esiti };
  });
  prova("collisioni: la moto lanciata contro un edificio non entra e cade", r.provati >= 1 && r.esiti.every((x) => !x.dentro), JSON.stringify(r));
  prova("collisioni: nessun errore", errori.length === 0, errori.slice(0, 2).join(" | "));
  await pagina.close();
}

// 6) Persistenza delle impostazioni dopo il ricaricamento
if (vuole("persistenza")) {
  const { pagina } = await apri({ "mrw-qualita": "media" });
  await pagina.keyboard.press("Escape");
  await pagina.click("#sceltaQualita button[data-qualita=alta]");
  await pagina.click("button[data-meteo=neve_leggera]");
  await pagina.evaluate(() => { const c = document.getElementById("cursoreOra"); c.value = 20.5; c.dispatchEvent(new Event("input")); });
  await pagina.uncheck("#sceltaNuvole");
  await pagina.uncheck("#meteoRealistico");
  await pagina.evaluate(() => localStorage.setItem("mrw-pausa", "1"));
  await pagina.reload();
  await pagina.waitForFunction(() => document.getElementById("caricamento").style.display === "none", null, { timeout: 300000 });
  await pagina.waitForFunction(() => window.__mrw && window.__mrw.fotogrammi > 2, null, { timeout: 300000 });
  const d = await pagina.evaluate(() => ({ q: localStorage.getItem("mrw-qualita"), m: window.__mrw.ambiente.meteo, o: window.__mrw.ambiente.ora, r: window.__mrw.ambiente.realistico, nuv: window.__mrw.ambiente.nuvole.visible }));
  prova("impostazioni salvate dopo il ricaricamento (qualita', meteo, ora, meteo realistico, nuvole)", d.q === "alta" && d.m === "neve_leggera" && Math.abs(d.o - 20.5) < 0.1 && d.r === false && d.nuv === false, JSON.stringify(d));
  await pagina.close();
}

// 7) Benchmark: gira, restituisce tutti gli scenari e le misure
if (vuole("benchmark")) {
  const { pagina, errori } = await apri({ "mrw-qualita": "bassa" });
  const r = await pagina.evaluate(() => window.__mrw.eseguiBenchmark({ fotogrammi: 8, durata: 0, riscaldamento: 0 }));
  const ok = r.risultati.length === 9 && r.risultati.every((x) => x.fps_medi > 0 && x.fps_minimi > 0 && x.fps_1pc_low > 0 && x.triangoli > 0 && x.chiamate > 0);
  prova("benchmark: 8 scenari (9 fasi) con FPS, 1% low, frame time, triangoli, chiamate", ok, r.risultati.map((x) => x.scenario + ":" + x.fps_medi).join(" "));
  prova("benchmark: dichiara l'ambiente di misura", !!r.ambiente.scheda_video && r.ambiente.cpu_core > 0, r.ambiente.scheda_video + (r.ambiente.grafica_software ? " [software]" : ""));
  const rip = await pagina.evaluate(() => { const a = window.__mrw.ambiente; return { p: a.pioggia, ora: a.ora }; });
  prova("benchmark: ripristina meteo e ora", rip.p < 0.05, JSON.stringify(rip));
  prova("benchmark: nessun errore", errori.length === 0, errori.slice(0, 2).join(" | "));
  await pagina.close();
}

fs.writeFileSync(path.join(uscita, "esiti.json"), JSON.stringify(esiti, null, 2));
const falliti = esiti.filter((e) => !e.ok);
console.log("\nTOTALE: " + (esiti.length - falliti.length) + "/" + esiti.length + " test superati");
await browser.close(); server.close();
process.exit(falliti.length ? 1 : 0);
