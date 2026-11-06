// MOTO RACING WORLD - Anteprima Ticino
// File principale: crea la scena, carica i dati e fa girare il gioco.

import * as THREE from "three";
import { caricaTerreno, aggiungiTerreno, quotaTerreno, aggiornaTerreno, preparaTerrenoVicino } from "./terreno.js";
import { caricaStrade, aggiungiStrade, puntoStradaVicino } from "./strade.js";
import { creaMoto, posizionaMoto, aggiornaMoto } from "./moto.js";
import { motoSalvata, preparaGarage } from "./garage.js";
import { aggiornaSuono } from "./audio.js";
import { caricaEdifici, aggiungiEdifici, dentroEdificio } from "./edifici.js";
import { caricaAlberiSingoli, creaAlberi, aggiornaAlberi } from "./alberi.js";
import { caricaDettagli, aggiungiDettagli, localitaVicina } from "./dettagli.js";
import { caricaAcqua, aggiungiAcqua } from "./acqua.js";
import { aggiungiOpere } from "./opere.js";
import { caricaTrasporti, aggiungiTrasporti, aggiornaTrasporti } from "./trasporti.js";
import { applicaQualita, preparaMenu, qualitaSalvata } from "./impostazioni.js";
import { aggiornaFps, creaTest, avviaTest, aggiornaTest, preparaRisultato } from "./prestazioni.js";
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
  if (moto.inGalleria) {
    // in galleria la telecamera resta bassa, sotto il soffitto
    dietro = 6;
    alto = 2.2;
  }

  if (modoTelecamera === 2) {
    // Dal casco del pilota
    telecamera.position.set(moto.x + dirX * 0.1, moto.y + 1.55, moto.z + dirZ * 0.1);
    telecamera.lookAt(moto.x + dirX * 20, moto.y + 1.2, moto.z + dirZ * 20);
    return;
  }

  const obiettivo = new THREE.Vector3(moto.x - dirX * dietro, moto.y + alto, moto.z - dirZ * dietro);
  // La telecamera non deve finire sotto il terreno
  if (!moto.inGalleria) {
    obiettivo.y = Math.max(obiettivo.y, quotaTerreno(terreno, obiettivo.x, obiettivo.z) + 1.5);
  }

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
  if (bloccata || moto.inGalleria) {
    // contro un muro o in galleria: niente movimento morbido, la telecamera resta dentro
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
    const terrenoMesh = aggiungiTerreno(terreno, scena, disegnatore);

    mostraStato("Caricamento delle strade (OpenStreetMap)...");
    const strade = await caricaStrade();
    aggiungiStrade(strade, scena, terreno);
    aggiungiOpere(strade, scena, terreno);

    mostraStato("Fiumi e torrenti...");
    aggiungiAcqua(await caricaAcqua(), scena, terreno);

    mostraStato("Caricamento degli edifici (OpenStreetMap)...");
    const edifici = await caricaEdifici();
    aggiungiEdifici(edifici, scena);

    mostraStato("Treni, funicolari e teleferiche...");
    const trasporti = await caricaTrasporti();
    const mobili = aggiungiTrasporti(trasporti, scena);

    mostraStato("Segnaletica e lampioni...");
    const dettagli = await caricaDettagli();
    aggiungiDettagli(dettagli, scena, terreno, strade);
    preparaMinimappa(strade, terreno, dettagli.localita, trasporti);

    mostraStato("Preparazione dei boschi...");
    const alberi = creaAlberi(scena, terreno, strade, edifici, await caricaAlberiSingoli());

    const moto = creaMoto(scena, motoSalvata());
    const partenzaX = PARTENZA_EST - terreno.info.centro_lv95[0];
    const partenzaZ = -(PARTENZA_NORD - terreno.info.centro_lv95[1]);
    mettiSullaStrada(moto, strade, partenzaX, partenzaZ);
    telecamera.position.set(moto.x, moto.y + 30, moto.z + 40);
    preparaTerrenoVicino(terrenoMesh, moto.x, moto.z);

    // Impostazioni e test delle prestazioni
    const mondo = { disegnatore: disegnatore, telecamera: telecamera, scena: scena, alberi: alberi, terrenoMesh: terrenoMesh };
    applicaQualita(qualitaSalvata(), mondo);
    const test = creaTest();
    preparaMenu(mondo, function () {
      avviaTest(test);
    });
    preparaRisultato();
    preparaGarage(moto);

    nascondiCaricamento();
    const orologio = new THREE.Clock();
    let tempoGioco = 0;

    function ciclo() {
      const vero = orologio.getDelta();          // tempo vero del fotogramma (per gli FPS)
      const dt = Math.min(vero, 0.05);           // tempo per la fisica (mai troppo grande)
      if (richiestaReset) {
        mettiSullaStrada(moto, strade, moto.x, moto.z);
        richiestaReset = false;
      }
      if (test.attivo) {
        // durante il test la telecamera vola da sola
        const punto = aggiornaTest(test, vero, telecamera, terreno, disegnatore);
        aggiornaAlberi(alberi, punto.x, punto.z, dt);
        aggiornaTerreno(terrenoMesh, punto.x, punto.z, vero);
      } else {
        aggiornaMoto(moto, tasti, dt, terreno, strade, edifici);
        aggiornaAlberi(alberi, moto.x, moto.z, dt);
        aggiornaTerreno(terrenoMesh, moto.x, moto.z, vero);
        aggiornaTelecamera(moto, terreno, edifici, dt);
      }
      tempoGioco = tempoGioco + vero;
      aggiornaTrasporti(mobili, tempoGioco);
      aggiornaSuono(moto, test.attivo);
      aggiornaFps(vero, disegnatore);
      aggiornaInterfaccia(moto, terreno, localitaVicina(dettagli, moto.x, moto.z));
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
