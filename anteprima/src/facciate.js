// Facciate e tetti disegnati dal codice (nessuna immagine presa da internet).
//
// Ogni tipo di facciata e' un "atlante" di 4 varianti di una campata (3 x 3 m): persiane aperte o chiuse,
// tende, fioriere, vetri riflettenti... Un piccolo programma della scheda video sceglie la variante di OGNI
// finestra a caso: cosi' due finestre vicine non sono mai uguali e il muro non sembra una piastrella ripetuta.
// Ogni atlante ha tre immagini: colore, luce (finestre accese di notte) e ruvidita' (vetro lucido, muro opaco).

import * as THREE from "three";
import { aggiungiMeteo } from "./meteo_shader.js";

const T = 256;       // lato di una campata
const VARIANTI = 4;

// --- Numeri casuali fissi (le texture sono sempre uguali ad ogni avvio) ----------------------
let seme = 777;
function rnd() {
  seme = (seme * 1664525 + 1013904223) >>> 0;
  return seme / 4294967296;
}

function tela(larghezza, altezza) {
  const c = document.createElement("canvas");
  c.width = larghezza;
  c.height = altezza;
  return c;
}

// Tre immagini affiancate (4 varianti): colore, luce, ruvidita'
function nuovoAtlante() {
  const dif = tela(T * VARIANTI, T);
  const emi = tela(T * VARIANTI, T);
  const rug = tela(T * VARIANTI, T);
  const a = { dif: dif, emi: emi, rug: rug, d: dif.getContext("2d"), e: emi.getContext("2d"), r: rug.getContext("2d") };
  a.e.fillStyle = "#000";
  a.e.fillRect(0, 0, T * VARIANTI, T);
  a.r.fillStyle = "rgb(0,235,0)";   // il canale verde e' la ruvidita': 235/255 = muro opaco
  a.r.fillRect(0, 0, T * VARIANTI, T);
  return a;
}

function perVariante(a, disegna) {
  for (let v = 0; v < VARIANTI; v++) {
    for (const c of [a.d, a.e, a.r]) {
      c.save();
      c.translate(v * T, 0);
      c.beginPath();
      c.rect(0, 0, T, T);
      c.clip();
    }
    disegna(a, v);
    for (const c of [a.d, a.e, a.r]) c.restore();
  }
}

// Colori della luce interna (lampadina calda, neon freddo, televisore azzurro, lampada arancio)
const LUCI = ["#ffd9a0", "#ffeabf", "#c8dcff", "#ffc080"];

