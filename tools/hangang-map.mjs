// 한강 러닝 맵 데이터 만들기: 오픈스트리트맵(OSM) 실제 지도에서 코스 주변의 강 · 섬 · 공원 · 길 · 다리 · 건물을 뽑아
// public/dream-runner/hangang/<코스>.json 으로 낸다 (게임은 이 파일만 읽는다)
//   좌표: 한강 전체에 하나인 좌표계 (원점 북위 37.53 · 동경 126.98, 미터, x = 동쪽 · z = 남쪽). 코스를 늘려도 같은 지도 위에 이어진다
//   쓰기: node tools/hangang-map.mjs yeouido [OSM 캐시 폴더]   (캐시가 없으면 Overpass 에서 받아 저장)
//   지도 데이터 © OpenStreetMap contributors (ODbL) — 게임 화면에 출처를 표시한다
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const P = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];

// 코스: 실제 러닝 코스 (자전거길 이름 · 시작 · 끝 경도) — 나중에 코스를 더하면 여기에 한 줄씩
const COURSES = {
  yeouido: {
    name: '한강 여의도 코스', sub: '서강대교 → 마포대교 → 원효대교 → 63빌딩',
    bbox: [37.512, 126.898, 37.550, 126.962], path: '한강남자전거길', lon: [126.9205, 126.9440],
    // 길 위의 이정표 (가까운 길 지점에 붙인다)
    marks: [['서강대교', 37.5325, 126.9232], ['밤섬', 37.5375, 126.9310], ['마포대교', 37.5300, 126.9332], ['여의도 물빛광장', 37.5280, 126.9365], ['원효대교', 37.5240, 126.9425], ['63빌딩', 37.5205, 126.9400]],
    // 멀리 보이는 랜드마크 (지도 범위 밖)
    // 이름표를 꼭 붙일 건물 (OSM 에서 이름 없이 부분으로만 그려진 것)
    labels: [['63빌딩', 37.51985, 126.94025, 250]],
    // 다리 위 아치 (서강대교: 밤섬 위 150m 닐센 아치)
    arches: [['서강대교', 37.538472, 126.925972, 150]],
    far: [['남산서울타워', 37.5512, 126.9882, 236, 'tower'], ['롯데월드타워', 37.5126, 127.1025, 555, 'lotte']],
  },
};

const id = process.argv[2] || 'yeouido', C = COURSES[id];
if (!C) { console.error(`코스가 없어요: ${id} (${Object.keys(COURSES).join(', ')})`); process.exit(1); }
const CACHE = process.argv[3] || path.join(ROOT, '.cache', 'osm', id);
fs.mkdirSync(CACHE, { recursive: true });

async function overpass(file, body) {
  const f = path.join(CACHE, file);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const B = C.bbox.join(',');
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'jelly-games-hangang-map/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(`[out:json][timeout:170];(${body.replaceAll('$B', B)});out geom;`) });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j)); return j;
}
const bJ = await overpass('buildings.json', 'way["building"]($B);relation["building"]($B);way["building:part"]($B);');
// 멀리: 한강 물줄기 · 섬 (가양 ~ 반포) · 높은 건물 (스카이라인) — 코스에서 강을 따라 멀리 보이는 풍경
const FAR_B = [37.470, 126.840, 37.590, 127.090];
async function overpassFar(file, body) { const f = path.join(CACHE, file); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); const keep = C.bbox; C.bbox = FAR_B; try { return await overpass(file, body); } finally { C.bbox = keep; } }
const wJ = await overpassFar('water_far.json', 'way["natural"="water"]["water"="river"]($B);relation["natural"="water"]["water"="river"]($B);way["place"~"island|islet"]($B);relation["place"~"island|islet"]($B);');
const tJ = await overpassFar('tall_far.json', 'way["building"]["building:levels"~"^(1[8-9]|[2-9][0-9])$"]($B);way["building"]["height"~"^([5-9][0-9]|[1-5][0-9][0-9])"]($B);way["building:part"]["height"~"^([1-5][0-9][0-9])"]($B);');
const lJ = await overpass('land.json', 'way["natural"="water"]($B);relation["natural"="water"]($B);way["waterway"="riverbank"]($B);relation["waterway"="riverbank"]($B);way["place"~"island|islet"]($B);relation["place"~"island|islet"]($B);way["leisure"~"park|pitch|playground|garden"]($B);relation["leisure"="park"]($B);way["landuse"~"grass|recreation_ground|forest|meadow"]($B);way["natural"~"wood|scrub|grassland|wetland|sand|beach"]($B);relation["natural"~"wood|wetland|grassland"]($B);way["highway"]($B);way["railway"~"rail|subway"]($B);way["man_made"~"bridge|pier"]($B);');

