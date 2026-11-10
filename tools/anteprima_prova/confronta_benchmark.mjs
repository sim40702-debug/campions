// Confronta due risultati del benchmark (stesso ambiente!):  node confronta_benchmark.mjs prima.json dopo.json
import fs from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
console.log("# Confronto benchmark: " + a.versione + " -> " + b.versione);
if (a.ambiente.scheda_video !== b.ambiente.scheda_video) console.log("\nATTENZIONE: le due misure sono su schede video diverse, il confronto non e' valido.\n");
console.log("| Scenario | FPS medi prima | FPS medi dopo | Variazione | ms p99 prima | ms p99 dopo | Triangoli prima | Triangoli dopo |");
console.log("|---|---|---|---|---|---|---|---|");
for (const x of a.risultati) {
  const y = b.risultati.find((r) => r.scenario === x.scenario && r.meteo === x.meteo);
  if (!y) continue;
  const d = ((y.fps_medi - x.fps_medi) / x.fps_medi * 100).toFixed(1);
  console.log(`| ${x.nome} | ${x.fps_medi} | ${y.fps_medi} | ${d > 0 ? "+" : ""}${d}% | ${x.frame_ms_p99} | ${y.frame_ms_p99} | ${x.triangoli} | ${y.triangoli} |`);
}
