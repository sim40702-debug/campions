// Ambiente: ora del giorno, sole e luna, cielo, nuvole, stelle, nebbia e meteo.
// Tutto il resto del gioco legge da qui "quanto e' notte" (ambiente.uniformi.notte) per accendere
// finestre, lampioni e fari: cosi' una sola variabile cambia l'intera atmosfera.

import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";

const LATITUDINE = 46.17 * Math.PI / 180;   // Locarno
const DECLINAZIONE = 14 * Math.PI / 180;    // sole di fine estate / inizio autunno

// Quanto e' "notte" e valori per ogni altezza del sole (gradi sull'orizzonte)
// el = altezza, poi: colore del sole, intensita', cielo emisfero, terra emisfero, intensita' emisfero,
// nebbia, esposizione, riflessi
const PUNTI = [
  { el: -18, sole: 0x7f98d8, ints: 0.28, cielo: 0x1b2a4a, terra: 0x0c1018, hemi: 0.55, nebbia: 0x0a1222, espo: 1.55, env: 0.22 },
  { el: -6, sole: 0x8aa2e0, ints: 0.3, cielo: 0x2c3a62, terra: 0x151a22, hemi: 0.6, nebbia: 0x25304e, espo: 1.5, env: 0.25 },
  { el: -1, sole: 0xff8a50, ints: 0.9, cielo: 0x6b6a8a, terra: 0x3a3030, hemi: 0.75, nebbia: 0xc58a78, espo: 1.3, env: 0.3 },
  { el: 5, sole: 0xffb070, ints: 1.7, cielo: 0xa6b4d0, terra: 0x55503a, hemi: 0.95, nebbia: 0xe2b494, espo: 1.2, env: 0.34 },
  { el: 15, sole: 0xffdcb0, ints: 2.7, cielo: 0xcfe0f6, terra: 0x586338, hemi: 0.95, nebbia: 0xb9d0e8, espo: 1.15, env: 0.36 },
  { el: 40, sole: 0xfff0d8, ints: 3.0, cielo: 0xd2e6ff, terra: 0x4a5a3a, hemi: 1.0, nebbia: 0xa9c8e8, espo: 1.0, env: 0.42 },
  { el: 70, sole: 0xfff4e2, ints: 3.1, cielo: 0xd6e8ff, terra: 0x4a5a3a, hemi: 1.02, nebbia: 0xa4c4e6, espo: 0.98, env: 0.42 }
];

// Condizioni atmosferiche. nuvole = copertura, nebbia = quanta visibilita' resta, sole = quanta luce diretta,
// grigio = cielo spento, pioggia/neve = intensita' della precipitazione (0-1)
const METEO = {
  sereno: { nome: "Sereno", nuvole: 0.15, nebbia: 1.0, sole: 1.0, grigio: 0.0, pioggia: 0, neve: 0 },
  variabile: { nome: "Parzialmente nuvoloso", nuvole: 0.5, nebbia: 0.95, sole: 0.85, grigio: 0.1, pioggia: 0, neve: 0 },
  nuvoloso: { nome: "Nuvoloso", nuvole: 0.9, nebbia: 0.7, sole: 0.4, grigio: 0.55, pioggia: 0, neve: 0 },
  nebbia: { nome: "Nebbia", nuvole: 0.7, nebbia: 0.2, sole: 0.3, grigio: 0.45, pioggia: 0, neve: 0 },
  pioggia_leggera: { nome: "Pioggia leggera", nuvole: 0.85, nebbia: 0.6, sole: 0.3, grigio: 0.65, pioggia: 0.35, neve: 0 },
  pioggia_intensa: { nome: "Pioggia intensa", nuvole: 1.0, nebbia: 0.38, sole: 0.12, grigio: 0.9, pioggia: 1, neve: 0 },
  neve_leggera: { nome: "Neve leggera", nuvole: 0.9, nebbia: 0.5, sole: 0.28, grigio: 0.65, pioggia: 0, neve: 0.35 },
  neve_intensa: { nome: "Neve intensa", nuvole: 1.0, nebbia: 0.25, sole: 0.1, grigio: 0.8, pioggia: 0, neve: 1 }
};
export const ELENCO_METEO = Object.keys(METEO).map(function (k) { return { chiave: k, nome: METEO[k].nome }; })
  .concat([{ chiave: "auto", nome: "Automatico" }]);