// ---------- 기하 도우미 ----------
const geo = (g) => g.map((p) => P(p.lat, p.lon));
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const same = (a, b) => d2(a, b) < 0.25;
function simplify(pts, eps) { // 더글러스-포이커
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let best = -1, bi = -1; const [ax, az] = pts[a], [bx, bz] = pts[b], L = Math.hypot(bx - ax, bz - az) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (az - pts[i][1]) - (ax - pts[i][0]) * (bz - az)) / L; if (d > best) { best = d; bi = i; } }
    if (best > eps) { keep[bi] = 1; st.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function joinRings(ways) { // 여러 길을 끝점끼리 이어 닫힌 고리로
  const rest = ways.map((w) => [...w]).filter((w) => w.length > 1), rings = [];
  while (rest.length) {
    let r = rest.shift();
    for (let grew = true; grew && !same(r[0], r[r.length - 1]);) {
      grew = false;
      for (let i = 0; i < rest.length; i++) {
        const w = rest[i], end = r[r.length - 1];
        if (same(end, w[0])) r = r.concat(w.slice(1)); else if (same(end, w[w.length - 1])) r = r.concat([...w].reverse().slice(1));
        else if (same(r[0], w[w.length - 1])) r = w.concat(r.slice(1)); else if (same(r[0], w[0])) r = [...w].reverse().concat(r.slice(1)); else continue;
        rest.splice(i, 1); grew = true; break;
      }
    }
    if (r.length > 3) rings.push(r);
  }
  return rings;
}
function clipRect(poly, [x0, z0, x1, z1]) { // 서덜랜드-호지먼: 지도 범위로 자르기
  let out = poly;
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]], [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]], [(p) => p[1] >= z0, (a, b) => [a[0] + ((b[0] - a[0]) * (z0 - a[1])) / (b[1] - a[1]), z0]], [(p) => p[1] <= z1, (a, b) => [a[0] + ((b[0] - a[0]) * (z1 - a[1])) / (b[1] - a[1]), z1]]];
  for (const [inside, cut] of edges) {
    const src = out; out = []; if (!src.length) break;
    for (let i = 0; i < src.length; i++) { const cur = src[i], prev = src[(i + src.length - 1) % src.length]; if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); } else if (inside(prev)) out.push(cut(prev, cur)); }
  }
  return out;
}
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
const inPoly = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (r[i][1] > p[1] !== r[j][1] > p[1] && p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; };
const centroid = (r) => { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return [x / r.length, z / r.length]; };
// 폴리곤 모양 (외곽 · 구멍)
function polysOf(e) {
  if (e.type === 'way') { const g = geo(e.geometry || []); return g.length > 3 && same(g[0], g[g.length - 1]) ? [{ o: g.slice(0, -1), h: [] }] : []; }
  const outer = joinRings((e.members || []).filter((m) => m.role !== 'inner' && m.geometry).map((m) => geo(m.geometry)));
  const inner = joinRings((e.members || []).filter((m) => m.role === 'inner' && m.geometry).map((m) => geo(m.geometry)));
  return outer.map((o) => ({ o: same(o[0], o[o.length - 1]) ? o.slice(0, -1) : o, h: inner.filter((h) => inPoly(h[0], o)).map((h) => (same(h[0], h[h.length - 1]) ? h.slice(0, -1) : h)) }));
}

