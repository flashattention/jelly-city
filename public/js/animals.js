// 야생동물 모습과 움직임 (브라우저)
import * as THREE from 'three';
import { ANIMALS, ANIMAL_KINDS, RIDE } from './fauna.js';
import { toon, G } from './utils.js';
import { WATER_Y } from './terrain.js';

const S = (parent, color, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(G.sphereLow(), toon(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
const B = (parent, color, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(G.box(), toon(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m; };
const C = (parent, color, x, y, z, r, h, rx = 0, rz = 0) => { const m = new THREE.Mesh(G.cylLow(), toon(color)); m.position.set(x, y, z); m.scale.set(r, h, r); m.rotation.set(rx, 0, rz); m.castShadow = true; parent.add(m); return m; };
const eyes = (head, z, y, gap, s = 0.08) => { for (const sx of [-1, 1]) { S(head, '#ffffff', sx * gap, y, z, s, s * 1.1, s * 0.6); S(head, '#1d1410', sx * gap, y - 0.01, z + s * 0.4, s * 0.55, s * 0.65, s * 0.4); } };

// 네발 동물 공통 틀
function quad(o) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const { len = 1.6, wid = 0.8, hgt = 0.8, leg = 0.7, color, belly, headColor } = o;
  S(body, color, 0, leg + hgt / 2, 0, wid / 2, hgt / 2, len / 2);
  if (belly) S(body, belly, 0, leg + hgt * 0.3, 0.05, wid * 0.42, hgt * 0.32, len * 0.42);
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const piv = new THREE.Group(); piv.position.set(sx * wid * 0.3, leg + 0.05, sz * len * 0.32); body.add(piv);
    C(piv, o.legColor || color, 0, -leg / 2, 0, o.legR || 0.12, leg);
    if (o.hoof) S(piv, o.hoof, 0, -leg, 0, (o.legR || 0.12) * 1.2, 0.07, (o.legR || 0.12) * 1.3);
    legs.push(piv);
  }
  const head = new THREE.Group(); head.position.set(0, leg + hgt * (o.headUp ?? 0.85), len / 2 + (o.neck || 0.1)); body.add(head);
  S(head, headColor || color, 0, 0, 0, o.headR || 0.35, (o.headR || 0.35) * 0.9, (o.headR || 0.35) * 1.05);
  if (o.snout) S(head, o.snout, 0, -0.08, (o.headR || 0.35) * 0.9, (o.headR || 0.35) * 0.55, (o.headR || 0.35) * 0.42, (o.headR || 0.35) * 0.55);
  eyes(head, (o.headR || 0.35) * 0.8, 0.08, (o.headR || 0.35) * 0.45, (o.headR || 0.35) * 0.22);
  let tail = null;
  if (o.tail) { tail = new THREE.Group(); tail.position.set(0, leg + hgt * 0.7, -len / 2); body.add(tail); C(tail, o.tailColor || color, 0, 0, -o.tail / 2, 0.06, o.tail, Math.PI / 2 - 0.5); }
  return { g, body, legs, head, tail };
}

// 드래곤: 긴 목, 뿔, 등 가시, 큰 박쥐 날개, 마디진 꼬리. 입에서 불을 뿜는다
const DRAGON_COL = [['#c62828', '#ffcc80', '#4e342e', '#ef9a9a'], ['#2e7d32', '#dce775', '#1b5e20', '#a5d6a7'], ['#37474f', '#b0bec5', '#212121', '#78909c'], ['#f9a825', '#fff3e0', '#e65100', '#ffe082'], ['#6a1b9a', '#e1bee7', '#311b92', '#ce93d8']];
function wingGeo(sx) {
  const p = [[0, 0, 0.35], [sx * 2.7, 0, 0.25], [sx * 3.2, 0, -0.7], [sx * 2.3, 0, -1.4], [sx * 1.3, 0, -1.9], [sx * 0.2, 0, -1.2]];
  const pos = [];
  for (let i = 1; i < p.length - 1; i++) pos.push(...p[0], ...p[i], ...p[i + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function dragonMesh(variant) {
  const [col, belly, dark, mem] = DRAGON_COL[variant % DRAGON_COL.length];
  const m = quad({ len: 3.2, wid: 1.3, hgt: 1.15, leg: 0.95, legR: 0.24, color: col, belly, headR: 0.5, headUp: 1.75, neck: 0.85, hoof: dark });
  C(m.body, col, 0, 2.35, 1.95, 0.32, 1.3, 0.75);
  S(m.head, col, 0, -0.06, 0.55, 0.3, 0.24, 0.48);
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(G.cone(), toon(dark)); h.scale.set(0.09, 0.55, 0.09); h.position.set(sx * 0.22, 0.4, -0.3); h.rotation.x = -0.7; m.head.add(h); S(m.head, '#ff6d00', sx * 0.1, 0.0, 1.0, 0.04, 0.04, 0.03); }
  m.jaw = B(m.head, belly, 0, -0.28, 0.5, 0.36, 0.09, 0.62);
  m.mouth = new THREE.Object3D(); m.mouth.position.set(0, -0.12, 1.05); m.head.add(m.mouth);
  for (let i = 0; i < 7; i++) { const sp = new THREE.Mesh(G.cone(), toon(dark)); sp.scale.set(0.1, 0.32, 0.12); sp.position.set(0, 2.15, 1.1 - i * 0.38); m.body.add(sp); }
  // 꼬리: 마디마다 흔들림
  m.tailSegs = [];
  let parent = m.body, z = -1.5, y = 1.45;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); seg.position.set(0, i ? 0 : y, i ? -0.55 : z); parent.add(seg);
    S(seg, col, 0, 0, -0.3, 0.3 - i * 0.04, 0.26 - i * 0.035, 0.38);
    if (i === 5) { const tip = new THREE.Mesh(G.cone(), toon(dark)); tip.scale.set(0.3, 0.45, 0.06); tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0, -0.75); seg.add(tip); }
    m.tailSegs.push(seg); parent = seg;
  }
  // 날개
  m.wings = [];
  const memMat = new THREE.MeshToonMaterial({ color: mem, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.5, 2.0, 0.5); m.body.add(piv);
    C(piv, dark, sx * 1.4, 0, 0.3, 0.07, 2.8, 0, (sx * Math.PI) / 2);
    C(piv, dark, sx * 2.6, 0, -0.5, 0.05, 1.6, Math.PI / 2 - 0.4, 0);
    const w = new THREE.Mesh(wingGeo(sx), memMat); w.castShadow = true; piv.add(w);
    piv.userData.sx = sx; m.wings.push(piv);
  }
  return m;
}

export function makeAnimalMesh(kind, variant = 0) {
  let m;
  switch (kind) {
    case 'dragon': case 'baby_dragon': m = dragonMesh(kind === 'baby_dragon' ? variant + 4 : variant); break;
    case 'bear': m = quad({ len: 1.9, wid: 1.2, hgt: 1.1, leg: 0.6, legR: 0.22, color: '#6d4c41', snout: '#a1887f', headR: 0.5, headUp: 0.95 });
      for (const sx of [-1, 1]) S(m.head, '#6d4c41', sx * 0.32, 0.38, 0, 0.14, 0.14, 0.08); break;
    case 'deer': m = quad({ len: 1.5, wid: 0.6, hgt: 0.7, leg: 1.0, legR: 0.07, color: '#b07945', belly: '#f5deb3', snout: '#3e2723', headR: 0.27, headUp: 1.6, neck: 0.05, tail: 0.25, tailColor: '#fff', hoof: '#3e2723' });
      C(m.body, '#b07945', 0, 1.55, 0.7, 0.13, 0.7, -0.6);
      for (const sx of [-1, 1]) { const a = C(m.head, '#d7ccc8', sx * 0.15, 0.4, -0.05, 0.035, 0.5, 0, sx * -0.4); C(a, '#d7ccc8', 0, 0.3, 0, 0.6, 0.6, 0, sx * 1.4); S(m.head, '#b07945', sx * 0.25, 0.2, -0.05, 0.12, 0.06, 0.04); }
      for (let i = 0; i < 5; i++) S(m.body, '#fff8e1', (i % 2 ? 0.15 : -0.12), 1.4, -0.3 + i * 0.15, 0.05, 0.05, 0.05); break;
    case 'wolf': m = quad({ len: 1.3, wid: 0.55, hgt: 0.55, leg: 0.6, legR: 0.08, color: '#78909c', belly: '#cfd8dc', snout: '#b0bec5', headR: 0.3, tail: 0.6, headUp: 1.0 });
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(G.cone(), toon('#607d8b')); e.scale.set(0.09, 0.2, 0.09); e.position.set(sx * 0.16, 0.3, -0.02); m.head.add(e); } break;
    case 'boar': m = quad({ len: 1.4, wid: 0.75, hgt: 0.7, leg: 0.4, legR: 0.1, color: '#5d4037', snout: '#d7a6a0', headR: 0.33, headUp: 0.6, tail: 0.2 });
      for (const sx of [-1, 1]) { const t = new THREE.Mesh(G.cone(), toon('#fff8e1')); t.scale.set(0.04, 0.16, 0.04); t.position.set(sx * 0.12, -0.08, 0.38); t.rotation.x = -0.6; m.head.add(t); } break;
    case 'rabbit': m = quad({ len: 0.5, wid: 0.35, hgt: 0.35, leg: 0.15, legR: 0.05, color: '#eeeeee', headR: 0.17, headUp: 1.3, tail: 0.05 });
      for (const sx of [-1, 1]) S(m.head, '#eeeeee', sx * 0.07, 0.25, -0.02, 0.05, 0.18, 0.03);
      S(m.body, '#ffffff', 0, 0.35, -0.27, 0.08, 0.08, 0.08); break;
    case 'tiger': case 'jaguar': {
      const tiger = kind === 'tiger';
      m = quad({ len: tiger ? 2.0 : 1.6, wid: 0.7, hgt: 0.65, leg: 0.6, legR: 0.12, color: tiger ? '#ff8f00' : '#e0a040', belly: '#fff8e1', snout: '#fff8e1', headR: 0.38, tail: 0.9, headUp: 0.9 });
      for (const sx of [-1, 1]) S(m.head, tiger ? '#ff8f00' : '#e0a040', sx * 0.24, 0.3, -0.05, 0.1, 0.1, 0.06);
      if (tiger) for (let i = 0; i < 7; i++) B(m.body, '#212121', 0, 0.95 + (i % 2) * 0.05, -0.8 + i * 0.25, 0.72, 0.08, 0.06);
      else for (let i = 0; i < 18; i++) S(m.body, '#3e2723', (Math.sin(i * 7.3) * 0.3), 0.75 + Math.cos(i * 3.1) * 0.25 + 0.2, -0.7 + (i / 18) * 1.4, 0.06, 0.06, 0.06);
      break;
    }
    case 'croc': {
      m = quad({ len: 3.0, wid: 0.8, hgt: 0.35, leg: 0.22, legR: 0.1, color: '#4e6b3a', belly: '#c5d6a0', headR: 0.32, headUp: 0.4, neck: 0.25, tail: 1.6 });
      m.tail.rotation.x = 0.4;
      const jaw = B(m.head, '#4e6b3a', 0, -0.05, 0.55, 0.42, 0.14, 0.9);
      B(m.head, '#fff8e1', 0, -0.12, 0.6, 0.38, 0.03, 0.8); m.jaw = jaw;
      for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(G.cone(), toon('#3b5229')); sp.scale.set(0.08, 0.14, 0.08); sp.position.set(0, 0.6, -1.3 + i * 0.35); m.body.add(sp); }
      break;
    }
    case 'anaconda': {
      const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
      const segs = [];
      for (let i = 0; i < 14; i++) { const s = S(body, i % 2 ? '#556b2f' : '#6b8e23', 0, 0.25, -i * 0.42, 0.28 - i * 0.01, 0.24 - i * 0.01, 0.3); segs.push(s); }
      const head = new THREE.Group(); head.position.set(0, 0.3, 0.35); body.add(head);
      S(head, '#6b8e23', 0, 0, 0, 0.3, 0.2, 0.38); eyes(head, 0.25, 0.1, 0.14, 0.07);
      const tongue = B(head, '#e53935', 0, -0.05, 0.45, 0.04, 0.02, 0.2);
      m = { g, body, legs: [], head, tail: null, segs, tongue };
      break;
    }
    case 'cow': m = quad({ len: 1.9, wid: 0.9, hgt: 0.9, leg: 0.8, legR: 0.12, color: '#fafafa', snout: '#f8bbd0', headR: 0.38, tail: 0.7, hoof: '#3e2723', headUp: 1.0 });
      for (const [x, y, z] of [[0.3, 1.4, 0.3], [-0.35, 1.2, -0.4], [0.1, 1.6, -0.1]]) S(m.body, '#212121', x, y, z, 0.25, 0.2, 0.3);
      for (const sx of [-1, 1]) { const h = new THREE.Mesh(G.cone(), toon('#fff8e1')); h.scale.set(0.05, 0.18, 0.05); h.position.set(sx * 0.22, 0.32, 0); h.rotation.z = -sx * 0.6; m.head.add(h); } break;
    case 'sheep': m = quad({ len: 1.1, wid: 0.8, hgt: 0.75, leg: 0.5, legR: 0.07, color: '#fafafa', legColor: '#424242', headColor: '#424242', headR: 0.25, headUp: 0.9 });
      for (let i = 0; i < 10; i++) S(m.body, '#ffffff', Math.sin(i * 2.4) * 0.35, 0.95 + Math.cos(i * 1.7) * 0.25, Math.cos(i * 2.4) * 0.4, 0.25, 0.25, 0.25); break;
    case 'steed': { m = quad({ len: 1.9, wid: 0.65, hgt: 0.8, leg: 1.1, legR: 0.1, color: ['#8d5a3a', '#f5f5f5', '#3e2723', '#bcaaa4'][variant % 4], snout: '#6d4c41', headR: 0.3, headUp: 1.65, tail: 0.8, tailColor: '#3e2723', hoof: '#212121' }); const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.8), new THREE.MeshToonMaterial({ color: '#b71c1c' })); saddle.position.set(0, 1.62, 0); m.body.add(saddle); break; }
    case 'horse': m = quad({ len: 1.9, wid: 0.65, hgt: 0.8, leg: 1.1, legR: 0.1, color: '#8d5a3a', snout: '#6d4c41', headR: 0.3, headUp: 1.65, tail: 0.8, tailColor: '#3e2723', hoof: '#212121' });
      C(m.body, '#8d5a3a', 0, 1.75, 0.85, 0.16, 0.8, -0.55);
      B(m.body, '#3e2723', 0, 2.0, 0.75, 0.06, 0.6, 0.35); break;
    default: m = quad({ color: '#9e9e9e' });
  }
  m.g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  m.size = ANIMALS[kind]?.size || 1;
  m.g.scale.setScalar(m.size);
  return m;
}

