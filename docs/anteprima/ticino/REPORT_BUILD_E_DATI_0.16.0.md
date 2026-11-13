# 0.16.0 — dati pubblicati, merge con main, build di prova (13/11/2026)

**La 0.16.0 NON è pubblicata.** Nessun tag, nessuna GitHub Release, nessuna pre-release nuova, nessun pacchetto HD caricato, nessun installer ufficiale. La prova GPU Windows **non è eseguita**: tutti i numeri sono in grafica software.

## 1. Dati geografici riconciliati — pubblicati
- Workflow: [run #6 (id 43397221897)](https://github.com/sim40702-debug/swissgass/actions/runs/43397221897), modalità `solo_riconcilia` + `pubblica_riconciliati=true`, successo. (Run di analisi precedente senza pubblicazione: [#5](https://github.com/sim40702-debug/swissgass/actions/runs/43385897633).)
- Prima di scrivere: gli SHA-256 degli originali scaricati sono stati confrontati con quelli registrati (`pubblicato_prima_sha256.txt`, 79 asset): tutti uguali. Originali conservati: artefatto `originali-pubblicati` (90 giorni), copia locale con SHA-256 e l'elenco nel repository.
- Pubblicati **esattamente 16** `regione_R_*.tar.gz` (le altre 3 regioni, `cantone.tar.gz`, `rilievo_*`, `controllo_*`, `stato.json`, log invariati). Nessun HD, nessun tag, nessun nuovo asset: 79 asset prima e dopo.
- Caricamento file per file con riscaricamento e confronto SHA-256 (nel workflow, con interruzione al primo scostamento). **Verifica indipendente mia:**
  - 79 asset: i digest API coincidono con l'elenco atteso; cambiati solo i 16;
  - tutti i pacchetti si scaricano, sono archivi validi e coincidono col digest;
  - **download anonimo** (come lo fa il gioco) dei 16 pacchetti: 16/16 SHA-256 corretti, `Range` risponde 206;
  - compatibilità con 0.15.5/0.15.6/0.15.7: rispetto agli originali l'elenco dei membri, i permessi e tutti i file sono **identici byte per byte** tranne `strade.json`, in cui cambiano **solo 10 170 valori `y`** di vertici di ponti/gallerie (stesse chiavi, stessi `x`/`z`, stessa lunghezza). Le versioni 0.15.x usano la dimensione solo per la barra di avanzamento e controllano il `terreno.bin` (invariato); 0.15.6/0.15.7 differiscono dalla 0.15.5 solo per il suono.
  - `strade.json` pubblicati = quelli validati con le 11 verifiche (19/19, `strade_sha256_pubblicate.txt`).

### SHA-256 dei 16 pacchetti pubblicati
Elenco completo prima/dopo in `docs/anteprima/ticino/pubblicato_prima_sha256.txt` e `pubblicato_dopo_sha256.txt` (79 righe ciascuno). Pacchetti cambiati: `regione_R_2664_1106, 2664_1122, 2680_1106, 2680_1138, 2680_1154, 2696_1090, 2696_1106, 2696_1122, 2696_1138, 2712_1074, 2712_1090, 2712_1106, 2712_1122, 2712_1138, 2712_1154, 2728_1106`.

### Come tornare indietro (non fatto)
Ricaricare con `--clobber` i 16 pacchetti dell'artefatto `originali-pubblicati` (SHA-256 in `pubblicato_prima_sha256.txt`).

## 2. Merge con main
- Riferimento di sicurezza: ramo `sicurezza/prima-merge-main-0.15.7` = `8368aae` (locale e remoto).
- Commit di partenza `8368aae`; `main` = `041c676` (0.15.7); **commit di merge `c95d1f7`** (merge commit, nessun force-push, nessuna riscrittura).
- Risultato: 0.15.6 e 0.15.7 integrate. Conflitti in 3 file, risolti senza togliere funzioni: `anteprima/package.json` e `src/gioco.js` (versione **0.16.0**), `NOTE_RELEASE.md` (note 0.16.0 + storia 0.15.7/0.15.6). `audio.js` arriva da main. Differenza tra prima e dopo il merge: solo `NOTE_RELEASE.md` e `audio.js`. Presenti: LOD lontano, incroci, erba, HD, download con ripresa, riconciliazione, Ticino completo.

## 3. Workflow di build senza pubblicazione
File `.github/workflows/build-prova-senza-pubblicazione.yml`, nome **"Build di prova (NESSUNA pubblicazione)"**. Solo permessi `contents: read` (non può creare tag/release/pre-release né caricare in release); nessun comando di pubblicazione; usa i dati pubblicati in sola lettura. Parte con un push sul solo ramo `claude/brave-turing-mztbtd` che modifichi il file (un workflow nuovo non è avviabile a mano finché non è in `main`).
- Primo giro (run [#1](https://github.com/sim40702-debug/swissgass/actions/runs/43400607951)): installer Windows e Mac arm64 installati e avviati con successo; fallivano **browser di Playwright mancante in `controlli`** (job saltato dopo), riassunti con `ls` senza `.exe`, e portatile Windows (lanciatore non agganciabile). Corretti senza indebolire i controlli (il portatile ora deve restare in vita 60 s con almeno 2 processi).
- **Secondo giro: [run #2 (id 43405255833)](https://github.com/sim40702-debug/swissgass/actions/runs/43405255833), commit `7a7bc1e`: tutti e 4 i job in successo.** (Il codice 137 visto in sessione era il riavvio del container, non un errore della CI: stato verificato direttamente.)

## 4. Risultati del build di prova
| Cosa | Esito |
|---|---|
| Compilazione e installer (Windows NSIS + portatile, Mac arm64 e x64) | **costruiti**; controlli di contenuto OK (dati, 11 file critici, tutti i moduli `src/*.js`) |
| Artefatti caricati e scaricabili | **sì**, scaricati e verificati (`unzip -t`): Windows 322 MB, Mac 412 MB |
| Windows installer NSIS | **installato in silenzio e avviato**; app 0.16.0; **17/17** profili+LOD, **14/14** regioni/download/passaggio/memoria; 0 errori in console (grafica software) |
| Windows portatile | **avviato e rimasto in esecuzione 60 s**; interfaccia **non** controllata |
| Mac arm64 (.dmg) | **montato, copiato, avviato**; **17/17** e **14/14**, 0 errori |
| Mac x64 (.dmg) | **costruito, NON avviato** (runner arm64): non verificato |
| Linux (controlli) | 11 verifiche geografiche **11/11**; Electron dal sorgente **14/14**; 3 regioni (Locarno, Lugano, Gottardo) **3/3**; profili/LOD **17/17**; download con ripresa **7/7**; luoghi OK; SHA-256 dei dati scaricati = pubblicati |
| Regressione contro 0.15.7 (software, Locarno) | chiamate −0,6…+6,2 %, triangoli +0,4…+5,7 %, heap +65…+100 MB, caricamento +2…+7 s, **0 errori**; sotto la soglia di allarme (15 %) |
| Profili grafici / LOD | quattro profili selezionabili; LOD spento in Bassa, attivo in Media/Alta/Ultra (23/23/208 sagome a Locarno) |
Limiti: rendering SwiftShader (CPU): niente FPS, VRAM o aspetto reale. L'installer non è firmato (SmartScreen/Gatekeeper avvisano). Mac x64 e interfaccia del portatile non verificati.

## 5. Quote delle opere
Dettagli e dati in `ANALISI_QUOTE_OPERE.md`.
- 493 vertici di galleria sopra il terreno / 455 di ponte sotto: **preesistenti** (513 / 601 prima), concentrati nei capi (portali, teste di ponte); la riconciliazione ne ha corretti 166 e peggiorati 0. Nessuna opera forzata sul terreno. Visivo e collisione: esaminati 3 casi (più la logica del codice): nessun tubo fluttuante né ponte coperto; difetto visivo preesistente a Maccagno (lastra bianca), causa non individuata.
- Scalini tra carreggiate sovrapposte: 202 su 113 866 punti (max 2,74 m), **identici prima e dopo**: documentati a parte.
- **Problema aperto importante, emerso dall'analisi:** nelle **reti ramificate di ponti (svincoli)** la riconciliazione ha portato tutta la rete a un piano unico (svincolo di Monte Carasso +7…+15 m su terreno piano; viadotti della Biaschina fino a +60 m; Brogeda +12,7 m; A2 in R_2712_1106 +18 m). Non ho una verità di riferimento per dire se siano più giuste di prima. **I dati sono già pubblicati.** Opzioni (tenere, escludere le reti ramificate e ripubblicare, tornare agli originali, indagare con swissTLM3D) in `ANALISI_QUOTE_OPERE.md`: **decisione tua**, non ho toccato i dati.

## 6. Problemi ancora aperti
1. Reti ramificate di ponti (punto 5): da decidere.
2. Test GPU reale sul tuo PC; foto HD non verificabili sul tuo PC (pacchetti non pubblicati).
3. Mac x64 non avviato; interfaccia del portatile Windows non controllata; installer non firmati.
4. Lastra bianca nella galleria di Maccagno; scalini preesistenti; 47 gruppi di strade staccati dalla rete; 1 testa di ponte con 0,91 m di scalino (Via Europa); LOD della vegetazione non fatto.
5. Il workflow di build non è avviabile a mano finché non è in `main` (oggi parte con push sul ramo).
6. Pubblicazione ufficiale **non autorizzata**; `v0.16.0`, Release e Latest non toccati.

## 7. Link diretti agli installer temporanei (run #2, validi fino al 20/11/2026, serve il login GitHub)
- Windows (installer + portatile, 322 MB): https://github.com/sim40702-debug/swissgass/actions/runs/43405255833/artifacts/14026468865
- macOS (arm64 + x64, 412 MB): https://github.com/sim40702-debug/swissgass/actions/runs/43405255833/artifacts/14027650186

## 8. Prova sul tuo PC Windows
Istruzioni complete e aggiornate in `PROVA_WINDOWS_GPU.md`. In breve: scarica l'artefatto **`installer-windows-PROVA-NON-UFFICIALE`** dal [run #2](https://github.com/sim40702-debug/swissgass/actions/runs/43405255833) (sezione Artifacts, serve il login GitHub; scade il 20/11/2026), esegui l'installer (SmartScreen: *Ulteriori informazioni → Esegui comunque*), poi segui benchmark interno, corsa misurata, confronto con 0.15.7 e le note del punto "Svincolo di Monte Carasso / Biaschina".
