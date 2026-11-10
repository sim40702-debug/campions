// Benchmark ripetibile: 8 scenari fissi (stessi punti, stessa ora, stesso meteo, stessa telecamera che gira lentamente)
// e le stesse misure ad ogni esecuzione: FPS medi e minimi, 1% low, tempi di fotogramma (mediana, p95, p99),
// memoria, triangoli, chiamate alla scheda video. I punti si trovano dai DATI (zone riconosciute dagli edifici),
// quindi il benchmark funziona con qualsiasi mondo e restituisce sempre lo stesso risultato per gli stessi dati.
//
// Si lancia da Impostazioni ("Benchmark ripetibile") oppure da codice: window.__mrw.eseguiBenchmark({...}).
// I risultati dicono SEMPRE su che macchina sono stati misurati (scheda video, risoluzione, browser).

import { ZONA } from "./edifici.js";
import { impostaMeteoSenzaSalvare } from "./ambiente.js";

// Scenari: nome, zona/luogo cercato, ora, meteo, distanza e altezza della telecamera
export const SCENARI = [
  { id: "centro_storico", nome: "Centro storico di Locarno", cerca: "storico", ora: 14, meteo: "sereno", dist: 14, alto: 5 },
  { id: "lungolago", nome: "Lungolago", cerca: "lungolago", ora: 17.5, meteo: "variabile", dist: 16, alto: 5 },
  { id: "residenziale", nome: "Area residenziale", cerca: "residenziale", ora: 11, meteo: "sereno", dist: 14, alto: 4.5 },
  { id: "industriale", nome: "Zona industriale", cerca: "industriale", ora: 10, meteo: "variabile", dist: 18, alto: 6 },
  { id: "montana", nome: "Zona montana", cerca: "montana", ora: 12, meteo: "sereno", dist: 16, alto: 5 },
  { id: "panorama", nome: "Vista panoramica della citta'", cerca: "storico", ora: 15, meteo: "sereno", dist: 230, alto: 140 },
  { id: "notte", nome: "Notte", cerca: "storico", ora: 22.5, meteo: "sereno", dist: 14, alto: 5 },
  { id: "pioggia_neve", nome: "Pioggia (citta') e neve (montagna)", cerca: "storico", ora: 14, meteo: "pioggia_intensa", dist: 14, alto: 5, poi: { cerca: "montana", meteo: "neve_intensa" } }
];

function percentile(ordinati, p) {
  if (ordinati.length === 0) return 0;
  const i = Math.min(ordinati.length - 1, Math.max(0, Math.ceil(p * ordinati.length) - 1));
  return ordinati[i];
}

export function descriviAmbiente(disegnatore, qualita) {
  let scheda = "sconosciuta";
  try {
    const gl = disegnatore.getContext();
    const est = gl.getExtension("WEBGL_debug_renderer_info");
    if (est) scheda = gl.getParameter(est.UNMASKED_RENDERER_WEBGL) + " (" + gl.getParameter(est.UNMASKED_VENDOR_WEBGL) + ")";
  } catch (errore) {
    // niente informazioni
  }
  const software = /swiftshader|llvmpipe|software/i.test(scheda);
  return {
    scheda_video: scheda,
    grafica_software: software,
    nota: software ? "ATTENZIONE: grafica emulata via software (CPU), gli FPS NON rappresentano una scheda video vera: servono solo per confronti tra versioni sulla stessa macchina." : "",
    browser: navigator.userAgent,
    cpu_core: navigator.hardwareConcurrency || 0,
    memoria_gb: navigator.deviceMemory || 0,
    finestra: window.innerWidth + "x" + window.innerHeight,
    pixel_ratio: disegnatore.getPixelRatio(),
    qualita: qualita,
    data: new Date().toISOString()
  };
}

