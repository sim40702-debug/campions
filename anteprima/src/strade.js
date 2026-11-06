// Strade: legge le strade OpenStreetMap preparate dal passo 7,
// le disegna come nastri di asfalto e permette di sapere "su che strada sono".

import * as THREE from "three";

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

// Aggiunge un nastro (striscia) a una lista di vertici e indici
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
    const latoX = -dz * larghezza / 2;
    const latoZ = dx * larghezza / 2;
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
  return new THREE.Mesh(geometria, materiale);
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

export function aggiungiStrade(strade, scena) {
  const asfalto = { posizioni: [], indici: [] };
  const righe = { posizioni: [], indici: [] };
  const gallerie = { posizioni: [], indici: [] };
  const parapetti = { posizioni: [], indici: [] };

  for (const strada of strade.lista) {
    const gruppo = strada.g ? gallerie : asfalto;
    aggiungiNastro(strada.p, strada.w, 0, gruppo.posizioni, gruppo.indici, false);
    if (strada.w >= 5.5) {
      aggiungiNastro(strada.p, 0.15, 0.03, righe.posizioni, righe.indici, true);
    }
    if (strada.b) {
      aggiungiParapetti(strada.p, strada.w, parapetti.posizioni, parapetti.indici);
    }
  }
  scena.add(creaMesh(parapetti.posizioni, parapetti.indici, 0xb8b8b0, 0));

  scena.add(creaMesh(asfalto.posizioni, asfalto.indici, 0x4f5157, -2));
  scena.add(creaMesh(gallerie.posizioni, gallerie.indici, 0x6b5a3a, -2));
  scena.add(creaMesh(righe.posizioni, righe.indici, 0xf2f2f2, -4));
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
        if (distanza > strada.w / 2 + 0.5) {
          continue;
        }
        const y = p[i + 1] + (p[i + 4] - p[i + 1]) * t;
        const differenza = Math.abs(y - quotaAttuale);
        if (migliore === null || differenza < migliore.differenza) {
          migliore = {
            y: y,
            nome: strada.n,
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
