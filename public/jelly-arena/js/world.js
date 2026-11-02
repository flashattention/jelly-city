// 젤리 아레나 맵 그리기: 바닥 무늬 · 숲 · 강 · 수풀 · 포탑 · 수문 · 젤리 심장
import * as THREE from 'three';
import { isPhone } from '../../shared/js/perf.js';
import { SIZE, N, CELL, GRID, LANES, BASE, BUSHES, STRUCTS, FOUNTAIN, TEAMS, CAMPS, EPICS } from './data.js';

const toon = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const glow = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op });
export const TC = { blue: '#4cc3ff', red: '#ff5a7a' };
export function groundCanvas() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), k = S / (SIZE * 2), P = (a) => (a + SIZE) * k;
  x.fillStyle = '#2d5a3a'; x.fillRect(0, 0, S, S);
  // 걸을 수 있는 땅: 부드러운 풀밭
  x.fillStyle = '#7fb56b';
  const cs = CELL * k;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (!GRID[j * N + i]) x.fillRect(i * cs - 0.5, j * cs - 0.5, cs + 1, cs + 1);
  // 풀 얼룩
  let seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2600; i++) { const px = R() * S, py = R() * S; x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,40,10,.05)'; x.beginPath(); x.arc(px, py, 3 + R() * 12, 0, 7); x.fill(); }
  // 길
  x.lineCap = 'round'; x.lineJoin = 'round';
  const stroke = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = w * k; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(P(a), P(b)) : x.moveTo(P(a), P(b)))); x.stroke(); };
  for (const pts of Object.values(LANES)) stroke(pts, 12, '#d8bd86');
  for (const pts of Object.values(LANES)) stroke(pts, 8.5, '#e6cd99');
  // 강
  stroke([[-72, -72], [72, 72]], 10.5, '#3d90c9'); stroke([[-72, -72], [72, 72]], 7, '#6ec6ff'); for (let i = -68; i < 68; i += 9) { x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(P(i), P(i + 1)); x.lineTo(P(i + 4), P(i + 5)); x.stroke(); }
  // 기지
  for (const t of ['blue', 'red']) { const [a, b] = BASE[t]; const g = x.createRadialGradient(P(a), P(b), 8, P(a), P(b), 24 * k); g.addColorStop(0, t === 'blue' ? 'rgba(90,190,255,.75)' : 'rgba(255,110,150,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(P(a), P(b), 24 * k, 0, 7); x.fill(); }
  // 수풀
  for (const [a, b, r] of BUSHES) { x.fillStyle = '#3f7d43'; x.beginPath(); x.arc(P(a), P(b), r * k, 0, 7); x.fill(); }
  return c;
}
function gumTrees(scene) {
  // 숲: 길에 닿는 가장자리 나무는 다 놓고, 안쪽은 드문드문
  const near = (i, j) => { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N && !GRID[b * N + a]) return true; } return false; };
  let seed = 11; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const spots = [];
  // 맵 바깥도 숲이 이어진다 (가장자리가 잘려 보이지 않게)
  for (let i = 0; i < (isPhone ? 400 : 1100); i++) { const x = (R() * 2 - 1) * (SIZE + 42), z = (R() * 2 - 1) * (SIZE + 42); if (Math.abs(x) > SIZE + 1 || Math.abs(z) > SIZE + 1) spots.push([x, z, 1 + R() * 1.1, R()]); }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (!GRID[j * N + i]) continue; if (near(i, j) ? R() < 0.62 : R() < 0.16) spots.push([-SIZE + (i + 0.5 + (R() - 0.5) * 0.5) * CELL, -SIZE + (j + 0.5 + (R() - 0.5) * 0.5) * CELL, 0.7 + R() * 0.7, R()]); }
  const top = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.25, isPhone ? 0 : 1), toon('#ffffff', { flatShading: true }), spots.length), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.42, 1.8, 6), toon('#7a5a3f'), spots.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), col = new THREE.Color();
  const pal = ['#3f9d5a', '#4cae66', '#2f8a58', '#6fbf5f', '#3a9a7a', '#7cc06a', '#ff9fc4', '#c79bff'];
  spots.forEach(([x, z, s, r], i) => {
    M.compose(new THREE.Vector3(x, 1.8 * s + 0.9, z), Q.setFromEuler(new THREE.Euler(0, r * 6, 0)), new THREE.Vector3(s, s * 1.15, s)); top.setMatrixAt(i, M);
    col.set(pal[r < 0.05 ? 6 : r < 0.09 ? 7 : Math.floor(r * 6)]); top.setColorAt(i, col);
    M.compose(new THREE.Vector3(x, 0.9 * s, z), Q.identity(), new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, M);
  });
  top.instanceColor.needsUpdate = true; scene.add(top, trunk);
}
function bushes(scene) {
  const parts = []; let seed = 5; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const [x, z, r] of BUSHES) for (let i = 0; i < r * r * 1.6; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * r; parts.push([x + Math.cos(a) * d, z + Math.sin(a) * d, 0.7 + R() * 0.6]); }
  const m = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1.9, 5), toon('#3f9a4b', { flatShading: true }), parts.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  parts.forEach(([x, z, s], i) => { M.compose(new THREE.Vector3(x, 0.9 * s, z), Q, new THREE.Vector3(s, s, s)); m.setMatrixAt(i, M); });
  scene.add(m);
}
// 건물 모양
export function makeStruct(k, team, tier) {
  const g = new THREE.Group(), c = TC[team];
  const stone = toon(team === 'blue' ? '#c9dcec' : '#f0d0d8'), dark = toon(team === 'blue' ? '#5b7da0' : '#a0606e'), add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; g.add(m); return m; };
  if (k === 'tower') {
    const H = 3.6 + (tier || 1) * 0.3;
    add(new THREE.CylinderGeometry(1.5, 1.8, 0.7, 8), dark, 0, 0.35, 0);
    add(new THREE.CylinderGeometry(0.85, 1.25, H, 8), stone, 0, 0.7 + H / 2, 0);
    add(new THREE.CylinderGeometry(1.25, 0.95, 0.6, 8), dark, 0, 0.7 + H + 0.2, 0);
    g.userData.gem = add(new THREE.OctahedronGeometry(0.75, 0), glow(c), 0, 0.7 + H + 1.3, 0);
    g.userData.top = 0.7 + H + 1.3;
  } else if (k === 'gate') {
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.4, 0.55, 3.4, 8), stone, s * 1.5, 1.7, 0);
    add(new THREE.BoxGeometry(4.2, 0.6, 0.9), dark, 0, 3.5, 0);
    g.userData.gem = add(new THREE.IcosahedronGeometry(0.85, 0), glow(c), 0, 1.9, 0); g.userData.top = 2.2;
    g.rotation.y = Math.PI / 4;
  } else {
    add(new THREE.CylinderGeometry(3.4, 4, 0.9, 12), dark, 0, 0.45, 0); add(new THREE.CylinderGeometry(2.4, 2.9, 0.7, 12), stone, 0, 1.2, 0);
    const heart = new THREE.Shape(); heart.moveTo(0, -1.3); heart.bezierCurveTo(-2.4, 0.2, -1.1, 1.8, 0, 0.7); heart.bezierCurveTo(1.1, 1.8, 2.4, 0.2, 0, -1.3);
    const geo = new THREE.ExtrudeGeometry(heart, { depth: 0.8, bevelEnabled: true, bevelSize: 0.22, bevelThickness: 0.25, bevelSegments: 3, steps: 1 }); geo.center();
    const h = add(geo, new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.55 }), 0, 4.1, 0, 1.25, 1.25, 1.25); g.userData.gem = h; g.userData.top = 4.1; g.userData.heart = true;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.5; add(new THREE.OctahedronGeometry(0.35, 0), glow(c), Math.cos(a) * 3, 2.4, Math.sin(a) * 3); }
  }
  return g;
}
export function buildWorld(scene) {
  scene.background = new THREE.Color('#1c3326');
  scene.add(new THREE.HemisphereLight('#ffffff', '#6a7a60', 1.5));
  const sun = new THREE.DirectionalLight('#fff4dd', 1.4); sun.position.set(-20, 40, 12); scene.add(sun);
  const gc = groundCanvas(), tex = new THREE.CanvasTexture(gc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2, SIZE * 2), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 6, SIZE * 6), toon('#234a30')); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.1; scene.add(outer);
  gumTrees(scene); bushes(scene);
  // 샘 (회복 자리): 젤리가 솟는 분수
  for (const t of ['blue', 'red']) {
    const [x, z] = FOUNTAIN[t], c = TC[t], base = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 0.7, 16), toon(t === 'blue' ? '#c9dcec' : '#f0d0d8')); base.position.set(x, 0.35, z); scene.add(base);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 16), glow(c, 0.85)); pool.position.set(x, 0.75, z); scene.add(pool);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.6, 2.4, 10), glow(c, 0.6)); jet.position.set(x, 1.9, z); scene.add(jet);
    const r = new THREE.Mesh(new THREE.RingGeometry(10.8, 12, 48), new THREE.MeshBasicMaterial({ color: TC[t], transparent: true, opacity: 0.5, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.06, z); scene.add(r);
  }
  // 전장의 안개: 작은 그림을 바닥 위에 깐다
  const fogC = document.createElement('canvas'); fogC.width = fogC.height = 128; const fogT = new THREE.CanvasTexture(fogC); fogT.minFilter = fogT.magFilter = THREE.LinearFilter;
  const fog = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2, SIZE * 2), new THREE.MeshBasicMaterial({ map: fogT, transparent: true, depthWrite: false })); fog.rotation.x = -Math.PI / 2; fog.position.y = 0.3; fog.renderOrder = 1; fog.visible = false; scene.add(fog);
  return { ground, gc, fog, fogC, fogT };
}
