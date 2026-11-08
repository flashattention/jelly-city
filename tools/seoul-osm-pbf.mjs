// 서울 칸 OSM 캐시를 OSM 원본 파일(.osm.pbf, Geofabrik 한국 추출본)에서 바로 만든다 — Overpass 공개 서버가 504 로 막힐 때
//   PBF 를 직접 푼다(의존성 없이: 프로토콜 버퍼 · zlib). 서울 둘레(+3km) 점만 기억하고, 길 · 건물 · 땅 · 관계를 Overpass 'out geom' 과 같은 꼴로
//   칸마다(2km + 150m 여유) 잘라 .cache/osm/tiles/t_i_j/{buildings,land,stations,pois,water_far}.json 에 쓴다 (이미 있는 파일은 그대로)
//   고르는 기준은 tools/osm-queries.mjs 의 Overpass 질문과 같다
//   쓰는 법: curl -L -o .cache/osm/pbf/south-korea-latest.osm.pbf https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
//           node --max-old-space-size=2500 tools/seoul-osm-pbf.mjs
//   지도 데이터 © OpenStreetMap contributors (ODbL)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PBF = path.join(ROOT, '.cache/osm/pbf/south-korea-latest.osm.pbf'), TC = path.join(ROOT, '.cache/osm/tiles');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574, T = 2000, M = 150;
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dream-runner/hangang/seoul.json'), 'utf8')), U = S.unit || 10;
const rings = S.gu.flatMap((g) => g.rings.map((r) => { const p = []; for (let i = 0; i < r.length; i += 2) p.push([r[i] * U, r[i + 1] * U]); return p; }));
const inRing = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity; for (const r of rings) for (const [x, z] of r) { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); }
// seoul-tiles.mjs 와 같은 칸 목록
const tiles = [];
for (let i = Math.floor(X0 / T); i <= Math.floor(X1 / T); i++) for (let j = Math.floor(Z0 / T); j <= Math.floor(Z1 / T); j++) { let hit = false; for (let a = 0; a <= 4 && !hit; a++) for (let b = 0; b <= 4 && !hit; b++) hit = rings.some((r) => inRing(i * T + (a / 4) * T, j * T + (b / 4) * T, r)); if (hit) tiles.push([i, j]); }
const tileSet = new Set(tiles.map(([i, j]) => `${i}_${j}`));
// 점을 기억할 상자: 칸 전체 + 3km (위경도, 1e-7 도 정수)
const tx0 = Math.min(...tiles.map((t) => t[0])) * T - 3000, tx1 = (Math.max(...tiles.map((t) => t[0])) + 1) * T + 3000, tz0 = Math.min(...tiles.map((t) => t[1])) * T - 3000, tz1 = (Math.max(...tiles.map((t) => t[1])) + 1) * T + 3000;
const LATMIN = Math.round((LAT0 - tz1 / KZ) * 1e7), LATMAX = Math.round((LAT0 - tz0 / KZ) * 1e7), LONMIN = Math.round((LON0 + tx0 / KX) * 1e7), LONMAX = Math.round((LON0 + tx1 / KX) * 1e7);
console.log(`칸 ${tiles.length}개 · 점 상자 위도 ${LATMIN / 1e7} ~ ${LATMAX / 1e7}, 경도 ${LONMIN / 1e7} ~ ${LONMAX / 1e7}`);

// ---------- 고르는 기준 (osm-queries.mjs 와 같게: Overpass 의 ~"a|b" 는 부분 일치) ----------
const has = (t, k) => t[k] !== undefined, re = (t, k, r) => t[k] !== undefined && r.test(t[k]);
const WAY = {
  buildings: (t) => has(t, 'building') || has(t, 'building:part'),
  water_far: (t) => (t.natural === 'water' && t.water === 'river') || re(t, 'place', /island|islet/),
  land: (t) => t.natural === 'water' || t.waterway === 'riverbank' || re(t, 'place', /island|islet/) || re(t, 'leisure', /park|pitch|playground|garden/) || re(t, 'landuse', /grass|recreation_ground|forest|meadow/) || re(t, 'natural', /wood|scrub|grassland|wetland|sand|beach/) || has(t, 'highway') || re(t, 'railway', /rail|subway/) || re(t, 'man_made', /bridge|pier/),
};
const REL = {
  buildings: (t) => has(t, 'building'),
  water_far: (t) => (t.natural === 'water' && t.water === 'river') || re(t, 'place', /island|islet/),
  land: (t) => t.natural === 'water' || t.waterway === 'riverbank' || re(t, 'place', /island|islet/) || t.leisure === 'park' || re(t, 'natural', /wood|wetland|grassland/),
};
const NODE = {
  stations: (t) => t.railway === 'subway_entrance' || t.railway === 'station' || t.public_transport === 'station',
  pois: (t) => has(t, 'name') && (/^(cafe|restaurant|fast_food|bar|pub|ice_cream|food_court)$/.test(t.amenity ?? '\0') || /^(convenience|bakery|pastry|supermarket|deli)$/.test(t.shop ?? '\0')),
};
const CATS = ['buildings', 'land', 'stations', 'pois', 'water_far'];

