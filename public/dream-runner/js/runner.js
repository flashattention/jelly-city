// 달리는 곰돌이: 앞으로는 저절로 달리고, 좌우 · 점프(2단, 공중제비) · 숙이기 · 밀치기
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';
import { speedAt } from './track.js';

const GRAV = 30, JUMP = 11.5, JUMP2 = 10.5, SIDE = 8.5;
export const BOOST = 0.5;  // ↑ · W 를 누르고 있으면 최대 50% 빨라진다
const BOOST_UP = 2, BOOST_DOWN = 2.5; // 꽉 차기까지 · 원래 속도로 돌아오기까지 (초)

// ---------- 부스터: 등 뒤에서 뿜는 제트 불꽃 + 흩날리는 불꽃 가루 ----------
const FLAME_G = new THREE.ConeGeometry(1, 1, 12, 1, true).translate(0, -0.5, 0); // 꼭짓점이 원점, 몸통은 아래로
let _glowTex = null;
function glowTex() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (_glowTex = new THREE.CanvasTexture(c));
}
class Booster {
  constructor(scene) {
    this.scene = scene;
    this.g = new THREE.Group();
    const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // 양쪽 엉덩이 뒤로 두 줄기 (바깥 주황 · 안쪽 하늘빛)
    this.flames = [-0.2, 0.2].map((x) => {
      const f = new THREE.Group(); f.position.set(x, 0, 0); f.rotation.x = Math.PI / 2; // 아래(-y) 로 뻗던 불꽃을 뒤(-z)로
      const outer = new THREE.Mesh(FLAME_G, mat('#ff8a3d', 0.75)); outer.scale.set(0.2, 1, 0.2);
      const inner = new THREE.Mesh(FLAME_G, mat('#9be7ff', 0.95)); inner.scale.set(0.1, 0.65, 0.1);
      f.add(outer, inner); this.g.add(f);
      return { f, outer, inner };
    });
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb36b', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.position.set(0, 0, -0.1); this.g.add(this.halo);
    this.g.visible = false;
    this.sparks = []; this.emitT = 0;
  }
  attach(bear) { bear.root.add(this.g); this.g.position.set(0, 0.88, -0.42); }
  update(dt, k, t) {
    this.g.visible = k > 0.03;
    if (this.g.visible) {
      for (const [i, fl] of this.flames.entries()) {
        const fk = 0.75 + Math.sin(t * 40 + i * 2) * 0.15 + Math.random() * 0.1;
        fl.outer.scale.set(0.2 + 0.08 * k, (0.5 + 1.4 * k) * fk, 0.2 + 0.08 * k);
        fl.inner.scale.set(0.1, (0.35 + 0.9 * k) * fk, 0.1);
        fl.outer.material.opacity = 0.75 * Math.min(1, k * 1.5);
      }
      this.halo.scale.setScalar(0.6 + 0.9 * k); this.halo.material.opacity = 0.8 * k;
      // 불꽃 가루: 세게 뿜을수록 많이
      this.emitT -= dt;
      if (this.emitT <= 0) { this.emitT = 0.025 / Math.max(0.2, k); this.spark(k); }
    }
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.v.y -= 3 * dt;
      p.m.material.opacity = Math.max(0, p.life / p.max);
      p.m.scale.setScalar(p.size * (0.5 + p.life / p.max));
      p.m.visible = p.life > 0;
    }
  }
  spark(k) {
    let p = this.sparks.find((q) => q.life <= 0);
    if (!p) {
      if (this.sparks.length > 60) return;
      p = { m: new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), v: new THREE.Vector3(), life: 0 };
      this.scene.add(p.m); this.sparks.push(p);
    }
    this.g.updateWorldMatrix(true, false);
    p.m.position.setFromMatrixPosition(this.g.matrixWorld);
    p.m.position.x += (Math.random() - 0.5) * 0.4; p.m.position.y += (Math.random() - 0.5) * 0.3;
    p.v.set((Math.random() - 0.5) * 2, Math.random() * 1.5, 3 + Math.random() * 4); // 뒤(+z)로 흩날린다
    p.max = p.life = 0.25 + Math.random() * 0.3; p.size = 0.25 + Math.random() * 0.25 * k;
    p.m.material.color.set(Math.random() < 0.5 ? '#ffd27a' : '#ff8a3d');
    p.m.visible = true;
  }
  dispose() { this.g.removeFromParent(); for (const p of this.sparks) this.scene.remove(p.m); }
}
export const H_STAND = 1.45, H_SLIDE = 0.7;

