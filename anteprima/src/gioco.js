// MOTO RACING WORLD - Anteprima Ticino
// File principale: crea la scena, carica i dati e fa girare il gioco.

import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { caricaModelli3D } from "./modelli3d.js";
import { caricaTerreno, aggiungiTerreno, quotaTerreno, aggiornaTerreno, preparaTerrenoVicino } from "./terreno.js";
import { caricaStrade, aggiungiStrade, adattaTerreno, puntoStradaVicino, preparaStradeVicine, aggiornaStrade } from "./strade.js";
import { creaMoto, posizionaMoto, aggiornaMoto, haMappaImpennate } from "./moto.js";
import { motoSalvata, preparaGarage } from "./garage.js";
import { partenzaSalvata, preparaPartenza } from "./partenza.js";
import { aggiornaSuono, scoppioInCorso } from "./audio.js";
import { creaDanni, aggiornaDanni } from "./danni.js";
import { creaSegni, lasciaSegno, staccaSegno } from "./segni.js";
import { caricaEdifici, pulisciEdifici, aggiungiEdifici, aggiornaEdifici, preparaEdificiVicini, dentroEdificio } from "./edifici.js";
import { creaLuoghi } from "./luoghi.js";
import { caricaUsoSuolo, creaMascheraUso } from "./uso_suolo.js";
import { creaPrecipitazioni } from "./precipitazioni.js";
import { creaBenchmark, inMarkdown } from "./benchmark.js";

const VERSIONE = "0.15.5";
import { creaAmbiente, aggiornaAmbiente, posizionaLuce, impostaOra } from "./ambiente.js";
import { caricaAlberiSingoli, creaAlberi, aggiornaAlberi } from "./alberi.js";
import { caricaDettagli, aggiungiDettagli, localitaVicina } from "./dettagli.js";
import { caricaAcqua, aggiungiAcqua } from "./acqua.js";
import { aggiungiOpere, caricaDighe, aggiungiDighe } from "./opere.js";
import { caricaTrasporti, aggiungiTrasporti, aggiornaTrasporti } from "./trasporti.js";
import { applicaQualita, preparaMenu, qualitaSalvata } from "./impostazioni.js";
import { aggiornaFps, creaTest, avviaTest, aggiornaTest, preparaRisultato } from "./prestazioni.js";
import { aggiornaInterfaccia, mostraStato, nascondiCaricamento } from "./interfaccia.js";
import { preparaMinimappa } from "./mappa.js";
import { creaZone, aggiornaZona } from "./zone.js";
import { preparaRegioni, aggiornaRegioni, PARTENZA_EST, PARTENZA_NORD } from "./regioni.js";
import { preparaCantone } from "./cantone.js";
import { aggiungiSfondo } from "./sfondo.js";

// Punto di partenza: Piazza Grande, Locarno (coordinate LV95)

// --- Scena, telecamera, luci ---------------------------------------------------
const scena = new THREE.Scene();
scena.background = new THREE.Color(0x9cc3e6);
scena.fog = new THREE.Fog(0x9cc3e6, 1500, 7000);

const telecamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 9000);

const disegnatore = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
disegnatore.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
disegnatore.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(disegnatore.domElement);

// Colori come al cinema (tone mapping); i riflessi vengono dal cielo vero (vedi aggiornaRiflessi)
disegnatore.toneMapping = THREE.ACESFilmicToneMapping;
disegnatore.toneMappingExposure = 1.15;
const generatore = new THREE.PMREMGenerator(disegnatore);
scena.environment = generatore.fromScene(new RoomEnvironment(), 0.04).texture;
scena.environmentIntensity = 0.35;

const emisfero = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.2);
scena.add(emisfero);
const sole = new THREE.DirectionalLight(0xfff4e0, 2.2);
sole.position.set(-0.5, 1, 0.3);
scena.add(sole);
scena.add(sole.target);

// Ombre: seguono la moto. Quanto sono estese dipende dalla qualita' (impostazioni.js)
disegnatore.shadowMap.enabled = true;
disegnatore.shadowMap.type = THREE.PCFSoftShadowMap;
sole.castShadow = true;
sole.shadow.mapSize.set(2048, 2048);
sole.shadow.camera.left = -40;
sole.shadow.camera.right = 40;
sole.shadow.camera.top = 40;
sole.shadow.camera.bottom = -40;
sole.shadow.camera.near = 1;
sole.shadow.camera.far = 300;
sole.shadow.bias = -0.0004;
sole.shadow.normalBias = 0.05;

