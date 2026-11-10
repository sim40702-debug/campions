// Mappa: un solo motore di disegno per la minimappa (in basso a destra) e per la mappa grande (tasto P / N).
//
// Tutto viene disegnato dai DATI VERI del mondo (le stesse strade, edifici, boschi e acque che si vedono in 3D),
// non da un'immagine: per questo resta nitido a ogni ingrandimento.
//
//  - rilievo ombreggiato dal terreno swisstopo;
//  - lago e boschi: contorni calcolati dal terreno (marching squares) e levigati;
//  - fiumi e stagni da OpenStreetMap;
//  - quartieri (centro storico, commerciale, industriale...) dall'analisi degli edifici;
//  - edifici (solo a ingrandimenti alti), strade con bordo e gerarchia (autostrada ... vicolo),
//    ponti, gallerie, ferrovie, teleferiche;
//  - nomi di citta' e paesi, nomi delle strade, punti di interesse (chiese, stazioni, gallerie, ponti);
//  - di notte la mappa passa ai colori scuri.

const CHIAVE_FILTRI = "mrw-filtri-mappa";
const CHIAVE_MINI = "mrw-minimappa";

// ordine di disegno delle strade (dalla piu' piccola alla piu' grande)
const CLASSI = [
  { nomi: ["service", "track", "path", "pedestrian"], larg: 3.5, min: 0.6, colore: "strada", bordo: 0.9 },
  { nomi: ["residential", "living_street", "unclassified"], larg: 5, min: 0.9, colore: "strada", bordo: 1.0 },
  { nomi: ["tertiary", "tertiary_link"], larg: 6.5, min: 1.2, colore: "terziaria", bordo: 1.1 },
  { nomi: ["secondary", "secondary_link"], larg: 8, min: 1.6, colore: "secondaria", bordo: 1.2 },
  { nomi: ["primary", "primary_link"], larg: 9, min: 2.0, colore: "primaria", bordo: 1.3 },
  { nomi: ["trunk", "trunk_link"], larg: 10, min: 2.4, colore: "principale", bordo: 1.4 },
  { nomi: ["motorway", "motorway_link"], larg: 12, min: 2.8, colore: "autostrada", bordo: 1.5 }
];

const TAVOLOZZE = {
  giorno: {
    terra: "#eeeae0", verde: "#c9e2b0", prato: "#dcebc4", cimitero: "#c8d8c0", sport: "#bfe0a8", bosco: "#b8d3a0", acqua: "#a8d0ec", acquaBordo: "#87b8dc",
    edificio: "#d9d2c4", edificioBordo: "#c3baa8", chiesa: "#cdb48f", ferrovia: "#6e737a", funivia: "#d9566c",
    strada: "#ffffff", terziaria: "#fffdf4", secondaria: "#fff2c4", primaria: "#fbe08c", principale: "#f9c97c", autostrada: "#f6a85a",
    bordoStrada: "#bdb5a8", bordoPrimaria: "#c9a64a", bordoAutostrada: "#c9843a", ponte: "#8a8478",
    testo: "#2d3136", alone: "rgba(255,255,255,0.9)", luogo: "#1f2933", acquaTesto: "#3c78a8", rilievo: 0.3,
    storico: "rgba(236,190,120,0.30)", commerciale: "rgba(240,150,130,0.26)", industriale: "rgba(170,160,205,0.32)", residenziale: "rgba(235,225,160,0.2)"
  },
  notte: {
    terra: "#1c2229", verde: "#25392a", prato: "#212f26", cimitero: "#26332c", sport: "#2a4030", bosco: "#1c2d21", acqua: "#12304a", acquaBordo: "#0d2437",
    edificio: "#2e353e", edificioBordo: "#3b434d", chiesa: "#4d4638", ferrovia: "#8b929a", funivia: "#d9566c",
    strada: "#4b535d", terziaria: "#555e69", secondaria: "#6b6448", primaria: "#8a7740", principale: "#9a7f3c", autostrada: "#a8702f",
    bordoStrada: "#12161b", bordoPrimaria: "#14110a", bordoAutostrada: "#140d06", ponte: "#2b3036",
    testo: "#e4e8ee", alone: "rgba(10,14,18,0.9)", luogo: "#f3f5f8", acquaTesto: "#7db4dc", rilievo: 0.28,
    storico: "rgba(230,170,90,0.14)", commerciale: "rgba(240,120,100,0.13)", industriale: "rgba(140,130,200,0.16)", residenziale: "rgba(220,210,130,0.08)"
  }
};

export const FILTRI_MAPPA = [
  { chiave: "rilievo", nome: "Rilievo" },
  { chiave: "quartieri", nome: "Quartieri" },
  { chiave: "edifici", nome: "Edifici" },
  { chiave: "boschi", nome: "Boschi e verde" },
  { chiave: "acque", nome: "Laghi e fiumi" },
  { chiave: "strade", nome: "Strade" },
  { chiave: "nomiStrade", nome: "Nomi delle strade" },
  { chiave: "ferrovie", nome: "Ferrovie e teleferiche" },
  { chiave: "luoghi", nome: "Citta' e paesi" },
  { chiave: "poi", nome: "Punti di interesse" }
];

