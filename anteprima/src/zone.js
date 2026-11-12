// Zone del mondo (Locarnese, Valle Verzasca, ...): nomi delle grandi aree esplorabili.
// I contorni li scrive il passo 7 in dati/terreno.json ("zone"), in coordinate del gioco [x, z, x, z, ...].
// Servono a: scritta in alto quando si entra in una zona, nome della zona vicino alla localita',
// nomi grandi sulla minimappa e sulla mappa grande, ricerca ("Verzasca" porta alla valle).
// Con i dati vecchi (senza "zone") tutto il mondo e' una sola zona senza nome: non si vede niente di nuovo.

export function creaZone(terreno) {
  const lista = [];
  for (const z of (terreno.info.zone || [])) {
    const c = z.contorno;
    if (!c || c.length < 6) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < c.length; i += 2) {
      x0 = Math.min(x0, c[i]); x1 = Math.max(x1, c[i]);
      z0 = Math.min(z0, c[i + 1]); z1 = Math.max(z1, c[i + 1]);
    }
    const etichetta = z.etichetta || [(x0 + x1) / 2, (z0 + z1) / 2];
    lista.push({ nome: z.nome, contorno: c, x0: x0, x1: x1, z0: z0, z1: z1, x: etichetta[0], z: etichetta[1], verticale: !!z.verticale });
  }
  return { lista: lista, attuale: null, attesa: 0 };
}

function dentro(c, x, z) {
  // punto nel poligono (regola pari/dispari)
  let si = false;
  for (let i = 0, j = c.length - 2; i < c.length; j = i, i += 2) {
    const xi = c[i], zi = c[i + 1], xj = c[j], zj = c[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) si = !si;
  }
  return si;
}

// La zona nel punto (x, z), oppure null. Se due zone si sovrappongono vale la prima dell'elenco.
export function zonaQui(zone, x, z) {
  for (const zona of zone.lista) {
    if (x < zona.x0 || x > zona.x1 || z < zona.z0 || z > zona.z1) continue;
    if (dentro(zona.contorno, x, z)) return zona;
  }
  return null;
}

// Da chiamare a ogni fotogramma: controlla 4 volte al secondo se la moto e' passata in un'altra zona
// e in quel caso mostra il nome in alto per qualche secondo ("Valle Verzasca").
const elAvviso = typeof document !== "undefined" ? document.getElementById("avvisoZona") : null;
let timerAvviso = null;
export function aggiornaZona(zone, x, z, dt) {
  zone.attesa -= dt;
  if (zone.attesa > 0) return zone.attuale;
  zone.attesa = 0.25;
  const zona = zonaQui(zone, x, z);
  if (zona !== zone.attuale) {
    const primaVolta = zone.attuale === null && zone.vista !== true;
    zone.attuale = zona;
    zone.vista = true;
    if (zona && elAvviso) {
      elAvviso.textContent = zona.nome;
      elAvviso.classList.remove("visibile");
      // la prima volta (partenza) la scritta resta un po' meno
      void elAvviso.offsetWidth;
      elAvviso.classList.add("visibile");
      clearTimeout(timerAvviso);
      timerAvviso = setTimeout(function () { elAvviso.classList.remove("visibile"); }, primaVolta ? 2500 : 4000);
    }
  }
  return zone.attuale;
}
