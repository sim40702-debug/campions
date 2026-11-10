// Prova delle identita' dei luoghi su un elenco ampio di localita' del Ticino (anche non presenti nella tabella manuale).
//   node tools/anteprima_prova/prova_luoghi.mjs
import { creaLuoghi } from "../../anteprima/src/luoghi.js";

const NOMI = `Locarno Muralto Orselina Brione_sopra_Minusio Minusio Tenero Contra Gordola Cugnasco Gerra_Verzasca Lavertezzo Sonogno Vogorno Losone Ascona Ronco_sopra_Ascona Brissago Porto_Ronco Ponte_Brolla Tegna Cavigliano Intragna Verscio Cadenazzo Magadino Vira Gambarogno San_Nazzaro Caviano Contone Quartino Bellinzona Giubiasco Sementina Gudo Arbedo Castione Lumino Preonzo Moleno Biasca Osogna Cresciano Iragna Lodrino Claro Cama Grono Roveredo Lostallo Faido Airolo Quinto Piotta Ambri Chironico Giornico Bodio Personico Pollegio Olivone Acquarossa Dongio Malvaglia Ludiano Semione Lugano Paradiso Massagno Viganello Pregassona Castagnola Gandria Morcote Melide Bissone Capolago Riva_San_Vitale Mendrisio Chiasso Balerna Stabio Ligornetto Coldrerio Novazzano Vacallo Morbio_Inferiore Breganzona Muzzano Agno Magliaso Caslano Ponte_Tresa Sorengo Cadro Sonvico Tesserete Bironico Taverne Bioggio Manno Gravesano Origlio Comano Cureglia Savosa Vezia Canobbio Cassarate Cademario Aranno Arosio Bedigliora Curio Sessa Astano Novaggio Miglieglia Pura Neggio Croglio Monteggio Sessa Ronago Cabbio Caneggio Sagno Genestrerio Rancate Besazio Meride Arzo Tremona Castel_San_Pietro Coldrerio Cernobbio`.split(/\s+/).map((n) => n.replace(/_/g, " "));
const unici = [...new Set(NOMI)];
const localita = unici.map((n, i) => ({ n, t: i % 7 === 0 ? "town" : "village", x: i * 100, z: 0 }));
const { lista } = creaLuoghi(localita);
const firme = new Map();
let validi = 0;
for (const l of lista) {
  const p = l.profilo;
  const ok = p.famiglia && p.pesi.length === 5 && Math.abs(p.pesi.reduce((a, b) => a + b, 0) - 1) < 1e-6 && p.muri.length >= 5 && p.tetti.length >= 4 && p.balconi >= 0 && p.balconi <= 1 && p.palme >= 0 && p.palme <= 1 && p.alberi >= 0;
  if (ok) validi++;
  const f = p.famiglia + "|" + p.pesi.map((v) => v.toFixed(2)).join(",") + "|" + p.balconi.toFixed(2);
  firme.set(f, (firme.get(f) || 0) + 1);
}
const famiglie = {};
for (const l of lista) famiglie[l.profilo.famiglia] = (famiglie[l.profilo.famiglia] || 0) + 1;
console.log("Luoghi provati: " + lista.length + ", profili validi: " + validi + ", profili distinti: " + firme.size);
console.log("Famiglie di colori: " + JSON.stringify(famiglie));
if (validi !== lista.length) { console.error("FALLITO: profili non validi"); process.exit(1); }
if (firme.size < lista.length * 0.95) { console.error("FALLITO: troppi profili uguali"); process.exit(1); }
// i luoghi di montagna e quelli di lago devono avere un carattere coerente
const get = (n) => lista.find((l) => l.n === n).profilo;
const controlli = [
  ["Airolo e' di pietra/alpino (pesi pietra > 0.5)", get("Airolo").pesi[4] > 0.5],
  ["Ascona ha piu' palme di Airolo", get("Ascona").palme > get("Airolo").palme],
  ["Morcote (lago) ha palme", get("Morcote").palme >= 0.5],
  ["Chiasso e' moderno", get("Chiasso").famiglia === "moderno"],
];
for (const [t, ok] of controlli) { console.log((ok ? "OK      " : "FALLITO ") + t); if (!ok) process.exitCode = 1; }
console.log("OK");
