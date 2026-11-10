// Partenza (tasto P o pulsante): scegli dove comparire con la moto.
// - clic su un paese della lista, oppure
// - clic in un punto qualsiasi della mappa: la moto parte dalla strada piu' vicina.
// La scelta viene ricordata: la prossima volta il gioco parte da li'.

import { immagineMinimappa } from "./interfaccia.js";

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

export function preparaPartenza(moto, localita, mettiSullaStrada) {
  const finestra = document.getElementById("partenza");
  const lista = document.getElementById("listaLuoghi");
  const mappa = document.getElementById("mappaPartenza");
  const pennello = mappa.getContext("2d");

  // Solo citta' e paesi, in ordine alfabetico
  const luoghi = (localita || []).filter(function (l) {
    return l.t === "city" || l.t === "town" || l.t === "village";
  }).sort(function (a, b) {
    return a.n.localeCompare(b.n);
  });

  function parti(x, z, nome) {
    mettiSullaStrada(moto, x, z);
    salva(x, z, nome);
    finestra.style.display = "none";
  }

  function disegnaMappa() {
    const minimappa = immagineMinimappa();
    if (!minimappa.canvas) return;
    // la mappa grande e' la minimappa ingrandita
    const ingrandimento = 520 / minimappa.canvas.width;
    mappa.width = 520;
    mappa.height = Math.round(minimappa.canvas.height * ingrandimento);
    pennello.fillStyle = "#1b2430";
    pennello.fillRect(0, 0, mappa.width, mappa.height);
    pennello.drawImage(minimappa.canvas, 0, 0, mappa.width, mappa.height);
    // dov'e' la moto adesso
    pennello.fillStyle = "#ff3030";
    pennello.beginPath();
    pennello.arc((moto.x + minimappa.mezzoX) * minimappa.scala * ingrandimento,
      (moto.z + minimappa.mezzoZ) * minimappa.scala * ingrandimento, 5, 0, Math.PI * 2);
    pennello.fill();
  }

  function disegnaLista() {
    lista.innerHTML = "";
    for (const luogo of luoghi) {
      const pulsante = document.createElement("button");
      pulsante.textContent = luogo.n;
      pulsante.addEventListener("click", function (evento) {
        evento.currentTarget.blur();
        parti(luogo.x, luogo.z, luogo.n);
      });
      lista.appendChild(pulsante);
    }
  }

  // Clic sulla mappa: da pixel a coordinate del gioco
  mappa.addEventListener("click", function (evento) {
    const minimappa = immagineMinimappa();
    const rettangolo = mappa.getBoundingClientRect();
    const px = (evento.clientX - rettangolo.left) * (mappa.width / rettangolo.width);
    const py = (evento.clientY - rettangolo.top) * (mappa.height / rettangolo.height);
    const ingrandimento = mappa.width / minimappa.canvas.width;
    const x = px / ingrandimento / minimappa.scala - minimappa.mezzoX;
    const z = py / ingrandimento / minimappa.scala - minimappa.mezzoZ;
    parti(x, z, "punto sulla mappa");
  });

  function apriChiudi() {
    finestra.style.display = finestra.style.display === "block" ? "none" : "block";
    if (finestra.style.display === "block") {
      disegnaMappa();
      disegnaLista();
    }
  }

  document.getElementById("pulsantePartenza").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    apriChiudi();
  });
  document.getElementById("chiudiPartenza").addEventListener("click", function (evento) {
    evento.currentTarget.blur();
    finestra.style.display = "none";
  });
  window.addEventListener("keydown", function (evento) {
    if (evento.code === "KeyP") apriChiudi();
  });
}
