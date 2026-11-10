// Effetti del meteo sui materiali: superfici bagnate (piu' scure e lucide, con pozzanghere sull'asfalto)
// e neve che si deposita sulle superfici rivolte verso l'alto.
// La neve dipende dalla QUOTA: sotto la quota della neve non c'e'; sopra si scioglie in modo graduale (transizione di 240 m).
// Si aggiunge a un materiale gia' esistente senza toccare il suo programma (si concatena a onBeforeCompile).

import * as THREE from "three";

// opzioni: neve = quanto il materiale si copre (0-1, 0 = per niente), bagnato = quanto cambia con la pioggia (0-1),
// pozzanghere = chiazze lucide (solo strade), orizzontale = soglia della pendenza per la neve
export function aggiungiMeteo(materiale, ambiente, opzioni) {
  const o = Object.assign({ neve: 1, bagnato: 1, pozzanghere: false }, opzioni || {});
  const precedente = materiale.onBeforeCompile;
  const chiavePrec = materiale.customProgramCacheKey ? materiale.customProgramCacheKey() : "";
  materiale.onBeforeCompile = function (shader, disegnatore) {
    if (precedente) precedente(shader, disegnatore);
    const u = ambiente.uniformi;
    shader.uniforms.uBagnato = u.bagnato;
    shader.uniforms.uNeveDin = u.neveDin;
    shader.uniforms.uQNeveDin = u.quotaNeveDin;
    shader.uniforms.uQNeveFissa = u.quotaNeveFissa;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMeteoPos;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vMeteoPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vMeteoPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif
        }`);
    const blocco = `
      {
        vec3 nMondo = inverseTransformDirection(normal, viewMatrix);
        float rm = hMeteo(floor(vMeteoPos.xz * 0.6));
        float grana = nMeteo(vMeteoPos.xz * 0.9) * 0.6 + nMeteo(vMeteoPos.xz * 4.1) * 0.4;
        ${o.bagnato > 0 ? `
        float b = uBagnato * ${o.bagnato.toFixed(2)};
        float su = smoothstep(0.5, 0.9, nMondo.y);
        diffuseColor.rgb *= mix(1.0, ${o.pozzanghere ? "0.58" : "0.7"}, b);
        ${o.pozzanghere ? `
        float pozza = smoothstep(0.58, 0.7, nMeteo(vMeteoPos.xz * 0.23) * 0.65 + nMeteo(vMeteoPos.xz * 0.7) * 0.35) * su;
        roughnessFactor = mix(roughnessFactor, mix(0.5, 0.09, pozza), b * su);
        diffuseColor.rgb *= mix(1.0, 0.8, pozza * b);` : `
        roughnessFactor = mix(roughnessFactor, max(0.18, roughnessFactor * 0.45), b);`}` : ""}
        ${o.neve > 0 ? `
        float fissa = smoothstep(uQNeveFissa - 160.0, uQNeveFissa + 160.0, vMeteoPos.y);
        float dinamica = smoothstep(uQNeveDin - 90.0, uQNeveDin + 150.0, vMeteoPos.y) * uNeveDin;
        float coperta = max(fissa, dinamica) * smoothstep(0.42, 0.82, nMondo.y) * ${o.neve.toFixed(2)};
        coperta = clamp((coperta - (grana - 0.5) * 0.45) * 1.25, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98) * (0.92 + rm * 0.08), coperta);
        roughnessFactor = mix(roughnessFactor, 0.88, coperta);` : ""}
      }`;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vMeteoPos;
        uniform float uBagnato;
        uniform float uNeveDin;
        uniform float uQNeveDin;
        uniform float uQNeveFissa;
        float hMeteo(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nMeteo(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hMeteo(i), hMeteo(i + vec2(1.0, 0.0)), f.x), mix(hMeteo(i + vec2(0.0, 1.0)), hMeteo(i + vec2(1.0, 1.0)), f.x), f.y);
        }`)
      .replace("#include <lights_physical_fragment>", blocco + "\n#include <lights_physical_fragment>");
  };
  materiale.customProgramCacheKey = function () {
    return chiavePrec + "|meteo" + o.neve + "-" + o.bagnato + (o.pozzanghere ? "p" : "");
  };
  return materiale;
}

void THREE;
