// Strade: legge le strade OpenStreetMap preparate dal passo 7,
// le disegna come nastri di asfalto e permette di sapere "su che strada sono".

import * as THREE from "three";
import { quotaTerreno } from "./terreno.js";
import { aggiungiMeteo } from "./meteo_shader.js";
import { liberaDopoCaricamento } from "./memoria.js";

const CELLA = 40;   // griglia di ricerca: celle da 40 x 40 m

export async function caricaStrade() {
  const risposta = await fetch("dati/strade.json");
  if (!risposta.ok) {
    throw new Error("Mancano i dati delle strade: " + (await risposta.text()));
  }
  const dati = await risposta.json();

  // Griglia: per ogni cella, l'elenco dei pezzi di strada che ci passano
  const griglia = new Map();
  for (let s = 0; s < dati.strade.length; s++) {
    const p = dati.strade[s].p;
    for (let i = 0; i + 5 < p.length; i += 3) {
      const minX = Math.floor(Math.min(p[i], p[i + 3]) / CELLA);
      const maxX = Math.floor(Math.max(p[i], p[i + 3]) / CELLA);
      const minZ = Math.floor(Math.min(p[i + 2], p[i + 5]) / CELLA);
      const maxZ = Math.floor(Math.max(p[i + 2], p[i + 5]) / CELLA);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const chiave = cx + "," + cz;
          if (!griglia.has(chiave)) {
            griglia.set(chiave, []);
          }
          griglia.get(chiave).push([s, i]);
        }
      }
    }
  }

  return { lista: dati.strade, griglia: griglia };
}

// Larghezza della strada nel punto i (piu' stretta dove ci sono le case)
export function larghezzaIn(strada, i) {
  return strada.ww ? strada.ww[Math.min(i, strada.ww.length - 1)] : strada.w;
}

// Aggiunge un nastro (striscia) a una lista di vertici e indici.
// "larghezza" puo' essere un numero oppure una funzione(i) che da' la larghezza nel punto i
function aggiungiNastro(p, larghezza, alzata, posizioni, indici, tratteggio) {
  const punti = p.length / 3;
  let distanza = 0;
  for (let i = 0; i < punti; i++) {
    const prima = Math.max(i - 1, 0) * 3;
    const dopo = Math.min(i + 1, punti - 1) * 3;
    let dx = p[dopo] - p[prima];
    let dz = p[dopo + 2] - p[prima + 2];
    const lunghezza = Math.hypot(dx, dz) || 1;
    dx = dx / lunghezza;
    dz = dz / lunghezza;
    // Direzione di lato (perpendicolare alla strada)
    const qui = typeof larghezza === "function" ? larghezza(i) : larghezza;
    const latoX = -dz * qui / 2;
    const latoZ = dx * qui / 2;
    const x = p[i * 3];
    const y = p[i * 3 + 1] + alzata;
    const z = p[i * 3 + 2];
    const primo = posizioni.length / 3;
    posizioni.push(x + latoX, y, z + latoZ, x - latoX, y, z - latoZ);

    if (i > 0) {
      distanza += Math.hypot(x - p[(i - 1) * 3], z - p[(i - 1) * 3 + 2]);
      // Per la riga di mezzeria disegno solo un pezzo ogni 6 m
      const disegna = !tratteggio || Math.floor(distanza / 6) % 2 === 0;
      if (disegna) {
        indici.push(primo - 2, primo, primo - 1, primo - 1, primo, primo + 1);
      }
    }
  }
}

function creaMesh(posizioni, indici, colore, spostamento) {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  geometria.setIndex(indici);
  geometria.computeVertexNormals();
  const materiale = new THREE.MeshLambertMaterial({
    color: colore,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: spostamento,
    polygonOffsetUnits: spostamento
  });
  const nastro = new THREE.Mesh(geometria, materiale);
  nastro.receiveShadow = true;   // ombra della moto sull'asfalto
  return nastro;
}

