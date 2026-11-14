// ⏳ 시간 여행: 모양 만들기 도우미 (풍경 · 장면 · 길 위 배역이 같이 쓴다)
//   젤리 러너 감성: 둥글둥글 툰 + 빛나는 점 · 띠. 사람은 모두 '젤리 사람'(둥근 몸 · 머리 · 귀)에 시대 옷 · 소품
import * as THREE from 'three';
import { toon, G, geo } from '../../shared/js/utils.js';
import { glow } from './kits.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE, toon, G, geo, glow };
// 한 묶음 안의 멈춘 그물을 꼭짓점 색으로 합친다 (dynamic 표시된 자식은 그대로 둔다) — 사람 몸 · 머리
const VC_T = new THREE.MeshToonMaterial({ vertexColors: true }), VC_B = new THREE.MeshBasicMaterial({ vertexColors: true });
const INVM = new THREE.Matrix4(), MM = new THREE.Matrix4();
export function bakeLocal(root) {
  root.updateMatrixWorld(true); INVM.copy(root.matrixWorld).invert();
  const B2 = { t: [], b: [] }, rm = [];
  const visit = (o) => { if (o.userData.dynamic) return; if (o.isMesh && !Array.isArray(o.material) && !o.material.transparent && !o.material.map && (o.material.isMeshToonMaterial || o.material.isMeshBasicMaterial)) { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const n of Object.keys(g.attributes)) if (!['position', 'normal'].includes(n)) g.deleteAttribute(n); const c = o.material.color, cnt = g.attributes.position.count, a = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.applyMatrix4(MM.multiplyMatrices(INVM, o.matrixWorld)); (o.material.isMeshToonMaterial ? B2.t : B2.b).push(g); rm.push(o); } for (const c of o.children) visit(c); };
  for (const c of root.children) visit(c);
  for (const o of rm) o.parent.remove(o);
  for (const [k, list] of Object.entries(B2)) if (list.length) { const g = mergeGeometries(list, false); if (g) { g.computeBoundingSphere(); const m = new THREE.Mesh(g, k === 't' ? VC_T : VC_B); m.userData.own = true; root.add(m); } }
  return root;
}
export const M = (c) => (typeof c === 'object' ? c : toon(c));
export function add(p, g, mat, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(g, M(mat)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); p.add(m); return m; }
export const grp = (...ch) => { const g = new THREE.Group(); for (const c of ch) g.add(c); return g; };
// 상자(가운데) · 상자(바닥) · 원기둥(바닥) · 공 · 원뿔(바닥) · 고리
export const B = (p, c, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) => add(p, G.box(), c, x, y, z, w, h, d, rx, ry, rz);
export const Bb = (p, c, x, y, z, w, h, d, ry = 0) => add(p, G.box(), c, x, y + h / 2, z, w, h, d, 0, ry);
export const C = (p, c, x, y, z, r, h, low = true, rx = 0, rz = 0) => add(p, low ? G.cylLow() : G.cyl(), c, x, y + h / 2, z, r, h, r, rx, 0, rz);
export const Cc = (p, c, x, y, z, r, h, rx = 0, ry = 0, rz = 0) => add(p, G.cylLow(), c, x, y, z, r, h, r, rx, ry, rz); // 원기둥 (가운데 · 돌리기)
export const S = (p, c, x, y, z, sx, sy = sx, sz = sx) => add(p, G.sphereLow(), c, x, y, z, sx, sy, sz);
export const Sh = (p, c, x, y, z, sx, sy = sx, sz = sx) => add(p, G.sphere(), c, x, y, z, sx, sy, sz);
export const K = (p, c, x, y, z, r, h, rx = 0, rz = 0) => add(p, G.cone(), c, x, y + h / 2, z, r, h, r, rx, 0, rz);
export const Kc = (p, c, x, y, z, r, h, rx = 0, ry = 0, rz = 0) => add(p, G.cone(), c, x, y, z, r, h, r, rx, ry, rz);
const torG = (r, t, arc = 6.2832) => geo(`ttor${r}_${t}_${arc.toFixed(2)}`, () => new THREE.TorusGeometry(r, t, 8, 28, arc));
export const T = (p, c, x, y, z, r, t, rx = 0, ry = 0, rz = 0, arc) => add(p, torG(r, t, arc), c, x, y, z, 1, 1, 1, rx, ry, rz);
export const hemi = (p, c, x, y, z, sx, sy = sx, sz = sx) => add(p, G.hemi(), c, x, y, z, sx, sy, sz);
const octG = () => geo('toct', () => new THREE.OctahedronGeometry(1, 0)), icoG = () => geo('tico0', () => new THREE.IcosahedronGeometry(1, 0)), dodG = () => geo('tdod', () => new THREE.DodecahedronGeometry(1, 0));
export const Oct = (p, c, x, y, z, sx, sy = sx, sz = sx, ry = 0) => add(p, octG(), c, x, y, z, sx, sy, sz, 0, ry);
export const Rock = (p, c, x, y, z, sx, sy = sx, sz = sx, ry = 0) => add(p, dodG(), c, x, y, z, sx, sy, sz, 0, ry);
export const Ico = (p, c, x, y, z, sx, sy = sx, sz = sx) => add(p, icoG(), c, x, y, z, sx, sy, sz);
// 모양을 밀어 만든 판 (점 목록 [x, y]) — 기둥 머리 · 깃발 · 잎 등
export function shapeG(key, pts, depth = 0.1) { return geo('shp' + key, () => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2); }); }
// 돌리기 모양 (옆선 [반지름, 높이]) — 항아리 · 돔 · 탑
export function latheG(key, pts, seg = 14) { return geo('lth' + key, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)); }
export const Lathe = (p, c, key, pts, x, y, z, s = 1, seg) => add(p, latheG(key, pts, seg), c, x, y, z, s, s, s);

