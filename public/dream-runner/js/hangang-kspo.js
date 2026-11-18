// 🏟️ 올림픽공원 (공공데이터 활용 경진대회 · docs/dream-runner/공공데이터-경진대회-작업지시서.md)
//   한국체육산업개발(주) 공공데이터로 올림픽공원을 짓고 지금 모습으로 움직인다
//   - 공연장 실감형 콘텐츠(15127487): KSPO DOME · SK핸드볼경기장 · 우리금융아트홀 · 88호수 수변무대 · 88잔디마당 3D 를
//     tools/kspo-venue.mjs 로 가볍게 줄인 것(public/dream-runner/hangang/kspo/*.json)을 OSM 실제 외곽선 자리에 세운다 (지도 상자 건물 대신)
//   - 공연정보(15149169) · 잔디시설정보(15143220) · 주차장 혼잡도(15164156): public/dream-runner/hangang/kspo/data.json (tools/kspo-data.mjs)
//   - 실시간 주차현황(15168686) + 서울 도시데이터(붐빔 · 날씨): 서버 /api/seoul/olympicpark (키는 서버에만)
import * as THREE from 'three';
import { registerAttraction, ATTR_SKIP } from './hangang-attractions.js';

const BASE = new URL('../hangang/kspo/', import.meta.url);
// osm: 칸 지도(t_6_0) 건물 이름 → 그 외곽선 가운데에 세운다 · at: 이름 없는 곳은 좌표(게임 m) · fit: 외곽선 긴 쪽에 맞춰 돌린다
//   foot: 부딪힘 높이(m, 외곽선 그대로) · wet: 이 재질(이름) 꼭짓점이 물에 덜 잠기는 방향으로 돌린다 (수변무대 객석은 뭍에)
const VENUES = [
  { id: 'dome', name: 'KSPO DOME', osm: '올림픽체조경기장', file: 'dome', foot: 22, hall: true },
  { id: 'handball', name: 'SK핸드볼경기장', osm: 'SK올림픽핸드볼경기장', file: 'handball', foot: 18, hall: true, roof: { kind: 'dome', r: 47.6, y: 15.2, h: 4.2, c: '#e6e3dc' } },
  { id: 'woori', name: '우리금융아트홀', osm: '우리금융아트홀', file: 'woori', foot: 11, fit: true, hall: true, roof: { kind: 'hull', group: /Color C02/, minY: 16, y: 22.4, c: '#d8d1c3' } },
  { id: 'lake', name: '88호수 수변무대', osm: '88호수 수변무대', file: 'lake', dry: /wood|cherry|terrazzo|block/i },
  { id: 'lawn', name: '88잔디마당', at: [12819, 1222], file: 'lawn88' },
];
for (const v of VENUES) if (v.osm) ATTR_SKIP.add(v.osm);
export const OP_C = [12880, 1250];

let DATA = null, LIVE = null, liveAt = 0, G = null, building = false;
const fetchJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
async function loadLive() { if (Date.now() - liveAt < 120000) return LIVE; liveAt = Date.now(); try { LIVE = await fetchJSON('/api/seoul/olympicpark'); } catch { /* 이전 값 */ } return LIVE; }

// ---------- 오늘 정보 ----------
const kstNow = () => new Date(Date.now() + 9 * 3600e3);
const ymd = (d) => d.toISOString().slice(0, 10);
function lawnOpen(l, d = kstNow()) { if (l.open === 'all') return true; const md = ymd(d).slice(5); return md >= l.open[0] && md <= l.open[1]; }
function showsNow() {
  if (!DATA) return { today: [], next: null, last: null };
  const t = ymd(kstNow()), today = DATA.shows.filter((s) => s.d === t), next = DATA.shows.find((s) => s.d > t) || null, past = DATA.shows.filter((s) => s.d < t);
  return { today, next, last: past[past.length - 1] || null };
}
// 주차 혼잡: 실시간 대수(공원 전체) → 원활 · 보통 · 혼잡 · 매우 혼잡, 없으면 혼잡도 자료(요일 · 시간대 평균)
function parkLevel() {
  const n = LIVE?.parking?.sum;
  if (Number.isFinite(n)) { const lv = n < 900 ? 0 : n < 1700 ? 1 : n < 2400 ? 2 : 3; return { lv, txt: ['원활', '보통', '혼잡', '매우 혼잡'][lv], n, live: true }; }
  if (!DATA) return null;
  const d = kstNow(), k = `${d.getUTCDay()}-${d.getUTCHours()}`, vs = Object.values(DATA.parking).map((z) => z.wh[k] ?? z.avg), a = vs.reduce((s, v) => s + v, 0) / (vs.length || 1);
  const lv = a < 0.6 ? 0 : a < 1 ? 1 : a < 1.4 ? 2 : 3; return { lv, txt: ['원활', '보통', '혼잡', '매우 혼잡'][lv], live: false };
}
const short = (s, n = 34) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const md = (d) => `${+d.slice(5, 7)}.${+d.slice(8, 10)}`;

