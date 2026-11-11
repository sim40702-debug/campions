// Strade: legge le strade OpenStreetMap preparate dal passo 7,
// le disegna come nastri di asfalto e permette di sapere "su che strada sono".

import * as THREE from "three";
import { quotaTerreno } from "./terreno.js";
import { aggiungiMeteo } from "./meteo_shader.js";
import { liberaDopoCaricamento } from "./memoria.js";

export const CELLA = 40;   // griglia di ricerca: celle da 40 x 40 m

// --- Quote delle strade: tutte sullo stesso piano dove si toccano ------------------------------------------
// 1) i nodi in comune tra piu' strade (incroci, strade che continuano) hanno UNA sola quota, uguale per tutte;
// 2) gallerie e ponti vanno in linea retta da un capo all'altro; le altre strade hanno le quote ammorbidite
//    (media su circa 25 m) ma tornano esatte nei nodi in comune, cosi' agli incroci non ci sono scalini;
// 3) dove una strada entra nella carreggiata di un'altra piu' importante prende la quota di quella (stesso piano):
//    i due nastri di asfalto non si sovrappongono piu' a quote diverse; poi si raccorda in 14 m al suo profilo.
// Le posizioni (x, z) non cambiano.
function chiaveNodo(x, z) {
  return Math.round(x * 2) + "," + Math.round(z * 2);
}

// Strade a scorrimento veloce (A13 e svincoli): carreggiate separate a senso unico, profilo dolce, niente strappi.
const TIPI_VELOCI = new Set(["motorway", "trunk", "motorway_link", "trunk_link"]);
export function stradaVeloce(strada) {
  return TIPI_VELOCI.has(strada.t);
}
// "Rigida" = la quota va in linea retta tra i due capi: gallerie e ponti. I ponti delle strade veloci no: seguono il
// profilo calcolato (che tra i capi e' comunque quasi dritto) e restano alla stessa quota della carreggiata accanto.
function rigida(strada) {
  return strada.g || (strada.b && !stradaVeloce(strada));
}

function sistemaQuote(lista) {
  // nodi: per ogni posizione, i gruppi di punti alla stessa quota (un ponte che passa sopra resta un gruppo a parte)
  const nodi = new Map();
  const gruppoDi = [];   // per ogni strada, per ogni punto: il suo gruppo
  for (let s = 0; s < lista.length; s++) {
    const p = lista[s].p;
    const n = p.length / 3;
    const g = new Array(n);
    for (let i = 0; i < n; i++) {
      const k = chiaveNodo(p[i * 3], p[i * 3 + 2]);
      let gruppi = nodi.get(k);
      if (!gruppi) { gruppi = []; nodi.set(k, gruppi); }
      const y = p[i * 3 + 1];
      let trovato = null;
      for (const c of gruppi) if (Math.abs(c.somma / c.n - y) < 3) { trovato = c; break; }
      if (!trovato) { trovato = { somma: 0, n: 0, y: 0, fisso: false, strade: 0, ultima: -1, meta: false, membri: [] }; gruppi.push(trovato); }
      trovato.somma += y;
      trovato.n++;
      if (trovato.ultima !== s) { trovato.strade++; trovato.ultima = s; trovato.membri.push(s); }
      if (i > 0 && i < n - 1) trovato.meta = true;
      g[i] = trovato;
    }
    gruppoDi.push(g);
  }
  const incroci = new Set();
  for (const [k, gruppi] of nodi) {
    for (const c of gruppi) {
      c.y = c.somma / c.n;
      if (c.strade >= 3 || (c.strade === 2 && c.meta)) incroci.add(k);
    }
  }

  const distanze = function (p) {
    const n = p.length / 3;
    const d = new Float32Array(n);
    for (let i = 1; i < n; i++) d[i] = d[i - 1] + Math.hypot(p[i * 3] - p[i * 3 - 3], p[i * 3 + 2] - p[i * 3 - 1]);
    return d;
  };

  // --- Quote calcolate su TUTTA la rete insieme ---------------------------------------------------------
  // Nei dati ogni incrocio e ogni capo di ponte e' agganciato al terreno grezzo: su un pendio o sul bordo di un
  // burrone questo crea rampe impossibili (metri di dislivello in pochi metri). Qui ogni punto e' un'incognita
  // (i nodi in comune sono UNA sola incognita, quindi restano uguali per tutte le strade) e si cerca il profilo
  // che sta vicino alle quote dei dati ma senza strappi: ogni punto tende alla media dei suoi vicini lungo le
  // strade. Ponti e gallerie sono un unico tratto dritto tra i due capi, e i loro capi seguono la strada (non il
  // fondo del burrone).
  const LAMBDA = 1 / (22 * 22);   // quanto conta la quota dei dati: le quote si ammorbidiscono su circa 22 m
  // Strade veloci: molle 9 volte piu' rigide (le quote si ammorbidiscono su circa 65 m: un'autostrada non fa
  // saliscendi), e proporzionali a 1/lunghezza, cosi' un tratto senza dati (un ponte) resta esattamente dritto.
  const RIGIDO_VELOCE = 9;
  const variabili = [];
  for (const gruppi of nodi.values()) for (const c of gruppi) { c.y0 = c.y; c.vicini = []; c.forze = []; c.opera = 0; c.normale = 0; c.veloce = false; c.sulPonte = false; variabili.push(c); }
  const collegaK = function (a, b, k) {
    if (a === b) return;
    a.vicini.push(b); a.forze.push(k);
    b.vicini.push(a); b.forze.push(k);
  };
  const collega = function (a, b, lung) {
    collegaK(a, b, 1 / Math.max(lung * lung, 1));
  };
  for (let s = 0; s < lista.length; s++) {
    const strada = lista[s], p = strada.p, n = p.length / 3, g = gruppoDi[s];
    if (n < 2) continue;
    if (rigida(strada)) {
      const d = distanze(p);
      collega(g[0], g[n - 1], Math.max(d[n - 1], 4));
      g[0].opera++; g[n - 1].opera++;
      continue;
    }
    if (stradaVeloce(strada)) {
      for (let i = 0; i < n; i++) {
        g[i].veloce = true;
        if (!strada.b) g[i].normale++;
        else if (i === 0 || i === n - 1) g[i].opera++;
        else g[i].sulPonte = true;
      }
      for (let i = 0; i + 1 < n; i++) {
        const lung = Math.max(Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 5] - p[i * 3 + 2]), 0.5);
        collegaK(g[i], g[i + 1], RIGIDO_VELOCE / (lung * 4.5));
      }
      continue;
    }
    for (let i = 0; i < n; i++) g[i].normale++;
    for (let i = 0; i + 1 < n; i++) collega(g[i], g[i + 1], Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 5] - p[i * 3 + 2]));
  }
  for (const c of variabili) {
    c.peso = c.opera === 0 ? LAMBDA : (c.normale === 0 ? LAMBDA * 0.02 : LAMBDA * 0.05);
    if (c.sulPonte && c.normale === 0) c.peso = 0;   // in mezzo a un ponte la quota del terreno (il fondo del fiume) non conta
  }
  // vicino ai capi di un ponte il terreno dei dati e' quello SOTTO il ponte (la riva): li' i dati contano poco,
  // cosi' la strada veloce arriva al ponte in piano invece di fare una conca
  for (let s = 0; s < lista.length; s++) {
    const strada = lista[s];
    if (!stradaVeloce(strada) || strada.g || strada.b) continue;
    const p = strada.p, n = p.length / 3, g = gruppoDi[s];
    if (n < 2) continue;
    const d = distanze(p);
    for (const capo of [0, n - 1]) {
      if (g[capo].opera === 0) continue;
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(d[i] - d[capo]);
        if (dist >= 60) continue;
        if (g[i].opera === 0) g[i].peso = Math.min(g[i].peso, LAMBDA * Math.max(0.05, (dist / 60) * (dist / 60)));
      }
    }
  }
  const veloci = variabili.filter(function (c) { return c.veloce; });
  const giri = function (quanti, elenco, omega) {
    for (let giro = 0; giro < quanti; giro++) {
      for (const c of elenco) {
        const v = c.vicini;
        if (v.length === 0) continue;
        let somma = c.peso * c.y0, peso = c.peso;
        for (let k = 0; k < v.length; k++) { somma += c.forze[k] * v[k].y; peso += c.forze[k]; }
        c.y += (somma / peso - c.y) * omega;   // sovra-rilassamento: converge prima
      }
    }
  };
  giri(260, variabili, 1.6);
  if (veloci.length > 0) {
    // Carreggiate affiancate (le due direzioni dell'A13, una rampa accanto alla carreggiata): stessa quota.
    // Ogni punto di una strada veloce e' legato al punto di fronte dell'altra, tanto piu' forte quanto sono vicine.
    const griglia = costruisciGriglia(lista);
    for (let s = 0; s < lista.length; s++) {
      const strada = lista[s];
      if (!stradaVeloce(strada) || strada.g) continue;
      const p = strada.p, n = p.length / 3, g = gruppoDi[s];
      for (let i = 0; i < n; i++) {
        const x = p[i * 3], z = p[i * 3 + 2];
        const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, n - 1) * 3;
        let dx = p[b] - p[a], dz = p[b + 2] - p[a + 2];
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        const meta = larghezzaIn(strada, i) / 2;
        const cx = Math.floor(x / CELLA), cz = Math.floor(z / CELLA);
        let migliore = null, distMigliore = Infinity, spazio = 0;
        for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
          const pezzi = griglia.get(ix + "," + iz);
          if (!pezzi) continue;
          for (const [o, j] of pezzi) {
            if (o === s) continue;
            const altra = lista[o];
            if (!stradaVeloce(altra) || altra.g) continue;
            const q = altra.p;
            const ax = q[j], az = q[j + 2], bx = q[j + 3], bz = q[j + 5];
            const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
            if (lungo < 0.01) continue;
            const t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo;
            if (t < 0 || t > 1) continue;
            const dist = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
            const metaAltra = larghezzaIn(altra, j / 3) / 2;
            if (dist >= distMigliore || dist > meta + metaAltra + 8) continue;
            const lung = Math.sqrt(lungo);
            if (Math.abs(dx * (bx - ax) + dz * (bz - az)) / lung < 0.94) continue;   // non parallele (un cavalcavia)
            const go = gruppoDi[o];
            const vertice = t < 0.5 ? j / 3 : j / 3 + 1;
            if (Math.abs(go[j / 3].y + (go[j / 3 + 1].y - go[j / 3].y) * t - g[i].y) > 3.5) continue;   // una passa sopra l'altra
            migliore = go[vertice]; distMigliore = dist; spazio = dist - meta - metaAltra;
          }
        }
        if (migliore && migliore !== g[i]) collegaK(g[i], migliore, 1.2 * Math.min(Math.max((8 - spazio) / 4, 0), 1));
      }
    }
    giri(1500, veloci, 1.8);
    giri(80, variabili, 1.6);
  }
  // Cavalcavia: sotto un ponte che scavalca un'altra strada devono restare almeno 5 m liberi. Nei dati i capi del
  // ponte sono agganciati al terreno e spesso il ponte passava a 2 m dall'asfalto di sotto (ci si sbatteva la
  // testa). Dove manca spazio si ALZA il ponte (i suoi capi, o il punto sopra l'incrocio per le strade veloci) e le
  // strade che ci arrivano salgono con lui.
  {
    const LUCE = 5.5;
    const griglia = costruisciGriglia(lista);
    const quotaIn = function (o, j, t) {   // quota della strada "o" nel pezzo che parte dal punto j
      const strada = lista[o], go = gruppoDi[o];
      if (!rigida(strada)) return go[j].y + (go[j + 1].y - go[j].y) * t;
      const d = distanze(strada.p), n = go.length;
      const fatta = d[j] + (d[j + 1] - d[j]) * t;
      return go[0].y + (go[n - 1].y - go[0].y) * (fatta / (d[n - 1] || 1));
    };
    for (let volta = 0; volta < 3; volta++) {
      let alzati = 0;
      for (let s = 0; s < lista.length; s++) {
        const ponte = lista[s];
        if (!ponte.b || ponte.g) continue;
        const p = ponte.p, n = p.length / 3, g = gruppoDi[s];
        if (n < 2) continue;
        const d = distanze(p);
        let manca = 0;
        for (let i = 0; i < n; i++) {
          const x = p[i * 3], z = p[i * 3 + 2];
          const y = rigida(ponte) ? g[0].y + (g[n - 1].y - g[0].y) * (d[i] / (d[n - 1] || 1)) : g[i].y;
          let mancaQui = 0;
          const pezzi = griglia.get(Math.floor(x / CELLA) + "," + Math.floor(z / CELLA));
          if (!pezzi) continue;
          for (const [o, j] of pezzi) {
            if (o === s || lista[o].g) continue;
            const q = lista[o].p;
            const ax = q[j], az = q[j + 2], bx = q[j + 3], bz = q[j + 5];
            const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
            if (lungo < 0.01) continue;
            const t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo;
            if (t < 0 || t > 1) continue;
            if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) > larghezzaIn(lista[o], j / 3) / 2 + 0.5) continue;
            const luce = y - quotaIn(o, j / 3, t);
            if (luce > 1.2 && luce < LUCE) mancaQui = Math.max(mancaQui, LUCE - luce);   // sotto 1.2 m e' un incrocio a raso
          }
          if (mancaQui > 0 && !rigida(ponte)) { g[i].y0 = g[i].y + mancaQui; g[i].y = g[i].y0; g[i].peso = 1; alzati++; }
          manca = Math.max(manca, mancaQui);
        }
        if (manca > 0 && rigida(ponte)) {
          for (const c of [g[0], g[n - 1]]) { c.y0 = c.y + manca; c.y = c.y0; c.peso = 1; }
          alzati++;
        }
      }
      if (alzati === 0) break;
      giri(160, variabili, 1.6);
      if (veloci.length > 0) { giri(500, veloci, 1.8); giri(40, variabili, 1.6); }
    }
  }
  // pendenza massima 22 % (7 % sulle strade veloci): dove i dati chiedono di piu' si spalma il dislivello
  for (let giro = 0; giro < 60; giro++) {
    let cambiati = 0;
    for (let s = 0; s < lista.length; s++) {
      const strada = lista[s];
      if (rigida(strada)) continue;
      const PENDENZA = stradaVeloce(strada) ? 0.07 : 0.22;
      const p = strada.p, n = p.length / 3, g = gruppoDi[s];
      for (let i = 0; i + 1 < n; i++) {
        const a = g[i], b = g[i + 1];
        if (a === b) continue;
        const lung = Math.max(Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 5] - p[i * 3 + 2]), 0.5);
        const troppo = Math.abs(b.y - a.y) - PENDENZA * lung;
        if (troppo <= 0.001) continue;
        const sposta = troppo / 2 * Math.sign(b.y - a.y);
        a.y += sposta; b.y -= sposta;
        cambiati++;
      }
    }
    if (cambiati === 0) break;
  }
  // ultima lisciata: toglie gli spigoli rimasti (dossi e avvallamenti corti), senza spostare le quote in media
  for (let giro = 0; giro < 10; giro++) {
    for (const c of variabili) {
      const v = c.vicini;
      if (v.length < 2) continue;
      let somma = 0, peso = 0;
      for (let k = 0; k < v.length; k++) { somma += c.forze[k] * v[k].y; peso += c.forze[k]; }
      c.nuova = c.y + (somma / peso - c.y) * 0.5;
    }
    for (const c of variabili) if (c.vicini.length >= 2) c.y = c.nuova;
  }
  for (const c of variabili) { delete c.vicini; delete c.forze; }
  // quote sulle strade; gallerie e ponti in linea retta tra i capi (i nodi lungo un ponte prendono la sua quota)
  for (let giro = 0; giro < 3; giro++) for (let s = 0; s < lista.length; s++) {   // 3 giri: un ponte puo' finire a meta' di un altro
    const strada = lista[s];
    if (!rigida(strada)) continue;
    const p = strada.p, n = p.length / 3, g = gruppoDi[s];
    if (n < 2) continue;
    const d = distanze(p);
    const tot = d[n - 1] || 1;
    const y0 = g[0].y, y1 = g[n - 1].y;
    for (let i = 0; i < n; i++) {
      p[i * 3 + 1] = y0 + (y1 - y0) * (d[i] / tot);
      if (i > 0 && i < n - 1) g[i].y = p[i * 3 + 1];
    }
  }
  for (let s = 0; s < lista.length; s++) {
    const strada = lista[s];
    if (rigida(strada)) continue;
    const p = strada.p, g = gruppoDi[s];
    for (let i = 0; i < g.length; i++) p[i * 3 + 1] = g[i].y;
  }
  return { gruppoDi: gruppoDi, incroci: incroci, distanze: distanze };
}