// Parapetto: due "muretti" alti 1 m ai lati di un ponte
function aggiungiParapetti(p, larghezza, posizioni, indici) {
  const punti = p.length / 3;
  for (const lato of [-1, 1]) {
    for (let i = 0; i < punti; i++) {
      const prima = Math.max(i - 1, 0) * 3;
      const dopo = Math.min(i + 1, punti - 1) * 3;
      let dx = p[dopo] - p[prima];
      let dz = p[dopo + 2] - p[prima + 2];
      const lunghezza = Math.hypot(dx, dz) || 1;
      const x = p[i * 3] - (dz / lunghezza) * lato * larghezza / 2;
      const z = p[i * 3 + 2] + (dx / lunghezza) * lato * larghezza / 2;
      const y = p[i * 3 + 1];
      const primo = posizioni.length / 3;
      posizioni.push(x, y, z, x, y + 1.0, z);
      if (i > 0) {
        indici.push(primo - 2, primo, primo - 1, primo - 1, primo, primo + 1);
      }
    }
  }
}

// Guardrail: dove a lato della strada il terreno scende di piu' di 1.5 m
const TIPI_CON_GUARDRAIL = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"];

function aggiungiGuardrail(strada, terreno, nastro, paletti) {
  const p = strada.p;
  const punti = p.length / 3;
  for (const lato of [-1, 1]) {
    let prima = null;   // ultimo punto con guardrail
    for (let i = 0; i < punti; i++) {
      const a = Math.max(i - 1, 0) * 3;
      const b = Math.min(i + 1, punti - 1) * 3;
      let dx = p[b] - p[a];
      let dz = p[b + 2] - p[a + 2];
      const lunghezza = Math.hypot(dx, dz) || 1;
      dx = dx / lunghezza;
      dz = dz / lunghezza;
      const distanza = strada.w / 2 + 0.4;
      const x = p[i * 3] - dz * lato * distanza;
      const z = p[i * 3 + 2] + dx * lato * distanza;
      const y = p[i * 3 + 1];
      const fuori = quotaTerreno(terreno, p[i * 3] - dz * lato * (distanza + 2), p[i * 3 + 2] + dx * lato * (distanza + 2));
      if (y - fuori > 1.5) {
        if (prima !== null) {
          const primo = nastro.posizioni.length / 3;
          nastro.posizioni.push(prima.x, prima.y + 0.5, prima.z, prima.x, prima.y + 0.8, prima.z,
                                x, y + 0.5, z, x, y + 0.8, z);
          nastro.indici.push(primo, primo + 2, primo + 1, primo + 1, primo + 2, primo + 3);
        }
        paletti.push(x, y, z);
        prima = { x: x, y: y, z: z };
      } else {
        prima = null;
      }
    }
  }
}

// --- Texture dell'asfalto e del marciapiede (disegnate dal codice) -------------------------------------
let semeT = 99;
function casualeT() {
  semeT = (semeT * 1664525 + 1013904223) >>> 0;
  return semeT / 4294967296;
}

// u = attraverso la strada (0..1), v = lungo la strada (8 m): inerti, rattoppi, due carreggiate consumate dalle ruote
function texturaAsfalto(anisotropia) {
  const L = 512;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d");
  g.fillStyle = "#6c6a66";
  g.fillRect(0, 0, L, L);
  // toppe e variazioni di colore
  for (let i = 0; i < 38; i++) {
    const x = casualeT() * L, y = casualeT() * L, w = 30 + casualeT() * 160, h = 20 + casualeT() * 90;
    const v = 92 + Math.floor(casualeT() * 40);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v + 2) + "," + (0.04 + casualeT() * 0.07) + ")";
    g.fillRect(x, y, w, h);
  }
  // carreggiate piu' lisce e scure dove passano le ruote
  for (const centro of [0.27, 0.73]) {
    const gr = g.createLinearGradient((centro - 0.1) * L, 0, (centro + 0.1) * L, 0);
    gr.addColorStop(0, "rgba(40,42,46,0)");
    gr.addColorStop(0.5, "rgba(40,42,46,0.32)");
    gr.addColorStop(1, "rgba(40,42,46,0)");
    g.fillStyle = gr;
    g.fillRect((centro - 0.1) * L, 0, 0.2 * L, L);
  }
  // macchie d'olio al centro delle corsie
  for (let i = 0; i < 10; i++) {
    g.fillStyle = "rgba(25,25,28," + (0.1 + casualeT() * 0.12) + ")";
    g.fillRect((casualeT() < 0.5 ? 0.25 : 0.72) * L + (casualeT() - 0.5) * 20, casualeT() * L, 8 + casualeT() * 12, 26 + casualeT() * 70);
  }
  // inerti (sassolini): grana fine
  for (let i = 0; i < 24000; i++) {
    const v = 70 + Math.floor(casualeT() * 100);
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.38)";
    g.fillRect(casualeT() * L, casualeT() * L, 1 + casualeT() * 1.6, 1 + casualeT() * 1.6);
  }
  // crepe sottili
  g.strokeStyle = "rgba(20,20,22,0.35)";
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    let x = casualeT() * L, y = casualeT() * L;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (casualeT() - 0.5) * 36;
      y += 10 + casualeT() * 24;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

