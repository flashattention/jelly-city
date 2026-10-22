// 달리는 곰돌이: 앞으로는 저절로 달리고, 좌우 · 점프(2단, 공중제비) · 숙이기 · 밀치기
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';
import { speedAt } from './track.js';

const GRAV = 30, JUMP = 11.5, JUMP2 = 10.5, SIDE = 8.5;
export const H_STAND = 1.45, H_SLIDE = 0.7;

export function makeBear(p = {}) {
  const r = new Roach({ own: true, seed: p.name || 'dream', color: p.color || '#8a5634', age: 25, gender: p.gender, look: p.look, accessories: p.acc || [] });
  r.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  return r;
}

export class Runner {
  constructor(scene, profile) {
    this.scene = scene;
    this.bear = makeBear(profile);
    scene.add(this.bear.root);
    // 발밑 그림자 (동그란 얼룩)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.reset();
  }
  setLook(profile) { this.scene.remove(this.bear.root); this.bear = makeBear(profile); this.scene.add(this.bear.root); }
  reset(s = 0, x = 0) {
    Object.assign(this, { s, x, y: 0, vx: 0, vy: 0, knock: 0, onGround: true, jumps: 0, coyote: 0, jbuf: 0, slideT: 0, flipT: 0, shoveT: 0, alive: true, dead: null, stars: 0, plat: null, t: 0 });
    this.bear.inner.rotation.set(0, 0, 0); this.bear.root.scale.setScalar(1); this.bear.root.visible = true;
  }
  get v() { return speedAt(this.s); }
  get h() { return this.slideT > 0 ? H_SLIDE : H_STAND; }

  // input: { dir(-1~1), jump(눌림), slide(눌림), slideHeld }
  update(dt, input, track, fx) {
    if (!this.alive) return this.updateDead(dt);
    this.t += dt;
    const prevS = this.s, prevY = this.y;
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
      else if (this.jumps < 2) { this.vy = JUMP2; this.jumps = 2; this.jbuf = 0; this.flipT = 0.5; fx?.('jump2'); }
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
      this.y = g.y; this.vy = 0; this.onGround = true; this.jumps = 0; this.flipT = 0;
      if (!was) { fx?.('land'); this.bear.jumpSquash = 1; }
      if (g.mv) this.x += g.dx; // 움직이는 발판에 실려 간다
    }
    if (was && !this.onGround && this.vy <= 0) this.coyote = 0.1;
    this.plat = this.onGround ? g : null;
    // 앞을 막는 발판 옆면: 조금 높으면 훌쩍 올라서고, 많이 높으면 쾅
    const w = track.wall(prevS, this.s, this.x, this.y);
    if (w) {
      if (w.y - this.y < 0.95) { this.y = w.y; this.vy = Math.max(0, this.vy); this.onGround = true; this.jumps = 0; }
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
    this.bear.inner.rotation.x -= dt * 6;
  }

  // 모습 맞추기 (z = 화면 위치)
  pose(dt, z) {
    const b = this.bear;
    b.root.position.set(this.x, this.y, z);
    b.root.rotation.y = Math.PI - (this.vx + this.knock) * 0.035;
    if (!this.alive) { b.update(dt, 0, { airborne: true }); this.shadow.visible = false; return; }
    const sliding = this.slideT > 0 && this.onGround;
    b.update(dt, this.onGround && !sliding ? Math.min(12, this.v * 0.55) : 0, { airborne: !this.onGround, noCrawl: true });
    // 숙이기: 뒤로 눕듯이 미끄러진다 · 2단 점프: 앞으로 한 바퀴
    let rx = 0;
    if (sliding) rx = -1.15;
    else if (this.flipT > 0) rx = -(1 - this.flipT / 0.5) * Math.PI * 2;
    else if (!this.onGround) rx = -0.15;
    b.inner.rotation.x += (rx - b.inner.rotation.x) * (this.flipT > 0 ? 1 : Math.min(1, dt * 14));
    b.inner.position.y = sliding ? -0.25 : b.inner.position.y;
    if (this.shoveT > 0) for (const a of b.arms.slice(0, 2)) { a.rotation.x = -1.6; }
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
    this.tag = nameTag(m.name, m.color);
    scene.add(this.tag);
    this.s = 0; this.x = 0; this.y = 0; this.f = 0; this.at = 0; this.ts = 0; this.tx = 0; this.ty = 0; this.alive = true; this.flipT = 0; this.shoveT = 0;
  }
  snap(s, x, y, f, dead) {
    this.ts = s; this.tx = x; this.ty = y; this.f = f; this.at = performance.now();
    if (dead && this.alive) { this.alive = false; }
    if (f & 8 && this.flipT <= 0) this.flipT = 0.5;
  }
  update(dt, origin) {
    // 받은 뒤 지난 시간만큼 앞으로 (모두 같은 속도 규칙이라 잘 맞는다)
    const lag = Math.min(0.3, (performance.now() - this.at) / 1000);
    const want = this.ts + (this.alive ? speedAt(this.ts) * lag : 0);
    this.s += (want - this.s) * Math.min(1, dt * 12); if (Math.abs(want - this.s) > 8) this.s = want;
    this.x += (this.tx - this.x) * Math.min(1, dt * 12);
    this.y += (this.ty - this.y) * Math.min(1, dt * 14);
    const b = this.bear;
    b.root.position.set(this.x, this.y, origin - this.s);
    b.root.rotation.y = Math.PI;
    const air = !!(this.f & 2), slide = !!(this.f & 1);
    b.update(dt, !air && !slide && this.alive ? 10 : 0, { airborne: air, noCrawl: true });
    this.flipT = Math.max(0, this.flipT - dt);
    const rx = !this.alive ? b.inner.rotation.x - dt * 6 : slide ? -1.15 : this.flipT > 0 ? -(1 - this.flipT / 0.5) * Math.PI * 2 : air ? -0.15 : 0;
    b.inner.rotation.x += (rx - b.inner.rotation.x) * (this.flipT > 0 || !this.alive ? 1 : Math.min(1, dt * 14));
    this.shoveT = Math.max(0, this.shoveT - dt);
    if (this.shoveT > 0) for (const a of b.arms.slice(0, 2)) a.rotation.x = -1.6;
    b.root.visible = this.alive || this.y > -30;
    this.tag.position.set(this.x, this.y + 2.5, origin - this.s);
    this.tag.visible = b.root.visible;
  }
  remove() { this.scene.remove(this.bear.root, this.tag); }
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