function leggi(chiave) {
  try {
    const v = localStorage.getItem(chiave);
    if (v) return JSON.parse(v);
  } catch (errore) {
    // memoria non disponibile
  }
  return null;
}
function scrivi(chiave, valore) {
  try {
    localStorage.setItem(chiave, JSON.stringify(valore));
  } catch (errore) {
    // non importa
  }
}

// --- Contorni dal terreno (marching squares) ------------------------------------------------------
// campo(c, r) -> vero/falso sul reticolo di W x H punti. Ritorna anelli chiusi in coordinate del reticolo.
function contorni(W, H, campo) {
  const L = W + 2;   // con un giro di "falso" attorno: gli anelli si chiudono sempre
  const celle = new Uint8Array(L * (H + 2));
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (campo(c, r)) celle[(r + 1) * L + (c + 1)] = 1;
    }
  }
  const vicini = new Map();
  const unisci = function (a, b) {
    let la = vicini.get(a);
    if (!la) { la = []; vicini.set(a, la); }
    la.push(b);
    let lb = vicini.get(b);
    if (!lb) { lb = []; vicini.set(b, lb); }
    lb.push(a);
  };
  // id dei lati: orizzontale (tra due punti nella stessa riga) = 2 * (r * L + c), verticale = 2 * (r * L + c) + 1
  for (let r = 0; r < H + 1; r++) {
    for (let c = 0; c < W + 1; c++) {
      const tl = celle[r * L + c], tr = celle[r * L + c + 1], bl = celle[(r + 1) * L + c], br = celle[(r + 1) * L + c + 1];
      const caso = tl * 8 + tr * 4 + br * 2 + bl;
      if (caso === 0 || caso === 15) continue;
      const T = 2 * (r * L + c);          // lato alto (tra tl e tr)
      const B = 2 * ((r + 1) * L + c);    // lato basso
      const Lt = 2 * (r * L + c) + 1;     // lato sinistro (tra tl e bl)
      const R = 2 * (r * L + c + 1) + 1;  // lato destro
      switch (caso) {
        case 1: case 14: unisci(Lt, B); break;
        case 2: case 13: unisci(B, R); break;
        case 3: case 12: unisci(Lt, R); break;
        case 4: case 11: unisci(T, R); break;
        case 6: case 9: unisci(T, B); break;
        case 7: case 8: unisci(Lt, T); break;
        case 5: unisci(Lt, T); unisci(B, R); break;
        case 10: unisci(T, R); unisci(Lt, B); break;
        default: break;
      }
    }
  }
  const visti = new Set();
  const anelli = [];
  const punto = function (id) {
    const lato = id & 1;
    const cella = id >> 1;
    const r = Math.floor(cella / L) - 1;
    const c = (cella % L) - 1;
    // coordinate nel reticolo (il punto sta a meta' del lato)
    return lato === 0 ? [c + 0.5, r] : [c, r + 0.5];
  };
  for (const inizio of vicini.keys()) {
    if (visti.has(inizio)) continue;
    const anello = [];
    let corrente = inizio;
    let prima = -1;
    while (!visti.has(corrente)) {
      visti.add(corrente);
      anello.push(punto(corrente));
      const n = vicini.get(corrente);
      let prossimo = n[0] === prima ? n[1] : n[0];
      if (n.length > 1 && n[0] === n[1]) prossimo = n[0];
      if (prossimo === undefined) break;
      prima = corrente;
      corrente = prossimo;
    }
    if (anello.length >= 4) anelli.push(anello);
  }
  return anelli;
}

// Una passata di Chaikin: toglie gli "scalini" del reticolo
function levigaAnello(a) {
  const n = a.length;
  const ris = [];
  for (let i = 0; i < n; i++) {
    const p = a[i], q = a[(i + 1) % n];
    ris.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
  }
  return ris;
}

// Indice spaziale a celle da 1 km: per disegnare solo cio' che si vede
function creaIndice() {
  return { celle: new Map(), lato: 1000, ultimo: 1 };
}
function indicizza(ind, elemento, minX, minZ, maxX, maxZ) {
  for (let cx = Math.floor(minX / ind.lato); cx <= Math.floor(maxX / ind.lato); cx++) {
    for (let cz = Math.floor(minZ / ind.lato); cz <= Math.floor(maxZ / ind.lato); cz++) {
      const k = cx + "," + cz;
      let l = ind.celle.get(k);
      if (!l) { l = []; ind.celle.set(k, l); }
      l.push(elemento);
    }
  }
}
function visibili(ind, minX, minZ, maxX, maxZ) {
  ind.ultimo++;
  const ris = [];
  for (let cx = Math.floor(minX / ind.lato); cx <= Math.floor(maxX / ind.lato); cx++) {
    for (let cz = Math.floor(minZ / ind.lato); cz <= Math.floor(maxZ / ind.lato); cz++) {
      const l = ind.celle.get(cx + "," + cz);
      if (!l) continue;
      for (const e of l) {
        if (e.s === ind.ultimo) continue;
        e.s = ind.ultimo;
        if (e.x1 < minX || e.x0 > maxX || e.z1 < minZ || e.z0 > maxZ) continue;
        ris.push(e);
      }
    }
  }
  return ris;
}

function classeStrada(tipo) {
  for (let i = 0; i < CLASSI.length; i++) if (CLASSI[i].nomi.includes(tipo)) return i;
  return 1;
}

