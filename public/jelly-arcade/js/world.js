// 젤리 아케이드 그리기: 격자 판 · 맵마다 다른 블록 · 젤리 상자 · 젤리 폭탄 · 물결 · 아이템 · 갇힘 젤리 · 내려오는 푸딩 블록
//   같은 물체는 인스턴스로 한 번에 그린다 (그리기 호출을 줄여 휴대폰도 60프레임)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W, H, idx, EMPTY, SOLID, BOX, HOLE, FALLEN, ICE, FLAME_T } from './sim.js';

export const CELL = 2, TOP = 0.3;
export const wx = (x) => (x - (W - 1) / 2) * CELL;
export const wz = (y) => (y - (H - 1) / 2) * CELL;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const C = (c) => new THREE.Color(c);

// ---------- 맵마다 색 · 빛 ----------
export const THEMES = {
  candy: {
    sky: '#ffd6ea', skyTop: '#9fd8ff', fog: '#ffe3f1', hemi: ['#fff6fb', '#c9a0ff', 1.25], sun: ['#fff1dc', 2.1], tileA: '#fff3df', tileB: '#ffe6cc', grout: '#e9b98f',
    wave: '#ff4fa0', waveHi: '#ffd2ea', boxes: ['#ff5c86', '#ffc53d', '#a374ff', '#3fd6a6', '#5bb8ff'], tray: '#9a5a36', trayTop: '#c98a5a',
  },
  factory: {
    sky: '#cfd8e6', skyTop: '#8fa6c4', fog: '#c9d3e2', hemi: ['#f4f8ff', '#6d6458', 1.15], sun: ['#fff0d6', 2.0], tileA: '#a9b4c4', tileB: '#9aa6b7', grout: '#5e6878',
    wave: '#25d9c6', waveHi: '#c8fff7', boxes: ['#ff8a2b', '#a4e04a', '#ff5f6d', '#ffd23f'], tray: '#3d4452', trayTop: '#5a6273',
  },
  ice: {
    sky: '#d8f3ff', skyTop: '#8fd0ff', fog: '#e4f7ff', hemi: ['#ffffff', '#8fb7d9', 1.3], sun: ['#fffaf0', 2.0], tileA: '#f6fbff', tileB: '#e8f3fc', grout: '#b8d4ea',
    wave: '#7a6bff', waveHi: '#e3dcff', boxes: ['#6fd4ff', '#ff9ec7', '#a8f0d0', '#c5b3ff'], tray: '#e9f6ff', trayTop: '#ffffff',
  },
};

// 기하 조각을 색을 칠해 하나로 (그리기 호출 하나)
function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const c = C(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const merge = (parts) => mergeGeometries(parts, false);
const RB = (w, h, d, r = 0.1, s = 2) => new RoundedBoxGeometry(w, h, d, s, r);
const SPH = (r, a = 16, b = 12, ...rest) => new THREE.SphereGeometry(r, a, b, ...rest);
const CYL = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
// 젤리 재질: 반투명 · 하이라이트 · 안쪽에서 비치는 빛 (인스턴스 색으로 스스로 은은하게 빛난다)
function jellyMat({ glow = 0.32, ...opts } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.84, sheen: 0.4, sheenColor: C('#ffffff'), ...opts });
  // glow: 인스턴스 색으로 스스로 빛나는 정도
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
        totalEmissiveRadiance += vColor.rgb * (${glow.toFixed(2)} + fres * 0.35);
      #endif`);
  };
  m.customProgramCacheKey = () => `jelly${glow}`;
  return m;
}
const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, ...o });

// 그라데이션 하늘
function skyTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.65, bottom); g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 부드러운 동그라미 (그림자 · 빛 번짐)
let blobT = null;
export function blobTex() {
  if (blobT) return blobT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobT = new THREE.CanvasTexture(c); return blobT;
}
// 컨베이어 띠 무늬
function beltTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#3b4250'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#2c313c'; for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 64, 3);
  x.fillStyle = '#ffcf3a'; x.beginPath(); x.moveTo(14, 40); x.lineTo(32, 22); x.lineTo(50, 40); x.lineTo(42, 40); x.lineTo(32, 30); x.lineTo(22, 40); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function waterTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#3aa7e0'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,255,255,${0.12 + (i % 3) * 0.08})`; x.lineWidth = 2; x.beginPath(); const yy = (i * 37) % 128, xx = (i * 53) % 128; x.moveTo(xx, yy); x.quadraticCurveTo(xx + 8, yy - 4, xx + 16, yy); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- 맵마다 안 부서지는 블록 (모양 여러 가지) ----------