// Passo 3: stesso piano dove due carreggiate si sovrappongono. Si procede dalla strada piu' importante (piu' larga)
// alla meno importante. Un punto prende la quota di una strada gia' sistemata in due casi:
//  a) cade proprio sulla sua carreggiata (e il dislivello e' meno di 2 m: non e' un tornante o un cavalcavia);
//  b) e' vicino a un incrocio con quella strada (nodo in comune) ed entro 3 m dal suo bordo: cosi' la strada
//     laterale arriva all'incrocio gia' in piano. I tornanti e le strade parallele non collegate non si toccano.
function stessoPiano(lista, griglia, quote) {
  const ordine = lista.map(function (_, i) { return i; }).sort(function (a, b) { return (lista[b].w - lista[a].w) || (a - b); });
  const grado = new Int32Array(lista.length);
  ordine.forEach(function (s, k) { grado[s] = k; });
  const fissi = [];
  for (const s of ordine) {
    const strada = lista[s];
    const p = strada.p, n = p.length / 3;
    const fisso = new Uint8Array(n);
    fissi[s] = fisso;
    if (strada.g || strada.b || n < 2) continue;
    const delta = new Float32Array(n);
    let qualcuno = false;
    const d = quote.distanze(p);
    // incroci di questa strada: per ogni altra strada, a che distanza (lungo questa) c'e' il nodo in comune
    const incrociCon = new Map();
    for (let i = 0; i < n; i++) {
      const g = quote.gruppoDi[s][i];
      if (g.strade < 2) continue;
      for (const o of g.membri) {
        if (o === s) continue;
        let l = incrociCon.get(o);
        if (!l) { l = []; incrociCon.set(o, l); }
        l.push(d[i]);
      }
    }
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      const cx = Math.floor(x / CELLA), cz = Math.floor(z / CELLA);
      let migliore = Infinity, quota = 0, gradoMigliore = Infinity, classeMigliore = 9;
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iz = cz - 1; iz <= cz + 1; iz++) {
          const pezzi = griglia.get(ix + "," + iz);
          if (!pezzi) continue;
          for (const [o, j] of pezzi) {
            if (o === s || grado[o] > grado[s]) continue;
            const altra = lista[o];
            if (altra.g || altra.b) continue;
            const q = altra.p;
            const ax = q[j], az = q[j + 2], bx = q[j + 3], bz = q[j + 5];
            const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
            if (lungo === 0) continue;
            let t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo;
            // oltre il capo di una strada non si e' "sulla" sua carreggiata (due strade in fila non si schiacciano)
            if ((t < 0 && j === 0) || (t > 1 && j + 6 >= q.length)) continue;
            t = Math.min(Math.max(t, 0), 1);
            const dist = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
            const yAltra = q[j + 1] + (q[j + 4] - q[j + 1]) * t;
            const meta = larghezzaIn(altra, j / 3) / 2;
            const dy = Math.abs(yAltra - y);
            let classe = 9, incrocioVicino = false;
            const vicini = incrociCon.get(o);
            if (vicini) for (const dn of vicini) if (Math.abs(dn - d[i]) <= meta + 4) { incrocioVicino = true; break; }
            if (dist <= meta + 0.3 && dy < (incrocioVicino ? 3 : 2)) classe = 0;
            else if (incrocioVicino && dist <= meta + 3 && dy < 3) classe = 1;
            if (classe === 9) continue;
            if (classe < classeMigliore || (classe === classeMigliore && (grado[o] < gradoMigliore || (grado[o] === gradoMigliore && dist < migliore)))) {
              classeMigliore = classe; gradoMigliore = grado[o]; migliore = dist; quota = yAltra;
            }
          }
        }
      }
      if (migliore < Infinity) { delta[i] = quota - y; fisso[i] = 1; qualcuno = true; }
    }
    if (!qualcuno) continue;
    // raccordo: la correzione sfuma in 14 m lungo la strada
    const RACCORDO = 14;
    for (let i = 0; i < n; i++) {
      if (fisso[i]) continue;
      let somma = 0, peso = 0, massimo = 0;
      for (let j = i - 1; j >= 0 && d[i] - d[j] < RACCORDO; j--) if (fisso[j]) { const w = 1 - (d[i] - d[j]) / RACCORDO; somma += delta[j] * w; peso += w; massimo = Math.max(massimo, w); break; }
      for (let j = i + 1; j < n && d[j] - d[i] < RACCORDO; j++) if (fisso[j]) { const w = 1 - (d[j] - d[i]) / RACCORDO; somma += delta[j] * w; peso += w; massimo = Math.max(massimo, w); break; }
      if (peso > 0) delta[i] = somma / peso * massimo;
    }
    for (let i = 0; i < n; i++) p[i * 3 + 1] += delta[i];
  }
  // i nodi in comune tornano a una sola quota (quella della strada piu' importante che ci passa)
  const scelta = new Map();
  const normaliPrima = ordine.filter(function (s) { return !rigida(lista[s]); }).concat(ordine.filter(function (s) { return rigida(lista[s]); }));
  for (const s of normaliPrima) {
    const p = lista[s].p, g = quote.gruppoDi[s];
    for (let i = 0; i < g.length; i++) {
      if (g[i].n < 2) continue;
      if (!scelta.has(g[i])) scelta.set(g[i], p[i * 3 + 1]);
    }
  }
  // ponti e gallerie: i capi sulla quota del nodo, in mezzo di nuovo in linea retta
  for (const s of ordine) {
    const strada = lista[s];
    if (!rigida(strada)) continue;
    const p = strada.p, g = quote.gruppoDi[s], n = g.length;
    if (n < 2) continue;
    const y0 = g[0].n >= 2 ? scelta.get(g[0]) : p[1], y1 = g[n - 1].n >= 2 ? scelta.get(g[n - 1]) : p[(n - 1) * 3 + 1];
    if (Math.abs(y0 - p[1]) < 0.002 && Math.abs(y1 - p[(n - 1) * 3 + 1]) < 0.002) continue;
    const d = quote.distanze(p);
    for (let i = 0; i < n; i++) p[i * 3 + 1] = y0 + (y1 - y0) * (d[i] / (d[n - 1] || 1));
  }
  for (const s of ordine) {
    const strada = lista[s];
    if (rigida(strada)) continue;
    const p = strada.p, g = quote.gruppoDi[s], n = g.length;
    let d = null;
    for (let i = 0; i < n; i++) {
      if (g[i].n < 2) continue;
      const diff = scelta.get(g[i]) - p[i * 3 + 1];
      if (Math.abs(diff) < 0.002) continue;
      if (!d) d = quote.distanze(p);
      p[i * 3 + 1] += diff;
      for (let j = i - 1; j >= 0 && d[i] - d[j] < 12 && g[j].n < 2; j--) if (!fissi[s][j]) p[j * 3 + 1] += diff * (1 - (d[i] - d[j]) / 12);
      for (let j = i + 1; j < n && d[j] - d[i] < 12 && g[j].n < 2; j++) if (!fissi[s][j]) p[j * 3 + 1] += diff * (1 - (d[j] - d[i]) / 12);
    }
  }
  return grado;
}

