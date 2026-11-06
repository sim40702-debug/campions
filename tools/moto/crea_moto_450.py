# Crea il modello 3D della supermotard "MRW SM 450" (disegno di Simone) con Blender.
#
# Uso (serve Blender 4+ oppure il modulo Python "bpy"):
#   python3 tools/moto/crea_moto_450.py            -> crea i pezzi .glb per Unreal
#   python3 tools/moto/crea_moto_450.py --foto     -> crea anche le immagini di anteprima
#
# Pezzi separati (in Unreal si muovono da soli):
#   SM450_Telaio.glb            telaio, motore, carene, sella, scarichi (origine = perno ruota posteriore)
#   SM450_Forcellone.glb        forcellone e catena (origine = perno ruota posteriore)
#   SM450_Sterzo.glb            forcella, manubrio, fanale, parafango (origine = perno ruota anteriore)
#   SM450_RuotaPosteriore.glb   ruota (origine = suo perno)
#   SM450_RuotaAnteriore.glb    ruota (origine = suo perno)
#
# Misure in metri. X = avanti, Y = sinistra, Z = su. Perno posteriore a X = 0.

import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

CARTELLA = Path(__file__).resolve().parents[2] / "unreal" / "MotoRacingWorld" / "ImportMoto" / "SM450"
INTERASSE = 1.48
RAGGIO_RUOTA = 0.31
RUOTA_POST = Vector((0.0, 0.0, RAGGIO_RUOTA))
RUOTA_ANT = Vector((INTERASSE, 0.0, RAGGIO_RUOTA))
INCLINAZIONE_FORCELLA = math.radians(27)

GRUPPI = {"Telaio": [], "Forcellone": [], "Sterzo": [], "RuotaPosteriore": [], "RuotaAnteriore": []}


# ------------------------------------------------------------------ materiali

def materiale(nome, colore, metallo=0.0, ruvido=0.5, vernice=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*colore, 1.0)
    p.inputs["Metallic"].default_value = metallo
    p.inputs["Roughness"].default_value = ruvido
    if vernice > 0:
        p.inputs["Coat Weight"].default_value = vernice
        p.inputs["Coat Roughness"].default_value = 0.05
    return m


ROSSO = materiale("Vernice_Rossa", (0.62, 0.012, 0.01), 0.0, 0.32, 1.0)
NERO = materiale("Plastica_Nera", (0.012, 0.012, 0.013), 0.0, 0.55)
NERO_LUCIDO = materiale("Nero_Lucido", (0.01, 0.01, 0.01), 0.3, 0.25, 0.6)
SELLA = materiale("Sella", (0.02, 0.02, 0.022), 0.0, 0.85)
ORO = materiale("Oro_Anodizzato", (0.95, 0.62, 0.28), 1.0, 0.22)
ALLUMINIO = materiale("Alluminio", (0.86, 0.86, 0.87), 1.0, 0.28)
ACCIAIO = materiale("Acciaio", (0.7, 0.7, 0.72), 1.0, 0.35)
MOTORE = materiale("Motore", (0.32, 0.32, 0.33), 0.9, 0.4)
COLLETTORE = materiale("Collettore_Titanio", (0.62, 0.48, 0.34), 1.0, 0.3)
GOMMA = materiale("Gomma", (0.018, 0.018, 0.018), 0.0, 0.9)
BIANCO = materiale("Grafica_Bianca", (0.9, 0.9, 0.9), 0.0, 0.35)
VETRO = materiale("Fanale", (0.9, 0.95, 1.0), 0.0, 0.05)


# ------------------------------------------------------------------ forme di base

def metti(oggetto, gruppo, mat):
    oggetto.data.materials.clear()
    oggetto.data.materials.append(mat)
    GRUPPI[gruppo].append(oggetto)
    return oggetto


def liscia(oggetto, smussa=0.0, suddividi=0):
    # Smussa gli spigoli e rende le superfici morbide (come la plastica stampata)
    bpy.context.view_layer.objects.active = oggetto
    if smussa > 0:
        mod = oggetto.modifiers.new("Smusso", "BEVEL")
        mod.width = smussa
        mod.segments = 3
        mod.limit_method = "ANGLE"
    if suddividi > 0:
        mod = oggetto.modifiers.new("Morbido", "SUBSURF")
        mod.levels = suddividi
    for mod in list(oggetto.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for poligono in oggetto.data.polygons:
        poligono.use_smooth = True


def cilindro(nome, a, b, raggio, gruppo, mat, lati=24):
    a, b = Vector(a), Vector(b)
    direzione = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=lati, radius=raggio, depth=direzione.length, location=(a + b) / 2)
    oggetto = bpy.context.object
    oggetto.name = nome
    oggetto.rotation_mode = "QUATERNION"
    oggetto.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direzione.normalized())
    for poligono in oggetto.data.polygons:
        poligono.use_smooth = True
    return metti(oggetto, gruppo, mat)