// Geografia e stagione del Ticino (per mese, gennaio = 0):
// - quota della neve permanente sui monti (sopra questa quota c'e' neve anche senza nevicare);
// - quota alla quale nevica con le perturbazioni (sotto piove). Locarno (200 m) vede la neve solo in pieno inverno.
const NEVE_PERMANENTE = [1300, 1350, 1550, 1950, 2450, 2850, 3150, 3150, 2850, 2350, 1800, 1400];
const NEVE_CADUTA = [450, 550, 850, 1400, 1950, 2500, 2900, 2900, 2200, 1600, 1000, 550];

const CHIAVE_ORA = "mrw-ora";
const CHIAVE_METEO = "mrw-meteo";
const CHIAVE_REALISTICO = "mrw-meteo-realistico";
const CHIAVE_CICLO = "mrw-ciclo";

function leggi(chiave, difetto) {
  try {
    const v = localStorage.getItem(chiave);
    if (v !== null && v !== "") return v;
  } catch (errore) {
    // memoria non disponibile
  }
  return difetto;
}
function scrivi(chiave, valore) {
  try {
    localStorage.setItem(chiave, String(valore));
  } catch (errore) {
    // non importa
  }
}

function mescola(a, b, t, ris) {
  ris.copy(a).lerp(b, t);
  return ris;
}

// --- Nuvole: un grande piano sopra la telecamera con rumore frattale calcolato dalla scheda video ---
const VERTICE_NUVOLE = `
  varying vec3 vMondo;
  void main() {
    vec4 m = modelMatrix * vec4(position, 1.0);
    vMondo = m.xyz;
    gl_Position = projectionMatrix * viewMatrix * m;
  }`;
const FRAMMENTO_NUVOLE = `
  uniform float uTempo;
  uniform float uCopertura;
  uniform vec3 uColoreChiaro;
  uniform vec3 uColoreScuro;
  uniform vec3 uCentro;
  uniform vec3 uSole;
  varying vec3 vMondo;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rum(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * rum(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
  void main() {
    vec2 p = vMondo.xz * 0.00045 + vec2(uTempo * 0.004, uTempo * 0.0016);
    float d = fbm(p);
    float soglia = 1.0 - uCopertura * 0.62;
    float nuvola = smoothstep(soglia - 0.1, soglia + 0.17, d);
    // lato verso il sole piu' chiaro, centro piu' denso e scuro
    float d2 = fbm(p + uSole.xz * 0.05);
    float luce = clamp(0.5 + (d - d2) * 3.2, 0.0, 1.0);
    vec3 colore = mix(uColoreScuro, uColoreChiaro, luce);
    // sfuma verso l'orizzonte (e dove il piano finisce)
    vec2 rel = vMondo.xz - uCentro.xz;
    float dist = length(rel);
    float sfuma = 1.0 - smoothstep(2200.0, 5200.0, dist);
    // strato alto di cirri: strisce sottili e chiare, piu' visibili con poche nuvole basse
    vec2 pc = vec2(p.x * 0.35 + p.y * 0.15, p.y * 1.9) + vec2(uTempo * 0.0015, 0.0);
    float cirro = smoothstep(0.52, 0.86, fbm(pc * 2.2)) * (1.0 - uCopertura * 0.55) * 0.34 * sfuma;
    float a0 = nuvola * sfuma * 0.92;
    float a = a0 + cirro * (1.0 - a0);
    vec3 col = (colore * a0 + uColoreChiaro * cirro * (1.0 - a0)) / max(a, 1e-4);
    gl_FragColor = vec4(col, a);
  }`;

