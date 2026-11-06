// Scritte sullo schermo (velocita', quota, coordinate) e minimappa.

const elVelocita = document.getElementById("velocita");
const elLocalita = document.getElementById("localita");
const elStrada = document.getElementById("strada");
const elQuota = document.getElementById("quota");
const elCoordinate = document.getElementById("coordinate");
const minimappa = document.getElementById("minimappa");
const pennello = minimappa.getContext("2d");

let sfondoMinimappa = null;
let scala = 1;
let mezzoLato = 1;

// Disegna una volta sola tutte le strade in un'immagine di sfondo
export function preparaMinimappa(strade, terreno, localita, trasporti) {
  mezzoLato = terreno.meta;
  scala = minimappa.width / (terreno.meta * 2);
  sfondoMinimappa = document.createElement("canvas");
  sfondoMinimappa.width = minimappa.width;
  sfondoMinimappa.height = minimappa.height;
  const p2 = sfondoMinimappa.getContext("2d");
  p2.strokeStyle = "#e8e8e8";
  p2.lineWidth = 1;
  for (const strada of strade.lista) {
    const p = strada.p;
    p2.beginPath();
    for (let i = 0; i < p.length; i += 3) {
      const x = (p[i] + mezzoLato) * scala;
      const y = (p[i + 2] + mezzoLato) * scala;
      if (i === 0) {
        p2.moveTo(x, y);
      } else {
        p2.lineTo(x, y);
      }
    }
    p2.stroke();
  }
  // Ferrovie (grigio scuro tratteggiato) e teleferiche (rosso tratteggiato)
  function linea(p, passo, colore) {
    p2.strokeStyle = colore;
    p2.lineWidth = 1.5;
    p2.setLineDash([3, 2]);
    p2.beginPath();
    for (let i = 0; i + 2 < p.length; i += passo) {
      const x = (p[i] + mezzoLato) * scala;
      const y = (p[i + 2] + mezzoLato) * scala;
      if (i === 0) p2.moveTo(x, y); else p2.lineTo(x, y);
    }
    p2.stroke();
    p2.setLineDash([]);
  }
  if (trasporti) {
    for (const f of trasporti.ferrovie) linea(f.p, 3, "#9aa0a8");
    for (const f of trasporti.funivie) linea(f.p, 4, "#ff5a5a");
  }

  // Nomi dei paesi (solo citta' e villaggi, non i quartieri)
  p2.font = "bold 10px Arial";
  p2.textAlign = "center";
  for (const l of localita || []) {
    if (l.t !== "town" && l.t !== "city" && l.t !== "village") continue;
    const x = (l.x + mezzoLato) * scala;
    const y = (l.z + mezzoLato) * scala;
    p2.lineWidth = 3;
    p2.strokeStyle = "rgba(20, 30, 40, 0.9)";
    p2.strokeText(l.n, x, y);
    p2.fillStyle = "#ffd75a";
    p2.fillText(l.n, x, y);
  }
}

export function aggiornaInterfaccia(moto, terreno, localita) {
  elLocalita.textContent = localita;
  elVelocita.innerHTML = Math.round(Math.abs(moto.velocita) * 3.6) + " <small>km/h</small>";
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

  // Minimappa
  pennello.clearRect(0, 0, minimappa.width, minimappa.height);
  if (sfondoMinimappa) {
    pennello.drawImage(sfondoMinimappa, 0, 0);
  }
  const x = (moto.x + mezzoLato) * scala;
  const y = (moto.z + mezzoLato) * scala;
  pennello.fillStyle = "#ff3030";
  pennello.beginPath();
  pennello.arc(x, y, 4, 0, Math.PI * 2);
  pennello.fill();
  pennello.strokeStyle = "#ff3030";
  pennello.lineWidth = 2;
  pennello.beginPath();
  pennello.moveTo(x, y);
  pennello.lineTo(x - Math.sin(moto.angolo) * 12, y - Math.cos(moto.angolo) * 12);
  pennello.stroke();
}

export function mostraStato(testo) {
  document.getElementById("stato").textContent = testo;
}

export function nascondiCaricamento() {
  document.getElementById("caricamento").style.display = "none";
}
