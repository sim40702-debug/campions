// Dettagli delle strade da OpenStreetMap: semafori, stop, precedenze, lampioni,
// strisce pedonali (gialle, come in Svizzera) e nomi delle localita'.

import * as THREE from "three";
import { quotaTerreno } from "./terreno.js";
import { stradaVicina, stradaSotto, sullAsfalto, distanzaIncrocio } from "./strade.js";
import { aggiungiArredoUrbano } from "./arredo.js";
import { creaSegnali } from "./segnali.js";

export async function caricaDettagli() {
  const risposta = await fetch("dati/dettagli.json");
  if (!risposta.ok) {
    return { semafori: [], stop: [], precedenza: [], lampioni: [], strisce: [], localita: [] };
  }
  return risposta.json();
}

// Unisce piu' pezzi (geometria + colore) in una sola geometria con i colori
export function unisci(parti) {
  const posizioni = [];
  const colori = [];
  for (const [geometria, coloreHex] of parti) {
    const colore = new THREE.Color(coloreHex);
    const g = geometria.index ? geometria.toNonIndexed() : geometria;
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      posizioni.push(pos[i], pos[i + 1], pos[i + 2]);
      colori.push(colore.r, colore.g, colore.b);
    }
  }
  const forma = new THREE.BufferGeometry();
  forma.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  forma.setAttribute("color", new THREE.Float32BufferAttribute(colori, 3));
  forma.computeVertexNormals();
  return forma;
}

function palo(altezza) {
  const g = new THREE.CylinderGeometry(0.05, 0.06, altezza, 6);
  g.translate(0, altezza / 2, 0);
  return g;
}

// --- Forme dei vari oggetti (tutte guardano verso -z) ----------------------------
function formaLampione() {
  // palo affusolato con base, braccio curvo e la "testa" che si accende di notte (forma separata)
  const base = new THREE.CylinderGeometry(0.11, 0.14, 0.5, 8);
  base.translate(0, 0.25, 0);
  const braccio = new THREE.BoxGeometry(0.07, 0.07, 1.3);
  braccio.translate(0, 6.08, -0.6);
  const curva = new THREE.BoxGeometry(0.07, 0.07, 0.4);
  curva.rotateX(0.5);
  curva.translate(0, 6.0, -1.15);
  const cappello = new THREE.BoxGeometry(0.46, 0.09, 0.8);
  cappello.translate(0, 6.08, -1.35);
  const palo6 = new THREE.CylinderGeometry(0.045, 0.075, 6.1, 8);
  palo6.translate(0, 3.05, 0);
  return unisci([[palo6, 0x5d6168], [base, 0x4a4d52], [braccio, 0x5d6168], [curva, 0x5d6168], [cappello, 0x40444a]]);
}

function testaLampione() {
  const lampada = new THREE.BoxGeometry(0.34, 0.07, 0.62);
  lampada.translate(0, 6.0, -1.35);
  return lampada;
}

function formaSemaforo() {
  const scatola = new THREE.BoxGeometry(0.32, 0.95, 0.25);
  scatola.translate(0, 3.0, 0);
  const parti = [[palo(3.5), 0x3b3d40], [scatola, 0x1c1c1c]];
  const luci = [0xe8322c, 0xf2b31b, 0x2fbf4a];
  for (let i = 0; i < 3; i++) {
    const luce = new THREE.CircleGeometry(0.09, 10);
    luce.rotateY(Math.PI);
    luce.translate(0, 3.3 - i * 0.3, -0.13);
    parti.push([luce, luci[i]]);
  }
  return unisci(parti);
}

function formaStop() {
  const ottagono = new THREE.CylinderGeometry(0.4, 0.4, 0.04, 8);
  ottagono.rotateX(Math.PI / 2);
  ottagono.rotateZ(Math.PI / 8);
  ottagono.translate(0, 2.1, 0);
  const scritta = new THREE.BoxGeometry(0.46, 0.1, 0.05);
  scritta.translate(0, 2.1, -0.01);
  return unisci([[palo(2.2), 0x8d9096], [ottagono, 0xc8171e], [scritta, 0xffffff]]);
}