export function creaAmbiente(scena, disegnatore, sole, hemi, telecamera) {
  const cielo = new Sky();
  cielo.scale.setScalar(6000);
  cielo.material.uniforms.turbidity.value = 4;
  cielo.material.uniforms.rayleigh.value = 1.2;
  cielo.material.uniforms.mieCoefficient.value = 0.004;
  cielo.material.uniforms.mieDirectionalG.value = 0.8;
  scena.add(cielo);

  // Stelle: 1400 punti su una sfera, visibili solo di notte
  const posStelle = [];
  const colStelle = [];
  let s = 4242;
  const casuale = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 1400; i++) {
    const u = casuale() * 2 - 1;
    const f = casuale() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    if (u < -0.05) continue;
    posStelle.push(r * Math.cos(f) * 4800, u * 4800, r * Math.sin(f) * 4800);
    const k = 0.55 + casuale() * 0.45;
    colStelle.push(k, k * (0.9 + casuale() * 0.1), k);
  }
  const geoStelle = new THREE.BufferGeometry();
  geoStelle.setAttribute("position", new THREE.Float32BufferAttribute(posStelle, 3));
  geoStelle.setAttribute("color", new THREE.Float32BufferAttribute(colStelle, 3));
  const matStelle = new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false
  });
  const stelle = new THREE.Points(geoStelle, matStelle);
  stelle.frustumCulled = false;
  stelle.renderOrder = -1;
  scena.add(stelle);

  // Luna: un disco morbido nel cielo
  const telaLuna = document.createElement("canvas");
  telaLuna.width = telaLuna.height = 128;
  const cl = telaLuna.getContext("2d");
  const gl = cl.createRadialGradient(64, 64, 4, 64, 64, 64);
  gl.addColorStop(0, "rgba(255,255,245,1)");
  gl.addColorStop(0.28, "rgba(240,244,255,0.95)");
  gl.addColorStop(0.34, "rgba(200,215,255,0.35)");
  gl.addColorStop(1, "rgba(150,180,255,0)");
  cl.fillStyle = gl;
  cl.fillRect(0, 0, 128, 128);
  const matLuna = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(telaLuna), transparent: true, fog: false, depthWrite: false, opacity: 0 });
  const luna = new THREE.Sprite(matLuna);
  luna.scale.setScalar(520);
  luna.renderOrder = -1;
  scena.add(luna);

  // Nuvole
  const uniformiNuvole = {
    uTempo: { value: 0 }, uCopertura: { value: 0.3 },
    uColoreChiaro: { value: new THREE.Color(1, 1, 1) }, uColoreScuro: { value: new THREE.Color(0.6, 0.65, 0.75) },
    uCentro: { value: new THREE.Vector3() }, uSole: { value: new THREE.Vector3(0, 1, 0) }
  };
  const nuvole = new THREE.Mesh(
    new THREE.PlaneGeometry(12000, 12000, 1, 1).rotateX(Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: uniformiNuvole, vertexShader: VERTICE_NUVOLE, fragmentShader: FRAMMENTO_NUVOLE,
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide
    })
  );
  nuvole.frustumCulled = false;
  nuvole.renderOrder = -1;
  scena.add(nuvole);

  const ambiente = {
    ora: parseFloat(leggi(CHIAVE_ORA, "14")),
    meteo: leggi(CHIAVE_METEO, "sereno"),
    realistico: leggi(CHIAVE_REALISTICO, "1") === "1",   // la neve dipende da quota e stagione
    mese: new Date().getMonth(),
    meteoAttivo: "sereno",
    pioggia: 0, neve: 0,                                 // intensita' attuale delle particelle (con transizione)
    sottoCopertura: 0,                                   // in galleria niente pioggia
    ciclo: leggi(CHIAVE_CICLO, "0") === "1",
    cielo: cielo, stelle: stelle, luna: luna, nuvole: nuvole,
    sole: sole, hemi: hemi, scena: scena, disegnatore: disegnatore, telecamera: telecamera,
    uniformi: {
      notte: { value: 0 }, tempo: { value: 0 },
      bagnato: { value: 0 },                 // 0-1: asfalto e superfici bagnati
      neveDin: { value: 0 },                 // 0-1: neve caduta (si accumula e si scioglie)
      quotaNeveDin: { value: 1000 },         // m: sotto questa quota la neve caduta non c'e'
      quotaNeveFissa: { value: 2800 }        // m: neve permanente di stagione
    },   // condiviso dai materiali (finestre, lampioni, vento)
    direzioneSole: new THREE.Vector3(-0.5, 1, 0.3).normalize(),
    direzioneLuce: new THREE.Vector3(-0.5, 1, 0.3).normalize(),
    qualitaNuvole: true,
    quota: 1.0,
    visibilita: 7000,
    tempo: 0,
    sporco: true,
    // valori calcolati (altri moduli li leggono)
    colore: { nebbia: new THREE.Color(), sole: new THREE.Color() },
    elevazione: 30,
    uniformiNuvole: uniformiNuvole,
    osservatori: []           // funzioni chiamate ad ogni fotogramma (lampioni, ecc.)
  };
  if (!METEO[ambiente.meteo] && ambiente.meteo !== "auto") ambiente.meteo = "variabile";
  if (!(ambiente.ora >= 0 && ambiente.ora < 24)) ambiente.ora = 14;
  aggiornaAmbiente(ambiente, 0, new THREE.Vector3());
  return ambiente;
}

