// Acqua: materiale con onde (mappa delle normali disegnata dal codice, che scorre) e riflessi del cielo.
// Lo stesso materiale serve per il lago, i fiumi e gli stagni.

import * as THREE from "three";

// Mappa delle normali che si ripete senza giunture: somma di onde con frequenze intere
function texturaOnde(lato) {
  const c = document.createElement("canvas");
  c.width = c.height = lato;
  const g = c.getContext("2d");
  const imm = g.createImageData(lato, lato);
  const onde = [];
  let s = 31337;
  const r = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 14; i++) {
    const kx = Math.floor(r() * 9) - 4, ky = Math.floor(r() * 9) - 4;
    if (kx === 0 && ky === 0) { i--; continue; }
    onde.push({ kx: kx, ky: ky, a: 1 / (1 + Math.hypot(kx, ky) * 0.9), f: r() * 6.28 });
  }
  for (let y = 0; y < lato; y++) {
    for (let x = 0; x < lato; x++) {
      let dx = 0, dy = 0;
      for (const o of onde) {
        const fase = (o.kx * x + o.ky * y) / lato * 6.2832 + o.f;
        const d = Math.cos(fase) * o.a;
        dx += d * o.kx;
        dy += d * o.ky;
      }
      const nx = -dx * 0.16, ny = -dy * 0.16;
      const l = Math.sqrt(nx * nx + ny * ny + 1);
      const k = (y * lato + x) * 4;
      imm.data[k] = Math.round((nx / l * 0.5 + 0.5) * 255);
      imm.data[k + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      imm.data[k + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      imm.data[k + 3] = 255;
    }
  }
  g.putImageData(imm, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

let NORMALI = null;

// opzioni: colore, opacita', scala (metri per ripetizione della mappa), velocita'
export function creaMaterialeAcqua(ambiente, opzioni) {
  const o = Object.assign({ colore: 0x2a6489, opacita: 1, scala: 18, velocita: 0.02 }, opzioni || {});
  if (!NORMALI) NORMALI = texturaOnde(256);
  const normali = NORMALI.clone();
  normali.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({
    color: o.colore, roughness: 0.06, metalness: 0.0, normalMap: normali, normalScale: new THREE.Vector2(0.55, 0.55),
    transparent: o.opacita < 1, opacity: o.opacita, envMapIntensity: 1.6,
    polygonOffset: true, polygonOffsetFactor: o.polygonOffset !== undefined ? o.polygonOffset : -1, polygonOffsetUnits: -1, side: THREE.DoubleSide
  });
  // la mappa si ripete ogni "scala" metri: uso le coordinate del mondo (non le UV)
  m.onBeforeCompile = function (shader) {
    shader.uniforms.uScalaOnde = { value: 1 / o.scala };
    shader.uniforms.uTempoOnde = ambiente.uniformi.tempo;
    shader.uniforms.uVelocita = { value: o.velocita };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMondoXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMondoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMondoXZ;\nuniform float uScalaOnde;\nuniform float uTempoOnde;\nuniform float uVelocita;")
      .replace("#include <normal_fragment_maps>", `
        {
          vec2 p = vMondoXZ * uScalaOnde;
          vec3 n1 = texture2D(normalMap, p + vec2(uTempoOnde * uVelocita, uTempoOnde * uVelocita * 0.6)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(normalMap, p * 2.3 - vec2(uTempoOnde * uVelocita * 1.1, -uTempoOnde * uVelocita * 0.7)).xyz * 2.0 - 1.0;
          vec3 mappaN = normalize(vec3((n1.xy + n2.xy * 0.6) * normalScale, n1.z + n2.z * 0.6));
          // normale "su" nel mondo -> in vista: uso la normale geometrica e la inclino con le onde
          normal = normalize(normal + (normalMatrix * vec3(mappaN.x, 0.0, mappaN.y)) * 0.9);
        }`);
  };
  m.customProgramCacheKey = function () { return "acqua-onde"; };
  return m;
}
