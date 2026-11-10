// Edifici: contorni veri da OpenStreetMap, "alzati" fino all'altezza dell'edificio.
//
// Ogni edificio ha un'identita' che dipende da DOVE si trova:
//  - il paese (luoghi.js) decide colori dei muri e dei tetti, mix di facciate, balconi;
//  - la zona (centro storico, commerciale, industriale, residenziale, periferia) viene ricavata dalla densita'
//    e dalla grandezza degli edifici vicini: cosi' funziona in ogni citta', anche senza dati di uso del suolo;
//  - ogni casa ha il suo colore, il suo tetto (due falde con gronda e comignolo, padiglione, piatto con parapetto
//    e impianti, lamiera, pietra), il piano terra con negozi se affaccia su una strada del centro.
//
// Gli edifici sono uniti in pezzi da 500 m (poche chiamate alla scheda video); i dettagli piccoli
// (balconi, comignoli, impianti sui tetti, pannelli solari) sono in pezzi da 250 m che si vedono
// solo vicino alla moto (LOD: livello di dettaglio).
// Serve anche per le collisioni: la moto non puo' passare dentro un edificio.

import * as THREE from "three";
import { creaMateriali } from "./facciate.js";
import { profiloQui, scegliPesato, coloreVariato } from "./luoghi.js";
import { stradaVicina } from "./strade.js";
import { liberaDopoCaricamento } from "./memoria.js";

const PEZZO = 500;       // metri: pezzi dei muri e dei tetti
const PEZZO_DET = 250;   // metri: pezzi dei dettagli (LOD)
const CELLA = 40;        // griglia per le collisioni
const CELLA_ZONE = 80;   // griglia per riconoscere i quartieri

// Zone urbane
export const ZONA = { PERIFERIA: 0, RESIDENZIALE: 1, STORICO: 2, COMMERCIALE: 3, INDUSTRIALE: 4 };
export const NOMI_ZONE = ["Periferia", "Residenziale", "Centro storico", "Commerciale", "Industriale"];

const FACCIATE = ["persiane", "finestre", "moderno", "storico", "pietra"];

function costruisciGriglia(lista) {
  // Griglia per le collisioni: per ogni cella gli edifici che la toccano
  const griglia = new Map();
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i].p;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < p.length; k += 2) {
      minX = Math.min(minX, p[k]);
      maxX = Math.max(maxX, p[k]);
      minZ = Math.min(minZ, p[k + 1]);
      maxZ = Math.max(maxZ, p[k + 1]);
    }
    for (let cx = Math.floor(minX / CELLA); cx <= Math.floor(maxX / CELLA); cx++) {
      for (let cz = Math.floor(minZ / CELLA); cz <= Math.floor(maxZ / CELLA); cz++) {
        const chiave = cx + "," + cz;
        if (!griglia.has(chiave)) griglia.set(chiave, []);
        griglia.get(chiave).push(i);
      }
    }
  }
  return griglia;
}

// Toglie gli edifici che stanno IN MEZZO alla strada: i contorni OpenStreetMap e le strade (linee al centro con
// larghezza stimata) a volte non combaciano. Un edificio si toglie se il suo centro, o almeno 2 punti del contorno
// (vertici e meta' dei lati), cadono sull'asfalto di una strada (non in galleria; sui ponti solo se alla stessa quota).
// Ritorna quanti ne ha tolti. Non sposta nulla: strade ed edifici restano dove sono nei dati.
export function pulisciEdifici(edifici, strade) {
  const dentroStrada = function (x, z, base) {
    const s = stradaVicina(strade, x, z, 14);
    if (s === null || s.galleria) return false;
    if (s.ponte && Math.abs(s.y - base) > 4) return false;
    return s.distanza < s.larghezza / 2 - 0.2;
  };
  const tenuti = [];
  for (const e of edifici.lista) {
    const p = e.p;
    let cx = 0, cz = 0;
    for (let k = 0; k < p.length; k += 2) { cx += p[k]; cz += p[k + 1]; }
    cx /= p.length / 2;
    cz /= p.length / 2;
    let dentro = dentroStrada(cx, cz, e.b) ? 2 : 0;
    const n = p.length / 2;
    for (let k = 0; k < n && dentro < 2; k++) {
      const j = (k + 1) % n;
      if (dentroStrada(p[k * 2], p[k * 2 + 1], e.b)) dentro++;
      if (dentro < 2 && dentroStrada((p[k * 2] + p[j * 2]) / 2, (p[k * 2 + 1] + p[j * 2 + 1]) / 2, e.b)) dentro++;
    }
    if (dentro < 2) tenuti.push(e);
  }
  const tolti = edifici.lista.length - tenuti.length;
  if (tolti > 0) {
    edifici.lista = tenuti;
    edifici.griglia = costruisciGriglia(tenuti);
  }
  return tolti;
}