function solidKinds(map) {
  if (map === 'candy') {
    // 사탕 지붕 집: 벽 · 아이싱 · 지붕 · 창 · 문 · 막대사탕 굴뚝 (집마다 색이 다르다)
    const walls = ['#fff1f6', '#fff8e1', '#eef7ff', '#f1ffe8'], roofs = [['#ff6f9f', '#ffe1ec'], ['#7ad7c0', '#e4fff6'], ['#ffb84d', '#fff1d6'], ['#a98bff', '#efe7ff']];
    return roofs.map(([roof, ice], k) => merge([
      part(RB(1.72, 1.15, 1.6, 0.14), walls[k], { y: 0.58 }),
      part(CYL(1.0, 1.06, 0.14, 24), ice, { y: 1.2 }),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => part(SPH(0.11, 8, 6), ice, { x: Math.cos(i * 0.785 + 0.39) * 0.98, y: 1.08, z: Math.sin(i * 0.785 + 0.39) * 0.9, sy: 1.7 })),
      part(new THREE.ConeGeometry(1.22, 1.1, 4, 1), roof, { y: 1.82, ry: Math.PI / 4, sz: 0.94 }),
      part(SPH(0.16, 10, 8), ice, { y: 2.42 }),
      part(RB(0.42, 0.62, 0.12, 0.06), '#8a4b2f', { x: k % 2 ? 0.42 : -0.42, y: 0.31, z: 0.8 }),
      part(SPH(0.05, 6, 6), '#ffd166', { x: k % 2 ? 0.3 : -0.3, y: 0.33, z: 0.87 }),
      part(CYL(0.2, 0.2, 0.08, 16), '#ffe9a8', { x: k % 2 ? -0.38 : 0.38, y: 0.72, z: 0.8, rx: Math.PI / 2 }),
      part(CYL(0.25, 0.25, 0.06, 16), '#ffffff', { x: k % 2 ? -0.38 : 0.38, y: 0.72, z: 0.79, rx: Math.PI / 2 }),
      part(RB(0.04, 0.34, 0.04, 0.01, 1), '#ffffff', { x: k % 2 ? -0.38 : 0.38, y: 0.72, z: 0.85 }),
      part(CYL(0.035, 0.035, 0.7, 6), '#ffffff', { x: k % 2 ? -0.5 : 0.5, y: 2.0, z: -0.35 }),
      part(SPH(0.24, 14, 10), roof, { x: k % 2 ? -0.5 : 0.5, y: 2.42, z: -0.35, sz: 0.45 }),
      part(new THREE.TorusGeometry(0.15, 0.035, 6, 18), '#ffffff', { x: k % 2 ? -0.5 : 0.5, y: 2.42, z: -0.33 }),
    ]));
  }
  if (map === 'factory') {
    // 젤리 기계: 강철 몸통 · 노란 띠 · 리벳 · 파이프 · 계기판 (세 가지)
    const steel = '#b5c0cf', dark = '#4b5361', band = '#ffc928';
    const rivets = (y) => [-0.7, 0.7].flatMap((x) => [part(SPH(0.06, 6, 5), '#8792a3', { x, y, z: 0.9 })]);
    const base = () => [part(RB(1.8, 1.45, 1.8, 0.1), steel, { y: 0.73 }), part(RB(1.86, 0.22, 1.86, 0.05, 1), band, { y: 0.22 }), ...[-0.6, -0.2, 0.2, 0.6].map((x) => part(RB(0.13, 0.24, 0.05, 0.02, 1), '#2f3540', { x, y: 0.22, z: 0.93, rz: 0.6 })), ...rivets(1.25)];
    return [
      merge([...base(), part(CYL(0.28, 0.32, 0.9, 14), dark, { x: 0.4, y: 1.9, z: -0.3 }), part(new THREE.TorusGeometry(0.33, 0.06, 6, 16), band, { x: 0.4, y: 2.2, z: -0.3, rx: Math.PI / 2 }), part(CYL(0.1, 0.1, 1.5, 8), '#7f8a9c', { x: -0.55, y: 1.5, z: 0.95, rz: Math.PI / 2, sx: 0.8 }), part(CYL(0.24, 0.24, 0.05, 18), '#f4f6f9', { y: 0.8, z: 0.92, rx: Math.PI / 2 }), part(RB(0.04, 0.17, 0.02, 0.01, 1), '#e2453c', { x: 0.05, y: 0.85, z: 0.96, rz: -0.7 })]),
      merge([...base(), part(RB(1.2, 0.3, 1.2, 0.08), dark, { y: 1.6 }), part(CYL(0.16, 0.16, 0.7, 12), '#d7dde6', { y: 2.05 }), part(RB(0.7, 0.18, 0.7, 0.06), band, { y: 2.45 }), part(RB(0.9, 0.36, 0.06, 0.04), '#1f2a37', { y: 0.85, z: 0.92 }), part(RB(0.7, 0.06, 0.02, 0.01, 1), '#5fffb0', { y: 0.85, z: 0.96 })]),
      merge([...base(), part(SPH(0.75, 18, 12), '#d0d8e3', { y: 1.5, sy: 0.75 }), part(CYL(0.08, 0.08, 0.6, 8), dark, { x: -0.45, y: 1.9, z: 0.2 }), part(CYL(0.08, 0.08, 0.6, 8), dark, { x: 0.45, y: 1.9, z: 0.2 }), part(CYL(0.08, 0.08, 1.0, 8), dark, { y: 2.2, z: 0.2, rz: Math.PI / 2 }), part(CYL(0.22, 0.22, 0.05, 18), '#f4f6f9', { x: -0.4, y: 0.8, z: 0.92, rx: Math.PI / 2 }), part(CYL(0.22, 0.22, 0.05, 18), '#f4f6f9', { x: 0.4, y: 0.8, z: 0.92, rx: Math.PI / 2 })]),
    ];
  }
  // 얼음 과자 섬: 눈 덮인 쿠키 바위 위 얼음 결정 (결정은 따로 반투명)
  return [0, 1, 2].map((k) => merge([
    part(CYL(0.95, 1.0, 0.7, 20), '#d9a46a', { y: 0.35 }),
    part(CYL(0.98, 0.98, 0.1, 20), '#b07a45', { y: 0.12 }),
    ...[0, 1, 2, 3, 4, 5].map((i) => part(SPH(0.09, 6, 5), '#6b3d1f', { x: Math.cos(i * 1.05 + k) * 0.62, y: 0.45 + (i % 2) * 0.12, z: Math.sin(i * 1.05 + k) * 0.62 + 0.3 * (i === 1) })),
    part(SPH(0.98, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { y: 0.68, sy: 0.38 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => part(SPH(0.14, 8, 6), '#ffffff', { x: Math.cos(i * 0.785) * 0.92, y: 0.62, z: Math.sin(i * 0.785) * 0.92, sy: 1.3 })),
  ]));
}
function iceCrystal(k) {
  const g = [];
  const n = 3 + k;
  for (let i = 0; i < n; i++) {
    const a = i * 2.1 + k, r = i === 0 ? 0 : 0.42;
    g.push(part(new THREE.OctahedronGeometry(0.4, 0), '#ffffff', { x: Math.cos(a) * r, y: 1.15 + (i === 0 ? 0.35 : 0), z: Math.sin(a) * r, sx: 0.55, sy: i === 0 ? 2.3 : 1.5, sz: 0.55, rz: i ? Math.cos(a) * 0.35 : 0, rx: i ? Math.sin(a) * 0.35 : 0 }));
  }
  return merge(g);
}

// ---------- 젤리 상자 안 곰젤리 · 아이템 모양 ----------
function gummyCore() {
  return merge([part(SPH(0.26, 12, 10), '#ffffff', { y: 0.16 }), part(SPH(0.2, 12, 10), '#ffffff', { y: 0.48 }), part(SPH(0.08, 8, 6), '#ffffff', { x: -0.14, y: 0.64 }), part(SPH(0.08, 8, 6), '#ffffff', { x: 0.14, y: 0.64 }), part(SPH(0.08, 8, 6), '#ffffff', { x: -0.22, y: 0.24 }), part(SPH(0.08, 8, 6), '#ffffff', { x: 0.22, y: 0.24 }), part(SPH(0.09, 8, 6), '#ffffff', { x: -0.13, y: -0.05 }), part(SPH(0.09, 8, 6), '#ffffff', { x: 0.13, y: -0.05 })]);
}
export function itemMesh(type) {
  const g = new THREE.Group(), mats = [];
  const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, ...o }); mats.push(m); return m; };
  const add = (geo, m, o = {}) => { const me = new THREE.Mesh(geo, m); me.position.set(o.x || 0, o.y || 0, o.z || 0); me.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); me.scale.set(o.sx || 1, o.sy || 1, o.sz || 1); g.add(me); return me; };
  let glow = '#ffffff';
  if (type === 'candy') {
    // 별사탕: 동글한 몸에 뿔이 송송
    glow = '#ffe066';
    const m = M('#ffe9a3', { emissive: '#ffb84d', emissiveIntensity: 0.25, roughness: 0.3 });
    add(SPH(0.32, 16, 12), m);
    const ico = new THREE.IcosahedronGeometry(1, 0), p = ico.attributes.position, seen = new Set();
    const m2 = M('#ffffff', { emissive: '#ffd1e8', emissiveIntensity: 0.3 });
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = v.toArray().map((a) => a.toFixed(2)).join(); if (seen.has(k)) continue; seen.add(k); const c = add(new THREE.ConeGeometry(0.09, 0.18, 8), seen.size % 2 ? m2 : m); c.position.copy(v.multiplyScalar(0.34)); c.lookAt(c.position.clone().multiplyScalar(2)); c.rotateX(Math.PI / 2); }
  } else if (type === 'syrup') {
    // 시럽병: 반투명 호박색 병 · 목 · 코르크 · 리본 라벨
    glow = '#ff9a3c';
    add(CYL(0.26, 0.3, 0.5, 18), new THREE.MeshPhysicalMaterial({ color: '#ffb24d', transparent: true, opacity: 0.85, roughness: 0.1, clearcoat: 1, emissive: '#ff7a1a', emissiveIntensity: 0.35 }), { y: -0.05 });
    add(SPH(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffc46b', { transparent: true, opacity: 0.85 }), { y: 0.2, sy: 0.6 });
    add(CYL(0.1, 0.12, 0.2, 12), M('#ffd9a0', { transparent: true, opacity: 0.9 }), { y: 0.38 });
    add(CYL(0.11, 0.1, 0.12, 12), M('#9a5d33'), { y: 0.52 });
    add(CYL(0.305, 0.305, 0.16, 18), M('#ff5c86'), { y: -0.08 });
    add(SPH(0.07, 8, 6), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), { x: -0.12, y: 0.08, z: 0.22 });
  } else if (type === 'shoe') {
    // 운동화: 하얀 밑창 · 빨간 몸 · 끈 · 날개 줄무늬
    glow = '#6ec6ff';
    add(RB(0.36, 0.1, 0.72, 0.05), M('#ffffff'), { y: -0.18 });
    add(RB(0.34, 0.26, 0.5, 0.12), M('#ff4f6d'), { y: -0.02, z: -0.08 });
    add(SPH(0.18, 14, 10), M('#ff4f6d'), { y: -0.07, z: 0.18, sx: 0.95, sy: 0.65 });
    add(RB(0.3, 0.3, 0.12, 0.05), M('#ff4f6d'), { y: 0.12, z: -0.28 });
    for (let i = 0; i < 3; i++) add(RB(0.22, 0.03, 0.04, 0.01, 1), M('#ffffff'), { y: 0.12 - i * 0.02, z: 0.02 + i * 0.09 });
    add(RB(0.02, 0.06, 0.34, 0.01, 1), M('#ffd84d'), { x: 0.175, y: -0.04, z: -0.05 });
    add(RB(0.02, 0.06, 0.34, 0.01, 1), M('#ffd84d'), { x: -0.175, y: -0.04, z: -0.05 });
    g.rotation.y = 0.6;
  } else {
    // 탈출 젤리: 날개 달린 민트 젤리 방울
    glow = '#7dffcf';
    add(SPH(0.28, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#5fe8b5', transparent: true, opacity: 0.85, roughness: 0.15, clearcoat: 1, emissive: '#2fc690', emissiveIntensity: 0.35 }), { sy: 1.1 });
    add(SPH(0.09, 8, 6), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.5 }), { x: -0.1, y: 0.13, z: 0.2 });
    const wm = M('#ffffff', { transparent: true, opacity: 0.92, emissive: '#cffff0', emissiveIntensity: 0.4 });
    add(SPH(0.2, 12, 8), wm, { x: -0.34, y: 0.1, sx: 1, sy: 0.55, sz: 0.25, rz: 0.5 });
    add(SPH(0.2, 12, 8), wm, { x: 0.34, y: 0.1, sx: 1, sy: 0.55, sz: 0.25, rz: -0.5 });
    add(SPH(0.04, 6, 6), M('#2a2340'), { x: -0.09, y: 0.02, z: 0.26 });
    add(SPH(0.04, 6, 6), M('#2a2340'), { x: 0.09, y: 0.02, z: 0.26 });
  }
  const glowM = new THREE.MeshBasicMaterial({ map: blobTex(), color: glow, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), glowM); disc.rotation.x = -Math.PI / 2; mats.push(glowM);
  const root = new THREE.Group(); root.add(g); root.add(disc); root.userData = { body: g, disc };
  root.traverse((o) => { if (o.isMesh && o !== disc) o.castShadow = true; });
  return root;
}

