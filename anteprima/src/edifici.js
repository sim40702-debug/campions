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
import { stradaVicina, larghezzaIn } from "./strade.js";
import { quotaTerreno } from "./terreno.js";
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

// Toglie gli edifici che toccano la strada: i contorni OpenStreetMap e le strade (linee al centro con larghezza
// stimata) a volte non combaciano. Si misura la distanza VERA tra il contorno dell'edificio e la linea al centro di
// ogni pezzo di strada vicino: se e' meno di meta' carreggiata (+15 cm), o se la strada passa dentro l'edificio,
// l'edificio si toglie. Non conta in galleria; sui ponti solo se alla stessa quota.
// Ritorna quanti ne ha tolti. Non sposta nulla: strade ed edifici restano dove sono nei dati.
function puntoSegmento(px, pz, ax, az, bx, bz) {
  const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
  let t = lungo > 0 ? ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / lungo : 0;
  t = Math.min(Math.max(t, 0), 1);
  return [Math.hypot(px - (ax + (bx - ax) * t), pz - (az + (bz - az) * t)), t];
}
function siIncrociano(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = function (px, pz, qx, qz, rx, rz) { return Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px)); };
  return o(ax, az, bx, bz, cx, cz) !== o(ax, az, bx, bz, dx, dz) && o(cx, cz, dx, dz, ax, az) !== o(cx, cz, dx, dz, bx, bz);
}
export function pulisciEdifici(edifici, strade) {
  const MARGINE = 0.15;
  const tenuti = [];
  const visti = new Set();
  for (const e of edifici.lista) {
    const p = e.p;
    const n = p.length / 2;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < n; k++) {
      minX = Math.min(minX, p[k * 2]); maxX = Math.max(maxX, p[k * 2]);
      minZ = Math.min(minZ, p[k * 2 + 1]); maxZ = Math.max(maxZ, p[k * 2 + 1]);
    }
    let tocca = false;
    visti.clear();
    for (let cx = Math.floor((minX - 8) / CELLA); cx <= Math.floor((maxX + 8) / CELLA) && !tocca; cx++) {
      for (let cz = Math.floor((minZ - 8) / CELLA); cz <= Math.floor((maxZ + 8) / CELLA) && !tocca; cz++) {
        const pezzi = strade.griglia.get(cx + "," + cz);
        if (!pezzi) continue;
        for (const [s, i] of pezzi) {
          const chiave = s * 100000 + i;
          if (visti.has(chiave)) continue;
          visti.add(chiave);
          const strada = strade.lista[s];
          if (strada.g) continue;
          const q = strada.p;
          const ax = q[i], az = q[i + 2], bx = q[i + 3], bz = q[i + 5];
          if (Math.max(ax, bx) < minX - 8 || Math.min(ax, bx) > maxX + 8 || Math.max(az, bz) < minZ - 8 || Math.min(az, bz) > maxZ + 8) continue;
          if (strada.b && Math.abs((q[i + 1] + q[i + 4]) / 2 - e.b) > 4) continue;
          const w0 = larghezzaIn(strada, i / 3) / 2, w1 = larghezzaIn(strada, i / 3 + 1) / 2;
          // la strada passa dentro l'edificio
          if (dentroPoligono(p, ax, az) || dentroPoligono(p, bx, bz)) { tocca = true; break; }
          for (let k = 0; k < n; k++) {
            const j = (k + 1) % n;
            const ex = p[k * 2], ez = p[k * 2 + 1], fx = p[j * 2], fz = p[j * 2 + 1];
            if (siIncrociano(ax, az, bx, bz, ex, ez, fx, fz)) { tocca = true; break; }
            // spigoli dell'edificio contro la linea della strada (larghezza in quel punto)
            const [d1, t1] = puntoSegmento(ex, ez, ax, az, bx, bz);
            if (d1 < w0 + (w1 - w0) * t1 + MARGINE) { tocca = true; break; }
            // capi del pezzo di strada contro il lato dell'edificio
            if (puntoSegmento(ax, az, ex, ez, fx, fz)[0] < w0 + MARGINE || puntoSegmento(bx, bz, ex, ez, fx, fz)[0] < w1 + MARGINE) { tocca = true; break; }
          }
          if (tocca) break;
        }
      }
    }
    if (!tocca) tenuti.push(e);
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
  for (const nome of FACCIATE.concat(["rustico", "sasso", "uffici", "capannone", "negozio", "liscio", "tegole", "piatto", "lamiera", "ardesia"])) p[nome] = nuovoGruppo();
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

  // rustici delle valli e ruderi: muri di sasso che seguono il terreno, tetto a due falde in piode
  if (e.s || e.k === 3) {
    costruisciRustico(e, ctx, gruppi, det, r, rnd, seme);
    return;
  }

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
  } else if (e.k === 1 && (punti !== 4 || e.r === 1)) {
    // chiese con abside, sacrestia, navate: due falde sulla pianta vera (prima: piramide o tetto piatto)
    const assi = assiDelTetto(e, ctx);
    tettoAFalde(gruppoTegole, gruppi.liscio, false, e, assi, Math.min(assi.meta * 0.6, 4.2), 0.45, 0.3, coloreFalda, _colMuro, seme);
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

// --- Rustici (case di sasso delle valli) ------------------------------------------------------------------

// Rettangolo orientato piu' piccolo che contiene la pianta: il colmo del tetto corre lungo il lato lungo.
// Ritorna centro (cx, cz), direzione del colmo (ux, uz), direzione di traverso (sx, sz), meta' lunghezza e meta' larghezza.
function assiDelTetto(e, ctx) {
  const p = e.p, n = p.length / 2;
  let migliore = null;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    let ux = p[j * 2] - p[k * 2], uz = p[j * 2 + 1] - p[k * 2 + 1];
    const l = Math.hypot(ux, uz);
    if (l < 0.5) continue;
    ux /= l; uz /= l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let q = 0; q < n; q++) {
      const a = p[q * 2] * ux + p[q * 2 + 1] * uz, b = -p[q * 2] * uz + p[q * 2 + 1] * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!migliore || area < migliore.area - 0.01) migliore = { area: area, ux: ux, uz: uz, a0: a0, a1: a1, b0: b0, b1: b1 };
  }
  if (!migliore) migliore = { ux: 1, uz: 0, a0: e.cx - 2, a1: e.cx + 2, b0: e.cz - 2, b1: e.cz + 2 };
  let ux = migliore.ux, uz = migliore.uz;
  let lunga = (migliore.a1 - migliore.a0) / 2, meta = (migliore.b1 - migliore.b0) / 2;
  const ca = (migliore.a0 + migliore.a1) / 2, cb = (migliore.b0 + migliore.b1) / 2;
  const cx = ca * ux - cb * uz, cz = ca * uz + cb * ux;
  let gira = meta > lunga;
  // pianta quasi quadrata su un pendio: il colmo segue la linea di massima pendenza (il timpano guarda la valle,
  // come nei nuclei veri: Corippo, Sonogno)
  if (ctx && ctx.terreno && Math.max(lunga, meta) / Math.max(Math.min(lunga, meta), 0.1) < 1.25) {
    const gx = quotaTerreno(ctx.terreno, cx + 4, cz) - quotaTerreno(ctx.terreno, cx - 4, cz);
    const gz = quotaTerreno(ctx.terreno, cx, cz + 4) - quotaTerreno(ctx.terreno, cx, cz - 4);
    if (Math.hypot(gx, gz) > 1.2) gira = Math.abs(gx * ux + gz * uz) < Math.abs(-gx * uz + gz * ux);
  }
  if (e.o === 1) gira = !gira;       // OpenStreetMap: roof:orientation=across
  if (gira) {
    const t = ux; ux = -uz; uz = t;
    const m = lunga; lunga = meta; meta = m;
  }
  return { cx: cx, cz: cz, ux: ux, uz: uz, sx: -uz, sz: ux, lunga: Math.max(lunga, 0.5), meta: Math.max(meta, 0.5) };
}

