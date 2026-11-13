// Crea il logo del gioco e le icone dell'app.
//   node tools/icona/crea_icona.mjs
//
// Il logo e' disegnato qui sotto (nessun file esterno): una moto vista dal basso, con la ruota dietro che gira
// in primo piano e il fumo della sgommata. Lo script scrive:
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

// --- La ruota dietro, vista da vicino e dal basso: gomma con i tasselli, cerchio rosso, strisce della rotazione ---
const RX = 420, RY = 628, RR = 300;            // centro e raggio della ruota dietro
const AX = 852, AY = 768, AR = 122;            // ruota davanti: lontana, quindi piccola e piu' bassa
function sulCerchio(cx, cy, raggio, gradi) {
  const a = (gradi * Math.PI) / 180;
  return n(cx + raggio * Math.cos(a)) + "," + n(cy + raggio * Math.sin(a));
}
const arcoDi = (cx, cy, raggio, da, a) => "M" + sulCerchio(cx, cy, raggio, da) + "A" + raggio + "," + raggio + " 0 " + (a - da > 180 ? 1 : 0) + " 1 " + sulCerchio(cx, cy, raggio, a);
let tasselli = "";
for (let g = 0; g < 360; g += 15) tasselli += "M" + sulCerchio(RX, RY, RR - 6, g) + "L" + sulCerchio(RX, RY, RR - 40, g + 7);
// la ruota gira: archi sfumati al posto dei raggi (non si distinguono piu')
let giro = "";
const archi = [[232, 20, 110, 9, 0.9], [206, 150, 215, 13, 0.75], [178, 250, 330, 9, 0.85], [150, 60, 150, 14, 0.6], [122, 200, 300, 9, 0.8], [96, 330, 420, 12, 0.6]];
for (const [raggio, da, a, spessore, opaco] of archi) giro += `<path d="${arcoDi(RX, RY, raggio, da, a)}" stroke-width="${spessore}" stroke-opacity="${opaco}"/>`;

// --- Il fumo della sgommata: nuvole tonde che partono da dove la gomma tocca terra e salgono dietro ---
const nuvole = [
  // [x, y, raggio, colore]  prima quelle dietro (scure), poi quelle davanti (chiare)
  [60, 500, 150, "#5d6c80"], [215, 392, 112, "#5d6c80"], [-20, 760, 180, "#5d6c80"], [120, 300, 70, "#5d6c80"],
  [110, 690, 150, "#aab6c4"], [20, 900, 160, "#aab6c4"], [200, 560, 96, "#aab6c4"],
  [210, 880, 130, "#eef2f6"], [80, 985, 120, "#eef2f6"], [345, 960, 96, "#eef2f6"],
  [478, 985, 64, "#eef2f6"], [262, 745, 70, "#eef2f6"], [580, 1000, 42, "#eef2f6"]
];
let fumoDietro = "", fumoDavanti = "";
nuvole.forEach(function ([x, y, raggio, colore], i) {
  const cerchio = `<circle cx="${x}" cy="${y}" r="${raggio}" fill="${colore}"/>`;
  if (i < 7) fumoDietro += cerchio; else fumoDavanti += cerchio;
});

const disegno = `
  <defs>
    <linearGradient id="mrwCielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a3a52"/><stop offset="0.65" stop-color="#18212e"/><stop offset="1" stop-color="#0e1319"/>
    </linearGradient>
    <radialGradient id="mrwBagliore" cx="0.62" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd75a" stop-opacity="0.34"/><stop offset="0.5" stop-color="#ff4650" stop-opacity="0.16"/><stop offset="1" stop-color="#ff4650" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mrwCarena" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff5a63"/><stop offset="1" stop-color="#c8222d"/>
    </linearGradient>
    <clipPath id="mrwForma"><rect width="1024" height="1024" rx="228"/></clipPath>
  </defs>
  <g clip-path="url(#mrwForma)">
    <rect width="1024" height="1024" fill="url(#mrwCielo)"/>
    <rect width="1024" height="1024" fill="url(#mrwBagliore)"/>
    <rect x="0" y="926" width="1024" height="98" fill="#0b0f14"/>
    ${fumoDietro}
    <!-- ruota davanti e forcella (lontane) -->
    <circle cx="${AX}" cy="${AY}" r="${AR}" fill="#0b0f14"/>
    <circle cx="${AX}" cy="${AY}" r="${AR - 40}" fill="none" stroke="#3a4658" stroke-width="10"/>
    <circle cx="${AX}" cy="${AY}" r="20" fill="#3a4658"/>
    <path d="M748,452 L${AX},${AY}" stroke="#aab4c0" stroke-width="30" stroke-linecap="round"/>
    <!-- pancia della moto vista da sotto: motore e scarico -->
    <path d="M470,470 L760,500 L800,640 L690,720 L520,700 L${RX},${RY} Z" fill="#1c2633"/>
    <path d="M${RX},${RY} L640,600 L700,676 L${RX + 10},${RY + 46} Z" fill="#3a4658"/>
    <path d="M560,690 L770,650 L800,690 L590,742 Z" fill="#aab4c0"/>
    <!-- carena: codone in alto, serbatoio, muso -->
    <path d="M250,214 L480,286 L560,262 L700,300 L800,410 L776,520 L640,540 L470,470 L350,372 Z" fill="url(#mrwCarena)"/>
    <path d="M250,214 L330,239 L420,330 L350,372 Z" fill="#a51b25"/>
    <path d="M330,239 L480,286 L560,262 L520,318 L420,330 Z" fill="#18212e"/>
    <path d="M700,300 L800,410 L776,520 L716,452 Z" fill="#ffd75a"/>
    <path d="M664,286 L742,236" stroke="#e8edf3" stroke-width="22" stroke-linecap="round"/>
    <!-- ruota dietro, vicina -->
    <circle cx="${RX}" cy="${RY}" r="${RR}" fill="#0b0f14"/>
    <circle cx="${RX}" cy="${RY}" r="${RR}" fill="none" stroke="#3a4658" stroke-width="8"/>
    <path d="${tasselli}" fill="none" stroke="#2c3848" stroke-width="14" stroke-linecap="round"/>
    <circle cx="${RX}" cy="${RY}" r="${RR - 52}" fill="#18212e"/>
    <circle cx="${RX}" cy="${RY}" r="${RR - 62}" fill="none" stroke="#ff4650" stroke-width="22"/>
    <g fill="none" stroke="#e8edf3" stroke-linecap="round">${giro}</g>
    <circle cx="${RX}" cy="${RY}" r="62" fill="#3a4658"/>
    <circle cx="${RX}" cy="${RY}" r="30" fill="#ffd75a"/>
    ${fumoDavanti}
    <!-- strisce della rotazione fuori dalla gomma -->
    <g fill="none" stroke="#e8edf3" stroke-linecap="round" stroke-opacity="0.85">
      <path d="${arcoDi(RX, RY, RR + 34, 196, 232)}" stroke-width="12"/>
      <path d="${arcoDi(RX, RY, RR + 66, 206, 226)}" stroke-width="9"/>
    </g>
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
