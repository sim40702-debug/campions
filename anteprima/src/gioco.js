// MOTO RACING WORLD - Anteprima Ticino
// File principale: crea la scena, carica i dati e fa girare il gioco.

import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { caricaModelli3D } from "./modelli3d.js";
import { caricaTerreno, aggiungiTerreno, quotaTerreno, aggiornaTerreno, preparaTerrenoVicino } from "./terreno.js";
import { caricaStrade, aggiungiStrade, puntoStradaVicino } from "./strade.js";
import { creaMoto, posizionaMoto, aggiornaMoto } from "./moto.js";
import { motoSalvata, preparaGarage } from "./garage.js";
import { partenzaSalvata, preparaPartenza } from "./partenza.js";
import { aggiornaSuono } from "./audio.js";
import { creaDanni, aggiornaDanni } from "./danni.js";
import { creaSegni, lasciaSegno, staccaSegno } from "./segni.js";
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

// Colori come al cinema (tone mapping) e riflessi sui metalli della moto (ambiente)
disegnatore.toneMapping = THREE.ACESFilmicToneMapping;
disegnatore.toneMappingExposure = 1.15;
const generatore = new THREE.PMREMGenerator(disegnatore);
scena.environment = generatore.fromScene(new RoomEnvironment(), 0.04).texture;
scena.environmentIntensity = 0.35;

scena.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.2));
const DIREZIONE_SOLE = new THREE.Vector3(-0.5, 1, 0.3).normalize();
const sole = new THREE.DirectionalLight(0xfff4e0, 2.2);
sole.position.copy(DIREZIONE_SOLE);
scena.add(sole);
scena.add(sole.target);

// Ombre: solo vicino alla moto (40 x 40 m), cosi' costano poco
disegnatore.shadowMap.enabled = true;
disegnatore.shadowMap.type = THREE.PCFSoftShadowMap;
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
sole.shadow.camera.left = -20;
sole.shadow.camera.right = 20;
sole.shadow.camera.top = 20;
sole.shadow.camera.bottom = -20;
sole.shadow.camera.near = 1;
sole.shadow.camera.far = 150;
sole.shadow.bias = -0.0005;
sole.shadow.normalBias = 0.03;

// Cielo vero (scattering dell'atmosfera) con il sole nella stessa direzione della luce
const cielo = new Sky();
cielo.scale.setScalar(6000);
cielo.material.uniforms.turbidity.value = 4;
cielo.material.uniforms.rayleigh.value = 1.2;
cielo.material.uniforms.mieCoefficient.value = 0.004;
cielo.material.uniforms.mieDirectionalG.value = 0.8;
cielo.material.uniforms.sunPosition.value.copy(DIREZIONE_SOLE);
scena.add(cielo);

window.addEventListener("resize", function () {
  telecamera.aspect = window.innerWidth / window.innerHeight;
  telecamera.updateProjectionMatrix();
  disegnatore.setSize(window.innerWidth, window.innerHeight);
});

// --- Tastiera ------------------------------------------------------------------
const tasti = { su: false, giu: false, sinistra: false, destra: false, frenoDietro: false, pesoDietro: false, pesoAvanti: false };
let modoTelecamera = 0;   // 0 = dietro, 1 = alta, 2 = casco
let richiestaReset = false;

