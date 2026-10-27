// 1인칭: 내 몸(움직임 · 벽 · 계단 · 점프 · 앉기) + 화면 앞 총(곰돌이 손 · 반동 · 장전 · 총구 불꽃)
import * as THREE from 'three';
import { floorAt, boxesIn } from './maps.js';

const R = 0.35, H_STAND = 1.72, H_CROUCH = 1.18, EYE_STAND = 1.55, EYE_CROUCH = 1.05;
export class Player {
  constructor() { this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.onGround = true; this.crouch = 0; this.prone = 0; this.alive = false; this.hp = 100; this.stepT = 0; this.snapDY = 0; }
  // prone: 엎드리기 (젤리배그) · 눈 0.45m · 키 0.6m
  get eyeH() { return (EYE_STAND + (EYE_CROUCH - EYE_STAND) * this.crouch) * (1 - this.prone) + 0.45 * this.prone; }
  get height() { return (H_STAND + (H_CROUCH - H_STAND) * this.crouch) * (1 - this.prone) + 0.6 * this.prone; }
  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
  // 카메라 눈: 턱 · 상자 · 차 위로 올라설 때 몸은 바로 올라가도 시점은 부드럽게 따라간다 (뚝 끊기지 않게)
  viewEye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH - this.snapDY, this.pos.z); }
  forward(out = new THREE.Vector3()) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
  // inp = { f, s (앞뒤 · 좌우 -1~1), jump, crouch, sprint, ads }  돌려주는 값: 소리 낼 일
  update(dt, inp, map) {
    const ev = [];
    this.snapDY *= Math.exp(-dt * 13); if (Math.abs(this.snapDY) < 0.002) this.snapDY = 0;
    this.crouch += ((inp.crouch ? 1 : 0) - this.crouch) * Math.min(1, dt * 12);
    this.prone += ((inp.prone ? 1 : 0) - this.prone) * Math.min(1, dt * 6);
    // 달리기: Shift + 앞으로 (앉거나 조준하는 중엔 안 된다)
    this.sprinting = !!inp.sprint && inp.f > 0 && !inp.crouch && !inp.prone && !inp.ads && this.crouch < 0.5;
    const speed = (this.sprinting ? 9.2 : 6.2) * (inp.crouch ? 0.45 : 1) * (inp.prone ? 0.28 : 1) * (inp.ads ? 0.65 : 1) * (inp.speedMul || 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let wx = fx * inp.f + rx * inp.s, wz = fz * inp.f + rz * inp.s;
    const L = Math.hypot(wx, wz); if (L > 1) { wx /= L; wz /= L; }
    // keepVel: 돌진 · 넉백처럼 정해진 속도로 (젤리워치) · airCtl: 공중 조작 배수 · noGrav: 날기
    const k = Math.min(1, dt * (this.onGround ? 14 : 3 * (inp.airCtl || 1)));
    if (!inp.keepVel) { this.vel.x += (wx * speed - this.vel.x) * k; this.vel.z += (wz * speed - this.vel.z) * k; }
    if (inp.jump && this.onGround && !inp.prone) { this.vel.y = inp.jumpV || 7; this.onGround = false; ev.push('jump'); }
    if (!inp.noGrav) this.vel.y -= 21 * dt;
    // 옆으로: x 축 · z 축 따로 움직이고 벽에서 밀어낸다
    this.pos.x += this.vel.x * dt; this.push(map, 'x');
    this.pos.z += this.vel.z * dt; this.push(map, 'z');
    // 위아래
    const wasGround = this.onGround;
    this.pos.y += this.vel.y * dt;
    this.snapDY = Math.min(this.snapDY, 0.6);
    if (this.vel.y > 0) for (const b of boxesIn(map, this.pos.x - 1, this.pos.z - 1, this.pos.x + 1, this.pos.z + 1)) if (this.inXZ(b) && b.y > this.pos.y && b.y < this.pos.y + this.height) { this.pos.y = b.y - this.height; this.vel.y = 0; }
    const fl = floorAt(map, this.pos.x, this.pos.z, Math.max(this.pos.y, this.pos.y - this.vel.y * dt), R);
    if (this.pos.y <= fl) { if (!wasGround && this.vel.y < -6) ev.push('land'); if (fl - this.pos.y > 0.03) this.snapDY += fl - this.pos.y; this.pos.y = fl; this.vel.y = 0; this.onGround = true; }
    else if (this.pos.y > fl + 0.05) this.onGround = false;
    // 발소리
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && sp > 2 && !inp.crouch) { this.stepT -= dt * sp; if (this.stepT <= 0) { this.stepT = 2.2; ev.push('step'); } }
    return ev;
  }
  inXZ(b, r = R) { return this.pos.x > b.x - b.w / 2 - r && this.pos.x < b.x + b.w / 2 + r && this.pos.z > b.z - b.d / 2 - r && this.pos.z < b.z + b.d / 2 + r; }
  push(map, axis) {
    for (const b of boxesIn(map, this.pos.x - 1, this.pos.z - 1, this.pos.x + 1, this.pos.z + 1)) {
      const top = b.y + b.h;
      if (top <= this.pos.y + 0.55 || b.y >= this.pos.y + this.height || !this.inXZ(b)) continue; // 계단처럼 낮은 건 올라선다
      if (axis === 'x') { const l = b.x - b.w / 2 - R, r = b.x + b.w / 2 + R; this.pos.x = this.pos.x - l < r - this.pos.x ? l : r; this.vel.x = 0; }
      else { const l = b.z - b.d / 2 - R, r = b.z + b.d / 2 + R; this.pos.z = this.pos.z - l < r - this.pos.z ? l : r; this.vel.z = 0; }
    }
    // 낮은 턱은 올라선다
    const fl = floorAt(map, this.pos.x, this.pos.z, this.pos.y, R);
    if (fl > this.pos.y && fl - this.pos.y <= 0.55 && this.onGround) { this.snapDY += fl - this.pos.y; this.pos.y = fl; }
  }
}

