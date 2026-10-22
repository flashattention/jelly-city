// 젤리병단 장비(입체기동)와 거대 젤리 (브라우저)
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';
import { TITAN, napePos } from './titans.js';
import { sfx, loop } from '../../shared/js/audio.js';

const HOOK_RANGE = 95;

// 뒷목 약점 표시 (빨간 과녁)
let _napeTex = null;
function napeTex() {
  if (_napeTex) return _napeTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#ff1744'; x.lineWidth = 10; x.shadowColor = '#ff1744'; x.shadowBlur = 16;
  x.beginPath(); x.arc(64, 64, 44, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 20, 0, Math.PI * 2); x.stroke();
  for (const [a, b, cc, d] of [[64, 4, 64, 30], [64, 98, 64, 124], [4, 64, 30, 64], [98, 64, 124, 64]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(cc, d); x.stroke(); }
  _napeTex = new THREE.CanvasTexture(c);
  return _napeTex;
}

// 거대 젤리 머리 위 체력바: 뒷목을 벨 때마다 한 칸씩 줄어든다
function hpCanvas(hp, max) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(20,10,20,0.75)'; x.beginPath(); x.roundRect(2, 2, 252, 60, 14); x.fill();
  x.font = 'bold 22px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff';
  x.fillText(`🧸 거대 젤리 · 뒷목 ${hp}/${max}`, 128, 24);
  const gap = 4, w = (232 - gap * (max - 1)) / max;
  for (let i = 0; i < max; i++) {
    x.fillStyle = i < hp ? (hp === 1 ? '#ff5252' : '#ff8fb1') : 'rgba(255,255,255,0.18)';
    x.beginPath(); x.roundRect(12 + i * (w + gap), 34, w, 18, 6); x.fill();
  }
  return c;
}

// ---------------- 거대 젤리 ----------------
export class TitansView {
  constructor(scene, groundY) { this.scene = scene; this.groundY = groundY; this.list = new Map(); }
  // 서버 스냅샷: [id, x, z, 방향, 크기, 상태, 색, 남은 뒷목, 최대] × n
  apply(arr) {
    const seen = new Set();
    for (let i = 0; i + 8 < arr.length; i += 9) {
      const id = arr[i]; seen.add(id);
      const x = arr[i + 1] / 10, z = arr[i + 2] / 10, h = arr[i + 3] / 100, s = arr[i + 4] / 10, st = arr[i + 5], c = arr[i + 6];
      const t = this.list.get(id) || this.make(id, s, c, x, z, h);
      t.tx = x; t.tz = z; t.th = h;
      if (st === 1 && t.state !== 1) t.r.attack('melee');
      if (st === 2 && t.state !== 2) { t.r.setDead(true); t.r.setEmotion('sad', 999); }
      t.state = st;
      this.setHp(t, arr[i + 7], arr[i + 8]);
    }
    for (const [id, t] of this.list) if (!seen.has(id)) { this.scene.remove(t.r.root, t.mark, t.bar); t.bar.material.map?.dispose(); this.list.delete(id); }
  }
  make(id, s, c, x, z, h) {
    // 히죽 웃는 거대 곰돌이 젤리
    const r = new Roach({ own: true, color: TITAN.colors[c] || '#ff8fb1', age: 30, seed: 'titan' + id, look: { eyes: 0, mouth: 6, nose: 1, cheek: '#ff8a80' } });
    r.titan = true;
    r.setEmotion('happy', 999);
    r.root.scale.setScalar(s);
    r.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(r.root);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: napeTex(), transparent: true, depthWrite: false, depthTest: false }));
    mark.scale.setScalar(1.6 + s * 0.12); mark.renderOrder = 60;
    this.scene.add(mark);
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    const bw = 10 + s * 1.0; bar.scale.set(bw, bw / 4, 1); bar.renderOrder = 61; // 멀리서도 읽히게
    this.scene.add(bar);
    const t = { id, s, r, mark, bar, hp: -1, max: -1, x, z, h, y: this.groundY(x, z), tx: x, tz: z, th: h, state: 0, base: new THREE.Vector3(x, 0, z) };
    this.list.set(id, t);
    return t;
  }
  setHp(t, hp, max) {
    if (t.hp === hp && t.max === max) return;
    t.hp = hp; t.max = max;
    t.bar.material.map?.dispose();
    t.bar.material.map = new THREE.CanvasTexture(hpCanvas(hp, max)); t.bar.material.needsUpdate = true;
  }
  update(dt, showMarks) {
    const k = Math.min(1, dt * 4), now = performance.now();
    for (const t of this.list.values()) {
      const px = t.x, pz = t.z;
      if (t.state !== 2) { t.x += (t.tx - t.x) * k; t.z += (t.tz - t.z) * k; let dh = t.th - t.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); t.h += dh * k; }
      t.y = this.groundY(t.x, t.z);
      const mv = Math.hypot(t.x - px, t.z - pz) / Math.max(dt, 1e-3);
      t.r.root.position.set(t.x, t.y, t.z); t.r.root.rotation.y = t.h;
      t.r.update(dt, t.state === 2 ? 0 : Math.min(1.2, mv * 0.35), {});
      t.base.set(t.x, t.y, t.z);
      const n = napePos(t);
      t.mark.position.set(n.x, n.y, n.z);
      t.mark.visible = showMarks && t.state !== 2;
      t.mark.material.opacity = 0.6 + Math.sin(now / 180) * 0.35;
      t.bar.position.set(t.x, t.y + TITAN.top * t.s + 1.5 + t.s * 0.1, t.z);
      t.bar.visible = t.state !== 2 && t.max > 0;
    }
  }
  // 총알·갈고리가 맞는 몸통 (원기둥)
  shapes() { return [...this.list.values()].filter((t) => t.state !== 2).map((t) => ({ id: t.id, base: t.base, r: TITAN.body * t.s, h: TITAN.top * t.s, t })); }
}

