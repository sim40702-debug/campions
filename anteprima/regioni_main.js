// TICINO COMPLETO - regioni del cantone (parte di Electron).
//
// Il cantone e' diviso in regioni da 24 x 24 km. Dentro l'app c'e' una sola regione (quella di Locarno, nella
// cartella "dati"); le altre si scaricano da GitHub la prima volta che servono e restano nella cartella
// dell'utente (userData/regioni/R_xxxx_yyyy). Il gioco chiede sempre i file "dati/...": qui si decide da quale
// regione prenderli.
//
// Lo scaricamento e' sicuro come l'aggiornamento: il pacchetto si apre in una cartella ".parziale" e solo
// quando e' completo e controllato prende il nome vero. Una regione scaricata a meta' non viene mai usata.

const { app, net } = require("electron");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// (MRW_URL_PACCHETTI serve solo per le prove: i pacchetti presi da un altro indirizzo)
const URL_PACCHETTI = process.env.MRW_URL_PACCHETTI || "https://github.com/sim40702-debug/swissgass/releases/download/ticino-completo-dati/";

let attuale = null;          // id della regione in uso
const inCorso = {};          // id -> promessa dello scaricamento in corso

function cartellaRegioni() {
  return path.join(app.getPath("userData"), "regioni");
}

function fileAttuale() {
  return path.join(app.getPath("userData"), "regione_attuale.json");
}

// La regione che sta dentro l'app (cartella "dati")
function regioneInclusa() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "dati", "regione.json"), "utf-8")).id || null;
  } catch (errore) {
    return null;   // dati vecchi (senza regioni) o mancanti
  }
}

function completa(cartella) {
  return fs.existsSync(path.join(cartella, "terreno.json")) && fs.existsSync(path.join(cartella, "terreno.bin")) &&
    fs.existsSync(path.join(cartella, "strade.json"));
}

// Cartella dei dati di una regione, oppure null se non c'e'
function cartellaDi(id) {
  if (id) {
    const scaricata = path.join(cartellaRegioni(), id);
    if (completa(scaricata)) return scaricata;
  }
  if (id === null || id === regioneInclusa()) {
    const inclusa = path.join(__dirname, "dati");
    if (completa(inclusa)) return inclusa;
  }
  return null;
}

function regioneAttuale() {
  if (attuale === null) {
    try {
      attuale = JSON.parse(fs.readFileSync(fileAttuale(), "utf-8")).id;
    } catch (errore) {
      attuale = regioneInclusa();
    }
    if (cartellaDi(attuale) === null) attuale = regioneInclusa();
  }
  return attuale;
}

// Cartella da cui servire i file "dati/..." adesso
function cartellaDatiAttuale() {
  return cartellaDi(regioneAttuale()) || path.join(__dirname, "dati");
}

function scaricate() {
  const elenco = [];
  const inclusa = regioneInclusa();
  if (inclusa) elenco.push(inclusa);
  try {
    for (const nome of fs.readdirSync(cartellaRegioni())) {
      if (nome.endsWith(".parziale")) continue;
      if (completa(path.join(cartellaRegioni(), nome)) && elenco.indexOf(nome) < 0) elenco.push(nome);
    }
  } catch (errore) {
    // nessuna regione scaricata
  }
  return elenco;
}

function stato() {
  const elenco = scaricate();
  return { attuale: regioneAttuale(), inclusa: regioneInclusa(), scaricate: elenco, conFotoHD: elenco.filter(haFotoHD) };
}

function imposta(id) {
  if (cartellaDi(id) === null) return false;
  attuale = id;
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(fileAttuale(), JSON.stringify({ id: id }));
  } catch (errore) {
    // se non si riesce a ricordarla pazienza: vale per questa sessione
  }
  return true;
}

// --- Apertura di un pacchetto .tar (gia' senza gzip) --------------------------------------------------
// Un file tar e' fatto di blocchi da 512 byte: un'intestazione (nome, grandezza) e poi il contenuto.
function nomeSicuro(nome) {
  if (nome.indexOf("..") >= 0 || nome.startsWith("/") || nome.indexOf(":") >= 0 || nome.indexOf("\\") >= 0) return null;
  return nome;
}

