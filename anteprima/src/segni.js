// Segni neri delle gomme sull'asfalto (derapate e frenate forti).
// Tanti rettangolini scuri in una sola InstancedMesh: quando sono finiti si riusano i piu' vecchi.

import * as THREE from "three";

const QUANTI = 3000;

export function creaSegni(scena) {
  const forma = new THREE.PlaneGeometry(0.16, 0.36);
  forma.rotateX(-Math.PI / 2);
  const materiale = new THREE.MeshLambertMaterial({
    color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2
  });
  const istanze = new THREE.InstancedMesh(forma, materiale, QUANTI);
  istanze.count = 0;
  istanze.frustumCulled = false;
  scena.add(istanze);
  return { istanze: istanze, prossimo: 0, ultimi: new Map() };
}

// Lascia un segno sotto una ruota (chiave = quale ruota) se si e' spostata di almeno 30 cm
function unSegno(segni, x, y, z, angolo) {
  const matrice = new THREE.Matrix4();
  matrice.compose(new THREE.Vector3(x, y + 0.03, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angolo),
    new THREE.Vector3(1, 1, 1));
  segni.istanze.setMatrixAt(segni.prossimo, matrice);
  segni.prossimo = (segni.prossimo + 1) % QUANTI;
  segni.istanze.count = Math.max(segni.istanze.count, segni.prossimo === 0 ? QUANTI : segni.prossimo);
  segni.istanze.instanceMatrix.needsUpdate = true;
}

export function lasciaSegno(segni, chiave, x, y, z, angolo) {
  const ultimo = segni.ultimi.get(chiave);
  if (ultimo) {
    const distanza = Math.hypot(ultimo[0] - x, ultimo[1] - z);
    if (distanza < 0.3) return;
    // se la ruota ha fatto tanta strada in un fotogramma, riempio il buco: la riga resta continua
    const pezzi = Math.min(15, Math.floor(distanza / 0.3));
    const direzione = Math.atan2(ultimo[0] - x, ultimo[1] - z);
    for (let i = 1; i < pezzi; i++) {
      const t = i / pezzi;
      unSegno(segni, ultimo[0] + (x - ultimo[0]) * t, ultimo[2] + (y - ultimo[2]) * t, ultimo[1] + (z - ultimo[1]) * t, direzione);
    }
    angolo = direzione;
  }
  segni.ultimi.set(chiave, [x, z, y]);
  unSegno(segni, x, y, z, angolo);
}

// La ruota non lascia segni: il prossimo segno non si collega a quello vecchio
export function staccaSegno(segni, chiave) {
  segni.ultimi.delete(chiave);
}
