# Ticino Motorcycle Simulator - importa la moto 3D "MRW SM 450" in Unreal
#
# Da lanciare DENTRO l'editor: Tools -> Execute Python Script... -> questo file
#
# Prende i 5 pezzi .glb dalla cartella ImportMoto/SM450 del progetto
# (creati con tools/moto/crea_moto_450.py) e li mette in /Game/MRW/Moto/SM450.
# Quando ci sono, la moto del gioco (AMRWMoto) li usa al posto delle forme semplici.

import os

import unreal

PEZZI = ["Telaio", "Forcellone", "Sterzo", "RuotaPosteriore", "RuotaAnteriore"]
DESTINAZIONE = "/Game/MRW/Moto/SM450"


def scrivi(testo):
    unreal.log("[MRW] " + testo)


progetto = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
cartella = os.path.join(progetto, "ImportMoto", "SM450")

for pezzo in PEZZI:
    nome = "SM450_" + pezzo
    file = os.path.join(cartella, nome + ".glb")
    if not os.path.exists(file):
        scrivi("Manca " + file)
        continue

    compito = unreal.AssetImportTask()
    compito.set_editor_property("filename", file)
    compito.set_editor_property("destination_path", DESTINAZIONE + "/" + pezzo)
    compito.set_editor_property("automated", True)
    compito.set_editor_property("replace_existing", True)
    compito.set_editor_property("save", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([compito])

    # Cerco la mesh importata e le do il nome che usa il gioco
    finale = DESTINAZIONE + "/" + nome
    for percorso in compito.get_editor_property("imported_object_paths"):
        risorsa = unreal.EditorAssetLibrary.load_asset(percorso)
        if isinstance(risorsa, unreal.StaticMesh):
            if unreal.EditorAssetLibrary.does_asset_exist(finale) and percorso.split(".")[0] != finale:
                unreal.EditorAssetLibrary.delete_asset(finale)
            if percorso.split(".")[0] != finale:
                unreal.EditorAssetLibrary.rename_asset(percorso.split(".")[0], finale)
            scrivi("Importato " + finale)
            break
    else:
        scrivi("ATTENZIONE: nessuna mesh trovata in " + file)

unreal.EditorAssetLibrary.save_directory(DESTINAZIONE)
scrivi("Fatto: premi Play, la moto usa il modello 3D")
