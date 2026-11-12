// 🗺️ 서울 맵: 길 위 움직이는 것 · 서 있는 장애물 모양 (브라우저만, track.makeMover 로 넣는다)
//   차 · 택시 · SUV · 버스 · 오토바이는 젤리 서울 러너 차 모델(hangang-vehicle-models.js) 그대로, 자전거 · 행인 젤리는 여기서
//   차는 종류마다 그물 하나를 나눠 쓰고 색만 다르게 (인스턴스 하나짜리)
import * as THREE from 'three';
import { toon, G } from '../../shared/js/utils.js';
import { glow } from './kits.js';
import { vehicleGeo, vehicleMat, VU, pickColor, TYPES } from './hangang-vehicle-models.js';

const KEYS = { car: ['sedanM', 'sedanM', 'hatch', 'sedanL', 'light'], suv: ['suvS', 'suvM', 'suvL', 'minivan'], taxi: ['taxiO', 'taxiO', 'taxiW', 'taxiB'], bus: ['busCity', 'busCity', 'busTown'], moto: ['scooter', 'moto'] };
const shared = new Map(); let night = 0;
function geoOf(key) {
  if (shared.has(key)) return shared.get(key);
  const g = vehicleGeo(key, true).clone();
  g.setAttribute('iSt', new THREE.InstancedBufferAttribute(new Float32Array([night, 0, 0, 0]), 4)); g.setAttribute('iCell', new THREE.InstancedBufferAttribute(new Float32Array([7, 3]), 2));
  shared.set(key, g); return g;
}
// 밤 코스: 전조등 · 후미등을 켠다 (모든 차가 같은 그물이라 한 번에)
export function seoulNight(on) { night = on ? 1 : 0; VU.uNight.value = night; for (const g of shared.values()) { g.attributes.iSt.setX(0, night); g.attributes.iSt.needsUpdate = true; } }
export function seoulTick(t) { VU.uTime.value = t; }
const M = (c) => (typeof c === 'object' ? c : toon(c));
function add(p, g, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(g, M(mat)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); p.add(m); return m; }
const rnd = (n) => { let s = (n * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const SKIN = ['#8a5634', '#f2c28a', '#ffd1dc', '#c9e4ff', '#e8d5b7', '#ffe082', '#b39ddb', '#a5d6a7'], TOP = ['#1e88e5', '#e53935', '#fafafa', '#263238', '#43a047', '#f9a825', '#8e24aa', '#ff7043'];
// 행인 젤리: 몸 · 머리 · 귀 · 다리 (걷기: 몸이 통통 튀고 다리가 앞뒤로)
function jelly(r, s = 1) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const c = pick(r, SKIN), top = pick(r, TOP);
  add(body, G.sphereLow(), top, 0, 0.62 * s, 0, 0.34 * s, 0.4 * s, 0.3 * s); add(body, G.sphereLow(), c, 0, 1.12 * s, 0, 0.31 * s, 0.3 * s, 0.3 * s);
  for (const sx of [-1, 1]) { add(body, G.sphereLow(), c, sx * 0.21 * s, 1.38 * s, 0, 0.1 * s, 0.1 * s, 0.08 * s); add(body, G.sphereLow(), '#1a1a1a', sx * 0.1 * s, 1.15 * s, 0.27 * s, 0.035 * s, 0.045 * s, 0.03 * s); add(body, G.sphereLow(), top, sx * 0.36 * s, 0.68 * s, 0, 0.09 * s, 0.2 * s, 0.09 * s, 0, 0, sx * 0.3); }
  const legs = [-1, 1].map((sx) => add(g, G.sphereLow(), '#37474f', sx * 0.13 * s, 0.22 * s, 0, 0.1 * s, 0.24 * s, 0.1 * s));
  if (r() < 0.3) add(body, G.box(), pick(r, ['#6d4c41', '#212121', '#c62828']), 0, 0.7 * s, -0.3 * s, 0.4 * s, 0.4 * s, 0.16 * s);
  if (r() < 0.25) { add(body, G.cylLow(), '#455a64', 0.45 * s, 1.1 * s, 0, 0.02, 0.9 * s, 0.02); add(body, G.hemi(), pick(r, ['#e53935', '#1e88e5', '#fdd835', '#212121']), 0.45 * s, 1.55 * s, 0, 0.6 * s, 0.35 * s, 0.6 * s); }
  g.userData.anim = (o, t) => { const w = (o.userData.walk || 0) * 9; body.position.y = Math.abs(Math.sin(w)) * 0.06; legs[0].position.z = Math.sin(w) * 0.12; legs[1].position.z = -Math.sin(w) * 0.12; };
  return g;
}
// 자전거 + 탄 젤리: 두 바퀴 · 삼각 틀 · 핸들, 페달 돌리며
function bicycle(r) {
  const g = new THREE.Group(), fr = pick(r, ['#e53935', '#1e88e5', '#212121', '#43a047', '#fafafa']), wheel = new THREE.TorusGeometry(0.33, 0.035, 6, 18);
  const wh = [0.55, -0.55].map((z) => { const m = new THREE.Mesh(wheel, M('#1a1a1a')); m.position.set(0, 0.36, z); m.rotation.y = Math.PI / 2; g.add(m); return m; });
  add(g, G.box(), fr, 0, 0.62, 0, 0.05, 0.05, 0.9, -0.15); add(g, G.box(), fr, 0, 0.5, 0.25, 0.05, 0.5, 0.05, 0.5); add(g, G.box(), fr, 0, 0.55, -0.25, 0.05, 0.45, 0.05, -0.3); add(g, G.box(), '#212121', 0, 0.92, -0.33, 0.18, 0.06, 0.26); add(g, G.box(), '#9e9e9e', 0, 0.98, 0.5, 0.5, 0.04, 0.04);
  const rider = jelly(r, 0.85); rider.position.set(0, 0.45, -0.15); rider.rotation.x = 0.25; g.add(rider);
  g.userData.anim = (o, t) => { for (const w of wh) w.rotation.x = (o.userData.walk || 0) * 9; rider.userData.walk = (o.userData.walk || 0) * 0.4; rider.userData.anim(rider, t); };
  return g;
}
// 공사 고깔 줄 · 가림막 · 현수막: 판정 크기에 맞춰 (fit)
function cones(n) { const g = new THREE.Group(); g.userData.fit = (o, w) => { const k = Math.max(2, Math.round(w / 1.1)); for (let i = 0; i < k; i++) { const x = -w / 2 + (i + 0.5) * (w / k); add(o, G.cone(), '#ff6d00', x, 0.33, 0, 0.26, 0.62, 0.26); add(o, G.cylLow(), glow('#ffffff'), x, 0.36, 0, 0.17, 0.08, 0.17); add(o, G.box(), '#263238', x, 0.02, 0, 0.5, 0.04, 0.5); } }; return g; }
function barrier() { const g = new THREE.Group(); g.userData.fit = (o, w, h) => { const k = Math.max(1, Math.round(w / 1.6)); for (let i = 0; i < k; i++) { const x = -w / 2 + (i + 0.5) * (w / k); for (let j = 0; j < 4; j++) add(o, G.box(), j % 2 ? '#fafafa' : '#ff6d00', x, 0.2 + j * (h - 0.3) / 4, 0, w / k - 0.08, (h - 0.3) / 4, 0.08); add(o, G.box(), '#424242', x - w / k / 2 + 0.05, 0, 0, 0.08, h, 0.6); } add(o, G.sphereLow(), glow('#ffb300'), 0, h + 0.1, 0, 0.12); }; return g; }
function banner(n) { const g = new THREE.Group(); g.userData.fit = (o, w, h) => { for (const sx of [-1, 1]) add(o, G.cylLow(), '#455a64', sx * (w / 2 + 0.1), -1.0 + (h + 1.2) / 2, 0, 0.07, h + 1.2, 0.07); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = ['#fdd835', '#1e88e5', '#e53935'][n % 3]; c.fillRect(0, 0, 512, 96); c.fillStyle = n % 3 === 0 ? '#212121' : '#ffffff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(['공사 중 · 조심히 지나가세요', '서울 걷기 축제', '어린이 보호구역'][n % 3], 256, 52, 490); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; add(o, G.box(), new THREE.MeshBasicMaterial({ map: t }), 0, h / 2, 0, w, h * 0.9, 0.08); }; return g; }

export function makeSeoulMover(kind, n) {
  const r = rnd(n + 7);
  if (kind === 'ped') return jelly(r);
  if (kind === 'bike') return bicycle(r);
  if (kind === 'cones') return cones(n);
  if (kind === 'barrier') return barrier(n);
  if (kind === 'banner') return banner(n);
  const key = pick(r, KEYS[kind] || KEYS.car), m = new THREE.InstancedMesh(geoOf(key), vehicleMat(), 1);
  m.setMatrixAt(0, new THREE.Matrix4()); m.setColorAt(0, new THREE.Color(pickColor(TYPES[key], r))); m.frustumCulled = false;
  const g = new THREE.Group(); g.add(m);
  // 오토바이는 탄 젤리가 모델에 있다. 바닥 그림자
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(TYPES[key].W + 0.4, TYPES[key].L + 0.5), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; g.add(sh);
  return g;
}