// ---------- 판 ----------
export class Board {
  constructor(scene, S, { phone = false } = {}) {
    this.scene = scene; this.S = S; this.map = S.map; this.th = THEMES[S.map]; this.phone = phone;
    this.root = new THREE.Group(); scene.add(this.root);
    this.disposables = [];
    this.t = 0;
    this.buildEnv();
    this.buildFloor();
    this.buildSolids();
    this.buildBoxes();
    this.buildFx();
    this.bombs = new Map(); this.items = new Map(); this.traps = new Map();
    this.syncBoxes(); this.syncFallen();
  }
  add(o) { this.root.add(o); return o; }
  keep(...a) { this.disposables.push(...a); }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m?.map?.dispose?.(); m?.dispose?.(); } } });
    this.scene.background = null; this.scene.fog = null;
  }
  inst(geo, mat, n, shadow = true, recv = false) { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = 0; m.castShadow = shadow; m.receiveShadow = recv; m.frustumCulled = false; this.add(m); return m; }

  // 하늘 · 판 받침 · 울타리 · 판 밖 풍경 (맵마다)
  buildEnv() {
    const th = this.th, s = this.scene;
    s.background = skyTex(th.skyTop, th.sky);
    s.fog = new THREE.Fog(th.fog, 48, 110);
    const out = [];
    const bw = W * CELL + 1.6, bd = H * CELL + 1.6;
    if (this.map === 'candy') {
      // 비스킷 쟁반 위의 판 · 둘레는 잔디 언덕 · 막대사탕 나무 · 젤리 방울 · 사탕 울타리
      out.push(part(RB(bw + 1.2, 1.4, bd + 1.2, 0.5, 3), '#d99a62', { y: -0.65 }));
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; out.push(part(SPH(0.22, 8, 6), '#b97843', { x: Math.cos(a) * (bw / 2 + 0.4) * (Math.abs(Math.cos(a)) > 0.7 ? 1 : 0.98), y: 0.02, z: Math.sin(a) * (bd / 2 + 0.4), sy: 0.5 })); }
      out.push(part(new THREE.CircleGeometry(120, 48), '#a6e58f', { y: -1.2, rx: -Math.PI / 2 }));
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.1, r = 22 + (hash(i, 3) % 900) / 60, x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r * 0.95 - 4;
        if (z > 10 && Math.abs(x) < 26) continue;
        const k = i % 3, col = ['#ff6f9f', '#7ad7c0', '#ffb84d', '#a98bff'][i % 4];
        if (k === 0) { out.push(part(CYL(0.12, 0.12, 3.2, 8), '#ffffff', { x, y: 0.4, z }), part(CYL(1.1, 1.1, 0.35, 24), col, { x, y: 2.4, z, rx: Math.PI / 2 }), part(new THREE.TorusGeometry(0.7, 0.13, 8, 24), '#ffffff', { x, y: 2.4, z: z + 0.18 }), part(new THREE.TorusGeometry(0.35, 0.1, 8, 20), '#ffffff', { x, y: 2.4, z: z + 0.18 })); }
        else if (k === 1) out.push(part(SPH(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), col, { x, y: -1.2, z, sy: 1.3 }), part(SPH(0.25, 8, 6), '#ffffff', { x: x - 0.4, y: 0.1, z: z + 0.6 }));
        else out.push(part(SPH(1.8, 14, 10), '#8fd877', { x, y: -1.4, z, sy: 0.6 }), part(SPH(0.25, 8, 6), col, { x: x + 0.5, y: -0.4, z: z + 1.2 }), part(SPH(0.22, 8, 6), '#ffffff', { x: x - 0.6, y: -0.5, z: z + 1.1 }));
      }
      // 사탕 지팡이 울타리 (빨강 · 하양 마디)
      const fence = [];
      for (let x = -1; x <= W; x++) for (const y of [-1, H]) fence.push([x, y]);
      for (let y = 0; y < H; y++) for (const x of [-1, W]) fence.push([x, y]);
      for (const [x, y] of fence) {
        const px = wx(x) + (x < 0 ? 0.6 : x >= W ? -0.6 : 0), pz = wz(y) + (y < 0 ? 0.6 : y >= H ? -0.6 : 0);
        for (let j = 0; j < 4; j++) out.push(part(CYL(0.13, 0.13, 0.2, 10), j % 2 ? '#ffffff' : '#ff4f6d', { x: px, y: 0.1 + j * 0.2, z: pz }));
        out.push(part(SPH(0.16, 10, 8), '#ff4f6d', { x: px, y: 0.85, z: pz }));
      }
      for (let x = -1; x < W; x++) for (const y of [-1, H]) out.push(part(CYL(0.06, 0.06, CELL, 8), '#ffd1e0', { x: wx(x) + CELL / 2, y: 0.6, z: wz(y) + (y < 0 ? 0.6 : -0.6), rz: Math.PI / 2 }));
      for (let y = -1; y < H; y++) for (const x of [-1, W]) out.push(part(CYL(0.06, 0.06, CELL, 8), '#ffd1e0', { x: wx(x) + (x < 0 ? 0.6 : -0.6), y: 0.6, z: wz(y) + CELL / 2, rx: Math.PI / 2 }));
    } else if (this.map === 'factory') {
      // 강철 작업대 · 노란 안전 난간 · 둘레 바닥 · 큰 톱니 · 파이프
      out.push(part(RB(bw + 1.2, 1.4, bd + 1.2, 0.25, 2), '#4a5262', { y: -0.65 }));
      for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; out.push(part(CYL(0.12, 0.12, 0.1, 8), '#8d97a8', { x: Math.cos(a) * (bw / 2 + 0.3), y: 0.06, z: Math.sin(a) * (bd / 2 + 0.3) })); }
      out.push(part(new THREE.PlaneGeometry(240, 240), '#8a919c', { y: -1.25, rx: -Math.PI / 2 }));
      for (let i = -6; i <= 6; i++) out.push(part(RB(0.25, 0.02, 120, 0.01, 1), '#c9a227', { x: i * 9, y: -1.22 }));
      for (const [x, z, r] of [[-24, -14, 5], [25, -12, 4], [-28, 8, 3.2], [27, 10, 3.6]]) {
        out.push(part(CYL(r, r, 0.8, 28), '#7a8496', { x, y: r * 0.4, z, rx: Math.PI / 2 }));
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; out.push(part(RB(0.9, 0.9, 0.8, 0.1, 1), '#7a8496', { x: x + Math.cos(a) * (r + 0.3), y: r * 0.4 + Math.sin(a) * (r + 0.3), z, rz: a })); }
        out.push(part(CYL(r * 0.3, r * 0.3, 1, 18), '#ffc928', { x, y: r * 0.4, z, rx: Math.PI / 2 }));
      }
      for (const z of [-17, 15]) { out.push(part(CYL(0.6, 0.6, 70, 14), '#b0773a', { y: 3.5, z, rz: Math.PI / 2 })); for (let x = -30; x <= 30; x += 10) out.push(part(CYL(0.75, 0.75, 0.4, 14), '#d6a14f', { x, y: 3.5, z, rz: Math.PI / 2 })); }
      for (let x = -1; x <= W; x++) for (const y of [-1, H]) out.push(part(CYL(0.08, 0.08, 1.0, 8), '#2f3540', { x: wx(x), y: 0.5, z: wz(y) + (y < 0 ? 0.6 : -0.6) }));
      for (let y = 0; y < H; y++) for (const x of [-1, W]) out.push(part(CYL(0.08, 0.08, 1.0, 8), '#2f3540', { x: wx(x) + (x < 0 ? 0.6 : -0.6), y: 0.5, z: wz(y) }));
      for (const y of [-1, H]) out.push(part(RB(bw - 0.2, 0.16, 0.16, 0.06, 1), '#ffc928', { y: 0.95, z: wz(y) + (y < 0 ? 0.6 : -0.6) }));
      for (const x of [-1, W]) out.push(part(RB(0.16, 0.16, bd - 0.2, 0.06, 1), '#ffc928', { x: wx(x) + (x < 0 ? 0.6 : -0.6), y: 0.95 }));
    } else {
      // 눈 덮인 섬 · 둘레 바다 · 떠다니는 얼음 · 고드름 울타리
      out.push(part(CYL(1, 1.1, 1.6, 48), '#ffffff', { y: -0.8, sx: bw * 0.62, sz: bd * 0.68 }));
      out.push(part(CYL(1, 1, 0.5, 48), '#cfe9ff', { y: -1.6, sx: bw * 0.66, sz: bd * 0.72 }));
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + 0.2, r = 22 + (hash(i, 9) % 10); const x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * 0.9; if (z > 12 && Math.abs(x) < 22) continue; out.push(part(CYL(1.6 + (i % 3) * 0.6, 1.9 + (i % 3) * 0.6, 0.6, 7), '#f3fbff', { x, y: -1.3, z, ry: i })); if (i % 2) out.push(part(new THREE.ConeGeometry(0.7, 1.6, 6), '#bfe6ff', { x: x + 0.5, y: -0.4, z, ry: i })); }
      for (let x = -1; x <= W; x++) for (const y of [-1, H]) out.push(part(SPH(0.55, 10, 8), '#ffffff', { x: wx(x), y: 0.1, z: wz(y) + (y < 0 ? 0.55 : -0.55), sy: 0.6 }), part(new THREE.ConeGeometry(0.16, 0.6, 6), '#bfe8ff', { x: wx(x) + 0.5, y: 0.45, z: wz(y) + (y < 0 ? 0.55 : -0.55) }));
      for (let y = 0; y < H; y++) for (const x of [-1, W]) out.push(part(SPH(0.55, 10, 8), '#ffffff', { x: wx(x) + (x < 0 ? 0.55 : -0.55), y: 0.1, z: wz(y), sy: 0.6 }));
      // 바다
      const wt = waterTex(); wt.repeat.set(30, 30); this.seaTex = wt;
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: wt, color: '#9fdcff', roughness: 0.25, metalness: 0.1 }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = -1.5; sea.receiveShadow = true; this.add(sea);
    }
    const env = new THREE.Mesh(merge(out), std({ roughness: 0.6 }));
    env.receiveShadow = true; env.castShadow = false; this.add(env);
  }
  buildFloor() {
    const th = this.th, S = this.S;
    const tiles = [], conv = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const f = S.floor[idx(x, y)]; if (f >= 2) conv.push([x, y, f]); else tiles.push([x, y, f]); }
    // 바닥 판 (모서리 둥근 타일 · 줄눈)
    const grout = new THREE.Mesh(new THREE.BoxGeometry(W * CELL + 0.1, 0.2, H * CELL + 0.1), new THREE.MeshStandardMaterial({ color: th.grout, roughness: 0.9 }));
    grout.position.y = 0.0; grout.receiveShadow = true; this.add(grout);
    const geo = RB(CELL - 0.08, 0.3, CELL - 0.08, 0.08, 2);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: this.map === 'ice' ? 0.35 : this.map === 'factory' ? 0.5 : 0.7, metalness: this.map === 'factory' ? 0.25 : 0 });
    const im = this.inst(geo, mat, tiles.length, false, true);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    tiles.forEach(([x, y, f], i) => {
      m4.makeTranslation(wx(x), TOP / 2, wz(y)); im.setMatrixAt(i, m4);
      const base = f === ICE ? '#93d6fb' : (x + y) % 2 ? th.tileA : th.tileB;
      col.set(base); const n = ((hash(x, y) % 100) / 100 - 0.5) * 0.04; col.offsetHSL(0, 0, n); im.setColorAt(i, col);
    });
    im.count = tiles.length;
    // 얼음 칸: 위에 반짝이는 얼음 판 하나 더
    const ice = tiles.filter(([, , f]) => f === ICE);
    if (ice.length) {
      const ig = RB(CELL - 0.22, 0.08, CELL - 0.22, 0.04, 1);
      const imat = new THREE.MeshPhysicalMaterial({ color: '#d9f4ff', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.75 });
      const ii = this.inst(ig, imat, ice.length, false, true);
      ice.forEach(([x, y], i) => { m4.makeTranslation(wx(x), TOP + 0.03, wz(y)); ii.setMatrixAt(i, m4); }); ii.count = ice.length;
      // 얼음 위 금 (빛 받는 줄)
      const cr = [];
      for (const [x, y] of ice) { const h = hash(x, y); cr.push(part(RB(0.9, 0.012, 0.03, 0.005, 1), '#ffffff', { x: wx(x) + ((h % 7) - 3) * 0.08, y: TOP + 0.08, z: wz(y) + ((h % 5) - 2) * 0.12, ry: (h % 314) / 100 })); }
      const crm = new THREE.Mesh(merge(cr), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 })); this.add(crm);
    }
    // 컨베이어 (화살표가 흐른다)
    if (conv.length) {
      const bt = beltTex(); this.beltTex = bt;
      const cg = RB(CELL - 0.06, 0.32, CELL - 0.06, 0.06, 1);
      const cm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6, metalness: 0.2 });
      const ci = this.inst(cg, cm, conv.length, false, true);
      // 화살표는 무늬 위쪽(+v)을 가리킨다 → 칸 방향에 맞춰 돌린다
      const rot = { 2: -Math.PI / 2, 3: Math.PI / 2, 4: Math.PI, 5: 0 };
      conv.forEach(([x, y, f], i) => { m4.compose(new THREE.Vector3(wx(x), TOP / 2 + 0.01, wz(y)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot[f], 0)), new THREE.Vector3(1, 1, 1)); ci.setMatrixAt(i, m4); });
      ci.count = conv.length;
      // 양옆 롤러 테두리
      const rl = [];
      for (const [x, y, f] of conv) { const along = f <= 3; for (const s of [-1, 1]) rl.push(part(CYL(0.09, 0.09, CELL - 0.1, 8), '#2f3540', { x: wx(x) + (along ? 0 : s * 0.92), y: TOP + 0.04, z: wz(y) + (along ? s * 0.92 : 0), rz: along ? Math.PI / 2 : 0, rx: along ? 0 : Math.PI / 2 })); }
      this.add(new THREE.Mesh(merge(rl), std({ metalness: 0.4, roughness: 0.4 })));
    }
    // 물 칸 (얼음 섬): 움푹 들어간 물웅덩이
    const holes = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (S.grid[idx(x, y)] === HOLE) holes.push([x, y]);
    if (holes.length) {
      const wt = waterTex(); wt.repeat.set(1, 1); this.holeTex = wt;
      const hm = new THREE.MeshStandardMaterial({ map: wt, color: '#a7e3ff', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
      const hi = this.inst(new THREE.PlaneGeometry(CELL - 0.1, CELL - 0.1), hm, holes.length, false, true);
      const rim = [];
      holes.forEach(([x, y], i) => { m4.compose(new THREE.Vector3(wx(x), TOP + 0.02, wz(y)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)); hi.setMatrixAt(i, m4); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; rim.push(part(SPH(0.22, 8, 6), '#ffffff', { x: wx(x) + Math.cos(a) * 0.92, y: TOP + 0.05, z: wz(y) + Math.sin(a) * 0.92, sy: 0.5 })); } });
      hi.count = holes.length;
      this.add(new THREE.Mesh(merge(rim), std()));
    }
  }
  buildSolids() {
    const S = this.S, kinds = solidKinds(this.map), list = kinds.map(() => []);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (S.grid[idx(x, y)] === SOLID) list[hash(x, y) % kinds.length].push([x, y]);
    const mat = std({ roughness: this.map === 'factory' ? 0.42 : 0.6, metalness: this.map === 'factory' ? 0.35 : 0 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    kinds.forEach((g, k) => {
      const im = this.inst(g, mat, list[k].length, true, true);
      list[k].forEach(([x, y], i) => { q.setFromEuler(new THREE.Euler(0, this.map === 'ice' ? (hash(x, y) % 6) : 0, 0)); m4.compose(new THREE.Vector3(wx(x), TOP, wz(y)), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
      im.count = list[k].length;
    });
    // 얼음 결정: 반투명 · 빛 받는 결정
    if (this.map === 'ice') {
      const all = list.flat(), cm = jellyMat({ glow: 0.18, opacity: 0.8, roughness: 0.05 });
      const im = this.inst(iceCrystal(1), cm, all.length, true, false);
      const col = new THREE.Color();
      all.forEach(([x, y], i) => { q.setFromEuler(new THREE.Euler(0, hash(x, y) % 7, 0)); const s = 0.85 + (hash(y, x) % 30) / 100; m4.compose(new THREE.Vector3(wx(x), TOP, wz(y)), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(['#9fe3ff', '#bfd4ff', '#a8f5f0'][hash(x, y) % 3])); });
      im.count = all.length;
    }
    // 공장: 깜빡이는 등
    if (this.map === 'factory') {
      const all = list.flat();
      this.lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const im = this.inst(SPH(0.09, 8, 6), this.lampMat, all.length, false);
      const col = new THREE.Color();
      all.forEach(([x, y], i) => { m4.makeTranslation(wx(x) + 0.7, TOP + 1.38, wz(y) + 0.82); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(['#5fffb0', '#ff5f6d', '#ffd23f'][hash(x, y) % 3])); });
      im.count = all.length; this.lamps = im; this.lampCells = all;
    }
    // 내려온 푸딩 블록 (판이 좁아질 때)
    const pud = merge([
      part(CYL(0.82, 0.95, 1.5, 28), '#ffd27a', { y: 0.75 }),
      part(CYL(0.84, 0.84, 0.22, 28), '#9b4f1c', { y: 1.5 }),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => part(SPH(0.14, 8, 6), '#9b4f1c', { x: Math.cos(i * 0.785) * 0.78, y: 1.32 - (i % 3) * 0.1, z: Math.sin(i * 0.785) * 0.78, sy: 1.6 })),
      part(SPH(0.32, 16, 10), '#ffffff', { y: 1.7, sy: 0.55 }),
      part(SPH(0.16, 12, 10), '#ff3b5c', { y: 1.92 }),
      part(CYL(0.02, 0.02, 0.3, 4), '#5a8f2a', { x: 0.06, y: 2.1, rz: -0.4 }),
    ]);
    this.fallen = this.inst(pud, jellyMat({ glow: 0.12, opacity: 0.95, vertexColors: true }), W * H, true, true);
    this.fallAnim = new Map(); // 칸 → 떨어지기 시작한 시간
    this.warnMesh = this.inst(RB(CELL - 0.2, 0.04, CELL - 0.2, 0.15, 2), new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.5, depthWrite: false }), W * H, false);
    this.warnShadow = this.inst(new THREE.CircleGeometry(0.95, 24), new THREE.MeshBasicMaterial({ map: blobTex(), color: '#2a0a20', transparent: true, opacity: 0.5, depthWrite: false }), W * H, false);
  }
  buildBoxes() {
    const n = W * H;
    // 젤리 상자: 말랑한 반투명 몸 · 안에 곰젤리 · 위에 빛 방울
    this.boxBody = this.inst(RB(1.62, 1.42, 1.62, 0.34, 3), jellyMat({ glow: 0.3 }), n, true, false);
    this.boxCore = this.inst(gummyCore(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, vertexColors: false }), n, false);
    this.boxShine = this.inst(SPH(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }), n, false);
    if (this.map === 'factory') this.boxStrap = this.inst(merge([part(RB(1.7, 0.16, 0.22, 0.05, 1), '#5a6273', { y: 0.72 }), part(RB(0.22, 0.16, 1.7, 0.05, 1), '#5a6273', { y: 0.72 }), part(CYL(0.12, 0.12, 0.08, 12), '#c9d2de', { y: 0.82 })]), std({ metalness: 0.5, roughness: 0.35 }), n, true);
    if (this.map === 'ice') this.boxStrap = this.inst(merge([part(SPH(0.82, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', { y: 0.62, sy: 0.32 }), ...[0, 1, 2, 3, 4, 5].map((i) => part(SPH(0.1, 6, 5), '#ffffff', { x: Math.cos(i) * 0.7, y: 0.55, z: Math.sin(i) * 0.7, sy: 1.6 }))]), std({ roughness: 0.8 }), n, true);
    if (this.map === 'candy') this.boxStrap = this.inst(merge([part(new THREE.TorusGeometry(0.22, 0.07, 8, 16), '#ffffff', { x: -0.16, y: 0.78, rx: Math.PI / 2, rz: 0.6, sy: 0.7 }), part(new THREE.TorusGeometry(0.22, 0.07, 8, 16), '#ffffff', { x: 0.16, y: 0.78, rx: Math.PI / 2, rz: -0.6, sy: 0.7 }), part(SPH(0.1, 8, 6), '#ffffff', { y: 0.76 })]), std({ roughness: 0.4 }), n, true);
    this.boxCells = []; this.boxWob = new Float32Array(n);
  }
  boxColor(x, y) { const b = this.th.boxes; return b[hash(x * 3 + 1, y * 7 + 2) % b.length]; }
  syncBoxes() {
    const S = this.S; this.boxCells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (S.grid[idx(x, y)] === BOX) this.boxCells.push([x, y]);
    const col = new THREE.Color(), core = new THREE.Color();
    this.boxCells.forEach(([x, y], i) => {
      col.set(this.boxColor(x, y)); this.boxBody.setColorAt(i, col);
      core.copy(col).offsetHSL(0, 0.05, -0.18); this.boxCore.setColorAt(i, core);
      if (this.boxStrap && this.map === 'candy') this.boxStrap.setColorAt(i, core.copy(col).offsetHSL(0, -0.1, 0.12));
    });
    for (const m of [this.boxBody, this.boxCore, this.boxShine, this.boxStrap]) if (m) { m.count = this.boxCells.length; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.placeBoxes();
  }
  placeBoxes() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const t = this.t;
    this.boxCells.forEach(([x, y], i) => {
      const k = idx(x, y), w = this.boxWob[k];
      const breath = Math.sin(t * 2.2 + x * 0.7 + y * 1.3) * 0.015;
      const wob = w > 0 ? Math.sin(w * 30) * w * 0.35 : 0;
      const sy = 1 + breath - wob, sxz = 1 - breath * 0.5 + wob * 0.6;
      q.identity();
      m4.compose(v.set(wx(x), TOP + 0.71 * sy, wz(y)), q, s.set(sxz, sy, sxz)); this.boxBody.setMatrixAt(i, m4);
      m4.compose(v.set(wx(x), TOP + 0.4 * sy, wz(y)), q.setFromEuler(new THREE.Euler(0, (hash(x, y) % 6) * 0.5, 0)), s.set(0.95 * sxz, 0.95 * sy, 0.95 * sxz)); this.boxCore.setMatrixAt(i, m4);
      m4.compose(v.set(wx(x) - 0.38, TOP + 1.3 * sy, wz(y) + 0.32), q.identity(), s.set(1.4, 0.5, 0.9)); this.boxShine.setMatrixAt(i, m4);
      if (this.boxStrap) { m4.compose(v.set(wx(x), TOP + (this.map === 'candy' ? 0.02 : 0) + (sy - 1) * 1.4, wz(y)), q, s.set(sxz, 1, sxz)); this.boxStrap.setMatrixAt(i, m4); }
    });
    for (const m of [this.boxBody, this.boxCore, this.boxShine, this.boxStrap]) if (m) m.instanceMatrix.needsUpdate = true;
  }
  wobble(x, y, a = 1) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue; const k = idx(x + dx, y + dy); this.boxWob[k] = Math.max(this.boxWob[k], (dx || dy ? 0.5 : 1) * a); } }
  syncFallen() {
    const S = this.S, m4 = new THREE.Matrix4(); let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (S.grid[idx(x, y)] !== FALLEN) continue;
      const st = this.fallAnim.get(idx(x, y)); let yy = TOP, sq = 1;
      if (st != null) { const a = this.t - st; if (a < 0.35) yy = TOP + 16 * (1 - a / 0.35) ** 2; else if (a < 0.8) { const b = (a - 0.35) / 0.45; sq = 1 - Math.sin(b * Math.PI) * 0.25 * (1 - b); } else this.fallAnim.delete(idx(x, y)); }
      m4.compose(new THREE.Vector3(wx(x), yy, wz(y)), new THREE.Quaternion(), new THREE.Vector3(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6)); this.fallen.setMatrixAt(n++, m4);
    }
    this.fallen.count = n; this.fallen.instanceMatrix.needsUpdate = true;
    // 경고: 곧 내려올 칸
    let w = 0;
    for (const f of S.falls) {
      const left = f.at - S.t, pulse = 0.5 + 0.5 * Math.sin(this.t * 18);
      m4.compose(new THREE.Vector3(wx(f.x), TOP + 0.03, wz(f.y)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); this.warnMesh.setMatrixAt(w, m4);
      const sc = 0.4 + (1 - Math.max(0, left)) * 0.8;
      m4.compose(new THREE.Vector3(wx(f.x), TOP + 0.05, wz(f.y)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(sc, sc, sc)); this.warnShadow.setMatrixAt(w, m4);
      w++; this.warnMesh.material.opacity = 0.25 + pulse * 0.4;
    }
    this.warnMesh.count = this.warnShadow.count = w; this.warnMesh.instanceMatrix.needsUpdate = this.warnShadow.instanceMatrix.needsUpdate = true;
  }
  // ---------- 물결 · 조각 · 물방울 ----------
  buildFx() {
    const th = this.th, n = W * H;
    this.waveMat = new THREE.MeshStandardMaterial({ color: th.wave, emissive: th.wave, emissiveIntensity: 0.75, roughness: 0.25, transparent: true, opacity: 0.88 });
    this.wave = this.inst(RB(CELL - 0.1, 0.9, CELL - 0.1, 0.42, 3), this.waveMat, n, false);
    this.waveTop = this.inst(SPH(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: th.waveHi, transparent: true, opacity: 0.85, depthWrite: false }), n, false);
    this.flameBorn = new Map(); // 칸 → 처음 생긴 시간 (출렁임)
    // 조각 · 물방울 (인스턴스 하나씩)
    this.shardMax = this.phone ? 160 : 320;
    this.shards = this.inst(RB(0.34, 0.3, 0.34, 0.1, 1), jellyMat({ glow: 0.3, opacity: 0.9 }), this.shardMax, false);
    this.shardList = [];
    this.dropMax = this.phone ? 160 : 360;
    this.drops = this.inst(SPH(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), this.dropMax, false);
    this.dropList = [];
    // 터질 때 빛 (점 조명 2개를 돌려 쓴다: 개수가 바뀌면 셰이더를 다시 만들어 느려진다)
    this.flashes = [0, 1].map(() => { const l = new THREE.PointLight(th.wave, 0, 12, 1.6); l.position.y = 2; this.add(l); return { l, t: 0 }; });
    this.flashI = 0;
  }
  burst(x, y, color, n = 10, speed = 5, up = 6) {
    for (let i = 0; i < n; i++) {
      if (this.dropList.length >= this.dropMax) this.dropList.shift();
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.dropList.push({ p: new THREE.Vector3(wx(x) + (Math.random() - 0.5), TOP + 0.6, wz(y) + (Math.random() - 0.5)), v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s), life: 0.6 + Math.random() * 0.5, c: new THREE.Color(color), s: 0.6 + Math.random() * 0.9 });
    }
  }
  shatter(x, y, color) {
    for (let i = 0; i < 12; i++) {
      if (this.shardList.length >= this.shardMax) this.shardList.shift();
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 5;
      this.shardList.push({ p: new THREE.Vector3(wx(x) + (Math.random() - 0.5) * 1.2, TOP + 0.4 + Math.random() * 1.0, wz(y) + (Math.random() - 0.5) * 1.2), v: new THREE.Vector3(Math.cos(a) * s, 4 + Math.random() * 6, Math.sin(a) * s), r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), w: (Math.random() - 0.5) * 14, life: 1.0 + Math.random() * 0.5, c: new THREE.Color(color), s: 0.6 + Math.random() * 0.7 });
    }
  }
  boom(e) {
    for (const [x, y] of e.cells) { this.flameBorn.set(idx(x, y), this.t); this.wobble(x, y, 1); }
    for (const [x, y] of e.boxes) { this.shatter(x, y, this.boxColor(x, y)); this.burst(x, y, '#ffffff', 6, 3, 5); }
    for (const [x, y] of e.bombs) { this.burst(x, y, this.th.waveHi, 16, 6, 8); const f = this.flashes[this.flashI++ % 2]; f.l.position.set(wx(x), 2.2, wz(y)); f.t = 0.45; }
    if (e.boxes.length) this.syncBoxes();
  }
  fall(x, y) { this.fallAnim.set(idx(x, y), this.t); }
  landed(x, y) { this.burst(x, y, '#ffd27a', 14, 6, 4); this.wobble(x, y, 1); }

  // ---------- 매 프레임 ----------
  update(dt, cam) {
    this.t += dt; const S = this.S, t = this.t;
    for (let i = 0; i < this.boxWob.length; i++) if (this.boxWob[i] > 0) this.boxWob[i] = Math.max(0, this.boxWob[i] - dt * 1.6);
    this.placeBoxes();
    this.syncFallen();
    // 물결: 솟았다가 출렁이며 가라앉는다
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    let n = 0;
    for (const f of S.flames) {
      const born = this.flameBorn.get(idx(f.x, f.y)) ?? t, age = t - born, life = Math.max(0, f.t / FLAME_T);
      const rise = Math.min(1, age / 0.08), sink = Math.min(1, life / 0.35);
      const h = rise * sink * (1 + Math.sin(age * 28 + f.x + f.y) * 0.12 * (1 - Math.min(1, age * 2)));
      const wide = 0.7 + 0.3 * rise;
      m4.compose(v.set(wx(f.x), TOP + 0.45 * h, wz(f.y)), q, s.set(wide, Math.max(0.01, h), wide)); this.wave.setMatrixAt(n, m4);
      m4.compose(v.set(wx(f.x), TOP + 0.85 * h, wz(f.y)), q, s.set(wide * 1.3, Math.max(0.01, h * 0.55), wide * 1.3)); this.waveTop.setMatrixAt(n, m4);
      n++;
    }
    this.wave.count = this.waveTop.count = n; this.wave.instanceMatrix.needsUpdate = this.waveTop.instanceMatrix.needsUpdate = true;
    this.waveMat.emissiveIntensity = 0.65 + Math.sin(t * 20) * 0.12;
    for (const f of this.flashes) { f.t = Math.max(0, f.t - dt); f.l.intensity = f.t > 0 ? (f.t / 0.45) * 60 : 0; }
    // 조각
    const col = new THREE.Color(); n = 0;
    for (let i = this.shardList.length - 1; i >= 0; i--) {
      const p = this.shardList[i]; p.life -= dt; if (p.life <= 0) { this.shardList.splice(i, 1); continue; }
      p.v.y -= 22 * dt; p.p.addScaledVector(p.v, dt); if (p.p.y < TOP + 0.12) { p.p.y = TOP + 0.12; p.v.y *= -0.35; p.v.x *= 0.7; p.v.z *= 0.7; p.w *= 0.6; }
      p.r.x += p.w * dt; p.r.z += p.w * dt * 0.7;
      const sc = p.s * Math.min(1, p.life * 2.5);
      m4.compose(p.p, q.setFromEuler(p.r), s.set(sc, sc, sc)); this.shards.setMatrixAt(n, m4); this.shards.setColorAt(n, p.c); n++;
    }
    this.shards.count = n; this.shards.instanceMatrix.needsUpdate = true; if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    n = 0; q.identity();
    for (let i = this.dropList.length - 1; i >= 0; i--) {
      const p = this.dropList[i]; p.life -= dt; if (p.life <= 0) { this.dropList.splice(i, 1); continue; }
      p.v.y -= 18 * dt; p.p.addScaledVector(p.v, dt);
      const sc = p.s * Math.min(1, p.life * 3);
      m4.compose(p.p, q, s.set(sc, sc, sc)); this.drops.setMatrixAt(n, m4); this.drops.setColorAt(n, col.copy(p.c)); n++;
    }
    this.drops.count = n; this.drops.instanceMatrix.needsUpdate = true; if (this.drops.instanceColor) this.drops.instanceColor.needsUpdate = true;
    if (this.beltTex) this.beltTex.offset.y = -(t * 0.85) % 1;
    if (this.seaTex) { this.seaTex.offset.x = t * 0.01; this.seaTex.offset.y = t * 0.006; }
    if (this.holeTex) { this.holeTex.offset.x = t * 0.05; this.holeTex.offset.y = Math.sin(t * 0.7) * 0.05; }
    if (this.lamps) { const c = new THREE.Color(); this.lampCells.forEach(([x, y], i) => { const on = Math.sin(t * 3 + hash(x, y)) > -0.2; c.set(['#5fffb0', '#ff5f6d', '#ffd23f'][hash(x, y) % 3]).multiplyScalar(on ? 1.4 : 0.35); this.lamps.setColorAt(i, c); }); this.lamps.instanceColor.needsUpdate = true; }
  }
}