// Trova i punti dei vari scenari nei dati
export function trovaPunti(ctx) {
  const { edifici, luoghi, strade, terreno } = ctx;
  const lago = terreno.info.livello_lago;
  const centro = luoghi.lista.find(function (l) { return l.n === "Locarno"; }) || luoghi.lista.slice().sort(function (a, b) { return (b.t === "city") - (a.t === "city"); })[0] || { x: 0, z: 0 };
  const punti = {};
  // celle di zona, ordinate per distanza dal centro
  const celle = [];
  for (const [chiave, z] of edifici.zone || []) {
    const [ix, iz] = chiave.split(",").map(Number);
    celle.push({ x: (ix + 0.5) * 80, z: (iz + 0.5) * 80, zona: z.zona, densita: z.densita });
  }
  const vicino = function (zona, distMax) {
    let m = null, dm = Infinity;
    for (const c of celle) {
      if (c.zona !== zona || c.densita < 0.12) continue;
      const d = Math.hypot(c.x - centro.x, c.z - centro.z);
      if (d < dm && d < distMax) { dm = d; m = c; }
    }
    return m;
  };
  punti.storico = vicino(ZONA.STORICO, 2500) || vicino(ZONA.COMMERCIALE, 2500) || { x: centro.x, z: centro.z };
  punti.residenziale = vicino(ZONA.RESIDENZIALE, 4000) || punti.storico;
  let ind = null;
  for (const c of celle) if (c.zona === ZONA.INDUSTRIALE && (ind === null || c.densita > ind.densita)) ind = c;
  punti.industriale = ind || punti.residenziale;
  // lungolago: punto di strada a meno di 6 m dal livello del lago, il piu' vicino al centro
  let riva = null, dr = Infinity;
  let alto = null;
  for (const s of strade.lista) {
    if (s.g || s.b) continue;
    for (let i = 0; i < s.p.length; i += 9) {
      const y = s.p[i + 1];
      if (y < lago + 6) {
        const d = Math.hypot(s.p[i] - centro.x, s.p[i + 2] - centro.z);
        if (d < dr) { dr = d; riva = { x: s.p[i], z: s.p[i + 2] }; }
      }
      if (alto === null || y > alto.y) alto = { x: s.p[i], z: s.p[i + 2], y: y };
    }
  }
  punti.lungolago = riva || punti.storico;
  punti.montana = alto || punti.storico;
  return punti;
}

export function creaBenchmark(ctx) {
  const bench = {
    attivo: false, x: 0, z: 0, y: 0, tempoCarico: 0,
    ultimo: null, durata: 0, angolo: 0, dist: 14, alto: 5, copia: null, raccolta: null
  };

  const telecamera = ctx.telecamera;
  const puntoStrada = function (x, z) {
    ctx.mettiSullaStrada(ctx.moto, x, z);
    return { x: ctx.moto.x, y: ctx.moto.y, z: ctx.moto.z };
  };

  // Chiamato dal ciclo ad ogni fotogramma mentre il benchmark e' attivo
  bench.aggiorna = function (vero) {
    bench.durata += vero;
    // la telecamera gira intorno al punto: 1 giro ogni 40 secondi (stessa traiettoria ad ogni esecuzione)
    bench.angolo += vero * (Math.PI * 2 / 40);
    const x = bench.x + Math.sin(bench.angolo) * bench.dist;
    const z = bench.z + Math.cos(bench.angolo) * bench.dist;
    telecamera.position.set(x, bench.y + bench.alto, z);
    telecamera.up.set(0, 1, 0);
    telecamera.lookAt(bench.x, bench.y + 1.5, bench.z);
    if (bench.raccolta) {
      if (bench.durata > bench.raccolta.riscaldamento && bench.raccolta.tempi.length < bench.raccolta.max) {
        bench.raccolta.tempi.push(vero * 1000);
      }
    }
  };

  const prossimoFotogramma = function () {
    return new Promise(function (ok) { requestAnimationFrame(function () { ok(); }); });
  };

  async function misura(opz) {
    bench.durata = 0;
    bench.raccolta = { riscaldamento: opz.riscaldamento, tempi: [], max: opz.fotogrammi };
    // attesa: riscaldamento (alberi e terreno si creano a poco a poco) + fotogrammi misurati
    let guardia = 0;
    while ((bench.raccolta.tempi.length < opz.fotogrammi || bench.durata < opz.durata) && guardia < 100000) {
      await prossimoFotogramma();
      guardia++;
      if (bench.raccolta.tempi.length >= opz.fotogrammi && bench.durata >= opz.durata) break;
    }
    const tempi = bench.raccolta.tempi.slice();
    bench.raccolta = null;
    const info = ctx.disegnatore.info;
    const ordinati = tempi.slice().sort(function (a, b) { return a - b; });
    const media = tempi.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, tempi.length);
    const n1 = Math.max(1, Math.ceil(tempi.length * 0.01));
    const peggiori = ordinati.slice(ordinati.length - n1);
    const media1 = peggiori.reduce(function (a, b) { return a + b; }, 0) / peggiori.length;
    const mem = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
    return {
      fotogrammi: tempi.length,
      fps_medi: +(1000 / media).toFixed(2),
      fps_minimi: +(1000 / ordinati[ordinati.length - 1]).toFixed(2),
      fps_1pc_low: +(1000 / media1).toFixed(2),
      frame_ms_medio: +media.toFixed(2),
      frame_ms_mediana: +percentile(ordinati, 0.5).toFixed(2),
      frame_ms_p95: +percentile(ordinati, 0.95).toFixed(2),
      frame_ms_p99: +percentile(ordinati, 0.99).toFixed(2),
      frame_ms_max: +ordinati[ordinati.length - 1].toFixed(2),
      triangoli: info.render.triangles,
      chiamate: info.render.calls,
      geometrie: info.memory.geometries,
      texture: info.memory.textures,
      memoria_js_mb: mem === null ? null : +mem.toFixed(1),
      alberi_ms_per_cella: ctx.alberi && ctx.alberi.statistiche.celle > 0 ? +(ctx.alberi.statistiche.ms / ctx.alberi.statistiche.celle).toFixed(2) : null
    };
  }

  // opzioni: { fotogrammi, durata (s), riscaldamento (s), scenari: [id...] }
  bench.esegui = async function (opzioni) {
    const opz = Object.assign({ fotogrammi: 120, durata: 5, riscaldamento: 4, scenari: null }, opzioni || {});
    const punti = trovaPunti(ctx);
    const ambiente = ctx.ambiente;
    const salvato = { ora: ambiente.ora, meteo: ambiente.meteo, ciclo: ambiente.ciclo, x: ctx.moto.x, z: ctx.moto.z };
    ambiente.ciclo = false;
    bench.attivo = true;
    const risultati = [];
    const t0 = performance.now();
    for (const sc of SCENARI) {
      if (opz.scenari && !opz.scenari.includes(sc.id)) continue;
      const fasi = [{ cerca: sc.cerca, meteo: sc.meteo, etichetta: sc.nome }];
      if (sc.poi) fasi.push({ cerca: sc.poi.cerca, meteo: sc.poi.meteo, etichetta: sc.nome + " (seconda fase)" });
      for (const fase of fasi) {
        const p = punti[fase.cerca];
        const stp = puntoStrada(p.x, p.z);
        bench.x = stp.x; bench.y = stp.y; bench.z = stp.z;
        bench.dist = sc.dist; bench.alto = sc.alto; bench.angolo = 0;
        ambiente.ora = sc.ora;
        impostaMeteoSenzaSalvare(ambiente, fase.meteo);
        // il meteo e' gia' "a regime": pioggia/neve e superfici bagnate o innevate
        if (fase.meteo.startsWith("pioggia")) { ambiente.pioggia = 1; ambiente.uniformi.bagnato.value = 1; }
        if (fase.meteo.startsWith("neve")) { ambiente.neve = 1; ambiente.uniformi.neveDin.value = 1; ambiente.uniformi.quotaNeveDin.value = 100; }
        ctx.preparaVicino(stp.x, stp.z);
        ctx.riflessi(true);
        const r = await misura(opz);
        risultati.push(Object.assign({ scenario: sc.id, nome: fase.etichetta, x: Math.round(stp.x), z: Math.round(stp.z), quota_m: Math.round(stp.y), ora: sc.ora, meteo: fase.meteo }, r));
      }
    }
    bench.attivo = false;
    // ripristino
    ambiente.ora = salvato.ora;
    ambiente.ciclo = salvato.ciclo;
    impostaMeteoSenzaSalvare(ambiente, salvato.meteo);
    ambiente.pioggia = 0; ambiente.neve = 0; ambiente.uniformi.bagnato.value = 0; ambiente.uniformi.neveDin.value = 0;
    ctx.mettiSullaStrada(ctx.moto, salvato.x, salvato.z);
    const complessivo = {
      versione: ctx.versione,
      ambiente: descriviAmbiente(ctx.disegnatore, ctx.qualita()),
      opzioni: { fotogrammi: opz.fotogrammi, durata_s: opz.durata, riscaldamento_s: opz.riscaldamento },
      caricamento_s: +(bench.tempoCarico / 1000).toFixed(2),
      durata_totale_s: +((performance.now() - t0) / 1000).toFixed(1),
      risultati: risultati
    };
    try {
      localStorage.setItem("mrw-benchmark", JSON.stringify(complessivo));
    } catch (errore) {
      // memoria non disponibile
    }
    return complessivo;
  };
  return bench;
}

