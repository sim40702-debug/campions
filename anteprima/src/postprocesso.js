// Post-elaborazione dell'immagine: la scena viene disegnata in alta gamma dinamica (HDR) con anti-aliasing 4x,
// poi un passaggio finale aggiunge: bagliore (bloom) leggero sulle luci forti, tone mapping ACES,
// correzione colore (contrasto, saturazione, toni caldi alle luci e freddi nelle ombre), vignettatura,
// nitidezza e un velo di rumore che toglie le fasce di colore nel cielo.
// Costo: un disegno della scena (come prima) + 6 passaggi a schermo intero a risoluzione ridotta.
// In qualita' Bassa si disegna direttamente sullo schermo come prima (impostaPost(false)).

import * as THREE from "three";

const VERTICE = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Luci forti: soglia morbida sulla luminosita' HDR, con media di 4 campioni (evita scintillii)
const FRAMMENTO_LUCI = `
  uniform sampler2D tDiffuse;
  uniform vec2 uPixel;
  uniform float uSoglia;
  varying vec2 vUv;
  vec3 campione(vec2 o) { return min(texture2D(tDiffuse, vUv + o * uPixel).rgb, vec3(24.0)); }
  void main() {
    vec3 c = (campione(vec2(-1.0, -1.0)) + campione(vec2(1.0, -1.0)) + campione(vec2(-1.0, 1.0)) + campione(vec2(1.0, 1.0))) * 0.25;
    float l = max(c.r, max(c.g, c.b));
    float k = clamp((l - uSoglia) / max(l, 1e-4), 0.0, 1.0);
    gl_FragColor = vec4(c * k, 1.0);
  }`;

// Sfocatura gaussiana separabile a 9 campioni (7 con il trucco dei campioni lineari)
const FRAMMENTO_SFOCA = `
  uniform sampler2D tDiffuse;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
    s += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    s += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    s += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(s, 1.0);
  }`;

// Occlusione ambientale (AO) dallo spazio schermo: le zone dove due superfici si incontrano (muri e strada,
// sotto le moto, vicino ai marciapiedi) ricevono meno luce ambiente. Usa solo la profondita' della scena.
const FRAMMENTO_AO = `
  uniform sampler2D tProfondita;
  uniform vec2 uProj;        // tan(fov/2) * aspetto, tan(fov/2)
  uniform vec2 uNearFar;
  uniform float uRaggio;     // metri
  uniform float uFrame;
  varying vec2 vUv;
  float zVista(vec2 uv) {
    float d = texture2D(tProfondita, uv).x;
    return (uNearFar.x * uNearFar.y) / ((uNearFar.y - uNearFar.x) * d - uNearFar.y);
  }
  vec3 posVista(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * uProj * (-z), z); }
  void main() {
    float d0 = texture2D(tProfondita, vUv).x;
    if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
    float z0 = zVista(vUv);
    if (-z0 > 160.0) { gl_FragColor = vec4(1.0); return; }
    vec3 pc = posVista(vUv, z0);
    vec2 px = vec2(1.0) / vec2(textureSize(tProfondita, 0));
    vec2 ux = vec2(px.x * 2.0, 0.0), uy = vec2(0.0, px.y * 2.0);
    vec3 pr = posVista(vUv + ux, zVista(vUv + ux)), pl = posVista(vUv - ux, zVista(vUv - ux));
    vec3 pu = posVista(vUv + uy, zVista(vUv + uy)), pd = posVista(vUv - uy, zVista(vUv - uy));
    vec3 dx = abs(pr.z - pc.z) < abs(pc.z - pl.z) ? pr - pc : pc - pl;
    vec3 dy = abs(pu.z - pc.z) < abs(pc.z - pd.z) ? pu - pc : pc - pd;
    vec3 n = normalize(cross(dx, dy));
    if (n.z < 0.0) n = -n;
    float rnd = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + uFrame);
    float raggioUv = clamp(uRaggio / (-z0 * uProj.y) * 0.5, 0.002, 0.09);
    float occ = 0.0;
    const int N = 10;
    for (int i = 0; i < N; i++) {
      float t = (float(i) + 0.5) / float(N);
      float a = (float(i) + rnd) * 2.39996323;
      vec2 o = vec2(cos(a) / (uProj.x / uProj.y), sin(a)) * (t * t * 0.8 + 0.2) * raggioUv;
      vec2 uv = vUv + o;
      vec3 ps = posVista(uv, zVista(uv));
      vec3 v = ps - pc;
      float l = length(v);
      float nv = dot(n, v) / max(l, 1e-4);
      float peso = 1.0 - smoothstep(uRaggio * 0.9, uRaggio * 2.2, l);
      occ += max(0.0, nv - 0.12) * peso;
    }
    float ao = 1.0 - clamp(occ / float(N) * 1.9, 0.0, 0.85);
    ao = mix(ao, 1.0, smoothstep(90.0, 160.0, -z0));
    gl_FragColor = vec4(ao, ao, ao, 1.0);
  }`;