// ---------- 젤리 폭탄: 동그란 젤리 방울 · 안에서 빛나는 심 · 꼬인 사탕 꼭지 · 반짝 불씨 ----------
const bombGeo = { body: null, core: null, cap: null, spark: null };
const bombMats = new Map();
export function bombMesh(color) {
  if (!bombGeo.body) {
    bombGeo.body = SPH(0.62, 24, 18); bombGeo.body.translate(0, 0.62, 0);
    bombGeo.core = SPH(0.3, 16, 12); bombGeo.core.translate(0, 0.6, 0);
    bombGeo.cap = merge([part(CYL(0.16, 0.2, 0.14, 12), '#ffffff', { y: 1.22 }), ...[0, 1, 2].map((i) => part(new THREE.TorusGeometry(0.11 - i * 0.025, 0.035, 6, 14), i % 2 ? '#ffffff' : '#ff4f6d', { y: 1.33 + i * 0.07, rx: Math.PI / 2 })), part(CYL(0.02, 0.025, 0.22, 6), '#7a4a2a', { y: 1.52, rz: 0.25 })]);
    bombGeo.spark = new THREE.PlaneGeometry(0.7, 0.7);
  }
  let m = bombMats.get(color);
  if (!m) {
    m = {
      body: new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.8, emissive: color, emissiveIntensity: 0.18, sheen: 0.5, sheenColor: C('#ffffff') }),
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(C('#ffffff'), 0.55) }),
      cap: std({ roughness: 0.4 }),
      spark: new THREE.MeshBasicMaterial({ map: blobTex(), color: '#ffe680', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    bombMats.set(color, m);
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(bombGeo.body, m.body); body.castShadow = true; g.add(body);
  const core = new THREE.Mesh(bombGeo.core, m.core.clone()); g.add(core);
  const cap = new THREE.Mesh(bombGeo.cap, m.cap); cap.castShadow = true; g.add(cap);
  const spark = new THREE.Mesh(bombGeo.spark, m.spark); spark.position.y = 1.66; g.add(spark);
  g.userData = { body, core, cap, spark };
  return g;
}
// 갇힘 젤리 덩어리
let trapGeo = null;
export function trapMesh(color) {
  if (!trapGeo) trapGeo = RB(1.7, 2.0, 1.7, 0.62, 4);
  const m = new THREE.Mesh(trapGeo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.22, depthWrite: false, sheen: 0.6, sheenColor: C('#ffffff') }));
  m.renderOrder = 5;
  const shine = new THREE.Mesh(SPH(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  shine.position.set(-0.45, 0.65, 0.6); shine.scale.set(1.3, 0.6, 0.6); m.add(shine);
  const bubbles = [];
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(SPH(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false })); m.add(b); bubbles.push(b); }
  m.userData.bubbles = bubbles;
  return m;
}
