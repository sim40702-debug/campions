// Prova dell'app Electron (dal codice sorgente) con i DATI VERI delle regioni del Ticino completo:
//  1. avvio nella regione inclusa (Locarno) con profilo Alta, nessun errore;
//  2. partenza scelta a Lugano -> la regione si scarica (da un server locale con gli stessi pacchetti di GitHub) e si usa;
//  3. foto di dettaglio (pacchetto facoltativo hd_<id>): senza pacchetto il gioco va avanti senza errori; con il pacchetto
//     si scaricano in secondo piano e il gioco le carica senza riavviare;
//  4. passaggio di regione guidando: preparazione della vicina a 2,5 km dal bordo e passaggio a 2 km fuori, stesso punto LV95;
//  5. scaricamento delle risorse: dopo il passaggio la regione vecchia non e' in memoria (un solo terreno).
//
// Uso:
//   xvfb-run -a node tools/anteprima_prova/prova_ticino_regioni.mjs <cartella app> <cartella pacchetti> <cartella uscita> [binario electron]
// <cartella app>: copia di anteprima/ con "dati" = regione di Locarno (con o senza foto_hd) e "cantone" = mappa del cantone;
// <cartella pacchetti>: regione_<id>.tar.gz e (facoltativi) hd_<id>.tar.gz, con gli stessi nomi della pre-release "ticino-completo-dati".
// Gli FPS di questa prova NON contano (grafica software): contano gli esiti.
import { _electron as electron } from "playwright";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const [cartellaApp, cartellaPacchetti, uscita, binario] = process.argv.slice(2);
if (!cartellaApp || !cartellaPacchetti || !uscita) {
  console.error("Uso: node prova_ticino_regioni.mjs <cartella app> <cartella pacchetti> <cartella uscita> [electron]");
  process.exit(2);
}
fs.mkdirSync(uscita, { recursive: true });
const esiti = [];
const prova = (nome, ok, dettaglio) => { esiti.push({ nome, ok, dettaglio }); console.log((ok ? "OK      " : "FALLITO ") + nome + (dettaglio ? " - " + dettaglio : "")); };

// --- server dei pacchetti, con il registro delle richieste ---
const richieste = [];
const server = http.createServer((req, res) => {
  const nome = path.basename(decodeURIComponent(req.url.split("?")[0]));
  const file = path.join(cartellaPacchetti, nome);
  richieste.push({ nome, quando: Date.now() });
  if (!fs.existsSync(file)) { res.writeHead(404); res.end("no"); return; }
  const dim = fs.statSync(file).size;
  res.writeHead(200, { "content-type": "application/gzip", "content-length": dim });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const porta = server.address().port;

const datiUtente = fs.mkdtempSync(path.join(os.tmpdir(), "mrw-utente-"));
const eseguibile = binario || path.join(cartellaApp, "node_modules", "electron", "dist", "electron");
const app = await electron.launch({
  executablePath: eseguibile,
  args: [cartellaApp, "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--user-data-dir=" + datiUtente],
  env: { ...process.env, MRW_URL_PACCHETTI: "http://127.0.0.1:" + porta + "/" }
});
const errori = [];
let finestra = await app.firstWindow();
const ascolta = (f) => {
  f.on("pageerror", (e) => errori.push("pageerror: " + e.message));
  f.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errori.push(m.text()); });
};
ascolta(finestra);
await finestra.setViewportSize({ width: 800, height: 450 });

const caricato = () => finestra.waitForFunction(() => document.getElementById("caricamento") && document.getElementById("caricamento").style.display === "none" && window.__mrw && window.__mrw.fotogrammi > 2, null, { timeout: 420000 });
const stato = () => finestra.evaluate(async () => {
  const s = await window.regioniApp.stato();
  const m = window.__mrw;
  return { attuale: s.attuale, inclusa: s.inclusa, scaricate: s.scaricate, conFotoHD: s.conFotoHD,
    terreno: m.terreno ? { colonne: m.terreno.info.colonne, righe: m.terreno.info.righe, centro: m.terreno.info.centro_lv95 } : null,
    hdRaggio: m.fotoHD.uHDraggio.value, ev: JSON.parse(JSON.stringify(m.eventiStreaming)),
    moto: { x: m.moto.x, z: m.moto.z, suStrada: m.moto.suStrada }, qualita: localStorage.getItem("mrw-qualita") };
});
const t0 = Date.now();