// ---------- 공연장 3D ----------
const MAT = {};
function mats() { if (!MAT.op) { MAT.op = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); MAT.tr = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }); } return MAT; }
// 재질 묶음 → 한 모양(꼭짓점 색 · 각진 면), 투명한 재질은 따로
function venueMesh(J) {
  const op = [], tr = [], col = new THREE.Color();
  for (const g of J.groups) {
    const P = g.p, I = g.i, dst = g.a < 0.95 ? tr : op; col.set(g.c);
    // 젤리 서울 러너 색감: 회색 콘크리트는 살짝 따뜻하게, 아주 어두운 색은 조금 밝게 (낮에 까만 덩어리로 보이지 않게)
    const hsl = {}; col.getHSL(hsl); if (hsl.l < 0.12) col.setHSL(hsl.h, hsl.s, 0.12 + hsl.l * 0.5); if (hsl.s < 0.08 && hsl.l > 0.45) col.offsetHSL(0.08, 0.06, 0);
    for (let t = 0; t < I.length; t++) { const k = I[t] * 3; dst.push(P[k] / 100, P[k + 1] / 100, P[k + 2] / 100, col.r, col.g, col.b); }
  }
  const mk = (arr, m) => { if (!arr.length) return null; const n = arr.length / 6, pos = new Float32Array(n * 3), cc = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos.set(arr.slice(i * 6, i * 6 + 3), i * 3); cc.set(arr.slice(i * 6 + 3, i * 6 + 6), i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cc, 3)); geo.computeVertexNormals(); const me = new THREE.Mesh(geo, m); me.castShadow = m === MAT.op; me.receiveShadow = true; return me; };
  const g = new THREE.Group(), a = mk(op, mats().op), b = mk(tr, MAT.tr); if (a) g.add(a); if (b) g.add(b); return g;
}
const ringOf = (M, name) => { const ni = M.names.indexOf(name); const b = ni >= 0 && M.buildings.find((q) => q[4] === ni); if (!b) return null; const r = []; for (let i = 7; i + 1 < b.length; i += 2) r.push([b[i] * M.scale, b[i + 1] * M.scale]); return r; };
const pcaAng = (pts) => { let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length; let a = 0, b = 0, c = 0; for (const [x, z] of pts) { a += (x - cx) ** 2; b += (z - cz) ** 2; c += (x - cx) * (z - cz); } return 0.5 * Math.atan2(2 * c, a - b); };

