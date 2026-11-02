// 젤리 아레나: 5 대 5 라인 전략 배틀. 서버(sim.js)가 다 계산하고, 여기서는 보이는 모습을 그리고 명령을 보낸다
//   우클릭 이동 · 공격 | Q W E R 기술(누르면 범위, 떼면 발사) | D F 주문 | A 공격 이동 | B 상점 | Tab 점수판 | Y 카메라 고정
import * as THREE from 'three';
import { Shell, esc } from '../../shared/js/shell.js';
import { store } from '../../shared/js/account.js';
import { makeSound, confetti } from '../../shared/js/party.js';
import { Roach } from '../../shared/js/roach.js';
import { SIZE, CHAMPS, champById, ROLES, ROLE_IDS, ITEMS, BUILD, SPELLS, MONS, TEAMS, STRUCTS, R_LEVELS, FOUNTAIN, TOWER_RANGE, findPath } from './data.js';
import { buildWorld, makeStruct, TC } from './world.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellyarena');
const touch = matchMedia('(pointer: coarse)').matches;
const LV_KEY = 'jellyarena.level', PICK_KEY = 'jellyarena.pick', FIRST_KEY = 'jellyarena.seen', QUICK_KEY = 'jellyarena.quick', CAM_KEY = 'jellyarena.cam';
const game = window.arena = {
  mode: 'title', team: 'blue', me: null, myUnit: 0, roster: new Map(), level: store.get(LV_KEY) || 'normal', T: 0, sb: null, views: new Map(), shop: 'all',
  quick: store.get(QUICK_KEY) === '1', pred: null, pings: [], shake: 0, zoomT: 1, locked: true, zoom: 1, focus: new THREE.Vector3(-66, 0, 66), mouse: { x: 0, y: 0, in: false }, hover: null, aim: null, amove: false, picks: [], myPick: null, myRole: null,
};
const KEYS_SK = ['q', 'w', 'e', 'r'];
const HELD = { sword: 'sword', axe: 'halberd', club: 'rod', dagger: 'knife', staff_lightning: 'wand', wand: 'wand', bow: 'bow', pistol: 'pistol', cannon: 'rpg', crossbow: 'crossbow', staff: 'wand', lute: 'rod' };

// ---------- 그리기 준비 ----------
const canvas = $('c'), ov = $('ov'), ctx = ov.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 1, 400);
game.camera = camera; game.scene = scene; // 점검용
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const d = Math.min(2, devicePixelRatio || 1); ov.width = innerWidth * d; ov.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();
const W = buildWorld(scene);
const miniBg = (() => { const c = document.createElement('canvas'); c.width = c.height = 440; c.getContext('2d').drawImage(W.gc, 0, 0, 440, 440); return c; })();
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
// 건물은 처음부터 다 보인다 (서버 id 가 오면 짝을 맞춘다)
const structViews = STRUCTS.map((s) => { const o = makeStruct(s.k, s.team, s.tier); o.position.set(s.at[0], 0, s.at[1]); scene.add(o); return { ...s, o, alive: true }; });
const structAt = (x, z) => structViews.find((v) => Math.hypot(v.at[0] - x, v.at[1] - z) < 1);

// ---------- 유닛 모습 ----------
const G = { sph: new THREE.SphereGeometry(1, 14, 10), eye: new THREE.SphereGeometry(0.16, 8, 6), ring: new THREE.RingGeometry(0.82, 1, 32), disc: new THREE.CircleGeometry(1, 40), cone: new THREE.ConeGeometry(0.3, 0.6, 6), box: new THREE.BoxGeometry(1, 1, 1) };
const mats = new Map(); const mat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, ...o })); return mats.get(k); };
const black = new THREE.MeshBasicMaterial({ color: '#201a28' });
const ringOf = (c, op = 0.8) => { const m = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.08; return m; };
function makeMinion(team, type) {
  const g = new THREE.Group(), c = TC[team === 0 ? 'blue' : 'red'], s = type === 'super' ? 1.5 : type === 'siege' ? 1.25 : type === 'caster' ? 0.82 : 1;
  const body = new THREE.Mesh(G.sph, mat(c, { transparent: true, opacity: 0.92 })); body.scale.set(0.7 * s, 0.78 * s, 0.7 * s); body.position.y = 0.72 * s; g.add(body); g.userData.body = body;
  for (const x of [-1, 1]) { const e = new THREE.Mesh(G.eye, black); e.position.set(x * 0.24 * s, 0.86 * s, 0.6 * s); g.add(e); }
  if (type === 'caster') { const h = new THREE.Mesh(G.cone, mat('#ffffff')); h.position.y = 1.5 * s; h.scale.setScalar(1.3); g.add(h); }
  if (type === 'siege') { const b = new THREE.Mesh(G.box, mat('#3b3f4a')); b.scale.set(0.34, 0.34, 1.1); b.position.set(0, 1.25, 0.2); g.add(b); }
  if (type === 'super') { const h = new THREE.Mesh(G.cone, mat('#ffd76a')); h.position.y = 1.9; h.scale.setScalar(1.8); g.add(h); }
  g.userData.s = s; return g;
}
// 몬스터마다 모양이 다르다: 몸 · 얼굴 · 팔다리를 기본 도형으로 조립한다
function makeMon(mid, big) {
  const d = MONS[mid], g = new THREE.Group(), c = d.color, s = d.epic ? ({ mold: 3, turtle: 3.1, beetle: 2.6 }[mid] || 2.4) : mid === 'snail' ? 1.6 : big ? 1.35 : 0.8;
  const add = (geo, m, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, to = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x * s, y * s, z * s); o.scale.set(sx * s, sy * s, sz * s); o.rotation.set(rx, ry, rz); to.add(o); return o; };
  const body = (sx, sy, sz, y, z = 0, m = mat(c)) => { const o = add(G.sph, m, 0, y, z, sx, sy, sz); g.userData.body = o; return o; };
  const eyes = (x, y, z, k = 1) => { for (const q of [-1, 1]) add(G.eye, black, q * x, y, z, k); };
  const legs = (n, x, y, z0, dz, m = mat('#3a3040'), L = 0.5) => { for (let i = 0; i < n; i++) for (const q of [-1, 1]) add(G.box, m, q * x, y, z0 + i * dz, L, 0.09, 0.09, 0, 0, q * -0.5); };
  const wings = (m, w, h, x, y, z, rest = 0) => { g.userData.wings = [-1, 1].map((q) => { const p = new THREE.Group(); p.position.set(q * x * s, y * s, z * s); g.add(p); add(G.sph, m, q * w * 0.5, 0, 0, w * 0.5, 0.04, h, 0, 0, 0, p); p.userData.q = q; p.userData.rest = rest; return p; }); };
  const shine = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const glow = (col) => new THREE.MeshBasicMaterial({ color: col });
  if (mid === 'wolves') {
    body(0.55, 0.5, 0.95, 0.72); add(G.sph, mat(c), 0, 1.02, 0.85, 0.45); add(G.cone, mat('#f2e6ff'), 0, 0.92, 1.3, 0.55, 0.9, 0.55, 1.57); eyes(0.2, 1.14, 1.16);
    for (const q of [-1, 1]) { add(G.cone, mat(c), q * 0.26, 1.5, 0.8, 0.75, 1.1, 0.75); for (const z of [-0.55, 0.55]) add(G.box, mat(c), q * 0.32, 0.25, z, 0.2, 0.5, 0.2); }
    add(G.sph, mat('#f2e6ff'), 0, 1.05, -1.05, 0.28, 0.28, 0.6, 0.7);
  } else if (mid === 'frogs') {
    body(1, 0.58, 0.9, 0.55); add(G.box, black, 0, 0.5, 0.86, 0.95, 0.06, 0.06); for (const q of [-1, 1]) { add(G.sph, mat(c), q * 0.48, 1.08, 0.42, 0.3); add(G.eye, black, q * 0.5, 1.14, 0.68, 1); add(G.sph, mat('#5ab86c'), q * 0.9, 0.2, -0.25, 0.42, 0.2, 0.62); add(G.sph, mat('#5ab86c'), q * 0.72, 0.14, 0.72, 0.28, 0.13, 0.36); }
  } else if (mid === 'golem') {
    const r = mat(c, { flatShading: true }), r2 = mat('#c9b48a', { flatShading: true }); const ico = new THREE.IcosahedronGeometry(1, 0);
    g.userData.body = add(ico, r, 0, 0.95, 0, 0.82, 0.8, 0.7); add(ico, r2, 0, 1.72, 0.15, 0.42, 0.38, 0.4); eyes(0.15, 1.78, 0.5, 0.9);
    for (const q of [-1, 1]) { add(ico, r2, q * 0.98, 1.05, 0.1, 0.36); add(ico, r, q * 1.08, 0.48, 0.2, 0.42, 0.5, 0.42); add(ico, r2, q * 0.38, 0.22, 0, 0.32, 0.26, 0.32); }
  } else if (mid === 'crab') {
    body(1, 0.42, 0.72, 0.62); legs(3, 1.05, 0.36, -0.45, 0.4, mat('#d9654e'), 0.72);
    for (const q of [-1, 1]) { add(G.box, mat('#ffb3a0'), q * 0.28, 1.05, 0.5, 0.06, 0.4, 0.06); add(G.sph, mat('#ffffff'), q * 0.28, 1.28, 0.5, 0.13); add(G.eye, black, q * 0.28, 1.3, 0.6, 0.55); add(G.sph, mat('#ff6a50'), q * 1.15, 0.78, 0.72, 0.42, 0.3, 0.46); add(G.cone, mat('#ffd2c6'), q * 1.02, 0.84, 1.12, 0.55, 0.8, 0.55, 1.57); add(G.cone, mat('#ffd2c6'), q * 1.3, 0.8, 1.12, 0.55, 0.8, 0.55, 1.57); }
  } else if (mid === 'bats') {
    body(0.42, 0.42, 0.42, 0.9); eyes(0.15, 1, 0.34, 0.7); for (const q of [-1, 1]) add(G.cone, mat(c), q * 0.2, 1.38, 0, 0.5, 0.75, 0.5); add(G.cone, mat('#ffffff'), 0.07, 0.75, 0.38, 0.12, 0.25, 0.12, 3.14); add(G.cone, mat('#ffffff'), -0.07, 0.75, 0.38, 0.12, 0.25, 0.12, 3.14);
    wings(mat('#4e3a5c'), 1.25, 0.5, 0.3, 0.95, 0, 0.25);
  } else if (mid === 'snail') {
    body(0.55, 0.32, 1.15, 0.32, 0.1); add(G.sph, mat(c), 0, 0.72, 1.05, 0.34); eyes(0.14, 0.82, 1.32, 0.9);
    for (const q of [-1, 1]) { add(G.box, mat(c), q * 0.17, 1.2, 1.12, 0.05, 0.5, 0.05, 0.2); add(G.sph, mat('#fff1d0'), q * 0.17, 1.46, 1.17, 0.07); }
    const tor = (r, y, z, m) => add(new THREE.TorusGeometry(r, r * 0.42, 8, 18), m, 0, y, z, 1, 1, 1, 0, 1.57, 0);
    tor(0.62, 1, -0.2, mat('#a85f2e')); tor(0.38, 1, -0.2, mat('#d68a48')); add(G.sph, mat('#f3c07a'), 0, 1, -0.2, 0.2);
  } else if (mid === 'duck') {
    body(0.55, 0.45, 0.7, 0.45); add(G.sph, mat(c), 0, 0.95, 0.45, 0.33); eyes(0.14, 1.02, 0.7); add(G.sph, mat('#ff9d3f'), 0, 0.9, 0.8, 0.17, 0.07, 0.2); add(G.cone, mat(c), 0, 0.68, -0.72, 0.8, 0.8, 0.8, -1); for (const q of [-1, 1]) add(G.sph, mat('#ffe680'), q * 0.52, 0.5, -0.05, 0.1, 0.25, 0.4);
  } else if (mid === 'bee') {
    body(0.72, 0.68, 0.98, 0.9, 0, mat('#ffd23f')); for (const z of [-0.42, 0, 0.4]) add(G.sph, black, 0, 0.9, z, 0.73 * Math.cos(z), 0.69 * Math.cos(z), 0.13); add(G.sph, mat('#ffcb2e'), 0, 1.05, 0.95, 0.42); eyes(0.2, 1.15, 1.26, 1.2); add(G.cone, black, 0, 0.88, -1.1, 0.75, 1, 0.75, -1.57);
    for (const q of [-1, 1]) add(G.box, black, q * 0.2, 1.55, 1, 0.04, 0.5, 0.04, 0.4, 0, q * -0.4);
    wings(shine('#ffffff'), 1.1, 0.42, 0.35, 1.45, -0.15, 0.35);
  } else if (mid === 'moth') {
    body(0.3, 0.3, 0.85, 1, 0, mat('#efeaff')); add(G.sph, mat('#ffffff'), 0, 1.08, 0.78, 0.3); eyes(0.16, 1.16, 0.98, 1); for (const q of [-1, 1]) add(G.cone, mat('#fff3b0'), q * 0.2, 1.42, 0.92, 0.4, 1, 0.4, 0.4, 0, q * -0.5);
    wings(shine('#bfc9ff'), 1.7, 0.85, 0.2, 1.1, 0, 0.15); for (const p of g.userData.wings) { add(G.sph, glow('#fff3b0'), p.userData.q * 1.05, 0.05, 0.25, 0.22, 0.03, 0.22, 0, 0, 0, p); add(G.sph, glow('#7f8cff'), p.userData.q * 0.65, 0.05, -0.3, 0.15, 0.03, 0.15, 0, 0, 0, p); }
  } else if (mid === 'beetle') {
    const m = mat(c, { emissive: '#16283c' }); body(0.98, 0.62, 1.15, 0.72, -0.1, m); add(G.box, black, 0, 1.12, -0.15, 0.04, 0.05, 1.8); add(G.sph, mat('#2f445c'), 0, 0.68, 1, 0.46, 0.4, 0.4); eyes(0.26, 0.76, 1.3, 1.1); legs(3, 1.05, 0.28, -0.6, 0.55, mat('#26364a'), 0.8);
    add(G.cone, mat('#8fb2d4'), 0, 1.1, 1.55, 1.1, 1.6, 1.1, 1.2); add(G.cone, mat('#8fb2d4'), 0, 1.55, 1.05, 0.7, 1, 0.7, 0.6);
  } else if (mid === 'firefly') {
    add(G.sph, mat('#5a3a2a'), 0, 1, 0.3, 0.42, 0.42, 0.62); add(G.sph, mat('#ffcf6b'), 0, 1.1, 0.85, 0.32); eyes(0.15, 1.18, 1.1, 1); const tail = add(G.sph, glow('#ffb347'), 0, 0.95, -0.6, 0.55, 0.52, 0.72); g.userData.body = tail; g.userData.glow = tail; for (const q of [-1, 1]) add(G.box, mat('#5a3a2a'), q * 0.14, 1.5, 0.95, 0.03, 0.45, 0.03, 0.5, 0, q * -0.45);
    wings(shine('#ffe7b0'), 1, 0.36, 0.3, 1.32, 0.15, 0.4);
  } else if (mid === 'mold') {
    add(new THREE.CylinderGeometry(0.42, 0.62, 1, 12), mat('#efe3d0'), 0, 0.55, 0, 1); eyes(0.2, 0.72, 0.42, 1.4);
    const cap = add(new THREE.SphereGeometry(1, 18, 10, 0, 6.3, 0, 1.65), mat('#8a5cd6'), 0, 0.95, 0, 1.3, 0.95, 1.3); g.userData.body = cap;
    for (let i = 0; i < 9; i++) { const a = i * 0.7, r = i % 3 === 0 ? 0.42 : 0.98; add(G.sph, glow('#ffe9ff'), Math.cos(a) * r, 0.95 + Math.sqrt(Math.max(0, 1 - (r / 1.3) ** 2)) * 0.95, Math.sin(a) * r, i % 3 === 0 ? 0.17 : 0.13); }
    for (const [x, z, k] of [[0.95, 0.7, 0.3], [-1, 0.5, 0.36], [0.75, -0.9, 0.42], [-0.7, -0.95, 0.28]]) { add(new THREE.CylinderGeometry(0.12, 0.18, 1, 8), mat('#efe3d0'), x, 0.5 * k, z, k * 1.2, k, k * 1.2); add(new THREE.SphereGeometry(1, 10, 6, 0, 6.3, 0, 1.6), mat('#b48aff'), x, k * 0.9, z, k * 0.75, k * 0.55, k * 0.75); }
  } else if (mid === 'turtle') {
    const shell = add(new THREE.SphereGeometry(1, 18, 10, 0, 6.3, 0, 1.6), mat('#3f7f78', { flatShading: true }), 0, 0.45, -0.05, 1.25, 0.95, 1.4); g.userData.body = shell; add(new THREE.CylinderGeometry(1.28, 1.2, 0.18, 18), mat('#d9c98e'), 0, 0.45, -0.05, 1, 1, 1.12);
    add(G.sph, mat(c), 0, 0.72, 1.45, 0.42, 0.38, 0.5); eyes(0.2, 0.84, 1.8, 1.2); for (const qx of [-1, 1]) for (const qz of [-1, 1]) add(G.sph, mat(c), qx * 1, 0.25, qz * 0.9, 0.34, 0.26, 0.44);
    const star = new THREE.OctahedronGeometry(1, 0), ge = glow('#fff3a0'); add(star, ge, 0, 1.55, -0.05, 0.28); for (let i = 0; i < 6; i++) { const a = i * 1.047; add(star, ge, Math.cos(a) * 0.8, 1.14, -0.05 + Math.sin(a) * 0.92, 0.14); }
  } else { body(0.85, 0.75, 0.95, 0.78); eyes(0.3, 1.02, 0.76, 1); }
  g.userData.s = s; g.userData.flyY = (d.fly || 0) * (d.epic ? s * 0.5 : 1);
  if (g.userData.body) { g.userData.by = g.userData.body.position.y; g.userData.bsy = g.userData.body.scale.y; }
  if (d.boss || mid === 'firefly') { const a = ringOf(c, 0.55); a.scale.setScalar(s * 1.05); a.position.y = 0.06 - g.userData.flyY; g.add(a); }
  return g;
}
game.makeMon = makeMon; // 점검용
function makeChampView(u, r) {
  const def = champById(r.champ);
  const bear = new Roach({ own: true, seed: r.name, color: def.color, age: 25, look: { ...(r.look || {}), hat: 0, face: 0, outfit: 0, extra: 0 }, accessories: def.acc || [] });
  bear.setHeld(`${HELD[def.held] || 'sword'}:${def.color}`);
  bear.root.scale.setScalar(1.45);
  const ring = ringOf(r.id === game.myUnit ? '#ffe066' : TC[r.team], r.id === game.myUnit ? 1 : 0.75); ring.scale.setScalar(1.5);
  scene.add(bear.root, ring);
  return { bear, ring, o: bear.root, def, name: r.name, team: r.team, roster: r };
}
function viewFor(u) {
  const [id, k, t] = u;
  let v = game.views.get(id);
  if (v) return v;
  if (k === 0) { const r = game.roster.get(id); if (!r) return null; v = makeChampView(u, r); }
  else if (k === 1) { v = { o: makeMinion(t, u[7]), type: u[7], team: t === 0 ? 'blue' : 'red' }; scene.add(v.o); }
  else if (k === 3) { v = { o: makeMon(u[7], !!u[8]), mid: u[7], big: !!u[8], team: 'neutral' }; scene.add(v.o); }
  else if (k === 4) { const o = new THREE.Group(), e = new THREE.Mesh(G.sph, mat(t === 0 ? '#9fe8ff' : '#ffb3c6', { emissive: t === 0 ? '#3fa8e0' : '#e0507a' })); e.scale.setScalar(0.32); e.position.y = 0.55; o.add(e); const st = new THREE.Mesh(G.box, mat('#7a5a3f')); st.scale.set(0.09, 0.5, 0.09); st.position.y = 0.25; o.add(st); v = { o, team: t === 0 ? 'blue' : 'red', ward: true }; scene.add(o); }
  else { const s = structAt(u[3], u[4]); if (!s) return null; v = { o: s.o, struct: s, team: s.team, structKind: s.k }; }
  v.id = id; v.k = k; v.x = u[3]; v.z = u[4]; v.tx = u[3]; v.tz = u[4]; v.face = 0; v.hurtT = 0;
  v.o.position.set(v.x, 0, v.z);
  game.views.set(id, v);
  return v;
}
function dropView(v) {
  game.views.delete(v.id);
  if (v.bear) { scene.remove(v.bear.root, v.ring); return; }
  if (v.struct) return;
  scene.remove(v.o);
}
// ---------- 효과 ----------
const fx = [];
function ringFx(x, z, r, col, life = 0.5, fill = 0.25, y = 0.12) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const d = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: fill, depthWrite: false, side: THREE.DoubleSide })); d.rotation.x = -Math.PI / 2; g.add(d);
  const e = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); e.rotation.x = -Math.PI / 2; g.add(e);
  g.scale.set(r, 1, r); scene.add(g); const o = { o: g, t: life, life, d, e, kind: 'ring', fill }; fx.push(o); return o;
}
function grow(x, z, r, col, life = 0.4) { const f = ringFx(x, z, 0.1, col, life, 0.4); f.kind = 'grow'; f.r = r; return f; }
function spark(x, y, z, col, s = 1, life = 0.35) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(x, y, z); m.scale.setScalar(s); scene.add(m); const o = { o: m, t: life, life, kind: 'spark', s }; fx.push(o); return o; }
function boom(x, z, r, col) { grow(x, z, r, col, 0.4); spark(x, 1.2, z, col, r * 1.6, 0.35); for (let i = 0; i < 6; i++) { const a = i * 1.05, f = spark(x, 1, z, col, 0.8, 0.45); f.vx = Math.cos(a) * r * 1.8; f.vz = Math.sin(a) * r * 1.8; f.vy = 3; } }
const shots = new Map();
function addShot(e) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: e.col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); const s = Math.max(1.6, e.w * 1.5) * (e.big ? 1.5 : 1); m.scale.setScalar(s); m.position.set(e.x, 1.2, e.z); scene.add(m); shots.set(e.id, { m, e, x: e.x, z: e.z, left: e.L, tr: 0 }); }
function orb(fromV, toV, col, speed = 22, size = 1.3) { if (!toV) return; const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.setScalar(size); m.position.set(fromV.x, 1.5, fromV.z); scene.add(m); fx.push({ o: m, kind: 'orb', to: toV, speed, t: 2, life: 2, col, size, tr: 0 }); }
// 근접 평타: 대상 쪽으로 휘두르는 초승달
const SLASH_G = new THREE.RingGeometry(1.1, 2.3, 20, 1, -1.05, 2.1);
function slash(x, z, tx, tz, col, big) { const g = new THREE.Group(), m = new THREE.Mesh(SLASH_G, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; g.add(m); g.position.set(x, 1.1, z); g.rotation.y = Math.atan2(tz - z, tx - x) * -1; const s = big ? 1.35 : 1; g.scale.set(0.5 * s, 1, 0.5 * s); scene.add(g); fx.push({ o: g, m, kind: 'slash', t: 0.17, life: 0.17, s }); }
const floats = [];
function floatText(x, y, z, text, col, big) { floats.push({ x, y, z, text, col, big, t: 0.9, life: 0.9 }); if (floats.length > 60) floats.shift(); }
function banner(a, b = '', ms = 2600) { const el = $('banner'); el.innerHTML = `${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}`; el.classList.remove('hidden'); void el.offsetWidth; clearTimeout(banner.t); banner.t = setTimeout(() => el.classList.add('hidden'), ms); }
function feed(html, team) { const d = document.createElement('div'); d.className = team || ''; d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 5) $('feed').lastChild.remove(); setTimeout(() => d.remove(), 8000); }

