// 롯데월드타워 안 (8-26) 공용 도구: 재질 · 한 덩어리로 묶기(TKit) · 글씨 그림 한 장(Atlas) · 창 재질 · 걸을 수 있는 곳(Area)
//   층 하나를 지을 때 재질마다 그리기 호출 한 번, 글씨 · 번호판은 그 층 그림 한 장, 반복 가구는 인스턴스
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (i, k = 0) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
export const T = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), typeof s === 'number' ? new THREE.Vector3(s, s, s) : s);
// 모양 (가운데 바닥이 원점)
export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0),
  cyl: (r0, r1, h, s = 16, open = false) => new THREE.CylinderGeometry(r1, r0, h, s, 1, open).translate(0, h / 2, 0),
  ball: (r, s = 12) => new THREE.SphereGeometry(r, s, Math.max(6, Math.round(s * 0.7))),
  // 모서리가 둥근 상자 (쿠션 · 매트리스 · 소파 등받이)
  pillow: (w, h, d, r = 0.06, s = 3) => { const sh = new THREE.Shape(), x = w / 2 - r, z = d / 2 - r; sh.moveTo(-x, -d / 2); sh.lineTo(x, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -z); sh.lineTo(w / 2, z); sh.quadraticCurveTo(w / 2, d / 2, x, d / 2); sh.lineTo(-x, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, z); sh.lineTo(-w / 2, -z); sh.quadraticCurveTo(-w / 2, -d / 2, -x, -d / 2); const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, h - r * 2), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.6, bevelSegments: s, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, r, 0); return g; },
  // 바닥 판 (uv 를 m 단위로: tile m 마다 그림 한 번)
  floor: (w, d, tile = 1) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile); return g; },
  // 벽 판 (앞 = +z), uv 도 m 단위
  wall: (w, h, tile = 1) => { const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile); return g; },
};

// ---------- 그림 (캔버스) ----------
export function canvasTex(w, h, draw, rep = true) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
const rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// 대리석: 흰 바탕 · 회색 · 금빛 결 (큰 판 사이 가는 줄눈)
function marbleTex(base, vein, gold, seed, joint = true) {
  return canvasTex(512, 512, (c, w, h) => { const r = rnd(seed); c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { c.strokeStyle = i % 7 === 0 && gold ? gold : vein; c.globalAlpha = 0.08 + r() * 0.22; c.lineWidth = 0.6 + r() * 2.4; c.beginPath(); let x = r() * w, y = r() * h; c.moveTo(x, y); for (let k = 0; k < 6; k++) { const nx = x + (r() - 0.3) * 160, ny = y + (r() - 0.5) * 120; c.bezierCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, nx + (r() - 0.5) * 60, ny + (r() - 0.5) * 60, nx, ny); x = nx; y = ny; } c.stroke(); }
    c.globalAlpha = 1; const im = c.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 8; d[i] += n; d[i + 1] += n; d[i + 2] += n; } c.putImageData(im, 0, 0);
    if (joint) { c.strokeStyle = 'rgba(90,80,70,.28)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2); } });
}
// 카펫: 짙은 바탕에 은은한 물결 무늬 (호텔 복도)
function carpetTex(a, b, line) {
  return canvasTex(256, 256, (c, w, h) => { const r = rnd(7); c.fillStyle = a; c.fillRect(0, 0, w, h); c.strokeStyle = b; c.lineWidth = 6; for (let y = -32; y < h + 32; y += 32) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin((x / w) * Math.PI * 4) * 9); c.stroke(); } c.strokeStyle = line; c.lineWidth = 1.5; for (let y = -16; y < h + 32; y += 32) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin((x / w) * Math.PI * 4 + 1) * 6); c.stroke(); }
    const im = c.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; } c.putImageData(im, 0, 0); });
}
// 나무 판 (호두나무 · 참나무): 결 + 판 이음
function woodTex(base, dark, seed) {
  return canvasTex(512, 512, (c, w, h) => { const r = rnd(seed); c.fillStyle = base; c.fillRect(0, 0, w, h); for (let p = 0; p < 4; p++) { const x0 = (p * w) / 4; c.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`; c.fillRect(x0, 0, w / 4, h); for (let i = 0; i < 40; i++) { c.strokeStyle = dark; c.globalAlpha = 0.08 + r() * 0.16; c.lineWidth = 0.5 + r() * 1.6; const x = x0 + r() * (w / 4); c.beginPath(); c.moveTo(x, 0); for (let y = 0; y <= h; y += 32) c.lineTo(x + Math.sin(y * 0.02 + i) * 3 + (r() - 0.5) * 2, y); c.stroke(); } c.globalAlpha = 1; c.fillStyle = 'rgba(30,18,10,.35)'; c.fillRect(x0, 0, 1.5, h); } });
}
// 흰 돌 (로비 벽 · 바닥): 큰 판 + 아주 옅은 얼룩
function stoneTex(base, seed) {
  return canvasTex(256, 256, (c, w, h) => { const r = rnd(seed); c.fillStyle = base; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${120 + r() * 60},${110 + r() * 60},${100 + r() * 50},${0.03 + r() * 0.05})`; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 7, 0, 7); c.fill(); } c.strokeStyle = 'rgba(110,100,90,.22)'; c.lineWidth = 1.5; c.strokeRect(0.5, 0.5, w - 1, h - 1); });
}

