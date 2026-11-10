// Luoghi: ogni citta' e paese ha una sua "identita'" visiva (colori dei muri e dei tetti, tipo di facciata,
// balconi, palme, viali alberati). I valori si ricavano dal nome (cosi' ogni paese del Ticino
// e' diverso dagli altri anche senza una tabella scritta a mano) e, per i luoghi piu' noti,
// da caratteristiche vere dell'architettura locale.
//
// Funziona con QUALSIASI localita' dei dati OpenStreetMap: se un paese non e' nella tabella
// "NOTI", il profilo nasce dal suo nome.

import * as THREE from "three";

// Famiglie di colori (muri) tipiche del Ticino e delle zone dei laghi
const FAMIGLIE = {
  ocra: { muri: [0xe9d3a4, 0xdcb98a, 0xe8c9a0, 0xf0e2bc, 0xd9a878, 0xefd9ac, 0xe6bf8e], tetti: [0xa04a30, 0x93442c, 0xb55a3a, 0x8a3f2a] },
  pastello: { muri: [0xf2cfc2, 0xf6e4a6, 0xcfe0d2, 0xf3e6d6, 0xe9b8b0, 0xd6e2ec, 0xf0d9b5], tetti: [0xb35a3c, 0xa24b32, 0xc0663f, 0x9a4a35] },
  pietra: { muri: [0xcfcbc2, 0xb9b4a8, 0xdcd6c8, 0xa9a396, 0xe6e0d2, 0xc4bcae], tetti: [0x7b6a62, 0x6e5f58, 0x8e4c36, 0x5f5651] },
  mediterraneo: { muri: [0xf4ead2, 0xe8b99a, 0xf1d28a, 0xd9916e, 0xf0e0c0, 0xefc9a0, 0xdca98a], tetti: [0xb85a38, 0xc4683f, 0xa84e32, 0xcf7448] },
  alpino: { muri: [0xf1ead8, 0xe5dcc4, 0xd9cfb5, 0xefe3c6, 0xcfc4a8, 0xe2d6b8], tetti: [0x6f4a3a, 0x7a5444, 0x5f4a42, 0x84583f] },
  moderno: { muri: [0xf0f0ec, 0xdcdcd8, 0xc8cbcc, 0xe8e4dc, 0xb7bcbe, 0xf3f1ea], tetti: [0x6a6d70, 0x5e6165, 0x7a5a48, 0x808487] }
};
const NOMI_FAMIGLIE = Object.keys(FAMIGLIE);