// Marciapiede: lastre di cemento con fughe (una lastra = 1 m)
function texturaMarciapiede(anisotropia) {
  const L = 256;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d");
  g.fillStyle = "#b8b5ae";
  g.fillRect(0, 0, L, L);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const v = 176 + Math.floor(casualeT() * 24);
      g.fillStyle = "rgb(" + v + "," + (v - 2) + "," + (v - 6) + ")";
      g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
    }
  }
  for (let i = 0; i < 5000; i++) {
    const v = 130 + Math.floor(casualeT() * 100);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v - 4) + ",0.35)";
    g.fillRect(casualeT() * L, casualeT() * L, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

// Nastro con UV: u da 0 a 1 attraverso la strada, v = metri / 8 lungo la strada
function nastroConUV(p, larghezza, alzata, g, colore, offsetLato) {
  const punti = p.length / 3;
  let distanza = 0;
  const base = g.posizioni.length / 3;
  for (let i = 0; i < punti; i++) {
    const prima = Math.max(i - 1, 0) * 3;
    const dopo = Math.min(i + 1, punti - 1) * 3;
    let dx = p[dopo] - p[prima];
    let dz = p[dopo + 2] - p[prima + 2];
    const lunghezza = Math.hypot(dx, dz) || 1;
    dx = dx / lunghezza;
    dz = dz / lunghezza;
    const qui = larghezza(i);
    const latoX = -dz * qui / 2;
    const latoZ = dx * qui / 2;
    const x = p[i * 3] + (offsetLato ? -dz * offsetLato : 0);
    const z = p[i * 3 + 2] + (offsetLato ? dx * offsetLato : 0);
    const y = p[i * 3 + 1] + alzata;
    if (i > 0) distanza += Math.hypot(p[i * 3] - p[(i - 1) * 3], p[i * 3 + 2] - p[(i - 1) * 3 + 2]);
    g.posizioni.push(x + latoX, y, z + latoZ, x - latoX, y, z - latoZ);
    g.uv.push(0, distanza / 8, 1, distanza / 8);
    g.colori.push(colore.r, colore.g, colore.b, colore.r, colore.g, colore.b);
    if (i > 0) {
      const k = base + i * 2;
      g.indici.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
}

function nuovoNastro() {
  return { posizioni: [], indici: [], uv: [], colori: [] };
}

function meshDa(g, materiale, ricevi) {
  if (g.posizioni.length === 0) return null;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(g.posizioni, 3));
  if (g.uv && g.uv.length > 0) geometria.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
  if (g.colori && g.colori.length > 0) geometria.setAttribute("color", new THREE.Float32BufferAttribute(g.colori, 3));
  geometria.setIndex(g.indici);
  geometria.computeVertexNormals();
  geometria.computeBoundingSphere();
  liberaDopoCaricamento(geometria);
  const m = new THREE.Mesh(geometria, materiale);
  m.receiveShadow = ricevi !== false;
  m.matrixAutoUpdate = false;
  return m;
}

// C'e' un'altra strada (diversa da "escludi") che copre il punto (x, z)? (serve per interrompere i marciapiedi agli incroci)
function copertoDaAltra(strade, x, z, escludi, margine) {
  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) continue;
      for (const [s, i] of pezzi) {
        if (s === escludi) continue;
        const altra = strade.lista[s];
        if (altra.g) continue;
        const p = altra.p;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
        t = Math.min(Math.max(t, 0), 1);
        const d = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
        if (d < larghezzaIn(altra, i / 3) / 2 + margine) return true;
      }
    }
  }
  return false;
}

