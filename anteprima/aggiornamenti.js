// Aggiornamenti dell'app: controlla le release su GitHub, scarica e installa.
//
// - Mac: scarica il .dmg, lo apre, copia la nuova app al posto di quella vecchia
//   in Applicazioni e la riavvia. (I file scaricati dall'app non vengono bloccati dal Mac.)
// - Windows (installazione): scarica il programma di installazione e lo avvia.
// - Windows (portatile): scarica il nuovo .exe nella cartella Download e la apre.

const { app, net, shell } = require("electron");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const URL_ULTIMA_RELEASE = "https://api.github.com/repos/sim40702-debug/campions/releases/latest";
const PREFISSO_TAG = "anteprima-v";

// "0.2.10" -> [0, 2, 10]  (per confrontare le versioni numero per numero)
function numeriVersione(testo) {
  return testo.split(".").map(function (parte) {
    return parseInt(parte, 10) || 0;
  });
}

function versionePiuNuova(nuova, attuale) {
  const a = numeriVersione(nuova);
  const b = numeriVersione(attuale);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

// Quale file della release serve a questo computer?
function fileGiusto(release) {
  let fine;
  if (process.platform === "darwin") {
    fine = "-Mac-" + process.arch + ".dmg";                // arm64 oppure x64
  } else if (process.platform === "win32") {
    fine = process.env.PORTABLE_EXECUTABLE_FILE ? "-Windows-Portatile.exe" : "-Windows-Installazione.exe";
  } else {
    return null;
  }
  return release.assets.find(function (file) {
    return file.name.endsWith(fine);
  }) || null;
}

async function controlla() {
  const risposta = await net.fetch(URL_ULTIMA_RELEASE, {
    headers: { "User-Agent": "MRW-Anteprima", "Accept": "application/vnd.github+json" }
  });
  if (!risposta.ok) {
    throw new Error("GitHub non risponde (" + risposta.status + ")");
  }
  const release = await risposta.json();
  const nuova = release.tag_name.replace(PREFISSO_TAG, "");
  const attuale = app.getVersion();
  const file = fileGiusto(release);
  return {
    attuale: attuale,
    nuova: nuova,
    disponibile: versionePiuNuova(nuova, attuale) && file !== null,
    url: file ? file.browser_download_url : null,
    nome: file ? file.name : null,
    note: release.body || ""
  };
}

// Scarica il file e intanto dice a che punto e' (0-100)
async function scarica(url, destinazione, avanzamento) {
  const risposta = await net.fetch(url);
  if (!risposta.ok) {
    throw new Error("Download non riuscito (" + risposta.status + ")");
  }
  const totale = parseInt(risposta.headers.get("content-length") || "0", 10);
  const lettore = risposta.body.getReader();
  const file = fs.createWriteStream(destinazione);
  let ricevuti = 0;
  let ultimo = -1;
  while (true) {
    const { done, value } = await lettore.read();
    if (done) break;
    file.write(Buffer.from(value));
    ricevuti += value.length;
    const percento = totale > 0 ? Math.floor((ricevuti / totale) * 100) : 0;
    if (percento !== ultimo) {
      ultimo = percento;
      avanzamento(percento);
    }
  }
  await new Promise(function (fatto) {
    file.end(fatto);
  });
}

function installaMac(dmg) {
  // Cartella dell'app che sta girando: .../MRW Anteprima Ticino.app
  const appAttuale = path.resolve(process.execPath, "..", "..", "..");
  if (!appAttuale.endsWith(".app") || !appAttuale.startsWith("/Applications/")) {
    // L'app non e' in Applicazioni: apro solo il .dmg, il resto lo fa l'utente
    shell.openPath(dmg);
    return "aperto";
  }
  const montaggio = path.join(os.tmpdir(), "mrw-aggiornamento");
  try {
    execFileSync("hdiutil", ["detach", montaggio, "-force"], { stdio: "ignore" });
  } catch (errore) {
    // non era montato: va bene
  }
  execFileSync("hdiutil", ["attach", dmg, "-nobrowse", "-noautoopen", "-mountpoint", montaggio]);
  try {
    const nomeApp = fs.readdirSync(montaggio).find(function (nome) {
      return nome.endsWith(".app");
    });
    execFileSync("rm", ["-rf", appAttuale]);
    execFileSync("ditto", [path.join(montaggio, nomeApp), appAttuale]);
  } finally {
    execFileSync("hdiutil", ["detach", montaggio, "-force"]);
  }
  try {
    execFileSync("xattr", ["-cr", appAttuale]);
  } catch (errore) {
    // se non riesce non e' grave
  }
  fs.unlinkSync(dmg);
  spawn("open", ["-n", appAttuale], { detached: true, stdio: "ignore" }).unref();
  setTimeout(function () {
    app.quit();
  }, 500);
  return "riavvio";
}

function installaWindows(exe) {
  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    // Versione portatile: lascio il nuovo file nella cartella Download e la apro
    shell.showItemInFolder(exe);
    return "aperto";
  }
  spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
  setTimeout(function () {
    app.quit();
  }, 500);
  return "riavvio";
}

async function installa(info, avanzamento) {
  const cartella = process.platform === "win32" ? app.getPath("downloads") : os.tmpdir();
  const destinazione = path.join(cartella, info.nome);
  await scarica(info.url, destinazione, avanzamento);
  if (process.platform === "darwin") return installaMac(destinazione);
  if (process.platform === "win32") return installaWindows(destinazione);
  return "aperto";
}

module.exports = { controlla, installa, versionePiuNuova };
