// 랜덤 지옥 풍경 · 괴물: 어둠 속에서 저마다의 색으로 빛난다
import * as THREE from 'three';
import { toon, G, geo } from '../../shared/js/utils.js';
import { KITS, glow } from './kits.js';

const M = (c) => (typeof c === 'object' ? c : toon(c));
function add(p, g, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(g, M(mat)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); p.add(m); return m; }
const box = (p, c, x, y, z, w, h, d, rx, ry, rz) => add(p, G.box(), c, x, y, z, w, h, d, rx, ry, rz);
const ball = (p, c, x, y, z, a, b = a, d = a) => add(p, G.sphereLow(), c, x, y, z, a, b, d);
const cyl = (p, c, x, y, z, r, h, rx, ry, rz) => add(p, G.cyl(), c, x, y, z, r, h, r, rx, ry, rz);
const cone = (p, c, x, y, z, r, h, rx, ry, rz) => add(p, G.cone(), c, x, y, z, r, h, r, rx, ry, rz);
const ring = (r, t) => geo(`hr${r}_${t}`, () => new THREE.TorusGeometry(r, t, 6, 20));
const grp = () => new THREE.Group();
const dark = (P) => P.body || '#15101c', lit = (P) => glow(P.g || '#ff3b30');

Object.assign(KITS, {
  // 빛나는 틈이 있는 검은 바위
  hellRock: { place: 'side', every: 6, build(r, P) { const g = grp(), h = r.range(2, 5); cone(g, dark(P), 0, h / 2, 0, r.range(0.8, 1.5), h); for (let i = 0; i < 3; i++) box(g, lit(P), r.range(-0.3, 0.3), h * (0.2 + i * 0.2), r.range(-0.3, 0.3), 0.08, h * 0.22, 0.5, 0, r.range(0, 3), r.range(-0.5, 0.5)); return g; } },
  hellFire: { place: 'side', every: 7, build(r, P) { const g = grp(); for (let i = 0; i < 4; i++) { const h = r.range(1, 2.6); cone(g, glow(i % 2 ? P.g || '#ff5a1f' : P.g2 || '#ffd166', 0.85), r.range(-0.6, 0.6), h / 2, r.range(-0.6, 0.6), r.range(0.2, 0.45), h); } g.userData.anim = (o, t) => { o.scale.y = 1 + Math.sin(t * 9 + o.id) * 0.18; }; return g; } },
  hellSkull: { place: 'side', every: 8, build(r, P) { const g = grp(); cyl(g, dark(P), 0, 0.9, 0, 0.18, 1.8); ball(g, P.bone || '#d8d0c0', 0, 2.1, 0, 0.55, 0.5, 0.55); for (const s of [-1, 1]) ball(g, lit(P), s * 0.2, 2.15, -0.46, 0.12); box(g, '#20161c', 0, 1.8, -0.42, 0.34, 0.12, 0.1); return g; } },
  hellBones: { place: 'side', every: 6, build(r, P) { const g = grp(), c = P.bone || '#d8d0c0'; for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; cyl(g, c, Math.cos(a) * 0.9, 1.1, Math.sin(a) * 0.9, 0.08, 2.6, 0, 0, Math.cos(a) * 0.35); } ball(g, lit(P), 0, 0.6, 0, 0.3); return g; } },
  hellGrave: { place: 'side', every: 5, build(r, P) { const g = grp(); box(g, dark(P), 0, 0.8, 0, 1, 1.6, 0.25, 0, r.range(-0.3, 0.3), r.range(-0.15, 0.15)); box(g, lit(P), 0, 0.95, -0.14, 0.14, 0.75, 0.04); box(g, lit(P), 0, 1.1, -0.14, 0.5, 0.12, 0.04); return g; } },
  hellWeb: { place: 'side', every: 9, build(r, P) { const g = grp(), m = glow(P.g || '#c7f9ff', 0.55); for (let i = 1; i <= 3; i++) add(g, ring(i, 0.03), m, 0, 3.4, 0, 1, 1, 1); for (let i = 0; i < 8; i++) box(g, m, 0, 3.4, 0, 0.05, 6.4, 0.05, 0, 0, (i / 8) * Math.PI); cyl(g, dark(P), -3.2, 1.7, 0, 0.1, 3.4); cyl(g, dark(P), 3.2, 1.7, 0, 0.1, 3.4); return g; } },
  hellGear: { place: 'side', every: 7, build(r, P) { const g = grp(), w = grp(); w.position.y = 2.6; g.add(w); add(w, ring(1.5, 0.28), dark(P), 0, 0, 0, 1, 1, 1); for (let i = 0; i < 8; i++) box(w, i % 2 ? lit(P) : dark(P), Math.cos((i / 8) * 6.28) * 1.85, Math.sin((i / 8) * 6.28) * 1.85, 0, 0.5, 0.5, 0.45, 0, 0, (i / 8) * 6.28); ball(w, lit(P), 0, 0, 0, 0.4); cyl(g, dark(P), 0, 1, 0, 0.2, 2); g.userData.anim = (o, t) => { o.children[0].rotation.z = t * 1.6; }; g.userData.dynamic = true; return g; } },
  hellTentacle: { place: 'side', every: 6, build(r, P) { const g = grp(), c = P.body || '#24102e', ph = r.range(0, 6); const parts = []; for (let i = 0; i < 6; i++) { const b = ball(g, i === 5 ? lit(P) : c, 0, 0.5 + i * 0.75, 0, 0.55 - i * 0.07); parts.push(b); } g.userData.anim = (o, t) => { parts.forEach((b, i) => { b.position.x = Math.sin(t * 1.6 + ph + i * 0.7) * i * 0.2; }); }; return g; } },
  hellMushroom: { place: 'side', every: 5, build(r, P) { const g = grp(), h = r.range(1, 2.6); cyl(g, dark(P), 0, h / 2, 0, 0.18, h); ball(g, lit(P), 0, h, 0, r.range(0.7, 1.1), 0.45, 0.9); return g; } },
  hellEye: { place: 'drift', every: 11, build(r, P) { const g = grp(); ball(g, '#f4eee0', 0, 0, 0, 0.9); ball(g, lit(P), 0, 0, -0.62, 0.45, 0.45, 0.35); ball(g, '#050308', 0, 0, -0.86, 0.2, 0.2, 0.14); g.userData.anim = (o, t) => { o.rotation.y = Math.sin(t * 0.8 + o.id) * 0.5; o.rotation.x = Math.cos(t * 0.6 + o.id) * 0.3; }; return g; } },
  hellSoul: { place: 'drift', every: 9, build(r, P) { const g = grp(), m = glow(P.g || '#9be7ff', 0.7); ball(g, m, 0, 0, 0, 0.5, 0.65, 0.5); cone(g, m, 0, -0.8, 0, 0.42, 1, Math.PI); for (const s of [-1, 1]) ball(g, '#05030a', s * 0.18, 0.12, -0.44, 0.08, 0.12, 0.06); g.userData.anim = (o, t) => { o.position.y = o.userData.y0 + Math.sin(t * 1.5 + o.id) * 0.8; }; return g; } },
  hellChain: { place: 'side', every: 6, build(r, P) { const g = grp(); for (let i = 0; i < 9; i++) add(g, ring(0.28, 0.06), i % 4 === 3 ? lit(P) : dark(P), 0, i * 0.6, 0, 1, 1, 1, 0, i % 2 ? Math.PI / 2 : 0); return g; } },
  hellCage: { place: 'side', every: 9, build(r, P) { const g = grp(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; cyl(g, dark(P), Math.cos(a), 1.4, Math.sin(a), 0.05, 2.8); } add(g, ring(1, 0.07), lit(P), 0, 2.8, 0, 1, 1, 1, Math.PI / 2); add(g, ring(1, 0.07), lit(P), 0, 0.05, 0, 1, 1, 1, Math.PI / 2); ball(g, lit(P), 0, 1.3, 0, 0.3); return g; } },
  hellDoll: { place: 'side', every: 8, build(r, P) { const g = grp(); cone(g, dark(P), 0, 0.8, 0, 0.55, 1.6); ball(g, '#efe6da', 0, 1.9, 0, 0.45); for (const s of [-1, 1]) ball(g, lit(P), s * 0.16, 1.95, -0.38, 0.09); box(g, P.body || '#2a1020', 0, 2.26, 0, 0.8, 0.14, 0.8); return g; } },
  hellClock: { place: 'drift', every: 12, build(r, P) { const g = grp(), h = grp(); add(g, ring(1.3, 0.12), lit(P), 0, 0, 0, 1, 1, 1); box(h, lit(P), 0, 0.5, -0.05, 0.08, 1, 0.04); g.add(h); g.userData.anim = (o, t) => { o.children[1].rotation.z = -t * 5; }; return g; } },
  hellGold: { place: 'side', every: 6, build(r, P) { const g = grp(); for (let i = 0; i < 8; i++) add(g, G.cyl(), glow(P.g || '#ffcf33'), r.range(-0.9, 0.9), 0.06 + Math.random() * 0.8, r.range(-0.9, 0.9), 0.32, 0.08, 0.32, 0, 0, r.range(-0.3, 0.3)); box(g, dark(P), 0, 0.1, 0, 2.2, 0.2, 2.2); return g; } },
  hellNeon: { place: 'side', every: 6, build(r, P) { const g = grp(), h = r.range(4, 9); box(g, dark(P), 0, h / 2, 0, 0.7, h, 0.7); for (const s of [-1, 1]) box(g, lit(P), s * 0.38, h / 2, 0, 0.05, h, 0.72); box(g, glow(P.g2 || '#00f5ff'), 0, h * 0.7, -0.38, 0.72, 0.1, 0.05); return g; } },
  hellIce: { place: 'side', every: 6, build(r, P) { const g = grp(); for (let i = 0; i < 3; i++) { const h = r.range(1.5, 4.4); cone(g, glow(P.g || '#7fe9ff', 0.72), r.range(-0.7, 0.7), h / 2, r.range(-0.7, 0.7), r.range(0.3, 0.6), h); } return g; } },
  hellCrystal: { place: 'side', every: 6, build(r, P) { const g = grp(); for (let i = 0; i < 4; i++) { const h = r.range(1.2, 3.4); add(g, geo('hOct', () => new THREE.OctahedronGeometry(1, 0)), glow(i % 2 ? P.g || '#c77dff' : P.g2 || '#ff5cf0', 0.8), r.range(-0.8, 0.8), h / 2, r.range(-0.8, 0.8), 0.35, h / 2, 0.35); } return g; } },
  hellSwarm: { place: 'drift', every: 8, build(r, P) { const g = grp(); for (let i = 0; i < 9; i++) ball(g, i % 2 ? lit(P) : dark(P), r.range(-2, 2), r.range(-1, 1), r.range(-2, 2), 0.14); g.userData.anim = (o, t) => { o.rotation.y = t * 2; o.position.y = o.userData.y0 + Math.sin(t * 3 + o.id) * 0.5; }; return g; } },
  hellSun: { place: 'sky', every: 60, build(r, P) { const g = grp(); ball(g, '#030106', 0, 0, 0, 13); add(g, ring(14, 0.5), lit(P), 0, 0, 0, 1, 1, 1); add(g, ring(17, 0.2), lit(P), 0, 0, 0, 1, 1, 1); return g; } },
  hellVolcano: { place: 'far', every: 40, build(r, P) { const g = grp(), h = r.range(26, 44); cone(g, dark(P), 0, h / 2, 0, r.range(20, 30), h); cone(g, lit(P), 0, h + 1, 0, 4.4, 4, Math.PI); return g; } },
  hellGate: { place: 'far', every: 44, build(r, P) { const g = grp(), h = r.range(24, 38), c = dark(P); box(g, c, -9, h / 2, 0, 5, h, 5); box(g, c, 9, h / 2, 0, 5, h, 5); box(g, c, 0, h, 0, 24, 5, 5); box(g, lit(P), 0, h / 2, 0, 13, h - 3, 0.8); for (const s of [-1, 1]) cone(g, c, s * 11, h + 5, 0, 1.6, 7); return g; } },
  hellTower: { place: 'far', every: 34, build(r, P) { const g = grp(), h = r.range(24, 60); box(g, dark(P), 0, h / 2, 0, 7, h, 7); for (let i = 0; i < 18; i++) box(g, lit(P), r.pick([-3.55, 3.55]), r.range(3, h - 2), r.range(-2.6, 2.6), 0.05, 0.9, 0.5); return g; } },
});