function creaApritore(cartella) {
  let resto = Buffer.alloc(0);
  let file = null;         // descrittore del file che si sta scrivendo
  let mancano = 0;         // byte del contenuto ancora da leggere
  let scarto = 0;          // byte di riempimento da saltare dopo il contenuto
  let scritti = 0;

  function testo(blocco, da, lunghezza) {
    let fine = da;
    while (fine < da + lunghezza && blocco[fine] !== 0) fine++;
    return blocco.toString("utf-8", da, fine);
  }

  return {
    aggiungi: function (pezzo) {
      resto = resto.length ? Buffer.concat([resto, pezzo]) : pezzo;
      let p = 0;
      while (true) {
        if (mancano > 0) {
          const n = Math.min(mancano, resto.length - p);
          if (n <= 0) break;
          if (file !== null) fs.writeSync(file, resto, p, n);
          p += n;
          mancano -= n;
          if (mancano === 0 && file !== null) {
            fs.closeSync(file);
            file = null;
            scritti++;
          }
          continue;
        }
        if (scarto > 0) {
          const n = Math.min(scarto, resto.length - p);
          if (n <= 0) break;
          p += n;
          scarto -= n;
          continue;
        }
        if (resto.length - p < 512) break;
        const blocco = resto.subarray(p, p + 512);
        p += 512;
        const nomeCorto = testo(blocco, 0, 100);
        if (nomeCorto === "") continue;   // blocchi vuoti alla fine del pacchetto
        const prefisso = testo(blocco, 345, 155);
        const nome = nomeSicuro(prefisso ? prefisso + "/" + nomeCorto : nomeCorto);
        const grandezza = parseInt(testo(blocco, 124, 12).trim(), 8) || 0;
        const tipo = String.fromCharCode(blocco[156] || 48);
        mancano = grandezza;
        scarto = (512 - (grandezza % 512)) % 512;
        if (tipo === "0" && nome !== null) {
          const destinazione = path.join(cartella, nome);
          fs.mkdirSync(path.dirname(destinazione), { recursive: true });
          file = fs.openSync(destinazione, "w");
          if (grandezza === 0) {
            fs.closeSync(file);
            file = null;
          }
        }
        // cartelle e intestazioni speciali: il contenuto (se c'e') viene saltato
      }
      resto = p < resto.length ? resto.subarray(p) : Buffer.alloc(0);
    },
    chiudi: function () {
      if (file !== null) {
        fs.closeSync(file);
        file = null;
        throw new Error("Pacchetto incompleto");
      }
      return scritti;
    }
  };
}

function cancella(cartella) {
  try {
    fs.rmSync(cartella, { recursive: true, force: true });
  } catch (errore) {
    // pazienza
  }
}

// Scarica un pacchetto .tar.gz e lo apre in "cartella" (gia' creata). Dice l'avanzamento con { id, tipo, percento, ... }.
// Se qualcosa non va lancia un errore: chi chiama toglie la cartella parziale.
async function scaricaPacchetto(nomeFile, cartella, id, tipo, avanzamento) {
  const risposta = await net.fetch(URL_PACCHETTI + nomeFile);
  if (!risposta.ok) {
    throw new Error(risposta.status === 404 ? "questo pacchetto non e' ancora stato preparato" : "GitHub risponde " + risposta.status);
  }
  const totale = parseInt(risposta.headers.get("content-length") || "0", 10);
  const apritore = creaApritore(cartella);
  const gunzip = zlib.createGunzip();
  let errore = null;
  gunzip.on("data", function (pezzo) {
    try {
      apritore.aggiungi(pezzo);
    } catch (e) {
      errore = e;
    }
  });
  const finito = new Promise(function (fatto, fallito) {
    gunzip.on("end", fatto);
    gunzip.on("error", fallito);
  });

  const lettore = risposta.body.getReader();
  let ricevuti = 0;
  let ultimo = -1;
  while (true) {
    const { done, value } = await lettore.read();
    if (done) break;
    if (errore) throw errore;
    // se gunzip e' pieno si aspetta che si svuoti (cosi' non si riempie la memoria)
    if (!gunzip.write(Buffer.from(value))) {
      await new Promise(function (fatto) { gunzip.once("drain", fatto); });
    }
    ricevuti += value.length;
    const percento = totale > 0 ? Math.floor((ricevuti / totale) * 100) : 0;
    if (percento !== ultimo) {
      ultimo = percento;
      avanzamento({ id: id, tipo: tipo, percento: percento, megabyte: Math.round(ricevuti / 1e6), totale: Math.round(totale / 1e6) });
    }
  }
  gunzip.end();
  await finito;
  if (errore) throw errore;
  return apritore.chiudi();
}

async function scaricaDavvero(id, avanzamento) {
  if (!/^R_\d{4}_\d{4}$/.test(id)) throw new Error("Regione non valida: " + id);
  const finale = path.join(cartellaRegioni(), id);
  const parziale = finale + ".parziale";
  cancella(parziale);
  fs.mkdirSync(parziale, { recursive: true });

  try {
    await scaricaPacchetto("regione_" + id + ".tar.gz", parziale, id, "regione", avanzamento);

    // controllo: i file ci sono e sono proprio di questa regione
    if (!completa(parziale)) throw new Error("nel pacchetto mancano dei file");
    const info = JSON.parse(fs.readFileSync(path.join(parziale, "regione.json"), "utf-8"));
    if (info.id !== id) throw new Error("il pacchetto e' di un'altra regione (" + info.id + ")");
    const terreno = JSON.parse(fs.readFileSync(path.join(parziale, "terreno.json"), "utf-8"));
    const atteso = terreno.colonne * terreno.righe * 2;
    if (fs.statSync(path.join(parziale, "terreno.bin")).size !== atteso) throw new Error("il terreno e' incompleto");

    cancella(finale);
    fs.renameSync(parziale, finale);
    return true;
  } catch (errore) {
    cancella(parziale);
    throw errore;
  }
}

