# Sprint H1 – Mappa fino a Tenero, gallerie sotto terra, foto aeree

Data: 6 novembre 2026 · Release: 0.8.0

## Richieste di Simone

- "Da Google Maps guarda dall'alto come è fatto per rifarlo uguale."
- "La galleria passa sopra la strada e si bugga tutto."
- "Fai che va anche a Tenero ecc."

## Decisioni

- **Google Maps non si usa** (dati e immagini protetti; anche il documento iniziale lo vieta).
  Al suo posto: **SWISSIMAGE di swisstopo**, foto aeree della Svizzera, Open Government Data: si possono usare e modificare anche in un gioco, citando la fonte.
- Area dell'anteprima: **Locarnese 16 × 12 km** (est 2'696–2'712 km, nord 1'110–1'122 km): Locarno, Muralto, Minusio, Tenero, Gordola, Ascona, Losone, Ponte Brolla, Tegna, Verscio, Orselina, Brione, Cardada, Cimetta.
- Il settore pilota 8 × 8 km resta per Unreal (opzione `--pilota`); l'anteprima usa la nuova opzione `--anteprima`.

## Compiti

1. Script: opzione `--anteprima` nei passi 1, 2, 3, 6, 7; griglia non quadrata.
2. Gallerie: almeno **7 m** di terreno sopra, con rampe di 80 m agli ingressi; profilo liscio.
3. Passo 8: foto aeree SWISSIMAGE a 2 m, una foto JPEG per ogni pezzo di terreno da 2 × 2 km.
4. Gioco: terreno non quadrato, foto aeree sul terreno, pezzi dettagliati creati solo vicino alla moto (meno memoria), minimappa con le proporzioni giuste, test prestazioni anche su Tenero.

## Prove

- Area di prova 16 × 12 km con il terreno vero del pilota: 48 pezzi, le foto di prova finiscono nel pezzo giusto e con il nord in alto.
- Gallerie: agli ingressi la strada esce al livello del terreno; dentro la montagna resta sotto (Mappo-Morettina in media molto sotto la superficie).

## Definition of Done

- [ ] Release 0.8.0 con dati veri dell'area 16 × 12 km e foto aeree.
- [ ] Controllo visivo con i dati veri.
- [ ] Simone conferma Tenero e la galleria.