export async function caricaEdifici() {
  const risposta = await fetch("dati/edifici.json");
  if (!risposta.ok) {
    return { lista: [], griglia: new Map() };   // senza edifici il gioco funziona lo stesso
  }
  const dati = await risposta.json();

  const griglia = costruisciGriglia(dati.edifici);
  return { lista: dati.edifici, griglia: griglia, zone: null };
}

// --- Numeri casuali fissi per edificio (la stessa casa e' sempre uguale) ---------------------
function casuale(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function superficie(p) {
  let somma = 0;
  const punti = p.length / 2;
  for (let i = 0; i < punti; i++) {
    const j = (i + 1) % punti;
    somma += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return somma / 2;   // con il segno: indica il verso del contorno
}

// --- Quartieri: densita' e grandezza degli edifici nelle celle da 80 m ---------------------------------
function analizzaZone(edifici) {
  const celle = new Map();
  for (const e of edifici.lista) {
    const p = e.p;
    let cx = 0, cz = 0;
    for (let k = 0; k < p.length; k += 2) { cx += p[k]; cz += p[k + 1]; }
    cx /= p.length / 2;
    cz /= p.length / 2;
    e.cx = cx;
    e.cz = cz;
    e.area = Math.abs(superficie(p));
    e.alt = e.h - e.b;
    const chiave = Math.floor(cx / CELLA_ZONE) + "," + Math.floor(cz / CELLA_ZONE);
    let c = celle.get(chiave);
    if (!c) { c = { n: 0, area: 0, tegole: 0, alt: 0 }; celle.set(chiave, c); }
    c.n++;
    c.area += e.area;
    c.tegole += e.t === 1 ? 1 : 0;
    c.alt += e.alt;
  }
  // somma 3 x 3 celle (vicinato) e classificazione
  const zone = new Map();
  for (const chiave of celle.keys()) {
    const [ix, iz] = chiave.split(",").map(Number);
    let n = 0, area = 0, tegole = 0, alt = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const c = celle.get((ix + dx) + "," + (iz + dz));
        if (c) { n += c.n; area += c.area; tegole += c.tegole; alt += c.alt; }
      }
    }
    const lato = CELLA_ZONE * 3;
    const densita = area / (lato * lato);
    const media = area / Math.max(1, n);
    const altMedia = alt / Math.max(1, n);
    const quotaTegole = tegole / Math.max(1, n);
    let z = ZONA.PERIFERIA;
    if (media > 420 && quotaTegole < 0.5) z = ZONA.INDUSTRIALE;
    else if (densita > 0.24 && media < 330) z = (quotaTegole > 0.4 && altMedia < 17) ? ZONA.STORICO : ZONA.COMMERCIALE;
    else if (densita > 0.085) z = ZONA.RESIDENZIALE;
    zone.set(chiave, { zona: z, densita: densita });
  }
  edifici.zone = zone;
}

// Zona e densita' del punto (x, z)
export function zonaQui(edifici, x, z) {
  if (!edifici.zone) return { zona: ZONA.PERIFERIA, densita: 0 };
  return edifici.zone.get(Math.floor(x / CELLA_ZONE) + "," + Math.floor(z / CELLA_ZONE)) || { zona: ZONA.PERIFERIA, densita: 0 };
}

// --- Contenitori di triangoli --------------------------------------------------------------------
function nuovoGruppo() {
  return { posizioni: [], colori: [], uv: [], seme: [] };
}

function aggiungiVertice(g, x, y, z, c, u, v, seme) {
  g.posizioni.push(x, y, z);
  g.colori.push(c.r, c.g, c.b);
  g.uv.push(u, v);
  g.seme.push(seme);
}

// Un muro (un lato del contorno) diviso in campate da circa 3 m e piani da circa 3 m:
// le coordinate UV sono "quante campate" in largo e in alto, cosi' le finestre non vengono tagliate
function muro(g, colore, ax, az, bx, bz, basso, alto, seme, piani) {
  const lungo = Math.hypot(bx - ax, bz - az);
  const campate = Math.max(1, Math.round(lungo / 3));
  const np = piani !== undefined ? piani : Math.max(1, Math.round((alto - basso) / 3));
  aggiungiVertice(g, ax, basso, az, colore, 0, 0, seme);
  aggiungiVertice(g, bx, basso, bz, colore, campate, 0, seme);
  aggiungiVertice(g, bx, alto, bz, colore, campate, np, seme);
  aggiungiVertice(g, ax, basso, az, colore, 0, 0, seme);
  aggiungiVertice(g, bx, alto, bz, colore, campate, np, seme);
  aggiungiVertice(g, ax, alto, az, colore, 0, np, seme);
}

