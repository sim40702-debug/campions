// Menu Impostazioni (tasto Esc o pulsante): qualita' grafica Bassa / Media / Alta / Ultra 4K.
// Ultra 4K: l'immagine viene disegnata a circa 3840 x 2160 punti (anche su uno schermo Full HD,
// poi rimpicciolita: bordi lisci e dettagli nitidi), ombre piu' fini, alberi e vista piu' lontani.
// La scelta viene ricordata per la volta dopo.

import { impostaAlberi } from "./alberi.js";
import { impostaDettaglioTerreno } from "./terreno.js";
import { impostaFotoHD } from "./terreno_hd.js";
import { impostaErba } from "./erba.js";
import { impostaEdifici } from "./edifici.js";
import { impostaLontano } from "./lontano.js";
import { impostaStrade } from "./strade.js";
import { ELENCO_METEO, impostaOra, impostaMeteo, impostaCiclo, impostaMeteoRealistico, testoOra, descrizioneMomento } from "./ambiente.js";

// pixel = rapporto di pixel; raggioAlberi/densitaAlberi = boschi; visibilita = fino a dove si vede (m);
// terreno = distanza del terreno dettagliato; ombre = risoluzione delle ombre; areaOmbre = quanti metri attorno
// alla moto hanno le ombre; dettagli = distanza (m) dei dettagli delle case (balconi, comignoli, impianti);
// vistaCitta' = distanza (m) degli edifici; nuvole/ombreCitta = nuvole e ombre degli edifici
export const QUALITA = {
  bassa: { lontano: false, nome: "Bassa", pixel: 0.75, raggioAlberi: 450, densitaAlberi: 0.45, visibilita: 3500, terreno: 0.7, ombre: 1024, areaOmbre: 26, dettagli: 150, vistaCitta: 3500, nuvole: false, ombreCitta: false, gocce: 2500, ombreAttive: false, terrenoPieno: 350, fotoHD: 0, raggioFoto2m: 3000, erba: 0, densitaErba: 0 },
  media: { lontano: true, nome: "Media", pixel: 1.0, raggioAlberi: 900, densitaAlberi: 1.0, visibilita: 7000, terreno: 1.2, ombre: 2048, areaOmbre: 40, dettagli: 320, vistaCitta: 6500, nuvole: true, ombreCitta: true, gocce: 5000, ombreAttive: true, terrenoPieno: 650, fotoHD: 170, raggioFoto2m: 4500, erba: 30, densitaErba: 0.7 },
  alta: { lontano: true, nome: "Alta", pixel: 1.5, raggioAlberi: 1300, densitaAlberi: 1.3, visibilita: 9000, terreno: 1.8, ombre: 4096, areaOmbre: 55, dettagli: 520, vistaCitta: 8500, nuvole: true, ombreCitta: true, gocce: 8000, ombreAttive: true, terrenoPieno: 900, fotoHD: 215, raggioFoto2m: 6000, erba: 40, densitaErba: 1 },
  ultra: { lontano: true, nome: "Ultra 4K", pixel: 0, raggioAlberi: 1600, densitaAlberi: 1.5, visibilita: 11000, terreno: 2.4, ombre: 4096, areaOmbre: 75, dettagli: 800, vistaCitta: 10500, nuvole: true, ombreCitta: true, gocce: 12000, ombreAttive: true, terrenoPieno: 1000, fotoHD: 240, raggioFoto2m: 8000, erba: 55, densitaErba: 1.3 }
};

const CHIAVE = "mrw-qualita";
const CHIAVE_PREF = "mrw-preferenze";

// Preferenze che si possono togliere anche con qualita' alta
const preferenze = { nuvole: true, ombreCitta: true };
try {
  Object.assign(preferenze, JSON.parse(localStorage.getItem(CHIAVE_PREF) || "{}"));
} catch (errore) {
  // memoria non disponibile
}
function salvaPreferenze() {
  try {
    localStorage.setItem(CHIAVE_PREF, JSON.stringify(preferenze));
  } catch (errore) {
    // non importa
  }
}

export function qualitaSalvata() {
  try {
    const valore = localStorage.getItem(CHIAVE);
    if (valore && QUALITA[valore]) return valore;
  } catch (errore) {
    // memoria del browser non disponibile: uso "media"
  }
  return "media";
}

function salvaQualita(chiave) {
  try {
    localStorage.setItem(CHIAVE, chiave);
  } catch (errore) {
    // non importa
  }
}

