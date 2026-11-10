// Segnaletica stradale svizzera (Ticino): cartelli con le forme e i colori giusti e i segni sull'asfalto.
//  - STOP: ottagono rosso con bordo bianco; linea di arresto continua bianca davanti;
//  - Dare precedenza ("Cedere il passo"): triangolo con la punta in basso, bordo rosso; davanti i "denti di squalo" bianchi;
//  - Strada con diritto di precedenza (Hauptstrasse): rombo giallo con bordo bianco e nero, ai bordi dei paesi;
//  - Limite di velocita': cerchio bianco con bordo rosso (50 ai bordi dei paesi); Zona 30 nelle vie residenziali;
//  - Rotonda: cerchio blu con le tre frecce bianche + "dare precedenza" all'ingresso;
//  - Attenzione pedoni: quadrato blu con triangolo bianco (davanti alle strisce, gialle come in Svizzera).
// I cartelli stanno al bordo destro della strada, girati verso chi arriva; le posizioni di stop, precedenze e strisce
// sono quelle vere di OpenStreetMap (agganciate alla strada piu' vicina).

import * as THREE from "three";
import { unisci, aBordoStrada } from "./dettagli.js";
import { zonaQui, ZONA, dentroEdificio } from "./edifici.js";
import { sullAsfalto } from "./strade.js";

function tela(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function struttura(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function poligono(g, n, r, rot) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

function texStop() {
  const c = tela(256, 256), g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  poligono(g, 8, 124, Math.PI / 8);
  g.fill();
  g.fillStyle = "#c8171e";
  poligono(g, 8, 112, Math.PI / 8);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "bold 84px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("STOP", 128, 132);
  return struttura(c);
}
function texCedere() {
  const c = tela(256, 256), g = c.getContext("2d");
  // triangolo con la punta in basso, bordo rosso largo
  const tri = function (r, colore) {
    g.fillStyle = colore;
    g.beginPath();
    g.moveTo(128 - r * 0.866, 128 - r * 0.5 - 10);
    g.lineTo(128 + r * 0.866, 128 - r * 0.5 - 10);
    g.lineTo(128, 128 + r - 10);
    g.closePath();
    g.fill();
  };
  tri(150, "#c8171e");
  tri(104, "#ffffff");
  return struttura(c);
}
function texPrecedenza() {
  const c = tela(256, 256), g = c.getContext("2d");
  poligono(g, 4, 178, Math.PI / 4 * 1);   // quadrato ruotato di 45 gradi (rombo)
  g.fillStyle = "#ffffff";
  poligono(g, 4, 124, Math.PI / 4);
  g.fill();
  g.fillStyle = "#111";
  poligono(g, 4, 112, Math.PI / 4);
  g.fill();
  g.fillStyle = "#f5c400";
  poligono(g, 4, 96, Math.PI / 4);
  g.fill();
  return struttura(c);
}
function texLimite(numero, conZona) {
  const c = tela(256, conZona ? 340 : 256), g = c.getContext("2d");
  g.fillStyle = "#c8171e";
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(128, 128, 88, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.font = "bold 104px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(numero), 128, 136);
  if (conZona) {
    g.fillStyle = "#fff";
    g.fillRect(40, 262, 176, 66);
    g.strokeStyle = "#111";
    g.lineWidth = 5;
    g.strokeRect(40, 262, 176, 66);
    g.fillStyle = "#111";
    g.font = "bold 40px Arial";
    g.fillText("ZONE", 128, 296);
  }
  return struttura(c);
}
function texRotonda() {
  const c = tela(256, 256), g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#0b57a4";
  g.beginPath();
  g.arc(128, 128, 114, 0, Math.PI * 2);
  g.fill();
  // tre frecce che girano in senso antiorario (si circola a destra in senso antiorario)
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineWidth = 16;
  for (let k = 0; k < 3; k++) {
    const a0 = k * (Math.PI * 2 / 3) + 0.25, a1 = a0 + 1.35;
    g.beginPath();
    g.arc(128, 128, 56, a0, a1);
    g.stroke();
    const px = 128 + Math.cos(a1) * 56, pz = 128 + Math.sin(a1) * 56;
    const tx = -Math.sin(a1), tz = Math.cos(a1);   // direzione della freccia
    g.beginPath();
    g.moveTo(px + tx * 30, pz + tz * 30);
    g.lineTo(px - tz * 22 - tx * 6, pz + tx * 22 - tz * 6);
    g.lineTo(px + tz * 22 - tx * 6, pz - tx * 22 - tz * 6);
    g.closePath();
    g.fill();
  }
  return struttura(c);
}
function texPedoni() {
  const c = tela(256, 256), g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#0b57a4";
  g.fillRect(10, 10, 236, 236);
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(128, 36);
  g.lineTo(226, 216);
  g.lineTo(30, 216);
  g.closePath();
  g.fill();
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(128, 118, 11, 0, Math.PI * 2);
  g.fill();
  g.fillRect(120, 132, 16, 44);
  g.fillRect(104, 176, 16, 24);
  g.fillRect(136, 176, 16, 24);
  g.fillRect(104, 136, 48, 10);
  return struttura(c);
}

function matSegnale(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.15, alphaTest: 0.5, side: THREE.FrontSide });
}

// Il retro del cartello: stessa sagoma, grigio lamiera (il disegno si vede solo davanti)
function matRetro(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, color: 0x000000, emissive: 0x6f7378, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.3, alphaTest: 0.5, side: THREE.FrontSide });
}

