// 🌉 한강 러닝: 실제 한강 지도(OSM)로 만든 힐링 러닝 맵
//   장애물 · 탈락 없음. 스스로 속도를 정해 달리고(저절로 빨라지지 않는다), 하늘 · 계절 · 날씨 · 사람들을 보며 쉬는 곳
//   지도 데이터: public/dream-runner/hangang/<코스>.json (tools/hangang-map.mjs 로 만든다 · © OpenStreetMap contributors)
//   좌표: x = 동쪽, z = 남쪽 (미터, 코스 중심이 원점)
import * as THREE from 'three';
import { makeBear, poseBear, FLIP_T } from './runner.js';
import { isPhone } from '../../shared/js/perf.js';

export const SEASONS = { spring: '🌸 봄', summer: '🌿 여름', autumn: '🍁 가을', winter: '❄️ 겨울' };
export const WEATHERS = { clear: '☀️ 맑음', cloudy: '☁️ 구름', rain: '🌧️ 비', snow: '🌨️ 눈' };
export const TIMES = { sunrise: ['🌅 일출', 5.9], day: ['🌤️ 낮', 11.5], sunset: ['🌇 노을', 18.4], night: ['🌙 밤', 21.5], dawn: ['🌌 새벽', 4.4] };
export const SPEEDS = [['🚶 걷기', 3.2], ['🏃 조깅', 6.4], ['🏃 러닝', 9.2], ['💨 빠르게', 13.2], ['⚡ 전력 질주', 19]];
export const V_MIN = 2.0, V_MAX = 26;
const BEAR = 0.6; // 한강의 곰돌이들은 작게 (사람 크기쯤)
const LAT_MIN = -11, LAT_MAX = 24; // 코스 밖으로는 못 나간다 (강 쪽 · 공원 쪽)

const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const C = (c) => new THREE.Color(c);

// ---------- 도형 도우미 ----------
function unpack(arr, S) { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([arr[i] * S, arr[i + 1] * S]); return out; }
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
const inPoly = (x, z, poly) => inRing(x, z, poly[0]) && !poly.slice(1).some((h) => inRing(x, z, h));
// 평평한 다각형들 → 한 덩어리 (구멍 포함)
function fillGeo(polys, y = 0, uvScale = 0) {
  const pos = [], idx = [], uv = [];
  for (const poly of polys) {
    const outer = poly[0], holes = poly.slice(1);
    if (outer.length < 3) continue;
    const v2 = (r) => r.map(([x, z]) => new THREE.Vector2(x, z));
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(v2(outer), holes.map(v2)); } catch { continue; }
    const base = pos.length / 3, all = [...outer, ...holes.flat()];
    for (const [x, z] of all) { pos.push(x, y, z); if (uvScale) uv.push(x / uvScale, z / uvScale); }
    for (const t of tris) idx.push(base + t[0], base + t[1], base + t[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uvScale) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 선 → 띠 (y 는 숫자 또는 점마다의 높이 함수)
function ribbonInto(P, I, pts, w, y, U) {
  if (pts.length < 2) return;
  const base = P.length / 3; let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz * w / 2, nz = dx * w / 2, h = typeof y === 'function' ? y(i) : y;
    if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    P.push(pts[i][0] + nx, h, pts[i][1] + nz, pts[i][0] - nx, h, pts[i][1] - nz);
    if (U) U.push(0, acc / 4, 1, acc / 4);
    if (i) { const k = base + i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
}
function geoOf(P, I, extra = {}) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); for (const [k, [arr, n]] of Object.entries(extra)) g.setAttribute(k, new THREE.Float32BufferAttribute(arr, n)); g.setIndex(I); g.computeVertexNormals(); return g; }
// 땅에 붙은 층: 깊이를 쓰지 않고 순서대로 그린다 (먼 곳에서 깜빡이지 않게)
function flatMat(color, order, extra = {}) { const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, depthWrite: false, depthTest: false, ...extra }); m.userData.order = order; return m; }

// 창문 무늬 (8 × 8 칸). lit: 밤에 켜진 창
function windowTex(glass, lit, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = rnd(seed);
  g.fillStyle = lit ? '#000' : glass ? '#c9d3dc' : '#e9e6df'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = i * 32, y = j * 32;
    if (lit) { if (r() < 0.3) { g.fillStyle = r() < 0.8 ? `hsl(${35 + r() * 15},90%,${62 + r() * 18}%)` : `hsl(200,40%,${70 + r() * 15}%)`; if (glass) g.fillRect(x + 2, y + 3, 28, 25); else g.fillRect(x + 7, y + 8, 18, 16); } continue; }
    if (glass) { const k = 0.85 + r() * 0.15; g.fillStyle = `rgb(${150 * k},${168 * k},${188 * k})`; g.fillRect(x + 2, y + 3, 28, 25); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 3, 28, 6); }
    else { g.fillStyle = '#c9c4ba'; g.fillRect(x + 4, y + 26, 24, 3); g.fillStyle = `rgb(${60 + r() * 25},${72 + r() * 25},${88 + r() * 25})`; g.fillRect(x + 7, y + 8, 18, 16); }
  }
  // (0,0) 근처는 벽 (지붕 · 바닥 uv 가 가리키는 곳)
  g.fillStyle = lit ? '#000' : glass ? '#8899aa' : '#e9e6df'; g.fillRect(0, 0, 6, 6);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 외벽 무늬 (8 × 8 칸 = 8층 × 8칸). lit: 밤에 켜진 창 (검은 바탕에 불빛)
function facadeTex(type, lit, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = rnd(seed + type.length * 7), C = 32;
  const wall = { apt: '#f4f2ee', glass: '#d6dde4', stone: '#e6e1d8', brick: '#d7d0c8', gold: '#f0e2c0' }[type];
  g.fillStyle = lit ? '#000' : wall; g.fillRect(0, 0, 256, 256);
  if (!lit && type === 'brick') for (let y = 0; y < 256; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 256; x += 8) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; g.fillRect(x, y, 7, 3); }
  if (!lit && type === 'stone') for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, 256, 1); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = i * C, y = j * C, on = r() < (type === 'apt' ? 0.45 : 0.32), warm = r() < 0.75;
    const lc = warm ? `hsl(${34 + r() * 14},${80 + r() * 15}%,${60 + r() * 20}%)` : `hsl(205,35%,${72 + r() * 15}%)`;
    if (type === 'apt') {
      // 넓은 거실 창 + 발코니 난간 띠 (가끔 에어컨 · 화분)
      if (lit) { if (on) { g.fillStyle = lc; g.fillRect(x + 3, y + 6, 26, 17); } continue; }
      g.fillStyle = `rgb(${88 + r() * 30},${104 + r() * 30},${120 + r() * 30})`; g.fillRect(x + 3, y + 6, 26, 17);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 3, y + 6, 26, 3);
      g.fillStyle = '#fbfaf7'; g.fillRect(x, y + 23, C, 6); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, y + 29, C, 2);
      if (r() < 0.2) { g.fillStyle = '#e8e8e8'; g.fillRect(x + 20, y + 16, 8, 7); }
    } else if (type === 'glass' || type === 'gold') {
      if (lit) { if (on) { g.fillStyle = lc; g.fillRect(x + 1, y + 2, 30, 26); } continue; }
      const k = 0.78 + r() * 0.22; g.fillStyle = type === 'gold' ? `rgb(${200 * k},${170 * k},${100 * k})` : `rgb(${150 * k},${170 * k},${192 * k})`; g.fillRect(x + 1, y + 2, 30, 26);
      const gr = g.createLinearGradient(x, y, x + C, y + C); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.12)'); g.fillStyle = gr; g.fillRect(x + 1, y + 2, 30, 26);
      g.fillStyle = type === 'gold' ? '#b08a3a' : '#7d8794'; g.fillRect(x + 15, y + 2, 2, 26); g.fillRect(x, y + 28, C, 4);
    } else if (type === 'stone') {
      if (lit) { if (on) { g.fillStyle = lc; g.fillRect(x + 7, y + 6, 18, 20); } continue; }
      g.fillStyle = `rgb(${70 + r() * 25},${82 + r() * 25},${96 + r() * 25})`; g.fillRect(x + 7, y + 6, 18, 20); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 6, y + 26, 20, 2); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 7, y + 6, 18, 3);
    } else {
      if (lit) { if (on) { g.fillStyle = lc; g.fillRect(x + 9, y + 8, 14, 16); } continue; }
      g.fillStyle = `rgb(${60 + r() * 20},${68 + r() * 20},${78 + r() * 20})`; g.fillRect(x + 9, y + 8, 14, 16); g.fillStyle = '#efe9df'; g.fillRect(x + 8, y + 24, 16, 2);
    }
  }
  g.fillStyle = lit ? '#000' : wall; g.fillRect(0, 0, 3, 3);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 땅 무늬: 잔디(회색조라 계절 색이 곱해진다) · 도시 바닥 · 아스팔트(가장자리 흰 선) · 러닝 트랙(붉은 우레탄) · 호안 돌
function groundTex(kind) {
  const N = kind === 'city' ? 128 : 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), r = rnd(kind.length * 31 + 7);
  const noise = (base, amp, n, sz) => { g.fillStyle = base; g.fillRect(0, 0, N, N); for (let i = 0; i < n; i++) { const v = (r() - 0.5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(r() * N, r() * N, sz * (0.5 + r()), sz * (0.5 + r())); } };
  if (kind === 'grass') { noise('#e4e4e4', 0.22, 2600, 6); g.lineWidth = 1; for (let i = 0; i < 1400; i++) { const x = r() * N, y = r() * N, v = 150 + r() * 105; g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); g.stroke(); } }
  else if (kind === 'city') { noise('#d8d8d8', 0.12, 500, 10); g.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i <= N; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, N); g.moveTo(0, i); g.lineTo(N, i); g.stroke(); } }
  else if (kind === 'asphalt') { noise('#4b4f56', 0.16, 5000, 2); g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 5, N); g.fillRect(N - 11, 0, 5, N); }
  else if (kind === 'track') { noise('#b2604c', 0.16, 6000, 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(5, 0, 4, N); g.fillRect(N - 9, 0, 4, N); }
  else { noise('#c9c2b4', 0.18, 300, 14); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let y = 0; y < N; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); for (let x = (y / 32) % 2 ? 0 : 24; x < N; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function cloudTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d'), r = rnd(7);
  for (let i = 0; i < 26; i++) { const x = 40 + r() * 176, y = 50 + r() * 40, rad = 18 + r() * 34, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); }

// ---------- 하늘: 시각마다의 색 ----------
const SKY = [
  [0, '#060b1f', '#18223f', '#0b0f22'], [4.2, '#0d1636', '#3a3a68', '#141a33'], [5.3, '#2b3d78', '#d68a7a', '#3a3550'], [6.2, '#4f7ac2', '#ffc58f', '#7a6a70'],
  [7.5, '#4a8ad8', '#cfe3f5', '#9fb3c4'], [12, '#2f78d8', '#bcdcf4', '#b9c7cf'], [16.5, '#3f7fd0', '#e6dcc0', '#b8b4a8'], [18, '#3a5aa8', '#ffb070', '#8a6a68'],
  [18.8, '#2a3570', '#ff7a55', '#5a3e55'], [19.6, '#151c45', '#7a4a78', '#262238'], [20.6, '#080d24', '#1d2545', '#0d1124'], [24, '#060b1f', '#18223f', '#0b0f22'],
];
function skyAt(h) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const [h0, t0, z0, g0] = SKY[i], [h1, t1, z1, g1] = SKY[i + 1], k = smooth(0, 1, (h - h0) / (h1 - h0));
  return { top: C(t0).lerp(C(t1), k), hor: C(z0).lerp(C(z1), k), ground: C(g0).lerp(C(g1), k) };
}

