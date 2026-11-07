// Garage: moto ORIGINALI di MOTO RACING WORLD (nomi e forme inventati),
// con prestazioni realistiche per la loro categoria.

import * as THREE from "three";
import { modelloPronto, costruisciModello3D } from "./modelli3d.js";

export const MOTO = {
  sm690: {
    nome: "MRW SM 690",
    categoria: "Supermotard",
    motore: "Monocilindrico 690 cc",
    cv: 74, kg: 150, vmax: 195,
    frenata: 10.5, agilita: 2.4, pieghaMax: 0.85, fuoristrada: 60,
    marce: [0.30, 0.44, 0.57, 0.70, 0.84, 1.0], minimo: 1600, limitatore: 9200, cilindri: 1,
    colori: { telaio: 0xd9d9d9, carena: 0xf2f2f2, grafica: 0xd8232a, sella: 0x1d1d1d },
    forma: "supermotard", modello3d: "SM690"
  },
  sm450: {
    nome: "MRW SM 450",
    categoria: "Supermotard (disegno di Simone)",
    motore: "Monocilindrico 450 cc",
    cv: 60, kg: 128, vmax: 165,
    frenata: 10.5, agilita: 2.5, pieghaMax: 0.85, fuoristrada: 70,
    marce: [0.30, 0.45, 0.58, 0.72, 0.86, 1.0], minimo: 1800, limitatore: 11000, cilindri: 1,
    colori: { telaio: 0x1c1c1e, carena: 0xc8141c, grafica: 0x141414, sella: 0x101010 },
    forma: "supermotard", scarichi: 2, modello3d: "SM450"
  },
  strada700: {
    nome: "MRW Strada 700",
    categoria: "Stradale",
    motore: "Bicilindrico 700 cc",
    cv: 75, kg: 195, vmax: 205,
    frenata: 9.5, agilita: 1.9, pieghaMax: 0.85, fuoristrada: 35,
    marce: [0.27, 0.41, 0.54, 0.68, 0.84, 1.0], minimo: 1300, limitatore: 9500, cilindri: 2,
    colori: { telaio: 0x2b2d31, carena: 0x3d5a46, grafica: 0xd9c9a3, sella: 0x3a2a20 },
    forma: "stradale", modello3d: "STRADA700"
  },
  naked890: {
    nome: "MRW Naked 890",
    categoria: "Naked",
    motore: "Bicilindrico 890 cc",
    cv: 115, kg: 185, vmax: 230,
    frenata: 10.5, agilita: 2.0, pieghaMax: 0.9, fuoristrada: 40,
    marce: [0.28, 0.42, 0.55, 0.68, 0.83, 1.0], minimo: 1400, limitatore: 10500, cilindri: 2,
    colori: { telaio: 0x2b2d31, carena: 0x5b6470, grafica: 0xf2c200, sella: 0x1d1d1d },
    forma: "naked", modello3d: "NAKED890"
  },
  sport1000: {
    nome: "MRW Sport 1000 RR",
    categoria: "Sportiva",
    motore: "Quattro cilindri 1000 cc",
    cv: 205, kg: 200, vmax: 295,
    frenata: 11.5, agilita: 1.6, pieghaMax: 1.0, fuoristrada: 30,
    marce: [0.33, 0.47, 0.60, 0.72, 0.86, 1.0], minimo: 1500, limitatore: 14000, cilindri: 4,
    colori: { telaio: 0x2b2d31, carena: 0x1f4fa8, grafica: 0xffffff, sella: 0x1d1d1d },
    forma: "sportiva", modello3d: "SPORT1000"
  },
  enduro450: {
    nome: "MRW Enduro 450",
    categoria: "Enduro",
    motore: "Monocilindrico 450 cc",
    cv: 55, kg: 115, vmax: 150,
    frenata: 8.5, agilita: 2.3, pieghaMax: 0.75, fuoristrada: 95,
    marce: [0.25, 0.38, 0.52, 0.67, 0.83, 1.0], minimo: 1700, limitatore: 11500, cilindri: 1,
    colori: { telaio: 0x3a3d42, carena: 0x1b2f5c, grafica: 0xe8e8e8, sella: 0x111111 },
    forma: "enduro", modello3d: "ENDURO450"
  },
  scooter125: {
    nome: "MRW Scooter 125",
    categoria: "Scooter",
    motore: "Monocilindrico 125 cc, automatico",
    cv: 15, kg: 140, vmax: 105,
    frenata: 7.5, agilita: 2.5, pieghaMax: 0.65, fuoristrada: 30,
    marce: [1.0], minimo: 1700, limitatore: 9000, cilindri: 1,
    colori: { telaio: 0x2b2d31, carena: 0x8fd3c1, grafica: 0xffffff, sella: 0x3a2a20 },
    forma: "scooter", modello3d: "SCOOTER125"
  }
};

