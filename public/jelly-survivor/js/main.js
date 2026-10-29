// 젤리 서바이버 (충치균 대습격): 곰돌이는 걷기만 · 무기는 저절로 · 레벨업마다 3개 중 하나
//   혼자 하기는 이 화면이 sim.js 를 돌리고, 같이 하기는 서버가 돌린 결과(스냅샷)를 그린다. 그리는 쪽은 둘 다 같은 스냅샷 모양
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { account, store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { Roach } from '../../shared/js/roach.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { Sim, WEAPONS, PASSIVES, ENEMIES, E_KEYS, P_KINDS, ARENA, RUN, MAX_LV, STAGES, ENDLESS_STEP } from './sim.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellysurv');
const PICK_KEY = 'jellysurv.pick', ANON_KEY = 'dreamrunner.anon';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.surv = {
  mode: 'title', kind: 'solo', sim: null, myId: 1, watch: 0, paused: false, choices: null, pending: 0, t: 0,
  pick: { diff: pick0.diff === 'hard' ? 'hard' : 'normal', mode: pick0.mode === 'endless' ? 'endless' : 'stage', stage: Math.max(1, Math.min(STAGES.length, pick0.stage || 1)) }, members: [],
};

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffd9ec');
scene.fog = new THREE.Fog('#ffd9ec', 30, 58);
const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 200);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
scene.add(new THREE.HemisphereLight('#ffffff', '#ffb3d9', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(10, 30, 14); scene.add(sun);
const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });

// 젤리 들판: 파스텔 체크 + 스프링클 · 사탕 지팡이 울타리 · 젤리 구슬 · 막대사탕 장식
const groundMat = new THREE.MeshToonMaterial();
// 스테이지마다 들판 색 · 하늘 색이 바뀐다
function setStageLook(st) {
  const S0 = STAGES[(st - 1) % STAGES.length];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = S0.g[0]; x.fillRect(0, 0, 256, 256); x.fillStyle = S0.g[1]; x.fillRect(0, 0, 128, 128); x.fillRect(128, 128, 128, 128);
  const cols = ['#ff8fc4', '#7cd8ff', '#ffd84d', '#9be7a7', '#c39bff'];
  for (let i = 0; i < 46; i++) { x.save(); x.translate(Math.random() * 256, Math.random() * 256); x.rotate(Math.random() * 3); x.fillStyle = cols[i % 5]; x.beginPath(); x.roundRect(-6, -2, 12, 4, 2); x.fill(); x.restore(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set((ARENA * 2 + 60) / 8, (ARENA * 2 + 60) / 8); tex.colorSpace = THREE.SRGBColorSpace;
  groundMat.map?.dispose(); groundMat.map = tex; groundMat.needsUpdate = true;
  scene.background.set(S0.sky); scene.fog.color.set(S0.sky);
}
{
  const cols = ['#ff8fc4', '#7cd8ff', '#ffd84d', '#9be7a7', '#c39bff'];
  setStageLook(1);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 60, ARENA * 2 + 60), groundMat);
  g.rotation.x = -Math.PI / 2; scene.add(g);
  // 울타리: 사탕 지팡이
  const cane = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 10), toon('#ff4f81'), 4 * 72);
  const top = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), toon('#ffffff'), 4 * 72);
  const m = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 72; i++) { const v = -ARENA + (i / 71) * ARENA * 2; for (const [px, pz] of [[v, -ARENA - 1], [v, ARENA + 1], [-ARENA - 1, v], [ARENA + 1, v]]) { m.makeTranslation(px, 1.2, pz); cane.setMatrixAt(k, m); m.makeTranslation(px, 2.5, pz); top.setMatrixAt(k, m); k++; } }
  scene.add(cane, top);
  // 장식
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#ffffff', { transparent: true, opacity: 0.9 }), 90);
  const stick = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), toon('#ffffff'), 30), pop = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 0.9, 0.25, 20), toon('#ffffff'), 30);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), col = new THREE.Color();
  let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) { const s = 0.5 + r() * 0.9; m.compose(new THREE.Vector3((r() - 0.5) * ARENA * 2, 0, (r() - 0.5) * ARENA * 2), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.9, s)); drops.setMatrixAt(i, m); drops.setColorAt(i, col.set(cols[i % 5])); }
  for (let i = 0; i < 30; i++) { const px = (r() - 0.5) * ARENA * 2, pz = (r() - 0.5) * ARENA * 2; m.makeTranslation(px, 1.1, pz); stick.setMatrixAt(i, m); m.compose(new THREE.Vector3(px, 2.3, pz), q, new THREE.Vector3(1, 1, 1)); pop.setMatrixAt(i, m); pop.setColorAt(i, col.set(cols[(i + 2) % 5])); }
  scene.add(drops, stick, pop);
}

