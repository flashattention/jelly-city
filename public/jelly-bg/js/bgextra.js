// 젤리배그 더하기: 물(호수 · 바다) · 레드존 · 보급상자(낙하산 · 빨간 연기) · 화염병 불 · 섬광탄 · 넘기(파쿠르)
import * as THREE from 'three';
import { boxesIn, floorAt } from '../../jelly-attack/js/maps.js';

const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
let _glow = null;
function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c)); }
export const WATER_Y = 0.42; // 물 높이 (헤엄치면 눈이 물 바로 위)

// ---------- 물 ----------
export function buildWater(scene, map) {
  const g = new THREE.Group();
  for (const w of map.water || []) {
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.d), new THREE.MeshToonMaterial({ color: '#4fb3e8', transparent: true, opacity: 0.72, depthWrite: false }));
    top.rotation.x = -Math.PI / 2; top.position.set(w.x, WATER_Y, w.z); g.add(top);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.d), toon('#2f6f9a')); bed.rotation.x = -Math.PI / 2; bed.position.set(w.x, 0.03, w.z); g.add(bed);
    // 물가 모래
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(w.w + 3, w.d + 3), toon('#f1dcaa')); rim.rotation.x = -Math.PI / 2; rim.position.set(w.x, 0.02, w.z); g.add(rim);
    g.userData.tops = [...(g.userData.tops || []), top];
  }
  scene.add(g);
  return { group: g, update(t) { for (const m of g.userData.tops || []) m.material.opacity = 0.68 + Math.sin(t * 1.3) * 0.04; }, dispose() { scene.remove(g); } };
}

// ---------- 레드존 ----------
export function makeRedZone(scene) {
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.16, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; wall.visible = floor.visible = false; scene.add(wall, floor);
  return {
    set(R) { wall.visible = floor.visible = !!R; if (!R) return; wall.position.set(R.x, 30, R.z); wall.scale.set(R.r, 60, R.r); floor.position.set(R.x, 0.06, R.z); floor.scale.setScalar(R.r); },
    update(t, R, now) { if (!R) return; const on = now >= R.start; wall.material.opacity = on ? 0.22 + Math.sin(t * 8) * 0.06 : 0.1 + Math.sin(t * 4) * 0.05; },
  };
}

// ---------- 보급상자 ----------
export function makeCrate(scene, x, z) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), toon('#d8423a')); box.position.y = 0.55; g.add(box);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 0.14), toon('#ffd84d')); b.position.set(0, 0.55, s * 0.5); g.add(b); }
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.45), toon('#8a2a2a')); lid.position.y = 1.12; g.add(lid);
  // 낙하산 (줄까지 한 묶음 · 땅에 닿으면 숨긴다)
  const chute = new THREE.Group(); g.add(chute);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), toon('#ffffff', { transparent: true, opacity: 0.9, side: THREE.DoubleSide })); dome.position.y = 5.4; chute.add(dome);
  const lines = new THREE.LineBasicMaterial({ color: '#ffffff' });
  for (const [lx, lz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) chute.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(lx, 5.4, lz), new THREE.Vector3(0, 1.2, 0)]), lines));
  const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff4a3a', transparent: true, depthWrite: false })); light.scale.setScalar(3); light.position.y = 1.4; g.add(light);
  g.position.set(x, 90, z); scene.add(g);
  return { g, chute, light, smokeT: 0 };
}

// ---------- 화염병 불 ----------
export function makeFire(scene, p, r, ms) {
  const g = new THREE.Group(); g.position.copy(p);
  const base = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: '#3a1a0a', transparent: true, opacity: 0.55, depthWrite: false })); base.rotation.x = -Math.PI / 2; base.position.y = 0.04; g.add(base);
  const flames = [];
  for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: i % 3 ? '#ff8a2a' : '#ffd84d', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(Math.cos(a) * d, 0.5, Math.sin(a) * d); s.userData.ph = Math.random() * 6; g.add(s); flames.push(s); }
  const light = new THREE.PointLight('#ff7a2a', 8, r * 4, 1.5); light.position.y = 1; g.add(light);
  scene.add(g);
  return { g, flames, light, end: performance.now() + ms };
}
export function updateFire(f, t) {
  for (const s of f.flames) { const k = 0.6 + Math.sin(t * 9 + s.userData.ph) * 0.35; s.scale.set(0.9 * k + 0.4, 1.6 * k + 0.5, 1); s.position.y = 0.6 * k + 0.3; }
  f.light.intensity = 6 + Math.sin(t * 13) * 2;
}

// ---------- 넘기 (Space): 앞의 낮은 담 · 상자 · 창문 턱 ----------
//   돌려주는 값: { to: 도착 자리, up: 가장 높은 곳 } 또는 null
export function vaultTarget(map, pos, yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  for (const reach of [0.7, 1.1]) {
    const px = pos.x + fx * reach, pz = pos.z + fz * reach;
    const hit = boxesIn(map, px - 1, pz - 1, px + 1, pz + 1).filter((b) => px > b.x - b.w / 2 - 0.05 && px < b.x + b.w / 2 + 0.05 && pz > b.z - b.d / 2 - 0.05 && pz < b.z + b.d / 2 + 0.05 && b.y + b.h > pos.y + 0.5 && b.y < pos.y + 0.5);
    if (!hit.length) continue;
    const top = Math.max(...hit.map((b) => b.y + b.h));
    if (top > pos.y + 2.2) return null; // 너무 높다
    // 위에 머리가 들어갈 자리가 있어야
    const blocked = boxesIn(map, px - 1, pz - 1, px + 1, pz + 1).some((b) => px > b.x - b.w / 2 && px < b.x + b.w / 2 && pz > b.z - b.d / 2 && pz < b.z + b.d / 2 && b.y >= top - 0.01 && b.y < top + 1.6);
    if (blocked) return null;
    // 얇으면 넘어가고(반대편 땅) · 두꺼우면 위에 올라선다
    const thin = hit.every((b) => Math.min(b.w, b.d) <= 0.8);
    if (thin) { const ox = pos.x + fx * (reach + 1.1), oz = pos.z + fz * (reach + 1.1); const fl = floorAt(map, ox, oz, top + 0.3, 0.35); const clear = !boxesIn(map, ox - 1, oz - 1, ox + 1, oz + 1).some((b) => ox > b.x - b.w / 2 - 0.3 && ox < b.x + b.w / 2 + 0.3 && oz > b.z - b.d / 2 - 0.3 && oz < b.z + b.d / 2 + 0.3 && b.y < fl + 1.6 && b.y + b.h > fl + 0.1); if (clear) return { to: new THREE.Vector3(ox, fl, oz), up: top + 0.2 }; }
    return { to: new THREE.Vector3(px + fx * 0.3, top, pz + fz * 0.3), up: top + 0.15 };
  }
  return null;
}