// Paesi noti: famiglia, peso delle facciate, balconi, palme, alberi di strada
// (persiane, finestre, moderno, storico, pietra)
const NOTI = {
  "locarno": { famiglia: "ocra", pesi: [0.38, 0.18, 0.14, 0.26, 0.04], balconi: 0.5, palme: 0.55, alberi: 0.6, portici: true },
  "muralto": { famiglia: "pastello", pesi: [0.3, 0.2, 0.2, 0.26, 0.04], balconi: 0.6, palme: 0.5, alberi: 0.6 },
  "ascona": { famiglia: "mediterraneo", pesi: [0.4, 0.12, 0.1, 0.34, 0.04], balconi: 0.55, palme: 0.75, alberi: 0.75, portici: true },
  "minusio": { famiglia: "pastello", pesi: [0.3, 0.3, 0.26, 0.08, 0.06], balconi: 0.7, palme: 0.3, alberi: 0.7 },
  "tenero": { famiglia: "moderno", pesi: [0.12, 0.38, 0.38, 0.04, 0.08], balconi: 0.5, palme: 0.1, alberi: 0.45 },
  "tenero-contra": { famiglia: "moderno", pesi: [0.12, 0.38, 0.38, 0.04, 0.08], balconi: 0.5, palme: 0.1, alberi: 0.45 },
  "gordola": { famiglia: "ocra", pesi: [0.3, 0.34, 0.22, 0.06, 0.08], balconi: 0.45, palme: 0.1, alberi: 0.55 },
  "losone": { famiglia: "alpino", pesi: [0.36, 0.32, 0.16, 0.06, 0.1], balconi: 0.4, palme: 0.15, alberi: 0.7 },
  "ponte brolla": { famiglia: "pietra", pesi: [0.08, 0.06, 0.02, 0.1, 0.74], balconi: 0.1, palme: 0, alberi: 0.4 },
  "tegna": { famiglia: "pietra", pesi: [0.14, 0.1, 0.04, 0.1, 0.62], balconi: 0.15, palme: 0, alberi: 0.4 },
  "mendrisio": { famiglia: "ocra", pesi: [0.3, 0.16, 0.12, 0.38, 0.04], balconi: 0.5, palme: 0.1, alberi: 0.5, portici: true },
  "chiasso": { famiglia: "moderno", pesi: [0.1, 0.3, 0.42, 0.14, 0.04], balconi: 0.75, palme: 0.1, alberi: 0.4 },
  "giubiasco": { famiglia: "pietra", pesi: [0.18, 0.3, 0.3, 0.14, 0.08], balconi: 0.55, palme: 0.05, alberi: 0.45 },
  "biasca": { famiglia: "pietra", pesi: [0.12, 0.14, 0.08, 0.1, 0.56], balconi: 0.25, palme: 0, alberi: 0.4 },
  "airolo": { famiglia: "alpino", pesi: [0.1, 0.1, 0.04, 0.06, 0.7], balconi: 0.25, palme: 0, alberi: 0.3 },
  "faido": { famiglia: "alpino", pesi: [0.14, 0.12, 0.04, 0.06, 0.64], balconi: 0.3, palme: 0, alberi: 0.35 },
  "morcote": { famiglia: "mediterraneo", pesi: [0.4, 0.1, 0.06, 0.36, 0.08], balconi: 0.5, palme: 0.8, alberi: 0.7 },
  "gandria": { famiglia: "mediterraneo", pesi: [0.36, 0.06, 0.02, 0.3, 0.26], balconi: 0.4, palme: 0.5, alberi: 0.6 },
  "paradiso": { famiglia: "mediterraneo", pesi: [0.12, 0.2, 0.44, 0.2, 0.04], balconi: 0.8, palme: 0.65, alberi: 0.55 },
  "orselina": { famiglia: "mediterraneo", pesi: [0.3, 0.28, 0.24, 0.1, 0.08], balconi: 0.65, palme: 0.4, alberi: 0.75 },
  "brione sopra minusio": { famiglia: "pietra", pesi: [0.2, 0.2, 0.08, 0.06, 0.46], balconi: 0.35, palme: 0.05, alberi: 0.6 },
  "cugnasco": { famiglia: "ocra", pesi: [0.3, 0.4, 0.2, 0.04, 0.06], balconi: 0.4, palme: 0, alberi: 0.5 },
  "magadino": { famiglia: "pastello", pesi: [0.4, 0.3, 0.1, 0.14, 0.06], balconi: 0.4, palme: 0.3, alberi: 0.6 },
  "vira": { famiglia: "pastello", pesi: [0.34, 0.2, 0.1, 0.1, 0.26], balconi: 0.4, palme: 0.35, alberi: 0.6 },
  "intragna": { famiglia: "pietra", pesi: [0.1, 0.06, 0.02, 0.1, 0.72], balconi: 0.2, palme: 0, alberi: 0.4 },
  "cavigliano": { famiglia: "pietra", pesi: [0.14, 0.1, 0.02, 0.06, 0.68], balconi: 0.2, palme: 0, alberi: 0.4 },
  "verscio": { famiglia: "pietra", pesi: [0.2, 0.14, 0.04, 0.06, 0.56], balconi: 0.3, palme: 0.05, alberi: 0.5 },
  "gambarogno": { famiglia: "pastello", pesi: [0.3, 0.2, 0.1, 0.1, 0.3], balconi: 0.4, palme: 0.3, alberi: 0.6 },
  "bellinzona": { famiglia: "pietra", pesi: [0.2, 0.2, 0.2, 0.3, 0.1], balconi: 0.5, palme: 0.1, alberi: 0.5 },
  "lugano": { famiglia: "mediterraneo", pesi: [0.2, 0.18, 0.3, 0.28, 0.04], balconi: 0.7, palme: 0.5, alberi: 0.6, portici: true }
};

