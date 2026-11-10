# Benchmark MRW Anteprima 0.14.1

- Scheda video: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) (Google Inc. (Google))  **(grafica software!)**
- Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36
- CPU core: 4, finestra 640x360, pixel ratio 0.75, qualita': bassa
- Caricamento: 7.96 s, data 2026-11-10T18:12:24.729Z
- ATTENZIONE: grafica emulata via software (CPU), gli FPS NON rappresentano una scheda video vera: servono solo per confronti tra versioni sulla stessa macchina.

| Scenario | FPS medi | FPS min | 1% low | ms medio | ms p95 | ms p99 | Triangoli | Chiamate | Memoria JS MB |
|---|---|---|---|---|---|---|---|---|---|
| Centro storico di Locarno | 7.15 | 2.35 | 2.35 | 139.91 | 425.9 | 425.9 | 2341660 | 405 | 1192.4 |
| Lungolago | 0.74 | 0.19 | 0.19 | 1349.46 | 5328.2 | 5328.2 | 2065874 | 320 | 406.2 |
| Area residenziale | 0.29 | 0.07 | 0.07 | 3508.44 | 13915.9 | 13915.9 | 3015358 | 621 | 407.8 |
| Zona industriale | 0.25 | 0.09 | 0.09 | 3970.45 | 11136.6 | 11136.6 | 2483010 | 868 | 427.1 |
| Zona montana | 0.25 | 0.1 | 0.1 | 3985.75 | 10473.7 | 10473.7 | 1211726 | 155 | 365 |
| Vista panoramica della citta' | 0.6 | 0.24 | 0.24 | 1673.69 | 4245.1 | 4245.1 | 2505240 | 444 | 409.1 |
| Notte | 0.48 | 0.16 | 0.16 | 2074.08 | 6445.2 | 6445.2 | 2724616 | 739 | 409.2 |
| Pioggia (citta') e neve (montagna) | 0.22 | 0.08 | 0.08 | 4571.57 | 11917.9 | 11917.9 | 2338572 | 531 | 408.7 |
| Pioggia (citta') e neve (montagna) (seconda fase) | 0.22 | 0.07 | 0.07 | 4579.96 | 14016.6 | 14016.6 | 2524564 | 394 | 364.3 |

Errori in console: nessuno
