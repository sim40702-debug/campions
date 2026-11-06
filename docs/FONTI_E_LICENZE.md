# Fonti geografiche e licenze

Regola: si usano **solo** fonti con licenza che permette l'uso nel gioco.
**Vietato** copiare dati, immagini, edifici o geometrie da Google Maps o Google Street View.

Stato: verifica iniziale fatta nello Sprint 0. La verifica definitiva (con data di download e versione di ogni dato) si fa nello Sprint A.

## Fonti previste

| Dato | Fonte | Licenza | Obbligo | Stato |
|---|---|---|---|---|
| Strade, nomi località, punti d'interesse, edifici (contorni) | OpenStreetMap (estratto Svizzera/Ticino) | ODbL 1.0 | Scrivere "© OpenStreetMap contributors" nei crediti del gioco | Da scaricare (Sprint A) |
| Altimetria (terreno senza edifici e alberi) | swisstopo swissALTI3D (0,5 m e 2 m) | OGD swisstopo, uso libero anche commerciale | Indicare la fonte: "Fonte: Ufficio federale di topografia swisstopo" | Da scaricare (Sprint A) |
| Confini cantonali e comunali | swisstopo swissBOUNDARIES3D | OGD swisstopo | Indicare la fonte | Da scaricare (Sprint A) |
| Laghi, fiumi, boschi (controllo) | swisstopo swissTLM3D / OSM | OGD swisstopo / ODbL | Indicare la fonte | Da valutare (Sprint C) |
| Terreno fuori dalla Svizzera (bordo Italia e Grigioni, solo sfondo) | Copernicus DEM GLO-30 (Italia) / swissALTI3D (Grigioni) | Licenza Copernicus DEM / OGD swisstopo | Indicare la fonte | Da verificare (Sprint A) |

## Note importanti

- **OSM (ODbL)**: il gioco è un "lavoro prodotto" dai dati, quindi basta l'attribuzione. Se un giorno pubblichiamo un **database** derivato (per esempio un file con le strade elaborate), quel database deve restare sotto ODbL.
- **swisstopo**: dal 1° marzo 2021 i dati standard sono Open Government Data gratuiti; l'obbligo è citare la fonte.
- Le immagini aeree (SWISSIMAGE) si possono usare **solo come riferimento** per controllare la ricostruzione, non come texture copiate nel gioco, finché non decidiamo diversamente e verifichiamo le condizioni.

## Testo per i crediti del gioco (bozza)

```
Dati geografici:
© OpenStreetMap contributors, disponibili sotto licenza ODbL (openstreetmap.org/copyright)
Fonte: Ufficio federale di topografia swisstopo
```
