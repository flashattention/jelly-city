// 서울 산책: 길 위 차량 모양 (8-27-1)
//   한국 도로에 흔한 차 종류를 실제 비율로 (상표 · 로고 · 실제 차 이름 없이 일반 이름만)
//   차 종류마다 그물 하나(가까운 것 · 먼 것 두 벌). 모든 종류가 재질 하나를 같이 쓴다
//     꼭짓점마다 '무엇인지(vk)'를 적어 두고, 셰이더가 그에 따라
//       도색(인스턴스 색) · 유리(하늘 비침) · 전조등 · 후미등(브레이크) · 깜빡이 · 경광등 · 번호판 · 노선 LED 를 그린다
//   좌표: 차 앞이 +z, +x 는 운전석 쪽(왼쪽), 바닥 y = 0
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

// 꼭짓점 종류
export const VK = { fixed: 0, paint: 1, head: 2, tail: 3, blinkL: 4, blinkR: 5, sign: 7, plate: 8, text: 9, led: 10, sirenR: 11, sirenB: 12, glowText: 13, glass: 14, paint2: 15 };

// ---------- 글씨 그림 한 장 (번호판 64 · 노선 32 · 고정 글씨 32) ----------
//   1024 × 512, 칸 128 × 32. 줄 0 ~ 3 흰 번호판(자가용), 4 ~ 7 노란 번호판(영업용), 8 ~ 11 노선 LED, 12 ~ 15 고정 글씨
const HANGUL_P = '가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주'.split('');
const HANGUL_C = '아바사자배'.split('');
export const ROUTES = ['146', '740', '360', '472', '402', '9401', '3011', '4319', '6411', '2016', '7016', '5714', '1711', '9707', '8541', 'M6117', '0017', '02', '01', '7019', '273', '505', '641', '9003', '3412', '4211', '6617', '163', '440', '462', '서초09', '마포08'];
export const TEXT = { taxi: 0, deluxe: 1, police: 2, policeEn: 3, ambul: 4, fire: 5, parcel: 6, school: 7, tour: 8, rescue: 9 };
let ATLAS = null;
export function atlas() {
  if (ATLAS) return ATLAS;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d');
  let seed = 12345; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cell = (i) => [(i % 8) * 128, Math.floor(i / 8) * 32];
  // 번호판: 흰 판 + 검은 글씨 '123가 4567', 노란 판 + 검은 글씨 '34바 5678' (숫자는 지어낸 것)
  for (let i = 0; i < 64; i++) {
    const [x, y] = cell(i), yellow = i >= 32; g.fillStyle = yellow ? '#f2c230' : '#f7f8f6'; g.fillRect(x, y, 128, 32);
    g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, 124, 28);
    const n3 = String(100 + Math.floor(r() * 899)), n4 = String(1000 + Math.floor(r() * 8999)), h = yellow ? HANGUL_C[Math.floor(r() * HANGUL_C.length)] : HANGUL_P[Math.floor(r() * HANGUL_P.length)];
    g.fillStyle = '#16181a'; g.font = 'bold 21px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${yellow ? n3.slice(1) : n3}${h} ${n4}`, x + 64, y + 17, 116);
  }
  // 노선 LED: 검은 바탕에 주황 LED 글씨 (점 무늬)
  for (let i = 0; i < 32; i++) {
    const [x, y] = cell(64 + i); g.fillStyle = '#0a0a0b'; g.fillRect(x, y, 128, 32);
    g.fillStyle = '#ffb21e'; g.font = `bold ${ROUTES[i].length > 4 ? 20 : 26}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ROUTES[i], x + 64, y + 17, 120);
    g.fillStyle = 'rgba(10,10,11,0.45)'; for (let k = 0; k < 128; k += 3) g.fillRect(x + k, y, 1, 32); for (let k = 0; k < 32; k += 3) g.fillRect(x, y + k, 128, 1);
  }
  // 고정 글씨 (차 옆 · 지붕등)
  const fixed = [
    ['택시', '#ffffff', '#1c1c1c', 24], ['모범', '#f6c400', '#111111', 24], ['경 찰', 'rgba(0,0,0,0)', '#173a7a', 26], ['POLICE', 'rgba(0,0,0,0)', '#173a7a', 22],
    ['119 구급대', 'rgba(0,0,0,0)', '#d0141c', 20], ['119 소방', 'rgba(0,0,0,0)', '#ffffff', 22], ['택배', 'rgba(0,0,0,0)', '#2a2b2f', 24], ['어린이 보호차량', '#f6c400', '#111', 15],
    ['관광', 'rgba(0,0,0,0)', '#ffffff', 22], ['구조', 'rgba(0,0,0,0)', '#ffffff', 22],
  ];
  fixed.forEach(([t, bg, fg, fs], i) => {
    const [x, y] = cell(96 + i); g.clearRect(x, y, 128, 32);
    if (bg !== 'rgba(0,0,0,0)') { g.fillStyle = bg; g.fillRect(x, y, 128, 32); }
    g.fillStyle = fg; g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + 64, y + 17, 122);
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  ATLAS = { cv, tex }; return ATLAS;
}
// 고정 글씨 칸의 uv (칸 번호 → 그림 안 자리)
function cellUV(i) { const cx = i % 8, cy = Math.floor(i / 8); return [cx / 8, 1 - (cy + 1) / 16, (cx + 1) / 8, 1 - cy / 16]; }

// ---------- 같이 쓰는 재질 ----------
//   uniforms: 시간(깜빡이 · 경광등) · 밤(0 ~ 1)
export const VU = { uTime: { value: 0 }, uNight: { value: 0 }, uAtlas: { value: null } };
let MAT = null;
export function vehicleMat() {
  if (MAT) return MAT;
  VU.uAtlas.value = atlas().tex;
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, VU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float vk;
attribute vec4 iSt;
attribute vec2 iCell;
varying float vK;
varying vec4 vSt;
varying vec2 vAt;`)
      .replace('#include <color_vertex>', `vColor = vec3( 1.0 );
vColor *= color;
#ifdef USE_INSTANCING_COLOR
if ( vk > 0.5 && vk < 1.5 ) vColor *= instanceColor.xyz;
if ( vk > 14.5 ) vColor *= instanceColor.xyz * 0.62;
#endif
vK = vk;
#ifdef USE_INSTANCING
vSt = iSt;
float cIdx = vk < 8.5 ? iCell.x : iCell.y + 64.0;
#else
vSt = vec4( 0.0 );
float cIdx = 0.0;
#endif
vec2 cc = vec2( mod( cIdx, 8.0 ), floor( cIdx / 8.0 ) );
vAt = ( vk > 8.5 && vk < 9.5 ) || ( vk > 12.5 && vk < 13.5 ) ? uv : vec2( ( cc.x + uv.x ) / 8.0, 1.0 - ( cc.y + 1.0 - uv.y ) / 16.0 );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uNight;
uniform sampler2D uAtlas;
varying float vK;
varying vec4 vSt;
varying vec2 vAt;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec4 atx = vec4( 0.0 );
if ( ( vK > 7.5 && vK < 10.5 ) || ( vK > 12.5 && vK < 13.5 ) ) {
  atx = texture2D( uAtlas, vAt );
  diffuseColor.rgb = mix( diffuseColor.rgb, atx.rgb, atx.a ) * ( vK > 9.5 && vK < 10.5 ? 0.2 : 1.0 );
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float k = vK;
  float blink = step( 0.5, fract( uTime * 1.55 ) );
  vec3 em = vec3( 0.0 );
  if ( k > 1.5 && k < 2.5 ) em = vColor * ( 0.22 + vSt.x * 2.6 );
  else if ( k > 2.5 && k < 3.5 ) em = vColor * ( 0.12 + vSt.x * 0.85 + vSt.y * 2.6 );
  else if ( k > 3.5 && k < 4.5 ) em = vColor * ( 0.04 + blink * step( 0.5, mod( vSt.z, 2.0 ) ) * 3.0 );
  else if ( k > 4.5 && k < 5.5 ) em = vColor * ( 0.04 + blink * step( 1.5, vSt.z ) * 3.0 );
  else if ( k > 6.5 && k < 7.5 ) em = vColor * ( 0.35 + uNight * 1.4 );
  else if ( k > 9.5 && k < 10.5 ) em = atx.rgb * ( 0.9 + uNight * 0.9 );
  else if ( k > 12.5 && k < 13.5 ) em = atx.rgb * atx.a * ( 0.3 + uNight * 1.3 );
  else if ( k > 10.5 && k < 12.5 ) { float ph = fract( uTime * 2.2 + ( k > 11.5 ? 0.5 : 0.0 ) ); float on = step( 0.5, ph ) * ( 0.6 + 0.4 * step( 0.75, fract( uTime * 8.8 ) ) ); em = vColor * ( 0.12 + on * vSt.w * 3.4 ); }
  else if ( k > 13.5 && k < 14.5 ) {
    float f = pow( 1.0 - abs( normal.z ), 2.0 );
    float up = clamp( normal.y * 0.5 + 0.5, 0.0, 1.0 );
    vec3 sky = mix( vec3( 0.07, 0.085, 0.10 ), vec3( 0.30, 0.38, 0.46 ), up );
    em = mix( sky, vec3( 0.015, 0.02, 0.035 ) + vec3( 0.05, 0.035, 0.02 ) * up, uNight ) * ( 0.45 + f * 1.4 );
  }
  if ( ( k > 0.5 && k < 1.5 ) || k > 14.5 ) {
    float f = pow( 1.0 - max( normal.z, 0.0 ), 3.0 );
    float top = clamp( normal.y, 0.0, 1.0 );
    em += diffuseColor.rgb * f * 0.22 * ( 1.0 - uNight * 0.7 ) + vec3( 0.55, 0.62, 0.7 ) * top * top * 0.06 * ( 1.0 - uNight * 0.8 );
  }
  totalEmissiveRadiance += em;
}`);
  };
  m.customProgramCacheKey = () => 'hgVehicle1';
  MAT = m; return m;
}

// ---------- 그물 짜기 도우미 ----------
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V1 = new THREE.Vector3(), S1 = new THREE.Vector3();
export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { return new THREE.Matrix4().compose(V1.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S1.set(sx, sy, sz)); }
const C3 = new THREE.Color();
export class Build {
  constructor() { this.parts = []; }
  // 모든 조각을 같은 속성(position · normal · uv · color · vk)으로
  norm(geo, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'row'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m) g.applyMatrix4(m);
    return g;
  }
  add(geo, color, kind = 0, m = null) {
    const g = this.norm(geo, m), n = g.attributes.position.count, c = new Float32Array(n * 3), k = new Float32Array(n); C3.set(color);
    for (let i = 0; i < n; i++) { c[i * 3] = C3.r; c[i * 3 + 1] = C3.g; c[i * 3 + 2] = C3.b; k[i] = kind; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('vk', new THREE.BufferAttribute(k, 1)); this.parts.push(g); return g;
  }
  // 삼각형마다 색 · 종류 고르기: fn(가운데 점, 법선) → [색, 종류]
  addPainted(geo, fn, m = null) {
    const g = this.norm(geo, m), P = g.attributes.position, N = g.attributes.normal, n = P.count, c = new Float32Array(n * 3), k = new Float32Array(n);
    const ce = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let t = 0; t < n; t += 3) {
      ce.set(0, 0, 0); nn.set(0, 0, 0);
      for (let j = 0; j < 3; j++) { ce.x += P.getX(t + j) / 3; ce.y += P.getY(t + j) / 3; ce.z += P.getZ(t + j) / 3; nn.x += N.getX(t + j); nn.y += N.getY(t + j); nn.z += N.getZ(t + j); }
      nn.normalize(); const R = g.attributes.row, [col, kind] = fn(ce, nn, R ? [R.getX(t), R.getX(t + 1), R.getX(t + 2)] : null); C3.set(col);
      for (let j = 0; j < 3; j++) { c[(t + j) * 3] = C3.r; c[(t + j) * 3 + 1] = C3.g; c[(t + j) * 3 + 2] = C3.b; k[t + j] = kind; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('vk', new THREE.BufferAttribute(k, 1)); if (g.attributes.row) g.deleteAttribute('row'); this.parts.push(g); return g;
  }
  // 글씨 판 (고정 글씨 칸 i): 판 앞이 +z
  //   bg: 글씨 뒤 바탕색 (글씨 칸의 빈 곳은 이 색)
  text(i, w, h, m, glow = false, bg = '#ffffff') {
    const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = cellUV(96 + i), uv = g.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, lerp(u0, u1, uv.getX(j)), lerp(v0, v1, uv.getY(j)));
    return this.add(g, bg, glow ? VK.glowText : VK.text, m);
  }
  // 번호판 (인스턴스마다 다른 번호): 판 앞이 +z
  plate(m, w = 0.52, h = 0.11) { this.add(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.012), '#1a1a1a', 0, m); return this.add(new THREE.PlaneGeometry(w, h), '#ffffff', VK.plate, new THREE.Matrix4().multiplyMatrices(m, T(0, 0, 0.007))); }
  done() { const g = mergeGeometries(this.parts); this.parts = []; g.computeBoundingSphere(); return g; }
}

