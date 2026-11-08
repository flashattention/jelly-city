// 서울 전체 OSM 미리 받기: 칸(2km)마다 Overpass 에 다섯 번씩 물으면 공개 서버가 느려져 칸 하나에 20분이 넘게 걸린다
//   그래서 덩어리(칸 2 × 2 = 4km, BLOCK 로 바꿈 · 12km 는 서버가 504)로 한 번에 받고, 칸마다 잘라서 .cache/osm/tiles/t_i_j/<파일>.json 에 미리 넣어 둔다
//   (지도 도구 hangang-map.mjs tile 은 캐시 파일이 있으면 Overpass 에 묻지 않는다)
//   받은 덩어리는 .cache/osm/seoul-blocks/ 에 기억. 이미 있는 칸 캐시 파일은 건드리지 않는다
//   쓰는 법: node tools/seoul-osm-prefetch.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QUERIES } from './osm-queries.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), BLK = path.join(ROOT, '.cache/osm/seoul-blocks'), TC = path.join(ROOT, '.cache/osm/tiles');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574, T = 2000, M = 150, B = +(process.env.BLOCK || 2);
const lat = (z) => LAT0 - z / KZ, lon = (x) => LON0 + x / KX;
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dream-runner/hangang/seoul.json'), 'utf8')), U = S.unit || 10;
const rings = S.gu.flatMap((g) => g.rings.map((r) => { const p = []; for (let i = 0; i < r.length; i += 2) p.push([r[i] * U, r[i + 1] * U]); return p; }));
const inRing = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const r of rings) for (const [x, z] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
// seoul-tiles.mjs 와 같은 칸 목록
const tiles = [];
for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) for (let j = Math.floor(z0 / T); j <= Math.floor(z1 / T); j++) { let hit = false; for (let a = 0; a <= 4 && !hit; a++) for (let b = 0; b <= 4 && !hit; b++) hit = rings.some((r) => inRing(i * T + (a / 4) * T, j * T + (b / 4) * T, r)); if (hit) tiles.push([i, j]); }
// 칸의 위경도 상자 (hangang-map.mjs 의 칸 상자와 같게: 둘레 150m 여유) [남, 서, 북, 동]
const tileBox = (i, j) => [lat(j * T + T + M), lon(i * T - M), lat(j * T - M), lon(i * T + T + M)];
const blocks = new Map(); for (const [i, j] of tiles) { const k = `${Math.floor(i / B)}_${Math.floor(j / B)}`; if (!blocks.has(k)) blocks.set(k, []); blocks.get(k).push([i, j]); }
const boxOf = (list) => { const bs = list.map(([i, j]) => tileBox(i, j)); return [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))]; };
console.log(`칸 ${tiles.length}개 · 덩어리 ${blocks.size}개`);
fs.mkdirSync(BLK, { recursive: true });

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function ask(file, body, box, start) {
  const f = path.join(BLK, file); if (fs.existsSync(f)) return f;
  const q = `[out:json][timeout:900][maxsize:2000000000];(${body.replaceAll('$B', box.join(','))});out geom;`;
  for (let tr = 0; tr < 9; tr++) {
    const url = SERVERS[(start + tr) % SERVERS.length], t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'jelly-games-hangang-map/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(1000000) });
      if (r.ok) { const txt = await r.text(); if (txt.includes('"remark"') && /runtime error|out of memory|timed out/i.test(txt.slice(-2000))) throw new Error('remark ' + txt.slice(-300)); fs.writeFileSync(f, txt); console.log(`  ✓ ${file} ${(txt.length / 1e6).toFixed(1)}MB ${((Date.now() - t0) / 1000).toFixed(0)}초 (${url.split('/')[2]})`); return f; }
      console.log(`  … ${file} ${r.status} (${url.split('/')[2]}) 다시`);
    } catch (e) { console.log(`  … ${file} ${String(e.message).slice(0, 120)} 다시`); }
    await new Promise((res) => setTimeout(res, 15000));
  }
  throw new Error(`못 받음: ${file}`);
}
// 요소의 위경도 상자
const bboxOf = (e) => { if (e.type === 'node') return [e.lat, e.lon, e.lat, e.lon]; if (e.bounds) return [e.bounds.minlat, e.bounds.minlon, e.bounds.maxlat, e.bounds.maxlon]; let a = 90, b = 180, c = -90, d = -180; const eat = (g) => { for (const p of g || []) if (p) { a = Math.min(a, p.lat); b = Math.min(b, p.lon); c = Math.max(c, p.lat); d = Math.max(d, p.lon); } }; eat(e.geometry); for (const m of e.members || []) eat(m.geometry); return [a, b, c, d]; };
const hit = (e, t) => e[0] <= t[2] && e[2] >= t[0] && e[1] <= t[3] && e[3] >= t[1];

// 1) 덩어리 받기: 큰 것(건물 · 땅)은 덩어리마다, 작은 것(역 · 가게 · 강)은 서울 한 번에
const jobs = [];
for (const [k, list] of blocks) for (const name of ['buildings', 'land']) jobs.push({ file: `${name}_${k}.json`, body: QUERIES[name], box: boxOf(list), name, tiles: list });
for (const name of ['stations', 'pois', 'water_far']) jobs.push({ file: `${name}_all.json`, body: QUERIES[name], box: boxOf(tiles), name, tiles });
let next = 0; const lanes = SERVERS.map((_, s) => (async () => { while (next < jobs.length) { const J = jobs[next++]; J.path = await ask(J.file, J.body, J.box, s); } })());
await Promise.all(lanes);

// 2) 칸마다 자르기 (종류별로 메모리를 비우며)
for (const name of ['buildings', 'land', 'stations', 'pois', 'water_far']) {
  const out = new Map(); let written = 0;
  for (const J of jobs.filter((j) => j.name === name)) {
    const els = JSON.parse(fs.readFileSync(J.path, 'utf8')).elements;
    const boxes = J.tiles.map(([i, j]) => [`t_${i}_${j}`, tileBox(i, j)]);
    for (const e of els) { const eb = bboxOf(e); for (const [id, tb] of boxes) if (hit(eb, tb)) { if (!out.has(id)) out.set(id, new Map()); out.get(id).set(e.type + e.id, e); } }
  }
  for (const [i, j] of tiles) { const id = `t_${i}_${j}`, dir = path.join(TC, id), f = path.join(dir, `${name}.json`); if (fs.existsSync(f)) continue; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, JSON.stringify({ elements: [...(out.get(id)?.values() || [])] })); written++; }
  console.log(`${name}: 칸 ${written}개에 썼어요`);
}
