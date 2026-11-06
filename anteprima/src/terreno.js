// Terreno: legge i dati swisstopo preparati dal passo 7 e costruisce la mesh 3D.
// Coordinate: x = est, y = quota (metri), z = sud. Il centro (0, 0) e' il centro dell'area.
//
// Il terreno e' diviso in pezzi da 2 x 2 km. Ogni pezzo ha:
// - una versione "lontana" leggera (un punto ogni 16 m), sempre presente;
// - una versione "vicina" dettagliata (un punto ogni 4 m), creata solo vicino alla moto.
// Se c'e' la foto aerea SWISSIMAGE del pezzo (passo 8), il terreno la usa come colore.

import * as THREE from "three";

const QUAD_PEZZO = 508;   // 508 x 3.94 m = 2000 m

export async function caricaTerreno() {
  const rispostaInfo = await fetch("dati/terreno.json");
  if (!rispostaInfo.ok) {
    throw new Error("Mancano i dati del terreno: " + (await rispostaInfo.text()));
  }
  const info = await rispostaInfo.json();
  // I dati vecchi (fino alla 0.7) erano quadrati: "punti" e "lato_m"
  const colonne = info.colonne || info.punti;
  const righe = info.righe || info.punti;
  const latoX = info.lato_x_m || info.lato_m;
  const latoZ = info.lato_z_m || info.lato_m;

  const rispostaBin = await fetch("dati/terreno.bin");
  if (!rispostaBin.ok) {
    throw new Error("Mancano i dati del terreno: " + (await rispostaBin.text()));
  }
  const valori = new Uint16Array(await rispostaBin.arrayBuffer());

  // Trasformo i numeri del file in quote in metri
  const quote = new Float32Array(valori.length);
  for (let i = 0; i < valori.length; i++) {
    quote[i] = info.quota_base + valori[i] * info.scala_quota;
  }

  // Boschi (facoltativo): 1 = bosco, 0 = niente
  let bosco = null;
  const rispostaBosco = await fetch("dati/bosco.bin");
  if (rispostaBosco.ok) {
    bosco = new Uint8Array(await rispostaBosco.arrayBuffer());
  }

  return {
    info: info,
    colonne: colonne,
    righe: righe,
    passo: info.passo_m,
    metaX: latoX / 2,
    metaZ: latoZ / 2,
    quote: quote,
    bosco: bosco
  };
}

// La moto (o un oggetto) e' dentro l'area del terreno? (con un margine in metri)
export function dentroArea(terreno, x, z, margine) {
  return Math.abs(x) < terreno.metaX - margine && Math.abs(z) < terreno.metaZ - margine;
}

// C'e' bosco nel punto (x, z)?
export function boscoQui(terreno, x, z) {
  if (terreno.bosco === null) return false;
  const colonna = Math.round((x + terreno.metaX) / terreno.passo);
  const riga = Math.round((z + terreno.metaZ) / terreno.passo);
  if (colonna < 0 || riga < 0 || colonna >= terreno.colonne || riga >= terreno.righe) return false;
  return terreno.bosco[riga * terreno.colonne + colonna] === 1;
}

// Quota del terreno in un punto qualsiasi (media tra i 4 punti vicini)
export function quotaTerreno(terreno, x, z) {
  const n = terreno.colonne;
  let colonna = (x + terreno.metaX) / terreno.passo;
  let riga = (z + terreno.metaZ) / terreno.passo;
  colonna = Math.min(Math.max(colonna, 0), terreno.colonne - 1.001);
  riga = Math.min(Math.max(riga, 0), terreno.righe - 1.001);
  const c0 = Math.floor(colonna);
  const r0 = Math.floor(riga);
  const fx = colonna - c0;
  const fy = riga - r0;
  const q = terreno.quote;
  const sopra = q[r0 * n + c0] * (1 - fx) + q[r0 * n + c0 + 1] * fx;
  const sotto = q[(r0 + 1) * n + c0] * (1 - fx) + q[(r0 + 1) * n + c0 + 1] * fx;
  return sopra * (1 - fy) + sotto * fy;
}

// Colore di un punto (solo se manca la foto aerea)
function coloreTerreno(quota, pendenza, livelloLago, bosco, colore) {
  if (quota < livelloLago + 0.6) {
    colore.setRGB(0.62, 0.57, 0.45);
  } else if (bosco && pendenza < 1.4) {
    const variazione = (Math.sin(quota * 0.11) + 1) * 0.02;
    colore.setRGB(0.15 + variazione, 0.27 + variazione, 0.12);
  } else if (pendenza > 0.9) {
    colore.setRGB(0.45, 0.43, 0.40);
  } else if (quota > 1700) {
    colore.setRGB(0.55, 0.58, 0.45);
  } else {
    const variazione = (Math.sin(quota * 0.05) + 1) * 0.03;
    colore.setRGB(0.26 + variazione, 0.42 + variazione, 0.20);
  }
}