// Rilievo ombreggiato (immagine piccola: un punto ogni 4 punti del terreno)
function creaRilievo(terreno) {
  const passoRid = 4;
  const w = Math.floor((terreno.colonne - 1) / passoRid);
  const h = Math.floor((terreno.righe - 1) / passoRid);
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const c = tela.getContext("2d");
  const imm = c.createImageData(w, h);
  const q = terreno.quote;
  const n = terreno.colonne;
  const metri = terreno.passo * passoRid;
  const lago = terreno.info.livello_lago;
  for (let r = 0; r < h; r++) {
    for (let col = 0; col < w; col++) {
      const i = (r * passoRid) * n + col * passoRid;
      const sx = q[i + passoRid > q.length - 1 ? i : i + passoRid] - q[i - (col > 0 ? passoRid : 0)];
      const riga2 = Math.min(r + 1, h - 1) * passoRid, riga1 = Math.max(r - 1, 0) * passoRid;
      const sz = q[riga2 * n + col * passoRid] - q[riga1 * n + col * passoRid];
      // luce da nord-ovest
      const ombra = (-sx - sz) / (2 * metri * 1.5);
      let v = 0.5 + Math.max(-0.5, Math.min(0.5, ombra * 1.8));
      // un po' piu' scuro in alto (quota)
      v -= Math.min(0.12, Math.max(0, (q[i] - 400) / 6000));
      const k = (r * w + col) * 4;
      const grigio = Math.round(255 * v);
      imm.data[k] = grigio;
      imm.data[k + 1] = grigio;
      imm.data[k + 2] = grigio;
      imm.data[k + 3] = q[i] < lago + 0.2 ? 0 : 255;
    }
  }
  c.putImageData(imm, 0, 0);
  return { tela: tela, passo: metri };
}