// ---------- 움직임 ----------
export const spin = (speed, axis = 'y') => (o, t, dt) => { o.rotation[axis] += speed * dt; };
export const bob = (amp, sp, ph = Math.random() * 6) => (o, t) => { o.position.y = (o.userData.y0 ?? 0) + Math.sin(t * sp + ph) * amp; };
export const both = (...fs) => (o, t, dt) => { for (const f of fs) f(o, t, dt); };
// 불꽃: 원뿔 세 겹이 일렁인다 (dynamic → 묶지 않음)
export function flame(p, x, y, z, s = 1, cols = ['#ff3d00', '#ffa000', '#fff59d']) {
  const f = new THREE.Group(); f.position.set(x, y, z); f.userData.dynamic = true; p.add(f);
  const parts = cols.map((c, i) => { const m = add(f, G.cone(), glow(c, i ? 0.92 : 0.85), 0, (0.5 - i * 0.08) * s, 0, (0.42 - i * 0.12) * s, (1 - i * 0.22) * s, (0.42 - i * 0.12) * s); return m; });
  f.userData.flick = (t) => parts.forEach((m, i) => { const k = 1 + Math.sin(t * (11 + i * 4) + x * 3 + z) * 0.14; m.scale.y = (1 - i * 0.22) * s * k; m.rotation.z = Math.sin(t * 7 + i) * 0.08; });
  return f;
}
// 연기: 회색 공 몇 개가 위로 올라가며 커졌다 사라진다
export function smoke(p, x, y, z, s = 1, col = '#5e5650', n = 4) {
  const f = new THREE.Group(); f.position.set(x, y, z); f.userData.dynamic = true; p.add(f);
  const ms = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.sphereLow(), new THREE.MeshToonMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false })); f.add(m); ms.push(m); }
  f.userData.flick = (t) => ms.forEach((m, i) => { const k = ((t * 0.35 + i / n) % 1); m.position.set(Math.sin(i * 2 + t * 0.5) * 0.4 * s, k * 6 * s, Math.cos(i) * 0.3 * s); m.scale.setScalar((0.5 + k * 1.6) * s); m.material.opacity = 0.65 * (1 - k); });
  return f;
}
// 모든 불꽃 · 연기를 한 번에 움직이는 anim 을 붙인다 (extra 가 있으면 같이)
export function liven(o, extra) { const fl = []; o.traverse((c) => { if (c.userData.flick) fl.push(c); }); o.userData.anim = (q, t, dt) => { for (const c of fl) c.userData.flick(t); extra?.(q, t, dt); }; return o; }