// ---------- 모양 만들기 (여러 조각을 색 있는 한 덩어리로 합친다) ----------
function part(geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const SPH = new THREE.SphereGeometry(1, 16, 12), SPHL = new THREE.SphereGeometry(1, 8, 6), CONE = new THREE.ConeGeometry(1, 1, 10), BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const eyes = (y, z, s = 1, w = 0.32) => [part(SPHL, '#ffffff', -w * s, y, z, 0.24 * s, 0.26 * s, 0.14 * s), part(SPHL, '#ffffff', w * s, y, z, 0.24 * s, 0.26 * s, 0.14 * s), part(SPHL, '#2b1d2c', -w * s, y, z + 0.1 * s, 0.12 * s, 0.14 * s, 0.08 * s), part(SPHL, '#2b1d2c', w * s, y, z + 0.1 * s, 0.12 * s, 0.14 * s, 0.08 * s)];
const angry = (y, z, s = 1) => [part(BOX, '#2b1d2c', -0.3 * s, y, z, 0.32 * s, 0.07 * s, 0.05 * s, 0, 0, -0.45), part(BOX, '#2b1d2c', 0.3 * s, y, z, 0.32 * s, 0.07 * s, 0.05 * s, 0, 0, 0.45)];
const SHAPES = {
  // 충치균: 초록 털뭉치 + 뿔 + 이빨
  germ: () => [part(SPH, '#7bd36a', 0, 0.6, 0, 0.62, 0.55, 0.62), ...[-0.35, 0, 0.35].map((x, i) => part(CONE, '#4fa84a', x, 1.15, -0.05, 0.12, 0.35, 0.12, 0, 0, (i - 1) * -0.5)), ...eyes(0.75, 0.5), ...angry(1.0, 0.55), part(BOX, '#ffffff', 0, 0.42, 0.58, 0.3, 0.1, 0.05)],
  bat: () => [part(SPH, '#9b6bff', 0, 0.9, 0, 0.45, 0.42, 0.42), part(SPH, '#7a4fe0', -0.62, 1.0, -0.05, 0.42, 0.12, 0.3, 0, 0, 0.4), part(SPH, '#7a4fe0', 0.62, 1.0, -0.05, 0.42, 0.12, 0.3, 0, 0, -0.4), ...eyes(1.0, 0.36, 0.8), part(CONE, '#ffffff', -0.1, 0.72, 0.38, 0.05, 0.12, 0.05, Math.PI), part(CONE, '#ffffff', 0.1, 0.72, 0.38, 0.05, 0.12, 0.05, Math.PI)],
  choco: () => [part(BOX, '#7a4b2a', 0, 0.8, 0, 1.4, 1.4, 1.4), part(BOX, '#5c3519', 0, 1.52, 0, 1.2, 0.1, 1.2), ...['#ff8fc4', '#7cd8ff', '#ffd84d', '#9be7a7', '#ff5a7a', '#ffffff'].map((c, i) => part(BOX, c, -0.45 + (i % 3) * 0.45, 1.58, -0.3 + Math.floor(i / 3) * 0.6, 0.25, 0.07, 0.08, 0, i, 0)), ...eyes(1.0, 0.71, 1.2), ...angry(1.35, 0.72, 1.2)],
  ghost: () => [part(SPH, '#ffd1ea', 0, 1.0, 0, 0.6, 0.65, 0.55), part(SPH, '#ffe7f3', -0.35, 0.6, 0, 0.35, 0.35, 0.35), part(SPH, '#ffe7f3', 0.35, 0.6, 0, 0.35, 0.35, 0.35), part(SPH, '#ffc2e0', 0, 0.45, 0, 0.35, 0.3, 0.35), ...eyes(1.1, 0.5), part(SPHL, '#ff5a9a', 0, 0.82, 0.52, 0.12, 0.1, 0.05)],
  sour: () => [part(BOX, '#d8f25a', 0, 0.7, 0, 1.15, 1.2, 1.15), part(SPHL, '#f2ff9e', -0.3, 1.1, 0.5, 0.16, 0.1, 0.05), ...eyes(0.85, 0.58), part(BOX, '#2b1d2c', 0, 0.45, 0.58, 0.35, 0.06, 0.05, 0, 0, 0.15)],
  mini: () => [part(SPH, '#a8e86a', 0, 0.45, 0, 0.42, 0.4, 0.42), part(CONE, '#6cc44a', 0, 0.9, 0, 0.1, 0.25, 0.1), ...eyes(0.55, 0.34, 0.7)],
  king: () => [...SHAPES.germ(), part(CYL, '#ffd84d', 0, 1.45, 0, 0.45, 0.25, 0.45), ...[0, 1, 2, 3, 4].map((i) => part(CONE, '#ffd84d', Math.sin(i * 1.256) * 0.4, 1.7, Math.cos(i * 1.256) * 0.4, 0.09, 0.25, 0.09)), part(SPHL, '#ff4f81', 0, 1.5, 0.45, 0.08, 0.08, 0.05)],
  lord: () => [part(SPH, '#6a3fb0', 0, 0.75, 0, 0.75, 0.7, 0.7), part(CONE, '#3a1f6a', -0.45, 1.45, 0, 0.14, 0.6, 0.14, 0, 0, 0.5), part(CONE, '#3a1f6a', 0.45, 1.45, 0, 0.14, 0.6, 0.14, 0, 0, -0.5), ...eyes(0.95, 0.62, 1.1).map((g, i) => (i > 1 ? g : g)), part(SPHL, '#ff2a6a', -0.35, 0.96, 0.75, 0.1, 0.1, 0.05), part(SPHL, '#ff2a6a', 0.35, 0.96, 0.75, 0.1, 0.1, 0.05), ...angry(1.2, 0.68, 1.1), part(BOX, '#ffffff', 0, 0.5, 0.68, 0.5, 0.14, 0.05), part(CYL, '#ffd84d', 0, 1.55, 0, 0.38, 0.2, 0.38)],
};
// 모양의 몸 반지름 (규칙의 충돌 크기에 맞춰 그린다)
const BASE_R = { germ: 0.62, bat: 0.5, choco: 0.75, ghost: 0.62, sour: 0.6, mini: 0.42, king: 0.62, lord: 0.75 };
const MAXI = { germ: 500, bat: 300, choco: 200, ghost: 160, sour: 160, mini: 200, king: 2, lord: 2 };
const eMat = new THREE.MeshToonMaterial({ vertexColors: true });
const eMesh = {};
for (const k of E_KEYS) { const im = new THREE.InstancedMesh(mergeGeometries(SHAPES[k]()), eMat, MAXI[k]); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(im); eMesh[k] = im; }
// 투사체 · 설탕 결정 · 수호대 곰젤리
const PSH = {
  candy: () => [part(SPH, '#ff5c9a', 0, 0, 0, 0.32, 0.26, 0.26), part(CONE, '#ffd1ea', -0.42, 0, 0, 0.18, 0.28, 0.18, 0, 0, Math.PI / 2), part(CONE, '#ffd1ea', 0.42, 0, 0, 0.18, 0.28, 0.18, 0, 0, -Math.PI / 2), part(SPHL, '#ffffff', -0.1, 0.12, 0.12, 0.08, 0.06, 0.05)],
  lolli: () => [part(CYL, '#ff8fc4', 0, 0, 0, 0.75, 0.16, 0.75), part(CYL, '#ffffff', 0, 0.01, 0, 0.5, 0.17, 0.5), part(CYL, '#7cd8ff', 0, 0.02, 0, 0.28, 0.18, 0.28), part(CYL, '#ffffff', 0, 0, 0.95, 0.06, 0.06, 0.8, Math.PI / 2)],
  drill: () => [part(SPH, '#ffc2e0', 0, 0, 0, 0.6, 0.5, 0.6), part(SPH, '#c8e6ff', 0.35, 0.15, 0, 0.45, 0.4, 0.45), part(SPH, '#ffe0f0', -0.3, 0.2, 0.2, 0.4, 0.35, 0.4), part(CONE, '#ffffff', 0, -0.55, 0, 0.3, 0.6, 0.3, Math.PI)],
  bomb: () => [part(SPH, '#ff4f6a', 0, 0, 0, 0.45, 0.45, 0.45), part(SPHL, '#ffffff', -0.15, 0.2, 0.2, 0.1, 0.08, 0.06), part(CYL, '#5c3519', 0, 0.5, 0, 0.05, 0.25, 0.05), part(SPHL, '#ffd84d', 0, 0.66, 0, 0.09, 0.09, 0.09)],
  spit: () => [part(SPH, '#b04fff', 0, 0, 0, 0.26, 0.26, 0.26), part(SPHL, '#f0c8ff', -0.08, 0.09, 0.12, 0.08, 0.07, 0.05)],
  mine: () => [part(SPH, '#ff7aa8', 0, 0, 0, 0.42, 0.22, 0.42), part(SPHL, '#ffe0ec', 0, 0.12, 0, 0.26, 0.12, 0.26), part(SPHL, '#ff2a5a', 0, 0.22, 0, 0.08, 0.08, 0.08)],
  star: () => [0, 1, 2, 3, 4].map((i) => part(BOX, '#ffd84d', Math.sin(i * 1.2566) * 0.24, 0, Math.cos(i * 1.2566) * 0.24, 0.14, 0.09, 0.36, 0, i * 1.2566, 0)).concat([part(SPHL, '#fff6b0', 0, 0, 0, 0.18, 0.12, 0.18)]),
  meteor: () => [part(SPH, '#ff9f43', 0, 0, 0, 0.7, 0.7, 0.7), part(SPHL, '#ffe08a', -0.2, 0.25, 0.25, 0.25, 0.2, 0.2), part(CONE, '#ffd84d', 0, 1.0, 0, 0.5, 1.4, 0.5)],
};
const pMat = new THREE.MeshToonMaterial({ vertexColors: true, emissive: '#331133' }), pMesh = {};
for (const k of P_KINDS) { const im = new THREE.InstancedMesh(mergeGeometries(PSH[k]()), pMat, 400); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; scene.add(im); pMesh[k] = im; }
const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.36), new THREE.MeshToonMaterial({ color: '#ffffff', emissive: '#4466aa', emissiveIntensity: 0.55 }), 800);
gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gemMesh.count = 0; gemMesh.frustumCulled = false; gemMesh.setColorAt(0, new THREE.Color()); scene.add(gemMesh);
const bearMesh = new THREE.InstancedMesh(mergeGeometries([part(SPH, '#ffffff', 0, 0.35, 0, 0.32, 0.36, 0.3), part(SPH, '#ffffff', 0, 0.82, 0, 0.27, 0.25, 0.25), part(SPHL, '#ffffff', -0.18, 1.04, 0, 0.1, 0.1, 0.08), part(SPHL, '#ffffff', 0.18, 1.04, 0, 0.1, 0.1, 0.08), part(SPHL, '#2b1d2c', -0.09, 0.86, 0.22, 0.04, 0.05, 0.03), part(SPHL, '#2b1d2c', 0.09, 0.86, 0.22, 0.04, 0.05, 0.03)]), new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: 0.88 }), 80);
bearMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bearMesh.count = 0; bearMesh.frustumCulled = false; bearMesh.setColorAt(0, new THREE.Color()); scene.add(bearMesh);
const markMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.4, depthWrite: false }), 40);
markMesh.count = 0; markMesh.frustumCulled = false; scene.add(markMesh);
const marks = [];
// 경험치 구슬 밑의 빛나는 고리 (잘 보이게)
const gemGlow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }), 800);
gemGlow.count = 0; gemGlow.frustumCulled = false; gemGlow.setColorAt(0, new THREE.Color()); scene.add(gemGlow);
const GEM_COL = (v) => (v >= 10 ? '#ffc23c' : v >= 5 ? '#ff4f9a' : v >= 3 ? '#3fe87a' : '#3fb4ff');

