// Opere stradali: gallerie vere (tubo con luci e portali) e piloni sotto i ponti.
// Il terreno si vede solo da sopra: dentro la montagna si vede solo il tubo della galleria.

import * as THREE from "three";
import { quotaTerreno, dentroArea } from "./terreno.js";

const ALTEZZA_GALLERIA = 5;
const OGNI_QUANTI_PUNTI_LUCE = 6;    // i punti delle strade sono ogni 4 m: una luce ogni 24 m
const OGNI_QUANTI_PUNTI_PILONE = 7;  // un pilone ogni 28 m circa

function quad(posizioni, a, b, c, d) {
  // a-b in basso, c-d in alto (due triangoli)
  posizioni.push(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2]);
  posizioni.push(a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2]);
}

// Sezione della galleria nel punto i: un anello ad ARCO (due pareti dritte e volta a botte), non una scatola.
// Ritorna i punti dell'anello (dal pavimento sinistro, su per la volta, al pavimento destro) e la direzione.
const PUNTI_ARCO = 9;
function sezione(p, i, larghezza) {
  const punti = p.length / 3;
  const a = Math.max(i - 1, 0) * 3;
  const b = Math.min(i + 1, punti - 1) * 3;
  let dx = p[b] - p[a];
  let dz = p[b + 2] - p[a + 2];
  const lunghezza = Math.hypot(dx, dz) || 1;
  dx = dx / lunghezza;
  dz = dz / lunghezza;
  const meta = larghezza / 2 + 1.0;
  const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
  const spalla = 2.6;                 // altezza delle pareti dritte
  const freccia = ALTEZZA_GALLERIA - spalla;   // quanto sale la volta sopra le spalle
  const anello = [];
  const punto = function (lato, alto) {
    return [x - dz * lato, y + alto, z + dx * lato];
  };
  anello.push(punto(-meta, -0.08));
  anello.push(punto(-meta, spalla));
  for (let k = 1; k < PUNTI_ARCO - 1; k++) {
    const t = Math.PI * k / (PUNTI_ARCO - 1);   // da sinistra (0) a destra (PI) sopra la testa
    anello.push(punto(-meta * Math.cos(t), spalla + freccia * Math.sin(t)));
  }
  anello.push(punto(meta, spalla));
  anello.push(punto(meta, -0.08));
  return { anello: anello, centro: [x, y + ALTEZZA_GALLERIA - 0.15, z], dirX: dx, dirZ: dz, x: x, y: y, z: z, meta: meta };
}

// Portale: facciata di cemento con apertura ad arco, cornice in rilievo e muri d'ala inclinati che "tengono" la montagna.
// verso = -1 all'inizio della galleria, +1 alla fine.
function aggiungiPortale(posizioni, cornice, s, verso, terreno) {
  const fx = -s.dirZ, fz = s.dirX;
  const fuori = 0.35 * verso;
  const sposta = function (pt, extra, y) {
    return [pt[0] + s.dirX * (fuori + (extra || 0)), y === undefined ? pt[1] : y, pt[2] + s.dirZ * (fuori + (extra || 0))];
  };
  const anello = s.anello;
  // contorno esterno: sale in verticale dai due lati fino a un rettangolo largo meta + 3 m e alto 8.2 m sopra la strada
  const largo = s.meta + 3.2;
  const yTetto = s.y + ALTEZZA_GALLERIA + 3.2;
  const esterno = function (lato, y) { return [s.x - fz * 0 + (-s.dirZ) * lato * 1, y, s.z + s.dirX * lato]; };
  const pt = function (lato, y) { return sposta([s.x - s.dirZ * lato, y, s.z + s.dirX * lato], 0); };
  // facciata: fascia tra l'arco (apertura) e il bordo alto, divisa nei tratti dell'arco
  for (let k = 0; k < anello.length - 1; k++) {
    const a = anello[k], b = anello[k + 1];
    // lato dell'arco del punto (distanza di traverso dal centro, con segno)
    const la = (a[0] - s.x) * (-s.dirZ) + (a[2] - s.z) * s.dirX;
    const lb = (b[0] - s.x) * (-s.dirZ) + (b[2] - s.z) * s.dirX;
    const sopraA = pt(Math.max(-largo, Math.min(largo, la * 1.0)), yTetto);
    const sopraB = pt(Math.max(-largo, Math.min(largo, lb * 1.0)), yTetto);
    quad(posizioni, sposta(a), sposta(b), sopraA, sopraB);
  }
  // pilastri laterali (dal bordo dell'apertura al bordo esterno, da terra al tetto)
  const baseSx = sposta(anello[0]), baseDx = sposta(anello[anello.length - 1]);
  quad(posizioni, pt(-largo, s.y - 0.08), [baseSx[0], baseSx[1], baseSx[2]], pt(-largo, yTetto), [baseSx[0], yTetto, baseSx[2]]);
  quad(posizioni, [baseDx[0], baseDx[1], baseDx[2]], pt(largo, s.y - 0.08), [baseDx[0], yTetto, baseDx[2]], pt(largo, yTetto));
  // cornice in rilievo attorno all'arco (una striscia piu' avanti di 0.25 m)
  for (let k = 0; k < anello.length - 1; k++) {
    const a = sposta(anello[k], 0.25 * verso), b = sposta(anello[k + 1], 0.25 * verso);
    const dentroA = sposta(anello[k], 0.25 * verso), dentroB = sposta(anello[k + 1], 0.25 * verso);
    void dentroA; void dentroB;
    const alza = function (q) { return [q[0] - (q[0] - s.x) * 0.0, q[1] + 0.0, q[2]]; };
    // striscia larga 0.6 m verso l'esterno dell'arco (alza il punto verso l'esterno)
    const fuoriA = [a[0] + ((a[0] - s.x) * 0.12), a[1] + 0.5, a[2] + ((a[2] - s.z) * 0.12)];
    const fuoriB = [b[0] + ((b[0] - s.x) * 0.12), b[1] + 0.5, b[2] + ((b[2] - s.z) * 0.12)];
    quad(cornice, alza(a), alza(b), fuoriA, fuoriB);
  }
  // muri d'ala: da ogni lato un muro che parte alto come la facciata e scende fino al terreno in 12 m, lungo la strada all'indietro
  for (const lato of [-1, 1]) {
    const x0 = s.x - s.dirZ * lato * largo, z0 = s.z + s.dirX * lato * largo;
    const lungo = 12;
    const x1 = x0 - s.dirX * verso * lungo, z1 = z0 - s.dirZ * verso * lungo;
    const suolo1 = Math.min(s.y + 0.5, quotaTerreno(terreno, x1, z1));
    const alto0 = [x0 + s.dirX * fuori, yTetto, z0 + s.dirZ * fuori];
    const basso0 = [x0 + s.dirX * fuori, s.y - 0.08, z0 + s.dirZ * fuori];
    const alto1 = [x1, Math.max(suolo1, s.y) + 0.2, z1];
    const basso1 = [x1, s.y - 0.08, z1];
    if (lato < 0) quad(posizioni, basso1, basso0, alto1, alto0); else quad(posizioni, basso0, basso1, alto0, alto1);
  }
}