// 반직선 o + d·t 가 상자(건물)와 처음 만나는 t
function rayBox(o, d, b, top) {
  let t0 = 0, t1 = 1e9;
  for (const [lo, hi, oo, dd] of [[b.minX, b.maxX, o.x, d.x], [0, top, o.y, d.y], [b.minZ, b.maxZ, o.z, d.z]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return null; continue; }
    let a = (lo - oo) / dd, c = (hi - oo) / dd;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t0 > 0 ? t0 : null;
}
// 반직선이 세운 원기둥(거대 젤리 몸통)과 만나는 t
function rayCyl(o, d, base, r, h) {
  const ox = o.x - base.x, oz = o.z - base.z;
  const A = d.x * d.x + d.z * d.z, B = 2 * (ox * d.x + oz * d.z), C = ox * ox + oz * oz - r * r;
  const D = B * B - 4 * A * C;
  if (A < 1e-9 || D < 0) return null;
  const t = (-B - Math.sqrt(D)) / (2 * A);
  if (t <= 0) return null;
  const y = o.y + d.y * t;
  return y >= base.y && y <= base.y + h ? t : null;
}

// ---------------- 갈고리 (날아가서 · 박히고 · 당기고 · 감겨 돌아온다) ----------------
const HOOK_SPEED = 150;  // 갈고리가 날아가는 속도 (m/s): 멀수록 늦게 닿는다
const BACK_SPEED = 200;  // 감겨 돌아오는 속도
const ropeGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0); // 0~1 높이로 길이를 늘려 쓴다
const ropeMat = new THREE.MeshBasicMaterial({ color: '#263238' });
const clawMat = new THREE.MeshToonMaterial({ color: '#cfd8dc', emissive: '#455a64' });
const UP = new THREE.Vector3(0, 1, 0);
// 양쪽 허리에서 줄 하나씩 (진격의 거인처럼 두 가닥), 끝에 세 갈래 갈고리
function makeClaw() {
  const g = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), clawMat); tip.position.y = 0.1; g.add(tip);
  for (let i = 0; i < 3; i++) {
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 4), clawMat);
    const a = (i / 3) * Math.PI * 2;
    prong.position.set(Math.sin(a) * 0.17, -0.12, Math.cos(a) * 0.17);
    prong.rotation.set(Math.cos(a) * 2.4, 0, -Math.sin(a) * 2.4); // 뒤로 젖힌 갈퀴
    g.add(prong);
  }
  return g;
}
function makeCable() {
  return [0, 1].map(() => {
    const rope = new THREE.Mesh(ropeGeo, ropeMat); rope.frustumCulled = false; rope.visible = false;
    const claw = makeClaw(); claw.visible = false;
    return { rope, claw };
  });
}

