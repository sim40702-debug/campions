# Configurazione della mappa del Canton Ticino
# Tutti gli altri script leggono i valori da qui.
# Le coordinate sono in LV95 (EPSG:2056), in metri, come i dati swisstopo.

from pathlib import Path

# --- Cartelle ---------------------------------------------------------------
# Cartella di questo file (tools/geo)
CARTELLA_SCRIPT = Path(__file__).resolve().parent

# Qui finiscono i dati scaricati e i file creati per Unreal.
# Questa cartella NON va su Git (vedi .gitignore): i file sono troppo grandi.
CARTELLA_DATI = CARTELLA_SCRIPT / "dati"
CARTELLA_DOWNLOAD = CARTELLA_DATI / "download"
CARTELLA_UNREAL = CARTELLA_DATI / "per_unreal"

# --- Rettangolo del mondo (decisione D1: scala 1:1) -------------------------
# 68 x 96 km: contiene tutto il Ticino con un po' di margine.
MONDO_EST_MIN = 2_668_000
MONDO_EST_MAX = 2_736_000
MONDO_NORD_MIN = 1_074_000
MONDO_NORD_MAX = 1_170_000

# Centro del mondo = punto (0, 0) in Unreal
ORIGINE_EST = 2_702_000
ORIGINE_NORD = 1_122_000

# --- Settore pilota (decisione D5: Locarno - Ascona - Ponte Brolla) --------
PILOTA_EST_MIN = 2_700_000
PILOTA_EST_MAX = 2_708_000
PILOTA_NORD_MIN = 1_110_000
PILOTA_NORD_MAX = 1_118_000

# --- Area dell'anteprima giocabile (Three.js): Locarnese 16 x 12 km ---------
# Da Ponte Brolla/Tegna a Tenero/Gordola, da Ascona alla Cimetta.
ANTEPRIMA_EST_MIN = 2_696_000
ANTEPRIMA_EST_MAX = 2_712_000
ANTEPRIMA_NORD_MIN = 1_110_000
ANTEPRIMA_NORD_MAX = 1_122_000

# --- Settori e terreno (decisione D2: circa 2 m) ---------------------------
LATO_SETTORE_M = 4000          # ogni settore e' 4 x 4 km
QUAD_PER_SETTORE = 2032        # 16 componenti Unreal da 127 quad
PUNTI_PER_SETTORE = QUAD_PER_SETTORE + 1   # 2033 punti (il bordo e' condiviso)
PASSO_M = LATO_SETTORE_M / QUAD_PER_SETTORE  # 1.9685 m tra due punti

# --- Altezze per Unreal ------------------------------------------------------
# Unreal salva le altezze a 16 bit (0 - 65535).
# Altezza in cm = (valore - 32768) * SCALA_Z / 128
SCALA_Z = 700                  # Scale Z del Landscape in Unreal
QUOTA_CENTRO_M = 1800          # il valore 32768 corrisponde a 1800 m
# Cosi' in Unreal la Z del mondo (in cm) = quota reale (in m) * 100

# Quota usata dove mancano i dati (sotto il livello del Lago Maggiore)
QUOTA_SE_MANCA_M = 190

# --- Confine cantonale -------------------------------------------------------
LARGHEZZA_CONFINE_M = 8        # larghezza della striscia del confine nel layer

# --- Strade (decisione D3: strade pubbliche asfaltate) ----------------------
TIPI_STRADA = [
    "motorway", "motorway_link",
    "trunk", "trunk_link",
    "primary", "primary_link",
    "secondary", "secondary_link",
    "tertiary", "tertiary_link",
    "unclassified", "residential", "living_street",
]

# --- Servizi online (dati aperti) -------------------------------------------
STAC_SWISSALTI3D = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
# Se il server principale non risponde, si provano questi (stessi dati OpenStreetMap)
OVERPASS_RISERVA = [
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
COPERNICUS_URL = "https://copernicus-dem-30m.s3.amazonaws.com"

# Nome del programma inviato ai server (regola di cortesia di Overpass)
NOME_PROGRAMMA = "MotoRacingWorld-geo/0.1"
