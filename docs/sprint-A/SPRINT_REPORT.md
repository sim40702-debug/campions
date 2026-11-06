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

## Dati VERI (dal workflow GitHub, 6 novembre 2026)

I passi 1–7 sono stati eseguiti da GitHub con i dati veri: **i download funzionano**.

| Controllo | Risultato |
|---|---|
| Tasselli swissALTI3D 2 m del pilota | 143 |
| Quote del pilota | da 192,8 m a 1'771,3 m |
| Superficie Ticino dal confine OSM | **2'812 km²** (ufficiale 2'812, differenza 0,0 %) |
| Regioni trovate | **8 di 8** |
| Estensione Ticino LV95 | est 2'672'484–2'732'913, nord 1'075'268–1'165'700: sta nel rettangolo del mondo |
| Verifica terreno (passo 6) | 2'042 punti, errore medio 0,012 m, massimo 0,027 m, 100 % sotto 1 m |

**Strade del settore pilota (64 km²), misurate:**

| Tipo OSM | km |
|---|---|
| residential | 139,8 |
| secondary | 21,5 |
| unclassified | 20,0 |
| tertiary | 15,5 |
| primary | 13,0 |
| trunk | 6,0 |
| living_street | 3,8 |
| link (svincoli) | 2,4 |
| **Totale** | **221,8** |

Altre misure: 1'301 tratti, 1'289 incroci, 23 tratti di rotatoria, ponti 92 tratti (1,9 km), gallerie 8 tratti (6,9 km).
Solo il **3,2 %** delle strade ha la larghezza in OSM e il 32,7 % il numero di corsie: come previsto (rischio della stima), servono le larghezze standard per tipo.
Il 90,3 % dei nodi è in un'unica rete collegata; gli altri gruppi sono soprattutto strade tagliate dal bordo del pilota (da controllare nello Sprint B).

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

## Release dell'anteprima

| Versione | Contenuto |
|---|---|
| 0.1.0 | Prima versione giocabile (Mac arm64 e Intel, Windows installazione e portatile) |
| 0.1.1 | La release contiene anche dati del pilota e registro delle misure |
| 0.1.2 | Corrette gallerie e ponti (BUG-001) |
| 0.1.3 | Terreno senza fessure tra i pezzi, asfalto più chiaro |
| 0.1.4 | Messaggio chiaro se mancano i dati, controllo dei dati nella release (BUG-002) |

## Bug trovati

- BUG-001 Gallerie sopra la montagna: trovato guardando l'anteprima con i dati veri, chiuso in 0.1.2.
