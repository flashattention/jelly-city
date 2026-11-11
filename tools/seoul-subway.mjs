// 서울 지하철 노선 자료: OSM 노선 관계에서 역 순서와 역 사이 실제 선로를 뽑아 public/dream-runner/seoul/subway.json 으로
//   실시간 열차 위치(역 + 진입 · 도착 · 출발)를 역 사이 선로 위 자리로 바꾸는 데 쓴다 (hangang-transit.js)
//   쓰는 법: node tools/seoul-subway.mjs   (받은 OSM 은 .cache/osm/subway/ 에 기억)
//   좌표: 서울 전체 지도와 같은 틀 (북위 37.53 · 동경 126.98 = 0, x 동쪽 · z 남쪽, 미터)
//   지도 데이터 © OpenStreetMap contributors (ODbL)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), CACHE = path.join(ROOT, '.cache/osm/subway'), OUT = path.join(ROOT, 'public/dream-runner/seoul/subway.json');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const XY = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
// 실시간 API 노선 이름 ← OSM ref
const LINES = { 1: '1호선', 2: '2호선', 3: '3호선', 4: '4호선', 5: '5호선', 6: '6호선', 7: '7호선', 8: '8호선', 9: '9호선', '경의·중앙': '경의중앙선', 공항철도: '공항철도', AREX: '공항철도', 경춘: '경춘선', '수인·분당': '수인분당선', 신분당: '신분당선', W: '우이신설선', Silim: '신림선', 서해: '서해선', 'GTX-A': 'GTX-A' };
// 칸 수 · 한 칸 길이(m)
const CARS = { '1호선': [10, 20], '2호선': [10, 20], '3호선': [10, 20], '4호선': [10, 20], '5호선': [8, 20], '6호선': [8, 20], '7호선': [8, 20], '8호선': [6, 20], '9호선': [6, 20], 경의중앙선: [8, 20], 공항철도: [6, 22], 경춘선: [8, 20], 수인분당선: [6, 20], 신분당선: [6, 20], 우이신설선: [2, 13], 신림선: [3, 13], 서해선: [4, 20], 'GTX-A': [8, 22] };
const COLOR = { '1호선': '#0052A4', '2호선': '#00A84D', '3호선': '#EF7C1C', '4호선': '#00A5DE', '5호선': '#996CAC', '6호선': '#CD7C2F', '7호선': '#747F00', '8호선': '#E6186C', '9호선': '#BDB092', 경의중앙선: '#77C4A3', 공항철도: '#0090D2', 경춘선: '#0C8E72', 수인분당선: '#F5A200', 신분당선: '#D4003B', 우이신설선: '#B0CE18', 신림선: '#6789CA', 서해선: '#8FC31F', 'GTX-A': '#9A6292' };
// 서울 둘레 (이 밖의 역 사이는 버린다)
const BOX = [-22000, 22000, -20000, 17000];
const inBox = ([x, z]) => x > BOX[0] && x < BOX[1] && z > BOX[2] && z < BOX[3];

fs.mkdirSync(CACHE, { recursive: true });
async function overpass(file, q) {
  const f = path.join(CACHE, file); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let tr = 0; tr < 6; tr++) {
    const url = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'][tr % 3];
    try { const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'jelly-games-subway/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }); if (r.ok) { const t = await r.text(); fs.writeFileSync(f, t); return JSON.parse(t); } console.log('Overpass', r.status); } catch (e) { console.log('Overpass', e.message); }
    await new Promise((res) => setTimeout(res, 15000 * (tr + 1)));
  }
  throw new Error('Overpass 실패');
}
const REFS = Object.keys(LINES).map((r) => r.replace(/[·]/g, '.')).join('|');
const rel = await overpass('rels.json', `[out:json][timeout:240];relation["route"~"^(subway|train|light_rail)$"]["ref"~"^(${REFS})$"](37.40,126.70,37.75,127.25);out geom;`);
const wt = await overpass('waytags.json', `[out:json][timeout:240];relation["route"~"^(subway|train|light_rail)$"]["ref"~"^(${REFS})$"](37.40,126.70,37.75,127.25);way(r);out tags;`);
const wayTag = new Map(wt.elements.map((w) => [w.id, w.tags || {}]));
// 정차 점 이름 (out geom 의 노드 멤버엔 태그가 없어서 따로 받는다)
const st = await overpass('stops.json', `[out:json][timeout:240];relation["route"~"^(subway|train|light_rail)$"]["ref"~"^(${REFS})$"](37.40,126.70,37.75,127.25);node(r);out tags;`);
const STOPS = new Map(st.elements.map((n) => [n.id, n.tags?.name || n.tags?.['name:ko'] || '']));
// 선로 종류: 0 땅 위 · 1 지하 · 2 다리 · 고가
const kindOf = (t) => (t.tunnel && t.tunnel !== 'no') || +t.layer < 0 || t.location === 'underground' ? 1 : t.bridge && t.bridge !== 'no' ? 2 : 0;
// 역 이름 맞추기: 끝의 '역' · 괄호 · 띄어쓰기를 뺀 것 (실시간 API 의 '총신대입구(이수)' ↔ OSM '총신대입구')
export const norm = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/\s/g, '').replace(/역$/, '');