// ---------- 프로토콜 버퍼 읽기 ----------
class R {
  constructor(b, s = 0, e = b.length) { this.b = b; this.p = s; this.e = e; }
  more() { return this.p < this.e; }
  v() { let r = 0, m = 1, c; do { c = this.b[this.p++]; r += (c & 127) * m; m *= 128; } while (c & 128); return r; } // 2^53 까지
  sv() { const v = this.v(); return v % 2 ? -(v + 1) / 2 : v / 2; }
  key() { const k = this.v(); return [Math.floor(k / 8), k & 7]; }
  bytes() { const n = this.v(), s = this.p; this.p += n; return [s, this.p]; }
  skip(w) { if (w === 0) this.v(); else if (w === 1) this.p += 8; else if (w === 2) { const n = this.v(); this.p += n; } else if (w === 5) this.p += 4; else throw new Error('wire ' + w); }
  packed(fn) { const [s, e] = this.bytes(), r = new R(this.b, s, e), out = []; while (r.more()) out.push(fn(r)); return out; }
}

// ---------- 기억 ----------
// 점: 번호 순서대로 (파일이 번호 순) → 이분 탐색
let nCap = 1 << 22, nN = 0, nId = new Float64Array(nCap), nLat = new Int32Array(nCap), nLon = new Int32Array(nCap);
const addNode = (id, la, lo) => { if (nN === nCap) { nCap *= 2; const a = new Float64Array(nCap); a.set(nId); nId = a; const b = new Int32Array(nCap); b.set(nLat); nLat = b; const c = new Int32Array(nCap); c.set(nLon); nLon = c; } nId[nN] = id; nLat[nN] = la; nLon[nN] = lo; nN++; };
const findNode = (id) => { let a = 0, b = nN - 1; while (a <= b) { const m = (a + b) >> 1, v = nId[m]; if (v === id) return m; if (v < id) a = m + 1; else b = m - 1; } return -1; };
// 길: 서울 상자에 점이 하나라도 있으면 (태그가 맞으면 태그도)
let rCap = 1 << 23, rN = 0, refs = new Float64Array(rCap); const ways = []; // { id, a, b(refs 구간), t, cats }
const wayIndex = new Map(); // 관계 구성원 찾기용 id → ways 번호
const nodeEls = []; // { cats, el }
const rels = []; // { id, t, cats, mem: [[type, ref, role]] }
let sorted = true, lastId = -1;

