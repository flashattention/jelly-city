// 무늬 그리기 (맵 겉면 · 곰돌이 도장) + 칠할 수 있는 젤리 곰돌이
//   곰돌이는 한 장의 그림(256×256)을 부위별로 나눠 쓴다: 머리 · 몸 · 팔다리 · 귀
import * as THREE from 'three';
import { hex2rgb, rgb2hex } from './maps.js';

// ---------- 무늬 한 칸 (n×n 픽셀 · 이어 붙여도 끊기지 않게) ----------
export function drawTile(x, s, n) {
  const { c, c2, p } = s;
  x.fillStyle = c; x.fillRect(0, 0, n, n);
  x.fillStyle = c2; x.strokeStyle = c2;
  const u = n / 8;
  switch (p) {
    case 'stripe': for (let i = 0; i < 2; i++) x.fillRect(i * n / 2, 0, n / 4, n); break;
    case 'hstripe': for (let i = 0; i < 2; i++) x.fillRect(0, i * n / 2, n, n / 4); break;
    case 'check': x.fillRect(0, 0, n / 2, n / 2); x.fillRect(n / 2, n / 2, n / 2, n / 2); break;
    case 'dot': for (const [a, b] of [[0.25, 0.25], [0.75, 0.75]]) { x.beginPath(); x.arc(a * n, b * n, n * 0.13, 0, 7); x.fill(); } break;
    case 'wave': x.lineWidth = n * 0.14; for (const o of [0.25, 0.75]) { x.beginPath(); for (let i = 0; i <= n; i += 2) x.lineTo(i, o * n + Math.sin((i / n) * Math.PI * 2) * n * 0.1); x.stroke(); } break;
    case 'flower': for (const [a, b] of [[0.25, 0.3], [0.75, 0.8]]) { for (let k = 0; k < 5; k++) { const t = (k / 5) * Math.PI * 2; x.beginPath(); x.arc(a * n + Math.cos(t) * u * 0.9, b * n + Math.sin(t) * u * 0.9, u * 0.62, 0, 7); x.fill(); } x.fillStyle = '#ffe66d'; x.beginPath(); x.arc(a * n, b * n, u * 0.45, 0, 7); x.fill(); x.fillStyle = c2; } break;
    case 'wood': x.lineWidth = n * 0.05; for (let i = 0; i < 4; i++) { x.beginPath(); for (let j = 0; j <= n; j += 2) x.lineTo(j, (i + 0.5) * n / 4 + Math.sin(j * 0.15 + i) * n * 0.025); x.stroke(); } x.fillRect(0, 0, n, n * 0.03); break;
    case 'waffle': x.lineWidth = n * 0.09; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(i * n / 2, 0); x.lineTo(i * n / 2, n); x.moveTo(0, i * n / 2); x.lineTo(n, i * n / 2); x.stroke(); } break;
    case 'doodle': x.lineWidth = n * 0.05; x.lineCap = 'round'; x.beginPath(); x.arc(n * 0.3, n * 0.3, n * 0.12, 0.3, 5.5); x.moveTo(n * 0.55, n * 0.7); x.lineTo(n * 0.68, n * 0.55); x.lineTo(n * 0.8, n * 0.72); x.lineTo(n * 0.92, n * 0.58); x.moveTo(n * 0.1, n * 0.85); x.quadraticCurveTo(n * 0.25, n * 0.65, n * 0.4, n * 0.88); x.stroke(); break;
    case 'brick': x.lineWidth = n * 0.06; for (let r = 0; r < 4; r++) { const y = r * n / 4; x.beginPath(); x.moveTo(0, y); x.lineTo(n, y); x.stroke(); const o = r % 2 ? n / 4 : 0; for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(o + k * n / 2, y); x.lineTo(o + k * n / 2, y + n / 4); x.stroke(); } } break;
    case 'star': for (const [a, b] of [[0.25, 0.3], [0.75, 0.8]]) { x.beginPath(); for (let k = 0; k < 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? n * 0.06 : n * 0.15; x.lineTo(a * n + Math.cos(t) * r, b * n + Math.sin(t) * r); } x.fill(); } break;
    case 'grass': for (let i = 0; i < 26; i++) { const a = ((i * 37) % 100) / 100, b = ((i * 61) % 100) / 100; x.fillRect(a * n, b * n, n * 0.03, n * 0.1); } break;
    case 'leaf': for (let i = 0; i < 9; i++) { const a = ((i * 41) % 100) / 100, b = ((i * 67) % 100) / 100; x.beginPath(); x.ellipse(a * n, b * n, n * 0.11, n * 0.06, i, 0, 7); x.fill(); } break;
    default: break;
  }
}
// 겉면 무늬 그림 (같은 무늬는 한 번만)
const tileCache = new Map();
export function tileCanvas(s, n = 64) {
  const key = `${s.c}|${s.c2}|${s.p}|${n}`;
  if (!tileCache.has(key)) { const c = document.createElement('canvas'); c.width = c.height = n; drawTile(c.getContext('2d'), s, n); tileCache.set(key, c); }
  return tileCache.get(key);
}
// 겉면 무늬 그림의 (u, v) 자리 색 (스포이드): 화면에 그린 색이 아니라 '무늬 그대로의 색'
export function tileColorAt(s, u, v, n = 64) {
  const c = tileCanvas(s, n), x = c.getContext('2d', { willReadFrequently: true });
  const px = Math.floor((((u % 1) + 1) % 1) * n), py = Math.floor((1 - (((v % 1) + 1) % 1)) * n);
  const d = x.getImageData(Math.min(n - 1, px), Math.min(n - 1, py), 1, 1).data;
  return rgb2hex([d[0], d[1], d[2]]);
}