function hashTesto(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function casuale(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function profiloDa(nome) {
  const chiave = nome.toLowerCase();
  const h = hashTesto(chiave);
  const rnd = casuale(h);
  const noto = NOTI[chiave];
  let profilo;
  if (noto) {
    profilo = Object.assign({}, noto);
  } else {
    // nasce dal nome: famiglia di colori e mix di facciate diversi da paese a paese
    const famiglia = NOMI_FAMIGLIE[h % NOMI_FAMIGLIE.length];
    let pesi = [rnd() + 0.2, rnd() + 0.2, rnd() * 0.6, rnd() * 0.5, rnd() * 0.3];
    if (famiglia === "pietra") pesi = [0.12, 0.08, 0.04, 0.12, 0.64];
    if (famiglia === "moderno") pesi = [0.12, 0.4, 0.38, 0.04, 0.06];
    const somma = pesi.reduce(function (a, b) { return a + b; }, 0);
    profilo = {
      famiglia: famiglia, pesi: pesi.map(function (v) { return v / somma; }),
      balconi: 0.2 + rnd() * 0.5, palme: famiglia === "mediterraneo" ? 0.4 : rnd() * 0.2, alberi: 0.4 + rnd() * 0.4, portici: false
    };
  }
  const fam = FAMIGLIE[profilo.famiglia];
  profilo.nome = nome;
  profilo.muri = fam.muri.slice();
  profilo.tetti = fam.tetti.slice();
  // il colore delle persiane cambia da paese a paese
  const persiane = [0x4f7a55, 0x6b4a32, 0x7a8a6a, 0x4a5f7a, 0x8a4a3a, 0x5a6a52];
  profilo.persiane = [persiane[h % persiane.length], persiane[(h >> 3) % persiane.length]];
  // giro dei toni: ogni paese sposta leggermente i colori
  profilo.sfumatura = (rnd() - 0.5) * 0.04;
  return profilo;
}

export const PROFILO_CAMPAGNA = (function () {
  const p = profiloDa("campagna");
  p.famiglia = "alpino";
  p.muri = FAMIGLIE.alpino.muri.slice();
  p.tetti = FAMIGLIE.alpino.tetti.slice();
  p.pesi = [0.3, 0.3, 0.1, 0.04, 0.26];
  p.balconi = 0.3;
  p.palme = 0;
  p.alberi = 0.5;
  return p;
})();

// Prepara l'elenco dei luoghi con il loro profilo
export function creaLuoghi(localita) {
  const lista = [];
  for (const l of localita || []) {
    if (l.t !== "city" && l.t !== "town" && l.t !== "village") continue;
    lista.push({ n: l.n, t: l.t, x: l.x, z: l.z, profilo: profiloDa(l.n), raggio: l.t === "city" ? 2200 : (l.t === "town" ? 1700 : 1100) });
  }
  return { lista: lista };
}

// Il luogo (citta'/paese) che "comanda" nel punto (x, z): il piu' vicino in rapporto alla sua grandezza
export function luogoVicino(luoghi, x, z) {
  let migliore = null;
  let punteggio = Infinity;
  for (const l of luoghi.lista) {
    const d = Math.hypot(l.x - x, l.z - z) / l.raggio;
    if (d < punteggio) {
      punteggio = d;
      migliore = l;
    }
  }
  return punteggio < 1.6 ? migliore : null;
}

export function profiloQui(luoghi, x, z) {
  const l = luogoVicino(luoghi, x, z);
  return l ? l.profilo : PROFILO_CAMPAGNA;
}

// Scelta pesata: pesi = [p0, p1, ...], r in [0, 1)
export function scegliPesato(pesi, r) {
  let somma = 0;
  for (const p of pesi) somma += p;
  let t = r * somma;
  for (let i = 0; i < pesi.length; i++) {
    t -= pesi[i];
    if (t < 0) return i;
  }
  return pesi.length - 1;
}

const _c = new THREE.Color();
// Colore dalla palette con una piccola variazione di tono e luminosita'
export function coloreVariato(esadecimale, r1, r2, sfumatura, ris) {
  _c.setHex(esadecimale);
  _c.offsetHSL(sfumatura + (r1 - 0.5) * 0.015, (r2 - 0.5) * 0.08, (r1 - 0.5) * 0.08);
  return ris.copy(_c);
}