// Quota della strada piu' importante (diversa da "s") la cui carreggiata copre il punto (x, z), oppure null.
// Serve per i BORDI del nastro di asfalto: dove una strada entra in un'altra, i suoi bordi seguono il piano
// dell'altra (anche se e' in pendenza), cosi' i due asfalti combaciano invece di fare uno scalino.
function quotaSuAltra(strade, s, x, z, y) {
  const cx = Math.floor(x / CELLA), cz = Math.floor(z / CELLA);
  let quota = null, gradoMigliore = strade.grado[s];
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) continue;
      for (const [o, j] of pezzi) {
        if (o === s || strade.grado[o] >= gradoMigliore) continue;
        const altra = strade.lista[o];
        if (altra.g || (altra.b && !strade.lista[s].riemp)) continue;
        const q = altra.p;
        const ax = q[j], az = q[j + 2], bx = q[j + 3], bz = q[j + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        if (lungo === 0) continue;
        let t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo;
        if ((t < 0 && j === 0) || (t > 1 && j + 6 >= q.length)) continue;
        t = Math.min(Math.max(t, 0), 1);
        if (Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) > larghezzaIn(altra, j / 3) / 2 + 0.3) continue;
        const yAltra = q[j + 1] + (q[j + 4] - q[j + 1]) * t;
        if (Math.abs(yAltra - y) > 3) continue;
        quota = yAltra;
        gradoMigliore = strade.grado[o];
      }
    }
  }
  return quota;
}

// Il terreno sotto le strade segue le quote sistemate qui sopra. Va chiamata PRIMA di disegnare il terreno.
//  - sotto la carreggiata (e fin dove un punto della griglia del terreno puo' ancora "toccarla") il terreno sta
//    15 cm sotto l'asfalto; se li' passano due strade a quote diverse (tornanti) vince la piu' BASSA: il terreno
//    non copre mai una strada (quella piu' alta resta su un muro di sostegno, disegnato da aggiungiStrade);
//  - poi una banchina e una scarpata che si raccorda al terreno vero, piu' lunga dove lo scavo o il riporto e' alto;
//  - sotto i ponti il terreno viene solo abbassato, se arriva a meno di 1.2 m dall'impalcato.
export function adattaTerreno(terreno, strade) {
  const passo = terreno.passo, colonne = terreno.colonne, righe = terreno.righe;
  const quote = terreno.quote;
  const BANCHINA = 1.5, SOTTO = 0.15, TOCCA = passo * 1.42, RAGGIO = 16;
  const sotto = new Map();     // cella -> quota piu' bassa tra le strade che la cella puo' toccare
  const vicino = new Map();    // cella -> [distanza dal bordo, quota voluta] della strada piu' vicina
  const ponti = new Map();     // cella -> quota massima sotto un ponte
  for (const strada of strade.lista) {
    if (strada.g) continue;
    const p = strada.p;
    // per ogni cella: il punto piu' vicino di QUESTA strada (un elenco, perche' una strada a tornanti passa
    // vicino alla stessa cella piu' volte, a quote diverse: ogni passaggio conta come una strada a parte)
    const celle = new Map();
    let fatta = 0;
    for (let i = 0; i + 5 < p.length; i += 3) {
      const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
      const meta = Math.max(larghezzaIn(strada, i / 3), larghezzaIn(strada, i / 3 + 1)) / 2;
      const raggio = meta + (strada.b ? TOCCA : RAGGIO);
      const c0 = Math.max(Math.floor((Math.min(ax, bx) - raggio + terreno.metaX) / passo), 0);
      const c1 = Math.min(Math.ceil((Math.max(ax, bx) + raggio + terreno.metaX) / passo), colonne - 1);
      const r0 = Math.max(Math.floor((Math.min(az, bz) - raggio + terreno.metaZ) / passo), 0);
      const r1 = Math.min(Math.ceil((Math.max(az, bz) + raggio + terreno.metaZ) / passo), righe - 1);
      const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
      const lung = Math.sqrt(lungo);
      for (let r = r0; r <= r1; r++) {
        const z = r * passo - terreno.metaZ;
        for (let c = c0; c <= c1; c++) {
          const x = c * passo - terreno.metaX;
          let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
          t = Math.min(Math.max(t, 0), 1);
          const dalBordo = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t)) - meta;
          if (dalBordo > raggio - meta) continue;
          const k = r * colonne + c;
          const voce = [dalBordo, ay + (by - ay) * t, fatta + lung * t];
          const elenco = celle.get(k);
          if (!elenco) { celle.set(k, [voce]); continue; }
          let stesso = false;
          for (let e = 0; e < elenco.length; e++) {
            if (Math.abs(elenco[e][2] - voce[2]) > 14) continue;
            stesso = true;
            if (dalBordo < elenco[e][0]) elenco[e] = voce;
            break;
          }
          if (!stesso) elenco.push(voce);
        }
      }
      fatta += lung;
    }
    for (const [k, elenco] of celle) {
      for (const [dalBordo, y] of elenco) {
        if (strada.b) {
          const prima = ponti.get(k);
          if (prima === undefined || y - 1.2 < prima) ponti.set(k, y - 1.2);
          continue;
        }
        if (dalBordo <= TOCCA) {
          const prima = sotto.get(k);
          if (prima === undefined || y - SOTTO < prima) sotto.set(k, y - SOTTO);
        }
        const prima = vicino.get(k);
        if (!prima || dalBordo < prima[0]) vicino.set(k, [dalBordo, y - SOTTO]);
      }
    }
  }
  for (const [k, v] of vicino) {
    if (sotto.has(k)) continue;
    // scarpata: 1.5 m di raccordo per ogni metro di dislivello (minimo 3 m)
    const lungo = Math.max(3, Math.abs(v[1] - quote[k]) * 1.5);
    const peso = Math.min(Math.max((v[0] - TOCCA - BANCHINA) / lungo, 0), 1);   // 0 = strada, 1 = terreno vero
    const liscio = peso * peso * (3 - 2 * peso);
    const nuova = v[1] * (1 - liscio) + quote[k] * liscio;
    if (nuova > quote[k] && ponti.has(k)) continue;   // sotto un ponte non si riempie il burrone
    quote[k] = nuova;
  }
  for (const [k, y] of sotto) quote[k] = y;
  for (const [k, y] of ponti) if (quote[k] > y && !sotto.has(k)) quote[k] = y;
  // ultimo controllo: sotto ogni punto della carreggiata (centro e bordi) il terreno deve stare sotto l'asfalto;
  // dove non e' cosi' (tornanti strettissimi) si abbassano i quattro punti di griglia intorno
  for (const strada of strade.lista) {
    if (strada.g || strada.b) continue;
    const p = strada.p, n = p.length / 3;
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, n - 1) * 3;
      let dx = p[b] - p[a], dz = p[b + 2] - p[a + 2];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const meta = larghezzaIn(strada, i) / 2;
      const y = p[i * 3 + 1];
      for (const lat of [-meta, -meta / 2, 0, meta / 2, meta]) {
        const x = p[i * 3] - dz * lat, z = p[i * 3 + 2] + dx * lat;
        const c = Math.floor((x + terreno.metaX) / passo), r = Math.floor((z + terreno.metaZ) / passo);
        if (c < 0 || r < 0 || c >= colonne - 1 || r >= righe - 1) continue;
        for (const k of [r * colonne + c, r * colonne + c + 1, (r + 1) * colonne + c, (r + 1) * colonne + c + 1]) {
          if (quote[k] > y - SOTTO) quote[k] = y - SOTTO;
        }
      }
    }
  }
  return vicino.size;
}