export function aggiungiOpere(strade, scena, terreno) {
  const tubo = [];
  const portali = [];
  const cornici = [];
  const luci = [];
  const piloni = [];

  for (const strada of strade.lista) {
    const p = strada.p;
    const punti = p.length / 3;
    if (punti < 2) continue;

    if (strada.g) {
      let prima = sezione(p, 0, strada.w);
      for (let i = 1; i < punti; i++) {
        const ora = sezione(p, i, strada.w);
        // il tubo: un quadrilatero per ogni tratto dell'anello (pareti e volta ad arco); il pavimento e' la strada
        for (let k = 0; k < ora.anello.length - 1; k++) {
          quad(tubo, prima.anello[k], ora.anello[k], prima.anello[k + 1], ora.anello[k + 1]);
        }
        if (i % OGNI_QUANTI_PUNTI_LUCE === 0) luci.push(ora.centro);
        prima = ora;
      }
      // Portali solo dove la galleria finisce davvero (non al bordo della mappa)
      for (const [indice, verso] of [[0, -1], [punti - 1, 1]]) {
        const x = p[indice * 3], z = p[indice * 3 + 2];
        if (dentroArea(terreno, x, z, 3)) {
          aggiungiPortale(portali, cornici, sezione(p, indice, strada.w), verso, terreno);
        }
      }
    }

    if (strada.b) {
      for (let i = OGNI_QUANTI_PUNTI_PILONE; i < punti - 2; i += OGNI_QUANTI_PUNTI_PILONE) {
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        const sotto = quotaTerreno(terreno, x, z);
        if (y - sotto > 3) piloni.push([x, sotto - 1, z, y - 0.4 - (sotto - 1)]);
      }
    }
  }

  const cemento = new THREE.MeshLambertMaterial({ color: 0x8e8d87, side: THREE.DoubleSide });
  const cementoChiaro = new THREE.MeshLambertMaterial({ color: 0xb3b0a8, side: THREE.DoubleSide });
  const cementoInterno = new THREE.MeshLambertMaterial({ color: 0x7a7974, side: THREE.DoubleSide });
  for (const [posizioni, materiale] of [[tubo, cementoInterno], [portali, cemento], [cornici, cementoChiaro]]) {
    if (posizioni.length === 0) continue;
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
    geometria.computeVertexNormals();
    geometria.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometria, materiale);
    mesh.receiveShadow = true;
    scena.add(mesh);
  }

  const matrice = new THREE.Matrix4();
  if (luci.length > 0) {
    const lampade = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.1, 1.4),
      new THREE.MeshBasicMaterial({ color: 0xfff0b8 }), luci.length);
    luci.forEach(function (luce, i) {
      matrice.makeTranslation(luce[0], luce[1], luce[2]);
      lampade.setMatrixAt(i, matrice);
    });
    lampade.computeBoundingSphere();
    scena.add(lampade);
  }
  if (piloni.length > 0) {
    const forma = new THREE.BoxGeometry(1.4, 1, 1.4);
    forma.translate(0, 0.5, 0);
    const colonne = new THREE.InstancedMesh(forma, cemento, piloni.length);
    piloni.forEach(function ([x, y, z, altezza], i) {
      matrice.makeScale(1, altezza, 1);
      matrice.setPosition(x, y, z);
      colonne.setMatrixAt(i, matrice);
    });
    colonne.computeBoundingSphere();
    scena.add(colonne);
  }
  return { luci: luci.length, piloni: piloni.length };
}
