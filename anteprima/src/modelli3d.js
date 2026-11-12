// Modelli 3D veri delle moto e dei piloti (file .glb creati con Blender:
// tools/moto/crea_moto_450.py per la SM 450, tools/moto/crea_moto.py per le altre).
// Se i file di una moto mancano, quella moto usa le forme semplici (moto_modelli.js).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PEZZI = ["Telaio", "Forcellone", "Sterzo", "RuotaPosteriore", "RuotaAnteriore", "Pilota"];
const MODELLI = ["SM450", "SM690", "STRADA700", "NAKED890", "SPORT1000", "ENDURO450", "SCOOTER125", "DRIFTGT"];
const PEZZI_AUTO = ["Carrozzeria", "Ruota", "Pilota"];
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
      for (const pezzo of (misure.tipo === "auto" ? PEZZI_AUTO : PEZZI)) {
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

// Materiali di moto, macchine e piloti: il gioco li fa riflettere il cielo piu' forte del resto del mondo
// (vedi riflessiMoto in gioco.js), cosi' vernice, cromature e visiere brillano senza lavare l'asfalto.
export const materialiMoto = new Set();
export function registraMaterialeMoto(m) {
  if (!m) return;
  if (Array.isArray(m)) { m.forEach(registraMaterialeMoto); return; }
  m.userData.riflesso = m.userData.riflesso || (m.metalness > 0.5 ? 1.1 : (m.clearcoat > 0 ? 1.6 : (m.roughness > 0.7 ? 0.35 : 0.9)));
  materialiMoto.add(m);
}

// Copia di un pezzo, girata come le moto del gioco.
// Nel file la moto guarda verso +X; nel gioco guarda verso -Z: giro di 90 gradi.
function pezzo(modello, nome) {
  const copia = modello.pezzi[nome].clone(true);
  copia.rotation.y = Math.PI / 2;
  copia.traverse(function (oggetto) {
    if (oggetto.isMesh) {
      oggetto.castShadow = true;
      registraMaterialeMoto(oggetto.material);
    }
  });
  return copia;
}

// Macchina: carrozzeria, 4 ruote (2 che sterzano), pilota
function costruisciAuto3D(modello) {
  const m = modello.misure;
  const auto = new THREE.Group();
  const carrozzeria = pezzo(modello, "Carrozzeria");
  carrozzeria.position.set(0, m.raggio, m.passo / 2);
  auto.add(carrozzeria);

  const ruote = [];
  const sterzi = [];
  for (const z of [m.passo / 2, -m.passo / 2]) {
    for (const x of [-m.carreggiata / 2, m.carreggiata / 2]) {
      const perno = new THREE.Group();   // gira per sterzare (solo davanti)
      perno.position.set(x, m.raggio, z);
      const ruota = new THREE.Group();   // gira per rotolare
      const copia = pezzo(modello, "Ruota");
      if (x > 0) copia.rotation.y = -Math.PI / 2;   // a destra il cerchio guarda fuori
      ruota.add(copia);
      perno.add(ruota);
      auto.add(perno);
      ruote.push(ruota);
      if (z < 0) sterzi.push(perno);
    }
  }
  // pilota seduto a sinistra
  const bacino = new THREE.Vector3(-m.bacino[2], m.raggio + m.bacino[1], m.passo / 2 - m.bacino[0]);
  const pilota = new THREE.Group();
  pilota.position.copy(bacino);
  pilota.add(pezzo(modello, "Pilota"));
  auto.add(pilota);

  const vuoto = new THREE.Group();   // per le parti delle moto che la macchina non ha
  auto.userData = {
    ruote: ruote, sterzi: sterzi, carreggiata: m.carreggiata, altezzaOcchi: 0.68,
    ruotaDavanti: vuoto, ruotaDietro: vuoto, sterzo: vuoto,
    rDav: m.raggio, rDie: m.raggio, passo: m.passo, pilota: pilota, postoPilota: bacino.clone()
  };
  return auto;
}

// Costruisce la moto con le stesse parti mobili delle moto semplici (ruote, sterzo, pilota)
export function costruisciModello3D(nome) {
  const modello = pronti[nome];
  const m = modello.misure;
  if (m.tipo === "auto") return costruisciAuto3D(modello);
  const moto = new THREE.Group();
  const pernoDietro = new THREE.Vector3(0, m.rDie, m.passo / 2);
  const pernoDavanti = new THREE.Vector3(0, m.rDav, -m.passo / 2);

  const telaio = pezzo(modello, "Telaio");
  telaio.position.copy(pernoDietro);
  moto.add(telaio);
  // Fiammelle agli scarichi del 450 (si accendono per un attimo quando scoppietta in rilascio)
  const fiamme = [];
  if (nome === "SM450") {
    const forma = new THREE.ConeGeometry(0.03, 0.22, 10);
    forma.translate(0, 0.11, 0);   // la base sta sull'uscita dello scarico, la punta va indietro
    const formaDentro = new THREE.ConeGeometry(0.016, 0.12, 8);
    formaDentro.translate(0, 0.06, 0);
    const arancio = new THREE.MeshBasicMaterial({ color: 0xff6a12, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const giallo = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    // Dove finiscono i due scarichi lo si misura sul modello: il fondello d'acciaio dei silenziatori e' la
    // parte d'acciaio piu' indietro (nel file la moto guarda verso +X, quindi "indietro" = X piu' piccola)
    telaio.updateMatrixWorld(true);
    const punto = new THREE.Vector3();
    for (const lato of [1, -1]) {
      const punti = [];
      telaio.traverse(function (oggetto) {
        if (!oggetto.isMesh || !oggetto.material || oggetto.material.name !== "Acciaio") return;
        const posizioni = oggetto.geometry.attributes.position;
        for (let i = 0; i < posizioni.count; i++) {
          punto.fromBufferAttribute(posizioni, i);
          oggetto.localToWorld(punto);
          telaio.worldToLocal(punto);
          if (punto.z * lato > 0.05) punti.push(punto.x, punto.y, punto.z);
        }
      });
      let dietro = Infinity;
      for (let i = 0; i < punti.length; i += 3) dietro = Math.min(dietro, punti[i]);
      // centro del fondello: media dei punti entro 1.2 cm dal piu' arretrato
      let sommaY = 0, sommaZ = 0, quanti = 0;
      for (let i = 0; i < punti.length; i += 3) {
        if (punti[i] < dietro + 0.012) {
          sommaY += punti[i + 1];
          sommaZ += punti[i + 2];
          quanti++;
        }
      }
      if (quanti === 0) continue;   // modello senza scarichi d'acciaio: niente fiamme
      const fiamma = new THREE.Group();
      fiamma.position.set(dietro - 0.02, sommaY / quanti, sommaZ / quanti);
      fiamma.rotation.z = Math.PI / 2 - 0.3;   // punta indietro e un po' in su, come il silenziatore
      fiamma.add(new THREE.Mesh(forma, arancio));
      fiamma.add(new THREE.Mesh(formaDentro, giallo));
      fiamma.visible = false;
      telaio.add(fiamma);
      fiamme.push(fiamma);
    }
  }
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
    rDav: m.rDav, rDie: m.rDie, passo: m.passo, pilota: pilota, postoPilota: bacino.clone(), fiamme: fiamme
  };
  return moto;
}