// ---------- 재질 (실내 전체가 같이 쓴다) ----------
let MATS = null;
export function mats() {
  if (MATS) return MATS;
  const L = (o) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o }), P = (o) => new THREE.MeshPhongMaterial({ vertexColors: true, ...o });
  MATS = {
    std: L(), fabric: L(),
    // 천장: 아래만 보는 면이라 빛을 덜 받는다 → 조금 스스로 밝게
    ceil: L({ emissive: '#4a4238', emissiveIntensity: 1 }), velvet: P({ shininess: 12, specular: '#3a3040' }),
    satin: P({ shininess: 30, specular: '#40382e' }), gloss: P({ shininess: 90, specular: '#ffffff' }),
    metal: P({ shininess: 120, specular: '#ffe8c0' }), chrome: P({ shininess: 160, specular: '#ffffff' }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    marble: P({ map: marbleTex('#f1ede6', '#8d877e', '#c9a56a', 3), shininess: 80, specular: '#d8d4cc' }),
    marbleD: P({ map: marbleTex('#2c2a2b', '#c9c2b8', '#b08a4e', 9), shininess: 90, specular: '#a09a92' }),
    stone: P({ map: stoneTex('#eeebe5', 5), shininess: 25, specular: '#6a6660' }),
    carpet: L({ map: carpetTex('#3b2f3a', '#4a3b47', '#a88a5c') }),
    carpetR: L({ map: carpetTex('#cfc4b4', '#c5b9a8', '#b0a28e') }),
    wood: P({ map: woodTex('#6b4a33', '#2e1d12', 11), shininess: 45, specular: '#6a5a48' }),
    oak: P({ map: woodTex('#c49a6c', '#7a5634', 13), shininess: 35, specular: '#5a4a38' }),
    glass: new THREE.MeshPhongMaterial({ color: '#d8ecf2', transparent: true, opacity: 0.18, shininess: 150, specular: '#ffffff', depthWrite: false, side: THREE.DoubleSide }),
    water: new THREE.MeshPhongMaterial({ color: '#9fd6e8', transparent: true, opacity: 0.62, shininess: 160, specular: '#ffffff', depthWrite: false }),
  };
  for (const k of ['glow', 'glass', 'water']) MATS[k].userData.noCast = true;
  return MATS;
}

// ---------- 한 덩어리로 묶기 ----------
const _c = new THREE.Color();
export class TKit {
  constructor(extra = {}) { this.b = {}; this.extra = extra; }
  mat(m) { return this.extra[m] || mats()[m]; }
  add(g, col = '#ffffff', m = 'std', M4) {
    const mat = this.mat(m), keepUV = !!(mat.map || mat.uniforms?.map); let q = g.index ? g.toNonIndexed() : g.clone(); if (M4) q.applyMatrix4(M4);
    for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal' && !(keepUV && k === 'uv')) q.deleteAttribute(k);
    if (keepUV && !q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
    { const nn = q.attributes.normal.array; for (let i = 0; i < nn.length; i += 3) if (!(Math.abs(nn[i]) + Math.abs(nn[i + 1]) + Math.abs(nn[i + 2]) > 1e-6)) { nn[i] = 0; nn[i + 1] = 1; nn[i + 2] = 0; } }
    const n = q.attributes.position.count, a = new Float32Array(n * 3); _c.set(col); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } q.setAttribute('color', new THREE.BufferAttribute(a, 3));
    (this.b[m] ||= []).push(q); if (g !== q && !g.userData.keep) g.dispose(); return this;
  }
  build(parent) {
    const out = {};
    for (const [m, list] of Object.entries(this.b)) { if (!list.length) continue; const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); if (!g) continue; g.computeBoundingSphere(); const mat = this.mat(m), me = new THREE.Mesh(g, mat); me.castShadow = !mat.userData.noCast && !mat.transparent; me.receiveShadow = !mat.userData.noCast; me.userData.noDrape = true; parent.add(me); out[m] = me; }
    this.b = {}; return out;
  }
}
// 같은 가구 여럿: 작은 덩어리 하나를 인스턴스로 (재질마다 하나)
export function instanced(parent, makeKit, mats4) {
  const k = new TKit(); makeKit(k); const out = [];
  for (const [m, list] of Object.entries(k.b)) { const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); const mat = k.mat(m), im = new THREE.InstancedMesh(g, mat, mats4.length); mats4.forEach((M, i) => im.setMatrixAt(i, M)); im.castShadow = !mat.userData.noCast && !mat.transparent; im.receiveShadow = true; im.computeBoundingSphere(); parent.add(im); out.push(im); }
  return out;
}

