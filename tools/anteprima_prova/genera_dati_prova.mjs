// Genera DATI DI PROVA (finti ma nello stesso formato di quelli veri) per provare l'anteprima
// senza scaricare swisstopo/OpenStreetMap. Serve solo per i test grafici: i dati veri li crea
// tools/geo/passo7_esporta_anteprima.py.
//
//   node tools/anteprima_prova/genera_dati_prova.mjs [cartella_uscita]
//
// Crea 8 paesi con carattere diverso (centro storico, lungolago, industriale, periferia...),
// il lago, un fiume, boschi, strade, ferrovia, lampioni, segnali e localita'.

import fs from "node:fs";
import path from "node:path";

const uscita = process.argv[2] || path.resolve(import.meta.dirname, "../../anteprima/dati");
fs.mkdirSync(uscita, { recursive: true });

const LATO_X = 16000, LATO_Z = 12000;
const PASSO = LATO_X / 4064;            // ~3.937 m: 8 x 6 pezzi da 508 punti
const COLONNE = 4065, RIGHE = 3049;
const QUOTA_BASE = 150, SCALA = 0.05;
const LAGO = 193.3;

let seme = 12345;
function rnd() { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296; }
function r(a, b) { return a + rnd() * (b - a); }
function rumore(x, z) {
  // rumore liscio a somma di seni (basta per colline credibili)
  return Math.sin(x * 0.0007 + 1.3) * Math.cos(z * 0.0009 + 0.4) * 0.5 + Math.sin(x * 0.0021 + z * 0.0017) * 0.25 +
    Math.sin(x * 0.0063 - z * 0.0051 + 2) * 0.12 + Math.cos(z * 0.013 + x * 0.009) * 0.06;
}

// Paesi: x,z in metri dal centro (x est, z sud). Il lago sta in basso a sinistra (sud-ovest).
const PAESI = [
  { n: "Locarno", t: "city", x: 600, z: 1050, raggio: 1100, stile: "storico", angolo: 0.25 },
  { n: "Muralto", t: "town", x: 1900, z: 1150, raggio: 650, stile: "lungolago", angolo: 0.1 },
  { n: "Minusio", t: "town", x: 3600, z: 500, raggio: 900, stile: "residenziale", angolo: -0.2 },
  { n: "Tenero", t: "village", x: 5600, z: 800, raggio: 800, stile: "industriale", angolo: 0.4 },
  { n: "Gordola", t: "village", x: 4500, z: -1700, raggio: 800, stile: "periferia", angolo: -0.5 },
  { n: "Ascona", t: "town", x: -1900, z: 1300, raggio: 900, stile: "lungolago", angolo: -0.35 },
  { n: "Losone", t: "village", x: -2600, z: -900, raggio: 800, stile: "residenziale", angolo: 0.5 },
  { n: "Ponte Brolla", t: "village", x: -4300, z: -2800, raggio: 450, stile: "borgo", angolo: 0.9 }
];

function quota(x, z) {
  // pianura attorno al lago, monti a nord
  const nord = Math.max(0, (-z - 1500) / 4500);
  let q = 196 + rumore(x, z) * 25 + nord * nord * 900 + Math.max(0, (-z - 300)) * 0.02;
  // lago in basso a sinistra (z > 900 + curva): scende sotto il livello
  const riva = 1500 + 250 * Math.sin(x / 900);
  const dentroLago = riva - z;
  if (dentroLago < 0) q = Math.min(q, LAGO - 2 + dentroLago * 0.02);
  // pianura piatta nei paesi
  for (const p of PAESI) {
    const d = Math.hypot(x - p.x, z - p.z);
    const m = Math.max(0, 1 - d / (p.raggio * 1.8));
    q = q * (1 - m * 0.85) + (197 + rumore(p.x, p.z) * 3 + (p.stile === "borgo" ? 40 : 0)) * m * 0.85;
  }
  return Math.max(q, LAGO - 8);
}

