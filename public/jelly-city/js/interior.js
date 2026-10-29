import * as THREE from 'three';
import { INTERIOR_ORIGIN } from './config.js';
import { ACTIONS } from './data.js';
import { toon, box, cyl, sph, G, windowPlane, signMesh, RNG, roundRect, toonGradient } from '../../shared/js/utils.js';
import { Roach } from '../../shared/js/roach.js';
import { makeCarMesh } from './traffic.js';

const WALL_H = 5.5;

// ---------- 바닥 텍스처 ----------
const floorMats = {};
function floorMat(kind, c1, c2) {
  const key = kind + c1 + c2;
  if (floorMats[key]) return floorMats[key];
  if (typeof document === 'undefined') return (floorMats[key] = toon(c1));
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  if (kind === 'wood') {
    for (let i = 0; i < 8; i++) {
      x.fillStyle = i % 2 ? c1 : c2; x.fillRect(0, i * 32, 256, 32);
      x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, i * 32, 256, 2);
      x.fillRect((i * 97) % 256, i * 32, 2, 32);
    }
  } else if (kind === 'tile') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? c1 : c2; x.fillRect(i * 64, j * 64, 64, 64); }
  } else {
    x.fillStyle = c1; x.fillRect(0, 0, 256, 256);
    x.fillStyle = c2;
    for (let i = 0; i < 300; i++) x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  floorMats[key] = new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() });
  return floorMats[key];
}

const STYLE = {
  house: ['wood', '#e8c39e', '#dcb48c', '#fff3e0'],
  apartment: ['tile', '#eceff1', '#cfd8dc', '#e3f2fd'],
  hospital: ['tile', '#ffffff', '#e3f2fd', '#e8f5e9'],
  pharmacy: ['tile', '#ffffff', '#e8f5e9', '#f1f8e9'],
  vet: ['tile', '#ffffff', '#e3f2fd', '#e1f5fe'],
  dental: ['tile', '#ffffff', '#e0f7fa', '#e0f7fa'],
  school: ['wood', '#d7b98e', '#caa979', '#fff8e1'],
  kindergarten: ['tile', '#ffe0b2', '#c8e6c9', '#fffde7'],
  university: ['wood', '#a1887f', '#8d6e63', '#efebe9'],
  police: ['tile', '#cfd8dc', '#b0bec5', '#e3f2fd'],
  fire: ['concrete', '#bdbdbd', '#9e9e9e', '#ffebee'],
  court: ['wood', '#8d6e63', '#795548', '#efebe9'],
  cityhall: ['tile', '#f5f5f5', '#e0e0e0', '#f1f8e9'],
  postoffice: ['tile', '#ffccbc', '#ffffff', '#fff3e0'],
  restaurant: ['wood', '#d7b98e', '#caa979', '#fff3e0'],
  pizza: ['tile', '#fafafa', '#ef9a9a', '#fff3e0'],
  chicken: ['tile', '#fff8e1', '#ffe082', '#fffde7'],
  chinese: ['tile', '#ffebee', '#ef9a9a', '#fff8e1'],
  gukbap: ['wood', '#bcaaa4', '#a1887f', '#efebe9'],
  burger: ['tile', '#ffffff', '#ffcdd2', '#fffde7'],
  bunsik: ['tile', '#fce4ec', '#ffffff', '#fff0f5'],
  villa: ['tile', '#eceff1', '#cfd8dc', '#fafafa'],
  unit: ['wood', '#e6c9a8', '#d9b893', '#fffaf3'],
  cafe: ['wood', '#bcaaa4', '#a1887f', '#efebe9'],
  bakery: ['tile', '#fff3e0', '#ffe0b2', '#fff8e1'],
  supermarket: ['tile', '#f5f5f5', '#e0e0e0', '#e8f5e9'],
  convenience: ['tile', '#fafafa', '#e3f2fd', '#ffffff'],
  bank: ['tile', '#eeeeee', '#bdbdbd', '#fafafa'],
  office: ['carpet', '#90a4ae', '#78909c', '#eceff1'],
  tvstation: ['concrete', '#424242', '#616161', '#ede7f6'],
  library: ['wood', '#a1887f', '#8d6e63', '#fff8e1'],
  bookstore: ['wood', '#bcaaa4', '#a1887f', '#fff8e1'],
  museum: ['tile', '#efebe9', '#d7ccc8', '#fafafa'],
  gallery: ['concrete', '#fafafa', '#eeeeee', '#ffffff'],
  gym: ['carpet', '#424242', '#212121', '#eceff1'],
  salon: ['tile', '#ffffff', '#f8bbd0', '#fce4ec'],
  clothing: ['wood', '#efebe9', '#d7ccc8', '#f3e5f5'],
  hotel: ['carpet', '#b71c1c', '#8e1d2c', '#fff3e0'],
  cinema: ['carpet', '#4a148c', '#311b92', '#311b92'],
  concerthall: ['wood', '#8d6e63', '#6d4c41', '#880e4f'],
  factory: ['concrete', '#9e9e9e', '#8d8d8d', '#eceff1'],
  construction: ['concrete', '#a1887f', '#8d6e63', '#fff8e1'],
  garage: ['concrete', '#9e9e9e', '#757575', '#e3f2fd'],
  flowershop: ['wood', '#efebe9', '#d7ccc8', '#fce4ec'],
  realestate: ['carpet', '#b2dfdb', '#80cbc4', '#e0f2f1'],
  lab: ['tile', '#ffffff', '#e0f7fa', '#e0f7fa'],
  armory_3k: ['wood', '#8d6e63', '#795548', '#ffe0b2'],
  armory_mil: ['concrete', '#8d8d6b', '#7a7a5c', '#d7d3b8'],
  armory_sf: ['tile', '#263238', '#37474f', '#cfd8dc'],
  jeweler: ['carpet', '#4a148c', '#38006b', '#f3e5f5'],
  hatshop: ['wood', '#d7ccc8', '#bcaaa4', '#fff8e1'],
  eyewear: ['tile', '#ffffff', '#e1f5fe', '#e1f5fe'],
  club: ['tile', '#1a1030', '#120a24', '#1a1030'],
  dojang: ['wood', '#d7b98e', '#caa979', '#fff3e0'],
  range: ['concrete', '#9e9e9e', '#8d8d8d', '#cfd8c4'],
  prison: ['concrete', '#9e9e9e', '#8d8d8d', '#cfd8dc'],
  hunter: ['wood', '#8d6e63', '#795548', '#d7ccc8'],
  fishing: ['wood', '#b3e5fc', '#81d4fa', '#e1f5fe'],
  seafood: ['tile', '#fff3e0', '#ffccbc', '#fff8e1'],
  ranch: ['wood', '#d7b98e', '#caa979', '#fff8e1'],
  magicshop: ['wood', '#4527a0', '#311b92', '#ede7f6'],
  dealer: ['tile', '#fafafa', '#e0e0e0', '#eceff1'],
};

// ---------- 키트 ----------
class Kit {
  constructor(g, W, D, rng) {
    this.g = g; this.W = W; this.D = D; this.rng = rng;
    this.cols = []; this.work = []; this.visit = []; this.acts = []; this.anim = [];
    this.platforms = []; this.courses = []; this.lava = []; this.seats = []; this.screens = [];
  }
  // 올라설 수 있는 발판
  plat(x, z, w, d, top, color = '#a1887f') {
    box(this.g, w, top, d, color, x, top / 2, z);
    box(this.g, w + 0.05, 0.08, d + 0.05, '#ffffff', x, top + 0.02, z, { cast: false });
    this.platforms.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top });
  }
  // 무기 진열장
  display(x, z, w, ry = 0, color = '#5d4037', items = []) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, w, 1.0, 1.0, color, 0, 0.5, 0);
    const glass = new THREE.Mesh(G.box(), new THREE.MeshToonMaterial({ color: '#e1f5fe', transparent: true, opacity: 0.3 }));
    glass.scale.set(w, 0.6, 1.0); glass.position.set(0, 1.3, 0); c.add(glass);
    items.forEach((col, i) => box(c, 0.12, 0.08, 0.8, col, -w / 2 + 0.5 + i * ((w - 1) / Math.max(1, items.length - 1)), 1.06, 0, { ry: 0.4 }));
    const hw = Math.abs(Math.cos(ry)) > 0.5 ? w / 2 : 0.55, hd = Math.abs(Math.cos(ry)) > 0.5 ? 0.55 : w / 2;
    this.col(x, z, hw, hd);
  }
  // 벽걸이 무기 랙
  wallRack(x, z, w, ry, colors, kind = 'sword') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, w, 2.6, 0.15, '#5d4037', 0, 2.4, 0);
    colors.forEach((col, i) => {
      const xx = -w / 2 + 0.6 + i * ((w - 1.2) / Math.max(1, colors.length - 1));
      if (kind === 'sword') { box(c, 0.1, 1.6, 0.05, col, xx, 2.4, 0.12); box(c, 0.35, 0.06, 0.08, '#ffca28', xx, 1.6, 0.12); }
      else { box(c, 0.14, 0.3, 1.4, '#263238', xx, 2.4, 0.2, { rx: Math.PI / 2 }); box(c, 0.1, 0.25, 0.1, col, xx, 2.0, 0.14); }
    });
  }
  // 마네킹
  mannequin(x, z, acc, ry = 0) {
    const m = new Roach({ color: '#eceff1', age: 30, accessories: acc });
    m.root.position.set(x, 0, z); m.root.rotation.y = ry;
    this.g.add(m.root);
    this.col(x, z, 0.5, 0.5);
  }
  col(x, z, hw, hd) { this.cols.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd }); }
  w(x, z, face = 0) { this.work.push({ x, z, face }); }
  // 먹고 가기 자리 (테이블 옆에 서서 먹는 위치와 바라볼 방향)
  seat(x, z, face) { this.seats.push({ x, z, face }); }
  // 식당 테이블 + 좌석 + 손님 자리
  dinerTable(x, z, top, chair, round = true) {
    if (round) this.table(x, z, top, 2, chair);
    else {
      box(this.g, 2.2, 0.12, 1.2, top, x, 0.95, z);
      for (const sx of [-0.9, 0.9]) for (const sz of [-0.45, 0.45]) box(this.g, 0.1, 0.9, 0.1, '#5d4037', x + sx, 0.45, z + sz, { cast: false });
      for (const s of [-1, 1]) this.chair(x + s * 1.6, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, chair);
      this.col(x, z, 1.15, 0.65);
    }
    this.seat(x - 1.35, z, Math.PI / 2); this.seat(x + 1.35, z, -Math.PI / 2);
    this.v(x - 1.4, z, Math.PI / 2); this.v(x + 1.4, z, -Math.PI / 2);
  }
  v(x, z, face = Math.PI) { this.visit.push({ x, z, face }); }
  act(id, x, z) { this.acts.push({ id, x, z }); }
  counter(x, z, w, color = '#8d6e63', top = '#efebe9', depth = 1) {
    box(this.g, w, 1.1, depth, color, x, 0.55, z);
    box(this.g, w + 0.2, 0.12, depth + 0.2, top, x, 1.16, z);
    this.col(x, z, w / 2 + 0.1, depth / 2 + 0.1);
  }
  table(x, z, color = '#ffffff', chairs = 2, chairColor = '#ff8a65') {
    cyl(this.g, 0.9, 0.1, color, x, 0.95, z);
    cyl(this.g, 0.1, 0.9, '#666666', x, 0.45, z, { low: true });
    for (let i = 0; i < chairs; i++) {
      const a = (i / chairs) * Math.PI * 2;
      this.chair(x + Math.sin(a) * 1.4, z + Math.cos(a) * 1.4, a + Math.PI, chairColor);
    }
    this.col(x, z, 0.9, 0.9);
  }
  chair(x, z, ry = 0, color = '#ff8a65') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, 0.8, 0.12, 0.8, color, 0, 0.55, 0);
    box(c, 0.8, 0.8, 0.12, color, 0, 0.95, -0.36);
    for (const sx of [-0.33, 0.33]) for (const sz of [-0.33, 0.33]) box(c, 0.08, 0.55, 0.08, '#555555', sx, 0.27, sz, { cast: false });
  }
  desk(x, z, ry = 0, chair = true, color = '#bcaaa4') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, 2.2, 0.1, 1.1, color, 0, 1.0, 0);
    for (const sx of [-1, 1]) box(c, 0.1, 1.0, 1.0, '#757575', sx * 1.0, 0.5, 0);
    box(c, 0.9, 0.6, 0.06, '#263238', 0, 1.45, -0.3);
    const scr = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: this.rng.pick(['#80d8ff', '#b9f6ca', '#ffe57f']) }));
    scr.scale.set(0.8, 0.5, 1); scr.position.set(0, 1.45, -0.26); c.add(scr);
    if (chair) this.chairIn(c, 0, 0.9);
    this.col(x, z, 1.15, 1.15);
  }
  chairIn(parent, x, z, color = '#455a64') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = Math.PI; parent.add(c);
    box(c, 0.8, 0.12, 0.8, color, 0, 0.55, 0);
    box(c, 0.8, 0.8, 0.12, color, 0, 0.95, -0.36);
    cyl(c, 0.06, 0.5, '#333333', 0, 0.27, 0, { low: true });
  }
  shelf(x, z, w, ry = 0, colors, h = 2.6, frame = '#a1887f') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, w, h, 0.8, frame, 0, h / 2, 0);
    const rows = Math.floor(h / 0.65);
    const cols = colors || ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc', '#ff7043', '#26c6da'];
    for (let r = 0; r < rows; r++) {
      box(c, w - 0.1, 0.06, 0.82, '#ffffff', 0, 0.3 + r * 0.65, 0.01, { cast: false });
      const n = Math.floor(w / 0.38);
      for (let i = 0; i < n; i++) {
        const hh = 0.25 + this.rng.next() * 0.25;
        box(c, 0.3, hh, 0.35, this.rng.pick(cols), -w / 2 + 0.25 + i * 0.38, 0.33 + r * 0.65 + hh / 2, 0.2, { cast: false });
      }
    }
    const hw = Math.abs(Math.cos(ry)) > 0.5 ? w / 2 : 0.45, hd = Math.abs(Math.cos(ry)) > 0.5 ? 0.45 : w / 2;
    this.col(x, z, hw, hd);
  }
  bed(x, z, ry = 0, color = '#90caf9') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, 2.2, 0.5, 3.4, '#8d6e63', 0, 0.25, 0);
    box(c, 2.1, 0.35, 3.3, '#ffffff', 0, 0.65, 0);
    box(c, 2.12, 0.2, 2.2, color, 0, 0.8, 0.5);
    sph(c, 0.7, 0.2, 0.4, '#ffffff', 0, 0.9, -1.2);
    box(c, 2.2, 1.2, 0.2, '#8d6e63', 0, 0.6, -1.7);
    const hw = Math.abs(Math.cos(ry)) > 0.5 ? 1.15 : 1.75, hd = Math.abs(Math.cos(ry)) > 0.5 ? 1.75 : 1.15;
    this.col(x, z, hw, hd);
  }
  sofa(x, z, ry = 0, color = '#f48fb1') {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, 3, 0.6, 1.2, color, 0, 0.4, 0);
    box(c, 3, 1.0, 0.3, color, 0, 0.9, -0.5);
    for (const s of [-1, 1]) box(c, 0.3, 0.8, 1.2, color, s * 1.5, 0.6, 0);
    const hw = Math.abs(Math.cos(ry)) > 0.5 ? 1.6 : 0.7, hd = Math.abs(Math.cos(ry)) > 0.5 ? 0.7 : 1.6;
    this.col(x, z, hw, hd);
  }
  plant(x, z, s = 1) {
    cyl(this.g, 0.35 * s, 0.6 * s, '#d7a86e', x, 0.3 * s, z, { low: true });
    sph(this.g, 0.6 * s, 0.8 * s, 0.6 * s, '#66bb6a', x, 1.1 * s, z, { ico: true });
    this.col(x, z, 0.4, 0.4);
  }
  rug(x, z, w, d, color) { box(this.g, w, 0.03, d, color, x, 0.12, z, { cast: false }); }
  frame(x, y, z, w, h, ry = 0, color) {
    const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = ry; this.g.add(c);
    box(c, w + 0.2, h + 0.2, 0.08, '#8d6e63', 0, 0, 0, { cast: false });
    box(c, w, h, 0.1, color || this.rng.pick(['#ff8a80', '#80d8ff', '#ccff90', '#ffd180', '#ea80fc']), 0, 0, 0.02, { cast: false });
  }
  tv(x, z, ry = 0) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; this.g.add(c);
    box(c, 2.6, 0.7, 0.7, '#8d6e63', 0, 0.35, 0);
    box(c, 3.0, 1.8, 0.12, '#212121', 0, 1.75, 0);
    const s = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#4fc3f7' }));
    s.scale.set(2.8, 1.575, 1); s.position.set(0, 1.75, 0.07); c.add(s);
    s.userData.tv = true; this.screens.push(s); // 브라우저에서 방송 화면으로 바뀐다
    this.col(x, z, 1.2, 0.4);
  }
  label(text, emoji, x, y, z, w = 4, bg = '#ffffff', fg = '#4a3428', ry = 0) {
    const s = signMesh(text, emoji, w, bg, fg);
    s.position.set(x, y, z); s.rotation.y = ry;
    this.g.add(s);
  }
}