function triangolo(g, colore, a, b, c, seme) {
  // UV dall'alto: una texture ogni 2 m (tetti)
  aggiungiVertice(g, a[0], a[1], a[2], colore, a[0] / 2, a[2] / 2, seme);
  aggiungiVertice(g, b[0], b[1], b[2], colore, b[0] / 2, b[2] / 2, seme);
  aggiungiVertice(g, c[0], c[1], c[2], colore, c[0] / 2, c[2] / 2, seme);
}

// Falda inclinata: UV lungo la pendenza (le tegole seguono la falda)
function falda(g, colore, a, b, c, d, seme) {
  const lungo = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const pendenza = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const u = lungo / 2, v = pendenza / 2;
  aggiungiVertice(g, a[0], a[1], a[2], colore, 0, 0, seme);
  aggiungiVertice(g, b[0], b[1], b[2], colore, u, 0, seme);
  aggiungiVertice(g, c[0], c[1], c[2], colore, u, v, seme);
  aggiungiVertice(g, a[0], a[1], a[2], colore, 0, 0, seme);
  aggiungiVertice(g, c[0], c[1], c[2], colore, u, v, seme);
  aggiungiVertice(g, d[0], d[1], d[2], colore, 0, v, seme);
}

// Parallelepipedo orientato (comignoli, balconi, impianti sui tetti)
function scatola(g, cx, y0, cz, lx, ly, lz, ang, colore) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const hx = lx / 2, hz = lz / 2;
  const q = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(function ([a, b]) {
    return [cx + a * c - b * s, cz + a * s + b * c];
  });
  const y1 = y0 + ly;
  const v = function (i, y) { return [q[i][0], y, q[i][1]]; };
  const tri = function (a, b, d) {
    for (const p of [a, b, d]) {
      g.posizioni.push(p[0], p[1], p[2]);
      g.colori.push(colore.r, colore.g, colore.b);
    }
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tri(v(i, y0), v(j, y0), v(j, y1));
    tri(v(i, y0), v(j, y1), v(i, y1));
  }
  tri(v(0, y1), v(1, y1), v(2, y1));
  tri(v(0, y1), v(2, y1), v(3, y1));
}

