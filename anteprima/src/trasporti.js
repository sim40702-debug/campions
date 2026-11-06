// Trasporti da OpenStreetMap: ferrovie (binari), funicolari e teleferiche/seggiovie
// con le cabine che si muovono davvero.

import * as THREE from "three";

export async function caricaTrasporti() {
  const trasporti = { ferrovie: [], funivie: [] };
  const r1 = await fetch("dati/ferrovie.json");
  if (r1.ok) trasporti.ferrovie = (await r1.json()).ferrovie;
  const r2 = await fetch("dati/funivie.json");
  if (r2.ok) trasporti.funivie = (await r2.json()).funivie;
  return trasporti;
}

// --- Percorsi: una linea di punti con le distanze, per muoverci sopra ---------------
function creaPercorso(punti) {
  const lunghezze = [0];
  for (let i = 1; i < punti.length; i++) {
    lunghezze.push(lunghezze[i - 1] + punti[i].distanceTo(punti[i - 1]));
  }
  return { punti: punti, lunghezze: lunghezze, totale: lunghezze[lunghezze.length - 1] };
}

// Punto e direzione a "s" metri dall'inizio del percorso
function puntoSulPercorso(percorso, s, punto, direzione) {
  s = Math.min(Math.max(s, 0), percorso.totale);
  let i = 1;
  while (i < percorso.lunghezze.length - 1 && percorso.lunghezze[i] < s) i++;
  const a = percorso.punti[i - 1];
  const b = percorso.punti[i];
  const tratto = percorso.lunghezze[i] - percorso.lunghezze[i - 1] || 1;
  punto.lerpVectors(a, b, (s - percorso.lunghezze[i - 1]) / tratto);
  direzione.subVectors(b, a).normalize();
}

// Una striscia (nastro) lungo dei punti, spostata di lato di "spostamento"
function nastro(posizioni, punti, larghezza, spostamento, alzata) {
  let prima = null;
  for (let i = 0; i < punti.length; i++) {
    const a = punti[Math.max(i - 1, 0)];
    const b = punti[Math.min(i + 1, punti.length - 1)];
    let dx = b.x - a.x;
    let dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const cx = punti[i].x - dz * spostamento;
    const cz = punti[i].z + dx * spostamento;
    const y = punti[i].y + alzata;
    const ora = [cx - dz * larghezza / 2, y, cz + dx * larghezza / 2, cx + dz * larghezza / 2, y, cz - dx * larghezza / 2];
    if (prima) {
      posizioni.push(prima[0], prima[1], prima[2], ora[0], ora[1], ora[2], prima[3], prima[4], prima[5]);
      posizioni.push(prima[3], prima[4], prima[5], ora[0], ora[1], ora[2], ora[3], ora[4], ora[5]);
    }
    prima = ora;
  }
}

function mesh(posizioni, colore, offset) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({
    color: colore, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset
  }));
}

function vettoriDa(p, passo) {
  const punti = [];
  for (let i = 0; i + 2 < p.length; i += passo) punti.push(new THREE.Vector3(p[i], p[i + 1], p[i + 2]));
  return punti;
}

// Unisce i pezzi di una linea (in OSM spesso e' divisa in tanti tratti) in catene continue
function unisciPezzi(pezzi) {
  const rimasti = pezzi.map(function (p) { return p.slice(); });
  const catene = [];
  while (rimasti.length > 0) {
    let catena = rimasti.shift();
    let aggiunto = true;
    while (aggiunto) {
      aggiunto = false;
      for (let i = 0; i < rimasti.length; i++) {
        const pezzo = rimasti[i];
        const inizio = catena[0], fine = catena[catena.length - 1];
        if (fine.distanceTo(pezzo[0]) < 1.5) catena = catena.concat(pezzo.slice(1));
        else if (fine.distanceTo(pezzo[pezzo.length - 1]) < 1.5) catena = catena.concat(pezzo.slice().reverse().slice(1));
        else if (inizio.distanceTo(pezzo[pezzo.length - 1]) < 1.5) catena = pezzo.slice(0, -1).concat(catena);
        else if (inizio.distanceTo(pezzo[0]) < 1.5) catena = pezzo.slice().reverse().slice(0, -1).concat(catena);
        else continue;
        rimasti.splice(i, 1);
        aggiunto = true;
        break;
      }
    }
    catene.push(catena);
  }
  return catene;
}

