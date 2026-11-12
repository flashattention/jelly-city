// 롯데월드 (잠실, 서울 전체 칸 t_5_0 · t_5_1): 실내 어드벤처 건물 · 유리 돔, 석촌호수 서호의 매직아일랜드(성 · 놀이기구), 둘을 잇는 다리 · 모노레일
//   자리는 모두 OSM 실제 외곽선 · 점 (게임 m: x 동쪽, z 남쪽). 놀이기구 이름은 상표 대신 일반 이름, 캐릭터는 쓰지 않는다
//   놀이기구는 다가가 E (휴대폰은 🎢 단추)로 탄다. 타는 사람이 없어도 빈 차 · 탄 곰들이 돌아간다
//   그리기 호출을 줄이려고: 움직이지 않는 것은 공원 전체를 재질마다 한 덩어리로, 움직이는 부품은 기구마다 한 덩어리, 탄 곰은 공원 전체 인스턴스 하나
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- 실제 자리 (OSM) ----------
const ADV = [10498.5,2000.5,10495,1990,10327.5,2042,10295,2104.5,10303.5,2132.5,10310.5,2130,10327.5,2183.5,10343,2179.5,10345.5,2188.5,10380.5,2178,10383.5,2187,10421,2175,10424.5,2185,10461,2173,10464,2183,10505,2169.5,10506.5,2173,10537,2163.5,10540.5,2140.5,10547,2123,10558,2104.5,10578.5,2084,10565.5,2051.5,10562.5,2034,10498.5,2000.5];
const ISLE = [10641,2243,10611,2261,10606.5,2265.5,10596.5,2272.5,10589.5,2293,10601,2307,10613,2314.5,10616,2315.5,10624,2326,10621.5,2332.5,10617,2334.5,10615.5,2342,10619,2345.5,10619,2348.5,10605.5,2359,10602,2361,10588.5,2361,10577.5,2359,10569,2352.5,10566.5,2349.5,10565,2343.5,10565,2323.5,10556.5,2310.5,10551,2309.5,10547,2303.5,10526,2315,10519.5,2317,10499.5,2328,10493.5,2345,10498,2352,10504.5,2356.5,10511.5,2358,10512.5,2362,10521,2363.5,10525.5,2362,10536,2380.5,10533.5,2386.5,10532.5,2392.5,10533.5,2396.5,10538.5,2398,10547,2398.5,10545.5,2404,10548,2411,10552,2416.5,10559,2419,10572,2420,10606,2406,10617.5,2411,10651,2390.5,10657,2367,10661.5,2364.5,10666.5,2364.5,10685,2354,10695,2320,10691,2306,10679.5,2308.5,10677,2304,10679.5,2295,10684,2296,10691,2274,10676.5,2270.5,10670,2292.5,10674.5,2293.5,10672,2302,10666.5,2299.5,10661,2294.5,10664,2293,10656,2277.5,10653.5,2279,10651.5,2275,10658,2272,10654.5,2264.5,10641,2243];
const ISLET = [10569,2338,10574,2349,10578,2352,10585.5,2349.5,10588.5,2351.5,10588,2355.5,10589,2358,10594.5,2358.5,10598,2356.5,10599.5,2354.5,10602,2354,10610.5,2347.5,10613,2343.5,10610.5,2341,10612,2338.5,10612.5,2332.5,10616,2329,10616,2326,10614,2322,10608,2315,10601,2311.5,10593,2310.5,10577.5,2318.5,10574.5,2322,10573.5,2324.5,10573,2328,10570.5,2329.5,10568.5,2331.5,10568,2334.5,10569,2338];
const BRIDGE = [10507.5,2172.5,10524.5,2216.5,10529,2232.5,10544.5,2261,10543,2262,10542,2263.5,10542,2265.5,10543.5,2268,10547.5,2268.5,10554,2279,10553,2280.5,10552.5,2283,10554,2284.5,10555.5,2285,10558.5,2284.5,10577.5,2318.5,10586,2314,10566.5,2279.5,10568,2278.5,10568.5,2275,10565.5,2272.5,10564,2273.5,10558,2263,10560,2261.5,10560,2259,10558.5,2257,10556.5,2255.5,10553.5,2256.5,10539,2228,10536,2211.5,10518,2169.5,10507.5,2172.5];
const MONO_OUT = [10507.5,2172.5,10527,2216.5,10529.5,2228,10534,2239.5,10541,2252,10542.5,2257,10541.5,2261.5,10537,2274,10537,2278.5,10539.5,2285,10553.5,2312,10557.5,2317,10559.5,2325.5,10560,2340.5,10558.5,2347,10556,2351,10550,2356,10546.5,2360,10545,2366.5,10546,2372.5,10547.5,2375.5,10554,2382,10557.5,2383,10562.5,2382.5,10568.5,2381,10574,2381,10578.5,2382.5,10585,2389,10588.5,2391.5,10592.5,2392,10598,2391.5,10641.5,2366.5,10649,2360.5,10651,2357.5,10651.5,2355,10652.5,2336.5,10655,2327.5,10655,2322,10653.5,2318.5,10650,2314.5,10645,2311.5,10638,2311,10624,2316,10617.5,2315,10610,2311.5,10604,2307.5,10600.5,2304,10595,2295.5,10576,2262,10574,2259.5,10559.5,2252.5,10548,2243.5,10536.5,2214.5,10514.5,2175.5];
const MONO_IN = [10514.5,2175.5,10508,2156.5,10509,2138.5,10515.5,2123,10525,2108.5,10541,2091.5,10546.5,2077,10547,2058,10541.5,2044.5,10533.5,2033.5,10520,2024,10504.5,2019,10487.5,2019,10344.5,2062.5,10343,2063,10329.5,2075.5,10320.5,2090,10317.5,2107,10322.5,2127,10332,2142,10348,2152.5,10365,2152.5,10383,2146,10397,2134,10418,2124.5,10444.5,2123.5,10470,2132,10487.5,2142.5,10499.5,2155.5,10507.5,2172.5];
const POND = [10554,2388.5,10558,2387.5,10561.5,2385,10564,2378.5,10572,2371,10570.5,2364,10563.5,2355.5,10553.5,2346,10551,2345,10548,2346.5,10536,2355.5,10550.5,2376,10556.5,2380,10554,2388.5];
const pairs = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
export const R_ADV = pairs(ADV), R_MONO_IN = pairs(MONO_IN), R_ISLE = pairs(ISLE), R_ISLET = pairs(ISLET), R_BRIDGE = pairs(BRIDGE), R_POND = pairs(POND);
export function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
export const PARK_C = [10520, 2200];
// 칸의 건물 중 롯데월드 어드벤처 · 섬 위 건물은 빼고 여기서 따로 만든다 (상자 건물 대신 실제 모습)
export function parkSkip(ring) { let x = 0, z = 0; for (const p of ring) { x += p[0]; z += p[1]; } x /= ring.length; z /= ring.length; if (Math.abs(x - 10560) > 220 || Math.abs(z - 2210) > 230) return false; return inRing(x, z, R_ADV) || inRing(x, z, R_ISLE) || inRing(x, z, R_ISLET); }
// 물 위지만 걸을 수 있는 곳: 어드벤처 → 섬 다리
export function parkWalk(x, z) { return Math.abs(x - 10545) < 50 && Math.abs(z - 2245) < 80 && inRing(x, z, R_BRIDGE); }

