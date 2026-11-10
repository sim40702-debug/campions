// Garage (tasto G o pulsante): scegli la moto. La scelta viene ricordata.

import { MOTO, ORDINE, accelerazioneMax } from "./moto_modelli.js";
import { cambiaMoto } from "./moto.js";

const CHIAVE = "mrw-moto";

export function motoSalvata() {
  try {
    const id = localStorage.getItem(CHIAVE);
    if (id && MOTO[id]) return id;
  } catch (errore) {
    // memoria non disponibile
  }
  return "sm690";
}

function salva(id) {
  try {
    localStorage.setItem(CHIAVE, id);
  } catch (errore) {
    // non importa
  }
}

// Barra da 0 a 10 per confrontare le moto
function barra(nome, valore) {
  const pieno = Math.max(1, Math.min(10, Math.round(valore)));
  return '<div class="barra"><span>' + nome + '</span><div><i style="width:' + pieno * 10 + '%"></i></div></div>';
}

export function preparaGarage(moto) {
  const finestra = document.getElementById("garage");
  const lista = document.getElementById("listaMoto");

  function disegna() {
    lista.innerHTML = "";
    for (const id of ORDINE) {
      const s = MOTO[id];
      const scheda = document.createElement("div");
      scheda.className = "schedaMoto" + (id === moto.id ? " scelta" : "");
      scheda.innerHTML =
        "<h3>" + s.nome + "</h3>" +
        "<p>" + s.categoria + " · " + s.motore + "</p>" +
        "<p>" + s.cv + " CV · " + s.kg + " kg · " + s.vmax + " km/h</p>" +
        barra("Accelerazione", accelerazioneMax(s) - 1) +
        barra("Velocità", s.vmax / 30) +
        barra("Agilità", (s.agilita - 1.2) * 8) +
        barra("Frenata", (s.frenata - 6) * 2) +
        barra("Fuoristrada", s.fuoristrada / 10);
      scheda.addEventListener("click", function () {
        cambiaMoto(moto, id);
        salva(id);
        disegna();
      });
      lista.appendChild(scheda);
    }
  }

  function apriChiudi() {
    finestra.style.display = finestra.style.display === "block" ? "none" : "block";
    if (finestra.style.display === "block") disegna();
  }

  document.getElementById("pulsanteGarage").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    apriChiudi();
  });
  document.getElementById("chiudiGarage").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    finestra.style.display = "none";
  });
  window.addEventListener("keydown", function (evento) {
    if (evento.target && evento.target.tagName === "INPUT") return;
    if (evento.code === "KeyG") apriChiudi();
  });
}
