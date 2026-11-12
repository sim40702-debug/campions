// TICINO COMPLETO - regioni del cantone (parte del gioco).
//
// Il cantone e' diviso in regioni da 24 x 24 km: un "cuore" da 16 x 16 km e 4 km di margine per lato, che si
// sovrappone alle regioni vicine. Tutte usano le coordinate svizzere (LV95), quindi un punto e' lo stesso punto
// in ogni regione. Il gioco tiene in memoria UNA regione alla volta:
//  - all'avvio si sceglie la regione dove si trova la partenza (e si scarica, se non c'e' ancora);
//  - guidando, quando si esce dal cuore si prepara la regione vicina (scaricandola se serve) e, 2 km piu' in la',
//    si passa a quella: il gioco si ricarica nella regione nuova, nello stesso punto e nella stessa direzione.
//
// Se i dati del cantone non ci sono (cartella "cantone" mancante) il gioco funziona come prima, con una regione sola.

const CHIAVE_PASSAGGIO = "mrw-passaggio";
const CHIAVE_PARTENZA = "mrw-partenza";
const FUORI_DAL_CUORE_M = 2000;      // si cambia regione quando si e' usciti dal cuore di 2 km
const PREPARA_A_M = 2500;            // si prepara la regione vicina quando mancano 2.5 km al bordo del cuore

// Piazza Grande a Locarno: la partenza se non ne e' stata scelta un'altra
export const PARTENZA_EST = 2704700;
export const PARTENZA_NORD = 1114200;

const app = typeof window !== "undefined" ? window.regioniApp : null;
const ascoltatori = [];
if (app) {
  app.quandoAvanza(function (avanzamento) {
    for (const funzione of ascoltatori) funzione(avanzamento);
  });
}

// La regione il cui cuore contiene il punto (oppure null: fuori dal cantone)
export function regioneDelPunto(elenco, est, nord) {
  for (const r of elenco) {
    const c = r.cuore;
    if (est >= c[0] && est < c[1] && nord >= c[2] && nord < c[3]) return r;
  }
  return null;
}

// Se il punto e' fuori da tutti i cuori (per esempio in Italia, nel margine): la regione con l'area che lo contiene
function regioneConMargine(elenco, est, nord) {
  let migliore = null;
  let distanzaMigliore = Infinity;
  for (const r of elenco) {
    const a = r.area;
    if (est < a[0] || est > a[1] || nord < a[2] || nord > a[3]) continue;
    const d = Math.hypot(est - (a[0] + a[1]) / 2, nord - (a[2] + a[3]) / 2);
    if (d < distanzaMigliore) {
      distanzaMigliore = d;
      migliore = r;
    }
  }
  return migliore;
}

export function regioneConId(elenco, id) {
  for (const r of elenco) {
    if (r.id === id) return r;
  }
  return null;
}

function leggi(memoria, chiave) {
  try {
    const testo = memoria.getItem(chiave);
    return testo ? JSON.parse(testo) : null;
  } catch (errore) {
    return null;
  }
}

async function caricaElenco() {
  try {
    const risposta = await fetch("cantone/regioni.json");
    if (!risposta.ok) return null;
    const dati = await risposta.json();
    let stato = null;
    try {
      const r2 = await fetch("cantone/stato.json");
      if (r2.ok) stato = await r2.json();
    } catch (errore) {
      // senza stato si considerano tutte "da verificare"
    }
    for (const r of dati.regioni) {
      r.controllo = null;
      if (stato) {
        for (const c of stato.controlli) {
          if (c.id === r.id) r.controllo = c;
        }
      }
      // una regione si puo' usare solo se e' stata preparata davvero
      r.pronta = !!(r.controllo && !r.controllo.mancante);
    }
    return dati.regioni;
  } catch (errore) {
    return null;
  }
}

