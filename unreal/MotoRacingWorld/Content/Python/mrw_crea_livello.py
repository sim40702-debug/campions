# Ticino Motorcycle Simulator - crea il livello di partenza (Fase 2: rendering)
#
# Da lanciare DENTRO l'editor di Unreal:
#   Tools -> Execute Python Script... -> scegli questo file
# (oppure nella console Python dell'editor: exec(open("percorso/mrw_crea_livello.py").read()))
#
# Crea /Game/Mappe/Ticino_Locarnese con:
# - sole (luce direzionale collegata all'atmosfera)
# - cielo fisico (Sky Atmosphere) e nuvole volumetriche
# - nebbia con nebbia volumetrica
# - luce del cielo con cattura in tempo reale (Lumen)
# - post-processing per tutto il livello (TSR, esposizione automatica)
# - parametri globali dei materiali MPC_Meteo (Notte, Pioggia, Bagnato)
# - ciclo giorno/notte e meteo (AMRWCicloGiorno, C++)
# - materiali del terreno (foto aeree), dell'asfalto e del lago, che diventano bagnati con la pioggia
# - il terreno e le strade del Locarnese (AMRWTerreno, C++), che legge la cartella Dati
# - gli edifici con le finestre (AMRWEdifici) e gli alberi nei boschi (AMRWAlberi)
#
# Prima scarica i dati con mrw_scarica_dati.py.
# Se un oggetto c'e' gia' non viene creato di nuovo: lo script si puo' lanciare piu' volte.

import unreal

MAPPA = "/Game/Mappe/Ticino_Locarnese"
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
    # Mappa vuota: cielo, luci e terreno li aggiunge questo script.
    # (World Partition e Landscape arrivano nella fase 7, open world)
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


materiali = unreal.MaterialEditingLibrary


def nodo(materiale, classe, x, y):
    return materiali.create_material_expression(materiale, classe, x, y)


def nodo_bagnato(materiale, mpc, x, y):
    # Legge "Bagnato" (0 = asciutto, 1 = bagnato) da MPC_Meteo
    parametro = nodo(materiale, unreal.MaterialExpressionCollectionParameter, x, y)
    parametro.set_editor_property("collection", mpc)
    parametro.set_editor_property("parameter_name", "Bagnato")
    return parametro


def nodo_lerp(materiale, asciutto, bagnato, alfa, x, y):
    # Valore che passa da "asciutto" a "bagnato" secondo alfa
    lerp = nodo(materiale, unreal.MaterialExpressionLinearInterpolate, x, y)
    lerp.set_editor_property("const_a", asciutto)
    lerp.set_editor_property("const_b", bagnato)
    materiali.connect_material_expressions(alfa, "", lerp, "Alpha")
    return lerp


def nuovo_materiale(nome):
    percorso = CARTELLA_MATERIALI + "/" + nome
    if risorse.does_asset_exist(percorso):
        return risorse.load_asset(percorso), False
    strumenti = unreal.AssetToolsHelpers.get_asset_tools()
    materiale = strumenti.create_asset(nome, CARTELLA_MATERIALI, unreal.Material, unreal.MaterialFactoryNew())
    return materiale, True


def finisci_materiale(materiale, nome):
    materiali.recompile_material(materiale)
    risorse.save_loaded_asset(materiale)
    scrivi("Creato " + nome)


def crea_materiale_terreno(mpc):
    # Foto aerea SWISSIMAGE (parametro "Foto", la mette il C++), piu' scura e lucida quando piove
    materiale, nuovo = nuovo_materiale("M_MRW_Terreno")
    if not nuovo:
        return materiale
    materiale.set_editor_property("two_sided", True)
    foto = nodo(materiale, unreal.MaterialExpressionTextureSampleParameter2D, -700, -100)
    foto.set_editor_property("parameter_name", "Foto")
    foto.set_editor_property("texture", unreal.load_asset("/Engine/EngineResources/DefaultTexture.DefaultTexture"))
    bagnato = nodo_bagnato(materiale, mpc, -700, 250)
    scuro = nodo_lerp(materiale, 1.0, 0.7, bagnato, -450, 150)
    colore = nodo(materiale, unreal.MaterialExpressionMultiply, -250, -50)
    materiali.connect_material_expressions(foto, "RGB", colore, "A")
    materiali.connect_material_expressions(scuro, "", colore, "B")
    materiali.connect_material_property(colore, "", unreal.MaterialProperty.MP_BASE_COLOR)
    ruvido = nodo_lerp(materiale, 0.95, 0.45, bagnato, -450, 350)
    materiali.connect_material_property(ruvido, "", unreal.MaterialProperty.MP_ROUGHNESS)
    finisci_materiale(materiale, "M_MRW_Terreno")
    return materiale


def crea_materiale_asfalto(mpc):
    # Asfalto grigio scuro: con la pioggia piu' scuro e quasi a specchio
    materiale, nuovo = nuovo_materiale("M_MRW_Asfalto")
    if not nuovo:
        return materiale
    materiale.set_editor_property("two_sided", True)
    grigio = nodo(materiale, unreal.MaterialExpressionConstant3Vector, -700, -100)
    grigio.set_editor_property("constant", unreal.LinearColor(0.07, 0.07, 0.075, 1.0))
    bagnato = nodo_bagnato(materiale, mpc, -700, 250)
    scuro = nodo_lerp(materiale, 1.0, 0.6, bagnato, -450, 150)
    colore = nodo(materiale, unreal.MaterialExpressionMultiply, -250, -50)
    materiali.connect_material_expressions(grigio, "", colore, "A")
    materiali.connect_material_expressions(scuro, "", colore, "B")
    materiali.connect_material_property(colore, "", unreal.MaterialProperty.MP_BASE_COLOR)
    ruvido = nodo_lerp(materiale, 0.8, 0.1, bagnato, -450, 350)
    materiali.connect_material_property(ruvido, "", unreal.MaterialProperty.MP_ROUGHNESS)
    finisci_materiale(materiale, "M_MRW_Asfalto")
    return materiale


