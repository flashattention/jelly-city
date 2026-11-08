// 젤리 오디세이 1장 세계: 바이러스가 차지한 GPU 신전 요새 (밤 · 불 · 연기 · 불티 · 0과 1 픽셀 재)
//   남쪽 성문 → 광장(목마) → 대리석 신전(둘레 기둥 회랑 · 안쪽 성소) · 둘레 성벽 · 바깥 해변 · 바다 · 먼 섬(훗날 젤리시티)
//   좌표: y 위, 북쪽 = -z. 신전 바닥은 높이 1.2 (둘레 계단으로 올라간다)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { virusFace, glow } from './virus.js';
const place = (o, p) => { if (p.position) o.position.copy(p.position); if (p.rotation) o.rotation.copy(p.rotation); if (p.scale) o.scale.copy(p.scale); return o; };

const R = (a, b) => a + Math.random() * (b - a);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, ...o });
export const PLAT = { x0: -22, x1: 22, z0: -62, z1: 8, h: 1.2 };
export const CELLA = { x: 12, z0: -54, z1: -8 };

// ---------- 그림 (모두 코드로) ----------
function canvasTex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const marbleTex = (rep) => canvasTex(256, 256, (g) => {
  g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R(120, 180)},${R(110, 160)},${R(100, 150)},${R(0.02, 0.07)})`; g.fillRect(R(0, 256), R(0, 256), R(2, 8), R(2, 8)); }
  g.strokeStyle = 'rgba(120,110,105,.22)'; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { g.beginPath(); let x = R(0, 256), y = R(0, 256); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += R(-30, 30); y += R(-30, 30); g.lineTo(x, y); } g.stroke(); }
}, rep);
const tileTex = (rep) => canvasTex(256, 256, (g) => {
  g.fillStyle = '#cfc6b6'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const k = R(-14, 14); g.fillStyle = `rgb(${200 + k},${192 + k},${178 + k})`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(90,80,70,${R(0.02, 0.08)})`; g.fillRect(i * 64 + R(2, 60), j * 64 + R(2, 60), R(1, 4), R(1, 4)); } }
  g.strokeStyle = 'rgba(40,30,25,.5)'; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); let x = R(0, 256), y = R(0, 256); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += R(-20, 20); y += R(-20, 20); g.lineTo(x, y); } g.stroke(); }
}, rep);
const stoneTex = (rep) => canvasTex(256, 256, (g) => {
  g.fillStyle = '#8e857a'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const k = R(-18, 18), off = r % 2 ? 32 : 0; g.fillStyle = `rgb(${150 + k},${140 + k},${126 + k})`; g.fillRect(c * 64 + off + 2, r * 32 + 2, 60, 28); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(30,25,20,${R(0.02, 0.08)})`; g.fillRect(R(0, 256), R(0, 256), 2, 2); }
}, rep);
const pcbTex = (rep, neon) => canvasTex(256, 256, (g) => {
  g.fillStyle = neon ? '#06301a' : '#123a2a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = neon ? '#39ff7a' : '#d9b45a'; g.lineWidth = 2;
  for (let i = 0; i < 40; i++) { g.beginPath(); let x = Math.round(R(0, 16)) * 16, y = Math.round(R(0, 16)) * 16; g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (Math.random() < 0.5) x += Math.round(R(-3, 3)) * 16; else y += Math.round(R(-3, 3)) * 16; g.lineTo(x, y); } g.stroke(); g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  for (let i = 0; i < 8; i++) { g.fillStyle = '#0b0f0d'; const x = R(10, 200), y = R(10, 200); g.fillRect(x, y, R(24, 50), R(14, 30)); }
}, rep);

// ---------- 불 · 연기 · 불티 · 픽셀 재: 점 하나하나를 셰이더로 움직인다 ----------
const FIRE_V = `attribute vec4 seed; attribute float strength; attribute float green; uniform float time; uniform float scale; varying float vA; varying vec3 vC;
  void main(){ float s = strength; float t = fract(time * (0.55 + seed.x * 0.5) + seed.y); float r = seed.w * (1.0 - t * 0.7);
    vec3 p = position + vec3(sin(seed.z * 6.28 + time * 2.0) * r, t * (1.4 + seed.w * 2.2) * (0.4 + s * 0.8), cos(seed.z * 6.28 + time * 1.7) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
    gl_PointSize = scale * (1.0 - t * 0.6) * (0.6 + seed.w) * s / -mv.z;
    vA = (1.0 - t) * smoothstep(0.0, 0.12, t) * s;
    vec3 hot = mix(vec3(1.0, 0.95, 0.6), vec3(0.75, 1.0, 0.8), green), mid = mix(vec3(1.0, 0.45, 0.08), vec3(0.15, 1.0, 0.35), green), cool = mix(vec3(0.6, 0.06, 0.02), vec3(0.0, 0.35, 0.1), green);
    vC = t < 0.35 ? mix(hot, mid, t / 0.35) : mix(mid, cool, (t - 0.35) / 0.65); }`;
const FIRE_F = `uniform sampler2D tex; varying float vA; varying vec3 vC; void main(){ vec4 c = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(vC, c.a * vA); }`;
const SMOKE_V = `attribute vec4 seed; attribute float strength; uniform float time; varying float vA;
  void main(){ float t = fract(time * (0.06 + seed.x * 0.05) + seed.y);
    vec3 p = position + vec3(sin(seed.z * 6.28) * t * 6.0 + t * t * 7.0, t * (14.0 + seed.w * 12.0), cos(seed.z * 6.28) * t * 6.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (900.0 + t * 2600.0) * (0.5 + seed.w) / -mv.z;
    vA = sin(t * 3.14159) * 0.32 * strength; }`;
const SMOKE_F = `uniform sampler2D tex; uniform vec3 col; varying float vA; void main(){ vec4 c = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(col, c.a * vA); }`;
const EMBER_V = `attribute vec4 seed; attribute float strength; uniform float time; varying float vA; varying float vG; attribute float glyph;
  void main(){ float t = fract(time * (0.12 + seed.x * 0.15) + seed.y);
    vec3 p = position + vec3(sin(seed.z * 6.28 + time * (0.6 + seed.w)) * (1.0 + t * 4.0) + t * 3.0, t * (8.0 + seed.w * 14.0), cos(seed.z * 6.28 + time * 0.8) * (1.0 + t * 4.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (glyph > 0.5 ? 70.0 : 26.0) * (0.6 + seed.w) / -mv.z;
    vA = (1.0 - t) * strength * (0.6 + 0.4 * sin(time * 9.0 + seed.z * 40.0)); vG = glyph; }`;
const EMBER_F = `uniform sampler2D glyphs; varying float vA; varying float vG;
  void main(){ if (vG < 0.5) { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.62, 0.2, vA * smoothstep(0.5, 0.1, d)); return; }
    vec2 uv = vec2(gl_PointCoord.x * 0.5 + (vG > 1.5 ? 0.5 : 0.0), 1.0 - gl_PointCoord.y); vec4 c = texture2D(glyphs, uv); gl_FragColor = vec4(mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.9, 0.7), c.r), c.a * vA); }`;
function glyphTex() { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = '#ffb050'; g.shadowBlur = 8; g.fillText('0', 32, 34); g.fillText('1', 96, 34); const t = new THREE.CanvasTexture(c); return t; }

export class Fires {
  constructor(scene) { this.scene = scene; this.list = []; }
  // 불 자리 하나: x, y, z, 크기, 초록(감염) 여부
  add(x, y, z, size = 1, green = 0) { const f = { x, y, z, size, green, strength: 1, target: 1, idx: this.list.length }; this.list.push(f); return f; }
  build() {
    const fireN = 26, smokeN = 3, emberN = 7;
    const mk = (perFire, fn) => { const P = [], S = [], ST = [], G = [], GL = []; for (const f of this.list) for (let i = 0; i < Math.round(perFire * f.size); i++) { P.push(f.x + R(-0.5, 0.5) * f.size, f.y, f.z + R(-0.5, 0.5) * f.size); S.push(Math.random(), Math.random(), Math.random(), Math.random() * f.size); ST.push(1); G.push(f.green); GL.push(fn ? fn() : 0); (f.parts ||= []).push(ST.length - 1); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(S, 4)); g.setAttribute('strength', new THREE.Float32BufferAttribute(ST, 1)); g.setAttribute('green', new THREE.Float32BufferAttribute(G, 1)); g.setAttribute('glyph', new THREE.Float32BufferAttribute(GL, 1)); return g; };
    // 각 층이 불 자리마다 몇 번째 점부터인지 기억 (끄고 켤 때)
    const layer = (perFire, fn) => { const start = []; let n = 0; for (const f of this.list) { start.push(n); n += Math.round(perFire * f.size); } const g = mk(perFire, fn); for (const f of this.list) f.parts = null; return { g, start, per: perFire }; };
    this.u = { time: { value: 0 }, scale: { value: 520 }, tex: { value: glow() } };
    const fl = layer(fireN), sm = layer(smokeN), em = layer(emberN, () => (Math.random() < 0.45 ? (Math.random() < 0.5 ? 1 : 2) : 0));
    this.fire = new THREE.Points(fl.g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.smoke = new THREE.Points(sm.g, new THREE.ShaderMaterial({ uniforms: { time: this.u.time, tex: this.u.tex, col: { value: new THREE.Color('#1c1614') } }, vertexShader: SMOKE_V, fragmentShader: SMOKE_F, transparent: true, depthWrite: false }));
    this.ember = new THREE.Points(em.g, new THREE.ShaderMaterial({ uniforms: { time: this.u.time, glyphs: { value: glyphTex() } }, vertexShader: EMBER_V, fragmentShader: EMBER_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.layers = [[this.fire, fl], [this.smoke, sm], [this.ember, em]];
    for (const p of [this.fire, this.smoke, this.ember]) { p.frustumCulled = false; this.scene.add(p); }
    this.smoke.renderOrder = 2; this.fire.renderOrder = 3; this.ember.renderOrder = 4;
    // 불빛: 가까운 불에 옮겨 다니는 점광 12개
    this.lights = []; for (let i = 0; i < 12; i++) { const l = new THREE.PointLight('#ff8a3a', 0, 22, 1.6); this.scene.add(l); this.lights.push(l); }
  }
  setStrength(f, s) { f.target = s; }
  setGreen(f, g) { f.green = g; const a = this.fire.geometry.attributes.green, [, L] = this.layers[0]; for (let i = 0; i < Math.round(L.per * f.size); i++) a.array[L.start[f.idx] + i] = g; a.needsUpdate = true; }
  // 반경 안의 불을 끈다 (냉각의 신)
  douse(x, z, r) { let n = 0; for (const f of this.list) if (f.target > 0 && Math.hypot(f.x - x, f.z - z) < r) { f.target = 0; n++; } return n; }
  update(dt, t, camPos) {
    this.u.time.value = t;
    let dirty = false;
    for (const f of this.list) if (Math.abs(f.strength - f.target) > 0.001) { f.strength += (f.target - f.strength) * Math.min(1, dt * 1.5); if (Math.abs(f.strength - f.target) < 0.01) f.strength = f.target; dirty = true; }
    if (dirty) for (const [pts, L] of this.layers) { const a = pts.geometry.attributes.strength; for (const f of this.list) { const n = Math.round(L.per * f.size); for (let i = 0; i < n; i++) a.array[L.start[f.idx] + i] = f.strength; } a.needsUpdate = true; }
    // 불빛 옮기기 (0.25초마다)
    this.lt = (this.lt || 0) - dt;
    if (this.lt <= 0) { this.lt = 0.25; const near = this.list.filter((f) => f.strength > 0.05).sort((a, b) => Math.hypot(a.x - camPos.x, a.z - camPos.z) - Math.hypot(b.x - camPos.x, b.z - camPos.z)); this.lights.forEach((l, i) => { const f = near[i]; l.userData.f = f; if (f) { l.position.set(f.x, f.y + 1.2 * f.size, f.z); l.color.set(f.green ? '#46ff7a' : '#ff7a2a'); } }); }
    this.lights.forEach((l, i) => { const f = l.userData.f; l.intensity = f ? (6 + Math.sin(t * 13 + i) * 1.5 + Math.sin(t * 29 + i * 3) * 1.0) * f.strength * Math.min(1.6, f.size) : 0; });
  }
}

// ---------- GPU 신 칩 조각상 ----------
export const GODS = [
  { id: 'posecool', name: '포세쿨', title: '냉각의 신', col: '#4fd6ff', x: 27, z: 30, y: 0 },
  { id: 'mnemora', name: '므네모라', title: '기억의 여신', col: '#c78bff', x: -15.7, z: -50, y: PLAT.h },
  { id: 'hephavolt', name: '헤파볼트', title: '전원의 신', col: '#ffb14a', x: 15.7, z: -50, y: PLAT.h },
  { id: 'athenaris', name: '아테나리스', title: '렌더의 여신', col: '#ff7ad6', x: 0, z: -16, y: PLAT.h },
  { id: 'zeuron', name: '제우론', title: '연산의 왕', col: '#fff1a6', x: 0, z: -51, y: PLAT.h, big: true },
];
function nameplate(text, sub, col) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(20,16,12,.85)'; g.fillRect(0, 0, 512, 128); g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(6, 6, 500, 116); g.fillStyle = '#f3e6c4'; g.font = 'bold 50px Jua, sans-serif'; g.textAlign = 'center'; g.fillText(text, 256, 62); g.font = '28px Gowun Dodum, sans-serif'; g.fillStyle = col; g.fillText(sub, 256, 104); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function godStatue(G, mats) {
  const g = new THREE.Group(); g.position.set(G.x, G.y, G.z);
  const s = G.big ? 1.9 : 1;
  // 대좌: 대리석 계단 둘 + 받침
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(4 * s, 0.4, 4 * s), mats.marble), { position: new THREE.Vector3(0, 0.2, 0) }));
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(3.2 * s, 0.5, 3.2 * s), mats.marble), { position: new THREE.Vector3(0, 0.65, 0) }));
  g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 1.1 * s, 1.4 * s, 20), mats.marble), { position: new THREE.Vector3(0, 0.9 + 0.7 * s, 0) }));
  // 칩: 세워 둔 기판 + 금 다리 + 가운데 다이(신의 색으로 빛난다)
  const chip = new THREE.Group(); chip.position.y = 0.9 + 1.4 * s + 1.5 * s; g.add(chip);
  chip.add(new THREE.Mesh(new THREE.BoxGeometry(3 * s, 3 * s, 0.32 * s), new THREE.MeshStandardMaterial({ map: pcbTex([1, 1]), roughness: 0.5, metalness: 0.3 })));
  const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12 * s, 0.32 * s, 0.1 * s), mats.gold, 40); const o = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < 10; i++) for (const [x, y, rz] of [[-1.35 + i * 0.3, 1.66, 0], [-1.35 + i * 0.3, -1.66, 0], [1.66, -1.35 + i * 0.3, Math.PI / 2], [-1.66, -1.35 + i * 0.3, Math.PI / 2]]) { o.position.set(x * s, y * s, 0); o.rotation.set(0, 0, rz); o.updateMatrix(); pins.setMatrixAt(k++, o.matrix); }
  chip.add(pins);
  const dieM = new THREE.MeshStandardMaterial({ color: '#111', emissive: G.col, emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.2 });
  const die = new THREE.Mesh(new THREE.BoxGeometry(1.1 * s, 1.1 * s, 0.2 * s), dieM); die.position.z = 0.2 * s; chip.add(die);
  const back = die.clone(); back.position.z = -0.2 * s; chip.add(back);
  // 신마다 덧붙임: 냉각 = 방열 지느러미 · 전원 = 굵은 전선 · 왕 = 번개 고리
  if (G.id === 'posecool') for (let i = 0; i < 7; i++) chip.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.9), mats.steel), { position: new THREE.Vector3(-1.2 + i * 0.4, 0, -0.62) }));
  if (G.id === 'hephavolt') for (const sx of [-1, 1]) chip.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 18, Math.PI), mats.gold), { position: new THREE.Vector3(sx * 1.3, -1.6, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0) }));
  // 머리 위 월계관 고리 (빛)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2 * s, 0.07 * s, 8, 40), new THREE.MeshBasicMaterial({ color: G.col })); halo.position.y = chip.position.y + 2.2 * s; halo.rotation.x = Math.PI / 2; g.add(halo);
  // 이름표
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * s, 0.6 * s), new THREE.MeshBasicMaterial({ map: nameplate(G.name, G.title, G.col), transparent: true })); plate.position.set(0, 1.25, 1.62 * s + 0.02); g.add(plate);
  // 해방되면 하늘로 솟는 빛기둥
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.6 * s, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: G.col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = chip.position.y + 30; g.add(beam);
  // 감염: 초록 코드 덩굴 · 사슬 · 랜섬 자물쇠
  const inf = new THREE.Group(); g.add(inf);
  const vineM = new THREE.MeshStandardMaterial({ color: '#0c4a20', emissive: '#2bff63', emissiveIntensity: 1.2 });
  for (let v = 0; v < 6; v++) { const pts = []; const a0 = R(0, 6.28); for (let i = 0; i <= 14; i++) { const a = a0 + i * 0.7, rr = (1.3 + Math.sin(i) * 0.2) * s; pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.6 + i * (chip.position.y + 1.2 * s) / 14, Math.sin(a) * rr * 0.6)); } inf.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.07 * s, 6), vineM)); }
  const linkG = new THREE.TorusGeometry(0.16 * s, 0.05 * s, 6, 12); for (const d of [-1, 1]) for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(linkG, vineM); l.position.set(d * (1.6 - i * 0.36) * s, chip.position.y + (1.3 - i * 0.3) * s * d * d, 0.35 * s); l.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, 0.7 * d); inf.add(l); }
  const lock = new THREE.Group(); lock.position.set(0, chip.position.y - 0.4 * s, 0.6 * s); inf.add(lock);
  lock.add(new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.8 * s, 0.35 * s), vineM)); lock.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.3 * s, 0.07 * s, 6, 14, Math.PI), vineM), { position: new THREE.Vector3(0, 0.4 * s, 0) }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * s, 0.5 * s), new THREE.MeshBasicMaterial({ map: virusFace(), transparent: true })); face.position.z = 0.18 * s; lock.add(face);
  const L = new THREE.PointLight(G.col, 0, 18 * s, 1.5); L.position.y = chip.position.y; g.add(L);
  return { g, chip, die: dieM, halo, beam, inf, light: L, top: chip.position.y };
}

// ---------- 목마: 곰돌이가 만든, 바이러스 눈에 '공짜 연산력 꾸러미'로 보이게 형광 초록 장식을 덕지덕지 붙인 기판 목마 ----------
function horse(mats) {
  const g = new THREE.Group(), pcb = new THREE.MeshStandardMaterial({ map: pcbTex([2, 2]), roughness: 0.6, metalness: 0.2 }), neon = new THREE.MeshStandardMaterial({ color: '#0c3a1a', emissive: '#4bff7a', emissiveIntensity: 1.4 }), wood = std('#6b4a30');
  const box = (w, h, d, x, y, z, m = pcb, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; };
  // 받침 수레 + 바퀴
  box(5.4, 0.5, 11, 0, 0.9, 0, wood);
  for (const sx of [-1, 1]) for (const sz of [-4, 0, 4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.4, 18), wood); w.rotation.z = Math.PI / 2; w.position.set(sx * 2.9, 0.85, sz); g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.45, 10), mats.gold); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub); }
  // 다리 · 몸 · 목 · 머리 · 귀 · 꼬리
  for (const sx of [-1, 1]) for (const sz of [-3.2, 3.2]) box(0.9, 4.2, 0.9, sx * 1.5, 3.2, sz);
  const body = box(3.6, 3.4, 9.4, 0, 6.8, 0);
  box(3.0, 0.3, 2.6, 0, 5.05, 0.4, std('#3a2a1c')); // 배 문 자리
  const hatch = new THREE.Group(); hatch.position.set(0, 5.1, -0.9); g.add(hatch); const hp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 2.6), pcb); hp.position.z = 1.3; hatch.add(hp);
  const neck = box(2.4, 5.2, 2.6, 0, 10, -4.2, pcb, -0.45);
  const head = box(2.2, 2.0, 4.0, 0, 12.6, -6.6, pcb, 0.15);
  for (const sx of [-1, 1]) { box(0.4, 1.0, 0.4, sx * 0.7, 13.9, -5.6); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), neon); eye.position.set(sx * 1.12, 12.9, -7.4); g.add(eye); }
  // 갈기 = 형광 케이블 다발
  for (let i = 0; i < 9; i++) { const pts = []; for (let k = 0; k < 6; k++) pts.push(new THREE.Vector3(R(-0.2, 0.2), 13.4 - i * 0.62 - k * 0.15, -6 + i * 0.55 + k * 0.5)); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.12, 6), neon)); }
  { const pts = []; for (let k = 0; k < 8; k++) pts.push(new THREE.Vector3(Math.sin(k) * 0.5, 7.5 - k * 0.6, 4.8 + k * 0.35)); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.22, 8), neon)); }
  // 몸을 감싼 케이블 · 형광 띠 · 리본
  for (let i = 0; i < 6; i++) { const z = -3.8 + i * 1.5, t = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.09, 6, 30), i % 2 ? neon : mats.gold); t.position.set(0, 6.8, z); t.scale.set(0.95, 0.9, 1); g.add(t); }
  // 꾸러미 간판: "공짜 연산력 · FREE COMPUTE PATCH"
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d'); x.fillStyle = '#062a12'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#4bff7a'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 148); x.fillStyle = '#b8ffcf'; x.font = 'bold 56px Jua, sans-serif'; x.textAlign = 'center'; x.fillText('🎁 공짜 연산력!', 256, 72); x.font = 'bold 30px monospace'; x.fillStyle = '#4bff7a'; x.fillText('FREE_COMPUTE_PATCH.exe', 256, 122);
  const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace; for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.56), new THREE.MeshBasicMaterial({ map: st })); s.position.set(sx * 1.82, 6.8, 0.6); s.rotation.y = sx * Math.PI / 2; g.add(s); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#38ff6a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.set(16, 16, 1); halo.position.y = 7; g.add(halo);
  return { g, hatch, body, neck, head };
}

// ---------- 하늘 · 바다 ----------
const SKY_V = 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_F = `uniform float night, dawn; varying vec3 vD; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
  void main(){ float y = max(vD.y, 0.0);
    vec3 dusk = mix(vec3(1.0, 0.55, 0.32), vec3(0.32, 0.25, 0.48), pow(y, 0.5));
    vec3 nite = mix(vec3(0.26, 0.12, 0.10), vec3(0.03, 0.04, 0.10), pow(y, 0.35));
    vec3 dawnC = mix(vec3(1.0, 0.72, 0.55), vec3(0.45, 0.62, 0.9), pow(y, 0.45));
    vec3 c = mix(mix(dusk, nite, night), dawnC, dawn);
    vec3 q = floor(vD * 380.0); c += vec3(step(0.997, h(q))) * smoothstep(0.05, 0.4, vD.y) * night * (1.0 - dawn) * 0.8;
    gl_FragColor = vec4(c, 1.0); }`;
const SEA_F = `uniform float time, night, dawn; varying vec3 vW; void main(){
    float w = sin(vW.x * 0.08 + time * 0.7) * cos(vW.z * 0.06 - time * 0.5) + sin(vW.x * 0.21 - vW.z * 0.13 + time * 1.3) * 0.5;
    vec3 deep = mix(mix(vec3(0.25, 0.22, 0.32), vec3(0.02, 0.05, 0.1), night), vec3(0.25, 0.4, 0.55), dawn);
    vec3 c = deep + vec3(w * 0.03); float sp = pow(max(0.0, w), 10.0); c += mix(vec3(1.0, 0.5, 0.2) * 0.08, vec3(1.0, 0.85, 0.7) * 0.25, dawn) * sp;
    float d = length(vW.xz); c = mix(c, mix(vec3(0.2, 0.1, 0.12), vec3(0.6, 0.6, 0.72), dawn), smoothstep(400.0, 1600.0, d));
    gl_FragColor = vec4(c, 1.0); }`;

// ---------- 세계 짓기 ----------
export function buildWorld(scene) {
  const W = { circles: [], boxes: [], stutterMats: [], update: null };
  const mats = {
    marble: new THREE.MeshStandardMaterial({ map: marbleTex([1, 1]), roughness: 0.55, metalness: 0.02 }),
    marbleCol: new THREE.MeshStandardMaterial({ map: marbleTex([1, 3]), roughness: 0.5, vertexColors: true }),
    tile: new THREE.MeshStandardMaterial({ map: tileTex([20, 20]), roughness: 0.8 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex([8, 2]), roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e0ab45', roughness: 0.3, metalness: 1, envMapIntensity: 6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9aa2ab', roughness: 0.35, metalness: 0.9, envMapIntensity: 6 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#9b6b33', roughness: 0.4, metalness: 0.85, envMapIntensity: 6 }),
    wood: std('#5a3d26'), dark: std('#2a2420'),
  };
  W.mats = mats; W.stutterMats.push(mats.marble, mats.marbleCol, mats.stone, mats.tile);
  // 하늘 · 바다 · 땅
  W.skyU = { night: { value: 0 }, dawn: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ uniforms: W.skyU, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false })); sky.renderOrder = -10; scene.add(sky); W.sky = sky;
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#fff1d8', transparent: true, depthWrite: false })); moon.scale.set(220, 220, 1); moon.position.set(-900, 900, -1600); scene.add(moon); W.moon = moon;
  W.seaU = { time: { value: 0 }, night: W.skyU.night, dawn: W.skyU.dawn };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1), new THREE.ShaderMaterial({ uniforms: W.seaU, vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: SEA_F })); sea.rotation.x = -Math.PI / 2; sea.position.y = -3; scene.add(sea);
  // 언덕(요새가 선 고원) · 해변
  const hill = new THREE.Mesh(new THREE.CylinderGeometry(150, 190, 6, 48, 1), new THREE.MeshStandardMaterial({ color: '#3b3128', roughness: 1 })); hill.position.set(0, -3.01, -10); scene.add(hill);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 64), new THREE.MeshStandardMaterial({ color: '#4a3f33', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -10); scene.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(220, 70), new THREE.MeshStandardMaterial({ color: '#b9a37c', roughness: 1 })); beach.rotation.x = -Math.PI / 2 - 0.04; beach.position.set(0, -1.3, 150); scene.add(beach);
  // 광장 바닥 (성문 안 ~ 신전 계단)
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(86, 70), mats.tile); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.01, 34); scene.add(plaza);
  // 신전 기단: 둘레 계단 3단 + 윗면
  for (let i = 0; i < 3; i++) { const e = 2.4 - i * 0.8, b = new THREE.Mesh(new THREE.BoxGeometry(PLAT.x1 - PLAT.x0 + e * 2, 0.4, PLAT.z1 - PLAT.z0 + e * 2), mats.marble); b.position.set(0, 0.2 + i * 0.4, (PLAT.z0 + PLAT.z1) / 2); scene.add(b); }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(PLAT.x1 - PLAT.x0, PLAT.z1 - PLAT.z0), new THREE.MeshStandardMaterial({ map: tileTex([10, 16]), roughness: 0.7 })); top.rotation.x = -Math.PI / 2; top.position.set(0, PLAT.h + 0.01, (PLAT.z0 + PLAT.z1) / 2); scene.add(top); W.stutterMats.push(top.material);
  // 기둥: 홈이 파인 도리아식 기둥 (몸통 · 기둥머리), 일부는 부서져 쓰러짐
  const colGeo = (() => {
    const h = 8.5, shaft = new THREE.CylinderGeometry(0.66, 0.78, h, 40, 6); const p = shaft.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.05 * Math.abs(Math.sin(a * 10)); p.setX(i, x * k); p.setZ(i, z * k); }
    shaft.translate(0, h / 2, 0); shaft.computeVertexNormals();
    const echinus = new THREE.CylinderGeometry(1.0, 0.7, 0.45, 32); echinus.translate(0, h + 0.22, 0);
    const abacus = new THREE.BoxGeometry(2.1, 0.35, 2.1); abacus.translate(0, h + 0.62, 0);
    const parts = [shaft, echinus, abacus].map((g) => { g = g.index ? g.toNonIndexed() : g; const c = []; const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const k = 0.55 + Math.min(1, pp.getY(i) / 4) * 0.45; c.push(k, k * 0.97, k * 0.94); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); delete g.attributes.uv; g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pp.count * 2), 2)); const uv = g.attributes.uv; for (let i = 0; i < pp.count; i++) uv.setXY(i, Math.atan2(pp.getZ(i), pp.getX(i)) / 6.28, pp.getY(i) / 9); return g; });
    return mergeGeometries(parts);
  })();
  const cols = [];
  for (const x of [-19.5, 19.5]) for (let z = 5.5; z >= -59.5; z -= 4.33) cols.push([x, z]);
  for (let x = -15.6; x <= 15.6; x += 3.9) { cols.push([x, 5.5]); cols.push([x, -59.5]); }
  for (const x of [-7, 7]) for (let z = -14; z >= -46; z -= 6.4) cols.push([x, z]); // 성소 안 두 줄
  const broken = new Set([3, 9, 22, 31, 40]);
  const im = new THREE.InstancedMesh(colGeo, mats.marbleCol, cols.length), o = new THREE.Object3D();
  cols.forEach(([x, z], i) => { const br = broken.has(i); o.position.set(x, PLAT.h, z); o.rotation.set(br ? R(-0.02, 0.02) : 0, R(0, 6), 0); o.scale.set(1, br ? R(0.35, 0.6) : 1, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); W.circles.push({ x, z, r: 0.85, h: 99 }); });
  scene.add(im); W.columns = im;
  // 쓰러진 기둥 토막 (조각) — 장애물
  for (const [x, z, a] of [[-14, 10, 0.4], [10, 14, -0.9], [-24, -20, 1.3], [24, -40, 0.2]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 2.2, 24), mats.marble); d.rotation.set(0, a, Math.PI / 2); d.position.set(x, 0.72, z); scene.add(d); W.circles.push({ x, z, r: 1.2, h: 1.4 }); }
  // 지붕 대들보 · 박공 (앞 · 뒤) · 반쯤 무너진 지붕
  const archM = mats.marble, beamH = PLAT.h + 9.15;
  for (const x of [-19.5, 19.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 67), archM); b.position.set(x, beamH + 0.8, -27); scene.add(b); }
  for (const z of [5.5, -59.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(41.2, 1.6, 2.2), archM); b.position.set(0, beamH + 0.8, z); scene.add(b); }
  // 세 줄 무늬 띠(트리글리프) 그림
  const tri = canvasTex(256, 64, (g) => { g.fillStyle = '#ddd5c6'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 4; i++) { g.fillStyle = '#9b927f'; for (let k = 0; k < 3; k++) g.fillRect(i * 64 + 12 + k * 14, 6, 8, 52); } }, [8, 1]);
  for (const z of [6.7, -60.7]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(41, 1.6), new THREE.MeshStandardMaterial({ map: tri })); f.position.set(0, beamH + 2.4, z); if (z < 0) f.rotation.y = Math.PI; scene.add(f); }
  for (const z of [5.5, -59.5]) {
    const shape = new THREE.Shape(); shape.moveTo(-21, 0); shape.lineTo(21, 0); shape.lineTo(0, 6.2); shape.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false }), archM); ped.position.set(0, beamH + 1.6, z - 1.1); scene.add(ped);
    // 박공 가운데 금빛 칩 부조
    const relief = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.3), mats.gold); relief.position.set(0, beamH + 3.6, z + (z > 0 ? 1.2 : -1.2)); relief.rotation.z = Math.PI / 4; scene.add(relief);
  }
  // 지붕: 뒤쪽 절반만 남고 앞은 무너져 하늘이 보인다
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(23, 0.5, 34), std('#7b4e36')); r.position.set(s * 10.5, beamH + 4.2, -42); r.rotation.z = -s * 0.28; scene.add(r); }
  // 성소 벽 (문 있는 앞벽)
  const wallMat = mats.marble, wh = 9;
  const addWall = (x0, z0, x1, z1, h = wh, y0 = PLAT.h, m = wallMat) => { const w = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), h, Math.abs(z1 - z0)), m); w.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); scene.add(w); if (y0 <= PLAT.h + 2) W.boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h: y0 + h }); return w; };
  addWall(-12.4, -54, -11.6, -8); addWall(11.6, -54, 12.4, -8); addWall(-12.4, -54.8, 12.4, -54);
  addWall(-12.4, -8.8, -3.2, -8); addWall(3.2, -8.8, 12.4, -8); addWall(-3.2, -8.8, 3.2, -8, 1.8, PLAT.h + 7.2);
  // 요새 성벽 (남쪽 가운데 성문) · 흉벽 · 망루
  const sw = mats.stone, WH = 10;
  addWall(-48, 70, -6, 72.5, WH, 0, sw); addWall(6, 70, 48, 72.5, WH, 0, sw); addWall(-6, 70, 6, 72.5, 3, WH - 3, sw);
  addWall(-48, -76, 48, -73.5, WH, 0, sw); addWall(-50.5, -76, -48, 72.5, WH, 0, sw); addWall(48, -76, 50.5, 72.5, WH, 0, sw);
  { const mer = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.4, 2.5), sw, 260); let k = 0; const put = (x, z, ry) => { o.position.set(x, WH + 0.7, z); o.rotation.set(0, ry, 0); o.scale.set(1, 1, 1); o.updateMatrix(); mer.setMatrixAt(k++, o.matrix); };
    for (let x = -47; x <= 47; x += 2.4) { if (Math.abs(x) > 6) put(x, 71.25, 0); put(x, -74.75, 0); } for (let z = -74; z <= 71; z += 2.4) { put(-49.25, z, Math.PI / 2); put(49.25, z, Math.PI / 2); } mer.count = k; scene.add(mer); }
  for (const [x, z] of [[-9, 71], [9, 71], [-49, 71], [49, 71], [-49, -75], [49, -75]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, WH + 5, 20), sw); t.position.set(x, (WH + 5) / 2, z); scene.add(t); W.circles.push({ x, z, r: 3.9, h: 99 }); const cap = new THREE.Mesh(new THREE.ConeGeometry(4.2, 4, 20), std('#5a3a2a')); cap.position.set(x, WH + 7, z); scene.add(cap); }
  // 성문: 두 짝 (청동 띠 · 초록 코드 자물쇠) — 도르래를 돌리면 열린다
  W.gate = { open: 0, doors: [] };
  const doorTex = canvasTex(128, 256, (g) => { g.fillStyle = '#4a3020'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 6; i++) { g.fillStyle = '#3a2416'; g.fillRect(i * 22, 0, 3, 256); } g.fillStyle = '#8e6a35'; for (const y of [30, 128, 226]) g.fillRect(0, y, 128, 12); g.fillStyle = '#c99a4a'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(10 + (i % 6) * 22, [36, 134, 232][Math.floor(i / 6)], 4, 0, 7); g.fill(); } });
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 6, 0, 71.2); scene.add(piv); const d = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 0.6), new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.8 })); d.position.set(-s * 3, 3.5, 0); piv.add(d); const lock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: '#0c4a20', emissive: '#2bff63', emissiveIntensity: 1.3 })); lock.position.set(-s * 0.4, 3.6, -0.45); piv.add(lock); W.gate.doors.push({ piv, s }); }
  W.gateBox = { x0: -6, x1: 6, z0: 70.6, z1: 71.8, h: 7 }; W.boxes.push(W.gateBox);
  // 도르래 (성문 안쪽 오른편)
  W.winch = { x: 9, z: 64, turn: 0, done: false };
  { const g = new THREE.Group(); g.position.set(9, 0, 64); scene.add(g); for (const sx of [-1, 1]) g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), mats.wood), { position: new THREE.Vector3(sx * 1.1, 1.1, 0) }));
    const drum = new THREE.Group(); drum.position.y = 1.6; g.add(drum); drum.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 16), mats.wood), { rotation: new THREE.Euler(0, 0, Math.PI / 2) }));
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), mats.wood); sp.rotation.x = (i / 4) * Math.PI; sp.position.x = 1.15; drum.add(sp); }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 7, 6), std('#c9b48a')); rope.position.set(-0.6, 5, 4); rope.rotation.x = 0.9; g.add(rope); W.winch.drum = drum; W.circles.push({ x: 9, z: 64, r: 1.4, h: 2.4 }); }
  // GPU 신 조각상
  W.gods = GODS.map((G) => { const s = godStatue(G, mats); scene.add(s.g); W.circles.push({ x: G.x, z: G.z, r: G.big ? 3.4 : 2.1, h: 99 }); return { ...G, ...s, freed: false }; });
  // 냉각의 신 분수 (포세쿨 둘레 물)
  { const G = W.gods[0]; const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.7, 40, 1, true), mats.marble); basin.position.set(G.x, 0.35, G.z); basin.material.side = THREE.DoubleSide; scene.add(basin); const water = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), new THREE.MeshStandardMaterial({ color: '#1f6f8a', emissive: '#0a3a55', roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 })); water.rotation.x = -Math.PI / 2; water.position.set(G.x, 0.55, G.z); scene.add(water); W.water = water; W.circles.push({ x: G.x, z: G.z, r: 4.9, h: 0.8 }); }
  // 바이러스가 지키는 장식 조각상 (곰 전사 상) — 감염되면 적이 된다
  W.statues = [[-20, 22], [20, 46], [-20, 46], [-13.5, -24], [13.5, -36]].map(([x, z]) => { const y = groundAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); g.add(place(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), mats.marble), { position: new THREE.Vector3(0, 0.4, 0) })); const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), mats.marble); body.scale.set(1, 1.2, 0.85); body.position.y = 1.6; g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mats.marble); head.position.y = 2.6; g.add(head); for (const sx of [-1, 1]) g.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mats.marble), { position: new THREE.Vector3(sx * 0.33, 2.98, 0) })); const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), mats.marble); sp.position.set(0.7, 1.8, 0.1); g.add(sp); const c = { x, z, r: 0.9, h: 3.2 }; W.circles.push(c); return { x, z, y, g, col: c, state: 'ok' }; });
  // 횃대(화로): 불이 타고, 바이러스가 감염시키면 초록 불이 되어 웜을 뿜는다
  W.fires = new Fires(scene);
  const brazierPos = [[-12, 18], [12, 18], [-28, 40], [28, 52], [-12, 62], [12, 52], [-15.7, -4], [-15.7, -22], [-15.7, -40], [15.7, -4], [15.7, -22], [15.7, -40], [-6, -30], [6, -30]];
  const brazG = (() => { const parts = []; const bowl = new THREE.CylinderGeometry(0.75, 0.4, 0.55, 16); bowl.translate(0, 1.45, 0); parts.push(bowl); for (let i = 0; i < 3; i++) { const leg = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6); const a = (i / 3) * Math.PI * 2; leg.rotateZ(0.25); leg.rotateY(a); leg.translate(Math.cos(a) * 0.32, 0.7, Math.sin(a) * 0.32); parts.push(leg); } return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))); })();
  W.braziers = brazierPos.map(([x, z]) => { const y = groundAt(x, z), m = new THREE.Mesh(brazG, mats.bronze); m.position.set(x, y, z); scene.add(m); const f = W.fires.add(x, y + 1.7, z, 0.75); const c = { x, z, r: 0.6, h: 2 }; W.circles.push(c); return { x, z, y, mesh: m, fire: f, state: 'ok' }; });
  // 전투로 번진 불: 지붕 · 기둥 아래 · 광장 짐더미 · 성벽 위
  for (const [x, z, s] of [[-17, 0, 1.6], [17, -10, 1.4], [-24, 28, 1.8], [26, 60, 1.5], [-30, 60, 1.6], [0, -3, 1.2], [-10, -58, 1.6], [10, -58, 1.6], [-19.5, -33, 1.3], [19.5, -52, 1.3], [34, 10, 2], [-36, 0, 2.2], [-40, -40, 2], [40, -30, 2]]) W.fires.add(x, groundAt(x, z) + 0.2, z, s);
  for (const [x, z, s] of [[-12, -42, 2.4], [12, -36, 2.2], [0, -48, 1.8]]) W.fires.add(x, PLAT.h + 9.8, z, s); // 지붕 위
  // 3막 회랑: 불 벽 (밸브로 냉각수를 열어야 지나간다)
  // 불 벽은 회랑부터 서쪽 성벽까지 이어져 돌아갈 수 없다
  W.fireWalls = [-14, -32].map((z) => { const fs = []; for (let x = -46.5; x <= -12.8; x += 1.4) fs.push(W.fires.add(x, groundAt(x, z), z, x > -19.5 ? 1.3 : 1.1)); const box = { x0: -48, x1: -12.4, z0: z - 0.8, z1: z + 0.8, h: 99 }; W.boxes.push(box); return { z, fs, box, valve: { x: -13.3, z: z + 3.2, done: false }, open: false }; });
  // 동쪽은 4막까지 불길로 막혀 있다 (회랑 · 성벽 사이 전부)
  { const fs = []; for (let x = 13; x <= 46.5; x += 1.4) fs.push(W.fires.add(x, groundAt(x, -4), -4, 1.1)); W.eastFire = { fs, box: { x0: 12.4, x1: 48, z0: -4.8, z1: -3.2, h: 99 } }; W.boxes.push(W.eastFire.box); }
  // 성소 문: 초록 코드 방화벽 (헤파볼트를 해방하면 열린다)
  { const t = canvasTex(128, 128, (g) => { g.fillStyle = 'rgba(10,60,25,.55)'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#7dff9a'; g.font = 'bold 12px monospace'; for (let k = 0; k < 11; k++) g.fillText(Array.from({ length: 14 }, () => (Math.random() < 0.5 ? '0' : '1')).join(''), 2, 12 + k * 11.5); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 7.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(0, PLAT.h + 3.6, -8.4); scene.add(m); W.cellaDoor = { mesh: m, tex: t, box: { x0: -3.2, x1: 3.2, z0: -8.8, z1: -8, h: 99 } }; W.boxes.push(W.cellaDoor.box); }
  for (const fw of W.fireWalls) { const v = fw.valve, g = new THREE.Group(); g.position.set(v.x, PLAT.h, v.z); scene.add(g); g.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 10), mats.steel), { position: new THREE.Vector3(0, 0.7, 0) })); const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 20), std('#2f7fd8', { metalness: 0.6 })); wheel.position.y = 1.45; wheel.rotation.x = Math.PI / 2; g.add(wheel); v.wheel = wheel; const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6, 8), mats.steel); pipe.rotation.z = Math.PI / 2; pipe.position.set(-3, 0.3, -3.2); g.add(pipe); }
  // 신탁석: 서 있는 돌판 · 빛나는 글귀 (체크포인트)
  W.oracles = [[-6, 50], [-15.7, 7.5], [0, -58], [-2.2, -11]].map(([x, z], i) => { const y = groundAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g); const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.5), new THREE.MeshStandardMaterial({ color: '#4a4e58', roughness: 0.6 })); slab.position.y = 1.3; g.add(slab);
    const t = canvasTex(128, 256, (c) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, 128, 256); c.fillStyle = '#ffe7a0'; c.font = 'bold 14px monospace'; for (let k = 0; k < 14; k++) c.fillText(Array.from({ length: 9 }, () => (Math.random() < 0.5 ? '0' : '1')).join(''), 18, 24 + k * 16); });
    const runes = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.35 })); runes.position.set(0, 1.3, 0.26); g.add(runes); W.circles.push({ x, z, r: 0.9, h: 2.6 }); return { x, z, y, g, runes, on: false, i }; });
  // 목마 (광장)
  W.horse = horse(mats); W.horse.g.position.set(0, 0, 38); scene.add(W.horse.g); W.circles.push({ x: 0, z: 34, r: 3.2, h: 99 }, { x: 0, z: 40, r: 3.2, h: 99 }, { x: 0, z: 43.5, r: 2.6, h: 99 });
  // 성 밖: 해변의 곰돌 군단 배(물러나는 척) · 먼 섬 = 훗날 젤리시티가 될 땅
  W.ships = []; for (let i = 0; i < 5; i++) { const s = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 16), std('#5a3a22')); hull.position.y = 0.4; s.add(hull); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 11, 6), std('#4a3020')); mast.position.y = 6; s.add(mast); const sail = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), new THREE.MeshStandardMaterial({ color: '#c42a32', side: THREE.DoubleSide })); sail.position.y = 7; s.add(sail); s.position.set(-60 + i * 30, -3, 230 + i * 25); scene.add(s); W.ships.push(s); }
  W.land = (() => { const g = new THREE.Group(); g.position.set(120, -3, 1100); scene.add(g); const hillM = new THREE.MeshStandardMaterial({ color: '#3d5a46', roughness: 1 }); for (const [x, z, r, h] of [[0, 0, 160, 50], [-140, 40, 110, 34], [150, 20, 120, 40], [40, 60, 70, 70]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillM); m.scale.y = h / r; m.position.set(x, 0, z); g.add(m); }
    // 곰 모양 산 (머리 + 귀) — 훗날 젤리시티의 상징
    const bh = new THREE.Mesh(new THREE.SphereGeometry(46, 24, 16), hillM); bh.position.set(40, 60, 70); g.add(bh); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), hillM); e.position.set(40 + sx * 36, 100, 70); g.add(e); }
    // 작은 항구 불빛 · 등대
    const lightM = new THREE.MeshBasicMaterial({ color: '#ffd28a' }); for (let i = 0; i < 40; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(R(3, 7), R(3, 10), R(3, 7)), std('#d9c7a8')); b.position.set(R(-60, 60), 2, R(-60, -20)); g.add(b); if (i % 3 === 0) { const w = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), lightM); w.position.set(b.position.x, 4, b.position.z + 3.6); g.add(w); } }
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 30, 12), std('#f2ece0')); lh.position.set(-80, 15, -70); g.add(lh); const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#ffe6a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); beacon.scale.set(40, 40, 1); beacon.position.set(-80, 32, -70); g.add(beacon);
    g.visible = false; return g; })();
  W.fires.build();
  W.groundAt = groundAt;
  W.update = (dt, t, cam) => {
    W.seaU.time.value = t; W.fires.update(dt, t, cam.position);
    for (const G of W.gods) { const k = G.freed ? 1 : 0; G.fadeK = (G.fadeK ?? k) + (k - (G.fadeK ?? k)) * Math.min(1, dt * 1.5); G.beam.material.opacity = G.fadeK * (0.18 + Math.sin(t * 2) * 0.04); G.light.intensity = 4 + G.fadeK * 10; G.light.color.set(G.freed ? G.col : '#38ff6a'); G.die.emissive.set(G.freed ? G.col : '#2bff63'); G.halo.material.color.set(G.freed ? G.col : '#1a8a3a'); G.halo.rotation.z += dt * 0.4; G.inf.visible = !G.freed; G.chip.rotation.y = Math.sin(t * 0.6 + G.x) * 0.15; }
    for (const O of W.oracles) O.runes.material.opacity = O.on ? 0.7 + Math.sin(t * 3) * 0.2 : 0.25;
    for (const d of W.gate.doors) d.piv.rotation.y = d.s * W.gate.open * 1.5;
    if (W.cellaDoor.mesh.visible) W.cellaDoor.tex.offset.y = (t * 0.3) % 1;
  };
  return W;
}
// 바닥 높이: 신전 기단 위는 1.2, 둘레 2.4m 는 계단으로 비스듬히
export function groundAt(x, z) {
  const dx = Math.max(PLAT.x0 - x, 0, x - PLAT.x1), dz = Math.max(PLAT.z0 - z, 0, z - PLAT.z1), d = Math.max(dx, dz);
  return d <= 0 ? PLAT.h : d >= 2.4 ? 0 : PLAT.h * (1 - d / 2.4);
}
