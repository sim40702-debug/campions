// Particelle di pioggia (strisce) e neve (fiocchi) attorno alla telecamera.
// Tutto il movimento lo calcola la scheda video: la CPU aggiorna solo 4 numeri per fotogramma.
// I gocce/fiocchi si ripetono in un volume che segue la telecamera (piu' fitti vicino, nessun oggetto in piu' da creare).

import * as THREE from "three";

const VOL = 56;      // lato del volume attorno alla telecamera (m)
const ALTO = 32;     // altezza del volume (m)

function casuale(seme) {
  let s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function creaPrecipitazioni(scena, ambiente) {
  const uniformi = {
    uTempo: { value: 0 }, uInt: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uVento: { value: new THREE.Vector2(1.5, 0.6) }, uLuce: { value: new THREE.Color(0.8, 0.85, 0.95) }, uScala: { value: 600 }
  };

  // --- Pioggia: segmenti lunghi 1.1 m che cadono a ~13 m/s ---
  const crea = function (quante, tipo) {
    const rnd = casuale(tipo === "p" ? 91 : 37);
    const n = quante;
    const pos = new Float32Array(n * (tipo === "p" ? 2 : 1) * 3);
    const seme = new Float32Array(n * (tipo === "p" ? 2 : 1) * 4);
    const fine = new Float32Array(n * (tipo === "p" ? 2 : 1));
    for (let i = 0; i < n; i++) {
      const a = rnd(), b = rnd(), c = rnd(), d = rnd();
      const vv = tipo === "p" ? 2 : 1;
      for (let k = 0; k < vv; k++) {
        const j = i * vv + k;
        seme[j * 4] = a; seme[j * 4 + 1] = b; seme[j * 4 + 2] = c; seme[j * 4 + 3] = d;
        fine[j] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seme", new THREE.BufferAttribute(seme, 4));
    g.setAttribute("fine", new THREE.BufferAttribute(fine, 1));
    return g;
  };

  const testata = `
    uniform float uTempo; uniform float uInt; uniform vec3 uCam; uniform vec2 uVento; uniform float uScala;
    attribute vec4 seme; attribute float fine;
    varying float vAlfa;
    vec3 posizione(float velocita, float ondeggio) {
      vec2 xz = uCam.xz + mod(seme.xy * ${VOL.toFixed(1)} - uCam.xz + ${(VOL / 2).toFixed(1)}, ${VOL.toFixed(1)}) - ${(VOL / 2).toFixed(1)};
      float y = mod(seme.z * ${ALTO.toFixed(1)} - uTempo * velocita, ${ALTO.toFixed(1)});
      vec3 p = vec3(xz.x, uCam.y - 8.0 + y, xz.y);
      p.xz += uVento * (y - ${(ALTO / 2).toFixed(1)}) * 0.06;
      p.xz += ondeggio * vec2(sin(uTempo * 0.9 + seme.w * 40.0 + y * 0.5), cos(uTempo * 0.7 + seme.z * 30.0 + y * 0.4));
      return p;
    }`;

  const matPioggia = new THREE.ShaderMaterial({
    uniforms: uniformi, transparent: true, depthWrite: false, fog: false,
    vertexShader: `${testata}
      void main() {
        vec3 p = posizione(13.0 + seme.w * 3.0, 0.0);
        // la coda della goccia: lungo la direzione di caduta (verso il basso e un po' col vento)
        p -= fine * vec3(-uVento.x * 0.06, 1.0, -uVento.y * 0.06) * (1.1 + seme.w * 0.8);
        float visibile = step(seme.w, uInt);
        vAlfa = visibile * (1.0 - fine * 0.75);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        if (visibile < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `uniform vec3 uLuce; varying float vAlfa;
      void main() { gl_FragColor = vec4(uLuce, vAlfa * 0.6); }`
  });
  const matNeve = new THREE.ShaderMaterial({
    uniforms: uniformi, transparent: true, depthWrite: false, fog: false,
    vertexShader: `${testata}
      void main() {
        vec3 p = posizione(1.1 + seme.w * 0.9, 1.4);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float visibile = step(seme.w, uInt);
        vAlfa = visibile;
        gl_PointSize = (0.13 + seme.x * 0.08) * uScala / max(0.5, -mv.z) ;
        gl_Position = projectionMatrix * mv;
        if (visibile < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `uniform vec3 uLuce; varying float vAlfa;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.35, 1.0, d)) * vAlfa;
        gl_FragColor = vec4(uLuce, a * 0.9);
      }`
  });

  const sistema = { pioggia: null, neve: null, uniformi: uniformi, quante: 0, scala: 1 };
  sistema.imposta = function (quantita) {
    // quantita: numero massimo di gocce (dipende dalla qualita grafica)
    if (sistema.quante === quantita) return;
    sistema.quante = quantita;
    for (const m of [sistema.pioggia, sistema.neve]) {
      if (m) { scena.remove(m); m.geometry.dispose(); }
    }
    sistema.pioggia = new THREE.LineSegments(crea(quantita, "p"), matPioggia);
    sistema.neve = new THREE.Points(crea(Math.round(quantita * 0.8), "n"), matNeve);
    for (const m of [sistema.pioggia, sistema.neve]) {
      m.frustumCulled = false;
      m.renderOrder = 5;
      scena.add(m);
    }
  };
  sistema.imposta(5000);

  sistema.aggiorna = function (telecamera, schermoAltezza) {
    uniformi.uTempo.value = ambiente.uniformi.tempo.value;
    uniformi.uCam.value.copy(telecamera.position);
    uniformi.uScala.value = schermoAltezza / (2 * Math.tan(telecamera.fov * Math.PI / 360));
    // colore: la luce del cielo (di notte scuro)
    const luce = 0.35 + 0.65 * (1 - ambiente.uniformi.notte.value);
    uniformi.uLuce.value.copy(ambiente.colore.nebbia).lerp(new THREE.Color(1, 1, 1), 0.45).multiplyScalar(luce);
    // vento: piu' forte con la perturbazione
    uniformi.uVento.value.set(1.2 + ambiente.pioggia * 2.5, 0.5);
    sistema.pioggia.visible = ambiente.pioggia > 0.01;
    sistema.neve.visible = ambiente.neve > 0.01;
    // intensita': quante gocce fra quelle disponibili
    uniformi.uInt.value = Math.max(ambiente.pioggia, ambiente.neve);
  };
  return sistema;
}