// --- Ferrovie e funicolari -----------------------------------------------------
function aggiungiFerrovie(ferrovie, scena, mobili) {
  const massicciata = [];
  const rotaie = [];

  // Funicolari: tutti i pezzi (anche quelli in galleria) uniti, poi due vetture per linea
  const pezziFunicolare = ferrovie.filter(function (f) { return f.t === "funicular"; })
    .map(function (f) { return vettoriDa(f.p, 3); })
    .filter(function (punti) { return punti.length >= 2; });
  for (const catena of unisciPezzi(pezziFunicolare)) {
    const percorso = creaPercorso(catena.map(function (v) { return v.clone().setY(v.y + 1.4); }));
    if (percorso.totale < 50) continue;
    for (let k = 0; k < 2; k++) {
      const vettura = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 9),
        new THREE.MeshLambertMaterial({ color: k === 0 ? 0xc8232c : 0xf0f0f0 }));
      scena.add(vettura);
      mobili.push({ tipo: "funicolare", oggetto: vettura, percorso: percorso, fase: k * 0.5, velocita: 4 });
    }
  }

  for (const f of ferrovie) {
    if (f.g) continue;   // in galleria non si vede
    const punti = vettoriDa(f.p, 3);
    if (punti.length < 2) continue;
    const scartamento = f.t === "rail" ? 0.72 : 0.5;   // binario normale o a scartamento ridotto
    nastro(massicciata, punti, 3.2, 0, 0);
    nastro(rotaie, punti, 0.08, -scartamento, 0.15);
    nastro(rotaie, punti, 0.08, scartamento, 0.15);
  }
  if (massicciata.length > 0) scena.add(mesh(massicciata, 0x7a7065, -3));
  if (rotaie.length > 0) scena.add(mesh(rotaie, 0x3c3c3c, -5));
}

// --- Teleferiche e seggiovie -----------------------------------------------------
const ALTEZZA_PILONE = { cable_car: 22, gondola: 14, chair_lift: 9, mixed_lift: 12 };
const DISTANZA_FUNI = { cable_car: 3, gondola: 2.5, chair_lift: 1.6, mixed_lift: 2 };

function aggiungiFunivie(funivie, scena, mobili) {
  const cemento = new THREE.MeshLambertMaterial({ color: 0x9c9b95 });
  const acciaio = new THREE.MeshLambertMaterial({ color: 0x6c7077 });
  const materialeFune = new THREE.LineBasicMaterial({ color: 0x222222 });

  for (const f of funivie) {
    const altezza = ALTEZZA_PILONE[f.t] || 12;
    const meta = DISTANZA_FUNI[f.t] || 2;
    // punti della fune: [x, quota terreno, z, stazione?]
    const appoggi = [];
    for (let i = 0; i + 3 < f.p.length; i += 4) {
      const stazione = f.p[i + 3] === 1;
      appoggi.push({ v: new THREE.Vector3(f.p[i], f.p[i + 1] + (stazione ? 6 : altezza), f.p[i + 2]), stazione: stazione, suolo: f.p[i + 1] });
    }
    if (appoggi.length < 2) continue;

    // Fune con la "pancia" tra un appoggio e l'altro (2 % della campata)
    const centro = [];
    for (let i = 0; i < appoggi.length - 1; i++) {
      const a = appoggi[i].v, b = appoggi[i + 1].v;
      const pancia = a.distanceTo(b) * 0.02;
      for (let k = 0; k < 16; k++) {
        const t = k / 16;
        const v = new THREE.Vector3().lerpVectors(a, b, t);
        v.y -= 4 * pancia * t * (1 - t);
        centro.push(v);
      }
    }
    centro.push(appoggi[appoggi.length - 1].v.clone());

    // Due funi: una per salire (destra) e una per scendere (sinistra)
    const funi = [];
    for (const lato of [1, -1]) {
      const punti = centro.map(function (v, i) {
        const a = centro[Math.max(i - 1, 0)], b = centro[Math.min(i + 1, centro.length - 1)];
        const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
        return new THREE.Vector3(v.x - (dz / l) * meta * lato, v.y, v.z + (dx / l) * meta * lato);
      });
      scena.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(punti), materialeFune));
      funi.push(creaPercorso(punti));
    }

    // Piloni e stazioni
    for (let i = 0; i < appoggi.length; i++) {
      const a = appoggi[i];
      const vicino = appoggi[i === 0 ? 1 : i - 1].v;
      const angolo = Math.atan2(vicino.x - a.v.x, vicino.z - a.v.z);
      if (a.stazione) {
        const stazione = new THREE.Mesh(new THREE.BoxGeometry(meta * 2 + 8, 8, 14), cemento);
        stazione.position.set(a.v.x, a.suolo + 4, a.v.z);
        stazione.rotation.y = angolo;
        scena.add(stazione);
      } else {
        const alto = a.v.y - a.suolo;
        const colonna = new THREE.Mesh(new THREE.BoxGeometry(0.9, alto, 0.9), acciaio);
        colonna.position.set(a.v.x, a.suolo + alto / 2, a.v.z);
        const traversa = new THREE.Mesh(new THREE.BoxGeometry(meta * 2 + 1.5, 0.5, 0.6), acciaio);
        traversa.position.set(a.v.x, a.v.y + 0.3, a.v.z);
        traversa.rotation.y = angolo + Math.PI / 2;
        colonna.rotation.y = angolo;
        scena.add(colonna, traversa);
      }
    }

    // Cabine
    if (f.t === "cable_car") {
      // funivia "a va e vieni": due cabine grandi, una sale mentre l'altra scende
      for (let k = 0; k < 2; k++) {
        const cabina = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 4.5), new THREE.MeshLambertMaterial({ color: 0xd8232a }));
        scena.add(cabina);
        mobili.push({ tipo: "va_e_vieni", oggetto: cabina, funi: funi, lato: k, velocita: 8, fase: 0 });
      }
    } else {
      // cabinovia o seggiovia: tante cabine che girano in tondo
      const seggiovia = f.t === "chair_lift";
      const distanza = seggiovia ? 22 : 70;
      const quante = Math.max(2, Math.floor((funi[0].totale * 2) / distanza));
      const forma = seggiovia ? new THREE.BoxGeometry(2.2, 0.5, 0.8) : new THREE.BoxGeometry(2, 2.2, 2);
      const cabine = new THREE.InstancedMesh(forma, new THREE.MeshLambertMaterial({ color: seggiovia ? 0x30343a : 0xf2c200 }), quante);
      cabine.frustumCulled = false;
      scena.add(cabine);
      mobili.push({ tipo: "anello", oggetto: cabine, funi: funi, quante: quante, velocita: seggiovia ? 2.5 : 5 });
    }
  }
}