// Il punto (x, z) e' dentro un poligono? (metodo del raggio)
function dentroPoligono(p, x, z) {
  let dentro = false;
  const punti = p.length / 2;
  for (let i = 0, j = punti - 1; i < punti; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1];
    const xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

const BIANCO = new THREE.Color(1, 1, 1);
const _colMuro = new THREE.Color();
const _colTetto = new THREE.Color();
const _colNegozio = new THREE.Color();
const _colZoccolo = new THREE.Color();
const _colDettaglio = new THREE.Color();

function pezzoDi(mappa, chiave, crea) {
  let v = mappa.get(chiave);
  if (!v) { v = crea(); mappa.set(chiave, v); }
  return v;
}

function nuovoPezzo() {
  const p = {};
  for (const nome of FACCIATE.concat(["uffici", "capannone", "negozio", "liscio", "tegole", "piatto", "lamiera", "ardesia"])) p[nome] = nuovoGruppo();
  return p;
}

// Aggiunge i muri, il tetto e i dettagli di un edificio
function costruisciEdificio(i, e, ctx) {
  const p = e.p;
  const punti = p.length / 2;
  if (punti < 3) return;
  const rnd = casuale(i * 2654435761 + 12345);
  const r = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd()];
  const seme = Math.floor(rnd() * 1000) / 10;

  const profilo = profiloQui(ctx.luoghi, e.cx, e.cz);
  const zonaInfo = zonaQui(ctx.edifici, e.cx, e.cz);
  let zona = zonaInfo.zona;
  // edifici molto grandi e bassi con tetto piatto: capannoni, anche fuori dalle zone industriali
  const grande = e.area > 700 && e.t !== 1 && e.alt < 16;
  if (grande && zona !== ZONA.COMMERCIALE) zona = ZONA.INDUSTRIALE;

  // ---- Che facciata? ----
  let facciata;
  if (e.k > 0) {
    facciata = "storico";                              // chiese e campanili
  } else if (zona === ZONA.INDUSTRIALE || (grande && e.area > 900)) {
    facciata = "capannone";
  } else if (zona === ZONA.COMMERCIALE && e.alt >= 12 && e.t !== 1 && r[0] < 0.55) {
    facciata = "uffici";
  } else if (zona === ZONA.STORICO) {
    // centro storico: piu' palazzi in stile antico
    const pesi = profilo.pesi.slice();
    pesi[3] = pesi[3] * 2.4 + 0.2;
    pesi[2] *= 0.3;
    facciata = FACCIATE[scegliPesato(pesi, r[0])];
  } else if (zona === ZONA.PERIFERIA || zona === ZONA.RESIDENZIALE) {
    const pesi = profilo.pesi.slice();
    pesi[3] *= 0.3;
    if (e.alt > 11) pesi[2] *= 1.8;
    facciata = FACCIATE[scegliPesato(pesi, r[0])];
  } else {
    facciata = FACCIATE[scegliPesato(profilo.pesi, r[0])];
  }
  // l'altitudine: sopra i 600 m i vecchi edifici sono di pietra
  if (e.b > 600 && e.t === 1 && e.k === 0 && facciata !== "capannone") facciata = "pietra";

  // ---- Colori ----
  if (e.k > 0) {
    _colMuro.setHex(0xe9e2d2);
  } else if (facciata === "capannone") {
    _colMuro.setHex([0xe8e8e4, 0xd6dadb, 0xc9d3d6, 0xdfe3d9, 0xe9ddc9][Math.floor(r[1] * 5)]);
  } else if (facciata === "uffici") {
    _colMuro.setHex([0xe6e9ea, 0xd3d8da, 0xe3e1d8][Math.floor(r[1] * 3)]);
  } else if (facciata === "pietra") {
    _colMuro.setHex(0xf2efe8);
  } else {
    coloreVariato(profilo.muri[Math.floor(r[1] * profilo.muri.length)], r[2], r[3], profilo.sfumatura, _colMuro);
  }
  coloreVariato(profilo.tetti[Math.floor(r[4] * profilo.tetti.length)], r[5], r[3], 0, _colTetto);
  const ardesia = e.b > 600 || profilo.famiglia === "pietra" && r[5] < 0.4;

  const chiave = Math.floor(e.cx / PEZZO) + "," + Math.floor(e.cz / PEZZO);
  const gruppi = pezzoDi(ctx.pezzi, chiave, nuovoPezzo);
  const chiaveDet = Math.floor(e.cx / PEZZO_DET) + "," + Math.floor(e.cz / PEZZO_DET);
  const det = pezzoDi(ctx.dettagli, chiaveDet, nuovoGruppo);

  const verso = Math.sign(superficie(p)) || 1;
  const piani = Math.max(1, Math.round(e.alt / 3));
  const conNegozi = (zona === ZONA.STORICO || zona === ZONA.COMMERCIALE || (profilo.portici && zona === ZONA.RESIDENZIALE && r[2] < 0.15)) &&
    e.k === 0 && e.alt >= 5 && facciata !== "capannone" && e.area < 1200;
  const altezzaNegozio = 3.6;
  const muroTop = e.h;
  const gruppoMuro = gruppi[facciata];

  // ---- Muri ----
  const nmoduli = [];   // lati lunghi: dove mettere i balconi
  for (let k = 0; k < punti; k++) {
    const j = (k + 1) % punti;
    const ax = p[k * 2], az = p[k * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
    const lungo = Math.hypot(bx - ax, bz - az);
    if (lungo < 0.4) continue;
    // normale verso l'esterno
    const nx = verso * (bz - az) / lungo, nz = -verso * (bx - ax) / lungo;
    let negozio = false;
    if (conNegozi && lungo >= 4.5 && piani >= 2) {
      const mx = (ax + bx) / 2 + nx * 6, mz = (az + bz) / 2 + nz * 6;
      const strada = stradaVicina(ctx.strade, mx, mz, 9);
      negozio = strada !== null && !strada.galleria && r[(k + 2) % 6] < 0.8;
    }
    if (negozio) {
      _colNegozio.copy(_colMuro).lerp(BIANCO, 0.55);
      muro(gruppi.negozio, _colNegozio, ax, az, bx, bz, e.b, e.b + altezzaNegozio, seme + k, 1);
      muro(gruppoMuro, _colMuro, ax, az, bx, bz, e.b + altezzaNegozio, muroTop, seme + k, Math.max(1, piani - 1));
    } else {
      muro(gruppoMuro, _colMuro, ax, az, bx, bz, e.b, muroTop, seme + k, piani);
      // zoccolo in pietra (solo muri alti): fascia scura al piede
      if (facciata !== "capannone" && facciata !== "uffici" && facciata !== "pietra" && lungo > 2.5) {
        const o = 0.03;
        _colZoccolo.copy(_colMuro).multiplyScalar(0.62);
        const zax = ax + nx * o, zaz = az + nz * o, zbx = bx + nx * o, zbz = bz + nz * o;
        muro(gruppi.liscio, _colZoccolo, zax, zaz, zbx, zbz, e.b, e.b + 0.7, seme, 1);
      }
    }
    if (lungo > 6) nmoduli.push([ax, az, bx, bz, nx, nz, lungo]);

    // cornicione in cima ai palazzi alti (storico, lungolago, commerciale) e parapetto sui tetti piatti
    const piatto = !(e.t === 1 && (e.k > 0 || e.area < 900));
    if (piatto && facciata !== "capannone") {
      if (zona === ZONA.STORICO || zona === ZONA.COMMERCIALE || e.k > 0 || profilo.famiglia === "mediterraneo") {
        const o = 0.28;
        _colDettaglio.copy(_colMuro).lerp(BIANCO, 0.45);
        // fascia del cornicione che sporge dal muro
        const cax = ax + nx * o, caz = az + nz * o, cbx = bx + nx * o, cbz = bz + nz * o;
        muro(gruppi.liscio, _colDettaglio, cax, caz, cbx, cbz, muroTop - 0.55, muroTop + 0.12, seme, 1);
        // sotto il cornicione (lo spessore)
        aggiungiVertice(gruppi.liscio, ax, muroTop - 0.55, az, _colDettaglio, 0, 0, seme);
        aggiungiVertice(gruppi.liscio, cbx, muroTop - 0.55, cbz, _colDettaglio, 0, 0, seme);
        aggiungiVertice(gruppi.liscio, cax, muroTop - 0.55, caz, _colDettaglio, 0, 0, seme);
        aggiungiVertice(gruppi.liscio, ax, muroTop - 0.55, az, _colDettaglio, 0, 0, seme);
        aggiungiVertice(gruppi.liscio, bx, muroTop - 0.55, bz, _colDettaglio, 0, 0, seme);
        aggiungiVertice(gruppi.liscio, cbx, muroTop - 0.55, cbz, _colDettaglio, 0, 0, seme);
      } else {
        _colDettaglio.copy(_colMuro).multiplyScalar(0.92);
        muro(gruppi.liscio, _colDettaglio, ax, az, bx, bz, muroTop, muroTop + 0.55, seme, 1);
      }
    }
  }

  // ---- Tetto ----
  const gruppoTegole = ardesia ? gruppi.ardesia : gruppi.tegole;
  const coloreFalda = ardesia ? _colMuro.clone().setHex(0xffffff).multiplyScalar(0.9 + r[5] * 0.2) : _colTetto;
  const spiovente = e.t === 1 && (e.k === 1 || e.area < 900);
  if (e.k === 2) {
    // campanile: guglia a punta
    tettoAPunta(gruppoTegole, e, _colTetto, Math.max(4, Math.sqrt(e.area) * 1.3), seme);
  } else if (spiovente && punti === 4) {
    tettoADueFalde(gruppi, gruppoTegole, det, e, _colMuro, coloreFalda, seme, r, profilo, rnd);
  } else if (spiovente && punti <= 8) {
    tettoAPunta(gruppoTegole, e, coloreFalda, Math.min(3.8, Math.sqrt(e.area) * 0.3), seme);
  } else {
    const gruppoPiatto = facciata === "capannone" || facciata === "uffici" ? gruppi.lamiera : gruppi.piatto;
    tettoPiatto(gruppoPiatto, e, facciata === "capannone" ? _colMuro.clone().multiplyScalar(0.95) : _colTetto.clone().lerp(new THREE.Color(0x77787a), 0.8), seme);
    impiantiSulTetto(det, e, facciata, rnd, zona);
  }

  // ---- Balconi (dettagli che si vedono solo da vicino) ----
  if (e.k === 0 && piani >= 3 && facciata !== "capannone" && facciata !== "pietra" && facciata !== "uffici" && r[3] < profilo.balconi) {
    const lato = nmoduli.length > 0 ? nmoduli[Math.floor(rnd() * nmoduli.length)] : null;
    if (lato) balconi(det, e, lato, piani, facciata, rnd, _colMuro);
  }
}

// Balconi: soletta + parapetto, nella campata centrale (moderni: lunghi; storici: piccoli in ferro battuto)
function balconi(det, e, lato, piani, facciata, rnd, colMuro) {
  const [ax, az, bx, bz, nx, nz, lungo] = lato;
  const dx = (bx - ax) / lungo, dz = (bz - az) / lungo;
  const ang = Math.atan2(dz, dx);
  const largo = facciata === "moderno" ? Math.min(lungo - 1, 6) : 1.9;
  const quanti = facciata === "moderno" ? 1 : Math.max(1, Math.min(3, Math.floor(lungo / 7)));
  const soletta = new THREE.Color(0xcfcdc6);
  const ferro = new THREE.Color(0x24282b);
  for (let q = 0; q < quanti; q++) {
    const t = quanti === 1 ? 0.5 : (q + 0.5) / quanti;
    const px = ax + dx * lungo * t, pz = az + dz * lungo * t;
    for (let piano = facciata === "moderno" ? 1 : 1; piano < piani; piano++) {
      if (facciata !== "moderno" && rnd() < 0.25) continue;
      const y = e.b + piano * ((e.h - e.b) / piani) + 0.0;
      const profondo = facciata === "moderno" ? 1.4 : 0.8;
      // soletta
      scatola(det, px + nx * profondo / 2, y - 0.08, pz + nz * profondo / 2, largo, 0.16, profondo, ang, facciata === "moderno" ? soletta : colMuro);
      // parapetto: tre lati in ferro (sottile) o pannello pieno (moderno)
      if (facciata === "moderno") {
        scatola(det, px + nx * (profondo - 0.04), y + 0.08, pz + nz * (profondo - 0.04), largo, 0.95, 0.06, ang, new THREE.Color(0x9fb0b8));
      } else {
        scatola(det, px + nx * (profondo - 0.03), y + 0.08, pz + nz * (profondo - 0.03), largo, 0.9, 0.04, ang, ferro);
        scatola(det, px + nx * (profondo - 0.03), y + 0.95, pz + nz * (profondo - 0.03), largo, 0.05, 0.07, ang, ferro);
      }
    }
  }
}

function impiantiSulTetto(det, e, facciata, rnd, zona) {
  const p = e.p;
  const grandezza = Math.sqrt(e.area);
  const quanti = facciata === "capannone" ? Math.min(6, Math.floor(e.area / 400)) : (e.area > 120 ? 1 + Math.floor(rnd() * 2) : (rnd() < 0.5 ? 1 : 0));
  const grigio = new THREE.Color();
  for (let q = 0; q < quanti; q++) {
    // punto a caso dentro il contorno, lontano dal bordo
    for (let tentativo = 0; tentativo < 8; tentativo++) {
      const t = (rnd() + rnd()) / 2;
      const k = Math.floor(rnd() * (p.length / 2));
      const x = e.cx + (p[k * 2] - e.cx) * t * 0.7;
      const z = e.cz + (p[k * 2 + 1] - e.cz) * t * 0.7;
      if (!dentroPoligono(p, x, z)) continue;
      const tipo = rnd();
      grigio.setHex(tipo < 0.5 ? 0xb7bbbd : (tipo < 0.8 ? 0x8c9195 : 0xc9c2b4));
      if (facciata === "capannone") {
        scatola(det, x, e.h, z, 4 + rnd() * 6, 0.9, 2.2, 0, grigio);               // lucernario / sfiato
      } else if (tipo < 0.55) {
        scatola(det, x, e.h, z, 1.6 + rnd() * 1.6, 1.1, 1.4 + rnd(), rnd() * 3, grigio);  // gruppo di condizionamento
      } else if (e.alt > 9 && zona !== ZONA.PERIFERIA) {
        scatola(det, x, e.h, z, 2.4, 2.6, 2.4, rnd() * 3, grigio);                 // vano scala / ascensore
      } else {
        scatola(det, x, e.h, z, 1.0, 1.6, 1.0, 0, grigio);                         // serbatoio / camino
      }
      break;
    }
  }
  // antenna sui palazzi alti
  if (e.alt > 16 && rnd() < 0.6) {
    scatola(det, e.cx, e.h, e.cz, 0.12, 5 + rnd() * 3, 0.12, 0, new THREE.Color(0x777b80));
  }
  void zona;
}

function tettoPiatto(gruppo, e, colore, seme) {
  const p = e.p;
  const contorno = [];
  for (let i = 0; i < p.length / 2; i++) contorno.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contorno, [])) {
    triangolo(gruppo, colore,
      [contorno[a].x, e.h, contorno[a].y],
      [contorno[b].x, e.h, contorno[b].y],
      [contorno[c].x, e.h, contorno[c].y], seme);
  }
}

