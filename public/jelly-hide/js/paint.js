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
export const ATLAS = 256;
export const REG = { head: [0, 0, 128, 128], body: [128, 0, 128, 128], limb: [0, 128, 128, 128], ear: [128, 128, 128, 128] };
export const PART_NAME = { head: '머리', body: '몸', limb: '팔다리', ear: '귀' };
// 구 · 캡슐의 uv 를 그림의 부위 칸으로 옮긴다
function remap(g, [rx, ry, rw, rh]) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (rx + u * rw) / ATLAS, 1 - (ry + (1 - v) * rh) / ATLAS); }
  return g;
}
const GEO = {
  head: remap(new THREE.SphereGeometry(0.36, 32, 22), REG.head),
  body: remap(new THREE.SphereGeometry(0.42, 32, 22), REG.body),
  ear: remap(new THREE.SphereGeometry(0.12, 16, 12), REG.ear),
  arm: remap(new THREE.CapsuleGeometry(0.1, 0.26, 6, 14), REG.limb),
  leg: remap(new THREE.CapsuleGeometry(0.13, 0.16, 6, 14), REG.limb),
};
export const BASE = '#ff9ec4';
// 기본 모습: 젤리색 + 얼굴(눈 · 볼 · 입) + 하얀 배
export function drawDefault(x, base = BASE) {
  const [r, g, b] = hex2rgb(base), light = rgb2hex([r + (255 - r) * 0.45, g + (255 - g) * 0.45, b + (255 - b) * 0.45]), dark = rgb2hex([r * 0.8, g * 0.8, b * 0.8]);
  for (const k of Object.keys(REG)) { const [rx, ry, rw, rh] = REG[k]; const gr = x.createLinearGradient(0, ry, 0, ry + rh); gr.addColorStop(0, light); gr.addColorStop(0.45, base); gr.addColorStop(1, dark); x.fillStyle = gr; x.fillRect(rx, ry, rw, rh); }
  // 얼굴은 머리 칸의 앞(u = 0.25)
  const fx = REG.head[0] + 0.25 * 128, fy = REG.head[1];
  x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(fx, fy + 76, 13, 9, 0, 0, 7); x.fill(); // 주둥이
  x.fillStyle = '#2b1a24'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(fx + s * 9, fy + 60, 2.6, 4.2, 0, 0, 7); x.fill(); }
  x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(fx + s * 9 + 0.8, fy + 58, 1.1, 0, 7); x.fill(); }
  x.fillStyle = '#5a2b3a'; x.beginPath(); x.ellipse(fx, fy + 72, 3.4, 2.4, 0, 0, 7); x.fill(); // 코
  x.strokeStyle = '#5a2b3a'; x.lineWidth = 1.4; x.beginPath(); x.arc(fx - 2.4, fy + 76, 2.4, 0.2, 2.9); x.arc(fx + 2.4, fy + 76, 2.4, 0.2, 2.9); x.stroke();
  x.fillStyle = 'rgba(255,90,140,.45)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(fx + s * 17, fy + 70, 4.5, 2.6, 0, 0, 7); x.fill(); }
  // 배: 몸 칸의 앞
  x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(REG.body[0] + 32, REG.body[1] + 70, 18, 30, 0, 0, 7); x.fill();
  // 귀 안쪽
  x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(REG.ear[0] + 32, REG.ear[1] + 64, 14, 18, 0, 0, 7); x.fill();
}
// 무늬 도장: 부위 칸 하나를 무늬로 채운다 (n = 무늬 한 칸 픽셀)
export function stampPart(x, part, spec, n = 22) {
  const [rx, ry, rw, rh] = REG[part];
  if (spec.sc) n = Math.round(Math.max(12, Math.min(64, spec.sc * (part === 'limb' || part === 'ear' ? 70 : 50)))); // 겉면 무늬와 같은 크기로 (몸 둘레 약 2.6m = 128px)
  x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
  if (spec.p === 'solid' || !spec.p) { x.fillStyle = spec.c; x.fillRect(rx, ry, rw, rh); }
  else { const pat = x.createPattern(tileCanvas(spec, n), 'repeat'); x.fillStyle = pat; x.fillRect(rx, ry, rw, rh); }
  x.restore();
}