def tubo(nome, punti, raggio, gruppo, mat):
    # Tubo che passa per una lista di punti (telaio, collettori, cavi)
    curva = bpy.data.curves.new(nome, "CURVE")
    curva.dimensions = "3D"
    curva.bevel_depth = raggio
    curva.bevel_resolution = 4
    linea = curva.splines.new("BEZIER")
    linea.bezier_points.add(len(punti) - 1)
    for punto, coordinate in zip(linea.bezier_points, punti):
        punto.co = coordinate
        punto.handle_left_type = "AUTO"
        punto.handle_right_type = "AUTO"
    curva.use_fill_caps = True
    oggetto = bpy.data.objects.new(nome, curva)
    bpy.context.collection.objects.link(oggetto)
    bpy.context.view_layer.objects.active = oggetto
    oggetto.select_set(True)
    bpy.ops.object.convert(target="MESH")
    oggetto = bpy.context.object
    oggetto.select_set(False)
    for poligono in oggetto.data.polygons:
        poligono.use_smooth = True
    return metti(oggetto, gruppo, mat)


def scatola(nome, centro, misure, gruppo, mat, smussa=0.01, rotazione=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centro, rotation=rotazione)
    oggetto = bpy.context.object
    oggetto.name = nome
    oggetto.scale = misure
    bpy.ops.object.transform_apply(scale=True)
    liscia(oggetto, smussa)
    return metti(oggetto, gruppo, mat)


