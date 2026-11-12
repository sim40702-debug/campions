// Opere stradali: gallerie vere (tubo con luci e portali), piloni sotto i ponti, paravalanghe e dighe.
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
function sezione(p, i, larghezza, alta) {
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
  const spalla = alta - 2.4;          // altezza delle pareti dritte (2.6 m in una galleria normale)
  const freccia = alta - spalla;   // quanto sale la volta sopra le spalle
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
  return { anello: anello, centro: [x, y + alta - 0.15, z], dirX: dx, dirZ: dz, x: x, y: y, z: z, meta: meta, alta: alta };
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
  // la facciata arriva poco sopra il terreno che ha dietro: in un sottopasso basso (sotto l'A13) non resta piu'
  // un muro alto 8 m che spunta dal prato; in montagna resta alta come prima
  let sopra = -Infinity;
  for (const t of [1.5, 4, 7]) sopra = Math.max(sopra, quotaTerreno(terreno, s.x - s.dirX * verso * t, s.z - s.dirZ * verso * t));
  const yTetto = Math.min(s.y + s.alta + 3.2, Math.max(s.y + s.alta + 0.6, sopra + 0.9));
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
    // il muro d'ala serve solo dove dietro c'e' davvero la montagna: in piano restava una "vela" di cemento sul prato
    if (quotaTerreno(terreno, x1, z1) < s.y + 2.5) continue;
    const suolo1 = Math.min(s.y + 0.5, quotaTerreno(terreno, x1, z1));
    const alto0 = [x0 + s.dirX * fuori, yTetto, z0 + s.dirZ * fuori];
    const basso0 = [x0 + s.dirX * fuori, s.y - 0.08, z0 + s.dirZ * fuori];
    const alto1 = [x1, Math.max(suolo1, s.y) + 0.2, z1];
    const basso1 = [x1, s.y - 0.08, z1];
    if (lato < 0) quad(posizioni, basso1, basso0, alto1, alto0); else quad(posizioni, basso0, basso1, alto0, alto1);
  }
}

// Paravalanghe (tunnel=avalanche_protector in OpenStreetMap): la strada resta all'aperto, coperta da una soletta di
// cemento che appoggia su un muro dal lato della montagna e su una fila di pilastri dal lato della valle.
const ALTEZZA_PARAVALANGHE = 4.8;
function aggiungiParavalanghe(strada, terreno, posizioni, pilastri) {
  const p = strada.p, punti = p.length / 3;
  // da che lato sta la montagna? dove il terreno a 7 m dal bordo e' piu' alto
  let somma = 0;
  const dir = [];
  for (let i = 0; i < punti; i++) {
    const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, punti - 1) * 3;
    let dx = p[b] - p[a], dz = p[b + 2] - p[a + 2];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    dir.push([dx, dz]);
    const fuori = strada.w / 2 + 7;
    somma += quotaTerreno(terreno, p[i * 3] - dz * fuori, p[i * 3 + 2] + dx * fuori) - quotaTerreno(terreno, p[i * 3] + dz * fuori, p[i * 3 + 2] - dx * fuori);
  }
  const monte = somma >= 0 ? 1 : -1;
  const meta = strada.w / 2;
  const pt = function (i, lato, alto) { return [p[i * 3] - dir[i][1] * lato, p[i * 3 + 1] + alto, p[i * 3 + 2] + dir[i][0] * lato]; };
  const A = ALTEZZA_PARAVALANGHE, S = 0.55;   // luce libera e spessore della soletta
  const dentro = monte * (meta + 0.7), fuori = -monte * (meta + 1.1);
  let fatta = 0, prossimo = 0;
  for (let i = 0; i < punti; i++) {
    if (i > 0) {
      fatta += Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 2] - p[i * 3 - 1]);
      const j = i - 1;
      quad(posizioni, pt(j, dentro, -0.3), pt(i, dentro, -0.3), pt(j, dentro, A), pt(i, dentro, A));          // muro a monte
      quad(posizioni, pt(j, dentro, A), pt(i, dentro, A), pt(j, fuori, A), pt(i, fuori, A));                  // soffitto
      quad(posizioni, pt(j, dentro, A + S), pt(i, dentro, A + S), pt(j, fuori, A + S), pt(i, fuori, A + S));  // sopra la soletta
      quad(posizioni, pt(j, fuori, A - 0.35), pt(i, fuori, A - 0.35), pt(j, fuori, A + S), pt(i, fuori, A + S));   // trave di bordo verso valle
    }
    if (fatta >= prossimo || i === punti - 1) {
      prossimo = fatta + 5;
      const q = pt(i, -monte * (meta + 0.75), -0.3);
      pilastri.push([q[0], q[1], q[2], A + 0.3, Math.atan2(-dir[i][1], dir[i][0])]);
    }
  }
  // le due testate (lo spessore della soletta visto arrivando)
  for (const i of [0, punti - 1]) quad(posizioni, pt(i, dentro, A), pt(i, fuori, A), pt(i, dentro, A + S), pt(i, fuori, A + S));
}