function block(buf) {
  const r = new R(buf); let st = [], gran = 100, lato = 0, lono = 0; const groups = [];
  while (r.more()) { const [f, w] = r.key(); if (f === 1 && w === 2) { const [s, e] = r.bytes(), q = new R(buf, s, e); while (q.more()) { const [f2, w2] = q.key(); if (f2 === 1 && w2 === 2) { const [a, b] = q.bytes(); st.push(buf.toString('utf8', a, b)); } else q.skip(w2); } } else if (f === 2 && w === 2) groups.push(r.bytes()); else if (f === 17) gran = r.v(); else if (f === 19) lato = r.v(); else if (f === 20) lono = r.v(); else r.skip(w); }
  const LA = (v) => Math.round((lato + gran * v) / 100), LO = (v) => Math.round((lono + gran * v) / 100); // 1e-7 도
  const tagsOf = (ks, vs) => { const t = {}; for (let i = 0; i < ks.length; i++) t[st[ks[i]]] = st[vs[i]]; return t; };
  const catsOf = (D, t) => { const c = []; for (const k in D) if (D[k](t)) c.push(k); return c; };
  for (const [gs, ge] of groups) {
    const g = new R(buf, gs, ge);
    while (g.more()) {
      const [f, w] = g.key();
      if (f === 2 && w === 2) { // 촘촘한 점
        const [s, e] = g.bytes(), d = new R(buf, s, e); let ids = [], lats = [], lons = [], kv = null;
        while (d.more()) { const [f2, w2] = d.key(); if (f2 === 1) ids = d.packed((x) => x.sv()); else if (f2 === 8) lats = d.packed((x) => x.sv()); else if (f2 === 9) lons = d.packed((x) => x.sv()); else if (f2 === 10) kv = d.packed((x) => x.v()); else d.skip(w2); }
        let id = 0, la = 0, lo = 0, k = 0;
        for (let i = 0; i < ids.length; i++) {
          id += ids[i]; la += lats[i]; lo += lons[i]; const LAi = LA(la), LOi = LO(lo), inB = LAi >= LATMIN && LAi <= LATMAX && LOi >= LONMIN && LOi <= LONMAX;
          let t = null; if (kv) { while (kv[k] !== 0 && k < kv.length) { if (inB) { t ||= {}; t[st[kv[k]]] = st[kv[k + 1]]; } k += 2; } k++; }
          if (!inB) continue; if (id < lastId) sorted = false; lastId = id; addNode(id, LAi, LOi);
          if (t) { const c = catsOf(NODE, t); if (c.length) nodeEls.push({ cats: c, el: { type: 'node', id, lat: LAi / 1e7, lon: LOi / 1e7, tags: t } }); }
        }
      } else if (f === 1 && w === 2) { // 낱개 점 (드묾)
        const [s, e] = g.bytes(), d = new R(buf, s, e); let id = 0, la = 0, lo = 0, ks = [], vs = [];
        while (d.more()) { const [f2, w2] = d.key(); if (f2 === 1) id = d.sv(); else if (f2 === 2) ks = d.packed((x) => x.v()); else if (f2 === 3) vs = d.packed((x) => x.v()); else if (f2 === 8) la = d.sv(); else if (f2 === 9) lo = d.sv(); else d.skip(w2); }
        const LAi = LA(la), LOi = LO(lo); if (LAi < LATMIN || LAi > LATMAX || LOi < LONMIN || LOi > LONMAX) continue; if (id < lastId) sorted = false; lastId = id; addNode(id, LAi, LOi);
        if (ks.length) { const t = tagsOf(ks, vs), c = catsOf(NODE, t); if (c.length) nodeEls.push({ cats: c, el: { type: 'node', id, lat: LAi / 1e7, lon: LOi / 1e7, tags: t } }); }
      } else if (f === 3 && w === 2) { // 길
        const [s, e] = g.bytes(), d = new R(buf, s, e); let id = 0, ks = [], vs = [], rf = [];
        while (d.more()) { const [f2, w2] = d.key(); if (f2 === 1) id = d.v(); else if (f2 === 2) ks = d.packed((x) => x.v()); else if (f2 === 3) vs = d.packed((x) => x.v()); else if (f2 === 8) rf = d.packed((x) => x.sv()); else d.skip(w2); }
        let n = 0, any = false; const abs = new Array(rf.length); for (let i = 0; i < rf.length; i++) { n += rf[i]; abs[i] = n; } for (let i = 0; i < abs.length && !any; i += Math.max(1, Math.floor(abs.length / 8))) any = findNode(abs[i]) >= 0; if (!any) any = findNode(abs[abs.length - 1]) >= 0;
        if (!any) continue;
        const t = ks.length ? tagsOf(ks, vs) : null, cats = t ? catsOf(WAY, t) : [];
        if (rN + abs.length > rCap) { while (rN + abs.length > rCap) rCap *= 2; const a = new Float64Array(rCap); a.set(refs.subarray(0, rN)); refs = a; }
        refs.set(abs, rN); wayIndex.set(id, ways.length); ways.push({ id, a: rN, b: rN + abs.length, t: cats.length ? t : null, cats }); rN += abs.length;
      } else if (f === 4 && w === 2) { // 관계
        const [s, e] = g.bytes(), d = new R(buf, s, e); let id = 0, ks = [], vs = [], roles = [], mids = [], types = [];
        while (d.more()) { const [f2, w2] = d.key(); if (f2 === 1) id = d.v(); else if (f2 === 2) ks = d.packed((x) => x.v()); else if (f2 === 3) vs = d.packed((x) => x.v()); else if (f2 === 8) roles = d.packed((x) => x.v()); else if (f2 === 9) mids = d.packed((x) => x.sv()); else if (f2 === 10) types = d.packed((x) => x.v()); else d.skip(w2); }
        if (!ks.length) continue; const t = tagsOf(ks, vs), cats = catsOf(REL, t); if (!cats.length) continue;
        let m = 0; const mem = []; for (let i = 0; i < mids.length; i++) { m += mids[i]; if (types[i] === 1 && wayIndex.has(m)) mem.push([m, st[roles[i]] || '']); }
        if (mem.length) rels.push({ id, t, cats, mem });
      } else g.skip(w);
    }
  }
}

