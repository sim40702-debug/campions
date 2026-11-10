// Mappa grande (tasto P o N, pulsante "Mappa"): esplora tutto il mondo, cerca e parti da dove vuoi.
//  - trascina per spostare la mappa, rotellina per ingrandire (come le mappe online);
//  - cerca citta', paesi, strade e luoghi per nome;
//  - filtri: rilievo, quartieri, edifici, boschi, acque, strade, nomi, ferrovie, luoghi, punti di interesse;
//  - un clic mette un segnaposto (nome della strada, coordinate, quota); "Parti da qui" (o doppio clic) porta la moto li';
//  - la partenza scelta viene ricordata: la prossima volta il gioco parte da li'.
// Le immagini sono disegnate dai dati veri del mondo (vedi mappa.js), per questo restano nitide.

import { FILTRI_MAPPA } from "./mappa.js";
import { quotaTerreno } from "./terreno.js";

const CHIAVE = "mrw-partenza";

// Partenza salvata (coordinate del gioco x, z) oppure null
export function partenzaSalvata() {
  try {
    const testo = localStorage.getItem(CHIAVE);
    if (testo) return JSON.parse(testo);
  } catch (errore) {
    // memoria non disponibile
  }
  return null;
}

function salva(x, z, nome) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ x: x, z: z, nome: nome }));
  } catch (errore) {
    // non importa
  }
}

