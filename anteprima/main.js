// Finestra Electron dell'anteprima.
// I file del gioco vengono serviti con un indirizzo "app://" invece di "file://":
// cosi' fetch() e i moduli JavaScript funzionano uguale su Mac e Windows.

const { app, BrowserWindow, protocol, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function creaFinestra() {
  const finestra = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "MOTO RACING WORLD - Anteprima Ticino",
    backgroundColor: "#9cc3e6",
    autoHideMenuBar: true
  });
  finestra.loadURL("app://gioco/index.html");
}

app.whenReady().then(function () {
  protocol.handle("app", function (richiesta) {
    const indirizzo = new URL(richiesta.url);
    const file = path.join(__dirname, decodeURIComponent(indirizzo.pathname));
    return net.fetch(pathToFileURL(file).toString());
  });
  creaFinestra();
});

app.on("window-all-closed", function () {
  app.quit();
});