// ---------- 재질 · 한 덩어리로 묶기 ----------
const MAT = {};
function mats() {
  if (MAT.std) return MAT;
  MAT.std = new THREE.MeshLambertMaterial({ vertexColors: true });
  MAT.metal = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: '#8a8a8a' });
  // 전구 · 네온: 밤에 밝아진다 (색 배율을 tick 에서)
  MAT.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  MAT.glass = new THREE.MeshPhongMaterial({ color: '#bfe2f0', transparent: true, opacity: 0.32, shininess: 140, specular: '#ffffff', depthWrite: false, side: THREE.DoubleSide, emissive: '#ffd9a0', emissiveIntensity: 0 });
  MAT.castle = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ff9ad5', emissiveIntensity: 0 });
  MAT.water = new THREE.MeshPhongMaterial({ color: '#5aa6c8', shininess: 110, specular: '#ffffff', transparent: true, opacity: 0.88 });
  MAT.dbl = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  MAT.bear = new THREE.MeshLambertMaterial({ vertexColors: true });
  return MAT;
}
const _c = new THREE.Color();
export class Kit {
  constructor() { this.b = {}; }
  add(g, col, m = 'std', M4) {
    let q = g.index ? g.toNonIndexed() : g.clone(); if (M4) q.applyMatrix4(M4);
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
    if (!q.attributes.normal) q.computeVertexNormals();
    // 크기 0 인 면의 법선(NaN)은 위로 (NaN 하나가 덩어리 전체 빛 계산을 망쳐 화면이 까매졌다)
    { const nn = q.attributes.normal.array; for (let i = 0; i < nn.length; i += 3) if (!(Math.abs(nn[i]) + Math.abs(nn[i + 1]) + Math.abs(nn[i + 2]) > 1e-6)) { if (!Kit.warned) { Kit.warned = 1; console.warn('NaN normal', g.type); globalThis.__nan = g.type; } nn[i] = 0; nn[i + 1] = 1; nn[i + 2] = 0; } }
    const n = q.attributes.position.count, a = new Float32Array(n * 3); _c.set(col); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } q.setAttribute('color', new THREE.BufferAttribute(a, 3));
    (this.b[m] ||= []).push(q); return this;
  }
  // 꼭짓점 색을 이미 가진 덩어리
  addRaw(q, m = 'std') { (this.b[m] ||= []).push(q); return this; }
  build(parent, { shadow = false } = {}) {
    const out = {};
    for (const [m, list] of Object.entries(this.b)) { if (!list.length) continue; const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); if (!g) continue; g.computeBoundingSphere(); const me = new THREE.Mesh(g, mats()[m]); me.castShadow = shadow && (m === 'std' || m === 'castle'); me.receiveShadow = m === 'std'; me.userData.noDrape = true; me.userData.noMerge = true; parent.add(me); out[m] = me; }
    this.b = {}; return out;
  }
}
// 모양 도우미 (가운데 바닥이 원점)
export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
  cyl: (r0, r1, h, s = 12, open = false) => new THREE.CylinderGeometry(r1, r0, h, s, 1, open).translate(0, h / 2, 0),
  cone: (r, h, s = 12) => new THREE.ConeGeometry(r, h, s).translate(0, h / 2, 0),
  ball: (r, s = 10) => new THREE.SphereGeometry(r, s, Math.max(6, s * 0.7)),
  torus: (R, r, s = 32, rs = 6) => new THREE.TorusGeometry(R, r, rs, s),
};
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
// 자리 · 회전 · 크기 → 행렬
export const T = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);
// 점 a → b 막대 (원기둥)
export function rod(kit, a, b, r, col, m = 'metal', seg = 6) { const d = V1.subVectors(b, a), L = d.length(); if (L < 1e-3) return; const g = new THREE.CylinderGeometry(r, r, L, seg, 1, true); Q.setFromUnitVectors(V2.set(0, 1, 0), d.clone().normalize()); kit.add(g, col, m, new THREE.Matrix4().compose(V3.addVectors(a, b).multiplyScalar(0.5), Q, S1)); }
// 점들을 따라 관 (틀 n · b 를 함께 주면 비틀림 없이)
export function tube(kit, pts, r, col, m = 'metal', rs = 6, closed = false) {
  const P = [], I = [], n = pts.length; if (n < 2) return;
  let prevN = null;
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], t = V1.subVectors(b, a).normalize(); let nn = prevN ? prevN.clone() : (Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)); nn.addScaledVector(t, -nn.dot(t)).normalize(); prevN = nn; const bb = new THREE.Vector3().crossVectors(t, nn);
    for (let k = 0; k < rs; k++) { const ang = (k / rs) * Math.PI * 2, c = Math.cos(ang) * r, s = Math.sin(ang) * r; P.push(pts[i].x + nn.x * c + bb.x * s, pts[i].y + nn.y * c + bb.y * s, pts[i].z + nn.z * c + bb.z * s); } }
  const segs = closed ? n : n - 1; for (let i = 0; i < segs; i++) { const i2 = (i + 1) % n; for (let k = 0; k < rs; k++) { const k2 = (k + 1) % rs, a = i * rs + k, b = i * rs + k2, c = i2 * rs + k, d = i2 * rs + k2; I.push(a, c, b, b, c, d); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); kit.add(g, col, m);
}
// 캔버스 그림 (글씨 판)
export function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ---------- 탄 곰들 (공원 전체 인스턴스 하나) ----------
let BEAR_G = null;
function bearGeo() {
  if (BEAR_G) return BEAR_G; const k = new Kit(), W = '#ffffff';
  // 앉은 젤리곰: 통통한 몸 · 큰 머리 · 동그란 귀 · 주둥이 · 까만 눈 (흰색에 인스턴스 색이 곱해진다)
  k.add(G.ball(0.3, 12), W, 'bear', T(0, 0.34, 0, 0, 0, 0, new THREE.Vector3(1, 1.05, 0.92)));
  k.add(G.ball(0.27, 12), W, 'bear', T(0, 0.82, 0.02));
  for (const s of [-1, 1]) { k.add(G.ball(0.095, 8), W, 'bear', T(s * 0.18, 1.04, 0)); k.add(G.ball(0.09, 8), W, 'bear', T(s * 0.28, 0.42, 0.12)); k.add(G.ball(0.1, 8), W, 'bear', T(s * 0.13, 0.12, 0.28, 0, 0, 0, new THREE.Vector3(1, 0.8, 1.3))); k.add(G.ball(0.035, 6), '#141414', 'bear', T(s * 0.09, 0.86, 0.24)); }
  k.add(G.ball(0.1, 8), '#fff8f0', 'bear', T(0, 0.76, 0.24, 0, 0, 0, new THREE.Vector3(1.2, 0.85, 0.8))); k.add(G.ball(0.03, 6), '#3a2a22', 'bear', T(0, 0.8, 0.32));
  BEAR_G = mergeGeometries(k.b.bear, false); return BEAR_G;
}
const BEAR_COL = ['#ffb3c7', '#9fd3ff', '#ffe38a', '#b8f0a8', '#d9b8ff', '#ffc89a', '#ff8f8f', '#8fe8e0', '#ffffff', '#f5a3e8'];
export class Riders {
  constructor(parent, N = 360) { this.im = new THREE.InstancedMesh(bearGeo(), mats().bear, N); this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < N; i++) this.im.setColorAt(i, _c.set(BEAR_COL[(i * 7) % BEAR_COL.length]).multiplyScalar(0.95)); this.im.count = 0; this.im.frustumCulled = false; this.im.userData.noDrape = true; this.im.userData.noMerge = true; parent.add(this.im); this.N = N; this.n = 0; }
  begin() { this.n = 0; }
  put(m) { if (this.n >= this.N) return; this.im.setMatrixAt(this.n++, m); }
  end() { this.im.count = this.n; this.im.instanceMatrix.needsUpdate = true; }
}
// 자리마다 곰이 앉았는지 (늘 같게)
export const seatHas = (i, k = 0.62) => ((Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1 < k;

// ---------- 놀이기구 바탕 ----------
//   ride: { name, x, z (타는 자리), cycle (초), g (움직이는 부품), seats [Object3D], pose(t) , my (내 자리 번호) }
//   t 는 기구 시계 (한 바퀴 cycle). 내가 타면 한 바퀴 처음부터, 끝나면 내린다
export class Ride {
  constructor(park, o) { Object.assign(this, { cycle: 60, my: 0, fill: 0.6, look: 0, spec: null }, o); this.park = park; this.clock = (Math.random() * this.cycle) | 0; this.seats = []; }
  seat(parent, x, y, z, ry = 0) { const s = new THREE.Object3D(); s.position.set(x, y, z); s.rotation.y = ry; parent.add(s); this.seats.push(s); return s; }
  // 탄 곰 (내 자리는 빼고, 나는 진짜 곰으로)
  riders(pool, me) { const n = this.seats.length; for (let i = 0; i < n; i++) { if (me && i === this.my) continue; if (!seatHas(i + this.name.length * 31, this.fill)) continue; this.seats[i].updateWorldMatrix(true, false); pool.put(this.seats[i].matrixWorld); } }
  tick(dt) { this.clock = (this.clock + dt) % this.cycle; this.pose(this.clock, dt); }
}

// 자유낙하 탑: 고리 의자가 천천히 돌며 오르고 → 꼭대기에서 잠깐 → 떨어지고 → 자석 브레이크로 멈춘다
export class DropTower extends Ride {
  constructor(park, o) {
    super(park, { name: '자유낙하 탑', cycle: 75, ...o }); const { H, R, N, g0, k } = this, cols = this.cols;
    const st = park.stat, x = this.cx, z = this.cz, y0 = g0;
    // 기둥: 흰 원통 + 파랑 띠 + 레일 4줄, 꼭대기 왕관(불빛), 아래 승강장 지붕
    st.add(G.cyl(R * 0.62, R * 0.5, H + 6, 20), cols.tower, 'metal', T(x, y0, z));
    for (let y = 6; y < H; y += 9) st.add(G.cyl(R * 0.64, R * 0.64, 1.2, 20), cols.band, 'std', T(x, y0 + y, z));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; st.add(G.box(0.25, H, 0.25), '#c7cdd4', 'metal', T(x + Math.cos(a) * R * 0.66, y0 + 2, z + Math.sin(a) * R * 0.66)); }
    st.add(G.cyl(R * 1.4, R * 0.7, 3.2, 20), cols.crown, 'std', T(x, y0 + H + 4, z)); st.add(G.cone(R * 0.9, 5, 20), cols.band, 'std', T(x, y0 + H + 7.2, z));
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; st.add(G.ball(0.22, 6), i % 2 ? '#fff2b0' : '#ffb0d8', 'glow', T(x + Math.cos(a) * R * 1.42, y0 + H + 7.1, z + Math.sin(a) * R * 1.42)); }
    for (let y = 8; y < H; y += 3) st.add(G.ball(0.16, 6), '#9fe0ff', 'glow', T(x + R * 0.63, y0 + y, z));
    st.add(G.ball(0.4, 8), '#ff3b30', 'glow', T(x, y0 + H + 12.4, z));
    // 승강장: 둥근 바닥 · 울타리 · 지붕 없음 (위로 열림)
    st.add(G.cyl(R * 2.6, R * 2.6, 0.5, 32), '#cfc6b6', 'std', T(x, y0, z)); st.add(G.torus(R * 2.6, 0.06, 48), '#ffffff', 'metal', T(x, y0 + 1.1, z, 0, Math.PI / 2));
    // 고리 의자 (움직이는 부품): 고리 + 의자 N 개 (바깥을 본다) + 어깨 손잡이
    const ring = new THREE.Group(); ring.position.set(x, y0, z); park.g.add(ring); this.ring = ring; const mk = new Kit(), Rr = R * 1.25;
    mk.add(G.torus(Rr * 0.82, 0.32, 40, 8), cols.ring, 'metal', T(0, 1.0, 0, 0, Math.PI / 2)); mk.add(G.cyl(Rr * 0.86, Rr * 0.86, 0.5, 40, true), cols.ring, 'std', T(0, 1.8, 0));
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, sx = Math.cos(a) * Rr, sz = Math.sin(a) * Rr, ry = Math.atan2(sx, sz);
      mk.add(G.box(0.62, 0.12, 0.55), '#2b2f36', 'std', T(sx, 0.55, sz, ry)); mk.add(G.box(0.62, 0.9, 0.12), cols.seat[i % cols.seat.length], 'std', T(sx - Math.sin(ry) * 0.3, 0.6, sz - Math.cos(ry) * 0.3, ry)); mk.add(G.box(0.5, 0.12, 0.3), '#e8e8e8', 'metal', T(sx - Math.sin(ry) * 0.2, 1.62, sz - Math.cos(ry) * 0.2, ry));
      this.seat(ring, sx, 0.58, sz, ry); }
    mk.build(ring); park.addCircle(x, z, R * 0.7, 999); this.ry = 0; this.spec = [x + H * 0.9, y0 + H * 0.35, z + H * 0.75];
  }
  // 높이 · 회전: 0~10 타기, 10~48 오르기(한 바퀴 돌며), 48~52 꼭대기에서 멈춤, 52~ 자유낙하(약 3초) → 자석 브레이크(2g) → 천천히 내려와 내리기
  pose(t) { const top = this.H - 3, yb = top * 0.36, ftb = Math.sqrt((top - yb) / 4.9), tb = 52 + ftb, vb = 9.8 * ftb, tbr = 2 * (yb - 3) / vb; let y = 0;
    if (t < 10) y = 0; else if (t < 48) { const u = (t - 10) / 38; y = top * (u * u * (3 - 2 * u)); this.ry = u * Math.PI * 2; } else if (t < 52) y = top; else if (t < tb) { const ft = t - 52; y = top - 4.9 * ft * ft; } else if (t < tb + tbr) { const u = (t - tb) / tbr; y = 3 + (yb - 3) * (1 - u) * (1 - u); } else if (t < tb + tbr + 7) { const u = (t - tb - tbr) / 7; y = 3 * (1 - u * u * (3 - 2 * u)); } else y = 0;
    this.ring.position.y = this.g0 + y; this.ring.rotation.y = this.ry; this.h = y; }
}

// 거대 진자: A자 다리 위 축에서 팔이 190°까지 흔들리고, 끝의 원판(바깥 보는 의자 40석)이 돈다
export class Pendulum extends Ride {
  constructor(park, o) {
    super(park, { name: '거대 진자', cycle: 110, ...o }); const st = park.stat, { cx: x, cz: z, g0: y0, ax } = this, PY = 22, L = 17.5, ux = Math.cos(ax), uz = Math.sin(ax), wx = -uz, wz = ux;
    // 다리 둘 (흔들리는 면 양쪽), 축 상자
    for (const s of [-1, 1]) for (const f of [-1, 1]) rod(st, new THREE.Vector3(x + wx * s * 6 + ux * f * 9, y0, z + wz * s * 6 + uz * f * 9), new THREE.Vector3(x + wx * s * 4.2, y0 + PY + 1, z + wz * s * 4.2), 0.55, '#f2f2ef', 'metal', 10);
    st.add(G.box(1.6, 1.6, 9.6), '#6a54c8', 'std', T(x, y0 + PY - 0.8, z, Math.atan2(wx, wz)));
    st.add(G.cyl(13, 13, 0.4, 40), '#d6cec0', 'std', T(x, y0, z)); st.add(G.torus(13, 0.06, 64), '#ffffff', 'metal', T(x, y0 + 1.1, z, 0, Math.PI / 2));
    const piv = new THREE.Group(); piv.position.set(x, y0 + PY, z); piv.rotation.y = Math.atan2(wx, wz); park.g.add(piv); this.piv = piv; const arm = new THREE.Group(); piv.add(arm); this.arm = arm;
    const k = new Kit(); k.add(G.box(1.2, L, 1.2), '#7c5cff', 'metal', T(0, -L, 0)); k.add(G.cyl(1.4, 1.4, 2.2, 16), '#4a3aa8', 'std', T(0, -L - 1.6, 0)); k.build(arm);
    const disk = new THREE.Group(); disk.position.y = -L - 1.6; arm.add(disk); this.disk = disk; const dk = new Kit(), N = 40, Rd = 5.6;
    dk.add(G.cyl(Rd + 0.6, Rd + 0.3, 0.7, 40), '#ffd23f', 'std', T(0, -0.4, 0)); dk.add(G.torus(Rd + 0.6, 0.12, 48), '#ffffff', 'metal', T(0, 0.3, 0, 0, Math.PI / 2));
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; dk.add(G.ball(0.12, 5), i % 2 ? '#ff70b8' : '#7fe0ff', 'glow', T(Math.cos(a) * (Rd + 0.65), -0.05, Math.sin(a) * (Rd + 0.65))); }
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, sx = Math.cos(a) * Rd, sz = Math.sin(a) * Rd, ry = Math.atan2(sx, sz); dk.add(G.box(0.6, 1.0, 0.12), i % 2 ? '#3f6fd8' : '#ff5a7a', 'std', T(sx - Math.sin(ry) * 0.3, 0.2, sz - Math.cos(ry) * 0.3, ry)); dk.add(G.box(0.55, 0.12, 0.5), '#2b2f36', 'std', T(sx, 0.25, sz, ry)); this.seat(disk, sx, 0.28, sz, ry); }
    dk.build(disk); park.addCircle(x, z, 2, 999); this.spec = [x + ux * 36 + wx * 20, y0 + 14, z + uz * 36 + wz * 20];
  }
  // 0~10 타기 · 10~85 흔들기(점점 커져 95°) · 85~100 잦아듦 · 나머지 내리기. 원판은 흔드는 동안 돈다
  pose(t, dt) { let A = 0; if (t > 10 && t < 100) { const u = t < 50 ? (t - 10) / 40 : t < 85 ? 1 : 1 - (t - 85) / 15; A = Math.min(1.66, 0.25 + u * 1.45) * Math.min(1, (t - 10) / 3) * (t > 85 ? Math.max(0, u) : 1); }
    const w = 2 * Math.PI / 7.2; this.arm.rotation.z = A * Math.sin((t - 10) * w); this.spin = (this.spin || 0) + dt * (A > 0.05 ? 0.55 : 0.05); this.disk.rotation.y = this.spin; }
}

