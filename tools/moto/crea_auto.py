# Crea il modello 3D della macchina da drift "MRW Drift GT" (disegno originale MRW) con Blender.
#
# Uso:  python3 tools/moto/crea_auto.py [--foto cartella]
#
# Pezzi (in anteprima/modelli):
#   DRIFTGT_Carrozzeria.glb   carrozzeria, vetri, luci, alettone, interni (origine = centro dell'asse dietro)
#   DRIFTGT_Ruota.glb         una ruota (il gioco la usa 4 volte; origine = centro della ruota)
#   DRIFTGT_Pilota.glb        pilota con casco e volante (origine = bacino del pilota)
#   DRIFTGT.json              misure per il gioco
# Misure in metri. X = avanti, Y = sinistra, Z = su.

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crea_moto_450 as base
import crea_moto as moto

CARTELLA = Path(__file__).resolve().parents[2] / "anteprima" / "modelli"
PASSO = 2.55
RAGGIO = 0.32
CARREGGIATA = 1.52
BACINO = Vector((1.05, 0.38, 0.5))   # pilota a sinistra (guida a sinistra come in Svizzera)

GRUPPI = {"Carrozzeria": [], "Ruota": [], "Pilota": []}


def metti_in(gruppo):
    # sposta l'ultimo oggetto creato dai gruppi della moto a quelli della macchina
    for lista in base.GRUPPI.values():
        while lista:
            GRUPPI[gruppo].append(lista.pop())


def arco(cx, raggio, da, a, passi):
    # punti di un arco (vista di lato) per i passaruota
    return [(cx + math.cos(math.radians(da + (a - da) * i / passi)) * raggio,
             RAGGIO + math.sin(math.radians(da + (a - da) * i / passi)) * raggio) for i in range(passi + 1)]


