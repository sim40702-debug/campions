// Alberi: boschi di OpenStreetMap, alberi singoli mappati e VERDE URBANO (viali alberati, giardini, palme sul lungolago).
// I boschi sono enormi: gli alberi si creano SOLO vicino alla moto (celle da 250 m)
// e si tolgono quando ci si allontana. Da lontano il bosco si vede dal colore del terreno.
//
// Specie: latifoglie (3 chiome), abeti/larici, cipressi, palme, cespugli. Ogni albero ha una tinta e
// una grandezza sua, e le chiome ondeggiano al vento (programma della scheda video).
// Nel bosco le forme hanno poche facce; in citta' e per gli alberi singoli sono piu' ricche.
// Il carattere del verde cambia da paese a paese (luoghi.js): ad Ascona e Locarno molte palme,
// a Losone viali di latifoglie, a Ponte Brolla vegetazione di sasso e castagni.

import * as THREE from "three";
import { quotaTerreno, boscoQui } from "./terreno.js";
import { stradaVicina } from "./strade.js";
import { dentroEdificio, zonaQui, ZONA } from "./edifici.js";
import { profiloQui } from "./luoghi.js";

const CELLA = 250;            // metri
let RAGGIO = 900;             // fino a che distanza ci sono gli alberi (impostazioni)
let ALBERI_PER_CELLA = 650;   // tentativi per cella (circa 1 albero ogni 100 m2)
const QUOTA_CONIFERE = 1100;  // sopra questa quota: abeti e larici

// Un albero = tanti pezzi (tronco, rami, chioma a "nuvole"), uniti in una sola geometria con i colori.
// Ogni faccia della chioma ha una luminosita' leggermente diversa: sembra fogliame e non plastica.
let semeForma = 5;
function rndForma() {
  semeForma = (semeForma * 1664525 + 1013904223) >>> 0;
  return semeForma / 4294967296;
}

function creaForma(parti) {
  const posizioni = [];
  const coloriVertici = [];
  for (const [geometria, colore, foglie] of parti) {
    const g = geometria.index ? geometria.toNonIndexed() : geometria;
    const pos = g.attributes.position.array;
    const c = new THREE.Color(colore);
    for (let i = 0; i < pos.length; i += 9) {
      const faccia = foglie ? 0.86 + rndForma() * 0.26 : 1;   // luminosita' per faccia
      for (let k = 0; k < 9; k += 3) {
        const y = pos[i + k + 1];
        // piu' scuro in basso e all'interno: sembra ombra tra le foglie
        const luce = (foglie ? 0.78 : 0.85) + Math.min(0.36, y * 0.04);
        posizioni.push(pos[i + k], y, pos[i + k + 2]);
        coloriVertici.push(c.r * luce * faccia, c.g * luce * faccia, c.b * luce * faccia);
      }
    }
  }
  const forma = new THREE.BufferGeometry();
  forma.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  forma.setAttribute("color", new THREE.Float32BufferAttribute(coloriVertici, 3));
  forma.computeVertexNormals();
  return forma;
}

function pezzo(geometria, x, y, z, sx, sy, sz) {
  geometria.scale(sx, sy, sz);
  geometria.translate(x, y, z);
  return geometria;
}