export class Hangang {
  constructor() {
    this.scene = new THREE.Scene();
    this.ready = false; this.t = 0;
    this.opt = { season: 'auto', weather: 'auto', time: 'auto', flow: 1, cam: 0 };
    this.state = { season: 'spring', weather: 'clear', hour: 12 };
  }
  async load(id = 'yeouido') {
    if (this.ready && this.id === id) return;
    const res = await fetch(new URL(`../hangang/${id}.json`, import.meta.url)); if (!res.ok) throw new Error('지도를 불러오지 못했어요');
    this.map = await res.json(); this.id = id; this.build(); this.ready = true;
  }
  // ---------- 코스 (실제 자전거길) ----------
  routeSetup() {
    const S = this.map.scale, pts = unpack(this.map.route, S), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // 부드럽게: 2m 간격으로 다시 찍고 살짝 다듬는다
    const L = cum[cum.length - 1], N = Math.ceil(L / 2), rs = [];
    for (let k = 0, i = 0; k <= N; k++) { const s = (k / N) * L; while (i < cum.length - 2 && cum[i + 1] < s) i++; const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1); rs.push([lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]); }
    for (let pass = 0; pass < 6; pass++) for (let i = 1; i < rs.length - 1; i++) { rs[i] = [(rs[i - 1][0] + rs[i][0] * 2 + rs[i + 1][0]) / 4, (rs[i - 1][1] + rs[i][1] * 2 + rs[i + 1][1]) / 4]; }
    this.rp = rs; this.L = L; this.step = L / N;
  }
  // 코스 위 s 지점: 위치 · 진행 방향 · 오른쪽
  at(s) {
    const f = clamp(s / this.step, 0, this.rp.length - 1.001), i = Math.floor(f), t = f - i, a = this.rp[i], b = this.rp[i + 1];
    const a0 = this.rp[Math.max(0, i - 2)], b0 = this.rp[Math.min(this.rp.length - 1, i + 3)];
    let dx = b0[0] - a0[0], dz = b0[1] - a0[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), dx, dz, rx: -dz, rz: dx };
  }
  world(s, lat) { const p = this.at(s); return [p.x + p.rx * lat, p.z + p.rz * lat]; }
  // 위치 → 코스 위 (s, 옆으로 얼마나)
  project(x, z) {
    const R = this.rp, n = R.length; let best = Infinity, bi = this.ri || 0, bt = 0;
    for (let i = Math.max(0, (this.ri || 0) - 80); i < Math.min(n - 1, (this.ri || 0) + 80); i++) { const a = R[i], b = R[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1), d = (a[0] + dx * t - x) ** 2 + (a[1] + dz * t - z) ** 2; if (d < best) { best = d; bi = i; bt = t; } }
    this.ri = bi; const s = (bi + bt) * this.step, p = this.at(s);
    return { s, lat: (x - p.x) * p.rx + (z - p.z) * p.rz };
  }

  build() {
    const M = this.map, S = M.scale, sc = this.scene, r = rnd(12345);
    this.routeSetup();
    const P2 = (a) => unpack(a, S), polys = (list) => list.map((p) => p.map(P2));
    this.water = polys(M.water); this.islands = polys(M.island);
    const inWater = (x, z) => this.water.some((w) => inPoly(x, z, w)) && !this.islands.some((w) => inPoly(x, z, w));
    this.inWater = inWater;
    // 빛
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#7a7a60', 1.1); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.6); sc.add(this.sun); sc.add(this.sun.target);
    if (!isPhone) { this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); const sc2 = this.sun.shadow.camera; sc2.left = sc2.bottom = -45; sc2.right = sc2.top = 45; sc2.near = 10; sc2.far = 900; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04; }
    sc.fog = new THREE.FogExp2('#bcdcf4', 0.00022);
    // 하늘 공 · 별 · 해 · 달
    this.skyU = { top: { value: C('#2f78d8') }, hor: { value: C('#bcdcf4') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: C('#fff3d0') }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, night: { value: 0 }, cloud: { value: 0 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, moonDir; uniform float night, cloud; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){ float y = max(vD.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.38));
          float sd = max(dot(vD, sunDir), 0.0); c += sunCol * (pow(sd, 900.0) * 2.0 + pow(sd, 12.0) * 0.35) * (1.0 - cloud * 0.8);
          float md = max(dot(vD, moonDir), 0.0); c += vec3(0.85,0.9,1.0) * (smoothstep(0.9993, 0.9996, md) * 0.9 + pow(md, 60.0) * 0.12) * night * (1.0 - cloud * 0.9);
          vec3 q = floor(vD * 420.0); float st = step(0.9965, h(q)) * smoothstep(0.02, 0.25, vD.y) * night * (1.0 - cloud); c += vec3(st) * (0.6 + 0.4 * h(q + 3.0));
          if (vD.y < 0.0) c = hor * 0.9;
          gl_FragColor = vec4(c, 1.0); }` }));
    this.sky.renderOrder = -100; sc.add(this.sky);
    // 땅 바탕 (도시)
    const landTex = groundTex('city'); landTex.repeat.set(26000 / 9, 26000 / 9); const land = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000), flatMat('#a3a39f', -60, { map: landTex })); land.receiveShadow = true; land.rotation.x = -Math.PI / 2; land.renderOrder = -60; land.material.depthTest = true; land.material.depthWrite = true; sc.add(land); this.landM = land.material;
    // 물: 반짝이는 물결 · 하늘 색 반사 · 밤에는 도시 불빛이 비친다
    this.waterU = { time: { value: 0 }, sunDir: this.skyU.sunDir, sunCol: this.skyU.sunCol, hor: this.skyU.hor, top: this.skyU.top, night: this.skyU.night, rain: { value: 0 }, fogCol: { value: C('#bcdcf4') }, fogD: { value: 0.00022 }, deep: { value: C('#2c5866') } };
    const waterM = new THREE.ShaderMaterial({ uniforms: this.waterU, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float time, night, rain, fogD; uniform vec3 sunDir, sunCol, hor, top, fogCol, deep; varying vec3 vW;
        float n2(vec2 p){ return sin(p.x) * sin(p.y); }
        void main(){ vec2 p = vW.xz; float t = time;
          vec2 g = vec2(cos(p.x*0.21 + t*0.9) * 0.6 + cos((p.x+p.y)*0.37 - t*1.3) * 0.35 + cos(p.x*1.3 + p.y*0.7 + t*2.1) * 0.12, cos(p.y*0.19 - t*0.8) * 0.6 + cos((p.y-p.x)*0.41 + t*1.1) * 0.35 + cos(p.y*1.1 - p.x*0.9 - t*2.3) * 0.12);
          g += rain * vec2(cos(p.x*3.1 + t*7.0), cos(p.y*2.9 - t*6.0)) * 0.6;
          vec3 n = normalize(vec3(g.x * 0.08, 1.0, g.y * 0.08));
          vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 c = mix(deep * (0.35 + 0.65 * (1.0 - night)), mix(hor, top, 0.25), clamp(0.25 + fr * 0.85, 0.0, 1.0));
          vec3 rf = reflect(-v, n); float sp = pow(max(dot(rf, sunDir), 0.0), 220.0) * step(0.0, sunDir.y); c += sunCol * sp * 3.0;
          c += sunCol * pow(max(dot(rf, sunDir), 0.0), 18.0) * 0.18 * step(0.0, sunDir.y);
          float lights = smoothstep(0.55, 1.0, sin(p.x * 0.09 + g.x * 2.0) * sin(p.x * 0.31) ) * night * smoothstep(40.0, 700.0, length(cameraPosition.xz - p));
          c += vec3(1.0, 0.72, 0.4) * lights * 0.35;
          float d = length(cameraPosition - vW); float f = 1.0 - exp(-pow(fogD * d, 2.0)); c = mix(c, fogCol, f);
          gl_FragColor = vec4(c, 1.0); }` });
    const wMesh = new THREE.Mesh(fillGeo(this.water), waterM); wMesh.renderOrder = -47; sc.add(wMesh); // 물은 공원 위에 (OSM 한강공원 영역이 물까지 덮고 있다)
    // 섬 · 녹지 (계절마다 색이 바뀐다)
    this.islandM = flatMat('#7fa860', -46.9, { map: this.grassTex ||= groundTex('grass') }); const isl = new THREE.Mesh(fillGeo(this.islands, 0, 7), this.islandM); isl.renderOrder = -46.9; sc.add(isl);
    const greens = { grass: [], wood: [], wild: [], pitch: [], sand: [] };
    for (const g of M.green) (greens[g[0]] || greens.grass).push(g.slice(1).map(P2));
    this.greenPolys = [...greens.grass, ...greens.wood, ...greens.wild];
    this.greenM = {};
    for (const [k, col, o] of [['grass', '#8db86a', -53], ['wild', '#94a96a', -52.5], ['wood', '#5f8a4a', -52], ['pitch', '#6aa860', -51.5], ['sand', '#d9c79a', -51]]) {
      if (!greens[k].length) continue; const m = flatMat(col, o, k === 'sand' ? {} : { map: this.grassTex ||= groundTex('grass') }); this.greenM[k] = m; const me = new THREE.Mesh(fillGeo(greens[k], 0, 7), m); me.renderOrder = o; me.receiveShadow = true; sc.add(me);
    }
    // 길 · 철길
    { const P = [], I = []; for (const rd of M.roads) { if (rd[1]) continue; ribbonInto(P, I, P2(rd.slice(2)), rd[0], 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#6f7173', -50)); m.renderOrder = -50; sc.add(m); this.roadM = m.material; }
    { const P = [], I = []; for (const rl of M.rails) ribbonInto(P, I, P2(rl), 4, 0); const m = new THREE.Mesh(geoOf(P, I), flatMat('#5d5650', -49.5)); m.renderOrder = -49.5; sc.add(m); }
    { const P = [], I = []; for (const pa of M.paths) { if (pa[0]) continue; ribbonInto(P, I, P2(pa.slice(2)), pa[1], 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#c9c0ae', -49)); m.renderOrder = -49; sc.add(m); this.pathM = m.material; }
    // 달리는 길: 자전거길(짙은 아스팔트) + 강 쪽 산책 · 러닝 길(붉은 우레탄)
    {
      const ln = (lat, w, col, o, tex) => { const P = [], I = [], U = []; ribbonInto(P, I, this.rp.map((_, i) => this.world(i * this.step, lat)), w, 0, U); const m = new THREE.Mesh(geoOf(P, I, { uv: [U, 2] }), flatMat(col, o, tex ? { map: tex } : {})); m.renderOrder = o; m.receiveShadow = true; sc.add(m); return m.material; };
      ln(-1.2, 15, '#8db86a', -48.5, this.grassTex ||= groundTex('grass'));
      ln(0, 4.9, '#d9d4c8', -48.2); ln(-4.3, 3.8, '#d9d4c8', -48.1);
      this.bikeM = ln(0, 4.2, '#ffffff', -48, groundTex('asphalt')); this.runM = ln(-4.3, 3.2, '#ffffff', -47.8, groundTex('track'));
      const P = [], I = []; for (let s = 0; s < this.L - 3; s += 6) { const seg = [this.world(s, 0), this.world(s + 3, 0)]; ribbonInto(P, I, seg, 0.15, 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#f2c53d', -47.5)); m.renderOrder = -47.5; sc.add(m);
    }
    {
      const P = [], I = [], U = [];
      for (const w of this.water) for (const ring of w) { let run = []; const flush = () => { if (run.length > 2) ribbonInto(P, I, run, 5, 0, U); run = []; }; for (const [x, z] of ring) { const near = Math.abs(x) < 3200 && Math.abs(z) < 3200 && Math.abs(Math.abs(x) - 7000) > 5 && Math.abs(Math.abs(z) - 7000) > 5; if (near) run.push([x, z]); else flush(); } flush(); }
      const m = new THREE.Mesh(geoOf(P, I, { uv: [U, 2] }), flatMat('#ffffff', -46.8, { map: groundTex('stone') })); m.renderOrder = -46.8; sc.add(m);
    }
    this.buildBridges(P2, inWater, r);
    this.buildBuildings(P2);
    this.buildFar(P2);
    this.buildPlants(inWater, r);
    this.buildLights(r);
    this.buildSkyStuff(r);
    this.buildPeople();
    // 내 곰돌이 그림자
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = -40; sc.add(this.shadow);
  }

  // 다리: 물 위는 14m 높이로 띄우고, 교각 · 난간 · 밤 조명. 서강대교는 밤섬 위에 붉은 아치
  buildBridges(P2, inWater) {
    const deck = { P: [], I: [] }, side = { P: [], I: [] }, piers = [], lamps = [];
    const rails = [], rails2 = [];
    for (const b of this.map.bridges) {
      const pts = P2(b.p); if (pts.length < 2) continue;
      // 잘게 나눠 높이를 정한다 (물 위 14m, 땅에서는 끝으로 갈수록 내려간다)
      const fine = []; for (let i = 1; i < pts.length; i++) { const [a, c] = [pts[i - 1], pts[i]], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(L / 15)); for (let k = 0; k < n; k++) fine.push([lerp(a[0], c[0], k / n), lerp(a[1], c[1], k / n)]); } fine.push(pts[pts.length - 1]);
      const wet = fine.map(([x, z]) => inWater(x, z)), anyWet = wet.some(Boolean), top = anyWet ? 14 : 7;
      const dist = fine.map(() => Infinity); for (let i = 0; i < fine.length; i++) if (wet[i]) dist[i] = 0;
      for (let pass = 0; pass < 2; pass++) for (let i = 1; i < fine.length; i++) { const d = Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]); dist[i] = Math.min(dist[i], dist[i - 1] + d); } for (let i = fine.length - 2; i >= 0; i--) { const d = Math.hypot(fine[i][0] - fine[i + 1][0], fine[i][1] - fine[i + 1][1]); dist[i] = Math.min(dist[i], dist[i + 1] + d); }
      const ys = fine.map((_, i) => (anyWet ? clamp(top - Math.max(0, dist[i] - 30) * 0.045, 4.5, top) : top));
      ribbonInto(deck.P, deck.I, fine, b.w, (i) => ys[i]);
      ribbonInto(side.P, side.I, fine, b.w + 0.4, (i) => ys[i] - 1.6);
      // 난간 (양쪽 낮은 벽)
      for (const sgn of [-1, 1]) { const off = fine.map((p, i) => { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * (b.w / 2) * sgn, p[1] + dx / L * (b.w / 2) * sgn]; }); rails2.push({ off, ys }); }
      if (b.rail) rails.push({ fine, ys, w: b.w });
      for (let i = 0; i < fine.length; i += 4) { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], ang = Math.atan2(c[1] - a[1], c[0] - a[0]) + Math.PI / 2; if (anyWet && wet[i]) piers.push([fine[i][0], fine[i][1], ys[i], b.w, ang]); else if (!anyWet && i % 8 === 0) piers.push([fine[i][0], fine[i][1], ys[i], b.w * 0.6, ang]); }
      if (anyWet) for (let i = 0; i < fine.length; i += 3) { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1; for (const sgn of [-1, 1]) lamps.push(fine[i][0] - dz / L * b.w / 2 * sgn, ys[i] + 1.2, fine[i][1] + dx / L * b.w / 2 * sgn); }
    }
    const dm = new THREE.MeshLambertMaterial({ color: '#8f9094' }), sm = new THREE.MeshLambertMaterial({ color: '#b9bcc0', side: THREE.DoubleSide });
    this.scene.add(new THREE.Mesh(geoOf(deck.P, deck.I), dm), new THREE.Mesh(geoOf(side.P, side.I), sm));
    // 난간: 얇은 벽 (아래 · 위 두 줄)
    { const P = [], I = []; for (const { off, ys } of rails2) for (let i = 1; i < off.length; i++) { const a = off[i - 1], c = off[i], k = P.length / 3; P.push(a[0], ys[i - 1], a[1], c[0], ys[i], c[1], c[0], ys[i] + 1.15, c[1], a[0], ys[i - 1] + 1.15, a[1]); I.push(k, k + 1, k + 2, k, k + 2, k + 3); } this.scene.add(new THREE.Mesh(geoOf(P, I), new THREE.MeshLambertMaterial({ color: '#d8dade', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }))); }
    // 교각: 둥근 기둥 둘 + 머리보 (물 위), 땅 위 고가는 기둥 하나
    const colG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); colG.translate(0, 0.5, 0);
    const capG = new THREE.BoxGeometry(1, 1.4, 2.4);
    const pm = new THREE.MeshLambertMaterial({ color: '#a2a4a6' }), cols = new THREE.InstancedMesh(colG, pm, piers.length * 2), caps = new THREE.InstancedMesh(capG, pm, piers.length), o = new THREE.Object3D();
    piers.forEach(([x, z, y, w, ang], i) => { const half = Math.min(w * 0.3, 6); for (const sgn of [-1, 1]) { o.position.set(x + Math.cos(ang || 0) * half * sgn, -1, z + Math.sin(ang || 0) * half * sgn); o.rotation.set(0, 0, 0); o.scale.set(w > 12 ? 1.8 : 1.2, y - 1.4 + 1, w > 12 ? 1.8 : 1.2); o.updateMatrix(); cols.setMatrixAt(i * 2 + (sgn > 0 ? 1 : 0), o.matrix); } o.position.set(x, y - 2.4, z); o.rotation.set(0, -(ang || 0), 0); o.scale.set(Math.min(w * 0.75, 16), 1, 1); o.updateMatrix(); caps.setMatrixAt(i, o.matrix); });
    this.scene.add(cols, caps);
    // 철교: 트러스 (선)
    const tP = []; for (const { fine, ys, w } of rails) for (let i = 1; i < fine.length; i++) { const a = fine[i - 1], c = fine[i], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2; for (const sgn of [-1, 1]) { const ax = a[0] + nx * sgn, az = a[1] + nz * sgn, cx = c[0] + nx * sgn, cz = c[1] + nz * sgn, y0 = ys[i - 1], y1 = ys[i]; tP.push(ax, y0, az, cx, y1 + 7, cz, ax, y0 + 7, az, cx, y1 + 7, cz, ax, y0, az, ax, y0 + 7, az); } }
    if (tP.length) { const beams = []; for (let i = 0; i < tP.length; i += 6) beams.push([tP[i], tP[i + 1], tP[i + 2], tP[i + 3], tP[i + 4], tP[i + 5]]); const bg = new THREE.BoxGeometry(0.5, 0.5, 1); bg.translate(0, 0, 0.5); const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: '#5b6672' }), beams.length), o2 = new THREE.Object3D(), A = new THREE.Vector3(), B = new THREE.Vector3(); beams.forEach(([x1, y1, z1, x2, y2, z2], i) => { A.set(x1, y1, z1); B.set(x2, y2, z2); o2.position.copy(A); o2.lookAt(B); o2.scale.set(1, 1, A.distanceTo(B)); o2.updateMatrix(); bm.setMatrixAt(i, o2.matrix); }); this.scene.add(bm); }
    // 아치 (서강대교)
    for (const [, ax, az, span] of this.map.arches || []) {
      const x0 = ax * this.map.scale, z0 = az * this.map.scale; let best = null;
      for (const b of this.map.bridges) { const pts = P2(b.p); for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - x0, pts[i][1] - z0); if (!best || d < best.d) best = { d, a: pts[i - 1], c: pts[i], w: b.w }; } }
      if (!best || best.d > 120) continue;
      const dx = best.c[0] - best.a[0], dz = best.c[1] - best.a[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      const am = new THREE.MeshLambertMaterial({ color: '#c8322a' });
      for (const sgn of [-1, 1]) {
        const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24 - 0.5; pts.push(new THREE.Vector3(x0 + ux * t * span - uz * (best.w / 2 + 0.5) * sgn, 14 + Math.cos(t * Math.PI) * 24, z0 + uz * t * span + ux * (best.w / 2 + 0.5) * sgn)); }
        this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.9, 6), am));
        const hg = []; for (let k = 2; k < 23; k += 2) { const p = pts[k]; hg.push(p.x, p.y, p.z, p.x, 14, p.z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(hg, 3)); this.scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#d9d4cc' })));
      }
    }
    this.bridgeLights = this.glowPoints(lamps, '#ffcf8a', 2.2);
  }
  glowPoints(arr, col, size) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.PointsMaterial({ color: col, size, map: this.dot ||= dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const p = new THREE.Points(g, m); this.scene.add(p); return p;
  }

  // 건물: 실제 외곽선 · 높이 + 실제 모습에 가까운 외벽
  //   아파트(흰 벽 · 발코니 띠) · 유리 오피스(색 유리 · 멀리온) · 석재 오피스(창이 뚫린 돌벽) · 벽돌(학교 · 주택) · 금빛 유리(63빌딩)
  //   랜드마크: 63빌딩 금빛 유리 · 파크원 빨간 철골 기둥 · LG트윈타워 청동빛 유리 · IFC 푸른 유리 · 전경련회관 짙은 유리 · 국회의사당 흰 기둥 + 초록 돔
  buildBuildings(P2) {
    const M = this.map, r = rnd(99), types = ['apt', 'glass', 'stone', 'brick', 'gold'];
    const sets = Object.fromEntries(types.map((t) => [t, { P: [], N: [], U: [], Cl: [], I: [] }]));
    const extras = { P: [], N: [], Cl: [], I: [] }, domes = [], signs = { P: [], N: [], Cl: [], I: [] };
    const col = new THREE.Color(), roofC = new THREE.Color();
    const GLASS = ['#6f8fb2', '#5f9aa2', '#8a96a4', '#6d9a86', '#9a8a70', '#55626f', '#7aa0c8', '#8fa8b8'], STONE = ['#d8cfbf', '#c9c4bc', '#b8b2a8', '#d9c8ae', '#a99c88', '#e2ddd2'], BRICK = ['#a8573e', '#9a4a36', '#b8694a', '#8a4a3a', '#c07a55'], APT = ['#f1ede4', '#ece4d4', '#e8e8e4', '#f2e9da', '#e4dccd', '#dfe3e6'];
    const FLOOR = { apt: 2.9, glass: 3.9, stone: 3.6, brick: 3.2, gold: 3.9 }, BAY = { apt: 3.4, glass: 1.6, stone: 2.6, brick: 2.4, gold: 1.6 };
    const box = (x, y, z, w, h, d, c, rotY = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(rotY); g.translate(x, y, z); const k = extras.P.length / 3, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { extras.P.push(p.getX(i), p.getY(i), p.getZ(i)); extras.N.push(n.getX(i), n.getY(i), n.getZ(i)); extras.Cl.push(c.r, c.g, c.b); } for (const ix of g.index.array) extras.I.push(k + ix); };
    for (const b of M.buildings) {
      const [h, mh, km, ci, ni, rci, dome] = b, kind = km >> 1, glassTag = km & 1, ring = P2(b.slice(7)); if (ring.length < 3) continue;
      const name = ni >= 0 ? M.names[ni] : '', cTag = ci >= 0 ? M.colors[ci] : '';
      // 외벽 종류
      let type = kind === 1 ? (h > 14 ? 'apt' : r() < 0.5 ? 'brick' : 'stone') : kind === 4 ? (r() < 0.6 ? 'brick' : 'stone') : kind === 5 ? 'brick' : kind === 3 ? 'stone' : kind === 2 || kind === 0 ? (glassTag || h > 55 || (h > 30 && r() < 0.5) ? 'glass' : 'stone') : 'stone';
      let c = null;
      if (/63/.test(name) || /gold/i.test(cTag)) { type = 'gold'; c = '#ffd76a'; }
      else if (/파크원|NH금융타워/.test(name)) { type = 'glass'; c = '#9fb6c8'; }
      else if (/LG트윈|트윈타워/.test(name)) { type = 'glass'; c = '#7a6248'; }
      else if (/IFC/.test(name)) { type = 'glass'; c = '#6f95c8'; }
      else if (/전경련|FKI/.test(name)) { type = 'glass'; c = '#4f6266'; }
      else if (/국회의사당$/.test(name)) { type = 'stone'; c = '#efece4'; }
      else if (/^#?[0-9a-f]{6}$/i.test(cTag) || /^[a-z]+$/i.test(cTag)) { try { col.set(cTag); c = `#${col.getHexString()}`; } catch { c = null; } }
      if (!c) c = type === 'apt' ? APT[Math.floor(r() * APT.length)] : type === 'glass' ? GLASS[Math.floor(r() * GLASS.length)] : type === 'brick' ? BRICK[Math.floor(r() * BRICK.length)] : STONE[Math.floor(r() * STONE.length)];
      col.set(c); if (type !== 'gold') col.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.05);
      try { roofC.set(rci >= 0 ? M.colors[rci] : type === 'apt' ? '#8f8a84' : '#7d7b78'); } catch { roofC.set('#7d7b78'); }
      if (type === 'glass' || type === 'gold') roofC.copy(col).multiplyScalar(0.6);
      const set = sets[type], s = ringArea(ring) > 0 ? 1 : -1, base = () => set.P.length / 3, FH = FLOOR[type] * 8, BW = BAY[type] * 8;
      let acc = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c2 = ring[(i + 1) % ring.length], dx = c2[0] - a[0], dz = c2[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.05) continue;
        const nx = (s > 0 ? dz : -dz) / L, nz = (s > 0 ? -dx : dx) / L, k = base();
        set.P.push(a[0], mh, a[1], c2[0], mh, c2[1], c2[0], h, c2[1], a[0], h, a[1]);
        for (let q = 0; q < 4; q++) { set.N.push(nx, 0, nz); set.Cl.push(col.r, col.g, col.b); }
        const u0 = acc / BW, u1 = (acc + L) / BW, v0 = mh / FH, v1 = h / FH; acc += L;
        set.U.push(u0, v0, u1, v0, u1, v1, u0, v1);
        if (s < 0) set.I.push(k, k + 1, k + 2, k, k + 2, k + 3); else set.I.push(k, k + 2, k + 1, k, k + 3, k + 2);
        // 낮은 상가: 1층 간판 띠 (밤에 빛난다)
        if ((kind === 2 || kind === 0) && h < 30 && mh < 1 && L > 4 && r() < 0.55) { const sc = new THREE.Color(['#ff5a5f', '#ffd23f', '#3db8ff', '#7be07b', '#ff9ec0', '#ffffff', '#ff8a3d'][Math.floor(r() * 7)]), q = signs.P.length / 3, o = 0.08; signs.P.push(a[0] + nx * o, 3.1, a[1] + nz * o, c2[0] + nx * o, 3.1, c2[1] + nz * o, c2[0] + nx * o, 3.9, c2[1] + nz * o, a[0] + nx * o, 3.9, a[1] + nz * o); for (let t = 0; t < 4; t++) { signs.N.push(nx, 0, nz); signs.Cl.push(sc.r, sc.g, sc.b); } if (s < 0) signs.I.push(q, q + 1, q + 2, q, q + 2, q + 3); else signs.I.push(q, q + 2, q + 1, q, q + 3, q + 2); }
      }
      let tris; try { tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []); } catch { tris = []; }
      const k = base(); for (const [x, z] of ring) { set.P.push(x, h, z); set.N.push(0, 1, 0); set.U.push(0.003, 0.003); set.Cl.push(roofC.r, roofC.g, roofC.b); }
      for (const t of tris) { const [A, B, Cc] = t.map((v) => ring[v]); const up = (B[1] - A[1]) * (Cc[0] - A[0]) - (B[0] - A[0]) * (Cc[1] - A[1]); if (up > 0) set.I.push(k + t[0], k + t[1], k + t[2]); else set.I.push(k + t[0], k + t[2], k + t[1]); }
      let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
      // 옥상 설비 (높은 건물)
      if (h > 40 && !/63|IFC|파크원/.test(name)) { const area = Math.abs(ringArea(ring)), w = Math.sqrt(area) * 0.32; box(cx, h + 1.6, cz, w, 3.2, w * 0.8, new THREE.Color('#8e8c88')); }
      // 파크원: 모서리를 따라 오르는 빨간 철골 기둥과 가로대
      if (/파크원|NH금융타워/.test(name)) { const red = new THREE.Color('#d8382a'); for (let i = 0; i < ring.length; i++) { const [x, z] = ring[i], ox = x + (x - cx) * 0.04, oz = z + (z - cz) * 0.04; box(ox, (mh + h) / 2, oz, 2.2, h - mh, 2.2, red); } for (let y = mh + 40; y < h - 10; y += 48) for (let i = 0; i < ring.length; i++) { const a = ring[i], c2 = ring[(i + 1) % ring.length], L = Math.hypot(c2[0] - a[0], c2[1] - a[1]); box((a[0] + c2[0]) / 2 + ((a[0] + c2[0]) / 2 - cx) * 0.04, y, (a[1] + c2[1]) / 2 + ((a[1] + c2[1]) / 2 - cz) * 0.04, L, 1.6, 1.2, red, -Math.atan2(c2[1] - a[1], c2[0] - a[0])); } }
      // 국회의사당: 둘레의 흰 기둥 + 초록 돔
      if (/국회의사당$/.test(name)) { const w = new THREE.Color('#f4f1ea'); for (let i = 0; i < ring.length; i++) { const a = ring[i], c2 = ring[(i + 1) % ring.length], L = Math.hypot(c2[0] - a[0], c2[1] - a[1]), n = Math.floor(L / 7); for (let q = 1; q < n; q++) { const t = q / n, x = a[0] + (c2[0] - a[0]) * t, z = a[1] + (c2[1] - a[1]) * t; box(x + (x - cx) * 0.03, h / 2, z + (z - cz) * 0.03, 1.8, h, 1.8, w); } } domes.push([cx, h, cz, 32]); }
      else if (dome) domes.push([cx, h, cz, Math.sqrt(Math.abs(ringArea(ring))) / 3]);
    }
    this.winTex = {}; this.litTex = {}; this.bldM = [];
    for (const t of types) {
      const st = sets[t]; if (!st.P.length) continue;
      this.winTex[t] = facadeTex(t, false, 3); this.litTex[t] = facadeTex(t, true, 11);
      const shiny = t === 'glass' || t === 'gold';
      const m = shiny ? new THREE.MeshPhongMaterial({ vertexColors: true, map: this.winTex[t], emissive: '#ffffff', emissiveMap: this.litTex[t], emissiveIntensity: 0, shininess: t === 'gold' ? 90 : 70, specular: t === 'gold' ? '#ffe2a0' : '#9fb4c8' })
        : new THREE.MeshLambertMaterial({ vertexColors: true, map: this.winTex[t], emissive: '#ffffff', emissiveMap: this.litTex[t], emissiveIntensity: 0 });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(st.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(st.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(st.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(st.Cl, 3)); g.setIndex(st.I);
      const mesh = new THREE.Mesh(g, m); mesh.castShadow = false; mesh.receiveShadow = true; this.scene.add(mesh); this.bldM.push(m);
    }
    const mk = (S, m) => { if (!S.P.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(S.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(S.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(S.Cl, 3)); g.setIndex(S.I); const me = new THREE.Mesh(g, m); this.scene.add(me); return me; };
    mk(extras, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.signM = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0, side: THREE.DoubleSide }); mk(signs, this.signM);
    const dm = new THREE.MeshPhongMaterial({ color: '#79a690', shininess: 30 });
    for (const [x, y, z, rad] of domes) { const d = new THREE.Mesh(new THREE.SphereGeometry(rad, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), dm); d.scale.y = 0.62; d.position.set(x, y, z); this.scene.add(d); const drum = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, 3, 32), new THREE.MeshLambertMaterial({ color: '#f4f1ea' })); drum.position.set(x, y + 1.5 - 1.5, z); this.scene.add(drum); }
  }
  // 멀리: 높은 건물 상자들 (실제 위치) · 남산타워 · 산 능선
  buildFar() {
    const M = this.map, S = M.scale, n = (M.tall || []).length;
    if (n) {
      const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 6);
      const m = new THREE.MeshLambertMaterial({ map: this.winTex.stone || facadeTex('stone', false, 3), emissive: '#ffffff', emissiveMap: this.litTex.stone || facadeTex('stone', true, 11), emissiveIntensity: 0 });
      const im = new THREE.InstancedMesh(g, m, n), o = new THREE.Object3D(), c = new THREE.Color();
      M.tall.forEach(([x, z, w, d, a, h, k], i) => { o.position.set(x * S, 0, z * S); o.rotation.set(0, -a / 100, 0); o.scale.set(Math.max(8, w * S), h, Math.max(8, d * S)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); c.set(k === 1 ? '#a9bccb' : k === 2 ? '#e8e2d6' : '#cfcac0').offsetHSL(0, 0, (Math.sin(i * 12.9) * 0.5) * 0.06); im.setColorAt(i, c); });
      this.scene.add(im); this.farM = m;
    }
    for (const [name, x, z, h] of M.far || []) {
      const X = x * S, Z = z * S, dist = Math.hypot(X, Z); if (dist > 12000) continue;
      if (/남산/.test(name)) {
        const hill = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4f6e45' })); hill.scale.y = 0.42; hill.position.set(X, 0, Z); this.scene.add(hill);
        const t = new THREE.Group(), wm = new THREE.MeshLambertMaterial({ color: '#e8e8ea' });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 7, 135, 12), wm); shaft.position.y = 135 / 2; t.add(shaft);
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(14, 11, 16, 16), wm); pod.position.y = 128; t.add(pod);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 90, 6), new THREE.MeshLambertMaterial({ color: '#d84a3a' })); ant.position.y = 180; t.add(ant);
        t.position.set(X, 218, Z); this.scene.add(t); this.towerTop = new THREE.Vector3(X, 218 + 226, Z);
      }
    }
    // 서울을 둘러싼 산 (북한산 · 관악산 쪽 높게)
    const ring = [], N = 160; for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, R = 11000 + Math.sin(a * 3.1) * 900, north = Math.max(0, -Math.sin(a)), hh = 240 + north * 520 + Math.max(0, Math.sin(a)) * 380 + (Math.sin(a * 23) * 0.5 + Math.sin(a * 57) * 0.3) * 120; ring.push([Math.cos(a) * R, Math.sin(a) * R, hh]); }
    const P = [], I = []; ring.forEach(([x, z, hh], i) => { P.push(x, -20, z, x, hh, z); if (i) { const k = i * 2; I.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
    this.mtM = new THREE.MeshBasicMaterial({ color: '#7f95a8', fog: false, side: THREE.DoubleSide }); const mt = new THREE.Mesh(geoOf(P, I), this.mtM); mt.renderOrder = -90; this.scene.add(mt);
  }
  // 나무 · 풀 · 꽃: 길 양옆에 줄지어, 공원 안에 흩어서
  buildPlants(inWater, r) {
    const spots = [], near = isPhone ? 0.55 : 1;
    const okAt = (x, z) => !inWater(x, z);
    // 강 쪽은 탁 트이게 드문드문, 공원 쪽은 줄지어
    for (let s = 4; s < this.L; s += 9 / near) for (const lat of [-12.5, 7.5]) { if (lat < 0 && r() < 0.72) continue; const j = lat + (r() - 0.5) * 2.4, [x, z] = this.world(s + (r() - 0.5) * 3, j); if (okAt(x, z)) spots.push([x, z, 0.7 + r() * 0.3]); }
    // 공원 안 (코스 주변 450m)
    for (let n = 0; n < 2600 * near; n++) { const s = r() * this.L, lat = (r() < 0.25 ? -1 : 1) * (12 + r() * 260), [x, z] = this.world(s, lat); if (okAt(x, z) && this.greenPolys.some((g) => inPoly(x, z, g))) spots.push([x, z, 0.7 + r() * 0.6]); }
    this.trees = spots;
    const N = spots.length, o = new THREE.Object3D();
    // 나무 모양 셋: 둥근 활엽수(벚나무 · 느티나무), 키 큰 나무(은행 · 포플러), 소나무. 잎 덩어리 여러 개 + 아래가 어두운 그늘
    const lumps = (defs) => { const gs = defs.map(([x, y, z, rr, sy = 1]) => { const g = new THREE.IcosahedronGeometry(rr, 1); g.scale(1, sy, 1); g.translate(x, y, z); return g; }); const m = mergeGeos(gs); const p = m.attributes.position, cl = []; let y0 = Infinity, y1 = -Infinity; for (let k = 0; k < p.count; k++) { y0 = Math.min(y0, p.getY(k)); y1 = Math.max(y1, p.getY(k)); } for (let k = 0; k < p.count; k++) { const t = (p.getY(k) - y0) / (y1 - y0 || 1), v = 0.62 + t * 0.42; cl.push(v, v, v); } m.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return m; };
    const SHAPES = [
      { crown: lumps([[0, 4.2, 0, 1.9], [1.3, 3.7, 0.4, 1.3], [-1.2, 3.8, -0.5, 1.35], [0.3, 3.6, -1.3, 1.2], [-0.4, 3.5, 1.3, 1.2], [0.2, 5.2, 0.2, 1.2]]), trunk: [0.18, 0.3, 3.4] },
      { crown: lumps([[0, 4.6, 0, 1.25, 1.7], [0.6, 5.6, 0.3, 0.95, 1.5], [-0.5, 3.9, -0.3, 1.0, 1.4]]), trunk: [0.14, 0.24, 3.6] },
      { crown: (() => { const gs = [[3.0, 2.0, 2.0], [4.3, 1.6, 1.7], [5.4, 1.15, 1.4], [6.3, 0.7, 1.1]].map(([y, rr, hh]) => { const g = new THREE.ConeGeometry(rr, hh, 7); g.translate(0, y, 0); return g; }); const m = mergeGeos(gs), p = m.attributes.position, cl = []; for (let k = 0; k < p.count; k++) { const v = 0.7 + (p.getY(k) - 2) / 6 * 0.35; cl.push(v, v, v); } m.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return m; })(), trunk: [0.13, 0.22, 3.0], pine: true },
    ];
    const kindOf = spots.map(() => { const x = r(); return x < 0.62 ? 0 : x < 0.84 ? 1 : 2; });
    this.treeKinds = kindOf; this.crownSets = []; this.twigSets = [];
    const twigs = []; for (let k = 0; k < 7; k++) { const g = new THREE.CylinderGeometry(0.035, 0.08, 2.3, 4); g.translate(0, 1.15, 0); g.rotateZ(0.5 + (k % 3) * 0.22); g.rotateY((k / 7) * Math.PI * 2); g.translate(0, 3.0, 0); twigs.push(g); }
    for (let k = 0; k < 4; k++) { const g = new THREE.CylinderGeometry(0.02, 0.04, 1.2, 3); g.translate(0, 0.6, 0); g.rotateZ(-0.7); g.rotateY(k * 1.7); g.translate(0.6, 4.2, 0); twigs.push(g); }
    const twigG = mergeGeos(twigs), barkM = new THREE.MeshLambertMaterial({ color: '#5e4a3c' });
    SHAPES.forEach((sh, t) => {
      const idx = spots.map((_, i) => i).filter((i) => kindOf[i] === t), n = idx.length; if (!n) { this.crownSets.push(null); return; }
      const tg = new THREE.CylinderGeometry(sh.trunk[0], sh.trunk[1], sh.trunk[2], 7); tg.translate(0, sh.trunk[2] / 2, 0);
      const crowns = new THREE.InstancedMesh(sh.crown, new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), n), trunks = new THREE.InstancedMesh(tg, barkM, n), tw = sh.pine ? null : new THREE.InstancedMesh(twigG, barkM, n);
      idx.forEach((si, q) => { const [x, z, k] = spots[si]; o.position.set(x, 0, z); o.rotation.set(0, r() * 6.28, 0); o.scale.set(k * (0.85 + r() * 0.3), k * (0.85 + r() * 0.35), k * (0.85 + r() * 0.3)); o.updateMatrix(); crowns.setMatrixAt(q, o.matrix); trunks.setMatrixAt(q, o.matrix); tw?.setMatrixAt(q, o.matrix); });
      for (const m of [crowns, trunks, tw]) if (m) { m.castShadow = true; m.receiveShadow = false; this.scene.add(m); }
      this.crownSets.push({ crowns, idx, pine: !!sh.pine }); if (tw) this.twigSets.push(tw);
    });
    this.treeSeed = r;
    // 풀포기 · 꽃 (길 가까이)
    const tuftG = new THREE.ConeGeometry(0.09, 0.28, 3); tuftG.translate(0, 0.14, 0);
    const T = Math.floor(9000 * near), F = Math.floor(2600 * near);
    this.tufts = new THREE.InstancedMesh(tuftG, new THREE.MeshLambertMaterial({ color: '#ffffff' }), T);
    this.flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), F);
    let ti = 0, fi = 0; const c = new THREE.Color();
    while (ti < T || fi < F) {
      const s = r() * this.L, lat = (r() < 0.5 ? -1 : 1) * (2.4 + r() * 10) - (r() < 0.5 ? 4.3 : 0); if (Math.abs(lat + 4.3) < 1.9 || Math.abs(lat) < 2.3) continue;
      const [x, z] = this.world(s, lat); if (inWater(x, z)) continue;
      if (ti < T) { o.position.set(x, 0, z); o.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3); o.scale.set(1, 0.6 + r() * 0.9, 1); o.updateMatrix(); this.tufts.setMatrixAt(ti, o.matrix); c.setHSL(0.24 + r() * 0.06, 0.45, 0.32 + r() * 0.12); this.tufts.setColorAt(ti, c); ti++; }
      else { o.position.set(x, 0.32, z); o.rotation.set(0, 0, 0); o.scale.setScalar(0.8 + r() * 0.6); o.updateMatrix(); this.flowers.setMatrixAt(fi, o.matrix); c.set(['#ffd23f', '#ffffff', '#ff8ab5', '#b58cff', '#ff6b5a'][Math.floor(r() * 5)]); this.flowers.setColorAt(fi, c); fi++; }
    }
    this.scene.add(this.tufts, this.flowers);
  }
  // 가로등: 달리는 길 옆
  buildLights(r) {
    const poles = [], heads = []; for (let s = 10; s < this.L; s += 32) { const [x, z] = this.world(s, -6.6); if (this.inWater(x, z)) continue; poles.push([x, z]); heads.push(x, 4.6, z); }
    const g = new THREE.CylinderGeometry(0.07, 0.1, 4.6, 6); g.translate(0, 2.3, 0);
    const pm = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#6a717b' }), poles.length), o = new THREE.Object3D();
    poles.forEach(([x, z], i) => { o.position.set(x, 0, z); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); }); this.scene.add(pm);
    this.lampGlow = this.glowPoints(heads, '#ffd79a', 3.2);
    this.lampPool = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    // 가로등 불빛 웅덩이: 가까운 몇 개만
    this.pools = []; for (let i = 0; i < 6; i++) { const p = this.lampPool.clone(); p.material = this.lampPool.material; p.rotation.x = -Math.PI / 2; p.scale.setScalar(5); p.renderOrder = -45; this.scene.add(p); this.pools.push(p); }
    this.poleXZ = poles;
    // 길 위 차들 (밤에 불빛 띠)
    const cars = []; for (const rd of this.map.roads) if (rd[0] >= 14 && !rd[1]) { const pts = unpack(rd.slice(2), this.map.scale); if (pts.length > 1) cars.push(pts); }
    this.carLines = cars; const cN = isPhone ? 260 : 600, cp = new Float32Array(cN * 3), cc = new Float32Array(cN * 3);
    this.cars = []; for (let i = 0; i < cN; i++) { const line = cars[Math.floor(r() * cars.length)]; if (!line) break; this.cars.push({ line, t: r(), v: (r() < 0.5 ? 1 : -1) * (0.00004 + r() * 0.00004), seg: 0 }); const cl = this.cars[i].v > 0 ? [1, 0.95, 0.85] : [1, 0.25, 0.2]; cc.set(cl, i * 3); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    this.carPts = new THREE.Points(cg, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, map: this.dot ||= dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })); this.scene.add(this.carPts);
    for (const c of this.cars) { const L = c.line.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - c.line[i - 1][0], p[1] - c.line[i - 1][1]) : 0), 0); c.len = L; c.v *= 3000 / Math.max(L, 50); }
  }
  // 구름 · 비 · 눈 · 벌레 · 반딧불
  buildSkyStuff(r) {
    const tex = cloudTex(); this.clouds = [];
    for (let i = 0; i < 46; i++) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }); const s = new THREE.Sprite(m); const a = r() * 6.28, d = 900 + r() * 5200; s.position.set(Math.cos(a) * d, 420 + r() * 700, Math.sin(a) * d); s.scale.set(900 + r() * 1200, 360 + r() * 380, 1); s.userData = { k: r(), sp: 2 + r() * 4 }; this.scene.add(s); this.clouds.push(s); }
    const RN = isPhone ? 1400 : 3200, rp = new Float32Array(RN * 6); this.rainV = new Float32Array(RN);
    for (let i = 0; i < RN; i++) { const x = (r() - 0.5) * 80, y = r() * 40, z = (r() - 0.5) * 80; rp.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); this.rainV[i] = 24 + r() * 8; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#c8d4e4', transparent: true, opacity: 0.45 })); this.rain.frustumCulled = false; this.scene.add(this.rain);
    const SN = isPhone ? 1200 : 2600, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) sp.set([(r() - 0.5) * 90, r() * 40, (r() - 0.5) * 90], i * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, map: this.dot ||= dotTex(), transparent: true, depthWrite: false })); this.snow.frustumCulled = false; this.scene.add(this.snow);
    // 나비 · 잠자리 (낮) · 반딧불 (여름밤): 내 주변을 맴돈다
    this.bugs = []; const wingG = new THREE.CircleGeometry(0.055, 8); wingG.scale(1.3, 1, 1); wingG.translate(0.07, 0, 0);
    for (let i = 0; i < 14; i++) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true }); const a = new THREE.Mesh(wingG, m), b = new THREE.Mesh(wingG, m); b.rotation.y = Math.PI; g.add(a, b); g.userData = { a, b, m, ph: r() * 6, ox: (r() - 0.5) * 14, oz: (r() - 0.5) * 14, h: 0.5 + r() * 1.2 }; this.scene.add(g); this.bugs.push(g); }
    const FN = 90, fp = new Float32Array(FN * 3); this.ff = []; for (let i = 0; i < FN; i++) this.ff.push({ ox: (r() - 0.5) * 50, oz: (r() - 0.5) * 50, h: 0.3 + r() * 2, ph: r() * 6 });
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#d9ff7a', size: 0.35, map: this.dot ||= dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); this.fireflies.frustumCulled = false; this.scene.add(this.fireflies);
  }
  // 다른 사람들: 마주 오거나 같이 달리는 러너 곰돌이 · 산책하는 할머니와 손자 · 연인
  buildPeople() {
    this.people = []; this.peopleT = 0; this.groups = []; this.groupT = 0;
  }
  // 곰돌이 하나: 털색은 다양하게, 옷은 하는 일 · 계절 · 날씨에 맞게 (dress)
  mkBear(role, r, scale = 1, opt = {}) {
    const b = makeBear({ name: `hg${Math.floor(r() * 1e9)}`, color: opt.fur || FUR[Math.floor(r() * FUR.length)] });
    b.root.scale.setScalar(BEAR * scale); b.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    dress(b, role, r, { season: this.state.season, weather: this.state.weather, ...opt });
    this.scene.add(b.root); return b;
  }
  // 길 위의 사람들: 러너(혼자 · 둘) · 산책(혼자 · 할머니와 손자 · 연인 · 친구들 · 엄마와 아이)
  spawnPerson(kind, s, dir, lat, v, r) {
    const p = { kind, s, dir, lat, v, bears: [], t: r() * 10 };
    const sameTop = r() < 0.5 ? TOPS_CASUAL[Math.floor(r() * TOPS_CASUAL.length)] : null;
    if (kind === 'runner') p.bears.push(this.mkBear('runner', r));
    else if (kind === 'runner2') p.bears.push(this.mkBear('runner', r), this.mkBear('runner', r));
    else if (kind === 'family') p.bears.push(this.mkBear('grandma', r, 0.98, { fur: ['#e8e2d8', '#d9d4cc', '#c9b8a0', '#f4efe6'][Math.floor(r() * 4)] }), this.mkBear('kid', r, 0.62));
    else if (kind === 'parent') p.bears.push(this.mkBear('stroll', r), this.mkBear('kid', r, 0.6));
    else if (kind === 'couple') { p.bears.push(this.mkBear('stroll', r, 1, { top: sameTop }), this.mkBear('stroll', r, 0.95, { top: sameTop })); p.heartT = 2 + r() * 6; }
    else if (kind === 'friends') { const n = 2 + Math.floor(r() * 2); for (let k = 0; k < n; k++) p.bears.push(this.mkBear('stroll', r, 0.95 + r() * 0.1)); }
    else p.bears.push(this.mkBear(r() < 0.3 ? 'office' : 'stroll', r));
    this.people.push(p); return p;
  }
  removePerson(p) { for (const b of p.bears) { this.scene.remove(b.root); b.root.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); }); } if (p.heart) this.scene.remove(p.heart); }
  // ---------- 공원 안쪽: 피크닉 · 캠핑 · 원반 던지기 · 연날리기 · 벤치 · 수다 ----------
  spawnGroup(x, z, r) {
    const st = this.state, wet = st.weather === 'rain' || st.weather === 'snow', cold = st.season === 'winter';
    const kind = ['picnic', 'camp', 'frisbee', 'kite', 'bench', 'chat'][wpick(r, this.crowd().gw)], g = new THREE.Group(), bears = [], rot = r() * 6.28; void wet; void cold;
    g.position.set(x, 0, z); g.rotation.y = rot; this.scene.add(g);
    const put = (b, lx, lz, face, seated) => { this.scene.remove(b.root); g.add(b.root); b.root.position.set(lx, 0, lz); b.root.rotation.y = face; if (seated) { b.setSeated?.(true); b.root.position.y = 0.0; } bears.push(b); return b; };
    const spring = st.season === 'spring' && !wet;
    const who = () => { const x2 = r(); return spring ? (x2 < 0.2 ? 'family' : x2 < 0.4 ? 'friends' : x2 < 0.9 ? 'couple' : 'solo') : x2 < 0.3 ? 'family' : x2 < 0.55 ? 'friends' : x2 < 0.8 ? 'couple' : 'solo'; };
    const rel = who(), n = rel === 'solo' ? 1 : rel === 'couple' ? 2 : 2 + Math.floor(r() * 3);
    const role = () => (rel === 'family' && r() < 0.4 ? 'kid' : 'stroll');
    const mat = (w, d, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: col })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); return m; };
    const data = { kind, g, bears, t: r() * 10 };
    if (kind === 'picnic' || kind === 'camp') {
      const col = ['#ff6b6b', '#4fa3ff', '#ffd23f', '#7be07b', '#ff9ec0', '#ffffff'][Math.floor(r() * 6)];
      const m = mat(3.2, 2.6, col); if (r() < 0.6) { const ck = mat(3.2, 2.6, '#ffffff'); ck.material = new THREE.MeshLambertMaterial({ map: checkTex(col) }); ck.position.y = 0.035; m.visible = false; }
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28; const kid = role() === 'kid'; put(this.mkBear(kid ? 'kid' : 'stroll', r, kid ? 0.6 : 1), Math.cos(a) * 1.1, Math.sin(a) * 0.9, -a - Math.PI / 2, true); }
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.32), new THREE.MeshLambertMaterial({ color: '#c08a4a' })); basket.position.set(0.2, 0.17, 0.1); g.add(basket);
      if (kind === 'camp') {
        const tc = ['#ff8a3d', '#3d9bff', '#7bd35a', '#ffd23f', '#e8e2d6'][Math.floor(r() * 5)];
        const tent = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.9, 4, 1), new THREE.MeshLambertMaterial({ color: tc, flatShading: true })); tent.position.set(-2.8, 0.95, 0.4); tent.rotation.y = Math.PI / 4; g.add(tent);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ color: '#2a2a30' })); door.position.set(-2.8 + 0.9, 0.45, 0.4 + 0.02); door.rotation.y = Math.PI / 2 - 0.1; g.add(door);
        for (let k = 0; k < 2; k++) { const ch = new THREE.Group(), cm = new THREE.MeshLambertMaterial({ color: '#2f5d3a' }); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.45), cm); seat.position.y = 0.42; const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), cm); back.position.set(0, 0.68, -0.22); ch.add(seat, back); ch.position.set(2.2 + k * 0.8, 0, -1.2); g.add(ch); }
        if (cold || st.hour > 18 || st.hour < 6) { const fire = new THREE.PointLight('#ff9a3d', 2.2, 9); fire.position.set(1.4, 0.6, -2); g.add(fire); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' })); fl.position.set(1.4, 0.25, -2); g.add(fl); data.fire = fl; }
      }
    } else if (kind === 'frisbee') {
      const a = put(this.mkBear(r() < 0.5 ? 'stroll' : 'runner', r), -4, 0, Math.PI / 2), b = put(this.mkBear('stroll', r), 4, 0, -Math.PI / 2);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16), new THREE.MeshLambertMaterial({ color: ['#ff3b6b', '#ffd23f', '#3db8ff'][Math.floor(r() * 3)] })); g.add(disc); data.disc = disc; void a; void b;
    } else if (kind === 'kite') {
      const b = put(this.mkBear(r() < 0.5 ? 'kid' : 'stroll', r, r() < 0.5 ? 0.62 : 1), 0, 0, 0); if (rel !== 'solo') put(this.mkBear('stroll', r), 1.2, -0.4, 0);
      const kite = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4, 1), new THREE.MeshLambertMaterial({ color: ['#ff4d6d', '#ffd23f', '#7be07b', '#b57bff'][Math.floor(r() * 4)], side: THREE.DoubleSide })); kite.scale.z = 0.08; kite.position.set(0, 22, 16); g.add(kite); data.kite = kite;
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.9, 0.3, 0, 22, 16], 3)); data.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); g.add(data.line); void b;
    } else if (kind === 'bench') {
      const bm = new THREE.MeshLambertMaterial({ color: '#8a5a34' }), legM = new THREE.MeshLambertMaterial({ color: '#3d4148' });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), bm); seat.position.y = 0.45; const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 0.06), bm); back.position.set(0, 0.75, -0.24); g.add(seat, back);
      for (const sx of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), legM); l.position.set(sx, 0.22, 0); g.add(l); }
      put(this.mkBear(r() < 0.3 ? 'grandma' : 'stroll', r), -0.45, 0.05, 0, true); if (rel !== 'solo') put(this.mkBear('stroll', r), 0.45, 0.05, 0, true);
    } else {
      for (let k = 0; k < Math.max(2, n); k++) { const a = (k / Math.max(2, n)) * 6.28; put(this.mkBear(role(), r, role() === 'kid' ? 0.6 : 1), Math.cos(a) * 0.9, Math.sin(a) * 0.9, -a - Math.PI / 2); }
    }
    this.groups.push(data); return data;
  }
  removeGroup(gd) { this.scene.remove(gd.g); gd.g.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); }); }
  tickGroups(dt, px, pz) {
    const r = this.r; this.groupT -= dt;
    const gk = this.crowd(); if (this.groupT <= 0 && this.groups.length < Math.round((isPhone ? 6 : 12) * gk.groups * Math.min(1.4, gk.k + 0.2))) {
      this.groupT = 0.6 + r() * 1.2;
      // 코스 옆 공원 안쪽 (길에서 14 ~ 90m), 물 · 길 위는 피한다
      const s = clamp(this.s + (r() - 0.3) * 260 * this.dir, 3, this.L - 3), lat = r() < 0.12 ? -(8 + r() * 3) : 14 + r() * 76, [x, z] = this.world(s, lat), d = Math.hypot(x - px, z - pz);
      if (d > 60 && d < 240 && !this.inWater(x, z) && !this.groups.some((q) => Math.hypot(q.g.position.x - x, q.g.position.z - z) < 14)) this.spawnGroup(x, z, r);
    }
    for (const gd of this.groups) {
      gd.t += dt;
      for (const b of gd.bears) b.update(dt, 0, { noCrawl: true });
      if (gd.disc) { const k = (gd.t % 2.4) / 2.4, dir = Math.floor(gd.t / 2.4) % 2 ? -1 : 1; gd.disc.position.set(-4 * dir + 8 * dir * k, 1.0 + Math.sin(k * Math.PI) * 2.2, Math.sin(k * Math.PI) * 0.8); gd.disc.rotation.y += dt * 20; }
      if (gd.kite) { gd.kite.position.set(Math.sin(gd.t * 0.5) * 3, 22 + Math.sin(gd.t * 0.9) * 1.5, 16 + Math.cos(gd.t * 0.4)); gd.kite.rotation.z = Math.sin(gd.t * 0.8) * 0.3; const a = gd.line.geometry.attributes.position; a.setXYZ(1, gd.kite.position.x, gd.kite.position.y, gd.kite.position.z); a.needsUpdate = true; }
      if (gd.fire) gd.fire.scale.set(1, 0.8 + Math.sin(gd.t * 13) * 0.2 + Math.sin(gd.t * 7) * 0.1, 1);
    }
    for (const gd of [...this.groups]) if (Math.hypot(gd.g.position.x - px, gd.g.position.z - pz) > 330) { this.removeGroup(gd); this.groups.splice(this.groups.indexOf(gd), 1); }
  }


  // ---------- 들어가기 · 나가기 ----------
  enter(bear, opt = {}) {
    this.bear = bear; this.prevParent = bear.root.parent; this.scene.add(bear.root);
    this.s = opt.s ?? 30; this.dir = 1; this.lat = -4.3; this.v = 0; this.target = 6.4; this.y = 0; this.vy = 0; this.dist = 0; this.time = 0; this.moments = {}; this.turnT = 0;
    const p0 = this.at(this.s); [this.px, this.pz] = this.world(this.s, this.lat); this.face = Math.atan2(p0.dx, p0.dz); this.camYaw = this.face; this.ri = Math.round(this.s / this.step); this.dragT = 0; this.camInit = false; this.mdx = null;
    bear.root.scale.setScalar(BEAR); bear.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const r = rnd((Date.now() / 1000) | 0);
    if (this.opt.season === 'auto') this.state.season = Object.keys(SEASONS)[Math.floor(r() * 4)];
    if (this.opt.weather === 'auto') this.state.weather = this.randWeather(r);
    if (this.opt.time === 'auto') this.state.hour = [5.8, 8, 10.5, 13, 15.5, 17.6, 18.3, 20, 22, 4.6][Math.floor(r() * 10)];
    this.applySeason(); this.weatherT = 240 + r() * 360; this.r = r;
    for (const p of this.people) this.removePerson(p); this.people = []; for (const gd of this.groups) this.removeGroup(gd); this.groups = []; this.seenLabel = new Set(); this.activeLabels = []; this.regionName = null; this.regionSeen = new Map(); this.jumps = 0; this.flipT = 0;
  }
  leave() { if (this.bear) { this.bear.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); this.bear.root.scale.setScalar(1); this.bear.inner.rotation.set(0, 0, 0); this.bear.inner.position.set(0, 0, 0); } if (this.bear && this.prevParent) this.prevParent.add(this.bear.root); for (const p of this.people) this.removePerson(p); this.people = []; for (const gd of this.groups) this.removeGroup(gd); this.groups = []; this.bear = null; }
  randWeather(r) { const s = this.state.season, x = r(); if (s === 'winter') return x < 0.45 ? 'clear' : x < 0.75 ? 'cloudy' : 'snow'; return x < 0.55 ? 'clear' : x < 0.82 ? 'cloudy' : 'rain'; }
  setOpt(k, v) {
    this.opt[k] = v;
    if (k === 'season' && v !== 'auto') { this.state.season = v; this.applySeason(); }
    if (k === 'weather' && v !== 'auto') this.state.weather = v;
    if (k === 'time' && v !== 'auto') this.state.hour = TIMES[v][1];
  }
  applySeason() {
    const s = this.state.season, r = rnd(4242), c = new THREE.Color(), N = this.trees.length;
    const pal = { spring: ['#ffc6da', '#ffd9e6', '#ffb3cc', '#fff0f5', '#9ccc6a'], summer: ['#3f8a3a', '#4f9a40', '#2f7a34', '#5aa548', '#3a7f40'], autumn: ['#e8742a', '#f2b233', '#c8402a', '#d9902a', '#9aa83a', '#f0c84a'], winter: ['#ffffff'] }[s];
    void N;
    for (const set of this.crownSets) {
      if (!set) continue; const { crowns, idx, pine } = set;
      idx.forEach((si, q) => { if (pine) c.set(['#2f5d3a', '#355f3c', '#2a5233'][si % 3]).offsetHSL(0, 0, s === 'winter' ? 0.04 : 0); else { c.set(pal[Math.floor(r() * pal.length)]); if (s === 'spring' && si % 4 === 3) c.set('#9ccc6a'); } c.offsetHSL(0, 0, (r() - 0.5) * 0.06); crowns.setColorAt(q, c); });
      crowns.instanceColor.needsUpdate = true; crowns.visible = pine || s !== 'winter';
    }
    for (const tw of this.twigSets) tw.visible = s === 'winter';
    const grass = { spring: '#94c470', summer: '#7fb05a', autumn: '#a7a85c', winter: '#a9a58e' }[s];
    this.greenM.grass?.color.set(grass); this.greenM.wild?.color.set(grass).offsetHSL(0, -0.05, -0.03); this.greenM.wood?.color.set({ spring: '#6f9a52', summer: '#4f7f40', autumn: '#a8763a', winter: '#8a8270' }[s]); this.islandM.color.set(grass).offsetHSL(0, 0, -0.06);
    const tc = new THREE.Color(); for (let i = 0; i < this.tufts.count; i++) { tc.setHSL(s === 'autumn' ? 0.13 + r() * 0.04 : s === 'winter' ? 0.12 : 0.24 + r() * 0.06, s === 'winter' ? 0.15 : 0.45, s === 'winter' ? 0.5 : 0.3 + r() * 0.12); this.tufts.setColorAt(i, tc); } this.tufts.instanceColor.needsUpdate = true;
    this.flowers.visible = s === 'spring' || s === 'summer';
  }

  // ---------- 한 프레임 ----------
  //   inp = { lat(-1~1), up(-1~1: 속도), jump }
  update(dt, inp, camera) {
    if (!this.ready || !this.bear) return;
    this.t += dt; this.time += dt;
    const st = this.state;
    // 시간 흐름 (기본: 게임 속 1시간 = 1분)
    if (this.opt.time === 'auto' || this.opt.flow > 0) st.hour = (st.hour + (dt / 60) * (this.opt.flow ?? 1)) % 24;
    // 날씨는 가끔 바뀐다
    if (this.opt.weather === 'auto') { this.weatherT -= dt; if (this.weatherT <= 0) { this.weatherT = 240 + this.r() * 420; st.weather = this.randWeather(this.r); } }
    // 속도 단계: Q · E · +/- 로 고른다. 움직이는 건 누르는 동안만 (W A S D · 조이스틱, 카메라가 보는 쪽 기준)
    if (inp.speedTo != null) { this.target = inp.speedTo; inp.speedTo = null; }
    this.camYaw += inp.yaw || 0; this.camPitch = clamp((this.camPitch ?? 0.32) + (inp.pitch || 0), -0.15, 1.2); if (inp.yaw || inp.pitch) this.dragT = 2.5; this.dragT = Math.max(0, this.dragT - dt);
    const fx0 = Math.sin(this.camYaw), fz0 = Math.cos(this.camYaw);
    let mx = fx0 * (inp.mz || 0) - fz0 * (inp.mx || 0), mz = fz0 * (inp.mz || 0) + fx0 * (inp.mx || 0); const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    // Shift(휴대폰은 💨 버튼)를 누르는 동안 가속: 지금 단계보다 확 빨라진다
    const boost = !!inp.sprint && ml > 0.05, want = Math.min(V_MAX, this.target * Math.min(1, ml) * (boost ? 1.8 : 1) + (boost ? 3 : 0));
    this.v += (want - this.v) * Math.min(1, dt * (want > this.v ? (boost ? 4.5 : 1.8) : 4)); this.boosting = boost;
    let ds = 0;
    if (ml > 0.05) { this.mdx = mx / ml; this.mdz = mz / ml; }
    if (this.v > 0.02 && this.mdx != null) {
      const nx = this.px + this.mdx * this.v * dt, nz = this.pz + this.mdz * this.v * dt;
      const q = this.project(nx, nz);
      const lat = clamp(q.lat, LAT_MIN, LAT_MAX), s2 = clamp(q.s, 2, this.L - 2);
      let [cx, cz] = (lat !== q.lat || s2 !== q.s) ? this.world(s2, lat) : [nx, nz];
      if (this.inWater(cx, cz)) { cx = this.px; cz = this.pz; }
      ds = Math.hypot(cx - this.px, cz - this.pz); this.px = cx; this.pz = cz; this.dist += ds;
      const q2 = this.project(cx, cz); this.s = q2.s; this.lat = q2.lat;
      const tg = this.at(this.s); this.dir = this.mdx * tg.dx + this.mdz * tg.dz >= 0 ? 1 : -1;
      this.face += (((Math.atan2(this.mdx, this.mdz) - this.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 9);
      // 카메라는 손으로 돌린 뒤 잠시 그대로, 그다음 천천히 등 뒤로
      if (this.dragT <= 0 && ml > 0.05) this.camYaw += (((this.face - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 1.2);
    }
    if ((this.s > this.L - 4 || this.s < 4) && !this.endT) { this.endT = 6; this.onTurn?.(this.s < 4 ? '서강대교 쪽 코스 끝' : '63빌딩 쪽 코스 끝'); }
    this.endT = Math.max(0, (this.endT || 0) - dt);
    // 점프 · 2단 점프(공중제비) · 숙이기 (드림 러너와 같은 느낌, 크기에 맞게)
    if (inp.jump) { if (this.y <= 0.001) { this.vy = 5.2; this.jumps = 1; } else if (this.jumps < 2) { this.vy = 4.8; this.jumps = 2; this.flipT = FLIP_T; } }
    this.vy -= 16 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y <= 0) { this.vy = Math.max(0, this.vy); this.jumps = 0; }
    this.flipT = Math.max(0, this.flipT - dt); this.slide = !!inp.slide && this.y <= 0.001;
    if (this.slide) this.v = Math.min(this.v, this.target * 0.75);
    // 순간들 (업적): 노을 · 밤 · 일출 · 비 · 눈 · 계절에 달린 거리
    const h = st.hour, mo = h >= 17.9 && h < 19.4 ? 'sunset' : h >= 5.3 && h < 6.9 ? 'sunrise' : h >= 20.5 || h < 4.2 ? 'night' : null;
    const add = (k) => { this.moments[k] = (this.moments[k] || 0) + ds; };
    if (mo) add(mo); if (st.weather === 'rain') add('rain'); if (st.weather === 'snow') add('snow'); add(st.season);
    // 곰돌이
    const bx = this.px, bz = this.pz;
    this.bear.root.position.set(bx, this.y, bz); this.bear.root.rotation.y = this.face; this.bear.root.visible = true;
    this.bear.inner.rotation.set(0, 0, 0);
    this.bear.update(dt, Math.min(16, this.v * 1.7), { noCrawl: true });
    poseBear(this.bear, { ground: this.y <= 0.001, slide: this.slide, flip: this.flipT > 0 ? 1 - this.flipT / FLIP_T : null, vy: this.vy, alive: true }, dt);
    this.shadow.position.set(bx, 0.02, bz); this.shadow.scale.setScalar(BEAR * (1 - Math.min(0.5, this.y * 0.2)));
    this.tickPeople(dt, bx, bz); this.tickGroups(dt, bx, bz); this.tickLabels(dt, camera, bx, bz);
    this.tickEnv(dt, camera, bx, bz);
    this.tickCamera(dt, camera, bx, bz, Math.sin(this.camYaw), Math.cos(this.camYaw));
  }
  // 사람 수 · 구성: 계절 · 날씨 · 시간에 따라 (벚꽃 철엔 연인이 가득, 비 · 추위 · 한밤엔 드문드문 러너만)
  crowd() {
    const { season, weather, hour: h } = this.state, rain = weather === 'rain', snow = weather === 'snow';
    let k = { clear: 1, cloudy: 0.8, rain: 0.32, snow: 0.45 }[weather] * { spring: 1.35, summer: 1.15, autumn: 1.1, winter: 0.55 }[season];
    k *= h < 5 ? 0.25 : h < 6.5 ? 0.45 : h < 9 ? 0.8 : h < 11 ? 0.85 : h < 17 ? 1 : h < 21 ? 1.25 : h < 23 ? 0.75 : 0.4;
    const night = h >= 21 || h < 6, morning = h >= 5 && h < 9, evening = h >= 17 && h < 21;
    // 길 위 구성 [러너, 둘이 달리기, 할머니와 손자, 엄마와 아이, 연인, 친구, 혼자 산책]
    let w = [4, 1, 1, 1, 1.4, 1.2, 1.4];
    if (morning || night) w = [7, 1.4, 0.3, 0.2, night ? 0.9 : 0.3, night ? 0.5 : 0.3, 1];
    if (season === 'spring' && !rain) { w[4] *= 3.2; w[5] *= 1.5; w[2] *= 1.4; w[3] *= 1.4; }
    if (weather === 'clear' && !night) { w[2] *= 1.5; w[3] *= 1.7; w[4] *= 1.4; w[5] *= 1.7; }
    if (evening) { w[4] *= 1.6; w[5] *= 1.4; }
    if (rain || snow || season === 'winter') { w = [w[0] * 1.3, w[1], w[2] * 0.3, w[3] * 0.3, w[4] * (snow ? 1.2 : 0.6), w[5] * 0.6, w[6] * 0.7]; }
    // 공원 무리 [피크닉, 캠핑, 원반, 연, 벤치, 수다]
    let gw = [3, 1.2, 1, 1, 1, 1.2];
    if (season === 'spring') { gw[0] *= 2; gw[5] *= 1.5; } if (season === 'autumn') { gw[1] *= 2; gw[3] *= 1.5; } if (season === 'summer') { gw[1] *= 1.6; gw[2] *= 1.5; }
    if (night) { gw = [0.6, gw[1] * 1.4, 0.05, 0.05, 0.5, 0.8]; } if (rain || snow) gw = [0, 0.2, 0, 0, 0.6, 1];
    return { k, w, gw, groups: rain ? 0.25 : snow ? 0.4 : season === 'winter' ? 0.5 : night ? 0.45 : 1 };
  }
  tickPeople(dt, px, pz) {
    const r = this.r, cw = this.crowd(), maxP = Math.round((isPhone ? 8 : 14) * Math.min(1.5, cw.k));
    // 주변에 사람이 너무 적으면 앞쪽(보이지 않는 곳)에 새로 놓는다
    this.peopleT -= dt;
    if (this.peopleT <= 0 && this.people.length < Math.max(1, maxP)) {
      this.peopleT = (1.5 + r() * 3) / Math.max(0.25, cw.k);
      const kind = ['runner', 'runner2', 'family', 'parent', 'couple', 'friends', 'stroll'][wpick(r, cw.w)];
      const ahead = this.s + this.dir * (70 + r() * 90);
      if (ahead > 5 && ahead < this.L - 5) {
        if (kind === 'runner' || kind === 'runner2') { const opp = r() < 0.6; this.spawnPerson(kind, ahead, opp ? -this.dir : this.dir, opp ? -3.6 - r() * 1.2 : -4.8 + r() * 1.2, opp ? 2.4 + r() * 1.6 : Math.max(1.6, this.v - 0.6 - r() * 0.8), r); }
        else this.spawnPerson(kind, ahead, r() < 0.5 ? 1 : -1, 3.6 + r() * 5, 0.7 + r() * 0.35, r);
      }
    }
    for (const p of this.people) {
      p.s += p.dir * p.v * dt; p.t += dt;
      const q = this.at(p.s), f = Math.atan2(q.dx * p.dir, q.dz * p.dir);
      p.bears.forEach((b, i) => { const lat = p.lat + i * 0.75 * (p.dir > 0 ? 1 : -1); const [x, z] = this.world(p.s - (i > 1 ? 0.6 : 0) * p.dir, lat); b.root.position.set(x, 0, z); b.root.rotation.y = f; b.update(dt, p.v * 2, { noCrawl: true }); });
      if (p.kind === 'couple') { p.heartT -= dt; if (p.heartT <= 0) { p.heartT = 4 + Math.random() * 6; p.heart ||= heartSprite(); this.scene.add(p.heart); p.heartLife = 1.6; } if (p.heartLife > 0) { p.heartLife -= dt; const b = p.bears[0].root.position; p.heart.position.set(b.x, 1.4 + (1.6 - p.heartLife) * 0.5, b.z); p.heart.material.opacity = Math.min(1, p.heartLife); } }
    }
    for (const p of [...this.people]) { const [x, z] = this.world(p.s, p.lat); if (Math.hypot(x - px, z - pz) > 260 || p.s < 2 || p.s > this.L - 2) { this.removePerson(p); this.people.splice(this.people.indexOf(p), 1); } }
  }
  tickEnv(dt, camera, px, pz) {
    const st = this.state, h = st.hour, sk = skyAt(h), wt = st.weather;
    const cloud = wt === 'clear' ? 0.08 : wt === 'cloudy' ? 0.6 : 0.85;
    this.cloudK = lerp(this.cloudK ?? cloud, cloud, Math.min(1, dt * 0.3));
    const ck = this.cloudK, grey = C(wt === 'snow' ? '#c9ced6' : '#8f969e');
    const dayL = clamp((sk.top.r + sk.top.g + sk.top.b) * 0.9, 0.1, 1);
    sk.top.lerp(grey.clone().multiplyScalar(dayL), ck * 0.75); sk.hor.lerp(grey.clone().multiplyScalar(dayL * 1.1), ck * 0.7);
    // 해 · 달 방향 (해는 동쪽에서 떠서 남쪽을 지나 서쪽으로)
    const th = ((h - 6) / 13) * Math.PI, el = Math.sin(th) * 0.95;
    const sun = new THREE.Vector3(Math.cos(th), el, Math.sin(Math.max(0, Math.min(Math.PI, th))) * 0.55).normalize();
    const mth = ((h - 18.5 + 24) % 24) / 12 * Math.PI, moon = new THREE.Vector3(Math.cos(mth), Math.sin(mth) * 0.85, 0.45).normalize();
    const night = 1 - smooth(-0.12, 0.12, sun.y);
    this.skyU.top.value.copy(sk.top); this.skyU.hor.value.copy(sk.hor); this.skyU.sunDir.value.copy(sun); this.skyU.moonDir.value.copy(moon); this.skyU.night.value = night; this.skyU.cloud.value = ck;
    const sunCol = C('#fff2d6').lerp(C('#ff8a4a'), 1 - smooth(0.05, 0.4, sun.y)); this.skyU.sunCol.value.copy(sunCol);
    this.sky.position.set(camera.position.x, 0, camera.position.z);
    // 빛
    const sunUp = smooth(-0.05, 0.25, sun.y);
    this.sun.position.copy(sun.y > 0.06 ? sun : moon).multiplyScalar(400).add(new THREE.Vector3(px, 0, pz)); this.sun.target.position.set(px, 0, pz);
    this.sun.color.copy(sun.y > -0.05 ? sunCol : C('#9fb4ff')); this.sun.intensity = (sun.y > -0.05 ? 1.9 * sunUp : 0.35) * (1 - ck * 0.55);
    this.hemi.color.copy(sk.top).lerp(C('#ffffff'), 0.35); this.hemi.groundColor.copy(sk.ground); this.hemi.intensity = lerp(0.55, 1.15, sunUp) * (1 - ck * 0.15);
    const fogC = sk.hor.clone().lerp(sk.top, 0.35), fd = wt === 'rain' ? 0.00085 : wt === 'snow' ? 0.0011 : wt === 'cloudy' ? 0.00034 : 0.00022;
    this.scene.fog.color.copy(fogC); this.scene.fog.density = lerp(this.scene.fog.density, fd, Math.min(1, dt * 0.5));
    this.waterU.fogCol.value.copy(fogC); this.waterU.fogD.value = this.scene.fog.density; this.waterU.time.value = this.t; this.waterU.rain.value = lerp(this.waterU.rain.value, wt === 'rain' ? 1 : 0, Math.min(1, dt));
    this.mtM.color.copy(sk.hor).lerp(sk.top, 0.25).multiplyScalar(0.82);
    // 밤: 창문 · 가로등 · 다리 불빛 · 자동차
    const lit = smooth(0.15, 0.8, night);
    for (const m of this.bldM) m.emissiveIntensity = lit * 0.95; if (this.signM) this.signM.emissiveIntensity = lit * 0.9; if (this.farM) this.farM.emissiveIntensity = lit * 0.9;
    this.lampGlow.material.opacity = lit; this.bridgeLights.material.opacity = lit; this.carPts.material.opacity = 0.25 + lit * 0.75;
    this.lampPool.material.opacity = lit * 0.14;
    let pi = 0; for (const [x, z] of this.poleXZ) { if (pi >= this.pools.length) break; if (Math.abs(x - px) < 90 && Math.abs(z - pz) < 90) { this.pools[pi].position.set(x, 0.03, z); this.pools[pi].visible = true; pi++; } } for (; pi < this.pools.length; pi++) this.pools[pi].visible = false;
    // 자동차 불빛
    const cp = this.carPts.geometry.attributes.position;
    for (let i = 0; i < this.cars.length; i++) { const c = this.cars[i]; c.t = (c.t + c.v * dt + 1) % 1; const want = c.t * c.len; let acc = 0, k = 1; const L = c.line; for (; k < L.length; k++) { const d = Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]); if (acc + d >= want) break; acc += d; } k = Math.min(k, L.length - 1); const a = L[k - 1], b = L[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = clamp((want - acc) / d, 0, 1); cp.setXYZ(i, lerp(a[0], b[0], t), 1, lerp(a[1], b[1], t)); }
    cp.needsUpdate = true;
    // 구름
    for (const c of this.clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 6000) c.position.x = -6000; c.material.opacity = clamp((c.userData.k < 0.45 ? 0.16 : 0.02) + ck * 0.85 * (0.6 + c.userData.k * 0.4), 0, 0.92); c.material.color.copy(sk.top).lerp(C('#ffffff'), 0.25 + sunUp * 0.55).lerp(sunCol, (1 - smooth(0.05, 0.35, sun.y)) * sunUp * 0.35); }
    // 비 · 눈: 카메라 둘레 상자 안에서
    const rainOn = wt === 'rain', snowOn = wt === 'snow';
    this.rain.visible = rainOn; this.snow.visible = snowOn;
    if (rainOn) { const a = this.rain.geometry.attributes.position, arr = a.array; for (let i = 0; i < this.rainV.length; i++) { let y = arr[i * 6 + 1] - this.rainV[i] * dt; if (y < 0) y += 40; arr[i * 6 + 1] = y; arr[i * 6 + 4] = y - 0.7; } a.needsUpdate = true; this.rain.position.set(camera.position.x, camera.position.y - 14, camera.position.z); }
    if (snowOn) { const a = this.snow.geometry.attributes.position, arr = a.array; for (let i = 0; i < arr.length; i += 3) { arr[i + 1] -= dt * (0.9 + (i % 7) * 0.08); arr[i] += Math.sin(this.t * 0.7 + i) * dt * 0.3; if (arr[i + 1] < 0) arr[i + 1] += 40; } a.needsUpdate = true; this.snow.position.set(camera.position.x, camera.position.y - 14, camera.position.z); }
    // 겨울 눈 오면 땅이 하얘진다
    const snowy = this.state.season === 'winter' && snowOn; this.snowK = lerp(this.snowK || 0, snowy ? 1 : 0, Math.min(1, dt * 0.05));
    if (this.greenM.grass) { const base = C({ spring: '#94c470', summer: '#7fb05a', autumn: '#a7a85c', winter: '#a9a58e' }[this.state.season]); this.greenM.grass.color.copy(base).lerp(C('#eef2f6'), this.snowK * 0.85); }
    this.landM.color.copy(C('#a3a39f')).lerp(C('#e6eaee'), this.snowK * 0.6);
    // 벌레: 낮엔 나비(봄 · 여름) · 잠자리(가을), 여름밤엔 반딧불
    const day = sunUp > 0.4 && !rainOn && !snowOn, season = this.state.season;
    const bugCol = season === 'autumn' ? '#c8502a' : ['#ffffff', '#ffd23f', '#9fd0ff', '#ff9ec0'];
    this.bugs.forEach((b, i) => {
      const u = b.userData, on = day && season !== 'winter'; b.visible = on; if (!on) return;
      u.ph += dt * (season === 'autumn' ? 30 : 14);
      const x = px + u.ox + Math.sin(this.t * 0.3 + i) * 3, z = pz + u.oz + Math.cos(this.t * 0.27 + i * 2) * 3;
      b.position.set(x, u.h + Math.sin(this.t * 1.7 + i) * 0.25, z); b.rotation.y = this.t * 0.5 + i;
      const flap = Math.sin(u.ph) * (season === 'autumn' ? 0.25 : 1.1); u.a.rotation.z = flap; u.b.rotation.z = -flap;
      u.m.color.set(Array.isArray(bugCol) ? bugCol[i % bugCol.length] : bugCol);
      if (season === 'autumn') { u.a.scale.set(1.8, 0.35, 1); u.b.scale.set(1.8, 0.35, 1); } else { u.a.scale.set(1, 1, 1); u.b.scale.set(1, 1, 1); }
      
    });
    const ffOn = season === 'summer' && night > 0.7 && !rainOn; this.fireflies.material.opacity = lerp(this.fireflies.material.opacity, ffOn ? 1 : 0, Math.min(1, dt));
    if (this.fireflies.material.opacity > 0.01) { const a = this.fireflies.geometry.attributes.position; this.ff.forEach((f, i) => a.setXYZ(i, px + f.ox + Math.sin(this.t * 0.4 + f.ph) * 2, f.h + Math.sin(this.t * 1.3 + f.ph) * 0.4, pz + f.oz + Math.cos(this.t * 0.35 + f.ph) * 2)); a.needsUpdate = true; this.fireflies.material.size = 0.25 + Math.abs(Math.sin(this.t * 2)) * 0.2; }
    this.light = { night, sunUp, hour: h };
  }
  // 카메라: 0 뒤에서 · 1 강 쪽에서 옆으로 · 2 높이서 (드론)
  tickCamera(dt, camera, bx, bz, fx, fz) {
    const k = 1 - Math.exp(-dt * ((this.dragT || 0) > 0 && (this.opt.cam || 0) === 0 ? 14 : 3)), mode = this.opt.cam || 0, y = this.y;
    let cx, cy, cz, lx, ly, lz;
    if (mode === 0) { const pt = this.camPitch ?? 0.32, d = 4.6, hd = Math.cos(pt) * d; cx = bx - fx * hd; cy = 0.8 + Math.sin(pt) * d + y * 0.5; cz = bz - fz * hd; lx = bx + fx * 1.2; ly = 0.75 + y * 0.6; lz = bz + fz * 1.2; }
    else if (mode === 1) { const p = this.at(this.s); cx = bx - p.rx * 6.5 + p.dx * 2; cy = 1.3; cz = bz - p.rz * 6.5 + p.dz * 2; lx = bx; ly = 0.8; lz = bz; }
    else { cx = bx - fx * 26; cy = 22; cz = bz - fz * 26; lx = bx + fx * 30; ly = 0; lz = bz + fz * 30; }
    if (!this.camInit) { camera.position.set(cx, cy, cz); this.camInit = true; }
    camera.position.x += (cx - camera.position.x) * k; camera.position.y += (cy - camera.position.y) * k; camera.position.z += (cz - camera.position.z) * k;
    this.look ||= new THREE.Vector3(lx, ly, lz); this.look.x += (lx - this.look.x) * k; this.look.y += (ly - this.look.y) * k; this.look.z += (lz - this.look.z) * k;
    camera.lookAt(this.look);
    const fov = 56 + clamp(this.v - 6, 0, 18) * 0.8; if (Math.abs(camera.fov - fov) > 0.05 || camera.far < 20000) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.far = 24000; camera.updateProjectionMatrix(); }
  }
  // 이름표: 건물 가까이 처음 오면 건물에 빨간 동그라미 + 선 + 이름 (5초 뒤 사라짐)
  setupLabels() {
    const M = this.map, S = M.scale, best = new Map();
    for (const b of M.buildings) {
      if (b[4] < 0) continue; const name = M.names[b[4]]; if (!name || /^\d|^[A-Z]?\d|동$|주차|창고|화장실|관리|^[가-힣]?\d/.test(name) || name.length < 2) continue;
      const ring = unpack(b.slice(7), S); let x = 0, z = 0; for (const [a, c] of ring) { x += a; z += c; } x /= ring.length; z /= ring.length;
      const famous = /국회|63|IFC|파크원|트윈|타워|센터|호텔|공원|역|교회|성당|방송|KBS|MBC|SBS|증권|금융|빌딩|아파트|레지던스|회관|우체국/.test(name);
      if (b[0] < 30 && !famous) continue;
      const q = this.project0(x, z); if (Math.abs(q.lat) > 650) continue;
      const old = best.get(name); if (!old || old.h < b[0]) best.set(name, { name, x, z, h: b[0] });
    }
    for (const [n, x, z, h] of M.labels || []) best.set(n, { name: n, x: x * S, z: z * S, h });
    this.labels = [...best.values()];
  }
  project0(x, z) { let best = Infinity, bs = 0, bl = 0; for (let i = 0; i < this.rp.length - 1; i += 2) { const a = this.rp[i], d = (a[0] - x) ** 2 + (a[1] - z) ** 2; if (d < best) { best = d; bs = i * this.step; } } const p = this.at(bs); bl = (x - p.x) * p.rx + (z - p.z) * p.rz; return { s: bs, lat: bl }; }
  tickLabels(dt, camera, px, pz) {
    if (!this.labels) this.setupLabels();
    this.activeLabels = (this.activeLabels || []).filter((l) => (l.t += dt) < 5.5);
    if (this.activeLabels.length < 2) {
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      for (const l of this.labels) {
        if (this.seenLabel?.has(l.name)) continue; const dx = l.x - px, dz = l.z - pz, d = Math.hypot(dx, dz), near = 110 + Math.min(260, l.h * 1.2);
        if (d > near) continue; if ((dx * fx + dz * fz) / d < 0.25) continue;
        (this.seenLabel ||= new Set()).add(l.name); this.activeLabels.push({ ...l, t: 0, y: Math.min(l.h * 0.62, 60) }); break;
      }
    }
    // 구역: 이정표(다리 등) 근처 → 이름 있는 공원 · 섬 (작은 곳 먼저)
    let name = null; for (const [n, ms] of this.map.marks || []) if (Math.abs(ms - this.s) < 30) { name = n; break; }
    if (!name) { this.areas ||= (this.map.areas || []).map(([n, ...f]) => ({ n, ring: unpack(f, this.map.scale) })).map((a) => ({ ...a, A: Math.abs(ringArea(a.ring)) })).sort((a, b) => a.A - b.A); for (const a of this.areas) if (inRing(px, pz, a.ring)) { name = a.n; break; } }
    if (name && name !== this.regionName) { const last = this.regionSeen.get(name) || -1e9; if (this.time - last > 90) this.onRegion?.(name); this.regionSeen.set(name, this.time); }
    this.regionName = name || this.regionName;
  }
  // 미니맵: 지도 전체를 한 번 그려 두고, 내 주변만 잘라 보여 준다 (북쪽이 위)
  minimapImage() {
    if (this.mini) return this.mini;
    const N = 1024, R = 2600, k = N / (2 * R), cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), S = this.map.scale;
    const T = (x, z) => [(x + R) * k, (z + R) * k], fillP = (poly, col) => { g.fillStyle = col; g.beginPath(); for (const ring of poly) { ring.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); } g.fill('evenodd'); };
    const line = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); };
    g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, N, N);
    for (const gr of this.map.green) fillP(gr.slice(1).map((r) => unpack(r, S)), '#bfdba4');
    for (const w of this.water) fillP(w, '#8fc4ea'); for (const w of this.islands) fillP(w, '#a9cf8c');
    for (const rd of this.map.roads) line(unpack(rd.slice(2), S), '#ffffff', Math.max(1, rd[0] * k));
    for (const b of this.map.bridges) line(unpack(b.p, S), '#8c8c8c', Math.max(1.5, b.w * k));
    for (const b of this.map.buildings) fillP([unpack(b.slice(7), S)], b[0] > 60 ? '#a9a39a' : '#cfc8bd');
    line(this.rp, '#ff4d6d', 3);
    return (this.mini = cv);
  }
  drawMinimap(ctx, size, span = 700) {
    const img = this.minimapImage(), N = img.width, R = 2600, k = N / (2 * R), cx = (this.px + R) * k, cz = (this.pz + R) * k, w = span * k;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, 7); ctx.clip();
    ctx.drawImage(img, cx - w / 2, cz - w / 2, w, w, 0, 0, size, size);
    const m = size / span, c = size / 2;
    ctx.fillStyle = 'rgba(30,30,40,.9)'; ctx.font = `bold ${Math.round(size / 15)}px sans-serif`; ctx.textAlign = 'center';
    for (const [n, ms] of this.map.marks || []) { const p = this.at(ms), x = c + (p.x - this.px) * m, y = c + (p.z - this.pz) * m; if (x > 8 && x < size - 8 && y > 8 && y < size - 8) ctx.fillText(n, x, y - 4); }
    for (const p of this.people) { const [x0, z0] = this.world(p.s, p.lat), x = c + (x0 - this.px) * m, y = c + (z0 - this.pz) * m; ctx.fillStyle = p.kind.startsWith('runner') ? '#ffffff' : '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
    // 보는 쪽 부채꼴 · 나
    ctx.translate(c, c); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(0, 0); const ya = Math.atan2(Math.cos(this.camYaw), Math.sin(this.camYaw)); ctx.arc(0, 0, size * 0.32, ya - 0.5, ya + 0.5); ctx.closePath(); ctx.fill();
    ctx.rotate(-this.face + Math.PI); ctx.fillStyle = '#ff2d55'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // 큰 지도: 코스 둘레를 보여 주고, 누른 곳 → 코스 안 가장 가까운 자리
  mapBounds() { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of this.rp) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } const pad = 260, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.max(x1 - x0, z1 - z0) / 2 + pad; return { cx, cz, half }; }
  drawBigMap(ctx, size, pick) {
    const img = this.minimapImage(), N = img.width, R = 2600, k = N / (2 * R), B = this.mapBounds(), sx = (B.cx - B.half + R) * k, sz = (B.cz - B.half + R) * k, w = B.half * 2 * k, m = size / (B.half * 2);
    const T = (x, z) => [(x - (B.cx - B.half)) * m, (z - (B.cz - B.half)) * m];
    ctx.clearRect(0, 0, size, size); ctx.drawImage(img, sx, sz, w, w, 0, 0, size, size);
    ctx.font = `bold ${Math.round(size / 34)}px sans-serif`; ctx.textAlign = 'center';
    for (const [n, ms] of this.map.marks || []) { const p = this.at(ms), [x, y] = T(p.x, p.z); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x - ctx.measureText(n).width / 2 - 5, y - 26, ctx.measureText(n).width + 10, 20); ctx.fillStyle = '#1a1a2a'; ctx.fillText(n, x, y - 11); ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    if (this.px != null) { const [x, y] = T(this.px, this.pz); ctx.fillStyle = '#2f80ed'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.stroke(); }
    if (pick) { const [x, y] = T(pick.x, pick.z); ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke(); ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  }
  // 큰 지도에서 누른 곳 (0~1) → 코스 안 자리
  pickAt(u, v) {
    const B = this.mapBounds(), x = B.cx - B.half + u * B.half * 2, z = B.cz - B.half + v * B.half * 2;
    let best = Infinity, bi = 0; for (let i = 0; i < this.rp.length; i++) { const d = (this.rp[i][0] - x) ** 2 + (this.rp[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } }
    const s = clamp(bi * this.step, 4, this.L - 4), p = this.at(s); let lat = clamp((x - p.x) * p.rx + (z - p.z) * p.rz, LAT_MIN, LAT_MAX);
    let [wx, wz] = this.world(s, lat); for (let t = 0; t < 12 && this.inWater(wx, wz); t++) { lat += 2; [wx, wz] = this.world(s, lat); }
    return { s, lat, x: wx, z: wz };
  }
  // 순간 이동: 그 자리에서 다시 시작 (주변 사람들은 새로)
  teleport(s, lat) {
    this.s = clamp(s, 4, this.L - 4); this.lat = clamp(lat, LAT_MIN, LAT_MAX); [this.px, this.pz] = this.world(this.s, this.lat); this.ri = Math.round(this.s / this.step);
    const p = this.at(this.s); this.face = Math.atan2(p.dx, p.dz); this.camYaw = this.face; this.camInit = false; this.v = 0; this.mdx = null;
    for (const q of this.people) this.removePerson(q); this.people = []; for (const gd of this.groups) this.removeGroup(gd); this.groups = []; this.regionName = null;
  }
  // 지금 위치 설명: 다음 이정표까지
  where() {
    const marks = this.map.marks || [], s = this.s, d = this.dir;
    const next = d > 0 ? marks.find(([, ms]) => ms > s + 5) : [...marks].reverse().find(([, ms]) => ms < s - 5);
    return next ? `${next[0]}까지 ${Math.round(Math.abs(next[1] - s))}m` : d > 0 ? `반환점까지 ${Math.round(this.L - s)}m` : `반환점까지 ${Math.round(s)}m`;
  }
}

// ---------- 곰돌이 소품 ----------
function mergeGeos(list) {
  const P = [], N = [], I = []; let base = 0;
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); I.push(base + i); } base += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I); return g;
}
// 털색: 갈색 · 흰색 · 검정만이 아니라 여러 색 젤리곰
const FUR = ['#f4efe6', '#2a2a30', '#8a5634', '#b07a4a', '#d9d4cc', '#c98b5a', '#6b4a2f', '#e8c49a', '#9c9c9c', '#ffd9e6', '#cde7ff', '#d8f5c8', '#fff1b8', '#e0c8ff', '#ff9f9f', '#7fd3c0', '#ff4d5e', '#ff9a2e', '#ffd93b', '#7be04a', '#ff7eb6', '#b57bff', '#4fc3ff', '#f3f6ff'];
const TOPS_CASUAL = ['#ffffff', '#1f2a44', '#e8dcc4', '#8a8f98', '#6b7a4a', '#f2b8c6', '#9fc8ee', '#2a2a2a', '#d9a441', '#b23a48', '#4a7c59', '#c9b8e8'];
const TOPS_SPORT = ['#c8ff3a', '#ff5a1f', '#ff2d87', '#18d6ff', '#111111', '#ffffff', '#2f6bff', '#ffd200', '#7c3aed'];
const BOTTOMS_CASUAL = ['#4a6a9a', '#2a3550', '#1d1d1f', '#c8b48a', '#8a8f98', '#e8e2d6', '#6b5a48'];
const BOTTOMS_SPORT = ['#111111', '#1f2a44', '#2a2a2a', '#3a3f4a'];
const SHOES = ['#ffffff', '#ff5a1f', '#18d6ff', '#111111', '#c8ff3a', '#ff2d87', '#e8e2d6'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const wpick = (r, w) => { let t = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; } return w.length - 1; };
const TOON = new Map(); const mat = (c) => { if (!TOON.has(c)) TOON.set(c, new THREE.MeshLambertMaterial({ color: c })); return TOON.get(c); };
// 공 껍질 일부(위 theta0 ~ theta1)를 몸 · 다리 · 팔에 입힌다
function shell(parent, c, pos, rad, t0, t1) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, t0 * Math.PI, (t1 - t0) * Math.PI), mat(c)); m.material.side = THREE.DoubleSide; m.position.set(...pos); m.scale.set(...rad); parent.add(m); return m; }
// 옷 입히기: role = runner · stroll(사복) · office(셔츠) · grandma · kid · couple 은 stroll + 같은 윗옷
function dress(b, role, r, env = {}) {
  const torso = b.torso, head = b.head, legs = b.legs || [], arms = (b.arms || []).slice(0, 2); if (!torso || !head) return;
  const season = env.season || 'spring', wet = env.weather === 'rain', cold = season === 'winter', hot = season === 'summer';
  const sportKit = role === 'runner' && r() < 0.7;
  let top = env.top || (sportKit ? pick(r, TOPS_SPORT) : pick(r, TOPS_CASUAL)), bottom = sportKit ? pick(r, BOTTOMS_SPORT) : pick(r, BOTTOMS_CASUAL);
  let topKind = 'tee', sleeve = hot ? 'short' : 'long', bottomKind = 'pants', hat = null;
  if (role === 'runner') { topKind = sportKit ? (hot ? (r() < 0.5 ? 'tank' : 'tee') : cold ? 'jacket' : 'tee') : (r() < 0.5 ? 'hoodie' : 'tee'); sleeve = topKind === 'tank' ? 'none' : hot || (!cold && r() < 0.5) ? 'short' : 'long'; bottomKind = sportKit && !cold && r() < 0.7 ? 'shorts' : 'pants'; hat = sportKit ? (r() < 0.4 ? 'band' : r() < 0.5 ? 'cap' : null) : r() < 0.3 ? 'cap' : null; if (cold) hat = r() < 0.6 ? 'beanie' : hat; if (wet) { topKind = 'jacket'; hat = 'cap'; } }
  else if (role === 'office') { top = pick(r, ['#ffffff', '#dfe8f5', '#f2efe6']); topKind = cold ? 'coat' : 'tee'; if (cold) top = pick(r, ['#2a2a2a', '#5a4a3a', '#3a4458']); sleeve = 'long'; bottom = pick(r, ['#1d1d1f', '#2a3550', '#3a3a3a']); }
  else if (role === 'grandma') { top = pick(r, ['#a86a8a', '#7a8a6a', '#c9a27a', '#8a6aa8', '#b85a5a']); topKind = cold ? 'padding' : 'cardigan'; sleeve = 'long'; bottomKind = r() < 0.5 ? 'skirt' : 'pants'; bottom = pick(r, ['#4a3a4a', '#6b5a48', '#2a3550']); hat = cold ? 'beanie' : hot ? 'sunhat' : 'bucket'; }
  else if (role === 'kid') { top = pick(r, ['#ffd23f', '#ff6b6b', '#4fa3ff', '#7be07b', '#ff9ec0', '#ffffff']); topKind = cold ? 'padding' : 'tee'; bottomKind = hot ? 'shorts' : 'pants'; bottom = pick(r, ['#4a6a9a', '#2a3550', '#e85a5a']); hat = cold ? 'beanie' : r() < 0.6 ? 'cap' : null; }
  else { topKind = cold ? (r() < 0.6 ? 'padding' : 'coat') : hot ? 'tee' : pick(r, ['tee', 'hoodie', 'cardigan', 'shirt']); sleeve = hot ? 'short' : 'long'; bottomKind = hot && r() < 0.4 ? 'shorts' : r() < 0.2 ? 'skirt' : 'pants'; hat = cold ? (r() < 0.5 ? 'beanie' : null) : hot && r() < 0.35 ? (r() < 0.5 ? 'cap' : 'sunhat') : r() < 0.15 ? 'bucket' : null; if (cold) top = env.top || pick(r, ['#1d1d1f', '#3a4458', '#e8e2d6', '#6b2a35', '#2f4a3a', '#c9a27a']); }
  // 윗옷
  const body = [0, 1.02, 0], R = [0.585, 0.69, 0.495];
  const span = { tank: [0.34, 0.8], tee: [0.3, 0.8], shirt: [0.28, 0.8], hoodie: [0.24, 0.84], cardigan: [0.28, 0.86], jacket: [0.24, 0.84], coat: [0.24, 0.96], padding: [0.2, 0.9] }[topKind];
  const puff = topKind === 'padding' ? 1.09 : topKind === 'coat' ? 1.04 : 1;
  shell(torso, top, body, R.map((v) => v * puff), span[0], span[1]);
  if (topKind === 'shirt' || role === 'office') { const col = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 16), mat('#ffffff')); col.rotation.x = Math.PI / 2; col.position.set(0, 1.56, 0.05); torso.add(col); }
  if (topKind === 'cardigan' || topKind === 'coat') { const z = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.02), mat('#2a2a2a')); z.position.set(0, 1.1, 0.5 * puff); torso.add(z); }
  if (topKind === 'padding') for (let k = 0; k < 3; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 6, 20), mat(shadeHex(top, 0.8))); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.82, 1); band.position.y = 0.82 + k * 0.22; torso.add(band); }
  if (topKind === 'hoodie') { shell(torso, top, [0, 1.55, -0.28], [0.42, 0.32, 0.22], 0, 0.55); }
  if (sleeve !== 'none') for (const a of arms) shell(a, top, [0, -0.2, 0], [0.17 * puff, 0.29, 0.17 * puff], 0, sleeve === 'short' ? 0.42 : 0.88);
  // 아랫옷 · 신발
  if (bottomKind === 'skirt') { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.62, 0.42, 16, 1, true), mat(bottom)); sk.material.side = THREE.DoubleSide; sk.position.y = 0.58; torso.add(sk); }
  else { shell(torso, bottom, body, R.map((v) => v * 1.01), 0.78, 0.97); for (const l of legs) shell(l, bottom, [0, -0.3, 0.02], [0.225, 0.35, 0.225], 0, bottomKind === 'shorts' ? 0.42 : 0.86); }
  const shoe = role === 'runner' || role === 'kid' ? pick(r, SHOES) : role === 'office' ? '#1d1410' : pick(r, ['#ffffff', '#1d1d1f', '#8a6a4a', '#e8e2d6']);
  for (const l of legs) { const s2 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(shoe)); s2.scale.set(0.215, 0.1, 0.26); s2.position.set(0, -0.6, 0.08); l.add(s2); }
  // 모자 · 소품
  if (hat === 'band') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.06, 6, 18), mat(pick(r, ['#ffffff', '#ff3b6b', '#111111', '#2fd3ff', '#c8ff3a']))); band.rotation.x = Math.PI / 2; band.position.y = 0.2; head.add(band); }
  if (hat === 'cap' || hat === 'bucket' || hat === 'beanie' || hat === 'sunhat') {
    const hc = hat === 'beanie' ? pick(r, ['#b23a48', '#1f2a44', '#e8dcc4', '#4a7c59', '#ff9a2e']) : hat === 'sunhat' ? '#e8d4a8' : pick(r, ['#ffffff', '#111111', '#1f2a44', '#e8dcc4', '#ff5a1f', '#6b7a4a']);
    shell(head, hc, [0, 0.12, 0], [0.5, 0.5, 0.5], 0, 0.42);
    if (hat === 'cap') { const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12, 1, false, -Math.PI / 2, Math.PI), mat(hc)); brim.position.set(0, 0.32, 0.38); head.add(brim); }
    if (hat === 'bucket' || hat === 'sunhat') { const br = new THREE.Mesh(new THREE.CylinderGeometry(hat === 'sunhat' ? 0.78 : 0.6, hat === 'sunhat' ? 0.78 : 0.6, 0.03, 20), mat(hc)); br.position.y = 0.3; head.add(br); }
    if (hat === 'beanie') { const pom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat('#ffffff')); pom.position.y = 0.66; head.add(pom); }
  }
  if (cold && r() < 0.6 && role !== 'runner') { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.09, 8, 18), mat(pick(r, ['#b23a48', '#e8dcc4', '#2f4a3a', '#ffd23f']))); sc.rotation.x = Math.PI / 2; sc.position.y = 1.62; torso.add(sc); }
  if (role === 'runner' && r() < 0.5) for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat('#ffffff')); e.position.set(sx * 0.48, 0.02, 0.05); head.add(e); }
  if ((role === 'stroll' || role === 'office') && r() < 0.35) { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.18), mat(pick(r, ['#1d1d1f', '#8a6a4a', '#e8e2d6', '#4a6a9a']))); bag.position.set(0, 1.05, -0.55); torso.add(bag); }
  if (wet && role !== 'runner') { const u = new THREE.Group(), uc = pick(r, ['#ff4d6d', '#2f6bff', '#ffd23f', '#1d1d1f', '#7be07b', '#ffffff']); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), mat('#3a3a3a')); pole.position.y = 0.85; const can = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.45, 10, 1, true), mat(uc)); can.material.side = THREE.DoubleSide; can.position.y = 1.75; u.add(pole, can); u.position.set(0.45, 0.85, 0.1); b.root.children[0]?.add?.(u) ?? b.root.add(u); }
}
function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }
function checkTex(col) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? col : '#ffffff'; g.fillRect(i * 16, j * 16, 16, 16); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function heartSprite() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.font = '52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💗', 32, 36); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); s.scale.set(0.6, 0.6, 1); return s; }
