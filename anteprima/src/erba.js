// Vegetazione bassa: ciuffi d'erba, fiori di campo e cespuglietti attorno alla moto.
// Come per gli alberi (alberi.js) si creano SOLO vicino al giocatore, a celle da 20 m, e si tolgono quando ci si allontana.
// Dove si mettono: dove c'e' prato (non strada, non edificio, non lago, non bosco fitto, pendenza dolce).
// Ogni ciuffo e' una coppia di piani incrociati con una texture di fili d'erba (disegnata qui, niente file),
// il colore segue il terreno e il vento li fa ondeggiare. Tutti i ciuffi di una cella sono UNA InstancedMesh.

import * as THREE from "three";
import { quotaTerreno, boscoQui } from "./terreno.js";
import { stradaVicina } from "./strade.js";
import { dentroEdificio } from "./edifici.js";

const CELLA = 20;
let RAGGIO = 38;          // metri attorno alla moto (impostazioni: 0 = spenta)
let DENSITA = 1;          // moltiplicatore del numero di ciuffi
const CIUFFI_PER_CELLA = 90;

let seme = 77;
function rnd() {
  seme = (seme * 1664525 + 1013904223) >>> 0;
  return seme / 4294967296;
}

function texturaErba() {
  const L = 128;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d");
  g.clearRect(0, 0, L, L);
  // fili d'erba: strisce sottili e appuntite, piu' scure alla base e chiare in punta
  for (let i = 0; i < 46; i++) {
    const x = 6 + (i / 46) * (L - 12) + (rnd() - 0.5) * 6;
    const alto = 40 + rnd() * 80;
    const piega = (rnd() - 0.5) * 26;
    const largo = 2.2 + rnd() * 2.2;
    const grad = g.createLinearGradient(0, L, 0, L - alto);
    const t = 0.55 + rnd() * 0.4;
    grad.addColorStop(0, "rgb(" + Math.round(38 * t) + "," + Math.round(70 * t) + "," + Math.round(26 * t) + ")");
    grad.addColorStop(1, "rgb(" + Math.round(150 * t) + "," + Math.round(185 * t) + "," + Math.round(70 * t) + ")");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - largo, L);
    g.quadraticCurveTo(x - largo * 0.5 + piega * 0.4, L - alto * 0.55, x + piega, L - alto);
    g.quadraticCurveTo(x + largo * 0.5 + piega * 0.4, L - alto * 0.55, x + largo, L);
    g.closePath();
    g.fill();
  }
  // qualche fiore di campo
  const colori = ["#f4f1e8", "#f2d34a", "#d94a6a", "#b08ad8"];
  for (let i = 0; i < 4; i++) {
    const x = 14 + rnd() * (L - 28), y = L - 38 - rnd() * 60;
    g.fillStyle = "#4d7a2e";
    g.fillRect(x - 0.8, y, 1.6, L - y);
    g.fillStyle = colori[Math.floor(rnd() * colori.length)];
    g.beginPath();
    g.arc(x, y, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

let MATERIALE = null;
function materiale(tempo, ambiente) {
  if (MATERIALE) return MATERIALE;
  const m = new THREE.MeshStandardMaterial({
    map: texturaErba(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, vertexColors: false
  });
  m.onBeforeCompile = function (shader) {
    shader.uniforms.uTempoErba = tempo;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTempoErba;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          // il vento piega la punta (uv.y = 1 in alto): onda lenta con raffiche
          #ifdef USE_INSTANCING
            vec2 radice = instanceMatrix[3].xz;
          #else
            vec2 radice = vec2(0.0);
          #endif
          float punta = uv.y * uv.y;
          float raffica = sin(uTempoErba * 0.6 + radice.x * 0.02) * 0.5 + 0.5;
          float onda = sin(uTempoErba * 2.4 + radice.x * 0.9 + radice.y * 0.7) * (0.25 + raffica * 0.6);
          transformed.x += onda * punta * 0.13;
          transformed.z += cos(uTempoErba * 2.0 + radice.y * 0.8) * (0.15 + raffica * 0.35) * punta * 0.1;
        }`);
  };
  m.customProgramCacheKey = function () { return "erba-vento"; };
  // le facce non devono sembrare piatte: normale verso l'alto (come l'erba vera, illuminata dall'alto)
  void ambiente;
  MATERIALE = m;
  return m;
}

let GEO = null;
function geometria() {
  if (GEO) return GEO;
  // due piani incrociati, larghi 0.9 e alti 0.55, normali verso l'alto
  const piano = function (rot) {
    const g = new THREE.PlaneGeometry(0.9, 0.55, 1, 2);
    g.translate(0, 0.275, 0);
    g.rotateY(rot);
    return g;
  };
  const a = piano(0), b = piano(Math.PI / 2);
  const merged = new THREE.BufferGeometry();
  const pos = [], uv = [], nor = [], idx = [];
  let base = 0;
  for (const g of [a, b]) {
    pos.push(...g.attributes.position.array);
    uv.push(...g.attributes.uv.array);
    for (let i = 0; i < g.attributes.position.count; i++) nor.push(0, 1, 0);
    for (const i of g.index.array) idx.push(i + base);
    base += g.attributes.position.count;
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  merged.setIndex(idx);
  GEO = merged;
  return GEO;
}

export function creaErba(scena, terreno, strade, edifici, ambiente) {
  return { scena: scena, terreno: terreno, strade: strade, edifici: edifici, ambiente: ambiente, celle: new Map(), attesa: 0, raggio: RAGGIO, statistiche: { ms: 0, celle: 0, ciuffi: 0 } };
}

export function impostaErba(erba, raggio, densita) {
  RAGGIO = raggio;
  DENSITA = densita;
  if (erba) {
    erba.raggio = raggio;
    if (raggio === 0) svuota(erba);
  }
}

function svuota(erba) {
  for (const [, m] of erba.celle) { erba.scena.remove(m); m.geometry && m.dispose && m.dispose(); }
  erba.celle.clear();
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _asse = new THREE.Vector3(0, 1, 0);

function creaCella(erba, cx, cz) {
  const t0 = performance.now();
  const lago = erba.terreno.info.livello_lago;
  const posti = [];
  const seme0 = (cx * 73856093) ^ (cz * 19349663);
  seme = seme0 >>> 0;
  const quanti = Math.round(CIUFFI_PER_CELLA * DENSITA);
  for (let i = 0; i < quanti * 2 && posti.length < quanti; i++) {
    const x = (cx + rnd()) * CELLA, z = (cz + rnd()) * CELLA;
    const y = quotaTerreno(erba.terreno, x, z);
    if (y < lago + 0.6) continue;
    // pendenza: niente erba sulle pareti ripide
    const dx = quotaTerreno(erba.terreno, x + 1.5, z) - y, dz = quotaTerreno(erba.terreno, x, z + 1.5) - y;
    if (Math.hypot(dx, dz) / 1.5 > 0.9) continue;
    const strada = stradaVicina(erba.strade, x, z, 12);
    if (strada !== null && strada.distanza < strada.larghezza / 2 + 1.2) continue;   // fuori dall'asfalto e dal marciapiede
    if (dentroEdificio(erba.edifici, x, z, y + 1)) continue;
    // nel bosco fitto il sottobosco e' fatto dai cespugli degli alberi: qui meno ciuffi
    if (boscoQui(erba.terreno, x, z) && rnd() < 0.6) continue;
    posti.push([x, y, z]);
  }
  if (posti.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geometria(), materiale(erba.ambiente.uniformi.tempo, erba.ambiente), posti.length);
  for (let i = 0; i < posti.length; i++) {
    const [x, y, z] = posti[i];
    const s = 0.7 + rnd() * 1.1;
    _q.setFromAxisAngle(_asse, rnd() * Math.PI * 2);
    _m.compose(_p.set(x, y - 0.03, z), _q, _s.set(s, s * (0.8 + rnd() * 0.6), s));
    mesh.setMatrixAt(i, _m);
    // colore: verdi diversi, qualche ciuffo seccato
    const secco = rnd() < 0.12;
    _c.setRGB(secco ? 1.0 : 0.75 + rnd() * 0.35, secco ? 0.92 : 0.85 + rnd() * 0.3, secco ? 0.55 : 0.6 + rnd() * 0.3);
    mesh.setColorAt(i, _c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  erba.scena.add(mesh);
  erba.statistiche.ms = erba.statistiche.ms * 0.8 + (performance.now() - t0) * 0.2;
  return mesh;
}

// Da chiamare ad ogni fotogramma: una cella al massimo per volta
export function aggiornaErba(erba, x, z, dt) {
  if (erba.raggio <= 0) return;
  erba.attesa -= dt;
  if (erba.attesa > 0) return;
  erba.attesa = 0.12;
  const r = erba.raggio;
  const c0x = Math.floor((x - r) / CELLA), c1x = Math.floor((x + r) / CELLA);
  const c0z = Math.floor((z - r) / CELLA), c1z = Math.floor((z + r) / CELLA);
  let miglior = null, dMin = Infinity;
  for (let cx = c0x; cx <= c1x; cx++) {
    for (let cz = c0z; cz <= c1z; cz++) {
      const d = Math.hypot((cx + 0.5) * CELLA - x, (cz + 0.5) * CELLA - z);
      if (d > r) continue;
      const k = cx + "," + cz;
      if (!erba.celle.has(k) && d < dMin) { dMin = d; miglior = [cx, cz, k]; }
    }
  }
  if (miglior) {
    const mesh = creaCella(erba, miglior[0], miglior[1]);
    erba.celle.set(miglior[2], mesh || { vuota: true });
  }
  // togli le celle lontane
  for (const [k, m] of erba.celle) {
    const [cx, cz] = k.split(",").map(Number);
    if (Math.hypot((cx + 0.5) * CELLA - x, (cz + 0.5) * CELLA - z) > r + 30) {
      if (m && m.isMesh) { erba.scena.remove(m); m.dispose(); }
      erba.celle.delete(k);
    }
  }
  erba.statistiche.celle = erba.celle.size;
}
