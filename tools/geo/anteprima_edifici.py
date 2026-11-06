# Edifici e strade: nessuna casa deve toccare l'asfalto.
#
# Le strade di OpenStreetMap sono linee al centro della strada e la larghezza e' stimata,
# quindi a volte il nastro di asfalto entra un po' nel contorno di una casa.
# Qui si toglie dal contorno della casa la parte che sta sull'asfalto (piu' un margine),
# cosi' il muro parte dal bordo della strada (come un marciapiede stretto).
# Le gallerie non contano (passano sotto), i ponti si' solo se sono quasi alla quota della casa.
#
# Lavora sui dati gia' pronti per l'anteprima (coordinate locali in metri: x = est, z = sud).

from shapely.geometry import LineString, Polygon, MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import unary_union

MARGINE_M = 0.6          # spazio libero tra asfalto e muro
AREA_MINIMA_M2 = 12.0    # se della casa resta meno di cosi', la casa non si disegna


def nastro(strada):
    # Poligono dell'asfalto di una strada (larghezza punto per punto se c'e' "ww")
    p = strada["p"]
    punti = [(p[i], p[i + 2]) for i in range(0, len(p), 3)]
    larghezze = strada.get("ww") or [strada["w"]] * len(punti)
    pezzi = []
    for i in range(len(punti) - 1):
        if punti[i] == punti[i + 1]:
            continue
        mezza = (larghezze[i] + larghezze[min(i + 1, len(larghezze) - 1)]) / 4 + MARGINE_M
        pezzi.append(LineString([punti[i], punti[i + 1]]).buffer(mezza, cap_style=2))
    return pezzi


def stacca_dalle_strade(edifici, strade):
    # Restituisce (nuova lista di edifici, quanti ritagliati, quanti tolti)
    nastri = []
    quote = []
    for strada in strade:
        if strada.get("g"):
            continue   # galleria: passa sotto, non conta
        quota_media = sum(strada["p"][1::3]) / max(1, len(strada["p"]) // 3)
        for pezzo in nastro(strada):
            nastri.append(pezzo)
            quote.append((strada.get("b", False), quota_media))
    albero = STRtree(nastri)

    risultato = []
    ritagliati = 0
    tolti = 0
    for edificio in edifici:
        p = edificio["p"]
        contorno = Polygon([(p[i], p[i + 1]) for i in range(0, len(p), 2)])
        if not contorno.is_valid:
            contorno = contorno.buffer(0)
        vicini = []
        for indice in albero.query(contorno):
            ponte, quota = quote[indice]
            # un ponte alto sopra la casa non la tocca
            if ponte and abs(quota - edificio["b"]) > 4:
                continue
            if nastri[indice].intersects(contorno):
                vicini.append(nastri[indice])
        if not vicini:
            risultato.append(edificio)
            continue

        resto = contorno.difference(unary_union(vicini))
        if isinstance(resto, MultiPolygon):
            resto = max(resto.geoms, key=lambda g: g.area)   # tengo il pezzo piu' grande
        if resto.is_empty or not isinstance(resto, Polygon) or resto.area < AREA_MINIMA_M2:
            tolti = tolti + 1
            continue
        resto = resto.simplify(0.05)
        nuovo = dict(edificio)
        nuovo["p"] = [round(v, 1) for x, z in list(resto.exterior.coords)[:-1] for v in (x, z)]
        risultato.append(nuovo)
        ritagliati = ritagliati + 1
    return risultato, ritagliati, tolti