// Applica una qualita' a disegnatore, telecamera, nebbia e alberi
export function applicaQualita(chiave, mondo) {
  const q = QUALITA[chiave];
  let rapporto = Math.min(window.devicePixelRatio, q.pixel);
  if (q.pixel === 0) {
    // Ultra 4K: quanti punti servono per arrivare a 3840 x 2160 (al massimo il doppio dello schermo)
    rapporto = Math.min(2, Math.sqrt((3840 * 2160) / (window.innerWidth * window.innerHeight)));
    rapporto = Math.max(rapporto, window.devicePixelRatio);
  }
  mondo.rapportoBase = rapporto;
  // post-elaborazione (HDR + bagliore + colori): non in qualita' Bassa
  if (mondo.post) {
    mondo.post.attivo = chiave !== "bassa";
    mondo.post.bagliore = chiave === "media" ? 0.8 : 1;
  }
  mondo.disegnatore.setPixelRatio(rapporto * (mondo.scalaRisoluzione || 1));
  // ombre: spente del tutto in qualita' Bassa (costano molto sui computer piu' deboli)
  mondo.sole.castShadow = q.ombreAttive;
  // ombre: piu' fini con la qualita' alta
  if (mondo.sole && mondo.sole.shadow.mapSize.x !== q.ombre) {
    mondo.sole.shadow.mapSize.set(q.ombre, q.ombre);
    if (mondo.sole.shadow.map) {
      mondo.sole.shadow.map.dispose();
      mondo.sole.shadow.map = null;
    }
  }
  // area delle ombre attorno alla moto
  const a = q.areaOmbre;
  const cam = mondo.sole.shadow.camera;
  if (cam.right !== a) {
    cam.left = -a;
    cam.right = a;
    cam.top = a;
    cam.bottom = -a;
    cam.updateProjectionMatrix();
  }
  mondo.disegnatore.setSize(window.innerWidth, window.innerHeight);
  mondo.telecamera.far = q.visibilita + 2000;
  mondo.telecamera.updateProjectionMatrix();
  // la nebbia (colore e distanza) la gestisce l'ambiente: gli dico la visibilita' della qualita'
  mondo.ambiente.visibilita = q.visibilita;
  mondo.ambiente.qualitaNuvole = q.nuvole && preferenze.nuvole;
  if (mondo.precipitazioni) mondo.precipitazioni.imposta(q.gocce);
  impostaEdifici(mondo.edifici, q.vistaCitta, q.dettagli, q.ombreCitta && preferenze.ombreCitta, q.areaOmbre);
  // le strade si disegnano fino a poco piu' di meta' della visibilita' (oltre sono un filo e c'e' la foschia)
  if (mondo.strade) impostaStrade(mondo.strade, q.visibilita * 0.55);
  impostaAlberi(mondo.alberi, q.raggioAlberi, q.densitaAlberi);
  impostaDettaglioTerreno(mondo.terrenoMesh, q.terreno, q.terrenoPieno, q.visibilita, q.raggioFoto2m);
  impostaErba(mondo.erba, q.erba, q.densitaErba);
  // citta' e strade principali lontane (LOD): da dove finiscono i dettagli fino alla nebbia
  if (mondo.lontano) impostaLontano(mondo.lontano, q.lontano, q.visibilita, Math.max(1500, Math.min(q.visibilita * 0.55, 6000)));
  impostaFotoHD(q.fotoHD, mondo.disegnatore.capabilities.getMaxAnisotropy());
  if (q.fotoHD > 0 && mondo.richiediFotoHD) mondo.richiediFotoHD();   // pacchetto HD della regione, se manca
  salvaQualita(chiave);
}

