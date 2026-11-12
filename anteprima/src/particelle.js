// Particelle morbide dietro la moto: fumo delle gomme (derapate e frenate forti), polvere fuori strada,
// spruzzi d'acqua sull'asfalto bagnato. Un unico gruppo di punti con un programma della scheda video
// (un solo disegno per tutte le particelle), con 360 posti che si riutilizzano.
// Non tocca la fisica: legge solo la posizione e lo stato della moto.

import * as THREE from "three";

const MAX = 360;

const VERTICE = `
  attribute float aDimensione;
  attribute float aVita;      // 0 appena nata, 1 sparita
  attribute vec3 aColore;
  uniform float uScala;       // altezza schermo in pixel / (2 * tan(fov/2))
  varying float vVita;
  varying vec3 vColore;
  varying float vTipo;
  void main() {
    vVita = aVita;
    vColore = aColore;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aVita >= 1.0 ? 0.0 : clamp(aDimensione * uScala / max(-mv.z, 0.5), 0.0, 260.0);
  }`;

const FRAMMENTO = `
  uniform vec3 uLuce;
  uniform vec3 uNebbia;
  varying float vVita;
  varying vec3 vColore;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    // bordo morbido con un po' di grana: sembra fumo, non un cerchio
    float grana = h(floor(gl_PointCoord * 9.0) + floor(vVita * 5.0)) * 0.25;
    float forma = smoothstep(1.0, 0.25, r + grana * r);
    float alfa = forma * (1.0 - vVita) * (1.0 - vVita) * 0.55;
    gl_FragColor = vec4(vColore * uLuce, alfa);
    #include <colorspace_fragment>
  }`;

export function creaParticelle(scena) {
  const pos = new Float32Array(MAX * 3);
  const dim = new Float32Array(MAX);
  const vita = new Float32Array(MAX).fill(1);
  const col = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aDimensione", new THREE.BufferAttribute(dim, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aVita", new THREE.BufferAttribute(vita, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aColore", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const uniformi = { uScala: { value: 600 }, uLuce: { value: new THREE.Color(1, 1, 1) }, uNebbia: { value: new THREE.Color() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uniformi, vertexShader: VERTICE, fragmentShader: FRAMMENTO,
    transparent: true, depthWrite: false, fog: false
  });
  const punti = new THREE.Points(geo, mat);
  punti.frustumCulled = false;
  punti.renderOrder = 3;
  scena.add(punti);

  // stato per particella (non serve alla scheda video)
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const durata = new Float32Array(MAX).fill(1);
  const crescita = new Float32Array(MAX);
  const dim0 = new Float32Array(MAX);
  const salita = new Float32Array(MAX);
  let prossima = 0;
  let resto = { fumo: 0, polvere: 0, spruzzo: 0 };
  let seme = 99;
  const rnd = function () { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296; };

  function nasce(x, y, z, ux, uy, uz, d, tempo, cresc, colore, sale) {
    const i = prossima;
    prossima = (prossima + 1) % MAX;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vx[i] = ux; vy[i] = uy; vz[i] = uz;
    dim0[i] = d; dim[i] = d; durata[i] = tempo; crescita[i] = cresc; salita[i] = sale;
    vita[i] = 0;
    col[i * 3] = colore[0]; col[i * 3 + 1] = colore[1]; col[i * 3 + 2] = colore[2];
  }

  return { punti: punti, uniformi: uniformi, nasce: nasce, rnd: rnd, resto: resto, pos: pos, dim: dim, vita: vita, vx: vx, vy: vy, vz: vz, durata: durata, crescita: crescita, dim0: dim0, salita: salita, geo: geo, MAX: MAX };
}

const FUMO = [0.86, 0.86, 0.88];
const POLVERE = [0.62, 0.55, 0.43];
const SPRUZZO = [0.8, 0.86, 0.92];