function costruisciGriglia(lista) {
  // Griglia: per ogni cella, l'elenco dei pezzi di strada che ci passano
  const griglia = new Map();
  for (let s = 0; s < lista.length; s++) {
    const p = lista[s].p;
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
  return griglia;
}

// Aggiunge punti a una strada: "nuovi" = [indice del pezzo, t lungo il pezzo, x, z] (x, z facoltativi)
function inserisciPunti(strada, nuovi) {
  if (nuovi.length === 0) return;
  nuovi.sort(function (a, b) { return (a[0] - b[0]) || (a[1] - b[1]); });
  const p = strada.p, n = p.length / 3;
  const q = [], ww = strada.ww ? [] : null;
  let k = 0;
  for (let i = 0; i < n; i++) {
    q.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    if (ww) ww.push(strada.ww[Math.min(i, strada.ww.length - 1)]);
    let ultimoT = 0;
    while (k < nuovi.length && nuovi[k][0] === i) {
      const t = nuovi[k][1];
      if (i < n - 1 && t - ultimoT > 1e-4) {
        const ax = p[i * 3], az = p[i * 3 + 2], bx = p[i * 3 + 3], bz = p[i * 3 + 5];
        q.push(nuovi[k][2] !== undefined ? nuovi[k][2] : ax + (bx - ax) * t, p[i * 3 + 1] + (p[i * 3 + 4] - p[i * 3 + 1]) * t, nuovi[k][3] !== undefined ? nuovi[k][3] : az + (bz - az) * t);
        if (ww) ww.push(larghezzaIn(strada, i) + (larghezzaIn(strada, i + 1) - larghezzaIn(strada, i)) * t);
        ultimoT = t;
      }
      k++;
    }
  }
  strada.p = q;
  if (ww) strada.ww = ww;
}

// Prepara la rete: un punto almeno ogni 4.5 m, e un nodo IN COMUNE dove due strade si incrociano o dove una finisce
// sopra un'altra. (Nei dati OpenStreetMap gli incroci hanno quasi sempre gia' il nodo in comune: qui si coprono i casi
// in cui manca, cosi' poi le quote si possono mettere tutte sullo stesso piano.)
function preparaRete(lista) {
  for (const strada of lista) {
    const p = strada.p, nuovi = [];
    for (let i = 0; i + 5 < p.length; i += 3) {
      const l = Math.hypot(p[i + 3] - p[i], p[i + 5] - p[i + 2]);
      const pezzi = Math.ceil(l / 4.5);
      for (let k = 1; k < pezzi; k++) nuovi.push([i / 3, k / pezzi]);
    }
    inserisciPunti(strada, nuovi);
  }
  const griglia = costruisciGriglia(lista);
  const nuovi = lista.map(function () { return []; });
  const fatti = new Set();
  for (const pezzi of griglia.values()) {
    for (let a = 0; a < pezzi.length; a++) {
      const [sa, i] = pezzi[a];
      const A = lista[sa];
      if (A.g || A.b) continue;
      const p = A.p;
      const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
      const la = Math.hypot(bx - ax, bz - az);
      if (la < 0.01) continue;
      for (let b = 0; b < pezzi.length; b++) {
        const [sb, j] = pezzi[b];
        if (sb === sa) continue;
        const B = lista[sb];
        if (B.g || B.b) continue;
        const q = B.p;
        const cx = q[j], cy = q[j + 1], cz = q[j + 2], dx = q[j + 3], dy = q[j + 4], dz = q[j + 5];
        const lb = Math.hypot(dx - cx, dz - cz);
        if (lb < 0.01 || Math.abs((ay + by) / 2 - (cy + dy) / 2) > 3) continue;
        // un capo di B finisce sopra il pezzo di A (senza nodo in comune): nodo nuovo in A, nello stesso punto
        for (const fine of [0, q.length - 3]) {
          if (fine !== j && fine !== j + 3) continue;
          const ex = q[fine], ez = q[fine + 2];
          const t = ((ex - ax) * (bx - ax) + (ez - az) * (bz - az)) / (la * la);
          if (t * la < 0.3 || (1 - t) * la < 0.3) continue;
          if (Math.hypot(ex - (ax + (bx - ax) * t), ez - (az + (bz - az) * t)) > 0.6) continue;
          const k = sa + ":" + i + ":" + sb + ":" + fine;
          if (fatti.has(k)) continue;
          fatti.add(k);
          nuovi[sa].push([i / 3, t, ex, ez]);
        }
        // i due pezzi si incrociano: nodo nuovo in tutti e due
        if (sb < sa) continue;
        const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den;
        const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
        if (t * la < 0.3 || (1 - t) * la < 0.3 || u * lb < 0.3 || (1 - u) * lb < 0.3) continue;
        const k = sa + ":" + i + ":" + sb + ":" + j;
        if (fatti.has(k)) continue;
        fatti.add(k);
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        nuovi[sa].push([i / 3, t, x, z]);
        nuovi[sb].push([j / 3, u, x, z]);
      }
    }
  }
  for (let s = 0; s < lista.length; s++) inserisciPunti(lista[s], nuovi[s]);
}

// Direzione (unitaria) della strada nel punto i
function direzioneIn(p, i) {
  const n = p.length / 3;
  const a = Math.max(i - 1, 0) * 3, b = Math.min(i + 1, n - 1) * 3;
  const dx = p[b] - p[a], dz = p[b + 2] - p[a + 2];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

// I capi delle strade veloci, per nodo: chiave -> [{ s: strada, fine: indice del punto (0 oppure n - 1) }]
function capiVeloci(lista) {
  const nodi = new Map();
  for (let s = 0; s < lista.length; s++) {
    const strada = lista[s];
    if (!stradaVeloce(strada) || strada.riemp) continue;
    const p = strada.p, n = p.length / 3;
    if (n < 2) continue;
    for (const fine of [0, n - 1]) {
      const k = chiaveNodo(p[fine * 3], p[fine * 3 + 2]);
      if (!nodi.has(k)) nodi.set(k, []);
      nodi.get(k).push({ s: s, fine: fine });
    }
  }
  return nodi;
}

// Le rampe senza numero di corsie nei dati valgono 6 m (due corsie), ma se continuano una rampa a una corsia sono a
// una corsia anche loro: senza questo, a meta' rampa l'asfalto raddoppiava di colpo.
function larghezzaRaccordi(lista) {
  const nodi = capiVeloci(lista);
  for (let giro = 0; giro < 3; giro++) {
    for (const capi of nodi.values()) {
      if (capi.length !== 2) continue;
      const a = lista[capi[0].s], b = lista[capi[1].s];
      for (const [larga, stretta] of [[a, b], [b, a]]) {
        if (larga.t.endsWith("_link") && larga.w === 6 && !larga.ww && stretta.w < 4) larga.w = stretta.w;
      }
    }
  }
}

// --- Forma delle carreggiate delle strade veloci ----------------------------------------------------------
// In OpenStreetMap dove una rampa entra in autostrada (o dove la strada a due sensi si divide in due carreggiate) le
// due linee convergono fino a toccarsi in UN punto. Disegnate cosi', i due nastri si sovrappongono a cuneo: l'asfalto
// si stringe fino a una corsia e poi si riallarga di colpo. Nella realta' le corsie corrono AFFIANCATE.
//  1) "affianca": vicino al nodo le due strade che convergono vengono spostate di lato finche' stanno una accanto
//     all'altra, e insieme sono larghe quanto la strada che continua;
//  2) "rastrema": dove una strada continua in un'altra di larghezza diversa (2 corsie -> 3), la larghezza cambia in
//     45 m invece che di colpo.
// Va chiamata DOPO le quote (i nodi in comune servono a metterle sullo stesso piano).
function formaVeloci(lista) {
  const nodi = capiVeloci(lista);
  // punti in fila allontanandosi dal capo "capo" della strada s; continua nella strada successiva
  const catena = function (s, capo, massimo) {
    const punti = [], viste = new Set();
    let fatta = 0;
    for (;;) {
      viste.add(s);
      const p = lista[s].p, n = p.length / 3;
      const passo = capo === 0 ? 1 : -1;
      for (let i = capo; i >= 0 && i < n; i += passo) {
        if (punti.length > 0) {
          const u = punti[punti.length - 1];
          fatta += Math.hypot(p[i * 3] - u.x, p[i * 3 + 2] - u.z);
        }
        punti.push({ s: s, i: i, x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2] });
        if (fatta > massimo) return punti;
      }
      const ultimo = capo === 0 ? n - 1 : 0;
      const altri = (nodi.get(chiaveNodo(p[ultimo * 3], p[ultimo * 3 + 2])) || []).filter(function (e) { return e.s !== s; });
      if (altri.length !== 1 || lista[altri[0].s].g || viste.has(altri[0].s)) return punti;
      s = altri[0].s;
      capo = altri[0].fine;
    }
  };
  // punto piu' vicino su una catena: [distanza, x, y, z]
  const vicinoSu = function (c, x, z) {
    let migliore = [Infinity, 0, 0, 0];
    for (let k = 0; k + 1 < c.length; k++) {
      const a = c[k], b = c[k + 1];
      const lungo = (b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z);
      let t = lungo > 0 ? ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / lungo : 0;
      t = Math.min(Math.max(t, 0), 1);
      const qx = a.x + (b.x - a.x) * t, qz = a.z + (b.z - a.z) * t;
      const d = Math.hypot(x - qx, z - qz);
      if (d < migliore[0]) migliore = [d, qx, a.y + (b.y - a.y) * t, qz];
    }
    return migliore;
  };
  const spinte = new Map();      // "s:i" -> [dx, dz, somma delle quote, quante]
  const cuciture = [];           // [s, i, valore]
  const rastremi = [];           // [s, fine, larghezza nel nodo]
  const prolunghe = [];          // [s, fine, dirX, dirZ, quota]
  const usati = new Set();
  for (const capi of nodi.values()) {
    if (capi.length !== 3) continue;
    if (capi.some(function (e) { return lista[e.s].g; })) continue;
    if (new Set(capi.map(function (e) { return e.s; })).size !== 3) continue;
    const cat = capi.map(function (e) { return catena(e.s, e.fine, 320); });
    if (cat.some(function (c) { return c.length < 2; })) continue;
    const N = cat[0][0];
    const dir = cat.map(function (c) {
      let j = 1;
      while (j < c.length - 1 && Math.hypot(c[j].x - N.x, c[j].z - N.z) < 30) j++;
      const dx = c[j].x - N.x, dz = c[j].z - N.z, l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    });
    // le due che partono dal nodo quasi nella stessa direzione sono quelle che convergono; la terza continua
    let coppia = null;
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 1], [1, 2, 0]]) {
      const dot = dir[a][0] * dir[b][0] + dir[a][1] * dir[b][1];
      if (!coppia || dot > coppia.dot) coppia = { a: a, b: b, c: c, dot: dot };
    }
    if (coppia.dot < 0.9) continue;
    const a = coppia.a, b = coppia.b, c = coppia.c;
    const mx = dir[a][0] + dir[b][0], mz = dir[a][1] + dir[b][1], ml = Math.hypot(mx, mz) || 1;
    if (-(dir[c][0] * mx + dir[c][1] * mz) / ml < 0.85) continue;
    const wA = lista[capi[a].s].w, wB = lista[capi[b].s].w, wC = lista[capi[c].s].w;
    const affiancate = (wA + wB) / 2;                 // distanza tra i centri quando stanno una accanto all'altra
    const sMin = Math.min(wC - affiancate, affiancate);
    if (sMin < 0.6) continue;
    const cucite = Math.abs(sMin - affiancate) < 0.3;
    const opposte = capi[a].fine !== capi[b].fine;    // una arriva al nodo e l'altra parte: sensi di marcia opposti
    for (const [io, altro, padrona] of [[a, b, true], [b, a, false]]) {
      const mia = cat[io], sua = cat[altro];
      // da che parte sta l'altra? si guarda dove le due si sono gia' staccate
      let lato = 0;
      for (let k = 1; k < mia.length && lato === 0; k++) {
        const v = vicinoSu(sua, mia[k].x, mia[k].z);
        if (v[0] < 1.2 && k < mia.length - 1) continue;
        const d = direzioneIn(lista[mia[k].s].p, mia[k].i);
        lato = (-d[1] * (mia[k].x - v[1]) + d[0] * (mia[k].z - v[3])) >= 0 ? 1 : -1;   // +1 = io sto alla sua sinistra (lungo la mia direzione)
      }
      if (lato === 0) continue;
      for (let k = 0; k < mia.length; k++) {
        const pt = mia[k];
        const d = direzioneIn(lista[pt.s].p, pt.i);
        const v = vicinoSu(sua, pt.x, pt.z);
        const sep = lato * (-d[1] * (pt.x - v[1]) + d[0] * (pt.z - v[3]));   // distanza con segno: negativa se si sono incrociate
        if (sep >= sMin) break;
        const quanto = (sMin - sep) / 2;
        const chiave = pt.s + ":" + pt.i;
        let voce = spinte.get(chiave);
        if (!voce) { voce = [0, 0, 0, 0]; spinte.set(chiave, voce); }
        voce[0] += -d[1] * lato * quanto;
        voce[1] += d[0] * lato * quanto;
        const peso = Math.min(quanto / 0.5, 1);
        voce[2] += pt.y + (v[2] - pt.y) * 0.5 * peso;   // stessa quota della corsia accanto
        voce[3]++;
        // la cucitura (la riga tra le due corsie affiancate) sta dalla parte dell'altra; la disegna una sola delle due
        const dirStrada = direzioneIn(lista[pt.s].p, pt.i);
        void dirStrada;
        if (cucite && quanto > 0.02) cuciture.push([pt.s, pt.i, -lato * (padrona ? (opposte ? 2 : 1) : 3)]);
      }
      // 1.5 m di sovrapposizione con la strada che continua: non restano fessure tra i nastri
      const y1 = cat[c].length > 1 ? N.y + (cat[c][1].y - N.y) * Math.min(1, 1.5 / (Math.hypot(cat[c][1].x - N.x, cat[c][1].z - N.z) || 1)) : N.y;
      prolunghe.push([capi[io].s, capi[io].fine, dir[c][0], dir[c][1], y1]);
    }
    for (const e of capi) usati.add(e.s + ":" + e.fine);
    if (wC - (sMin + affiancate) > 0.3) rastremi.push([capi[c].s, capi[c].fine, sMin + affiancate]);
  }
  for (const capi of nodi.values()) {
    if (capi.length !== 2 || capi[0].s === capi[1].s) continue;
    const A = lista[capi[0].s], B = lista[capi[1].s];
    if (Math.abs(A.w - B.w) < 0.3) continue;
    const nelNodo = A.g ? A.w : (B.g ? B.w : (A.w + B.w) / 2);
    for (const e of capi) if (!lista[e.s].g && !usati.has(e.s + ":" + e.fine)) rastremi.push([e.s, e.fine, nelNodo]);
  }
  // larghezze che cambiano piano
  const RASTREMA = 45;
  for (const [s, fine, nelNodo] of rastremi) {
    const strada = lista[s], p = strada.p, n = p.length / 3;
    if (!strada.ww || strada.ww.length !== n) {
      const prima = strada.ww;
      strada.ww = [];
      for (let i = 0; i < n; i++) strada.ww.push(prima ? prima[Math.min(i, prima.length - 1)] : strada.w);
    }
    let fatta = 0;
    const passo = fine === 0 ? 1 : -1;
    for (let i = fine; i >= 0 && i < n; i += passo) {
      if (i !== fine) fatta += Math.hypot(p[i * 3] - p[(i - passo) * 3], p[i * 3 + 2] - p[(i - passo) * 3 + 2]);
      if (fatta >= RASTREMA) break;
      const f = 1 - fatta / RASTREMA;
      strada.ww[i] += (nelNodo - strada.w) * f * f * (3 - 2 * f);
    }
  }
  // spostamenti di lato
  for (const [chiave, v] of spinte) {
    const [s, i] = chiave.split(":").map(Number);
    const p = lista[s].p;
    p[i * 3] += v[0];
    p[i * 3 + 1] = v[2] / v[3];
    p[i * 3 + 2] += v[1];
    if (!lista[s].spinta) lista[s].spinta = new Uint8Array(p.length / 3);
    lista[s].spinta[i] = 1;
  }
  for (const [s, i, valore] of cuciture) {
    if (!lista[s].cuc) lista[s].cuc = new Int8Array(lista[s].p.length / 3);
    lista[s].cuc[i] = valore;
  }
  // prolunghe: un punto in piu' oltre il capo, lungo la strada che continua
  for (const [s, fine, dx, dz, y] of prolunghe) {
    const strada = lista[s], p = strada.p, n = p.length / 3;
    const capo = fine === 0 ? 0 : n - 1;
    const nuovo = [p[capo * 3] + dx * 1.5, y, p[capo * 3 + 2] + dz * 1.5];
    for (const nome of ["ww", "cuc", "spinta"]) {
      if (!strada[nome]) continue;
      const v = Array.from(strada[nome]);
      if (fine === 0) v.unshift(v[0]); else v.push(v[v.length - 1]);
      strada[nome] = nome === "ww" ? v : (nome === "cuc" ? Int8Array.from(v) : Uint8Array.from(v));
    }
    if (fine === 0) strada.p = nuovo.concat(p); else p.push(nuovo[0], nuovo[1], nuovo[2]);
  }
}

