// Arredo urbano: tutto cio' che rende una strada di citta' diversa da una strada di campagna.
//  - lampioni: la testa si accende di notte, con alone luminoso e macchia di luce sull'asfalto;
//  - panchine, cestini e pensiline dell'autobus lungo i marciapiedi dei quartieri abitati;
//  - cartelli di localita' (con il nome del paese) e limite di velocita' all'ingresso dei paesi;
//  - cartelli "attenzione pedoni" davanti alle strisce pedonali.
// Tutto e' "instanced" (una sola chiamata per tipo) e si vede solo entro una certa distanza dalla moto.

import * as THREE from "three";
import { unisci, aBordoStrada } from "./dettagli.js";
import { zonaQui, ZONA } from "./edifici.js";

function casuale(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texturaAlone() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.18, "rgba(255,255,255,0.75)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.22)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function texturaCartello(testo, sfondo, bordo, colore) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const g = c.getContext("2d");
  g.fillStyle = bordo;
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = sfondo;
  g.fillRect(10, 10, 492, 172);
  g.fillStyle = colore;
  let dim = 84;
  g.font = "bold " + dim + "px Arial";
  while (g.measureText(testo).width > 460 && dim > 28) {
    dim -= 4;
    g.font = "bold " + dim + "px Arial";
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(testo, 256, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function texturaPedoni() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#1d4fa0";
  g.fillRect(6, 6, 116, 116);
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(64, 18);
  g.lineTo(112, 104);
  g.lineTo(16, 104);
  g.closePath();
  g.fill();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(64, 56, 6, 0, Math.PI * 2);
  g.fill();
  g.fillRect(60, 64, 8, 22);
  g.fillRect(52, 86, 8, 12);
  g.fillRect(68, 86, 8, 12);
  g.fillRect(52, 66, 24, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaLimite() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#c8171e";
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.font = "bold 52px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("50", 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Forme ---
function formaPanchina() {
  const sedile = new THREE.BoxGeometry(1.7, 0.06, 0.42);
  sedile.translate(0, 0.46, 0);
  const schienale = new THREE.BoxGeometry(1.7, 0.4, 0.05);
  schienale.translate(0, 0.78, 0.2);
  const g1 = new THREE.BoxGeometry(0.06, 0.46, 0.4);
  g1.translate(-0.78, 0.23, 0);
  const g2 = g1.clone();
  g2.translate(1.56, 0, 0);
  return unisci([[sedile, 0x8a6a45], [schienale, 0x8a6a45], [g1, 0x2d3034], [g2, 0x2d3034]]);
}
function formaCestino() {
  const c = new THREE.CylinderGeometry(0.22, 0.2, 0.8, 10);
  c.translate(0, 0.55, 0);
  const palo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
  palo.translate(0, 0.3, 0);
  const coperchio = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 10);
  coperchio.translate(0, 0.97, 0);
  return unisci([[c, 0x2f5a3f], [palo, 0x2d3034], [coperchio, 0x1f2326]]);
}
function formaPensilina() {
  const tetto = new THREE.BoxGeometry(3.4, 0.1, 1.5);
  tetto.translate(0, 2.55, 0.1);
  const fondo = new THREE.BoxGeometry(3.2, 1.9, 0.05);
  fondo.translate(0, 1.5, 0.78);
  const latoA = new THREE.BoxGeometry(0.05, 1.9, 1.3);
  latoA.translate(-1.6, 1.5, 0.15);
  const latoB = latoA.clone();
  latoB.translate(3.2, 0, 0);
  const pa = new THREE.BoxGeometry(0.1, 2.5, 0.1);
  pa.translate(-1.62, 1.25, -0.5);
  const pb = pa.clone();
  pb.translate(3.24, 0, 0);
  const sedile = new THREE.BoxGeometry(2.2, 0.06, 0.4);
  sedile.translate(0, 0.5, 0.55);
  return unisci([[tetto, 0x3d4a52], [fondo, 0x9bb7c4], [latoA, 0x9bb7c4], [latoB, 0x9bb7c4], [pa, 0x2d3034], [pb, 0x2d3034], [sedile, 0x8a6a45]]);
}
function formaPalo(altezza) {
  const g = new THREE.CylinderGeometry(0.035, 0.035, altezza, 6);
  g.translate(0, altezza / 2, 0);
  return g;
}

function matrici(oggetti, forma, materiale, scena, ombra) {
  if (oggetti.length === 0) return null;
  // celle da 400 m: la scheda video scarta quelle fuori dallo schermo (e fuori dalle ombre)
  const celle = new Map();
  for (const o of oggetti) {
    const k = Math.floor(o.x / 400) + "," + Math.floor(o.z / 400);
    let l = celle.get(k);
    if (!l) { l = []; celle.set(k, l); }
    l.push(o);
  }
  const gruppo = new THREE.Group();
  const mat = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const asse = new THREE.Vector3(0, 1, 0);
  const uno = new THREE.Vector3();
  const pos = new THREE.Vector3();
  for (const lista of celle.values()) {
    const m = new THREE.InstancedMesh(forma, materiale, lista.length);
    for (let i = 0; i < lista.length; i++) {
      const o = lista[i];
      q.setFromAxisAngle(asse, o.angolo);
      uno.set(o.s || 1, o.s || 1, o.s || 1);
      mat.compose(pos.set(o.x, o.y, o.z), q, uno);
      m.setMatrixAt(i, mat);
    }
    m.castShadow = ombra !== false;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    gruppo.add(m);
  }
  scena.add(gruppo);
  return gruppo;
}

export function aggiungiArredoUrbano(scena, terreno, strade, ctx, lampioni, dettagli, formaTesta) {
  const amb = ctx.ambiente;
  const risultato = { panchine: 0, cestini: 0, pensiline: 0, cartelli: 0 };

  // ---- Lampioni accesi di notte ----
  const matTesta = new THREE.MeshStandardMaterial({ color: 0x35383d, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 });
  matTesta.fog = true;
  matrici(lampioni, formaTesta, matTesta, scena, false);

  // alone (puntini luminosi) all'altezza della lampada e macchia di luce sulla strada
  const alone = texturaAlone();
  const punti = [];
  const macchie = [];
  for (const l of lampioni) {
    // la lampada e' 1.35 m davanti al palo, nella direzione del braccio
    const bx = l.x - Math.sin(l.angolo) * 1.35, bz = l.z - Math.cos(l.angolo) * 1.35;
    punti.push(bx, l.y + 6.0, bz);
    macchie.push({ x: bx, y: l.y + 0.1, z: bz, angolo: 0, s: 1 });
  }
  if (punti.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(punti, 3));
    const matAlone = new THREE.PointsMaterial({
      map: alone, size: 5.5, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffcf8a, fog: false
    });
    const nuvola = new THREE.Points(geo, matAlone);
    nuvola.frustumCulled = false;
    scena.add(nuvola);
    const piano = new THREE.PlaneGeometry(15, 15);
    piano.rotateX(-Math.PI / 2);
    const matMacchia = new THREE.MeshBasicMaterial({
      map: alone, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb862,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, fog: false
    });
    const pozze = matrici(macchie, piano, matMacchia, scena, false);
    if (pozze) for (const m of pozze.children) m.receiveShadow = false;
    amb.osservatori.push(function () {
      const n = amb.uniformi.notte.value;
      matTesta.emissiveIntensity = n * 6;
      matAlone.opacity = n * 0.85;
      matMacchia.opacity = n * (0.55 + 0.35 * amb.uniformi.bagnato.value);   // l'asfalto bagnato riflette di piu'
      nuvola.visible = n > 0.02;
      if (pozze) pozze.visible = n > 0.02;
    });
  }

  // ---- Arredo lungo le strade abitate ----
  const rnd = casuale(20241);
  const panchine = [], cestini = [], pensiline = [], pali = [], cartelliPedoni = [];
  for (const strada of strade.lista) {
    if (strada.g || strada.b || strada.w < 4.5) continue;
    if (strada.t !== "residential" && strada.t !== "tertiary" && strada.t !== "secondary" && strada.t !== "primary" && strada.t !== "unclassified") continue;
    const p = strada.p;
    let prossimo = 20 + rnd() * 50;
    let percorso = 0;
    for (let i = 3; i < p.length; i += 3) {
      percorso += Math.hypot(p[i] - p[i - 3], p[i + 2] - p[i - 1]);
      if (percorso < prossimo) continue;
      percorso = 0;
      prossimo = 45 + rnd() * 75;
      const info = zonaQui(ctx.edifici, p[i], p[i + 2]);
      if (info.densita < 0.1 || info.zona === ZONA.INDUSTRIALE) continue;
      const lato = rnd() < 0.5 ? 1 : -1;
      const dx = p[i] - p[i - 3], dz = p[i + 2] - p[i - 1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l * lato, nz = dx / l * lato;
      const d = strada.w / 2 + 1.15;
      const x = p[i] + nx * d, z = p[i + 2] + nz * d;
      const y = p[i + 1] + 0.14;
      if (ctx.edifici && dentro(ctx.edifici, x + nx * 1.2, z + nz * 1.2, y + 1)) continue;
      const angolo = Math.atan2(nx, nz);
      const r = rnd();
      if (r < 0.45) {
        panchine.push({ x: x, y: y, z: z, angolo: angolo + Math.PI });
      } else if (r < 0.8) {
        cestini.push({ x: x, y: y, z: z, angolo: 0 });
      } else if ((strada.t === "primary" || strada.t === "secondary" || strada.t === "tertiary") && strada.w >= 6) {
        pensiline.push({ x: x + nx * 0.8, y: y, z: z + nz * 0.8, angolo: angolo + Math.PI });
        pali.push({ x: x - dx / l * 3.5 + nx * 0.2, y: y, z: z - dz / l * 3.5 + nz * 0.2, angolo: 0 });
      }
    }
  }
  matrici(panchine, formaPanchina(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }), scena);
  matrici(cestini, formaCestino(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }), scena);
  matrici(pensiline, formaPensilina(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 }), scena);
  risultato.panchine = panchine.length;
  risultato.cestini = cestini.length;
  risultato.pensiline = pensiline.length;

  // ---- Cartelli: pedoni davanti alle strisce ----
  const matPedoni = new THREE.MeshStandardMaterial({ map: texturaPedoni(), roughness: 0.5, metalness: 0.1 });
  const palo = unisci([[formaPalo(2.3), 0x8d9096]]);
  const pannello = new THREE.PlaneGeometry(0.55, 0.55);
  pannello.translate(0, 2.15, 0.03);
  for (let i = 0; i + 1 < dettagli.strisce.length; i += 2) {
    const o = aBordoStrada(strade, terreno, dettagli.strisce[i], dettagli.strisce[i + 1], 0.9);
    cartelliPedoni.push(o);
  }
  matrici(cartelliPedoni, palo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }), scena);
  // il pannello guarda verso chi arriva: ruoto di 180 gradi (aBordoStrada guarda verso -z)
  const panPed = matrici(cartelliPedoni.map(function (o) { return { x: o.x, y: o.y, z: o.z, angolo: o.angolo + Math.PI }; }), pannello, matPedoni, scena, false);
  risultato.cartelli += cartelliPedoni.length;

  // ---- Ingresso dei paesi: cartello con il nome + limite 50 ----
  const matLimite = new THREE.MeshStandardMaterial({ map: texturaLimite(), roughness: 0.5 });
  const formaLimite = new THREE.CircleGeometry(0.33, 20);
  formaLimite.translate(0, 2.4, 0.03);
  const paloCartello = unisci([[formaPalo(2.8), 0x8d9096]]);
  const luoghi = ctx.luoghi.lista;
  const marcati = new Set();
  for (const luogo of luoghi) {
    const entrata = luogo.t === "city" ? 650 : (luogo.t === "town" ? 500 : 380);
    const matNome = new THREE.MeshStandardMaterial({ map: texturaCartello(luogo.n, "#f3c614", "#1f2326", "#1f2326"), roughness: 0.5 });
    const pannelloNome = new THREE.PlaneGeometry(1.5, 0.56);
    pannelloNome.translate(0, 1.5, 0.03);
    const oggetti = [];
    for (let si = 0; si < strade.lista.length; si++) {
      const strada = strade.lista[si];
      if (strada.g || strada.b || strada.w < 5.5) continue;
      if (strada.t !== "primary" && strada.t !== "secondary" && strada.t !== "tertiary" && strada.t !== "trunk") continue;
      const p = strada.p;
      for (let i = 3; i < p.length; i += 3) {
        const d0 = Math.hypot(p[i - 3] - luogo.x, p[i - 1] - luogo.z);
        const d1 = Math.hypot(p[i] - luogo.x, p[i + 2] - luogo.z);
        if ((d0 - entrata) * (d1 - entrata) >= 0) continue;
        const t = (entrata - d0) / (d1 - d0);
        const x = p[i - 3] + (p[i] - p[i - 3]) * t, z = p[i - 1] + (p[i + 2] - p[i - 1]) * t;
        const chiave = Math.round(x / 80) + "," + Math.round(z / 80);
        if (marcati.has(chiave)) continue;
        marcati.add(chiave);
        // la direzione di marcia e' verso il paese
        const verso = d1 < d0 ? 1 : -1;
        const dx = (p[i] - p[i - 3]) * verso, dz = (p[i + 2] - p[i - 1]) * verso;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l, nz = dx / l;   // a destra rispetto alla marcia
        const px = x + nx * (strada.w / 2 + 1.0), pz = z + nz * (strada.w / 2 + 1.0);
        const py = Math.max(p[i + 1], p[i - 2]);
        oggetti.push({ x: px, y: py, z: pz, angolo: Math.atan2(-dx, -dz) + Math.PI });
        // limite: un po' prima del cartello
      }
    }
    if (oggetti.length === 0) continue;
    matrici(oggetti.filter(function (o) { return !o.limite; }), pannelloNome, matNome, scena, false);
    matrici(oggetti.filter(function (o) { return !o.limite; }), paloCartello, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }), scena);
    risultato.cartelli += oggetti.length;
  }
  return risultato;
}

// Il punto e' dentro un edificio? (stessa griglia delle collisioni)
function dentro(edifici, x, z, y) {
  const lista = edifici.griglia.get(Math.floor(x / 40) + "," + Math.floor(z / 40));
  if (!lista) return false;
  for (const i of lista) {
    const e = edifici.lista[i];
    if (!(y < e.h && y > e.b - 2)) continue;
    const p = e.p;
    let dentroP = false;
    const n = p.length / 2;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const xi = p[a * 2], zi = p[a * 2 + 1], xj = p[b * 2], zj = p[b * 2 + 1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentroP = !dentroP;
    }
    if (dentroP) return true;
  }
  return false;
}
