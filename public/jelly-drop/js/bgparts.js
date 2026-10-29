// 젤리드롭 조각들: 차량(모양 · 운전) · 헬멧 · 조끼 · 가방(곰돌이에 입히기) · 바닥 아이템 모양
import * as THREE from 'three';
import { boxesIn, floorAt } from '../../jelly-tactical/js/maps.js';
import { VEHICLES, BOOSTS, inWater } from './bgrules.js';

const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
const box = (p, m, x, y, z, w, h, d) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
const cyl = (p, m, x, y, z, r, len, rz = 0, rx = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), m); o.position.set(x, y, z); o.rotation.z = rz; o.rotation.x = rx; p.add(o); return o; };
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// ---------- 차량 모양 (앞 = -z) ----------
export function buildVehicle(kind, color = '#ff8fc4') {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const main = toon(color, { transparent: true, opacity: 0.93 }), dark = toon('#2b2b38'), metal = toon('#b9bfcc'), glass = toon('#bfe9ff', { transparent: true, opacity: 0.55 });
  const wheels = [];
  const wheel = (x, z, r) => { const w = new THREE.Group(); w.position.set(x, r, z); body.add(w); const t = cyl(w, dark, 0, 0, 0, r, 0.36, Math.PI / 2); cyl(t, metal, 0, 0, 0, r * 0.45, 0.38); wheels.push(w); return w; };
  if (kind === 'boat') {
    // 젤리 보트: 뾰족한 앞 · 흰 몸 · 분홍 줄 · 뒤 모터
    box(body, toon('#ffffff'), 0, 0.45, 0.3, 1.8, 0.6, 3.2);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 4), toon('#ffffff')); bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.42); bow.position.set(0, 0.45, -1.95); body.add(bow);
    box(body, main, 0, 0.78, 0.3, 1.85, 0.1, 3.25);
    box(body, dark, 0, 0.8, 0.6, 1.2, 0.2, 1.0); box(body, glass, 0, 1.15, -0.4, 1.2, 0.5, 0.06);
    box(body, dark, 0, 0.7, 2.0, 0.5, 0.7, 0.4);
  } else if (kind === 'van') {
    // 젤리 밴: 통통한 상자 몸 · 창문 · 지붕 짐칸
    box(body, main, 0, 1.15, 0, 2.1, 1.5, 4.4);
    box(body, toon(shade(color, 1.25)), 0, 0.55, 0, 2.15, 0.35, 4.45);
    box(body, glass, 0, 1.45, -2.21, 1.8, 0.7, 0.04);
    for (const s of [-1, 1]) for (const z of [-1.2, 0.3, 1.5]) box(body, glass, s * 1.06, 1.45, z, 0.04, 0.55, 0.95);
    box(body, dark, 0, 2.0, 0.3, 1.6, 0.12, 2.6);
    for (const s of [-1, 1]) { box(body, toon('#fff6c2', { emissive: '#ffe08a', emissiveIntensity: 0.6 }), s * 0.7, 0.85, -2.22, 0.36, 0.22, 0.05); box(body, toon('#ff4f6a', { emissive: '#ff2a4a', emissiveIntensity: 0.4 }), s * 0.8, 0.85, 2.22, 0.3, 0.18, 0.05); }
    for (const [x, z] of [[-1.05, -1.45], [1.05, -1.45], [-1.05, 1.45], [1.05, 1.45]]) wheel(x, z, 0.45);
  } else {
    // 젤리 버기: 낮은 몸 · 둥근 앞코 · 롤케이지 · 큰 바퀴
    box(body, main, 0, 0.75, 0.1, 1.7, 0.45, 2.8);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), main); nose.scale.set(1, 0.55, 1); nose.position.set(0, 0.75, -1.25); body.add(nose);
    box(body, dark, 0, 1.0, 0.35, 1.2, 0.12, 1.2); // 자리
    box(body, dark, 0, 1.3, 0.85, 1.2, 0.6, 0.15); // 등받이
    for (const s of [-1, 1]) { cyl(body, metal, s * 0.75, 1.55, -0.1, 0.05, 1.4); cyl(body, metal, s * 0.75, 1.55, 1.0, 0.05, 1.4); cyl(body, metal, s * 0.75, 2.25, 0.45, 0.05, 1.15, 0, Math.PI / 2); }
    cyl(body, metal, 0, 2.25, -0.1, 0.05, 1.5, Math.PI / 2); cyl(body, metal, 0, 2.25, 1.0, 0.05, 1.5, Math.PI / 2);
    for (const s of [-1, 1]) box(body, toon('#fff6c2', { emissive: '#ffe08a', emissiveIntensity: 0.6 }), s * 0.45, 0.85, -1.62, 0.28, 0.16, 0.06);
    const sp = box(body, toon('#ffd84d'), 0, 1.0, 1.55, 1.8, 0.08, 0.35); sp.rotation.x = -0.2; // 뒤 날개
    for (const [x, z] of [[-1.0, -1.05], [1.0, -1.05], [-1.0, 1.15], [1.0, 1.15]]) wheel(x, z, 0.52);
  }
  // 반짝 하이라이트
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 })); hl.scale.set(1.6, 0.4, 0.8); hl.position.set(-0.4, kind === 'van' ? 1.92 : 1.0, -0.6); body.add(hl);
  // 연기 (부서지면)
  g.userData = { body, wheels, kind, seat: kind === 'van' ? [0.5, 0.75, -0.9] : kind === 'boat' ? [0, 0.7, 0.6] : [0, 0.95, 0.35] };
  return g;
}

