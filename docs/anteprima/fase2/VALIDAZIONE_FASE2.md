# Fase 2: validazione su dati veri

## Dati usati (nessun dato di prova)
Pipeline di produzione `tools/geo` eseguita davvero (copia di lavoro con l'area ridotta a 4 x 4 km di Locarno-Muralto, E 2'702'000-2'706'000, N 1'112'000-1'116'000, perche' l'area intera 16 x 32 km richiede molto piu' tempo):
- passo 1: swissALTI3D 2 m, 62 tasselli scaricati dal catalogo STAC di swisstopo (veri);
- passo 2: OpenStreetMap da Overpass (`overpass.osm.ch`, perche' `overpass-api.de` non e' raggiungibile da questo ambiente);
- passi 3, 7, 8: terreno, strade/edifici/dettagli, foto aeree SWISSIMAGE 2024 (2 m/pixel).
Risultato: 858 strade (124,5 km), 7016 edifici, 285 strisce pedonali, 24 semafori, 69 stop, 90 precedenze, 22 pezzi di rotonda, quote vere 193-1180 m.
I campi nuovi del passo 7 (`l` corsie: 342 strade; `o` senso unico: 271) funzionano.
I file di OpenStreetMap non sono nel repository. Tutti gli screenshot qui sotto vengono da questi dati.

## Rete stradale (`tools/anteprima_prova/valida_rete.mjs`, rapporto in `rapporto_rete.json`)
| Controllo | Esito |
|---|---|
| Strade per tipo | 554 residential, 90 secondary, 66 primary, 44 living_street, 43 tertiary, 40 unclassified, 12 trunk/link, 9 link |
| Capi di strada collegati | 1579 su 1716. I 137 senza collegamento: 108 residential + 13 living_street (strade senza uscita) e capi tagliati dal bordo dell'area (x = +-2000), che non sono errori |
| Geometrie doppie | 4 casi, tutti legittimi: gallerie A13 / Mappo-Morettina sotto Via Rovedo (livelli diversi) e un raccordo primary_link affiancato alla 13 |
| Scalini di quota ai nodi condivisi (stesso livello) | 0 (la prima versione del controllo segnalava 3 casi: erano incroci tra galleria e strada sopra, controllo corretto) |
| Pendenza massima | 23 %, nessun tratto oltre il 25 % |
| Strada sotto il terreno oltre 50 cm | 0 |
| Strada sopra il terreno oltre 1 m | 136 punti su 17102 (0,8 %), fino a 10 m: rampe e tratti su pendio vicino a gallerie e viadotti non marcati come ponte (Via ai Monti, A13, la 13). Da guardare nel gioco |
| Incroci (nodi con 3+ bracci) | 502: 420 a 3 bracci, 79 a 4, 3 a 5 |
| Raccordi circolari costruiti | 959; 421 incroci su 502 ne hanno almeno uno (prima del tratto "dritto per scarto laterale": 903 e 403) |
| Angoli senza raccordo | 430 quasi allineati o troppo stretti (normale: strada che prosegue, biforcazioni), 183 raccordi troppo corti per la geometria vicina, 19 con il raccordo dietro al nodo |
| Rotonde | 22 pezzi, 6 isole spartitraffico, 24 linee di precedenza |

Non e' stato possibile controllare automaticamente: buchi nell'asfalto, marciapiedi sospesi, sovrapposizioni di nastri alla stessa quota. Le immagini aeree non ne mostrano, ma non e' una prova.

## Prestazioni (`tools/anteprima_prova/misura_fotogrammi.mjs`, qualita' Media, 800 x 450, dati veri)
Confronto tra la versione di partenza (commit dd513fd, 0.15.0) e questa.
| Scena | Chiamate | Triangoli | ms/fotogramma (software) |
|---|---|---|---|
| Centro (Piazza Castello) | 575 -> 643 | 1,52 M -> 1,72 M | 1485 -> 1660 (+12 %) |
| Via G. A. Orelli (strada principale) | 758 -> 820 | 1,45 M -> 1,67 M | 1615 -> 1531 (-5 %, rumore) |
| Collina (Via del Tiglio) | 235 -> 304 | 2,63 M -> 2,84 M | 1365 -> 1659 (+22 %) |
- I millisecondi sono quelli della grafica SOFTWARE (SwiftShader) e valgono solo come confronto tra due versioni sulla stessa macchina: non sono gli FPS di una scheda video. Il costo in piu' sta soprattutto nei passaggi a schermo intero (AO, bagliore, immagine finale).
- Chiamate +60-70 (passaggi della post-elaborazione e tombini): irrilevanti per una GPU. Triangoli +8-15 % (raccordi, cordoli, isole, tombini).
- Programmi grafici 42 -> circa 80: si compilano tutti durante il caricamento, non durante la guida.
- Texture delle scene: 39 MB nelle due versioni (stima, non include le foto aeree ne' i buffer di disegno).
- Memoria nuova (stima, non misurata): buffer HDR con anti-aliasing 4x + profondita' ~125 MB a 1920 x 1080, ~500 MB a 4K (qualita' Ultra). Il costo piu' grande della nuova grafica sulle schede video con poca memoria.
- Non misurato: qualita' Bassa (la post-elaborazione e' spenta, dovrebbe essere vicina alla versione di partenza), Alta e Ultra, e qualsiasi FPS su una GPU vera.

## Cosa resta incompleto
- Foto aeree a 2 m/pixel: da vicino il terreno e' sfocato (un pixel = 2 m). Servirebbe una foto piu' fine solo attorno alla moto (passo 8 con 0,5-1 m per il pezzo vicino).
- Frecce direzionali e corsie di svolta: non nei dati OSM (`turn:lanes`), non disegnate.
- Facciate, vegetazione, lampioni, cielo: nella fase 2 solo il piano terra delle facciate (zoccolo scuro e patina per campata, poco visibile); il resto e' invariato rispetto alla fase 1.
- Bordo dell'asfalto senza cordolo (strade fuori dal centro): nessun trattamento nuovo.
- Area intera 16 x 32 km: non eseguita (solo 4 x 4 km di Locarno-Muralto).

## Da provare sul tuo computer
FPS reali su GPU vera a tutte le qualita' (soprattutto Ultra 4K per la memoria), il passo 8 e il caricamento sull'area completa della Valle Verzasca, il giro in moto sugli incroci (fisica e collisioni non sono state toccate, ma non e' stato fatto un giro vero), i 136 punti di strada alta sul terreno, e il look generale con foto aeree a distanza ravvicinata.
