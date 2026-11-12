// Foto aeree di DETTAGLIO attorno al giocatore (livello 2 del terreno).
// La foto di tutto il terreno e' a 2 m/pixel (terreno.js): da vicino e' sfocata. Qui si caricano i tasselli a 0.5 m/pixel
// (passo 9, tools/geo/passo9_foto_dettaglio.py), solo vicino alle strade e solo i 4 attorno al giocatore (blocco 2 x 2 da 500 m).
// Il programma del terreno li sfuma con la foto a 2 m: piena nitidezza vicino, nessuno stacco lontano.
// Memoria: 4-6 texture da 1024 x 1024 (circa 6 MB l'una con le mipmap). I tasselli lontani si tolgono.
// Se la cartella dati/foto_hd non c'e' (dati vecchi), non cambia nulla.

import * as THREE from "three";

const vuoto = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
vuoto.needsUpdate = true;

export const uniformiHD = {
  tHD0: { value: vuoto }, tHD1: { value: vuoto }, tHD2: { value: vuoto }, tHD3: { value: vuoto },
  uHDorigine: { value: new THREE.Vector2(1e9, 1e9) }, uHDtile: { value: 500 }, uHDmargine: { value: 6 },
  uHDok: { value: new THREE.Vector4(0, 0, 0, 0) }, uHDraggio: { value: 0 }, uHDcentro: { value: new THREE.Vector2() }
};

const stato = { indice: null, cache: new Map(), raggio: 0, anisotropia: 8, caricatore: new THREE.TextureLoader(), blocco: "", disponibili: new Set() };

export async function caricaFotoHD() {
  try {
    const r = await fetch("dati/foto_hd/indice.json");
    if (!r.ok) return false;
    const indice = await r.json();
    stato.indice = indice;
    stato.disponibili = new Set(indice.tasselli.map(function (t) { return t[0] + "_" + t[1]; }));
    uniformiHD.uHDtile.value = indice.lato_m;
    uniformiHD.uHDmargine.value = indice.margine_m;
    return stato.disponibili.size > 0;
  } catch (errore) {
    return false;
  }
}

export function impostaFotoHD(raggio, anisotropia) {
  stato.raggio = stato.indice ? raggio : 0;
  if (anisotropia) stato.anisotropia = anisotropia;
  uniformiHD.uHDraggio.value = stato.raggio;
  if (stato.raggio === 0) {
    uniformiHD.uHDok.value.set(0, 0, 0, 0);
    // libera la memoria
    for (const v of stato.cache.values()) if (v.tex) v.tex.dispose();
    stato.cache.clear();
    stato.blocco = "";
  }
}

export function fotoHDAttiva() {
  return stato.raggio > 0;
}

function carica(c, r) {
  const chiave = c + "_" + r;
  let voce = stato.cache.get(chiave);
  if (voce) return voce;
  voce = { tex: null, pronta: false, uso: 0 };
  stato.cache.set(chiave, voce);
  if (!stato.disponibili.has(chiave)) return voce;
  stato.caricatore.load("dati/foto_hd/hd_" + chiave + ".jpg", function (t) {
    if (stato.cache.get(chiave) !== voce) { t.dispose(); return; }   // nel frattempo ci si e' allontanati
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = stato.anisotropia;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    voce.tex = t;
    voce.pronta = true;
    stato.blocco = "";   // rifa' i collegamenti
  }, undefined, function () { voce.pronta = false; });
  return voce;
}