// ---------- 운전 (아케이드) ----------
//   v = { x, y, z, yaw, speed, kind }  inp = { f(-1~1), s(-1~1), brake }  돌려주는 값: 부딪힌 세기 (0 = 안 부딪힘)
export function drive(v, inp, dt, map) {
  const K = VEHICLES[v.kind] || VEHICLES.buggy;
  let crash = 0;
  // 기름이 없으면 못 달린다 · 차는 물에 들어가면 느려지고 보트는 물 밖으로 못 나간다
  const dry = (v.fuel ?? 100) <= 0;
  if (inp.f > 0 && !dry) v.speed += K.acc * dt * (v.speed < 0 ? 2.2 : 1) * Math.max(0.15, 1 - v.speed / K.max);
  else if (inp.f < 0) v.speed -= (v.speed > 0 ? K.acc * 1.8 : K.acc * 0.6) * dt;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 4 * dt);
  if (inp.brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 22 * dt);
  v.speed = Math.max(-K.max * 0.35, Math.min(K.max * (inp.boost ? 1.25 : 1), v.speed));
  // 빠를수록 덜 꺾이고, 뒤로 가면 반대로
  const grip = Math.min(1, Math.abs(v.speed) / 5) * (1 - 0.35 * Math.min(1, Math.abs(v.speed) / K.max));
  v.steer = (v.steer || 0) + ((inp.s || 0) - (v.steer || 0)) * Math.min(1, dt * 7);
  v.yaw -= v.steer * K.turn * grip * Math.sign(v.speed || 1) * dt;
  const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
  const ox = v.x, oz = v.z;
  v.x += fx * v.speed * dt; v.z += fz * v.speed * dt;
  if (K.water && !inWater(map, v.x + fx * 1.6 * Math.sign(v.speed || 1), v.z + fz * 1.6 * Math.sign(v.speed || 1))) { v.x = ox; v.z = oz; crash = Math.max(crash, Math.abs(v.speed) * 0.5); v.speed *= -0.2; }
  if (!K.water && inWater(map, v.x, v.z, 1)) v.speed *= Math.pow(0.15, dt);
  if (inp.f && !dry) v.fuel = Math.max(0, (v.fuel ?? 100) - Math.abs(v.speed) * K.burn * dt);
  // 벽 · 건물 · 나무: 동그라미로 밀어내고 튕긴다
  const R = K.r;
  for (const b of boxesIn(map, v.x - 3, v.z - 3, v.x + 3, v.z + 3)) {
    if (b.y + b.h <= v.y + 0.6 || b.y >= v.y + 1.6) continue;
    const nx = Math.max(b.x - b.w / 2, Math.min(v.x, b.x + b.w / 2)), nz = Math.max(b.z - b.d / 2, Math.min(v.z, b.z + b.d / 2));
    const dx = v.x - nx, dz = v.z - nz, d = Math.hypot(dx, dz);
    if (d >= R) continue;
    if (d < 1e-4) { v.x -= fx * 0.5; v.z -= fz * 0.5; } else { v.x += (dx / d) * (R - d); v.z += (dz / d) * (R - d); }
    // 정면으로 박을수록 세게
    const into = d > 1e-4 ? Math.max(0, -(fx * dx + fz * dz) / d) : 1;
    crash = Math.max(crash, Math.abs(v.speed) * into);
    v.speed *= into > 0.5 ? -0.25 : 0.88;
  }
  const H = 118; v.x = Math.max(-H, Math.min(H, v.x)); v.z = Math.max(-H, Math.min(H, v.z));
  // 땅 · 턱 (낮은 건 올라탄다) · 떨어지면 중력
  const fl = K.water ? 0 : floorAt(map, v.x, v.z, v.y + 0.6, 0.6);
  if (v.y > fl + 0.05) { v.vy = (v.vy || 0) - 20 * dt; v.y = Math.max(fl, v.y + v.vy * dt); } else { v.y = fl; v.vy = 0; }
  return crash;
}
export function poseVehicle(mesh, v, dt) {
  mesh.position.set(v.x, v.y, v.z); mesh.rotation.y = v.yaw;
  const U = mesh.userData;
  for (const w of U.wheels) w.children[0].rotation.x -= (v.speed || 0) * dt * 2;
  // 핸들 꺾을 때 앞바퀴 · 출렁 (보트는 물결)
  if (U.wheels.length) U.wheels[0].rotation.y = U.wheels[1].rotation.y = -(v.steer || 0) * 0.45;
  if (U.kind === 'boat') { const t = performance.now() / 1000; U.body.position.y = Math.sin(t * 2 + v.id) * 0.06; U.body.rotation.x = Math.sin(t * 1.6 + v.id) * 0.03 - Math.min(0.12, Math.abs(v.speed || 0) * 0.006); }
  U.body.rotation.z = -(v.steer || 0) * Math.min(1, Math.abs(v.speed || 0) / 20) * 0.06;
}

