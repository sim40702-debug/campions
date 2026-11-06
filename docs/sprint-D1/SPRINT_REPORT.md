# Sprint D1 – Report

Stato: **in attesa della prova di Simone** (tutto il resto è fatto).

## Fatto

- Passo 2: scarica edifici, boschi e alberi singoli del pilota.
- Passo 7: esporta edifici, mappa dei boschi e alberi.
- Anteprima: edifici (muri e tetti, colori ticinesi, tetti a tegole per case e chiese), alberi nei boschi vicino alla moto, colore del bosco sul terreno, alberi singoli, parapetti sui ponti, collisioni con gli edifici.
- Release **0.2.0** e **0.2.1** per Mac e Windows con i dati veri.

## Dati veri del pilota (workflow GitHub, 6 novembre 2026)

| Dato | Valore |
|---|---|
| Edifici scaricati da OSM | 14'431 |
| Edifici nel gioco (dopo i controlli) | 14'127 |
| Bosco mappato in OSM | 24,6 km² (38 % del pilota) |
| Alberi singoli | 454 |

Gli edifici scartati (circa 300) sono troppo piccoli (meno di 6 m²), hanno il centro fuori dal pilota o una forma non valida.

## Controllo visivo con i dati veri (app Electron)

- Edifici appoggiati sul terreno, né sotto né sospesi: **OK**.
- Alberi solo nei boschi, non sulle strade né dentro gli edifici: **OK**.
- Via Borghese (città vecchia di Locarno) è una via stretta tra le case: corrisponde alla realtà.
- **Bug trovato e corretto**: con la telecamera alta, girando, la telecamera entrava nei muri (BUG-003, chiuso in 0.2.1).

## Note

- Il bosco viene da OpenStreetMap: dove OSM non ha disegnato il bosco, nel gioco non ci sono alberi. Più avanti si può usare swissTLM3D di swisstopo, che è più completo.
- Le altezze degli edifici: quando OSM non le dice, sono stimate dal tipo di edificio (per esempio casa 2 piani, palazzo 4 piani).

## Release

| Versione | Contenuto |
|---|---|
| 0.2.0 | Edifici, boschi, alberi, parapetti, collisioni |
| 0.2.1 | Telecamera fuori dai muri (BUG-003) |
| 0.3.0 | Pulsante "Aggiorna" nell'app (richiesta di Simone, TI-26) |

## Aggiunta durante lo Sprint (richiesta del Product Owner)

Pulsante "Aggiorna" (TI-26): controlla l'ultima release su GitHub, scarica il file giusto per il computer (Mac chip Apple o Intel, Windows installazione o portatile) e lo installa.
Prove fatte: confronto delle versioni (5 casi), controllo su GitHub e download completo con barra di avanzamento nell'app Electron.
Non provato qui: la sostituzione dell'app su Mac (`hdiutil` e `ditto` esistono solo su Mac) e l'installer su Windows. Da confermare con il primo aggiornamento vero (0.3.0 -> 0.3.1).
