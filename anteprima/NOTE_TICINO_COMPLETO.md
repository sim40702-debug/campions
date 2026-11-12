## MOTO RACING WORLD – Ticino completo (versione di prova)

Versione **di prova** del branch `feature/ticino-completo`: tutto il Canton Ticino, diviso in regioni da 24 × 24 km che usano le stesse coordinate svizzere (LV95).
Non sostituisce l'anteprima normale: si installa accanto, con un altro nome ("MRW Ticino Completo").

- Dentro l'app c'è già la regione di **Locarno**. Le altre regioni si scaricano da sole (circa 100 MB l'una) la prima volta che ci si entra o che si sceglie una partenza sulla mappa del cantone: serve internet.
- Passando da una regione all'altra c'è un breve caricamento.
- Lo stato vero di ogni regione (completa o no) è scritto in `stato.json` nella pre-release `ticino-completo-dati`.

### Novità della 0.16.0-ticino.2

- **Molta meno memoria**: edifici e strade si costruiscono solo vicino alla moto e si tolgono quando sono lontani. Nel Mendrisiotto il gioco usava 2,5 GB (e poteva chiudersi caricando): ora circa 570 MB.
- Provata la partenza e la guida in tutte le 19 regioni con i dati veri (Chiasso, Lugano, Bellinzona, Biasca, Airolo, Olivone, Bosco Gurin, Sonogno...): vedi `docs/sprint-T1/SPRINT_REPORT.md`.
- Non ancora provata su un Mac o un PC veri.

Dati: © OpenStreetMap contributors (ODbL) · Ufficio federale di topografia swisstopo (swissALTI3D, SWISSIMAGE).
