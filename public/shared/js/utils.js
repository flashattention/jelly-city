import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- 난수 ----------
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) { this.r = mulberry32(seed); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  chance(p) { return this.r() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted(items, wfn) {
    let total = 0;
    for (const it of items) total += Math.max(0, wfn(it));
    let x = this.r() * total;
    for (const it of items) { x -= Math.max(0, wfn(it)); if (x <= 0) return it; }
    return items[items.length - 1];
  }
}

export const rand = new RNG(Date.now() & 0xffffffff);
export const HAS_DOM = typeof document !== 'undefined';

// ---------------- 도시 이름: 기본은 '젤리시티', 바퀴 모드일 때만 '바퀴시티' ----------------
export const brand = { bug: (() => { try { return !!JSON.parse(localStorage.getItem('roachcity.settings') || '{}').bugMode; } catch { return false; } })() };
export function cityText(s) {
  if (typeof s !== 'string') return s;
  return brand.bug ? s.replaceAll('젤리시티', '바퀴시티').replaceAll('Jelly City', 'Roach City') : s.replaceAll('바퀴시티', '젤리시티').replaceAll('Roach City', 'Jelly City');
}
const BRAND_RE = /바퀴시티|젤리시티|Roach City|Jelly City/;
const brandSigns = [];
function brandDom(root) {
  if (!root) return;
  if (root.nodeType === 3) { if (BRAND_RE.test(root.nodeValue)) { const v = cityText(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; } return; }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (BRAND_RE.test(n.nodeValue)) { const v = cityText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  if (root.querySelectorAll) for (const el of root.querySelectorAll('[placeholder],[title]')) for (const a of ['placeholder', 'title']) { const v = el.getAttribute(a); if (v && BRAND_RE.test(v)) el.setAttribute(a, cityText(v)); }
}
// 화면에 새로 생기는 글자(토스트·채팅·서버 메시지 등)도 자동으로 바꾼다
export function initBrand() {
  if (!HAS_DOM || initBrand.done) return;
  initBrand.done = true;
  document.body.classList.toggle('bug-mode', brand.bug);
  document.title = cityText(document.title);
  brandDom(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') brandDom(m.target);
      else for (const n of m.addedNodes) brandDom(n);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
export function setBrand(bug) {
  brand.bug = !!bug;
  if (!HAS_DOM) return;
  document.body.classList.toggle('bug-mode', brand.bug);
  document.title = cityText(document.title);
  brandDom(document.body);
  for (let i = brandSigns.length - 1; i >= 0; i--) { const m = brandSigns[i].deref(); if (m) retitleSign(m, m.userData.sign.raw); else brandSigns.splice(i, 1); }
}

// ---------- 재질 ----------
let gradientMap = null;
export function toonGradient() {
  if (!gradientMap) {
    const data = new Uint8Array([140, 140, 140, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = String(color) + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
    matCache.set(key, m);
  }
  return m;
}

export function basic(color, opts = {}) {
  const key = 'b' + String(color) + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, ...opts }); matCache.set(key, m); }
  return m;
}

// ---------- 기하 캐시 ----------
const geoCache = new Map();
export function geo(key, fn) {
  let g = geoCache.get(key);
  if (!g) { g = fn(); geoCache.set(key, g); }
  return g;
}
export const G = {
  box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  sphere: () => geo('sph', () => new THREE.SphereGeometry(1, 18, 12)),
  sphereLow: () => geo('sphL', () => new THREE.SphereGeometry(1, 10, 7)),
  ico: () => geo('ico', () => new THREE.IcosahedronGeometry(1, 1)),
  cyl: () => geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 16)),
  cylLow: () => geo('cylL', () => new THREE.CylinderGeometry(1, 1, 1, 8)),
  cone: () => geo('cone', () => new THREE.ConeGeometry(1, 1, 12)),
  plane: () => geo('plane', () => new THREE.PlaneGeometry(1, 1)),
  hemi: () => geo('hemi', () => new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2)),
};

// 간단 메쉬 생성기
export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(G.box(), typeof color === 'object' ? color : toon(color));
  m.scale.set(w, h, d); m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = opts.cast !== false; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cyl(parent, r, h, color, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(opts.low ? G.cylLow() : G.cyl(), typeof color === 'object' ? color : toon(color));
  m.scale.set(r, h, r); m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = opts.cast !== false; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function sph(parent, sx, sy, sz, color, x = 0, y = 0, z = 0, opts = {}) {
  const g = opts.ico ? G.ico() : opts.low ? G.sphereLow() : opts.hemi ? G.hemi() : G.sphere();
  const m = new THREE.Mesh(g, typeof color === 'object' ? color : toon(color));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = opts.cast !== false; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cone(parent, r, h, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(G.cone(), toon(color));
  m.scale.set(r, h, r); m.position.set(x, y, z);
  m.castShadow = true; parent.add(m);
  return m;
}

// ---------- 캔버스 텍스처 ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export { roundRect };

export function signTexture(text, emoji, bg = '#ffffff', fg = '#4a3428', w = 512, h = 128) {
  if (!HAS_DOM) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  roundRect(ctx, 4, 4, w - 8, h - 8, 36);
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 64;
  const label = (emoji ? emoji + ' ' : '') + text;
  ctx.font = `bold ${size}px "Jua", "Apple SD Gothic Neo", sans-serif`;
  while (ctx.measureText(label).width > w - 40 && size > 20) {
    size -= 4; ctx.font = `bold ${size}px "Jua", "Apple SD Gothic Neo", sans-serif`;
  }
  ctx.fillText(label, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function signMesh(text, emoji, width, bg, fg) {
  const raw = text;
  const tex = signTexture(cityText(text), emoji, bg, fg);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const m = new THREE.Mesh(G.plane(), mat);
  m.scale.set(width, width / 4, 1);
  m.userData.dynamic = true; // 고유 재질이므로 병합 제외
  m.userData.sign = { emoji, bg, fg, raw };
  if (BRAND_RE.test(raw || '') && typeof WeakRef !== 'undefined') brandSigns.push(new WeakRef(m));
  return m;
}

// 간판 글자 바꾸기 (집 주인이 바뀔 때 등)
export function retitleSign(m, text) {
  if (!m || !HAS_DOM) return;
  const { emoji, bg, fg } = m.userData.sign;
  m.userData.sign.raw = text;
  if (BRAND_RE.test(text) && typeof WeakRef !== 'undefined' && !brandSigns.some((r) => r.deref() === m)) brandSigns.push(new WeakRef(m));
  m.material.map?.dispose();
  m.material.map = signTexture(cityText(text), emoji, bg, fg);
  m.material.needsUpdate = true;
}

// 창문 텍스처 (4x4 칸, 밤에 일부 칸만 켜짐)
let windowMats = null;
export function windowMaterials() {
  if (windowMats) return windowMats;
  if (!HAS_DOM) {
    windowMats = { normal: toon('#a9d8ff'), dark: toon('#8fc7f0'), wood: toon('#b8e2ff') };
    return windowMats;
  }
  const make = (frame, glass) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const e = document.createElement('canvas'); e.width = e.height = 256;
    const ex = e.getContext('2d');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
    const r = mulberry32(7);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64, y = j * 64;
      ctx.fillStyle = frame; roundRect(ctx, x + 10, y + 8, 44, 50, 8); ctx.fill();
      ctx.fillStyle = glass; roundRect(ctx, x + 14, y + 12, 36, 42, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(x + 18, y + 40); ctx.lineTo(x + 30, y + 16); ctx.lineTo(x + 36, y + 16); ctx.lineTo(x + 24, y + 40); ctx.fill();
      ctx.fillStyle = frame; ctx.fillRect(x + 31, y + 12, 2, 42);
      if (r() < 0.6) { ex.fillStyle = r() < 0.5 ? '#ffd27a' : '#ffe9b0'; roundRect(ex, x + 14, y + 12, 36, 42, 6); ex.fill(); }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const etex = new THREE.CanvasTexture(e);
    etex.colorSpace = THREE.SRGBColorSpace;
    etex.wrapS = etex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshToonMaterial({
      map: tex, emissiveMap: etex, emissive: new THREE.Color('#ffcf73'), emissiveIntensity: 0,
      gradientMap: toonGradient(), transparent: false, alphaTest: 0.5,
    });
  };
  windowMats = {
    normal: make('#ffffff', '#a9d8ff'),
    dark: make('#5b4a63', '#8fc7f0'),
    wood: make('#8b5a3c', '#b8e2ff'),
  };
  return windowMats;
}

// 창문 평면: UV를 크기에 맞춰 늘려서 재질 하나를 공유
export function windowPlane(parent, w, h, cellW, cellH, kind = 'normal') {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  const su = w / cellW / 4, sv = h / cellH / 4;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  const m = new THREE.Mesh(g, windowMaterials()[kind]);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function stripeTexture(c1, c2, n = 6) {
  if (!HAS_DOM) return null;
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const ctx = c.getContext('2d');
  const sw = 128 / n;
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c2 : c1; ctx.fillRect(i * sw, 0, sw, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const stripeMatCache = new Map();
export function stripeMat(c1, c2, n = 6) {
  const k = c1 + c2 + n;
  if (!stripeMatCache.has(k)) stripeMatCache.set(k, new THREE.MeshToonMaterial({ map: stripeTexture(c1, c2, n), gradientMap: toonGradient(), side: THREE.DoubleSide }));
  return stripeMatCache.get(k);
}

// ---------- 정적 병합 ----------
// root 아래의 메쉬들을 재질별로 하나의 메쉬로 합친다 (userData.dynamic 표시된 것은 제외)
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const remove = [];
  const visit = (o, dyn) => {
    const isDyn = dyn || o.userData.dynamic;
    if (o.isMesh && !isDyn && !o.isInstancedMesh) {
      const key = o.material.uuid + (o.castShadow ? 'c' : 'n');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      }
      g.clearGroups();
      g.applyMatrix4(o.matrixWorld);
      buckets.get(key).geos.push(g);
      remove.push(o);
    }
    for (const c of o.children) visit(c, isDyn);
  };
  visit(root, false);
  for (const o of remove) o.parent.remove(o);
  const merged = new THREE.Group();
  for (const { mat, cast, geos } of buckets.values()) {
    // 너무 큰 버퍼를 피하기 위해 나눠서 병합
    for (let i = 0; i < geos.length; i += 400) {
      const g = mergeGeometries(geos.slice(i, i + 400), false);
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.castShadow = cast; m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      merged.add(m);
    }
  }
  return merged;
}

// ---------- 기타 ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function fmtTime(minutes) {
  const m = Math.floor(minutes) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(mm).padStart(2, '0')}`;
}
export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
