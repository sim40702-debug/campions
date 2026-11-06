// Alberi: nei boschi di OpenStreetMap e gli alberi singoli mappati.
// I boschi sono enormi: gli alberi si creano SOLO vicino alla moto (celle da 250 m)
// e si tolgono quando ci si allontana. Da lontano il bosco si vede dal colore del terreno.

import * as THREE from "three";
import { quotaTerreno, boscoQui } from "./terreno.js";
import { stradaSotto } from "./strade.js";
import { dentroEdificio } from "./edifici.js";

const CELLA = 250;            // metri
let RAGGIO = 900;             // fino a che distanza ci sono gli alberi (impostazioni)
let ALBERI_PER_CELLA = 650;   // tentativi per cella (circa 1 albero ogni 100 m2)
const QUOTA_CONIFERE = 1100;  // sopra questa quota: abeti e larici

function creaForma(chioma, coloreChioma) {
  // Un albero = tronco + chioma, in una sola geometria con i colori
  const tronco = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6);
  tronco.translate(0, 1.2, 0);
  chioma.translate(0, 2.2, 0);
  const parti = [tronco, chioma];
  const colori = [new THREE.Color(0x5a4430), new THREE.Color(coloreChioma)];
  const posizioni = [];
  const coloriVertici = [];
  for (let k = 0; k < parti.length; k++) {
    const g = parti[k].toNonIndexed();
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      posizioni.push(pos[i], pos[i + 1], pos[i + 2]);
      coloriVertici.push(colori[k].r, colori[k].g, colori[k].b);
    }
  }
  const forma = new THREE.BufferGeometry();
  forma.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  forma.setAttribute("color", new THREE.Float32BufferAttribute(coloriVertici, 3));
  forma.computeVertexNormals();
  return forma;
}

const chiomaLatifoglia = new THREE.IcosahedronGeometry(2.6, 0);
chiomaLatifoglia.scale(1, 1.25, 1);
chiomaLatifoglia.translate(0, 2.4, 0);
const FORMA_LATIFOGLIA = creaForma(chiomaLatifoglia, 0x3f6b2c);

const chiomaConifera = new THREE.ConeGeometry(2.0, 7, 7);
chiomaConifera.translate(0, 3.2, 0);
const FORMA_CONIFERA = creaForma(chiomaConifera, 0x2c4a2a);

const MATERIALE = new THREE.MeshLambertMaterial({ vertexColors: true });

