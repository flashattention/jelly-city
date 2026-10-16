// 젤리병단 장비(입체기동)와 거대 젤리 (브라우저)
import * as THREE from 'three';
import { Roach } from './roach.js';
import { TITAN, napePos } from './titans.js';
import { sfx, loop } from './audio.js';

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

// ---------------- 거대 젤리 ----------------
export class TitansView {
  constructor(scene, groundY) { this.scene = scene; this.groundY = groundY; this.list = new Map(); }
  // 서버 스냅샷: [id, x, z, 방향, 크기, 상태, 색] × n
  apply(arr) {
    const seen = new Set();
    for (let i = 0; i + 6 < arr.length; i += 7) {
      const id = arr[i]; seen.add(id);
      const x = arr[i + 1] / 10, z = arr[i + 2] / 10, h = arr[i + 3] / 100, s = arr[i + 4] / 10, st = arr[i + 5], c = arr[i + 6];
      const t = this.list.get(id) || this.make(id, s, c, x, z, h);
      t.tx = x; t.tz = z; t.th = h;
      if (st === 1 && t.state !== 1) t.r.attack('melee');
      if (st === 2 && t.state !== 2) { t.r.setDead(true); t.r.setEmotion('sad', 999); }
      t.state = st;
    }
    for (const [id, t] of this.list) if (!seen.has(id)) { this.scene.remove(t.r.root); this.scene.remove(t.mark); this.list.delete(id); }
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
    const t = { id, s, r, mark, x, z, h, y: this.groundY(x, z), tx: x, tz: z, th: h, state: 0, base: new THREE.Vector3(x, 0, z) };
    this.list.set(id, t);
    return t;
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

function makeCable(color = '#3e2723') {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  line.frustumCulled = false; line.visible = false;
  const hook = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), new THREE.MeshToonMaterial({ color: '#90a4ae' }));
  hook.visible = false;
  return { line, hook };
}

// ---------------- 젤리병단 장비 ----------------
export class Odm {
  constructor(game, scene) {
    this.g = game; this.scene = scene;
    this.mine = makeCable(); scene.add(this.mine.line, this.mine.hook);
    this.others = new Map(); // 다른 플레이어 id → { cable, a, ti }
    this.missT = 0;
  }
  has() { return this.g.inv?.selected()?.id === 'odm_gear'; }
  // 우클릭: 카메라 가운데가 가리키는 건물·거대 젤리에 갈고리를 박는다
  fire() {
    const g = this.g, p = g.player;
    if (!this.has() || p.inCar || g.dead || g.busy || g.mode !== 'city') return false;
    const { o, d } = g.combat.aimRay();
    const hit = this.cast(o, d);
    sfx('hook');
    if (!hit) { this.missT = 0.18; this.missTo = o.clone().addScaledVector(d, HOOK_RANGE); return true; }
    let v = null;
    if (p.mount) { v = new THREE.Vector3(Math.sin(p.heading) * p.speed, 3, Math.cos(p.heading) * p.speed); g.dismountForOdm?.(); }
    if (g.emoting) g.stopEmote();
    p.odmStart(v);
    const chest = p.pos.clone(); chest.y += 1.1;
    if (hit.titan) {
      // 움직이는 거대 젤리: 몸에 붙은 자리(젤리 기준 좌표)를 기억했다가 매 순간 다시 계산
      const t = hit.titan, ca = Math.cos(-t.h), sa = Math.sin(-t.h);
      const dx = hit.point.x - t.x, dz = hit.point.z - t.z;
      const loc = { x: dx * ca + dz * sa, y: hit.point.y - t.y, z: -dx * sa + dz * ca, id: t.id };
      p.odm.hook = { get: () => this.titanPoint(loc), len: chest.distanceTo(hit.point) };
      g.net.send({ t: 'fx', k: 'odm', a: [hit.point.x, hit.point.y, hit.point.z], ti: [loc.id, loc.x, loc.y, loc.z] });
    } else {
      p.odm.hook = { p: hit.point.clone(), len: chest.distanceTo(hit.point) };
      g.net.send({ t: 'fx', k: 'odm', a: [hit.point.x, hit.point.y, hit.point.z] });
    }
    return true;
  }
  // 지금 조준점이 갈고리를 걸 수 있는 곳인지 (0.1초마다 한 번만 계산)
  canHook() {
    const now = performance.now();
    if (now - (this.canT || 0) > 100) { this.canT = now; const { o, d } = this.g.combat.aimRay(); this.canV = this.g.mode === 'city' && !!this.cast(o, d); }
    return this.canV;
  }
  // 우클릭을 떼면: 갈고리를 풀고 그 기세로 날아간다
  release() {
    const p = this.g.player;
    if (p.odm?.hook) { p.odm.hook = null; this.g.net.send({ t: 'fx', k: 'odm', a: null }); }
  }
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
  // 다른 플레이어의 갈고리
  remote(m) {
    const o = this.others.get(m.pid);
    if (!Array.isArray(m.a)) { if (o) { this.scene.remove(o.cable.line, o.cable.hook); this.others.delete(m.pid); } return; }
    const e = o || { cable: makeCable() };
    if (!o) { this.scene.add(e.cable.line, e.cable.hook); this.others.set(m.pid, e); }
    e.a = new THREE.Vector3(+m.a[0], +m.a[1], +m.a[2]);
    e.ti = Array.isArray(m.ti) ? { id: +m.ti[0], x: +m.ti[1], y: +m.ti[2], z: +m.ti[3] } : null;
  }
  drawCable(c, from, to) {
    const pos = c.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z); pos.setXYZ(1, to.x, to.y, to.z); pos.needsUpdate = true;
    c.line.visible = true;
    c.hook.visible = true; c.hook.position.copy(to);
    c.hook.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  }
  update(dt) {
    const g = this.g, p = g.player;
    // 내 갈고리줄 (허리에서 걸린 곳까지)
    const hip = p.pos.clone(); hip.y += 1.0;
    const a = p.odm?.hook ? (p.odm.hook.get ? p.odm.hook.get() : p.odm.hook.p) : null;
    if (a) this.drawCable(this.mine, hip, a);
    else if (this.missT > 0) { this.missT -= dt; this.drawCable(this.mine, hip, this.missTo); this.mine.hook.visible = false; }
    else { this.mine.line.visible = false; this.mine.hook.visible = false; }
    // 가스: 당기거나 Space를 누르면 등 뒤로 하얀 가스 + 쉭 소리
    const O = p.odm;
    const gas = O && (O.pulling || O.gas > 0);
    loop('gas', gas ? 0.5 : O ? 0.12 : 0);
    if (gas && g.combat?.fx) {
      this.puffT = (this.puffT || 0) - dt;
      if (this.puffT <= 0) {
        this.puffT = 0.05;
        const back = O.vel.clone().normalize().multiplyScalar(-3);
        g.combat.fx.part(hip.clone().add(new THREE.Vector3(0, -0.2, 0)), back.add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5))), '#eceff1', 0.6, 0.35, 1.2, { normal: true, op: 0.55 });
      }
    }
    // 다른 플레이어 갈고리줄
    for (const [pid, e] of this.others) {
      const pl = g.players.list.get(pid);
      if (!pl || pl.loc !== -1 || g.loc() !== -1) { e.cable.line.visible = false; e.cable.hook.visible = false; continue; }
      const to = e.ti ? this.titanPoint(e.ti) : e.a;
      if (!to) { e.cable.line.visible = false; e.cable.hook.visible = false; continue; }
      const from = pl.roach.root.position.clone(); from.y += 1.0;
      this.drawCable(e.cable, from, to);
    }
  }
}
