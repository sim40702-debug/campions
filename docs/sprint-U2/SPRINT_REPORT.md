# Sprint U2 – Unreal: città, alberi, fisica come nell'anteprima

Richiesta di Simone: "fai la fisica migliore realistica e aumenta la grafica di tutto, quando lo compilo lo vorrei perfetto".

## Scritto (non compilato: Unreal non gira in questo ambiente)

- `AMRWEdifici`: tutti gli edifici del Locarnese da `Dati/edifici.json`, muri con finestre (persiane verdi, finestre moderne,
  capannoni) su texture disegnate dal codice, tetti di coppi / piatti / a punta (campanili), timpani, collisioni dei muri.
- `AMRWAlberi`: alberi nei boschi (`Dati/bosco.bin`) in celle da 250 m vicino alla moto, latifoglie e abeti sopra i 1100 m,
  niente alberi a meno di 3.5 m dalle strade; mesh da `tools/moto/crea_alberi.py`.
- `AMRWTerreno`: `BoscoQui`, `VicinoAStrada` (griglia veloce delle strade).
- `AMRWMoto`: derapata con il freno dietro, aderenza che si perde solo insistendo (come l'anteprima 0.13.1),
  soglie di caduta piu' alte, sospensioni (affondamento in frenata), pilota 3D che vola via nella caduta e torna sulla moto.
- Script: materiale `M_MRW_Edificio`, post-processing (esposizione, bloom, vignetta, AO, motion blur), import degli alberi.

## Da fare sul PC di Simone

Compilare, lanciare i tre script (`mrw_scarica_dati`, `mrw_crea_livello`, `mrw_importa_moto`), Play, misurare gli FPS (`stat fps`).