def costruisci():
    for oggetto in list(bpy.data.objects):
        bpy.data.objects.remove(oggetto)
    for lista in list(base.GRUPPI.values()) + list(GRUPPI.values()):
        lista.clear()

    VERNICE = base.materiale("Vernice_Drift", (0.85, 0.86, 0.88), 0.0, 0.2, 1.0)
    STRISCIA = base.materiale("Striscia_Drift", (0.65, 0.02, 0.03), 0.0, 0.25, 1.0)
    VETRO = base.materiale("Vetro_Auto", (0.03, 0.04, 0.05), 0.4, 0.04, 1.0)
    # vetri trasparenti (dentro la macchina, in prima persona, si vede fuori)
    VETRO.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.35
    try:
        VETRO.surface_render_method = "BLENDED"
    except AttributeError:
        VETRO.blend_method = "BLEND"
    PLASTICA = base.materiale("Plastica_Auto", (0.02, 0.02, 0.02), 0.0, 0.5)
    FARO = base.materiale("Faro_Auto", (0.95, 0.95, 0.9), 0.3, 0.05)
    STOP = base.materiale("Stop_Auto", (0.7, 0.0, 0.0), 0.2, 0.1)
    C = "Telaio"   # gruppo temporaneo (poi passa a "Carrozzeria")

    # fiancata vista di lato, con i passaruota tagliati
    profilo = [(-0.86, 0.26)]
    profilo += arco(0.0, 0.39, 180, 0, 10)
    profilo += arco(PASSO, 0.39, 180, 0, 10)
    profilo += [(3.38, 0.26), (3.46, 0.5), (3.38, 0.72), (2.4, 0.9), (-0.45, 0.96), (-0.88, 0.82), (-0.92, 0.5)]
    profilo = [(x, max(z, 0.26) if x < -0.5 or x > 3.0 else z) for x, z in profilo]
    base.pannello("Scocca", profilo, -0.88, 0.88, C, VERNICE, smussa=0.05, suddividi=0)
    # striscia rossa lungo la fiancata e sul cofano
    base.specchia([(-0.8, 0.7), (3.3, 0.66), (3.32, 0.6), (-0.82, 0.64)], "Striscia", 0.885, 0.006, C, STRISCIA, suddividi=0)
    base.pannello("StrisciaCofano", [(2.4, 0.905), (3.36, 0.74), (3.37, 0.73), (2.4, 0.895)], -0.15, 0.15, C, STRISCIA, smussa=0.0, suddividi=0)
    # abitacolo (vetri) e tetto
    base.pannello("Vetri", [(-0.3, 0.95), (0.18, 1.29), (1.3, 1.31), (2.05, 0.93)], -0.74, 0.74, C, VETRO, smussa=0.05, suddividi=0)
    base.pannello("Tetto", [(0.22, 1.3), (1.28, 1.32), (1.24, 1.35), (0.26, 1.33)], -0.72, 0.72, C, VERNICE, smussa=0.02, suddividi=0)
    for lato in (1, -1):
        base.cilindro("Montante_" + str(lato), (2.03, 0.73 * lato, 0.94), (1.3, 0.71 * lato, 1.31), 0.03, C, VERNICE)
        base.scatola("Specchietto_" + str(lato), (2.0, 0.95 * lato, 1.0), (0.12, 0.14, 0.08), C, VERNICE, 0.02)
        base.scatola("Faro_" + str(lato), (3.36, 0.6 * lato, 0.66), (0.12, 0.3, 0.07), C, FARO, 0.02, rotazione=(0, math.radians(-20), 0))
        base.scatola("Stop_" + str(lato), (-0.9, 0.62 * lato, 0.78), (0.04, 0.3, 0.07), C, STOP, 0.01)
        base.scatola("Minigonna_" + str(lato), (1.27, 0.86 * lato, 0.27), (1.65, 0.06, 0.08), C, PLASTICA, 0.02)
        base.scatola("Montante_Ala_" + str(lato), (-0.68, 0.55 * lato, 1.04), (0.08, 0.03, 0.18), C, PLASTICA, 0.01)
    # paraurti, splitter, alettone, scarico
    base.scatola("ParaurtiDavanti", (3.38, 0.0, 0.33), (0.18, 1.7, 0.16), C, PLASTICA, 0.04)
    base.scatola("Splitter", (3.42, 0.0, 0.22), (0.2, 1.72, 0.02), C, PLASTICA, 0.005)
    base.scatola("Griglia", (3.43, 0.0, 0.48), (0.04, 0.8, 0.12), C, PLASTICA, 0.01)
    base.scatola("ParaurtiDietro", (-0.9, 0.0, 0.36), (0.12, 1.7, 0.18), C, PLASTICA, 0.04)
    base.pannello("Alettone", [(-0.85, 1.12), (-0.5, 1.14), (-0.5, 1.16), (-0.86, 1.18)], -0.82, 0.82, C, PLASTICA, smussa=0.01, suddividi=0)
    base.cilindro("Scarico", (-0.75, -0.55, 0.26), (-0.98, -0.55, 0.26), 0.05, C, base.ACCIAIO)
    # interno: sedili e volante
    for lato in (1, -1):
        base.scatola("Sedile_" + str(lato), (0.95, 0.38 * lato, 0.62), (0.45, 0.45, 0.12), C, PLASTICA, 0.04)
        base.scatola("Schienale_" + str(lato), (0.72, 0.38 * lato, 0.9), (0.1, 0.45, 0.6), C, PLASTICA, 0.04, rotazione=(0, math.radians(-15), 0))
    base.scatola("Cruscotto", (1.85, 0.0, 0.95), (0.3, 1.4, 0.12), C, PLASTICA, 0.04)
    metti_in("Carrozzeria")

    # ruota: cerchio in lega e gomma stradale larga (una sola, il gioco la copia 4 volte)
    cfg = dict(moto.MOTO["sport1000"])
    cfg["corpo"] = "auto"
    cfg["grafica"] = (0.2, 0.2, 0.22)
    moto.ruota("Ruota", (0.0, 0.0, 0.0), RAGGIO, 0.22, "RuotaPosteriore", cfg, False)
    metti_in("Ruota")

    # pilota: casco, busto, braccia sul volante
    TUTA = base.materiale("Tuta_Drift", (0.05, 0.05, 0.06), 0.0, 0.6)
    CASCO = base.materiale("Casco_Drift", (0.65, 0.02, 0.03), 0.0, 0.25, 1.0)
    VISIERA = base.materiale("Visiera_Drift", (0.02, 0.02, 0.03), 0.6, 0.05, 1.0)
    G = "Pilota"
    spalle = BACINO + Vector((-0.08, 0, 0.5))
    testa = spalle + Vector((0.02, 0, 0.24))
    volante = Vector((1.55, BACINO.y, 0.95))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.018, location=volante, rotation=(0, math.radians(70), 0))
    base.metti(bpy.context.object, G, PLASTICA)
    base.cilindro("Piantone", volante, volante + Vector((0.3, 0, -0.1)), 0.02, G, PLASTICA)
    metti_in("Carrozzeria")   # il volante resta nella macchina: in prima persona si vede
    for nome, centro, misure, mat in [("Busto", (BACINO + spalle) / 2, (0.14, 0.2, 0.28), TUTA), ("Casco", testa, (0.15, 0.135, 0.15), CASCO),
                                      ("Visiera", testa + Vector((0.09, 0, 0.0)), (0.07, 0.115, 0.055), VISIERA)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=centro, segments=32, ring_count=16)
        oggetto = bpy.context.object
        oggetto.scale = misure
        bpy.ops.object.transform_apply(scale=True)
        for poligono in oggetto.data.polygons:
            poligono.use_smooth = True
        base.metti(oggetto, G, mat)
    for lato in (1, -1):
        spalla = spalle + Vector((0, 0.19 * lato, -0.03))
        mano = volante + Vector((-0.03, 0.15 * lato, 0.0))
        gomito = (spalla + mano) / 2 + Vector((0.0, 0.06 * lato, -0.12))
        base.cilindro("Braccio_" + str(lato), spalla, gomito, 0.05, G, TUTA)
        base.cilindro("Avambraccio_" + str(lato), gomito, mano, 0.045, G, TUTA)
        base.cilindro("Coscia_" + str(lato), BACINO + Vector((0, 0.1 * lato, 0)), Vector((1.5, BACINO.y + 0.1 * lato, 0.62)), 0.07, G, TUTA)
    metti_in("Pilota")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")


