// Incroci veri: per ogni nodo dove si incontrano tre o piu' bracci di strada (T, incroci a 4 e piu' vie, entrate delle
// rotonde) si calcola la forma reale dell'incrocio a partire dalle strade OpenStreetMap che ci arrivano:
//  - i bracci (direzione e larghezza di ogni strada che arriva al nodo);
//  - tra due bracci vicini un RACCORDO CIRCOLARE tangente ai due bordi (raggio da 3.5 a 9 m secondo la larghezza):
//    e' lo "smusso" dell'angolo, il raggio di curva dei cordoli degli incroci veri; l'asfalto lo riempie e
//    non resta piu' un angolo vivo con il buco di mezzo;
//  - cordolo alto 12 cm e marciapiede che girano attorno all'angolo (se in quel punto c'e' il marciapiede);
//  - rotonde: isola spartitraffico con cordolo sui rami a due sensi e linea di dare precedenza all'entrata.
// Le posizioni degli incroci, gli angoli e le larghezze sono quelli dei dati OpenStreetMap: nulla e' inventato.
// Sono APPROSSIMAZIONI (non misurate): il raggio dei raccordi, la lunghezza delle isole e la linea di precedenza.
// Dopo, dettagli.js disegna le linee di STOP e di precedenza dove OpenStreetMap ha il cartello (stop, give_way, semaforo).

import * as THREE from "three";

const COLORE_CORDOLO = new THREE.Color(0xd8d5cd);
const COLORE_TOP = new THREE.Color(0xffffff);
const ALTEZZA_CORDOLO = 0.12;

// --- Bracci ---------------------------------------------------------------------------------------------------
// Un braccio: dalla posizione del nodo, la strada s va verso i punti i+1 (avanti) oppure i-1 (indietro).
function braccio(strada, s, i, verso, larghezzaIn) {
  const p = strada.p, n = p.length / 3;
  const P = [{ x: p[i * 3], z: p[i * 3 + 2], y: p[i * 3 + 1], d: 0 }];
  for (let k = i + verso; k >= 0 && k < n && P[P.length - 1].d < 40; k += verso) {
    const prec = P[P.length - 1];
    const l = Math.hypot(p[k * 3] - prec.x, p[k * 3 + 2] - prec.z);
    if (l < 0.01) continue;
    P.push({ x: p[k * 3], z: p[k * 3 + 2], y: p[k * 3 + 1], d: prec.d + l });
  }
  // direzione: dal nodo al primo punto ad almeno 4 m (o l'ultimo)
  let j = 1;
  while (j < P.length - 1 && P[j].d < 4) j++;
  let ux = 1, uz = 0;
  if (P.length > 1) {
    const l = Math.hypot(P[j].x - P[0].x, P[j].z - P[0].z) || 1;
    ux = (P[j].x - P[0].x) / l; uz = (P[j].z - P[0].z) / l;
  }
  // tratto dritto: finche' la strada resta entro 35 cm dalla retta di riferimento (una curva dolce, con punti ogni 4.5 m,
  // si considera dritta per qualche metro: il raccordo ci sta lo stesso)
  let retto = P.length > 1 ? P[P.length - 1].d : 0;
  for (let k = 1; k < P.length; k++) {
    const lat = Math.abs((P[k].x - P[0].x) * -uz + (P[k].z - P[0].z) * ux);
    const lungo = (P[k].x - P[0].x) * ux + (P[k].z - P[0].z) * uz;
    if (lat > 0.35 || lungo < P[k - 1].d * 0.8 - 0.5) { retto = k > 1 ? P[k - 1].d : 0; break; }
  }
  return {
    s: s, i: i, avanti: verso > 0, strada: strada,
    dx: ux, dz: uz, w: larghezzaIn(strada, i),
    retto: retto, pts: P, tagliL: 0, tagliR: 0, ang: Math.atan2(uz, ux)
  };
}
function quotaLungo(arm, d) {
  const q = arm.pts;
  if (d <= 0) return q[0].y;
  for (let k = 1; k < q.length; k++) if (d <= q[k].d) return q[k - 1].y + (q[k].y - q[k - 1].y) * (d - q[k - 1].d) / Math.max(q[k].d - q[k - 1].d, 1e-6);
  return q[q.length - 1].y;
}

