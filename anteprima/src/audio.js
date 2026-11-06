// Suono del motore creato al momento (WebAudio): niente file audio.
// La nota segue i giri: un monocilindrico "scoppietta", un quattro cilindri "urla".
// Tasto M: suono si' / no.
// Scoppiettii: quando chiudi il gas di colpo a giri alti, lo scarico "spara" qualche colpo
// (benzina che brucia nello scarico). Lo fanno tutte le moto del garage.

let contesto = null;
let principale = null;
let rombo = null;
let filtro = null;
let volume = null;
let acceso = true;
let rumore = null;       // un secondo di rumore bianco: la base dei colpi
let gasAperto = false;   // il gas era aperto quasi tutto?

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

  rumore = contesto.createBuffer(1, contesto.sampleRate, contesto.sampleRate);
  const campioni = rumore.getChannelData(0);
  for (let i = 0; i < campioni.length; i++) campioni[i] = Math.random() * 2 - 1;
}

// Un colpo dallo scarico all'istante "quando" (secondi del contesto audio)
function colpo(quando, forza) {
  const sorgente = contesto.createBufferSource();
  sorgente.buffer = rumore;
  const filtroColpo = contesto.createBiquadFilter();
  filtroColpo.type = "bandpass";
  filtroColpo.frequency.value = 180 + Math.random() * 260;
  filtroColpo.Q.value = 1.2;
  const forte = contesto.createGain();
  forte.gain.setValueAtTime(0, quando);
  forte.gain.linearRampToValueAtTime(0.9 * forza, quando + 0.004);
  forte.gain.exponentialRampToValueAtTime(0.001, quando + 0.09);
  sorgente.connect(filtroColpo);
  filtroColpo.connect(forte);
  forte.connect(contesto.destination);
  sorgente.start(quando, Math.random() * 0.8, 0.12);
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

  // Gas chiuso di colpo a giri alti: da 3 a 7 colpi nel mezzo secondo dopo
  if (moto.gas > 0.85) gasAperto = true;
  const giriAlti = moto.giri > s.minimo + (s.limitatore - s.minimo) * 0.45;
  if (gasAperto && moto.gas < 0.5) {
    gasAperto = false;
    if (acceso && !inPausa && giriAlti) {
      const quanti = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < quanti; i++) {
        colpo(ora + 0.05 + Math.random() * 0.55, 0.4 + Math.random() * 0.6);
      }
    }
  }
}