// ---------- 글씨 그림 한 장 (층마다) ----------
//   rect(w, h, draw) → 그림 칸 하나, plane(kit, r, 폭, 높이, 행렬) → 그 칸을 붙인 판
export class Atlas {
  constructor(W = 2048, H = 1024) { this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H; this.c = this.cv.getContext('2d'); this.x = 0; this.y = 0; this.rowH = 0; this.W = W; this.H = H; this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8; this.mat = new THREE.MeshBasicMaterial({ map: this.tex, vertexColors: true, transparent: true, alphaTest: 0.04 }); this.mat.userData.noCast = true; this.glow = new THREE.MeshLambertMaterial({ map: this.tex, vertexColors: true, transparent: true, alphaTest: 0.04, emissive: '#ffffff', emissiveMap: this.tex, emissiveIntensity: 0.25 }); this.glow.userData.noCast = true; }
  rect(w, h, draw) { if (this.x + w > this.W) { this.x = 0; this.y += this.rowH + 2; this.rowH = 0; } const r = { x: this.x, y: this.y, w, h }; this.c.save(); this.c.translate(r.x, r.y); this.c.beginPath(); this.c.rect(0, 0, w, h); this.c.clip(); draw(this.c, w, h); this.c.restore(); this.x += w + 2; this.rowH = Math.max(this.rowH, h); this.tex.needsUpdate = true; return r; }
  plane(kit, r, w, h, M4, col = '#ffffff', m = 'sign') { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (r.x + uv.getX(i) * r.w) / this.W, 1 - (r.y + (1 - uv.getY(i)) * r.h) / this.H); kit.add(g, col, m, M4); }
  dispose() { this.tex.dispose(); this.mat.dispose(); this.glow.dispose(); }
}
// 글씨 한 줄 그리기 도우미
export function txt(c, s, x, y, size, col = '#fff', font = 'Pretendard, "Apple SD Gothic Neo", sans-serif', w = 800, align = 'center') { c.font = `${size}px ${font}`; c.fillStyle = col; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y, w); }

