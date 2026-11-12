// Aggiornamenti dell'app: controlla le release su GitHub, scarica, TOGLIE la versione vecchia,
// installa la nuova e la riavvia. Alla fine non resta nessun file in giro.
//
// - Mac: scarica il .dmg, cancella l'app vecchia e mette la nuova nello stesso posto
//   (se l'app girava dal .dmg o da una cartella "di passaggio" del Mac, la mette in Applicazioni).
// - Windows (installazione): avvia il programma di installazione in silenzio; lui disinstalla
//   la versione vecchia, installa la nuova nella stessa cartella e la riapre.
// - Windows (portatile): appena il gioco si chiude, il nuovo .exe prende il posto di quello vecchio.

const { app, net, shell } = require("electron");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Ticino completo (branch feature/ticino-completo): le versioni di prova sono PRE-release con il tag
// "ticino-completo-vX". Si guarda l'elenco delle release e si prende la piu' recente con quel tag:
// cosi' questa app non viene mai sostituita dall'anteprima normale (e viceversa).
const URL_RELEASE = "https://api.github.com/repos/sim40702-debug/swissgass/releases?per_page=40";
const PREFISSO_TAG = "ticino-completo-v";

// "0.2.10" -> [0, 2, 10]  (per confrontare le versioni numero per numero)
function numeriVersione(testo) {
  return testo.split(".").map(function (parte) {
    return parseInt(parte, 10) || 0;
  });
}