// ---------- 코스 (실제 자전거길) ----------
const pathWays = lJ.elements.filter((e) => e.type === 'way' && e.tags?.name === C.path).map((e) => geo(e.geometry));
// 끝점이 이어지는 길을 하나로 (가장 긴 줄)
function chain(ways) {
  const rest = ways.map((w) => [...w]); let best = [];
  while (rest.length) {
    let r = rest.shift();
    for (let grew = true; grew;) {
      grew = false;
      for (let i = 0; i < rest.length; i++) {
        const w = rest[i], end = r[r.length - 1], near = (a, b) => d2(a, b) < 4;
        if (near(end, w[0])) r = r.concat(w.slice(1)); else if (near(end, w[w.length - 1])) r = r.concat([...w].reverse().slice(1)); else if (near(r[0], w[w.length - 1])) r = w.concat(r.slice(1)); else if (near(r[0], w[0])) r = [...w].reverse().concat(r.slice(1)); else continue;
        rest.splice(i, 1); grew = true; break;
      }
    }
    const len = r.reduce((a, p, i) => a + (i ? Math.sqrt(d2(p, r[i - 1])) : 0), 0);
    if (len > (best.len || 0)) { best = r; best.len = len; }
  }
  return best;
}
let route = chain(pathWays);
const [xa] = P(37.53, C.lon[0]), [xb] = P(37.53, C.lon[1]);
if (route[0][0] > route[route.length - 1][0]) route.reverse(); // 서쪽 → 동쪽
route = route.filter((p) => p[0] >= xa && p[0] <= xb);
route = simplify(route, 0.6);
const routeLen = route.reduce((a, p, i) => a + (i ? Math.sqrt(d2(p, route[i - 1])) : 0), 0);
if (routeLen < 1000) throw new Error(`코스 길이가 이상해요 (${routeLen}m): 자전거길 이름 · 경도를 확인해 주세요`);
const center = centroid(route).map(Math.round);
const R = 2600, rect = [center[0] - R, center[1] - R, center[0] + R, center[1] + R];
const near = (p, lim) => { let m = Infinity; for (let i = 1; i < route.length; i++) { const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); m = Math.min(m, Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1])); if (m < lim) return m; } return m; };

// 좌표는 코스 중심 기준 0.1m 정수로 줄여 담는다
const q = (p) => [Math.round((p[0] - center[0]) * 10), Math.round((p[1] - center[1]) * 10)];
const flat = (pts) => pts.flatMap(q);
const out = { id, name: C.name, sub: C.sub, origin: [LAT0, LON0], center, scale: 0.1, len: Math.round(routeLen), attribution: '© OpenStreetMap contributors', route: flat(route) };