// Scarica una regione mostrando l'avanzamento con la funzione "dillo" (testo)
export async function scaricaRegione(regione, dillo) {
  function avanza(a) {
    if (a.id === regione.id && a.tipo !== "hd") dillo("Scarico la regione " + nomeRegione(regione) + ": " + a.percento + " % (" + a.megabyte + " di " + a.totale + " MB)");
  }
  ascoltatori.push(avanza);
  dillo("Scarico la regione " + nomeRegione(regione) + "...");
  const esito = await app.scarica(regione.id);
  ascoltatori.splice(ascoltatori.indexOf(avanza), 1);
  return esito;
}

// Nome leggibile: le zone che contiene ("Luganese, Mendrisiotto")
export function nomeRegione(regione) {
  return regione.zone && regione.zone.length ? regione.zone.join(" / ") : regione.id;
}

// Da chiamare PRIMA di caricare il terreno. Sceglie la regione giusta per la partenza, la scarica se serve
// e dice a Electron di usarla. Ritorna lo stato delle regioni, oppure null (gioco a regione singola).
export async function preparaRegioni(mostraStato) {
  if (!app) return null;
  const elenco = await caricaElenco();
  if (elenco === null) return null;
  let stato = await app.stato();

  // Dove si vuole partire: 1) passaggio da un'altra regione  2) partenza scelta sulla mappa  3) Piazza Grande
  const passaggio = leggi(sessionStorage, CHIAVE_PASSAGGIO);
  try {
    sessionStorage.removeItem(CHIAVE_PASSAGGIO);
  } catch (errore) {
    // non importa
  }
  const scelta = leggi(localStorage, CHIAVE_PARTENZA);
  let est = PARTENZA_EST, nord = PARTENZA_NORD;
  if (passaggio && typeof passaggio.est === "number") {
    est = passaggio.est;
    nord = passaggio.nord;
  } else if (scelta && typeof scelta.est === "number") {
    est = scelta.est;
    nord = scelta.nord;
  }

  let voluta = regioneDelPunto(elenco, est, nord) || regioneConMargine(elenco, est, nord);
  // passando da una regione all'altra si resta in quella nuova anche se si e' ancora nel suo margine
  if (passaggio && passaggio.verso && regioneConId(elenco, passaggio.verso)) voluta = regioneConId(elenco, passaggio.verso);
  let avviso = "";
  if (voluta && voluta.id !== stato.attuale) {
    if (stato.scaricate.indexOf(voluta.id) < 0) {
      if (!voluta.pronta) {
        avviso = "La regione " + nomeRegione(voluta) + " non e' ancora stata preparata.";
      } else {
        const esito = await scaricaRegione(voluta, function (testo) {
          document.getElementById("stato").textContent = testo;
        });
        if (!esito.ok) avviso = "Non riesco a scaricare la regione " + nomeRegione(voluta) + " (" + esito.errore + "). Serve internet.";
      }
    }
    if (avviso === "") {
      await app.imposta(voluta.id);
      stato = await app.stato();
    }
  }
  if (avviso !== "") {
    await mostraStato(avviso + " Resto nella regione di prima.");
    await new Promise(function (fatto) { setTimeout(fatto, 2500); });
  }

  const attuale = regioneConId(elenco, stato.attuale);
  return {
    elenco: elenco, attuale: attuale, scaricate: stato.scaricate, megabyte: stato.megabyte,
    inclusa: stato.inclusa, conFotoHD: stato.conFotoHD || [],
    // partenza richiesta in LV95 (il gioco la usa solo se cade dentro la regione caricata)
    partenza: { est: est, nord: nord, angolo: passaggio ? passaggio.angolo : null, velocita: passaggio ? passaggio.velocita : 0, daPassaggio: !!passaggio },
    attesa: 0, inScarico: null, falliti: {}, avviso: "", cambio: false
  };
}

// Foto di dettaglio (0,5 m) della regione in uso: pacchetto facoltativo che si scarica IN SECONDO PIANO, solo con i profili
// che le usano (Media, Alta, Ultra). Il gioco parte subito con la foto a 2 m; quando il pacchetto e' pronto si chiama
// "quandoPronte" (che le carica). Niente internet o pacchetto non ancora preparato: non cambia nulla.
let hdRichieste = {};
export function richiediFotoHD(regioni, quandoPronte) {
  if (!app || !app.scaricaHD || !regioni || !regioni.attuale) return;
  const id = regioni.attuale.id;
  if (id === regioni.inclusa || regioni.conFotoHD.indexOf(id) >= 0 || hdRichieste[id]) return;
  hdRichieste[id] = true;
  app.scaricaHD(id).then(function (ok) {
    if (ok) quandoPronte();
    else delete hdRichieste[id];      // si riprova alla prossima richiesta (per esempio cambiando profilo)
  }).catch(function () {
    delete hdRichieste[id];
  });
}