// 회전그네: 가운데 기둥 위 지붕이 돌고, 사슬 그네가 바깥으로 날린다 (지붕도 살짝 기운다)
export class Swinger extends Ride {
  constructor(park, o) {
    super(park, { name: '회전그네', cycle: 70, ...o }); const st = park.stat, { cx: x, cz: z, g0: y0 } = this, H = 11;
    st.add(G.cyl(0.9, 0.7, H, 16), '#f6efe2', 'metal', T(x, y0, z)); st.add(G.cyl(9.5, 9.5, 0.35, 40), '#d8cdb8', 'std', T(x, y0, z)); st.add(G.torus(9.5, 0.06, 64), '#ffffff', 'metal', T(x, y0 + 1.1, z, 0, Math.PI / 2));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; st.add(G.ball(0.18, 6), '#fff2b0', 'glow', T(x + Math.cos(a) * 1.0, y0 + 2 + i * 0.9, z + Math.sin(a) * 1.0)); }
    const top = new THREE.Group(); top.position.set(x, y0 + H, z); park.g.add(top); this.top = top; const k = new Kit();
    // 가리비 지붕: 줄무늬 원뿔 + 둘레 늘어뜨린 천 + 전구
    for (let i = 0; i < 16; i++) { const a0 = (i / 16) * Math.PI * 2, g = new THREE.ConeGeometry(6.6, 2.6, 2, 1, true, a0, Math.PI * 2 / 16); g.translate(0, 1.3, 0); k.add(g, i % 2 ? '#ff8fb8' : '#fff4e6', 'std'); const d = new THREE.CylinderGeometry(6.6, 6.6, 0.9, 3, 1, true, a0, Math.PI * 2 / 16); k.add(d, i % 2 ? '#ff8fb8' : '#fff4e6', 'std', T(0, -0.45, 0)); }
    k.add(G.ball(0.7, 10), '#ffd23f', 'metal', T(0, 2.9, 0));
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; k.add(G.ball(0.11, 5), i % 3 ? '#fff6c8' : '#ff9ad5', 'glow', T(Math.cos(a) * 6.62, -0.9, Math.sin(a) * 6.62)); }
    k.build(top);
    // 그네: 사슬 + 의자 (인스턴스 하나, 매 프레임 돌린다)
    const cg = new Kit(); cg.add(G.cyl(0.025, 0.025, 4.6, 4), '#d0d4d8', 'metal', T(-0.2, -4.6, 0)); cg.add(G.cyl(0.025, 0.025, 4.6, 4), '#d0d4d8', 'metal', T(0.2, -4.6, 0)); cg.add(G.box(0.5, 0.08, 0.45), '#3a7bd5', 'std', T(0, -4.7, 0)); cg.add(G.box(0.5, 0.5, 0.06), '#3a7bd5', 'std', T(0, -4.7, -0.22));
    const cgeo = mergeGeometries(cg.b.metal.concat(cg.b.std), false); this.N = 24; this.chairs = new THREE.InstancedMesh(cgeo, mats().std, this.N); this.chairs.userData.noDrape = true; this.chairs.frustumCulled = false; top.add(this.chairs);
    for (let i = 0; i < this.N; i++) { const s = new THREE.Object3D(); top.add(s); this.seats.push(s); }
    park.addCircle(x, z, 1, 999); this.spec = [x + 22, y0 + 8, z + 18]; this.o = new THREE.Object3D();
  }
  // 0~8 타기 · 8~16 빨라짐 · 16~52 돈다(지붕 기울기 물결) · 52~60 느려짐. 그네는 돌수록 바깥으로 날린다 (tan θ = ω²r / g)
  pose(t, dt) { const u = t < 8 ? 0 : t < 16 ? (t - 8) / 8 : t < 52 ? 1 : t < 60 ? 1 - (t - 52) / 8 : 0, w = u * 1.2; this.ang = (this.ang || 0) + w * dt; this.top.rotation.set(Math.sin(t * 0.35) * 0.09 * u, this.ang, Math.cos(t * 0.27) * 0.07 * u);
    const r = 5.9, Lc = 4.7, sw = Math.atan(w * w * (r + 2.5) / 9.8), Y = V3.set(0, 1, 0);
    for (let i = 0; i < this.N; i++) { const a = (i / this.N) * Math.PI * 2, rd = V1.set(Math.cos(a), 0, Math.sin(a)), tg = V2.set(Math.sin(a), 0, -Math.cos(a)), yy = new THREE.Vector3().copy(Y).multiplyScalar(Math.cos(sw)).addScaledVector(rd, -Math.sin(sw)), xx = new THREE.Vector3().crossVectors(yy, tg);
      M4.makeBasis(xx, yy, tg); M4.setPosition(rd.x * r, -0.9, rd.z * r); this.chairs.setMatrixAt(i, M4);
      const s = this.seats[i]; s.quaternion.setFromRotationMatrix(M4); s.position.set(rd.x * r, -0.9, rd.z * r).addScaledVector(yy, -Lc - 0.05); }
    this.chairs.instanceMatrix.needsUpdate = true; }
}

// 레일 위를 달리는 차 (롤러코스터 · 모노레일): 점 목록 → 2m 간격 표 (자리 · 기울기 · 속도)
export function railTable(pts, closed, step = 0.5, pt = false) {
  const cur = new THREE.CatmullRomCurve3(pts, closed, 'centripetal', 0.5), L = cur.getLength(), n = Math.ceil(L / step), P = [], Tn = [];
  for (let i = 0; i <= n; i++) { const u = i / n; P.push(cur.getPointAt(u)); Tn.push(cur.getTangentAt(u)); }
  // 비틀림 없는 틀 (세로 루프도 차가 레일 안쪽을 본다): 위 방향을 레일 따라 옮긴다. 닫힌 레일은 한 바퀴 돌고 어긋난 각을 고르게 나눈다
  let U = null; if (pt) { U = []; const q = new THREE.Quaternion(); let u = new THREE.Vector3(0, 1, 0).addScaledVector(Tn[0], -Tn[0].y).normalize(); U.push(u.clone());
    for (let i = 1; i <= n; i++) { q.setFromUnitVectors(Tn[i - 1], Tn[i]); u.applyQuaternion(q).addScaledVector(Tn[i], -u.dot(Tn[i])).normalize(); U.push(u.clone()); }
    if (closed) { const a = Math.atan2(new THREE.Vector3().crossVectors(U[n], U[0]).dot(Tn[0]), U[n].dot(U[0])); for (let i = 0; i <= n; i++) U[i].applyAxisAngle(Tn[i], a * i / n); } }
  return { cur, L, n, P, Tn, U, step: L / n };
}
export class Train extends Ride {
  // 표에서 s(m) 자리의 위치 · 방향 (앞 +z, 위 +y, 기울기 roll)
  frameAt(s, out) { const R = this.R, L = R.L; s = this.closed ? ((s % L) + L) % L : Math.max(0, Math.min(L - 0.01, s)); const f = s / R.step, i = Math.min(R.n - 1, Math.floor(f)), u = f - i; const p = V1.copy(R.P[i]).lerp(R.P[i + 1], u), t = V2.copy(R.Tn[i]).lerp(R.Tn[i + 1], u).normalize(), roll = this.roll ? this.roll[i] * (1 - u) + this.roll[i + 1] * u : 0;
    const up = R.U ? V3.copy(R.U[i]).lerp(R.U[i + 1], u).addScaledVector(t, -V3.dot(t)).normalize() : V3.set(0, 1, 0).addScaledVector(t, -t.y).normalize(), side = new THREE.Vector3().crossVectors(up, t).normalize(); up.applyAxisAngle(t, roll); side.applyAxisAngle(t, roll);
    M4.makeBasis(side, up.clone().crossVectors(t, side).normalize(), t); out.quaternion.setFromRotationMatrix(M4); out.position.copy(p); return out; }
}

