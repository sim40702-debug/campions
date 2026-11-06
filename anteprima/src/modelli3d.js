// Modelli 3D veri (file .glb creati con Blender da tools/moto/crea_moto_450.py).
// Per ora: la MRW SM 450 (disegno di Simone) con il pilota.
// Se i file mancano, il gioco usa le moto fatte con le forme semplici (moto_modelli.js).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PEZZI = ["Telaio", "Forcellone", "Sterzo", "RuotaPosteriore", "RuotaAnteriore", "Pilota"];
const pronti = {};

export async function caricaModelli3D() {
  const caricatore = new GLTFLoader();
  for (const pezzo of PEZZI) {
    try {
      const file = await caricatore.loadAsync("modelli/SM450_" + pezzo + ".glb");
      pronti[pezzo] = file.scene;
    } catch (errore) {
      console.warn("Modello mancante: " + pezzo);
    }
  }
}

export function modelloSM450Pronto() {
  return PEZZI.every(function (pezzo) {
    return pronti[pezzo] !== undefined;
  });
}

// Copia di un pezzo, girata come le moto del gioco.
// Nel file la moto guarda verso +X; nel gioco guarda verso -Z: giro di 90 gradi.
function pezzo(nome) {
  const copia = pronti[nome].clone(true);
  copia.rotation.y = Math.PI / 2;
  copia.traverse(function (oggetto) {
    if (oggetto.isMesh) oggetto.castShadow = true;
  });
  return copia;
}

// Costruisce la SM 450 con le stesse parti mobili delle altre moto (ruote, sterzo, pilota)
export function costruisciSM450() {
  const PASSO = 1.48;
  const RAGGIO = 0.31;
  const moto = new THREE.Group();
  const pernoDietro = new THREE.Vector3(0, RAGGIO, PASSO / 2);
  const pernoDavanti = new THREE.Vector3(0, RAGGIO, -PASSO / 2);

  const telaio = pezzo("Telaio");
  telaio.position.copy(pernoDietro);
  moto.add(telaio);
  const forcellone = pezzo("Forcellone");
  forcellone.position.copy(pernoDietro);
  moto.add(forcellone);

  const ruotaDietro = new THREE.Group();
  ruotaDietro.position.copy(pernoDietro);
  ruotaDietro.add(pezzo("RuotaPosteriore"));
  moto.add(ruotaDietro);

  const sterzo = new THREE.Group();
  sterzo.position.copy(pernoDavanti);
  sterzo.add(pezzo("Sterzo"));
  moto.add(sterzo);
  const ruotaDavanti = new THREE.Group();
  ruotaDavanti.add(pezzo("RuotaAnteriore"));
  sterzo.add(ruotaDavanti);

  // Bacino del pilota: 55 cm davanti e 76 cm sopra il perno della ruota dietro (come nel file)
  const bacino = new THREE.Vector3(0, RAGGIO + 0.76, PASSO / 2 - 0.55);
  const pilota = new THREE.Group();
  pilota.position.copy(bacino);
  pilota.add(pezzo("Pilota"));
  moto.add(pilota);

  moto.userData = {
    ruotaDavanti: ruotaDavanti, ruotaDietro: ruotaDietro, sterzo: sterzo,
    rDav: 0.30, rDie: 0.31, passo: PASSO, pilota: pilota, postoPilota: bacino.clone()
  };
  return moto;
}