export function preparaMinimappa(o) {
  const strade = o.strade, terreno = o.terreno, edifici = o.edifici, luoghi = o.luoghi, acqua = o.acqua, trasporti = o.trasporti;
  const metaX = terreno.metaX, metaZ = terreno.metaZ;

  const mappa = {
    metaX: metaX, metaZ: metaZ, terreno: terreno, ambiente: o.ambiente, luoghi: luoghi,
    filtri: Object.assign({
      rilievo: true, quartieri: true, edifici: true, boschi: true, acque: true, strade: true, nomiStrade: true,
      ferrovie: true, luoghi: true, poi: true
    }, leggi(CHIAVE_FILTRI) || {}),
    mini: Object.assign({ zoom: 2, ruota: true }, leggi(CHIAVE_MINI) || {}),
    palette: "giorno",
    versione: 0
  };

  // --- Dati preparati una sola volta ---
  const indStrade = creaIndice();
  const classi = CLASSI.map(function () { return []; });
  const gallerie = [];
  const ponti = [];
  const nomiVie = new Map();
  for (const s of strade.lista) {
    const p = s.p;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
      z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
    }
    const e = { s: 0, x0: x0, x1: x1, z0: z0, z1: z1, strada: s, classe: classeStrada(s.t) };
    indicizza(indStrade, e, x0, z0, x1, z1);
    if (s.n) {
      const v = nomiVie.get(s.n);
      if (!v || p.length > v.strada.p.length) nomiVie.set(s.n, e);
    }
    if (s.b) ponti.push(e);
    if (s.g) gallerie.push(e);
  }

  const indEdifici = creaIndice();
  const chiese = [];
  for (const e of edifici.lista) {
    const p = e.p;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
      z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]);
    }
    const el = { s: 0, x0: x0, x1: x1, z0: z0, z1: z1, e: e };
    indicizza(indEdifici, el, x0, z0, x1, z1);
    if (e.k === 1) chiese.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2 });
  }

  // contorni del lago e dei boschi dal terreno
  const passoC = 2;
  const W = Math.floor((terreno.colonne - 1) / passoC);
  const H = Math.floor((terreno.righe - 1) / passoC);
  const aMondo = function (a) {
    const ris = new Float32Array(a.length * 2);
    for (let i = 0; i < a.length; i++) {
      ris[i * 2] = a[i][0] * passoC * terreno.passo - metaX;
      ris[i * 2 + 1] = a[i][1] * passoC * terreno.passo - metaZ;
    }
    return ris;
  };
  const sogliaLago = terreno.info.livello_lago + 0.25;
  const anelliLago = contorni(W, H, function (c, r) { return terreno.quote[r * passoC * terreno.colonne + c * passoC] < sogliaLago; })
    .map(function (a) { return aMondo(levigaAnello(a)); });
  const boschi = [];
  if (terreno.bosco) {
    const indBosco = creaIndice();
    for (const a of contorni(W, H, function (c, r) { return terreno.bosco[r * passoC * terreno.colonne + c * passoC] === 1 && terreno.quote[r * passoC * terreno.colonne + c * passoC] > sogliaLago; })) {
      if (a.length < 6) continue;
      const m = aMondo(levigaAnello(a));
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < m.length; i += 2) {
        x0 = Math.min(x0, m[i]); x1 = Math.max(x1, m[i]);
        z0 = Math.min(z0, m[i + 1]); z1 = Math.max(z1, m[i + 1]);
      }
      const el = { s: 0, x0: x0, x1: x1, z0: z0, z1: z1, p: m };
      indicizza(indBosco, el, x0, z0, x1, z1);
      boschi.push(el);
    }
    mappa.indBosco = indBosco;
  }
  let lagoCentro = null;
  {
    let migliore = null, areaMax = 0;
    for (const a of anelliLago) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < a.length; i += 2) {
        x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]);
        z0 = Math.min(z0, a[i + 1]); z1 = Math.max(z1, a[i + 1]);
      }
      const area = (x1 - x0) * (z1 - z0);
      if (area > areaMax) { areaMax = area; migliore = [(x0 + x1) / 2, (z0 + z1) / 2]; }
    }
    if (areaMax > 4e6) lagoCentro = migliore;
  }

  // Parchi, giardini, prati, cimiteri e campi sportivi (se il file dell'uso del suolo c'e')
  const indVerde = creaIndice();
  const COLORI_VERDE = { parco: "verde", prato: "prato", sport: "sport", cimitero: "cimitero" };
  for (const a of (o.usoSuolo ? o.usoSuolo.aree : [])) {
    if (!COLORI_VERDE[a.t]) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < a.o.length; i += 2) {
      x0 = Math.min(x0, a.o[i]); x1 = Math.max(x1, a.o[i]);
      z0 = Math.min(z0, a.o[i + 1]); z1 = Math.max(z1, a.o[i + 1]);
    }
    indicizza(indVerde, { s: 0, x0: x0, x1: x1, z0: z0, z1: z1, a: a }, x0, z0, x1, z1);
  }

  const rilievo = creaRilievo(terreno);

  // Punti di interesse
  const poi = [];
  for (const c of chiese) poi.push({ tipo: "chiesa", nome: "Chiesa", x: c.x, z: c.z });
  for (const f of (trasporti ? trasporti.funivie : [])) {
    const p = f.p;
    if (p.length >= 8) {
      poi.push({ tipo: "stazione", nome: (f.n || "Stazione") + " (partenza)", x: p[0], z: p[2] });
      poi.push({ tipo: "stazione", nome: (f.n || "Stazione") + " (arrivo)", x: p[p.length - 4], z: p[p.length - 2] });
    }
  }
  for (const g of gallerie) {
    const p = g.strada.p;
    if (Math.hypot(p[0] - p[p.length - 3], p[2] - p[p.length - 1]) > 120) {
      poi.push({ tipo: "galleria", nome: g.strada.n ? "Galleria " + g.strada.n : "Galleria", x: (p[0] + p[p.length - 3]) / 2, z: (p[2] + p[p.length - 1]) / 2 });
    }
  }
  for (const b of ponti) {
    const p = b.strada.p;
    if (Math.hypot(p[0] - p[p.length - 3], p[2] - p[p.length - 1]) > 40) {
      poi.push({ tipo: "ponte", nome: b.strada.n ? "Ponte " + b.strada.n : "Ponte", x: (p[0] + p[p.length - 3]) / 2, z: (p[2] + p[p.length - 1]) / 2 });
    }
  }
  mappa.poi = poi;

  // Indice per la ricerca: luoghi, strade con nome, punti di interesse con nome
  const ricerca = [];
  for (const l of o.localita || []) ricerca.push({ nome: l.n, tipo: l.t, x: l.x, z: l.z, genere: "luogo" });
  for (const [nome, e] of nomiVie) {
    const p = e.strada.p;
    const m = Math.floor(p.length / 6) * 3;
    ricerca.push({ nome: nome, tipo: "strada", x: p[m], z: p[m + 2], genere: "strada" });
  }
  for (const f of (trasporti ? trasporti.funivie : [])) {
    if (f.n && f.p.length >= 4) ricerca.push({ nome: f.n, tipo: "stazione", x: f.p[0], z: f.p[2], genere: "poi" });
  }
  for (const a of (o.usoSuolo ? o.usoSuolo.aree : [])) {
    if (!a.n || a.t === "prato") continue;
    let sx0 = 0, sz0 = 0;
    for (let i = 0; i < a.o.length; i += 2) { sx0 += a.o[i]; sz0 += a.o[i + 1]; }
    const n = a.o.length / 2;
    ricerca.push({ nome: a.n, tipo: a.t === "parco" ? "parco" : "luogo", x: sx0 / n, z: sz0 / n, genere: "poi" });
  }
  mappa.ricerca = ricerca;

  // --- Disegno di una vista ---
  // ctx e' gia' in pixel dello schermo; (cx, cz) e' il centro in metri; scala = pixel per metro.
  mappa.disegnaVista = function (ctx, cx, cz, scala, w, h, opzioni) {
    const opt = opzioni || {};
    const F = Object.assign({}, mappa.filtri, opt.filtri || {});
    const tav = TAVOLOZZE[mappa.palette];
    const mx = w / 2 / scala, mz = h / 2 / scala;
    const x0 = cx - mx, x1 = cx + mx, z0 = cz - mz, z1 = cz + mz;
    const sx = function (x) { return (x - cx) * scala + w / 2; };
    const sz = function (z) { return (z - cz) * scala + h / 2; };

    ctx.fillStyle = tav.terra;
    ctx.fillRect(0, 0, w, h);

    // rilievo (immagine sotto tutto, in "multiply")
    if (F.rilievo && rilievo) {
      ctx.save();
      ctx.globalAlpha = tav.rilievo;
      ctx.globalCompositeOperation = mappa.palette === "notte" ? "overlay" : "multiply";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const k = rilievo.passo * scala;
      ctx.drawImage(rilievo.tela, sx(-metaX), sz(-metaZ), rilievo.tela.width * k, rilievo.tela.height * k);
      ctx.restore();
    }

    // quartieri: colore delle celle da 80 m
    if (F.quartieri && edifici.zone && scala < 0.9) {
      const lato = 80 * scala;
      ctx.save();
      ctx.filter = "blur(" + Math.max(2, Math.min(14, lato * 0.55)) + "px)";
      const colori = [null, tav.residenziale, tav.storico, tav.commerciale, tav.industriale];
      for (let i = 1; i < 5; i++) {
        ctx.fillStyle = colori[i];
        ctx.beginPath();
        for (const [chiave, z] of edifici.zone) {
          if (z.zona !== i) continue;
          const sep = chiave.indexOf(",");
          const gx = +chiave.slice(0, sep) * 80, gz = +chiave.slice(sep + 1) * 80;
          if (gx > x1 || gx + 80 < x0 || gz > z1 || gz + 80 < z0) continue;
          ctx.rect(sx(gx) - 0.5, sz(gz) - 0.5, lato + 1, lato + 1);
        }
        ctx.fill();
      }
      ctx.restore();
    }

    // parchi, giardini, prati, cimiteri, campi sportivi
    if (F.boschi) {
      for (const [tipo, colore] of [["prato", tav.prato], ["parco", tav.verde], ["cimitero", tav.cimitero], ["sport", tav.sport]]) {
        ctx.fillStyle = colore;
        ctx.beginPath();
        let n = 0;
        for (const el of visibili(indVerde, x0, z0, x1, z1)) {
          if (el.a.t !== tipo) continue;
          for (const anello of [el.a.o].concat(el.a.f)) {
            for (let i = 0; i + 1 < anello.length; i += 2) {
              if (i === 0) ctx.moveTo(sx(anello[i]), sz(anello[i + 1])); else ctx.lineTo(sx(anello[i]), sz(anello[i + 1]));
            }
            ctx.closePath();
          }
          n++;
        }
        if (n > 0) ctx.fill("evenodd");
      }
    }

    // boschi
    if (F.boschi && mappa.indBosco) {
      ctx.fillStyle = tav.bosco;
      ctx.beginPath();
      for (const b of visibili(mappa.indBosco, x0, z0, x1, z1)) {
        const p = b.p;
        ctx.moveTo(sx(p[0]), sz(p[1]));
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(sx(p[i]), sz(p[i + 1]));
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }

    // acque: lago, fiumi larghi e stagni, torrenti
    if (F.acque) {
      ctx.fillStyle = tav.acqua;
      ctx.strokeStyle = tav.acquaBordo;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const a of anelliLago) {
        ctx.moveTo(sx(a[0]), sz(a[1]));
        for (let i = 2; i < a.length; i += 2) ctx.lineTo(sx(a[i]), sz(a[i + 1]));
        ctx.closePath();
      }
      ctx.fill("evenodd");
      ctx.stroke();
      for (const poligono of (acqua ? acqua.poligoni : [])) {
        ctx.beginPath();
        for (const anello of [poligono.o].concat(poligono.f)) {
          for (let i = 0; i + 1 < anello.length; i += 2) {
            if (i === 0) ctx.moveTo(sx(anello[i]), sz(anello[i + 1])); else ctx.lineTo(sx(anello[i]), sz(anello[i + 1]));
          }
          ctx.closePath();
        }
        ctx.fill("evenodd");
        ctx.stroke();
      }
      ctx.strokeStyle = tav.acqua;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const fiume of (acqua ? acqua.fiumi : [])) {
        const p = fiume.p;
        ctx.lineWidth = Math.max(1.3, fiume.w * scala);
        ctx.beginPath();
        for (let i = 0; i + 1 < p.length; i += 2) {
          if (i === 0) ctx.moveTo(sx(p[i]), sz(p[i + 1])); else ctx.lineTo(sx(p[i]), sz(p[i + 1]));
        }
        ctx.stroke();
      }
    }

    // edifici (solo se abbastanza ingranditi)
    if (F.edifici && scala > 0.16) {
      const lista = visibili(indEdifici, x0, z0, x1, z1);
      ctx.fillStyle = tav.edificio;
      ctx.strokeStyle = tav.edificioBordo;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const el of lista) {
        if (el.e.k === 1) continue;
        const p = el.e.p;
        if ((el.x1 - el.x0) * scala < 1.2 && (el.z1 - el.z0) * scala < 1.2) {
          ctx.rect(sx(el.x0), sz(el.z0), Math.max(1, (el.x1 - el.x0) * scala), Math.max(1, (el.z1 - el.z0) * scala));
          continue;
        }
        ctx.moveTo(sx(p[0]), sz(p[1]));
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(sx(p[i]), sz(p[i + 1]));
        ctx.closePath();
      }
      ctx.fill();
      if (scala > 0.45) ctx.stroke();
      // chiese in colore diverso
      ctx.fillStyle = tav.chiesa;
      ctx.beginPath();
      for (const el of lista) {
        if (el.e.k !== 1) continue;
        const p = el.e.p;
        ctx.moveTo(sx(p[0]), sz(p[1]));
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(sx(p[i]), sz(p[i + 1]));
        ctx.closePath();
      }
      ctx.fill();
    }

    // strade
    const vis = F.strade ? visibili(indStrade, x0, z0, x1, z1) : [];
    if (F.strade) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const perClasse = CLASSI.map(function () { return []; });
      const tunnel = [];
      const bridges = [];
      for (const e of vis) {
        (e.strada.g ? tunnel : perClasse[e.classe]).push(e);
        if (e.strada.b) bridges.push(e);
      }
      const traccia = function (lista, spessore, colore, tratteggio) {
        if (lista.length === 0) return;
        ctx.lineWidth = spessore;
        ctx.strokeStyle = colore;
        ctx.setLineDash(tratteggio || []);
        ctx.beginPath();
        for (const e of lista) {
          const p = e.strada.p;
          let px = -1e9, pz = -1e9;
          for (let i = 0; i < p.length; i += 3) {
            const X = sx(p[i]), Z = sz(p[i + 2]);
            if (i === 0) { ctx.moveTo(X, Z); px = X; pz = Z; continue; }
            if (i < p.length - 3 && Math.abs(X - px) + Math.abs(Z - pz) < 0.8) continue;
            ctx.lineTo(X, Z);
            px = X; pz = Z;
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const larghezza = function (cl, aggiunta) {
        const c = CLASSI[cl];
        // larghezza vera in metri (con un minimo di pixel per leggere anche le strade lontane)
        return Math.max(c.min, c.larg * scala * 1.15) + (aggiunta || 0);
      };
      traccia(tunnel, Math.max(1, 5 * scala), tav.bordoStrada, [4, 3]);
      for (let cl = 0; cl < CLASSI.length; cl++) {
        const lista = perClasse[cl];
        if (lista.length === 0) continue;
        if (cl === 0 && scala < 0.25) continue;
        const bordo = cl >= 6 ? tav.bordoAutostrada : (cl >= 4 ? tav.bordoPrimaria : tav.bordoStrada);
        traccia(lista, larghezza(cl, 1.6 * CLASSI[cl].bordo), bordo);
        traccia(lista, larghezza(cl), tav[CLASSI[cl].colore]);
      }
      // ponti: bordo scuro lungo i lati
      if (bridges.length > 0) {
        traccia(bridges, larghezza(4, 3.2), tav.ponte);
        for (const cl of [1, 2, 3, 4, 5, 6]) {
          traccia(bridges.filter(function (e) { return e.classe === cl; }), larghezza(cl), tav[CLASSI[cl].colore]);
        }
      }
    }

    // ferrovie e teleferiche
    if (F.ferrovie && trasporti) {
      ctx.lineCap = "butt";
      ctx.strokeStyle = tav.ferrovia;
      ctx.lineWidth = Math.max(1.4, 2.4 * scala);
      ctx.beginPath();
      for (const f of trasporti.ferrovie) {
        if (f.g) continue;
        const p = f.p;
        for (let i = 0; i + 2 < p.length; i += 3) {
          if (i === 0) ctx.moveTo(sx(p[i]), sz(p[i + 2])); else ctx.lineTo(sx(p[i]), sz(p[i + 2]));
        }
      }
      ctx.stroke();
      ctx.strokeStyle = mappa.palette === "notte" ? "#1c2229" : "#ffffff";
      ctx.lineWidth = Math.max(0.8, 1.2 * scala);
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = tav.funivia;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (const f of trasporti.funivie) {
        const p = f.p;
        for (let i = 0; i + 3 < p.length; i += 4) {
          if (i === 0) ctx.moveTo(sx(p[i]), sz(p[i + 2])); else ctx.lineTo(sx(p[i]), sz(p[i + 2]));
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // etichette: sempre dopo tutto il resto, senza sovrapporsi
    const occupato = [];
    const libero = function (X, Y, W2, H2) {
      for (const r of occupato) {
        if (X < r[0] + r[2] && X + W2 > r[0] && Y < r[1] + r[3] && Y + H2 > r[1]) return false;
      }
      occupato.push([X, Y, W2, H2]);
      return true;
    };
    const scrittaTesto = function (testo, X, Y, dim, colore, stile) {
      ctx.font = (stile || "") + " " + dim + "px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const largo = ctx.measureText(testo).width;
      if (X + largo / 2 < 0 || X - largo / 2 > w || Y < 0 || Y > h) return false;
      if (!libero(X - largo / 2 - 2, Y - dim / 2 - 1, largo + 4, dim + 2)) return false;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = tav.alone;
      ctx.strokeText(testo, X, Y);
      ctx.fillStyle = colore;
      ctx.fillText(testo, X, Y);
      return true;
    };

    // nomi delle strade (lungo la strada), solo con ingrandimenti medi/alti
    if (F.strade && F.nomiStrade && scala > 0.32 && !opt.semplice) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const dim = scala > 1.2 ? 12 : 10.5;
      ctx.font = dim + "px 'Segoe UI', Arial, sans-serif";
      const fatti = new Set();
      let conta = 0;
      const ordinate = vis.filter(function (e) { return e.strada.n && !e.strada.g; }).sort(function (a, b) { return b.classe - a.classe; });
      for (const e of ordinate) {
        if (conta > 90) break;
        if (fatti.has(e.strada.n) && scala < 1.5) continue;
        if (e.classe < 1 && scala < 0.9) continue;
        const p = e.strada.p;
        // il tratto piu' lungo (in pixel) dentro lo schermo
        let migliore = null, lunghezzaMax = 0;
        for (let i = 0; i + 5 < p.length; i += 3) {
          const ax = sx(p[i]), az = sz(p[i + 2]), bx = sx(p[i + 3]), bz = sz(p[i + 5]);
          if (ax < 0 || ax > w || az < 0 || az > h) continue;
          const l = Math.hypot(bx - ax, bz - az);
          if (l > lunghezzaMax) { lunghezzaMax = l; migliore = [ax, az, bx, bz]; }
        }
        if (!migliore) continue;
        const nome = e.strada.n;
        const largoTesto = ctx.measureText(nome).width;
        if (lunghezzaMax < largoTesto + 12) continue;
        let ang = Math.atan2(migliore[3] - migliore[1], migliore[2] - migliore[0]);
        if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
        const X = (migliore[0] + migliore[2]) / 2, Y = (migliore[1] + migliore[3]) / 2;
        if (!libero(X - largoTesto / 2, Y - dim / 2, largoTesto, dim)) continue;
        ctx.save();
        ctx.translate(X, Y);
        ctx.rotate(ang);
        ctx.lineWidth = 3;
        ctx.strokeStyle = tav.alone;
        ctx.strokeText(nome, 0, 0);
        ctx.fillStyle = tav.testo;
        ctx.fillText(nome, 0, 0);
        ctx.restore();
        fatti.add(nome);
        conta++;
      }
    }

    // punti di interesse (icone semplici)
    if (F.poi && scala > 0.1 && !opt.semplice) {
      const icone = { chiesa: ["✝", "#8a6d3b"], stazione: ["▲", "#d9566c"], galleria: ["≃", "#6b7078"], ponte: ["═", "#6b7078"] };
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of poi) {
        if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) continue;
        if ((p.tipo === "chiesa" && scala < 0.28) || ((p.tipo === "galleria" || p.tipo === "ponte") && scala < 0.2)) continue;
        const X = sx(p.x), Y = sz(p.z);
        const r = p.tipo === "stazione" ? 6 : 5;
        if (!libero(X - r, Y - r, r * 2, r * 2)) continue;
        ctx.fillStyle = mappa.palette === "notte" ? "#262c34" : "#ffffff";
        ctx.strokeStyle = icone[p.tipo][1];
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(X, Y, r + 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = icone[p.tipo][1];
        ctx.font = "bold " + (p.tipo === "stazione" ? 8 : 9) + "px Arial";
        ctx.fillText(icone[p.tipo][0], X, Y + 0.5);
        if (scala > 0.7 && p.tipo !== "chiesa") scrittaTesto(p.nome, X, Y + r + 8, 10, tav.testo, "");
      }
    }

    // nomi di citta', paesi e quartieri
    if (F.luoghi) {
      const elenco = (o.localita || []).slice().sort(function (a, b) {
        const peso = { city: 5, town: 4, village: 3, suburb: 2, hamlet: 2, quarter: 1, neighbourhood: 1 };
        return (peso[b.t] || 0) - (peso[a.t] || 0);
      });
      for (const l of elenco) {
        if (l.x < x0 - 300 || l.x > x1 + 300 || l.z < z0 - 100 || l.z > z1 + 100) continue;
        const grande = l.t === "city" || l.t === "town";
        const medio = l.t === "village";
        if (!grande && !medio && scala < 0.22) continue;
        const dim = grande ? 15 : (medio ? 12.5 : 10.5);
        scrittaTesto(grande ? l.n.toUpperCase() : l.n, sx(l.x), sz(l.z), dim, tav.luogo, grande ? "bold" : (medio ? "600" : "italic"));
      }
    }
    if (F.acque && lagoCentro && scala < 0.25) {
      scrittaTesto("Lago Maggiore", sx(lagoCentro[0]), sz(lagoCentro[1]), 14, tav.acquaTesto, "italic");
    }
    return occupato;
  };

  // Nome della strada piu' vicina al punto (per la mappa grande)
  mappa.stradaVicina = function (x, z, raggio) {
    let migliore = null, dMin = raggio;
    for (const e of visibili(indStrade, x - raggio, z - raggio, x + raggio, z + raggio)) {
      const p = e.strada.p;
      for (let i = 0; i + 5 < p.length; i += 3) {
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5];
        const l2 = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
        let t = l2 > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
        if (d < dMin) { dMin = d; migliore = e.strada; }
      }
    }
    return migliore;
  };

  mappa.cambiaFiltro = function (chiave, valore) {
    mappa.filtri[chiave] = valore;
    scrivi(CHIAVE_FILTRI, mappa.filtri);
    mappa.versione++;
  };
  mappa.salvaMini = function () { scrivi(CHIAVE_MINI, mappa.mini); };

  // --- Minimappa (in basso a destra) ---------------------------------------------------------------------
  const tela = document.getElementById("minimappa");
  const pen = tela.getContext("2d");
  const LATO = 240;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  tela.style.width = LATO + "px";
  tela.style.height = LATO + "px";
  tela.width = LATO * dpr;
  tela.height = LATO * dpr;
  const cache = document.createElement("canvas");
  const CACHE_LATO = Math.ceil(LATO * 1.9);
  cache.width = CACHE_LATO * dpr;
  cache.height = CACHE_LATO * dpr;
  const pc = cache.getContext("2d");
  let cacheCentro = null;
  let cacheScala = 0;
  let cacheVersione = -1;
  let cachePalette = "";
  const ZOOM = [10, 5.5, 3.2, 1.8, 1.0];   // metri per pixel della minimappa (0 = tutto lontano, 4 = vicinissimo)
  mappa.zoomMini = function (d) {
    mappa.mini.zoom = Math.max(0, Math.min(ZOOM.length - 1, mappa.mini.zoom + d));
    mappa.salvaMini();
  };
  mappa.ruotaMini = function () {
    mappa.mini.ruota = !mappa.mini.ruota;
    mappa.salvaMini();
  };

  mappa.disegnaMini = function (moto) {
    const amb = mappa.ambiente;
    const palette = amb && amb.uniformi.notte.value > 0.5 ? "notte" : "giorno";
    mappa.palette = palette;
    const scala = 1 / ZOOM[mappa.mini.zoom];
    // rifaccio la mappa grande solo se la moto si e' spostata abbastanza (o e' cambiato qualcosa)
    const fuori = cacheCentro === null || Math.hypot(moto.x - cacheCentro[0], moto.z - cacheCentro[1]) * scala > LATO * 0.28;
    if (fuori || cacheScala !== scala || cacheVersione !== mappa.versione || cachePalette !== palette) {
      cacheCentro = [moto.x, moto.z];
      cacheScala = scala;
      cacheVersione = mappa.versione;
      cachePalette = palette;
      pc.setTransform(dpr, 0, 0, dpr, 0, 0);
      mappa.disegnaVista(pc, moto.x, moto.z, scala, CACHE_LATO, CACHE_LATO, { semplice: false });
    }
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    pen.clearRect(0, 0, LATO, LATO);
    pen.save();
    pen.beginPath();
    pen.arc(LATO / 2, LATO / 2, LATO / 2 - 1, 0, Math.PI * 2);
    pen.clip();
    pen.fillStyle = TAVOLOZZE[palette].terra;
    pen.fillRect(0, 0, LATO, LATO);
    pen.translate(LATO / 2, LATO / 2);
    const rot = mappa.mini.ruota ? moto.angolo : 0;
    pen.rotate(rot);
    // la cache e' centrata su cacheCentro: la sposto di quanto si e' mossa la moto
    const dx = (cacheCentro[0] - moto.x) * scala;
    const dz = (cacheCentro[1] - moto.z) * scala;
    pen.drawImage(cache, dx - CACHE_LATO / 2, dz - CACHE_LATO / 2, CACHE_LATO, CACHE_LATO);
    pen.restore();

    // bordo, nord e indicatore della moto
    pen.save();
    pen.lineWidth = 3;
    pen.strokeStyle = palette === "notte" ? "rgba(230,236,245,0.9)" : "rgba(255,255,255,0.95)";
    pen.beginPath();
    pen.arc(LATO / 2, LATO / 2, LATO / 2 - 1.5, 0, Math.PI * 2);
    pen.stroke();
    // nord (ruota con la mappa)
    const nAng = mappa.mini.ruota ? moto.angolo : 0;
    const nx = LATO / 2 + Math.sin(nAng) * (LATO / 2 - 14);
    const nz = LATO / 2 - Math.cos(nAng) * (LATO / 2 - 14);
    pen.fillStyle = "#d62f3a";
    pen.beginPath();
    pen.arc(nx, nz, 8, 0, Math.PI * 2);
    pen.fill();
    pen.fillStyle = "#fff";
    pen.font = "bold 10px Arial";
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.fillText("N", nx, nz + 0.5);
    pen.restore();

    // la moto: freccia al centro (punta nella direzione di marcia), con cono di vista
    pen.save();
    pen.translate(LATO / 2, LATO / 2);
    // la moto a angolo 0 va verso -z (in alto sulla mappa); con la mappa ferma la freccia gira, con la mappa che ruota resta dritta
    pen.rotate(mappa.mini.ruota ? 0 : -moto.angolo);
    const g = pen.createRadialGradient(0, 0, 2, 0, 0, 46);
    g.addColorStop(0, "rgba(40,120,255,0.55)");
    g.addColorStop(1, "rgba(40,120,255,0)");
    pen.fillStyle = g;
    pen.beginPath();
    pen.moveTo(0, 0);
    pen.arc(0, 0, 46, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    pen.closePath();
    pen.fill();
    pen.beginPath();
    pen.moveTo(0, -11);
    pen.lineTo(8, 9);
    pen.lineTo(0, 4);
    pen.lineTo(-8, 9);
    pen.closePath();
    pen.fillStyle = "#2c7dff";
    pen.strokeStyle = "#ffffff";
    pen.lineWidth = 2.4;
    pen.lineJoin = "round";
    pen.stroke();
    pen.fill();
    pen.restore();
  };
  return mappa;
}