// 롤러코스터 (호수 · 실내 루프) · 통나무 보트: 점 목록을 따라 레일(또는 물길). 발사(launch) 또는 끌어올림(lift) → 중력 · 마찰 → 브레이크 → 승강장
export class Coaster extends Train {
  constructor(park, opt) {
    super(park, { name: '롤러코스터', cycle: 64, closed: true, style: 'rail', vmax: 20, nCars: 2, rows: 2, carLen: 3.0, cols: { rail: '#1f9be0', spine: '#ffd23f', tie: '#2f5f8f', post: '#f0efe9', car: '#0f7cc8', trim: '#ffd23f', seat: '#0a4f86', roof: '#1f9be0' }, ...opt }); const st = park.stat, y0 = this.g0, C = this.cols;
    const pts = this.path.map(([x, z, y]) => new THREE.Vector3(x, y0 + y, z)); const R = this.R = railTable(pts, true, 0.5, true), n = R.n;
    // 속도 표 (발사 · 끌어올림 · 중력 · 마찰 · 브레이크) → 기울기 표 (곡률 × 속도²)
    const v = new Float32Array(n + 1), roll = this.roll = new Float32Array(n + 1), [a0, a1] = this.launch || this.lift, sB = this.brake * R.L; let cur = 0, E = 0;
    for (let i = 0; i <= n; i++) { const s = i * R.step, y = R.P[i].y - y0; if (s < a0) cur = s < a0 - 9 ? 4 : Math.max(1.2, 4 - (s - (a0 - 9)) * 0.9); else if (s < a1) { cur = this.launch ? Math.min(this.vmax, Math.sqrt(1.44 + 2 * 13 * (s - a0))) : 3.2; E = cur * cur / 2 + 9.8 * y; } else if (s >= sB) cur = Math.max(4, cur - 0.35 * R.step * cur / 4); else cur = Math.sqrt(Math.max((this.vmin || 3) ** 2, 2 * (E - 9.8 * y - (this.fric ?? 0.06) * (s - a1)))); v[i] = cur; }
    for (let i = 0; i <= n; i++) { const a = R.Tn[Math.max(0, i - 4)], b = R.Tn[Math.min(n, i + 4)], ds = R.step * (Math.min(n, i + 4) - Math.max(0, i - 4)), h = Math.hypot(a.x, a.z) * Math.hypot(b.x, b.z), cr = h > 0.25 ? (a.x * b.z - a.z * b.x) / ds : 0; roll[i] = this.style === 'flume' ? 0 : Math.max(-1.0, Math.min(1.0, Math.atan(v[i] * v[i] * cr / 9.8))) * (this.bank ?? 0.85); }
    for (let p = 0; p < 3; p++) for (let i = 1; i < n; i++) roll[i] = (roll[i - 1] + roll[i] * 2 + roll[i + 1]) / 4;
    this.v = v; const tt = new Float32Array(n + 1); for (let i = 1; i <= n; i++) tt[i] = tt[i - 1] + R.step / Math.max(0.5, (v[i] + v[i - 1]) / 2); this.tt = tt; this.runT = tt[n];
    // 레일: 두 줄 + 가운데 등뼈 + 침목 + 기둥 (바닥 · 물까지) / 물길: U자 홈 + 물
    const o = new THREE.Object3D(), Lr = [], Rr = [], Sp = [], prof = [[-1.15, 0.95], [-1.15, 0.0], [-0.85, -0.35], [0.85, -0.35], [1.15, 0.0], [1.15, 0.95]], TP = [], TW = [];
    for (let i = 0; i <= n; i += 2) { this.frameAt(i * R.step, o); const sd = V1.set(1, 0, 0).applyQuaternion(o.quaternion).clone(), up = V2.set(0, 1, 0).applyQuaternion(o.quaternion).clone(), p = o.position;
      if (this.style === 'flume') { for (const [a, b] of prof) TP.push(p.clone().addScaledVector(sd, a).addScaledVector(up, b - 0.4)); TW.push(p.clone().addScaledVector(sd, -0.85).addScaledVector(up, -0.5), p.clone().addScaledVector(sd, 0.85).addScaledVector(up, -0.5)); Sp.push(p.clone().addScaledVector(up, -0.8)); }
      else { Lr.push(p.clone().addScaledVector(sd, 0.55)); Rr.push(p.clone().addScaledVector(sd, -0.55)); Sp.push(p.clone().addScaledVector(up, -0.5)); if (i % 4 === 0) st.add(G.box(1.3, 0.12, 0.2), C.tie, 'metal', new THREE.Matrix4().compose(p.clone().addScaledVector(up, -0.2), o.quaternion, S1)); }
      if (i % 16 === 0) { const gy = park.ground(p.x, p.z); if (p.y - gy > 1.5 && up.y > 0.3) { rod(st, Sp[Sp.length - 1], new THREE.Vector3(p.x, gy, p.z), 0.3, C.post, 'metal', 8); st.add(G.cyl(0.6, 0.6, 0.4, 10), '#bdb5a6', 'std', T(p.x, gy, p.z)); } } }
    if (this.style === 'flume') { const np = prof.length, m = TP.length / np, P = [], I = []; for (const q of TP) P.push(q.x, q.y, q.z); for (let i = 0; i < m; i++) { const i2 = (i + 1) % m; for (let k = 0; k < np - 1; k++) { const a = i * np + k, b = i * np + k + 1, c = i2 * np + k, d = i2 * np + k + 1; I.push(a, b, c, b, d, c); } } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); st.add(g, C.rail, 'dbl');
      const W = [], WI = []; for (const q of TW) W.push(q.x, q.y, q.z); for (let i = 0; i < m; i++) { const i2 = (i + 1) % m; WI.push(i * 2, i2 * 2, i * 2 + 1, i * 2 + 1, i2 * 2, i2 * 2 + 1); } const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3)); wg.setIndex(WI); wg.computeVertexNormals(); const wm = new THREE.Mesh(wg, mats().water); wm.material.side = THREE.DoubleSide; wm.userData.noDrape = true; park.g.add(wm); tube(st, Sp, 0.22, C.spine, 'metal', 6, true); }
    else { tube(st, Lr, 0.09, C.rail, 'metal', 6, true); tube(st, Rr, 0.09, C.rail, 'metal', 6, true); tube(st, Sp, 0.28, C.spine, 'metal', 8, true); }
    // 승강장 (차양 지붕 · 바닥 · 기둥), 타는 자리는 승강장 옆
    { this.frameAt(a0 - 6, o); const p = o.position.clone(), fw = V1.set(0, 0, 1).applyQuaternion(o.quaternion), ry = Math.atan2(fw.x, fw.z), cs = Math.cos(ry), sn = Math.sin(ry), py = park.ground(p.x, p.z); st.add(G.box(5.5, 0.4, 16), '#f6efe2', 'std', T(p.x, p.y + 3.6, p.z, ry)); st.add(G.box(5.8, 0.3, 16.4), C.roof, 'std', T(p.x, p.y + 3.9, p.z, ry)); st.add(G.box(3.0, Math.max(0.3, p.y - py - 0.3), 16), '#d8cfbf', 'std', T(p.x + cs * 2.4, py, p.z - sn * 2.4, ry)); for (const f of [-7, 0, 7]) for (const sd2 of [-1, 1]) st.add(G.cyl(0.12, 0.12, p.y + 3.6 - py, 8), '#ffffff', 'metal', T(p.x + cs * sd2 * 2.6 + sn * f, py, p.z - sn * sd2 * 2.6 + cs * f)); for (let k = -7; k <= 7; k += 1.4) park.bulb(p.x + sn * k + cs * 2.9, p.y + 3.55, p.z + cs * k - sn * 2.9, '#fff1cf', 0.1); this.board ||= [p.x + cs * 3.6, p.z - sn * 3.6]; }
    // 차: 칸마다 rows 줄 × 2명
    this.cars = []; for (let c = 0; c < this.nCars; c++) { const g = new THREE.Group(); park.g.add(g); const k = new Kit(); this.carModel(k, c); k.build(g); const rs = this.rows; for (let r = 0; r < rs; r++) { const rz = (r - (rs - 1) / 2) * 1.1; for (const sx of [-0.34, 0.34]) this.seat(g, sx, this.style === 'flume' ? -0.1 : 0.55, rz); } this.cars.push(g); }
    this.my = this.rows * 2 - 1; this.fill = 0.75; this.cycle = Math.ceil(this.runT + 14);
  }
  carModel(k, c) { const C = this.cols, Lc = this.rows * 1.1 + 0.4; if (this.style === 'flume') { k.add(G.box(1.4, 0.55, Lc), '#8a5a34', 'std', T(0, -0.45, 0)); k.add(G.cyl(0.35, 0.35, Lc, 10), '#6b4426', 'std', T(-0.62, -0.15, -Lc / 2, 0, Math.PI / 2)); k.add(G.cyl(0.35, 0.35, Lc, 10), '#6b4426', 'std', T(0.62, -0.15, -Lc / 2, 0, Math.PI / 2)); k.add(G.ball(0.7, 8), '#8a5a34', 'std', T(0, -0.25, Lc / 2, 0, 0, 0, new THREE.Vector3(1, 0.6, 0.8))); return; }
    k.add(G.box(1.5, 0.7, Lc), C.car, 'std', T(0, 0.15, 0)); if (c === 0) k.add(G.ball(0.78, 10), C.car, 'std', T(0, 0.5, Lc / 2, 0, 0, 0, new THREE.Vector3(1, 0.55, 1))); k.add(G.box(1.56, 0.12, Lc + 0.1), C.trim, 'std', T(0, 0.82, 0)); for (let r = 0; r < this.rows; r++) k.add(G.box(1.3, 0.55, 0.12), C.seat, 'std', T(0, 0.7, (r - (this.rows - 1) / 2) * 1.1 - 0.4)); if (c === 0) { k.add(G.ball(0.05, 6), '#ffffff', 'glow', T(0.5, 0.6, Lc / 2 + 0.35)); k.add(G.ball(0.05, 6), '#ffffff', 'glow', T(-0.5, 0.6, Lc / 2 + 0.35)); } }
  // 0~12 승강장 (타기) → 표 시간대로 한 바퀴 → 승강장에서 멈춤
  pose(t) { const R = this.R, n = R.n, tt = this.tt, s0 = (this.launch || this.lift)[0] - 3, t0 = tt[Math.floor(s0 / R.step)];
    const sOf = (x) => { let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tt[m] < x) lo = m; else hi = m; } return lo * R.step + (x - tt[lo]) / Math.max(1e-3, tt[hi] - tt[lo]) * R.step; };
    let s = s0; if (t >= 12) { const tr = t - 12; if (tr >= this.runT) s = s0 + R.L; else { const x = t0 + tr; s = x <= tt[n] ? sOf(x) : R.L + sOf(x - tt[n]); } }
    this.s = s; this.cars.forEach((g, i) => this.frameAt(s - i * this.carLen, g)); this.speed = this.v[Math.floor((((s % R.L) + R.L) % R.L) / R.step)] || 0; }
}

// 모노레일: 어드벤처 벽을 나와 다리 옆 높은 선로로 섬을 한 바퀴 돌고 돌아간다 (OSM 선 그대로)
export class Monorail extends Train {
  constructor(park, opt) {
    super(park, { name: '모노레일', cycle: 120, closed: false, ...opt }); const st = park.stat, pts0 = this.line || pairs(MONO_OUT);
    // 높이: 땅 높이를 40m 폭으로 부드럽게 + 7m
    const hs = pts0.map(([x, z]) => park.ground(x, z)), sm = hs.map((_, i) => { let a = 0, n = 0; for (let j = Math.max(0, i - 4); j <= Math.min(hs.length - 1, i + 4); j++) { a += hs[j]; n++; } return a / n; });
    const R = this.R = railTable(pts0.map(([x, z], i) => new THREE.Vector3(x, Math.max(sm[i], hs[i]) + (this.hUp ?? 7.2), z)), false, 1); const o = new THREE.Object3D(), beam = [];
    for (let s = 0; s <= R.L; s += 1) { this.frameAt(s, o); beam.push(o.position.clone().setY(o.position.y - 0.7)); if (Math.round(s) % 18 === 9) { const gy = park.ground(o.position.x, o.position.z), p = o.position; st.add(G.cyl(0.55, 0.45, p.y - 1.4 - gy, 10), '#e4e0d8', 'std', T(p.x, gy, p.z)); st.add(G.box(2.2, 0.6, 1.2), '#e4e0d8', 'std', T(p.x, p.y - 1.9, p.z, Math.atan2(V1.set(0, 0, 1).applyQuaternion(o.quaternion).x, V1.z))); } }
    tube(st, beam, 0.45, '#ece8e0', 'std', 4); tube(st, beam.map((p) => p.clone().setY(p.y + 0.38)), 0.12, '#9aa3ad', 'metal', 4);
    // 4칸 열차: 둥근 머리 · 흰 몸 · 파란 창 띠 · 빨간 줄
    // 4칸 열차: 흰 몸 · 빨간 줄 · 둘레 유리창 (안에 앉으면 창밖이 보인다) · 둥근 머리 · 지붕 불빛
    this.cars = []; for (let c = 0; c < 4; c++) { const g = new THREE.Group(); park.g.add(g); const k = new Kit(), Wd = 2.1, Ln = 4.6;
      for (const s2 of [-1, 1]) { k.add(G.box(0.08, 0.9, Ln), '#f7f5f0', 'dbl', T(s2 * Wd / 2, -0.1, 0)); k.add(G.box(0.1, 0.16, Ln + 0.02), '#e8202f', 'std', T(s2 * (Wd / 2 + 0.02), 0.55, 0)); k.add(G.box(Wd, 0.9, 0.08), '#f7f5f0', 'dbl', T(0, -0.1, s2 * Ln / 2)); for (const f of [-1, 0, 1]) k.add(G.box(0.1, 0.8, 0.12), '#d8d4cc', 'std', T(s2 * Wd / 2, 0.8, f * Ln / 2)); }
      k.add(G.box(Wd, 0.3, Ln), '#f7f5f0', 'dbl', T(0, 1.6, 0)); k.add(G.box(Wd - 0.1, 0.06, Ln - 0.1), '#4a4f57', 'std', T(0, -0.08, 0)); k.add(G.box(1.6, 0.5, 4.2), '#6b737c', 'std', T(0, -0.6, 0)); k.add(G.box(1.2, 0.04, 3.6), '#fff1c8', 'glow', T(0, 1.58, 0));
      for (const r of [-1.2, 0, 1.2]) k.add(G.box(1.6, 0.35, 0.6), '#c23b5a', 'std', T(0, -0.05, r - 0.05));
      const gl = new THREE.BoxGeometry(Wd, 0.8, Ln); gl.translate(0, 1.2, 0); k.add(gl, '#bfe2f0', 'glass');
      if (c === 0 || c === 3) k.add(G.ball(1.0, 12), '#f7f5f0', 'std', T(0, 0.3, c === 0 ? 2.35 : -2.35, 0, 0, 0, new THREE.Vector3(1, 0.5, 0.6)));
      k.build(g); for (const r of [-1.2, 0, 1.2]) for (const s2 of [-0.45, 0.45]) this.seat(g, s2, 0.3, r); this.cars.push(g); }
    this.my = 4; this.spec ||= [10600, 30, 2290]; this.fill = 0.55; this.v0 = 6.5; this.cycle = Math.ceil(R.L / this.v0 + 30);
    if (!this.board) { const b = pts0[2]; this.board = [b[0] - 9, b[1] - 18]; }
  }
  // 0~12 벽 안 승강장(안 보인다) → 6.5m/s 로 밖을 한 바퀴 → 다시 벽 안
  pose(t) { const L = this.R.L, run = L / this.v0; let s = t < 12 ? -20 : (t - 12) * this.v0; const vis = s > -1 && s < L + 4 * 4.8 + 1; this.cars.forEach((g, i) => { const si = s - i * 4.8; g.visible = vis && si > -1 && si < L + 1; this.frameAt(Math.max(0, Math.min(L, si)), g); }); this.done = t > 12 + run + 4; this.speed = this.v0; }
}

