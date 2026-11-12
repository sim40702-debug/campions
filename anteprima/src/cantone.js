// TICINO COMPLETO - mappa di tutto il cantone (tasto K, pulsante "Ticino").
//
// Mostra il Canton Ticino intero in coordinate svizzere (LV95): rilievo vero (swisstopo), confine, distretti,
// laghi, fiumi, strade principali e tutte le localita' (OpenStreetMap). Si puo':
//  - trascinare e ingrandire, cercare qualsiasi comune, paese o frazione;
//  - cliccare un punto: coordinate svizzere, quota, localita' e strada principale piu' vicine;
//  - "Parti da qui": il gioco passa alla regione di quel punto (la scarica se serve) e ci mette la moto.
// Le regioni sono disegnate come riquadri: quelle gia' scaricate, quelle da scaricare e quelle non ancora pronte.
// La mappa "normale" (tasto P) resta quella dettagliata della regione in cui si sta guidando.

import { regioneDelPunto, regioneConId, scaricaRegione, vaiNellaRegione, nomeRegione } from "./regioni.js";

const COLORI_STRADA = ["#e0803a", "#f2c84b", "#ffffff"];      // autostrada, principale, secondaria
const LARGHEZZE_STRADA = [3.2, 2.2, 1.3];
const ORDINE_LOCALITA = { city: 0, town: 1, village: 2, suburb: 3, hamlet: 4, quarter: 4, neighbourhood: 5 };

function senzaAccenti(testo) {
  return testo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Immagine del rilievo: colore secondo la quota e ombra da nord-ovest
function immagineRilievo(ril, valori) {
  const w = ril.colonne, h = ril.righe;
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const pen = tela.getContext("2d");
  const imm = pen.createImageData(w, h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const k = i * 4;
      const v = valori[i];
      if (v === 0) {
        imm.data[k + 3] = 0;   // nessun dato (regione non preparata o fuori dalla griglia)
        continue;
      }
      const quota = ril.quota_base + v * ril.scala_quota;
      const destra = valori[i + (c < w - 1 ? 1 : 0)] || v;
      const sinistra = valori[i - (c > 0 ? 1 : 0)] || v;
      const sotto = valori[i + (r < h - 1 ? w : 0)] || v;
      const sopra = valori[i - (r > 0 ? w : 0)] || v;
      const ombra = ((sinistra - destra) + (sopra - sotto)) * ril.scala_quota / (4 * ril.passo_m);
      const luce = Math.max(0.55, Math.min(1.3, 1 + ombra * 1.1));
      // dal verde del fondovalle al beige dei pascoli al grigio chiaro delle cime
      const t = Math.max(0, Math.min(1, (quota - 200) / 2600));
      let rr, gg, bb;
      if (t < 0.35) {
        const u = t / 0.35;
        rr = 172 + u * 40; gg = 200 + u * 4; bb = 150 + u * 10;
      } else if (t < 0.7) {
        const u = (t - 0.35) / 0.35;
        rr = 212 + u * 10; gg = 204 - u * 8; bb = 160 + u * 20;
      } else {
        const u = (t - 0.7) / 0.3;
        rr = 222 + u * 26; gg = 196 + u * 50; bb = 180 + u * 68;
      }
      imm.data[k] = Math.min(255, rr * luce);
      imm.data[k + 1] = Math.min(255, gg * luce);
      imm.data[k + 2] = Math.min(255, bb * luce);
      imm.data[k + 3] = 255;
    }
  }
  pen.putImageData(imm, 0, 0);
  return tela;
}

function dentroPoligono(c, x, y) {
  let si = false;
  for (let i = 0, j = c.length - 2; i < c.length; j = i, i += 2) {
    const xi = c[i], yi = c[i + 1], xj = c[j], yj = c[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) si = !si;
  }
  return si;
}