function cambiaTasto(evento, premuto) {
  const codice = evento.code;
  if (codice === "ArrowUp" || codice === "KeyW") tasti.su = premuto;
  if (codice === "ArrowDown" || codice === "KeyS") tasti.giu = premuto;
  if (codice === "ArrowLeft" || codice === "KeyA") tasti.sinistra = premuto;
  if (codice === "ArrowRight" || codice === "KeyD") tasti.destra = premuto;
  if (codice === "Space") tasti.frenoDietro = premuto;
  if (codice === "ShiftLeft" || codice === "ShiftRight") tasti.pesoDietro = premuto;   // impennata
  if (codice === "KeyE") tasti.pesoAvanti = premuto;                                   // stoppie
  if (codice === "Space") evento.preventDefault();
  // F11: schermo intero (con Ultra 4K si vede al meglio)
  if (codice === "F11" && premuto) {
    evento.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
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

  const modello = moto.modello;
  modello.updateMatrixWorld();
  const pilota = modello.userData.pilota;
  const inPrimaPersona = modoTelecamera === 2 && moto.caduta <= 0;
  // in prima persona il pilota sei tu: non lo disegno (cosi' si vedono manubrio e tabella)
  pilota.visible = !inPrimaPersona || pilota.parent !== modello;
  // in prima persona: vista piu' larga e oggetti vicini (manubrio) non tagliati
  const nearVoluto = inPrimaPersona ? 0.05 : 0.3;
  const fovVoluto = inPrimaPersona ? 80 : 65;
  if (telecamera.near !== nearVoluto || telecamera.fov !== fovVoluto) {
    telecamera.near = nearVoluto;
    telecamera.fov = fovVoluto;
    telecamera.updateProjectionMatrix();
  }
  // "Su" della telecamera: piega un po' con la moto (in prima persona molto, da dietro poco)
  const suMoto = new THREE.Vector3(0, 1, 0).applyQuaternion(modello.quaternion);
  telecamera.up.set(0, 1, 0).lerp(suMoto, inPrimaPersona ? 0.7 : 0.15).normalize();

  if (inPrimaPersona) {
    // Dal casco: gli occhi sopra il bacino del pilota, un po' in avanti; si guarda in basso verso la strada
    const posto = modello.userData.postoPilota;
    // occhi nel casco, circa mezzo metro dietro il manubrio; si guarda 20 gradi in basso:
    // in fondo allo schermo ci sono manubrio, tabella e serbatoio
    // (in macchina gli occhi sono piu' in alto rispetto al bacino e si guarda piu' dritto)
    const alzaOcchi = modello.userData.altezzaOcchi || 0.42;
    const giu = modello.userData.altezzaOcchi ? 0.6 : 2.3;
    const occhi = modello.localToWorld(new THREE.Vector3(posto.x, posto.y + alzaOcchi, posto.z + 0.1));
    const davanti = modello.localToWorld(new THREE.Vector3(posto.x, posto.y + alzaOcchi - giu, posto.z - 6.2));
    telecamera.position.copy(occhi);
    telecamera.lookAt(davanti);
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
  // contro un muro, in galleria o appena spostati (partenza, R): niente movimento morbido
  if (bloccata || moto.inGalleria || telecamera.position.distanceTo(obiettivo) > 60) {
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
    await mostraStato("Caricamento del terreno (swisstopo)...");
    const terreno = await caricaTerreno();
    const terrenoMesh = aggiungiTerreno(terreno, scena, disegnatore);

    await mostraStato("Caricamento delle strade (OpenStreetMap)...");
    const strade = await caricaStrade();
    aggiungiStrade(strade, scena, terreno);
    aggiungiOpere(strade, scena, terreno);

    await mostraStato("Fiumi e torrenti...");
    aggiungiAcqua(await caricaAcqua(), scena, terreno);

    await mostraStato("Caricamento degli edifici (OpenStreetMap)...");
    const edifici = await caricaEdifici();
    aggiungiEdifici(edifici, scena);

    await mostraStato("Treni, funicolari e teleferiche...");
    const trasporti = await caricaTrasporti();
    const mobili = aggiungiTrasporti(trasporti, scena);

    await mostraStato("Segnaletica e lampioni...");
    const dettagli = await caricaDettagli();
    aggiungiDettagli(dettagli, scena, terreno, strade);
    preparaMinimappa(strade, terreno, dettagli.localita, trasporti);

    await mostraStato("Preparazione dei boschi...");
    const alberi = creaAlberi(scena, terreno, strade, edifici, await caricaAlberiSingoli());

    await caricaModelli3D(function (nome) {
      mostraStato("Moto 3D: " + nome + "...");
    });
    const moto = creaMoto(scena, motoSalvata());
    // Partenza: quella scelta l'ultima volta (tasto P), altrimenti Piazza Grande
    let partenzaX = PARTENZA_EST - terreno.info.centro_lv95[0];
    let partenzaZ = -(PARTENZA_NORD - terreno.info.centro_lv95[1]);
    const scelta = partenzaSalvata();
    if (scelta && Math.abs(scelta.x) < terreno.metaX && Math.abs(scelta.z) < terreno.metaZ) {
      partenzaX = scelta.x;
      partenzaZ = scelta.z;
    }
    mettiSullaStrada(moto, strade, partenzaX, partenzaZ);
    telecamera.position.set(moto.x, moto.y + 30, moto.z + 40);
    preparaTerrenoVicino(terrenoMesh, moto.x, moto.z);

    // Impostazioni e test delle prestazioni
    const mondo = { disegnatore: disegnatore, telecamera: telecamera, scena: scena, alberi: alberi, terrenoMesh: terrenoMesh, sole: sole };
    applicaQualita(qualitaSalvata(), mondo);
    const test = creaTest();
    preparaMenu(mondo, function () {
      avviaTest(test);
    });
    preparaRisultato();
    preparaGarage(moto);
    preparaPartenza(moto, dettagli.localita, function (m, x, z) {
      mettiSullaStrada(m, strade, x, z);
      preparaTerrenoVicino(terrenoMesh, m.x, m.z);
    });

    const danni = creaDanni();
    const segni = creaSegni(scena);

    nascondiCaricamento();
    const orologio = new THREE.Clock();
    let tempoGioco = 0;

    function ciclo() {
      const vero = orologio.getDelta();          // tempo vero del fotogramma (per gli FPS)
      const dt = Math.min(vero, 0.05);           // tempo per la fisica (mai troppo grande)
      // R oppure fine di una caduta: si riparte dalla strada piu' vicina
      if (richiestaReset || moto.riparti) {
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
      // il sole (e le sue ombre) segue la moto; il cielo segue la telecamera
      sole.target.position.set(moto.x, moto.y, moto.z);
      sole.position.set(moto.x + DIREZIONE_SOLE.x * 80, moto.y + DIREZIONE_SOLE.y * 80, moto.z + DIREZIONE_SOLE.z * 80);
      cielo.position.copy(telecamera.position);
      tempoGioco = tempoGioco + vero;
      aggiornaTrasporti(mobili, tempoGioco);
      aggiornaSuono(moto, test.attivo);
      aggiornaDanni(danni, moto, dt, disegnatore.domElement);

      // Segni neri delle gomme: ruota dietro in derapata o frenata forte sull'asfalto
      const dirX = -Math.sin(moto.angolo + moto.derapata);
      const dirZ = -Math.cos(moto.angolo + moto.derapata);
      const passoMezzo = moto.modello.userData.passo / 2;
      const sgomma = moto.suStrada && !moto.inAria && moto.caduta <= 0 && Math.abs(moto.velocita) > 3 &&
        (Math.abs(moto.derapata) > 0.1 || moto.sgommata === true);
      // moto: una ruota dietro; macchina: due ruote dietro (a destra e a sinistra)
      const carreggiata = moto.modello.userData.carreggiata || 0;
      const latiRuote = carreggiata > 0 ? [-carreggiata / 2, carreggiata / 2] : [0];
      const avantiX = -Math.sin(moto.angolo);
      const avantiZ = -Math.cos(moto.angolo);
      for (let i = 0; i < latiRuote.length; i++) {
        const chiave = "dietro" + i;
        if (sgomma) {
          const indietro = carreggiata > 0 ? passoMezzo : passoMezzo;
          const px = moto.x - (carreggiata > 0 ? avantiX : dirX) * indietro + avantiZ * latiRuote[i];
          const pz = moto.z - (carreggiata > 0 ? avantiZ : dirZ) * indietro - avantiX * latiRuote[i];
          lasciaSegno(segni, chiave, px, moto.y, pz, carreggiata > 0 ? moto.angolo : moto.angolo + moto.derapata);
        } else {
          staccaSegno(segni, chiave);
        }
      }
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