export function preparaMenu(mondo, avviaTest, avviaBenchmark) {
  const menu = document.getElementById("menu");
  const pulsante = document.getElementById("pulsanteMenu");
  const scelte = document.getElementById("sceltaQualita");

  function aggiornaPulsanti() {
    const attuale = qualitaSalvata();
    for (const bottone of scelte.querySelectorAll("button")) {
      bottone.classList.toggle("scelto", bottone.dataset.qualita === attuale);
    }
  }

  for (const chiave of Object.keys(QUALITA)) {
    const bottone = document.createElement("button");
    bottone.textContent = QUALITA[chiave].nome;
    bottone.dataset.qualita = chiave;
    bottone.addEventListener("click", function (evento) {
      evento.currentTarget.blur();
      applicaQualita(chiave, mondo);
      aggiornaPulsanti();
    });
    scelte.appendChild(bottone);
  }

  // Ora del giorno, meteo, nuvole, ombre degli edifici
  const amb = mondo.ambiente;
  const cursore = document.getElementById("cursoreOra");
  const testoOraEl = document.getElementById("testoOra");
  const ciclo = document.getElementById("cicloGiorno");
  const meteo = document.getElementById("sceltaMeteo");
  function mostraOra() {
    testoOraEl.textContent = testoOra(amb.ora) + " (" + descrizioneMomento(amb) + ")";
    if (document.activeElement !== cursore) cursore.value = amb.ora;
  }
  cursore.addEventListener("input", function () {
    impostaOra(amb, parseFloat(cursore.value));
    mostraOra();
  });
  ciclo.checked = amb.ciclo;
  ciclo.addEventListener("change", function () {
    impostaCiclo(amb, ciclo.checked);
  });
  for (const m of ELENCO_METEO) {
    const b = document.createElement("button");
    b.textContent = m.nome;
    b.dataset.meteo = m.chiave;
    b.addEventListener("click", function (evento) {
      evento.currentTarget.blur();
      impostaMeteo(amb, m.chiave);
      aggiornaMeteo();
    });
    meteo.appendChild(b);
  }
  function aggiornaMeteo() {
    for (const b of meteo.querySelectorAll("button")) b.classList.toggle("scelto", b.dataset.meteo === amb.meteo);
  }
  const realistico = document.getElementById("meteoRealistico");
  realistico.checked = amb.realistico;
  realistico.addEventListener("change", function () {
    impostaMeteoRealistico(amb, realistico.checked);
  });
  const nuvole = document.getElementById("sceltaNuvole");
  nuvole.checked = preferenze.nuvole;
  nuvole.addEventListener("change", function () {
    preferenze.nuvole = nuvole.checked;
    salvaPreferenze();
    applicaQualita(qualitaSalvata(), mondo);
  });
  const ombreCitta = document.getElementById("sceltaOmbreCitta");
  ombreCitta.checked = preferenze.ombreCitta;
  ombreCitta.addEventListener("change", function () {
    preferenze.ombreCitta = ombreCitta.checked;
    salvaPreferenze();
    applicaQualita(qualitaSalvata(), mondo);
  });

  // Menu in alto: meteo e ora del giorno (sempre a portata di mano)
  const selMeteo = document.getElementById("menuMeteoAlto");
  const selOra = document.getElementById("menuOraAlto");
  for (const m of ELENCO_METEO) {
    const o = document.createElement("option");
    o.value = m.chiave;
    o.textContent = m.nome;
    selMeteo.appendChild(o);
  }
  const ORE = [["Alba", 6.5], ["Mattina", 9], ["Mezzogiorno", 12], ["Pomeriggio (14:00)", 14], ["Tramonto", 18.4], ["Notte", 22.5]];
  for (const [nome, ora] of ORE) {
    const o = document.createElement("option");
    o.value = String(ora);
    o.textContent = nome;
    selOra.appendChild(o);
  }
  const personale = document.createElement("option");
  personale.value = "x";
  personale.textContent = "Ora libera";
  selOra.appendChild(personale);
  selMeteo.addEventListener("change", function () {
    impostaMeteo(amb, selMeteo.value);
    selMeteo.blur();
    aggiornaMeteo();
  });
  selOra.addEventListener("change", function () {
    if (selOra.value !== "x") impostaOra(amb, parseFloat(selOra.value));
    selOra.blur();
    mostraOra();
  });
  function sincronizzaAlto() {
    if (document.activeElement !== selMeteo) selMeteo.value = amb.meteo;
    if (document.activeElement !== selOra) {
      const v = ORE.find(function (x) { return Math.abs(x[1] - amb.ora) < 0.06; });
      selOra.value = v ? String(v[1]) : "x";
    }
  }
  sincronizzaAlto();
  setInterval(sincronizzaAlto, 500);

  function apriChiudi() {
    menu.style.display = menu.style.display === "block" ? "none" : "block";
    aggiornaPulsanti();
    aggiornaMeteo();
    ciclo.checked = amb.ciclo;
    mostraOra();
  }
  setInterval(function () {
    if (menu.style.display === "block" && amb.ciclo) mostraOra();
  }, 500);
  pulsante.addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    apriChiudi();
  });
  // Lista dei comandi: non sta piu' fissa in alto sullo schermo, si apre da qui (o con H)
  const comandi = document.getElementById("comandi");
  function apriChiudiComandi() {
    const apri = comandi.style.display !== "block";
    comandi.style.display = apri ? "block" : "none";
    if (apri) menu.style.display = "none";
  }
  document.getElementById("apriComandi").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    apriChiudiComandi();
  });
  document.getElementById("chiudiComandi").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    comandi.style.display = "none";
  });
  window.addEventListener("keydown", function (evento) {
    if (evento.target && evento.target.tagName === "INPUT") return;
    if (evento.code === "KeyH") apriChiudiComandi();
  });
  window.addEventListener("keydown", function (evento) {
    if (evento.code !== "Escape") return;
    // Esc con la lista dei comandi aperta: la chiude e basta
    if (comandi.style.display === "block") { comandi.style.display = "none"; return; }
    if (document.getElementById("mappaGrande").style.display !== "block") apriChiudi();
  });
  document.getElementById("avviaBenchmark").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    menu.style.display = "none";
    avviaBenchmark();
  });
  document.getElementById("avviaTest").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    menu.style.display = "none";
    avviaTest();
  });
  document.getElementById("chiudiMenu").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    menu.style.display = "none";
  });
}
