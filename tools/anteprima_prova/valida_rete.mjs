// Validazione della rete stradale NEL GIOCO: carica l'anteprima con i dati veri (anteprima/dati) e controlla la rete
// dopo la preparazione (nodi in comune, quote) e gli incroci costruiti da incroci.js.
//   node tools/anteprima_prova/valida_rete.mjs <file_rapporto.json>
// Controlla: strade senza collegamento, geometrie doppie, nastri sovrapposti, scalini di quota ai nodi, pendenze,
// quota rispetto al terreno, incroci (bracci, raccordi riusciti o no), rotonde, raggruppamenti per tipo di strada.
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const radice = path.resolve(import.meta.dirname, "../../anteprima");
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".jpg": "image/jpeg" };
const server = http.createServer((q, s) => { const f = path.join(radice, decodeURIComponent(q.url.split("?")[0])); fs.readFile(f.endsWith("/") ? f + "index.html" : f, (e, d) => { if (e) { s.writeHead(404); s.end("no"); return; } s.writeHead(200, { "Content-Type": T[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.setDefaultTimeout(600000);
p.on("pageerror", (e) => console.log("pageerror: " + e.message));
await p.addInitScript(() => { localStorage.setItem("mrw-qualita", "media"); });
await p.goto("http://localhost:" + server.address().port + "/index.html");
await p.waitForFunction(() => document.getElementById("caricamento").style.display === "none");
await p.waitForFunction(() => window.__mrw && window.__mrw.strade && window.__mrw.fotogrammi > 2);
const rapporto = await p.evaluate(async () => {
  const { quotaTerreno } = await import("/src/terreno.js");
  const m = window.__mrw, S = m.strade, L = S.lista;
  const R = { strade: L.length, perTipo: {}, km: 0 };
  const vere = L.filter((s) => !s.riemp);
  for (const s of vere) { R.perTipo[s.t] = (R.perTipo[s.t] || 0) + 1; for (let i = 3; i < s.p.length; i += 3) R.km += Math.hypot(s.p[i] - s.p[i - 3], s.p[i + 2] - s.p[i - 1]) / 1000; }
  R.km = +R.km.toFixed(1);
  const chiave = (x, z) => Math.round(x * 2) + "," + Math.round(z * 2);
  // nodi: chi li usa
  const nodi = new Map();
  vere.forEach((s, si) => { const n = s.p.length / 3; for (let i = 0; i < n; i++) { const k = chiave(s.p[i * 3], s.p[i * 3 + 2]); if (!nodi.has(k)) nodi.set(k, []); nodi.get(k).push({ si, i, fine: i === 0 || i === n - 1, y: s.p[i * 3 + 1] }); } });
  // 1) capi senza collegamento: non e' un nodo condiviso e non cade sul bordo di un'altra strada
  const distSeg = (x, z, p, i) => { const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5]; const l2 = (bx - ax) ** 2 + (bz - az) ** 2; let t = l2 > 0 ? ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t); };
  const vicineA = (x, z, escludi, raggio) => { const out = []; const cx = Math.floor(x / 40), cz = Math.floor(z / 40); for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) { const l = S.griglia.get(ix + "," + iz); if (!l) continue; for (const [s, i] of l) { if (s === escludi) continue; const o = L[s]; if (o.riemp) continue; const d = distSeg(x, z, o.p, i); if (d <= raggio) out.push([s, d]); } } return out; };
  const pendenti = [];
  let capi = 0, collegati = 0;
  vere.forEach((s, si) => { const n = s.p.length / 3; for (const i of [0, n - 1]) { capi++; const x = s.p[i * 3], z = s.p[i * 3 + 2]; const k = chiave(x, z); const qui = nodi.get(k).filter((e) => e.si !== si || e.i !== i); if (qui.length > 0) { collegati++; continue; } const v = vicineA(x, z, L.indexOf(s), 1.0); if (v.length > 0) { collegati++; continue; } pendenti.push({ n: s.n, t: s.t, x: +x.toFixed(0), z: +z.toFixed(0), w: s.w }); } });
  R.capi = { totale: capi, collegati, senzaCollegamento: pendenti.length, senzaCollegamentoPerTipo: pendenti.reduce((a, e) => (a[e.t] = (a[e.t] || 0) + 1, a), {}), esempi: pendenti.filter((e) => !["residential", "living_street", "unclassified"].includes(e.t)).slice(0, 12) };
  // 2) geometrie doppie: segmenti paralleli e sovrapposti (< 0.4 m) per oltre 6 m, strade diverse, senza essere sulla stessa strada
  const doppie = new Map();
  vere.forEach((s, si) => { const gi = L.indexOf(s); for (let i = 0; i + 5 < s.p.length; i += 3) { const mx = (s.p[i] + s.p[i + 3]) / 2, mz = (s.p[i + 2] + s.p[i + 5]) / 2; const dx = s.p[i + 3] - s.p[i], dz = s.p[i + 5] - s.p[i + 2]; const l = Math.hypot(dx, dz); if (l < 0.5) continue; for (const [so] of vicineA(mx, mz, gi, 0.4)) { if (so < gi) continue; const o = L[so]; let best = 1; for (let j = 0; j + 5 < o.p.length; j += 3) { const ex = o.p[j + 3] - o.p[j], ez = o.p[j + 5] - o.p[j + 2]; const le = Math.hypot(ex, ez); if (le < 0.5) continue; if (distSeg(mx, mz, o.p, j) < 0.4) best = Math.min(best, 1 - Math.abs((dx * ex + dz * ez) / (l * le))); } if (best < 0.02) { const k = gi + ":" + so; doppie.set(k, (doppie.get(k) || 0) + l); } } } });
  R.doppie = [...doppie.entries()].filter(([, l]) => l > 6).map(([k, l]) => { const [a, c] = k.split(":").map(Number); return { a: L[a].n || L[a].t, b: L[c].n || L[c].t, metri: Math.round(l), x: Math.round(L[a].p[0]), z: Math.round(L[a].p[2]) }; });
  // 3) scalini di quota ai nodi condivisi e pendenze
  let scalini = 0, maxScalino = 0; const esScal = [];
  for (const [k, lista] of nodi) { if (lista.length < 2) continue; const liv = lista.filter((e) => !vere[e.si].g && !vere[e.si].b); if (liv.length < 2) continue; const ys = liv.map((e) => e.y); const d = Math.max(...ys) - Math.min(...ys); if (d > 0.08) { scalini++; if (esScal.length < 5) esScal.push({ k, d: +d.toFixed(2) }); } maxScalino = Math.max(maxScalino, d); }
  R.quote = { nodiCondivisi: [...nodi.values()].filter((l) => l.length >= 2).length, nodiConScalino: scalini, scalinoMax: +maxScalino.toFixed(2), esempi: esScal };
  let ripide = 0, pendMax = 0; const esRip = [];
  for (const s of vere) { if (s.g || s.b) continue; for (let i = 3; i < s.p.length; i += 3) { const l = Math.hypot(s.p[i] - s.p[i - 3], s.p[i + 2] - s.p[i - 1]); if (l < 1) continue; const g = Math.abs(s.p[i + 1] - s.p[i - 2]) / l; pendMax = Math.max(pendMax, g); if (g > 0.25) { ripide++; if (esRip.length < 4) esRip.push({ n: s.n, t: s.t, x: Math.round(s.p[i]), z: Math.round(s.p[i + 2]), pendenza: +(g * 100).toFixed(0) }); } } }
  R.pendenze = { tratti_oltre_25: ripide, massima_pct: +(pendMax * 100).toFixed(0), esempi: esRip };
  // 4) strada rispetto al terreno (fuori da ponti e gallerie)
  let sopra = 0, sotto = 0, tot = 0, maxS = 0, maxSotto = 0; const esSopra = [];
  for (const s of vere) { if (s.g || s.b) continue; for (let i = 0; i < s.p.length; i += 6) { tot++; const d = s.p[i + 1] - quotaTerreno(m.terreno, s.p[i], s.p[i + 2]); if (d > 1.0) { sopra++; maxS = Math.max(maxS, d); if (esSopra.length < 40) esSopra.push({ n: s.n, t: s.t, x: Math.round(s.p[i]), z: Math.round(s.p[i + 2]), d: +d.toFixed(1) }); } if (d < -0.5) { sotto++; maxSotto = Math.min(maxSotto, d); } } }
  R.terreno = { punti: tot, stradaSopraTerreno_oltre1m: sopra, stradaSottoTerreno_oltre50cm: sotto, maxSopra: +maxS.toFixed(2), maxSotto: +maxSotto.toFixed(2), esempiSopra: esSopra };
  // 5) incroci
  const D = S.datiIncroci; const incr = D.incroci;
  const perBracci = {}; let senzaRaccordo = 0, conRaccordi = 0, raccordi = 0; const esSenza = [];
  for (const n of incr) { const k = n.bracci.length; perBracci[k] = (perBracci[k] || 0) + 1; raccordi += n.raccordi.length; if (n.raccordi.length > 0) conRaccordi++; else { senzaRaccordo++; if (esSenza.length < 8) esSenza.push({ x: Math.round(n.x), z: Math.round(n.z), bracci: n.bracci.map((a) => Math.round(a.ang * 180 / Math.PI)).join("/") }); } }
  // angoli tra bracci consecutivi senza raccordo (per quale motivo): quanti spigoli vivi restano
  let spigoli = 0, spigoliStretti = 0, coppie = 0;
  for (const n of incr) { for (let i = 0; i < n.bracci.length; i++) { const a = n.bracci[i], c = n.bracci[(i + 1) % n.bracci.length]; let al = c.ang - a.ang; if (al <= 0) al += Math.PI * 2; coppie++; const ha = n.raccordi.some((r) => r.a === a && r.c === c); if (!ha && al > 0.44 && al < 2.75) spigoli++; if (!ha && al <= 0.44) spigoliStretti++; } }
  R.incroci = { motivi: D.motivi, nodi: incr.length, perNumeroBracci: perBracci, raccordiCostruiti: raccordi, nodiConRaccordo: conRaccordi, nodiSenzaRaccordo: senzaRaccordo, angoliSenzaRaccordoMaPossibili: spigoli, angoliTroppoStretti: spigoliStretti, coppieTotali: coppie, esempiSenza: esSenza, extra: S.incroci2 };
  const ring = L.filter((s) => s.j === "roundabout");
  R.rotonde = { pezzi: ring.length, isole: S.incroci2 ? S.incroci2.isole : 0, precedenze: S.incroci2 ? S.incroci2.precedenze : 0 };
  R.dettagli = { semafori: m.dettagli.semafori.length / 2, stop: m.dettagli.stop.length / 2, precedenza: m.dettagli.precedenza.length / 2, strisce: m.dettagli.strisce.length / 2, lampioni: m.dettagli.lampioni.length / 2 };
  const info = m.disegnatore.info;
  R.render = { chiamate: info.render.calls, triangoli: info.render.triangles, geometrie: info.memory.geometries, texture: info.memory.textures };
  return R;
});
fs.writeFileSync(process.argv[2] || "rapporto_rete.json", JSON.stringify(rapporto, null, 1));
console.log(JSON.stringify(rapporto, null, 1));
await b.close(); server.close();
