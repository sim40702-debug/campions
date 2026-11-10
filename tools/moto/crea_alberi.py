# Crea i due alberi per Unreal (latifoglia e conifera) con Blender.
# Uso: python3 tools/moto/crea_alberi.py
# Escono in unreal/MotoRacingWorld/ImportMoto/Alberi: MRW_Latifoglia.glb e MRW_Conifera.glb
# (origine alla base del tronco, misure in metri). Li importa mrw_importa_moto.py.

import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crea_moto_450 as base

CARTELLA = Path(__file__).resolve().parents[2] / "unreal" / "MotoRacingWorld" / "ImportMoto" / "Alberi"


def pulisci():
    for oggetto in list(bpy.data.objects):
        bpy.data.objects.remove(oggetto)
    for lista in base.GRUPPI.values():
        lista.clear()


def chioma(nome, centro, raggio, mat, schiaccia=0.85):
    # una "nuvola" di foglie: icosfera deformata a caso, cosi' non sembra una palla perfetta
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=raggio, location=centro)
    nuvola = bpy.context.object
    nuvola.name = nome
    for vertice in nuvola.data.vertices:
        vertice.co *= 0.85 + random.random() * 0.3
        vertice.co.z *= schiaccia
    for poligono in nuvola.data.polygons:
        poligono.use_smooth = False
    base.metti(nuvola, "Telaio", mat)


def esporta(nome):
    CARTELLA.mkdir(parents=True, exist_ok=True)
    oggetti = base.GRUPPI["Telaio"]
    bpy.ops.object.select_all(action="DESELECT")
    for oggetto in oggetti:
        oggetto.select_set(True)
    bpy.context.view_layer.objects.active = oggetti[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    bpy.context.object.name = nome
    bpy.ops.export_scene.gltf(filepath=str(CARTELLA / (nome + ".glb")), use_selection=True, export_format="GLB", export_yup=True)
    print(nome + ": " + str(len(bpy.context.object.data.polygons)) + " poligoni")


random.seed(7)
CORTECCIA = base.materiale("Corteccia", (0.16, 0.11, 0.07), 0.0, 0.9)
FOGLIE = base.materiale("Foglie", (0.11, 0.24, 0.06), 0.0, 0.75)
FOGLIE2 = base.materiale("Foglie_Chiare", (0.17, 0.3, 0.08), 0.0, 0.75)
AGHI = base.materiale("Aghi", (0.06, 0.14, 0.06), 0.0, 0.8)

# --- latifoglia (castagno/faggio): tronco, tre rami, chioma a nuvole
pulisci()
base.cilindro("Tronco", (0, 0, 0), (0, 0, 3.6), 0.28, "Telaio", CORTECCIA, lati=10)
for i, angolo in enumerate([0, 2.1, 4.2]):
    fine = Vector((math.cos(angolo) * 1.4, math.sin(angolo) * 1.4, 5.0))
    base.cilindro("Ramo" + str(i), (0, 0, 3.2), fine, 0.1, "Telaio", CORTECCIA, lati=7)
chioma("Chioma0", (0, 0, 5.6), 2.4, FOGLIE)
for i, angolo in enumerate([0.3, 1.9, 3.4, 4.9]):
    chioma("Chioma" + str(i + 1), (math.cos(angolo) * 1.6, math.sin(angolo) * 1.6, 4.8 + (i % 2) * 0.6), 1.7, FOGLIE2 if i % 2 else FOGLIE)
chioma("ChiomaAlta", (0.2, -0.2, 7.0), 1.5, FOGLIE2)
esporta("MRW_Latifoglia")

# --- conifera (abete): tronco e 6 palchi di rami sempre piu' stretti
pulisci()
base.cilindro("Tronco", (0, 0, 0), (0, 0, 9.5), 0.22, "Telaio", CORTECCIA, lati=10)
for i in range(6):
    raggio = 2.6 - i * 0.38
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=raggio, radius2=0.05, depth=2.6 - i * 0.18, location=(0, 0, 2.2 + i * 1.25))
    cono = bpy.context.object
    for vertice in cono.data.vertices:
        if vertice.co.z < 0:
            vertice.co.x *= 0.9 + random.random() * 0.2
            vertice.co.y *= 0.9 + random.random() * 0.2
            vertice.co.z -= random.random() * 0.25
    base.metti(cono, "Telaio", AGHI)
esporta("MRW_Conifera")