function tettoAPunta(gruppo, e, colore, altezzaPunta, seme) {
  const p = e.p;
  const punti = p.length / 2;
  const punta = [e.cx, e.h + altezzaPunta, e.cz];
  for (let i = 0; i < punti; i++) {
    const j = (i + 1) % punti;
    triangolo(gruppo, colore, [p[i * 2], e.h, p[i * 2 + 1]], [p[j * 2], e.h, p[j * 2 + 1]], punta, seme);
  }
}

// Tetto a due falde con gronda (sporge 0.5 m), timpani, comignolo e (a volte) pannelli solari
function tettoADueFalde(gruppi, gruppoTegole, det, e, colMuro, colTetto, seme, r, profilo, rnd) {
  const p = e.p;
  let v = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]];
  // il colmo va nel senso del lato lungo
  if (Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) < Math.hypot(v[2][0] - v[1][0], v[2][1] - v[1][1])) {
    v = [v[1], v[2], v[3], v[0]];
  }
  let [a, b, c, d] = v;
  const corto = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const lungoLato = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const pendenza = 0.3 + r[2] * 0.12;
  const colmo = e.h + Math.min(4.5, corto * pendenza);
  const h = e.h;
  // gronda: sposta i bordi lunghi di 0.5 m verso l'esterno e allunga i timpani di 0.25 m
  const ux = (b[0] - a[0]) / (lungoLato || 1), uz = (b[1] - a[1]) / (lungoLato || 1);
  const sx = (c[0] - b[0]) / (corto || 1), sz = (c[1] - b[1]) / (corto || 1);   // dal bordo AB verso il bordo CD
  const G = 0.5, T = 0.25;
  const A = [a[0] - sx * 0 - ux * T, h, a[1] - uz * T], B = [b[0] + ux * T, h, b[1] + uz * T];
  const C = [c[0] + ux * T, h, c[1] + uz * T], D = [d[0] - ux * T, h, d[1] - uz * T];
  // gronda: AB e CD si allontanano dal colmo
  A[0] -= sx * G; A[2] -= sz * G; B[0] -= sx * G; B[2] -= sz * G;
  C[0] += sx * G; C[2] += sz * G; D[0] += sx * G; D[2] += sz * G;
  A[1] = B[1] = C[1] = D[1] = h - 0.25;
  const mBC = [(b[0] + c[0]) / 2 + ux * T, colmo, (b[1] + c[1]) / 2 + uz * T];
  const mDA = [(d[0] + a[0]) / 2 - ux * T, colmo, (d[1] + a[1]) / 2 - uz * T];
  falda(gruppoTegole, colTetto, A, B, mBC, mDA, seme);
  falda(gruppoTegole, colTetto, D, C, mBC, mDA, seme);
  // timpani (le due pareti triangolari) con lo stesso intonaco dei muri
  const b2 = [b[0], h, b[1]], c2 = [c[0], h, c[1]], d2 = [d[0], h, d[1]], a2 = [a[0], h, a[1]];
  const m1 = [mBC[0] - ux * T, colmo, mBC[2] - uz * T], m2 = [mDA[0] + ux * T, colmo, mDA[2] + uz * T];
  triangolo(gruppi.liscio, colMuro, b2, c2, m1, seme);
  triangolo(gruppi.liscio, colMuro, d2, a2, m2, seme);
  // colmo: colmo piu' scuro
  const scuro = colTetto.clone().multiplyScalar(0.8);
  scatola(det, (mBC[0] + mDA[0]) / 2, colmo - 0.06, (mBC[2] + mDA[2]) / 2, lungoLato + 2 * T, 0.14, 0.32, Math.atan2(uz, ux), scuro);
  // comignolo
  if (r[1] < 0.55 && lungoLato > 6) {
    const t = 0.2 + rnd() * 0.6;
    const cx = mDA[0] + (mBC[0] - mDA[0]) * t, cz = mDA[2] + (mBC[2] - mDA[2]) * t;
    scatola(det, cx, colmo - 0.6, cz, 0.55, 1.9, 0.55, Math.atan2(uz, ux), new THREE.Color(r[4] < 0.5 ? 0xa9a396 : 0x8b5a46));
    scatola(det, cx, colmo + 1.25, cz, 0.75, 0.12, 0.75, Math.atan2(uz, ux), new THREE.Color(0x6e6a64));
  }
  // pannelli solari sulla falda piu' rivolta a sud (z positivo = sud) nelle case moderne
  if (r[3] < 0.22 && corto > 5.5 && lungoLato > 6.5) {
    const sud = sz > 0 ? 1 : -1;   // la falda CD guarda verso (sx, sz)
    const base = sud > 0 ? [mDA, mBC, C, D] : [mDA, mBC, B, A];
    const colPannelli = new THREE.Color(0x1a2438);
    const q = base;
    const f = function (pa, pb, t) { return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t]; };
    // un rettangolo inserito nella falda (dal 20% all'80% in larghezza, dal 25% al 75% in altezza)
    const lt = function (u, w) {
      const lato1 = f(q[0], q[1], u);
      const lato2 = f(q[3], q[2], u);
      return f(lato1, lato2, w);
    };
    const pq = [lt(0.2, 0.25), lt(0.8, 0.25), lt(0.8, 0.8), lt(0.2, 0.8)];
    for (const pt of pq) pt[1] += 0.06;
    for (const idx of [[0, 1, 2], [0, 2, 3]]) {
      for (const k of idx) {
        det.posizioni.push(pq[k][0], pq[k][1], pq[k][2]);
        det.colori.push(colPannelli.r, colPannelli.g, colPannelli.b);
      }
    }
  }
  void profilo;
}