// --- Calcolo -----------------------------------------------------------------------------------------------------
// Ritorna { incroci: [{ x, y, z, bracci, raccordi }], tagli: Map(indice strada -> [{ k, avanti, L, R }]) }
export function calcolaIncroci(strade, chiaveNodo, larghezzaIn) {
  const nodi = new Map();
  strade.lista.forEach(function (strada, s) {
    if (strada.g || strada.b || strada.riemp || strada.w < 3) return;
    const p = strada.p, n = p.length / 3;
    for (let i = 0; i < n; i++) {
      const k = chiaveNodo(p[i * 3], p[i * 3 + 2]);
      let nodo = nodi.get(k);
      if (!nodo) { nodo = { x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2], bracci: [] }; nodi.set(k, nodo); }
      if (i > 0) nodo.bracci.push(braccio(strada, s, i, -1, larghezzaIn));
      if (i < n - 1) nodo.bracci.push(braccio(strada, s, i, 1, larghezzaIn));
    }
  });
  const incroci = [];
  const tagli = new Map();
  const motivi = { angolo: 0, corto: 0, dietro: 0, fatti: 0 };
  for (const nodo of nodi.values()) {
    const b = nodo.bracci;
    if (b.length < 3) continue;
    if (new Set(b.map(function (a) { return a.s; })).size < 2) continue;
    b.sort(function (a, c) { return a.ang - c.ang; });
    nodo.raccordi = [];
    for (let idx = 0; idx < b.length; idx++) {
      const a = b[idx], c = b[(idx + 1) % b.length];
      let alfa = c.ang - a.ang;
      if (alfa <= 0) alfa += Math.PI * 2;
      if (alfa < 0.44 || alfa > 2.75) { motivi.angolo++; continue; }       // quasi paralleli o quasi allineati: niente raccordo
      const ha = a.w / 2, hc = c.w / 2;
      // angolo vivo C tra il bordo sinistro di "a" e il bordo destro di "c"
      const nax = -Math.sin(a.ang), naz = Math.cos(a.ang), ncx = -Math.sin(c.ang), ncz = Math.cos(c.ang);
      const rx = -ncx * hc - nax * ha, rz = -ncz * hc - naz * ha;
      const det = -Math.sin(alfa);
      const t = (-rx * c.dz + c.dx * rz) / det;
      const u = (a.dx * rz - a.dz * rx) / det;
      let R = Math.min(9, Math.max(3.5, (ha + hc) * 0.9 + 1.5));
      const tg = Math.tan(alfa / 2);
      let T = R / tg;
      const limite = Math.min(a.retto - t, c.retto - u, 14);
      if (T > limite) { T = limite; R = T * tg; }
      if (R < 0.8) { motivi.corto++; continue; }
      if (t + T < 0.5 || u + T < 0.5) { motivi.dietro++; continue; }
      motivi.fatti++;
      const Cx = nodo.x + nax * ha + t * a.dx, Cz = nodo.z + naz * ha + t * a.dz;
      const T1x = Cx + a.dx * T, T1z = Cz + a.dz * T;
      const T2x = Cx + c.dx * T, T2z = Cz + c.dz * T;
      const bx = a.dx + c.dx, bz = a.dz + c.dz, bl = Math.hypot(bx, bz) || 1;
      const Ox = Cx + bx / bl * R / Math.sin(alfa / 2), Oz = Cz + bz / bl * R / Math.sin(alfa / 2);
      let f1 = Math.atan2(T1z - Oz, T1x - Ox), f2 = Math.atan2(T2z - Oz, T2x - Ox);
      let df = f2 - f1;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      nodo.raccordi.push({
        a: a, c: c, R: R, Cx: Cx, Cz: Cz, T1x: T1x, T1z: T1z, T2x: T2x, T2z: T2z, Ox: Ox, Oz: Oz, f1: f1, df: df,
        yC: (quotaLungo(a, t) + quotaLungo(c, u)) / 2, yT1: quotaLungo(a, t + T), yT2: quotaLungo(c, u + T)
      });
      a.tagliL = Math.max(a.tagliL, t + T);
      c.tagliR = Math.max(c.tagliR, u + T);
    }
    for (const a of b) {
      if (a.tagliL === 0 && a.tagliR === 0) continue;
      let l = tagli.get(a.s);
      if (!l) { l = []; tagli.set(a.s, l); }
      l.push({ k: a.i, avanti: a.avanti, L: a.tagliL, R: a.tagliR });
    }
    incroci.push(nodo);
  }
  return { incroci: incroci, tagli: tagli, motivi: motivi };
}

