// ⏳ 시간 여행 맵의 세상 (브라우저만): 끝없는 평지 · 가운데 길 · 양옆 풍경 세 겹 · 살아 움직이는 장면
//   길(판정)은 track.js timePattern 이 만들고, 여기는 보이는 세상만 그린다
//   좌표: 이 묶음(root) 안에서 z = -s, root.position.z = track.origin (곰과 같은 자리)
//   풍경은 40m 칸마다 만들고, 움직이지 않는 것은 칸 하나에 그림 몇 장으로 묶는다(꼭짓점 색) → 그리기 호출이 적다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { isPhone } from '../../shared/js/perf.js';
import { toon } from '../../shared/js/utils.js';
import { glow } from './kits.js';
import { TIME_W } from './times.js';
import { TK as TK0 } from './time-kits.js';
import { KITS } from './kits.js';
// 시간 여행 조각 + 꿈나라 조각(해초 · 해파리 · 산 · 성 …)도 같이 쓴다
const TK = new Proxy(TK0, { get: (t, k) => t[k] || (KITS[k] ? { build: (r, P) => KITS[k].build(r, P), y: KITS[k].place === 'drift' ? 2.5 : undefined } : undefined) });

const STEP = 40, AHEAD = isPhone ? 230 : 330, BEHIND = 70, WIDE = 1400;
const R = Math.random;
const rr = { next: R, range: (a, b) => a + (b - a) * R(), int: (a, b) => Math.floor(a + (b - a + 1) * R()), pick: (a) => a[Math.floor(R() * a.length)], chance: (p) => R() < p };

// ---------- 땅 · 길 그림 ----------
const texCache = new Map();
function canvasTex(key, n, draw, rep) {
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); draw(x, n);
  t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.rep = rep;
  texCache.set(key, t); return t;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const mixC = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