async function caricaDati() {
  const risposta = await fetch("cantone/cantone.json");
  if (!risposta.ok) return null;
  const dati = await risposta.json();
  dati.rilievo = null;
  try {
    const stato = await (await fetch("cantone/stato.json")).json();
    const bin = await fetch("cantone/rilievo.bin");
    if (bin.ok && stato.rilievo) {
      const valori = new Uint16Array(await bin.arrayBuffer());
      if (valori.length === stato.rilievo.colonne * stato.rilievo.righe) {
        dati.rilievo = { info: stato.rilievo, valori: valori, tela: immagineRilievo(stato.rilievo, valori) };
      }
    }
    dati.stato = stato;
  } catch (errore) {
    // senza rilievo la mappa resta piatta
  }
  // riquadro di ogni strada (per disegnare solo quelle visibili) e testo per la ricerca
  for (const s of dati.strade) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < s.p.length; i += 2) {
      x0 = Math.min(x0, s.p[i]); x1 = Math.max(x1, s.p[i]);
      y0 = Math.min(y0, s.p[i + 1]); y1 = Math.max(y1, s.p[i + 1]);
    }
    s.r = [x0, x1, y0, y1];
  }
  for (const l of dati.localita) {
    l.cerca = senzaAccenti(l.n);
    l.ordine = ORDINE_LOCALITA[l.t] === undefined ? 5 : ORDINE_LOCALITA[l.t];
  }
  dati.localita.sort(function (a, b) { return a.ordine - b.ordine || (b.a || 0) - (a.a || 0); });
  return dati;
}