// --- Parti comuni ---------------------------------------------------------------------------
function intonaco(a, forza, macchie) {
  const c = a.d;
  c.fillStyle = "#f6f4ee";
  c.fillRect(0, 0, T, T);
  // macchie grandi e morbide (umidita', ritocchi)
  for (let i = 0; i < macchie; i++) {
    const x = rnd() * T, y = rnd() * T, r = 30 + rnd() * 90;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const scuro = rnd() < 0.7;
    g.addColorStop(0, scuro ? "rgba(120,110,95," + (0.04 + rnd() * 0.06) + ")" : "rgba(255,255,255," + (0.08 + rnd() * 0.1) + ")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, T, T);
  }
  // grana fine
  for (let i = 0; i < 2600; i++) {
    const v = 232 + Math.floor(rnd() * (255 - 232) * (1 - forza * 0.2));
    c.fillStyle = "rgb(" + (v - Math.floor(forza * rnd() * 20)) + "," + (v - Math.floor(forza * rnd() * 20)) + "," + (v - Math.floor(forza * rnd() * 22)) + ")";
    c.fillRect(rnd() * T, rnd() * T, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // colature scure verso il basso
  for (let i = 0; i < 3; i++) {
    const x = rnd() * T;
    const g = c.createLinearGradient(0, T * 0.6, 0, T);
    g.addColorStop(0, "rgba(90,80,70,0)");
    g.addColorStop(1, "rgba(90,80,70," + (0.05 + rnd() * 0.07) + ")");
    c.fillStyle = g;
    c.fillRect(x, T * 0.6, 3 + rnd() * 6, T * 0.4);
  }
}

// Vetro: riflette il cielo in alto, scuro in basso; di notte puo' essere illuminato
function vetro(a, x, y, w, h, v, opzioni) {
  const o = opzioni || {};
  const c = a.d;
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.chiaro || "#9fb4c8");
  g.addColorStop(0.5, "#46586a");
  g.addColorStop(1, "#27333e");
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  // tenda interna (variante 1 e 3: tenda chiara o scura)
  if (!o.senzaTende) {
    if (v === 1) {
      c.fillStyle = "rgba(235,228,210,0.9)";
      c.fillRect(x, y, w, h * (0.55 + 0.4 * rnd()));
    } else if (v === 3) {
      c.fillStyle = "rgba(150,120,110,0.75)";
      c.fillRect(x, y, w * 0.38, h);
      c.fillRect(x + w * 0.62, y, w * 0.38, h);
    }
  }
  a.r.fillStyle = "rgb(0," + (v === 1 ? 150 : 38) + ",0)";   // lucido (le tende sono piu' opache)
  a.r.fillRect(x, y, w, h);
  // luce interna
  if (o.spenta !== true) {
    const e = a.e;
    const grad = e.createRadialGradient(x + w / 2, y + h * 0.45, 2, x + w / 2, y + h * 0.5, Math.max(w, h) * 0.75);
    grad.addColorStop(0, LUCI[v % LUCI.length]);
    grad.addColorStop(1, "rgba(120,80,40,0.55)");
    e.fillStyle = grad;
    e.fillRect(x, y, w, h);
    if (v === 1) {
      // dietro la tenda la luce e' piu' diffusa
      e.fillStyle = "rgba(255,225,170,0.55)";
      e.fillRect(x, y, w, h * 0.5);
    }
  }
}

function cornice(a, x, y, w, h, spessore, colore) {
  const c = a.d;
  c.fillStyle = colore;
  c.fillRect(x - spessore, y - spessore, w + spessore * 2, spessore);
  c.fillRect(x - spessore, y + h, w + spessore * 2, spessore);
  c.fillRect(x - spessore, y, spessore, h);
  c.fillRect(x + w, y, spessore, h);
}

function davanzale(a, x, w, y) {
  a.d.fillStyle = "#bdb9b0";
  a.d.fillRect(x - 8, y, w + 16, 8);
  a.d.fillStyle = "rgba(60,55,50,0.35)";
  a.d.fillRect(x - 8, y + 8, w + 16, 4);   // ombra sotto il davanzale
}

function persiana(a, x, y, w, h, colore, aperta) {
  const c = a.d;
  c.fillStyle = colore;
  c.fillRect(x, y, w, h);
  c.fillStyle = "rgba(0,0,0,0.28)";
  for (let yy = y + 4; yy < y + h - 3; yy += 7) c.fillRect(x + 3, yy, w - 6, 2.2);
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.fillRect(x, y, 2, h);
  a.r.fillStyle = "rgb(0,205,0)";
  a.r.fillRect(x, y, w, h);
  void aperta;
}

// --- Tipi di facciata -----------------------------------------------------------------------

// 1) Casa ticinese: finestra con cornice, persiane verdi/marroni (aperte o chiuse), fioriere
function disegnaPersiane(a, v) {
  intonaco(a, 1, 8);
  const c = a.d;
  const colori = ["#4f7a55", "#6b4a32", "#6d8a62", "#5a6a52"];
  const col = colori[v];
  const x = 88, y = 56, w = 80, h = 140;
  cornice(a, x, y, w, h, 7, "#f1eee6");
  if (v === 2) {
    // persiane chiuse: tutta la finestra e' coperta (e la luce non passa)
    persiana(a, x - 4, y - 2, w / 2 + 3, h + 4, col, false);
    persiana(a, x + w / 2 - 1, y - 2, w / 2 + 5, h + 4, col, false);
  } else {
    vetro(a, x, y, w, h, v);
    c.fillStyle = "#f1eee6";
    c.fillRect(x + w / 2 - 2, y, 4, h);
    c.fillRect(x, y + h * 0.4, w, 4);
    // persiane aperte ai lati
    persiana(a, x - 40, y - 2, 36, h + 4, col, true);
    persiana(a, x + w + 4, y - 2, 36, h + 4, col, true);
  }
  davanzale(a, x, w, y + h + 6);
  if (v === 0 || v === 3) {
    // fioriera con gerani
    c.fillStyle = "#6b4a32";
    c.fillRect(x - 4, y + h + 14, w + 8, 14);
    for (let i = 0; i < 26; i++) {
      c.fillStyle = rnd() < 0.5 ? "#c8283a" : (rnd() < 0.5 ? "#d9566c" : "#3f7a3a");
      c.beginPath();
      c.arc(x + rnd() * (w + 8), y + h + 14 - rnd() * 8, 4 + rnd() * 4, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// 2) Palazzina semplice: finestra con avvolgibile
function disegnaFinestre(a, v) {
  intonaco(a, 0.8, 6);
  const c = a.d;
  const x = 84, y = 70, w = 88, h = 118;
  c.fillStyle = "#d8d4ca";
  c.fillRect(x - 10, y - 30, w + 20, 26);   // cassonetto dell'avvolgibile
  a.r.fillStyle = "rgb(0,215,0)";
  a.r.fillRect(x - 10, y - 30, w + 20, 26);
  cornice(a, x, y, w, h, 5, "#c9c5bb");
  vetro(a, x, y, w, h, v);
  c.fillStyle = "#c9c5bb";
  c.fillRect(x + w / 2 - 2, y, 4, h);
  if (v === 2) {
    // avvolgibile abbassato per meta'
    c.fillStyle = "#9aa0a2";
    c.fillRect(x, y, w, h * 0.55);
    c.fillStyle = "rgba(0,0,0,0.2)";
    for (let yy = y + 3; yy < y + h * 0.55; yy += 6) c.fillRect(x, yy, w, 1.6);
    a.e.fillStyle = "#000";
    a.e.fillRect(x, y, w, h * 0.55);
  }
  davanzale(a, x, w, y + h + 4);
}

// 3) Edificio moderno: finestra larga, balcone con parapetto, tenda da sole
function disegnaModerno(a, v) {
  intonaco(a, 0.5, 4);
  const c = a.d;
  const x = 40, y = 52, w = 176, h = 118;
  cornice(a, x, y, w, h, 4, "#9a9d9e");
  vetro(a, x, y, w, h, v, { chiaro: "#a8bccd" });
  c.fillStyle = "#8f9395";
  c.fillRect(x + w / 3 - 2, y, 4, h);
  c.fillRect(x + (2 * w) / 3 - 2, y, 4, h);
  // soletta del balcone e parapetto
  c.fillStyle = "#c9c9c4";
  c.fillRect(0, y + h + 6, T, 22);
  c.fillStyle = "rgba(40,40,40,0.4)";
  c.fillRect(0, y + h + 28, T, 6);
  c.fillStyle = "rgba(70,78,84,0.8)";
  c.fillRect(0, y + h + 34, T, 0.1);
  if (v === 1) {
    // tenda da sole a righe
    for (let i = 0; i < 11; i++) {
      c.fillStyle = i % 2 ? "#f2efe6" : "#c4503a";
      c.fillRect(x - 6 + i * ((w + 12) / 11), y - 28, (w + 12) / 11 + 0.5, 34);
    }
    a.e.fillStyle = "#000";
    a.e.fillRect(x, y, w, 8);
  }
  if (v === 3) {
    // tapparelle a lamelle sollevate a meta'
    c.fillStyle = "#cfd2d3";
    c.fillRect(x, y, w, h * 0.4);
    c.fillStyle = "rgba(0,0,0,0.18)";
    for (let yy = y + 2; yy < y + h * 0.4; yy += 5) c.fillRect(x, yy, w, 1.2);
    a.e.fillStyle = "#000";
    a.e.fillRect(x, y, w, h * 0.4);
  }
}

// 4) Palazzo storico: finestra alta con arco in pietra, cornicione, bugnato agli angoli
function disegnaStorico(a, v) {
  intonaco(a, 1.2, 10);
  const c = a.d;
  const x = 98, y = 62, w = 60, h = 134;
  // bugnato (pietra agli angoli) sui bordi della campata
  c.fillStyle = "rgba(200,190,170,0.55)";
  for (let yy = 0; yy < T; yy += 34) {
    c.fillRect(0, yy, 14, 30);
    c.fillRect(T - 14, yy + 17, 14, 30);
  }
  // fascia marcapiano
  c.fillStyle = "#e6dfcf";
  c.fillRect(0, 12, T, 12);
  c.fillStyle = "rgba(0,0,0,0.2)";
  c.fillRect(0, 24, T, 3);
  // arco e cornice in pietra
  c.fillStyle = "#dcd4c2";
  c.beginPath();
  c.moveTo(x - 10, y + h + 4);
  c.lineTo(x - 10, y + 24);
  c.arc(x + w / 2, y + 24, w / 2 + 10, Math.PI, 0);
  c.lineTo(x + w + 10, y + h + 4);
  c.fill();
  c.fillStyle = "#222a31";
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + 24);
  c.arc(x + w / 2, y + 24, w / 2, Math.PI, 0);
  c.lineTo(x + w, y + h);
  c.fill();
  // vetro nella forma ad arco (clip)
  c.save();
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + 24);
  c.arc(x + w / 2, y + 24, w / 2, Math.PI, 0);
  c.lineTo(x + w, y + h);
  c.clip();
  a.e.save();
  a.e.beginPath();
  a.e.moveTo(x, y + h);
  a.e.lineTo(x, y + 24);
  a.e.arc(x + w / 2, y + 24, w / 2, Math.PI, 0);
  a.e.lineTo(x + w, y + h);
  a.e.clip();
  a.r.save();
  a.r.beginPath();
  a.r.rect(x, y - 10, w, h + 10);
  a.r.clip();
  if (v === 2) {
    persiana(a, x, y - 8, w / 2, h + 8, "#6b4a32", false);
    persiana(a, x + w / 2, y - 8, w / 2, h + 8, "#6b4a32", false);
  } else {
    vetro(a, x, y - 8, w, h + 8, v);
    c.fillStyle = "#e6dfcf";
    c.fillRect(x + w / 2 - 2, y - 8, 4, h + 8);
    c.fillRect(x, y + 50, w, 3);
  }
  a.r.restore();
  a.e.restore();
  c.restore();
  // ringhiera in ferro battuto davanti
  if (v !== 3) {
    c.strokeStyle = "#1f2326";
    c.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      c.beginPath();
      c.moveTo(x - 8 + i * ((w + 16) / 8), y + h - 40);
      c.lineTo(x - 8 + i * ((w + 16) / 8), y + h + 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(x - 8, y + h - 40);
    c.lineTo(x + w + 8, y + h - 40);
    c.stroke();
  }
  davanzale(a, x - 8, w + 16, y + h + 4);
}

// 5) Casa di pietra (rustico, nuclei in granito come a Ponte Brolla): sassi irregolari, finestra piccola
function disegnaPietra(a, v) {
  const c = a.d;
  c.fillStyle = "#c9c3b8";
  c.fillRect(0, 0, T, T);
  for (let riga = 0; riga < 8; riga++) {
    let x = -rnd() * 30;
    const y = riga * 32;
    while (x < T) {
      const w = 28 + rnd() * 40;
      const t = 0.82 + rnd() * 0.3;
      c.fillStyle = "rgb(" + Math.floor(168 * t) + "," + Math.floor(160 * t) + "," + Math.floor(150 * t) + ")";
      c.fillRect(x + 1.5, y + 1.5, w - 3, 29);
      c.fillStyle = "rgba(255,255,255,0.08)";
      c.fillRect(x + 1.5, y + 1.5, w - 3, 3);
      c.fillStyle = "rgba(0,0,0,0.12)";
      c.fillRect(x + 1.5, y + 27, w - 3, 3);
      x += w;
    }
  }
  a.r.fillStyle = "rgb(0,250,0)";
  a.r.fillRect(0, 0, T, T);
  const x = 100, y = 78, w = 56, h = 84;
  c.fillStyle = "#8d877b";
  c.fillRect(x - 12, y - 14, w + 24, 14);        // architrave in granito
  c.fillRect(x - 12, y + h, w + 24, 12);
  c.fillRect(x - 12, y - 14, 12, h + 26);
  c.fillRect(x + w, y - 14, 12, h + 26);
  if (v === 2) {
    persiana(a, x, y, w, h, "#6b4a32", false);
  } else {
    vetro(a, x, y, w, h, v);
    c.fillStyle = "#4a3a2c";
    c.fillRect(x + w / 2 - 2, y, 4, h);
    c.fillRect(x, y + h * 0.45, w, 4);
    if (v !== 1) persiana(a, x - 30, y, 26, h, "#6b4a32", true);
    if (v !== 1) persiana(a, x + w + 4, y, 26, h, "#6b4a32", true);
  }
}

// 6) Uffici / hotel: facciata a vetri continua con fasce, montanti e parapetti
function disegnaUffici(a, v) {
  const c = a.d;
  c.fillStyle = "#cfd4d8";
  c.fillRect(0, 0, T, T);
  const colori = [["#7fa0b8", "#2f4558"], ["#86a89a", "#2f4a42"], ["#9aa6b4", "#38424f"], ["#8aa2b0", "#2a3c48"]];
  const [alto, basso] = colori[v];
  const g = c.createLinearGradient(0, 20, 0, 200);
  g.addColorStop(0, alto);
  g.addColorStop(0.55, basso);
  g.addColorStop(1, "#1d2a34");
  c.fillStyle = g;
  c.fillRect(0, 20, T, 190);
  a.r.fillStyle = "rgb(0,30,0)";
  a.r.fillRect(0, 20, T, 190);
  // riflessi diagonali
  c.fillStyle = "rgba(255,255,255,0.1)";
  c.beginPath();
  c.moveTo(30, 20);
  c.lineTo(100, 20);
  c.lineTo(40, 210);
  c.lineTo(-20, 210);
  c.fill();
  // montanti
  c.fillStyle = "#b5bbc0";
  for (const x of [0, 85, 170, 252]) c.fillRect(x, 0, 4, T);
  c.fillRect(0, 20, T, 4);
  c.fillRect(0, 206, T, 5);
  // fascia (parapetto pieno) in basso
  c.fillStyle = "#a9afb4";
  c.fillRect(0, 211, T, 45);
  const e = a.e;
  for (let i = 0; i < 3; i++) {
    if ((v + i) % 3 === 0) continue;   // alcune campate spente
    e.fillStyle = i === 1 ? "#cfe0ff" : "#fff0cc";
    e.fillRect(i * 85 + 6, 28, 78, 176);
  }
}

// 7) Capannone: lamiera con nervature, fascia di finestre alte, porta
function disegnaCapannone(a, v) {
  const c = a.d;
  c.fillStyle = "#e4e6e6";
  c.fillRect(0, 0, T, T);
  for (let x = 0; x < T; x += 16) {
    c.fillStyle = "rgba(0,0,0,0.10)";
    c.fillRect(x, 0, 2, T);
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.fillRect(x + 2, 0, 2, T);
  }
  // sporco in basso
  const g = c.createLinearGradient(0, T * 0.65, 0, T);
  g.addColorStop(0, "rgba(70,65,60,0)");
  g.addColorStop(1, "rgba(70,65,60,0.3)");
  c.fillStyle = g;
  c.fillRect(0, T * 0.65, T, T * 0.35);
  a.r.fillStyle = "rgb(0,185,0)";
  a.r.fillRect(0, 0, T, T);
  // fascia di finestre
  vetro(a, 0, 54, T, 40, v, { senzaTende: true, chiaro: "#a9bccb" });
  c.fillStyle = "#cdd0d2";
  for (let x = 0; x < T; x += 64) c.fillRect(x, 54, 4, 40);
  if (v === 0) {
    // portone
    c.fillStyle = "#6b7378";
    c.fillRect(70, 130, 116, 126);
    c.fillStyle = "rgba(255,255,255,0.15)";
    for (let y = 134; y < 252; y += 10) c.fillRect(72, y, 112, 2);
    a.r.fillStyle = "rgb(0,170,0)";
    a.r.fillRect(70, 130, 116, 126);
  }
  if (v === 3) {
    c.fillStyle = "#d0d3d4";
    c.fillRect(0, 106, T, 8);   // fascia di rinforzo
  }
}

// 8) Negozio (piano terra): insegna, grande vetrina illuminata, porta, tenda
function disegnaNegozio(a, v) {
  const c = a.d;
  intonaco(a, 1, 4);
  const insegne = ["#2d4a3a", "#7a2a34", "#233a5a", "#2a2a2e"];
  c.fillStyle = insegne[v];
  c.fillRect(0, 0, T, 52);
  c.fillStyle = "rgba(255,255,255,0.78)";
  c.fillRect(30, 18, 120 + (v * 18) % 60, 12);   // scritta
  c.fillRect(30, 34, 70, 5);
  a.r.fillStyle = "rgb(0,120,0)";
  a.r.fillRect(0, 0, T, 52);
  a.e.fillStyle = "rgba(255,230,180,0.55)";
  a.e.fillRect(30, 18, 120 + (v * 18) % 60, 12);
  // vetrina e porta
  const x = 14, y = 64, w = v === 3 ? 150 : 228, h = 168;
  c.fillStyle = "#44484b";
  c.fillRect(x - 5, y - 5, w + 10, h + 8);
  vetro(a, x, y, w, h, 0, { chiaro: "#b4c4d0", senzaTende: true });
  // merce / interno
  const e = a.e;
  e.fillStyle = "rgba(255,240,205,0.35)";
  e.fillRect(x, y + h * 0.5, w, h * 0.5);
  c.fillStyle = "rgba(40,30,25,0.35)";
  for (let i = 0; i < 5; i++) c.fillRect(x + 10 + i * (w / 5), y + 70 + rnd() * 40, 22, 48);
  c.fillStyle = "#44484b";
  for (let i = 1; i < (v === 3 ? 3 : 4); i++) c.fillRect(x + (w / (v === 3 ? 3 : 4)) * i - 2, y, 4, h);
  if (v === 3) {
    // porta a vetri a destra
    c.fillStyle = "#44484b";
    c.fillRect(176, 70, 64, 172);
    vetro(a, 182, 76, 52, 160, 0, { senzaTende: true });
  }
  if (v === 1 || v === 2) {
    // tenda a righe sopra la vetrina
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? "#f4efe2" : (v === 1 ? "#b8342d" : "#2b6a4a");
      c.fillRect(i * 22, 52, 22.4, 30);
    }
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.fillRect(0, 82, T, 5);
    a.e.fillStyle = "#000";
    a.e.fillRect(0, 52, T, 32);
  }
}

// --- Tetti ----------------------------------------------------------------------------------------
function texTegole() {
  const c = tela(256, 256);
  const g = c.getContext("2d");
  g.fillStyle = "#9a5238";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 24) {
    for (let x = (y / 24) % 2 === 0 ? 0 : 14; x < 256 + 28; x += 28) {
      const t = 0.82 + rnd() * 0.32;
      const gr = g.createLinearGradient(x - 14, 0, x + 14, 0);
      gr.addColorStop(0, "rgb(" + Math.floor(112 * t) + "," + Math.floor(58 * t) + "," + Math.floor(40 * t) + ")");
      gr.addColorStop(0.5, "rgb(" + Math.floor(190 * t) + "," + Math.floor(108 * t) + "," + Math.floor(74 * t) + ")");
      gr.addColorStop(1, "rgb(" + Math.floor(112 * t) + "," + Math.floor(58 * t) + "," + Math.floor(40 * t) + ")");
      g.fillStyle = gr;
      g.fillRect(x - 13, y + 1, 26, 23);
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.fillRect(x - 13, y + 19, 26, 4);
    }
  }
  // muschio e sporco
  for (let i = 0; i < 40; i++) {
    g.fillStyle = "rgba(60,80,40," + rnd() * 0.12 + ")";
    g.fillRect(rnd() * 256, rnd() * 256, 6 + rnd() * 20, 4 + rnd() * 10);
  }
  return c;
}
function texPiatto() {
  const c = tela(128, 128);
  const g = c.getContext("2d");
  g.fillStyle = "#a9a9a6";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1500; i++) {
    const v = 120 + Math.floor(rnd() * 90);
    g.fillStyle = "rgb(" + v + "," + v + "," + (v - 4) + ")";
    g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  return c;
}
function texLamiera() {
  const c = tela(128, 128);
  const g = c.getContext("2d");
  g.fillStyle = "#c7ccce";
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = "rgba(0,0,0,0.14)";
    g.fillRect(x, 0, 3, 128);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fillRect(x + 3, 0, 3, 128);
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = "rgba(90,90,80," + rnd() * 0.1 + ")";
    g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 6, 2);
  }
  return c;
}
function texArdesia() {
  // lastre di pietra (piode) dei tetti di montagna
  const c = tela(256, 256);
  const g = c.getContext("2d");
  g.fillStyle = "#6a6764";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 20) {
    for (let x = ((y / 20) % 2) * 20; x < 276; x += 40) {
      const t = 0.8 + rnd() * 0.35;
      g.fillStyle = "rgb(" + Math.floor(112 * t) + "," + Math.floor(108 * t) + "," + Math.floor(104 * t) + ")";
      g.fillRect(x - 19, y + 1, 38, 18);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(x - 19, y + 16, 38, 3);
    }
  }
  return c;
}