// --- Foto di dettaglio (0,5 m): pacchetto FACOLTATIVO di una regione ----------------------------------------
// Si scarica a parte (da 20 a 250 MB), solo con i profili Media, Alta e Ultra, e dopo che la regione e' gia' in uso:
// il gioco parte subito con la foto a 2 m e quando il pacchetto e' pronto aggiunge il dettaglio.
// Se il pacchetto non esiste (404) o il download fallisce, niente cambia: la regione funziona come prima.
const hdInCorso = {};

function haFotoHD(id) {
  const cartella = cartellaDi(id);
  return !!cartella && fs.existsSync(path.join(cartella, "foto_hd", "indice.json"));
}

async function scaricaHDDavvero(id, avanzamento) {
  if (!/^R_\d{4}_\d{4}$/.test(id)) throw new Error("Regione non valida: " + id);
  if (haFotoHD(id)) return true;
  const finale = path.join(cartellaRegioni(), id);
  // la regione che sta dentro l'app non si puo' modificare: le sue foto di dettaglio (se ci sono) sono gia' nell'app
  if (!completa(finale)) return false;
  const parziale = finale + ".hd.parziale";
  cancella(parziale);
  fs.mkdirSync(parziale, { recursive: true });
  try {
    await scaricaPacchetto("hd_" + id + ".tar.gz", parziale, id, "hd", avanzamento);
    const indice = path.join(parziale, "foto_hd", "indice.json");
    if (!fs.existsSync(indice)) throw new Error("nel pacchetto delle foto di dettaglio manca l'indice");
    const dati = JSON.parse(fs.readFileSync(indice, "utf-8"));
    // controllo: tutti i tasselli dell'indice ci sono
    for (const tassello of dati.tasselli) {
      if (!fs.existsSync(path.join(parziale, "foto_hd", "hd_" + tassello[0] + "_" + tassello[1] + ".jpg"))) {
        throw new Error("nel pacchetto delle foto di dettaglio mancano dei tasselli");
      }
    }
    cancella(path.join(finale, "foto_hd"));
    fs.renameSync(path.join(parziale, "foto_hd"), path.join(finale, "foto_hd"));
    cancella(parziale);
    return true;
  } catch (errore) {
    cancella(parziale);
    throw errore;
  }
}

// Scarica le foto di dettaglio di una regione (una sola volta anche se richieste due volte insieme)
function scaricaHD(id, avanzamento) {
  if (haFotoHD(id)) return Promise.resolve(true);
  if (!hdInCorso[id]) {
    hdInCorso[id] = scaricaHDDavvero(id, avanzamento).finally(function () {
      delete hdInCorso[id];
    });
  }
  return hdInCorso[id];
}

// Scarica una regione (una sola volta anche se viene chiesta due volte insieme)
function scarica(id, avanzamento) {
  if (cartellaDi(id) !== null) return Promise.resolve(true);
  if (!inCorso[id]) {
    inCorso[id] = scaricaDavvero(id, avanzamento).finally(function () {
      delete inCorso[id];
    });
  }
  return inCorso[id];
}

// Toglie le regioni scaricate a meta' rimaste da una chiusura improvvisa
function pulisci() {
  try {
    for (const nome of fs.readdirSync(cartellaRegioni())) {
      if (nome.endsWith(".parziale")) cancella(path.join(cartellaRegioni(), nome));   // anche ".hd.parziale"
    }
  } catch (errore) {
    // niente da pulire
  }
}

// Elimina una regione scaricata (non quella in uso, non quella dentro l'app)
function elimina(id) {
  if (id === regioneAttuale() || !/^R_\d{4}_\d{4}$/.test(id)) return false;
  cancella(path.join(cartellaRegioni(), id));
  return true;
}

function megabyteUsati() {
  let totale = 0;
  function somma(cartella) {
    try {
      for (const voce of fs.readdirSync(cartella, { withFileTypes: true })) {
        const percorso = path.join(cartella, voce.name);
        if (voce.isDirectory()) somma(percorso);
        else totale += fs.statSync(percorso).size;
      }
    } catch (errore) {
      // cartella che non c'e'
    }
  }
  somma(cartellaRegioni());
  return Math.round(totale / 1e6);
}

module.exports = { stato, imposta, scarica, scaricaHD, haFotoHD, elimina, pulisci, cartellaDatiAttuale, megabyteUsati, creaApritore };