// 동물 움직임 (야생·탈것 공용). st: { id, mv 0멈춤/1걷기/2달리기, attacking, alive, flying, breathing, t }
export function animateAnimal(m, dt, st, kind) {
  const now = performance.now();
  st.t = (st.t || 0) + dt * (st.flying ? 0 : st.mv === 2 ? 14 : st.mv === 1 ? 7 : 0);
  const sw = Math.sin(st.t);
  if (st.flying) m.legs.forEach((l) => { l.rotation.x = 0.9; }); // 날 때는 다리를 접는다
  else m.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * sw * 0.6; });
  if (m.tail) m.tail.rotation.y = Math.sin(now / 300 + st.id) * 0.4;
  if (m.segs) m.segs.forEach((s, i) => { s.position.x = Math.sin(st.t * 0.6 - i * 0.6) * 0.25; });
  if (m.tailSegs) m.tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(now / 400 + st.id - i * 0.5) * 0.18; s.rotation.x = st.flying ? 0.08 : -0.06; });
  if (m.tongue) m.tongue.visible = Math.sin(now / 150 + st.id) > 0.3;
  if (m.jaw) m.jaw.rotation.x = st.attacking || st.breathing ? -0.5 : 0;
  if (m.wings) {
    // 날개짓: 날 때 크게 퍼덕이고 (올라갈수록 빠르게), 땅에서는 접어 올린다
    st.wt = (st.wt || 0) + dt * (st.flying ? (st.climb ? 9 : 6.5) : 0);
    const ang = st.flying ? Math.sin(st.wt) * 0.75 + 0.1 : 1.15;
    for (const w of m.wings) { w.rotation.z = w.userData.sx * ang; w.rotation.y = st.flying ? 0 : w.userData.sx * -0.5; }
    m.body.rotation.x = st.flying ? -0.06 + (st.mv === 2 ? 0.1 : 0) : 0;
  }
  m.head.rotation.x = st.breathing ? -0.15 : st.attacking ? -0.4 + Math.sin(now / 60) * 0.2 : st.mv === 0 && !st.flying ? Math.sin(now / 900 + st.id) * 0.25 + 0.2 : 0;
  const hop = kind === 'rabbit' ? 0.35 : 0.12;
  m.body.position.y = st.flying ? Math.sin((st.wt || 0) + 1) * 0.15 : st.mv === 2 ? Math.abs(sw) * hop : kind === 'rabbit' && st.mv === 1 ? Math.abs(sw) * 0.2 : 0;
  // 쓰러짐: 옆으로 눕는다
  m.body.rotation.z += ((st.alive === false ? Math.PI / 2 : 0) - m.body.rotation.z) * Math.min(1, dt * 5);
}

