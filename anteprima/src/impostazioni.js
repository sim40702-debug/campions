// Menu Impostazioni (tasto Esc o pulsante): qualita' grafica Bassa / Media / Alta.
// La scelta viene ricordata per la volta dopo.

import { impostaAlberi } from "./alberi.js";
import { impostaDettaglioTerreno } from "./terreno.js";

export const QUALITA = {
  bassa: { nome: "Bassa", pixel: 0.75, raggioAlberi: 450, densitaAlberi: 0.45, visibilita: 3500, terreno: 0.7 },
  media: { nome: "Media", pixel: 1.0, raggioAlberi: 900, densitaAlberi: 1.0, visibilita: 7000, terreno: 1.2 },
  alta: { nome: "Alta", pixel: 1.5, raggioAlberi: 1300, densitaAlberi: 1.3, visibilita: 9000, terreno: 1.8 }
};

const CHIAVE = "mrw-qualita";

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
  mondo.disegnatore.setPixelRatio(Math.min(window.devicePixelRatio, q.pixel));
  mondo.disegnatore.setSize(window.innerWidth, window.innerHeight);
  mondo.telecamera.far = q.visibilita + 2000;
  mondo.telecamera.updateProjectionMatrix();
  mondo.scena.fog.near = q.visibilita * 0.2;
  mondo.scena.fog.far = q.visibilita;
  impostaAlberi(mondo.alberi, q.raggioAlberi, q.densitaAlberi);
  impostaDettaglioTerreno(mondo.terrenoMesh, q.terreno);
  salvaQualita(chiave);
}

export function preparaMenu(mondo, avviaTest) {
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

  function apriChiudi() {
    menu.style.display = menu.style.display === "block" ? "none" : "block";
    aggiornaPulsanti();
  }
  pulsante.addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    apriChiudi();
  });
  window.addEventListener("keydown", function (evento) {
    if (evento.code === "Escape") apriChiudi();
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