// --- Geometria -------------------------------------------------------------------------------------------------
function triangoloSu(g, a, b, c, ripetizione) {
  // inserisce un triangolo con la faccia verso l'alto
  const base = g.posizioni.length / 3;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const ny = uz * vx - ux * vz;
  g.posizioni.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  g.uv.push(a[0] * 0.125, a[2] * 0.125, b[0] * 0.125, b[2] * 0.125, c[0] * 0.125, c[2] * 0.125);
  for (let q = 0; q < 3; q++) g.colori.push(1, 1, 1);
  if (ny >= 0) g.indici.push(base, base + 1, base + 2); else g.indici.push(base, base + 2, base + 1);
  void ripetizione;
}

// Asfalto: ventaglio dal vertice C lungo l'arco di raccordo
function riempiRaccordo(g, r, alza) {
  const arco = Math.max(4, Math.ceil(Math.abs(r.df) / (Math.PI / 12)));
  const C = [r.Cx, r.yC + alza, r.Cz];
  let prec = [r.T1x, r.yT1 + alza, r.T1z];
  for (let k = 1; k <= arco; k++) {
    const f = r.f1 + r.df * k / arco;
    const q = [r.Ox + Math.cos(f) * r.R, r.yT1 + (r.yT2 - r.yT1) * k / arco + alza, r.Oz + Math.sin(f) * r.R];
    triangoloSu(g, C, prec, q);
    prec = q;
  }
}

// Cordolo e marciapiede attorno all'angolo: una corona circolare tra il raggio R (cordolo) e R - larghezza
function marciapiedeRaccordo(g, r, larghezza) {
  const arco = Math.max(4, Math.ceil(Math.abs(r.df) / (Math.PI / 12)));
  const r0 = Math.max(0.25, r.R - larghezza);
  const lung = Math.abs(r.df) * r.R;
  let prec = null;
  for (let k = 0; k <= arco; k++) {
    const f = r.f1 + r.df * k / arco;
    const c = Math.cos(f), s = Math.sin(f);
    const y = r.yT1 + (r.yT2 - r.yT1) * k / arco + 0.01;
    const q = { fuori: [r.Ox + c * r.R, y, r.Oz + s * r.R], dentro: [r.Ox + c * r0, y + ALTEZZA_CORDOLO, r.Oz + s * r0], bordo: [r.Ox + c * r.R, y + ALTEZZA_CORDOLO, r.Oz + s * r.R], v: lung * k / arco };
    if (prec) {
      const base = g.posizioni.length / 3;
      // faccia del cordolo (verso l'asfalto) e piano del marciapiede
      g.posizioni.push(
        ...prec.fuori, ...q.fuori, ...q.bordo, ...prec.bordo,
        ...prec.bordo, ...q.bordo, ...q.dentro, ...prec.dentro
      );
      g.uv.push(0, prec.v / 1.5, 0, q.v / 1.5, 0.06, q.v / 1.5, 0.06, prec.v / 1.5, 0, prec.v / 1.5, 0, q.v / 1.5, (r.R - r0) / 2, q.v / 1.5, (r.R - r0) / 2, prec.v / 1.5);
      for (let z = 0; z < 4; z++) g.colori.push(COLORE_CORDOLO.r, COLORE_CORDOLO.g, COLORE_CORDOLO.b);
      for (let z = 0; z < 4; z++) g.colori.push(COLORE_TOP.r, COLORE_TOP.g, COLORE_TOP.b);
      g.indici.push(base, base + 1, base + 2, base, base + 2, base + 3, base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
    }
    prec = q;
  }
}

// Isola spartitraffico (sagoma allungata a rombo) con cordolo
function isola(g, cx, cz, y, dirX, dirZ, t0, lunghezza, larghezza) {
  const lx = -dirZ, lz = dirX;
  const punto = function (t, lato) { return [cx + dirX * t + lx * lato, y, cz + dirZ * t + lz * lato]; };
  const mezza = larghezza / 2;
  const anello = [
    punto(t0, 0), punto(t0 + lunghezza * 0.18, mezza * 0.75), punto(t0 + lunghezza * 0.45, mezza),
    punto(t0 + lunghezza, 0), punto(t0 + lunghezza * 0.45, -mezza), punto(t0 + lunghezza * 0.18, -mezza * 0.75)
  ];
  const n = anello.length;
  const alto = anello.map(function (q) { return [q[0], q[1] + ALTEZZA_CORDOLO, q[2]]; });
  // fianchi
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    const base = g.posizioni.length / 3;
    g.posizioni.push(...anello[k], ...anello[k2], ...alto[k2], ...alto[k]);
    g.uv.push(0, 0, 0.5, 0, 0.5, 0.06, 0, 0.06);
    for (let z = 0; z < 4; z++) g.colori.push(COLORE_CORDOLO.r, COLORE_CORDOLO.g, COLORE_CORDOLO.b);
    g.indici.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // piano (ventaglio dal centro)
  const mx = cx + dirX * (t0 + lunghezza * 0.45), mz = cz + dirZ * (t0 + lunghezza * 0.45);
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    const base = g.posizioni.length / 3;
    g.posizioni.push(mx, y + ALTEZZA_CORDOLO, mz, ...alto[k], ...alto[k2]);
    g.uv.push(0.2, 0.2, (alto[k][0] - mx) / 2, (alto[k][2] - mz) / 2, (alto[k2][0] - mx) / 2, (alto[k2][2] - mz) / 2);
    for (let z = 0; z < 3; z++) g.colori.push(COLORE_TOP.r, COLORE_TOP.g, COLORE_TOP.b);
    // verso l'alto
    const ax = alto[k][0] - mx, az = alto[k][2] - mz, bx = alto[k2][0] - mx, bz = alto[k2][2] - mz;
    if (bz * ax - bx * az >= 0) g.indici.push(base, base + 1, base + 2); else g.indici.push(base, base + 2, base + 1);
  }
}