export function preparaPartenza(moto, mappa, mettiSullaStrada) {
  const finestra = document.getElementById("mappaGrande");
  const tela = document.getElementById("telaMappa");
  const pen = tela.getContext("2d");
  const campoRicerca = document.getElementById("cercaMappa");
  const elencoRisultati = document.getElementById("risultatiMappa");
  const elencoFiltri = document.getElementById("filtriMappa");
  const info = document.getElementById("infoMappa");
  const bottoneParti = document.getElementById("partiQui");
  const barra = document.getElementById("scalaMappa");
  const terreno = mappa.terreno;
  const metaX = mappa.metaX, metaZ = mappa.metaZ;

  const vista = { cx: 0, cz: 0, scala: 0.1 };
  let selezione = null;       // { x, z, nome }
  let sporca = true;
  let aperta = false;
  let dimensioni = { w: 0, h: 0, dpr: 1 };

  function scalaMinima() {
    return Math.min(dimensioni.w / (metaX * 2.1), dimensioni.h / (metaZ * 2.1));
  }
  function limita() {
    vista.scala = Math.max(scalaMinima() * 0.9, Math.min(5, vista.scala));
    vista.cx = Math.max(-metaX, Math.min(metaX, vista.cx));
    vista.cz = Math.max(-metaZ, Math.min(metaZ, vista.cz));
  }
  function adattaTela() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    if (dimensioni.w === w && dimensioni.h === h && dimensioni.dpr === dpr) return;
    dimensioni = { w: w, h: h, dpr: dpr };
    tela.width = Math.round(w * dpr);
    tela.height = Math.round(h * dpr);
    tela.style.width = w + "px";
    tela.style.height = h + "px";
    sporca = true;
  }
  const daSchermo = function (px, py) {
    return [(px - dimensioni.w / 2) / vista.scala + vista.cx, (py - dimensioni.h / 2) / vista.scala + vista.cz];
  };
  const aSchermo = function (x, z) {
    return [(x - vista.cx) * vista.scala + dimensioni.w / 2, (z - vista.cz) * vista.scala + dimensioni.h / 2];
  };

  function disegna() {
    adattaTela();
    pen.setTransform(dimensioni.dpr, 0, 0, dimensioni.dpr, 0, 0);
    mappa.palette = mappa.ambiente && mappa.ambiente.uniformi.notte.value > 0.5 ? "notte" : "giorno";
    // mentre si trascina o si ingrandisce, niente nomi delle strade (piu' veloce)
    mappa.disegnaVista(pen, vista.cx, vista.cz, vista.scala, dimensioni.w, dimensioni.h, { semplice: trascinando });
    // bordo del mondo
    const [bx0, bz0] = aSchermo(-metaX, -metaZ);
    const [bx1, bz1] = aSchermo(metaX, metaZ);
    pen.save();
    pen.fillStyle = "rgba(20,28,38,0.55)";
    pen.beginPath();
    pen.rect(0, 0, dimensioni.w, dimensioni.h);
    pen.rect(bx0, bz0, bx1 - bx0, bz1 - bz0);
    pen.fill("evenodd");
    pen.restore();
    disegnaMarcatori();
    disegnaScala();
  }

  function disegnaMarcatori() {
    // la moto
    const [mx, mz] = aSchermo(moto.x, moto.z);
    pen.save();
    pen.translate(mx, mz);
    pen.rotate(-moto.angolo);
    pen.fillStyle = "#2c7dff";
    pen.strokeStyle = "#fff";
    pen.lineWidth = 2.4;
    pen.lineJoin = "round";
    pen.beginPath();
    pen.moveTo(0, -13);
    pen.lineTo(9, 10);
    pen.lineTo(0, 5);
    pen.lineTo(-9, 10);
    pen.closePath();
    pen.stroke();
    pen.fill();
    pen.restore();
    // il segnaposto
    if (selezione) {
      const [sx, sz] = aSchermo(selezione.x, selezione.z);
      pen.save();
      pen.translate(sx, sz);
      pen.fillStyle = "#e8323c";
      pen.strokeStyle = "#fff";
      pen.lineWidth = 2.2;
      pen.beginPath();
      pen.moveTo(0, 0);
      pen.bezierCurveTo(-14, -16, -11, -34, 0, -34);
      pen.bezierCurveTo(11, -34, 14, -16, 0, 0);
      pen.closePath();
      pen.stroke();
      pen.fill();
      pen.fillStyle = "#fff";
      pen.beginPath();
      pen.arc(0, -23, 4.5, 0, Math.PI * 2);
      pen.fill();
      pen.restore();
    }
  }

  function disegnaScala() {
    // barra della scala: lunghezza "tonda" in metri
    const candidati = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let scelto = candidati[0];
    for (const m of candidati) if (m * vista.scala <= 150) scelto = m;
    const larghezza = scelto * vista.scala;
    barra.style.width = larghezza + "px";
    barra.textContent = scelto >= 1000 ? (scelto / 1000) + " km" : scelto + " m";
  }

  let trascinando = false;
  function ridisegna() {
    sporca = true;
  }
  function ciclo() {
    if (aperta && (sporca || (mappa.ambiente && mappa.ambiente.ciclo))) {
      sporca = false;
      disegna();
    } else if (aperta) {
      // la moto si muove: aggiorno solo se e' cambiata la posizione (disegno leggero)
      if (ultimaMoto[0] !== moto.x || ultimaMoto[1] !== moto.z || ultimaMoto[2] !== moto.angolo) {
        ultimaMoto = [moto.x, moto.z, moto.angolo];
        disegna();
      }
    }
    requestAnimationFrame(ciclo);
  }
  let ultimaMoto = [0, 0, 0];

  // --- Selezione, info e partenza ---
  function nomeLuogo(x, z) {
    let migliore = null, dMin = 1e12;
    for (const l of mappa.luoghi.lista) {
      const d = Math.hypot(l.x - x, l.z - z);
      if (d < dMin) { dMin = d; migliore = l; }
    }
    return migliore ? migliore.n : "";
  }
  function seleziona(x, z, nome) {
    selezione = { x: x, z: z, nome: nome || "" };
    const strada = mappa.stradaVicina(x, z, 40);
    const q = quotaTerreno(terreno, x, z);
    const est = Math.round(terreno.info.centro_lv95[0] + x);
    const nord = Math.round(terreno.info.centro_lv95[1] - z);
    const luogo = nomeLuogo(x, z);
    info.innerHTML = "";
    const titolo = document.createElement("strong");
    titolo.textContent = nome || (strada && strada.n) || luogo || "Punto sulla mappa";
    info.appendChild(titolo);
    const righe = [
      strada ? "Strada: " + (strada.n || "senza nome") : "Fuori strada: si parte dalla strada piu' vicina",
      luogo ? "Zona: " + luogo : "",
      "Quota: " + Math.round(q) + " m",
      "LV95: " + est + " / " + nord
    ];
    for (const r of righe) {
      if (!r) continue;
      const d = document.createElement("div");
      d.textContent = r;
      info.appendChild(d);
    }
    bottoneParti.disabled = false;
    ridisegna();
  }
  function parti() {
    if (!selezione) return;
    mettiSullaStrada(moto, selezione.x, selezione.z);
    salva(selezione.x, selezione.z, selezione.nome || "punto sulla mappa");
    chiudi();
  }

  // --- Ricerca ---
  const normalizza = function (t) {
    return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  };
  const ETICHETTE = { city: "Citta'", town: "Paese", village: "Paese", suburb: "Quartiere", hamlet: "Frazione", neighbourhood: "Quartiere", quarter: "Quartiere", strada: "Strada", stazione: "Stazione", parco: "Parco" };
  function cerca() {
    const q = normalizza(campoRicerca.value.trim());
    elencoRisultati.innerHTML = "";
    let trovati;
    if (q.length === 0) {
      // senza testo: i paesi principali
      trovati = mappa.ricerca.filter(function (r) { return r.tipo === "city" || r.tipo === "town" || r.tipo === "village"; })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    } else {
      trovati = mappa.ricerca.filter(function (r) { return normalizza(r.nome).includes(q); }).sort(function (a, b) {
        const pa = normalizza(a.nome).startsWith(q) ? 0 : 1, pb = normalizza(b.nome).startsWith(q) ? 0 : 1;
        const ga = a.genere === "luogo" ? 0 : 1, gb = b.genere === "luogo" ? 0 : 1;
        return (pa - pb) || (ga - gb) || a.nome.localeCompare(b.nome);
      });
    }
    for (const r of trovati.slice(0, 40)) {
      const b = document.createElement("button");
      const nome = document.createElement("span");
      nome.textContent = r.nome;
      const tipo = document.createElement("small");
      tipo.textContent = ETICHETTE[r.tipo] || "Luogo";
      b.appendChild(nome);
      b.appendChild(tipo);
      b.addEventListener("click", function (evento) {
        evento.currentTarget.blur();
        vista.cx = r.x;
        vista.cz = r.z;
        vista.scala = r.genere === "luogo" && (r.tipo === "city" || r.tipo === "town") ? 0.35 : 0.6;
        limita();
        seleziona(r.x, r.z, r.nome);
      });
      elencoRisultati.appendChild(b);
    }
    if (trovati.length === 0) {
      const v = document.createElement("div");
      v.className = "vuoto";
      v.textContent = "Nessun risultato";
      elencoRisultati.appendChild(v);
    }
  }
  campoRicerca.addEventListener("input", cerca);

  // --- Filtri ---
  for (const f of FILTRI_MAPPA) {
    const et = document.createElement("label");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.checked = mappa.filtri[f.chiave] !== false;
    c.addEventListener("change", function () {
      mappa.cambiaFiltro(f.chiave, c.checked);
      ridisegna();
    });
    et.appendChild(c);
    et.appendChild(document.createTextNode(" " + f.nome));
    elencoFiltri.appendChild(et);
  }

  // --- Mouse e tastiera sulla mappa ---
  let ultimoPunto = null;
  let spostato = 0;
  tela.addEventListener("pointerdown", function (evento) {
    tela.setPointerCapture(evento.pointerId);
    ultimoPunto = [evento.clientX, evento.clientY];
    spostato = 0;
    trascinando = true;
  });
  tela.addEventListener("pointermove", function (evento) {
    if (!trascinando || !ultimoPunto) return;
    const dx = evento.clientX - ultimoPunto[0], dy = evento.clientY - ultimoPunto[1];
    spostato += Math.abs(dx) + Math.abs(dy);
    ultimoPunto = [evento.clientX, evento.clientY];
    vista.cx -= dx / vista.scala;
    vista.cz -= dy / vista.scala;
    limita();
    ridisegna();
  });
  tela.addEventListener("pointerup", function (evento) {
    const eraTrascinamento = spostato > 5;
    trascinando = false;
    ultimoPunto = null;
    if (!eraTrascinamento) {
      const [x, z] = daSchermo(evento.clientX, evento.clientY);
      if (Math.abs(x) < metaX && Math.abs(z) < metaZ) seleziona(x, z, "");
    }
    ridisegna();
  });
  tela.addEventListener("dblclick", function (evento) {
    const [x, z] = daSchermo(evento.clientX, evento.clientY);
    if (Math.abs(x) < metaX && Math.abs(z) < metaZ) {
      seleziona(x, z, "");
      parti();
    }
  });
  tela.addEventListener("wheel", function (evento) {
    evento.preventDefault();
    // zoom verso il punto sotto il mouse
    const [x, z] = daSchermo(evento.clientX, evento.clientY);
    const fattore = Math.exp(-evento.deltaY * 0.0015);
    vista.scala *= fattore;
    vista.scala = Math.max(scalaMinima() * 0.9, Math.min(5, vista.scala));
    vista.cx = x - (evento.clientX - dimensioni.w / 2) / vista.scala;
    vista.cz = z - (evento.clientY - dimensioni.h / 2) / vista.scala;
    limita();
    ridisegna();
  }, { passive: false });

  function zoomCentro(f) {
    vista.scala *= f;
    limita();
    ridisegna();
  }
  document.getElementById("zoomPiu").addEventListener("click", function (e) { e.currentTarget.blur(); zoomCentro(1.6); });
  document.getElementById("zoomMeno").addEventListener("click", function (e) { e.currentTarget.blur(); zoomCentro(1 / 1.6); });
  document.getElementById("centraMoto").addEventListener("click", function (e) {
    e.currentTarget.blur();
    vista.cx = moto.x;
    vista.cz = moto.z;
    ridisegna();
  });
  bottoneParti.addEventListener("click", function (e) { e.currentTarget.blur(); parti(); });

  function apri() {
    aperta = true;
    finestra.style.display = "block";
    adattaTela();
    vista.cx = moto.x;
    vista.cz = moto.z;
    vista.scala = Math.max(scalaMinima(), 0.2);
    limita();
    selezione = null;
    info.textContent = "Clicca sulla mappa o cerca un luogo.";
    bottoneParti.disabled = true;
    campoRicerca.value = "";
    cerca();
    ridisegna();
    campoRicerca.focus();   // si puo' scrivere subito il nome del luogo
  }
  function chiudi() {
    aperta = false;
    finestra.style.display = "none";
  }
  function apriChiudi() {
    if (aperta) chiudi(); else apri();
  }
  document.getElementById("pulsantePartenza").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    apriChiudi();
  });
  document.getElementById("chiudiMappa").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    chiudi();
  });
  window.addEventListener("keydown", function (evento) {
    if (evento.target && evento.target.tagName === "INPUT" && evento.code !== "Escape") return;
    if (evento.code === "KeyP" || evento.code === "KeyN") {
      evento.preventDefault();   // altrimenti la lettera finirebbe nella casella di ricerca
      apriChiudi();
    }
    if (evento.code === "Escape" && aperta) chiudi();
  });
  window.addEventListener("resize", function () {
    if (aperta) ridisegna();
  });

  // Minimappa: clic = ruota/fissa il nord, rotellina e pulsanti = zoom
  const mini = document.getElementById("minimappa");
  mini.addEventListener("click", function () {
    mappa.ruotaMini();
    document.getElementById("miniRuota").classList.toggle("acceso", mappa.mini.ruota);
  });
  mini.addEventListener("wheel", function (evento) {
    evento.preventDefault();
    mappa.zoomMini(evento.deltaY > 0 ? -1 : 1);
  }, { passive: false });
  document.getElementById("miniPiu").addEventListener("click", function (e) { e.currentTarget.blur(); mappa.zoomMini(1); });
  document.getElementById("miniMeno").addEventListener("click", function (e) { e.currentTarget.blur(); mappa.zoomMini(-1); });
  document.getElementById("miniRuota").addEventListener("click", function (e) {
    e.currentTarget.blur();
    mappa.ruotaMini();
    e.currentTarget.classList.toggle("acceso", mappa.mini.ruota);
  });
  document.getElementById("miniRuota").classList.toggle("acceso", mappa.mini.ruota);
  document.getElementById("miniMappa").addEventListener("click", function (e) { e.currentTarget.blur(); apriChiudi(); });

  requestAnimationFrame(ciclo);
}