// ---------- 물 · 섬 · 녹지 ----------
const polyOut = (pp, eps = 1.5) => { const o = clipRect(simplify(pp.o, eps), rect); if (o.length < 3 || Math.abs(area(o)) < 30) return null; return [flat(o), ...pp.h.map((h) => clipRect(simplify(h, eps), rect)).filter((h) => h.length > 2 && Math.abs(area(h)) > 30).map(flat)]; };
out.water = []; out.island = []; out.green = [];
const R2 = 7000, rect2 = [center[0] - R2, center[1] - R2, center[0] + R2, center[1] + R2];
for (const e of wJ.elements) {
  const t = e.tags || {}, isl = t.place === 'island' || t.place === 'islet';
  if (isl && t.name === '여의도') continue;
  for (const pp of polysOf(e)) { const o = clipRect(simplify(pp.o, isl ? 2 : 4), rect2); if (o.length < 3 || Math.abs(area(o)) < 200) continue; const holes = pp.h.map((h) => clipRect(simplify(h, 3), rect2)).filter((h) => h.length > 2 && Math.abs(area(h)) > 200).map(flat); (isl ? out.island : out.water).push([flat(o), ...holes]); }
}
for (const e of lJ.elements) {
  const t = e.tags || {};
  const kind = t.natural === 'water' || t.waterway === 'riverbank' ? (t.water === 'pond' || t.water === 'lake' ? 'pond' : 'water') : t.place === 'island' || t.place === 'islet' ? 'island' : t.leisure || t.landuse || ['wood', 'scrub', 'grassland', 'wetland', 'sand', 'beach'].includes(t.natural) ? 'green' : null;
  if (!kind || (e.type === 'way' && !(e.geometry?.length > 3))) continue;
  if (kind === 'water' || kind === 'island') continue; // 강 · 섬은 위에서 넓은 범위로 넣었다 (연못만 여기서)
  if (t.place === 'island' && t.name === '여의도') continue; // 여의도 섬 전체는 땅 바탕과 같다
  const sub = t.natural === 'wood' || t.landuse === 'forest' ? 'wood' : t.natural === 'wetland' || t.natural === 'grassland' ? 'wild' : t.leisure === 'pitch' ? 'pitch' : t.natural === 'sand' || t.natural === 'beach' ? 'sand' : 'grass';
  for (const pp of polysOf(e)) { const o = polyOut(pp); if (!o) continue; if (kind === 'water' || kind === 'pond') out.water.push(o); else if (kind === 'island') out.island.push(o); else out.green.push([sub, ...o]); }
}

// ---------- 이름 있는 구역 (공원 · 광장 · 섬): 들어가면 화면에 이름이 뜬다 ----------
out.areas = [];
for (const e of [...lJ.elements, ...wJ.elements]) {
  const t = e.tags || {}; if (!t.name || !(t.leisure === 'park' || t.leisure === 'garden' || t.place === 'square' || t.place === 'islet' || t.place === 'island' || t.natural === 'wetland' || t.natural === 'grassland') || t.name === '여의도') continue;
  for (const pp of polysOf(e)) { const c = centroid(pp.o); if (near(c, 900) > 900 && !pp.o.some((p) => near(p, 60) < 60)) continue; const o = clipRect(simplify(pp.o, 3), rect); if (o.length < 3 || Math.abs(area(o)) < 800) continue; if (out.areas.some((a) => a[0] === t.name)) continue; out.areas.push([t.name, ...flat(o)]); }
}

// ---------- 길 · 철길 · 다리 ----------
const W = { motorway: 22, trunk: 18, primary: 14, secondary: 10, tertiary: 8, trunk_link: 6, primary_link: 6, secondary_link: 6, motorway_link: 6, cycleway: 3, footway: 2.4, path: 2, pedestrian: 4 };
out.roads = []; out.bridges = []; out.rails = []; out.paths = [];
for (const e of lJ.elements) {
  const t = e.tags || {}; if (e.type !== 'way' || !e.geometry || t.tunnel === 'yes' || t.tunnel === 'building_passage' || +t.layer < 0) continue;
  const g = geo(e.geometry), mid = g[Math.floor(g.length / 2)];
  if (mid[0] < rect[0] || mid[0] > rect[2] || mid[1] < rect[1] || mid[1] > rect[3]) continue;
  const bridge = t.bridge === 'yes' || t.bridge === 'viaduct';
  if (t.railway === 'rail' || t.railway === 'subway') { const pts = simplify(g, 1); if (bridge) out.bridges.push({ n: t.name || '', w: 7, rail: 1, p: flat(pts) }); else out.rails.push(flat(pts)); continue; }
  const w0 = W[t.highway]; if (!w0) continue;
  const lanes = +t.lanes || 0, w = t.highway in { cycleway: 1, footway: 1, path: 1, pedestrian: 1 } ? w0 : Math.max(w0, lanes * 3.3 + 1);
  const pts = simplify(g, 0.8);
  if (bridge && w0 >= 6) { out.bridges.push({ n: t['bridge:name'] || t.name || '', w, p: flat(pts) }); continue; }
  if (t.highway in { cycleway: 1, footway: 1, path: 1, pedestrian: 1 }) { if (t.name === C.path || near(mid, 450) < 450) out.paths.push([t.name === C.path ? 1 : 0, w, ...flat(pts)]); continue; }
  if (w0 >= 8) out.roads.push([w, bridge ? 1 : 0, ...flat(pts)]);
}