// Tra due carreggiate veloci affiancate (le due direzioni dell'A13, una rampa che si stacca) non resta una striscia
// d'erba larga un metro: lo spazio viene ASFALTATO (fino a 6.5 m), come lo spartitraffico e le zone zebrate vere.
// Ogni riempimento e' una "strada" in piu' in fondo alla lista (riemp: true): cosi' si disegna, si guida e sposta il
// terreno come le altre. Tra due carreggiate in senso opposto c'e' anche la barriera centrale.
function riempiTraCarreggiate(lista) {
  const griglia = costruisciGriglia(lista);
  const barriere = [];
  const quante = lista.length;
  const segna = function (strada, i, lato) {
    if (!strada.chiuso) strada.chiuso = new Uint8Array(strada.p.length / 3);
    strada.chiuso[i] |= lato > 0 ? 1 : 2;
  };
  for (let s = 0; s < quante; s++) {
    const A = lista[s];
    if (!stradaVeloce(A) || A.g) continue;
    const p = A.p, n = p.length / 3;
    for (const lato of [1, -1]) {
      let corsa = null, barriera = null, buchi = 0, buchiBarriera = 0;
      const chiudi = function () {
        if (corsa && corsa.p.length >= 6) {
          lista.push({ n: A.n, t: "riempimento", w: Math.max.apply(null, corsa.ww), ww: corsa.ww, b: corsa.b, g: false, p: corsa.p, riemp: true });
        }
        corsa = null;
      };
      const chiudiBarriera = function () {
        if (barriera && barriera.length >= 6) barriere.push(barriera);
        barriera = null;
      };
      for (let i = 0; i < n; i++) {
        const d = direzioneIn(p, i);
        const nx = -d[1] * lato, nz = d[0] * lato;
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        const meta = larghezzaIn(A, i) / 2;
        const cx = Math.floor(x / CELLA), cz = Math.floor(z / CELLA);
        let m = null;
        for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
          const pezzi = griglia.get(ix + "," + iz);
          if (!pezzi) continue;
          for (const [o, j] of pezzi) {
            if (o === s || o >= quante) continue;
            const B = lista[o];
            if (!stradaVeloce(B) || B.g) continue;
            const q = B.p;
            const ax = q[j], az = q[j + 2], bx = q[j + 3], bz = q[j + 5];
            const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
            if (lungo < 0.01) continue;
            const t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo;
            if (t < 0 || t > 1) continue;
            const vx = ax + (bx - ax) * t - x, vz = az + (bz - az) * t - z;
            const dist = Math.hypot(vx, vz);
            if (dist < 0.3 || (m && dist >= m.dist)) continue;
            if ((vx * nx + vz * nz) / dist < 0.8) continue;        // deve stare di fianco, da questo lato
            const lung = Math.sqrt(lungo);
            const dot = (d[0] * (bx - ax) + d[1] * (bz - az)) / lung;
            if (Math.abs(dot) < 0.9) continue;
            const j3 = j / 3;
            const metaB = (larghezzaIn(B, j3) + (larghezzaIn(B, j3 + 1) - larghezzaIn(B, j3)) * t) / 2;
            const yB = q[j + 1] + (q[j + 4] - q[j + 1]) * t;
            if (Math.abs(yB - y) > 0.6) continue;
            if (dist - meta - metaB < -0.5) continue;              // sovrapposta (il capo di una corsia che confluisce): non e' "di fianco"
            m = { dist: dist, vx: vx / dist, vz: vz / dist, dot: dot, spazio: dist - meta - metaB, y: yB, o: o, j: j3, t: t,
              latoB: (-(bz - az) * -vx + (bx - ax) * -vz) >= 0 ? 1 : -1 };
          }
        }
        // una sola delle due carreggiate fa il lavoro: stesso senso -> quella che ha l'altra a sinistra;
        // senso opposto -> quella che va verso est
        const mia = m !== null && m.spazio <= (m.dot > 0 ? 4 : 6.5) && (m.dot > 0 ? lato === 1 : (d[0] > 0.05 || (Math.abs(d[0]) <= 0.05 && d[1] > 0)));
        if (mia && m.spazio > 0.05) {
          const B = lista[m.o];
          const ponte = A.b || B.b;
          const punto = [x + m.vx * (meta + m.spazio / 2), (y + m.y) / 2, z + m.vz * (meta + m.spazio / 2)];
          if (corsa && corsa.b !== ponte) { corsa.p.push(punto[0], punto[1], punto[2]); corsa.ww.push(m.spazio + 0.8); chiudi(); }
          if (!corsa) corsa = { p: [], ww: [], b: ponte };
          corsa.p.push(punto[0], punto[1], punto[2]);
          corsa.ww.push(m.spazio + 0.8);
          segna(A, i, lato);
          segna(B, m.j, m.latoB);
          segna(B, m.j + 1, m.latoB);
          buchi = 0;
        } else if (corsa && buchi < 1) buchi++;   // un punto senza l'altra carreggiata di fronte (una curva, un cambio di pezzo): si salta
        else chiudi();
        // barriera centrale: tra due carreggiate in senso opposto (non dove sono ancora cucite insieme)
        const cucita = m !== null && (latoOccupatoDaCorsia(A, i, lato) || latoOccupatoDaCorsia(lista[m.o], m.j, m.latoB));
        if (mia && m.dot < 0 && !cucita) {
          if (!barriera) barriera = [];
          barriera.push(x + m.vx * (meta + m.spazio / 2), (y + m.y) / 2, z + m.vz * (meta + m.spazio / 2));
          if (m.spazio <= 0.05) { segna(A, i, lato); segna(lista[m.o], m.j, m.latoB); segna(lista[m.o], m.j + 1, m.latoB); }
          buchiBarriera = 0;
        } else if (barriera && buchiBarriera < 1) buchiBarriera++;
        else chiudiBarriera();
      }
      chiudi();
      chiudiBarriera();
    }
  }
  return barriere;
}

export async function caricaStrade() {
  const risposta = await fetch("dati/strade.json");
  if (!risposta.ok) {
    throw new Error("Mancano i dati delle strade: " + (await risposta.text()));
  }
  const dati = await risposta.json();
  preparaRete(dati.strade);
  larghezzaRaccordi(dati.strade);
  const quote = sistemaQuote(dati.strade);
  const gradoStrade = stessoPiano(dati.strade, costruisciGriglia(dati.strade), quote);

  // strade veloci: corsie affiancate agli svincoli, larghezze che cambiano piano, spartitraffico asfaltato
  const vere = dati.strade.length;
  formaVeloci(dati.strade);
  const barriere = riempiTraCarreggiate(dati.strade);
  const griglia = costruisciGriglia(dati.strade);
  // grado: 0 = la strada piu' importante (la piu' larga); dove due strade si sovrappongono comanda quella.
  // I riempimenti vengono dopo tutte le strade vere.
  const grado = new Int32Array(dati.strade.length);
  grado.set(gradoStrade);
  for (let s = vere; s < grado.length; s++) grado[s] = s;
  return { lista: dati.strade, griglia: griglia, incroci: quote.incroci, grado: grado, barriere: barriere };
}

// Il punto e' sull'asfalto di una strada qualsiasi (non in galleria)? "margine" allarga la carreggiata
export function sullAsfalto(strade, x, z, margine) {
  return copertoDaAltra(strade, x, z, -1, margine || 0);
}

// Distanza (lungo la strada) dal punto t del segmento i al primo incrocio in avanti (verso = 1) o indietro (-1)
export function distanzaIncrocio(strade, s, i, t, verso, massimo) {
  const p = strade.lista[s].p;
  const n = p.length / 3;
  let k = i / 3;
  const seg = Math.hypot(p[i + 3] - p[i], p[i + 5] - p[i + 2]);
  let fatta = verso > 0 ? seg * (1 - t) : seg * t;
  k = verso > 0 ? k + 1 : k;
  while (k >= 0 && k < n && fatta <= massimo) {
    if (strade.incroci.has(chiaveNodo(p[k * 3], p[k * 3 + 2]))) return fatta;
    const prossimo = k + verso;
    if (prossimo < 0 || prossimo >= n) break;
    fatta += Math.hypot(p[prossimo * 3] - p[k * 3], p[prossimo * 3 + 2] - p[k * 3 + 2]);
    k = prossimo;
  }
  return Infinity;
}

// Larghezza della strada nel punto i (piu' stretta dove ci sono le case)
export function larghezzaIn(strada, i) {
  return strada.ww ? strada.ww[Math.min(i, strada.ww.length - 1)] : strada.w;
}

// Aggiunge un nastro (striscia) a una lista di vertici e indici.
// "larghezza" puo' essere un numero oppure una funzione(i) che da' la larghezza nel punto i
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
    const qui = typeof larghezza === "function" ? larghezza(i) : larghezza;
    const latoX = -dz * qui / 2;
    const latoZ = dx * qui / 2;
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
  const nastro = new THREE.Mesh(geometria, materiale);
  nastro.receiveShadow = true;   // ombra della moto sull'asfalto
  return nastro;
}

// Parapetto: due "muretti" alti 1 m ai lati di un ponte, che scendono 0.7 m sotto l'asfalto (il fianco
// dell'impalcato: da sotto e di lato il ponte non sembra piu' un foglio di carta). Niente parapetto dal lato dove
// c'e' un'altra corsia affiancata o lo spartitraffico asfaltato.
function aggiungiParapetti(strada, posizioni, indici) {
  const p = strada.p;
  const punti = p.length / 3;
  for (const lato of [-1, 1]) {
    let prima = false;
    for (let i = 0; i < punti; i++) {
      const d = direzioneIn(p, i);
      const meta = larghezzaIn(strada, i) / 2;
      const x = p[i * 3] - d[1] * lato * meta;
      const z = p[i * 3 + 2] + d[0] * lato * meta;
      const y = p[i * 3 + 1];
      const libero = !latoOccupato(strada, i, lato);
      if (!libero) { prima = false; continue; }
      const primo = posizioni.length / 3;
      posizioni.push(x, y - 0.7, z, x, y + 1.0, z);
      if (prima) {
        indici.push(primo - 2, primo, primo - 1, primo - 1, primo, primo + 1);
      }
      prima = true;
    }
  }
}

// Da questo lato (+1 = sinistra lungo la strada, -1 = destra) c'e' una corsia affiancata o lo spartitraffico asfaltato?
function latoOccupatoDaCorsia(strada, i, lato) {
  return !!strada.cuc && strada.cuc[i] !== 0 && Math.sign(strada.cuc[i]) === lato;
}
function latoOccupato(strada, i, lato) {
  if (strada.chiuso && (strada.chiuso[i] & (lato > 0 ? 1 : 2))) return true;
  return latoOccupatoDaCorsia(strada, i, lato);
}