// ---------- 칠할 수 있는 곰돌이 ----------
//   다른 게임과 똑같은 젤리 곰돌이(Roach)를 그대로 쓰고, 피부 부위마다 한 장의 그림(512×512)의 칸을 나눠 준다
//   머리 · 몸은 128px 칸, 귀 · 팔다리 · 배 같은 작은 부위는 64px 칸. 눈 · 코 · 입은 그 자리가 칠해지면 칠한 색을 따라간다(얼굴도 숨기기)
import { Roach } from '../../shared/js/roach.js';
export const ATLAS = 512;
export const REG = { head: 1, body: 1, limb: 1, ear: 1 }; // 부위 묶음 (채우기 · 도장 단추)
export const PART_NAME = { head: '머리', body: '몸', limb: '팔다리', ear: '귀' };
export const BASE = '#ff9ec4';
const SCALE = 0.86;
function remap(g, [rx, ry, rw, rh]) {
  g = g.clone(); const uv = g.attributes.uv; if (!uv) return g;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (rx + u * rw) / ATLAS, 1 - (ry + (1 - v) * rh) / ATLAS); }
  uv.needsUpdate = true; return g;
}
const lightOf = (hex, k) => { const [r, g, b] = hex2rgb(hex); return rgb2hex([r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k]); };

