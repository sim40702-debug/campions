// Uso del suolo (facoltativo): parchi, giardini, prati, cimiteri, campi sportivi per la mappa.
// Il file dati/uso_suolo.json lo crea tools/geo/passo7_esporta_anteprima.py; se manca, la mappa funziona lo stesso.

export async function caricaUsoSuolo() {
  try {
    const risposta = await fetch("dati/uso_suolo.json");
    if (!risposta.ok) return { aree: [] };
    return await risposta.json();
  } catch (errore) {
    return { aree: [] };
  }
}
