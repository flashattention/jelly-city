// 꿈의 분위기: 하늘 · 안개 · 빛 · 떨어지면 빠지는 아래(용암·바다·구름…) · 떠다니는 알갱이 · 풍경 놓기
// 꿈이 바뀌면 2~3초 동안 부드럽게 다음 꿈의 색으로 물든다
import * as THREE from 'three';
import { bakeStatic, toon } from '../../shared/js/utils.js';
import { KITS } from './kits.js';
import { DEATH_Y } from './track.js';

const UNDER_Y = DEATH_Y + 3;
const col = (c) => new THREE.Color(c);

// ---------- 캔버스 텍스처 ----------
function tex(draw, n = 128, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const R = Math.random;
const UNDER_TEX = {
  lava: (c) => tex((x, n) => { x.fillStyle = '#5a0f00'; x.fillRect(0, 0, n, n); for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(R() * n, R() * n, 0, R() * n, R() * n, 10 + R() * 26); g.addColorStop(0, '#ffd166'); g.addColorStop(0.4, '#ff6d00'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } }),
  water: (c) => tex((x, n) => { x.fillStyle = c || '#2f7fb5'; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { const y = R() * n, x0 = R() * n; x.beginPath(); x.moveTo(x0, y); x.quadraticCurveTo(x0 + 10, y - 4, x0 + 22, y); x.stroke(); } }),
  clouds: (c) => tex((x, n) => { x.fillStyle = c || '#ffffff'; x.globalAlpha = 0.9; x.fillRect(0, 0, n, n); x.globalAlpha = 1; for (let i = 0; i < 18; i++) { const g = x.createRadialGradient(R() * n, R() * n, 0, R() * n, R() * n, 20 + R() * 30); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } }),
  toxic: (c) => tex((x, n) => { x.fillStyle = c || '#3c6e10'; x.fillRect(0, 0, n, n); for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(178,255,89,${0.2 + R() * 0.4})`; x.beginPath(); x.arc(R() * n, R() * n, 2 + R() * 8, 0, 7); x.fill(); } }),
  ice: (c) => tex((x, n) => { x.fillStyle = c || '#d6ecff'; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(R() * n, R() * n); for (let k = 0; k < 3; k++) x.lineTo(R() * n, R() * n); x.stroke(); } }),
  sand: (c) => tex((x, n) => { x.fillStyle = c || '#e0b46a'; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(0,0,0,.1)'; x.lineWidth = 3; for (let y = 8; y < n; y += 14) { x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(n / 3, y - 6, n * 2 / 3, y + 6, n, y); x.stroke(); } }),
  neon: (c) => tex((x, n) => { x.fillStyle = '#05000f'; x.fillRect(0, 0, n, n); x.strokeStyle = c || '#ff2bd6'; x.shadowColor = c || '#ff2bd6'; x.shadowBlur = 10; x.lineWidth = 3; x.strokeRect(0, 0, n, n); }),
  candy: (c) => tex((x, n) => { x.fillStyle = c || '#ff6fae'; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = -1; i < 4; i++) { x.beginPath(); x.moveTo(i * n / 2, 0); x.lineTo(i * n / 2 + n / 5, 0); x.lineTo(i * n / 2 + n / 5 + n, n); x.lineTo(i * n / 2 + n, n); x.fill(); } }),
  checker: () => tex((x, n) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111111' : '#f5f5f5'; x.fillRect(i * n / 2, j * n / 2, n / 2, n / 2); } }),
  city: () => tex((x, n) => { x.fillStyle = '#05040c'; x.fillRect(0, 0, n, n); for (let i = 0; i < 120; i++) { x.fillStyle = ['#ffd27a', '#ff4fa3', '#4fd8ff', '#ffffff'][i % 4]; x.globalAlpha = 0.4 + R() * 0.6; x.fillRect(R() * n, R() * n, 1.5, 1.5); } }),
  grass: (c) => tex((x, n) => { x.fillStyle = c || '#5f8f4e'; x.fillRect(0, 0, n, n); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${R() * 0.12})`; x.beginPath(); x.arc(R() * n, R() * n, 4 + R() * 12, 0, 7); x.fill(); } }),
  syrup: (c) => tex((x, n) => { x.fillStyle = c || '#ff8fc8'; x.fillRect(0, 0, n, n); for (let i = 0; i < 16; i++) { const g = x.createRadialGradient(R() * n, R() * n, 0, R() * n, R() * n, 10 + R() * 20); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } }),
};
const FLOW = { lava: 0.02, water: 0.04, toxic: 0.015, syrup: 0.01, clouds: 0.03 };