// ---------- 타입별 배치 ----------
// 좌표계: 방 중심이 (0,0), 정문은 +z 벽 (z = D/2)
const LAYOUTS = {
  house(k, ctx) {
    const { W, D } = k;
    k.rug(-1, 0, 5, 4, '#f8bbd0');
    k.bed(-W / 2 + 1.6, -D / 2 + 2.2, 0, ctx.rng.pick(['#90caf9', '#f48fb1', '#a5d6a7', '#ffe082']));
    k.act('sleep', -W / 2 + 3.2, -D / 2 + 2.5);
    k.sofa(0, 1.8, Math.PI, '#ffab91');
    k.tv(0, -D / 2 + 0.8, 0);
    k.act('tv', 0, 0.2);
    // 부엌
    k.counter(W / 2 - 0.8, -1.5, 1.2, '#ffffff', '#b0bec5', 1.2);
    box(k.g, 1.2, 2.2, 1.2, '#eceff1', W / 2 - 0.8, 1.1, -3.2);
    k.col(W / 2 - 0.8, -3.2, 0.6, 0.6);
    k.act('cook', W / 2 - 2.2, -1.5);
    // 욕실 커튼
    box(k.g, 0.1, 2.4, 2.4, '#b3e5fc', W / 2 - 2.6, 1.2, D / 2 - 1.8);
    k.act('shower', W / 2 - 1.3, D / 2 - 1.8);
    k.table(-W / 2 + 2, 2.4, '#ffffff', 2, '#ffcc80');
    k.plant(W / 2 - 0.8, D / 2 - 0.8, 0.8);
    k.frame(-1, 3, -D / 2 + 0.2, 1.6, 1.1);
    // 전신 거울 (몸 색깔 바꾸기)
    box(k.g, 0.15, 2.6, 1.3, '#8d6e63', -W / 2 + 0.25, 1.4, -0.6);
    box(k.g, 0.05, 2.3, 1.05, toon('#e1f5fe', { emissive: '#b3e5fc', emissiveIntensity: 0.3 }), -W / 2 + 0.35, 1.4, -0.6, { cast: false });
    k.act('recolor', -W / 2 + 1.4, -0.6);
    k.v(-W / 2 + 2, 1.0, 0); k.v(1.6, 1.0, Math.PI); k.v(W / 2 - 2.3, -1.5, Math.PI / 2); k.v(-1, -1, 0);
    k.w(-1.5, 0.5, 0); k.w(1.5, -0.5, Math.PI);
  },
  apartment(k) {
    const { W, D } = k;
    k.label('입주민 라운지', '🛋️', 0, 3.4, -D / 2 + 0.2, 5);
    for (let i = 0; i < 6; i++) box(k.g, 0.9, 0.7, 0.4, '#b0bec5', -W / 2 + 1.5 + i * 1.0, 1.6, -D / 2 + 0.3);
    for (const s of [-1, 1]) {
      box(k.g, 2, 3, 0.2, '#90a4ae', s * 3, 1.5, -D / 2 + 0.15);
      box(k.g, 0.05, 3, 0.25, '#455a64', s * 3, 1.5, -D / 2 + 0.2);
    }
    k.sofa(-W / 2 + 4, 1, Math.PI / 2, '#80cbc4');
    k.sofa(W / 2 - 4, 1, -Math.PI / 2, '#80cbc4');
    k.rug(0, 1, 6, 4, '#ffe0b2');
    k.table(0, 1, '#ffffff', 0);
    k.plant(-W / 2 + 1, D / 2 - 1); k.plant(W / 2 - 1, D / 2 - 1);
    k.counter(W / 2 - 3, -D / 2 + 2.5, 3, '#a1887f');
    k.w(W / 2 - 3, -D / 2 + 1.5, 0);
    k.v(-2, 3, 0); k.v(2, -1, Math.PI); k.v(-W / 2 + 5.5, 1, -Math.PI / 2); k.v(W / 2 - 5.5, 1, Math.PI / 2); k.v(3, 3, 0);
  },
  hospital(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 6, '#e3f2fd', '#ffffff');
    k.label('접수 · 수납', '🏥', 0, 3, -D / 2 + 0.2, 5, '#ffffff', '#e53935');
    k.w(-1.5, -D / 2 + 2, 0); k.w(1.5, -D / 2 + 2, 0);
    k.act('checkup', 0, -D / 2 + 4.3);
    for (let i = 0; i < 4; i++) {
      const x = -W / 2 + 2.2 + i * 3.2;
      k.bed(x, -2, 0, '#b3e5fc');
      box(k.g, 0.08, 2.4, 3.6, '#c5e1a5', x + 1.5, 1.2, -2);
      k.v(x, 0.6, Math.PI);
    }
    k.w(-W / 2 + 4, 1.2, Math.PI); k.w(-W / 2 + 10, 1.2, Math.PI);
    for (let i = 0; i < 5; i++) k.chair(W / 2 - 1.2, -3 + i * 1.2, -Math.PI / 2, '#80deea');
    k.v(W / 2 - 2.4, -1, Math.PI / 2); k.v(W / 2 - 2.4, 1.4, Math.PI / 2);
    // 수술실
    box(k.g, 2, 1, 3.2, '#b2dfdb', W / 2 - 5, 0.5, D / 2 - 3);
    cyl(k.g, 0.9, 0.2, '#ffffff', W / 2 - 5, 4, D / 2 - 3);
    k.col(W / 2 - 5, D / 2 - 3, 1, 1.6);
    k.w(W / 2 - 6.5, D / 2 - 3, Math.PI / 2);
    k.plant(-W / 2 + 1, D / 2 - 1);
    k.v(-2, 4, 0); k.v(3, 3, Math.PI);
  },
  clinic(k, ctx, title, emoji, color) {
    const { W, D } = k;
    k.counter(-W / 2 + 3.5, -D / 2 + 2, 4, '#ffffff', color);
    k.w(-W / 2 + 3.5, -D / 2 + 1, 0);
    k.label(title, emoji, 0, 3, -D / 2 + 0.2, 4.5, '#ffffff', '#00838f');
    // 진료 의자
    box(k.g, 1.2, 0.8, 2.6, color, W / 2 - 3, 0.6, -1.5, { rx: -0.2 });
    cyl(k.g, 0.8, 0.1, '#ffffff', W / 2 - 3, 3.4, -1.5);
    k.col(W / 2 - 3, -1.5, 0.7, 1.4);
    k.w(W / 2 - 4.6, -1.5, Math.PI / 2);
    k.v(W / 2 - 3, 0.6, Math.PI);
    for (let i = 0; i < 3; i++) k.chair(-W / 2 + 1.2, 1 + i * 1.2, Math.PI / 2, '#80deea');
    k.v(-W / 2 + 2.5, 1.5, -Math.PI / 2); k.v(0, 2.5, Math.PI);
    k.plant(W / 2 - 1, D / 2 - 1);
  },
  dental(k, ctx) { LAYOUTS.clinic(k, ctx, '치료실', '🦷', '#80deea'); k.act('scaling', W2(k) - 3, 1.5); },
  vet(k, ctx) {
    LAYOUTS.clinic(k, ctx, '진찰실', '🐾', '#a5d6a7');
    // 작은 반려동물들 (작고 둥근)
    for (let i = 0; i < 3; i++) {
      const x = -1 + i * 1.2, z = 0;
      sph(k.g, 0.35, 0.28, 0.4, ['#8d6e63', '#ffab91', '#bcaaa4'][i], x, 0.3, z);
      sph(k.g, 0.07, 0.07, 0.07, '#212121', x - 0.1, 0.45, z + 0.32, { low: true });
      sph(k.g, 0.07, 0.07, 0.07, '#212121', x + 0.1, 0.45, z + 0.32, { low: true });
    }
    k.act('pet', 0, 1.2);
  },
  pharmacy(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 6, '#ffffff', '#a5d6a7');
    k.shelf(0, -D / 2 + 0.6, W - 2, 0, ['#ffffff', '#c8e6c9', '#fff9c4', '#ffcdd2']);
    k.w(0, -D / 2 + 2, 0);
    k.act('vitamin', 0, -D / 2 + 4.2);
    k.shelf(-W / 2 + 0.6, 1.5, 4, Math.PI / 2, ['#ffffff', '#c8e6c9', '#b3e5fc']);
    k.v(-W / 2 + 2, 1.5, -Math.PI / 2); k.v(2, 2, Math.PI); k.v(-1, 3, Math.PI);
    k.plant(W / 2 - 1, D / 2 - 1);
  },
  school(k) {
    const { W, D } = k;
    box(k.g, 8, 2.4, 0.15, '#2e7d32', 0, 2.4, -D / 2 + 0.25);
    box(k.g, 8.4, 0.2, 0.3, '#8d6e63', 0, 1.15, -D / 2 + 0.3);
    k.label('오늘의 수업: 벽 타기의 과학', '✏️', 0, 2.4, -D / 2 + 0.36, 6, '#2e7d32', '#ffffff');
    k.desk(0, -D / 2 + 2.6, Math.PI, false, '#a1887f');
    k.w(0, -D / 2 + 1.5, 0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = -W / 2 + 5 + c * ((W - 10) / 3), z = -1 + r * 2.8;
      box(k.g, 1.4, 0.1, 0.9, '#ffe082', x, 0.85, z);
      box(k.g, 0.08, 0.85, 0.8, '#757575', x, 0.42, z);
      k.chair(x, z + 0.9, Math.PI, '#4fc3f7');
      k.col(x, z, 0.7, 0.5);
      k.v(x, z + 1.0, Math.PI);
    }
    k.act('class', W / 2 - 2, D / 2 - 3);
    k.shelf(W / 2 - 0.6, -2, 3, -Math.PI / 2);
    k.plant(-W / 2 + 1, -D / 2 + 1);
    k.w(-W / 2 + 2, D / 2 - 2, Math.PI);
  },
  kindergarten(k) {
    const { W, D } = k;
    k.rug(0, 0, W - 4, D - 5, '#b3e5fc');
    const cols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    for (let i = 0; i < 14; i++) box(k.g, 0.6, 0.6, 0.6, k.rng.pick(cols), k.rng.range(-W / 2 + 3, W / 2 - 3), 0.3 + (i % 3 === 0 ? 0.6 : 0), k.rng.range(-2, 2), { ry: k.rng.next() });
    for (let i = 0; i < 4; i++) sph(k.g, 0.5, 0.5, 0.5, cols[i], -W / 2 + 2, 0.6, -2 + i * 1.3);
    // 미끄럼틀
    box(k.g, 1.2, 1.6, 1.2, '#ff7043', W / 2 - 3, 0.8, -D / 2 + 2);
    box(k.g, 1.0, 0.1, 3, '#ffd54f', W / 2 - 3, 0.9, -D / 2 + 4, { rx: 0.5 });
    k.col(W / 2 - 3, -D / 2 + 2, 0.7, 0.7);
    k.label('꼬물꼬물 반', '🧸', 0, 3, -D / 2 + 0.2, 4, '#fffde7', '#ff7043');
    k.w(-2, -D / 2 + 2, 0); k.w(2, D / 2 - 2.5, Math.PI);
    for (let i = 0; i < 8; i++) k.v(k.rng.range(-W / 2 + 3, W / 2 - 4), k.rng.range(-3, 3), k.rng.range(0, 6));
    k.act('play', 0, 2.5);
  },
  university(k) {
    const { W, D } = k;
    box(k.g, W - 6, 3, 0.15, '#263238', 0, 3, -D / 2 + 0.25);
    k.label('젤리 과학 101', '🎓', 0, 3.2, -D / 2 + 0.36, 6, '#263238', '#ffffff');
    box(k.g, 1.6, 1.2, 0.9, '#6d4c41', 0, 0.6, -D / 2 + 2.6);
    k.col(0, -D / 2 + 2.6, 0.8, 0.5);
    k.w(0, -D / 2 + 1.7, 0); k.w(-W / 2 + 2, -D / 2 + 2, 0);
    for (let r = 0; r < 4; r++) {
      const z = -1 + r * 2.2;
      box(k.g, W - 8, 0.1, 0.7, '#a1887f', 0, 0.9 + r * 0.25, z);
      box(k.g, W - 8, 0.9 + r * 0.25, 0.1, '#8d6e63', 0, (0.9 + r * 0.25) / 2, z + 0.3);
      k.col(0, z, (W - 8) / 2, 0.4);
      for (let c = 0; c < 4; c++) k.v(-W / 2 + 6 + c * ((W - 12) / 3), z + 0.9, Math.PI);
    }
    k.act('lecture', W / 2 - 2, D / 2 - 2.5);
    k.shelf(W / 2 - 0.6, -2, 4, -Math.PI / 2);
  },
  police(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 6, '#90a4ae', '#cfd8dc');
    k.label('민원실', '🚓', 0, 3, -D / 2 + 0.2, 4, '#23356b', '#ffffff');
    k.w(-1.5, -D / 2 + 2, 0); k.w(1.5, -D / 2 + 2, 0);
    k.act('report', 0, -D / 2 + 4.3);
    k.desk(-W / 2 + 3, 1, 0); k.w(-W / 2 + 3, 2.0, Math.PI);
    k.desk(-W / 2 + 7, 1, 0); k.w(-W / 2 + 7, 2.0, Math.PI);
    // 유치장
    for (let i = 0; i < 8; i++) cyl(k.g, 0.06, 3, '#607d8b', W / 2 - 6 + i * 0.6, 1.5, -1, { low: true });
    box(k.g, 5, 0.2, 0.2, '#607d8b', W / 2 - 3.9, 3, -1);
    k.col(W / 2 - 3.9, -1, 2.5, 0.15);
    box(k.g, 2, 0.5, 1, '#8d6e63', W / 2 - 3, 0.25, -D / 2 + 1.5);
    k.frame(-W / 2 + 0.2, 2.6, -2, 2, 1.4, Math.PI / 2, '#fff59d');
    k.v(2, 2, Math.PI); k.v(-2, 3, Math.PI);
    k.plant(-W / 2 + 1, D / 2 - 1);
  },
  fire(k) {
    const { W, D } = k;
    const t = new THREE.Group(); t.position.set(-W / 4, 0, -1); k.g.add(t);
    box(t, 3, 2.2, 8, '#e53935', 0, 1.5, 0);
    box(t, 2.8, 1.4, 2.4, '#ffffff', 0, 3.2, 2.5);
    box(t, 0.5, 0.5, 7, '#cfd8dc', 0, 3.2, -0.8);
    for (const sx of [-1, 1]) for (const sz of [-2.8, 0, 2.8]) cyl(t, 0.6, 0.4, '#212121', sx * 1.4, 0.6, sz, { rz: Math.PI / 2 });
    k.col(-W / 4, -1, 1.7, 4.2);
    k.act('truck', -W / 4 + 2.6, 3.8);
    for (let i = 0; i < 4; i++) {
      box(k.g, 0.9, 2, 0.6, '#ffca28', W / 2 - 1.2, 1, -D / 2 + 1.5 + i * 1.2);
      sph(k.g, 0.35, 0.3, 0.35, '#e53935', W / 2 - 1.2, 2.3, -D / 2 + 1.5 + i * 1.2, { hemi: true });
    }
    k.col(W / 2 - 1.2, -D / 2 + 3.3, 0.5, 2.4);
    k.table(W / 4, 2, '#ffffff', 4, '#e57373');
    k.w(W / 4 - 1.4, 2, Math.PI / 2); k.w(W / 4 + 1.4, 2, -Math.PI / 2); k.w(-W / 4 + 2.6, -3, -Math.PI / 2);
    k.v(W / 4, 4.5, Math.PI); k.v(0, 4, Math.PI);
    cyl(k.g, 0.15, WALL_H, '#ffd54f', W / 4 + 3, WALL_H / 2, -3, { low: true });
  },
  court(k) {
    const { W, D } = k;
    box(k.g, 7, 1.6, 1.4, '#5d4037', 0, 0.8, -D / 2 + 2.2);
    box(k.g, 7.4, 0.15, 1.6, '#4e342e', 0, 1.65, -D / 2 + 2.2);
    k.col(0, -D / 2 + 2.2, 3.7, 0.8);
    box(k.g, 1.6, 3.5, 0.2, '#3e2723', 0, 2.5, -D / 2 + 0.3);
    k.label('정숙', '⚖️', 0, 4.4, -D / 2 + 0.42, 3, '#3e2723', '#ffe082');
    k.w(0, -D / 2 + 1.2, 0);
    for (const s of [-1, 1]) {
      k.desk(s * 4, 0, Math.PI, false, '#795548');
      k.w(s * 4, -1, 0);
    }
    for (let r = 0; r < 2; r++) {
      box(k.g, W - 6, 0.5, 0.8, '#8d6e63', 0, 0.5, 3 + r * 1.8);
      box(k.g, W - 6, 1.2, 0.15, '#6d4c41', 0, 0.8, 3.4 + r * 1.8);
      k.col(0, 3 + r * 1.8, (W - 6) / 2, 0.45);
      for (let c = 0; c < 4; c++) k.v(-W / 2 + 4 + c * ((W - 8) / 3), 2.3 + r * 1.8, Math.PI);
    }
    k.act('trial', W / 2 - 1.8, 0);
    for (const s of [-1, 1]) k.plant(s * (W / 2 - 1), -D / 2 + 1);
  },
  cityhall(k) {
    const { W, D } = k;
    k.rug(0, 0, 4, D - 2, '#c62828');
    k.label('젤리시티 시청 민원실', '🏛️', 0, 3.6, -D / 2 + 0.2, 7, '#2e7d32', '#ffffff');
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 4 + i * 4.5;
      k.counter(x, -D / 2 + 3, 3.2, '#a5d6a7', '#ffffff');
      k.w(x, -D / 2 + 2, 0);
      k.v(x, -D / 2 + 4.3, Math.PI);
    }
    // 일자리 게시판
    box(k.g, 4.5, 2.6, 0.2, '#8d6e63', W / 2 - 3.5, 2, -D / 2 + 0.3);
    box(k.g, 4.2, 2.3, 0.22, '#ffe0b2', W / 2 - 3.5, 2, -D / 2 + 0.32);
    for (let i = 0; i < 6; i++) box(k.g, 0.9, 0.7, 0.05, ['#fff59d', '#b3e5fc', '#c8e6c9', '#f8bbd0'][i % 4], W / 2 - 5 + (i % 3) * 1.5, 2.5 - Math.floor(i / 3) * 1.0, -D / 2 + 0.45, { cast: false });
    k.label('일자리 게시판', '📋', W / 2 - 3.5, 3.7, -D / 2 + 0.5, 3.5, '#ffffff', '#5d4037');
    k.act('jobs', W / 2 - 3.5, -D / 2 + 1.8);
    // 시장실 책상
    k.desk(W / 2 - 4, 3, Math.PI, true, '#6d4c41');
    k.w(W / 2 - 4, 2, 0);
    k.frame(W / 2 - 0.2, 3, 3, 2, 1.5, -Math.PI / 2, '#ffd54f');
    for (let i = 0; i < 4; i++) k.chair(-W / 2 + 1.2, 1 + i * 1.3, Math.PI / 2, '#81c784');
    k.v(-W / 2 + 2.5, 2, -Math.PI / 2); k.v(-2, 4, Math.PI); k.v(2, 2, Math.PI);
    k.plant(-W / 2 + 1, -D / 2 + 1); k.plant(W / 2 - 1, D / 2 - 1);
  },
  postoffice(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, W - 8, '#ff8a65', '#ffffff');
    k.label('우편 · 택배 접수', '📮', 0, 3, -D / 2 + 0.2, 5, '#ffffff', '#d84315');
    k.w(-2, -D / 2 + 2, 0); k.w(2, -D / 2 + 2, 0);
    k.act('letter', 0, -D / 2 + 4.3);
    k.shelf(-W / 2 + 0.6, 0, 6, Math.PI / 2, ['#d7ccc8', '#ffe0b2', '#bcaaa4']);
    for (let i = 0; i < 6; i++) box(k.g, 1, 0.8, 1, '#d7a86e', W / 2 - 2 - (i % 2) * 1.1, 0.4 + Math.floor(i / 2) * 0.8, 2);
    k.col(W / 2 - 2.5, 2, 1.1, 0.6);
    k.w(W / 2 - 3, 0, Math.PI / 2);
    k.v(-2, 3, Math.PI); k.v(2, 4, Math.PI);
  },
  // ---------------- 음식점 ----------------
  // 공통 틀: 뒤쪽 주방 + 주문 카운터 + 앞쪽 테이블
  diner(k, o) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, W - 5, o.counter, o.counterTop);
    // 메뉴판
    box(k.g, Math.min(W - 6, 9), 1.6, 0.12, o.board || '#3e2723', 0, 3.6, -D / 2 + 0.22, { cast: false });
    k.label(o.menuText, o.emoji, 0, 3.6, -D / 2 + 0.32, Math.min(W - 6.5, 8.5), o.board || '#3e2723', o.boardInk || '#fff8e1');
    k.w(-1.5, -D / 2 + 1.8, 0); k.w(1.8, -D / 2 + 1.8, 0);
    k.act('order', 0, -D / 2 + 4.3);
    o.kitchen?.(k, W, D);
    const cols = Math.max(2, Math.floor((W - 2) / 6));
    for (let i = 0; i < cols; i++) for (let r = 0; r < 2; r++) {
      const x = -W / 2 + W / (cols * 2) + i * (W / cols), z = 0.6 + r * 3.0;
      if (Math.abs(x) < 1.5 && r === 1) continue; // 출구 통로
      k.dinerTable(x, z, o.table, o.chair, o.round !== false);
    }
    k.plant(-W / 2 + 0.8, D / 2 - 0.8, 0.7); k.plant(W / 2 - 0.8, D / 2 - 0.8, 0.7);
  },
  restaurant(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#8d6e63', counterTop: '#efebe9', table: '#d7b98e', chair: '#a1887f', round: false, emoji: '🍚', menuText: '비빔밥 · 불고기 정식 · 김치찌개', kitchen: (k2) => {
      for (let i = 0; i < 3; i++) { cyl(k2.g, 0.45, 0.5, '#37474f', -W / 2 + 2 + i * 1.2, 1.4, -D / 2 + 1.2); bubbles(k2, -W / 2 + 2 + i * 1.2, 1.7, -D / 2 + 1.2, '#d84315'); }
      for (let i = 0; i < 6; i++) sph(k2.g, 0.18, 0.08, 0.18, ['#43a047', '#e53935', '#ffb300'][i % 3], W / 2 - 4 + (i % 3) * 0.5, 1.28, -D / 2 + 3 + (i < 3 ? -0.2 : 0.2), { low: true });
    } });
  },
  pizza(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#c62828', counterTop: '#fafafa', table: '#fafafa', chair: '#ef5350', emoji: '🍕', menuText: '페퍼로니 · 치즈 · 포테이토 · 불고기', board: '#2e7d32', kitchen: (k2) => {
      // 화덕
      const x = -W / 2 + 2.6, z = -D / 2 + 1.4;
      sph(k2.g, 1.5, 1.3, 1.1, '#bf6d4a', x, 0.8, z, { hemi: true });
      box(k2.g, 3.2, 0.8, 2.4, '#8d6e63', x, 0.4, z);
      const fire = new THREE.Mesh(G.sphereLow(), new THREE.MeshToonMaterial({ color: '#ff6d00', emissive: '#ff3d00', emissiveIntensity: 1 }));
      fire.scale.set(0.55, 0.35, 0.2); fire.position.set(x, 1.15, z + 1.0); k2.g.add(fire);
      k2.anim.push({ type: 'lava', obj: fire });
      k2.col(x, z, 1.6, 1.2);
      // 반죽대 & 피자
      for (let i = 0; i < 3; i++) { cyl(k2.g, 0.45, 0.05, '#ffca28', W / 2 - 4 + i * 1.1, 1.25, -D / 2 + 3); sph(k2.g, 0.08, 0.03, 0.08, '#d32f2f', W / 2 - 4 + i * 1.1, 1.3, -D / 2 + 3, { low: true }); }
      box(k2.g, 1.8, 0.8, 1.2, '#efebe9', W / 2 - 1.6, 0.4, D / 2 - 2.2);
      for (let i = 0; i < 4; i++) box(k2.g, 1.1, 0.12, 1.1, '#f5deb3', W / 2 - 1.6, 0.86 + i * 0.13, D / 2 - 2.2, { cast: false });
      k2.col(W / 2 - 1.6, D / 2 - 2.2, 0.9, 0.6);
    } });
  },
  chicken(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#ffb300', counterTop: '#fffde7', table: '#ffffff', chair: '#ffca28', emoji: '🍗', menuText: '후라이드 · 양념 · 반반 · 간장 + 치킨무', board: '#4e342e', kitchen: (k2) => {
      for (let i = 0; i < 2; i++) {
        const x = -W / 2 + 2 + i * 1.6, z = -D / 2 + 1.2;
        box(k2.g, 1.3, 1.1, 1.0, '#b0bec5', x, 0.55, z);
        box(k2.g, 1.1, 0.04, 0.8, '#ffb300', x, 1.12, z, { cast: false });
        bubbles(k2, x, 1.15, z, '#ffe082');
        k2.col(x, z, 0.7, 0.55);
      }
      for (let i = 0; i < 5; i++) box(k2.g, 0.8, 0.45, 0.6, '#ffffff', W / 2 - 1.2, 0.25 + i * 0.47, -D / 2 + 1.0);
      box(k2.g, 0.82, 0.08, 0.62, '#ff8f00', W / 2 - 1.2, 2.6, -D / 2 + 1.0, { cast: false });
      // 맥주 냉장고
      box(k2.g, 1.2, 2.4, 0.8, '#e3f2fd', W / 2 - 0.8, 1.2, 0); k2.col(W / 2 - 0.8, 0, 0.6, 0.4);
    } });
  },
  chinese(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#b71c1c', counterTop: '#ffd54f', table: '#fafafa', chair: '#c62828', emoji: '🥡', menuText: '짜장면 · 짬뽕 · 탕수육 · 볶음밥 · 군만두', board: '#b71c1c', boardInk: '#ffd54f', kitchen: (k2) => {
      const x = -W / 2 + 2.4, z = -D / 2 + 1.2;
      box(k2.g, 2.6, 1.0, 1.2, '#90a4ae', x, 0.5, z);
      const wok = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon('#263238'));
      wok.position.set(x - 0.5, 1.6, z); k2.g.add(wok);
      const fire = new THREE.Mesh(G.cone(), new THREE.MeshToonMaterial({ color: '#ff9100', emissive: '#ff3d00', emissiveIntensity: 1 }));
      fire.scale.set(0.35, 0.5, 0.35); fire.position.set(x - 0.5, 1.1, z); k2.g.add(fire);
      k2.anim.push({ type: 'lava', obj: fire });
      k2.col(x, z, 1.35, 0.65);
      // 홍등
      for (let i = 0; i < 4; i++) {
        const lx = -W / 2 + 3 + i * (W - 6) / 3;
        sph(k2.g, 0.4, 0.5, 0.4, new THREE.MeshToonMaterial({ color: '#ff1744', emissive: '#ff1744', emissiveIntensity: 0.4 }), lx, 4.4, 1.5, { low: true, cast: false });
        cyl(k2.g, 0.02, 0.8, '#333333', lx, 5.1, 1.5, { low: true });
      }
      // 배달통
      box(k2.g, 0.9, 0.7, 0.6, '#c0c0c0', W / 2 - 1.2, 0.35, D / 2 - 2.0); k2.col(W / 2 - 1.2, D / 2 - 2.0, 0.5, 0.35);
    } });
  },
  gukbap(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#6d4c41', counterTop: '#d7ccc8', table: '#8d6e63', chair: '#a1887f', round: false, emoji: '🍲', menuText: '돼지국밥 · 순대국밥 · 해장국 · 콩나물국밥', board: '#4e342e', kitchen: (k2) => {
      for (let i = 0; i < 3; i++) {
        const x = -W / 2 + 2 + i * 1.7, z = -D / 2 + 1.3;
        cyl(k2.g, 0.75, 0.9, '#263238', x, 0.75, z);
        cyl(k2.g, 0.68, 0.05, '#efebe9', x, 1.2, z, { cast: false });
        bubbles(k2, x, 1.22, z, '#ffffff');
        k2.col(x, z, 0.8, 0.8);
      }
      // 깍두기 항아리
      for (let i = 0; i < 3; i++) sph(k2.g, 0.45, 0.6, 0.45, '#6d4c41', W / 2 - 1 - i * 1.0, 0.6, -D / 2 + 1.0);
      k2.label('24시간 영업 · 국밥은 사랑입니다', '❤️', W / 2 - 0.25, 3.0, 1, 4, '#fff8e1', '#4e342e', -Math.PI / 2);
    } });
  },
  burger(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#e53935', counterTop: '#ffffff', table: '#ffd54f', chair: '#e53935', round: false, emoji: '🍔', menuText: '젤리버거 · 더블치즈 · 감튀 · 쉐이크 · 콜라', board: '#212121', boardInk: '#ffd54f', kitchen: (k2) => {
      box(k2.g, 3.0, 1.0, 1.1, '#9e9e9e', -W / 2 + 2.4, 0.5, -D / 2 + 1.2);
      box(k2.g, 2.8, 0.05, 0.9, '#424242', -W / 2 + 2.4, 1.03, -D / 2 + 1.2, { cast: false });
      for (let i = 0; i < 4; i++) cyl(k2.g, 0.22, 0.06, '#6d4c41', -W / 2 + 1.4 + i * 0.65, 1.08, -D / 2 + 1.2);
      k2.col(-W / 2 + 2.4, -D / 2 + 1.2, 1.55, 0.6);
      // 키오스크
      for (const s2 of [-1, 1]) {
        const x = s2 * (W / 2 - 1.2), z = -D / 2 + 5.5;
        box(k2.g, 0.8, 2.0, 0.4, '#212121', x, 1.0, z);
        const scr = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#80d8ff' }));
        scr.scale.set(0.6, 0.9, 1); scr.position.set(x, 1.4, z + 0.21); k2.g.add(scr);
        k2.col(x, z, 0.45, 0.25);
      }
    } });
  },
  bunsik(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#f06292', counterTop: '#ffffff', table: '#ffffff', chair: '#f48fb1', round: false, emoji: '🍢', menuText: '떡볶이 · 라면 · 김밥 · 어묵 · 튀김', board: '#ad1457', kitchen: (k2) => {
      // 떡볶이 철판
      box(k2.g, 2.4, 1.0, 1.2, '#b0bec5', -W / 2 + 2.2, 0.5, -D / 2 + 1.2);
      box(k2.g, 2.2, 0.08, 1.0, '#d32f2f', -W / 2 + 2.2, 1.05, -D / 2 + 1.2);
      for (let i = 0; i < 10; i++) box(k2.g, 0.25, 0.08, 0.08, '#ff7043', -W / 2 + 1.3 + (i % 5) * 0.4, 1.12, -D / 2 + 0.9 + Math.floor(i / 5) * 0.5, { cast: false });
      bubbles(k2, -W / 2 + 2.2, 1.1, -D / 2 + 1.2, '#ef5350');
      k2.col(-W / 2 + 2.2, -D / 2 + 1.2, 1.25, 0.65);
      // 어묵 국물통
      box(k2.g, 1.4, 1.0, 0.9, '#b0bec5', W / 2 - 2, 0.5, -D / 2 + 1.2);
      for (let i = 0; i < 6; i++) { cyl(k2.g, 0.01, 0.7, '#d7ccc8', W / 2 - 2.5 + i * 0.2, 1.25, -D / 2 + 1.2, { low: true }); box(k2.g, 0.12, 0.25, 0.05, '#ffcc80', W / 2 - 2.5 + i * 0.2, 1.05, -D / 2 + 1.2, { cast: false }); }
      k2.col(W / 2 - 2, -D / 2 + 1.2, 0.75, 0.5);
    } });
  },
  // ---------------- 사격 연습장: 움직이는 과녁 ----------------
  range(k) {
    const { W, D } = k;
    // 사대 (총 쏘는 자리) 칸막이
    box(k.g, W - 2, 1.1, 0.6, '#795548', 0, 0.55, D / 2 - 8);
    box(k.g, W - 2, 0.1, 0.9, '#a1887f', 0, 1.15, D / 2 - 8);
    k.col(0, D / 2 - 8, (W - 2) / 2, 0.35);
    for (let i = 0; i <= 5; i++) box(k.g, 0.12, 2.2, 1.6, '#5d4037', -W / 2 + 1 + i * (W - 2) / 5, 1.1, D / 2 - 7.5, { cast: false });
    k.label('🎯 클릭으로 쏘고, 우클릭으로 조준! 가운데일수록 고득점', '', 0, 3.6, D / 2 - 8.2, 9, '#33691e', '#ffffff');
    k.act('range_start', -3, D / 2 - 5.5);
    k.act('range_rent', 3, D / 2 - 5.5);
    k.w(W / 2 - 2, D / 2 - 5, -Math.PI / 2);
    for (let i = 0; i < 4; i++) k.v(-W / 2 + 3 + i * 4, D / 2 - 6.6, Math.PI);
    // 뒤쪽 흙벽 + 레일
    box(k.g, W, 3.5, 1, '#8d6e63', 0, 1.75, -D / 2 + 0.6, { cast: false });
    for (const z of [5, -5, -12, -20, -26, -31, -35, -9]) box(k.g, W - 2, 0.05, 0.12, '#616161', 0, 0.13, z, { cast: false });
    for (const [z, m] of [[5, 25], [-12, 42], [-26, 56], [-35, 65]]) k.label(`${m}m`, '', -W / 2 + 1.6, 0.6, z, 1.8, '#ffffff', '#33691e', Math.PI / 2);
    // 과녁 (링 텍스처)
    const ringMat = targetMaterial();
    k.targets = [];
    // 사대에서 25m ~ 65m (멀수록 작고 빠르다)
    const defs = [[5, 1.4, 0.8, 0.7, 7], [-5, 1.7, 0.7, 1.0, 9], [-12, 2.0, 0.6, 1.4, 10], [-20, 2.4, 0.55, 1.8, 9], [-26, 1.3, 0.6, 1.1, 10], [-31, 2.8, 0.5, 2.2, 10], [-35, 1.9, 0.45, 2.6, 8], [-9, 3.2, 0.4, 2.8, 9]];
    defs.forEach(([z, y, r, speed, amp], i) => {
      const grp = new THREE.Group(); grp.position.set(0, 0, z); k.g.add(grp);
      const pole = box(grp, 0.08, y, 0.08, '#424242', 0, y / 2, 0);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 28), [toon('#fafafa'), ringMat, toon('#fafafa')]);
      disc.rotation.x = Math.PI / 2; disc.position.y = y; disc.castShadow = false; disc.receiveShadow = false; // 그림자 깜빡임 방지
      grp.add(disc);
      k.targets.push({ id: i, obj: grp, disc, pole, r, y0: y, speed, amp, phase: i * 1.7, up: 1, downT: 0, z });
    });
  },
  // ---------------- 마법봉 공방 ----------------
  magicshop(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, W - 6, '#4527a0', '#b39ddb');
    k.w(0, -D / 2 + 1.8, 0);
    k.act('shop', 0, -D / 2 + 4.3);
    // 마법 물약 선반
    k.shelf(-W / 2 + 0.6, 0, 5, Math.PI / 2, ['#e040fb', '#18ffff', '#ffeb3b', '#ff5722', '#76ff03', '#7c4dff']);
    k.shelf(W / 2 - 0.6, 0, 5, -Math.PI / 2, ['#e040fb', '#18ffff', '#ffeb3b', '#ff5722', '#76ff03', '#7c4dff']);
    // 보글보글 가마솥
    sph(k.g, 0.9, 0.7, 0.9, '#263238', 0, 0.75, 1.5);
    cyl(k.g, 0.85, 0.06, '#7c4dff', 0, 1.3, 1.5, { cast: false });
    bubbles(k, 0, 1.32, 1.5, '#b388ff');
    k.col(0, 1.5, 1, 1);
    // 떠다니는 지팡이
    ['#ff5722', '#4fc3f7', '#ffeb3b', '#a5d6a7', '#9ccc65', '#fff59d', '#7e57c2'].forEach((c, i) => {
      const x = -W / 2 + 2 + i * ((W - 4) / 6);
      const st = new THREE.Group(); st.position.set(x, 2.8, -D / 2 + 0.6); k.g.add(st);
      cyl(st, 0.04, 1.0, '#5d4037', 0, 0, 0, { low: true });
      sph(st, 0.12, 0.12, 0.12, toon(c, { emissive: c, emissiveIntensity: 0.9 }), 0, 0.55, 0, { low: true });
      k.anim.push({ type: 'bob', obj: st, base: 2.8 + (i % 2) * 0.3 });
    });
    k.label('반짝 마법봉 공방 · 속성 지팡이 전문', '🪄', 0, 4.2, -D / 2 + 0.2, 7, '#311b92', '#ffeb3b');
    k.v(-3, 3, Math.PI); k.v(3, 0, Math.PI); k.v(-2, -1, 0);
  },
  // ---------------- 자동차 쇼룸 ----------------
  dealer(k) {
    const { W, D } = k;
    const show = [['sport_l', '#c0ca33', -8, -3, 0.6], ['sport_b', '#1e88e5', 0, -4, 0], ['sport_f', '#e53935', 8, -3, -0.6], ['ev', '#eceff1', -7, 3, 0.9], ['jeep', '#ff7043', 7, 3, -0.9]];
    for (const [kind, color, x, z, ry] of show) {
      const m = makeCarMesh(kind, color);
      m.g.position.set(x, 0.1, z); m.g.rotation.y = ry;
      cyl(k.g, 3, 0.1, '#bdbdbd', x, 0.12, z, { cast: false });
      k.g.add(m.g);
      k.anim.push({ type: 'spin', obj: m.g, axis: 'y', speed: 0.3 });
      k.col(x, z, 2.2, 2.2);
    }
    k.counter(0, D / 2 - 4, 5, '#212121', '#eceff1');
    k.w(0, D / 2 - 5, Math.PI);
    k.act('dealer', 0, D / 2 - 2.8);
    k.label('BAKWI MOTORS · 드림카를 만나보세요', '🏎️', 0, 4.2, -D / 2 + 0.2, 8, '#212121', '#ff1744');
    k.v(-3, 0, 0); k.v(3, 1, Math.PI); k.v(-10, 0, Math.PI / 2);
  },
  // ---------------- 교도소: 감방 ----------------
  prison(k) {
    const { W, D } = k;
    k.cells = [];
    // 뒤쪽에 감방 4칸 — 칸끼리 벽을 공유해 빈틈이 없고, 철창은 벽 끝까지 이어진다
    const cw = (W - 2) / 4, z0 = -D / 2, z1 = -D / 2 + 6.4, x0 = -W / 2 + 1;
    for (let i = 0; i <= 4; i++) {
      const wx = x0 + i * cw;
      box(k.g, 0.25, 4, 6.4, '#78909c', wx, 2, z0 + 3.2);
      k.col(wx, z0 + 3.2, 0.2, 3.2);
    }
    // 바깥 벽과 감방 사이 틈도 막는다
    box(k.g, 1, 4, 0.25, '#78909c', -W / 2 + 0.5, 2, z1); box(k.g, 1, 4, 0.25, '#78909c', W / 2 - 0.5, 2, z1);
    k.col(0, z1, W / 2, 0.2);
    for (let i = 0; i < 4; i++) {
      const cx = x0 + cw * (i + 0.5);
      const z = z0 + 3.2;
      const nb = Math.round(cw / 0.5);
      for (let b = 0; b <= nb; b++) box(k.g, 0.08, 4, 0.08, '#37474f', cx - cw / 2 + b * (cw / nb), 2, z1);
      box(k.g, cw, 0.15, 0.15, '#37474f', cx, 3.9, z1);
      // 침대 + 변기
      box(k.g, 1.2, 0.5, 2.4, '#8d6e63', cx - 1.8, 0.35, z - 1.5); box(k.g, 1.1, 0.15, 2.3, '#e0e0e0', cx - 1.8, 0.65, z - 1.5);
      cyl(k.g, 0.35, 0.6, '#fafafa', cx + 2, 0.4, z - 2.2);
      // rect: 수감자가 절대 벗어나지 못하는 칸 안쪽 영역
      k.cells.push({ x: cx, z: z + 0.5, rect: { minX: cx - cw / 2 + 0.6, maxX: cx + cw / 2 - 0.6, minZ: z0 + 0.6, maxZ: z1 - 0.6 } });
      k.v(cx + 0.5, z, 0);
    }
    // 간수 책상
    k.counter(W / 2 - 4, D / 2 - 5, 3, '#455a64', '#cfd8dc');
    k.w(W / 2 - 4, D / 2 - 6, 0);
    k.label('젤리 교도소 · 반성하는 시간', '🔒', 0, 4.6, -D / 2 + 0.2, 7, '#263238', '#ffffff');
    k.act('visit', -W / 2 + 3, D / 2 - 3);
  },
  // ---------------- 사냥꾼 오두막 ----------------
  hunter(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, W - 6, '#5d4037', '#a1887f');
    k.w(0, -D / 2 + 1.8, 0);
    k.act('shop', -2.5, -D / 2 + 4.3);
    k.act('sell', 2.5, -D / 2 + 4.3);
    // 벽에 걸린 사슴머리·가죽
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 3 + i * ((W - 6) / 2);
      sph(k.g, 0.35, 0.4, 0.3, '#b07945', x, 3.6, -D / 2 + 0.5);
      for (const s of [-1, 1]) cyl(k.g, 0.05, 0.9, '#efebe9', x + s * 0.3, 4.2, -D / 2 + 0.5, { rz: s * -0.5 });
    }
    box(k.g, 2.6, 2, 0.1, '#6d4c41', -W / 2 + 0.3, 2.4, 0, { ry: Math.PI / 2 });
    box(k.g, 2.2, 1.6, 0.12, '#ff8f00', -W / 2 + 0.36, 2.4, 0, { ry: Math.PI / 2 });
    for (let i = 0; i < 4; i++) box(k.g, 0.06, 0.06, 1.6, '#212121', -W / 2 + 0.4, 1.8 + i * 0.4, 3, { ry: 0.2 });
    // 벽난로
    box(k.g, 2.4, 2.6, 1, '#8d8d8d', W / 2 - 1, 1.3, 0); k.col(W / 2 - 1, 0, 0.6, 1.2);
    sph(k.g, 0.5, 0.5, 0.3, toon('#ff9100', { emissive: '#ff6d00', emissiveIntensity: 1 }), W / 2 - 1.4, 0.6, 0, { low: true });
    k.rug(0, 1.5, 4, 3, '#a1887f');
    k.v(-2, 2, Math.PI); k.v(2, 1, 0);
  },
  fishing(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, W - 6, '#0277bd', '#e1f5fe');
    k.w(0, -D / 2 + 1.8, 0);
    k.act('shop', -2.5, -D / 2 + 4.3); k.act('sell', 2.5, -D / 2 + 4.3);
    for (let i = 0; i < 8; i++) cyl(k.g, 0.04, 3, ['#c8a165', '#37474f', '#ffd54f'][i % 3], -W / 2 + 0.5, 1.6, -3 + i * 0.7, { rz: 0.12, low: true });
    box(k.g, 2.6, 1.4, 1, '#81d4fa', W / 2 - 1.6, 0.7, 1); k.col(W / 2 - 1.6, 1, 1.3, 0.5);
    k.label('오늘의 대물: 참치 1.2m!', '🐟', 0, 4, -D / 2 + 0.2, 6, '#0277bd', '#ffffff');
    k.v(-2, 2, Math.PI); k.v(2, 1, 0);
  },
  seafood(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#d84315', counterTop: '#fff3e0', table: '#d7b98e', chair: '#8d6e63', round: false, emoji: '🍲', menuText: '매운탕 정식 · 모둠회 · 가져온 물고기 요리해 드려요', board: '#bf360c', kitchen: (k2) => {
      // 수족관 + 큰 솥
      const tank = new THREE.Mesh(G.box(), new THREE.MeshToonMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.5 }));
      tank.scale.set(4, 1.6, 1); tank.position.set(-W / 2 + 2.8, 1.3, -D / 2 + 1); k2.g.add(tank);
      for (let i = 0; i < 5; i++) { const f = sph(k2.g, 0.25, 0.12, 0.07, ['#ff7043', '#90a4ae', '#ffca28'][i % 3], -W / 2 + 1.4 + i * 0.7, 1 + (i % 2) * 0.5, -D / 2 + 1); k2.anim.push({ type: 'bob', obj: f, base: 1 + (i % 2) * 0.5 }); }
      cyl(k2.g, 0.8, 0.9, '#263238', W / 2 - 2, 0.75, -D / 2 + 1.2); bubbles(k2, W / 2 - 2, 1.22, -D / 2 + 1.2, '#ff7043');
    } });
    k.act('cook_spicy', -3, -D / 2 + 4.3); k.act('cook_raw', 3, -D / 2 + 4.3);
  },
  ranch(k) {
    const { W, D } = k;
    LAYOUTS.diner(k, { counter: '#c62828', counterTop: '#fff8e1', table: '#d7b98e', chair: '#c62828', round: false, emoji: '🐄', menuText: '목장 우유 · 수제 치즈 · 한우 스테이크 · 소프트아이스크림', board: '#33691e', kitchen: (k2) => {
      for (let i = 0; i < 3; i++) cyl(k2.g, 0.4, 1.1, '#cfd8dc', -W / 2 + 2 + i * 1, 0.55, -D / 2 + 1.2);
      box(k2.g, 2.4, 2.2, 1, '#eceff1', W / 2 - 1.6, 1.1, -D / 2 + 1);
    } });
  },
  // 아파트·빌라 우리 집 (호수)
  unit(k, ctx) {
    const { W, D } = k;
    LAYOUTS.house(k, ctx);
    // 현관 신발장 & 베란다
    box(k.g, 2.4, 1.2, 0.6, '#d7ccc8', -W / 2 + 1.6, 0.6, D / 2 - 0.5); k.col(-W / 2 + 1.6, D / 2 - 0.5, 1.2, 0.35);
    box(k.g, W - 4, 0.12, 0.12, '#ffffff', 0, 1.1, -D / 2 + 0.3, { cast: false });
    k.label(`${ctx.unit || ''} 우리 집`, '🔑', 3.5, 3.8, -D / 2 + 0.2, 3, '#fffaf3', '#5d4037');
  },
  villa(k) {
    const { W, D } = k;
    // 우편함
    for (let i = 0; i < 8; i++) box(k.g, 0.6, 0.5, 0.35, '#b0bec5', -W / 2 + 1.2 + (i % 4) * 0.65, 1.4 + Math.floor(i / 4) * 0.55, -D / 2 + 0.35);
    k.col(-W / 2 + 2.2, -D / 2 + 0.35, 1.4, 0.3);
    // 계단
    for (let i = 0; i < 6; i++) box(k.g, 2.4, 0.3 * (i + 1), 0.6, '#cfd8dc', W / 2 - 2, 0.15 * (i + 1), -D / 2 + 1 + i * 0.6);
    k.col(W / 2 - 2, -D / 2 + 2.5, 1.25, 1.8);
    k.label('계단은 각 층 호수로 · 열쇠가 있으면 우리 집으로!', '🏘️', -1, 3.6, -D / 2 + 0.2, 5, '#ffffff', '#455a64');
    k.plant(-W / 2 + 0.8, D / 2 - 0.8, 0.8);
    k.sofa(-2, 2, 0, '#b0bec5');
    k.v(-2, 3.2, Math.PI); k.v(1, 0, 0); k.v(-W / 2 + 2, 1, Math.PI / 2);
  },
  cafe(k) {
    const { W, D } = k;
    k.counter(-1, -D / 2 + 2.4, 5, '#6d4c41', '#d7ccc8');
    box(k.g, 1.2, 0.8, 0.7, '#b0bec5', -2.5, 1.6, -D / 2 + 2.4);
    k.label('MENU ☕ 아메리카노 · 솜사탕 라떼', '', 0, 3.2, -D / 2 + 0.2, 6, '#3e2723', '#ffffff');
    k.w(-1, -D / 2 + 1.3, 0);
    k.act('coffee', -2, -D / 2 + 3.6); k.act('dessert', 0.3, -D / 2 + 3.6); k.act('buy_coffee', 2.2, -D / 2 + 3.2);
    k.table(W / 2 - 2.5, 0, '#efebe9', 2, '#a1887f'); k.v(W / 2 - 3.9, 0, -Math.PI / 2 + Math.PI); k.v(W / 2 - 1.1, 0, -Math.PI / 2);
    k.table(-W / 2 + 2.5, 2, '#efebe9', 2, '#a1887f'); k.v(-W / 2 + 1.1, 2, Math.PI / 2);
    k.sofa(W / 2 - 3, D / 2 - 1.6, Math.PI, '#8d6e63'); k.v(W / 2 - 3, D / 2 - 2.6, Math.PI);
    k.plant(-W / 2 + 1, -D / 2 + 1);
    k.frame(-W / 2 + 0.2, 2.5, 0, 1.4, 1.0, Math.PI / 2);
  },
  bakery(k) {
    const { W, D } = k;
    box(k.g, W - 4, 1.0, 1.2, '#ffffff', 0, 0.5, -D / 2 + 3);
    const glass = new THREE.Mesh(G.box(), new THREE.MeshToonMaterial({ color: '#e1f5fe', transparent: true, opacity: 0.4 }));
    glass.scale.set(W - 4, 0.8, 1.2); glass.position.set(0, 1.4, -D / 2 + 3); k.g.add(glass);
    for (let i = 0; i < 10; i++) sph(k.g, 0.35, 0.22, 0.25, k.rng.pick(['#e0a050', '#d4883a', '#f5c27a', '#a0522d']), -W / 2 + 2.8 + i * ((W - 5.6) / 9), 1.15, -D / 2 + 3, { low: true });
    k.col(0, -D / 2 + 3, (W - 4) / 2, 0.7);
    box(k.g, 2.4, 2.2, 1.2, '#795548', -W / 2 + 2, 1.1, -D / 2 + 0.8);
    box(k.g, 1.6, 0.8, 0.1, '#ff7043', -W / 2 + 2, 1.2, -D / 2 + 1.42);
    k.w(0, -D / 2 + 1.8, 0); k.w(-W / 2 + 2, -D / 2 + 2.2, Math.PI);
    k.act('bread', -1.5, -D / 2 + 4.3); k.act('buy_bread', 1.5, -D / 2 + 4.3);
    k.table(0, 2.5, '#fff8e1', 2, '#ffcc80'); k.v(-1.3, 2.5, Math.PI / 2); k.v(1.3, 2.5, -Math.PI / 2);
    k.shelf(W / 2 - 0.6, 1, 4, -Math.PI / 2, ['#e0a050', '#d4883a', '#f5c27a']);
  },
  supermarket(k) {
    const { W, D } = k;
    for (let i = 0; i < 4; i++) {
      const x = -W / 2 + 5 + i * 4.2;
      k.shelf(x, -1.5, 5, Math.PI / 2);
      k.v(x + 1.3, -1.5 + k.rng.range(-1.5, 1.5), -Math.PI / 2);
    }
    k.shelf(0, -D / 2 + 0.6, W - 2, 0);
    for (let i = 0; i < 2; i++) {
      const x = W / 2 - 3 - i * 3.5;
      k.counter(x, D / 2 - 3.5, 2, '#43a047', '#ffffff');
      k.w(x, D / 2 - 4.6, Math.PI);
    }
    k.act('groceries', W / 2 - 4.7, D / 2 - 2.2);
    k.w(-W / 2 + 2, D / 2 - 2, Math.PI / 2);
    k.v(-W / 2 + 3, 3, Math.PI);
    k.label('신선 과일 코너', '🥬', 0, 3.4, -D / 2 + 0.2, 5, '#43a047', '#ffffff');
  },
  convenience(k) {
    const { W, D } = k;
    k.shelf(-1.5, 0.5, 4, Math.PI / 2); k.shelf(1.5, 0.5, 4, Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      box(k.g, 1.4, 2.6, 0.9, '#e3f2fd', -W / 2 + 1.5 + i * 1.5, 1.3, -D / 2 + 0.6);
      for (let j = 0; j < 3; j++) box(k.g, 1.2, 0.05, 0.6, '#ffffff', -W / 2 + 1.5 + i * 1.5, 0.6 + j * 0.7, -D / 2 + 1.0, { cast: false });
    }
    k.col(-W / 2 + 3, -D / 2 + 0.6, 2.3, 0.5);
    k.counter(W / 2 - 2, D / 2 - 3.4, 2.6, '#1e88e5', '#ffffff');
    k.w(W / 2 - 2, D / 2 - 4.5, Math.PI);
    k.act('order', W / 2 - 2, D / 2 - 2.2); k.act('shop', -W / 2 + 2, D / 2 - 2.5);
    // 전자레인지 & 먹고 가는 창가 테이블
    box(k.g, 1.6, 1.0, 0.8, '#eceff1', W / 2 - 1.0, 0.5, -1.5); box(k.g, 0.9, 0.55, 0.6, '#cfd8dc', W / 2 - 1.0, 1.28, -1.5);
    const mw = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#263238' })); mw.scale.set(0.55, 0.35, 1); mw.rotation.y = -Math.PI / 2; mw.position.set(W / 2 - 1.31, 1.28, -1.5); k.g.add(mw);
    k.col(W / 2 - 1.0, -1.5, 0.85, 0.45);
    k.act('microwave', W / 2 - 2.3, -1.5);
    box(k.g, 4.0, 0.12, 0.7, '#ffffff', -W / 2 + 2.5, 1.1, D / 2 - 1.0); k.col(-W / 2 + 2.5, D / 2 - 1.0, 2.0, 0.4);
    k.seat(-W / 2 + 1.6, D / 2 - 2.0, 0); k.seat(-W / 2 + 3.4, D / 2 - 2.0, 0);
    k.v(0, -2, Math.PI); k.v(-3, 2, -Math.PI / 2); k.v(3, 1, Math.PI / 2);
  },
  bank(k) {
    const { W, D } = k;
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 5 + i * 4.5;
      k.counter(x, -D / 2 + 3, 3.4, '#5d4037', '#ffd54f');
      box(k.g, 3.4, 1.0, 0.05, '#e1f5fe', x, 1.75, -D / 2 + 3, { cast: false });
      k.w(x, -D / 2 + 2, 0);
      k.v(x, -D / 2 + 4.3, Math.PI);
    }
    k.label('젤리 중앙은행', '🏦', 0, 3.6, -D / 2 + 0.2, 5, '#1a237e', '#ffd54f');
    // 금고
    cyl(k.g, 2.0, 0.5, '#9e9e9e', W / 2 - 3, 2.2, -D / 2 + 0.6, { rx: Math.PI / 2 });
    cyl(k.g, 0.6, 0.6, '#ffd54f', W / 2 - 3, 2.2, -D / 2 + 0.8, { rx: Math.PI / 2 });
    for (let i = 0; i < 4; i++) box(k.g, 0.8, 0.4, 0.4, '#ffd54f', W / 2 - 4 + (i % 2) * 0.9, 0.2 + Math.floor(i / 2) * 0.4, -D / 2 + 2);
    k.col(W / 2 - 3, -D / 2 + 1, 2, 1);
    k.act('interest', -W / 2 + 5, -D / 2 + 4.3);
    for (let i = 0; i < 4; i++) k.chair(-2 + i * 1.3, 3, Math.PI, '#90a4ae');
    k.v(-1, 2, Math.PI); k.v(3, 3, Math.PI);
    k.desk(W / 2 - 3, 3, Math.PI); k.w(W / 2 - 3, 2, 0);
    k.plant(-W / 2 + 1, D / 2 - 1);
  },
  office(k) {
    const { W, D } = k;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x = -W / 2 + 4 + c * ((W - 8) / 3), z = -D / 2 + 3 + r * 4;
      k.desk(x, z, 0);
      box(k.g, 2.4, 1.4, 0.08, '#b0bec5', x, 0.7, z - 0.65);
      k.w(x, z + 1.0, Math.PI);
    }
    k.label('스프린트 마감 D-1', '💼', 0, 3.5, -D / 2 + 0.2, 5, '#263238', '#ffffff');
    k.sofa(W / 2 - 2.5, D / 2 - 2, Math.PI, '#4db6ac');
    box(k.g, 1, 1.6, 0.8, '#eceff1', -W / 2 + 1.2, 0.8, D / 2 - 2);
    k.col(-W / 2 + 1.2, D / 2 - 2, 0.5, 0.4);
    k.v(-W / 2 + 2.4, D / 2 - 2, -Math.PI / 2); k.v(W / 2 - 2.5, D / 2 - 3, Math.PI); k.v(0, D / 2 - 2.5, Math.PI);
    k.act('pantry', -W / 2 + 2.4, D / 2 - 3.2);
    k.plant(W / 2 - 1, -D / 2 + 1); k.plant(-W / 2 + 1, -D / 2 + 1);
  },
  tvstation(k, ctx) {
    const { W, D } = k;
    box(k.g, 6, 1.1, 1.6, '#5e35b1', 0, 0.55, -D / 2 + 3);
    box(k.g, 6.2, 0.12, 1.8, '#ffffff', 0, 1.15, -D / 2 + 3);
    k.col(0, -D / 2 + 3, 3.1, 0.9);
    const bg = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#4fc3f7' }));
    bg.scale.set(10, 4, 1); bg.position.set(0, 2.6, -D / 2 + 0.2); k.g.add(bg);
    k.label('JBC 9시 뉴스', '📺', 0, 2.8, -D / 2 + 0.25, 5, '#311b92', '#ffffff');
    k.w(-1.2, -D / 2 + 2, 0); k.w(1.2, -D / 2 + 2, 0);
    for (const s of [-1, 1]) {
      const cam = new THREE.Group(); cam.position.set(s * 3, 0, 2); k.g.add(cam);
      cyl(cam, 0.08, 1.4, '#212121', 0, 0.7, 0, { low: true });
      box(cam, 0.7, 0.6, 1.2, '#424242', 0, 1.6, 0);
      k.col(s * 3, 2, 0.5, 0.6);
      k.w(s * 3, 3.2, Math.PI);
      cyl(k.g, 0.07, 4, '#9e9e9e', s * (W / 2 - 1.5), 2, -D / 2 + 1.5, { low: true });
      const light = sph(k.g, 0.5, 0.4, 0.5, toon('#fff9c4', { emissive: '#fff59d', emissiveIntensity: 0.8 }), s * (W / 2 - 1.5), 4.1, -D / 2 + 1.5);
      void light;
    }
    for (let i = 0; i < 6; i++) k.chair(-W / 2 + 4 + i * 1.6, D / 2 - 2, Math.PI, '#9575cd');
    k.act('show', 0, D / 2 - 3.2);
    k.v(-3, D / 2 - 3, Math.PI); k.v(3, D / 2 - 3, Math.PI); k.v(0, 0, Math.PI);
    void ctx;
  },
  library(k) {
    const { W, D } = k;
    for (let i = 0; i < 5; i++) k.shelf(-W / 2 + 3 + i * 2.6, -D / 2 + 3, 4.5, Math.PI / 2, ['#8d6e63', '#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a']);
    for (let i = 0; i < 5; i++) k.v(-W / 2 + 4.3 + i * 2.6, -D / 2 + 3, -Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const x = W / 2 - 4 - i * 5;
      box(k.g, 3.4, 0.12, 1.6, '#a1887f', x, 1.0, 2.5);
      box(k.g, 0.1, 1, 1.4, '#6d4c41', x, 0.5, 2.5);
      k.chair(x - 0.8, 3.7, Math.PI, '#8d6e63'); k.chair(x + 0.8, 3.7, Math.PI, '#8d6e63');
      k.col(x, 2.5, 1.7, 0.8);
      k.v(x, 3.6, Math.PI);
      sph(k.g, 0.25, 0.25, 0.25, toon('#fff59d', { emissive: '#ffeb3b', emissiveIntensity: 0.5 }), x + 1.2, 1.4, 2.3, { low: true });
    }
    k.act('read', W / 2 - 6.5, 4.2);
    k.counter(-W / 2 + 3, D / 2 - 3, 3, '#6d4c41', '#d7ccc8');
    k.w(-W / 2 + 3, D / 2 - 4, Math.PI);
    k.label('조용히 해주세요', '📚', 0, 4.2, -D / 2 + 0.2, 4, '#4e342e', '#fff8e1');
  },
  bookstore(k) {
    const { W, D } = k;
    k.shelf(0, -D / 2 + 0.6, W - 2, 0, ['#8d6e63', '#c62828', '#1565c0', '#2e7d32', '#f9a825']);
    k.shelf(-W / 2 + 0.6, 1, 5, Math.PI / 2, ['#8d6e63', '#c62828', '#1565c0']);
    for (let i = 0; i < 2; i++) {
      const x = -1.5 + i * 3;
      box(k.g, 2, 0.9, 1.4, '#a1887f', x, 0.45, -0.5);
      for (let j = 0; j < 5; j++) box(k.g, 0.6, 0.12, 0.8, k.rng.pick(['#ef5350', '#42a5f5', '#66bb6a', '#ffca28']), x - 0.6 + (j % 3) * 0.6, 0.96 + Math.floor(j / 3) * 0.12, -0.5);
      k.col(x, -0.5, 1, 0.7);
      k.v(x, 0.6, Math.PI);
    }
    k.counter(W / 2 - 2, D / 2 - 3, 2.4, '#6d4c41');
    k.w(W / 2 - 2, D / 2 - 4, Math.PI);
    k.act('buy_book', W / 2 - 2, D / 2 - 1.9);
    k.v(-W / 2 + 2, 2, -Math.PI / 2);
  },
  museum(k) {
    const { W, D } = k;
    // 거대 곰돌이 조상 화석
    box(k.g, 6, 0.6, 5, '#bcaaa4', 0, 0.3, -2);
    const fossil = new Roach({ color: '#f5ecd7', age: 40 });
    fossil.root.scale.setScalar(1.6); fossil.root.position.set(0, 0.6, -2);
    fossil.root.rotation.y = 0.3;
    k.g.add(fossil.root);
    k.col(0, -2, 3, 2.5);
    k.label('1억 년 전 곰돌이 젤리 조상 (복원)', '🦕', 0, 4.4, -D / 2 + 0.2, 6, '#3e2723', '#ffe082');
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = s * (W / 2 - 3), z = -D / 2 + 3 + i * 4;
      box(k.g, 1.4, 1.1, 1.4, '#efebe9', x, 0.55, z);
      const glass = new THREE.Mesh(G.box(), new THREE.MeshToonMaterial({ color: '#e1f5fe', transparent: true, opacity: 0.35 }));
      glass.scale.set(1.3, 1.2, 1.3); glass.position.set(x, 1.7, z); k.g.add(glass);
      sph(k.g, 0.35, 0.3, 0.35, k.rng.pick(['#ffd54f', '#a1887f', '#80cbc4']), x, 1.45, z, { ico: true });
      k.col(x, z, 0.7, 0.7);
      k.v(x - s * 1.4, z, s * Math.PI / 2);
      k.frame(s * (W / 2 - 0.2), 3, z + 2, 1.6, 1.2, -s * Math.PI / 2);
    }
    k.w(-3, 2, Math.PI); k.w(3, D / 2 - 2.5, Math.PI);
    k.act('exhibit', 0, 1.6);
    k.v(-2, 2.5, 0); k.v(2, 2, Math.PI);
  },
  gallery(k) {
    const { W, D } = k;
    for (let i = 0; i < 4; i++) k.frame(-W / 2 + 2.5 + i * ((W - 5) / 3), 2.6, -D / 2 + 0.2, 2, 1.5);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) k.frame(s * (W / 2 - 0.2), 2.6, -2 + i * 3.5, 2, 1.5, -s * Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const x = -2.5 + i * 5;
      box(k.g, 1, 1.1, 1, '#ffffff', x, 0.55, 0);
      sph(k.g, 0.5, 0.7, 0.5, ['#ff8a65', '#4fc3f7'][i], x, 1.6, 0, { ico: true });
      k.col(x, 0, 0.5, 0.5);
    }
    // 이젤
    const e = new THREE.Group(); e.position.set(W / 2 - 2.5, 0, D / 2 - 3); k.g.add(e);
    for (const s of [-0.4, 0.4]) box(e, 0.08, 2.2, 0.08, '#8d6e63', s, 1.1, 0, { rz: -s * 0.2 });
    box(e, 1.4, 1.1, 0.06, '#ffffff', 0, 1.6, 0.1);
    box(e, 1.0, 0.7, 0.07, '#ffab91', 0, 1.6, 0.12);
    k.col(W / 2 - 2.5, D / 2 - 3, 0.6, 0.4);
    k.w(W / 2 - 2.5, D / 2 - 1.9, Math.PI);
    k.w(-W / 2 + 2, D / 2 - 2, Math.PI / 2);
    k.act('art', 0, -D / 2 + 2.2);
    k.v(-3, -D / 2 + 2, Math.PI); k.v(3, -D / 2 + 2, Math.PI); k.v(-W / 2 + 1.6, 0, -Math.PI / 2); k.v(0, 2.5, 0);
  },
  gym(k) {
    const { W, D } = k;
    for (let i = 0; i < 4; i++) {
      const x = -W / 2 + 3 + i * 3;
      box(k.g, 1.2, 0.3, 2.4, '#212121', x, 0.15, -D / 2 + 2.2);
      box(k.g, 1.2, 1.4, 0.2, '#424242', x, 1.0, -D / 2 + 1.1);
      box(k.g, 1.0, 0.3, 0.5, '#ff1744', x, 1.6, -D / 2 + 1.25);
      k.col(x, -D / 2 + 2.2, 0.6, 1.2);
      k.v(x, -D / 2 + 2.6, 0);
    }
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 3, z = -2 + i * 2.2;
      box(k.g, 1.6, 0.4, 0.7, '#455a64', x, 0.5, z);
      cyl(k.g, 0.05, 2.2, '#b0bec5', x, 1.2, z, { rz: Math.PI / 2 });
      for (const s of [-1, 1]) cyl(k.g, 0.35, 0.15, '#212121', x + s * 1.0, 1.2, z, { rz: Math.PI / 2 });
      k.col(x, z, 1.1, 0.4);
      k.v(x - 1.4, z, Math.PI / 2);
    }
    box(k.g, 6, 3, 0.1, '#b3e5fc', 0, 1.8, -D / 2 + 0.2);
    k.rug(-2, 2, 5, 3, '#ff8a80');
    k.w(-2, 2, Math.PI); k.w(0, D / 2 - 2.5, Math.PI);
    k.act('workout', -W / 2 + 6, 0.5); k.act('gymshower', -W / 2 + 1.6, D / 2 - 2);
    box(k.g, 0.1, 2.4, 2.4, '#80deea', -W / 2 + 3, 1.2, D / 2 - 2);
  },
  salon(k) {
    const { W, D } = k;
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 2.5 + i * 3;
      box(k.g, 1.6, 2, 0.1, '#e1f5fe', x, 2, -D / 2 + 0.2);
      box(k.g, 1.8, 0.1, 0.1, '#f8bbd0', x, 3.05, -D / 2 + 0.22);
      k.chair(x, -D / 2 + 1.8, 0, '#ec407a');
      k.col(x, -D / 2 + 1.8, 0.5, 0.5);
      k.v(x, -D / 2 + 1.8, Math.PI);
      k.w(x + 0.2, -D / 2 + 2.9, Math.PI);
    }
    k.act('haircut', -W / 2 + 4, 0.5);
    k.sofa(W / 2 - 2, 2, -Math.PI / 2, '#f48fb1');
    k.v(W / 2 - 3, 2, Math.PI / 2);
    k.counter(W / 2 - 2.5, -D / 2 + 2, 2, '#ffffff', '#f8bbd0');
    k.w(W / 2 - 2.5, -D / 2 + 1, 0);
    k.label('몽글 펌 50% 할인', '💇', 0, 4.1, -D / 2 + 0.2, 4.5, '#ffffff', '#ad1457');
  },
  clothing(k) {
    const { W, D } = k;
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 3 + i * 3.2;
      box(k.g, 2.6, 0.08, 0.08, '#9e9e9e', x, 2.2, -0.5);
      for (const s of [-1.2, 1.2]) box(k.g, 0.08, 2.2, 0.08, '#9e9e9e', x + s, 1.1, -0.5);
      for (let j = 0; j < 6; j++) box(k.g, 0.12, 1.2, 0.8, k.rng.pick(['#ff80ab', '#80d8ff', '#ffff8d', '#b9f6ca', '#ea80fc', '#ffffff']), x - 1 + j * 0.4, 1.5, -0.5, { cast: false });
      k.col(x, -0.5, 1.3, 0.5);
      k.v(x, 0.7, Math.PI);
    }
    for (let i = 0; i < 2; i++) {
      const m = new Roach({ color: '#eceff1', age: 30, accessories: [i ? 'scarf:#ff4081' : 'beret:#7e57c2'] });
      m.root.position.set(-W / 2 + 2 + i * 2.5, 0, -D / 2 + 1.2);
      k.g.add(m.root);
    }
    box(k.g, 1.8, 2.6, 0.1, '#e1f5fe', W / 2 - 1.5, 1.4, -D / 2 + 0.2);
    k.counter(W / 2 - 2, D / 2 - 3, 2.4, '#8e24aa', '#ffffff');
    k.w(W / 2 - 2, D / 2 - 4, Math.PI); k.w(-1, -D / 2 + 2.2, 0);
    k.act('hat', W / 2 - 2, D / 2 - 1.9);
  },
  hotel(k) {
    const { W, D } = k;
    k.rug(0, 0.5, 6, D - 3, '#ffd54f');
    k.counter(0, -D / 2 + 3, 7, '#5d4037', '#ffd54f');
    k.label('Reception', '🛎️', 0, 3.4, -D / 2 + 0.2, 4, '#8e1d2c', '#ffe082');
    k.w(-1.5, -D / 2 + 2, 0); k.w(1.5, -D / 2 + 2, 0);
    k.act('stay', 0, -D / 2 + 4.3);
    for (const s of [-1, 1]) {
      box(k.g, 2.2, 3.2, 0.2, '#c9a227', s * (W / 2 - 3), 1.6, -D / 2 + 0.2);
      box(k.g, 0.05, 3.2, 0.25, '#8d6e63', s * (W / 2 - 3), 1.6, -D / 2 + 0.25);
      k.sofa(s * (W / 2 - 3), 2, -s * Math.PI / 2, '#8e1d2c');
      k.v(s * (W / 2 - 4.3), 2, s * Math.PI / 2);
    }
    // 샹들리에
    sph(k.g, 1, 0.6, 1, toon('#fff59d', { emissive: '#ffd54f', emissiveIntensity: 0.6 }), 0, 4.6, 0);
    const cart = new THREE.Group(); cart.position.set(-3, 0, 2.5); k.g.add(cart);
    box(cart, 1.4, 0.15, 0.8, '#c9a227', 0, 0.4, 0);
    for (const s of [-0.6, 0.6]) box(cart, 0.06, 2, 0.06, '#c9a227', s, 1.3, 0);
    box(cart, 1.4, 0.06, 0.06, '#c9a227', 0, 2.3, 0);
    box(cart, 0.7, 0.6, 0.5, '#6d4c41', -0.2, 0.8, 0);
    k.col(-3, 2.5, 0.7, 0.4);
    k.w(-3, 3.5, Math.PI);
    k.v(2, 2, Math.PI);
    k.plant(-W / 2 + 1, D / 2 - 1); k.plant(W / 2 - 1, D / 2 - 1);
  },
  cinema(k) {
    const { W, D } = k;
    const scr = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#e3f2fd' }));
    scr.scale.set(W - 6, 3.6, 1); scr.position.set(0, 3, -D / 2 + 0.2); k.g.add(scr);
    scr.userData.tv = 'cartoon'; k.screens.push(scr);
    k.label('상영 중: 꼬물이 대모험', '🎬', 0, 5.2, -D / 2 + 0.25, 6, '#212121', '#ffeb3b');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const x = -W / 2 + 4 + c * ((W - 8) / 5), z = -1 + r * 1.9;
      k.chair(x, z, Math.PI, '#c62828');
      if ((r + c) % 2 === 0) k.v(x, z - 0.1, Math.PI);
    }
    k.col(0, 0.9, (W - 6) / 2, 2.5);
    k.counter(-W / 2 + 3, D / 2 - 2.5, 3, '#d32f2f', '#ffeb3b');
    for (let i = 0; i < 4; i++) sph(k.g, 0.25, 0.25, 0.25, '#fff9c4', -W / 2 + 2 + i * 0.6, 1.4, D / 2 - 2.5, { low: true });
    k.w(-W / 2 + 3, D / 2 - 3.5, Math.PI);
    k.act('movie', W / 2 - 2.5, D / 2 - 2.5);
  },
  concerthall(k) {
    const { W, D } = k;
    box(k.g, W - 4, 1.0, 5, '#6d4c41', 0, 0.5, -D / 2 + 2.6);
    k.col(0, -D / 2 + 2.6, (W - 4) / 2, 2.5);
    box(k.g, W - 4, 4, 0.2, '#880e4f', 0, 3, -D / 2 + 0.2);
    k.label('말랑 오케스트라 정기공연', '🎵', 0, 4.4, -D / 2 + 0.35, 6, '#880e4f', '#ffffff');
    // 피아노
    box(k.g, 2, 1, 1.4, '#212121', -4, 1.5, -D / 2 + 2.2);
    k.w(-4, -D / 2 + 3.4, Math.PI);
    for (let i = 0; i < 4; i++) k.w(-1 + i * 1.8, -D / 2 + 2.6, 0);
    for (const s of [-1, 1]) sph(k.g, 0.5, 0.4, 0.5, toon('#fff59d', { emissive: '#ffeb3b', emissiveIntensity: 0.8 }), s * 4, 4.8, -D / 2 + 4);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
      const x = -W / 2 + 4 + c * ((W - 8) / 5), z = 2 + r * 2;
      k.chair(x, z, Math.PI, '#ad1457');
      if ((r + c) % 2) k.v(x, z - 0.1, Math.PI);
    }
    k.act('concert', W / 2 - 2, D / 2 - 2);
  },
  factory(k) {
    const { W, D } = k;
    // 컨베이어
    for (let l = 0; l < 2; l++) {
      const z = -3 + l * 5;
      box(k.g, W - 8, 1, 1.4, '#546e7a', 0, 0.5, z);
      box(k.g, W - 8, 0.08, 1.2, '#263238', 0, 1.04, z, { cast: false });
      k.col(0, z, (W - 8) / 2, 0.75);
      for (let i = 0; i < 10; i++) {
        const cookie = sph(k.g, 0.3, 0.12, 0.3, '#d4a056', -W / 2 + 5 + i * ((W - 10) / 9), 1.2, z, { low: true });
        cookie.userData.dynamic = true;
        k.anim.push({ type: 'conveyor', obj: cookie, min: -W / 2 + 4.5, max: W / 2 - 4.5, speed: 1.4 });
      }
      for (let i = 0; i < 3; i++) k.w(-W / 2 + 6 + i * ((W - 12) / 2), z + 1.3, Math.PI);
    }
    for (const s of [-1, 1]) {
      box(k.g, 3, 3.4, 3, '#78909c', s * (W / 2 - 2.5), 1.7, -D / 2 + 2.5);
      const gear = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.25, 6, 8), toon('#ffb300'));
      gear.position.set(s * (W / 2 - 2.5), 2.2, -D / 2 + 4.05); k.g.add(gear);
      k.anim.push({ type: 'spin', obj: gear, speed: s * 2 });
      k.col(s * (W / 2 - 2.5), -D / 2 + 2.5, 1.5, 1.5);
    }
    k.w(-W / 2 + 2.5, -D / 2 + 4.8, Math.PI);
    for (let i = 0; i < 6; i++) box(k.g, 1, 1, 1, '#d7a86e', W / 2 - 2 - (i % 2) * 1.1, 0.5 + Math.floor(i / 2), D / 2 - 2.5);
    k.col(W / 2 - 2.5, D / 2 - 2.5, 1.1, 0.6);
    k.label('안전 제일! 과자 생산 라인', '🍪', 0, 4.2, -D / 2 + 0.2, 6, '#ffb300', '#3e2723');
    k.act('tourf', 0, D / 2 - 2.6);
    k.v(-W / 2 + 3, D / 2 - 2, Math.PI);
  },
  construction(k) {
    const { W, D } = k;
    k.desk(0, -D / 2 + 2.2, 0, true, '#8d6e63');
    box(k.g, 1.8, 0.02, 1.0, '#90caf9', 0, 1.07, -D / 2 + 2.2, { cast: false });
    k.w(0, -D / 2 + 3.2, Math.PI);
    for (let i = 0; i < 5; i++) sph(k.g, 0.3, 0.25, 0.3, '#ffca28', -W / 2 + 1.2 + i * 0.7, 1.6, -D / 2 + 0.5, { hemi: true });
    box(k.g, 3.6, 0.1, 0.3, '#8d6e63', -W / 2 + 2.6, 1.55, -D / 2 + 0.4);
    k.label('안전모 필수!', '🚧', 2, 3.2, -D / 2 + 0.2, 3.5, '#212121', '#ffeb3b');
    k.table(W / 2 - 2.2, 1, '#ffe082', 3, '#ffb300');
    k.w(W / 2 - 3.6, 1, Math.PI / 2); k.w(-W / 2 + 1.5, 2, Math.PI / 2);
    k.act('watch', -W / 2 + 2, D / 2 - 1.8);
    k.v(0, 1.5, Math.PI);
  },
  garage(k) {
    const { W, D } = k;
    // 리프트 위 자동차
    for (const s of [-1, 1]) box(k.g, 0.4, 1.6, 4, '#ffca28', -2 + s * 1.4, 0.8, -1);
    const car = new THREE.Group(); car.position.set(-2, 1.6, -1); k.g.add(car);
    box(car, 2, 0.9, 3.8, '#e53935', 0, 0.45, 0);
    box(car, 1.7, 0.75, 2, '#ef5350', 0, 1.25, -0.2);
    for (const sx of [-1, 1]) for (const sz of [-1.2, 1.2]) cyl(car, 0.42, 0.3, '#2b2b2b', sx * 1.0, 0.1, sz, { rz: Math.PI / 2 });
    k.col(-2, -1, 1.8, 2.1);
    k.w(0.2, -1, -Math.PI / 2); k.w(-2, 1.8, Math.PI);
    k.shelf(W / 2 - 0.6, -1, 4, -Math.PI / 2, ['#ef5350', '#9e9e9e', '#ffca28']);
    k.counter(W / 2 - 2.2, D / 2 - 2, 2, '#1565c0', '#ffffff');
    k.w(W / 2 - 2.2, D / 2 - 3, Math.PI);
    k.act('rent', W / 2 - 2.2, D / 2 - 0.9);
    k.v(1, 2, Math.PI);
  },
  flowershop(k) {
    const { W, D } = k;
    for (let i = 0; i < 10; i++) {
      const x = -W / 2 + 1.4 + (i % 5) * ((W - 2.8) / 4), z = i < 5 ? -D / 2 + 1.2 : 0;
      cyl(k.g, 0.4, 0.7, '#90a4ae', x, 0.35, z, { low: true });
      for (let j = 0; j < 4; j++) sph(k.g, 0.25, 0.25, 0.25, k.rng.pick(['#ff4081', '#ffeb3b', '#e040fb', '#ff6e40', '#ffffff', '#ff8a80']), x + k.rng.range(-0.3, 0.3), 0.95 + k.rng.range(0, 0.4), z + k.rng.range(-0.3, 0.3), { ico: true, cast: false });
      k.col(x, z, 0.45, 0.45);
    }
    for (let i = 0; i < 3; i++) k.v(-3 + i * 3, 1.2, Math.PI);
    k.counter(W / 2 - 2, D / 2 - 3, 2.4, '#81c784', '#ffffff');
    k.w(W / 2 - 2, D / 2 - 4, Math.PI); k.w(-2, -D / 2 + 2.2, Math.PI);
    k.act('flower', W / 2 - 2, D / 2 - 1.9);
  },
  realestate(k) {
    const { W, D } = k;
    k.desk(-2.5, -1, 0); k.w(-2.5, -1 + 1.0, Math.PI); k.v(-2.5, -2.4, 0);
    k.desk(2.5, -1, 0); k.w(2.5, 0, Math.PI);
    // 매물 게시판
    box(k.g, 6, 2.4, 0.15, '#e0f2f1', 0, 2.4, -D / 2 + 0.25);
    for (let i = 0; i < 8; i++) {
      const x = -2.4 + (i % 4) * 1.6, y = 3 - Math.floor(i / 4) * 1.1;
      box(k.g, 1.2, 0.8, 0.05, '#ffffff', x, y, -D / 2 + 0.35, { cast: false });
      box(k.g, 0.5, 0.35, 0.06, k.rng.pick(['#ffcc80', '#a5d6a7', '#90caf9']), x, y - 0.1, -D / 2 + 0.36, { cast: false });
    }
    k.label('아늑한 원룸 · 호수 뷰 · 햇살 최고', '🏘️', 0, 4.1, -D / 2 + 0.3, 6, '#00695c', '#ffffff');
    k.sofa(0, D / 2 - 2, Math.PI, '#80cbc4');
    k.act('tour', 0, 1.6);
    k.v(0, D / 2 - 3, Math.PI);
  },
  armory_3k(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 6, '#5d4037', '#ffca28');
    k.label('관우네 병기점 · 의리로 판다', '⚔️', 0, 3.4, -D / 2 + 0.2, 5.5, '#b71c1c', '#ffe082');
    k.w(0, -D / 2 + 2, 0);
    k.act('shop', 0, -D / 2 + 4.3);
    k.wallRack(-W / 2 + 0.3, -1, 6, Math.PI / 2, ['#cfd8dc', '#90caf9', '#ffd54f', '#e1bee7', '#a1887f'], 'sword');
    k.wallRack(W / 2 - 0.3, -1, 6, -Math.PI / 2, ['#4caf50', '#ef5350', '#b0bec5', '#cfd8dc'], 'sword');
    k.mannequin(-3.5, 2, ['armor_legend', 'helm_general']);
    k.mannequin(3.5, 2, ['armor_iron', 'helm_iron']);
    box(k.g, 2.2, 1.2, 1.2, '#424242', W / 2 - 2.5, 0.6, D / 2 - 2.5);
    sph(k.g, 0.6, 0.4, 0.6, toon('#ff7043', { emissive: '#ff3d00', emissiveIntensity: 0.8 }), W / 2 - 2.5, 1.3, D / 2 - 2.5);
    k.col(W / 2 - 2.5, D / 2 - 2.5, 1.1, 0.6);
    k.w(W / 2 - 4, D / 2 - 2.5, Math.PI / 2);
    k.v(0, 3, Math.PI); k.v(-2, 0, Math.PI);
  },
  armory_mil(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 6, '#33401a', '#9e9e7a');
    k.label('전차·헬기는 주문 후 가게 앞에 배송!', '🎖️', 0, 3.4, -D / 2 + 0.2, 6, '#212121', '#c0ca33');
    k.w(0, -D / 2 + 2, 0);
    k.act('shop', 0, -D / 2 + 4.3);
    k.wallRack(-W / 2 + 0.3, -1, 6, Math.PI / 2, ['#455a64', '#37474f', '#263238', '#556b2f'], 'gun');
    k.wallRack(W / 2 - 0.3, -1, 6, -Math.PI / 2, ['#556b2f', '#37474f', '#455a64'], 'gun');
    k.mannequin(-3, 2, ['vest_kevlar', 'kevlar_helmet', 'goggles']);
    for (let i = 0; i < 6; i++) box(k.g, 1, 0.8, 1, '#556b2f', 3 + (i % 3) * 1.05, 0.4 + Math.floor(i / 3) * 0.8, 2.5);
    k.col(4, 2.5, 1.6, 0.6);
    k.v(0, 2.5, Math.PI); k.v(-1, 0, Math.PI);
  },
  armory_sf(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 6, '#eceff1', '#18ffff');
    k.label('포스가 함께하기를', '🌌', 0, 3.4, -D / 2 + 0.2, 5, '#0d1b2a', '#18ffff');
    k.w(0, -D / 2 + 2, 0);
    k.act('shop', 0, -D / 2 + 4.3);
    for (const [x, c] of [[-4, '#40c4ff'], [-2, '#ff1744'], [2, '#76ff03']]) {
      const s = new THREE.Mesh(G.cylLow(), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
      s.scale.set(0.08, 1.6, 0.08); s.position.set(x, 1.9, 0.5); s.rotation.z = 0.3; k.g.add(s);
      box(k.g, 1, 0.8, 1, '#37474f', x, 0.4, 0.5);
      k.col(x, 0.5, 0.5, 0.5);
    }
    k.mannequin(4.5, 1.5, ['mando_armor', 'storm_helmet']);
    k.mannequin(-W / 2 + 1.5, 3, ['jedi_robe']);
    k.v(0, 3, Math.PI); k.v(-1, -1, Math.PI);
  },
  jeweler(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 5, '#6a1b9a', '#ffd54f');
    k.label('보석을 박으면 무기가 강해져요', '💎', 0, 3.4, -D / 2 + 0.2, 5.5, '#4a148c', '#ffd54f');
    k.w(0, -D / 2 + 2, 0);
    k.act('shop', -1.5, -D / 2 + 4.3); k.act('enchant', 1.5, -D / 2 + 4.3);
    const gems = ['#ff1744', '#2979ff', '#00e676', '#ffd600', '#d500f9', '#e0f7fa', '#424242', '#f8bbd0'];
    k.display(-W / 2 + 2.5, 1, 4, Math.PI / 2, '#4a148c', gems.slice(0, 4));
    k.display(W / 2 - 2.5, 1, 4, -Math.PI / 2, '#4a148c', gems.slice(4));
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), toon('#b2ebf2', { emissive: '#80deea', emissiveIntensity: 0.6 }));
    dia.position.set(0, 1.6, 2); k.g.add(dia);
    box(k.g, 0.8, 1.0, 0.8, '#ffd54f', 0, 0.5, 2); k.col(0, 2, 0.4, 0.4);
    k.anim.push({ type: 'spin', obj: dia, speed: 1.5, axis: 'y' });
    k.v(-2, 3.5, Math.PI); k.v(2, 3.5, Math.PI);
  },
  hatshop(k) {
    const { W, D } = k;
    k.counter(W / 2 - 2.5, D / 2 - 3, 2.6, '#6d4c41', '#ffe0b2');
    k.w(W / 2 - 2.5, D / 2 - 4, Math.PI);
    k.act('shop', W / 2 - 2.5, D / 2 - 1.9);
    k.label('모자 하나로 매력 UP!', '🎩', 0, 3.4, -D / 2 + 0.2, 5, '#3e2723', '#ffe0b2');
    const hats = [['top'], ['cowboy'], ['crown'], ['wizard'], ['pirate'], ['flowercrown']];
    hats.forEach((h, i) => k.mannequin(-W / 2 + 2 + i * ((W - 4) / 5), -D / 2 + 1.6, h));
    k.v(-2, 1, Math.PI); k.v(2, 1.5, Math.PI); k.w(-W / 2 + 2, 1, Math.PI / 2);
  },
  eyewear(k) {
    const { W, D } = k;
    k.counter(0, -D / 2 + 3, 5, '#ffffff', '#81d4fa');
    k.w(0, -D / 2 + 2, 0);
    k.act('shop', 0, -D / 2 + 4.3);
    k.label('눈부시게 멋있게', '🕶️', 0, 3.4, -D / 2 + 0.2, 4, '#0277bd', '#ffffff');
    k.mannequin(-W / 2 + 2, 1, ['goldshades', 'tuxedo']);
    k.mannequin(W / 2 - 2, 1, ['heartglasses', 'dress:#f06292']);
    k.display(0, 2.5, 4, 0, '#0277bd', ['#212121', '#ff4f81', '#ffeb3b', '#ffca28']);
    k.v(-2, 0.5, Math.PI); k.v(2, 0.5, Math.PI);
  },
  club(k) {
    const { W, D } = k;
    // 댄스 플로어 (번쩍이는 타일)
    const cols = ['#ff4081', '#18ffff', '#ffea00', '#7c4dff', '#69f0ae'];
    const mats = cols.map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const dark = new THREE.MeshBasicMaterial({ color: '#2a1a40' });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
      const t = new THREE.Mesh(G.box(), dark);
      t.scale.set(1.9, 0.05, 1.9); t.position.set(-5 + i * 2, 0.12, -2 + j * 2); k.g.add(t);
      k.anim.push({ type: 'disco', obj: t, mats, dark, o: i * 3 + j * 7 });
    }
    // 디스코볼
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshToonMaterial({ color: '#eceff1', emissive: '#b0bec5', emissiveIntensity: 0.4 }));
    ball.position.set(0, 4.6, 1); k.g.add(ball);
    k.anim.push({ type: 'spin', obj: ball, speed: 1.2, axis: 'y' });
    // DJ 부스
    box(k.g, 4, 1.2, 1.4, '#311b92', 0, 0.6, -D / 2 + 2);
    for (const sx of [-1, 1]) cyl(k.g, 0.4, 0.1, '#212121', sx * 0.9, 1.25, -D / 2 + 2);
    for (const sx of [-1, 1]) { box(k.g, 1.4, 2.6, 1.2, '#212121', sx * 4, 1.3, -D / 2 + 1.2); cyl(k.g, 0.45, 0.1, '#616161', sx * 4, 1.8, -D / 2 + 1.85, { rx: Math.PI / 2 }); k.col(sx * 4, -D / 2 + 1.2, 0.7, 0.6); }
    k.col(0, -D / 2 + 2, 2, 0.7);
    k.label('DJ 말랑', '🪩', 0, 3.6, -D / 2 + 0.2, 4, '#120a24', '#ff4081');
    k.w(0, -D / 2 + 1.1, 0);
    // 바
    k.counter(W / 2 - 1.2, 1, 1.2, '#4a148c', '#ffd54f', 6);
    k.w(W / 2 - 0.5, 1, -Math.PI / 2);
    k.act('cocktail', W / 2 - 2.6, 1);
    k.act('dance', 0, 1);
    k.sofa(-W / 2 + 1.6, 3, Math.PI / 2, '#7c4dff');
    for (let i = 0; i < 10; i++) k.v(-4.5 + (i % 5) * 2.2, -1.5 + Math.floor(i / 5) * 3, k.rng.range(0, 6));
    k.v(-W / 2 + 2.6, 3, -Math.PI / 2);
  },
  dojang(k) {
    const { W, D } = k;
    k.label('말랑 도장 — 수련하는 자에게 길이 열린다', '🥋', 0, 4.5, -D / 2 + 0.2, 9, '#212121', '#ffd54f');
    k.w(-4, D / 2 - 5, Math.PI); k.w(4, D / 2 - 5, Math.PI);
    k.act('meditate', 0, D / 2 - 6);
    k.rug(0, D / 2 - 6, 5, 3, '#c62828');
    // ① 점프맵 (보상: 2단 점프) — 일반 점프로 오를 수 있는 0.8씩 높아지는 계단
    const L1 = -24;
    const p1 = [[0, 13], [3, 9], [-1.5, 5], [-4.5, 1], [-1, -3], [3, -6.5], [0, -10.5], [-3.5, -14]];
    p1.forEach(([x, z], i) => k.plat(L1 + x, z, 2.4, 2.4, 0.8 * (i + 1), ['#ffcc80', '#ffab91', '#ce93d8', '#90caf9'][i % 4]));
    k.plat(L1, -19, 4, 3, 7.4, '#ffd54f');
    k.courses.push({ id: 'jump2', name: '점프맵', reward: 'jumpboost', rewardName: '점프력 강화', time: 70, start: { x: L1, z: 18.5 }, goal: { x: L1, z: -19, y: 7.4 }, safeZ: 15.5 });
    k.act('course_jump2', L1, 18.5);
    k.label('① 점프맵 → 2단 점프', '🥋', L1, 3, D / 2 - 0.3, 5, '#ffffff', '#4a3428', Math.PI);
    // ② 고급 점프맵 (보상: 3단 점프) — 2단 점프가 필요한 1.8씩 높아지는 발판
    const L2 = 0;
    const p2 = [[0, 12.5], [3.5, 8], [-0.5, 3.5], [-4, -1], [0, -5.5], [4, -10]];
    p2.forEach(([x, z], i) => k.plat(L2 + x, z, 2.2, 2.2, 1.8 * (i + 1), ['#80cbc4', '#9fa8da', '#f48fb1'][i % 3]));
    k.plat(L2, -16, 4, 3, 12.6, '#ffd54f');
    k.courses.push({ id: 'jump3', name: '고급 점프맵', reward: 'jump3', rewardName: '3단 점프', time: 60, start: { x: L2, z: 18.5 }, goal: { x: L2, z: -16, y: 12.6 }, safeZ: 15.5 });
    k.act('course_jump3', L2, 18.5);
    k.label('② 고급 점프맵 → 3단 점프', '🥋', L2, 3, D / 2 - 0.3, 5, '#ffffff', '#4a3428', Math.PI);
    // ③ 용암 징검다리 (보상: 대쉬)
    const L3 = 24;
    const lava = new THREE.Mesh(G.box(), new THREE.MeshToonMaterial({ color: '#ff6d00', emissive: '#ff3d00', emissiveIntensity: 0.9 }));
    lava.scale.set(16, 0.1, 30); lava.position.set(L3, 0.14, -1); k.g.add(lava);
    k.anim.push({ type: 'lava', obj: lava });
    for (let i = 0; i < 8; i++) {
      const bub = sph(k.g, 0.3, 0.2, 0.3, toon('#ffab00', { emissive: '#ff6d00', emissiveIntensity: 1 }), L3 + k.rng.range(-7, 7), 0.2, k.rng.range(-15, 13), { low: true, cast: false });
      k.anim.push({ type: 'bubble', obj: bub, o: i });
    }
    k.lava.push({ minX: L3 - 8, maxX: L3 + 8, minZ: -16, maxZ: 14 });
    const stones = [[0, 10.5], [2.5, 6], [-1.5, 1.5], [2, -3], [-1, -7.5], [2.5, -12]];
    for (const [x, z] of stones) k.plat(L3 + x, z, 1.6, 1.6, 0.6, '#5d4037');
    k.plat(L3, -18.5, 6, 4, 0.6, '#ffd54f');
    k.courses.push({ id: 'dash', name: '용암 징검다리', reward: 'dashlong', rewardName: '대쉬 거리 강화', time: 50, start: { x: L3, z: 18.5 }, goal: { x: L3, z: -18.5, y: 0.6 }, safeZ: 15, lavaCourse: true });
    k.act('course_dash', L3, 18.5);
    k.label('③ 용암 징검다리 → 대쉬', '🔥', L3, 3, D / 2 - 0.3, 5, '#ffffff', '#4a3428', Math.PI);
    // 목표 깃발
    for (const c of k.courses) {
      cyl(k.g, 0.06, 2.5, '#eceff1', c.goal.x, c.goal.y + 1.25, c.goal.z, { low: true });
      box(k.g, 1.2, 0.7, 0.05, '#e53935', c.goal.x + 0.6, c.goal.y + 2.1, c.goal.z);
    }
    for (let i = 0; i < 6; i++) k.v(-12 + (i % 3) * 12 + 6, D / 2 - 3 - Math.floor(i / 3) * 2, Math.PI);
  },
  lab(k) {
    const { W, D } = k;
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 4 + i * ((W - 8) / 2);
      box(k.g, 3.4, 1.1, 1.4, '#eceff1', x, 0.55, -1);
      box(k.g, 3.5, 0.1, 1.5, '#37474f', x, 1.15, -1);
      for (let j = 0; j < 4; j++) {
        const f = cyl(k.g, 0.15, 0.5, new THREE.MeshToonMaterial({ color: k.rng.pick(['#76ff03', '#00e5ff', '#ff4081', '#ffea00']), emissive: '#222222', transparent: true, opacity: 0.85 }), x - 1.2 + j * 0.8, 1.45, -1, { low: true });
        void f;
      }
      k.col(x, -1, 1.7, 0.7);
      k.w(x, 0.1, Math.PI);
    }
    // 대형 실험 장치
    cyl(k.g, 1.4, 3.6, '#b0bec5', 0, 1.8, -D / 2 + 2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.15, 8, 24), toon('#00e5ff', { emissive: '#00bcd4', emissiveIntensity: 0.8 }));
    ring.position.set(0, 2.2, -D / 2 + 2); ring.rotation.x = Math.PI / 2; k.g.add(ring);
    k.anim.push({ type: 'bob', obj: ring, base: 2.2 });
    k.col(0, -D / 2 + 2, 1.5, 1.5);
    k.label('젤리 탄성 연구실', '🔬', W / 2 - 4, 3.6, -D / 2 + 0.2, 4.5, '#00838f', '#ffffff');
    k.act('experiment', 3, 2.5);
    k.v(-3, 2.5, Math.PI); k.v(0, 3, Math.PI);
    k.w(W / 2 - 2, -D / 2 + 2, 0);
  },
};

