// Edifici: contorni veri da OpenStreetMap, "alzati" fino all'altezza dell'edificio.
// Gli edifici vicini sono uniti in pezzi da 1 x 1 km (meno lavoro per la scheda video).
// Serve anche per le collisioni: la moto non puo' passare dentro un edificio.

import * as THREE from "three";

const PEZZO = 1000;   // metri
const CELLA = 40;     // griglia per le collisioni

// Colori dei muri (stile ticinese: bianco, crema, giallo, rosa, grigio chiaro, ocra)
const COLORI_MURI = [0xf2efe6, 0xe9dcc0, 0xf1e2a8, 0xe9c9bd, 0xd5d5d0, 0xd9b98a];
const COLORE_TETTO_PIATTO = 0x77787a;
const COLORE_TETTO_TEGOLE = 0x9a4f38;

export async function caricaEdifici() {
  const risposta = await fetch("dati/edifici.json");
  if (!risposta.ok) {
    return { lista: [], griglia: new Map() };   // senza edifici il gioco funziona lo stesso
  }
  const dati = await risposta.json();

  // Griglia per le collisioni: per ogni cella gli edifici che la toccano
  const griglia = new Map();
  for (let i = 0; i < dati.edifici.length; i++) {
    const p = dati.edifici[i].p;
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
  return { lista: dati.edifici, griglia: griglia };
}

function aggiungiColore(colori, colore, quanti) {
  for (let i = 0; i < quanti; i++) {
    colori.push(colore.r, colore.g, colore.b);
  }
}

export function aggiungiEdifici(edifici, scena) {
  const pezzi = new Map();   // chiave "px,pz" -> { posizioni, colori }
  const muro = new THREE.Color();
  const tetto = new THREE.Color();

  for (const edificio of edifici.lista) {
    const p = edificio.p;
    const punti = p.length / 2;
    const chiave = Math.floor(p[0] / PEZZO) + "," + Math.floor(p[1] / PEZZO);
    if (!pezzi.has(chiave)) pezzi.set(chiave, { posizioni: [], colori: [] });
    const pezzo = pezzi.get(chiave);

    muro.setHex(COLORI_MURI[edificio.c % COLORI_MURI.length]);
    tetto.setHex(edificio.t === 1 ? COLORE_TETTO_TEGOLE : COLORE_TETTO_PIATTO);

    // Muri: un rettangolo (2 triangoli) per ogni lato del contorno
    for (let i = 0; i < punti; i++) {
      const j = (i + 1) % punti;
      const ax = p[i * 2], az = p[i * 2 + 1];
      const bx = p[j * 2], bz = p[j * 2 + 1];
      pezzo.posizioni.push(
        ax, edificio.b, az, bx, edificio.b, bz, bx, edificio.h, bz,
        ax, edificio.b, az, bx, edificio.h, bz, ax, edificio.h, az
      );
      aggiungiColore(pezzo.colori, muro, 6);
    }

    // Tetto: il contorno diviso in triangoli
    const contorno = [];
    for (let i = 0; i < punti; i++) {
      contorno.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
    }
    const triangoli = THREE.ShapeUtils.triangulateShape(contorno, []);
    for (const [a, b, c] of triangoli) {
      pezzo.posizioni.push(
        contorno[a].x, edificio.h, contorno[a].y,
        contorno[b].x, edificio.h, contorno[b].y,
        contorno[c].x, edificio.h, contorno[c].y
      );
      aggiungiColore(pezzo.colori, tetto, 3);
    }
  }

  const materiale = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const pezzo of pezzi.values()) {
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(pezzo.posizioni, 3));
    geometria.setAttribute("color", new THREE.Float32BufferAttribute(pezzo.colori, 3));
    geometria.computeVertexNormals();
    scena.add(new THREE.Mesh(geometria, materiale));
  }
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