// --- Costruzione dei pezzi ---------------------------------------------------------------------------------
// opz.gruppo(x, z) -> { asfalto, marciapiedi, righe } (nastri della cella); opz.marciapiede(x, z, y) -> larghezza (0 = niente)
export function costruisciIncroci(dati, opz) {
  const ris = { raccordi: 0, marciapiedi: 0, isole: 0, precedenze: 0 };
  for (const nodo of dati.incroci) {
    const g = opz.gruppo(nodo.x, nodo.z);
    for (const r of nodo.raccordi) {
      riempiRaccordo(g.asfalto, r, 0.018);
      ris.raccordi++;
      const prop = r.a.strada.t, altra = r.c.strada.t;
      if (opz.tipiMarciapiede.includes(prop) && opz.tipiMarciapiede.includes(altra) && !r.a.strada.g && !r.c.strada.g) {
        const mx = r.Ox, mz = r.Oz;
        const larghezza = opz.marciapiede(mx, mz, r.yC);
        if (larghezza > 0) { marciapiedeRaccordo(g.marciapiedi, r, Math.min(larghezza, r.R * 0.7)); ris.marciapiedi++; }
      }
    }
    // rotonde: isola spartitraffico e dare precedenza sui rami a due sensi che entrano nell'anello
    const anello = nodo.bracci.filter(function (a) { return a.strada.j === "roundabout"; });
    if (anello.length >= 2) {
      const wRing = Math.max.apply(null, anello.map(function (a) { return a.w; }));
      for (const a of nodo.bracci) {
        if (a.strada.j === "roundabout") continue;
        const doppio = !a.strada.o && a.w >= 5.4;
        const t0 = wRing / 2 + 1.2;
        if (doppio && a.retto - t0 > 7) {
          const lung = Math.min(10, a.retto - t0 - 2);
          isola(g.marciapiedi, nodo.x, nodo.z, nodo.y + 0.02, a.dx, a.dz, t0, lung, Math.min(1.8, a.w * 0.28));
          ris.isole++;
        }
        // linea di dare precedenza: triangoli bianchi sulla corsia di chi entra nell'anello
        const sensoUnico = a.strada.o === 1 || a.strada.o === -1;
        const entra = !sensoUnico || (a.strada.o === 1 ? !a.avanti : a.avanti);
        if (entra && a.retto - t0 > 4 && a.w >= 3.2) {
          const larghezzaCorsia = sensoUnico ? a.w : a.w / 2;
          lineaPrecedenza(g.righe, nodo.x + a.dx * (t0 + 1.0), nodo.y, nodo.z + a.dz * (t0 + 1.0), -a.dx, -a.dz, sensoUnico ? -a.w / 2 + 0.15 : 0.15, sensoUnico ? a.w / 2 - 0.15 : larghezzaCorsia);
          ris.precedenze++;
        }
      }
    }
  }
  return ris;
}