// sgomma = true quando la ruota dietro lascia il segno nero (derapata o frenata forte)
export function aggiornaParticelle(s, moto, dt, ambiente, telecamera, altezzaSchermo, sgomma) {
  const u = s.uniformi;
  u.uScala.value = altezzaSchermo / (2 * Math.tan(telecamera.fov * Math.PI / 360));
  // luce delle particelle: segue sole e cielo (di notte scure)
  const giorno = 1 - ambiente.uniformi.notte.value * 0.85;
  u.uLuce.value.copy(ambiente.colore.sole).lerp(ambiente.hemi.color, 0.5).multiplyScalar(0.55 + 0.45 * giorno).multiplyScalar(giorno * 0.9 + 0.12);

  // invecchiamento e movimento
  const n = s.MAX;
  let vive = 0;
  for (let i = 0; i < n; i++) {
    if (s.vita[i] >= 1) continue;
    vive++;
    s.vita[i] = Math.min(1, s.vita[i] + dt / s.durata[i]);
    s.pos[i * 3] += s.vx[i] * dt;
    s.pos[i * 3 + 1] += (s.vy[i] + s.salita[i]) * dt;
    s.pos[i * 3 + 2] += s.vz[i] * dt;
    const freno = Math.max(0, 1 - dt * 1.6);
    s.vx[i] *= freno; s.vz[i] *= freno; s.vy[i] *= Math.max(0, 1 - dt * 0.8);
    s.dim[i] = s.dim0[i] * (1 + s.crescita[i] * s.vita[i]);
  }

  // emissione (solo se la moto e' in gioco e a terra)
  const v = Math.abs(moto.velocita);
  const aTerra = !moto.inAria && moto.caduta <= 0;
  const passoMezzo = (moto.modello && moto.modello.userData.passo ? moto.modello.userData.passo : 1.4) / 2;
  const ang = moto.angolo + (moto.derapata || 0);
  const dirX = -Math.sin(ang), dirZ = -Math.cos(ang);
  const px = moto.x - dirX * passoMezzo, pz = moto.z - dirZ * passoMezzo;
  const r = s.rnd;
  const resto = s.resto;
  if (aTerra && sgomma) {
    resto.fumo += dt * (22 + Math.min(40, v));
    while (resto.fumo >= 1) {
      resto.fumo -= 1;
      s.nasce(px + (r() - 0.5) * 0.25, moto.y + 0.12, pz + (r() - 0.5) * 0.25, -dirX * v * 0.08 + (r() - 0.5) * 0.9, 0.2, -dirZ * v * 0.08 + (r() - 0.5) * 0.9,
        0.7 + r() * 0.5, 1.6 + r() * 0.8, 2.4, FUMO, 0.45 + r() * 0.35);
    }
  }
  if (aTerra && !moto.suStrada && v > 4) {
    resto.polvere += dt * Math.min(60, v * 1.6);
    while (resto.polvere >= 1) {
      resto.polvere -= 1;
      s.nasce(px + (r() - 0.5) * 0.5, moto.y + 0.1, pz + (r() - 0.5) * 0.5, -dirX * v * 0.1 + (r() - 0.5) * 1.6, 0.4 + r() * 0.5, -dirZ * v * 0.1 + (r() - 0.5) * 1.6,
        0.55 + r() * 0.6, 1.8 + r(), 1.5 + r() * 0.8, POLVERE, 0.3);
    }
  }
  const bagnato = ambiente.uniformi.bagnato.value;
  if (aTerra && moto.suStrada && bagnato > 0.3 && v > 12) {
    resto.spruzzo += dt * (v - 8) * bagnato * 1.1;
    while (resto.spruzzo >= 1) {
      resto.spruzzo -= 1;
      s.nasce(px + (r() - 0.5) * 0.3, moto.y + 0.08, pz + (r() - 0.5) * 0.3, -dirX * v * 0.05 + (r() - 0.5) * 1.4, 0.6 + r() * 0.9, -dirZ * v * 0.05 + (r() - 0.5) * 1.4,
        0.3 + r() * 0.3, 1.2, 0.9, SPRUZZO, -0.4);
    }
  }
  void vive;   // il gruppo resta sempre visibile: cosi' il programma grafico e' gia' compilato quando serve
  s.geo.attributes.position.needsUpdate = true;
  s.geo.attributes.aDimensione.needsUpdate = true;
  s.geo.attributes.aVita.needsUpdate = true;
  s.geo.attributes.aColore.needsUpdate = true;
}
