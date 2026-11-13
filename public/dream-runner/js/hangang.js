// 🌉 한강 러닝: 실제 한강 지도(OSM)로 만든 힐링 러닝 맵
//   장애물 · 탈락 없음. 스스로 속도를 정해 달리고(저절로 빨라지지 않는다), 하늘 · 계절 · 날씨 · 사람들을 보며 쉬는 곳
//   지도 데이터: public/dream-runner/hangang/<코스>.json (tools/hangang-map.mjs 로 만든다 · © OpenStreetMap contributors)
//   좌표: x = 동쪽, z = 남쪽 (미터, 코스 중심이 원점)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBear, poseBear, FLIP_T } from './runner.js';
import { isPhone } from '../../shared/js/perf.js';
import { buildStation, buildCar } from './hangang-station.js';
import { glyph, glyphTex, signMaterial } from './hangang-glyphs.js';
import { buildShopFronts, buildShopInterior, foodMesh, SHOP_MENU, SHOP_KIND } from './hangang-shop.js';
import { buildMall } from './hangang-mall.js';
import { winLights, winProfile, winEra, winSeed, tickWindows, WIN_GRID } from './hangang-windows.js';
import { buildSummit, tickSummit, deckBears } from './hangang-summit.js';
import { buildStreetFurniture, buildLandmarkStatues } from './hangang-street.js';
import { setupAttractions, ATTR_SKIP } from './hangang-attractions.js';
import { LiveTransit } from './hangang-transit.js';
import { LiveRide } from './hangang-ride.js';
import { Traffic } from './hangang-vehicles.js';
import { Drive } from './hangang-drive.js';
// 롯데월드 (8-17): 섬 · 어드벤처 건물은 지도 상자 건물 대신 hangang-park.js 가 실제 모습으로. 놀이기구는 명소 체험(registerAttraction)으로 붙는다
import { parkSkip } from './hangang-park.js';
import './hangang-park-in.js';
import './hangang-tower.js';
import './hangang-attr-river.js';

// 길이 0 인 법선(겹친 점 · 서로 반대로 접힌 면)을 셰이더가 normalize 하면 NaN 이 되고,
//   빛 번짐(블룸)이 그 NaN 을 넓게 퍼뜨려 날 때 화면에 검정 사각형이 생겼다 (8-23). 모든 재질에서 막는다
{ const SC = THREE.ShaderChunk;
  if (!SC.beginnormal_vertex.includes('hgNanSafe')) {
    SC.beginnormal_vertex = SC.beginnormal_vertex.replace('vec3 objectNormal = vec3( normal );', 'vec3 objectNormal = vec3( normal ); /* hgNanSafe */ if ( !( dot( objectNormal, objectNormal ) > 1e-12 ) ) objectNormal = vec3( 0.0, 1.0, 0.0 );');
    SC.normal_vertex = SC.normal_vertex.replace('vNormal = normalize( transformedNormal );', 'vNormal = dot( transformedNormal, transformedNormal ) > 1e-20 ? normalize( transformedNormal ) : vec3( 0.0, 0.0, 1.0 );');
    SC.normal_fragment_begin = SC.normal_fragment_begin.replace('vec3 normal = normalize( vNormal );', 'vec3 normal = dot( vNormal, vNormal ) > 1e-20 ? normalize( vNormal ) : vec3( 0.0, 0.0, 1.0 );');
  } }

export const SEASONS = { spring: '🌸 봄', summer: '🌿 여름', autumn: '🍁 가을', winter: '❄️ 겨울' };
export const WEATHERS = { clear: '☀️ 맑음', cloudy: '☁️ 구름', rain: '🌧️ 비', snow: '🌨️ 눈' };
export const TIMES = { sunrise: ['🌅 일출', 5.9], day: ['🌤️ 낮', 11.5], sunset: ['🌇 노을', 18.4], night: ['🌙 밤', 21.5], dawn: ['🌌 새벽', 4.4] };
export const SPEEDS = [['🚶 걷기', 3.2], ['🏃 조깅', 6.4], ['🏃 러닝', 9.2], ['💨 빠르게', 13.2], ['⚡ 전력 질주', 19]];
export const V_MIN = 2.0, V_MAX = 26;
const BEAR = 0.42; // 한강의 곰돌이들은 작게 (사람 크기쯤)
const LAT_MIN = -600, LAT_MAX = 400; // 강가부터 공원 · 녹지까지 (물속 · 도시 길로는 못 간다: walkable)

const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const C = (c) => new THREE.Color(c);

// ---------- 도형 도우미 ----------
function unpack(arr, S) { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([arr[i] * S, arr[i + 1] * S]); return out; }
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length]; a += x1 * z2 - x2 * z1; } return a / 2; };
function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
const inPoly = (x, z, poly) => inRing(x, z, poly[0]) && !poly.slice(1).some((h) => inRing(x, z, h));
// 평평한 다각형들 → 한 덩어리 (구멍 포함)
// 큰 삼각형(또는 긴 선)을 maxLen 보다 짧게 나눈다 (지형에 얹을 때 꺾여 따라가도록). 모든 속성(위치 · 법선 · uv · 색)을 함께 나눈다
function subdivide(geo, n, maxLen) {
  const g = geo.index ? geo.toNonIndexed() : geo, names = Object.keys(g.attributes), A = names.map((k) => g.attributes[k]), out = names.map(() => []), P = g.attributes.position, L2 = maxLen * maxLen;
  const get = (i) => A.map((a) => { const r = []; for (let c = 0; c < a.itemSize; c++) r.push(a.array[i * a.itemSize + c]); return r; });
  const mid = (a, b) => a.map((at, q) => at.map((x, c) => (x + b[q][c]) / 2)), d2 = (a, b) => { const p = a[0], q = b[0]; return (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2; };
  const put = (vs) => { for (const v of vs) v.forEach((at, q) => out[q].push(...at)); };
  const tri = (a, b, c, depth) => { const ab = d2(a, b), bc = d2(b, c), ca = d2(c, a), m = Math.max(ab, bc, ca); if (m <= L2 || depth > 12) return put([a, b, c]);
    if (m === ab) { const x = mid(a, b); tri(a, x, c, depth + 1); tri(x, b, c, depth + 1); } else if (m === bc) { const x = mid(b, c); tri(a, b, x, depth + 1); tri(a, x, c, depth + 1); } else { const x = mid(c, a); tri(a, b, x, depth + 1); tri(x, b, c, depth + 1); } };
  const seg = (a, b, depth) => { if (d2(a, b) <= L2 || depth > 12) return put([a, b]); const x = mid(a, b); seg(a, x, depth + 1); seg(x, b, depth + 1); };
  for (let i = 0; i + n - 1 < P.count; i += n) { if (n === 3) tri(get(i), get(i + 1), get(i + 2), 0); else seg(get(i), get(i + 1), 0); }
  const r = new THREE.BufferGeometry(); names.forEach((k, q) => r.setAttribute(k, new THREE.BufferAttribute(new Float32Array(out[q]), A[q].itemSize, A[q].normalized))); for (const gr of g.groups) r.addGroup(gr.start, gr.count, gr.materialIndex);
  return r;
}
function fillGeo(polys, y = 0, uvScale = 0) {
  const pos = [], idx = [], uv = [];
  for (const poly of polys) {
    const outer = poly[0], holes = poly.slice(1);
    if (outer.length < 3) continue;
    const v2 = (r) => r.map(([x, z]) => new THREE.Vector2(x, z));
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(v2(outer), holes.map(v2)); } catch { continue; }
    const base = pos.length / 3, all = [...outer, ...holes.flat()];
    for (const [x, z] of all) { pos.push(x, y, z); if (uvScale) uv.push(x / uvScale, z / uvScale); }
    for (const t of tris) idx.push(base + t[0], base + t[1], base + t[2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uvScale) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 선 → 띠 (y 는 숫자 또는 점마다의 높이 함수)
function ribbonInto(P, I, pts, w, y, U) {
  if (pts.length < 2) return;
  const base = P.length / 3; let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz * w / 2, nz = dx * w / 2, h = typeof y === 'function' ? y(i) : y;
    if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    P.push(pts[i][0] + nx, h, pts[i][1] + nz, pts[i][0] - nx, h, pts[i][1] - nz);
    if (U) U.push(0, acc / 4, 1, acc / 4);
    if (i) { const k = base + i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
}
function geoOf(P, I, extra = {}) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); for (const [k, [arr, n]] of Object.entries(extra)) g.setAttribute(k, new THREE.Float32BufferAttribute(arr, n)); g.setIndex(I); g.computeVertexNormals(); return g; }
// 땅에 붙은 층: 깊이를 쓰지 않고 순서대로 그린다 (먼 곳에서 깜빡이지 않게)
function flatMat(color, order, extra = {}) { const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, depthWrite: false, depthTest: false, ...extra }); m.userData.order = order; return m; }

// 창문 무늬 (8 × 8 칸). lit: 밤에 켜진 창
function windowTex(glass, lit, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = rnd(seed);
  g.fillStyle = lit ? '#000' : glass ? '#c9d3dc' : '#e9e6df'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = i * 32, y = j * 32;
    if (lit) { if (r() < 0.3) { g.fillStyle = r() < 0.8 ? `hsl(${35 + r() * 15},90%,${62 + r() * 18}%)` : `hsl(200,40%,${70 + r() * 15}%)`; if (glass) g.fillRect(x + 2, y + 3, 28, 25); else g.fillRect(x + 7, y + 8, 18, 16); } continue; }
    if (glass) { const k = 0.85 + r() * 0.15; g.fillStyle = `rgb(${150 * k},${168 * k},${188 * k})`; g.fillRect(x + 2, y + 3, 28, 25); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 3, 28, 6); }
    else { g.fillStyle = '#c9c4ba'; g.fillRect(x + 4, y + 26, 24, 3); g.fillStyle = `rgb(${60 + r() * 25},${72 + r() * 25},${88 + r() * 25})`; g.fillRect(x + 7, y + 8, 18, 16); }
  }
  // (0,0) 근처는 벽 (지붕 · 바닥 uv 가 가리키는 곳)
  g.fillStyle = lit ? '#000' : glass ? '#8899aa' : '#e9e6df'; g.fillRect(0, 0, 6, 6);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 외벽 무늬 (8 × 8 칸 = 8층 × 8칸). lit: 밤에 켜진 창 (검은 바탕에 불빛)
//   같은 그림은 한 번만 그려 모든 칸이 같이 쓴다 (예전엔 칸마다 다시 그리고, 켜진 창 그림은 칸을 지워도 남았다)
const FACADE = new Map();
function facadeTex(type, lit, seed) { const k = `${type}|${lit}|${seed}`; if (!FACADE.has(k)) FACADE.set(k, facadeTex0(type, lit, seed)); return FACADE.get(k); }
function facadeTex0(type, lit, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = rnd(seed + type.length * 7), C = 32;
  const wall = { apt: '#f4f2ee', glass: '#d6dde4', stone: '#e6e1d8', brick: '#d7d0c8', gold: '#f0e2c0', assembly: '#f6f3ec' }[type];
  if (type === 'hanok') { // 한옥 벽: 아래 돌 기단 · 흰 회벽 · 나무 기둥 · 창살 창 (밤엔 창호지 불빛)
    g.fillStyle = lit ? '#000' : '#f2ece0'; g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 8; j++) { const y = j * 32; if (!lit) { g.fillStyle = '#8f8578'; g.fillRect(0, y + 26, 256, 6); }
      for (let i = 0; i < 8; i++) { const x = i * 32; if (!lit) { g.fillStyle = '#6b4a30'; g.fillRect(x, y, 4, 26); }
        if (i % 2) { if (lit) { g.fillStyle = '#fff'; g.fillRect(x + 7, y + 5, 20, 16); g.fillStyle = '#5a5a5a'; for (let k = 1; k < 4; k++) g.fillRect(x + 7 + k * 5, y + 5, 1, 16); for (let k = 1; k < 3; k++) g.fillRect(x + 7, y + 5 + k * 5.3, 20, 1); } else { g.fillStyle = '#efe4c8'; g.fillRect(x + 7, y + 5, 20, 16); g.fillStyle = '#7a5a3e'; for (let k = 0; k < 4; k++) g.fillRect(x + 7 + k * 6, y + 5, 1, 16); for (let k = 0; k < 3; k++) g.fillRect(x + 7, y + 5 + k * 6, 20, 1); } } } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  if (type === 'factory') { // 벽돌 공장 · 창고: 벽돌 줄눈 + 위가 둥근 큰 철제 창(격자) · 밤엔 카페 불빛
    g.fillStyle = lit ? '#000' : '#d8cfc6'; g.fillRect(0, 0, 256, 256);
    if (!lit) for (let y = 0; y < 256; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < 256; x += 12) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.fillRect(x, y, 11, 5); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 64 + 12, y = j * 64 + 10; g.beginPath(); g.moveTo(x, y + 48); g.lineTo(x, y + 14); g.arc(x + 20, y + 14, 20, Math.PI, 0); g.lineTo(x + 40, y + 48); g.closePath(); if (lit) { g.fillStyle = '#fff'; g.fill(); g.fillStyle = '#4a4a4a'; for (let k = 1; k < 3; k++) g.fillRect(x + k * 13, y + 2, 2, 46); g.fillRect(x, y + 30, 40, 2); g.fillRect(x, y + 16, 40, 1); } else { g.fillStyle = '#2d3238'; g.fill(); g.strokeStyle = '#4a4f55'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 16, 36, 4); g.fillStyle = '#4a4f55'; for (let k = 1; k < 3; k++) g.fillRect(x + k * 13, y + 2, 2, 46); g.fillRect(x, y + 30, 40, 2); } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  if (type === 'street' || type === 'street2') { // 거리 상가: 1층(그림 맨 아래 줄)은 통유리 가게, 위층은 창틀 창(street) / 가로 띠창(street2)
    g.fillStyle = lit ? '#000' : '#ece8e2'; g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 8; j++) { const y = j * 32, ground = j === 7;
      if (ground) { for (let i = 0; i < 4; i++) { const x = i * 64; if (lit) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#a8a8a8'); g.fillStyle = gr; g.fillRect(x + 3, y + 3, 58, 28); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 31, y + 3, 2, 28); g.fillRect(x + 3, y + 3, 58, 2); g.fillStyle = 'rgba(40,28,20,.45)'; g.fillRect(x + 10, y + 20, 14, 11); g.fillRect(x + 40, y + 18, 10, 13); } else { g.fillStyle = '#3a4350'; g.fillRect(x + 3, y + 3, 58, 28); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + 3, y + 3, 58, 5); g.fillStyle = '#2a2a2e'; g.fillRect(x + 31, y + 3, 2, 28); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y, 64, 3); } } continue; }
      if (type === 'street2') { if (lit) { r(); r(); r(); g.fillStyle = '#fff'; g.fillRect(4, y + 9, 248, 14); g.fillStyle = '#3a3a3a'; for (let x = 4; x < 252; x += 41) g.fillRect(x, y + 9, 2, 14); g.fillRect(4, y + 9, 248, 1); continue; } g.fillStyle = `rgb(${70 + r() * 30},${82 + r() * 30},${96 + r() * 30})`; g.fillRect(4, y + 9, 248, 14); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(4, y + 9, 248, 3); g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 4; x < 252; x += 41) g.fillRect(x, y + 9, 2, 14); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y + 28, 256, 2); continue; }
      for (let i = 0; i < 8; i++) { const x = i * 32, on = r() < 0.4; if (lit) { if (r() < 0.12) continue; r(); r(); r(); g.fillStyle = '#fff'; g.fillRect(x + 8, y + 7, 16, 18); g.fillStyle = '#404040'; g.fillRect(x + 15, y + 7, 2, 18); r(); continue; }
        if (r() < 0.12) continue; g.fillStyle = '#f7f5f0'; g.fillRect(x + 6, y + 5, 20, 22); g.fillStyle = `rgb(${66 + r() * 28},${76 + r() * 28},${92 + r() * 28})`; g.fillRect(x + 8, y + 7, 16, 18); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x + 8, y + 7, 16, 3); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 15, y + 7, 2, 18); if (r() < 0.18) { g.fillStyle = '#d9d9d6'; g.fillRect(x + 7, y + 22, 18, 6); g.fillStyle = '#9a9a96'; g.fillRect(x + 9, y + 23, 6, 4); } } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  if (type === 'villa') { // 2000년대 뒤 빌라 · 다세대 (드라이비트 · 화강석 · 판넬): 줄마다 같은 창 모양 (큰 창 + 난간 · 미닫이 창 + 방범창 · 작은 욕실 창 · 벽), 층 사이 띠
    g.fillStyle = lit ? '#000' : '#efeeea'; g.fillRect(0, 0, 256, 256);
    // 창 배치는 낮 · 밤 그림이 같아야 해서 따로 정한 씨앗으로 (켜짐만 r)
    const rl = rnd(4242), colT = Array.from({ length: 8 }, () => { const q = rl(); return q < 0.34 ? 'big' : q < 0.7 ? 'bars' : q < 0.86 ? 'small' : 'wall'; });
    for (let i = 1; i < 8; i++) if (colT[i] === 'wall' && colT[i - 1] === 'wall') colT[i] = 'bars';
    for (let j = 0; j < 8; j++) { const y = j * C;
      if (!lit) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, y + 29, 256, 3); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, y + 28, 256, 1); }
      for (let i = 0; i < 8; i++) { const x = i * C, t = colT[i], warm = r() < 0.7;
        const R = t === 'big' ? [x + 3, y + 5, 26, 20] : t === 'bars' ? [x + 8, y + 7, 16, 14] : t === 'small' ? [x + 12, y + 7, 8, 6] : null; if (!R) continue;
        if (lit) { g.fillStyle = t === 'small' ? '#bbb' : '#fff'; g.fillRect(...R); g.fillStyle = '#3a3a3a'; if (t === 'big') { g.fillRect(x + 15, y + 5, 2, 20); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 3, y + 17, 26, 8); } if (t === 'bars') { g.fillStyle = 'rgba(40,40,40,.85)'; for (let k2 = 0; k2 < 5; k2++) g.fillRect(x + 9 + k2 * 3.4, y + 7, 1, 14); g.fillRect(x + 8, y + 13, 16, 1); } continue; }
        g.fillStyle = '#4a4e54'; g.fillRect(R[0] - 1, R[1] - 1, R[2] + 2, R[3] + 2);
        const k = 0.85 + r() * 0.3; g.fillStyle = `rgb(${72 * k},${86 * k},${100 * k})`; g.fillRect(...R); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(R[0], R[1], R[2], 3);
        if (r() < 0.35) { g.fillStyle = `rgba(${230 + r() * 25},${220 + r() * 25},${200 + r() * 30},.75)`; g.fillRect(R[0] + 1, R[1] + 1, Math.floor(R[2] * (0.25 + r() * 0.3)), R[3] - 2); } // 커튼
        if (t === 'big') { g.fillStyle = '#3a3d42'; g.fillRect(x + 15, y + 5, 2, 20); g.fillStyle = 'rgba(205,220,228,.55)'; g.fillRect(x + 2, y + 17, 28, 8); g.fillStyle = '#5b5f66'; g.fillRect(x + 2, y + 16, 28, 1); } // 유리 난간
        if (t === 'bars') { g.fillStyle = 'rgba(70,72,76,.85)'; for (let k2 = 0; k2 < 5; k2++) g.fillRect(x + 9 + k2 * 3.4, y + 7, 1, 14); g.fillRect(x + 8, y + 13, 16, 1); if (r() < 0.25) { g.fillStyle = '#dedcd6'; g.fillRect(x + 10, y + 22, 12, 6); g.fillStyle = '#8f8f8b'; g.fillRect(x + 11, y + 23, 5, 4); } }
      } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
  if (type === 'fins') { // 연회색 세로 핀 + 그 사이 좁은 유리 띠 (파크원)
    g.fillStyle = lit ? '#000' : '#e4e4e0'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const x = i * 32, y = j * 32; if (lit) { g.fillStyle = '#fff'; g.fillRect(x + 9, y + 2, 14, 27); continue; } const k = 0.8 + r() * 0.2; g.fillStyle = `rgb(${120 * k},${136 * k},${150 * k})`; g.fillRect(x + 9, y + 2, 14, 27); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 9, y + 2, 3, 27); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 23, y, 3, 32); }
    if (!lit) for (let j = 0; j < 8; j++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, j * 32 + 30, 256, 2); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  if (type === 'panels') { g.fillStyle = lit ? '#000' : '#cfc8c2'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 8; i++) { const x = i * 32; if (lit) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x + 14, 0, 4, 256); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 10, 0, 12, 256); } else { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 10, 0, 12, 256); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 2, 0, 2, 256); } } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  if (type === 'church') { g.fillStyle = lit ? '#000' : '#f2ede4'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 64 + 22, y = j * 64 + 8; g.fillStyle = lit ? '#fff' : '#5a6a86'; g.beginPath(); g.moveTo(x, y + 48); g.lineTo(x, y + 12); g.arc(x + 10, y + 12, 10, Math.PI, 0); g.lineTo(x + 20, y + 48); g.closePath(); g.fill(); g.strokeStyle = lit ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x + 10, y + 4); g.lineTo(x + 10, y + 48); g.stroke(); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  if (type === 'assembly') { g.fillStyle = lit ? '#000' : wall; g.fillRect(0, 0, 256, 256); if (!lit) { for (let i = 0; i < 8; i++) { const x = i * 32; g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x + 22, 0, 10, 256); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 4, 0, 3, 256); } for (let j = 0; j < 8; j++) { g.fillStyle = 'rgba(0,0,0,.04)'; g.fillRect(0, j * 32, 256, 1); } } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
  g.fillStyle = lit ? '#000' : wall; g.fillRect(0, 0, 256, 256);
  if (!lit && type === 'brick') for (let y = 0; y < 256; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 256; x += 8) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; g.fillRect(x, y, 7, 3); }
  if (!lit && type === 'stone') for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, y, 256, 1); }
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    // 집(아파트 · 주택)은 따뜻한 노란 불빛 (가끔 TV 파란빛), 회사(유리 · 석재)는 하얀 형광등빛
    const home = type === 'apt' || type === 'brick', x = i * C, y = j * C, on = r() < (type === 'apt' ? 0.55 : type === 'brick' ? 0.35 : 0.5), tv = home && r() < 0.12;
    const lc = home ? (tv ? `hsl(215,60%,${62 + r() * 12}%)` : `hsl(${30 + r() * 12},${85 + r() * 10}%,${55 + r() * 15}%)`) : `hsl(${195 + r() * 20},${18 + r() * 15}%,${80 + r() * 12}%)`;
    if (type === 'apt') {
      // 넓은 거실 창 + 발코니 난간 띠 (가끔 에어컨 · 화분)
      if (lit) { g.fillStyle = '#fff'; g.fillRect(x + 3, y + 6, 26, 17); g.fillStyle = '#444'; g.fillRect(x + 15, y + 6, 2, 17); g.fillRect(x + 3, y + 6, 26, 1); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 3, y + 19, 26, 4); continue; }
      g.fillStyle = `rgb(${88 + r() * 30},${104 + r() * 30},${120 + r() * 30})`; g.fillRect(x + 3, y + 6, 26, 17);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 3, y + 6, 26, 3);
      g.fillStyle = '#fbfaf7'; g.fillRect(x, y + 23, C, 6); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, y + 29, C, 2);
      if (r() < 0.2) { g.fillStyle = '#e8e8e8'; g.fillRect(x + 20, y + 16, 8, 7); }
    } else if (type === 'glass' || type === 'gold') {
      if (lit) { g.fillStyle = '#fff'; g.fillRect(x + 1, y + 2, 30, 26); g.fillStyle = '#555'; g.fillRect(x + 15, y + 2, 2, 26); continue; }
      const k = 0.78 + r() * 0.22; g.fillStyle = type === 'gold' ? `rgb(${200 * k},${170 * k},${100 * k})` : `rgb(${150 * k},${170 * k},${192 * k})`; g.fillRect(x + 1, y + 2, 30, 26);
      const gr = g.createLinearGradient(x, y, x + C, y + C); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.12)'); g.fillStyle = gr; g.fillRect(x + 1, y + 2, 30, 26);
      g.fillStyle = type === 'gold' ? '#b08a3a' : '#7d8794'; g.fillRect(x + 15, y + 2, 2, 26); g.fillRect(x, y + 28, C, 4);
    } else if (type === 'stone') {
      if (lit) { g.fillStyle = '#fff'; g.fillRect(x + 7, y + 6, 18, 20); g.fillStyle = '#4a4a4a'; g.fillRect(x + 15, y + 6, 2, 20); continue; }
      g.fillStyle = `rgb(${70 + r() * 25},${82 + r() * 25},${96 + r() * 25})`; g.fillRect(x + 7, y + 6, 18, 20); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 6, y + 26, 20, 2); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 7, y + 6, 18, 3);
    } else {
      // 벽돌 집 · 빌라: 줄마다 창 모양이 같다 (은색 알루미늄 창틀 · 방범창 · 넓은 거실 창 · 실외기 · 화분)
      const bt = type === 'brick' ? (facadeTex.bcol ||= (() => { const rl = rnd(555); return Array.from({ length: 8 }, () => { const q = rl(); return q < 0.5 ? 'bars' : q < 0.75 ? 'wide' : 'plain'; }); })())[i] : 'plain';
      if (lit) { g.fillStyle = '#fff'; if (bt === 'wide') { g.fillRect(x + 5, y + 8, 22, 16); g.fillStyle = '#4a4a4a'; g.fillRect(x + 15, y + 8, 2, 16); } else { g.fillRect(x + 9, y + 8, 14, 16); g.fillStyle = '#4a4a4a'; g.fillRect(x + 15, y + 8, 2, 16); } if (bt === 'bars') { g.fillStyle = 'rgba(40,40,40,.85)'; for (let k2 = 0; k2 < 4; k2++) g.fillRect(x + 10 + k2 * 4, y + 8, 1, 16); g.fillRect(x + 9, y + 15, 14, 1); } continue; }
      if (bt === 'wide') { g.fillStyle = '#c9c9c4'; g.fillRect(x + 4, y + 7, 24, 18); g.fillStyle = `rgb(${60 + r() * 20},${68 + r() * 20},${78 + r() * 20})`; g.fillRect(x + 5, y + 8, 22, 16); g.fillStyle = '#c9c9c4'; g.fillRect(x + 15, y + 8, 2, 16); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 5, y + 8, 22, 3); g.fillStyle = '#efe9df'; g.fillRect(x + 3, y + 24, 26, 2); }
      else { if (type === 'brick') { g.fillStyle = '#c9c9c4'; g.fillRect(x + 8, y + 7, 16, 18); } g.fillStyle = `rgb(${60 + r() * 20},${68 + r() * 20},${78 + r() * 20})`; g.fillRect(x + 9, y + 8, 14, 16); g.fillStyle = '#efe9df'; g.fillRect(x + 8, y + 24, 16, 2); }
      if (type === 'brick' && r() < 0.3) { g.fillStyle = 'rgba(240,236,228,.7)'; g.fillRect(x + 10, y + 9, 5 + r() * 4, 14); } // 커튼
      if (bt === 'bars') { g.fillStyle = 'rgba(58,60,64,.9)'; for (let k2 = 0; k2 < 4; k2++) g.fillRect(x + 10 + k2 * 4, y + 8, 1, 16); g.fillRect(x + 9, y + 15, 14, 1); }
      if (type === 'brick' && r() < 0.14) { g.fillStyle = '#e2e0da'; g.fillRect(x + 20, y + 20, 10, 7); g.fillStyle = '#8f8f8b'; g.fillRect(x + 21, y + 21, 5, 5); } // 실외기
      else if (type === 'brick' && r() < 0.08) { g.fillStyle = '#4f7a3f'; g.fillRect(x + 9, y + 22, 14, 3); g.fillStyle = '#a35a3a'; g.fillRect(x + 9, y + 24, 14, 2); } // 창가 화분
    }
  }
  g.fillStyle = lit ? '#000' : wall; g.fillRect(0, 0, 3, 3);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 땅 무늬: 잔디(회색조라 계절 색이 곱해진다) · 도시 바닥 · 아스팔트(가장자리 흰 선) · 러닝 트랙(붉은 우레탄) · 호안 돌
// 숲 지붕 그림 (산을 멀리서 보면 나무 꼭대기들이 빽빽이 겹친 모습): 계절마다 한 장, 이어 붙여도 이음매가 없게 가장자리를 감싼다
//   uv 는 7m 마다 1 이라 repeat 0.16 이면 그림 한 장이 약 45m (나무 지붕 하나 5 ~ 9m)
const CANOPY = {};
function canopyTex(season) {
  if (CANOPY[season]) return CANOPY[season];
  const P = { spring: ['#3a5230', ['#6a9450', '#7fa85a', '#5d8448', '#d8b4c0', '#93b870', '#4f7a40', '#73a052']], summer: ['#2c4428', ['#4a7a3e', '#5a8a48', '#3e6a3a', '#669a50', '#365e34', '#4f7f42', '#5f9248']], autumn: ['#2e281e', ['#9a4a2e', '#b07a3a', '#a8883e', '#7a3a28', '#3f5a36', '#8a5a32', '#6a6a38', '#c09848']], winter: ['#443f38', ['#5e5750', '#6a625a', '#766c62', '#33503a', '#385438', '#82786c', '#5a534c']] }[season] || ['#22361f', ['#355a33']];
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), r = rnd(season.length * 977 + 3);
  g.fillStyle = P[0]; g.fillRect(0, 0, N, N);
  // 가까이(400m 남짓)서 같은 크기 동그라미가 고르게 찍혀 점무늬로 보였다 → 큰 얼룩(나무 무리 색 차이) 위에, 크기가 제각각인 나무 꼭대기를 빽빽이 겹치고
  //   꼭대기마다 해 쪽(왼쪽 위)은 밝게 · 반대쪽은 살짝 어둡게 (검은 테두리 없이), 작은 잎 덩이를 덧대 둥근 윤곽을 흐트러뜨린다
  const wrapC = (x, y, rr, fn) => { for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]]) { const cx = x + ox, cy = y + oy; if (cx < -rr || cx > N + rr || cy < -rr || cy > N + rr) continue; fn(cx, cy); } };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, rr = 30 + r() * 50, c = P[1][Math.floor(r() * P[1].length)]; wrapC(x, y, rr, (cx, cy) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, shade(c, 0.9)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.45; g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); g.globalAlpha = 1; }); }
  for (let i = 0; i < 1100; i++) { const x = r() * N, y = r() * N, rr = 3.5 + r() * r() * 11, c = P[1][Math.floor(r() * P[1].length)];
    const subs = Array.from({ length: 3 }, () => { const a = r() * 6.28, d = rr * (0.55 + r() * 0.35); return [Math.cos(a) * d, Math.sin(a) * d, rr * (0.3 + r() * 0.25), shade(c, 0.85 + r() * 0.3)]; });
    wrapC(x, y, rr * 1.3, (cx, cy) => {
      const gr = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.05, cx, cy, rr); gr.addColorStop(0, shade(c, 1.18)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, 0.72)); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill();
      for (const [ox, oy, q, sc] of subs) { g.fillStyle = sc; g.beginPath(); g.arc(cx + ox, cy + oy, q, 0, 7); g.fill(); } }); }
  // 잎 사이 그늘 틈 (작은 어두운 점)
  for (let i = 0; i < 700; i++) { const x = r() * N, y = r() * N, q = 0.6 + r() * 1.4; g.fillStyle = `rgba(10,18,8,${0.12 + r() * 0.18})`; wrapC(x, y, q, (cx, cy) => { g.beginPath(); g.arc(cx, cy, q, 0, 7); g.fill(); }); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(0.085, 0.085); CANOPY[season] = t; return t;
}
// 숲 바닥 (가까이서 본 서울숲 · 동네 산 나무 밑): 흙 · 낮은 풀 · 이끼 · 떨어진 잎. 동그라미 없이 얼룩 · 잎 조각으로, 계절마다 한 장
//   uv 는 7m 마다 1, repeat 0.28 이면 그림 한 장이 약 25m
const FFLOOR = {}, FFLOOR_REP = 0.28;
function forestFloorTex(season) {
  if (FFLOOR[season]) return FFLOOR[season];
  const P = {
    spring: { base: '#6d7f45', blot: ['#7d9450', '#5f7040', '#86744e', '#738a48'], soil: ['#7a6446', '#6a573e'], leaf: ['#8fae5a', '#a3bf68', '#6f5a3e', '#e6c6cf'], grass: 0.7 },
    summer: { base: '#4f6436', blot: ['#5c7440', '#435a30', '#6b5c3e', '#587038'], soil: ['#65533a', '#574832'], leaf: ['#6a8a44', '#7d9a4c', '#6e5a3a'], grass: 0.6 },
    autumn: { base: '#6a5532', blot: ['#7c5e34', '#5e4a2e', '#8a6a38', '#6c6034'], soil: ['#5e4a32', '#4f3f2c'], leaf: ['#b0602e', '#c98a38', '#d4a640', '#8a4428', '#a07a3a', '#6e7a3a'], grass: 0.15 },
    winter: { base: '#6a5e4c', blot: ['#76695a', '#5c5244', '#7e7262', '#665c4a'], soil: ['#5a4e40', '#4c4236'], leaf: ['#8a7660', '#7a6a56', '#9a8670', '#5e5446'], grass: 0.05 },
  }[season] || { base: '#4f6436', blot: ['#5c7440'], soil: ['#65533a'], leaf: ['#6a8a44'], grass: 0.5 };
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), r = rnd(season.length * 131 + 17);
  const wrap = (x, y, rr, fn) => { for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [-N, -N], [N, -N], [-N, N]]) { const cx = x + ox, cy = y + oy; if (cx < -rr || cx > N + rr || cy < -rr || cy > N + rr) continue; fn(cx, cy); } };
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  g.fillStyle = P.base; g.fillRect(0, 0, N, N);
  // 큰 얼룩: 가장자리가 흐려 사라지는 부드러운 반점 (그늘 · 풀 많은 곳 · 흙 드러난 곳)
  for (let i = 0; i < 70; i++) { const x = r() * N, y = r() * N, rr = 18 + r() * 46, c = P.blot[Math.floor(r() * P.blot.length)], a = 0.25 + r() * 0.3;
    wrap(x, y, rr, (cx, cy) => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, hexA(c, a)); gr.addColorStop(1, hexA(c, 0)); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }); }
  // 흙 · 이끼 작은 조각 (찌그러진 모양)
  for (let i = 0; i < 900; i++) { const x = r() * N, y = r() * N, rr = 1.5 + r() * 4.5, c = r() < 0.6 ? P.soil[Math.floor(r() * P.soil.length)] : P.blot[Math.floor(r() * P.blot.length)], rot = r() * 3.14, sq = 0.35 + r() * 0.5;
    wrap(x, y, rr, (cx, cy) => { g.fillStyle = hexA(c, 0.35 + r() * 0.35); g.beginPath(); g.ellipse(cx, cy, rr, rr * sq, rot, 0, 7); g.fill(); }); }
  // 풀잎 (봄 · 여름에 많이)
  g.lineWidth = 1; for (let i = 0; i < 2200 * P.grass; i++) { const x = r() * N, y = r() * N, v = r(); g.strokeStyle = v < 0.5 ? 'rgba(150,180,100,.45)' : 'rgba(70,95,50,.5)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); g.stroke(); }
  // 떨어진 잎: 작은 타원 (가을엔 빽빽이)
  const nLeaf = season === 'autumn' ? 4200 : season === 'winter' ? 2600 : 900;
  for (let i = 0; i < nLeaf; i++) { const x = r() * N, y = r() * N, rr = 1.2 + r() * 1.8, c = P.leaf[Math.floor(r() * P.leaf.length)], rot = r() * 3.14;
    wrap(x, y, rr, (cx, cy) => { g.fillStyle = hexA(c, 0.55 + r() * 0.4); g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.45, rot, 0, 7); g.fill(); }); }
  // 잔 그늘 점 (잎 사이 틈)
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(20,25,10,${0.08 + r() * 0.12})`; g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(FFLOOR_REP, FFLOOR_REP); FFLOOR[season] = t; return t;
}
// 숲 바닥 재질: 가까이는 숲 바닥, 멀리(나무를 그리지 않는 거리)는 나무 꼭대기들이 겹친 숲 지붕 그림으로 서서히 바뀐다 + 얼룩(patchy)
function woodFloor(mat, season) {
  const U = { uCan: { value: canopyTex(season) }, uCanK: { value: 0.085 / FFLOOR_REP } }; mat.userData.uCan = U.uCan;
  mat.customProgramCacheKey = () => 'patchy-wood';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform sampler2D uCan;\nuniform float uCanK;\nfloat hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }\n' +
      sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float pn = nz(vWP.xz * 0.045) * 0.6 + nz(vWP.xz * 0.16) * 0.4; diffuseColor.rgb *= 0.84 + pn * 0.3;\n float fd = smoothstep(380.0, 760.0, length(vViewPosition)); vec3 cn = texture2D(uCan, vMapUv * uCanK).rgb * 0.92; diffuseColor.rgb = mix(diffuseColor.rgb, cn, fd);');
  };
  return mat;
}
// 눈 쌓임: 위를 보는 면(지붕 · 옥상 설비)이 눈이 쌓인 만큼(snowK) 하얘진다. 모든 칸이 같은 값을 쓴다
const SNOW_U = { value: 0 };
function snowify(m) {
  const prev = m.onBeforeCompile, pk = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); sh.uniforms.uSnow = SNOW_U;
    sh.vertexShader = 'varying float vUpY;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vUpY = objectNormal.y;');
    sh.fragmentShader = 'uniform float uSnow;\nvarying float vUpY;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.97), uSnow * smoothstep(0.55, 0.85, vUpY));'); };
  m.customProgramCacheKey = () => (pk ? pk() : '') + '|snow';
  return m;
}
function groundTex(kind) {
  const N = kind === 'city' ? 128 : 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), r = rnd(kind.length * 31 + 7);
  const noise = (base, amp, n, sz) => { g.fillStyle = base; g.fillRect(0, 0, N, N); for (let i = 0; i < n; i++) { const v = (r() - 0.5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(r() * N, r() * N, sz * (0.5 + r()), sz * (0.5 + r())); } };
  if (kind === 'grass') { noise('#e4e4e4', 0.22, 2600, 6); g.lineWidth = 1; for (let i = 0; i < 1400; i++) { const x = r() * N, y = r() * N, v = 150 + r() * 105; g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); g.stroke(); } }
  else if (kind === 'city') { noise('#d8d8d8', 0.12, 500, 10); g.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i <= N; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, N); g.moveTo(0, i); g.lineTo(N, i); g.stroke(); } }
  else if (kind === 'asphalt') { noise('#4b4f56', 0.16, 5000, 2); g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 5, N); g.fillRect(N - 11, 0, 5, N); }
  else if (kind === 'track') { noise('#a06a5c', 0.14, 6000, 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(5, 0, 4, N); g.fillRect(N - 9, 0, 4, N); }
  else if (kind === 'steps') { noise('#d6cdbd', 0.08, 400, 10); for (let k = 0; k < 4; k++) { const x = (k / 4) * N; g.fillStyle = `rgba(0,0,0,${0.06 + k * 0.05})`; g.fillRect(x, 0, N / 4, N); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, 0, 3, N); } for (let y = 0; y < N; y += 64) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y, N, 2); } }
  else { noise('#c9c2b4', 0.18, 300, 14); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let y = 0; y < N; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); for (let x = (y / 32) % 2 ? 0 : 24; x < N; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 바람: 정점을 높이에 비례해 살랑 (인스턴스마다 위상이 다르게)
function windify(mat, timeU, amp, crown = false) {
  mat.customProgramCacheKey = () => `wind${amp}${crown}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
      #else
        vec2 ip = vec2(0.0);
      #endif
      float hk = ${crown ? 'clamp((position.y - 2.5) / 4.0, 0.0, 1.0)' : 'clamp(position.y / 0.42, 0.0, 1.0)'};
      float w = sin(uTime * 1.7 + ip.x * 0.35 + ip.y * 0.21) + sin(uTime * 2.9 + ip.x * 0.9) * 0.4;
      transformed.x += w * ${amp.toFixed(3)} * hk * ${crown ? '6.0' : '1.0'}; transformed.z += w * ${(amp * 0.6).toFixed(3)} * hk * ${crown ? '6.0' : '1.0'};`);
  };
}
// 잔디밭 얼룩: 넓은 범위의 밝고 어두운 무늬 (월드 좌표 노이즈)
function patchy(mat) {
  mat.customProgramCacheKey = () => 'patchy';
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nfloat hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }\n' +
      sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float pn = nz(vWP.xz * 0.045) * 0.6 + nz(vWP.xz * 0.16) * 0.4; diffuseColor.rgb *= 0.86 + pn * 0.3; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.04, 0.86), smoothstep(0.55, 0.8, nz(vWP.xz * 0.02)));');
  };
}
// 풀잎 그림: 끝이 뾰족한 잎 여러 장 (투명 바탕)
function bladeTex() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const g = cv.getContext('2d'), r = rnd(5);
  for (let i = 0; i < 22; i++) { const x = 10 + r() * 108, h = 40 + r() * 54, lean = (r() - 0.5) * 22, w = 3 + r() * 4; const v = 170 + r() * 85; g.fillStyle = `rgb(${v * 0.85},${v},${v * 0.7})`; g.beginPath(); g.moveTo(x - w, 96); g.quadraticCurveTo(x + lean * 0.4, 96 - h * 0.6, x + lean, 96 - h); g.quadraticCurveTo(x + lean * 0.4 + w * 0.3, 96 - h * 0.55, x + w, 96); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 잎 · 꽃 카드 그림: blossom = 다섯 꽃잎 벚꽃 여러 송이, 아니면 작은 잎 무더기. 가장자리는 들쭉날쭉 (회색조라 계절 색이 곱해진다)
function foliageTex(blossom) {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), r = rnd(blossom ? 41 : 43);
  g.clearRect(0, 0, N, N);
  const inBlob = (x, y) => { const dx = x - 128, dy = y - 128, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx); return d < 104 + Math.sin(a * 7) * 10 + Math.sin(a * 13) * 6; };
  for (let i = 0; i < (blossom ? 260 : 520); i++) {
    const x = 18 + r() * 220, y = 18 + r() * 220; if (!inBlob(x, y)) continue;
    const d = Math.hypot(x - 128, y - 128) / 110, v = Math.round(255 - d * (blossom ? 35 : 70) - r() * (blossom ? 22 : 40));
    if (blossom) { const rad = 7 + r() * 7, rot = r() * 6.28; g.fillStyle = `rgb(${v},${Math.round(v * (0.82 + r() * 0.1))},${Math.round(v * (0.88 + r() * 0.08))})`; for (let k = 0; k < 5; k++) { const a = rot + (k / 5) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * rad * 0.55, y + Math.sin(a) * rad * 0.55, rad * 0.55, rad * 0.38, a, 0, 7); g.fill(); } g.fillStyle = `rgba(${Math.round(v * 0.75)},${Math.round(v * 0.45)},${Math.round(v * 0.55)},.9)`; g.beginPath(); g.arc(x, y, rad * 0.2, 0, 7); g.fill(); }
    else { const L = 9 + r() * 9, a = r() * 6.28; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, L, L * 0.45, a, 0, 7); g.fill(); g.strokeStyle = `rgba(0,0,0,.12)`; g.beginPath(); g.moveTo(x - Math.cos(a) * L * 0.8, y - Math.sin(a) * L * 0.8); g.lineTo(x + Math.cos(a) * L * 0.8, y + Math.sin(a) * L * 0.8); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function petalTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(16, 16, 12, 7, 0.6, 0, 7); g.fill(); return new THREE.CanvasTexture(cv); }
// 나비 날개 그림: 위 · 아래 날개 + 무늬 (종류 4가지: 노랑나비 · 흰나비 · 호랑나비 · 푸른부전나비)
function butterflyTex(kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const [base, edge, spot] = [['#ffd84a', '#3a2a10', '#fff2a8'], ['#f6f3ea', '#4a4a4a', '#ffffff'], ['#ff9a2e', '#1d1410', '#ffe08a'], ['#7fb8ff', '#1d2a55', '#e8f2ff']][kind];
  g.fillStyle = edge; g.beginPath(); g.ellipse(30, 22, 30, 19, -0.35, 0, 7); g.fill(); g.beginPath(); g.ellipse(24, 46, 20, 15, 0.45, 0, 7); g.fill();
  g.fillStyle = base; g.beginPath(); g.ellipse(29, 22, 25, 14.5, -0.35, 0, 7); g.fill(); g.beginPath(); g.ellipse(23, 45, 15.5, 11, 0.45, 0, 7); g.fill();
  g.fillStyle = edge; for (const [x, y, r2] of [[40, 16, 3.2], [30, 26, 2.6], [22, 47, 2.4]]) { g.beginPath(); g.arc(x, y, r2, 0, 7); g.fill(); }
  g.fillStyle = spot; for (const [x, y] of [[50, 12], [55, 20], [46, 30]]) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
  // 왼쪽 끝(몸통 쪽)이 날개 뿌리
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cloudTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d'), r = rnd(7);
  for (let i = 0; i < 26; i++) { const x = 40 + r() * 176, y = 50 + r() * 40, rad = 18 + r() * 34, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dotTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); }

// ---------- 하늘: 시각마다의 색 ----------
const SKY = [
  [0, '#060b1f', '#18223f', '#0b0f22'], [4.2, '#0d1636', '#3a3a68', '#141a33'], [5.3, '#2b3d78', '#d68a7a', '#3a3550'], [6.2, '#4f7ac2', '#ffc58f', '#7a6a70'],
  [7.5, '#4a8ad8', '#cfe3f5', '#9fb3c4'], [12, '#2f78d8', '#bcdcf4', '#b9c7cf'], [16.5, '#3f7fd0', '#e6dcc0', '#b8b4a8'], [18, '#3a5aa8', '#ffb070', '#8a6a68'],
  [18.8, '#2a3570', '#ff7a55', '#5a3e55'], [19.6, '#151c45', '#7a4a78', '#262238'], [20.6, '#080d24', '#1d2545', '#0d1124'], [24, '#060b1f', '#18223f', '#0b0f22'],
];
function skyAt(h) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const [h0, t0, z0, g0] = SKY[i], [h1, t1, z1, g1] = SKY[i + 1], k = smooth(0, 1, (h - h0) / (h1 - h0));
  return { top: C(t0).lerp(C(t1), k), hor: C(z0).lerp(C(z1), k), ground: C(g0).lerp(C(g1), k) };
}

export class Hangang {
  constructor() {
    this.scene = new THREE.Scene();
    this.ready = false; this.t = 0;
    this.opt = { season: 'auto', weather: 'auto', time: 'auto', flow: 1, cam: 0 };
    this.state = { season: 'spring', weather: 'clear', hour: 12 };
    // 길 위 차량 (hangang-vehicles.js)
    this.traffic = new Traffic(this);
  }
  async load(id = 'yeouido', opt = {}) {
    if (this.ready && this.id === id) return;
    if (id === 'seoul') { // 서울 전체: 2km 칸들을 곰 둘레로 불러오고 내린다
      const res = await fetch(new URL('../seoul/index.json', import.meta.url)); if (!res.ok) throw new Error('서울 지도를 불러오지 못했어요');
      this.world0 = await res.json(); this.tileHave = new Set(this.world0.have.map(([i, j]) => `${i}_${j}`));
      try { await this.loadTerrain(); } catch (e) { console.warn('지형 없이', e); this.terr = null; }
      // 구 경계 · 지역(예전 코스) 자리: 지금 어느 구 · 어느 동네인지, 실시간 도시 정보를 어느 곳으로 물을지
      try { const SJ = await (await fetch(new URL('../hangang/seoul.json', import.meta.url))).json(), U = SJ.unit || 10; this.guList = SJ.gu.map((g) => ({ name: g.name, rings: g.rings.map((r) => { const p = []; for (let i = 0; i < r.length; i += 2) p.push([r[i] * U, r[i + 1] * U]); return p; }) })); this.regionPts = SJ.regions.map((R) => { const pts = []; for (let k = 0; k < R.route.length; k += 2) pts.push([R.route[k], R.route[k + 1]]); return { id: R.id, name: R.name, pts }; }); } catch { this.guList = []; this.regionPts = []; }
      const E = []; this.map = { id: 'seoul', kind: 'world', name: '서울', sub: '', center: [0, 0], scale: 0.1, len: 400, route: [0, 0, 4000, 0], water: [], island: [], green: [], areas: [], roads: [], roadNames: [], alleys: [], bridges: [], rails: [], paths: [], buildings: [], binfo: [], colors: [], names: [], tall: [], stations: E, entrances: E, marks: [], labels: [], arches: [], far: [['남산서울타워', 0, 0, 236, 'tower']].slice(0, 0), shops: [] };
      this.id = id; this.build(); this.ready = true; return;
    }
    const res = await fetch(new URL(`../hangang/${id}.json`, import.meta.url)); if (!res.ok) throw new Error('지도를 불러오지 못했어요');
    this.map = await res.json(); this.id = id;
    if (opt.steps) { const idle = () => new Promise((ok) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => ok(), { timeout: 80 }) : setTimeout(ok, 0))); for (const _ of this.buildGen()) await idle(); } else this.build();
    this.ready = true;
  }
  // ---------- 서울 전체: 칸 불러오기 · 내리기 ----------
  //   칸 = 같은 Hangang 을 '칸 모드'로 지은 것. 부딪힘 · 바닥 · 가게 · 출구 목록은 주인(host)의 것을 함께 써서, 주인의 모든 검사가 그대로 서울 전체에 통한다
  //   드림 러너 서울 맵(seoul-run.js)은 칸의 일부(코스 길 둘레)만 짓는다: key = 'i_j_코스', getMap() = 그 일부만 남긴 지도 (일꾼 스레드가 고른다)
  async loadChunk(key, getMap = null) {
    const [ki, kj] = key.split('_');
    let M; if (getMap) M = await getMap(); else { const res = await fetch(new URL(`../seoul/t_${ki}_${kj}.json`, import.meta.url)); if (!res.ok) throw new Error('칸 없음'); M = await res.json(); }
    const tb0 = performance.now();
    const c = new Hangang(); c.host = this; c.isChunk = true; c.chunkKey = key; c.map = M; c.id = 'seoul'; c.scene = new THREE.Group(); c.state = this.state; c.opt = this.opt;
    for (const k of ['skyU', 'windU', 'waterU', 'grassTex', 'dot', 'waterSets']) c[k] = this[k];
    // 건물 목록은 칸이 만들어지는 동안 따로 (네온 · 몰 문 · LED 같은 것이 다른 칸 건물까지 또 만들지 않게), 다 만들고 합친다
    this.foot ||= []; this.footGrid ||= new Map(); c.foot = []; c.footGrid = new Map(); c.decks = this.decks ||= []; c.deckGrid = this.deckGrid ||= new Map(); c.circGrid = this.circGrid ||= new Map(); c.shopFronts = this.shopFronts ||= []; c.shopGrid = this.shopGrid ||= new Map();
    c.inWater = this.inWater; c.routeSetup();
    const f0 = this.foot.length, d0 = this.decks.length, [i, j] = key.split('_').map(Number);
    const idle = () => new Promise((res) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => res(), { timeout: 60 }) : setTimeout(res, 0)));
    for (const _ of c.buildSteps(rnd(((i * 73856093) ^ (j * 19349663)) >>> 0))) await idle();
    // 몰 문(더현대 · IFC몰)은 칸에서 만들지만 들어가기 검사는 주인이 한다
    for (const D of c.malls || []) { D.key = key; (this.malls ||= []).push(D); }
    for (const f of c.foot) { f.key ??= key; this.addFoot(f); } c.foot = this.foot; c.footGrid = this.footGrid; for (let k = d0; k < this.decks.length; k++) this.decks[k].key = key;
    const tb1 = performance.now(); await idle(); this.maskWater(key); const tw = performance.now(); { let t0 = performance.now(); for (const _ of this.drapeGen(c)) if (performance.now() - t0 > 8) { await idle(); t0 = performance.now(); } } const td = performance.now(); await idle(); const tm = performance.now(); this.mergeChunk(c); const tm2 = performance.now(); await idle(); c.scene.userData.chunk = key; c.buildMs = [Math.round(tb1 - tb0), Math.round(performance.now() - tb1)]; c.stepMs = [Math.round(tw - tb1), Math.round(td - tw), Math.round(tm2 - tm)]; // 만들기 · 지형 얹기+묶기 (ms)
    c.applySeason(); this.cullTrees(c);
    // 셰이더를 미리 만들어 둔다 (처음 보일 때 그리기가 100 ~ 200ms 멈췄다, 8-23). 늦어도 3초 뒤엔 그냥 넣는다
    if (this.onCompile) { try { await Promise.race([this.onCompile(c.scene), new Promise((ok) => setTimeout(ok, 3000))]); } catch { /* 그냥 그린다 */ } }
    this.scene.add(c.scene);
    return c;
  }
  // 새 칸(c)의 찻길 위에 서 있는 다른 칸 나무를 숨기고 부딪힘도 뺀다 (8-24: 칸마다 길 목록이 달라 이웃 칸 찻길 위에 나무가 섰다)
  cullTrees(c) {
    const S = c.map.scale, RG = 30, rg = new Map(); for (const rd of c.map.roads || []) { const w = rd[0], pts = unpack(rd.slice(2), S); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], e = w / 2 + 1; for (let gx = Math.floor((Math.min(a[0], b[0]) - e) / RG); gx <= Math.floor((Math.max(a[0], b[0]) + e) / RG); gx++) for (let gz = Math.floor((Math.min(a[1], b[1]) - e) / RG); gz <= Math.floor((Math.max(a[1], b[1]) + e) / RG); gz++) { const kk = `${gx},${gz}`; if (!rg.has(kk)) rg.set(kk, []); rg.get(kk).push([a, b, w / 2 + 0.6]); } } }
    const onRoad = (x, z) => { for (const [a, b, hw] of rg.get(`${Math.floor(x / RG)},${Math.floor(z / RG)}`) || []) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < hw) return true; } return false; };
    const zero = new THREE.Matrix4().makeScale(0, 0, 0); let n = 0;
    // 지하철 출구 둘레 2m 안 가로수도 치운다 (나무를 출구보다 먼저 심어 서울역 13번처럼 지붕에 나무가 걸쳤다). 이 칸 나무 + 이웃 칸 나무 모두, 출구는 불러온 칸 것 전부
    { const EG = new Map(); for (const e of this.entrances || []) { if (!e.g) continue; const k = `${Math.floor(e.x / 20)},${Math.floor(e.z / 20)}`; if (!EG.has(k)) EG.set(k, []); EG.get(k).push(e); }
      const nearExit = (x, z) => { const gx = Math.floor(x / 20), gz = Math.floor(z / 20); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const e of EG.get(`${gx + a},${gz + b}`) || []) { const th = e.g.rotation.y, dx = x - e.x, dz = z - e.z, lx = dx * Math.cos(th) - dz * Math.sin(th), lz = dx * Math.sin(th) + dz * Math.cos(th); if (Math.abs(lx) < 1.5 + 2.6 && Math.abs(lz) < 2.6 + 2.2) return true; } return false; };
      if (EG.size) for (const o of new Set([...this.chunks.values(), c])) { for (const G of o.treeGroups || []) { if (G.arr === 'f') continue; let hit = false; const A = o.trees || []; G.idx.forEach((si, q) => { const p = A[si]; if (!p || p.cut || !nearExit(p[0], p[1])) return; for (const m of G.ms) m?.setMatrixAt(q, zero); p.cut = true; hit = true; n++; const l = this.circGrid?.get(`${Math.floor(p[0] / 20)},${Math.floor(p[1] / 20)}`); if (l) { const i = l.findIndex((q2) => q2.x === p[0] && q2.z === p[1]); if (i >= 0) l.splice(i, 1); } }); if (hit) for (const m of G.ms) if (m) m.instanceMatrix.needsUpdate = true; } } }
    for (const o of this.chunks.values()) { if (o === c || !o.treeGroups) continue; for (const G of o.treeGroups) { let hit = false; const A = G.arr === 'f' ? o.forestFill || [] : o.trees || []; G.idx.forEach((si, q) => { const p = A[si]; if (!p || !rg.has(`${Math.floor(p[0] / RG)},${Math.floor(p[1] / RG)}`) || !onRoad(p[0], p[1])) return; for (const m of G.ms) m?.setMatrixAt(q, zero); p.cut = true; hit = true; n++; const l = this.circGrid?.get(`${Math.floor(p[0] / 20)},${Math.floor(p[1] / 20)}`); if (l) { const i = l.findIndex((q2) => q2.x === p[0] && q2.z === p[1]); if (i >= 0) l.splice(i, 1); } }); if (hit) for (const m of G.ms) if (m) m.instanceMatrix.needsUpdate = true; } }
    return n;
  }
  unloadChunk(key) {
    const c = this.chunks.get(key); if (!c) return; this.chunks.delete(key); this.scene.remove(c.scene);
    c.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { m.map?.dispose?.(); m.dispose?.(); } });
    const keep = (a) => a.filter((x) => x.key !== key);
    this.foot = keep(this.foot); this.footGrid.clear(); this.foot.forEach((f, fi) => { for (let gx = Math.floor(f.x0 / 40); gx <= Math.floor(f.x1 / 40); gx++) for (let gz = Math.floor(f.z0 / 40); gz <= Math.floor(f.z1 / 40); gz++) { const k = `${gx},${gz}`; if (!this.footGrid.has(k)) this.footGrid.set(k, []); this.footGrid.get(k).push(fi); } });
    this.decks = keep(this.decks); this.deckGrid.clear(); this.decks.forEach((sg, si) => { for (let gx = Math.floor((Math.min(sg.ax, sg.cx) - sg.hw) / 40); gx <= Math.floor((Math.max(sg.ax, sg.cx) + sg.hw) / 40); gx++) for (let gz = Math.floor((Math.min(sg.az, sg.cz) - sg.hw) / 40); gz <= Math.floor((Math.max(sg.az, sg.cz) + sg.hw) / 40); gz++) { const k = `${gx},${gz}`; if (!this.deckGrid.has(k)) this.deckGrid.set(k, []); this.deckGrid.get(k).push(si); } });
    for (const [k, list] of this.circGrid) { const l2 = list.filter((q) => q.key !== key); if (l2.length) this.circGrid.set(k, l2); else this.circGrid.delete(k); }
    this.malls = keep(this.malls || []); this.shopFronts = keep(this.shopFronts); this.shopGrid.clear(); this.shopFronts.forEach((F, i) => { const k = `${Math.floor(F.x / 40)},${Math.floor(F.z / 40)}`; if (!this.shopGrid.has(k)) this.shopGrid.set(k, []); this.shopGrid.get(k).push(i); });
    this.entrances = keep(this.entrances || []); const ws = keep(this.waterSets); this.waterSets.length = 0; this.waterSets.push(...ws);
    for (const c2 of this.chunks.values()) { c2.foot = this.foot; c2.decks = this.decks; c2.shopFronts = this.shopFronts; }
    this.cityDirty = true;
  }
  // 곰이 있는 칸 둘레 3 × 3 을 불러오고(가까운 것부터 하나씩), 5 × 5 밖은 내린다
  tickWorld(px, pz) {
    if (this.map.kind !== 'world') return;
    // 역 · 가게 · 몰 · 열차 안은 먼 좌표에 있다: 그동안 서울 칸을 내리거나 엉뚱한 칸을 부르지 않는다 (나오면 빈 땅이었다)
    if (this.inside || this.inShop || this.inMall || this.ride) return;
    const T = this.world0.tile, ti = Math.floor(px / T), tj = Math.floor(pz / T); this.tileNow = [ti, tj];
    if (this.farU) { const U = this.farU; U.uC.value.set(ti, tj); for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) U.uL.value[(b + 2) * 5 + a + 2] = this.chunks.has(`${ti + a}_${tj + b}`) ? 1 : 0; }
    // 먼 나무 칸은 그리지 않는다 (1.1km 넘게, 날 때는 높이만큼 더 멀리까지). 0.4초마다
    if ((this.treeLodN = (this.treeLodN || 0) + 1) % 12 === 1) { const R = 1100 + Math.min(900, (this.y || 0) * 3); for (const c of this.chunks.values()) c.scene.traverse((o) => { const L = o.userData.lod; if (L) o.count = Math.hypot(L[0] - px, L[1] - pz) < (L[3] ? L[3] + Math.min(900, (this.y || 0) * 3) : R + 360) ? L[2] : 0; const V = o.userData.lodV; if (V) o.visible = Math.hypot(V[0] - px, V[1] - pz) < V[2] + Math.min(600, (this.y || 0) * 2); }); }
    // 칸을 쉬어 가며 만드는 중에는 내리지 않는다 (같이 쓰는 목록을 내리기가 새로 만들어 버리면 만드는 칸이 옛 목록에 쓴다)
    if (this.chunkLoading) return;
    // 내리기도 한 프레임에 칸 하나만 (셋을 한꺼번에 내리면 목록 다시 만들기로 50ms 넘게 멈췄다)
    for (const key of this.chunks.keys()) { const [i, j] = key.split('_').map(Number); if (Math.max(Math.abs(i - ti), Math.abs(j - tj)) > 2) { this.unloadChunk(key); return; } }
    const want = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const key = `${ti + a}_${tj + b}`; if (this.tileHave.has(key) && !this.chunks.has(key) && !this.chunkFail?.has(key)) want.push([Math.hypot((ti + a + 0.5) * T - px, (tj + b + 0.5) * T - pz), key]); }
    if (!want.length) return; want.sort((a, b) => a[0] - b[0]); const key = want[0][1];
    this.chunkLoading = key; this.loadChunk(key).then((c) => { if (this.map.kind === 'world') { this.chunks.set(key, c); this.cityDirty = true; this.onChunk?.(key, this.chunks.size); } }).catch(() => { (this.chunkFail ||= new Set()).add(key); }).finally(() => { this.chunkLoading = null; });
  }
  // 서울 전체: 그 자리의 구 이름 · 가장 가까운 지역(예전 코스)
  guAt(x, z) { for (const g of this.guList || []) if (g.rings.some((r) => inRing(x, z, r))) return g.name; return ''; }
  nearRegion(x, z) { let best = null, bd = Infinity; for (const R of this.regionPts || []) for (const [a, b] of R.pts) { const d = (a - x) ** 2 + (b - z) ** 2; if (d < bd) { bd = d; best = R; } } return best ? { id: best.id, name: best.name, d: Math.sqrt(bd) } : null; }
  // ---------- 지형 (서울 전체 높이 격자, 50m) ----------
  async loadTerrain() {
    const [jr, br] = await Promise.all([fetch(new URL('../seoul/terrain.json', import.meta.url)), fetch(new URL('../seoul/terrain.bin.gz', import.meta.url))]);
    if (!jr.ok || !br.ok) throw new Error('지형 파일 없음');
    const H = await jr.json(), buf = await new Response(br.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(), dl = new Int16Array(buf), { nx, nz } = H, h = new Float32Array(nx * nz);
    // 줄마다 앞 칸과의 차이로 저장 (첫 칸은 윗줄 첫 칸과의 차이)
    let prev = 0; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; prev = (i ? prev : j ? h[k - nx] * 10 : 0) + dl[k]; h[k] = prev / 10; }
    this.terr = { ...H, h, h0: h.slice() };
  }
  // 그 자리 땅 높이(m, 한강 물 높이 = 0). 가게 · 역 · 몰 안에서는 0 (안쪽 장면은 멀리 따로 있다). 전망대는 제자리라 그대로
  // raw = 'orig': 물을 파 내리기 전 원래 지형
  terrAt(x, z, raw = false) {
    const T = this.terr || this.host?.terr; if (!T) return 0;
    if (!raw && (this.inside || this.inShop || this.inMall)) return 0;
    // 격자 밖(서울 바깥 · 가게 안 장면이 있는 먼 곳)은 0
    let fx = (x - T.x0) / T.step, fz = (z - T.z0) / T.step; if (fx < 0 || fz < 0 || fx > T.nx - 1 || fz > T.nz - 1) return 0; fx = Math.min(fx, T.nx - 1.001); fz = Math.min(fz, T.nz - 1.001); const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * T.nx + i, h = raw === 'orig' ? T.h0 || T.h : T.h;
    return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + T.nx] * (1 - u) + h[k + T.nx + 1] * u) * v;
  }
  // 칸 안 격자점 중 물 위인 곳은 높이 0 (지형 자료는 상류 강물이 기준보다 높게 나온다)
  maskWater(key) {
    const T = this.terr; if (!T) return; const [ti, tj] = key.split('_').map(Number), S = this.world0.tile;
    const i0 = Math.max(0, Math.floor((ti * S - T.x0) / T.step)), i1 = Math.min(T.nx - 1, Math.ceil(((ti + 1) * S - T.x0) / T.step)), j0 = Math.max(0, Math.floor((tj * S - T.z0) / T.step)), j1 = Math.min(T.nz - 1, Math.ceil(((tj + 1) * S - T.z0) / T.step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (T.h[j * T.nx + i] > 0 && this.inRiver(T.x0 + i * T.step, T.z0 + j * T.step)) T.h[j * T.nx + i] = 0;
  }
  // 호수 · 하천(석촌호수 · 청계천 · 중랑천 …): 물이 한강 높이(0)가 아니라 그 자리 물가 높이에 있다.
  //   예전엔 0 으로 파 내려가서, 50m 격자 사이로 둘레 땅이 물을 덮어 호수가 잔디 · 맨땅으로 보였다.
  //   물 안 격자점은 물 높이로, 물가 한 칸 안쪽 땅은 물보다 조금 높게 낮춘다 (호안 둑). 물 면은 이 땅 위에 얹는다
  lowerLakes(lakes, islands) {
    const T = this.terr; if (!T || !lakes.length) return; const st = T.step, near = st * 1.05; let mx0 = Infinity, mx1 = -Infinity, mz0 = Infinity, mz1 = -Infinity;
    const segD = (x, z, r) => { let b = Infinity; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ax, az] = r[j], [bx, bz] = r[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), ex = ax + dx * t - x, ez = az + dz * t - z; b = Math.min(b, ex * ex + ez * ez); } return Math.sqrt(b); };
    for (const L of lakes) {
      const { poly, rim } = L; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of poly[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      // 그 자리 물 높이 = 150m 안 물가 높이의 아래쪽 20% (한 점의 움푹 팬 값에 끌리지 않게) - 0.6m.
      //   둥근 호수는 물 면이 평평하게 둘레 전체로 한 높이, 길쭉한 하천은 흘러 내려가니 자리마다
      let P = 0; for (let i = 0; i < poly[0].length; i++) { const a = poly[0][i], c = poly[0][(i + 1) % poly[0].length]; P += Math.hypot(c[0] - a[0], c[1] - a[1]); }
      const round = (4 * Math.PI * L.area) / (P * P || 1) > 0.2, all = rim.map((r) => r[2]).sort((a, b) => a - b); let flat = Math.max(0, all[Math.floor(all.length * 0.2)] - 0.6);
      // 칸 경계에 걸친 호수(석촌호수 동호 끝)는 먼저 불러온 옆 칸 조각과 같은 높이로 (경계에서 물 면이 층지지 않게)
      if (round) { const recs = (this.lakeRecs ||= []), hit = recs.find((q) => q.b[0] < x1 + 3 && q.b[1] > x0 - 3 && q.b[2] < z1 + 3 && q.b[3] > z0 - 3); if (hit) flat = hit.lv; else recs.push({ b: [x0, x1, z0, z1], lv: flat }); }
      const level = (x, z) => { if (round) return flat; const hs = []; for (const r of rim) if (Math.abs(r[0] - x) < 150 && Math.abs(r[1] - z) < 150) hs.push(r[2]); const src = hs.length >= 3 ? hs : rim.map((r) => r[2]); src.sort((a, b) => a - b); return Math.max(0, src[Math.floor(src.length * 0.2)] - 0.6); };
      const i0 = Math.max(0, Math.floor((x0 - near - T.x0) / st)), i1 = Math.min(T.nx - 1, Math.ceil((x1 + near - T.x0) / st)), j0 = Math.max(0, Math.floor((z0 - near - T.z0) / st)), j1 = Math.min(T.nz - 1, Math.ceil((z1 + near - T.z0) / st));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = T.x0 + i * st, z = T.z0 + j * st, k = j * T.nx + i, wet = inPoly(x, z, poly) && !islands.some((w) => inPoly(x, z, w));
        if (!wet && Math.min(...poly.map((r) => segD(x, z, r))) > near) continue;
        const lv = level(x, z); T.h[k] = wet ? lv : Math.min(Math.max(T.h[k], lv + 0.4), lv + 1.2); mx0 = Math.min(mx0, x); mx1 = Math.max(mx1, x); mz0 = Math.min(mz0, z); mz1 = Math.max(mz1, z);
      }
    }
    // 이미 지어 둔 옆 칸 땅이 바뀐 격자점을 쓰면 다시 얹는다 (경계에 틈이 생기지 않게)
    const S = this.world0?.tile; if (!S || !this.chunks || mx0 > mx1) return;
    for (const [key, c] of this.chunks) { const [ti, tj] = key.split('_').map(Number); if (ti * S > mx1 || (ti + 1) * S < mx0 || tj * S > mz1 || (tj + 1) * S < mz0) continue;
      c.scene.traverse((o) => { if (o.material !== this.terrLandM) return; const p = o.geometry.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, this.terrAt(p.getX(k), p.getZ(k), true) - 0.05); p.needsUpdate = true; o.geometry.computeVertexNormals(); }); }
  }
  // 칸 하나를 지형 위에 얹는다: 넓은 것(땅 · 길 · 묶은 건물)은 꼭짓점마다, 작은 것(간판 · 출구)은 통째로, 나무 같은 인스턴스는 하나씩
  drape(c) { for (const _ of this.drapeGen(c)); }
  // 쉬어 가며 얹기: 덩어리 하나 얹을 때마다 멈출 수 있게 (칸을 다 만든 순간 화면이 0.1 ~ 0.3초 멈췄다)
  *drapeGen(c) {
    if (!this.terr) return; const H = (x, z) => this.terrAt(x, z, true), m4 = new THREE.Matrix4(), m4i = new THREE.Matrix4(), v = new THREE.Vector3(), done = (this.draped ||= new WeakSet());
    const flatLike = (o) => { const ms = Array.isArray(o.material) ? o.material : [o.material]; return ms.some((m) => m?.userData?.order !== undefined); };
    const vertices = (o) => {
      o.updateWorldMatrix(true, false); let g = o.geometry; if (done.has(g)) g = o.geometry = g.clone(); done.add(g);
      // 평평한 바닥 층은 큰 삼각형을 잘게 나눠야 언덕을 따라간다
      const wet = o.userData.drapeWater ? 0.1 : 0;
      if ((flatLike(o) || wet) && (o.isMesh || o.isLineSegments) && !g.groups.length) g = o.geometry = subdivide(g.applyMatrix4(o.matrixWorld), o.isMesh ? 3 : 2, 24); else g.applyMatrix4(o.matrixWorld);
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); o.updateMatrixWorld(true);
      const p = g.attributes.position, BY = g.userData.baseY?.length === p.count ? g.userData.baseY : null; for (let k = 0; k < p.count; k++) { const b = BY ? BY[k] : NaN; p.setY(k, p.getY(k) + wet + (b === b ? b : H(p.getX(k), p.getZ(k)))); } p.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox();
    };
    const lift = (o) => { const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return; b.getCenter(v); o.position.y += H(v.x, v.z); o.updateMatrixWorld(true); };
    const inst = (o) => { o.updateWorldMatrix(true, false); m4i.copy(o.matrixWorld).invert(); const a = new THREE.Matrix4(); for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, a); m4.multiplyMatrices(o.matrixWorld, a); v.setFromMatrixPosition(m4); const by = o.userData.baseY?.[k], dy = by === by && by !== undefined ? by : H(v.x, v.z); m4.elements[13] += dy; a.multiplyMatrices(m4i, m4); o.setMatrixAt(k, a); } o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere?.(); };
    const visit = (o) => {
      // based = 이미 그 건물 바닥 높이에 올려 둔 것 (묶기는 그대로)
      if (o.userData.noDrape || o.userData.based) return;
      if (o.isInstancedMesh) return inst(o);
      // 한강 물은 0 높이 그대로, 호수 · 하천 물은 물가 땅(lowerLakes)에 얹는다
      if (o.material === this.waterM) return o.userData.drapeWater ? vertices(o) : undefined;
      const b = new THREE.Box3().setFromObject(o), size = b.isEmpty() ? 0 : Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      if (size < 40 && !flatLike(o) && !o.geometry?.userData.baseY) return lift(o);
      if (o.isMesh || o.isLine || o.isPoints) return vertices(o);
      for (const ch of [...o.children]) visit(ch);
    };
    c.scene.updateMatrixWorld(true); for (const o of [...c.scene.children]) { visit(o); yield; }
    // 땅: 칸마다 지형 격자 그대로 (바탕 도시 땅은 높이 0 이라 언덕 아래로 숨는다)
    const S = this.world0.tile, [ti, tj] = c.chunkKey.split('_').map(Number), n = Math.round(S / this.terr.step), g = new THREE.PlaneGeometry(S, S, n, n); g.rotateX(-Math.PI / 2); g.translate((ti + 0.5) * S, 0, (tj + 0.5) * S);
    { const p = g.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, H(p.getX(k), p.getZ(k)) - 0.05); g.computeVertexNormals(); }
    if (!this.terrLandM) { const tx = groundTex('city'); tx.repeat.set(S / 9, S / 9); this.terrLandM = new THREE.MeshLambertMaterial({ color: '#a3a39f', map: tx }); }
    const land = new THREE.Mesh(g, this.terrLandM); land.receiveShadow = true; land.renderOrder = -61; land.userData.noDrape = true; c.scene.add(land);
    // 바닥 층은 깊이를 보도록 (언덕 뒤의 길이 앞 언덕 위에 그려지지 않게), 땅보다 살짝 앞으로
    c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (m.userData?.order !== undefined && !m.depthTest) { m.depthTest = true; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; m.needsUpdate = true; } });
  }
  // 칸 하나의 움직이지 않는 물체를 재질마다 하나로 묶는다 (칸마다 수백 번 → 수십 번 그리기). 곰 · 케이블카 · 멀면 숨기는 것 · 선 · 점은 그대로
  mergeChunk(c) {
    const skip = new Set(this.lodObjs || []), groups = new Map();
    const walk = (o) => {
      if (o.userData.npc || o.userData.noDrape || o.userData.noMerge || o.isPoints || o.isLine || o.isSprite) return;
      if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && !skip.has(o) && o.visible && o.geometry?.attributes.position && o.geometry.attributes.normal && !Object.keys(o.geometry.morphAttributes).length) {
        const g = o.geometry, key = `${o.material.uuid}|${o.renderOrder}|${o.castShadow}|${o.receiveShadow}|${Object.keys(g.attributes).sort().join(',')}`;
        if (!groups.has(key)) groups.set(key, { m: o.material, ro: o.renderOrder, cs: o.castShadow, rs: o.receiveShadow, list: [] }); groups.get(key).list.push(o);
      }
      for (const ch of [...o.children]) walk(ch);
    };
    c.scene.updateMatrixWorld(true); for (const o of [...c.scene.children]) walk(o);
    let n0 = 0, n1 = 0;
    for (const G of groups.values()) {
      n0 += G.list.length; if (G.list.length < 2) { n1 += G.list.length; continue; }
      const geos = G.list.map((o) => { const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.groups = []; return g.applyMatrix4(o.matrixWorld); });
      const mg = mergeGeometries(geos, false); geos.forEach((g) => g.dispose()); if (!mg) { n1 += G.list.length; continue; }
      mg.computeBoundingSphere(); const me = new THREE.Mesh(mg, G.m); me.renderOrder = G.ro; me.castShadow = G.cs; me.receiveShadow = G.rs; c.scene.add(me); n1++;
      for (const o of G.list) o.parent?.remove(o);
    }
    c.mergeInfo = [n0, n1];
  }
  // 움직이는 것(사람 · 차 · 버스 …)을 땅 높이에 맞춘다: 매 프레임, 지난번에 더한 만큼 빼고 다시 더한다
  liftMovers() {
    if (!this.terr) return; const fixed = this.fixedObjs;
    for (const o of this.scene.children) { if (fixed?.has(o) || o.userData.chunk || o.userData.noDrape || o === this.bear?.root || o === this.shadow || Math.abs(o.position.x) > 60000) continue; const u = o.userData, t = this.terrAt(o.position.x, o.position.z);
      // 지난번에 둔 높이에서 누가 바꿨으면(매 프레임 새로 놓는 것) 그게 새 바탕, 아니면 예전 바탕 그대로
      if (u.ly === undefined || Math.abs(o.position.y - u.ly) > 1e-6) u.by = o.position.y; o.position.y = u.by + t; u.ly = o.position.y; }
  }
  addShopFronts(list) { const H = this.host || this; H.shopFronts ||= []; H.shopGrid ||= new Map(); for (const F of list) { F.key = this.chunkKey; const i = H.shopFronts.push(F) - 1, k = `${Math.floor(F.x / 40)},${Math.floor(F.z / 40)}`; if (!H.shopGrid.has(k)) H.shopGrid.set(k, []); H.shopGrid.get(k).push(i); } }
  // ---------- 코스 (실제 자전거길) ----------
  routeSetup() {
    const S = this.map.scale, pts = unpack(this.map.route, S), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // 부드럽게: 2m 간격으로 다시 찍고 살짝 다듬는다
    const L = cum[cum.length - 1], N = Math.ceil(L / 2), rs = [];
    for (let k = 0, i = 0; k <= N; k++) { const s = (k / N) * L; while (i < cum.length - 2 && cum[i + 1] < s) i++; const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1); rs.push([lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]); }
    for (let pass = 0; pass < 6; pass++) for (let i = 1; i < rs.length - 1; i++) { rs[i] = [(rs[i - 1][0] + rs[i][0] * 2 + rs[i + 1][0]) / 4, (rs[i - 1][1] + rs[i][1] * 2 + rs[i + 1][1]) / 4]; }
    this.rp = rs; this.L = L; this.step = L / N;
  }
  // 코스 위 s 지점: 위치 · 진행 방향 · 오른쪽
  at(s) {
    const f = clamp(s / this.step, 0, this.rp.length - 1.001), i = Math.floor(f), t = f - i, a = this.rp[i], b = this.rp[i + 1];
    const a0 = this.rp[Math.max(0, i - 2)], b0 = this.rp[Math.min(this.rp.length - 1, i + 3)];
    let dx = b0[0] - a0[0], dz = b0[1] - a0[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), dx, dz, rx: -dz, rz: dx };
  }
  world(s, lat) { const p = this.at(s); return [p.x + p.rx * lat, p.z + p.rz * lat]; }
  // 걸어갈 수 있는 곳: 물이 아니고, 코스 둘레 45m 안이거나 공원 · 녹지 · 섬 안 (5m 칸마다 기억)
  walkable(x, z, lat) {
    if (this.map.kind === 'world') return !this.inWater(x, z) || !!this.attrWalk?.(x, z);
    if (this.walkLimit && Math.hypot(x - this.walkLimit.x, z - this.walkLimit.z) > this.walkLimit.r) return false; // 남산 정상: 광장 밖(비탈)으로는 못 간다
    if (Math.abs(lat + 2) < 7.5) return true; // 코스(자전거길 · 트랙)는 물 위도 다리로 건넌다
    return !this.inWater(x, z); // 이제 서울을 걸어 다니는 게임: 물이 아니면 어디든 (도시 골목까지)
    const key = `${Math.round(x / 5)},${Math.round(z / 5)}`; this.walkCache ||= new Map();
    let v = this.walkCache.get(key);
    if (v === undefined) { v = this.greenPolys.some((g) => inPoly(x, z, g)) || (this.map.areas || []).some(([n, ...f]) => /한강공원|공원|섬/.test(n) && inRing(x, z, unpack(f, this.map.scale))); this.walkCache.set(key, v); if (this.walkCache.size > 60000) this.walkCache.clear(); }
    return v;
  }
  // 서 있는 바닥 높이: 건물 옥상 위(그 높이 이상에 있으면) 또는 땅
  // 그 자리 다리 바닥 높이 (발밑 기준 1m 안쪽이면 올라선다 · 훨씬 아래면 다리 밑을 지나간다). 없으면 -1
  deckAt(x, z, y) {
    let g = -1; for (const si of this.deckGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || []) { const d = this.decks[si], ex = d.cx - d.ax, ez = d.cz - d.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - d.ax) * ex + (z - d.az) * ez) / L2, 0, 1); if (Math.hypot(x - d.ax - ex * t, z - d.az - ez * t) > d.hw) continue; const dy = d.ya + (d.yc - d.ya) * t; if (y >= dy - 1.0 && dy > g) g = dy; }
    return g;
  }
  // 부딪히는 외곽선 하나 더 (역 안 벽 · 출구 벽 등)
  addFoot(f) { const fi = (this.foot ||= []).push(f) - 1; this.footGrid ||= new Map(); for (let gx = Math.floor(f.x0 / 40); gx <= Math.floor(f.x1 / 40); gx++) for (let gz = Math.floor(f.z0 / 40); gz <= Math.floor(f.z1 / 40); gz++) { const k = `${gx},${gz}`; if (!this.footGrid.has(k)) this.footGrid.set(k, []); this.footGrid.get(k).push(fi); } }
  // ---------- 지하철역 안 ----------
  //   출구 계단으로 내려가면 그 역 대합실로. 대합실 동쪽 계단 → 승강장, 서쪽 번호 계단 → 그 번호 출구로 나간다
  enterStation(e) {
    this.onFade?.(); // 출구 계단 ↔ 대합실: 잠깐 어두워졌다 밝아진다 (계단을 내려간 느낌)
    const si = this.stations.indexOf(e.st); this.stationInt ||= {};
    const S = this.stationInt[si] ||= buildStation(this, e.st, si, this.entrances.filter((q) => q.st === e.st).map((q) => String(q.ref || '1')));
    this.inside = { S, st: e.st, from: e }; this.hidden = [];
    for (const o of this.scene.children) if (o !== S.g && o !== this.bear?.root && o !== this.shadow && o.visible) { this.hidden.push(o); o.visible = false; }
    S.g.visible = true; const sp = S.spawnFromExit(String(e.ref || '1')); this.placeAt(sp.x, sp.z, sp.face); this.y = sp.y || 0; this.onInside?.({ name: e.st.name, lines: e.st.lines });
  }
  leaveStation(ref) {
    const I = this.inside; if (!I) return; this.onFade?.(); I.S.g.visible = false; for (const o of this.hidden || []) o.visible = true; this.hidden = null; this.inside = null;
    // 열차를 타고 온 역(I.from 없음)에서 나갈 때도: 그 역의 아무 출구 → 같은 이름 역의 출구 → 역 자리
    const e = this.entrances.find((q) => q.st === I.st && String(q.ref) === String(ref)) || I.from || this.entrances.find((q) => q.st === I.st) || this.entrances.find((q) => q.st?.name === I.st?.name);
    if (!e) { if (I.st) this.placeAt(I.st.x, I.st.z, 0); this.stationCool = 2; this.onInside?.(null); return; }
    const th = e.g.rotation.y;
    this.placeAt(e.x - Math.sin(th) * 3.6, e.z - Math.cos(th) * 3.6, th + Math.PI); this.stationCool = 2; this.onInside?.(null);
  }
  // 한강을 나갈 때: 가게 · 역 · 열차 안이면 바깥으로 되돌려 놓는다 (다음에 들어왔을 때 바깥이 숨겨져 있지 않게)
  exitInterior() { if (this.attr?.exp) this.attr.finish(this.attr.exp, true); if (this.inShop) this.leaveShop(); if (this.inMall) this.leaveMall(); if (this.ride) { this.ride.C.g.visible = false; this.ride = null; } if (this.inside) this.leaveStation(this.inside.from?.ref); }
  // 지금 있는 실내의 바닥 상자 [x0, x1, z0, z1] (곰이 서 있는 칸)
  interiorBox() {
    const px = this.px, pz = this.pz, box = (cx, cz, hw, hd) => [cx - hw, cx + hw, cz - hd, cz + hd], inBox = (b) => px >= b[0] - 1 && px <= b[1] + 1 && pz >= b[2] - 1 && pz <= b[3] + 1;
    if (this.ride) { const O = this.ride.C.g.position; return box(O.x, O.z, 19.5 / 2, 1.5); }
    if (this.inShop) { const O = this.inShop.I.O; return box(O.x, O.z, 7, 5.5); }
    if (this.inMall) { const I = this.inMall.I, O = I.O; if (I.box) return I.box; return box(O.x, O.z, 35, 20); }
    if (this.inside) { const S = this.inside.S, O = S.O, list = [box(O.x, O.z, S.CW / 2, S.CD / 2), ...S.plats.map((p) => box(O.x, p.pz, p.PL / 2, 5 + 5.2))]; return list.find(inBox) || list[0]; }
    return null;
  }
  placeAt(x, z, face) { this.px = x; this.pz = z; this.y = 0; this.vy = 0; this.climb = null; this.flying = false; this.face = face; this.camYaw = face; this.camInit = false; this.mdx = null; this.onRoof = null; this.spawnFix = 8; this.spawnAt = [x, z]; }
  // 순간이동 · 처음 시작한 자리가 건물 · 벽 · 나무 속이면 가까운 빈 땅으로 옮긴다
  // 건물은 칸을 불러온 뒤에야 생기므로 몇 초 동안 매 프레임 살핀다
  inFootAt(x, z) {
    for (const fi of this.footGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || []) {
      const f = this.foot[fi]; if (f.deck || f.deckWall || (f.mh && f.mh > 2.5) || x < f.x0 - 0.4 || x > f.x1 + 0.4 || z < f.z0 - 0.4 || z > f.z1 + 0.4) continue;
      const fh = f.base === undefined ? f.h : f.h + f.base - this.terrAt(x, z); if (fh < 1.2) continue;
      if (inRing(x, z, f.ring)) return true;
      const q = this.pushOut(x, z, 0, 0.4); if (q.hit && Math.hypot(q.x - x, q.z - z) > 0.05) return true;
    }
    for (const c of this.circlesNear(x, z)) if (!c.mh && Math.hypot(x - c.x, z - c.z) < c.r + 0.4) return true;
    return false;
  }
  // out: 건물에서 밖으로 나온 방향. 카메라(곰 뒤 4m)가 건물 속에 들지 않는 쪽으로 벽을 따라 본다
  faceAlong(out) {
    const ok = (f) => !this.inFootAt(this.px - Math.sin(f) * 4, this.pz - Math.cos(f) * 4);
    const f = [out + Math.PI / 2, out - Math.PI / 2, out].find(ok); this.face = this.camYaw = f ?? out; this.camInit = false;
  }
  fixSpawn(dt) {
    // 서울 칸 지도: 곰이 선 칸을 다 불러오기 전에는 시간을 세지 않는다
    const T0 = this.world0?.tile; if (this.chunks && T0 && !this.chunks.has(`${Math.floor(this.px / T0)}_${Math.floor(this.pz / T0)}`)) return;
    this.spawnFix -= dt;
    if (this.inside || this.inShop || this.inMall || this.ride || this.attr?.exp || this.flying || this.climb || this.y > 3 || !this.footGrid) return;
    // 벽 밀어내기가 이미 밖으로 꺼냈으면, 벽을 마주 보지 않게 벽을 따라 보게 한다
    if (!this.inFootAt(this.px, this.pz)) { const S0 = this.spawnAt; if (S0 && Math.hypot(this.px - S0[0], this.pz - S0[1]) > 0.5) { this.spawnAt = null; this.faceAlong(Math.atan2(this.px - S0[0], this.pz - S0[1])); } return; }
    for (let r = 1.5; r <= 80; r += 1.5) {
      const n = Math.max(8, Math.round(r * 2));
      for (let i = 0; i < n; i++) { const a = this.face + (i / n) * Math.PI * 2, x = this.px + Math.sin(a) * r, z = this.pz + Math.cos(a) * r;
        if (this.terr && (x < this.terr.x0 + 50 || z < this.terr.z0 + 50)) continue;
        if (!this.inFootAt(x, z) && this.groundAt(x, z, 0) < 0.5) { this.spawnAt = null; this.px = x; this.pz = z; this.faceAlong(a); this.y = 0; this.vy = 0; this.camInit = false; this.spawnFix = 0; return; } }
    }
  }
  // 열차 타기: 열린 문 앞에 서면 탄다 → 열차 안에서 잠깐 달리고 → 다음 역 승강장에 내린다 (그 역이 지도 밖이면 같은 역 반대편으로)
  startRide(p, T) {
    const I = this.inside, line = p.l, destName = T.sd < 0 ? p.prev : p.next, dest = this.stations.find((q) => q.name === destName && this.entrances.some((e) => e.st === q));
    this.rideCars ||= {}; const key = String(line), C = this.rideCars[key] ||= buildCar(this, line, Object.keys(this.rideCars).length);
    I.S.g.visible = false; C.g.visible = true; C.setText(dest ? dest.name : '', `${line}${String(line).length === 1 ? '호선' : '선'} ${T.to}행`);
    this.ride = { C, t: 13, line, dest: dest || I.st }; this.placeAt(C.spawn.x, C.spawn.z, C.spawn.face);
  }
  tickRide(dt) {
    const R2 = this.ride, k = R2.t > 10 ? (13 - R2.t) / 3 : R2.t < 3 ? R2.t / 3 : 1; R2.C.tick(dt, 0.15 + k * 1.6); R2.t -= dt;
    // 흔들림: 달리는 동안 카메라가 아주 살짝
    if (R2.t > 0) return;
    R2.C.g.visible = false; this.ride = null;
    const st = R2.dest, e = this.entrances.find((q) => q.st === st), si = this.stations.indexOf(st);
    const S = this.stationInt[si] ||= buildStation(this, st, si, this.entrances.filter((q) => q.st === st).map((q) => String(q.ref || '1')));
    this.inside = { S, st, from: e }; S.g.visible = true; const li = Math.max(0, st.lines.indexOf(R2.line)), sp = S.spawnPlatform(li); this.placeAt(sp.x, sp.z, sp.face); this.zoneCool = 1.5; this.onInside?.({ name: st.name, lines: st.lines });
  }
  tickInside(dt) {
    if (this.ride) return this.tickRide(dt);
    const I = this.inside, S = I.S; S.tick(dt, this.arrivals, this.arrivalsAt);
    // 벽 속에 끼었으면(밀어내는 거리가 크면) 대합실 바닥으로 꺼내 준다
    { const q = this.pushOut(this.px, this.pz, this.y, 0.3); if (q && Math.hypot(q.x - this.px, q.z - this.pz) > 0.8) { const sp = S.spawnFromExit(String(I.from?.ref || '1')); this.placeAt(sp.x, sp.z, sp.face); this.y = sp.y || 0; } }
    // 실제 열차가 돌면(S.live) 승강장 열차는 E 로 탄다 (hangang-ride.js). 예전 짧은 열차 타기는 실시간이 없을 때만
    { const dtn = S.live ? null : S.doorTrain(this.px, this.pz); if (dtn && !(this.zoneCool > 0)) return this.startRide(dtn.p, dtn.T); }
    const z = S.zoneAt(this.px, this.pz, this.y); if (!z || (this.zoneCool || 0) > 0) { this.zoneCool = Math.max(0, (this.zoneCool || 0) - dt); return; }
    this.zoneCool = 1.2;
    if (z.kind === 'exit') this.leaveStation(z.ref);
    else if (z.kind === 'down') { const sp = S.spawnPlatform(z.li); this.placeAt(sp.x, sp.z, sp.face); }
    else if (z.kind === 'up') { const sp = S.spawnConcourse(z.li); this.placeAt(sp.x, sp.z, sp.face); }
  }
  // ---------- 가게 안 ----------
  //   가게 문 앞(벽 쪽으로)으로 걸어가면 들어간다. 계산대 앞에 서면 메뉴 (onShop) → shopOrder(번호, 'here' | 'togo')
  hideOutdoor(keep) { this.hidden = []; for (const o of this.scene.children) if (o !== keep && o !== this.bear?.root && o !== this.shadow && o.visible) { this.hidden.push(o); o.visible = false; } }
  showOutdoor() { for (const o of this.hidden || []) o.visible = true; this.hidden = null; }
  enterMall(D2) { this.mallInt ||= {}; const I = this.mallInt[D2.name] ||= D2.build ? D2.build(this, makeBear) : buildMall(this, D2.name, Object.keys(this.mallInt).length, makeBear); this.hideOutdoor(I.g); I.g.visible = true; this.inMall = { D: D2, I }; this.placeAt(I.spawn.x, I.spawn.z, I.spawn.face); this.onShopEnter?.({ name: D2.name }); }
  leaveMall() { const M2 = this.inMall; if (!M2) return; M2.I.g.visible = false; this.showOutdoor(); this.inMall = null; const D2 = M2.D; this.placeAt(D2.x + D2.nx * 3, D2.z + D2.nz * 3, Math.atan2(D2.nx, D2.nz)); this.shopCool = 2; }
  tickMall(dt) { const I = this.inMall.I; I.tick(dt); if ((this.shopCool || 0) > 0) { this.shopCool -= dt; return; } if (Math.hypot(this.px - I.door.x, this.pz - I.door.z) < 1.4) return this.leaveMall(); for (const F of I.fronts) if (Math.hypot(this.px - F.x, this.pz - F.z) < 1.3) return this.enterShop(F); }
  enterShop(F) {
    if (F.mall && this.inMall) { this.shopInt ||= {}; const kinds = Object.keys(SHOP_KIND), I = this.shopInt[F.kind] ||= buildShopInterior(this, F.kind, kinds.indexOf(F.kind), makeBear); I.drawMenu(F.name); this.inMall.I.g.visible = false; I.g.visible = true; this.inShop = { F, I, ordered: null, menuShown: false }; this.placeAt(I.spawn.x, I.spawn.z, I.spawn.face); this.onShopEnter?.({ name: F.name }); return; }
    this.shopInt ||= {}; const kinds = Object.keys(SHOP_KIND), I = this.shopInt[F.kind] ||= buildShopInterior(this, F.kind, kinds.indexOf(F.kind), makeBear);
    I.drawMenu(F.name); this.hideOutdoor(I.g); I.g.visible = true; this.inShop = { F, I, ordered: null, menuShown: false }; this.placeAt(I.spawn.x, I.spawn.z, I.spawn.face); this.onShopEnter?.({ name: F.name, kind: F.kind, label: SHOP_KIND[F.kind].label });
  }
  leaveShop() {
    const S2 = this.inShop; if (!S2) return; S2.I.g.visible = false; if (S2.food) S2.I.g.remove(S2.food); this.inShop = null; if (this.eating) { this.bear.inner.position.y = 0; this.bear.setSeated?.(false); } this.eating = null;
    if (S2.F.mall && this.inMall) { this.inMall.I.g.visible = true; this.placeAt(S2.F.x - S2.F.nx * 2.4, S2.F.z - S2.F.nz * 2.4, Math.atan2(-S2.F.nx, -S2.F.nz)); this.shopCool = 1.5; this.onShop?.(null); return; }
    this.showOutdoor();
    const F = S2.F; this.placeAt(F.x + F.nx * 2.2, F.z + F.nz * 2.2, Math.atan2(F.nx, F.nz)); this.shopCool = 2; this.onShop?.(null); this.onShopEnter?.(null);
  }
  shopOrder(idx, mode) {
    const S2 = this.inShop; if (!S2) return; const item = (SHOP_MENU[S2.F.kind] || [])[idx]; if (!item) return; S2.ordered = { item, mode, t: 1.6 }; this.onShop?.(null);
  }
  tickShop(dt) {
    const S2 = this.inShop, I = S2.I;
    if (S2.ordered) { S2.ordered.t -= dt; if (S2.ordered.t <= 0) { const { item, mode } = S2.ordered; S2.ordered = null;
      if (mode === 'here' && I.seats.length) { const seat = I.seats[Math.floor(Math.random() * I.seats.length)], f = foodMesh(S2.F.kind, item); f.position.set(seat.tx - 0.3, 0.81, seat.tz); I.g.add(f); S2.food = f; this.placeAt(I.O.x + seat.x, I.O.z + seat.z, Math.atan2(seat.tx - seat.x, 0)); this.eating = { t: 7, item }; this.bear.setSeated?.(true); this.onEat?.({ item, mode }); }
      else { const f = foodMesh(S2.F.kind, item); f.scale.setScalar(2.2); f.position.set(0.55, 1.0, 0.35); this.bear.root.add(f); this.carry && this.bear.root.remove(this.carry); this.carry = f; this.carryT = 180; this.onEat?.({ item, mode: 'togo' }); } } }
    if (this.eating) { this.eating.t -= dt; this.bear.inner.position.y = 0.47 + Math.abs(Math.sin(this.t * 6)) * 0.03; if (this.eating.t <= 0) { this.bear.inner.position.y = 0; this.bear.setSeated?.(false); if (S2.food) { I.g.remove(S2.food); S2.food = null; } this.onEat?.({ item: this.eating.item, mode: 'done' }); this.eating = null; } return; }
    const dc = Math.hypot(this.px - I.counter.x, this.pz - I.counter.z), dd = Math.hypot(this.px - I.door.x, this.pz - I.door.z);
    if (dc < 1.4 && !S2.menuShown && !S2.ordered) { S2.menuShown = true; this.onShop?.({ name: S2.F.name, kind: S2.F.kind, label: SHOP_KIND[S2.F.kind].label, emoji: SHOP_KIND[S2.F.kind].emoji, menu: SHOP_MENU[S2.F.kind] || [] }); }
    if (dc > 2.4 && S2.menuShown && !S2.ordered) { S2.menuShown = false; this.onShop?.(null); }
    if (dd < 0.9) this.leaveShop();
  }
  nearDeck(x, z, m) {
    for (const si of this.deckGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || []) { const d = this.decks[si], ex = d.cx - d.ax, ez = d.cz - d.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - d.ax) * ex + (z - d.az) * ez) / L2, 0, 1); if (Math.hypot(x - d.ax - ex * t, z - d.az - ez * t) < d.hw + m) return true; }
    return false;
  }
  groundAt(x, z, y) {
    const cell = this.footGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`); let g = Math.max(0, this.deckAt(x, z, y));
    if (cell) for (const fi of cell) { const f = this.foot[fi]; if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; const fh = f.base === undefined ? f.h : f.h + f.base - this.terrAt(x, z); if (fh > g && y >= fh - 0.35 && inRing(x, z, ringAtY(f, fh))) g = fh; }
    if (this.attrFloor) { const fa = this.attrFloor(x, z, y); if (fa > g) g = fa; }
    return g;
  }
  // 부딪힘: 건물 외곽선(그 높이보다 낮을 때) · 둥근 물체(나무 · 가로등 · 교각 · 사람)에서 밀어낸다. wall = 부딪힌 벽 (벽 타기용)
  pushOut(x, z, y, r, roofF) {
    let wall = null, hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const cell = this.footGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || [];
      const cells = new Set(cell); for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) for (const fi of this.footGrid?.get(`${Math.floor((x + dx) / 40)},${Math.floor((z + dz) / 40)}`) || []) cells.add(fi);
      for (const fi of cells) {
        const f = this.foot[fi]; if (f.deck || (f.deckWall && y < f.h - 5)) continue; if (f.mh && y < f.mh - 1.8) continue; if (y >= (f.base === undefined ? f.h : f.h + f.base - this.terrAt(x, z)) - 0.35 || x < f.x0 - r || x > f.x1 + r || z < f.z0 - r || z > f.z1 + r) continue;
        // 가장 가까운 벽과 그 거리
        let best = Infinity, bx = 0, bz = 0, bnx = 0, bnz = 0; const ring = ringAtY(f, y), sgn = ringArea(ring) > 0 ? 1 : -1;
        for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], ex = c[0] - a[0], ez = c[1] - a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / L2, 0, 1), px = a[0] + ex * t, pz = a[1] + ez * t, d = Math.hypot(x - px, z - pz); if (d < best) { best = d; bx = px; bz = pz; const L = Math.sqrt(L2); bnx = (sgn > 0 ? ez : -ez) / L; bnz = (sgn > 0 ? -ex : ex) / L; } }
        const inside = inRing(x, z, ring);
        if (inside || best < r) { x = bx + bnx * r * 1.001; z = bz + bnz * r * 1.001; wall = { f, nx: bnx, nz: bnz }; hit = true; }
      }
      // 둥근 물체
      for (const c of this.circlesNear(x, z)) { if (y > (c.h ?? 99) || (c.mh && y < c.mh - 1.8)) continue; const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { x = c.x + dx / d * m; z = c.z + dz / d * m; hit = true; } }
    }
    void roofF; return { x, z, wall, hit };
  }
  // 둥근 물체: 고정된 것(격자) + 움직이는 사람 · 차
  addCircle(x, z, r, h = 99) { this.circGrid ||= new Map(); const k = `${Math.floor(x / 20)},${Math.floor(z / 20)}`; if (!this.circGrid.has(k)) this.circGrid.set(k, []); const c = { x, z, r, h, key: this.chunkKey }; this.circGrid.get(k).push(c); return c; }
  circlesNear(x, z) {
    const out = []; const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.circGrid?.get(`${gx + a},${gz + b}`); if (c) out.push(...c); }
    for (const p of this.people || []) for (const b of p.bears) { const q = b.root.position; if (Math.abs(q.x - x) < 3 && Math.abs(q.z - z) < 3) out.push({ x: q.x, z: q.z, r: 0.3 * (b.root.scale.x / BEAR), h: 1.2 }); }
    for (const gd of this.groups || []) if (gd.solid && Math.abs(gd.g.position.x - x) < 6 && Math.abs(gd.g.position.z - z) < 6) out.push({ x: gd.g.position.x, z: gd.g.position.z, r: gd.solid, h: 1.5 });
    // 실시간 버스: 길이 11m 라 앞 · 가운데 · 뒤 세 동그라미
    for (const o of this.live?.buses?.values() || []) if (o.mesh && Math.abs(o.x - x) < 10 && Math.abs(o.z - z) < 10) for (const k of [-3.6, 0, 3.6]) out.push({ x: o.x + Math.sin(o.yaw) * k, z: o.z + Math.cos(o.yaw) * k, r: 1.6, h: 3.2 });
    this.traffic?.circles(x, z, out);
    return out;
  }
  // 위치 → 코스 위 (s, 옆으로 얼마나)
  project(x, z) {
    const R = this.rp, n = R.length; let best = Infinity, bi = this.ri || 0, bt = 0;
    for (let i = Math.max(0, (this.ri || 0) - 80); i < Math.min(n - 1, (this.ri || 0) + 80); i++) { const a = R[i], b = R[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1), d = (a[0] + dx * t - x) ** 2 + (a[1] + dz * t - z) ** 2; if (d < best) { best = d; bi = i; bt = t; } }
    this.ri = bi; const s = (bi + bt) * this.step, p = this.at(s);
    return { s, lat: (x - p.x) * p.rx + (z - p.z) * p.rz };
  }

  // 지도 만들기. buildGen 은 단계마다 쉬어 갈 수 있게(yield) — 랜딩처럼 화면을 멈추면 안 되는 곳에서 load(id, { steps: true })
  build() { for (const _ of this.buildGen()); }
  *buildGen() {
    const M = this.map, S = M.scale, sc = this.scene, r = rnd(12345);
    this.routeSetup();
    this.windU = { value: 0 };
    // 물: 서울 전체(칸) 모드에선 불러온 칸들의 물을 모두 (칸마다 넣고 뺀다), 아니면 이 지도의 물
    this.waterSets = []; this.inWater = (x, z) => { for (const W of this.waterSets) { if (x < W.b[0] || x > W.b[1] || z < W.b[2] || z > W.b[3]) continue; if (W.water.some((w) => inPoly(x, z, w)) && !W.islands.some((w) => inPoly(x, z, w))) return true; } return false; };
    // 한강(높이 0) 물만: 지형을 0 으로 파는 곳 (호수 · 하천은 lowerLakes 가 따로)
    this.inRiver = (x, z) => { for (const W of this.waterSets) { if (x < W.b[0] || x > W.b[1] || z < W.b[2] || z > W.b[3]) continue; if ((W.rivers || W.water).some((w) => inPoly(x, z, w)) && !W.islands.some((w) => inPoly(x, z, w))) return true; } return false; };
    // 빛
    this.hemi = new THREE.HemisphereLight('#cfe3ff', '#7a7a60', 1.1); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.6); sc.add(this.sun); sc.add(this.sun.target);
    if (!isPhone) { this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); const sc2 = this.sun.shadow.camera; sc2.left = sc2.bottom = -45; sc2.right = sc2.top = 45; sc2.near = 10; sc2.far = 900; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04; }
    sc.fog = new THREE.FogExp2('#bcdcf4', 0.00022);
    // 하늘 공 · 별 · 해 · 달
    this.skyU = { top: { value: C('#2f78d8') }, hor: { value: C('#bcdcf4') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: C('#fff3d0') }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, night: { value: 0 }, cloud: { value: 0 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, hor, sunDir, sunCol, moonDir; uniform float night, cloud; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){ float y = max(vD.y, 0.0); vec3 c = mix(hor, top, pow(y, 0.38));
          float sd = max(dot(vD, sunDir), 0.0); c += sunCol * (pow(sd, 900.0) * 2.0 + pow(sd, 12.0) * 0.35) * (1.0 - cloud * 0.8);
          float md = max(dot(vD, moonDir), 0.0); c += vec3(0.85,0.9,1.0) * (smoothstep(0.9993, 0.9996, md) * 0.9 + pow(md, 60.0) * 0.12) * night * (1.0 - cloud * 0.9);
          vec3 q = floor(vD * 420.0); float st = step(0.9965, h(q)) * smoothstep(0.02, 0.25, vD.y) * night * (1.0 - cloud); c += vec3(st) * (0.6 + 0.4 * h(q + 3.0));
          if (vD.y < 0.0) c = hor * 0.9;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` }));
    this.sky.renderOrder = -100; sc.add(this.sky);
    this.grassTex = groundTex('grass');
    // 땅 바탕 (도시)
    const landTex = groundTex('city'); landTex.repeat.set(26000 / 9, 26000 / 9); const land = new THREE.Mesh(new THREE.PlaneGeometry(26000, 26000), flatMat('#a3a39f', -60, { map: landTex })); land.receiveShadow = true; land.rotation.x = -Math.PI / 2; land.renderOrder = -60; land.material.depthTest = true; land.material.depthWrite = true; sc.add(land); this.landM = land.material; if (M.kind === 'world') land.visible = false; // 서울 전체: 땅은 칸마다 지형 + 먼 지형 덩어리
    // 물: 반짝이는 물결 · 하늘 색 반사 · 밤에는 도시 불빛이 비친다
    this.waterU = { time: { value: 0 }, sunDir: this.skyU.sunDir, sunCol: this.skyU.sunCol, hor: this.skyU.hor, top: this.skyU.top, night: this.skyU.night, rain: { value: 0 }, fogCol: { value: C('#bcdcf4') }, fogD: { value: 0.00022 }, deep: { value: C('#2a6f80') } };
    const waterM = new THREE.ShaderMaterial({ uniforms: this.waterU, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float time, night, rain, fogD; uniform vec3 sunDir, sunCol, hor, top, fogCol, deep; varying vec3 vW;
        float n2(vec2 p){ return sin(p.x) * sin(p.y); }
        void main(){ vec2 p = vW.xz; float t = time;
          vec2 g = vec2(cos(p.x*0.21 + t*0.9) * 0.6 + cos((p.x+p.y)*0.37 - t*1.3) * 0.35 + cos(p.x*1.3 + p.y*0.7 + t*2.1) * 0.12, cos(p.y*0.19 - t*0.8) * 0.6 + cos((p.y-p.x)*0.41 + t*1.1) * 0.35 + cos(p.y*1.1 - p.x*0.9 - t*2.3) * 0.12);
          g += rain * vec2(cos(p.x*3.1 + t*7.0), cos(p.y*2.9 - t*6.0)) * 0.6;
          vec3 n = normalize(vec3(g.x * 0.08, 1.0, g.y * 0.08));
          vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 c = mix(deep * (0.35 + 0.65 * (1.0 - night)), mix(hor, top, 0.35), clamp(0.12 + fr * 0.6, 0.0, 0.85));
          vec3 rf = reflect(-v, n); float sp = pow(max(dot(rf, sunDir), 0.0), 220.0) * step(0.0, sunDir.y); c += sunCol * sp * 3.0;
          c += sunCol * pow(max(dot(rf, sunDir), 0.0), 18.0) * 0.18 * step(0.0, sunDir.y);
          vec2 gq = floor(p * 0.9 + g * 3.0); float gl = step(0.9965, fract(sin(dot(gq + floor(t * 1.5), vec2(12.99, 78.23))) * 43758.5)); c += sunCol * gl * 1.4 * (1.0 - night) * step(0.0, sunDir.y);
          float lights = smoothstep(0.55, 1.0, sin(p.x * 0.09 + g.x * 2.0) * sin(p.x * 0.31) ) * night * smoothstep(40.0, 700.0, length(cameraPosition.xz - p));
          c += vec3(1.0, 0.72, 0.4) * lights * 0.35;
          float d = length(cameraPosition - vW); float f = 1.0 - exp(-pow(fogD * d, 2.0)); c = mix(c, fogCol, f);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    this.waterM = waterM;
    if (M.kind !== 'world') yield* this.buildSteps(r);
    yield;
    if (M.kind === 'world') { this.chunks = new Map(); this.buildFar(); waterM.depthTest = true; waterM.polygonOffset = true; waterM.polygonOffsetFactor = -2; waterM.polygonOffsetUnits = -4; }
    this.buildLights(r);
    yield;
    this.buildSkyStuff(r);
    yield;
    // 여기까지는 땅 높이를 따르지 않는 것(하늘 · 빛 · 비 · 먼 풍경)
    if (M.kind === 'world') this.fixedObjs = new Set(sc.children);
    this.buildPeople();
    yield;
    this.buildTransit();
    // 내 곰돌이 그림자
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 18), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = -40; sc.add(this.shadow);
  }
  // 지도 안의 것들 (물 · 녹지 · 길 · 다리 · 건물 · 나무 · 가게 · 간판 · 골목 · 출구): 지역 지도 하나, 또는 서울 칸 하나(isChunk)
  // 지도 내용 만들기. 서울 전체 칸은 단계마다 쉬어 가며(yield) 만들어 걷는 중에 화면이 멈추지 않게
  buildContent(r) { for (const _ of this.buildSteps(r)); }
  *buildSteps(r) {
    const M = this.map, S = M.scale, sc = this.scene, P2 = (a) => unpack(a, S), polys = (list) => list.map((p) => p.map(P2));
    this.water = polys(M.water); this.islands = polys(M.island);
    const bb = (list) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const poly of list) for (const ring of poly) for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, x1, z0, z1]; };
    const WS = { water: this.water, islands: this.islands, b: bb(this.water), key: this.chunkKey }; (this.host || this).waterSets.push(WS);
    // 서울 전체 칸: 물을 한강(넓거나 물가가 0 높이)과 호수 · 하천으로 나눈다. 호수 · 하천은 물가 높이에 물을 얹는다
    const lakes = [], rivers = [];
    { const HO = this.host, HT = this.isChunk && HO?.terr ? (x, z) => HO.terrAt(x, z, 'orig') : null, T0 = HO?.world0?.tile, [ti0, tj0] = (this.chunkKey || '0_0').split('_').map(Number);
      // 칸 경계에서 잘린 변(물 한가운데)은 물가가 아니다
      const cut = (x, z) => T0 && (Math.abs(x - ti0 * T0) < 0.6 || Math.abs(x - (ti0 + 1) * T0) < 0.6 || Math.abs(z - tj0 * T0) < 0.6 || Math.abs(z - (tj0 + 1) * T0) < 0.6);
      for (const w of this.water) {
        if (!HT) { rivers.push(w); continue; }
        const o = w[0]; let A = 0; for (let i = 0, j = o.length - 1; i < o.length; j = i++) A += o[j][0] * o[i][1] - o[i][0] * o[j][1]; A = Math.abs(A / 2);
        const rim = [], rimAll = []; for (const r of w) for (let i = 0; i < r.length; i++) { const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length], isCut = cut(ax, az) && cut(bx, bz) && (Math.abs(ax - bx) < 0.6 || Math.abs(az - bz) < 0.6), n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 10)); for (let q = 0; q < n; q++) { const x = ax + ((bx - ax) * q) / n, z = az + ((bz - az) * q) / n, e = [x, z, HT(x, z)]; rimAll.push(e); if (!isCut) rim.push(e); } }
        if (!rim.length) { rivers.push(w); continue; }
        const hs = rimAll.map((r) => r[2]).sort((a, b) => a - b), p10 = hs[Math.floor(hs.length * 0.1)] ?? 0;
        if (A >= 300000 || p10 < 0.8) rivers.push(w); else lakes.push({ poly: w, rim, area: A });
      }
      WS.rivers = rivers; if (lakes.length) HO.lowerLakes(lakes, this.islands); }
    const inWater = (x, z) => this.water.some((w) => inPoly(x, z, w)) && !this.islands.some((w) => inPoly(x, z, w));
    if (!this.host) this.inWater = (this.host || this).inWater;
    // 지도 사각형 (물가 계단 · 거품: 잘린 가장자리는 빼려고)
    const RX = M.kind === 'tile' ? [M.terrain.x0, M.terrain.x0 + (M.terrain.nx - 1) * M.terrain.step, M.terrain.z0, M.terrain.z0 + (M.terrain.nz - 1) * M.terrain.step] : [-3200, 3200, -3200, 3200];
    const inside = (x, z) => x > RX[0] + 5 && x < RX[1] - 5 && z > RX[2] + 5 && z < RX[3] - 5 && (M.kind === 'tile' || (Math.abs(Math.abs(x) - 7000) > 5 && Math.abs(Math.abs(z) - 7000) > 5));
    // 물은 공원 위에 (OSM 한강공원 영역이 물까지 덮고 있다)
    // 6-9 9-4: 서울 전체 칸은 물 · 섬을 길 아래로 (여의도처럼 섬 위 찻길 · 골목이 섬 잔디에 덮여 차가 풀밭을 달렸다). 녹지보다는 위
    const WO = this.isChunk ? -50.9 : -47, IO = this.isChunk ? -50.8 : -46.9;
    const wMesh = new THREE.Mesh(fillGeo(rivers), (this.host || this).waterM); wMesh.renderOrder = WO; sc.add(wMesh);
    if (lakes.length) { const lm = new THREE.Mesh(fillGeo(lakes.map((L) => L.poly)), (this.host || this).waterM); lm.renderOrder = WO; lm.userData.drapeWater = true; sc.add(lm); }
    yield;
    // 섬 · 녹지 (계절마다 색이 바뀐다)
    this.islandM = flatMat('#7fa860', IO, { map: this.grassTex ||= groundTex('grass') }); patchy(this.islandM); const isl = new THREE.Mesh(fillGeo(this.islands, 0, 7), this.islandM); isl.renderOrder = IO; sc.add(isl);
    const greens = { grass: [], wood: [], wild: [], pitch: [], sand: [] };
    for (const g of M.green) (greens[g[0]] || greens.grass).push(g.slice(1).map(P2));
    this.greenPolys = [...greens.grass, ...greens.wood, ...greens.wild];
    this.greenM = {};
    for (const [k, col, o] of [['grass', '#8db86a', -53], ['wild', '#94a96a', -52.5], ['wood', '#5f8a4a', -52], ['pitch', '#6aa860', -51.5], ['sand', '#d9c79a', -51]]) {
      if (!greens[k].length) continue; const ss = this.state?.season || 'summer', m = flatMat(k === 'wood' ? '#ffffff' : col, o, k === 'sand' ? {} : { map: k === 'wood' ? forestFloorTex(ss) : (this.grassTex ||= groundTex('grass')) }); if (k === 'wood') woodFloor(m, ss); else if (k !== 'sand') patchy(m); this.greenM[k] = m; const me = new THREE.Mesh(fillGeo(greens[k], 0, 7), m); me.renderOrder = o; me.receiveShadow = true; sc.add(me);
    }
    yield;
    // 길 · 철길
    { const P = [], I = []; for (const rd of M.roads) { if (rd[1]) continue; ribbonInto(P, I, P2(rd.slice(2)), rd[0], 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#6f7173', -50)); m.renderOrder = -50; sc.add(m); this.roadM = m.material; }
    this.buildStreets(M.roads.map((rd, i) => ({ rd, name: M.roadNames?.[i] || '' })).filter((q) => !q.rd[1]).map(({ rd, name }) => ({ w: rd[0], name, pts: P2(rd.slice(2)) })).filter((r2) => r2.pts.length > 1));
    { const P = [], I = []; for (const rl of M.rails) ribbonInto(P, I, P2(rl), 4, 0); const m = new THREE.Mesh(geoOf(P, I), flatMat('#5d5650', -49.5)); m.renderOrder = -49.5; sc.add(m); }
    { const P = [], I = []; for (const pa of M.paths) { if (pa[0]) continue; ribbonInto(P, I, P2(pa.slice(2)), pa[1], 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#c9c0ae', -49)); m.renderOrder = -49; sc.add(m); this.pathM = m.material; }
    yield;
    // 달리는 길: 자전거길(짙은 아스팔트) + 강 쪽 산책 · 러닝 길(붉은 우레탄)
    {
      // 거리 코스(홍대 등)는 강변 러닝 길 · 잔디 띠를 깔지 않는다 (길은 실제 도로 · 보도 그대로)
      const ln = (lat, w, col, o, tex) => { if (this.map.kind && this.map.kind !== 'river') return new THREE.MeshLambertMaterial({ color: col }); const P = [], I = [], U = []; ribbonInto(P, I, this.rp.map((_, i) => this.world(i * this.step, lat)), w, 0, U); const m = new THREE.Mesh(geoOf(P, I, { uv: [U, 2] }), flatMat(col, o, tex ? { map: tex } : {})); m.renderOrder = o; m.receiveShadow = true; sc.add(m); return m.material; };
      { const gm = ln(-1.2, 15, '#8db86a', -48.5, this.grassTex ||= groundTex('grass')); patchy(gm); this.stripM = gm;
        for (const [lat, w] of [[16, 44], [-26, 34], [-150, 250]]) { const wm = ln(lat, w, '#8db86a', -59.5, this.grassTex); patchy(wm); this.wideM = [...(this.wideM || []), wm]; } }
      ln(0, 4.9, '#d9d4c8', -46.4); ln(-4.3, 3.8, '#d9d4c8', -46.3);
      this.bikeM = ln(0, 4.2, '#ffffff', -46.2, groundTex('asphalt')); this.runM = ln(-4.3, 3.2, '#ffffff', -46.1, groundTex('track'));
      // 코스가 물(샛강 등)을 건너는 곳: 작은 다리 난간 + 다리 바닥 테두리
      if (M.kind !== 'tile') { const posts = [], rails = []; let run = null; const flush = () => { if (run && run.length > 1) rails.push(run); run = null; };
        for (let s0 = 0; s0 < this.L; s0 += 2) { const [mx, mz] = this.world(s0, -2.2); if (this.inWater(mx, mz)) { (run ||= []).push(s0); } else flush(); } flush();
        const P = [], I = [];
        for (const seg of rails) for (const lat of [-6.4, 2.7]) { const pts = seg.map((s0) => this.world(s0, lat)); ribbonInto(P, I, pts, 0.16, 1.05); for (let k = 0; k < pts.length; k += 1) posts.push([pts[k][0], pts[k][1]]); }
        if (P.length) { sc.add(new THREE.Mesh(geoOf(P, I), new THREE.MeshLambertMaterial({ color: '#f2eee6', side: THREE.DoubleSide }))); const pg = new THREE.BoxGeometry(0.12, 1.05, 0.12); pg.translate(0, 0.52, 0); const im = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: '#e8e2d6' }), posts.length), o4 = new THREE.Object3D(); posts.forEach(([x, z], i) => { o4.position.set(x, 0, z); o4.updateMatrix(); im.setMatrixAt(i, o4.matrix); }); sc.add(im); }
        this.crossings = rails; }
      if (M.kind !== 'tile') { const P = [], I = []; for (let s = 0; s < this.L - 3; s += 6) { const seg = [this.world(s, 0), this.world(s + 3, 0)]; ribbonInto(P, I, seg, 0.15, 0); } const m = new THREE.Mesh(geoOf(P, I), flatMat('#f2c53d', -46)); m.renderOrder = -46; sc.add(m); }
    }
    {
      const P = [], I = [], U = [];
      for (const w of this.water) for (const ring of w) { let run = []; const flush = () => { if (run.length > 2) ribbonInto(P, I, run, 4, 0, U); run = []; }; for (const [x, z] of ring) { if (inside(x, z)) run.push([x, z]); else flush(); } flush(); }
      const m = new THREE.Mesh(geoOf(P, I, { uv: [U, 2] }), flatMat('#ffffff', -46.8, { map: this.stepTex = groundTex('steps') })); m.renderOrder = -46.8; sc.add(m);
      // 물가 잔물결: 호안 바로 바깥 물 위에 하얀 거품 띠 (천천히 밀려왔다 빠진다)
      const Pf = [], If = [], Uf = []; for (const w of this.water) for (const ring of w) { let run = []; const flush = () => { if (run.length > 2) ribbonInto(Pf, If, run, 6, 0, Uf); run = []; }; for (const [x, z] of ring) { if (inside(x, z)) run.push([x, z]); else flush(); } flush(); }
      this.foamU = { time: (this.host || this).waterU.time };
      const fm = new THREE.ShaderMaterial({ uniforms: this.foamU, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float time; varying vec2 vU; void main(){ float side = abs(vU.x - 0.5) * 2.0; float wave = 0.5 + 0.5 * sin(vU.y * 2.4 + time * 1.3); float band = smoothstep(1.0, 0.55, side) * smoothstep(0.0, 0.45, side); float foam = band * (0.25 + 0.35 * wave) * (0.6 + 0.4 * sin(vU.y * 13.0 - time * 2.0)); gl_FragColor = vec4(vec3(0.97, 0.99, 1.0), foam * 0.32); }' });
      // 서울 전체 칸에서는 뺀다: 하천 양쪽 둑에 흰 띠 두 줄이 생겨 건물을 뚫고 보였다
      if (!this.isChunk) { const fmesh = new THREE.Mesh(geoOf(Pf, If, { uv: [Uf, 2] }), fm); fmesh.renderOrder = -46.85; sc.add(fmesh); }
    }
    yield;
    this.buildBridges(P2, inWater, r);
    yield;
    yield* this.buildBuildings(P2);
    yield;
    if (M.kind !== 'tile') this.buildFar(P2);
    if (M.kind === 'summit') this.summit = buildSummit(this);
    // 서울 전체: 남산 칸이면 진짜 지형 위에 N서울타워 · 케이블카 · 전망대
    else if (this.isChunk && M.names?.includes('남산서울타워')) this.summit = buildSummit(this, { world: true });
    // 서울 전체 칸: 손으로 만든 것은 그 칸이 가까운 지역(예전 코스, 1.4km 안)을 보고 · 이름 · 실제 자리로 찾아서
    if (this.isChunk) { const [ti, tj] = this.chunkKey.split('_').map(Number), T0 = this.host.world0.tile, nr = this.host.nearRegion((ti + 0.5) * T0, (tj + 0.5) * T0); this.regionHere = nr && nr.d < 1400 ? nr.id : null; } else this.regionHere = this.id;
    const RH = this.regionHere;
    if (RH === 'hongdae' || this.isChunk) this.buildForestPath(r);
    yield;
    this.buildPlants(inWater, r);
    // 큰 몰 정문: 더현대 서울 (가장 긴 벽 가운데, 바깥을 본다)
    this.malls = []; for (const [want, mallName] of [['더현대 서울', '더현대 서울'], ['IFC mall (South Gate)', 'IFC몰'], ['IFC mall (North Gate)', 'IFC몰']]) { const fs2 = (this.foot || []).filter((f) => f.name === want); const f = fs2.sort((a, b) => Math.abs(ringArea(b.ring)) - Math.abs(ringArea(a.ring)))[0]; if (f) { const ring = f.ring, sg = ringArea(ring) > 0 ? 1 : -1; let best = null; for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (!best || L > best.L) best = { L, x: (a[0] + c[0]) / 2, z: (a[1] + c[1]) / 2, nx: (sg > 0 ? c[1] - a[1] : a[1] - c[1]) / L, nz: (sg > 0 ? a[0] - c[0] : c[0] - a[0]) / L }; } const D2 = { name: mallName, x: best.x + best.nx * 0.1, z: best.z + best.nz * 0.1, nx: best.nx, nz: best.nz }; this.malls.push(D2);
      const gd = new THREE.Group(); gd.position.set(D2.x, 0, D2.z); gd.rotation.y = Math.atan2(D2.nx, D2.nz); const glass = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshPhongMaterial({ color: '#cfe2ee', emissive: '#ffe8c8', emissiveIntensity: 0.25, shininess: 100 })); glass.position.set(0, 2.5, 0.12); gd.add(glass); const fr = new THREE.Mesh(new THREE.BoxGeometry(8.6, 5.4, 0.12), new THREE.MeshLambertMaterial({ color: '#d9d4cc' })); fr.position.set(0, 2.7, 0.02); gd.add(fr); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c2 = cv.getContext('2d'); c2.fillStyle = '#f4f1ea'; c2.fillRect(0, 0, 512, 96); c2.fillStyle = '#2f3a2f'; c2.font = 'bold 54px serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(mallName, 256, 50); const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace; const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshLambertMaterial({ map: st, emissive: '#ffffff', emissiveMap: st, emissiveIntensity: 0.3 })); sg2.position.set(0, 6.4, 0.1); gd.add(sg2); this.scene.add(gd); } }
    yield;
    this.buildGates();
    if (M.kind === 'street' || (this.isChunk && ['hongdae', 'itaewon', 'gangnam', 'sinchon', 'myeongdong', 'seongsu', 'jamsil'].includes(RH))) this.buildNeon(r);
    yield;
    if (M.kind !== 'summit') this.buildAlleys(P2, r);
    if (RH === 'hongdae') this.buildMurals(r);
    if (RH === 'banpo' || this.isChunk) this.buildBanpo(P2);
    // 광화문광장 이순신 · 세종대왕 동상, 청계광장 조형물
    if (this.isChunk) buildLandmarkStatues(this);
    // 뚝섬 음악분수 (실제 자리, 강가 광장)
    if (this.isChunk) { const [fx, fz] = this.ll(37.5294, 127.0697), [ti, tj] = this.chunkKey.split('_').map(Number), T0 = this.host.world0.tile; if (Math.floor(fx / T0) === ti && Math.floor(fz / T0) === tj) { let p = [fx, fz]; for (let k = 0; k < 12 && this.inWater(p[0], p[1]); k++) p = [fx, fz - 10 * (k + 1)]; this.buildMusicFountain(p); } }
    if (this.id === 'ttukseom') { const m = (M.marks || []).find(([n]) => /자벌레/.test(n)); if (m) { let p = this.world(m[1] + 60, 40); for (const lat of [40, -40, 70, -70, 25, -25]) { p = this.world(m[1] + 60, lat); if (!this.inWater(p[0], p[1])) break; } this.buildMusicFountain(p); } }
    yield;
    this.addShopFronts(buildShopFronts(this, M.shops || [], M.scale));
    yield;
    if (M.kind !== 'summit') yield* this.buildStreetSigns(P2, r);
    yield;
    this.buildEntrances();
  }

  // 도시 바닥: 보도(보도블록) · 연석 · 차선(가운데 노란 겹줄 · 흰 점선) · 교차로 횡단보도(흰 줄무늬) · 신호등 (차량 신호 · 보행 신호, 방향마다 번갈아 바뀐다)
  buildStreets(roads) {
    const sc = this.scene, off = (pts, d) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; return [p[0] - dz * d, p[1] + dx * d]; });
    const layer = (build, col, order, extra) => { const P = [], I = [], U = []; build(P, I, U); if (!P.length) return null; const m = new THREE.Mesh(geoOf(P, I, U.length ? { uv: [U, 2] } : {}), flatMat(col, order, extra)); m.renderOrder = order; sc.add(m); return m; };
    // 보도블록 무늬
    const paveT = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#c4bdb2'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < 64; x += 16) { c.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; c.fillRect(x, y, 15, 15); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
    layer((P, I, U) => { for (const r of roads) ribbonInto(P, I, r.pts, r.w + 7, 0, U); }, '#ffffff', -50.6, { map: paveT });
    layer((P, I) => { for (const r of roads) ribbonInto(P, I, r.pts, r.w + 0.7, 0); }, '#d9d4cb', -50.3);
    // 교차로 찾기: 서로 다른 길의 선분이 만나는 곳
    const segs = [], G = 40, grid = new Map(); roads.forEach((r, ri) => { for (let i = 1; i < r.pts.length; i++) { const sg = { ri, a: r.pts[i - 1], b: r.pts[i] }, si = segs.push(sg) - 1; const x0 = Math.floor(Math.min(sg.a[0], sg.b[0]) / G), x1 = Math.floor(Math.max(sg.a[0], sg.b[0]) / G), z0 = Math.floor(Math.min(sg.a[1], sg.b[1]) / G), z1 = Math.floor(Math.max(sg.a[1], sg.b[1]) / G); for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = `${gx},${gz}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(si); } } });
    // cuts[길] = 그 길이 다른 길과 만나는 점들 (차선은 교차로 안에서 끊는다)
    const xs = [], cuts = []; for (const list of grid.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const A = segs[list[i]], B = segs[list[j]]; if (A.ri === B.ri) continue; const d1x = A.b[0] - A.a[0], d1z = A.b[1] - A.a[1], d2x = B.b[0] - B.a[0], d2z = B.b[1] - B.a[1], den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-6) continue; const t = ((B.a[0] - A.a[0]) * d2z - (B.a[1] - A.a[1]) * d2x) / den, u = ((B.a[0] - A.a[0]) * d1z - (B.a[1] - A.a[1]) * d1x) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue; const L1 = Math.hypot(d1x, d1z), L2 = Math.hypot(d2x, d2z), cos = Math.abs((d1x * d2x + d1z * d2z) / (L1 * L2)); if (cos > 0.85) continue; const x = A.a[0] + d1x * t, z = A.a[1] + d1z * t; (cuts[A.ri] ||= []).push([x, z, roads[B.ri].w / 2 + 8]); (cuts[B.ri] ||= []).push([x, z, roads[A.ri].w / 2 + 8]); if (xs.some((q) => Math.hypot(q.x - x, q.z - z) < 18)) continue; xs.push({ x, z, A: { ux: d1x / L1, uz: d1z / L1, w: roads[A.ri].w, name: roads[A.ri].name, ri: A.ri }, B: { ux: d2x / L2, uz: d2z / L2, w: roads[B.ri].w, name: roads[B.ri].name, ri: B.ri } }); }
    // 횡단보도: 교차로마다 두 길 양쪽 (흰 막대가 길 방향으로 나란히), 그 옆 모퉁이에 신호등
    const zebra = [], lights = [];
    for (const X of xs) for (const [R, O, ph] of [[X.A, X.B, 0], [X.B, X.A, 1]]) for (const sd of [-1, 1]) { if (R.w < 8) continue; const dist = O.w / 2 + 3.2, cx = X.x + R.ux * dist * sd, cz = X.z + R.uz * dist * sd; if (zebra.some((Z) => Math.abs(Z.x - cx) < 7 && Math.abs(Z.z - cz) < 7 && Math.abs(Z.ux * R.ux + Z.uz * R.uz) > 0.8)) continue; zebra.push({ x: cx, z: cz, ux: R.ux, uz: R.uz, w: R.w, ri: R.ri, sd }); if (O.w >= 8) lights.push({ x: cx - R.uz * (R.w / 2 + 1.2) * sd + R.ux * 2.2 * sd, z: cz + R.ux * (R.w / 2 + 1.2) * sd + R.uz * 2.2 * sd, face: Math.atan2(-R.ux * sd, -R.uz * sd), ph }); }
    layer((P, I) => { for (const Z of zebra) { const nx = -Z.uz, nz = Z.ux; for (let o = -Z.w / 2 + 0.5; o < Z.w / 2 - 0.3; o += 0.9) { const k = P.length / 3, cx = Z.x + nx * o, cz = Z.z + nz * o, hx = Z.ux * 2, hz = Z.uz * 2, wx = nx * 0.25, wz = nz * 0.25; P.push(cx - hx - wx, 0, cz - hz - wz, cx - hx + wx, 0, cz - hz + wz, cx + hx - wx, 0, cz + hz - wz, cx + hx + wx, 0, cz + hz + wz); I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } } }, '#f6f6f2', -49.7);
    this.buildLanes(roads, cuts, zebra, off, layer);
    // 신호등: 기둥 + 팔 + 가로 신호등(빨 · 노 · 초), 기둥 아래 보행 신호. 두 방향이 번갈아 (30초)
    if (lights.length) {
      const N = lights.length, o = new THREE.Object3D(), poleG = new THREE.CylinderGeometry(0.09, 0.11, 5.6, 8); poleG.translate(0, 2.8, 0); const armG = new THREE.BoxGeometry(0.08, 0.08, 3.4); armG.translate(0, 5.4, 1.7); const headG = new THREE.BoxGeometry(1.55, 0.38, 0.3); headG.translate(0, 5.25, 3.1); const pedG = new THREE.BoxGeometry(0.34, 0.6, 0.22); pedG.translate(0, 2.6, 0.2);
      const mk = (g, m) => { const im = new THREE.InstancedMesh(g, m, N); lights.forEach((L, i) => { o.position.set(L.x, 0, L.z); o.rotation.y = L.face; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); sc.add(im); return im; };
      const steel = new THREE.MeshLambertMaterial({ color: '#8c949c' }), dark = new THREE.MeshLambertMaterial({ color: '#25282c' }); mk(poleG, steel); mk(armG, steel); mk(headG, dark); mk(pedG, dark);
      // 불빛: 서울 가로형 4색 (빨 · 노 · 좌회전 화살표 · 초), 방향(ph) 둘로 나눠 따로 켠다. 화살표는 왼쪽을 가리키는 세모
      this.sigM = {}; const lampG = new THREE.CircleGeometry(0.12, 12), arrowG = new THREE.CircleGeometry(0.12, 3); arrowG.rotateZ(Math.PI);
      for (const [key, col, dx] of [['r', '#ff3b30', -0.54], ['y', '#ffcc00', -0.18], ['a', '#30d158', 0.18], ['g', '#30d158', 0.54]]) for (const ph of [0, 1]) { const list = lights.filter((L) => L.ph === ph); if (!list.length) continue; const m = new THREE.MeshBasicMaterial({ color: '#2a2a2a' }); const g = (key === 'a' ? arrowG : lampG).clone(); g.translate(dx, 5.25, 3.26); const im = new THREE.InstancedMesh(g, m, list.length); list.forEach((L, i) => { o.position.set(L.x, 0, L.z); o.rotation.y = L.face; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); sc.add(im); this.sigM[key + ph] = { m, col: new THREE.Color(col) }; }
      for (const L of lights) this.addCircle(L.x, L.z, 0.16, 5.6);
    }
    // 도로명판: 교차로 한 모퉁이 기둥에 파란 판 두 장 (두 길 이름, 한국 도로명판처럼 흰 글씨 · 화살표)
    { const named = xs.filter((X) => X.A.name || X.B.name).slice(0, 400); if (named.length) {
      const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 2048; const c = cv.getContext('2d'), slots = new Map();
      const slotOf = (nm) => { if (slots.has(nm)) return slots.get(nm); const n = slots.size; if (n >= 256) return 0; const x = (n % 8) * 256, y = Math.floor(n / 8) * 64; c.fillStyle = '#1f4fa8'; c.fillRect(x, y, 256, 64); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.strokeRect(x + 4, y + 4, 248, 56); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(nm, x + 18, y + 33, 180); c.beginPath(); c.moveTo(x + 214, y + 22); c.lineTo(x + 240, y + 32); c.lineTo(x + 214, y + 42); c.fill(); slots.set(nm, n); return n; };
      const P = [], U = [], I = [], poles = [];
      for (const X of named) { const px = X.x + (X.A.ux + X.B.ux) * 0 + (-X.A.uz) * (X.A.w / 2 + 2.2) + X.A.ux * (X.B.w / 2 + 2.2), pz = X.z + X.A.ux * (X.A.w / 2 + 2.2) + X.A.uz * (X.B.w / 2 + 2.2); poles.push([px, pz]); this.addCircle(px, pz, 0.12, 3.6);
        [[X.A, 3.25], [X.B, 2.75]].forEach(([Rd, y]) => { if (!Rd.name) return; const n = slotOf(Rd.name), u0 = (n % 8) / 8, v1 = 1 - Math.floor(n / 8) / 32, v0 = v1 - 1 / 32, ux = Rd.ux, uz = Rd.uz, W = 1.6, H = 0.4; for (const sd of [1, -1]) { const k = P.length / 3, ox = px + ux * W / 2, oz = pz + uz * W / 2, nx = -uz * 0.03 * sd, nz = ux * 0.03 * sd; P.push(ox - ux * W / 2 + nx, y - H / 2, oz - uz * W / 2 + nz, ox + ux * W / 2 + nx, y - H / 2, oz + uz * W / 2 + nz, ox + ux * W / 2 + nx, y + H / 2, oz + uz * W / 2 + nz, ox - ux * W / 2 + nx, y + H / 2, oz - uz * W / 2 + nz); if (sd > 0) { U.push(u0, v0, u0 + 1 / 8, v0, u0 + 1 / 8, v1, u0, v1); I.push(k, k + 1, k + 2, k, k + 2, k + 3); } else { U.push(u0 + 1 / 8, v0, u0, v0, u0, v1, u0 + 1 / 8, v1); I.push(k, k + 2, k + 1, k, k + 3, k + 2); } } }); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); this.scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.12 }))); // 앞 · 뒤 판을 따로 (양면 재질이면 뒤에서 거울 글씨가 겹쳐 보인다)
      const pg = new THREE.CylinderGeometry(0.06, 0.07, 3.5, 8); pg.translate(0, 1.75, 0); const im = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: '#8c949c' }), poles.length), o = new THREE.Object3D(); poles.forEach(([x, z], i) => { o.position.set(x, 0, z); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); this.scene.add(im); } }
    this.streetX = xs;
    // 가로등 · 버스정류장 · 공원 벤치 (서울 전체 칸)
    if (this.isChunk) this.furniture = buildStreetFurniture(this, roads, xs, this.laneSide);
  }
  // 차선 · 중앙선 · 정지선 · 버스전용차로 (실제 서울 도로 표시처럼)
  //   - 같은 이름 길이 반대 방향으로 나란히 있으면(OSM 의 상 · 하행 분리 도로) 한 방향 도로: 가운데 노란 겹줄 대신 안쪽 가장자리에 노란 실선
  //   - 선은 교차로 안에서 끊고, 횡단보도 앞(들어오는 쪽 차로)에 흰 정지선 · 차로마다 직진 화살표
  //   - 중앙버스전용차로 길(강남대로 · 송파대로 · 종로 …)은 가운데 차로를 파란 겹선으로, 가로변 버스차로(테헤란로)는 바깥 차로를 파란 점선으로
  buildLanes(roads, cuts, zebra, off, layer) {
    const BUS_MID = /^(강남대로|송파대로|천호대로|도봉로|미아로|동소문로|왕산로|망우로|통일로|의주로|수색로|성산로|마포대로|한강대로|경인로|시흥대로|공항대로|종로|동작대로)$/, BUS_SIDE = /^(테헤란로|남부순환로)$/;
    // 한 방향 도로 찾기: 길 가운데 세 점에서 같은 이름 · 반대 방향 · 알맞은 거리의 짝이 보이면, 그 짝이 있는 쪽(+1 오른쪽 / -1 왼쪽)
    const byName = new Map(); roads.forEach((r, i) => { if (r.name && r.w >= 8) { if (!byName.has(r.name)) byName.set(r.name, []); byName.get(r.name).push(i); } });
    const side = roads.map((r, ri) => { const mates = byName.get(r.name); if (!mates || mates.length < 2 || r.pts.length < 2) return 0; let votes = 0;
      for (const f of [0.25, 0.5, 0.75]) { const m = Math.min(r.pts.length - 2, Math.floor((r.pts.length - 1) * f)), a = r.pts[m], b = r.pts[m + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let best = null;
        for (const qi of mates) { if (qi === ri) continue; const q = roads[qi]; for (let k = 1; k < q.pts.length; k++) { const c = q.pts[k - 1], e = q.pts[k], dx = e[0] - c[0], dz = e[1] - c[1], L2 = dx * dx + dz * dz || 1, t = clamp(((mx - c[0]) * dx + (mz - c[1]) * dz) / L2, 0, 1), px = c[0] + dx * t, pz = c[1] + dz * t, d = Math.hypot(px - mx, pz - mz), lim = (r.w + q.w) / 2; if (d < lim * 0.55 || d > lim + 14) continue; if ((ux * dx + uz * dz) / Math.sqrt(L2) > -0.85) continue; if (!best || d < best.d) best = { d, s: Math.sign((px - mx) * -uz + (pz - mz) * ux) }; } }
        if (best) votes += best.s; }
      return Math.abs(votes) >= 2 ? Math.sign(votes) : 0; }); this.laneSide = side;
    // 선 하나를 교차로 밖 조각들로 (2m 마다 잘라 본다)
    const pieces = (pts, ri) => { const C = cuts[ri] || [], out = []; let cur = []; const bad = (x, z) => C.some(([cx, cz, rr]) => Math.abs(cx - x) < rr && Math.abs(cz - z) < rr && Math.hypot(cx - x, cz - z) < rr);
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i) { const q = pts[i - 1], L = Math.hypot(p[0] - q[0], p[1] - q[1]), n = Math.max(1, Math.ceil(L / 2)); for (let k = 1; k <= n; k++) { const x = q[0] + ((p[0] - q[0]) * k) / n, z = q[1] + ((p[1] - q[1]) * k) / n; if (bad(x, z)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push([x, z]); } } else if (!bad(p[0], p[1])) cur.push(p); }
      if (cur.length > 1) out.push(cur); return out; };
    const solid = (P, I, pts, ri, d, w) => { for (const pc of pieces(off(pts, d), ri)) ribbonInto(P, I, pc, w, 0); };
    // 점선: 조각을 따라 잰 거리로 (on m 칠하고 gap m 비우기). 짧은 선분이 이어져도 칠한 길이가 끊기지 않게
    const dash = (P, I, pts, ri, d, w, on, gap) => { const per = on + gap; for (const q of pieces(off(pts, d), ri)) { let s0 = 0; for (let i = 1; i < q.length; i++) { const [ax, az] = q[i - 1], [bx, bz] = q[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * w / 2, nz = ux * w / 2, s1 = s0 + L;
      for (let n = Math.floor(s0 / per); n * per < s1; n++) { const t0 = Math.max(s0, n * per) - s0, t1 = Math.min(s1, n * per + on) - s0; if (t1 - t0 < 0.05) continue; const k = P.length / 3, x0 = ax + ux * t0, z0 = az + uz * t0, x1 = ax + ux * t1, z1 = az + uz * t1; P.push(x0 + nx, 0, z0 + nz, x0 - nx, 0, z0 - nz, x1 + nx, 0, z1 + nz, x1 - nx, 0, z1 - nz); I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      s0 = s1; } } };
    // 차로 선 자리: 양방향 = 가운데에서 ±3.3m 마다, 한 방향 = 안쪽(노란 실선)에서 바깥으로 3.3m 마다
    const laneLines = (r, ri) => { const sd = side[ri]; if (sd) { const inner = sd * (r.w / 2 - 0.45), n = Math.max(1, Math.floor((r.w - 0.9) / 3.3)), out = []; for (let k = 1; k < n; k++) out.push({ d: inner - sd * k * 3.3, k, last: k === n - 1 }); return { inner, out }; } const n = Math.floor(r.w / 2 / 3.3), out = []; for (let k = 1; k < n; k++) for (const s2 of [-1, 1]) out.push({ d: s2 * k * 3.3, k, last: k === n - 1 }); return { inner: null, out }; };
    // 노란 중앙선
    layer((P, I) => { roads.forEach((r, ri) => { const L = laneLines(r, ri); if (L.inner !== null) solid(P, I, r.pts, ri, L.inner, 0.15); else if (r.w >= 14) for (const d of [-0.18, 0.18]) solid(P, I, r.pts, ri, d, 0.15); }); }, '#f2c230', -49.8);
    // 흰 차선 (버스차로 경계는 파란 선이 대신)
    layer((P, I) => { roads.forEach((r, ri) => { const L = laneLines(r, ri), mid = BUS_MID.test(r.name) && r.w >= 14, sideB = BUS_SIDE.test(r.name) && r.w >= 14;
      if (r.w >= 14 || L.inner !== null) { for (const q of L.out) { if (mid && q.k === 1) continue; if (sideB && q.last) continue; dash(P, I, r.pts, ri, q.d, 0.15, 3, 5); } } else if (r.w >= 8) dash(P, I, r.pts, ri, 0, 0.15, 3, 5); }); }, '#f4f4f0', -49.8);
    // 버스전용차로: 중앙은 파란 겹실선, 가로변은 파란 점선
    layer((P, I) => { roads.forEach((r, ri) => { if (r.w < 14) return; const L = laneLines(r, ri);
      if (BUS_MID.test(r.name)) for (const q of L.out) if (q.k === 1) for (const e of [-0.14, 0.14]) solid(P, I, r.pts, ri, q.d + e, 0.12);
      if (BUS_SIDE.test(r.name)) for (const q of L.out) if (q.last) dash(P, I, r.pts, ri, q.d, 0.18, 5, 3); }); }, '#2f6fd6', -49.79);
    // 정지선 · 직진 화살표: 횡단보도 바로 바깥, 교차로로 들어오는 쪽 차로만
    layer((P, I) => { const quad = (cx, cz, ax, az, bx, bz) => { const k = P.length / 3; P.push(cx - ax - bx, 0, cz - az - bz, cx - ax + bx, 0, cz - az + bz, cx + ax - bx, 0, cz + az - bz, cx + ax + bx, 0, cz + az + bz); I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); };
      for (const Z of zebra) { const r = roads[Z.ri]; if (!r || r.w < 8) continue; const sd = side[Z.ri];
        // 들어오는 방향 v = -Z.sd * u. 한 방향 도로는 길 방향(u)으로 들어올 때만
        if (sd && Z.sd > 0) continue; const vx = -Z.sd * Z.ux, vz = -Z.sd * Z.uz, rx = -vz, rz = vx;
        let a0, a1; if (sd) { a0 = -r.w / 2 + 0.3; a1 = r.w / 2 - 0.3; } else { a0 = 0.35; a1 = r.w / 2 - 0.3; }
        // 오른쪽 벡터(rx, rz)로 잰 차로 범위. 한 방향 도로는 길 전체
        const along = 4.6, bx0 = Z.x - vx * along, bz0 = Z.z - vz * along, mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
        quad(bx0 + rx * mid, bz0 + rz * mid, vx * 0.25, vz * 0.25, rx * half, rz * half);
        // 화살표: 차로 가운데, 정지선 10m 뒤 (몸통 + 머리)
        for (let o = a0 + 1.65; o < a1 - 0.6; o += 3.3) { const ax = bx0 - vx * 10 + rx * o, az = bz0 - vz * 10 + rz * o; quad(ax - vx * 1.2, az - vz * 1.2, vx * 1.5, vz * 1.5, rx * 0.09, rz * 0.09); const hx = ax + vx * 0.9, hz = az + vz * 0.9, k = P.length / 3; P.push(hx + rx * 0.45, 0, hz + rz * 0.45, hx - rx * 0.45, 0, hz - rz * 0.45, hx + vx * 1.3, 0, hz + vz * 1.3); I.push(k, k + 1, k + 2); } } }, '#f6f6f2', -49.75);
  }
  // 거리 코스(홍대): 길가 건물 벽에 세로 돌출 간판 (밤에 네온처럼 · 분홍 · 하늘 · 보라 · 노랑 · 초록), 2 ~ 4층 높이
  // 이웃 지역으로 가는 길목: 코스 양 끝에 빛나는 이정표 문 (걸어 들어가면 onRegionGate)
  buildGates() {
    const LINKS = { yeouido: [['hongdae', '🎸 홍대 거리'], ['banpo', '🌈 반포 한강']], hongdae: [['sinchon', '🎓 신촌'], ['yeouido', '🌉 여의도 한강']], sinchon: [['hongdae', '🎸 홍대 거리'], null], banpo: [['yeouido', '🌉 여의도 한강'], ['itaewon', '🌍 이태원']], itaewon: [['namsan', '🗼 남산타워'], ['banpo', '🌈 반포 한강']], namsan: [['myeongdong', '🛍️ 명동'], ['itaewon', '🌍 이태원']], myeongdong: [['namsan', '🗼 남산타워'], ['insadong', '🏮 인사동 · 종로']], insadong: [['myeongdong', '🛍️ 명동'], ['bukchon', '🏯 북촌 한옥마을']], bukchon: [['insadong', '🏮 인사동 · 종로'], null], ttukseom: [['seongsu', '☕ 성수 거리'], ['jamsil', '🎡 석촌호수']], seongsu: [['ttukseom', '🏙️ 뚝섬 한강'], null], jamsil: [['ttukseom', '🏙️ 뚝섬 한강'], ['gangnam', '🏙️ 강남역']], gangnam: [['jamsil', '🎡 석촌호수'], null] }[this.id] || [];
    this.gates = [];
    LINKS.forEach((lk, end) => { if (!lk) return; const s0 = end === 0 ? 6 : this.L - 6, [x, z] = this.world(s0, 0), p = this.at(s0), g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(p.dx, p.dz) + (end === 0 ? Math.PI : 0); this.scene.add(g);
      const m = new THREE.MeshLambertMaterial({ color: '#f4f1ea', emissive: '#ffd98a', emissiveIntensity: 0.4 }); for (const sx of [-3.2, 3.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.6, 12), m); post.position.set(sx, 2.3, 0); g.add(post); }
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#2b3039'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ffd98a'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${lk[1]} →`, 256, 50, 490); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.3), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); sign.position.y = 4.4; g.add(sign);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: '#ffe6b0', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.y = 2; g.add(glow);
      this.gates.push({ x, z, id: lk[0], label: lk[1], end }); });
  }
  buildNeon(r) {
    const cols = ['#ff4d9a', '#3de0ff', '#b57bff', '#ffd23f', '#7cff6b', '#ff7a3d', '#ffffff'], words = ['BAR', 'PUB', '노래방', 'CLUB', '카페', 'LIVE', '코인노래', '포차', 'HOTEL', '타투', '네일', 'BEER', '와인', '라멘', 'GAME'];
    const list = []; for (const f of this.foot || []) { if (f.h < 8 || f.h > 40 || f.noClimb) continue; const ring = f.ring, sg = ringArea(ring) > 0 ? 1 : -1; for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 5) continue; const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, q = this.project(mx, mz); if (Math.abs(q.lat) > 220) continue; const nx = (sg > 0 ? c[1] - a[1] : a[1] - c[1]) / L, nz = (sg > 0 ? a[0] - c[0] : c[0] - a[0]) / L, t = r() * 0.6 + 0.2; list.push({ x: a[0] + (c[0] - a[0]) * t + nx * 0.7, z: a[1] + (c[1] - a[1]) * t + nz * 0.7, y: 3.6 + r() * Math.min(6, f.h - 6), ry: Math.atan2(c[0] - a[0], c[1] - a[1]), col: cols[Math.floor(r() * cols.length)], w: words[Math.floor(r() * words.length)] }); if (list.length > 1400) break; } if (list.length > 1400) break; }
    if (!list.length) return;
    // 글씨: 단어 × 색 조합을 큰 그림 한 장에 (64 × 192 칸, 32 × 5) → 간판 앞뒤 면은 한 덩어리, 몸통은 인스턴스로 (그리기 호출 2번)
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const c = cv.getContext('2d'), slot = new Map();
    const slotOf = (w, col) => { const k = w + col; if (slot.has(k)) return slot.get(k); const n = slot.size; if (n >= 160) return 0; const x = (n % 32) * 64, y = Math.floor(n / 32) * 192; c.fillStyle = '#16131c'; c.fillRect(x, y, 64, 192); c.strokeStyle = col; c.lineWidth = 4; c.strokeRect(x + 4, y + 4, 56, 184); c.fillStyle = col; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; const chars = [...w]; chars.forEach((ch, i2) => c.fillText(ch, x + 32, y + (chars.length > 1 ? 30 + i2 * (132 / (chars.length - 1)) : 96))); slot.set(k, n); return n; };
    const P = [], U = [], I = [], tmp = new THREE.Vector3();
    for (const N of list) { const n = slotOf(N.w, N.col), u0 = (n % 32) / 32, u1 = u0 + 1 / 32, v1 = 1 - Math.floor(n / 32) * (192 / 1024), v0 = v1 - 192 / 1024, cs = Math.cos(N.ry), sn = Math.sin(N.ry);
      for (const sd of [-1, 1]) { const k = P.length / 3; for (const [lz, ly] of [[-0.4, -1.2], [0.4, -1.2], [0.4, 1.2], [-0.4, 1.2]]) { const lx = sd * 0.115, lzz = -lz * sd; /* 보는 쪽 오른쪽으로 글씨가 이어지게 (예전엔 양쪽 다 거울) */ tmp.set(lx * cs + lzz * sn, ly, -lx * sn + lzz * cs); P.push(N.x + tmp.x, N.y + tmp.y, N.z + tmp.z); } U.push(u0, v0, u1, v0, u1, v1, u0, v1); I.push(k, k + 1, k + 2, k, k + 2, k + 3); } }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.2, side: THREE.DoubleSide }); (this.neonMs ||= []).push(m);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); this.scene.add(new THREE.Mesh(g, m));
    const bg = new THREE.BoxGeometry(0.22, 2.4, 0.8), im = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: '#1b1820' }), list.length), o = new THREE.Object3D(); list.forEach((N, k) => { o.position.set(N.x, N.y, N.z); o.rotation.y = N.ry; o.updateMatrix(); im.setMatrixAt(k, o.matrix); }); this.scene.add(im);
  }
  // 반포: 반포대교 달빛무지개분수(다리 양옆에서 강으로 떨어지는 물줄기 · 밤엔 무지개 색) · 세빛섬 LED 테두리
  buildBanpo(P2) {
    const M = this.map, len = (pts) => pts.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0), br = (M.bridges || []).filter((b) => /반포대(교|로)/.test(b.n) && !b.rail).map((b) => P2(b.p)).filter((pts) => pts.some(([x, z]) => this.inWater(x, z))).sort((a, b) => len(b) - len(a))[0];
    if (br) { const pos = [], vel = [], hue = [], jets = []; let acc = 0; for (let i = 1; i < br.length; i++) { const [ax, az] = br[i - 1], [bx, bz] = br[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue; const ux = (bx - ax) / L, uz = (bz - az) / L; for (let t = 0; t < L; t += 2.2) { const x = ax + ux * t, z = az + uz * t; if (!this.inWater(x, z)) continue; for (const sd of [-1, 1]) jets.push({ x: x - uz * sd * 13, z: z + ux * sd * 13, nx: -uz * sd, nz: ux * sd, h: (acc + t) / 1100 }); } acc += L; }
      const PER = 12, N = jets.length * PER, P = new Float32Array(N * 3), C = new Float32Array(N * 3); jets.forEach((j, k) => { for (let q = 0; q < PER; q++) { const idx = k * PER + q; P[idx * 3] = j.x; P[idx * 3 + 1] = -100; P[idx * 3 + 2] = j.z; } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
      const m = new THREE.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, map: (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })() });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false; this.scene.add(pts); this.fountain = { pts, jets, PER, P, C, t: 0 }; }
    // 세빛섬: 섬 구역 안 건물마다 지붕선 · 중간 띠 LED (밤에 색이 천천히 바뀐다)
    const isl = (M.areas || []).filter(([n]) => /빛섬/.test(n)).map(([n, ...f]) => unpack(f, M.scale)); const lines = [];
    for (const f of this.foot || []) { let cx = 0, cz = 0; for (const [x, z] of f.ring) { cx += x; cz += z; } cx /= f.ring.length; cz /= f.ring.length; if (!isl.some((r2) => inRing(cx, cz, r2))) continue; for (const y of [f.h + 0.1, f.h * 0.5]) lines.push(f.ring.map(([x, z]) => new THREE.Vector3(x, y, z))); }
    if (lines.length) { this.sebit = lines.map((pts2) => { const m = new THREE.LineBasicMaterial({ color: '#ff6fb5', transparent: true, opacity: 0.2 }); this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...pts2, pts2[0]]), m)); return m; }); }
  }
  // 위도 · 경도 → 지도 좌표
  ll(lat, lon) { const KX = 111320 * Math.cos((37.53 * Math.PI) / 180); return [(lon - 126.98) * KX - this.map.center[0], -(lat - 37.53) * 110574 - this.map.center[1]]; }
  // 뚝섬 음악분수: 둥근 광장 · 가운데 높은 물기둥 + 두 겹 고리 물줄기가 박자에 맞춰 춤춘다 (공연 시간 · 밤엔 색조명)
  buildMusicFountain([x, z]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); this.scene.add(g);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(22, 48), new THREE.MeshLambertMaterial({ color: '#cfc8bb' })); plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; g.add(plaza);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshPhongMaterial({ color: '#7fb8d0', shininess: 100 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; g.add(pool);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.3, 6, 64), new THREE.MeshLambertMaterial({ color: '#e8e4dc' })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.2; g.add(rim);
    const jets = [{ r: 0, a: 0, ring: 0 }]; for (let i = 0; i < 16; i++) jets.push({ r: 5, a: (i / 16) * Math.PI * 2, ring: 1 }); for (let i = 0; i < 28; i++) jets.push({ r: 10, a: (i / 28) * Math.PI * 2, ring: 2 });
    const PER = 16, N = jets.length * PER, P = new Float32Array(N * 3), C = new Float32Array(N * 3); for (let i = 0; i < N; i++) P[i * 3 + 1] = -100;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; g.add(pts);
    this.mfount = { g, jets, PER, P, C, pts, t: 0 }; this.addCircle(x, z, 14.3, 0.4);
  }
  tickMusicFountain(dt, lit) {
    const F = this.mfount; if (!F) return; const h = this.state.hour, on = (h >= 12 && h < 12.5) || (h >= 19.5 && h < 21.5); F.t += dt; const col = new THREE.Color(), beat = F.t * 2.1, pa = F.pts.geometry.attributes.position, ca = F.pts.geometry.attributes.color;
    F.jets.forEach((j, k) => { const hgt = j.ring === 0 ? 9 + Math.sin(beat * 0.5) * 5 : j.ring === 1 ? 3.5 + Math.max(0, Math.sin(beat + j.a * 2)) * 4 : 2 + Math.max(0, Math.sin(beat * 1.3 - j.a * 3)) * 3, lean = j.ring === 2 ? Math.sin(beat * 0.7) * 0.6 : 0;
      for (let q = 0; q < F.PER; q++) { const i = k * F.PER + q; if (!on) { F.P[i * 3 + 1] = -100; continue; } const life = 1.6, tt = (F.t + q * (life / F.PER) + k * 0.05) % life, v = Math.sqrt(2 * 9.8 * hgt), y = v * tt - 4.9 * tt * tt, out = lean * tt * 3;
        F.P[i * 3] = Math.cos(j.a) * (j.r + out); F.P[i * 3 + 1] = Math.max(0.1, y); F.P[i * 3 + 2] = Math.sin(j.a) * (j.r + out); if (lit > 0.3) col.setHSL((j.ring * 0.22 + F.t * 0.05 + (j.a / 6.28) * 0.3) % 1, 0.85, 0.62); else col.setRGB(0.88, 0.94, 1); F.C[i * 3] = col.r; F.C[i * 3 + 1] = col.g; F.C[i * 3 + 2] = col.b; } });
    pa.needsUpdate = true; ca.needsUpdate = true;
  }
  // 홍대 경의선숲길(연트럴파크): 구역 안 잔디 · 가운데 옛 철길(레일 두 줄 · 침목) · 양옆 줄지은 나무 · 벤치 · 가로등 불빛, 풀밭에 앉은 곰들
  buildForestPath(r) {
    const A = (this.map.areas || []).filter(([n]) => /경의선/.test(n)).map(([n, ...f]) => unpack(f, this.map.scale)); if (!A.length) return;
    for (const ring of A) {
      // 구역의 긴 축을 따라 가운데 선
      let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; } const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang);
      const pr = ring.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), a0 = Math.min(...pr), a1 = Math.max(...pr), NB = Math.max(4, Math.round((a1 - a0) / 15)), mid = [];
      for (let i = 0; i <= NB; i++) { const a = a0 + (i / NB) * (a1 - a0); const bs = ring.map(([x, z]) => ({ a: (x - cx) * ux + (z - cz) * uz, b: -(x - cx) * uz + (z - cz) * ux })).filter((p) => Math.abs(p.a - a) < (a1 - a0) / NB); if (bs.length < 2) continue; const b = (Math.min(...bs.map((p) => p.b)) + Math.max(...bs.map((p) => p.b))) / 2; mid.push([cx + ux * a - uz * b, cz + uz * a + ux * b]); }
      if (mid.length < 2) continue;
      const P = [], I = []; ribbonInto(P, I, mid, 2.4, 0); const bed = new THREE.Mesh(geoOf(P, I), flatMat('#a39684', -48.2)); bed.renderOrder = -48.2; this.scene.add(bed);
      const sl = []; for (const sd of [-0.55, 0.55]) { const q = mid.map((p, i) => { const a = mid[Math.max(0, i - 1)], c = mid[Math.min(mid.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1; return new THREE.Vector3(p[0] - dz / L * sd, 0.06, p[1] + dx / L * sd); }); sl.push(...q.slice(0, -1).flatMap((v, i) => [v, q[i + 1]])); } this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sl), new THREE.LineBasicMaterial({ color: '#8a8f96' })));
      // 침목 · 나무 · 벤치 (인스턴스)
      const ties = [], trees = [], benches = [];
      for (let i = 1; i < mid.length; i++) { const [ax, az] = mid[i - 1], [bx, bz] = mid[i], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L; for (let t = 0; t < L; t += 0.8) ties.push([ax + dx * t, az + dz * t, Math.atan2(dx, dz)]); for (let t = r() * 6; t < L; t += 7 + r() * 3) for (const sd of [-1, 1]) { const off = sd * (4 + r() * 2.5); trees.push([ax + dx * t - dz * off, az + dz * t + dx * off]); if (r() < 0.25) benches.push([ax + dx * t - dz * sd * 2.3, az + dz * t + dx * sd * 2.3, Math.atan2(dx, dz)]); } }
      const o = new THREE.Object3D(), tieG = new THREE.BoxGeometry(1.8, 0.08, 0.22); tieG.translate(0, 0.04, 0); const tim = new THREE.InstancedMesh(tieG, new THREE.MeshLambertMaterial({ color: '#6b5a48' }), ties.length); ties.forEach(([x, z, ry], i) => { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.updateMatrix(); tim.setMatrixAt(i, o.matrix); }); this.scene.add(tim);
      (this.extraTrees ||= []).push(...trees);
      const bG = new THREE.BoxGeometry(1.7, 0.08, 0.5); bG.translate(0, 0.45, 0); const bim = new THREE.InstancedMesh(bG, new THREE.MeshLambertMaterial({ color: '#b98a5a' }), benches.length); benches.forEach(([x, z, ry], i) => { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.updateMatrix(); bim.setMatrixAt(i, o.matrix); this.addCircle(x, z, 0.5, 0.5); }); this.scene.add(bim);
      // 풀밭에 앉아 쉬는 곰들 (연트럴파크 피크닉)
      for (let k = 0; k < Math.min(14, mid.length); k++) { const p = mid[Math.floor(r() * mid.length)], sd = r() < 0.5 ? -1 : 1, b = this.mkBear(r() < 0.5 ? 'street' : 'stroll', r, 0.95); b.root.position.set(p[0] + sd * (2.5 + r() * 2), 0, p[1] + (r() - 0.5) * 3); b.root.rotation.y = r() * 6.28; b.root.userData.sit = true; (this.picnic ||= []).push(b); }
    }
  }
  // 홍대 벽화: 골목 쪽 상가 벽에 그래피티 (큰 글자 · 물방울 · 얼굴 · 별 · 줄무늬, 색 여러 가지), 그림 16장을 한 장에 그려 돌려 쓴다
  buildMurals(r) {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const c = cv.getContext('2d'), W = 512, H = 256, pal = [['#ff4d9a', '#ffd23f', '#3de0ff'], ['#7b5cff', '#29d0c8', '#fff1a8'], ['#ff7a3d', '#1d1d1f', '#ffffff'], ['#7cff6b', '#2f6bff', '#ff4d6d'], ['#ffd6e6', '#b57bff', '#1d1d1f'], ['#ffb020', '#c0392b', '#2f7a5a']], words = ['HONGDAE', 'LOVE', 'PLAY', 'JELLY', 'DREAM', '홍대', 'MUSIC', 'ART'];
    for (let k = 0; k < 16; k++) { const x0 = (k % 4) * W, y0 = Math.floor(k / 4) * H, [a, b, d] = pal[k % pal.length], kind = k % 4;
      c.fillStyle = b; c.fillRect(x0, y0, W, H); c.save(); c.beginPath(); c.rect(x0, y0, W, H); c.clip();
      for (let i = 0; i < 18; i++) { c.fillStyle = [a, d][i % 2]; c.globalAlpha = 0.25; c.beginPath(); c.arc(x0 + r() * W, y0 + r() * H, 10 + r() * 40, 0, 7); c.fill(); } c.globalAlpha = 1;
      if (kind === 0 || kind === 2) { c.font = `bold ${kind ? 110 : 96}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 14; c.strokeStyle = '#1d1d1f'; const w = words[k % words.length]; c.strokeText(w, x0 + W / 2, y0 + H / 2 + 6); c.fillStyle = a; c.fillText(w, x0 + W / 2, y0 + H / 2 + 6); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText(w, x0 + W / 2 - 4, y0 + H / 2 + 2); }
      else if (kind === 1) { const fx = x0 + W / 2, fy = y0 + H / 2; c.fillStyle = a; c.beginPath(); c.arc(fx, fy, 90, 0, 7); c.fill(); c.lineWidth = 8; c.strokeStyle = '#1d1d1f'; c.stroke(); c.fillStyle = '#1d1d1f'; c.beginPath(); c.arc(fx - 30, fy - 15, 12, 0, 7); c.arc(fx + 30, fy - 15, 12, 0, 7); c.fill(); c.beginPath(); c.arc(fx, fy + 15, 40, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); c.fillStyle = a; c.beginPath(); c.arc(fx - 70, fy - 75, 30, 0, 7); c.arc(fx + 70, fy - 75, 30, 0, 7); c.fill(); }
      else { for (let i = 0; i < 9; i++) { c.fillStyle = [a, d, '#1d1d1f'][i % 3]; c.fillRect(x0 + i * 60 - 20, y0, 34, H); } c.fillStyle = d; for (let i = 0; i < 6; i++) { const sx = x0 + 60 + r() * (W - 120), sy = y0 + 40 + r() * (H - 80); c.beginPath(); for (let q = 0; q < 10; q++) { const ang = q * Math.PI / 5, rr = q % 2 ? 12 : 30; c.lineTo(sx + Math.cos(ang) * rr, sy + Math.sin(ang) * rr); } c.fill(); } }
      for (let i = 0; i < 6; i++) { c.fillStyle = a; c.fillRect(x0 + r() * W, y0 + r() * H * 0.3 + H * 0.7, 3, 10 + r() * 30); } c.restore(); }
    const tex2 = new THREE.CanvasTexture(cv); tex2.colorSpace = THREE.SRGBColorSpace; tex2.anisotropy = 4;
    const alleyPts = (this.map.alleys || []).map(([w, ...f]) => unpack(f, this.map.scale)); const nearAlley = (x, z) => alleyPts.some((pts) => pts.some(([ax, az]) => Math.abs(ax - x) < 14 && Math.abs(az - z) < 14));
    const P = [], U = [], I = []; let n = 0;
    for (const f of this.foot || []) { if (!(f.type === 'street' || f.type === 'street2') || f.h < 6 || n > 140) continue; const ring = f.ring, sg = ringArea(ring) > 0 ? 1 : -1;
      for (let k = 0; k < ring.length; k++) { const A = ring[k], B = ring[(k + 1) % ring.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 6 || r() > 0.3) continue; const nx = (sg > 0 ? B[1] - A[1] : A[1] - B[1]) / L, nz = (sg > 0 ? A[0] - B[0] : B[0] - A[0]) / L, mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2; if (!nearAlley(mx, mz)) continue;
        let tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L; if (tx * nz - tz * nx < 0) { tx = -tx; tz = -tz; } const w = Math.min(L * 0.9, 12), y0 = 4.0, h = Math.min(f.h - y0 - 0.6, w / 2); if (h < 2.2) continue; const k2 = Math.floor(r() * 16); const u0 = (k2 % 4) / 4, v1 = 1 - Math.floor(k2 / 4) / 4, v0 = v1 - 0.25, b = P.length / 3, ox = mx + nx * 0.09, oz = mz + nz * 0.09;
        P.push(ox - tx * w / 2, y0, oz - tz * w / 2, ox + tx * w / 2, y0, oz + tz * w / 2, ox + tx * w / 2, y0 + h, oz + tz * w / 2, ox - tx * w / 2, y0 + h, oz - tz * w / 2); U.push(u0, v0, u0 + 0.25, v0, u0 + 0.25, v1, u0, v1); I.push(b, b + 1, b + 2, b, b + 2, b + 3); n++; break; } }
    if (!P.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    this.scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }))); this.murals = n;
  }
  tickBanpo(dt, lit) {
    const h = this.state.hour, F = this.fountain; this.sebit?.forEach((m, i) => { m.color.setHSL(((this.time * 0.03 + i * 0.07) % 1), 0.85, 0.6); m.opacity = 0.15 + lit * 0.85; });
    if (!F) return; const on = (h >= 12 && h < 12.4) || (h >= 19.5 && h < 21.5); F.t += dt; const col = new THREE.Color(), G = 9.8, pa = F.pts.geometry.attributes.position, ca = F.pts.geometry.attributes.color;
    F.jets.forEach((j, k) => { for (let q = 0; q < F.PER; q++) { const idx = k * F.PER + q; if (!on) { F.P[idx * 3 + 1] = -100; continue; } const life = 2.6, tt = ((F.t + q * (life / F.PER) + k * 0.013) % life), v0 = 8.5, y = 12.5 + 1.2 * tt - 0.5 * G * tt * tt; F.P[idx * 3] = j.x + j.nx * v0 * tt; F.P[idx * 3 + 1] = Math.max(-0.5, y); F.P[idx * 3 + 2] = j.z + j.nz * v0 * tt; if (lit > 0.3) col.setHSL((j.h * 3 + this.time * 0.05) % 1, 0.9, 0.62); else col.setRGB(0.85, 0.92, 1); F.C[idx * 3] = col.r; F.C[idx * 3 + 1] = col.g; F.C[idx * 3 + 2] = col.b; } });
    pa.needsUpdate = true; ca.needsUpdate = true;
  }
  // 골목 (거리 지역): 회색 아스팔트 골목 · 전봇대와 처진 전깃줄 · 가끔 변압기 · 세워 둔 스쿠터 · 쓰레기봉투
  buildAlleys(P2, r) {
    const al = (this.map.alleys || []).map(([w, ...f]) => ({ w, pts: P2(f) })).filter((a) => a.pts.length > 1); if (!al.length) return;
    { const P = [], I = [], U = []; for (const a of al) ribbonInto(P, I, a.pts, a.w, 0, U); const t = groundTex('city'); const m = new THREE.Mesh(geoOf(P, I, { uv: [U, 2] }), flatMat('#8a8784', -50.05, { map: t })); m.renderOrder = -50.05; this.scene.add(m); }
    // 전봇대: 골목 한쪽을 따라 22m 마다, 전깃줄은 이웃 전봇대끼리 처지게 세 가닥
    const poles = [], wire = [], scoot = [], bags = []; const sag = (A, B, h0, k) => { const n = 7; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, y = (t) => h0 - Math.sin(t * Math.PI) * k; wire.push(A[0] + (B[0] - A[0]) * t0, y(t0), A[1] + (B[1] - A[1]) * t0, A[0] + (B[0] - A[0]) * t1, y(t1), A[1] + (B[1] - A[1]) * t1); } };
    for (const a of al) { let carry = r() * 22, prev = null; const side = r() < 0.5 ? 1 : -1;
      for (let i = 1; i < a.pts.length; i++) { const [ax, az] = a.pts[i - 1], [bx, bz] = a.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue; const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * side, nz = ux * side;
        for (let t = carry; t < L; t += 22) { const p = [ax + ux * t + nx * (a.w / 2 + 0.45), az + uz * t + nz * (a.w / 2 + 0.45)]; if (this.groundAt(p[0], p[1], 9999) > 0) continue; poles.push([p[0], p[1], Math.atan2(ux, uz), r() < 0.25, -nx, -nz]); if (prev && Math.hypot(prev[0] - p[0], prev[1] - p[1]) < 40) for (const [dy, k, off] of [[8.3, 0.7, -0.6], [8.3, 0.8, 0.6], [7.6, 1.1, 0]]) sag([prev[0] + ux * 0 + -uz * off, prev[1] + uz * 0 + ux * off], [p[0] - uz * off, p[1] + ux * off], dy, k); prev = p; carry = t + 22 - L; }
        for (let t = r() * 30; t < L; t += 30 + r() * 30) { const q = [ax + ux * t - nx * (a.w / 2 - 0.5), az + uz * t - nz * (a.w / 2 - 0.5)]; if (r() < 0.55) scoot.push([q[0], q[1], Math.atan2(ux, uz) + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.4, Math.floor(r() * 5)]); else bags.push([q[0], q[1]]); } } }
    const o = new THREE.Object3D(), mk = (g, m, list, fn) => { if (!list.length) return null; const im = new THREE.InstancedMesh(g, m, list.length); list.forEach((it, i) => { fn(it); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); this.scene.add(im); return im; };
    const poleG = new THREE.CylinderGeometry(0.13, 0.19, 9, 8); poleG.translate(0, 4.5, 0); const armG = new THREE.BoxGeometry(1.6, 0.1, 0.1); armG.translate(0, 8.3, 0); const trG = new THREE.CylinderGeometry(0.28, 0.28, 0.8, 10); trG.translate(0.35, 7.0, 0);
    mk(poleG, new THREE.MeshLambertMaterial({ color: '#b9b4ab' }), poles, ([x, z]) => { o.position.set(x, 0, z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); }); mk(armG, new THREE.MeshLambertMaterial({ color: '#6a6e74' }), poles, ([x, z, ry]) => { o.position.set(x, 0, z); o.rotation.set(0, ry + Math.PI / 2, 0); });
    mk(trG, new THREE.MeshLambertMaterial({ color: '#8f969c' }), poles.filter((p) => p[3]), ([x, z, ry]) => { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); }); for (const [x, z] of poles) this.addCircle(x, z, 0.2, 9);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); this.scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#2a2a2c' })));
    // 보안등: 전봇대마다 골목 쪽으로 내민 팔 끝 등 (밤에 주황빛) + 바닥의 둥근 불빛 웅덩이 (빛 계산 없이 그림 한 장으로)
    if (poles.length) { const lg = new THREE.BoxGeometry(0.34, 0.16, 0.7); lg.translate(0, 6.3, 0); const ag = new THREE.BoxGeometry(0.06, 0.06, 1.2); ag.translate(0, 6.45, -0.45);
      this.alleyLampM = new THREE.MeshLambertMaterial({ color: '#d8d4cc', emissive: '#ffb45a', emissiveIntensity: 0 });
      mk(lg, this.alleyLampM, poles, ([x, z, , , ax, az]) => { o.position.set(x + ax * 1.05, 0, z + az * 1.05); o.rotation.set(0, Math.atan2(ax, az), 0); o.scale.set(1, 1, 1); });
      mk(ag, new THREE.MeshLambertMaterial({ color: '#6a6e74' }), poles, ([x, z, , , ax, az]) => { o.position.set(x + ax * 1.05, 0, z + az * 1.05); o.rotation.set(0, Math.atan2(ax, az), 0); o.scale.set(1, 1, 1); });
      const pool = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,170,80,1)'); gr.addColorStop(0.45, 'rgba(255,150,70,0.4)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
      const pg = new THREE.PlaneGeometry(9, 9); pg.rotateX(-Math.PI / 2); pg.translate(0, 0.08, 0);
      this.alleyGlowM = new THREE.MeshBasicMaterial({ map: pool, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const gim = mk(pg, this.alleyGlowM, poles, ([x, z, , , ax, az]) => { o.position.set(x + ax * 1.6, 0, z + az * 1.6); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); }); if (gim) { gim.renderOrder = 5; gim.frustumCulled = true; } }
    // 스쿠터: 몸통 · 앞 · 바퀴 둘 (색 다섯 가지), 쓰레기봉투: 흰 · 검은 봉투 덩어리
    const scG = (() => { const gs = []; const b = new THREE.BoxGeometry(0.42, 0.42, 1.1); b.translate(0, 0.55, 0); gs.push(b); const f = new THREE.BoxGeometry(0.38, 0.75, 0.22); f.translate(0, 0.8, 0.5); gs.push(f); const s2 = new THREE.BoxGeometry(0.36, 0.12, 0.6); s2.translate(0, 0.82, -0.15); gs.push(s2); for (const z of [-0.48, 0.55]) { const w = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12); w.rotateZ(Math.PI / 2); w.translate(0, 0.22, z); gs.push(w); } return mergeGeos(gs); })();
    const sim = mk(scG, new THREE.MeshLambertMaterial({ color: '#ffffff' }), scoot, ([x, z, ry]) => { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); }); if (sim) { const c = new THREE.Color(); scoot.forEach((sc, i) => sim.setColorAt(i, c.set(['#e8e4dc', '#d8352a', '#2f6bff', '#1d1d1f', '#7be07b'][sc[3]]))); }
    for (const [x, z] of scoot) this.addCircle(x, z, 0.45, 1);
    const bg = new THREE.IcosahedronGeometry(0.32, 0); bg.scale(1, 0.85, 1); bg.translate(0, 0.27, 0); const bim = mk(bg, new THREE.MeshLambertMaterial({ color: '#ffffff' }), bags.flatMap(([x, z]) => [[x, z], [x + 0.4, z + 0.2], [x - 0.1, z + 0.45]]), ([x, z]) => { o.position.set(x, 0, z); o.rotation.set(0, 0, 0); o.scale.setScalar(0.8 + Math.random() * 0.4); }); if (bim) { const c = new THREE.Color(); for (let i = 0; i < bim.count; i++) bim.setColorAt(i, c.set(i % 3 === 1 ? '#1d1d1f' : '#f2f0ea')); } o.scale.set(1, 1, 1);
  }
  // 거리 지역 간판: 길을 바라보는 낮은 상가 벽마다 1층 간판 띠 + 2 · 3층 가로 간판 (그 동네 실제 가게 이름, 스타일 여러 가지)
  // 진짜 가게 간판 (소상공인 상가정보): 가게가 실제로 있는 건물의 길 쪽 벽에, 실제 층에. 1층은 가로 간판 + 들어갈 수 있는 문, 2층 위는 창문 글씨 간판
  // 칸 만들기 중에 화면이 멈추지 않게 8ms 일할 때마다 쉬어 간다(yield)
  *buildRealSigns(nearRoad, r) {
    let t0 = performance.now();
    const M = this.map, byB = new Map(); for (const s2 of M.shops2) { let L = byB.get(s2[2]); if (!L) byB.set(s2[2], (L = [])); L.push(s2); }
    // 업종마다 간판 색 (바탕, 글씨): 실제 서울 간판에서 흔한 조합
    const ST = { cafe: [['#f4efe6', '#3b2a1e'], ['#2f5d4a', '#ffffff'], ['#1b1820', '#f2e6d0']], bakery: [['#fff3d6', '#7a3b2e'], ['#b5733d', '#ffffff']], korean: [['#7a3b2e', '#fff3d6'], ['#ffffff', '#c0392b'], ['#1f2a44', '#ffd23f'], ['#fff7c2', '#b8322a']], chicken: [['#ffd23f', '#c0392b'], ['#d8752a', '#ffffff']], pizza: [['#b8322a', '#ffffff'], ['#2f7a5a', '#ffffff']], burger: [['#c0392b', '#ffd23f']], chinese: [['#a8231d', '#ffd23f']], japanese: [['#2b2b2b', '#f4efe6'], ['#f4efe6', '#2b2b2b']], pub: [['#1b1820', '#ffb347'], ['#3b2a22', '#ffe2b0'], ['#2a2a6a', '#ff9ec0']], western: [['#f4efe6', '#2f5d4a'], ['#1b1820', '#ffffff']], mart: [['#2f7fd8', '#ffffff'], ['#ffffff', '#1f9d55'], ['#6a2bb8', '#ffffff']],
      pharm: [['#1f9d55', '#ffffff']], hair: [['#ffffff', '#b8326a'], ['#1b1820', '#ff9ec0'], ['#f2c6cf', '#5a2a3a']], clinic: [['#ffffff', '#1f4fa8'], ['#1f4fa8', '#ffffff']], academy: [['#1f4fa8', '#ffffff'], ['#ffffff', '#2f7fd8'], ['#ff8a3d', '#ffffff']], realty: [['#ffffff', '#c0392b'], ['#ffd23f', '#1b1820']], cloth: [['#1b1820', '#ffffff'], ['#ffffff', '#1b1820']], super: [['#2f7a5a', '#ffffff'], ['#c0392b', '#ffffff']], laundry: [['#3db8ff', '#ffffff']], flower: [['#ffffff', '#2f7a5a']], motel: [['#6a2bb8', '#ffd23f']], store: [['#ffffff', '#1f4fa8'], ['#ffd23f', '#1b1820'], ['#2f7a5a', '#ffffff']], repair: [['#ffffff', '#1b1820']], sport: [['#1b1820', '#3db8ff']], office: [['#ffffff', '#1f4fa8'], ['#e8e8e4', '#2b2b2b']] };
    const list = [], up = [], doors = [], blades = [];
    // 세로 돌출 간판이 잘 붙는 업종 (병원 · 학원 · 술집 · 미용실 · 모텔 · 노래방처럼 위층 가게)
    const BLADE = { clinic: 3, academy: 3, pub: 3, hair: 2, motel: 3, pharm: 2, korean: 1, cafe: 1, store: 1, office: 1, sport: 2 };
    for (const f of this.foot) {
      if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
      const L0 = f.bi === undefined ? null : byB.get(f.bi); if (!L0 || f.h < 3 || f.mh || f.type === 'glass' || f.type === 'gold') continue; // 공중에 뜬 건물 조각(아래가 비었다)엔 1층 간판 · 문을 달지 않는다
      const ring = f.ring, sg = ringArea(ring) > 0 ? 1 : -1, by = f.base === undefined ? NaN : f.base, edges = [];
      for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3) continue; const nx = (sg > 0 ? c[1] - a[1] : a[1] - c[1]) / L, nz = (sg > 0 ? a[0] - c[0] : c[0] - a[0]) / L, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; let tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L; if (tx * nz - tz * nx < 0) { tx = -tx; tz = -tz; } edges.push({ L, nx, nz, mx, mz, tx, tz, d: nearRoad(mx + nx * 2, mz + nz * 2) }); }
      if (!edges.length) continue; edges.sort((a, b) => (a.d > 10) - (b.d > 10) || b.L - a.L); const front = edges.filter((e) => e.d <= 10); if (!front.length) front.push(edges[0]);
      const g1 = L0.filter((s2) => s2[3] <= 1), cap = front.reduce((n, e) => n + Math.max(1, Math.floor(e.L / 4.5)), 0);
      // 1층: 길 쪽 벽들을 가게 수만큼 나눠 쓴다
      let gi = 0; for (const e of front) { const n = Math.max(1, Math.floor(e.L / 4.5)), k0 = Math.min(n, g1.length - gi); if (k0 <= 0) break; const w = e.L / k0;
        for (let q = 0; q < k0; q++, gi++) { const s2 = g1[gi], off = -e.L / 2 + w * (q + 0.5), x = e.mx + e.tx * off, z = e.mz + e.tz * off, pal = ST[s2[1]] || ST.store, st = pal[Math.floor(r() * pal.length)];
          if (this.shopFronts.some((F) => !F.real && Math.abs(F.x - x) < 3.5 && Math.abs(F.z - z) < 3.5)) continue; // 오픈스트리트맵 가게(차양 · 간판이 따로 있는 곳)와 겹치지 않게
          list.push({ x: x + e.nx * 0.14, z: z + e.nz * 0.14, tx: e.tx, tz: e.tz, w: Math.min(w * 0.9, 9), y0: s2[3] === 0 ? 0.5 : 2.95, y1: s2[3] === 0 ? 1.15 : 3.75, n: s2[0], bg: st[0], fg: st[1], by, box: s2[3] === 1 });
          if (s2[3] === 1 && SHOP_KIND[s2[1]] && w > 2.4 && !this.shopFronts.some((F) => Math.abs(F.x - x) < 3 && Math.abs(F.z - z) < 3)) doors.push({ name: s2[0], kind: s2[1], x: x + e.nx * 0.05, z: z + e.nz * 0.05, nx: e.nx, nz: e.nz, by, real: 1 }); } }
      void cap;
      // 2층 위: 그 층 창문에 글씨 간판 (층 높이 3.3m)
      const perFl = {}, cntFl = {}; for (const s2 of L0) cntFl[s2[3]] = (cntFl[s2[3]] || 0) + 1; for (const s2 of L0) { if (s2[3] < 2) continue; const yc = (s2[3] - 1) * 3.3 + 1.7; if (yc > f.h - 0.8) continue; const e = front[(perFl[s2[3]] || 0) % front.length], j = Math.floor((perFl[s2[3]] || 0) / front.length); perFl[s2[3]] = (perFl[s2[3]] || 0) + 1; if (j > 1) continue; const w = Math.min(e.L * (j || front.length > 1 ? 0.42 : 0.6), 5.5), off = (cntFl[s2[3]] > front.length ? (j ? 1 : -1) : 0) * clamp(e.L * 0.25, 0, Math.max(0, e.L / 2 - w / 2 - 0.3)), pal = ST[s2[1]] || ST.office, st = pal[Math.floor(r() * pal.length)];
        up.push({ x: e.mx + e.tx * off + e.nx * 0.12, z: e.mz + e.tz * off + e.nz * 0.12, tx: e.tx, tz: e.tz, w, y0: yc - 0.45, y1: yc + 0.45, n: s2[0], bg: st[0], fg: st[1], by, fl: s2[3] }); }
      // 세로 돌출 간판: 위층 가게가 있는 4m 넘는 건물, 길 쪽 벽 끝에 벽과 직각으로 (양면 글씨, 위층 가게 이름)
      const upS = L0.filter((s2) => s2[3] >= 2 && [...s2[0]].filter((ch) => ch.trim()).length >= 2).sort((p, q) => (BLADE[q[1]] || 0) - (BLADE[p[1]] || 0));
      if (upS.length && f.h > 7.5 && front[0].L > 5) { const e = front[0], s2 = upS[0], nch = [...s2[0]].filter((ch) => ch.trim()).length, side = r() < 0.5 ? 1 : -1, off = side * (e.L / 2 - 0.55), pal = ST[s2[1]] || ST.office, st = pal[Math.floor(r() * pal.length)], y0 = 4.1, y1 = Math.min(f.h - 0.5, y0 + clamp(nch * 0.82 + 0.5, 2.4, 7.5));
        if (y1 - y0 > 1.8) blades.push({ x: e.mx + e.tx * off + e.nx * 0.95, z: e.mz + e.tz * off + e.nz * 0.95, tx: e.nx, tz: e.nz, wtx: e.tx, wtz: e.tz, w: 1.2, y0, y1, n: s2[0], bg: st[0], fg: st[1], by, vert: 1 }); }
    }
    // 한 칸 간판 7,000개까지: 1층 먼저, 낮은 층부터
    // 휴대폰: 1층 간판만 2,500개까지 (메모리 · 그리기 줄이기)
    up.sort((a, b) => a.fl - b.fl); const all = isPhone ? list.slice(0, 2500) : [...list, ...blades.slice(0, 1500), ...up].slice(0, 7000);
    if (doors.length) { const o = new THREE.Object3D(), fg = new THREE.BoxGeometry(1.9, 2.5, 0.1); fg.translate(0, 1.25, 0.02); const dg = new THREE.PlaneGeometry(1.6, 2.3); dg.translate(0, 1.15, 0.08); const fm = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: '#2b2d31' }), doors.length), dm = new THREE.InstancedMesh(dg, new THREE.MeshPhongMaterial({ color: '#d8c8a8', emissive: '#ffd9a0', emissiveIntensity: 0.25, shininess: 80 }), doors.length);
      doors.forEach((D, i) => { o.position.set(D.x, 0, D.z); o.rotation.y = Math.atan2(D.nx, D.nz); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); dm.setMatrixAt(i, o.matrix); D.key = this.chunkKey; const fi = this.shopFronts.push(D) - 1, k = `${Math.floor(D.x / 40)},${Math.floor(D.z / 40)}`; if (!this.shopGrid.has(k)) this.shopGrid.set(k, []); this.shopGrid.get(k).push(fi); });
      fm.userData.baseY = dm.userData.baseY = doors.map((D) => D.by); this.scene.add(fm, dm); }
    if (globalThis.__hgTest) this.realSigns = all; // 시험 페이지에서만
    // 바탕 판(꼭짓점 색) 한 덩어리 + 글자 조각(글자 그림 한 장) 한 덩어리 = 칸마다 그리기 2번
    const B = { P: [], C: [], I: [], Y: [] }, T = { P: [], C: [], U: [], I: [], Y: [] }, col = new THREE.Color();
    const quad = (G, S, a0, a1, y0, y1, dz, c, uv) => { const k = G.P.length / 3, nx = -S.tz, nz = S.tx; for (const [a, y] of [[a0, y0], [a1, y0], [a1, y1], [a0, y1]]) { G.P.push(S.x + S.tx * a + nx * dz, y, S.z + S.tz * a + nz * dz); G.C.push(c.r, c.g, c.b); G.Y.push(S.by); } if (uv) G.U.push(uv.u0, uv.v0, uv.u1, uv.v0, uv.u1, uv.v1, uv.u0, uv.v1); G.I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
    // 간판 틀: 바닥 · 윗면(수평 판)과 양 끝 (상자 간판 두께)
    const hquad = (G, S, a0, a1, y, d0, d1, c) => { const k = G.P.length / 3, nx = -S.tz, nz = S.tx; for (const [a, d] of [[a0, d0], [a1, d0], [a1, d1], [a0, d1]]) { G.P.push(S.x + S.tx * a + nx * d, y, S.z + S.tz * a + nz * d); G.C.push(c.r, c.g, c.b); G.Y.push(S.by); } G.I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
    const capq = (G, S, a, d0, d1, y0, y1, c) => quad(G, { x: S.x + S.tx * a + -S.tz * (d0 + d1) / 2, z: S.z + S.tz * a + S.tx * (d0 + d1) / 2, tx: -S.tz, tz: S.tx, by: S.by }, -(d1 - d0) / 2, (d1 - d0) / 2, y0, y1, 0, c);
    const frameC = new THREE.Color();
    for (const S of all) {
      if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
      const hw = S.w / 2, H = S.y1 - S.y0, chars0 = [...S.n].filter((ch) => ch.trim());
      if (S.vert) {
        // 세로 간판: 두 면 (뒷면은 방향을 뒤집어 글씨가 거울처럼 보이지 않게) + 바깥 끝 틀
        frameC.set(S.bg).multiplyScalar(0.55); const back = { ...S, tx: -S.tx, tz: -S.tz };
        for (const F of [S, back]) { col.set(S.bg); quad(B, F, -hw, hw, S.y0, S.y1, 0.12, col); }
        quad(B, { x: S.x + S.tx * hw, z: S.z + S.tz * hw, tx: S.wtx, tz: S.wtz, by: S.by }, -0.12, 0.12, S.y0, S.y1, 0, frameC); hquad(B, S, -hw, hw, S.y0, -0.12, 0.12, frameC); hquad(B, S, -hw, hw, S.y1, -0.12, 0.12, frameC);
        const gs = chars0.map((ch) => glyph(ch)), n = gs.length; if (!n) continue; const cs = Math.min(S.w * 0.72, (H * 0.9) / n), yTop = S.y1 - (H - n * cs) / 2; col.set(S.fg);
        for (const F of [S, back]) gs.forEach((g, k) => { if (g) quad(T, F, -cs / 2, cs / 2, yTop - cs * (k + 1), yTop - cs * k, 0.15, col, g); });
        continue;
      }
      const dz0 = S.box ? 0.16 : 0; col.set(S.bg); quad(B, S, -hw, hw, S.y0, S.y1, dz0, col);
      if (S.box) { frameC.set(S.bg).multiplyScalar(0.5); hquad(B, S, -hw, hw, S.y0, 0, dz0, frameC); hquad(B, S, -hw, hw, S.y1, 0, dz0, frameC); capq(B, S, -hw, 0, dz0, S.y0, S.y1, frameC); capq(B, S, hw, 0, dz0, S.y0, S.y1, frameC); }
      const chars = chars0, gs = chars.map((ch) => glyph(ch)); if (!chars.length) continue;
      let cs = H * 0.78; const tw = () => gs.reduce((n, g) => n + (g ? g.w : 0.5) * cs, 0); if (tw() > S.w * 0.9) cs *= (S.w * 0.9) / tw();
      let a = -tw() / 2; const yc = (S.y0 + S.y1) / 2; col.set(S.fg);
      for (const g of gs) { const gw = (g ? g.w : 0.5) * cs; if (g) { const pad = (cs - gw) / 2; quad(T, S, a - pad, a + gw + pad, yc - cs / 2, yc + cs / 2, dz0 + 0.03, col, g); } a += gw; }
    }
    if (B.P.length) { const mk = (G, m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(G.C, 3)); if (G.U) g.setAttribute('uv', new THREE.Float32BufferAttribute(G.U, 2)); g.setIndex(G.I); g.computeVertexNormals(); g.userData.baseY = new Float32Array(G.Y); const me = new THREE.Mesh(g, m); this.scene.add(me); (this.shopSignMs ||= []).push(m); };
      const mB = signMaterial(false), mT = (glyphTex(), signMaterial(true)); (this.shopSignMs ||= []).push(mB, mT);
      // 1km 칸으로 나눠 650m 밖 간판은 그리지 않는다
      yield; t0 = performance.now();
      for (const [G, m] of [[B, mB], [T, mT]]) for (const part of (yield* splitCellsGen(G, 1000))) { if (performance.now() - t0 > 8) { yield; t0 = performance.now(); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(part.P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(part.C, 3)); if (part.U) g.setAttribute('uv', new THREE.Float32BufferAttribute(part.U, 2)); g.setIndex(part.I); g.computeVertexNormals(); g.userData.baseY = new Float32Array(part.Y); const me = new THREE.Mesh(g, m); me.userData.lodV = [part.cx, part.cz, 650]; me.userData.noMerge = true; this.scene.add(me); } }
  }
  *buildStreetSigns(P2, r) {
    const M = this.map, segs = new Map(), G = 20, addSeg = (a, b, hw) => { const k = `${Math.floor((a[0] + b[0]) / 2 / G)},${Math.floor((a[1] + b[1]) / 2 / G)}`; if (!segs.has(k)) segs.set(k, []); segs.get(k).push([a, b, hw]); };
    for (const rd of M.roads) { const p = P2(rd.slice(2)); for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]), n = Math.max(1, Math.ceil(L / 15)); for (let k = 0; k < n; k++) addSeg([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k / n, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k / n], [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * (k + 1) / n, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (k + 1) / n], rd[0] / 2); } }
    for (const [w, ...f] of M.alleys || []) { const p = P2(f); for (let i = 1; i < p.length; i++) addSeg(p[i - 1], p[i], w / 2); }
    const nearRoad = (x, z) => { let best = Infinity; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [A, B, hw] of segs.get(`${Math.floor(x / G) + a},${Math.floor(z / G) + b}`) || []) { const dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - A[0]) * dx + (z - A[1]) * dz) / L2, 0, 1); best = Math.min(best, Math.hypot(A[0] + dx * t - x, A[1] + dz * t - z) - hw); } return best; };
    if (M.shops2?.length) { yield; yield* this.buildRealSigns(nearRoad, r); return; }
    const pool = (M.shops || []).filter((s2) => s2[0].length >= 2); if (!pool.length) return; const doors = [];
    const list = [];
    for (const f of this.foot || []) { if (!(f.type === 'street' || f.type === 'street2' || f.type === 'factory') || f.h < 4) continue; const ring = f.ring, sg = ringArea(ring) > 0 ? 1 : -1;
      for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3.5) continue; const nx = (sg > 0 ? c[1] - a[1] : a[1] - c[1]) / L, nz = (sg > 0 ? a[0] - c[0] : c[0] - a[0]) / L, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
        if (nearRoad(mx + nx * 2, mz + nz * 2) > 9) continue; const q = this.project(mx, mz); if (Math.abs(q.lat) > (M.kind === 'street' ? 350 : 900)) continue;
        // 바깥에서 볼 때 글씨가 왼쪽 → 오른쪽으로 읽히게 (벽을 마주 본 사람의 오른쪽 = (nz, -nx))
        let tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L; if (tx * nz - tz * nx < 0) { tx = -tx; tz = -tz; } const W1 = Math.min(L * 0.88, 10);
        const shop = pool[Math.floor(r() * pool.length)]; list.push({ x: mx + nx * 0.14, z: mz + nz * 0.14, tx, tz, w: W1, y0: 3.0, y1: 3.75, n: shop[0], st: Math.floor(r() * 5) });
        // 이 1층 가게도 들어갈 수 있게: 간판 가운데 아래 유리문
        if (!this.shopFronts.some((F) => Math.abs(F.x - mx) < 4 && Math.abs(F.z - mz) < 4)) doors.push({ name: shop[0], kind: SHOP_KIND[shop[1]] ? shop[1] : 'korean', x: mx + nx * 0.05, z: mz + nz * 0.05, nx, nz });
        for (let fl = 1; fl <= 2; fl++) if (f.h > 3.4 * (fl + 1) && r() < (fl === 1 ? 0.55 : 0.3)) { const w2 = Math.min(L * 0.6, 6.5), off = (r() - 0.5) * (L - w2) * 0.8; list.push({ x: mx + tx * off + nx * 0.12, z: mz + tz * off + nz * 0.12, tx, tz, w: w2, y0: 3.4 * fl + 1.6, y1: 3.4 * fl + 2.4, n: pool[Math.floor(r() * pool.length)][0], st: Math.floor(r() * 5) }); }
        if (list.length > 1500) break; } if (list.length > 1500) break; }
    // 들어갈 수 있는 문: 짙은 문틀 + 밝은 유리문 (인스턴스 두 개), 가게 목록 · 칸 지도에 더한다
    if (doors.length) { const o = new THREE.Object3D(), fg = new THREE.BoxGeometry(1.9, 2.5, 0.1); fg.translate(0, 1.25, 0.02); const dg = new THREE.PlaneGeometry(1.6, 2.3); dg.translate(0, 1.15, 0.08); const fm = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: '#2b2d31' }), doors.length), dm = new THREE.InstancedMesh(dg, new THREE.MeshPhongMaterial({ color: '#d8c8a8', emissive: '#ffe2b0', emissiveIntensity: 0.2, shininess: 80 }), doors.length);
      doors.forEach((D, i) => { o.position.set(D.x, 0, D.z); o.rotation.y = Math.atan2(D.nx, D.nz); o.updateMatrix(); fm.setMatrixAt(i, o.matrix); dm.setMatrixAt(i, o.matrix); D.key = this.chunkKey; const fi = this.shopFronts.push(D) - 1, k = `${Math.floor(D.x / 40)},${Math.floor(D.z / 40)}`; if (!this.shopGrid.has(k)) this.shopGrid.set(k, []); this.shopGrid.get(k).push(fi); }); this.scene.add(fm, dm); (this.shopWinM ||= []).push(dm.material); }
    // 글씨 그림: 256 × 32 칸, 2048 × 1024 한 장에 256 개
    const PER = 256; for (let s0 = 0; s0 < list.length; s0 += PER) { const part = list.slice(s0, s0 + PER), cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const c = cv.getContext('2d');
      const BG = [['#c0392b', '#ffffff'], ['#ffffff', '#1f4fa8'], ['#1b1820', '#ffd23f'], ['#2f7a5a', '#ffffff'], ['#fff3d6', '#7a3b2e']];
      part.forEach((S, j) => { const x = (j % 8) * 256, y = Math.floor(j / 8) * 32, [bg, fg] = BG[S.st]; c.fillStyle = bg; c.fillRect(x, y, 256, 32); c.fillStyle = fg; c.font = `bold ${S.st === 2 ? 22 : 21}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(S.n, x + 128, y + 17, 240); if (S.st === 2) { c.strokeStyle = fg; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, 250, 26); } });
      const P = [], U = [], I = []; part.forEach((S, j) => { const u0 = (j % 8) / 8, v1 = 1 - Math.floor(j / 8) / 32, v0 = v1 - 1 / 32, k = P.length / 3, hx = S.tx * S.w / 2, hz = S.tz * S.w / 2; P.push(S.x - hx, S.y0, S.z - hz, S.x + hx, S.y0, S.z + hz, S.x + hx, S.y1, S.z + hz, S.x - hx, S.y1, S.z - hz); U.push(u0, v0, u0 + 1 / 8, v0, u0 + 1 / 8, v1, u0, v1); I.push(k, k + 1, k + 2, k, k + 2, k + 3); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.15, side: THREE.DoubleSide }); (this.shopSignMs ||= []).push(m); this.scene.add(new THREE.Mesh(g, m)); }
  }
  tickSignals(t) { if (!this.sigM) return; const cyc = t % 60, A = cyc < 27 ? 'g' : cyc < 30 ? 'y' : 'r', B = cyc >= 30 && cyc < 57 ? 'g' : cyc >= 57 ? 'y' : 'r'; for (const [k, v] of Object.entries(this.sigM)) { const P = k[1] === '0' ? A : B, cy = k[1] === '0' ? cyc : (cyc + 30) % 60, on = k[0] === 'a' ? P === 'g' && cy >= 18 : P === k[0]; v.m.color.copy(on ? v.col : new THREE.Color('#2a2a2a')); } }
  // 다리: 물 위는 14m 높이로 띄우고, 교각 · 난간 · 밤 조명. 서강대교는 밤섬 위에 붉은 아치
  buildBridges(P2, inWater) {
    const deck = { P: [], I: [] }, side = { P: [], I: [] }, piers = [], lamps = [];
    // 8-31: 땅의 찻길(다리 아닌 폭 8m 넘는 길) 조각을 30m 칸에 — 다리 바닥 높이 · 기둥 자리를 찻길에 맞추는 데 쓴다
    const RG = new Map(); for (const rd of this.map.roads || []) { if (rd[1] || rd[0] < 8) continue; const pts = P2(rd.slice(2)); for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], c = pts[i], sg = [a[0], a[1], c[0], c[1], rd[0]]; for (let gx = Math.floor((Math.min(a[0], c[0]) - 12) / 30); gx <= Math.floor((Math.max(a[0], c[0]) + 12) / 30); gx++) for (let gz = Math.floor((Math.min(a[1], c[1]) - 12) / 30); gz <= Math.floor((Math.max(a[1], c[1]) + 12) / 30); gz++) { const k = gx + ',' + gz; if (!RG.has(k)) RG.set(k, []); RG.get(k).push(sg); } } }
    // 가장 가까운 찻길 조각: { d 가운데선까지, px pz 가운데선 위 점, ux uz 길 방향, w 폭 }
    const nearRoad = (x, z) => { let best = null; for (const [ax, az, cx, cz, w] of RG.get(Math.floor(x / 30) + ',' + Math.floor(z / 30)) || []) { const ex = cx - ax, ez = cz - az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - ax) * ex + (z - az) * ez) / L2, 0, 1), px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz); if (d - w / 2 < (best ? best.d - best.w / 2 : Infinity)) { const l = Math.sqrt(L2); best = { d, px, pz, ux: ex / l, uz: ez / l, w }; } } return best; };
    const rails = [], rails2 = [];
    // 다리 높이: 서로 이어진 고가끼리 묶어서, 다른 고가와 이어지지 않은 끝(땅의 길과 만나는 곳)은 땅까지 비스듬히 내려온다
    const ways = this.map.bridges.map((b) => ({ b, pts: P2(b.p) })).filter((w) => w.pts.length > 1);
    for (const w of ways) w.wet = w.pts.some(([x, z]) => inWater(x, z));
    const nearAny = (p, self) => ways.some((w) => w !== self && w.pts.some((q) => Math.abs(q[0] - p[0]) < 2.5 && Math.abs(q[1] - p[1]) < 2.5));
    const linkedWet = (self) => ways.some((w) => w !== self && w.wet && (w.pts.some((q) => Math.hypot(q[0] - self.pts[0][0], q[1] - self.pts[0][1]) < 2.5 || Math.hypot(q[0] - self.pts[self.pts.length - 1][0], q[1] - self.pts[self.pts.length - 1][1]) < 2.5)));
    // 물 위 다리 높이: 한강처럼 물 위 구간이 긴(150m 넘는) 다리만 14m, 호수 · 개천을 잠깐 건너는 다리는 5.2m (석촌호수 송파대로 다리가 14m 산처럼 솟아 차가 넘어 다녔다)
    const wetLen = (w) => { let n = 0; for (let i = 1; i < w.pts.length; i++) { const a = w.pts[i - 1], c = w.pts[i], L = Math.hypot(c[0] - a[0], c[1] - a[1]), k = Math.max(1, Math.ceil(L / 10)); for (let j = 0; j < k; j++) if (inWater(a[0] + (c[0] - a[0]) * (j + 0.5) / k, a[1] + (c[1] - a[1]) * (j + 0.5) / k)) n += L / k; } return n; };
    for (const w of ways) w.big = w.wet && wetLen(w) > 150;
    const linkedBig = (self) => ways.some((w) => w !== self && w.big && (w.pts.some((q) => Math.hypot(q[0] - self.pts[0][0], q[1] - self.pts[0][1]) < 2.5 || Math.hypot(q[0] - self.pts[self.pts.length - 1][0], q[1] - self.pts[self.pts.length - 1][1]) < 2.5)));
    for (const w of ways) { w.free0 = !nearAny(w.pts[0], w); w.free1 = !nearAny(w.pts[w.pts.length - 1], w); w.top = w.big || linkedBig(w) ? 14 : w.wet || linkedWet(w) ? 5.2 : 7.5; }
    for (const w of ways) {
      const b = w.b, pts = w.pts;
      const fine = []; for (let i = 1; i < pts.length; i++) { const [a, c] = [pts[i - 1], pts[i]], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(L / 15)); for (let k = 0; k < n; k++) fine.push([lerp(a[0], c[0], k / n), lerp(a[1], c[1], k / n)]); } fine.push(pts[pts.length - 1]);
      const wet = fine.map(([x, z]) => inWater(x, z)), anyWet = wet.some(Boolean), top = w.top;
      const acc = [0]; for (let i = 1; i < fine.length; i++) acc.push(acc[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
      const total = acc[acc.length - 1];
      const ys = fine.map((_, i) => { if (wet[i]) return top; const d0 = w.free0 ? acc[i] : Infinity, d1 = w.free1 ? total - acc[i] : Infinity; return Math.min(top, 0.25 + Math.min(d0, d1) * 0.07); });
      // 8-31: 철도 고가는 역에서 끊긴 끝(350m 안에 다른 철도 고가 끝이 있으면)에선 땅으로 내려오지 않는다 (역마다 고가가 찻길 위로 내려앉아 차가 뚫고 지났다)
      if (b.rail) { const near2 = (p) => ways.some((o) => o !== w && o.b.rail && [o.pts[0], o.pts[o.pts.length - 1]].some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 350)), k0 = w.free0 && !near2(pts[0]), k1 = w.free1 && !near2(pts[pts.length - 1]); for (let i = 0; i < ys.length; i++) if (!wet[i]) ys[i] = Math.min(top, 0.25 + Math.min(k0 ? acc[i] : Infinity, k1 ? total - acc[i] : Infinity) * 0.07); }
      // 8-31: 땅의 찻길을 가로지르는 곳은 바닥 위 5.2m 이상(바닥 두께 1.6m 아래로 버스가 지난다), 그 앞뒤는 완만하게(1m 에 12cm) 이어 올린다
      else {
        let raised = false;
        for (let i = 0; i < fine.length; i++) { if (wet[i] || ys[i] >= 5.2) continue; const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], dl = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, q = nearRoad(fine[i][0], fine[i][1]); if (q && q.d < q.w / 2 + 1.5 && Math.abs(((c[0] - a[0]) * q.ux + (c[1] - a[1]) * q.uz) / dl) < 0.85) { ys[i] = 5.2; raised = true; } }
        if (raised) { for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] - 0.12 * (acc[i] - acc[i - 1])); for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - 0.12 * (acc[i + 1] - acc[i])); }
      }
      // 차가 다리 위를 달릴 수 있게 (hangang.js citySetup → hangang-vehicles.js): 세상 좌표 점 · 높이
      b.fine = fine; b.ys = ys;
      ribbonInto(deck.P, deck.I, fine, b.w, (i) => ys[i]);
      // 밟을 수 있는 다리 바닥 (경사로 포함): 조각마다 40m 칸에 기억
      for (let i = 1; i < fine.length; i++) { const sg = { ax: fine[i - 1][0], az: fine[i - 1][1], cx: fine[i][0], cz: fine[i][1], ya: ys[i - 1], yc: ys[i], hw: b.w / 2 }, si = (this.decks ||= []).push(sg) - 1; this.deckGrid ||= new Map(); for (let gx = Math.floor((Math.min(sg.ax, sg.cx) - sg.hw) / 40); gx <= Math.floor((Math.max(sg.ax, sg.cx) + sg.hw) / 40); gx++) for (let gz = Math.floor((Math.min(sg.az, sg.cz) - sg.hw) / 40); gz <= Math.floor((Math.max(sg.az, sg.cz) + sg.hw) / 40); gz++) { const k = `${gx},${gz}`; if (!this.deckGrid.has(k)) this.deckGrid.set(k, []); this.deckGrid.get(k).push(si); } }
      ribbonInto(side.P, side.I, fine, b.w + 0.4, (i) => ys[i] - 1.6);
      // 난간 (양쪽 낮은 벽)
      for (const sgn of [-1, 1]) { const off = fine.map((p, i) => { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * (b.w / 2) * sgn, p[1] + dx / L * (b.w / 2) * sgn]; }); rails2.push({ off, ys }); }
      // 철교 트러스는 물 위(와 그 바로 옆)에만 — 땅 위 지하철 고가는 콘크리트 상판이라 트러스가 없다
      if (b.rail) rails.push({ fine, ys, w: b.w, n: b.n || '', wetR: fine.map((_, i) => wet[i] || wet[i - 1] || wet[i + 1] || wet[i - 2] || wet[i + 2]) });
      for (let i = 0; i < fine.length; i += 2) { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], ang = Math.atan2(c[1] - a[1], c[0] - a[0]) + Math.PI / 2; if (ys[i] < 3) continue; if (wet[i]) { if (i % 4 === 0) piers.push([fine[i][0], fine[i][1], ys[i], b.w, ang]); } else piers.push([fine[i][0], fine[i][1], ys[i], b.w * 0.6, ang]); }
      if (anyWet) for (let i = 0; i < fine.length; i += 3) { const a = fine[Math.max(0, i - 1)], c = fine[Math.min(fine.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1; for (const sgn of [-1, 1]) lamps.push(fine[i][0] - dz / L * b.w / 2 * sgn, ys[i] + 1.2, fine[i][1] + dx / L * b.w / 2 * sgn); }
    }
    const dm = new THREE.MeshLambertMaterial({ color: '#77746f', side: THREE.DoubleSide }), sm = new THREE.MeshLambertMaterial({ color: '#d9d2c6', side: THREE.DoubleSide });
    this.scene.add(new THREE.Mesh(geoOf(deck.P, deck.I), dm), new THREE.Mesh(geoOf(side.P, side.I), sm));
    // 난간: 얇은 벽 (아래 · 위 두 줄)
    { const P = [], I = []; for (const { off, ys } of rails2) for (let i = 1; i < off.length; i++) { const a = off[i - 1], c = off[i], k = P.length / 3; P.push(a[0], ys[i - 1], a[1], c[0], ys[i], c[1], c[0], ys[i] + 1.15, c[1], a[0], ys[i - 1] + 1.15, a[1]); I.push(k, k + 1, k + 2, k, k + 2, k + 3); } this.scene.add(new THREE.Mesh(geoOf(P, I), new THREE.MeshLambertMaterial({ color: '#7d8a99', side: THREE.DoubleSide, transparent: true, opacity: 0.55 })));
      const posts = []; for (const { off, ys } of rails2) for (let i = 0; i < off.length; i++) posts.push([off[i][0], ys[i], off[i][1]]);
      const pg = new THREE.BoxGeometry(0.16, 1.25, 0.16); pg.translate(0, 0.62, 0); const pm2 = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ color: '#f2eee6' }), posts.length), o3 = new THREE.Object3D(); posts.forEach(([x, y, z], i) => { o3.position.set(x, y, z); o3.updateMatrix(); pm2.setMatrixAt(i, o3.matrix); }); this.scene.add(pm2);
      const topP = [], topI = []; for (const { off, ys } of rails2) ribbonInto(topP, topI, off, 0.22, (i) => ys[i] + 1.22); this.scene.add(new THREE.Mesh(geoOf(topP, topI), new THREE.MeshLambertMaterial({ color: '#f2eee6', side: THREE.DoubleSide }))); }
    // 교각: 둥근 기둥 둘 + 머리보 (물 위), 땅 위 고가는 기둥 하나
    const colG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); colG.translate(0, 0.5, 0);
    const capG = new THREE.BoxGeometry(1, 1.4, 2.4);
    const pm = new THREE.MeshLambertMaterial({ color: '#c9c2b6' }), cols = new THREE.InstancedMesh(colG, pm, piers.length * 2), caps = new THREE.InstancedMesh(capG, pm, piers.length), o = new THREE.Object3D();
    // 8-31: 기둥이 땅의 찻길 차로 위에 서면 → 넓은 길(14m+)은 가운데 분리대로, 아니면 길 가장자리 밖으로 (다리 바닥 아래일 때만), 둘 다 안 되면 세우지 않는다
    const H0 = this.host || this; this.pierMoved = (this.pierMoved || 0); this.pierDropped = (this.pierDropped || 0);
    const place = (cx, cz, x, z, hw) => { const q = nearRoad(cx, cz); if (!q || q.d >= q.w / 2 - 0.3 || (q.w >= 14 && q.d < 0.8)) return [cx, cz, false];
      if (q.w >= 14 && Math.hypot(q.px - x, q.pz - z) <= hw) return [q.px, q.pz, true];
      const nx = (cx - q.px) / (q.d || 1), nz = (cz - q.pz) / (q.d || 1), ex = q.px + nx * (q.w / 2 + 0.9), ez = q.pz + nz * (q.w / 2 + 0.9); if (Math.hypot(ex - x, ez - z) <= hw + 0.5) { const q2 = nearRoad(ex, ez); if (!q2 || q2.d >= q2.w / 2 - 0.3) return [ex, ez, true]; }
      // 다리 가운데 밑이 차로가 아니면 가운데 기둥 하나로
      const q3 = nearRoad(x, z); if (!q3 || q3.d >= q3.w / 2 - 0.3 || (q3.w >= 14 && q3.d < 0.8)) return [x, z, true]; return null; };
    const portals = [];
    piers.forEach(([x, z, y, w, ang], i) => { const half = Math.min(w * 0.3, 6), seen = []; for (const sgn of [-1, 1]) { const k = i * 2 + (sgn > 0 ? 1 : 0), pl = place(x + Math.cos(ang || 0) * half * sgn, z + Math.sin(ang || 0) * half * sgn, x, z, w / 2);
        if (!pl || seen.some((p) => Math.hypot(p[0] - pl[0], p[1] - pl[1]) < 1.5)) { this.pierDropped++; o.position.set(x, -50, z); o.scale.set(0.001, 0.001, 0.001); o.updateMatrix(); cols.setMatrixAt(k, o.matrix); continue; }
        if (pl[2]) this.pierMoved++; seen.push(pl); const thin = pl[2] || w <= 12;
        const pc = this.addCircle(pl[0], pl[1], thin ? 0.65 : 0.95, y - 1.6); pc.col = { m: cols, i: k }; (H0.pierCircles ||= new Set()).add(pc); o.position.set(pl[0], -1, pl[1]); o.rotation.set(0, 0, 0); o.scale.set(thin ? 1.2 : 1.8, y - 1.4 + 1, thin ? 1.2 : 1.8); o.updateMatrix(); cols.setMatrixAt(k, o.matrix); }
      // 8-27-6: 기둥을 하나도 못 세우면(분리대 없는 길 위 고가) 길 양쪽 가장자리 밖에 기둥 둘 + 다리 밑 가로보 (떠 보이지 않게)
      if (!seen.length) { const q = nearRoad(x, z); if (q && y - 1.6 - 0.8 >= 3.9) { const nx = -q.uz, nz = q.ux, k = q.w / 2 + 1.0, A = [q.px + nx * k, q.pz + nz * k], Bp = [q.px - nx * k, q.pz - nz * k], free = (p) => { const r2 = nearRoad(p[0], p[1]); return !r2 || r2.d >= r2.w / 2 - 0.3; }; if (free(A) && free(Bp) && Math.hypot(A[0] - Bp[0], A[1] - Bp[1]) < 24) portals.push([A, Bp, y]); } }
      // 머리보: 그 밑이 3.6m 넘을 때만 (낮은 고가에선 버스 지붕에 닿았다)
      if (y - 1.6 - 1.4 >= 3.6) { o.position.set(x, y - 2.4, z); o.rotation.set(0, -(ang || 0), 0); o.scale.set(Math.min(w * 0.75, 16), 1, 1); } else { o.position.set(x, -50, z); o.scale.set(0.001, 0.001, 0.001); } o.updateMatrix(); caps.setMatrixAt(i, o.matrix); });
    this.scene.add(cols, caps);
    if (portals.length) { const pc2 = new THREE.InstancedMesh(colG, pm, portals.length * 2), pb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.8, 1.1), pm, portals.length), o4 = new THREE.Object3D();
      portals.forEach(([A, Bp, y], i) => { [A, Bp].forEach((p, j) => { const c = this.addCircle(p[0], p[1], 0.6, y - 1.6); c.col = { m: pc2, i: i * 2 + j }; (H0.pierCircles ||= new Set()).add(c); o4.position.set(p[0], -1, p[1]); o4.rotation.set(0, 0, 0); o4.scale.set(1.2, y - 1.6 + 1, 1.2); o4.updateMatrix(); pc2.setMatrixAt(i * 2 + j, o4.matrix); });
        o4.position.set((A[0] + Bp[0]) / 2, y - 2.0, (A[1] + Bp[1]) / 2); o4.rotation.set(0, -Math.atan2(Bp[1] - A[1], Bp[0] - A[0]), 0); o4.scale.set(Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) + 1.2, 1, 1); o4.updateMatrix(); pb.setMatrixAt(i, o4.matrix); });
      this.scene.add(pc2, pb); this.pierPortal = (this.pierPortal || 0) + portals.length; }
    // 철교: 트러스 (선)
    const tP = []; for (const { fine, ys, w, wetR } of rails) for (let i = 1; i < fine.length; i++) { if (wetR && !wetR[i] && !wetR[i - 1]) continue; const a = fine[i - 1], c = fine[i], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2; for (const sgn of [-1, 1]) { const ax = a[0] + nx * sgn, az = a[1] + nz * sgn, cx = c[0] + nx * sgn, cz = c[1] + nz * sgn, y0 = ys[i - 1], y1 = ys[i]; tP.push(ax, y0, az, cx, y1 + 7, cz, ax, y0 + 7, az, cx, y1 + 7, cz, ax, y0, az, ax, y0 + 7, az); } }
    this.railPaths = rails;
    if (tP.length) { const beams = []; for (let i = 0; i < tP.length; i += 6) beams.push([tP[i], tP[i + 1], tP[i + 2], tP[i + 3], tP[i + 4], tP[i + 5]]); const bg = new THREE.BoxGeometry(0.5, 0.5, 1); bg.translate(0, 0, 0.5); const bm = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ color: '#5b6672' }), beams.length), o2 = new THREE.Object3D(), A = new THREE.Vector3(), B = new THREE.Vector3(); beams.forEach(([x1, y1, z1, x2, y2, z2], i) => { A.set(x1, y1, z1); B.set(x2, y2, z2); o2.position.copy(A); o2.lookAt(B); o2.scale.set(1, 1, A.distanceTo(B)); o2.updateMatrix(); bm.setMatrixAt(i, o2.matrix); }); this.scene.add(bm); }
    // 아치 (서강대교)
    for (const [, ax, az, span] of this.map.arches || []) {
      const x0 = ax * this.map.scale, z0 = az * this.map.scale; let best = null;
      for (const b of this.map.bridges) { const pts = P2(b.p); for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - x0, pts[i][1] - z0); if (!best || d < best.d) best = { d, a: pts[i - 1], c: pts[i], w: b.w }; } }
      if (!best || best.d > 120) continue;
      const dx = best.c[0] - best.a[0], dz = best.c[1] - best.a[1], L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
      const am = new THREE.MeshLambertMaterial({ color: '#c8322a' });
      for (const sgn of [-1, 1]) {
        const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24 - 0.5; pts.push(new THREE.Vector3(x0 + ux * t * span - uz * (best.w / 2 + 0.5) * sgn, 14 + Math.cos(t * Math.PI) * 24, z0 + uz * t * span + ux * (best.w / 2 + 0.5) * sgn)); }
        this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.9, 6), am));
        const hg = []; for (let k = 2; k < 23; k += 2) { const p = pts[k]; hg.push(p.x, p.y, p.z, p.x, 14, p.z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(hg, 3)); this.scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#d9d4cc' })));
      }
    }
    this.bridgeLights = this.glowPoints(lamps, '#ffcf8a', 2.2);
  }
  glowPoints(arr, col, size) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.PointsMaterial({ color: col, size, map: this.dot ||= dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const p = new THREE.Points(g, m); this.scene.add(p); return p;
  }

  // 건물: 실제 외곽선 · 높이 + 실제 모습에 가까운 외벽
  //   아파트(흰 벽 · 발코니 띠) · 유리 오피스(색 유리 · 멀리온) · 석재 오피스(창이 뚫린 돌벽) · 벽돌(학교 · 주택) · 금빛 유리(63빌딩)
  //   랜드마크: 63빌딩 금빛 유리 · 파크원 빨간 철골 기둥 · LG트윈타워 청동빛 유리 · IFC 푸른 유리 · 전경련회관 짙은 유리 · 국회의사당 흰 기둥 + 초록 돔
  // 칸 만들기 중에 화면이 멈추지 않게 8ms 일할 때마다 쉬어 간다(yield)
  *buildBuildings(P2) {
    let t0 = performance.now();
    const M = this.map, r = rnd(99), types = ['apt', 'glass', 'stone', 'brick', 'gold', 'assembly', 'church', 'panels', 'fins', 'street', 'street2', 'factory', 'hanok', 'villa'];
    const sets = Object.fromEntries(types.map((t) => [t, { P: [], N: [], U: [], Cl: [], I: [], W: [] }]));
    const extras = { P: [], N: [], Cl: [], I: [] }, domes = [], signs = { P: [], N: [], Cl: [], I: [] }, crosses = [];
    const col = new THREE.Color(), roofC = new THREE.Color();
    const GLASS = ['#6f8fb2', '#5f9aa2', '#8a96a4', '#6d9a86', '#9a8a70', '#55626f', '#7aa0c8', '#8fa8b8'], STONE = ['#d8cfbf', '#c9c4bc', '#b8b2a8', '#d9c8ae', '#a99c88', '#e2ddd2'], BRICK = ['#a8573e', '#9a4a36', '#b8694a', '#8a4a3a', '#c07a55'], APT = ['#f1ede4', '#ece4d4', '#e8e8e4', '#f2e9da', '#e4dccd', '#dfe3e6'];
    const FLOOR = { apt: 2.9, glass: 3.9, stone: 3.6, brick: 3.2, gold: 3.9, assembly: 6, church: 7, panels: 8, fins: 3.9, street: 3.4, street2: 3.6, factory: 5, hanok: 3.2, villa: 2.9 }, BAY = { apt: 3.4, glass: 1.6, stone: 2.6, brick: 2.4, gold: 1.6, assembly: 3.5, church: 4.5, panels: 5, fins: 1.6, street: 2.6, street2: 3.2, factory: 4, hanok: 2.4, villa: 2.9 };
    const box = (x, y, z, w, h, d, c, rotY = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(rotY); g.translate(x, y, z); const k = extras.P.length / 3, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { extras.P.push(p.getX(i), p.getY(i), p.getZ(i)); extras.N.push(n.getX(i), n.getY(i), n.getZ(i)); extras.Cl.push(c.r, c.g, c.b); } for (const ix of g.index.array) extras.I.push(k + ix); };
    // 벽에 붙이는 얇은 판 (1층 필로티 · 화강석 띠 · 가게 유리 · 아파트 색 띠): extras 한 덩어리에 꼭짓점 색으로 (그리기 호출이 늘지 않는다)
    const wq = (a, c2, nx, nz, s, o, y0, y1, cc, t0 = 0, t1 = 1) => { const dx = c2[0] - a[0], dz = c2[1] - a[1], x0 = a[0] + dx * t0 + nx * o, z0 = a[1] + dz * t0 + nz * o, x1 = a[0] + dx * t1 + nx * o, z1 = a[1] + dz * t1 + nz * o, q0 = extras.P.length / 3; extras.P.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0); for (let t = 0; t < 4; t++) { extras.N.push(nx, 0, nz); extras.Cl.push(cc.r, cc.g, cc.b); } if (s < 0) extras.I.push(q0, q0 + 1, q0 + 2, q0, q0 + 2, q0 + 3); else extras.I.push(q0, q0 + 2, q0 + 1, q0, q0 + 3, q0 + 2); };
    const C_ARC = new THREE.Color('#f2ead2').multiplyScalar(1.7), C_PIL = new THREE.Color('#2a2c30'), C_BEAM = new THREE.Color('#d2cfc8'), C_SHOP = new THREE.Color('#38414c'), C_SHOPF = new THREE.Color('#2a2a2e'), GRANITE = ['#c9b9b0', '#a9a59e', '#d6d0c6', '#8f8a84', '#bfb2a6'].map((h2) => new THREE.Color(h2));
    const campus = []; for (const [nm, L] of Object.entries(LANDMARKS)) { if (!L.campus) continue; const ni2 = M.names.indexOf(nm); const b2 = M.buildings.find((q) => q[4] === ni2); if (!b2) continue; let x = 0, z = 0, n = 0; for (let k = 7; k < b2.length; k += 2) { x += b2[k] * M.scale; z += b2[k + 1] * M.scale; n++; } campus.push({ x: x / n, z: z / n, r: L.campus, L, nm, kind: b2[2] >> 1, ring: P2(b2.slice(7)), self: b2 }); }
    this.lmParts = {}; const touches = (cp, b, ring) => cp.self !== b && (ring.some(([x, z]) => inRing(x, z, cp.ring)) || cp.ring.some(([x, z]) => inRing(x, z, ring)));
    // 남산 정상 둘레(서울 전체 칸): 높이 자료가 잘못된 건물이 많아 정상 지도처럼 낮게 (타워 · 따로 만든 것 빼고)
    const towerI = M.kind === 'tile' ? M.names.indexOf('남산서울타워') : -1, towerB = towerI >= 0 ? M.buildings.find((q) => q[4] === towerI) : null, towerC = towerB ? [towerB[7] * M.scale, towerB[8] * M.scale] : null;
    // 서울 전체 칸: 건물마다 한 높이(바닥 둘레의 가장 낮은 땅)에 수평으로 세운다. 꼭짓점마다 땅 높이를 더하면 비탈에서 바닥 · 지붕이 기운다
    //   그 건물의 꼭짓점들에 바닥 높이(Y)를 적어 두고, drape 가 땅 높이 대신 이 값을 더한다 (NaN = 예전처럼 그 자리 땅 높이)
    const useBase = M.kind === 'tile' && !!(this.terr || this.host?.terr), groupsY = [...Object.values(sets), extras, signs]; for (const G of groupsY) G.Y = [];
    let curY = NaN, curW = [0, 0, 1]; const fillY = () => { for (const G of groupsY) { const n = G.P.length / 3; while (G.Y.length < n) G.Y.push(curY); if (G.W) while (G.W.length < n * 3) G.W.push(curW[0], curW[1], curW[2]); } for (const a of this.aptMarks || []) if (a.by === undefined) a.by = curY; for (const a of this.hanokRoofs || []) if (a.by === undefined) a.by = curY; for (const a of this.helis || []) if (a.by === undefined) a.by = curY; for (const a of this.slateRoofs || []) if (a.by === undefined) a.by = curY; };
    // 궁궐 안(경복궁 · 창덕궁 · 덕수궁 · 창경궁 · 경희궁 · 종묘): 건축물대장에 없는 작은 전각 · 문 · 행각은 낮은 한옥으로 (아무 벽돌 상자가 되지 않게)
    const palaces = []; { const PN = /^(경복궁|창덕궁|덕수궁|창경궁|경희궁|종묘)/; for (const b2 of M.buildings) { const nm = M.names[b2[4]] || ''; if (PN.test(nm)) palaces.push([b2[7] * M.scale, b2[8] * M.scale]); } }
    // 1층에 가게가 있는 건물 (상가주택: 필로티 대신 1층 가게)
    const shopG = new Set(); for (const s2 of M.shops2 || []) if (s2[3] <= 1) shopG.add(s2[2]);
    // 전통시장 아케이드: 지도 도구는 시장 건물 안을 골목이 20m 넘게 지날 때만 아케이드로 만들어(5곳) 나머지는 상자로 막혀 있었다
    //   1층짜리(4.6m 아래) 이름 있는 동네 시장(도매 · 수산 · 전시장 · 센터 빼고, 300㎡ 넘음)은 실제로 골목 위에 지붕을 덮은 시장이라 같은 아케이드로 (연서시장 · 노룬산시장 · 봉천중앙시장 · 숭인시장 · 대림시장 · 증산종합시장 · 동진시장)
    if (M.kind === 'tile' && !M.arcFix) { M.arcFix = true; for (const b of M.buildings) { const nm = M.names[b[4]] || ''; if (b[1] === 0 && b[0] <= 4.6 && /시장$/.test(nm) && !/도매|수산|농산|청과|전시|자동차|매매|센터|유통|공판/.test(nm) && Math.abs(ringArea(P2(b.slice(7)))) > 300) { b[0] = 6; b[1] = 4.2; } } }
    for (const [bi, b] of M.buildings.entries()) {
      if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
      fillY(); curY = NaN;
      // 무작위는 건물마다 자기 씨앗 (외곽선 첫 점): 지도 순서 · 코드가 바뀌어도 같은 건물은 늘 같은 모습
      const r = rnd(bSeed(b));
      const info = M.binfo?.[bi] || null;
      const [h0, mh, km, ci, ni, rci, dome] = b, kind = km >> 1, glassTag = km & 1, ring = P2(b.slice(7)); if (ring.length < 3) continue;
      // 랜드마크는 이름으로 찾는다. 같은 이름 아파트가 있는 것(예술의전당 오페라하우스 ↔ '오페라하우스' 빌라 여러 곳)은 at: [x, z, 반지름] 안에서만
      const L0 = LANDMARKS[ni >= 0 ? M.names[ni] : ''], LMK = L0 && L0.at && Math.hypot(b[7] * M.scale - L0.at[0], b[8] * M.scale - L0.at[1]) > L0.at[2] ? NO_LM : LANDMARKS;
      // 롯데월드 어드벤처 · 매직아일랜드 위 건물은 hangang-park.js 가 실제 모습으로 따로 만든다
      if (this.isChunk && parkSkip(ring)) continue;
      // 돔 지붕 부분: 벽은 돔 아래까지, 그 위에 돔 (높이 · 색은 지도 데이터대로)
      const palaceHanok = (!info || !info[0]) && !LMK[ni >= 0 ? M.names[ni] : ''] && h0 <= 14 && Math.abs(ringArea(ring)) < 1500 && palaces.some(([x, z]) => Math.hypot(b[7] * M.scale - x, b[8] * M.scale - z) < 420), domeR = dome ? Math.sqrt(Math.abs(ringArea(ring)) / Math.PI) : 0, domeH = dome ? (dome > 1 ? dome : domeR * 0.6) : 0, h = palaceHanok ? 4.5 : LMK[ni >= 0 ? M.names[ni] : '']?.height || Math.min(Math.max(mh + 0.5, h0 - domeH), (M.kind === 'summit' || (towerC && Math.hypot(b[7] * M.scale - towerC[0], b[8] * M.scale - towerC[1]) < 160)) && M.names[ni] !== '남산서울타워' ? 12 : 1e9);
      const name = ni >= 0 ? M.names[ni] : '', cTag = ci >= 0 ? M.colors[ci] : '';
      if (M.kind === 'tile' && ATTR_SKIP.has(name)) continue; // 명소 체험에서 따로 만드는 건물 (경회루)
      // 외벽 종류
      let type = kind === 1 ? (h > 14 ? 'apt' : r() < 0.5 ? 'brick' : 'stone') : kind === 4 ? (r() < 0.6 ? 'brick' : 'stone') : kind === 5 ? 'brick' : kind === 3 ? 'stone' : kind === 2 || kind === 0 ? (glassTag || h > 55 || (h > 30 && r() < 0.5) ? 'glass' : 'stone') : 'stone';
      // 종류를 모르는 길쭉한 판상형 (폭 10 ~ 17m · 길이 3배 이상 · 25 ~ 50m 높이) 은 아파트 (여의도 아파트 단지들)
      if ((kind === 0 || kind === 2) && !glassTag && h >= 22 && h <= 52 && !name) { let xx = 0, zz = 0, xz = 0, mx = 0, mz = 0; for (const [x, z] of ring) { mx += x; mz += z; } mx /= ring.length; mz /= ring.length; for (const [x, z] of ring) { const dx = x - mx, dz = z - mz; xx += dx * dx; zz += dz * dz; xz += dx * dz; } const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang); let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const [x, z] of ring) { const a = (x - mx) * ux + (z - mz) * uz, b = -(x - mx) * uz + (z - mz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); } const Lw = a1 - a0, Sw = b1 - b0; if (Sw >= 9 && Sw <= 17 && Lw >= Sw * 3) type = 'apt'; }
      let c = null;
      if (LMK[name]) { const L = LMK[name]; type = L.facade; c = L.color; (this.lmQueue ||= []).push({ name, ring, h, L }); }
      else if (/63/.test(name) || /gold/i.test(cTag)) { type = 'gold'; c = '#ffd76a'; }
      else if (name === '부영빌딩' && h > 60) { type = 'gold'; c = '#b8875a'; } // 을지로 입구 옛 삼성화재 본사: 구릿빛 반사 유리 (같은 이름 작은 건물이 많아 높이로 가린다)
      else if (/파크원|NH금융타워/.test(name)) { type = 'fins'; c = '#e8e8e4'; }
      else if (/LG트윈|트윈타워/.test(name)) { type = 'glass'; c = '#7a6248'; }
      else if (/IFC/.test(name)) { type = 'glass'; c = '#6f95c8'; }
      else if (/전경련|FKI/.test(name)) { type = 'glass'; c = '#4f6266'; }
      else if (/국회의사당$/.test(name)) { type = 'assembly'; c = '#f4f1ea'; }
      else if (campus.some((cp) => touches(cp, b, ring))) { const cp = campus.find((q) => touches(q, b, ring)); type = cp.L.facade; c = cp.L.color; (this.lmParts[cp.nm] ||= []).push({ ring, h }); } // 랜드마크를 감싸는 본관 조각: 같은 모습
      else if (campus.some((cp) => { const [x, z] = ring[0]; return cp.kind === kind && Math.hypot(x - cp.x, z - cp.z) < cp.r; })) { const cp = campus.find((q) => q.kind === kind && Math.hypot(ring[0][0] - q.x, ring[0][1] - q.z) < q.r); type = cp.L.campusFacade || cp.L.facade; c = cp.L.campusColor || cp.L.color; }
      else if (kind === 6 || /교회|성당|채플/.test(name)) { type = 'church'; c = '#efe9de'; crosses.push(ring); }
      else if (/^#?[0-9a-f]{6}$/i.test(cTag) || /^[a-z]+$/i.test(cTag)) { try { col.set(cTag); c = `#${col.getHexString()}`; } catch { c = null; } }
      // 랜드마크도 한 높이에 (예전엔 빼서 비탈에서 꼭짓점마다 땅을 따라 지붕이 기울었다). 덧붙이는 모양(buildLandmarkExtras)도 같은 높이로 올린다
      if (useBase && M.kind !== 'summit' && !(towerC && Math.hypot(ring[0][0] - towerC[0], ring[0][1] - towerC[1]) < 200)) { let lo = Infinity; for (const [x, z] of ring) lo = Math.min(lo, this.terrAt(x, z, true)); curY = lo - 0.15; }
      // 실제 건축물 정보(용도 · 구조 · 사용승인 연도)로 외벽을 정한다 (틀 찍어내기 대신 그 건물의 실제 정보대로)
      let ground = null;
      if (info && !c && !LMK[name] && type !== 'church' && type !== 'gold' && type !== 'assembly') { const st = styleOf(info, h, r, shopG.has(bi)); if (st && glassTag && type === 'glass' && st[0] !== 'glass') st.length = 0; if (st?.length) { type = st[0]; c = st[1]; ground = st[2] || null; } }
      // 대장 정보가 없는 이름 없는 낮은 건물 · 단독주택 (서울에선 대부분 집 · 빌라): 1990년대 주택처럼
      if ((!info || !info[0]) && !c && !name && type !== 'church' && type !== 'apt' && (kind === 0 || kind === 4) && h < 16 && !palaceHanok) { const st = styleOf([1, 21, 0], h, r, shopG.has(bi)); type = st[0]; c = st[1]; ground = st[2] || null; }
      // 주상복합 · 초고층 아파트 (갤러리아 포레 · 트리마제 · 타워팰리스 같은 45층 넘는 탑, 2008년 뒤 35층 넘는 탑): 발코니 띠 대신 흰 · 은회색 유리 커튼월
      const yr = info?.[2] || 0;
      if (type === 'apt' && !c && (h >= 150 || (h >= 110 && yr >= 2008) || (h >= 90 && /타워|팰리스|포레|트리마제|리첸시아|트럼프|아크로|써밋|레지던스|스카이/.test(name)))) { type = 'glass'; c = ['#c9d4da', '#b8c6cf', '#d5dde0', '#aebcc6', '#bfcad0'][Math.floor(r() * 5)]; }
      // 아파트: 연대 · 브랜드마다 외벽 색과 옆벽 색 띠 (1970 ~ 80년대 크림 · 연한 색, 1990년대 흰 · 아이보리, 2000년대 뒤 회색 · 베이지 투톤 + 아래층 석재)
      let aptAcc = null, aptEra = 0;
      if (type === 'apt' && !c) { aptEra = yr ? (yr < 1990 ? 0 : yr < 2003 ? 1 : 2) : h > 75 ? 2 : 1; const B = aptBrand(name); c = B ? B[0] : [['#efe6d0', '#ebe3d3', '#e6e6d8', '#efe2d8', '#e9e4d6'], ['#f2f0ea', '#efe9dc', '#f1ede4', '#e9e6df'], ['#e2e2df', '#d9d4cc', '#f1f0ec', '#cfcfcb', '#e6e0d6']][aptEra][Math.floor(r() * 5) % [5, 4, 5][aptEra]]; aptAcc = B ? B[1] : [['#6f9a7a', '#5f86a8', '#b07a5a', '#8a9a6a'], ['#4f7fa8', '#3f8a6a', '#a85a4a', '#7a7f88'], ['#5d6066', '#8a7a68', '#4a5560', '#9a8a74']][aptEra][Math.floor(r() * 4)]; }
      if (palaceHanok) { type = 'hanok'; c = '#efe6d6'; }
      // 한옥 마을(북촌 · 인사동): 정보가 없는 단층 작은 집도 한옥으로
      if (!info && (this.regionHere === 'bukchon' || this.regionHere === 'insadong') && h <= 5 && Math.abs(ringArea(ring)) < 350 && !name) { type = 'hanok'; c = '#f2ece0'; }
      // 거리 지역(홍대 · 이태원 등) 낮은 상가: 외벽 색 · 창 무늬 · 층 높이를 건물마다 다르게
      if ((M.kind === 'street' || ((!M.kind || M.kind === 'river') && (kind === 2 || kind === 0) && h < 26 && M.shops?.length)) && h < 32 && type !== 'apt' && type !== 'church' && type !== 'glass' && !LMK[name] && !c) { type = r() < 0.62 ? 'street' : 'street2'; c = ['#f4f1ea', '#efe3cf', '#b5654a', '#a29e98', '#f2c6cf', '#bfe3d6', '#c8dcef', '#2f2f33', '#e8d9b5', '#8a5a44', '#d9cfc2', '#fff7e8'][Math.floor(r() * 12)]; }
      if (!c) c = type === 'apt' ? APT[Math.floor(r() * APT.length)] : type === 'glass' ? GLASS[Math.floor(r() * GLASS.length)] : type === 'brick' ? BRICK[Math.floor(r() * BRICK.length)] : STONE[Math.floor(r() * STONE.length)];
      col.set(c); if (type !== 'gold') col.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.05);
      // 옥상: 여의도는 거의 다 민트색 방수 페인트 (위성사진). 아파트 일부와 낮은 건물은 회색 · 흰색
      const MINT = ['#6db894', '#62ad8a', '#78c09c', '#5ea585', '#82c4a2'], rr = r();
      try { roofC.set(rci >= 0 ? M.colors[rci] : type === 'apt' ? (rr < 0.72 ? MINT[Math.floor(r() * 5)] : '#d6d3cc') : h > 14 ? (rr < 0.68 ? MINT[Math.floor(r() * 5)] : '#9c9a95') : rr < 0.4 ? MINT[Math.floor(r() * 5)] : '#a8a49d'); } catch { roofC.set('#7d7b78'); }
      if (LMK[name]?.roof) roofC.set(LMK[name].roof);
      // 밤 창문 불빛: 이 건물의 씨앗 · 조명 종류(용도별) · 연대 (hangang-windows.js)
      curW = [winSeed(b[7], b[8]), winProfile(type, info, kind, h), winEra(info)];
      const street = type === 'street' || type === 'street2', set = sets[type], s = ringArea(ring) > 0 ? 1 : -1, base = () => set.P.length / 3, FH = FLOOR[type] * 8 * (street ? 0.9 + r() * 0.22 : 1), BW = BAY[type] * 8 * (street ? 0.85 + r() * 0.35 : 1), uOff = street ? Math.floor(r() * 8) / 8 : 0;
      // 위로 갈수록 좁아지는 건물 (63빌딩): 꼭대기 외곽선을 긴 축 방향으로 줄인다. scale 은 위아래 모두 줄인다 (꼭대기 왕관 조각)
      // taper.H 가 있으면 높이에 비례해서 (위아래 조각 모두 같은 선 위로) 가늘어진다
      const LM = LMK[name], tf = (y) => Math.min(1, y / (LM.taper.H || h)), tp = (y) => scaleRing(ring, 1 + (LM.taper.long - 1) * tf(y), 1 + (LM.taper.short - 1) * tf(y), LM.taper.H ? (this.taperC ||= {})[name] ||= (() => { let x = 0, z = 0, n = 0; const ni2 = M.names.indexOf(name); for (const b2 of M.buildings) if (b2[4] === ni2 && b2[1] < 1) for (let k = 7; k < b2.length; k += 2) { x += b2[k] * M.scale; z += b2[k + 1] * M.scale; n++; } return n ? [x / n, z / n] : null; })() : null), top = LM?.taper && (LM.taper.H || h > (LM.taper.minH || 0)) ? tp(h) : LM?.scale ? scaleRing(ring, LM.scale.long, LM.scale.short) : ring, bot = LM?.scale ? top : LM?.taper?.H ? tp(mh) : ring;
      // 달걀 모양 건물 (전경련 컨퍼런스센터): 상자 벽 대신 은색 타원 지붕만 (덧붙이는 곳에서 만든다), 부딪힘은 외곽선대로
      if (M.kind === 'summit' && /봉수대/.test(name)) continue;
      if (name === '남산서울타워' && mh > 1) continue; // 타워 위쪽 조각은 따로 만든 실제 모양으로
      // 도성 문 (숭례문 · 흥인지문 · 광화문): 실제 바닥 방향대로 돌 축대 + 홍예문 + 2층 문루 + 겹처마 지붕 (따로 만든 모양), 부딪힘은 축대 높이
      if (LM?.stadium) { const xs = ring.map((q) => q[0]), zs = ring.map((q) => q[1]); this.scene.add(buildStadium(ring, LM.stadium)); this.addFoot({ ring, h: LM.stadium.h, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name, type: 'stone', noClimb: true }); continue; }
      if (LM?.gate) { const xs = ring.map((q) => q[0]), zs = ring.map((q) => q[1]); if (!(this.gateDone ||= new Set()).has(LM)) { this.gateDone.add(LM); this.scene.add(buildGate(ring, LM)); } this.addFoot({ ring, h: LM.gate.base || 7, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name, type: 'stone' }); continue; }
      // 서울식물원 온실(오목한 접시 지붕) · 세계평화의문(기둥 위 날개 지붕): 상자 대신 buildLandmarkExtras 가 실제 모양으로. 부딪힘은 온실은 통째, 문은 기둥만
      if (LM?.dish) { const xs = ring.map((q) => q[0]), zs = ring.map((q) => q[1]); this.addFoot({ ring, h: LM.dish.rim, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name, type: 'glass', noClimb: true, base: curY === curY ? curY : undefined }); continue; }
      if (LM?.peaceGate) continue;
      if (LM?.egg || LM?.jbug) { const xs = ring.map((q) => q[0]), zs = ring.map((q) => q[1]); this.addFoot({ ring, h, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name, type: 'glass', noClimb: true }); continue; }
      let acc = 0;
      // 1층 모습 (필로티 · 화강석 띠 · 가게) 과 아파트 옆벽 띠: 건물마다 한 번 정한다
      const gTall = r() < 0.5, gC = GRANITE[Math.floor(r() * GRANITE.length)], postC = col.clone().lerp(C_BEAM, 0.5), aptAccC = aptAcc ? new THREE.Color(aptAcc) : null, aptBaseC = aptEra === 2 ? col.clone().lerp(new THREE.Color('#a8a096'), 0.55) : null;
      const aptShort = aptAccC && h > 14 ? new Set(ring.map((p, q) => [q, Math.hypot(ring[(q + 1) % ring.length][0] - p[0], ring[(q + 1) % ring.length][1] - p[1])]).filter((e) => e[1] > 6).sort((p, q) => p[1] - q[1]).slice(0, 2).map((e) => e[0])) : null;
      for (let i = 0; i < ring.length; i++) {
        const a = bot[i], c2 = bot[(i + 1) % ring.length], ta = top[i], tc = top[(i + 1) % ring.length], dx = c2[0] - a[0], dz = c2[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.05) continue;
        const nx = (s > 0 ? dz : -dz) / L, nz = (s > 0 ? -dx : dx) / L, k = base();
        set.P.push(a[0], mh, a[1], c2[0], mh, c2[1], tc[0], h, tc[1], ta[0], h, ta[1]);
        const lo = mh < 1 ? 0.72 : 0.92, hi = 1.06; for (let q = 0; q < 4; q++) { const k2 = q < 2 ? lo : hi; set.N.push(nx, 0, nz); set.Cl.push(col.r * k2, col.g * k2, col.b * k2); }
        const u0 = acc / BW + uOff, u1 = (acc + L) / BW + uOff, v0 = mh / FH, v1 = h / FH;
        // 거리 상가 외벽: 실외기 (층마다 가끔)
        if (street && L > 3 && h > 7 && h < 32) for (let fl = 1; fl * FLOOR[type] < h - 2; fl++) if (r() < 0.22) { const t = 0.15 + r() * 0.7; box(a[0] + dx * t + nx * 0.25, fl * FLOOR[type] + 0.45, a[1] + dz * t + nz * 0.25, 0.85, 0.62, 0.38, new THREE.Color(r() < 0.8 ? '#dcdcd8' : '#a9aaa6'), -Math.atan2(dz, dx)); } acc += L;
        set.U.push(u0, v0, u1, v0, u1, v1, u0, v1);
        if (s < 0) set.I.push(k, k + 1, k + 2, k, k + 2, k + 3); else set.I.push(k, k + 2, k + 1, k, k + 3, k + 2);
        if (type !== 'glass' && type !== 'gold' && h - mh > 6) { const o = 0.18, q0 = extras.P.length / 3, cc = col.clone().lerp(new THREE.Color('#ffffff'), 0.45); extras.P.push(a[0] + nx * o, h - 0.9, a[1] + nz * o, c2[0] + nx * o, h - 0.9, c2[1] + nz * o, c2[0] + nx * o, h + 0.35, c2[1] + nz * o, a[0] + nx * o, h + 0.35, a[1] + nz * o); for (let t2 = 0; t2 < 4; t2++) { extras.N.push(nx, 0, nz); extras.Cl.push(cc.r, cc.g, cc.b); } if (s < 0) extras.I.push(q0, q0 + 1, q0 + 2, q0, q0 + 2, q0 + 3); else extras.I.push(q0, q0 + 2, q0 + 1, q0, q0 + 3, q0 + 2); }
        // 1층: 필로티 주차장(어두운 빈 칸 + 모서리 기둥 + 보) · 화강석 띠 · 상가주택 1층 가게 유리
        if (ground && mh < 1 && L > 1.5 && (type === 'brick' || type === 'villa')) {
          if (ground === 'pilotis') { const pw = Math.min(0.45 / L, 0.25); wq(a, c2, nx, nz, s, 0.03, 0, 2.5, C_PIL); wq(a, c2, nx, nz, s, 0.06, 0, 2.5, postC, 0, pw); wq(a, c2, nx, nz, s, 0.06, 0, 2.5, postC, 1 - pw, 1); if (L > 9) wq(a, c2, nx, nz, s, 0.06, 0, 2.5, postC, 0.5 - pw / 2, 0.5 + pw / 2); wq(a, c2, nx, nz, s, 0.06, 2.5, 2.9, C_BEAM); }
          else if (ground === 'granite') wq(a, c2, nx, nz, s, 0.04, 0, gTall ? 2.9 : 1.1, gC);
          else if (ground === 'shop') { wq(a, c2, nx, nz, s, 0.04, 0.12, 2.75, C_SHOP); wq(a, c2, nx, nz, s, 0.05, 2.75, 2.95, C_SHOPF); }
        }
        // 아파트: 2000년대 뒤 아래 두 층은 석재, 옆벽엔 단지 색 띠 (동 번호 아래), 1990년대는 지붕 둘레 색 띠
        if (aptAccC && h > 14) {
          if (aptBaseC) wq(a, c2, nx, nz, s, 0.04, mh, mh + Math.min(6, h * 0.12), aptBaseC);
          if (aptShort.has(i) && L > 6) { const top2 = h - Math.min(10, h * 0.32) - 0.6, w = Math.min(2.6, L * 0.16) / L; if (top2 > mh + 6) { wq(a, c2, nx, nz, s, 0.05, mh + 3, top2, aptAccC, 0.1, 0.1 + w); if (aptEra < 2) wq(a, c2, nx, nz, s, 0.05, mh + 3, top2, aptAccC, 0.1 + w * 1.5, 0.1 + w * 2); } }
          if (aptEra === 1) wq(a, c2, nx, nz, s, 0.2, h - 0.9, h + 0.36, aptAccC);
        }
        // 낮은 상가: 1층 간판 띠 (밤에 빛난다)
        if ((kind === 2 || kind === 0) && h < 30 && mh < 1 && L > 4 && r() < (M.shops?.length ? 0 : 0.55)) { const sc = new THREE.Color(['#ff5a5f', '#ffd23f', '#3db8ff', '#7be07b', '#ff9ec0', '#f2e6d0', '#ff8a3d'][Math.floor(r() * 7)]), q = signs.P.length / 3, o = 0.08; signs.P.push(a[0] + nx * o, 3.1, a[1] + nz * o, c2[0] + nx * o, 3.1, c2[1] + nz * o, c2[0] + nx * o, 3.9, c2[1] + nz * o, a[0] + nx * o, 3.9, a[1] + nz * o); for (let t = 0; t < 4; t++) { signs.N.push(nx, 0, nz); signs.Cl.push(sc.r, sc.g, sc.b); } if (s < 0) signs.I.push(q, q + 1, q + 2, q, q + 2, q + 3); else signs.I.push(q, q + 2, q + 1, q, q + 3, q + 2); }
      }
      let tris; try { tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []); } catch { tris = []; }
      const k = base(); for (const [x, z] of top) { set.P.push(x, h, z); set.N.push(0, 1, 0); set.U.push(0.003, 0.003); set.Cl.push(roofC.r, roofC.g, roofC.b); }
      for (const t of tris) { const [A, B, Cc] = t.map((v) => ring[v]); const up = (B[1] - A[1]) * (Cc[0] - A[0]) - (B[0] - A[0]) * (Cc[1] - A[1]); if (up > 0) set.I.push(k + t[0], k + t[1], k + t[2]); else set.I.push(k + t[0], k + t[2], k + t[1]); }
      // 떠 있는 건물(아케이드 · 필로티 위 · 고가 밑)은 아랫면도: 지붕은 윗면만 있어 밑에서 올려다보면 하늘이 보였다 (시장 아케이드 안). 시장 지붕은 밝은 크림색 채광판
      if (mh > 2.5) { const k3 = base(), cc = /시장/.test(name) && h - mh < 3 ? C_ARC : roofC.clone().multiplyScalar(0.62); for (const [x, z] of ring) { set.P.push(x, mh, z); set.N.push(0, -1, 0); set.U.push(0.003, 0.003); set.Cl.push(cc.r, cc.g, cc.b); }
        for (const t of tris) { const [A, B, Cc] = t.map((v) => ring[v]); const up = (B[1] - A[1]) * (Cc[0] - A[0]) - (B[0] - A[0]) * (Cc[1] - A[1]); if (up > 0) set.I.push(k3 + t[0], k3 + t[2], k3 + t[1]); else set.I.push(k3 + t[0], k3 + t[1], k3 + t[2]); } }
      let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
      { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } const fi = (this.foot ||= []).length; this.foot.push({ ring: LM?.scale ? top : ring, h, x0, x1, z0, z1, name, type, bi, mh: mh > 2.5 ? mh : undefined, base: curY === curY ? curY : undefined, tp: LM?.taper && top !== ring ? tp : undefined }); this.footGrid ||= new Map(); for (let gx = Math.floor(x0 / 40); gx <= Math.floor(x1 / 40); gx++) for (let gz = Math.floor(z0 / 40); gz <= Math.floor(z1 / 40); gz++) { const k = `${gx},${gz}`; if (!this.footGrid.has(k)) this.footGrid.set(k, []); this.footGrid.get(k).push(fi); } }
      // 옥상 설비 (높은 건물)
      // 아파트 옆벽: 위쪽에 단지 이름 + 큰 동 번호 (한국 아파트처럼)
      if (type === 'apt' && h > 14) { const realNo = /(\d+)동$/.exec(name || '')?.[1], key = (name || '').replace(/\s*\d+동$/, '').replace(/\s*(아파트|APT)\s*/gi, '').replace(/\(.*?\)/g, '').trim().slice(0, 6); this.aptNo ||= {}; const no = realNo ? +realNo : (this.aptNo[key || '_'] = (this.aptNo[key || '_'] || 0) + 1) + (key ? 0 : 100); const edges = ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; return { a, b, L: Math.hypot(b[0] - a[0], b[1] - a[1]) }; }).filter((e) => e.L > 6).sort((p, q) => p.L - q.L).slice(0, 2); for (const e of edges) { const mx = (e.a[0] + e.b[0]) / 2, mz = (e.a[1] + e.b[1]) / 2; let nx = mx - cx, nz = mz - cz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; (this.aptMarks ||= []).push({ x: mx + nx * 0.1, z: mz + nz * 0.1, y: h - 0.4, w: Math.min(e.L * 0.98, 18), hh: Math.min(10, h * 0.32), ry: Math.atan2(nx, nz), text: key, no }); } }
      // 한옥 기와지붕: 처마가 벽 밖으로 나오고 끝이 살짝 들린 우진각 지붕 (짙은 회색 기와)
      if (type === 'hanok') (this.hanokRoofs ||= []).push({ ring, h, rh: LMK[name]?.roofH });
      // 오래된 단독주택(1992년 전 · 2층 이하 · 작은 집): 절반쯤은 슬레이트 · 기와 박공 지붕 (강북 · 성북 골목 집들처럼, 나머지는 옥상 평지붕)
      else if (info && info[0] === 1 && info[2] && info[2] < 1992 && h <= 8.5 && ring.length <= 6 && Math.abs(ringArea(ring)) < 220 && r() < 0.5) (this.slateRoofs ||= []).push({ ring, h, c: ['#4d5c6e', '#5d6670', '#8a4a3a', '#3f5a4a', '#6e5a4a', '#4a6a8a'][Math.floor(r() * 6)] });
      // 거리 상가 옥상: 옥탑방 · 물탱크 · 난간 (골목 감성)
      if ((type === 'street' || type === 'street2') && h > 6) { const area = Math.abs(ringArea(ring)), w = Math.min(5, Math.sqrt(area) * 0.4); if (r() < 0.45) box(cx + (r() - 0.5) * w * 0.6, h + 1.3, cz + (r() - 0.5) * w * 0.6, w, 2.6, w * 0.8, new THREE.Color(['#e8e4dc', '#d9e3ea', '#f0e2d0', '#c9d8c4'][Math.floor(r() * 4)])); if (r() < 0.4) box(cx + (r() - 0.5) * w, h + 0.8, cz + (r() - 0.5) * w, 1.4, 1.6, 1.4, new THREE.Color(r() < 0.5 ? '#3d7fbf' : '#f2f2ee')); }
      // 높은 빌딩 옥상 헬리패드 (초록 바탕 · 흰 원 · H)
      const area0 = Math.abs(ringArea(ring)), heli = h > 45 && area0 > 520 && !LMK[name]?.crown && !LM?.taper && !/63|IFC/.test(name) && r() < 0.8; if (heli) { let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; } const ang = 0.5 * Math.atan2(2 * xz, xx - zz); let half = Infinity; for (const [x, z] of ring) half = Math.min(half, Math.hypot(x - cx, z - cz)); (this.helis ||= []).push([cx, h + 0.12, cz, Math.min(12, Math.sqrt(area0) * 0.26, half * 0.62), -ang]); }
      if (h > 40 && !heli && !LM?.taper && !/63|IFC|파크원|전경련/.test(name)) { const area = Math.abs(ringArea(ring)), w = Math.sqrt(area) * 0.32; box(cx, h + 1.6, cz, w, 3.2, w * 0.8, new THREE.Color('#8e8c88')); }
      // 파크원: 모서리를 따라 오르는 빨간 철골 기둥과 가로대
      if (/파크원|NH금융타워/.test(name)) { const red = new THREE.Color('#d8382a'); for (let i = 0; i < ring.length; i++) { const [x, z] = ring[i], ox = x + (x - cx) * 0.04, oz = z + (z - cz) * 0.04; box(ox, (mh + h) / 2, oz, 2.2, h - mh, 2.2, red); } for (let y = mh + 60; y < h - 20; y += 96) for (let i = 0; i < ring.length; i++) { const a = ring[i], c2 = ring[(i + 1) % ring.length], L = Math.hypot(c2[0] - a[0], c2[1] - a[1]); box((a[0] + c2[0]) / 2 + ((a[0] + c2[0]) / 2 - cx) * 0.04, y, (a[1] + c2[1]) / 2 + ((a[1] + c2[1]) / 2 - cz) * 0.04, L, 1.6, 1.2, red, -Math.atan2(c2[1] - a[1], c2[0] - a[0])); } }
      if (LMK[name]?.domeTop) { const D = LMK[name].domeTop; domes.push([cx, h, cz, D.r, D.h, D.c, curY]); }
      if (dome) { let rc = '#4f9e8c'; try { rc = rci >= 0 ? `#${new THREE.Color(M.colors[rci]).getHexString()}` : rc; } catch { /* 기본 */ } domes.push([cx, h, cz, domeR, domeH, rc, curY]); }
    }
    fillY();
    this.winTex = {}; this.litTex = {}; this.bldM = [];
    for (const t of types) {
      const st = sets[t]; if (!st.P.length) continue;
      if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
      this.winTex[t] = facadeTex(t, false, 3); this.litTex[t] = facadeTex(t, true, 3);
      const shiny = t === 'glass' || t === 'gold';
      if (t === 'assembly') { const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: this.winTex[t], emissive: '#fff0d8', emissiveIntensity: 0 }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(st.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(st.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(st.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(st.Cl, 3)); g.setIndex(st.I); g.userData.baseY = new Float32Array(st.Y); this.scene.add(new THREE.Mesh(g, m)); this.assemblyM = m; continue; }
      const m = shiny ? new THREE.MeshPhongMaterial({ vertexColors: true, map: this.winTex[t], emissive: '#ffffff', emissiveMap: this.litTex[t], emissiveIntensity: 0, shininess: t === 'gold' ? 90 : 70, specular: t === 'gold' ? '#ffe2a0' : '#9fb4c8' })
        : new THREE.MeshLambertMaterial({ vertexColors: true, map: this.winTex[t], emissive: '#ffffff', emissiveMap: this.litTex[t], emissiveIntensity: 0 });
      if (shiny) skyGlass(m, this.skyU, t === 'gold');
      snowify(m); winLights(m, WIN_GRID[t]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(st.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(st.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(st.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(st.Cl, 3)); g.setAttribute('aWin', new THREE.Float32BufferAttribute(st.W, 3)); g.setIndex(st.I); g.userData.baseY = new Float32Array(st.Y);
      const mesh = new THREE.Mesh(g, m); mesh.castShadow = false; mesh.receiveShadow = true; this.scene.add(mesh); this.bldM.push(m); (this.bldByType ||= {})[t] = m;
    }
    const mk = (S, m) => { if (!S.P.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(S.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(S.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(S.Cl, 3)); g.setIndex(S.I); if (S.Y) g.userData.baseY = new Float32Array(S.Y); const me = new THREE.Mesh(g, m); this.scene.add(me); return me; };
    yield; t0 = performance.now();
    // 옥상 설비 · 실외기 · 난간 띠: 서울 전체 칸에서는 500m 칸으로 나눠 900m 밖은 그리지 않는다 (칸 하나에 삼각형이 가장 많은 덩어리였다)
    if (this.isChunk) { const em = snowify(new THREE.MeshLambertMaterial({ vertexColors: true })); for (const part of (yield* splitCellsGen(extras, 500))) { if (performance.now() - t0 > 8) { yield; t0 = performance.now(); } const me = mk(part, em); if (me) { me.userData.lodV = [part.cx, part.cz, 900]; me.userData.noMerge = true; } } }
    else mk(extras, snowify(new THREE.MeshLambertMaterial({ vertexColors: true })));
    if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
    this.signM = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0, side: THREE.DoubleSide }); mk(signs, this.signM);
    this.crossM = new THREE.MeshLambertMaterial({ color: '#f4f1ea', emissive: '#ff3030', emissiveIntensity: 0 });
    for (const ring of crosses) { const f = this.foot?.find((q) => q.ring === ring); if (!f) continue; let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; const big = Math.sqrt(Math.abs(ringArea(ring))) > 40, H2 = big ? 14 : 6; const pole = new THREE.Mesh(new THREE.BoxGeometry(big ? 1.2 : 0.5, H2, big ? 1.2 : 0.5), this.crossM); pole.position.set(cx, f.h + H2 / 2, cz); const bar = new THREE.Mesh(new THREE.BoxGeometry(big ? 6 : 2.6, big ? 1.2 : 0.5, big ? 1.2 : 0.5), this.crossM); bar.position.set(cx, f.h + H2 * 0.72, cz); if (f.base !== undefined) { pole.position.y += f.base; bar.position.y += f.base; pole.userData.based = bar.userData.based = true; } this.scene.add(pole, bar); }
    if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
    { const best = {}; for (const q of this.lmQueue || []) { const v = Math.abs(ringArea(q.ring)) * q.h, b2 = best[q.name]; if (!b2 || v > b2.v) best[q.name] = { q, v }; } for (const q of this.lmQueue || []) if (best[q.name].q !== q) (this.lmParts[q.name] ||= []).push({ ring: q.ring, h: q.h }); for (const { q } of Object.values(best)) { const n0 = this.scene.children.length; buildLandmarkExtras(this, q);
      // 서울 칸: 덧붙인 모양도 건물과 같은 바닥 높이(둘레 가장 낮은 땅)에. 그냥 두면 40m 넘는 것은 꼭짓점마다 땅을 따라 기울고, 작은 것은 가운데 땅 높이라 건물과 어긋났다
      if (useBase) { let lo = Infinity; for (const P3 of [q.ring, ...(this.lmParts[q.name] || []).map((p3) => p3.ring)]) for (const [x, z] of P3) lo = Math.min(lo, this.terrAt(x, z, true)); lo -= 0.15; for (let k = n0; k < this.scene.children.length; k++) { const o = this.scene.children[k]; if (o.userData.noDrape || o.userData.based) continue; o.position.y += lo; o.userData.based = true; } } } }
    if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
    // 아파트 동 번호: 글씨 그림 한 장(2048 × 2048, 256 × 160 칸 96개)에 모아 그리고, 판은 한 덩어리로 (예전엔 번호마다 재질 하나 → 서울 칸 9개에서 900번 그리기)
    if (this.aptMarks?.length) {
      const slots = new Map(), pages = [], CW = 256, CH = 160, PER = 8 * 12;
      const slotOf = (text, no) => { const k = `${text}|${no}`; if (slots.has(k)) return slots.get(k); const n = slots.size, pi = Math.floor(n / PER), q = n % PER;
        if (!pages[pi]) { const cv = document.createElement('canvas'); cv.width = cv.height = 2048; pages[pi] = { cv, c: cv.getContext('2d'), P: [], N: [], U: [], I: [], Y: [] }; }
        const { c } = pages[pi], x0 = (q % 8) * CW, y0 = Math.floor(q / 8) * CH; c.fillStyle = '#eeebe4'; c.fillRect(x0, y0, CW, CH); c.fillStyle = '#4d6994'; c.textAlign = 'center'; c.textBaseline = 'middle'; if (text) { c.font = 'bold 30px sans-serif'; c.fillText(text, x0 + 128, y0 + 34, 220); } c.font = 'bold 84px sans-serif'; c.fillText(String(no), x0 + 128, y0 + (text ? 104 : 84));
        const sl = { pi, u0: (x0 + 2) / 2048, u1: (x0 + CW - 2) / 2048, v1: 1 - (y0 + 2) / 2048, v0: 1 - (y0 + CH - 2) / 2048 }; slots.set(k, sl); return sl; };
      for (const a of this.aptMarks) { const sl = slotOf(a.text, a.no), G = pages[sl.pi], cs = Math.cos(a.ry), sn = Math.sin(a.ry), b = G.P.length / 3;
        for (const [lx, ly, u, v] of [[-0.5, 0, sl.u0, sl.v1], [0.5, 0, sl.u1, sl.v1], [0.5, -1, sl.u1, sl.v0], [-0.5, -1, sl.u0, sl.v0]]) { const X = lx * a.w, Y = ly * a.hh; G.P.push(a.x + X * cs, a.y + Y, a.z - X * sn); G.N.push(sn, 0, cs); G.U.push(u, v); G.Y.push(a.by ?? NaN); }
        G.I.push(b, b + 3, b + 1, b + 1, b + 3, b + 2); }
      for (const G of pages) { const t = new THREE.CanvasTexture(G.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.U, 2)); g.setIndex(G.I); g.userData.baseY = new Float32Array(G.Y); this.scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -2 }))); }
    }
    if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
    if (this.slateRoofs?.length) { const P = [], I = [], C = [], HY = [], col = new THREE.Color(); for (const { ring, h, c, by } of this.slateRoofs) { let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; const n = ring.length, size = Math.sqrt(Math.abs(ringArea(ring))), H = Math.min(2.6, size * 0.26), b = P.length / 3, sc = (k) => ring.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
        col.set(c); for (const [k, y, dk] of [[1.1, 0.25, 0.82], [0.5, H * 0.72, 1], [0.08, H, 1.08]]) for (const [x, z] of sc(k)) { P.push(x, h + y, z); C.push(col.r * dk, col.g * dk, col.b * dk); HY.push(by ?? NaN); }
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; for (const [a0, b0] of [[0, n], [n, 2 * n]]) I.push(b + a0 + i, b + a0 + j, b + b0 + j, b + a0 + i, b + b0 + j, b + b0 + i); } for (let i = 1; i < n - 1; i++) I.push(b + 2 * n, b + 2 * n + i, b + 2 * n + i + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); g.userData.baseY = new Float32Array(HY);
      this.scene.add(new THREE.Mesh(g, snowify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })))); }
    if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
    if (this.hanokRoofs?.length) { const P = [], I = [], HY = []; for (const { ring, h, rh, by } of this.hanokRoofs) { let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; const out = ring.map(([x, z]) => [cx + (x - cx) * 1.22, cz + (z - cz) * 1.22]), mid = ring.map(([x, z]) => [cx + (x - cx) * 0.55, cz + (z - cz) * 0.55]), top = ring.map(([x, z]) => [cx + (x - cx) * 0.12, cz + (z - cz) * 0.12]), size = Math.sqrt(Math.abs(ringArea(ring))), H = rh || Math.min(4, size * 0.32), n = ring.length, b = P.length / 3;
        for (const [x, z] of out) P.push(x, h + 0.35, z); for (const [x, z] of mid) P.push(x, h + H * 0.62, z); for (const [x, z] of top) P.push(x, h + H, z); while (HY.length < P.length / 3) HY.push(by ?? NaN);
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; for (const [a0, b0] of [[0, n], [n, 2 * n]]) I.push(b + a0 + i, b + a0 + j, b + b0 + j, b + a0 + i, b + b0 + j, b + b0 + i); } for (let i = 1; i < n - 1; i++) I.push(b + 2 * n, b + 2 * n + i, b + 2 * n + i + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); g.userData.baseY = new Float32Array(HY);
      const tile = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#4a4e55'; c.fillRect(0, 0, 64, 64); for (let x = 0; x < 64; x += 8) { c.fillStyle = '#5a5f66'; c.fillRect(x, 0, 4, 64); } const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
      this.scene.add(new THREE.Mesh(g, snowify(new THREE.MeshLambertMaterial({ color: '#5b6068', side: THREE.DoubleSide })))); }
    if (performance.now() - t0 > 8) { yield; t0 = performance.now(); }
    if (this.helis?.length) { const t = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#4f9e7c'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#f4f4ee'; c.lineWidth = 7; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke(); c.fillStyle = '#f4f4ee'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 64, 68); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.strokeRect(4, 4, 120, 120); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
      const hg2 = new THREE.PlaneGeometry(1, 1); hg2.rotateX(-Math.PI / 2); const im = new THREE.InstancedMesh(hg2, new THREE.MeshLambertMaterial({ map: t }), this.helis.length), o = new THREE.Object3D(); im.userData.baseY = this.helis.map((q) => q.by ?? NaN); this.helis.forEach(([x, y, z, sz, ry], i) => { o.position.set(x, y, z); o.scale.set(sz * 2, 1, sz * 2); o.rotation.y = ry; o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); this.scene.add(im); }
    const dm = new THREE.MeshPhongMaterial({ color: '#4f9e8c', shininess: 40, emissive: '#2a5a50', emissiveIntensity: 0 }); this.domeM = dm;
    for (const [x, y, z, rad, dh, rc, by] of domes) { const m2 = dm.clone(); m2.color.set(rc).offsetHSL(0, 0.05, -0.06); this.domeMs = [...(this.domeMs || []), m2]; const d = new THREE.Mesh(new THREE.SphereGeometry(rad, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), m2); d.scale.y = dh / rad; d.position.set(x, y, z); if (by === by && by !== undefined) { d.position.y += by; d.userData.based = true; } this.scene.add(d); }
  }
  // 멀리: 높은 건물 상자들 (실제 위치) · 남산타워 · 산 능선
  buildFar() {
    const M = this.map, S = M.scale, n = (M.tall || []).length;
    if (n) {
      const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 6);
      const m = new THREE.MeshLambertMaterial({ map: this.winTex.stone || facadeTex('stone', false, 3), emissive: '#ffffff', emissiveMap: this.litTex.stone || facadeTex('stone', true, 3), emissiveIntensity: 0 }); winLights(m, [8, 8], true);
      // 밤 창문: 상자마다 씨앗 · 조명 종류 (유리 = 회사, 아파트 = 집)
      g.setAttribute('aWin', new THREE.InstancedBufferAttribute(new Float32Array(M.tall.flatMap(([x, z, , , , , k]) => [winSeed(x, z), k === 2 ? 0 : 2, 1])), 3));
      const im = new THREE.InstancedMesh(g, m, n), o = new THREE.Object3D(), c = new THREE.Color();
      M.tall.forEach(([x, z, w, d, a, h, k], i) => { o.position.set(x * S, 0, z * S); o.rotation.set(0, -a / 100, 0); o.scale.set(Math.max(8, w * S), h, Math.max(8, d * S)); o.updateMatrix(); im.setMatrixAt(i, o.matrix); c.set(k === 1 ? '#a9bccb' : k === 2 ? '#e8e2d6' : '#cfcac0').offsetHSL(0, 0, (Math.sin(i * 12.9) * 0.5) * 0.06); im.setColorAt(i, c); });
      this.scene.add(im); this.farM = m; this.farIM = im;
    }
    for (const [name, x, z, h] of M.far || []) {
      const X = x * S, Z = z * S, dist = Math.hypot(X, Z); if (dist > 12000) continue;
      if (/남산/.test(name)) {
        const hill = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4f6e45' })); hill.scale.y = 0.42; hill.position.set(X, 0, Z); this.scene.add(hill);
        const t = new THREE.Group(), wm = new THREE.MeshLambertMaterial({ color: '#e8e8ea' });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 7, 135, 12), wm); shaft.position.y = 135 / 2; t.add(shaft);
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(14, 11, 16, 16), wm); pod.position.y = 128; t.add(pod);
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 90, 6), new THREE.MeshLambertMaterial({ color: '#d84a3a' })); ant.position.y = 180; t.add(ant);
        t.position.set(X, 218, Z); this.scene.add(t); this.towerTop = new THREE.Vector3(X, 218 + 226, Z);
      }
    }
    // 서울을 둘러싼 산 (북한산 · 관악산 쪽 높게)
    const ring = [], N = 160; for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, R = 11000 + Math.sin(a * 3.1) * 900, north = Math.max(0, -Math.sin(a)), hh = 240 + north * 520 + Math.max(0, Math.sin(a)) * 380 + (Math.sin(a * 23) * 0.5 + Math.sin(a * 57) * 0.3) * 120; ring.push([Math.cos(a) * R, Math.sin(a) * R, hh]); }
    const P = [], I = []; ring.forEach(([x, z, hh], i) => { P.push(x, -20, z, x, hh, z); if (i) { const k = i * 2; I.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
    this.mtM = new THREE.MeshBasicMaterial({ color: '#7f95a8', fog: false, side: THREE.DoubleSide }); const mt = new THREE.Mesh(geoOf(P, I), this.mtM); mt.renderOrder = -90; this.scene.add(mt);
    // 서울 전체: 가짜 산 고리(지도 가운데 둘레 11km) 대신 진짜 지형 전체를 성기게(200m) 한 덩어리로 — 멀리 북한산 · 관악산이 실제로 보인다. 가까운 칸 땅이 그 위에 그려진다
    if (M.kind === 'world' && this.terr) { mt.visible = false; this.buildFarTerrain(); }
  }
  buildFarTerrain() {
    const T = this.terr, st = 4, nx = Math.floor((T.nx - 1) / st) + 1, nz = Math.floor((T.nz - 1) / st) + 1, P = new Float32Array(nx * nz * 3), C = new Float32Array(nx * nz * 3), I = [], c = new THREE.Color(), lo = new THREE.Color('#6f8f5a'), hi = new THREE.Color('#8d8f86'), wat = new THREE.Color('#4b6b82'), city = new THREE.Color('#9a9890');
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, h = T.h[j * st * T.nx + i * st]; P[k * 3] = T.x0 + i * st * T.step; P[k * 3 + 1] = h - 1.5; P[k * 3 + 2] = T.z0 + j * st * T.step;
      if (h <= 0.2) c.copy(wat); else if (h < 40) c.copy(city).lerp(lo, h / 40); else c.copy(lo).lerp(hi, Math.min(1, (h - 40) / 400)); C[k * 3] = c.r; C[k * 3 + 1] = c.g; C[k * 3 + 2] = c.b; }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + nx; I.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6 })); m.renderOrder = -62; m.receiveShadow = false; this.scene.add(m); this.farTerrain = m;
    // 불러온 칸 안에서는 먼 땅을 40m 내린다: 200m 성긴 격자라 골짜기 · 칸이 평평하게 깎은 땅 위로 1m 가까이 솟아 곰이 잔디에 묻혔다 (성북구 2292, -6477)
    //   uL = 지금 칸 둘레 5 × 5 중 불러온 칸 (tickWorld 가 채운다). 칸 경계 꼭짓점은 이웃 칸 하나라도 있으면 내린다
    const TL = (this.world0?.tile || 2000).toFixed(1), U = (this.farU = { uC: { value: new THREE.Vector2(1e6, 1e6) }, uL: { value: new Float32Array(25) } });
    m.material.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform vec2 uC; uniform float uL[25];
float farIn(vec2 p) { vec2 t = floor(p / ${TL}) - uC + 2.0; if (t.x < 0.0 || t.y < 0.0 || t.x > 4.0 || t.y > 4.0) return 0.0; return uL[int(t.y) * 5 + int(t.x)]; }`).replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec2 p = position.xz; transformed.y -= 40.0 * max(max(farIn(p + vec2(1.0, 1.0)), farIn(p + vec2(-1.0, 1.0))), max(farIn(p + vec2(1.0, -1.0)), farIn(p + vec2(-1.0, -1.0)))); }`); };
    m.material.customProgramCacheKey = () => 'farTerr';
  }
  // 나무 · 풀 · 꽃: 길 양옆에 줄지어, 공원 안에 흩어서
  buildPlants(inWater, r) {
    const spots = [], near = isPhone ? 0.55 : 1;
    // 물 · 다리(경사로 포함, 둘레 4m) · 건물 안에는 심지 않는다 (다리를 가로막지 않게)
    const okAt = (x, z) => !inWater(x, z) && !this.nearDeck(x, z, 4) && this.groundAt(x, z, 9999) === 0;
    // 찻길(차로 폭 + 0.6m) 위에는 어떤 나무도 심지 않는다 (8-24: 홍대 앞 찻길 한가운데 나무 줄). 나뉜 큰길은 한쪽 가로수 자리가 반대쪽 찻길 위였다
    // 서울 칸: 칸 지도의 길 목록엔 칸을 지나는 길이 다 들어 있지 않다 → 이미 불러온 이웃 칸의 길도 함께 본다 (나중에 불러온 칸 길 위 나무는 cullTrees 가 숨긴다)
    const SR = this.map.scale, rg = new Map(), RG = 30; for (const rd of [...(this.map.roads || []), ...(this.isChunk ? [...(this.host?.chunks?.values() || [])].filter((c2) => c2 !== this && c2.map?.scale === SR).flatMap((c2) => c2.map.roads || []) : [])]) { const w = rd[0], pts = unpack(rd.slice(2), SR); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], e = w / 2 + 1; for (let gx = Math.floor((Math.min(a[0], b[0]) - e) / RG); gx <= Math.floor((Math.max(a[0], b[0]) + e) / RG); gx++) for (let gz = Math.floor((Math.min(a[1], b[1]) - e) / RG); gz <= Math.floor((Math.max(a[1], b[1]) + e) / RG); gz++) { const kk = `${gx},${gz}`; if (!rg.has(kk)) rg.set(kk, []); rg.get(kk).push([a, b, w / 2 + 0.6]); } } }
    const onRoad = (x, z) => { for (const [a, b, hw] of rg.get(`${Math.floor(x / RG)},${Math.floor(z / RG)}`) || []) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < hw) return true; } return false; };
    // 강 쪽은 탁 트이게 드문드문, 공원 쪽은 줄지어 (코스가 있는 지역 지도만. 서울 칸의 '코스'는 칸 가운데를 가로지르는 가짜 선이라, 거기 심으면 찻길을 가로지르는 나무 줄이 생겼다)
    const course = this.map.kind !== 'tile';
    if (course) for (let s = 4; s < this.L; s += 9 / near) for (const lat of [-12.5, 7.5]) { if (lat < 0 && r() < 0.72) continue; const j = lat + (r() - 0.5) * 2.4, [x, z] = this.world(s + (r() - 0.5) * 3, j); if (okAt(x, z) && !onRoad(x, z)) spots.push([x, z, 0.7 + r() * 0.3]); }
    // 공원 안 (코스 주변 450m)
    if (course) for (let n = 0; n < 2600 * near; n++) { const s = r() * this.L, lat = (r() < 0.25 ? -1 : 1) * (12 + r() * 260), [x, z] = this.world(s, lat); if (okAt(x, z) && !onRoad(x, z) && this.greenPolys.some((g) => inPoly(x, z, g))) spots.push([x, z, 0.7 + r() * 0.6]); }
    for (const [x, z] of this.extraTrees || []) if (!onRoad(x, z)) spots.push([x, z, 0.85 + r() * 0.35]);
    // 서울 전체 칸: 코스가 없으니 칸 전체에서 — 숲은 빽빽이, 공원 · 잔디는 드문드문(넓이에 맞게), 큰길(폭 10m 이상)은 양옆 가로수
    if (this.map.kind === 'tile') {
      const M = this.map, S = M.scale, kinds = new Map(); for (const g of M.green) kinds.set(g, g[0]);
      const lim = Math.round((isPhone ? 2600 : 6000) * near); let n0 = spots.length;
      for (const g of M.green) { const kind = g[0]; if (kind === 'pitch' || kind === 'sand') continue; const poly = g.slice(1).map((rg) => unpack(rg, S)); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of poly[0] || []) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } if (!isFinite(x0)) continue;
        const area = Math.abs(ringArea(poly[0])), per = kind === 'wood' ? 110 : kind === 'wild' ? 260 : 420, want = Math.min(900, Math.round((area / per) * near));
        for (let t = 0, got = 0; t < want * 3 && got < want && spots.length - n0 < lim; t++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); if (!inPoly(x, z, poly) || !okAt(x, z) || onRoad(x, z)) continue; spots.push([x, z, (kind === 'wood' ? 0.8 : 0.7) + r() * 0.6]); got++; } }
      for (const rd of M.roads) { if (rd[1] || rd[0] < 10) continue; const pts = unpack(rd.slice(2), S), off = rd[0] / 2 + 1.6;
        for (let k = 1; k < pts.length && spots.length - n0 < lim; k++) { const [ax, az] = pts[k - 1], [bx, bz] = pts[k], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue; const ux = (bx - ax) / L, uz = (bz - az) / L;
          for (let t = 6; t < L - 4; t += 11 / near) for (const sd of [-1, 1]) { const x = ax + ux * t - uz * off * sd, z = az + uz * t + ux * off * sd; if (okAt(x, z) && !onRoad(x, z) && !this.water.some((w) => inPoly(x, z, w))) spots.push([x, z, 0.62 + r() * 0.2]); } } }
      // 숲(wood) 채우기: 나무 지붕이 맞닿게 촘촘히 (약 6.5m 간격 · 흔들린 격자라 줄 맞춰 보이지 않게). 산책로 · 찻길 · 물 · 건물 자리는 비운다
      //   칸 하나에 많아야 8000 그루(넓은 산은 그만큼 성기게), 가벼운 나무(잎 판 적게 · 줄기 단순)로 가까운 500m 칸만 그린다
      const PG = new Map(); for (const pa of M.paths || []) { if (pa[0]) continue; const pts = unpack(pa.slice(2), S), hw = (pa[1] || 2) / 2 + 1.1; for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; for (let gx = Math.floor((Math.min(a[0], b[0]) - hw) / RG); gx <= Math.floor((Math.max(a[0], b[0]) + hw) / RG); gx++) for (let gz = Math.floor((Math.min(a[1], b[1]) - hw) / RG); gz <= Math.floor((Math.max(a[1], b[1]) + hw) / RG); gz++) { const kk = `${gx},${gz}`; if (!PG.has(kk)) PG.set(kk, []); PG.get(kk).push([a, b, hw]); } } }
      const onPath = (x, z) => { for (const [a, b, hw] of PG.get(`${Math.floor(x / RG)},${Math.floor(z / RG)}`) || []) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < hw) return true; } return false; };
      const woods = M.green.filter((g) => g[0] === 'wood').map((g) => g.slice(1).map((rg2) => unpack(rg2, S))); let wA = 0; for (const p of woods) wA += Math.abs(ringArea(p[0]));
      const FB = Math.round((isPhone ? 2500 : 8000) * near), sp = Math.max(6.4, Math.sqrt(wA / Math.max(1, FB))), fill = (this.forestFill = []);
      for (const poly of woods) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of poly[0] || []) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
        for (let gx = x0; gx < x1 && fill.length < FB; gx += sp) for (let gz = z0; gz < z1; gz += sp) { const x = gx + r() * sp, z = gz + r() * sp; if (!inPoly(x, z, poly) || !okAt(x, z) || onRoad(x, z) || onPath(x, z)) continue; fill.push([x, z, 0.8 + r() * 0.55]); } }
    }
    // 서울 칸: 길 · 공원은 칸 밖까지 통째로 들어 있어, 칸 밖에 심은 나무가 이웃 칸 찻길 위에 서거나 이웃 칸 나무와 겹쳤다 → 내 칸 안에만 심는다
    if (this.isChunk && this.chunkKey && this.host?.world0) { const T0 = this.host.world0.tile, [ti, tj] = this.chunkKey.split('_').map(Number), mine = (p) => p[0] >= ti * T0 && p[0] < (ti + 1) * T0 && p[1] >= tj * T0 && p[1] < (tj + 1) * T0; for (const A of [spots, this.forestFill || []]) { let w = 0; for (const p of A) if (mine(p)) A[w++] = p; A.length = w; } }
    for (const [x, z, k] of this.forestFill || []) this.addCircle(x, z, 0.3 * k, 7);
    this.trees = spots; for (const [x, z, k] of spots) this.addCircle(x, z, 0.34 * k, 7);
    const N = spots.length, o = new THREE.Object3D();
    // 나무 모양 셋: 둥근 활엽수(벚나무 · 느티나무), 키 큰 나무(은행 · 포플러), 소나무. 잎 덩어리 여러 개 + 아래가 어두운 그늘
    const lumps = (defs) => { const gs = defs.map(([x, y, z, rr, sy = 1]) => { const g = new THREE.IcosahedronGeometry(rr, 1); g.scale(1, sy, 1); g.translate(x, y, z); return g; }); const m = mergeGeos(gs); const p = m.attributes.position, cl = []; let y0 = Infinity, y1 = -Infinity; for (let k = 0; k < p.count; k++) { y0 = Math.min(y0, p.getY(k)); y1 = Math.max(y1, p.getY(k)); } for (let k = 0; k < p.count; k++) { const t = (p.getY(k) - y0) / (y1 - y0 || 1), v = 0.62 + t * 0.42; cl.push(v, v, v); } m.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return m; };
    // 잎 카드 수관: 잎 · 꽃 그림을 그린 판 수십 장을 덩어리 둘레에 붙이고, 법선을 덩어리 바깥쪽으로 → 솜털 같은 부드러운 빛
    const cardCrown = (blobs, nCards, size) => {
      const P = [], N = [], U = [], Cl = [], I = []; const rr = rnd(77 + nCards);
      for (let k = 0; k < nCards; k++) {
        const [bx, by, bz, br] = blobs[Math.floor(rr() * blobs.length)];
        const th = rr() * Math.PI * 2, ph = Math.acos(1 - rr() * 1.85), d = br * (0.55 + rr() * 0.5);
        const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
        const cx = bx + nx * d, cy = by + ny * d * 0.85, cz = bz + nz * d, sz = size * (0.75 + rr() * 0.6);
        // 카드 방향: 아무렇게나 (사방에서 볼 때 덩어리처럼)
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr() * 6.28, rr() * 6.28, rr() * 6.28)), ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q), ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const base = P.length / 3, shade = 0.78 + (ny * 0.5 + 0.5) * 0.35 + (d / br - 0.55) * 0.2;
        for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const ox = (u - 0.5) * sz, oy = (v - 0.5) * sz; P.push(cx + ax.x * ox + ay.x * oy, cy + ax.y * ox + ay.y * oy, cz + ax.z * ox + ay.z * oy); N.push(nx, ny * 0.9 + 0.1, nz); U.push(u, v); Cl.push(shade, shade, shade); }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cl, 3)); g.setIndex(I); return g;
    };
    // 줄기: 살짝 휘고 아래가 넓게 퍼진 몸통 + 위로 갈라지는 가지
    const trunkGeo = (h, r0, bend, branches) => {
      const parts = [];
      const body = new THREE.CylinderGeometry(r0 * 0.55, r0, h, 9, 10); body.translate(0, h / 2, 0);
      const p = body.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k), t = y / h, flare = 1 + Math.max(0, 0.18 - t) * 3.2; p.setX(k, p.getX(k) * flare + Math.sin(t * 2.4) * bend); p.setZ(k, p.getZ(k) * flare + Math.sin(t * 1.7 + 1) * bend * 0.5); }
      body.computeVertexNormals(); parts.push(body);
      for (const [ang, tilt, len, at] of branches) { const b = new THREE.CylinderGeometry(r0 * 0.18, r0 * 0.38, len, 6, 3); b.translate(0, len / 2, 0); b.rotateZ(tilt); b.rotateY(ang); b.translate(Math.sin(at * 2.4) * bend, h * at, Math.sin(at * 1.7 + 1) * bend * 0.5); parts.push(b); }
      const m = mergeGeos(parts), pp = m.attributes.position, cl = []; for (let k = 0; k < pp.count; k++) { const v = 0.7 + Math.min(1, pp.getY(k) / h) * 0.35; cl.push(v, v * 0.92, v * 0.86); } m.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return m;
    };
    const SHAPES = [
      { crown: cardCrown([[0, 4.3, 0, 2.1], [1.6, 3.8, 0.5, 1.5], [-1.5, 3.9, -0.6, 1.55], [0.4, 3.7, -1.6, 1.4], [-0.5, 3.6, 1.6, 1.4], [0.2, 5.3, 0.2, 1.4]], isPhone ? 90 : 170, 1.85), trunk: trunkGeo(3.6, 0.32, 0.25, [[0.3, 0.75, 1.9, 0.62], [2.4, 0.8, 1.7, 0.7], [4.4, 0.7, 1.8, 0.66]]), cherry: true },
      { crown: cardCrown([[0, 4.8, 0, 1.4], [0.5, 6.0, 0.3, 1.1], [-0.5, 4.0, -0.3, 1.15], [0.2, 6.9, 0, 0.8]], isPhone ? 50 : 85, 1.5), trunk: trunkGeo(4.0, 0.24, 0.12, [[1, 0.5, 1.4, 0.7], [3.5, 0.55, 1.3, 0.78]]) },
      { crown: (() => { const gs = [[3.0, 2.0, 2.0], [4.3, 1.6, 1.7], [5.4, 1.15, 1.4], [6.3, 0.7, 1.1]].map(([y, rr2, hh]) => { const g = new THREE.ConeGeometry(rr2, hh, 9, 2); g.translate(0, y, 0); const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)); const w = 1 + Math.sin(a * 9) * 0.08; p.setX(k, p.getX(k) * w); p.setZ(k, p.getZ(k) * w); } g.computeVertexNormals(); return g; }); const m = mergeGeos(gs), p = m.attributes.position, cl = []; for (let k = 0; k < p.count; k++) { const v = 0.62 + (p.getY(k) - 2) / 6 * 0.42; cl.push(v, v, v); } m.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return m; })(), trunk: trunkGeo(3.0, 0.2, 0.05, []), pine: true },
    ];
    const kindOf = spots.map(() => { const x = r(); return x < 0.62 ? 0 : x < 0.84 ? 1 : 2; });
    this.treeKinds = kindOf; this.crownSets = []; this.twigSets = [];
    const twigs = []; for (let k = 0; k < 7; k++) { const g = new THREE.CylinderGeometry(0.035, 0.08, 2.3, 4); g.translate(0, 1.15, 0); g.rotateZ(0.5 + (k % 3) * 0.22); g.rotateY((k / 7) * Math.PI * 2); g.translate(0, 3.0, 0); twigs.push(g); }
    for (let k = 0; k < 4; k++) { const g = new THREE.CylinderGeometry(0.02, 0.04, 1.2, 3); g.translate(0, 0.6, 0); g.rotateZ(-0.7); g.rotateY(k * 1.7); g.translate(0.6, 4.2, 0); twigs.push(g); }
    const twigG = mergeGeos(twigs), barkM = new THREE.MeshLambertMaterial({ color: '#7a5240', vertexColors: true }), twigM = new THREE.MeshLambertMaterial({ color: '#6a4838' });
    SHAPES.forEach((sh, t) => {
      const idxAll = spots.map((_, i) => i).filter((i) => kindOf[i] === t); if (!idxAll.length) { this.crownSets.push(null); return; }
      // 서울 전체 칸: 500m 칸마다 따로 (화면 밖 · 먼 칸은 그리지 않게. 칸 하나에 나무가 수천 그루라 삼각형이 가장 많았다)
      const groups = new Map(); for (const i of idxAll) { const k = this.isChunk ? `${Math.floor(spots[i][0] / 500)},${Math.floor(spots[i][1] / 500)}` : '0'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
      for (const [gk, idx] of groups) { const n = idx.length;
      const tg = sh.trunk;
      const cm = sh.pine ? new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }) : new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, map: this.leafTex ||= foliageTex(false), alphaTest: 0.42, side: THREE.DoubleSide }); windify(cm, this.windU, 0.05, true); if (!sh.pine) this.cardMats = [...(this.cardMats || []), cm];
      const crowns = new THREE.InstancedMesh(sh.crown, cm, n), trunks = new THREE.InstancedMesh(tg, barkM, n), tw = sh.pine ? null : new THREE.InstancedMesh(twigG, twigM, n);
      idx.forEach((si, q) => { const [x, z, k] = spots[si]; o.position.set(x, 0, z); o.rotation.set(0, r() * 6.28, 0); o.scale.set(k * (0.85 + r() * 0.3), k * (0.85 + r() * 0.35), k * (0.85 + r() * 0.3)); o.updateMatrix(); crowns.setMatrixAt(q, o.matrix); trunks.setMatrixAt(q, o.matrix); tw?.setMatrixAt(q, o.matrix); });
      for (const m of [crowns, trunks, tw]) if (m) { m.castShadow = true; m.receiveShadow = false; this.scene.add(m); if (this.isChunk) { const [gx, gz] = gk.split(',').map(Number); m.userData.lod = [(gx + 0.5) * 500, (gz + 0.5) * 500, n]; m.userData.noMerge = true; } }
      this.crownSets.push({ crowns, idx, pine: !!sh.pine }); if (tw) this.twigSets.push(tw); (this.treeGroups ||= []).push({ ms: [crowns, trunks, tw], idx }); }
    });
    // 숲 채우기 나무: 둥근 활엽수 · 키 큰 활엽수 · 소나무 (가벼운 모양, 500m 칸마다 · 800m 안에서만 그린다)
    if (this.forestFill?.length) {
      const F = this.forestFill, trunk = (h, r0) => { const g = new THREE.CylinderGeometry(r0 * 0.5, r0, h, 6, 1, true); g.translate(0, h / 2, 0); const p = g.attributes.position, cl = []; for (let k = 0; k < p.count; k++) { const v = 0.6 + (p.getY(k) / h) * 0.4; cl.push(v, v * 0.92, v * 0.86); } g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return g; };
      const pineC = (() => { const gs = [[4.3, 2.0, 2.7], [5.7, 1.5, 2.3], [7.0, 0.9, 1.9]].map(([y, rr2, hh]) => { const g = new THREE.ConeGeometry(rr2, hh, 7, 1); g.translate(0, y, 0); return g; }); const m = mergeGeos(gs), p = m.attributes.position, cl = []; for (let k = 0; k < p.count; k++) { const v = 0.6 + ((p.getY(k) - 3) / 5) * 0.45; cl.push(v, v, v); } m.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); return m; })();
      const FS = [
        { crown: cardCrown([[0, 6.0, 0, 2.1], [1.4, 5.4, 0.5, 1.5], [-1.3, 5.5, -0.6, 1.5], [0.3, 7.1, 0.1, 1.3]], isPhone ? 36 : 64, 2.0), th: 5.6, tr: 0.19 },
        { crown: cardCrown([[0, 6.6, 0, 1.6], [0.5, 7.8, 0.3, 1.2], [-0.4, 5.6, -0.3, 1.3]], isPhone ? 28 : 48, 1.7), th: 6.4, tr: 0.16 },
        { crown: pineC, th: 5.0, tr: 0.15, pine: true },
      ];
      // 줄기는 세 모양을 한 그물로 (칸마다 그리기 한 번): 높이 1 · 굵기 1 짜리를 나무마다 늘린다. 회갈색 (느티나무 · 참나무 껍질), 소나무는 붉은 기
      const unitTrunk = trunk(1, 1), fBark = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), tcol = new THREE.Color();
      const leafM = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, map: this.leafTex ||= foliageTex(false), alphaTest: 0.42, side: THREE.DoubleSide }); windify(leafM, this.windU, 0.05, true); this.cardMats = [...(this.cardMats || []), leafM];
      const pineM = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
      const fk = F.map(() => { const x = r(); return x < 0.5 ? 0 : x < 0.75 ? 1 : 2; });
      const cells = new Map(); F.forEach(([x, z], i) => { const k = `${Math.floor(x / 500)},${Math.floor(z / 500)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
      for (const [gk, all] of cells) {
        const [gx, gz] = gk.split(',').map(Number), lod = (m, n) => { m.receiveShadow = false; this.scene.add(m); m.userData.lod = [(gx + 0.5) * 500, (gz + 0.5) * 500, n, 800]; m.userData.noMerge = true; };
        const trunks = new THREE.InstancedMesh(unitTrunk, fBark, all.length), tOrd = []; let tq = 0;
        FS.forEach((sh, t) => {
          const idx = all.filter((i) => fk[i] === t), n = idx.length; if (!n) return;
          const crowns = new THREE.InstancedMesh(sh.crown, sh.pine ? pineM : leafM, n), tw = sh.pine ? null : new THREE.InstancedMesh(twigG, twigM, n);
          idx.forEach((si, q) => { const [x, z, k] = F[si], sx = k * (0.85 + r() * 0.3), sy = k * (0.85 + r() * 0.35), sz = k * (0.85 + r() * 0.3), ry = r() * 6.28; o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); crowns.setMatrixAt(q, o.matrix); tw?.setMatrixAt(q, o.matrix);
            o.scale.set(sh.tr * sx, sh.th * sy, sh.tr * sz); o.updateMatrix(); trunks.setMatrixAt(tq, o.matrix); tOrd.push(si); trunks.setColorAt(tq++, tcol.set(sh.pine ? '#8a5a44' : r() < 0.5 ? '#7a6e62' : '#6a5e52').offsetHSL(0, 0, (r() - 0.5) * 0.08)); });
          crowns.castShadow = true; lod(crowns, n); if (tw) { lod(tw, n); this.twigSets.push(tw); }
          this.crownSets.push({ crowns, idx, pine: !!sh.pine, forest: true }); (this.treeGroups ||= []).push({ ms: [crowns, tw], idx, arr: 'f' });
        });
        (this.treeGroups ||= []).push({ ms: [trunks], idx: tOrd, arr: 'f' });
        trunks.count = tq; lod(trunks, tq);
      }
    }
    this.treeSeed = r;
    // 풀포기 · 꽃 (길 가까이)
    // 풀잎 다발: 엇갈린 판 세 장 + 풀잎 그림(투명) · 바람에 살랑
    const tuftG = (() => { const gs = []; for (let k = 0; k < 3; k++) { const g = new THREE.PlaneGeometry(0.62, 0.42); g.translate(0, 0.21, 0); g.rotateY((k / 3) * Math.PI); gs.push(g); } const m = mergeGeos(gs.map((g) => { g.setAttribute('uv', g.attributes.uv); return g; })); const uv = []; for (const g of gs) { const u = g.attributes.uv; for (let q = 0; q < (g.index ? g.index.count : u.count); q++) { const ix = g.index ? g.index.array[q] : q; uv.push(u.getX(ix), u.getY(ix)); } } m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return m; })();
    const street = !!this.map.kind && this.map.kind !== 'river', T = street ? 0 : Math.floor(14000 * near), F = street ? 0 : Math.floor(2600 * near);
    const grassM = new THREE.MeshLambertMaterial({ color: '#ffffff', map: bladeTex(), alphaTest: 0.45, side: THREE.DoubleSide });
    windify(grassM, this.windU, 0.11);
    this.tufts = new THREE.InstancedMesh(tuftG, grassM, T); this.tufts.receiveShadow = true;
    this.flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: '#ffffff' }), F);
    let ti = 0, fi = 0; const c = new THREE.Color();
    while (ti < T || fi < F) {
      const s = r() * this.L, lat = (r() < 0.5 ? -1 : 1) * (2.4 + r() * (r() < 0.6 ? 10 : 34)) - (r() < 0.5 ? 4.3 : 0); if (Math.abs(lat + 4.3) < 2.0 || Math.abs(lat) < 2.6) continue;
      const [x, z] = this.world(s, lat); if (inWater(x, z)) continue;
      if (ti < T) { o.position.set(x, 0, z); o.rotation.set(0, r() * 6.28, 0); const k = 0.7 + r() * 0.8; o.scale.set(k, k * (0.7 + r() * 0.6), k); o.updateMatrix(); this.tufts.setMatrixAt(ti, o.matrix); c.setHSL(0.24 + r() * 0.06, 0.5, 0.42 + r() * 0.12); this.tufts.setColorAt(ti, c); ti++; }
      else { o.position.set(x, 0.24 + r() * 0.1, z); o.rotation.set(0, 0, 0); o.scale.setScalar(0.8 + r() * 0.6); o.updateMatrix(); this.flowers.setMatrixAt(fi, o.matrix); c.set(['#ffd23f', '#ffffff', '#ff8ab5', '#b58cff', '#ff6b5a'][Math.floor(r() * 5)]); this.flowers.setColorAt(fi, c); fi++; }
    }
    this.scene.add(this.tufts, this.flowers);
  }
  // 가로등: 달리는 길 옆
  buildLights(r) {
    const poles = [], heads = []; for (let s = 10; s < this.L; s += 32) { const [x, z] = this.world(s, -6.6); if (this.inWater(x, z)) continue; poles.push([x, z]); heads.push(x, 4.6, z); }
    const g = new THREE.CylinderGeometry(0.07, 0.1, 4.6, 6); g.translate(0, 2.3, 0);
    const pm = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#6a717b' }), poles.length), o = new THREE.Object3D();
    poles.forEach(([x, z], i) => { o.position.set(x, 0, z); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); this.addCircle(x, z, 0.16, 5); }); this.scene.add(pm);
    const capG = new THREE.CylinderGeometry(0.16, 0.38, 0.22, 10); capG.translate(0, 4.82, 0);
    const lampG = new THREE.SphereGeometry(0.24, 12, 8); lampG.translate(0, 4.6, 0);
    const caps = new THREE.InstancedMesh(capG, new THREE.MeshLambertMaterial({ color: '#4a5058' }), poles.length);
    this.lampHeadM = new THREE.MeshLambertMaterial({ color: '#fff4dc', emissive: '#ffd08a', emissiveIntensity: 0 });
    const heads2 = new THREE.InstancedMesh(lampG, this.lampHeadM, poles.length);
    poles.forEach(([x, z], i) => { o.position.set(x, 0, z); o.updateMatrix(); caps.setMatrixAt(i, o.matrix); heads2.setMatrixAt(i, o.matrix); }); this.scene.add(caps, heads2);
    this.lampGlow = this.glowPoints(heads, '#ffd79a', 3.2);
    this.lampPool = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: '#ffcf8a', map: this.dot ||= dotTex(), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    // 가로등 불빛 웅덩이: 가까운 몇 개만
    this.pools = []; for (let i = 0; i < 6; i++) { const p = this.lampPool.clone(); p.material = this.lampPool.material; p.rotation.x = -Math.PI / 2; p.scale.setScalar(6); p.renderOrder = -45; this.scene.add(p); this.pools.push(p); }
    this.poleXZ = poles;
    // 길 위 차들 (밤에 불빛 띠): hangang-vehicles.js
    this.traffic.buildFar(r, dotTex);
  }
  // 구름 · 비 · 눈 · 벌레 · 반딧불
  buildSkyStuff(r) {
    const tex = cloudTex(); this.clouds = [];
    for (let i = 0; i < 46; i++) { const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }); const s = new THREE.Sprite(m); const a = r() * 6.28, d = 900 + r() * 5200; s.position.set(Math.cos(a) * d, 420 + r() * 700, Math.sin(a) * d); s.scale.set(900 + r() * 1200, 360 + r() * 380, 1); s.userData = { k: r(), sp: 2 + r() * 4 }; this.scene.add(s); this.clouds.push(s); }
    const RN = isPhone ? 1400 : 3200, rp = new Float32Array(RN * 6); this.rainV = new Float32Array(RN);
    for (let i = 0; i < RN; i++) { const x = (r() - 0.5) * 80, y = r() * 40, z = (r() - 0.5) * 80; rp.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); this.rainV[i] = 24 + r() * 8; }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#c8d4e4', transparent: true, opacity: 0.45 })); this.rain.frustumCulled = false; this.scene.add(this.rain);
    const SN = isPhone ? 1200 : 2600, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) sp.set([(r() - 0.5) * 90, r() * 40, (r() - 0.5) * 90], i * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, map: this.dot ||= dotTex(), transparent: true, depthWrite: false })); this.snow.frustumCulled = false; this.scene.add(this.snow);
    // 나비 · 잠자리 (낮) · 반딧불 (여름밤): 내 주변을 맴돈다
    this.bugs = []; const wingG = new THREE.PlaneGeometry(0.16, 0.16); wingG.translate(0.08, 0, 0); const bodyG = new THREE.CylinderGeometry(0.008, 0.012, 0.11, 5); bodyG.rotateX(Math.PI / 2); const wingTex = [0, 1, 2, 3].map((k) => butterflyTex(k));
    for (let i = 0; i < 14; i++) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#ffffff', map: wingTex[i % 4], side: THREE.DoubleSide, alphaTest: 0.4 }); const a = new THREE.Mesh(wingG, m), b = new THREE.Mesh(wingG, m); b.scale.x = -1; a.rotation.x = b.rotation.x = -Math.PI / 2; const wa = new THREE.Group(), wb = new THREE.Group(); wa.add(a); wb.add(b); g.add(wa, wb, new THREE.Mesh(bodyG, new THREE.MeshBasicMaterial({ color: '#2a2018' }))); g.userData = { a: wa, b: wb, m, ph: r() * 6, ox: (r() - 0.5) * 14, oz: (r() - 0.5) * 14, h: 0.5 + r() * 1.2 }; this.scene.add(g); this.bugs.push(g); }
    const PN = isPhone ? 140 : 320, pp = new Float32Array(PN * 3); this.petals = []; for (let i = 0; i < PN; i++) this.petals.push({ ox: (r() - 0.5) * 40, oz: (r() - 0.5) * 40, y: r() * 8, ph: r() * 6, v: 0.5 + r() * 0.6 });
    const pg2 = new THREE.BufferGeometry(); pg2.setAttribute('position', new THREE.BufferAttribute(pp, 3)); this.petalPts = new THREE.Points(pg2, new THREE.PointsMaterial({ color: '#ffd1e3', size: 0.13, map: petalTex(), transparent: true, depthWrite: false, alphaTest: 0.2 })); this.petalPts.frustumCulled = false; this.scene.add(this.petalPts);
    const FN = 90, fp = new Float32Array(FN * 3); this.ff = []; for (let i = 0; i < FN; i++) this.ff.push({ ox: (r() - 0.5) * 50, oz: (r() - 0.5) * 50, h: 0.3 + r() * 2, ph: r() * 6 });
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#d9ff7a', size: 0.35, map: this.dot ||= dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); this.fireflies.frustumCulled = false; this.scene.add(this.fireflies);
  }
  // 다른 사람들: 마주 오거나 같이 달리는 러너 곰돌이 · 산책하는 할머니와 손자 · 연인
  buildPeople() {
    this.people = []; this.peopleT = 0; this.groups = []; this.groupT = 0;
  }
  // 곰돌이 하나: 털색은 다양하게, 옷은 하는 일 · 계절 · 날씨에 맞게 (dress)
  mkBear(role, r, scale = 1, opt = {}) {
    const b = makeBear({ name: `hg${Math.floor(r() * 1e9)}`, color: opt.fur || FUR[Math.floor(r() * FUR.length)] });
    b.root.scale.setScalar(BEAR * scale); b.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); // 행인 곰은 그림자 계산을 빼서 가볍게 (바닥 그림자 원은 따로)
    dress(b, role, r, { season: this.state.season, weather: this.state.weather, ...opt });
    b.root.userData.npc = true; this.scene.add(b.root); return b;
  }
  // 길 위의 사람들: 러너(혼자 · 둘) · 산책(혼자 · 할머니와 손자 · 연인 · 친구들 · 엄마와 아이)
  spawnPerson(kind, s, dir, lat, v, r) {
    const p = { kind, s, dir, lat, v, bears: [], t: r() * 10 };
    const sameTop = r() < 0.5 ? TOPS_CASUAL[Math.floor(r() * TOPS_CASUAL.length)] : null;
    if (kind === 'runner') p.bears.push(this.mkBear('runner', r));
    else if (kind === 'runner2') p.bears.push(this.mkBear('runner', r), this.mkBear('runner', r));
    else if (kind === 'family') p.bears.push(this.mkBear('grandma', r, 0.98, { fur: ['#e8e2d8', '#d9d4cc', '#c9b8a0', '#f4efe6'][Math.floor(r() * 4)] }), this.mkBear('kid', r, 0.62));
    else if (kind === 'parent') p.bears.push(this.mkBear('stroll', r), this.mkBear('kid', r, 0.6));
    else if (kind === 'couple') { p.bears.push(this.mkBear('stroll', r, 1, { top: sameTop }), this.mkBear('stroll', r, 0.95, { top: sameTop })); p.heartT = 2 + r() * 6; }
    else if (kind === 'friends') { const n = 2 + Math.floor(r() * 2); for (let k = 0; k < n; k++) p.bears.push(this.mkBear('stroll', r, 0.95 + r() * 0.1)); }
    else p.bears.push(this.mkBear(r() < 0.3 ? 'office' : 'stroll', r));
    this.people.push(p); return p;
  }
  removePerson(p) { for (const b of p.bears) { this.scene.remove(b.root); b.root.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); }); } if (p.heart) this.scene.remove(p.heart); }
  // ---------- 공원 안쪽: 피크닉 · 캠핑 · 원반 던지기 · 연날리기 · 벤치 · 수다 ----------
  spawnGroup(x, z, r) {
    const st = this.state, wet = st.weather === 'rain' || st.weather === 'snow', cold = st.season === 'winter';
    const kind = ['picnic', 'camp', 'frisbee', 'kite', 'bench', 'chat'][wpick(r, this.crowd().gw)], g = new THREE.Group(), bears = [], rot = r() * 6.28; void wet; void cold;
    g.position.set(x, 0, z); g.rotation.y = rot; this.scene.add(g);
    const put = (b, lx, lz, face, seated) => { this.scene.remove(b.root); g.add(b.root); b.root.position.set(lx, 0, lz); b.root.rotation.y = face; if (seated) { b.setSeated?.(true); b.root.position.y = 0.0; } bears.push(b); return b; };
    const spring = st.season === 'spring' && !wet;
    const who = () => { const x2 = r(); return spring ? (x2 < 0.2 ? 'family' : x2 < 0.4 ? 'friends' : x2 < 0.9 ? 'couple' : 'solo') : x2 < 0.3 ? 'family' : x2 < 0.55 ? 'friends' : x2 < 0.8 ? 'couple' : 'solo'; };
    const rel = who(), n = rel === 'solo' ? 1 : rel === 'couple' ? 2 : 2 + Math.floor(r() * 3);
    const role = () => (rel === 'family' && r() < 0.4 ? 'kid' : 'stroll');
    const mat = (w, d, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: col })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; g.add(m); return m; };
    const data = { kind, g, bears, t: r() * 10, solid: { picnic: 2.0, camp: 2.6, bench: 1.2, chat: 1.0 }[kind] || 0 };
    if (kind === 'picnic' || kind === 'camp') {
      const col = ['#ff6b6b', '#4fa3ff', '#ffd23f', '#7be07b', '#ff9ec0', '#ffffff'][Math.floor(r() * 6)];
      const m = mat(3.2, 2.6, col); if (r() < 0.6) { const ck = mat(3.2, 2.6, '#ffffff'); ck.material = new THREE.MeshLambertMaterial({ map: checkTex(col) }); ck.position.y = 0.035; m.visible = false; }
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.28; const kid = role() === 'kid'; put(this.mkBear(kid ? 'kid' : 'stroll', r, kid ? 0.6 : 1), Math.cos(a) * 1.1, Math.sin(a) * 0.9, -a - Math.PI / 2, true); }
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.32), new THREE.MeshLambertMaterial({ color: '#c08a4a' })); basket.position.set(0.2, 0.17, 0.1); g.add(basket);
      if (kind === 'camp') {
        const tc = ['#ff8a3d', '#3d9bff', '#7bd35a', '#ffd23f', '#e8e2d6'][Math.floor(r() * 5)];
        const tent = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.9, 4, 1), new THREE.MeshLambertMaterial({ color: tc, flatShading: true })); tent.position.set(-2.8, 0.95, 0.4); tent.rotation.y = Math.PI / 4; g.add(tent);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ color: '#2a2a30' })); door.position.set(-2.8 + 0.9, 0.45, 0.4 + 0.02); door.rotation.y = Math.PI / 2 - 0.1; g.add(door);
        for (let k = 0; k < 2; k++) { const ch = new THREE.Group(), cm = new THREE.MeshLambertMaterial({ color: '#2f5d3a' }); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.45), cm); seat.position.y = 0.42; const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), cm); back.position.set(0, 0.68, -0.22); ch.add(seat, back); ch.position.set(2.2 + k * 0.8, 0, -1.2); g.add(ch); }
        if (cold || st.hour > 18 || st.hour < 6) { const fire = new THREE.PointLight('#ff9a3d', 2.2, 9); fire.position.set(1.4, 0.6, -2); g.add(fire); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), new THREE.MeshBasicMaterial({ color: '#ffb347' })); fl.position.set(1.4, 0.25, -2); g.add(fl); data.fire = fl; }
      }
    } else if (kind === 'frisbee') {
      const a = put(this.mkBear(r() < 0.5 ? 'stroll' : 'runner', r), -4, 0, Math.PI / 2), b = put(this.mkBear('stroll', r), 4, 0, -Math.PI / 2);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16), new THREE.MeshLambertMaterial({ color: ['#ff3b6b', '#ffd23f', '#3db8ff'][Math.floor(r() * 3)] })); g.add(disc); data.disc = disc; void a; void b;
    } else if (kind === 'kite') {
      const b = put(this.mkBear(r() < 0.5 ? 'kid' : 'stroll', r, r() < 0.5 ? 0.62 : 1), 0, 0, 0); if (rel !== 'solo') put(this.mkBear('stroll', r), 1.2, -0.4, 0);
      const kite = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4, 1), new THREE.MeshLambertMaterial({ color: ['#ff4d6d', '#ffd23f', '#7be07b', '#b57bff'][Math.floor(r() * 4)], side: THREE.DoubleSide })); kite.scale.z = 0.08; kite.position.set(0, 22, 16); g.add(kite); data.kite = kite;
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.9, 0.3, 0, 22, 16], 3)); data.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })); g.add(data.line); void b;
    } else if (kind === 'bench') {
      const bm = new THREE.MeshLambertMaterial({ color: '#8a5a34' }), legM = new THREE.MeshLambertMaterial({ color: '#3d4148' });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), bm); seat.position.y = 0.45; const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 0.06), bm); back.position.set(0, 0.75, -0.24); g.add(seat, back);
      for (const sx of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), legM); l.position.set(sx, 0.22, 0); g.add(l); }
      put(this.mkBear(r() < 0.3 ? 'grandma' : 'stroll', r), -0.45, 0.05, 0, true); if (rel !== 'solo') put(this.mkBear('stroll', r), 0.45, 0.05, 0, true);
    } else {
      for (let k = 0; k < Math.max(2, n); k++) { const a = (k / Math.max(2, n)) * 6.28; put(this.mkBear(role(), r, role() === 'kid' ? 0.6 : 1), Math.cos(a) * 0.9, Math.sin(a) * 0.9, -a - Math.PI / 2); }
    }
    this.groups.push(data); return data;
  }
  removeGroup(gd) { this.scene.remove(gd.g); gd.g.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); }); }
  tickGroups(dt, px, pz) {
    if (this.chunks) return;
    const r = this.r; this.groupT -= dt;
    const gk = this.crowd(); if (this.groupT <= 0 && this.groups.length < Math.round((isPhone ? 6 : 12) * gk.groups * Math.min(1.4, gk.k + 0.2))) {
      this.groupT = 0.6 + r() * 1.2;
      // 코스 옆 공원 안쪽 (길에서 14 ~ 90m), 물 · 길 위는 피한다
      const s = clamp(this.s + (r() - 0.3) * 260 * this.dir, 3, this.L - 3), lat = r() < 0.45 ? -(12 + r() * 160) : 14 + r() * 76, [x, z] = this.world(s, lat), d = Math.hypot(x - px, z - pz);
      if (d > 60 && d < 240 && !this.inWater(x, z) && !this.inWater(x + 6, z + 6) && !this.inWater(x - 6, z - 6) && !this.groups.some((q) => Math.hypot(q.g.position.x - x, q.g.position.z - z) < 14)) this.spawnGroup(x, z, r);
    }
    for (const gd of this.groups) {
      gd.t += dt;
      for (const b of gd.bears) b.update(dt, 0, { noCrawl: true });
      if (gd.disc) { const k = (gd.t % 2.4) / 2.4, dir = Math.floor(gd.t / 2.4) % 2 ? -1 : 1; gd.disc.position.set(-4 * dir + 8 * dir * k, 1.0 + Math.sin(k * Math.PI) * 2.2, Math.sin(k * Math.PI) * 0.8); gd.disc.rotation.y += dt * 20; }
      if (gd.kite) { gd.kite.position.set(Math.sin(gd.t * 0.5) * 3, 22 + Math.sin(gd.t * 0.9) * 1.5, 16 + Math.cos(gd.t * 0.4)); gd.kite.rotation.z = Math.sin(gd.t * 0.8) * 0.3; const a = gd.line.geometry.attributes.position; a.setXYZ(1, gd.kite.position.x, gd.kite.position.y, gd.kite.position.z); a.needsUpdate = true; }
      if (gd.fire) gd.fire.scale.set(1, 0.8 + Math.sin(gd.t * 13) * 0.2 + Math.sin(gd.t * 7) * 0.1, 1);
    }
    for (const gd of [...this.groups]) if (Math.hypot(gd.g.position.x - px, gd.g.position.z - pz) > 330) { this.removeGroup(gd); this.groups.splice(this.groups.indexOf(gd), 1); }
  }


  // ---------- 도시: 인도를 걷는 사람들 · 차도를 달리는 차 ----------
  citySetup() {
    const lines = [], drives = [], maps = this.map.kind === 'world' ? [...this.chunks.values()].map((c) => c.map) : [this.map];
    const mk = (pts, w, kind) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1], w, kind }; };
    for (const Mx of maps) { const S = Mx.scale;
      for (const rd of Mx.roads) { if (rd[1]) continue; const pts = unpack(rd.slice(2), S); if (pts.length < 2) continue; const L = mk(pts, rd[0], 'road'); if (L.len > 40) { lines.push(L); if (rd[0] >= 8) drives.push(L); } }
      for (const pa of Mx.paths) { if (pa[0]) continue; const pts = unpack(pa.slice(2), S); if (pts.length < 2) continue; const L = mk(pts, pa[1], 'path'); if (L.len > 25) lines.push(L); }
      // 8-31: 다리 · 고가 위 찻길도 차가 달린다 (높이 = 다리 바닥, buildBridges 가 b.fine · b.ys 를 남긴다)
      for (const b of Mx.bridges || []) { if (b.rail || b.w < 8 || !b.fine || b.fine.length < 2) continue; const L = mk(b.fine, b.w, 'road'); L.ys = b.ys; L.deck = true; if (L.len > 30) drives.push(L); } }
    // 8-31: 땅의 찻길이 건물 외곽선 안을 지나거나(가운데선) 낮은 다리 바닥(위 4.9m 아래) 밑을 지나는 구간은 잘라 낸다 → 차가 그곳에 생기지도, 들어가지도 않는다
    { const cut = { foot: 0, deck: 0 }, out = [];
      const deckTop = (x, z) => { let top = -1; for (const si of this.deckGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || []) { const d = this.decks[si], ex = d.cx - d.ax, ez = d.cz - d.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - d.ax) * ex + (z - d.az) * ez) / L2, 0, 1); if (Math.hypot(x - d.ax - ex * t, z - d.az - ez * t) <= d.hw) top = Math.max(top, d.ya + (d.yc - d.ya) * t); } return top; };
      for (const L of drives) {
        if (L.deck) { out.push(L); continue; }
        const bad = []; for (let d = 0; d <= L.len; d += 3) { const q = this.lineAt(L, d, 0), dt = deckTop(q.x, q.z), f = this.solidAt(q.x, q.z, 0, 0, true); if (f === 'foot') { bad.push(d); cut.foot++; } else if (dt > 0.3 && dt < 4.9) { bad.push(d); cut.deck++; } }
        if (!bad.length) { out.push(L); continue; }
        let a = 0; for (const d of [...bad, Infinity]) { const b0 = Math.min(L.len, d - 4); if (b0 - a >= 30) { const pts = []; for (let s2 = a; s2 < b0; s2 += 6) { const q = this.lineAt(L, s2, 0); pts.push([q.x, q.z]); } const q = this.lineAt(L, b0, 0); pts.push([q.x, q.z]); out.push(mk(pts, L.w, 'road')); } a = Math.max(a, d + 4); }
      }
      drives.length = 0; drives.push(...out); this.driveCut = cut;
      // 이웃 칸의 찻길 차로 위에 선 기둥(칸을 지을 땐 그 길을 몰랐다)은 치운다
      const g2 = new Map(); for (const L of drives) { if (L.deck) continue; for (let i = 1; i < L.pts.length; i++) { const a = L.pts[i - 1], c = L.pts[i]; for (let gx = Math.floor((Math.min(a[0], c[0]) - 12) / 30); gx <= Math.floor((Math.max(a[0], c[0]) + 12) / 30); gx++) for (let gz = Math.floor((Math.min(a[1], c[1]) - 12) / 30); gz <= Math.floor((Math.max(a[1], c[1]) + 12) / 30); gz++) { const k = gx + ',' + gz; if (!g2.has(k)) g2.set(k, []); g2.get(k).push([a, c, L.w]); } } }
      let pr = 0; const O = new THREE.Object3D(); O.scale.setScalar(0.001); O.position.set(0, -50, 0); O.updateMatrix();
      for (const c of this.pierCircles || []) { if (!c.r || !c.col) continue; for (const [a, b, w] of g2.get(Math.floor(c.x / 30) + ',' + Math.floor(c.z / 30)) || []) { const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((c.x - a[0]) * ex + (c.z - a[1]) * ez) / L2, 0, 1), d = Math.hypot(c.x - a[0] - ex * t, c.z - a[1] - ez * t); if (d < w / 2 - 0.3 && !(w >= 14 && d < 0.8)) { c.r = 0; c.h = -1; c.col.m.setMatrixAt(c.col.i, O.matrix); c.col.m.instanceMatrix.needsUpdate = true; pr++; break; } } }
      this.pierRemoved = (this.pierRemoved || 0) + pr; }
    const grid = (arr) => { const g = new Map(); arr.forEach((L, li) => { for (let i = 0; i < L.pts.length; i++) { const k = `${Math.floor(L.pts[i][0] / 50)},${Math.floor(L.pts[i][1] / 50)}`; if (!g.has(k)) g.set(k, []); g.get(k).push([li, i]); } }); return g; };
    this.walkLines = lines; this.walkGrid = grid(lines); this.driveLines = drives; this.driveGrid = grid(drives);
    this.walkers ||= []; this.cityT ||= 0; this.cityDirty = false;
  }
  lineAt(L, d, off) { d = clamp(d, 0, L.len); let i = 1; while (i < L.cum.length - 1 && L.cum[i] < d) i++; const a = L.pts[i - 1], b = L.pts[i], seg = L.cum[i] - L.cum[i - 1] || 1, t = (d - L.cum[i - 1]) / seg, dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg; return { x: lerp(a[0], b[0], t) - dz * off, z: lerp(a[1], b[1], t) + dx * off, dx, dz, y: L.ys ? lerp(L.ys[i - 1], L.ys[i], t) : 0 }; }
  // 8-31: 차가 못 지나가는 것: 'foot' 건물 외곽선 안 · 'circ' 기둥 · 나무 · 가로등 (r = 차 반폭, y = 차 바닥 높이, footOnly = 외곽선만)
  solidAt(x, z, r = 0.9, y = 0, footOnly = false) {
    for (const fi of this.footGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || []) { const f = this.foot[fi]; if (f.deck || f.deckWall || x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; const fh = f.base === undefined ? f.h : f.h + f.base - this.terrAt(x, z); if (!(fh > 1.2) || y >= fh - 0.3 || (f.mh && f.mh > y + 3.6)) continue; if (inRing(x, z, ringAtY(f, Math.max(y, f.mh || 0) + 0.5))) return 'foot'; }
    if (footOnly) return null;
    // 다리 바닥이 차 지붕 높이(바닥 두께 1.6m 포함 4.9m) 안에 걸리면
    for (const si of this.deckGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`) || []) { const d = this.decks[si], ex = d.cx - d.ax, ez = d.cz - d.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - d.ax) * ex + (z - d.az) * ez) / L2, 0, 1); if (Math.hypot(x - d.ax - ex * t, z - d.az - ez * t) > d.hw) continue; const top = d.ya + (d.yc - d.ya) * t - y; if (top > 0.4 && top < 4.9) return 'deck'; }
    const gx = Math.floor(x / 20), gz = Math.floor(z / 20);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const c of this.circGrid?.get(`${gx + a},${gz + b}`) || []) { if (c.r < 0.1 || y >= (c.h ?? 99)) continue; if (Math.hypot(c.x - x, c.z - z) < c.r + r) return 'circ'; }
    return null;
  }
  pickNear(grid, lines, px, pz, minD, maxD, r) {
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * 6.28, d = minD + r() * (maxD - minD), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, cell = grid.get(`${Math.floor(x / 50)},${Math.floor(z / 50)}`); if (!cell) continue;
      const [li, i] = cell[Math.floor(r() * cell.length)], L = lines[li]; return { L, d: L.cum[i] };
    }
    return null;
  }
  // 동네 성격: 주변 건물로 (회사 · 아파트 · 상가)
  areaKind(x, z) {
    let office = 0, home = 0, shop = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const fi of this.footGrid?.get(`${Math.floor(x / 40) + a},${Math.floor(z / 40) + b}`) || []) { const f = this.foot[fi]; if ((f.type === 'glass' || f.type === 'gold' || f.type === 'stone') && f.h > 25) office += f.h / 30; else if (f.type === 'apt') home += 1; else if (f.h < 25) shop += 0.5; }
    return office > home && office > shop ? 'office' : home > shop ? 'home' : 'shop';
  }
  tickCity(dt, px, pz) {
    if (!this.walkLines || this.cityDirty) this.citySetup();
    const r = this.r, cw = this.crowd(), h = this.state.hour, rain = this.state.weather === 'rain';
    // 인도 사람들: 회사 동네는 양복 · 셔츠, 아파트 동네는 가족 · 어르신 · 아이, 상가는 친구 · 연인
    this.cityT -= dt;
    const maxW = Math.round((isPhone ? 10 : 30) * Math.min(1.4, cw.k + 0.15));
    if (this.cityT <= 0 && this.walkers.length < maxW) {
      this.cityT = 0.35 + r() * 0.5; const pk = this.pickNear(this.walkGrid, this.walkLines, px, pz, 50, 200, r);
      if (pk) {
        const L = pk.L, side = L.kind === 'road' ? (r() < 0.5 ? 1 : -1) * (L.w / 2 + 1.7) : (r() - 0.5) * 1.2, q = this.lineAt(L, pk.d, side);
        if (!this.inWater(q.x, q.z)) {
          const area = this.areaKind(q.x, q.z), work = h >= 7 && h < 20, x = r();
          let roles;
          if (area === 'office' && work) roles = x < 0.45 ? ['suit'] : x < 0.75 ? ['suit', 'suit', ...(r() < 0.5 ? ['office'] : [])] : x < 0.88 ? ['office'] : ['stroll', 'stroll'];
          else if (area === 'home') roles = x < 0.25 ? ['grandma'] : x < 0.5 ? ['stroll', 'kid'] : x < 0.65 ? ['stroll', 'stroll', 'kid'] : x < 0.82 ? ['stroll'] : ['stroll', 'stroll'];
          else roles = x < 0.3 ? ['stroll', 'stroll'] : x < 0.5 ? ['stroll', 'stroll', 'stroll'] : x < 0.7 ? ['stroll'] : x < 0.85 ? ['office'] : ['stroll', 'stroll', 'stroll', 'stroll'];
          // 홍대: 스트리트 패션 · 코스프레 무리 · 친구 · 연인이 많다
          const RID = this.chunks ? ((q) => (q && q.d < 1400 ? q.id : ''))(this.nearRegion(this.px, this.pz)) : this.id; // 서울 전체: 곰이 있는 동네
          if (RID === 'itaewon') { const y = r(); roles = y < 0.3 ? ['street', 'street'] : y < 0.55 ? ['stroll', 'stroll'] : y < 0.7 ? ['stroll', 'stroll', 'stroll'] : y < 0.85 ? ['street'] : ['stroll', 'street', 'stroll']; }
          if (RID === 'hongdae') { const y = r(); roles = y < 0.32 ? ['street', 'street', ...(r() < 0.5 ? ['street'] : [])] : y < 0.47 ? ['cosplay', 'cosplay', ...(r() < 0.4 ? ['cosplay'] : [])] : y < 0.6 ? ['street'] : y < 0.78 ? ['stroll', 'stroll'] : y < 0.9 ? ['stroll', 'street'] : ['stroll', 'stroll', 'stroll']; }
          if (rain) roles = roles.slice(0, 2);
          const sameTop = roles.length === 2 && r() < 0.3 ? TOPS_CASUAL[Math.floor(r() * TOPS_CASUAL.length)] : null;
          this.walkers.push({ L, d: pk.d, dir: r() < 0.5 ? 1 : -1, side, v: 1.0 + r() * 0.5, bears: roles.map((ro) => this.mkBear(ro, r, ro === 'kid' ? 0.6 : 0.95 + r() * 0.1, sameTop ? { top: sameTop } : {})), kind: 'walker' });
        }
      }
    }
    for (const w of this.walkers) {
      w.d += w.dir * w.v * dt; if (w.d < 0 || w.d > w.L.len) { w.dir *= -1; w.d = clamp(w.d, 0, w.L.len); }
      w.bears.forEach((b, i) => { const q = this.lineAt(w.L, w.d - i * 0.25 * w.dir, w.side + (i - (w.bears.length - 1) / 2) * 0.7); b.root.position.set(q.x, 0, q.z); b.root.rotation.y = Math.atan2(q.dx * w.dir, q.dz * w.dir); b.update(dt, w.v * 2, { noCrawl: true }); });
    }
    for (const w of [...this.walkers]) { const p0 = w.bears[0].root.position; if (Math.hypot(p0.x - px, p0.z - pz) > 240) { this.removePerson(w); this.walkers.splice(this.walkers.indexOf(w), 1); } }
    // 홍대 버스킹: 걷고싶은거리 · 홍대 놀이터에 버스커(기타 · 마이크 · 앰프 · 조명) + 둥글게 선 구경꾼. 가까이 가면 생기고 멀어지면 걷는다
    if (this.id === 'hongdae') { this.busk ||= (this.map.marks || []).filter(([n]) => /걷고싶은|놀이터/.test(n)).map(([n, s0]) => { const [x, z] = this.world(s0, 9); return { n, x, z, on: null }; });
      for (const B of this.busk) { const d = Math.hypot(B.x - px, B.z - pz);
        if (!B.on && d < 220) { const g = new THREE.Group(); g.position.set(B.x, 0, B.z); this.scene.add(g); const bk = this.mkBear('busker', r, 1); this.scene.remove(bk.root); bk.root.position.set(0, 0, 0); g.add(bk.root);
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), new THREE.MeshLambertMaterial({ color: '#2a2a2a' })); stand.position.set(0.2, 0.7, 0.55); g.add(stand); const mic = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: '#1d1d1f' })); mic.position.set(0.2, 1.42, 0.5); g.add(mic);
          const amp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.35), new THREE.MeshLambertMaterial({ color: '#1d1d1f' })); amp.position.set(-0.8, 0.25, 0.1); g.add(amp); const grill = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshLambertMaterial({ color: '#4a4a4a' })); grill.position.set(-0.8, 0.27, 0.28); g.add(grill);
          const lamp = new THREE.PointLight('#ffd9a0', 6, 9, 1.6); lamp.position.set(0, 3, 1.5); g.add(lamp); const glow = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.12, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03; g.add(glow);
          const crowd = []; for (let i = 0; i < 7; i++) { const a2 = -1.1 + (i / 6) * 2.2, rr = 3.2 + (i % 2) * 0.9, cb = this.mkBear(['street', 'stroll', 'cosplay', 'street', 'stroll'][i % 5], r, 0.92 + r() * 0.12); this.scene.remove(cb.root); cb.root.position.set(Math.sin(a2) * rr, 0, Math.cos(a2) * rr); cb.root.rotation.y = a2 + Math.PI; g.add(cb.root); crowd.push(cb); }
          B.on = { g, bk, crowd, t: 0 }; g.userData.npc = true; }
        else if (B.on && d > 320) { this.scene.remove(B.on.g); B.on = null; }
        if (B.on) { B.on.t += dt; B.on.bk.root.rotation.z = Math.sin(B.on.t * 2.2) * 0.06; B.on.bk.update(dt, 0, { noCrawl: true }); B.on.crowd.forEach((cb, i) => { cb.root.position.y = Math.max(0, Math.sin(B.on.t * 4.4 + i) * 0.05); cb.update(dt, 0, { noCrawl: true }); }); } } }
    // 가게 손님: 문에서 나와 벽을 따라 걸어가거나, 걸어와서 문으로 들어간다 (영업 시간대에 더 많이)
    this.shoppers ||= []; this.shopT = (this.shopT || 0) - dt; const open = h >= 8 && h < 23;
    if (this.shopT <= 0 && this.shopFronts?.length && this.shoppers.length < (isPhone ? 4 : 10) * (open ? 1 : 0.3)) { this.shopT = 0.8 + r() * 1.2;
      const cand = []; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (const i of this.shopGrid.get(`${Math.floor(px / 40) + a},${Math.floor(pz / 40) + b}`) || []) { const F = this.shopFronts[i], d = Math.hypot(F.x - px, F.z - pz); if (d > 12 && d < 110) cand.push(F); }
      if (cand.length) { const F = cand[Math.floor(r() * cand.length)], out = r() < 0.5, sd = r() < 0.5 ? 1 : -1, tx = F.nz * sd, tz = -F.nx * sd, door = [F.x + F.nx * 0.4, F.z + F.nz * 0.4], step = [F.x + F.nx * 2.2, F.z + F.nz * 2.2], far = [step[0] + tx * 22, step[1] + tz * 22];
        const path = out ? [door, step, far] : [far, step, door], roles = r() < 0.35 ? ['stroll', 'stroll'] : [h >= 7 && h < 20 && this.areaKind(F.x, F.z) === 'office' ? 'suit' : 'stroll'];
        const sp = { path, k: 0, t: 0, v: 1.1 + r() * 0.3, bears: roles.map((ro) => this.mkBear(ro, r, 0.95 + r() * 0.1)), kind: 'walker' }; this.shoppers.push(sp); } }
    for (const sp of [...this.shoppers]) {
      const a = sp.path[sp.k], b = sp.path[sp.k + 1]; if (!b) { this.removePerson(sp); this.shoppers.splice(this.shoppers.indexOf(sp), 1); continue; }
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01; sp.t += sp.v * dt / L; if (sp.t >= 1) { sp.k++; sp.t = 0; continue; }
      const x = a[0] + (b[0] - a[0]) * sp.t, z = a[1] + (b[1] - a[1]) * sp.t, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      sp.bears.forEach((bb, i) => { bb.root.position.set(x - uz * (i - (sp.bears.length - 1) / 2) * 0.7, 0, z + ux * (i - (sp.bears.length - 1) / 2) * 0.7); bb.root.rotation.y = Math.atan2(ux, uz); bb.update(dt, sp.v * 2, { noCrawl: true }); });
    }
    this.traffic.tick(dt, px, pz);
  }
  // ---------- 지하철 · 버스 (실시간) ----------
  //   출입구: 실제 위치에 유리 지붕 계단 + 호선 색 표지판 · 가까이 가면 그 역 실시간 도착 (onStation)
  //   한강철교: 1호선 열차가 실시간 위치대로 노량진 ↔ 용산을 건넌다 (정보가 없으면 시간표처럼 몇 분마다)
  //   버스: 실제 GPS 위치대로
  // 지하철 출구 (지도마다): 칸 모드에선 열 · 역을 주인(host)의 목록에 더한다
  buildEntrances() {
    // 출구 글씨(지붕 띠 512 × 80 · 기둥 128 × 512)를 그림 몇 장에 모은다 (출구마다 재질 하나 → 수백 번 그리기였다)
    const EA = { pages: {}, plane: (w, h, kind, src) => { const [CW, CH, cols] = kind === 'band' ? [512, 80, 4] : [128, 512, 16], per = cols * Math.floor(2048 / CH), L = (EA.pages[kind] ||= []), last = L[L.length - 1];
      let P = last && last.n < per ? last : null; if (!P) { const cv = document.createElement('canvas'); cv.width = cv.height = 2048; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.2 }); (this.exitSignMs ||= []).push(m); P = { cv, c: cv.getContext('2d'), t, m, n: 0, seen: new Map() }; L.push(P); }
      let q = P.seen.get(src); if (q === undefined) { q = P.n++; P.seen.set(src, q); P.c.drawImage(src, (q % cols) * CW, Math.floor(q / cols) * CH, CW, CH); P.t.needsUpdate = true; }
      const x0 = (q % cols) * CW, y0 = Math.floor(q / cols) * CH, u0 = (x0 + 1) / 2048, u1 = (x0 + CW - 1) / 2048, v1 = 1 - (y0 + 1) / 2048, v0 = 1 - (y0 + CH - 1) / 2048, geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      return new THREE.Mesh(geo, P.m); } };
    const M = this.map, S = M.scale, H = this.host || this; H.entrances ||= []; H.stations ||= [];
    const st0 = (M.stations || []).map(([n, x, z]) => { const x2 = x * S, z2 = z * S, old = H.stations.find((q) => q.name === n && Math.hypot(q.x - x2, q.z - z2) < 400); if (old) return old; const st = { name: n, x: x2, z: z2, lines: STATION_LINES[n] || [] }; H.stations.push(st); return st; });
    this.stations = st0; const mine = [];
    const glass = new THREE.MeshPhongMaterial({ color: '#cfe6f0', transparent: true, opacity: 0.38, shininess: 90, side: THREE.DoubleSide }), frame = new THREE.MeshLambertMaterial({ color: '#5a636e' }), pit = new THREE.MeshBasicMaterial({ color: '#2a2a30' }), stepM = new THREE.MeshLambertMaterial({ color: '#9a9690' }), noseM = new THREE.MeshLambertMaterial({ color: '#e0b830' }), granite = new THREE.MeshLambertMaterial({ color: '#8f8a84' }), steel = new THREE.MeshPhongMaterial({ color: '#d8dce0', shininess: 80 }), exitLightM = new THREE.MeshLambertMaterial({ color: '#fff6e0', emissive: '#fff2d0', emissiveIntensity: 0.3 }), exitGlowM = new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); this.exitLightM = exitLightM; this.exitGlowM = exitGlowM;
    // 출구 자리 살피기: 이 칸 건물 + 이미 불러온 이웃 칸 건물(주인 목록), 찻길(차로 폭 + 0.3m). 다리 · 고가 바닥은 건물이 아니다
    const entFootAt = (px, pz) => { for (const [F, G] of [[this.foot, this.footGrid], ...(H !== this ? [[H.foot, H.footGrid]] : [])]) { for (const fi of G?.get(`${Math.floor(px / 40)},${Math.floor(pz / 40)}`) || []) { const f = F[fi]; if (!f || f.deck || f.deckWall || px < f.x0 || px > f.x1 || pz < f.z0 || pz > f.z1) continue; if (inRing(px, pz, f.ring)) return true; } } return false; };
    let entRG = null; const entRoadAt = (px, pz) => { if (!entRG) { entRG = new Map(); for (const rd of M.roads || []) { const w = rd[0], pts = unpack(rd.slice(2), S); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], e = w / 2 + 0.3; for (let gx = Math.floor((Math.min(a[0], b[0]) - e) / 30); gx <= Math.floor((Math.max(a[0], b[0]) + e) / 30); gx++) for (let gz = Math.floor((Math.min(a[1], b[1]) - e) / 30); gz <= Math.floor((Math.max(a[1], b[1]) + e) / 30); gz++) { const kk = `${gx},${gz}`; if (!entRG.has(kk)) entRG.set(kk, []); entRG.get(kk).push([a, b, e]); } } } }
      for (const [a, b, hw] of entRG.get(`${Math.floor(px / 30)},${Math.floor(pz / 30)}`) || []) { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / L2, 0, 1); if (Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz) < hw) return true; } return false; };
    let entTurn = 0;
    for (const [x0, z0, si, ref] of M.entrances || []) {
      const st = this.stations[si]; if (!st) continue; let x = x0 * S, z = z0 * S; if (this.inWater(x, z)) continue;
      // 출구가 건물 바닥 안에 있으면(건물 1층에 붙은 출구) 가장 가까운 벽 바깥으로 옮긴다 (벽에 막혀 들어갈 수 없었다)
      { const inF = (px, pz) => (this.foot || []).find((f) => !f.deck && px >= f.x0 && px <= f.x1 && pz >= f.z0 && pz <= f.z1 && inRing(px, pz, f.ring)), f = inF(x, z);
        if (f) { const r2 = f.ring, sg = ringArea(r2) > 0 ? 1 : -1; let best = Infinity, nx2 = 0, nz2 = 0, bx = x, bz = z; for (let k = 0; k < r2.length; k++) { const A = r2[k], B = r2[(k + 1) % r2.length], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const t = clamp(((x - A[0]) * dx + (z - A[1]) * dz) / (L * L), 0, 1), qx = A[0] + dx * t, qz = A[1] + dz * t, d = Math.hypot(qx - x, qz - z); if (d < best) { best = d; bx = qx; bz = qz; nx2 = (sg > 0 ? dz : -dz) / L; nz2 = (sg > 0 ? -dx : dx) / L; } }
          const X2 = bx + nx2 * 3.4, Z2 = bz + nz2 * 3.4; if (best < 30 && !inF(X2, Z2) && !this.inWater(X2, Z2)) { x = X2; z = Z2; } } }
      // 가운데는 밖이어도 출구 몸(3 × 5.2m)이 건물에 걸치면 묻혀 보였다 (홍대입구 3번 · 서울역 13번): 몸 전체가 건물 · 물 · 찻길 밖인 가장 가까운 자리(30m 안)로
      //   이미 불러온 이웃 칸 건물도 본다. 방향은 역 쪽 그대로, 안 되면 옆으로 돌려서
      { const blocked = (cx, cz, th) => { const c = Math.cos(th), s2 = Math.sin(th); for (let a = -1.5; a <= 1.51; a += 0.75) for (let b = -2.6; b <= 2.61; b += 0.65) { const px = cx + a * c + b * s2, pz = cz - a * s2 + b * c; if (entFootAt(px, pz) || this.inWater(px, pz) || entRoadAt(px, pz)) return true; } return false; };
        const th0 = Math.atan2(st.x - x, st.z - z);
        if (blocked(x, z, th0)) { let hit = null; for (let r = 1; r <= 30 && !hit; r++) { const n = Math.max(8, Math.round(r * 2 * Math.PI)); for (let k = 0; k < n && !hit; k++) { const an = (k / n) * Math.PI * 2, cx = x + Math.cos(an) * r, cz = z + Math.sin(an) * r; for (const dth of [0, Math.PI / 2, -Math.PI / 2]) { const th = Math.atan2(st.x - cx, st.z - cz) + dth; if (!blocked(cx, cz, th)) { hit = [cx, cz, dth]; break; } } } } if (hit) { x = hit[0]; z = hit[1]; entTurn = hit[2]; } }
      }
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(st.x - x, st.z - z) + entTurn; entTurn = 0;
      // 서울 지하철 출구: 내려가는 계단 구덩이 · 화강석 낮은 벽 + 유리벽 · 둥근 유리 지붕과 금속 틀 · 지붕 앞 노란 출구 번호 · 옆에 안내 기둥
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), pit); p.rotation.x = -Math.PI / 2; p.position.y = 0.04; g.add(p);
      for (let k = 0; k < 7; k++) { const s2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.45), stepM); s2.position.set(0, 0.05 - k * 0.0, -1.7 + k * 0.55); s2.scale.y = 1; g.add(s2); const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 0.05), noseM); nose.position.set(0, 0.09, -1.48 + k * 0.55); g.add(nose); }
      for (const sx of [-1.3, 1.3]) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 4.6), granite); base.position.set(sx, 0.45, 0.05); g.add(base);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 4.4), glass); wall.position.set(sx, 1.68, 0.05); g.add(wall);
        for (const pz of [-2.15, -0.7, 0.75, 2.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.65, 0.09), frame); post.position.set(sx, 1.72, pz); g.add(post); }
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 4.4), steel); rail.position.set(sx * 0.92, 1.0, 0.05); g.add(rail);
      }
      // 둥근 지붕: 앞뒤로 긴 반원통을 납작하게
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 4.8, 18, 1, true, -Math.PI / 2, Math.PI), glass); vault.rotation.x = Math.PI / 2; vault.rotation.z = Math.PI / 2; vault.scale.set(1, 1, 0.32); vault.position.set(0, 2.5, 0.05); g.add(vault);
      for (const pz of [-2.35, -0.8, 0.8, 2.4]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 6, 18, Math.PI), frame); rib.scale.set(1, 0.32, 1); rib.position.set(0, 2.5, pz); g.add(rib); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 0.14), frame); beam.position.set(0, 2.5, -2.38); g.add(beam);
      // 지붕 아래 조명 띠 (밤에 계단을 따뜻하게 비춘다)
      const lstrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 4.2), exitLightM); lstrip.position.set(0, 2.42, 0.05); g.add(lstrip); const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.0), exitGlowM); glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.12, 0.05); g.add(glow);
      // 지붕 앞: 노란 출구 번호 + 역 이름 띠
      const front = EA.plane(2.7, 0.42, 'band', exitBandTex(st.name, st.lines, ref).image); front.position.set(0, 2.25, -2.46); front.rotation.y = Math.PI; g.add(front);
      // 안내 기둥 (입구 옆, 길 쪽을 본다)
      // 안내 기둥: 몸통 상자 + 앞 · 뒤 글씨판 (글씨는 칸마다 한 장에 모은 그림)
      const totem = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.7, 0.2), frame); totem.position.set(1.95, 1.35, -2.2); g.add(totem);
      { const tc = exitTotemTex(st.name, st.lines, ref).image; for (const sd of [1, -1]) { const pl = EA.plane(0.6, 2.68, 'totem', tc); pl.position.set(1.95, 1.35, -2.2 + sd * 0.102); if (sd < 0) pl.rotation.y = Math.PI; g.add(pl); } }
      this.scene.add(g); const E = { x, z, st, ref, g, key: this.chunkKey, ox: x0 * S, oz: z0 * S }; H.entrances.push(E); mine.push(E);
      // 부딪힘: 양옆 화강석 벽 · 뒤 벽 · 안내 기둥 (가운데 계단으로는 걸어 내려갈 수 있다)
      //   출구 벽은 타고 오를 수 없다 (옆 · 뒤에서 타고 올라 계단 구덩이로 떨어져 역 안 벽에 끼던 것)
      { const th = g.rotation.y, W = (lx, lz) => [x + lx * Math.cos(th) + lz * Math.sin(th), z - lx * Math.sin(th) + lz * Math.cos(th)], rect = (a0, b0, a1, b1) => { const ring = [W(a0, b0), W(a1, b0), W(a1, b1), W(a0, b1)], xs = ring.map((q) => q[0]), zs = ring.map((q) => q[1]); this.addFoot({ ring, h: 2.6, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name: `${st.name}역 ${ref || ''}번 출구`, type: 'stone', noClimb: true }); }; rect(-1.45, -2.3, -1.15, 2.4); rect(1.15, -2.3, 1.45, 2.4); rect(-1.45, 2.3, 1.45, 2.6); this.addCircle(W(1.95, -2.2)[0], W(1.95, -2.2)[1], 0.4, 2.7); }
    }
    batchStatic(this.scene, mine.map((e) => e.g), (this.lodObjs ||= [])); // 출구 수백 개를 재질별로 묶고, 멀면 숨긴다
  }
  buildTransit() {
    this.entrances ||= []; this.stations ||= [];
    // 한강철교 선로 두 줄: 가장 긴 철교 둘
    // 한강철교(노량진 ↔ 용산, 북위 37.5172 · 동경 126.958) 근처 철교 중 긴 두 줄
    const M2 = this.map, hx = (126.958 - 126.98) * 111320 * Math.cos(37.53 * Math.PI / 180) - M2.center[0], hz = -(37.5172 - 37.53) * 110574 - M2.center[1];
    this.trackPaths = (this.railPaths || []).map((rp) => { const mid = rp.fine[Math.floor(rp.fine.length / 2)]; return { ...rp, len: rp.fine.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - rp.fine[i - 1][0], p[1] - rp.fine[i - 1][1]) : 0), 0), dist: Math.hypot(mid[0] - hx, mid[1] - hz) }; }).filter((rp) => rp.dist < 900 && rp.len > 300).sort((a, b) => b.len - a.len).slice(0, 2);
    this.trains = []; this.trainT = 5; this.trainSeen = new Set(); this.buses = new Map();
    // 실시간 버스 · 지하철 (서울 어디든): hangang-transit.js
    this.live?.dispose(); this.live = new LiveTransit(this);
    // 버스 · 지하철 타기: hangang-ride.js
    this.rideL?.dispose(); this.rideL = new LiveRide(this);
    // 다른 호선 철교 (4호선 동작대교 · 2호선 당산철교 등): 그 호선 색 열차가 몇 분마다 지나간다
    this.lineTracks = (this.railPaths || []).map((rp) => ({ ...rp, line: (/(\d)호선/.exec(rp.n) || [])[1], len: rp.fine.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - rp.fine[i - 1][0], p[1] - rp.fine[i - 1][1]) : 0), 0) })).filter((rp) => rp.line && rp.line !== '1' && rp.len > 200); this.lineT = 8;
  }
  trainAt(tp, d) { const f = tp.fine; let acc = 0; for (let i = 1; i < f.length; i++) { const L = Math.hypot(f[i][0] - f[i - 1][0], f[i][1] - f[i - 1][1]); if (acc + L >= d) { const t = (d - acc) / (L || 1); return { x: lerp(f[i - 1][0], f[i][0], t), z: lerp(f[i - 1][1], f[i][1], t), y: lerp(tp.ys[i - 1], tp.ys[i], t), dx: (f[i][0] - f[i - 1][0]) / (L || 1), dz: (f[i][1] - f[i - 1][1]) / (L || 1) }; } acc += L; } const n = f.length - 1; return { x: f[n][0], z: f[n][1], y: tp.ys[n], dx: 0, dz: 1 }; }
  spawnTrain(north) {
    const tp = this.trackPaths[north ? 0 : 1] || this.trackPaths[0]; if (!tp) return;
    const southFirst = tp.fine[0][1] > tp.fine[tp.fine.length - 1][1], forward = north ? southFirst : !southFirst;
    const g = makeTrain(); this.scene.add(g); this.trains.push({ tp, d: forward ? -200 : tp.len + 200, dir: forward ? 1 : -1, g, v: 16 });
  }
  // 바깥 철교 열차 실시간: 그 철교 양 끝 역에 실제 열차가 들어오면(상태 1 도착 · 2 출발) 그쪽에서 철교로 출발
  async pollLineTrains() {
    if (!this.api || !this.lineTracks?.length) return; const BRIDGE_ST = { 2: [['당산', '합정'], ['성수', '뚝섬']], 3: [['압구정', '옥수']], 4: [['이촌', '동작']], 5: [['여의나루', '마포']], 7: [['청담', '뚝섬유원지']], 9: [['선유도', '당산']] };
    for (const line of [...new Set(this.lineTracks.map((t) => t.line))]) { try { const j = await this.api(`/api/seoul/subway/position?line=${line}호선`); this.liveLines ||= new Set(); this.liveLines.add(line); this.lineSeen ||= new Set();
      for (const t of j.trains || []) { const key = `${line}:${t.no}:${t.at}:${t.sttus}`; if (this.lineSeen.has(key) || (t.sttus !== 1 && t.sttus !== 2)) continue; for (const [a, b] of BRIDGE_ST[line] || []) { if (t.at !== a && t.at !== b) continue; this.lineSeen.add(key); const tp = this.lineTracks.filter((q) => q.line === line)[Math.floor(Math.random() * this.lineTracks.filter((q) => q.line === line).length)], fw = (t.at === a) === t.up, g = makeTrain(line); this.scene.add(g); this.trains.push({ tp, d: fw ? -200 : tp.len + 200, dir: fw ? 1 : -1, g, v: 15 }); } }
      if (this.lineSeen.size > 600) this.lineSeen.clear(); } catch { /* 다음에 */ } }
  }
  async pollTransit() {
    if (!this.api) return;
    // 새 실시간 열차(실제 선로 위)가 돌면 예전 철교 열차는 쉰다
    if (!this.live?.subOK) this.pollLineTrains();
    try {
      if (this.live?.subOK) throw new Error('새 방식');
      const j = await this.api('/api/seoul/subway/position?line=1호선'); this.liveTrains = true;
      for (const t of j.trains || []) { const key = `${t.no}:${t.at}:${t.up}`; if (t.sttus !== 2 || this.trainSeen.has(key)) continue; if (t.at === '노량진' && t.up) { this.trainSeen.add(key); this.spawnTrain(true); } else if (t.at === '용산' && !t.up) { this.trainSeen.add(key); this.spawnTrain(false); } }
      if (this.trainSeen.size > 400) this.trainSeen.clear();
    } catch { this.liveTrains = !!this.live?.subOK; }
    if (this.chunks && this.cityRid && this.nearRegion(this.px, this.pz)?.id !== this.cityRid) this.cityAt = 0; // 서울 전체: 다른 동네로 걸어가면 그곳 정보로
    if (!this.cityAt || Date.now() - this.cityAt > 300000) { this.cityAt = Date.now(); try { const rid = this.chunks ? this.nearRegion(this.px, this.pz)?.id || 'yeouido' : this.id; this.cityRid = rid; this.city = await this.api('/api/seoul/city?area=' + encodeURIComponent(rid === 'hongdae' ? '홍대 관광특구' : rid === 'namsan' ? '남산공원' : rid === 'itaewon' ? '이태원 관광특구' : rid === 'banpo' ? '반포한강공원' : rid === 'ttukseom' ? '뚝섬한강공원' : ({ seongsu: '성수카페거리', gangnam: '강남역', jamsil: '잠실 관광특구', myeongdong: '명동 관광특구', insadong: '인사동', bukchon: '북촌한옥마을', sinchon: '신촌·이대역' }[rid] || '여의도'))); this.onCity?.(this.city); } catch { /* 도시 정보 없음 */ } }
  }
  tickTransit(dt, px, pz) {
    if (!this.trains) return;
    this.trainT -= dt; if (this.trainT <= 0) { this.trainT = 20; this.pollTransit(); if (!this.liveTrains && !this.live?.subOK && Math.random() < 0.35) this.spawnTrain(Math.random() < 0.5); }
    this.lineT -= dt; if (this.lineT <= 0 && this.lineTracks?.length && !this.liveLines?.size && !this.live?.subOK) { this.lineT = 35 + Math.random() * 70; const tp = this.lineTracks[Math.floor(Math.random() * this.lineTracks.length)], fw = Math.random() < 0.5, g = makeTrain(tp.line); this.scene.add(g); this.trains.push({ tp, d: fw ? -200 : tp.len + 200, dir: fw ? 1 : -1, g, v: 15 }); }
    for (const t of this.trains) { t.d += t.dir * t.v * dt; t.g.children.forEach((car, i) => { const p = this.trainAt(t.tp, clamp(t.d - t.dir * i * 20, 0, t.tp.len)); car.position.set(p.x, p.y + 0.4, p.z); car.rotation.y = Math.atan2(p.dx, p.dz); car.visible = t.d - t.dir * i * 20 > 0 && t.d - t.dir * i * 20 < t.tp.len; }); }
    this.trains = this.trains.filter((t) => { const done = t.dir > 0 ? t.d > t.tp.len + 220 : t.d < -220; if (done) this.scene.remove(t.g); return !done; });
    // 실시간 버스 · 지하철: 실제 GPS · 실제 열차 위치 (hangang-transit.js)
    this.live?.tick(dt, px, pz); this.rideL?.tick(dt);
    // 가까운 지하철 출입구
    let near = null; for (const e of this.entrances) { const d = Math.hypot(e.x - px, e.z - pz); if (d < 7 && (!near || d < near.d)) near = { ...e, d }; }
    // 남산: 타워 아래로 다가가면 엘리베이터로 전망대(140m), 전망대 가운데 엘리베이터 앞에서 다시 아래로
    if (this.deckInfo && !this.shopCool) { const D = this.deckInfo, d = Math.hypot(px - D.cx, pz - D.cz);
      if (this.y < 5 && d < 7.6 && (this.mdx ?? 0) * (D.cx - px) + (this.mdz ?? 0) * (D.cz - pz) > 0.3 * d) { deckBears(this, makeBear); this.placeAt(D.cx, D.cz + 6.5, 0); this.y = D.DY; this.inDeck = true; this.shopCool = 1.5; this.onShopEnter?.({ name: 'N서울타워 전망대 (140m)' }); return; }
      if (this.inDeck && d < 5.3) { this.placeAt(D.cx, D.cz + 9.5, 0); this.y = 0; this.inDeck = false; this.shopCool = 2; return; } }
    // 이웃 지역 길목
    this.gateCool = Math.max(0, (this.gateCool ?? 3) - dt); if (!this.gateCool && !this.inside && !this.inShop && !this.inMall) for (const G of this.gates || []) if (Math.hypot(px - G.x, pz - G.z) < 2.6) { this.gateCool = 5; this.onRegionGate?.(G); return; }
    // 가게 문 앞에서 벽 쪽으로 다가가면 가게 안으로
    this.shopCool = Math.max(0, (this.shopCool || 0) - dt); if (this.carry) { this.carryT -= dt; if (this.carryT <= 0) { this.bear.root.remove(this.carry); this.carry = null; } }
    if (!this.inShop && !this.inside && !this.inMall && !this.shopCool && this.y < 0.5) for (const D2 of this.malls || []) if (Math.hypot(px - D2.x, pz - D2.z) < 3.2 && (this.mdx ?? 0) * D2.nx + (this.mdz ?? 0) * D2.nz < -0.3) { this.enterMall(D2); return; }
    if (!this.inShop && !this.inside && !this.inMall && !this.shopCool && this.y < 0.5) for (const i of this.shopGrid?.get(`${Math.floor(px / 40)},${Math.floor(pz / 40)}`) || []) { const F = this.shopFronts[i]; if (Math.hypot(px - F.x, pz - F.z) < 0.9 && (this.mdx ?? 0) * F.nx + (this.mdz ?? 0) * F.nz < -0.3) { this.enterShop(F); return; } }
    // 출구 계단을 반쯤 내려가면 역 안으로
    this.stationCool = Math.max(0, (this.stationCool || 0) - dt);
    //   앞쪽 입구(계단 앞 인도)를 걸어서 지나온 때만 (옆 · 뒤 · 위에서 비비거나 떨어져 들어가지 않게)
    if (near && near.d < 4 && !this.inside && this.y < 0.3 && !this.flying && !this.climb) { const th = near.g.rotation.y, dx = px - near.x, dz = pz - near.z, lx = dx * Math.cos(th) - dz * Math.sin(th), lz = dx * Math.sin(th) + dz * Math.cos(th);
      if (Math.abs(lx) < 1.1 && lz > -3.2 && lz < -0.6) this.exitMouth = { g: near.g, t: this.time };
      if (!this.stationCool && Math.abs(lx) < 1.1 && lz > -0.4 && lz < 2.2 && this.exitMouth?.g === near.g && this.time - this.exitMouth.t < 2.5) { this.exitMouth = null; this.enterStation(near); return; } }
    const key = near ? `${near.st.name}:${near.ref}` : null; if (key !== this.nearSt) { this.nearSt = key; this.onStation?.(near ? { name: near.st.name, ref: near.ref, lines: near.st.lines } : null); }
  }
  // ---------- 들어가기 · 나가기 ----------
  enter(bear, opt = {}) {
    this.bear = bear; this.prevParent = bear.root.parent; this.scene.add(bear.root);
    this.s = opt.s ?? 30; this.dir = 1; this.lat = -4.3; this.v = 0; this.target = 6.4; this.y = 0; this.vy = 0; this.dist = 0; this.time = 0; this.moments = {}; this.turnT = 0;
    const p0 = this.at(this.s); [this.px, this.pz] = this.world(this.s, this.lat); this.face = Math.atan2(p0.dx, p0.dz); this.camYaw = this.face; this.ri = Math.round(this.s / this.step); this.dragT = 0; this.camInit = false; this.mdx = null; this.spawnFix = 8;
    bear.root.scale.setScalar(BEAR); bear.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const r = rnd((Date.now() / 1000) | 0), K = opt.keep;
    // 다른 지역에서 옮겨 왔으면 시각 · 계절 · 날씨를 그대로 (무작위는 처음 시작할 때만)
    if (K) { this.opt = { ...this.opt, ...K.opt }; this.state = { ...this.state, ...K.state }; }
    else if (this.opt.season === 'auto') this.state.season = Object.keys(SEASONS)[Math.floor(r() * 4)];
    if (!K && this.opt.weather === 'auto') this.state.weather = this.randWeather(r);
    if (!K && this.opt.time === 'auto') this.state.hour = [5.9, 6.4, 9.5, 15.8, 16.6, 17.2, 17.7, 18.1, 18.4, 19.2, 21, 13][Math.floor(r() * 12)]; // 감성적인 시간(늦은 오후 · 노을 · 해 뜰 녘)이 더 자주
    this.applySeason(); this.weatherT = K?.weatherT ?? 240 + r() * 360; this.r = r;
    for (const p of this.people) this.removePerson(p); this.people = []; for (const gd of this.groups) this.removeGroup(gd); this.groups = []; for (const w of this.walkers || []) this.removePerson(w); this.walkers = []; for (const w of this.shoppers || []) this.removePerson(w); this.shoppers = []; this.traffic?.clear(); this.drive?.dispose(); this.seenLabel = new Set(); this.activeLabels = []; this.regionName = null; this.regionSeen = new Map(); this.jumps = 0; this.flipT = 0;
  }
  leave() { if (this.bear) { this.bear.root.traverse((o) => { if (o.isMesh) o.castShadow = false; }); this.bear.root.scale.setScalar(1); this.bear.inner.rotation.set(0, 0, 0); this.bear.inner.position.set(0, 0, 0); } if (this.bear && this.prevParent) this.prevParent.add(this.bear.root); for (const p of this.people) this.removePerson(p); this.people = []; for (const gd of this.groups) this.removeGroup(gd); this.groups = []; this.bear = null; }
  randWeather(r) { const s = this.state.season, x = r(); if (s === 'winter') return x < 0.45 ? 'clear' : x < 0.75 ? 'cloudy' : 'snow'; return x < 0.55 ? 'clear' : x < 0.82 ? 'cloudy' : 'rain'; }
  setOpt(k, v) {
    this.opt[k] = v;
    if (k === 'season' && v !== 'auto') { this.state.season = v; this.applySeason(); }
    if (k === 'weather' && v !== 'auto') this.state.weather = v;
    if (k === 'time' && v !== 'auto') this.state.hour = TIMES[v][1];
  }
  applySeason() {
    for (const ch of this.chunks?.values() || []) ch.applySeason(); // 서울 전체: 칸마다
    // 남산 숲 (정상 둘레 둥근 나무): 계절 색 — 봄엔 벚꽃이 섞이고, 가을엔 단풍, 겨울엔 소나무만 푸르다
    if (this.summitTrees) { const T = this.summitTrees, c = new THREE.Color(), s2 = this.state.season, P = { spring: ['#6f9a52', '#86ad5e', '#f4c6d8', '#5f8a4a', '#ffd6e4', '#7aa858'], summer: ['#3f6a3c', '#4f7a44', '#355f36', '#5a8a4a', '#2f5a34'], autumn: ['#c8502a', '#e0882e', '#d9a83a', '#a8402a', '#3f6a3c', '#e8b84a', '#b8662e'], winter: ['#3a5a3e', '#8a7f74', '#9a9088', '#7d746c', '#3f5f40'] }[s2] || []; for (let q = 0; q < T.count; q++) T.setColorAt(q, c.set(P[(q * 7 + (q >> 3)) % P.length])); if (T.instanceColor) T.instanceColor.needsUpdate = true; }
    if (!this.trees) return; // 서울 전체의 주인은 나무가 없다 (칸에 있다)
    const s = this.state.season, r = rnd(4242), c = new THREE.Color(), N = this.trees.length;
    const pal = { spring: ['#ffc9de', '#ffd6e6', '#ffb9d3', '#ffe3ee', '#ffc0d8'], summer: ['#3f8a3a', '#4f9a40', '#2f7a34', '#5aa548', '#3a7f40'], autumn: ['#e8742a', '#f2b233', '#c8402a', '#d9902a', '#9aa83a', '#f0c84a'], winter: ['#ffffff'] }[s];
    void N;
    const fpal = { spring: ['#8cbf62', '#9cc96e', '#7aae55', '#a6d07a', '#86b85e', '#b4d88a'], summer: ['#3d7a34', '#4a8a3c', '#356e30', '#56913f', '#2f6a30'], autumn: ['#c8642a', '#d9962e', '#a8402a', '#b8a040', '#6a8a3a', '#8a5a2a', '#e0b040', '#9a6a30'], winter: ['#ffffff'] }[s];
    for (const set of this.crownSets) {
      if (!set) continue; const { crowns, idx, pine } = set;
      // 숲 나무: 봄엔 연두 새잎(벚꽃은 드물게), 여름 짙은 초록, 가을엔 단풍 · 갈잎 · 아직 푸른 잎이 섞인다
      const P2 = set.forest ? fpal : pal;
      idx.forEach((si, q) => { if (pine) c.set(['#2f5d3a', '#355f3c', '#2a5233'][si % 3]).offsetHSL(0, 0, s === 'winter' ? 0.04 : 0); else { c.set(P2[Math.floor(r() * P2.length)]); if (s === 'spring' && si % 6 === 5) c.set(set.forest ? '#ffd0e0' : '#b9de8c'); } c.offsetHSL(0, 0, (r() - 0.5) * 0.06); crowns.setColorAt(q, c); });
      crowns.instanceColor.needsUpdate = true; crowns.visible = pine || s !== 'winter';
    }
    for (const tw of this.twigSets) tw.visible = s === 'winter';
    this.blossomTex ||= foliageTex(true); for (const m of this.cardMats || []) { m.map = s === 'spring' ? this.blossomTex : this.leafTex; m.needsUpdate = true; }
    const grass = { spring: '#9cbf7c', summer: '#86ab68', autumn: '#97a65e', winter: '#b3b89a' }[s];
    this.greenM.grass?.color.set(grass); for (const m of this.wideM || []) m.color.set(grass); this.stripM?.color.set(grass); this.greenM.wild?.color.set(grass).offsetHSL(0, -0.05, -0.03); if (this.greenM.wood) { const wm = this.greenM.wood; wm.map = forestFloorTex(s); if (wm.userData.uCan) wm.userData.uCan.value = canopyTex(s); wm.needsUpdate = true; } this.islandM.color.set(grass).offsetHSL(0, 0, -0.06);
    const tc = new THREE.Color(); for (let i = 0; i < this.tufts.count; i++) { tc.setHSL(s === 'autumn' ? 0.12 + r() * 0.05 : s === 'winter' ? 0.14 : s === 'summer' ? 0.26 + r() * 0.05 : 0.23 + r() * 0.06, s === 'winter' ? 0.18 : 0.55, s === 'winter' ? 0.62 : 0.4 + r() * 0.14); this.tufts.setColorAt(i, tc); } if (this.tufts.instanceColor) this.tufts.instanceColor.needsUpdate = true;
    this.flowers.visible = s === 'spring' || s === 'summer';
  }

  // ---------- 한 프레임 ----------
  //   inp = { lat(-1~1), up(-1~1: 속도), jump }
  update(dt, inp, camera) {
    if (!this.ready || !this.bear) return;
    this.t += dt; this.time += dt;
    const st = this.state;
    // 서울 명소 체험 (hangang-attractions.js): 타고 있는 동안은 움직임 잠금
    if (this.chunks) { this.attr ||= setupAttractions(this); if (this.attr.lock) inp = this.attr.lockInput(inp); }
    if (this.rideL?.lock) inp = this.rideL.lockInput(inp);
    // 차 운전 (hangang-drive.js): 운전하는 동안 곰 움직임은 잠그고, 입력은 차로
    this.drive ||= new Drive(this);
    { const raw = inp; if (this.drive.lock) inp = this.drive.lockInput(inp); this.drive.tick(dt, raw); }
    // 시간 흐름 (기본: 게임 속 1시간 = 1분)
    if (this.opt.time === 'auto' || this.opt.flow > 0) st.hour = (st.hour + (dt / 60) * (this.opt.flow ?? 1)) % 24;
    // 날씨는 가끔 바뀐다
    if (this.opt.weather === 'auto') { if (this.city && this.city.rain !== undefined && this.city.at) { st.weather = /눈/.test(this.city.rain) ? 'snow' : this.city.rain ? 'rain' : /흐림|구름/.test(this.city.sky) ? 'cloudy' : st.weather === 'rain' || st.weather === 'snow' ? 'clear' : st.weather; } else { this.weatherT -= dt; if (this.weatherT <= 0) { this.weatherT = 240 + this.r() * 420; st.weather = this.randWeather(this.r); } } }
    // 속도 단계: Q · E · +/- 로 고른다. 움직이는 건 누르는 동안만 (W A S D · 조이스틱, 카메라가 보는 쪽 기준)
    if (inp.speedTo != null) { this.target = inp.speedTo; inp.speedTo = null; }
    this.flyDown = (inp.mz || 0) < -0.3; if (this.flying && (inp.mz || 0) < 0) inp = { ...inp, mz: 0 }; // 날 때 S 는 뒤로 가기가 아니라 내려가기
    this.camYaw += inp.yaw || 0; this.camPitch = clamp((this.camPitch ?? 0.32) + (inp.pitch || 0), -0.6, 1.2); if (inp.yaw || inp.pitch) this.dragT = 2.5; this.dragT = Math.max(0, this.dragT - dt);
    const fx0 = Math.sin(this.camYaw), fz0 = Math.cos(this.camYaw);
    let mx = fx0 * (inp.mz || 0) - fz0 * (inp.mx || 0), mz = fz0 * (inp.mz || 0) + fx0 * (inp.mx || 0); const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    // Shift(휴대폰은 💨 버튼)를 누르는 동안 가속: 지금 단계보다 확 빨라진다
    if (inp.sprint && ml > 0.05) this.boostOn = true; if (ml <= 0.05) this.boostOn = false;
    // 날 때: 기본 1.5배, Shift 가속이면 그 5배까지 (서울 끝에서 끝까지 날아갈 수 있게) · 가속도도 크게
    const boost = !!this.boostOn, flyK = this.flying ? (boost ? 7.5 : 1.5) : 1, want = Math.min(V_MAX * flyK, (this.target * Math.min(1, ml) * (boost ? 1.8 : 1) + (boost ? 3 : 0)) * flyK);
    this.v += (want - this.v) * Math.min(1, dt * (want > this.v ? (this.flying ? (boost ? 2.2 : 3) : boost ? 4.5 : 1.8) : this.flying ? 2.5 : 4)); this.boosting = boost;
    let ds = 0;
    if (ml > 0.05) { this.mdx = mx / ml; this.mdz = mz / ml; }
    const R0 = 0.28; // 곰돌이 몸 반지름
    if (this.climb) {
      // 벽 타기: 앞(W)으로 오르고 뒤(S)로 내려가고, 옆(A · D)으로 게걸음 · 점프하면 벽에서 떨어진다
      const C = this.climb, up = (inp.mz || 0), side = (inp.mx || 0);
      this.y = clamp(this.y + up * 6.8 * dt, 0, C.top);
      if (C.f.tp) { const w = wallNear(ringAtY(C.f, this.y), this.px, this.pz); if (w) { this.px = w.x + w.nx * R0 * 1.001; this.pz = w.z + w.nz * R0 * 1.001; C.nx = w.nx; C.nz = w.nz; } }
      const tx = -C.nz, tz = C.nx; let nx = this.px + tx * side * 4.4 * dt, nz = this.pz + tz * side * 4.4 * dt;
      const ok = this.pushOut(nx, nz, this.y, R0, C.f); if (ok.f !== C.f && !ok.hit) { nx = this.px; nz = this.pz; } else { nx = ok.x; nz = ok.z; }
      this.px = nx; this.pz = nz; this.face = Math.atan2(-C.nx, -C.nz); this.v = Math.abs(up) + Math.abs(side) > 0.1 ? 2.5 : 0; this.vy = 0;
      if (inp.jump) { this.climb = null; this.vy = 5; this.jumps = 1; this.px += C.nx * 1.0; this.pz += C.nz * 1.0; inp.jump = false; }
      else if (this.y >= C.top - 0.02) { this.climb = null; this.y = C.top; this.px -= C.nx * 0.9; this.pz -= C.nz * 0.9; this.onRoof = C.f; }
      else if (this.y <= 0.01 && up < 0) this.climb = null;
    } else if (this.v > 0.02 && this.mdx != null) {
      // 서울 전체 지형: 오르막은 조금 느리게(가파를수록, 최대 40%), 내리막은 조금 빠르게(최대 15%). 날 때 · 지붕 위는 그대로
      let slopeK = 1; if (this.terr && !this.flying && this.y < 0.5) { const g = (this.terrAt(this.px + this.mdx * 3, this.pz + this.mdz * 3) - this.terrAt(this.px, this.pz)) / 3; slopeK = g > 0 ? 1 - Math.min(0.4, g * 2.2) : 1 + Math.min(0.15, -g * 0.8); }
      let nx = this.px + this.mdx * this.v * slopeK * dt, nz = this.pz + this.mdz * this.v * slopeK * dt;
      // 지도 밖 · 물속(코스 다리 제외)은 못 간다
      // 지역 지도는 가운데 ±2.5km 상자 안. 서울 전체는 서울 좌표라 그 상자에 갇히면 안 된다(마포 같은 곳에서 앞으로 못 가던 것) → 서울 지형 격자 끝까지
      //   역 · 가게 · 몰 안(멀리 따로 지은 실내)에서는 가두지 않는다 (가두면 대합실에서 걷자마자 서울 끝으로 튕겼다)
      if (this.chunks && !this.inside && !this.inShop && !this.inMall) { const T = this.terr; if (T) { nx = clamp(nx, T.x0 + 50, T.x0 + (T.nx - 1) * T.step - 50); nz = clamp(nz, T.z0 + 50, T.z0 + (T.nz - 1) * T.step - 50); } }
      else if (!this.chunks) { nx = clamp(nx, -2500, 2500); nz = clamp(nz, -2500, 2500); }
      const qn = this.project(nx, nz);
      // 물 위로는 점프 중에도 못 나간다 (2 · 3단 점프로 한강을 건너지 못하게)
      if (!(this.flying && this.y > 1.5) && !this.walkable(nx, nz, qn.lat) && this.deckAt(nx, nz, this.y) < 0) { if (this.walkable(nx, this.pz, qn.lat)) nz = this.pz; else if (this.walkable(this.px, nz, qn.lat)) nx = this.px; else { nx = this.px; nz = this.pz; } }
      // 건물 · 나무 · 가로등 · 교각 · 사람과 부딪힘 (벽을 따라 미끄러진다)
      const res = this.pushOut(nx, nz, this.y, R0, this.onRoof);
      nx = res.x; nz = res.z;
      // 벽을 향해 계속 걸으면 벽 타기 (젤리시티처럼)
      if (res.wall && !res.wall.f.noClimb && this.mdx * res.wall.nx + this.mdz * res.wall.nz < -0.55 && res.wall.f.h > this.y + 1.2) { this.wallPush = (this.wallPush || 0) + dt; if (this.wallPush > 0.22) { this.climb = { f: res.wall.f, nx: res.wall.nx, nz: res.wall.nz, top: res.wall.f.h }; this.wallPush = 0; this.vy = 0; this.jumps = 0; } }
      else this.wallPush = 0;
      ds = Math.hypot(nx - this.px, nz - this.pz); this.px = nx; this.pz = nz; if (!this.flying) this.dist += ds; // 달린 거리 기록 · 업적은 걷고 달린 거리만
      const q2 = this.project(nx, nz); this.s = q2.s; this.lat = q2.lat;
      const tg = this.at(this.s); this.dir = this.mdx * tg.dx + this.mdz * tg.dz >= 0 ? 1 : -1;
      this.face += (((Math.atan2(this.mdx, this.mdz) - this.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 9);
      // 카메라는 손으로 돌린 뒤 잠시 그대로, 그다음 천천히 등 뒤로
      //   날 때 · 마우스로 시점을 잡은 동안(포인터 잠금)은 저절로 돌지 않는다 (옆 · 뒤로 날면 몸과 카메라가 서로 따라 돌며 화면이 빙글 돌던 것)
      if (this.dragT <= 0 && ml > 0.05 && !this.flying && !document.pointerLockElement) this.camYaw += (((this.face - this.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 1.2);
    } else this.wallPush = 0;
    // 점프 · 2단 · 3단 점프(공중제비) · 숙이기 · 옥상 위에 서기
    const ground = this.groundAt(this.px, this.pz, this.y);
    if (!this.climb) {
      // 날기: 점프 → 공중에서 Space 한 번 더 = 날기 (가게 · 역 · 몰 안에선 작은 2단 점프). 날 때 Space 꾹 = 위로 · S = 아래로 · Space 두 번 빠르게 = 날기를 멈추고 떨어지기
      if (inp.jump) {
        if (this.flying) { const now = this.time; if (now - (this.lastFlyTap ?? -9) < 0.35) { this.flying = false; this.jumps = 2; this.vy = 0; this.lastFlyTap = -9; this.onFly?.('fall'); } else this.lastFlyTap = now; }
        else if (this.y <= ground + 0.001) { this.vy = 5.2; this.jumps = 1; }
        else if (!this.inside && !this.inShop && !this.inMall) { this.flying = true; this.vy = 2; this.lastFlyTap = this.time; this.onFly?.(true); } // 공중에서 한 번 더 = 바로 날기 (2단 점프 없음)
        else if (this.jumps < 2) { this.vy = 4.9; this.jumps++; this.flipT = FLIP_T; } }
      if (this.flying) { const upIn = (inp.jumpHeld ? 1 : 0) - (this.flyDown || inp.slide ? 1 : 0); this.vy += (upIn * 9 - this.vy) * Math.min(1, dt * 4); this.y = Math.min(400, Math.max(ground, this.y + this.vy * dt)); if (this.y <= ground + 0.001 && this.vy <= 0) { this.flying = false; this.jumps = 0; this.vy = 0; this.onFly?.(false); } }
      else { this.vy -= 16 * dt; this.y = Math.max(ground, this.y + this.vy * dt); if (this.y <= ground) { this.vy = Math.max(0, this.vy); this.jumps = 0; } }
    }
    this.flipT = Math.max(0, this.flipT - dt); this.slide = !!inp.slide && this.y <= ground + 0.001 && !this.climb;
    if (this.slide) this.v = Math.min(this.v, this.target * 0.75);
    // 순간들 (업적): 노을 · 밤 · 일출 · 비 · 눈 · 계절에 달린 거리
    const h = st.hour, mo = h >= 17.9 && h < 19.4 ? 'sunset' : h >= 5.3 && h < 6.9 ? 'sunrise' : h >= 20.5 || h < 4.2 ? 'night' : null;
    const add = (k) => { this.moments[k] = (this.moments[k] || 0) + ds; };
    if (mo) add(mo); if (st.weather === 'rain') add('rain'); if (st.weather === 'snow') add('snow'); add(st.season);
    this.attr?.tick(dt, inp);
    // 곰돌이
    const bx = this.px, bz = this.pz;
    const tb = this.terrAt(bx, bz); this.bear.root.position.set(bx, this.y + tb, bz); this.bear.root.rotation.y = this.face; this.bear.root.visible = true;
    this.bear.inner.rotation.set(0, 0, 0);
    this.bear.update(dt, Math.min(16, this.v * 1.7), { noCrawl: true });
    this.bear.climbing = !!this.climb;
    if (!this.climb) poseBear(this.bear, { ground: this.y <= this.groundAt(bx, bz, this.y) + 0.001, slide: this.slide, flip: this.flipT > 0 ? 1 - this.flipT / FLIP_T : null, vy: this.vy, alive: true }, dt);
    this.drive?.post();
    this.shadow.position.set(bx, this.groundAt(bx, bz, this.y) + tb + 0.02, bz); this.shadow.scale.setScalar(BEAR * (1 - Math.min(0.5, this.y * 0.2)));
    this.tickSignals(this.time);
    this.worldT = (this.worldT || 0) - dt; if (this.worldT <= 0) { this.worldT = 0.5; this.tickWorld(bx, bz); }
    // 멀리 있는 작은 것(출구 · 동 번호 등)은 숨긴다 (0.5초마다)
    this.lodT = (this.lodT || 0) - dt; if (this.lodT <= 0) { this.lodT = 0.5; const v = new THREE.Vector3(); for (const o of this.lodObjs || []) { const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere); v.copy(bs.center).applyMatrix4(o.matrixWorld); o.visible = Math.hypot(v.x - bx, v.z - bz) - bs.radius < 400; }
      // 곰(사람)은 70m 밖이면 숨긴다 (곰 하나가 부품 수십 개라 무겁다)
      for (const c of this.scene.children) if (c.userData.npc) c.visible = Math.hypot(c.position.x - bx, c.position.z - bz) < 70; }
    if (this.spawnFix > 0) this.fixSpawn(dt);
    this.tickPeople(dt, bx, bz); this.tickGroups(dt, bx, bz); this.tickCity(dt, bx, bz); this.tickTransit(dt, bx, bz); this.tickLabels(dt, camera, bx, bz);
    if (this.inside) { this.tickInside(dt); }
    if (this.inShop) this.tickShop(dt); else if (this.inMall) this.tickMall(dt);
    this.tickEnv(dt, camera, bx, bz);
    // 안에 있는 동안: 바깥 것은 새로 생긴 것(차 · 행인)까지 모두 숨긴다
    if (this.inside || this.inShop || this.inMall) { const keep = this.ride?.C.g || (this.inShop ? this.inShop.I.g : this.inMall ? this.inMall.I.g : this.inside?.S.g); this.hidden ||= []; for (const o of this.scene.children) if (o !== keep && o !== this.bear?.root && o !== this.shadow && o.visible) { o.visible = false; this.hidden.push(o); } } // 날씨 · 계절이 다시 켠 바깥 것들은 다시 숨긴다
    // 실내로 바꾸기 전 바깥 안개 색을 기억 (롯데월드타워 창밖을 바깥 그대로 그릴 때)
    if (this.inMall?.I?.isTower) (this.fogOutC ||= new THREE.Color()).copy(this.scene.fog.color);
    if ((this.inside || this.inShop || this.inMall) && this.scene.fog) { this.scene.fog.density = this.inMall?.I?.fog ?? 0.004; this.scene.fog.color.set('#d8d2c8'); } // 역 안: 안개 거의 없이
    if (this.chunks) this.liftMovers();
    this.tickCamera(dt, camera, bx, bz, Math.sin(this.camYaw), Math.cos(this.camYaw));
    this.attr?.cam(camera, dt);
    this.rideL?.cam(camera, dt);
    this.drive?.cam(camera, dt);
    // 차 그물 가까운 것 · 먼 것 고르기에 쓰는 카메라 자리
    this.camPos = camera.position;
  }
  // 사람 수 · 구성: 계절 · 날씨 · 시간에 따라 (벚꽃 철엔 연인이 가득, 비 · 추위 · 한밤엔 드문드문 러너만)
  crowd() {
    const { season, weather, hour: h } = this.state, rain = weather === 'rain', snow = weather === 'snow';
    let k = { clear: 1, cloudy: 0.8, rain: 0.32, snow: 0.45 }[weather] * { spring: 1.35, summer: 1.15, autumn: 1.1, winter: 0.55 }[season];
    k *= h < 5 ? 0.25 : h < 6.5 ? 0.45 : h < 9 ? 0.8 : h < 11 ? 0.85 : h < 17 ? 1 : h < 21 ? 1.25 : h < 23 ? 0.75 : 0.4;
    const night = h >= 21 || h < 6, morning = h >= 5 && h < 9, evening = h >= 17 && h < 21;
    // 길 위 구성 [러너, 둘이 달리기, 할머니와 손자, 엄마와 아이, 연인, 친구, 혼자 산책]
    let w = [4, 1, 1, 1, 1.4, 1.2, 1.4];
    if (morning || night) w = [7, 1.4, 0.3, 0.2, night ? 0.9 : 0.3, night ? 0.5 : 0.3, 1];
    if (season === 'spring' && !rain) { w[4] *= 3.2; w[5] *= 1.5; w[2] *= 1.4; w[3] *= 1.4; }
    if (weather === 'clear' && !night) { w[2] *= 1.5; w[3] *= 1.7; w[4] *= 1.4; w[5] *= 1.7; }
    if (evening) { w[4] *= 1.6; w[5] *= 1.4; }
    if (rain || snow || season === 'winter') { w = [w[0] * 1.3, w[1], w[2] * 0.3, w[3] * 0.3, w[4] * (snow ? 1.2 : 0.6), w[5] * 0.6, w[6] * 0.7]; }
    // 공원 무리 [피크닉, 캠핑, 원반, 연, 벤치, 수다]
    let gw = [3, 1.2, 1, 1, 1, 1.2];
    if (season === 'spring') { gw[0] *= 2; gw[5] *= 1.5; } if (season === 'autumn') { gw[1] *= 2; gw[3] *= 1.5; } if (season === 'summer') { gw[1] *= 1.6; gw[2] *= 1.5; }
    if (night) { gw = [0.6, gw[1] * 1.4, 0.05, 0.05, 0.5, 0.8]; } if (rain || snow) gw = [0, 0.2, 0, 0, 0.6, 1];
    // 실제 여의도 인구 혼잡도 (서울 실시간 도시데이터): 여유 · 보통 · 약간 붐빔 · 붐빔
    const live = { 여유: 0.85, 보통: 1.1, '약간 붐빔': 1.4, 붐빔: 1.8 }[this.city?.congest]; if (live) k *= live;
    return { k, w, gw, groups: rain ? 0.25 : snow ? 0.4 : season === 'winter' ? 0.5 : night ? 0.45 : 1 };
  }
  tickPeople(dt, px, pz) {
    if (this.chunks) return; // 서울 전체: 코스(러닝 길)가 없어 코스 따라 달리는 사람은 없다 (골목 · 거리 행인은 tickCity)
    const r = this.r, cw = this.crowd(), maxP = Math.round((isPhone ? 8 : 14) * Math.min(1.5, cw.k));
    // 주변에 사람이 너무 적으면 앞쪽(보이지 않는 곳)에 새로 놓는다
    this.peopleT -= dt;
    if (this.peopleT <= 0 && this.people.length < Math.max(1, maxP)) {
      this.peopleT = (1.5 + r() * 3) / Math.max(0.25, cw.k);
      const kind = ['runner', 'runner2', 'family', 'parent', 'couple', 'friends', 'stroll'][wpick(r, cw.w)];
      const ahead = this.s + this.dir * (70 + r() * 90);
      if (ahead > 5 && ahead < this.L - 5) {
        if (kind === 'runner' || kind === 'runner2') { const opp = r() < 0.6; this.spawnPerson(kind, ahead, opp ? -this.dir : this.dir, opp ? -3.6 - r() * 1.2 : -4.8 + r() * 1.2, opp ? 2.4 + r() * 1.6 : Math.max(1.6, this.v - 0.6 - r() * 0.8), r); }
        else this.spawnPerson(kind, ahead, r() < 0.5 ? 1 : -1, 3.6 + r() * 5, 0.7 + r() * 0.35, r);
      }
    }
    for (const p of this.people) {
      p.s += p.dir * p.v * dt; p.t += dt;
      const q = this.at(p.s), f = Math.atan2(q.dx * p.dir, q.dz * p.dir);
      p.bears.forEach((b, i) => { const lat = p.lat + i * 0.75 * (p.dir > 0 ? 1 : -1); const [x, z] = this.world(p.s - (i > 1 ? 0.6 : 0) * p.dir, lat); b.root.position.set(x, 0, z); b.root.rotation.y = f; b.update(dt, p.v * 2, { noCrawl: true }); });
      if (p.kind === 'couple') { p.heartT -= dt; if (p.heartT <= 0) { p.heartT = 4 + Math.random() * 6; p.heart ||= heartSprite(); this.scene.add(p.heart); p.heartLife = 1.6; } if (p.heartLife > 0) { p.heartLife -= dt; const b = p.bears[0].root.position; p.heart.position.set(b.x, 1.0 + (1.6 - p.heartLife) * 0.4, b.z); p.heart.material.opacity = Math.min(1, p.heartLife); } }
    }
    for (const p of [...this.people]) { const [x, z] = this.world(p.s, p.lat); if (Math.hypot(x - px, z - pz) > 260 || p.s < 2 || p.s > this.L - 2) { this.removePerson(p); this.people.splice(this.people.indexOf(p), 1); } }
  }
  // 밤 불빛: 이 지도(또는 칸)의 재질들
  tickLit(lit, hr, home, work, dt) {
    for (const m of Object.values(this.bldByType || {})) m.emissiveIntensity = lit * 0.85; // 창마다 켜짐 · 색은 hangang-windows.js (시간대별 비율 WIN_U)
    if (this.signM) this.signM.emissiveIntensity = lit * (hr >= 1 && hr < 6 ? 0.15 : 0.45);
    if (this.alleyLampM) { this.alleyLampM.emissiveIntensity = lit * 1.5; this.alleyGlowM.opacity = lit * 0.3; }
    if (this.assemblyM) this.assemblyM.emissiveIntensity = lit * 0.25; if (this.crossM) this.crossM.emissiveIntensity = lit * 1.6; for (const m of this.lmCross || []) m.emissiveIntensity = 0.1 + lit * 1.4; for (const m of this.lmLights || []) m.opacity = 0.15 + lit * 0.85; for (const m of this.lmScreens || []) m.emissiveIntensity = 0.35 + lit * 0.6; for (const m of this.lmCrowns || []) m.emissiveIntensity = lit * 0.35; for (const m of this.exitSignMs || []) m.emissiveIntensity = 0.2 + lit * 0.7; if (this.summit) tickSummit(this, dt, lit); for (const m of this.neonMs || []) m.emissiveIntensity = 0.2 + lit * 1.2; if (this.jbugM) this.jbugM.emissiveIntensity = 0.15 + lit * 0.7; if (this.id === 'banpo' || this.fountain || this.sebit) this.tickBanpo(dt, lit); if (this.mfount) this.tickMusicFountain(dt, lit); for (const b of this.picnic || []) b.update(dt, 0, { noCrawl: true }); for (const m of this.shopSignMs || []) m.emissiveIntensity = 0.25 + lit * 0.85; for (const m of this.shopWinM || []) m.emissiveIntensity = 0.1 + lit * 0.42; if (this.exitLightM) { this.exitLightM.emissiveIntensity = 0.3 + lit * 1.5; this.exitGlowM.opacity = lit * 0.1; } for (const m2 of this.domeMs || []) m2.emissiveIntensity = lit * 0.6; if (this.farM) this.farM.emissiveIntensity = lit * 0.6;
    if (this.bridgeLights) this.bridgeLights.material.opacity = lit;
    // 가로등 · 정류장 화면 · 조형물 조명 (hangang-street.js)
    for (const f of this.litFns || []) f(lit, hr);
  }
  tickEnv(dt, camera, px, pz) {
    const st = this.state, h = st.hour, sk = skyAt(h), wt = st.weather;
    const cloud = wt === 'clear' ? 0.08 : wt === 'cloudy' ? 0.6 : 0.85;
    this.cloudK = lerp(this.cloudK ?? cloud, cloud, Math.min(1, dt * 0.3));
    const ck = this.cloudK, grey = C(wt === 'snow' ? '#c9ced6' : '#8f969e');
    const dayL = clamp((sk.top.r + sk.top.g + sk.top.b) * 0.9, 0.1, 1);
    sk.top.lerp(grey.clone().multiplyScalar(dayL), ck * 0.75); sk.hor.lerp(grey.clone().multiplyScalar(dayL * 1.1), ck * 0.7);
    // 해 · 달 방향 (해는 동쪽에서 떠서 남쪽을 지나 서쪽으로)
    const th = ((h - 6) / 13) * Math.PI, el = Math.sin(th) * 0.95;
    const sun = new THREE.Vector3(Math.cos(th), el, Math.sin(Math.max(0, Math.min(Math.PI, th))) * 0.55).normalize();
    const mth = ((h - 18.5 + 24) % 24) / 12 * Math.PI, moon = new THREE.Vector3(Math.cos(mth), Math.sin(mth) * 0.85, 0.45).normalize();
    const night = 1 - smooth(-0.12, 0.12, sun.y);
    this.skyU.top.value.copy(sk.top); this.skyU.hor.value.copy(sk.hor); this.skyU.sunDir.value.copy(sun); this.skyU.moonDir.value.copy(moon); this.skyU.night.value = night; this.skyU.cloud.value = ck;
    const sunCol = C('#fff2d6').lerp(C('#ff8a4a'), 1 - smooth(0.05, 0.4, sun.y)); this.skyU.sunCol.value.copy(sunCol);
    this.sky.position.set(camera.position.x, 0, camera.position.z);
    // 빛
    const sunUp = smooth(-0.05, 0.25, sun.y);
    { const ty = this.terrAt(px, pz); this.sun.position.copy(sun.y > 0.06 ? sun : moon).multiplyScalar(400).add(new THREE.Vector3(px, ty, pz)); this.sun.target.position.set(px, ty, pz); } // 그림자 상자가 곰을 따라 언덕 위로
    this.sun.color.copy(sun.y > -0.05 ? sunCol : C('#9fb4ff')); this.sun.intensity = (sun.y > -0.05 ? 2.3 * sunUp : 0.4) * (1 - ck * 0.5);
    this.hemi.color.copy(sk.top).lerp(C('#ffffff'), 0.45); this.hemi.groundColor.copy(sk.ground).lerp(C('#6f8a4a'), 0.35 * sunUp); this.hemi.intensity = lerp(0.6, 1.25, sunUp) * (1 - ck * 0.15);
    const fogC = sk.hor.clone().lerp(sk.top, 0.25).lerp(sunCol, (1 - smooth(0.05, 0.45, sun.y)) * sunUp * 0.35).lerp(C('#c9a7b8'), 0.12 * sunUp), fd = wt === 'rain' ? 0.00095 : wt === 'snow' ? 0.0012 : wt === 'cloudy' ? 0.00055 : 0.00042; // 먼 곳이 아련하게 (공기 원근)
    this.scene.fog.color.copy(fogC); this.scene.fog.density = lerp(this.scene.fog.density, fd, Math.min(1, dt * 0.5));
    this.waterU.fogCol.value.copy(fogC); this.waterU.fogD.value = this.scene.fog.density; this.waterU.time.value = this.t; this.windU.value = this.t; this.waterU.rain.value = lerp(this.waterU.rain.value, wt === 'rain' ? 1 : 0, Math.min(1, dt));
    this.mtM.color.copy(sk.hor).lerp(sk.top, 0.25).multiplyScalar(0.82);
    // 밤: 창문 · 가로등 · 다리 불빛 · 자동차
    const lit = smooth(0.15, 0.8, night);
    // 시간대별 켜진 정도: 집은 저녁 7 ~ 11시가 가장 밝고 새벽엔 거의 꺼짐, 회사는 퇴근 무렵 밝다가 밤이 깊으면 거의 꺼짐
    const hr = h, home = hr >= 17 && hr < 19 ? 0.6 : hr >= 19 && hr < 23 ? 1 : hr >= 23 || hr < 1 ? 0.55 : hr < 5 ? 0.12 : hr < 7 ? 0.3 : 0.2;
    const work = hr >= 17 && hr < 20 ? 1 : hr >= 20 && hr < 22 ? 0.55 : hr >= 22 || hr < 6 ? 0.08 : hr < 8 ? 0.35 : 0.3;
    tickWindows(hr, this.t); this.tickLit(lit, hr, home, work, dt); for (const c of this.chunks?.values() || []) { c.time = this.time; c.tickLit(lit, hr, home, work, dt); }
    this.lampGlow.material.opacity = lit; if (this.lampHeadM) this.lampHeadM.emissiveIntensity = 0.2 + lit * 2.2;
    this.lampPool.material.opacity = lit * 0.32;
    let pi = 0; for (const [x, z] of this.poleXZ) { if (pi >= this.pools.length) break; if (Math.abs(x - px) < 90 && Math.abs(z - pz) < 90) { this.pools[pi].position.set(x, 0.03, z); this.pools[pi].visible = true; pi++; } } for (; pi < this.pools.length; pi++) this.pools[pi].visible = false;
    this.traffic.tickFar(dt, lit);
    // 구름
    for (const c of this.clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 6000) c.position.x = -6000; c.material.opacity = clamp((c.userData.k < 0.45 ? 0.16 : 0.02) + ck * 0.85 * (0.6 + c.userData.k * 0.4), 0, 0.92); c.material.color.copy(sk.top).lerp(C('#ffffff'), 0.25 + sunUp * 0.55).lerp(sunCol, (1 - smooth(0.05, 0.35, sun.y)) * sunUp * 0.35); }
    // 비 · 눈: 카메라 둘레 상자 안에서
    const rainOn = wt === 'rain', snowOn = wt === 'snow';
    this.rain.visible = rainOn; this.snow.visible = snowOn;
    if (rainOn) { const a = this.rain.geometry.attributes.position, arr = a.array; for (let i = 0; i < this.rainV.length; i++) { let y = arr[i * 6 + 1] - this.rainV[i] * dt; if (y < 0) y += 40; arr[i * 6 + 1] = y; arr[i * 6 + 4] = y - 0.7; } a.needsUpdate = true; this.rain.position.set(camera.position.x, camera.position.y - 14, camera.position.z); }
    if (snowOn) { const a = this.snow.geometry.attributes.position, arr = a.array; for (let i = 0; i < arr.length; i += 3) { arr[i + 1] -= dt * (0.9 + (i % 7) * 0.08); arr[i] += Math.sin(this.t * 0.7 + i) * dt * 0.3; if (arr[i + 1] < 0) arr[i + 1] += 40; } a.needsUpdate = true; this.snow.position.set(camera.position.x, camera.position.y - 14, camera.position.z); }
    // 겨울 눈 오면 땅이 하얘진다
    const snowy = this.state.season === 'winter' && snowOn; this.snowK = lerp(this.snowK || 0, snowy ? 1 : 0, Math.min(1, dt * 0.05)); SNOW_U.value = this.snowK * 0.9;
    // 잔디 색(계절 · 눈) — 서울 전체면 칸마다
    const grassC = C({ spring: '#9cbf7c', summer: '#86ab68', autumn: '#97a65e', winter: '#b3b89a' }[this.state.season]).lerp(C('#eef2f6'), this.snowK * 0.85);
    for (const o of [this, ...(this.chunks?.values() || [])]) if (o.greenM?.grass) { o.greenM.grass.color.copy(grassC); for (const m of o.wideM || []) m.color.copy(grassC); o.stripM?.color.copy(grassC); }
    this.landM.color.copy(C('#a3a39f')).lerp(C('#e6eaee'), this.snowK * 0.6);
    this.terrLandM?.color.copy(C('#a3a39f')).lerp(C('#e6eaee'), this.snowK * 0.6);
    // 벌레: 낮엔 나비(봄 · 여름) · 잠자리(가을), 여름밤엔 반딧불
    const day = sunUp > 0.4 && !rainOn && !snowOn, season = this.state.season;
    const bugCol = season === 'autumn' ? '#c8502a' : ['#ffffff', '#ffd23f', '#9fd0ff', '#ff9ec0'];
    this.bugs.forEach((b, i) => {
      const u = b.userData, on = day && season !== 'winter' && Math.abs(this.lat) < 140 && !this.inWater(px + u.ox, pz + u.oz); b.visible = on; if (!on) return;
      u.ph += dt * (season === 'autumn' ? 30 : 14);
      const x = px + u.ox + Math.sin(this.t * 0.3 + i) * 3, z = pz + u.oz + Math.cos(this.t * 0.27 + i * 2) * 3;
      b.position.set(x, u.h + Math.sin(this.t * 1.7 + i) * 0.25, z); b.rotation.y = this.t * 0.5 + i;
      const flap = season === 'autumn' ? Math.sin(u.ph) * 0.25 : 0.25 + Math.sin(u.ph) * 0.95; u.a.rotation.z = flap; u.b.rotation.z = -flap;
      u.m.color.set(season === 'autumn' ? '#c8502a' : '#ffffff');
      if (season === 'autumn') { u.a.scale.set(1.8, 0.35, 1); u.b.scale.set(1.8, 0.35, 1); } else { u.a.scale.set(1, 1, 1); u.b.scale.set(1, 1, 1); }
      
    });
    const petalOn = season === 'spring' && !rainOn && !snowOn; this.petalPts.visible = petalOn;
    if (petalOn) { const a = this.petalPts.geometry.attributes.position; this.petals.forEach((q, i) => { q.y -= q.v * dt; if (q.y < 0) { q.y = 6 + Math.random() * 3; q.ox = (Math.random() - 0.5) * 40; q.oz = (Math.random() - 0.5) * 40; } q.ox += Math.sin(this.t * 0.8 + q.ph) * dt * 0.6 + dt * 0.4; a.setXYZ(i, px + q.ox, q.y, pz + q.oz + Math.cos(this.t * 0.6 + q.ph) * 0.5); }); a.needsUpdate = true; }
    const ffOn = season === 'summer' && night > 0.7 && !rainOn; this.fireflies.material.opacity = lerp(this.fireflies.material.opacity, ffOn ? 1 : 0, Math.min(1, dt));
    if (this.fireflies.material.opacity > 0.01) { const a = this.fireflies.geometry.attributes.position; this.ff.forEach((f, i) => a.setXYZ(i, px + f.ox + Math.sin(this.t * 0.4 + f.ph) * 2, f.h + Math.sin(this.t * 1.3 + f.ph) * 0.4, pz + f.oz + Math.cos(this.t * 0.35 + f.ph) * 2)); a.needsUpdate = true; this.fireflies.material.size = 0.25 + Math.abs(Math.sin(this.t * 2)) * 0.2; }
    this.light = { night, sunUp, hour: h };
  }
  // 카메라: 0 뒤에서 · 1 강 쪽에서 옆으로 · 2 높이서 (드론)
  tickCamera(dt, camera, bx, bz, fx, fz) {
    const k = 1 - Math.exp(-dt * ((this.dragT || 0) > 0 && (this.opt.cam || 0) === 0 ? 14 : 3)), mode = this.opt.cam || 0, tb = this.terrAt(bx, bz), y = this.y + tb;
    let cx, cy, cz, lx, ly, lz;
    if (mode === 0) { const pt = this.camPitch ?? 0.3, d = (this.ride || this.inShop || this.inDeck || this.inMall?.I?.near ? 3.2 : 4.8) * (pt < 0 ? 1 + pt * 0.6 : 1), hd = Math.cos(pt) * d; cx = bx - fx * hd; cy = Math.max(0.35, 0.55 + Math.sin(pt) * d) + y; cz = bz - fz * hd; lx = bx + fx * 1.0; ly = 0.55 + y + (pt < 0 ? -pt * 7 : 0); lz = bz + fz * 1.0;
      // 벽 타기: 벽에서 6m 떨어져 살짝 아래에서 곰과 벽을 올려다본다
      // 마우스로 돌릴 수 있게: 시점 방향 그대로 따라가되, 벽 안쪽으로는 못 들어가게 벽 바깥 반쪽으로만
      if (this.climb) { const C = this.climb; let dx = -fx, dz = -fz; const dot = dx * C.nx + dz * C.nz; if (dot < 0.3) { dx += C.nx * (0.3 - dot); dz += C.nz * (0.3 - dot); const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; } const D = 6 * Math.cos(pt), up = 0.6 + Math.sin(pt) * 6; cx = bx + dx * D; cz = bz + dz * D; cy = y + up; lx = bx; ly = y + 1.2; lz = bz; } }
    else if (mode === 1) { const p = this.at(this.s); cx = bx - p.rx * 5 + p.dx * 1.5; cy = 1.0 + y; cz = bz - p.rz * 5 + p.dz * 1.5; lx = bx; ly = 0.6 + y; lz = bz; }
    else { cx = bx - fx * 26; cy = 22 + tb; cz = bz - fz * 26; lx = bx + fx * 30; ly = tb; lz = bz + fz * 30; }
    if (!this.camInit) { camera.position.set(cx, cy, cz); this.camInit = true; }
    const ky = this.climb || Math.abs(cy - camera.position.y) > 3 ? 1 - Math.exp(-dt * 12) : k; camera.position.x += (cx - camera.position.x) * k; camera.position.y += (cy - camera.position.y) * ky; // 높이: 벽 타기나 크게 벌어졌을 땐 빨리 따라간다 (작은 점프는 부드럽게)
    camera.position.z += (cz - camera.position.z) * k; camera.position.y = Math.max(0.3 + (tb ? Math.max(tb, this.terrAt(camera.position.x, camera.position.z)) : 0), camera.position.y); { const dg = this.deckAt(camera.position.x, camera.position.z, this.y + 0.5); if (dg > 0.5 && this.y >= dg - 0.3) camera.position.y = Math.max(camera.position.y, dg + tb + 0.6); } // 다리 위에 있을 땐 카메라가 다리 밑으로 안 내려간다
    if (this.inside) camera.position.y = Math.min(camera.position.y, (this.ride ? 2.2 : 4.1) + (this.ride ? 0 : this.y > 3 ? (this.inside.S.LV || 0) : 0));
    if (this.inShop) camera.position.y = Math.min(camera.position.y, 3.1);
    // 실내가 알려 주는 천장 높이 (롯데월드타워 층마다)
    { const ce = this.inMall?.I?.ceil; if (ce != null) camera.position.y = Math.min(camera.position.y, ce - 0.25); }
    // 안에서는 카메라가 벽 밖으로 나가지 않게 (벽은 안쪽만 그려져서, 밖에 나가면 어두운 빈 곳만 보인다)
    { const B = this.interiorBox?.(); if (B) { const [x0, x1, z0, z1] = B, m = 0.35; camera.position.x = clamp(camera.position.x, x0 + m, x1 - m); camera.position.z = clamp(camera.position.z, z0 + m, z1 - m); } }
    if (this.inDeck) { const D = this.deckInfo; camera.position.y = Math.min(Math.max(camera.position.y, D.DY + tb + 0.6), D.DY + tb + 3.1); const dx = camera.position.x - D.cx, dz = camera.position.z - D.cz, dd = Math.hypot(dx, dz); if (dd > D.DR - 0.6) { camera.position.x = D.cx + dx / dd * (D.DR - 0.6); camera.position.z = D.cz + dz / dd * (D.DR - 0.6); } if (dd < 4.9) { camera.position.x = D.cx + dx / (dd || 1) * 4.9; camera.position.z = D.cz + dz / (dd || 1) * 4.9; } }
    this.look ||= new THREE.Vector3(lx, ly, lz); this.look.x += (lx - this.look.x) * k; this.look.y += (ly - this.look.y) * ky; this.look.z += (lz - this.look.z) * k;
    camera.lookAt(this.look);
    const fov = 56 + clamp(this.v - 6, 0, 18) * 0.8; if (Math.abs(camera.fov - fov) > 0.05 || camera.far < 20000) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.far = 24000; camera.updateProjectionMatrix(); }
  }
  // 이름표: 건물 가까이 처음 오면 건물에 빨간 동그라미 + 선 + 이름 (5초 뒤 사라짐)
  setupLabels() {
    const M = this.map, S = M.scale, best = new Map();
    // 서울 전체: 주인 지도에는 건물이 없다. 칸마다 만든 목록을 모은다
    if (M.kind === 'world') { this.labels = [...this.chunks.values()].flatMap((c) => { if (!c.labels) c.setupLabels(); return c.labels; }); return; }
    const tile = M.kind === 'tile';
    for (const b of M.buildings) {
      if (b[4] < 0) continue; const name = M.names[b[4]]; if (!name || /^\d|^[A-Z]?\d|동$|주차|창고|화장실|관리|^[가-힣]?\d/.test(name) || name.length < 2) continue;
      const ring = unpack(b.slice(7), S); let x = 0, z = 0; for (const [a, c] of ring) { x += a; z += c; } x /= ring.length; z /= ring.length;
      const famous = /국회|63|IFC|파크원|트윈|타워|센터|호텔|공원|역|교회|성당|방송|KBS|MBC|SBS|증권|금융|빌딩|아파트|레지던스|회관|우체국/.test(name);
      if (b[0] < 30 && !famous && !(tile && /궁|문$|박물관|미술관|극장|대학|학교|시장|병원|백화점|도서관|청사|구청|시청|문화|사찰|서원/.test(name))) continue;
      if (!tile && Math.abs(this.project0(x, z).lat) > 650) continue;
      const old = best.get(name); if (!old || old.h < b[0]) best.set(name, { name, x, z, h: b[0] });
    }
    for (const [n, x, z, h] of M.labels || []) best.set(n, { name: n, x: x * S, z: z * S, h });
    this.labels = [...best.values()];
  }
  // 카메라 → 이름표 자리 사이를 다른 건물이 가리는지 (외곽선 · 높이로 확인, 4m 간격)
  occluded(cam, l) {
    const ax = cam.x, ay = cam.y, az = cam.z, bx = l.x, by = l.y, bz = l.z, L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 4);
    // 이름표의 건물 자신(이름 없는 부분 포함)은 가림에서 뺀다
    const own = new Set((this.footGrid?.get(`${Math.floor(bx / 40)},${Math.floor(bz / 40)}`) || []).filter((fi) => { const f = this.foot[fi]; return bx >= f.x0 - 3 && bx <= f.x1 + 3 && bz >= f.z0 - 3 && bz <= f.z1 + 3 && (inRing(bx, bz, f.ring) || Math.hypot((f.x0 + f.x1) / 2 - bx, (f.z0 + f.z1) / 2 - bz) < 25); }));
    for (let i = 1; i < n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
      // 외곽선 높이보다 훨씬 높은 명소(성 첨탑 · 자유낙하 탑 등)는 따로 둥근 가림막으로 (명소 모듈이 labelOcc 에 넣는다)
      for (const o of this.labelOcc || []) if (!o.off?.() && y < o.top && Math.hypot(x - o.x, z - o.z) < o.r) return true;
      const cell = this.footGrid?.get(`${Math.floor(x / 40)},${Math.floor(z / 40)}`); if (!cell) continue;
      for (const fi of cell) { const f = this.foot[fi]; if (own.has(fi) || f.name === l.name || x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue; const top = f.h + (this.chunks ? f.base ?? this.terrAt(x, z, true) : 0); if (top < y) continue; if (inRing(x, z, f.ring)) return true; }
    }
    return false;
  }
  project0(x, z) { let best = Infinity, bs = 0, bl = 0; for (let i = 0; i < this.rp.length - 1; i += 2) { const a = this.rp[i], d = (a[0] - x) ** 2 + (a[1] - z) ** 2; if (d < best) { best = d; bs = i * this.step; } } const p = this.at(bs); bl = (x - p.x) * p.rx + (z - p.z) * p.rz; return { s: bs, lat: bl }; }
  tickLabels(dt, camera, px, pz) {
    // 버스 · 지하철을 타고 있는 동안은 건물 이름표를 띄우지 않는다 (창밖을 가린다), 내리면 다시
    if (this.rideL?.on) { this.activeLabels = []; return; }
    { const lk = this.chunks ? [...this.chunks.keys()].join() : ''; if (!this.labels || lk !== this.labKey) { this.labKey = lk; this.setupLabels(); } }
    // 바라보는 건물에 이름표: 화면 가운데 쪽에 들어온 건물 (높을수록 멀리서도) · 시선을 돌리면 서서히 사라지고 다시 보면 또 뜬다
    this.activeLabels ||= []; this.labT = (this.labT || 0) - dt;
    for (const l of this.activeLabels) { l.t += dt; l.seen = Math.max(0, (l.seen ?? 1) - dt); }
    this.activeLabels = this.activeLabels.filter((l) => l.seen > 0 || l.t < 0.4);
    if (this.labT <= 0) {
      this.labT = 0.25; const v = this.labV ||= new THREE.Vector3(), picks = [];
      for (const l of this.labels) {
        const d = Math.hypot(l.x - px, l.z - pz), range = Math.min(1300, 160 + l.h * 3.2 + (this.flying ? Math.min(400, this.y * 1.5) : 0)); if (d > range) continue;
        // 서울 전체는 땅 높이가 있다: 이름표 자리에 그곳 땅 높이를 더한다
        const ty = Math.min(l.h * 0.62, 90) + (this.chunks ? this.terrAt(l.x, l.z, true) : 0); v.set(l.x, ty, l.z).project(camera); if (v.z > 1 || Math.abs(v.x) > 0.95 || v.y < -0.85 || v.y > 0.95) continue;
        // 명소 안(예: 롯데월드 섬 위)에서는 먼 이름표를 띄우지 않는다 (명소 풍경 위로 뒤쪽 아파트 이름이 겹쳤다)
        if (this.labelSkip?.(l, d)) continue;
        if (this.occluded(camera.position, { x: l.x, y: ty, z: l.z, name: l.name })) continue;
        picks.push({ l, score: Math.abs(v.x) + d / range * 0.4 });
      }
      picks.sort((a, b) => a.score - b.score);
      // 지금 보이는(가려지지 않은) 이름 있는 건물은 모두 (너무 많으면 가까운 8개)
      const shown = new Set(picks.slice(0, 8).map((q) => q.l.name));
      for (const a of this.activeLabels) if (!shown.has(a.name)) a.seen = Math.min(a.seen, 0.5);
      for (const { l } of picks.slice(0, 8)) { const a = this.activeLabels.find((q) => q.name === l.name); if (a) a.seen = 1.0; else this.activeLabels.push({ ...l, t: 0, seen: 1.0, y: Math.min(l.h * 0.62, 90) + (this.chunks ? this.terrAt(l.x, l.z, true) : 0) }); }
    }
    // 구역: 이정표(다리 등) 근처 → 이름 있는 공원 · 섬 (작은 곳 먼저)
    let name = null; for (const [n, ms] of this.map.marks || []) if (Math.abs(ms - this.s) < 30) { name = n; break; }
    if (this.chunks && this.areasKey !== this.chunks.size + ':' + [...this.chunks.keys()].join()) { this.areasKey = this.chunks.size + ':' + [...this.chunks.keys()].join(); this.areas = [...this.chunks.values()].flatMap((c) => (c.map.areas || []).map(([n, ...f]) => ({ n, ring: unpack(f, c.map.scale) }))).map((a) => ({ ...a, A: Math.abs(ringArea(a.ring)) })).sort((a, b) => a.A - b.A); }
    if (!name) { this.areas ||= (this.map.areas || []).map(([n, ...f]) => ({ n, ring: unpack(f, this.map.scale) })).map((a) => ({ ...a, A: Math.abs(ringArea(a.ring)) })).sort((a, b) => a.A - b.A); for (const a of this.areas) if (inRing(px, pz, a.ring)) { name = a.n; break; } }
    if (name && name !== this.regionName) { const last = this.regionSeen.get(name) || -1e9; if (this.time - last > 90) this.onRegion?.(name); this.regionSeen.set(name, this.time); }
    // 서울 전체: 그 구역에서 250m 넘게 벗어나면 이름을 지운다 (예전엔 한 번 정해지면 계속 남아 '용산구 · 여의도한강공원' 처럼 보였다)
    if (name) this.regionAt = [px, pz]; else if (this.chunks && this.regionName) { this.regionAt ||= [px, pz]; if (Math.hypot(px - this.regionAt[0], pz - this.regionAt[1]) > 250) { this.regionName = null; this.regionAt = null; } }
    this.regionName = name || this.regionName;
  }
  // 미니맵: 지도 전체를 한 번 그려 두고, 내 주변만 잘라 보여 준다 (북쪽이 위)
  minimapImage() {
    // 서울 전체: 지금 칸 둘레(불러온 칸들)를 그린다. 칸이 바뀌면 다시
    const W = this.chunks, wkey = W ? `${this.tileNow}|${[...W.keys()].sort().join()}` : '';
    if (this.mini && (!W || this.miniKey === wkey)) return this.mini;
    const T0 = this.world0?.tile || 2000, ox = W && this.tileNow ? (this.tileNow[0] + 0.5) * T0 : 0, oz = W && this.tileNow ? (this.tileNow[1] + 0.5) * T0 : 0, R = W ? T0 * 1.5 : 2600;
    this.miniKey = wkey; this.miniO = [ox, oz, R];
    const N = W ? 1536 : 1024, k = N / (2 * R), cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), S = this.map.scale;
    const T = (x, z) => [(x - ox + R) * k, (z - oz + R) * k], fillP = (poly, col) => { g.fillStyle = col; g.beginPath(); for (const ring of poly) { ring.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); } g.fill('evenodd'); };
    const line = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); };
    g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, N, N);
    if (W) { for (const c of W.values()) { const M = c.map, S2 = M.scale; for (const gr of M.green) fillP(gr.slice(1).map((r) => unpack(r, S2)), '#bfdba4'); for (const w of c.water || []) fillP(w, '#8fc4ea'); for (const w of c.islands || []) fillP(w, '#a9cf8c'); }
      for (const c of W.values()) { const M = c.map, S2 = M.scale; for (const rd of M.roads) line(unpack(rd.slice(2), S2), '#ffffff', Math.max(1, rd[0] * k)); for (const b of M.bridges) line(unpack(b.p, S2), '#8c8c8c', Math.max(1.5, b.w * k)); for (const b of M.buildings) fillP([unpack(b.slice(7), S2)], b[0] > 60 ? '#a9a39a' : '#cfc8bd'); }
      return (this.mini = cv); }
    for (const gr of this.map.green) fillP(gr.slice(1).map((r) => unpack(r, S)), '#bfdba4');
    for (const w of this.water) fillP(w, '#8fc4ea'); for (const w of this.islands) fillP(w, '#a9cf8c');
    for (const rd of this.map.roads) line(unpack(rd.slice(2), S), '#ffffff', Math.max(1, rd[0] * k));
    for (const b of this.map.bridges) line(unpack(b.p, S), '#8c8c8c', Math.max(1.5, b.w * k));
    for (const b of this.map.buildings) fillP([unpack(b.slice(7), S)], b[0] > 60 ? '#a9a39a' : '#cfc8bd');
    line(this.rp, '#ff4d6d', 3);
    return (this.mini = cv);
  }
  drawMinimap(ctx, size, span = 700) {
    const img = this.minimapImage(), N = img.width, [ox, oz, R] = this.miniO || [0, 0, 2600], k = N / (2 * R), cx = (this.px - ox + R) * k, cz = (this.pz - oz + R) * k, w = span * k;
    ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, 7); ctx.clip();
    // 기본은 북쪽 위 고정(화살표만 돈다). 설정에서 '회전'을 고르면 보는 쪽이 위로 오게 지도 전체를 돌린다
    if (this.opt.miniRot) { ctx.translate(size / 2, size / 2); ctx.rotate(Math.PI + this.camYaw); ctx.translate(-size / 2, -size / 2); }
    ctx.drawImage(img, cx - w / 2, cz - w / 2, w, w, 0, 0, size, size);
    const m = size / span, c = size / 2;
    ctx.fillStyle = 'rgba(30,30,40,.9)'; ctx.font = `bold ${Math.round(size / 15)}px sans-serif`; ctx.textAlign = 'center';
    for (const [n, ms] of this.map.marks || []) { const p = this.at(ms), x = c + (p.x - this.px) * m, y = c + (p.z - this.pz) * m; if (x > 8 && x < size - 8 && y > 8 && y < size - 8) ctx.fillText(n, x, y - 4); }
    // 서울 전체: 지하철역 (첫 호선 색 동그라미 + 이름, 흰 테두리 글씨)
    if (this.chunks) { ctx.save(); ctx.font = `bold ${Math.round(size / 17)}px sans-serif`; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round'; for (const st of this.stations || []) { const x = c + (st.x - this.px) * m, y = c + (st.z - this.pz) * m; if (x < 12 || x > size - 12 || y < 16 || y > size - 12) continue; const rr = Math.max(3, size / 42); ctx.fillStyle = LINE_COLOR[st.lines[0]] || '#7a7f8a'; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(st.name, x, y - rr - 1); ctx.fillStyle = '#1f2a3a'; ctx.fillText(st.name, x, y - rr - 1); } ctx.restore(); }
    for (const p of this.people) { const [x0, z0] = this.world(p.s, p.lat), x = c + (x0 - this.px) * m, y = c + (z0 - this.pz) * m; ctx.fillStyle = p.kind.startsWith('runner') ? '#ffffff' : '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
    this.attr?.drawMini(ctx, size, m, c);
    this.live?.drawMini(ctx, c, m, this.px, this.pz, size);
    // 동서남북 (지도와 같이 돈다): N 빨강 크게, E S W 작게
    { ctx.save(); ctx.font = `bold ${Math.round(size / 13)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText('N', c, size * 0.08); ctx.fillStyle = '#d0283c'; ctx.fillText('N', c, size * 0.08);
      ctx.font = `bold ${Math.round(size / 19)}px sans-serif`; ctx.lineWidth = 3; for (const [t, x, y] of [['E', size * 0.93, c], ['S', c, size * 0.93], ['W', size * 0.07, c]]) { ctx.strokeText(t, x, y); ctx.fillStyle = '#4a5266'; ctx.fillText(t, x, y); } ctx.restore(); }
    // 보는 쪽 부채꼴 · 나
    ctx.translate(c, c); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(0, 0); const ya = Math.atan2(Math.cos(this.camYaw), Math.sin(this.camYaw)); ctx.arc(0, 0, size * 0.32, ya - 0.5, ya + 0.5); ctx.closePath(); ctx.fill();
    ctx.rotate(-this.face + Math.PI); ctx.fillStyle = '#ff2d55'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 가까운 큰길 이름 (아래쪽 띠, 지도가 돌아도 그대로)
    const rn = this.inside || this.inShop || this.inMall || this.ride ? '' : this.nearRoadName(); if (rn) { ctx.save(); ctx.font = `bold ${Math.round(size / 15)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const w = ctx.measureText(rn).width + size * 0.08, y = size * 0.8; ctx.fillStyle = 'rgba(30,35,50,.72)'; ctx.beginPath(); ctx.roundRect?.(c - w / 2, y - size * 0.05, w, size * 0.1, size * 0.05); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(rn, c, y); ctx.restore(); }
  }
  // 곰 가까이(길 가장자리에서 25m 안) 이름 있는 길 중 가장 넓은 · 가까운 것 (1초마다)
  nearRoadName() {
    const now = performance.now(); if (this.rnAt && now - this.rnAt < 1000) return this.rnVal || ''; this.rnAt = now; let best = null;
    const maps = this.chunks ? [...this.chunks.values()].filter((c) => { const T0 = this.world0.tile, [i, j] = c.chunkKey.split('_').map(Number); return Math.abs((i + 0.5) * T0 - this.px) < T0 && Math.abs((j + 0.5) * T0 - this.pz) < T0; }).map((c) => c.map) : [this.map];
    for (const M of maps) { const S = M.scale; (M.roads || []).forEach((rd, ri) => { const nm = M.roadNames?.[ri]; if (!nm) return; for (let i = 4; i < rd.length; i += 2) { const ax = rd[i - 2] * S, az = rd[i - 1] * S, bx = rd[i] * S, bz = rd[i + 1] * S; if (Math.abs(ax - this.px) > 300 && Math.abs(bx - this.px) > 300) continue; const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = clamp(((this.px - ax) * dx + (this.pz - az) * dz) / L2, 0, 1), d = Math.hypot(ax + dx * t - this.px, az + dz * t - this.pz) - rd[0] / 2; if (d > 25) continue; const sc = d - rd[0] * 0.8; if (!best || sc < best.sc) best = { sc, nm }; } }); }
    return (this.rnVal = best ? best.nm : '');
  }
  // 큰 지도: 코스 둘레를 보여 주고, 누른 곳 → 코스 안 가장 가까운 자리
  mapBounds() { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of this.rp) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } const pad = 260, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.max(x1 - x0, z1 - z0) / 2 + pad; return { cx, cz, half }; }
  drawBigMap(ctx, size, pick) {
    const img = this.minimapImage(), N = img.width, R = 2600, k = N / (2 * R), B = this.mapBounds(), sx = (B.cx - B.half + R) * k, sz = (B.cz - B.half + R) * k, w = B.half * 2 * k, m = size / (B.half * 2);
    const T = (x, z) => [(x - (B.cx - B.half)) * m, (z - (B.cz - B.half)) * m];
    ctx.clearRect(0, 0, size, size); ctx.drawImage(img, sx, sz, w, w, 0, 0, size, size);
    ctx.font = `bold ${Math.round(size / 34)}px sans-serif`; ctx.textAlign = 'center';
    for (const [n, ms] of this.map.marks || []) { const p = this.at(ms), [x, y] = T(p.x, p.z); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x - ctx.measureText(n).width / 2 - 5, y - 26, ctx.measureText(n).width + 10, 20); ctx.fillStyle = '#1a1a2a'; ctx.fillText(n, x, y - 11); ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    if (this.px != null) { const [x, y] = T(this.px, this.pz); ctx.fillStyle = '#2f80ed'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.stroke(); }
    if (pick) { const [x, y] = T(pick.x, pick.z); ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke(); ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  }
  // 큰 지도에서 누른 곳 (0~1) → 코스 안 자리
  pickAt(u, v) {
    const B = this.mapBounds(), x = B.cx - B.half + u * B.half * 2, z = B.cz - B.half + v * B.half * 2;
    let best = Infinity, bi = 0; for (let i = 0; i < this.rp.length; i++) { const d = (this.rp[i][0] - x) ** 2 + (this.rp[i][1] - z) ** 2; if (d < best) { best = d; bi = i; } }
    const s = clamp(bi * this.step, 4, this.L - 4), p = this.at(s); let lat = clamp((x - p.x) * p.rx + (z - p.z) * p.rz, LAT_MIN, LAT_MAX);
    let [wx, wz] = this.world(s, lat); for (let t = 0; t < 12 && this.inWater(wx, wz); t++) { lat += 2; [wx, wz] = this.world(s, lat); }
    return { s, lat, x: wx, z: wz };
  }
  // 순간 이동: 그 자리에서 다시 시작 (주변 사람들은 새로)
  teleport(s, lat) {
    this.flying = false; this.y = 0; this.vy = 0;
    this.s = clamp(s, 4, this.L - 4); this.lat = clamp(lat, LAT_MIN, LAT_MAX); [this.px, this.pz] = this.world(this.s, this.lat); this.ri = Math.round(this.s / this.step);
    const p = this.at(this.s); this.face = Math.atan2(p.dx, p.dz); this.camYaw = this.face; this.camInit = false; this.v = 0; this.mdx = null; this.spawnFix = 8;
    for (const q of this.people) this.removePerson(q); this.people = []; for (const gd of this.groups) this.removeGroup(gd); this.groups = []; this.regionName = null;
  }
  // 지금 위치 설명: 다음 이정표까지
  where() {
    if (this.drive?.on) return this.drive.where();
    if (this.ride) return `${this.ride.line}${String(this.ride.line).length === 1 ? '호선' : '선'} 열차 안 · 다음 ${this.ride.dest.name}`;
    if (this.inside) return `${this.inside.st.name}역 안`;
    if (this.inShop) return `${SHOP_KIND[this.inShop.F.kind].emoji} ${this.inShop.F.name}`;
    if (this.inMall) return `🛍️ ${this.inMall.D.name}`;
    if (this.inDeck) return '🗼 N서울타워 전망대 · 140m';
    if (this.attr?.exp) return this.attr.where();
    if (this.rideL?.on) return this.rideL.where();
    if (this.chunks) { const gu = this.guAt(this.px, this.pz); return [gu, this.regionName].filter(Boolean).join(' · ') || '서울'; }
    const marks = this.map.marks || [], s = this.s, d = this.dir;
    const next = d > 0 ? marks.find(([, ms]) => ms > s + 5) : [...marks].reverse().find(([, ms]) => ms < s - 5);
    return next ? `${next[0]}까지 ${Math.round(Math.abs(next[1] - s))}m` : d > 0 ? `반환점까지 ${Math.round(this.L - s)}m` : `반환점까지 ${Math.round(s)}m`;
  }
}

// ---------- 곰돌이 소품 ----------
// 가만히 있는 물체 묶기: 같은 재질끼리 하나로 합쳐 그리기 호출을 줄인다 (원래 물체는 뺀다, 묶음은 장면에 바로)
function batchStatic(scene, roots, out = null) {
  const byMat = new Map(); for (const r of roots) { r.updateMatrixWorld(true); r.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return; (byMat.has(o.material) ? byMat.get(o.material) : byMat.set(o.material, []).get(o.material)).push(o); }); }
  for (const [m, list] of byMat) { if (list.length < 2) continue; const P = [], N = [], U = []; for (const o of list) { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); g.applyMatrix4(o.matrixWorld); const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0); U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); } o.parent?.remove(o); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeBoundingSphere(); const me = new THREE.Mesh(g, m); scene.add(me); out?.push(me); }
  if (out) for (const r of roots) r.traverse((o) => { if (o.isMesh && o.parent) out.push(o); });
}
// 도성 문 모양: 바닥 외곽선의 긴 축 방향으로 돌 축대 · 홍예(어두운 문 굴) · 붉은 문루 2층 · 단청 띠 · 짙은 기와 겹처마
function buildStadium(ring, S) {
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
  const sc = (k) => ring.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]), n = ring.length, P = [], C = [], I = [], col = new THREE.Color();
  // 고리 두 개(바깥 a · 안 b)를 높이 ya · yb 로 잇는 띠
  const band = (ka, ya, kb, yb, c) => { const A = sc(ka), B = sc(kb), b0 = P.length / 3; col.set(c); for (const [x, z] of A) { P.push(x, ya, z); C.push(col.r, col.g, col.b); } for (const [x, z] of B) { P.push(x, yb, z); C.push(col.r, col.g, col.b); } for (let i = 0; i < n; i++) { const j = (i + 1) % n; I.push(b0 + i, b0 + j, b0 + n + j, b0 + i, b0 + n + j, b0 + n + i); } };
  const H = S.h;
  band(1, 0, 1, H * 0.72, '#cfd3d8'); band(1.0, H * 0.72, 1.02, H * 0.74, '#9aa3ad');
  band(0.97, H * 0.7, 0.62, 2, '#7f93ad'); band(0.62, 2, 0.6, 0.6, '#d8d4cc');
  band(1.04, H, 0.74, H * 0.86, S.roof); band(1.04, H, 1.04, H * 0.92, '#c9ccd0');
  // 가운데 잔디
  { const F = sc(0.6), b0 = P.length / 3; col.set('#4f9a52'); for (const [x, z] of F) { P.push(x, 0.5, z); C.push(col.r, col.g, col.b); } P.push(cx, 0.5, cz); C.push(col.r, col.g, col.b); for (let i = 0; i < n; i++) I.push(b0 + n, b0 + (i + 1) % n, b0 + i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
  const grp = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  // 월드컵경기장: 지붕을 매단 돛대 16개 (방패연 · 소반 모양 지붕)
  if (S.mast) { const mg = new THREE.CylinderGeometry(0.5, 0.8, 18, 6), mm = new THREE.MeshLambertMaterial({ color: '#e8e8e4' }); const out = sc(1.06); for (let i = 0; i < 16; i++) { const [x, z] = out[Math.floor(i * n / 16)], m = new THREE.Mesh(mg, mm); m.position.set(x, H + 7, z); grp.add(m); } }
  return grp;
}
function buildGate(ring, LM) {
  const G = LM.gate; let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
  let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; } const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang);
  let a = 0, b = 0; for (const [x, z] of ring) { a = Math.max(a, Math.abs((x - cx) * ux + (z - cz) * uz)); b = Math.max(b, Math.abs(-(x - cx) * uz + (z - cz) * ux)); }
  // 흥인지문처럼 옹성(반달 성벽)까지 외곽선에 들어 있으면 문 자체는 더 작게
  if (G.ong) { a *= 0.62; b *= 0.5; } a = Math.min(a, 22); b = Math.min(b, 9); b = Math.max(b, a * 0.38);
  const P = [], N = [], C = [], col = new THREE.Color();
  const add = (g, c) => { const q = g.index ? g.toNonIndexed() : g; q.rotateY(-ang); q.translate(cx, 0, cz); const p = q.attributes.position, n = q.attributes.normal; col.set(c); for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(col.r, col.g, col.b); } };
  const box = (w, h, d, y, c, ox = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(ox, y + h / 2, 0); add(g, c); };
  const roof = (w, d, y, h, top, c) => { const g = new THREE.CylinderGeometry(top, 1, h, 4, 1); g.rotateY(Math.PI / 4); g.scale((w / 2) * Math.SQRT2, 1, (d / 2) * Math.SQRT2); g.translate(0, y + h / 2, 0); add(g, c); };
  const B = G.base || 7, W = a * 2, D = b * 2, STONE = '#bfb7a6', RED = '#8e2f26', DAN = '#3f7a6a', TILE = '#4a4e56';
  box(W, B, D, 0, STONE); box(W * 1.01, 0.5, D * 1.01, B - 0.5, '#a9a191');
  // 나무 문 (대한문처럼 돌 축대 없이 낮은 기단 위 한 층): 붉은 기둥 사이 세 칸 문 + 우진각 지붕 하나
  if (G.wood) { box(W * 0.86, 5.2, D * 0.7, B, RED); for (let k = 0; k < 3; k++) box(W * 0.2, 3.6, D * 0.72, B, '#3a2420', (k - 1) * W * 0.27); box(W * 0.88, 0.5, D * 0.72, B + 4.8, DAN); roof(W * 1.12, D * 1.35, B + 5.2, 3.6, 0.3, TILE); box(W * 0.6, 0.6, 0.8, B + 8.8, '#3a3d44');
    const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g0.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g0.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return new THREE.Mesh(g0, new THREE.MeshLambertMaterial({ vertexColors: true })); }
  const n = G.arches || 1; for (let k = 0; k < n; k++) { const off = (k - (n - 1) / 2) * W * 0.22; box(n > 1 ? 4.2 : 5.2, B * 0.62, D + 0.2, 0, '#2a2420', off); box(n > 1 ? 4.6 : 5.6, 0.6, D + 0.25, B * 0.62, '#9a9282', off); }
  // 1층 문루 + 처마
  box(W * 0.74, 4, D * 0.66, B, RED); box(W * 0.76, 0.5, D * 0.68, B + 3.5, DAN);
  roof(W * 0.96, D * 1.05, B + 4, 2.2, 0.62, TILE);
  // 2층 문루 + 겹처마 지붕
  box(W * 0.58, 3.4, D * 0.5, B + 6.2, RED); box(W * 0.6, 0.45, D * 0.52, B + 9.1, DAN);
  roof(W * 0.92, D * 1.0, B + 9.6, 4.2, 0.22, TILE); box(W * 0.46, 0.7, 0.9, B + 13.6, '#3a3d44');
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
// 삼각형을 땅 위 칸(size m)으로 나눈다: { P, N?, C?/Cl?, U?, Y?, I, cx, cz } 목록 (멀리 있는 칸을 통째로 숨기려고)
// 칸 만들기 중에는 8ms 마다 쉬어 가며 나눈다 (큰 덩어리 하나 나누기가 80ms 넘게 걸렸다, 8-23)
function* splitCellsGen(G, size) {
  const cells = new Map(), P = G.P, keys = Object.keys(G).filter((k) => Array.isArray(G[k]) && k !== 'I' && G[k].length && G[k].length % (P.length / 3) === 0);
  let t0 = performance.now();
  for (let t = 0; t < G.I.length; t += 3) {
    if ((t % 6000) === 0 && performance.now() - t0 > 8) { yield; t0 = performance.now(); } const a = G.I[t], x = (P[a * 3] + P[G.I[t + 1] * 3] + P[G.I[t + 2] * 3]) / 3, z = (P[a * 3 + 2] + P[G.I[t + 1] * 3 + 2] + P[G.I[t + 2] * 3 + 2]) / 3, k = `${Math.floor(x / size)},${Math.floor(z / size)}`;
    let c = cells.get(k); if (!c) { c = { map: new Map(), I: [], cx: (Math.floor(x / size) + 0.5) * size, cz: (Math.floor(z / size) + 0.5) * size }; for (const kk of keys) c[kk] = []; cells.set(k, c); }
    for (let q = 0; q < 3; q++) { const v = G.I[t + q]; let nv = c.map.get(v); if (nv === undefined) { nv = c.P.length / 3; c.map.set(v, nv); for (const kk of keys) { const w = G[kk].length / (P.length / 3); for (let e = 0; e < w; e++) c[kk].push(G[kk][v * w + e]); } } c.I.push(nv); } }
  return [...cells.values()];
}
function mergeGeos(list) {
  const P = [], N = [], I = []; let base = 0;
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); I.push(base + i); } base += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I); return g;
}
// 털색: 갈색 · 흰색 · 검정만이 아니라 여러 색 젤리곰
const FUR = ['#f4efe6', '#2a2a30', '#8a5634', '#b07a4a', '#d9d4cc', '#c98b5a', '#6b4a2f', '#e8c49a', '#9c9c9c', '#ffd9e6', '#cde7ff', '#d8f5c8', '#fff1b8', '#e0c8ff', '#ff9f9f', '#7fd3c0', '#ff4d5e', '#ff9a2e', '#ffd93b', '#7be04a', '#ff7eb6', '#b57bff', '#4fc3ff', '#f3f6ff'];
const TOPS_CASUAL = ['#ffffff', '#1f2a44', '#e8dcc4', '#8a8f98', '#6b7a4a', '#f2b8c6', '#9fc8ee', '#2a2a2a', '#d9a441', '#b23a48', '#4a7c59', '#c9b8e8'];
const TOPS_SPORT = ['#c8ff3a', '#ff5a1f', '#ff2d87', '#18d6ff', '#111111', '#ffffff', '#2f6bff', '#ffd200', '#7c3aed'];
const BOTTOMS_CASUAL = ['#4a6a9a', '#2a3550', '#1d1d1f', '#c8b48a', '#8a8f98', '#e8e2d6', '#6b5a48'];
const BOTTOMS_SPORT = ['#111111', '#1f2a44', '#2a2a2a', '#3a3f4a'];
const SHOES = ['#ffffff', '#ff5a1f', '#18d6ff', '#111111', '#c8ff3a', '#ff2d87', '#e8e2d6'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const wpick = (r, w) => { let t = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; } return w.length - 1; };
const TOON = new Map(); const mat = (c) => { if (!TOON.has(c)) TOON.set(c, new THREE.MeshLambertMaterial({ color: c })); return TOON.get(c); };
// 공 껍질 일부(위 theta0 ~ theta1)를 몸 · 다리 · 팔에 입힌다
function shell(parent, c, pos, rad, t0, t1) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, t0 * Math.PI, (t1 - t0) * Math.PI), mat(c)); m.material.side = THREE.DoubleSide; m.position.set(...pos); m.scale.set(...rad); parent.add(m); return m; }
// 옷 입히기: role = runner · stroll(사복) · office(셔츠) · grandma · kid · couple 은 stroll + 같은 윗옷
function dress(b, role, r, env = {}) {
  const torso = b.torso, head = b.head, legs = b.legs || [], arms = (b.arms || []).slice(0, 2); if (!torso || !head) return;
  const season = env.season || 'spring', wet = env.weather === 'rain', cold = season === 'winter', hot = season === 'summer';
  const sportKit = role === 'runner' && r() < 0.7;
  let top = env.top || (sportKit ? pick(r, TOPS_SPORT) : pick(r, TOPS_CASUAL)), bottom = sportKit ? pick(r, BOTTOMS_SPORT) : pick(r, BOTTOMS_CASUAL);
  let topKind = 'tee', sleeve = hot ? 'short' : 'long', bottomKind = 'pants', hat = null;
  if (role === 'runner') { topKind = sportKit ? (hot ? (r() < 0.5 ? 'tank' : 'tee') : cold ? 'jacket' : 'tee') : (r() < 0.5 ? 'hoodie' : 'tee'); sleeve = topKind === 'tank' ? 'none' : hot || (!cold && r() < 0.5) ? 'short' : 'long'; bottomKind = sportKit && !cold && r() < 0.7 ? 'shorts' : 'pants'; hat = sportKit ? (r() < 0.4 ? 'band' : r() < 0.5 ? 'cap' : null) : r() < 0.3 ? 'cap' : null; if (cold) hat = r() < 0.6 ? 'beanie' : hat; if (wet) { topKind = 'jacket'; hat = 'cap'; } }
  else if (role === 'office') { top = pick(r, ['#ffffff', '#dfe8f5', '#f2efe6', '#e8f0f8']); topKind = cold ? 'coat' : 'shirt'; if (cold) top = pick(r, ['#2a2a2a', '#5a4a3a', '#3a4458']); sleeve = 'long'; bottom = pick(r, ['#1d1d1f', '#2a3550', '#3a3a3a', '#5a5a60']); }
  else if (role === 'suit') { top = pick(r, ['#1f2433', '#2a2a2e', '#3a3f4a', '#1d2a44', '#4a4a50']); topKind = cold ? 'coat' : 'jacket'; sleeve = 'long'; bottom = top; }
  else if (role === 'grandma') { top = pick(r, ['#a86a8a', '#7a8a6a', '#c9a27a', '#8a6aa8', '#b85a5a']); topKind = cold ? 'padding' : 'cardigan'; sleeve = 'long'; bottomKind = r() < 0.5 ? 'skirt' : 'pants'; bottom = pick(r, ['#4a3a4a', '#6b5a48', '#2a3550']); hat = cold ? 'beanie' : hot ? 'sunhat' : 'bucket'; }
  else if (role === 'street') { top = pick(r, ['#111111', '#f4f4f0', '#ff4d9a', '#c8ff3a', '#2f6bff', '#ff8a1f', '#8a5cff']); topKind = 'hoodie'; sleeve = 'long'; bottom = pick(r, ['#1d1d1f', '#3a4a6a', '#6b6b6b', '#c9b48a']); hat = r() < 0.45 ? 'bucket' : r() < 0.6 ? 'cap' : null; }
  else if (role === 'cosplay') { top = pick(r, ['#ff4d9a', '#7b5cff', '#29d0c8', '#ffd23f', '#ff3b30', '#ffffff', '#1d1d1f']); topKind = r() < 0.5 ? 'coat' : 'tee'; sleeve = 'long'; bottomKind = r() < 0.55 ? 'skirt' : 'pants'; bottom = pick(r, ['#1d1d1f', '#2a2f5a', '#ff4d9a', '#ffffff', '#5a1d3a']); hat = pick(r, ['ears', 'wig', 'witch', 'wig']); }
  else if (role === 'busker') { top = pick(r, ['#1d1d1f', '#3a4a6a', '#7a1d22', '#e8e2d6']); topKind = r() < 0.5 ? 'jacket' : 'shirt'; sleeve = 'long'; bottom = pick(r, ['#1d1d1f', '#3a4a6a']); hat = r() < 0.4 ? 'beanie' : null; }
  else if (role === 'kid') { top = pick(r, ['#ffd23f', '#ff6b6b', '#4fa3ff', '#7be07b', '#ff9ec0', '#ffffff']); topKind = cold ? 'padding' : 'tee'; bottomKind = hot ? 'shorts' : 'pants'; bottom = pick(r, ['#4a6a9a', '#2a3550', '#e85a5a']); hat = cold ? 'beanie' : r() < 0.6 ? 'cap' : null; }
  else { topKind = cold ? (r() < 0.6 ? 'padding' : 'coat') : hot ? 'tee' : pick(r, ['tee', 'hoodie', 'cardigan', 'shirt']); sleeve = hot ? 'short' : 'long'; bottomKind = hot && r() < 0.4 ? 'shorts' : r() < 0.2 ? 'skirt' : 'pants'; hat = cold ? (r() < 0.5 ? 'beanie' : null) : hot && r() < 0.35 ? (r() < 0.5 ? 'cap' : 'sunhat') : r() < 0.15 ? 'bucket' : null; if (cold) top = env.top || pick(r, ['#1d1d1f', '#3a4458', '#e8e2d6', '#6b2a35', '#2f4a3a', '#c9a27a']); }
  // 윗옷
  const body = [0, 1.02, 0], R = [0.585, 0.69, 0.495];
  const span = { tank: [0.34, 0.8], tee: [0.3, 0.8], shirt: [0.28, 0.8], hoodie: [0.24, 0.84], cardigan: [0.28, 0.86], jacket: [0.24, 0.84], coat: [0.24, 0.96], padding: [0.2, 0.9] }[topKind];
  const puff = topKind === 'padding' ? 1.09 : topKind === 'coat' ? 1.04 : 1;
  shell(torso, top, body, R.map((v) => v * puff), span[0], span[1]);
  if (topKind === 'shirt' || role === 'office' || role === 'suit') { const col = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 16), mat('#ffffff')); col.rotation.x = Math.PI / 2; col.position.set(0, 1.56, 0.05); torso.add(col); }
  if (role === 'suit') { const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.5), mat('#f4f6fa')); shirt.position.set(0, 1.3, 0.5); torso.add(shirt); const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.02), mat(pick(r, ['#7a1d22', '#1d3a7a', '#2a2a2a', '#5a3a7a', '#1d5a4a']))); tie.position.set(0, 1.28, 0.515); torso.add(tie); if (r() < 0.45) { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.1), mat('#1d1410')); bag.position.set(0.12, -0.55, 0); (arms[1] || torso).add(bag); } }
  if (topKind === 'cardigan' || topKind === 'coat') { const z = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.02), mat('#2a2a2a')); z.position.set(0, 1.1, 0.5 * puff); torso.add(z); }
  if (topKind === 'padding') for (let k = 0; k < 3; k++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 6, 20), mat(shadeHex(top, 0.8))); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.82, 1); band.position.y = 0.82 + k * 0.22; torso.add(band); }
  if (topKind === 'hoodie') { shell(torso, top, [0, 1.55, -0.28], [0.42, 0.32, 0.22], 0, 0.55); }
  if (sleeve !== 'none') for (const a of arms) shell(a, top, [0, -0.2, 0], [0.17 * puff, 0.29, 0.17 * puff], 0, sleeve === 'short' ? 0.42 : 0.88);
  // 아랫옷 · 신발
  if (bottomKind === 'skirt') { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.62, 0.42, 16, 1, true), mat(bottom)); sk.material.side = THREE.DoubleSide; sk.position.y = 0.58; torso.add(sk); }
  else { shell(torso, bottom, body, R.map((v) => v * 1.01), 0.78, 0.97); for (const l of legs) shell(l, bottom, [0, -0.3, 0.02], [0.225, 0.35, 0.225], 0, bottomKind === 'shorts' ? 0.42 : 0.86); }
  const shoe = role === 'runner' || role === 'kid' ? pick(r, SHOES) : role === 'office' ? '#1d1410' : pick(r, ['#ffffff', '#1d1d1f', '#8a6a4a', '#e8e2d6']);
  for (const l of legs) { const s2 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(shoe)); s2.scale.set(0.215, 0.1, 0.26); s2.position.set(0, -0.6, 0.08); l.add(s2); }
  // 모자 · 소품
  if (hat === 'band') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.06, 6, 18), mat(pick(r, ['#ffffff', '#ff3b6b', '#111111', '#2fd3ff', '#c8ff3a']))); band.rotation.x = Math.PI / 2; band.position.y = 0.2; head.add(band); }
  if (hat === 'cap' || hat === 'bucket' || hat === 'beanie' || hat === 'sunhat') {
    const hc = hat === 'beanie' ? pick(r, ['#b23a48', '#1f2a44', '#e8dcc4', '#4a7c59', '#ff9a2e']) : hat === 'sunhat' ? '#e8d4a8' : pick(r, ['#ffffff', '#111111', '#1f2a44', '#e8dcc4', '#ff5a1f', '#6b7a4a']);
    shell(head, hc, [0, 0.12, 0], [0.5, 0.5, 0.5], 0, 0.42);
    if (hat === 'cap') { const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12, 1, false, -Math.PI / 2, Math.PI), mat(hc)); brim.position.set(0, 0.32, 0.38); head.add(brim); }
    if (hat === 'bucket' || hat === 'sunhat') { const br = new THREE.Mesh(new THREE.CylinderGeometry(hat === 'sunhat' ? 0.78 : 0.6, hat === 'sunhat' ? 0.78 : 0.6, 0.03, 20), mat(hc)); br.position.y = 0.3; head.add(br); }
    if (hat === 'beanie') { const pom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat('#ffffff')); pom.position.y = 0.66; head.add(pom); }
  }
  // 홍대 코스프레: 고양이 귀 · 큰 가발 · 마녀 모자 + 망토 · 소품(지팡이 · 검)
  if (hat === 'ears') { const ec = pick(r, ['#1d1d1f', '#ffffff', '#ff9ec0', '#f2b33a']); for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), mat(ec)); ear.position.set(sx * 0.26, 0.6, 0.02); ear.rotation.z = -sx * 0.25; head.add(ear); } }
  if (hat === 'wig') { const wc = pick(r, ['#ff6fb5', '#7fd6ff', '#b58cff', '#fff1a8', '#ff5a3c', '#e8e8f0']); shell(head, wc, [0, 0.05, -0.05], [0.56, 0.58, 0.56], 0, 0.62); const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.9, 10), mat(wc)); tail.position.set(0, -0.15, -0.42); tail.rotation.x = 0.3; head.add(tail); }
  if (hat === 'witch') { const hc = pick(r, ['#2a1d3a', '#1d1d1f', '#5a1d3a']); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 16), mat(hc)); cone.position.y = 0.78; cone.rotation.z = 0.15; head.add(cone); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.03, 20), mat(hc)); br.position.y = 0.36; head.add(br); }
  if (role === 'cosplay') { const cape = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.25), mat(pick(r, ['#b3122a', '#1d1d1f', '#2a2f8a', '#f4f4f0', '#5a1d7a']))); cape.material.side = THREE.DoubleSide; cape.position.set(0, 1.0, -0.56); cape.rotation.x = 0.12; torso.add(cape); if (arms[1] && r() < 0.6) { const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), mat(r() < 0.5 ? '#e8e8f0' : '#c9a24a')); prop.position.set(0, -0.6, 0.25); prop.rotation.x = 1.2; arms[1].add(prop); const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshLambertMaterial({ color: '#ffe36b', emissive: '#ffd23f', emissiveIntensity: 0.6 })); tip.position.set(0, 0.45, 0); prop.add(tip); } }
  if (role === 'busker') { const gt = new THREE.Group(), bodyM = mat(pick(r, ['#b5733d', '#7a3b1e', '#1d1d1f', '#e8d4a8'])); const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), bodyM); b1.scale.set(1, 1.15, 0.35); gt.add(b1); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), mat('#1d1d1f')); hole.position.z = 0.11; gt.add(hole); const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.05), mat('#3a2416')); neck.position.set(0, 0.6, 0); gt.add(neck); gt.position.set(0.05, 0.95, 0.62); gt.rotation.z = 0.9; torso.add(gt); }
  if (cold && r() < 0.6 && role !== 'runner') { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.09, 8, 18), mat(pick(r, ['#b23a48', '#e8dcc4', '#2f4a3a', '#ffd23f']))); sc.rotation.x = Math.PI / 2; sc.position.y = 1.62; torso.add(sc); }
  if (role === 'runner' && r() < 0.5) for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat('#ffffff')); e.position.set(sx * 0.48, 0.02, 0.05); head.add(e); }
  if ((role === 'stroll' || role === 'office') && r() < 0.35) { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.18), mat(pick(r, ['#1d1d1f', '#8a6a4a', '#e8e2d6', '#4a6a9a']))); bag.position.set(0, 1.05, -0.55); torso.add(bag); }
  if (wet && role !== 'runner') { const u = new THREE.Group(), uc = pick(r, ['#ff4d6d', '#2f6bff', '#ffd23f', '#1d1d1f', '#7be07b', '#ffffff']); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), mat('#3a3a3a')); pole.position.y = 0.85; const can = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.45, 10, 1, true), mat(uc)); can.material.side = THREE.DoubleSide; can.position.y = 1.75; u.add(pole, can); u.position.set(0.45, 0.85, 0.1); b.root.children[0]?.add?.(u) ?? b.root.add(u); }
}
// 차: 승용차 · 택시 · 시내버스 (몸체 · 유리 · 바퀴 · 앞뒤 불빛)
// 랜드마크: 실제 사진을 참고해 이름별로 모습을 정한다 (외벽 · 색 · 덧붙이는 구조물). 조사한 건물부터 하나씩 늘린다
//   여의도순복음교회: 둥글게 휜 짙은 외벽 + 세로 패널 조명 · 지붕 테두리 조명 · 정면 사각 탑(전광판 · 간판) 위 흰 십자가 · 둘레 교육관들은 갈색 석재 건물
//   IFC 세 동: 청록빛 유리 · 꼭대기를 비스듬히 자른 유리 왕관 (밤엔 모서리 불빛) · Three IFC 가 가장 높다
//   전경련회관(FKI 타워): 짙은 회녹색 유리 · 비스듬히 깎인 꼭대기
//   LG트윈타워: 금빛 브론즈 유리 두 동 · 계단식 모서리(지도 데이터) · 꼭대기 LG 로고
//   KBS 본관: 넓고 낮은 베이지 · 갈색 콘크리트
const GATE_SN = { facade: 'hanok', gate: { base: 7, tiers: 2 } };
const NO_LM = {};
export const LANDMARKS = {
  //   63빌딩: 금빛 반사 유리 · 넓은 면이 위로 갈수록 좁아지는 사다리꼴 옆모습 · 꼭대기 왕관(63스퀘어)도 그만큼 작게
  '63빌딩': { facade: 'gold', color: '#f0bf5c', taper: { long: 0.6, short: 0.92, minH: 150 } },
  '63스퀘어': { facade: 'gold', color: '#f0bf5c', scale: { long: 0.6, short: 0.92 } },
  'One IFC': { facade: 'glass', color: '#9cc8de', crown: { rise: 16, dir: [1, 0.3] }, rimLight: true },
  'Two IFC': { facade: 'glass', color: '#a6d0e2', crown: { rise: 14, dir: [-1, 0.2] }, rimLight: true },
  'Three IFC': { facade: 'glass', color: '#92c0da', crown: { rise: 22, dir: [0.4, 1] }, rimLight: true },
  //   IFC몰 남문 · 북문: 지하 몰로 내려가는 낮은 유리 상자 (지도 높이 284m · 175m 는 옆 타워 값이 잘못 붙은 것)
  'IFC mall (South Gate)': { facade: 'glass', color: '#b9d3e0', height: 9 }, 'IFC mall (North Gate)': { facade: 'glass', color: '#b9d3e0', height: 9 },
  전경련회관: { facade: 'glass', color: '#9bb0aa', crown: { rise: 18, dir: [0, -1] }, rimLight: true },
  LG트윈타워: { facade: 'gold', color: '#d9b27c', topSign: { text: 'LG', color: '#c4003a', bg: '#ffffff' } },
  'KBS 본관': { facade: 'stone', color: '#bfae92' },
  //   전경련 컨퍼런스센터: 은색 금속 달걀 / 성모병원: 크림색 석조 · 민트 지붕 / 메리어트파크센터: 흰 석조 세로 프레임 / 오투타워 · 신한금융투자: 짙은 유리
  '전경련회관 컨퍼런스센터': { facade: 'glass', color: '#cfd6dc', egg: true },
  //   뚝섬 자벌레: 기둥 위에 길게 뜬 은색 튜브(마디 고리 · 옆 유리 띠 · 밤엔 아래 LED)
  자벌레: { facade: 'glass', color: '#d5dbe0', jbug: true },
  '카톨릭대학교 여의도성모병원': { facade: 'stone', color: '#ece6da', roof: '#6db894' },
  여의도메리어트파크센터: { facade: 'stone', color: '#f0ece4', crown: { rise: 6, dir: [1, 0] } },
  오투타워: { facade: 'glass', color: '#8fa6b8' },
  신한금융투자타워: { facade: 'glass', color: '#8d9aa6', roof: '#6db894' },
  KB금융타워: { facade: 'glass', color: '#9fb2c0' },
  'The-K타워': { facade: 'glass', color: '#a9c2d4' },
  한화손해보험빌딩: { facade: 'glass', color: '#b8c6cf' },
  KRX한국거래소서울사무소: { facade: 'stone', color: '#e4e0d6' },
  '천주교 여의도성당': { facade: 'church', color: '#c98f6a', roof: '#7a4a3a' },
  //   국회도서관: 흰 석조 · 청록 동판 지붕 / 국회의원회관: 흰 석조 · 청록 지붕
  국회도서관: { facade: 'assembly', color: '#f1ede4', roof: '#4f8f7c' },
  국회의원회관: { facade: 'assembly', color: '#ece8de', roof: '#5a9482' },
  //   더현대 서울: 낮고 넓은 유리 · 회색 몸체, 지붕은 초록 정원과 유리 천창 격자, 긴 두 변에 붉은 아치 트러스
  '더현대 서울': { facade: 'glass', color: '#b9c3c8', roof: '#6f8a6a', skylight: true, arches: { n: 6, color: '#c8382a' } },
  // 홍대: 메세나폴리스 · 세아타워 · CGV 아트레온 · 홍익대 문헌관 · 홍문관
  '메세나폴리스 101동': { facade: 'glass', color: '#c9d8e2', crown: { rise: 8, dir: [1, 0] } },
  세아타워: { facade: 'glass', color: '#6f8494', roof: '#4a5560' },
  'CGV 아트레온(CGV Artreon)': { facade: 'glass', color: '#b9c3c8', topSign: { text: 'CGV', color: '#e8102c', bg: '#ffffff' } },
  //   홍문관: 정문 위를 가로지르는 연회색 화강석 건물, 위층은 푸른 띠창 (사진 확인)
  문헌관: { facade: 'brick', color: '#9a4a36' }, 홍문관: { facade: 'street2', color: '#d6d3cc' },
  // 이태원: 제일기획 · 용산구청
  제일기획: { facade: 'glass', color: '#5f6b74' }, 용산구청: { facade: 'stone', color: '#e8e2d6' },
  // 강남역: 교보타워 (짙은 붉은 벽돌빛 두 탑, 가운데 세로 유리 틈)
  교보타워: { facade: 'stone', color: '#7a4234' }, '교보생명보험(주) 서초사옥': { facade: 'stone', color: '#7a4234' },
  // 반포: 신세계백화점 강남 · JW 메리어트 · 서울성모병원 · 서울법원종합청사
  신세계백화점: { facade: 'stone', color: '#e8dcc8', topSign: { text: 'SSG', color: '#e8102c', bg: '#ffffff' } }, 'JW 메리어트 호텔 서울': { facade: 'glass', color: '#b5c2c8' },
  '가톨릭대학교 서울성모병원': { facade: 'glass', color: '#d2e2e6', roof: '#6db894' }, 서울법원종합청사: { facade: 'stone', color: '#d9d2c4' },
  // 뚝섬 · 건대 · 청담: 테크노마트 · 롯데백화점 · 갤러리아 명품관(유리 원판 외벽 · 밤 테두리 빛) · 서울숲 세 동
  테크노마트: { facade: 'glass', color: '#7f93a3', crown: { rise: 12, dir: [0, 1] } }, 롯데백화점: { facade: 'stone', color: '#ece4d4', topSign: { text: 'LOTTE', color: '#e8102c', bg: '#ffffff' } },
  '갤러리아백화점 이스트': { facade: 'panels', color: '#dfe6ea', rimLight: true }, '갤러리아백화점 웨스트': { facade: 'panels', color: '#dfe6ea', rimLight: true },
  이스트윙: { facade: 'glass', color: '#c8d6de' }, 웨스트윙: { facade: 'glass', color: '#c8d6de' }, 사우스윙: { facade: 'glass', color: '#c8d6de' },
  // 잠실: 롯데월드타워(위로 갈수록 가늘어지는 흰 유리 붓 모양 · 꼭대기 갈라진 왕관) · 롯데호텔월드 · 롯데백화점
  롯데월드타워: { facade: 'glass', color: '#e3e9ec', taper: { long: 0.3, short: 0.3, H: 555 } },
  롯데호텔월드: { facade: 'stone', color: '#e6dccb', topSign: { text: 'LOTTE', color: '#e8102c', bg: '#ffffff' } },
  // 명동: 명동대성당(붉은 벽돌 고딕 · 뾰족 종탑) · 신세계 본점 헤리티지(옛 석조) · 한국은행 화폐박물관(석조 · 돔) · 롯데시티호텔
  '명동대성당 본당': { facade: 'church', color: '#9a4a36', spire: { h: 45, color: '#7a3a2c' } },
  '신세계백화점 본점 더 헤리티지': { facade: 'stone', color: '#e8dcc0' }, '한국은행 화폐박물관': { facade: 'assembly', color: '#e0d2b8' },
  //   롯데호텔 서울 본관 · 신관: 베이지 타일 · 고른 네모 창 (유리 탑이 아니다) / 부영빌딩(옛 삼성화재, 을지로 입구): 구릿빛 반사 유리
  롯데호텔서울: { facade: 'stone', color: '#d8c8ac' }, 롯데호텔: { facade: 'stone', color: '#cdb89a' },
  //   세종문화회관: 흰 돌 기둥 · 전통 지붕선 / 정부서울청사: 베이지 석재 네모 창 / 서울파이낸스센터: 밝은 갈색 화강석 격자 창 / 서울중앙우체국(포스트타워): 은빛 유리 두 탑
  '세종문화회관 대극장': { facade: 'assembly', color: '#ebe5d8' }, 정부서울청사: { facade: 'stone', color: '#d8d2c4' }, 서울파이낸스센터: { facade: 'stone', color: '#cdbfa6' }, 서울중앙우체국: { facade: 'glass', color: '#b7c4cc' },
  롯데시티호텔: { facade: 'glass', color: '#a9b8c2', topSign: { text: 'LOTTE', color: '#e8102c', bg: '#ffffff' } },
  // 종로 · 북촌: 경복궁 · 건춘문 · 조계사 (한옥, 큰 기와지붕)
  // 도성 문 (돌 축대 위 2층 문루 · 실제 높이 약 20m): 축대 색 돌 + 기와 우진각 지붕
  숭례문: GATE_SN, '숭례문(남대문)': GATE_SN, 흥인지문: { facade: 'hanok', gate: { base: 6, tiers: 2, ong: true } }, 광화문: { facade: 'hanok', gate: { base: 8, tiers: 2, arches: 3 } },
  // 서울시청 새 청사 (유리 파도) · DDP (은빛 알루미늄 패널) · 국립중앙박물관 (긴 화강석 건물)
  // 경기장: 바깥 벽 + 비스듬한 관중석 + 흰 지붕 고리 + 가운데 잔디 (상자로 막지 않게)
  월드컵주경기장: { facade: 'panels', stadium: { h: 32, roof: '#f4f4f0', mast: true } }, 목동주경기장: { facade: 'stone', stadium: { h: 18, roof: '#e8e4dc' } }, '올림픽 주경기장': { facade: 'stone', stadium: { h: 30, roof: '#ece8e0' } }, 잠실야구장: { facade: 'stone', stadium: { h: 22, roof: '#d8d4cc' } }, 목동야구장: { facade: 'stone', stadium: { h: 16, roof: '#d8d4cc' } },
  // 예술의전당 오페라하우스(김석철, 1993): 둥근 몸통 위에 갓을 얹은 모양의 지붕 — 넓고 낮게 휜 챙 + 가운데 둥근 갓 머리. 밝은 돌 외벽, 지붕은 짙은 회색
  //   '오페라하우스' 이름 아파트 · 빌라가 서울에 10곳 넘어 위치(서초동 예술의전당)로만
  오페라하우스: { at: [2998, 5609, 160], facade: 'stone', color: '#d9cfbd', height: 24, gat: { colH: 7, out: 9, rise: 6, crown: 13, crownH: 9, c: '#3a3d42', brim: '#d4d8db', stone: '#ddd3c2' } },
  '예술의전당 음악당': { facade: 'stone', color: '#e6dfd2' },
  // 코엑스(삼성동 무역센터): 길고 낮은 은회색 금속판 · 유리 띠 전시장 (지도 높이 10.9m 는 층수 없는 기본값, 실제 4층 남짓)
  코엑스: { at: [7041, 2016, 400], facade: 'panels', color: '#c3cad0', height: 22, roof: '#8d959b', rimLight: true },
  // 서울식물원 온실(식물문화센터): 지름 100m · 높이 최대 25m, 가장자리가 높고 가운데가 낮은 오목한 접시 지붕, 투명 유리 외벽 · 흰 철골 격자
  식물문화센터: { at: [-12800, -4355, 150], facade: 'glass', color: '#d6e8ec', dish: { rim: 25, mid: 15 } },
  // 올림픽공원 세계평화의문(김중업, 1988): 높이 24m, 62 × 37m 날개 지붕이 기둥 위에 떠 있고 지붕 밑엔 사신도(청룡 · 백호 · 주작 · 현무, 백금남)
  '올림픽공원 세계평화의문': { at: [11953, 1293, 200], facade: 'stone', color: '#cfc8bc', peaceGate: { L: 62, W: 37, top: 24 } },
  고척스카이돔: { facade: 'panels', color: '#d8dadc', height: 34, domeTop: { r: 92, h: 30, c: '#eceef0' } },
  대한문: { facade: 'hanok', gate: { base: 1.2, tiers: 1, arches: 3, wood: true } },
  // 옛 서울역 (문화역서울284): 붉은 벽돌 + 화강석 띠 + 가운데 초록 돔 · 덕수궁 석조전 (흰 돌 신고전) · 지금 서울역 (유리)
  문화역서울284: { facade: 'brick', color: '#a8573e', height: 15, domeTop: { r: 7, h: 9, c: '#4f8a76' } }, 석조전: { facade: 'stone', color: '#ece6d8', height: 17 }, '서울역(철도역)': { facade: 'glass', color: '#9fb6c8', height: 24 },
  서울특별시청: { facade: 'glass', color: '#a9c8dc', height: 52 }, 동대문디자인플라자: { facade: 'panels', color: '#c9ccd0', height: 29 }, 국립중앙박물관: { facade: 'stone', color: '#d9d2c4', height: 26 },
  경복궁: { at: [-250, -5600, 1200], facade: 'hanok', color: '#e8dccb', height: 9, roofH: 7 }, '경복궁 건춘문': { facade: 'hanok', color: '#e8dccb', height: 9, roofH: 5 }, 조계사: { facade: 'hanok', color: '#e8dccb', roofH: 7 },
  여의도순복음교회: { facade: 'panels', color: '#5d4f48', campus: 160, campusFacade: 'stone', campusColor: '#a08a7a', front: { w: 16, d: 9, up: 13, face: 'west', screen: true, cross: true, sign: '여의도순복음교회' }, rimLight: true },
};
// 역 · 호선 (서울 지하철 노선 색)
const LINE_COLOR = { 1: '#0052A4', 2: '#00A84D', 3: '#EF7C1C', 4: '#00A5DE', 5: '#996CAC', 6: '#CD7C2F', 7: '#747F00', 8: '#E6186C', 9: '#BDB092', 경의중앙: '#77C4A3', 공항: '#0090D2', 신림: '#6789CA', 신분당: '#D4003B', 수인분당: '#F5A200' };
const STATION_LINES = { 여의나루: [5], 여의도: [5, 9], 국회의사당: [9], 샛강: [9, '신림'], 노들: [9], 노량진: [1, 9], 대방: [1, '신림'], 영등포: [1], 신길: [1, 5], 영등포시장: [5], 마포: [5], 공덕: [5, 6, '경의중앙', '공항'], 효창공원앞: [6, '경의중앙'], 대흥: [6], 광흥창: [6], 상수: [6], 합정: [2, 6], 홍대입구: [2, '공항', '경의중앙'], 망원: [6], 서강대: ['경의중앙'], 신촌: [2], 가좌: ['경의중앙'], 디지털미디어시티: [6, '경의중앙', '공항'], 녹사평: [6], 이태원: [6], 한강진: [6], 삼각지: [4, 6], 버티고개: [6], 강남: [2, '신분당'], 신논현: [9, '신분당'], 역삼: [2], 잠실: [2, 8], 석촌: [8, 9], 송파나루: [9], 명동: [4], 을지로입구: [2], 회현: [4], 안국: [3], 종각: [1], 종로3가: [1, 3, 5], 신촌: [2], 이대: [2], 서울숲: ['수인분당'], 성수: [2], 뚝섬: [2] };
// 출구 지붕 앞 띠: 왼쪽 노란 네모에 출구 번호, 호선 색 동그라미, 역 이름
const exitTexCache = new Map();
function exitBandTex(name, lines, ref) {
  const key = `b:${name}:${ref}`; if (exitTexCache.has(key)) return exitTexCache.get(key);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 80; const g = cv.getContext('2d');
  g.fillStyle = '#2b3039'; g.fillRect(0, 0, 512, 80); g.fillStyle = '#f6c400'; g.fillRect(8, 8, 64, 64); g.fillStyle = '#111'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(ref || '').slice(0, 3), 40, 43);
  lines.forEach((l, i) => { g.fillStyle = LINE_COLOR[l] || '#888'; g.beginPath(); g.arc(104 + i * 44, 40, 18, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `bold ${String(l).length > 1 ? 12 : 22}px sans-serif`; g.fillText(String(l).slice(0, 2), 104 + i * 44, 41); });
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = 'bold 34px sans-serif'; g.fillText(name, 92 + lines.length * 44, 42);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; exitTexCache.set(key, t); return t;
}
// 출구 안내 기둥: 위에 출구 번호(노란 네모), 호선 색 띠, 역 이름(한글 · 영문)
function exitTotemTex(name, lines, ref) {
  const key = `t:${name}:${ref}`; if (exitTexCache.has(key)) return exitTexCache.get(key);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512; const g = cv.getContext('2d');
  g.fillStyle = '#2b3039'; g.fillRect(0, 0, 128, 512); g.fillStyle = '#f6c400'; g.fillRect(14, 14, 100, 100); g.fillStyle = '#111'; g.font = 'bold 70px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(ref || '').slice(0, 3), 64, 68);
  g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText('출구', 64, 134); g.font = '12px sans-serif'; g.fillText('Exit', 64, 152);
  lines.forEach((l, i) => { g.fillStyle = LINE_COLOR[l] || '#888'; g.fillRect(14, 176 + i * 34, 100, 26); g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.fillText(`${l}${String(l).length === 1 ? '호선' : ''}`, 64, 190 + i * 34); });
  g.save(); g.translate(64, 400); g.rotate(Math.PI / 2); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.fillText(name, 0, -12); g.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; exitTexCache.set(key, t); return t;
}
function stationSignTex(name, lines, ref) {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 100; const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(2, 2, 316, 96, 14); g.fill();
  lines.forEach((l, i) => { g.fillStyle = LINE_COLOR[l] || '#888'; g.beginPath(); g.arc(34 + i * 46, 50, 19, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `bold ${String(l).length > 1 ? 13 : 22}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(l).slice(0, 2), 34 + i * 46, 51); });
  g.fillStyle = '#1d1d1f'; g.font = 'bold 30px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(name, 22 + lines.length * 46, 44);
  if (ref) { g.font = 'bold 18px sans-serif'; g.fillStyle = '#555'; g.fillText(`${ref}번 출구`, 22 + lines.length * 46, 76); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 1호선 전동차 10량: 은색 몸체 · 파랑 · 빨강 띠 · 창 띠
// 호선별 바깥 열차 (1호선: 파랑 + 빨강 띠, 나머지: 그 호선 색 띠)
const OUT_TRAIN = { 1: ['#d9dde2', '#1d4fa8', '#d8352a'], 2: ['#dfe3e6', '#00A84D', '#00A84D'], 3: ['#dfe3e6', '#EF7C1C', '#EF7C1C'], 4: ['#dfe3e6', '#00A5DE', '#00A5DE'], 5: ['#d6dade', '#996CAC', '#996CAC'], 6: ['#d6dade', '#CD7C2F', '#CD7C2F'], 7: ['#dfe3e6', '#747F00', '#747F00'], 9: ['#e3e1da', '#BDB092', '#8a6d3b'] };
function makeTrain(line = '1') {
  const [bc, c1, c2] = OUT_TRAIN[line] || OUT_TRAIN[1], g = new THREE.Group(), body = new THREE.MeshLambertMaterial({ color: bc }), win = new THREE.MeshLambertMaterial({ color: '#2a3442', emissive: '#ffe8b0', emissiveIntensity: 0.2 }), blue = new THREE.MeshLambertMaterial({ color: c1 }), red = new THREE.MeshLambertMaterial({ color: c2 });
  for (let i = 0; i < 10; i++) { const car = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.4, 19.4), body); b.position.y = 1.9; car.add(b); const w = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.9, 17.6), win); w.position.y = 2.5; car.add(w); const s1 = new THREE.Mesh(new THREE.BoxGeometry(3.13, 0.18, 19.4), blue); s1.position.y = 1.7; car.add(s1); const s2 = new THREE.Mesh(new THREE.BoxGeometry(3.13, 0.1, 19.4), red); s2.position.y = 1.5; car.add(s2); g.add(car); }
  return g;
}
// 외곽선의 긴 축: 가운데 · 방향(ux, uz) · 긴 축 / 짧은 축 반 길이
function ringAxes(ring) {
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
  let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
  const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang); let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const [x, z] of ring) { const a = (x - cx) * ux + (z - cz) * uz, b = -(x - cx) * uz + (z - cz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  return { cx: cx + ux * (a0 + a1) / 2 - uz * (b0 + b1) / 2, cz: cz + uz * (a0 + a1) / 2 + ux * (b0 + b1) / 2, ux, uz, ang, A: (a1 - a0) / 2, B: (b1 - b0) / 2 };
}
// 예술의전당 오페라하우스 (위키미디어 공용 사진 Seoul_Arts_Center_20 · Korea-Seoul.Arts.Center-02 를 보고):
//   둥근 베이지 돌 몸통 위에 기둥이 둘러선 유리 띠(열주랑) → 그 위로 넓고 얇게 바깥으로 휘어 나온 밝은 회색 금속 챙(갓 챙, 몸통보다 9m 넘게 나옴, 끝이 살짝 처짐, 밑면은 짙은 회색)
//   → 가운데 짙은 회색 둥근 갓 머리. 앞(북쪽 광장 쪽)엔 아래층 유리 정면과 넓은 돌계단
function buildGatRoof(hg, ring, h, G) {
  const ax = ringAxes(ring), x = ax.cx, z = ax.cz; let R0 = 0; for (const [px, pz] of ring) R0 += Math.hypot(px - x, pz - z); R0 = Math.max(20, R0 / ring.length);
  const g = new THREE.Group(); g.position.set(x, 0, z); hg.scene.add(g);
  const CH = G.colH, BR = R0 + G.out;
  // 열주랑: 안쪽 유리 띠(밤엔 따뜻한 불빛) + 베이지 돌기둥 28개 + 위아래 돌 띠
  const glassM = new THREE.MeshPhongMaterial({ color: '#4d5a66', specular: '#c8d8e8', shininess: 80, emissive: '#ffd9a0', emissiveIntensity: 0, side: THREE.DoubleSide });
  const gl = new THREE.Mesh(new THREE.CylinderGeometry(R0 - 2.2, R0 - 2.2, CH, 72, 1, true), glassM); gl.position.y = h + CH / 2; g.add(gl); (hg.lmCrowns ||= []).push(glassM);
  const stoneM = new THREE.MeshLambertMaterial({ color: G.stone }), parts = [];
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, c = new THREE.CylinderGeometry(0.75, 0.85, CH, 10); c.translate(Math.cos(a) * (R0 - 0.6), h + CH / 2, Math.sin(a) * (R0 - 0.6)); parts.push(c); }
  { const b = new THREE.CylinderGeometry(R0 + 0.3, R0 + 0.3, 1.1, 72, 1, true); b.translate(0, h + 0.55, 0); parts.push(b); const t = new THREE.CylinderGeometry(R0 + 0.6, R0 + 0.6, 1.0, 72); t.translate(0, h + CH - 0.6, 0); parts.push(t); }
  g.add(new THREE.Mesh(mergeGeos(parts), stoneM));
  // 갓 챙: 얇은 회전체. 윗면은 밝은 회색 금속, 밑면은 짙게 (밑면은 따로 한 겹)
  const y0 = h + CH + 1.0, top = [], bot = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, r = BR - (BR - G.crown * 1.15) * t, y = y0 + 0.4 + G.rise * Math.pow(t, 1.7) - 0.9 * Math.pow(1 - t, 6); top.push(new THREE.Vector2(r, y)); bot.push(new THREE.Vector2(r, y - 0.55 - 0.5 * t)); }
  const brim = new THREE.Mesh(new THREE.LatheGeometry(top, 96), new THREE.MeshPhongMaterial({ color: G.brim, specular: '#ffffff', shininess: 60, side: THREE.DoubleSide })); g.add(brim);
  const under = new THREE.Mesh(new THREE.LatheGeometry(bot, 96), new THREE.MeshLambertMaterial({ color: '#5d6166', side: THREE.DoubleSide })); g.add(under);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(BR, 0.42, 6, 128), new THREE.MeshPhongMaterial({ color: '#d9dcde', shininess: 80 })); edge.rotation.x = Math.PI / 2; edge.position.y = y0 - 0.4; g.add(edge);
  // 챙 위 금속판 이음매 (방사선 64줄)
  const L = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; for (let k = 0; k < 24; k++) { const p = top[k], q = top[k + 1]; L.push(Math.cos(a) * p.x, p.y + 0.05, Math.sin(a) * p.x, Math.cos(a) * q.x, q.y + 0.05, Math.sin(a) * q.x); } }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#8d9296', transparent: true, opacity: 0.6 })));
  // 갓 머리: 짙은 회색 둥근 통 + 둥근 윗면
  const yc = y0 + 0.4 + G.rise, cr = G.crown, prof = []; for (let i = 0; i <= 5; i++) prof.push(new THREE.Vector2(cr - 0.6 * (i / 5) ** 2, yc - 0.3 + G.crownH * 0.7 * (i / 5)));
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.01, (cr - 0.6) * Math.cos(a)), yc - 0.3 + G.crownH * 0.7 + G.crownH * 0.3 * Math.sin(a))); }
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshPhongMaterial({ color: G.c, shininess: 30, specular: '#5a6068' })));
  // 앞 유리 정면 (북쪽 광장 쪽 1 ~ 2층, 몸통에 붙은 굽은 유리) + 넓은 돌계단
  const glassF = new THREE.MeshPhongMaterial({ color: '#3f4c58', specular: '#dfe8f0', shininess: 90, emissive: '#ffe2b0', emissiveIntensity: 0, side: THREE.DoubleSide });
  const fg = new THREE.Mesh(new THREE.CylinderGeometry(R0 + 0.35, R0 + 0.35, 9, 40, 1, true, Math.PI - 0.55, 1.1), glassF); fg.position.y = 4.5; g.add(fg); (hg.lmCrowns ||= []).push(glassF);
  const steps = []; for (let k = 0; k < 10; k++) { const s = new THREE.BoxGeometry(46 - k * 0.6, 0.3 * (k + 1), 1.2); s.translate(0, 0.15 * (k + 1), -(R0 + 13 - k * 1.2)); steps.push(s); }
  const plat = new THREE.BoxGeometry(40, 3, 6); plat.translate(0, 1.5, -(R0 + 2.5)); steps.push(plat);
  g.add(new THREE.Mesh(mergeGeos(steps), new THREE.MeshLambertMaterial({ color: '#cfc8bb' })));
  hg.addFoot({ ring: [[x - 20, z - R0 - 5.5], [x + 20, z - R0 - 5.5], [x + 20, z - R0 + 0.5], [x - 20, z - R0 + 0.5]], h: 3, x0: x - 20, x1: x + 20, z0: z - R0 - 5.5, z1: z - R0 + 0.5, name: '오페라하우스 계단', type: 'stone' });
}
// 서울식물원 온실: 외곽선(꽃잎 모양) 그대로 유리 벽 + 오목한 접시 지붕(가장자리 rim · 가운데 mid), 흰 철골 격자선. 밤엔 안쪽 빛
function buildDishHouse(hg, ring, D) {
  const ax = ringAxes(ring), cx = ax.cx, cz = ax.cz; let dmax = 0; for (const [x, z] of ring) dmax = Math.max(dmax, Math.hypot(x - cx, z - cz));
  const yAt = (x, z) => { const t = Math.min(1, Math.hypot(x - cx, z - cz) / dmax); return D.mid + (D.rim - D.mid) * t * t; };
  // 유리판 그림: 판 2 × 2 칸(한 칸 약 3 × 2.5m), 흰 틀 · 하늘이 비친 위쪽 · 안쪽 초록 그림자. 밤엔 안의 따뜻한 빛과 식물 그림자
  const cvG = document.createElement('canvas'); cvG.width = cvG.height = 128; const gg = cvG.getContext('2d'), gr = gg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#d8eaf0'); gr.addColorStop(0.45, '#a8c8d2'); gr.addColorStop(1, '#7fa6a8'); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
  gg.fillStyle = 'rgba(70,120,80,.35)'; for (let i = 0; i < 14; i++) { gg.beginPath(); gg.arc((i * 37) % 128, 96 + (i * 13) % 32, 10 + (i % 4) * 4, 0, 7); gg.fill(); }
  gg.fillStyle = '#f2f4f4'; gg.fillRect(0, 0, 128, 4); gg.fillRect(0, 62, 128, 4); gg.fillRect(0, 0, 4, 128); gg.fillRect(62, 0, 4, 128);
  const cvE = document.createElement('canvas'); cvE.width = cvE.height = 128; const ge = cvE.getContext('2d'); ge.fillStyle = '#c9b070'; ge.fillRect(0, 0, 128, 128); ge.fillStyle = 'rgba(30,60,30,.7)'; for (let i = 0; i < 14; i++) { ge.beginPath(); ge.arc((i * 37) % 128, 96 + (i * 13) % 32, 10 + (i % 4) * 4, 0, 7); ge.fill(); } ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 4); ge.fillRect(0, 62, 128, 4); ge.fillRect(0, 0, 4, 128); ge.fillRect(62, 0, 4, 128);
  const tG = new THREE.CanvasTexture(cvG), tE = new THREE.CanvasTexture(cvE); for (const t of [tG, tE]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
  const glass = new THREE.MeshPhongMaterial({ map: tG, specular: '#ffffff', shininess: 90, emissive: '#ffffff', emissiveMap: tE, emissiveIntensity: 0, side: THREE.DoubleSide });
  const P = [], I = [], UV = [], N = ring.length; let acc = 0; for (let i = 0; i <= N; i++) { const [x, z] = ring[i % N]; if (i) acc += Math.hypot(x - ring[i - 1][0], z - ring[i - 1][1]); const y = yAt(x, z); P.push(x, 0, z, x, y, z); UV.push(acc / 6, 0, acc / 6, y / 5); if (i < N) I.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3); }
  const wg = geoOf(P, I); wg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); wg.computeVertexNormals(); hg.scene.add(new THREE.Mesh(wg, glass));
  const K = 7, RP = [], RI = []; for (let k = 0; k <= K; k++) { const s = 1 - k / K; for (let i = 0; i < N; i++) { const x = cx + (ring[i][0] - cx) * s, z = cz + (ring[i][1] - cz) * s; RP.push(x, yAt(x, z), z); } }
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) { const j = (i + 1) % N, a = k * N + i, b = k * N + j, c = (k + 1) * N + i, d = (k + 1) * N + j; RI.push(a, b, c, c, b, d); }
  const rg = geoOf(RP, RI); rg.setAttribute('uv', new THREE.Float32BufferAttribute(RP.flatMap((v, k) => (k % 3 === 0 ? [v / 6] : k % 3 === 2 ? [v / 6] : [])), 2)); rg.computeVertexNormals(); hg.scene.add(new THREE.Mesh(rg, glass));
  const L = []; for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) { const j = (i + 1) % N; L.push(RP[(k * N + i) * 3], RP[(k * N + i) * 3 + 1] + 0.08, RP[(k * N + i) * 3 + 2], RP[(k * N + j) * 3], RP[(k * N + j) * 3 + 1] + 0.08, RP[(k * N + j) * 3 + 2]); }
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = (k * N + i) * 3, b = ((k + 1) * N + i) * 3; L.push(RP[a], RP[a + 1] + 0.08, RP[a + 2], RP[b], RP[b + 1] + 0.08, RP[b + 2]); }
  for (let i = 0; i < N; i++) { const [x, z] = ring[i]; L.push(x, 0, z, x, yAt(x, z), z); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(L, 3)); hg.scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#f4f6f6' })));
  (hg.lmCrowns ||= []).push(glass);
}
// 사신도: 지붕 밑 그림 (가운데 태극, 네 귀퉁이에 청룡 · 백호 · 주작 · 현무 — 굽이치는 몸 · 비늘 점 · 구름무늬, 둘레 단청 띠)
function fourSpiritsTex() {
  const W = 1024, H = 612, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), r = rnd(1988);
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H, s = 10 + r() * 22; g.strokeStyle = ['#c9a86a', '#7fa8b8', '#d98a6a'][i % 3]; g.lineWidth = 4; g.beginPath(); g.arc(x, y, s, Math.PI, Math.PI * 2.6); g.stroke(); }
  const beast = (x, y, col, dark, flip) => {
    g.lineCap = 'round'; for (const [w, c] of [[46, dark], [34, col]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const px = x + (t - 0.5) * 360 * flip, py = y + Math.sin(t * Math.PI * 2.4) * 46; if (t) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
    g.fillStyle = 'rgba(255,240,200,.55)'; for (let t = 0.05; t < 1; t += 0.06) { const px = x + (t - 0.5) * 360 * flip, py = y + Math.sin(t * Math.PI * 2.4) * 46; g.beginPath(); g.arc(px, py - 6, 5, 0, 7); g.fill(); }
    const hx = x + 0.55 * 360 * flip, hy = y + Math.sin(1.1 * Math.PI * 2.4) * 46; g.fillStyle = dark; g.beginPath(); g.arc(hx, hy, 30, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(hx, hy, 23, 0, 7); g.fill(); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(hx + 8 * flip, hy - 6, 6, 0, 7); g.fill(); };
  beast(W * 0.26, H * 0.27, '#2f8f7a', '#14514a', 1);
  beast(W * 0.74, H * 0.27, '#f4f1ea', '#8a8a8a', -1);
  beast(W * 0.26, H * 0.75, '#d8402e', '#7a1e18', 1);
  beast(W * 0.74, H * 0.75, '#2b2b34', '#0e0e14', -1);
  g.fillStyle = '#c8302a'; g.beginPath(); g.arc(W / 2, H / 2, 70, 0, Math.PI, true); g.fill(); g.fillStyle = '#1f4fa0'; g.beginPath(); g.arc(W / 2, H / 2, 70, 0, Math.PI); g.fill(); g.beginPath(); g.arc(W / 2 - 35, H / 2, 35, 0, 7); g.fill(); g.fillStyle = '#c8302a'; g.beginPath(); g.arc(W / 2 + 35, H / 2, 35, 0, 7); g.fill();
  for (const [w, c] of [[26, '#2f6f5a'], [14, '#d8402e'], [6, '#f2d27a']]) { g.strokeStyle = c; g.lineWidth = w; g.strokeRect(w / 2, w / 2, W - w, H - w); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 세계평화의문: 긴 축 방향 62 × 37m 지붕(두께 3 ~ 6m, 양 끝이 처마처럼 3m 위로 휨)이 네 기둥 위 18m 에서 24m 까지. 밑면은 사신도, 위 · 옆은 흰 콘크리트
function buildPeaceGate(hg, ring, G) {
  const ax = ringAxes(ring), A = G.L / 2, B = G.W / 2, top = G.top, base = top - 6, nU = 24, nV = 10;
  const lift = (u) => 3.2 * Math.pow(Math.abs(u), 2.2);
  const W2 = (a, b) => [ax.cx + ax.ux * a - ax.uz * b, ax.cz + ax.uz * a + ax.ux * b];
  const under = [], uv = [], ui = [], over = [], oi = [];
  for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) { const u = i / nU * 2 - 1, v = j / nV * 2 - 1, [x, z] = W2(u * A, v * B * (1 - 0.12 * Math.abs(u))); under.push(x, base + lift(u) + 0.6 * (1 - v * v), z); uv.push(i / nU, j / nV); over.push(x, top - 3 + lift(u) + 3 * (1 - 0.25 * u * u) * (1 - 0.3 * v * v), z); }
  for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) { const a = j * (nU + 1) + i, b = a + 1, c = a + nU + 1, d = c + 1; ui.push(a, c, b, b, c, d); oi.push(a, b, c, b, d, c); }
  const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.Float32BufferAttribute(under, 3)); ug.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ug.setIndex(ui); ug.computeVertexNormals();
  const tex = fourSpiritsTex(), um = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0, side: THREE.DoubleSide }); hg.scene.add(new THREE.Mesh(ug, um)); (hg.lmCrowns ||= []).push(um);
  const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(over, 3)); og.setIndex(oi); og.computeVertexNormals();
  const wm = new THREE.MeshLambertMaterial({ color: '#ece8e0', side: THREE.DoubleSide }); hg.scene.add(new THREE.Mesh(og, wm));
  const S = [], SI = [], edge = []; for (let i = 0; i <= nU; i++) edge.push(i); for (let j = 1; j <= nV; j++) edge.push(j * (nU + 1) + nU); for (let i = nU - 1; i >= 0; i--) edge.push(nV * (nU + 1) + i); for (let j = nV - 1; j >= 1; j--) edge.push(j * (nU + 1));
  edge.forEach((k, n) => { S.push(under[k * 3], under[k * 3 + 1], under[k * 3 + 2], over[k * 3], over[k * 3 + 1], over[k * 3 + 2]); const m2 = (n + 1) % edge.length; SI.push(n * 2, m2 * 2, n * 2 + 1, n * 2 + 1, m2 * 2, m2 * 2 + 1); });
  const sg = geoOf(S, SI); sg.computeVertexNormals(); hg.scene.add(new THREE.Mesh(sg, wm));
  const pm = new THREE.MeshLambertMaterial({ color: '#b9b2a6' });
  for (const a of [-0.3, 0.3]) for (const b of [-0.62, 0.62]) { const [x, z] = W2(a * A, b * B), pg = new THREE.CylinderGeometry(1.8, 2.3, base + 0.6, 4, 1); pg.rotateY(Math.PI / 4 - ax.ang); const p = new THREE.Mesh(pg, pm); p.position.set(x, (base + 0.6) / 2, z); hg.scene.add(p);
    const w = 2.6, rr = [W2(a * A - w, b * B - w), W2(a * A + w, b * B - w), W2(a * A + w, b * B + w), W2(a * A - w, b * B + w)], xs = rr.map((q) => q[0]), zs = rr.map((q) => q[1]); hg.addFoot({ ring: rr, h: base, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name: '세계평화의문', type: 'stone', noClimb: true }); }
}
function buildLandmarkExtras(hg, { name, ring, h, L }) {
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
  // 본관 조각들(랜드마크를 감싸는 건물)까지 합쳐서: 테두리 조명은 조각마다 지붕선에, 정면 탑은 전체의 바깥 끝에
  const parts = [{ ring, h }, ...(hg.lmParts?.[name] || [])];
  if (L.rimLight) { const m = new THREE.LineBasicMaterial({ color: '#fff4e0', transparent: true, opacity: 0.3 }); for (const q of parts) { const pts = [...q.ring, q.ring[0]].map(([x, z]) => new THREE.Vector3(x, q.h + 0.2, z)); hg.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); } (hg.lmLights ||= []).push(m); }
  if (L.crown) buildCrown(hg, ring, h, L);
  if (L.spire) { // 뾰족 종탑: 외곽선에서 가운데서 가장 먼 점 쪽 (정면 끝)에 네모 탑 + 뾰족 지붕 + 십자가
    let far = ring[0], fd = 0; for (const p of ring) { const d = Math.hypot(p[0] - cx, p[1] - cz); if (d > fd) { fd = d; far = p; } } const tx = far[0] + (cx - far[0]) * 0.18, tz = far[1] + (cz - far[1]) * 0.18, m = new THREE.MeshLambertMaterial({ color: L.spire.color }), W = 6;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(W, h + 10, W), m); tower.position.set(tx, (h + 10) / 2, tz); hg.scene.add(tower);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(W * 0.72, L.spire.h - h - 10, 4), new THREE.MeshLambertMaterial({ color: '#4a5560' })); cone.rotation.y = Math.PI / 4; cone.position.set(tx, h + 10 + (L.spire.h - h - 10) / 2, tz); hg.scene.add(cone);
    const cm = hg.crossM || new THREE.MeshLambertMaterial({ color: '#f4f1ea' }); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), cm); pole.position.set(tx, L.spire.h + 1.5, tz); const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.4), cm); bar.position.set(tx, L.spire.h + 2, tz); hg.scene.add(pole, bar);
    hg.addFoot({ ring: [[tx - W / 2, tz - W / 2], [tx + W / 2, tz - W / 2], [tx + W / 2, tz + W / 2], [tx - W / 2, tz + W / 2]], h: h + 10, x0: tx - W / 2, x1: tx + W / 2, z0: tz - W / 2, z1: tz + W / 2, name: '', type: 'brick' }); }
  if (L.jbug) buildJBug(hg, ring);
  if (L.gat) buildGatRoof(hg, ring, h, L.gat);
  if (L.dish) buildDishHouse(hg, ring, L.dish);
  if (L.peaceGate) buildPeaceGate(hg, ring, L.peaceGate);
  if (L.egg) { // 은색 타원 지붕: 외곽선의 긴 축 · 짧은 축에 맞춘 반타원체
    const xs = ring.map((q) => q[0]), zs = ring.map((q) => q[1]); let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; } const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang); let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const [x, z] of ring) { const a = (x - cx) * ux + (z - cz) * uz, b = -(x - cx) * uz + (z - cz) * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); } void xs; void zs;
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#cdd4da', shininess: 70, specular: '#8a96a2', emissive: '#bcd2ff', emissiveIntensity: 0 })); e.scale.set((a1 - a0) / 2, Math.max(h, 12), (b1 - b0) / 2); e.rotation.y = -ang; e.position.set(cx + ux * (a0 + a1) / 2 - uz * (b0 + b1) / 2, 0, cz + uz * (a0 + a1) / 2 + ux * (b0 + b1) / 2); hg.scene.add(e); (hg.lmCrowns ||= []).push(e.material);
    // 금속 띠 무늬
    for (let k = 1; k < 6; k++) { const rr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 4, 48), new THREE.MeshLambertMaterial({ color: '#9aa4ae' })); const t = k / 6, rad = Math.cos(t * Math.PI / 2); rr.scale.set(e.scale.x * rad, e.scale.z * rad, 1); rr.rotation.x = Math.PI / 2; rr.rotation.z = ang; rr.position.set(e.position.x, Math.sin(t * Math.PI / 2) * e.scale.y, e.position.z); hg.scene.add(rr); }
  }
  if (L.skylight) { // 지붕: 초록 정원 칸과 유리 천창 띠 (위성사진 모습)
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c2 = cv.getContext('2d'); c2.fillStyle = '#7d8e86'; c2.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 64, y = j * 64; c2.fillStyle = (i + j) % 2 ? '#6f8f62' : '#8a9aa0'; c2.fillRect(x + 6, y + 6, 52, 52); c2.strokeStyle = 'rgba(255,255,255,.35)'; c2.lineWidth = 2; c2.beginPath(); c2.moveTo(x + 6, y + 6); c2.lineTo(x + 58, y + 58); c2.moveTo(x + 58, y + 6); c2.lineTo(x + 6, y + 58); c2.stroke(); c2.fillStyle = 'rgba(210,235,245,.75)'; c2.fillRect(x + 26, y + 26, 12, 12); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]), x0 = Math.min(...xs), z0 = Math.min(...zs), shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x0) / 40, (pos.getZ(i) - z0) / 40);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, emissive: '#fff2d8', emissiveMap: t, emissiveIntensity: 0 })); m.position.y = h + 0.15; hg.scene.add(m); (hg.lmCrowns ||= []).push(m.material);
  }
  if (L.arches) { // 긴 두 변을 따라 붉은 아치 트러스 (벽 바깥으로 살짝)
    const am = new THREE.MeshLambertMaterial({ color: L.arches.color }), sides = ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; return { a, b, L: Math.hypot(b[0] - a[0], b[1] - a[1]) }; }).sort((p, q) => q.L - p.L).slice(0, 2);
    for (const { a, b, L: len } of sides) { const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len; let nx = -uz, nz = ux; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if ((mx + nx - cx) ** 2 + (mz + nz - cz) ** 2 < (mx - cx) ** 2 + (mz - cz) ** 2) { nx = -nx; nz = -nz; }
      const n = L.arches.n, span = len / n; for (let k = 0; k < n; k++) { const s0 = span * k + span * 0.12, s1 = span * (k + 1) - span * 0.12, pts = []; for (let q = 0; q <= 12; q++) { const t = q / 12, sx = s0 + (s1 - s0) * t, y = h * 0.35 + Math.sin(t * Math.PI) * h * 0.75; pts.push(new THREE.Vector3(a[0] + ux * sx + nx * 1.2, y, a[1] + uz * sx + nz * 1.2)); } const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.55, 6), am); hg.scene.add(tube); const tube2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(new THREE.Vector3(0, -1.6, 0)))), 24, 0.35, 6), am); hg.scene.add(tube2); }
    }
  }
  if (L.topSign) { // 꼭대기 로고: 가장 높은 조각의 가장 긴 두 벽에
    const cen = (r2) => { let x = 0, z = 0; for (const p of r2) { x += p[0]; z += p[1]; } return [x / r2.length, z / r2.length]; };
    // 동마다 (60m 넘게 떨어진 무리마다) 가장 높은 조각 하나씩
    const tops = parts.filter((q) => { const [x, z] = cen(q.ring); return !parts.some((o) => o !== q && o.h > q.h && Math.hypot(cen(o.ring)[0] - x, cen(o.ring)[1] - z) < 60); });
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c2 = cv.getContext('2d'); c2.fillStyle = L.topSign.bg; c2.beginPath(); c2.arc(64, 64, 60, 0, 7); c2.fill(); c2.fillStyle = L.topSign.color; c2.font = 'bold 64px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(L.topSign.text, 64, 68); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshLambertMaterial({ map: t, transparent: true, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.3 }); (hg.lmScreens ||= []).push(sm);
    for (const top of tops) { const [tcx, tcz] = cen(top.ring);
    const sides = top.ring.map((a, i) => { const b = top.ring[(i + 1) % top.ring.length]; return { a, b, L: Math.hypot(b[0] - a[0], b[1] - a[1]) }; }).sort((p, q) => q.L - p.L).slice(0, 2);
    for (const { a, b, L: len } of sides) { const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let nx = mx - tcx, nz = mz - tcz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; const sz = Math.min(len * 0.5, 14), m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), sm); m.position.set(mx + nx * 0.3, top.h - sz * 0.75, mz + nz * 0.3); m.rotation.y = Math.atan2(nx, nz); hg.scene.add(m); } }
  }
  const F = L.front; if (!F) return;
  h = Math.max(...parts.map((q) => q.h)); const allPts = parts.flatMap((q) => q.ring); cx = 0; cz = 0; for (const [x, z] of allPts) { cx += x; cz += z; } cx /= allPts.length; cz /= allPts.length;
  // 정면: 서쪽 끝 (국회의사당을 바라본다)
  let ex = allPts[0]; for (const p of allPts) if (F.face === 'west' ? p[0] < ex[0] : p[1] > ex[1]) ex = p;
  const dirx = cx - ex[0], dirz = cz - ex[1], dl = Math.hypot(dirx, dirz) || 1, ux = dirx / dl, uz = dirz / dl, tx = ex[0] - ux * (F.d / 2 - 1), tz = ex[1] - uz * (F.d / 2 - 1), TH = h + F.up, yaw = Math.atan2(-ux, -uz);
  const grp = new THREE.Group(); grp.position.set(tx, 0, tz); grp.rotation.y = yaw; hg.scene.add(grp);
  const body = new THREE.Mesh(new THREE.BoxGeometry(F.w, TH, F.d), new THREE.MeshLambertMaterial({ color: '#3d3533' })); body.position.y = TH / 2; grp.add(body);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(F.w + 0.6, 0.6, F.d + 0.6), new THREE.MeshLambertMaterial({ color: '#e8e2d8' })); frame.position.y = TH; grp.add(frame);
  if (F.screen) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192; const c2 = cv.getContext('2d'); const gr = c2.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#16233f'); gr.addColorStop(1, '#2c4a78'); c2.fillStyle = gr; c2.fillRect(0, 0, 128, 192); const rg = c2.createRadialGradient(64, 70, 4, 64, 70, 70); rg.addColorStop(0, 'rgba(255,226,170,.85)'); rg.addColorStop(1, 'rgba(255,226,170,0)'); c2.fillStyle = rg; c2.fillRect(0, 0, 128, 192); c2.fillStyle = '#fff'; c2.textAlign = 'center'; c2.font = 'bold 15px sans-serif'; c2.fillText('환영합니다', 64, 150); c2.font = '10px sans-serif'; c2.fillStyle = 'rgba(255,255,255,.75)'; c2.fillText('WELCOME', 64, 168); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const scr = new THREE.Mesh(new THREE.PlaneGeometry(F.w * 0.62, TH * 0.42), new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.6 })); scr.position.set(0, TH * 0.48, F.d / 2 + 0.05); grp.add(scr); (hg.lmScreens ||= []).push(scr.material); }
  if (F.sign) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64; const c2 = cv.getContext('2d'); c2.fillStyle = '#1d1a19'; c2.fillRect(0, 0, 512, 64); c2.fillStyle = '#ffffff'; c2.font = 'bold 50px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(F.sign, 256, 34, 490); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(F.w * 0.92, F.w * 0.16), new THREE.MeshLambertMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.4 })); sg.position.set(0, TH * 0.85, F.d / 2 + 0.06); grp.add(sg); (hg.lmScreens ||= []).push(sg.material); }
  if (F.cross) { const cm = hg.crossM || new THREE.MeshLambertMaterial({ color: '#f4f1ea', emissive: '#ffffff', emissiveIntensity: 0 }); const ccm = cm.clone(); ccm.emissive.set('#ffffff'); (hg.lmCross ||= []).push(ccm); const pole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 11, 0.9), ccm); pole.position.y = TH + 5.5; grp.add(pole); const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.9), ccm); bar.position.y = TH + 7.8; grp.add(bar); }
  hg.foot?.push({ ring: [[tx - F.w / 2, tz - F.d / 2], [tx + F.w / 2, tz - F.d / 2], [tx + F.w / 2, tz + F.d / 2], [tx - F.w / 2, tz + F.d / 2]], h: TH, x0: tx - F.w, x1: tx + F.w, z0: tz - F.w, z1: tz + F.w, name, type: 'panels' });
}
// 유리 · 금빛 외벽: 하늘을 비춘다 (비스듬히 볼수록 하늘빛이 더 · 위쪽 벽일수록 하늘 꼭대기 색, 건물 색으로 물든다). 밤엔 하늘이 어두워 불 켜진 창이 살아난다
function skyGlass(m, skyU, gold) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.skyTop = skyU.top; sh.uniforms.skyHor = skyU.hor; sh.uniforms.skyNight = skyU.night;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 skyTop, skyHor; uniform float skyNight;').replace('#include <opaque_fragment>', `{
      vec3 vd = normalize(vViewPosition); float f = pow(1.0 - abs(dot(normal, vd)), 2.0) * 0.6 + 0.28;
      vec3 wn = inverseTransformDirection(normal, viewMatrix); vec3 refl = mix(skyHor, skyTop, clamp(0.35 + wn.y * 0.5, 0.0, 1.0));
      vec3 tintC = mix(vec3(1.0), vColor.rgb * ${gold ? '1.25' : '1.15'}, ${gold ? '0.8' : '0.55'}); f *= (1.0 - skyNight * 0.75) * (1.0 - smoothstep(0.6, 0.9, wn.y)); // 평평한 옥상은 비추지 않는다
      outgoingLight = outgoingLight * (1.0 - f * 0.55) + refl * tintC * f; }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => (gold ? 'skyglass-gold' : 'skyglass');
}
// 건물마다 씨앗: 외곽선 첫 점 · 꼭짓점 수를 섞는다 (murmur 끝맺음)
function bSeed(b) { let h = (Math.round(b[7]) * 73856093) ^ (Math.round(b[8]) * 19349663) ^ (b.length * 83492791); h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; }
// 아파트 브랜드 → [외벽 색, 옆벽 띠 색] (실제 단지에서 흔한 도색)
const APT_BRANDS = [[/래미안/, '#e4e4e2', '#4a5866'], [/자이/, '#eeeeec', '#3d3f44'], [/힐스테이트/, '#e6ddd0', '#7a5f48'], [/푸르지오/, '#efefec', '#5f8a5a'], [/편한세상/, '#f0f0ee', '#3f6fa8'], [/롯데캐슬/, '#e8dfd0', '#8a6a50'], [/아이파크/, '#ebebe8', '#6a6e74'], [/더샵/, '#e2e3e3', '#4f5a60'], [/SK|에스케이/, '#f0eeea', '#d0602a'], [/주공|LH|휴먼시아/, '#efe8d8', '#4f9a6a'], [/현대/, '#efe8d6', '#2f7a5a'], [/한신/, '#efe6d0', '#3f6fa8'], [/삼성/, '#eeeae2', '#2f5fa8'], [/우성/, '#efe9dc', '#b0453a'], [/대림/, '#efebe2', '#3f6fa8'], [/쌍용|예가/, '#ece6da', '#a8463a'], [/위브|두산/, '#ece9e4', '#5a6a8a'], [/금호|어울림/, '#eeeae2', '#c46a2a'], [/벽산/, '#efe8da', '#3f7a5a']];
function aptBrand(name) { if (!name) return null; for (const [re, w, a] of APT_BRANDS) if (re.test(name)) return [w, a]; return null; }
// 건축물 정보 → 외벽 [종류, 색]. use: 1 단독 · 2 공동주택 · 3 · 4 근린생활 · 6 종교 · 7 판매 · 9 의료 · 10 교육 · 14 업무 · 15 숙박, st: 11 · 12 · 13 · 19 조적(벽돌 · 블록 · 돌) · 21 · 22 철근콘크리트 · 3x 철골, yr: 사용승인 연도
function styleOf([use, st, yr], h, r, shopG) {
  const pick2 = (a) => a[Math.floor(r() * a.length)], masonry = st >= 11 && st <= 19, steel = st >= 31 && st <= 39, era = yr ? (yr < 1990 ? 0 : yr < 2005 ? 1 : 2) : 1;
  // 한옥: 목구조(건축물대장 구조 코드 51 ~ 59 = 일반목구조 · 통나무 등) 낮은 집 (북촌 · 서촌 · 인사동) → 흰 회벽 · 나무 기둥 · 기와 지붕은 따로 얹는다
  if (st >= 51 && st <= 59 && h < 9) return ['hanok', '#f2ece0'];
  if (use === 6) return ['church', '#efe9de'];
  // 공장 · 창고 (성수 붉은 벽돌 공장 카페 등): 짙은 붉은 벽돌 + 큰 공장 창
  // 지식산업센터 (공장 용도인 높은 유리 빌딩)
  if ((use === 17 || use === 18) && h > 22) return ['glass', pick2(['#9fb2c0', '#a9bccb', '#b8c6cf', '#8d9ea9'])];
  if (use === 17 || use === 18) return ['factory', pick2(['#8a3f2e', '#9a4a36', '#7a3a2c', '#a5523e', '#6b6f73'])];
  if (use === 2 && h > 24) return null; // 아파트 단지는 아파트 모습 그대로
  const home = use === 1 || use === 2, shop = use === 3 || use === 4 || use === 7;
  // 석구조 (연세대 언더우드관 같은 옛 돌 건물): 회색 · 베이지 화강석
  if (st === 13) return ['stone', pick2(['#b8b4ac', '#a8a49c', '#c9c2b4'])];
  // 주택 · 빌라 · 다세대: 연대마다 실제 서울 골목 모습
  //   1990년 전: 붉은 · 밤색 벽돌집이 많고 3할쯤은 회벽에 페인트(크림 · 연두 · 하늘 · 분홍)
  //   1990 ~ 2004: 치장벽돌 빌라(붉은 · 갈색 · 베이지) 7할, 화강석(분홍빛 · 회색) 3할, 1층은 필로티 주차장 · 화강석
  //   2005년 뒤: 드라이비트(흰 · 회색) · 화강석 · 판넬 빌라, 고벽돌(짙은 회색 · 갈색) 3할, 대부분 필로티
  //   3번째 값 = 1층 모습 (pilotis 필로티 · granite 화강석 띠 · shop 1층 가게)
  if (home) {
    const g = shopG ? 'shop' : h >= 7.5 && r() < [0.06, 0.38, 0.72][era] ? 'pilotis' : r() < [0.2, 0.55, 0.5][era] ? 'granite' : null;
    if (era === 0) return r() < (masonry ? 0.68 : 0.5) ? ['brick', pick2(['#8a4a36', '#7a3f30', '#9a5a44', '#94503c', '#a0604a']), g] : ['brick', pick2(['#ece4d0', '#dfe6d2', '#d8e2e6', '#efdcd4', '#e8e2d6', '#cfd6c4']), g];
    if (era === 1) return r() < 0.7 ? ['brick', pick2(['#a5523e', '#b0604a', '#9c4f3a', '#8a5a44', '#b38a6a', '#c4a484', '#7a4a3a']), g] : ['villa', pick2(['#d9c3b8', '#cfcac2', '#e0d6cc', '#c8beb6', '#e6e0d6']), g];
    return r() < 0.3 ? ['brick', pick2(['#5d5a58', '#6e625a', '#8a6a58', '#4a4848', '#a08a76']), g] : ['villa', pick2(['#f2f1ed', '#e4e3df', '#d2d1cd', '#bdbcb8', '#e8e1d6', '#8f9196', '#f0ebe2']), g];
  }
  // 조적 상가 (을지로 · 종로 옛 상가): 붉은 벽돌 + 1층 가게
  if (masonry && shop && h < 20) return ['street', pick2(['#9a4f3c', '#8a4a36', '#a8603e', '#b5654a'])];
  if (masonry) return ['brick', era === 0 ? pick2(['#8a4a36', '#7a3f30', '#9a5a44']) : era === 1 ? pick2(['#a5523e', '#b0604a', '#9c4f3a']) : pick2(['#b8735a', '#c9a27a', '#a8866a'])];
  // 업무 빌딩 (높은 근생 · 판매 포함): 연대마다
  //   1990년 전: 갈색 · 회색 타일과 석재 네모 창, 화강석 띠창, 구릿빛 · 짙은 반사 유리
  //   1990 ~ 2004: 회색 화강석 띠창, 짙은 청록 · 구릿빛 반사 유리
  //   2005년 뒤: 은회색 · 푸른 유리 커튼월, 짙은 회색 · 흰 판넬
  const DARK = ['#4f6a6a', '#3f5866', '#6a5a48', '#56707a', '#2f3e4a', '#5a6470'], LIGHT = ['#9fb6c8', '#b0c2cc', '#8fa6b8', '#a9b6bd', '#7f97ab', '#5d7487'], BAND = ['#a9a7a2', '#c9c6bf', '#8c8a86', '#d8d4cc', '#b8ada0', '#e2dfd8'];
  if (steel && h > 15) return ['glass', pick2(era === 2 ? LIGHT : DARK)];
  if (use === 14 || ((shop || use === 15) && h > 30)) {
    const q = r();
    if (h <= 20 && era < 2) return q < 0.5 ? ['stone', pick2(['#c9c4bc', '#a8a39a', '#d8d2c6', '#8e8a84', '#b9a68c'])] : ['street2', pick2(BAND)];
    if (era === 0) return q < 0.4 ? ['stone', pick2(['#b9a68c', '#8e7f6e', '#a8a39a', '#c8bfae', '#7a6a5a'])] : q < 0.72 ? ['street2', pick2(BAND)] : ['glass', pick2(DARK)];
    if (era === 1) return q < 0.42 ? ['street2', pick2(BAND)] : q < 0.8 ? ['glass', pick2(DARK)] : ['stone', pick2(['#8c8a86', '#a9a7a2', '#6e6c69', '#c9c6bf'])];
    return q < 0.75 ? ['glass', pick2(LIGHT)] : ['stone', pick2(['#5d5f63', '#7a7c80', '#e9e8e4', '#3f4145', '#c9c8c4'])];
  }
  // 문화 · 집회 (공연장 · 전시장 · 예식장): 밝은 석재
  if (use === 5) return ['stone', pick2(['#e8e4dc', '#d8d2c6', '#c9c4bc', '#efe9e0'])];
  // 학교 · 대학: 크림 · 흰 도장, 1990년대 전엔 붉은 벽돌도 흔하다
  if (use === 10) return era < 2 && r() < 0.35 ? ['brick', pick2(['#9a4f3c', '#a5523e', '#8a4a36'])] : ['stone', pick2(['#efe6cf', '#e8dcc0', '#f2efe8', '#e2e4e0'])];
  if (use === 9) return ['stone', pick2(['#f2f2ee', '#e8eaea', '#eeeae2'])];
  // 숙박 (모텔 · 호텔): 짙은 타일 · 석재 띠창
  if (use === 15) return ['street2', pick2(['#e8e4dc', '#6b4a3a', '#2f2f33', '#c8b49a', '#8a6a5a'])];
  // 근생 · 판매 (1층 가게): 1980년대 타일(베이지 · 갈색 · 흰), 1990년대 화강석 · 타일, 2005년 뒤 알루미늄 복합판넬(은 · 흰 · 짙은 회색) · 유리
  if (shop) return era === 0 ? ['street', pick2(['#e8dcc8', '#c9b49a', '#b08e6e', '#efe9e0', '#9a6a4e', '#d6cbb8'])] : era === 1 ? ['street', pick2(['#d8d2c8', '#bdb8b0', '#e8e4dc', '#a29e98', '#c9b9a6', '#cdb8ae'])] : ['street2', pick2(['#2f2f33', '#f4f1ea', '#8a8f96', '#c8ccd0', '#5a5d63', '#e8e4dc'])];
  return null;
}
// 뚝섬 자벌레: 외곽선의 긴 축을 따라 칸마다 가운데 · 폭을 재서 그 선을 따라 납작한 튜브
function buildJBug(hg, ring) {
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length;
  let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; } const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang);
  const pr = ring.map(([x, z]) => ({ a: (x - cx) * ux + (z - cz) * uz, b: -(x - cx) * uz + (z - cz) * ux })), a0 = Math.min(...pr.map((p) => p.a)), a1 = Math.max(...pr.map((p) => p.a)), NB = 14, bins = Array.from({ length: NB }, () => []);
  for (const p of pr) bins[Math.min(NB - 1, Math.floor((p.a - a0) / (a1 - a0) * NB))].push(p.b);
  const mids = bins.map((b, i) => ({ a: a0 + (i + 0.5) / NB * (a1 - a0), b: b.length ? (Math.min(...b) + Math.max(...b)) / 2 : null, w: b.length ? Math.max(...b) - Math.min(...b) : null })).filter((m) => m.b != null);
  const W = Math.min(14, Math.max(8, mids.reduce((s2, m) => s2 + m.w, 0) / mids.length * 0.8)), Y = 9;
  const pts = mids.map((m) => new THREE.Vector3(cx + ux * m.a - uz * m.b, Y, cz + uz * m.a + ux * m.b)); if (pts.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 90, 1, 20, false); tube.scale(1, 1, 1);
  // 납작하게: 단면을 가로 W, 세로 W * 0.62 로 (TubeGeometry 의 반지름 1 을 곡선 법선 방향별로 늘린다)
  const pos = tube.attributes.position, n = 20, seg = 90; for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg); for (let j = 0; j <= n; j++) { const k = i * (n + 1) + j, x = pos.getX(k) - c.x, y = pos.getY(k) - c.y, z = pos.getZ(k) - c.z; pos.setXYZ(k, c.x + x * W / 2, c.y + y * W * 0.31, c.z + z * W / 2); } } tube.computeVertexNormals();
  const skin = new THREE.MeshPhongMaterial({ color: '#d5dbe0', shininess: 90, specular: '#9aa8b4' }); hg.scene.add(new THREE.Mesh(tube, skin));
  // 마디 고리 · 옆 유리 띠 · 기둥 · 아래 LED
  const ribM = new THREE.MeshLambertMaterial({ color: '#aab4be' }), glassM = new THREE.MeshLambertMaterial({ color: '#2f3a46', emissive: '#ffe6c0', emissiveIntensity: 0.15 }), L = curve.getLength();
  for (let d = 2; d < L - 1; d += 4) { const t = d / L, p = curve.getPointAt(t), tg = curve.getTangentAt(t), rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 28), ribM); rib.scale.set(W / 2 + 0.05, W * 0.31 + 0.05, 1); rib.position.copy(p); rib.lookAt(p.clone().add(tg)); hg.scene.add(rib); }
  const band = new THREE.TubeGeometry(curve, 90, 1, 20, false), bp = band.attributes.position; for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg); for (let j = 0; j <= n; j++) { const k = i * (n + 1) + j; bp.setXYZ(k, c.x + (bp.getX(k) - c.x) * (W / 2 + 0.06), c.y + (bp.getY(k) - c.y) * 0.9, c.z + (bp.getZ(k) - c.z) * (W / 2 + 0.06)); } } band.computeVertexNormals(); const bm = new THREE.Mesh(band, glassM); hg.scene.add(bm); hg.jbugM = glassM;
  const pg = new THREE.CylinderGeometry(0.45, 0.6, Y - W * 0.31, 10); pg.translate(0, (Y - W * 0.31) / 2, 0); for (let d = 8; d < L - 4; d += 18) { const p = curve.getPointAt(d / L), col = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: '#c9c2b6' })); col.position.set(p.x, 0, p.z); hg.scene.add(col); hg.addCircle(p.x, p.z, 0.6, Y); }
  const led = new THREE.LineBasicMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.2 }); hg.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(120).map((p) => p.clone().setY(Y - W * 0.31 - 0.1))), led)); (hg.lmLights ||= []).push(led);
}
// 비스듬한 유리 왕관: 지붕 둘레를 dir 방향으로 갈수록 rise 만큼 높게 올리고, 그 위를 기울어진 유리 지붕으로 덮는다 (밤엔 모서리 불빛)
function buildCrown(hg, ring, h, L) {
  const [dx0, dz0] = L.crown.dir, dl = Math.hypot(dx0, dz0) || 1, dx = dx0 / dl, dz = dz0 / dl, pr = ring.map(([x, z]) => x * dx + z * dz), lo = Math.min(...pr), hi = Math.max(...pr), up = ring.map((_, i) => h + 1.5 + ((pr[i] - lo) / (hi - lo || 1)) * L.crown.rise);
  const P = [], I = [], s = ringArea(ring) > 0 ? 1 : -1;
  for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length, [ax, az] = ring[i], [bx, bz] = ring[j], k = P.length / 3; P.push(ax, h, az, bx, h, bz, bx, up[j], bz, ax, up[i], az); if (s < 0) I.push(k, k + 1, k + 2, k, k + 2, k + 3); else I.push(k, k + 2, k + 1, k, k + 3, k + 2); }
  let tris; try { tris = THREE.ShapeUtils.triangulateShape(ring.map(([x, z]) => new THREE.Vector2(x, z)), []); } catch { tris = []; }
  const k = P.length / 3; ring.forEach(([x, z], i) => P.push(x, up[i], z)); for (const t of tris) { const [A, B, C] = t.map((v) => ring[v]); const o = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]); if (o > 0) I.push(k + t[0], k + t[1], k + t[2]); else I.push(k + t[0], k + t[2], k + t[1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  const c = new THREE.Color(L.color).lerp(new THREE.Color('#dff3ff'), 0.35), m = new THREE.MeshPhongMaterial({ color: c, transparent: true, opacity: 0.82, shininess: 40, specular: '#4a5a6a', side: THREE.DoubleSide, emissive: '#bfe4ff', emissiveIntensity: 0 });
  hg.scene.add(new THREE.Mesh(g, m)); (hg.lmCrowns ||= []).push(m);
  // 모서리 불빛: 기울어진 윗선
  const lm = new THREE.LineBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.2 }); hg.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...ring, ring[0]].map(([x, z], i) => new THREE.Vector3(x, up[i % ring.length] + 0.1, z))), lm)); (hg.lmLights ||= []).push(lm);
}
// 외곽선을 긴 축(주축) 방향으로 long 배, 짧은 축으로 short 배 줄인다 (가운데 기준)
// 위로 갈수록 가늘어지는 건물(롯데월드타워 · 63빌딩): 그 높이의 실제 외곽선 (부딪힘 · 벽 타기 · 지붕). 1m 단위로 기억
function ringAtY(f, y) {
  if (!f.tp) return f.ring;
  const k = Math.round(Math.max(f.mh || 0, Math.min(f.h, y))); f.tpc ||= new Map(); let r = f.tpc.get(k);
  if (!r) { r = f.tp(k); if (f.tpc.size > 64) f.tpc.clear(); f.tpc.set(k, r); }
  return r;
}
// 외곽선에서 가장 가까운 벽 위의 점과 바깥 방향
function wallNear(ring, x, z) {
  let best = Infinity, o = null; const sgn = ringArea(ring) > 0 ? 1 : -1;
  for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], ex = c[0] - a[0], ez = c[1] - a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / L2, 0, 1), px = a[0] + ex * t, pz = a[1] + ez * t, d = Math.hypot(x - px, z - pz); if (d < best) { best = d; const L = Math.sqrt(L2); o = { x: px, z: pz, nx: (sgn > 0 ? ez : -ez) / L, nz: (sgn > 0 ? -ex : ex) / L }; } }
  return o;
}
function scaleRing(ring, long, short, C = null) {
  let cx = 0, cz = 0; for (const [x, z] of ring) { cx += x; cz += z; } cx /= ring.length; cz /= ring.length; if (C) { cx = C[0]; cz = C[1]; }
  let xx = 0, zz = 0, xz = 0; for (const [x, z] of ring) { const dx = x - cx, dz = z - cz; xx += dx * dx; zz += dz * dz; xz += dx * dz; }
  const ang = 0.5 * Math.atan2(2 * xz, xx - zz), ux = Math.cos(ang), uz = Math.sin(ang);
  return ring.map(([x, z]) => { const dx = x - cx, dz = z - cz, a = dx * ux + dz * uz, b = -dx * uz + dz * ux, a2 = a * long, b2 = b * short; return [cx + a2 * ux - b2 * uz, cz + a2 * uz + b2 * ux]; });
}
function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }
function checkTex(col) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? col : '#ffffff'; g.fillRect(i * 16, j * 16, 16, 16); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function heartSprite() { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.font = '52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💗', 32, 36); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); s.scale.set(0.6, 0.6, 1); return s; }