// Sfera irregolare: i vertici sono spostati a caso (chiome meno "palloncino")
function blob(raggio, dettaglio, x, y, z, sx, sy, sz) {
  const g = new THREE.IcosahedronGeometry(raggio, dettaglio);
  const pos = g.attributes.position;
  const spostamenti = new Map();
  for (let i = 0; i < pos.count; i++) {
    const chiave = pos.getX(i).toFixed(3) + "," + pos.getY(i).toFixed(3) + "," + pos.getZ(i).toFixed(3);
    let f = spostamenti.get(chiave);
    if (f === undefined) {
      f = 1 + (rndForma() - 0.5) * (dettaglio > 0 ? 0.42 : 0.2);
      spostamenti.set(chiave, f);
    }
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  return pezzo(g, x, y, z, sx, sy, sz);
}

const TRONCO = 0x4e3b2a;

// Latifoglia (castagno, faggio, quercia): tronco, rami, chioma fatta di "nuvole" di foglie.
// dettaglio 0 = bosco (poche facce), 1 = citta' e alberi singoli (piu' ricco); variante 1 = chioma larga e bassa
function latifoglia(verde, dettaglio, variante) {
  const tronco = pezzo(new THREE.CylinderGeometry(0.15, 0.3, 3.2, 7), 0, 1.6, 0, 1, 1, 1);
  const ramo1 = new THREE.CylinderGeometry(0.06, 0.12, 1.8, 5);
  ramo1.rotateZ(0.7);
  ramo1.translate(0.5, 3.0, 0);
  const ramo2 = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5);
  ramo2.rotateX(-0.7);
  ramo2.translate(0, 3.0, 0.45);
  const verdi = [verde, new THREE.Color(verde).offsetHSL(0.02, 0, 0.05).getHex(), new THREE.Color(verde).offsetHSL(-0.02, 0, -0.04).getHex()];
  const d = dettaglio;
  const parti = [[tronco, TRONCO], [ramo1, TRONCO], [ramo2, TRONCO]];
  if (variante === 1) {
    parti.push(
      [blob(2.4, d, 0, 4.2, 0, 1.25, 0.8, 1.25), verdi[0], true],
      [blob(1.8, d, 2.0, 3.7, 0.6, 1, 0.85, 1), verdi[1], true],
      [blob(1.8, d, -1.8, 3.8, -0.8, 1, 0.85, 1), verdi[2], true],
      [blob(1.6, d, 0.3, 3.6, 2.0, 1, 0.85, 1), verdi[1], true],
      [blob(1.5, d, -0.4, 4.1, -2.0, 1, 0.85, 1), verdi[2], true],
      [blob(1.5, d, 0.2, 5.4, 0.2, 1, 0.85, 1), verdi[0], true]
    );
  } else {
    parti.push(
      [blob(2.2, d, 0, 4.7, 0, 1, 0.95, 1), verdi[0], true],
      [blob(1.6, d, 1.4, 4.0, 0.4, 1, 0.85, 1), verdi[1], true],
      [blob(1.5, d, -1.2, 4.1, -0.6, 1, 0.85, 1), verdi[2], true],
      [blob(1.4, d, 0.2, 3.9, 1.4, 1, 0.85, 1), verdi[1], true],
      [blob(1.3, d, 0.3, 6.1, -0.3, 1, 0.9, 1), verdi[2], true],
      [blob(1.1, d, -0.9, 5.6, 0.9, 1, 0.9, 1), verdi[0], true]
    );
  }
  return creaForma(parti);
}

// Conifera (abete, larice): tronco e "piani" di rami, piu' stretti salendo
function conifera(verde, dettaglio) {
  const parti = [[pezzo(new THREE.CylinderGeometry(0.12, 0.26, 3, 7), 0, 1.5, 0, 1, 1, 1), 0x4a3524]];
  const piani = [[2.5, 2.4, 2.4], [2.1, 2.2, 3.7], [1.65, 2.0, 5.0], [1.2, 1.9, 6.2], [0.7, 1.7, 7.3]];
  for (let i = 0; i < piani.length; i++) {
    const [raggio, alto, y] = piani[i];
    const cono = new THREE.ConeGeometry(raggio, alto, dettaglio > 0 ? 12 : 8);
    cono.translate(0, y, 0);
    parti.push([cono, new THREE.Color(verde).offsetHSL(0, 0, i * 0.018).getHex(), true]);
  }
  return creaForma(parti);
}

// Cipresso / pioppo cipressino: colonna stretta e alta (tipico dei cimiteri e dei viali ticinesi)
function cipresso(verde) {
  const tronco = pezzo(new THREE.CylinderGeometry(0.1, 0.2, 1.4, 6), 0, 0.7, 0, 1, 1, 1);
  const colonna = pezzo(new THREE.IcosahedronGeometry(1, 1), 0, 4.7, 0, 0.85, 4.0, 0.85);
  const alto = pezzo(new THREE.IcosahedronGeometry(1, 1), 0, 7.0, 0, 0.55, 2.2, 0.55);
  return creaForma([[tronco, TRONCO], [colonna, verde, true], [alto, new THREE.Color(verde).offsetHSL(0, 0, 0.03).getHex(), true]]);
}

// Palma (Trachycarpus / Phoenix, comuni sul lungolago di Locarno e Ascona): tronco e ciuffo di foglie ad arco
function palma() {
  const parti = [];
  const tronco = new THREE.CylinderGeometry(0.2, 0.3, 5.2, 8);
  tronco.translate(0, 2.6, 0);
  parti.push([tronco, 0x6d5a45]);
  for (let i = 0; i < 11; i++) {
    const ang = (i / 11) * Math.PI * 2;
    const f = new THREE.ConeGeometry(0.26, 3.4, 4);
    f.scale(1, 1, 0.25);                                  // foglia piatta
    f.translate(0, 1.7, 0);                               // la punta lontano dal centro
    f.rotateZ(-(Math.PI / 2 - 0.35 + (i % 2) * 0.35));   // inclinata verso l'esterno e un po' in giu'
    f.rotateY(ang);
    f.translate(0, 5.3, 0);
    parti.push([f, i % 3 === 0 ? 0x4b7a34 : 0x3f6e2c, true]);
  }
  const cuore = new THREE.IcosahedronGeometry(0.5, 0);
  cuore.translate(0, 5.4, 0);
  parti.push([cuore, 0x6a5238]);
  return creaForma(parti);
}

