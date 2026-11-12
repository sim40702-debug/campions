// TICINO COMPLETO - montagne lontane, oltre il bordo della regione.
//
// La regione caricata e' un quadrato di 24 x 24 km: senza altro, vicino al suo bordo si vedrebbe il mondo finire.
// Qui si disegna, attorno alla regione, il rilievo di tutto il cantone (un punto ogni 250 m circa, dal file
// cantone/rilievo.bin creato dai dati swisstopo): cosi' le montagne e le valli delle regioni vicine si vedono
// gia' da lontano. E' solo paesaggio: niente strade ne' case, e non ci si guida sopra (si cambia regione prima).

import * as THREE from "three";

const SALTO = 4;               // un punto ogni 4 del rilievo (63 m x 4 = 252 m)
const ATTORNO_M = 22000;       // quanto rilievo disegnare attorno alla regione
const DENTRO_M = 700;          // il rilievo lontano comincia 700 m dentro il bordo della regione (niente fessure)
const PIU_BASSO_M = 25;        // e sta un po' piu' in basso, cosi' non buca il terreno vero

export async function aggiungiSfondo(scena, terreno, regioni) {
  if (!regioni) return null;
  let info, valori;
  try {
    const stato = await (await fetch("cantone/stato.json")).json();
    const bin = await fetch("cantone/rilievo.bin");
    if (!bin.ok || !stato.rilievo) return null;
    info = stato.rilievo;
    valori = new Uint16Array(await bin.arrayBuffer());
    if (valori.length !== info.colonne * info.righe) return null;
  } catch (errore) {
    return null;
  }

  const centro = terreno.info.centro_lv95;
  const passo = info.passo_m * SALTO;
  // riquadro del rilievo da disegnare (in punti del rilievo ridotto)
  const c0 = Math.max(0, Math.floor((centro[0] - terreno.metaX - ATTORNO_M - info.est_min) / passo));
  const c1 = Math.min(Math.floor((info.colonne - 1) / SALTO), Math.ceil((centro[0] + terreno.metaX + ATTORNO_M - info.est_min) / passo));
  const r0 = Math.max(0, Math.floor((info.nord_max - (centro[1] + terreno.metaZ + ATTORNO_M)) / passo));
  const r1 = Math.min(Math.floor((info.righe - 1) / SALTO), Math.ceil((info.nord_max - (centro[1] - terreno.metaZ - ATTORNO_M)) / passo));
  const W = c1 - c0 + 1, H = r1 - r0 + 1;
  if (W < 2 || H < 2) return null;

  const posizioni = new Float32Array(W * H * 3);
  const colori = new Float32Array(W * H * 3);
  const valido = new Uint8Array(W * H);
  const dentro = new Uint8Array(W * H);
  const limiteX = terreno.metaX - DENTRO_M, limiteZ = terreno.metaZ - DENTRO_M;
  function quota(c, r) {
    const v = valori[Math.min(info.righe - 1, r * SALTO) * info.colonne + Math.min(info.colonne - 1, c * SALTO)];
    return v === 0 ? null : info.quota_base + v * info.scala_quota;
  }
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      const q = quota(c0 + c, r0 + r);
      const x = info.est_min + (c0 + c) * passo - centro[0];
      const z = -(info.nord_max - (r0 + r) * passo - centro[1]);
      valido[i] = q === null ? 0 : 1;
      dentro[i] = Math.abs(x) < limiteX && Math.abs(z) < limiteZ ? 1 : 0;
      const y = q === null ? 0 : q;
      posizioni[i * 3] = x;
      posizioni[i * 3 + 1] = y - PIU_BASSO_M;
      posizioni[i * 3 + 2] = z;
      // colore: pendenza e quota (come il terreno vero senza foto aerea)
      const qd = quota(Math.min(c0 + c + 1, c1), r0 + r), qs = quota(c0 + c, Math.min(r0 + r + 1, r1));
      const pendenza = Math.hypot((qd === null ? y : qd) - y, (qs === null ? y : qs) - y) / passo;
      const grana = (Math.sin(x * 0.0021 + z * 0.0013) + 1) * 0.02;
      let rr, gg, bb;
      if (y < 194) { rr = 0.17; gg = 0.42; bb = 0.56; }                                 // Lago Maggiore
      else if (pendenza > 0.85) { rr = 0.46; gg = 0.45; bb = 0.42; }                    // roccia
      else if (y > 2300) { rr = 0.56; gg = 0.56; bb = 0.54; }                           // pietraie e cime
      else if (y > 1750) { rr = 0.44 + grana; gg = 0.48 + grana; bb = 0.34; }           // pascoli alti
      else { rr = 0.17 + grana; gg = 0.30 + grana; bb = 0.14; }                         // boschi e prati
      colori[i * 3] = rr;
      colori[i * 3 + 1] = gg;
      colori[i * 3 + 2] = bb;
    }
  }
  const indici = [];
  for (let r = 0; r < H - 1; r++) {
    for (let c = 0; c < W - 1; c++) {
      const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
      if (!valido[a] || !valido[b] || !valido[d] || !valido[e]) continue;     // regione senza dati
      if (dentro[a] && dentro[b] && dentro[d] && dentro[e]) continue;         // li' c'e' il terreno vero
      indici.push(a, d, b, b, d, e);
    }
  }
  if (indici.length === 0) return null;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posizioni, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(colori, 3));
  geometria.setIndex(indici);
  geometria.computeVertexNormals();
  const mesh = new THREE.Mesh(geometria, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  scena.add(mesh);
  return mesh;
}