// Altezza e direzione del sole per l'ora data (0-24)
export function posizioneSole(ora, ris) {
  const h = (ora - 12) * 15 * Math.PI / 180;
  const sinEl = Math.sin(LATITUDINE) * Math.sin(DECLINAZIONE) + Math.cos(LATITUDINE) * Math.cos(DECLINAZIONE) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // azimut dal nord in senso orario
  const cosAz = (Math.sin(DECLINAZIONE) - Math.sin(el) * Math.sin(LATITUDINE)) / (Math.cos(el) * Math.cos(LATITUDINE) || 1e-6);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (h > 0) az = Math.PI * 2 - az;
  // x = est, y = su, z = sud
  ris.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
  return el * 180 / Math.PI;
}

const _a = new THREE.Color();
const _b = new THREE.Color();
const _c = new THREE.Color();
const _v = new THREE.Vector3();

function punto(elevazione, chiave) {
  // interpolazione tra i punti chiave in base all'altezza del sole
  let i = 0;
  while (i < PUNTI.length - 2 && elevazione > PUNTI[i + 1].el) i++;
  const p0 = PUNTI[i];
  const p1 = PUNTI[i + 1];
  const t = Math.min(1, Math.max(0, (elevazione - p0.el) / (p1.el - p0.el)));
  if (typeof p0[chiave] === "number" && chiave !== "sole" && chiave !== "cielo" && chiave !== "terra" && chiave !== "nebbia") {
    return p0[chiave] + (p1[chiave] - p0[chiave]) * t;
  }
  _a.setHex(p0[chiave]);
  _b.setHex(p1[chiave]);
  return _c.copy(_a).lerp(_b, t);
}

