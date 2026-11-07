// Modelli 3D veri delle moto e dei piloti (file .glb creati con Blender:
// tools/moto/crea_moto_450.py per la SM 450, tools/moto/crea_moto.py per le altre).
// Se i file di una moto mancano, quella moto usa le forme semplici (moto_modelli.js).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PEZZI = ["Telaio", "Forcellone", "Sterzo", "RuotaPosteriore", "RuotaAnteriore", "Pilota"];
const MODELLI = ["SM450", "SM690", "STRADA700", "NAKED890", "SPORT1000", "ENDURO450", "SCOOTER125"];
const pronti = {};   // nome moto -> { pezzi: {...}, misure: {...} }

// La SM 450 non ha il file delle misure: sono queste
const MISURE_SM450 = { passo: 1.48, rDav: 0.30, rDie: 0.31, bacino: [0.55, 0.76] };

export async function caricaModelli3D(avanzamento) {
  const caricatore = new GLTFLoader();
  for (const nome of MODELLI) {
    if (avanzamento) avanzamento(nome);
    try {
      let misure = MISURE_SM450;
      if (nome !== "SM450") {
        const risposta = await fetch("modelli/" + nome + ".json");
        if (!risposta.ok) continue;
        misure = await risposta.json();
      }
      const pezzi = {};
      for (const pezzo of PEZZI) {
        const file = await caricatore.loadAsync("modelli/" + nome + "_" + pezzo + ".glb");
        pezzi[pezzo] = file.scene;
      }
      pronti[nome] = { pezzi: pezzi, misure: misure };
    } catch (errore) {
      console.warn("Modello 3D mancante: " + nome);
    }
  }
}

export function modelloPronto(nome) {
  return pronti[nome] !== undefined;
}

// Copia di un pezzo, girata come le moto del gioco.
// Nel file la moto guarda verso +X; nel gioco guarda verso -Z: giro di 90 gradi.
function pezzo(modello, nome) {
  const copia = modello.pezzi[nome].clone(true);
  copia.rotation.y = Math.PI / 2;
  copia.traverse(function (oggetto) {
    if (oggetto.isMesh) oggetto.castShadow = true;
  });
  return copia;
}

// Costruisce la moto con le stesse parti mobili delle moto semplici (ruote, sterzo, pilota)
export function costruisciModello3D(nome) {
  const modello = pronti[nome];
  const m = modello.misure;
  const moto = new THREE.Group();
  const pernoDietro = new THREE.Vector3(0, m.rDie, m.passo / 2);
  const pernoDavanti = new THREE.Vector3(0, m.rDav, -m.passo / 2);

  const telaio = pezzo(modello, "Telaio");
  telaio.position.copy(pernoDietro);
  moto.add(telaio);
  const forcellone = pezzo(modello, "Forcellone");
  forcellone.position.copy(pernoDietro);
  moto.add(forcellone);

  const ruotaDietro = new THREE.Group();
  ruotaDietro.position.copy(pernoDietro);
  ruotaDietro.add(pezzo(modello, "RuotaPosteriore"));
  moto.add(ruotaDietro);

  const sterzo = new THREE.Group();
  sterzo.position.copy(pernoDavanti);
  sterzo.add(pezzo(modello, "Sterzo"));
  moto.add(sterzo);
  const ruotaDavanti = new THREE.Group();
  ruotaDavanti.add(pezzo(modello, "RuotaAnteriore"));
  sterzo.add(ruotaDavanti);

  // Bacino del pilota: bacino[0] metri davanti e bacino[1] metri sopra il perno della ruota dietro
  const bacino = new THREE.Vector3(0, m.rDie + m.bacino[1], m.passo / 2 - m.bacino[0]);
  const pilota = new THREE.Group();
  pilota.position.copy(bacino);
  pilota.add(pezzo(modello, "Pilota"));
  moto.add(pilota);

  moto.userData = {
    ruotaDavanti: ruotaDavanti, ruotaDietro: ruotaDietro, sterzo: sterzo,
    rDav: m.rDav, rDie: m.rDie, passo: m.passo, pilota: pilota, postoPilota: bacino.clone()
  };
  return moto;
}