// Ora del giorno, cielo con stelle e luna, nuvole, nebbia e meteo
const ambiente = creaAmbiente(scena, disegnatore, sole, emisfero, telecamera);

// Pioggia e neve (particelle attorno alla telecamera)
const precipitazioni = creaPrecipitazioni(scena, ambiente);

// Fari della moto (di notte): un faro che illumina la strada davanti
const faro = new THREE.SpotLight(0xfff0d0, 0, 90, 0.5, 0.95, 1.4);
faro.castShadow = false;
scena.add(faro);
scena.add(faro.target);

// Riflessi: la scena (metalli della moto, vetri) riflette il cielo vero. Si rifa' quando cambia l'ora.
let ultimaOraRiflessi = -99;
let ultimoMeteoRiflessi = "";
function aggiornaRiflessi(forza) {
  const cambio = Math.abs(ambiente.ora - ultimaOraRiflessi) > 0.6 && Math.abs(ambiente.ora - ultimaOraRiflessi) < 23.4;
  if (!forza && !cambio && ultimoMeteoRiflessi === ambiente.meteo) return;
  ultimaOraRiflessi = ambiente.ora;
  ultimoMeteoRiflessi = ambiente.meteo;
  const piccola = new THREE.Scene();
  const cieloPiccolo = new Sky();
  cieloPiccolo.scale.setScalar(900);
  const u = cieloPiccolo.material.uniforms;
  const o = ambiente.cielo.material.uniforms;
  u.sunPosition.value.copy(o.sunPosition.value);
  u.turbidity.value = o.turbidity.value;
  u.rayleigh.value = o.rayleigh.value;
  u.mieCoefficient.value = o.mieCoefficient.value;
  u.mieDirectionalG.value = o.mieDirectionalG.value;
  piccola.add(cieloPiccolo);
  const vecchio = scena.environment;
  scena.environment = generatore.fromScene(piccola, 0.02, 1, 5000).texture;
  if (vecchio && vecchio !== scena.environment) vecchio.dispose();
  cieloPiccolo.geometry.dispose();
  cieloPiccolo.material.dispose();
}

window.addEventListener("resize", function () {
  telecamera.aspect = window.innerWidth / window.innerHeight;
  telecamera.updateProjectionMatrix();
  disegnatore.setSize(window.innerWidth, window.innerHeight);
});

