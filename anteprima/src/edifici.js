// Edifici: contorni veri da OpenStreetMap, "alzati" fino all'altezza dell'edificio.
// Gli edifici vicini sono uniti in pezzi da 1 x 1 km (meno lavoro per la scheda video).
// Serve anche per le collisioni: la moto non puo' passare dentro un edificio.

import * as THREE from "three";

const PEZZO = 1000;   // metri
const CELLA = 40;     // griglia per le collisioni

// Colori dei muri (stile ticinese: bianco, crema, giallo, rosa, grigio chiaro, ocra)
const COLORI_MURI = [0xf2efe6, 0xe9dcc0, 0xf1e2a8, 0xe9c9bd, 0xd5d5d0, 0xd9b98a];
const COLORE_TETTO_PIATTO = 0x77787a;
const COLORE_TETTO_TEGOLE = 0x9a4f38;

export async function caricaEdifici() {
  const risposta = await fetch("dati/edifici.json");
  if (!risposta.ok) {
    return { lista: [], griglia: new Map() };   // senza edifici il gioco funziona lo stesso
  }
  const dati = await risposta.json();

  // Griglia per le collisioni: per ogni cella gli edifici che la toccano
  const griglia = new Map();
  for (let i = 0; i < dati.edifici.length; i++) {
    const p = dati.edifici[i].p;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let k = 0; k < p.length; k += 2) {
      minX = Math.min(minX, p[k]);
      maxX = Math.max(maxX, p[k]);
      minZ = Math.min(minZ, p[k + 1]);
      maxZ = Math.max(maxZ, p[k + 1]);
    }
    for (let cx = Math.floor(minX / CELLA); cx <= Math.floor(maxX / CELLA); cx++) {
      for (let cz = Math.floor(minZ / CELLA); cz <= Math.floor(maxZ / CELLA); cz++) {
        const chiave = cx + "," + cz;
        if (!griglia.has(chiave)) griglia.set(chiave, []);
        griglia.get(chiave).push(i);
      }
    }
  }
  return { lista: dati.edifici, griglia: griglia };
}

function aggiungiColore(colori, colore, quanti) {
  for (let i = 0; i < quanti; i++) {
    colori.push(colore.r, colore.g, colore.b);
  }
}

// --- Texture disegnate dal codice (niente immagini prese da internet) ----------------
// Una texture = una "campata" di facciata: un piano alto 3 m e largo 3 m con una finestra.
// Il colore del muro viene dal colore di ogni casa (la texture e' quasi bianca e lo moltiplica).

function tela(lato) {
  const canvas = document.createElement("canvas");
  canvas.width = lato;
  canvas.height = lato;
  return canvas;
}

function rumore(c, lato, forza) {
  // intonaco: piccole macchie per non avere muri "di plastica"
  for (let i = 0; i < 1800; i++) {
    const chiaro = 255 - Math.random() * forza;
    c.fillStyle = "rgb(" + chiaro + "," + chiaro + "," + chiaro + ")";
    c.fillRect(Math.random() * lato, Math.random() * lato, 2, 2);
  }
}

function finestra(c, conPersiane) {
  // vetro (riflette un po' il cielo in alto)
  const vetro = c.createLinearGradient(0, 60, 0, 196);
  vetro.addColorStop(0, "#8fa6ba");
  vetro.addColorStop(0.45, "#3d4e5e");
  vetro.addColorStop(1, "#26313b");
  c.fillStyle = "#f4f2ec";
  c.fillRect(84, 52, 88, 152);          // cornice
  c.fillStyle = vetro;
  c.fillRect(92, 60, 72, 136);
  c.fillStyle = "#f4f2ec";
  c.fillRect(126, 60, 4, 136);          // montante centrale
  c.fillRect(92, 120, 72, 4);           // traverso
  c.fillStyle = "#b9b6ae";
  c.fillRect(78, 204, 100, 8);          // davanzale
  if (conPersiane) {
    // persiane verdi aperte, con le stecche (tipiche del Ticino)
    for (const x of [44, 172]) {
      c.fillStyle = "#4f7a55";
      c.fillRect(x, 58, 40, 142);
      c.fillStyle = "#3d6243";
      for (let y = 62; y < 196; y += 7) c.fillRect(x + 3, y, 34, 2);
    }
  }
}

function texture(canvas, ripeti) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (ripeti) t.repeat.set(ripeti, ripeti);
  return t;
}