// ---------- 바퀴: 타이어 + 휠(살) + 가운데 ----------
function wheel(B, x, z, r, w, lod, opt = {}) {
  const seg = lod ? 18 : 10, side = Math.sign(x) || 1;
  const tire = new THREE.CylinderGeometry(r, r, w, seg, 1); tire.rotateZ(Math.PI / 2);
  B.add(tire, '#141416', 0, T(x, r, z));
  if (!lod) { B.add(new THREE.CircleGeometry(r * 0.6, 8), opt.rim || '#9aa0a6', 0, T(x + side * (w / 2 + 0.005), r, z, 0, side * Math.PI / 2)); return; }
  // 타이어 옆면 둥글게 (가장자리 띠)
  const lip = new THREE.TorusGeometry(r * 0.86, w * 0.18, 6, seg); lip.rotateY(Math.PI / 2); B.add(lip, '#1c1c1f', 0, T(x + side * (w / 2 - 0.02), r, z));
  // 휠: 은색 원판 + 살 사이 어두운 구멍 + 가운데 뚜껑
  const rim = opt.rim || '#b9bec4', rr = r * 0.64, face = x + side * (w / 2 + 0.004);
  B.add(new THREE.CircleGeometry(rr, 20), rim, 0, T(face, r, z, 0, side * Math.PI / 2));
  const spokes = opt.spokes ?? 5;
  if (spokes) for (let i = 0; i < spokes; i++) { const a = (i / spokes) * Math.PI * 2 + 0.3, hole = new THREE.CircleGeometry(rr * 0.27, 7); B.add(hole, '#2a2c30', 0, T(face + side * 0.003, r + Math.sin(a) * rr * 0.55, z + Math.cos(a) * rr * 0.55, 0, side * Math.PI / 2)); }
  else { const ring = new THREE.RingGeometry(rr * 0.75, rr * 0.9, 16); B.add(ring, '#3a3d42', 0, T(face + side * 0.003, r, z, 0, side * Math.PI / 2)); }
  B.add(new THREE.CircleGeometry(rr * 0.2, 10), '#d8dce0', 0, T(face + side * 0.006, r, z, 0, side * Math.PI / 2));
}