export const FLIP_T = 0.45; // 2단 점프 공중제비 시간

// 곰돌이 자세 (나 · 같은 방 사람 모두): Roach.update 로 달리기 동작을 만든 다음에 덮어쓴다
//   st = { ground, slide, flip(0~1 진행 · 없으면 null), vy, alive }
//   돌리는 축을 몸 안쪽(공중제비 = 배, 숙이기 = 엉덩이)으로 옮겨서 발끝을 축으로 빙 도는 어색함이 없게
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const lerp = (a, b, k) => a + (b - a) * k;
export function poseBear(b, st, dt) {
  const u = (b.poseState ||= { rx: 0, low: 0, slide: 0, air: 0, tuck: 0, flipping: false });
  const k = Math.min(1, dt * 16);
  let h = 0.85;
  if (!st.alive) {
    u.rx += dt * 7; // 탈락: 몸 가운데를 축으로 데굴데굴
    u.slide = lerp(u.slide, 0, k); u.low = lerp(u.low, 0, k); u.tuck = lerp(u.tuck, 1, k);
  } else if (st.flip != null) {
    // 공중제비: 천천히 시작해서 천천히 끝나게, 앞으로 한 바퀴
    u.flipping = true;
    u.rx = ease(Math.min(1, st.flip)) * Math.PI * 2;
    u.tuck = Math.sin(Math.min(1, st.flip) * Math.PI);
    u.slide = lerp(u.slide, 0, k); u.low = lerp(u.low, 0, k);
  } else {
    // 한 바퀴 다 돌았으면 0 으로 (되감기 없이)
    if (u.flipping) { u.flipping = false; u.rx = ((u.rx % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); if (u.rx > Math.PI) u.rx -= Math.PI * 2; }
    u.slide = lerp(u.slide, st.slide ? 1 : 0, k);
    u.air = lerp(u.air, !st.ground && !st.slide ? 1 : 0, Math.min(1, dt * 12));
    u.tuck = lerp(u.tuck, 0, k);
    const lean = st.slide ? -1.0 : !st.ground ? (st.vy > 0 ? 0.14 : 0.04) : 0.06; // 달릴 땐 살짝 앞으로
    u.rx = lerp(u.rx, lean, k);
    u.low = lerp(u.low, st.slide ? 0.36 : 0, k);
    h = lerp(0.85, 0.62, u.slide); // 숙일 땐 엉덩이를 축으로
  }
  const a = u.rx;
  b.inner.rotation.x = a;
  b.inner.position.y += h - h * Math.cos(a) - u.low;
  b.inner.position.z = -h * Math.sin(a);
  const [L0, L1] = b.legs, arms = b.arms.slice(0, 2);
  // 숙이기: 다리는 앞으로 쭉, 팔은 벌려 균형
  if (u.slide > 0.01) {
    for (const l of b.legs) l.rotation.x = lerp(l.rotation.x, -0.35, u.slide);
    for (const ar of arms) { ar.rotation.z = lerp(ar.rotation.z, ar.userData.baseZ * 2.3, u.slide); ar.rotation.x = lerp(ar.rotation.x, 0.35, u.slide); }
  }
  // 점프: 다리를 앞뒤로 벌리고 팔을 들어 올린다
  if (u.air > 0.01) {
    L0.rotation.x = lerp(L0.rotation.x, -0.75, u.air); L1.rotation.x = lerp(L1.rotation.x, 0.45, u.air);
    for (const ar of arms) { ar.rotation.z = lerp(ar.rotation.z, ar.userData.baseZ * (st.vy > 0 ? 1.7 : 2.1), u.air); ar.rotation.x = lerp(ar.rotation.x, -0.45, u.air); }
  }
  // 공중제비: 무릎을 가슴으로 · 팔로 끌어안고 몸을 동그랗게
  if (u.tuck > 0.01) {
    for (const l of b.legs) l.rotation.x = lerp(l.rotation.x, -1.35, u.tuck);
    for (const ar of arms) { ar.rotation.x = lerp(ar.rotation.x, -1.1, u.tuck); ar.rotation.z = lerp(ar.rotation.z, ar.userData.baseZ * 0.5, u.tuck); }
    const sq = 1 - 0.1 * u.tuck;
    b.inner.scale.set(b.inner.scale.x * (2 - sq), b.inner.scale.y * sq, b.inner.scale.z * (2 - sq));
  }
}

// 젤리 몸이 반투명이면 뒤에서 볼 때 앞쪽 주둥이 · 코가 비쳐서, 뒤로 달리는 것처럼 보인다
// → 드림 러너에서는 몸을 불투명하게 (반짝이는 하이라이트만 반투명으로 남긴다)
const solid = new Map();
function opaque(m) {
  if (!m?.transparent || m.opacity < 0.65) return m;
  let c = solid.get(m.uuid);
  if (!c) { c = m.clone(); c.transparent = false; c.opacity = 1; c.depthWrite = true; solid.set(m.uuid, c); }
  return c;
}
export function makeBear(p = {}) {
  const r = new Roach({ own: true, seed: p.name || 'dream', color: p.color || '#8a5634', age: 25, gender: p.gender, look: p.look, accessories: p.acc || [] });
  r.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material = Array.isArray(o.material) ? o.material.map(opaque) : opaque(o.material); } });
  r.bodyM = opaque(r.bodyM);
  return r;
}