// ---------- 내리치는 괴물 ----------
//   kind 마다 몸 모양이 다르다. 모두 어두운 몸 + 빛나는 눈 · 무늬
const BODY = {
  demon(g, c, e) { ball(g, c, 0, 0, 0, 3.6, 4.4, 3); ball(g, c, 0, 5.4, 0, 2.4); for (const s of [-1, 1]) { cone(g, e, s * 1.9, 8, 0, 0.55, 2.8, 0, 0, -s * 0.5); ball(g, e, s * 0.85, 5.7, -2, 0.5); } box(g, e, 0, 4.4, -2.1, 1.7, 0.25, 0.2); },
  skull(g, c, e) { ball(g, '#cfc7b6', 0, 4.6, 0, 3, 2.8, 3); box(g, '#cfc7b6', 0, 2.2, -0.3, 2.8, 1.4, 2.4); for (const s of [-1, 1]) { ball(g, '#050308', s * 1.1, 4.8, -2.4, 0.9, 1, 0.5); ball(g, e, s * 1.1, 4.8, -2.7, 0.35); } for (let i = 0; i < 5; i++) box(g, '#0a0608', -1.1 + i * 0.55, 2, -1.56, 0.1, 0.9, 0.1); for (let i = 0; i < 5; i++) add(g, G.cyl(), '#cfc7b6', 0, -i * 1.2, 0, 2 - i * 0.2, 0.34, 1.6 - i * 0.1); },
  zombie(g, c, e) { box(g, c, 0, 0, 0, 5.6, 7, 3.4, 0, 0, 0.08); box(g, c, 0.3, 5.4, 0, 4, 3.6, 3.4, 0, 0, -0.14); for (const s of [-1, 1]) ball(g, e, s * 1 + 0.3, 5.8, -1.8, s > 0 ? 0.7 : 0.4); box(g, '#05030a', 0.2, 4.2, -1.75, 2.4, 0.6, 0.1); for (let i = 0; i < 4; i++) box(g, e, -1.6 + i, 1.5 - i * 0.7, -1.76, 0.5, 0.15, 0.1); },
  shade(g, c, e) { ball(g, '#020105', 0, 2, 0, 4.4, 7, 3.6); for (let i = 0; i < 6; i++) { const a = -0.8 + i * 0.32; ball(g, e, Math.sin(a) * 3, 5 - (i % 3) * 1.6, -3, 0.34); } },
  wraith(g, c, e) { const m = glow(e.color ? `#${e.color.getHexString()}` : '#9be7ff', 0.42); ball(g, m, 0, 3, 0, 3.4, 5.6, 2.8); cone(g, m, 0, -4, 0, 3.4, 8, Math.PI); for (const s of [-1, 1]) ball(g, '#020105', s * 1, 5, -2.5, 0.65, 1, 0.3); },
  golem(g, c, e) { const o = geo('hDod', () => new THREE.DodecahedronGeometry(1, 0)); add(g, o, c, 0, 0, 0, 4.4, 4.8, 3.6); add(g, o, c, 0, 5.8, 0, 2.5, 2.2, 2.4); for (let i = 0; i < 6; i++) box(g, e, -2.4 + i, 2.4 - i, -3.1, 0.2, 2.2, 0.2, 0, 0, i); for (const s of [-1, 1]) ball(g, e, s * 0.9, 6, -2.2, 0.42); },
  tentacle(g, c, e) { ball(g, c, 0, 2, 0, 4, 3.6, 3.6); ball(g, e, 0, 2.6, -3.2, 1.2, 1.2, 0.6); ball(g, '#020105', 0, 2.6, -3.7, 0.45, 0.8, 0.2); for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28; for (let i = 0; i < 5; i++) ball(g, c, Math.cos(a) * (3.4 + i * 0.9), 0.6 + i * Math.sin(a * 2) * 1.1, Math.sin(a) * (2.6 + i * 0.6), 0.9 - i * 0.14); } },
  spider(g, c, e) { ball(g, c, 0, 2, 0, 3.6, 2.8, 4); ball(g, c, 0, 3.2, -3, 2, 1.8, 2); for (let i = 0; i < 6; i++) ball(g, e, -1 + (i % 3), 3.8 - (i > 2 ? 0.6 : 0), -4.7, 0.3); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) box(g, c, s * 5, 3.4, -3 + i * 2, 5.4, 0.36, 0.36, 0, 0, s * 0.8); },
  gear(g, c, e) { box(g, c, 0, 1, 0, 6.4, 7.6, 4); box(g, c, 0, 6.4, 0, 4.4, 3, 3.6); box(g, e, 0, 6.6, -1.86, 3.3, 0.5, 0.1); add(g, ring(1.6, 0.34), e, 0, 1.6, -2.1, 1, 1, 1); ball(g, e, 0, 1.6, -2.1, 0.55); for (const s of [-1, 1]) cone(g, c, s * 1.2, 8.8, 0, 0.3, 1.8); },
  eye(g, c, e) { ball(g, '#efe9dc', 0, 3, 0, 4.4); ball(g, e, 0, 3, -3.2, 2.2, 2.2, 1.4); ball(g, '#020105', 0, 3, -4.1, 1, 1, 0.5); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; cyl(g, c, Math.cos(a) * 4.8, 3 + Math.sin(a) * 4.8, 0.6, 0.18, 2.6, 0, 0, a + Math.PI / 2); } },
  clown(g, c, e) { ball(g, c, 0, 0, 0, 3.4, 4.2, 2.8); ball(g, '#f3ece0', 0, 5.2, 0, 2.5); ball(g, e, 0, 5, -2.5, 0.6); for (const s of [-1, 1]) { ball(g, e, s * 2.5, 6, 0, 1.2); ball(g, '#020105', s * 0.9, 5.8, -2.1, 0.42, 0.6, 0.2); } box(g, e, 0, 3.9, -2.2, 2.6, 0.32, 0.2); cone(g, e, 0, 8.2, 0, 1.1, 2.4); },
  worm(g, c, e) { for (let i = 0; i < 6; i++) ball(g, i % 2 ? c : e, Math.sin(i * 0.6) * 1.2, -4 + i * 2.1, 0, 3.1 - i * 0.14); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; cone(g, '#eee6d4', Math.cos(a) * 1.5, 7.2, -2 + Math.sin(a) * 1.5, 0.3, 1.1, -1.4); } ball(g, '#050308', 0, 7.2, -2.1, 1.3, 1.3, 0.5); },
  doll(g, c, e) { cone(g, c, 0, -1, 0, 4, 8); ball(g, '#efe6da', 0, 5, 0, 2.8); for (const s of [-1, 1]) { ball(g, '#020105', s * 1, 5.2, -2.3, 0.7, 0.8, 0.3); ball(g, e, s * 1, 5.2, -2.6, 0.26); } box(g, c, 0, 7.5, 0, 5.2, 0.5, 5.2); box(g, '#0a0608', 0, 3.8, -2.45, 0.1, 1.5, 0.1); },
};
export function buildMonster(kind, P) {
  const g = new THREE.Group(), c = toon(P.body || '#15101c'), e = glow(P.g || '#ff3b30');
  (BODY[kind] || BODY.demon)(g, c, e);
  return g;
}
// 내리치는 손: 위아래 두 조각 + 빛나는 가시
export function buildFist(kind, P, w, h, d) {
  const g = new THREE.Group(), c = toon(P.arm || P.body || '#20182a'), e = glow(P.g || '#ff3b30');
  add(g, G.box(), c, 0, h / 2, 0, w, h, d);
  add(g, G.box(), e, 0, 0.1, 0, w + 0.12, 0.14, d + 0.12);
  const n = Math.max(2, Math.min(5, Math.round(w / 1.2)));
  for (let i = 0; i < n; i++) add(g, G.cone(), e, -w / 2 + (i + 0.5) * (w / n), h + 0.32, 0, 0.26, 0.7, 0.26);
  return g;
}