function formaPrecedenza() {
  const bordo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 3);
  bordo.rotateX(Math.PI / 2);
  bordo.rotateZ(Math.PI);
  bordo.translate(0, 2.0, 0);
  const interno = new THREE.CylinderGeometry(0.36, 0.36, 0.05, 3);
  interno.rotateX(Math.PI / 2);
  interno.rotateZ(Math.PI);
  interno.translate(0, 2.0, -0.01);
  return unisci([[palo(2.2), 0x8d9096], [bordo, 0xc8171e], [interno, 0xffffff]]);
}

const MATERIALE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });

// Mette tante copie di una forma (posizione + rotazione) in una sola InstancedMesh
function istanze(forma, oggetti, scena, materiale, ombra) {
  if (oggetti.length === 0) return null;
  // divisi in celle da 400 m: cosi' la scheda video scarta quelle fuori dallo schermo (e fuori dalle ombre)
  const celle = new Map();
  for (const o of oggetti) {
    const k = Math.floor(o.x / 400) + "," + Math.floor(o.z / 400);
    let l = celle.get(k);
    if (!l) { l = []; celle.set(k, l); }
    l.push(o);
  }
  const rotazione = new THREE.Quaternion();
  const asse = new THREE.Vector3(0, 1, 0);
  const uno = new THREE.Vector3(1, 1, 1);
  const matrice = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  let ultimo = null;
  for (const lista of celle.values()) {
    const mesh = new THREE.InstancedMesh(forma, materiale || MATERIALE, lista.length);
    mesh.castShadow = ombra !== false;
    mesh.receiveShadow = true;
    for (let i = 0; i < lista.length; i++) {
      const o = lista[i];
      rotazione.setFromAxisAngle(asse, o.angolo);
      matrice.compose(pos.set(o.x, o.y, o.z), rotazione, uno);
      mesh.setMatrixAt(i, matrice);
    }
    mesh.computeBoundingSphere();
    scena.add(mesh);
    ultimo = mesh;
  }
  return ultimo;
}

// Il punto OSM di un cartello e' spesso SULLA strada: lo sposto sul bordo destro,
// girato verso chi arriva
// Con "versoIncrocio" (stop, precedenze, semafori) il cartello vale per chi va VERSO l'incrocio piu' vicino:
// sta alla sua destra, lo guarda in faccia, e non finisce mai sull'asfalto della strada che incrocia
// (se serve arretra lungo la sua strada, con la linea di arresto).
export function aBordoStrada(strade, terreno, x, z, spostamento, versoIncrocio) {
  const strada = stradaVicina(strade, x, z, 25);
  if (strada === null || strada.galleria) {
    return { x: x, y: quotaTerreno(terreno, x, z), z: z, angolo: 0, strada: null };
  }
  const distanza = strada.larghezza / 2 + spostamento;
  if (versoIncrocio) {
    const avanti = distanzaIncrocio(strade, strada.indice, strada.segmento, strada.t, 1, 80);
    const indietro = distanzaIncrocio(strade, strada.indice, strada.segmento, strada.t, -1, 80);
    if (indietro < avanti) { strada.dirX = -strada.dirX; strada.dirZ = -strada.dirZ; }
    let libero = false;
    for (let k = 0; k < 12 && !libero; k++) {
      const px = strada.x - strada.dirZ * distanza, pz = strada.z + strada.dirX * distanza;
      // libero se li' non c'e' asfalto e la linea di arresto non cade dentro l'incrocio
      const lineaX = strada.x - strada.dirZ * strada.larghezza / 4, lineaZ = strada.z + strada.dirX * strada.larghezza / 4;
      libero = !sullAsfalto(strade, px, pz, 0.3) && !copreAltra(strade, lineaX, lineaZ, strada.indice);
      if (!libero) {
        strada.x -= strada.dirX * 1.5;
        strada.z -= strada.dirZ * 1.5;
      }
    }
    strada.scarta = !libero;   // nessun posto libero entro 18 m: meglio nessun cartello che uno in mezzo alla strada
    const sotto = stradaSotto(strade, strada.x, strada.z, strada.y);
    if (sotto !== null) strada.y = sotto.y;
  }
  // destra rispetto alla direzione della strada = (-dirZ, dirX)
  const nx = strada.x - strada.dirZ * distanza;
  const nz = strada.z + strada.dirX * distanza;
  // La faccia del cartello (verso -z del modello) deve guardare chi arriva
  const angolo = Math.atan2(strada.dirX, strada.dirZ);
  return { x: nx, y: Math.max(quotaTerreno(terreno, nx, nz), strada.y - 0.3), z: nz, angolo: angolo, strada: strada };
}

