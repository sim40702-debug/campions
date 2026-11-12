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
let voce450 = null;      // la voce a parte del monocilindrico 450
let faseColpetti = 0;    // a che punto e' il "mem-mem-mem" dei colpetti di gas in impennata
let ultimoSuono = 0;
let acceso = true;
let rumore = null;       // un secondo di rumore bianco: la base dei colpi
let gasAperto = false;
let stridio = null;      // volume del rumore delle gomme che strisciano (derapata)   // il gas era aperto quasi tutto?

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

  voce450 = creaVoce450(contesto, contesto.destination);

  rumore = contesto.createBuffer(1, contesto.sampleRate, contesto.sampleRate);
  const campioni = rumore.getChannelData(0);
  for (let i = 0; i < campioni.length; i++) campioni[i] = Math.random() * 2 - 1;

  // Gomme che strisciano: rumore continuo filtrato sugli acuti, di solito a volume zero
  const gomme = contesto.createBufferSource();
  gomme.buffer = rumore;
  gomme.loop = true;
  const filtroGomme = contesto.createBiquadFilter();
  filtroGomme.type = "bandpass";
  filtroGomme.frequency.value = 1400;
  filtroGomme.Q.value = 3;
  stridio = contesto.createGain();
  stridio.gain.value = 0;
  gomme.connect(filtroGomme);
  filtroGomme.connect(stridio);
  stridio.connect(contesto.destination);
  gomme.start();
}

// --- Voce del monocilindrico 450 (MRW SM 450) -------------------------------------------------------------
// Sempre creata al momento, senza file audio. E' stata accordata misurando una registrazione di un vero 450
// monocilindrico: tanti bassi (il colpo di ogni scoppio, 20-60 Hz), un corpo pieno fino a 400 Hz e poi gli
// acuti che calano in fretta. Ogni scoppio e' un colpo secco ("tac-tac-tac"), non una nota continua.
// Forza delle armoniche dello scoppio (la prima e' lo scoppio stesso), dalla misura a bande:
const ARMONICHE_450 = [0.72, 0.33, 0.31, 0.28, 0.28, 0.24, 0.24, 0.24, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06,
  0.035, 0.035, 0.035, 0.035, 0.035, 0.035, 0.035, 0.035, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028, 0.028,
  0.028, 0.028, 0.028, 0.028, 0.028, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015, 0.015];

function creaVoce450(ctx, uscita) {
  // onda dello scoppio: tutte le armoniche partono insieme (coseni), cosi' viene un colpo e non un ronzio
  const reale = new Float32Array(ARMONICHE_450.length + 1);
  const immaginaria = new Float32Array(ARMONICHE_450.length + 1);
  for (let k = 0; k < ARMONICHE_450.length; k++) {
    // un po' di sfasamento alle armoniche alte: il colpo resta secco ma meno "elettronico"
    const fase = k < 8 ? 0 : (k * 2.4) % 6.283;
    reale[k + 1] = ARMONICHE_450[k] * Math.cos(fase);
    immaginaria[k + 1] = ARMONICHE_450[k] * Math.sin(fase);
  }
  const scoppio = ctx.createOscillator();
  scoppio.setPeriodicWave(ctx.createPeriodicWave(reale, immaginaria));
  const forzaScoppio = ctx.createGain();
  forzaScoppio.gain.value = 0.5;

  // soffio dello scarico: rumore che "respira" a ogni scoppio (lo apre e lo chiude l'onda dello scoppio)
  const tampone = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const campioni = tampone.getChannelData(0);
  for (let i = 0; i < campioni.length; i++) campioni[i] = Math.random() * 2 - 1;
  const soffio = ctx.createBufferSource();
  soffio.buffer = tampone;
  soffio.loop = true;
  const filtroSoffio = ctx.createBiquadFilter();
  filtroSoffio.type = "bandpass";
  filtroSoffio.frequency.value = 240;
  filtroSoffio.Q.value = 0.6;
  const forzaSoffio = ctx.createGain();
  forzaSoffio.gain.value = 0;
  const respiro = ctx.createGain();   // quanto lo scoppio apre il soffio
  respiro.gain.value = 0.1;
  scoppio.connect(respiro);
  respiro.connect(forzaSoffio.gain);

  // il gas aperto "sporca" il suono (lo scarico satura) e apre gli acuti
  const satura = ctx.createWaveShaper();
  const curva = new Float32Array(1024);
  for (let i = 0; i < curva.length; i++) {
    const x = (i / (curva.length - 1)) * 2 - 1;
    curva[i] = Math.tanh(x * 2.2) / Math.tanh(2.2);
  }
  satura.curve = curva;
  const acuti = ctx.createBiquadFilter();
  acuti.type = "lowpass";
  acuti.frequency.value = 600;
  acuti.Q.value = 0.5;
  const bassi = ctx.createBiquadFilter();   // toglie quello che sta sotto i 22 Hz (non si sente, sporca solo)
  bassi.type = "highpass";
  bassi.frequency.value = 22;
  const forza = ctx.createGain();
  forza.gain.value = 0;

  // rumore meccanico (catena, valvole, aria): un fruscio leggero sugli acuti che cresce con il gas
  const filtroMeccanica = ctx.createBiquadFilter();
  filtroMeccanica.type = "highpass";
  filtroMeccanica.frequency.value = 1800;
  const meccanica = ctx.createGain();
  meccanica.gain.value = 0.03;
  soffio.connect(filtroMeccanica);
  filtroMeccanica.connect(meccanica);
  meccanica.connect(forza);

  scoppio.connect(forzaScoppio);
  forzaScoppio.connect(satura);
  soffio.connect(filtroSoffio);
  filtroSoffio.connect(forzaSoffio);
  forzaSoffio.connect(satura);
  satura.connect(acuti);
  acuti.connect(bassi);
  bassi.connect(forza);
  forza.connect(uscita);
  scoppio.start();
  soffio.start();

  return {
    // scoppi al secondo, gas da 0 a 1, volume, e in quanto tempo arrivarci (secondi)
    imposta: function (scoppiAlSecondo, gas, quantoForte, ora, tempo) {
      scoppio.frequency.setTargetAtTime(Math.max(12, scoppiAlSecondo), ora, tempo);
      respiro.gain.setTargetAtTime(0.08 + gas * 0.3, ora, tempo);
      forzaScoppio.gain.setTargetAtTime(0.45 + gas * 0.5, ora, tempo);
      acuti.frequency.setTargetAtTime(420 + gas * 2400 + scoppiAlSecondo * 6, ora, tempo);
      meccanica.gain.setTargetAtTime(0.025 + gas * 0.045, ora, tempo);
      forza.gain.setTargetAtTime(quantoForte, ora, tempo);
    }
  };
}

