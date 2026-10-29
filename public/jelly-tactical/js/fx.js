// 큰 효과 (젤리택티컬 · 젤리드롭 같이): 수류탄 폭발 · 연막
//   폭발 = 하얀 섬광 + 불덩이 + 땅을 쓸고 가는 충격파 + 파편 + 오래 남는 검은 연기 + 순간 조명
import * as THREE from 'three';
import { rayBoxes, floorAt } from './maps.js';

let _soft = null;
function softTex() {
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.75)'); g.addColorStop(0.7, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (_soft = new THREE.CanvasTexture(c));
}
let _puff = null;
function puffTex() {
  if (_puff) return _puff;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const cx = 64 + Math.cos(i * 0.7) * 22 * Math.random(), cy = 64 + Math.sin(i * 1.3) * 22 * Math.random(), r = 26 + Math.random() * 20;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  return (_puff = new THREE.CanvasTexture(c));
}
const list = [];
function sprite(scene, tex, color, p, size, blending = THREE.NormalBlending, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending }));
  s.position.copy(p); s.scale.setScalar(size); scene.add(s); return s;
}
// 수류탄 폭발: r = 피해 반지름(m)
export function explosion(scene, p, r = 8) {
  const at = p.clone(); at.y = Math.max(at.y, 0.3);
  // 1) 하얀 섬광 (아주 짧게)
  list.push({ o: sprite(scene, softTex(), '#fff8e0', at, r * 0.9, THREE.AdditiveBlending), t: 0.14, life: 0.14, k: 'flash', s0: r * 0.9, s1: r * 1.6 });
  // 2) 불덩이: 노랑 → 주황 → 빨강으로 부풀다 꺼진다
  for (let i = 0; i < 14; i++) {
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
    const o = sprite(scene, puffTex(), '#ffd36b', at.clone().addScaledVector(d, Math.random() * 0.8), 1.2, THREE.AdditiveBlending);
    list.push({ o, t: 0.55 + Math.random() * 0.25, life: 0.8, k: 'fire', v: d.multiplyScalar(4 + Math.random() * 6), s0: 1.2, s1: r * (0.45 + Math.random() * 0.25) });
  }
  // 3) 땅을 쓸고 가는 충격파 고리 + 그을음 자국
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(at.x, Math.max(0.05, p.y - 0.25), at.z); scene.add(ring);
  list.push({ o: ring, t: 0.45, life: 0.45, k: 'ring', s0: 0.5, s1: r * 1.15 });
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ map: softTex(), color: '#1a1410', transparent: true, opacity: 0.7, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(at.x, Math.max(0.03, p.y - 0.27), at.z); scorch.scale.setScalar(r * 0.35); scene.add(scorch);
  list.push({ o: scorch, t: 9, life: 9, k: 'scorch' });
  // 4) 파편 · 불티 (포물선)
  for (let i = 0; i < 26; i++) {
    const d = new THREE.Vector3(Math.random() - 0.5, 0.4 + Math.random(), Math.random() - 0.5).normalize();
    const o = sprite(scene, softTex(), i % 3 ? '#ffb347' : '#3a2a20', at, 0.25 + Math.random() * 0.25, i % 3 ? THREE.AdditiveBlending : THREE.NormalBlending);
    list.push({ o, t: 0.9 + Math.random() * 0.5, life: 1.4, k: 'debris', v: d.multiplyScalar(9 + Math.random() * 10) });
  }
  // 5) 오래 남는 검은 연기 (위로 피어오른다)
  for (let i = 0; i < 10; i++) {
    const o = sprite(scene, puffTex(), '#4a4040', at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2)), 2, THREE.NormalBlending, 0);
    list.push({ o, t: 3 + Math.random() * 2, life: 5, k: 'smoke', v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8), s0: 2, s1: r * 0.7, delay: 0.12, op: 0.55 });
  }
  // 6) 순간 조명
  const light = new THREE.PointLight('#ffb35c', 60, r * 4, 2); light.position.copy(at).y += 1; scene.add(light);
  list.push({ o: light, t: 0.4, life: 0.4, k: 'light' });
}
// 연막탄: 섞인 회색 구름이 r 반지름으로 퍼져 life 초 동안 남는다
export function smoke(scene, p, r = 7, life = 18) {
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.8;
    const to = new THREE.Vector3(p.x + Math.cos(a) * d, 0.8 + Math.random() * 3.2, p.z + Math.sin(a) * d);
    const o = sprite(scene, puffTex(), i % 4 ? '#e8e4ee' : '#cfc8d8', p, 1.5, THREE.NormalBlending, 0);
    list.push({ o, t: life + Math.random() * 2, life: life + 2, k: 'cloud', from: p.clone(), to, s1: 4.5 + Math.random() * 3, grow: 1.6 + Math.random() });
  }
}
export function updateFx(dt, camera) {
  for (const f of list) {
    f.t -= dt;
    const age = f.life - f.t, u = Math.min(1, age / f.life);
    if (f.k === 'flash') { f.o.scale.setScalar(f.s0 + (f.s1 - f.s0) * u); f.o.material.opacity = 1 - u; }
    else if (f.k === 'fire') { f.o.position.addScaledVector(f.v, dt); f.v.multiplyScalar(Math.exp(-dt * 5)); f.v.y += dt * 2; const k = Math.min(1, age / 0.18); f.o.scale.setScalar(f.s0 + (f.s1 - f.s0) * k); f.o.material.color.setHSL(0.12 - u * 0.12, 1, 0.65 - u * 0.4); f.o.material.opacity = Math.max(0, 1 - u * 1.2); }
    else if (f.k === 'ring') { f.o.scale.setScalar(f.s0 + (f.s1 - f.s0) * Math.sqrt(u)); f.o.material.opacity = 0.9 * (1 - u); }
    else if (f.k === 'scorch') f.o.material.opacity = 0.7 * Math.min(1, f.t / 2);
    else if (f.k === 'debris') { f.v.y -= 22 * dt; f.o.position.addScaledVector(f.v, dt); if (f.o.position.y < 0.05) { f.o.position.y = 0.05; f.v.multiplyScalar(0.3); } f.o.material.opacity = Math.min(1, f.t * 2); }
    else if (f.k === 'smoke') { if (age < f.delay) continue; f.o.position.addScaledVector(f.v, dt); f.o.scale.setScalar(f.s0 + (f.s1 - f.s0) * Math.sqrt(u)); f.o.material.opacity = f.op * Math.min(1, (age - f.delay) * 4) * (1 - u); }
    else if (f.k === 'light') f.o.intensity = 60 * (1 - u) ** 2;
    else if (f.k === 'cloud') { const k = Math.min(1, age / 1.6); f.o.position.lerpVectors(f.from, f.to, 1 - (1 - k) ** 3); f.o.scale.setScalar(1.5 + f.s1 * k + age * 0.05 * f.grow); f.o.material.opacity = 0.92 * Math.min(1, age * 2) * Math.min(1, f.t / 3); }
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t <= 0) { const o = list[i].o; o.parent?.remove(o); o.geometry?.dispose?.(); o.material?.dispose?.(); list.splice(i, 1); }
  void camera;
}

