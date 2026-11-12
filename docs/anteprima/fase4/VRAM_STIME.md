# Memoria video (VRAM) per profilo — STIME, non misure

**Nessuno di questi numeri è stato misurato su una scheda video vera.** In questo ambiente non c'è nessuna GPU
(solo grafica software, SwiftShader), quindi `nvidia-smi` non esiste. I valori sono **calcolati** dalle dimensioni delle
immagini e dei buffer. Per misurare la VRAM vera sul tuo PC: vedi `REPORT_FASE4.md`, sezione "Come provarlo sul tuo PC".

## Cosa è misurato e cosa è calcolato

| Voce | Origine |
|---|---|
| Dimensioni di immagini (foto 2 m: 1000×1000 px, tasselli HD: 1024×1024 px) | **misurate** sui file (`PIL`) |
| Memoria delle texture della scena (39 MB) | **calcolata** dal gioco: larghezza × altezza × 4 byte × 1,33 (mipmap) per ogni texture caricata (`misura_fotogrammi.mjs`); le 4 foto da 2 m e i tasselli HD sono incluse solo se già caricate in quel momento |
| Numero di pezzi di foto 2 m caricati per profilo | **stima geometrica**: area del cerchio di raggio *r* ÷ area di un pezzo (4 km²); il contatore vero è `window.__mrw.eventiStreaming` / `terrenoMesh.fotoCaricate` |
| Buffer del post-processing, ombre | **stima** da formula (vedi sotto) |
| VRAM totale usata dal driver | **non misurata**: `benchmark_profili.mjs --gpu` la legge con `nvidia-smi` sul PC dell'utente |

## Formule

- Foto aerea 2 m (un pezzo = 2 × 2 km = 1000 × 1000 px): 1000 × 1000 × 4 × 1,33 ≈ **5,3 MB** (RGBA8 + mipmap).
- Tassello HD 0,5 m (500 m + margine = 1024 × 1024 px): 1024² × 4 × 1,33 ≈ **5,6 MB**. Se ne tengono al massimo 4 (blocco 2×2) più quelli in uscita: ≈ **22–34 MB**.
- Ombre (shadow map, profondità 32 bit): 2048² × 4 = **16 MB** (Media), 4096² × 4 = **64 MB** (Alta, Ultra). Bassa: nessuna ombra.
- Post-processing HDR (Media, Alta, Ultra; non in Bassa): bersaglio MSAA 4× half-float + profondità + bersagli AO/bloom a mezza risoluzione ≈ **60 byte per pixel** → 1920×1080 ≈ 125–135 MB; a 3840×2160 ≈ 500 MB. La risoluzione interna dipende dal profilo (`pixel`: 0,75 / 1,0 / 1,5 / nativa).
- Texture della scena (asfalto, facciate, moto, segnali, nuvole, ecc.): **39 MB** (calcolato dalle immagini).
- Geometrie (terreno, edifici, strade, alberi): non stimate qui. Il gioco ne ha 700–750 caricate alla volta nella mappa di prova da 4 × 4 km; con la mappa grande edifici e strade si costruiscono a pezzi vicino alla moto (codice del ramo "Ticino completo").

## Pezzi di foto 2 m: prima e dopo

Prima della Fase 4 il raggio era `visibilità + 1,5 km` e la foto si toglieva oltre `raggio + 3 km`: Ultra arrivava a caricare fino a tutta la mappa.
Ora ogni profilo ha il suo raggio (`raggioFoto2m` in `impostazioni.js`); la foto si toglie oltre `raggio + 1,5 km`; si caricano i pezzi più vicini per primi, al massimo 2 alla volta.

Pezzi (stima = π r² / 4 km²), mappa grande 16 × 32 km (128 pezzi in tutto):

| Profilo | Raggio nuovo | Pezzi a regime | Foto 2 m (stima) | Picco in movimento (r + 1,5 km) | Prima (raggio vecchio, scarico +3 km) |
|---|---|---|---|---|---|
| Bassa | 3 000 m | ≈ 7 | ≈ 38 MB | ≈ 16 pezzi ≈ 85 MB | raggio 5 000 → ≈ 50 pezzi di picco ≈ 265 MB |
| Media | 4 500 m | ≈ 16 | ≈ 85 MB | ≈ 28 pezzi ≈ 150 MB | raggio 8 500 → ≈ 100 pezzi di picco ≈ 530 MB |
| Alta | 6 000 m | ≈ 28 | ≈ 150 MB | ≈ 44 pezzi ≈ 235 MB | raggio 10 500 → ≈ 128 pezzi ≈ 680 MB |
| Ultra | 8 000 m | ≈ 50 | ≈ 265 MB | ≈ 71 pezzi ≈ 375 MB | raggio 12 500 → ≈ 128 pezzi ≈ 680 MB |

Oltre il raggio il terreno usa i colori calcolati (vertex colors) invece della foto: a quella distanza è dentro la nebbia di distanza.

## Totale stimato per profilo (1920 × 1080, mappa grande, moto ferma o in marcia)

| Profilo | Foto 2 m | Foto HD | Ombre | Post-processing | Texture scena | **Totale stimato** |
|---|---|---|---|---|---|---|
| Bassa | 38–85 MB | 0 | 0 | 0 | 39 MB | **≈ 80–125 MB** |
| Media | 85–150 MB | ≈ 25 MB | 16 MB | ≈ 130 MB | 39 MB | **≈ 300–360 MB** |
| Alta | 150–235 MB | ≈ 30 MB | 64 MB | ≈ 130 MB (×1,5² a risoluzione interna 1,5) | 39 MB | **≈ 400–600 MB** |
| Ultra (nativo 1080p) | 265–375 MB | ≈ 34 MB | 64 MB | ≈ 130 MB | 39 MB | **≈ 540–650 MB** |
| Ultra a 3840 × 2160 | 265–375 MB | ≈ 34 MB | 64 MB | ≈ 500 MB | 39 MB | **≈ 900–1 000 MB** |

Alta ha `pixel: 1.5`: il bersaglio del post-processing è fino a 2,25 volte più grande (≈ 290 MB invece di 130 MB), per questo l'intervallo è ampio.
Le geometrie (terreno, edifici, strade, alberi) non sono nella tabella: sono la parte che i test non stimano.

## Dati della mappa grande (RAM, non VRAM)

Dato che serve per decidere quanto costa tenere in memoria la mappa 16 × 32 km:
- Terreno: 4 065 × 8 129 punti ≈ **63 MB** in `Uint16`; il gioco li converte in `Float32Array` ≈ **126 MB** di RAM (calcolo da dimensioni, non misurato).
- Maschera dei boschi: ≈ **32 MB**.