// ---------- 성 · 섬 · 다리 · 어드벤처 겉모습 ----------
function buildCastle(park) {
  // 매직아일랜드 성: 상아빛 벽 · 코발트 파랑 뾰족 지붕 · 금빛 꼭대기 장식, 가운데 높은 탑(꼭대기 42m) 둘레로 크고 작은 둥근 탑. 정문은 다리 쪽
  const k = park.castleKit, cx = 10593, cz = 2336, y0 = park.ground(cx, cz) + 0.3, f = Math.atan2(cx - 10575, cz - 2312);
  const IV = '#fbf2ec', IV2 = '#f0dfd8', BL = '#2f5fb8', BL2 = '#3a72cc', GD = '#e6b84a', WN = '#3b4f78';
  const at = (lx, lz) => [cx + Math.cos(f) * lx + Math.sin(f) * lz, cz - Math.sin(f) * lx + Math.cos(f) * lz];
  const tower = (lx, lz, r, h, roofH, col = IV, roof = BL, win = true) => { const [x, z] = at(lx, lz); k.add(G.cyl(r * 1.04, r, h, 16), col, 'castle', T(x, y0, z)); k.add(G.cyl(r * 1.18, r * 1.18, 0.6, 16), IV2, 'castle', T(x, y0 + h - 0.6, z)); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; k.add(G.box(r * 0.4, 0.7, r * 0.3), IV2, 'castle', T(x + Math.cos(a) * r * 1.1, y0 + h, z + Math.sin(a) * r * 1.1, -a)); }
    k.add(G.cone(r * 1.22, roofH, 16), roof, 'castle', T(x, y0 + h + 0.2, z)); k.add(G.cyl(0.07, 0.07, 2.2, 5), GD, 'metal', T(x, y0 + h + roofH, z)); k.add(G.ball(0.3, 8), GD, 'metal', T(x, y0 + h + roofH + 0.4, z));
    if (win) for (let y = 5; y < h - 3; y += 6) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + f + y * 0.4, wx = x + Math.sin(a) * (r + 0.02), wz = z + Math.cos(a) * (r + 0.02); arch(wx, y0 + y, wz, a, 0.6, 1.3); }
    k.add(G.cyl(r * 1.06, r * 1.06, 0.25, 16), GD, 'metal', T(x, y0 + h * 0.55, z));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; park.bulb(x + Math.cos(a) * r * 1.2, y0 + h + 0.25, z + Math.sin(a) * r * 1.2, '#fff0c0', 0.16); } };
  const block = (lx, lz, w, d, h, roofH) => { const [x, z] = at(lx, lz); k.add(G.box(w, h, d), IV, 'castle', T(x, y0, z, f)); k.add(G.box(w + 0.6, 0.5, d + 0.6), IV2, 'castle', T(x, y0 + h - 0.5, z, f)); if (roofH) { const g = new THREE.CylinderGeometry(0, Math.SQRT1_2 * 1, roofH, 4, 1); g.rotateY(Math.PI / 4); g.scale(w + 0.4, 1, d + 0.4); g.translate(0, roofH / 2, 0); k.add(g, BL2, 'castle', T(x, y0 + h, z, f)); }
    for (let y = 4; y < h - 2; y += 5) for (const i of w > 10 ? [-1, 0, 1] : [-1, 1]) for (const s of [-1, 1]) { const [wx, wz] = at(lx + i * w * 0.3, lz + s * (d / 2 + 0.03)); arch(wx, y0 + y, wz, f + (s > 0 ? 0 : Math.PI), 0.9, 2.0); }
    for (const s of [-1, 1]) { const [bx, bz] = at(lx, lz + s * (d / 2 + 0.05)); k.add(G.box(w, 0.25, 0.12), GD, 'metal', T(bx, y0 + 8.2, bz, f)); } };
  // 아치 창: 짙은 유리 + 둥근 머리 + 밤에 따뜻한 불빛
  function arch(x, y, z, a, w, h) { k.add(G.box(w, h, 0.08), WN, 'std', T(x, y, z, a)); const c = new THREE.CircleGeometry(w / 2, 10, 0, Math.PI); k.add(c, WN, 'std', T(x + Math.sin(a) * 0.045, y + h, z + Math.cos(a) * 0.045, a)); k.add(G.box(w + 0.24, 0.12, 0.2), IV2, 'castle', T(x, y - 0.1, z, a)); park.win.push([x + Math.sin(a) * 0.06, y + h * 0.55, z + Math.cos(a) * 0.06, a, w * 1.2]); }
  // 바닥 단 (회색 돌) · 몸채 · 날개 · 정문 · 탑들 (실제 바닥 26 × 28m 십자 모양)
  { const [x, z] = at(0, 0); k.add(G.box(24, 1.2, 26), '#b9b1a3', 'castle', T(x, y0 - 0.9, z, f)); }
  block(0, 0, 14, 12, 15, 6); block(0, -9, 9, 6, 11, 4); block(-9.5, 1, 6, 9, 12, 4.5); block(9.5, 1, 6, 9, 12, 4.5); block(0, 9, 10, 6, 13, 4);
  tower(0, 0, 3.4, 27, 13, IV, BL); for (const [lx, lz, hh] of [[0, 0, 41.5], [-6.8, 7, 31.2], [6.8, 7, 31.2], [2.6, 4.4, 32.2]]) { const [x, z] = at(lx, lz); const fl = new THREE.BufferGeometry(); fl.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.9, 0, 1.8, -0.45, 0], 3)); fl.computeVertexNormals(); k.add(fl, '#e8202f', 'std', T(x, y0 + hh + 1.4, z, f + 1.2)); k.add(fl.clone(), '#e8202f', 'std', T(x, y0 + hh + 1.4, z, f + 1.2 + Math.PI)); }
  // 정면 둥근 장미창
  { const [x, z] = at(0, -6.03); k.add(new THREE.CircleGeometry(2.0, 24), '#3b4f78', 'std', T(x, y0 + 10.5, z, f + Math.PI)); k.add(G.torus(2.05, 0.18, 32), GD, 'metal', T(x, y0 + 10.5, z, f + Math.PI)); park.win.push([x - Math.sin(f) * 0.05, y0 + 10.5, z - Math.cos(f) * 0.05, f + Math.PI, 2.6]); } tower(-6.2, -5.8, 2.2, 18, 8); tower(6.2, -5.8, 2.2, 18, 8); tower(-6.8, 7, 2.4, 21, 9); tower(6.8, 7, 2.4, 21, 9); tower(-12.5, -2.5, 1.6, 15, 6.5); tower(12.5, -2.5, 1.6, 15, 6.5); tower(-3.2, -12.2, 1.5, 13, 6); tower(3.2, -12.2, 1.5, 13, 6); tower(2.6, 4.4, 1.6, 23, 8, IV, BL2); tower(-11, 7.5, 1.3, 16, 6, IV, BL2); tower(11, 7.5, 1.3, 16, 6, IV, BL2);
  // 정문 아치 (다리 쪽): 금 테두리 · 문 안 따뜻한 불빛
  { const [x, z] = at(0, -12.3); k.add(G.box(5.4, 7, 1.4), IV2, 'castle', T(x, y0, z, f)); const ar = new THREE.CylinderGeometry(1.6, 1.6, 1.5, 16, 1, false, 0, Math.PI); ar.rotateZ(Math.PI / 2); ar.rotateY(Math.PI / 2); k.add(ar, '#2a2018', 'std', T(x, y0 + 3.6, z, f)); k.add(G.box(3.2, 3.6, 1.5), '#2a2018', 'std', T(x, y0, z, f)); k.add(G.torus(1.7, 0.12, 20), GD, 'metal', T(x - Math.sin(f) * 0.75, y0 + 3.6, z - Math.cos(f) * 0.75, f)); park.win.push([x - Math.sin(f) * 0.8, y0 + 2.2, z - Math.cos(f) * 0.8, f + Math.PI, 2.4]); }
  park.addFoot([at(-8, -13), at(8, -13), at(13, -3), at(13, 10), at(-13, 10), at(-13, -3)], 15, y0);
  park.castle = { x: cx, z: cz, y0, f };
}
// 섬 바닥: 4m 격자를 땅 높이에 얹고, 외곽선 안만 (따뜻한 벽돌 길 + 군데군데 잔디)
function groundMesh(park, ring, kit, colF, lift = 0.1) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const S = 3, P = [], C = [], c = new THREE.Color();
  const vtx = (x, z) => { P.push(x, park.ground(x, z) + lift, z); colF(x, z, c); C.push(c.r, c.g, c.b); };
  for (let x = x0; x < x1; x += S) for (let z = z0; z < z1; z += S) { const q = [[x, z], [x + S, z], [x + S, z + S], [x, z + S]]; if (!q.some(([a, b]) => inRing(a, b, ring)) && !inRing(x + S / 2, z + S / 2, ring)) continue; const qq = q.map(([a, b]) => inRing(a, b, ring) ? [a, b] : clampIn(a, b, ring)); for (const [a, b] of [qq[0], qq[3], qq[1], qq[1], qq[3], qq[2]]) vtx(a, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); kit.addRaw(g, 'std');
}
function clampIn(x, z, ring) { let best = Infinity, bx = x, bz = z; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [ax, az] = ring[j], [cx, cz] = ring[i], dx = cx - ax, dz = cz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = (px - x) ** 2 + (pz - z) ** 2; if (d < best) { best = d; bx = px; bz = pz; } } return [bx, bz]; }
const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };

function buildIsland(park) {
  const st = park.stat;
  // 바닥: 길은 연분홍 · 살구 벽돌, 기구 둘레 · 가장자리는 잔디 (잡음으로 자연스럽게), 연못은 물
  const path = new THREE.Color('#e8cdb6'), path2 = new THREE.Color('#dcb89c'), grass = new THREE.Color('#79ad5c'), grass2 = new THREE.Color('#5f9a4c');
  const colF = (x, z, c) => { const n = vnoise(x * 0.06, z * 0.06), edge = Math.min(...[R_ISLE].map((r) => distRing(x, z, r))); if (n > 0.52 || edge < 4) c.copy(grass).lerp(grass2, vnoise(x * 0.3, z * 0.3)); else c.copy(path).lerp(path2, hash2(Math.floor(x / 1.2), Math.floor(z / 1.2)) * 0.6); };
  groundMesh(park, R_ISLE, st, colF); groundMesh(park, R_ISLET, st, (x, z, c) => c.copy(path).lerp(path2, hash2(Math.floor(x / 1.5), Math.floor(z / 1.5)) * 0.5), 0.14);
  // 연못 (롤러코스터 가운데)
  { const sh = new THREE.Shape(R_POND.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); const y = park.ground(10554, 2367) + 0.05; g.translate(0, y, 0); const me = new THREE.Mesh(g, mats().water); me.userData.noDrape = true; park.g.add(me); park.addFoot(R_POND, -0.1, y, true); }
  // 물가 난간: 흰 기둥 + 위 난간 + 밤에 작은 전구 줄
  const rail = (ring) => { const top = []; for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.4)); for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * (k / n), z = az + (bz - az) * (k / n), y = park.ground(x, z) + 0.1; park.post.push([x, y, z]); top.push(new THREE.Vector3(x, y + 1.0, z)); if ((top.length % 2) === 0) park.bulb(x, y + 1.12, z, (top.length % 6) ? '#fff2c4' : '#ffb7e0', 0.11); } } top.push(top[0].clone()); tube(st, top, 0.05, '#f7f3ea', 'metal', 4); };
  rail(R_ISLE); rail(R_ISLET);
  // 가로등: 길을 따라 (검은 주철 기둥 · 둥근 우윳빛 등 두 개)
  for (let i = 0; i < 70; i++) { const x = 10500 + hash2(i, 3) * 190, z = 2250 + hash2(i, 7) * 170; if (!inRing(x, z, R_ISLE) || distRing(x, z, R_ISLE) < 3 || park.busy(x, z, 4)) continue; park.lamp(x, park.ground(x, z), z); }
  // 꽃밭 · 둥근 나무
  for (let i = 0; i < 900; i++) { const x = 10495 + hash2(i, 11) * 200, z = 2245 + hash2(i, 13) * 176; if (!inRing(x, z, R_ISLE) && !inRing(x, z, R_ISLET)) continue; if (park.busy(x, z, 2) || vnoise(x * 0.06, z * 0.06) < 0.55 && distRing(x, z, R_ISLE) > 5 && !inRing(x, z, R_ISLET)) continue; park.flower.push([x, park.ground(x, z) + 0.12, z, i]); }
  for (let i = 0; i < 60; i++) { const x = 10495 + hash2(i, 21) * 200, z = 2245 + hash2(i, 23) * 176; if (!inRing(x, z, R_ISLE) || park.busy(x, z, 5) || distRing(x, z, R_ISLE) < 2) continue; park.tree.push([x, park.ground(x, z), z, 0.8 + hash2(i, 5) * 0.6]); park.addCircle(x, z, 0.3, 4); }
}
const HOUSES = [[10599,2383.5,10604.5,2393,10606.5,2392,10609,2397,10619,2391.5,10622,2397,10636,2389,10635,2387,10639,2385,10634.5,2377.5,10645,2371.5,10639.5,2362,10633,2366,10629.5,2359.5,10601.5,2375,10604.5,2380],[10583.5,2381,10587.5,2379,10584.5,2373,10589,2371,10594.5,2381.5,10591,2383,10592,2385,10587,2387.5],[10579.5,2401,10587.5,2397,10590,2402,10582,2406.5],[10570,2388.5,10579,2391.5,10581,2386.5,10572,2383.5],[10602,2278,10606.5,2287,10611.5,2285,10606.5,2275.5],[10677.5,2309,10661.5,2318,10656,2340,10665,2354.5,10674.5,2349,10667,2337,10671,2323.5,10682.5,2317],[10646,2304,10661.5,2307.5,10659.5,2316.5,10644,2313],[10538,2324.5,10540,2328.5,10542,2327.5,10545.5,2334,10557,2328,10546.5,2308,10536.5,2313.5,10541,2323],[10578.5,2365,10584.5,2367,10586,2362,10580,2360],[10644,2333,10643,2336.5,10652.5,2351,10657.5,2351.5,10660.5,2350,10657.5,2344,10654.5,2345.5,10651,2338.5,10652,2335],[10625.5,2325.5,10625,2331,10620,2338.5,10628,2343.5,10633.5,2340.5,10632,2333,10629,2332,10629.5,2325.5],[10616,2305,10620,2311.5,10629,2306.5,10627.5,2303.5,10624.5,2305,10623.5,2303.5,10621.5,2304.5,10620.5,2302.5],[10625.5,2270,10628,2270,10630.5,2267.5,10630.5,2266,10628.5,2263,10626,2263,10624,2264,10623.5,2265,10623,2266.5,10624.5,2269.5],[10637,2253,10639,2257,10645.5,2254,10654,2271,10645.5,2275,10643,2270.5,10637.5,2273.5,10634,2266.5,10635,2266,10634,2264,10632,2264.5,10629.5,2263,10628.5,2260.5,10628.5,2258.5,10630.5,2256.5],[10640,2278,10638,2280.5,10643.5,2284,10648.5,2289,10647,2291,10647,2294,10646,2295,10648.5,2298,10649.5,2297,10653,2297,10655.5,2304.5,10658.5,2303,10655,2296,10656,2294.5,10656.5,2290.5,10654.5,2288,10651.5,2287.5,10646,2282],[10634,2299,10637,2305,10642,2302.5,10642.5,2303.5,10648.5,2300.5,10645,2293.5]];
// 섬 위 작은 건물들 (OSM 외곽선 그대로): 동화 마을 가게 · 매점 — 파스텔 벽 · 나무 기둥 무늬 · 뾰족 지붕 · 창 불빛. 가장 큰 건물은 유령의 집 (짙은 벽 · 보라 지붕 · 초록 창)
function buildHouses(park) {
  const st = park.stat, WALL = ['#f6e3c8', '#f3d0d8', '#d9ead3', '#fff1c4', '#dfe3f3', '#f7d9b8'], ROOF = ['#c2453a', '#2f7a8a', '#3a5fb0', '#8a4a9a', '#d0703a'];
  const out = (ring, ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (inRing((ax + bx) / 2 + nx * 0.5, (az + bz) / 2 + nz * 0.5, ring)) { nx = -nx; nz = -nz; } return [nx, nz]; };
  HOUSES.forEach((flat, hi) => { const ring = pairs(flat); let A = 0, cx = 0, cz = 0; for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length]; A += ax * bz - bx * az; cx += ax; cz += az; } A = Math.abs(A / 2); cx /= ring.length; cz /= ring.length;
    const ghost = A > 900, h = ghost ? 11 : A > 400 ? 8.5 : A > 120 ? 6.5 : 4.6, y0 = Math.min(...ring.map(([x, z]) => park.ground(x, z))) + 0.05, wall = ghost ? '#5a5466' : WALL[hi % WALL.length], roof = ghost ? '#4a2f6a' : ROOF[hi % ROOF.length];
    const sh = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))), eg = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }); eg.rotateX(-Math.PI / 2); eg.translate(0, y0, 0); st.add(eg, wall, 'std');
    // 지붕: 처마를 조금 내밀고 가운데로 모이는 뾰족 지붕
    const rh = Math.min(ghost ? 9 : 6, Math.sqrt(A) * 0.42), P = []; for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], ex = (q) => [cx + (q[0] - cx) * 1.08, cz + (q[1] - cz) * 1.08], [a2x, a2z] = ex([ax, az]), [b2x, b2z] = ex([bx, bz]); P.push(a2x, y0 + h, a2z, cx, y0 + h + rh, cz, b2x, y0 + h, b2z); }
    let rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.computeVertexNormals(); { const nn = rg.attributes.normal; let up = 0; for (let i = 0; i < nn.count; i++) up += nn.getY(i); if (up < 0) { const p2 = []; for (let i = 0; i < P.length; i += 9) p2.push(P[i + 6], P[i + 7], P[i + 8], P[i + 3], P[i + 4], P[i + 5], P[i], P[i + 1], P[i + 2]); rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); rg.computeVertexNormals(); } } st.add(rg, roof, 'std');
    st.add(G.cyl(0.05, 0.05, 1.6, 5), '#e6b84a', 'metal', T(cx, y0 + h + rh - 0.1, cz)); st.add(G.ball(0.22, 6), '#e6b84a', 'metal', T(cx, y0 + h + rh + 1.5, cz));
    // 벽: 나무 기둥 무늬 · 창 (밤 불빛) · 가장 긴 벽에 문 · 차양 · 전구
    let li = 0, lL = 0; for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L > lL) { lL = L; li = i; } if (L < 2.5) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, [nx, nz] = out(ring, ax, az, bx, bz), ry = Math.atan2(nx, nz);
      const n = Math.max(1, Math.floor(L / 2.6)); if (!ghost && hi % 2 === 0) for (let k = 0; k <= n; k++) st.add(G.box(0.18, h, 0.06), '#7a5236', 'std', T(ax + ux * L * (k / n) + nx * 0.03, y0, az + uz * L * (k / n) + nz * 0.03, ry));
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, wx = ax + ux * L * t + nx * 0.05, wz = az + uz * L * t + nz * 0.05; for (const wy of h > 6 ? [2.2, h - 2.4] : [2.0]) park.win.push([wx, y0 + wy, wz, ry, ghost ? 0.9 : 1.0, ghost ? '#8dff9a' : null]); } }
    { const [ax, az] = ring[li], [bx, bz] = ring[(li + 1) % ring.length], L = lL, ux = (bx - ax) / L, uz = (bz - az) / L, [nx, nz] = out(ring, ax, az, bx, bz), mx = (ax + bx) / 2 + nx * 0.06, mz = (az + bz) / 2 + nz * 0.06, ry = Math.atan2(nx, nz); st.add(G.box(1.6, 2.4, 0.1), '#5a3a22', 'std', T(mx, y0, mz, ry)); const aw = new THREE.BoxGeometry(Math.min(L * 0.8, 6), 0.1, 1.3); aw.rotateX(0.3); st.add(aw, ROOF[(hi + 2) % ROOF.length], 'std', T(mx + nx * 0.6, y0 + 2.9, mz + nz * 0.6, ry)); for (let b = -2; b <= 2; b++) park.bulb(mx + nx * 1.2 + ux * b * Math.min(L * 0.18, 1.2), y0 + 2.75, mz + nz * 1.2 + uz * b * Math.min(L * 0.18, 1.2), '#fff1cf', 0.07); }
    park.addFoot(ring, h, y0); park.spots.push([cx, cz, Math.sqrt(A) * 0.6]);
  });
}
function distRing(x, z, r) { const [a, b] = clampIn(x, z, r); return Math.hypot(a - x, b - z); }

// 어드벤처 → 섬 다리: 돌 바닥 · 흰 난간 · 등불, 걸을 수 있다 (높이는 어드벤처 쪽 땅 → 성 섬 쪽 땅)
function buildBridge(park) {
  const st = park.stat, A = [10513, 2171], B = [10581, 2316], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, yA = park.ground(A[0], A[1]) + 0.1, yB = park.ground(B[0], B[1]) + 0.3;
  const yAt = (x, z) => { const t = Math.max(0, Math.min(1, ((x - A[0]) * ux + (z - A[1]) * uz) / L)); return yA + (yB - yA) * t + Math.sin(t * Math.PI) * 0.8; };
  park.bridgeY = yAt;
  const sh = new THREE.Shape(R_BRIDGE.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, yAt(p.getX(i), p.getZ(i))); g.computeVertexNormals(); st.add(g, '#d9cbb6', 'std');
  const side = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }); side.rotateX(-Math.PI / 2); const q = side.attributes.position; for (let i = 0; i < q.count; i++) q.setY(i, yAt(q.getX(i), q.getZ(i)) - (q.getY(i) > 0.6 ? 0.02 : 1.2)); side.computeVertexNormals(); st.add(side, '#c9b9a2', 'std');
  // 난간 · 등불 (긴 두 변)
  for (const s of [-1, 1]) { const top = []; for (let t = 0; t <= L; t += 2.5) { let x = A[0] + ux * t - uz * s * 4.6, z = A[1] + uz * t + ux * s * 4.6; [x, z] = clampIn(x, z, R_BRIDGE); const y = yAt(x, z); park.post.push([x, y, z]); top.push(new THREE.Vector3(x, y + 1.0, z)); if (Math.round(t / 2.5) % 8 === 4) park.lamp(x, y, z); } tube(st, top, 0.06, '#f7f3ea', 'metal', 4); }
  // 걷는 바닥 (10m 마다 비탈 조각): 땅 높이와의 차이
  for (let t = 0; t < L; t += 8) { const t2 = Math.min(L, t + 8), ax = A[0] + ux * t, az = A[1] + uz * t, cx = A[0] + ux * t2, cz = A[1] + uz * t2; park.addDeck(ax, az, cx, cz, 4.4, yAt(ax, az) - park.ground(ax, az), yAt(cx, cz) - park.ground(cx, cz)); }
}