// Tipi di strada con marciapiede in zona abitata
const TIPI_CON_MARCIAPIEDE = ["primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "primary_link", "secondary_link", "tertiary_link"];

// Marciapiede lungo i due lati: dove la zona e' abitata, non c'e' un ponte/galleria e non si incrocia un'altra strada.
// La larghezza si stringe dove c'e' un muro. Il bordo (cordolo) alto 12 cm.
function aggiungiMarciapiedi(indice, strada, ctx, g, quotaTerreno) {
  const p = strada.p;
  const punti = p.length / 3;
  // ricampiono la strada ogni 3 m
  const campioni = [];
  for (let i = 0; i < punti - 1; i++) {
    const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2];
    const bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
    const lung = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(lung / 3));
    const w0 = larghezzaIn(strada, i), w1 = larghezzaIn(strada, i + 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      campioni.push([ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, w0 + (w1 - w0) * t, i]);
    }
  }
  campioni.push([p[(punti - 1) * 3], p[(punti - 1) * 3 + 1], p[(punti - 1) * 3 + 2], larghezzaIn(strada, punti - 1), punti - 2]);
  if (campioni.length < 2) return;
  const colTop = new THREE.Color(0xffffff);
  const colCordolo = new THREE.Color(0xd8d5cd);
  for (const lato of [-1, 1]) {
    // per ogni campione: larghezza del marciapiede (0 = niente)
    const larghi = campioni.map(function (c, k) {
      const prec = campioni[Math.max(0, k - 1)];
      const succ = campioni[Math.min(campioni.length - 1, k + 1)];
      let dx = succ[0] - prec[0], dz = succ[2] - prec[2];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const nx = -dz * lato, nz = dx * lato;
      const urb = zonaQuiLocale(ctx.edifici, c[0], c[2]);
      if (urb < 0.07) return 0;
      const centro = c[3] / 2 + 0.9;
      const px = c[0] + nx * centro, pz = c[2] + nz * centro;
      if (copertoDaAltra(ctx.stradeDati, px, pz, indice, 1.2)) return 0;
      // muro vicino: marciapiede stretto
      let largo = 1.9;
      const ox = c[0] + nx * (c[3] / 2 + 2.3), oz = c[2] + nz * (c[3] / 2 + 2.3);
      if (ctx.dentro(ox, oz, c[1] + 1)) largo = 0.9;
      const ox2 = c[0] + nx * (c[3] / 2 + 1.0), oz2 = c[2] + nz * (c[3] / 2 + 1.0);
      if (ctx.dentro(ox2, oz2, c[1] + 1)) return 0;
      return largo;
    });
    for (let k = 0; k < campioni.length - 1; k++) {
      const wa = larghi[k], wb = larghi[k + 1];
      if (wa === 0 || wb === 0) continue;
      const a = campioni[k], b = campioni[k + 1];
      const prec = campioni[Math.max(0, k - 1)], succ = campioni[Math.min(campioni.length - 1, k + 2)];
      const dirA = direzioneLocale(prec, b), dirB = direzioneLocale(a, succ);
      const ia = [a[0] - dirA[1] * lato, a[2] + dirA[0] * lato];
      const ib = [b[0] - dirB[1] * lato, b[2] + dirB[0] * lato];
      const dA = a[3] / 2, dB = b[3] / 2;
      const yA = a[1], yB = b[1];
      const alt = 0.12;
      // quattro punti sul bordo interno (cordolo) e quattro sul bordo esterno
      const iaX = a[0] + (ia[0] - a[0]) * dA * 1, iaZ = a[2] + (ia[1] - a[2]) * dA;
      const ibX = b[0] + (ib[0] - b[0]) * dB, ibZ = b[2] + (ib[1] - b[2]) * dB;
      const oaX = a[0] + (ia[0] - a[0]) * (dA + wa), oaZ = a[2] + (ia[1] - a[2]) * (dA + wa);
      const obX = b[0] + (ib[0] - b[0]) * (dB + wb), obZ = b[2] + (ib[1] - b[2]) * (dB + wb);
      const base = g.posizioni.length / 3;
      const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
      void dist;
      // faccia verticale del cordolo (da asfalto a +12 cm) e superficie del marciapiede
      g.posizioni.push(
        iaX, yA, iaZ, ibX, yB, ibZ, ibX, yB + alt, ibZ, iaX, yA + alt, iaZ,
        iaX, yA + alt, iaZ, ibX, yB + alt, ibZ, obX, yB + alt, obZ, oaX, yA + alt, oaZ
      );
      const ua = k * 1.5, ub = ua + 1.5;
      g.uv.push(0, ua, 0, ub, 0.06, ub, 0.06, ua, 0, ua, 0, ub, wb / 2, ub, wa / 2, ua);
      for (let q = 0; q < 4; q++) g.colori.push(colCordolo.r, colCordolo.g, colCordolo.b);
      for (let q = 0; q < 4; q++) g.colori.push(colTop.r, colTop.g, colTop.b);
      g.indici.push(base, base + 1, base + 2, base, base + 2, base + 3, base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
    }
  }
  void quotaTerreno;
}