export function aggiungiOpere(strade, scena, terreno) {
  const tubo = [];
  const portali = [];
  const cornici = [];
  const luci = [];
  const piloni = [];
  const paravalanghe = [];
  const pilastri = [];

  for (const strada of strade.lista) {
    const p = strada.p;
    const punti = p.length / 3;
    if (punti < 2) continue;

    if (strada.g) {
      const alta = strada.alta || ALTEZZA_GALLERIA;   // i sottopassi corti sono piu' bassi (vedi strade.js)
      // Dove comincia davvero la roccia? In OpenStreetMap la galleria e' spesso disegnata qualche metro piu' lunga
      // della montagna che c'e' nel modello del terreno: li' il tubo restava all'aperto, sospeso sopra il pendio.
      // Il tubo (e il portale) cominciano dal primo punto coperto dal terreno, al massimo 40 m dopo il capo.
      let primo = 0, ultimo = punti - 1;
      if (!strada.alta) {
        const coperto = function (i) { return quotaTerreno(terreno, p[i * 3], p[i * 3 + 2]) >= p[i * 3 + 1] + alta - 1; };
        let fatta = 0;
        while (primo < punti - 3 && fatta < 40 && !coperto(primo)) { fatta += Math.hypot(p[primo * 3 + 3] - p[primo * 3], p[primo * 3 + 5] - p[primo * 3 + 2]); primo++; }
        fatta = 0;
        while (ultimo > primo + 2 && fatta < 40 && !coperto(ultimo)) { fatta += Math.hypot(p[ultimo * 3] - p[ultimo * 3 - 3], p[ultimo * 3 + 2] - p[ultimo * 3 - 1]); ultimo--; }
        if (!coperto(primo) || !coperto(ultimo)) { primo = 0; ultimo = punti - 1; }   // mai coperta: resta com'era
      }
      let prima = sezione(p, primo, strada.w, alta);
      for (let i = primo + 1; i <= ultimo; i++) {
        const ora = sezione(p, i, strada.w, alta);
        // il tubo: un quadrilatero per ogni tratto dell'anello (pareti e volta ad arco); il pavimento e' la strada
        for (let k = 0; k < ora.anello.length - 1; k++) {
          quad(tubo, prima.anello[k], ora.anello[k], prima.anello[k + 1], ora.anello[k + 1]);
        }
        // pavimento: le due banchine tra l'asfalto e le pareti (prima li' non c'era niente: si vedeva il vuoto)
        const fine = ora.anello.length - 1;
        quad(tubo, prima.anello[0], ora.anello[0], prima.anello[fine], ora.anello[fine]);
        if (i % OGNI_QUANTI_PUNTI_LUCE === 0) luci.push(ora.centro);
        prima = ora;
      }
      // Portali solo dove la galleria finisce davvero (non al bordo della mappa)
      for (const [indice, verso] of [[primo, -1], [ultimo, 1]]) {
        const x = p[indice * 3], z = p[indice * 3 + 2];
        if (dentroArea(terreno, x, z, 3)) {
          aggiungiPortale(portali, cornici, sezione(p, indice, strada.w, alta), verso, terreno);
        }
      }
    }

    if (strada.pv && !strada.g) aggiungiParavalanghe(strada, terreno, paravalanghe, pilastri);

    if (strada.b && !strada.riemp) {
      for (let i = OGNI_QUANTI_PUNTI_PILONE; i < punti - 2; i += OGNI_QUANTI_PUNTI_PILONE) {
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        const sotto = quotaTerreno(terreno, x, z);
        if (y - sotto > 3) piloni.push([x, sotto - 1, z, y - 0.4 - (sotto - 1)]);
      }
    }
  }

  const cemento = new THREE.MeshLambertMaterial({ color: 0x8e8d87, side: THREE.DoubleSide });
  const cementoChiaro = new THREE.MeshLambertMaterial({ color: 0xb3b0a8, side: THREE.DoubleSide });
  const cementoInterno = new THREE.MeshLambertMaterial({ color: 0x7a7974, emissive: 0x24241f, side: THREE.DoubleSide });   // un po' di luce propria: dentro non e' nero pece
  for (const [posizioni, materiale] of [[tubo, cementoInterno], [portali, cemento], [cornici, cementoChiaro], [paravalanghe, cementoChiaro]]) {
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
  if (pilastri.length > 0) {
    const forma = new THREE.BoxGeometry(0.45, 1, 0.45);
    forma.translate(0, 0.5, 0);
    const colonne = new THREE.InstancedMesh(forma, cementoChiaro, pilastri.length);
    pilastri.forEach(function ([x, y, z, altezza, angolo], i) {
      matrice.makeRotationY(angolo);
      matrice.scale(new THREE.Vector3(1, altezza, 1));
      matrice.setPosition(x, y, z);
      colonne.setMatrixAt(i, matrice);
    });
    colonne.computeBoundingSphere();
    colonne.castShadow = true;
    scena.add(colonne);
  }
  return { luci: luci.length, piloni: piloni.length, paravalanghe: paravalanghe.length > 0 ? 1 : 0 };
}

// --- Dighe ------------------------------------------------------------------------------------------------
// La diga di Contra (Valle Verzasca): 220 m di cemento che chiudono il Lago di Vogorno. Nel modello del terreno
// c'e' solo a pezzi (e' un muro sottile), quindi si costruisce qui dal contorno di OpenStreetMap: un muro
// verticale dal coronamento fino alla roccia, il camminamento in cima e i due parapetti.
export async function caricaDighe() {
  try {
    const risposta = await fetch("dati/opere.json");
    if (!risposta.ok) return [];
    return (await risposta.json()).dighe || [];
  } catch (errore) {
    return [];   // dati vecchi senza opere.json: il gioco funziona lo stesso
  }
}

// Cemento a vista di una diga: riprese di getto orizzontali, giunti verticali, colature scure. Copre 16 x 16 m.
function texturaCementoDiga() {
  const L = 512;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d");
  let seme = 4242;
  const rnd = function () { seme = (seme * 1664525 + 1013904223) >>> 0; return seme / 4294967296; };
  g.fillStyle = "#b4b1a8";
  g.fillRect(0, 0, L, L);
  for (let i = 0; i < 60; i++) {   // getti di colore un po' diverso
    const v = 150 + Math.floor(rnd() * 50);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v - 6) + ",0.2)";
    g.fillRect(Math.floor(rnd() * 4) * 128, Math.floor(rnd() * 8) * 64, 128, 64);
  }
  for (let i = 0; i < 16000; i++) {
    const v = 120 + Math.floor(rnd() * 110);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v - 5) + ",0.22)";
    g.fillRect(rnd() * L, rnd() * L, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  g.fillStyle = "rgba(40,40,38,0.3)";
  for (let y = 0; y < L; y += 64) g.fillRect(0, y, L, 2);      // riprese di getto: una ogni 2 m
  g.fillStyle = "rgba(30,30,28,0.42)";
  g.fillRect(0, 0, 3, L);                                      // giunto verticale: uno ogni 16 m
  for (let i = 0; i < 22; i++) {                               // colature d'acqua e muschio
    const x = rnd() * L, w = 3 + rnd() * 14;
    const gr = g.createLinearGradient(0, 0, 0, L);
    gr.addColorStop(0, "rgba(35,38,32," + (0.1 + rnd() * 0.22) + ")");
    gr.addColorStop(1, "rgba(35,38,32,0.05)");
    g.fillStyle = gr;
    g.fillRect(x, 0, w, L);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function aggiungiDighe(dighe, scena, terreno) {
  if (!dighe || dighe.length === 0) return 0;
  const pos = [], uv = [];
  const tri = function (a, b, c, ua, ub, uc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };
  for (const diga of dighe) {
    const p = diga.p, n = p.length / 2;
    if (n < 3) continue;
    const cima = diga.cima;
    // verso del contorno (per sapere da che parte e' "fuori")
    let area = 0;
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; area += p[k * 2] * p[j * 2 + 1] - p[j * 2] * p[k * 2 + 1]; }
    const verso = Math.sign(area) || 1;
    // contorno con un punto almeno ogni 5 m: per ognuno la quota della roccia ai piedi del muro
    const giro = [];
    let fatta = 0;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n;
      const ax = p[k * 2], az = p[k * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1];
      const lungo = Math.hypot(bx - ax, bz - az);
      if (lungo < 0.05) continue;
      const nx = verso * (bz - az) / lungo, nz = -verso * (bx - ax) / lungo;
      const passi = Math.max(1, Math.ceil(lungo / 5));
      for (let q = 0; q < passi; q++) {
        const t = q / passi;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        let sotto = quotaTerreno(terreno, x, z);
        for (const d of [4, 9, 16, 24]) sotto = Math.min(sotto, quotaTerreno(terreno, x + nx * d, z + nz * d));
        giro.push({ x: x, z: z, nx: nx, nz: nz, u: (fatta + lungo * t) / 16, sotto: Math.min(sotto - 6, cima - 2) });
      }
      fatta += lungo;
    }
    const m = giro.length;
    for (let i = 0; i < m; i++) {
      const a = giro[i], b = giro[(i + 1) % m];
      const ub = i + 1 === m ? fatta / 16 : b.u;
      // muro: dal coronamento fino alla roccia
      const a1 = [a.x, cima, a.z], b1 = [b.x, cima, b.z], a0 = [a.x, a.sotto, a.z], b0 = [b.x, b.sotto, b.z];
      tri(a0, b0, b1, [a.u, a.sotto / 16], [ub, b.sotto / 16], [ub, cima / 16]);
      tri(a0, b1, a1, [a.u, a.sotto / 16], [ub, cima / 16], [a.u, cima / 16]);
      // parapetto: 1.1 m, appena dentro il bordo
      const o = -0.25;
      const pa = [a.x + a.nx * o, cima, a.z + a.nz * o], pb = [b.x + b.nx * o, cima, b.z + b.nz * o];
      const qa = [pa[0], cima + 1.1, pa[2]], qb = [pb[0], cima + 1.1, pb[2]];
      tri(pa, pb, qb, [a.u, 0], [ub, 0], [ub, 0.07]);
      tri(pa, qb, qa, [a.u, 0], [ub, 0.07], [a.u, 0.07]);
    }
    // camminamento del coronamento
    const contorno = [];
    for (let k = 0; k < n; k++) contorno.push(new THREE.Vector2(p[k * 2], p[k * 2 + 1]));
    for (const t of THREE.ShapeUtils.triangulateShape(contorno, [])) {
      const v = t.map(function (k) { return [contorno[k].x, cima, contorno[k].y]; });
      tri(v[0], v[1], v[2], [v[0][0] / 16, v[0][2] / 16], [v[1][0] / 16, v[1][2] / 16], [v[2][0] / 16, v[2][2] / 16]);
    }
  }
  if (pos.length === 0) return 0;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometria.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometria.computeVertexNormals();
  geometria.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({ map: texturaCementoDiga(), roughness: 0.93, metalness: 0, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  scena.add(mesh);
  return dighe.length;
}
