# Sprint A – Report

Stato: **IN CORSO** – gli script sono pronti; aspettiamo che Simone li esegua e importi il pilota in Unreal.

## Fatto finora

- Script `tools/geo/passo1` … `passo6` (Python, Mac e Windows).
- Guida per Unreal `docs/GUIDA_UNREAL.md`.
- `.gitignore` (i dati geografici non vanno su Git) e `.gitattributes` (Git LFS per i file Unreal).
- `avvia_pilota.py`: un solo comando per tutti i passi del pilota, con registro.
- **Anteprima Ticino 0.1.0** (Three.js + Electron): terreno, strade, ponti, lago, moto arcade, telecamere, quota e coordinate LV95, minimappa.
- **Release automatiche**: il workflow GitHub scarica i dati veri, esegue i passi 1–7 e crea l'app per Mac (arm64 e Intel) e Windows (installazione e portatile).
- Prova dell'anteprima nel browser con dati di prova: carica, si guida, telecamere e tasto R funzionano, nessun errore.

## Prove fatte

L'ambiente dove lavora Claude **non può scaricare** da swisstopo, OpenStreetMap e Copernicus (rete bloccata). Quindi:

- **Passi 1 e 2 (download)**: scritti seguendo il formato del catalogo STAC di swisstopo e di Overpass, ma **non ancora provati** con i server veri. Sono la prima cosa da controllare.
- **Passi 3–6**: provati con **dati inventati** nello stesso formato (99 tasselli finti 1 × 1 km, un tassello mancante, confini e strade finti). Risultati:
  - heightmap pilota 4065 × 4065, PNG 16 bit, posizione e scala corrette;
  - il buco senza swissALTI3D viene riempito con Copernicus (errore di 0,16 m nel punto controllato);
  - modalità a tasselli: i bordi dei tasselli vicini sono identici e uguali alla heightmap pilota;
  - il confine finisce nella riga giusta del layer;
  - passo 6: errore medio 0,014 m, massimo 0,027 m, 100 % sotto 1 m.
- I dati di prova sono stati cancellati dopo i test.

## Da fare

- Simone: eseguire i passi con i dati veri (vedi Sprint Plan).
- Claude: scrivere nel Report e nella stima i numeri **misurati** (km di strade, settori nel Ticino, superficie).

## Dati scaricati (da compilare)

| Dato | Data download | Versione / anno | Note |
|---|---|---|---|
| swissALTI3D 2 m | | | |
| OSM confini | | | |
| OSM strade | | | |
| Copernicus DEM | | | |
| Versione Unreal Engine | | | |

## Bug trovati

Nessuno per ora.