// ---------- 곰돌이에 입히는 헬멧 · 조끼 · 가방 ----------
const LV = ['', '#7f8f5a', '#4c5866', '#2e3138'];
export function dressGear(bear, a, h, b) {
  const U = bear.root.userData.gear ||= {};
  for (const k of ['a', 'h', 'b']) { if (U[k]) { U[k].parent?.remove(U[k]); U[k] = null; } }
  if (h) {
    const g = new THREE.Group(); const m = toon(LV[h]);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), m); cap.scale.set(1, 0.8, 1); g.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24), toon(shade(LV[h], 0.7))); rim.rotation.x = Math.PI / 2; g.add(rim);
    if (h >= 2) { const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), toon('#3a2f28')); for (const s of [-1, 1]) { const st = strap.clone(); st.position.set(s * 0.5, -0.2, 0.05); g.add(st); } }
    if (h >= 3) { const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.04), toon('#1a1c22', { transparent: true, opacity: 0.85 })); visor.position.set(0, 0.12, 0.56); g.add(visor); const nv = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), toon('#111')); nv.rotation.x = Math.PI / 2; nv.position.set(0.15, 0.35, 0.5); g.add(nv); }
    g.position.set(0, 0.12, 0); bear.head.add(g); U.h = g;
  }
  if (a) {
    const g = new THREE.Group(); const m = toon(LV[a]);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.58, 0.7, 18, 1, true), m); v.material.side = THREE.DoubleSide; g.add(v);
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 6, 20), toon(shade(LV[a], 0.7))); top.rotation.x = Math.PI / 2; top.position.y = 0.35; g.add(top);
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.08), toon(shade(LV[a], 1.25))); p.position.set(-0.22 + i * 0.22, -0.05, 0.6); g.add(p); }
    g.position.set(0, 1.1, 0); bear.torso.add(g); U.a = g;
  }
  if (b) {
    const g = new THREE.Group(), col = ['', '#8d6e63', '#5d7f4e', '#3e5a7a'][b];
    const s = 0.75 + b * 0.15;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.75 * s, 0.85 * s, 0.4 * s), toon(col)); g.add(bag);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.78 * s, 0.3 * s, 0.43 * s), toon(shade(col, 0.8))); flap.position.y = 0.3 * s; g.add(flap);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8 * s, 10), toon('#c8b48a')); roll.rotation.z = Math.PI / 2; roll.position.y = 0.55 * s; g.add(roll);
    g.position.set(0, 1.15, -0.62); bear.torso.add(g); U.b = g;
  }
}