// Taglia un poligono (lista di [a, b]) con la retta b = 0 e tiene la parte con b * segno >= 0
function tagliaSulColmo(punti, segno) {
  const ris = [];
  for (let i = 0; i < punti.length; i++) {
    const P = punti[i], Q = punti[(i + 1) % punti.length];
    const dp = P[1] * segno, dq = Q[1] * segno;
    if (dp >= 0) ris.push(P);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
      const t = dp / (dp - dq);
      ris.push([P[0] + (Q[0] - P[0]) * t, 0]);
    }
  }
  return ris;
}

// Tetto a due falde su una pianta QUALSIASI (anche a L, con sporgenze): le due falde sono la pianta, allargata
// della gronda, tagliata lungo il colmo. I timpani (i muri sotto le falde) seguono il tetto.
//   gruppoTetto: dove vanno le falde; gruppoTimpano: dove vanno i timpani ("sassoUV" = con le UV della muratura)
function tettoAFalde(gruppoTetto, gruppoTimpano, sassoUV, e, assi, alzata, gronda, sporto, colTetto, colMuro, seme) {
  const p = e.p, n = p.length / 2;
  const pendenza = alzata / assi.meta;
  const obliqua = Math.sqrt(1 + pendenza * pendenza);
  const kA = (assi.lunga + sporto) / assi.lunga, kB = (assi.meta + gronda) / assi.meta;
  const locali = [];
  for (let k = 0; k < n; k++) {
    const dx = p[k * 2] - assi.cx, dz = p[k * 2 + 1] - assi.cz;
    locali.push([dx * assi.ux + dz * assi.uz, dx * assi.sx + dz * assi.sz]);
  }
  const quotaTetto = function (b) { return e.h + alzata * (1 - Math.abs(b) / assi.meta); };
  // falde
  const allargata = locali.map(function (q) { return [q[0] * kA, q[1] * kB]; });
  for (const segno of [1, -1]) {
    const meta = tagliaSulColmo(allargata, segno);
    if (meta.length < 3) continue;
    const contorno = meta.map(function (q) { return new THREE.Vector2(q[0], q[1]); });
    for (const tri of THREE.ShapeUtils.triangulateShape(contorno, [])) {
      for (const idx of tri) {
        const a = meta[idx][0], b = meta[idx][1];
        // 4 cm sopra il muro: la falda non "sfarfalla" con la cima dei muri
        aggiungiVertice(gruppoTetto, assi.cx + assi.ux * a + assi.sx * b, quotaTetto(b) + 0.04, assi.cz + assi.uz * a + assi.sz * b,
          colTetto, a / 2 + seme, Math.abs(b) * obliqua / 2, seme);
      }
    }
  }
  // timpani: sopra ogni lato del muro, dalla gronda fino alla falda
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    const A = locali[k], B = locali[j];
    const pezzi = [[0, 1]];
    if ((A[1] > 0.01 && B[1] < -0.01) || (A[1] < -0.01 && B[1] > 0.01)) {
      const t = A[1] / (A[1] - B[1]);
      pezzi[0] = [0, t];
      pezzi.push([t, 1]);
    }
    const lungo = Math.hypot(p[j * 2] - p[k * 2], p[j * 2 + 1] - p[k * 2 + 1]);
    for (const [t0, t1] of pezzi) {
      const b0 = A[1] + (B[1] - A[1]) * t0, b1 = A[1] + (B[1] - A[1]) * t1;
      const y0 = Math.max(quotaTetto(b0), e.h), y1 = Math.max(quotaTetto(b1), e.h);
      if (y0 - e.h < 0.02 && y1 - e.h < 0.02) continue;
      const x0 = p[k * 2] + (p[j * 2] - p[k * 2]) * t0, z0 = p[k * 2 + 1] + (p[j * 2 + 1] - p[k * 2 + 1]) * t0;
      const x1 = p[k * 2] + (p[j * 2] - p[k * 2]) * t1, z1 = p[k * 2 + 1] + (p[j * 2 + 1] - p[k * 2 + 1]) * t1;
      const u0 = sassoUV ? lungo * t0 / 2.4 + seme : 0, u1 = sassoUV ? lungo * t1 / 2.4 + seme : 0;
      const v = function (y) { return sassoUV ? y / 2.4 : 0; };
      aggiungiVertice(gruppoTimpano, x0, e.h, z0, colMuro, u0, v(e.h), seme);
      aggiungiVertice(gruppoTimpano, x1, e.h, z1, colMuro, u1, v(e.h), seme);
      aggiungiVertice(gruppoTimpano, x1, y1, z1, colMuro, u1, v(y1), seme);
      aggiungiVertice(gruppoTimpano, x0, e.h, z0, colMuro, u0, v(e.h), seme);
      aggiungiVertice(gruppoTimpano, x1, y1, z1, colMuro, u1, v(y1), seme);
      aggiungiVertice(gruppoTimpano, x0, y0, z0, colMuro, u0, v(y0), seme);
    }
  }
}

