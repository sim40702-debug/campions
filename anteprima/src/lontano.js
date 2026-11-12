// LOD LONTANO - citta' e strade principali tra il limite dei dettagli e l'orizzonte.
//
// PROBLEMA (misurato sul codice): i pezzi di edifici si costruiscono solo entro min(vistaCitta, 6 km) + 500 m e le strade
// vere solo entro 0,55 x visibilita' (al massimo 6 km), mentre la nebbia arriva a "visibilita'" (Media 7 km, Alta 9 km,
// Ultra 11 km). Tra i due limiti si vedeva solo terreno: le citta' lontane (per esempio Lugano da una collina)
// e le strade principali sparivano prima della nebbia.
//
// SOLUZIONE, tutta calcolata dai dati veri gia' caricati (nessun file nuovo, nessun dato inventato):
//  - Sagome delle citta': gli edifici si raggruppano in celle da 250 m; di ogni cella si tengono la superficie coperta,
//    l'altezza media e la quota di base (media pesata sulla superficie). Ogni cella abbastanza costruita e' UN parallelepipedo
//    di un unico InstancedMesh (una chiamata di disegno). Sono mostrate solo le celle oltre il limite degli edifici veri
//    e dentro la nebbia; le altre non costano nulla.
//  - Rete principale: autostrade, strade principali e secondarie come linee (una chiamata di disegno), spente da un test
//    nello shader dove ci sono le strade vere, cosi' non si vede doppio.
// Memoria: poche centinaia di KB (matrici delle celle e vertici delle linee), nessuna texture. Si costruisce una volta per
// regione e viene scaricato con la regione (cambio regione = nuova pagina).
// Non cambia niente vicino alla moto. Nei profili senza "lontano" (Bassa) non viene disegnato nulla.

import * as THREE from "three";

const CELLA_M = 250;
const COPERTURA_MIN = 0.04;       // sotto il 4 % di superficie coperta la cella e' campagna
const AGGIORNA_OGNI_M = 120;      // si ricalcolano le celle visibili quando la moto si e' spostata di tanto
const MARGINE_EDIFICI_M = 400;    // le sagome cominciano oltre il limite degli edifici veri + 400 m (pezzi da 500 m)
const CLASSI = { motorway: 0, trunk: 0, motorway_link: 0, primary: 1, secondary: 2, tertiary: 3, primary_link: 3, trunk_link: 0 };
const COLORI_STRADA = [new THREE.Color(0.62, 0.62, 0.6), new THREE.Color(0.5, 0.5, 0.5), new THREE.Color(0.42, 0.42, 0.42), new THREE.Color(0.36, 0.36, 0.36)];

function superficie(p) {
  let somma = 0;
  const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    somma += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return Math.abs(somma) / 2;
}

// Celle da 250 m con superficie coperta, altezza media e quota di base. Ritorna array compatti.
export function celleDegliEdifici(lista) {
  const celle = new Map();
  for (const e of lista) {
    if (!e.p || e.p.length < 6) continue;
    const area = superficie(e.p);
    if (area < 4) continue;
    let cx = e.cx, cz = e.cz;
    if (cx === undefined) {
      cx = 0; cz = 0;
      for (let k = 0; k < e.p.length; k += 2) { cx += e.p[k]; cz += e.p[k + 1]; }
      cx /= e.p.length / 2; cz /= e.p.length / 2;
    }
    const alto = Math.max(3, (e.h || 0) - (e.b || 0));
    const chiave = Math.floor(cx / CELLA_M) + "," + Math.floor(cz / CELLA_M);
    let c = celle.get(chiave);
    if (!c) {
      const [ix, iz] = chiave.split(",").map(Number);
      c = { x: (ix + 0.5) * CELLA_M, z: (iz + 0.5) * CELLA_M, area: 0, areaAltezza: 0, areaBase: 0, n: 0 };
      celle.set(chiave, c);
    }
    c.area += area;
    c.areaAltezza += area * alto;
    c.areaBase += area * (e.b || 0);
    c.n++;
  }
  const risultato = [];
  for (const c of celle.values()) {
    const copertura = Math.min(1, c.area / (CELLA_M * CELLA_M));
    if (copertura < COPERTURA_MIN || c.n < 2) continue;
    risultato.push({
      x: c.x, z: c.z, copertura: copertura,
      altezza: c.areaAltezza / c.area, base: c.areaBase / c.area, n: c.n
    });
  }
  return risultato;
}

// Segmenti (coppie di punti) delle strade principali, un punto ogni ~16 m, e il loro colore per classe
export function segmentiStradePrincipali(lista) {
  const pos = [];
  const col = [];
  for (const s of lista) {
    const classe = CLASSI[s.t];
    if (classe === undefined || s.g) continue;       // niente gallerie: sono sotto terra
    const p = s.p;
    const n = p.length / 3;
    if (n < 2) continue;
    const colore = COLORI_STRADA[classe];
    let prima = 0;
    for (let i = 1; i < n; i++) {
      if (i % 4 !== 0 && i !== n - 1) continue;
      pos.push(p[prima * 3], p[prima * 3 + 1] + 1.2, p[prima * 3 + 2], p[i * 3], p[i * 3 + 1] + 1.2, p[i * 3 + 2]);
      col.push(colore.r, colore.g, colore.b, colore.r, colore.g, colore.b);
      prima = i;
    }
  }
  return { posizioni: new Float32Array(pos), colori: new Float32Array(col) };
}

