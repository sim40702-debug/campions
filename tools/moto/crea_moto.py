# Crea i modelli 3D di tutte le altre moto del garage (disegni originali MRW) con Blender.
# La SM 450 (disegno di Simone) ha il suo script: crea_moto_450.py.
#
# Uso (serve il modulo Python "bpy" oppure Blender 4+):
#   python3 tools/moto/crea_moto.py                      -> tutte le moto
#   python3 tools/moto/crea_moto.py sm690 naked890       -> solo alcune
#   python3 tools/moto/crea_moto.py --foto cartella      -> anche un'immagine di prova per ogni moto
#
# Per ogni moto escono 6 pezzi .glb (Telaio, Forcellone, Sterzo, RuotaPosteriore, RuotaAnteriore, Pilota)
# in anteprima/modelli, piu' un file .json con le misure che servono al gioco (passo, ruote, bacino).
# Misure in metri. X = avanti, Y = sinistra, Z = su. Perno della ruota dietro a X = 0.

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crea_moto_450 as base   # forme di base (cilindro, tubo, pannello...) e materiali comuni

CARTELLA = Path(__file__).resolve().parents[2] / "anteprima" / "modelli"

# ------------------------------------------------------------------ le moto
# corpo: forma della carrozzeria. pilota: posizione (bacino, spalle, mani, piedi) decisa dal corpo.
MOTO = {
    "sm690": {
        "corpo": "supermotard", "passo": 1.48, "rDav": 0.31, "rDie": 0.31, "inclinazione": 27,
        "cerchio": "raggi", "gomma": "strada", "motore": "mono", "scarichi": 1, "numero": "690",
        "carena": (0.85, 0.85, 0.86), "grafica": (0.6, 0.03, 0.04), "telaio": (0.75, 0.75, 0.77), "forcella": "nero",
        "tuta": (0.03, 0.03, 0.035), "tuta2": (0.6, 0.03, 0.04), "casco": (0.85, 0.85, 0.86),
    },
    "strada700": {
        "corpo": "stradale", "passo": 1.45, "rDav": 0.31, "rDie": 0.32, "inclinazione": 26,
        "cerchio": "lega", "gomma": "strada", "motore": "bi", "scarichi": 1, "numero": "",
        "carena": (0.12, 0.22, 0.15), "grafica": (0.7, 0.6, 0.4), "telaio": (0.08, 0.08, 0.09), "forcella": "argento",
        "tuta": (0.18, 0.13, 0.09), "tuta2": (0.05, 0.05, 0.05), "casco": (0.12, 0.22, 0.15),
    },
    "naked890": {
        "corpo": "naked", "passo": 1.42, "rDav": 0.31, "rDie": 0.32, "inclinazione": 25,
        "cerchio": "lega", "gomma": "strada", "motore": "bi", "scarichi": 1, "numero": "",
        "carena": (0.2, 0.22, 0.25), "grafica": (0.85, 0.6, 0.0), "telaio": (0.85, 0.6, 0.0), "forcella": "oro",
        "tuta": (0.03, 0.03, 0.035), "tuta2": (0.85, 0.6, 0.0), "casco": (0.2, 0.22, 0.25),
    },
    "sport1000": {
        "corpo": "sportiva", "passo": 1.40, "rDav": 0.31, "rDie": 0.32, "inclinazione": 23.5,
        "cerchio": "lega", "gomma": "strada", "motore": "quattro", "scarichi": 1, "numero": "1",
        "carena": (0.04, 0.16, 0.5), "grafica": (0.9, 0.9, 0.9), "telaio": (0.6, 0.6, 0.62), "forcella": "oro",
        "tuta": (0.04, 0.16, 0.5), "tuta2": (0.9, 0.9, 0.9), "casco": (0.9, 0.9, 0.9),
    },
    "enduro450": {
        "corpo": "enduro", "passo": 1.48, "rDav": 0.37, "rDie": 0.35, "inclinazione": 27,
        "cerchio": "raggi", "gomma": "tassellata", "motore": "mono", "scarichi": 1, "numero": "45",
        "carena": (0.03, 0.08, 0.3), "grafica": (0.85, 0.85, 0.85), "telaio": (0.15, 0.15, 0.17), "forcella": "oro",
        "tuta": (0.03, 0.08, 0.3), "tuta2": (0.85, 0.85, 0.85), "casco": (0.03, 0.08, 0.3),
    },
    "scooter125": {
        "corpo": "scooter", "passo": 1.33, "rDav": 0.24, "rDie": 0.24, "inclinazione": 28,
        "cerchio": "lega", "gomma": "strada", "motore": "scooter", "scarichi": 1, "numero": "",
        "carena": (0.35, 0.7, 0.6), "grafica": (0.9, 0.9, 0.9), "telaio": (0.1, 0.1, 0.1), "forcella": "nero",
        "tuta": (0.1, 0.12, 0.2), "tuta2": (0.25, 0.25, 0.28), "casco": (0.9, 0.9, 0.9),
    },
}

PEZZI = ["Telaio", "Forcellone", "Sterzo", "RuotaPosteriore", "RuotaAnteriore", "Pilota"]


# ------------------------------------------------------------------ ruote