// Barriera centrale tra le due carreggiate (profilo di cemento tipo "New Jersey"): due facce inclinate e la testa
function aggiungiBarriere(barriere, scena) {
  if (!barriere || barriere.length === 0) return;
  const pos = [], ind = [];
  const BASE = 0.26, TESTA = 0.1, ALTA = 0.85;
  for (const linea of barriere) {
    const n = linea.length / 3;
    for (let i = 0; i < n; i++) {
      const d = direzioneIn(linea, i);
      const x = linea[i * 3], y = linea[i * 3 + 1] - 0.05, z = linea[i * 3 + 2];
      const primo = pos.length / 3;
      for (const [lat, alto] of [[-BASE, 0], [-TESTA, ALTA], [TESTA, ALTA], [BASE, 0]]) pos.push(x - d[1] * lat, y + alto, z + d[0] * lat);
      if (i > 0) for (let k = 0; k < 3; k++) {
        const a = primo - 4 + k, b = primo + k;
        ind.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const mesh = creaMesh(pos, ind, 0xb9b7b0, 0);
  mesh.castShadow = true;
  scena.add(mesh);
}

// Muri di sostegno: dove il terreno a lato sta piu' in basso dell'asfalto (tornanti, strade a mezza costa) un muro
// scende dal bordo della strada fino al terreno, cosi' la strada non resta mai "sospesa" con il vuoto sotto.
function aggiungiMuri(strada, terreno, muri) {
  const p = strada.p;
  const punti = p.length / 3;
  for (const lato of [-1, 1]) {
    let prima = null;
    for (let i = 0; i < punti; i++) {
      const a = Math.max(i - 1, 0) * 3;
      const b = Math.min(i + 1, punti - 1) * 3;
      let dx = p[b] - p[a], dz = p[b + 2] - p[a + 2];
      const lunghezza = Math.hypot(dx, dz) || 1;
      dx /= lunghezza; dz /= lunghezza;
      const meta = larghezzaIn(strada, i) / 2;
      const x = p[i * 3] - dz * lato * meta, z = p[i * 3 + 2] + dx * lato * meta;
      const y = p[i * 3 + 1];
      // il terreno al bordo e poco piu' in la': si prende il piu' basso
      const giu = Math.min(quotaTerreno(terreno, x, z), quotaTerreno(terreno, x - dz * lato * 1.2, z + dx * lato * 1.2));
      const qui = { x: x, y: y, z: z, giu: giu - 0.4, serve: y - giu > 0.3 && !latoOccupato(strada, i, lato) };
      if (prima !== null && (prima.serve || qui.serve)) {
        const primo = muri.posizioni.length / 3;
        muri.posizioni.push(prima.x, prima.y, prima.z, prima.x, Math.min(prima.giu, prima.y), prima.z, x, y, z, x, Math.min(qui.giu, y), z);
        muri.indici.push(primo, primo + 2, primo + 1, primo + 1, primo + 2, primo + 3);
      }
      prima = qui;
    }
  }
}

// Guardrail: dove a lato della strada il terreno scende di piu' di 1.5 m
const TIPI_CON_GUARDRAIL = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link"];

function aggiungiGuardrail(strada, terreno, nastro, paletti) {
  const p = strada.p;
  const punti = p.length / 3;
  for (const lato of [-1, 1]) {
    let prima = null;   // ultimo punto con guardrail
    for (let i = 0; i < punti; i++) {
      const a = Math.max(i - 1, 0) * 3;
      const b = Math.min(i + 1, punti - 1) * 3;
      let dx = p[b] - p[a];
      let dz = p[b + 2] - p[a + 2];
      const lunghezza = Math.hypot(dx, dz) || 1;
      dx = dx / lunghezza;
      dz = dz / lunghezza;
      const distanza = larghezzaIn(strada, i) / 2 + 0.4;
      const x = p[i * 3] - dz * lato * distanza;
      const z = p[i * 3 + 2] + dx * lato * distanza;
      const y = p[i * 3 + 1];
      const fuori = quotaTerreno(terreno, p[i * 3] - dz * lato * (distanza + 2), p[i * 3 + 2] + dx * lato * (distanza + 2));
      if (y - fuori > 1.5 && !latoOccupato(strada, i, lato)) {
        if (prima !== null) {
          const primo = nastro.posizioni.length / 3;
          nastro.posizioni.push(prima.x, prima.y + 0.5, prima.z, prima.x, prima.y + 0.8, prima.z,
                                x, y + 0.5, z, x, y + 0.8, z);
          nastro.indici.push(primo, primo + 2, primo + 1, primo + 1, primo + 2, primo + 3);
        }
        paletti.push(x, y, z);
        prima = { x: x, y: y, z: z };
      } else {
        prima = null;
      }
    }
  }
}

// --- Texture dell'asfalto e del marciapiede (disegnate dal codice) -------------------------------------
let semeT = 99;
function casualeT() {
  semeT = (semeT * 1664525 + 1013904223) >>> 0;
  return semeT / 4294967296;
}

// u = attraverso la strada (0..1), v = lungo la strada (8 m): inerti, rattoppi, due carreggiate consumate dalle ruote
function texturaAsfalto(anisotropia) {
  const L = 512;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d");
  g.fillStyle = "#8d8b86";
  g.fillRect(0, 0, L, L);
  // toppe e variazioni di colore
  for (let i = 0; i < 38; i++) {
    const x = casualeT() * L, y = casualeT() * L, w = 30 + casualeT() * 160, h = 20 + casualeT() * 90;
    const v = 92 + Math.floor(casualeT() * 40);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v + 2) + "," + (0.04 + casualeT() * 0.07) + ")";
    g.fillRect(x, y, w, h);
  }
  // carreggiate piu' lisce e scure dove passano le ruote
  for (const centro of [0.27, 0.73]) {
    const gr = g.createLinearGradient((centro - 0.1) * L, 0, (centro + 0.1) * L, 0);
    gr.addColorStop(0, "rgba(40,42,46,0)");
    gr.addColorStop(0.5, "rgba(40,42,46,0.32)");
    gr.addColorStop(1, "rgba(40,42,46,0)");
    g.fillStyle = gr;
    g.fillRect((centro - 0.1) * L, 0, 0.2 * L, L);
  }
  // macchie d'olio al centro delle corsie
  for (let i = 0; i < 10; i++) {
    g.fillStyle = "rgba(25,25,28," + (0.1 + casualeT() * 0.12) + ")";
    g.fillRect((casualeT() < 0.5 ? 0.25 : 0.72) * L + (casualeT() - 0.5) * 20, casualeT() * L, 8 + casualeT() * 12, 26 + casualeT() * 70);
  }
  // inerti (sassolini): grana fine
  for (let i = 0; i < 24000; i++) {
    const v = 70 + Math.floor(casualeT() * 100);
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.38)";
    g.fillRect(casualeT() * L, casualeT() * L, 1 + casualeT() * 1.6, 1 + casualeT() * 1.6);
  }
  // crepe sottili
  g.strokeStyle = "rgba(20,20,22,0.35)";
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    let x = casualeT() * L, y = casualeT() * L;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (casualeT() - 0.5) * 36;
      y += 10 + casualeT() * 24;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

// Marciapiede: lastre di cemento con fughe (una lastra = 1 m)
function texturaMarciapiede(anisotropia) {
  const L = 256;
  const c = document.createElement("canvas");
  c.width = L;
  c.height = L;
  const g = c.getContext("2d");
  g.fillStyle = "#b8b5ae";
  g.fillRect(0, 0, L, L);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const v = 176 + Math.floor(casualeT() * 24);
      g.fillStyle = "rgb(" + v + "," + (v - 2) + "," + (v - 6) + ")";
      g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
    }
  }
  for (let i = 0; i < 5000; i++) {
    const v = 130 + Math.floor(casualeT() * 100);
    g.fillStyle = "rgba(" + v + "," + v + "," + (v - 4) + ",0.35)";
    g.fillRect(casualeT() * L, casualeT() * L, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

// Nastro con UV: u da 0 a 1 attraverso la strada, v = metri / 8 lungo la strada
function nastroConUV(p, larghezza, alzata, g, colore, offsetLato, quotaBordo) {
  const punti = p.length / 3;
  let distanza = 0;
  const base = g.posizioni.length / 3;
  for (let i = 0; i < punti; i++) {
    const prima = Math.max(i - 1, 0) * 3;
    const dopo = Math.min(i + 1, punti - 1) * 3;
    let dx = p[dopo] - p[prima];
    let dz = p[dopo + 2] - p[prima + 2];
    const lunghezza = Math.hypot(dx, dz) || 1;
    dx = dx / lunghezza;
    dz = dz / lunghezza;
    const qui = larghezza(i);
    const latoX = -dz * qui / 2;
    const latoZ = dx * qui / 2;
    const x = p[i * 3] + (offsetLato ? -dz * offsetLato : 0);
    const z = p[i * 3 + 2] + (offsetLato ? dx * offsetLato : 0);
    const y = p[i * 3 + 1] + alzata;
    if (i > 0) distanza += Math.hypot(p[i * 3] - p[(i - 1) * 3], p[i * 3 + 2] - p[(i - 1) * 3 + 2]);
    let yA = y, yB = y;
    if (quotaBordo) {
      const a = quotaBordo(x + latoX, z + latoZ, p[i * 3 + 1]), b = quotaBordo(x - latoX, z - latoZ, p[i * 3 + 1]);
      if (a !== null) yA = a + alzata;
      if (b !== null) yB = b + alzata;
    }
    g.posizioni.push(x + latoX, yA, z + latoZ, x - latoX, yB, z - latoZ);
    g.uv.push(0, distanza / 8, 1, distanza / 8);
    g.colori.push(colore.r, colore.g, colore.b, colore.r, colore.g, colore.b);
    if (i > 0) {
      const k = base + i * 2;
      g.indici.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
}

function nuovoNastro() {
  return { posizioni: [], indici: [], uv: [], colori: [] };
}

function meshDa(g, materiale, ricevi) {
  if (g.posizioni.length === 0) return null;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(g.posizioni, 3));
  if (g.uv && g.uv.length > 0) geometria.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
  if (g.colori && g.colori.length > 0) geometria.setAttribute("color", new THREE.Float32BufferAttribute(g.colori, 3));
  geometria.setIndex(g.indici);
  geometria.computeVertexNormals();
  geometria.computeBoundingSphere();
  liberaDopoCaricamento(geometria);
  const m = new THREE.Mesh(geometria, materiale);
  m.receiveShadow = ricevi !== false;
  m.matrixAutoUpdate = false;
  return m;
}

// C'e' un'altra strada (diversa da "escludi") che copre il punto (x, z)? (serve per interrompere i marciapiedi agli incroci)
// "perRighe": serve per le righe sull'asfalto. Lo spartitraffico asfaltato non le cancella, e tra due strade veloci
// conta solo l'asfalto vero dell'altra (non il suo capo arrotondato ne' il margine): cosi' le righe non si
// interrompono dove un pezzo di autostrada continua nel successivo o dove le due carreggiate si sfiorano.
function copertoDaAltra(strade, x, z, escludi, margine, perRighe) {
  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  const veloceIo = perRighe && escludi >= 0 && stradaVeloce(strade.lista[escludi]);
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iz = cz - 1; iz <= cz + 1; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) continue;
      for (const [s, i] of pezzi) {
        if (s === escludi) continue;
        const altra = strade.lista[s];
        if (altra.g) continue;
        if (perRighe && altra.riemp) continue;
        const p = altra.p;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
        const traVeloci = veloceIo && stradaVeloce(altra);
        if (traVeloci && (t < 0 || t > 1 || s > escludi)) continue;   // dove due strade veloci si sovrappongono le righe le disegna una sola (la prima)
        t = Math.min(Math.max(t, 0), 1);
        const d = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
        if (d < larghezzaIn(altra, i / 3) / 2 + (traVeloci ? -0.05 : margine)) return true;
      }
    }
  }
  return false;
}

// Tipi di strada con marciapiede in zona abitata
const TIPI_CON_MARCIAPIEDE = ["primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "primary_link", "secondary_link", "tertiary_link"];

// Marciapiede lungo i due lati: dove la zona e' abitata, non c'e' un ponte/galleria e non si incrocia un'altra strada.
// La larghezza si stringe dove c'e' un muro. Il bordo (cordolo) alto 12 cm.
function aggiungiMarciapiedi(indice, strada, ctx, g, quotaTerreno) {
  const p = strada.p;
  const punti = p.length / 3;
  // ricampiono la strada ogni 3 m
  const campioni = [];
  for (let i = 0; i < punti - 1; i++) {
    const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2];
    const bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
    const lung = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(lung / 3));
    const w0 = larghezzaIn(strada, i), w1 = larghezzaIn(strada, i + 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      campioni.push([ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, w0 + (w1 - w0) * t, i]);
    }
  }
  campioni.push([p[(punti - 1) * 3], p[(punti - 1) * 3 + 1], p[(punti - 1) * 3 + 2], larghezzaIn(strada, punti - 1), punti - 2]);
  if (campioni.length < 2) return;
  const colTop = new THREE.Color(0xffffff);
  const colCordolo = new THREE.Color(0xd8d5cd);
  for (const lato of [-1, 1]) {
    // per ogni campione: larghezza del marciapiede (0 = niente)
    const larghi = campioni.map(function (c, k) {
      const prec = campioni[Math.max(0, k - 1)];
      const succ = campioni[Math.min(campioni.length - 1, k + 1)];
      let dx = succ[0] - prec[0], dz = succ[2] - prec[2];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const nx = -dz * lato, nz = dx * lato;
      const urb = zonaQuiLocale(ctx.edifici, c[0], c[2]);
      if (urb < 0.07) return 0;
      const centro = c[3] / 2 + 0.9;
      const px = c[0] + nx * centro, pz = c[2] + nz * centro;
      if (copertoDaAltra(ctx.stradeDati, px, pz, indice, 1.2)) return 0;
      // muro vicino: marciapiede stretto
      let largo = 1.9;
      const ox = c[0] + nx * (c[3] / 2 + 2.3), oz = c[2] + nz * (c[3] / 2 + 2.3);
      if (ctx.dentro(ox, oz, c[1] + 1)) largo = 0.9;
      const ox2 = c[0] + nx * (c[3] / 2 + 1.0), oz2 = c[2] + nz * (c[3] / 2 + 1.0);
      if (ctx.dentro(ox2, oz2, c[1] + 1)) return 0;
      return largo;
    });
    for (let k = 0; k < campioni.length - 1; k++) {
      const wa = larghi[k], wb = larghi[k + 1];
      if (wa === 0 || wb === 0) continue;
      const a = campioni[k], b = campioni[k + 1];
      const prec = campioni[Math.max(0, k - 1)], succ = campioni[Math.min(campioni.length - 1, k + 2)];
      const dirA = direzioneLocale(prec, b), dirB = direzioneLocale(a, succ);
      const ia = [a[0] - dirA[1] * lato, a[2] + dirA[0] * lato];
      const ib = [b[0] - dirB[1] * lato, b[2] + dirB[0] * lato];
      const dA = a[3] / 2, dB = b[3] / 2;
      const yA = a[1], yB = b[1];
      const alt = 0.12;
      // quattro punti sul bordo interno (cordolo) e quattro sul bordo esterno
      const iaX = a[0] + (ia[0] - a[0]) * dA * 1, iaZ = a[2] + (ia[1] - a[2]) * dA;
      const ibX = b[0] + (ib[0] - b[0]) * dB, ibZ = b[2] + (ib[1] - b[2]) * dB;
      const oaX = a[0] + (ia[0] - a[0]) * (dA + wa), oaZ = a[2] + (ia[1] - a[2]) * (dA + wa);
      const obX = b[0] + (ib[0] - b[0]) * (dB + wb), obZ = b[2] + (ib[1] - b[2]) * (dB + wb);
      const base = g.posizioni.length / 3;
      const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
      void dist;
      // faccia verticale del cordolo (da asfalto a +12 cm) e superficie del marciapiede
      g.posizioni.push(
        iaX, yA, iaZ, ibX, yB, ibZ, ibX, yB + alt, ibZ, iaX, yA + alt, iaZ,
        iaX, yA + alt, iaZ, ibX, yB + alt, ibZ, obX, yB + alt, obZ, oaX, yA + alt, oaZ
      );
      const ua = k * 1.5, ub = ua + 1.5;
      g.uv.push(0, ua, 0, ub, 0.06, ub, 0.06, ua, 0, ua, 0, ub, wb / 2, ub, wa / 2, ua);
      for (let q = 0; q < 4; q++) g.colori.push(colCordolo.r, colCordolo.g, colCordolo.b);
      for (let q = 0; q < 4; q++) g.colori.push(colTop.r, colTop.g, colTop.b);
      g.indici.push(base, base + 1, base + 2, base, base + 2, base + 3, base + 4, base + 5, base + 6, base + 4, base + 6, base + 7);
    }
  }
  void quotaTerreno;
}