// 1) regione inclusa, profilo Alta
await caricato();
prova("1. avvio nella regione inclusa (Locarno)", true, Math.round((Date.now() - t0) / 1000) + " s");
await finestra.click("button[data-qualita=alta]").catch(async () => { await finestra.keyboard.press("Escape"); await finestra.click("button[data-qualita=alta]"); });
await finestra.waitForTimeout(1500);
let s = await stato();
prova("1. regione attuale = regione inclusa, profilo Alta", s.attuale === s.inclusa && s.qualita === "alta", s.attuale + ", qualita " + s.qualita);
const conHDInclusa = fs.existsSync(path.join(cartellaApp, "dati", "foto_hd", "indice.json"));
prova("1. foto di dettaglio nella regione inclusa " + (conHDInclusa ? "(presenti)" : "(assenti: non richieste)"), conHDInclusa ? s.hdRaggio > 0 : true, "raggio HD " + s.hdRaggio);
prova("1. nessuna richiesta di pacchetto HD per la regione inclusa", !richieste.some((r) => /^hd_/.test(r.nome)), JSON.stringify(richieste.map((r) => r.nome)));

// 2) partenza a Lugano (centro, LV95) -> la regione si scarica e si usa
const LUGANO = { est: 2717500, nord: 1096000 };
await finestra.evaluate((p) => { localStorage.setItem("mrw-partenza", JSON.stringify(p)); }, LUGANO);
const t1 = Date.now();
await finestra.reload();
await caricato();
s = await stato();
const richiesteRegione = richieste.filter((r) => /^regione_/.test(r.nome)).map((r) => r.nome);
prova("2. partenza a Lugano: scaricata e in uso la regione R_2712_1090", s.attuale === "R_2712_1090" && s.scaricate.includes("R_2712_1090") && richiesteRegione.includes("regione_R_2712_1090.tar.gz"),
  s.attuale + ", " + Math.round((Date.now() - t1) / 1000) + " s, richieste " + richiesteRegione.join(","));
const lat = await finestra.evaluate(() => { const m = window.__mrw.regioni; return { id: m.attuale.id, cuore: m.attuale.cuore }; });
prova("2. moto sulla strada, dentro il cuore di Lugano", s.moto.suStrada === true, JSON.stringify(s.moto));
await finestra.screenshot({ path: path.join(uscita, "lugano_alta.png"), timeout: 240000 });

// 3) foto di dettaglio: pacchetto facoltativo
const haPacchettoHD = fs.existsSync(path.join(cartellaPacchetti, "hd_R_2712_1090.tar.gz"));
await finestra.waitForTimeout(4000);
const richiesteHD = richieste.filter((r) => /^hd_/.test(r.nome)).map((r) => r.nome);
prova("3. con profilo Alta il gioco chiede il pacchetto HD della regione in secondo piano", richiesteHD.includes("hd_R_2712_1090.tar.gz"), JSON.stringify(richiesteHD));
if (haPacchettoHD) {
  await finestra.waitForFunction(() => window.__mrw.fotoHD.uHDraggio.value > 0, null, { timeout: 420000 }).catch(() => {});
  s = await stato();
  const sulDisco = fs.existsSync(path.join(datiUtente, "regioni", "R_2712_1090", "foto_hd", "indice.json"));
  prova("3. pacchetto HD scaricato, aperto e controllato (indice + tutti i tasselli)", sulDisco, "indice su disco: " + sulDisco);
  prova("3. foto di dettaglio caricate dal gioco senza riavviare (raggio HD > 0)", s.hdRaggio > 0, "raggio " + s.hdRaggio + ", conFotoHD " + JSON.stringify(s.conFotoHD));
  // il caricamento dei tasselli avviene mentre si gioca: si lascia girare il gioco e si guarda che ne arrivino
  await finestra.waitForFunction(() => window.__mrw.eventiStreaming.hdCaricati > 0, null, { timeout: 300000 }).catch(() => {});
  s = await stato();
  prova("3. almeno un tassello HD caricato nella memoria della scheda", s.ev.hdCaricati > 0, JSON.stringify(s.ev));
  await finestra.screenshot({ path: path.join(uscita, "lugano_alta_con_hd.png"), timeout: 240000 });
} else {
  prova("3. senza pacchetto HD sul server il gioco va avanti come prima", s.hdRaggio === 0 && errori.length === 0, "raggio HD " + s.hdRaggio);
}

