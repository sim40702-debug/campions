// Scarica le strade, gli edifici e i dettagli VERI di una zona da OpenStreetMap (api.openstreetmap.org, a piccoli
// riquadri) e li scrive nel formato dell'anteprima: strade.json, edifici.json, dettagli.json.
// Serve per PROVARE la grafica delle strade su un tracciato vero (Locarno) quando non si hanno i dati completi
// di tools/geo (swisstopo + Overpass). Le quote vengono dal terreno gia' presente in anteprima/dati (anche quello di prova).
//
//   node tools/anteprima_prova/dati_osm_reali.mjs [ovest,sud,est,nord] [cartella_cache]
//
// Dati: (c) OpenStreetMap contributors, licenza ODbL. Si scaricano pochi riquadri, con una pausa tra l'uno e l'altro.

import fs from "node:fs";
import path from "node:path";

const radice = path.resolve(import.meta.dirname, "../../anteprima/dati");
const bbox = (process.argv[2] || "8.775,46.155,8.815,46.180").split(",").map(Number);
const cache = process.argv[3] || "/tmp/osm_cache";
fs.mkdirSync(cache, { recursive: true });
const info = JSON.parse(fs.readFileSync(path.join(radice, "terreno.json"), "utf8"));
const [CE, CN] = info.centro_lv95;

// WGS84 -> LV95 (formule approssimate di swisstopo, errore < 1 m)
function lv95(lon, lat) {
  const f = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * l - 10938.51 * l * f - 0.36 * l * f * f - 44.54 * l * l * l;
  const N = 1200147.07 + 308807.95 * f + 3745.25 * l * l + 76.63 * f * f - 194.56 * l * l * f + 119.79 * f * f * f;
  return [E + 2000000 - 2000000, N];
}
const locale = (lon, lat) => { const [E, N] = lv95(lon, lat); return [E + 0 - CE + 0, -(N - CN)]; };

// Terreno (per le quote)
const bin = new Uint16Array(fs.readFileSync(path.join(radice, "terreno.bin")).buffer.slice(0));
const colonne = info.colonne, righe = info.righe;
function quota(x, z) {
  const c = Math.min(colonne - 1, Math.max(0, Math.round((x + info.lato_x_m / 2) / info.passo_m)));
  const r = Math.min(righe - 1, Math.max(0, Math.round((z + info.lato_z_m / 2) / info.passo_m)));
  return info.quota_base + bin[r * colonne + c] * info.scala_quota;
}

