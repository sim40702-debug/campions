// Terreno: legge i dati swisstopo preparati dal passo 7 e costruisce la mesh 3D.
// Coordinate: x = est, y = quota (metri), z = sud. Il centro (0, 0) e' il centro del pilota.

import * as THREE from "three";

const PEZZI_PER_LATO = 4;   // 4 x 4 pezzi da 2 x 2 km

export async function caricaTerreno() {
  const rispostaInfo = await fetch("dati/terreno.json");
  if (!rispostaInfo.ok) {
    throw new Error("Mancano i dati del terreno: " + (await rispostaInfo.text()));
  }
  const info = await rispostaInfo.json();
  const rispostaBin = await fetch("dati/terreno.bin");
  if (!rispostaBin.ok) {
    throw new Error("Mancano i dati del terreno: " + (await rispostaBin.text()));
  }
  const valori = new Uint16Array(await rispostaBin.arrayBuffer());

  // Trasformo i numeri del file in quote in metri
  const quote = new Float32Array(valori.length);
  for (let i = 0; i < valori.length; i++) {
    quote[i] = info.quota_base + valori[i] * info.scala_quota;
  }

  // Boschi (facoltativo): 1 = bosco, 0 = niente
  let bosco = null;
  const rispostaBosco = await fetch("dati/bosco.bin");
  if (rispostaBosco.ok) {
    bosco = new Uint8Array(await rispostaBosco.arrayBuffer());
  }

  return {
    info: info,
    punti: info.punti,
    passo: info.passo_m,
    meta: info.lato_m / 2,
    quote: quote,
    bosco: bosco
  };
}

// C'e' bosco nel punto (x, z)?
export function boscoQui(terreno, x, z) {
  if (terreno.bosco === null) return false;
  const colonna = Math.round((x + terreno.meta) / terreno.passo);
  const riga = Math.round((z + terreno.meta) / terreno.passo);
  if (colonna < 0 || riga < 0 || colonna >= terreno.punti || riga >= terreno.punti) return false;
  return terreno.bosco[riga * terreno.punti + colonna] === 1;
}

// Quota del terreno in un punto qualsiasi (media tra i 4 punti vicini)
export function quotaTerreno(terreno, x, z) {
  const n = terreno.punti;
  let colonna = (x + terreno.meta) / terreno.passo;
  let riga = (z + terreno.meta) / terreno.passo;
  colonna = Math.min(Math.max(colonna, 0), n - 1.001);
  riga = Math.min(Math.max(riga, 0), n - 1.001);
  const c0 = Math.floor(colonna);
  const r0 = Math.floor(riga);
  const fx = colonna - c0;
  const fy = riga - r0;
  const q = terreno.quote;
  const sopra = q[r0 * n + c0] * (1 - fx) + q[r0 * n + c0 + 1] * fx;
  const sotto = q[(r0 + 1) * n + c0] * (1 - fx) + q[(r0 + 1) * n + c0 + 1] * fx;
  return sopra * (1 - fy) + sotto * fy;
}

// Colore di un punto: sabbia vicino al lago, erba, roccia se ripido, chiaro in alto
function coloreTerreno(quota, pendenza, livelloLago, bosco, colore) {
  if (quota < livelloLago + 0.6) {
    colore.setRGB(0.62, 0.57, 0.45);
  } else if (bosco && pendenza < 1.4) {
    // Bosco: verde scuro (da lontano sembra un bosco anche senza alberi)
    const variazione = (Math.sin(quota * 0.11) + 1) * 0.02;
    colore.setRGB(0.15 + variazione, 0.27 + variazione, 0.12);
  } else if (pendenza > 0.9) {
    colore.setRGB(0.45, 0.43, 0.40);
  } else if (quota > 1700) {
    colore.setRGB(0.55, 0.58, 0.45);
  } else {
    const variazione = (Math.sin(quota * 0.05) + 1) * 0.03;
    colore.setRGB(0.26 + variazione, 0.42 + variazione, 0.20);
  }
}