// --- terreno.bin / terreno.json / bosco.bin ------------------------------------
const valori = new Uint16Array(COLONNE * RIGHE);
const bosco = new Uint8Array(COLONNE * RIGHE);
const metaX = LATO_X / 2, metaZ = LATO_Z / 2;
for (let ri = 0; ri < RIGHE; ri++) {
  for (let c = 0; c < COLONNE; c++) {
    const x = c * PASSO - metaX, z = ri * PASSO - metaZ;
    const q = quota(x, z);
    valori[ri * COLONNE + c] = Math.max(0, Math.min(65535, Math.round((q - QUOTA_BASE) / SCALA)));
    // bosco dove e' ripido o in quota, lontano dai paesi
    let vicino = false;
    for (const p of PAESI) if (Math.hypot(x - p.x, z - p.z) < p.raggio * 1.3) { vicino = true; break; }
    const fitto = Math.sin(x * 0.004) * Math.cos(z * 0.0035) + Math.sin(x * 0.011 + z * 0.007) * 0.4;
    if (!vicino && q > LAGO + 3 && (q > 330 ? fitto > -0.7 : fitto > 0.35)) bosco[ri * COLONNE + c] = 1;
  }
}
fs.writeFileSync(path.join(uscita, "terreno.bin"), Buffer.from(valori.buffer));
fs.writeFileSync(path.join(uscita, "bosco.bin"), Buffer.from(bosco.buffer));
fs.writeFileSync(path.join(uscita, "terreno.json"), JSON.stringify({
  colonne: COLONNE, righe: RIGHE, passo_m: PASSO, lato_x_m: LATO_X, lato_z_m: LATO_Z, area: "prova",
  quota_base: QUOTA_BASE, scala_quota: SCALA, centro_lv95: [2704000, 1116000], livello_lago: LAGO, fonte: "DATI DI PROVA"
}));

// --- strade -------------------------------------------------------------------
const strade = [];
const edifici = [];
const lampioni = [], semafori = [], stop = [], precedenza = [], strisce = [];
const alberi = [];
const localita = [];
const quotaY = (x, z) => quota(x, z) + 0.05;

function strada(tipo, nome, w, punti, extra) {
  const p = [];
  for (const [x, z] of punti) p.push(+x.toFixed(1), +quotaY(x, z).toFixed(2), +z.toFixed(1));
  strade.push(Object.assign({ n: nome, t: tipo, w: w, b: false, g: false, p: p }, extra || {}));
}
function densifica(a, b, passo) {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / passo));
  const out = [];
  for (let i = 0; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  return out;
}

// edificio rettangolare ruotato
function casa(cx, cz, lx, lz, ang, o) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pts = [[-lx / 2, -lz / 2], [lx / 2, -lz / 2], [lx / 2, lz / 2], [-lx / 2, lz / 2]]
    .map(([a, b]) => [cx + a * c - b * s, cz + a * s + b * c]);
  const base = Math.min(...pts.map(([x, z]) => quota(x, z))) - 0.5;
  edifici.push({
    p: pts.flatMap(([x, z]) => [+x.toFixed(1), +z.toFixed(1)]),
    b: +base.toFixed(1), h: +(base + 0.5 + o.h).toFixed(1), c: o.c !== undefined ? o.c : Math.floor(rnd() * 6),
    t: o.t || 0, k: o.k || 0
  });
}

function haStrada(x, z, minimo) {
  // c'e' una strada vicina? (per non mettere case sull'asfalto)
  for (const s of strade) {
    const p = s.p;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i] - x) < minimo && Math.abs(p[i + 2] - z) < minimo && Math.hypot(p[i] - x, p[i + 2] - z) < minimo) return true;
    }
  }
  return false;
}

