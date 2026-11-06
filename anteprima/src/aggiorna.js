// Pulsante "Aggiorna": controlla se su GitHub c'e' una versione nuova e la installa.
// Funziona solo nell'app (Electron). Nel browser il pulsante viene nascosto.

const pulsante = document.getElementById("pulsanteAggiorna");
const pannello = document.getElementById("pannelloAggiorna");
const testo = document.getElementById("testoAggiorna");
const barra = document.getElementById("barraAggiorna");
const riempimento = document.getElementById("riempimentoAggiorna");
const installa = document.getElementById("installaAggiorna");

let infoAggiornamento = null;
let scaricando = false;

// Il clic sui pulsanti non deve "rubare" i tasti al gioco
function togliFocus(evento) {
  evento.currentTarget.blur();
}

async function controlla(mostraPannello) {
  testo.textContent = "Controllo su GitHub...";
  installa.style.display = "none";
  try {
    infoAggiornamento = await window.aggiornamenti.controlla();
    if (infoAggiornamento.disponibile) {
      testo.textContent = "Nuova versione " + infoAggiornamento.nuova + " disponibile (hai la " + infoAggiornamento.attuale + ").";
      installa.style.display = "inline-block";
      pulsante.textContent = "Aggiorna a " + infoAggiornamento.nuova;
      pulsante.classList.add("nuova");
    } else {
      testo.textContent = "Hai gia' l'ultima versione (" + infoAggiornamento.attuale + ").";
    }
  } catch (errore) {
    testo.textContent = "Non riesco a controllare: " + errore.message;
  }
  if (mostraPannello) pannello.style.display = "block";
}

if (window.aggiornamenti) {
  window.aggiornamenti.versione().then(function (versione) {
    testo.textContent = "Versione " + versione;
  });

  window.aggiornamenti.quandoAvanza(function (percento) {
    if (!scaricando) return;
    riempimento.style.width = percento + "%";
    testo.textContent = "Scarico la versione " + infoAggiornamento.nuova + "... " + percento + "%";
  });

  pulsante.addEventListener("click", function (evento) {
    togliFocus(evento);
    if (pannello.style.display === "block") {
      pannello.style.display = "none";
    } else {
      controlla(true);
    }
  });

  installa.addEventListener("click", async function (evento) {
    togliFocus(evento);
    installa.style.display = "none";
    barra.style.display = "block";
    testo.textContent = "Scarico...";
    scaricando = true;
    try {
      const risultato = await window.aggiornamenti.installa();
      scaricando = false;
      if (risultato === "riavvio") {
        testo.textContent = "Installato! Il gioco si riavvia...";
      } else if (risultato === "aperto") {
        testo.textContent = "Scaricato. Ho aperto il file: installalo come al solito.";
      } else {
        testo.textContent = "Nessun aggiornamento da installare.";
      }
    } catch (errore) {
      scaricando = false;
      testo.textContent = "Errore: " + errore.message;
      installa.style.display = "inline-block";
    }
  });

  // Controllo automatico all'avvio (senza aprire il pannello)
  controlla(false);
} else {
  document.getElementById("aggiorna").style.display = "none";
}