// ---------- 화면 앞 총 ----------
const metal = new THREE.MeshToonMaterial({ color: '#3a3d46' }), dark = new THREE.MeshToonMaterial({ color: '#22242b' }), wood = new THREE.MeshToonMaterial({ color: '#7a4f2d' });
const box = (p, m, x, y, z, w, h, d) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
const cyl = (p, m, x, y, z, r, len) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); p.add(o); return o; };
// 종류별 총 모양 (앞 = -z). 돌려주는 값: { group, muzzle(총구 위치) }
export function gunModel(cls, accent = '#ff8fc4') {
  const g = new THREE.Group(), acc = new THREE.MeshToonMaterial({ color: accent });
  let muzzle = -0.6;
  if (cls === 'knife') { box(g, wood, 0, 0, 0.05, 0.05, 0.06, 0.18); const bl = box(g, new THREE.MeshToonMaterial({ color: '#d8dee6' }), 0, 0.01, -0.2, 0.02, 0.07, 0.34); bl.rotation.x = 0.05; muzzle = -0.38; }
  else if (cls === 'nade') { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), acc); g.add(s); box(g, metal, 0, 0.09, 0, 0.04, 0.06, 0.04); muzzle = 0; }
  else if (cls === 'pistol') { box(g, metal, 0, 0.04, -0.12, 0.05, 0.07, 0.26); box(g, dark, 0, -0.05, -0.02, 0.045, 0.13, 0.07); box(g, acc, 0, 0.08, -0.12, 0.02, 0.01, 0.24); muzzle = -0.26; }
  else {
    const L = cls === 'sniper' ? 1.0 : cls === 'smg' ? 0.5 : cls === 'shotgun' ? 0.8 : cls === 'lmg' ? 0.85 : 0.7;
    box(g, metal, 0, 0, -L * 0.35, 0.07, 0.1, L * 0.7);                                      // 몸통
    cyl(g, dark, 0, 0.01, -L * 0.7 - 0.1, cls === 'shotgun' ? 0.035 : 0.022, cls === 'sniper' ? 0.5 : 0.3); // 총열
    box(g, cls === 'sniper' || cls === 'shotgun' ? wood : dark, 0, -0.02, 0.12, 0.06, 0.09, 0.24); // 개머리
    box(g, dark, 0, -0.09, -0.02, 0.045, 0.12, 0.06);                                       // 손잡이
    if (cls === 'lmg') box(g, metal, 0, -0.1, -0.28, 0.12, 0.12, 0.16);
    else if (cls !== 'shotgun') { const mg = box(g, dark, 0, -0.11, -0.22, 0.05, 0.16, 0.07); mg.rotation.x = 0.25; }
    if (cls === 'shotgun') box(g, wood, 0, -0.05, -L * 0.6, 0.07, 0.06, 0.18);
    if (cls === 'sniper') { cyl(g, dark, 0, 0.1, -0.3, 0.035, 0.36); }
    else box(g, acc, 0, 0.065, -L * 0.35, 0.025, 0.03, 0.18);                                // 젤리 색 가늠자
    muzzle = -L * 0.7 - 0.27 - (cls === 'sniper' ? 0.1 : 0);
  }
  return { group: g, muzzle };
}

