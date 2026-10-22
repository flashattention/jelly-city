// 젤리 카트: 곰돌이가 운전석에 앉은 카트 + 아케이드 주행 (드리프트 → 게이지 → 니트로)
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';
import { toon } from '../../shared/js/utils.js';
import { HW, LAPS } from './tracks.js';

export const MAX = 33;            // 최고 속도 m/s (약 120km/h)
const ACC = 16, BRAKE = 32, REV = 8, TURN = 2.1;

let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}
const WHEEL_G = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16).rotateZ(Math.PI / 2);
const HUB_G = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 10).rotateZ(Math.PI / 2);
const FLAME_G = new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, -0.5, 0);
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

export class Kart {
  // o = { scene, profile, id, name, bot, color }
  constructor(o) {
    this.o = o; this.scene = o.scene; this.id = o.id; this.name = o.profile?.name || o.name || '곰돌이';
    this.bot = !!o.bot; this.remote = !!o.remote;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.v = 0; this.vl = 0;
    this.idx = 0; this.lap = 0; this.half = false; this.done = false; this.time = 0; this.finishT = 0;
    this.drift = false; this.driftDir = 0; this.driftT = 0; this.gauge = 0; this.nitro = 0; this.boostT = 0; this.boostP = 0;
    this.spinT = 0; this.items = []; this.eff = { shield: 0, ghost: 0, magnet: 0, shrink: 0 };
    this.wrongT = 0; this.bumpT = 0; this.steer = 0; this.yawRate = 0;
    this.buildModel(o.profile || {});
  }
  // ---------- 모델 ----------
  buildModel(pr) {
    const g = this.root = new THREE.Group();
    const body = this.body = new THREE.Group(); g.add(body);
    const col = pr.color || this.o.color || '#ff8fb1', dark = toon('#2b2b38'), main = toon(shade(col, 1.05)), light = toon(shade(col, 1.35));
    const add = (geo, mat, x, y, z, sx, sy, sz, p = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); p.add(m); return m; };
    const sph = new THREE.SphereGeometry(1, 20, 14), box = new THREE.BoxGeometry(1, 1, 1);
    add(sph, main, 0, 0.48, 0, 1.05, 0.32, 1.65);           // 젤리 몸통
    add(sph, light, 0, 0.6, 0.95, 0.75, 0.22, 0.75);        // 앞코
    add(sph, main, -0.95, 0.42, 0.1, 0.32, 0.25, 1.1);      // 옆 날개
    add(sph, main, 0.95, 0.42, 0.1, 0.32, 0.25, 1.1);
    add(box, dark, 0, 0.42, 1.62, 1.6, 0.22, 0.22);         // 앞 범퍼
    add(box, dark, 0, 0.5, -1.55, 1.7, 0.28, 0.28);         // 뒤 범퍼
    add(sph, dark, 0, 0.72, -0.35, 0.55, 0.22, 0.6);        // 의자
    add(box, light, 0, 1.18, -1.45, 1.9, 0.08, 0.5);        // 뒷날개
    for (const s of [-1, 1]) add(box, main, s * 0.7, 0.95, -1.45, 0.08, 0.5, 0.45);
    const wheel = add(new THREE.TorusGeometry(0.22, 0.04, 6, 18), dark, 0, 1.0, 0.35, 1, 1, 1); wheel.rotation.x = -0.9; // 운전대
    for (const s of [-1, 1]) { const pipe = add(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10), toon('#9ea7b3'), s * 0.45, 0.55, -1.75, 1, 1, 1); pipe.rotation.x = Math.PI / 2; }
    // 바퀴 (앞바퀴는 핸들 따라 돈다)
    this.wheels = []; this.steers = [];
    for (const [x, z, front] of [[-1.05, 1.05, 1], [1.05, 1.05, 1], [-1.05, -1.05, 0], [1.05, -1.05, 0]]) {
      const piv = new THREE.Group(); piv.position.set(x, 0.42, z); body.add(piv);
      const w = new THREE.Group(); piv.add(w);
      w.add(new THREE.Mesh(WHEEL_G, dark)); const hub = new THREE.Mesh(HUB_G, light); w.add(hub);
      this.wheels.push(w); if (front) this.steers.push(piv);
    }
    // 곰돌이 운전사
    const bear = this.bear = new Roach({ own: true, seed: pr.name || this.name, color: pr.color || '#8a5634', age: 25, gender: pr.gender, look: pr.look, accessories: pr.acc || [] });
    bear.setSeated(true); bear.riding = true;
    bear.root.scale.setScalar(0.72); bear.root.position.set(0, 0.42, -0.3);
    body.add(bear.root);
    // 부스터 불꽃
    const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flames = [-0.45, 0.45].map((x) => { const f = new THREE.Group(); f.position.set(x, 0.55, -2.0); f.rotation.x = -Math.PI / 2; const a = new THREE.Mesh(FLAME_G, fm('#ff8a3d', 0.8)), b = new THREE.Mesh(FLAME_G, fm('#9be7ff', 0.95)); a.scale.set(0.22, 1, 0.22); b.scale.set(0.1, 0.6, 0.1); f.add(a, b); body.add(f); f.visible = false; return f; });
    // 방어막
    this.shieldM = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), fm('#6ee7ff', 0.2)); this.shieldM.position.y = 0.8; this.shieldM.visible = false; g.add(this.shieldM);
    // 그림자
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(1, 1.5, 1); g.add(this.shadow); this.shadow.position.y = 0.03;
    // 불꽃 가루 (드리프트 · 부스터)
    this.sparks = []; this.sparkT = 0;
    this.scene.add(g);
  }
  setTag(color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d'); x.font = 'bold 30px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(250, x.measureText(this.name).width + 30);
    x.fillStyle = 'rgba(20,10,40,.6)'; x.beginPath(); x.roundRect(128 - w / 2, 8, w, 48, 24); x.fill();
    if (color) { x.strokeStyle = color; x.lineWidth = 5; x.stroke(); }
    x.fillStyle = '#fff'; x.fillText(this.name, 128, 33);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
    this.tag.scale.set(3.2, 0.8, 1); this.tag.position.y = 3.1; this.root.add(this.tag);
  }
  remove() { this.scene.remove(this.root); for (const s of this.sparks) this.scene.remove(s.m); }

  // ---------- 출발 자리 ----------
  place(track, slot) {
    const row = Math.floor(slot / 2), col = slot % 2;
    const i = (track.M - 6 - row * 5) % track.M;
    track.at(i, (col ? 1 : -1) * 3.4, this.pos);
    this.idx = i; this.yaw = track.heading(i); this.v = 0; this.vl = 0; this.lap = 0; this.half = false; this.done = false; this.time = 0;
    this.prevIdx = i;
  }

  // ---------- 주행 ----------
  // inp = { up, down, dir(-1~1), drift(누르는 중), use(눌림) }   fx(이름) = 소리 · 연출
  update(dt, inp, track, fx, mode) {
    if (this.remote) return;
    const E = this.eff;
    for (const k in E) E[k] = Math.max(0, E[k] - dt);
    if (!this.done) this.time += dt;
    // 빙글빙글 (맞음)
    if (this.spinT > 0) { this.spinT -= dt; this.v *= Math.exp(-dt * 2.5); this.drift = false; inp = { dir: 0 }; }
    const fwd = Math.sign(this.v) || 1;
    // 핸들: 빠를수록 조금 덜 돈다 · 드리프트면 더 많이
    this.steer += ((inp.dir || 0) - this.steer) * Math.min(1, dt * (this.drift ? 6 : 9));
    const sp = Math.abs(this.v), grip = Math.min(1, sp / 10) * (1 - 0.35 * sp / MAX);
    let turn = this.steer * TURN * grip * fwd;
    // 드리프트 시작 · 유지 · 끝
    if (inp.drift && Math.abs(inp.dir || 0) > 0.2 && sp > 12 && !this.drift && this.spinT <= 0) { this.drift = true; this.driftDir = Math.sign(inp.dir); this.driftT = 0; fx?.('drift'); }
    if (this.drift) {
      this.driftT += dt;
      // 드리프트: 0.35초에 걸쳐 서서히 들어가고, 핸들을 안쪽으로 꺾으면 조금 더 · 바깥쪽이면 풀린다 (너무 급하지 않게)
      const dk = Math.min(1, this.driftT / 0.35);
      const dturn = (this.steer * 0.55 + this.driftDir * 0.45) * TURN * Math.max(0.6, grip) * 1.25; // 안쪽으로 꺾으면 보통보다 조금 더 (급하진 않게)
      turn += (dturn - turn) * dk;
      this.vl += (-this.driftDir * sp * 0.2 - this.vl) * Math.min(1, dt * 3); // 바깥으로 살짝 미끄러진다 (너무 세면 벽에 붙는다)
      this.v *= Math.exp(-dt * 0.1);
      if (mode !== 'item') this.gauge += dt * 0.32 * (sp / MAX) * (1 + this.driftT * 0.4);
      if (!inp.drift || sp < 8) {
        this.drift = false;
        if (this.driftT > 0.5) { this.boostT = Math.max(this.boostT, 0.55); this.boostP = Math.max(this.boostP, 0.22); fx?.('miniboost'); } // 드리프트 끝 순간 부스터
      }
    } else this.vl *= Math.exp(-dt * 2.8); // 드리프트를 풀어도 옆으로 미끄러지던 힘이 서서히 줄어든다
    if (this.gauge >= 1) { this.gauge = 0; if (this.nitro < 2) { this.nitro++; fx?.('gauge'); } }
    // 도는 빠르기도 부드럽게 바뀐다 (확 꺾이지 않게)
    this.yawRate += (turn - this.yawRate) * Math.min(1, dt * (this.bot ? 14 : this.drift ? 5 : 7)); // AI 는 빠르게 반응 (사람 손맛은 부드럽게)
    this.yaw += this.yawRate * dt;
    // 니트로
    if (inp.use && mode !== 'item' && this.nitro > 0 && this.boostT < 0.3) { this.nitro--; this.boostT = 2.2; this.boostP = 0.5; fx?.('nitro'); }
    // 속도
    this.boostT = Math.max(0, this.boostT - dt);
    if (this.boostT <= 0) this.boostP = 0;
    let top = MAX * (1 + this.boostP) * (E.shrink > 0 ? 0.65 : 1) * (this.o.skill || 1);
    if (E.magnet > 0) top *= 1.25;
    if (this.boostT > 0) this.v += (top - this.v) * Math.min(1, dt * 3);
    else if (inp.up) this.v += ACC * dt * Math.max(0, 1 - this.v / top) * 1.6;
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 7 * dt);
    if (inp.down) this.v = Math.max(-REV, this.v - BRAKE * dt);
    if (this.v > top) this.v += (top - this.v) * Math.min(1, dt * 1.5);
    // 움직이기
    const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
    this.pos.x += (sx * this.v + sz * this.vl) * dt;
    this.pos.z += (sz * this.v - sx * this.vl) * dt;
    // 트랙 · 벽
    this.prevIdx = this.idx;
    this.idx = track.nearest(this.pos, this.idx);
    const off = track.offset(this.pos, this.idx), lim = HW - 1.1;
    if (Math.abs(off) > lim) {
      const n = track.Nrm[this.idx], push = (Math.abs(off) - lim) * Math.sign(off);
      this.pos.x -= n.x * push; this.pos.z -= n.z * push;
      if (this.bumpT <= 0 && sp > 10) { fx?.('bump'); this.bumpT = 0.4; }
      this.v *= sp > 10 ? 0.8 : 0.95; this.vl = 0;
      // 벽을 따라 미끄러지게 진행 방향 쪽으로 살짝
      let d = track.heading(this.idx) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 1.2) this.yaw += d * Math.min(1, dt * 4);
    }
    this.bumpT -= dt;
    // 높이: 앞뒤 점 사이로
    const p0 = track.P[this.idx], p1 = track.P[(this.idx + 1) % track.M];
    this.pos.y += ((p0.y + p1.y) / 2 - this.pos.y) * Math.min(1, dt * 12);
    // 랩: 반 바퀴를 지나고 출발선을 넘으면
    const M = track.M;
    if (this.idx > M * 0.45 && this.idx < M * 0.55) this.half = true;
    if (this.prevIdx > M * 0.9 && this.idx < M * 0.1 && this.half) { this.half = false; this.lap++; if (this.lap >= LAPS && !this.done) { this.done = true; this.finishT = this.time; fx?.('finish'); } else fx?.(this.lap === LAPS - 1 ? 'finalLap' : 'lap'); }
    if (this.prevIdx < M * 0.1 && this.idx > M * 0.9) this.half = false; // 거꾸로 넘으면 무효
    // 역주행
    let dd = track.heading(this.idx) - this.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    this.wrongT = Math.abs(dd) > 2 && this.v > 3 ? this.wrongT + dt : 0;
    // 부스터 발판
    for (const i of track.pads) { let di = this.idx - i; if (di > M / 2) di -= M; if (di < -M / 2) di += M; if (di >= -1 && di <= 2 && Math.abs(off) < 2.8) { if (this.boostT < 0.9) fx?.('pad'); this.boostT = Math.max(this.boostT, 1.1); this.boostP = Math.max(this.boostP, 0.4); } }
  }
  // 진행도 (순위 계산용): 랩 + 트랙 위 위치
  progress(M) { let i = this.idx; if (!this.half && i > M * 0.5) i -= M; return this.lap + i / M; }
  spin(t = 1.3) { if (this.eff.shield > 0) { this.eff.shield = 0; return 'blocked'; } if (this.eff.ghost > 0) return 'blocked'; this.spinT = Math.max(this.spinT, t); this.drift = false; this.boostT = 0; return 'hit'; }

  // ---------- 모습 ----------
  pose(dt, t) {
    const g = this.root;
    g.position.copy(this.pos); g.rotation.y = this.yaw;
    const sp = Math.abs(this.v);
    // 몸통: 드리프트면 옆으로 돌아 미끄러지는 느낌, 핸들 따라 기울기, 맞으면 빙글빙글
    const want = this.drift ? this.driftDir * 0.32 * Math.min(1, this.driftT / 0.35) : 0;
    this.body.rotation.y += (want - this.body.rotation.y) * Math.min(1, dt * 4.5);
    if (this.spinT > 0) this.body.rotation.y += dt * 14;
    this.body.rotation.z += ((-this.steer * 0.08 * Math.min(1, sp / 15)) - this.body.rotation.z) * Math.min(1, dt * 6);
    this.body.position.y = Math.sin(t * 30) * 0.015 * Math.min(1, sp / 10);
    for (const w of this.wheels) w.rotation.x += this.v * dt / 0.42;
    for (const s of this.steers) s.rotation.y = this.steer * 0.45;
    // 곰돌이
    this.bear.update(dt, 0, {});
    this.bear.arms[0].rotation.x = this.bear.arms[1].rotation.x = -1.25;
    this.bear.arms[0].rotation.z = this.steer * 0.3 + this.bear.arms[0].userData.baseZ * 0.5; this.bear.arms[1].rotation.z = this.steer * 0.3 + this.bear.arms[1].userData.baseZ * 0.5;
    // 효과
    const E = this.eff;
    const s = E.shrink > 0 ? 0.6 : 1; g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 6));
    this.shieldM.visible = E.shield > 0; if (E.shield > 0) this.shieldM.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    g.visible = !(E.ghost > 0 && Math.sin(t * 30) < -0.3);
    const boost = this.boostT > 0;
    for (const f of this.flames) { f.visible = boost; if (boost) { const k = 0.8 + Math.random() * 0.4; f.children[0].scale.set(0.22, (0.8 + this.boostP * 2.4) * k, 0.22); f.children[1].scale.set(0.1, (0.5 + this.boostP * 1.6) * k, 0.1); } }
    // 불꽃 가루: 드리프트(오래 할수록 파랑 → 노랑 → 보라) · 부스터
    this.sparkT -= dt;
    if ((this.drift && sp > 10) || boost) {
      if (this.sparkT <= 0) {
        this.sparkT = 0.025;
        const c = boost ? '#ffb36b' : this.driftT < 1 ? '#7cd8ff' : this.driftT < 2 ? '#ffd84d' : '#d38bff';
        for (const sx of [-1, 1]) this.spark(sx * 1.05, -1.05, c);
      }
    }
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.v.y -= 6 * dt;
      p.m.material.opacity = Math.max(0, p.life / p.max); p.m.visible = p.life > 0;
    }
    if (this.tag) this.tag.visible = g.visible;
  }
  spark(lx, lz, color) {
    let p = this.sparks.find((q) => q.life <= 0);
    if (!p) { if (this.sparks.length > 50) return; p = { m: new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), v: new THREE.Vector3(), life: 0 }; p.m.scale.setScalar(0.35); this.scene.add(p.m); this.sparks.push(p); }
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    p.m.position.set(this.pos.x + lx * c + lz * s, this.pos.y + 0.15, this.pos.z - lx * s + lz * c);
    p.v.set((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3).addScaledVector(new THREE.Vector3(-s, 0, -c), 3);
    p.max = p.life = 0.25 + Math.random() * 0.25; p.m.material.color.set(color); p.m.visible = true;
  }
  // 다른 사람: 받은 상태를 부드럽게 따라간다
  netSet(st) { this.net = st; this.netAt = performance.now(); }
  follow(dt) {
    const n = this.net; if (!n) return;
    const [x, y, z, yaw, v, lap, idx, flags] = n;
    const lag = Math.min(0.25, (performance.now() - this.netAt) / 1000);
    const tx = x + Math.sin(yaw) * v * lag, tz = z + Math.cos(yaw) * v * lag;
    const k = Math.min(1, dt * 10);
    if (Math.hypot(tx - this.pos.x, tz - this.pos.z) > 15) this.pos.set(tx, y, tz);
    else { this.pos.x += (tx - this.pos.x) * k; this.pos.z += (tz - this.pos.z) * k; this.pos.y += (y - this.pos.y) * k; }
    let d = yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k;
    this.v = v; this.lap = lap; this.idx = idx;
    this.spinT = flags & 1 ? 0.2 : 0; this.boostT = flags & 2 ? 0.2 : 0; this.boostP = flags & 2 ? 0.5 : 0;
    this.drift = !!(flags & 4); this.driftDir = flags & 64 ? -1 : 1; if (this.drift) this.driftT += dt; else this.driftT = 0;
    this.eff.shield = flags & 8 ? 1 : 0; this.eff.ghost = flags & 16 ? 1 : 0; this.eff.shrink = flags & 32 ? 1 : 0;
    this.done = !!(flags & 128);
  }
  flags() { return (this.spinT > 0 ? 1 : 0) | (this.boostT > 0 ? 2 : 0) | (this.drift ? 4 : 0) | (this.eff.shield > 0 ? 8 : 0) | (this.eff.ghost > 0 ? 16 : 0) | (this.eff.shrink > 0 ? 32 : 0) | (this.driftDir < 0 ? 64 : 0) | (this.done ? 128 : 0); }
}