export const ORDINE = ["sm450", "sm690", "strada700", "naked890", "sport1000", "enduro450", "scooter125"];

// Accelerazione massima (m/s2): potenza / peso, ma al massimo 11 (la ruota davanti si alzerebbe)
export function accelerazioneMax(scheda) {
  return Math.min(11, 3 + 14 * (scheda.cv / scheda.kg));
}

// --- Pezzi 3D ---------------------------------------------------------------------
function materiale(colore, lucido) {
  return lucido
    ? new THREE.MeshPhongMaterial({ color: colore, shininess: 80 })
    : new THREE.MeshLambertMaterial({ color: colore });
}

function scatola(l, a, p, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), mat);
  m.position.set(x, y, z);
  return m;
}

function tubo(r, lunghezza, mat) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, lunghezza, 8), mat);
}

// Tubo tra due punti (per forcella, telaio, braccia del pilota...)
function tuboTra(r, a, b, mat) {
  const da = new THREE.Vector3(...a);
  const a2 = new THREE.Vector3(...b);
  const lunghezza = da.distanceTo(a2);
  const m = tubo(r, lunghezza, mat);
  m.position.copy(da).add(a2).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a2.clone().sub(da).normalize());
  return m;
}

// Ruota: gomma (toro), cerchio, mozzo e razze. Gira attorno all'asse X.
function ruota(raggio, larghezza, tassellata, coloreCerchio) {
  const gruppo = new THREE.Group();
  const gomma = new THREE.Mesh(new THREE.TorusGeometry(raggio - larghezza / 2, larghezza / 2, 10, 28),
    materiale(tassellata ? 0x2a2a2a : 0x151515));
  gomma.rotation.y = Math.PI / 2;
  gruppo.add(gomma);
  const metallo = materiale(coloreCerchio, true);
  const cerchio = new THREE.Mesh(new THREE.TorusGeometry(raggio - larghezza, 0.018, 6, 28), metallo);
  cerchio.rotation.y = Math.PI / 2;
  gruppo.add(cerchio);
  const mozzo = tubo(0.05, 0.14, metallo);
  mozzo.rotation.z = Math.PI / 2;
  gruppo.add(mozzo);
  const razze = tassellata ? 12 : 5;
  for (let i = 0; i < razze; i++) {
    const razza = scatola(0.015, raggio - larghezza, tassellata ? 0.008 : 0.03, metallo, 0, 0, 0);
    razza.geometry.translate(0, (raggio - larghezza) / 2, 0);
    razza.rotation.x = (i / razze) * Math.PI * 2;
    gruppo.add(razza);
  }
  // disco del freno
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(raggio * 0.48, raggio * 0.48, 0.008, 20), materiale(0x9a9a9a, true));
  disco.rotation.z = Math.PI / 2;
  disco.position.x = 0.07;
  gruppo.add(disco);
  return gruppo;
}