const INTONACI_RUSTICI = [0xf1ead8, 0xe9e2d0, 0xf3efe6, 0xe6d9bd, 0xddd3bf, 0xefe3c6, 0xe8d2b0];

// Rustico: e.s = 1 sasso a vista, 2 intonacato; e.k = 3 rudere (muri bassi senza tetto).
//  - ogni muro parte dal terreno vero sotto di lui (non dal punto piu' basso di tutta la casa);
//  - i piani sono bassi (2.6 m) e si contano dalla gronda in giu': le finestre di muri diversi sono allineate
//    e a monte si vede solo l'ultimo piano, come nelle case sui pendii;
//  - tetto a due falde in piode su qualsiasi pianta, con i timpani di sasso.
function costruisciRustico(e, ctx, gruppi, det, r, rnd, seme) {
  const p = e.p, punti = p.length / 2;
  const rudere = e.k === 3;
  const sasso = rudere || e.s !== 2;
  const PIANO = sasso ? 2.6 : 2.8;
  if (sasso) {
    // gneiss: grigio, a volte piu' caldo o piu' scuro
    const luce = 0.84 + r[1] * 0.2, caldo = (r[2] - 0.4) * 0.07;
    _colMuro.setRGB(luce + caldo, luce, luce - caldo);
  } else {
    coloreVariato(INTONACI_RUSTICI[Math.floor(r[1] * INTONACI_RUSTICI.length)], r[2], r[3], 0, _colMuro);
  }
  const gruppoMuro = rudere ? gruppi.sasso : (sasso ? gruppi.rustico : gruppi[r[0] < 0.6 ? "persiane" : "finestre"]);
  const suolo = [];
  for (let k = 0; k < punti; k++) suolo.push(ctx.terreno ? quotaTerreno(ctx.terreno, p[k * 2], p[k * 2 + 1]) : e.b + 0.5);
  const quantiPiani = Math.max(1, Math.ceil((e.h - e.b) / PIANO));
  const verso = Math.sign(superficie(p)) || 1;

  // ---- Muri ----
  for (let k = 0; k < punti; k++) {
    const j = (k + 1) % punti;
    const ax = p[k * 2], az = p[k * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
    const lungo = Math.hypot(bx - ax, bz - az);
    if (lungo < 0.3) continue;
    // il muro scende 3 m sotto il terreno: da lontano il terreno e' disegnato con meno punti e senza questo
    // margine le case sembravano sospese
    const base = Math.min(suolo[k], suolo[j], e.h - 0.6) - 3;
    let altoA = e.h, altoB = e.h;
    if (rudere) {
      // muri sbrecciati: ogni spigolo ha la sua altezza
      altoA = e.h - ((Math.abs(Math.sin(ax * 12.9898 + az * 78.233)) * 43758.5453) % 1) * 0.9;
      altoB = e.h - ((Math.abs(Math.sin(bx * 12.9898 + bz * 78.233)) * 43758.5453) % 1) * 0.9;
    }
    const campate = rudere ? lungo / 2.4 : Math.max(1, Math.round(lungo / 3));
    const u0 = rudere ? seme : 0, u1 = u0 + campate;
    const vDi = function (y) { return rudere ? y / 2.4 : quantiPiani - (e.h - y) / PIANO; };
    aggiungiVertice(gruppoMuro, ax, base, az, _colMuro, u0, vDi(base), seme + k);
    aggiungiVertice(gruppoMuro, bx, base, bz, _colMuro, u1, vDi(base), seme + k);
    aggiungiVertice(gruppoMuro, bx, altoB, bz, _colMuro, u1, vDi(altoB), seme + k);
    aggiungiVertice(gruppoMuro, ax, base, az, _colMuro, u0, vDi(base), seme + k);
    aggiungiVertice(gruppoMuro, bx, altoB, bz, _colMuro, u1, vDi(altoB), seme + k);
    aggiungiVertice(gruppoMuro, ax, altoA, az, _colMuro, u0, vDi(altoA), seme + k);
    // case intonacate: zoccolo di sasso al piede
    if (!sasso && lungo > 2) {
      const nx = verso * (bz - az) / lungo, nz = -verso * (bx - ax) / lungo, o = 0.04;
      const grigio = _colZoccolo.setRGB(0.86, 0.85, 0.83);
      const cima = Math.max(suolo[k], suolo[j]) + 0.7;
      if (cima < e.h - 1) {
        const uu = lungo / 2.4;
        aggiungiVertice(gruppi.sasso, ax + nx * o, base, az + nz * o, grigio, seme, base / 2.4, seme);
        aggiungiVertice(gruppi.sasso, bx + nx * o, base, bz + nz * o, grigio, seme + uu, base / 2.4, seme);
        aggiungiVertice(gruppi.sasso, bx + nx * o, cima, bz + nz * o, grigio, seme + uu, cima / 2.4, seme);
        aggiungiVertice(gruppi.sasso, ax + nx * o, base, az + nz * o, grigio, seme, base / 2.4, seme);
        aggiungiVertice(gruppi.sasso, bx + nx * o, cima, bz + nz * o, grigio, seme + uu, cima / 2.4, seme);
        aggiungiVertice(gruppi.sasso, ax + nx * o, cima, az + nz * o, grigio, seme, cima / 2.4, seme);
      }
    }
  }
  if (rudere) return;

  // ---- Tetto ----
  const assi = assiDelTetto(e, ctx);
  // piode: falde ripide (30-37 gradi), poca gronda; le case intonacate a volte hanno i coppi
  const pendenza = 0.56 + r[2] * 0.2;
  const alzata = Math.min(assi.meta * pendenza, 3.6);
  const coppi = !sasso && r[4] < 0.1;
  const luceTetto = 0.82 + r[5] * 0.3;
  if (coppi) _colTetto.setRGB(0.78, 0.72, 0.68).multiplyScalar(0.85 + r[5] * 0.2);   // coppi vecchi, scuriti
  else _colTetto.setRGB(luceTetto + (r[4] - 0.5) * 0.05, luceTetto, luceTetto - (r[4] - 0.5) * 0.05);
  const unaFalda = e.r === 4;
  if (unaFalda) {
    // tetto a una falda sola (tettoie, stalle addossate): il colmo e' un bordo della pianta
    assi.cx -= assi.sx * assi.meta; assi.cz -= assi.sz * assi.meta;
    assi.meta *= 2;
  }
  tettoAFalde(coppi ? gruppi.tegole : gruppi.ardesia, sasso ? gruppi.sasso : gruppi.liscio, sasso, e, assi,
    unaFalda ? Math.min(alzata, 1.8) : alzata, 0.32, 0.22, _colTetto, _colMuro, seme);

  // ---- Comignolo di sasso (solo le case abitate, non le stalle) ----
  if (!unaFalda && e.area > 34 && r[3] < 0.62) {
    const t = (rnd() - 0.5) * 1.2 * Math.max(assi.lunga - 0.8, 0);
    const fuori = assi.meta * (0.2 + rnd() * 0.25) * (rnd() < 0.5 ? 1 : -1);
    const cx = assi.cx + assi.ux * t + assi.sx * fuori, cz = assi.cz + assi.uz * t + assi.sz * fuori;
    const y = e.h + alzata * (1 - Math.abs(fuori) / assi.meta);
    const ang = Math.atan2(assi.uz, assi.ux);
    _colDettaglio.setRGB(0.5, 0.49, 0.47);
    scatola(det, cx, y - 0.4, cz, 0.6, 1.25, 0.6, ang, _colDettaglio);
    _colDettaglio.setRGB(0.36, 0.35, 0.34);
    scatola(det, cx, y + 0.85, cz, 0.85, 0.09, 0.85, ang, _colDettaglio);   // lastra di copertura
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
    terreno: contesto.terreno || null,
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
  mappaMateriali.sasso = materiali.sasso;
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