export function aggiungiLontano(scena, edifici, strade) {
  const celle = celleDegliEdifici(edifici ? edifici.lista : []);
  const sistema = {
    attivo: false, visibilita: 7000, celle: celle, ultimoX: 1e9, ultimoZ: 1e9, attesa: 0,
    mesh: null, linee: null, uniformi: { uCentro: { value: new THREE.Vector2() }, uRaggio: { value: 0 } },
    visibili: 0, stat: { celle: celle.length, vertici: 0 }
  };

  if (celle.length > 0) {
    const geometria = new THREE.BoxGeometry(1, 1, 1);
    const materiale = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geometria, materiale, celle.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;       // le istanze sono in tutta la regione: il riquadro unico non servirebbe
    mesh.count = 0;
    mesh.visible = false;
    mesh.name = "sagome-citta";
    // varianti di grigio caldo: da lontano le citta' sono macchie chiare e scure, non tutte uguali
    // (il colore e' della cella: resta qui, perche' le istanze visibili si mettono in fila all'inizio)
    sistema.coloriCelle = new Float32Array(celle.length * 3);
    for (let i = 0; i < celle.length; i++) {
      const v = ((Math.imul(i, 2654435761) >>> 8) & 255) / 255;
      sistema.coloriCelle[i * 3] = 0.74 + v * 0.1;
      sistema.coloriCelle[i * 3 + 1] = 0.7 + v * 0.09;
      sistema.coloriCelle[i * 3 + 2] = 0.65 + v * 0.08;
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(celle.length * 3), 3);
    scena.add(mesh);
    sistema.mesh = mesh;
  }

  if (strade && strade.lista) {
    const { posizioni, colori } = segmentiStradePrincipali(strade.lista);
    if (posizioni.length > 0) {
      const geometria = new THREE.BufferGeometry();
      geometria.setAttribute("position", new THREE.BufferAttribute(posizioni, 3));
      geometria.setAttribute("color", new THREE.BufferAttribute(colori, 3));
      const materiale = new THREE.LineBasicMaterial({ vertexColors: true });
      // dove ci sono le strade vere (entro uRaggio dalla moto) la linea non si disegna
      materiale.onBeforeCompile = function (shader) {
        shader.uniforms.uCentro = sistema.uniformi.uCentro;
        shader.uniforms.uRaggio = sistema.uniformi.uRaggio;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec2 vMondoXZ;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMondoXZ = position.xz;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec2 vMondoXZ;\nuniform vec2 uCentro;\nuniform float uRaggio;")
          .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (distance(vMondoXZ, uCentro) < uRaggio) discard;");
      };
      const linee = new THREE.LineSegments(geometria, materiale);
      linee.frustumCulled = false;
      linee.visible = false;
      linee.name = "strade-principali-lontane";
      scena.add(linee);
      sistema.linee = linee;
      sistema.stat.vertici = posizioni.length / 3;
    }
  }
  return sistema;
}

// Profilo grafico: attivo si/no e fino a dove si vede (visibilita' = distanza della nebbia)
export function impostaLontano(sistema, attivo, visibilita, raggioStrade) {
  if (!sistema) return;
  sistema.attivo = !!attivo;
  sistema.visibilita = visibilita;
  sistema.raggioStrade = raggioStrade || 0;
  sistema.ultimoX = 1e9;     // si ricalcola subito
  sistema.attesa = 0;
  if (!sistema.attivo) {
    if (sistema.mesh) { sistema.mesh.visible = false; sistema.mesh.count = 0; }
    if (sistema.linee) sistema.linee.visible = false;
    sistema.visibili = 0;
  }
}

const matrice = new THREE.Matrix4();
const posizione = new THREE.Vector3();
const scala = new THREE.Vector3();
const rotazione = new THREE.Quaternion();

// Da chiamare a ogni fotogramma con la posizione della moto e il limite attuale degli edifici veri (edifici.sistema).
export function aggiornaLontano(sistema, edifici, x, z, dt) {
  if (!sistema || !sistema.attivo) return;
  sistema.attesa -= dt;
  if (sistema.attesa > 0) return;
  sistema.attesa = 0.4;
  if (Math.hypot(x - sistema.ultimoX, z - sistema.ultimoZ) < AGGIORNA_OGNI_M) return;
  sistema.ultimoX = x;
  sistema.ultimoZ = z;

  const s = edifici && edifici.sistema;
  // fin dove ci sono gli edifici veri (stessa regola di edifici.js: min(vista, 6 km) + un pezzo da 500 m)
  const finoA = (s ? Math.min(s.raggioVista, 6000) + 500 : 0) + MARGINE_EDIFICI_M;
  const dMin = finoA, dMax = sistema.visibilita + 400;

  if (sistema.mesh) {
    let n = 0;
    for (let i = 0; i < sistema.celle.length; i++) {
      const c = sistema.celle[i];
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < dMin || d > dMax) continue;
      const lato = CELLA_M * Math.sqrt(Math.min(1, c.copertura * 1.6));
      const alto = Math.max(5, c.altezza);
      posizione.set(c.x, c.base + alto / 2 - 0.5, c.z);
      scala.set(lato, alto, lato);
      matrice.compose(posizione, rotazione, scala);
      // le istanze visibili si mettono in fila all'inizio: il colore resta quello della cella (indice originale)
      sistema.mesh.setMatrixAt(n, matrice);
      sistema.mesh.instanceColor.setXYZ(n, sistema.coloriCelle[i * 3], sistema.coloriCelle[i * 3 + 1], sistema.coloriCelle[i * 3 + 2]);
      n++;
    }
    sistema.mesh.count = n;
    sistema.mesh.instanceMatrix.needsUpdate = true;
    sistema.mesh.instanceColor.needsUpdate = true;
    sistema.mesh.visible = n > 0;
    sistema.visibili = n;
  }
  if (sistema.linee) {
    sistema.uniformi.uCentro.value.set(x, z);
    sistema.uniformi.uRaggio.value = Math.max(0, sistema.raggioStrade - 150);
    sistema.linee.visible = true;
  }
}