function direzioneLocale(a, b) {
  let dx = b[0] - a[0], dz = b[2] - a[2];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
}

let zonaQuiLocale = function () { return 1; };

// Rotonde: isola centrale erbosa con cordolo (la strada ad anello e' gia' nei dati OSM con junction=roundabout)
function aggiungiRotonde(strade, scena) {
  const erba = new THREE.MeshStandardMaterial({ color: 0x5f8f3d, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const cordolo = new THREE.MeshStandardMaterial({ color: 0xd8d5cd, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  let quante = 0;
  // Una rotonda in OpenStreetMap e' spesso spezzata in piu' pezzi (archi): si ricompongono gli anelli unendo i pezzi
  // che si toccano ai capi. L'isola si disegna SOLO per un anello chiuso e rotondo, al suo centro: un arco da solo
  // non ha un centro (prima ogni arco aveva il suo "cerchio verde", che finiva in mezzo alla strada).
  const pezzi = strade.lista.filter(function (s) { return s.j === "roundabout" && s.p.length >= 6; });
  const capo = function (s, fine) { const i = fine ? s.p.length - 3 : 0; return chiaveNodo(s.p[i], s.p[i + 2]); };
  const gruppo = pezzi.map(function (_, i) { return i; });
  const radice = function (i) { while (gruppo[i] !== i) { gruppo[i] = gruppo[gruppo[i]]; i = gruppo[i]; } return i; };
  const aiCapi = new Map();
  pezzi.forEach(function (s, i) {
    for (const k of [capo(s, false), capo(s, true)]) {
      if (aiCapi.has(k)) gruppo[radice(i)] = radice(aiCapi.get(k)); else aiCapi.set(k, i);
    }
  });
  const anelli = new Map();
  pezzi.forEach(function (s, i) { const r = radice(i); if (!anelli.has(r)) anelli.set(r, []); anelli.get(r).push(s); });
  for (const archi of anelli.values()) {
    // chiuso: ogni capo e' condiviso da due capi di pezzo (o il pezzo unico torna su se stesso)
    const conta = new Map();
    for (const s of archi) for (const k of [capo(s, false), capo(s, true)]) conta.set(k, (conta.get(k) || 0) + 1);
    let chiuso = true;
    for (const v of conta.values()) if (v !== 2) chiuso = false;
    if (!chiuso) continue;
    let cx = 0, cy = 0, cz = 0, n = 0, larga = 0;
    for (const s of archi) {
      larga = Math.max(larga, s.w);
      for (let i = 0; i < s.p.length; i += 3) { cx += s.p[i]; cy += s.p[i + 1]; cz += s.p[i + 2]; n++; }
    }
    cx /= n; cy /= n; cz /= n;
    let raggio = 0, minimo = Infinity, massimo = 0;
    for (const s of archi) for (let i = 0; i < s.p.length; i += 3) {
      const d = Math.hypot(s.p[i] - cx, s.p[i + 2] - cz);
      raggio += d; minimo = Math.min(minimo, d); massimo = Math.max(massimo, d);
    }
    raggio /= n;
    if (massimo - minimo > raggio * 0.35) continue;   // non e' rotondo: niente isola
    let interno = minimo - larga / 2 - 0.45;
    // nessuna strada deve passare dentro l'isola
    const dentro = stradaVicina(strade, cx, cz, interno + 12);
    if (dentro !== null && !dentro.galleria) interno = Math.min(interno, dentro.distanza - dentro.larghezza / 2 - 0.45);
    // le rotonde enormi (piazze) restano con il terreno vero al centro: un disco verde di 50 m sarebbe finto
    if (interno < 1.5 || interno > 22) continue;
    const isola = new THREE.Mesh(new THREE.CircleGeometry(interno, 28).rotateX(-Math.PI / 2), erba);
    isola.position.set(cx, cy + 0.16, cz);
    isola.receiveShadow = true;
    const anello = new THREE.Mesh(new THREE.RingGeometry(interno, interno + 0.45, 28).rotateX(-Math.PI / 2), cordolo);
    anello.position.set(cx, cy + 0.17, cz);
    anello.receiveShadow = true;
    scena.add(isola, anello);
    quante++;
  }
  return quante;
}

// Incroci: un disco di asfalto sul nodo dove si incontrano 3 o piu' strade (o dove una strada finisce su un'altra):
// gli angoli diventano arrotondati come negli incroci veri e non restano "buchi" tra i nastri.
function aggiungiIncroci(strade, materiale, scena) {
  const nodi = new Map();
  for (const s of strade.lista) {
    if (s.g || s.b || s.w < 3.5 || s.riemp) continue;
    const p = s.p;
    const n = p.length / 3;
    for (let i = 0; i < n; i++) {
      const k = Math.round(p[i * 3] * 2) + "," + Math.round(p[i * 3 + 2] * 2);
      let e = nodi.get(k);
      if (!e) { e = { x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2], bracci: [], n: 0, meta: false, fine: false }; nodi.set(k, e); }
      e.n++;
      // i "bracci" che arrivano al nodo: una strada che passa conta due volte, una che finisce una
      const w = larghezzaIn(s, i);
      e.bracci.push(w);
      if (i > 0 && i < n - 1) { e.meta = true; e.bracci.push(w); } else e.fine = true;
    }
  }
  const pos = [], uv = [];
  let quanti = 0;
  for (const e of nodi.values()) {
    if (!(e.n >= 3 || (e.n === 2 && e.meta && e.fine))) continue;
    // raggio = meta' della SECONDA larghezza piu' grande: il disco riempie l'incrocio ma non sporge mai dalla
    // strada (prima usava la piu' larga, e dove una strada larga diventava stretta restava un "cerchio" in mezzo)
    e.bracci.sort(function (a, b) { return b - a; });
    const r = e.bracci[1] / 2 * 0.98;
    const y = e.y + 0.022;
    for (let k = 0; k < 14; k++) {
      const a0 = k / 14 * Math.PI * 2, a1 = (k + 1) / 14 * Math.PI * 2;
      pos.push(e.x, y, e.z, e.x + Math.cos(a0) * r, y, e.z + Math.sin(a0) * r, e.x + Math.cos(a1) * r, y, e.z + Math.sin(a1) * r);
      uv.push(0.5, e.x / 8, 0.2, e.z / 8, 0.8, e.z / 8);
    }
    quanti++;
  }
  if (quanti === 0) return 0;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));   // il materiale usa i colori dei vertici
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, materiale);
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  scena.add(m);
  return quanti;
}