// ---------- 수류탄 날아가기 (실제 비행 · 미리보기가 같은 식) ----------
export function stepNade(p, v, dt, map) {
  v.y -= 18 * dt;
  const step = v.clone().multiplyScalar(dt), L = step.length();
  if (L > 0) { const d = step.clone().divideScalar(L), wt = rayBoxes(map, p, d, L + 0.15); if (wt < L + 0.15) { v.x *= -0.4; v.z *= -0.4; step.set(0, step.y, 0); } }
  p.add(step);
  const fl = floorAt(map, p.x, p.z, p.y, 0.1) + 0.13;
  if (p.y < fl) { p.y = fl; v.y = Math.abs(v.y) * 0.35; v.x *= 0.7; v.z *= 0.7; }
}
// 던지기 전에 보이는 포물선 + 터질 자리 · 폭발 범위
export class NadeArc {
  constructor(scene) {
    this.N = 140;
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    this.line = new THREE.Line(this.geo, new THREE.LineDashedMaterial({ color: '#ffe27a', dashSize: 0.35, gapSize: 0.22, transparent: true, opacity: 0.95, depthTest: false }));
    this.line.renderOrder = 20; this.line.frustumCulled = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 56), new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    this.fill.rotation.x = -Math.PI / 2;
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
    this.group = new THREE.Group(); this.group.add(this.line, this.ring, this.fill, this.dot); this.group.visible = false; scene.add(this.group);
  }
  show(on) { this.group.visible = on; }
  update(p0, v0, map, fuse, r) {
    const p = p0.clone(), v = v0.clone(), arr = this.geo.attributes.position.array, dt = fuse / (this.N - 1);
    for (let i = 0; i < this.N; i++) { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; for (let k = 0; k < 2; k++) stepNade(p, v, dt / 2, map); }
    this.geo.attributes.position.needsUpdate = true; this.line.computeLineDistances(); this.geo.computeBoundingSphere();
    const end = new THREE.Vector3(arr[(this.N - 1) * 3], arr[(this.N - 1) * 3 + 1], arr[(this.N - 1) * 3 + 2]);
    this.ring.position.set(end.x, end.y - 0.1, end.z); this.ring.scale.setScalar(r);
    this.fill.position.set(end.x, end.y - 0.11, end.z); this.fill.scale.setScalar(r);
    this.dot.position.copy(end);
  }
}