function direzioneLocale(a, b) {
  let dx = b[0] - a[0], dz = b[2] - a[2];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

let zonaQuiLocale = function () { return 1; };

export function aggiungiStrade(strade, scena, terreno, contesto) {
  const ctx = contesto || {};
  const anisotropia = 8;
  const asfaltoMateriale = new THREE.MeshStandardMaterial({
    map: texturaAsfalto(anisotropia), roughness: 0.93, metalness: 0, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide
  });
  const galleriaMateriale = new THREE.MeshStandardMaterial({
    map: asfaltoMateriale.map, roughness: 0.85, color: 0xcfcfd2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide
  });
  const marciapiedeMateriale = new THREE.MeshStandardMaterial({
    map: texturaMarciapiede(anisotropia), roughness: 0.9, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide
  });
  const righeMateriale = new THREE.MeshStandardMaterial({
    color: 0xf2f2ee, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide
  });

  if (ctx.ambiente) {
    aggiungiMeteo(asfaltoMateriale, ctx.ambiente, { neve: 0.85, bagnato: 1, pozzanghere: true });
    aggiungiMeteo(marciapiedeMateriale, ctx.ambiente, { neve: 0.95, bagnato: 0.9 });
    aggiungiMeteo(righeMateriale, ctx.ambiente, { neve: 0.8, bagnato: 0.5 });
  }

  // Marciapiedi: serve sapere dove la citta' e' fitta e dove ci sono muri
  let marciapiedi = false;
  if (ctx.edifici && ctx.edifici.zone) {
    marciapiedi = true;
    zonaQuiLocale = function (ed, x, z) {
      const c = ed.zone.get(Math.floor(x / 80) + "," + Math.floor(z / 80));
      return c ? c.densita : 0;
    };
    ctx.dentro = function (x, z, y) { return dentroEdificioLocale(ctx.edifici, x, z, y); };
    ctx.stradeDati = strade;
  }

  const parapetti = { posizioni: [], indici: [] };
  const guardrail = { posizioni: [], indici: [] };
  const paletti = [];
  const gruppi = new Map();   // 1 km: asfalto, gallerie, righe, marciapiedi
  const pezzo = function (strada) {
    const k = Math.floor(strada.p[0] / 1000) + "," + Math.floor(strada.p[2] / 1000);
    let v = gruppi.get(k);
    if (!v) {
      v = { asfalto: nuovoNastro(), gallerie: nuovoNastro(), righe: { posizioni: [], indici: [] }, marciapiedi: nuovoNastro() };
      gruppi.set(k, v);
    }
    return v;
  };
  const bianco = new THREE.Color(1, 1, 1);

  for (let indice = 0; indice < strade.lista.length; indice++) {
    const strada = strade.lista[indice];
    const gruppo = pezzo(strada);
    const lar = function (i) { return larghezzaIn(strada, i); };
    if (strada.g) {
      nastroConUV(strada.p, lar, 0, gruppo.gallerie, bianco);
    } else {
      // leggera variazione di colore da strada a strada (asfalti piu' nuovi o piu' vecchi)
      const v = 0.82 + ((indice * 2654435761) % 1000) / 1000 * 0.34;
      nastroConUV(strada.p, lar, 0, gruppo.asfalto, new THREE.Color(v, v, v));
    }
    if (strada.w >= 5.5) {
      // mezzeria tratteggiata + linee di bordo continue (interrotte dove passa un'altra strada)
      aggiungiLinee(indice, strada, strade, gruppo.righe);
    }
    if (strada.b) {
      aggiungiParapetti(strada.p, strada.w, parapetti.posizioni, parapetti.indici);
    } else if (!strada.g && terreno && TIPI_CON_GUARDRAIL.includes(strada.t)) {
      aggiungiGuardrail(strada, terreno, guardrail, paletti);
    }
    if (marciapiedi && !strada.g && !strada.b && strada.w >= 4 && TIPI_CON_MARCIAPIEDE.includes(strada.t)) {
      aggiungiMarciapiedi(indice, strada, ctx, gruppo.marciapiedi, terreno);
    }
  }
  scena.add(creaMesh(parapetti.posizioni, parapetti.indici, 0xb8b8b0, 0));
  scena.add(creaMesh(guardrail.posizioni, guardrail.indici, 0xc9ccd0, 0));

  // Paletti del guardrail: tutti insieme in una "InstancedMesh" (veloce)
  if (paletti.length > 0) {
    const forma = new THREE.BoxGeometry(0.12, 0.8, 0.12);
    forma.translate(0, 0.4, 0);
    const istanze = new THREE.InstancedMesh(forma, new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.5, metalness: 0.6 }), paletti.length / 3);
    const matrice = new THREE.Matrix4();
    for (let i = 0; i < paletti.length; i += 3) {
      matrice.makeTranslation(paletti[i], paletti[i + 1], paletti[i + 2]);
      istanze.setMatrixAt(i / 3, matrice);
    }
    scena.add(istanze);
  }

  for (const g of gruppi.values()) {
    for (const [dati, materiale, ricevi] of [[g.asfalto, asfaltoMateriale, true], [g.gallerie, galleriaMateriale, true], [g.marciapiedi, marciapiedeMateriale, true], [g.righe, righeMateriale, true]]) {
      const mesh = meshDa(dati, materiale, ricevi);
      if (mesh) scena.add(mesh);
    }
  }
}