// 지붕: 실감형 콘텐츠는 무대 설계용이라 객석 위가 열려 있다 → 실제처럼 덮는다 (모델 좌표에서 만들어 함께 돈다)
//   dome: 바깥 벽 윗선(y)에서 가운데로 h 만큼 솟는 낮은 돔 + 가장자리 테 · hull: 그 재질 높은 꼭짓점들의 볼록 껍질을 y 높이에 평평하게
function roofMesh(J, R) {
  const col = new THREE.Color(R.c), m = new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }), g = new THREE.Group();
  if (R.kind === 'dome') {
    const geo = new THREE.SphereGeometry(1, 48, 8, 0, Math.PI * 2, 0, Math.PI / 2); geo.scale(R.r, R.h, R.r); geo.translate(0, R.y, 0); const me = new THREE.Mesh(geo, m); me.castShadow = true; g.add(me);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R.r, 0.45, 6, 64), new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.82) })); rim.rotation.x = Math.PI / 2; rim.position.y = R.y; g.add(rim);
  } else {
    const pts = []; for (const gr of J.groups) if (R.group.test(gr.n || '')) for (let i = 0; i < gr.p.length; i += 3) if (gr.p[i + 1] / 100 >= R.minY) pts.push([gr.p[i] / 100, gr.p[i + 2] / 100]);
    const hull = convexHull(pts); if (hull.length < 3) return g;
    const shape = new THREE.Shape(hull.map(([x, z]) => new THREE.Vector2(x, -z))), geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, R.y, 0); const me = new THREE.Mesh(geo, m); me.castShadow = true; g.add(me);
  }
  return g;
}
function convexHull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ---------- 젤리 관객 · 방문객 (붐빔 · 공연에 따라) ----------
//   공연이 있는 날: KSPO DOME 앞 입장 줄 + 공연장 앞 무리. 평소: 실시간 주차 혼잡 단계만큼 공연장 · 잔디마당 둘레에 띄엄띄엄
//   한 인스턴스(그리기 1번), 몸이 통통 튀며 줄은 천천히 앞으로
let JELLY_G = null;
function jellyGeo() {
  if (JELLY_G) return JELLY_G;
  const parts = [], body = new THREE.SphereGeometry(0.34, 12, 8); body.scale(1, 1.25, 0.95); body.translate(0, 0.46, 0); parts.push(body);
  const head = new THREE.SphereGeometry(0.27, 12, 8); head.translate(0, 1.0, 0); parts.push(head);
  for (const sx of [-1, 1]) { const ear = new THREE.SphereGeometry(0.09, 8, 6); ear.translate(sx * 0.17, 1.22, 0); parts.push(ear); }
  const pos = [], nor = []; for (const g of parts) { const n = g.toNonIndexed(); pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); }
  JELLY_G = new THREE.BufferGeometry(); JELLY_G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); JELLY_G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return JELLY_G;
}
const JELLY_C = ['#ff8fb1', '#ffd36e', '#8fd3ff', '#b79bff', '#9ff0b8', '#ffb38a', '#f7f3ea', '#ff9a9a'];
function crowd(root, out, H) {
  const MAX = 160, im = new THREE.InstancedMesh(jellyGeo(), new THREE.MeshLambertMaterial({ color: '#ffffff' }), MAX); im.castShadow = true; im.count = 0; im.frustumCulled = false; root.add(im);
  const c = new THREE.Color(); for (let i = 0; i < MAX; i++) im.setColorAt(i, c.set(JELLY_C[i % JELLY_C.length]));
  const C = { im, list: [], key: '' };
  // 사람 자리 만들기: 공연 · 혼잡이 바뀔 때만
  C.plan = () => {
    const S = showsNow(), P = parkLevel(), show = !!S.today[0], lv = P ? P.lv : 1, key = `${show}|${lv}`; if (key === C.key) return; C.key = key; C.list = [];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const dome = out.venues.find((v) => v.id === 'dome');
    // 입장 줄: 돔 남서쪽 가장자리에서 공원 가운데 쪽으로 구불구불
    if (show && dome) { const dx = OP_C[0] - dome.x, dz = OP_C[1] - dome.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L; for (let k = 0; k < 70; k++) { const d = 70 + k * 0.9, w = Math.sin(k * 0.21) * 2.2; C.list.push({ x: dome.x + ux * d - uz * w, z: dome.z + uz * d + ux * w, q: k, line: true }); } }
    const per = [0, 14, 30, 48][lv] + (show ? 30 : 0);
    for (const v of out.venues) { if (!v.hall && v.id !== 'lawn') continue; const n = v.id === 'lawn' ? Math.round(per * 0.8) : per / 3; for (let k = 0; k < n && C.list.length < MAX; k++) { const a = rnd() * Math.PI * 2, r = (v.id === 'dome' ? 74 : v.id === 'handball' ? 56 : v.id === 'lawn' ? 30 : 34) + rnd() * 14; C.list.push({ x: v.x + Math.cos(a) * r, z: v.z + Math.sin(a) * r, q: k, ph: rnd() * 6 }); } }
    for (const p of C.list) { p.y = H.terrAt(p.x, p.z, true); p.ry = rnd() * Math.PI * 2; }
    im.count = Math.min(MAX, C.list.length);
  };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  C.tick = (t) => { for (let i = 0; i < im.count; i++) { const p = C.list[i], b = Math.abs(Math.sin(t * (p.line ? 2.2 : 3) + (p.ph ?? p.q * 0.7))) * 0.12; E.set(0, p.ry + Math.sin(t * 0.7 + i) * 0.3, 0); Q.setFromEuler(E); M4.compose(V.set(p.x, p.y + b, p.z), Q, S1.set(1, 1 - b * 0.6, 1)); im.setMatrixAt(i, M4); } im.instanceMatrix.needsUpdate = true; };
  C.plan(); return C;
}

