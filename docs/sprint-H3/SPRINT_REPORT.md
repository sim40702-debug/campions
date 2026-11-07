# Sprint H3 – Grafica: moto e piloti 3D, case, alberi (0.10.0 e 0.11.0)

Richiesta di Simone: "devi fare tutto come un videogioco, non tutto a cubi" → "vai falle tutte bene".

## Fatto

- `tools/moto/crea_moto.py`: generatore Blender per le 6 moto del garage (SM 690, Strada 700, Naked 890, Sport 1000 RR, Enduro 450, Scooter 125) con pilota in posizione di guida diversa per ogni moto. La SM 450 resta in `crea_moto_450.py`.
- Anteprima: carica i modelli .glb (`src/modelli3d.js`); cielo con il sole, ombre vicino alla moto, riflessi, tone mapping.
- Case: texture disegnate dal codice (finestre con persiane, finestre semplici, capannoni, coppi); le finestre seguono la misura di ogni muro (campate e piani da circa 3 m).
- Alberi: latifoglie con rami e chioma a nuvole (due verdi), abeti a piani.

## Provato

App vera con i dati veri del Locarnese, senza schermo: SM 450 e Sport 1000 RR in strada, case con finestre e persiane, nessun errore.

## Limiti

- Moto e piloti sono generati dal codice: molto meglio dei cubi, non al livello di un gioco commerciale.
- Prestazioni con i nuovi alberi da misurare sui computer di Simone.
- In Unreal per ora c'è solo la SM 450 3D; case e alberi sono ancora solo nell'anteprima.