function W2(k) { return k.W / 2; }

function roomSize(b, key) {
  if (key === 'range') return [26, 76];
  if (key === 'prison') return [28, 20];
  if (key === 'dealer') return [26, 18];
  if (key === 'unit') return [15, 11];
  if (key === 'villa') return [14, 11];
  if (b.type === 'dojang') return [72, 48];
  if (b.type === 'club') return [22, 16];
  if (b.type === 'house') return [14, 11];
  if (b.type === 'construction') return [12, 10];
  if (b.size === 'S') return [16, 13];
  if (b.size === 'M') return [24, 16];
  return [30, 20];
}

// ------------------------------------------------------------------
export function buildInterior(b, opts = {}) {
  const layoutKey = (b.type === 'apartment' || b.type === 'villa') && opts.isHome ? 'unit' : b.type;
  const [W, D] = roomSize(b, layoutKey);
  const O = new THREE.Vector3(INTERIOR_ORIGIN.x, 0, INTERIOR_ORIGIN.z);
  const group = new THREE.Group();
  group.position.copy(O);
  const rng = new RNG(b.seed);
  const [fk, f1, f2, wallColor] = STYLE[layoutKey] || STYLE.house;

  // 바닥
  const floor = new THREE.Mesh(G.box(), floorMat(fk, f1, f2));
  floor.scale.set(W, 0.2, D); floor.position.y = 0.0; floor.receiveShadow = true;
  group.add(floor);
  // 바깥 바닥 (어두운 테두리)
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(W + 60, D + 60), new THREE.MeshBasicMaterial({ color: '#2a2233' }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.3;
  group.add(outer);

  // 벽 (카메라가 벽 밖에 있으면 숨김)
  const walls = [];
  const mkWall = (w, x, z, ry, normal) => {
    const wg = new THREE.Group(); wg.position.set(x, 0, z); wg.rotation.y = ry;
    group.add(wg);
    box(wg, w, WALL_H, 0.3, wallColor, 0, WALL_H / 2, 0);
    box(wg, w, 1.0, 0.36, shadeHex(wallColor, 0.85), 0, 0.5, 0, { cast: false });
    box(wg, w, 0.2, 0.4, '#ffffff', 0, WALL_H, 0, { cast: false });
    const stub = new THREE.Group(); stub.position.copy(wg.position); stub.rotation.y = ry;
    box(stub, w, 0.7, 0.3, shadeHex(wallColor, 0.85), 0, 0.35, 0, { cast: false });
    stub.visible = false;
    group.add(stub);
    walls.push({ g: wg, stub, normal, point: new THREE.Vector3(x, 0, z).add(O) });
    return wg;
  };
  mkWall(W, 0, -D / 2, 0, new THREE.Vector3(0, 0, 1));
  const front = mkWall(W, 0, D / 2, Math.PI, new THREE.Vector3(0, 0, -1));
  mkWall(D, -W / 2, 0, Math.PI / 2, new THREE.Vector3(1, 0, 0));
  mkWall(D, W / 2, 0, -Math.PI / 2, new THREE.Vector3(-1, 0, 0));
  // 정문 (앞벽 안쪽)
  box(front, 2.6, 3, 0.1, '#5d4037', 0, 1.5, -0.2);
  box(front, 2.2, 2.7, 0.12, '#8d6e63', 0, 1.35, -0.25);
  // 창문 (옆벽)
  for (const wl of walls.slice(2)) {
    const m = windowPlane(wl.g, Math.min(D - 4, 7.8), 2.6, 2.6, 2.6, 'normal');
    m.position.set(0, 2.8, 0.16);
  }

  // 출구 문: 벽이 투명해져도 문틀·문·출구 표시는 항상 보인다
  {
    const dg = new THREE.Group(); dg.position.set(0, 0, D / 2 - 0.25); group.add(dg);
    box(dg, 0.25, 3.1, 0.3, '#5d4037', -1.35, 1.55, 0); box(dg, 0.25, 3.1, 0.3, '#5d4037', 1.35, 1.55, 0); box(dg, 2.95, 0.3, 0.3, '#5d4037', 0, 3.1, 0);
    box(dg, 2.4, 2.9, 0.1, '#a1887f', 0, 1.45, -0.05);
    sph(dg, 0.1, 0.1, 0.1, '#ffd54f', 0.85, 1.4, -0.12, { low: true });
    const ex = signMesh('출구 EXIT', '🚪', 2.4, '#2e7d32', '#ffffff');
    ex.position.set(0, 3.75, -0.1); ex.rotation.y = Math.PI; dg.add(ex);
    const glow = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#b9f6ca', transparent: true, opacity: 0.35 }));
    glow.scale.set(2.4, 2.9, 1); glow.position.set(0, 1.45, -0.12); glow.rotation.y = Math.PI; dg.add(glow);
  }
  // 출구 매트
  const exitMat = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#ffe082' }));
  exitMat.rotation.x = -Math.PI / 2; exitMat.scale.set(2.4, 1.4, 1);
  exitMat.position.set(0, 0.12, D / 2 - 1);
  group.add(exitMat);

  // 조명
  const light = new THREE.PointLight('#fff1d6', 1.1, 0, 0);
  light.position.set(0, 7, 0);
  group.add(light);
  const ambient = new THREE.HemisphereLight('#fff8e7', '#6d5a4a', 0.45);
  group.add(ambient);

  const k = new Kit(group, W, D, rng);
  (LAYOUTS[layoutKey] || LAYOUTS.house)(k, { rng, b, unit: opts.unit });

  // 행동 지점
  const actionsDef = b.type === 'house' || b.type === 'apartment' || b.type === 'villa' ? (opts.isHome ? ACTIONS.home : []) : (ACTIONS[b.type] || []);
  const acts = [];
  for (const a of actionsDef) {
    let spot = k.acts.find((s) => s.id === a.id);
    if (!spot) spot = { x: -2 + acts.length * 2, z: D / 2 - 3 };
    acts.push({ action: a, pos: new THREE.Vector3(spot.x, 0, spot.z).add(O) });
  }
  if (opts.workJob) {
    const ws = k.work[0] || { x: 0, z: 0 };
    acts.push({ action: { id: 'work', label: `💼 일하기 (${opts.workJob.name})`, work: true }, pos: new THREE.Vector3(ws.x, 0, ws.z + 0.01).add(O) });
  }
  // 행동 지점 표시 (빛나는 원)
  const markerMat = new THREE.MeshBasicMaterial({ color: '#ffd54f', transparent: true, opacity: 0.6 });
  const markers = [];
  for (const a of acts) {
    const m = new THREE.Mesh(geoRing(), markerMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(a.pos.x - O.x, 0.14, a.pos.z - O.z);
    group.add(m);
    markers.push(m);
  }

  const toWorld = (s) => ({ p: new THREE.Vector3(s.x, 0.1, s.z).add(O), face: s.face });
  const interior = {
    building: b, group, W, D, origin: O,
    colliders: k.cols.map((c) => ({ minX: c.minX + O.x, maxX: c.maxX + O.x, minZ: c.minZ + O.z, maxZ: c.maxZ + O.z })),
    workSpots: (k.work.length ? k.work : [{ x: 0, z: -D / 2 + 2, face: 0 }]).map(toWorld),
    visitSpots: (k.visit.length ? k.visit : [{ x: 0, z: 0, face: Math.PI }]).map(toWorld),
    actions: acts,
    seats: k.seats.map((st) => ({ p: new THREE.Vector3(st.x, 0.1, st.z).add(O), face: st.face })),
    targets: k.targets || [],
    screens: k.screens,
    cells: (k.cells || []).map((c) => Object.assign(new THREE.Vector3(c.x, 0.1, c.z).add(O), c.rect && { rect: { minX: c.rect.minX + O.x, maxX: c.rect.maxX + O.x, minZ: c.rect.minZ + O.z, maxZ: c.rect.maxZ + O.z } })),
    entry: new THREE.Vector3(0, 0.1, D / 2 - 2).add(O),
    exit: new THREE.Vector3(0, 0.1, D / 2 - 1).add(O),
    bounds: { minX: O.x - W / 2 + 0.6, maxX: O.x + W / 2 - 0.6, minZ: O.z - D / 2 + 0.6, maxZ: O.z + D / 2 - 0.6 },
    platforms: k.platforms.map((p) => ({ minX: p.minX + O.x, maxX: p.maxX + O.x, minZ: p.minZ + O.z, maxZ: p.maxZ + O.z, top: p.top })),
    lava: k.lava.map((p) => ({ minX: p.minX + O.x, maxX: p.maxX + O.x, minZ: p.minZ + O.z, maxZ: p.maxZ + O.z })),
    courses: k.courses.map((c) => ({ ...c, start: new THREE.Vector3(c.start.x + O.x, 0.1, c.start.z + O.z), goal: new THREE.Vector3(c.goal.x + O.x, c.goal.y, c.goal.z + O.z), safeZ: c.safeZ + O.z })),
    update(dt, t, camPos) {
      for (const w of walls) {
        const outside = camPos.clone().sub(w.point).dot(w.normal) < -0.2;
        w.g.visible = !outside; w.stub.visible = outside;
      }
      for (const a of k.anim) {
        if (a.type === 'conveyor') { a.obj.position.x += dt * a.speed; if (a.obj.position.x > a.max) a.obj.position.x = a.min; }
        else if (a.type === 'spin') a.obj.rotation[a.axis || 'z'] += dt * a.speed;
        else if (a.type === 'disco') a.obj.material = Math.floor(t * 3 + a.o) % 3 === 0 ? a.dark : a.mats[Math.floor(t * 2 + a.o) % a.mats.length];
        else if (a.type === 'lava') a.obj.material.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.2;
        else if (a.type === 'bubble') { const p = (t * 0.6 + a.o * 0.37) % 1; a.obj.scale.setScalar(0.1 + p * 0.35); a.obj.position.y = (a.base || 0) + 0.15 + p * 0.25; }
        else if (a.type === 'bob') a.obj.position.y = a.base + Math.sin(t * 2) * 0.4;
      }
      for (const m of markers) m.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
      // 사격장 과녁: 좌우로 움직이고, 맞으면 쓰러졌다가 다시 일어난다
      for (const tg of k.targets || []) {
        tg.obj.position.x = Math.sin(t * tg.speed + tg.phase) * tg.amp;
        if (tg.downT > 0) { tg.downT -= dt; if (tg.downT <= 0) tg.up = 1; }
        const want = tg.up ? 0 : -Math.PI / 2;
        tg.obj.rotation.x += (want - tg.obj.rotation.x) * Math.min(1, dt * 10);
      }
    },
    dispose() {
      group.parent?.remove(group);
      group.traverse((o) => { if (o.isLight) o.dispose?.(); });
    },
  };
  group.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow && true; o.receiveShadow = true; } });
  return interior;
}

let ringG = null;
function geoRing() { return ringG || (ringG = new THREE.RingGeometry(0.5, 0.75, 24)); }

function shadeHex(hex, f) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * f));
  return '#' + c.getHexString();
}

// 과녁 링 무늬
let targetMat = null;
function targetMaterial() {
  if (targetMat) return targetMat;
  if (typeof document === 'undefined') return (targetMat = toon('#e53935'));
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  ['#ffffff', '#e53935', '#ffffff', '#e53935', '#ffffff', '#ffd54f'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(64, 64, 64 - i * 11, 0, Math.PI * 2); x.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (targetMat = new THREE.MeshToonMaterial({ map: t, gradientMap: toonGradient() }));
}

// 냄비·튀김기 보글보글
function bubbles(k, x, y, z, color) {
  for (let i = 0; i < 4; i++) {
    const m = sph(k.g, 0.12, 0.12, 0.12, color, x + (i % 2 ? 0.2 : -0.2), y, z + (i < 2 ? 0.15 : -0.15), { low: true, cast: false });
    k.anim.push({ type: 'bubble', obj: m, o: i, base: y });
  }
}

// 쓰지 않는 import 경고 방지
void roundRect;
