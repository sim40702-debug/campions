// Uso del suolo (facoltativo): parchi, giardini, prati, cimiteri, campi sportivi per la mappa.
// Il file dati/uso_suolo.json lo crea tools/geo/passo7_esporta_anteprima.py; se manca, la mappa funziona lo stesso.

export async function caricaUsoSuolo() {
  try {
    const risposta = await fetch("dati/uso_suolo.json");
    if (!risposta.ok) return { aree: [] };
    return await risposta.json();
  } catch (errore) {
    return { aree: [] };
  }
}

// Codici dell'uso del suolo nella maschera (1 punto ogni 8 m)
export const USO = { NESSUNO: 0, PARCO: 1, PRATO: 2, SPORT: 3, CIMITERO: 4 };
const NOMI = { parco: USO.PARCO, prato: USO.PRATO, sport: USO.SPORT, cimitero: USO.CIMITERO };

// Disegna i poligoni in una piccola immagine (un punto ogni 8 m) e la legge come maschera:
// serve al terreno (prato curato nei parchi), agli alberi (parchi e cimiteri) e alle verifiche.
export function creaMascheraUso(uso, terreno) {
  if (!uso || !uso.aree || uso.aree.length === 0) return null;
  const passo = 8;
  const w = Math.ceil(terreno.metaX * 2 / passo);
  const h = Math.ceil(terreno.metaZ * 2 / passo);
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const c = tela.getContext("2d", { willReadFrequently: true });
  c.fillStyle = "#000";
  c.fillRect(0, 0, w, h);
  // i prati sotto, parchi e sport sopra
  for (const tipo of ["prato", "parco", "cimitero", "sport"]) {
    const codice = NOMI[tipo];
    c.fillStyle = "rgb(" + codice * 50 + ",0,0)";
    c.beginPath();
    let n = 0;
    for (const a of uso.aree) {
      if (a.t !== tipo) continue;
      for (const anello of [a.o].concat(a.f || [])) {
        for (let i = 0; i + 1 < anello.length; i += 2) {
          const x = (anello[i] + terreno.metaX) / passo, z = (anello[i + 1] + terreno.metaZ) / passo;
          if (i === 0) c.moveTo(x, z); else c.lineTo(x, z);
        }
        c.closePath();
      }
      n++;
    }
    if (n > 0) c.fill("evenodd");
  }
  const dati = c.getImageData(0, 0, w, h).data;
  const maschera = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) maschera[i] = Math.round(dati[i * 4] / 50);
  return { w: w, h: h, passo: passo, dati: maschera };
}

// Codice dell'uso del suolo nel punto (x, z)
export function usoQui(terreno, x, z) {
  const m = terreno.uso;
  if (!m) return 0;
  const c = Math.floor((x + terreno.metaX) / m.passo);
  const r = Math.floor((z + terreno.metaZ) / m.passo);
  if (c < 0 || r < 0 || c >= m.w || r >= m.h) return 0;
  const v = m.dati[r * m.w + c];
  return v > 4 ? 0 : v;
}
