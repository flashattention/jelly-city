// 서울 전체 지도용 작은 파일: 25개 구 경계(OSM) + 만들어 둔 지역마다 코스 선 → public/dream-runner/hangang/seoul.json
//   좌표계는 지역 지도와 같다 (위도 37.53 · 경도 126.98 기준 m). 구 경계는 10m 정수로 줄인다
//   쓰는 법: node tools/seoul-index.mjs   (구 경계는 .cache/osm/seoul/gu.json — 없으면 Overpass 에서 받는다)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const P = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const DIR = path.join(ROOT, 'public/dream-runner/hangang'), CACHE = path.join(ROOT, '.cache/osm/seoul/gu.json');

if (!fs.existsSync(CACHE)) {
  const q = '[out:json][timeout:160];area["name"="서울특별시"]["admin_level"="4"]->.s;(relation(area.s)["boundary"="administrative"]["admin_level"="6"];);out geom;';
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'jelly-games-hangang-map/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, await r.text());
}
const gj = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
// 바깥 고리 잇기 (조각난 way 들을 끝점끼리)
function rings(members) {
  const segs = members.filter((m) => m.role !== 'inner' && m.geometry).map((m) => m.geometry.map((g) => P(g.lat, g.lon)));
  const out = [], near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1;
  while (segs.length) { let r = segs.shift(); for (let grew = true; grew;) { grew = false; for (let i = 0; i < segs.length; i++) { const s = segs[i], e = r[r.length - 1]; if (near(e, s[0])) r = r.concat(s.slice(1)); else if (near(e, s[s.length - 1])) r = r.concat([...s].reverse().slice(1)); else continue; segs.splice(i, 1); grew = true; break; } } out.push(r); }
  return out;
}
function simplify(pts, tol) { if (pts.length < 3) return pts; const keep = [pts[0]]; let last = pts[0]; for (const p of pts) if (Math.hypot(p[0] - last[0], p[1] - last[1]) > tol) { keep.push(p); last = p; } return keep; }
const gu = gj.elements.filter((e) => e.tags?.name).map((e) => ({ name: e.tags.name, rings: rings(e.members || []).map((r) => simplify(r, 60).flatMap(([x, z]) => [Math.round(x / 10), Math.round(z / 10)])).filter((r) => r.length >= 6) }));

// 지역마다 코스 (전역 좌표 · m) + 이름 · 부제 · 종류
const regions = [];
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'seoul.json')) {
  const M = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), S = M.scale || 0.1, route = [];
  for (let i = 0; i < M.route.length; i += 2) route.push([Math.round(M.center[0] + M.route[i] * S), Math.round(M.center[1] + M.route[i + 1] * S)]);
  regions.push({ id: M.id, name: M.name, sub: M.sub, kind: M.kind || 'river', route: route.flat() });
}
const out = { frame: [LAT0, LON0], unit: 10, gu, regions, attribution: '© OpenStreetMap contributors' };
fs.writeFileSync(path.join(DIR, 'seoul.json'), JSON.stringify(out));
console.log(`구 ${gu.length} · 지역 ${regions.length} · ${(JSON.stringify(out).length / 1024).toFixed(0)}KB`);
