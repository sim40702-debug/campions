# Ticino Motorcycle Simulator – Piano tecnico Unreal Engine 5

Data: 6 novembre 2026 · Versione del motore scelta: **Unreal Engine 5.8** (giugno 2026, ultima versione maggiore di UE5)

---

## FASE 1 – Analisi del progetto esistente (fatta)

### Cosa c'è nella repository `campions`

| Parte | Stato | Riutilizzabile in Unreal |
|---|---|---|
| Progetto Unreal (`.uproject`, Blueprint, C++, mappe, asset) | **Non esiste** | – |
| `tools/geo` – pipeline dati (Python) | Funziona, provata con dati veri su GitHub | **Sì**: heightmap 16 bit già nel formato del Landscape (passo 3), confini e regioni (passo 4), strade con profilo liscio, larghezze, ponti e gallerie (passo 7), edifici con altezze, boschi, segnaletica, lampioni, fiumi, teleferiche, ferrovie, foto aeree SWISSIMAGE (passo 8) |
| `anteprima` – gioco Three.js + Electron | Funziona, release 0.1–0.8 | **Come riferimento**: logica della moto (marce, giri, piega, sterzo), garage, telecamere, test prestazioni |
| Documenti Scrum, stima, fonti e licenze | Aggiornati | Sì |

### Problemi trovati

1. **Non c'è nessun progetto Unreal**: tutto quello che il documento chiede di "analizzare" (Blueprint, C++, modelli, materiali, luci, fisica) va **creato**.
2. **Hardware (decisione D7 aperta)**: Unreal Engine non gira nell'ambiente dove lavora Claude. Il MacBook Air M2 con 8 GB di RAM e disco da 256 GB quasi pieno non basta per l'editor con un mondo aperto (servono almeno 32 GB di RAM e circa 1 TB libero). **Finché non c'è un computer adatto, nessuna fase può essere verificata** ("il progetto si apre", "la moto funziona", "misura le prestazioni").
3. **KTM 690 SMC R**: forma, carrozzeria arancione e grafiche KTM sono design e marchi protetti. Claude non ricrea la moto originale. Due strade possibili:
   - **MRW SM 690** originale (supermotard monocilindrica 690 cc, stessa categoria e prestazioni), modellata da noi o da un artista;
   - un modello 3D professionale **comprato con licenza**: attenzione, quasi sempre le licenze dei modelli di moto vere **vietano** l'uso in un gioco senza il permesso del costruttore. La pipeline di import (capitolo Fase 3) funziona con qualsiasi modello con le ossa giuste: la scelta e la verifica della licenza sono tue.
4. **Asset mancanti** (da procurare con licenza verificata): pilota con animazioni (MetaHuman è gratuito per progetti Unreal), auto per il traffico, pedoni, texture PBR di asfalto, muri, tetti in pietra (piode), vegetazione. Fonti possibili: Fab (marketplace Epic), MetaHuman, texture CC0 (per esempio ambientCG, Poly Haven).
5. **Audio motore realistico**: senza registrazioni vere di un monocilindrico si può fare solo un motore sintetizzato con MetaSounds (già migliore di un file ripetuto, ma non come una registrazione).

---

## Architettura scelta

### Un solo progetto per Windows e macOS

```
unreal/MotoRacingWorld/
  MotoRacingWorld.uproject        Unreal 5.8, modulo C++ + plugin
  Config/                         impostazioni (rendering, piattaforme, input, preset)
  Source/MotoRacingWorld/         codice C++ del gioco
  Content/Python/                 script per l'editor (creano livelli e importano i dati)
  Content/...                     asset (creati nell'editor, su Git LFS)
```

- **Codice di gioco in C++** (non Blueprint): si può scrivere, rivedere e versionare come testo; i Blueprint servono solo per regolare i valori.
- **Livelli e import dati con script Python dell'editor**: i dati di `tools/geo` vengono importati con uno script ripetibile (niente lavoro a mano che si perde).
- Stesso codice, stessi asset, stessa fisica su tutte e due le piattaforme; cambiano solo i file `Config/Windows` e `Config/Mac`.

### Rendering per piattaforma (verificato sulla documentazione Epic)