// ---------- 건물 ----------
const KIND = { apartments: 1, residential: 1, officetel: 2, commercial: 2, office: 2, tower: 2, hotel: 2, retail: 2, government: 3, public: 3, mice: 3, hospital: 3, house: 4, detached: 4, terrace: 4, school: 5, university: 5, kindergarten: 5, church: 6, temple: 6, roof: 7, train_station: 8, parking: 9, parkingbuilding: 9 };
const num = (v) => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const colors = [], names = [], cIdx = (c) => { if (!c) return -1; let i = colors.indexOf(c); if (i < 0) { i = colors.length; colors.push(c); } return i; }, nIdx = (n) => { if (!n) return -1; let i = names.indexOf(n); if (i < 0) { i = names.length; names.push(n); } return i; };
const items = [];
for (const e of bJ.elements) {
  const t = e.tags || {}, part = !!t['building:part'] && !t.building;
  for (const pp of polysOf(e)) { const o = pp.o; if (o.length < 3) continue; items.push({ t, part, o, c: centroid(o) }); }
}
// 부분(building:part)이 들어 있는 건물 외곽선은 그리지 않는다 (OSM 3D 규칙)
const parts = items.filter((b) => b.part);
// 부분으로 그려진 건물: 외곽선의 이름 · 종류를 안쪽 부분들에 물려준다 (국회의사당 · 63빌딩처럼 이름표와 모습이 맞게)
for (const b of items) { if (b.part || !b.t.name) continue; for (const p of parts) if (!p.t.name && Math.abs(p.c[0] - b.c[0]) < 250 && Math.abs(p.c[1] - b.c[1]) < 250 && inPoly(p.c, b.o)) { p.inherit = b.t.name; p.inheritKind = b.t.building; } }
out.buildings = [];
let dropped = 0;
for (const b of items) {
  const { t, o, c } = b;
  if (c[0] < rect[0] || c[0] > rect[2] || c[1] < rect[1] || c[1] > rect[3]) continue;
  if (!b.part && parts.some((p) => Math.abs(p.c[0] - c[0]) < 200 && Math.abs(p.c[1] - c[1]) < 200 && inPoly(p.c, o))) continue;
  const lv = num(t['building:levels']), h = num(t.height) || (lv ? lv * 3.3 + 1 : 0) || (t.building === 'house' ? 7 : 10);
  const mh = num(t.min_height) || (num(t['building:min_level']) ? num(t['building:min_level']) * 3.3 : 0);
  const a = Math.abs(area(o)), d = near(c, 1800);
  if (a < 25 || (d > 1800 && h < 45) || (d > 900 && h < 12 && a < 400)) { dropped++; continue; }
  const s = simplify(o, a > 2000 ? 1.2 : 0.6);
  if (s.length < 3) continue;
  const kind = KIND[t.building] ?? KIND[b.inheritKind] ?? KIND[t['building:part']] ?? 0, mat = t['building:material'] === 'glass' ? 1 : 0;
  // 돔 지붕: 지붕 높이(m)를 담는다 (없으면 외곽 크기로 짐작)
  const dome = t['roof:shape'] === 'dome' ? Math.max(1, Math.round(num(t['roof:height']) || 0)) : 0;
  out.buildings.push([Math.round(h * 10) / 10, Math.round(mh * 10) / 10, kind * 2 + mat, cIdx(t['building:colour'] || ''), nIdx(t.name || b.inherit || ''), cIdx(t['roof:colour'] || ''), dome, ...flat(s)]);
}
out.colors = colors; out.names = names;