// Cambia regione: ricorda dove si e' (coordinate svizzere, direzione, velocita') e ricarica il gioco
export async function vaiNellaRegione(regioni, regione, est, nord, angolo, velocita) {
  if (regioni.cambio) return;
  regioni.cambio = true;
  try {
    sessionStorage.setItem(CHIAVE_PASSAGGIO, JSON.stringify({ est: est, nord: nord, angolo: angolo, velocita: velocita, verso: regione.id }));
  } catch (errore) {
    // senza memoria si riparte dalla partenza salvata
  }
  await app.imposta(regione.id);
  location.reload();
}

// Da chiamare a ogni fotogramma con la posizione della moto in LV95.
// Ritorna un testo da mostrare (scaricamento in corso...) oppure "".
export function aggiornaRegioni(regioni, est, nord, angolo, velocita, dt) {
  if (regioni === null || regioni.attuale === null || regioni.cambio) return regioni ? regioni.avviso : "";
  regioni.attesa -= dt;
  if (regioni.attesa > 0) return regioni.avviso;
  regioni.attesa = 0.5;

  const c = regioni.attuale.cuore;
  // quanto si e' fuori dal cuore (negativo = dentro, a quella distanza dal bordo)
  const fuori = Math.max(c[0] - est, est - c[1], c[2] - nord, nord - c[3]);
  if (fuori < -PREPARA_A_M) {
    regioni.avviso = "";
    return "";
  }
  // la regione verso cui si sta andando: quella del punto 3 km piu' avanti verso l'esterno
  let px = est, py = nord;
  if (est - c[1] === fuori) px = Math.max(est, c[1]) + 100;
  else if (c[0] - est === fuori) px = Math.min(est, c[0]) - 100;
  else if (nord - c[3] === fuori) py = Math.max(nord, c[3]) + 100;
  else py = Math.min(nord, c[2]) - 100;
  const vicina = fuori > 0 ? (regioneDelPunto(regioni.elenco, est, nord) || regioneDelPunto(regioni.elenco, px, py)) : regioneDelPunto(regioni.elenco, px, py);
  if (vicina === null || vicina.id === regioni.attuale.id || !vicina.pronta) {
    // oltre c'e' un altro cantone, l'Italia o una regione non ancora preparata: nessun passaggio
    regioni.avviso = fuori > 0 && vicina !== null && !vicina.pronta ? "La regione " + nomeRegione(vicina) + " non e' ancora pronta" : "";
    return regioni.avviso;
  }

  const pronta = regioni.scaricate.indexOf(vicina.id) >= 0;
  if (!pronta && regioni.inScarico === null && !regioni.falliti[vicina.id]) {
    // si scarica mentre si guida
    regioni.inScarico = vicina.id;
    scaricaRegione(vicina, function (testo) {
      regioni.avviso = testo;
    }).then(function (esito) {
      regioni.inScarico = null;
      if (esito.ok) {
        regioni.scaricate.push(vicina.id);
        regioni.avviso = "";
      } else {
        regioni.falliti[vicina.id] = true;
        regioni.avviso = "Regione " + nomeRegione(vicina) + " non scaricata (" + esito.errore + ")";
        // si riprova dopo un minuto
        setTimeout(function () { delete regioni.falliti[vicina.id]; }, 60000);
      }
    });
  }
  if (pronta && fuori > FUORI_DAL_CUORE_M) {
    regioni.avviso = "Entro nella regione " + nomeRegione(vicina) + "...";
    vaiNellaRegione(regioni, vicina, est, nord, angolo, velocita);
  }
  return regioni.avviso;
}