// --- Tastiera ------------------------------------------------------------------
const tasti = { su: false, giu: false, sinistra: false, destra: false, frenoDietro: false, pesoDietro: false, pesoAvanti: false };
let modoTelecamera = 0;   // 0 = dietro, 1 = alta, 2 = casco
const elMappaGrande = document.getElementById("mappaGrande");
const elMappaCantone = document.getElementById("mappaCantone");
let richiestaReset = false;
let richiestaMappa = false;

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
  // mentre si scrive nella ricerca della mappa i tasti non guidano la moto
  if (evento.target && evento.target.tagName === "INPUT") return;
  cambiaTasto(evento, true);
  if (evento.code === "KeyC") modoTelecamera = (modoTelecamera + 1) % 3;
  if (evento.code === "KeyR") richiestaReset = true;
  if (evento.code === "KeyI") richiestaMappa = true;   // mappa impennate (solo motard)
  if (evento.code === "KeyT") {
    // T: ora del giorno (mattino, mezzogiorno, tramonto, notte)
    const tappe = [7.5, 12.5, 18.4, 22.5];
    let prossima = tappe.find(function (t) { return t > ambiente.ora + 0.05; });
    if (prossima === undefined) prossima = tappe[0];
    impostaOra(ambiente, prossima);
  }
});
window.addEventListener("keyup", function (evento) {
  if (evento.target && evento.target.tagName === "INPUT") return;
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

// Risoluzione adattiva: se il computer non regge (meno di ~26 FPS) la risoluzione scende a poco a poco fino al 50%,
// se c'e' margine torna su. Vale per tutte le qualita' e rende il gioco fluido su qualsiasi dispositivo.
let sommaTempi = 0, contaTempi = 0, ultimoAdeguamento = 0;
function risoluzioneAdattiva(vero, mondo) {
  if (vero > 0.5 || navigator.webdriver) return;   // pause (e prove automatiche), caricamenti, cambio finestra: non conta
  sommaTempi += vero;
  contaTempi++;
  if (contaTempi < 45) return;
  const media = sommaTempi / contaTempi;
  sommaTempi = 0;
  contaTempi = 0;
  const adesso = performance.now();
  if (adesso - ultimoAdeguamento < 1500 || !mondo.rapportoBase) return;
  let scala = mondo.scalaRisoluzione || 1;
  if (media > 0.038 && scala > 0.5) scala = Math.max(0.5, scala * 0.88);
  else if (media < 0.019 && scala < 1) scala = Math.min(1, scala * 1.06);
  else return;
  ultimoAdeguamento = adesso;
  mondo.scalaRisoluzione = scala;
  disegnatore.setPixelRatio(mondo.rapportoBase * scala);
  disegnatore.setSize(window.innerWidth, window.innerHeight);
}

// Faro: di notte la moto illumina la strada davanti
function aggiornaFaro(moto) {
  const buio = ambiente.uniformi.notte.value;
  faro.intensity = buio * 260;
  // (il faro resta sempre nella scena con intensita' 0: accenderlo/spegnerlo cambierebbe il numero di luci e farebbe
  // ricompilare tutti i programmi grafici, con un blocco di mezzo secondo al tramonto)
  if (buio < 0.02) return;
  const dirX = -Math.sin(moto.angolo);
  const dirZ = -Math.cos(moto.angolo);
  faro.position.set(moto.x + dirX * 0.9, moto.y + 1.0, moto.z + dirZ * 0.9);
  faro.target.position.set(moto.x + dirX * 25, moto.y - 0.2, moto.z + dirZ * 25);
}

// --- Avvio ---------------------------------------------------------------------
async function avvia() {
  try {
    // Ticino completo: prima si sceglie (e se serve si scarica) la regione dove si parte
    const regioni = await preparaRegioni(mostraStato);
    await mostraStato("Caricamento del terreno (swisstopo)...");
    const terreno = await caricaTerreno();
    const zone = creaZone(terreno);   // Locarnese, Valle Verzasca, ... (nomi delle grandi aree)
    // uso del suolo (parchi, prati, sport, cimiteri): serve prima del terreno, che li colora
    const usoSuolo = await caricaUsoSuolo();
    terreno.uso = creaMascheraUso(usoSuolo, terreno);
    await mostraStato("Caricamento delle strade (OpenStreetMap)...");
    const strade = await caricaStrade();
    adattaTerreno(terreno, strade);   // il terreno segue le strade (prima di disegnarlo)
    const terrenoMesh = aggiungiTerreno(terreno, scena, disegnatore, ambiente);
    await aggiungiSfondo(scena, terreno, regioni);   // montagne lontane delle regioni vicine

    await mostraStato("Fiumi e torrenti...");
    const acquaDati = await caricaAcqua();
    aggiungiAcqua(acquaDati, scena, terreno, ambiente);

    await mostraStato("Caricamento degli edifici (OpenStreetMap)...");
    const edifici = await caricaEdifici();
    const tolti = pulisciEdifici(edifici, strade);   // niente edifici in mezzo alla strada
    console.info("Edifici tolti perche' sull'asfalto: " + tolti);
    const dettagli = await caricaDettagli();
    const luoghi = creaLuoghi(dettagli.localita);
    await mostraStato("Costruzione delle citta': facciate, tetti, quartieri...");
    aggiungiEdifici(edifici, scena, { ambiente: ambiente, luoghi: luoghi, strade: strade, terreno: terreno, notte: ambiente.uniformi.notte, anisotropia: disegnatore.capabilities.getMaxAnisotropy() });
    aggiungiStrade(strade, scena, terreno, { edifici: edifici, luoghi: luoghi, ambiente: ambiente });
    aggiungiOpere(strade, scena, terreno);
    // Terreno, strade ed edifici si costruiscono a pezzi vicino alla moto: dopo uno spostamento improvviso
    // (partenza, tasto R, scelta sulla mappa) si prepara subito quello che sta attorno al punto di arrivo
    const preparaVicinanze = function (x, z) {
      preparaTerrenoVicino(terrenoMesh, x, z);
      preparaStradeVicine(strade, x, z, 1500);
      preparaEdificiVicini(edifici, x, z, 1200);
    };
    aggiungiDighe(await caricaDighe(), scena, terreno);   // la diga della Verzasca

    await mostraStato("Treni, funicolari e teleferiche...");
    const trasporti = await caricaTrasporti();
    const mobili = aggiungiTrasporti(trasporti, scena);

    await mostraStato("Segnaletica, lampioni e arredo urbano...");
    aggiungiDettagli(dettagli, scena, terreno, strade, { edifici: edifici, luoghi: luoghi, ambiente: ambiente });
    const mappa = preparaMinimappa({ usoSuolo: usoSuolo, strade: strade, terreno: terreno, localita: dettagli.localita, trasporti: trasporti, edifici: edifici, luoghi: luoghi, acqua: acquaDati, ambiente: ambiente, zone: zone });

    await mostraStato("Preparazione dei boschi e del verde urbano...");
    const alberi = creaAlberi(scena, terreno, strade, edifici, await caricaAlberiSingoli(), { luoghi: luoghi, ambiente: ambiente });

    await caricaModelli3D(function (nome) {
      mostraStato("Moto 3D: " + nome + "...");
    });
    const moto = creaMoto(scena, motoSalvata());
    try {
      moto.mappaImpennate = localStorage.getItem("mrw-mappa-impennate") === "1";
    } catch (errore) {
      moto.mappaImpennate = false;
    }
    // Partenza: quella scelta l'ultima volta (tasto P), altrimenti Piazza Grande
    let partenzaX = PARTENZA_EST - terreno.info.centro_lv95[0];
    let partenzaZ = -(PARTENZA_NORD - terreno.info.centro_lv95[1]);
    const scelta = partenzaSalvata(terreno);
    if (scelta && Math.abs(scelta.x) < terreno.metaX && Math.abs(scelta.z) < terreno.metaZ) {
      partenzaX = scelta.x;
      partenzaZ = scelta.z;
    }
    if (regioni) {
      // Ticino completo: la partenza e' in coordinate svizzere (passaggio da un'altra regione o scelta sulla mappa)
      partenzaX = regioni.partenza.est - terreno.info.centro_lv95[0];
      partenzaZ = -(regioni.partenza.nord - terreno.info.centro_lv95[1]);
    }
    if (Math.abs(partenzaX) > terreno.metaX - 60 || Math.abs(partenzaZ) > terreno.metaZ - 60) {
      // la partenza non e' in questa regione (per esempio regione non scaricata): si parte dal suo centro
      partenzaX = 0;
      partenzaZ = 0;
    }
    mettiSullaStrada(moto, strade, partenzaX, partenzaZ);
    if (regioni && regioni.partenza.daPassaggio && typeof regioni.partenza.angolo === "number") {
      // arrivo da un'altra regione: stessa direzione e stessa velocita' di prima
      const punto = puntoStradaVicino(strade, partenzaX, partenzaZ);
      if (punto) {
        const avantiX = -Math.sin(regioni.partenza.angolo), avantiZ = -Math.cos(regioni.partenza.angolo);
        const verso = punto.dx * avantiX + punto.dz * avantiZ < 0 ? -1 : 1;
        posizionaMoto(moto, punto.x, punto.y, punto.z, punto.dx * verso, punto.dz * verso);
        moto.velocita = regioni.partenza.velocita || 0;
      }
    }
    telecamera.position.set(moto.x, moto.y + 30, moto.z + 40);
    preparaVicinanze(moto.x, moto.z);

    // Impostazioni e test delle prestazioni
    const mondo = { disegnatore: disegnatore, telecamera: telecamera, scena: scena, alberi: alberi, terrenoMesh: terrenoMesh, sole: sole, ambiente: ambiente, edifici: edifici, strade: strade, riflessi: aggiornaRiflessi, precipitazioni: precipitazioni };
    applicaQualita(qualitaSalvata(), mondo);
    const test = creaTest();
    const bench = creaBenchmark({
      disegnatore: disegnatore, telecamera: telecamera, moto: moto, ambiente: ambiente, edifici: edifici, luoghi: luoghi,
      strade: strade, terreno: terreno, versione: VERSIONE, qualita: qualitaSalvata,
      mettiSullaStrada: function (m, x, z) { mettiSullaStrada(m, strade, x, z); },
      preparaVicino: function (x, z) { preparaVicinanze(x, z); },
      riflessi: aggiornaRiflessi, alberi: alberi
    });
    window.__mrw = window.__mrw || {};
    window.__mrw.tempi = { js: [], render: [] };
    bench.tempoCarico = performance.now();
    window.__mrw.eseguiBenchmark = function (opzioni) { return bench.esegui(opzioni); };
    window.__mrw.benchmarkMarkdown = inMarkdown;
    window.__mrw.mappa = mappa;
    window.__mrw.regioni = regioni;
    window.__mrw.zone = zone;
    window.__mrw.luoghi = luoghi;
    window.__mrw.edifici = edifici;
    window.__mrw.vaiA = function (x, z) {
      mettiSullaStrada(moto, strade, x, z);
      preparaVicinanze(moto.x, moto.z);
      telecamera.position.set(moto.x, moto.y + 30, moto.z + 40);
    };
    // per le prove: guida la moto per "secondi" con i tasti dati (60 passi al secondo) e ritorna l'impennata nel tempo
    window.__mrw.simula = function (premuti, secondi) {
      const t = Object.assign({ su: false, giu: false, sinistra: false, destra: false, frenoDietro: false, pesoDietro: false, pesoAvanti: false }, premuti);
      const traccia = [];
      for (let i = 0; i < Math.round(secondi * 60); i++) {
        aggiornaMoto(moto, t, 1 / 60, terreno, strade, edifici);
        if (i % 6 === 0) traccia.push(Math.round(moto.impennata * 100) / 100);
      }
      return { impennata: traccia, caduto: moto.caduto, kmh: Math.round(moto.velocita * 3.6) };
    };
    window.__mrw.moto = moto;
    window.__mrw.terreno = terreno;
    window.__mrw.strade = strade;
    window.__mrw.alberi = alberi;
    preparaMenu(mondo, function () {
      avviaTest(test);
    }, function () {
      // benchmark ripetibile: risultato nella finestra dei risultati
      const out = document.getElementById("testoRisultato");
      document.getElementById("risultatoTest").style.display = "block";
      out.textContent = "Benchmark in corso (8 scenari)... non toccare nulla.";
      bench.esegui({ fotogrammi: 120, durata: 5, riscaldamento: 4 }).then(function (r) {
        out.textContent = inMarkdown(r);
      });
    });
    preparaRisultato();
    preparaGarage(moto);
    preparaPartenza(moto, mappa, function (m, x, z) {
      mettiSullaStrada(m, strade, x, z);
      preparaVicinanze(m.x, m.z);
    });
    aggiornaRiflessi(true);
    // Mappa di tutto il cantone (tasto K o pulsante "Ticino"): scegli una partenza in qualsiasi regione
    preparaCantone(regioni, moto, terreno);
    const elAvvisoRegione = document.getElementById("avvisoRegione");

    const danni = creaDanni();
    const segni = creaSegni(scena);

    // per i test automatici (tools/anteprima_prova): contatori del disegnatore
    window.__mrw = Object.assign(window.__mrw || {}, { disegnatore: disegnatore, scena: scena, ambiente: ambiente, telecamera: telecamera });
    // Preparazione della grafica: compila ora TUTTI i programmi della scheda video (anche pioggia, neve, ombre).
    // Senza questo ogni materiale nuovo che compare durante la guida bloccava il gioco per decine o centinaia di ms.
    await mostraStato("Preparazione della grafica...");
    {
      const pv = precipitazioni.pioggia.visible, nv = precipitazioni.neve.visible;
      precipitazioni.pioggia.visible = true;
      precipitazioni.neve.visible = true;
      precipitazioni.uniformi.uInt.value = 1;
      disegnatore.compile(scena, telecamera);
      disegnatore.render(scena, telecamera);   // un fotogramma vero: compila anche i programmi delle ombre
      precipitazioni.pioggia.visible = pv;
      precipitazioni.neve.visible = nv;
    }
    nascondiCaricamento();
    const orologio = new THREE.Clock();
    let tempoGioco = 0;

    function ciclo() {
      const inizioFotogramma = performance.now();
      const vero = orologio.getDelta();          // tempo vero del fotogramma (per gli FPS)
      const dt = Math.min(vero, 0.05);           // tempo per la fisica (mai troppo grande)
      // R oppure fine di una caduta: si riparte dalla strada piu' vicina
      if (richiestaMappa) {
        // tasto I: accende o spegne la mappa impennate (solo sui motard); la scelta resta salvata
        richiestaMappa = false;
        if (haMappaImpennate(moto)) {
          moto.mappaImpennate = !moto.mappaImpennate;
          try {
            localStorage.setItem("mrw-mappa-impennate", moto.mappaImpennate ? "1" : "0");
          } catch (errore) {
            // senza memoria del browser la scelta vale solo per questa partita
          }
        }
      }
      if (richiestaReset || moto.riparti) {
        mettiSullaStrada(moto, strade, moto.x, moto.z);
        richiestaReset = false;
      }
      if (bench.attivo) {
        // benchmark: la moto sta ferma e la telecamera gira intorno al punto da misurare
        bench.aggiorna(vero);
        aggiornaAlberi(alberi, bench.x, bench.z, dt);
        aggiornaTerreno(terrenoMesh, bench.x, bench.z, vero);
        aggiornaMoto(moto, { su: false, giu: false, sinistra: false, destra: false, frenoDietro: false, pesoDietro: false, pesoAvanti: false }, 0.0001, terreno, strade, edifici);
      } else if (test.attivo) {
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
      // ora del giorno, cielo, nuvole; il sole (e le sue ombre) segue la moto
      // in galleria non piove ne' nevica
      ambiente.sottoCopertura += ((moto.inGalleria ? 1 : 0) - ambiente.sottoCopertura) * Math.min(1, vero * 4);
      aggiornaAmbiente(ambiente, vero, telecamera.position);
      precipitazioni.aggiorna(telecamera, window.innerHeight * disegnatore.getPixelRatio());
      posizionaLuce(ambiente, moto.x, moto.y, moto.z);
      aggiornaRiflessi(false);
      aggiornaEdifici(edifici, bench.attivo ? bench.x : telecamera.position.x, bench.attivo ? bench.z : telecamera.position.z, vero, ambiente);
      aggiornaStrade(strade, bench.attivo ? bench.x : telecamera.position.x, bench.attivo ? bench.z : telecamera.position.z, vero);
      aggiornaFaro(moto);
      tempoGioco = tempoGioco + vero;
      aggiornaTrasporti(mobili, tempoGioco);
      aggiornaSuono(moto, test.attivo);
      // Fiammelle allo scarico del 450 a ogni scoppio (ogni volta un po' diverse)
      const fiamme = moto.modello.userData.fiamme;
      if (fiamme && fiamme.length > 0) {
        const accese = scoppioInCorso();
        for (const fiamma of fiamme) {
          fiamma.visible = accese && Math.random() < 0.8;
          if (fiamma.visible) fiamma.scale.set(0.8 + Math.random() * 0.5, 0.6 + Math.random() * 0.9, 0.8 + Math.random() * 0.5);
        }
      }
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
      window.__mrw.fotogrammi = (window.__mrw.fotogrammi || 0) + 1;
      risoluzioneAdattiva(vero, mondo);
      aggiornaFps(vero, disegnatore);
      // Ticino completo: vicino al bordo della regione si prepara quella vicina e poi ci si passa
      if (regioni && !bench.attivo && !test.attivo) {
        const testoRegione = aggiornaRegioni(regioni, terreno.info.centro_lv95[0] + moto.x, terreno.info.centro_lv95[1] - moto.z, moto.angolo, moto.velocita, vero);
        if (elAvvisoRegione.textContent !== testoRegione) {
          elAvvisoRegione.textContent = testoRegione;
          elAvvisoRegione.style.display = testoRegione ? "block" : "none";
        }
      }
      // localita' e zona: "Lavertezzo · Valle Verzasca"
      const zona = aggiornaZona(zone, test.attivo ? telecamera.position.x : moto.x, test.attivo ? telecamera.position.z : moto.z, vero);
      const localita = localitaVicina(dettagli, moto.x, moto.z);
      aggiornaInterfaccia(moto, terreno, zona && zona.nome !== localita ? (localita ? localita + " · " + zona.nome : zona.nome) : localita, mappa, ambiente);
      const prima = performance.now();
      // Con una mappa grande aperta (N, K) il mondo 3D e' coperto: non lo si disegna, cosi' tutta la
      // potenza va alla mappa e la si sposta senza scatti
      const coperto = elMappaGrande.style.display === "block" || elMappaCantone.style.display === "block";
      if (!coperto) disegnatore.render(scena, telecamera);
      // tempi CPU (JavaScript) del fotogramma: aggiornamenti, e invio dei disegni alla scheda video (per le prove automatiche)
      const tm = window.__mrw && window.__mrw.tempi;
      if (tm && tm.js.length < 3000) { tm.js.push(prima - inizioFotogramma); tm.render.push(performance.now() - prima); }
      requestAnimationFrame(ciclo);
    }
    ciclo();
  } catch (errore) {
    mostraStato("Errore: " + errore.message);
    console.error(errore);
  }
}

avvia();