// ---------- 효과 ----------
const fxList = [];
function ring(x, z, r, color, life = 0.45, y = 0.15) { const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); fxList.push({ m, t: life, life, grow: r, k: 'ring' }); }
function disc(x, z, r, color, life = 0.35) { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.12, z); scene.add(m); fxList.push({ m, t: life, life, grow: r, k: 'disc' }); }
function zap(x, z) {
  const pts = []; let px = x, pz = z; for (let y = 14; y >= 0; y -= 2) { pts.push(new THREE.Vector3(px, y, pz)); px = x + (Math.random() - 0.5) * 0.9; pz = z + (Math.random() - 0.5) * 0.9; }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#fff27a', transparent: true })); scene.add(l); fxList.push({ m: l, t: 0.22, life: 0.22, k: 'fade' });
  disc(x, z, 1.4, '#fff27a', 0.25);
}
// 무지개 레이저: 납작한 띠가 번쩍 사라진다
function beam(x1, z1, x2, z2, w) {
  const L = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, L), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, 0.55), transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(x2 - x1, z2 - z1) + Math.PI; m.position.set((x1 + x2) / 2, 0.9, (z1 + z2) / 2); scene.add(m); fxList.push({ m, t: 0.18, life: 0.18, k: 'fade' });
}
// 아이스크림 냉기: 하늘색 부채꼴
function fan(P, a, R) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 24, -0.75, 1.5), new THREE.MeshBasicMaterial({ color: '#c8f0ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = a - Math.PI / 2; m.position.set(P.x, 0.3, P.z); scene.add(m); fxList.push({ m, t: 0.35, life: 0.35, k: 'fade' });
  for (let i = 0; i < 6; i++) { const d = Math.random() * R, aa = a + (Math.random() - 0.5) * 1.4; burst(P.x + Math.sin(aa) * d, P.z + Math.cos(aa) * d, '#e8fbff', 2, 2); }
}
function sweep(P, a, R) {
  const m = new THREE.Mesh(new THREE.RingGeometry(R * 0.55, R, 24, 1, -1.1, 2.2), new THREE.MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = a - Math.PI / 2; m.position.set(P.x, 0.6, P.z); scene.add(m); fxList.push({ m, t: 0.22, life: 0.22, k: 'fade' });
}
// 알갱이 (녹을 때 튀는 젤리)
const PN = 700, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, depthWrite: false })); points.frustumCulled = false; scene.add(points);
let pIdx = 0;
const E_COL = { germ: '#7bd36a', bat: '#9b6bff', choco: '#7a4b2a', ghost: '#ffd1ea', sour: '#d8f25a', mini: '#a8e86a', king: '#7bd36a', lord: '#6a3fb0' };
function burst(x, z, color, n = 8, sp = 5) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { const j = pIdx = (pIdx + 1) % PN; pPos[j * 3] = x; pPos[j * 3 + 1] = 0.8; pPos[j * 3 + 2] = z; const a = Math.random() * 6.28, s = sp * (0.4 + Math.random()); pVel[j * 3] = Math.cos(a) * s; pVel[j * 3 + 1] = 3 + Math.random() * 4; pVel[j * 3 + 2] = Math.sin(a) * s; pLife[j] = 0.6 + Math.random() * 0.3; pCol[j * 3] = c.r; pCol[j * 3 + 1] = c.g; pCol[j * 3 + 2] = c.b; }
}
function stepFx(dt) {
  for (const f of fxList) { f.t -= dt; const k = Math.max(0, f.t / f.life); if (f.k === 'ring' || f.k === 'disc') f.m.scale.setScalar(0.2 + (1 - k) * f.grow); f.m.material.opacity = (f.k === 'disc' ? 0.3 : 0.85) * k; /* 폭발 바닥 빛은 옅게 (화면을 덜 가리게) */ }
  for (let i = fxList.length - 1; i >= 0; i--) if (fxList[i].t <= 0) { scene.remove(fxList[i].m); fxList[i].m.geometry.dispose(); fxList.splice(i, 1); }
  for (let j = 0; j < PN; j++) { if (pLife[j] <= 0) { pPos[j * 3 + 1] = -50; continue; } pLife[j] -= dt; pVel[j * 3 + 1] -= 16 * dt; pPos[j * 3] += pVel[j * 3] * dt; pPos[j * 3 + 1] = Math.max(0.1, pPos[j * 3 + 1] + pVel[j * 3 + 1] * dt); pPos[j * 3 + 2] += pVel[j * 3 + 2] * dt; }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}
// 피해 숫자 (화면 위 글자, 최대 60개)
const nums = [];
function dmgNum(x, z, n, cls = '') { if (nums.length > 60) { nums[0].el.remove(); nums.shift(); } const el = document.createElement('div'); el.className = 'dn ' + cls; el.textContent = n; $('nums').appendChild(el); nums.push({ el, x: x + (Math.random() - 0.5) * 0.6, z, y: 1.6, t: 0.7 }); }
const v3 = new THREE.Vector3();
function toScreen(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight, v3.z < 1]; }
function stepNums(dt) { for (const n of nums) { n.t -= dt; n.y += dt * 2.2; const [sx, sy] = toScreen(n.x, n.y, n.z); n.el.style.left = `${sx}px`; n.el.style.top = `${sy}px`; n.el.style.opacity = Math.min(1, n.t * 3); } for (let i = nums.length - 1; i >= 0; i--) if (nums[i].t <= 0) { nums[i].el.remove(); nums.splice(i, 1); } }