// Pannello: la faccia guarda -z (verso chi arriva) e sta DAVANTI al palo; il palo resta dietro.
function pannello(larg, alt, y) {
  const g = new THREE.PlaneGeometry(larg, alt);
  g.rotateY(Math.PI);
  g.translate(0, y, -0.05);
  return g;
}
function retro(larg, alt, y) {
  const g = new THREE.PlaneGeometry(larg, alt);
  g.translate(0, y, -0.045);
  return g;
}
function palo(altezza) {
  const g = new THREE.CylinderGeometry(0.035, 0.035, altezza, 6);
  g.translate(0, altezza / 2, 0);
  return unisci([[g, 0x8d9096]]);
}

function istanze(oggetti, forma, materiale, scena, ombra) {
  if (oggetti.length === 0) return;
  const celle = new Map();
  for (const o of oggetti) {
    const k = Math.floor(o.x / 400) + "," + Math.floor(o.z / 400);
    let l = celle.get(k);
    if (!l) { l = []; celle.set(k, l); }
    l.push(o);
  }
  const q = new THREE.Quaternion(), asse = new THREE.Vector3(0, 1, 0), uno = new THREE.Vector3(1, 1, 1), mat = new THREE.Matrix4(), pos = new THREE.Vector3();
  for (const lista of celle.values()) {
    const m = new THREE.InstancedMesh(forma, materiale, lista.length);
    for (let i = 0; i < lista.length; i++) {
      q.setFromAxisAngle(asse, lista[i].angolo);
      mat.compose(pos.set(lista[i].x, lista[i].y, lista[i].z), q, uno);
      m.setMatrixAt(i, mat);
    }
    m.castShadow = ombra !== false;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    scena.add(m);
  }
}

// Segni sull'asfalto: linea di arresto (STOP) e denti di squalo (precedenza)
function segniAsfalto(punti, scena) {
  const posizioni = [];
  const lato = function (cx, cz, dx, dz, lat, lung, y, larg, spess) {
    // rettangolo centrato in (cx, cz) + r*lat, lungo la strada = spess, di traverso = larg
    const rx = -dz, rz = dx;
    const px = cx + rx * lat, pz = cz + rz * lat;
    const a = [px - rx * larg / 2 - dx * spess / 2, y, pz - rz * larg / 2 - dz * spess / 2];
    const b = [px + rx * larg / 2 - dx * spess / 2, y, pz + rz * larg / 2 - dz * spess / 2];
    const c = [px + rx * larg / 2 + dx * spess / 2, y, pz + rz * larg / 2 + dz * spess / 2];
    const d = [px - rx * larg / 2 + dx * spess / 2, y, pz - rz * larg / 2 + dz * spess / 2];
    posizioni.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  for (const p of punti) {
    const s = p.strada;
    const larg = s.larghezza / 2 - 0.5;
    if (larg < 1) continue;
    const y = s.y + 0.045;
    const cx = s.x - s.dirX * 1.2, cz = s.z - s.dirZ * 1.2;
    if (p.tipo === "stop") {
      lato(cx, cz, s.dirX, s.dirZ, s.larghezza / 4, larg, y, larg, 0.5);
    } else {
      // denti di squalo: triangoli con la punta verso chi arriva (-dir)
      const n = Math.max(2, Math.floor(larg / 0.55));
      const rx = -s.dirZ, rz = s.dirX;
      for (let i = 0; i < n; i++) {
        const lat = s.larghezza / 4 - larg / 2 + (i + 0.5) * (larg / n);
        const bx = cx + rx * lat, bz = cz + rz * lat;
        const mezza = larg / n * 0.42;
        const baseA = [bx - rx * mezza, y, bz - rz * mezza], baseB = [bx + rx * mezza, y, bz + rz * mezza];
        const punta = [bx - s.dirX * 0.7, y, bz - s.dirZ * 0.7];
        posizioni.push(...baseA, ...baseB, ...punta);
      }
    }
  }
  if (posizioni.length === 0) return 0;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }));
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  scena.add(m);
  return posizioni.length / 9;
}

