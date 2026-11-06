// Acqua da OpenStreetMap: fiumi larghi e stagni (superfici) e torrenti (nastri).
// Il Lago Maggiore e' la superficie piatta creata in terreno.js.

import * as THREE from "three";
import { quotaTerreno } from "./terreno.js";

const SOPRA = 0.25;   // l'acqua sta 25 cm sopra il terreno, cosi' si vede

export async function caricaAcqua() {
  const risposta = await fetch("dati/acqua.json");
  if (!risposta.ok) return { poligoni: [], fiumi: [] };
  return risposta.json();
}

function vettori(lista) {
  const punti = [];
  for (let i = 0; i + 1 < lista.length; i += 2) {
    punti.push(new THREE.Vector2(lista[i], lista[i + 1]));
  }
  return punti;
}

export function aggiungiAcqua(acqua, scena, terreno) {
  const posizioni = [];

  // 1) Superfici (fiumi larghi, stagni): il contorno diviso in triangoli
  for (const poligono of acqua.poligoni) {
    const contorno = vettori(poligono.o);
    const buchi = poligono.f.map(vettori);
    if (contorno.length < 3) continue;
    const tutti = contorno.concat(...buchi);
    const triangoli = THREE.ShapeUtils.triangulateShape(contorno, buchi);
    for (const triangolo of triangoli) {
      for (const indice of triangolo) {
        const punto = tutti[indice];
        const y = poligono.piatto !== null ? poligono.piatto : quotaTerreno(terreno, punto.x, punto.y) + SOPRA;
        posizioni.push(punto.x, y, punto.y);
      }
    }
  }

  // 2) Torrenti e fiumi stretti: nastri che seguono il terreno
  for (const fiume of acqua.fiumi) {
    const p = fiume.p;
    const punti = p.length / 2;
    let prima = null;
    for (let i = 0; i < punti; i++) {
      const a = Math.max(i - 1, 0) * 2;
      const b = Math.min(i + 1, punti - 1) * 2;
      let dx = p[b] - p[a];
      let dz = p[b + 1] - p[a + 1];
      const lunghezza = Math.hypot(dx, dz) || 1;
      const latoX = (-dz / lunghezza) * fiume.w / 2;
      const latoZ = (dx / lunghezza) * fiume.w / 2;
      const x = p[i * 2];
      const z = p[i * 2 + 1];
      const y = quotaTerreno(terreno, x, z) + SOPRA;
      const ora = [x + latoX, y, z + latoZ, x - latoX, y, z - latoZ];
      if (prima !== null) {
        posizioni.push(prima[0], prima[1], prima[2], ora[0], ora[1], ora[2], prima[3], prima[4], prima[5]);
        posizioni.push(prima[3], prima[4], prima[5], ora[0], ora[1], ora[2], ora[3], ora[4], ora[5]);
      }
      prima = ora;
    }
  }

  if (posizioni.length === 0) return;
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3));
  geometria.computeVertexNormals();
  scena.add(new THREE.Mesh(geometria, new THREE.MeshLambertMaterial({
    color: 0x3a7aa3,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  })));
}