// ---------- 승용차 몸통: 단면 고리를 앞뒤로 이어 붙인 둥근 몸통 ----------
//   P.top: 옆에서 본 윗선 [z, y] (뒤 → 앞), P.belt: 창 아랫선, P.ws: [지붕 앞 끝 z, 앞 유리 밑 z], P.rg: [뒤 유리 밑 z, 지붕 뒤 끝 z]
//   P.dlo: 옆 유리 [뒤 z, 앞 z], P.pillars: B · C 기둥 z
export function topAt(P, z) { const t = P.top; if (z <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (z <= t[i][0]) { const k = (z - t[i - 1][0]) / (t[i][0] - t[i - 1][0] || 1); return lerp(t[i - 1][1], t[i][1], k * k * (3 - 2 * k) * 0.35 + k * 0.65); } return t[t.length - 1][1]; }
function botAt(P, z) { const over = Math.max(0, Math.abs(z) - (P.L / 2 - (z > 0 ? P.ohF : P.ohR))); return P.gc + over * over * 0.35 + over * 0.06; }
export function halfW(P, z) { const rf = P.rf ?? 0.42, rr = P.rr ?? 0.34, W2 = P.W / 2; if (z > P.L / 2 - rf) { const d = z - (P.L / 2 - rf); return W2 - rf + Math.sqrt(Math.max(0, rf * rf - d * d)); } if (z < -P.L / 2 + rr) { const d = -P.L / 2 + rr - z; return W2 - rr + Math.sqrt(Math.max(0, rr * rr - d * d)); } return W2; }
function carRing(P, z, lod) {
  const top = topAt(P, z), yb = botAt(P, z), hw = halfW(P, z), belt = Math.min(P.belt, top - 0.03);
  const tw = (y) => hw * (1 - (1 - (P.tumble ?? 0.8)) * clamp((y - P.belt) / Math.max(0.1, P.H - P.belt), 0, 1));
  const g0 = Math.min(P.belt + 0.04, top - 0.025), g1 = Math.max(g0, top - 0.075), tt = tw(top);
  const pts = lod
    ? [[0, yb], [hw * 0.84, yb], [hw * 0.97, yb + 0.08], [hw, yb + (belt - yb) * 0.55], [hw * 0.975, belt], [tw(g0), g0], [tw(g1), g1], [tt * 0.93, top - 0.03], [tt * 0.76, top - 0.006], [tt * 0.4, top], [0, top]]
    : [[0, yb], [hw * 0.92, yb], [hw, belt], [tw(g1), g1], [tt * 0.8, top], [0, top]];
  return [...pts, ...pts.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
}
function carLoft(P, lod) {
  const keys = new Set([-P.L / 2, P.L / 2, ...P.top.map((p) => p[0]), P.ws[0], P.ws[1], P.rg[0], P.rg[1], P.dlo[0], P.dlo[1], Math.max(P.dlo[1], P.ws[1] - 0.22), ...(P.pillars || []).flatMap((z) => [z - 0.06, z + 0.06]), P.wheel.zf - P.wheel.r - 0.08, P.wheel.zf + P.wheel.r + 0.08, P.wheel.zr - P.wheel.r - 0.08, P.wheel.zr + P.wheel.r + 0.08]);
  let zs = [...keys].filter((z) => z >= -P.L / 2 && z <= P.L / 2).sort((a, b) => a - b);
  // 가까운 것은 0.13m 마다 고리, 먼 것은 굵게
  const step = lod ? 0.13 : 0.6, out = [];
  for (let i = 0; i < zs.length; i++) { out.push(zs[i]); if (i < zs.length - 1) { const n = Math.floor((zs[i + 1] - zs[i]) / step); for (let k = 1; k <= n; k++) out.push(zs[i] + ((zs[i + 1] - zs[i]) * k) / (n + 1)); } }
  zs = out.filter((z, i) => i === 0 || z - out[i - 1] > 0.015);
  const rings = zs.map((z) => carRing(P, z, lod)), NR = rings[0].length, pos = [], idx = [];
  rings.forEach((rg, i) => rg.forEach(([x, y]) => pos.push(x, y, zs[i])));
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < NR; j++) { const a = i * NR + j, b = i * NR + ((j + 1) % NR), c = (i + 1) * NR + j, d = (i + 1) * NR + ((j + 1) % NR); idx.push(a, c, b, b, c, d); }
  // 고리 안 몇 번째 점인지 (양쪽 대칭: 0 바닥 가운데 → 지붕 가운데). 옆 유리를 줄 단위로 또렷하게 고르는 데 쓴다
  const half = (NR + 2) / 2 - 1, rows = []; rings.forEach(() => { for (let j = 0; j < NR; j++) rows.push(j <= half ? j : NR - j); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('row', new THREE.Float32BufferAttribute(rows, 1)); g.setIndex(idx); g.computeVertexNormals();
  // 바깥을 보게 (옆 가운데 법선이 +x 여야)
  const mid = Math.floor(rings.length / 2) * NR + 3; if (g.attributes.normal.getX(mid) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  // 앞 · 뒤 면: 평평하게 (따로 꼭짓점)
  const caps = []; for (const [ri, sgn] of [[0, -1], [rings.length - 1, 1]]) { const rg = rings[ri], z = zs[ri], cy = rg.reduce((a, p) => a + p[1], 0) / NR, cp = [0, cy, z]; const P2 = []; for (let j = 0; j < NR; j++) { const p = rg[j], q = rg[(j + 1) % NR]; if (sgn > 0) P2.push(...cp, p[0], p[1], z, q[0], q[1], z); else P2.push(...cp, q[0], q[1], z, p[0], p[1], z); } const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); cg.computeVertexNormals(); if (cg.attributes.normal.getZ(0) * sgn < 0) { const a = cg.attributes.position.array; for (let t = 0; t < a.length; t += 9) for (let q = 0; q < 3; q++) { const s = a[t + 3 + q]; a[t + 3 + q] = a[t + 6 + q]; a[t + 6 + q] = s; } cg.computeVertexNormals(); } caps.push(cg); }
  return { body: g, caps };
}
// 몸통 삼각형 색: 유리 · 기둥 · 바퀴 집 · 아래 · 도색
function carPaint(P, lod = true) {
  // 앞 문 유리는 앞 유리 기둥(A) 밑까지 이어진다
  const glass = '#18222c', dloF = Math.max(P.dlo[1], P.ws[1] - 0.22);
  // 옆 유리 줄: 가까운 것은 고리 점 5 ~ 6(창 아랫선 위 ~ 지붕선 아래), 먼 것은 2 ~ 3
  const g0 = lod ? 5 : 2, g1 = lod ? 6 : 3;
  return (c, n, rows) => {
    if (n.y < -0.55) return ['#1b1c1f', 0];
    const side = Math.abs(n.x) > 0.55, top = topAt(P, c.z);
    if (P.clad && side && c.y < botAt(P, c.z) + 0.16) return ['#2b2d31', 0];
    const inBand = rows ? rows.every((r) => r >= g0 && r <= g1) : c.y < top - 0.04;
    if (c.y > P.belt + 0.03 && (!side || inBand)) {
      if (side) { if (c.z > P.dlo[0] && c.z < dloF && !(P.pillars || []).some((pz) => Math.abs(c.z - pz) < (P.pw ?? 0.065))) return [glass, VK.glass]; if (P.blackPillar && c.z > P.dlo[0] - 0.3 && c.z < dloF) return ['#121316', 0]; }
      else if (n.y < 0.93) { const hwTop = halfW(P, c.z) * (P.tumble ?? 0.8); if (c.z > P.ws[0] - 0.02 && c.z < P.ws[1] && Math.abs(c.x) < hwTop * 0.9) return [glass, VK.glass]; if (c.z > P.rg[0] && c.z < P.rg[1] + 0.02 && Math.abs(c.x) < hwTop * 0.8) return [glass, VK.glass]; }
      else if (P.roofBlack) return ['#15161a', 0];
    }
    return ['#ffffff', VK.paint];
  };
}
// 승용차 한 대: 몸통 + 앞 · 뒤 얼굴(등 · 그릴 · 번호판) + 거울 · 손잡이 · 바퀴 + 종류별 지붕 물건
function buildCar(P, lod) {
  const B = new Build(), { body, caps } = carLoft(P, lod), paint = carPaint(P, lod);
  B.addPainted(body, paint); for (const cg of caps) B.addPainted(cg, (c, n) => (c.y < botAt(P, c.z) + 0.05 ? ['#1b1c1f', 0] : ['#ffffff', VK.paint]));
  const zF = P.L / 2 + 0.004, zR = -P.L / 2 - 0.004, hwF = halfW(P, P.L / 2), hwR = halfW(P, -P.L / 2), yN = topAt(P, P.L / 2), yT = topAt(P, -P.L / 2), yb = botAt(P, P.L / 2);
  // 앞: 그릴(가운데 어두운 판) · 전조등(가로로 가늘게, 차마다 모양) · 아래 공기 구멍 · 번호판
  const hlY = yN - (P.hlDrop ?? 0.1), hlW = P.hlW ?? Math.min(0.42, hwF * 0.55), hlH = P.hlH ?? 0.09;
  B.add(new THREE.BoxGeometry(P.grilleW ?? hwF * 0.9, P.grilleH ?? 0.16, 0.02), P.grille ?? '#16171a', 0, T(0, hlY - (P.grilleDrop ?? 0.08), zF));
  if (lod && P.grilleBars !== false) for (let i = 0; i < 4; i++) B.add(new THREE.BoxGeometry((P.grilleW ?? hwF * 0.9) * 0.94, 0.008, 0.012), '#5d6168', 0, T(0, hlY - (P.grilleDrop ?? 0.08) - 0.06 + i * 0.04, zF + 0.012));
  for (const s of [-1, 1]) {
    const hx = s * (hwF - hlW / 2 - 0.02);
    B.add(new THREE.BoxGeometry(hlW, hlH, 0.03), '#fff6e2', VK.head, T(hx, hlY, zF + 0.004, 0, 0, s * (P.hlTilt ?? 0.06)));
    if (lod) { B.add(new THREE.BoxGeometry(hlW * 0.9, 0.018, 0.012), '#e8f4ff', VK.head, T(hx, hlY - hlH / 2 - 0.02, zF + 0.018)); B.add(new THREE.BoxGeometry(0.1, 0.035, 0.03), '#ffb020', s > 0 ? VK.blinkL : VK.blinkR, T(s * (hwF - 0.04), hlY - 0.005, zF - 0.01)); }
    // 옆으로 감싼 등 끝
    B.add(new THREE.BoxGeometry(0.03, hlH * 0.9, 0.18), '#fff6e2', VK.head, T(s * (hwF + (P.W / 2 - hwF) * 0.55), hlY, P.L / 2 - 0.1));
  }
  B.add(new THREE.BoxGeometry(hwF * 1.2, 0.1, 0.02), '#202124', 0, T(0, yb + 0.14, zF));
  // 뒤: 후미등 (가로 한 줄로 이어진 것 · 양쪽 따로) · 깜빡이 · 번호판 · 반사판
  const tlY = yT - (P.tlDrop ?? 0.09), tlH = P.tlH ?? 0.1;
  if (P.tlBar) B.add(new THREE.BoxGeometry(hwR * 2 - 0.1, 0.03, 0.02), '#ff2a1a', VK.tail, T(0, tlY + tlH * 0.2, zR - 0.003));
  for (const s of [-1, 1]) {
    const tw = P.tlW ?? 0.38, tx = s * (hwR - tw / 2 - 0.02);
    B.add(new THREE.BoxGeometry(tw, tlH, 0.03), '#d8221a', VK.tail, T(tx, tlY, zR, 0, 0, -s * 0.04));
    if (lod) B.add(new THREE.BoxGeometry(tw * 0.35, tlH * 0.45, 0.012), '#ffa018', s > 0 ? VK.blinkL : VK.blinkR, T(s * (hwR - tw * 0.2 - 0.03), tlY - tlH * 0.12, zR - 0.02));
    B.add(new THREE.BoxGeometry(0.03, tlH * 0.85, 0.16), '#d8221a', VK.tail, T(s * (hwR + (P.W / 2 - hwR) * 0.55), tlY, -P.L / 2 + 0.09));
    if (lod) B.add(new THREE.BoxGeometry(0.12, 0.03, 0.01), '#7a1410', 0, T(s * (hwR - 0.12), botAt(P, -P.L / 2) + 0.17, zR));
  }
  // 높은 곳 제동등 (뒤 유리 위)
  if (lod) B.add(new THREE.BoxGeometry(0.34, 0.025, 0.02), '#ff2a1a', VK.tail, T(0, P.hmsl ?? (topAt(P, P.rg[0]) + 0.02), P.rg[0] - 0.01, -0.5));
  if (lod) { B.plate(T(0, yb + (P.plateYF ?? 0.26), zF + 0.012)); B.plate(T(0, P.plateYR ?? tlY - 0.24, zR - 0.012, 0, Math.PI)); }
  // 옆 거울 (도색 + 아래 깜빡이) · 문 손잡이 (크롬)
  const mz = Math.max(P.dlo[1], P.ws[1] - 0.22) - 0.08, my = P.belt + 0.07, mw = halfW(P, mz);
  for (const s of [-1, 1]) {
    B.add(new RoundedBoxGeometry(0.2, 0.12, 0.09, 1, 0.03), '#ffffff', VK.paint, T(s * (mw + 0.12), my, mz, 0, s * 0.15, 0));
    if (lod) { B.add(new THREE.BoxGeometry(0.14, 0.025, 0.06), '#1a1a1c', 0, T(s * (mw + 0.04), my - 0.04, mz)); B.add(new THREE.BoxGeometry(0.1, 0.015, 0.02), '#ffb020', s > 0 ? VK.blinkL : VK.blinkR, T(s * (mw + 0.15), my - 0.055, mz + 0.02)); B.add(new THREE.PlaneGeometry(0.15, 0.09), '#2e3a45', VK.glass, T(s * (mw + 0.13), my, mz - 0.046, 0, Math.PI)); }
    if (lod) for (const hz of P.handles || []) B.add(new RoundedBoxGeometry(0.03, 0.03, 0.17, 1, 0.012), '#c9cdd2', 0, T(s * (halfW(P, hz) + 0.005), P.belt - 0.09, hz));
  }
  // 바퀴
  // 바퀴 집 (몸통 옆에 어두운 반원, SUV 는 검은 테두리) · 바퀴는 몸통 밖으로 조금 나오게
  for (const s of [-1, 1]) for (const wz of [P.wheel.zf, P.wheel.zr]) {
    const r = P.wheel.r, w = P.wheel.w ?? 0.22, hw = halfW(P, wz), seg = lod ? 20 : 8;
    if (P.clad) B.add(new THREE.CircleGeometry(r + 0.15, seg, 0, Math.PI), '#2b2d31', 0, T(s * (hw + 0.002), r, wz, 0, s * Math.PI / 2));
    B.add(new THREE.CircleGeometry(r + 0.07, seg, 0, Math.PI), '#0b0b0d', 0, T(s * (hw + 0.004), r, wz, 0, s * Math.PI / 2));
    wheel(B, s * (hw - w / 2 + 0.035), wz, r, w, lod, P.wheelOpt);
  }
  P.extra?.(B, lod, P);
  return B.done();
}

// ---------- 상자형 몸통 (버스 · 트럭 짐칸 · 승합 높은 지붕) ----------
// 칸 나눈 둥근 상자: 면을 cuts(창 · 문 · 띠 경계)에서 잘라 칸마다 색을 고를 수 있게, 모서리는 반지름 r 로 둥글게
//   cuts: { x: [...], y: [바닥에서 잰 높이...], z: [...] }
export function gridBox(w, h, d, r, cuts = {}, fine = true) {
  const half = [w / 2, h / 2, d / 2], key = ['x', 'y', 'z'];
  const axes = half.map((a, i) => { const rr = Math.min(r, a * 0.95), set = new Set([-a, a]); for (const t of fine ? [0.134, 0.5, 1] : [1]) { set.add(-a + rr * t); set.add(a - rr * t); } for (let c of cuts[key[i]] || []) { if (i === 1) c -= a; if (c > -a + rr && c < a - rr) set.add(c); } return [...set].sort((p, q) => p - q); });
  const inner = half.map((a) => a - Math.min(r, a * 0.95)), rr3 = half.map((a) => Math.min(r, a * 0.95)), P = [], N = [];
  const put = (p, fn) => { const c = p.map((v, i) => clamp(v, -inner[i], inner[i])), dv = p.map((v, i) => v - c[i]), l = Math.hypot(...dv); if (l > 1e-6) { const rr = Math.min(...rr3); P.push(c[0] + (dv[0] / l) * rr, c[1] + (dv[1] / l) * rr, c[2] + (dv[2] / l) * rr); N.push(dv[0] / l, dv[1] / l, dv[2] / l); } else { P.push(...p); N.push(...fn); } };
  for (const [A, U, V] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) for (const sg of [-1, 1]) {
    const us = axes[U], vs = axes[V], fn = [0, 0, 0]; fn[A] = sg;
    const at = (i, j) => { const p = [0, 0, 0]; p[A] = sg * half[A]; p[U] = us[i]; p[V] = vs[j]; return p; };
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) { const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1); const tri = sg > 0 ? [a, b, c, a, c, e] : [a, c, b, a, e, c]; for (const p of tri) put(p, fn); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g;
}
function rbox(B, w, h, d, r, x, y, z, fn, seg = 2, cuts = {}) { const g = gridBox(w, h, d, r, cuts, seg > 1); if (typeof fn === 'function') return B.addPainted(g, (c, n) => fn(c.x - x, c.y - y + h / 2, c.z - z, n), T(x, y, z)); return B.add(g, fn, fn === '#ffffff' ? VK.paint : 0, T(x, y, z)); }

// 트럭 머리(캡오버: 엔진이 운전석 밑): 앞 유리 · 문 유리 · 그릴 · 등
function cabOver(B, lod, o) {
  const { W, H, D, z0, y0 } = o, zc = z0 - D / 2, yc = y0 + H / 2, col = o.color ?? '#ffffff', kind = o.color ? 0 : VK.paint;
  rbox(B, W, H, D, o.r ?? 0.12, 0, yc, zc, (x, y, z, n) => {
    if (n.y < -0.5) return ['#1a1a1c', 0];
    if (n.z > 0.6 && y > H * 0.52 && y < H - 0.08 && Math.abs(x) < W / 2 - 0.1) return ['#18222c', VK.glass];
    if (Math.abs(n.x) > 0.6 && y > H * 0.55 && y < H - 0.1 && z > -D / 2 + 0.25 && z < D / 2 - 0.12) return ['#18222c', VK.glass];
    if (n.z > 0.6 && y < H * 0.3 && y > 0.1) return [o.grille ?? '#1e1f22', 0];
    if (n.y > 0.9 && o.roof) return [o.roof, 0];
    return [col, kind];
  }, lod ? 3 : 1, { x: [-W / 2 + 0.1, W / 2 - 0.1], y: [0.1, H * 0.3, H * 0.52, H * 0.55, H - 0.1, H - 0.08], z: [-D / 2 + 0.25, D / 2 - 0.12] });
  const zF = z0 + 0.004;
  for (const s of [-1, 1]) {
    B.add(new THREE.BoxGeometry(0.3, 0.13, 0.03), '#fff6e2', VK.head, T(s * (W / 2 - 0.22), y0 + H * 0.33, zF));
    B.add(new THREE.BoxGeometry(0.09, 0.07, 0.03), '#ffb020', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.05), y0 + H * 0.33, zF - 0.02));
    // 큰 옆 거울 (팔 + 거울)
    B.add(new THREE.BoxGeometry(0.03, 0.03, 0.3), '#1a1a1c', 0, T(s * (W / 2 + 0.08), y0 + H * 0.66, z0 - 0.25, 0, -s * 0.5));
    B.add(new RoundedBoxGeometry(0.06, 0.3, 0.17, 1, 0.02), '#1a1a1c', 0, T(s * (W / 2 + 0.17), y0 + H * 0.6, z0 - 0.1));
    if (lod) B.add(new RoundedBoxGeometry(0.03, 0.03, 0.18, 1, 0.01), '#c9cdd2', 0, T(s * (W / 2 + 0.005), y0 + H * 0.5, zc - D * 0.25));
    // 문 아래 발판
    if (lod) B.add(new THREE.BoxGeometry(0.12, 0.04, 0.42), '#2a2b2f', 0, T(s * (W / 2 - 0.02), y0 - 0.12, zc + 0.15));
  }
  if (lod) B.plate(T(0, y0 + 0.08, zF + 0.01));
  B.add(new THREE.BoxGeometry(W - 0.1, 0.16, 0.12), o.bumper ?? '#2a2b2f', 0, T(0, y0 - 0.02, z0 + 0.02));
}
// 사다리꼴 차대 (트럭 아래 검은 틀) + 연료통
function chassis(B, W, z0, z1, y, lod) { for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.1, 0.18, z1 - z0), '#151517', 0, T(s * W * 0.32, y, (z0 + z1) / 2)); if (lod) B.add(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10).rotateZ(Math.PI / 2), '#8f949a', 0, T(-W * 0.36, y - 0.08, (z0 + z1) / 2 + 0.3)); }
// 경광등 막대 (빨강 · 파랑 반씩, 시간에 맞춰 번갈아)
function lightbar(B, w, y, z, lod, colors = ['#ff2a2a', '#2a5bff']) { B.add(new RoundedBoxGeometry(w + 0.06, 0.07, 0.24, 1, 0.03), '#2a2b2f', 0, T(0, y, z)); for (const s of [-1, 1]) B.add(new RoundedBoxGeometry(w / 2 - 0.02, 0.09, 0.22, lod ? 2 : 1, 0.035), s > 0 ? colors[0] : colors[1], s > 0 ? VK.sirenR : VK.sirenB, T(s * (w / 4 + 0.01), y + 0.06, z)); }
// 운전자 · 탄 사람이 없는 차 안: 앞자리 머리받침만 살짝 (유리가 불투명이라 보이진 않는다)