// ---------- 올림픽공원 산책 코스 ----------
//   평화의문 → 몽촌해자 → 나홀로나무 → 88호수 수변무대 → 88잔디마당 → KSPO DOME → SK핸드볼경기장 (약 2.2km, 자리는 OSM)
//   길을 그어 두지 않고(직선은 해자를 건넌다) 다음 지점에 빛기둥 · 화면 위 안내(남은 거리 · 방향)
const COURSE = [
  ['세계평화의문', 11938, 1292, '1988 서울올림픽을 기념한 공원 정문'], ['몽촌해자', 12060, 1330, '몽촌토성을 둘러싼 물길'], ['나홀로나무', 12393, 803, '몽촌토성 언덕 위 한 그루 나무'],
  ['88호수 수변무대', 12841, 1000, '호숫가 야외 공연장'], ['88잔디마당', 12819, 1222, '큰 야외 공연 · 피크닉 잔디'], ['KSPO DOME', 12990, 1262, '케이팝 공연의 성지, 옛 체조경기장'], ['SK핸드볼경기장', 12925, 1458, '핸드볼 · 공연을 여는 원형 경기장'],
];
function course(root, H) {
  const g = new THREE.Group(); root.add(g);
  const beamM = new THREE.MeshBasicMaterial({ color: '#ffd36e', transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const ringM = new THREE.MeshBasicMaterial({ color: '#ffd36e', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const marks = COURSE.map(([n, x, z]) => { const y = H.terrAt(x, z, true), m = new THREE.Group(); m.position.set(x, y, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 36, 16, 1, true), beamM.clone()); beam.position.y = 18; m.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 40), ringM.clone()); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; m.add(ring); m.visible = false; g.add(m); return { n, x, z, m, beam, ring }; });
  const C = { on: false, i: 0, t0: 0, dist: 0, last: null, marks };
  const hud = () => { let el = document.getElementById('op-course'); if (!el) { el = document.createElement('div'); el.id = 'op-course'; el.style.cssText = 'position:absolute;left:50%;top:64px;transform:translateX(-50%);z-index:29;padding:8px 14px;border-radius:14px;background:rgba(14,20,36,.82);color:#fff;font:600 14px/1.4 system-ui,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 8px 22px rgba(0,0,0,.3)'; document.body.append(el); } return el; };
  C.start = () => { C.on = true; C.i = 0; C.t0 = performance.now(); C.dist = 0; C.last = null; C.done = false; };
  C.stop = () => { C.on = false; for (const k of marks) k.m.visible = false; document.getElementById('op-course')?.remove(); };
  const ARW = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
  C.tick = (t, px, pz, face) => {
    if (!C.on) return;
    if (C.last) C.dist += Math.min(8, Math.hypot(px - C.last[0], pz - C.last[1])); C.last = [px, pz];
    marks.forEach((k, j) => { k.m.visible = j >= C.i; const cur = j === C.i; k.beam.material.opacity = cur ? 0.5 + Math.sin(t * 3) * 0.12 : 0.16; k.ring.material.opacity = cur ? 0.9 : 0.3; k.ring.scale.setScalar(cur ? 1 + Math.sin(t * 2) * 0.08 : 0.7); });
    const k = marks[C.i]; if (!k) return; const dx = k.x - px, dz = k.z - pz, d = Math.hypot(dx, dz);
    if (d < 9) { C.i++; if (C.i >= marks.length) { const min = (performance.now() - C.t0) / 60000; hud().textContent = `🎉 올림픽공원 산책 코스 완주! ${(C.dist / 1000).toFixed(2)}km · ${Math.floor(min)}분 ${Math.round((min % 1) * 60)}초`; C.on = false; for (const q of marks) q.m.visible = false; setTimeout(() => document.getElementById('op-course')?.remove(), 9000); return; } }
    // 방향: 곰이 보는 쪽 기준 (f = 0 이 남쪽(+z), π/2 동쪽)
    const rel = Math.atan2(dx, dz) - (face || 0), oct = ((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8;
    hud().textContent = `🚶 산책 코스 ${C.i + 1}/${marks.length} · ${marks[C.i].n} ${ARW[oct]} ${Math.round(d)}m`;
  };
  return C;
}

async function buildAll(hg) {
  const H = hg.host || hg, C = hg.chunks.get('6_0'); if (!C) return null;
  const M = C.map, root = new THREE.Group(); root.name = 'olympicpark'; root.userData.noDrape = true;
  DATA = DATA || (await fetchJSON(new URL('data.json', BASE)).catch(() => null));
  const out = { root, venues: [] };
  for (const v of VENUES) {
    let J; try { J = await fetchJSON(new URL(`${v.file}.json`, BASE)); } catch { continue; }
    const ring = v.osm ? ringOf(M, v.osm) : null;
    let cx, cz; if (ring) { cx = 0; cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; } else [cx, cz] = v.at;
    const mesh = venueMesh(J); if (v.roof) mesh.add(roofMesh(J, v.roof));
    // 방향: 외곽선 긴 쪽에 맞추기 (네 방향 중 모델 크기가 외곽선 상자와 가장 닮은 것)
    let yaw = 0;
    if (v.fit && ring) { const mpts = []; for (const g of J.groups) for (let i = 0; i < g.p.length; i += 30) mpts.push([g.p[i] / 100, g.p[i + 2] / 100]); yaw = pcaAng(mpts) - pcaAng(ring); }
    // 수변무대: 객석(뭍 재질 꼭짓점)이 물에 가장 덜 잠기는 방향
    if (v.dry && H.inWater) { const pts = []; for (const g of J.groups) if (v.dry.test(g.n || '')) for (let i = 0; i < g.p.length; i += 24) pts.push([g.p[i] / 100, g.p[i + 2] / 100]); let best = Infinity;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); let wet = 0; for (const [x, z] of pts) if (H.inWater(cx + x * ca + z * sa, cz - x * sa + z * ca)) wet++; if (wet < best) { best = wet; yaw = a; } } }
    const y = H.terrAt(cx, cz, true);
    mesh.position.set(cx, y - 0.05, cz); mesh.rotation.y = yaw; root.add(mesh);
    if (ring && v.foot) H.addFoot?.({ ring, h: v.foot, base: y, x0: Math.min(...ring.map((p) => p[0])), x1: Math.max(...ring.map((p) => p[0])), z0: Math.min(...ring.map((p) => p[1])), z1: Math.max(...ring.map((p) => p[1])), name: v.name, type: 'stone', key: 'olympicpark' });
    out.venues.push({ ...v, x: cx, z: cz, y, mesh, top: J.bbox[1][1] });
  }
  // 공연장 전광판: 최근 · 다음 공연 제목 (KSPO DOME · 핸드볼경기장 · 아트홀 앞)
  out.boards = out.venues.filter((v) => v.hall).map((v) => board(root, v));
  out.crowd = crowd(root, out, H); out.course = course(root, H); out.data = DATA; // data: 점검용 (콘솔에서 공연 날 흉내)
  hg.scene.add(root);
  return out;
}
// 전광판: 기둥 위 빛나는 판, 글씨는 그림 한 장 (공연 정보가 바뀌면 다시 그린다)
function board(root, v) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(), r = Math.max(14, (v.id === 'dome' ? 66 : v.id === 'handball' ? 50 : 34)) + 6;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.2, 8), new THREE.MeshLambertMaterial({ color: '#4a4f58' })); pole.position.y = 2.1; g.add(pole);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide })); face.position.y = 5.2; g.add(face);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.8, 0.3), new THREE.MeshLambertMaterial({ color: '#2b2f38' })); frame.position.set(0, 5.2, -0.18); g.add(frame);
  // 공원 가운데 쪽을 바라보게, 건물 테두리 바로 앞
  const dx = OP_C[0] - v.x, dz = OP_C[1] - v.z, L = Math.hypot(dx, dz) || 1; g.position.set(v.x + (dx / L) * r, v.y, v.z + (dz / L) * r); g.rotation.y = Math.atan2(dx, dz); root.add(g);
  const draw = () => {
    const x = cv.getContext('2d'), S = showsNow(), s = S.today[0] || S.next || S.last; x.fillStyle = '#0d1020'; x.fillRect(0, 0, 512, 192);
    x.fillStyle = '#ffd36e'; x.font = 'bold 34px sans-serif'; x.fillText(v.name, 22, 48);
    x.fillStyle = S.today[0] ? '#7dffb0' : '#9fb6ff'; x.font = 'bold 26px sans-serif'; x.fillText(S.today[0] ? '오늘 공연' : S.next ? `다음 공연 ${md(s.d)}` : s ? `최근 공연 ${md(s.d)}` : '공연 정보', 22, 96);
    x.fillStyle = '#ffffff'; x.font = '24px sans-serif'; x.fillText(s ? short(s.t, 32) : '—', 22, 140); x.fillStyle = '#8a92a8'; x.font = '18px sans-serif'; x.fillText('한국체육산업개발 공연정보', 22, 176); tex.needsUpdate = true;
  };
  draw(); return { g, draw };
}