// Crea la geometria di un pezzo di terreno, prendendo un punto ogni "salto"
function creaGeometriaPezzo(terreno, inizioColonna, inizioRiga, salto, centroX, centroZ) {
  const n = terreno.colonne;
  const lato = QUAD_PEZZO / salto + 1;
  const posizioni = new Float32Array(lato * lato * 3);
  const colori = new Float32Array(lato * lato * 3);
  const uv = new Float32Array(lato * lato * 2);
  const colore = new THREE.Color();
  const q = terreno.quote;

  for (let r = 0; r < lato; r++) {
    for (let c = 0; c < lato; c++) {
      const riga = inizioRiga + r * salto;
      const colonna = inizioColonna + c * salto;
      let quota = q[riga * n + colonna];
      if (salto > 1) {
        // da lontano: il punto piu' basso dei vicini, cosi' il terreno non copre le strade
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = Math.min(Math.max(riga + dr, 0), terreno.righe - 1);
            const cc = Math.min(Math.max(colonna + dc, 0), n - 1);
            quota = Math.min(quota, q[rr * n + cc]);
          }
        }
      }
      const indice = (r * lato + c) * 3;
      posizioni[indice] = colonna * terreno.passo - terreno.metaX - centroX;
      posizioni[indice + 1] = quota;
      posizioni[indice + 2] = riga * terreno.passo - terreno.metaZ - centroZ;
      uv[(r * lato + c) * 2] = c / (lato - 1);
      uv[(r * lato + c) * 2 + 1] = r / (lato - 1);

      const destra = q[riga * n + Math.min(colonna + 1, n - 1)];
      const sotto = q[Math.min(riga + 1, terreno.righe - 1) * n + colonna];
      const pendenza = Math.hypot(destra - quota, sotto - quota) / terreno.passo;
      const bosco = terreno.bosco !== null && terreno.bosco[riga * n + colonna] === 1;
      coloreTerreno(quota, pendenza, terreno.info.livello_lago, bosco, colore);
      colori[indice] = colore.r;
      colori[indice + 1] = colore.g;
      colori[indice + 2] = colore.b;
    }
  }

  const indici = [];
  for (let r = 0; r < lato - 1; r++) {
    for (let c = 0; c < lato - 1; c++) {
      const a = r * lato + c;
      const b = a + 1;
      const d = a + lato;
      const e = d + 1;
      indici.push(a, d, b, b, d, e);
    }
  }

  // Calcolo la luce (normali) solo sulla griglia vera
  const griglia = new THREE.BufferGeometry();
  griglia.setAttribute("position", new THREE.BufferAttribute(posizioni, 3));
  griglia.setIndex(indici);
  griglia.computeVertexNormals();
  const normali = griglia.attributes.normal.array;

  // "Gonna": lungo i 4 bordi una striscia che scende di 40 m (copre le fessure tra pezzi)
  const bordo = [];
  for (let i = 0; i < lato; i++) bordo.push(i);
  for (let i = 1; i < lato; i++) bordo.push(i * lato + lato - 1);
  for (let i = lato - 2; i >= 0; i--) bordo.push((lato - 1) * lato + i);
  for (let i = lato - 2; i >= 0; i--) bordo.push(i * lato);

  const totale = lato * lato + bordo.length;
  const pos2 = new Float32Array(totale * 3);
  const col2 = new Float32Array(totale * 3);
  const nor2 = new Float32Array(totale * 3);
  const uv2 = new Float32Array(totale * 2);
  pos2.set(posizioni);
  col2.set(colori);
  nor2.set(normali);
  uv2.set(uv);
  for (let k = 0; k < bordo.length; k++) {
    const da = bordo[k];
    const a = lato * lato + k;
    for (let j = 0; j < 3; j++) {
      pos2[a * 3 + j] = posizioni[da * 3 + j];
      col2[a * 3 + j] = colori[da * 3 + j];
      nor2[a * 3 + j] = normali[da * 3 + j];
    }
    pos2[a * 3 + 1] -= 40;
    uv2[a * 2] = uv[da * 2];
    uv2[a * 2 + 1] = uv[da * 2 + 1];
    if (k > 0) {
      const sopra1 = bordo[k - 1];
      const sopra2 = bordo[k];
      const sotto1 = lato * lato + k - 1;
      const sotto2 = lato * lato + k;
      indici.push(sopra1, sotto1, sopra2, sopra2, sotto1, sotto2);
      indici.push(sopra1, sopra2, sotto1, sopra2, sotto2, sotto1);
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(pos2, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(col2, 3));
  geometria.setAttribute("normal", new THREE.BufferAttribute(nor2, 3));
  geometria.setAttribute("uv", new THREE.BufferAttribute(uv2, 2));
  geometria.setIndex(indici);
  return geometria;
}

export function aggiungiTerreno(terreno, scena, disegnatore) {
  const colonnePezzi = Math.floor((terreno.colonne - 1) / QUAD_PEZZO);
  const righePezzi = Math.floor((terreno.righe - 1) / QUAD_PEZZO);
  const latoPezzo = QUAD_PEZZO * terreno.passo;
  const caricatore = new THREE.TextureLoader();
  const anisotropia = disegnatore ? disegnatore.capabilities.getMaxAnisotropy() : 1;
  const pezzi = [];

  for (let py = 0; py < righePezzi; py++) {
    for (let px = 0; px < colonnePezzi; px++) {
      const centroX = (px + 0.5) * latoPezzo - terreno.metaX;
      const centroZ = (py + 0.5) * latoPezzo - terreno.metaZ;
      // Il terreno si vede solo da sopra: cosi' dentro le gallerie non copre il tubo
      const materiale = new THREE.MeshLambertMaterial({ vertexColors: true });
      const lontano = new THREE.Mesh(
        creaGeometriaPezzo(terreno, px * QUAD_PEZZO, py * QUAD_PEZZO, 4, centroX, centroZ), materiale);
      lontano.position.set(centroX, 0, centroZ);
      scena.add(lontano);
      const pezzo = { px: px, py: py, centroX: centroX, centroZ: centroZ, materiale: materiale, lontano: lontano, vicino: null };
      pezzi.push(pezzo);

      // Foto aerea SWISSIMAGE (se c'e')
      caricatore.load("dati/foto/foto_x" + px + "_y" + py + ".jpg", function (foto) {
        foto.flipY = false;
        foto.colorSpace = THREE.SRGBColorSpace;
        foto.anisotropy = anisotropia;
        materiale.map = foto;
        materiale.vertexColors = false;
        materiale.needsUpdate = true;
      }, undefined, function () {
        // nessuna foto: restano i colori calcolati
      });
    }
  }

  // Lago Maggiore: una superficie d'acqua alla quota del lago
  const lago = new THREE.Mesh(
    new THREE.PlaneGeometry(terreno.metaX * 2, terreno.metaZ * 2),
    new THREE.MeshLambertMaterial({ color: 0x2e6a92 })
  );
  lago.rotation.x = -Math.PI / 2;
  lago.position.y = terreno.info.livello_lago;
  scena.add(lago);

  return { terreno: terreno, scena: scena, pezzi: pezzi, latoPezzo: latoPezzo, fattore: 1.2, attesa: 0 };
}

// Crea i pezzi dettagliati vicino a (x, z) e toglie quelli lontani.
// Al massimo un pezzo nuovo alla volta, cosi' il gioco non si blocca.
export function aggiornaTerreno(terrenoMesh, x, z, dt) {
  terrenoMesh.attesa -= dt;
  if (terrenoMesh.attesa > 0) return;
  terrenoMesh.attesa = 0.25;
  const raggio = terrenoMesh.latoPezzo * terrenoMesh.fattore;
  let daCreare = null;
  let distanzaMinima = Infinity;
  for (const pezzo of terrenoMesh.pezzi) {
    const distanza = Math.hypot(pezzo.centroX - x, pezzo.centroZ - z);
    if (pezzo.vicino === null && distanza < raggio && distanza < distanzaMinima) {
      daCreare = pezzo;
      distanzaMinima = distanza;
    }
    if (pezzo.vicino !== null && distanza > raggio + 600) {
      terrenoMesh.scena.remove(pezzo.vicino);
      pezzo.vicino.geometry.dispose();
      pezzo.vicino = null;
      pezzo.lontano.visible = true;
    }
  }
  if (daCreare !== null) {
    const p = daCreare;
    p.vicino = new THREE.Mesh(
      creaGeometriaPezzo(terrenoMesh.terreno, p.px * QUAD_PEZZO, p.py * QUAD_PEZZO, 1, p.centroX, p.centroZ), p.materiale);
    p.vicino.receiveShadow = true;   // ombra della moto sul terreno
    p.vicino.position.set(p.centroX, 0, p.centroZ);
    terrenoMesh.scena.add(p.vicino);
    p.lontano.visible = false;
  }
}

// Crea subito i pezzi dettagliati attorno a un punto (alla partenza)
export function preparaTerrenoVicino(terrenoMesh, x, z) {
  for (let i = 0; i < 9; i++) {
    terrenoMesh.attesa = 0;
    aggiornaTerreno(terrenoMesh, x, z, 0);
  }
}

// Fino a che distanza il terreno usa il dettaglio pieno (menu Impostazioni)
export function impostaDettaglioTerreno(terrenoMesh, fattore) {
  terrenoMesh.fattore = fattore;
  terrenoMesh.attesa = 0;
}
