// Scritte sullo schermo (velocita', quota, coordinate, ora). La minimappa e' in mappa.js.

import { testoOra, descrizioneMomento } from "./ambiente.js";

const elVelocita = document.getElementById("velocita");
const elLocalita = document.getElementById("localita");
const elStrada = document.getElementById("strada");
const elMarcia = document.getElementById("marcia");
const elGiri = document.getElementById("giriBarra");
const elNomeMoto = document.getElementById("nomeMoto");
const elQuota = document.getElementById("quota");
const elCoordinate = document.getElementById("coordinate");
const elOra = document.getElementById("oraGioco");
let ultimoAggiornamento = 0;

export function aggiornaInterfaccia(moto, terreno, localita, mappa, ambiente) {
  // le scritte (DOM) si aggiornano 10 volte al secondo: scrivere nel DOM ad ogni fotogramma costa e non serve
  const adesso = performance.now();
  if (adesso - ultimoAggiornamento < 100) {
    mappa.disegnaMini(moto);
    return;
  }
  ultimoAggiornamento = adesso;
  elLocalita.textContent = localita;
  elVelocita.innerHTML = Math.round(Math.abs(moto.velocita) * 3.6) + " <small>km/h</small>";
  // Marcia e contagiri (rosso vicino al limitatore)
  const s = moto.scheda;
  elMarcia.textContent = moto.velocita < -0.3 ? "R" : (s.marce.length === 1 ? "A" : moto.marcia);
  const quota = (moto.giri - s.minimo) / (s.limitatore - s.minimo);
  elGiri.style.width = Math.round(Math.min(1, Math.max(0, quota)) * 100) + "%";
  elGiri.style.background = quota > 0.85 ? "#ff4650" : "#5ee08a";
  let scrittaMoto = s.nome + " · " + Math.round(moto.giri / 100) * 100 + " giri/min";
  if (moto.mappaImpennate && s.forma === "supermotard") scrittaMoto += " · MAPPA IMPENNATE";
  elNomeMoto.textContent = scrittaMoto;
  if (moto.suStrada) {
    elStrada.textContent = moto.nomeStrada || "Strada senza nome";
  } else {
    elStrada.textContent = "Fuori strada";
  }
  elQuota.textContent = "Quota: " + Math.round(moto.y) + " m";

  // Coordinate svizzere LV95 (per confrontare con map.geo.admin.ch)
  const est = Math.round(terreno.info.centro_lv95[0] + moto.x);
  const nord = Math.round(terreno.info.centro_lv95[1] - moto.z);
  elCoordinate.textContent = "LV95: " + est + " / " + nord;

  // Minimappa e ora del giorno
  mappa.disegnaMini(moto);
  if (elOra) elOra.textContent = testoOra(ambiente.ora) + " · " + descrizioneMomento(ambiente);
}

// Schermata di caricamento: testo, barra (passi fatti) e secondi passati.
// Ritorna una promessa: con "await" si lascia al browser il tempo di disegnare il testo
// prima di cominciare un lavoro pesante.
const PASSI_CARICAMENTO = 15;   // 7 passi + 7 moto 3D + l'ultimo
let passiFatti = 0;
const inizioCaricamento = Date.now();
const orologioCaricamento = setInterval(function () {
  const secondi = Math.round((Date.now() - inizioCaricamento) / 1000);
  document.getElementById("tempoCarica").textContent = secondi + " s";
}, 500);

export function mostraStato(testo) {
  document.getElementById("stato").textContent = testo;
  passiFatti = passiFatti + 1;
  const percento = Math.min(100, Math.round((passiFatti / PASSI_CARICAMENTO) * 100));
  document.getElementById("riempimentoCarica").style.width = percento + "%";
  return new Promise(function (fatto) {
    requestAnimationFrame(function () {
      setTimeout(fatto, 0);
    });
  });
}

export function nascondiCaricamento() {
  clearInterval(orologioCaricamento);
  document.getElementById("caricamento").style.display = "none";
}