// (x, z) e' sulla carreggiata di una strada diversa da "indice"?
function copreAltra(strade, x, z, indice) {
  const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) continue;
      for (const [s, i] of pezzi) {
        if (s === indice || strade.lista[s].g) continue;
        const p = strade.lista[s].p;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
        t = Math.min(Math.max(t, 0), 1);
        if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) < strade.lista[s].w / 2) return true;
      }
    }
  }
  return false;
}

function coppie(lista) {
  const risultato = [];
  for (let i = 0; i + 1 < lista.length; i += 2) risultato.push([lista[i], lista[i + 1]]);
  return risultato;
}

export function aggiungiDettagli(dettagli, scena, terreno, strade, contesto) {
  const lampioni = coppie(dettagli.lampioni).map(([x, z]) => aBordoStrada(strade, terreno, x, z, 0.6));
  const semafori = coppie(dettagli.semafori).map(([x, z]) => aBordoStrada(strade, terreno, x, z, 0.8, true));
  const stop = coppie(dettagli.stop).map(([x, z]) => aBordoStrada(strade, terreno, x, z, 0.7, true));
  const precedenze = coppie(dettagli.precedenza).map(([x, z]) => aBordoStrada(strade, terreno, x, z, 0.7, true));

  // I lampioni girano il braccio verso il centro della strada
  for (const l of lampioni) l.angolo = l.angolo - Math.PI / 2;

  istanze(formaLampione(), lampioni, scena);
  if (contesto) {
    aggiungiArredoUrbano(scena, terreno, strade, contesto, lampioni, dettagli, testaLampione());
    creaSegnali(scena, terreno, strade, contesto, dettagli);
  }
  istanze(formaSemaforo(), semafori, scena);
  // STOP e precedenze: li disegna segnali.js (forme e segni giusti per la Svizzera)
  if (!contesto) {
    istanze(formaStop(), stop, scena);
    istanze(formaPrecedenza(), precedenze, scena);
  }

  // Strisce pedonali gialle: rettangoli di traverso sulla strada
  const posizioni = [];
  for (const [x, z] of coppie(dettagli.strisce)) {
    const strada = stradaVicina(strade, x, z, 8);
    if (strada === null || strada.galleria) continue;
    const latoX = -strada.dirZ;
    const latoZ = strada.dirX;
    const y = strada.y + 0.05;
    const quante = Math.floor(strada.larghezza / 1.0);
    for (let k = 0; k < quante; k++) {
      const s = -strada.larghezza / 2 + 0.25 + k * 1.0;   // posizione di traverso
      const cx = strada.x + latoX * s;
      const cz = strada.z + latoZ * s;
      // striscia larga 0.5 m (di traverso) e lunga 3 m (lungo la strada)
      const ax = latoX * 0.25, az = latoZ * 0.25;
      const bx = strada.dirX * 1.5, bz = strada.dirZ * 1.5;
      posizioni.push(
        cx - ax - bx, y, cz - az - bz, cx + ax - bx, y, cz + az - bz, cx + ax + bx, y, cz + az + bz,
        cx - ax - bx, y, cz - az - bz, cx + ax + bx, y, cz + az + bz, cx - ax + bx, y, cz - az + bz
      );
    }
  }
  if (posizioni.length > 0) {
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
    geometria.computeVertexNormals();
    scena.add(new THREE.Mesh(geometria, new THREE.MeshLambertMaterial({
      color: 0xf2c200, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6
    })));
  }

  return {
    lampioni: lampioni.length, semafori: semafori.length, stop: stop.length,
    precedenze: precedenze.length, strisce: dettagli.strisce.length / 2
  };
}

// Localita' piu' vicina (per la scritta sullo schermo)
const IMPORTANZA = { city: 3, town: 3, village: 2, suburb: 1, hamlet: 1, quarter: 0, neighbourhood: 0 };

export function localitaVicina(dettagli, x, z) {
  let migliore = null;
  let punteggio = Infinity;
  for (const l of dettagli.localita) {
    // le citta' "contano" su una distanza maggiore dei quartieri
    const distanza = Math.hypot(l.x - x, l.z - z) / (1 + (IMPORTANZA[l.t] || 0) * 0.6);
    if (distanza < punteggio) {
      punteggio = distanza;
      migliore = l;
    }
  }
  return migliore !== null && punteggio < 1500 ? migliore.n : "";
}