export class Runner {
  constructor(scene, profile) {
    this.scene = scene;
    this.bear = makeBear(profile);
    scene.add(this.bear.root);
    this.booster = new Booster(scene); this.booster.attach(this.bear);
    // 발밑 그림자 (동그란 얼룩)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.reset();
  }
  setLook(profile) { this.scene.remove(this.bear.root); this.bear = makeBear(profile); this.scene.add(this.bear.root); this.booster.attach(this.bear); }
  reset(s = 0, x = 0) {
    Object.assign(this, { s, x, y: 0, boost: 0, vx: 0, vy: 0, knock: 0, onGround: true, jumps: 0, coyote: 0, jbuf: 0, slideT: 0, flipT: 0, shoveT: 0, alive: true, dead: null, stars: 0, plat: null, t: 0 });
    this.bear.inner.rotation.set(0, 0, 0); this.bear.root.scale.setScalar(1); this.bear.root.visible = true;
  }
  get v() { return speedAt(this.s) * (1 + BOOST * this.boost); }
  get h() { return this.slideT > 0 ? H_SLIDE : H_STAND; }

  // input: { dir(-1~1), jump(눌림), slide(눌림), slideHeld, boost(누르는 중) }
  update(dt, input, track, fx) {
    if (!this.alive) return this.updateDead(dt);
    this.t += dt;
    const prevS = this.s, prevY = this.y;
    // 가속: 누르고 있으면 점점 빨라지고, 떼면 서서히 원래 속도로
    const wasB = this.boost;
    this.boost = input.boost ? Math.min(1, this.boost + dt / BOOST_UP) : Math.max(0, this.boost - dt / BOOST_DOWN);
    if (input.boost && wasB < 0.02 && this.boost > 0) fx?.('boost');
    this.s += this.v * dt;
    // 좌우: 손 떼면 바로 멈추는 느낌 + 밀쳐진 힘은 서서히 줄어든다
    this.vx += ((input.dir || 0) * SIDE - this.vx) * Math.min(1, dt * 14);
    this.knock *= Math.exp(-dt * 2.6);
    this.x += (this.vx + this.knock) * dt;
    // 점프 (땅에서 떨어진 직후 0.1초 · 누른 직후 0.12초는 봐준다)
    if (input.jump) this.jbuf = 0.12;
    this.jbuf -= dt; this.coyote -= dt;
    if (this.jbuf > 0) {
      if (this.onGround || this.coyote > 0) { this.vy = JUMP; this.jumps = 1; this.onGround = false; this.coyote = 0; this.jbuf = 0; this.slideT = 0; fx?.('jump'); }
      else if (this.jumps < 2) { this.vy = JUMP2; this.jumps = 2; this.jbuf = 0; this.flipT = FLIP_T; fx?.('jump2'); }
    }
    // 숙이기 (공중에서 누르면 빨리 내려온다)
    if (input.slide) { if (this.onGround) { if (this.slideT <= 0) fx?.('slide'); this.slideT = 0.75; } else this.vy = Math.min(this.vy, -14); }
    if (input.slideHeld && this.onGround && this.slideT > 0) this.slideT = Math.max(this.slideT, 0.15);
    this.slideT -= dt;
    // 떨어짐
    this.vy -= GRAV * dt;
    this.y += this.vy * dt;
    // 땅
    const was = this.onGround;
    const g = track.ground(this.s, this.x, Math.max(this.y, prevY));
    this.onGround = false;
    if (g && this.vy <= 0 && this.y <= g.y + 0.02 && prevY >= g.y - 0.5) {
      this.y = g.y; this.vy = 0; this.onGround = true; this.jumps = 0;
      if (!was) { fx?.('land'); this.bear.jumpSquash = 1; }
      if (g.mv) this.x += g.dx; // 움직이는 발판에 실려 간다
    }
    if (was && !this.onGround && this.vy <= 0) this.coyote = 0.1;
    this.plat = this.onGround ? g : null;
    // 앞을 막는 발판 옆면: 조금 높으면 훌쩍 올라서고, 많이 높으면 쾅
    const w = track.wall(prevS, this.s, this.x, this.y);
    if (w) {
      if (w.y - this.y < 1.3) { /* 1.3m 아래 턱은 훌쩍 올라선다 */ this.y = w.y; this.vy = Math.max(0, this.vy); this.onGround = true; this.jumps = 0; }
      else return this.die('벽에 쾅! 부딪혔어요', track);
    }
    // 장애물
    const o = track.hit(this.s, this.x, this.y, this.h);
    if (o) return this.die(o.kind === 'spike' ? '가시를 밟았어요' : o.kind === 'bar' ? '가로대에 머리를 쿵!' : '장애물에 부딪혔어요', track);
    // 별사탕
    const n = track.takeStars(this.s, this.x, this.y);
    if (n) { this.stars += n; fx?.('star', n); }
    // 꿈 밖으로 떨어짐
    if (this.y < -16) return this.die('꿈속 깊이 떨어졌어요', track);
    this.flipT = Math.max(0, this.flipT - dt);
    this.shoveT = Math.max(0, this.shoveT - dt);
  }
  shoved(dir) { this.knock = dir * 14; this.vy = Math.max(this.vy, 5.5); this.onGround = false; this.slideT = 0; }
  bump(dir) { this.knock += dir * 4.5; }
  die(why, track) {
    this.alive = false; this.dead = { why, t: 0, vy: Math.max(this.vy, 0), fall: why.includes('떨어') };
    if (!this.dead.fall) { this.dead.vy = 7; this.knock = 0; }
    return why;
  }
  updateDead(dt) {
    const D = this.dead; D.t += dt;
    D.vy -= GRAV * dt; this.y += D.vy * dt;
    if (!D.fall) this.s -= 3 * dt * Math.max(0, 1 - D.t); // 부딪히면 뒤로 튕긴다
  }