// ---------- 서버에서 온 것 ----------
const view = (id) => game.views.get(id);
function onSnapshot(m) {
  game.T = m.T;
  // 스냅샷 간격을 재서 그 시간 동안 일정한 속도로 움직인다
  const nowS = performance.now(); if (game.snapAt) game.snapD = Math.max(70, Math.min(220, (game.snapD || 100) * 0.8 + (nowS - game.snapAt) * 0.2)); game.snapAt = nowS;
  const myFace = nowS < (game.faceUntil || 0);
  const seen = new Set();
  for (const u of m.u) {
    const v = viewFor(u); if (!v) continue;
    seen.add(u[0]); v.tx = u[3]; v.tz = u[4]; v.hp = u[5]; v.max = u[6]; v.u = u; v.iT = nowS; v.iP = 0;
    if (u[1] === 0) { v.mp = u[7]; v.mpMax = u[8]; v.lv = u[9]; v.f = u[10]; v.sh = u[11]; if (!(u[0] === game.myUnit && (myFace || game.pred))) v.tface = u[12]; v.o.visible = true; v.ring.visible = true; }
    else if (u[1] === 1) { v.tface = u[8]; }
    else if (u[1] === 3) { v.tface = u[9]; }
    else if (u[1] === 2) { v.invuln = !!u[9]; v.lastHp = u[5]; }
  }
  for (const v of [...game.views.values()]) if (!seen.has(v.id)) dropView(v);
  if (m.e?.length) for (const e of m.e) onEvent(e);
}
function onEvent(e) {
  const near = (x, z) => { const d = Math.hypot(x - game.focus.x, z - game.focus.z); return Math.max(0, 1 - d / 55); };
  switch (e.k) {
    case 'cast': { const v = view(e.id); if (v?.bear) v.bear.cast?.(); if (v) { v.faceHold = 0.35; v.tface = v.face = Math.atan2(e.x - v.x, e.z - v.z); } break; }
    case 'shot': addShot(e); if (near(e.x, e.z) > 0.2) S.sfx('zap'); break;
    case 'pop': { const s = shots.get(e.id); if (s) { scene.remove(s.m); shots.delete(e.id); } spark(e.x, 1.2, e.z, e.col, 2.2, 0.25); break; }
    case 'aoe': { const f = ringFx(e.x, e.z, e.r, e.col, e.d, 0.12); f.kind = 'charge'; if (e.boss) { floatText(e.x, 3.6, e.z, `⚠️ ${e.boss}`, '#ffd76a', true); if (near(e.x, e.z) > 0.2) S.sfx('boss'); const v = view(e.id); if (v) v.lunge = 0.14; } break; }
    case 'boom': boom(e.x, e.z, e.r, e.col); if (near(e.x, e.z) > 0.2) S.sfx('boom'); break;
    case 'nova': boom(e.x, e.z, e.r, e.col); if (near(e.x, e.z) > 0.2) S.sfx('boom'); break;
    case 'cone': { const a = Math.atan2(e.fx, e.fz); for (let i = -2; i <= 2; i++) for (let d = 2; d <= e.r; d += 2.2) { const b = a + i * Math.acos(e.arc) / 2.2, f = spark(e.x + Math.sin(b) * d, 1, e.z + Math.cos(b) * d, e.col, 2.1, 0.3 + d * 0.012); f.delay = d * 0.012; } break; }
    case 'zone': { const f = ringFx(e.x, e.z, e.r, e.col, e.d, 0.22); f.kind = 'zone'; f.follow = e.follow; break; }
    case 'dash': { const v = view(e.id); if (v) { v.dashCol = e.col; v.dashT = 0.5; } if (e.id === game.myUnit) game.pred = null; break; }
    case 'land': boom(e.x, e.z, Math.max(1.5, e.r * 0.8), e.col); break;
    case 'blink': if (Math.hypot(e.x - (view(game.myUnit)?.x ?? 1e9), e.z - (view(game.myUnit)?.z ?? 1e9)) < 2) { game.pred = null; const mv = view(game.myUnit); mv.x = mv.tx = e.tx; mv.z = mv.tz = e.tz; } spark(e.x, 1, e.z, e.col, 3, 0.35); spark(e.tx, 1, e.tz, e.col, 3, 0.35); { for (let i = 0; i < 5; i++) { const k = i / 5; spark(e.x + (e.tx - e.x) * k, 1, e.z + (e.tz - e.z) * k, e.col, 1.4, 0.3); } } if (near(e.x, e.z) > 0.2) S.sfx('zap'); break;
    case 'hit': { const a = view(e.id), b = view(e.to); if (b) { spark(b.x, 1.2, b.z, e.col, 3.5, 0.3); grow(b.x, b.z, 1.8, e.col, 0.3); } if (a?.bear) a.bear.attack('melee'); break; }
    case 'buff': { const v = view(e.id); if (v) { grow(v.x, v.z, 2.2, e.col, 0.5); if (e.ic) floatText(v.x, 3, v.z, e.ic, '#fff', true); } break; }
    case 'cc': { const v = view(e.to); if (v) { floatText(v.x, 3.2, v.z, e.c === 'stun' ? '💫' : e.c === 'knock' ? '🌀' : e.c === 'star' ? '🌟' : '🌿', '#fff', true); if (e.c === 'knock') v.airT = e.d; } break; }
    case 'smite': spark(e.x, 3, e.z, '#ffe066', 7, 0.3); grow(e.x, e.z, 3, '#ffe066', 0.3); S.sfx('zap'); break;
    case 'ignite': { const v = view(e.to); if (v) { spark(v.x, 1.5, v.z, '#ff7a3c', 3, 0.5); floatText(v.x, 3, v.z, '🔥', '#fff', true); } break; }
    case 'dmg': { const v = view(e.to); if (!v) break; if (e.ty !== 'heal') { v.hurtT = 0.13; if (v.bear) v.bear.hurt?.(); } const mine = e.by === game.myUnit || e.to === game.myUnit; if (!mine && e.ty !== 'heal') break; floatText(v.x + (Math.random() - 0.5), v.k === 0 ? 2.7 : 1.9, v.z, e.ty === 'heal' ? `+${e.n}` : `${e.n}${e.crit ? '!' : ''}`, e.ty === 'heal' ? '#7fe08a' : e.to === game.myUnit ? '#ff6b6b' : e.ty === 'magic' ? '#c79bff' : e.ty === 'true' ? '#ffffff' : '#ffb36b', e.crit); if (e.to === game.myUnit && e.n > 20) S.sfx('hurt'); break; }
    case 'gold': if (e.id === game.myUnit) { floatText(e.x, 1.9, e.z, `+${e.n}🪙`, '#ffd76a'); S.sfx('xp'); } break;
    case 'atk': { const v = view(e.id), t = view(e.to); if (v?.bear) v.bear.attack(e.r ? 'shoot' : 'melee'); if (v && t) { v.faceHold = 0.3; v.tface = Math.atan2(t.x - v.x, t.z - v.z); } break; }
    // 평타가 실제로 나가는 순간: 원거리는 탄, 근접은 초승달 + 맞은 자리 번쩍
    case 'aland': { const v = view(e.id), t = view(e.to); if (!v || !t) break; const col = e.crit ? '#ffe066' : e.col; if (e.r) orb(v, t, col, 24, e.crit ? 1.9 : 1.35); else { slash(v.x, v.z, t.x, t.z, e.crit ? '#ffe066' : '#ffffff', e.crit); spark(t.x, 1.1, t.z, col, e.crit ? 2.8 : 1.9, 0.2); } if (e.id === game.myUnit) S.sfx(e.r ? 'shoot' : 'swish'); break; }
    case 'matk': { const v = view(e.id), t = view(e.to); if (!v || !t) break; if (v.k === 3) { slash(v.x, v.z, t.x, t.z, MONS[v.mid]?.color || '#ffffff', MONS[v.mid]?.epic); break; } const c = v.team === 'blue' ? '#9fe8ff' : '#ffb3c6'; v.lunge = 0.14; v.tface = Math.atan2(t.x - v.x, t.z - v.z); if (e.r) orb(v, t, c, 20, 0.85); else spark(t.x, 0.9, t.z, c, 1, 0.14); break; }
    case 'tshot': { const v = view(e.id), t = view(e.to); if (v && t) { orb({ x: v.o.position.x, z: v.o.position.z }, t, TC[e.team], 34); fx[fx.length - 1].o.position.y = 5.5; fx[fx.length - 1].o.scale.setScalar(1.6); fx[fx.length - 1].size = 1.6; if (e.to === game.myUnit) { game.towerOnMe = performance.now() + 1400; if (performance.now() - (game.towerWarn || -1e9) > 7000) { game.towerWarn = performance.now(); banner('🗼 포탑이 나를 노려요!', e.agg ? '포탑 근처에서 적 챔피언을 때리면 포탑이 나를 먼저 때려요' : '내 꼬마가 사거리에 없어요. 꼬마와 같이 들어가요', 2400); } } } break; }
    case 'ward': grow(e.x, e.z, 2, '#9fe8ff', 0.4); S.sfx('tick'); break;
    case 'lvl': { const v = view(e.id); if (v) { grow(v.x, v.z, 3, '#ffe066', 0.6); floatText(v.x, 3.3, v.z, 'LEVEL UP', '#ffe066', true); } if (e.id === game.myUnit) S.sfx('lvl'); break; }
    case 'spawn': if (e.id === game.myUnit) banner('💪 다시 시작!', '', 1200); break;
    case 'kill': {
      const mine = game.roster.get(e.by)?.team === game.team;
      feed(`<b>${esc(e.byC)} ${esc(e.byName)}</b> ⚔️ ${esc(e.toC)} ${esc(e.toName)}${e.as ? ` <small>+${e.as}</small>` : ''}`, e.team === 'blue' ? 'red' : 'blue');
      if (!game.firstBlood && e.by) { game.firstBlood = true; banner(`🩸 첫 번째 처치!`, `${e.byName} → ${e.toName}`); }
      else if (e.by === game.myUnit) banner(e.sk >= 5 ? `🔥 ${e.sk}연속 처치!` : e.sk >= 3 ? `✨ ${e.sk}연속 처치!` : '⚔️ 적을 처치했어요!', `${e.toName}`, 1800);
      else if (e.to === game.myUnit) banner('💤 쓰러졌어요', `${e.byName}`, 1800);
      else if (e.sk >= 3) banner(`${e.byName} ${e.sk}연속 처치!`, '', 1800);
      S.sfx(mine ? 'kill' : 'hurt'); spark(e.x, 1.5, e.z, '#ff5a7a', 5, 0.5); if (e.to === game.myUnit) { game.pred = null; game.shake = 0.5; } break;
    }
    case 'fall': {
      const s = structViews.find((q) => Math.hypot(q.at[0] - e.x, q.at[1] - e.z) < 1); if (s) { s.alive = false; s.o.visible = false; const r = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.7, 8), mat('#6a6a74')); r.position.set(e.x, 0.35, e.z); scene.add(r); }
      boom(e.x, e.z, 6, TC[e.team]); spark(e.x, 3, e.z, '#ffd76a', 10, 0.6); S.sfx('boom'); game.shake = Math.max(game.shake, 0.6);
      const ours = e.team === game.team, nm = e.sk === 'heart' ? '젤리 심장' : e.sk === 'gate' ? `${ROLES[e.lane === 'top' ? 'top' : e.lane === 'bot' ? 'bot' : 'mid']?.name} 수문` : `${e.lane === 'base' ? '심장 지킴이' : `${ROLES[e.lane]?.name} ${e.tier}차 포탑`}`;
      banner(ours ? `😱 우리 ${nm}이 무너졌어요` : `🎉 적 ${nm} 파괴!`, `${e.by}`, 2200); feed(`🗼 ${esc(nm)} 파괴`, e.team === 'blue' ? 'red' : 'blue'); break;
    }
    case 'epic': { const ours = e.team === game.team; banner(`${e.icon} ${ours ? '우리 팀이' : '상대 팀이'} ${e.name} 처치!`, e.buff, 3600); feed(`${e.icon} ${TEAMS[e.team].name} 처치`, e.team); S.sfx('boss'); break; }
    case 'epicUp': banner(`${e.icon} ${e.name} 등장!`, '강가에 나타났어요. 잡으면 팀 전체가 강해져요', 2600); S.sfx('boss'); break;
    case 'ping': { const c = e.c === 'danger' ? '#ff5a7a' : '#7fe08a'; ringFx(e.x, e.z, 3, c, 1.6, 0.12); game.pings.push({ x: e.x, z: e.z, c, at: performance.now() }); S.sfx('tick'); feed(`📍 ${esc(e.by)}`, game.team); break; }
    case 'recap': if (e.id === game.myUnit) $('recap').innerHTML = e.list.map((l) => `<div><span>${esc(l.name)}</span><b>${l.phys + l.magic + l.tru}</b></div>`).join(''); break;
    case 'over': break;
  }
}
// ---------- HUD ----------
function buildBar(def) {
  $('b-emoji').textContent = def.emoji;
  $('b-skills').innerHTML = [['passive'], ...KEYS_SK.map((s) => [s]), ['d'], ['f']].map(([s]) => {
    if (s === 'passive') return `<button class="sk spell" data-tip="passive" title="">${def.passive ? '🌟' : ''}</button>`;
    if (s === 'd' || s === 'f') return `<button class="sk spell" data-s="${s}" data-tip="${s}"><span class="ic"></span><span class="key">${s.toUpperCase()}</span><span class="cd hidden"></span></button>`;
    const sk = def.skills[s];
    return `<button class="sk" data-s="${s}" data-tip="${s}"><span class="rk">${Array.from({ length: s === 'r' ? 3 : 5 }, () => '<u></u>').join('')}</span>${sk.icon}<span class="key">${s.toUpperCase()}</span><span class="cd hidden"></span><button class="up hidden" data-up="${s}">＋</button></button>`.replace('<button class="up', '<span class="up').replace('</button></button>', '</span></button>');
  }).join('');
  $('b-skills').querySelectorAll('[data-s]').forEach((b) => { b.onclick = (ev) => { if (ev.target.dataset.up) { game.sendLv(ev.target.dataset.up); return; } castAt(b.dataset.s, touch); }; });
  $('b-skills').querySelectorAll('[data-tip]').forEach((b) => { b.onmouseenter = () => { showTip(b.dataset.tip); if (KEYS_SK.includes(b.dataset.tip)) game.previewAim = b.dataset.tip; }; b.onmouseleave = () => { $('tip').classList.add('hidden'); game.previewAim = null; }; });
}
// 스킬 설명: 쓰는 법 · 지금 피해(내 능력치 반영) · 효과를 한눈에
const HOW = {
  shot: (s) => `🖱️ 마우스 쪽으로 쏴요 · 사거리 ${s.range}${s.pierce ? ' · 줄 위의 적을 모두 꿰뚫어요' : s.burst ? ' · 맞으면 주변까지 터져요' : ' · 처음 닿은 적에게 맞아요'}${s.fan ? ` · ${s.fan}개가 부채꼴로` : ''}`,
  aoe: (s) => `🖱️ 마우스 자리에 ${s.delay}초 뒤 터져요 · 범위 ${s.radius}${s.range >= 100 ? ' · 맵 어디든' : ` · 사거리 ${s.range}`}`,
  nova: (s) => `⭕ 내 주변 ${s.radius} 안의 적 모두에게 바로`,
  cone: (s) => `🖱️ 마우스 쪽 부채꼴 ${s.range} 안의 적 모두에게`,
  zone: (s) => (s.follow ? `⭕ ${s.dur}초 동안 내 주변 ${s.radius} 안에 계속` : `🖱️ 마우스 자리에 ${s.dur}초 동안 남아요 · 범위 ${s.radius}`),
  dash: (s) => (s.back ? `💨 마우스 반대쪽으로 ${s.range} 뛰어요` : `💨 마우스 쪽으로 ${s.range}까지 돌진${s.dmg?.[0] ? ' · 지나가며 맞혀요' : ''}`),
  blink: (s) => `✨ 마우스 쪽으로 ${s.range}까지 순간이동`,
  hit: (s) => `🎯 적을 가리키고 눌러요 · 사거리 ${s.range} (멀면 걸어가서 써요)`,
  buff: (s) => `💪 누르면 바로 ${s.dur}초 동안 내게`,
  ally: (s) => (s.global ? '🌍 맵 전체 아군에게' : s.radius ? `⭕ 주변 ${s.radius} 안의 아군에게` : `💚 마우스 근처 아군에게 (없으면 나) · 사거리 ${s.range}`),
};
const STAT_NAME = { ad: '공격력', ap: '주문력', ar: '방어력', mr: '마법 저항', as: '공격 속도', ms: '이동 속도', lifesteal: '흡혈', range: '사거리', siege: '건물 피해' };
function skillDetail(sk, rank, st) {
  const i = Math.max(0, rank - 1), base = sk.dmg?.[i] || 0, pct = (x) => `${Math.round(x * 100)}%`, ty = sk.type === 'phys' ? '물리' : '마법';
  const bonus = st ? (sk.ad || 0) * st.ad + (sk.ap || 0) * st.ap : 0, rate = [sk.ad ? `공격력 ${pct(sk.ad)}` : '', sk.ap ? `주문력 ${pct(sk.ap)}` : ''].filter(Boolean).join(' + ');
  const zoneNote = sk.kind === 'zone' && base ? ' (0.5초마다 반씩)' : '';
  const num = base ? `피해 <b>${Math.round(base + bonus)}</b> ${ty}${zoneNote}${rate ? ` <small style="display:inline;opacity:.7">= ${base} + ${rate}</small>` : ''}` : '';
  const heal = sk.heal ? `회복 <b>${Math.round(sk.heal[i] + (sk.healAp || 0) * (st?.ap || 0))}</b>` : '', shield = sk.shield ? `보호막 <b>${Math.round(sk.shield[i] + (sk.shieldAp || 0) * (st?.ap || 0))}</b>` : '';
  const ef = []; const on = sk.on || {};
  if (on.stun) ef.push(`💫 기절 ${on.stun}초`); if (on.knock) ef.push(`🌀 띄우기 ${on.knock}초`); if (on.root) ef.push(`🌿 묶기 ${on.root}초 (기술은 쓸 수 있어요)`); if (on.slow) ef.push(`🐌 ${pct(on.slow)} 느리게 ${on.slowT}초`); if (on.burn) ef.push('🔥 불태우기 2초');
  if (sk.pull) ef.push('🪝 내 앞으로 끌어와요'); if (sk.healHit) ef.push(`🩸 준 피해의 ${pct(sk.healHit)} 회복`); if (sk.execute) ef.push('☠️ 체력이 적을수록 더 세요'); if (sk.healMissing) ef.push(`💗 잃은 체력의 ${pct(sk.healMissing)} 회복`); if (sk.stealth) ef.push('🌫️ 모습 감추기'); if (sk.buffNext) ef.push(`👊 다음 평타 ×${sk.buffNext}`);
  const buffs = sk.stats || sk.teamBuff; if (buffs) for (const [k, v] of Object.entries(buffs)) if (STAT_NAME[k]) ef.push(`⬆️ ${STAT_NAME[k]} +${k === 'lifesteal' || k === 'siege' ? pct(v) : k === 'ms' ? Math.round(v * 10) : v}`);
  return `<span class="how">${HOW[sk.kind]?.(sk) || ''}</span>${[num, heal, shield].filter(Boolean).map((x) => `<span class="num">${x}</span>`).join('')}${ef.map((x) => `<span class="ef">${x}</span>`).join('')}`;
}
function showTip(k) {
  const me = game.me, def = game.def; if (!def) return;
  let html = '';
  if (k === 'passive') html = `<b>🌟 ${esc(def.passive.name)}</b> <small>(지속 효과)</small><div>${esc(def.passive.desc)}</div>`;
  else if (k === 'd' || k === 'f') { const sp = SPELLS[k === 'd' ? 'flash' : me?.spell || 'heal']; html = `<b>${sp.icon} ${esc(sp.name)}</b> <small>재사용 ${sp.cd}초</small><div>${esc(sp.desc)}</div>`; }
  else { const sk = def.skills[k], r = me?.rank?.[k] || 0; html = `<b>${sk.icon} ${esc(sk.name)}</b> <small style="display:inline">${k.toUpperCase()} · ${r ? `${r}레벨` : '아직 안 배움'} · 재사용 ${sk.cd}초 · 마나 ${sk.mana}</small><div>${esc(sk.desc)}</div>${skillDetail(sk, r || 1, me?.st)}`; }
  $('tip').innerHTML = html; $('tip').classList.remove('hidden');
}
let meT = 0;
function onMe(m) {
  game.me = m; if (!game.def) return;
  const v = view(m.id), hp = v?.hp ?? 0, max = v?.max ?? 1, mp = v?.mp ?? 0, mpm = v?.mpMax ?? 1, sh = m.sh || 0, tot = Math.max(max, hp + sh);
  $('hp-f').style.width = `${(hp / tot) * 100}%`; $('hp-s').style.width = `${((hp + sh) / tot) * 100}%`; $('hp-t').textContent = m.alive ? `${Math.round(hp)} / ${Math.round(max)}` : ''; $('mp-f').style.width = `${(mp / mpm) * 100}%`; $('mp-t').textContent = m.alive ? `${Math.round(mp)} / ${Math.round(mpm)}` : '';
  $('xp-f').style.width = `${(m.xp / m.need) * 100}%`; $('b-lv').textContent = m.lv; $('b-gold').textContent = m.gold;
  const can = (s) => m.pts > 0 && (s === 'r' ? m.rank.r < 3 && m.lv >= R_LEVELS[m.rank.r] : m.rank[s] < 5 && m.rank[s] < Math.ceil(m.lv / 2));
  $('b-skills').querySelectorAll('[data-s]').forEach((b) => {
    const s = b.dataset.s, cd = m.cds[s] || 0, el = b.querySelector('.cd');
    el.classList.toggle('hidden', cd <= 0);
    if (cd > 0) { el.textContent = cd >= 10 ? Math.ceil(cd) : cd.toFixed(1); const mx = s === 'd' ? SPELLS.flash.cd : s === 'f' ? SPELLS[m.spell].cd : game.def.skills[s].cd * (1 - Math.min(0.5, m.st.haste / 100)); el.style.setProperty('--p', Math.min(1, cd / mx).toFixed(3)); }
    if (b.dataset.was > 0 && cd <= 0) { b.classList.remove('ready'); void b.offsetWidth; b.classList.add('ready'); } b.dataset.was = cd;
    b.classList.toggle('aim', game.aim === s);
    if (s === 'd' || s === 'f') { b.querySelector('.ic').textContent = SPELLS[s === 'd' ? 'flash' : m.spell].icon; return; }
    const r = m.rank[s], sk = game.def.skills[s]; b.classList.toggle('off', r <= 0 || (v && mp < sk.mana));
    b.querySelectorAll('.rk u').forEach((u, i) => u.classList.toggle('on', i < r));
    b.querySelector('.up').classList.toggle('hidden', !can(s));
  });
  const sig = m.items.join();
  if (sig !== game.itemSig) { game.itemSig = sig; const cells = [...m.items.map((id) => `<div title="${esc(ITEMS[id].name)} · ${esc(ITEMS[id].desc)}">${ITEMS[id].icon}</div>`)]; while (cells.length < 6) cells.push('<div></div>'); $('b-items').innerHTML = cells.join(''); }
  const ss = `${m.st.ad}|${m.st.ap}|${m.st.ar}|${m.st.mr}|${m.st.as}|${m.st.ms}`;
  if (ss !== game.statSig) { game.statSig = ss; $('b-stats').innerHTML = [['⚔️', m.st.ad, '공격력'], ['🔮', m.st.ap, '주문력'], ['🛡️', m.st.ar, '방어력'], ['🌀', m.st.mr, '마법 저항'], ['⚡', m.st.as, '공격 속도'], ['👟', m.st.ms, '이동 속도']].map(([a, b, n]) => `<span title="${n}">${a} ${b}</span>`).join(''); }
  $('n-pot').textContent = m.pot; $('n-ward').textContent = m.wards;
  $('dead').classList.toggle('hidden', m.alive); if (!m.alive) { $('dead-t').textContent = m.resp; game.pred = null; }
  // 공격 대상을 쫓는 동안은 서버 길을 따른다. 단, 방금 낸 이동 명령이 아직 서버에 안 닿았을 수 있으니 바로 지우지 않는다
  if (m.tg && game.pred && !game.pred.chase && performance.now() - game.pred.at > 350) game.pred = null;
  renderTarget();
  if (!$('shop').classList.contains('hidden') && (performance.now() - meT > 400)) { meT = performance.now(); renderShop(); }
}
// 왼쪽 위: 지금 노리는(또는 가리키는) 대상
function renderTarget() {
  const v = view(game.me?.tg) || (game.hover?.k !== 4 ? game.hover : null), el = $('tgt');
  if (!v || v.hp == null || v.team === game.team) { el.classList.add('hidden'); return; }
  const nm = v.k === 0 ? `${v.def.emoji} ${v.name}` : v.k === 1 ? '꼬마' : v.k === 3 ? `${MONS[v.mid].emoji} ${MONS[v.mid].name}` : v.structKind === 'heart' ? '💖 젤리 심장' : v.structKind === 'gate' ? '🚪 수문' : '🗼 포탑';
  el.innerHTML = `<div class="n"><span>${esc(nm)}</span>${v.k === 0 ? `<small>Lv ${v.lv}</small>` : v.invuln ? '<small>🔒 앞 건물을 먼저</small>' : ''}</div><div class="bar"><i style="width:${(v.hp / v.max) * 100}%"></i></div><small>${Math.round(v.hp)} / ${Math.round(v.max)}</small>`;
  el.classList.remove('hidden');
}
function onScore(m) {
  game.sb = m;
  $('s-kb').textContent = m.kills.blue; $('s-kr').textContent = m.kills.red; $('s-tb').textContent = m.towers.blue; $('s-tr').textContent = m.towers.red;
  const mine = m.list.find((x) => x.id === game.myUnit); if (mine) { $('s-kda').textContent = `⚔️ ${mine.k}/${mine.d}/${mine.a}`; $('s-cs').textContent = `🌾 ${mine.cs}`; }
  $('h-epic').innerHTML = m.camps.map((c) => `<span>${MONS[c.id].emoji} ${c.up ? '등장!' : `${Math.floor(c.inS / 60)}:${String(c.inS % 60).padStart(2, '0')}`}</span>`).join('') + m.buffs[game.team].map((b) => `<span class="buf">${b.ic}${b.n ? `×${b.n}` : ''}${b.s ? ` ${Math.floor(b.s / 60)}:${String(b.s % 60).padStart(2, '0')}` : ''}</span>`).join('');
  if (!$('board').classList.contains('hidden')) renderBoard();
}
function row(x) { const c = champById(x.champ); return `<div class="bd-row${x.id === game.myUnit ? ' me' : ''}${x.alive ? '' : ' dead'}"><span>${ROLES[x.role]?.icon || ''}</span><span>${c.emoji}</span><span>${esc(x.name)}${x.alive ? '' : ` (${x.resp})`}</span><span>${x.lv}</span><span>${x.k}/${x.d}/${x.a}</span><span>🌾${x.cs}</span><span>${x.items.map((i) => ITEMS[i].icon).join(' ')}</span></div>`; }
function renderBoard() { const m = game.sb; if (!m) return; $('bd-top').innerHTML = `<b>${fmt(m.time)}</b> · ${TEAMS.blue.name} ${m.kills.blue} : ${m.kills.red} ${TEAMS.red.name}`; $('bd-list').innerHTML = ['blue', 'red'].map((t) => `<div class="bd-t ${t}">${TEAMS[t].name} · 포탑 ${m.towers[t]} · 큰 몬스터 ${m.epics[t]}</div>${m.list.filter((x) => x.team === t).map(row).join('')}`).join(''); }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// ---------- 상점 ----------
const SHOP_TABS = { all: '전체', ad: '⚔️ 공격', ap: '🔮 주문', def: '🛡️ 방어', boots: '👟 신발' };
function renderShop() {
  const m = game.me; if (!m) return; $('sh-gold').textContent = m.gold;
  $('sh-note').textContent = m.base ? '여기서 살 수 있어요' : '🏠 기지(샘 근처)로 돌아가야 살 수 있어요';
  const nx = (BUILD[game.def?.cls] || []).find((id) => !m.items.includes(id) && !(ITEMS[id].tag === 'boots' && m.items.some((q) => ITEMS[q].tag === 'boots' && ITEMS[q].cost >= ITEMS[id].cost)));
  $('sh-next').classList.toggle('hidden', !nx || !m.base); if (nx) { $('sh-next').textContent = `⭐ 다음 추천 사기: ${ITEMS[nx].icon} ${ITEMS[nx].name} (${ITEMS[nx].cost})`; $('sh-next').disabled = m.gold < ITEMS[nx].cost; $('sh-next').onclick = () => { shell.send({ t: 'buy', it: nx }); S.sfx('ok'); }; }
  $('sh-tabs').innerHTML = Object.entries(SHOP_TABS).map(([k, v]) => `<button data-k="${k}" class="${game.shop === k ? 'on' : ''}">${v}</button>`).join('');
  $('sh-tabs').querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { game.shop = b.dataset.k; renderShop(); }; });
  const inTab = (it) => { const a = it.add || {}; switch (game.shop) { case 'ad': return a.ad || a.as || a.crit || a.lifesteal; case 'ap': return a.ap || a.mp; case 'def': return a.hp || a.ar || a.mr; case 'boots': return it.tag === 'boots'; default: return true; } };
  $('sh-list').innerHTML = Object.entries(ITEMS).filter(([, it]) => inTab(it)).map(([id, it]) => `<button class="it${m.gold < it.cost ? ' no' : ''}" data-buy="${id}"><i>${it.icon}</i><span>${esc(it.name)}<small>${esc(it.desc)}</small></span><b>${it.cost}</b></button>`).join('');
  $('sh-list').querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => { shell.send({ t: 'buy', it: b.dataset.buy }); S.sfx('ok'); }; });
  $('sh-rec').innerHTML = (BUILD[game.def?.cls] || []).map((id) => `<button class="${m.items.includes(id) ? 'have' : ''}" data-buy2="${id}" title="${esc(ITEMS[id].name)} ${ITEMS[id].cost}">${ITEMS[id].icon}</button>`).join('');
  $('sh-rec').querySelectorAll('[data-buy2]').forEach((b) => { b.onclick = () => shell.send({ t: 'buy', it: b.dataset.buy2 }); });
  $('sh-mine').innerHTML = m.items.map((id, i) => `<button data-sell="${i}" title="${esc(ITEMS[id].name)} 팔기">${ITEMS[id].icon}</button>`).join('') || '<small>아직 없어요</small>';
  $('sh-mine').querySelectorAll('[data-sell]').forEach((b) => { b.onclick = () => shell.send({ t: 'sell', i: +b.dataset.sell }); });
}
function toggleShop(on) { const el = $('shop'); const v = on ?? el.classList.contains('hidden'); el.classList.toggle('hidden', !v); if (v) renderShop(); }
$('b-shop').onclick = () => toggleShop(); $('sh-close').onclick = () => toggleShop(false);
$('shop').addEventListener('mousedown', (e) => { if (e.target === $('shop')) toggleShop(false); });
$('use-pot').onclick = () => shell.send({ t: 'potion' }); $('use-ward').onclick = () => { const me = view(game.myUnit); if (me) shell.send({ t: 'ward', x: me.x, z: me.z }); };

