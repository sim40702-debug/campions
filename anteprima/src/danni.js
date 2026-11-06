// Cadute: cosa succede al pilota.
// - piano (meno di 30 km/h): ti rialzi
// - forte (30-75 km/h): la vista si annebbia per un po' e si riprende piano piano
// - molto forte (oltre 75 km/h): sei morto, schermo nero e si riparte dalla strada

let velo = null;      // velo rosso/nero sopra il gioco
let scritta = null;   // messaggio al centro

function prepara() {
  if (velo !== null) return;
  velo = document.createElement("div");
  velo.style.cssText = "position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity 0.3s;" +
    "background:radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(120,0,0,0.85) 100%);z-index:5";
  document.body.appendChild(velo);
  scritta = document.createElement("div");
  scritta.style.cssText = "position:fixed;left:0;right:0;top:38%;text-align:center;color:#fff;font:600 30px sans-serif;" +
    "text-shadow:0 2px 6px #000;pointer-events:none;display:none;z-index:6";
  document.body.appendChild(scritta);
}

export function creaDanni() {
  prepara();
  return { annebbiamento: 0, morto: false, tempoMorte: 0 };
}

// Da chiamare a ogni fotogramma
export function aggiornaDanni(danni, moto, dt, canvas) {
  // Una caduta nuova?
  if (moto.nuovaCaduta) {
    moto.nuovaCaduta = false;
    const kmh = moto.velocitaUrto;
    if (kmh >= 75) {
      danni.morto = true;
      danni.tempoMorte = 4;
      moto.caduta = 4;   // resta a terra finche' lo schermo e' nero
      scritta.innerHTML = "SEI MORTO<br><span style='font-size:18px'>" + moto.motivoCaduta + " a " + Math.round(kmh) + " km/h</span>";
    } else if (kmh >= 30) {
      danni.annebbiamento = Math.min(1, danni.annebbiamento + (kmh - 20) / 55);
      scritta.innerHTML = moto.motivoCaduta + "<br><span style='font-size:18px'>" + Math.round(kmh) + " km/h - sei ferito, la vista e' annebbiata</span>";
    } else {
      scritta.innerHTML = moto.motivoCaduta;
    }
    scritta.style.display = "block";
  }
  if (moto.caduta <= 0 && !danni.morto) scritta.style.display = "none";

  // Morte: schermo nero, poi si riparte con la vista pulita
  if (danni.morto) {
    danni.tempoMorte -= dt;
    velo.style.background = "#000";
    velo.style.opacity = 0.92;
    if (danni.tempoMorte <= 0) {
      danni.morto = false;
      danni.annebbiamento = 0;
      scritta.style.display = "none";
      velo.style.background = "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(120,0,0,0.85) 100%)";
    }
  } else {
    // la vista torna normale in circa 20 secondi
    danni.annebbiamento = Math.max(0, danni.annebbiamento - dt * 0.05);
    velo.style.opacity = danni.annebbiamento * 0.8;
  }
  const sfocatura = danni.morto ? 0 : danni.annebbiamento * 6;
  canvas.style.filter = sfocatura > 0.1 ? "blur(" + sfocatura.toFixed(1) + "px)" : "";
}