const dots = (x, n, col, num, r0, r1, a = 1) => { x.globalAlpha = a; x.fillStyle = col; for (let i = 0; i < num; i++) { x.beginPath(); x.arc(R() * n, R() * n, r0 + R() * (r1 - r0), 0, 7); x.fill(); } x.globalAlpha = 1; };
const blobs = (x, n, col, num, r0, r1, a) => { for (let i = 0; i < num; i++) { const cx = R() * n, cy = R() * n, r = r0 + R() * (r1 - r0), g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { x.save(); x.translate(ox, oy); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); } } x.globalAlpha = 1; };
// 땅 무늬: [바탕, 둘째 색] 으로 칠한다. 반복 길이(m)도 같이
const GROUND = {
  nebula: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 9, n * 0.12, n * 0.4, 0.5); dots(x, n, '#ffffff', 160, 0.4, 1.4, 0.9); },
  plasma: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 14, n * 0.08, n * 0.3, 0.7); blobs(x, n, '#ffffff', 6, n * 0.04, n * 0.12, 0.6); },
  lava: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineCap = 'round'; for (let i = 0; i < 18; i++) { x.lineWidth = 2 + R() * 6; x.beginPath(); let px = R() * n, py = R() * n; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.5) * n * 0.3; py += (R() - 0.5) * n * 0.3; x.lineTo(px, py); } x.stroke(); } blobs(x, n, b, 8, 8, 30, 0.6); },
  rock: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, b, 120, 2, 12, 0.5); dots(x, n, shade(a, 1.2), 60, 1, 6, 0.5); },
  water: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineWidth = 2; x.globalAlpha = 0.5; for (let i = 0; i < 40; i++) { const px = R() * n, py = R() * n; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 10, py - 5, px + 20, py); x.stroke(); } x.globalAlpha = 1; },
  mud: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 20, 10, 40, 0.5); dots(x, n, shade(a, 0.8), 80, 1, 4, 0.6); },
  grass: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 14, 20, 60, 0.35); x.strokeStyle = shade(a, 1.25); x.lineWidth = 1.5; for (let i = 0; i < 500; i++) { const px = R() * n, py = R() * n; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 3, py - 3 - R() * 4); x.stroke(); } },
  moss: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, b, 260, 2, 7, 0.55); dots(x, n, shade(a, 0.75), 120, 1, 3, 0.6); },
  sand: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.globalAlpha = 0.35; x.lineWidth = 2; for (let y = 6; y < n; y += 14) { x.beginPath(); for (let px = 0; px <= n; px += 8) x.lineTo(px, y + Math.sin(px * 0.05 + y) * 4); x.stroke(); } x.globalAlpha = 1; dots(x, n, shade(a, 0.85), 90, 0.5, 1.5, 0.6); },
  snow: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 14, 20, 60, 0.4); dots(x, n, '#ffffff', 120, 0.5, 1.6, 0.9); },
  ice: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineWidth = 1.5; x.globalAlpha = 0.7; for (let i = 0; i < 16; i++) { x.beginPath(); let px = R() * n, py = R() * n; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 50; py += (R() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); } x.globalAlpha = 1; },
  dirt: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 16, 14, 40, 0.4); dots(x, n, shade(a, 0.7), 140, 1, 3, 0.6); dots(x, n, shade(a, 1.2), 60, 1, 2.5, 0.6); },
  field: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); for (let i = 0; i < n; i += 16) { x.fillStyle = i % 32 ? b : shade(b, 0.85); x.fillRect(i, 0, 10, n); } dots(x, n, shade(a, 0.8), 80, 1, 2, 0.5); },
  stone: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineWidth = 2; for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) { const o = r % 2 ? n / 12 : 0; x.strokeRect(c * n / 6 + o, r * n / 8, n / 6, n / 8); } dots(x, n, shade(a, 0.85), 60, 1, 4, 0.4); },
  marble: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * n / 4, 0); x.lineTo(i * n / 4, n); x.moveTo(0, i * n / 4); x.lineTo(n, i * n / 4); x.stroke(); } x.globalAlpha = 0.25; x.strokeStyle = shade(b, 0.8); x.lineWidth = 1; for (let i = 0; i < 20; i++) { x.beginPath(); x.moveTo(R() * n, R() * n); x.bezierCurveTo(R() * n, R() * n, R() * n, R() * n, R() * n, R() * n); x.stroke(); } x.globalAlpha = 1; },
  asphalt: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, b, 400, 0.4, 1.2, 0.5); blobs(x, n, shade(a, 0.8), 8, 20, 50, 0.3); },
  metal: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * n / 4, 0); x.lineTo(i * n / 4, n); x.moveTo(0, i * n / 4); x.lineTo(n, i * n / 4); x.stroke(); } x.fillStyle = b; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (const [ox, oy] of [[6, 6], [n / 4 - 6, 6], [6, n / 4 - 6], [n / 4 - 6, n / 4 - 6]]) { x.beginPath(); x.arc(i * n / 4 + ox, j * n / 4 + oy, 2, 0, 7); x.fill(); } },
  circuit: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = b; x.lineWidth = 2; x.shadowColor = b; x.shadowBlur = 6; for (let i = 0; i < 26; i++) { let px = Math.round(R() * 16) * n / 16, py = Math.round(R() * 16) * n / 16; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 3; k++) { if (R() < 0.5) px += (R() < 0.5 ? -1 : 1) * n / 8; else py += (R() < 0.5 ? -1 : 1) * n / 8; x.lineTo(px, py); } x.stroke(); x.beginPath(); x.arc(px, py, 3, 0, 7); x.fillStyle = b; x.fill(); } x.shadowBlur = 0; },
  mars: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 12, 20, 60, 0.4); dots(x, n, shade(a, 0.7), 80, 1, 5, 0.5); },
  moon: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); for (let i = 0; i < 14; i++) { const cx = R() * n, cy = R() * n, r = 4 + R() * 18; x.fillStyle = shade(a, 0.78); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); x.fillStyle = shade(a, 1.12); x.beginPath(); x.arc(cx - r * 0.15, cy - r * 0.15, r * 0.8, 0, 7); x.fill(); } dots(x, n, b, 200, 0.4, 1.2, 0.5); },
  ash: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 14, 14, 50, 0.4); dots(x, n, '#ff6a2a', 30, 0.6, 1.8, 0.7); },
  seabed: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); blobs(x, n, b, 14, 10, 40, 0.5); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { x.beginPath(); x.ellipse(R() * n, R() * n, 20 + R() * 30, 6 + R() * 8, R() * 3, 0, 7); x.stroke(); } },
  tiles: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) { x.fillStyle = b; x.fillRect(i * n / 8, j * n / 8, n / 8, n / 8); } },
};
// 길 무늬: [바탕, 테두리 색]. 테두리는 그림 양옆에 같이 그려서 길 한 장이 그리기 한 번
const ROAD = {
  light: (x, n, a, b) => { const g = x.createLinearGradient(0, 0, n, 0); g.addColorStop(0, b); g.addColorStop(0.06, a); g.addColorStop(0.5, shade(a, 1.05)); g.addColorStop(0.94, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,.55)'; for (const k of [1 / 3, 2 / 3]) for (let y = 0; y < n; y += n / 4) x.fillRect(k * n - 1.5, y, 3, n / 8); },
  dirt: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, shade(a, 0.8), 260, 1, 3, 0.6); dots(x, n, shade(a, 1.15), 120, 1, 2.5, 0.6); x.fillStyle = shade(a, 0.86); for (const k of [0.3, 0.7]) x.fillRect(k * n - 5, 0, 10, n); x.fillStyle = b; x.fillRect(0, 0, 7, n); x.fillRect(n - 7, 0, 7, n); },
  stone: (x, n, a, b) => { x.fillStyle = shade(a, 0.7); x.fillRect(0, 0, n, n); for (let r = 0; r < 8; r++) { let c = 0; while (c < n) { const w = 18 + R() * 24; x.fillStyle = mixC(a, shade(a, 0.85), R()); x.beginPath(); x.roundRect(c + 1.5, r * n / 8 + 1.5, w - 3, n / 8 - 3, 4); x.fill(); c += w; } } x.fillStyle = b; x.fillRect(0, 0, 9, n); x.fillRect(n - 9, 0, 9, n); },
  cobble: (x, n, a, b) => { x.fillStyle = shade(a, 0.65); x.fillRect(0, 0, n, n); for (let i = 0; i < 160; i++) { x.fillStyle = mixC(a, shade(a, 0.8), R()); x.beginPath(); x.ellipse(R() * n, R() * n, 6 + R() * 4, 5 + R() * 3, R() * 3, 0, 7); x.fill(); } x.fillStyle = b; x.fillRect(0, 0, 8, n); x.fillRect(n - 8, 0, 8, n); },
  plank: (x, n, a, b) => { for (let i = 0; i < 16; i++) { x.fillStyle = mixC(a, shade(a, 0.82), R()); x.fillRect(0, i * n / 16, n, n / 16 - 2); } x.fillStyle = shade(a, 0.55); x.fillRect(0, 0, n, n / 64); x.fillStyle = b; x.fillRect(0, 0, 8, n); x.fillRect(n - 8, 0, 8, n); },
  brick: (x, n, a, b) => { x.fillStyle = shade(a, 0.7); x.fillRect(0, 0, n, n); for (let r = 0; r < 16; r++) for (let c = -1; c < 8; c++) { const o = r % 2 ? n / 16 : 0; x.fillStyle = mixC(a, shade(a, 0.85), R()); x.fillRect(c * n / 8 + o + 1, r * n / 16 + 1, n / 8 - 2, n / 16 - 2); } x.fillStyle = b; x.fillRect(0, 0, 8, n); x.fillRect(n - 8, 0, 8, n); },
  asphalt: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, shade(a, 1.4), 500, 0.4, 1, 0.5); x.fillStyle = '#f5f5f0'; for (const k of [1 / 3, 2 / 3]) for (let y = 0; y < n; y += n / 4) x.fillRect(k * n - 2, y, 4, n / 8); x.fillStyle = b; x.fillRect(4, 0, 5, n); x.fillRect(n - 9, 0, 5, n); },
  metal: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = shade(a, 0.7); x.lineWidth = 2; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * n / 8); x.lineTo(n, i * n / 8); x.stroke(); } x.fillStyle = b; x.shadowColor = b; x.shadowBlur = 10; x.fillRect(3, 0, 5, n); x.fillRect(n - 8, 0, 5, n); for (const k of [1 / 3, 2 / 3]) for (let y = 0; y < n; y += n / 8) x.fillRect(k * n - 1.5, y, 3, n / 16); x.shadowBlur = 0; },
  sand: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, shade(a, 0.85), 300, 0.5, 2, 0.6); x.fillStyle = b; x.globalAlpha = 0.6; x.fillRect(0, 0, 10, n); x.fillRect(n - 10, 0, 10, n); x.globalAlpha = 1; },
  snow: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, shade(a, 0.9), 200, 1, 3, 0.5); x.fillStyle = shade(a, 0.88); for (const k of [0.3, 0.7]) x.fillRect(k * n - 6, 0, 12, n); x.fillStyle = b; x.fillRect(0, 0, 8, n); x.fillRect(n - 8, 0, 8, n); },
  moss: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, shade(a, 1.2), 200, 2, 6, 0.5); dots(x, n, shade(a, 0.75), 160, 1, 4, 0.5); x.fillStyle = b; x.fillRect(0, 0, 8, n); x.fillRect(n - 8, 0, 8, n); },
  tile: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = shade(a, 0.75); x.lineWidth = 2; for (let i = 0; i <= 6; i++) { x.beginPath(); x.moveTo(i * n / 6, 0); x.lineTo(i * n / 6, n); x.moveTo(0, i * n / 6); x.lineTo(n, i * n / 6); x.stroke(); } x.fillStyle = b; x.fillRect(0, 0, 9, n); x.fillRect(n - 9, 0, 9, n); },
  rail: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); dots(x, n, shade(a, 0.75), 300, 1, 3, 0.6); x.fillStyle = '#6d4c41'; for (let y = 0; y < n; y += n / 8) x.fillRect(n * 0.1, y, n * 0.8, n / 20); x.fillStyle = b; for (const k of [0.25, 0.75]) x.fillRect(k * n - 3, 0, 6, n); },
  ice: (x, n, a, b) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(R() * n, R() * n); x.lineTo(R() * n, R() * n); x.stroke(); } x.fillStyle = b; x.fillRect(0, 0, 8, n); x.fillRect(n - 8, 0, 8, n); },
};
const groundMats = new Map(), roadMats = new Map();
function groundMat(g) {
  const [a, b, pat = 'dirt', glowK = 0] = g, key = g.join('|');
  let m = groundMats.get(key); if (m) return m;
  const t = canvasTex('g' + key, 256, (x, n) => (GROUND[pat] || GROUND.dirt)(x, n, a, b));
  m = new THREE.MeshLambertMaterial({ map: t, emissive: glowK ? new THREE.Color(b) : new THREE.Color('#000000'), emissiveIntensity: glowK || 0, emissiveMap: glowK ? t : null });
  groundMats.set(key, m); return m;
}
function roadMat(r) {
  const [a, b, pat = 'dirt', glowK = 0] = r, key = r.join('|');
  let m = roadMats.get(key); if (m) return m;
  // 빛길은 밝은 색이 하얗게 날아가지 않게 조금 어둡게 칠한다
  const t = canvasTex('r' + key, 256, (x, n) => (ROAD[pat] || ROAD.dirt)(x, n, pat === 'light' ? shade(a, 0.78) : a, b));
  m = new THREE.MeshLambertMaterial({ map: t, emissive: glowK ? new THREE.Color('#ffffff') : new THREE.Color('#000000'), emissiveIntensity: Math.min(0.28, (glowK || 0) * 0.45), emissiveMap: glowK ? t : null, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  roadMats.set(key, m); return m;
}
const G_PLANE = new THREE.PlaneGeometry(1, 1), BOX = new THREE.Box3();
// 지나간 시대의 땅 · 길 그림을 버린다 (125개 시대를 다 달리면 그림이 250장 쌓여 휴대폰 메모리가 모자란다)
function evict(cur) {
  for (const [mats, pre] of [[groundMats, 'g'], [roadMats, 'r']]) for (const [key, m] of mats) if ((m.userData.used ?? cur) < cur - 1) { m.map?.dispose(); m.dispose(); mats.delete(key); texCache.delete(pre + key); }
}
// 평면 (눕히면 +v 가 앞쪽 = s 가 커지는 쪽): u 는 가로 반복, v 는 s0 부터
function uvPlane(w, len, ru, rv, v0) {
  const g = new THREE.PlaneGeometry(w, len), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, v0 + uv.getY(i) * rv);
  return g;
}

// ---------- 묶기: 움직이지 않는 풍경을 꼭짓점 색으로 바꿔 그림 몇 장으로 ----------
const VC_TOON = new THREE.MeshToonMaterial({ vertexColors: true });
const VC_BASIC = new THREE.MeshBasicMaterial({ vertexColors: true });
// 투명한 빛(glow): 투명도마다 하나씩 (꼭짓점 색)
const VC_GLOW = new Map();
const glowVC = (op) => { const k = Math.round(op * 20) / 20; if (!VC_GLOW.has(k)) VC_GLOW.set(k, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: k, depthWrite: false })); return VC_GLOW.get(k); };
const VC_TOONT = new Map();
const toonVC = (op) => { const k = Math.round(op * 20) / 20; if (!VC_TOONT.has(k)) VC_TOONT.set(k, new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, opacity: k, depthWrite: false })); return VC_TOONT.get(k); };
// root 안의 멈춘 그물을 root 기준 좌표로 합친다 (root 자리 · 움직임은 그대로 둔다)
const INV = new THREE.Matrix4(), MT = new THREE.Matrix4();
function bakeColored(root) {
  root.updateMatrixWorld(true); INV.copy(root.matrixWorld).invert();
  const buckets = new Map(), remove = [];
  // 멈춘 풍경은 팔 · 불꽃처럼 따로 움직이던 부분(dynamic)까지 모두 합친다 (어차피 안 움직인다)
  const visit = (o) => {
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && !o.userData.keep) {
      const m = o.material, plain = !m.map && m.blending === THREE.NormalBlending && m.side !== THREE.DoubleSide;
      let kind = m.uuid, mat = m, vc = false;
      if (plain && m.isMeshToonMaterial) { kind = m.transparent ? 'tt' + Math.round(m.opacity * 20) : 'toon'; mat = m.transparent ? toonVC(m.opacity) : VC_TOON; vc = true; }
      else if (plain && m.isMeshBasicMaterial) { kind = m.transparent ? 'bt' + Math.round(m.opacity * 20) : 'basic'; mat = m.transparent ? glowVC(m.opacity) : VC_BASIC; vc = true; }
      if (!buckets.has(kind)) buckets.set(kind, { mat, geos: [], vc });
      const B = buckets.get(kind);
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      // 이미 꼭짓점 색으로 합친 그물(사람 몸 등)은 그 색을 그대로 쓴다
      const keepC = m.vertexColors && g.attributes.color;
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name) && !(keepC && name === 'color')) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (B.vc && !keepC) { const c = m.color, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
      g.clearGroups(); g.applyMatrix4(MT.multiplyMatrices(INV, o.matrixWorld)); B.geos.push(g); remove.push(o);
    }
    for (const c of o.children) visit(c);
  };
  for (const c of root.children) visit(c);
  for (const o of remove) o.parent.remove(o);
  for (const { mat, geos } of buckets.values()) {
    const g = mergeGeometries(geos, false); if (!g) continue;
    g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.userData.own = true; m.matrixAutoUpdate = false; m.updateMatrix(); if (mat.transparent) m.renderOrder = 1; root.add(m);
  }
  return root;
}