// ---------- 파일 읽기 (조각마다: 길이 · 머리 · 몸통) ----------
const fd = fs.openSync(PBF, 'r'), size = fs.fstatSync(fd).size; let pos = 0, nb = 0; const t0 = Date.now();
const read = (n) => { const b = Buffer.alloc(n); let o = 0; while (o < n) { const k = fs.readSync(fd, b, o, n - o, pos + o); if (!k) throw new Error('파일이 끝났어요'); o += k; } pos += n; return b; };
while (pos < size) {
  const hl = read(4).readUInt32BE(0), hb = read(hl), hr = new R(hb); let type = '', ds = 0;
  while (hr.more()) { const [f, w] = hr.key(); if (f === 1 && w === 2) { const [a, b] = hr.bytes(); type = hb.toString('utf8', a, b); } else if (f === 3) ds = hr.v(); else hr.skip(w); }
  const bb = read(ds); if (type !== 'OSMData') continue;
  const br = new R(bb); let raw = null;
  while (br.more()) { const [f, w] = br.key(); if (f === 1 && w === 2) { const [a, b] = br.bytes(); raw = bb.subarray(a, b); } else if (f === 3 && w === 2) { const [a, b] = br.bytes(); raw = zlib.inflateSync(bb.subarray(a, b)); } else br.skip(w); }
  if (raw) block(raw); nb++;
  if (nb % 500 === 0) console.log(`  ${(pos / size * 100).toFixed(0)}% · 점 ${(nN / 1e6).toFixed(1)}M · 길 ${(ways.length / 1e6).toFixed(2)}M · 관계 ${rels.length} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}
fs.closeSync(fd);
if (!sorted) throw new Error('점 번호가 차례대로가 아니에요 (정렬된 파일이 필요)');
console.log(`다 읽음: 점 ${nN} · 길 ${ways.length} · 관계 ${rels.length} · 표시할 점 ${nodeEls.length} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);

// ---------- 칸마다 쓰기 ----------
const geomOf = (w) => { const g = []; for (let k = w.a; k < w.b; k++) { const i = findNode(refs[k]); if (i >= 0) g.push({ lat: nLat[i] / 1e7, lon: nLon[i] / 1e7 }); } return g; };
const tilesOfBox = (a, b, c, d) => { // 남 · 서 · 북 · 동 (위경도) → 칸들
  const x0 = (b - LON0) * KX - M, x1 = (d - LON0) * KX + M, z0 = -(c - LAT0) * KZ - M, z1 = -(a - LAT0) * KZ + M, out = [];
  for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) for (let j = Math.floor(z0 / T); j <= Math.floor(z1 / T); j++) if (tileSet.has(`${i}_${j}`)) out.push(`t_${i}_${j}`);
  return out;
};
const boxOf = (gs) => { let a = 90, b = 180, c = -90, d = -180; for (const g of gs) for (const p of g) { a = Math.min(a, p.lat); b = Math.min(b, p.lon); c = Math.max(c, p.lat); d = Math.max(d, p.lon); } return [a, b, c, d]; };
for (const cat of CATS) {
  // 칸마다 파일을 열어 두고 조금씩 쓴다 (메모리를 아끼려고)
  const out = new Map(); for (const [i, j] of tiles) { const id = `t_${i}_${j}`, dir = path.join(TC, id), f = path.join(dir, `${cat}.json`); if (fs.existsSync(f)) continue; fs.mkdirSync(dir, { recursive: true }); out.set(id, { f, tmp: f + '.part', fd: fs.openSync(f + '.part', 'w'), buf: '', n: 0 }); }
  if (!out.size) { console.log(`${cat}: 다 있어요`); continue; }
  const put = (ids, el) => { let s = null; for (const id of ids) { const o = out.get(id); if (!o) continue; s ??= JSON.stringify(el); o.buf += (o.n++ ? ',' : '{"elements":[') + s; if (o.buf.length > 1 << 18) { fs.writeSync(o.fd, o.buf); o.buf = ''; } } };
  let cnt = 0;
  if (cat === 'stations' || cat === 'pois') for (const { cats, el } of nodeEls) { if (!cats.includes(cat)) continue; put(tilesOfBox(el.lat, el.lon, el.lat, el.lon), el); cnt++; }
  else {
    for (const w of ways) { if (!w.cats.includes(cat)) continue; const g = geomOf(w); if (g.length < 2) continue; put(tilesOfBox(...boxOf([g])), { type: 'way', id: w.id, geometry: g, tags: w.t }); cnt++; }
    for (const rl of rels) { if (!rl.cats.includes(cat)) continue; const members = rl.mem.map(([ref, role]) => ({ type: 'way', ref, role, geometry: geomOf(ways[wayIndex.get(ref)]) })).filter((m) => m.geometry.length > 1); if (!members.length) continue; put(tilesOfBox(...boxOf(members.map((m) => m.geometry))), { type: 'relation', id: rl.id, members, tags: rl.t }); cnt++; }
  }
  for (const o of out.values()) { fs.writeSync(o.fd, (o.n ? o.buf : '{"elements":[') + ']}'); fs.closeSync(o.fd); fs.renameSync(o.tmp, o.f); }
  console.log(`${cat}: ${cnt}개 → 칸 ${out.size}개에 썼어요`);
}