// Da chiamare ad ogni fotogramma (dt = secondi veri)
export function aggiornaAmbiente(amb, dt, posizioneCamera) {
  if (amb.ciclo) {
    amb.ora = (amb.ora + dt / 20) % 24;   // un giorno intero in 8 minuti
  }
  amb.tempo += dt;
  amb.uniformi.tempo.value = amb.tempo;
  const obiettivo = METEO[meteoEffettivo(amb)];
  aggiornaPrecipitazioni(amb, obiettivo, dt, posizioneCamera);
  // transizione dolce del meteo: nuvole, nebbia, sole e grigio si avvicinano al nuovo valore in qualche secondo
  // (prima cambiavano di colpo quando si sceglieva un altro meteo)
  if (!amb.mix) amb.mix = { nuvole: obiettivo.nuvole, nebbia: obiettivo.nebbia, sole: obiettivo.sole, grigio: obiettivo.grigio };
  const kMix = amb.mix.pronto ? Math.min(1, dt * 0.45) : 1;
  amb.mix.pronto = true;
  for (const k of ["nuvole", "nebbia", "sole", "grigio"]) amb.mix[k] += (obiettivo[k] - amb.mix[k]) * kMix;
  const meteo = Object.assign({}, obiettivo, { nuvole: amb.mix.nuvole, nebbia: amb.mix.nebbia, sole: amb.mix.sole, grigio: amb.mix.grigio });

  const elevazione = posizioneSole(amb.ora, amb.direzioneSole);
  amb.elevazione = elevazione;
  // Notte: 0 di giorno, 1 quando il sole e' sotto -4 gradi (sfuma nel crepuscolo)
  const notte = Math.min(1, Math.max(0, (4 - elevazione) / 9));
  amb.uniformi.notte.value = notte;

  // luce principale: sole di giorno, luna di notte
  let intensita = punto(elevazione, "ints") * (0.35 + 0.65 * meteo.sole);
  amb.colore.sole.copy(punto(elevazione, "sole"));
  const direzione = amb.direzioneLuce;
  if (elevazione > -3) {
    direzione.copy(amb.direzioneSole);
    if (direzione.y < 0.12) direzione.y = 0.12;   // il sole basso non va sotto l'orizzonte per le ombre
    direzione.normalize();
  } else {
    // luna: opposta al sole
    direzione.set(-amb.direzioneSole.x * 0.6 + 0.2, Math.max(0.45, -amb.direzioneSole.y), -amb.direzioneSole.z * 0.6 + 0.2).normalize();
  }
  amb.sole.color.copy(amb.colore.sole);
  amb.sole.intensity = intensita;

  // grigio del meteo: toglie colore al cielo
  const grigio = meteo.grigio;
  amb.hemi.color.copy(punto(elevazione, "cielo")).lerp(_a.setHex(0x9aa3ad), grigio * 0.6);
  amb.hemi.groundColor.copy(punto(elevazione, "terra"));
  amb.hemi.intensity = punto(elevazione, "hemi") * (1 + grigio * 0.15);
  amb.colore.nebbia.copy(punto(elevazione, "nebbia")).lerp(_a.setHex(0xa8b0b8).multiplyScalar(1 - notte * 0.85), grigio * 0.7);
  amb.disegnatore.toneMappingExposure = punto(elevazione, "espo");
  amb.scena.environmentIntensity = punto(elevazione, "env") * (1 - notte * 0.4) * (1 - 0.5 * meteo.grigio);

  // nebbia: colore e distanza
  const dist = amb.visibilita * meteo.nebbia;
  amb.scena.fog.color.copy(amb.colore.nebbia);
  amb.scena.fog.near = dist * 0.18;
  amb.scena.fog.far = dist;
  amb.scena.background = amb.colore.nebbia;

  // cielo (scattering): torbido con meteo cattivo
  const u = amb.cielo.material.uniforms;
  u.sunPosition.value.copy(amb.direzioneSole);
  u.turbidity.value = 3 + grigio * 14;
  u.rayleigh.value = 1.1 + grigio * 0.9 + (1 - notte) * 0.2;
  u.mieCoefficient.value = 0.004 + grigio * 0.02;
  u.mieDirectionalG.value = 0.8;

  // posizioni dipendenti dalla telecamera
  amb.cielo.position.copy(posizioneCamera);
  amb.stelle.position.copy(posizioneCamera);
  amb.stelle.material.opacity = Math.max(0, notte - 0.35) / 0.65 * (1 - meteo.nuvole * 0.55 * (amb.meteoAttivo === "sereno" ? 0 : 1));
  // luna: nel cielo opposta al sole (solo quando il sole e' basso)
  const lunaDir = _v.set(-amb.direzioneSole.x, Math.max(0.25, -amb.direzioneSole.y + 0.15), -amb.direzioneSole.z).normalize();
  amb.luna.position.copy(posizioneCamera).addScaledVector(lunaDir, 4500);
  amb.luna.material.opacity = Math.max(0, notte - 0.25) / 0.75 * (amb.meteoAttivo === "nebbia" ? 0.3 : 1);

  // nuvole
  amb.nuvole.visible = amb.qualitaNuvole;
  if (amb.qualitaNuvole) {
    amb.nuvole.position.set(posizioneCamera.x, 1500, posizioneCamera.z);
    const un = amb.uniformiNuvole;
    un.uTempo.value = amb.tempo;
    un.uCopertura.value = meteo.nuvole;
    un.uCentro.value.copy(amb.nuvole.position);
    un.uSole.value.copy(amb.direzioneSole);
    // chiare al tramonto (rosa), scure di notte
    un.uColoreChiaro.value.copy(amb.colore.nebbia).lerp(_a.setHex(0xffffff), 0.55 * (1 - notte)).multiplyScalar(1 - notte * 0.8);
    un.uColoreScuro.value.copy(un.uColoreChiaro.value).multiplyScalar(0.62 - grigio * 0.18).lerp(amb.colore.nebbia, 0.15);
  }
  for (const f of amb.osservatori) f(amb);
}