// ---------- 오늘의 올림픽공원 (안내 창) ----------
function panel() {
  let el = document.getElementById('op-panel');
  if (!el) {
    el = document.createElement('div'); el.id = 'op-panel';
    const st = document.createElement('style'); st.textContent = `#op-panel{position:absolute;right:14px;top:84px;z-index:30;width:min(340px,calc(100vw - 28px));padding:14px 16px 12px;border-radius:18px;background:rgba(14,20,36,.86);backdrop-filter:blur(8px);color:#fff;font:14px/1.5 system-ui,sans-serif;box-shadow:0 18px 40px rgba(0,0,0,.35)}#op-panel.hidden{display:none}#op-panel h3{margin:0 0 8px;font:700 17px/1.2 system-ui}#op-panel{text-align:left}#op-panel .op-row{display:flex!important;flex-direction:row;gap:8px;align-items:baseline;margin:6px 0;text-align:left}#op-panel .op-k{flex:none;width:44px;color:#9fb0d0;font-size:12.5px}#op-panel .op-v{flex:1;min-width:0}#op-panel .lv{display:inline-block;padding:1px 8px;border-radius:99px;font-weight:700;color:#11182a}#op-panel small{display:block;margin-top:10px;color:#8090b0;font-size:11px;line-height:1.4}#op-panel a{color:#9fd0ff}#op-panel>button{position:absolute;right:10px;top:8px;border:0;background:none;color:#fff;font-size:18px;cursor:pointer}#op-panel .op-go{border:0;border-radius:99px;padding:6px 12px;background:#ffd36e;color:#1d1747;font:700 13px system-ui;cursor:pointer}`;
    document.head.append(st); document.body.append(el);
  }
  return el;
}
const LVC = ['#7dffb0', '#ffe27a', '#ffad6a', '#ff7a8a'];
async function showPanel() {
  const el = panel(); el.classList.remove('hidden'); await loadLive();
  const S = showsNow(), P = parkLevel(), c = LIVE?.city, s = S.today[0] || S.next || S.last;
  const lawns = (DATA?.lawns || []).filter((l) => l.n !== '잔디통제시기').map((l) => `${lawnOpen(l) ? '🟢' : '⚪'} ${l.n}`).join(' · ');
  el.innerHTML = `<button aria-label="닫기">✕</button><h3>🏟️ 오늘의 올림픽공원</h3>
  <div class="op-row"><span class="op-k">공연</span><span class="op-v">${s ? `${S.today[0] ? '<b>오늘</b>' : S.next ? `다음 ${md(s.d)}` : `최근 ${md(s.d)}`} · ${short(s.t, 40)}${s.url ? ` <a href="${s.url}" target="_blank" rel="noopener">예매</a>` : ''}` : '정보 없음'}</span></div>
  <div class="op-row"><span class="op-k">주차</span><span class="op-v">${P ? `<span class="lv" style="background:${LVC[P.lv]}">${P.txt}</span> ${P.live ? `지금 ${P.n.toLocaleString()}대 주차 중` : '요일 · 시간대 평균'}` : '—'}</span></div>
  ${c ? `<div class="op-row"><span class="op-k">사람</span><span class="op-v"><span class="lv" style="background:${LVC[{ 여유: 0, 보통: 1, '약간 붐빔': 2, 붐빔: 3 }[c.congest] ?? 1]}">${c.congest}</span> ${c.pplMin.toLocaleString()} ~ ${c.pplMax.toLocaleString()}명</span></div><div class="op-row"><span class="op-k">날씨</span><span class="op-v">${Number.isFinite(c.temp) ? `${c.temp}°C · ` : ''}${c.sky || ''}</span></div>` : ''}
  <div class="op-row"><span class="op-k">잔디</span><span class="op-v">${lawns || '—'}</span></div>
  <div class="op-row"><span class="op-k">코스</span><span class="op-v"><button class="op-go">${G?.course?.on ? '산책 코스 그만하기' : '🚶 올림픽공원 산책 코스 시작 (7곳 · 약 2.2km)'}</button></span></div>
  <small>자료: 한국체육산업개발(주) 공공데이터 — 공연장 실감형 콘텐츠 · 공연정보 · 잔디시설정보 · 주차장 혼잡도 · 실시간 주차현황${c ? ' / 서울시 실시간 도시데이터' : ''}</small>`;
  el.querySelector('button').onclick = () => el.classList.add('hidden');
  const go = el.querySelector('.op-go'); if (go) go.onclick = () => { if (!G?.course) return; if (G.course.on) G.course.stop(); else G.course.start(); el.classList.add('hidden'); };
}