// ---------- 바닥 아이템 모양 (총 · 방어구 · 회복 말고 새로 생긴 것들) ----------
const AMMO_COL = { '9mm': '#ffd84d', '556': '#7be04a', '762': '#ff9f43', '12g': '#ff5a5a', '300': '#b388ff', bolt: '#c8a46a' };
export function extraLoot(it, spin) {
  if (it.k === 'ammo') {
    const c = AMMO_COL[it.a] || '#ffd84d';
    box(spin, toon('#5d6b4e'), 0, 0, 0, 0.5, 0.28, 0.32);
    box(spin, toon(c), 0, 0.15, 0, 0.52, 0.05, 0.34);
    for (let i = 0; i < 4; i++) cyl(spin, toon('#e8c26a'), -0.15 + i * 0.1, 0.22, 0, 0.03, 0.12);
    return c;
  }
  if (it.k === 'att') {
    const m = toon('#2e3138');
    if (/^(red|x2|x4|x8)$/.test(it.a)) { const t = cyl(spin, m, 0, 0, 0, it.a === 'red' ? 0.08 : 0.07, it.a === 'x8' ? 0.55 : it.a === 'x4' ? 0.42 : 0.28, 0, Math.PI / 2); cyl(t, toon('#7cd8ff', { emissive: '#3a7ab0' }), 0, 0.15, 0, 0.065, 0.02); }
    else if (it.a === 'supp' || it.a === 'comp') cyl(spin, m, 0, 0, 0, 0.06, 0.4, 0, Math.PI / 2);
    else if (it.a === 'vgrip' || it.a === 'agrip') { const g = box(spin, m, 0, 0, 0, 0.08, 0.3, 0.1); g.rotation.x = it.a === 'agrip' ? 0.6 : 0; }
    else { const g = box(spin, m, 0, 0, 0, 0.1, 0.36, 0.14); g.rotation.x = 0.2; }
    return '#7cd8ff';
  }
  if (it.k === 'bag') {
    const col = ['', '#8d6e63', '#5d7f4e', '#3e5a7a'][it.lv];
    box(spin, toon(col), 0, 0, 0, 0.5, 0.6, 0.3); box(spin, toon(shade(col, 0.8)), 0, 0.22, 0, 0.52, 0.2, 0.32);
    return ['', '#cccccc', '#9be7a7', '#c39bff'][it.lv];
  }
  if (it.k === 'drink') { cyl(spin, toon('#ff8fc4'), 0, 0, 0, 0.12, 0.34); cyl(spin, toon('#c0c6d0'), 0, 0.18, 0, 0.1, 0.03); return '#ff8fc4'; }
  if (it.k === 'pill') { box(spin, toon('#ffffff'), 0, 0, 0, 0.3, 0.18, 0.2); box(spin, toon('#ff5c8a'), 0, 0, 0.101, 0.2, 0.06, 0.01); return '#ffffff'; }
  if (it.k === 'smoke') { cyl(spin, toon('#7a9a6a'), 0, 0, 0, 0.11, 0.32); cyl(spin, toon('#3a3d46'), 0, 0.19, 0, 0.06, 0.06); return '#c8e6c9'; }
  if (it.k === 'molotov') { cyl(spin, toon('#8fd88f', { transparent: true, opacity: 0.8 }), 0, 0, 0, 0.11, 0.3); cyl(spin, toon('#8fd88f'), 0, 0.2, 0, 0.04, 0.12); box(spin, toon('#ff8a3d'), 0, 0.28, 0, 0.06, 0.08, 0.06); return '#ff8a3d'; }
  if (it.k === 'flash') { cyl(spin, toon('#3a3d46'), 0, 0, 0, 0.09, 0.3); cyl(spin, toon('#ffe48a'), 0, 0, 0, 0.095, 0.06); return '#ffe48a'; }
  if (it.k === 'flare') { box(spin, toon('#ff7a3d'), 0, 0, -0.05, 0.08, 0.12, 0.3); cyl(spin, toon('#ff7a3d'), 0, 0.02, -0.25, 0.06, 0.2, 0, Math.PI / 2); box(spin, toon('#3a3d46'), 0, -0.1, 0.05, 0.06, 0.16, 0.08); return '#ff5a3d'; }
  if (it.k === 'adren') { cyl(spin, toon('#e6f7ff', { transparent: true, opacity: 0.85 }), 0, 0, 0, 0.06, 0.36, Math.PI / 2); cyl(spin, toon('#ff5c8a'), 0.05, 0, 0, 0.065, 0.1, Math.PI / 2); return '#ff5c8a'; }
  if (it.k === 'gas') { box(spin, toon('#e8574f'), 0, 0, 0, 0.36, 0.44, 0.18); box(spin, toon('#3a3d46'), 0.1, 0.27, 0, 0.08, 0.1, 0.08); return '#ff8a3d'; }
  return null;
}
export { BOOSTS };
