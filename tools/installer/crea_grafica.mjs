// Crea la grafica del programma di installazione per Windows:
//   anteprima/build/icon.ico              icona del gioco, dell'installazione e della disinstallazione
//   anteprima/build/installerSidebar.bmp  immagine a sinistra nelle pagine "Benvenuto" e "Fine" (164 x 314)
//   anteprima/build/installerHeader.bmp   immagine in alto a destra nelle altre pagine (150 x 57)
//
// I disegni sono scritti qui sotto in SVG (originali MRW). Per cambiarli: modifica l'SVG e rilancia
//   node tools/installer/crea_grafica.mjs
// Serve Playwright (lo stesso usato da tools/anteprima_prova): "npm install playwright" in questa cartella,
// oppure, se e' installato per tutto il computer:  NODE_PATH=$(npm root -g) node tools/installer/crea_grafica.mjs

import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const { chromium } = createRequire(import.meta.url)("playwright");

const qui = path.dirname(fileURLToPath(import.meta.url));
const uscita = path.resolve(qui, "..", "..", "anteprima", "build");

const ROSSO = "#d81e2c";
const NERO = "#15171c";

// Montagne, lago e strada a curve: il Ticino visto dalla moto. Disegnato in un riquadro 0..100.
function paesaggio(sole = true) {
  return `
    <defs>
      <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2f6fb5"/><stop offset="1" stop-color="#9cc3e6"/>
      </linearGradient>
      <linearGradient id="lago" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3f86c4"/><stop offset="1" stop-color="#1f4f86"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#cielo)"/>
    ${sole ? '<circle cx="76" cy="22" r="9" fill="#ffe9a8"/>' : ""}
    <path d="M-5 62 L18 30 L30 44 L46 20 L64 46 L78 34 L105 62 Z" fill="#5d7d8f"/>
    <path d="M46 20 L52 29 L47 27 L43 31 L40 29 Z" fill="#ffffff"/>
    <path d="M18 30 L22 36 L18 35 L15 38 L13 37 Z" fill="#ffffff"/>
    <path d="M-5 66 L20 48 L44 60 L70 46 L105 64 L105 70 L-5 70 Z" fill="#35604a"/>
    <rect x="-5" y="64" width="110" height="14" fill="url(#lago)"/>
    <path d="M-5 74 Q30 66 60 72 T105 70 L105 105 L-5 105 Z" fill="#2f7a3f"/>
    <path d="M34 105 C40 92 72 92 64 82 C58 75 44 77 50 71 L54 71 C50 76 66 75 72 82 C82 93 54 93 62 105 Z" fill="${NERO}"/>
    <path d="M48 104 C52 93 79 92 68 82" fill="none" stroke="#ffffff" stroke-width="1.1" stroke-dasharray="3 3"/>`;
}

// Icona: riquadro arrotondato con il paesaggio e la scritta MRW.
// Sotto i 48 punti il paesaggio non si leggerebbe: restano la scritta e, da 32 punti, due montagne.
function svgIcona(lato) {
  let corpo;
  if (lato < 32) {
    corpo = `<rect width="100" height="100" fill="${ROSSO}"/>
       <rect x="0" y="78" width="100" height="22" fill="${NERO}"/>
       <text x="50" y="66" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="46"
             text-anchor="middle" fill="#ffffff" textLength="90" lengthAdjust="spacingAndGlyphs">MRW</text>`;
  } else if (lato < 48) {
    corpo = `<rect width="100" height="100" fill="${ROSSO}"/>
       <path d="M0 100 L0 70 L30 38 L48 58 L66 30 L100 68 L100 100 Z" fill="${NERO}"/>
       <text x="50" y="92" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="40"
             text-anchor="middle" fill="#ffffff" textLength="88" lengthAdjust="spacingAndGlyphs">MRW</text>`;
  } else {
    // il paesaggio sta sotto la fascia nera, un po' schiacciato in altezza; il sole si disegna a parte (resta tondo)
    corpo = `<svg x="0" y="30" width="100" height="70" viewBox="0 8 100 92" preserveAspectRatio="none">${paesaggio(false)}</svg>
       <circle cx="80" cy="44" r="7" fill="#ffe9a8"/>
       <rect x="0" y="0" width="100" height="27" fill="${NERO}"/>
       <rect x="0" y="27" width="100" height="3" fill="${ROSSO}"/>
       <text x="50" y="21.5" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="22"
             text-anchor="middle" fill="#ffffff" textLength="80" lengthAdjust="spacingAndGlyphs">MRW</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 100 100">
    <defs><clipPath id="bordo"><rect width="100" height="100" rx="20"/></clipPath></defs>
    <g clip-path="url(#bordo)">${corpo}</g>
  </svg>`;
}

// Fascia verticale delle pagine "Benvenuto" e "Fine"
function svgFascia() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
    <rect width="164" height="314" fill="${NERO}"/>
    <svg x="0" y="88" width="164" height="226" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${paesaggio()}</svg>
    <rect x="0" y="0" width="164" height="84" fill="${NERO}"/>
    <rect x="0" y="84" width="164" height="4" fill="${ROSSO}"/>
    <text x="82" y="40" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="19"
          text-anchor="middle" fill="#ffffff">MOTO RACING</text>
    <text x="82" y="64" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="26"
          text-anchor="middle" fill="${ROSSO}">WORLD</text>
    <rect x="0" y="282" width="164" height="32" fill="${NERO}" opacity="0.82"/>
    <text x="82" y="303" font-family="Inter, DejaVu Sans, sans-serif" font-weight="600" font-size="12"
          text-anchor="middle" fill="#ffffff">Anteprima Ticino</text>
  </svg>`;
}

// Riquadro in alto a destra delle altre pagine (fondo bianco come la pagina)
function svgTestata() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
    <rect width="150" height="57" fill="#ffffff"/>
    <svg x="99" y="6" width="45" height="45" viewBox="0 0 100 100">
      <defs><clipPath id="b2"><rect width="100" height="100" rx="20"/></clipPath></defs>
      <g clip-path="url(#b2)">${paesaggio()}</g>
    </svg>
    <text x="92" y="27" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="11"
          text-anchor="end" fill="${NERO}">MOTO RACING</text>
    <text x="92" y="42" font-family="Inter, DejaVu Sans, sans-serif" font-weight="800" font-size="14"
          text-anchor="end" fill="${ROSSO}">WORLD</text>
  </svg>`;
}

