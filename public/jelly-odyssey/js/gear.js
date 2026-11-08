// 젤리 오디세이: 곰돌 군단 로마 병사 장비 (투구 · 판갑 · 붉은 튜닉 · 가죽 띠 · 망토 · 큰 사각 방패) + 무기
//   곰돌이 모델(shared/js/roach.js)에 덧입힌다. 곰돌이는 +z 를 본다
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';

const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
const std = (c, rough = 0.35, metal = 0.85, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, envMapIntensity: 7, ...o });
const SPH = new THREE.SphereGeometry(1, 20, 14), BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
function part(p, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); p.add(o); return o; }

// 재질은 한 번만 (곰돌이 여럿이 같이 쓴다)
const M = {
  steel: std('#c3c8cf', 0.28, 0.9), steelDark: std('#7d848c', 0.4, 0.85), bronze: std('#c8913f', 0.32, 0.9), gold: std('#e8b84a', 0.25, 1),
  red: toon('#b3202a'), redDark: toon('#7e1219'), leather: toon('#6b4226'), plume: toon('#d42a33'), plumeC: toon('#f2e6c8'),
};
// 방패 앞면 그림: 붉은 바탕 · 금 테두리 · 가운데 GPU 칩 문양 + 번개 날개 (군단 문장)
let shieldTex = null;
function shieldFace() {
  if (shieldTex) return shieldTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#7e1219'); gr.addColorStop(0.5, '#c42a32'); gr.addColorStop(1, '#7e1219');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#f0c35a'; g.lineWidth = 12; g.strokeRect(10, 10, 236, 300); g.lineWidth = 3; g.strokeRect(26, 26, 204, 268);
  // 칩: 금 사각 + 다리
  g.fillStyle = '#f0c35a'; g.fillRect(98, 130, 60, 60); g.fillStyle = '#7e1219'; g.fillRect(110, 142, 36, 36); g.fillStyle = '#ffe9a8'; g.fillRect(120, 152, 16, 16);
  for (let i = 0; i < 5; i++) { g.fillStyle = '#f0c35a'; g.fillRect(104 + i * 11, 118, 5, 12); g.fillRect(104 + i * 11, 190, 5, 12); g.fillRect(86, 136 + i * 11, 12, 5); g.fillRect(158, 136 + i * 11, 12, 5); }
  // 번개 날개
  g.strokeStyle = '#f0c35a'; g.lineWidth = 7; g.lineJoin = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 40, 160); g.lineTo(128 + s * 70, 135); g.lineTo(128 + s * 62, 158); g.lineTo(128 + s * 100, 128); g.stroke(); g.beginPath(); g.moveTo(128 + s * 40, 165); g.lineTo(128 + s * 75, 190); g.lineTo(128 + s * 66, 172); g.lineTo(128 + s * 104, 200); g.stroke(); }
  // 금 리벳 · 낡은 흠집
  g.fillStyle = '#ffe2a0'; for (const [x, y] of [[40, 40], [216, 40], [40, 280], [216, 280], [128, 40], [128, 280]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const x = Math.random() * 256, y = Math.random() * 320; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 30 - 15, y + Math.random() * 20); g.stroke(); }
  shieldTex = new THREE.CanvasTexture(c); shieldTex.colorSpace = THREE.SRGBColorSpace; return shieldTex;
}
// 휜 사각 방패(스쿠툼): 원통의 한 조각
function scutum() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.25, 16, 1, true, -0.42, 0.84), new THREE.MeshStandardMaterial({ map: shieldFace(), roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide }));
  face.position.z = -1.15; g.add(face);
  // 금 테두리 (위 · 아래 · 양옆) · 가운데 볼록한 금속 혹(움보)
  for (const y of [-0.62, 0.62]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.035, 6, 20, 0.84), M.gold); rim.rotation.set(Math.PI / 2, 0, -0.42 + Math.PI / 2); rim.position.set(0, y, -1.15); g.add(rim); }
  for (const a of [-0.42, 0.42]) part(g, BOX, M.gold, Math.sin(a) * 1.16, 0, Math.cos(a) * 1.16 - 1.15, 0.05, 1.27, 0.05);
  part(g, SPH, M.bronze, 0, 0, 0.02, 0.17, 0.17, 0.09);
  g.scale.setScalar(0.62);
  return g;
}
// 투구(갈레아): 금속 돔 · 이마띠 · 볼가리개 · 목가리개 · 붉은 깃털 (백인대장은 가로)
function helmet(head, centurion) {
  const g = new THREE.Group(); head.add(g);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.575, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), M.steel); dome.scale.set(1, 0.92, 1); dome.position.y = 0.14; g.add(dome);
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.565, 0.045, 6, 28), M.bronze); brow.rotation.x = Math.PI / 2; brow.position.y = 0.16; g.add(brow);
  for (const s of [-1, 1]) { const ch = part(g, BOX, M.steel, s * 0.5, -0.18, 0.16, 0.05, 0.36, 0.26, 0, s * 0.35, s * 0.12); ch.material = M.steel; part(g, SPH, M.bronze, s * 0.53, -0.1, 0.2, 0.035, 0.035, 0.035); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 0.22, 18, 1, true, Math.PI * 0.6, Math.PI * 0.8), M.steel); neck.position.set(0, -0.12, -0.04); neck.material.side = THREE.DoubleSide; g.add(neck);
  // 깃털: 반원 고리 + 솔
  const crest = new THREE.Group(); crest.position.y = 0.6; crest.scale.setScalar(1.25); g.add(crest);
  part(crest, BOX, M.bronze, 0, -0.02, 0, 0.08, 0.06, 0.5);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 8, 22, Math.PI), M.plume); arc.rotation.y = Math.PI / 2; arc.scale.set(1, 0.85, 0.55); crest.add(arc);
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI, b = part(crest, BOX, i % 2 ? M.plume : M.redDark, 0, Math.sin(a) * 0.34, Math.cos(a) * 0.34, 0.07, 0.22, 0.05); b.rotation.x = -a + Math.PI / 2; }
  if (centurion) { crest.rotation.y = Math.PI / 2; crest.scale.setScalar(1.25); for (const m of crest.children) if (m.material === M.plume) m.material = M.plumeC; }
  return g;
}
// 판갑(로리카 세그멘타타): 몸통 둘레 쇠띠 · 어깨 판 · 가죽 끈 · 금 리벳 · 허리띠 + 붉은 튜닉 치마 · 가죽 띠(프테루게스)
function armor(torso) {
  const g = new THREE.Group(); torso.add(g);
  const ry = (y) => Math.sqrt(Math.max(0.05, 1 - ((y - 1.02) / 0.66) ** 2));
  for (const [i, y] of [0.94, 1.06, 1.18, 1.3, 1.42].entries()) { const k = ry(y), b = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.115, 26, 1, true), i % 2 ? M.steel : M.steelDark); b.scale.set(0.585 * k, 1, 0.5 * k); b.position.y = y; b.material.side = THREE.DoubleSide; g.add(b); }
  for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.steel); sh.scale.set(0.26, 0.15, 0.3); sh.position.set(s * 0.42, 1.42, 0.02); sh.rotation.z = -s * 0.5; g.add(sh); part(g, SPH, M.bronze, s * 0.43, 1.5, 0.12, 0.03, 0.03, 0.03); }
  for (const s of [-1, 1]) part(g, BOX, M.leather, s * 0.2, 1.3, 0.43, 0.06, 0.42, 0.04, -0.15, 0, s * 0.15);
  for (const x of [-0.12, 0.12]) part(g, SPH, M.gold, x, 1.32, 0.47, 0.035, 0.035, 0.03);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.09, 26, 1, true), M.leather); belt.scale.set(0.52, 1, 0.45); belt.position.y = 0.84; belt.material.side = THREE.DoubleSide; g.add(belt);
  part(g, BOX, M.gold, 0, 0.84, 0.45, 0.14, 0.1, 0.03);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 24, 1, true), M.red); skirt.scale.set(1, 1, 0.88); skirt.position.y = 0.66; skirt.material.side = THREE.DoubleSide; g.add(skirt);
  for (let i = 0; i < 9; i++) { const a = -Math.PI * 0.55 + (i / 8) * Math.PI * 1.1, x = Math.sin(a) * 0.52, z = Math.cos(a) * 0.46; part(g, BOX, M.leather, x, 0.62, z, 0.075, 0.3, 0.025, 0, a, 0); part(g, BOX, M.gold, x * 1.01, 0.47, z * 1.01, 0.08, 0.035, 0.03, 0, a, 0); }
  return g;
}
// 망토: 등 뒤로 늘어진 붉은 천 (달리면 펄럭)
function cape(torso) {
  const geo = new THREE.PlaneGeometry(0.95, 1.2, 6, 8), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * 0.35 * (0.6 + (0.6 - y) * 0.5)); }
  geo.translate(0, -0.6, 0); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#a8141e', side: THREE.DoubleSide }));
  const pivot = new THREE.Group(); pivot.position.set(0, 1.5, -0.4); pivot.add(m); pivot.rotation.x = 0.12; torso.add(pivot);
  for (const s of [-1, 1]) part(torso, SPH, M.gold, s * 0.36, 1.5, -0.3, 0.06, 0.06, 0.04);
  return pivot;
}