// Crea tutte le mesh degli edifici. Ritorna l'oggetto da passare a aggiornaEdifici.
export function aggiungiEdifici(edifici, scena, contesto) {
  const ctx = {
    edifici: edifici,
    luoghi: contesto.luoghi,
    strade: contesto.strade,
    pezzi: new Map(),
    dettagli: new Map()
  };
  analizzaZone(edifici);
  const materiali = creaMateriali(contesto.notte, contesto.anisotropia || 8, contesto.ambiente);

  for (let i = 0; i < edifici.lista.length; i++) {
    costruisciEdificio(i, edifici.lista[i], ctx);
  }

  const mappaMateriali = {};
  for (const nome of Object.keys(materiali.facciate)) mappaMateriali[nome] = materiali.facciate[nome];
  mappaMateriali.liscio = materiali.liscio;
  for (const nome of Object.keys(materiali.tetti)) mappaMateriali[nome] = materiali.tetti[nome];

  const pezzi = [];
  for (const [chiave, gruppi] of ctx.pezzi) {
    const [px, pz] = chiave.split(",").map(Number);
    const sistema = new THREE.Group();
    for (const nome of Object.keys(gruppi)) {
      const g = gruppi[nome];
      if (g.posizioni.length === 0) continue;
      const geometria = new THREE.BufferGeometry();
      geometria.setAttribute("position", new THREE.Float32BufferAttribute(g.posizioni, 3));
      geometria.setAttribute("color", new THREE.Float32BufferAttribute(g.colori, 3));
      geometria.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
      geometria.setAttribute("seme", new THREE.Float32BufferAttribute(g.seme, 1));
      geometria.computeVertexNormals();
      geometria.computeBoundingSphere();
      liberaDopoCaricamento(geometria);
      const mesh = new THREE.Mesh(geometria, mappaMateriali[nome]);
      mesh.name = nome;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      sistema.add(mesh);
    }
    sistema.userData.centro = new THREE.Vector2((px + 0.5) * PEZZO, (pz + 0.5) * PEZZO);
    scena.add(sistema);
    pezzi.push(sistema);
  }

  const pezziDettaglio = [];
  for (const [chiave, g] of ctx.dettagli) {
    if (g.posizioni.length === 0) continue;
    const [px, pz] = chiave.split(",").map(Number);
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(g.posizioni, 3));
    geometria.setAttribute("color", new THREE.Float32BufferAttribute(g.colori, 3));
    geometria.computeVertexNormals();
    geometria.computeBoundingSphere();
    liberaDopoCaricamento(geometria);
    const mesh = new THREE.Mesh(geometria, materiali.dettagli);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.userData.centro = new THREE.Vector2((px + 0.5) * PEZZO_DET, (pz + 0.5) * PEZZO_DET);
    scena.add(mesh);
    pezziDettaglio.push(mesh);
  }

  edifici.sistema = { pezzi: pezzi, dettagli: pezziDettaglio, raggioVista: 8000, raggioDettaglio: 500, attesa: 0, ombre: true, areaOmbre: 40 };
  return edifici.sistema;
}

