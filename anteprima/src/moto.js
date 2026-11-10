// La moto: guida, marce e giri del motore. Il modello 3D e le prestazioni
// arrivano dal garage (moto_modelli.js).
// "angolo" = direzione della moto. Con angolo 0 la moto va verso NORD (z negativo).

import { quotaTerreno } from "./terreno.js";
import { stradaSotto } from "./strade.js";
import { dentroEdificio } from "./edifici.js";
import { MOTO, costruisciMoto, accelerazioneMax } from "./moto_modelli.js";
import { aggiornaAuto } from "./auto.js";

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
    suStrada: false,
    sterzoDolce: 0,
    vy: 0,              // velocita' verso l'alto (m/s)
    inAria: false,
    molla: 0,           // quanto sono schiacciate le sospensioni (m)
    slittamento: 0,     // oltre 1 la gomma perde aderenza
    caduta: 0,          // secondi a terra dopo una caduta
    motivoCaduta: "",
    velocitaUrto: 0,
    nuovaCaduta: false,
    latoCaduta: 1,
    riparti: false,
    derapata: 0,        // di quanto il dietro della moto e' "girato" fuori (radianti): derapata in entrata di curva
    impennata: 0,       // angolo della ruota davanti in alto (+) o della ruota dietro in alto (-), radianti
    velImpennata: 0
  };
  cambiaMoto(moto, idMoto);
  return moto;
}

// Cambia moto (garage): nuovo modello 3D e nuove prestazioni
export function cambiaMoto(moto, idMoto) {
  if (!MOTO[idMoto]) idMoto = "sm690";
  if (moto.modello) {
    moto.scena.remove(moto.modello);
    moto.scena.remove(moto.modello.userData.pilota);   // se era caduto fuori dalla moto
  }
  moto.id = idMoto;
  moto.scheda = MOTO[idMoto];
  moto.modello = costruisciMoto(moto.scheda);
  moto.modello.rotation.order = "YXZ";
  moto.scena.add(moto.modello);
  moto.velocita = 0;
  moto.caduta = 0;
  moto.volo = null;
}

// Mette la moto in un punto, orientata nella direzione (dx, dz)
export function posizionaMoto(moto, x, y, z, dx, dz) {
  moto.x = x;
  moto.y = y;
  moto.z = z;
  moto.velocita = 0;
  moto.angolo = Math.atan2(-dx, -dz);
  moto.vy = 0;
  moto.inAria = false;
  moto.piega = 0;
  moto.slittamento = 0;
  moto.caduta = 0;
  moto.riparti = false;
  moto.impennata = 0;
  moto.velImpennata = 0;
  moto.derapata = 0;
  moto.direzione = moto.angolo;   // macchina: va dove punta
  moto.giroAuto = 0;
  rimettiPilota(moto);
}

export function quotaSuolo(moto, terreno, strade, x, z) {
  const strada = stradaSotto(strade, x, z, moto.y);
  if (strada !== null && strada.differenza < 6) {
    return { y: strada.y, strada: strada };
  }
  return { y: quotaTerreno(terreno, x, z), strada: null };
}

