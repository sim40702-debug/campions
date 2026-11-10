// Memoria: dopo che una geometria statica e' stata caricata sulla scheda video, la copia sul lato JavaScript
// non serve piu' (le geometrie degli edifici, delle strade e del terreno non cambiano): si libera.
// Risparmia la meta' della memoria dei vertici (la stessa copia e' gia' sulla scheda video).
// Non si usa per geometrie che si modificano o che servono ancora alla CPU (es. collisioni, ray casting).

export function liberaDopoCaricamento(geometria) {
  const libera = function (attributo) {
    if (!attributo || !attributo.onUpload) return;
    attributo.onUpload(function () {
      this.array = null;
    });
  };
  for (const nome of Object.keys(geometria.attributes)) libera(geometria.attributes[nome]);
  libera(geometria.index);
  return geometria;
}