// ---------- 오토바이 ----------
function bike(B, lod, o) {
  const r = o.r, wb = o.wb, zf = wb / 2, zr = -wb / 2, seg = lod ? 16 : 8;
  for (const z of [zf, zr]) { const t = new THREE.TorusGeometry(r - 0.05, 0.05, 6, seg); t.rotateY(Math.PI / 2); B.add(t, '#131315', 0, T(0, r, z)); B.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.05, seg).rotateZ(Math.PI / 2), o.rim ?? '#3a3d42', 0, T(0, r, z)); }
  // 앞 포크 (기울어진 두 막대) · 핸들
  for (const s of [-1, 1]) B.add(new THREE.CylinderGeometry(0.022, 0.022, 0.75, 6), '#a9aeb4', 0, T(s * 0.08, r + 0.33, zf - 0.12, -0.42));
  B.add(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6).rotateZ(Math.PI / 2), '#202124', 0, T(0, o.barY, zf - 0.27));
  for (const s of [-1, 1]) B.add(new THREE.CylinderGeometry(0.026, 0.026, 0.12, 6).rotateZ(Math.PI / 2), '#1a1a1a', 0, T(s * 0.32, o.barY, zf - 0.27));
  o.body(B, lod);
  // 탄 사람 (젤리 곰 · 헬멧에 귀): 몸통 · 팔 · 다리 · 헬멧
  if (o.rider) {
    const R = o.rider, jk = R.jacket, hip = R.hip;
    B.add(new THREE.CapsuleGeometry(0.17, 0.3, 4, lod ? 10 : 6), jk, 0, T(0, hip + 0.3, R.z, R.lean));
    B.add(new THREE.SphereGeometry(0.19, lod ? 14 : 8, lod ? 10 : 6), R.helmet, 0, T(0, hip + 0.7, R.z + Math.sin(R.lean) * 0.4 + 0.02));
    if (lod) { B.add(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), '#1b2733', VK.glass, T(0, hip + 0.68, R.z + Math.sin(R.lean) * 0.4 + 0.08, 1.45)); for (const s of [-1, 1]) B.add(new THREE.SphereGeometry(0.06, 8, 6), R.helmet, 0, T(s * 0.13, hip + 0.86, R.z + Math.sin(R.lean) * 0.4)); }
    for (const s of [-1, 1]) {
      const sx = s * 0.18, sy = hip + 0.5, sz = R.z + Math.sin(R.lean) * 0.3, hx = s * 0.3, hy = o.barY, hz = zf - 0.27, dx = hx - sx, dy = hy - sy, dz = hz - sz, L = Math.hypot(dx, dy, dz);
      const am = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(dx, dy, dz), new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      B.add(new THREE.CapsuleGeometry(0.055, Math.max(0.05, L - 0.1), 3, 6), jk, 0, new THREE.Matrix4().makeTranslation((sx + hx) / 2, (sy + hy) / 2, (sz + hz) / 2).multiply(am));
      B.add(new THREE.CapsuleGeometry(0.07, 0.34, 3, 6), R.pants, 0, T(s * 0.15, hip + 0.02, R.z + 0.2, Math.PI / 2 - 0.25));
      B.add(new THREE.CapsuleGeometry(0.06, 0.28, 3, 6), R.pants, 0, T(s * 0.17, hip - 0.18, R.z + 0.38, 0.35));
      B.add(new RoundedBoxGeometry(0.1, 0.07, 0.2, 1, 0.03), '#1a1a1a', 0, T(s * 0.17, R.foot, R.z + 0.42));
    }
  }
  // 등
  B.add(new THREE.SphereGeometry(0.07, 10, 8), '#fff6e2', VK.head, T(0, o.hlY, zf - 0.1));
  B.add(new THREE.BoxGeometry(0.12, 0.05, 0.03), '#d8221a', VK.tail, T(0, o.tlY, o.tlZ));
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(0.05, 0.03, 0.05), '#ffb020', s > 0 ? VK.blinkL : VK.blinkR, T(s * 0.16, o.hlY - 0.04, zf - 0.13)); B.add(new THREE.BoxGeometry(0.05, 0.03, 0.05), '#ffb020', s > 0 ? VK.blinkL : VK.blinkR, T(s * 0.12, o.tlY, o.tlZ + 0.04)); }
  if (lod) B.plate(T(0, o.tlY - 0.12, o.tlZ - 0.02, -0.2, Math.PI), 0.21, 0.1);
}

// ---------- 차 종류 ----------
//   L · W · H: 실제 차 크기(m). mass(kg) · acc(m/s²) · vmax(m/s) · turn(최대 조향 rad) · brake(m/s²)
//   seats: 자리 [이름, x, 방석 높이, z] (8-27-4) · eye: 운전석 눈 위치
const sedanTop = (L, H, o = {}) => { const h2 = L / 2; return [[-h2, o.tail ?? 0.72], [-h2 + 0.08, o.deck ?? 0.98], [-h2 + 0.32, (o.deck ?? 0.98) + 0.04], [o.rg0 ?? -h2 + 0.95, (o.deck ?? 0.98) + 0.06], [o.rr ?? -0.62, H], [o.rf ?? 0.48, H], [o.ws ?? 1.3, o.cowl ?? 1.0], [h2 - 0.16, o.nose ?? 0.84], [h2, o.nose0 ?? 0.7]]; };
const hatchTop = (L, H, o = {}) => { const h2 = L / 2; return [[-h2, 0.62], [-h2 + 0.04, 0.95], [-h2 + 0.1, H - 0.12], [-h2 + (o.rr ?? 0.32), H], [o.rf ?? 0.25, H], [o.ws ?? 1.05, o.cowl ?? 0.98], [h2 - 0.14, o.nose ?? 0.82], [h2, o.nose0 ?? 0.68]]; };
const suvTop = (L, H, o = {}) => { const h2 = L / 2; return [[-h2, o.tail ?? 0.75], [-h2 + 0.03, 1.05], [-h2 + 0.12, H - 0.1], [-h2 + 0.32, H], [o.rf ?? 0.45, H - 0.02], [o.ws ?? 1.35, o.cowl ?? 1.12], [h2 - 0.2, o.nose ?? 1.0], [h2, o.nose0 ?? 0.78]]; };
const vanTop = (L, H, o = {}) => { const h2 = L / 2; return [[-h2, 0.7], [-h2 + 0.03, 1.0], [-h2 + 0.08, H - 0.08], [-h2 + 0.25, H], [o.rf ?? h2 - 1.25, H], [o.ws ?? h2 - 0.6, o.cowl ?? 1.15], [h2 - 0.12, o.nose ?? 0.95], [h2, 0.72]]; };
const S4 = (zf, zr, xf = 0.37, xr = 0.38, yf = 0.48, yr = 0.5) => [['운전석', xf, yf, zf, true], ['조수석', -xf, yf, zf], ['뒷자리 왼쪽', xr, yr, zr], ['뒷자리 가운데', 0, yr + 0.03, zr], ['뒷자리 오른쪽', -xr, yr, zr]];
const taxiSign = (txt, col) => (B, lod, P) => { const y = P.H + 0.01, z = (P.ws[0] + P.rg[1]) / 2 - 0.05; B.add(new RoundedBoxGeometry(0.62, 0.2, 0.26, 2, 0.06), col, VK.sign, T(0, y + 0.1, z)); for (const s of [1, -1]) B.text(txt, 0.5, 0.13, T(0, y + 0.1, z + s * 0.132, 0, s > 0 ? 0 : Math.PI), true); };
const roofRack = (B, lod, P) => { if (!lod) return; for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.04, 0.05, P.ws[0] - P.rg[1] + 0.3), '#2a2b2f', 0, T(s * P.W * 0.32, P.H + 0.025, (P.ws[0] + P.rg[1]) / 2)); };