// ---------- 입력 ----------
const mini = $('mini'), mctx = mini.getContext('2d');
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v2 = new THREE.Vector2(), hit = new THREE.Vector3();
function groundAt(mx, my) { v2.set((mx / innerWidth) * 2 - 1, -(my / innerHeight) * 2 + 1); ray.setFromCamera(v2, camera); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null; }
const scr = new THREE.Vector3();
function toScreen(x, y, z) { scr.set(x, y, z).project(camera); return { x: (scr.x + 1) / 2 * innerWidth, y: (1 - scr.y) / 2 * innerHeight, front: scr.z < 1 }; }
function unitUnder(mx, my, friendly = false) {
  let best = null, bd = 1e9;
  const champOnly = keys.has('ShiftLeft') || keys.has('ShiftRight'); // Shift: 챔피언만 노리기
  for (const v of game.views.values()) {
    if (v.ward) continue;
    const isFoe = v.team !== game.team; if (!friendly && !isFoe) continue; if (friendly && (v.k !== 0)) continue; if (champOnly && v.k !== 0) continue;
    const y = v.k === 0 ? 1.1 : v.k === 2 ? 2.5 : 0.8 + (v.o.userData.flyY || 0), s = toScreen(v.o.position.x, y, v.o.position.z), R = (v.k === 0 ? (champOnly ? 70 : 36) : v.k === 2 ? 50 : v.k === 3 ? (v.big ? 36 : 22) * (MONS[v.mid]?.epic ? 1.9 : 1) : 20) / game.zoom, d = Math.hypot(s.x - mx, s.y - my);
    if (d < R && d - (v.k === 0 ? 4 : 0) < bd) { bd = d - (v.k === 0 ? 4 : 0); best = v; }
  }
  return best;
}
function mouseGround() { return groundAt(game.mouse.x, game.mouse.y) || { x: 0, z: 0 }; }
function moveOrAttack(mx, my, marker = true) {
  const u = unitUnder(mx, my);
  if (u && !(u.k === 2 && u.invuln)) { shell.send({ t: 'atk', id: u.id }); ringPing(u.o.position.x, u.o.position.z, '#ff5a7a'); predictChase(u); return; }
  const g = groundAt(mx, my); if (!g) return;
  shell.send({ t: 'mv', x: g.x, z: g.z }); predict(g.x, g.z); if (marker) ringPing(g.x, g.z, '#7fe08a');
}
// 내 곰돌이는 서버 답을 기다리지 않고 바로 움직인다 (클릭이 씹힌 느낌 없게). 어긋나면 서버 쪽으로 맞춘다
function predict(x, z) { const me = view(game.myUnit); if (!me || !game.me?.alive || me.f & 3 || me.f & 32) return; const p = findPath(me.x, me.z, x, z); game.pred = p.length ? { path: p, at: performance.now() } : null; }
// 공격 클릭: 먼 대상이면 서버 답을 기다리지 않고 그쪽으로 걷기 시작, 가까우면 바로 돌아본다
function predictChase(u) { const me = view(game.myUnit); if (!me || !game.me?.alive || me.f & 3 || me.f & 32) return; faceTo(me, u.x, u.z); const reach = (game.me.st.range || 2) + (u.k === 2 ? 1.6 : 0.6); if (Math.hypot(u.x - me.x, u.z - me.z) <= reach) { game.pred = null; return; } const p = findPath(me.x, me.z, u.x, u.z); game.pred = p.length ? { path: p, at: performance.now(), chase: u.id, reach } : null; }
function faceTo(me, x, z) { me.tface = Math.atan2(x - me.x, z - me.z); game.faceUntil = performance.now() + 260; }
function ringPing(x, z, c) { const f = ringFx(x, z, 1, c, 0.35, 0); f.kind = 'shrink'; }
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// 화면 밀기는 커서가 진짜 게임 화면 위에 있을 때만 (미니맵 · 조작판 위에서는 안 밀린다)
// 미니맵 · 조작판 둘레도 막는다 (미니맵과 화면 끝 사이 틈 · 둥근 모서리에 커서가 가도 안 밀리게)
const nearHud = (x, y) => [mini, $('bar')].some((el) => { const r = el.getBoundingClientRect(), M = 16; return x > r.left - M && x < r.right + M && y > r.top - M && y < r.bottom + M; });
addEventListener('pointermove', (e) => { game.mouse.in = e.target === canvas && !nearHud(e.clientX, e.clientY); if (e.target === canvas || game.drag) { game.mouse.x = e.clientX; game.mouse.y = e.clientY; } if (game.drag) { setLock(false); const k = 0.075 * game.zoom; game.focus.x = Math.max(-SIZE, Math.min(SIZE, game.focus.x - e.movementX * k)); game.focus.z = Math.max(-SIZE, Math.min(SIZE, game.focus.z - e.movementY * k)); } });
document.documentElement.addEventListener('mouseleave', () => { game.mouse.in = false; });
// mousedown 을 쓴다: pointerdown 은 다른 버튼을 누른 채 누르면 안 들어와서 클릭이 씹힌다
canvas.addEventListener('mousedown', (e) => {
  if (performance.now() - (game.touchAt || -1e9) < 700) return;
  game.mouse.x = e.clientX; game.mouse.y = e.clientY; S.unlock?.();
  if (game.mode !== 'play') return;
  if (e.button === 1) { e.preventDefault(); game.drag = true; return; }
  if (e.button === 2) {
    if (game.aim) { game.aim = null; game.aimCancel = true; S.sfx('tick'); return; } // 조준 취소
    game.rdown = true; game.rdownT = 0.12; game.amove = false; document.body.style.cursor = ''; moveOrAttack(e.clientX, e.clientY); return;
  }
  if (e.button === 0) {
    if (e.altKey) { const g = groundAt(e.clientX, e.clientY); if (g) shell.send({ t: 'ping', x: g.x, z: g.z, c: unitUnder(e.clientX, e.clientY) ? 'danger' : 'go' }); return; }
    if (game.aim) { const s = game.aim; game.aim = null; game.aimCancel = true; castAt(s); return; } // 좌클릭으로 발사
    if (game.amove) { const u = unitUnder(e.clientX, e.clientY); if (u && !(u.k === 2 && u.invuln)) shell.send({ t: 'atk', id: u.id }); else { const g = groundAt(e.clientX, e.clientY); if (g) { shell.send({ t: 'amove', x: g.x, z: g.z }); predict(g.x, g.z); ringPing(g.x, g.z, '#ff5a7a'); } } game.amove = false; document.body.style.cursor = ''; }
  }
});
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; game.touchAt = performance.now(); game.mouse.x = e.clientX; game.mouse.y = e.clientY; S.unlock?.(); if (game.mode === 'play') moveOrAttack(e.clientX, e.clientY); });
addEventListener('mouseup', (e) => { if (e.button === 2) game.rdown = false; if (e.button === 1) game.drag = false; });
addEventListener('blur', () => { game.rdown = false; game.drag = false; keys.clear(); game.aim = null; });
canvas.addEventListener('wheel', (e) => { game.zoomT = Math.max(0.65, Math.min(1.5, game.zoomT + Math.sign(e.deltaY) * 0.08)); }, { passive: true });
function setQuick(v) { game.quick = v; store.set(QUICK_KEY, v ? '1' : '0'); $('b-quick').textContent = v ? '⚡' : '🎯'; $('b-quick').title = v ? '기술: 누르면 바로 발사 (눌러서 바꾸기)' : '기술: 누르면 범위 표시, 떼면 발사 (눌러서 바꾸기)'; }
setQuick(game.quick);
$('b-quick').onclick = () => { setQuick(!game.quick); banner(game.quick ? '⚡ 누르면 바로 발사' : '🎯 누르면 범위가 보이고, 떼면 발사', '', 1400); };
// 기술: 대상 자리(마우스) · 대상 유닛을 함께 보낸다
function refuse(s, why) { const me = view(game.myUnit); if (me) floatText(me.x, 3.6, me.z, why, '#ffb3c6'); const b = $('b-skills').querySelector(`[data-s="${s}"]`); if (b) { b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); } S.sfx('bad'); }
function castAt(s, auto) {
  if (game.mode !== 'play' || !game.me?.alive) return;
  const m = game.me;
  if (KEYS_SK.includes(s)) {
    const sk = game.def.skills[s];
    if (m.rank[s] <= 0) return refuse(s, m.pts > 0 ? '먼저 ＋ 로 배워요' : '아직 못 배웠어요');
    if ((m.cds[s] || 0) > 0.3) return refuse(s, `${m.cds[s].toFixed(1)}초 남았어요`);
    if ((view(game.myUnit)?.mp ?? 0) < sk.mana) return refuse(s, '마나가 부족해요');
    if (m.sil) return refuse(s, '침묵 중이에요');
  } else if ((m.cds[s] || 0) > 0.3) return refuse(s, `${Math.ceil(m.cds[s])}초 남았어요`);
  S.sfx('swish');
  { const v = view(game.myUnit), a = mouseGround(); if (v && !(game.def?.skills[s]?.kind === 'buff') && KEYS_SK.includes(s)) faceTo(v, a.x, a.z); }
  let g = mouseGround(), id = 0;
  const me = view(game.myUnit);
  const spec = KEYS_SK.includes(s) ? game.def.skills[s] : null;
  if (auto && me) { const foe = [...game.views.values()].filter((v) => v.k === 0 && v.team !== game.team).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]; if (foe) { g = { x: foe.x, z: foe.z }; id = foe.id; } else { g = { x: me.x + Math.sin(me.face || 0) * 10, z: me.z + Math.cos(me.face || 0) * 10 }; } }
  else { const u = unitUnder(game.mouse.x, game.mouse.y, spec?.kind === 'ally'); if (u) { id = u.id; if (spec?.kind === 'ally' || spec?.kind === 'hit') g = { x: u.x, z: u.z }; } }
  if (s === 'd' || s === 'f') shell.send({ t: 'spell', s, x: g.x, z: g.z, id });
  else shell.send({ t: 'cast', s, x: g.x, z: g.z, id });
}
game.sendLv = (s) => { shell.send({ t: 'lvl', s }); S.sfx('ok'); };
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && game.mode === 'play') { e.preventDefault(); $('board').classList.remove('hidden'); renderBoard(); return; }
  if (typing() || game.mode !== 'play') return;
  if (e.repeat) return;
  keys.add(e.code);
  const sk = { KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r' }[e.code];
  if (sk && !e.ctrlKey && !e.metaKey) e.preventDefault();
  if (sk) { if (e.altKey || e.ctrlKey || e.metaKey) { game.sendLv(sk); return; } if (game.quick) { castAt(sk); return; } game.aimCancel = false; game.aim = sk; return; }
  switch (e.code) {
    case 'KeyD': castAt('d'); break;
    case 'KeyF': castAt('f'); break;
    case 'KeyA': game.amove = true; document.body.style.cursor = 'crosshair'; break;
    case 'KeyS': shell.send({ t: 'stop' }); game.pred = null; break;
    case 'KeyB': toggleShop(); break;
    case 'Digit1': shell.send({ t: 'potion' }); break;
    case 'Digit4': { const g = mouseGround(); shell.send({ t: 'ward', x: g.x, z: g.z }); break; }
    case 'KeyY': setLock(!game.locked, true); break;
    case 'KeyM': muteBtn(); break;
    case 'Space': { e.preventDefault(); const me = view(game.myUnit); if (me) game.focus.set(me.x, 0, me.z); break; }
    case 'Escape': if (!$('shop').classList.contains('hidden')) toggleShop(false); else if (!$('help').classList.contains('hidden')) $('help').classList.add('hidden'); game.aim = null; game.amove = false; document.body.style.cursor = ''; break;
  }
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Tab') { $('board').classList.add('hidden'); return; }
  const sk = { KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r' }[e.code];
  if (sk && game.aim === sk && !game.aimCancel) { castAt(sk); game.aim = null; }
});
function setLock(v, keep) { game.locked = v; $('b-lock').textContent = v ? '🔒' : '🔓'; if (keep) store.set(CAM_KEY, v ? '1' : '0'); }
$('b-lock').onclick = () => setLock(!game.locked, true);
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound?.(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-help').onclick = () => $('help').classList.toggle('hidden'); $('help-close').onclick = () => $('help').classList.add('hidden');
addEventListener('beforeunload', (e) => { if (game.mode === 'play') { e.preventDefault(); e.returnValue = ''; } }); // 실수로 탭을 닫지 않게
$('b-quit').onclick = () => { if (isLocked()) document.exitPointerLock(); if (confirm('경기를 그만둘까요? (내 자리는 봇이 이어 가요)')) { shell.send({ t: 'leave' }); toTitle(); } };
// 미니맵: 왼쪽 클릭 = 그쪽 보기 · 오른쪽 클릭 = 이동
const miniPos = (e) => { const r = mini.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * SIZE * 2 - SIZE, z: ((e.clientY - r.top) / r.height) * SIZE * 2 - SIZE }; };
mini.addEventListener('contextmenu', (e) => e.preventDefault());
mini.addEventListener('pointerdown', (e) => { const p = miniPos(e); if (e.button === 2) { shell.send({ t: 'mv', x: p.x, z: p.z }); return; } setLock(false); game.focus.set(p.x, 0, p.z); game.miniDrag = true; });
mini.addEventListener('pointermove', (e) => { if (game.miniDrag) { const p = miniPos(e); game.focus.set(p.x, 0, p.z); } });
addEventListener('pointerup', () => { game.miniDrag = false; });