registerAttraction({
  id: 'olympicpark', name: '올림픽공원', icon: '🏟️', x: OP_C[0], z: OP_C[1], r: 90, buildR: 1400, verb: '오늘 정보', go: [12700, 1150, Math.PI * 0.75],
  intro: '한국체육산업개발 공공데이터로 지은 올림픽공원 — 공연 · 주차 · 잔디를 지금 모습으로',
  introNow() { const S = showsNow(), s = S.today[0] || S.next || S.last, P = parkLevel(); return `${s ? `${S.today[0] ? '오늘' : S.next ? '다음' : '최근'} 공연 ${short(s.t, 22)}` : '공연 정보'} · 주차 ${P ? P.txt : '—'}`; },
  start() { showPanel(); return null; },
  build(A) {
    const hg = A.hg; loadLive();
    return {
      tick(dt) { if (G) { G.root.visible = true; const t = (G.t = (G.t || 0) + (dt || 0.016)); G.crowd?.tick(t); G.course?.tick(t, hg.px, hg.pz, hg.face); if ((G.planT = (G.planT || 0) - (dt || 0.016)) <= 0) { G.planT = 30; loadLive().then(() => { G.crowd?.plan(); for (const b of G.boards || []) b.draw(); }); } return; } if (building) return; if (!hg.chunks?.has('6_0') || hg.chunkLoading) return; building = true; buildAll(hg).then((o) => { G = o; hg.olympicPark = o; }).finally(() => { building = false; }); },
      dispose() { if (G) { G.root.visible = false; G.course?.stop(); } document.getElementById('op-panel')?.classList.add('hidden'); },
    };
  },
});