const out = { frame: [LAT0, LON0], attribution: '© OpenStreetMap contributors', lines: {} };
for (const [ref, name] of Object.entries(LINES)) {
  const rels = rel.elements.filter((e) => e.type === 'relation' && e.tags.ref === ref && !/KTX|ITX|무궁화/.test(e.tags.name || ''));
  if (!rels.length) { console.log('없음', ref); continue; }
  const L = (out.lines[name] ||= { color: COLOR[name], cars: CARS[name], st: {}, seqs: [], edges: {} });
  // 선로 그래프: 꼭짓점 = 좌표(1e-7 반올림), 이음 = 선로 조각 (종류 포함)
  const V = new Map(), pts = [], adj = [];
  const vid = (lat, lon) => { const k = `${Math.round(lat * 1e7)},${Math.round(lon * 1e7)}`; let i = V.get(k); if (i === undefined) { i = pts.length; V.set(k, i); pts.push(XY(lat, lon)); adj.push([]); } return i; };
  for (const r of rels) for (const m of r.members) {
    if (m.type !== 'way' || !m.geometry || (m.role && m.role !== 'route' && m.role !== 'forward' && m.role !== 'backward')) continue;
    const k = kindOf(wayTag.get(m.ref) || {}); let prev = -1;
    for (const g of m.geometry) { if (!g) { prev = -1; continue; } const v = vid(g.lat, g.lon); if (prev >= 0 && prev !== v) { const d = Math.hypot(pts[v][0] - pts[prev][0], pts[v][1] - pts[prev][1]); adj[prev].push([v, d, k]); adj[v].push([prev, d, k]); } prev = v; }
  }
  // 역: 노선 관계의 정차 점(stop) 이름, 순서 = 운행 순서
  for (const r of rels) {
    const seq = [];
    for (const m of r.members) {
      if (m.type !== 'node' || !/^stop/.test(m.role || '')) continue;
      const p = [m.lat, m.lon]; if (p[0] == null) continue; const key = STOPS.get(m.ref); if (!key) continue;
      const xy = XY(p[0], p[1]); const n = norm(key); if (!n) continue;
      const S = (L.st[n] ||= { n: key.replace(/역$/, ''), p: [] }); S.p.push(xy); if (seq[seq.length - 1] !== n) seq.push(n);
    }
    if (seq.length < 2) continue;
    const loop = seq[0] === seq[seq.length - 1] || /순환/.test(r.tags.name || '');
    L.seqs.push({ s: seq, loop: loop ? (/내선/.test(r.tags.name) ? 'in' : /외선/.test(r.tags.name) ? 'out' : 'loop') : '', x: /급행|직통/.test(r.tags.name || '') ? 1 : 0 });
  }
  // 역 자리: 정차 점들의 가운데
  for (const S of Object.values(L.st)) { const n = S.p.length; S.xy = [S.p.reduce((a, q) => a + q[0], 0) / n, S.p.reduce((a, q) => a + q[1], 0) / n]; }
  // 역 사이 선로: 가장 짧은 길 (다익스트라), 같은 쌍은 한 번만
  const near = (xy) => { let b = -1, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (pts[i][0] - xy[0]) ** 2 + (pts[i][1] - xy[1]) ** 2; if (d < bd) { bd = d; b = i; } } return bd < 400 ** 2 ? b : -1; };
  // 역마다 정차 점 하나하나의 가까운 선로 꼭짓점 (방향마다 선로가 따로 그려진 노선도 있어서, 같은 쪽 선로끼리 이어지게)
  const nearCache = new Map(), nearOf = (n) => { if (!nearCache.has(n)) nearCache.set(n, [...new Set(L.st[n].p.map(near).filter((v) => v >= 0))]); return nearCache.get(n); };
  for (const { s } of L.seqs) for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i]; if (a === b || L.edges[`${a}|${b}`] || L.edges[`${b}|${a}`]) continue;
    const A = L.st[a].xy, B = L.st[b].xy; if (!inBox(A) && !inBox(B)) continue;
    const va = nearOf(a), vb = nearOf(b), straight = Math.hypot(B[0] - A[0], B[1] - A[1]); let path = null;
    if (va.length && vb.length) path = dijkstra(va, new Set(vb), straight * 3 + 500);
    // 선로를 못 찾으면 곧은 선 (지하로 본다)
    const P = path ? path.map(([v, k]) => [pts[v][0], pts[v][1], k]) : [[A[0], A[1], 1], [B[0], B[1], 1]];
    P[0] = [A[0], A[1], P[0][2]]; P[P.length - 1] = [B[0], B[1], P[P.length - 1][2]];
    L.edges[`${a}|${b}`] = simplify(P);
  }
  // 여러 출발점 → 여러 도착점 중 가장 가까운 것
  function dijkstra(srcs, tgts, maxD) {
    const dist = new Map(srcs.map((v) => [v, 0])), from = new Map(), heap = srcs.map((v) => [0, v]); let t0 = -1;
    while (heap.length) { let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i; const [d, v] = heap.splice(bi, 1)[0]; if (tgts.has(v)) { t0 = v; break; } if (d > (dist.get(v) ?? Infinity) || d > maxD) continue; for (const [w, len, k] of adj[v]) { const nd = d + len; if (nd < (dist.get(w) ?? Infinity)) { dist.set(w, nd); from.set(w, [v, k]); heap.push([nd, w]); } } }
    if (t0 < 0) return null; const path = [[t0, 0]]; let v = t0; while (from.has(v)) { const [p, k] = from.get(v); path[path.length - 1][1] = k; path.push([p, k]); v = p; } return path.reverse();
  }
}
// 출력 전 정리: 쓰는 역만, 좌표는 0.1m 정수
for (const [name, L] of Object.entries(out.lines)) {
  const used = new Set(); for (const k of Object.keys(L.edges)) for (const n of k.split('|')) used.add(n);
  L.st = Object.fromEntries(Object.entries(L.st).filter(([n]) => used.has(n)).map(([n, S]) => [n, [S.n, Math.round(S.xy[0]), Math.round(S.xy[1])]]));
  L.seqs = L.seqs.filter((q) => q.s.some((n) => used.has(n)));
  for (const k of Object.keys(L.edges)) L.edges[k] = L.edges[k].flatMap(([x, z, kk]) => [Math.round(x), Math.round(z), kk]);
  console.log(name, '역', Object.keys(L.st).length, '역 사이', Object.keys(L.edges).length, '운행 순서', L.seqs.length);
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('→', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');

// 점 줄이기 (2m 안 직선은 하나로), 종류가 바뀌는 점은 남긴다
function simplify(P) {
  if (P.length < 3) return P; const keep = new Array(P.length).fill(false); keep[0] = keep[P.length - 1] = true;
  for (let i = 1; i < P.length; i++) if (P[i][2] !== P[i - 1][2]) keep[i] = keep[i - 1] = true;
  const rec = (a, b) => { let bi = -1, bd = 2; const [ax, az] = P[a], [bx, bz] = P[b], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; for (let i = a + 1; i < b; i++) { const t = Math.max(0, Math.min(1, ((P[i][0] - ax) * dx + (P[i][1] - az) * dz) / L2)), d = Math.hypot(P[i][0] - ax - dx * t, P[i][1] - az - dz * t); if (d > bd) { bd = d; bi = i; } } if (bi >= 0) { keep[bi] = true; rec(a, bi); rec(bi, b); } };
  let s = 0; for (let i = 1; i < P.length; i++) if (keep[i]) { rec(s, i); s = i; }
  return P.filter((_, i) => keep[i]);
}