// --- Costruzione di una moto ---------------------------------------------------
// La moto guarda verso -z. y = 0 e' il suolo.
export function costruisciMoto(scheda) {
  // Moto con il modello 3D vero (se i file ci sono)
  if (scheda.modello3d && modelloPronto(scheda.modello3d)) {
    return costruisciModello3D(scheda.modello3d);
  }
  const c = scheda.colori;
  const telaio = materiale(c.telaio, true);
  const carena = materiale(c.carena, true);
  const grafica = materiale(c.grafica, true);
  const sella = materiale(c.sella);
  const nero = materiale(0x1a1a1a);
  const motore = materiale(0x7c7f86, true);
  const cromo = materiale(0xc9ccd1, true);
  const luce = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });

  const f = scheda.forma;
  // misure per tipo: raggio ruote, passo, altezza sella
  const misure = {
    supermotard: { rDav: 0.31, rDie: 0.31, passo: 1.48, sella: 0.92, largG: 0.12 },
    naked: { rDav: 0.31, rDie: 0.32, passo: 1.42, sella: 0.82, largG: 0.13 },
    stradale: { rDav: 0.31, rDie: 0.32, passo: 1.45, sella: 0.80, largG: 0.13 },
    sportiva: { rDav: 0.31, rDie: 0.32, passo: 1.40, sella: 0.84, largG: 0.13 },
    enduro: { rDav: 0.37, rDie: 0.35, passo: 1.48, sella: 0.96, largG: 0.10 },
    scooter: { rDav: 0.22, rDie: 0.22, passo: 1.33, sella: 0.78, largG: 0.11 }
  }[f];

  const moto = new THREE.Group();
  const zDav = -misure.passo / 2;
  const zDie = misure.passo / 2;

  // Ruota dietro + forcellone
  const ruotaDietro = ruota(misure.rDie, misure.largG + 0.02, f === "enduro", f === "scooter" ? 0x9a9a9a : 0x222222);
  ruotaDietro.position.set(0, misure.rDie, zDie);
  moto.add(ruotaDietro);
  if (f !== "scooter") {
    moto.add(tuboTra(0.03, [0.09, misure.rDie, zDie], [0.07, 0.42, 0.05], telaio));
    moto.add(tuboTra(0.03, [-0.09, misure.rDie, zDie], [-0.07, 0.42, 0.05], telaio));
    moto.add(tuboTra(0.025, [0.08, 0.75, 0.15], [0.09, misure.rDie + 0.1, zDie - 0.15], materiale(0xd8a12a, true))); // ammortizzatore
  }

  // Gruppo sterzo (forcella, ruota davanti, manubrio, faro): gira con lo sterzo
  // Lo sterzo e' inclinato di 0.42 rad (circa 24 gradi): la ruota davanti sta piu' avanti del manubrio
  const INCLINAZIONE = 0.42;
  const altezzaTesta = f === "scooter" ? 0.95 : 1.0;
  const lunghezzaForcella = (altezzaTesta - misure.rDav) / Math.cos(INCLINAZIONE);
  const testa = new THREE.Vector3(0, altezzaTesta, zDav + lunghezzaForcella * Math.sin(INCLINAZIONE));
  const sterzo = new THREE.Group();
  sterzo.position.copy(testa);
  sterzo.rotation.x = INCLINAZIONE;
  moto.add(sterzo);
  const ruotaDavanti = ruota(misure.rDav, misure.largG, f === "enduro", f === "scooter" ? 0x9a9a9a : 0x222222);
  // la ruota resta verticale anche se la forcella e' inclinata
  const supportoRuota = new THREE.Group();
  supportoRuota.position.set(0, -lunghezzaForcella, 0);
  supportoRuota.rotation.x = -INCLINAZIONE;
  supportoRuota.add(ruotaDavanti);
  sterzo.add(supportoRuota);
  for (const lato of [-1, 1]) {
    const gamba = tuboTra(0.028, [lato * 0.1, 0.05, 0], [lato * 0.1, -lunghezzaForcella, 0], f === "enduro" || f === "supermotard" ? materiale(0xd8a12a, true) : cromo);
    sterzo.add(gamba);
  }
  // manubrio
  const manubrioY = f === "sportiva" ? 0.0 : 0.18;
  const larghezzaManubrio = f === "sportiva" ? 0.32 : (f === "enduro" || f === "supermotard" ? 0.42 : 0.38);
  sterzo.add(tuboTra(0.016, [-larghezzaManubrio, manubrioY, 0.08], [larghezzaManubrio, manubrioY, 0.08], nero));
  sterzo.add(tuboTra(0.022, [-larghezzaManubrio, manubrioY, 0.08], [-larghezzaManubrio + 0.12, manubrioY, 0.08], materiale(0x333333)));
  sterzo.add(tuboTra(0.022, [larghezzaManubrio - 0.12, manubrioY, 0.08], [larghezzaManubrio, manubrioY, 0.08], materiale(0x333333)));

  // Parafango davanti: alto per enduro e supermotard, basso per le altre
  if (f === "enduro" || f === "supermotard") {
    const parafango = scatola(0.16, 0.03, 0.55, grafica, 0, -0.12, -0.08);
    parafango.rotation.x = -0.35;
    sterzo.add(parafango);
  } else {
    const parafango = scatola(0.15, 0.03, 0.4, carena, 0, misure.rDav + 0.06, 0);
    supportoRuota.add(parafango);
  }

  // Faro e strumentazione
  if (f === "naked" || f === "stradale") {
    if (f === "stradale") {
      const cupolino = scatola(0.34, 0.22, 0.04, new THREE.MeshPhongMaterial({ color: 0x88aacc, transparent: true, opacity: 0.45 }), 0, 0.16, -0.1);
      cupolino.rotation.x = -0.35;
      sterzo.add(cupolino);
    }
    const faro = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 18), cromo);
    faro.rotation.x = Math.PI / 2;
    faro.position.set(0, 0.0, -0.08);
    sterzo.add(faro);
    const vetro = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), luce);
    vetro.rotation.y = Math.PI;
    vetro.position.set(0, 0.0, -0.135);
    sterzo.add(vetro);
  } else if (f === "supermotard" || f === "enduro") {
    const tabella = scatola(0.2, 0.26, 0.05, carena, 0, 0.0, -0.1);   // portafaro stile tabella
    sterzo.add(tabella);
    sterzo.add(scatola(0.1, 0.06, 0.02, luce, 0, -0.02, -0.13));
    const parabrezzaSm = scatola(0.18, 0.08, 0.02, grafica, 0, 0.13, -0.1);
    sterzo.add(parabrezzaSm);
  } else if (f === "scooter") {
    const scudo = scatola(0.42, 0.62, 0.06, carena, 0, -0.3, -0.05);
    sterzo.add(scudo);
    sterzo.add(scatola(0.2, 0.07, 0.03, luce, 0, 0.12, -0.12));
  }

  // Corpo della moto
  if (f === "scooter") {
    moto.add(scatola(0.34, 0.08, 0.6, nero, 0, 0.32, -0.05));              // pedana
    moto.add(scatola(0.34, 0.4, 0.62, carena, 0, 0.55, 0.38));            // scocca posteriore
    moto.add(scatola(0.3, 0.1, 0.62, sella, 0, misure.sella, 0.33));      // sella
    moto.add(scatola(0.2, 0.18, 0.4, motore, 0.12, 0.3, 0.45));           // motore e trasmissione
    moto.add(scatola(0.16, 0.06, 0.04, materiale(0xd8232a), 0, 0.6, 0.7)); // fanale dietro
  } else {
    // telaio
    moto.add(tuboTra(0.035, [0.1, testa.y - 0.05, testa.z + 0.05], [0.1, 0.5, 0.1], telaio));
    moto.add(tuboTra(0.035, [-0.1, testa.y - 0.05, testa.z + 0.05], [-0.1, 0.5, 0.1], telaio));
    // motore
    if (scheda.cilindri === 4) {
      moto.add(scatola(0.46, 0.32, 0.42, motore, 0, 0.42, -0.08));
    } else if (scheda.cilindri === 2) {
      moto.add(scatola(0.32, 0.34, 0.44, motore, 0, 0.44, -0.05));
      const cilindro = scatola(0.22, 0.3, 0.16, motore, 0, 0.66, -0.22);
      cilindro.rotation.x = -0.4;
      moto.add(cilindro);
    } else {
      moto.add(scatola(0.24, 0.3, 0.34, motore, 0, 0.44, 0.0));
      const cilindro = scatola(0.16, 0.28, 0.16, motore, 0, 0.66, -0.1);
      cilindro.rotation.x = -0.3;
      moto.add(cilindro);
    }
    // serbatoio, fianchetti, sella, codino
    const lungoSerb = f === "enduro" || f === "supermotard" ? 0.4 : 0.48;
    const serbatoio = scatola(f === "naked" || f === "stradale" ? 0.36 : 0.3, 0.2, lungoSerb, carena, 0, misure.sella - 0.04, -0.12);
    serbatoio.rotation.x = f === "sportiva" ? 0.12 : 0.05;
    moto.add(serbatoio);
    moto.add(scatola(0.32, 0.03, 0.2, grafica, 0, misure.sella + 0.07, -0.1));   // grafica sul serbatoio
    const lungoSella = f === "enduro" || f === "supermotard" ? 0.75 : 0.42;
    moto.add(scatola(0.24, 0.08, lungoSella, sella, 0, misure.sella, f === "enduro" || f === "supermotard" ? 0.18 : 0.3));
    const codino = scatola(0.2, 0.12, 0.42, carena, 0, misure.sella + (f === "sportiva" ? 0.08 : 0.0), 0.58);
    codino.rotation.x = f === "sportiva" ? -0.25 : -0.12;
    moto.add(codino);
    moto.add(scatola(0.12, 0.05, 0.03, materiale(0xd8232a), 0, misure.sella + 0.02, 0.8)); // fanale dietro
    // fianchetti con il numero (supermotard e enduro)
    if (f === "enduro" || f === "supermotard") {
      for (const lato of [-1, 1]) moto.add(scatola(0.02, 0.18, 0.3, grafica, lato * 0.13, misure.sella - 0.12, 0.3));
    }
    // carena della sportiva
    if (f === "sportiva") {
      const cupolino = scatola(0.42, 0.34, 0.5, carena, 0, 0.88, -0.48);
      cupolino.rotation.x = 0.45;
      moto.add(cupolino);
      const parabrezza = scatola(0.3, 0.18, 0.02, new THREE.MeshPhongMaterial({ color: 0x88aacc, transparent: true, opacity: 0.5 }), 0, 1.08, -0.52);
      parabrezza.rotation.x = 0.9;
      moto.add(parabrezza);
      for (const lato of [-1, 1]) {
        const fianco = scatola(0.03, 0.4, 0.75, carena, lato * 0.24, 0.55, -0.2);
        moto.add(fianco);
        moto.add(scatola(0.032, 0.06, 0.6, grafica, lato * 0.245, 0.62, -0.2));
        moto.add(scatola(0.06, 0.04, 0.02, luce, lato * 0.09, 0.86, -0.74));   // fari doppi
      }
    }
    // scarico
    if (f === "sportiva") {
      moto.add(tuboTra(0.06, [0.0, 0.25, -0.1], [0.0, 0.22, 0.25], cromo));    // scarico sotto
    } else if (f === "supermotard" || f === "enduro") {
      moto.add(tuboTra(0.035, [0.1, 0.55, -0.1], [0.16, 0.7, 0.35], cromo));
      moto.add(tuboTra(0.06, [0.16, 0.72, 0.35], [0.17, 0.82, 0.7], materiale(0x404448, true)));  // silenziatore alto
      if (scheda.scarichi === 2) {
        moto.add(tuboTra(0.035, [0.1, 0.55, -0.1], [-0.16, 0.7, 0.35], cromo));
        moto.add(tuboTra(0.06, [-0.16, 0.72, 0.35], [-0.17, 0.82, 0.7], materiale(0x404448, true)));  // secondo silenziatore
      }
    } else {
      moto.add(tuboTra(0.035, [0.1, 0.35, -0.1], [0.15, 0.32, 0.3], cromo));
      moto.add(tuboTra(0.07, [0.15, 0.32, 0.3], [0.17, 0.42, 0.62], materiale(0x404448, true)));
    }
  }

  // --- Pilota ---------------------------------------------------------------------
  // Il pilota e' un gruppo a parte: quando si cade si stacca dalla moto e vola via (moto.js)
  const pilota = new THREE.Group();
  const tuta = materiale(0x24324a);
  const casco = materiale(c.grafica === 0xffffff ? 0xffffff : c.grafica, true);
  const visiera = new THREE.MeshPhongMaterial({ color: 0x111820, shininess: 120 });
  const posture = {
    supermotard: { busto: -0.25, spalleZ: -0.05, testaZ: -0.2, avanti: 0.0 },
    enduro: { busto: -0.22, spalleZ: -0.02, testaZ: -0.17, avanti: 0.0 },
    naked: { busto: -0.4, spalleZ: -0.1, testaZ: -0.28, avanti: 0.05 },
    stradale: { busto: -0.3, spalleZ: -0.05, testaZ: -0.22, avanti: 0.0 },
    sportiva: { busto: -1.0, spalleZ: -0.35, testaZ: -0.55, avanti: 0.15 },
    scooter: { busto: 0.0, spalleZ: 0.15, testaZ: 0.07, avanti: 0.0 }
  }[f];
  const sedile = new THREE.Vector3(0, misure.sella + 0.05, f === "scooter" ? 0.3 : 0.2);
  const busto = scatola(0.4, 0.58, 0.26, tuta, 0, 0.29, 0);
  busto.geometry.translate(0, 0, 0);
  const gruppoBusto = new THREE.Group();
  gruppoBusto.position.copy(sedile);
  gruppoBusto.rotation.x = posture.busto;
  gruppoBusto.add(busto);
  const testaPilota = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), casco);
  testaPilota.position.set(0, 0.7, 0);
  gruppoBusto.add(testaPilota);
  const visieraM = new THREE.Mesh(new THREE.SphereGeometry(0.151, 16, 8, Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.35, Math.PI * 0.25), visiera);
  visieraM.position.copy(testaPilota.position);
  gruppoBusto.add(visieraM);
  pilota.add(gruppoBusto);
  // braccia verso il manubrio
  const spalla = new THREE.Vector3(0, 0.52, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), posture.busto).add(sedile);
  const mano = new THREE.Vector3(0, manubrioY, 0.08).applyAxisAngle(new THREE.Vector3(1, 0, 0), INCLINAZIONE).add(testa);
  for (const lato of [-1, 1]) {
    pilota.add(tuboTra(0.05, [lato * 0.2, spalla.y, spalla.z], [lato * (larghezzaManubrio - 0.06), mano.y, mano.z], tuta));
    // gambe: dall'anca alla pedana
    const pedanaY = f === "scooter" ? 0.38 : 0.36;
    const pedanaZ = f === "scooter" ? -0.15 : (f === "sportiva" ? 0.3 : 0.12);
    const ginocchio = [lato * 0.2, misure.sella - 0.05, f === "scooter" ? -0.05 : -0.1];
    pilota.add(tuboTra(0.07, [lato * 0.13, sedile.y, sedile.z], ginocchio, tuta));
    pilota.add(tuboTra(0.055, ginocchio, [lato * 0.17, pedanaY, pedanaZ], tuta));
    pilota.add(scatola(0.09, 0.08, 0.24, nero, lato * 0.17, pedanaY - 0.02, pedanaZ - 0.05));   // stivale
  }

  // L'origine del gruppo pilota va al suo bacino: cosi' quando cade gira attorno al corpo
  const bacino = new THREE.Vector3(0, misure.sella + 0.3, f === "scooter" ? 0.25 : 0.12);
  for (const pezzo of pilota.children) pezzo.position.sub(bacino);
  pilota.position.copy(bacino);
  moto.add(pilota);

  moto.traverse(function (oggetto) {
    oggetto.castShadow = false;
  });
  moto.userData = { ruotaDavanti: ruotaDavanti, ruotaDietro: ruotaDietro, sterzo: sterzo, rDav: misure.rDav, rDie: misure.rDie, passo: misure.passo,
    pilota: pilota, postoPilota: bacino.clone() };
  return moto;
}