// ---------- 마우스 가두기: 경기 중에는 커서가 게임 화면 밖으로 못 나간다 ----------
//   브라우저에는 커서를 창 안에 묶는 기능이 없어서, 진짜 커서를 잠그고(Pointer Lock) 직접 그린 커서를 움직인다.
//   잠겨 있는 동안 마우스 입력은 모두 캔버스로만 오므로, 내 커서 아래 요소로 다시 보내 평소 코드가 그대로 돌게 한다
const vcur = $('vcur'), vm = { x: innerWidth / 2, y: innerHeight / 2, hov: null, down: {} };
const isLocked = () => document.pointerLockElement === canvas;
function lockMouse(x, y) { if (touch || game.mode !== 'play' || isLocked() || !canvas.requestPointerLock) return; if (x != null) { vm.x = x; vm.y = y; } try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* 잠시 뒤 다음 클릭에 다시 */ } }
const paintCur = () => { vcur.style.transform = `translate(${vm.x}px, ${vm.y}px)`; };
const fireAt = (el, type, Ctor, src, extra) => el.dispatchEvent(new Ctor(type, { bubbles: type !== 'mouseenter' && type !== 'mouseleave', cancelable: true, composed: true, view: window, clientX: vm.x, clientY: vm.y, screenX: vm.x, screenY: vm.y, button: src.button ?? 0, buttons: src.buttons ?? 0, altKey: src.altKey, ctrlKey: src.ctrlKey, shiftKey: src.shiftKey, metaKey: src.metaKey, movementX: src.movementX || 0, movementY: src.movementY || 0, pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra }));
const underCur = () => document.elementFromPoint(vm.x, vm.y) || canvas;
const hoverBox = (el) => el?.closest?.('button, .it, .ch');
function hoverTo(el, src) {
  const old = vm.hov; if (el === old) return; vm.hov = el;
  if (old?.isConnected) { fireAt(old, 'mouseout', MouseEvent, src, { relatedTarget: el }); for (let n = old; n && !n.contains(el); n = n.parentElement) fireAt(n, 'mouseleave', MouseEvent, src, { relatedTarget: el }); }
  fireAt(el, 'mouseover', MouseEvent, src, { relatedTarget: old }); for (let n = el; n && !n.contains(old); n = n.parentElement) fireAt(n, 'mouseenter', MouseEvent, src, { relatedTarget: old });
  hoverBox(old)?.classList.remove('vh'); hoverBox(el)?.classList.add('vh');
}
const REDIR = {
  mousemove(e) { vm.x = Math.max(0, Math.min(innerWidth - 1, vm.x + e.movementX)); vm.y = Math.max(0, Math.min(innerHeight - 1, vm.y + e.movementY)); paintCur(); const el = underCur(); hoverTo(el, e); fireAt(el, 'pointermove', PointerEvent, e); fireAt(el, 'mousemove', MouseEvent, e); },
  mousedown(e) { const el = underCur(); hoverTo(el, e); vm.down[e.button] = el; fireAt(el, 'pointerdown', PointerEvent, e); fireAt(el, 'mousedown', MouseEvent, e); },
  mouseup(e) { const el = underCur(), d = vm.down[e.button]; vm.down[e.button] = null; fireAt(el, 'pointerup', PointerEvent, e); fireAt(el, 'mouseup', MouseEvent, e); if (e.button === 0 && d) { const c = d.contains(el) ? d : el.contains(d) ? el : null; if (c) fireAt(c, 'click', MouseEvent, e); } if (e.button === 2) fireAt(el, 'contextmenu', MouseEvent, e); },
  wheel(e) { const el = underCur(); if (el === canvas) { fireAt(el, 'wheel', WheelEvent, e, { deltaY: e.deltaY, deltaMode: e.deltaMode }); return; } for (let n = el; n && n !== document.body; n = n.parentElement) if (n.scrollHeight > n.clientHeight && getComputedStyle(n).overflowY !== 'visible') { n.scrollTop += e.deltaMode ? e.deltaY * 30 : e.deltaY; break; } },
};
for (const t of ['pointermove', 'pointerdown', 'pointerup', 'mousemove', 'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick', 'contextmenu', 'wheel']) addEventListener(t, (e) => {
  if (!e.isTrusted || !isLocked()) return;
  e.stopImmediatePropagation(); if (t === 'contextmenu' || t === 'wheel') e.preventDefault();
  REDIR[t]?.(e);
}, { capture: true, passive: false });
// 잠기지 않았을 때 경기 화면을 누르면 잠근다 (누른 것은 그대로 동작한다)
addEventListener('mousedown', (e) => { if (!e.isTrusted || isLocked() || game.mode !== 'play') return; vm.down[e.button] = e.target; lockMouse(e.clientX, e.clientY); }, true);
function syncLockUi() {
  const on = isLocked(); vcur.classList.toggle('hidden', !on); $('mhint').classList.toggle('hidden', on || touch || game.mode !== 'play');
  if (on) { paintCur(); vm.hov = null; if (!game.lockTold) { game.lockTold = true; feed('🖱️ 마우스가 화면 안에 갇혔어요 · Esc 로 풀어요'); } return; }
  hoverBox(vm.hov)?.classList.remove('vh'); vm.hov = null; game.rdown = false; game.drag = false; game.miniDrag = false;
  if (game.mode === 'play') { game.aim = null; game.amove = false; }
}
document.addEventListener('pointerlockchange', syncLockUi); document.addEventListener('pointerlockerror', syncLockUi);
addEventListener('resize', () => { vm.x = Math.min(vm.x, innerWidth - 1); vm.y = Math.min(vm.y, innerHeight - 1); });

