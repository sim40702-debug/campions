# Benchmark MRW Anteprima 0.15.2

- Scheda video: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (Google Inc. (Google))  **(grafica software!)**
- Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) MOTORACINGWORLD-Ticinocompleto/0.16.0-ticino.1 Chrome/130.0.6723.191 Electron/33.4.11 Safari/537.36
- CPU core: 2, finestra 800x600, pixel ratio 1, qualita': media
- Caricamento: 44.63 s, data 2026-11-12T17:03:37.115Z
- ATTENZIONE: grafica emulata via software (CPU), gli FPS NON rappresentano una scheda video vera: servono solo per confronti tra versioni sulla stessa macchina.

| Scenario | FPS medi | FPS min | 1% low | ms medio | ms p95 | ms p99 | Triangoli | Chiamate | Memoria JS MB |
|---|---|---|---|---|---|---|---|---|---|
| Centro storico di Locarno | 0.14 | 0.06 | 0.06 | 7358.9 | 16977.2 | 16977.2 | 3789583 | 1879 | 463.3 |
| Lungolago | 0.19 | 0.14 | 0.14 | 5130.5 | 7378.2 | 7378.2 | 3734276 | 881 | 425 |
| Area residenziale | 0.19 | 0.16 | 0.16 | 5318.62 | 6091.7 | 6091.7 | 3800179 | 969 | 419.5 |
| Zona industriale | 0.19 | 0.17 | 0.17 | 5361.73 | 5944.7 | 5944.7 | 3945593 | 987 | 416.4 |
| Zona montana | 0.25 | 0.16 | 0.16 | 3949.87 | 6176.4 | 6176.4 | 3077511 | 321 | 443 |
| Vista panoramica della citta' | 0.19 | 0.15 | 0.15 | 5201.82 | 6804 | 6804 | 3589180 | 710 | 429.9 |
| Notte | 0.22 | 0.18 | 0.18 | 4528.52 | 5685.6 | 5685.6 | 3081201 | 580 | 404.7 |
| Pioggia (citta') e neve (montagna) | 0.22 | 0.18 | 0.18 | 4483.5 | 5582.8 | 5582.8 | 3078647 | 572 | 405.9 |
| Pioggia (citta') e neve (montagna) (seconda fase) | 0.3 | 0.22 | 0.22 | 3354.28 | 4547.8 | 4547.8 | 3113395 | 606 | 444.9 |