// ---------- 젤리 사람 ----------
//   o: skin 피부 · top 웃옷 · bot 아래(다리) · robe 긴 옷 색 · cape 망토 색 · armor 갑옷 색 · belt 띠 색
//      hat 모자 종류(아래 HATS) · hatC 모자 색 · r / l 오른손 · 왼손 소품(아래 HOLD) · rc / lc 소품 색 · beard 수염 색 · hair 머리 색 · s 크기
//   돌려주는 g.userData.parts: body · head · armR · armL · legs · itemR · itemL (장면이 휘두르기 · 걷기에 쓴다)
//   키는 약 1.45m (s=1), 앞은 +z
export const SKINS = ['#f2c28a', '#e0a875', '#c68e5d', '#8a5634', '#ffd8b0', '#a86f43'];
export function person(r, o = {}) {
  const s = o.s ?? 1, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = o.skin || r.pick(SKINS), top = o.top || '#9e9e9e', bot = o.bot || shadeHex(top, 0.6);
  // 몸통 · 머리 · 귀 · 눈 · 볼
  add(body, G.sphereLow(), o.armor || top, 0, 0.64 * s, 0, 0.34 * s, 0.4 * s, 0.3 * s);
  if (o.robe) add(body, G.cone(), o.robe, 0, 0.42 * s, 0, 0.42 * s, 0.7 * s, 0.38 * s);
  if (o.belt) add(body, G.cylLow(), o.belt, 0, 0.5 * s, 0, 0.33 * s, 0.07 * s, 0.29 * s);
  const head = new THREE.Group(); head.position.y = 1.13 * s; body.add(head);
  add(head, G.sphereLow(), skin, 0, 0, 0, 0.31 * s, 0.3 * s, 0.3 * s);
  if (!o.noEars) for (const sx of [-1, 1]) add(head, G.sphereLow(), skin, sx * 0.21 * s, 0.25 * s, 0, 0.1 * s, 0.1 * s, 0.08 * s);
  for (const sx of [-1, 1]) { add(head, G.sphereLow(), '#1a1a1a', sx * 0.1 * s, 0.02 * s, 0.27 * s, 0.035 * s, 0.045 * s, 0.03 * s); add(head, G.sphereLow(), '#ff8a9a', sx * 0.17 * s, -0.07 * s, 0.24 * s, 0.05 * s, 0.03 * s, 0.02 * s); }
  if (o.hair) add(head, G.sphereLow(), o.hair, 0, 0.1 * s, -0.04 * s, 0.32 * s, 0.24 * s, 0.3 * s);
  if (o.beard) add(head, G.sphereLow(), o.beard, 0, -0.17 * s, 0.17 * s, 0.2 * s, 0.14 * s, 0.12 * s);
  if (o.hat) (HATS[o.hat] || (() => {}))(head, s, o.hatC, r);
  // 팔: 어깨에서 돌아가게 (손 = 공)
  const arm = (sx, item, ic) => { const a = new THREE.Group(); a.position.set(sx * 0.33 * s, 0.86 * s, 0); body.add(a); add(a, G.sphereLow(), o.armor ? o.sleeve || top : top, 0, -0.18 * s, 0, 0.09 * s, 0.22 * s, 0.09 * s); add(a, G.sphereLow(), skin, 0, -0.38 * s, 0.02 * s, 0.075 * s, 0.075 * s, 0.075 * s); a.rotation.z = sx * 0.25; let it = null; if (item && HOLD[item]) { it = new THREE.Group(); it.position.set(0, -0.38 * s, 0.05 * s); a.add(it); HOLD[item](it, s, ic, sx); } return [a, it]; };
  const [armR, itemR] = arm(1, o.r, o.rc), [armL, itemL] = arm(-1, o.l, o.lc);
  if (o.cape) { const c = add(body, G.box(), o.cape, 0, 0.6 * s, -0.3 * s, 0.56 * s, 0.85 * s, 0.05 * s); c.rotation.x = 0.12; }
  const legs = [-1, 1].map((sx) => add(g, G.sphereLow(), bot, sx * 0.13 * s, 0.22 * s, 0, 0.1 * s, 0.24 * s, 0.1 * s));
  // 몸 · 머리 · 모자는 그물 하나로 합친다 (팔은 휘두르니 그대로) — 그리기 호출 20 → 약 8
  armR.userData.dynamic = armL.userData.dynamic = true; bakeLocal(body);
  g.userData.parts = { body, head, armR, armL, legs, itemR, itemL };
  // 기본 걷기: walk(시간) 이 있으면 그걸로, 없으면 제자리
  g.userData.anim = (q, t) => { const w = (q.userData.walk ?? 0) * 9; body.position.y = Math.abs(Math.sin(w)) * 0.06; legs[0].position.z = Math.sin(w) * 0.12; legs[1].position.z = -Math.sin(w) * 0.12; armR.rotation.x = -Math.sin(w) * 0.3; armL.rotation.x = Math.sin(w) * 0.3; };
  return g;
}
export function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
// 모자 · 투구: 머리(head) 기준 좌표 (머리 반지름 약 0.3)
export const HATS = {
  galea: (h, s, c = '#b0b6bf') => { hemi(h, c, 0, 0.06 * s, 0, 0.33 * s, 0.3 * s, 0.33 * s); add(h, G.box(), '#c62828', 0, 0.38 * s, 0, 0.05 * s, 0.16 * s, 0.4 * s); for (const sx of [-1, 1]) add(h, G.box(), c, sx * 0.27 * s, -0.08 * s, 0.08 * s, 0.04 * s, 0.2 * s, 0.16 * s); },
  corinth: (h, s, c = '#c9a227') => { hemi(h, c, 0, 0.04 * s, 0, 0.34 * s, 0.32 * s, 0.34 * s); add(h, G.box(), '#1565c0', 0, 0.4 * s, -0.02 * s, 0.06 * s, 0.22 * s, 0.46 * s); add(h, G.box(), c, 0, -0.06 * s, 0.25 * s, 0.05 * s, 0.24 * s, 0.05 * s); },
  round: (h, s, c = '#8d8d8d') => { hemi(h, c, 0, 0.06 * s, 0, 0.33 * s, 0.3 * s, 0.33 * s); add(h, G.box(), c, 0, -0.02 * s, 0.3 * s, 0.05 * s, 0.2 * s, 0.04 * s); },
  knight: (h, s, c = '#cfd8dc') => { add(h, G.cylLow(), c, 0, 0.05 * s, 0, 0.34 * s, 0.56 * s, 0.34 * s); add(h, G.box(), '#263238', 0, 0.04 * s, 0.33 * s, 0.4 * s, 0.05 * s, 0.03 * s); add(h, G.box(), '#c62828', 0, 0.38 * s, 0, 0.3 * s, 0.05 * s, 0.05 * s); },
  nemes: (h, s, c = '#1e66c8') => { hemi(h, '#f4d03f', 0, 0.04 * s, -0.02 * s, 0.35 * s, 0.3 * s, 0.35 * s); for (let i = 0; i < 4; i++) add(h, G.box(), c, 0, 0.06 * s + i * 0.06 * s, -0.02 * s, 0.72 * s, 0.025 * s, 0.66 * s); for (const sx of [-1, 1]) add(h, G.box(), '#f4d03f', sx * 0.3 * s, -0.25 * s, 0.05 * s, 0.1 * s, 0.4 * s, 0.14 * s); add(h, G.sphereLow(), '#e53935', 0, 0.25 * s, 0.3 * s, 0.04 * s); },
  laurel: (h, s, c = '#7cb342') => { add(h, torG(0.3, 0.035), c, 0, 0.14 * s, 0, s, s, s, Math.PI / 2 - 0.15); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(h, G.sphereLow(), c, Math.cos(a) * 0.3 * s, 0.16 * s, Math.sin(a) * 0.3 * s, 0.06 * s, 0.03 * s, 0.035 * s); } },
  crown: (h, s, c = '#ffca28') => { add(h, G.cylLow(), c, 0, 0.3 * s, 0, 0.24 * s, 0.12 * s, 0.24 * s); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(h, G.cone(), c, Math.cos(a) * 0.22 * s, 0.42 * s, Math.sin(a) * 0.22 * s, 0.05 * s, 0.13 * s, 0.05 * s); } add(h, G.sphereLow(), glow('#e53935'), 0, 0.3 * s, 0.24 * s, 0.035 * s); },
  turban: (h, s, c = '#fafafa') => { add(h, G.sphereLow(), c, 0, 0.2 * s, -0.02 * s, 0.34 * s, 0.24 * s, 0.34 * s); add(h, torG(0.3, 0.07), c, 0, 0.1 * s, 0, s, s, s, Math.PI / 2); add(h, G.sphereLow(), glow('#4dd0e1'), 0, 0.18 * s, 0.32 * s, 0.04 * s); },
  straw: (h, s, c = '#e6c97a') => { add(h, G.cone(), c, 0, 0.3 * s, 0, 0.62 * s, 0.24 * s, 0.62 * s); },
  phrygian: (h, s, c = '#d32f2f') => { add(h, G.sphereLow(), c, 0, 0.2 * s, -0.02 * s, 0.33 * s, 0.24 * s, 0.33 * s); add(h, G.cone(), c, 0, 0.38 * s, 0.12 * s, 0.14 * s, 0.26 * s, 0.14 * s, 0.9); add(h, G.sphereLow(), '#fafafa', 0.27 * s, 0.12 * s, 0.1 * s, 0.07 * s); },
  tophat: (h, s, c = '#212121') => { add(h, G.cylLow(), c, 0, 0.24 * s, 0, 0.42 * s, 0.03 * s, 0.42 * s); add(h, G.cylLow(), c, 0, 0.42 * s, 0, 0.23 * s, 0.36 * s, 0.23 * s); add(h, G.cylLow(), '#b71c1c', 0, 0.28 * s, 0, 0.235 * s, 0.06 * s, 0.235 * s); },
  bicorne: (h, s, c = '#1a1a1a') => { add(h, G.box(), c, 0, 0.3 * s, 0, 0.8 * s, 0.26 * s, 0.14 * s); add(h, G.sphereLow(), '#1565c0', 0.12 * s, 0.32 * s, 0.08 * s, 0.07 * s); add(h, G.sphereLow(), '#e53935', 0.12 * s, 0.32 * s, 0.1 * s, 0.035 * s); },
  tricorne: (h, s, c = '#1a1a1a') => { for (let i = 0; i < 3; i++) add(h, G.box(), c, Math.cos(i * 2.09) * 0.16 * s, 0.28 * s, Math.sin(i * 2.09) * 0.16 * s, 0.5 * s, 0.14 * s, 0.08 * s, 0, -i * 2.09 + Math.PI / 2); hemi(h, c, 0, 0.22 * s, 0, 0.26 * s, 0.16 * s, 0.26 * s); },
  brodie: (h, s, c = '#5d6b3a') => { add(h, G.cylLow(), c, 0, 0.22 * s, 0, 0.5 * s, 0.03 * s, 0.5 * s); hemi(h, c, 0, 0.22 * s, 0, 0.3 * s, 0.2 * s, 0.3 * s); },
  m1: (h, s, c = '#4b5a2a') => { hemi(h, c, 0, 0.08 * s, 0, 0.36 * s, 0.32 * s, 0.36 * s); add(h, G.cylLow(), c, 0, 0.08 * s, 0, 0.38 * s, 0.03 * s, 0.38 * s); },
  astro: (h, s, c = '#fafafa') => { add(h, G.sphereLow(), c, 0, 0.02 * s, 0, 0.42 * s, 0.4 * s, 0.4 * s); add(h, G.sphereLow(), glow('#ffb300', 0.9), 0, 0.02 * s, 0.17 * s, 0.3 * s, 0.24 * s, 0.25 * s); },
  fur: (h, s, c = '#6d4c41') => { add(h, G.cylLow(), c, 0, 0.24 * s, 0, 0.34 * s, 0.24 * s, 0.34 * s); add(h, G.sphereLow(), shadeHex(c, 0.7), 0, 0.38 * s, 0, 0.18 * s, 0.1 * s, 0.18 * s); },
  mongol: (h, s, c = '#8d2a1c') => { add(h, G.cone(), c, 0, 0.36 * s, 0, 0.33 * s, 0.4 * s, 0.33 * s); add(h, G.cylLow(), '#5d4037', 0, 0.2 * s, 0, 0.36 * s, 0.1 * s, 0.36 * s); add(h, G.sphereLow(), '#ffca28', 0, 0.58 * s, 0, 0.05 * s); },
  hood: (h, s, c = '#5d4037') => { add(h, G.sphereLow(), c, 0, 0.06 * s, -0.06 * s, 0.36 * s, 0.36 * s, 0.34 * s); },
  feather: (h, s, c = '#43a047') => { add(h, G.cylLow(), '#ffca28', 0, 0.18 * s, 0, 0.32 * s, 0.08 * s, 0.32 * s); ['#e53935', c, '#1e88e5', '#ffca28', c, '#e53935', '#1e88e5'].forEach((fc, i) => { const a = -0.9 + i * 0.3; add(h, G.sphereLow(), fc, Math.sin(a) * 0.28 * s, 0.48 * s, -0.12 * s, 0.06 * s, 0.32 * s, 0.03 * s, 0, 0, -a); }); },
  beak: (h, s, c = '#212121') => { hemi(h, c, 0, 0.1 * s, -0.02 * s, 0.36 * s, 0.34 * s, 0.36 * s); add(h, G.cone(), '#e8dcc0', 0, -0.06 * s, 0.42 * s, 0.1 * s, 0.38 * s, 0.1 * s, Math.PI / 2); for (const sx of [-1, 1]) add(h, G.sphereLow(), glow('#cfd8dc'), sx * 0.1 * s, 0.06 * s, 0.28 * s, 0.06 * s); add(h, G.cylLow(), c, 0, 0.3 * s, 0, 0.45 * s, 0.03 * s, 0.45 * s); },
  headband: (h, s, c = '#e53935') => { add(h, torG(0.3, 0.035), c, 0, 0.1 * s, 0, s, s, s, Math.PI / 2); },
  cap: (h, s, c = '#1e88e5') => { hemi(h, c, 0, 0.1 * s, 0, 0.32 * s, 0.24 * s, 0.32 * s); add(h, G.box(), c, 0, 0.12 * s, 0.3 * s, 0.34 * s, 0.03 * s, 0.22 * s); },
  beret: (h, s, c = '#283593') => { add(h, G.sphereLow(), c, 0.04 * s, 0.24 * s, 0, 0.34 * s, 0.1 * s, 0.32 * s); },
  hardhat: (h, s, c = '#fdd835') => { hemi(h, c, 0, 0.1 * s, 0, 0.34 * s, 0.28 * s, 0.34 * s); add(h, G.cylLow(), c, 0, 0.1 * s, 0.04 * s, 0.38 * s, 0.03 * s, 0.4 * s); },
  visor: (h, s, c = '#37474f') => { hemi(h, c, 0, 0.06 * s, 0, 0.34 * s, 0.32 * s, 0.34 * s); add(h, G.box(), glow('#00e5ff'), 0, 0.02 * s, 0.28 * s, 0.42 * s, 0.09 * s, 0.05 * s); },
  horned: (h, s, c = '#9e9e9e') => { hemi(h, c, 0, 0.06 * s, 0, 0.33 * s, 0.3 * s, 0.33 * s); add(h, G.box(), c, 0, -0.02 * s, 0.3 * s, 0.05 * s, 0.2 * s, 0.04 * s); },
  pharaoh: (h, s, c = '#f4f4f4') => { add(h, G.cone(), c, 0, 0.36 * s, 0, 0.24 * s, 0.5 * s, 0.24 * s); add(h, G.sphereLow(), c, 0, 0.64 * s, 0, 0.09 * s); add(h, G.cylLow(), '#c62828', 0, 0.22 * s, 0, 0.28 * s, 0.1 * s, 0.28 * s); },
  kufi: (h, s, c = '#fafafa') => { add(h, G.cylLow(), c, 0, 0.24 * s, 0, 0.27 * s, 0.14 * s, 0.27 * s); },
  coolie: (h, s, c = '#d7b56d') => { add(h, G.cone(), c, 0, 0.3 * s, 0, 0.55 * s, 0.22 * s, 0.55 * s); },
  shako: (h, s, c = '#1a1a1a') => { add(h, G.cylLow(), c, 0, 0.36 * s, 0, 0.25 * s, 0.4 * s, 0.25 * s); add(h, G.sphereLow(), '#fafafa', 0, 0.62 * s, 0.05 * s, 0.06 * s, 0.1 * s, 0.06 * s); add(h, G.box(), '#ffca28', 0, 0.36 * s, 0.25 * s, 0.1 * s, 0.1 * s, 0.02 * s); },
  mask: (h, s, c = '#90caf9') => { add(h, G.box(), c, 0, -0.07 * s, 0.26 * s, 0.34 * s, 0.17 * s, 0.06 * s); },
};
// 손에 드는 것: 손(it) 기준. sx = 오른손 1 · 왼손 -1
export const HOLD = {
  spear: (it, s, c = '#8d6e63') => { add(it, G.cylLow(), c, 0, 0.2 * s, 0.05 * s, 0.025 * s, 1.6 * s, 0.025 * s); add(it, G.cone(), '#cfd8dc', 0, 1.06 * s, 0.05 * s, 0.05 * s, 0.18 * s, 0.05 * s); },
  sword: (it, s, c = '#cfd8dc') => { add(it, G.box(), c, 0, 0.32 * s, 0.1 * s, 0.05 * s, 0.6 * s, 0.015 * s); add(it, G.box(), '#8d6e63', 0, 0.02 * s, 0.1 * s, 0.18 * s, 0.04 * s, 0.04 * s); },
  gladius: (it, s, c = '#cfd8dc') => { add(it, G.box(), c, 0, 0.24 * s, 0.1 * s, 0.07 * s, 0.42 * s, 0.015 * s); add(it, G.sphereLow(), '#ffca28', 0, 0.0, 0.1 * s, 0.05 * s); },
  scutum: (it, s, c = '#c62828', sx) => { add(it, G.box(), c, sx * 0.05 * s, 0.05 * s, 0.14 * s, 0.5 * s, 0.75 * s, 0.06 * s); add(it, G.sphereLow(), '#ffca28', sx * 0.05 * s, 0.05 * s, 0.18 * s, 0.07 * s); add(it, G.box(), '#ffca28', sx * 0.05 * s, 0.05 * s, 0.175 * s, 0.4 * s, 0.03 * s, 0.01 * s); },
  roundShield: (it, s, c = '#1565c0', sx) => { add(it, G.cylLow(), c, sx * 0.04 * s, 0.05 * s, 0.14 * s, 0.32 * s, 0.05 * s, 0.32 * s, Math.PI / 2); add(it, G.sphereLow(), '#ffca28', sx * 0.04 * s, 0.05 * s, 0.18 * s, 0.07 * s); },
  kite: (it, s, c = '#fafafa', sx) => { add(it, G.box(), c, sx * 0.04 * s, 0.05 * s, 0.14 * s, 0.4 * s, 0.6 * s, 0.05 * s); add(it, G.box(), '#c62828', sx * 0.04 * s, 0.05 * s, 0.17 * s, 0.08 * s, 0.56 * s, 0.01 * s); add(it, G.box(), '#c62828', sx * 0.04 * s, 0.15 * s, 0.17 * s, 0.36 * s, 0.08 * s, 0.01 * s); },
  bow: (it, s, c = '#6d4c41') => { add(it, torG(0.4, 0.02, 3.2), c, 0, 0.05 * s, 0.1 * s, s, s, s, 0, Math.PI / 2, -Math.PI / 2); },
  torch: (it, s) => { add(it, G.cylLow(), '#5d4037', 0, 0.15 * s, 0.05 * s, 0.03 * s, 0.5 * s, 0.03 * s); flame(it, 0, 0.42 * s, 0.05 * s, 0.35 * s); },
  staff: (it, s, c = '#8d6e63') => { add(it, G.cylLow(), c, 0, 0.3 * s, 0.05 * s, 0.03 * s, 1.5 * s, 0.03 * s); },
  scroll: (it, s, c = '#f3e5c8') => { add(it, G.cylLow(), c, 0, 0.05 * s, 0.12 * s, 0.05 * s, 0.32 * s, 0.05 * s, 0, 0, Math.PI / 2); },
  book: (it, s, c = '#8d2a1c') => { add(it, G.box(), c, 0, 0.05 * s, 0.12 * s, 0.22 * s, 0.28 * s, 0.07 * s); add(it, G.box(), '#f3e5c8', 0.012 * s, 0.05 * s, 0.12 * s, 0.2 * s, 0.26 * s, 0.075 * s); },
  hammer: (it, s, c = '#6d4c41') => { add(it, G.cylLow(), c, 0, 0.2 * s, 0.05 * s, 0.025 * s, 0.5 * s, 0.025 * s); add(it, G.box(), '#78909c', 0, 0.45 * s, 0.05 * s, 0.22 * s, 0.1 * s, 0.1 * s); },
  musket: (it, s, c = '#5d4037') => { add(it, G.box(), c, 0, 0.3 * s, 0.08 * s, 0.05 * s, 1.1 * s, 0.07 * s); add(it, G.cylLow(), '#455a64', 0, 0.55 * s, 0.1 * s, 0.02 * s, 0.7 * s, 0.02 * s); },
  rifle: (it, s, c = '#4e342e') => { add(it, G.box(), c, 0, 0.25 * s, 0.08 * s, 0.05 * s, 0.9 * s, 0.07 * s); add(it, G.box(), '#37474f', 0, 0.5 * s, 0.1 * s, 0.03 * s, 0.6 * s, 0.03 * s); },
  flag: (it, s, c = '#e53935') => { add(it, G.cylLow(), '#8d6e63', 0, 0.4 * s, 0.05 * s, 0.02 * s, 1.6 * s, 0.02 * s); const f = add(it, G.box(), c, 0, 1.0 * s, 0.32 * s, 0.02 * s, 0.38 * s, 0.56 * s); f.userData.flag = true; },
  lantern: (it, s, c = '#ffb300') => { add(it, G.box(), '#3e2723', 0, -0.05 * s, 0.1 * s, 0.14 * s, 0.03 * s, 0.14 * s); add(it, G.box(), glow(c), 0, -0.15 * s, 0.1 * s, 0.11 * s, 0.17 * s, 0.11 * s); },
  phone: (it, s, c = '#212121') => { add(it, G.box(), c, 0, 0.08 * s, 0.12 * s, 0.1 * s, 0.18 * s, 0.02 * s); add(it, G.box(), glow('#64b5f6'), 0, 0.08 * s, 0.132 * s, 0.085 * s, 0.15 * s, 0.005 * s); },
  sign: (it, s, c = '#fafafa') => { add(it, G.cylLow(), '#8d6e63', 0, 0.3 * s, 0.05 * s, 0.02 * s, 1.1 * s, 0.02 * s); add(it, G.box(), c, 0, 0.85 * s, 0.05 * s, 0.6 * s, 0.4 * s, 0.03 * s); },
  telescope: (it, s, c = '#8d6e63') => { add(it, G.cylLow(), c, 0, 0.1 * s, 0.25 * s, 0.05 * s, 0.6 * s, 0.05 * s, 1.2); add(it, G.cylLow(), '#ffca28', 0, 0.2 * s, 0.5 * s, 0.06 * s, 0.08 * s, 0.06 * s, 1.2); },
  pick: (it, s, c = '#8d6e63') => { add(it, G.cylLow(), c, 0, 0.2 * s, 0.05 * s, 0.025 * s, 0.6 * s, 0.025 * s); add(it, G.box(), '#78909c', 0, 0.48 * s, 0.05 * s, 0.4 * s, 0.05 * s, 0.05 * s, 0, 0, 0.2); },
  basket: (it, s, c = '#c8a165') => { add(it, G.cylLow(), c, 0, -0.1 * s, 0.12 * s, 0.17 * s, 0.2 * s, 0.17 * s); add(it, G.sphereLow(), '#ffca28', 0, 0.02 * s, 0.12 * s, 0.13 * s, 0.06 * s, 0.13 * s); },
  sickle: (it, s) => { add(it, G.cylLow(), '#8d6e63', 0, 0.08 * s, 0.05 * s, 0.025 * s, 0.25 * s, 0.025 * s); add(it, torG(0.14, 0.015, 3.6), '#cfd8dc', 0, 0.3 * s, 0.1 * s, s, s, s, 0, Math.PI / 2); },
  wheat: (it, s) => { for (let i = 0; i < 5; i++) { add(it, G.cylLow(), '#c8a165', (i - 2) * 0.03 * s, 0.25 * s, 0.1 * s, 0.008 * s, 0.6 * s, 0.008 * s, 0, 0, (i - 2) * 0.1); add(it, G.sphereLow(), '#e6c97a', (i - 2) * 0.06 * s, 0.56 * s, 0.1 * s, 0.025 * s, 0.07 * s, 0.025 * s); } },
  axe: (it, s, c = '#8d6e63') => { add(it, G.cylLow(), c, 0, 0.25 * s, 0.05 * s, 0.025 * s, 0.7 * s, 0.025 * s); add(it, G.box(), '#90a4ae', 0.08 * s, 0.55 * s, 0.05 * s, 0.18 * s, 0.2 * s, 0.03 * s); },
  club: (it, s, c = '#6d4c41') => { add(it, G.cone(), c, 0, 0.3 * s, 0.05 * s, 0.08 * s, 0.6 * s, 0.08 * s); },
  stoneAxe: (it, s) => { add(it, G.cylLow(), '#795548', 0, 0.2 * s, 0.05 * s, 0.025 * s, 0.5 * s, 0.025 * s); add(it, G.sphereLow(), '#8d8d8d', 0.06 * s, 0.42 * s, 0.05 * s, 0.1 * s, 0.07 * s, 0.05 * s); },
  pitchfork: (it, s) => { add(it, G.cylLow(), '#8d6e63', 0, 0.35 * s, 0.05 * s, 0.025 * s, 1.3 * s, 0.025 * s); for (const dx of [-0.07, 0, 0.07]) add(it, G.cylLow(), '#90a4ae', dx * s, 1.05 * s, 0.05 * s, 0.012 * s, 0.25 * s, 0.012 * s); },
  quill: (it, s) => { add(it, G.sphereLow(), '#fafafa', 0, 0.18 * s, 0.1 * s, 0.03 * s, 0.2 * s, 0.015 * s, 0, 0, 0.3); },
  candle: (it, s) => { add(it, G.cylLow(), '#fff8e1', 0, 0.06 * s, 0.1 * s, 0.03 * s, 0.14 * s, 0.03 * s); flame(it, 0, 0.14 * s, 0.1 * s, 0.1 * s); },
  laser: (it, s, c = '#00e5ff') => { add(it, G.box(), '#37474f', 0, 0.12 * s, 0.12 * s, 0.07 * s, 0.12 * s, 0.32 * s); add(it, G.box(), glow(c), 0, 0.15 * s, 0.3 * s, 0.03 * s, 0.03 * s, 0.1 * s); },
  candyGun: (it, s, c = '#ff4081') => { add(it, G.cylLow(), c, 0, 0.12 * s, 0.22 * s, 0.07 * s, 0.4 * s, 0.07 * s, Math.PI / 2); add(it, G.cylLow(), '#fafafa', 0, 0.12 * s, 0.25 * s, 0.072 * s, 0.06 * s, 0.072 * s, Math.PI / 2); add(it, G.sphereLow(), glow('#ffeb3b'), 0, 0.12 * s, 0.45 * s, 0.06 * s); },
  flower: (it, s, c = '#ff80ab') => { add(it, G.cylLow(), '#43a047', 0, 0.15 * s, 0.1 * s, 0.012 * s, 0.35 * s, 0.012 * s); for (let i = 0; i < 5; i++) { const a = i * 1.257; add(it, G.sphereLow(), c, Math.cos(a) * 0.05 * s, 0.34 * s, 0.1 * s + Math.sin(a) * 0.05 * s, 0.04 * s); } add(it, G.sphereLow(), '#ffeb3b', 0, 0.35 * s, 0.1 * s, 0.03 * s); },
  wrench: (it, s) => { add(it, G.box(), '#90a4ae', 0, 0.18 * s, 0.08 * s, 0.05 * s, 0.4 * s, 0.03 * s); add(it, torG(0.06, 0.02), '#90a4ae', 0, 0.42 * s, 0.08 * s, s, s, s); },
  sack: (it, s, c = '#bca37f') => { add(it, G.sphereLow(), c, 0, -0.12 * s, 0.1 * s, 0.18 * s, 0.22 * s, 0.16 * s); },
  pot: (it, s, c = '#bf6b3c') => { add(it, latheG('pot1', [[0, 0], [0.12, 0.02], [0.16, 0.12], [0.1, 0.24], [0.08, 0.28]]), c, 0, -0.18 * s, 0.12 * s, s, s, s); },
  net: (it, s) => { add(it, G.cylLow(), '#8d6e63', 0, 0.3 * s, 0.05 * s, 0.02 * s, 1.0 * s, 0.02 * s); add(it, torG(0.18, 0.015), '#d7ccc8', 0, 0.85 * s, 0.05 * s, s, s, s); },
};