// ---------- 챔피언 고르기 ----------
let pv = null;
function preview(c) {
  const el = $('p-prev');
  if (!pv) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff6e8', '#9a8a9a', 1.6)); const d = new THREE.DirectionalLight('#ffffff', 1.4); d.position.set(2, 4, 5); sc.add(d);
    const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 50); cam.position.set(0, 1.5, 5.4); cam.lookAt(0, 1.05, 0);
    pv = { r, sc, cam, bear: null, on: false, t: 0 }; el.appendChild(r.domElement);
  }
  if (pv.bear) pv.sc.remove(pv.bear.root);
  const def = champById(c);
  pv.bear = new Roach({ own: true, seed: c, color: def.color, age: 25, look: { ...(shell.profile?.look || {}), hat: 0, face: 0, outfit: 0, extra: 0 }, accessories: def.acc || [] });
  pv.bear.setHeld(`${HELD[def.held] || 'sword'}:${def.color}`); pv.sc.add(pv.bear.root);
  if (!pv.on) { pv.on = true; let last = performance.now(); const loop = (now) => { if ($('pick').classList.contains('hidden')) { pv.on = false; return; } const dt = Math.min(0.05, (now - last) / 1000); last = now; const w = el.clientWidth || 280, h = el.clientHeight || 150; if (pv.w !== w) { pv.r.setSize(w, h, false); pv.cam.aspect = w / h; pv.cam.updateProjectionMatrix(); pv.w = w; } pv.t += dt; pv.bear.root.rotation.y = Math.sin(pv.t * 0.8) * 0.7; pv.bear.update(dt, 0); pv.r.render(pv.sc, pv.cam); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}
const CLS_NAME = { tank: '🛡️ 탱커', fighter: '⚔️ 전사', assassin: '🗡️ 암살자', mage: '🔮 마법사', marks: '🏹 원거리', support: '💖 서포터' };
function renderPick() {
  const myTeam = shell.members.find((m) => m.id === shell.myId)?.team || game.team;
  const mates = game.picks.filter((p) => p.team === myTeam);
  const taken = new Set(mates.filter((p) => p.id !== shell.myId && p.c).map((p) => p.c));
  $('p-team').innerHTML = `<div style="color:${TC[myTeam]}">${TEAMS[myTeam].name}</div>` + mates.map((p) => { const m = shell.members.find((q) => q.id === p.id), c = p.c && champById(p.c); return `<div class="p-slot${p.id === shell.myId ? ' me' : ''}${p.locked ? ' ok' : ''}"><span class="em">${c ? c.emoji : '❔'}</span><span>${esc(m?.name || '')}<small>${c ? esc(c.name) : '고르는 중…'}${p.role ? ` · ${ROLES[p.role].name}` : ''}</small></span></div>`; }).join('') + `<div class="p-slot" style="opacity:.6"><span class="em">🤖</span><span>빈 자리 ${Math.max(0, 5 - mates.length)}<small>젤리봇이 채워요</small></span></div>`;
  const filt = game.pFilter || 'all';
  $('p-filter').innerHTML = [['all', '전체'], ...ROLE_IDS.map((r) => [r, `${ROLES[r].icon} ${ROLES[r].name}`])].map(([k, v]) => `<button data-k="${k}" class="${filt === k ? 'on' : ''}">${v}</button>`).join('');
  $('p-filter').querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { game.pFilter = b.dataset.k; renderPick(); }; });
  $('p-grid').innerHTML = CHAMPS.filter((c) => filt === 'all' || c.roles.includes(filt)).map((c) => `<button class="ch${game.myPick === c.id ? ' on' : ''}${taken.has(c.id) ? ' taken' : ''}" data-c="${c.id}"><i>${c.emoji}</i>${esc(c.name)}<small>${c.roles.map((r) => ROLES[r].name).join(' · ')}</small></button>`).join('');
  $('p-grid').querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => choose(b.dataset.c); });
  $('p-roles').innerHTML = ROLE_IDS.map((r) => `<button data-r="${r}" class="${game.myRole === r ? 'on' : ''}">${ROLES[r].icon} ${ROLES[r].name}</button>`).join('');
  $('p-roles').querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { game.myRole = b.dataset.r; shell.send({ t: 'role', role: game.myRole }); store.set(PICK_KEY, JSON.stringify({ c: game.myPick, role: game.myRole })); renderPick(); }; });
  const c = game.myPick && champById(game.myPick);
  $('p-lock').disabled = !c || game.locked2; $('p-lock').textContent = game.locked2 ? '✅ 다른 사람 기다리는 중…' : c ? `${c.emoji} ${c.name} 확정!` : '챔피언을 골라 주세요';
  $('p-info').innerHTML = c ? `<h3>${c.emoji} ${esc(c.name)}</h3><div class="t">${CLS_NAME[c.cls]} · ${esc(c.tip)}</div><div class="s"><i>🌟</i><div><b>${esc(c.passive.name)}</b><br>${esc(c.passive.desc)}</div></div>${KEYS_SK.map((k) => { const s = c.skills[k]; return `<div class="s"><i>${s.icon}</i><div><kbd>${k.toUpperCase()}</kbd><b>${esc(s.name)}</b> <small>재사용 ${s.cd}초 · 마나 ${s.mana}</small><br>${esc(s.desc)}${skillDetail(s, 1, null)}</div></div>`; }).join('')}` : '<p>왼쪽에서 챔피언을 눌러 보세요</p>';
}
function choose(c) { game.myPick = c; game.myRole = champById(c).roles.includes(game.myRole) ? game.myRole : (game.myRole || champById(c).roles[0]); shell.send({ t: 'pick', c, role: game.myRole }); store.set(PICK_KEY, JSON.stringify({ c, role: game.myRole })); S.sfx('tick'); preview(c); renderPick(); }
$('p-lock').onclick = () => { if (!game.myPick) return; game.locked2 = true; shell.send({ t: 'lock' }); S.sfx('ok'); renderPick(); };
let pickTimer = 0;
function startPick(m) {
  game.mode = 'pick'; game.picks = shell.members.map((x) => ({ id: x.id, team: x.team, c: null, role: null })); game.locked2 = false; game.firstBlood = false;
  shell.hideScreens(); $('over').classList.add('hidden'); $('pick').classList.remove('hidden');
  const end = performance.now() + (m.pickMs || 35000); clearInterval(pickTimer);
  pickTimer = setInterval(() => { const left = Math.max(0, Math.ceil((end - performance.now()) / 1000)); $('p-time').textContent = left; if (left <= 5 && left > 0) S.sfx('tick'); if (left <= 0) clearInterval(pickTimer); }, 250);
  let saved = {}; try { saved = JSON.parse(store.get(PICK_KEY) || '{}'); } catch { /* 없음 */ }
  game.myPick = null; game.myRole = saved.role || null; game.pFilter = 'all';
  const c = champById(saved.c); if (c) choose(c.id); else { renderPick(); choose(CHAMPS[Math.floor(Math.random() * CHAMPS.length)].id); }
}
function startMatch(m) {
  clearInterval(pickTimer);
  game.roster = new Map(m.roster.map((r) => [r.id, r]));
  const mine = m.roster.find((r) => r.pid === shell.myId); game.myUnit = mine?.id || 0; game.team = mine?.team || 'blue'; game.def = mine ? champById(mine.champ) : null;
  for (const v of [...game.views.values()]) dropView(v);
  for (const s of structViews) { s.alive = true; s.o.visible = true; }
  game.mode = 'play'; game.me = null; game.sb = null; $('pick').classList.add('hidden'); $('hud').classList.remove('hidden'); W.fog.visible = true;
  const f = FOUNTAIN[game.team]; game.focus.set(f[0], 0, f[1]); setLock(store.get(CAM_KEY) !== '0'); lockMouse(); game.zoom = game.zoomT = 1; game.pred = null; game.pings = []; game.itemSig = game.statSig = null; $('recap').innerHTML = '';
  if (game.def) buildBar(game.def);
  const r = ROLES[mine?.role]; banner(`${game.def?.emoji || ''} ${game.def?.name || ''} · ${r?.icon || ''} ${r?.name || ''}`, '꼬마가 곧 나와요. 기지에서 B 로 아이템을 사고 출발!', 3500);
  S.sfx('start'); S.startMusic?.();
  if (!store.get(FIRST_KEY)) { store.set(FIRST_KEY, '1'); $('help').classList.remove('hidden'); }
}
function results(m) {
  const win = m.winner === game.team;
  game.mode = 'over'; S.stopMusic?.(); $('hud').classList.add('hidden'); $('shop').classList.add('hidden'); $('board').classList.add('hidden'); W.fog.visible = false;
  $('ov-title').textContent = win ? '🏆 승리!' : '😭 패배…';
  const s = m.score; game.sb = s;
  $('ov-sub').textContent = `${fmt(s.time)} · ${TEAMS.blue.name} ${s.kills.blue} : ${s.kills.red} ${TEAMS.red.name}`;
  $('ov-list').innerHTML = ['blue', 'red'].map((t) => `<div class="bd-t ${t}">${TEAMS[t].name}${m.winner === t ? ' 🏆' : ''}</div>${s.list.filter((x) => x.team === t).map(row).join('')}`).join('');
  $('again-btn').textContent = shell.room?.name?.includes('연습') ? '🔁 한 판 더' : '👥 방으로 돌아가기';
  if (win) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
}
function practice() { S.unlock?.(); shell.sendAfterHello({ t: 'practice', opts: { level: game.level } }); }
function toTitle() {
  game.mode = 'title'; clearInterval(pickTimer); S.stopMusic?.();
  for (const id of ['hud', 'pick', 'over', 'shop', 'board', 'help']) $(id).classList.add('hidden');
  for (const v of [...game.views.values()]) dropView(v);
  for (const s of structViews) { s.alive = true; s.o.visible = true; }
  W.fog.visible = false; ctx.clearRect(0, 0, innerWidth, innerHeight);
  shell.multi = false; shell.playing = false; shell.show('title');
}
const LEVEL_NAMES = { easy: '🌱 쉬움', normal: '🙂 보통', hard: '🔥 어려움' };
function levelSeg(el, cur, on, disabled) { el.innerHTML = `<div class="opt-row" style="text-align:center"><small>젤리봇 실력</small><br><div class="seg" id="lv-seg">${Object.entries(LEVEL_NAMES).map(([k, v]) => `<button data-l="${k}" class="${cur === k ? 'on' : ''}" ${disabled ? 'disabled' : ''}>${v}</button>`).join('')}</div></div>`; el.querySelectorAll('[data-l]').forEach((b) => { b.onclick = () => on(b.dataset.l); }); }
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => muteBtn() },
  key: 'jellyarena', title: '⚔️ 젤리 아레나', subtitle: '탑 · 미드 · 정글 · 바텀 · 서폿!<br>챔피언 20명, 5 대 5 로 상대의 젤리 심장을 부숴요', wsPath: '/arena-ws', max: 10,
  multiLabel: '👥 같이 하기', roomIcon: '⚔️', startLabel: '⚔️ 챔피언 고르러 가기',
  keysHelp: '우클릭 이동 · 공격 · Q W E R 기술 · D F 주문 · A 공격 이동 · B 상점 · Tab 점수판 · 빈 자리는 젤리봇이 채워요',
  buttons: [{ id: 'solo-btn', label: '🤖 젤리봇과 5 대 5 <small>혼자 연습 · 15~25분</small>', onClick: () => practice() }],
  screens: ['over'],
  describe: (o = {}) => `🤖 ${LEVEL_NAMES[o.level] || LEVEL_NAMES.normal}`,
  options: {
    title: (el) => { const draw = () => levelSeg(el, game.level, (l) => { game.level = l; store.set(LV_KEY, l); draw(); }); draw(); },
    room: (el, o, host) => levelSeg(el, o.level || 'normal', (l) => shell.send({ t: 'opts', opts: { level: l } }), !host),
  },
  teamChat: () => true,
  onStart: (m) => startPick(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
  onEscape: () => { if (game.mode === 'play') return true; return false; },
});
shell.pickOpts = () => ({ level: game.level, team: true });
shell.on('picks', (m) => { game.picks = m.list; const me = m.list.find((x) => x.id === shell.myId); if (me?.role) game.myRole = me.role; renderPick(); });
shell.on('go', (m) => startMatch(m));
shell.on('s', onSnapshot);
shell.on('e', (m) => { for (const e of m.e) onEvent(e); });
shell.on('me', onMe);
shell.on('sb', onScore);
$('again-btn').onclick = () => { $('over').classList.add('hidden'); if (shell.room?.name?.includes('연습')) { shell.send({ t: 'leave' }); game.mode = 'title'; for (const v of [...game.views.values()]) dropView(v); practice(); } else { game.mode = 'room'; for (const v of [...game.views.values()]) dropView(v); for (const s of structViews) { s.alive = true; s.o.visible = true; } shell.backToRoom(); } };
$('ov-home').onclick = () => { shell.send({ t: 'leave' }); toTitle(); };