export class ViewModel {
  constructor(color) {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 1.6));
    const dl = new THREE.DirectionalLight('#ffffff', 1.2); dl.position.set(1, 2, 1); this.scene.add(dl);
    this.cam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.rig = new THREE.Group(); this.scene.add(this.rig);
    // 곰돌이 앞발 (내 젤리 색)
    const paw = new THREE.MeshToonMaterial({ color: color || '#8a5634', transparent: true, opacity: 0.92 });
    this.paws = [new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), paw), new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), paw)];
    this.paws[0].scale.set(1, 0.9, 1.3); this.paws[1].scale.set(1, 0.9, 1.3);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex(), color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.flash.scale.setScalar(0.25); this.flash.visible = false;
    this.kickT = 0; this.reloadT = 0; this.reloadDur = 1; this.switchT = 0; this.flashT = 0; this.bob = 0; this.ads = 0; this.swingT = 0;
  }
  setWeapon(w, color) {
    if (this.gun) this.rig.remove(this.gun.group);
    this.gun = gunModel(w.cls, color); this.cls = w.cls; this.scope = !!w.scope;
    this.rig.add(this.gun.group);
    this.gun.group.add(this.paws[0], this.paws[1], this.flash);
    this.paws[0].position.set(0, -0.12, 0.02); this.paws[1].position.set(0.02, -0.08, -0.35);
    if (w.cls === 'pistol' || w.cls === 'knife' || w.cls === 'nade') this.paws[1].position.set(0, -0.06, 0.05);
    this.flash.position.set(0, 0.01, this.gun.muzzle);
    this.switchT = 0.35;
  }
  kick(k) { this.kickT = Math.min(1, this.kickT + k); this.flashT = 0.05; }
  reload(dur) { this.reloadT = dur; this.reloadDur = dur; }
  swing() { this.swingT = 0.3; }
  // 총구가 화면 3D 세상에서 어디쯤인지 (궤적 시작점) → main 이 카메라 기준으로 계산
  update(dt, aspect, moving, ads, t) {
    this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
    this.ads += ((ads ? 1 : 0) - this.ads) * Math.min(1, dt * 12);
    this.kickT = Math.max(0, this.kickT - dt * 6);
    this.flashT -= dt; this.flash.visible = this.flashT > 0; if (this.flash.visible) this.flash.material.rotation = Math.random() * 6;
    this.reloadT = Math.max(0, this.reloadT - dt); this.switchT = Math.max(0, this.switchT - dt); this.swingT = Math.max(0, this.swingT - dt);
    if (moving) this.bob += dt * 9;
    const a = this.ads, bobA = moving ? (1 - a * 0.8) : 0;
    const rel = this.reloadT > 0 ? Math.sin((1 - this.reloadT / this.reloadDur) * Math.PI) : 0;
    const g = this.rig;
    g.position.set(0.26 * (1 - a) + Math.sin(this.bob) * 0.012 * bobA, -0.25 * (1 - a) - 0.115 * a - Math.abs(Math.cos(this.bob)) * 0.012 * bobA - rel * 0.18 - this.switchT * 0.6, -0.5 + 0.08 * a + this.kickT * 0.07);
    g.scale.setScalar(0.82);
    g.rotation.set(this.kickT * 0.12 + rel * 0.6, rel * 0.4, rel * 0.3);
    if (this.swingT > 0) { const s = Math.sin((1 - this.swingT / 0.3) * Math.PI); g.rotation.set(-s * 0.4, s * 0.9, -s * 0.6); g.position.x -= s * 0.15; }
    g.visible = !(this.scope && a > 0.85); // 저격총 조준경을 보면 총은 숨긴다
  }
  render(renderer) { renderer.clearDepth(); renderer.render(this.scene, this.cam); }
}
let _flash = null;
function flashTex() {
  if (_flash) return _flash;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,220,140,.9)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  x.fillStyle = g; x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 12 : 32; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill();
  return (_flash = new THREE.CanvasTexture(c));
}