function creaTexture() {
  const lato = 256;
  // facciata con persiane
  const a = tela(lato);
  let c = a.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, lato, lato);
  rumore(c, lato, 25);
  finestra(c, true);
  // facciata senza persiane (case piu' moderne)
  const b = tela(lato);
  c = b.getContext("2d");
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, lato, lato);
  rumore(c, lato, 18);
  finestra(c, false);
  // capannone: pannelli di lamiera e una fila di finestre
  const d = tela(lato);
  c = d.getContext("2d");
  c.fillStyle = "#f2f2f2";
  c.fillRect(0, 0, lato, lato);
  c.fillStyle = "#d5d5d5";
  for (let x = 0; x < lato; x += 32) c.fillRect(x, 0, 3, lato);
  c.fillStyle = "#4a5866";
  c.fillRect(0, 40, lato, 46);
  c.fillStyle = "#e8e8e8";
  for (let x = 0; x < lato; x += 64) c.fillRect(x, 40, 4, 46);
  // tegole (coppi): file di tegole rosse con ombre
  const e = tela(lato);
  c = e.getContext("2d");
  c.fillStyle = "#8e4a33";
  c.fillRect(0, 0, lato, lato);
  for (let y = 0; y < lato; y += 32) {
    for (let x = (y / 32) % 2 === 0 ? 0 : 16; x < lato + 32; x += 32) {
      const g = c.createLinearGradient(x - 16, 0, x + 16, 0);
      g.addColorStop(0, "#6e3424");
      g.addColorStop(0.5, "#b1603f");
      g.addColorStop(1, "#6e3424");
      c.fillStyle = g;
      c.fillRect(x - 15, y + 2, 30, 28);
    }
  }
  return { persiane: texture(a), finestre: texture(b), capannone: texture(d), tegole: texture(e) };
}

function nuovoGruppo() {
  return { posizioni: [], colori: [], uv: [] };
}

// Un muro (un lato del contorno) diviso in campate da circa 3 m e piani da circa 3 m:
// le coordinate UV sono "quante finestre" in largo e in alto, cosi' le finestre non vengono tagliate
function muro(gruppo, colore, ax, az, bx, bz, basso, alto) {
  const lungo = Math.hypot(bx - ax, bz - az);
  const campate = Math.max(1, Math.round(lungo / 3));
  const piani = Math.max(1, Math.round((alto - basso) / 3));
  gruppo.posizioni.push(
    ax, basso, az, bx, basso, bz, bx, alto, bz,
    ax, basso, az, bx, alto, bz, ax, alto, az
  );
  gruppo.uv.push(0, 0, campate, 0, campate, piani, 0, 0, campate, piani, 0, piani);
  aggiungiColore(gruppo.colori, colore, 6);
}

export function aggiungiEdifici(edifici, scena) {
  const tex = creaTexture();
  const pezzi = new Map();   // chiave "px,pz" -> gruppi di triangoli per materiale
  const coloreMuro = new THREE.Color();
  const coloreTetto = new THREE.Color();

  for (const edificio of edifici.lista) {
    const p = edificio.p;
    const punti = p.length / 2;
    const chiave = Math.floor(p[0] / PEZZO) + "," + Math.floor(p[1] / PEZZO);
    if (!pezzi.has(chiave)) {
      pezzi.set(chiave, {
        persiane: nuovoGruppo(), finestre: nuovoGruppo(), capannone: nuovoGruppo(),
        lisci: nuovoGruppo(), tegole: nuovoGruppo(), piatti: nuovoGruppo()
      });
    }
    const gruppi = pezzi.get(chiave);

    coloreMuro.setHex(edificio.k > 0 ? 0xe4ddd0 : COLORI_MURI[edificio.c % COLORI_MURI.length]);
    coloreTetto.setHex(edificio.t === 1 ? COLORE_TETTO_TEGOLE : COLORE_TETTO_PIATTO);

    // Che facciata? Chiese e campanili lisce, edifici grandi e bassi capannoni, le case con o senza persiane
    const area = superficie(p);
    let facciata;
    if (edificio.k > 0) facciata = gruppi.lisci;
    else if (edificio.t !== 1 && area > 900 && edificio.h - edificio.b < 12) facciata = gruppi.capannone;
    else facciata = edificio.c % 3 === 0 ? gruppi.finestre : gruppi.persiane;

    for (let i = 0; i < punti; i++) {
      const j = (i + 1) % punti;
      muro(facciata, coloreMuro, p[i * 2], p[i * 2 + 1], p[j * 2], p[j * 2 + 1], edificio.b, edificio.h);
    }
    aggiungiTetto(gruppi, edificio, coloreMuro, coloreTetto);
  }

  const materiali = {
    persiane: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.persiane, side: THREE.DoubleSide }),
    finestre: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.finestre, side: THREE.DoubleSide }),
    capannone: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.capannone, side: THREE.DoubleSide }),
    lisci: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    tegole: new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.tegole, side: THREE.DoubleSide }),
    piatti: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  };
  for (const gruppi of pezzi.values()) {
    for (const nome of Object.keys(gruppi)) {
      const g = gruppi[nome];
      if (g.posizioni.length === 0) continue;
      const geometria = new THREE.BufferGeometry();
      geometria.setAttribute("position", new THREE.Float32BufferAttribute(g.posizioni, 3));
      geometria.setAttribute("color", new THREE.Float32BufferAttribute(g.colori, 3));
      geometria.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
      geometria.computeVertexNormals();
      scena.add(new THREE.Mesh(geometria, materiali[nome]));
    }
  }
}