// Disegna un SVG nel browser e restituisce i punti (RGBA) e il PNG
async function disegna(pagina, svg, larghezza, altezza) {
  return pagina.evaluate(async function ({ svg, larghezza, altezza }) {
    const immagine = new Image();
    immagine.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await immagine.decode();
    const tela = document.createElement("canvas");
    tela.width = larghezza;
    tela.height = altezza;
    const penna = tela.getContext("2d");
    penna.drawImage(immagine, 0, 0, larghezza, altezza);
    return {
      punti: Array.from(penna.getImageData(0, 0, larghezza, altezza).data),
      png: tela.toDataURL("image/png").split(",")[1]
    };
  }, { svg, larghezza, altezza });
}

// File .bmp a 24 bit (quello che vuole il programma di installazione): righe dal basso, colori B G R
function bmp24(punti, larghezza, altezza) {
  const riga = Math.ceil((larghezza * 3) / 4) * 4;
  const file = Buffer.alloc(54 + riga * altezza);
  file.write("BM", 0);
  file.writeUInt32LE(file.length, 2);
  file.writeUInt32LE(54, 10);
  file.writeUInt32LE(40, 14);
  file.writeInt32LE(larghezza, 18);
  file.writeInt32LE(altezza, 22);
  file.writeUInt16LE(1, 26);
  file.writeUInt16LE(24, 28);
  file.writeUInt32LE(riga * altezza, 34);
  file.writeInt32LE(2835, 38);
  file.writeInt32LE(2835, 42);
  for (let y = 0; y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) {
      const da = (y * larghezza + x) * 4;
      const a = 54 + (altezza - 1 - y) * riga + x * 3;
      file[a] = punti[da + 2];
      file[a + 1] = punti[da + 1];
      file[a + 2] = punti[da];
    }
  }
  return file;
}

// Una grandezza dell'icona nel formato classico di Windows (32 bit con trasparenza)
function immagineIco(punti, lato) {
  const maschera = Math.ceil(lato / 32) * 4;
  const dati = Buffer.alloc(40 + lato * lato * 4 + maschera * lato);
  dati.writeUInt32LE(40, 0);
  dati.writeInt32LE(lato, 4);
  dati.writeInt32LE(lato * 2, 8);       // altezza doppia: disegno + maschera
  dati.writeUInt16LE(1, 12);
  dati.writeUInt16LE(32, 14);
  dati.writeUInt32LE(lato * lato * 4 + maschera * lato, 20);
  for (let y = 0; y < lato; y++) {
    for (let x = 0; x < lato; x++) {
      const da = (y * lato + x) * 4;
      const a = 40 + ((lato - 1 - y) * lato + x) * 4;
      dati[a] = punti[da + 2];
      dati[a + 1] = punti[da + 1];
      dati[a + 2] = punti[da];
      dati[a + 3] = punti[da + 3];
    }
  }
  return dati;
}

function fileIco(immagini) {
  const testata = Buffer.alloc(6 + immagini.length * 16);
  testata.writeUInt16LE(1, 2);
  testata.writeUInt16LE(immagini.length, 4);
  let posizione = testata.length;
  immagini.forEach(function (immagine, i) {
    const inizio = 6 + i * 16;
    testata[inizio] = immagine.lato === 256 ? 0 : immagine.lato;
    testata[inizio + 1] = immagine.lato === 256 ? 0 : immagine.lato;
    testata.writeUInt16LE(1, inizio + 4);
    testata.writeUInt16LE(32, inizio + 6);
    testata.writeUInt32LE(immagine.dati.length, inizio + 8);
    testata.writeUInt32LE(posizione, inizio + 12);
    posizione += immagine.dati.length;
  });
  return Buffer.concat([testata].concat(immagini.map(function (immagine) {
    return immagine.dati;
  })));
}

const browser = await chromium.launch();
const pagina = await browser.newPage();
fs.mkdirSync(uscita, { recursive: true });

const immagini = [];
for (const lato of [16, 24, 32, 48, 64, 128, 256]) {
  const disegno = await disegna(pagina, svgIcona(lato), lato, lato);
  // 256 punti: dentro il .ico va come PNG (lo vuole Windows); le altre nel formato classico
  const dati = lato === 256 ? Buffer.from(disegno.png, "base64") : immagineIco(disegno.punti, lato);
  immagini.push({ lato: lato, dati: dati });
}
fs.writeFileSync(path.join(uscita, "icon.ico"), fileIco(immagini));

const fascia = await disegna(pagina, svgFascia(), 164, 314);
fs.writeFileSync(path.join(uscita, "installerSidebar.bmp"), bmp24(fascia.punti, 164, 314));

const testata = await disegna(pagina, svgTestata(), 150, 57);
fs.writeFileSync(path.join(uscita, "installerHeader.bmp"), bmp24(testata.punti, 150, 57));

await browser.close();
console.log("Grafica creata in " + uscita);