def pannello(nome, profilo, y0, y1, gruppo, mat, smussa=0.012, suddividi=2):
    # Pannello di plastica: forma vista di lato (punti X, Z) spessa da y0 a y1
    mesh = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    sotto = [bm.verts.new((x, y0, z)) for x, z in profilo]
    sopra = [bm.verts.new((x, y1, z)) for x, z in profilo]
    bm.faces.new(sotto)
    bm.faces.new(list(reversed(sopra)))
    n = len(profilo)
    for i in range(n):
        bm.faces.new([sotto[i], sotto[(i + 1) % n], sopra[(i + 1) % n], sopra[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    oggetto = bpy.data.objects.new(nome, mesh)
    bpy.context.collection.objects.link(oggetto)
    liscia(oggetto, smussa, suddividi)
    return metti(oggetto, gruppo, mat)


def specchia(profilo_fn, nome, y_esterno, spessore, gruppo, mat, **altro):
    # Lo stesso pannello a sinistra e a destra
    pannello(nome + "_S", profilo_fn, y_esterno - spessore, y_esterno, gruppo, mat, **altro)
    pannello(nome + "_D", profilo_fn, -y_esterno, -y_esterno + spessore, gruppo, mat, **altro)


def scritta(nome, testo, posizione, lato, altezza, gruppo, mat):
    # Numero "450" sulle fiancate, un po' in rilievo
    bpy.ops.object.text_add(location=posizione)
    oggetto = bpy.context.object
    oggetto.name = nome
    oggetto.data.body = testo
    oggetto.data.size = altezza
    oggetto.data.extrude = 0.002
    oggetto.data.align_x = "CENTER"
    oggetto.data.shear = 0.25
    # Il testo deve essere leggibile da fuori: girato verso +Y a sinistra, verso -Y a destra
    oggetto.rotation_euler = (math.radians(90), 0, math.radians(180) if lato > 0 else 0)
    bpy.ops.object.convert(target="MESH")
    oggetto = bpy.context.object
    return metti(oggetto, gruppo, mat)


# ------------------------------------------------------------------ ruote

def ruota(nome, centro, raggio_esterno, larghezza, gruppo, disco_raggio):
    cx, cy, cz = centro
    raggio_cerchio = 0.216    # cerchio da 17 pollici
    # Gomma: toro schiacciato
    bpy.ops.mesh.primitive_torus_add(major_radius=(raggio_esterno + raggio_cerchio) / 2,
                                     minor_radius=(raggio_esterno - raggio_cerchio) / 2,
                                     major_segments=96, minor_segments=24,
                                     location=centro, rotation=(math.radians(90), 0, 0))
    gomma = bpy.context.object
    gomma.name = nome + "_Gomma"
    gomma.scale = (1, 1, larghezza / (raggio_esterno - raggio_cerchio))
    bpy.ops.object.transform_apply(scale=True)
    liscia(gomma)
    metti(gomma, gruppo, GOMMA)

    # Tasselli della gomma (3 file tutto attorno)
    tasselli = []
    for i in range(64):
        angolo = i / 64 * math.tau
        for fila, (y, z_extra) in enumerate([(-larghezza * 0.32, -0.006), (0.0, 0.0), (larghezza * 0.32, -0.006)]):
            if (i + fila) % 2 == 1 and fila != 1:
                continue
            r = raggio_esterno - 0.004 + z_extra
            posizione = (cx + math.cos(angolo) * r, cy + y, cz + math.sin(angolo) * r)
            bpy.ops.mesh.primitive_cube_add(size=1, location=posizione, rotation=(0, -angolo, 0))
            blocco = bpy.context.object
            blocco.scale = (0.012, larghezza * 0.26, 0.022)
            tasselli.append(blocco)
    bpy.ops.object.select_all(action="DESELECT")
    for blocco in tasselli:
        blocco.select_set(True)
    bpy.context.view_layer.objects.active = tasselli[0]
    bpy.ops.object.join()
    blocchi = bpy.context.object
    blocchi.name = nome + "_Tasselli"
    bpy.ops.object.transform_apply(scale=True)
    metti(blocchi, gruppo, GOMMA)

    # Cerchio (nero) e mozzo
    bpy.ops.mesh.primitive_torus_add(major_radius=raggio_cerchio, minor_radius=0.012, major_segments=96,
                                     minor_segments=12, location=centro, rotation=(math.radians(90), 0, 0))
    cerchio = bpy.context.object
    cerchio.name = nome + "_Cerchio"
    cerchio.scale = (1, 1, 2.2)
    bpy.ops.object.transform_apply(scale=True)
    liscia(cerchio)
    metti(cerchio, gruppo, NERO_LUCIDO)
    cilindro(nome + "_Mozzo", (cx, cy - 0.06, cz), (cx, cy + 0.06, cz), 0.045, gruppo, ALLUMINIO)

    # Raggi: 36, alternati a destra e a sinistra del mozzo
    for i in range(36):
        angolo = i / 36 * math.tau
        lato = 0.045 if i % 2 == 0 else -0.045
        a = (cx + math.cos(angolo + 0.25) * 0.04, cy + lato, cz + math.sin(angolo + 0.25) * 0.04)
        b = (cx + math.cos(angolo) * (raggio_cerchio - 0.01), cy, cz + math.sin(angolo) * (raggio_cerchio - 0.01))
        cilindro(nome + "_Raggio" + str(i), a, b, 0.0022, gruppo, ACCIAIO, lati=6)

    # Disco del freno (forato)
    lato_disco = 0.07
    cilindro(nome + "_Disco", (cx, cy + lato_disco, cz), (cx, cy + lato_disco + 0.005, cz), disco_raggio, gruppo, ACCIAIO, lati=64)
    cilindro(nome + "_Flangia", (cx, cy + lato_disco - 0.002, cz), (cx, cy + lato_disco + 0.007, cz), 0.07, gruppo, NERO_LUCIDO, lati=32)


# ------------------------------------------------------------------ la moto

def costruisci():
    # Tolgo gli oggetti della scena iniziale di Blender (cubo, luce, camera)
    for oggetto in list(bpy.data.objects):
        bpy.data.objects.remove(oggetto)

    # Ruote: davanti 120/70-17 tassellata, dietro 150/60-17
    ruota("RuotaPosteriore", tuple(RUOTA_POST), 0.31, 0.15, "RuotaPosteriore", 0.11)
    ruota("RuotaAnteriore", tuple(RUOTA_ANT), 0.30, 0.12, "RuotaAnteriore", 0.16)

    # --- Forcellone in alluminio (due bracci a sezione rettangolare) e catena
    perno = Vector((0.58, 0.0, 0.43))
    for lato in (1, -1):
        y = 0.105 * lato
        tubo("Forcellone_" + str(lato), [(0.0, y, RAGGIO_RUOTA), (0.3, y, 0.37), (perno.x, y * 0.8, perno.z)], 0.028, "Forcellone", ALLUMINIO)
        scatola("TendiCatena_" + str(lato), (0.0, y, RAGGIO_RUOTA), (0.06, 0.02, 0.05), "Forcellone", ALLUMINIO)
    scatola("PinzaDietro", (0.08, -0.075, RAGGIO_RUOTA + 0.05), (0.07, 0.03, 0.06), "Forcellone", NERO_LUCIDO, 0.01)
    cilindro("PernoForcellone", (perno.x, -0.12, perno.z), (perno.x, 0.12, perno.z), 0.018, "Forcellone", ACCIAIO)
    cilindro("CoronaPosteriore", (0, -0.085, RAGGIO_RUOTA), (0, -0.08, RAGGIO_RUOTA), 0.105, "Forcellone", ALLUMINIO, lati=48)
    for alto, basso in [(1, 0)]:
        tubo("Catena_Sopra", [(0.0, -0.083, RAGGIO_RUOTA + 0.105), (0.35, -0.083, 0.41), (0.68, -0.083, 0.455)], 0.007, "Forcellone", ACCIAIO)
        tubo("Catena_Sotto", [(0.0, -0.083, RAGGIO_RUOTA - 0.105), (0.35, -0.083, 0.31), (0.68, -0.083, 0.375)], 0.007, "Forcellone", ACCIAIO)

    # --- Telaio a doppia culla in tubi neri
    testa = Vector((1.13, 0.0, 0.98))
    cilindro("CannottoSterzo", testa - Vector((-0.05, 0, 0.1)), testa + Vector((-0.05, 0, 0.1)), 0.03, "Telaio", NERO_LUCIDO)
    for lato in (1, -1):
        y = 0.07 * lato
        tubo("TelaioSopra_" + str(lato), [(1.12, y * 0.5, 0.96), (0.85, y * 1.3, 0.86), (0.66, y * 1.4, 0.74), (0.6, y * 1.3, 0.52), (0.6, y * 1.2, 0.36)], 0.017, "Telaio", NERO_LUCIDO)
        tubo("TelaioSotto_" + str(lato), [(1.1, y * 0.4, 0.88), (1.02, y, 0.55), (0.98, y, 0.25), (0.8, y, 0.18), (0.62, y, 0.3)], 0.016, "Telaio", NERO_LUCIDO)
        tubo("Telaietto_" + str(lato), [(0.68, y * 1.3, 0.8), (0.3, y * 1.2, 0.86), (-0.12, y, 0.93)], 0.012, "Telaio", NERO_LUCIDO)
        tubo("TelaiettoSotto_" + str(lato), [(0.6, y * 1.3, 0.5), (0.25, y * 1.4, 0.72), (0.0, y * 1.1, 0.88)], 0.011, "Telaio", NERO_LUCIDO)

    # --- Motore monocilindrico
    scatola("Basamento", (0.83, 0.0, 0.36), (0.3, 0.2, 0.24), "Telaio", MOTORE, 0.06)
    # coperchi rotondi sui due lati, con le viti
    for lato in (1, -1):
        cilindro("CoperchioRotondo_" + str(lato), (0.78, 0.1 * lato, 0.34), (0.78, 0.125 * lato, 0.34), 0.11, "Telaio", MOTORE, lati=48)
        for i in range(8):
            a = i / 8 * math.tau
            cilindro("Vite_" + str(lato) + "_" + str(i), (0.78 + math.cos(a) * 0.095, 0.124 * lato, 0.34 + math.sin(a) * 0.095),
                     (0.78 + math.cos(a) * 0.095, 0.132 * lato, 0.34 + math.sin(a) * 0.095), 0.008, "Telaio", ALLUMINIO, lati=6)
    # tubi del liquido dal radiatore al motore e cavo della candela
    for lato in (1, -1):
        tubo("TuboAcqua_" + str(lato), [(1.02, 0.08 * lato, 0.62), (0.98, 0.07 * lato, 0.5), (0.9, 0.06 * lato, 0.46)], 0.012, "Telaio", NERO)
    tubo("CavoCandela", [(0.95, 0.06, 0.78), (0.9, 0.1, 0.84), (0.8, 0.09, 0.86)], 0.006, "Telaio", NERO)
    cilindro("Corpofarfallato", (0.86, -0.02, 0.7), (0.74, -0.02, 0.74), 0.03, "Telaio", ALLUMINIO)
    tubo("CavoGas", [(0.74, -0.02, 0.74), (0.9, -0.05, 0.95), (1.1, -0.15, 1.08)], 0.004, "Telaio", NERO)
    scatola("Cilindro", (0.9, 0.0, 0.6), (0.14, 0.15, 0.24), "Telaio", MOTORE, 0.02, rotazione=(0, math.radians(-12), 0))
    for i in range(6):   # alette del cilindro
        scatola("Aletta" + str(i), (0.905 - i * 0.004, 0.0, 0.52 + i * 0.03), (0.16, 0.17, 0.008), "Telaio", MOTORE, 0.002, rotazione=(0, math.radians(-12), 0))
    scatola("Testata", (0.93, 0.0, 0.75), (0.17, 0.16, 0.09), "Telaio", NERO, 0.03, rotazione=(0, math.radians(-12), 0))
    for i, (dx, dy) in enumerate([(-0.06, 0.06), (0.06, 0.06), (-0.06, -0.06), (0.06, -0.06)]):
        cilindro("ViteTestata" + str(i), (0.93 + dx, dy, 0.79), (0.93 + dx, dy, 0.805), 0.008, "Telaio", ALLUMINIO, lati=6)
    cilindro("CoperchioFrizione", (0.82, 0.11, 0.36), (0.82, 0.135, 0.36), 0.1, "Telaio", MOTORE, lati=48)
    cilindro("CoperchioAlternatore", (0.8, -0.11, 0.37), (0.8, -0.13, 0.37), 0.085, "Telaio", NERO_LUCIDO, lati=48)
    cilindro("PignoneCatena", (0.68, -0.085, 0.415), (0.68, -0.08, 0.415), 0.04, "Telaio", ACCIAIO, lati=24)
    scatola("ParaMotore", (0.82, 0.0, 0.2), (0.34, 0.2, 0.02), "Telaio", NERO, 0.008, rotazione=(0, math.radians(6), 0))

    # --- Radiatori ai lati del telaio
    for lato in (1, -1):
        scatola("Radiatore_" + str(lato), (1.03, 0.1 * lato, 0.72), (0.06, 0.03, 0.26), "Telaio", NERO, 0.006, rotazione=(0, math.radians(-15), 0))
        for i in range(10):   # griglia del radiatore
            scatola("Griglia_" + str(lato) + "_" + str(i), (1.03 + 0.003 * (i - 5), 0.117 * lato, 0.61 + i * 0.024), (0.065, 0.004, 0.006),
                    "Telaio", ALLUMINIO, 0.001, rotazione=(0, math.radians(-15), 0))

    # --- Ammortizzatore posteriore con molla oro
    cilindro("Ammortizzatore", (0.56, 0.0, 0.48), (0.7, 0.0, 0.84), 0.022, "Telaio", NERO_LUCIDO)
    tubo("Molla", [(0.56 + 0.14 * t / 20 + 0.0, 0.035 * math.cos(t * 1.9), 0.52 + 0.27 * t / 20 + 0.035 * math.sin(t * 1.9)) for t in range(21)], 0.006, "Telaio", ORO)
    cilindro("SerbatoioAmmortizzatore", (0.66, 0.05, 0.78), (0.58, 0.05, 0.66), 0.022, "Telaio", ORO)

    # --- Collettore (titanio) e due silenziatori (come nella vista da dietro)
    tubo("Collettore", [(0.99, 0.03, 0.72), (1.06, 0.05, 0.6), (1.04, 0.07, 0.35), (0.9, 0.12, 0.24), (0.66, 0.15, 0.32), (0.5, 0.16, 0.48)], 0.024, "Telaio", COLLETTORE)
    tubo("CollettoreDue", [(0.5, 0.16, 0.48), (0.42, 0.0, 0.5), (0.36, -0.14, 0.56)], 0.022, "Telaio", COLLETTORE)
    for lato in (1, -1):
        y = 0.165 * lato
        x0 = 0.42 if lato > 0 else 0.36
        cilindro("Silenziatore_" + str(lato), (x0, y, 0.5), (-0.1, y, 0.78), 0.055, "Telaio", NERO_LUCIDO, lati=32)
        cilindro("Fondello_" + str(lato), (-0.1, y, 0.78), (-0.13, y, 0.795), 0.058, "Telaio", ACCIAIO, lati=32)
        cilindro("Terminale_" + str(lato), (-0.13, y, 0.795), (-0.15, y, 0.805), 0.02, "Telaio", NERO, lati=16)

    # --- Carene rosse (forme viste di lato: punti X, Z)
    convogliatore = [(0.86, 0.95), (1.18, 1.0), (1.17, 0.84), (1.1, 0.62), (0.98, 0.56), (0.9, 0.74)]
    specchia(convogliatore, "Convogliatore", 0.16, 0.008, "Telaio", ROSSO)
    grafica = [(0.9, 0.85), (1.12, 0.9), (1.08, 0.78), (0.92, 0.73)]
    specchia(grafica, "GraficaNera", 0.168, 0.004, "Telaio", NERO, suddividi=0)
    serbatoio = [(0.72, 0.94), (1.1, 1.02), (1.12, 0.9), (0.8, 0.82)]
    pannello("Serbatoio", serbatoio, -0.12, 0.12, "Telaio", ROSSO, smussa=0.04)
    fianchetto = [(0.18, 0.88), (0.62, 0.9), (0.6, 0.66), (0.42, 0.62), (0.25, 0.74)]
    specchia(fianchetto, "Fianchetto", 0.13, 0.008, "Telaio", ROSSO)
    codone = [(-0.36, 1.0), (0.2, 0.93), (0.4, 0.9), (0.3, 0.84), (-0.05, 0.86), (-0.3, 0.95)]
    specchia(codone, "Codone", 0.11, 0.008, "Telaio", ROSSO)
    pannello("CodoneSopra", [(-0.36, 1.0), (0.3, 0.93), (0.28, 0.9), (-0.32, 0.97)], -0.11, 0.11, "Telaio", ROSSO, smussa=0.01)
    sella = [(0.15, 0.955), (0.85, 0.975), (0.98, 0.99), (0.98, 0.94), (0.2, 0.9)]
    pannello("Sella", sella, -0.125, 0.125, "Telaio", SELLA, smussa=0.035)
    CUCITURA = materiale("Cucitura", (0.25, 0.25, 0.26), 0.0, 0.7)
    for lato in (1, -1):
        tubo("Cucitura_" + str(lato), [(0.2, 0.105 * lato, 0.95), (0.55, 0.108 * lato, 0.962), (0.9, 0.105 * lato, 0.978)], 0.0025, "Telaio", CUCITURA)
    tubo("CucituraCentro", [(0.25, 0.0, 0.962), (0.6, 0.0, 0.975), (0.88, 0.0, 0.99)], 0.002, "Telaio", CUCITURA)
    # Portatarga e luce dietro
    scatola("Portatarga", (-0.42, 0.0, 0.88), (0.02, 0.16, 0.14), "Telaio", NERO, 0.005, rotazione=(0, math.radians(-20), 0))
    tubo("PortatargaBraccio", [(-0.3, 0.0, 0.95), (-0.4, 0.0, 0.95), (-0.42, 0.0, 0.88)], 0.012, "Telaio", NERO)
    scatola("LuceDietro", (-0.37, 0.0, 0.985), (0.03, 0.08, 0.025), "Telaio", materiale("Luce_Rossa", (0.6, 0.0, 0.0), 0.0, 0.1), 0.005)
    for lato in (1, -1):
        cilindro("Freccia_" + str(lato), (-0.38, 0.06 * lato, 0.93), (-0.4, 0.13 * lato, 0.935), 0.012, "Telaio", VETRO)
    # Pedane
    for lato in (1, -1):
        scatola("Pedana_" + str(lato), (0.6, 0.2 * lato, 0.36), (0.05, 0.09, 0.02), "Telaio", ACCIAIO, 0.004)
    # Numeri "450" sulle fiancate
    scritta("Numero_S", "450", (1.0, 0.171, 0.88), 1, 0.07, "Telaio", BIANCO)
    scritta("Numero_D", "450", (1.0, -0.171, 0.88), -1, 0.07, "Telaio", BIANCO)

    # --- Sterzo: forcella oro, piastre, manubrio, fanale, parafango (tutto gira con lo sterzo)
    asse = Vector((-math.sin(INCLINAZIONE_FORCELLA), 0.0, math.cos(INCLINAZIONE_FORCELLA)))
    for lato in (1, -1):
        y = 0.09 * lato
        piede = RUOTA_ANT + Vector((0.0, y, 0.0))
        cilindro("ForcellaPiede_" + str(lato), piede - asse * 0.03, piede + asse * 0.42, 0.03, "Sterzo", NERO_LUCIDO)
        cilindro("ForcellaOro_" + str(lato), piede + asse * 0.36, piede + asse * 0.82, 0.027, "Sterzo", ORO)
        cilindro("Tappo_" + str(lato), piede + asse * 0.82, piede + asse * 0.86, 0.022, "Sterzo", ALLUMINIO)
        pannello("Parasteli_" + str(lato), [(0.0, 0.0), (0.05, 0.02), (0.03, 0.3), (-0.02, 0.28)],
                 0, 0.01, "Sterzo", ROSSO, smussa=0.004, suddividi=0)
        parasteli = GRUPPI["Sterzo"][-1]
        parasteli.location = piede + Vector((0.04, y * 0.4, 0.02))
        parasteli.rotation_euler = (0, -INCLINAZIONE_FORCELLA, 0)
    for quota, nome in [(0.66, "PiastraSotto"), (0.82, "PiastraSopra")]:
        centro = RUOTA_ANT + asse * quota
        scatola(nome, centro, (0.07, 0.24, 0.025), "Sterzo", ALLUMINIO, 0.008, rotazione=(0, -INCLINAZIONE_FORCELLA, 0))
    sopra = RUOTA_ANT + asse * 0.88
    tubo("Manubrio", [(sopra.x - 0.04, 0.38, sopra.z + 0.08), (sopra.x - 0.03, 0.2, sopra.z + 0.05), (sopra.x, 0.0, sopra.z + 0.03),
                      (sopra.x - 0.03, -0.2, sopra.z + 0.05), (sopra.x - 0.04, -0.38, sopra.z + 0.08)], 0.011, "Sterzo", NERO_LUCIDO)
    for lato in (1, -1):
        y = 0.4 * lato
        cilindro("Manopola_" + str(lato), (sopra.x - 0.04, y - 0.06 * lato, sopra.z + 0.08), (sopra.x - 0.045, y + 0.04 * lato, sopra.z + 0.085), 0.017, "Sterzo", GOMMA)
        pannello("Paramani_" + str(lato), [(0.0, 0.0), (0.12, 0.01), (0.1, 0.05), (0.01, 0.04)], 0, 0.02, "Sterzo", ROSSO, smussa=0.006)
        paramani = GRUPPI["Sterzo"][-1]
        paramani.location = (sopra.x - 0.02, y - 0.05 * lato, sopra.z + 0.05)
        paramani.rotation_euler = (0, 0, math.radians(90 * lato))
        tubo("Specchio_Stelo_" + str(lato), [(sopra.x - 0.03, 0.26 * lato, sopra.z + 0.07), (sopra.x - 0.05, 0.3 * lato, sopra.z + 0.16)], 0.006, "Sterzo", NERO)
        cilindro("Specchio_" + str(lato), (sopra.x - 0.055, 0.3 * lato, sopra.z + 0.2), (sopra.x - 0.045, 0.3 * lato, sopra.z + 0.2), 0.045, "Sterzo", NERO_LUCIDO)
        cilindro("Leva_" + str(lato), (sopra.x - 0.02, 0.25 * lato, sopra.z + 0.06), (sopra.x + 0.07, 0.36 * lato, sopra.z + 0.06), 0.006, "Sterzo", ALLUMINIO)
    # Tabella con fanale
    tabella = [(0.0, 0.0), (0.06, 0.02), (0.05, 0.26), (-0.04, 0.24)]
    pannello("Tabella", tabella, -0.1, 0.1, "Sterzo", ROSSO, smussa=0.02)
    GRUPPI["Sterzo"][-1].location = RUOTA_ANT + asse * 0.58 + Vector((0.07, 0, 0))
    GRUPPI["Sterzo"][-1].rotation_euler = (0, -INCLINAZIONE_FORCELLA * 0.6, 0)
    centro_faro = RUOTA_ANT + asse * 0.68 + Vector((0.13, 0, 0))
    direzione_faro = Vector((math.cos(INCLINAZIONE_FORCELLA * 0.6), 0, math.sin(INCLINAZIONE_FORCELLA * 0.6)))
    cilindro("Parabola", centro_faro - direzione_faro * 0.02, centro_faro, 0.06, "Sterzo", ACCIAIO, lati=32)
    cilindro("Fanale", centro_faro, centro_faro + direzione_faro * 0.008, 0.055, "Sterzo", VETRO, lati=32)
    cilindro("CorniceFanale", centro_faro - direzione_faro * 0.004, centro_faro + direzione_faro * 0.006, 0.064, "Sterzo", NERO_LUCIDO, lati=32)
    # Parafango alto davanti
    parafango = [(-0.06, 0.0), (0.42, 0.04), (0.44, 0.06), (0.1, 0.05), (-0.08, 0.03)]
    pannello("Parafango", parafango, -0.08, 0.08, "Sterzo", ROSSO, smussa=0.015)
    GRUPPI["Sterzo"][-1].location = RUOTA_ANT + asse * 0.6 + Vector((0.0, 0, -0.06))
    tubo("TuboFrenoDavanti", [(RUOTA_ANT.x - 0.1, 0.09, RUOTA_ANT.z + 0.12), (RUOTA_ANT.x - 0.2, 0.11, RUOTA_ANT.z + 0.45), (sopra.x - 0.02, 0.18, sopra.z + 0.06)], 0.004, "Sterzo", NERO)
    # Pinza del freno davanti
    scatola("Pinza", RUOTA_ANT + Vector((-0.1, 0.08, 0.1)), (0.07, 0.03, 0.09), "Sterzo", ORO, 0.01)

    # Applico le trasformazioni a tutto (servono per l'esportazione)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")


def esporta():
    # Ogni gruppo diventa un solo oggetto (una mesh con piu' materiali), con l'origine al suo perno
    CARTELLA.mkdir(parents=True, exist_ok=True)
    origini = {"Telaio": RUOTA_POST, "Forcellone": RUOTA_POST, "Sterzo": RUOTA_ANT,
               "RuotaPosteriore": RUOTA_POST, "RuotaAnteriore": RUOTA_ANT}
    for gruppo, oggetti in GRUPPI.items():
        bpy.ops.object.select_all(action="DESELECT")
        for oggetto in oggetti:
            oggetto.select_set(True)
        bpy.context.view_layer.objects.active = oggetti[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        bpy.ops.object.join()
        unico = bpy.context.object
        unico.name = "SM450_" + gruppo
        unico.data.name = "SM450_" + gruppo
        unico.data.transform(Matrix.Translation(-origini[gruppo]))
        bpy.ops.export_scene.gltf(filepath=str(CARTELLA / ("SM450_" + gruppo + ".glb")), use_selection=True,
                                  export_format="GLB", export_apply=True, export_yup=True)
        print("Esportato " + gruppo + ": " + str(len(unico.data.polygons)) + " poligoni")


def foto(percorso, posizione, guarda, lente=55):
    # Anteprima: studio bianco come le foto di riferimento
    scena = bpy.context.scene
    scena.render.engine = "CYCLES"
    scena.cycles.samples = 48
    scena.cycles.use_denoising = True
    scena.render.resolution_x = 1200
    scena.render.resolution_y = 800
    scena.view_settings.view_transform = "Standard"
    scena.view_settings.exposure = -0.4
    if scena.world is None:
        scena.world = bpy.data.worlds.new("Studio")
    scena.world.use_nodes = True
    scena.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    scena.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    if "Pavimento" not in bpy.data.objects:
        bpy.ops.mesh.primitive_plane_add(size=40, location=(0.7, 0, 0))
        bpy.context.object.name = "Pavimento"
        bpy.context.object.data.materials.append(materiale("Pavimento", (0.95, 0.95, 0.95), 0.0, 0.6))
        bpy.ops.object.light_add(type="AREA", location=(1.5, 2.5, 3.0))
        luce = bpy.context.object
        luce.data.energy = 500
        luce.data.size = 4
        luce.rotation_euler = (math.radians(-40), 0, math.radians(30))
        bpy.ops.object.light_add(type="AREA", location=(0.5, -3.0, 2.0))
        luce = bpy.context.object
        luce.data.energy = 250
        luce.data.size = 4
        luce.rotation_euler = (math.radians(50), 0, 0)
    bpy.ops.object.camera_add(location=posizione)
    camera = bpy.context.object
    camera.data.lens = lente
    direzione = Vector(guarda) - Vector(posizione)
    camera.rotation_euler = direzione.to_track_quat("-Z", "Y").to_euler()
    scena.camera = camera
    scena.render.filepath = str(percorso)
    bpy.ops.render.render(write_still=True)


costruisci()
if "--foto" in sys.argv:
    indice = sys.argv.index("--foto")
    uscita = Path(sys.argv[indice + 1]) if len(sys.argv) > indice + 1 else Path(".")
    foto(uscita / "sm450_tre_quarti.png", (3.6, -2.7, 1.3), (0.72, 0, 0.55))
    foto(uscita / "sm450_lato.png", (0.72, -4.6, 0.65), (0.72, 0, 0.6))
esporta()
