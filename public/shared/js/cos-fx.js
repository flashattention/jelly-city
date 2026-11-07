// 치장 그리기: 곰돌이(Roach) 몸에 오라 · 신발 · 등 장식 · 휘장 · 왕관을 붙인다 (모든 게임 공용)
//   발자취 · 2단 점프 · 가속 · 착지 가루는 세계 좌표로 흩날린다 (곰돌이가 지워지면 같이 사라지게 몸에 붙여 둔다)
import * as THREE from 'three';
import { itemById, cleanCos } from './cos-items.js';
import { isPhone } from './perf.js';

const texCache = {};
const star = (x, n, R, r) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, q = i % 2 ? r : R; x.lineTo(32 + Math.cos(a) * q, 32 + Math.sin(a) * q); } x.closePath(); };
const DRAW = {
  glow: (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); },
  star: (x) => { x.fillStyle = '#fff'; star(x, 5, 30, 12); x.fill(); },
  heart: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 56); x.bezierCurveTo(-8, 28, 12, 2, 32, 20); x.bezierCurveTo(52, 2, 72, 28, 32, 56); x.fill(); },
  bubble: (x) => { x.strokeStyle = '#fff'; x.lineWidth = 4; x.fillStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); x.stroke(); },
  flame: (x) => { const g = x.createRadialGradient(32, 40, 2, 32, 34, 28); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(60, 30, 54, 60, 32, 62); x.bezierCurveTo(10, 60, 4, 30, 32, 2); x.fill(); },
  petal: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 6); x.bezierCurveTo(60, 22, 48, 54, 32, 58); x.bezierCurveTo(16, 54, 4, 22, 32, 6); x.fill(); },
  bolt: (x) => { x.fillStyle = '#fff'; x.beginPath(); for (const [a, b] of [[38, 2], [14, 34], [29, 34], [22, 62], [50, 26], [34, 26]]) x.lineTo(a, b); x.closePath(); x.fill(); },
  skull: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 26, 21, 0, 7); x.fill(); x.fillRect(21, 40, 22, 16); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(24, 26, 6, 0, 7); x.arc(40, 26, 6, 0, 7); x.fill(); x.fillRect(29, 34, 6, 6); x.globalCompositeOperation = 'source-over'; },
  rune: (x) => { x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.stroke(); star(x, 3, 24, 24); x.stroke(); x.save(); x.translate(64, 64); x.rotate(Math.PI); star(x, 3, 24, 24); x.stroke(); x.restore(); },
  snow: (x) => { x.strokeStyle = '#fff'; x.lineWidth = 5; for (let i = 0; i < 3; i++) { x.save(); x.translate(32, 32); x.rotate((i * Math.PI) / 3); x.beginPath(); x.moveTo(-27, 0); x.lineTo(27, 0); x.stroke(); x.restore(); } },
  feather: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(50, 6); x.bezierCurveTo(10, 14, 6, 44, 14, 58); x.bezierCurveTo(36, 54, 56, 34, 50, 6); x.fill(); },
  coin: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 25, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 17, 0, 7); x.stroke(); x.globalCompositeOperation = 'source-over'; },
};
function texOf(k) { if (texCache[k]) return texCache[k]; const c = document.createElement('canvas'); c.width = c.height = 64; (DRAW[k] || DRAW.glow)(c.getContext('2d')); return (texCache[k] = new THREE.CanvasTexture(c)); }
const CC = new THREE.Color(), CC2 = new THREE.Color();
// 업적 치장의 무지개: 난이도마다 정해진 색들 사이를 돈다 (없으면 온 무지개)
const gpaint = (f, t, i = 0) => { if (!f?.grad) return paint('rainbow', t, i); const g = f.grad, x = (((t * 0.25 + i * 0.13) % 1) + 1) % 1 * g.length, a = Math.floor(x); return CC.set(g[a % g.length]).lerp(CC2.set(g[(a + 1) % g.length]), x - a); };
const paint = (col, t, i = 0) => (col === 'rainbow' ? CC.setHSL((t * 0.25 + i * 0.13) % 1, 1, 0.62) : CC.set(col));
const pick = (cols, i, t) => paint(cols === 'rainbow' ? 'rainbow' : cols[i % cols.length], t, i);
const QQ = new THREE.Quaternion(), WV = new THREE.Vector3(), WV2 = new THREE.Vector3();
// 치장 창 미리보기: 제자리 곰돌이도 달리는 것처럼 발자취가 뒤로 흘러간다 (게임에서는 0)
const DR = new THREE.Vector3();
const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
const glowM = (c, op = 0.85) => new THREE.MeshBasicMaterial({ color: c === 'rainbow' ? '#ffffff' : c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const SPH = new THREE.SphereGeometry(1, 12, 9), BOX = new THREE.BoxGeometry(1, 1, 1), RING = new THREE.TorusGeometry(1, 0.035, 8, 36), SASH = new THREE.TorusGeometry(1, 0.085, 8, 30);
const CONE = new THREE.ConeGeometry(1, 1, 4);
const WING = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.3, 0.55, 0.85, 0.72, 1.15, 0.5); s.bezierCurveTo(1, 0.25, 0.95, 0.05, 0.9, -0.1); s.bezierCurveTo(0.65, -0.05, 0.3, -0.25, 0, 0); return new THREE.ShapeGeometry(s); })();
const WING2 = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.15, 0.72); s.lineTo(0.92, 0.22); s.lineTo(1.05, -0.08); s.lineTo(0.68, 0.02); s.lineTo(0.6, -0.3); s.lineTo(0.32, -0.08); s.closePath(); return new THREE.ShapeGeometry(s); })();
const part = (p, g, m, x, y, z, sx = 1, sy = sx, sz = sx) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = false; p.add(o); return o; };