function struttura(canvas, anisotropia, colore) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropia;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = colore ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

// --- Programma (shader) che sceglie variante e luce di ogni campata ------------------------------
function modificaFacciata(materiale, atlante, notte, probabilitaLuce) {
  materiale.onBeforeCompile = function (shader) {
    shader.uniforms.tLuce = { value: atlante.luce };
    shader.uniforms.tRuvido = { value: atlante.ruvido };
    shader.uniforms.uNotte = notte;
    shader.uniforms.uProb = { value: probabilitaLuce };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float seme;\nvarying vec2 vBay;\nflat varying float vSeme;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBay = uv;\nvSeme = seme;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D tLuce;
        uniform sampler2D tRuvido;
        uniform float uNotte;
        uniform float uProb;
        varying vec2 vBay;
        flat varying float vSeme;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        vec2 uvBay;
        vec2 gradX;
        vec2 gradY;
        vec2 bayId;`)
      .replace("#include <map_fragment>", `
        bayId = floor(vBay + 0.0005);
        vec2 fp = fract(vBay + 0.0005);
        float sInt = floor(vSeme * 10.0 + 0.5);
        float variante = floor(h21(bayId + vec2(sInt * 0.37, sInt * 0.73)) * 3.999);
        uvBay = vec2((variante + 0.03 + fp.x * 0.94) * 0.25, 0.03 + fp.y * 0.94);
        gradX = dFdx(vBay) * vec2(0.235, 0.94);
        gradY = dFdy(vBay) * vec2(0.235, 0.94);
        diffuseColor *= textureGrad(map, uvBay, gradX, gradY);`)
      .replace("#include <roughnessmap_fragment>", `
        float roughnessFactor = roughness * textureGrad(tRuvido, uvBay, gradX, gradY).g * (255.0 / 235.0);`)
      .replace("#include <emissivemap_fragment>", `
        {
          float sI = floor(vSeme * 10.0 + 0.5);
          float soglia = 1.0 - uProb * (0.5 + 0.9 * fract(sI * 0.0371));
          float acceso = step(soglia, h21(bayId * 1.7 + vec2(sI * 0.31, 7.7)));
          vec3 luminosa = textureGrad(tLuce, uvBay, gradX, gradY).rgb;
          totalEmissiveRadiance += luminosa * acceso * uNotte * 2.2;
        }`);
  };
  materiale.customProgramCacheKey = function () { return "facciata-v2"; };
}

function creaAtlante(disegna, anisotropia) {
  const a = nuovoAtlante();
  perVariante(a, disegna);
  return {
    colore: struttura(a.dif, anisotropia, true),
    luce: struttura(a.emi, anisotropia, true),
    ruvido: struttura(a.rug, anisotropia, false)
  };
}

// Crea tutti i materiali di facciata e di tetto (una sola volta)
export function creaMateriali(notte, anisotropia, ambiente) {
  const tipi = {
    persiane: disegnaPersiane, finestre: disegnaFinestre, moderno: disegnaModerno, storico: disegnaStorico,
    pietra: disegnaPietra, uffici: disegnaUffici, capannone: disegnaCapannone, negozio: disegnaNegozio
  };
  const probabilita = { persiane: 0.55, finestre: 0.55, moderno: 0.62, storico: 0.5, pietra: 0.4, uffici: 0.8, capannone: 0.35, negozio: 1.2 };
  const facciate = {};
  for (const nome of Object.keys(tipi)) {
    const atlante = creaAtlante(tipi[nome], anisotropia);
    const materiale = new THREE.MeshStandardMaterial({
      map: atlante.colore, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1.0
    });
    modificaFacciata(materiale, atlante, notte, probabilita[nome]);
    aggiungiMeteo(materiale, ambiente, { neve: 0, bagnato: 0.7 });
    facciate[nome] = materiale;
  }
  const liscio = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const tetti = {
    tegole: new THREE.MeshStandardMaterial({ map: struttura(texTegole(), anisotropia, true), vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    piatto: new THREE.MeshStandardMaterial({ map: struttura(texPiatto(), anisotropia, true), vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    lamiera: new THREE.MeshStandardMaterial({ map: struttura(texLamiera(), anisotropia, true), vertexColors: true, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }),
    ardesia: new THREE.MeshStandardMaterial({ map: struttura(texArdesia(), anisotropia, true), vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
  };
  const dettagli = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide });
  aggiungiMeteo(liscio, ambiente, { neve: 0.5, bagnato: 0.6 });
  aggiungiMeteo(dettagli, ambiente, { neve: 0.85, bagnato: 0.6 });
  for (const t of Object.values(tetti)) aggiungiMeteo(t, ambiente, { neve: 1, bagnato: 1 });
  return { facciate: facciate, liscio: liscio, tetti: tetti, dettagli: dettagli };
}