// ---------- 화면 상태 (스냅샷을 풀어서 담는다) ----------
const V = { t: 0, pl: new Map(), en: new Map(), pr: new Map(), gems: new Map(), items: new Map(), pud: new Map(), bears: [] };
class PlayerView {
  constructor(m) {
    this.id = m.id; this.name = m.name; this.color = m.color || '#8a5634'; this.x = 0; this.z = 0; this.tx = 0; this.tz = 0; this.face = 0; this.st = 0; this.w = {}; this.p = {}; this.hp = 100; this.mh = 100;
    this.r = new Roach({ own: true, seed: m.name, color: this.color, age: 25, look: m.look, accessories: m.acc || [] }); this.r.root.scale.setScalar(1.05); scene.add(this.r.root);
    this.aura = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.22, depthWrite: false })); this.aura.rotation.x = -Math.PI / 2; this.aura.position.y = 0.08; this.aura.visible = false; scene.add(this.aura);
    this.auraEdge = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), new THREE.MeshBasicMaterial({ color: '#7cd8ff', transparent: true, opacity: 0.55, depthWrite: false })); this.auraEdge.rotation.x = -Math.PI / 2; this.auraEdge.position.y = 0.09; this.auraEdge.visible = false; scene.add(this.auraEdge);
    this.lb = document.createElement('div'); this.lb.className = 'lb'; $('labels').appendChild(this.lb);
    this.last = new THREE.Vector3();
  }
  remove() { scene.remove(this.r.root, this.aura, this.auraEdge); this.lb.remove(); }
}
const parseLv = (s) => Object.fromEntries((s || '').split(',').filter(Boolean).map((x) => { const m = x.match(/^([a-z]+)(\d+)$/); return [m[1], +m[2]]; }));
function apply(s, snap) {
  // 스냅샷 하나를 받아 화면 상태를 바꾼다 (snap=true 면 보간 없이 바로)
  V.t = s.tm / 100; V.lv = s.lv;
  for (const a of s.pl) {
    let P = V.pl.get(a[0]); if (!P) { const m = game.members.find((x) => x.id === a[0]) || { id: a[0], name: '?', color: '#8a5634' }; P = new PlayerView(m); V.pl.set(a[0], P); P.x = a[1] / 10; P.z = a[2] / 10; }
    P.tx = a[1] / 10; P.tz = a[2] / 10; P.tface = a[3] / 100; P.hp = a[4]; P.mh = a[5]; P.lvl = a[6]; P.xp = a[7]; P.xn = a[8];
    if (P.st !== a[9]) { P.r.setDead(a[9] !== 0); }
    P.st = a[9]; P.rev = a[10] / 100; P.kills = a[11]; P.hurt = a[12]; P.w = parseLv(a[13]); P.p = parseLv(a[14]);
    if (snap) { P.x = P.tx; P.z = P.tz; }
  }
  const seen = new Set();
  for (let i = 0; i < s.e.length; i += 6) {
    const id = s.e[i]; seen.add(id);
    let e = V.en.get(id); const x = s.e[i + 2] / 10, z = s.e[i + 3] / 10;
    if (!e) { e = { id, type: E_KEYS[s.e[i + 1]], x, z, rot: 0, ph: Math.random() * 6 }; V.en.set(id, e); }
    e.tx = x; e.tz = z; e.hpk = s.e[i + 4] / 100; e.fl = s.e[i + 5]; if (snap) { e.x = x; e.z = z; }
  }
  for (const [id, e] of V.en) if (!seen.has(id)) V.en.delete(id);
  seen.clear();
  for (let i = 0; i < s.p.length; i += 6) {
    const id = s.p[i]; seen.add(id);
    let p = V.pr.get(id); const x = s.p[i + 2] / 10, z = s.p[i + 3] / 10;
    if (!p) { p = { id, k: P_KINDS[s.p[i + 1]], x, z, a: 0 }; V.pr.set(id, p); }
    p.tx = x; p.tz = z; p.a = s.p[i + 4] / 100; p.r = s.p[i + 5] / 10; if (snap) { p.x = x; p.z = z; }
  }
  for (const id of V.pr.keys()) if (!seen.has(id)) V.pr.delete(id);
  for (const g of s.ga) V.gems.set(g[0], { x: g[1] / 10, z: g[2] / 10, v: g[3], ph: Math.random() * 6 });
  for (let i = 0; i < (s.gf || []).length; i += 3) { const g = V.gems.get(s.gf[i]); if (g) { g.tx = s.gf[i + 1] / 10; g.tz = s.gf[i + 2] / 10; if (snap) { g.x = g.tx; g.z = g.tz; } } }
  for (const id of s.gr) V.gems.delete(id);
  // 아이템 · 웅덩이
  const its = new Set(s.it.map((a) => a[0]));
  for (const [id, m] of V.items) if (!its.has(id)) { scene.remove(m); V.items.delete(id); }
  for (const a of s.it) if (!V.items.has(a[0])) { const m = itemMesh(a[3]); m.position.set(a[1] / 10, 0.6, a[2] / 10); scene.add(m); V.items.set(a[0], m); }
  const pus = new Set(s.pu.map((a) => a[0]));
  for (const [id, m] of V.pud) if (!pus.has(id)) { scene.remove(m); V.pud.delete(id); }
  for (const a of s.pu) if (!V.pud.has(a[0])) { const m = new THREE.Mesh(new THREE.CircleGeometry(a[3] / 10, 28), new THREE.MeshBasicMaterial({ color: '#ff8fc4', transparent: true, opacity: 0.45, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(a[1] / 10, 0.06, a[2] / 10); scene.add(m); V.pud.set(a[0], m); }
  for (const ev of s.ev) onEvent(ev);
}
function itemMesh(k) {
  const g = new THREE.Group();
  if (k === 'cake') { g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.45, 18), toon('#fff3e0'))); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.12, 18), toon('#ff8fc4')); c.position.y = 0.24; g.add(c); const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon('#ff2a4a')); b.position.y = 0.38; g.add(b); }
  else if (k === 'magnet') { const m = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.13, 8, 16, Math.PI), toon('#ff4f6a')); m.rotation.z = Math.PI; g.add(m); for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), toon('#e0e0e0')); t.position.set(s * 0.4, 0.05, 0); g.add(t); } }
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 0.7), toon('#ff8fc4')); g.add(b); const l = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.2, 0.76), toon('#ffd84d')); l.position.y = 0.3; g.add(l); const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.74, 0.74), toon('#ffd84d')); g.add(r); }
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); glow.rotation.x = -Math.PI / 2; glow.position.y = -0.5; g.add(glow);
  g.userData.k = k; return g;
}
let lastShootSfx = 0, lastKillSfx = 0, lastHitSfx = 0;
function onEvent(ev) {
  const me = game.myId, now = performance.now();
  switch (ev[0]) {
    case 'hit': if (V.en.get(ev[5])) dmgNum(ev[1], ev[2], ev[3], ev[4] ? 'crit' : ''); break;
    case 'kill': { const t = E_KEYS[ev[3]]; burst(ev[1], ev[2], E_COL[t], ev[4] ? 24 : 7, ev[4] ? 8 : 5); if (now - lastKillSfx > 45) { lastKillSfx = now; S.sfx('kill'); } break; }
    case 'boom': { const c = ev[4] === 1 ? '#bff3ff' : ev[4] === 2 ? '#ffd84d' : '#ff8fc4'; ring(ev[1], ev[2], ev[3], c, 0.4); disc(ev[1], ev[2], ev[3] * 0.8, c, 0.22); burst(ev[1], ev[2], c, 10, 7); if (now - (game.boomSfx || 0) > 90) { game.boomSfx = now; S.sfx('boom'); } break; }
    case 'beam': beam(ev[1], ev[2], ev[3], ev[4], ev[5]); if (now - (game.zapSfx || 0) > 120) { game.zapSfx = now; S.sfx('zap'); } break;
    case 'frost': { const P = V.pl.get(ev[1]); if (P) fan(P, ev[2], ev[3]); break; }
    case 'zap': zap(ev[1], ev[2]); S.sfx('zap'); break;
    case 'sweep': { const P = V.pl.get(ev[1]); if (P) { sweep(P, ev[2], ev[3]); if (ev[1] === me) S.sfx('swish'); } break; }
    case 'shoot': if (ev[1] === me && now - lastShootSfx > 120) { lastShootSfx = now; S.sfx('shoot'); } break;
    case 'lvl': if (ev[1] === me) { S.sfx('lvl'); const P = V.pl.get(me); if (P) { ring(P.x, P.z, 4, '#ffd84d', 0.6); burst(P.x, P.z, '#ffd84d', 20, 6); } } break;
    case 'hurt': { const P = V.pl.get(ev[1]); if (P) dmgNum(P.x, P.z, ev[2], 'hurt'); if (ev[1] === me) { S.sfx('hurt'); $('hurt').style.opacity = '1'; clearTimeout(game.hurtT); game.hurtT = setTimeout(() => { $('hurt').style.opacity = '0'; }, 200); game.shake = 0.25; } break; }
    case 'pick': { const P = V.pl.get(ev[1]); if (P) dmgNum(P.x, P.z, ev[2], 'crit'); break; }
    case 'item': if (ev[1] === me) { S.sfx('ok'); shell.toast(ev[2] === 'cake' ? '🍰 케이크! 체력 회복' : ev[2] === 'magnet' ? '🧲 설탕 자석! 모두 끌어와요' : '🎁 보물 사탕 상자! 레벨업 한 번 더', 1400); } break;
    case 'elite': banner('⚠️ 엘리트 충치균!', '녹이면 🎁 보물 상자'); break;
    case 'warn': banner('🚨 포위!', ev[1]); S.sfx('boss'); break;
    case 'boss': banner(`${ev[1] === 1 ? '👑 왕 충치균' : '😈 충치 대마왕'}${ev[2] > 1 ? ` ×${ev[2]}` : ''} 등장!`, ev[1] === 1 ? '돌진 · 꼬마 충치균을 불러요' : game.endless ? '녹이면 보물 상자!' : '녹이면 이겨요!'); S.sfx('boss'); break;
    case 'bossdown': banner(ev[1] === 1 ? '🎉 왕 충치균을 녹였어요!' : ev[1] === 3 ? '🎉 충치 대마왕을 녹였어요!' : '🍬 승리! 충치 대마왕 퇴치!', ev[1] === 2 ? '' : '🎁 보물 상자 + 설탕 잔뜩'); S.sfx('win'); confetti(); break;
    case 'lvup': banner(`🔥 단계 ${ev[1]}!`, '충치균이 더 세고 많아져요'); S.sfx('boss'); setStageLook(ev[1]); break;
    case 'down': { const P = V.pl.get(ev[1]); shell.toast(ev[1] === me ? '😵 쓰러졌어요! 친구가 옆에 서 있으면 일어나요 (25초)' : `🆘 ${P?.name || ''} 쓰러졌어요! 옆에 서서 살려 주세요`, 2600); break; }
    case 'revive': { const P = V.pl.get(ev[1]); shell.toast(`💖 ${P?.name || ''} 다시 일어났어요!`, 1600); S.sfx('ok'); break; }
    case 'dead': if (ev[1] === me && game.kind !== 'solo') { shell.toast('💀 탈락… 친구들을 응원해요 (Space: 관전 대상 바꾸기)', 2600); } break;
    case 'dash': S.sfx('swish'); break;
    case 'roar': S.sfx('boss'); break;
  }
}
function banner(a, b = '') { const el = $('banner'); el.classList.add('hidden'); void el.offsetWidth; el.innerHTML = `${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}`; el.classList.remove('hidden'); clearTimeout(game.bannerT); game.bannerT = setTimeout(() => el.classList.add('hidden'), 2300); }

