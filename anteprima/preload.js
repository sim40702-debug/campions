// Ponte sicuro tra la pagina del gioco e Electron (aggiornamenti e regioni del Ticino completo)

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

contextBridge.exposeInMainWorld("regioniApp", {
  stato: function () {
    return ipcRenderer.invoke("regioni-stato");
  },
  imposta: function (id) {
    return ipcRenderer.invoke("regioni-imposta", id);
  },
  scarica: function (id) {
    return ipcRenderer.invoke("regioni-scarica", id);
  },
  elimina: function (id) {
    return ipcRenderer.invoke("regioni-elimina", id);
  },
  quandoAvanza: function (funzione) {
    ipcRenderer.on("regioni-avanzamento", function (evento, avanzamento) {
      funzione(avanzamento);
    });
  }
});