// ---------------- 탈것 (포획한 동물) ----------------
export function makeMount(kind, variant = 0) {
  const ride = RIDE[kind];
  const mesh = makeAnimalMesh(kind, variant);
  const scale = (ride.scale || 1) * mesh.size;
  mesh.g.scale.setScalar(scale);
  return { kind, def: ANIMALS[kind], ride, mesh, scale, st: { id: 0, mv: 0, t: 0, alive: true } };
}
// 동물 등에 바퀴벌레를 태운다 (동물 크기에 맞춰 작게)
export function updateMount(mt, roach, pos, heading, dt, o = {}) {
  const m = mt.mesh;
  m.g.position.copy(pos);
  if (o.swimY !== undefined) m.g.position.y = o.swimY;
  m.g.rotation.y = heading;
  const r = mt.ride;
  mt.st.mv = o.speed > r.walk * 1.2 ? 2 : o.speed > 0.4 ? 1 : 0;
  mt.st.flying = !!o.flying; mt.st.climb = o.climb; mt.st.breathing = o.breathing;
  animateAnimal(m, dt, mt.st, mt.kind);
  const seatY = (r.seat + m.body.position.y) * mt.scale;
  roach.setSeated(true);
  roach.riding = true; roach.pedal = 0; roach.flying = false; roach.flipped = false;
  roach.root.scale.setScalar(Math.min(0.62, 0.42 + mt.scale * 0.08) * (roach.baseScale || 1));
  const back = -0.15 * mt.scale;
  roach.root.position.set(m.g.position.x + Math.sin(heading) * back, m.g.position.y + seatY, m.g.position.z + Math.cos(heading) * back);
  roach.root.rotation.set(0, heading, 0);
  roach.update(dt, 0, { noCrawl: true });
}
export function mouthPos(mt) {
  const m = mt.mesh || mt;
  if (!m.mouth) return null;
  m.g.updateMatrixWorld(true);
  return m.mouth.getWorldPosition(new THREE.Vector3());
}