def esporta():
    origini = {"Carrozzeria": Vector((0, 0, RAGGIO)), "Ruota": Vector((0, 0, 0)), "Pilota": BACINO}
    for gruppo, oggetti in GRUPPI.items():
        bpy.ops.object.select_all(action="DESELECT")
        for oggetto in oggetti:
            oggetto.select_set(True)
        bpy.context.view_layer.objects.active = oggetti[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.join()
        unico = bpy.context.object
        unico.name = "DRIFTGT_" + gruppo
        unico.data.transform(Matrix.Translation(-origini[gruppo]))
        bpy.ops.export_scene.gltf(filepath=str(CARTELLA / ("DRIFTGT_" + gruppo + ".glb")), use_selection=True,
                                  export_format="GLB", export_apply=True, export_yup=True)
        print("  DRIFTGT_" + gruppo + ": " + str(len(unico.data.polygons)) + " poligoni")
    misure = {"tipo": "auto", "passo": PASSO, "raggio": RAGGIO, "carreggiata": CARREGGIATA,
              "bacino": [round(BACINO.x, 3), round(BACINO.z - RAGGIO, 3), round(BACINO.y, 3)]}
    (CARTELLA / "DRIFTGT.json").write_text(json.dumps(misure))


if __name__ == "__main__":
    CARTELLA.mkdir(parents=True, exist_ok=True)
    costruisci()
    if "--foto" in sys.argv:
        # anteprima: la macchina completa con le 4 ruote (copie solo per la foto)
        ruota = GRUPPI["Ruota"]
        copie = []
        for x in (0.0, PASSO):
            for y in (CARREGGIATA / 2, -CARREGGIATA / 2):
                for pezzo in ruota:
                    copia = pezzo.copy()
                    copia.data = pezzo.data.copy()
                    copia.location = pezzo.location + Vector((x, y, RAGGIO))
                    bpy.context.collection.objects.link(copia)
                    copie.append(copia)
        for pezzo in ruota:
            pezzo.hide_render = True
        for pezzo in GRUPPI["Pilota"]:
            pezzo.location = pezzo.location
        cartella = Path(sys.argv[sys.argv.index("--foto") + 1])
        base.foto(cartella / "driftgt.png", (5.2, -4.4, 2.0), (1.2, 0, 0.6), lente=50)
        for copia in copie:
            bpy.data.objects.remove(copia)
        for pezzo in ruota:
            pezzo.hide_render = False
        for oggetto in list(bpy.data.objects):
            if oggetto.name.startswith("Pavimento") or oggetto.type in ("LIGHT", "CAMERA"):
                bpy.data.objects.remove(oggetto)
    esporta()
