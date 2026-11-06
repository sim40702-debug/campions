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

function sezione(p, i, larghezza) {
  // Punti della sezione della galleria nel punto i: sinistra/destra, in basso/in alto
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
  return {
    sx: [x - dz * meta, y - 0.08, z + dx * meta],
    dx: [x + dz * meta, y - 0.08, z - dx * meta],
    sxAlto: [x - dz * meta, y + ALTEZZA_GALLERIA, z + dx * meta],
    dxAlto: [x + dz * meta, y + ALTEZZA_GALLERIA, z - dx * meta],
    centro: [x, y + ALTEZZA_GALLERIA - 0.1, z],
    dirX: dx,
    dirZ: dz
  };
}

function aggiungiPortale(posizioni, s, verso) {
  // Facciata di cemento attorno all'ingresso, larga 2 m in piu' per lato e alta 2 m in piu'
  const fx = -s.dirZ, fz = s.dirX;   // direzione di traverso
  const allarga = 2;
  const [x1, y1, z1] = s.sx;
  const [x2, , z2] = s.dx;
  const yAlto = s.sxAlto[1];
  const ox = s.dirX * 0.3 * verso, oz = s.dirZ * 0.3 * verso;
  const esternoSx = [x1 + fx * allarga + ox, y1, z1 + fz * allarga + oz];
  const esternoDx = [x2 - fx * allarga + ox, y1, z2 - fz * allarga + oz];
  const internoSx = [x1 + ox, y1, z1 + oz];
  const internoDx = [x2 + ox, y1, z2 + oz];
  const alto = function (punto, y) { return [punto[0], y, punto[2]]; };
  // pilastro sinistro, pilastro destro, trave sopra
  quad(posizioni, esternoSx, internoSx, alto(esternoSx, yAlto + 2), alto(internoSx, yAlto + 2));
  quad(posizioni, internoDx, esternoDx, alto(internoDx, yAlto + 2), alto(esternoDx, yAlto + 2));
  quad(posizioni, alto(internoSx, yAlto), alto(internoDx, yAlto), alto(internoSx, yAlto + 2), alto(internoDx, yAlto + 2));
}

export function aggiungiOpere(strade, scena, terreno) {
  const tubo = [];
  const portali = [];
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
        quad(tubo, prima.sx, ora.sx, prima.sxAlto, ora.sxAlto);            // muro sinistro
        quad(tubo, ora.dx, prima.dx, ora.dxAlto, prima.dxAlto);            // muro destro
        quad(tubo, prima.sxAlto, ora.sxAlto, prima.dxAlto, ora.dxAlto);    // soffitto
        quad(tubo, prima.dx, ora.dx, prima.sx, ora.sx);                    // pavimento
        if (i % OGNI_QUANTI_PUNTI_LUCE === 0) luci.push(ora.centro);
        prima = ora;
      }
      // Portali solo dove la galleria finisce davvero (non al bordo della mappa)
      for (const [indice, verso] of [[0, -1], [punti - 1, 1]]) {
        const x = p[indice * 3], z = p[indice * 3 + 2];
        if (dentroArea(terreno, x, z, 3)) {
          aggiungiPortale(portali, sezione(p, indice, strada.w), verso);
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
  for (const posizioni of [tubo, portali]) {
    if (posizioni.length === 0) continue;
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
    geometria.computeVertexNormals();
    scena.add(new THREE.Mesh(geometria, cemento));
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
