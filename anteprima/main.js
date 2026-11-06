// Finestra Electron dell'anteprima.
// I file del gioco vengono serviti con un indirizzo "app://" invece di "file://":
// cosi' fetch() e i moduli JavaScript funzionano uguale su Mac e Windows.

const { app, BrowserWindow, ipcMain, protocol, net } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const aggiornamenti = require("./aggiornamenti.js");

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

app.whenReady().then(function () {
  protocol.handle("app", async function (richiesta) {
    const indirizzo = new URL(richiesta.url);
    const file = path.join(__dirname, decodeURIComponent(indirizzo.pathname));
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
