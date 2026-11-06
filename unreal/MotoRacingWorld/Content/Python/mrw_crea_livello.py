# Ticino Motorcycle Simulator - crea il livello di partenza (Fase 2: rendering)
#
# Da lanciare DENTRO l'editor di Unreal:
#   Tools -> Execute Python Script... -> scegli questo file
# (oppure nella console Python dell'editor: exec(open("percorso/mrw_crea_livello.py").read()))
#
# Crea /Game/Mappe/Ticino_Locarnese con World Partition e:
# - sole (luce direzionale collegata all'atmosfera)
# - cielo fisico (Sky Atmosphere) e nuvole volumetriche
# - nebbia con nebbia volumetrica
# - luce del cielo con cattura in tempo reale (Lumen)
# - post-processing per tutto il livello (TSR, esposizione automatica)
# - parametri globali dei materiali MPC_Meteo (Notte, Pioggia, Bagnato)
# - ciclo giorno/notte e meteo (AMRWCicloGiorno, C++)
#
# Se un oggetto c'e' gia' (per esempio dal modello "Open World") non viene creato di nuovo.

import unreal

MAPPA = "/Game/Mappe/Ticino_Locarnese"
MODELLO_OPEN_WORLD = "/Engine/Maps/Templates/OpenWorld"
CARTELLA_MATERIALI = "/Game/MRW/Materiali"

livelli = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
attori = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
risorse = unreal.EditorAssetLibrary


def scrivi(testo):
    unreal.log("[MRW] " + testo)


def crea_mappa():
    if risorse.does_asset_exist(MAPPA):
        scrivi("La mappa esiste gia': la apro")
        livelli.load_level(MAPPA)
        return
    # Mappa con World Partition dal modello "Open World" di Unreal
    if not livelli.new_level_from_template(MAPPA, MODELLO_OPEN_WORLD):
        scrivi("Modello Open World non trovato: creo una mappa vuota")
        livelli.new_level(MAPPA)


def trova(classe):
    for attore in attori.get_all_level_actors():
        if isinstance(attore, classe):
            return attore
    return None


def trova_o_crea(classe, posizione=unreal.Vector(0, 0, 0), rotazione=unreal.Rotator(0, 0, 0)):
    attore = trova(classe)
    if attore is None:
        attore = attori.spawn_actor_from_class(classe, posizione, rotazione)
        scrivi("Creato: " + classe.__name__)
    else:
        scrivi("Gia' presente: " + classe.__name__)
    return attore


def crea_parametri_meteo():
    percorso = CARTELLA_MATERIALI + "/MPC_Meteo"
    if risorse.does_asset_exist(percorso):
        return risorse.load_asset(percorso)
    strumenti = unreal.AssetToolsHelpers.get_asset_tools()
    mpc = strumenti.create_asset("MPC_Meteo", CARTELLA_MATERIALI, unreal.MaterialParameterCollection,
                                 unreal.MaterialParameterCollectionFactoryNew())
    parametri = []
    for nome in ["Notte", "Pioggia", "Bagnato"]:
        parametro = unreal.CollectionScalarParameter()
        parametro.set_editor_property("parameter_name", nome)
        parametro.set_editor_property("default_value", 0.0)
        parametri.append(parametro)
    mpc.set_editor_property("scalar_parameters", parametri)
    risorse.save_loaded_asset(mpc)
    scrivi("Creato MPC_Meteo (Notte, Pioggia, Bagnato)")
    return mpc


def prepara_luci_e_cielo():
    sole = trova_o_crea(unreal.DirectionalLight, unreal.Vector(0, 0, 50000), unreal.Rotator(0, -40, 0))
    luce = sole.get_component_by_class(unreal.DirectionalLightComponent)
    luce.set_editor_property("atmosphere_sun_light", True)
    luce.set_editor_property("use_temperature", True)
    luce.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)

    trova_o_crea(unreal.SkyAtmosphere)
    trova_o_crea(unreal.VolumetricCloud)

    cielo = trova_o_crea(unreal.SkyLight)
    luce_cielo = cielo.get_component_by_class(unreal.SkyLightComponent)
    luce_cielo.set_editor_property("real_time_capture", True)
    luce_cielo.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)

    nebbia = trova_o_crea(unreal.ExponentialHeightFog)
    componente_nebbia = nebbia.get_component_by_class(unreal.ExponentialHeightFogComponent)
    componente_nebbia.set_editor_property("volumetric_fog", True)
    componente_nebbia.set_editor_property("fog_density", 0.02)

    post = trova_o_crea(unreal.PostProcessVolume)
    post.set_editor_property("unbound", True)
    return sole, nebbia


def prepara_ciclo_giorno(sole, nebbia, mpc):
    if not hasattr(unreal, "MRWCicloGiorno"):
        scrivi("ATTENZIONE: classe C++ MRWCicloGiorno non trovata. Compila il progetto e rilancia lo script.")
        return
    ciclo = trova_o_crea(unreal.MRWCicloGiorno)
    ciclo.set_editor_property("sole_luce", sole)
    ciclo.set_editor_property("nebbia_attore", nebbia)
    ciclo.set_editor_property("parametri_meteo", mpc)
    ciclo.set_editor_property("ora_del_giorno", 10.0)


crea_mappa()
mpc = crea_parametri_meteo()
sole, nebbia = prepara_luci_e_cielo()
prepara_ciclo_giorno(sole, nebbia, mpc)
livelli.save_current_level()
scrivi("Fatto: " + MAPPA)