// --- scarico (con cache) ---
const PASSO = 0.005;
const nodi = new Map(), vie = new Map(), edificiOsm = new Map();
async function riquadro(o, s, e, n) {
  const nome = path.join(cache, [o, s, e, n].map((v) => v.toFixed(4)).join("_") + ".json");
  if (fs.existsSync(nome)) return JSON.parse(fs.readFileSync(nome, "utf8"));
  for (let tentativo = 0; tentativo < 4; tentativo++) {
    const r = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${o},${s},${e},${n}`, { headers: { "User-Agent": "mrw-anteprima-test/1.0" } });
    if (r.ok) { const j = await r.json(); fs.writeFileSync(nome, JSON.stringify({ elements: j.elements.filter((x) => x.type !== "relation") })); return j; }
    console.log("riquadro", nome, r.status, "riprovo");
    await new Promise((f) => setTimeout(f, 4000 * (tentativo + 1)));
  }
  throw new Error("riquadro non scaricato");
}
let fatti = 0;
for (let o = bbox[0]; o < bbox[2] - 1e-9; o += PASSO) {
  for (let s = bbox[1]; s < bbox[3] - 1e-9; s += PASSO) {
    const j = await riquadro(o, s, o + PASSO, s + PASSO);
    for (const el of j.elements) {
      if (el.type === "node") nodi.set(el.id, el);
      else if (el.type === "way") (el.tags && el.tags.building ? edificiOsm : vie).set(el.id, el);
    }
    fatti++;
    await new Promise((f) => setTimeout(f, 700));
  }
}
console.log(fatti, "riquadri;", nodi.size, "nodi,", vie.size, "vie,", edificiOsm.size, "edifici");

// --- strade ---
const TIPI = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified", "residential", "living_street"]);
const LARGHEZZE = { motorway: 11, trunk: 9, primary: 7.5, secondary: 7, tertiary: 6.5, unclassified: 5, residential: 5, living_street: 4.5, motorway_link: 6, trunk_link: 6, primary_link: 6, secondary_link: 6, tertiary_link: 5.5 };
function larghezza(t) {
  const w = parseFloat((t.width || "").replace("m", ""));
  if (w > 0) return Math.max(3, Math.min(25, w));
  const l = parseInt(t.lanes, 10);
  if (l > 0) return l * 3.3;
  return LARGHEZZE[t.highway] || 5;
}
const strade = [];
let km = 0;
for (const v of vie.values()) {
  const t = v.tags || {};
  if (!TIPI.has(t.highway) || t.area === "yes") continue;
  const pts = v.nodes.map((id) => nodi.get(id)).filter(Boolean);
  if (pts.length < 2) continue;
  const p = [];
  for (const nd of pts) { const [x, z] = locale(nd.lon, nd.lat); p.push(+x.toFixed(1), +(quota(x, z) + 0.2).toFixed(2), +z.toFixed(1)); }
  const voce = { n: t.name || t.ref || "", t: t.highway, w: +larghezza(t).toFixed(1), b: !!(t.bridge && t.bridge !== "no"), g: !!((t.tunnel && t.tunnel !== "no") || t.covered === "yes"), p };
  if (t.junction === "roundabout" || t.junction === "circular") voce.j = "roundabout";
  // nuovi campi: numero di corsie e senso unico (la grafica li usa per le righe vere)
  const corsie = parseInt(t.lanes, 10);
  if (corsie > 0) voce.l = corsie;
  if (t.oneway === "yes" || t.oneway === "1" || t.junction === "roundabout" || t.oneway === "-1") voce.o = t.oneway === "-1" ? -1 : 1;
  const sw = t.sidewalk || "";
  if (sw) voce.sw = sw === "both" ? 3 : (sw === "left" ? 1 : (sw === "right" ? 2 : 0));
  strade.push(voce);
  for (let i = 3; i < p.length; i += 3) km += Math.hypot(p[i] - p[i - 3], p[i + 2] - p[i - 1]) / 1000;
}
fs.writeFileSync(path.join(radice, "strade.json"), JSON.stringify({ strade }));
console.log(strade.length, "strade,", km.toFixed(1), "km");

// --- edifici ---
const PIANI = { house: 2, detached: 2, semidetached_house: 2, terrace: 2, bungalow: 1, residential: 3, apartments: 4, commercial: 3, retail: 2, office: 4, hotel: 4, school: 3, hospital: 5, industrial: 2, warehouse: 2, garage: 1, garages: 1, shed: 1, carport: 1, roof: 1, hut: 1 };
const TEGOLE = new Set(["house", "detached", "semidetached_house", "terrace", "bungalow", "church", "chapel", "hut", "barn"]);
const edifici = [];
for (const b of edificiOsm.values()) {
  const t = b.tags;
  if (["roof", "carport", "construction", "ruins"].includes(t.building)) continue;
  const pts = b.nodes.map((id) => nodi.get(id)).filter(Boolean).map((n) => locale(n.lon, n.lat));
  if (pts.length < 4) continue;
  pts.pop();
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a[0] * c[1] - c[0] * a[1]; }
  area = Math.abs(area) / 2;
  if (area < 6) continue;
  let h = parseFloat(t.height);
  if (!(h > 2 && h < 120)) {
    let piani = parseFloat(t["building:levels"]);
    if (!(piani > 0 && piani <= 40)) piani = PIANI[t.building] || (area > 300 ? 3 : 2);
    h = piani * 3.2 + 1;
  }
  const sotto = pts.map((q) => quota(q[0], q[1]));
  const chiesa = t.building === "church" || t.building === "chapel" || t.amenity === "place_of_worship";
  edifici.push({ p: pts.flatMap((q) => [+q[0].toFixed(1), +q[1].toFixed(1)]), b: +(Math.min(...sotto) - 0.5).toFixed(1), h: +(Math.max(...sotto) + h).toFixed(1), c: b.id % 6, t: TEGOLE.has(t.building) || chiesa ? 1 : 0, k: chiesa ? 1 : 0 });
}
fs.writeFileSync(path.join(radice, "edifici.json"), JSON.stringify({ edifici }));
console.log(edifici.length, "edifici");

// --- dettagli ---
const det = { semafori: [], stop: [], precedenza: [], lampioni: [], strisce: [], localita: [] };
const tipi = { traffic_signals: "semafori", stop: "stop", give_way: "precedenza", street_lamp: "lampioni", crossing: "strisce" };
for (const n of nodi.values()) {
  const t = n.tags;
  if (!t) continue;
  const [x, z] = locale(n.lon, n.lat);
  if (t.place && t.name && ["city", "town", "village", "suburb", "hamlet", "neighbourhood", "quarter"].includes(t.place)) det.localita.push({ n: t.name, t: t.place, x: +x.toFixed(1), z: +z.toFixed(1) });
  else if (tipi[t.highway] && t.crossing !== "no") det[tipi[t.highway]].push(+x.toFixed(1), +z.toFixed(1));
}
fs.writeFileSync(path.join(radice, "dettagli.json"), JSON.stringify(det));
console.log("dettagli:", Object.entries(det).map(([k, v]) => k + " " + (k === "localita" ? v.length : v.length / 2)).join(", "));