function paese(p) {
  localita.push({ n: p.n, t: p.t, x: p.x, z: p.z });
  const ca = Math.cos(p.angolo), sa = Math.sin(p.angolo);
  const ruota = (x, z) => [p.x + x * ca - z * sa, p.z + x * sa + z * ca];
  const R = p.raggio;
  const passoV = { storico: 55, lungolago: 70, residenziale: 85, industriale: 130, periferia: 95, borgo: 45 }[p.stile];
  const nStrade = Math.round(R * 2 / passoV);
  const reti = [];
  // griglia deformata
  for (let i = -nStrade / 2; i <= nStrade / 2; i++) {
    const off = i * passoV + r(-6, 6);
    const lunga = Math.sqrt(Math.max(0, R * R - off * off));
    const a = ruota(off, -lunga), b = ruota(off, lunga);
    const c = ruota(-lunga, off), d = ruota(lunga, off + r(-10, 10));
    const tipoV = (Math.abs(i) < 1.5) ? "secondary" : (rnd() < 0.15 ? "tertiary" : "residential");
    const largV = tipoV === "secondary" ? 8 : (tipoV === "tertiary" ? 6.5 : 5);
    const ptsV = densifica(a, b, 25).map(([x, z], k) => [x + Math.sin(k * 0.8 + i) * 3, z]);
    const ptsH = densifica(c, d, 25).map(([x, z], k) => [x, z + Math.cos(k * 0.7 + i) * 3]);
    strada(tipoV, p.n + " via " + i, largV, ptsV);
    strada(tipoV, p.n + " via " + (i + 100), largV, ptsH);
    reti.push([a, b], [c, d]);
  }
  // case lungo la griglia
  const spazio = { storico: 11, lungolago: 15, residenziale: 24, industriale: 55, periferia: 30, borgo: 9 }[p.stile];
  for (let gx = -R; gx < R; gx += spazio) {
    for (let gz = -R; gz < R; gz += spazio) {
      const [x, z] = ruota(gx + r(-2, 2), gz + r(-2, 2));
      const dc = Math.hypot(gx, gz);
      if (dc > R) continue;
      const q = quota(x, z);
      if (q < LAGO + 1.2) continue;
      // posizione nell'isolato: salto strade
      const mx = ((gx % passoV) + passoV) % passoV, mz = ((gz % passoV) + passoV) % passoV;
      const bordoX = Math.min(mx, passoV - mx), bordoZ = Math.min(mz, passoV - mz);
      if (bordoX < 9 || bordoZ < 9) continue;
      if (rnd() < (p.stile === "periferia" ? 0.55 : 0.12)) continue;
      const centro = 1 - dc / R;
      let lx, lz, h, t = 0, k = 0;
      switch (p.stile) {
        case "storico": lx = r(7, 13); lz = r(8, 14); h = r(8, 20) * (0.7 + centro); t = rnd() < 0.7 ? 1 : 0; break;
        case "lungolago": lx = r(10, 22); lz = r(10, 18); h = r(9, 24) * (0.6 + centro); t = rnd() < 0.3 ? 1 : 0; break;
        case "residenziale": lx = r(8, 13); lz = r(8, 12); h = r(6, 10); t = rnd() < 0.85 ? 1 : 0; break;
        case "industriale": lx = r(25, 60); lz = r(20, 45); h = r(7, 14); t = 0; break;
        case "periferia": lx = r(8, 12); lz = r(7, 11); h = r(5.5, 8); t = 1; break;
        default: lx = r(6, 10); lz = r(6, 10); h = r(6, 10); t = 1;
      }
      if (lx > passoV - 22 && p.stile !== "industriale") lx = passoV - 22;
      if (lz > passoV - 22 && p.stile !== "industriale") lz = passoV - 22;
      if (lx < 5 || lz < 5) continue;
      casa(x, z, lx, lz, p.angolo + r(-0.04, 0.04), { h: h, t: t, k: k });
    }
  }
  // chiesa e campanile al centro
  const [cx, cz] = ruota(passoV * 0.5, passoV * 0.5);
  casa(cx, cz, 12, 26, p.angolo, { h: 11, t: 1, k: 1 });
  casa(cx + 10, cz - 10, 5, 5, p.angolo, { h: 28, t: 1, k: 2 });
  // lampioni lungo le vie, semafori agli incroci principali
  for (const [a, b] of reti) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 20; s < L; s += 32) {
      const x = a[0] + (b[0] - a[0]) * s / L, z = a[1] + (b[1] - a[1]) * s / L;
      if (quota(x, z) > LAGO + 1) lampioni.push(+x.toFixed(1), +z.toFixed(1));
    }
  }
  for (let k = 0; k < 6; k++) {
    const [x, z] = ruota(r(-R, R) * 0.4, r(-R, R) * 0.4);
    semafori.push(+x.toFixed(1), +z.toFixed(1));
    strisce.push(+(x + 6).toFixed(1), +(z + 4).toFixed(1));
    stop.push(+(x + 30).toFixed(1), +(z + 3).toFixed(1));
    precedenza.push(+(x - 30).toFixed(1), +(z - 3).toFixed(1));
  }
  // alberi singoli (viali, giardini)
  const nAlberi = { storico: 40, lungolago: 220, residenziale: 300, industriale: 40, periferia: 220, borgo: 40 }[p.stile];
  for (let k = 0; k < nAlberi; k++) {
    const [x, z] = ruota(r(-R, R) * 0.9, r(-R, R) * 0.9);
    if (quota(x, z) > LAGO + 1.5) alberi.push(+x.toFixed(1), +z.toFixed(1));
  }
  localita.push({ n: "Centro " + p.n, t: "suburb", x: p.x + 80, z: p.z - 60 });
}
PAESI.forEach(paese);