// ---------- 그리기 ----------
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), PO = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), C1 = new THREE.Color();
function render(dt, interp) {
  const k = interp ? Math.min(1, dt * 14) : 1;
  // 곰돌이들
  for (const P of V.pl.values()) {
    P.x += (P.tx - P.x) * k; P.z += (P.tz - P.z) * k;
    let d = (P.tface ?? 0) - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); P.face += d * Math.min(1, dt * 12);
    const sp0 = Math.hypot(P.x - P.last.x, P.z - P.last.z) / Math.max(dt, 1e-3); P.last.set(P.x, 0, P.z);
    P.spd = (P.spd || 0) + (sp0 - (P.spd || 0)) * Math.min(1, dt * 10); const sp = P.spd; // 걷기 빠르기도 부드럽게 (같이 하기 보간에서도 깜빡이지 않게)
    P.r.root.position.set(P.x, 0, P.z); P.r.root.rotation.y = P.face; P.r.root.visible = P.st !== 2;
    P.r.update(dt, P.st === 0 ? Math.min(6, sp) : 0, { noCrawl: true });
    // 맞는 순간 깜빡
    P.r.root.traverse?.call; P.r.inner.visible = !(P.hurt && Math.floor(V.t * 20) % 2);
    // 치약 거품
    const al = P.w.aura || 0, A = 1 + 0.12 * (P.p.area || 0);
    P.aura.visible = P.auraEdge.visible = al > 0 && P.st === 0;
    if (al) { const R = (2 + 0.4 * al + (al >= 5)) * A * (1 + Math.sin(V.t * 4) * 0.03); P.aura.position.x = P.auraEdge.position.x = P.x; P.aura.position.z = P.auraEdge.position.z = P.z; P.aura.scale.setScalar(R); P.auraEdge.scale.setScalar(R); }
    // 이름 · 체력 · 쓰러짐
    const [sx, sy, on] = toScreen(P.x, 2.4, P.z);
    P.lb.style.display = on && P.st !== 2 ? '' : 'none'; P.lb.style.left = `${sx}px`; P.lb.style.top = `${sy}px`;
    const html = `${P.id === game.myId ? '' : esc(P.name)}${P.st === 1 ? `<div class="sos">🆘 ${Math.round(P.rev * 100)}%</div>` : `<div class="hb"><i style="width:${Math.max(0, (P.hp / P.mh) * 100)}%"></i></div>`}`;
    if (P.lbHtml !== html) { P.lbHtml = html; P.lb.innerHTML = html; }
  }
  // 충치균
  const cnt = {}; for (const kk of E_KEYS) cnt[kk] = 0;
  let boss = null;
  for (const e of V.en.values()) {
    const im = eMesh[e.type]; if (!im || cnt[e.type] >= MAXI[e.type]) continue;
    const ox = e.x, oz = e.z; e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k;
    const mx = e.x - ox, mz = e.z - oz; if (mx * mx + mz * mz > 1e-5) { const want = Math.atan2(mx, mz); let d = want - e.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); e.rot += d * Math.min(1, dt * 10); }
    const T = ENEMIES[e.type], s = (T.r / BASE_R[e.type]) * (e.fl & 1 ? 1.55 : 1), bob = Math.sin(V.t * 8 + e.ph);
    Q.setFromAxisAngle(UP, e.rot); SC.set(s * (1 - bob * 0.04), s * (1 + bob * 0.06), s * (1 - bob * 0.04)); PO.set(e.x, e.type === 'bat' || e.type === 'ghost' ? 0.3 + bob * 0.15 : 0, e.z);
    M4.compose(PO, Q, SC); const i = cnt[e.type]++; im.setMatrixAt(i, M4);
    C1.setRGB(1, 1, 1); if (e.fl & 2) C1.setRGB(2.4, 2.4, 2.4); else if (e.fl & 1) C1.setRGB(1.35, 0.85, 1.2); else if (e.fl & 4) C1.setRGB(0.8, 0.95, 1.4);
    im.setColorAt(i, C1);
    if (T.boss && (!boss || T.boss > ENEMIES[boss.type].boss)) boss = e;
  }
  for (const kk of E_KEYS) { const im = eMesh[kk]; im.count = cnt[kk]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  // 우두머리 체력
  $('boss').classList.toggle('hidden', !boss);
  if (boss) { $('boss').querySelector('.nm').textContent = `${boss.type === 'lord' ? '😈' : '👑'} ${ENEMIES[boss.type].name}`; $('boss').querySelector('i').style.width = `${boss.hpk * 100}%`; }
  // 투사체
  const pc = {}; for (const kk of P_KINDS) pc[kk] = 0;
  for (const p of V.pr.values()) {
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    const im = pMesh[p.k]; if (pc[p.k] >= 400) continue;
    let y = 0.9, rx = 0, ry = 0; const s = p.k === 'candy' ? (p.r / 0.3) * 1.5 : p.k === 'bomb' ? 1 : p.k === 'mine' ? 1 : p.k === 'meteor' ? 1.3 : p.k === 'star' ? p.r / 0.4 : p.k === 'spit' ? 1 : p.r / 0.6; // 폭탄은 작게 고정 (예전엔 폭발 반경만큼 커서 화면을 가렸다)
    if (p.k === 'candy') ry = p.a + Math.PI / 2;
    if (p.k === 'lolli') { ry = p.a; y = 0.8; }
    if (p.k === 'drill') { ry = V.t * 12; y = 1.0; }
    if (p.k === 'bomb') { y = 1.2 + Math.sin(V.t * 10 + p.id) * 0.25; ry = V.t * 6; }
    if (p.k === 'mine') { y = 0.12; ry = V.t * 2; }
    if (p.k === 'star') { ry = p.a; y = 0.8; }
    if (p.k === 'meteor') { y = 0.4 + p.a * 16; marks.push(p); }
    Q.setFromEuler(new THREE.Euler(rx, ry, 0)); SC.setScalar(s); PO.set(p.x, y, p.z); M4.compose(PO, Q, SC); im.setMatrixAt(pc[p.k]++, M4);
  }
  for (const kk of P_KINDS) { pMesh[kk].count = pc[kk]; pMesh[kk].instanceMatrix.needsUpdate = true; }
  // 별똥별 떨어질 자리 (빨간 원이 점점 진해진다)
  let mi = 0; for (const p of marks) { if (mi >= 40) break; Q.identity(); SC.set(p.r, p.r, p.r); PO.set(p.x, 0.07, p.z); M4.compose(PO, Q, SC); markMesh.setMatrixAt(mi++, M4); }
  markMesh.count = mi; markMesh.instanceMatrix.needsUpdate = true; markMesh.material.opacity = 0.35 + Math.sin(V.t * 12) * 0.15; marks.length = 0;
  // 설탕 결정
  let gi = 0;
  for (const g of V.gems.values()) {
    if (gi >= 800) break;
    if (g.tx != null) { g.x += (g.tx - g.x) * Math.min(1, dt * 20); g.z += (g.tz - g.z) * Math.min(1, dt * 20); }
    const s = g.v >= 10 ? 1.7 : g.v >= 5 ? 1.4 : g.v >= 3 ? 1.15 : 1;
    const tw = 1 + Math.max(0, Math.sin(V.t * 5 + g.ph * 3)) * 0.25; // 반짝
    Q.setFromAxisAngle(UP, V.t * 2.5 + g.ph); SC.setScalar(s * tw); PO.set(g.x, 0.55 + Math.sin(V.t * 3 + g.ph) * 0.15, g.z); M4.compose(PO, Q, SC); gemMesh.setMatrixAt(gi, M4); gemMesh.setColorAt(gi, C1.set(GEM_COL(g.v)));
    Q.identity(); SC.setScalar(s * (1.1 + Math.sin(V.t * 4 + g.ph) * 0.15)); PO.set(g.x, 0.06, g.z); M4.compose(PO, Q, SC); gemGlow.setMatrixAt(gi, M4); gemGlow.setColorAt(gi, C1); gi++;
  }
  gemMesh.count = gi; gemMesh.instanceMatrix.needsUpdate = true; if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
  gemGlow.count = gi; gemGlow.instanceMatrix.needsUpdate = true; if (gemGlow.instanceColor) gemGlow.instanceColor.needsUpdate = true;
  // 곰젤리 수호대 (규칙과 같은 식으로 자리를 계산)
  let bi = 0;
  for (const P of V.pl.values()) {
    const l = P.w.orbit || 0; if (!l || P.st !== 0) continue;
    const n = 2 + (l >= 2) + (l >= 4) + (l >= 5) * 2, A = 1 + 0.12 * (P.p.area || 0), R = 2.7 * A, sp = l >= 3 ? 3.4 : 2.4, bs = (l >= 5 ? 0.75 : 0.55) / 0.55 * A;
    for (let i = 0; i < n && bi < 80; i++) { const a = V.t * sp + (i / n) * Math.PI * 2; Q.setFromAxisAngle(UP, a + Math.PI / 2); SC.setScalar(bs); PO.set(P.x + Math.sin(a) * R, 0.2, P.z + Math.cos(a) * R); M4.compose(PO, Q, SC); bearMesh.setMatrixAt(bi, M4); bearMesh.setColorAt(bi, C1.set(['#ff8fc4', '#ffd84d', '#7cd8ff', '#9be7a7', '#c39bff', '#ff8a65'][i % 6])); bi++; }
  }
  bearMesh.count = bi; bearMesh.instanceMatrix.needsUpdate = true; if (bearMesh.instanceColor) bearMesh.instanceColor.needsUpdate = true;
  for (const m of V.items.values()) { m.rotation.y += dt * 2; m.position.y = 0.6 + Math.sin(V.t * 3) * 0.12; }
  // 카메라: 나(또는 관전 대상)를 위에서 비스듬히
  const W = V.pl.get(game.watch) || V.pl.get(game.myId);
  if (W) {
    const far = innerWidth < 720 ? 1.25 : 1;
    game.shake = Math.max(0, (game.shake || 0) - dt);
    const sh = game.shake > 0 ? (Math.random() - 0.5) * 0.4 : 0;
    camera.position.set(W.x + sh, 17.5 * far, W.z + 10.5 * far); camera.lookAt(W.x, 0.6, W.z - 0.4);
  }
}

