# Script dei dati geografici (Mac e Windows)

Questi script scaricano i dati aperti (swisstopo, OpenStreetMap) e creano i file da importare in Unreal.
Lo stesso codice funziona su **Mac** e su **Windows**.

## 1. Installare Python (una volta sola)

- **Mac**: scarica Python 3.12 o più nuovo da python.org e installalo.
- **Windows**: scarica Python 3.12 o più nuovo da python.org. Durante l'installazione spunta **"Add python.exe to PATH"**.

## 2. Preparare l'ambiente (una volta sola)

Apri il Terminale (Mac) o il Prompt dei comandi (Windows) nella cartella `tools/geo`.

**Mac**

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows**

```
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Le volte successive basta la seconda riga (attivare `.venv`).

## 3. Eseguire i passi

**Modo facile (consigliato)**: un solo comando lancia tutti i passi del pilota e salva il registro in `dati/registro_pilota.txt` (da mandare a Claude):

- Mac: `python3 avvia_pilota.py`
- Windows: `python avvia_pilota.py`

**Modo passo per passo**: prima **solo il settore pilota** (Locarno 8 × 8 km), con `--pilota`.
Su Windows scrivi `python` al posto di `python3`.

| Passo | Comando | Cosa fa | Tempo indicativo |
|---|---|---|---|
| 1 | `python3 passo1_scarica_altimetria.py --pilota` | Scarica le altezze swissALTI3D 2 m | pochi minuti |
| 2 | `python3 passo2_scarica_osm.py --pilota` | Scarica confini e strade da OSM | 1-5 minuti |
| 3 | `python3 passo3_crea_terreno.py --pilota` | Crea la heightmap PNG per Unreal | 1-2 minuti |
| 4 | `python3 passo4_crea_confini.py --pilota` | Confini, regioni, elenco settori, layer Confine | 1 minuto |
| 5 | `python3 passo5_misura_strade.py --pilota` | Misura km di strade, ponti, gallerie, incroci | secondi |
| 6 | `python3 passo6_verifica_terreno.py --pilota` | Controlla che il terreno segua swisstopo | 1 minuto |
| 7 | `python3 passo7_esporta_anteprima.py --anteprima` | Prepara i dati del gioco (anteprima) | 1-3 minuti |
| 8 | `python3 passo8_foto_aeree.py --anteprima` | Foto aeree SWISSIMAGE sul terreno | qualche minuto |

Con `--anteprima` invece di `--pilota` i passi lavorano sull'area del gioco (Locarnese 16 × 12 km).

Quando il pilota funziona in Unreal, si ripete **senza** `--pilota` per tutto il Ticino.
Attenzione: per tutto il Ticino servono circa **10-20 GB** di spazio libero e il passo 3 dura a lungo (anche più di un'ora).

## 4. Dove finiscono i file

Tutto va in `tools/geo/dati/` (questa cartella non va su Git):

- `dati/download/` = dati originali scaricati
- `dati/per_unreal/pilota/` = file per Unreal del settore pilota
- `dati/per_unreal/ticino/` = file per Unreal di tutto il Ticino

Dopo i passi 4, 5 e 6 mandami quello che hanno scritto sullo schermo (o il file `misure_strade.md`):
servono per lo Sprint Report.

## 5. Se qualcosa non funziona

- **Errore SSL o certificati su Mac**: apri la cartella Python in Applicazioni e fai doppio clic su "Install Certificates.command".
- **Overpass occupato (errore 429 o timeout)**: aspetta qualche minuto e riprova; i file già scaricati non vengono riscaricati.
- **Download interrotto**: rilancia lo stesso passo, riprende da dove si era fermato.

## Licenze

- Altimetria: Fonte: Ufficio federale di topografia swisstopo
- Strade e confini: © OpenStreetMap contributors (ODbL)
- Bordo fuori Svizzera: Copernicus DEM GLO-30

Dettagli: `docs/FONTI_E_LICENZE.md`.

## Aggiungere solo parchi, prati e zone (senza rifare tutto)

I passi non riscaricano i file che ci sono gia' (`Gia' scaricato: ...`), quindi per avere i parchi basta:

```
python3 passo2_scarica_osm.py --pilota
python3 passo7_esporta_anteprima.py
python3 verifica_uso_suolo.py
```

Il passo 2 scarica solo i dati d'uso del suolo (`uso_suolo_pilota.json`); il passo 7 riscrive i file di `anteprima/dati`
(stessi dati di prima piu' `uso_suolo.json`); `verifica_uso_suolo.py` controlla che le aree siano valide e dentro il terreno.
Le dipendenze: il passo 7 ha bisogno dei passi 1 e 3 (terreno) e 2 (OpenStreetMap).
