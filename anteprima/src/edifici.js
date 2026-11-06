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

    muro.setHex(edificio.k > 0 ? 0xe4ddd0 : COLORI_MURI[edificio.c % COLORI_MURI.length]);
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

    aggiungiTetto(pezzo, edificio, muro, tetto);
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

// --- Tetti ---------------------------------------------------------------------
// Case e chiese (t = 1): tetto a due falde se l'edificio ha 4 lati, altrimenti a padiglione.
// Campanili (k = 2): guglia a punta. Palazzi e capannoni: tetto piatto.

function triangolo(pezzo, colore, a, b, c) {
  pezzo.posizioni.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  aggiungiColore(pezzo.colori, colore, 3);
}

function superficie(p) {
  let somma = 0;
  const punti = p.length / 2;
  for (let i = 0; i < punti; i++) {
    const j = (i + 1) % punti;
    somma += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return Math.abs(somma) / 2;
}

function tettoPiatto(pezzo, edificio, tetto) {
  const p = edificio.p;
  const contorno = [];
  for (let i = 0; i < p.length / 2; i++) contorno.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contorno, [])) {
    triangolo(pezzo, tetto,
      [contorno[a].x, edificio.h, contorno[a].y],
      [contorno[b].x, edificio.h, contorno[b].y],
      [contorno[c].x, edificio.h, contorno[c].y]);
  }
}

function tettoAPunta(pezzo, edificio, tetto, altezzaPunta) {
  const p = edificio.p;
  const punti = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < punti; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; }
  const punta = [cx / punti, edificio.h + altezzaPunta, cz / punti];
  for (let i = 0; i < punti; i++) {
    const j = (i + 1) % punti;
    triangolo(pezzo, tetto, [p[i * 2], edificio.h, p[i * 2 + 1]], [p[j * 2], edificio.h, p[j * 2 + 1]], punta);
  }
}

function tettoADueFalde(pezzo, edificio, muro, tetto) {
  const p = edificio.p;
  let v = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]];
  // il colmo va nel senso del lato lungo
  if (Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) < Math.hypot(v[2][0] - v[1][0], v[2][1] - v[1][1])) {
    v = [v[1], v[2], v[3], v[0]];
  }
  const [a, b, c, d] = v;
  const corto = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const colmo = edificio.h + Math.min(4, corto * 0.35);
  const h = edificio.h;
  const mBC = [(b[0] + c[0]) / 2, colmo, (b[1] + c[1]) / 2];
  const mDA = [(d[0] + a[0]) / 2, colmo, (d[1] + a[1]) / 2];
  const A = [a[0], h, a[1]], B = [b[0], h, b[1]], C = [c[0], h, c[1]], D = [d[0], h, d[1]];
  triangolo(pezzo, tetto, A, B, mBC);   // falda 1
  triangolo(pezzo, tetto, A, mBC, mDA);
  triangolo(pezzo, tetto, C, D, mDA);   // falda 2
  triangolo(pezzo, tetto, C, mDA, mBC);
  triangolo(pezzo, muro, B, C, mBC);    // timpani (stesso colore dei muri)
  triangolo(pezzo, muro, D, A, mDA);
}

function aggiungiTetto(pezzo, edificio, muro, tetto) {
  const area = superficie(edificio.p);
  const punti = edificio.p.length / 2;
  if (edificio.k === 2) {
    tettoAPunta(pezzo, edificio, tetto, Math.max(4, Math.sqrt(area) * 1.1));   // guglia del campanile
  } else if (edificio.t === 1 && (edificio.k === 1 || area < 900)) {
    if (punti === 4) {
      tettoADueFalde(pezzo, edificio, muro, tetto);
    } else {
      tettoAPunta(pezzo, edificio, tetto, Math.min(3.5, Math.sqrt(area) * 0.3));
    }
  } else {
    tettoPiatto(pezzo, edificio, tetto);
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