// ---------- 창 (모든 층 공통): 탑 실제 자리 · 높이에서 그린 서울 6면 그림을 보는 방향대로 ----------
//   방 안이 멀리 떨어진 곳에 있어도 동서남북은 같으니, 카메라 → 창 방향으로 6면 그림을 읽으면 창밖이 실제 서울이 된다
//   비 오는 날 유리를 타고 흐르는 물방울, 밤엔 방 안 불빛이 유리에 은은히 비친다
export function windowMat() {
  const u = { env: { value: null }, uTint: { value: new THREE.Color('#e9f2f3') }, uNight: { value: 0 }, uRain: { value: 0 }, uTime: { value: 0 }, uGlow: { value: new THREE.Color('#ffd9a8') }, uDim: { value: 1 }, uEye: { value: new THREE.Vector3() } };
  const m = new THREE.ShaderMaterial({ uniforms: u, fog: false,
    vertexShader: `varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform samplerCube env; uniform vec3 uTint; uniform float uNight; uniform float uRain; uniform float uTime; uniform vec3 uGlow; uniform float uDim; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        // 비: 유리를 타고 내려오는 물줄기 · 맺힌 방울 (굴절로 창밖이 살짝 일그러진다)
        vec2 off = vec2(0.0); float wet = 0.0;
        if (uRain > 0.01) { vec2 p = vW.xz * 0.0 + vec2(vW.x + vW.z, vW.y) * vec2(9.0, 3.0); vec2 c = floor(p); float r = h21(c); float y = fract(p.y + uTime * (0.4 + r) + r * 7.0); float line = smoothstep(0.08, 0.0, abs(fract(p.x) - 0.5 - (r - 0.5) * 0.3)) * smoothstep(0.0, 0.25, y) * (1.0 - y); vec2 q = fract(vec2(vW.x + vW.z, vW.y) * 14.0) - 0.5; float drop = smoothstep(0.18, 0.05, length(q + (h21(floor(vec2(vW.x + vW.z, vW.y) * 14.0)) - 0.5) * 0.4)) * step(0.72, h21(floor(vec2(vW.x + vW.z, vW.y) * 14.0) + 3.0)); off = vec2(line * 0.03 + drop * 0.05) * uRain; wet = (line * 0.5 + drop) * uRain; }
        vec3 dd = normalize(d + vec3(off.x, -off.y, off.x));
        vec3 col = textureCube(env, dd).rgb * uTint * uDim;
        // 비 오는 날은 뿌옇게
        col = mix(col, vec3(dot(col, vec3(0.33))) * 0.9 + 0.04, uRain * 0.25);
        // 유리 반사: 비스듬히 볼수록, 밤일수록 방 안 불빛이 비친다
        float f = pow(1.0 - abs(dot(d, normalize(vN))), 3.0);
        col += uGlow * (0.012 + f * 0.1) * (0.25 + uNight * 0.9);
        // 물방울 · 물줄기는 빛을 받아 살짝 밝게
        col += vec3(0.75, 0.8, 0.85) * wet * 0.12;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  m.userData.noCast = true; return m;
}

// ---------- 걸을 수 있는 곳: 열린 사각형들 - 막힌 사각형 · 원 ----------
export class Area {
  constructor() { this.open = []; this.block = []; this.circ = []; this.fns = []; }
  // 모양이 있는 열린 곳 (둥근 네모 바닥 등): fn(x, z, y, r) → 그 안이면 true
  fn(f) { this.fns.push(f); return this; }
  add(x0, z0, x1, z1, y0 = -1, y1 = 99) { this.open.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1]); return this; }
  wall(x0, z0, x1, z1, y0 = -1, y1 = 99) { this.block.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1]); return this; }
  pole(x, z, r, y0 = -1, y1 = 99) { this.circ.push([x, z, r, y0, y1]); return this; }
  ok(x, z, y = 0, r = 0.26) {
    let inside = this.fns.some((f) => f(x, z, y, r)); if (!inside) for (const [a, b, c, d, y0, y1] of this.open) if (x >= a + r && x <= c - r && z >= b + r && z <= d - r && y >= y0 && y <= y1) { inside = true; break; } if (!inside) return false;
    for (const [a, b, c, d, y0, y1] of this.block) if (x > a - r && x < c + r && z > b - r && z < d + r && y >= y0 && y <= y1) return false;
    for (const [cx, cz, rr, y0, y1] of this.circ) if (Math.hypot(x - cx, z - cz) < rr + r && y >= y0 && y <= y1) return false;
    return true;
  }
}

// ---------- 소리 (WebAudio, 짧게) ----------
let AC = null;
export function ac() { try { const A = window.AudioContext || window.webkitAudioContext; AC ||= new A(); if (AC.state !== 'running') AC.resume(); return AC; } catch { return null; } }
export function tone(freqs, { type = 'sine', dur = 0.6, vol = 0.15, at = 0, attack = 0.005 } = {}) {
  const a = ac(); if (!a) return; const t0 = a.currentTime + at;
  for (const f of [].concat(freqs)) { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05); }
}
export function noise({ dur = 0.2, vol = 0.2, freq = 900, type = 'lowpass', at = 0, q = 0.7 } = {}) {
  const a = ac(); if (!a) return; const t0 = a.currentTime + at, n = a.createBufferSource(), buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2; n.buffer = buf; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = a.createGain(); g.gain.value = vol; n.connect(f).connect(g).connect(a.destination); n.start(t0);
}

// 둥근 네모 (탑 층 바닥 모양): 반 너비 R · 모서리 반지름 cr
export const inRSq = (x, z, R, cr) => Math.hypot(Math.max(Math.abs(x) - (R - cr), 0), Math.max(Math.abs(z) - (R - cr), 0)) <= cr;
// 둥근 네모 외곽선 (남쪽 변을 서 → 동으로 시작해 한 바퀴: 이 순서면 glassWall 판이 안쪽을 본다)
export function rsqOutline(R, cr, seg = 4) {
  const P = [], arc = (cx, cz, a0, a1) => { for (let i = 1; i <= seg; i++) { const a = a0 + ((a1 - a0) * i) / seg; P.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]); } };
  P.push([-R + cr, R]); P.push([R - cr, R]); arc(R - cr, R - cr, Math.PI / 2, 0); P.push([R, -R + cr]); arc(R - cr, -R + cr, 0, -Math.PI / 2); P.push([-R + cr, -R]); arc(-R + cr, -R + cr, -Math.PI / 2, -Math.PI); P.push([-R, R - cr]); arc(-R + cr, R - cr, -Math.PI, -Math.PI * 1.5);
  return P;
}