// ---------- 조준 표시 ----------
const aimG = new THREE.Group(); aimG.visible = false; scene.add(aimG);
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); aimRing.rotation.x = -Math.PI / 2; aimRing.position.y = 0.15;
const aimDisc = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); aimDisc.rotation.x = -Math.PI / 2; aimDisc.position.y = 0.16;
const aimLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })); aimLine.rotation.x = -Math.PI / 2; aimLine.position.y = 0.17;
aimG.add(aimRing, aimDisc, aimLine);
const hoverRing = ringOf('#ff5a7a', 0.95); hoverRing.visible = false; scene.add(hoverRing);
// 공격 사거리 · 포탑 사거리 · 지금 때리는 대상
const thinRing = (c, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.14; m.visible = false; scene.add(m); return m; };
const atkRing = thinRing('#7fe08a', 0.75), towerRing = thinRing('#ff5a7a', 0.45), tgtRing = ringOf('#ff3b5c', 1); tgtRing.visible = false; scene.add(tgtRing);
function updateRings(me, now) {
  atkRing.visible = !!me && (game.amove || keys.has('KeyC')); if (atkRing.visible) { atkRing.position.set(me.x, 0.14, me.z); atkRing.scale.setScalar(game.me?.st.range || 3); }
  let near = null, bd = TOWER_RANGE + 7; if (me) for (const s of structViews) if (s.alive && s.k === 'tower' && s.team !== game.team) { const d = Math.hypot(s.at[0] - me.x, s.at[1] - me.z); if (d < bd) { bd = d; near = s; } }
  towerRing.visible = !!near; if (near) { towerRing.position.set(near.at[0], 0.14, near.at[1]); towerRing.scale.setScalar(TOWER_RANGE); towerRing.material.opacity = (game.towerOnMe > now ? 0.95 : 0.4) * Math.min(1, (TOWER_RANGE + 7 - bd) / 4); }
  const t = view(game.me?.tg); tgtRing.visible = !!t && t.k !== 2; if (tgtRing.visible) { tgtRing.position.set(t.x, 0.11, t.z); tgtRing.scale.setScalar((t.k === 0 ? 1.45 : t.k === 3 ? (t.o.userData.s || 1) * 1.05 : 0.95)); tgtRing.rotation.z = now / 300; }
}
function updateAim(me) {
  const s = game.aim || game.previewAim; if (!s || !me || !game.me?.alive || !game.def) { aimG.visible = false; return; }
  const sk = game.def.skills[s], g = mouseGround(), dx = g.x - me.x, dz = g.z - me.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L;
  aimG.visible = true; aimG.position.set(me.x, 0, me.z);
  const col = sk.color || '#7fd8ff'; aimDisc.material.color.set(col); aimLine.material.color.set(col);
  const R = Math.min(sk.range || sk.radius || 8, 60); aimRing.visible = sk.range < 100 && sk.kind !== 'nova' && sk.kind !== 'buff' && !sk.follow; aimRing.scale.setScalar(R);
  aimLine.visible = sk.kind === 'shot' || sk.kind === 'dash'; aimDisc.visible = false;
  if (aimLine.visible) { aimLine.rotation.set(-Math.PI / 2, 0, Math.atan2(-fx, -fz)); aimLine.scale.set((sk.width || 1.2) * 1.6, sk.kind === 'dash' && !sk.back ? Math.min(sk.range, Math.max(2.5, L)) : Math.min(sk.range, 60), 1); if (sk.back) aimLine.rotation.z += Math.PI; }
  if (sk.kind === 'aoe' || (sk.kind === 'zone' && !sk.follow)) { const d = Math.min(R, L); aimDisc.visible = true; aimDisc.position.set(fx * d, 0.16, fz * d); aimDisc.scale.setScalar(sk.radius); }
  if (sk.kind === 'nova' || (sk.kind === 'zone' && sk.follow)) { aimDisc.visible = true; aimDisc.position.set(0, 0.16, 0); aimDisc.scale.setScalar(sk.radius); }
  if (sk.kind === 'blink') { const d = Math.min(R, L); aimDisc.visible = true; aimDisc.position.set(fx * d, 0.16, fz * d); aimDisc.scale.setScalar(0.9); }
  if (sk.kind === 'cone') { aimDisc.visible = true; aimDisc.position.set(fx * sk.range * 0.55, 0.16, fz * sk.range * 0.55); aimDisc.scale.setScalar(sk.range * 0.55); }
  if (sk.kind === 'ally' && sk.radius) { aimRing.visible = true; aimRing.scale.setScalar(sk.radius); }
  if (sk.kind === 'hit') { const u = unitUnder(game.mouse.x, game.mouse.y); aimRing.material.color.set(u && Math.hypot(u.x - me.x, u.z - me.z) <= R + 1 ? '#7fe08a' : '#ffffff'); } else aimRing.material.color.set('#ffffff');
}
// ---------- 안개 · 미니맵 ----------
let fogT = 0, miniT = 0;
function drawFog() {
  const c = W.fogC, x = c.getContext('2d'), k = c.width / (SIZE * 2);
  x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height); x.fillStyle = 'rgba(8,12,28,.62)'; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-out';
  const hole = (px, pz, r) => { const X = (px + SIZE) * k, Z = (pz + SIZE) * k, R = r * k, g = x.createRadialGradient(X, Z, R * 0.7, X, Z, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(X, Z, R, 0, 7); x.fill(); };
  for (const v of game.views.values()) if (v.team === game.team) hole(v.x, v.z, v.k === 0 ? 16 : v.k === 1 ? 10 : v.ward ? 12 : 12);
  for (const s of structViews) if (s.team === game.team && s.alive) hole(s.at[0], s.at[1], s.k === 'heart' ? 22 : s.k === 'gate' ? 12 : 17);
  W.fogT.needsUpdate = true;
}
function drawMini() {
  const x = mctx, S2 = mini.width, k = S2 / (SIZE * 2), P = (a) => (a + SIZE) * k;
  x.drawImage(miniBg, 0, 0, S2, S2); x.drawImage(W.fogC, 0, 0, S2, S2);
  for (const s of structViews) if (s.alive) { x.fillStyle = TC[s.team]; x.strokeStyle = '#0008'; x.lineWidth = 3; const r = s.k === 'heart' ? 13 : s.k === 'gate' ? 7 : 8; x.beginPath(); if (s.k === 'tower') { x.moveTo(P(s.at[0]), P(s.at[1]) - r); x.lineTo(P(s.at[0]) + r, P(s.at[1]) + r * 0.7); x.lineTo(P(s.at[0]) - r, P(s.at[1]) + r * 0.7); x.closePath(); } else x.arc(P(s.at[0]), P(s.at[1]), r, 0, 7); x.fill(); x.stroke(); }
  for (const v of game.views.values()) {
    if (v.k === 1) { x.fillStyle = TC[v.team]; x.fillRect(P(v.x) - 3, P(v.z) - 3, 6, 6); }
    else if (v.k === 3) { x.fillStyle = MONS[v.mid]?.epic ? '#ffd23f' : '#f2e6c8'; x.beginPath(); x.arc(P(v.x), P(v.z), MONS[v.mid]?.epic ? 9 : 5, 0, 7); x.fill(); }
    else if (v.ward) { x.fillStyle = '#ffffff'; x.fillRect(P(v.x) - 3, P(v.z) - 3, 6, 6); }
  }
  x.font = '22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (game.sb?.camps) for (const c of game.sb.camps) { x.globalAlpha = c.up ? 1 : 0.45; x.fillText(MONS[c.id].emoji, P(c.x), P(c.z)); } x.globalAlpha = 1;
  for (const v of game.views.values()) if (v.k === 0) { x.fillStyle = v.id === game.myUnit ? '#ffe066' : TC[v.team]; x.beginPath(); x.arc(P(v.x), P(v.z), 15, 0, 7); x.fill(); x.fillStyle = '#000'; x.fillText(v.def.emoji, P(v.x), P(v.z) + 1); }
  const nowP = performance.now(); game.pings = game.pings.filter((p) => nowP - p.at < 3000);
  for (const p of game.pings) { const q = (nowP - p.at) / 3000; x.strokeStyle = p.c; x.lineWidth = 5; x.globalAlpha = 1 - q; x.beginPath(); x.arc(P(p.x), P(p.z), 12 + ((nowP - p.at) % 900) / 18, 0, 7); x.stroke(); x.globalAlpha = 1; }
  // 지금 보는 곳
  const a = groundAt(0, 0), b = groundAt(innerWidth, innerHeight), a2 = groundAt(innerWidth, 0), b2 = groundAt(0, innerHeight);
  if (a && b && a2 && b2) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(P(a.x), P(a.z)); x.lineTo(P(a2.x), P(a2.z)); x.lineTo(P(b.x), P(b.z)); x.lineTo(P(b2.x), P(b2.z)); x.closePath(); x.stroke(); }
}
// ---------- 체력 막대 · 글자 ----------
function drawOverlay(dt) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  if (game.mode !== 'play') return;
  const zk = 1 / game.zoom;
  for (const v of game.views.values()) {
    if (v.hp == null || v.ward) continue;
    const pos = v.o.position;
    if (v.k === 0) {
      const s = toScreen(pos.x, 3.05, pos.z), w = 68 * zk, h = 8, x0 = s.x - w / 2, y0 = s.y, tot = Math.max(v.max, v.hp + (v.sh || 0)), me = v.id === game.myUnit, ally = v.team === game.team;
      ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 8);
      ctx.fillStyle = me ? '#7fe08a' : ally ? '#4cc3ff' : '#ff5a7a'; ctx.fillRect(x0, y0, w * (v.hp / tot), h);
      if (v.sh) { ctx.fillStyle = '#e8eef5'; ctx.fillRect(x0 + w * (v.hp / tot), y0, w * (v.sh / tot), h); }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 300; i < tot; i += 300) ctx.fillRect(x0 + w * (i / tot), y0, 1, h);
      ctx.fillStyle = '#5ea6ff'; ctx.fillRect(x0, y0 + h + 1, w * ((v.mp || 0) / (v.mpMax || 1)), 3);
      if (me && game.me?.atk > 0) { ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 2, y0 + h + 4, w + 4, 4); ctx.fillStyle = '#ffd76a'; ctx.fillRect(x0, y0 + h + 5, w * (1 - game.me.atk), 2); } // 다음 평타까지
      ctx.fillStyle = '#1b1e2c'; ctx.beginPath(); ctx.arc(x0 - 9, y0 + 5, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe9a8'; ctx.font = "12px Jua, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v.lv, x0 - 9, y0 + 5.5);
      ctx.font = "13px Jua, sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = me ? '#ffe9a8' : '#fff'; ctx.strokeText(v.name, s.x, y0 - 10); ctx.fillText(v.name, s.x, y0 - 10);
      if (v.f & 1) { ctx.font = '16px sans-serif'; ctx.fillText('💫', s.x, y0 - 25); } else if (v.f & 2) { ctx.font = '16px sans-serif'; ctx.fillText('🌿', s.x, y0 - 25); } else if (v.f & 4) { ctx.font = '13px sans-serif'; ctx.fillText('🐌', x0 + w + 12, y0 + 5); }
    } else if (v.k === 2) {
      const dead = v.struct && !v.struct.alive; if (dead) continue;
      const top = (v.o.userData.top || 4) + 1.5, s = toScreen(pos.x, top, pos.z), w = (v.structKind === 'heart' ? 110 : 76) * zk, h = 7, x0 = s.x - w / 2;
      ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 2, s.y - 2, w + 4, h + 4); ctx.fillStyle = v.invuln ? '#9aa3b5' : TC[v.team]; ctx.fillRect(x0, s.y, w * (v.hp / v.max), h);
      if (v.invuln) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x0 + w + 11, s.y + 3); }
    } else if (v.hp < v.max || v === game.hover) {
      const epic = v.k === 3 && MONS[v.mid]?.epic, s = toScreen(pos.x, (v.o.userData.s || 1) * 1.9 + 0.5, pos.z), w = (epic ? 96 : v.big ? 46 : 30) * zk, x0 = s.x - w / 2, h = epic ? 7 : 4;
      ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 1, s.y - 1, w + 2, h + 2); ctx.fillStyle = v.k === 3 ? '#ffb347' : v.team === game.team ? '#7fd8ff' : '#ff7a95'; ctx.fillRect(x0, s.y, w * (v.hp / v.max), h);
      if (epic) { ctx.font = "13px Jua, sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#fff'; ctx.strokeText(MONS[v.mid].name, s.x, s.y - 9); ctx.fillText(MONS[v.mid].name, s.x, s.y - 9); }
      // 막타 표시: 내 공격 한 대로 잡힐 꼬마
      if (v.k === 1 && v.team !== game.team && game.me && v.hp < game.me.st.ad * (100 / (100 + ({ melee: 10, caster: 0, siege: 30, super: 60 }[v.type] || 0)))) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 2, s.y - 2, w + 4, h + 4); }
    }
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t -= dt; if (f.t <= 0) { floats.splice(i, 1); continue; }
    const k = 1 - f.t / f.life, s = toScreen(f.x, f.y + k * 1.4, f.z);
    ctx.globalAlpha = Math.min(1, f.t * 2.5); ctx.font = `${f.big ? 22 : 15}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = f.col; ctx.strokeText(f.text, s.x, s.y); ctx.fillText(f.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
}
// ---------- 매 프레임 ----------
let last = performance.now(), titleA = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const k = Math.min(1, dt * 13);
  // 시계는 초 단위로 돈다
  if (game.mode === 'play') $('s-time').textContent = fmt(game.T);
  for (const v of game.views.values()) {
    if (v.struct) { v.x = v.tx; v.z = v.tz; continue; }
    const dx = v.tx - v.x, dz = v.tz - v.z, moved = Math.hypot(dx, dz);
    let predicted = false;
    if (v.id === game.myUnit) {
      const P = game.pred;
      if (P && (moved > 4 || v.f & 3 || v.f & 32 || (now - P.at > 600 && !(v.f & 128)) || (P.chase && now - P.at > 450))) game.pred = null; // 서버와 많이 어긋남 · 기절 · 돌진 · 서버가 안 움직임 · 쫓기는 잠깐만
      else if (P?.chase && (() => { const t = view(P.chase); return !t || Math.hypot(t.x - v.x, t.z - v.z) <= P.reach; })()) game.pred = null;
      else if (P?.path.length) {
        predicted = true; let st = (game.me?.st.ms || 68) / 10 * dt;
        while (st > 0 && P.path.length) { const [px, pz] = P.path[0], ax = px - v.x, az = pz - v.z, L = Math.hypot(ax, az); if (L <= st) { v.x = px; v.z = pz; st -= L; P.path.shift(); continue; } v.x += (ax / L) * st; v.z += (az / L) * st; v.tface = Math.atan2(ax, az); st = 0; }
        if (!P.path.length) game.predEnd = now;
      }
    }
    if (!predicted && !(v.id === game.myUnit && now - (game.predEnd || -1e9) < 260 && moved < 2.5)) {
      if (moved > 14) { v.x = v.tx; v.z = v.tz; }
      else { const q = Math.min(1, (now - (v.iT ?? now)) / ((game.snapD || 100) * 1.08)), p = Math.min(q, v.iP || 0), a = p >= 1 ? 1 : (q - p) / (1 - p); v.x += dx * a; v.z += dz * a; v.iP = q; }
    } else v.iP = 0;
    v.faceHold = Math.max(0, (v.faceHold || 0) - dt);
    let d = (v.tface ?? v.face) - v.face; d = Math.atan2(Math.sin(d), Math.cos(d)); v.face += d * Math.min(1, dt * (predicted ? 22 : 12));
    v.hurtT = Math.max(0, v.hurtT - dt); v.lunge = Math.max(0, (v.lunge || 0) - dt);
    v.predicted = predicted;
    if (v.k === 0) {
      const air = v.f & 16 ? 1.2 : 0, moving = v.f & 128 || v.predicted;
      v.yy = (v.yy || 0) + (air - (v.yy || 0)) * Math.min(1, dt * 8);
      v.o.position.set(v.x, v.yy, v.z); v.o.rotation.y = v.face; v.o.scale.setScalar(1.45 * (1 + v.hurtT * 0.5)); v.ring.position.set(v.x, 0.08, v.z); v.bear.update(dt, moving ? 7 : 0, { noCrawl: true });
      v.o.visible = !(v.f & 8 && v.team !== game.team);
      if (v.dashT > 0) { v.dashT -= dt; spark(v.x, 1, v.z, v.dashCol, 1.5, 0.25); }
    } else {
      const U = v.o.userData, lg = v.lunge > 0 ? Math.sin((v.lunge / 0.14) * Math.PI) * 0.55 : 0; v.o.position.set(v.x + Math.sin(v.face) * lg, U.flyY ? U.flyY + Math.sin(now / 320 + v.id) * 0.18 : 0, v.z + Math.cos(v.face) * lg); v.o.rotation.y = v.face; v.o.scale.setScalar(1 + v.hurtT * (v.mid && MONS[v.mid]?.epic ? 0.25 : 1.2));
      if (U.body && U.by != null) { const b = Math.sin(now / 130 + v.id) * 0.04; U.body.position.y = U.by * (1 + b * 0.5); U.body.scale.y = U.bsy * (1 + b); } else if (U.body) { const s = U.s || 1, b = Math.sin(now / 130 + v.id) * 0.06; U.body.position.y = 0.74 * s * (1 + b * 0.5); U.body.scale.y = 0.78 * s * (1 + b); }
      if (U.wings) for (const w of U.wings) w.rotation.z = (w.userData.rest + Math.sin(now / (v.mid === 'moth' ? 150 : 34)) * 0.55) * w.userData.q;
      if (U.glow) U.glow.material.color.setHSL(0.09, 1, 0.6 + Math.sin(now / 240) * 0.12);
    }
  }
  for (const s of structViews) { const g = s.o.userData.gem; if (!g) continue; g.rotation.y = now / 700; g.position.y = s.o.userData.top + Math.sin(now / 500 + s.at[0]) * 0.18; }
  // 투사체
  for (const [id, s] of shots) { const st = s.e.v * dt; s.x += s.e.fx * st; s.z += s.e.fz * st; s.left -= st; s.m.position.set(s.x, 1.2, s.z); if ((s.tr -= dt) <= 0) { s.tr = 0.035; spark(s.x, 1.2, s.z, s.e.col, s.e.w * 0.9, 0.22); } if (s.left <= 0) { scene.remove(s.m); shots.delete(id); } }
  // 효과
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    if (f.delay > 0) { f.delay -= dt; f.o.visible = false; continue; }
    f.o.visible = true; f.t -= dt;
    const q = Math.max(0, f.t / f.life);
    if (f.kind === 'spark') { f.o.material.opacity = q; f.o.scale.setScalar(f.s * (0.5 + q * 0.7)); if (f.vx) { f.o.position.x += f.vx * dt; f.o.position.z += f.vz * dt; f.o.position.y += f.vy * dt; f.vy -= 10 * dt; } }
    else if (f.kind === 'grow') { const r = f.r * (1 - q * q); f.o.scale.set(r, 1, r); f.d.material.opacity = 0.4 * q; f.e.material.opacity = q; }
    else if (f.kind === 'charge') { f.d.material.opacity = 0.12 + (1 - q) * 0.35; f.e.material.opacity = 0.9; }
    else if (f.kind === 'zone') { if (f.follow) { const v = view(f.follow); if (v) f.o.position.set(v.x, 0.12, v.z); } f.d.material.opacity = 0.2 + Math.sin(now / 90) * 0.06; f.e.material.opacity = Math.min(1, q * 4); }
    else if (f.kind === 'shrink') { const r = 0.3 + q * 1.1; f.o.scale.set(r, 1, r); f.e.material.opacity = q; f.d.material.opacity = 0; }
    else if (f.kind === 'slash') { const k2 = 1 - q; f.m.material.opacity = q; const s2 = f.s * (0.55 + k2 * 0.7); f.o.scale.set(s2, 1, s2); }
    else if (f.kind === 'orb') { if ((f.tr -= dt) <= 0) { f.tr = 0.03; spark(f.o.position.x, f.o.position.y, f.o.position.z, f.col, f.size * 0.55, 0.16); } const to = f.to, tx = to.o?.position.x ?? to.x, tz = to.o?.position.z ?? to.z, dx = tx - f.o.position.x, dz = tz - f.o.position.z, L = Math.hypot(dx, dz), st = f.speed * dt; if (L <= st + 0.3) { f.t = 0; spark(tx, 1.1, tz, f.col, f.size * 1.5, 0.18); } else { f.o.position.x += (dx / L) * st; f.o.position.z += (dz / L) * st; f.o.position.y += (1.1 - f.o.position.y) * Math.min(1, dt * 7); } }
    else { f.d.material.opacity = (f.fill || 0) * q; f.e.material.opacity = q; }
    if (f.t <= 0) { scene.remove(f.o); fx.splice(i, 1); }
  }
  // 카메라
  const me = view(game.myUnit);
  if (game.mode === 'play') {
    if (game.locked && me) { game.focus.x += (me.x - game.focus.x) * Math.min(1, dt * 12); game.focus.z += (me.z - game.focus.z) * Math.min(1, dt * 12); }
    else if (!game.locked) {
      const m = game.mouse, sp = 42 * dt, E = 14; let dx = 0, dz = 0;
      if (m.in) { if (m.x < E) dx = -1; if (m.x > innerWidth - E) dx = 1; if (m.y < E) dz = -1; if (m.y > innerHeight - E) dz = 1; }
      if (keys.has('ArrowLeft')) dx = -1; if (keys.has('ArrowRight')) dx = 1; if (keys.has('ArrowUp')) dz = -1; if (keys.has('ArrowDown')) dz = 1;
      game.focus.x = Math.max(-SIZE, Math.min(SIZE, game.focus.x + dx * sp)); game.focus.z = Math.max(-SIZE, Math.min(SIZE, game.focus.z + dz * sp));
    }
    if (keys.has('Space') && me) game.focus.set(me.x, 0, me.z);
    game.zoom += (game.zoomT - game.zoom) * Math.min(1, dt * 10);
    const h = 38 * game.zoom, b = 24 * game.zoom;
    game.shake = Math.max(0, game.shake - dt * 2); const sk2 = game.shake * game.shake * 0.9, sx = (Math.random() - 0.5) * sk2, sz = (Math.random() - 0.5) * sk2; // 시각 효과용 난수
    camera.position.set(game.focus.x + sx, h, game.focus.z + b + sz); camera.lookAt(game.focus.x + sx, 0, game.focus.z + sz);
    updateAim(me); updateRings(me, now);
    game.hover = game.overCanvas !== false ? unitUnder(game.mouse.x, game.mouse.y) : null;
    hoverRing.visible = !!game.hover && game.hover.k !== 2;
    if (hoverRing.visible) { hoverRing.position.set(game.hover.x, 0.1, game.hover.z); hoverRing.scale.setScalar((game.hover.k === 0 ? 1.5 : game.hover.k === 3 ? (game.hover.o.userData.s || 1) * 1.05 : 0.95) * (1 + Math.sin(now / 120) * 0.05)); }
    canvas.style.cursor = game.amove ? 'crosshair' : game.hover ? 'pointer' : 'default';
    if (isLocked()) { const cls = game.amove || game.aim ? 'aim' : game.hover ? 'atk' : ''; if (vcur.dataset.c !== cls) { vcur.dataset.c = cls; } }
    else if ($('mhint').classList.contains('hidden') && !touch && performance.now() - (game.hintT || 0) > 500) { game.hintT = performance.now(); syncLockUi(); }
    if ((fogT -= dt) <= 0) { fogT = 0.2; drawFog(); }
    if ((miniT -= dt) <= 0) { miniT = 0.1; drawMini(); }
    // 꾹 누르면 계속 이동
    if (game.rdown && (game.rdownT = (game.rdownT || 0) - dt) <= 0) { game.rdownT = 0.14; if (!game.hover) moveOrAttack(game.mouse.x, game.mouse.y, false); }
  } else {
    // 처음 화면: 맵 위를 천천히
    titleA += dt * 0.06; const r = 40;
    camera.position.set(Math.cos(titleA) * r, 34, Math.sin(titleA) * r + 34); camera.lookAt(Math.cos(titleA) * r * 0.6, 0, Math.sin(titleA) * r * 0.6);
  }
  if (game.mode !== 'play' && isLocked()) document.exitPointerLock();
  if (game.mode !== 'play' && !$('mhint').classList.contains('hidden')) $('mhint').classList.add('hidden');
  drawOverlay(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
shell.boot();