  // 모습 맞추기 (z = 화면 위치)
  pose(dt, z) {
    const b = this.bear;
    b.root.position.set(this.x, this.y, z);
    b.root.rotation.y = Math.PI - (this.vx + this.knock) * 0.035;
    const sliding = this.slideT > 0 && this.onGround;
    b.update(dt, this.alive && this.onGround && !sliding ? Math.min(12, this.v * 0.55) : 0, { airborne: !this.onGround, noCrawl: true });
    poseBear(b, { alive: this.alive, ground: this.onGround, slide: sliding, flip: this.flipT > 0 ? 1 - this.flipT / FLIP_T : null, vy: this.vy }, dt);
    this.booster.update(dt, this.alive ? this.boost : 0, this.t);
    if (this.shoveT > 0) for (const a of b.arms.slice(0, 2)) a.rotation.x = -1.6;
    if (!this.alive) { this.shadow.visible = false; return; }
    this.shadow.visible = true;
    const gy = this.plat ? this.plat.y : this.y - 0.5;
    this.shadow.position.set(this.x, (this.plat ? this.plat.y : -99) + 0.03, z);
    this.shadow.scale.setScalar(Math.max(0.4, 1 - (this.y - gy) * 0.12));
  }
}

// 같은 방 다른 사람: 받은 위치를 부드럽게 따라간다 (사이엔 같은 속도로 달린다고 보고 채운다)
export class Ghost {
  constructor(scene, m) {
    this.scene = scene; this.id = m.id; this.name = m.name;
    this.bear = makeBear(m);
    scene.add(this.bear.root);
    this.booster = new Booster(scene); this.booster.attach(this.bear); this.bk = 0; this.t = 0;
    this.tag = nameTag(m.name, m.color);
    scene.add(this.tag);
    this.s = 0; this.x = 0; this.y = 0; this.f = 0; this.at = 0; this.ts = 0; this.tx = 0; this.ty = 0; this.alive = true; this.flipT = 0; this.shoveT = 0; this.pf = 0;
  }
  snap(s, x, y, f, dead) {
    this.ts = s; this.tx = x; this.ty = y; this.f = f; this.at = performance.now();
    if (dead && this.alive) { this.alive = false; }
    if (f & 8 && !(this.pf & 8)) this.flipT = FLIP_T; // 2단 점프를 막 시작했을 때만
    this.pf = f;
  }
  update(dt, origin) {
    // 받은 뒤 지난 시간만큼 앞으로 (모두 같은 속도 규칙이라 잘 맞는다)
    const lag = Math.min(0.3, (performance.now() - this.at) / 1000);
    const want = this.ts + (this.alive ? speedAt(this.ts) * (this.f & 16 ? 1 + BOOST : 1) * lag : 0);
    this.s += (want - this.s) * Math.min(1, dt * 12); if (Math.abs(want - this.s) > 8) this.s = want;
    this.x += (this.tx - this.x) * Math.min(1, dt * 12);
    this.y += (this.ty - this.y) * Math.min(1, dt * 14);
    const b = this.bear;
    b.root.position.set(this.x, this.y, origin - this.s);
    b.root.rotation.y = Math.PI;
    const air = !!(this.f & 2), slide = !!(this.f & 1);
    b.update(dt, !air && !slide && this.alive ? 10 : 0, { airborne: air, noCrawl: true });
    this.flipT = Math.max(0, this.flipT - dt);
    poseBear(b, { alive: this.alive, ground: !air, slide, flip: this.flipT > 0 ? 1 - this.flipT / FLIP_T : null, vy: this.ty - this.y }, dt);
    this.t += dt;
    this.bk = this.f & 16 && this.alive ? Math.min(1, this.bk + dt / BOOST_UP) : Math.max(0, this.bk - dt / BOOST_DOWN);
    this.booster.update(dt, this.bk, this.t);
    this.shoveT = Math.max(0, this.shoveT - dt);
    if (this.shoveT > 0) for (const a of b.arms.slice(0, 2)) a.rotation.x = -1.6;
    b.root.visible = this.alive || this.y > -30;
    this.tag.position.set(this.x, this.y + 2.5, origin - this.s);
    this.tag.visible = b.root.visible;
  }
  remove() { this.booster.dispose(); this.scene.remove(this.bear.root, this.tag); }
}

function nameTag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 30px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(250, x.measureText(name).width + 34);
  x.fillStyle = 'rgba(20,10,40,.6)'; x.beginPath(); x.roundRect(128 - w / 2, 8, w, 48, 24); x.fill();
  x.fillStyle = color || '#ffffff'; x.beginPath(); x.arc(128 - w / 2 + 18, 32, 7, 0, 7); x.fill();
  x.fillStyle = '#ffffff'; x.fillText(name, 136, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1);
  return s;
}
