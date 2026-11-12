# PASSO 5 - Misura la rete stradale scaricata da OpenStreetMap
#
# Sostituisce le STIME dello Sprint 0 con numeri MISURATI:
# km per tipo di strada, ponti, gallerie, rotatorie, incroci,
# quante strade hanno larghezza e corsie, e se la rete e' tutta collegata.
#
# Uso:
#   python passo5_misura_strade.py --pilota
#   python passo5_misura_strade.py
#
# Dati: (c) OpenStreetMap contributors, licenza ODbL

from shapely.geometry import LineString, box, shape

import config
import utilita


def area_valida(pilota):
    # Si misura solo la parte dentro il pilota o dentro il Ticino
    if pilota:
        area = utilita.area_di_lavoro(True)
        return box(area[0], area[2], area[1], area[3])
    percorso = config.CARTELLA_UNREAL / "ticino" / "confini" / "ticino_lv95.geojson"
    if not percorso.exists():
        print("   Manca il confine: prima esegui il passo 4 (senza --pilota).")
        return None
    dati = utilita.leggi_json(percorso)
    return shape(dati["features"][0]["geometry"])


def trova_gruppo(genitori, nodo):
    # Union-find: serve per capire quali strade sono collegate tra loro
    while genitori[nodo] != nodo:
        genitori[nodo] = genitori[genitori[nodo]]
        nodo = genitori[nodo]
    return nodo


def main():
    argomenti = utilita.leggi_argomenti("Misura la rete stradale")
    nome = utilita.nome_area(argomenti.pilota)
    percorso = utilita.file_osm("strade", argomenti.pilota)
    if not percorso.exists():
        print("Manca " + percorso.name + ": prima esegui il passo 2.")
        return
    zona = area_valida(argomenti.pilota)
    if zona is None:
        return
    dati = utilita.leggi_json(percorso)

    km_per_tipo = {}
    tratti = 0
    km_ponti = 0.0
    km_gallerie = 0.0
    tratti_ponte = 0
    tratti_galleria = 0
    tratti_rotatoria = 0
    con_larghezza = 0
    con_corsie = 0
    con_nome = 0
    uso_nodi = {}
    genitori = {}

    for strada in dati.get("elements", []):
        if strada.get("type") != "way" or "geometry" not in strada:
            continue
        tag = strada.get("tags", {})
        punti = [utilita.DA_WGS84_A_LV95.transform(p["lon"], p["lat"]) for p in strada["geometry"]]
        if len(punti) < 2:
            continue
        linea = LineString(punti)
        parte = linea.intersection(zona)
        if parte.is_empty:
            continue
        km = parte.length / 1000
        tipo = tag.get("highway", "?")
        km_per_tipo[tipo] = km_per_tipo.get(tipo, 0) + km
        tratti = tratti + 1

        if tag.get("bridge") not in (None, "no"):
            km_ponti = km_ponti + km
            tratti_ponte = tratti_ponte + 1
        if tag.get("tunnel") not in (None, "no"):
            km_gallerie = km_gallerie + km
            tratti_galleria = tratti_galleria + 1
        if tag.get("junction") in ("roundabout", "circular"):
            tratti_rotatoria = tratti_rotatoria + 1
        if "width" in tag:
            con_larghezza = con_larghezza + 1
        if "lanes" in tag:
            con_corsie = con_corsie + 1
        if "name" in tag or "ref" in tag:
            con_nome = con_nome + 1

        # Nodi: per contare gli incroci e controllare i collegamenti
        nodi = strada.get("nodes", [])
        for nodo in nodi:
            uso_nodi[nodo] = uso_nodi.get(nodo, 0) + 1
            if nodo not in genitori:
                genitori[nodo] = nodo
        for i in range(1, len(nodi)):
            a = trova_gruppo(genitori, nodi[i - 1])
            b = trova_gruppo(genitori, nodi[i])
            if a != b:
                genitori[a] = b

    if tratti == 0:
        print("Nessuna strada trovata nell'area.")
        return

    incroci = sum(1 for conta in uso_nodi.values() if conta >= 2)
    gruppi = {}
    for nodo in genitori:
        radice = trova_gruppo(genitori, nodo)
        gruppi[radice] = gruppi.get(radice, 0) + 1
    piu_grande = max(gruppi.values())
    percento_collegato = piu_grande / len(genitori) * 100
    km_totali = sum(km_per_tipo.values())

    righe = []
    righe.append("# Misure della rete stradale (" + nome + ")")
    righe.append("")
    righe.append("Fonte: (c) OpenStreetMap contributors, ODbL. File: " + percorso.name)
    righe.append("")
    righe.append("| Tipo OSM | km |")
    righe.append("|---|---|")
    for tipo in sorted(km_per_tipo, key=lambda t: -km_per_tipo[t]):
        righe.append("| " + tipo + " | " + str(round(km_per_tipo[tipo], 1)) + " |")
    righe.append("| **Totale** | **" + str(round(km_totali, 1)) + "** |")
    righe.append("")
    righe.append("| Misura | Valore |")
    righe.append("|---|---|")
    righe.append("| Tratti di strada (way OSM) | " + str(tratti) + " |")
    righe.append("| Incroci (punti condivisi da piu' tratti) | " + str(incroci) + " |")
    righe.append("| Tratti di rotatoria | " + str(tratti_rotatoria) + " |")
    righe.append("| Ponti | " + str(tratti_ponte) + " tratti, " + str(round(km_ponti, 1)) + " km |")
    righe.append("| Gallerie | " + str(tratti_galleria) + " tratti, " + str(round(km_gallerie, 1)) + " km |")
    righe.append("| Tratti con larghezza (width) | " + str(round(con_larghezza / tratti * 100, 1)) + " % |")
    righe.append("| Tratti con numero di corsie (lanes) | " + str(round(con_corsie / tratti * 100, 1)) + " % |")
    righe.append("| Tratti con nome o numero | " + str(round(con_nome / tratti * 100, 1)) + " % |")
    righe.append("| Gruppi di strade separati | " + str(len(gruppi)) + " |")
    righe.append("| Nodi nel gruppo piu' grande | " + str(round(percento_collegato, 1)) + " % |")
    testo = "\n".join(righe) + "\n"

    uscita = config.CARTELLA_UNREAL / nome / "misure_strade.md"
    uscita.parent.mkdir(parents=True, exist_ok=True)
    uscita.write_text(testo, encoding="utf-8")
    print(testo)
    print("Salvato in: " + str(uscita))
    print("Nota: i gruppi separati sono normali al confine (strade tagliate) e per")
    print("strade private o chiuse; nello Sprint B controlliamo quelli dentro il Ticino.")


if __name__ == "__main__":
    main()