// ---------------- 체력바 · 포획 안내 ----------------
const barGeo = new THREE.PlaneGeometry(1, 1);
let hintTex = null;
function hintTexture() {
  if (hintTex) return hintTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(38,50,56,.85)'; x.beginPath(); x.roundRect(4, 8, 504, 80, 30); x.fill();
  x.fillStyle = '#ffd54f'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('🪢 Z 꾹 → 타이밍 맞춰 떼면 포획!', 256, 50);
  hintTex = new THREE.CanvasTexture(c); hintTex.colorSpace = THREE.SRGBColorSpace;
  return hintTex;
}
function makeBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: '#263238', transparent: true, opacity: 0.8, depthTest: false }));
  bg.scale.set(1.7, 0.22, 1); bg.renderOrder = 10; g.add(bg);
  const fill = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: '#66bb6a', depthTest: false }));
  fill.scale.set(1.6, 0.14, 1); fill.position.z = 0.01; fill.renderOrder = 11; g.add(fill);
  const hint = new THREE.Sprite(new THREE.SpriteMaterial({ map: hintTexture(), depthTest: false, transparent: true }));
  hint.scale.set(3.6, 0.68, 1); hint.position.y = 0.6; hint.renderOrder = 12; g.add(hint);
  g.userData = { fill, hint };
  return g;
}
export const capturable = (a) => a.alive && !a.gone && !a.def.city && (a.def.livestock || a.hp <= 50);