export function aggiungiStrade(strade, scena, terreno, contesto) {
  const ctx = contesto || {};
  const anisotropia = 8;
  const asfaltoMateriale = new THREE.MeshStandardMaterial({
    map: texturaAsfalto(anisotropia), roughness: 0.93, metalness: 0, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide
  });
  const galleriaMateriale = new THREE.MeshStandardMaterial({
    map: asfaltoMateriale.map, roughness: 0.85, color: 0xcfcfd2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide
  });
  const marciapiedeMateriale = new THREE.MeshStandardMaterial({
    map: texturaMarciapiede(anisotropia), roughness: 0.9, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide
  });
  const righeMateriale = new THREE.MeshStandardMaterial({
    color: 0xf2f2ee, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide
  });

  if (ctx.ambiente) {
    aggiungiMeteo(asfaltoMateriale, ctx.ambiente, { neve: 0.5, bagnato: 1, pozzanghere: true });   // la strada resta leggibile anche con la neve
    aggiungiMeteo(marciapiedeMateriale, ctx.ambiente, { neve: 0.9, bagnato: 0.9 });
    aggiungiMeteo(righeMateriale, ctx.ambiente, { neve: 0, bagnato: 0.2 });   // le righe restano sempre bianche e visibili
  }

  // Marciapiedi: serve sapere dove la citta' e' fitta e dove ci sono muri
  let marciapiedi = false;
  if (ctx.edifici && ctx.edifici.zone) {
    marciapiedi = true;
    zonaQuiLocale = function (ed, x, z) {
      const c = ed.zone.get(Math.floor(x / 80) + "," + Math.floor(z / 80));
      return c ? c.densita : 0;
    };
    ctx.dentro = function (x, z, y) { return dentroEdificioLocale(ctx.edifici, x, z, y); };
    ctx.stradeDati = strade;
  }

  const parapetti = { posizioni: [], indici: [] };
  const guardrail = { posizioni: [], indici: [] };
  const muri = { posizioni: [], indici: [] };
  const paletti = [];
  const gruppi = new Map();   // 1 km: asfalto, gallerie, righe, marciapiedi
  const pezzo = function (strada) {
    const k = Math.floor(strada.p[0] / 1000) + "," + Math.floor(strada.p[2] / 1000);
    let v = gruppi.get(k);
    if (!v) {
      v = { asfalto: nuovoNastro(), gallerie: nuovoNastro(), righe: { posizioni: [], indici: [] }, marciapiedi: nuovoNastro() };
      gruppi.set(k, v);
    }
    return v;
  };
  const bianco = new THREE.Color(1, 1, 1);

  for (let indice = 0; indice < strade.lista.length; indice++) {
    const strada = strade.lista[indice];
    const gruppo = pezzo(strada);
    const lar = function (i) { return larghezzaIn(strada, i); };
    if (strada.riemp) {
      // spartitraffico e zone tra una rampa e la carreggiata: asfalto un po' piu' scuro, i bordi seguono le due strade
      const scuro = new THREE.Color(0.84, 0.84, 0.85);
      nastroConUV(strada.p, lar, 0.002, gruppo.asfalto, scuro, 0, function (x, z, y) { return quotaSuAltra(strade, indice, x, z, y); });
      continue;
    }
    if (strada.g) {
      nastroConUV(strada.p, lar, 0, gruppo.gallerie, bianco);
    } else {
      // leggera variazione di colore da strada a strada (asfalti piu' nuovi o piu' vecchi)
      // (poca: dove due strade si toccano non si deve vedere lo stacco). Le strade piu' larghe stanno qualche
      // millimetro sopra: dove due nastri si sovrappongono sullo stesso piano non "sfarfallano".
      const v = stradaVeloce(strada) ? 1 : 0.96 + ((indice * 2654435761) % 1000) / 1000 * 0.08;   // l'autostrada ha un asfalto solo
      const alzata = (strada.w >= 7 ? 0.014 : (strada.w >= 5.5 ? 0.008 : 0.002)) + ((indice * 7) % 5) * 0.0012;
      const bordo = strada.b ? null : function (x, z, y) { return quotaSuAltra(strade, indice, x, z, y); };
      nastroConUV(strada.p, lar, alzata, gruppo.asfalto, new THREE.Color(v, v, v), 0, bordo);
    }
    if (strada.w >= 5.5 || stradaVeloce(strada)) {
      // righe tra le corsie (tratteggiate) + linee di bordo continue (interrotte dove passa un'altra strada)
      aggiungiLinee(indice, strada, strade, gruppo.righe);
    }
    if (strada.b) {
      aggiungiParapetti(strada, parapetti.posizioni, parapetti.indici);
    } else if (!strada.g && terreno && TIPI_CON_GUARDRAIL.includes(strada.t)) {
      aggiungiGuardrail(strada, terreno, guardrail, paletti);
    }
    if (!strada.g && !strada.b && terreno) aggiungiMuri(strada, terreno, muri);
    if (marciapiedi && !strada.g && !strada.b && strada.w >= 4 && TIPI_CON_MARCIAPIEDE.includes(strada.t)) {
      aggiungiMarciapiedi(indice, strada, ctx, gruppo.marciapiedi, terreno);
    }
  }
  scena.add(creaMesh(parapetti.posizioni, parapetti.indici, 0xb8b8b0, 0));
  scena.add(creaMesh(guardrail.posizioni, guardrail.indici, 0xc9ccd0, 0));
  if (muri.posizioni.length > 0) {
    const muro = creaMesh(muri.posizioni, muri.indici, 0x9a968d, 0);
    muro.castShadow = true;
    scena.add(muro);
  }

  // Paletti del guardrail: tutti insieme in una "InstancedMesh" (veloce)
  if (paletti.length > 0) {
    const forma = new THREE.BoxGeometry(0.12, 0.8, 0.12);
    forma.translate(0, 0.4, 0);
    const istanze = new THREE.InstancedMesh(forma, new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.5, metalness: 0.6 }), paletti.length / 3);
    const matrice = new THREE.Matrix4();
    for (let i = 0; i < paletti.length; i += 3) {
      matrice.makeTranslation(paletti[i], paletti[i + 1], paletti[i + 2]);
      istanze.setMatrixAt(i / 3, matrice);
    }
    scena.add(istanze);
  }

  aggiungiIncroci(strade, asfaltoMateriale, scena);
  aggiungiRotonde(strade, scena);
  aggiungiBarriere(strade.barriere, scena);

  for (const g of gruppi.values()) {
    for (const [dati, materiale, ricevi] of [[g.asfalto, asfaltoMateriale, true], [g.gallerie, galleriaMateriale, true], [g.marciapiedi, marciapiedeMateriale, true], [g.righe, righeMateriale, true]]) {
      const mesh = meshDa(dati, materiale, ricevi);
      if (mesh) scena.add(mesh);
    }
  }
}

// Righe tra le corsie (tratteggiate) e linee di bordo (continue, a 0.35 m dal bordo dell'asfalto).
//  - strade normali: una mezzeria (3 m si', 3 m no);
//  - strade larghe 3 corsie o piu': una riga tra ogni corsia;
//  - strade veloci: tratti da 6 m ogni 18 m come in autostrada, linee di bordo anche sulle rampe a una corsia, e
//    dove due corsie corrono affiancate (rampa che entra, carreggiata che si divide) UNA riga sola sulla cucitura.
// Si campiona la strada ogni 1.5 m e si disegna solo dove il punto non e' coperto da un'altra strada:
// agli incroci le righe si fermano al bordo dell'altra strada, come nella realta'.
function aggiungiLinee(indice, strada, strade, g) {
  const p = strada.p;
  const punti = p.length / 3;
  const veloceQui = stradaVeloce(strada);
  const campioni = [];
  let dist = 0;
  for (let i = 0; i < punti - 1; i++) {
    const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2];
    const bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
    const lung = Math.hypot(bx - ax, bz - az);
    if (lung < 0.01) continue;
    const dx = (bx - ax) / lung, dz = (bz - az) / lung;
    const n = Math.max(1, Math.round(lung / 1.5));
    const w0 = larghezzaIn(strada, i), w1 = larghezzaIn(strada, i + 1);
    // cucitura: vale per il pezzo se tutti e due i suoi capi sono affiancati all'altra corsia
    const cuc = strada.cuc && strada.cuc[i] !== 0 && strada.cuc[i + 1] !== 0 ? strada.cuc[i] : 0;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      campioni.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, z: az + (bz - az) * t, dx: dx, dz: dz, w: w0 + (w1 - w0) * t, d: dist + lung * t, nuovo: k === 0, cuc: cuc });
    }
    dist += lung;
  }
  // strisce: [lato, frazione della larghezza]; lato 0 = riga tra due corsie
  const corsie = strada.w >= 9 ? Math.round(strada.w / 3.3) : (strada.w >= 5.5 ? 2 : 1);
  const strisce = [];
  for (let k = 1; k < corsie; k++) strisce.push([0, k / corsie - 0.5]);
  if (!strada.g) strisce.push([1, 0], [-1, 0]);
  for (const [lato, frazione] of strisce) {
    let precedente = null;
    for (const c of campioni) {
      let d = lato === 0 ? frazione * c.w : c.w / 2 - 0.35;
      if (lato !== 0 && d < 0.5) { precedente = null; continue; }
      let tratteggio = lato === 0, cucitura = false;
      if (lato !== 0 && c.cuc !== 0 && Math.sign(c.cuc) === lato) {
        if (Math.abs(c.cuc) === 3) { precedente = null; continue; }   // la disegna l'altra corsia
        d = c.w / 2;
        cucitura = true;
        tratteggio = Math.abs(c.cuc) === 1;
      }
      const x = c.x - c.dz * (lato === 0 ? 1 : lato) * d, z = c.z + c.dx * (lato === 0 ? 1 : lato) * d;
      const coperto = !cucitura && copertoDaAltra(strade, x, z, indice, 0.35, true);
      // il tratteggio: 3 m si' e 3 m no; sulle strade veloci 6 m si' e 12 m no (campioni ogni 1.5 m)
      const acceso = !tratteggio || (veloceQui ? (Math.round(c.d / 1.5) % 12) < 5 : (Math.round(c.d / 1.5) % 4) < 3);
      if (coperto || !acceso || c.nuovo) {
        precedente = coperto || !acceso ? null : { x: x, y: c.y, z: z, dx: c.dx, dz: c.dz };
        continue;
      }
      if (precedente !== null) {
        const mezza = lato === 0 ? 0.11 : (veloceQui ? 0.12 : 0.1);
        const y0 = precedente.y + 0.03, y1 = c.y + 0.03;
        const base = g.posizioni.length / 3;
        g.posizioni.push(
          precedente.x - precedente.dz * mezza, y0, precedente.z + precedente.dx * mezza,
          precedente.x + precedente.dz * mezza, y0, precedente.z - precedente.dx * mezza,
          x - c.dz * mezza, y1, z + c.dx * mezza,
          x + c.dz * mezza, y1, z - c.dx * mezza
        );
        g.indici.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
      precedente = { x: x, y: c.y, z: z, dx: c.dx, dz: c.dz };
    }
  }
}

// dentroEdificio senza importare edifici.js (evita un import circolare): stessa griglia a celle da 40 m
function dentroEdificioLocale(edifici, x, z, y) {
  const lista = edifici.griglia.get(Math.floor(x / 40) + "," + Math.floor(z / 40));
  if (!lista) return false;
  for (const i of lista) {
    const e = edifici.lista[i];
    if (y < e.h && y > e.b - 2 && dentroPoligonoLocale(e.p, x, z)) return true;
  }
  return false;
}
function dentroPoligonoLocale(p, x, z) {
  let dentro = false;
  const punti = p.length / 2;
  for (let i = 0, j = punti - 1; i < punti; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1], xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
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
        const larghezza = Math.max(larghezzaIn(strada, i / 3), larghezzaIn(strada, i / 3 + 1));
        if (distanza > larghezza / 2 + 0.5) {
          continue;
        }
        const y = p[i + 1] + (p[i + 4] - p[i + 1]) * t;
        const differenza = Math.abs(y - quotaAttuale);
        // due strade sullo stesso piano (incrocio): vale la piu' importante, la stessa che si vede disegnata sopra
        const g = strade.grado ? strade.grado[s] : 0;
        const stessoPianoQui = migliore !== null && differenza < 1.5 && migliore.differenza < 1.5;
        if (migliore === null || (stessoPianoQui ? g < migliore.grado : differenza < migliore.differenza)) {
          migliore = {
            grado: g,
            y: y,
            nome: strada.n,
            galleria: strada.g,
            ponte: strada.b,
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
    if (strada.galleria || strada.riemp) continue;   // non si riparte dentro una galleria ne' sullo spartitraffico
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

// Strada piu' vicina entro "raggio" metri: punto sulla strada, direzione e larghezza
// (serve per mettere cartelli e strisce nel posto giusto)
export function stradaVicina(strade, x, z, raggio) {
  const celle = Math.ceil(raggio / CELLA);
  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  let migliore = null;
  for (let ix = cx - celle; ix <= cx + celle; ix++) {
    for (let iz = cz - celle; iz <= cz + celle; iz++) {
      const pezzi = strade.griglia.get(ix + "," + iz);
      if (!pezzi) continue;
      for (const [s, i] of pezzi) {
        const strada = strade.lista[s];
        const p = strada.p;
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5];
        const lungo = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = lungo > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo : 0;
        t = Math.min(Math.max(t, 0), 1);
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        const distanza = Math.hypot(x - px, z - pz);
        if (distanza > raggio || (migliore !== null && distanza >= migliore.distanza)) continue;
        const lunghezza = Math.sqrt(lungo) || 1;
        migliore = {
          x: px, z: pz,
          y: p[i + 1] + (p[i + 4] - p[i + 1]) * t,
          dirX: (bx - ax) / lunghezza,
          dirZ: (bz - az) / lunghezza,
          larghezza: Math.max(larghezzaIn(strada, i / 3), larghezzaIn(strada, i / 3 + 1)),
          distanza: distanza,
          galleria: strada.g,
          ponte: strada.b,
          indice: s, segmento: i, t: t
        };
      }
    }
  }
  return migliore;
}
