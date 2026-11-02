// 부스터 효과 (드림 러너 · 꾸미기 미리보기가 같이 쓴다): 등 뒤에서 뿜는 불꽃 + 흩날리는 가루
//   종류는 캐릭터 look.booster 번호로 저장한다. 이름은 look.js 의 LOOK_PARTS.booster · 같은 순서로 뒤에만 덧붙인다
import * as THREE from 'three';

const FLAME_G = new THREE.ConeGeometry(1, 1, 12, 1, true).translate(0, -0.5, 0); // 꼭짓점이 원점, 몸통은 아래로

// ---------- 가루 그림 ----------
const texCache = {};
function canvasTex(draw) { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); }
const starPath = (x, n, R, r) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, q = i % 2 ? r : R; x.lineTo(32 + Math.cos(a) * q, 32 + Math.sin(a) * q); } x.closePath(); };
const DRAW = {
  glow: (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); },
  star: (x) => { x.fillStyle = '#fff'; starPath(x, 5, 30, 12); x.fill(); },
  heart: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 56); x.bezierCurveTo(-8, 28, 12, 2, 32, 20); x.bezierCurveTo(52, 2, 72, 28, 32, 56); x.fill(); },
  bubble: (x) => { x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 4; x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); x.stroke(); x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.ellipse(22, 22, 7, 4, -0.7, 0, 7); x.fill(); },
  puff: (x) => { const g = x.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); },
  petal: (x) => { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(32, 6); x.bezierCurveTo(60, 22, 48, 54, 32, 58); x.bezierCurveTo(16, 54, 4, 22, 32, 6); x.fill(); },
  bolt: (x) => { x.strokeStyle = '#fff'; x.lineWidth = 3; x.lineJoin = 'round'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; x.beginPath(); x.moveTo(32, 32); for (let k = 1; k <= 4; k++) { const b = a + (k % 2 ? 0.28 : -0.28), r = k * 7.5; x.lineTo(32 + Math.cos(b) * r, 32 + Math.sin(b) * r); } x.stroke(); } },
};
const texOf = (k) => (texCache[k] ||= canvasTex(DRAW[k]));

// ---------- 종류 (look.js 의 이름과 같은 순서) ----------
//   flame: [바깥, 안쪽] 색 · 없으면 줄기 없이 가루만   colors: 가루 색 ('rainbow' 면 돌아가며)   tex: 가루 그림   add: 빛처럼 더하기(밝은 하늘에선 하얗게 보이니 모양 가루는 끈다)
//   back · up · side: 가루 빠르기   g: 중력   life · size: 수명 · 크기   rate: 많이 뿜는 정도(작을수록 많이)   grow: 점점 커진다   spin: 빙글
const STYLES = [
  { flame: ['#ff8a3d', '#9be7ff'], halo: '#ffb36b', colors: ['#ffd27a', '#ff8a3d'], tex: 'glow', add: true, back: [3, 7], up: 1.5, side: 2, g: 3, life: 0.3, size: 0.3, rate: 0.025 },
  { flame: ['#2f7bff', '#ffffff'], halo: '#6bb8ff', colors: ['#bfe8ff', '#3d8bff'], tex: 'glow', add: true, back: [3, 7], up: 1.5, side: 2, g: 3, life: 0.3, size: 0.3, rate: 0.025 },
  { flame: ['#9b4dff', '#ff9be7'], halo: '#c07bff', colors: ['#e2b3ff', '#9b4dff'], tex: 'glow', add: true, back: [2, 5], up: 2.2, side: 1.5, g: -1, life: 0.45, size: 0.3, rate: 0.025 },
  { flame: ['rainbow', '#ffffff'], halo: 'rainbow', colors: 'rainbow', tex: 'glow', add: true, back: [3, 7], up: 1.5, side: 2.4, g: 2, life: 0.45, size: 0.32, rate: 0.018 },
  { halo: '#ffe27a', colors: ['#ffe066', '#ffc93c', '#fff3b0'], tex: 'star', back: [2, 5], up: 2.4, side: 2.4, g: 3, life: 0.6, size: 0.34, rate: 0.03, spin: 4 },
  { halo: '#ff8fc0', colors: ['#ff5c9d', '#ff8fc0', '#ff3b70'], tex: 'heart', back: [1.5, 4], up: 2.6, side: 1.8, g: -1, life: 0.7, size: 0.36, rate: 0.035 },
  { halo: '#bfefff', colors: ['#c8f1ff', '#e6fbff', '#a5e4ff'], tex: 'bubble', back: [1, 3.5], up: 2.2, side: 1.4, g: -2, life: 0.9, size: 0.38, rate: 0.04 },
  { halo: '#7ff0ff', bolt: '#a8f6ff', colors: ['#ffffff', '#7ff0ff', '#ffee70'], tex: 'glow', add: true, back: [5, 10], up: 3, side: 5, g: 0, life: 0.14, size: 0.2, rate: 0.016 },
  { halo: '#ffffff', colors: ['#ffffff', '#eef2f7', '#d7dfe8'], tex: 'puff', back: [1.5, 3.5], up: 1, side: 1, g: -0.6, life: 0.8, size: 0.5, rate: 0.03, grow: true },
  { halo: '#ffc4dc', colors: ['#ffb7d2', '#ffd9e6', '#ff9cc0'], tex: 'petal', back: [2, 5], up: 1, side: 3, g: 1.5, life: 0.9, size: 0.26, rate: 0.03, spin: 5 },
];
const addBlend = (on) => (on ? THREE.AdditiveBlending : THREE.NormalBlending);
const BACK = new THREE.Vector3();