export class AnimalsView {
  constructor(scene, kinds, groundY) {
    this.scene = scene;
    this.groundY = groundY;
    this.list = kinds.map((k, id) => ({ id, kind: ANIMAL_KINDS[k], def: ANIMALS[ANIMAL_KINDS[k]], mesh: null, bar: null, pos: new THREE.Vector3(), target: null, h: 0, ay: 0, tay: 0, mv: 0, hp: 100, alive: true, seen: 0, t: Math.random() * 10 }));
    for (const a of this.list) a.hostile = !!a.def.hostile;
  }
  apply(arr) {
    const now = performance.now();
    for (let i = 0; i < arr.length; i += 8) {
      const a = this.list[arr[i]];
      if (!a) continue;
      const tgt = new THREE.Vector3(arr[i + 1] / 10, 0, arr[i + 2] / 10);
      if (!a.target || a.target.distanceTo(tgt) > 30) a.pos.copy(tgt);
      a.target = tgt; a.th = arr[i + 3] / 100; a.mv = arr[i + 4]; a.hp = arr[i + 5];
      const fl = arr[i + 6];
      if (a.alive && fl & 1) a.dieT = 0;
      a.alive = !(fl & 1); a.attacking = !!(fl & 2); a.gone = !!(fl & 8);
      const br = !!(fl & 4);
      if (br && !a.breathing) a.breathStart = true;
      a.breathing = br;
      a.tay = arr[i + 7] / 10;
      a.seen = now;
    }
  }
  update(dt, camPos, show, me = camPos) {
    const now = performance.now();
    for (const a of this.list) {
      const near = show && a.target && !a.gone && now - a.seen < 1500 && Math.hypot(a.pos.x - camPos.x, a.pos.z - camPos.z) < (this.viewDist || 220) * (a.def.fly ? 1.6 : 1);
      if (!near) { if (a.mesh) a.mesh.g.visible = false; if (a.bar) a.bar.visible = false; a.visible = false; continue; }
      if (!a.mesh) { a.mesh = makeAnimalMesh(a.kind, a.id); this.scene.add(a.mesh.g); a.bar = makeBar(); this.scene.add(a.bar); }
      const m = a.mesh;
      m.g.visible = true; a.visible = true;
      a.pos.lerp(a.target, Math.min(1, dt * 4));
      let dh = a.th - a.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      a.h += dh * Math.min(1, dt * 6);
      const gy = this.groundY(a.pos.x, a.pos.z);
      const climb = a.tay > a.ay + 0.3;
      a.ay += (a.tay - a.ay) * Math.min(1, dt * 4);
      a.pos.y = (a.def.swim ? Math.max(gy, WATER_Y - 0.25) : Math.max(gy, a.def.fly ? WATER_Y : -99)) + a.ay;
      m.g.position.copy(a.pos); m.g.rotation.y = a.h;
      a.flying = a.ay > 0.8; a.climb = climb;
      animateAnimal(m, dt, a, a.kind);
      this.sounds(a, dt, camPos);
      if (a.breathStart) { a.breathStart = false; const mp = mouthPos(m); if (mp && this.onBreath) this.onBreath(mp, a); }
      // 체력바 + 포획 안내 (가까이 있을 때만)
      const dMe = Math.hypot(a.pos.x - me.x, a.pos.z - me.z, (a.pos.y - me.y) * 0.5);
      const bar = a.bar;
      bar.visible = a.alive && dMe < 70 && !a.def.city;
      if (bar.visible) {
        bar.position.set(a.pos.x, a.pos.y + a.def.h * m.size + 0.7 + m.body.position.y, a.pos.z);
        bar.quaternion.copy(this.camQuat || bar.quaternion);
        const k = Math.max(0, Math.min(1, a.hp / 100));
        const f = bar.userData.fill;
        f.scale.x = Math.max(0.001, 1.6 * k); f.position.x = -0.8 + 0.8 * k;
        f.material.color.set(k > 0.5 ? '#66bb6a' : k > 0.25 ? '#ffa726' : '#ef5350');
        bar.userData.hint.visible = capturable(a) && dMe < 18;
        bar.scale.setScalar(Math.max(1, dMe / 18));
      }
    }
  }
  // 울음소리: 공격할 때 · 맞았을 때 · 쓰러질 때 · 가끔 저절로 (소리 내는 일은 main 의 onSound 가)
  sounds(a, dt, camPos) {
    if (!this.onSound) return;
    const now = performance.now();
    if (a.prevAlive && !a.alive) this.onSound(a, 'die');
    else if (a.alive && a.attacking && !a.prevAtk) this.onSound(a, 'attack');
    else if (a.alive && a.prevHp != null && a.hp < a.prevHp - 0.5 && now - (a.hurtSndT || 0) > 600) { a.hurtSndT = now; this.onSound(a, 'hurt'); }
    a.prevAlive = a.alive; a.prevAtk = a.attacking; a.prevHp = a.hp;
    a.callT = (a.callT ?? 4 + Math.random() * 20) - dt;
    if (a.callT <= 0) {
      a.callT = (a.def.livestock ? 10 : 8) + Math.random() * 18;
      if (a.alive && a.pos.distanceTo(camPos) < 80 && Math.random() < 0.7) this.onSound(a, 'call');
    }
  }
  // 포획할 수 있는 가장 가까운 동물
  nearestCapturable(pos, r = 10) {
    let best = null, bd = r;
    for (const a of this.list) { if (!a.visible || !capturable(a)) continue; const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z, (a.pos.y - pos.y) * 0.5) - a.def.r * (a.mesh?.size || 1); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  nearest(pos, r = 3) {
    let best = null, bd = r;
    for (const a of this.list) { if (!a.visible) continue; const d = a.pos.distanceTo(pos); if (d < bd) { bd = d; best = a; } }
    return best;
  }
}