// Ombre che seguono la moto (il sole sta sulla direzione della luce).
// Due accorgimenti per le ombre mentre si guida:
//  1) il rettangolo delle ombre e' spostato AVANTI (verso dove guarda la moto), perche' la strada davanti conta piu' di quella dietro;
//  2) il centro si aggancia alla griglia dei pixel della mappa delle ombre (nello spazio della luce): senza questo i bordi
//     delle ombre "brulicano" a ogni movimento (shadow shimmering).
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3();
export function posizionaLuce(amb, x, y, z, avantiX, avantiZ) {
  const d = amb.direzioneLuce;
  const area = amb.sole.shadow.camera.right || 40;
  const cx = x + (avantiX || 0) * area * 0.32, cz = z + (avantiZ || 0) * area * 0.32;
  _r.crossVectors(_up, d).normalize();
  _u.crossVectors(d, _r).normalize();
  const texel = 2 * area / Math.max(1, amb.sole.shadow.mapSize.x);
  _p.set(cx, y, cz);
  const pr = _p.dot(_r), pu = _p.dot(_u);
  const sr = Math.round(pr / texel) * texel, su = Math.round(pu / texel) * texel;
  _p.addScaledVector(_r, sr - pr).addScaledVector(_u, su - pu);
  amb.sole.target.position.copy(_p);
  amb.sole.position.set(_p.x + d.x * 120, _p.y + d.y * 120, _p.z + d.z * 120);
}

export function impostaOra(amb, ora) {
  amb.ora = ((ora % 24) + 24) % 24;
  scrivi(CHIAVE_ORA, amb.ora.toFixed(2));
}
export function impostaMeteo(amb, chiave) {
  if (!METEO[chiave] && chiave !== "auto") return;
  amb.meteo = chiave;
  scrivi(CHIAVE_METEO, chiave);
}
export function impostaCiclo(amb, attivo) {
  amb.ciclo = attivo;
  scrivi(CHIAVE_CICLO, attivo ? "1" : "0");
  scrivi(CHIAVE_ORA, amb.ora.toFixed(2));
}
export function oraSalvata(amb) {
  scrivi(CHIAVE_ORA, amb.ora.toFixed(2));
}
export function testoOra(ora) {
  const h = Math.floor(ora);
  const m = Math.floor((ora - h) * 60);
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}
export function descrizioneMomento(amb) {
  const e = amb.elevazione;
  if (e < -6) return "Notte";
  if (e < 4) return amb.ora < 12 ? "Alba" : "Tramonto";
  if (e < 20) return amb.ora < 12 ? "Mattino" : "Sera";
  return "Giorno";
}

export function impostaMeteoRealistico(amb, si) {
  amb.realistico = si;
  scrivi(CHIAVE_REALISTICO, si ? "1" : "0");
}