// Da chiamare di frequente con la posizione del giocatore (x, z locali)
export function aggiornaFotoHD(x, z) {
  if (stato.raggio === 0 || !stato.indice) return;
  const T = stato.indice.lato_m;
  const gx = (x + stato.indice.meta_x) / T, gz = (z + stato.indice.meta_z) / T;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  // blocco 2 x 2 in cui il giocatore sta piu' lontano dal bordo (almeno meta' tassello = 250 m)
  const c0 = (gx - ix) < 0.5 ? ix - 1 : ix;
  const r0 = (gz - iz) < 0.5 ? iz - 1 : iz;
  uniformiHD.uHDcentro.value.set(x, z);
  const chiave = c0 + "," + r0;
  const nuovo = chiave !== stato.blocco;
  const slot = [[c0, r0], [c0 + 1, r0], [c0, r0 + 1], [c0 + 1, r0 + 1]];
  const voci = slot.map(function (s) { return carica(s[0], s[1]); });
  let ok = true;
  for (const v of voci) if (!v.pronta && v.tex === null) ok = ok && true;
  if (!nuovo && stato.pronti === voci.map(function (v) { return v.pronta ? 1 : 0; }).join("")) return;
  stato.pronti = voci.map(function (v) { return v.pronta ? 1 : 0; }).join("");
  stato.blocco = chiave;
  uniformiHD.uHDorigine.value.set(c0 * T - stato.indice.meta_x, r0 * T - stato.indice.meta_z);
  uniformiHD.tHD0.value = voci[0].tex || vuoto;
  uniformiHD.tHD1.value = voci[1].tex || vuoto;
  uniformiHD.tHD2.value = voci[2].tex || vuoto;
  uniformiHD.tHD3.value = voci[3].tex || vuoto;
  uniformiHD.uHDok.value.set(voci[0].pronta ? 1 : 0, voci[1].pronta ? 1 : 0, voci[2].pronta ? 1 : 0, voci[3].pronta ? 1 : 0);
  // si tolgono i tasselli che non servono piu' (tieni solo il blocco attuale)
  const tenere = new Set(slot.map(function (s) { return s[0] + "_" + s[1]; }));
  for (const [k, v] of stato.cache) {
    if (!tenere.has(k)) {
      if (v.tex) v.tex.dispose();
      stato.cache.delete(k);
    }
  }
  void ok;
}

// Aggiunge il livello di dettaglio a un materiale del terreno (si concatena a onBeforeCompile)
export function aggiungiFotoHD(materiale) {
  const precedente = materiale.onBeforeCompile;
  const chiavePrec = materiale.customProgramCacheKey ? materiale.customProgramCacheKey() : "";
  materiale.onBeforeCompile = function (shader, disegnatore) {
    if (precedente) precedente(shader, disegnatore);
    for (const k of Object.keys(uniformiHD)) shader.uniforms[k] = uniformiHD[k];
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D tHD0;
        uniform sampler2D tHD1;
        uniform sampler2D tHD2;
        uniform sampler2D tHD3;
        uniform vec2 uHDorigine;
        uniform float uHDtile;
        uniform float uHDmargine;
        uniform vec4 uHDok;
        uniform float uHDraggio;
        uniform vec2 uHDcentro;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        if (uHDraggio > 0.0) {
          // posizione nel blocco 2 x 2 (unita' = tassello); le derivate si calcolano fuori dai rami (serve textureGrad)
          vec2 qHD = (vTerrenoXZ - uHDorigine) / uHDtile;
          float kHD = uHDtile / (uHDtile + 2.0 * uHDmargine);
          vec2 gxHD = dFdx(qHD) * kHD;
          vec2 gyHD = dFdy(qHD) * kHD;
          if (qHD.x >= 0.0 && qHD.y >= 0.0 && qHD.x < 2.0 && qHD.y < 2.0) {
            vec2 idHD = floor(qHD);
            vec2 uvHD = (fract(qHD) * uHDtile + uHDmargine) / (uHDtile + 2.0 * uHDmargine);
            vec3 cHD;
            float okHD;
            if (idHD.y < 0.5) {
              if (idHD.x < 0.5) { cHD = textureGrad(tHD0, uvHD, gxHD, gyHD).rgb; okHD = uHDok.x; }
              else { cHD = textureGrad(tHD1, uvHD, gxHD, gyHD).rgb; okHD = uHDok.y; }
            } else {
              if (idHD.x < 0.5) { cHD = textureGrad(tHD2, uvHD, gxHD, gyHD).rgb; okHD = uHDok.z; }
              else { cHD = textureGrad(tHD3, uvHD, gxHD, gyHD).rgb; okHD = uHDok.w; }
            }
            float dHD = length(vTerrenoXZ - uHDcentro);
            hdPeso = (1.0 - smoothstep(uHDraggio * 0.55, uHDraggio, dHD)) * okHD;
            // la foto a 0.5 m ha lo stesso aspetto di quella a 2 m (stessa fonte): si sostituisce con una sfumatura
            diffuseColor.rgb = mix(diffuseColor.rgb, cHD, hdPeso);
          }
        }`);
  };
  materiale.customProgramCacheKey = function () { return chiavePrec + "|hd"; };
  return materiale;
}