// Mezzeria (tratteggio 3 m + 3 m) e linee di bordo (continue, a 0.35 m dal bordo dell'asfalto).
// Si campiona la strada ogni 3 m e si disegna solo dove il punto non e' coperto da un'altra strada:
// agli incroci le righe si fermano al bordo dell'altra strada, come nella realta'.
function aggiungiLinee(indice, strada, strade, g) {
  const p = strada.p;
  const punti = p.length / 3;
  const campioni = [];
  let dist = 0;
  for (let i = 0; i < punti - 1; i++) {
    const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2];
    const bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
    const lung = Math.hypot(bx - ax, bz - az);
    if (lung < 0.01) continue;
    const dx = (bx - ax) / lung, dz = (bz - az) / lung;
    const n = Math.max(1, Math.round(lung / 1.5));
    const w0 = larghezzaIn(strada, i), w1 = larghezzaIn(strada, i + 1);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      campioni.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, z: az + (bz - az) * t, dx: dx, dz: dz, w: w0 + (w1 - w0) * t, d: dist + lung * t, nuovo: k === 0 });
    }
    dist += lung;
  }
  const strisce = strada.g ? [0] : [0, 1, -1];
  for (const lato of strisce) {
    let precedente = null;
    for (const c of campioni) {
      const d = lato === 0 ? 0 : c.w / 2 - 0.35;
      if (lato !== 0 && d < 0.5) { precedente = null; continue; }
      const x = c.x - c.dz * lato * d, z = c.z + c.dx * lato * d;
      const coperto = copertoDaAltra(strade, x, z, indice, 0.35);
      // il tratteggio: 3 m si', 3 m no (campioni ogni 1.5 m)
      const acceso = lato !== 0 || (Math.round(c.d / 1.5) % 4) < 3;
      if (coperto || !acceso || c.nuovo) {
        precedente = coperto || !acceso ? null : { x: x, y: c.y, z: z, dx: c.dx, dz: c.dz };
        continue;
      }
      if (precedente !== null) {
        const mezza = lato === 0 ? 0.075 : 0.07;
        const y0 = precedente.y + 0.03, y1 = c.y + 0.03;
        const base = g.posizioni.length / 3;
        g.posizioni.push(
          precedente.x - precedente.dz * mezza, y0, precedente.z + precedente.dx * mezza,
          precedente.x + precedente.dz * mezza, y0, precedente.z - precedente.dx * mezza,
          x - c.dz * mezza, y1, z + c.dx * mezza,
          x + c.dz * mezza, y1, z - c.dx * mezza
        );
        g.indici.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
      precedente = { x: x, y: c.y, z: z, dx: c.dx, dz: c.dz };
    }
  }
}