export function aggiungiTrasporti(trasporti, scena) {
  const mobili = [];
  aggiungiFerrovie(trasporti.ferrovie, scena, mobili);
  aggiungiFunivie(trasporti.funivie, scena, mobili);
  return mobili;
}

// --- Movimento delle cabine (ogni fotogramma) -------------------------------------
const punto = new THREE.Vector3();
const direzione = new THREE.Vector3();
const matrice = new THREE.Matrix4();
const rotazione = new THREE.Quaternion();
const uno = new THREE.Vector3(1, 1, 1);
const avanti = new THREE.Vector3(0, 0, 1);

function avantiIndietro(tempo, durata) {
  // 0 -> 1 -> 0 -> 1 ... (con una pausa di 15 s in stazione)
  const giro = (durata + 15) * 2;
  const t = tempo % giro;
  if (t < durata) return t / durata;
  if (t < durata + 15) return 1;
  if (t < durata * 2 + 15) return 1 - (t - durata - 15) / durata;
  return 0;
}

export function aggiornaTrasporti(mobili, tempo) {
  for (const m of mobili) {
    if (m.tipo === "funicolare") {
      const durata = m.percorso.totale / m.velocita;
      let f = avantiIndietro(tempo, durata);
      if (m.fase > 0) f = 1 - f;
      puntoSulPercorso(m.percorso, f * m.percorso.totale, punto, direzione);
      m.oggetto.position.copy(punto);
      m.oggetto.lookAt(punto.x + direzione.x, punto.y + direzione.y, punto.z + direzione.z);
    } else if (m.tipo === "va_e_vieni") {
      const fune = m.funi[m.lato];
      const durata = fune.totale / m.velocita;
      let f = avantiIndietro(tempo, durata);
      if (m.lato === 1) f = 1 - f;
      puntoSulPercorso(fune, f * fune.totale, punto, direzione);
      m.oggetto.position.set(punto.x, punto.y - 3.2, punto.z);
      m.oggetto.rotation.y = Math.atan2(direzione.x, direzione.z);
    } else if (m.tipo === "anello") {
      const giro = m.funi[0].totale + m.funi[1].totale;
      for (let i = 0; i < m.quante; i++) {
        let s = (tempo * m.velocita + (i * giro) / m.quante) % giro;
        if (s < m.funi[0].totale) {
          puntoSulPercorso(m.funi[0], s, punto, direzione);
        } else {
          s = s - m.funi[0].totale;
          puntoSulPercorso(m.funi[1], m.funi[1].totale - s, punto, direzione);
        }
        direzione.y = 0;
        direzione.normalize();
        rotazione.setFromUnitVectors(avanti, direzione);
        punto.y -= 2.2;
        matrice.compose(punto, rotazione, uno);
        m.oggetto.setMatrixAt(i, matrice);
      }
      m.oggetto.instanceMatrix.needsUpdate = true;
    }
  }
}
