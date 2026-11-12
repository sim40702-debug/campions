# Pacchetti HD (foto aeree a 0,5 m): analisi e decisione consigliata

**Stato: nessun pacchetto HD è stato caricato su GitHub.** I tasselli sono stati generati qui con dati veri (swisstopo SWISSIMAGE 10 cm) solo per misurarli e per provare il meccanismo di scaricamento. Sono in un container temporaneo, non nel repository.

## 1. Dimensioni misurate (non stimate)
7 296 tasselli da 1024 × 1024 px (500 m + 6 m di margine per lato, JPEG qualità 82), media **282 KB** a tassello, **2 108 MB in tutto (2,1 GB)**.
Il passo 9 produce solo i tasselli del cuore di ogni regione più 2 km (oltre si passa alla regione vicina) e solo dove c'è una strada entro 220 m.

| Regione | Tasselli | MB | a 20 Mbit/s | a 100 Mbit/s |
|---|---|---|---|---|
| R_2664_1106 | 0 | 0 | - | - |
| R_2664_1122 | 22 | 7 | 0,0 min | 0,0 min |
| R_2664_1138 | 175 | 48 | 0,3 min | 0,1 min |
| R_2680_1106 | 254 | 79 | 0,5 min | 0,1 min |
| R_2680_1122 | 315 | 93 | 0,6 min | 0,1 min |
| R_2680_1138 | 293 | 81 | 0,5 min | 0,1 min |
| R_2680_1154 | 337 | 95 | 0,6 min | 0,1 min |
| R_2696_1090 | 442 | 128 | 0,9 min | 0,2 min |
| R_2696_1106 (Locarno, nell'app) | 673 | 196 | 1,3 min | 0,3 min |
| R_2696_1122 | 254 | 76 | 0,5 min | 0,1 min |
| R_2696_1138 | 515 | 148 | 1,0 min | 0,2 min |
| R_2696_1154 | 317 | 86 | 0,6 min | 0,1 min |
| R_2712_1074 | 713 | 181 | 1,2 min | 0,2 min |
| R_2712_1090 (Lugano) | 812 | 249 | 1,7 min | 0,3 min |
| R_2712_1106 | 794 | 247 | 1,6 min | 0,3 min |
| R_2712_1122 | 516 | 150 | 1,0 min | 0,2 min |
| R_2712_1138 | 491 | 140 | 0,9 min | 0,2 min |
| R_2712_1154 | 197 | 48 | 0,3 min | 0,1 min |
| R_2728_1106 | 176 | 55 | 0,4 min | 0,1 min |
| **Totale** | **7 296** | **2 108** | **14 min** | **3 min** |

(I tempi sono calcolo teorico a velocità costante, non misure di rete. Un giocatore scarica solo le regioni dove gioca.)

## 2. Compressione (misurata su 30 tasselli di Lugano)
| Formato | KB/tassello | rispetto all'attuale | PSNR vs originale |
|---|---|---|---|
| JPEG q82 attuale | 280 | 100 % | - |
| JPEG q82 ottimizzato + progressivo (senza perdita) | 258 | 92 % | identico (decodifica uguale) |
| JPEG q75 | 230 | 82 % | 38 dB |
| JPEG q70 | 221 | 79 % | 34,5 dB |
| WebP q80 | 239 | 85 % | 37,7 dB |
| WebP q70 | 193 | 69 % | 35,5 dB |

Le foto aeree hanno molto dettaglio e quasi non si comprimono (gzip sul pacchetto: +3 % di dimensione, nessun guadagno). Conclusione: **senza perdita si guadagna l'8 %** (2,1 → 1,9 GB); **con perdita** (WebP q70) circa il 31 % (→ 1,45 GB) ma con un calo di qualità che **non ho verificato a occhio nel gioco**. Non cambia l'ordine di grandezza: la leva vera è scaricare meno tasselli, non comprimerli di più.

## 3. GitHub Releases: limiti
- Un file (asset) può pesare al massimo **2 GiB**; il più grande dei pacchetti regionali è 249 MB: ok.
- Le richieste con intervallo (`Range`) **funzionano**: misurato `HTTP 206` su un pacchetto reale della pre-release `ticino-completo-dati`. Quindi riprendere un download interrotto e leggere solo parti di un file sono possibili.
- Una release può avere fino a 1 000 file; i 19 pacchetti HD ne userebbero 19. Non ho verificato limiti di banda/uso massimo del repository oltre a quelli documentati: 2,1 GB in più non è un problema tecnico noto, ma raddoppia il peso della pre-release dei dati (oggi 1,93 GB).
- Gli URL di GitHub rimandano a un altro dominio (`release-assets.githubusercontent.com`) con link firmati a scadenza: il gioco li segue già (stesso meccanismo dei pacchetti regione).

## 4. Alternative di hosting (non provate)
| Opzione | Pro | Contro |
|---|---|---|
| GitHub Releases (oggi) | gratuito, stesso posto dei dati, `Range` ok | pre-release più pesante; nessun CDN dedicato |
| Bucket con CDN (Cloudflare R2, S3 + CloudFront) | traffico veloce e senza limiti pratici; R2 senza costi di uscita | account e credenziali da gestire; costo da valutare; un'altra cosa da mantenere |
| Archivio unico per regione con indice (formato tipo PMTiles) + richieste `Range` | **il giocatore scarica solo i tasselli vicini**, mai 250 MB | serve lo sviluppo del lettore; più codice da provare |

## 5. Comportamento in caso di download interrotto o fallito
- **Prima** (codice del ramo fino al commit `0fd13fc`): il download si apriva "al volo" in una cartella `.hd.parziale`; se cadeva la connessione la cartella veniva cancellata e **si ripartiva da zero**.
- **Ora** (commit di questa fase, `regioni_main.js`): il file viene scaricato su disco con ripresa (`Range`); se cade resta in `regioni/_scarico/*.part` e la volta dopo **riparte da dove era arrivato**; se il server non supporta `Range` si riparte da zero; il file si apre solo se la grandezza è quella annunciata; un pacchetto troncato o rovinato non viene mai usato; un 404 dà "pacchetto non ancora preparato". I file parziali si tolgono dopo 14 giorni. Il pacchetto HD è facoltativo: se fallisce, il gioco continua con la foto a 2 m.
- Provato con `tools/anteprima_prova/prova_ripresa_download.mjs` (server locale che taglia la connessione): 7 prove su 7. **Non provato con la rete di GitHub vera né su Windows/Mac.**

## 6. Decisione tecnica consigliata
1. **Non pubblicare i 19 pacchetti HD con la 0.16.0 come requisito.** I pacchetti restano facoltativi e in secondo piano (già implementato): la 0.16.0 funziona completa, con la foto a 2 m, senza di essi.
2. Per la prima pubblicazione, **caricare i pacchetti HD in un file separato della pre-release dei dati** (`hd_R_*.tar.gz`, ricompressi senza perdita: −8 %) e non nell'app: l'app resta com'è; chi gioca con Media/Alta/Ultra li scarica a poco a poco, una regione alla volta (da 7 a 249 MB), solo dove gioca.
3. **Obiettivo successivo (non fatto):** archivio per regione con indice e richieste `Range` per scaricare solo i tasselli entro 1–2 km dal giocatore (dimensione tipica di qualche decina di MB invece di 250) con cache su disco. Così un nuovo giocatore non scarica mai 2 GB e non esiste un caso "download di 250 MB interrotto".
4. Prima di caricare: guardare a occhio nel gioco su un PC vero se WebP q70 (−31 %) è accettabile; se no, restare su JPEG.

Decisione da prendere da parte tua: caricare ora i 2,1 GB nella pre-release (consigliato dopo la prova su PC vero) o aspettare l'archivio con `Range`.