// Meteo automatico: ogni 10 minuti veri una nuova situazione, scelta in modo ripetibile dal giorno e dal mese.
// D'inverno piu' neve e nebbia, d'estate piu' sole e temporali; la quota decide poi se cade pioggia o neve.
function casuale01(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function meteoAutomatico(mese, data) {
  const freddo = (Math.cos((mese - 0.5) / 12 * Math.PI * 2) + 1) / 2;   // 1 in inverno, 0 in estate
  const pesi = {
    sereno: 0.34 - 0.1 * freddo, variabile: 0.22, nuvoloso: 0.14, nebbia: 0.03 + 0.07 * freddo,
    pioggia_leggera: 0.14 * (1 - freddo * 0.4), pioggia_intensa: 0.08 * (1 - freddo * 0.5),
    neve_leggera: 0.12 * freddo * freddo, neve_intensa: 0.06 * freddo * freddo
  };
  const fascia = Math.floor(data / 600000);
  let r = casuale01(fascia) * Object.values(pesi).reduce(function (a, b) { return a + b; }, 0);
  for (const k of Object.keys(pesi)) {
    r -= pesi[k];
    if (r <= 0) return k;
  }
  return "sereno";
}
export function meteoEffettivo(amb) {
  amb.meteoAttivo = amb.meteo === "auto" ? meteoAutomatico(amb.mese, Date.now()) : amb.meteo;
  return amb.meteoAttivo;
}
export function quotaNeveCaduta(amb) {
  return amb.realistico ? NEVE_CADUTA[amb.mese] : 120;
}

// Precipitazioni con transizione graduale. Pioggia o neve dipendono dalla quota della telecamera:
// con una perturbazione "da neve" sotto la quota di caduta piove, sopra nevica.
// Asfalto bagnato e neve a terra si accumulano e si sciolgono piano.
function aggiornaPrecipitazioni(amb, meteo, dt, cam) {
  const quotaCad = quotaNeveCaduta(amb);
  const perturbazione = Math.max(meteo.pioggia, meteo.neve);
  const sopraNeve = cam.y >= quotaCad;
  let pioggiaVoluta = meteo.pioggia > 0 ? meteo.pioggia : (meteo.neve > 0 && !sopraNeve ? meteo.neve * 0.7 : 0);
  let neveVoluta = meteo.neve > 0 && sopraNeve ? meteo.neve : 0;
  // una perturbazione "da pioggia" sopra la quota di neve porta neve (pioggia che diventa neve in quota)
  if (meteo.pioggia > 0 && cam.y > NEVE_CADUTA[amb.mese] + 600 && amb.realistico) {
    neveVoluta = meteo.pioggia * 0.8;
    pioggiaVoluta = 0;
  }
  const copertura = 1 - amb.sottoCopertura;
  const k = Math.min(1, dt * 0.5);
  amb.pioggia += (pioggiaVoluta * copertura - amb.pioggia) * k;
  amb.neve += (neveVoluta * copertura - amb.neve) * k;
  const u = amb.uniformi;
  // asfalto: si bagna in fretta, si asciuga in qualche minuto
  const bagnato = pioggiaVoluta > 0 ? Math.min(1, 0.35 + pioggiaVoluta * 0.8) : 0;
  u.bagnato.value += (bagnato - u.bagnato.value) * Math.min(1, dt * (bagnato > u.bagnato.value ? 0.12 : 0.02));
  // neve a terra: si accumula mentre nevica in alto, si scioglie piano
  u.quotaNeveFissa.value = NEVE_PERMANENTE[amb.mese];
  if (perturbazione > 0) {
    // quota della neve caduta: quella di stagione (la pioggia in quota diventa neve)
    u.quotaNeveDin.value += (quotaCad - u.quotaNeveDin.value) * Math.min(1, dt * 0.3);
  }
  const accumulo = meteo.neve > 0 ? 0.012 + 0.03 * meteo.neve : (meteo.pioggia > 0 && amb.realistico ? 0.005 * meteo.pioggia : 0);
  u.neveDin.value = Math.max(0, Math.min(1, u.neveDin.value + (accumulo - (accumulo > 0 ? 0 : 0.004)) * dt));
}

// Cambia il meteo senza ricordarlo (benchmark e prove)
export function impostaMeteoSenzaSalvare(amb, chiave) {
  if (METEO[chiave] || chiave === "auto") { amb.meteo = chiave; amb.mix = null; }   // senza transizione
}
