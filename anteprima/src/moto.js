// La moto: modello 3D semplice e guida arcade.
// "angolo" = direzione della moto. Con angolo 0 la moto va verso NORD (z negativo).

import * as THREE from "three";
import { quotaTerreno } from "./terreno.js";
import { stradaSotto } from "./strade.js";
import { dentroEdificio } from "./edifici.js";

const VELOCITA_MAX_STRADA = 55;   // m/s = 198 km/h
const VELOCITA_MAX_PRATO = 12;    // m/s fuori strada
const ACCELERAZIONE = 9;
const FRENATA = 18;

function creaModello() {
  const moto = new THREE.Group();
  const rosso = new THREE.MeshLambertMaterial({ color: 0xd8232a });
  const nero = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const grigio = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  const tuta = new THREE.MeshLambertMaterial({ color: 0x24324a });
  const casco = new THREE.MeshLambertMaterial({ color: 0xf1f1f1 });

  // Ruote
  const formaRuota = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 20);
  formaRuota.rotateZ(Math.PI / 2);
  const ruotaDavanti = new THREE.Mesh(formaRuota, nero);
  ruotaDavanti.position.set(0, 0.32, -0.75);
  const ruotaDietro = new THREE.Mesh(formaRuota, nero);
  ruotaDietro.position.set(0, 0.32, 0.72);
  moto.add(ruotaDavanti, ruotaDietro);

  // Corpo, serbatoio, sella, forcella
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 1.25), rosso);
  corpo.position.set(0, 0.62, 0);
  const serbatoio = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.45), rosso);
  serbatoio.position.set(0, 0.88, -0.2);
  const sella = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.5), nero);
  sella.position.set(0, 0.86, 0.3);
  const forcella = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), grigio);
  forcella.position.set(0, 0.62, -0.68);
  forcella.rotation.x = -0.35;
  moto.add(corpo, serbatoio, sella, forcella);

  // Pilota
  const busto = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.3), tuta);
  busto.position.set(0, 1.18, 0.12);
  busto.rotation.x = -0.6;
  const testa = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), casco);
  testa.position.set(0, 1.46, -0.12);
  moto.add(busto, testa);

  return moto;
}

export function creaMoto(scena) {
  const moto = {
    modello: creaModello(),
    x: 0,
    y: 0,
    z: 0,
    angolo: 0,
    velocita: 0,
    piega: 0,
    beccheggio: 0,
    nomeStrada: "",
    inGalleria: false,
    suStrada: false
  };
  moto.modello.rotation.order = "YXZ";
  scena.add(moto.modello);
  return moto;
}

// Mette la moto in un punto, orientata nella direzione (dx, dz)
export function posizionaMoto(moto, x, y, z, dx, dz) {
  moto.x = x;
  moto.y = y;
  moto.z = z;
  moto.velocita = 0;
  moto.angolo = Math.atan2(-dx, -dz);
}

function quotaSuolo(moto, terreno, strade, x, z) {
  const strada = stradaSotto(strade, x, z, moto.y);
  if (strada !== null && strada.differenza < 6) {
    return { y: strada.y, strada: strada };
  }
  return { y: quotaTerreno(terreno, x, z), strada: null };
}

export function aggiornaMoto(moto, tasti, dt, terreno, strade, edifici) {
  const avanti = tasti.su;
  const indietro = tasti.giu;
  let sterzo = 0;
  if (tasti.sinistra) sterzo = sterzo + 1;
  if (tasti.destra) sterzo = sterzo - 1;

  // Dove sono? Strada, prato o lago
  const sotto = quotaSuolo(moto, terreno, strade, moto.x, moto.z);
  moto.suStrada = sotto.strada !== null;
  moto.nomeStrada = moto.suStrada ? sotto.strada.nome : "";
  moto.inGalleria = moto.suStrada && sotto.strada.galleria;
  const nelLago = !moto.suStrada && sotto.y < terreno.info.livello_lago + 0.3;

  let massima = moto.suStrada ? VELOCITA_MAX_STRADA : VELOCITA_MAX_PRATO;
  if (nelLago) massima = 3;

  // Gas e freno
  if (avanti) {
    moto.velocita += ACCELERAZIONE * dt * (1 - moto.velocita / VELOCITA_MAX_STRADA);
  }
  if (indietro) {
    if (moto.velocita > 0.5) {
      moto.velocita -= FRENATA * dt;
    } else {
      moto.velocita = Math.max(moto.velocita - 3 * dt, -4);
    }
  }
  // Attrito dell'aria e del terreno
  moto.velocita -= moto.velocita * 0.04 * dt;
  if (!avanti && !indietro) {
    moto.velocita -= Math.sign(moto.velocita) * Math.min(Math.abs(moto.velocita), 1.5 * dt);
  }
  if (moto.velocita > massima) {
    moto.velocita = Math.max(massima, moto.velocita - 12 * dt);
  }

  // Salite e discese
  moto.velocita -= 9.81 * Math.sin(moto.beccheggio) * 0.6 * dt;

  // Sterzo: piu' vai veloce, meno giri stretto
  const giro = sterzo * 1.8 / (1 + Math.abs(moto.velocita) * 0.05) * Math.min(1, Math.abs(moto.velocita) / 3);
  moto.angolo += giro * dt * Math.sign(moto.velocita || 1);

  // Movimento
  const dirX = -Math.sin(moto.angolo);
  const dirZ = -Math.cos(moto.angolo);
  let nuovaX = moto.x + dirX * moto.velocita * dt;
  let nuovaZ = moto.z + dirZ * moto.velocita * dt;
  const limite = terreno.meta - 5;
  if (Math.abs(nuovaX) > limite || Math.abs(nuovaZ) > limite) {
    nuovaX = Math.min(Math.max(nuovaX, -limite), limite);
    nuovaZ = Math.min(Math.max(nuovaZ, -limite), limite);
    moto.velocita = 0;
  }
  // Contro un edificio: la moto si ferma e rimbalza un po' indietro
  if (edifici && dentroEdificio(edifici, nuovaX, nuovaZ, moto.y + 0.5)) {
    nuovaX = moto.x;
    nuovaZ = moto.z;
    moto.velocita = -moto.velocita * 0.2;
  }
  moto.x = nuovaX;
  moto.z = nuovaZ;

  // Quota e inclinazione avanti/indietro
  const suolo = quotaSuolo(moto, terreno, strade, moto.x, moto.z);
  moto.y = suolo.y;
  const davanti = quotaSuolo(moto, terreno, strade, moto.x + dirX * 0.8, moto.z + dirZ * 0.8).y;
  const dietro = quotaSuolo(moto, terreno, strade, moto.x - dirX * 0.8, moto.z - dirZ * 0.8).y;
  moto.beccheggio = Math.atan2(davanti - dietro, 1.6);

  // Piega in curva (solo grafica)
  const piegaVoluta = sterzo * Math.min(1, Math.abs(moto.velocita) / 20) * 0.6;
  moto.piega += (piegaVoluta - moto.piega) * Math.min(1, dt * 5);

  moto.modello.position.set(moto.x, moto.y, moto.z);
  moto.modello.rotation.set(moto.beccheggio, moto.angolo, moto.piega);
}