// Numeri casuali "fissi": la stessa cella ha sempre gli stessi alberi
function casuale(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function postoLibero(mondo, x, z) {
  const y = quotaTerreno(mondo.terreno, x, z);
  if (y < mondo.terreno.info.livello_lago + 0.5) return null;   // lago
  if (stradaSotto(mondo.strade, x, z, y) !== null) return null;  // strada
  if (dentroEdificio(mondo.edifici, x, z, y + 1)) return null;  // edificio
  return y;
}

function creaCella(mondo, cx, cz) {
  const latifoglie = [];
  const conifere = [];
  const rnd = casuale(cx * 73856093 ^ cz * 19349663);

  // Alberi nel bosco
  for (let i = 0; i < ALBERI_PER_CELLA; i++) {
    const x = (cx + rnd()) * CELLA;
    const z = (cz + rnd()) * CELLA;
    const scala = 0.7 + rnd() * 0.8;
    const giro = rnd() * Math.PI * 2;
    if (!boscoQui(mondo.terreno, x, z)) continue;
    const y = postoLibero(mondo, x, z);
    if (y === null) continue;
    const lista = y > QUOTA_CONIFERE ? conifere : latifoglie;
    lista.push([x, y, z, scala, giro]);
  }

  // Alberi singoli di OpenStreetMap che cadono in questa cella
  const singoli = mondo.alberiSingoli.get(cx + "," + cz) || [];
  for (const [x, z] of singoli) {
    const y = quotaTerreno(mondo.terreno, x, z);
    latifoglie.push([x, y, z, 1, rnd() * Math.PI * 2]);
  }

  const gruppo = new THREE.Group();
  const matrice = new THREE.Matrix4();
  const rotazione = new THREE.Quaternion();
  const asse = new THREE.Vector3(0, 1, 0);
  const coppie = [[latifoglie, FORMA_LATIFOGLIA], [conifere, FORMA_CONIFERA]];
  for (const [lista, forma] of coppie) {
    if (lista.length === 0) continue;
    const istanze = new THREE.InstancedMesh(forma, MATERIALE, lista.length);
    for (let i = 0; i < lista.length; i++) {
      const [x, y, z, scala, giro] = lista[i];
      rotazione.setFromAxisAngle(asse, giro);
      matrice.compose(new THREE.Vector3(x, y - 0.2, z), rotazione, new THREE.Vector3(scala, scala, scala));
      istanze.setMatrixAt(i, matrice);
    }
    istanze.computeBoundingSphere();
    gruppo.add(istanze);
  }
  return gruppo;
}

export function creaAlberi(scena, terreno, strade, edifici, alberiSingoli) {
  // Alberi singoli divisi per cella
  const perCella = new Map();
  for (let i = 0; i + 1 < alberiSingoli.length; i += 2) {
    const chiave = Math.floor(alberiSingoli[i] / CELLA) + "," + Math.floor(alberiSingoli[i + 1] / CELLA);
    if (!perCella.has(chiave)) perCella.set(chiave, []);
    perCella.get(chiave).push([alberiSingoli[i], alberiSingoli[i + 1]]);
  }
  return {
    scena: scena,
    terreno: terreno,
    strade: strade,
    edifici: edifici,
    alberiSingoli: perCella,
    celle: new Map(),
    attesa: 0
  };
}

export async function caricaAlberiSingoli() {
  const risposta = await fetch("dati/alberi.json");
  if (!risposta.ok) return [];
  const dati = await risposta.json();
  return dati.alberi;
}

// Ogni tanto: crea le celle vicine alla moto e toglie quelle lontane
export function aggiornaAlberi(mondo, x, z, dt) {
  mondo.attesa -= dt;
  if (mondo.attesa > 0) return;
  mondo.attesa = 0.4;

  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  const quante = Math.ceil(RAGGIO / CELLA);
  let create = 0;

  for (let ix = cx - quante; ix <= cx + quante; ix++) {
    for (let iz = cz - quante; iz <= cz + quante; iz++) {
      const chiave = ix + "," + iz;
      const distanza = Math.hypot((ix + 0.5) * CELLA - x, (iz + 0.5) * CELLA - z);
      if (distanza > RAGGIO || mondo.celle.has(chiave)) continue;
      if (Math.abs(ix * CELLA) > mondo.terreno.meta + CELLA || Math.abs(iz * CELLA) > mondo.terreno.meta + CELLA) continue;
      // Massimo 3 celle nuove alla volta, cosi' il gioco non si blocca
      if (create >= 3) continue;
      const gruppo = creaCella(mondo, ix, iz);
      mondo.scena.add(gruppo);
      mondo.celle.set(chiave, gruppo);
      create = create + 1;
    }
  }

  for (const [chiave, gruppo] of mondo.celle) {
    const [ix, iz] = chiave.split(",").map(Number);
    const distanza = Math.hypot((ix + 0.5) * CELLA - x, (iz + 0.5) * CELLA - z);
    if (distanza > RAGGIO + CELLA) {
      mondo.scena.remove(gruppo);
      for (const istanze of gruppo.children) istanze.dispose();
      mondo.celle.delete(chiave);
    }
  }
}

// Cambia distanza e densita' degli alberi (menu Impostazioni) e ricrea quelli vicini
export function impostaAlberi(mondo, raggio, densita) {
  RAGGIO = raggio;
  ALBERI_PER_CELLA = Math.round(650 * densita);
  for (const gruppo of mondo.celle.values()) {
    mondo.scena.remove(gruppo);
    for (const istanze of gruppo.children) istanze.dispose();
  }
  mondo.celle.clear();
  mondo.attesa = 0;
}