// Sfocatura che rispetta i bordi (usa la profondita'): toglie il rumore dell'AO senza sbavare sugli spigoli
const FRAMMENTO_SFOCA_AO = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tProfondita;
  uniform vec2 uDir;
  uniform vec2 uNearFar;
  varying vec2 vUv;
  float zVista(vec2 uv) {
    float d = texture2D(tProfondita, uv).x;
    return (uNearFar.x * uNearFar.y) / ((uNearFar.y - uNearFar.x) * d - uNearFar.y);
  }
  void main() {
    float zc = zVista(vUv);
    float somma = 0.0, pesi = 0.0;
    for (int i = -3; i <= 3; i++) {
      vec2 uv = vUv + uDir * float(i);
      float w = (1.0 - abs(float(i)) / 4.0) / (1.0 + abs(zVista(uv) - zc) * 6.0 / max(-zc, 1.0) * 40.0);
      somma += texture2D(tDiffuse, uv).r * w;
      pesi += w;
    }
    float v = somma / pesi;
    gl_FragColor = vec4(v, v, v, 1.0);
  }`;

const FRAMMENTO_FINALE = `
  uniform sampler2D tScena;
  uniform sampler2D tBagliore1;
  uniform sampler2D tBagliore2;
  uniform sampler2D tAO;
  uniform float uAO;
  uniform vec2 uPixel;
  uniform float uEsposizione;
  uniform float uBagliore;
  uniform sampler2D tProfondita;
  uniform vec3 uSole;       // posizione del sole sullo schermo (uv) e intensita' del riverbero
  uniform float uAspetto;
  uniform float uGrigio;    // 0 sereno, 1 meteo pessimo
  uniform float uNotte;
  uniform float uTempo;
  varying vec2 vUv;

  vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 aces(vec3 c) {
    const mat3 entrata = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 uscita = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c *= uEsposizione / 0.6;
    c = entrata * c;
    c = RRTAndODTFit(c);
    c = uscita * c;
    return clamp(c, 0.0, 1.0);
  }
  float rumore(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTempo) * 43758.5453); }

  void main() {
    vec3 c = texture2D(tScena, vUv).rgb;
    // AO: scurisce soprattutto le zone in ombra/ambiente; le luci molto forti ne risentono meno
    float ao = mix(1.0, texture2D(tAO, vUv).r, uAO);
    c *= mix(ao, 1.0, clamp((max(c.r, max(c.g, c.b)) - 1.2) * 0.4, 0.0, 0.6));
    // nitidezza: la differenza con i vicini, solo sulla luminosita' e limitata (niente aloni)
    vec3 vic = (texture2D(tScena, vUv + vec2(uPixel.x, 0.0)).rgb + texture2D(tScena, vUv - vec2(uPixel.x, 0.0)).rgb +
                texture2D(tScena, vUv + vec2(0.0, uPixel.y)).rgb + texture2D(tScena, vUv - vec2(0.0, uPixel.y)).rgb) * 0.25;
    vec3 det = clamp(c - vic, vec3(-0.6), vec3(0.6));
    c += det * 0.28;
    // bagliore
    c += (texture2D(tBagliore1, vUv).rgb * 0.65 + texture2D(tBagliore2, vUv).rgb * 0.9) * uBagliore;
    // riverbero del sole: alone morbido nel cielo e un velo leggero sulle cose davanti (obiettivo sporco)
    if (uSole.z > 0.0) {
      float dS = length((vUv - uSole.xy) * vec2(uAspetto, 1.0));
      float alone = exp(-dS * 4.5) * 0.28 + exp(-dS * 20.0) * 0.8 + exp(-dS * 90.0) * 2.5;
      float cielo = step(0.99999, texture2D(tProfondita, vUv).x);
      c += vec3(1.0, 0.84, 0.6) * alone * uSole.z * mix(0.2, 1.0, cielo);
    }
    c = aces(max(c, 0.0));
    // correzione colore (in spazio display, dopo il tone mapping)
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, (1.10 + 0.06 * (1.0 - uNotte)) * (1.0 - 0.38 * uGrigio));   // saturazione (meno con meteo brutto)
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);                              // curva a S morbida (contrasto)
    vec3 caldo = vec3(1.035, 1.0, 0.955);
    vec3 freddo = vec3(0.955, 0.99, 1.045);
    c *= mix(freddo, caldo, smoothstep(0.1, 0.8, l));                       // ombre fredde, luci calde
    // vignettatura leggera
    vec2 q = vUv - 0.5;
    float v = 1.0 - dot(q, q) * 0.62;
    c *= clamp(v, 0.0, 1.0);
    // rumore finissimo contro le fasce di colore
    c += (rumore(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

function materialeSchermo(frammento, uniformi) {
  return new THREE.ShaderMaterial({
    uniforms: uniformi, vertexShader: VERTICE, fragmentShader: frammento,
    depthTest: false, depthWrite: false, toneMapped: false
  });
}

export function creaPostprocesso(disegnatore) {
  const post = { attivo: true, bagliore: 1, ao: true, larghezza: 0, altezza: 0 };
  const dimensione = new THREE.Vector2();
  const avanti = new THREE.Vector3(), vSole = new THREE.Vector3();

  // un triangolo che copre lo schermo
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometria.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const schermo = new THREE.Mesh(geometria, null);
  schermo.frustumCulled = false;
  const scenaSchermo = new THREE.Scene();
  scenaSchermo.add(schermo);
  const telecameraSchermo = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uLuci = { tDiffuse: { value: null }, uPixel: { value: new THREE.Vector2() }, uSoglia: { value: 1.0 } };
  const uSfocaA = { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } };
  const uFinale = {
    tScena: { value: null }, tBagliore1: { value: null }, tBagliore2: { value: null },
    uPixel: { value: new THREE.Vector2() }, uEsposizione: { value: 1.1 }, uBagliore: { value: 0.16 },
    uNotte: { value: 0 }, uTempo: { value: 0 }, tAO: { value: null }, uAO: { value: 0.9 },
    tProfondita: { value: null }, uSole: { value: new THREE.Vector3(0.5, 0.5, 0) }, uAspetto: { value: 1.78 }, uGrigio: { value: 0 }
  };
  const uAO = {
    tProfondita: { value: null }, uProj: { value: new THREE.Vector2(1, 1) }, uNearFar: { value: new THREE.Vector2(0.3, 9000) },
    uRaggio: { value: 1.6 }, uFrame: { value: 0 }
  };
  const uSfocaAO = { tDiffuse: { value: null }, tProfondita: { value: null }, uDir: { value: new THREE.Vector2() }, uNearFar: uAO.uNearFar };
  const matAO = materialeSchermo(FRAMMENTO_AO, uAO);
  const matSfocaAO = materialeSchermo(FRAMMENTO_SFOCA_AO, uSfocaAO);
  const matLuci = materialeSchermo(FRAMMENTO_LUCI, uLuci);
  const matSfoca = materialeSchermo(FRAMMENTO_SFOCA, uSfocaA);
  const matFinale = materialeSchermo(FRAMMENTO_FINALE, uFinale);

  const opzioniMezze = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const rtScena = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 });
  rtScena.texture.generateMipmaps = false;
  rtScena.depthTexture = new THREE.DepthTexture(4, 4);
  rtScena.depthTexture.type = THREE.UnsignedIntType;
  const rtAO = new THREE.WebGLRenderTarget(4, 4, opzioniMezze);
  const rtAO2 = new THREE.WebGLRenderTarget(4, 4, opzioniMezze);
  const rtA1 = new THREE.WebGLRenderTarget(4, 4, opzioniMezze);
  const rtB1 = new THREE.WebGLRenderTarget(4, 4, opzioniMezze);
  const rtA2 = new THREE.WebGLRenderTarget(4, 4, opzioniMezze);
  const rtB2 = new THREE.WebGLRenderTarget(4, 4, opzioniMezze);

  // statistiche: con piu' passaggi "info.render" ripartirebbe da zero ad ogni disegno
  disegnatore.info.autoReset = false;

  function passaggio(materiale, bersaglio) {
    schermo.material = materiale;
    disegnatore.setRenderTarget(bersaglio);
    disegnatore.render(scenaSchermo, telecameraSchermo);
  }

  function ridimensiona() {
    disegnatore.getDrawingBufferSize(dimensione);
    const w = Math.max(2, dimensione.x | 0), h = Math.max(2, dimensione.y | 0);
    if (w === post.larghezza && h === post.altezza) return;
    post.larghezza = w;
    post.altezza = h;
    rtScena.setSize(w, h);
    const w1 = Math.max(2, (w / 4) | 0), h1 = Math.max(2, (h / 4) | 0);
    const w2 = Math.max(2, (w / 16) | 0), h2 = Math.max(2, (h / 16) | 0);
    rtAO.setSize(Math.max(2, (w / 2) | 0), Math.max(2, (h / 2) | 0));
    rtAO2.setSize(rtAO.width, rtAO.height);
    rtA1.setSize(w1, h1);
    rtB1.setSize(w1, h1);
    rtA2.setSize(w2, h2);
    rtB2.setSize(w2, h2);
  }

  // Disegna un fotogramma. "esposizione" e' quella dell'ambiente (disegnatore.toneMappingExposure)
  post.disegna = function (scena, telecamera, notte, tempo, atmo) {
    if (!post.attivo) {
      disegnatore.info.reset();
      disegnatore.setRenderTarget(null);
      disegnatore.render(scena, telecamera);
      return;
    }
    ridimensiona();
    disegnatore.info.reset();
    disegnatore.setRenderTarget(rtScena);
    disegnatore.render(scena, telecamera);

    const w = post.larghezza, h = post.altezza;
    if (post.ao) {
      uAO.tProfondita.value = rtScena.depthTexture;
      uSfocaAO.tProfondita.value = rtScena.depthTexture;
      const tg = Math.tan(telecamera.fov * Math.PI / 360);
      uAO.uProj.value.set(tg * telecamera.aspect, tg);
      uAO.uNearFar.value.set(telecamera.near, telecamera.far);
      uAO.uFrame.value = (tempo * 7.31) % 1;
      passaggio(matAO, rtAO);
      uSfocaAO.tDiffuse.value = rtAO.texture;
      uSfocaAO.uDir.value.set(1.6 / rtAO.width, 0);
      passaggio(matSfocaAO, rtAO2);
      uSfocaAO.tDiffuse.value = rtAO2.texture;
      uSfocaAO.uDir.value.set(0, 1.6 / rtAO.height);
      passaggio(matSfocaAO, rtAO);
      uFinale.tAO.value = rtAO.texture;
    }
    uFinale.uAO.value = post.ao ? 0.9 : 0;
    if (!post.ao) uFinale.tAO.value = rtA1.texture;
    uFinale.uEsposizione.value = disegnatore.toneMappingExposure;
    uFinale.tProfondita.value = rtScena.depthTexture;
    uFinale.uAspetto.value = telecamera.aspect;
    uFinale.uGrigio.value = atmo ? atmo.grigio : 0;
    // sole sullo schermo (solo se davanti alla telecamera, sopra l'orizzonte e non coperto dalle nuvole)
    uFinale.uSole.value.z = 0;
    if (atmo && atmo.direzioneSole && atmo.direzioneSole.y > 0.02) {
      telecamera.getWorldDirection(avanti);
      const davanti = avanti.dot(atmo.direzioneSole);
      if (davanti > 0.15) {
        vSole.copy(atmo.direzioneSole).multiplyScalar(1000).add(telecamera.position).project(telecamera);
        uFinale.uSole.value.set(vSole.x * 0.5 + 0.5, vSole.y * 0.5 + 0.5, Math.pow((davanti - 0.15) / 0.85, 2.0) * (1 - atmo.grigio * 0.85) * Math.min(1, atmo.direzioneSole.y * 6) * 0.9);
      }
    }
    uFinale.uBagliore.value = 0.2 * post.bagliore * (1 + notte * 0.9);
    uFinale.uNotte.value = notte;
    uFinale.uTempo.value = (tempo % 100) * 0.37;
    uFinale.uPixel.value.set(1 / w, 1 / h);
    if (post.bagliore > 0) {
      // luci forti -> 1/4 -> sfocatura -> 1/16 -> sfocatura
      uLuci.tDiffuse.value = rtScena.texture;
      uLuci.uPixel.value.set(2 / w, 2 / h);
      uLuci.uSoglia.value = 1.15 - notte * 0.55;
      passaggio(matLuci, rtA1);
      uSfocaA.tDiffuse.value = rtA1.texture;
      uSfocaA.uDir.value.set(1 / rtA1.width, 0);
      passaggio(matSfoca, rtB1);
      uSfocaA.tDiffuse.value = rtB1.texture;
      uSfocaA.uDir.value.set(0, 1 / rtA1.height);
      passaggio(matSfoca, rtA1);
      // livello piu' largo: parte da quello sfocato
      uLuci.tDiffuse.value = rtA1.texture;
      uLuci.uPixel.value.set(2 / rtA1.width, 2 / rtA1.height);
      uLuci.uSoglia.value = 0.0;
      passaggio(matLuci, rtA2);
      uSfocaA.tDiffuse.value = rtA2.texture;
      uSfocaA.uDir.value.set(1 / rtA2.width, 0);
      passaggio(matSfoca, rtB2);
      uSfocaA.tDiffuse.value = rtB2.texture;
      uSfocaA.uDir.value.set(0, 1 / rtA2.height);
      passaggio(matSfoca, rtA2);
    }
    uFinale.tScena.value = rtScena.texture;
    uFinale.tBagliore1.value = rtA1.texture;
    uFinale.tBagliore2.value = rtA2.texture;
    // se il bagliore e' spento le texture contengono l'ultimo valore: lo azzero con uBagliore
    if (post.bagliore <= 0) uFinale.uBagliore.value = 0;
    passaggio(matFinale, null);
  };

  return post;
}