export const TYPES = {
  // 경차 (박스형 · 둥근형): 짧고 높다
  light: { name: '경차', cat: 'car', L: 3.6, W: 1.6, H: 1.5, gc: 0.15, belt: 0.92, top: hatchTop(3.6, 1.5, { rf: 0.15, ws: 0.95, cowl: 0.92, nose: 0.8 }), ws: [0.15, 0.95], rg: [-1.72, -1.5], dlo: [-1.48, 0.12], pillars: [-0.45], wheel: { r: 0.3, zf: 1.18, zr: -1.18, track: 1.4, w: 0.18 }, ohF: 0.62, ohR: 0.5, tumble: 0.84, rf: 0.3, rr: 0.18, hlW: 0.3, hlH: 0.14, handles: [-0.15, -0.95], tlW: 0.16, tlH: 0.32, tlDrop: 0.42, plateYR: 0.55, mass: 900, acc: 2.6, vmax: 33, turn: 0.62, brake: 7, seats: S4(0.15, -0.65, 0.33, 0.33, 0.45, 0.48).filter((s) => s[0] !== '뒷자리 가운데'), eye: [0.33, 1.2, 0.0] },
  hatch: { name: '소형 해치백', cat: 'car', L: 4.05, W: 1.78, H: 1.45, gc: 0.15, belt: 0.92, top: hatchTop(4.05, 1.45, { rr: 0.42, rf: 0.2, ws: 1.08 }), ws: [0.2, 1.08], rg: [-1.98, -1.6], dlo: [-1.58, 0.17], pillars: [-0.55], wheel: { r: 0.32, zf: 1.32, zr: -1.3, track: 1.55 }, ohF: 0.72, ohR: 0.6, handles: [-0.2, -1.1], tlW: 0.3, tlH: 0.12, tlDrop: 0.4, plateYR: 0.6, mass: 1200, acc: 3.0, vmax: 46, turn: 0.6, brake: 8, seats: S4(0.2, -0.75), eye: [0.37, 1.13, -0.02] },
  sedanM: { name: '중형 세단', cat: 'car', L: 4.9, W: 1.86, H: 1.45, gc: 0.15, belt: 0.95, top: sedanTop(4.9, 1.45), ws: [0.48, 1.3], rg: [-1.5, -0.62], dlo: [-1.0, 0.44], pillars: [-0.12], wheel: { r: 0.33, zf: 1.5, zr: -1.35, track: 1.6 }, ohF: 0.95, ohR: 1.05, handles: [0.05, -0.85], tlBar: true, tlW: 0.42, mass: 1500, acc: 3.2, vmax: 55, turn: 0.58, brake: 8.5, seats: S4(0.35, -0.6), eye: [0.37, 1.13, 0.15] },
  sedanL: { name: '대형 세단', cat: 'car', L: 5.1, W: 1.9, H: 1.48, gc: 0.15, belt: 0.98, top: sedanTop(5.1, 1.48, { rr: -0.75, rf: 0.42, ws: 1.32, nose: 0.88, nose0: 0.74 }), ws: [0.42, 1.32], rg: [-1.62, -0.75], dlo: [-1.12, 0.38], pillars: [-0.2], wheel: { r: 0.35, zf: 1.58, zr: -1.42, track: 1.63, w: 0.24 }, ohF: 0.98, ohR: 1.1, handles: [0.0, -0.95], grilleW: 0.8, grilleH: 0.22, grille: '#1b1c1f', tlBar: true, tlW: 0.46, wheelOpt: { spokes: 0 }, mass: 1800, acc: 3.4, vmax: 60, turn: 0.55, brake: 9, seats: S4(0.3, -0.7), eye: [0.38, 1.15, 0.1] },
  suvS: { name: '소형 SUV', cat: 'car', L: 4.3, W: 1.8, H: 1.6, gc: 0.2, belt: 1.02, top: suvTop(4.3, 1.6, { rf: 0.35, ws: 1.2, cowl: 1.05, nose: 0.95 }), ws: [0.35, 1.2], rg: [-2.12, -1.83], dlo: [-1.75, 0.32], pillars: [-0.38, -1.38], wheel: { r: 0.34, zf: 1.32, zr: -1.3, track: 1.57 }, ohF: 0.82, ohR: 0.75, clad: true, roofRails: true, handles: [-0.05, -0.95], tlW: 0.32, tlDrop: 0.35, plateYR: 0.62, mass: 1400, acc: 2.9, vmax: 47, turn: 0.58, brake: 8, seats: S4(0.25, -0.7, 0.37, 0.38, 0.6, 0.62), eye: [0.37, 1.27, 0.05], extra: roofRack },
  suvM: { name: '중형 SUV', cat: 'car', L: 4.7, W: 1.9, H: 1.72, gc: 0.2, belt: 1.08, top: suvTop(4.7, 1.72), ws: [0.45, 1.35], rg: [-2.32, -2.03], dlo: [-1.95, 0.42], pillars: [-0.35, -1.45], wheel: { r: 0.37, zf: 1.45, zr: -1.4, track: 1.64, w: 0.24 }, ohF: 0.88, ohR: 0.9, clad: true, roofRails: true, handles: [0.05, -1.0], tlW: 0.38, tlDrop: 0.36, plateYR: 0.68, mass: 1800, acc: 3.0, vmax: 52, turn: 0.55, brake: 8, seats: S4(0.3, -0.75, 0.38, 0.4, 0.62, 0.66), eye: [0.38, 1.36, 0.1], extra: roofRack },
  suvL: { name: '대형 SUV', cat: 'car', L: 5.0, W: 1.98, H: 1.78, gc: 0.22, belt: 1.12, top: suvTop(5.0, 1.78, { rf: 0.5, ws: 1.45, cowl: 1.18, nose: 1.06, nose0: 0.82 }), ws: [0.5, 1.45], rg: [-2.47, -2.18], dlo: [-2.1, 0.47], pillars: [-0.3, -1.35], wheel: { r: 0.39, zf: 1.5, zr: -1.5, track: 1.7, w: 0.26 }, ohF: 0.95, ohR: 0.95, clad: true, roofRails: true, handles: [0.1, -0.95], grilleW: 0.95, grilleH: 0.28, tlBar: true, tlW: 0.4, tlDrop: 0.36, plateYR: 0.7, mass: 2200, acc: 3.0, vmax: 52, turn: 0.52, brake: 8, seats: [...S4(0.4, -0.55, 0.39, 0.4, 0.65, 0.68), ['셋째 줄 왼쪽', 0.3, 0.7, -1.45], ['셋째 줄 오른쪽', -0.3, 0.7, -1.45]], eye: [0.39, 1.42, 0.2], extra: roofRack },
  minivan: { name: '미니밴', cat: 'car', L: 5.15, W: 1.99, H: 1.74, gc: 0.17, belt: 1.05, top: vanTop(5.15, 1.74, { rf: 0.8, ws: 1.72, cowl: 1.12, nose: 0.98 }), ws: [0.8, 1.72], rg: [-2.53, -2.33], dlo: [-2.25, 0.77], pillars: [0.0, -1.2], pw: 0.08, blackPillar: true, wheel: { r: 0.36, zf: 1.6, zr: -1.5, track: 1.72, w: 0.24 }, ohF: 0.95, ohR: 1.0, handles: [0.5, -0.35], tlW: 0.3, tlH: 0.36, tlDrop: 0.3, plateYR: 0.62, mass: 2100, acc: 2.7, vmax: 50, turn: 0.55, brake: 8, seats: [['운전석', 0.4, 0.55, 0.6, true], ['조수석', -0.4, 0.55, 0.6], ['둘째 줄 왼쪽', 0.4, 0.58, -0.35], ['둘째 줄 오른쪽', -0.4, 0.58, -0.35], ['셋째 줄 왼쪽', 0.42, 0.6, -1.35], ['셋째 줄 가운데', 0, 0.62, -1.35], ['셋째 줄 오른쪽', -0.42, 0.6, -1.35]], eye: [0.4, 1.35, 0.4] },
  taxiO: { name: '주황 택시', cat: 'car', base: 'sedanM', commercial: true, colors: [['#e8853a', 1]], extra: taxiSign(TEXT.taxi, '#fff4dc') },
  taxiW: { name: '흰 택시', cat: 'car', base: 'sedanM', commercial: true, colors: [['#f2f3f1', 1]], extra: taxiSign(TEXT.taxi, '#fff4dc') },
  taxiB: { name: '검은 모범택시', cat: 'car', base: 'sedanL', commercial: true, colors: [['#131417', 1]], extra: taxiSign(TEXT.deluxe, '#ffd23a') },
  police: { name: '경찰차', cat: 'car', base: 'sedanM', colors: [['#f4f5f6', 1]], siren: 0.25, extra: (B, lod, P) => { lightbar(B, 1.1, P.H + 0.04, (P.ws[0] + P.rg[1]) / 2, lod); for (const s of [-1, 1]) { B.add(new THREE.PlaneGeometry(3.2, 0.2), '#173a7a', 0, T(s * (P.W / 2 + 0.004), 0.62, 0, 0, s * Math.PI / 2)); B.add(new THREE.PlaneGeometry(3.2, 0.045), '#f2c230', 0, T(s * (P.W / 2 + 0.006), 0.5, 0, 0, s * Math.PI / 2)); if (lod) B.text(TEXT.police, 0.8, 0.2, T(s * (P.W / 2 + 0.008), 0.8, -0.2, 0, s * Math.PI / 2)); } } },
  // 1톤 트럭 (캡오버): 짐칸 · 탑차 · 택배 탑차
  truckS: { name: '1톤 트럭', cat: 'truck', commercial: true, L: 5.1, W: 1.74, H: 1.97, mass: 1900, acc: 2.2, vmax: 38, turn: 0.6, brake: 7, seats: [['운전석', 0.42, 0.98, 1.6, true], ['조수석', -0.42, 0.98, 1.6]], eye: [0.42, 1.65, 1.62], colors: [['#f4f5f6', 5], ['#2f5fa8', 3], ['#b9bec4', 2]], build: (lod) => truckS(lod, 'open') },
  truckBox: { name: '1톤 탑차', cat: 'truck', commercial: true, L: 5.1, W: 1.74, H: 2.75, mass: 2100, acc: 2.0, vmax: 36, turn: 0.6, brake: 6.5, seats: [['운전석', 0.42, 0.98, 1.6, true], ['조수석', -0.42, 0.98, 1.6]], eye: [0.42, 1.65, 1.62], colors: [['#f4f5f6', 5], ['#2f5fa8', 3], ['#b9bec4', 2]], build: (lod) => truckS(lod, 'box') },
  parcel: { name: '택배 탑차', cat: 'truck', commercial: true, L: 5.1, W: 1.74, H: 2.75, mass: 2100, acc: 2.0, vmax: 36, turn: 0.6, brake: 6.5, seats: [['운전석', 0.42, 0.98, 1.6, true], ['조수석', -0.42, 0.98, 1.6]], eye: [0.42, 1.65, 1.62], colors: [['#2a8a4a', 1], ['#d63a2a', 1], ['#1f4f9a', 1], ['#e8a01c', 1]], build: (lod) => truckS(lod, 'parcel') },
  // 승합차 (12인승 · 회사 · 학원)
  van: { name: '승합차', cat: 'car', L: 5.15, W: 1.92, H: 1.93, gc: 0.2, belt: 1.12, top: vanTop(5.15, 1.93, { rf: 1.25, ws: 1.95, cowl: 1.18, nose: 1.0 }), ws: [1.25, 1.95], rg: [-2.53, -2.38], dlo: [-2.3, 1.22], pillars: [0.55, -0.55, -1.5], pw: 0.07, blackPillar: true, wheel: { r: 0.35, zf: 1.78, zr: -1.4, track: 1.68, w: 0.23 }, ohF: 0.8, ohR: 1.1, tumble: 0.9, handles: [1.0, -0.2], tlW: 0.24, tlH: 0.32, tlDrop: 0.36, plateYR: 0.62, mass: 2300, acc: 2.4, vmax: 44, turn: 0.55, brake: 7.5, colors: [['#f2f3f1', 5], ['#b9bec4', 3], ['#141518', 2], ['#f2c230', 1]], seats: [['운전석', 0.42, 0.6, 1.0, true], ['조수석', -0.42, 0.6, 1.0], ['둘째 줄 왼쪽', 0.45, 0.62, 0.05], ['둘째 줄 가운데', 0, 0.62, 0.05], ['둘째 줄 오른쪽', -0.45, 0.62, 0.05], ['셋째 줄 왼쪽', 0.45, 0.64, -0.9], ['셋째 줄 가운데', 0, 0.64, -0.9], ['셋째 줄 오른쪽', -0.45, 0.64, -0.9]], eye: [0.42, 1.42, 0.85] },
  ambul: { name: '구급차', cat: 'truck', L: 5.9, W: 2.03, H: 2.65, mass: 3200, acc: 2.4, vmax: 40, turn: 0.55, brake: 7, siren: 1, colors: [['#f6f7f8', 1]], seats: [['운전석', 0.45, 0.72, 1.55, true], ['조수석', -0.45, 0.72, 1.55], ['환자 옆 의자', 0.55, 0.85, -0.8], ['뒤 보호자석', -0.55, 0.85, -1.4]], eye: [0.45, 1.5, 1.5], build: (lod) => ambulance(lod) },
  fire: { name: '소방차', cat: 'truck', L: 7.6, W: 2.45, H: 3.1, mass: 12000, acc: 1.3, vmax: 30, turn: 0.5, brake: 5.5, siren: 1, colors: [['#c8161d', 1]], seats: [['운전석', 0.55, 1.3, 2.75, true], ['조수석', -0.55, 1.3, 2.75], ['뒷자리 왼쪽', 0.55, 1.3, 1.95], ['뒷자리 오른쪽', -0.55, 1.3, 1.95]], eye: [0.55, 2.15, 2.75], build: (lod) => fireTruck(lod) },
  mixer: { name: '레미콘', cat: 'truck', commercial: true, L: 9.0, W: 2.49, H: 3.7, mass: 14000, acc: 1.0, vmax: 25, turn: 0.45, brake: 5, colors: [['#e65a1e', 1], ['#2f5fa8', 1], ['#2a8a4a', 1]], seats: [['운전석', 0.6, 1.45, 3.7, true], ['조수석', -0.6, 1.45, 3.7]], eye: [0.6, 2.3, 3.7], build: (lod) => mixer(lod) },
  dump: { name: '덤프트럭', cat: 'truck', commercial: true, L: 8.4, W: 2.49, H: 3.2, mass: 13000, acc: 1.1, vmax: 26, turn: 0.45, brake: 5, colors: [['#f2f3f1', 3], ['#2f5fa8', 2], ['#e8a01c', 2]], seats: [['운전석', 0.6, 1.45, 3.3, true], ['조수석', -0.6, 1.45, 3.3]], eye: [0.6, 2.3, 3.3], build: (lod) => dumpTruck(lod) },
  // 버스: 시내(간선 파랑 · 지선 초록 · 광역 빨강 · 순환 노랑) · 마을 · 관광
  busCity: { name: '시내버스', cat: 'bus', commercial: true, L: 11.0, W: 2.49, H: 3.25, mass: 11000, acc: 1.2, vmax: 22, turn: 0.55, brake: 5, colors: [['#3d5bab', 5], ['#4fa83a', 4], ['#e0312a', 1.2], ['#f2b70a', 0.6]], seats: busSeats(11), eye: [0.75, 1.95, 4.75], build: (lod) => bus(lod, 'city') },
  busTown: { name: '마을버스', cat: 'bus', commercial: true, L: 7.2, W: 2.06, H: 2.75, mass: 6500, acc: 1.5, vmax: 22, turn: 0.6, brake: 5.5, colors: [['#6fb92c', 1]], seats: busSeats(7.2), eye: [0.62, 1.75, 2.9], build: (lod) => bus(lod, 'town') },
  busTour: { name: '관광버스', cat: 'bus', commercial: true, L: 12.0, W: 2.49, H: 3.5, mass: 13000, acc: 1.2, vmax: 28, turn: 0.5, brake: 5, colors: [['#1f4f9a', 1], ['#c8161d', 1], ['#5a2a8a', 1], ['#1b8a7a', 1]], seats: busSeats(12, true), eye: [0.75, 2.4, 5.4], build: (lod) => bus(lod, 'tour') },
  // 오토바이
  scooter: { name: '배달 오토바이', cat: 'bike', L: 1.95, W: 0.72, H: 1.15, mass: 130, acc: 3.2, vmax: 24, turn: 0.75, brake: 7, colors: [['#c8161d', 3], ['#f4f5f6', 2], ['#1a1b1f', 2], ['#2f5fa8', 1]], seats: [['운전석', 0, 0.78, -0.12, true]], eye: [0, 1.45, -0.05], build: (lod, e) => scooter(lod, e) },
  moto: { name: '오토바이', cat: 'bike', L: 2.1, W: 0.8, H: 1.12, mass: 190, acc: 5.5, vmax: 40, turn: 0.7, brake: 8, colors: [['#1a1b1f', 3], ['#c8161d', 2], ['#2f5fa8', 1], ['#e8e9ea', 1]], seats: [['운전석', 0, 0.82, -0.15, true], ['뒷자리', 0, 0.9, -0.5]], eye: [0, 1.42, -0.05], build: (lod, e) => motoBike(lod, e) },
};
for (const [k, t] of Object.entries(TYPES)) { t.key = k; if (t.base) { const b = TYPES[t.base], ex = t.extra; Object.assign(t, { ...b, ...t, extra: ex }); delete t.base; } }