// Cespuglio / siepe (basso)
function cespuglio(verde) {
  return creaForma([
    [blob(0.9, 0, 0, 0.55, 0, 1.2, 0.8, 1.1), verde, true],
    [blob(0.7, 0, 0.8, 0.45, 0.2, 1, 0.8, 1), new THREE.Color(verde).offsetHSL(0.02, 0, 0.04).getHex(), true]
  ]);
}

const FORME = {
  bosco: {
    lat1: latifoglia(0x3f6b2c, 0, 0),
    lat2: latifoglia(0x557a32, 0, 1),
    lat3: latifoglia(0x486f2a, 0, 0),
    conifera: conifera(0x2c4a2a, 0),
    cespuglio: cespuglio(0x3e6a30)
  },
  citta: {
    lat1: latifoglia(0x4a7a30, 1, 0),
    lat2: latifoglia(0x5d8836, 1, 1),
    lat3: latifoglia(0x3d6a2a, 1, 1),
    conifera: conifera(0x2f5030, 1),
    cipresso: cipresso(0x2d4a2c),
    palma: palma(),
    cespuglio: cespuglio(0x467a34)
  }
};

// Il materiale delle chiome ondeggia al vento: l'altezza del vertice decide quanto si muove.
// "tempo" e' condiviso con l'ambiente (uniformi.tempo)
let MATERIALE = null;
function materiale(tempo) {
  if (MATERIALE) return MATERIALE;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = function (shader) {
    shader.uniforms.uTempoVento = tempo;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTempoVento;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          float alt = max(position.y - 1.8, 0.0);
          #ifdef USE_INSTANCING
            vec2 radice = instanceMatrix[3].xz;
          #else
            vec2 radice = vec2(0.0);
          #endif
          float fase = radice.x * 0.071 + radice.y * 0.053;
          float raffica = sin(uTempoVento * 0.6 + radice.x * 0.01) * 0.5 + 0.5;
          float onda = sin(uTempoVento * 1.7 + fase + position.y * 0.5) * (0.35 + raffica * 0.9);
          transformed.x += onda * alt * 0.022;
          transformed.z += cos(uTempoVento * 1.3 + fase) * (0.3 + raffica * 0.6) * alt * 0.016;
        }`);
  };
  m.customProgramCacheKey = function () { return "alberi-vento"; };
  MATERIALE = m;
  return m;
}

// Numeri casuali "fissi": la stessa cella ha sempre gli stessi alberi
function casuale(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function postoLibero(mondo, x, z, distanzaStrada) {
  const y = quotaTerreno(mondo.terreno, x, z);
  if (y < mondo.terreno.info.livello_lago + 0.5) return null;   // lago
  // niente alberi sulla strada: almeno 3.5 m dal bordo dell'asfalto
  const strada = stradaVicina(mondo.strade, x, z, 16);
  if (strada !== null && strada.distanza < strada.larghezza / 2 + (distanzaStrada !== undefined ? distanzaStrada : 3.5)) return null;
  if (dentroEdificio(mondo.edifici, x, z, y + 1)) return null;  // edificio
  return y;
}

function creaCella(mondo, cx, cz) {
  // liste per specie: [x, y, z, scala, giro, tinta]
  const bosco = { lat1: [], lat2: [], lat3: [], conifera: [], cespuglio: [] };
  const citta = { lat1: [], lat2: [], lat3: [], conifera: [], cipresso: [], palma: [], cespuglio: [] };
  const rnd = casuale(cx * 73856093 ^ cz * 19349663);

  // Alberi nel bosco (con un sottobosco di cespugli)
  for (let i = 0; i < ALBERI_PER_CELLA; i++) {
    const x = (cx + rnd()) * CELLA;
    const z = (cz + rnd()) * CELLA;
    const scala = 0.7 + rnd() * 0.8;
    const giro = rnd() * Math.PI * 2;
    const tinta = rnd();
    if (!boscoQui(mondo.terreno, x, z)) continue;
    const y = postoLibero(mondo, x, z);
    if (y === null) continue;
    if (y > QUOTA_CONIFERE) bosco.conifera.push([x, y, z, scala, giro, tinta]);
    else if (y > 800 && rnd() < 0.35) bosco.conifera.push([x, y, z, scala, giro, tinta]);   // conifere sparse in quota
    else {
      const r = rnd();
      (r < 0.34 ? bosco.lat2 : (r < 0.7 ? bosco.lat3 : bosco.lat1)).push([x, y, z, scala, giro, tinta]);
    }
    if (rnd() < 0.22) {
      const sx = x + (rnd() - 0.5) * 6, sz = z + (rnd() - 0.5) * 6;
      if (boscoQui(mondo.terreno, sx, sz)) bosco.cespuglio.push([sx, quotaTerreno(mondo.terreno, sx, sz), sz, 0.6 + rnd() * 0.7, rnd() * 6, rnd()]);
    }
  }

  // Alberi singoli di OpenStreetMap che cadono in questa cella
  const singoli = mondo.alberiSingoli.get(cx + "," + cz) || [];
  for (const [x, z] of singoli) {
    const y = quotaTerreno(mondo.terreno, x, z);
    const strada = stradaVicina(mondo.strade, x, z, 10);
    if (strada !== null && strada.distanza < strada.larghezza / 2 + 0.5) continue;
    const info = profiloQui(mondo.luoghi, x, z);
    scegliUrbano(citta, info, x, y, z, rnd, y < mondo.terreno.info.livello_lago + 9);
  }

  // Verde urbano: viali lungo le strade abitate e giardini negli isolati (non nei boschi veri)
  const base = (zonaQui(mondo.edifici, (cx + 0.5) * CELLA, (cz + 0.5) * CELLA));
  if (base.densita > 0.015 || mondo.luoghiVicini) {
    const tentativi = Math.round(420 * (ALBERI_PER_CELLA / 650));
    for (let i = 0; i < tentativi; i++) {
      const x = (cx + rnd()) * CELLA;
      const z = (cz + rnd()) * CELLA;
      const info = zonaQui(mondo.edifici, x, z);
      if (info.densita < 0.03 || info.zona === ZONA.INDUSTRIALE || boscoQui(mondo.terreno, x, z)) continue;
      const profilo = profiloQui(mondo.luoghi, x, z);
      const stradaVic = stradaVicina(mondo.strade, x, z, 14);
      const quota = quotaTerreno(mondo.terreno, x, z);
      let ok = false;
      if (stradaVic !== null && !stradaVic.galleria) {
        // viale: a 2.6-3.6 m dal bordo dell'asfalto, un po' alla volta (non ovunque)
        const d = stradaVic.distanza - stradaVic.larghezza / 2;
        ok = d > 2.4 && d < 3.7 && rnd() < 0.12 * profilo.alberi * (info.zona === ZONA.STORICO ? 0.35 : 1);
      }
      if (!ok && info.densita < 0.3 && info.zona !== ZONA.STORICO) {
        // giardini degli isolati abitati
        ok = rnd() < 0.05 * profilo.alberi * (0.4 + info.densita * 4);
      }
      if (!ok) continue;
      const y = postoLibero(mondo, x, z, 2.2);
      if (y === null) continue;
      void quota;
      scegliUrbano(citta, profilo, x, y, z, rnd, y < mondo.terreno.info.livello_lago + 9);
    }
  }

  const gruppo = new THREE.Group();
  const matrice = new THREE.Matrix4();
  const rotazione = new THREE.Quaternion();
  const asse = new THREE.Vector3(0, 1, 0);
  const colore = new THREE.Color();
  const mat = materiale(mondo.tempo);
  const costruisci = function (specie, forme, ombra) {
    for (const nome of Object.keys(specie)) {
      const lista = specie[nome];
      if (lista.length === 0) continue;
      const istanze = new THREE.InstancedMesh(forme[nome], mat, lista.length);
      for (let i = 0; i < lista.length; i++) {
        const [x, y, z, scala, giro, tinta] = lista[i];
        rotazione.setFromAxisAngle(asse, giro);
        const sy = nome === "palma" || nome === "cipresso" ? scala * (0.9 + tinta * 0.3) : scala;
        matrice.compose(new THREE.Vector3(x, y - 0.2, z), rotazione, new THREE.Vector3(scala, sy, scala));
        istanze.setMatrixAt(i, matrice);
        // tinta: da verde piu' giallo a piu' scuro (e un po' di autunno nelle latifoglie)
        colore.setHSL(0.0 + (tinta - 0.5) * 0.04, 0.0, 0.88 + tinta * 0.24);
        if (nome.startsWith("lat") && tinta > 0.93) colore.setRGB(1.35, 1.0, 0.7);   // qualche albero ingiallito
        istanze.setColorAt(i, colore);
      }
      istanze.castShadow = ombra;
      istanze.receiveShadow = false;
      istanze.computeBoundingSphere();
      gruppo.add(istanze);
    }
  };
  costruisci(bosco, FORME.bosco, false);
  costruisci(citta, FORME.citta, true);
  return gruppo;
}

// Sceglie la specie per un albero di citta' in base al carattere del paese e alla vicinanza al lago
function scegliUrbano(citta, profilo, x, y, z, rnd, vicinoLago) {
  const scala = 0.8 + rnd() * 0.55;
  const giro = rnd() * Math.PI * 2;
  const tinta = rnd();
  const r = rnd();
  const palme = vicinoLago ? profilo.palme : profilo.palme * 0.25;
  let specie;
  if (r < palme * 0.6) specie = "palma";
  else if (r < palme * 0.6 + 0.07) specie = "cipresso";
  else if (r < palme * 0.6 + 0.11) specie = "conifera";
  else if (r < palme * 0.6 + 0.34) specie = "cespuglio";
  else specie = rnd() < 0.4 ? "lat2" : (rnd() < 0.5 ? "lat3" : "lat1");
  const s = specie === "cespuglio" ? 0.7 + rnd() * 0.8 : (specie === "palma" ? 0.85 + rnd() * 0.5 : scala);
  citta[specie].push([x, y, z, s, giro, tinta]);
}

export function creaAlberi(scena, terreno, strade, edifici, alberiSingoli, contesto) {
  // Alberi singoli divisi per cella
  const perCella = new Map();
  for (let i = 0; i + 1 < alberiSingoli.length; i += 2) {
    const chiave = Math.floor(alberiSingoli[i] / CELLA) + "," + Math.floor(alberiSingoli[i + 1] / CELLA);
    if (!perCella.has(chiave)) perCella.set(chiave, []);
    perCella.get(chiave).push([alberiSingoli[i], alberiSingoli[i + 1]]);
  }
  return {
    scena: scena,
    terreno: terreno,
    strade: strade,
    edifici: edifici,
    luoghi: contesto.luoghi,
    tempo: contesto.ambiente.uniformi.tempo,
    alberiSingoli: perCella,
    celle: new Map(),
    attesa: 0
  };
}

export async function caricaAlberiSingoli() {
  const risposta = await fetch("dati/alberi.json");
  if (!risposta.ok) return [];
  const dati = await risposta.json();
  return dati.alberi;
}

function liberaCella(mondo, gruppo) {
  mondo.scena.remove(gruppo);
  for (const istanze of gruppo.children) istanze.dispose();
}

// Ogni tanto: crea le celle vicine alla moto e toglie quelle lontane
export function aggiornaAlberi(mondo, x, z, dt) {
  mondo.attesa -= dt;
  if (mondo.attesa > 0) return;
  mondo.attesa = 0.4;

  const cx = Math.floor(x / CELLA);
  const cz = Math.floor(z / CELLA);
  const quante = Math.ceil(RAGGIO / CELLA);
  let create = 0;

  for (let ix = cx - quante; ix <= cx + quante; ix++) {
    for (let iz = cz - quante; iz <= cz + quante; iz++) {
      const chiave = ix + "," + iz;
      const distanza = Math.hypot((ix + 0.5) * CELLA - x, (iz + 0.5) * CELLA - z);
      if (distanza > RAGGIO || mondo.celle.has(chiave)) continue;
      if (Math.abs(ix * CELLA) > mondo.terreno.metaX + CELLA || Math.abs(iz * CELLA) > mondo.terreno.metaZ + CELLA) continue;
      // Massimo 3 celle nuove alla volta, cosi' il gioco non si blocca
      if (create >= 3) continue;
      const gruppo = creaCella(mondo, ix, iz);
      mondo.scena.add(gruppo);
      mondo.celle.set(chiave, gruppo);
      create = create + 1;
    }
  }

  for (const [chiave, gruppo] of mondo.celle) {
    const [ix, iz] = chiave.split(",").map(Number);
    const distanza = Math.hypot((ix + 0.5) * CELLA - x, (iz + 0.5) * CELLA - z);
    if (distanza > RAGGIO + CELLA) {
      liberaCella(mondo, gruppo);
      mondo.celle.delete(chiave);
    }
  }
}

// Cambia distanza e densita' degli alberi (menu Impostazioni) e ricrea quelli vicini
export function impostaAlberi(mondo, raggio, densita) {
  RAGGIO = raggio;
  ALBERI_PER_CELLA = Math.round(650 * densita);
  for (const gruppo of mondo.celle.values()) liberaCella(mondo, gruppo);
  mondo.celle.clear();
  mondo.attesa = 0;
}