function buildAdventureOutside(park) {
  // 실내 어드벤처 건물: 연한 살구빛 벽(아래 짙은 띠 · 위 처마) + 평평한 지붕 + 한가운데 커다란 유리 돔 (흰 갈비뼈, 밤에는 안의 불빛이 비친다)
  const st = park.stat, y0 = Math.min(...R_ADV.map(([x, z]) => park.ground(x, z))) - 0.3, H = 27; park.advY = y0;
  const sh = new THREE.Shape(R_ADV.map(([x, z]) => new THREE.Vector2(x, -z)));
  const wall = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false }); wall.rotateX(-Math.PI / 2); wall.translate(0, y0, 0);
  // 벽 색: 높이에 따라 (아래 붉은 화강석 · 몸 살구 · 줄눈 띠 · 위 흰 처마)
  { const p = wall.attributes.position, n = p.count, C = new Float32Array(n * 3), c = new THREE.Color(); for (let i = 0; i < n; i++) { const h = p.getY(i) - y0; c.set(h < 4 ? '#b98a74' : h > H - 1.5 ? '#f3ede2' : '#e9cdb4'); C.set([c.r, c.g, c.b], i * 3); } wall.setAttribute('color', new THREE.BufferAttribute(C, 3)); wall.computeVertexNormals(); wall.deleteAttribute('uv'); st.addRaw(wall, 'std'); }
  // 벽 장식: 둘레 띠 · 세로 기둥 · 아치 창 (밤에 따뜻)
  for (let i = 0; i < R_ADV.length - 1; i++) { const [ax, az] = R_ADV[i], [bx, bz] = R_ADV[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux, ry = Math.atan2(nx, nz);
    for (const [hy, hh, col] of [[9, 0.6, '#f3ede2'], [18, 0.6, '#f3ede2'], [H - 2.2, 1.2, '#d9b496']]) st.add(G.box(L, hh, 0.5), col, 'std', T((ax + bx) / 2 + nx * 0.2, y0 + hy, (az + bz) / 2 + nz * 0.2, ry));
    const n = Math.floor(L / 9); for (let k = 1; k < n; k++) { const x = ax + ux * (k * L / n), z = az + uz * (k * L / n); st.add(G.box(1.2, H - 4, 0.6), '#f0e2d0', 'std', T(x + nx * 0.25, y0 + 4, z + nz * 0.25, ry)); if (k < n) { const mx = x - ux * (L / n / 2), mz = z - uz * (L / n / 2); for (const wy of [11, 20]) { st.add(G.box(3.2, 4.5, 0.2), '#5b6f86', 'metal', T(mx + nx * 0.28, y0 + wy - 0.5, mz + nz * 0.28, ry)); park.win.push([mx + nx * 0.4, y0 + wy + 1.5, mz + nz * 0.4, ry, 2.2]); } } } }
  // 지붕 + 돔 (어드벤처 한가운데, 지하 아이스링크 위)
  const roof = new THREE.ShapeGeometry(sh); roof.rotateX(-Math.PI / 2); roof.translate(0, y0 + H + 0.02, 0); st.add(roof, '#b7b2aa', 'std');
  const dc = [10438, 2095], rx = 95, rz = 60, rot = 0.29, DH = 22; park.dome = { c: dc, rx, rz, rot, y: y0 + H, H: DH };
  const dg = new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2); dg.scale(rx, DH, rz); dg.rotateY(rot); dg.translate(dc[0], y0 + H, dc[1]); const dome = new THREE.Mesh(dg, mats().glass); dome.renderOrder = 2; dome.userData.noDrape = true; park.g.add(dome);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, pts = []; for (let k = 0; k <= 16; k++) { const b = (k / 16) * Math.PI / 2, lx = Math.cos(a) * Math.cos(b) * rx, lz = Math.sin(a) * Math.cos(b) * rz; pts.push(new THREE.Vector3(dc[0] + lx * Math.cos(rot) + lz * Math.sin(rot), y0 + H + Math.sin(b) * DH, dc[1] - lx * Math.sin(rot) + lz * Math.cos(rot))); } tube(st, pts, 0.35, '#f4f4f0', 'metal', 5); }
  for (const b of [0.18, 0.4, 0.62, 0.84, 1.1, 1.34]) { const pts = []; for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2, lx = Math.cos(a) * Math.cos(b) * rx, lz = Math.sin(a) * Math.cos(b) * rz; pts.push(new THREE.Vector3(dc[0] + lx * Math.cos(rot) + lz * Math.sin(rot), y0 + H + Math.sin(b) * DH, dc[1] - lx * Math.sin(rot) + lz * Math.cos(rot))); } tube(st, pts, 0.28, '#f4f4f0', 'metal', 5); }
  st.add(G.cyl(rx * 1.02, rx * 1.02, 1.4, 64), '#e8e2d6', 'std', new THREE.Matrix4().compose(new THREE.Vector3(dc[0], y0 + H - 0.2, dc[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, rz / rx)));
  // 이름 판 (남쪽 · 북쪽 벽 위): 실제 건물 이름
  park.signs.push({ text: 'LOTTE WORLD', x: 10443.2, z: 2179.5, y: y0 + 21, ry: Math.atan2(0.3, 0.95), w: 30 }, { text: 'LOTTE WORLD', x: 10410.8, z: 2015.5, y: y0 + 21, ry: Math.atan2(-0.296, -0.955), w: 30 });
  // 부딪힘: 외곽선 (지붕 위로 올라설 수 있다)
  park.addFoot(R_ADV, H, y0);
}

