// Prestazioni: contatore FPS (tasto F) e test automatico.
// Il test fa volare la telecamera sopra il pilota per 40 secondi
// (citta', lago, boschi in collina) e misura gli FPS.

import * as THREE from "three";
import { quotaTerreno } from "./terreno.js";
import { QUALITA, qualitaSalvata } from "./impostazioni.js";

const elFps = document.getElementById("fps");
let mostraFps = false;
let fotogrammi = 0;
let tempo = 0;

window.addEventListener("keydown", function (evento) {
  if (evento.code === "KeyF") {
    mostraFps = !mostraFps;
    elFps.style.display = mostraFps ? "block" : "none";
  }
});

export function aggiornaFps(dt, disegnatore) {
  fotogrammi = fotogrammi + 1;
  tempo = tempo + dt;
  if (tempo >= 0.5) {
    if (mostraFps) {
      const info = disegnatore.info.render;
      elFps.textContent = Math.round(fotogrammi / tempo) + " FPS · " +
        Math.round(info.triangles / 1000) + "k triangoli · " + info.calls + " disegni";
    }
    fotogrammi = 0;
    tempo = 0;
  }
}

// Percorso del test (metri, coordinate dell'anteprima)
const PERCORSO = [
  [733, -141],     // partenza, Locarno
  [500, -100],     // Piazza Grande
  [-1100, 1350],   // Ascona
  [-2500, -1900],  // Ponte Brolla
  [1000, -1500],   // collina sopra Orselina (bosco)
  [2500, -700],    // Minusio
  [733, -141]      // ritorno
];
const DURATA = 40;

export function creaTest() {
  return { attivo: false, tempo: 0, tempiFotogrammi: [], triangoliMax: 0, disegniMax: 0, risultato: null };
}

export function avviaTest(test) {
  test.attivo = true;
  test.tempo = 0;
  test.tempiFotogrammi = [];
  test.triangoliMax = 0;
  test.disegniMax = 0;
  document.getElementById("testInCorso").style.display = "block";
}

// Ritorna la posizione (x, z) della telecamera durante il test
export function aggiornaTest(test, dt, telecamera, terreno, disegnatore) {
  test.tempo = test.tempo + dt;
  test.tempiFotogrammi.push(dt);
  test.triangoliMax = Math.max(test.triangoliMax, disegnatore.info.render.triangles);
  test.disegniMax = Math.max(test.disegniMax, disegnatore.info.render.calls);

  const avanzamento = Math.min(test.tempo / DURATA, 0.9999) * (PERCORSO.length - 1);
  const i = Math.floor(avanzamento);
  const f = avanzamento - i;
  const x = PERCORSO[i][0] + (PERCORSO[i + 1][0] - PERCORSO[i][0]) * f;
  const z = PERCORSO[i][1] + (PERCORSO[i + 1][1] - PERCORSO[i][1]) * f;
  const y = quotaTerreno(terreno, x, z) + 45;
  const avantiX = PERCORSO[i + 1][0] - PERCORSO[i][0];
  const avantiZ = PERCORSO[i + 1][1] - PERCORSO[i][1];
  const lunghezza = Math.hypot(avantiX, avantiZ) || 1;
  telecamera.position.set(x, y, z);
  telecamera.lookAt(x + (avantiX / lunghezza) * 100, y - 25, z + (avantiZ / lunghezza) * 100);

  document.getElementById("testInCorso").textContent =
    "Test prestazioni... " + Math.round((test.tempo / DURATA) * 100) + "%";

  if (test.tempo >= DURATA) {
    test.attivo = false;
    document.getElementById("testInCorso").style.display = "none";
    mostraRisultato(test);
  }
  return { x: x, z: z };
}

async function mostraRisultato(test) {
  let versione = "";
  if (window.aggiornamenti) versione = await window.aggiornamenti.versione();
  // Tolgo il primo secondo (caricamento degli alberi all'inizio)
  const tempi = test.tempiFotogrammi.slice(30).sort(function (a, b) { return a - b; });
  const media = tempi.length / tempi.reduce(function (s, t) { return s + t; }, 0);
  const lento = tempi[Math.floor(tempi.length * 0.99)] || tempi[tempi.length - 1];   // 1% piu' lenti
  const memoria = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB" : "n.d.";
  const testo = [
    "MOTO RACING WORLD - Anteprima Ticino " + versione,
    "Test prestazioni (40 s sopra il pilota di Locarno)",
    "Qualita': " + QUALITA[qualitaSalvata()].nome,
    "Schermo: " + window.innerWidth + " x " + window.innerHeight + " (pixel ratio " + window.devicePixelRatio + ")",
    "FPS medi: " + Math.round(media),
    "FPS nell'1% dei momenti piu' lenti: " + Math.round(1 / lento),
    "Triangoli al massimo: " + Math.round(test.triangoliMax / 1000) + "k",
    "Disegni (draw call) al massimo: " + test.disegniMax,
    "Memoria JavaScript: " + memoria,
    "Computer: " + navigator.platform + " · " + navigator.userAgent.split(") ")[0].split("(")[1]
  ].join("\n");
  test.risultato = testo;
  document.getElementById("testoRisultato").textContent = testo;
  document.getElementById("risultatoTest").style.display = "block";
}

export function preparaRisultato() {
  document.getElementById("copiaRisultato").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    navigator.clipboard.writeText(document.getElementById("testoRisultato").textContent);
    evento.currentTarget.textContent = "Copiato!";
  });
  document.getElementById("chiudiRisultato").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    document.getElementById("risultatoTest").style.display = "none";
  });
}