def crea_materiale_acqua():
    # Lago: blu scuro e liscio (riflessi da Lumen)
    materiale, nuovo = nuovo_materiale("M_MRW_Acqua")
    if not nuovo:
        return materiale
    materiale.set_editor_property("two_sided", True)
    blu = nodo(materiale, unreal.MaterialExpressionConstant3Vector, -500, -100)
    blu.set_editor_property("constant", unreal.LinearColor(0.015, 0.045, 0.06, 1.0))
    materiali.connect_material_property(blu, "", unreal.MaterialProperty.MP_BASE_COLOR)
    liscio = nodo(materiale, unreal.MaterialExpressionConstant, -500, 150)
    liscio.set_editor_property("r", 0.04)
    materiali.connect_material_property(liscio, "", unreal.MaterialProperty.MP_ROUGHNESS)
    finisci_materiale(materiale, "M_MRW_Acqua")
    return materiale


def crea_materiale_edificio(mpc):
    # Facciate e tetti: texture "Facciata" (disegnata dal C++) per il colore dei vertici (colore di ogni casa);
    # con la pioggia piu' scuro e piu' lucido
    materiale, nuovo = nuovo_materiale("M_MRW_Edificio")
    if not nuovo:
        return materiale
    materiale.set_editor_property("two_sided", True)
    facciata = nodo(materiale, unreal.MaterialExpressionTextureSampleParameter2D, -800, -150)
    facciata.set_editor_property("parameter_name", "Facciata")
    facciata.set_editor_property("texture", unreal.load_asset("/Engine/EngineResources/DefaultTexture.DefaultTexture"))
    colore_vertici = nodo(materiale, unreal.MaterialExpressionVertexColor, -800, 120)
    per = nodo(materiale, unreal.MaterialExpressionMultiply, -500, -50)
    materiali.connect_material_expressions(facciata, "RGB", per, "A")
    materiali.connect_material_expressions(colore_vertici, "", per, "B")
    bagnato = nodo_bagnato(materiale, mpc, -800, 320)
    scuro = nodo_lerp(materiale, 1.0, 0.75, bagnato, -500, 200)
    colore = nodo(materiale, unreal.MaterialExpressionMultiply, -250, 0)
    materiali.connect_material_expressions(per, "", colore, "A")
    materiali.connect_material_expressions(scuro, "", colore, "B")
    materiali.connect_material_property(colore, "", unreal.MaterialProperty.MP_BASE_COLOR)
    ruvido = nodo_lerp(materiale, 0.85, 0.35, bagnato, -250, 300)
    materiali.connect_material_property(ruvido, "", unreal.MaterialProperty.MP_ROUGHNESS)
    finisci_materiale(materiale, "M_MRW_Edificio")
    return materiale


def prepara_citta(mpc):
    # Edifici con finestre e alberi nei boschi (classi C++)
    if hasattr(unreal, "MRWEdifici"):
        edifici = trova_o_crea(unreal.MRWEdifici)
        edifici.set_editor_property("materiale_edificio", crea_materiale_edificio(mpc))
    if hasattr(unreal, "MRWAlberi"):
        trova_o_crea(unreal.MRWAlberi)


def prepara_post_processing(post):
    # Aspetto "da film": esposizione automatica limitata, un po' di bloom e di vignetta,
    # occlusione ambientale, motion blur leggero
    impostazioni = post.get_editor_property("settings")
    valori = {
        "override_auto_exposure_min_brightness": True, "auto_exposure_min_brightness": 0.6,
        "override_auto_exposure_max_brightness": True, "auto_exposure_max_brightness": 2.0,
        "override_bloom_intensity": True, "bloom_intensity": 0.45,
        "override_vignette_intensity": True, "vignette_intensity": 0.25,
        "override_ambient_occlusion_intensity": True, "ambient_occlusion_intensity": 0.6,
        "override_motion_blur_amount": True, "motion_blur_amount": 0.3,
    }
    for nome, valore in valori.items():
        try:
            impostazioni.set_editor_property(nome, valore)
        except Exception as errore:
            scrivi("post-processing: " + nome + " non impostato (" + str(errore) + ")")
    post.set_editor_property("settings", impostazioni)


def prepara_terreno(mpc):
    if not hasattr(unreal, "MRWTerreno"):
        scrivi("ATTENZIONE: classe C++ MRWTerreno non trovata. Compila il progetto e rilancia lo script.")
        return
    terreno = trova_o_crea(unreal.MRWTerreno)
    terreno.set_editor_property("materiale_terreno", crea_materiale_terreno(mpc))
    terreno.set_editor_property("materiale_strada", crea_materiale_asfalto(mpc))
    terreno.set_editor_property("materiale_acqua", crea_materiale_acqua())


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
    prepara_post_processing(post)
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
prepara_terreno(mpc)
prepara_citta(mpc)
livelli.save_current_level()
scrivi("Fatto: " + MAPPA)