// collegamenti tra paesi (statale)
function collega(a, b, nome, tipo, w) {
  const pts = densifica([a.x, a.z], [b.x, b.z], 30).map(([x, z], k) => [x, z + Math.sin(k * 0.3) * 18]);
  strada(tipo, nome, w, pts);
}
collega(PAESI[5], PAESI[0], "Via Locarno-Ascona", "primary", 9);
collega(PAESI[0], PAESI[1], "Via Muralto", "primary", 9);
collega(PAESI[1], PAESI[2], "Via Cantonale", "primary", 9);
collega(PAESI[2], PAESI[3], "Via Cantonale Est", "secondary", 8);
collega(PAESI[0], PAESI[4], "Via Gordola", "secondary", 7.5);
collega(PAESI[6], PAESI[0], "Via Losone", "secondary", 7.5);
collega(PAESI[6], PAESI[7], "Via Ponte Brolla", "tertiary", 6.5);
collega(PAESI[4], PAESI[3], "Via Tenero", "tertiary", 6.5);
// strada di montagna
{
  const pts = [];
  for (let k = 0; k < 60; k++) { const t = k / 59; pts.push([600 + Math.sin(t * 6) * 250 + t * 600, -300 - t * 2500]); }
  strada("unclassified", "Via alla Cimetta", 5, pts);
}
// ponte
{
  const a = PAESI[6];
  strade.push({ n: "Ponte", t: "secondary", w: 8, b: true, g: false,
    p: densifica([a.x + 300, a.z - 150], [a.x + 420, a.z - 150], 20).flatMap(([x, z]) => [x, +(quota(x, z) + 6).toFixed(2), z]) });
}

// --- acqua: un fiume dal nord al lago, uno stagno ----------------------------------------
const fiume = [];
for (let k = 0; k <= 90; k++) { const t = k / 90; fiume.push(+(-1200 + Math.sin(t * 5) * 300 - t * 800).toFixed(1), +(-5800 + t * 6700).toFixed(1)); }
const acqua = { fiumi: [{ w: 12, p: fiume }], poligoni: [] };
{
  const cx = PAESI[4].x + 500, cz = PAESI[4].z + 200;
  const o = [];
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; o.push(+(cx + Math.cos(a) * 60).toFixed(1), +(cz + Math.sin(a) * 40).toFixed(1)); }
  acqua.poligoni.push({ o: o, f: [], piatto: +(quota(cx, cz) - 1).toFixed(2) });
}

// --- ferrovia ---------------------------------------------------------------------
const ferrovie = [];
{
  const p = [];
  for (let k = 0; k <= 80; k++) { const t = k / 80; const x = -3500 + t * 9500, z = 260 + Math.sin(t * 7) * 150 + t * 700; p.push(+x.toFixed(1), +(quota(x, z) + 0.1).toFixed(2), +z.toFixed(1)); }
  ferrovie.push({ n: "FFS", t: "rail", b: false, g: false, p: p });
}

const scrivi = (n, d) => fs.writeFileSync(path.join(uscita, n), JSON.stringify(d));
scrivi("strade.json", { strade });
scrivi("edifici.json", { edifici });
scrivi("alberi.json", { alberi });
scrivi("dettagli.json", { semafori, stop, precedenza, lampioni, strisce, localita });
scrivi("acqua.json", acqua);
scrivi("ferrovie.json", { ferrovie });
scrivi("funivie.json", { funivie: [] });
console.log("Dati di prova in " + uscita + ": " + strade.length + " strade, " + edifici.length + " edifici, " + alberi.length / 2 + " alberi");