// 버스 자리: 2 + 2 줄, 앞문 · 뒷문 자리는 비움
function busSeats(L, tour = false) {
  const out = [['운전석', 0.75, 0.95, L / 2 - 1.2, true]], F = tour ? 1.2 : 0.36, rows = Math.floor((L - 3.2) / 0.82);
  for (let i = 0; i < rows; i++) { const z = L / 2 - 2.4 - i * 0.82; if (!tour && z > -0.7 && z < 0.6) continue; out.push([`${i + 1}열 왼쪽 창가`, 0.85, F + 0.45, z], [`${i + 1}열 왼쪽 통로`, 0.42, F + 0.45, z]); if (tour || z < -0.7 || z > L / 2 - 2.6) out.push([`${i + 1}열 오른쪽 통로`, -0.42, F + 0.45, z], [`${i + 1}열 오른쪽 창가`, -0.85, F + 0.45, z]); }
  return out;
}

// ---------- 종류별 모양 ----------
function truckS(lod, kind) {
  const B = new Build(), L = 5.1, W = 1.74, zCab = L / 2;
  cabOver(B, lod, { W, H: 1.38, D: 1.62, z0: zCab, y0: 0.58 });
  chassis(B, W, -L / 2 + 0.2, zCab - 0.3, 0.55, lod);
  const bedZ0 = -L / 2, bedZ1 = zCab - 1.68, bedL = bedZ1 - bedZ0, bz = (bedZ0 + bedZ1) / 2;
  if (kind === 'open') {
    // 짐칸: 바닥 + 낮은 알루미늄 문(옆 · 뒤, 세로 골)
    B.add(new THREE.BoxGeometry(W + 0.04, 0.08, bedL), '#4a4d52', 0, T(0, 0.8, bz));
    for (const s of [-1, 1]) { rbox(B, 0.04, 0.4, bedL, 0.01, s * (W / 2 + 0.01), 1.04, bz, (x, y, z, n) => ['#c3c8cd', 0], 1); if (lod) for (let i = 1; i < 6; i++) B.add(new THREE.BoxGeometry(0.012, 0.36, 0.03), '#9aa0a6', 0, T(s * (W / 2 + 0.035), 1.04, bedZ0 + (bedL * i) / 6)); }
    rbox(B, W + 0.06, 0.4, 0.04, 0.01, 0, 1.04, bedZ0 + 0.02, '#c3c8cd', 1);
    rbox(B, W + 0.06, 0.55, 0.05, 0.01, 0, 1.12, bedZ1 - 0.03, '#9aa0a6', 1);
    // 짐 (상자 몇 개)
    if (lod) { B.add(new THREE.BoxGeometry(0.6, 0.45, 0.5), '#b8915a', 0, T(0.4, 1.06, bz + 0.5)); B.add(new THREE.BoxGeometry(0.5, 0.35, 0.45), '#c9a46b', 0, T(-0.35, 1.01, bz - 0.4)); }
  } else {
    // 탑차: 알루미늄 상자 (옆 가로 골 · 뒷문 두 짝)
    const bh = 1.95, by = 0.84 + bh / 2, parcel = kind === 'parcel';
    B.add(new THREE.BoxGeometry(W + 0.08, 0.1, bedL), '#2a2b2f', 0, T(0, 0.8, bz));
    rbox(B, W + 0.12, bh, bedL - 0.04, 0.04, 0, by, bz, (x, y, z, n) => {
      if (parcel && Math.abs(n.x) > 0.6 && y > bh * 0.18 && y < bh * 0.36) return ['#ffffff', VK.paint];
      if (parcel && Math.abs(n.x) > 0.6 && y > bh * 0.36 && y < bh * 0.4) return ['#ffffff', VK.paint2];
      if (n.z < -0.6 && Math.abs(x) < 0.012) return ['#6e737a', 0];
      return [parcel ? '#f6f7f8' : '#e1e5e8', 0];
    }, lod ? 2 : 1, { x: [-0.012, 0.012], y: [bh * 0.18, bh * 0.36, bh * 0.4] });
    if (lod && !parcel) for (let i = 1; i < 7; i++) for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.012, 0.02, bedL - 0.1), '#b0b5ba', 0, T(s * (W / 2 + 0.07), 0.84 + (bh * i) / 7, bz));
    if (lod && parcel) for (const s of [-1, 1]) B.text(TEXT.parcel, 0.9, 0.32, T(s * (W / 2 + 0.065), 0.84 + bh * 0.62, bz - 0.2, 0, s * Math.PI / 2));
    if (lod) for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.03, bh - 0.2, 0.02), '#8a8f95', 0, T(s * 0.3, by, bedZ0 - 0.01));
  }
  // 뒤: 후미등 (범퍼 양쪽 세로) · 번호판 · 깜빡이
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(0.16, 0.24, 0.04), '#d8221a', VK.tail, T(s * (W / 2 - 0.15), 0.62, -L / 2 - 0.03)); B.add(new THREE.BoxGeometry(0.1, 0.08, 0.04), '#ffa018', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.15), 0.44, -L / 2 - 0.03)); }
  B.add(new THREE.BoxGeometry(W, 0.1, 0.08), '#2a2b2f', 0, T(0, 0.48, -L / 2 + 0.02));
  if (lod) B.plate(T(0, 0.62, -L / 2 - 0.03, 0, Math.PI));
  // 바퀴: 앞 하나, 뒤 둘씩 (복륜)
  for (const s of [-1, 1]) { wheel(B, s * 0.72, zCab - 0.62, 0.32, 0.2, lod, { spokes: 0, rim: '#c9cdd2' }); wheel(B, s * 0.68, -0.85, 0.32, 0.2, lod, { spokes: 0, rim: '#c9cdd2' }); wheel(B, s * 0.46, -0.85, 0.32, 0.2, false); }
  return B.done();
}
function ambulance(lod) {
  // 높은 지붕 승합 (보닛이 짧게 나온 모양) · 흰색 + 빨강 · 주황 띠 · 경광등 · 119
  const L = 5.9, W = 2.03;
  const P = { L, W, H: 2.65, gc: 0.2, belt: 1.15, top: [[-L / 2, 0.75], [-L / 2 + 0.03, 1.0], [-L / 2 + 0.06, 2.55], [-L / 2 + 0.2, 2.65], [1.6, 2.65], [1.95, 2.45], [2.25, 1.3], [L / 2 - 0.12, 1.08], [L / 2, 0.75]], ws: [1.95, 2.25], rg: [-2.95, -2.95], dlo: [1.0, 1.95], pillars: [], wheel: { r: 0.37, zf: 1.95, zr: -1.6, track: 1.75, w: 0.24 }, ohF: 0.8, ohR: 1.2, tumble: 0.95, rf: 0.2, rr: 0.1, handles: [1.4], tlW: 0.2, tlH: 0.5, tlDrop: 1.3, plateYR: 0.6, hmsl: 2.55, grilleW: 0.9, grilleH: 0.22, hlDrop: 0.08 };
  P.rg = [-L / 2 - 1, -L / 2 - 1];
  P.extra = (B2, lod2) => {
    for (const s of [-1, 1]) { const x = s * (W / 2 + 0.006); B2.add(new THREE.PlaneGeometry(4.0, 0.2), '#d8141c', 0, T(x, 1.05, -0.6, 0, s * Math.PI / 2)); B2.add(new THREE.PlaneGeometry(4.0, 0.08), '#f07a12', 0, T(x + s * 0.001, 0.9, -0.6, 0, s * Math.PI / 2)); if (lod2) { B2.text(TEXT.ambul, 1.5, 0.36, T(x + s * 0.002, 1.65, -0.9, 0, s * Math.PI / 2)); B2.add(new THREE.PlaneGeometry(0.75, 0.55), '#18222c', VK.glass, T(x + s * 0.002, 1.75, 0.55, 0, s * Math.PI / 2)); } }
    lightbar(B2, 1.3, 2.68, 1.45, lod2); for (const s of [-1, 1]) { B2.add(new THREE.BoxGeometry(0.16, 0.12, 0.06), s > 0 ? '#ff2a2a' : '#2a5bff', s > 0 ? VK.sirenR : VK.sirenB, T(s * 0.85, 2.5, -L / 2 - 0.02)); }
    B2.add(new THREE.PlaneGeometry(1.2, 1.6), '#e8eaec', 0, T(0, 1.7, -L / 2 - 0.006, 0, Math.PI)); if (lod2) B2.add(new THREE.BoxGeometry(0.02, 1.7, 0.02), '#8a8f95', 0, T(0, 1.65, -L / 2 - 0.01));
  };
  return buildCar(P, lod);
}
function fireTruck(lod) {
  const B = new Build(), L = 7.6, W = 2.45, zCab = L / 2;
  cabOver(B, lod, { W, H: 1.75, D: 2.3, z0: zCab, y0: 1.0, r: 0.14, roof: '#e9eaec' });
  // 앞 큰 범퍼 · 흰 띠
  for (const s of [-1, 1]) B.add(new THREE.PlaneGeometry(L - 0.3, 0.14), '#f4f5f6', 0, T(s * (W / 2 + 0.06), 1.15, 0, 0, s * Math.PI / 2));
  chassis(B, W, -L / 2 + 0.3, zCab - 0.4, 0.75, lod);
  // 장비함: 은색 셔터 칸 (세로 골) + 빨간 테두리
  const bz0 = -L / 2 + 0.05, bz1 = zCab - 2.38, bl = bz1 - bz0, bzc = (bz0 + bz1) / 2, bh = 1.75;
  rbox(B, W + 0.1, bh, bl, 0.06, 0, 0.95 + bh / 2, bzc, (x, y, z, n) => {
    if (Math.abs(n.x) > 0.6 && y > 0.22 && y < bh - 0.15) { const u = ((z + bl / 2) / (bl / 3)) % 1; if (u > 0.05 && u < 0.95) return ['#c3c8cd', 0]; }
    return ['#ffffff', VK.paint];
  }, lod ? 2 : 1, { y: [0.22, bh - 0.15], z: [0, 1, 2].flatMap((k) => [-bl / 2 + (k + 0.05) * bl / 3, -bl / 2 + (k + 0.95) * bl / 3]) });
  // 셔터 가로 골
  if (lod) for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) for (let i = 1; i < 12; i++) B.add(new THREE.BoxGeometry(0.01, 0.012, bl / 3 * 0.88), '#9aa0a6', 0, T(s2 * ((W + 0.1) / 2 + 0.004), 0.95 + 0.22 + i * (bh - 0.37) / 12, bzc - bl / 2 + (k + 0.5) * bl / 3));
  // 지붕 사다리 (두 줄 난간 + 가로대) · 호스 감개
  for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.06, 0.08, 6.4), '#c9cdd2', 0, T(s * 0.42, 2.95, 0.4));
  if (lod) for (let i = 0; i < 18; i++) B.add(new THREE.CylinderGeometry(0.018, 0.018, 0.84, 5).rotateZ(Math.PI / 2), '#c9cdd2', 0, T(0, 2.95, -2.6 + i * 0.36));
  if (lod) B.add(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 14).rotateZ(Math.PI / 2), '#e8c547', 0, T(0, 2.85, -3.1));
  lightbar(B, 1.5, 2.8, zCab - 0.5, lod);
  if (lod) for (const s of [-1, 1]) B.text(TEXT.fire, 1.2, 0.3, T(s * (W / 2 + 0.003), 1.95, zCab - 1.2, 0, s * Math.PI / 2), false, '#c8161d');
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(0.2, 0.3, 0.04), '#d8221a', VK.tail, T(s * (W / 2 - 0.2), 1.1, -L / 2 - 0.02)); B.add(new THREE.BoxGeometry(0.2, 0.12, 0.04), '#ffa018', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.2), 0.88, -L / 2 - 0.02)); B.add(new THREE.BoxGeometry(0.16, 0.12, 0.06), s > 0 ? '#ff2a2a' : '#2a5bff', s > 0 ? VK.sirenR : VK.sirenB, T(s * (W / 2 - 0.15), 2.6, -L / 2 - 0.02)); }
  if (lod) B.plate(T(0, 0.85, -L / 2 - 0.03, 0, Math.PI));
  for (const s of [-1, 1]) { wheel(B, s * 1.0, zCab - 1.1, 0.5, 0.32, lod, { spokes: 0, rim: '#d8dce0' }); wheel(B, s * 1.0, -1.9, 0.5, 0.32, lod, { spokes: 0, rim: '#d8dce0' }); wheel(B, s * 0.68, -1.9, 0.5, 0.3, false); }
  return B.done();
}
function mixer(lod) {
  const B = new Build(), L = 9.0, W = 2.49, zCab = L / 2;
  cabOver(B, lod, { W, H: 1.7, D: 2.1, z0: zCab, y0: 1.1, r: 0.14 });
  chassis(B, W, -L / 2 + 0.3, zCab - 0.4, 0.8, lod);
  // 드럼: 뒤로 갈수록 높게 기운 달걀 모양 · 흰 바탕에 도색 나선 띠
  const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14, z = -2.3 + t * 4.6, r = 1.18 * Math.sin(Math.PI * clamp(0.12 + t * 0.8, 0, 1)) * (1 - 0.25 * t) + 0.12; prof.push(new THREE.Vector2(r, z)); }
  const drum = new THREE.LatheGeometry(prof, lod ? 24 : 10); drum.rotateX(-Math.PI / 2); drum.rotateX(0.2);
  B.addPainted(drum, (c, n) => { const a = Math.atan2(c.y, c.x), u = (a / (Math.PI * 2) + c.z / 1.6) % 0.5; return Math.abs(u) < 0.12 ? ['#ffffff', VK.paint] : ['#eef0f1', 0]; }, T(0, 2.3, -1.0));
  // 투입구 · 미끄럼틀 · 받침
  B.add(new THREE.CylinderGeometry(0.35, 0.18, 0.5, 10), '#5d6168', 0, T(0, 3.25, -3.75, 0.5));
  B.add(new THREE.BoxGeometry(0.45, 0.1, 1.1), '#7a7f86', 0, T(0, 1.75, -4.1, -0.4));
  for (const z of [1.2, -3.2]) B.add(new THREE.BoxGeometry(1.6, 1.2, 0.2), '#2a2b2f', 0, T(0, 1.4, z));
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(0.18, 0.26, 0.04), '#d8221a', VK.tail, T(s * (W / 2 - 0.2), 0.95, -L / 2 + 0.25)); B.add(new THREE.BoxGeometry(0.16, 0.1, 0.04), '#ffa018', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.2), 0.78, -L / 2 + 0.25)); }
  B.add(new THREE.BoxGeometry(W, 0.12, 0.1), '#e8c547', 0, T(0, 0.7, -L / 2 + 0.25));
  for (const s of [-1, 1]) { wheel(B, s * 1.0, zCab - 1.0, 0.52, 0.32, lod, { spokes: 0, rim: '#d8dce0' }); for (const z of [-1.4, -2.75]) { wheel(B, s * 1.0, z, 0.52, 0.32, lod, { spokes: 0, rim: '#d8dce0' }); wheel(B, s * 0.68, z, 0.52, 0.3, false); } }
  return B.done();
}
function dumpTruck(lod) {
  const B = new Build(), L = 8.4, W = 2.49, zCab = L / 2;
  cabOver(B, lod, { W, H: 1.7, D: 2.1, z0: zCab, y0: 1.1, r: 0.14 });
  chassis(B, W, -L / 2 + 0.3, zCab - 0.4, 0.8, lod);
  // 짐칸: 두꺼운 철판 상자 (위가 열림, 앞쪽 운전석 보호 판), 갈색 흙 조금
  const z0 = -L / 2 + 0.1, z1 = zCab - 2.25, bl = z1 - z0, zc = (z0 + z1) / 2, y0 = 1.3, h = 1.3, col = '#5d6168';
  B.add(new THREE.BoxGeometry(W, 0.12, bl), col, 0, T(0, y0, zc));
  for (const s of [-1, 1]) { rbox(B, 0.08, h, bl, 0.02, s * (W / 2 - 0.04), y0 + h / 2, zc, '#ffffff', 1); if (lod) for (let i = 1; i < 5; i++) B.add(new THREE.BoxGeometry(0.03, h, 0.08), '#ffffff', VK.paint2, T(s * W / 2, y0 + h / 2, z0 + (bl * i) / 5)); }
  rbox(B, W, h + 0.25, 0.1, 0.02, 0, y0 + (h + 0.25) / 2, z1, '#ffffff', 1);
  B.add(new THREE.BoxGeometry(W - 0.1, 0.18, 0.7), '#ffffff', VK.paint, T(0, y0 + h + 0.2, z1 + 0.3));
  rbox(B, W, h * 0.9, 0.1, 0.02, 0, y0 + h * 0.45, z0, '#ffffff', 1);
  if (lod) B.add(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#7a5a3a', 0, T(0, y0 + 0.5, zc, 0, 0, 0, W * 0.42, 0.45, bl * 0.42));
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(0.18, 0.26, 0.04), '#d8221a', VK.tail, T(s * (W / 2 - 0.2), 0.95, -L / 2 + 0.1)); B.add(new THREE.BoxGeometry(0.16, 0.1, 0.04), '#ffa018', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.2), 0.78, -L / 2 + 0.1)); }
  if (lod) B.plate(T(0, 0.85, -L / 2 + 0.08, 0, Math.PI));
  for (const s of [-1, 1]) { wheel(B, s * 1.0, zCab - 1.0, 0.52, 0.32, lod, { spokes: 0, rim: '#d8dce0' }); for (const z of [-1.2, -2.55]) { wheel(B, s * 1.0, z, 0.52, 0.32, lod, { spokes: 0, rim: '#d8dce0' }); wheel(B, s * 0.68, z, 0.52, 0.3, false); } }
  return B.done();
}
function bus(lod, kind) {
  // 저상버스: 둥근 상자 + 창 띠(검은 기둥) · 오른쪽 앞문 · 뒷문 · 앞 큰 유리 · 행선지 LED · 지붕 냉방기 · 토끼 귀 거울
  const B = new Build(), tour = kind === 'tour', town = kind === 'town';
  const L = tour ? 12 : town ? 7.2 : 11, W = town ? 2.06 : 2.49, y0 = tour ? 0.38 : 0.3, H = (tour ? 3.5 : town ? 2.75 : 3.25) - y0;
  const zAF = L / 2 - (tour ? 2.6 : town ? 1.7 : 2.5), zAR = -L / 2 + (tour ? 3.0 : town ? 1.9 : 3.0);
  const winLo = tour ? 1.75 : town ? 0.95 : 1.0, winHi = H - (tour ? 0.18 : 0.38), doorF = [L / 2 - 1.55, L / 2 - 0.42], doorM = town ? [-0.6, 0.45] : [-0.95, 0.3];
  rbox(B, W, H, L, 0.16, 0, y0 + H / 2, 0, (x, y, z, n) => {
    if (n.y < -0.5) return ['#1d1e21', 0];
    const side = Math.abs(n.x) > 0.6, right = n.x < 0;
    if (side) {
      if (right && !tour && ((z > doorF[0] && z < doorF[1]) || (z > doorM[0] && z < doorM[1])) && y < winHi) { const d = z > doorF[0] ? doorF : doorM, mid = (d[0] + d[1]) / 2; if (Math.abs(z - mid) < 0.02 || Math.abs(z - d[0]) < 0.04 || Math.abs(z - d[1]) < 0.04) return ['#22272d', 0]; return y > 0.25 ? ['#18222c', VK.glass] : ['#2a3038', 0]; }
      if (right && tour && z > doorF[0] && z < doorF[1] && y < winHi) return y > 0.4 ? ['#18222c', VK.glass] : ['#2a3038', 0];
      if (y > winLo && y < winHi && z > -L / 2 + 0.55 && z < L / 2 - 0.3) { const u = ((z + L / 2) / (tour ? 1.45 : 1.3)) % 1; return u < 0.06 ? ['#121417', 0] : ['#18222c', VK.glass]; }
      if (y < (tour ? 0.75 : 0.5)) return ['#3b3f46', 0];
      if (!tour && y < 0.85) return ['#e8eaec', 0];
      if (tour && y > 1.0 && y < 1.32) return ['#ffffff', VK.paint];
      if (tour && y > 1.38 && y < 1.5) return ['#ffffff', VK.paint2];
      if (tour) return ['#f4f5f6', 0];
    }
    if (n.z > 0.6) { if (y > (tour ? 1.2 : 0.95) && y < H - (tour ? 0.12 : 0.42) && Math.abs(x) < W / 2 - 0.1) return ['#18222c', VK.glass]; if (y < 0.55) return ['#2a2d32', 0]; }
    if (n.z < -0.6) { if (y > winLo + 0.55 && y < winHi && Math.abs(x) < W / 2 - 0.25) return ['#18222c', VK.glass]; if (y > 0.4 && y < 1.2 && Math.abs(x) < W / 2 - 0.35) return ['#2a2d32', 0]; if (y < 0.4) return ['#2a2d32', 0]; }
    if (n.y > 0.9) return ['#eceef0', 0];
    return tour ? ['#f4f5f6', 0] : ['#ffffff', VK.paint];
  }, lod ? 3 : 1, (() => { const P2 = tour ? 1.45 : 1.3, zc = []; for (let k = 0; k * P2 < L; k++) zc.push(-L / 2 + k * P2, -L / 2 + (k + 0.06) * P2); for (const dd of [doorF, doorM]) { const m2 = (dd[0] + dd[1]) / 2; zc.push(dd[0], dd[0] + 0.04, dd[1] - 0.04, dd[1], m2 - 0.02, m2 + 0.02); } zc.push(-L / 2 + 0.55, L / 2 - 0.3);
    return { x: [-W / 2 + 0.1, W / 2 - 0.1, -W / 2 + 0.25, W / 2 - 0.25, -W / 2 + 0.35, W / 2 - 0.35], y: [winLo, winHi, 0.25, 0.4, 0.5, 0.55, 0.75, 0.85, 0.95, 1.0, 1.2, 1.32, 1.38, 1.5, winLo + 0.55, H - 0.12, H - 0.42], z: zc }; })());
  // 바퀴 집 (옆에 어두운 반원)
  for (const s of [-1, 1]) for (const wz of [zAF, zAR]) B.add(new THREE.CircleGeometry(0.62, lod ? 20 : 8, 0, Math.PI), '#0c0c0e', 0, T(s * (W / 2 + 0.004), 0.5, wz, 0, s * Math.PI / 2));
  const zF = L / 2 + 0.005, zR = -L / 2 - 0.005;
  // 행선지 LED (앞 · 옆 · 뒤) — 노선 번호
  if (!tour) { B.add(new THREE.PlaneGeometry(W - 0.5, 0.3), '#ffffff', VK.led, T(0, y0 + H - 0.22, zF)); B.add(new THREE.PlaneGeometry(1.4, 0.3), '#ffffff', VK.led, T(-W / 2 - 0.006, y0 + winHi + 0.18, L / 2 - 2.2, 0, -Math.PI / 2)); if (lod) B.add(new THREE.PlaneGeometry(0.9, 0.24), '#ffffff', VK.led, T(0, y0 + H - 0.25, zR, 0, Math.PI)); }
  else { B.text(TEXT.tour, 1.0, 0.26, T(0, y0 + H - 0.1, zF), true, '#1a1a1c'); }
  // 앞 등 (사각 두 개씩) · 깜빡이 · 번호판 · 범퍼
  for (const s of [-1, 1]) { B.add(new THREE.BoxGeometry(0.34, 0.16, 0.04), '#fff6e2', VK.head, T(s * (W / 2 - 0.3), y0 + 0.5, zF)); B.add(new THREE.BoxGeometry(0.12, 0.12, 0.04), '#ffb020', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.1), y0 + 0.5, zF - 0.01)); B.add(new THREE.BoxGeometry(0.22, 0.6, 0.04), '#d8221a', VK.tail, T(s * (W / 2 - 0.18), y0 + 1.1, zR)); B.add(new THREE.BoxGeometry(0.16, 0.16, 0.04), '#ffa018', s > 0 ? VK.blinkL : VK.blinkR, T(s * (W / 2 - 0.18), y0 + 0.66, zR)); }
  if (lod) { B.plate(T(0, y0 + 0.3, zF + 0.012)); B.plate(T(0, y0 + 0.35, zR - 0.012, 0, Math.PI)); }
  // 지붕 냉방기 · 토끼 귀 거울
  rbox(B, W - 0.5, 0.3, 3.2, 0.1, 0, y0 + H + 0.14, tour ? 0 : -0.9, '#dfe2e5', lod ? 2 : 1);
  if (!tour || lod) for (const s of [-1, 1]) { const ax = s * (W / 2 - 0.05); B.add(new THREE.BoxGeometry(0.035, 0.035, 0.55), '#1a1a1c', 0, T(ax, y0 + H - 0.15, zF + 0.22, 0.3, 0, 0)); B.add(new THREE.BoxGeometry(0.035, 0.45, 0.035), '#1a1a1c', 0, T(ax, y0 + H - 0.4, zF + 0.46)); B.add(new RoundedBoxGeometry(0.22, 0.38, 0.06, 1, 0.025), '#1a1a1c', 0, T(ax - s * 0.05, y0 + H - 0.7, zF + 0.46, 0, s * 0.3)); }
  for (const s of [-1, 1]) { wheel(B, s * (W / 2 - 0.12), zAF, 0.5, 0.3, lod, { spokes: 0, rim: '#d0d4d8' }); wheel(B, s * (W / 2 - 0.12), zAR, 0.5, 0.3, lod, { spokes: 0, rim: '#d0d4d8' }); }
  return B.done();
}
function scooter(lod, empty = false) {
  const B = new Build();
  bike(B, lod, { r: 0.27, wb: 1.3, barY: 1.02, hlY: 0.95, tlY: 0.78, tlZ: -0.86,
    body: (B2, lod2) => {
      // 앞 가림판 · 발판 · 뒤 몸통(도색) · 안장
      B2.add(new RoundedBoxGeometry(0.42, 0.62, 0.16, 2, 0.07), '#ffffff', VK.paint, T(0, 0.68, 0.45, -0.25));
      B2.add(new RoundedBoxGeometry(0.34, 0.08, 0.55, 1, 0.03), '#1d1e21', 0, T(0, 0.33, 0.1));
      B2.add(new RoundedBoxGeometry(0.36, 0.36, 0.7, 2, 0.12), '#ffffff', VK.paint, T(0, 0.55, -0.45));
      B2.add(new RoundedBoxGeometry(0.3, 0.1, 0.62, 2, 0.05), '#1a1a1c', 0, T(0, 0.77, -0.33));
      B2.add(new RoundedBoxGeometry(0.3, 0.16, 0.3, 1, 0.05), '#ffffff', VK.paint, T(0, 0.99, 0.62, -0.3));
      // 배달 짐 상자 (뒤 짐받이 위)
      B2.add(new THREE.BoxGeometry(0.42, 0.03, 0.42), '#2a2b2f', 0, T(0, 0.86, -0.72));
      B2.add(new RoundedBoxGeometry(0.48, 0.44, 0.46, 2, 0.04), lod2 ? '#f4f5f6' : '#e8e9ea', 0, T(0, 1.1, -0.72));
      if (lod2) B2.add(new THREE.BoxGeometry(0.49, 0.06, 0.47), '#ffffff', VK.paint, T(0, 1.18, -0.72));
    },
    rider: empty ? null : { jacket: '#2b3442', pants: '#22262c', helmet: '#f2f3f4', hip: 0.86, z: -0.15, lean: 0.1, foot: 0.4 } });
  return B.done();
}
function motoBike(lod, empty = false) {
  const B = new Build();
  bike(B, lod, { r: 0.31, wb: 1.42, barY: 1.0, hlY: 0.92, tlY: 0.86, tlZ: -0.92, rim: '#2a2c30',
    body: (B2, lod2) => {
      // 연료통(도색) · 엔진 · 배기관 · 안장 · 뒤 꼬리
      B2.add(new RoundedBoxGeometry(0.34, 0.24, 0.5, 2, 0.1), '#ffffff', VK.paint, T(0, 0.86, 0.2, 0.12));
      B2.add(new RoundedBoxGeometry(0.3, 0.32, 0.42, 1, 0.06), '#3a3d42', 0, T(0, 0.48, 0.05));
      if (lod2) for (let i = 0; i < 3; i++) B2.add(new THREE.BoxGeometry(0.32, 0.015, 0.36), '#6e737a', 0, T(0, 0.42 + i * 0.07, 0.05));
      B2.add(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8).rotateX(Math.PI / 2 - 0.15), '#a9aeb4', 0, T(-0.2, 0.42, -0.35));
      B2.add(new RoundedBoxGeometry(0.28, 0.08, 0.5, 1, 0.04), '#1a1a1c', 0, T(0, 0.86, -0.3, -0.08));
      B2.add(new RoundedBoxGeometry(0.22, 0.12, 0.4, 1, 0.05), '#ffffff', VK.paint, T(0, 0.86, -0.7, -0.15));
      B2.add(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), '#3a3d42', 0, T(0, 0.55, -0.3, 0.9));
    },
    rider: empty ? null : { jacket: '#1d1e22', pants: '#2a3442', helmet: '#141518', hip: 0.9, z: -0.22, lean: 0.38, foot: 0.42 } });
  return B.done();
}