// 로마 병사 곰돌이 만들기
//   o = { color, look, name, accessories, centurion, own } · own: 내 캐릭터(색 · 얼굴 그대로)
export function romanBear(o = {}) {
  const bear = new Roach({ own: true, seed: o.name || 'legion', color: o.color || '#8a5634', age: 25, look: { ...(o.look || {}), hat: 0, face: 0, outfit: 0, extra: 0 }, accessories: o.accessories || [] });
  bear.helmet = helmet(bear.head, o.centurion);
  bear.armor = armor(bear.torso);
  bear.cape = cape(bear.torso);
  // 방패는 몸통에 단다 (평소엔 왼쪽 앞에 비스듬히, 막을 때는 정면으로)
  const sh = scutum(); bear.torso.add(sh); bear.shield = sh;
  bear.shieldK = 0; bear.root.scale.setScalar(0.85);
  setWeapon(bear, 'sword');
  return bear;
}
export function setWeapon(bear, w) {
  bear.weapon = w;
  bear.setHeld(w === 'sword' ? 'sword:#dfe3e8' : w === 'spear' ? 'spear:#cfd4da' : w === 'bow' ? 'bow:#7a4a2a' : null);
  if (bear.shield) bear.shield.visible = w !== 'bow';
}
// 매 프레임 (곰돌이 update 다음): 방패 자세 · 망토 펄럭 · 막기 팔
export function poseGear(bear, dt, { block = false, speed = 0, t = 0 } = {}) {
  bear.shieldK += ((block ? 1 : 0) - bear.shieldK) * Math.min(1, dt * 14);
  const k = bear.shieldK, sh = bear.shield;
  if (sh && sh.visible) {
    sh.position.set(0.62 - k * 0.5, 1.02 + k * 0.12, 0.28 + k * 0.42);
    sh.rotation.set(0, 0.95 - k * 0.95, 0);
    bear.arms[0].rotation.x = -0.5 - k * 1.0; bear.arms[0].rotation.z = Math.sign(bear.arms[0].userData.baseZ || -1) * (0.35 - k * 0.2);
  }
  if (bear.cape) bear.cape.rotation.x = 0.12 + Math.min(0.9, speed * 0.09) + Math.sin(t * 7 + bear.root.id) * 0.04 * (0.3 + speed * 0.1);
}
