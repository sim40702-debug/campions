// Dettaglio delle superfici: macchie di colore a grande scala, grana fine, variazione di lucidita' e un rilievo
// (bump) calcolato dalla scheda video, cosi' asfalto, marciapiedi e prati non sono piani lisci con una texture sopra.
// Tutto sfuma con la distanza dalla telecamera (niente sfarfallio lontano). Si concatena a onBeforeCompile
// come aggiungiMeteo, quindi va bene chiamarlo prima o dopo.

import * as THREE from "three";

// opzioni:
//  macchie: quanto variano i colori a grande scala (0-1)      grana: grana fine del colore (0-1)
//  rugosita: variazione della lucidita' (0-1)                rilievo: altezza del bump in metri (0.005 = 5 mm)
//  scalaRilievo: frequenza del rilievo (piu' alto = grana piu' fine)
export function aggiungiDettaglio(materiale, opzioni) {
  const o = Object.assign({ macchie: 0.25, grana: 0.2, rugosita: 0.2, rilievo: 0.012, scalaRilievo: 9, usura: 0, nome: "d" }, opzioni || {});
  const precedente = materiale.onBeforeCompile;
  const chiavePrec = materiale.customProgramCacheKey ? materiale.customProgramCacheKey() : "";
  materiale.onBeforeCompile = function (shader, disegnatore) {
    if (precedente) precedente(shader, disegnatore);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vDettXZ;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vDettXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
          #else
            vDettXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
          #endif
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec2 vDettXZ;
        float hD(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nD(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hD(i), hD(i + vec2(1.0, 0.0)), f.x), mix(hD(i + vec2(0.0, 1.0)), hD(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float macroD(vec2 p) { return nD(p * 0.045) * 0.5 + nD(p * 0.17) * 0.3 + nD(p * 0.61) * 0.2; }
        float rilievoD(vec2 p) { return nD(p * ${o.scalaRilievo.toFixed(2)}) * 0.55 + nD(p * ${(o.scalaRilievo * 3.1).toFixed(2)}) * 0.45; }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float vicinoD = 1.0 - smoothstep(35.0, 230.0, length(vViewPosition));
        float macroV = macroD(vDettXZ);
        diffuseColor.rgb *= 1.0 + (macroV - 0.5) * ${(o.macchie * 1.4).toFixed(3)};
        diffuseColor.rgb *= 1.0 + (nD(vDettXZ * 3.3) * 0.5 + nD(vDettXZ * 11.0) * 0.5 - 0.5) * ${(o.grana).toFixed(3)} * vicinoD;
        ${o.usura > 0 ? `
        // segni consumati: macchie dove la vernice e' saltata (si vede l'asfalto sotto)
        if (nD(vDettXZ * 6.5) * 0.55 + nD(vDettXZ * 21.0) * 0.45 > ${(0.93 - o.usura * 1.3).toFixed(3)}) discard;` : ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (macroV - 0.5) * ${o.rugosita.toFixed(3)} + (nD(vDettXZ * 5.7) - 0.5) * ${(o.rugosita * 0.6).toFixed(3)} * vicinoD, 0.04, 1.0);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          // bump: la pendenza di un'altezza casuale, con le derivate dello schermo (come perturbNormalArb di three)
          float hh = rilievoD(vDettXZ) * ${o.rilievo.toFixed(4)} * vicinoD;
          vec3 sx = dFdx(-vViewPosition);
          vec3 sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal);
          vec3 r2 = cross(normal, sx);
          float det = dot(sx, r1);
          vec3 grad = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  materiale.customProgramCacheKey = function () {
    return chiavePrec + "|dett" + o.nome + o.macchie + o.grana + o.rugosita + o.rilievo + o.scalaRilievo + o.usura;
  };
  return materiale;
}

void THREE;