export function creaSegnali(scena, terreno, strade, ctx, dettagli) {
  const ris = { stop: 0, cedere: 0, precedenza: 0, limite50: 0, zona30: 0, rotonda: 0, segni: 0 };
  const ps = (lista, sp) => {
    const r = [];
    for (let i = 0; i + 1 < lista.length; i += 2) {
      const o = aBordoStrada(strade, terreno, lista[i], lista[i + 1], sp, true);
      // solo cartelli veri: agganciati a una strada, fuori dall'asfalto e fuori dai muri
      if (o.strada && !o.strada.scarta && !dentroEdificio(ctx.edifici, o.x, o.z, o.y + 1)) r.push(o);
    }
    return r;
  };
  const stop = ps(dettagli.stop, 0.8), cedere = ps(dettagli.precedenza, 0.8);

  // STOP e precedenza: cartello + linea sull'asfalto (solo dove c'e' davvero una strada vicina)
  const conStrada = (lista, tipo) => lista.filter((o) => o.strada).map((o) => ({ tipo: tipo, strada: o.strada }));
  const segni = conStrada(stop, "stop").concat(conStrada(cedere, "cedere"));
  ris.segni = segniAsfalto(segni, scena);

  const dritti = (lista) => lista.map((o) => ({ x: o.x, y: o.y, z: o.z, angolo: o.angolo }));
  const forma = (larg, alt, y, h) => unisci([[palo(h), 0x8d9096]]).clone();
  const pannelli = [
    [stop, texStop(), 0.9, 0.9, 2.3, 2.5, "stop"],
    [cedere, texCedere(), 0.95, 0.95, 2.3, 2.5, "cedere"]
  ];
  for (const [lista, tex, larg, alt, y, h, nome] of pannelli) {
    istanze(dritti(lista), palo(h), new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.5, metalness: 0.4 }), scena);
    istanze(dritti(lista), pannello(larg, alt, y), matSegnale(tex), scena, false);
    istanze(dritti(lista), retro(larg, alt, y), matRetro(tex), scena, false);
    ris[nome] = lista.length;
  }
  void forma;

  // Cartelli derivati dalla geometria vera: bordi dei paesi (precedenza + 50), zone 30, rotonde
  const luoghi = ctx.luoghi.lista;
  const diamanti = [], limiti = [], zone = [], rotonde = [], cedereRot = [];
  const visti = new Set();
  const lato = (s, p0, p1, i, sp) => {
    // punto a destra della marcia sul segmento i -> i+1
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
    const l = Math.hypot(dx, dz) || 1;
    return { dx: dx / l, dz: dz / l, nx: -dz / l, nz: dx / l, sp: s.w / 2 + sp };
  };
  void lato;
  for (const luogo of luoghi) {
    const entrata = luogo.t === "city" ? 650 : (luogo.t === "town" ? 500 : 380);
    for (const strada of strade.lista) {
      if (strada.g || strada.b || strada.w < 5.5) continue;
      if (strada.t !== "primary" && strada.t !== "secondary" && strada.t !== "tertiary" && strada.t !== "trunk") continue;
      const p = strada.p;
      for (let i = 3; i < p.length; i += 3) {
        const d0 = Math.hypot(p[i - 3] - luogo.x, p[i - 1] - luogo.z), d1 = Math.hypot(p[i] - luogo.x, p[i + 2] - luogo.z);
        if ((d0 - entrata) * (d1 - entrata) >= 0) continue;
        const t = (entrata - d0) / (d1 - d0);
        const x = p[i - 3] + (p[i] - p[i - 3]) * t, z = p[i - 1] + (p[i + 2] - p[i - 1]) * t;
        const chiave = Math.round(x / 80) + "," + Math.round(z / 80);
        if (visti.has(chiave)) continue;
        visti.add(chiave);
        const verso = d1 < d0 ? 1 : -1;
        const dx = (p[i] - p[i - 3]) * verso, dz = (p[i + 2] - p[i - 1]) * verso;
        const l = Math.hypot(dx, dz) || 1;
        const px = x + (-dz / l) * (strada.w / 2 + 1.1), pz = z + (dx / l) * (strada.w / 2 + 1.1);
        const py = Math.max(p[i + 1], p[i - 2]);
        const ang = Math.atan2(-dx, -dz) + Math.PI;
        // il palo del cartello del paese e' a 1.0 m: questi stanno 3 m e 28 m dopo/prima, cosi' non si sovrappongono
        diamanti.push({ x: px + dx / l * 4, y: py, z: pz + dz / l * 4, angolo: ang });
        limiti.push({ x: px - dx / l * 25, y: py, z: pz - dz / l * 25, angolo: ang });
      }
    }
  }
  // zone 30: all'inizio delle vie residenziali dei quartieri abitati
  for (const strada of strade.lista) {
    if (strada.g || strada.b || strada.t !== "residential" || strada.w < 4) continue;
    const p = strada.p;
    if (p.length < 12) continue;
    const info = zonaQui(ctx.edifici, p[0], p[2]);
    if (info.densita < 0.1 || info.zona === ZONA.INDUSTRIALE) continue;
    const chiave = Math.round(p[0] / 120) + "," + Math.round(p[2] / 120);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    const dx = p[3] - p[0], dz = p[5] - p[2];
    const l = Math.hypot(dx, dz) || 1;
    zone.push({ x: p[0] + (-dz / l) * (strada.w / 2 + 0.9) + dx / l * 3, y: p[1], z: p[2] + (dx / l) * (strada.w / 2 + 0.9) + dz / l * 3, angolo: Math.atan2(dx, dz) });
  }
  // rotonde: per ogni strada che finisce sull'anello, cartello "rotonda" e "dare precedenza" poco prima
  const anelli = strade.lista.filter((s) => s.j === "roundabout");
  for (const anello of anelli) {
    const pa = anello.p;
    for (const strada of strade.lista) {
      if (strada === anello || strada.g || strada.b) continue;
      const p = strada.p, n = p.length / 3;
      for (const fine of [0, n - 1]) {
        const ex = p[fine * 3], ez = p[fine * 3 + 2];
        let tocca = false;
        for (let k = 0; k < pa.length; k += 3) if (Math.hypot(pa[k] - ex, pa[k + 2] - ez) < 3) { tocca = true; break; }
        if (!tocca) continue;
        const k1 = fine === 0 ? 1 : n - 2;
        let dx = ex - p[k1 * 3], dz = ez - p[k1 * 3 + 2];   // direzione di avvicinamento all'anello
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        const px = ex - dx * 14 + (-dz) * (strada.w / 2 + 0.9), pz = ez - dz * 14 + dx * (strada.w / 2 + 0.9);
        const py = p[fine * 3 + 1];
        const ang = Math.atan2(dx, dz);
        rotonde.push({ x: px, y: py, z: pz, angolo: ang });
        cedereRot.push({ x: px + (-dz) * 0.0 - dx * 4, y: py, z: pz - dz * 4, angolo: ang });
      }
    }
  }
  const pal = new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.5, metalness: 0.4 });
  const gruppi = [
    [diamanti, texPrecedenza(), 0.8, 0.8, 2.3, 2.6, "precedenza"],
    [limiti, texLimite(50, false), 0.7, 0.7, 2.3, 2.6, "limite50"],
    [zone, texLimite(30, true), 0.7, 0.92, 2.2, 2.6, "zona30"],
    [rotonde, texRotonda(), 0.8, 0.8, 2.3, 2.6, "rotonda"],
    [cedereRot, texCedere(), 0.9, 0.9, 2.3, 2.6, "cedere"]
  ];
  for (const [tutti, tex, larg, alt, y, h, nome] of gruppi) {
    // mai sull'asfalto (per esempio di una strada laterale) e mai dentro un edificio
    const lista = tutti.filter((o) => !sullAsfalto(strade, o.x, o.z, 0.3) && !dentroEdificio(ctx.edifici, o.x, o.z, o.y + 1));
    if (lista.length === 0) continue;
    istanze(lista, palo(h), pal, scena);
    istanze(lista, pannello(larg, alt, y + (nome === "zona30" ? -0.12 : 0)), matSegnale(tex), scena, false);
    istanze(lista, retro(larg, alt, y + (nome === "zona30" ? -0.12 : 0)), matRetro(tex), scena, false);
    ris[nome] = (ris[nome] || 0) + lista.length;
  }
  void texPedoni;
  return ris;
}

export { texPedoni };