// 풍경 띠: 가까이 · 중간 · 멀리 · 하늘 (길 가운데에서 떨어진 거리 m)
const BAND = { near: [TIME_W / 2 + 1.6, TIME_W / 2 + 9], mid: [TIME_W / 2 + 10, 46], scene: [TIME_W / 2 + 7, 34], far: [55, 190], sky: [20, 140] };
// 칸 40m 마다 띠별로 몇 개 (휴대폰은 덜)
const PER = isPhone ? { near: 5, mid: 3, far: 1.2, sky: 0.4, scene: 0.6 } : { near: 11, mid: 7, far: 2.5, sky: 1, scene: 1.2 };
// 칸 하나에서 움직이는 것은 이만큼만 (나머지는 멈춘 채 묶어서 그리기 호출을 줄인다). 장면(scene)은 먼저 자리를 받는다
const ANIM_CAP = isPhone ? 10 : 24; // 움직이는 그물 수 (칸 하나)

export class TimeWorld {
  constructor(scene) { this.scene = scene; this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root); this.cells = []; this.anim = []; this.track = null; }
  start(track) { this.clear(); evict(1e9); this.track = track; this.at = -80; this.last = {}; this.curD = 0; this.root.visible = true; }
  stop() { this.clear(); this.track = null; this.root.visible = false; }
  clear() { for (const c of this.cells) this.drop(c.g); this.cells = []; this.anim = []; }
  drop(g) { this.root.remove(g); g.traverse((o) => { if (o.isMesh && o.geometry && o.geometry !== G_PLANE && o.userData.own) o.geometry.dispose(); }); }
  // 그 거리의 시대
  eraAt(s) { const t = this.track; return t.themeOf(t.dreamAt(s)); }
  update(dt, t, ps) {
    const T = this.track; if (!T) return;
    this.root.position.z = T.origin;
    // 길이 만들어진 곳까지만 (시대 경계를 알아야 한다)
    const lim = Math.min(T.gs, ps + AHEAD);
    // 처음엔 한꺼번에, 달리는 동안엔 한 프레임에 한 칸씩 (휴대폰 끊김 줄이기)
    let n = 0; const burst = this.at < ps + 90 ? 3 : 1; while (this.at + STEP <= lim && n++ < burst) { this.fill(this.at, this.at + STEP); this.at += STEP; }
    this.cells = this.cells.filter((c) => { if (c.s1 < ps - BEHIND) { this.drop(c.g); return false; } return true; });
    this.anim = this.anim.filter((o) => o.parent);
    const cur = T.dreamAt(ps);
    if (cur !== this.curD) { this.curD = cur; evict(cur); }
    for (const c of this.cells) for (const sg of c.g.userData.segs || []) sg.visible = sg.userData.d <= cur || sg.userData.s0 - ps < 18;
    for (const o of this.anim) { const s = o.userData.s; if (s > ps - 30 && s < ps + 220 && o.parent.visible) o.userData.anim(o, t, dt); }
  }
  // 칸 하나 [s0, s1): 시대 경계에서 나눠서 땅 · 길, 그다음 풍경
  fill(s0, s1) {
    const T = this.track, g = new THREE.Group(); g.userData.s = s0;
    const cuts = [s0, ...T.bounds.filter((b) => b > s0 && b < s1), s1];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1], th = this.eraAt((a + b) / 2), len = b - a;
      const gm = groundMat(th.ground || ['#555555', '#666666', 'dirt']), rm = roadMat(th.road || ['#8d6e63', '#5d4037', 'dirt']), dd = T.dreamAt((a + b) / 2);
      gm.userData.used = Math.max(gm.userData.used ?? -1, dd); rm.userData.used = Math.max(rm.userData.used ?? -1, dd);
      // 무늬가 세상에 붙어 있게: 칸마다 UV 를 그 자리(s) 기준으로 (같은 재질을 나눠 써도 이음매가 맞는다)
      const rep = th.ground?.[4] || 7, RW = TIME_W + 0.6;
      const gr = new THREE.Mesh(uvPlane(WIDE, len, WIDE / rep, len / rep, a / rep), gm); gr.userData.own = true; gr.rotation.x = -Math.PI / 2; gr.position.set(0, -0.02, -(a + b) / 2); g.add(gr);
      const ro = new THREE.Mesh(uvPlane(RW, len, 1, len / RW, a / RW), rm); ro.userData.own = true; ro.rotation.x = -Math.PI / 2; ro.position.set(0, 0, -(a + b) / 2); g.add(ro);
      // 시대마다 풍경 묶음: 다음 시대 풍경은 그 시대의 문을 지날 때 펼쳐진다 (update)
      const seg = new THREE.Group(); seg.userData.d = T.dreamAt((a + b) / 2); seg.userData.s0 = a; g.add(seg); (g.userData.segs ||= []).push(seg);
      this.scenery(seg, a, b, th);
    }
    this.root.add(g); this.cells.push({ s0, s1, g });
  }
  scenery(cell, a, b, th) {
    const len = b - a, k = len / STEP, P = th.P || {}, stat = new THREE.Group(); let animN = 0;
    const meshes = (o) => { let n = 0; o.traverse((c) => { if (c.isMesh) n++; }); return n; };
    // 조각 하나를 s 자리 · 띠(band)에 놓는다
    const place = (band, name, sAt) => {
      const K = TK[name]; if (!K) return;
      const o = K.build(rr, P, th); if (!o) return;
      const side = R() < 0.5 ? -1 : 1, [x0, x1] = K.band || BAND[band];
      let x = side * rr.range(x0, x1); const y = band === 'sky' ? rr.range(BAND.sky[0], K.high || 70) : 0;
      // 길을 덮지 않게: 조각의 반지름만큼 길에서 더 떨어뜨린다 (하늘에 뜬 것은 빼고)
      if (band !== 'sky' && !K.y) { BOX.setFromObject(o); const rad = Math.max(-BOX.min.x, BOX.max.x, -BOX.min.z, BOX.max.z); const need = TIME_W / 2 + 1.2 + rad; if (Math.abs(x) < need) x = side * need; }
      o.position.set(x, y + (K.y || 0), -sAt);
      o.rotation.y = K.face ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) + rr.range(-0.3, 0.3) : rr.range(0, Math.PI * 2);
      o.userData.s = sAt; o.userData.kit = name;
      // 통째로만 움직이는 것(rootAnim: 돌기 · 떠오르기 · 숨쉬기)은 속을 묶어서 그대로 움직인다
      if (o.userData.anim) { if (o.userData.rootAnim) bakeColored(o); const mn = meshes(o); if (animN + mn <= ANIM_CAP || (band === 'scene' && animN + mn <= ANIM_CAP * 1.6)) { animN += mn; cell.add(o); this.anim.push(o); o.userData.y0 = o.position.y; return; } delete o.userData.anim; }
      stat.add(o);
    };
    const put = (band, names, count) => {
      if (!names?.length) return;
      let n = count * k; n = Math.floor(n) + (R() < n % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const name = rr.pick(names), K = TK[name]; if (!K) continue;
        // gap: 이 조각끼리 최소 간격(m) — 큰 것(빅뱅 한가운데 · 태양 등)은 드물게
        const sAt = a + R() * len; if (K.gap && sAt - (this.last[name] ?? -1e9) < K.gap) continue; this.last[name] = sAt;
        place(band, name, sAt);
      }
    };
    // 시대가 시작하는 칸: 그 시대의 큰 상징물(피라미드 · 콜로세움 · 만리장성 …)을 문 바로 너머에 꼭 세운다
    if (this.track.bounds.includes(a)) for (const name of th.far || []) { const K = TK[name]; if (K?.gap >= 100 && (this.last[name] ?? -1e9) < a - 50) { const sAt = a + rr.range(35, 80); this.last[name] = sAt; place('far', name, sAt); } }
    if (th.scenes?.length) put('scene', th.scenes, PER.scene);
    put('far', th.far, PER.far); put('mid', th.mid, PER.mid); put('near', th.near, PER.near); put('sky', th.skyK, PER.sky);
    this.edges(stat, a, b, th);
    bakeColored(stat); cell.add(stat);
  }
  // 길가 장식: 길 무늬에 맞춰 양쪽 가장자리에 (흙길 = 풀 · 돌길 = 경계석 · 찻길 = 연석 + 가로등 · 빛길 = 빛 기둥 · 나무길 = 밧줄 기둥)
  edges(stat, a, b, th) {
    const pat = th.road?.[2] || 'dirt', rc = th.road?.[1] || '#5d4037', gc = th.ground?.[1] || '#6a8a4a', E = TIME_W / 2 + 0.55;
    const M = (c) => toon(c), G1 = EDGE_G;
    const box = (x, y, z, w, h, d, c) => { const m = new THREE.Mesh(G1.box, M(c)); m.position.set(x, y, z); m.scale.set(w, h, d); stat.add(m); };
    // 땅 얼룩: 땅 색보다 조금 밝거나 어두운 넓은 둥근 판 (멀리서 봐도 같은 무늬가 되풀이돼 보이지 않게)
    const g0c = th.ground?.[0] || '#555555', g1c = th.ground?.[1] || '#666666';
    for (let i = 0; i < (isPhone ? 3 : 6); i++) { const side = R() < 0.5 ? -1 : 1, sx = 4 + R() * 10, sz = 3 + R() * 8, m = new THREE.Mesh(G1.disc, M(R() < 0.5 ? shade(g0c, 0.92 + R() * 0.06) : mixC(g0c, g1c, 0.2 + R() * 0.25))); m.position.set(side * (E + 1.5 + Math.max(sx, sz) + R() * 50), 0.05 + i * 0.006, -(a + R() * (b - a))); m.scale.set(sx, 1, sz); m.rotation.y = R() * 3; stat.add(m); }
    const step = pat === 'asphalt' ? 2.2 : pat === 'light' || pat === 'metal' ? 6 : pat === 'plank' ? 3 : 1.6;
    for (let s = a + R() * step; s < b; s += step * (0.7 + R() * 0.6)) for (const side of [-1, 1]) {
      const x = side * (E + R() * 0.35), z = -s;
      if (pat === 'stone' || pat === 'cobble' || pat === 'brick' || pat === 'tile') box(x, 0.12, z, 0.45, 0.24, step * 0.55, shade(th.road?.[0] || '#8a8478', 0.62 + R() * 0.16));
      else if (pat === 'asphalt') { box(side * (E - 0.1), 0.1, z, 0.3, 0.2, step, '#9e9e9e'); if (R() < 0.12) { box(side * (E + 0.4), 1.6, z, 0.1, 3.2, 0.1, '#455a64'); const l = new THREE.Mesh(G1.sph, glow('#fff3c4')); l.position.set(side * (E + 0.1), 3.2, z); l.scale.setScalar(0.22); stat.add(l); } }
      else if (pat === 'light' || pat === 'metal') { box(x, 0.45, z, 0.12, 0.9, 0.12, '#263238'); const l = new THREE.Mesh(G1.sph, glow(rc)); l.position.set(x, 0.95, z); l.scale.setScalar(0.16); stat.add(l); }
      else if (pat === 'plank') { box(x, 0.5, z, 0.12, 1.0, 0.12, '#5d4037'); if (R() < 0.5) box(x, 0.85, z - step / 2, 0.04, 0.04, step, '#c8a878'); }
      else if (pat === 'rail') box(x, 0.08, z, 0.3, 0.16, step * 0.5, '#6a6a6a');
      else { const t = new THREE.Mesh(G1.cone, M(R() < 0.25 ? shade(gc, 0.8) : gc)); t.position.set(x + (R() - 0.5) * 0.3, 0.18, z); t.scale.set(0.12, 0.36 + R() * 0.3, 0.12); stat.add(t); if (R() < 0.2) { const p2 = new THREE.Mesh(G1.dod, M(shade(rc, 1.1))); p2.position.set(x + side * 0.4, 0.08, z + 0.4); p2.scale.setScalar(0.12 + R() * 0.1); stat.add(p2); } }
    }
  }
}
const EDGE_G = { disc: new THREE.CylinderGeometry(1, 1, 0.02, 14), box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 8, 6), cone: new THREE.ConeGeometry(1, 1, 5), dod: new THREE.DodecahedronGeometry(1, 0) };
export { shade, mixC, toon };
