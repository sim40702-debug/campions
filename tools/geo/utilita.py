# Funzioni usate da piu' script.
# Funzionano uguale su Mac e su Windows (si usa pathlib per i percorsi).

import argparse
import json
import time

import numpy as np
import requests
from pyproj import Transformer

import config


# --- Cartelle e argomenti ----------------------------------------------------

def crea_cartelle():
    config.CARTELLA_DOWNLOAD.mkdir(parents=True, exist_ok=True)
    config.CARTELLA_UNREAL.mkdir(parents=True, exist_ok=True)


def leggi_argomenti(descrizione):
    # Ogni script accetta --pilota per lavorare solo sul settore pilota 8 x 8 km
    parser = argparse.ArgumentParser(description=descrizione)
    parser.add_argument("--pilota", action="store_true",
                        help="lavora solo sul settore pilota (Locarno 8 x 8 km)")
    return parser.parse_args()


def area_di_lavoro(pilota):
    # Restituisce (est_min, est_max, nord_min, nord_max) in metri LV95
    if pilota:
        return (config.PILOTA_EST_MIN, config.PILOTA_EST_MAX,
                config.PILOTA_NORD_MIN, config.PILOTA_NORD_MAX)
    return (config.MONDO_EST_MIN, config.MONDO_EST_MAX,
            config.MONDO_NORD_MIN, config.MONDO_NORD_MAX)


def nome_area(pilota):
    if pilota:
        return "pilota"
    return "ticino"


# --- Settori -------------------------------------------------------------------

def nome_settore(est_min, nord_min):
    # Esempio: S_2700_1110 = angolo sud-ovest a 2'700 km est e 1'110 km nord
    return "S_" + str(est_min // 1000) + "_" + str(nord_min // 1000)


def elenco_settori(area):
    # Divide l'area in settori da 4 x 4 km.
    # x = colonna (da ovest a est), y = riga (da NORD a sud), come in Unreal.
    est_min, est_max, nord_min, nord_max = area
    lato = config.LATO_SETTORE_M
    settori = []
    colonne = (est_max - est_min) // lato
    righe = (nord_max - nord_min) // lato
    for y in range(righe):
        for x in range(colonne):
            e = est_min + x * lato
            n = nord_max - (y + 1) * lato
            settori.append({
                "nome": nome_settore(e, n),
                "x": x,
                "y": y,
                "est_min": e,
                "est_max": e + lato,
                "nord_min": n,
                "nord_max": n + lato,
            })
    return settori


# --- Coordinate ----------------------------------------------------------------

# Da GPS (WGS84) a svizzere (LV95) e viceversa. always_xy = (lon, lat) / (est, nord)
DA_WGS84_A_LV95 = Transformer.from_crs(4326, 2056, always_xy=True)
DA_LV95_A_WGS84 = Transformer.from_crs(2056, 4326, always_xy=True)


def area_in_wgs84(area):
    # Restituisce (lon_min, lat_min, lon_max, lat_max) che contiene l'area
    est_min, est_max, nord_min, nord_max = area
    lon1, lat1 = DA_LV95_A_WGS84.transform(est_min, nord_min)
    lon2, lat2 = DA_LV95_A_WGS84.transform(est_max, nord_max)
    lon3, lat3 = DA_LV95_A_WGS84.transform(est_min, nord_max)
    lon4, lat4 = DA_LV95_A_WGS84.transform(est_max, nord_min)
    return (min(lon1, lon3), min(lat1, lat4), max(lon2, lon4), max(lat2, lat3))


def da_lv95_a_unreal(est, nord, quota):
    # Unreal: 1 unita' = 1 cm. X verso est, Y verso SUD, Z verso l'alto.
    x = (est - config.ORIGINE_EST) * 100
    y = -(nord - config.ORIGINE_NORD) * 100
    z = quota * 100
    return x, y, z


def quote_in_valori_16bit(quote_m):
    # Trasforma le quote (metri) nei valori 0-65535 che Unreal legge dal PNG
    centimetri = (quote_m - config.QUOTA_CENTRO_M) * 100
    valori = 32768 + np.round(centimetri * 128 / config.SCALA_Z)
    valori = np.clip(valori, 0, 65535)
    return valori.astype(np.uint16)


def valori_16bit_in_quote(valori):
    # Il contrario: serve per controllare il risultato
    centimetri = (valori.astype(np.float64) - 32768) * config.SCALA_Z / 128
    return centimetri / 100 + config.QUOTA_CENTRO_M


# --- Download ------------------------------------------------------------------

def scarica_file(url, percorso, tentativi=3):
    # Scarica un file solo se non c'e' gia' (cosi' si puo' riprendere un download)
    if percorso.exists() and percorso.stat().st_size > 0:
        return False
    percorso.parent.mkdir(parents=True, exist_ok=True)
    temporaneo = percorso.with_name(percorso.name + ".parziale")
    for tentativo in range(1, tentativi + 1):
        try:
            risposta = requests.get(url, stream=True, timeout=120,
                                    headers={"User-Agent": config.NOME_PROGRAMMA})
            risposta.raise_for_status()
            with open(temporaneo, "wb") as file:
                for pezzo in risposta.iter_content(chunk_size=1024 * 1024):
                    file.write(pezzo)
            temporaneo.replace(percorso)
            return True
        except requests.RequestException as errore:
            print("  Errore (tentativo " + str(tentativo) + "): " + str(errore))
            if temporaneo.exists():
                temporaneo.unlink()
            time.sleep(5 * tentativo)
    raise RuntimeError("Download non riuscito: " + url)


def chiedi_overpass(query, percorso):
    # Manda una richiesta a Overpass (OpenStreetMap) e salva la risposta in JSON
    if percorso.exists():
        print("  Gia' scaricato: " + percorso.name)
        with open(percorso, encoding="utf-8") as file:
            return json.load(file)
    for tentativo in range(1, 4):
        try:
            risposta = requests.post(config.OVERPASS_URL, data={"data": query},
                                     timeout=900,
                                     headers={"User-Agent": config.NOME_PROGRAMMA})
            if risposta.status_code == 429:
                print("  Overpass occupato, aspetto 60 secondi...")
                time.sleep(60)
                continue
            risposta.raise_for_status()
            dati = risposta.json()
            with open(percorso, "w", encoding="utf-8") as file:
                json.dump(dati, file)
            return dati
        except requests.RequestException as errore:
            print("  Errore Overpass (tentativo " + str(tentativo) + "): " + str(errore))
            time.sleep(30 * tentativo)
    raise RuntimeError("Overpass non risponde. Riprova piu' tardi.")


def leggi_json(percorso):
    with open(percorso, encoding="utf-8") as file:
        return json.load(file)


def scrivi_json(dati, percorso):
    percorso.parent.mkdir(parents=True, exist_ok=True)
    with open(percorso, "w", encoding="utf-8") as file:
        json.dump(dati, file, ensure_ascii=False, indent=1)