def ruota(nome, centro, r_esterno, larghezza, gruppo, cfg, davanti):
    cx, cy, cz = centro
    r_cerchio = r_esterno - (0.075 if cfg["corpo"] != "scooter" else 0.07)
    # gomma (toro schiacciato)
    bpy.ops.mesh.primitive_torus_add(major_radius=(r_esterno + r_cerchio) / 2, minor_radius=(r_esterno - r_cerchio) / 2,
                                     major_segments=96, minor_segments=24, location=centro, rotation=(math.radians(90), 0, 0))
    gomma = bpy.context.object
    gomma.name = nome + "_Gomma"
    gomma.scale = (1, 1, larghezza / (r_esterno - r_cerchio))
    bpy.ops.object.transform_apply(scale=True)
    base.liscia(gomma)
    base.metti(gomma, gruppo, base.GOMMA)
    if cfg["gomma"] == "tassellata":
        blocchi = []
        for i in range(64):
            a = i / 64 * math.tau
            for fila, y in enumerate([-larghezza * 0.32, 0.0, larghezza * 0.32]):
                if (i + fila) % 2 == 1 and fila != 1:
                    continue
                r = r_esterno - 0.004
                bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + math.cos(a) * r, cy + y, cz + math.sin(a) * r), rotation=(0, -a, 0))
                blocco = bpy.context.object
                blocco.scale = (0.012, larghezza * 0.26, 0.022)
                blocchi.append(blocco)
        bpy.ops.object.select_all(action="DESELECT")
        for blocco in blocchi:
            blocco.select_set(True)
        bpy.context.view_layer.objects.active = blocchi[0]
        bpy.ops.object.join()
        bpy.ops.object.transform_apply(scale=True)
        base.metti(bpy.context.object, gruppo, base.GOMMA)

    # cerchio
    bpy.ops.mesh.primitive_torus_add(major_radius=r_cerchio, minor_radius=0.012, major_segments=96, minor_segments=12,
                                     location=centro, rotation=(math.radians(90), 0, 0))
    cerchio = bpy.context.object
    cerchio.name = nome + "_Cerchio"
    cerchio.scale = (1, 1, 2.4)
    bpy.ops.object.transform_apply(scale=True)
    base.liscia(cerchio)
    colore_cerchio = base.NERO_LUCIDO if cfg["corpo"] != "naked" else base.materiale("Cerchio_" + cfg["corpo"], cfg["grafica"], 0.3, 0.3, 0.5)
    base.metti(cerchio, gruppo, colore_cerchio)
    base.cilindro(nome + "_Mozzo", (cx, cy - 0.06, cz), (cx, cy + 0.06, cz), 0.045, gruppo, base.ALLUMINIO)

    if cfg["cerchio"] == "raggi":
        for i in range(36):
            a = i / 36 * math.tau
            lato = 0.045 if i % 2 == 0 else -0.045
            p1 = (cx + math.cos(a + 0.25) * 0.04, cy + lato, cz + math.sin(a + 0.25) * 0.04)
            p2 = (cx + math.cos(a) * (r_cerchio - 0.01), cy, cz + math.sin(a) * (r_cerchio - 0.01))
            base.cilindro(nome + "_Raggio" + str(i), p1, p2, 0.0022, gruppo, base.ACCIAIO, lati=6)
    else:
        # cerchio in lega: 5 razze doppie
        for i in range(10):
            a = (i // 2) / 5 * math.tau + (0.12 if i % 2 else -0.12)
            p1 = Vector((cx + math.cos(a) * 0.05, cy, cz + math.sin(a) * 0.05))
            p2 = Vector((cx + math.cos(a) * (r_cerchio - 0.015), cy, cz + math.sin(a) * (r_cerchio - 0.015)))
            base.scatola(nome + "_Razza" + str(i), (p1 + p2) / 2, ((p2 - p1).length, 0.022, 0.018), gruppo, colore_cerchio, 0.004,
                         rotazione=(0, -a, 0))

    # dischi dei freni: davanti due per le moto stradali, uno per le altre
    doppio = davanti and cfg["corpo"] in ("naked", "stradale", "sportiva")
    lati = (1, -1) if doppio else (1,)
    r_disco = (0.155 if davanti else 0.11) if cfg["corpo"] != "scooter" else 0.11
    for lato in lati:
        y = 0.07 * lato
        base.cilindro(nome + "_Disco" + str(lato), (cx, cy + y, cz), (cx, cy + y + 0.005 * lato, cz), r_disco, gruppo, base.ACCIAIO, lati=64)
        base.cilindro(nome + "_Flangia" + str(lato), (cx, cy + y - 0.002 * lato, cz), (cx, cy + y + 0.007 * lato, cz), r_disco * 0.45, gruppo, base.NERO_LUCIDO, lati=32)


# ------------------------------------------------------------------ moto

def costruisci_moto(cfg):
    for oggetto in list(bpy.data.objects):
        bpy.data.objects.remove(oggetto)
    for gruppo in base.GRUPPI.values():
        gruppo.clear()

    corpo = cfg["corpo"]
    passo = cfg["passo"]
    dietro = Vector((0.0, 0.0, cfg["rDie"]))
    davanti = Vector((passo, 0.0, cfg["rDav"]))
    rake = math.radians(cfg["inclinazione"])
    asse = Vector((-math.sin(rake), 0.0, math.cos(rake)))
    stradale = corpo in ("naked", "stradale", "sportiva")

    CARENA = base.materiale("Carena_" + corpo, cfg["carena"], 0.0, 0.3, 1.0)
    GRAFICA = base.materiale("Grafica_" + corpo, cfg["grafica"], 0.0, 0.3, 1.0)
    TELAIO = base.materiale("Telaio_" + corpo, cfg["telaio"], 0.6, 0.3, 0.5)
    FORCELLA = {"oro": base.ORO, "nero": base.NERO_LUCIDO, "argento": base.ALLUMINIO}[cfg["forcella"]]

    # --- ruote
    larghezza_dietro = 0.18 if corpo == "sportiva" else (0.16 if stradale else (0.12 if corpo == "scooter" else 0.14))
    ruota("RuotaPosteriore", tuple(dietro), cfg["rDie"], larghezza_dietro, "RuotaPosteriore", cfg, False)
    ruota("RuotaAnteriore", tuple(davanti), cfg["rDav"], 0.12 if corpo != "scooter" else 0.1, "RuotaAnteriore", cfg, True)

    # --- altezze principali (sella, testa dello sterzo)
    altezze = {"supermotard": (0.92, 0.98), "enduro": (0.96, 1.02), "naked": (0.82, 0.9),
               "stradale": (0.8, 0.9), "sportiva": (0.84, 0.86), "scooter": (0.78, 0.8)}
    h_sella, h_testa = altezze[corpo]
    lunghezza_forcella = (h_testa - cfg["rDav"]) / math.cos(rake)
    testa = davanti + asse * lunghezza_forcella

    # --- forcellone (scooter: il motore fa da forcellone)
    perno = Vector((0.56 if corpo != "scooter" else 0.42, 0.0, cfg["rDie"] + 0.12))
    if corpo != "scooter":
        for lato in (1, -1):
            y = 0.1 * lato
            raggio_braccio = 0.03 if stradale else 0.026
            base.tubo("Forcellone_" + str(lato), [(0.0, y, cfg["rDie"]), (0.3, y, cfg["rDie"] + 0.05), (perno.x, y * 0.8, perno.z)],
                      raggio_braccio, "Forcellone", base.ALLUMINIO if corpo != "naked" else TELAIO)
        base.cilindro("CoronaPosteriore", (0, -0.085, cfg["rDie"]), (0, -0.08, cfg["rDie"]), 0.1, "Forcellone", base.ALLUMINIO, lati=48)
        base.tubo("Catena_Sopra", [(0.0, -0.083, cfg["rDie"] + 0.1), (0.66, -0.083, perno.z + 0.03)], 0.007, "Forcellone", base.ACCIAIO)
        base.tubo("Catena_Sotto", [(0.0, -0.083, cfg["rDie"] - 0.1), (0.66, -0.083, perno.z - 0.05)], 0.007, "Forcellone", base.ACCIAIO)
    else:
        base.scatola("BloccoMotoreScooter", (0.22, -0.05, cfg["rDie"] + 0.08), (0.5, 0.2, 0.2), "Forcellone", base.MOTORE, 0.06)
        base.scatola("CarterVariatore", (0.18, 0.08, cfg["rDie"] + 0.06), (0.52, 0.04, 0.18), "Forcellone", base.NERO_LUCIDO, 0.05)
        base.cilindro("Marmitta", (0.15, -0.16, cfg["rDie"] + 0.12), (-0.18, -0.16, cfg["rDie"] + 0.2), 0.045, "Forcellone", base.NERO_LUCIDO)

    # --- telaio
    if corpo in ("supermotard", "enduro"):
        for lato in (1, -1):
            y = 0.07 * lato
            base.tubo("TelaioSopra_" + str(lato), [tuple(testa + Vector((0, y * 0.5, -0.02))), (0.85, y * 1.3, h_sella - 0.06), (0.62, y * 1.4, perno.z + 0.2), (0.6, y * 1.2, perno.z - 0.05)], 0.017, "Telaio", TELAIO)
            base.tubo("TelaioSotto_" + str(lato), [tuple(testa + Vector((0, y * 0.4, -0.1))), (1.0, y, 0.5), (0.96, y, 0.22), (0.62, y, 0.3)], 0.016, "Telaio", TELAIO)
            base.tubo("Telaietto_" + str(lato), [(0.68, y * 1.3, h_sella - 0.12), (-0.12, y, h_sella - 0.02)], 0.012, "Telaio", TELAIO)
    elif corpo in ("naked", "stradale"):
        # traliccio: tubi dritti a zig-zag dalla testa dello sterzo al perno del forcellone
        punti_sopra = [testa + Vector((-0.02, 0, -0.03)), Vector((0.95, 0, h_sella - 0.05)), Vector((0.78, 0, h_sella - 0.05)), Vector((0.62, 0, h_sella - 0.1))]
        punti_sotto = [testa + Vector((0.0, 0, -0.16)), Vector((0.95, 0, 0.6)), Vector((0.78, 0, 0.55)), Vector((0.6, 0, perno.z))]
        for lato in (1, -1):
            y = Vector((0, 0.1 * lato, 0))
            for i in range(len(punti_sopra) - 1):
                base.cilindro("TralSopra" + str(lato) + str(i), punti_sopra[i] + y, punti_sopra[i + 1] + y, 0.014, "Telaio", TELAIO)
                base.cilindro("TralSotto" + str(lato) + str(i), punti_sotto[i] + y, punti_sotto[i + 1] + y, 0.014, "Telaio", TELAIO)
                base.cilindro("TralDiag" + str(lato) + str(i), punti_sopra[i] + y, punti_sotto[i + 1] + y, 0.012, "Telaio", TELAIO)
            base.tubo("Telaietto_" + str(lato), [(0.62, 0.09 * lato, h_sella - 0.1), (-0.1, 0.06 * lato, h_sella + 0.06)], 0.012, "Telaio", TELAIO)
    elif corpo == "sportiva":
        for lato in (1, -1):
            base.tubo("Longherone_" + str(lato), [tuple(testa + Vector((0, 0.05 * lato, -0.05))), (0.95, 0.15 * lato, h_sella - 0.12), (0.62, 0.12 * lato, perno.z + 0.05)], 0.035, "Telaio", TELAIO)

    # --- motore
    if cfg["motore"] == "mono":
        base.scatola("Basamento", (0.82, 0.0, 0.36), (0.3, 0.2, 0.24), "Telaio", base.MOTORE, 0.06)
        base.scatola("Cilindro", (0.9, 0.0, 0.6), (0.14, 0.15, 0.24), "Telaio", base.MOTORE, 0.02, rotazione=(0, math.radians(-12), 0))
        for i in range(6):
            base.scatola("Aletta" + str(i), (0.905 - i * 0.004, 0.0, 0.52 + i * 0.03), (0.16, 0.17, 0.008), "Telaio", base.MOTORE, 0.002, rotazione=(0, math.radians(-12), 0))
        base.scatola("Testata", (0.93, 0.0, 0.75), (0.17, 0.16, 0.09), "Telaio", base.NERO, 0.03, rotazione=(0, math.radians(-12), 0))
        for lato in (1, -1):
            base.cilindro("CoperchioRotondo_" + str(lato), (0.78, 0.1 * lato, 0.34), (0.78, 0.125 * lato, 0.34), 0.1, "Telaio", base.MOTORE, lati=48)
        collettori = [(0.99, 0.03, 0.72)]
    elif cfg["motore"] == "bi":
        base.scatola("Basamento", (0.8, 0.0, 0.38), (0.34, 0.3, 0.24), "Telaio", base.MOTORE, 0.06)
        for lato in (1, -1):
            base.scatola("Cilindro_" + str(lato), (0.92, 0.07 * lato, 0.6), (0.14, 0.12, 0.24), "Telaio", base.MOTORE, 0.02, rotazione=(0, math.radians(-25), 0))
            base.cilindro("CoperchioRotondo_" + str(lato), (0.76, 0.15 * lato, 0.36), (0.76, 0.175 * lato, 0.36), 0.1, "Telaio", base.MOTORE, lati=48)
        base.scatola("Testata", (0.98, 0.0, 0.74), (0.17, 0.28, 0.09), "Telaio", base.NERO, 0.03, rotazione=(0, math.radians(-25), 0))
        collettori = [(1.04, 0.07, 0.68), (1.04, -0.07, 0.68)]
    elif cfg["motore"] == "quattro":
        base.scatola("Basamento", (0.78, 0.0, 0.4), (0.36, 0.42, 0.26), "Telaio", base.MOTORE, 0.06)
        base.scatola("Cilindri", (0.92, 0.0, 0.62), (0.16, 0.38, 0.24), "Telaio", base.MOTORE, 0.03, rotazione=(0, math.radians(-30), 0))
        base.scatola("Testata", (0.99, 0.0, 0.76), (0.16, 0.36, 0.08), "Telaio", base.NERO, 0.03, rotazione=(0, math.radians(-30), 0))
        collettori = [(1.06, y, 0.66) for y in (0.12, 0.04, -0.04, -0.12)]
    else:
        collettori = []

    # collettori e silenziatore
    for i, partenza in enumerate(collettori):
        x, y, z = partenza
        base.tubo("Collettore" + str(i), [partenza, (x + 0.05, y * 1.2, 0.5), (x - 0.02, y * 1.1, 0.24), (0.8, y * 0.4, 0.17), (0.6, 0.0, 0.2)], 0.022, "Telaio", base.COLLETTORE)
    if corpo in ("supermotard", "enduro"):
        base.tubo("CollettoreCoda", [(0.6, 0.0, 0.2), (0.5, 0.15, 0.4), (0.42, 0.16, 0.5)], 0.024, "Telaio", base.COLLETTORE)
        base.cilindro("Silenziatore", (0.42, 0.165, 0.5), (-0.1, 0.165, h_sella - 0.14), 0.055, "Telaio", base.ALLUMINIO if corpo == "enduro" else base.NERO_LUCIDO, lati=32)
    elif corpo == "sportiva":
        base.cilindro("Silenziatore", (0.62, -0.16, 0.3), (0.28, -0.18, 0.42), 0.06, "Telaio", base.NERO_LUCIDO, lati=6)
    elif corpo in ("naked", "stradale"):
        base.cilindro("Silenziatore", (0.62, -0.15, 0.26), (0.3, -0.15, 0.32), 0.07, "Telaio", base.ALLUMINIO if corpo == "stradale" else base.NERO_LUCIDO, lati=32)

    # --- carrozzeria
    if corpo in ("supermotard", "enduro"):
        base.specchia([(0.86, h_sella + 0.03), (1.18, h_sella + 0.08), (1.17, h_sella - 0.08), (1.1, h_sella - 0.3), (0.98, h_sella - 0.36), (0.9, h_sella - 0.18)], "Convogliatore", 0.16, 0.008, "Telaio", CARENA)
        base.specchia([(0.9, h_sella - 0.07), (1.12, h_sella - 0.02), (1.08, h_sella - 0.14), (0.92, h_sella - 0.19)], "GraficaFianco", 0.168, 0.004, "Telaio", GRAFICA, suddividi=0)
        base.pannello("Serbatoio", [(0.72, h_sella + 0.02), (1.1, h_sella + 0.1), (1.12, h_sella - 0.02), (0.8, h_sella - 0.1)], -0.12, 0.12, "Telaio", CARENA, smussa=0.04)
        base.specchia([(0.18, h_sella - 0.04), (0.62, h_sella - 0.02), (0.6, h_sella - 0.26), (0.42, h_sella - 0.3), (0.25, h_sella - 0.18)], "Fianchetto", 0.13, 0.008, "Telaio", CARENA)
        base.specchia([(-0.36, h_sella + 0.08), (0.2, h_sella + 0.01), (0.4, h_sella - 0.02), (0.3, h_sella - 0.08), (-0.05, h_sella - 0.06), (-0.3, h_sella + 0.03)], "Codone", 0.11, 0.008, "Telaio", GRAFICA if corpo == "supermotard" else CARENA)
        base.pannello("Sella", [(0.15, h_sella + 0.035), (0.85, h_sella + 0.055), (0.98, h_sella + 0.07), (0.98, h_sella + 0.02), (0.2, h_sella - 0.02)], -0.125, 0.125, "Telaio", base.SELLA, smussa=0.035)
        if cfg["numero"]:
            base.scritta("Numero_S", cfg["numero"], (1.0, 0.171, h_sella - 0.04), 1, 0.07, "Telaio", base.BIANCO)
            base.scritta("Numero_D", cfg["numero"], (1.0, -0.171, h_sella - 0.04), -1, 0.07, "Telaio", base.BIANCO)
        if corpo == "enduro":
            base.scatola("ParaMotore", (0.82, 0.0, 0.18), (0.4, 0.2, 0.02), "Telaio", base.ALLUMINIO, 0.008, rotazione=(0, math.radians(8), 0))
    elif corpo in ("naked", "stradale"):
        # serbatoio grande e rotondo, sella a due posti, codino corto
        base.pannello("Serbatoio", [(0.66, h_sella + 0.06), (0.86, h_sella + 0.2), (1.08, h_sella + 0.16), (1.12, h_sella + 0.0), (0.98, h_sella - 0.1), (0.7, h_sella - 0.04)], -0.17, 0.17, "Telaio", CARENA, smussa=0.05)
        base.specchia([(0.86, h_sella + 0.1), (1.06, h_sella + 0.12), (1.08, h_sella - 0.02), (0.92, h_sella - 0.06)], "FiancoSerbatoio", 0.172, 0.006, "Telaio", GRAFICA)
        base.pannello("Sella", [(0.1, h_sella + 0.08), (0.4, h_sella + 0.06), (0.48, h_sella + 0.02), (0.7, h_sella + 0.05), (0.72, h_sella - 0.02), (0.15, h_sella - 0.0)], -0.13, 0.13, "Telaio", base.SELLA if corpo == "naked" else base.materiale("Sella_Marrone", (0.18, 0.1, 0.06), 0.0, 0.7), smussa=0.035)
        base.specchia([(-0.3, h_sella + 0.14), (0.12, h_sella + 0.06), (0.3, h_sella - 0.0), (0.05, h_sella - 0.06), (-0.25, h_sella + 0.08)], "Codino", 0.1, 0.008, "Telaio", CARENA)
        base.scatola("Radiatore", (1.1, 0.0, 0.62), (0.05, 0.36, 0.26), "Telaio", base.NERO, 0.01, rotazione=(0, math.radians(-15), 0))
    elif corpo == "sportiva":
        # carena intera: fianchi che coprono il motore, puntale, codone alto e appuntito
        base.specchia([(0.7, h_sella - 0.08), (1.25, h_sella + 0.02), (1.32, h_sella - 0.12), (1.15, 0.32), (0.75, 0.2), (0.6, 0.35)], "FiancoCarena", 0.2, 0.008, "Telaio", CARENA)
        base.specchia([(0.75, 0.42), (1.15, 0.5), (1.12, 0.36), (0.8, 0.3)], "GraficaCarena", 0.208, 0.004, "Telaio", GRAFICA, suddividi=0)
        base.pannello("Puntale", [(1.15, h_sella - 0.12), (1.42, h_sella - 0.02), (1.38, h_sella + 0.1), (1.22, h_sella + 0.2), (1.1, h_sella + 0.06)], -0.19, 0.19, "Telaio", CARENA, smussa=0.05)
        base.pannello("Cupolino", [(1.08, h_sella + 0.14), (1.26, h_sella + 0.22), (1.24, h_sella + 0.26), (1.06, h_sella + 0.18)], -0.15, 0.15, "Telaio", base.materiale("Plexiglass", (0.15, 0.2, 0.25), 0.2, 0.05, 1.0), smussa=0.01)
        for lato in (1, -1):
            base.scatola("Faro_" + str(lato), (1.4, 0.08 * lato, h_sella + 0.0), (0.03, 0.08, 0.04), "Telaio", base.VETRO, 0.01, rotazione=(0, math.radians(-30), 0))
        base.pannello("Serbatoio", [(0.62, h_sella + 0.06), (0.8, h_sella + 0.16), (1.04, h_sella + 0.14), (1.08, h_sella - 0.02), (0.7, h_sella - 0.02)], -0.15, 0.15, "Telaio", CARENA, smussa=0.05)
        base.pannello("Sella", [(0.35, h_sella + 0.06), (0.66, h_sella + 0.05), (0.64, h_sella - 0.0), (0.35, h_sella + 0.0)], -0.12, 0.12, "Telaio", base.SELLA, smussa=0.03)
        base.pannello("Codone", [(-0.25, h_sella + 0.2), (0.36, h_sella + 0.07), (0.38, h_sella - 0.02), (0.0, h_sella - 0.0), (-0.22, h_sella + 0.14)], -0.1, 0.1, "Telaio", CARENA, smussa=0.03)
        base.pannello("Pancia", [(0.62, 0.3), (1.05, 0.28), (1.0, 0.16), (0.7, 0.16)], -0.16, 0.16, "Telaio", CARENA, smussa=0.03)
        if cfg["numero"]:
            base.scritta("Numero_S", cfg["numero"], (0.95, 0.21, 0.6), 1, 0.12, "Telaio", base.BIANCO)
            base.scritta("Numero_D", cfg["numero"], (0.95, -0.21, 0.6), -1, 0.12, "Telaio", base.BIANCO)
    elif corpo == "scooter":
        # scudo davanti, pedana piatta, corpo posteriore grande e tondo, sella lunga
        base.pannello("Scudo", [(1.0, 0.3), (1.1, 0.95), (1.14, 1.0), (1.2, 0.95), (1.12, 0.3)], -0.22, 0.22, "Telaio", CARENA, smussa=0.05)
        base.pannello("Pedana", [(0.45, 0.3), (1.05, 0.3), (1.05, 0.24), (0.45, 0.24)], -0.17, 0.17, "Telaio", base.NERO, smussa=0.02)
        base.pannello("Corpo", [(-0.22, 0.62), (0.15, 0.74), (0.55, h_sella - 0.04), (0.55, 0.3), (0.3, 0.3), (-0.1, 0.4)], -0.19, 0.19, "Telaio", CARENA, smussa=0.08)
        base.specchia([(0.0, 0.62), (0.4, 0.7), (0.45, 0.55), (0.05, 0.5)], "Fascia", 0.192, 0.004, "Telaio", GRAFICA, suddividi=0)
        base.pannello("Sella", [(0.05, h_sella + 0.06), (0.6, h_sella + 0.08), (0.62, h_sella - 0.0), (0.08, h_sella - 0.02)], -0.15, 0.15, "Telaio", base.materiale("Sella_Marrone", (0.18, 0.1, 0.06), 0.0, 0.7), smussa=0.04)
        base.scatola("LuceDietro", (-0.24, 0.0, 0.66), (0.03, 0.14, 0.05), "Telaio", base.materiale("Luce_Rossa", (0.6, 0.0, 0.0), 0.0, 0.1), 0.01)

    # luce dietro e portatarga (non scooter)
    if corpo != "scooter":
        coda_x = -0.3 if corpo != "sportiva" else -0.2
        base.scatola("Portatarga", (coda_x - 0.08, 0.0, h_sella - 0.06), (0.02, 0.16, 0.13), "Telaio", base.NERO, 0.005, rotazione=(0, math.radians(-20), 0))
        base.scatola("LuceDietro", (coda_x, 0.0, h_sella + (0.17 if corpo == "sportiva" else 0.06)), (0.03, 0.08, 0.025), "Telaio", base.materiale("Luce_Rossa", (0.6, 0.0, 0.0), 0.0, 0.1), 0.005)

    # pedane
    if corpo != "scooter":
        x_pedana = 0.55 if corpo != "sportiva" else 0.48
        z_pedana = 0.36 if corpo != "sportiva" else 0.42
        for lato in (1, -1):
            base.scatola("Pedana_" + str(lato), (x_pedana, 0.2 * lato, z_pedana), (0.05, 0.09, 0.02), "Telaio", base.ACCIAIO, 0.004)

    # --- sterzo: forcella, piastre, manubrio, fanale, parafango
    forcella_usd = corpo in ("supermotard", "enduro", "naked", "sportiva")
    for lato in (1, -1):
        y = (0.09 if corpo != "scooter" else 0.07) * lato
        piede = davanti + Vector((0.0, y, 0.0))
        if forcella_usd:
            base.cilindro("ForcellaPiede_" + str(lato), piede - asse * 0.03, piede + asse * 0.45, 0.028, "Sterzo", base.NERO_LUCIDO)
            base.cilindro("ForcellaTubo_" + str(lato), piede + asse * 0.38, piede + asse * (lunghezza_forcella + 0.04), 0.03, "Sterzo", FORCELLA)
        else:
            base.cilindro("ForcellaSteli_" + str(lato), piede + asse * 0.3, piede + asse * (lunghezza_forcella + 0.04), 0.022, "Sterzo", base.ACCIAIO)
            base.cilindro("ForcellaFodero_" + str(lato), piede - asse * 0.03, piede + asse * 0.38, 0.03, "Sterzo", FORCELLA)
        base.scatola("Pinza_" + str(lato), davanti + Vector((-0.1, 0.08 * lato, 0.1)), (0.07, 0.03, 0.09), "Sterzo", base.ORO if corpo != "scooter" else base.NERO, 0.01)
    base.scatola("PiastraSotto", davanti + asse * (lunghezza_forcella - 0.16), (0.07, 0.24, 0.025), "Sterzo", base.ALLUMINIO, 0.008, rotazione=(0, -rake, 0))
    base.scatola("PiastraSopra", davanti + asse * lunghezza_forcella, (0.07, 0.24, 0.025), "Sterzo", base.ALLUMINIO, 0.008, rotazione=(0, -rake, 0))

    # manubrio: largo (cross, naked), alto (stradale, scooter) oppure semimanubri (sportiva)
    if corpo == "sportiva":
        for lato in (1, -1):
            a = testa + Vector((-0.02, 0.12 * lato, -0.04))
            b = testa + Vector((-0.1, 0.33 * lato, -0.08))
            base.cilindro("Semimanubrio_" + str(lato), a, b, 0.012, "Sterzo", base.NERO_LUCIDO)
            base.cilindro("Manopola_" + str(lato), b, b + Vector((-0.02, 0.09 * lato, -0.01)), 0.017, "Sterzo", base.GOMMA)
        manopole = [testa + Vector((-0.13, 0.38 * lato, -0.09)) for lato in (1, -1)]
    else:
        alza = {"supermotard": 0.1, "enduro": 0.1, "naked": 0.12, "stradale": 0.16, "scooter": 0.12}[corpo]
        apri = {"supermotard": 0.38, "enduro": 0.4, "naked": 0.37, "stradale": 0.36, "scooter": 0.33}[corpo]
        indietro = 0.06 if corpo != "stradale" else 0.12
        c = testa + Vector((0.0, 0.0, 0.03))
        punti = [(c.x - indietro, apri, c.z + alza), (c.x - indietro * 0.6, apri * 0.5, c.z + alza * 0.6), (c.x, 0.0, c.z + 0.03),
                 (c.x - indietro * 0.6, -apri * 0.5, c.z + alza * 0.6), (c.x - indietro, -apri, c.z + alza)]
        base.tubo("Manubrio", punti, 0.011, "Sterzo", base.NERO_LUCIDO if corpo != "stradale" else base.ACCIAIO)
        manopole = []
        for lato in (1, -1):
            fine = Vector((c.x - indietro, apri * lato, c.z + alza))
            base.cilindro("Manopola_" + str(lato), fine - Vector((0, 0.06 * lato, 0)), fine + Vector((0, 0.04 * lato, 0)), 0.017, "Sterzo", base.GOMMA)
            base.cilindro("Leva_" + str(lato), fine + Vector((0.02, -0.12 * lato, 0)), fine + Vector((0.09, -0.01 * lato, -0.01)), 0.006, "Sterzo", base.ALLUMINIO)
            stelo = fine + Vector((0.0, -0.1 * lato, 0.0))
            base.tubo("SpecchioStelo_" + str(lato), [tuple(stelo), tuple(stelo + Vector((-0.02, 0.05 * lato, 0.14)))], 0.006, "Sterzo", base.NERO)
            base.cilindro("Specchio_" + str(lato), stelo + Vector((-0.03, 0.05 * lato, 0.17)), stelo + Vector((-0.02, 0.05 * lato, 0.17)), 0.045, "Sterzo", base.NERO_LUCIDO)
            manopole.append(fine)

    # fanale e parafango
    if corpo in ("supermotard", "enduro"):
        base.pannello("Tabella", [(0.0, 0.0), (0.06, 0.02), (0.05, 0.26), (-0.04, 0.24)], -0.1, 0.1, "Sterzo", CARENA, smussa=0.02)
        base.GRUPPI["Sterzo"][-1].location = davanti + asse * (lunghezza_forcella - 0.28) + Vector((0.07, 0, 0))
        base.GRUPPI["Sterzo"][-1].rotation_euler = (0, -rake * 0.6, 0)
        alto = 0.6 if corpo == "supermotard" else 0.5
        base.pannello("Parafango", [(-0.06, 0.0), (0.42, 0.04), (0.44, 0.06), (0.1, 0.05), (-0.08, 0.03)], -0.08, 0.08, "Sterzo", CARENA, smussa=0.015)
        base.GRUPPI["Sterzo"][-1].location = davanti + asse * alto + Vector((0.0, 0, -0.06))
    elif corpo in ("naked", "stradale"):
        centro = testa + Vector((0.16, 0.0, -0.12))
        base.cilindro("FaroCorpo", centro - Vector((0.1, 0, 0)), centro, 0.09, "Sterzo", base.NERO_LUCIDO, lati=32)
        base.cilindro("Faro", centro, centro + Vector((0.01, 0, 0)), 0.085, "Sterzo", base.VETRO, lati=32)
        if corpo == "stradale":
            base.pannello("Parabrezza", [(0.0, 0.0), (0.06, 0.01), (0.01, 0.17), (-0.04, 0.16)], -0.11, 0.11, "Sterzo", base.materiale("Plexiglass", (0.15, 0.2, 0.25), 0.2, 0.05, 1.0), smussa=0.01, suddividi=1)
            base.GRUPPI["Sterzo"][-1].location = centro + Vector((-0.02, 0, 0.05))
        base.pannello("Parafango", [(-0.12, 0.0), (0.18, 0.06), (0.3, -0.04), (0.28, -0.08), (0.12, 0.0), (-0.12, -0.04)], -0.07, 0.07, "Sterzo", CARENA, smussa=0.015)
        base.GRUPPI["Sterzo"][-1].location = davanti + Vector((-0.05, 0, cfg["rDav"] + 0.06))
    elif corpo == "sportiva":
        base.pannello("Parafango", [(-0.15, 0.0), (0.15, 0.06), (0.28, -0.03), (0.26, -0.07), (0.12, 0.0), (-0.15, -0.05)], -0.07, 0.07, "Sterzo", CARENA, smussa=0.015)
        base.GRUPPI["Sterzo"][-1].location = davanti + Vector((-0.04, 0, cfg["rDav"] + 0.05))
    elif corpo == "scooter":
        base.pannello("CoperchioManubrio", [(-0.12, 0.0), (0.12, 0.02), (0.14, 0.1), (-0.1, 0.1)], -0.2, 0.2, "Sterzo", CARENA, smussa=0.04)
        base.GRUPPI["Sterzo"][-1].location = testa + Vector((0.0, 0, 0.06))
        base.cilindro("Faro", testa + Vector((0.13, 0, 0.11)), testa + Vector((0.145, 0, 0.11)), 0.06, "Sterzo", base.VETRO, lati=32)
        base.pannello("Parafango", [(-0.15, 0.0), (0.15, 0.06), (0.28, -0.03), (0.26, -0.07), (0.12, 0.0), (-0.15, -0.05)], -0.07, 0.07, "Sterzo", CARENA, smussa=0.015)
        base.GRUPPI["Sterzo"][-1].location = davanti + Vector((-0.04, 0, cfg["rDav"] + 0.05))

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")
    return dietro, davanti, manopole, h_sella


# ------------------------------------------------------------------ pilota

def costruisci_pilota(cfg, manopole, h_sella):
    corpo = cfg["corpo"]
    TUTA = base.materiale("Tuta_" + corpo, cfg["tuta"], 0.0, 0.65)
    TUTA2 = base.materiale("Tuta2_" + corpo, cfg["tuta2"], 0.0, 0.5)
    CASCO = base.materiale("Casco_" + corpo, cfg["casco"], 0.0, 0.25, 1.0)
    VISIERA = base.materiale("Visiera", (0.02, 0.02, 0.03), 0.6, 0.05, 1.0)
    NERO = base.materiale("Pilota_Nero", (0.03, 0.03, 0.03), 0.0, 0.55)
    G = "Pilota"

    # posizione: bacino sulla sella, busto piu' o meno piegato in avanti
    x_bacino = {"supermotard": 0.55, "enduro": 0.55, "naked": 0.45, "stradale": 0.38, "sportiva": 0.5, "scooter": 0.3}[corpo]
    bacino = Vector((x_bacino, 0.0, h_sella + 0.15))
    piega = {"supermotard": 35, "enduro": 30, "naked": 20, "stradale": 10, "sportiva": 55, "scooter": 5}[corpo]
    busto = 0.5
    spalle = bacino + Vector((math.sin(math.radians(piega)) * busto, 0, math.cos(math.radians(piega)) * busto))
    testa = spalle + Vector((0.06 + 0.1 * math.sin(math.radians(piega)), 0, 0.2 - 0.06 * math.sin(math.radians(piega))))

    def capsula(nome, a, b, raggio, mat):
        base.cilindro(nome, a, b, raggio, G, mat, lati=20)
        for estremo in (a, b):
            bpy.ops.mesh.primitive_uv_sphere_add(radius=raggio, location=estremo, segments=20, ring_count=10)
            sfera = bpy.context.object
            for poligono in sfera.data.polygons:
                poligono.use_smooth = True
            base.metti(sfera, G, mat)

    def palla(nome, centro, misure, mat, rotazione=(0, 0, 0)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=centro, rotation=rotazione, segments=32, ring_count=16)
        oggetto = bpy.context.object
        oggetto.scale = misure
        bpy.ops.object.transform_apply(scale=True)
        for poligono in oggetto.data.polygons:
            poligono.use_smooth = True
        return base.metti(oggetto, G, mat)

    # busto, fianchi, collo
    centro_busto = (bacino + spalle) / 2
    palla("Busto", centro_busto, (0.27, 0.2, 0.16), TUTA, rotazione=(0, math.radians(piega - 90), 0))
    for lato in (1, -1):
        palla("Fascia_" + str(lato), centro_busto + Vector((0.02, 0.12 * lato, 0.03)), (0.17, 0.06, 0.09), TUTA2, rotazione=(0, math.radians(piega - 90), 0))
    palla("Fianchi", bacino, (0.16, 0.17, 0.12), TUTA)
    palla("Collo", spalle + Vector((0.04, 0, 0.08)), (0.06, 0.06, 0.07), TUTA)

    # casco: da cross (frontino e mascherina) per supermotard ed enduro, integrale con visiera per le altre
    palla("Casco", testa, (0.15, 0.135, 0.15), CASCO)
    if corpo in ("supermotard", "enduro"):
        palla("Mentoniera", testa + Vector((0.12, 0, -0.07)), (0.07, 0.07, 0.05), CASCO, rotazione=(0, math.radians(20), 0))
        palla("Mascherina", testa + Vector((0.115, 0, 0.0)), (0.045, 0.11, 0.045), VISIERA)
        base.pannello("Frontino", [(0.0, 0.0), (0.16, -0.03), (0.15, -0.0), (0.0, 0.03)], -0.1, 0.1, G, CASCO, smussa=0.006, suddividi=1)
        base.GRUPPI[G][-1].location = testa + Vector((0.06, 0, 0.1))
    else:
        palla("Visiera", testa + Vector((0.085, 0, 0.0)), (0.08, 0.115, 0.06), VISIERA)
        palla("CascoStriscia", testa + Vector((0, 0, 0.01)), (0.152, 0.03, 0.15), TUTA2)

    # braccia fino alle manopole, gambe fino alle pedane (scooter: piedi sulla pedana)
    for indice, lato in enumerate((1, -1)):
        mano = manopole[indice] + Vector((0.01, -0.02 * lato, 0.0))
        spalla = spalle + Vector((0, 0.2 * lato, -0.03))
        gomito = (spalla + mano) / 2 + Vector((-0.02, 0.08 * lato, -0.06))
        capsula("BraccioSopra_" + str(lato), spalla, gomito, 0.055, TUTA)
        capsula("Avambraccio_" + str(lato), gomito, mano, 0.047, TUTA)
        palla("Spallina_" + str(lato), spalla, (0.07, 0.07, 0.07), TUTA2)
        palla("Guanto_" + str(lato), mano + Vector((0.01, 0, 0)), (0.05, 0.04, 0.035), NERO)
        anca = bacino + Vector((0.03, 0.12 * lato, -0.05))
        if corpo == "scooter":
            ginocchio = Vector((0.75, 0.17 * lato, h_sella + 0.08))
            caviglia = Vector((0.88, 0.14 * lato, 0.34))
        elif corpo == "sportiva":
            ginocchio = Vector((0.8, 0.22 * lato, 0.68))
            caviglia = Vector((0.5, 0.2 * lato, 0.5))
        else:
            ginocchio = Vector((bacino.x + 0.27, 0.2 * lato, h_sella - 0.06))
            caviglia = Vector((0.58, 0.2 * lato, 0.45))
        capsula("Coscia_" + str(lato), anca, ginocchio, 0.075, TUTA)
        capsula("Gamba_" + str(lato), ginocchio, caviglia, 0.06, TUTA)
        palla("Ginocchiera_" + str(lato), ginocchio + Vector((0.03, 0.01 * lato, 0)), (0.06, 0.06, 0.07), TUTA2)
        base.cilindro("Stivale_" + str(lato), caviglia + Vector((0.02, 0, 0.18)), caviglia - Vector((0.0, 0, 0.04)), 0.062, G, NERO)
        base.scatola("Piede_" + str(lato), caviglia + Vector((0.07, 0, -0.06)), (0.24, 0.1, 0.08), G, NERO, 0.03)
    return bacino


# ------------------------------------------------------------------ esportazione

def esporta(nome, origini):
    for gruppo, oggetti in base.GRUPPI.items():
        bpy.ops.object.select_all(action="DESELECT")
        for oggetto in oggetti:
            oggetto.select_set(True)
        bpy.context.view_layer.objects.active = oggetti[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.join()
        unico = bpy.context.object
        unico.name = nome + "_" + gruppo
        unico.data.transform(Matrix.Translation(-origini[gruppo]))
        bpy.ops.export_scene.gltf(filepath=str(CARTELLA / (nome + "_" + gruppo + ".glb")), use_selection=True,
                                  export_format="GLB", export_apply=True, export_yup=True)
        print("  " + nome + "_" + gruppo + ": " + str(len(unico.data.polygons)) + " poligoni")


if __name__ == "__main__":
    CARTELLA.mkdir(parents=True, exist_ok=True)
    cartella_foto = None
    scelte = [a for a in sys.argv[1:] if a in MOTO]
    if "--foto" in sys.argv:
        cartella_foto = Path(sys.argv[sys.argv.index("--foto") + 1])
    for chiave in (scelte or list(MOTO)):
        cfg = MOTO[chiave]
        nome = chiave.upper()
        print(nome)
        dietro, davanti, manopole, h_sella = costruisci_moto(cfg)
        bacino = costruisci_pilota(cfg, manopole, h_sella)
        if cartella_foto is not None:
            base.foto(cartella_foto / (chiave + ".png"), (cfg["passo"] / 2 + 3.6, -3.0, 1.6), (cfg["passo"] / 2, 0, 0.75))
            for oggetto in list(bpy.data.objects):
                if oggetto.type in ("CAMERA",):
                    bpy.data.objects.remove(oggetto)
        # Pavimento e luci delle foto non vanno nel modello
        for oggetto in list(bpy.data.objects):
            if oggetto.name.startswith("Pavimento") or oggetto.type == "LIGHT":
                bpy.data.objects.remove(oggetto)
        origini = {"Telaio": dietro, "Forcellone": dietro, "Sterzo": davanti, "RuotaPosteriore": dietro,
                   "RuotaAnteriore": davanti, "Pilota": bacino}
        esporta(nome, origini)
        misure = {"passo": cfg["passo"], "rDav": cfg["rDav"], "rDie": cfg["rDie"],
                  "bacino": [round(bacino.x, 3), round(bacino.z - cfg["rDie"], 3)]}
        (CARTELLA / (nome + ".json")).write_text(json.dumps(misure))