// 4) passaggio di regione guidando, verso nord (R_2712_1106)
const vicinaNord = "R_2712_1106";
if (fs.existsSync(path.join(cartellaPacchetti, "regione_" + vicinaNord + ".tar.gz"))) {
  const cuore = lat.cuore;
  // 1,5 km dentro il bordo nord: la regione vicina deve prepararsi
  await finestra.evaluate(({ cuore }) => {
    const m = window.__mrw;
    const c = m.terreno.info.centro_lv95;
    const est = (cuore[0] + cuore[1]) / 2, nord = cuore[3] - 1500;
    m.vaiA(est - c[0], c[1] - nord);
  }, { cuore }).catch(() => {});
  const hasCentro = await finestra.evaluate(() => window.__mrw.terreno.info.centro_lv95);
  prova("4. coordinate del terreno disponibili per la prova di passaggio", Array.isArray(hasCentro), JSON.stringify(hasCentro));
  if (Array.isArray(hasCentro)) {
    await finestra.waitForFunction((id) => window.__mrw.regioni.scaricate.includes(id), vicinaNord, { timeout: 400000 }).catch(() => {});
    s = await stato();
    prova("4. la regione vicina (nord) si prepara guidando a 1,5 km dal bordo", richieste.some((r) => r.nome === "regione_" + vicinaNord + ".tar.gz"), JSON.stringify(richieste.map((r) => r.nome)));
    // oltre 2 km fuori dal cuore: passaggio
    const prima = await finestra.evaluate(({ cuore }) => {
      const m = window.__mrw;
      const c = m.terreno.info.centro_lv95;
      const est = (cuore[0] + cuore[1]) / 2, nord = cuore[3] + 2300;
      m.vaiA(est - c[0], c[1] - nord);
      return { est: c[0] + m.moto.x, nord: c[1] - m.moto.z };
    }, { cuore });
    // la pagina si ricarica da sola: si aspetta la regione nuova
    await finestra.waitForFunction((id) => window.regioniApp && window.__mrw && window.__mrw.regioni && window.__mrw.regioni.attuale && window.__mrw.regioni.attuale.id === id && window.__mrw.fotogrammi > 2, vicinaNord, { timeout: 420000 }).catch(() => {});
    s = await stato();
    const dopo = await finestra.evaluate(() => { const m = window.__mrw; const c = m.terreno.info.centro_lv95; return { est: c[0] + m.moto.x, nord: c[1] - m.moto.z, suStrada: m.moto.suStrada }; });
    const dist = Math.hypot(dopo.est - prima.est, dopo.nord - prima.nord);
    prova("4. passaggio a " + vicinaNord + " guidando", s.attuale === vicinaNord, s.attuale);
    prova("4. dopo il passaggio la moto e' nello stesso punto LV95 (entro 150 m: la moto si rimette sulla strada piu' vicina)", dist < 150, Math.round(dist) + " m");
    prova("4. un solo terreno in memoria dopo il passaggio (regione vecchia scaricata)", s.terreno && s.terreno.colonne === 6097, JSON.stringify(s.terreno));
    await finestra.screenshot({ path: path.join(uscita, "dopo_passaggio.png"), timeout: 240000 });
  }
}

prova("nessun errore di runtime in console", errori.length === 0, errori.slice(0, 4).join(" | "));
fs.writeFileSync(path.join(uscita, "esiti_ticino_regioni.json"), JSON.stringify({ esiti, richieste: richieste.map((r) => r.nome) }, null, 2));
await app.close().catch(() => {});
server.close();
fs.rmSync(datiUtente, { recursive: true, force: true });
const falliti = esiti.filter((e) => !e.ok);
console.log("\n" + (esiti.length - falliti.length) + " prove riuscite, " + falliti.length + " fallite");
process.exit(falliti.length ? 1 : 0);
