// Macchina da drift: fisica "arcade" con la derapata.
// Trazione dietro: in curva con tanto gas, oppure tirando il freno a mano (Spazio),
// le gomme dietro perdono aderenza e la macchina va di traverso. Si controlla con il controsterzo.
//
// Due angoli diversi:
//   moto.angolo     = dove punta il muso della macchina
//   moto.direzione  = dove va davvero la macchina
// La differenza tra i due e' l'angolo di derapata.

import { quotaSuolo, calcolaMarcia } from "./moto.js";
import { dentroEdificio } from "./edifici.js";
import { accelerazioneMax } from "./moto_modelli.js";

const G = 9.81;

// angolo tra -PI e PI
function normale(angolo) {
  while (angolo > Math.PI) angolo -= Math.PI * 2;
  while (angolo < -Math.PI) angolo += Math.PI * 2;
  return angolo;
}

function urto(auto, motivo) {
  if (auto.caduta > 0) return;
  auto.caduta = 2.5;
  auto.motivoCaduta = motivo;
  auto.velocitaUrto = Math.abs(auto.velocita) * 3.6;
  auto.nuovaCaduta = true;
  auto.velocita = 0;
}

export function aggiornaAuto(auto, tasti, dt, terreno, strade, edifici) {
  if (dt <= 0) return;
  const s = auto.scheda;
  const dati = auto.modello.userData;
  if (auto.direzione === undefined) auto.direzione = auto.angolo;

  if (auto.caduta > 0) {
    // dopo un urto forte: ferma qualche secondo, poi si riparte dalla strada
    auto.caduta -= dt;
    auto.gas = 0;
    if (auto.caduta <= 0) auto.riparti = true;
    return;
  }

  let sterzo = 0;
  if (tasti.sinistra) sterzo = sterzo + 1;
  if (tasti.destra) sterzo = sterzo - 1;
  auto.sterzoDolce += Math.max(-dt * 3, Math.min(dt * 3, sterzo - auto.sterzoDolce));
  auto.gas += ((tasti.su ? 1 : 0) - auto.gas) * Math.min(1, dt * 6);

  const sotto = quotaSuolo(auto, terreno, strade, auto.x, auto.z);
  auto.suStrada = sotto.strada !== null;
  auto.nomeStrada = auto.suStrada ? sotto.strada.nome : "";
  auto.inGalleria = auto.suStrada && sotto.strada.galleria;

  const vmax = s.vmax / 3.6;
  let v = auto.velocita;
  // gas, freno, retromarcia, aria
  if (tasti.su) v += accelerazioneMax(s) * Math.max(0, 1 - Math.pow(Math.max(v, 0) / vmax, 2)) * dt;
  if (tasti.giu) v = v > 0.5 ? v - s.frenata * dt : Math.max(v - 4 * dt, -6);
  if (tasti.frenoDietro && v > 0) v = Math.max(0, v - 3 * dt);   // il freno a mano frena un po'
  if (!tasti.su && !tasti.giu) v -= Math.sign(v) * Math.min(Math.abs(v), 1.2 * dt);
  v -= v * Math.abs(v) * 0.0009 * dt;
  if (!auto.suStrada) v = Math.min(v, s.fuoristrada / 3.6);
  v -= G * Math.sin(auto.beccheggio) * dt;

  // --- sterzo e derapata
  const angoloRuote = auto.sterzoDolce * 0.6 / (1 + Math.abs(v) * 0.02);
  const giroVoluto = v * Math.tan(angoloRuote) / dati.passo;
  // quanta presa hanno le gomme dietro
  let presaDietro = 1;
  if (tasti.frenoDietro && Math.abs(v) > 3) presaDietro = 0.2;                                // freno a mano
  else if (tasti.su && Math.abs(auto.sterzoDolce) > 0.25 && v > 7) presaDietro = 0.55;           // troppo gas in curva
  if (!auto.suStrada) presaDietro *= 0.7;
  // con poca presa dietro la macchina gira piu' di quanto vorrebbe lo sterzo (sovrasterzo)
  const giroDerapata = giroVoluto * (1 + (1 - presaDietro) * 1.3);
  auto.giroAuto += (giroDerapata - auto.giroAuto) * Math.min(1, dt * 3.5);
  auto.angolo += auto.giroAuto * dt;

  // la direzione in cui va la macchina "insegue" il muso: veloce con presa, lenta in derapata
  let derapata = normale(auto.angolo - auto.direzione);
  auto.direzione += derapata * Math.min(1, dt * (presaDietro * 4 + 0.6));
  derapata = normale(auto.angolo - auto.direzione);
  // di traverso si perde velocita' (le gomme strisciano)
  v -= Math.abs(Math.sin(derapata)) * v * 0.45 * dt;
  // testacoda: oltre 100 gradi la macchina gira su se stessa e si ferma piano
  if (Math.abs(derapata) > 1.75) {
    auto.direzione = auto.angolo - Math.sign(derapata) * 1.75;
    v *= 1 - Math.min(1, dt * 1.5);
  }
  auto.derapata = Math.abs(derapata) > 0.12 ? derapata : 0;   // per segni neri e rumore delle gomme
  auto.velocita = v;

  // --- movimento e muri
  let nuovaX = auto.x - Math.sin(auto.direzione) * v * dt;
  let nuovaZ = auto.z - Math.cos(auto.direzione) * v * dt;
  const limiteX = terreno.metaX - 5;
  const limiteZ = terreno.metaZ - 5;
  nuovaX = Math.min(Math.max(nuovaX, -limiteX), limiteX);
  nuovaZ = Math.min(Math.max(nuovaZ, -limiteZ), limiteZ);
  if (edifici && !auto.suStrada && dentroEdificio(edifici, nuovaX, nuovaZ, auto.y + 0.5)) {
    if (Math.abs(v) > 9) {
      urto(auto, "Sei finito contro un edificio");
    } else {
      auto.velocita = -v * 0.2;
    }
    nuovaX = auto.x;
    nuovaZ = auto.z;
  }
  auto.x = nuovaX;
  auto.z = nuovaZ;

  // --- appoggio sul terreno: quota, inclinazione avanti/indietro e di lato
  const avantiX = -Math.sin(auto.angolo);
  const avantiZ = -Math.cos(auto.angolo);
  const metaPasso = dati.passo / 2;
  const metaCarreggiata = dati.carreggiata / 2;
  const davanti = quotaSuolo(auto, terreno, strade, auto.x + avantiX * metaPasso, auto.z + avantiZ * metaPasso).y;
  const dietro = quotaSuolo(auto, terreno, strade, auto.x - avantiX * metaPasso, auto.z - avantiZ * metaPasso).y;
  const sinistra = quotaSuolo(auto, terreno, strade, auto.x + avantiZ * metaCarreggiata, auto.z - avantiX * metaCarreggiata).y;
  const destra = quotaSuolo(auto, terreno, strade, auto.x - avantiZ * metaCarreggiata, auto.z + avantiX * metaCarreggiata).y;
  const quota = (davanti + dietro + sinistra + destra) / 4;
  auto.y += (quota - auto.y) * Math.min(1, dt * 12);
  auto.beccheggio += (Math.atan2(davanti - dietro, dati.passo) - auto.beccheggio) * Math.min(1, dt * 8);
  // rollio: la pendenza della strada, piu' la carrozzeria che si inclina fuori curva
  const rollioCurva = Math.max(-0.07, Math.min(0.07, -auto.giroAuto * v * 0.012));
  const rollioVoluto = Math.atan2(destra - sinistra, dati.carreggiata) + rollioCurva;
  auto.piega += (rollioVoluto - auto.piega) * Math.min(1, dt * 6);

  calcolaMarcia(auto);

  // --- modello: carrozzeria, ruote che girano, ruote davanti che sterzano
  auto.modello.position.set(auto.x, auto.y, auto.z);
  auto.modello.rotation.set(auto.beccheggio, auto.angolo, auto.piega);
  for (const ruota of dati.ruote) ruota.rotation.x -= (v * dt) / dati.rDie;
  for (const perno of dati.sterzi) perno.rotation.y = angoloRuote;
}