// 세계 좌표 가루: 한 곰돌이가 한 종류씩
class Spray {
  constructor(root, fx, max) {
    this.root = root; this.fx = fx; this.max = Math.max(8, Math.round(max * (isPhone ? 0.5 : 1)));
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(this.max * 3); this.col = new Float32Array(this.max * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ map: texOf(fx.shape), size: fx.size || 0.3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.pts.frustumCulled = false; root.add(this.pts);
    this.life = new Float32Array(this.max); this.age = new Float32Array(this.max); this.w = new Float32Array(this.max * 3); this.v = new Float32Array(this.max * 3); this.base = new Float32Array(this.max * 3); this.i = 0; this.live = 0;
  }
  emit(x, y, z, vx, vy, vz, life, t) {
    const i = this.i; this.i = (i + 1) % this.max;
    this.w[i * 3] = x; this.w[i * 3 + 1] = y; this.w[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz; this.life[i] = life; this.age[i] = 0;
    pick(this.fx.colors, i, t); this.base[i * 3] = CC.r; this.base[i * 3 + 1] = CC.g; this.base[i * 3 + 2] = CC.b;
  }
  update(dt) {
    const a = this.pts.geometry.attributes; let any = false;
    this.root.updateMatrixWorld();
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; this.pos[i * 3] = this.pos[i * 3 + 1] = this.pos[i * 3 + 2] = 0; continue; }
      this.age[i] += dt; const k = 1 - this.age[i] / this.life[i];
      if (k <= 0) { this.life[i] = 0; continue; }
      any = true;
      this.w[i * 3] += (this.v[i * 3] + DR.x) * dt; this.w[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.w[i * 3 + 2] += (this.v[i * 3 + 2] + DR.z) * dt;
      WV.set(this.w[i * 3], this.w[i * 3 + 1], this.w[i * 3 + 2]); this.root.worldToLocal(WV);
      this.pos[i * 3] = WV.x; this.pos[i * 3 + 1] = WV.y; this.pos[i * 3 + 2] = WV.z;
      this.col[i * 3] = this.base[i * 3] * k; this.col[i * 3 + 1] = this.base[i * 3 + 1] * k; this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
    }
    this.pts.visible = any; if (any) { a.position.needsUpdate = true; a.color.needsUpdate = true; }
  }
}

// 바닥에 깔리는 띠 (무지개 길 · 리본 길들): 발자국 자리를 이어 폭이 있는 띠를 그리고 뒤로 갈수록 옅어진다
//   띠는 가로로 색이 나뉜다 (colors 순서대로, 없으면 무지개 7색)
const RAIN7 = ['#ff3b5c', '#ff9a2e', '#ffe14d', '#4fe08a', '#3fc8ff', '#5b6bff', '#c45bff'];
const ribTex = {};
function ribbonTex(cols = RAIN7) {
  const key = cols.join(); if (ribTex[key]) return ribTex[key];
  const c = document.createElement('canvas'); c.width = 64; c.height = 4; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 64, 0);
  cols.forEach((col, i) => { g.addColorStop(cols.length > 1 ? 0.04 + i * (0.92 / (cols.length - 1)) : 0.5, col); });
  x.fillStyle = g; x.fillRect(0, 0, 64, 4); const e = x.createLinearGradient(0, 0, 64, 0); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(0.08, 'rgba(0,0,0,0)'); e.addColorStop(0.92, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = e; x.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (ribTex[key] = t);
}
// 이만큼 벌어지면 띠를 끊는다: 트랙이 1500m 마다 앞으로 옮겨질 때 · 되살아날 때 · 다른 사람 위치가 순간이동할 때 · 높은 곳에 내려앉을 때 · 공중에 오래 있을 때
//   (끊지 않으면 마지막 자리와 새 자리가 한 띠로 이어져서 트랙 위로 앞뒤로 쭉 늘어나거나 위아래로 벽처럼 선다)
const RIB_JUMP = 6, RIB_RISE = 1.2, RIB_GAP = 0.35;
class Ribbon {
  constructor(root, o) {
    this.root = root; this.w = o.w || 0.9; this.life = o.life || 1.2; this.N = 48; this.pts = []; this.acc = 0; this.off = 0;
    const g = new THREE.BufferGeometry(), n = this.N * 2; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); const uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < this.N; i++) { uv.set([0, i / this.N, 1, i / this.N], i * 4); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 4)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ribbonTex(o.colors), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })); // 밝은 바닥에서도 색이 날아가지 않게 보통 섞기 + 꼭짓점 투명도
    this.mesh.frustumCulled = false; root.add(this.mesh);
  }
  update(dt, on, x, y, z) {
    for (const p of this.pts) { p.a += dt; p.x += DR.x * dt; p.z += DR.z * dt; }
    while (this.pts.length && this.pts[0].a > this.life) this.pts.shift();
    this.off = on ? 0 : this.off + dt;
    this.acc += dt; if (on && this.acc > 0.025) {
      this.acc = 0;
      const L = this.pts[this.pts.length - 1];
      // 벌어졌으면 끊는다: 앞 띠 끝과 새 띠 시작에 투명한 자리를 하나씩 끼워 그 사이 조각이 안 보이게
      if (L && !L.cut && (Math.hypot(x - L.x, z - L.z) > RIB_JUMP || Math.abs(y + 0.04 - L.y) > RIB_RISE || this.offAt > RIB_GAP)) { this.pts.push({ ...L, cut: true }, { x, y: y + 0.04, z, a: 0, cut: true }); }
      this.pts.push({ x, y: y + 0.04, z, a: 0 }); this.offAt = 0;
      while (this.pts.length > this.N) this.pts.shift();
    }
    if (!on) this.offAt = this.off;
    const P = this.pts, n = P.length; this.mesh.visible = n > 1; if (n < 2) return;
    this.root.updateMatrixWorld();
    for (let i = 0; i < this.N; i++) {
      const j = Math.min(n - 1, i), p = P[j];
      // 방향은 끊긴 자리를 건너지 않고 같은 띠 안의 이웃으로만
      const q = P[Math.min(n - 1, j + 1)].cut && !p.cut ? p : P[Math.min(n - 1, j + 1)], o = P[Math.max(0, j - 1)].cut && !p.cut ? p : P[Math.max(0, j - 1)];
      let dx = q.x - o.x, dz = q.z - o.z; const L = Math.hypot(dx, dz); if (L > 1e-4) { dx /= L; dz /= L; } else { dx = 0; dz = 1; }
      const k = i < n && !p.cut ? Math.max(0, 1 - p.a / this.life) : 0, hw = this.w * 0.5 * (0.55 + 0.45 * k);
      for (let sd = 0; sd < 2; sd++) { const sgn = sd ? 1 : -1; WV2.set(p.x - dz * hw * sgn, p.y, p.z + dx * hw * sgn); this.root.worldToLocal(WV2); this.pos.set([WV2.x, WV2.y, WV2.z], (i * 2 + sd) * 3); this.col.set([1, 1, 1, Math.min(0.92, k * 1.1)], (i * 2 + sd) * 4); }
    }
    const a = this.mesh.geometry.attributes; a.position.needsUpdate = true; a.color.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export class CosFx {
  constructor(r, cos) {
    this.r = r; this.t = Math.random() * 10; this.parts = []; this.anim = []; this.sprays = {}; this.tick = 0; this.tr = 0; this.bo = 0;
    this.groups = new THREE.Group(); r.root.add(this.groups);
    this.cos = cleanCos(cos) || {};
    const fx = (s) => (this.cos[s] ? itemById.get(this.cos[s])?.fx : null);
    if (fx('aura')) this.aura(fx('aura'));
    if (fx('shoes')) this.shoes(fx('shoes'));
    if (fx('back')) this.back(fx('back'));
    if (fx('sash')) this.sash(fx('sash'));
    if (fx('crown')) this.crown(fx('crown'));
    if (fx('sash') && r.opts?.cosBadge) this.badge(itemById.get(this.cos.sash), !!this.cos.crown);
    for (const s of ['trail', 'jump', 'boost', 'land']) if (fx(s)) this.sprays[s] = new Spray(r.root, fx(s), s === 'trail' ? Math.max(60, Math.ceil((fx(s).rate || 26) * (fx(s).life || 1) * 1.3)) : s === 'boost' ? 60 : (fx(s).n || 16) + 8);
    if (fx('trail')?.ribbon) this.ribbon = new Ribbon(r.root, fx('trail').ribbon);
  }
  attach(parent, build) { const g = new THREE.Group(); parent.add(g); this.parts.push(g); build(g); return g; }
  aura(f) {
    this.attach(this.groups, (g) => {
      const n = Math.round(f.n * (isPhone ? 0.5 : 1)), geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = Array.from({ length: n }, () => [Math.random() * 6.28, 0.5 + Math.random() * 0.45, Math.random() * 1.9, 0.5 + Math.random()]);
      for (let i = 0; i < n; i++) { pick(f.colors, i, 0); col[i * 3] = CC.r; col[i * 3 + 1] = CC.g; col[i * 3 + 2] = CC.b; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: texOf(f.shape), size: f.size, vertexColors: true, transparent: true, depthWrite: false, blending: f.dark ? THREE.NormalBlending : THREE.AdditiveBlending })); pts.frustumCulled = false; g.add(pts);
      const rings = []; for (const [c, h, R] of [[f.ring, 0.06, 0.82], [f.ring2, 1.1, 0.62]]) if (c) { const m = glowM(c, 0.7), o = part(g, RING, m, 0, h, 0, R); o.rotation.x = Math.PI / 2; rings.push({ o, m, c }); }
      const rise = f.rise ?? 0.5;
      this.anim.push((dt, t) => {
        for (let i = 0; i < n; i++) { const [a, R, y0, sp] = seed[i], y = (y0 + t * rise * 0.35 * sp) % 2, ang = a + t * sp * 0.8; pos[i * 3] = Math.cos(ang) * R; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(ang) * R; if (f.colors === 'rainbow') { paint('rainbow', t, i); col[i * 3] = CC.r; col[i * 3 + 1] = CC.g; col[i * 3 + 2] = CC.b; } }
        geo.attributes.position.needsUpdate = true; if (f.colors === 'rainbow') geo.attributes.color.needsUpdate = true;
        rings.forEach((q, i) => { q.o.rotation.z = t * (i ? -1.4 : 1.1); q.m.opacity = 0.55 + Math.sin(t * 3 + i) * 0.25; if (q.c === 'rainbow') q.m.color.copy(paint('rainbow', t, i * 2)); const s = (i ? 0.62 : 0.82) * (1 + Math.sin(t * 2 + i) * 0.04); q.o.scale.setScalar(s); });
      });
    });
  }
  shoes(f) {
    for (const leg of this.r.legs || []) this.attach(leg, (g) => {
      const c = toon(f.color), sole = toon(f.sole || '#ffffff');
      part(g, SPH, c, 0, -0.56, 0.08, 0.215, f.tall ? 0.17 : 0.13, 0.27);
      if (f.tall) part(g, SPH, c, 0, -0.38, 0.02, 0.23, 0.2, 0.23);
      part(g, BOX, sole, 0, -0.66, 0.08, 0.34, 0.035, 0.48);
      if (f.shine) { const m = glowM(f.shine, 0.8), s = part(g, SPH, m, 0, -0.5, 0.33, 0.06); this.anim.push((dt, t) => { m.opacity = 0.4 + Math.abs(Math.sin(t * 4)) * 0.5; s.scale.setScalar(0.05 + Math.abs(Math.sin(t * 4)) * 0.04); }); }
      if (f.wing) { const m = new THREE.MeshBasicMaterial({ color: f.wing, side: THREE.DoubleSide }), side = leg.position.x > 0 ? 1 : -1, w = part(g, WING, m, side * 0.19, -0.5, -0.08, 0.26); w.rotation.y = side > 0 ? -0.6 : Math.PI + 0.6; const ph = Math.random(); this.anim.push((dt, t) => { w.rotation.z = Math.sin(t * 16 + ph) * 0.25; }); }
      if (f.flame) { const m = glowM(f.flame, 0.8), fl = part(g, CONE, m, 0, -0.74, -0.24, 0.13, 0.42, 0.13); fl.rotation.x = -1.9; this.anim.push((dt, t) => { fl.scale.y = 0.34 + Math.abs(Math.sin(t * 22)) * 0.2; }); }
    });
  }
  back(f) {
    const parent = this.r.torso || this.r.inner;
    this.attach(parent, (g) => {
      g.position.set(0, 1.12, -0.4);
      if (f.kind === 'halo') { const m = glowM(f.color, 0.85), o = part(g, RING, m, 0, 0.25, -0.1, 0.62); const o2 = part(g, RING, glowM(f.color, 0.4), 0, 0.25, -0.1, 0.8); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; part(o, BOX, m, Math.cos(a), Math.sin(a), 0, 0.16, 0.03, 0.03).rotation.z = a; } this.anim.push((dt, t) => { o.rotation.z = t * 0.6; o2.rotation.z = -t * 0.4; }); return; }
      const geo = f.sharp ? WING2 : WING, m = new THREE.MeshToonMaterial({ color: f.color, side: THREE.DoubleSide }), sc = f.big ? 1.5 : 1.05, gl = f.glow ? glowM(f.glow, 0.42) : null, ws = [];
      for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.x = s * 0.12; g.add(w); const a = new THREE.Mesh(geo, m); a.scale.set(s * sc, sc, sc); w.add(a); if (gl) { const b = new THREE.Mesh(geo, gl); b.scale.set(s * sc * 1.14, sc * 1.14, sc); b.position.z = -0.02; w.add(b); } ws.push({ w, s }); }
      this.anim.push((dt, t) => { const fl = Math.sin(t * (f.big ? 3.4 : 5)) * 0.32; for (const { w, s } of ws) w.rotation.y = s * (0.35 + fl); if (f.glow === 'rainbow') gl.color.copy(paint('rainbow', t)); });
    });
  }
  // 휘장: 어깨에서 옆구리로 비스듬한 띠 + 훈장. 등급이 높을수록 반짝임이 많다
  sash(f) {
    const parent = this.r.torso || this.r.inner;
    this.attach(parent, (g) => {
      g.position.set(0, 1.02, 0.01); g.rotation.z = -0.82; g.rotation.y = 0.05;
      const mat = new THREE.MeshStandardMaterial({ color: f.color, emissive: f.color, emissiveIntensity: 0.35 + f.tier * 0.12, metalness: 0.5, roughness: 0.3 });
      const band = part(g, SASH, mat, 0, 0, 0, 0.5, 0.64, 1); band.rotation.y = Math.PI / 2; // 몸에 붙는 넓은 띠
      const edge = glowM(f.rainbow ? 'rainbow' : f.tierColor, 0.75); part(g, RING, edge, 0.085, 0, 0, 0.5, 0.64, 0.6).rotation.y = Math.PI / 2; part(g, RING, edge, -0.085, 0, 0, 0.5, 0.64, 0.6).rotation.y = Math.PI / 2;
      const med = new THREE.MeshStandardMaterial({ color: f.tierColor, emissive: f.tierColor, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.2 }), medal = part(g, SPH, med, 0, 0.12, 0.51, 0.1, 0.1, 0.04); part(medal, RING, edge, 0, 0, 0.6, 1.1);
      // 반짝임: 띠를 따라 별이 돈다
      const L = Math.max(0, ((f.pr || 1) - 1) / 4.5), n = 2 + f.tier * 2 + Math.round(L * 10), sp = []; for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({ map: texOf('star'), color: f.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), o = new THREE.Sprite(m); g.add(o); sp.push({ o, m, a: (i / n) * 6.28 }); }
      this.anim.push((dt, t) => { const k = 0.35 + Math.abs(Math.sin(t * 2.4)) * 0.3; mat.emissiveIntensity = k + f.tier * 0.12 + L * 0.5; if (f.rainbow || L >= 0.6) { const c = gpaint(f, t); edge.color.copy(c); mat.emissive.copy(c); }
        for (const q of sp) { const a = q.a + t * 1.1; q.o.position.set(0, Math.sin(a) * 0.66, Math.cos(a) * 0.53); const s = Math.max(0, Math.sin(t * 6 + q.a * 5)); q.o.scale.setScalar(0.06 + s * (0.07 + f.tier * 0.035 + L * 0.06)); if (f.rainbow || L >= 0.6) q.m.color.copy(gpaint(f, t, q.a)); } });
    });
  }
  // 왕관: 머리 위에 떠서 천천히 돈다 (1위만). 어려운 난이도 1위일수록 크고 화려하다 (L 0 = 노멀 · 기록판, 1 = 지옥 초월)
  crown(f) {
    const parent = this.r.head || this.r.torso || this.r.inner, L = Math.max(0, Math.min(1, ((f.pr || 1) - 1) / 4.5));
    this.attach(parent, (g) => {
      const y0 = parent === this.r.head ? 0.86 : 2; g.position.set(0, y0, 0); g.scale.setScalar(1 + L * 0.3);
      const gold = new THREE.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ffb300', emissiveIntensity: 0.75, metalness: 1, roughness: 0.22 });
      const c = part(g, RING, gold, 0, 0, 0, 0.36); c.rotation.x = Math.PI / 2; c.scale.z = 2.6;
      const nP = 5 + Math.round(L * 4), gems = [];
      for (let i = 0; i < nP; i++) { const a = (i / nP) * 6.28, gm = glowM(f.grad ? f.grad[i % f.grad.length] : f.color, 1); part(g, CONE, gold, Math.cos(a) * 0.36, 0.13, Math.sin(a) * 0.36, 0.07, 0.26 + L * 0.12, 0.07); part(g, SPH, gm, Math.cos(a) * 0.36, 0.29 + L * 0.12, Math.sin(a) * 0.36, 0.05 + L * 0.02); gems.push(gm); }
      const halo = new THREE.SpriteMaterial({ map: texOf('glow'), color: '#ffdf7a', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }), hs = new THREE.Sprite(halo); hs.scale.setScalar(1.3 + L * 1.1); g.add(hs);
      // 하드 이상: 왕관 둘레를 거꾸로 도는 보석 띠
      let ring2 = null; if (L >= 0.2) { ring2 = new THREE.Group(); g.add(ring2); const n2 = 6 + Math.round(L * 8); for (let i = 0; i < n2; i++) { const a = (i / n2) * 6.28; part(ring2, SPH, glowM(f.grad ? f.grad[i % f.grad.length] : '#fff0a0', 0.95), Math.cos(a) * 0.58, 0.12, Math.sin(a) * 0.58, 0.035); } }
      // 광속 이상: 머리 위로 솟는 빛기둥
      let beam = null; if (L >= 0.6) { beam = new THREE.SpriteMaterial({ map: texOf('glow'), color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }); const bs = new THREE.Sprite(beam); bs.scale.set(0.55, 3.2 + L * 1.5, 1); bs.position.y = 1.5; g.add(bs); }
      // 초월: 비스듬히 도는 빛의 고리 두 개
      const orbits = []; if (L >= 0.8) for (let k = 0; k < 2; k++) { const og = new THREE.Group(); og.rotation.set(k ? 1.1 : -1.1, 0, k ? 0.5 : -0.5); g.add(og); const m = glowM('#ffffff', 0.7), o = part(og, RING, m, 0, 0.15, 0, 0.75 + k * 0.12); o.rotation.x = Math.PI / 2; o.scale.z = 0.25; orbits.push({ og, m, k }); }
      const sp = []; const nS = 7 + Math.round(L * 14); for (let i = 0; i < nS; i++) { const m = new THREE.SpriteMaterial({ map: texOf('star'), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), o = new THREE.Sprite(m); g.add(o); sp.push({ o, m, a: i * (6.28 / nS) * 1.7, r: 0.5 + (i % 3) * L * 0.18 }); }
      this.anim.push((dt, t) => { g.rotation.y = t * (0.7 + L * 0.5); g.position.y = y0 + Math.sin(t * 2) * 0.04; halo.opacity = 0.45 + Math.abs(Math.sin(t * 2.2)) * (0.4 + L * 0.2); halo.color.copy(gpaint(f, t)); gold.emissiveIntensity = 0.55 + Math.abs(Math.sin(t * 3)) * (0.5 + L * 0.5);
        if (L >= 0.8) gold.emissive.copy(gpaint(f, t * 0.6)).lerp(CC2.set('#ffb300'), 0.45);
        if (ring2) ring2.rotation.y = -t * 2.2;
        if (beam) { beam.opacity = 0.25 + Math.abs(Math.sin(t * 1.7)) * 0.35; beam.color.copy(gpaint(f, t, 0.5)); }
        for (const o of orbits) { o.og.rotation.y = t * (o.k ? -1.6 : 1.3); o.m.color.copy(gpaint(f, t, o.k * 0.5)); }
        for (const q of sp) { const a = q.a + t * (1.6 + L); q.o.position.set(Math.cos(a) * q.r, 0.15 + Math.sin(a * 2) * (0.22 + L * 0.2), Math.sin(a) * q.r); q.o.scale.setScalar(0.05 + Math.max(0, Math.sin(t * 7 + q.a * 4)) * (0.16 + L * 0.08)); q.m.color.copy(gpaint(f, t, q.a)); } });
    });
  }
  // 머리 위에 착용 중인 휘장 이름표 (드림 러너). 등급에 맞춰 빛나고, 전설은 무지개로 돈다
  badge(it, crown) {
    const f = it.fx, c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'), text = it.name.replace(/ 휘장$/, ''); x.font = 'bold 40px Jua, sans-serif'; const tw = Math.min(452, x.measureText(`🎗️ ${text}`).width), w = tw + 44, l = (512 - w) / 2;
    x.beginPath(); x.roundRect(l, 12, w, 72, 36); x.fillStyle = 'rgba(16,10,36,.86)'; x.fill(); x.lineWidth = 5; x.strokeStyle = f.tierColor; x.stroke(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.fillText(`🎗️ ${text}`, 256, 50, 452);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }), sp = new THREE.Sprite(m), H = crown ? 3.75 : 3.05; sp.scale.set(2.9, 0.54, 1); sp.position.y = H;
    const gm = new THREE.SpriteMaterial({ map: texOf('glow'), color: f.tierColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), gl = new THREE.Sprite(gm); gl.scale.set(Math.min(3.4, (w / 512) * 3.6), 0.9, 1); gl.position.y = H - 0.001;
    this.attach(this.groups, (g) => { g.add(gl, sp); });
    this.anim.push((dt, t) => { gm.opacity = 0.35 + Math.abs(Math.sin(t * 2.4)) * (0.2 + f.tier * 0.08); if (f.rainbow) gm.color.copy(gpaint(f, t)); });
  }
  // 터지는 효과: jump · land (드림 러너가 부른다)
  fire(name) {
    const sp = this.sprays[name]; if (!sp) return; const f = sp.fx; this.r.root.getWorldPosition(WV); const px = WV.x, py = WV.y, pz = WV.z, n = Math.round((f.n || 12) * (isPhone ? 0.5 : 1));
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + Math.random() * 0.3, s = 3 + Math.random() * 3; sp.emit(px, py + 0.25, pz, Math.cos(a) * s, (name === 'jump' ? -1.5 : 1) + Math.random() * 2, Math.sin(a) * s, 0.45 + Math.random() * 0.35, this.t); }
  }
  // 곰돌이가 달릴 때 · 가속할 때 뿜는다
  update(dt, speed, boost = 0) {
    this.t += dt; const t = this.t;
    for (const a of this.anim) a(dt, t);
    const emit = this.sprays.trail || this.sprays.boost;
    if (emit) { this.r.root.getWorldPosition(WV); this.wx = WV.x; this.wy = WV.y; this.wz = WV.z; }
    const tr = this.sprays.trail;
    // 미리보기(치장 창): 곰돌이 등 뒤로 흘려보내 달리는 것처럼
    if (this.r.opts?.cosPreview && speed > 1) { this.r.root.getWorldQuaternion(QQ); DR.set(0, 0, -5).applyQuaternion(QQ); DR.y = 0; } else DR.set(0, 0, 0);
    if (this.ribbon) { if (!emit) { this.r.root.getWorldPosition(WV); this.wx = WV.x; this.wy = WV.y; this.wz = WV.z; } this.ribbon.update(dt, speed > 1, this.wx, this.wy, this.wz); }
    if (tr && speed > 1) { this.tr += dt * (tr.fx.rate || 26); while (this.tr > 1) { this.tr--; tr.emit(this.wx + (Math.random() - 0.5) * 0.5, this.wy + 0.08, this.wz + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6, tr.fx.life * (0.7 + Math.random() * 0.5), t); } }
    const bo = this.sprays.boost;
    if (bo && boost > 0.05) { this.bo += dt * (bo.fx.rate || 50) * boost; while (this.bo > 1) { this.bo--; bo.emit(this.wx + (Math.random() - 0.5) * 0.4, this.wy + 0.8 + (Math.random() - 0.5) * 0.5, this.wz + 0.5, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 4, bo.fx.life * (0.7 + Math.random() * 0.6), t); } }
    for (const k in this.sprays) this.sprays[k].update(dt);
  }
  dispose() { this.ribbon?.dispose(); for (const g of this.parts) g.removeFromParent(); this.groups.removeFromParent(); for (const k in this.sprays) { const p = this.sprays[k].pts; p.removeFromParent(); p.geometry.dispose(); p.material.dispose(); } }
}