// ---------- 공원 ----------
export function buildPark(hg, makeBear, buildAdventure) {
  mats(); const g = new THREE.Group(); g.userData.noDrape = true; g.name = 'park'; hg.scene.add(g);
  const H = hg.host || hg;
  const park = {
    hg, g, stat: new Kit(), castleKit: new Kit(), rides: [], win: [], post: [], flower: [], tree: [], lampL: [], bulbs: [], signs: [], spots: [],
    ground: (x, z) => H.terrAt(x, z, true),
    addCircle: (x, z, r, h) => { H.addCircle(x, z, r, h); const L = H.circGrid.get(`${Math.floor(x / 20)},${Math.floor(z / 20)}`); L[L.length - 1].key = 'park'; },
    // 외곽선 부딪힘 · 바닥 (base = 그 자리의 절대 높이, h = base 위 높이)
    addFoot: (ring, h, base, deck = false) => { const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]); H.addFoot({ ring, h, base, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name: '', type: 'stone', key: 'park', noClimb: false, deck }); },
    addDeck: (ax, az, cx, cz, hw, ya, yc) => { const d = { ax, az, cx, cz, hw, ya, yc, key: 'park' }, si = H.decks.push(d) - 1; for (let gx = Math.floor((Math.min(ax, cx) - hw) / 40); gx <= Math.floor((Math.max(ax, cx) + hw) / 40); gx++) for (let gz = Math.floor((Math.min(az, cz) - hw) / 40); gz <= Math.floor((Math.max(az, cz) + hw) / 40); gz++) { const k = `${gx},${gz}`; if (!H.deckGrid.has(k)) H.deckGrid.set(k, []); H.deckGrid.get(k).push(si); } },
    busy: (x, z, r) => park.spots.some(([a, b, rr]) => Math.hypot(a - x, b - z) < rr + r) || inRing(x, z, R_POND),
    lamp: (x, y, z) => { park.lampL.push([x, y, z]); park.addCircle(x, z, 0.15, 4); },
    bulb: (x, y, z, col, r = 0.09) => park.bulbs.push([x, y, z, col, r]),
  };
  H.decks ||= []; H.deckGrid ||= new Map();
  // 기구 자리는 비워 둔다 (꽃 · 나무 · 가로등이 들어가지 않게)
  park.spots.push([10641, 2353, 14], [10570, 2402, 16], [10627, 2288, 12], [10606, 2284, 7], [10593, 2336, 20], [10526, 2350, 18], [10545, 2392, 10], [10520, 2330, 12]);
  buildAdventureOutside(park); buildBridge(park); buildCastle(park); buildHouses(park); buildIsland(park);
  const gy = (x, z) => park.ground(x, z) + 0.12;
  const C1 = { tower: '#f4f4f2', band: '#2e6fd0', crown: '#ffffff', ring: '#e8202f', seat: ['#ffd23f', '#ff6a3d', '#2ec4b6', '#7c5cff'] };
  park.rides.push(new DropTower(park, { cx: 10641, cz: 2353, g0: gy(10641, 2353), H: 70, R: 2.4, N: 40, cols: C1, board: [10632, 2363] }));
  park.rides.push(new DropTower(park, { name: '꼬마 낙하 탑', cx: 10606, cz: 2290, g0: gy(10606, 2290), H: 17, R: 1.0, N: 12, cycle: 40, cols: { tower: '#fff6e8', band: '#ff7aa8', crown: '#ffe38a', ring: '#28b5e6', seat: ['#ffd23f', '#ff8fb8'] }, board: [10600, 2296], pose(t) { const top = 14; let y = 0; if (t < 6) y = 0; else if (t < 20) y = top * ((t - 6) / 14); else if (t < 22) y = top; else if (t < 30) { const u = (t - 22) / 8; y = top * (1 - u) + Math.sin(u * 18) * (1 - u) * 1.2; } this.ring.position.y = this.g0 + Math.max(0, y); this.ring.rotation.y = 0; } }));
  park.rides.push(new Pendulum(park, { cx: 10570, cz: 2402, g0: gy(10570, 2402), ax: 0.42, board: [10585, 2396] }));
  park.rides.push(new Swinger(park, { cx: 10627, cz: 2288, g0: gy(10627, 2288), board: [10636, 2297] }));
  park.rides.push(new Coaster(park, { name: '호수 롤러코스터', g0: gy(10526, 2347), path: [[10503, 2322, 2], [10511, 2334, 2], [10519, 2346, 2], [10528, 2360, 2.5], [10533, 2376, 6], [10527, 2394, 15], [10522, 2409, 21], [10533, 2424, 15], [10552, 2433, 6], [10575, 2433, 5], [10593, 2422, 10], [10598, 2404, 13.5], [10588, 2386, 13], [10576, 2368, 8], [10562, 2352, 3], [10545, 2340, 2.2], [10527, 2330, 2.2], [10512, 2318, 2.2], [10503, 2312, 2]], launch: [36, 62], brake: 0.86 }));
  { const c = park.rides[park.rides.length - 1]; c.spec = [10488, c.g0 + 16, 2405]; }
  park.rides.push(new Monorail(park, {}));
  // 움직이지 않는 것 묶기: 가로등 · 기둥 · 꽃 · 나무 · 전구 · 창 불빛 · 이름 판
  { const st = park.stat;
    for (const [x, y, z] of park.post) st.add(G.box(0.1, 1.0, 0.1), '#f2eee4', 'metal', T(x, y, z));
    for (const [x, y, z] of park.lampL) { st.add(G.cyl(0.11, 0.08, 4.2, 8), '#2a2d33', 'metal', T(x, y, z)); st.add(G.cyl(0.2, 0.2, 0.5, 8), '#2a2d33', 'metal', T(x, y, z)); st.add(G.box(1.1, 0.08, 0.08), '#2a2d33', 'metal', T(x, y + 4.0, z)); for (const s of [-0.55, 0.55]) park.bulb(x + s, y + 3.85, z, '#fff1cf', 0.26); park.bulb(x, y + 4.45, z, '#fff1cf', 0.2); }
    const FC = ['#ff5f8a', '#ffd23f', '#ff9a3d', '#c77dff', '#ffffff', '#ff4d4d', '#7bdff2'];
    for (const [x, y, z, i] of park.flower) { st.add(G.ball(0.45 + hash2(i, 1) * 0.3, 5), '#4f8a3f', 'std', T(x, y, z, 0, 0, 0, new THREE.Vector3(1, 0.45, 1))); for (let k = 0; k < 4; k++) st.add(G.ball(0.13, 4), FC[(i + k) % FC.length], 'std', T(x + (hash2(i, k) - 0.5) * 0.7, y + 0.22, z + (hash2(k, i) - 0.5) * 0.7)); }
    for (const [x, y, z, s] of park.tree) { st.add(G.cyl(0.18 * s, 0.13 * s, 2.4 * s, 6), '#6b4a32', 'std', T(x, y, z)); for (let k = 0; k < 3; k++) st.add(new THREE.IcosahedronGeometry((1.5 - k * 0.25) * s, 1), ['#4f8a3f', '#5f9a4c', '#6fae58'][k], 'std', T(x + (k - 1) * 0.4 * s, y + (2.6 + k * 0.7) * s, z + (k % 2 - 0.5) * 0.5 * s)); }
    for (const [x, y, z, col, r] of park.bulbs) st.add(G.ball(r, 5), col, 'glow', T(x, y, z));
    for (const [x, y, z, ry, w = 1, col] of park.win) st.add(new THREE.PlaneGeometry(0.6 * w, 1.2 * w / 1.6), col || '#ffd79a', 'glow', T(x, y, z, ry));
  }
  // 밤: 가로등 아래 바닥에 번지는 따뜻한 빛 (인스턴스 하나)
  { const tx = canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.5, 'rgba(255,190,120,0.3)'); gr.addColorStop(1, 'rgba(255,180,110,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
    const pm = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), pg = new THREE.PlaneGeometry(9, 9); pg.rotateX(-Math.PI / 2); const im = new THREE.InstancedMesh(pg, pm, park.lampL.length); park.lampL.forEach(([x, y, z], i) => im.setMatrixAt(i, T(x, y + 0.18, z))); im.renderOrder = 3; im.userData.noDrape = true; g.add(im); park.poolM = pm; }
  park.statM = park.stat.build(g, { shadow: true }); park.castleM = park.castleKit.build(g, { shadow: true });
  // 이름 판 (글씨 그림 한 장)
  for (const S of park.signs) { const tx = canvasTex(512, 96, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.font = 'bold 72px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8202f'; c.fillText(S.text, w / 2, h / 2 + 4); }); const m = new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }); const me = new THREE.Mesh(new THREE.PlaneGeometry(S.w, S.w * 96 / 512), m); me.position.set(S.x, S.y, S.z); me.rotation.y = S.ry; me.userData.noDrape = true; g.add(me); park.signM = m; }
  // 이름표 가림: 성(꼭대기 42m) · 자유낙하 탑(70m) · 진자 뒤 아파트 이름표는 숨긴다. 섬 · 다리 위에서는 150m 밖 이름표를 띄우지 않는다
  { const off = () => park.hidden || !park.g.visible, c = park.castle; H.labelOcc = (H.labelOcc || []).filter((o) => o.key !== 'park');
    H.labelOcc.push({ key: 'park', x: c.x, z: c.z, r: 13, top: c.y0 + 42, off }, { key: 'park', x: 10641, z: 2353, r: 4, top: park.ground(10641, 2353) + 72, off }, { key: 'park', x: 10570, z: 2402, r: 8, top: park.ground(10570, 2402) + 30, off });
    H.labelSkip = (l, d) => !off() && d > 150 && (inRing(H.px, H.pz, R_ISLE) || inRing(H.px, H.pz, R_ISLET) || inRing(H.px, H.pz, R_BRIDGE)); }
  park.riders = new Riders(g, 300);
  // 어드벤처 문 둘 (북쪽 정문 · 남쪽 섬 가는 문): 몰처럼 걸어 들어가면 실내로
  const doorAt = (x, z, nx, nz, label) => { const D = { name: '롯데월드 어드벤처', x: x + nx * 0.8, z: z + nz * 0.8, nx, nz, key: 'park', label, build: (hg2, mb) => buildAdventure(hg2, park, mb) }; (H.malls ||= []).push(D); park.doors = [...(park.doors || []), D];
    const gd = new THREE.Group(), y = park.ground(x, z); gd.position.set(x + nx * 0.3, y, z + nz * 0.3); gd.rotation.y = Math.atan2(nx, nz); gd.userData.noDrape = true; g.add(gd); const k = new Kit();
    k.add(G.box(10, 6, 0.3), '#cfe6f2', 'metal', T(0, 0, 0)); k.add(G.box(12, 0.6, 3.2), '#e8202f', 'std', T(0, 6.2, 1.4)); k.add(G.box(12.4, 0.25, 3.4), '#ffffff', 'std', T(0, 6.8, 1.4)); for (const s of [-5.6, 5.6]) k.add(G.cyl(0.18, 0.18, 6.2, 8), '#f2eee4', 'metal', T(s, 0, 2.8)); for (let i = 0; i < 10; i++) k.add(G.ball(0.12, 5), '#fff1cf', 'glow', T(-5 + i * 1.1, 6.0, 2.95)); k.add(new THREE.PlaneGeometry(9.4, 5.4), '#ffe2b0', 'glow', T(0, 2.8, 0.17)); k.build(gd);
    const tx = canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#e8202f'; c.fillRect(0, 0, w, h); c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(label, w / 2, h / 2 + 2); }); const sm = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 1.45), new THREE.MeshBasicMaterial({ map: tx })); sm.position.set(0, 6.5, 3.12); gd.add(sm); };
  doorAt(10411, 2016, -0.296, -0.955, '롯데월드 어드벤처 정문'); doorAt(10514, 2170.7, 0.297, 0.955, '어드벤처 · 매직아일랜드');
  // 모노레일 타는 곳 표지 (다리 시작 서쪽)
  { const M2 = park.rides.find((r) => r.name === '모노레일'), [bx, bz] = M2.board, y = park.ground(bx, bz); park.stat.add(G.cyl(0.08, 0.08, 3, 6), '#2a2d33', 'metal', T(bx, y, bz)); const tx = canvasTex(256, 96, (c, w, h) => { c.fillStyle = '#22405e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('🚝 모노레일', w / 2, 44); c.font = '22px sans-serif'; c.fillText('타는 곳', w / 2, 78); }); const me = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); me.position.set(bx, y + 3.1, bz); g.add(me); park.stat.build(g); }
  park.inRides = [];
  park.tick = (dt) => tickPark(park, dt);
  return park;
}

// ---------- 매 프레임: 기구 움직임 · 밤 불빛 ----------
const _m = new THREE.Matrix4(), _o = new THREE.Object3D(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function tickPark(park, dt) {
  const hg = park.hg, night = hg.light?.night || 0, inside = !!hg.inMall?.I?.isPark;
  park.g.visible = !hg.inMall && !hg.inShop && !hg.inside && !park.hidden;
  mats().glow.color.setScalar(0.62 + night * 0.7); MAT.castle.emissiveIntensity = night * 0.2; if (park.poolM) park.poolM.opacity = night * 0.85; MAT.castle.emissive.setHSL((hg.time * 0.02) % 1 * 0.25 + 0.75, 0.6, 0.55); MAT.glass.emissiveIntensity = night * 0.55;
  // 기구 (보이는 곳만): 바깥 기구는 바깥에 있을 때, 안 기구는 안에 있을 때. 내가 탄 기구는 체험(rideExp)이 움직인다
  const list = inside ? park.inRides : park.g.visible ? park.rides : [], mine = park.ride?.r;
  for (const r of list) if (r !== mine) r.tick(dt);
  const pool = inside ? park.inside?.riders : park.riders; if (pool) { pool.begin(); for (const r of list) r.riders(pool, mine === r); pool.end(); }
  if (inside) park.inside?.tick2?.(dt, night);
}
// 놀이기구 타기 = 명소 체험 하나 (hangang-attractions.js 틀): 움직임 잠금 → 기구 한 바퀴 → 끝나면 도장 · 원래 자리
//   E (휴대폰 단추) = 중간에 내리기. 시점(V): 0 내 눈(1인칭, 마우스로 둘러보기) · 1 뒤에서 · 2 멀리서 기구 전체
export function rideExp(A, park, r) {
  const hg = park.hg; if (!r) return null;
  const R = { r, x: hg.px, z: hg.pz, face: hg.face, yaw0: hg.camYaw, t: 0 }; park.ride = R; r.clock = 0; r.pose(0, 0); hg.v = 0;
  const phase = () => { const t = r.clock; return t < 8 ? '자리에 앉아요 · 안전바를 내려요' : r.clock > r.cycle - 8 ? '천천히 멈춰요' : '달리는 중!'; };
  return {
    title: r.name, lock: true, stampId: 'lotteworld', stampLabel: `롯데월드 · ${r.name}`, actLabel: '내리기', status: phase, where: () => `롯데월드 · ${r.name}`,
    tick(dt) { R.t += dt; r.clock += dt; r.pose(r.clock, dt); const end = r.done !== undefined ? r.done : r.clock >= r.cycle - 0.5; if (end || R.t > r.cycle + 2) { A.finish(this); return; }
    },
    // 시점 · 내 곰은 곰 자리 · 카메라를 다 정한 뒤(맨 끝)에 덮어쓴다
    cam(camera, dt) {
      const s = r.seats[r.my]; s.updateWorldMatrix(true, false); s.matrixWorld.decompose(_o.position, _o.quaternion, _o.scale);
      // 내 곰: 자리에 앉힌다 (1인칭이면 숨긴다)
      const b = hg.bear.root; b.position.copy(_o.position).addScaledVector(V1.set(0, 1, 0).applyQuaternion(_o.quaternion), -0.32); b.quaternion.copy(_o.quaternion); b.visible = (hg.opt.cam || 0) !== 0; if (hg.shadow) hg.shadow.visible = false;
      const mode = hg.opt.cam || 0, look = hg.camYaw - R.yaw0, pitch = -(hg.camPitch ?? 0.32) + 0.32; R.cam = camera;
      if (mode === 0) { camera.position.copy(_o.position).addScaledVector(V1.set(0, 1, 0).applyQuaternion(_o.quaternion), 0.78); _q.setFromEuler(_e.set(Math.max(-1.2, Math.min(1.2, pitch * 1.5)), Math.PI + look, 0, 'YXZ')); camera.quaternion.copy(_o.quaternion).multiply(_q); }
      else if (mode === 1) { const back = V1.set(0, 0, -1).applyQuaternion(_o.quaternion); back.y = 0; back.normalize(); const p = V2.copy(_o.position).addScaledVector(back, 5.5); p.y += 2.6; camera.position.lerp(p, Math.min(1, dt * 6)); camera.up.set(0, 1, 0); camera.lookAt(_o.position.x, _o.position.y + 0.6, _o.position.z); }
      else {
        // 멀리서: 기구 바닥과 탄 자리 사이를 본다 (높은 기구도 아래부터 화면에 들어오게)
        const sp = r.spec || [_o.position.x + 30, _o.position.y + 15, _o.position.z + 30], gy = r.g0 ?? _o.position.y; camera.position.set(sp[0], sp[1], sp[2]); camera.up.set(0, 1, 0); camera.lookAt(_o.position.x, gy + (_o.position.y - gy) * 0.6, _o.position.z); }
      if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); } },
    act() { A.finish(this, true); },
    end() { park.ride = null; hg.placeAt(R.x, R.z, R.face); hg.bear.root.visible = true; hg.bear.root.quaternion.identity(); if (hg.shadow) hg.shadow.visible = true; R.cam?.up.set(0, 1, 0); },
  };
}