// --- Segni sull'asfalto: linea di STOP e linea di dare precedenza --------------------------------------------------
// g = { posizioni, indici } (gruppo "righe"). (x, y, z) = punto sulla linea di mezzeria; dir = direzione di marcia di chi
// si ferma; la corsia e' a DESTRA (-dirZ, dirX), da "da" ad "a" metri dalla mezzeria.
function quadro(g, x, y, z, dirX, dirZ, da, a, lunghezza) {
  const rx = -dirZ, rz = dirX;
  const base = g.posizioni.length / 3;
  const h = lunghezza / 2;
  g.posizioni.push(
    x + rx * da - dirX * h, y + 0.035, z + rz * da - dirZ * h, x + rx * a - dirX * h, y + 0.035, z + rz * a - dirZ * h,
    x + rx * a + dirX * h, y + 0.035, z + rz * a + dirZ * h, x + rx * da + dirX * h, y + 0.035, z + rz * da + dirZ * h
  );
  g.indici.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
export function lineaArresto(g, x, y, z, dirX, dirZ, da, a) {
  quadro(g, x, y, z, dirX, dirZ, da + 0.1, a - 0.1, 0.5);
}
export function lineaPrecedenza(g, x, y, z, dirX, dirZ, da, a) {
  // "denti di squalo": triangoli con la punta verso chi arriva
  const rx = -dirZ, rz = dirX;
  for (let c = da + 0.45; c < a - 0.3; c += 0.9) {
    const base = g.posizioni.length / 3;
    const bx = x + rx * c, bz = z + rz * c;
    g.posizioni.push(
      bx - rx * 0.3 + dirX * 0.1, y + 0.035, bz - rz * 0.3 + dirZ * 0.1,
      bx + rx * 0.3 + dirX * 0.1, y + 0.035, bz + rz * 0.3 + dirZ * 0.1,
      bx - dirX * 0.6, y + 0.035, bz - dirZ * 0.6
    );
    g.indici.push(base, base + 1, base + 2);
  }
}

// --- Frecce direzionali (SOLO dove OpenStreetMap ha turn:lanes) -----------------------------------------------------
// Una freccia per corsia, a poca distanza dall'incrocio: dritta, a sinistra, a destra o combinate ("through;right").
// Se i dati non dicono le corsie di svolta, non si disegna niente: le frecce non si inventano.
function direzioniToken(token) {
  const out = [];
  for (const t of token.split(";")) {
    if (t === "through") out.push(0);
    else if (t === "left" || t === "sharp_left") out.push(-1);
    else if (t === "slight_left") out.push(-0.5);
    else if (t === "right" || t === "sharp_right") out.push(1);
    else if (t === "slight_right") out.push(0.5);
  }
  return out;
}

// (x, y, z) = centro della freccia, (dirX, dirZ) = verso di marcia; destra = (-dirZ, dirX)
function disegnaFreccia(g, x, y, z, dirX, dirZ, direzioni) {
  const rx = -dirZ, rz = dirX;
  const P = function (a, l) { return [x + dirX * a + rx * l, y + 0.037, z + dirZ * a + rz * l]; };   // a = lungo, l = di lato (destra +)
  const tri = function (p, q, r) {
    const base = g.posizioni.length / 3;
    g.posizioni.push(...p, ...q, ...r);
    g.indici.push(base, base + 1, base + 2, base, base + 2, base + 1);
  };
  const quad = function (p, q, r, s) { tri(p, q, r); tri(p, r, s); };
  // gambo: da -1.5 a +0.2 (largo 0.22)
  quad(P(-1.5, -0.11), P(-1.5, 0.11), P(0.2, 0.11), P(0.2, -0.11));
  for (const d of direzioni) {
    // la punta si piega di d * 45 gradi: tratto inclinato fino a 1.0 m, poi punta triangolare
    const ang = d * Math.PI / 4;
    const sx = Math.cos(ang), sl = Math.sin(ang);
    const lungo = 0.2, lato = 0;
    const fx = lungo + sx * 0.9, fl = lato + sl * 0.9;
    // tratto
    const nx = -sl, nl = sx;   // perpendicolare (in coordinate lungo, lato)
    quad(P(lungo + nx * -0.11, lato + nl * -0.11), P(lungo + nx * 0.11, lato + nl * 0.11), P(fx + nx * 0.11, fl + nl * 0.11), P(fx + nx * -0.11, fl + nl * -0.11));
    // punta
    tri(P(fx + nx * -0.42, fl + nl * -0.42), P(fx + nx * 0.42, fl + nl * 0.42), P(fx + sx * 0.8, fl + sl * 0.8));
  }
}

// Disegna le frecce di una strada nel gruppo "righe". Ritorna quante
export function frecceStrada(g, strada, indice, tagli) {
  const p = strada.p, n = p.length / 3;
  if (n < 2 || strada.g || strada.b) return 0;
  const sensoUnico = strada.o === 1 || strada.o === -1;
  const f = strada.tf ? strada.tf.split("|") : null;
  const b = strada.tb ? strada.tb.split("|") : null;
  const lf = f ? f.length : 0, lb = b ? b.length : 0;
  const totale = sensoUnico ? lf : (strada.lf && strada.lb ? strada.lf + strada.lb : lf + lb);
  if (totale === 0) return 0;
  const larghezzaCorsia = strada.w / Math.max(totale, 1);
  let tot = 0;
  const lungoStrada = function (dalFine) {
    // punto e direzione a distanza "d" dal capo (dalFine = true: dalla fine verso l'inizio)
    return function (d) {
      let resto = d;
      for (let k = 0; k < n - 1; k++) {
        const i = dalFine ? n - 1 - k : k, j = dalFine ? n - 2 - k : k + 1;
        const l = Math.hypot(p[j * 3] - p[i * 3], p[j * 3 + 2] - p[i * 3 + 2]);
        if (l < 1e-3) continue;
        if (resto <= l) {
          const t = resto / l;
          return { x: p[i * 3] + (p[j * 3] - p[i * 3]) * t, y: p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * t, z: p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * t, dx: (p[i * 3] - p[j * 3]) / l, dz: (p[i * 3 + 2] - p[j * 3 + 2]) / l };
        }
        resto -= l;
      }
      return null;
    };
  };
  // distanza dal capo: oltre il raccordo dell'incrocio, almeno 11 m
  let taglioFine = 0, taglioInizio = 0;
  for (const rec of tagli || []) {
    const t = Math.max(rec.L, rec.R);
    if (rec.k === n - 1 && !rec.avanti) taglioFine = Math.max(taglioFine, t);
    if (rec.k === 0 && rec.avanti) taglioInizio = Math.max(taglioInizio, t);
  }
  if (f) {
    const q = lungoStrada(true)(Math.max(11, taglioFine + 6));
    if (q) {
      // q.dx,dz e' gia' il verso della linea (verso la fine): il verso di marcia di queste corsie
      const dx = q.dx, dz = q.dz;
      const rx = -dz, rz = dx;
      f.forEach(function (tok, i) {
        const dirs = direzioniToken(tok);
        if (dirs.length === 0) return;
        const lat = sensoUnico ? (i + 0.5 - lf / 2) * larghezzaCorsia : (i + 0.5) * larghezzaCorsia;
        disegnaFreccia(g, q.x + rx * lat, q.y, q.z + rz * lat, dx, dz, dirs);
        tot++;
      });
    }
  }
  if (b) {
    const q = lungoStrada(false)(Math.max(11, taglioInizio + 6));
    if (q) {
      // verso di marcia = verso l'inizio: q.dx,dz (da j a i, cioe' all'indietro)
      const dx = q.dx, dz = q.dz;
      const rx = -dz, rz = dx;
      b.forEach(function (tok, i) {
        const dirs = direzioniToken(tok);
        if (dirs.length === 0) return;
        // a destra di chi va all'indietro = a sinistra rispetto al verso della linea
        const lat = (i + 0.5) * larghezzaCorsia;
        disegnaFreccia(g, q.x + rx * lat, q.y, q.z + rz * lat, dx, dz, dirs);
        tot++;
      });
    }
  }
  void indice;
  return tot;
}
