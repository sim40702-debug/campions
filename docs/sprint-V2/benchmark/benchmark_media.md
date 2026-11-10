# Benchmark MRW Anteprima 0.14.1

- Scheda video: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (Google Inc. (Google))  **(grafica software!)**
- Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36
- CPU core: 4, finestra 640x360, pixel ratio 1, qualita': media
- Caricamento: 7.87 s, data 2026-11-10T18:06:11.255Z
- ATTENZIONE: grafica emulata via software (CPU), gli FPS NON rappresentano una scheda video vera: servono solo per confronti tra versioni sulla stessa macchina.

| Scenario | FPS medi | FPS min | 1% low | ms medio | ms p95 | ms p99 | Triangoli | Chiamate | Memoria JS MB |
|---|---|---|---|---|---|---|---|---|---|
| Centro storico di Locarno | 7.73 | 1.77 | 1.77 | 129.31 | 564.5 | 564.5 | 2664742 | 474 | 1195.9 |
| Lungolago | 0.59 | 0.14 | 0.14 | 1684.29 | 7249.8 | 7249.8 | 2100850 | 238 | 384.5 |
| Area residenziale | 0.19 | 0.06 | 0.06 | 5256.94 | 15605.3 | 15605.3 | 1891638 | 159 | 396.7 |
| Zona industriale | 0.27 | 0.04 | 0.04 | 3739.54 | 24151.5 | 24151.5 | 3495836 | 974 | 369.4 |
| Zona montana | 0.41 | 0.07 | 0.07 | 2460.2 | 13835.1 | 13835.1 | 1644298 | 306 | 373.3 |
| Vista panoramica della citta' | 0.23 | 0.09 | 0.09 | 4346.1 | 11228.1 | 11228.1 | 3170842 | 687 | 373.1 |
| Notte | 0.28 | 0.1 | 0.1 | 3618.22 | 9642.9 | 9642.9 | 2742484 | 594 | 377.6 |
| Pioggia (citta') e neve (montagna) | 0.19 | 0.08 | 0.08 | 5211.54 | 12468.7 | 12468.7 | 2436282 | 454 | 376.9 |
| Pioggia (citta') e neve (montagna) (seconda fase) | 0.16 | 0.06 | 0.06 | 6101.13 | 16728.3 | 16728.3 | 920698 | 52 | 404.7 |

Errori in console: nessuno
