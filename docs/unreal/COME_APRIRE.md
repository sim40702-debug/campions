# Aprire e provare il progetto Unreal (Windows e Mac)

## Da installare (una volta sola)

- **Unreal Engine 5.8** dall'Epic Games Launcher (60–100 GB, meglio su SSD).
- **Windows**: Visual Studio 2022 Community con "Sviluppo di giochi con C++", "Sviluppo di applicazioni desktop con C++" e l'ultimo Windows SDK.
- **Mac**: Xcode dall'App Store (aprirlo una volta per accettare la licenza).

## Prima apertura

1. Scarica il repository (Code → Download ZIP, oppure Git).
2. Cartella `unreal/MotoRacingWorld`:
   - Windows: clic destro su `MotoRacingWorld.uproject` → **Generate Visual Studio project files**.
   - Mac: clic destro → **Services → Generate Xcode Project** (oppure apri direttamente il .uproject).
3. Doppio clic su `MotoRacingWorld.uproject` → alla domanda sui moduli rispondi **Sì** (compila il C++).
   La prima volta servono 20–60 minuti tra compilazione e shader: chiudi gli altri programmi.
4. Nell'editor: **Tools → Execute Python Script** →
   1. `Content/Python/mrw_scarica_dati.py` (scarica il Locarnese nella cartella `Dati`, circa 35 MB)
   2. `Content/Python/mrw_crea_livello.py` (crea la mappa, il cielo, i materiali e il terreno)
   3. `Content/Python/mrw_importa_moto.py` (importa la moto 3D MRW SM 450 dalla cartella `ImportMoto`)
5. Premi **Play**.

## Comandi

| Tasto | Controller | Cosa fa |
|---|---|---|
| W / freccia su | grilletto destro | gas |
| S / freccia giù | grilletto sinistro | freno anteriore |
| Spazio | X (Xbox) / quadrato | freno posteriore |
| A D / frecce | levetta sinistra | piega |
| Shift | levetta sinistra indietro | peso dietro (impennata) |
| I | – | controllo impennata acceso/spento |
| C | Y / triangolo | telecamera 1ª / 3ª persona |
| R | View / Share | riparti sulla strada |
| T | – | avanti di un'ora |
| P | – | pioggia sì/no |
| 1 2 3 4 5 | – | grafica LOW, MEDIUM, HIGH, ULTRA, CINEMATIC |

## Se qualcosa non va

Manda a Claude:
- il testo dell'errore (finestra di compilazione, oppure **Window → Output Log**, cerca le righe con `[MRW]` o `error`);
- oppure il file più recente in `unreal/MotoRacingWorld/Saved/Logs/`.

Per misurare gli FPS: durante il gioco premi il tasto `ò`/`\`` (console) e scrivi `stat fps` oppure `stat unit`.

## La moto 3D (MRW SM 450)

Il modello nasce dai disegni di Simone ed e' generato con Blender dallo script `tools/moto/crea_moto_450.py`
(5 pezzi: telaio, forcellone, sterzo, ruota dietro, ruota davanti). Per rigenerarlo dopo una modifica:

    pip install bpy
    python3 tools/moto/crea_moto_450.py --foto cartella_per_le_foto

Se in Unreal la moto risulta girata, cambia `Correzione Modello` nei dettagli della moto (per esempio Yaw 90 o 180).
