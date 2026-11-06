// La moto: guida, marce e giri del motore. Il modello 3D e le prestazioni
// arrivano dal garage (moto_modelli.js).
// "angolo" = direzione della moto. Con angolo 0 la moto va verso NORD (z negativo).

import { quotaTerreno } from "./terreno.js";
import { stradaSotto } from "./strade.js";
import { dentroEdificio } from "./edifici.js";
import { MOTO, costruisciMoto, accelerazioneMax } from "./moto_modelli.js";

export function creaMoto(scena, idMoto) {
  const moto = {
    scena: scena,
    id: null,
    scheda: null,
    modello: null,
    x: 0,
    y: 0,
    z: 0,
    angolo: 0,
    velocita: 0,
    piega: 0,
    beccheggio: 0,
    sterzoVisto: 0,
    marcia: 1,
    giri: 0,
    gas: 0,
    nomeStrada: "",
    inGalleria: false,
    suStrada: false
  };
  cambiaMoto(moto, idMoto);
  return moto;
}

// Cambia moto (garage): nuovo modello 3D e nuove prestazioni
export function cambiaMoto(moto, idMoto) {
  if (!MOTO[idMoto]) idMoto = "sm690";
  if (moto.modello) moto.scena.remove(moto.modello);
  moto.id = idMoto;
  moto.scheda = MOTO[idMoto];
  moto.modello = costruisciMoto(moto.scheda);
  moto.modello.rotation.order = "YXZ";
  moto.scena.add(moto.modello);
  moto.velocita = 0;
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

// Marcia e giri del motore dalla velocita' (cambio automatico)
function calcolaMarcia(moto) {
  const s = moto.scheda;
  const v = Math.abs(moto.velocita) * 3.6;   // km/h
  let marcia = 1;
  for (let i = 0; i < s.marce.length; i++) {
    marcia = i + 1;
    // si cambia al 92 % della velocita' massima di quella marcia
    if (v < s.vmax * s.marce[i] * 0.92) break;
  }
  // per non cambiare su e giu' di continuo: si scala solo sotto il 60 %
  if (marcia < moto.marcia && v > s.vmax * (s.marce[marcia] || 1) * 0.6) marcia = moto.marcia;
  moto.marcia = marcia;
  const massimaMarcia = s.vmax * s.marce[marcia - 1];
  const giri = s.minimo + (s.limitatore - s.minimo) * Math.min(1, v / massimaMarcia);
  // a moto ferma con il gas il motore sale lo stesso
  const voluti = Math.max(giri, s.minimo + moto.gas * (v < 5 ? 2500 : 0));
  moto.giri += (voluti - moto.giri) * 0.25;
}

export function aggiornaMoto(moto, tasti, dt, terreno, strade, edifici) {
  const s = moto.scheda;
  const avanti = tasti.su;
  const indietro = tasti.giu;
  let sterzo = 0;
  if (tasti.sinistra) sterzo = sterzo + 1;
  if (tasti.destra) sterzo = sterzo - 1;
  moto.gas += ((avanti ? 1 : 0) - moto.gas) * Math.min(1, dt * 6);

  // Dove sono? Strada, prato o lago
  const sotto = quotaSuolo(moto, terreno, strade, moto.x, moto.z);
  moto.suStrada = sotto.strada !== null;
  moto.nomeStrada = moto.suStrada ? sotto.strada.nome : "";
  moto.inGalleria = moto.suStrada && sotto.strada.galleria;
  const nelLago = !moto.suStrada && sotto.y < terreno.info.livello_lago + 0.3;

  const vmax = s.vmax / 3.6;   // m/s
  let massima = moto.suStrada ? vmax : s.fuoristrada / 3.6;
  if (nelLago) massima = 3;

  // Gas: piu' potenza = piu' accelerazione; vicino alla velocita' massima si accelera poco
  if (avanti) {
    const quanto = Math.max(0, 1 - Math.pow(Math.max(moto.velocita, 0) / vmax, 2));
    moto.velocita += accelerazioneMax(s) * quanto * dt;
  }
  if (indietro) {
    if (moto.velocita > 0.5) {
      moto.velocita -= s.frenata * dt;
    } else {
      moto.velocita = Math.max(moto.velocita - 3 * dt, -4);
    }
  }
  // Attrito dell'aria e del motore (freno motore)
  moto.velocita -= moto.velocita * 0.03 * dt;
  if (!avanti && !indietro) {
    moto.velocita -= Math.sign(moto.velocita) * Math.min(Math.abs(moto.velocita), 1.2 * dt);
  }
  if (moto.velocita > massima) {
    moto.velocita = Math.max(massima, moto.velocita - 10 * dt);
  }

  // Salite e discese (le moto leggere soffrono meno)
  moto.velocita -= 9.81 * Math.sin(moto.beccheggio) * 0.6 * dt;

  // Sterzo: le moto agili girano di piu'; piu' vai veloce, meno giri stretto
  const giro = sterzo * s.agilita / (1 + Math.abs(moto.velocita) * 0.05) * Math.min(1, Math.abs(moto.velocita) / 3);
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
  // (sulla strada no: a volte la strada passa sotto un edificio, come un portico)
  if (edifici && !moto.suStrada && dentroEdificio(edifici, nuovaX, nuovaZ, moto.y + 0.5)) {
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
  // inclinazione avanti/indietro "ammorbidita": niente saltelli
  const voluta = Math.atan2(davanti - dietro, 1.6);
  moto.beccheggio += (voluta - moto.beccheggio) * Math.min(1, dt * 8);

  // Piega in curva: come nella realta' dipende da velocita' e quanto stretta e' la curva
  const curva = Math.abs(moto.velocita) * Math.abs(giro);       // accelerazione laterale
  const piegaVoluta = Math.sign(sterzo) * Math.min(s.pieghaMax, Math.atan(curva / 9.81));
  moto.piega += (piegaVoluta - moto.piega) * Math.min(1, dt * 5);

  // Sterzo visto (ruota davanti): molto da fermi, poco in velocita'
  const sterzoVoluto = sterzo * 0.45 / (1 + Math.abs(moto.velocita) * 0.25);
  moto.sterzoVisto += (sterzoVoluto - moto.sterzoVisto) * Math.min(1, dt * 8);

  calcolaMarcia(moto);

  // Modello 3D: posizione, inclinazioni, ruote che girano, manubrio
  const dati = moto.modello.userData;
  moto.modello.position.set(moto.x, moto.y, moto.z);
  moto.modello.rotation.set(moto.beccheggio, moto.angolo, moto.piega);
  dati.ruotaDavanti.rotation.x -= (moto.velocita * dt) / dati.rDav;
  dati.ruotaDietro.rotation.x -= (moto.velocita * dt) / dati.rDie;
  dati.sterzo.rotation.y = moto.sterzoVisto;
}
