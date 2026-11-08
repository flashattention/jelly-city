// 🌉 한강 러닝: 실제 한강 지도(OSM)로 만든 힐링 러닝 맵
//   장애물 · 탈락 없음. 스스로 속도를 정해 달리고(저절로 빨라지지 않는다), 하늘 · 계절 · 날씨 · 사람들을 보며 쉬는 곳
//   지도 데이터: public/dream-runner/hangang/<코스>.json (tools/hangang-map.mjs 로 만든다 · © OpenStreetMap contributors)
//   좌표: x = 동쪽, z = 남쪽 (미터, 코스 중심이 원점)
import * as THREE from 'three';
import { makeBear } from './runner.js';
import { isPhone } from '../../shared/js/perf.js';

export const SEASONS = { spring: '🌸 봄', summer: '🌿 여름', autumn: '🍁 가을', winter: '❄️ 겨울' };
export const WEATHERS = { clear: '☀️ 맑음', cloudy: '☁️ 구름', rain: '🌧️ 비', snow: '🌨️ 눈' };
export const TIMES = { sunrise: ['🌅 일출', 5.9], day: ['🌤️ 낮', 11.5], sunset: ['🌇 노을', 18.4], night: ['🌙 밤', 21.5], dawn: ['🌌 새벽', 4.4] };
export const SPEEDS = [['🚶 걷기', 1.4], ['🏃 조깅', 2.6], ['🏃 러닝', 3.4], ['💨 빠르게', 4.3], ['⚡ 전력', 5.6]];
export const V_MIN = 1.0, V_MAX = 6.2;

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
function fillGeo(polys, y = 0) {
  const pos = [], idx = [];
  for (const poly of polys) {
    const outer = poly[0], holes = poly.slice(1);
    if (outer.length < 3) continue;
    const v2 = (r) => r.map(([x, z]) => new THREE.Vector2(x, z));
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(v2(outer), holes.map(v2)); } catch { continue; }
    const base = pos.length / 3, all = [...outer, ...holes.flat()];
    for (const [x, z] of all) pos.push(x, y, z);
    for (const t of tris) idx.push(base + t[0], base + t[1], base + t[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
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
    const land = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000), flatMat('#a3a39f', -60)); land.rotation.x = -Math.PI / 2; land.renderOrder = -60; land.material.depthTest = true; land.material.depthWrite = true; sc.add(land); this.landM = land.material;
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
    const wMesh = new THREE.Mesh(fillGeo(this.water), waterM); wMesh.renderOrder = -55; sc.add(wMesh);
    // 섬 · 녹지 (계절마다 색이 바뀐다)
    this.islandM = flatMat('#7fa860', -54); const isl = new THREE.Mesh(fillGeo(this.islands), this.islandM); isl.renderOrder = -54; sc.add(isl);
    const greens = { grass: [], wood: [], wild: [], pitch: [], sand: [] };
    for (const g of M.green) (greens[g[0]] || greens.grass).push(g.slice(1).map(P2));
    this.greenPolys = [...greens.grass, ...greens.wood, ...greens.wild];
    this.greenM = {};
    for (const [k, col, o] of [['grass', '#8db86a', -53], ['wild', '#94a96a', -52.5], ['wood', '#5f8a4a', -52], ['pitch', '#6aa860', -51.5], ['sand', '#d9c79a', -51]]) {
      if (!greens[k].length) continue; const m = flatMat(col, o); this.greenM[k] = m; const me = new THREE.Mesh(fillGeo(greens[k]), m); me.renderOrder = o; sc.add(me);
    }
    // 길 · 철길
    { const P = [], I = []; for (const rd of M.roads) { if (rd[1]) continue; ribbonInto(P, I, P2(rd.slice(2)), rd[0], 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#6f7173', -50)); m.renderOrder = -50; sc.add(m); this.roadM = m.material; }
    { const P = [], I = []; for (const rl of M.rails) ribbonInto(P, I, P2(rl), 4, 0); const m = new THREE.Mesh(geoOf(P, I), flatMat('#5d5650', -49.5)); m.renderOrder = -49.5; sc.add(m); }
    { const P = [], I = []; for (const pa of M.paths) { if (pa[0]) continue; ribbonInto(P, I, P2(pa.slice(2)), pa[1], 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#c9c0ae', -49)); m.renderOrder = -49; sc.add(m); this.pathM = m.material; }
    // 달리는 길: 자전거길(짙은 아스팔트) + 강 쪽 산책 · 러닝 길(붉은 우레탄)
    {
      const ln = (lat, w, col, o) => { const P = [], I = []; ribbonInto(P, I, this.rp.map((_, i) => this.world(i * this.step, lat)), w, 0); const m = new THREE.Mesh(geoOf(P, I), flatMat(col, o)); m.renderOrder = o; sc.add(m); return m.material; };
      ln(-1.2, 15, '#8db86a', -48.5);
      this.bikeM = ln(0, 4.2, '#4a4f57', -48); this.runM = ln(-4.3, 3.2, '#b0705e', -47.8);
      const P = [], I = []; for (let s = 0; s < this.L - 3; s += 6) { const seg = [this.world(s, 0), this.world(s + 3, 0)]; ribbonInto(P, I, seg, 0.15, 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#f2c53d', -47.5)); m.renderOrder = -47.5; sc.add(m);
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
    const rails = [];
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
      if (b.rail) rails.push({ fine, ys, w: b.w });
      for (let i = 0; i < fine.length; i += 4) { if (anyWet && wet[i]) piers.push([fine[i][0], fine[i][1], ys[i], b.w]); else if (!anyWet && i % 8 === 0) piers.push([fine[i][0], fine[i][1], ys[i], b.w * 0.6]); }
      if (anyWet) for (let i = 0; i < fine.length; i += 3) { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1; for (const sgn of [-1, 1]) lamps.push(fine[i][0] - dz / L * b.w / 2 * sgn, ys[i] + 1.2, fine[i][1] + dx / L * b.w / 2 * sgn); }
    }
    const dm = new THREE.MeshLambertMaterial({ color: '#9a9a96' }), sm = new THREE.MeshLambertMaterial({ color: '#7d7f84', side: THREE.DoubleSide });
    this.scene.add(new THREE.Mesh(geoOf(deck.P, deck.I), dm), new THREE.Mesh(geoOf(side.P, side.I), sm));
    // 교각
    const pg = new THREE.BoxGeometry(1, 1, 1), pm = new THREE.MeshLambertMaterial({ color: '#8a8a86' }), pi = new THREE.InstancedMesh(pg, pm, piers.length), o = new THREE.Object3D();
    piers.forEach(([x, z, y, w], i) => { o.position.set(x, y / 2 - 0.8, z); o.scale.set(Math.min(w * 0.55, 9), y, 2.2); o.rotation.y = 0; o.updateMatrix(); pi.setMatrixAt(i, o.matrix); }); this.scene.add(pi);
    // 철교: 트러스 (선)
    const tP = []; for (const { fine, ys, w } of rails) for (let i = 1; i < fine.length; i++) { const a = fine[i - 1], c = fine[i], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2; for (const sgn of [-1, 1]) { const ax = a[0] + nx * sgn, az = a[1] + nz * sgn, cx = c[0] + nx * sgn, cz = c[1] + nz * sgn, y0 = ys[i - 1], y1 = ys[i]; tP.push(ax, y0, az, cx, y1 + 7, cz, ax, y0 + 7, az, cx, y1 + 7, cz, ax, y0, az, ax, y0 + 7, az); } }
    if (tP.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tP, 3)); this.scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#4d5560' }))); }
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

  // 건물: 실제 외곽선 · 높이. 벽에 창문 무늬, 밤에는 창에 불이 켜진다
  buildBuildings(P2) {
    const M = this.map, KIND = ['#d9d6cf', '#ece6da', '#b9c0c8', '#d8d2c4', '#d9c3a5', '#d7c9b0', '#cdbfb0', '#9aa0a6', '#c9c2b6', '#b4b4ae'];
    const sets = [{ P: [], N: [], U: [], Cl: [], I: [] }, { P: [], N: [], U: [], Cl: [], I: [] }], domes = [];
    const col = new THREE.Color(), roofC = new THREE.Color(), r = rnd(99);
    const named = (i) => (i >= 0 ? M.names[i] : '');
    for (const b of M.buildings) {
      const [h, mh, km, ci, ni, rci, dome] = b, kind = km >> 1, glassTag = km & 1, ring = P2(b.slice(7)); if (ring.length < 3) continue;
      const name = named(ni), glass = glassTag || (kind === 2 && h > 45);
      const set = sets[glass ? 1 : 0];
      try { col.set(ci >= 0 ? M.colors[ci] : KIND[kind] || KIND[0]); } catch { col.set(KIND[kind] || KIND[0]); }
      if (ci < 0) col.offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.06, (r() - 0.5) * 0.08);
      if (/63/.test(name) || (ci >= 0 && /gold/i.test(M.colors[ci]))) col.set('#e0b54a');
      if (/파크원/.test(name)) col.set('#9aa6b0');
      try { roofC.set(rci >= 0 ? M.colors[rci] : '#8d8b86'); } catch { roofC.set('#8d8b86'); }
      if (glass) roofC.copy(col).multiplyScalar(0.7);
      const s = ringArea(ring) > 0 ? 1 : -1, base = () => set.P.length / 3;
      let acc = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.05) continue;
        const nx = (s > 0 ? dz : -dz) / L, nz = (s > 0 ? -dx : dx) / L, k = base();
        set.P.push(a[0], mh, a[1], c[0], mh, c[1], c[0], h, c[1], a[0], h, a[1]);
        for (let q = 0; q < 4; q++) { set.N.push(nx, 0, nz); set.Cl.push(col.r, col.g, col.b); }
        const u0 = acc / 25.6, u1 = (acc + L) / 25.6, v0 = mh / 26.4, v1 = h / 26.4; acc += L;
        set.U.push(u0, v0, u1, v0, u1, v1, u0, v1);
        // 바깥을 보게 감는다
        if (s < 0) set.I.push(k, k + 1, k + 2, k, k + 2, k + 3); else set.I.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
      let tris; try { tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []); } catch { tris = []; }
      const k = base(); for (const [x, z] of ring) { set.P.push(x, h, z); set.N.push(0, 1, 0); set.U.push(0.005, 0.005); set.Cl.push(roofC.r, roofC.g, roofC.b); }
      for (const t of tris) { const [A, B, Cc] = t.map((v) => ring[v]); const up = (B[1] - A[1]) * (Cc[0] - A[0]) - (B[0] - A[0]) * (Cc[1] - A[1]); if (up > 0) set.I.push(k + t[0], k + t[1], k + t[2]); else set.I.push(k + t[0], k + t[2], k + t[1]); }
      if (dome || /국회의사당$/.test(name)) { let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; domes.push([cx, h, cz, /국회/.test(name) ? 32 : Math.sqrt(Math.abs(ringArea(ring))) / 3]); }
    }
    this.winTex = [windowTex(false, false, 3), windowTex(true, false, 5)]; this.litTex = [windowTex(false, true, 11), windowTex(true, true, 13)];
    this.bldM = sets.map((st, i) => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: this.winTex[i], emissive: '#ffffff', emissiveMap: this.litTex[i], emissiveIntensity: 0 });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(st.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(st.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(st.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(st.Cl, 3)); g.setIndex(st.I);
      this.scene.add(new THREE.Mesh(g, m)); return m;
    });
    const dm = new THREE.MeshLambertMaterial({ color: '#7f9e8e' });
    for (const [x, y, z, rad] of domes) { const d = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dm); d.scale.y = 0.62; d.position.set(x, y, z); this.scene.add(d); }
  }
  // 멀리: 높은 건물 상자들 (실제 위치) · 남산타워 · 산 능선
  buildFar() {
    const M = this.map, S = M.scale, n = (M.tall || []).length;
    if (n) {
      const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 6);
      const m = new THREE.MeshLambertMaterial({ map: this.winTex[0], emissive: '#ffffff', emissiveMap: this.litTex[0], emissiveIntensity: 0 });
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
    const crownG = new THREE.IcosahedronGeometry(2.1, 0); crownG.scale(1, 0.9, 1);
    const trunkG = new THREE.CylinderGeometry(0.16, 0.28, 3.2, 6); trunkG.translate(0, 1.6, 0);
    // 겨울 가지: 줄기 끝에서 뻗는 잔가지 몇 개
    const twigs = []; for (let k = 0; k < 6; k++) { const g = new THREE.CylinderGeometry(0.04, 0.09, 2.2, 4); g.translate(0, 1.1, 0); g.rotateZ(0.55 + (k % 3) * 0.2); g.rotateY((k / 6) * Math.PI * 2); g.translate(0, 2.9, 0); twigs.push(g); }
    const twigG = mergeGeos(twigs);
    const N = spots.length, o = new THREE.Object3D();
    this.crowns = new THREE.InstancedMesh(crownG, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), N);
    this.trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: '#6b5444' }), N);
    this.twigs = new THREE.InstancedMesh(twigG, new THREE.MeshLambertMaterial({ color: '#5a4636' }), N);
    spots.forEach(([x, z, k], i) => { o.position.set(x, 0, z); o.rotation.set(0, r() * 6.28, 0); o.scale.setScalar(k); o.updateMatrix(); this.trunks.setMatrixAt(i, o.matrix); this.twigs.setMatrixAt(i, o.matrix); o.position.y = 3.5 * k + 1.3; o.scale.set(k * (0.9 + r() * 0.3), k * (0.85 + r() * 0.35), k * (0.9 + r() * 0.3)); o.updateMatrix(); this.crowns.setMatrixAt(i, o.matrix); });
    this.scene.add(this.crowns, this.trunks, this.twigs); this.treeSeed = r;
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
    this.people = []; this.peopleT = 0;
  }
  spawnPerson(kind, s, dir, lat, v, r) {
    const fur = ['#f4efe6', '#2a2a30', '#8a5634', '#b07a4a', '#d9d4cc'][Math.floor(r() * 5)];
    const mk = (color, scale = 1, gear = null) => {
      const b = makeBear({ name: `hg${Math.floor(r() * 1e6)}`, color });
      b.root.scale.setScalar(scale);
      if (gear) addGear(b, gear, r);
      this.scene.add(b.root); return b;
    };
    const p = { kind, s, dir, lat, v, bears: [], t: r() * 10 };
    if (kind === 'runner') p.bears.push(mk(fur, 1, 'run'));
    else if (kind === 'family') { p.bears.push(mk('#e8e2d8', 1, 'grandma'), mk(fur, 0.62, 'kid')); }
    else if (kind === 'couple') { p.bears.push(mk(fur, 1, 'couple'), mk(['#f4efe6', '#8a5634', '#c9a27a'][Math.floor(r() * 3)], 0.95, 'couple2')); p.heartT = 2 + r() * 6; }
    this.people.push(p); return p;
  }
  removePerson(p) { for (const b of p.bears) { this.scene.remove(b.root); b.root.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); }); } if (p.heart) this.scene.remove(p.heart); }

  // ---------- 들어가기 · 나가기 ----------
  enter(bear, opt = {}) {
    this.bear = bear; this.prevParent = bear.root.parent; this.scene.add(bear.root);
    this.s = opt.s ?? 30; this.dir = 1; this.lat = -4.3; this.v = 2.6; this.target = 2.6; this.y = 0; this.vy = 0; this.dist = 0; this.time = 0; this.moments = {}; this.turnT = 0; this.face = 0;
    const r = rnd((Date.now() / 1000) | 0);
    if (this.opt.season === 'auto') this.state.season = Object.keys(SEASONS)[Math.floor(r() * 4)];
    if (this.opt.weather === 'auto') this.state.weather = this.randWeather(r);
    if (this.opt.time === 'auto') this.state.hour = [5.8, 8, 10.5, 13, 15.5, 17.6, 18.3, 20, 22, 4.6][Math.floor(r() * 10)];
    this.applySeason(); this.weatherT = 240 + r() * 360; this.r = r;
    for (const p of this.people) this.removePerson(p); this.people = [];
  }
  leave() { if (this.bear && this.prevParent) this.prevParent.add(this.bear.root); for (const p of this.people) this.removePerson(p); this.people = []; this.bear = null; }
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
    for (let i = 0; i < N; i++) { c.set(pal[Math.floor(r() * pal.length)]); if (s === 'spring' && i % 4 === 3) c.set('#9ccc6a'); c.offsetHSL(0, 0, (r() - 0.5) * 0.06); this.crowns.setColorAt(i, c); }
    this.crowns.instanceColor.needsUpdate = true; this.crowns.visible = s !== 'winter'; this.twigs.visible = s === 'winter';
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
    // 속도: 위 · 아래로 바꾸고, 놓으면 그대로 (저절로 빨라지지 않는다)
    if (inp.up) this.target = clamp(this.target + inp.up * dt * 1.4, V_MIN, V_MAX);
    if (inp.speedTo != null) { this.target = inp.speedTo; inp.speedTo = null; }
    this.v += (this.target - this.v) * Math.min(1, dt * 1.6);
    // 반환점: 코스 끝에서 돌아선다
    const ds = this.v * dt * this.dir; this.s += ds; this.dist += Math.abs(ds);
    if (this.s > this.L - 6 && this.dir > 0) { this.dir = -1; this.turnT = 1; this.onTurn?.('63빌딩 쪽 반환점'); }
    if (this.s < 6 && this.dir < 0) { this.dir = 1; this.turnT = 1; this.onTurn?.('서강대교 쪽 반환점'); }
    this.lat = clamp(this.lat + (inp.lat || 0) * this.dir * dt * 3.2, -9, 5);
    if (inp.jump && this.y <= 0) this.vy = 5.2;
    this.vy -= 14 * dt; this.y = Math.max(0, this.y + this.vy * dt); if (this.y <= 0) this.vy = Math.max(0, this.vy);
    // 순간들 (업적): 노을 · 밤 · 일출 · 비 · 눈 · 계절에 달린 거리
    const h = st.hour, mo = h >= 17.9 && h < 19.4 ? 'sunset' : h >= 5.3 && h < 6.9 ? 'sunrise' : h >= 20.5 || h < 4.2 ? 'night' : null;
    const add = (k) => { this.moments[k] = (this.moments[k] || 0) + Math.abs(ds); };
    if (mo) add(mo); if (st.weather === 'rain') add('rain'); if (st.weather === 'snow') add('snow'); add(st.season);
    // 곰돌이
    const p = this.at(this.s), fx = p.dx * this.dir, fz = p.dz * this.dir, [bx, bz] = this.world(this.s, this.lat);
    const want = Math.atan2(fx, fz); this.face += (((want - this.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * (this.turnT > 0 ? 3 : 8)); this.turnT = Math.max(0, this.turnT - dt);
    this.bear.root.position.set(bx, this.y, bz); this.bear.root.rotation.y = this.face; this.bear.root.visible = true;
    this.bear.inner.rotation.set(0, 0, 0);
    this.bear.update(dt, this.v * 1.25, { noCrawl: true });
    this.shadow.position.set(bx, 0.02, bz); this.shadow.scale.setScalar(1 - Math.min(0.5, this.y * 0.2));
    this.tickPeople(dt, bx, bz);
    this.tickEnv(dt, camera, bx, bz);
    this.tickCamera(dt, camera, bx, bz, fx, fz);
  }
  tickPeople(dt, px, pz) {
    const r = this.r;
    // 주변에 사람이 너무 적으면 앞쪽(보이지 않는 곳)에 새로 놓는다
    this.peopleT -= dt;
    if (this.peopleT <= 0 && this.people.length < (isPhone ? 7 : 12)) {
      this.peopleT = 2 + r() * 4;
      const x = r(), kind = x < 0.62 ? 'runner' : x < 0.82 ? 'family' : 'couple';
      const ahead = this.s + this.dir * (70 + r() * 90);
      if (ahead > 5 && ahead < this.L - 5) {
        if (kind === 'runner') { const opp = r() < 0.6; this.spawnPerson(kind, ahead, opp ? -this.dir : this.dir, opp ? -3.6 - r() * 1.2 : -4.8 + r() * 1.2, opp ? 2.4 + r() * 1.6 : Math.max(1.6, this.v - 0.6 - r() * 0.8), r); }
        else this.spawnPerson(kind, ahead, r() < 0.5 ? 1 : -1, 3.6 + r() * 5, 0.7 + r() * 0.35, r);
      }
    }
    for (const p of this.people) {
      p.s += p.dir * p.v * dt; p.t += dt;
      const q = this.at(p.s), f = Math.atan2(q.dx * p.dir, q.dz * p.dir);
      p.bears.forEach((b, i) => { const lat = p.lat + (i ? (p.kind === 'family' ? 0.9 : 0.8) : 0) * (p.dir > 0 ? 1 : -1); const [x, z] = this.world(p.s, lat); b.root.position.set(x, 0, z); b.root.rotation.y = f; b.update(dt, p.v * (p.kind === 'runner' ? 1.25 : 1.6), { noCrawl: true }); });
      if (p.kind === 'couple') { p.heartT -= dt; if (p.heartT <= 0) { p.heartT = 4 + Math.random() * 6; p.heart ||= heartSprite(); this.scene.add(p.heart); p.heartLife = 1.6; } if (p.heartLife > 0) { p.heartLife -= dt; const b = p.bears[0].root.position; p.heart.position.set(b.x, 2.1 + (1.6 - p.heartLife) * 0.6, b.z); p.heart.material.opacity = Math.min(1, p.heartLife); } }
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
    this.sun.position.copy(sun.y > -0.05 ? sun : moon).multiplyScalar(500).add(new THREE.Vector3(px, 0, pz)); this.sun.target.position.set(px, 0, pz);
    this.sun.color.copy(sun.y > -0.05 ? sunCol : C('#9fb4ff')); this.sun.intensity = (sun.y > -0.05 ? 1.9 * sunUp : 0.35) * (1 - ck * 0.55);
    this.hemi.color.copy(sk.top).lerp(C('#ffffff'), 0.35); this.hemi.groundColor.copy(sk.ground); this.hemi.intensity = lerp(0.55, 1.15, sunUp) * (1 - ck * 0.15);
    const fogC = sk.hor.clone().lerp(sk.top, 0.35), fd = wt === 'rain' ? 0.00085 : wt === 'snow' ? 0.0011 : wt === 'cloudy' ? 0.00034 : 0.00022;
    this.scene.fog.color.copy(fogC); this.scene.fog.density = lerp(this.scene.fog.density, fd, Math.min(1, dt * 0.5));
    this.waterU.fogCol.value.copy(fogC); this.waterU.fogD.value = this.scene.fog.density; this.waterU.time.value = this.t; this.waterU.rain.value = lerp(this.waterU.rain.value, wt === 'rain' ? 1 : 0, Math.min(1, dt));
    this.mtM.color.copy(sk.hor).lerp(sk.top, 0.25).multiplyScalar(0.82);
    // 밤: 창문 · 가로등 · 다리 불빛 · 자동차
    const lit = smooth(0.15, 0.8, night);
    for (const m of this.bldM) m.emissiveIntensity = lit * 0.95; if (this.farM) this.farM.emissiveIntensity = lit * 0.9;
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
    const k = 1 - Math.exp(-dt * 3), mode = this.opt.cam || 0, y = this.y;
    let cx, cy, cz, lx, ly, lz;
    if (mode === 0) { cx = bx - fx * 6.2; cy = 2.7 + y * 0.5; cz = bz - fz * 6.2; lx = bx + fx * 6; ly = 1.3; lz = bz + fz * 6; }
    else if (mode === 1) { const p = this.at(this.s), side = -1; cx = bx + p.rx * 9 * side + fx * 3; cy = 1.8; cz = bz + p.rz * 9 * side + fz * 3; lx = bx + fx * 1.5; ly = 1.2; lz = bz + fz * 1.5; }
    else { cx = bx - fx * 26; cy = 22; cz = bz - fz * 26; lx = bx + fx * 30; ly = 0; lz = bz + fz * 30; }
    if (!this.camInit) { camera.position.set(cx, cy, cz); this.camInit = true; }
    camera.position.x += (cx - camera.position.x) * k; camera.position.y += (cy - camera.position.y) * k; camera.position.z += (cz - camera.position.z) * k;
    this.look ||= new THREE.Vector3(lx, ly, lz); this.look.x += (lx - this.look.x) * k; this.look.y += (ly - this.look.y) * k; this.look.z += (lz - this.look.z) * k;
    camera.lookAt(this.look);
    if (Math.abs(camera.fov - 58) > 0.05 || camera.far < 20000) { camera.fov = 58; camera.far = 24000; camera.updateProjectionMatrix(); }
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
// 러닝 장비: 헤어밴드 · 민소매 · 손목밴드 / 할머니: 모자 · 가디건 / 아이: 노란 모자 / 연인: 커플 티
function addGear(b, kind, r) {
  const head = b.head, torso = b.torso; if (!head || !torso) return;
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const shirt = { run: ['#ff5a5f', '#2f80ed', '#27c281', '#ffb020', '#ffffff', '#111111'][Math.floor(r() * 6)], grandma: '#a86a8a', kid: '#ffd23f', couple: '#ff8ab5', couple2: '#ff8ab5' }[kind];
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.42, 14, 1, true), M(shirt)); top.position.set(0, 1.06, 0); top.material.side = THREE.DoubleSide; torso.add(top);
  if (kind === 'run') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 18), M(['#ffffff', '#ff3b6b', '#111111', '#2fd3ff'][Math.floor(r() * 4)])); band.rotation.x = Math.PI / 2; band.position.y = 0.22; head.add(band); }
  if (kind === 'grandma') { const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.22, 14), M('#d9c3a5')); hat.position.y = 0.42; head.add(hat); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 18), M('#d9c3a5')); brim.position.y = 0.32; head.add(brim); }
  if (kind === 'kid') { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffd23f')); cap.position.y = 0.2; head.add(cap); }
}
function heartSprite() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.font = '52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💗', 32, 36); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); s.scale.set(0.6, 0.6, 1); return s; }