export class Bear {
  constructor(base = BASE, look = null) {
    this.base = base;
    const lk = { ...(look || {}), hat: 0, face: 0, outfit: 0, extra: 0, wings: 0, antenna: 0 }; // 꾸미기 장비는 칠할 수 없어서 뺀다
    this.r = new Roach({ own: false, seed: 'hide' + Math.random(), color: base, age: 25, look: lk, accessories: [] });
    this.root = this.r.root; this.inner = this.r.inner; this.root.scale.setScalar(SCALE);
    for (const w of this.r.wings || []) w.visible = false;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = ATLAS;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshToonMaterial({ map: this.tex, gradientMap: this.r.bodyM.gradientMap || null });
    // 피부(젤리 몸) 부위와 얼굴 · 무늬 같은 나머지
    const skinMats = new Set([this.r.bodyM]); const skins = [], feats = [];
    this.root.updateMatrixWorld(true);
    const under = (o, g) => { for (let x = o; x; x = x.parent) if (g.includes(x)) return true; return false; };
    const limbs = [...(this.r.arms || []), ...(this.r.legs || [])];
    this.root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (skinMats.has(m) || (m && m.color && this.r.bellyM === m)) skins.push(o); else feats.push(o);
    });
    // 칸 나누기: 머리 · 몸 128 (2×2 칸) · 나머지 64
    const used = new Set(), cell = (big) => { const n = big ? 2 : 1; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let ok = x + n <= 8 && y + n <= 8; for (let a = 0; a < n && ok; a++) for (let b = 0; b < n && ok; b++) if (used.has((y + b) * 8 + x + a)) ok = false; if (ok) { for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) used.add((y + b) * 8 + x + a); return [x * 64, y * 64, n * 64, n * 64]; } } return [448, 448, 64, 64]; };
    this.parts = []; this.cells = [];
    skins.sort((a, b) => (b === this.r.headMesh) - (a === this.r.headMesh) || (b === this.r.body) - (a === this.r.body));
    for (const o of skins) {
      const big = o === this.r.headMesh || o === this.r.body;
      // 머리 묶음 안에서도 머리 위쪽만 귀 (주둥이 · 눈꺼풀은 머리)
      const wy = o.getWorldPosition(new THREE.Vector3()).y, hy = this.r.headMesh.getWorldPosition(new THREE.Vector3()).y;
      const part = o === this.r.headMesh ? 'head' : under(o, limbs) ? 'limb' : under(o, [this.r.head]) ? (wy > hy + 0.18 ? 'ear' : 'head') : 'body';
      const rect = cell(big);
      o.geometry = remap(o.geometry, rect); o.material = this.mat;
      o.userData.part = part; o.userData.bear = this; o.userData.rect = rect; o.userData.belly = this.r.bellyM && skins.includes(o) && !big && part === 'body';
      this.parts.push(o); this.cells.push({ rect, part, belly: o.userData.belly });
    }
    // 얼굴 · 무늬: 머리(또는 가까운 피부)의 그 자리 uv 를 미리 찾아 둔다 → 칠해지면 그 색으로
    this.feats = [];
    const rc = new THREE.Raycaster(), wp = new THREE.Vector3(), hc = new THREE.Vector3();
    for (const o of feats) {
      if (o.material && o.material.transparent && o.material.opacity < 0.5) continue;
      o.getWorldPosition(wp);
      const host = under(o, [this.r.head]) ? this.r.headMesh : this.parts.reduce((a, q) => (q.getWorldPosition(hc).distanceTo(wp) < (a ? a.getWorldPosition(new THREE.Vector3()).distanceTo(wp) : 1e9) ? q : a), null);
      if (!host) continue;
      host.getWorldPosition(hc); const d = wp.clone().sub(hc).normalize();
      rc.set(wp.clone().addScaledVector(d, 0.6), d.clone().negate()); const h = rc.intersectObject(host, false)[0];
      if (!h || !h.uv) continue;
      o.material = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
      this.feats.push({ o, uv: h.uv.clone(), orig: o.material.color ? o.material.color.clone() : null });
    }
    this.def = document.createElement('canvas'); this.def.width = this.def.height = ATLAS; this.drawDefault(this.def.getContext('2d'));
    this.reset();
    // 키: 보이는 부위만 (숨긴 날개 등은 빼고)
    const bb = new THREE.Box3(); this.root.updateMatrixWorld(true); this.root.traverse((o) => { if (o.isMesh && o.visible && o.parent?.visible !== false) bb.expandByObject(o); }); this.topY = bb.max.y;
    this.pose = 0; this.undo = []; this.t = Math.random() * 6;
  }
  drawDefault(x) {
    const belly = lightOf(this.base, 0.55);
    for (const c of this.cells) { const [rx, ry, rw, rh] = c.rect; x.fillStyle = c.belly ? belly : this.base; x.fillRect(rx, ry, rw, rh); }
  }
  meshes() { return this.parts; }
  // ---- 자세: 0 서기 · 1 쪼그리기 · 2 납작 엎드리기 · 3 동글이 ----
  setPose(p) {
    this.pose = p;
    const hide = p === 3;
    for (const o of this.parts) if (o.userData.part === 'limb' || o.userData.part === 'ear') o.visible = !hide;
  }
  // 걷기 · 숨쉬기 (다른 게임과 같은 곰돌이 움직임) + 자세
  animate(dt, moving) {
    this.r.update(dt, moving && this.pose < 2 ? 3.4 : 0, { noCrawl: true });
    const I = this.inner, p = this.pose;
    I.rotation.x = 0; I.scale.set(1, 1, 1);
    if (p === 1) { I.scale.set(1.08, 0.74, 1.08); }
    else if (p === 2) { I.rotation.x = Math.PI / 2; I.position.y += 0.34; I.position.z = -0.75; }
    else if (p === 3) { I.scale.set(1.14, 0.8, 1.14); }
    if (p !== 2) I.position.z = 0;
  }
  // ---- 칠하기 ----
  changed() { this.tex.needsUpdate = true; this.syncFeats(); }
  // 눈 · 코 · 입: 그 자리가 처음 젤리색과 많이 다르면(칠했으면) 칠한 색으로, 아니면 원래 색으로
  syncFeats() {
    const d = this.ctx.getImageData(0, 0, ATLAS, ATLAS).data, d0 = this.def.getContext('2d').getImageData(0, 0, ATLAS, ATLAS).data;
    for (const f of this.feats) {
      if (!f.orig) continue;
      const px = Math.min(ATLAS - 1, Math.max(0, Math.floor(f.uv.x * ATLAS))), py = Math.min(ATLAS - 1, Math.max(0, Math.floor((1 - f.uv.y) * ATLAS))), i = (py * ATLAS + px) * 4;
      const diff = Math.abs(d[i] - d0[i]) + Math.abs(d[i + 1] - d0[i + 1]) + Math.abs(d[i + 2] - d0[i + 2]);
      if (diff > 40) { f.o.material.color.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); if (f.o.material.emissive) f.o.material.emissive.setRGB(0, 0, 0); }
      else f.o.material.color.copy(f.orig);
    }
  }
  setGhost(on) { const all = [this.mat, ...this.feats.map((f) => f.o.material)]; for (const m of all) { m.transparent = on; m.opacity = on ? 0.35 : 1; m.needsUpdate = true; } }
  snapshot() { this.undo.push(this.ctx.getImageData(0, 0, ATLAS, ATLAS)); if (this.undo.length > 25) this.undo.shift(); }
  back() { const d = this.undo.pop(); if (!d) return false; this.ctx.putImageData(d, 0, 0); this.changed(); return true; }
  // uv 자리에 동그란 붓 (그 부위 칸 밖으로 번지지 않게) · where = 칠한 부위(mesh)
  dab(uv, where, color, size, erase) {
    const rect = where?.userData?.rect || this.cells[0].rect, [rx, ry, rw, rh] = rect;
    const x = this.ctx, px = uv.x * ATLAS, py = (1 - uv.y) * ATLAS, sz = size * (rw < 100 ? 0.75 : 1.2);
    x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
    for (const ox of [0, rw, -rw]) {
      if (ox && !(ox > 0 ? px - sz < rx : px + sz > rx + rw)) continue; // 구의 이음매를 넘으면 반대쪽에도
      x.save(); x.beginPath(); x.arc(px + ox, py, sz, 0, 7); x.clip();
      if (erase) x.drawImage(this.def, 0, 0); else { x.fillStyle = color; x.fillRect(rx, ry, rw, rh); }
      x.restore();
    }
    x.restore(); this.changed();
  }
  cellsOf(part) { return this.cells.filter((c) => c.part === part); }
  fill(part, color) { for (const c of this.cellsOf(part)) { const [rx, ry, rw, rh] = c.rect; this.ctx.fillStyle = color; this.ctx.fillRect(rx, ry, rw, rh); } this.changed(); }
  stamp(part, spec) { for (const c of this.cellsOf(part)) stampRect(this.ctx, c.rect, spec, part); this.changed(); }
  reset() { this.ctx.clearRect(0, 0, ATLAS, ATLAS); this.ctx.drawImage(this.def, 0, 0); this.changed(); }
  // 봇의 칠: 무늬 이름 + 색 (모든 부위)
  applySpec(spec) { for (const c of this.cells) stampRect(this.ctx, c.rect, spec, c.part); this.changed(); }
  applyImage(url) { const im = new Image(); im.onload = () => { this.ctx.drawImage(im, 0, 0, ATLAS, ATLAS); this.changed(); }; im.src = url; }
  // 보낼 그림: 256 으로 줄여 JPEG (받는 쪽은 다시 512 로)
  toImage() { const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(this.canvas, 0, 0, 256, 256); return c.toDataURL('image/jpeg', 0.85); }
  // 몸 색 구성 (위장도): 잘 보이는 부위일수록 비중 크게 → 큰 색 5개 [[r,g,b,비율]...]
  colors() {
    const d = this.ctx.getImageData(0, 0, ATLAS, ATLAS).data, H = new Map();
    const wt = { head: 1.2, body: 1.6, limb: 0.6, ear: 0.25 };
    for (const c of this.cells) {
      const [rx, ry, rw, rh] = c.rect, st = rw > 100 ? 4 : 3, w = wt[c.part] * (rw > 100 ? 1 : 0.5);
      for (let y = ry + 4; y < ry + rh - 4; y += st) for (let x = rx; x < rx + rw; x += st) {
        const i = (y * ATLAS + x) * 4, key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
        let e = H.get(key); if (!e) H.set(key, (e = { r: 0, g: 0, b: 0, n: 0, w: 0 }));
        e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; e.n++; e.w += w;
      }
    }
    const groups = [];
    for (const e of [...H.values()].sort((a, b) => b.w - a.w)) {
      const c = [e.r / e.n, e.g / e.n, e.b / e.n];
      const g = groups.find((q) => Math.hypot(q.c[0] - c[0], q.c[1] - c[1], q.c[2] - c[2]) < 34);
      if (g) { const t = g.w + e.w; g.c = g.c.map((v, j) => (v * g.w + c[j] * e.w) / t); g.w = t; } else groups.push({ c, w: e.w });
    }
    const tot = groups.reduce((a, g) => a + g.w, 0) || 1;
    return groups.sort((a, b) => b.w - a.w).slice(0, 5).map((g) => [...g.c.map(Math.round), +(g.w / tot).toFixed(3)]);
  }
}
// 무늬 도장: 칸 하나를 무늬로 채운다 (겉면 무늬와 비슷한 크기로)
export function stampRect(x, [rx, ry, rw, rh], spec, part) {
  let n = 22;
  if (spec.sc) n = Math.round(Math.max(12, Math.min(64, spec.sc * (part === 'limb' || part === 'ear' ? 34 : 50))));
  x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
  if (spec.p === 'solid' || !spec.p) { x.fillStyle = spec.c; x.fillRect(rx, ry, rw, rh); }
  else { const pat = x.createPattern(tileCanvas(spec, n), 'repeat'); x.fillStyle = pat; x.fillRect(rx, ry, rw, rh); }
  x.restore();
}