// ---------- 입력: WASD · 방향키 · 터치 조이스틱 ----------
const keys = new Set();
let joy = null;
addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (game.mode !== 'play') return;
  keys.add(e.code);
  if (game.choices && /^Digit[1-3]$/.test(e.code)) choose(+e.code.slice(5) - 1);
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'Space') { e.preventDefault(); cycleWatch(); }
  if (e.code === 'KeyM') muteBtn();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
$('c').addEventListener('pointerdown', (e) => {
  if (game.mode !== 'play' || e.pointerType === 'mouse') return;
  joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dz: 0 };
  const j = $('joy'); j.style.left = `${e.clientX}px`; j.style.top = `${e.clientY}px`; j.classList.remove('hidden'); j.firstElementChild.style.transform = '';
});
addEventListener('pointermove', (e) => {
  if (!joy || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.x, dy = e.clientY - joy.y; const L = Math.hypot(dx, dy), m = 50;
  if (L > m) { dx *= m / L; dy *= m / L; }
  joy.dx = dx / m; joy.dz = dy / m; $('joy').firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
});
const joyEnd = (e) => { if (joy && e.pointerId === joy.id) { joy = null; $('joy').classList.add('hidden'); } };
addEventListener('pointerup', joyEnd); addEventListener('pointercancel', joyEnd);
function inputDir() {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  let dx = 0, dz = 0;
  if (!typing) { if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1; }
  if (joy) { dx = joy.dx; dz = joy.dz; }
  const L = Math.hypot(dx, dz); if (L > 1) { dx /= L; dz /= L; }
  return [dx, dz];
}
function cycleWatch() {
  if (game.kind === 'solo') return;
  const me = V.pl.get(game.myId); if (me && me.st === 0) return;
  const L = [...V.pl.values()].filter((P) => P.st === 0); if (!L.length) return;
  const i = L.findIndex((P) => P.id === game.watch); game.watch = L[(i + 1) % L.length].id;
}

// ---------- 레벨업 고르기 ----------
function showChoices(list, pending) {
  game.choices = list; game.pending = pending;
  $('lv-left').textContent = pending > 1 ? `(남은 고르기 ${pending})` : '';
  $('lv-note').textContent = game.kind === 'solo' ? '1 · 2 · 3 또는 눌러서 고르기 (고르는 동안 멈춰요)' : '1 · 2 · 3 또는 눌러서 고르기 · 같이 하기는 계속 움직여요 (12초 안에 안 고르면 대신 골라요)';
  $('cards').innerHTML = list.map((o, i) => {
    const D = o.k === 'w' ? WEAPONS[o.id] : o.k === 'p' ? PASSIVES[o.id] : { name: '딸기 케이크', emoji: '🍰', desc: '체력 +40' };
    const tag = o.k === 'heal' ? '<span class="tag">회복</span>' : o.lv === 1 ? '<span class="tag new">NEW</span>' : o.lv >= MAX_LV ? '<span class="tag max">MAX</span>' : `<span class="tag">Lv ${o.lv}</span>`;
    const ds = o.k === 'w' ? D.desc[o.lv - 1] : D.desc;
    return `<button class="ucard" data-i="${i}"><div class="em">${D.emoji}</div><div class="nm">${esc(D.name)}</div>${tag}<div class="ds">${esc(ds)}</div><div class="key">${i + 1}</div></button>`;
  }).join('');
  $('cards').querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => choose(+b.dataset.i); });
  $('lvup').classList.remove('hidden');
}
function hideChoices() { game.choices = null; $('lvup').classList.add('hidden'); }
function choose(i) {
  if (!game.choices) return;
  S.sfx('ok');
  if (game.kind === 'solo') { game.sim.pick(game.myId, i); const P = game.sim.players.get(game.myId); if (P.choices) showChoices(P.choices, P.pending); else hideChoices(); }
  else { shell.send({ t: 'pick', i }); hideChoices(); }
}
function togglePause() {
  if (game.kind !== 'solo' || game.mode !== 'play') return;
  game.paused = !game.paused;
  $('paused').classList.toggle('hidden', !game.paused);
  if (game.paused) { const P = V.pl.get(game.myId); $('build').innerHTML = [...Object.entries(P?.w || {}).map(([k, l]) => `<span>${WEAPONS[k].emoji} ${esc(WEAPONS[k].name)} Lv${l}</span>`), ...Object.entries(P?.p || {}).map(([k, l]) => `<span>${PASSIVES[k].emoji} ${esc(PASSIVES[k].name)} Lv${l}</span>`)].join(''); }
}
$('resume-btn').onclick = () => togglePause();
$('giveup-btn').onclick = () => { game.paused = false; $('paused').classList.add('hidden'); if (game.sim) { for (const P of game.sim.players.values()) { P.st = 2; P.deathT = game.sim.t; } game.sim.over = true; endSolo(); } };
$('b-pause').onclick = () => togglePause();