// --- Tetti ---------------------------------------------------------------------
// Case e chiese (t = 1): tetto a due falde se l'edificio ha 4 lati, altrimenti a padiglione.
// Campanili (k = 2): guglia a punta. Palazzi e capannoni: tetto piatto.

const BIANCO = new THREE.Color(1, 1, 1);

function triangolo(gruppo, colore, a, b, c) {
  gruppo.posizioni.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  // UV dall'alto: una texture ogni 2 m
  gruppo.uv.push(a[0] / 2, a[2] / 2, b[0] / 2, b[2] / 2, c[0] / 2, c[2] / 2);
  aggiungiColore(gruppo.colori, colore, 3);
}

function superficie(p) {
  let somma = 0;
  const punti = p.length / 2;
  for (let i = 0; i < punti; i++) {
    const j = (i + 1) % punti;
    somma += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return Math.abs(somma) / 2;
}

function tettoPiatto(gruppo, edificio, tetto) {
  const p = edificio.p;
  const contorno = [];
  for (let i = 0; i < p.length / 2; i++) contorno.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contorno, [])) {
    triangolo(gruppo, tetto,
      [contorno[a].x, edificio.h, contorno[a].y],
      [contorno[b].x, edificio.h, contorno[b].y],
      [contorno[c].x, edificio.h, contorno[c].y]);
  }
}

function tettoAPunta(gruppo, edificio, tetto, altezzaPunta) {
  const p = edificio.p;
  const punti = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < punti; i++) { cx += p[i * 2]; cz += p[i * 2 + 1]; }
  const punta = [cx / punti, edificio.h + altezzaPunta, cz / punti];
  for (let i = 0; i < punti; i++) {
    const j = (i + 1) % punti;
    triangolo(gruppo, tetto, [p[i * 2], edificio.h, p[i * 2 + 1]], [p[j * 2], edificio.h, p[j * 2 + 1]], punta);
  }
}

function tettoADueFalde(gruppi, edificio, muroColore) {
  const p = edificio.p;
  let v = [[p[0], p[1]], [p[2], p[3]], [p[4], p[5]], [p[6], p[7]]];
  // il colmo va nel senso del lato lungo
  if (Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) < Math.hypot(v[2][0] - v[1][0], v[2][1] - v[1][1])) {
    v = [v[1], v[2], v[3], v[0]];
  }
  const [a, b, c, d] = v;
  const corto = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const colmo = edificio.h + Math.min(4, corto * 0.35);
  const h = edificio.h;
  const mBC = [(b[0] + c[0]) / 2, colmo, (b[1] + c[1]) / 2];
  const mDA = [(d[0] + a[0]) / 2, colmo, (d[1] + a[1]) / 2];
  const A = [a[0], h, a[1]], B = [b[0], h, b[1]], C = [c[0], h, c[1]], D = [d[0], h, d[1]];
  triangolo(gruppi.tegole, BIANCO, A, B, mBC);   // falda 1
  triangolo(gruppi.tegole, BIANCO, A, mBC, mDA);
  triangolo(gruppi.tegole, BIANCO, C, D, mDA);   // falda 2
  triangolo(gruppi.tegole, BIANCO, C, mDA, mBC);
  triangolo(gruppi.lisci, muroColore, B, C, mBC);    // timpani (stesso colore dei muri, senza finestre)
  triangolo(gruppi.lisci, muroColore, D, A, mDA);
}

function aggiungiTetto(gruppi, edificio, muroColore, tetto) {
  const area = superficie(edificio.p);
  const punti = edificio.p.length / 2;
  if (edificio.k === 2) {
    tettoAPunta(gruppi.tegole, edificio, BIANCO, Math.max(4, Math.sqrt(area) * 1.1));   // guglia del campanile
  } else if (edificio.t === 1 && (edificio.k === 1 || area < 900)) {
    if (punti === 4) {
      tettoADueFalde(gruppi, edificio, muroColore);
    } else {
      tettoAPunta(gruppi.tegole, edificio, BIANCO, Math.min(3.5, Math.sqrt(area) * 0.3));
    }
  } else {
    tettoPiatto(gruppi.piatti, edificio, tetto);
  }
}

// Il punto (x, z) e' dentro un poligono? (metodo del raggio)
function dentroPoligono(p, x, z) {
  let dentro = false;
  const punti = p.length / 2;
  for (let i = 0, j = punti - 1; i < punti; j = i++) {
    const xi = p[i * 2], zi = p[i * 2 + 1];
    const xj = p[j * 2], zj = p[j * 2 + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

// La moto (alla quota y) e' dentro un edificio?
export function dentroEdificio(edifici, x, z, y) {
  const lista = edifici.griglia.get(Math.floor(x / CELLA) + "," + Math.floor(z / CELLA));
  if (!lista) return false;
  for (const i of lista) {
    const edificio = edifici.lista[i];
    if (y < edificio.h && y > edificio.b - 2 && dentroPoligono(edificio.p, x, z)) {
      return true;
    }
  }
  return false;
}