// ---------- 네 발 동물 (몸 길이 L, 키 H 기준) ----------
//   o: c 몸 색 · c2 배 · 다리 · L 몸 길이 · H 다리 길이 · neck 목 길이 · head 머리 크기 · tail · ears · horns · tusks · trunk · hump · fur(털 덩어리) · mane · spots · stripes
//   앞이 +z. walk 가 있으면 다리를 엇갈려 흔든다
export function quad(r, o = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const L = o.L ?? 1.6, H = o.H ?? 0.8, W = o.W ?? L * 0.42, c = o.c || '#8d6e63', c2 = o.c2 || shadeHex(c, 0.8);
  const by = H + W * 0.45;
  add(body, G.sphereLow(), c, 0, by, 0, W * 0.55, W * 0.55, L * 0.55);
  if (o.fur) for (let i = 0; i < 6; i++) add(body, G.sphereLow(), o.fur, (i % 2 ? 1 : -1) * W * 0.3, by + W * 0.2, (i / 5 - 0.5) * L * 0.8, W * 0.35, W * 0.38, L * 0.2);
  if (o.hump) add(body, G.sphereLow(), c, 0, by + W * 0.5, -L * 0.05, W * 0.3, W * 0.4, L * 0.18);
  if (o.hump2) add(body, G.sphereLow(), c, 0, by + W * 0.45, L * 0.18, W * 0.28, W * 0.36, L * 0.15);
  if (o.spots) for (let i = 0; i < 8; i++) add(body, G.sphereLow(), o.spots, (r.next() - 0.5) * W * 0.9, by + (r.next() - 0.2) * W * 0.4, (r.next() - 0.5) * L * 0.8, W * 0.14, W * 0.14, W * 0.14);
  if (o.stripes) for (let i = 0; i < 6; i++) add(body, G.box(), o.stripes, 0, by + W * 0.1, (i / 5 - 0.5) * L * 0.8, W * 1.12, W * 0.9, L * 0.04);
  // 목 · 머리
  const neck = new THREE.Group(); neck.position.set(0, by + W * 0.1, L * 0.45); body.add(neck);
  // 목: 세로에서 앞으로 tilt 만큼 기운다 (목이 긴 공룡 · 기린은 곧게, 보통 짐승은 앞으로)
  const nl = o.neck ?? W * 0.6, hs = o.head ?? W * 0.42, tilt = o.tilt ?? (nl > 2 ? 0.45 : 0.95);
  add(neck, G.sphereLow(), c, 0, nl * 0.5 * Math.cos(tilt), nl * 0.5 * Math.sin(tilt), W * 0.24, nl * 0.55 + 0.05, W * 0.24, tilt);
  const head = new THREE.Group(); head.position.set(0, nl * Math.cos(tilt), nl * Math.sin(tilt) + hs * 0.4); neck.add(head);
  add(head, G.sphereLow(), c, 0, 0, 0, hs * 0.8, hs * 0.75, hs);
  add(head, G.sphereLow(), c2, 0, -hs * 0.2, hs * 0.75, hs * 0.5, hs * 0.42, hs * 0.45);
  for (const sx of [-1, 1]) add(head, G.sphereLow(), '#1a1a1a', sx * hs * 0.5, hs * 0.2, hs * 0.6, hs * 0.11, hs * 0.13, hs * 0.08);
  if (o.ears !== false) for (const sx of [-1, 1]) add(head, G.sphereLow(), o.earC || c, sx * hs * 0.55, hs * 0.65, -hs * 0.1, hs * (o.bigEars ? 0.5 : 0.18), hs * (o.bigEars ? 0.6 : 0.28), hs * 0.08);
  if (o.horns) for (const sx of [-1, 1]) add(head, G.cone(), o.hornC || '#efe6d0', sx * hs * 0.45, hs * 0.85, hs * 0.1, hs * 0.12, hs * (o.horns), hs * 0.12, -0.3, 0, -sx * 0.5);
  if (o.antlers) for (const sx of [-1, 1]) { add(head, G.cylLow(), '#a1887f', sx * hs * 0.4, hs * 1.1, 0, hs * 0.05, hs * 1.0, hs * 0.05, 0, 0, -sx * 0.5); add(head, G.cylLow(), '#a1887f', sx * hs * 0.75, hs * 1.4, 0, hs * 0.04, hs * 0.6, hs * 0.04, 0, 0, sx * 0.3); }
  if (o.tusks) for (const sx of [-1, 1]) { const L1 = o.tusks; add(head, G.cylLow(), '#f5ecd7', sx * hs * 0.38, -hs * 0.45 - L1 * 0.35, hs * 0.75 + L1 * 0.2, L1 * 0.09, L1 * 0.8, L1 * 0.09, 0.5, 0, sx * 0.15); add(head, G.cone(), '#f5ecd7', sx * hs * 0.48, -hs * 0.55 - L1 * 0.5, hs * 0.85 + L1 * 0.75, L1 * 0.085, L1 * 0.9, L1 * 0.085, 2.2, 0, sx * 0.35); }
  if (o.trunk) { const tr = add(head, G.cone(), c, 0, -hs * 0.9, hs * 1.0, hs * 0.22, hs * 1.6, hs * 0.22, Math.PI); tr.userData.trunk = true; }
  if (o.mane) add(neck, G.sphereLow(), o.mane, 0, nl * 0.5 * Math.cos(tilt) + W * 0.12, nl * 0.5 * Math.sin(tilt) - W * 0.1, W * 0.3, nl * 0.5 + 0.1, W * 0.36, tilt);
  if (o.horn1) add(head, G.cone(), o.hornC || '#efe6d0', 0, hs * 0.2, hs * 1.1, hs * 0.15, hs * o.horn1, hs * 0.15, 1.1);
  // 다리 · 꼬리
  const legs = [];
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const lg = new THREE.Group(); lg.position.set(lx * W * 0.32, by - W * 0.2, lz * L * 0.32); body.add(lg); add(lg, G.cylLow(), o.legC || c, 0, -(by - W * 0.2) / 2, 0, W * (o.thickLegs ? 0.2 : 0.12), by - W * 0.2, W * (o.thickLegs ? 0.2 : 0.12)); add(lg, G.sphereLow(), shadeHex(o.legC || c, 0.7), 0, -(by - W * 0.2), 0.02, W * (o.thickLegs ? 0.22 : 0.13), W * 0.08, W * (o.thickLegs ? 0.24 : 0.15)); legs.push(lg); }
  if (o.tail !== false) add(body, G.cone(), o.tailC || c, 0, by, -L * 0.6, W * 0.08, (o.tail ?? 0.5) * L, W * 0.08, -2.2);
  // 몸통 · 목은 하나로 합친다 (다리 · 머리는 움직이니 그대로)
  for (const lg of legs) lg.userData.dynamic = true; head.userData.dynamic = true; bakeLocal(body);
  g.userData.parts = { body, head, neck, legs };
  g.userData.anim = (q, t) => { const w = (q.userData.walk ?? t * 0.5) * (o.gait ?? 6); legs.forEach((lg, i) => { lg.rotation.x = Math.sin(w + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.35; }); body.position.y = Math.abs(Math.sin(w)) * 0.04 * L; head.rotation.x = Math.sin(w * 0.5) * 0.06; };
  return g;
}
// 두 발 공룡 · 새 (몸 기울이고 꼬리로 균형): L 몸 · H 다리
export function biped(r, o = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const L = o.L ?? 2, H = o.H ?? 1, c = o.c || '#6d8f3a', c2 = o.c2 || shadeHex(c, 1.2), W = L * 0.32;
  const by = H + W * 0.4;
  add(body, G.sphereLow(), c, 0, by, 0, W * 0.6, W * 0.62, L * 0.42);
  add(body, G.sphereLow(), c2, 0, by - W * 0.25, L * 0.05, W * 0.45, W * 0.4, L * 0.3);
  add(body, G.cone(), c, 0, by + W * 0.05, -L * 0.62, W * 0.42, L * (o.tailL ?? 0.9), W * 0.42, -Math.PI / 2 - 0.12);
  const head = new THREE.Group(); head.position.set(0, by + W * (o.upright ? 1.2 : 0.55), L * 0.5); body.add(head);
  add(body, G.sphereLow(), c, 0, by + W * (o.upright ? 0.7 : 0.35), L * 0.38, W * 0.32, W * 0.5, W * 0.32, 0.6);
  const hs = o.head ?? W * 0.62;
  add(head, G.sphereLow(), c, 0, 0, hs * 0.2, hs * 0.62, hs * 0.6, hs * 1.0);
  const jaw = add(head, G.sphereLow(), c2, 0, -hs * 0.32, hs * 0.35, hs * 0.5, hs * 0.22, hs * 0.85);
  if (o.teeth) for (let i = 0; i < 6; i++) add(head, G.cone(), '#fafafa', (i % 2 ? 1 : -1) * hs * 0.35, -hs * 0.2, hs * (0.3 + i * 0.1), hs * 0.05, hs * 0.14, hs * 0.05, Math.PI);
  for (const sx of [-1, 1]) add(head, G.sphereLow(), '#1a1a1a', sx * hs * 0.45, hs * 0.22, hs * 0.55, hs * 0.1, hs * 0.12, hs * 0.08);
  if (o.crest) add(head, G.box(), o.crest, 0, hs * 0.5, hs * 0.1, hs * 0.08, hs * 0.5, hs * 0.9);
  if (o.feathers) for (let i = 0; i < 5; i++) add(body, G.sphereLow(), o.feathers, 0, by + W * 0.5, -L * 0.3 + i * L * 0.12, W * 0.1, W * 0.3, W * 0.12);
  const arms = [-1, 1].map((sx) => add(body, G.sphereLow(), c, sx * W * 0.5, by - W * 0.1, L * 0.38, W * (o.bigArms ? 0.14 : 0.08), W * (o.bigArms ? 0.4 : 0.24), W * 0.08, 0.6));
  const legs = [-1, 1].map((sx) => { const lg = new THREE.Group(); lg.position.set(sx * W * 0.4, by - W * 0.1, -L * 0.05); body.add(lg); add(lg, G.sphereLow(), c, 0, -W * 0.15, 0, W * 0.28, W * 0.5, W * 0.38); add(lg, G.cylLow(), c, 0, -(by - W * 0.1) * 0.75, 0.05, W * 0.12, (by - W * 0.1) * 0.6, W * 0.12); add(lg, G.sphereLow(), shadeHex(c, 0.7), 0, -(by - W * 0.1) + 0.04, W * 0.12, W * 0.16, W * 0.07, W * 0.3); return lg; });
  for (const lg of legs) lg.userData.dynamic = true; head.userData.dynamic = true; bakeLocal(body);
  g.userData.parts = { body, head, jaw, legs, arms };
  g.userData.anim = (q, t) => { const w = (q.userData.walk ?? t * 0.5) * (o.gait ?? 7); legs[0].rotation.x = Math.sin(w) * 0.45; legs[1].rotation.x = -Math.sin(w) * 0.45; body.position.y = Math.abs(Math.cos(w)) * 0.05 * L; body.rotation.y = Math.sin(w) * 0.04; jaw.rotation.x = Math.max(0, Math.sin(t * 1.3)) * 0.25; };
  return g;
}
// 빛나는 이름판 없이: 점 줄 (전구 · 별) 을 하나의 인스턴스로
export function dotsInst(p, pts, col, r = 0.1) { const im = new THREE.InstancedMesh(G.sphereLow(), glow(col), pts.length), o = new THREE.Object3D(); pts.forEach(([x, y, z], i) => { o.position.set(x, y, z); o.scale.setScalar(r); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); p.add(im); return im; }