| Tecnologia | Windows (DX12, SM6) | Mac Apple Silicon (Metal) | Alternativa se manca |
|---|---|---|---|
| Lumen GI e riflessi (software) | Sì | Sì (M1+) | – |
| Lumen ray tracing hardware | Sì (GPU RTX/RDNA2+) | Sperimentale (M2+/M3+) | Lumen software |
| Nanite | Sì | Sì su M2+ con SM6 (serve macOS 15+) | Mesh con LOD classici (M1) |
| Virtual Shadow Maps | Sì | Sì su M2+ | Cascaded Shadow Maps |
| TSR | Sì | Sì (M1+) | – |
| Nuvole volumetriche, nebbia volumetrica | Sì | Sì | Nuvole più leggere nei preset bassi |
| Path tracing | Sì | No | Solo per screenshot su Windows |

### Preset grafici

LOW, MEDIUM, HIGH, ULTRA, CINEMATIC = i 5 livelli di scalabilità di Unreal (0–4). In più: risoluzione, V-Sync, limite FPS, anti-aliasing, ombre, texture, riflessi, effetti, post-processing. Rilevamento automatico dell'hardware (benchmark di Unreal) e proposta del preset; 4K solo se il benchmark lo permette.

---

## Le fasi (ordine delle priorità del documento)

| Fase | Contenuto | Cosa può fare Claude | Cosa serve a te |
|---|---|---|---|
| 1 | Analisi | **Fatta** (questo documento) | – |
| 2 | Rendering e grafica | Progetto UE 5.8, configurazione Lumen/Nanite/VSM/TSR per Windows e Mac, attore C++ giorno/notte e meteo, script che crea il livello con cielo, nuvole, nebbia, luci e post-processing | Aprire il progetto e lanciare lo script |
| 3 | Modello della moto | Pipeline di import (ossa: ruote, forcella, sterzo, forcellone, catena), specifica dei pezzi | Modello 3D (artista o licenza) |
| 4 | Materiali e texture | Materiali master PBR (plastica, metallo, gomma, asfalto bagnato/asciutto, muri, tetti) | Texture PBR con licenza |
| 5 | Fisica e gameplay | Componente C++ della moto: gomme, sospensioni, trasferimento di carico, freni separati, piega, impennata, asciutto/bagnato, collisioni | Prove di guida |
| 6 | Animazioni | Pilota con IK su manubrio e pedane, piega, impennata, salita/discesa | Pilota (MetaHuman) e animazioni |
| 7 | Open world | Import Landscape (World Partition) e strade dai dati `tools/geo`, regione per regione, partendo dal Locarnese e poi Bellinzona, Lugano, Mendrisio, Chiasso | Lanciare gli script, controllare |
| 8 | Traffico e ambiente | Traffico su strade OSM con semafori e rotatorie, pedoni, parcheggi, benzinai | Modelli di auto e pedoni |
| 9 | Audio | MetaSound del motore a strati per regime, scarico, gomme, ambiente | Registrazioni vere (opzionali) |
| 10 | Windows e Mac | Config per piattaforma, profili dispositivo, istruzioni di build | Build su PC Windows e su Mac |
| 11 | Ottimizzazione | HLOD, streaming, istanze, profili | Misure con il profiler |
| 12 | Test finali | Liste di controllo | Prove complete |

**Regola**: una fase è "fatta" solo quando è stata **aperta, compilata e provata** sul tuo computer. Finché non c'è il computer adatto, Claude scrive il codice e lo segna **"scritto, non ancora compilato"**.

---

## Fase 2 – cosa contiene il primo pezzo (in questa consegna)

- `MotoRacingWorld.uproject` per UE 5.8 con modulo C++ e plugin necessari (Python, Editor Scripting, Water, PCG, Enhanced Input).
- `Config/DefaultEngine.ini`: Lumen (GI e riflessi), Nanite, Virtual Shadow Maps, TSR, Mesh Distance Fields, coordinate grandi; DX12 SM6 su Windows; Metal SM6 + SM5 (per M1) su Mac.
- `Config/Mac/MacEngine.ini`: niente ray tracing hardware, ombre e GI adatte al Mac.
- `Source/MotoRacingWorld`: modulo C++ e attore **AMRWCicloGiorno** (posizione del sole da ora del giorno, luce e temperatura colore, cielo e nebbia, pioggia e strade bagnate tramite parametri globali dei materiali).
- `Content/Python/mrw_crea_livello.py`: crea il livello di partenza con cielo fisico, nuvole volumetriche, nebbia volumetrica, sole, luce del cielo, post-processing con TSR ed esposizione automatica.

Stato: **scritto, non ancora compilato né aperto** (Unreal non è disponibile in questo ambiente).