// ---------- HUD ----------
let hudT = 0;
function hud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.1;
  const P = V.pl.get(game.myId); if (!P) return;
  $('xpbar').firstElementChild.style.width = `${Math.min(100, (P.xp / Math.max(1, P.xn)) * 100)}%`; $('lv').textContent = `Lv ${P.lvl}`;
  const t = Math.floor(V.t); $('timer').textContent = `${game.endless ? `♾️ ${V.lv || 1}단계 · ` : `${STAGES[(game.stage || 1) - 1].emoji} ${game.stage}단계 · `}${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('kills').textContent = `🦷 ${P.kills}`;
  $('hp-n').textContent = Math.max(0, Math.ceil(P.hp)); $('hp-bar').firstElementChild.style.width = `${Math.max(0, (P.hp / P.mh) * 100)}%`;
  const sl = (D, l, cls) => `<div class="sl ${cls}${l >= MAX_LV ? ' max' : ''}" title="${esc(D.name)}">${D.emoji}<small>${l >= MAX_LV ? 'MAX' : l}</small></div>`;
  const html = `<div class="row">${Object.entries(P.w).map(([k, l]) => sl(WEAPONS[k], l, 'w')).join('')}</div><div class="row">${Object.entries(P.p).map(([k, l]) => sl(PASSIVES[k], l, 'p')).join('')}</div>`;
  if (game.slotsHtml !== html) { game.slotsHtml = html; $('slots').innerHTML = html; }
  if (game.kind !== 'solo') {
    const ph = [...V.pl.values()].map((Q) => `<div class="pm${Q.id === game.myId ? ' me' : ''}${Q.st === 1 ? ' down' : Q.st === 2 ? ' dead' : ''}"><span class="dot" style="background:${esc(Q.color)}"></span><span class="nm">${esc(Q.name)} · Lv${Q.lvl}</span>${Q.st === 1 ? '🆘' : Q.st === 2 ? '💀' : `<span class="hb"><i style="width:${(Q.hp / Q.mh) * 100}%"></i></span>`}</div>`).join('');
    if (game.partyHtml !== ph) { game.partyHtml = ph; $('party').innerHTML = ph; }
    const W = V.pl.get(game.watch);
    $('spec').classList.toggle('hidden', !(P.st !== 0 && W && W.id !== game.myId));
    if (W && P.st !== 0) $('spec').textContent = P.st === 1 ? '😵 쓰러졌어요 · 친구가 옆에 오면 일어나요' : `👀 ${W.name} 관전 중 · Space 로 바꾸기`;
  }
}

// ---------- 흐름 ----------
function clearView() {
  for (const P of V.pl.values()) P.remove(); V.pl.clear(); V.en.clear(); V.pr.clear(); V.gems.clear();
  for (const m of V.items.values()) scene.remove(m); V.items.clear(); for (const m of V.pud.values()) scene.remove(m); V.pud.clear();
  for (const n of nums) n.el.remove(); nums.length = 0;
  game.slotsHtml = game.partyHtml = ''; $('party').innerHTML = '';
}
function begin(kind, members, ms) {
  clearView();
  game.kind = kind; game.mode = 'play'; game.members = members; game.paused = false; game.watch = game.myId; hideChoices();
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('paused').classList.add('hidden'); $('b-pause').classList.toggle('hidden', kind !== 'solo');
  $('party').classList.toggle('hidden', kind === 'solo');
  game.startAt = performance.now() + ms; countdown(ms); S.music('surv');
  setStageLook(game.endless ? 1 : game.stage);
  if (game.endless) banner('♾️ 무한 모드!', `${ENDLESS_STEP / 60}분마다 단계가 올라 더 세져요 · 우두머리도 계속`);
  else { const S0 = STAGES[game.stage - 1]; banner(`${S0.emoji} ${game.stage}단계 · ${S0.name}`, `${Math.floor(RUN.boss1 / 60)}분 왕 충치균 · ${Math.floor(RUN.boss2 / 60)}분 충치 대마왕`); }
}
function startSolo() {
  S.unlock();
  const p = shell.profile || { name: '곰돌이', color: '#8a5634' };
  game.myId = 1;
  const me = { id: 1, name: p.name, color: p.color, look: p.look, acc: p.acc };
  game.endless = game.pick.mode === 'endless'; game.stage = Math.min(game.pick.stage, unlocked());
  game.sim = new Sim([me], { hard: game.pick.diff === 'hard', stage: game.stage, endless: game.endless });
  game.diff = game.pick.diff;
  begin('solo', [me], 2500);
  apply(game.sim.snapshot(), true);
}
function startMulti(m) {
  S.unlock();
  game.sim = null; game.myId = shell.myId; game.diff = m.diff || 'normal'; game.endless = m.mode === 'endless'; game.stage = m.stage || 1;
  begin('multi', m.members, m.in);
}
function countdown(ms) {
  const el = $('count'), n = $('count-n'); el.classList.remove('hidden');
  const t0 = performance.now();
  const tick = () => { const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000); if (left <= 0) { n.textContent = 'GO!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 500); return; } if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); } setTimeout(tick, 60); };
  tick();
}
const clock = new THREE.Clock();
let acc = 0, sendT = 0, lastDir = '';
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (game.mode === 'play') {
    const started = performance.now() >= game.startAt;
    const [dx, dz] = inputDir();
    if (game.kind === 'solo' && game.sim) {
      game.sim.input(game.myId, dx, dz);
      if (started && !game.paused && !game.choices) {
        game.sim.step(Math.min(dt, 1 / 30)); // 매 프레임 실제 시간만큼 (고정 칸으로 돌리면 어떤 프레임은 안 움직여서 깜빡 · 버벅인다)
        const s = game.sim.snapshot(); apply(s, true);
        const P = game.sim.players.get(game.myId);
        if (P.choices && !game.choices) showChoices(P.choices, P.pending);
      } else acc = 0;
      if (game.sim?.over) endSolo(); // 고르는 창이 떠 있어도 끝나면 끝
      render(dt, false);
    } else {
      sendT -= dt;
      const key = `${dx.toFixed(2)},${dz.toFixed(2)}`;
      if (started && (key !== lastDir || sendT <= 0)) { lastDir = key; sendT = 0.25; shell.send({ t: 'in', d: [+dx.toFixed(2), +dz.toFixed(2)] }); }
      render(dt, true);
    }
    hud(dt);
  } else if (game.mode === 'title') {
    const a = performance.now() / 9000; camera.position.set(Math.cos(a) * 30, 22, Math.sin(a) * 30); camera.lookAt(0, 0, 0);
  }
  stepFx(dt); stepNums(dt);
  // 알갱이 · 바닥이 늘 보이게
  renderer.render(scene, camera);
}

// ---------- 공용 틀 ----------
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellysurv', title: '🦷 젤리 서바이버', subtitle: '충치균 대습격! 걷기만 하면 무기는 저절로<br>레벨업마다 무기 · 능력을 골라 7분을 버텨요', wsPath: '/surv-ws', max: 6,
  multiLabel: '👥 같이 하기 (협동)', roomIcon: '🦷', startLabel: '🦷 다 같이 출동!',
  keysHelp: 'WASD · 방향키(폰은 화면을 끌어서) 이동 · 공격은 저절로 · 레벨업 1 2 3 · P 멈춤(혼자) · 같이 하기: 쓰러진 친구 옆에 서 있으면 살려요',
  buttons: [{ id: 'solo-btn', label: '🦷 혼자 하기 <small>7분 버티고 대마왕 녹이기</small>', onClick: () => startSolo() }],
  extraRow: [{ label: '🏆 순위표', onClick: () => openBoard(game.pick.mode === 'endless' ? 'endless' : game.pick.diff) }],
  screens: ['over', 'board-screen'],
  describe: (o = {}) => `${o.mode === 'endless' ? '♾️ 무한' : `🗺️ ${o.stage || 1}단계`} · ${o.diff === 'hard' ? '🔥 어려움' : '🙂 보통'} · 최대 6명 협동`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onStart: (m) => startMulti(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title' && game.kind !== 'solo') toTitle(); },
});
shell.pickOpts = () => ({ diff: game.pick.diff, mode: game.pick.mode, stage: game.pick.stage });
shell.on('s', (m) => { if (game.mode === 'play' && game.kind !== 'solo') apply(m, false); });
shell.on('ch', (m) => { if (game.mode === 'play') showChoices(m.c, m.pending); });
shell.on('gone', (m) => { const P = V.pl.get(m.id); if (P) { P.remove(); V.pl.delete(m.id); } });
// 스테이지: 깬 다음 단계까지 열린다 (같이 하기는 모두 열림)
const STAGE_KEY = 'jellysurv.cleared';
const unlocked = () => Math.min(STAGES.length, (Number(store.get(STAGE_KEY)) || 0) + 1);
function optsUI(el, o, editable, set, solo) {
  const mode = o.mode || 'stage', open = solo ? unlocked() : STAGES.length;
  el.innerHTML = `<div class="seg mode-seg">${[['stage', '🗺️ 스테이지'], ['endless', '♾️ 무한 모드']].map(([k, l]) => `<button data-m="${k}" class="${mode === k ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}</button>`).join('')}</div>
    ${mode === 'stage' ? `<div class="stage-pick">${STAGES.map((S0, i) => { const n = i + 1, lock = n > open; return `<button data-s="${n}" class="${(o.stage || 1) === n ? 'on' : ''}${lock ? ' lock' : ''}" ${editable && !lock ? '' : 'disabled'} title="${esc(S0.name)}"><b>${lock ? '🔒' : S0.emoji}</b>${n}</button>`; }).join('')}</div><div class="stage-name">${STAGES[(o.stage || 1) - 1].emoji} ${o.stage || 1}단계 · ${esc(STAGES[(o.stage || 1) - 1].name)} <small>단계가 오를수록 충치균이 세고 많아요</small></div>` : '<div class="stage-name">♾️ 끝없이 버티기 · 3분마다 단계가 올라 더 세져요 <small>버틴 시간 순위표</small></div>'}
    <div class="seg diff-seg">${[['normal', '🙂 보통'], ['hard', '🔥 어려움']].map(([k, l]) => `<button data-d="${k}" class="${(o.diff || 'normal') === k ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}</button>`).join('')}</div>`;
  el.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => set({ diff: b.dataset.d }); });
  el.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => set({ mode: b.dataset.m }); });
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => set({ stage: +b.dataset.s }); });
}
function renderTitleOpts() { game.pick.stage = Math.min(game.pick.stage, unlocked()); optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }, true); }

// ---------- 결과 ----------
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function rowHtml(e) { return `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${esc(e.name)} <small style="opacity:.7">Lv${e.lvl} · ${fmt(e.time)}</small></span><span class="sc">${e.kills}<small>마리 · 피해 ${e.dmg}</small></span></div>`; }
function finishView() { game.mode = 'over'; S.stopMusic(); hideChoices(); $('hud').classList.add('hidden'); $('paused').classList.add('hidden'); }
function results(m) {
  finishView();
  const mine = m.rank.find((e) => e.id === game.myId);
  $('ov-title').textContent = m.win ? '🍬 승리! 충치 대마왕 퇴치!' : `😵 충치균에게 졌어요 · ${fmt(m.time)} 버팀`;
  $('ov-me').textContent = mine ? `나: ${mine.kills}마리 녹임 · Lv${mine.lvl} · 피해 ${mine.dmg}` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => rowHtml({ ...e, look: game.members.find((x) => x.id === e.id)?.look })).join('');
  $('ov-save').classList.add('hidden');
  $('again-btn').textContent = '🔁 방으로 돌아가기';
  if (m.win) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
}
async function endSolo() {
  if (game.mode !== 'play') return;
  finishView();
  const sim = game.sim, r = sim.result()[0];
  // 스테이지: 점수 = 처치 + 시간 + 승리 보너스(단계가 높을수록 큼) · 무한: 버틴 시간(초)
  const score = game.endless ? r.time : r.kills + r.time * 2 + (sim.win ? 1500 + 500 * game.stage : 0) + (game.stage - 1) * 300;
  if (sim.win && !game.endless && game.stage >= unlocked() - 0 && game.stage < STAGES.length + 1) store.set(STAGE_KEY, String(Math.max(Number(store.get(STAGE_KEY)) || 0, game.stage)));
  const next = sim.win && !game.endless && game.stage < STAGES.length;
  $('ov-title').textContent = game.endless ? `♾️ ${fmt(r.time)} 버텼어요 · ${sim.lv()}단계` : sim.win ? `🍬 승리! ${game.stage}단계 클리어!` : `😵 ${game.stage}단계 · ${fmt(r.time)} 버텼어요`;
  $('ov-me').textContent = `🦷 ${r.kills}마리 · Lv${r.lvl}${game.endless ? '' : ` · 점수 ${score}`}${next ? ` · 🔓 ${game.stage + 1}단계 열림!` : ''}`;
  $('ov-rank').innerHTML = ''; $('again-btn').textContent = next ? `▶ ${game.stage + 1}단계로` : '🔁 한 판 더';
  game.nextStage = next;
  if (sim.win) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
  game.rec = { b: game.endless ? 'endless' : game.diff, score, color: shell.profile?.color };
  $('ov-rank').dataset.b = game.rec.b;
  if (shell.logged()) await saveRecord({ ...game.rec, name: shell.profile?.name });
  else { $('ov-save').classList.remove('hidden'); $('ov-nick').value = store.get('jellysurv.nick') || shell.profile?.name || ''; showTop(game.rec.b); }
}
function anonId() { let a = store.get(ANON_KEY); if (!/^[a-f0-9]{24}$/.test(a || '')) { a = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set(ANON_KEY, a); } return a; }
async function saveRecord(rec) {
  try {
    const r = await account.api('/api/surv/record', { method: 'POST', body: rec });
    $('ov-me').textContent += r.best ? ` · 🎉 새 최고 기록! ${r.me?.rank}등` : ` · 최고 ${r.me?.value}점 (${r.me?.rank}등)`;
    if (r.best) confetti();
    renderTop(r.top, r.me);
  } catch (e) { $('ov-me').textContent += ` · 기록 저장 실패 (${e.message})`; }
}
$('ov-save-btn').onclick = async () => { const name = $('ov-nick').value.trim(); if (!name) return shell.toast('닉네임을 정해 주세요'); store.set('jellysurv.nick', name); $('ov-save').classList.add('hidden'); await saveRecord({ ...game.rec, name, anon: anonId() }); };
function renderTop(top, me, el = $('ov-rank')) {
  el.innerHTML = (top || []).slice(0, 10).map((e) => `<div class="brow${e.id === me?.id ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : e.anon ? ' <span class="guest">비로그인</span>' : ''}</span><span class="sc">${el.dataset.b === 'endless' ? fmt(e.value) : `${e.value}<small>점</small>`}</span></div>`).join('') || '<div class="empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</div>';
  if (me && me.rank > 10) el.insertAdjacentHTML('beforeend', `<div class="brow gap">⋯</div><div class="brow me"><span class="rk">${me.rank}</span><span class="nm">${esc(me.name)}</span><span class="sc">${me.value}<small>점</small></span></div>`);
}
async function showTop(b, el = $('ov-rank')) { el.dataset.b = b; try { const d = await account.api(`/api/surv/board?b=${b}` + (shell.logged() ? '' : `&anon=${anonId()}`)); renderTop(d.top, d.me, el); } catch { /* 무시 */ } }
function openBoard(b) {
  $('bd-seg').innerHTML = [['normal', '🙂 스테이지 보통'], ['hard', '🔥 스테이지 어려움'], ['endless', '♾️ 무한 (버틴 시간)']].map(([k, l]) => `<button data-b="${k}" class="${k === b ? 'on' : ''}">${l}</button>`).join('');
  $('bd-seg').querySelectorAll('[data-b]').forEach((x) => { x.onclick = () => openBoard(x.dataset.b); });
  $('bd-list').innerHTML = '<div class="empty">불러오는 중…</div>';
  shell.show('board-screen'); showTop(b, $('bd-list'));
}
$('bd-back').onclick = () => shell.show('title');
$('again-btn').onclick = () => { if (game.kind === 'solo') { if (game.nextStage) { game.pick.stage = game.stage + 1; store.set(PICK_KEY, JSON.stringify(game.pick)); } return startSolo(); } game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { if (game.kind !== 'solo') { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() { game.mode = 'title'; game.sim = null; S.stopMusic(); shell.multi = false; shell.playing = false; hideChoices(); clearView(); for (const id of ['hud', 'count', 'paused']) $(id).classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (game.kind === 'solo' && game.mode === 'play') { if (!confirm('그만할까요? 지금까지 버틴 기록은 남아요')) return; $('giveup-btn').onclick(); return; } quit(); };

renderTitleOpts();
shell.boot();
frame();
