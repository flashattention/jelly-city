// 젤리어택 · 젤리배그 맵 그리기: 상자마다 종류에 맞는 무늬(나무상자 · 컨테이너 · 벽돌 · 집 · 탱크) + 집 지붕 + 꾸밈(나무 · 가로등 · 자동차 · 울타리 · 젤리 웅덩이 …) + 바닥 · 하늘 · 바다 · 빛
import * as THREE from 'three';
import { bakeStatic } from '../../shared/js/utils.js';

const texCache = new Map();
function canvasTex(key, draw, n = 128) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
// 종류별 무늬
function kindTex(kind, col) {
  const a = col, b = shade(col, 0.85), d = shade(col, 0.68), R = Math.random;
  return canvasTex(`${kind}|${col}`, (x, n) => {
    x.fillStyle = a; x.fillRect(0, 0, n, n);
    if (kind === 'crate') { x.strokeStyle = d; x.lineWidth = 10; x.strokeRect(5, 5, n - 10, n - 10); x.beginPath(); x.moveTo(8, 8); x.lineTo(n - 8, n - 8); x.moveTo(n - 8, 8); x.lineTo(8, n - 8); x.stroke(); x.fillStyle = b; for (let i = 1; i < 4; i++) x.fillRect(0, (i * n) / 4, n, 2); }
    else if (kind.startsWith('cont')) { for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * n) / 12, 0, n / 12, n); } x.fillStyle = d; x.fillRect(0, 0, n, 6); x.fillRect(0, n - 6, n, 6); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(n * 0.1, n * 0.12, n * 0.3, 6); }
    else if (kind === 'wall' || kind === 'outer' || kind === 'low' || kind === 'brick' || kind === 'sandbag' || kind === 'steel') { x.fillStyle = b; for (let r = 0; r < 8; r++) for (let i = 0; i < 4; i++) { const o = r % 2 ? n / 8 : 0; x.fillRect(i * n / 4 + o + 2, r * n / 8 + 2, n / 4 - 4, n / 8 - 4); } x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 20; i++) x.fillRect(R() * n, R() * n, 6, 6); }
    else if (kind.startsWith('house') || kind === 'ware' || kind === 'home' || kind === 'shop' || kind === 'school' || kind.startsWith('cabin') || kind === 'lodge' || kind === 'hall' || kind.startsWith('adobe')) {
      // 벽 칠 + 창문(창틀 · 유리 반사 · 화분) — 3m 마다 반복
      x.fillStyle = b; for (let i = 0; i < 40; i++) { x.globalAlpha = 0.22; x.fillRect(R() * n, R() * n, 4 + R() * 12, 3); } x.globalAlpha = 1;
      x.fillStyle = shade(col, 0.55); x.fillRect(n * 0.2 - 3, n * 0.22 - 3, n * 0.6 + 6, n * 0.34 + 6);
      const gl = x.createLinearGradient(0, n * 0.22, 0, n * 0.56); gl.addColorStop(0, '#bfe6ff'); gl.addColorStop(1, '#6f9fd1'); x.fillStyle = gl; x.fillRect(n * 0.2, n * 0.22, n * 0.6, n * 0.34);
      x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.moveTo(n * 0.24, n * 0.52); x.lineTo(n * 0.4, n * 0.25); x.lineTo(n * 0.47, n * 0.25); x.lineTo(n * 0.31, n * 0.52); x.fill();
      x.fillStyle = shade(col, 0.55); x.fillRect(n * 0.49, n * 0.22, 4, n * 0.34); x.fillRect(n * 0.2, n * 0.38, n * 0.6, 3);
      x.fillStyle = shade(col, 0.45); x.fillRect(n * 0.16, n * 0.56, n * 0.68, 6);
      if (kind === 'shop') { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#ff8fb8'; x.fillRect(i * n / 8, 0, n / 8, n * 0.12); } }
      else { x.fillStyle = '#ff8fb8'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(n * (0.28 + i * 0.15), n * 0.6, 5, 0, 7); x.fill(); } }
    }
    else if (kind.startsWith('tank')) { const g = x.createLinearGradient(0, 0, n, 0); g.addColorStop(0, d); g.addColorStop(0.5, shade(col, 1.2)); g.addColorStop(1, d); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, n * 0.2, n, 4); x.fillRect(0, n * 0.7, n, 4); }
    else if (kind === 'belt') { x.fillStyle = '#222'; x.fillRect(0, 0, n, n); x.fillStyle = '#555'; for (let i = 0; i < 8; i++) x.fillRect(i * n / 8, 0, 4, n); }
    else if (kind === 'rock' || kind === 'cliff') { for (let i = 0; i < 30; i++) { x.fillStyle = R() < 0.5 ? b : shade(col, 1.12); x.globalAlpha = 0.6; x.beginPath(); x.arc(R() * n, R() * n, 4 + R() * 14, 0, 7); x.fill(); } x.globalAlpha = 1; }
    else if (kind === 'trunk') { x.fillStyle = b; for (let i = 0; i < 10; i++) x.fillRect(R() * n, 0, 3, n); }
    else if (kind === 'roofslab' || kind === 'floor') { x.fillStyle = b; for (let i = 0; i < 8; i++) x.fillRect(0, i * n / 8, n, 2); }
    else { x.fillStyle = b; x.fillRect(0, n - 8, n, 8); x.fillRect(n - 8, 0, 8, n); }
  });
}
export function floorTex(a, b) {
  return canvasTex(`floor|${a}|${b}`, (x, n) => {
    x.fillStyle = a; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 80; i++) { x.fillStyle = Math.random() < 0.5 ? b : shade(a, 1.06); x.globalAlpha = 0.5; x.beginPath(); x.arc(Math.random() * n, Math.random() * n, 2 + Math.random() * 9, 0, 7); x.fill(); }
    x.globalAlpha = 0.25; x.strokeStyle = shade(a, 0.7); x.lineWidth = 2; x.strokeRect(0, 0, n, n);
  });
}
function signTex(text, bg) {
  return canvasTex(`sign|${text}|${bg}`, (x, n) => {
    x.fillStyle = bg; x.fillRect(0, 0, n * 2, n);
    x.fillStyle = '#fff'; x.font = `bold ${Math.floor(n * 0.42)}px Jua, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, n, n * 0.55);
  }, 128);
}

// ---------- 꾸밈 (충돌 없음 · 큰 것은 maps.js 의 상자로 따로 막는다) ----------
const matCache = new Map();
const tm = (c, o = {}) => { const k = c + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color: c, ...o })); return matCache.get(k); };
const geoCache = new Map();
const gc = (k, f) => geoCache.get(k) || geoCache.set(k, f()).get(k);
const SPH = () => gc('sph', () => new THREE.SphereGeometry(1, 14, 10)), CYL = () => gc('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 12)), CONE = () => gc('cone', () => new THREE.ConeGeometry(1, 1, 12)), BOX = () => gc('box', () => new THREE.BoxGeometry(1, 1, 1));
function m(parent, geo, mat, x, y, z, sx, sy, sz, ry = 0) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.y = ry; parent.add(o); return o; }
const JELLY_TREES = ['#ff9ec7', '#ffd27a', '#9be7c4', '#b8a4ff', '#7fd3ff'];
function deco(parent, d, lights) {
  const s = d.s || 1, x = d.x, z = d.z, y = d.y || 0;
  switch (d.t) {
    case 'tree': { // 둥근 나무 (가끔 솜사탕 젤리 나무)
      m(parent, CYL(), tm('#7a5232'), x, y + 1.3 * s, z, 0.22 * s, 2.6 * s, 0.22 * s);
      const c = d.c || (Math.abs(Math.sin(x * 12.9 + z * 7.1)) < 0.25 ? JELLY_TREES[Math.floor(Math.abs(x + z)) % JELLY_TREES.length] : '#5fae5a');
      for (const [ox, oy, oz, r] of [[0, 3.2, 0, 1.5], [0.7, 2.7, 0.3, 1.0], [-0.7, 2.8, -0.2, 1.05], [0.1, 3.9, -0.2, 0.9]]) m(parent, SPH(), tm(c), x + ox * s, y + oy * s, z + oz * s, r * s, r * s * 0.9, r * s);
      break;
    }
    case 'pine': m(parent, CYL(), tm('#6b4a2c'), x, y + 0.8 * s, z, 0.18 * s, 1.6 * s, 0.18 * s); for (let i = 0; i < 3; i++) { m(parent, CONE(), tm(d.snow ? '#2f6f4a' : '#3f8f5a'), x, y + (1.6 + i * 1.0) * s, z, (1.5 - i * 0.35) * s, 1.6 * s, (1.5 - i * 0.35) * s); if (d.snow) m(parent, CONE(), tm('#f4f8fc'), x, y + (1.95 + i * 1.0) * s, z, (1.05 - i * 0.25) * s, 0.9 * s, (1.05 - i * 0.25) * s); } break;
    case 'snowman': { const w = tm('#f7fbff'); m(parent, SPH(), w, x, y + 0.55 * s, z, 0.6 * s, 0.55 * s, 0.6 * s); m(parent, SPH(), w, x, y + 1.3 * s, z, 0.42 * s, 0.4 * s, 0.42 * s); m(parent, SPH(), w, x, y + 1.85 * s, z, 0.3 * s, 0.3 * s, 0.3 * s); m(parent, CONE(), tm('#ff8a3d'), x, y + 1.85 * s, z + 0.35 * s, 0.06 * s, 0.3 * s, 0.06 * s).rotation.x = Math.PI / 2; for (const sx of [-0.1, 0.1]) m(parent, SPH(), tm('#222'), x + sx * s, y + 1.95 * s, z + 0.26 * s, 0.04 * s, 0.04 * s, 0.04 * s); m(parent, CYL(), tm('#ff5c8a'), x, y + 1.62 * s, z, 0.33 * s, 0.1 * s, 0.33 * s); m(parent, CYL(), tm('#3a3a44'), x, y + 2.2 * s, z, 0.2 * s, 0.3 * s, 0.2 * s); break; }
    case 'cactus': { const c = tm('#5fa65a'); m(parent, CYL(), c, x, y + 1.2 * s, z, 0.3 * s, 2.4 * s, 0.3 * s); m(parent, SPH(), c, x, y + 2.4 * s, z, 0.3 * s, 0.3 * s, 0.3 * s); for (const sd of [-1, 1]) { const h = (sd > 0 ? 1.3 : 0.9) * s; m(parent, CYL(), c, x + sd * 0.55 * s, y + h, z, 0.2 * s, 0.25 * s, 0.2 * s, Math.PI / 2).rotation.z = Math.PI / 2; m(parent, CYL(), c, x + sd * 0.7 * s, y + h + 0.4 * s, z, 0.2 * s, 0.8 * s, 0.2 * s); } m(parent, SPH(), tm('#ff8fb8'), x, y + 2.7 * s, z, 0.14 * s, 0.1 * s, 0.14 * s); break; }
    case 'igloo': { const g = new THREE.Mesh(new THREE.SphereGeometry(2.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), tm('#eef6ff')); g.position.set(x, y, z); parent.add(g); m(parent, BOX(), tm('#dfeaf6'), x, y + 0.75, z + 2.3, 1.4, 1.5, 0.8); m(parent, BOX(), tm('#3a4a5a'), x, y + 0.7, z + 2.72, 1.0, 1.3, 0.05); break; }
    case 'tent': { const c = d.c || '#e8b84a', g = new THREE.Mesh(new THREE.ConeGeometry(1.8 * s, 2.2 * s, 4), tm(c)); g.position.set(x, y + 1.1 * s, z); g.rotation.y = Math.PI / 4; parent.add(g); m(parent, CYL(), tm('#7a5232'), x, y + 1.3 * s, z, 0.05, 2.6 * s, 0.05); break; }
    case 'palm': { for (let i = 0; i < 5; i++) m(parent, CYL(), tm(i % 2 ? '#a07a4a' : '#8a6a3c'), x + i * 0.08 * s, y + (0.5 + i) * s, z, 0.2 * s, 1 * s, 0.2 * s); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, l = m(parent, SPH(), tm('#4caf6a'), x + 0.4 * s + Math.cos(a) * 1.3 * s, y + 5.1 * s, z + Math.sin(a) * 1.3 * s, 1.4 * s, 0.12 * s, 0.4 * s, -a); void l; } break; }
    case 'bush': for (const [ox, oz, r] of [[0, 0, 0.8], [0.6, 0.3, 0.6], [-0.5, 0.2, 0.55]]) m(parent, SPH(), tm(d.c || '#6cbf63'), x + ox * s, y + r * 0.6 * s, z + oz * s, r * s, r * 0.8 * s, r * s); break;
    case 'flowers': for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.3 + (i % 3) * 0.3; m(parent, SPH(), tm(['#ff8fb8', '#ffd84d', '#ffffff', '#b388ff'][i % 4]), x + Math.cos(a) * r * s, y + 0.25, z + Math.sin(a) * r * s, 0.14, 0.12, 0.14); } break;
    case 'rock': m(parent, gc('rockg', () => new THREE.DodecahedronGeometry(1, 0)), tm(d.c || '#9a9a9e'), x, y + 0.5 * s, z, 1.1 * s, 0.75 * s, 0.95 * s, x * 3); break;
    case 'lamp': {
      m(parent, CYL(), tm('#4a4a58'), x, y + 2.2, z, 0.09, 4.4, 0.09);
      m(parent, BOX(), tm('#4a4a58'), x + 0.45, y + 4.35, z, 0.9, 0.1, 0.12);
      m(parent, SPH(), tm('#fff3b0', { emissive: '#ffe08a', emissiveIntensity: 0.9 }), x + 0.85, y + 4.2, z, 0.22, 0.18, 0.22);
      if (lights && lights.length < 10 && d.light) { const l = new THREE.PointLight('#ffd98a', 6, 14, 1.6); l.position.set(x + 0.85, y + 4, z); lights.push(l); }
      break;
    }
    case 'barrel': m(parent, CYL(), tm(d.c || '#d9534f'), x, y + 0.5, z, 0.4, 1, 0.4); m(parent, CYL(), tm('#3a3a44'), x, y + 0.75, z, 0.42, 0.06, 0.42); m(parent, CYL(), tm('#3a3a44'), x, y + 0.25, z, 0.42, 0.06, 0.42); break;
    case 'car': { // 장난감 같은 젤리 자동차 (충돌은 상자로)
      const c = d.c || '#7cd8ff', r = d.r || 0, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; parent.add(g);
      m(g, BOX(), tm(c), 0, 0.65, 0, 1.8, 0.7, 3.8); m(g, BOX(), tm(shade(c, 1.15)), 0, 1.25, -0.2, 1.6, 0.6, 2);
      m(g, BOX(), tm('#a8d8ff', { transparent: true, opacity: 0.75 }), 0, 1.27, -0.2, 1.64, 0.45, 1.8);
      for (const [wx, wz] of [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.2], [0.9, -1.2]]) { const w = m(g, CYL(), tm('#2a2a32'), wx, 0.38, wz, 0.38, 0.28, 0.38); w.rotation.z = Math.PI / 2; }
      m(g, BOX(), tm('#fff3b0', { emissive: '#fff3b0', emissiveIntensity: 0.5 }), -0.55, 0.75, 1.92, 0.3, 0.18, 0.05); m(g, BOX(), tm('#fff3b0', { emissive: '#fff3b0', emissiveIntensity: 0.5 }), 0.55, 0.75, 1.92, 0.3, 0.18, 0.05);
      break;
    }
    case 'fence': { // (x, z) → (x2, z2) 기둥 + 두 줄 가로대
      const dx = d.x2 - x, dz = d.z2 - z, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 2)), ang = Math.atan2(dx, dz), c = tm(d.c || '#f3e6d0');
      for (let i = 0; i <= n; i++) m(parent, BOX(), c, x + (dx * i) / n, y + 0.5, z + (dz * i) / n, 0.14, 1, 0.14);
      for (const h of [0.35, 0.8]) m(parent, BOX(), c, x + dx / 2, y + h, z + dz / 2, 0.06, 0.1, L, ang);
      break;
    }
    case 'flags': { // (x, z) → (x2, z2) 줄에 매단 삼각 깃발
      const dx = d.x2 - x, dz = d.z2 - z, L = Math.hypot(dx, dz), n = Math.max(2, Math.round(L / 1.2)), h = d.h || 4;
      for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, sag = Math.sin(k * Math.PI) * 0.6; const f = m(parent, CONE(), tm(['#ff8fb8', '#ffd84d', '#7cd8ff', '#9be7c4'][i % 4]), x + dx * k, y + h - sag - 0.25, z + dz * k, 0.22, 0.5, 0.04, Math.atan2(dx, dz) + Math.PI / 2); f.rotation.x = Math.PI; }
      break;
    }
    case 'puddle': m(parent, CYL(), tm(d.c || '#ff8fc4', { transparent: true, opacity: 0.55 }), x, y + 0.02, z, 1.6 * s, 0.03, 1.1 * s, x); break;
    case 'jelly': { // 커다란 젤리 덩어리 장식
      const c = d.c || '#ff8fc4';
      m(parent, SPH(), tm(c, { transparent: true, opacity: 0.8 }), x, y + 0.7 * s, z, 1.1 * s, 0.75 * s, 1.1 * s);
      m(parent, SPH(), tm('#ffffff', { transparent: true, opacity: 0.55 }), x - 0.35 * s, y + 1.15 * s, z + 0.4 * s, 0.25 * s, 0.14 * s, 0.18 * s);
      break;
    }
    case 'cone': m(parent, CONE(), tm('#ff7a3d'), x, y + 0.35, z, 0.25, 0.7, 0.25); m(parent, CYL(), tm('#ffffff'), x, y + 0.35, z, 0.17, 0.08, 0.17); break;
    case 'sign': { m(parent, CYL(), tm('#5b5b66'), x, y + 1.2, z, 0.06, 2.4, 0.06); const b = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshToonMaterial({ map: signTex(d.text || '!', d.c || '#ff5c8a'), side: THREE.DoubleSide })); b.position.set(x, y + 2.6, z); b.rotation.y = d.r || 0; b.userData.dynamic = true; parent.add(b); break; }
    case 'crane': { const c = tm('#ffb02e'); m(parent, BOX(), c, x, y + 9, z, 1, 18, 1); m(parent, BOX(), c, x + 6, y + 17.5, z, 14, 0.8, 0.8); m(parent, BOX(), tm('#4a4a58'), x + 11, y + 13, z, 0.1, 9, 0.1); m(parent, BOX(), tm('#4a4a58'), x - 2, y + 17, z, 2.5, 1.5, 1.5); break; }
    case 'bench': m(parent, BOX(), tm('#b57a46'), x, y + 0.45, z, 1.8, 0.1, 0.5, d.r || 0); m(parent, BOX(), tm('#b57a46'), x, y + 0.75, z - 0.22, 1.8, 0.5, 0.08, d.r || 0); break;
    case 'umbrella': m(parent, CYL(), tm('#eeeeee'), x, y + 1.2, z, 0.05, 2.4, 0.05); m(parent, CONE(), tm(d.c || '#ff8fb8'), x, y + 2.5, z, 1.4, 0.5, 1.4); break;
    case 'boat': { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = d.r || 0; parent.add(g); m(g, BOX(), tm('#ffffff'), 0, 0.5, 0, 3, 1, 8); m(g, BOX(), tm('#ff5c8a'), 0, 1.05, 0, 3.05, 0.15, 8.05); m(g, BOX(), tm('#7cd8ff'), 0, 1.6, -1, 2, 1.2, 2.5); break; }
  }
}
// 집 지붕: 상자 위에 세모 지붕 (보기만)
function pitchedRoof(parent, b, col) {
  const w = b.w + 0.7, dd = b.d + 0.7, h = Math.min(b.w, b.d) * 0.32;
  const geo = gc(`roof`, () => {
    const g = new THREE.BufferGeometry();
    const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
    const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  });
  const o = new THREE.Mesh(geo, tm(col));
  o.position.set(b.x, b.y + b.h, b.z); o.scale.set(w, h, dd);
  if (b.w < b.d) o.rotation.y = Math.PI / 2, o.scale.set(dd, h, w);
  parent.add(o);
}
const ROOFS = ['#e0645c', '#5c8fe0', '#7a5ce0', '#e0a65c', '#5cb88f', '#e05c9a'];

export function buildMap(scene, map) {
  const g = new THREE.Group();
  // 바닥 (바다 맵이면 섬 바닥 + 바다)
  const ft = floorTex(map.floor, map.floor2).clone(); ft.needsUpdate = true;
  const fw = map.W + (map.sea ? 10 : 40), fd = map.D + (map.sea ? 10 : 40);
  ft.repeat.set(fw / 4, fd / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd), new THREE.MeshToonMaterial({ map: ft }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  if (map.sea) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshToonMaterial({ color: map.sea, transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.3; g.add(sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(fw + 16, fd + 16), new THREE.MeshToonMaterial({ color: '#f1dcaa' }));
    sand.rotation.x = -Math.PI / 2; sand.position.y = -0.15; g.add(sand);
  }
  // 길 (바닥 위에 얇게)
  for (const r of map.roads || []) { const o = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), tm(r.c || '#6b6b78')); o.rotation.x = -Math.PI / 2; o.position.set(r.x, 0.02, r.z); g.add(o); if (r.line) { const l = new THREE.Mesh(new THREE.PlaneGeometry(r.w > r.d ? r.w : 0.2, r.w > r.d ? 0.2 : r.d), tm('#f5e9a8')); l.rotation.x = -Math.PI / 2; l.position.set(r.x, 0.03, r.z); g.add(l); } }
  // 상자들: 크기에 맞춰 무늬가 반복되게 (면마다 UV 를 늘린다)
  const parts = new THREE.Group();
  const mats = new Map(), mat = (key, make) => mats.get(key) || mats.set(key, make()).get(key); // 같은 종류는 재질을 같이 써서 합쳐 그린다
  for (const b of map.boxes) {
    if (b.hide) continue;
    const col = map.colors[b.k] || '#aaaaaa';
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = geo.attributes.uv, S = b.k === 'crate' ? 1.3 : 3;
    for (let f = 0; f < 6; f++) { const [su, sv] = f < 2 ? [b.d, b.h] : f < 4 ? [b.w, b.d] : [b.w, b.h]; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * Math.max(1, su / S), uv.getY(k) * Math.max(1, sv / S)); } }
    const mesh = new THREE.Mesh(geo, mat(b.k, () => new THREE.MeshToonMaterial({ map: kindTex(b.k, col) })));
    mesh.position.set(b.x, b.y + b.h / 2, b.z);
    parts.add(mesh);
    if (b.roof === 'pitch') pitchedRoof(parts, b, ROOFS[Math.abs(Math.round(b.x * 3 + b.z)) % ROOFS.length]);
    else if (b.h >= 5 && b.k !== 'outer' && !b.k.startsWith('tank') && b.roof !== 'none' && !['cliff', 'pole', 'pillar', 'gold', 'ice'].includes(b.k)) { const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4), mat('roof|' + col, () => new THREE.MeshToonMaterial({ color: map.colors.roof || shade(col, 0.6) }))); roof.position.set(b.x, b.y + b.h + 0.2, b.z); parts.add(roof); }
  }
  const lights = [];
  for (const d of map.deco || []) deco(parts, d, lights);
  g.add(bakeStatic(parts));
  for (const l of lights) g.add(l);
  // 하늘 (그라데이션 공)
  const skyR = Math.max(380, Math.max(map.W, map.D) * 1.6); // 카메라가 그리는 거리 안쪽에
  const sky = new THREE.Mesh(new THREE.SphereGeometry(skyR, 24, 12), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(map.sky[0]) }, mid: { value: new THREE.Color(map.sky[1]) }, bot: { value: new THREE.Color(map.sky[2]) } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.5, 0.0, 1.0), 0.7)) : mix(mid, bot, clamp(-h * 3.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
  }));
  g.add(sky);
  // 구름 몇 개
  for (let i = 0; i < (map.clouds ?? 10); i++) {
    const c = new THREE.Group(), R = 160 + (i * 37) % 120, a = i * 2.3;
    for (let k = 0; k < 4; k++) m(c, SPH(), tm('#ffffff', { transparent: true, opacity: 0.85 }), k * 5 - 7, (k % 2) * 2, (k % 3) * 2, 6 - Math.abs(k - 1.5), 3.5, 5);
    c.position.set(Math.cos(a) * R * skyR / 400, 55 + (i % 4) * 10, Math.sin(a) * R * skyR / 400); g.add(c);
  }
  scene.add(g);
  scene.fog = new THREE.Fog(map.sky[1], map.fog[0], map.fog[1]);
  const hemi = new THREE.HemisphereLight(map.sky[0], map.floor2, 1.3); g.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(30, 60, 20); g.add(sun);
  return { group: g, sky, dispose() { scene.remove(g); } };
}