export function preparaCantone(regioni, moto, terreno) {
  const finestra = document.getElementById("mappaCantone");
  const bottone = document.getElementById("pulsanteCantone");
  if (!finestra || !bottone) return;
  if (regioni === null) {
    bottone.style.display = "none";   // gioco a regione singola: niente mappa del cantone
    return;
  }
  const tela = document.getElementById("telaCantone");
  const pen = tela.getContext("2d");
  const campo = document.getElementById("cercaCantone");
  const risultati = document.getElementById("risultatiCantone");
  const info = document.getElementById("infoCantone");
  const parti = document.getElementById("partiCantone");
  const statoEl = document.getElementById("statoCantone");
  const coord = document.getElementById("coordCantone");
  const centro = terreno.info.centro_lv95;

  let dati = null;
  let aperta = false;
  let occupata = false;       // scaricamento / cambio di regione in corso
  let selezione = null;       // { est, nord, nome }
  const vista = { est: 2704000, nord: 1122000, scala: 0.008 };   // scala = pixel per metro

  function motoLv95() {
    return [centro[0] + moto.x, centro[1] - moto.z];
  }
  function aSchermo(est, nord) {
    return [(est - vista.est) * vista.scala + tela.width / 2, (vista.nord - nord) * vista.scala + tela.height / 2];
  }
  function aMappa(px, py) {
    return [vista.est + (px - tela.width / 2) / vista.scala, vista.nord - (py - tela.height / 2) / vista.scala];
  }

  function quotaQui(est, nord) {
    if (!dati || !dati.rilievo) return null;
    const r = dati.rilievo.info;
    const c = Math.round((est - r.est_min) / r.passo_m), riga = Math.round((r.nord_max - nord) / r.passo_m);
    if (c < 0 || riga < 0 || c >= r.colonne || riga >= r.righe) return null;
    const v = dati.rilievo.valori[riga * r.colonne + c];
    return v === 0 ? null : r.quota_base + v * r.scala_quota;
  }

  function zonaQui(est, nord) {
    for (const z of dati.zone) {
      if (dentroPoligono(z.contorno, est, nord)) return z.nome;
    }
    return "";
  }

  function localitaVicina(est, nord, massimo) {
    let migliore = null, dMigliore = massimo;
    for (const l of dati.localita) {
      const d = Math.hypot(l.e - est, l.o - nord);
      if (d < dMigliore) {
        dMigliore = d;
        migliore = l;
      }
    }
    return migliore;
  }

  function stradaVicina(est, nord, massimo) {
    let nome = "", dMigliore = massimo;
    for (const s of dati.strade) {
      if (!s.n || est < s.r[0] - massimo || est > s.r[1] + massimo || nord < s.r[2] - massimo || nord > s.r[3] + massimo) continue;
      for (let i = 0; i + 3 < s.p.length; i += 2) {
        const ax = s.p[i], ay = s.p[i + 1], bx = s.p[i + 2], by = s.p[i + 3];
        const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay) || 1;
        const t = Math.max(0, Math.min(1, ((est - ax) * (bx - ax) + (nord - ay) * (by - ay)) / l2));
        const d = Math.hypot(ax + (bx - ax) * t - est, ay + (by - ay) * t - nord);
        if (d < dMigliore) {
          dMigliore = d;
          nome = s.n;
        }
      }
    }
    return nome;
  }

  function percorso(p, chiudi) {
    pen.beginPath();
    for (let i = 0; i < p.length; i += 2) {
      const s = aSchermo(p[i], p[i + 1]);
      if (i === 0) pen.moveTo(s[0], s[1]); else pen.lineTo(s[0], s[1]);
    }
    if (chiudi) pen.closePath();
  }

  function disegna() {
    if (!aperta || !dati) return;
    const rapporto = window.devicePixelRatio || 1;
    const W = Math.round(window.innerWidth * rapporto), H = Math.round(window.innerHeight * rapporto);
    if (tela.width !== W || tela.height !== H) {
      tela.width = W;
      tela.height = H;
    }
    pen.fillStyle = "#c9d3da";
    pen.fillRect(0, 0, W, H);
    const k = rapporto;
    const a = aMappa(0, H), b = aMappa(W, 0);   // riquadro visibile [est0, nord0] - [est1, nord1]

    // rilievo
    if (dati.rilievo) {
      const r = dati.rilievo.info;
      const p0 = aSchermo(r.est_min - r.passo_m / 2, r.nord_max + r.passo_m / 2);
      pen.imageSmoothingEnabled = true;
      pen.drawImage(dati.rilievo.tela, p0[0], p0[1], r.colonne * r.passo_m * vista.scala, r.righe * r.passo_m * vista.scala);
    }
    // fuori dal cantone: velo chiaro (si vede che il gioco finisce al confine)
    pen.save();
    pen.beginPath();
    pen.rect(0, 0, W, H);
    for (let i = 0; i < dati.confine.length; i += 2) {
      const s = aSchermo(dati.confine[i], dati.confine[i + 1]);
      if (i === 0) pen.moveTo(s[0], s[1]); else pen.lineTo(s[0], s[1]);
    }
    pen.closePath();
    pen.fillStyle = "rgba(232, 236, 240, 0.72)";
    pen.fill("evenodd");
    pen.restore();

    // laghi e fiumi
    pen.fillStyle = "#8fc1e3";
    for (const l of dati.laghi) {
      percorso(l.p, true);
      pen.fill();
    }
    pen.strokeStyle = "#7db4dc";
    pen.lineWidth = Math.max(1, 1.4 * k);
    pen.lineJoin = "round";
    for (const f of dati.fiumi) {
      percorso(f, false);
      pen.stroke();
    }

    // distretti e confine
    pen.setLineDash([6 * k, 5 * k]);
    pen.strokeStyle = "rgba(90, 60, 120, 0.55)";
    pen.lineWidth = 1.2 * k;
    for (const z of dati.zone) {
      percorso(z.contorno, true);
      pen.stroke();
    }
    pen.setLineDash([]);
    pen.strokeStyle = "#7a2f8f";
    pen.lineWidth = 2.4 * k;
    percorso(dati.confine, true);
    pen.stroke();

    // strade principali (prima le secondarie, sopra le autostrade)
    for (let classe = 2; classe >= 0; classe--) {
      if (classe === 2 && vista.scala < 0.012) continue;   // da lontano le secondarie non si disegnano
      pen.strokeStyle = classe === 2 ? "#ffffff" : "#6b5a3a";
      pen.lineWidth = (LARGHEZZE_STRADA[classe] + (classe === 2 ? 0 : 1.4)) * k;
      for (let giro = 0; giro < 2; giro++) {
        if (giro === 1) {
          if (classe === 2) break;
          pen.strokeStyle = COLORI_STRADA[classe];
          pen.lineWidth = LARGHEZZE_STRADA[classe] * k;
        }
        pen.beginPath();
        for (const s of dati.strade) {
          if (s.c !== classe || s.r[1] < a[0] || s.r[0] > b[0] || s.r[3] < a[1] || s.r[2] > b[1]) continue;
          for (let i = 0; i < s.p.length; i += 2) {
            const q = aSchermo(s.p[i], s.p[i + 1]);
            if (i === 0) pen.moveTo(q[0], q[1]); else pen.lineTo(q[0], q[1]);
          }
        }
        pen.stroke();
      }
    }

    // regioni: riquadri del cuore
    pen.font = Math.round(11 * k) + "px system-ui, sans-serif";
    pen.textAlign = "left";
    for (const r of regioni.elenco) {
      const c = r.cuore;
      const p0 = aSchermo(c[0], c[3]), p1 = aSchermo(c[1], c[2]);
      const scaricata = regioni.scaricate.indexOf(r.id) >= 0;
      const attuale = regioni.attuale && regioni.attuale.id === r.id;
      if (!r.pronta) {
        pen.fillStyle = "rgba(200, 60, 60, 0.18)";
        pen.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
      } else if (!scaricata) {
        pen.fillStyle = "rgba(60, 70, 90, 0.10)";
        pen.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
      }
      pen.strokeStyle = attuale ? "#1668d6" : "rgba(40, 50, 70, 0.45)";
      pen.lineWidth = (attuale ? 2.6 : 1) * k;
      pen.strokeRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
      if (vista.scala > 0.006) {
        pen.fillStyle = !r.pronta ? "#a02828" : (attuale ? "#1668d6" : "rgba(40, 50, 70, 0.75)");
        pen.fillText(!r.pronta ? "non pronta" : (attuale ? "regione attuale" : (scaricata ? "scaricata" : "da scaricare")), p0[0] + 5 * k, p0[1] + 14 * k);
      }
    }

    // nomi dei distretti (da lontano) e delle localita' (sempre piu' piccole man mano che ci si avvicina)
    pen.textAlign = "center";
    if (vista.scala < 0.03) {
      pen.font = "600 " + Math.round(15 * k) + "px system-ui, sans-serif";
      pen.fillStyle = "rgba(90, 40, 110, 0.75)";
      for (const z of dati.zone) {
        const s = aSchermo(z.etichetta[0], z.etichetta[1]);
        pen.fillText(z.nome.toUpperCase(), s[0], s[1]);
      }
    }
    const massimoOrdine = vista.scala < 0.007 ? 1 : (vista.scala < 0.02 ? 2 : (vista.scala < 0.06 ? 3 : 5));
    const occupati = [];
    for (const l of dati.localita) {
      if (l.ordine > massimoOrdine) break;   // l'elenco e' ordinato per importanza
      if (l.e < a[0] || l.e > b[0] || l.o < a[1] || l.o > b[1]) continue;
      const s = aSchermo(l.e, l.o);
      const grande = l.ordine <= 1;
      const altezza = (grande ? 14 : 11.5) * k;
      pen.font = (grande ? "600 " : "") + Math.round(altezza) + "px system-ui, sans-serif";
      const meta = pen.measureText(l.n).width / 2 + 3 * k;
      let libero = true;
      for (const o of occupati) {
        if (Math.abs(o[0] - s[0]) < o[2] + meta && Math.abs(o[1] - s[1]) < altezza + 3 * k) {
          libero = false;
          break;
        }
      }
      if (!libero) continue;
      occupati.push([s[0], s[1], meta]);
      pen.fillStyle = "#30353b";
      pen.beginPath();
      pen.arc(s[0], s[1], (grande ? 3.2 : 2.2) * k, 0, Math.PI * 2);
      pen.fill();
      pen.lineWidth = 3 * k;
      pen.strokeStyle = "rgba(255, 255, 255, 0.9)";
      pen.strokeText(l.n, s[0], s[1] - 6 * k);
      pen.fillStyle = "#1f2933";
      pen.fillText(l.n, s[0], s[1] - 6 * k);
    }

    // dove sono (freccia blu) e punto scelto (segnaposto rosso)
    const m = motoLv95();
    const sm = aSchermo(m[0], m[1]);
    pen.save();
    pen.translate(sm[0], sm[1]);
    pen.rotate(-moto.angolo);
    pen.fillStyle = "#1668d6";
    pen.strokeStyle = "#ffffff";
    pen.lineWidth = 2 * k;
    pen.beginPath();
    pen.moveTo(0, -11 * k);
    pen.lineTo(7 * k, 8 * k);
    pen.lineTo(0, 4 * k);
    pen.lineTo(-7 * k, 8 * k);
    pen.closePath();
    pen.fill();
    pen.stroke();
    pen.restore();
    if (selezione) {
      const s = aSchermo(selezione.est, selezione.nord);
      pen.fillStyle = "#d63a2f";
      pen.strokeStyle = "#ffffff";
      pen.lineWidth = 2 * k;
      pen.beginPath();
      pen.arc(s[0], s[1] - 12 * k, 7 * k, Math.PI * 0.85, Math.PI * 0.15);
      pen.lineTo(s[0], s[1]);
      pen.closePath();
      pen.fill();
      pen.stroke();
    }
  }

  function testoPunto(est, nord) {
    const quota = quotaQui(est, nord);
    const dentro = dentroPoligono(dati.confine, est, nord);
    const vicina = localitaVicina(est, nord, 2500);
    const strada = stradaVicina(est, nord, 250);
    const regione = regioneDelPunto(regioni.elenco, est, nord);
    let testo = "";
    if (vicina) testo += "<b>" + vicina.n + "</b>" + (zonaQui(est, nord) ? " · " + zonaQui(est, nord) : "") + "<br>";
    else if (zonaQui(est, nord)) testo += "<b>" + zonaQui(est, nord) + "</b><br>";
    if (strada) testo += "Strada: " + strada + "<br>";
    testo += "LV95: " + Math.round(est).toLocaleString("de-CH") + " / " + Math.round(nord).toLocaleString("de-CH") + "<br>";
    if (quota !== null) testo += "Quota: " + Math.round(quota) + " m<br>";
    if (!dentro) testo += "<i>Fuori dal Canton Ticino.</i>";
    else if (!regione) testo += "<i>Nessuna regione per questo punto.</i>";
    else if (!regione.pronta) testo += "<i>Questa regione non e' ancora stata preparata.</i>";
    else if (regioni.scaricate.indexOf(regione.id) < 0) testo += "Regione da scaricare (circa " + Math.round((regione.controllo && regione.controllo.pacchetto_MB) || 100) + " MB).";
    return { testo: testo, partibile: dentro && regione !== null && regione.pronta, regione: regione };
  }

  function scegli(est, nord, nome) {
    selezione = { est: est, nord: nord, nome: nome || "" };
    const p = testoPunto(est, nord);
    info.innerHTML = p.testo;
    parti.disabled = !p.partibile || occupata;
    disegna();
  }

  function cerca() {
    const testo = senzaAccenti(campo.value.trim());
    risultati.innerHTML = "";
    if (testo.length < 2 || !dati) return;
    const trovati = [];
    for (const z of dati.zone) {
      if (senzaAccenti(z.nome).indexOf(testo) >= 0) trovati.push({ n: z.nome, t: "zona", e: z.etichetta[0], o: z.etichetta[1], zoom: 0.012 });
    }
    // prima quelle che cominciano con il testo, poi le altre (l'elenco e' gia' ordinato per importanza)
    for (let giro = 0; giro < 2 && trovati.length < 40; giro++) {
      for (const l of dati.localita) {
        const pos = l.cerca.indexOf(testo);
        if ((giro === 0 && pos === 0) || (giro === 1 && pos > 0)) trovati.push(l);
        if (trovati.length >= 40) break;
      }
    }
    const nomiTipo = { city: "città", town: "cittadina", village: "paese", suburb: "quartiere", hamlet: "frazione", quarter: "quartiere", neighbourhood: "nucleo", zona: "zona" };
    for (const l of trovati) {
      const riga = document.createElement("div");
      riga.className = "risultato";
      const zona = l.t === "zona" ? "" : zonaQui(l.e, l.o);
      riga.textContent = l.n + " — " + (nomiTipo[l.t] || l.t) + (zona ? ", " + zona : "");
      riga.addEventListener("click", function () {
        vista.est = l.e;
        vista.nord = l.o;
        vista.scala = Math.max(vista.scala, l.zoom || 0.05);
        scegli(l.e, l.o, l.n);
      });
      risultati.appendChild(riga);
    }
    if (trovati.length === 0) risultati.textContent = "Nessun luogo trovato nel cantone.";
  }

  async function partiDaQui() {
    if (!selezione || occupata) return;
    const p = testoPunto(selezione.est, selezione.nord);
    if (!p.partibile) return;
    occupata = true;
    parti.disabled = true;
    const regione = p.regione;
    if (regioni.scaricate.indexOf(regione.id) < 0) {
      const esito = await scaricaRegione(regione, function (testo) {
        statoEl.textContent = testo;
      });
      if (!esito.ok) {
        statoEl.textContent = "Non riesco a scaricare la regione: " + esito.errore + ". Serve internet.";
        occupata = false;
        parti.disabled = false;
        return;
      }
      regioni.scaricate.push(regione.id);
    }
    statoEl.textContent = "Carico la regione " + nomeRegione(regione) + "...";
    // la partenza viene ricordata (stesso posto della mappa normale)
    try {
      localStorage.setItem("mrw-partenza", JSON.stringify({ x: 0, z: 0, nome: selezione.nome, est: Math.round(selezione.est), nord: Math.round(selezione.nord) }));
    } catch (errore) {
      // non importa
    }
    regioni.cambio = false;
    await vaiNellaRegione(regioni, regione, selezione.est, selezione.nord, null, 0);
  }

  function aggiornaStato() {
    const pronte = regioni.elenco.filter(function (r) { return r.pronta; }).length;
    let testo = "Regioni pronte: " + pronte + " su " + regioni.elenco.length + " · scaricate: " + regioni.scaricate.length;
    if (dati && dati.stato) testo += " · cantone ricostruito: " + dati.stato.km2_ricostruiti + " km² su " + dati.km2;
    statoEl.textContent = testo;
  }

  async function apri() {
    aperta = true;
    finestra.style.display = "block";
    if (dati === null) {
      statoEl.textContent = "Carico la mappa del cantone...";
      dati = await caricaDati();
      if (dati === null) {
        statoEl.textContent = "Mancano i dati della mappa del cantone.";
        return;
      }
    }
    const m = motoLv95();
    vista.est = (dati.rettangolo[0] + dati.rettangolo[1]) / 2;
    vista.nord = (dati.rettangolo[2] + dati.rettangolo[3]) / 2;
    // tutto il cantone nello schermo
    const rapporto = window.devicePixelRatio || 1;
    const largoLibero = Math.max(300, window.innerWidth - 340) * rapporto;   // a sinistra c'e' il pannello
    vista.scala = Math.min(largoLibero / 76000, window.innerHeight * rapporto / 102000);
    vista.est -= (window.innerWidth * rapporto - largoLibero) / 2 / vista.scala;
    aggiornaStato();
    scegli(m[0], m[1], "");
    info.innerHTML = "<b>Sei qui.</b><br>" + info.innerHTML;
    campo.focus();
  }
  function chiudi() {
    aperta = false;
    finestra.style.display = "none";
  }

  // --- mouse: trascina, rotellina, clic ---
  let trascina = null;
  tela.addEventListener("pointerdown", function (e) {
    trascina = { x: e.clientX, y: e.clientY, est: vista.est, nord: vista.nord, mosso: false };
    tela.setPointerCapture(e.pointerId);
  });
  tela.addEventListener("pointermove", function (e) {
    const rapporto = window.devicePixelRatio || 1;
    if (trascina) {
      const dx = (e.clientX - trascina.x) * rapporto, dy = (e.clientY - trascina.y) * rapporto;
      if (Math.abs(dx) + Math.abs(dy) > 4) trascina.mosso = true;
      vista.est = trascina.est - dx / vista.scala;
      vista.nord = trascina.nord + dy / vista.scala;
      disegna();
    }
    if (dati) {
      const p = aMappa(e.clientX * rapporto, e.clientY * rapporto);
      const quota = quotaQui(p[0], p[1]);
      coord.textContent = "LV95: " + Math.round(p[0]).toLocaleString("de-CH") + " / " + Math.round(p[1]).toLocaleString("de-CH") + (quota !== null ? " · " + Math.round(quota) + " m" : "");
    }
  });
  tela.addEventListener("pointerup", function (e) {
    const rapporto = window.devicePixelRatio || 1;
    if (trascina && !trascina.mosso && dati) {
      const p = aMappa(e.clientX * rapporto, e.clientY * rapporto);
      const vicina = localitaVicina(p[0], p[1], 12 / vista.scala * rapporto);
      scegli(p[0], p[1], vicina ? vicina.n : "");
    }
    trascina = null;
  });
  tela.addEventListener("dblclick", function () {
    partiDaQui();
  });
  function zoom(fattore, px, py) {
    const prima = aMappa(px, py);
    vista.scala = Math.max(0.003, Math.min(0.6, vista.scala * fattore));
    const dopo = aMappa(px, py);
    vista.est += prima[0] - dopo[0];
    vista.nord += prima[1] - dopo[1];
    disegna();
  }
  tela.addEventListener("wheel", function (e) {
    e.preventDefault();
    const rapporto = window.devicePixelRatio || 1;
    zoom(e.deltaY > 0 ? 1 / 1.25 : 1.25, e.clientX * rapporto, e.clientY * rapporto);
  }, { passive: false });
  document.getElementById("zoomPiuCantone").addEventListener("click", function () { zoom(1.5, tela.width / 2, tela.height / 2); });
  document.getElementById("zoomMenoCantone").addEventListener("click", function () { zoom(1 / 1.5, tela.width / 2, tela.height / 2); });

  campo.addEventListener("input", cerca);
  parti.addEventListener("click", partiDaQui);
  document.getElementById("doveSonoCantone").addEventListener("click", function () {
    const m = motoLv95();
    vista.est = m[0];
    vista.nord = m[1];
    vista.scala = Math.max(vista.scala, 0.03);
    scegli(m[0], m[1], "");
  });
  document.getElementById("chiudiCantone").addEventListener("click", function (e) {
    e.currentTarget.blur();
    chiudi();
  });
  bottone.addEventListener("click", function (e) {
    e.currentTarget.blur();
    if (aperta) chiudi(); else apri();
  });
  window.addEventListener("keydown", function (e) {
    if (e.target && e.target.tagName === "INPUT" && e.code !== "Escape") return;
    if (e.code === "KeyK") {
      e.preventDefault();
      if (aperta) chiudi(); else apri();
    }
    if (e.code === "Escape" && aperta) chiudi();
  });
  window.addEventListener("resize", disegna);

  // per le prove automatiche
  window.__mrw = window.__mrw || {};
  window.__mrw.cantone = {
    apri: apri, chiudi: chiudi, scegli: scegli, parti: partiDaQui,
    dati: function () { return dati; }, vista: vista, disegna: disegna
  };
}
