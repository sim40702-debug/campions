// MOTO RACING WORLD - Anteprima Ticino
// File principale: crea la scena, carica i dati e fa girare il gioco.

import * as THREE from "three";
import { caricaTerreno, aggiungiTerreno, quotaTerreno } from "./terreno.js";
import { caricaStrade, aggiungiStrade, puntoStradaVicino } from "./strade.js";
import { creaMoto, posizionaMoto, aggiornaMoto } from "./moto.js";
import { caricaEdifici, aggiungiEdifici, dentroEdificio } from "./edifici.js";
import { caricaAlberiSingoli, creaAlberi, aggiornaAlberi } from "./alberi.js";
import { preparaMinimappa, aggiornaInterfaccia, mostraStato, nascondiCaricamento } from "./interfaccia.js";

// Punto di partenza: Piazza Grande, Locarno (coordinate LV95)
const PARTENZA_EST = 2704700;
const PARTENZA_NORD = 1114200;

// --- Scena, telecamera, luci ---------------------------------------------------
const scena = new THREE.Scene();
scena.background = new THREE.Color(0x9cc3e6);
scena.fog = new THREE.Fog(0x9cc3e6, 1500, 7000);

const telecamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 9000);

const disegnatore = new THREE.WebGLRenderer({ antialias: true });
disegnatore.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
disegnatore.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(disegnatore.domElement);

scena.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.2));
const sole = new THREE.DirectionalLight(0xffffff, 1.6);
sole.position.set(-0.5, 1, 0.3);
scena.add(sole);

window.addEventListener("resize", function () {
  telecamera.aspect = window.innerWidth / window.innerHeight;
  telecamera.updateProjectionMatrix();
  disegnatore.setSize(window.innerWidth, window.innerHeight);
});

// --- Tastiera ------------------------------------------------------------------
const tasti = { su: false, giu: false, sinistra: false, destra: false };
let modoTelecamera = 0;   // 0 = dietro, 1 = alta, 2 = casco
let richiestaReset = false;

function cambiaTasto(evento, premuto) {
  const codice = evento.code;
  if (codice === "ArrowUp" || codice === "KeyW") tasti.su = premuto;
  if (codice === "ArrowDown" || codice === "KeyS") tasti.giu = premuto;
  if (codice === "ArrowLeft" || codice === "KeyA") tasti.sinistra = premuto;
  if (codice === "ArrowRight" || codice === "KeyD") tasti.destra = premuto;
  if (codice.startsWith("Arrow")) evento.preventDefault();
}

window.addEventListener("keydown", function (evento) {
  cambiaTasto(evento, true);
  if (evento.code === "KeyC") modoTelecamera = (modoTelecamera + 1) % 3;
  if (evento.code === "KeyR") richiestaReset = true;
  if (evento.code === "KeyH") {
    const aiuto = document.getElementById("aiuto");
    aiuto.style.display = aiuto.style.display === "none" ? "block" : "none";
  }
});
window.addEventListener("keyup", function (evento) {
  cambiaTasto(evento, false);
});

// --- Telecamera che segue la moto ---------------------------------------------
function aggiornaTelecamera(moto, terreno, edifici, dt) {
  const dirX = -Math.sin(moto.angolo);
  const dirZ = -Math.cos(moto.angolo);
  let dietro = 7;
  let alto = 2.8;
  if (modoTelecamera === 1) {
    dietro = 22;
    alto = 10;
  }

  if (modoTelecamera === 2) {
    // Dal casco del pilota
    telecamera.position.set(moto.x + dirX * 0.1, moto.y + 1.55, moto.z + dirZ * 0.1);
    telecamera.lookAt(moto.x + dirX * 20, moto.y + 1.2, moto.z + dirZ * 20);
    return;
  }

  const obiettivo = new THREE.Vector3(moto.x - dirX * dietro, moto.y + alto, moto.z - dirZ * dietro);
  // La telecamera non deve finire sotto il terreno
  obiettivo.y = Math.max(obiettivo.y, quotaTerreno(terreno, obiettivo.x, obiettivo.z) + 1.5);

  // ...e nemmeno dentro un edificio: se tra la moto e la telecamera c'e' un muro,
  // la telecamera si ferma prima del muro
  const testa = new THREE.Vector3(moto.x, moto.y + 1.6, moto.z);
  const punto = new THREE.Vector3();
  let bloccata = false;
  for (let passo = 1; passo <= 20; passo++) {
    punto.lerpVectors(testa, obiettivo, passo / 20);
    if (dentroEdificio(edifici, punto.x, punto.z, punto.y)) {
      obiettivo.lerpVectors(testa, obiettivo, Math.max(0, (passo - 1.5) / 20));
      bloccata = true;
      break;
    }
  }
  if (bloccata) {
    telecamera.position.copy(obiettivo);
  } else {
    telecamera.position.lerp(obiettivo, 1 - Math.exp(-dt * 5));
  }
  telecamera.lookAt(moto.x + dirX * 4, moto.y + 1.2, moto.z + dirZ * 4);
}

function mettiSullaStrada(moto, strade, x, z) {
  const punto = puntoStradaVicino(strade, x, z);
  if (punto) {
    posizionaMoto(moto, punto.x, punto.y, punto.z, punto.dx, punto.dz);
  }
}

// --- Avvio ---------------------------------------------------------------------
async function avvia() {
  try {
    mostraStato("Caricamento del terreno (swisstopo)...");
    const terreno = await caricaTerreno();
    aggiungiTerreno(terreno, scena);

    mostraStato("Caricamento delle strade (OpenStreetMap)...");
    const strade = await caricaStrade();
    aggiungiStrade(strade, scena);
    preparaMinimappa(strade, terreno);

    mostraStato("Caricamento degli edifici (OpenStreetMap)...");
    const edifici = await caricaEdifici();
    aggiungiEdifici(edifici, scena);

    mostraStato("Preparazione dei boschi...");
    const alberi = creaAlberi(scena, terreno, strade, edifici, await caricaAlberiSingoli());

    const moto = creaMoto(scena);
    const partenzaX = PARTENZA_EST - terreno.info.centro_lv95[0];
    const partenzaZ = -(PARTENZA_NORD - terreno.info.centro_lv95[1]);
    mettiSullaStrada(moto, strade, partenzaX, partenzaZ);
    telecamera.position.set(moto.x, moto.y + 30, moto.z + 40);

    nascondiCaricamento();
    const orologio = new THREE.Clock();

    function ciclo() {
      const dt = Math.min(orologio.getDelta(), 0.05);
      if (richiestaReset) {
        mettiSullaStrada(moto, strade, moto.x, moto.z);
        richiestaReset = false;
      }
      aggiornaMoto(moto, tasti, dt, terreno, strade, edifici);
      aggiornaAlberi(alberi, moto.x, moto.z, dt);
      aggiornaTelecamera(moto, terreno, edifici, dt);
      aggiornaInterfaccia(moto, terreno);
      disegnatore.render(scena, telecamera);
      requestAnimationFrame(ciclo);
    }
    ciclo();
  } catch (errore) {
    mostraStato("Errore: " + errore.message);
    console.error(errore);
  }
}

avvia();