// Ogni tanto: nasconde i pezzi lontani (culling per distanza), mostra i dettagli solo vicino e
// fa proiettare l'ombra solo ai pezzi che possono cadere nella mappa delle ombre (il resto non costa nulla).
// Anche i particolari piccoli (zoccoli, cornicioni, vetrine) spariscono oltre 1.4 km: da lontano non si distinguono.
export function aggiornaEdifici(edifici, x, z, dt) {
  const s = edifici.sistema;
  if (!s) return;
  s.attesa -= dt;
  if (s.attesa > 0) return;
  s.attesa = 0.3;
  const raggioOmbra = s.areaOmbre + 380;   // 380 m = mezza diagonale di un pezzo da 500 m
  for (const g of s.pezzi) {
    const d = Math.hypot(g.userData.centro.x - x, g.userData.centro.y - z);
    g.visible = d < s.raggioVista + PEZZO;
    if (!g.visible) continue;
    const ombra = s.ombre && d < raggioOmbra;
    for (const m of g.children) {
      m.castShadow = ombra;
      if (m.name === "liscio" || m.name === "negozio") m.visible = d < 1400 + PEZZO / 2;
    }
  }
  for (const m of s.dettagli) {
    const d = Math.hypot(m.userData.centro.x - x, m.userData.centro.y - z);
    m.visible = d < s.raggioDettaglio + PEZZO_DET;
    m.castShadow = s.ombre && d < raggioOmbra - 130;
  }
}

// Impostazioni di qualita': distanza di vista, distanza dei dettagli, ombre degli edifici e area delle ombre
export function impostaEdifici(edifici, raggioVista, raggioDettaglio, ombre, areaOmbre) {
  const s = edifici.sistema;
  if (!s) return;
  s.raggioVista = raggioVista;
  s.raggioDettaglio = raggioDettaglio;
  s.ombre = ombre;
  s.areaOmbre = areaOmbre || 40;
  s.attesa = 0;
}

// La moto (alla quota y) e' dentro un edificio?
export function dentroEdificio(edifici, x, z, y) {
  const lista = edifici.griglia.get(Math.floor(x / CELLA) + "," + Math.floor(z / CELLA));
  if (!lista) return false;
  for (const i of lista) {
    const edificio = edifici.lista[i];
    if (y < edificio.h && y > edificio.b - 2 && dentroPoligono(edificio.p, x, z)) {
      return true;
    }
  }
  return false;
}