// 떠다니는 알갱이 모양
const PART_TEX = {};
function partTex(kind) {
  if (PART_TEX[kind]) return PART_TEX[kind];
  const t = tex((x, n) => {
    x.clearRect(0, 0, n, n);
    const c = n / 2;
    const dot = () => { const g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); };
    x.fillStyle = '#ffffff'; x.strokeStyle = '#ffffff';
    switch (kind) {
      case 'streak': { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(c - 1.5, 0, 3, n); break; }
      case 'diag': { x.lineWidth = 3; const g = x.createLinearGradient(0, 0, n, n); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.strokeStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(n - 4, n - 4); x.stroke(); break; }
      case 'petal': x.beginPath(); x.ellipse(c, c, c * 0.45, c * 0.8, 0.6, 0, 7); x.fill(); break;
      case 'leaf': x.beginPath(); x.moveTo(c, 4); x.quadraticCurveTo(n - 6, c, c, n - 4); x.quadraticCurveTo(6, c, c, 4); x.fill(); break;
      case 'square': x.fillRect(n * 0.2, n * 0.3, n * 0.6, n * 0.4); break;
      case 'ring': x.lineWidth = 5; x.beginPath(); x.arc(c, c, c - 6, 0, 7); x.stroke(); x.beginPath(); x.arc(c * 0.7, c * 0.7, c * 0.18, 0, 7); x.fill(); break;
      case 'flake': x.lineWidth = 5; for (let i = 0; i < 3; i++) { x.save(); x.translate(c, c); x.rotate(i * Math.PI / 3); x.beginPath(); x.moveTo(-c + 6, 0); x.lineTo(c - 6, 0); x.stroke(); x.restore(); } break;
      case 'z': x.font = `bold ${n * 0.8}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', c, c); break;
      case 'code': x.font = `bold ${n * 0.7}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(Math.random() < 0.5 ? '0' : '1', c, c); break;
      case 'paper': x.fillRect(n * 0.22, n * 0.15, n * 0.56, n * 0.7); break;
      case 'lantern': { const g = x.createRadialGradient(c, c, 0, c, c, c); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,1)'; x.fillRect(c - 10, c - 14, 20, 28); break; }
      default: dot();
    }
  }, 64, false);
  PART_TEX[kind] = t;
  return t;
}
// 알갱이 종류마다: 모양 · 크기 · 개수 · 움직임
const FX = {
  snow: { tex: 'flake', size: 0.45, n: 500, v: [0, -2.2, 0], wob: 1.2 },
  rain: { tex: 'streak', size: 1.2, n: 700, v: [0, -32, 0], wob: 0 },
  embers: { tex: 'dot', size: 0.35, n: 400, v: [0, 3, 0], wob: 1.5, add: true },
  petals: { tex: 'petal', size: 0.5, n: 300, v: [1, -1.6, 0], wob: 2 },
  leaves: { tex: 'leaf', size: 0.55, n: 260, v: [1.2, -1.8, 0], wob: 2 },
  confetti: { tex: 'square', size: 0.45, n: 380, v: [0, -2.5, 0], wob: 2.5, multi: true },
  paper: { tex: 'paper', size: 0.7, n: 160, v: [0.6, -1.4, 0], wob: 2.2 },
  bubbles: { tex: 'ring', size: 0.6, n: 260, v: [0, 2, 0], wob: 1 },
  fireflies: { tex: 'dot', size: 0.45, n: 260, v: [0, 0.2, 0], wob: 2, add: true, blink: true },
  sparkles: { tex: 'dot', size: 0.35, n: 360, v: [0, 0.3, 0], wob: 0.6, add: true, blink: true },
  lanterns: { tex: 'lantern', size: 1.4, n: 120, v: [0, 1.4, 0], wob: 0.5, add: true },
  dust: { tex: 'dot', size: 0.18, n: 400, v: [0, 0.1, 0], wob: 0.5 },
  ash: { tex: 'dot', size: 0.22, n: 500, v: [0.4, -1, 0], wob: 1 },
  static: { tex: 'square', size: 0.25, n: 600, v: [0, 0, 0], wob: 0, blink: true },
  rise: { tex: 'streak', size: 2.4, n: 500, v: [0, 45, 0], wob: 0, add: true },
  meteors: { tex: 'diag', size: 6, n: 40, v: [-40, -40, 0], wob: 0, add: true, high: true },
  zzz: { tex: 'z', size: 0.9, n: 90, v: [0.4, 1.2, 0], wob: 1 },
  code: { tex: 'code', size: 0.6, n: 500, v: [0, -7, 0], wob: 0, add: true },
};