export class Booster {
  constructor(scene, style = 0) {
    this.scene = scene;
    this.g = new THREE.Group();
    const mat = (o) => new THREE.MeshBasicMaterial({ transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // 양쪽 엉덩이 뒤로 두 줄기 (바깥 · 안쪽)
    this.flames = [-0.2, 0.2].map((x) => {
      const f = new THREE.Group(); f.position.set(x, 0, 0); f.rotation.x = Math.PI / 2; // 아래(-y) 로 뻗던 불꽃을 뒤(-z)로
      const outer = new THREE.Mesh(FLAME_G, mat(0.75)); outer.scale.set(0.2, 1, 0.2);
      const inner = new THREE.Mesh(FLAME_G, mat(0.95)); inner.scale.set(0.1, 0.65, 0.1);
      f.add(outer, inner); this.g.add(f);
      return { f, outer, inner };
    });
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf('glow'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.position.set(0, 0, -0.1); this.g.add(this.halo);
    this.bolt = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf('bolt'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.bolt.position.set(0, 0, -0.25); this.g.add(this.bolt);
    this.g.visible = false;
    this.sparks = []; this.emitT = 0;
    this.setStyle(style);
  }
  // 번호가 이상하면(다른 사람이 보낸 값이라 믿지 않는다) 기본 불꽃
  setStyle(i) {
    const st = STYLES[i | 0] || STYLES[0];
    if (st === this.st) return;
    this.st = st;
    const rb = st.flame?.[0] === 'rainbow';
    for (const fl of this.flames) {
      fl.f.visible = !!st.flame;
      if (st.flame) { if (!rb) fl.outer.material.color.set(st.flame[0]); fl.inner.material.color.set(st.flame[1]); }
    }
    if (st.halo !== 'rainbow') this.halo.material.color.set(st.halo);
    this.bolt.visible = !!st.bolt;
    if (st.bolt) this.bolt.material.color.set(st.bolt);
    for (const p of this.sparks) this.dress(p);
  }
  dress(p) { const m = p.m.material; m.map = texOf(this.st.tex); m.blending = addBlend(this.st.add); m.rotation = 0; m.needsUpdate = true; }
  attach(bear) { bear.root.add(this.g); this.g.position.set(0, 0.88, -0.42); }
  update(dt, k, t) {
    const st = this.st;
    this.g.visible = k > 0.03;
    if (this.g.visible) {
      if (st.flame) for (const [i, fl] of this.flames.entries()) {
        const fk = 0.75 + Math.sin(t * 40 + i * 2) * 0.15 + Math.random() * 0.1; // 시각 효과용 난수
        fl.outer.scale.set(0.2 + 0.08 * k, (0.5 + 1.4 * k) * fk, 0.2 + 0.08 * k);
        fl.inner.scale.set(0.1, (0.35 + 0.9 * k) * fk, 0.1);
        fl.outer.material.opacity = 0.75 * Math.min(1, k * 1.5);
        if (st.flame[0] === 'rainbow') fl.outer.material.color.setHSL((t * 0.9 + i * 0.25) % 1, 1, 0.55);
      }
      if (st.halo === 'rainbow') this.halo.material.color.setHSL((t * 0.9) % 1, 1, 0.6);
      this.halo.scale.setScalar(0.6 + 0.9 * k); this.halo.material.opacity = (st.flame || st.bolt ? 0.8 : 0.4) * k;
      if (st.bolt) { this.bolt.scale.setScalar((1 + Math.random() * 0.5) * (0.7 + 0.7 * k)); this.bolt.material.rotation = Math.random() * 6.28; this.bolt.material.opacity = (Math.random() < 0.8 ? 1 : 0.3) * Math.min(1, k * 1.5); }
      // 가루: 세게 뿜을수록 많이
      this.emitT -= dt;
      if (this.emitT <= 0) { this.emitT = st.rate / Math.max(0.2, k); this.spark(k); }
    }
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.v.y -= st.g * dt;
      const q = Math.max(0, p.life / p.max);
      p.m.material.opacity = st.add ? q : Math.min(1, q * 2);
      p.m.scale.setScalar(p.size * (st.grow ? 1.8 - q : 0.5 + q));
      if (st.spin) p.m.material.rotation += p.spin * dt;
      p.m.visible = p.life > 0;
    }
  }
  spark(k) {
    const st = this.st;
    let p = this.sparks.find((q) => q.life <= 0);
    if (!p) {
      if (this.sparks.length > 60) return;
      p = { m: new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })), v: new THREE.Vector3(), life: 0 };
      this.dress(p); this.scene.add(p.m); this.sparks.push(p);
    }
    this.g.updateWorldMatrix(true, false);
    p.m.position.setFromMatrixPosition(this.g.matrixWorld);
    p.m.position.x += (Math.random() - 0.5) * 0.4; p.m.position.y += (Math.random() - 0.5) * 0.3;
    // 몸 뒤쪽으로 흩날린다 (미리보기는 곰돌이가 돌아가니 몸 방향을 따른다)
    BACK.setFromMatrixColumn(this.g.matrixWorld, 2).setY(0).normalize();
    const back = st.back[0] + Math.random() * (st.back[1] - st.back[0]), side = (Math.random() - 0.5) * st.side;
    p.v.set(-BACK.x * back + BACK.z * side, Math.random() * st.up, -BACK.z * back - BACK.x * side);
    p.max = p.life = st.life * (0.8 + Math.random()); p.size = st.size * (0.8 + Math.random() * 0.8 * k); p.spin = st.spin ? (Math.random() - 0.5) * st.spin * 2 : 0;
    if (st.colors === 'rainbow') p.m.material.color.setHSL(Math.random(), 1, 0.6);
    else p.m.material.color.set(st.colors[Math.floor(Math.random() * st.colors.length)]);
    p.m.visible = true;
  }
  dispose() { this.g.removeFromParent(); for (const p of this.sparks) this.scene.remove(p.m); }
}
