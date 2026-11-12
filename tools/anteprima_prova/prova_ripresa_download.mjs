// Prova dello scaricamento con RIPRESA (anteprima/regioni_main.js: scaricaFile, apriPacchetto) senza Electron.
//   node tools/anteprima_prova/prova_ripresa_download.mjs
// Un server locale (con e senza "Range") taglia la connessione a meta': la seconda volta il file deve ripartire da dove era arrivato
// e alla fine essere identico (SHA-256) all'originale. Poi si apre un pacchetto vero (.tar.gz) con indice e tasselli.
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { scaricaFile, apriPacchetto } = require("../../anteprima/regioni_main.js");

const esiti = [];
const prova = (nome, ok, dettaglio) => { esiti.push(ok); console.log((ok ? "OK      " : "FALLITO ") + nome + (dettaglio ? " - " + dettaglio : "")); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mrw-ripresa-"));
const originale = path.join(tmp, "originale.bin");
fs.writeFileSync(originale, crypto.randomBytes(3_000_000));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const dati = fs.readFileSync(originale);

let modo = "range";          // range | senza-range | 404
let tagliaDopo = 1_200_000;  // la connessione cade dopo questi byte (solo alla prima richiesta)
const richieste = [];
const server = http.createServer((req, res) => {
  richieste.push({ range: req.headers.range || null });
  if (modo === "404") { res.writeHead(404); res.end(); return; }
  let da = 0;
  const m = /bytes=(\d+)-/.exec(req.headers.range || "");
  if (m && modo === "range") da = parseInt(m[1], 10);
  if (da > 0) res.writeHead(206, { "content-range": "bytes " + da + "-" + (dati.length - 1) + "/" + dati.length, "content-length": dati.length - da });
  else res.writeHead(200, { "content-length": dati.length });
  const corpo = dati.subarray(da);
  if (tagliaDopo > 0) {
    res.write(corpo.subarray(0, tagliaDopo));
    tagliaDopo = 0;
    setTimeout(() => res.destroy(), 50);      // connessione che cade
  } else {
    res.end(corpo);
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = "http://127.0.0.1:" + server.address().port + "/pacchetto.bin";
const rete = (u, o) => fetch(u, o);
const nessuno = () => {};

// 1) download interrotto, poi ripreso
const dest = path.join(tmp, "scarico", "a.part");
let errore = null;
try { await scaricaFile(url, dest, nessuno, rete); } catch (e) { errore = e; }
const meta = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
prova("1. connessione caduta a meta': errore e file parziale conservato", errore !== null && meta > 0 && meta < dati.length, "parziale " + meta + " di " + dati.length + " byte");
const r2 = await scaricaFile(url, dest, nessuno, rete);
prova("1. la seconda volta riparte dal punto dove era arrivato (richiesta Range)", richieste.length === 2 && richieste[1].range === "bytes=" + meta + "-", JSON.stringify(richieste));
prova("1. file finale identico all'originale (SHA-256)", sha(dest) === sha(originale), r2.byte + " byte");

// 2) server senza Range: riparte da zero ma il file e' corretto
modo = "senza-range"; tagliaDopo = 900_000; richieste.length = 0;
const dest2 = path.join(tmp, "scarico", "b.part");
try { await scaricaFile(url, dest2, nessuno, rete); } catch (e) { /* atteso */ }
await scaricaFile(url, dest2, nessuno, rete);
prova("2. server senza Range: si riparte da zero e il file e' comunque corretto", sha(dest2) === sha(originale), "richieste " + richieste.length);

// 3) 404: errore chiaro, nessun file
modo = "404";
const dest3 = path.join(tmp, "scarico", "c.part");
let msg = "";
try { await scaricaFile(url, dest3, nessuno, rete); } catch (e) { msg = e.message; }
prova("3. pacchetto non preparato (404): errore leggibile e nessun file", /non e' ancora stato preparato/.test(msg) && !fs.existsSync(dest3), msg);

// 4) apertura di un pacchetto vero con indice e tasselli
const sorgente = path.join(tmp, "src", "foto_hd");
fs.mkdirSync(sorgente, { recursive: true });
fs.writeFileSync(path.join(sorgente, "indice.json"), JSON.stringify({ tasselli: [[1, 2], [3, 4]] }));
fs.writeFileSync(path.join(sorgente, "hd_1_2.jpg"), crypto.randomBytes(50_000));
fs.writeFileSync(path.join(sorgente, "hd_3_4.jpg"), crypto.randomBytes(70_000));
const pacchetto = path.join(tmp, "hd_prova.tar.gz");
execSync("tar czf " + pacchetto + " -C " + path.join(tmp, "src") + " foto_hd");
const uscita = path.join(tmp, "aperto");
fs.mkdirSync(uscita);
const scritti = await apriPacchetto(pacchetto, uscita);
prova("4. pacchetto .tar.gz aperto: 3 file con il contenuto giusto", scritti === 3 && sha(path.join(uscita, "foto_hd", "hd_1_2.jpg")) === sha(path.join(sorgente, "hd_1_2.jpg")), scritti + " file");
// 5) pacchetto troncato: errore, non apre niente di mezzo
const troncato = path.join(tmp, "troncato.tar.gz");
fs.writeFileSync(troncato, fs.readFileSync(pacchetto).subarray(0, 60_000));
const uscita2 = path.join(tmp, "aperto2");
fs.mkdirSync(uscita2);
let errore2 = null;
try { await apriPacchetto(troncato, uscita2); } catch (e) { errore2 = e; }
prova("5. pacchetto troncato: l'apertura fallisce", errore2 !== null, errore2 && errore2.message);

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log("\n" + esiti.filter(Boolean).length + " prove riuscite, " + esiti.filter((x) => !x).length + " fallite");
process.exit(esiti.every(Boolean) ? 0 : 1);