// ---------- 먼 높은 건물 (스카이라인): 방향 있는 상자로 ----------
out.tall = [];
{
  const seen = [];
  for (const e of tJ.elements) {
    const t = e.tags || {}; if (e.type !== 'way' || !e.geometry) continue;
    const o = geo(e.geometry); if (o.length < 4) continue; const c = centroid(o);
    if (c[0] > rect[0] && c[0] < rect[2] && c[1] > rect[1] && c[1] < rect[3]) continue; // 가까운 곳은 실제 모양으로 이미 있다
    if (Math.hypot(c[0] - center[0], c[1] - center[1]) > 9500) continue;
    const lv = num(t['building:levels']), h = num(t.height) || lv * 3.1 + 2; if (h < 45) continue;
    if (seen.some((q2) => Math.abs(q2[0] - c[0]) < 6 && Math.abs(q2[1] - c[1]) < 6)) continue; seen.push(c);
    // 가장 긴 변의 방향으로 상자 크기를 잰다
    let best = 0, ang = 0; for (let i = 1; i < o.length; i++) { const L = Math.hypot(o[i][0] - o[i - 1][0], o[i][1] - o[i - 1][1]); if (L > best) { best = L; ang = Math.atan2(o[i][1] - o[i - 1][1], o[i][0] - o[i - 1][0]); } }
    const ca = Math.cos(ang), sa = Math.sin(ang); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of o) { const dx = p[0] - c[0], dz = p[1] - c[1], u = dx * ca + dz * sa, v = -dx * sa + dz * ca; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const cx = c[0] + ca * (u0 + u1) / 2 - sa * (v0 + v1) / 2, cz = c[1] + sa * (u0 + u1) / 2 + ca * (v0 + v1) / 2;
    out.tall.push([...q([cx, cz]), Math.round((u1 - u0) * 10), Math.round((v1 - v0) * 10), Math.round(ang * 100), Math.round(h), t['building:material'] === 'glass' || /^#?[0-9a-f]{6}$/i.test(t['building:colour'] || '') ? 1 : t.building === 'apartments' ? 2 : 0]);
  }
}

// ---------- 이정표 · 먼 랜드마크 ----------
const along = (p) => { let best = Infinity, bs = 0, acc = 0; for (let i = 1; i < route.length; i++) { const a = route[i - 1], b = route[i], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L || 1))), d = Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]); if (d < best) { best = d; bs = acc + L * t; } acc += L; } return Math.round(bs); };
out.marks = C.marks.map(([n, lat, lon]) => [n, along(P(lat, lon))]).sort((a, b) => a[1] - b[1]);
out.labels = (C.labels || []).map(([n, lat, lon, h]) => [n, ...q(P(lat, lon)), h]);
out.arches = (C.arches || []).map(([n, lat, lon, span]) => [n, ...q(P(lat, lon)), span]);
out.far = C.far.map(([n, lat, lon, h, k]) => [n, ...q(P(lat, lon)), h, k]);

const file = path.join(ROOT, 'public', 'dream-runner', 'hangang', `${id}.json`);
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log(`먼 물줄기 ${out.water.length} · 먼 높은 건물 ${out.tall.length}`);
console.log(`${C.name}: 코스 ${Math.round(routeLen)}m · 물 ${out.water.length} · 섬 ${out.island.length} · 녹지 ${out.green.length} · 길 ${out.roads.length} · 산책로 ${out.paths.length} · 다리 ${out.bridges.length} · 철길 ${out.rails.length} · 건물 ${out.buildings.length} (뺀 것 ${dropped}) · ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
console.log('이정표', JSON.stringify(out.marks)); console.log('구역', out.areas.map((a) => a[0]).join(', '));