export class Env {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.theme = null; this.target = null;
    // 하늘 (카메라를 따라다니는 큰 공)
    this.skyU = { top: { value: col('#4f7fd1') }, mid: { value: col('#f7d9a8') }, bot: { value: col('#d8b58a') } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.6, 0.0, 1.0), 0.7)) : mix(mid, bot, pow(clamp(-h * 2.5, 0.0, 1.0), 0.6)); gl_FragColor = vec4(c, 1.0); }',
    }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    scene.add(this.sky);
    // 별
    const sp = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.05; v.normalize().multiplyScalar(850); sp.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false; scene.add(this.stars);
    // 해 / 달
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: partTex('dot'), color: '#ffffff', transparent: true, depthWrite: false, fog: false }));
    this.sun.scale.setScalar(150); scene.add(this.sun);
    // 오로라
    this.aurora = new THREE.Group(); scene.add(this.aurora);
    const at = tex((x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }, 64, false);
    ['#69f0ae', '#40c4ff', '#b388ff'].forEach((c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 140, 24, 1), new THREE.MeshBasicMaterial({ map: at, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.position.set(-150 + i * 150, 220 + i * 30, -650); m.rotation.y = (i - 1) * 0.3; m.userData.base = m.geometry.attributes.position.array.slice(); this.aurora.add(m); });
    // 빛
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.1); scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight('#ffffff', 1.4); this.dir.position.set(30, 60, 20); scene.add(this.dir, this.dir.target);
    scene.fog = new THREE.Fog('#ffffff', 40, 300);
    // 아래 (두 장을 번갈아 써서 꿈이 바뀔 때 부드럽게 바뀐다)
    this.unders = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = UNDER_Y; m.visible = false; scene.add(m); return m; });
    this.underI = 0;
    // 풍경
    this.root = new THREE.Group(); scene.add(this.root);
    this.objs = [];
    this.next = {};
    this.parts = [];
    this.flashT = 0; this.boltT = 3;
    this.cur = null;
  }

  // 꿈 바꾸기 (instant 면 바로)
  setTheme(th, instant = false) {
    if (this.theme === th) return;
    this.theme = th;
    const tgt = {
      top: col(th.sky[0]), mid: col(th.sky[1]), bot: col(th.sky[2]),
      near: th.fog[0], far: th.fog[1], light: th.light, stars: th.stars,
      hemiG: col(th.plat[1]).lerp(col(th.sky[2]), 0.5), sun: th.sun ? col(th.sun) : null,
    };
    this.target = tgt;
    if (instant || !this.cur) this.cur = { top: tgt.top.clone(), mid: tgt.mid.clone(), bot: tgt.bot.clone(), near: tgt.near, far: tgt.far, light: tgt.light, stars: tgt.stars, hemiG: tgt.hemiG.clone(), sunA: tgt.sun ? 1 : 0 };
    if (tgt.sun) this.sun.material.color.copy(tgt.sun);
    // 아래
    const old = this.unders[this.underI];
    this.underI ^= 1;
    const u = this.unders[this.underI];
    if (th.under !== 'void' && UNDER_TEX[th.under]) {
      u.material.map?.dispose();
      u.material.map = UNDER_TEX[th.under](th.underC);
      u.material.map.repeat.set(60, 60);
      u.material.color.set('#ffffff');
      u.material.needsUpdate = true;
      u.visible = true; u.userData.want = th.under === 'clouds' ? 0.92 : 1; u.userData.flow = FLOW[th.under] || 0;
      if (instant) u.material.opacity = u.userData.want;
    } else { u.visible = false; u.userData.want = 0; }
    old.userData.want = 0;
    if (instant) { old.material.opacity = 0; old.visible = false; }
    // 알갱이
    for (const p of this.parts) p.dying = true;
    if (th.fx && FX[th.fx]) this.parts.push(this.makeParts(th.fx, th.fxC || '#ffffff', instant));
    // 흑백 영화
    this.renderer.domElement.style.filter = th.mono ? 'grayscale(1) contrast(1.15)' : '';
    for (const k of Object.keys(this.next)) delete this.next[k];
  }
  makeParts(kind, color, instant) {
    const d = FX[kind];
    const n = d.n;
    const pos = new Float32Array(n * 3), cols = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const palette = ['#ff5f8f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ffffff'].map(col);
    for (let i = 0; i < n; i++) { const c = d.multi ? palette[i % palette.length] : col(color); cols.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.PointsMaterial({ size: d.size, map: partTex(d.tex), vertexColors: true, transparent: true, opacity: instant ? 1 : 0, depthWrite: false, blending: d.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !d.high });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    this.scene.add(pts);
    return { pts, d, n, init: false, dying: false, ph: Float32Array.from({ length: n }, () => R() * 6.28) };
  }

  // 발판 하나가 생길 때: 그 구간에 테마의 풍경 조각을 놓는다 (꾸미기라서 무작위여도 된다)
  decorate(s0, s1, x, w, y, th) {
    for (const name of th.kits) {
      const k = KITS[name];
      if (!k) continue;
      const step = k.every * (k.place === 'far' ? 1.4 : k.place === 'sky' ? 1.2 : 2.2);
      let at = this.next[name] ?? s0 - R() * step;
      if (at < s0 - step) at = s0 - R() * step;
      while (at < s1) {
        if (at >= s0 - 2) this.spawn(name, k, at, x, w, y, th);
        at += step * (0.7 + R() * 0.9);
      }
      this.next[name] = at;
    }
  }
  spawn(name, k, s, x, w, y, th) {
    const r = { next: R, range: (a, b) => a + (b - a) * R(), int: (a, b) => Math.floor(a + (b - a + 1) * R()), pick: (a) => a[Math.floor(R() * a.length)], chance: (p) => R() < p };
    const P = { ...th.P, a: th.P?.a, l: th.P?.l };
    let o = k.build(r, P, w);
    const side = R() < 0.5 ? -1 : 1;
    let px = x, py = y, place = k.place;
    if (place === 'side') {
      // 트랙 옆 작은 섬 위에
      px = x + side * (w / 2 + r.range(4.5, 13)); py = y + r.range(-2.5, 0.5);
      const g = new THREE.Group(); g.add(o);
      const isl = islet(th); g.add(isl);
      if (!o.userData.anim) { const baked = bakeStatic(g); baked.userData.baked = true; o = baked; } else { o.userData.anim0 = o.userData.anim; o = g; o.userData.anim = (q, t, dt) => q.children[0].userData.anim(q.children[0], t, dt); }
      o.rotation.y = r.range(-0.5, 0.5);
      if (th.upside) { o.rotation.x = Math.PI; py = y + r.range(12, 18); }
    } else if (place === 'far') { px = x + side * r.range(45, 140); py = Math.min(y, 0) + UNDER_Y - 2; o.rotation.y = r.range(0, 6.28); }
    else if (place === 'sky') { px = x + side * r.range(12, 90); py = y + r.range(14, 50); }
    else if (place === 'over') { px = x; py = y; }
    else if (place === 'drift') { px = x + side * r.range(w / 2 + 2.5, w / 2 + 9); py = y + r.range(0.5, 5); }
    if (!o.userData.anim && !o.userData.baked) { const b = bakeStatic(o); b.userData.baked = true; o = b; }
    o.position.set(px, py, this.origin0 - s);
    o.userData.y0 = py;
    o.userData.s = s; o.userData.place = place;
    this.root.add(o);
    this.objs.push(o);
  }
  get origin0() { return this.originRef ? this.originRef.origin : 0; }
  shift(k) { for (const o of this.objs) o.position.z += k; }
  clear() { for (const o of this.objs) this.dispose(o); this.objs = []; for (const k of Object.keys(this.next)) delete this.next[k]; }
  dispose(o) { this.root.remove(o); if (o.userData.baked) o.traverse((c) => c.geometry?.dispose()); }

  update(dt, t, camera, ps, px, py) {
    const T = this.target, C = this.cur;
    if (!T) return;
    // 색 · 안개 · 빛 물들이기
    const k = 1 - Math.exp(-dt * 1.6);
    C.top.lerp(T.top, k); C.mid.lerp(T.mid, k); C.bot.lerp(T.bot, k); C.hemiG.lerp(T.hemiG, k);
    C.near += (T.near - C.near) * k; C.far += (T.far - C.far) * k; C.light += (T.light - C.light) * k; C.stars += (T.stars - C.stars) * k;
    C.sunA += ((T.sun ? 1 : 0) - C.sunA) * k;
    // 번개
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.theme.lightning) { this.boltT -= dt; if (this.boltT <= 0) { this.boltT = 2 + R() * 5; this.flashT = 0.18; } }
    const fl = this.flashT > 0 ? (Math.sin(this.flashT * 80) > 0 ? 1 : 0.3) : 0;
    this.skyU.top.value.copy(C.top).lerp(col('#ffffff'), fl * 0.5);
    this.skyU.mid.value.copy(C.mid).lerp(col('#ffffff'), fl * 0.6);
    this.skyU.bot.value.copy(C.bot);
    this.scene.fog.color.copy(C.mid); this.scene.fog.near = C.near; this.scene.fog.far = C.far;
    this.hemi.color.copy(C.top).lerp(col('#ffffff'), 0.55); this.hemi.groundColor.copy(C.hemiG);
    this.hemi.intensity = 1.25 * C.light + fl * 1.5; this.dir.intensity = 1.5 * C.light;
    this.dir.color.copy(C.mid).lerp(col('#ffffff'), 0.6);
    this.stars.material.opacity = C.stars;
    // 하늘 · 별 · 해는 카메라를 따라간다
    const cp = camera.position;
    this.sky.position.copy(cp); this.stars.position.copy(cp);
    this.sun.position.set(cp.x + 260, cp.y + 230, cp.z - 700); this.sun.material.opacity = C.sunA * 0.95;
    this.dir.position.set(px + 30, py + 60, cp.z + 20); this.dir.target.position.set(px, py, cp.z - 20);
    this.aurora.position.set(cp.x, 0, cp.z);
    for (const m of this.aurora.children) {
      m.material.opacity += ((this.theme.aurora ? 0.55 : 0) - m.material.opacity) * k;
      if (m.material.opacity > 0.01) { const p = m.geometry.attributes.position, b = m.userData.base; for (let i = 0; i < p.count; i++) p.setY(i, b[i * 3 + 1] + Math.sin(t * 0.6 + b[i * 3] * 0.02 + m.id) * 25); p.needsUpdate = true; }
    }
    // 아래
    for (const u of this.unders) {
      u.material.opacity += ((u.userData.want || 0) - u.material.opacity) * k;
      if (u.material.opacity < 0.01 && !u.userData.want) u.visible = false;
      u.position.x = cp.x; u.position.z = cp.z - 300;
      if (u.material.map) { u.material.map.offset.set(cp.x / 1600 * 60, (-u.position.z / 1600) * 60 + t * (u.userData.flow || 0)); }
    }
    // 알갱이
    this.updateParts(dt, t, cp, k);
    // 풍경: 움직이는 것 · 지나간 것 치우기
    const fall = this.theme.fall;
    this.objs = this.objs.filter((o) => {
      const s = o.userData.s;
      if (s < ps - (o.userData.place === 'far' || o.userData.place === 'sky' ? 120 : 50)) { this.dispose(o); return false; }
      if (s > ps + 260) return true;
      if (o.userData.anim) o.userData.anim(o, t, dt);
      // 떨어지는 꿈: 주변 것들이 위로 솟구쳐 지나간다
      if (fall && (o.userData.place === 'sky' || o.userData.place === 'drift')) { o.userData.y0 += dt * 14; o.position.y = o.userData.y0; if (o.userData.y0 > py + 70) o.userData.y0 -= 110; }
      return true;
    });
  }
  updateParts(dt, t, cp, k) {
    for (const P of this.parts) {
      const m = P.pts.material;
      m.opacity += ((P.dying ? 0 : 1) - m.opacity) * Math.min(1, dt * 2);
      const pos = P.pts.geometry.attributes.position, a = pos.array, d = P.d;
      const box = d.high ? { x: 220, y0: 60, y1: 220, z0: 60, z1: 600 } : { x: 28, y0: -8, y1: 24, z0: -6, z1: 110 };
      for (let i = 0; i < P.n; i++) {
        let x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
        const out = !P.init || z > cp.z + box.z0 + 6 || z < cp.z - box.z1 - 10 || y < cp.y + box.y0 - 2 || y > cp.y + box.y1 + 2 || Math.abs(x - cp.x) > box.x + 2;
        if (out) {
          x = cp.x + (R() * 2 - 1) * box.x;
          z = cp.z - box.z0 - R() * (box.z1 - box.z0);
          y = cp.y + box.y0 + R() * (box.y1 - box.y0);
          if (P.init) { if (d.v[1] < -1) y = cp.y + box.y1; else if (d.v[1] > 1) y = cp.y + box.y0; }
        }
        const w = d.wob ? Math.sin(t * 1.3 + P.ph[i]) * d.wob : 0;
        x += (d.v[0] + w) * dt; y += d.v[1] * dt; z += (d.v[2] + Math.cos(t + P.ph[i]) * d.wob * 0.5) * dt;
        a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
      }
      P.init = true;
      pos.needsUpdate = true;
      if (d.blink) m.size = d.size * (0.85 + Math.sin(t * 6) * 0.15);
    }
    this.parts = this.parts.filter((P) => { if (P.dying && P.pts.material.opacity < 0.02) { this.scene.remove(P.pts); P.pts.geometry.dispose(); P.pts.material.dispose(); return false; } return true; });
  }
}

// 트랙 옆 작은 섬 (풍경이 서 있는 땅)
function islet(th) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(ISLE_TOP, toon(th.plat[0]));
  top.scale.set(3, 0.6, 3); top.position.y = -0.3; g.add(top);
  const bot = new THREE.Mesh(ISLE_BOT, toon(th.plat[1]));
  bot.scale.set(3, 4, 3); bot.position.y = -2.6; g.add(bot);
  return g;
}
const ISLE_TOP = new THREE.CylinderGeometry(1, 1, 1, 9);
const ISLE_BOT = new THREE.ConeGeometry(1, 1, 9).rotateX(Math.PI);
