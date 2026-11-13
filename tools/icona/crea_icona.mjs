// Crea il logo del gioco e le icone dell'app.
//   node tools/icona/crea_icona.mjs
//
// Il logo e' disegnato qui sotto (nessun file esterno): una strada rossa che sale a curve verso le montagne
// del Ticino, sotto l'arco di un contagiri. Lo script scrive:
//   anteprima/grafica/logo.svg     il disegno (sorgente vettoriale)
//   anteprima/grafica/icona.png    256 px: icona della finestra e della scheda
//   anteprima/build/icon-mac.png   1024 px con il margine che vuole macOS (electron-builder ne fa il .icns)
//   anteprima/build/icon-win.png   1024 px a tutto campo (electron-builder ne fa il .ico)
// e aggiorna il logo dentro anteprima/index.html (tra "logo:inizio" e "logo:fine").
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const radice = path.resolve(import.meta.dirname, "../../anteprima");
const n = (v) => (Math.round(v * 10) / 10).toString();

// --- La strada: una linea di mezzo che serpeggia, larga in basso e stretta all'orizzonte (prospettiva) ---
const ORIZZONTE = 580;
function puntoStrada(s) {            // s = 0 in basso (vicino), 1 all'orizzonte (lontano)
  const vicino = Math.pow(1 - s, 1.75);
  const y = ORIZZONTE + (1040 - ORIZZONTE) * vicino;
  const x = 540 - 235 * Math.sin(s * Math.PI * 1.9 + 0.35) * Math.pow(1 - s, 0.62) + 70 * vicino;
  const meta = 10 + 185 * vicino;
  return { x, y, meta };
}
function nastro(da, a, frazione) {    // poligono della strada (o della sua riga di mezzo) tra due valori di s
  const sinistra = [], destra = [];
  const PASSI = 60;
  for (let i = 0; i <= PASSI; i++) {
    const p = puntoStrada(da + (a - da) * (i / PASSI));
    sinistra.push(n(p.x - p.meta * frazione) + "," + n(p.y));
    destra.push(n(p.x + p.meta * frazione) + "," + n(p.y));
  }
  return "M" + sinistra.join("L") + "L" + destra.reverse().join("L") + "Z";
}
const strada = nastro(0, 1, 1);
let tratteggi = "";
for (const [da, a] of [[0.02, 0.13], [0.2, 0.3], [0.37, 0.46], [0.53, 0.61], [0.68, 0.75], [0.81, 0.87]]) tratteggi += nastro(da, a, 0.075);

// --- L'arco del contagiri: sopra le montagne, ambra e poi rosso (zona rossa) ---
const CX = 512, CY = 590, R = 408;
function suArco(gradi, raggio) {
  const a = (gradi * Math.PI) / 180;
  return n(CX + raggio * Math.cos(a)) + "," + n(CY + raggio * Math.sin(a));
}
const arco = (da, a) => "M" + suArco(da, R) + "A" + R + "," + R + " 0 0 1 " + suArco(a, R);
let tacche = "";
for (let g = 198; g <= 342; g += 16) tacche += "M" + suArco(g, R - 44) + "L" + suArco(g, R - 78);

const disegno = `
  <defs>
    <linearGradient id="mrwCielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#243247"/><stop offset="0.6" stop-color="#151d29"/><stop offset="1" stop-color="#0e1319"/>
    </linearGradient>
    <radialGradient id="mrwBagliore" cx="0.5" cy="0.58" r="0.42">
      <stop offset="0" stop-color="#ff4650" stop-opacity="0.42"/><stop offset="1" stop-color="#ff4650" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mrwStrada" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff5a63"/><stop offset="1" stop-color="#d42a35"/>
    </linearGradient>
    <linearGradient id="mrwMonte" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#55677f"/><stop offset="1" stop-color="#2a3748"/>
    </linearGradient>
    <clipPath id="mrwForma"><rect width="1024" height="1024" rx="228"/></clipPath>
  </defs>
  <g clip-path="url(#mrwForma)">
    <rect width="1024" height="1024" fill="url(#mrwCielo)"/>
    <rect width="1024" height="1024" fill="url(#mrwBagliore)"/>
    <path d="${arco(196, 306)}" fill="none" stroke="#ffd75a" stroke-width="44" stroke-linecap="round"/>
    <path d="${arco(318, 344)}" fill="none" stroke="#ff4650" stroke-width="44" stroke-linecap="round"/>
    <path d="${tacche}" fill="none" stroke="#e8edf3" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    <g transform="translate(512 580) scale(1.12) translate(-512 -640)">
    <path d="M-20,640 L150,470 L250,540 L420,330 L560,520 L680,410 L860,560 L1044,640 Z" fill="#33435a"/>
    <path d="M-20,640 L120,560 L300,600 L520,370 L640,500 L760,440 L1044,640 Z" fill="url(#mrwMonte)"/>
    <path d="M520,370 L588,444 L548,430 L524,468 L498,432 L462,446 Z" fill="#e8edf3"/>
    <path d="M760,440 L812,476 L780,470 L762,494 L742,470 L716,478 Z" fill="#e8edf3" fill-opacity="0.9"/>
    </g>
    <rect x="0" y="${ORIZZONTE}" width="1024" height="${1024 - ORIZZONTE}" fill="#10161e"/>
    <path d="M0,${ORIZZONTE} H1024" stroke="#3a4658" stroke-width="4"/>
    <path d="${strada}" fill="url(#mrwStrada)"/>
    <path d="${tratteggi}" fill="#ffffff"/>
  </g>`;
const svg = (contenuto, extra) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"${extra || ""}>${contenuto}\n</svg>\n`;

fs.mkdirSync(path.join(radice, "grafica"), { recursive: true });
fs.mkdirSync(path.join(radice, "build"), { recursive: true });
fs.writeFileSync(path.join(radice, "grafica/logo.svg"), svg(disegno));

// --- Il logo dentro la pagina (schermata di caricamento) ---
const pagina = path.join(radice, "index.html");
const html = fs.readFileSync(pagina, "utf8");
const inizio = "<!-- logo:inizio -->", fine = "<!-- logo:fine -->";
if (html.includes(inizio) && html.includes(fine)) {
  const dentro = svg(disegno, ' id="logoCarica" aria-hidden="true"').trim().split("\n").map((riga) => "    " + riga.trim()).join("\n");
  fs.writeFileSync(pagina, html.slice(0, html.indexOf(inizio) + inizio.length) + "\n" + dentro + "\n    " + html.slice(html.indexOf(fine)));
}

// --- Le immagini ---
const browser = await chromium.launch();
async function immagine(file, lato, margine) {
  const p = await browser.newPage({ viewport: { width: lato, height: lato } });
  const dentro = lato - 2 * margine;
  await p.setContent(`<body style="margin:0;background:transparent"><div style="width:${dentro}px;height:${dentro}px;margin:${margine}px">${svg(disegno)}</div>`);
  await p.screenshot({ path: path.join(radice, file), omitBackground: true });
  await p.close();
  console.log(file + ": " + lato + " px");
}
await immagine("grafica/icona.png", 256, 0);
await immagine("build/icon-mac.png", 1024, 100);   // macOS: disegno di 824 px al centro di 1024
await immagine("build/icon-win.png", 1024, 0);
await browser.close();