// Marcia e giri del motore dalla velocita' (cambio automatico)
export function calcolaMarcia(moto) {
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

// --- Fisica -------------------------------------------------------------------
const G = 9.81;                 // gravita' (m/s2)
const ADERENZA_ASFALTO = 1.05;  // gomme stradali su asfalto asciutto
const ADERENZA_PRATO = 0.75;    // erba e terra
const BARICENTRO_ALTO = 0.68;   // altezza del baricentro moto + pilota (m)
const BARICENTRO_DIETRO = 0.62; // distanza del baricentro dalla ruota dietro (m)

// La moto cade: da aggiornaMoto (scivolata, urto, atterraggio). Il resto lo decide danni.js
function cadi(moto, motivo, velocitaUrto) {
  if (moto.caduta > 0) return;
  moto.caduta = 3;   // secondi a terra prima di ripartire
  moto.motivoCaduta = motivo;
  moto.velocitaUrto = Math.abs(velocitaUrto) * 3.6;   // km/h
  moto.nuovaCaduta = true;                            // danni.js la legge una volta sola
  moto.latoCaduta = moto.piega >= 0 ? 1 : -1;

  // Il pilota si stacca dalla moto e vola avanti (resta dov'e' nel mondo, poi va per conto suo)
  const pilota = moto.modello.userData.pilota;
  moto.scena.attach(pilota);
  const dirX = -Math.sin(moto.angolo);
  const dirZ = -Math.cos(moto.angolo);
  const spinta = Math.abs(velocitaUrto) * 0.85;
  moto.volo = {
    vx: dirX * spinta + (Math.random() - 0.5) * 2,
    vy: 1.5 + Math.min(6, spinta * 0.12),
    vz: dirZ * spinta + (Math.random() - 0.5) * 2,
    giroX: -(3 + spinta * 0.25),            // capriola in avanti
    giroZ: (Math.random() - 0.5) * 4,
    fermo: false
  };
}

// Il pilota in volo: gravita', rimbalzi sull'asfalto, poi scivola e si ferma sdraiato
function aggiornaPilota(moto, dt, terreno, strade) {
  const pilota = moto.modello.userData.pilota;
  const volo = moto.volo;
  if (!volo || volo.fermo) return;
  volo.vy -= G * dt;
  pilota.position.x += volo.vx * dt;
  pilota.position.y += volo.vy * dt;
  pilota.position.z += volo.vz * dt;
  pilota.rotation.x += volo.giroX * dt;
  pilota.rotation.z += volo.giroZ * dt;
  const terra = quotaSuolo(moto, terreno, strade, pilota.position.x, pilota.position.z).y + 0.2;
  if (pilota.position.y < terra) {
    // tocca terra: rimbalza poco e striscia
    pilota.position.y = terra;
    volo.vy = Math.abs(volo.vy) > 2 ? -volo.vy * 0.25 : 0;
    const orizzontale = Math.hypot(volo.vx, volo.vz);
    const dopo = Math.max(0, orizzontale - 7 * dt);
    if (orizzontale > 0) {
      volo.vx = volo.vx * dopo / orizzontale;
      volo.vz = volo.vz * dopo / orizzontale;
    }
    volo.giroX *= 0.9;
    volo.giroZ *= 0.9;
    if (dopo < 0.3 && volo.vy === 0) {
      // fermo: sdraiato a pancia in giu'
      volo.fermo = true;
      pilota.rotation.set(-Math.PI / 2, pilota.rotation.y, 0);
      pilota.position.y = terra - 0.05;
    }
  }
}

// Rimette il pilota sulla moto (dopo una caduta o cambiando moto)
function rimettiPilota(moto) {
  const dati = moto.modello.userData;
  if (dati.pilota.parent !== moto.modello) {
    moto.modello.add(dati.pilota);
  }
  dati.pilota.position.copy(dati.postoPilota);
  dati.pilota.rotation.set(0, 0, 0);
  moto.volo = null;
}

export function aggiornaMoto(moto, tasti, dt, terreno, strade, edifici) {
  if (dt <= 0) return;   // fotogramma senza tempo (succede al primo): niente da calcolare
  // La macchina da drift ha la sua fisica (auto.js)
  if (moto.scheda.tipo === "auto") {
    aggiornaAuto(moto, tasti, dt, terreno, strade, edifici);
    return;
  }
  const s = moto.scheda;
  const dati = moto.modello.userData;

  // A terra dopo una caduta: la moto scivola, si ferma e poi si riparte (gioco.js)
  if (moto.caduta > 0) {
    moto.caduta -= dt;
    aggiornaPilota(moto, dt, terreno, strade);
    moto.velocita -= Math.sign(moto.velocita) * Math.min(Math.abs(moto.velocita), 7 * dt);
    moto.x += -Math.sin(moto.angolo) * moto.velocita * dt;
    moto.z += -Math.cos(moto.angolo) * moto.velocita * dt;
    moto.y = quotaSuolo(moto, terreno, strade, moto.x, moto.z).y;
    moto.vy = 0;
    moto.inAria = false;
    moto.gas = 0;
    moto.piega += (moto.latoCaduta * 1.45 - moto.piega) * Math.min(1, dt * 6);
    moto.modello.position.set(moto.x, moto.y, moto.z);
    moto.modello.rotation.set(0, moto.angolo, moto.piega);
    if (moto.caduta <= 0) moto.riparti = true;
    return;
  }

  const avanti = tasti.su;
  const indietro = tasti.giu;
  let sterzo = 0;
  if (tasti.sinistra) sterzo = sterzo + 1;
  if (tasti.destra) sterzo = sterzo - 1;
  // Con la tastiera lo sterzo non e' tutto o niente: arriva al massimo in mezzo secondo
  moto.sterzoDolce += Math.max(-dt * 2.5, Math.min(dt * 2.5, sterzo - moto.sterzoDolce));
  moto.gas += ((avanti ? 1 : 0) - moto.gas) * Math.min(1, dt * 6);

  // Dove sono? Strada, prato o lago
  const sotto = quotaSuolo(moto, terreno, strade, moto.x, moto.z);
  if (!moto.inAria) {
    moto.suStrada = sotto.strada !== null;
    moto.nomeStrada = moto.suStrada ? sotto.strada.nome : "";
    moto.inGalleria = moto.suStrada && sotto.strada.galleria;
  }
  const nelLago = !moto.suStrada && sotto.y < terreno.info.livello_lago + 0.3;

  const vmax = s.vmax / 3.6;   // m/s
  let massima = moto.suStrada ? vmax : s.fuoristrada / 3.6;
  if (nelLago) massima = 3;

  // Aderenza: quanta forza le gomme possono dare (in curva e in frenata insieme)
  const aderenza = moto.suStrada ? ADERENZA_ASFALTO : ADERENZA_PRATO;
  const limite = Math.min(aderenza, Math.tan(s.pieghaMax)) * G;   // m/s2

  let accMotore = 0;   // m/s2 dati dal motore in questo istante
  let accFreni = 0;    // m/s2 tolti dai freni
  if (!moto.inAria) {
    // Gas: piu' potenza = piu' accelerazione; vicino alla velocita' massima si accelera poco
    if (avanti) {
      const quanto = Math.max(0, 1 - Math.pow(Math.max(moto.velocita, 0) / vmax, 2));
      accMotore = Math.min(accelerazioneMax(s), aderenza * G) * quanto;
      // Senza Shift la moto non impenna da sola (e se e' gia' su, torna giu' piano):
      // si toglie la potenza che alzerebbe il davanti
      if (!tasti.pesoDietro) {
        accMotore = Math.min(accMotore, G * BARICENTRO_DIETRO / BARICENTRO_ALTO - 0.3);
      }
      moto.velocita += accMotore * dt;
    }
    // Freno davanti (S / giu') e freno dietro (Spazio). Con la ruota in aria quel freno non frena.
    if (indietro && moto.velocita > 0.5 && moto.impennata < 0.05) accFreni += Math.min(s.frenata, aderenza * G);
    if (tasti.frenoDietro && moto.velocita > 0.5 && moto.impennata > -0.05) accFreni += Math.min(s.frenata, aderenza * G) * 0.4;
    if (accFreni > 0) moto.velocita = Math.max(0, moto.velocita - accFreni * dt);
    if (indietro && moto.velocita <= 0.5) {
      moto.velocita = Math.max(moto.velocita - 3 * dt, -4);   // retromarcia a spinta, piano
    }
    // Freno motore quando si chiude il gas
    if (!avanti && !indietro) {
      moto.velocita -= Math.sign(moto.velocita) * Math.min(Math.abs(moto.velocita), 1.4 * dt);
    }
    if (moto.velocita > massima) {
      moto.velocita = Math.max(massima, moto.velocita - 10 * dt);
    }
    // Salite e discese: la gravita' vera
    moto.velocita -= G * Math.sin(moto.beccheggio) * dt;
  }
  // Aria (vale anche in volo)
  moto.velocita -= moto.velocita * Math.abs(moto.velocita) * 0.0012 * dt;

  const v = Math.abs(moto.velocita);

  // --- Impennata e stoppie ------------------------------------------------------
  // Momento attorno alla ruota che resta a terra: l'accelerazione alza il davanti,
  // la frenata alza il dietro, la gravita' (peso sul baricentro) riporta giu'.
  // Shift = peso indietro (impenna prima), E = peso avanti (stoppie prima).
  if (!moto.inAria) {
    const passo = dati.passo;
    const h = BARICENTRO_ALTO;
    const b = BARICENTRO_DIETRO - (tasti.pesoDietro ? 0.18 : 0);                 // dalla ruota dietro
    const d = passo - BARICENTRO_DIETRO - (tasti.pesoAvanti ? 0.25 : 0);        // dalla ruota davanti
    const angolo = Math.abs(moto.impennata);
    const c = Math.cos(angolo);
    const sn = Math.sin(angolo);
    const alfaSu = ((accMotore - (tasti.frenoDietro ? accFreni : 0)) * h * c - G * (b * c - h * sn)) / (b * b + h * h);
    const alfaGiu = (accFreni * h * c - G * (d * c - h * sn)) / (d * d + h * h);
    if (moto.impennata > 0 || (alfaSu > 0 && v > 1)) {
      moto.velImpennata += alfaSu * dt;
      moto.impennata += moto.velImpennata * dt;
      if (moto.impennata <= 0) {
        moto.impennata = 0;
        moto.velImpennata = 0;
      }
    } else if (moto.impennata < 0 || (alfaGiu > 0 && v > 1)) {
      moto.velImpennata -= alfaGiu * dt;
      moto.impennata += moto.velImpennata * dt;
      if (moto.impennata >= 0 || v < 0.5) {
        moto.impennata = 0;
        moto.velImpennata = 0;
      }
    }
    if (moto.impennata > 1.3) cadi(moto, "Impennata troppo alta: sei andato all'indietro", Math.max(moto.velocita, 9));
    if (moto.impennata < -0.95) cadi(moto, "Stoppie troppo forte: sei volato in avanti", Math.max(moto.velocita, 9));
  }

  // --- Derapata (come i piloti di supermotard in entrata di curva) ---------------
  // Freno dietro (Spazio) tirato forte + sterzo, in velocita': la ruota dietro si blocca e scivola fuori.
  // La moto entra di traverso e gira piu' stretta. Lasciando il freno torna dritta.
  const derapataVoluta = (tasti.frenoDietro && v > 6 && !moto.inAria && moto.impennata < 0.05)
    ? moto.sterzoDolce * 0.6 * Math.min(1, v / 15)
    : 0;
  const rapidita = derapataVoluta !== 0 ? 2.5 : 3.5;
  moto.derapata += Math.max(-rapidita * dt, Math.min(rapidita * dt, derapataVoluta - moto.derapata));

  // --- Curva: le gomme hanno un limite -----------------------------------------
  // Da piano si gira con il manubrio; in velocita' si piega, e la piega dipende da quanta curva chiedi.
  // Sterzo al massimo = tutta l'aderenza delle gomme (non di piu'): si scivola solo frenando in piega
  // o sul prato, non solo perche' si tiene lo sterzo.
  const giroManubrio = moto.sterzoDolce * s.agilita * Math.min(1, v / 3) / (1 + v * 0.05);
  const giroGomme = (moto.sterzoDolce * 0.97 * limite) / Math.max(v, 1);
  let giro = Math.abs(giroManubrio) < Math.abs(giroGomme) ? giroManubrio : giroGomme;
  if (moto.inAria) giro = 0;
  if (moto.impennata > 0.1) giro = giro * 0.35;   // ruota davanti in aria: si gira poco

  // In frenata resta meno aderenza per curvare (cerchio di aderenza)
  const frenata = accFreni;
  // (il pilota dosa il freno in piega: conta il 70% della frenata)
  const disponibile = Math.sqrt(Math.max(0.5, limite * limite - (frenata * 0.7) * (frenata * 0.7)));
  const laterale = v * Math.abs(giro);
  if (Math.abs(moto.derapata) > 0.08) {
    // in derapata la gomma dietro scivola di proposito: la moto gira di piu' (fino al 60% in piu')
    // e non si accumula "slittamento"; ma oltre i 100 km/h di traverso si va per terra (highside)
    giro = giro * (1 + Math.min(0.6, Math.abs(moto.derapata)));
    moto.slittamento = 0;
    if (v > 33 && Math.abs(moto.derapata) > 0.45) cadi(moto, "Derapata troppo veloce: highside", moto.velocita);
  } else if (laterale > disponibile && v > 1) {
    // si chiede troppo: la moto allarga la curva e le gomme cominciano a scivolare
    giro = giro * disponibile / laterale;
    moto.slittamento += dt * (laterale / disponibile - 1) * 3;
  } else {
    moto.slittamento = Math.max(0, moto.slittamento - dt);
  }
  moto.angolo += giro * dt * Math.sign(moto.velocita || 1);
  // Si cade solo se si insiste a lungo: forte (oltre 90 km/h) oppure frenando forte in piega
  if (moto.slittamento > 1.5 && (v > 25 || (frenata > 0 && v > 14))) {
    cadi(moto, "Hai perso aderenza in curva", moto.velocita);
  }

  // --- Movimento -----------------------------------------------------------------
  const dirX = -Math.sin(moto.angolo);
  const dirZ = -Math.cos(moto.angolo);
  let nuovaX = moto.x + dirX * moto.velocita * dt;
  let nuovaZ = moto.z + dirZ * moto.velocita * dt;
  const limiteX = terreno.metaX - 5;
  const limiteZ = terreno.metaZ - 5;
  if (Math.abs(nuovaX) > limiteX || Math.abs(nuovaZ) > limiteZ) {
    nuovaX = Math.min(Math.max(nuovaX, -limiteX), limiteX);
    nuovaZ = Math.min(Math.max(nuovaZ, -limiteZ), limiteZ);
    moto.velocita = 0;
  }
  // Contro un edificio: piano si rimbalza, forte si cade
  // (sulla strada no: a volte la strada passa sotto un edificio, come un portico)
  if (edifici && !moto.suStrada && dentroEdificio(edifici, nuovaX, nuovaZ, moto.y + 0.5)) {
    if (v > 8) {
      cadi(moto, "Sei finito contro un edificio", moto.velocita);
      moto.velocita = 0;
    } else {
      moto.velocita = -moto.velocita * 0.2;
    }
    nuovaX = moto.x;
    nuovaZ = moto.z;
  }
  moto.x = nuovaX;
  moto.z = nuovaZ;

  // --- Gravita': la moto non e' incollata alla strada -------------------------------
  const suolo = quotaSuolo(moto, terreno, strade, moto.x, moto.z);
  if (!moto.inAria) {
    // dove arriverebbe la moto cadendo in questo istante
    // Si stacca solo se il suolo "sparisce" di almeno 25 cm sotto le ruote (una cresta vera,
    // un dosso preso forte): i piccoli cambi di pendenza della strada non fanno saltellare
    const caduta = moto.y + moto.vy * dt - 0.5 * G * dt * dt;
    if (suolo.y < caduta - 0.25 && v > 10) {
      moto.inAria = true;
    } else {
      // velocita' verticale "ammorbidita": un gradino nei dati non diventa un trampolino
      const voluta = (suolo.y - moto.y) / dt;
      moto.vy += (Math.max(-v * 0.5, Math.min(v * 0.5, voluta)) - moto.vy) * 0.3;
      if (!Number.isFinite(moto.vy)) moto.vy = 0;
      moto.y = suolo.y;
    }
  }
  if (moto.inAria) {
    moto.vy -= G * dt;
    moto.y += moto.vy * dt;
    if (moto.y <= suolo.y) {
      // atterraggio: oltre 8 m/s verso il basso (come cadere da piu' di 3 metri) non regge
      if (moto.vy < -11) cadi(moto, "Atterraggio troppo duro", Math.hypot(moto.vy, moto.velocita * 0.3));
      moto.molla = Math.min(0.12, -moto.vy * 0.015);   // le sospensioni si schiacciano
      moto.y = suolo.y;
      moto.vy = 0;
      moto.inAria = false;
    }
  }
  // Sospensioni: tornano su piano
  moto.molla += (0 - moto.molla) * Math.min(1, dt * 6);

  // Inclinazione avanti/indietro (a terra segue la strada, in volo resta com'era)
  if (!moto.inAria) {
    const davanti = quotaSuolo(moto, terreno, strade, moto.x + dirX * 0.8, moto.z + dirZ * 0.8).y;
    const dietro = quotaSuolo(moto, terreno, strade, moto.x - dirX * 0.8, moto.z - dirZ * 0.8).y;
    const voluta = Math.atan2(davanti - dietro, 1.6);
    moto.beccheggio += (voluta - moto.beccheggio) * Math.min(1, dt * 8);
  } else {
    moto.beccheggio += (Math.atan2(moto.vy, Math.max(v, 1)) - moto.beccheggio) * Math.min(1, dt * 2);
  }

  // Piega in curva: tan(piega) = accelerazione laterale / g, come nella realta'
  const piegaVoluta = Math.sign(giro) * Math.min(s.pieghaMax, Math.atan(v * Math.abs(giro) / G));
  moto.piega += (piegaVoluta - moto.piega) * Math.min(1, dt * 5);

  // Sterzo visto (ruota davanti): molto da fermi, poco in velocita'
  const sterzoVoluto = moto.sterzoDolce * 0.45 / (1 + v * 0.25);
  moto.sterzoVisto += (sterzoVoluto - moto.sterzoVisto) * Math.min(1, dt * 8);

  calcolaMarcia(moto);

  // Modello 3D: posizione, inclinazioni, ruote che girano, manubrio
  // Impennata: la moto ruota attorno alla ruota dietro (stoppie: attorno a quella davanti),
  // quindi il centro del modello si alza e si sposta verso la ruota che tocca terra
  const mezzoPasso = dati.passo / 2;
  const su = mezzoPasso * Math.sin(Math.abs(moto.impennata));
  const verso = moto.impennata >= 0 ? 1 : -1;   // 1 = verso la ruota dietro
  const indietroM = mezzoPasso * (1 - Math.cos(moto.impennata)) * verso;
  moto.modello.position.set(moto.x - dirX * indietroM, moto.y - moto.molla + su, moto.z - dirZ * indietroM);
  // in derapata il dietro esce: la moto e' girata verso l'interno della curva rispetto a dove va
  moto.modello.rotation.set(moto.beccheggio + moto.impennata, moto.angolo + moto.derapata, moto.piega);
  dati.ruotaDavanti.rotation.x -= (moto.velocita * dt) / dati.rDav;
  dati.ruotaDietro.rotation.x -= (moto.velocita * dt) / dati.rDie;
  dati.sterzo.rotation.y = moto.sterzoVisto;
}