// ---------------- 젤리병단 장비 ----------------
export class Odm {
  constructor(game, scene) {
    this.g = game; this.scene = scene;
    this.mine = { cable: this.addCable(), s: null }; // s: 지금 쏜 갈고리
    this.others = new Map(); // 다른 플레이어 id → { cable, s }
  }
  addCable() { const c = makeCable(); for (const x of c) this.scene.add(x.rope, x.claw); return c; }
  has() { return this.g.inv?.selected()?.id === 'odm_gear'; }
  // 우클릭: 카메라 가운데가 가리키는 건물·거대 젤리로 갈고리를 쏜다 → 닿는 순간 박히고 당기기 시작
  fire() {
    const g = this.g, p = g.player;
    if (!this.has() || p.inCar || g.dead || g.busy || g.mode !== 'city') return false;
    const { o, d } = g.combat.aimRay();
    const hit = this.cast(o, d);
    sfx('hook');
    if (p.odm?.hook) p.odm.hook = null; // 새로 쏘면 앞의 갈고리는 풀린다
    let s;
    if (!hit) s = { miss: true, p: o.clone().addScaledVector(d, HOOK_RANGE) };
    else if (hit.titan) {
      // 움직이는 거대 젤리: 몸에 붙은 자리(젤리 기준 좌표)를 기억했다가 매 순간 다시 계산
      const t = hit.titan, ca = Math.cos(-t.h), sa = Math.sin(-t.h);
      const dx = hit.point.x - t.x, dz = hit.point.z - t.z;
      s = { ti: { x: dx * ca + dz * sa, y: hit.point.y - t.y, z: -dx * sa + dz * ca, id: t.id }, p: hit.point.clone(), color: TITAN.colors[t.c] || '#ff8fb1' };
    } else s = { p: hit.point.clone() };
    this.mine.s = this.launch(s, this.hip(p.pos, p.heading));
    const a = [s.p.x, s.p.y, s.p.z].map((v) => +v.toFixed(2));
    g.net.send({ t: 'fx', k: 'odm', a, ...(s.ti ? { ti: [s.ti.id, s.ti.x, s.ti.y, s.ti.z] } : {}), ...(s.miss ? { miss: 1 } : {}) });
    return true;
  }
  launch(s, from) { return Object.assign(s, { phase: 'out', d: 0, len: from.distanceTo(s.p), held: true, latchT: 0 }); }
  // 박혔다: 내 갈고리면 이때부터 당겨진다
  latch(s, isMine) {
    s.phase = 'hold'; s.latchT = 0.25;
    const at = this.anchor(s);
    sfx('latch', at);
    this.latchFx(at, s.color);
    if (!isMine) return;
    const g = this.g, p = g.player;
    if (!s.held) { s.phase = 'back'; return; } // 닿기 전에 버튼을 뗐으면 박히자마자 감아들인다
    let v = null;
    if (p.mount) { v = new THREE.Vector3(Math.sin(p.heading) * p.speed, 3, Math.cos(p.heading) * p.speed); g.dismountForOdm?.(); }
    if (g.emoting) g.stopEmote();
    p.odmStart(v);
    const chest = p.pos.clone(); chest.y += 1.1;
    p.odm.hook = s.ti ? { get: () => this.titanPoint(s.ti), len: chest.distanceTo(at) } : { p: s.p.clone(), len: chest.distanceTo(at) };
    p.odm.jumps = 0; // 다시 놓으면 2단 점프를 또 쓸 수 있다
    p.odm.vel.addScaledVector(at.clone().sub(chest).normalize(), 4); // 박히는 순간 '훅' 끌려간다
    g.shake?.(0.35);
  }
  // 불꽃 + 먼지 (거대 젤리는 젤리가 튄다)
  latchFx(at, color) {
    const fx = this.g.combat?.fx;
    if (!fx) return;
    for (let i = 0; i < 14; i++) fx.part(at, new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9), color || (Math.random() < 0.5 ? '#ffe0b2' : '#ffab40'), 0.4, 0.25, 0, { grav: 16 });
    for (let i = 0; i < 4; i++) fx.part(at, new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2), color || '#bcaaa4', 0.9, 0.8, 2, { normal: true, op: 0.6, drag: 2 });
    fx.part(at, new THREE.Vector3(), '#ffffff', 0.15, 2.2, 0.4);
  }
  // 지금 조준점이 갈고리를 걸 수 있는 곳인지 (0.1초마다 한 번만 계산)
  canHook() {
    const now = performance.now();
    if (now - (this.canT || 0) > 100) { this.canT = now; const { o, d } = this.g.combat.aimRay(); this.canV = this.g.mode === 'city' && !!this.cast(o, d); }
    return this.canV;
  }
  // 우클릭을 떼면: 갈고리를 풀고(감겨 돌아온다) 그 기세로 날아간다
  release() {
    const p = this.g.player, s = this.mine.s;
    if (s) { s.held = false; if (s.phase === 'hold') this.retract(s); }
    if (p.odm?.hook) p.odm.hook = null;
    if (s) this.g.net.send({ t: 'fx', k: 'odm', a: null });
  }
  retract(s) { if (s.phase !== 'back') { s.phase = 'back'; s.p = this.anchor(s) || s.p; s.d = Math.min(s.d, s.len); sfx('reel', s.p); } }
  anchor(s) { return s.ti ? this.titanPoint(s.ti) || s.p : s.p; }
  titanPoint(loc) {
    const t = this.g.titans.list.get(loc.id);
    if (!t || t.state === 2) return null;
    const ca = Math.cos(t.h), sa = Math.sin(t.h);
    return new THREE.Vector3(t.x + loc.x * ca + loc.z * sa, t.y + loc.y, t.z - loc.x * sa + loc.z * ca);
  }
  cast(o, d) {
    let best = null, bt = HOOK_RANGE;
    for (const c of this.g.city.colliders) {
      if (c.small || c.broken) continue;
      const top = c.top ?? c.h ?? 10;
      if (top < 3) continue;
      const t = rayBox(o, d, c, top);
      if (t !== null && t < bt) { bt = t; best = null; }
    }
    for (const sh of this.g.titans.shapes()) {
      const t = rayCyl(o, d, sh.base, sh.r, sh.h);
      if (t !== null && t < bt) { bt = t; best = sh.t; }
    }
    if (bt >= HOOK_RANGE) return null;
    return { point: o.clone().addScaledVector(d, bt), titan: best };
  }
  // 다른 플레이어의 갈고리: 똑같이 날아가고 박히고 감겨 돌아오는 모습
  remote(m) {
    let e = this.others.get(m.pid);
    if (!Array.isArray(m.a)) { if (e?.s) { e.s.held = false; this.retract(e.s); } return; }
    if (!e) { e = { cable: this.addCable(), s: null }; this.others.set(m.pid, e); }
    const pl = this.g.players.list.get(m.pid);
    if (!pl) return;
    const s = { p: new THREE.Vector3(+m.a[0], +m.a[1], +m.a[2]), miss: !!m.miss };
    if (Array.isArray(m.ti)) { s.ti = { id: +m.ti[0], x: +m.ti[1], y: +m.ti[2], z: +m.ti[3] }; const t = this.g.titans.list.get(s.ti.id); s.color = TITAN.colors[t?.c] || '#ff8fb1'; }
    e.s = this.launch(s, this.hip(pl.roach.root.position, pl.roach.root.rotation.y));
    sfx('hook', s.p.clone().lerp(pl.roach.root.position, 0.9));
  }
  // 허리 (줄이 나오는 곳)
  hip(pos, h) { const v = pos.clone(); v.y += 0.95; v.h = h; return v; }
  // 갈고리 한 번 움직이기 (날아감 → 박힘 → 감김). 끝나면 false
  step(s, from, dt, isMine) {
    s.latchT = Math.max(0, s.latchT - dt);
    if (s.phase === 'out') {
      const to = this.anchor(s);
      s.len = from.distanceTo(to);
      s.d += HOOK_SPEED * dt;
      if (s.d >= s.len) { s.d = s.len; if (s.miss) this.retract(s); else this.latch(s, isMine); }
    } else if (s.phase === 'hold') {
      if (s.ti && !this.titanPoint(s.ti)) this.retract(s); // 거대 젤리가 쓰러졌다
      else if (isMine && !this.g.player.odm?.hook) this.retract(s);
      else s.len = s.d = from.distanceTo(this.anchor(s));
    } else {
      s.len = from.distanceTo(s.p);
      s.d = Math.min(s.d, s.len) - BACK_SPEED * dt;
      if (s.d <= 0.3) return false;
    }
    return true;
  }
  // 두 가닥 줄과 갈고리 그리기
  draw(cable, s, from) {
    const to = s.phase === 'back' ? s.p : this.anchor(s);
    const dir = to.clone().sub(from); const L = dir.length() || 1; dir.divideScalar(L);
    const rx = Math.cos(from.h || 0), rz = -Math.sin(from.h || 0);
    const cam = this.g.camera?.position;
    const flying = s.phase !== 'hold';
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const a = from.clone(); a.x += rx * 0.26 * side; a.z += rz * 0.26 * side;
      // 두 갈고리는 걸린 곳 양옆에 조금 떨어져 박힌다
      const end = to.clone(); end.x += rx * 0.35 * side; end.z += rz * 0.35 * side;
      const v = end.sub(a); const full = v.length() || 1; v.divideScalar(full);
      const len = Math.max(0.05, full * Math.min(1, s.d / L));
      const head = a.clone().addScaledVector(v, len);
      // 날아가는 동안은 줄이 살짝 출렁인다 · 박힌 직후엔 팽팽하게 떨린다
      if (flying) head.y -= Math.sin(Math.min(1, s.d / L) * Math.PI) * Math.min(1.5, len * 0.03);
      if (s.latchT > 0) { const k = s.latchT * 0.6; head.x += (Math.random() - 0.5) * k; head.y += (Math.random() - 0.5) * k; }
      const seg = head.clone().sub(a); const sl = seg.length() || 0.01;
      const thick = Math.max(0.035, cam ? cam.distanceTo(head.clone().lerp(a, 0.5)) * 0.0018 : 0.04); // 멀리서도 보이게
      const { rope, claw } = cable[i];
      rope.visible = claw.visible = true;
      rope.position.copy(a); rope.scale.set(thick, sl, thick);
      rope.quaternion.setFromUnitVectors(UP, seg.divideScalar(sl));
      claw.position.copy(head);
      claw.quaternion.setFromUnitVectors(UP, s.phase === 'back' ? v.clone().negate() : v);
      claw.scale.setScalar(Math.max(1, thick / 0.035 * 0.6));
    }
    // 날아가는 갈고리 뒤로 반짝이는 꼬리
    if (s.phase === 'out' && this.g.combat?.fx) this.g.combat.fx.part(from.clone().addScaledVector(dir, Math.min(s.d, L)), new THREE.Vector3(), '#ffffff', 0.2, 0.45, 0.05);
  }
  hide(cable) { for (const x of cable) x.rope.visible = x.claw.visible = false; }
  update(dt) {
    const g = this.g, p = g.player;
    // 내 갈고리
    const M = this.mine;
    if (M.s) {
      const from = this.hip(p.pos, p.roach.root.rotation.y);
      if (g.mode !== 'city' || g.loc() !== -1 || !this.step(M.s, from, dt, true)) { M.s = null; this.hide(M.cable); }
      else this.draw(M.cable, M.s, from);
    } else this.hide(M.cable);
    // 가스: 당기거나 Space를 누르면 등 뒤로 하얀 가스 + 쉭 소리
    const O = p.odm;
    const gas = O && (O.pulling || O.gas > 0);
    loop('gas', gas ? 0.5 : O ? 0.12 : 0);
    if (gas && g.combat?.fx) {
      this.puffT = (this.puffT || 0) - dt;
      if (this.puffT <= 0) {
        this.puffT = 0.05;
        const hip = p.pos.clone(); hip.y += 0.8;
        const back = O.vel.clone().normalize().multiplyScalar(-3);
        g.combat.fx.part(hip, back.add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5))), '#eceff1', 0.6, 0.35, 1.2, { normal: true, op: 0.55 });
      }
    }
    // 다른 플레이어 갈고리
    for (const [pid, e] of this.others) {
      const pl = g.players.list.get(pid);
      if (!pl) { this.hide(e.cable); for (const x of e.cable) this.scene.remove(x.rope, x.claw); this.others.delete(pid); continue; }
      if (!e.s || pl.loc !== -1 || g.loc() !== -1) { this.hide(e.cable); continue; }
      const from = this.hip(pl.roach.root.position, pl.roach.root.rotation.y);
      if (!this.step(e.s, from, dt, false)) { e.s = null; this.hide(e.cable); }
      else this.draw(e.cable, e.s, from);
    }
  }
}