export class Bear {
  constructor(base = BASE) {
    this.root = new THREE.Group();
    this.inner = new THREE.Group(); this.root.add(this.inner);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = ATLAS;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.base = base; drawDefault(this.ctx, base);
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex });
    const m = (g, part) => { const o = new THREE.Mesh(g, this.mat); o.userData.part = part; o.userData.bear = this; return o; };
    this.body = m(GEO.body, 'body'); this.body.scale.set(1, 1.02, 0.9); this.body.position.y = 0.5;
    this.head = m(GEO.head, 'head'); this.head.position.y = 1.05;
    this.ears = [-1, 1].map((s) => { const e = m(GEO.ear, 'ear'); e.position.set(s * 0.25, 1.33, -0.02); e.scale.set(1, 1, 0.75); return e; });
    this.arms = [-1, 1].map((s) => { const a = m(GEO.arm, 'limb'); a.position.set(s * 0.43, 0.6, 0.04); a.rotation.z = s * 0.55; return a; });
    this.legs = [-1, 1].map((s) => { const l = m(GEO.leg, 'limb'); l.position.set(s * 0.19, 0.17, 0.05); return l; });
    this.parts = [this.body, this.head, ...this.ears, ...this.arms, ...this.legs];
    this.inner.add(...this.parts);
    this.pose = 0; this.undo = []; this.t = Math.random() * 6;
  }
  meshes() { return this.parts; }
  // ---- 자세: 0 서기 · 1 쪼그리기 · 2 납작 엎드리기 · 3 동글이 ----
  setPose(p) {
    this.pose = p;
    const I = this.inner; I.rotation.set(0, 0, 0); I.position.set(0, 0, 0); I.scale.set(1, 1, 1);
    for (const o of [...this.ears, ...this.arms, ...this.legs]) o.visible = true;
    this.head.position.set(0, 1.05, 0); this.body.scale.set(1, 1.02, 0.9); this.legs.forEach((l) => { l.rotation.x = 0; l.position.z = 0.05; });
    if (p === 1) { I.scale.set(1.08, 0.78, 1.08); this.legs.forEach((l) => { l.rotation.x = -1.3; l.position.z = 0.2; }); }
    else if (p === 2) { I.rotation.x = Math.PI / 2; I.position.set(0, 0.36, -0.45); I.scale.set(1, 1, 0.82); }
    else if (p === 3) { for (const o of [...this.ears, ...this.arms, ...this.legs]) o.visible = false; this.head.position.set(0, 0.72, 0.06); this.body.scale.set(1.12, 0.95, 1.05); }
  }
  // 걷기 · 숨쉬기 흔들림
  animate(dt, moving) {
    this.t += dt * (moving ? 9 : 1.6);
    const k = moving ? 0.5 : 0.04;
    this.legs.forEach((l, i) => { if (this.pose === 0) l.rotation.x = Math.sin(this.t + i * Math.PI) * k; });
    this.arms.forEach((a, i) => { a.rotation.x = Math.sin(this.t + i * Math.PI + Math.PI) * k * 0.8; });
    if (this.pose !== 2) this.inner.position.y = moving ? Math.abs(Math.sin(this.t)) * 0.05 : 0;
  }
  // ---- 칠하기 ----
  snapshot() { this.undo.push(this.ctx.getImageData(0, 0, ATLAS, ATLAS)); if (this.undo.length > 25) this.undo.shift(); }
  back() { const d = this.undo.pop(); if (!d) return false; this.ctx.putImageData(d, 0, 0); this.tex.needsUpdate = true; return true; }
  // uv 자리에 동그란 붓 (같은 부위 칸 밖으로 번지지 않게)
  dab(uv, part, color, size, erase) {
    const x = this.ctx, [rx, ry, rw, rh] = REG[part], px = uv.x * ATLAS, py = (1 - uv.y) * ATLAS;
    x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
    if (erase) { // 지우개 = 처음 젤리색으로
      if (!this.def) { this.def = document.createElement('canvas'); this.def.width = this.def.height = ATLAS; drawDefault(this.def.getContext('2d'), this.base); }
      x.beginPath(); x.arc(px, py, size, 0, 7); x.clip(); x.drawImage(this.def, 0, 0);
    } else { x.fillStyle = color; x.beginPath(); x.arc(px, py, size, 0, 7); x.fill(); }
    // 구의 이음매(u = 0 ↔ 1)를 넘으면 반대쪽에도
    if (px - size < rx) { x.beginPath(); x.arc(px + rw, py, size, 0, 7); erase ? null : x.fill(); }
    if (px + size > rx + rw) { x.beginPath(); x.arc(px - rw, py, size, 0, 7); erase ? null : x.fill(); }
    x.restore(); this.tex.needsUpdate = true;
  }
  fill(part, color) { const [rx, ry, rw, rh] = REG[part]; this.ctx.fillStyle = color; this.ctx.fillRect(rx, ry, rw, rh); this.tex.needsUpdate = true; }
  stamp(part, spec) { stampPart(this.ctx, part, spec); this.tex.needsUpdate = true; }
  reset() { drawDefault(this.ctx, this.base); this.tex.needsUpdate = true; }
  // 봇의 칠: 무늬 이름 + 색 (모든 부위)
  applySpec(spec) { for (const k of Object.keys(REG)) stampPart(this.ctx, k, spec); this.tex.needsUpdate = true; }
  applyImage(url) { const im = new Image(); im.onload = () => { this.ctx.drawImage(im, 0, 0, ATLAS, ATLAS); this.tex.needsUpdate = true; }; im.src = url; }
  toImage() { return this.canvas.toDataURL('image/jpeg', 0.82); }
  // 몸 색 구성 (위장도): 잘 보이는 부위일수록 비중 크게 · 16단계로 묶은 뒤 비슷한 색끼리 합쳐 큰 색 5개 → [[r,g,b,비율]...]
  colors() {
    const d = this.ctx.getImageData(0, 0, ATLAS, ATLAS).data, H = new Map();
    const wt = { head: 1.2, body: 1.6, limb: 0.6, ear: 0.25 };
    for (const [k, [rx, ry, rw, rh]] of Object.entries(REG)) for (let y = ry + 6; y < ry + rh - 6; y += 3) for (let x = rx; x < rx + rw; x += 3) {
      const i = (y * ATLAS + x) * 4, key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      let e = H.get(key); if (!e) H.set(key, (e = { r: 0, g: 0, b: 0, n: 0, w: 0 }));
      e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; e.n++; e.w += wt[k];
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