// Per le prove: due secondi del suono del 450 a giri e gas fissi, calcolati senza altoparlanti
export async function provaSuono450(giri, gas, secondi) {
  const ctx = new OfflineAudioContext(1, Math.round(44100 * secondi), 44100);
  const voce = creaVoce450(ctx, ctx.destination);
  voce.imposta(giri / 120, gas, 0.5, 0, 0.001);
  const reso = await ctx.startRendering();
  return Array.from(reso.getChannelData(0));
}

// Un colpo dallo scarico all'istante "quando" (secondi del contesto audio)
// Momenti (orologio dell'audio) in cui parte ogni scoppio: servono per accendere le fiammelle allo scarico
const momentiScoppi = [];

// true per un attimo (7 centesimi) a ogni scoppio dello scarico
export function scoppioInCorso() {
  if (!contesto) return false;
  const ora = contesto.currentTime;
  while (momentiScoppi.length > 0 && momentiScoppi[0] < ora - 0.07) momentiScoppi.shift();
  return momentiScoppi.length > 0 && momentiScoppi[0] <= ora;
}

function colpo(quando, forza) {
  momentiScoppi.push(quando);
  momentiScoppi.sort(function (a, b) { return a - b; });
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
  if (evento.target && evento.target.tagName === "INPUT") return;
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
  const ora = contesto.currentTime;
  const passato = Math.min(0.1, Math.max(0, ora - ultimoSuono));
  ultimoSuono = ora;

  // IMPENNATA con un monocilindrico: il pilota la tiene su a colpetti di gas e il motore fa "mem-mem-mem"
  // (i giri salgono e scendono circa 3 volte al secondo, e con loro il volume)
  let giri = moto.giri, gas = moto.gas;
  if (s.cilindri === 1 && moto.impennata > 0.12 && moto.gas > 0.3 && !moto.caduta) {
    faseColpetti += passato * 3.3;
    const colpetto = Math.pow(Math.max(0, Math.sin(faseColpetti * Math.PI * 2)), 0.6);   // sale di scatto, scende piu' piano
    const quanto = Math.min(1, (moto.impennata - 0.12) / 0.25);
    giri = giri * (1 + quanto * (colpetto * 0.3 - 0.14));
    gas = gas * (1 - quanto * 0.75) + quanto * 0.75 * colpetto;
  } else {
    faseColpetti = 0;
  }

  // scoppi al secondo: un motore a 4 tempi scoppia ogni 2 giri per ogni cilindro
  const scoppi = (giri / 60) * (s.cilindri / 2);
  const mono450 = s.suono === "mono450";
  principale.frequency.setTargetAtTime(Math.max(20, scoppi), ora, 0.03);
  rombo.frequency.setTargetAtTime(Math.max(10, scoppi / 2), ora, 0.03);
  filtro.frequency.setTargetAtTime(500 + gas * 1500 + s.cilindri * 200, ora, 0.05);
  const forte = acceso && !inPausa ? 0.05 + gas * 0.09 : 0;
  volume.gain.setTargetAtTime(mono450 ? 0 : forte, ora, 0.05);
  // il 450 ha la sua voce (colpi secchi e tanti bassi); le altre moto la tengono a zero
  voce450.imposta(scoppi, gas, mono450 && acceso && !inPausa ? 0.16 + gas * 0.2 : 0, ora, 0.03);

  // Gomme che strisciano in derapata
  const striscia = acceso && !inPausa && moto.suStrada && Math.abs(moto.velocita) > 3
    ? Math.min(1, Math.abs(moto.derapata || 0) * 2.5) * 0.25 : 0;
  stridio.gain.setTargetAtTime(striscia, ora, 0.05);

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