// ---------- 종류 · 단계별 그물 (처음 쓸 때 한 번) ----------
const GEO = new Map();
//   empty: 탄 사람 없이 (오토바이를 세워 두거나 내가 탈 때)
export function vehicleGeo(key, lod, empty = false) {
  const k = key + (lod ? ':n' : ':f') + (empty ? 'e' : ''); if (GEO.has(k)) return GEO.get(k);
  const t = TYPES[key]; const g = t.build ? t.build(lod, empty) : buildCar(t, lod); GEO.set(k, g); return g;
}
// 색 고르기 (실제 비율: 흰 · 검 · 회 · 은이 대부분)
const PAINT = [['#eef0ef', 20], ['#f7f7f4', 12], ['#141518', 17], ['#b8bcc1', 14], ['#6e737a', 12], ['#3e434a', 6], ['#22324f', 4], ['#2f5b9a', 2], ['#8f1d23', 3], ['#cbbd9f', 3], ['#3c4f42', 2], ['#5a4335', 2], ['#9bb8cf', 1]];
export function pickColor(t, r) { const list = t.colors || (t.key === 'light' ? [...PAINT, ['#e8c547', 3], ['#b9d3a8', 2]] : PAINT); let s = r() * list.reduce((a, b) => a + b[1], 0); for (const [c, w] of list) { s -= w; if (s <= 0) return c; } return list[0][0]; }
