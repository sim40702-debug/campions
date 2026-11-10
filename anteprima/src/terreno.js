// Terreno: legge i dati swisstopo preparati dal passo 7 e costruisce la mesh 3D.
// Coordinate: x = est, y = quota (metri), z = sud. Il centro (0, 0) e' il centro dell'area.
//
// Il terreno e' diviso in pezzi da 2 x 2 km. Ogni pezzo ha:
// - una versione "lontana" leggera (un punto ogni 16 m), sempre presente;
// - una versione "vicina" dettagliata (un punto ogni 4 m), creata solo vicino alla moto.
// Se c'e' la foto aerea SWISSIMAGE del pezzo (passo 8), il terreno la usa come colore.

import * as THREE from "three";
import { creaMaterialeAcqua } from "./onde.js";
import { aggiungiMeteo } from "./meteo_shader.js";
import { usoQui } from "./uso_suolo.js";
import { liberaDopoCaricamento } from "./memoria.js";

const QUAD_PEZZO = 508;   // 508 x 3.94 m = 2000 m

// Materiale del terreno: i colori vengono dai vertici (o dalla foto aerea); un programma della scheda video
// aggiunge una grana fine e macchie di colore a due scale, cosi' il prato non e' una superficie liscia.
function materialeTerreno(ambiente) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = function (shader) {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTerrenoXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTerrenoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec2 vTerrenoXZ;
        float hT(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nT(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hT(i), hT(i + vec2(1.0, 0.0)), f.x), mix(hT(i + vec2(0.0, 1.0)), hT(i + vec2(1.0, 1.0)), f.x), f.y);
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        {
          // distanza dalla camera: vicino grana fine, lontano solo macchie grandi (niente "sfarfallio")
          float d = length(vViewPosition);
          float vicino = 1.0 - smoothstep(60.0, 380.0, d);
          float macro = nT(vTerrenoXZ * 0.045) * 0.6 + nT(vTerrenoXZ * 0.13) * 0.4;
          float micro = nT(vTerrenoXZ * 1.7) * 0.5 + nT(vTerrenoXZ * 5.3) * 0.5;
          float k = 0.84 + macro * 0.32 + (micro - 0.5) * 0.26 * vicino;
          diffuseColor.rgb *= k;
        }`);
  };
  m.customProgramCacheKey = function () { return "terreno-grana"; };
  return aggiungiMeteo(m, ambiente, { neve: 1, bagnato: 0.8 });
}

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

// Colore di un punto (solo se manca la foto aerea): prati, bosco, roccia, ghiaia, riva, neve
function rumore2(a, b) {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}
function coloreTerreno(quota, pendenza, livelloLago, bosco, colore, x, z, uso) {
  const grana = rumore2(Math.floor(x / 9), Math.floor(z / 9));          // macchie da 9 m
  const macchia = Math.sin(x * 0.011 + Math.cos(z * 0.009) * 2) * Math.cos(z * 0.013 - x * 0.004);   // zone grandi
  if (quota < livelloLago - 0.3) {
    // sotto il livello del lago: dal fondo sabbioso (riva) al blu-verde scuro (fondale)
    const fondo = Math.min(1, (livelloLago - quota) / 18);
    colore.setRGB(0.56 - fondo * 0.46, 0.52 - fondo * 0.36, 0.38 - fondo * 0.22);
  } else if (quota < livelloLago + 0.7) {
    colore.setRGB(0.66 + grana * 0.06, 0.6 + grana * 0.05, 0.47);   // spiaggia e riva di ghiaia
  } else if (uso === 1 || uso === 3) {
    // parco e campo sportivo: prato curato, verde brillante e uniforme
    const v = grana * 0.03;
    colore.setRGB(0.17 + v, 0.4 + v, 0.13);
  } else if (uso === 4) {
    colore.setRGB(0.22 + grana * 0.03, 0.36, 0.16);   // cimitero: prato e ghiaietto
  } else if (bosco && pendenza < 1.5) {
    const v = (Math.sin(quota * 0.11) + 1) * 0.02 + grana * 0.03;
    colore.setRGB(0.14 + v, 0.26 + v, 0.11 + v * 0.5);
  } else if (quota > 2150 + macchia * 120 && pendenza < 1.1) {
    colore.setRGB(0.5, 0.5, 0.47);       // pietraia d'alta quota (la neve la mette il meteo)
  } else if (pendenza > 1.0) {
    const v = grana * 0.08;
    colore.setRGB(0.44 + v, 0.42 + v, 0.39 + v);   // roccia
  } else if (pendenza > 0.72) {
    colore.setRGB(0.4 + grana * 0.06, 0.38 + grana * 0.05, 0.31);   // detriti e prati sassosi
  } else if (quota > 1700) {
    const v = grana * 0.05;
    colore.setRGB(0.5 + v, 0.54 + v, 0.4);     // pascoli d'alta quota
  } else {
    // prato: varia da verde fresco a prato secco con la zona e le macchie
    const secco = Math.max(0, macchia) * 0.18 + grana * 0.05;
    colore.setRGB(0.19 + secco + (Math.sin(quota * 0.05) + 1) * 0.02, 0.33 + secco * 0.5 + grana * 0.03, 0.12);
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
      coloreTerreno(quota, pendenza, terreno.info.livello_lago, bosco, colore, colonna * terreno.passo - terreno.metaX, riga * terreno.passo - terreno.metaZ,
        terreno.uso ? usoQui(terreno, colonna * terreno.passo - terreno.metaX, riga * terreno.passo - terreno.metaZ) : 0);
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
  geometria.computeBoundingSphere();
  return liberaDopoCaricamento(geometria);
}

export function aggiungiTerreno(terreno, scena, disegnatore, ambiente) {
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
      const materiale = materialeTerreno(ambiente);
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

  // Lago Maggiore: una superficie d'acqua alla quota del lago, con onde e riflessi del cielo.
  // E' un po' trasparente: vicino a riva si vede il fondo sabbioso.
  const lago = new THREE.Mesh(
    new THREE.PlaneGeometry(terreno.metaX * 2, terreno.metaZ * 2),
    creaMaterialeAcqua(ambiente, { colore: 0x2b6f95, opacita: 0.86, scala: 22, velocita: 0.018, polygonOffset: 0 })
  );
  lago.rotation.x = -Math.PI / 2;
  lago.position.y = terreno.info.livello_lago;
  lago.receiveShadow = false;
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
    // un pezzo vicino "a meta' dettaglio" (un punto ogni 8 m) torna a dettaglio pieno quando ci si avvicina
    if (pezzo.vicino !== null && pezzo.vicino.userData.salto === 2 && distanza < 900) {
      terrenoMesh.scena.remove(pezzo.vicino);
      pezzo.vicino.geometry.dispose();
      pezzo.vicino = null;
      pezzo.lontano.visible = true;
    }
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
    // vicino alla moto un punto ogni 4 m; piu' lontano (oltre 1 km) ne basta uno ogni 8 m: un quarto dei triangoli
    const salto = Math.hypot(p.centroX - x, p.centroZ - z) < 1000 ? 1 : 2;
    p.vicino = new THREE.Mesh(
      creaGeometriaPezzo(terrenoMesh.terreno, p.px * QUAD_PEZZO, p.py * QUAD_PEZZO, salto, p.centroX, p.centroZ), p.materiale);
    p.vicino.userData.salto = salto;
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
