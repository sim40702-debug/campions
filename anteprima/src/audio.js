// Suono del motore creato al momento (WebAudio): niente file audio.
// La nota segue i giri: un monocilindrico "scoppietta", un quattro cilindri "urla".
// Tasto M: suono si' / no.

let contesto = null;
let principale = null;
let rombo = null;
let filtro = null;
let volume = null;
let acceso = true;

try {
  acceso = localStorage.getItem("mrw-suono") !== "no";
} catch (errore) {
  // memoria non disponibile: suono acceso
}

function avvia() {
  if (contesto !== null) return;
  const Contesto = window.AudioContext || window.webkitAudioContext;
  if (!Contesto) return;
  contesto = new Contesto();
  principale = contesto.createOscillator();
  principale.type = "sawtooth";
  rombo = contesto.createOscillator();
  rombo.type = "square";
  filtro = contesto.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = 900;
  volume = contesto.createGain();
  volume.gain.value = 0;
  const mischia = contesto.createGain();
  mischia.gain.value = 0.35;
  principale.connect(filtro);
  rombo.connect(mischia);
  mischia.connect(filtro);
  filtro.connect(volume);
  volume.connect(contesto.destination);
  principale.start();
  rombo.start();
}

// Il browser permette il suono solo dopo un tasto premuto
window.addEventListener("keydown", function (evento) {
  if (evento.code === "KeyM") {
    acceso = !acceso;
    try {
      localStorage.setItem("mrw-suono", acceso ? "si" : "no");
    } catch (errore) {
      // non importa
    }
  }
  avvia();
  if (contesto && contesto.state === "suspended") contesto.resume();
});

export function aggiornaSuono(moto, inPausa) {
  if (contesto === null) return;
  const s = moto.scheda;
  // scoppi al secondo: un motore a 4 tempi scoppia ogni 2 giri per ogni cilindro
  const scoppi = (moto.giri / 60) * (s.cilindri / 2);
  const ora = contesto.currentTime;
  principale.frequency.setTargetAtTime(Math.max(20, scoppi), ora, 0.03);
  rombo.frequency.setTargetAtTime(Math.max(10, scoppi / 2), ora, 0.03);
  filtro.frequency.setTargetAtTime(500 + moto.gas * 1500 + s.cilindri * 200, ora, 0.05);
  const forte = acceso && !inPausa ? 0.05 + moto.gas * 0.09 : 0;
  volume.gain.setTargetAtTime(forte, ora, 0.05);
}