function versionePiuNuova(nuova, attuale) {
  const a = numeriVersione(nuova);
  const b = numeriVersione(attuale);
  for (let i = 0; i < 4; i++) {   // il quarto numero e' quello della prova: 0.16.0-ticino.2
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
  const risposta = await net.fetch(URL_RELEASE, {
    headers: { "User-Agent": "MRW-Anteprima", "Accept": "application/vnd.github+json" }
  });
  if (!risposta.ok) {
    throw new Error("GitHub non risponde (" + risposta.status + ")");
  }
  const tutte = await risposta.json();
  let release = null;
  for (const una of tutte) {
    if (una.draft || !una.tag_name.startsWith(PREFISSO_TAG)) continue;
    if (release === null || versionePiuNuova(una.tag_name.replace(PREFISSO_TAG, ""), release.tag_name.replace(PREFISSO_TAG, ""))) release = una;
  }
  if (release === null) {
    return { attuale: app.getVersion(), nuova: app.getVersion(), disponibile: false, url: null, nome: null, note: "" };
  }
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
  // Dove mettere la nuova: al posto della vecchia, oppure in Applicazioni se la vecchia
  // gira dal .dmg (/Volumes) o da una copia temporanea del Mac (AppTranslocation)
  const inApplicazioni = !appAttuale.endsWith(".app") || appAttuale.startsWith("/Volumes/") || appAttuale.includes("/AppTranslocation/");
  let destinazione = appAttuale;
  try {
    fs.accessSync(inApplicazioni ? "/Applications" : path.dirname(appAttuale), fs.constants.W_OK);
  } catch (errore) {
    // non posso scrivere li': apro il .dmg e il resto lo fa l'utente
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
  let nomeApp = "";
  try {
    nomeApp = fs.readdirSync(montaggio).find(function (nome) {
      return nome.endsWith(".app");
    });
    if (inApplicazioni) destinazione = path.join("/Applications", nomeApp);
    // 1) copio la nuova ACCANTO alla vecchia (prima si cancellava subito la vecchia: se il Mac
    //    bloccava la copia a meta', restava un'app senza i dati del terreno)
    execFileSync("rm", ["-rf", destinazione + ".nuova"]);
    execFileSync("ditto", [path.join(montaggio, nomeApp), destinazione + ".nuova"]);
  } catch (errore) {
    console.log("Aggiornamento non riuscito: " + errore.message);
    try {
      execFileSync("rm", ["-rf", destinazione + ".nuova"]);
    } catch (altroErrore) {
      // pazienza
    }
    nomeApp = "";
  } finally {
    execFileSync("hdiutil", ["detach", montaggio, "-force"]);
  }

  // 2) controllo che la copia nuova sia completa (dati del terreno compresi)
  const datiNuovi = path.join(destinazione + ".nuova", "Contents", "Resources", "app", "dati", "terreno.json");
  if (nomeApp === "" || !fs.existsSync(datiNuovi)) {
    // la vecchia e' ancora intatta: tolgo la copia incompleta, apro il .dmg
    // e l'utente trascina l'app in Applicazioni
    try {
      execFileSync("rm", ["-rf", destinazione + ".nuova"]);
    } catch (errore) {
      // pazienza
    }
    shell.openPath(dmg);
    return "aperto";
  }

  // 3) scambio: la vecchia diventa ".vecchia", la nuova prende il suo posto, poi tolgo la vecchia
  try {
    if (fs.existsSync(destinazione)) {
      execFileSync("rm", ["-rf", destinazione + ".vecchia"]);
      fs.renameSync(destinazione, destinazione + ".vecchia");
    }
    fs.renameSync(destinazione + ".nuova", destinazione);
  } catch (errore) {
    console.log("Scambio non riuscito: " + errore.message);
    // rimetto a posto la vecchia se serve
    if (!fs.existsSync(destinazione) && fs.existsSync(destinazione + ".vecchia")) {
      fs.renameSync(destinazione + ".vecchia", destinazione);
    }
    shell.openPath(dmg);
    return "aperto";
  }
  try {
    execFileSync("rm", ["-rf", destinazione + ".vecchia"]);
  } catch (errore) {
    // se non riesce a toglierla non e' grave
  }
  try {
    execFileSync("xattr", ["-cr", destinazione]);
  } catch (errore) {
    // se non riesce non e' grave
  }
  fs.unlinkSync(dmg);   // il .dmg scaricato non serve piu'
  spawn("open", ["-n", destinazione], { detached: true, stdio: "ignore" }).unref();
  setTimeout(function () {
    app.quit();
  }, 500);
  return "riavvio";
}

// Toglie i programmi di installazione lasciati nella cartella Download dalle versioni vecchie
function puliziaDownloadWindows() {
  try {
    const cartella = app.getPath("downloads");
    for (const nome of fs.readdirSync(cartella)) {
      if (/^MRW-Anteprima-Ticino-[0-9.]+-Windows-Installazione\.exe$/.test(nome)) {
        fs.unlinkSync(path.join(cartella, nome));
      }
    }
  } catch (errore) {
    // non importa
  }
}

function installaWindows(exe) {
  puliziaDownloadWindows();
  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    // Versione portatile: il .exe che gira non si puo' cancellare finche' il gioco e' aperto.
    // Un piccolo script aspetta che si chiuda, cancella il vecchio, mette il nuovo al suo posto e lo avvia.
    const vecchio = process.env.PORTABLE_EXECUTABLE_FILE;
    const script = path.join(os.tmpdir(), "mrw-aggiorna.cmd");
    const righe = [
      "@echo off",
      ":riprova",
      'del /f /q "' + vecchio + '" >nul 2>&1',
      'if exist "' + vecchio + '" (timeout /t 1 /nobreak >nul & goto riprova)',
      'move /y "' + exe + '" "' + vecchio + '" >nul',
      'start "" "' + vecchio + '"',
      'del "%~f0"'
    ];
    fs.writeFileSync(script, righe.join("\r\n"));
    spawn("cmd.exe", ["/c", script], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } else {
    // Installazione: /S = senza finestre (disinstalla la vecchia e installa la nuova nella stessa cartella),
    // --force-run = alla fine riapre il gioco
    spawn(exe, ["/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
  }
  setTimeout(function () {
    app.quit();
  }, 500);
  return "riavvio";
}

async function installa(info, avanzamento) {
  // Si scarica nella cartella temporanea: niente file lasciati in Download
  const cartella = os.tmpdir();
  const destinazione = path.join(cartella, info.nome);
  await scarica(info.url, destinazione, avanzamento);
  if (process.platform === "darwin") return installaMac(destinazione);
  if (process.platform === "win32") return installaWindows(destinazione);
  return "aperto";
}

module.exports = { controlla, installa, versionePiuNuova };