// Tabella in Markdown (da incollare in un report) e testo per la finestra dei risultati
export function inMarkdown(r) {
  const e = r.ambiente;
  const righe = [];
  righe.push("# Benchmark MRW Anteprima " + r.versione);
  righe.push("");
  righe.push("- Scheda video: " + e.scheda_video + (e.grafica_software ? "  **(grafica software!)**" : ""));
  righe.push("- Browser: " + e.browser);
  righe.push("- CPU core: " + e.cpu_core + ", finestra " + e.finestra + ", pixel ratio " + e.pixel_ratio + ", qualita': " + e.qualita);
  righe.push("- Caricamento: " + r.caricamento_s + " s, data " + e.data);
  if (e.nota) righe.push("- " + e.nota);
  righe.push("");
  righe.push("| Scenario | FPS medi | FPS min | 1% low | ms medio | ms p95 | ms p99 | Triangoli | Chiamate | Memoria JS MB |");
  righe.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const x of r.results || r.risultati) {
    righe.push("| " + x.nome + " | " + x.fps_medi + " | " + x.fps_minimi + " | " + x.fps_1pc_low + " | " + x.frame_ms_medio + " | " + x.frame_ms_p95 + " | " + x.frame_ms_p99 + " | " + x.triangoli + " | " + x.chiamate + " | " + (x.memoria_js_mb === null ? "n.d." : x.memoria_js_mb) + " |");
  }
  return righe.join("\n");
}
