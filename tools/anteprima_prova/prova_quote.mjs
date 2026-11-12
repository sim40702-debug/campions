// Controllo delle quote delle strade (senza browser): dove due carreggiate si sovrappongono devono essere
// sullo stesso piano, i nodi in comune devono avere una sola quota e gli edifici non devono toccare l'asfalto.
//   node tools/anteprima_prova/prova_quote.mjs
import fs from "node:fs";
import path from "node:path";

const radice = process.env.RADICE_APP ? path.resolve(process.env.RADICE_APP) : path.resolve(import.meta.dirname, "../../anteprima");   // RADICE_APP: prova su un'altra copia (per esempio una regione del cantone)
globalThis.fetch = async function (url) {
  const f = path.join(radice, url);
  const ok = fs.existsSync(f);
  return { ok: ok, json: async () => JSON.parse(fs.readFileSync(f, "utf8")), text: async () => "manca " + url, arrayBuffer: async () => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } };
};
const { caricaStrade, larghezzaIn, stradaVicina } = await import(path.join(radice, "src/strade.js"));
const strade = await caricaStrade();
const lista = strade.lista;

// 1) nodi in comune
const nodi = new Map();
let nodiDiversi = 0, peggioNodo = 0;
for (const s of lista) for (let i = 0; i < s.p.length; i += 3) {
  const k = Math.round(s.p[i] * 2) + "," + Math.round(s.p[i + 2] * 2);
  const prima = nodi.get(k);
  if (prima === undefined) nodi.set(k, s.p[i + 1]);
  else if (Math.abs(prima - s.p[i + 1]) < 3 && Math.abs(prima - s.p[i + 1]) > 0.01) { if (process.env.DBG) console.log("nodo", k, prima.toFixed(2), s.p[i + 1].toFixed(2), s.n, s.g, s.b, i / 3, s.p.length / 3); nodiDiversi++; peggioNodo = Math.max(peggioNodo, Math.abs(prima - s.p[i + 1])); }
}
// 2) punti di una strada sulla carreggiata di un'altra: dislivello
let sovrapposti = 0, scalini = 0, peggio = 0;
for (let a = 0; a < lista.length; a++) {
  const sa = lista[a];
  if (sa.g || sa.b) continue;
  for (let i = 0; i < sa.p.length; i += 3) {
    const x = sa.p[i], y = sa.p[i + 1], z = sa.p[i + 2];
    for (const [o, j] of strade.griglia.get(Math.floor(x / 40) + "," + Math.floor(z / 40)) || []) {
      const sb = lista[o];
      if (o === a || sb.g || sb.b || strade.grado[o] > strade.grado[a]) continue;   // conta la strada meno importante sopra la piu' importante
      const q = sb.p;
      const ax = q[j], az = q[j + 2], bx = q[j + 3], bz = q[j + 5];
      const lungo = (bx - ax) ** 2 + (bz - az) ** 2;
      if (lungo === 0) continue;
      const t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / lungo;
      if (t < 0 || t > 1) continue;
      const d = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
      if (d > larghezzaIn(sb, j / 3) / 2) continue;
      const dy = Math.abs(q[j + 1] + (q[j + 4] - q[j + 1]) * t - y);
      if (dy > 3) continue;
      sovrapposti++;
      if (dy > 0.05) { scalini++; if (process.env.DBG && dy > 0.3) console.log(a, sa.w, sa.t, i / 3, sa.p.length / 3, "su", o, sb.w, j / 3, sb.p.length / 3, "t", t.toFixed(2), "d", d.toFixed(1), "dy", dy.toFixed(2)); }
      peggio = Math.max(peggio, dy);
    }
  }
}
// 3) pendenza massima e "spigoli" (cambio di pendenza tra due pezzi)
let pendenza = 0, spigolo = 0;
for (const s of lista) {
  let prima = null;
  for (let i = 0; i + 5 < s.p.length; i += 3) {
    const l = Math.hypot(s.p[i + 3] - s.p[i], s.p[i + 5] - s.p[i + 2]);
    if (l < 0.5) continue;
    const g = (s.p[i + 4] - s.p[i + 1]) / l;
    if (process.env.DBG && Math.abs(g) > 0.6) console.log("ripida", lista.indexOf(s), s.t, i / 3, s.p.length / 3, "l", l.toFixed(2), "g", g.toFixed(2));
    pendenza = Math.max(pendenza, Math.abs(g));
    if (prima !== null) { if (process.env.DBG && Math.abs(g - prima) > 0.5) console.log("spigolo", lista.indexOf(s), s.t, i / 3, s.p.length / 3, "l", l.toFixed(2), (g - prima).toFixed(2)); spigolo = Math.max(spigolo, Math.abs(g - prima)); }
    prima = g;
  }
}
console.log(JSON.stringify({ strade: lista.length, nodiDiversi, peggioNodo: +peggioNodo.toFixed(3), sovrapposti, scalini, peggioScalino: +peggio.toFixed(3), pendenzaMax: +pendenza.toFixed(3), spigoloMax: +spigolo.toFixed(3) }));

// 4) edifici sull'asfalto (dopo la pulizia)
const ed = await import(path.join(radice, "src/edifici.js"));
const edifici = await ed.caricaEdifici();
const tolti = ed.pulisciEdifici(edifici, strade);
let ancora = 0;
for (const e of edifici.lista) {
  const n = e.p.length / 2;
  let tocca = false;
  for (let k = 0; k < n && !tocca; k++) {
    const j = (k + 1) % n;
    for (let f = 0; f <= 8 && !tocca; f++) {
      const x = e.p[k * 2] + (e.p[j * 2] - e.p[k * 2]) * f / 8, z = e.p[k * 2 + 1] + (e.p[j * 2 + 1] - e.p[k * 2 + 1]) * f / 8;
      const s = stradaVicina(strade, x, z, 14);
      if (s !== null && !s.galleria && !s.ponte && s.distanza < Math.min(larghezzaIn(lista[s.indice], s.segmento / 3), larghezzaIn(lista[s.indice], s.segmento / 3 + 1)) / 2) tocca = true;
    }
  }
  if (tocca) ancora++;
}
console.log(JSON.stringify({ edifici: edifici.lista.length, tolti, ancoraSullAsfalto: ancora }));
if (nodiDiversi > 0 || scalini > 0 || ancora > 0) process.exit(1);
