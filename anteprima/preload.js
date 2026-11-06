// Ponte sicuro tra la pagina del gioco e Electron (solo per gli aggiornamenti)

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aggiornamenti", {
  versione: function () {
    return ipcRenderer.invoke("versione");
  },
  controlla: function () {
    return ipcRenderer.invoke("controlla-aggiornamenti");
  },
  installa: function () {
    return ipcRenderer.invoke("installa-aggiornamento");
  },
  quandoAvanza: function (funzione) {
    ipcRenderer.on("avanzamento-aggiornamento", function (evento, percento) {
      funzione(percento);
    });
  }
});