// dentroEdificio senza importare edifici.js (evita un import circolare): stessa griglia a celle da 40 m
function dentroEdificioLocale(edifici, x, z, y) {
  const lista = edifici.griglia.get(Math.floor(x / 40) + "," + Math.floor(z / 40));
  if (!lista) return false;
  for (const i of lista) {
    const e = edifici.lista[i];
    if (y < e.h && y > e.b - 2 && dentroPoligonoLocale(e.p, x, z)) return true;
  }
  return false;
}
function dentroPoligonoLocale(p, x, z) {
  let dentro = false;
  const punti = p.length / 2;
  for (let i = 0, j = punti - 1; i < punti; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Cerca la strada sotto il punto (x, z). Se ce ne sono due (ponte sopra una strada)
// sceglie quella con la quota piu' vicina a "quotaAttuale".
export function stradaSotto(strade, x, z, quotaAttuale) {
  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  let migliore = null;
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) {
        continue;
      }
      for (const [s, i] of pezzi) {
        const strada = strade.lista[s];
        const p = strada.p;
        const ax = p[i];
        const az = p[i + 2];
        const bx = p[i + 3];
        const bz = p[i + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
        t = Math.min(Math.max(t, 0), 1);
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const distanza = Math.hypot(x - px, z - pz);
        const larghezza = Math.max(larghezzaIn(strada, i / 3), larghezzaIn(strada, i / 3 + 1));
        if (distanza > larghezza / 2 + 0.5) {
          continue;
        }
        const y = p[i + 1] + (p[i + 4] - p[i + 1]) * t;
        const differenza = Math.abs(y - quotaAttuale);
        if (migliore === null || differenza < migliore.differenza) {
          migliore = {
            y: y,
            nome: strada.n,
            galleria: strada.g,
            differenza: differenza,
            direzioneX: bx - ax,
            direzioneZ: bz - az
          };
        }
      }
    }
  }
  return migliore;
}

// Punto di strada piu' vicino (per partire o per il tasto R)
export function puntoStradaVicino(strade, x, z) {
  let migliore = null;
  let distanzaMigliore = Infinity;
  for (const strada of strade.lista) {
    if (strada.galleria) continue;   // non si riparte dentro una galleria
    const p = strada.p;
    for (let i = 0; i + 5 < p.length; i += 3) {
      const distanza = Math.hypot(p[i] - x, p[i + 2] - z);
      if (distanza < distanzaMigliore) {
        distanzaMigliore = distanza;
        migliore = { x: p[i], y: p[i + 1], z: p[i + 2], dx: p[i + 3] - p[i], dz: p[i + 5] - p[i + 2] };
      }
    }
  }
  return migliore;
}

// Strada piu' vicina entro "raggio" metri: punto sulla strada, direzione e larghezza
// (serve per mettere cartelli e strisce nel posto giusto)
export function stradaVicina(strade, x, z, raggio) {
  const celle = Math.ceil(raggio / CELLA);
  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  let migliore = null;
  for (let ix = cx - celle; ix <= cx + celle; ix++) {
    for (let iz = cz - celle; iz <= cz + celle; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) continue;
      for (const [s, i] of pezzi) {
        const strada = strade.lista[s];
        const p = strada.p;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
        t = Math.min(Math.max(t, 0), 1);
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const distanza = Math.hypot(x - px, z - pz);
        if (distanza > raggio || (migliore !== null && distanza >= migliore.distanza)) continue;
        const lunghezza = Math.sqrt(lungo) || 1;
        migliore = {
          x: px, z: pz,
          y: p[i + 1] + (p[i + 4] - p[i + 1]) * t,
          dirX: (bx - ax) / lunghezza,
          dirZ: (bz - az) / lunghezza,
          larghezza: Math.max(larghezzaIn(strada, i / 3), larghezzaIn(strada, i / 3 + 1)),
          distanza: distanza,
          galleria: strada.g
        };
      }
    }
  }
  return migliore;
}