// Crea la geometria di un pezzo di terreno, prendendo un punto ogni "salto"
function creaGeometriaPezzo(terreno, inizioColonna, inizioRiga, quadPezzo, salto, centroX, centroZ) {
  const n = terreno.punti;
  const lato = quadPezzo / salto + 1;
  const posizioni = new Float32Array(lato * lato * 3);
  const colori = new Float32Array(lato * lato * 3);
  const colore = new THREE.Color();
  const q = terreno.quote;

  for (let r = 0; r < lato; r++) {
    for (let c = 0; c < lato; c++) {
      const riga = inizioRiga + r * salto;
      const colonna = inizioColonna + c * salto;
      let quota = q[riga * n + colonna];
      if (salto > 1) {
        // da lontano: il punto piu' basso dei vicini, cosi' il terreno non copre le strade
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = Math.min(Math.max(riga + dr, 0), n - 1);
            const cc = Math.min(Math.max(colonna + dc, 0), n - 1);
            quota = Math.min(quota, q[rr * n + cc]);
          }
        }
      }
      const indice = (r * lato + c) * 3;
      posizioni[indice] = colonna * terreno.passo - terreno.meta - centroX;
      posizioni[indice + 1] = quota;
      posizioni[indice + 2] = riga * terreno.passo - terreno.meta - centroZ;

      // Pendenza: differenza di quota con i punti vicini
      const destra = q[riga * n + Math.min(colonna + 1, n - 1)];
      const sotto = q[Math.min(riga + 1, n - 1) * n + colonna];
      const pendenza = Math.hypot(destra - quota, sotto - quota) / terreno.passo;
      const bosco = terreno.bosco !== null && terreno.bosco[riga * n + colonna] === 1;
      coloreTerreno(quota, pendenza, terreno.info.livello_lago, bosco, colore);
      colori[indice] = colore.r;
      colori[indice + 1] = colore.g;
      colori[indice + 2] = colore.b;
    }
  }

  const indici = [];
  for (let r = 0; r < lato - 1; r++) {
    for (let c = 0; c < lato - 1; c++) {
      const a = r * lato + c;
      const b = a + 1;
      const d = a + lato;
      const e = d + 1;
      indici.push(a, d, b, b, d, e);
    }
  }

  // Calcolo la luce (normali) solo sulla griglia vera
  const griglia = new THREE.BufferGeometry();
  griglia.setAttribute("position", new THREE.BufferAttribute(posizioni, 3));
  griglia.setIndex(indici);
  griglia.computeVertexNormals();
  const normali = griglia.attributes.normal.array;

  // "Gonna": lungo i 4 bordi aggiungo una striscia che scende di 40 m.
  // Copre le fessure tra pezzi vicini con dettaglio diverso (prima si vedevano linee scure).
  const bordo = [];
  for (let i = 0; i < lato; i++) bordo.push(i);                                  // nord
  for (let i = 1; i < lato; i++) bordo.push(i * lato + lato - 1);                // est
  for (let i = lato - 2; i >= 0; i--) bordo.push((lato - 1) * lato + i);         // sud
  for (let i = lato - 2; i >= 0; i--) bordo.push(i * lato);                      // ovest

  const totale = lato * lato + bordo.length;
  const pos2 = new Float32Array(totale * 3);
  const col2 = new Float32Array(totale * 3);
  const nor2 = new Float32Array(totale * 3);
  pos2.set(posizioni);
  col2.set(colori);
  nor2.set(normali);
  for (let k = 0; k < bordo.length; k++) {
    const da = bordo[k] * 3;
    const a = (lato * lato + k) * 3;
    pos2[a] = posizioni[da];
    pos2[a + 1] = posizioni[da + 1] - 40;
    pos2[a + 2] = posizioni[da + 2];
    col2[a] = colori[da];
    col2[a + 1] = colori[da + 1];
    col2[a + 2] = colori[da + 2];
    nor2[a] = normali[da];
    nor2[a + 1] = normali[da + 1];
    nor2[a + 2] = normali[da + 2];
    if (k > 0) {
      const sopra1 = bordo[k - 1];
      const sopra2 = bordo[k];
      const sotto1 = lato * lato + k - 1;
      const sotto2 = lato * lato + k;
      // la "gonna" si deve vedere da tutti e due i lati: triangoli in tutte e due le direzioni
      indici.push(sopra1, sotto1, sopra2, sopra2, sotto1, sotto2);
      indici.push(sopra1, sopra2, sotto1, sopra2, sotto2, sotto1);
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(pos2, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(col2, 3));
  geometria.setAttribute("normal", new THREE.BufferAttribute(nor2, 3));
  geometria.setIndex(indici);
  return geometria;
}

// Mette il terreno nella scena: ogni pezzo ha 2 livelli di dettaglio (vicino / lontano)
export function aggiungiTerreno(terreno, scena) {
  // Il terreno si vede solo da sopra: cosi' dentro le gallerie non copre il tubo
  const materiale = new THREE.MeshLambertMaterial({ vertexColors: true });
  const quadPezzo = (terreno.punti - 1) / PEZZI_PER_LATO;
  const latoPezzo = quadPezzo * terreno.passo;
  const tuttiILivelli = [];

  for (let py = 0; py < PEZZI_PER_LATO; py++) {
    for (let px = 0; px < PEZZI_PER_LATO; px++) {
      const centroX = (px + 0.5) * latoPezzo - terreno.meta;
      const centroZ = (py + 0.5) * latoPezzo - terreno.meta;
      const livelli = new THREE.LOD();
      livelli.position.set(centroX, 0, centroZ);

      const vicino = new THREE.Mesh(
        creaGeometriaPezzo(terreno, px * quadPezzo, py * quadPezzo, quadPezzo, 1, centroX, centroZ),
        materiale
      );
      const lontano = new THREE.Mesh(
        creaGeometriaPezzo(terreno, px * quadPezzo, py * quadPezzo, quadPezzo, 4, centroX, centroZ),
        materiale
      );
      livelli.addLevel(vicino, 0);
      livelli.addLevel(lontano, latoPezzo * 1.2);
      scena.add(livelli);
      tuttiILivelli.push(livelli);
    }
  }

  // Lago Maggiore: una superficie d'acqua alla quota del lago
  const lago = new THREE.Mesh(
    new THREE.PlaneGeometry(terreno.meta * 2, terreno.meta * 2),
    new THREE.MeshLambertMaterial({ color: 0x2e6a92 })
  );
  lago.rotation.x = -Math.PI / 2;
  lago.position.y = terreno.info.livello_lago;
  scena.add(lago);

  return { livelli: tuttiILivelli, latoPezzo: latoPezzo };
}

// Fino a che distanza il terreno usa il dettaglio pieno (menu Impostazioni)
export function impostaDettaglioTerreno(terrenoMesh, fattore) {
  for (const livelli of terrenoMesh.livelli) {
    livelli.levels[1].distance = terrenoMesh.latoPezzo * fattore;
  }
}
