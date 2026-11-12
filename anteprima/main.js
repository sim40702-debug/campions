// Finestra Electron dell'anteprima.
// I file del gioco vengono serviti con un indirizzo "app://" invece di "file://":
// cosi' fetch() e i moduli JavaScript funzionano uguale su Mac e Windows.

const { app, BrowserWindow, ipcMain, protocol, net } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const aggiornamenti = require("./aggiornamenti.js");
const regioni = require("./regioni_main.js");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function creaFinestra() {
  const finestra = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "MOTO RACING WORLD - Anteprima Ticino",
    backgroundColor: "#9cc3e6",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  finestra.loadURL("app://gioco/index.html");
  return finestra;
}

// --- Aggiornamenti (pulsante "Aggiorna" nel gioco) ------------------------------
let ultimoControllo = null;

ipcMain.handle("versione", function () {
  return app.getVersion();
});

ipcMain.handle("controlla-aggiornamenti", async function () {
  ultimoControllo = await aggiornamenti.controlla();
  return ultimoControllo;
});

ipcMain.handle("installa-aggiornamento", async function (evento) {
  if (ultimoControllo === null || !ultimoControllo.disponibile) {
    ultimoControllo = await aggiornamenti.controlla();
  }
  if (!ultimoControllo.disponibile) {
    return "nessuno";
  }
  return aggiornamenti.installa(ultimoControllo, function (percento) {
    evento.sender.send("avanzamento-aggiornamento", percento);
  });
});

// --- Regioni del Ticino completo --------------------------------------------------
ipcMain.handle("regioni-stato", function () {
  const stato = regioni.stato();
  stato.megabyte = regioni.megabyteUsati();
  return stato;
});
ipcMain.handle("regioni-imposta", function (evento, id) {
  return regioni.imposta(id);
});
ipcMain.handle("regioni-scarica", async function (evento, id) {
  try {
    await regioni.scarica(id, function (avanzamento) {
      if (!evento.sender.isDestroyed()) evento.sender.send("regioni-avanzamento", avanzamento);
    });
    return { ok: true };
  } catch (errore) {
    return { ok: false, errore: errore.message };
  }
});
ipcMain.handle("regioni-elimina", function (evento, id) {
  return regioni.elimina(id);
});

app.whenReady().then(function () {
  regioni.pulisci();
  protocol.handle("app", async function (richiesta) {
    const indirizzo = new URL(richiesta.url);
    const richiesto = decodeURIComponent(indirizzo.pathname);
    let file = path.join(__dirname, richiesto);
    // Ticino completo: i file "dati/..." arrivano dalla regione in uso (dentro l'app o scaricata)
    if (richiesto.startsWith("/dati/")) {
      file = path.join(regioni.cartellaDatiAttuale(), richiesto.slice(6));
    }
    // Se il file non c'e' rispondo "404": cosi' il gioco puo' dire QUALE file manca
    if (!fs.existsSync(file)) {
      console.log("File non trovato: " + file);
      return new Response("File non trovato: " + file, { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(file).toString());
    } catch (errore) {
      console.log("Errore leggendo " + file + ": " + errore.message);
      return new Response("Errore leggendo " + file, { status: 500 });
    }
  });
  creaFinestra();
});

app.on("window-all-closed", function () {
  app.quit();
});
