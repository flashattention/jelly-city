// 첫 화면(랜딩) 서울: 실제 서울 지도 대신 실제 코스를 본뜬 가벼운 임시 거리 (docs/dream-runner/랜딩-작업지시서.md D-11 · D-12)
//   다른 세계와 같은 장면 · 같은 회전 카메라(곰 둘레 반지름 약 5m)로 그린다. 누를 때마다 5곳 중 하나
//   멈춘 것은 꼭짓점 색으로 합쳐 덩어리 3개(벽 · 빛나는 것 · 바닥), 움직이는 것(전철 · 행인 · 차 · 자전거)만 따로 → 그리기 호출 약 15 ~ 25번
//   곰은 z = 0 에서 -z 쪽을 향해 달린다. 카메라가 도는 곰 둘레(|x| < 6.5, |z| < 6)에는 아무것도 두지 않는다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = new THREE.Color();
let rs = 7;
const R = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
const pick = (a) => a[Math.floor(R() * a.length)];

// 꼭짓점 색을 입힌 도형을 모아 두었다가 한 덩어리로
class Bag {
  constructor() { this.g = []; }
  add(geo, color, x, y, z, ry = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (ry) g.rotateY(ry); g.translate(x, y, z);
    C.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.g.push(g);
  }
  box(w, h, d, x, y, z, color, ry = 0) { this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry); }
  cyl(r0, r1, h, x, y, z, color, seg = 10) { this.add(new THREE.CylinderGeometry(r0, r1, h, seg), color, x, y + h / 2, z); }
  cone(r, h, x, y, z, color, seg = 8) { this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z); }
  mesh(mat) { if (!this.g.length) return null; const m = new THREE.Mesh(mergeGeometries(this.g), mat); for (const g of this.g) g.dispose(); this.g = []; return m; }
}
const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true });

const BRICK = ['#9c4a32', '#b5573a', '#86402c', '#a5503a'], CONC = ['#a9a49b', '#8f8b84', '#c2bcb1'], WHITE = ['#ece6da', '#ddd6c8'], DARK = ['#2c2c31', '#3a3a40'];
const SIGN = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f78c6b', '#ffffff', '#c77dff'];
const LIT = ['#ffe1ad', '#fff3d6', '#ffd18a'];
const JELLY = ['#ff9fb3', '#9fd3ff', '#ffe08a', '#b6f0a8', '#d7b8ff', '#ffbf8f'];

// 공통: 건물 한 채 (1층 유리창 · 간판 · 위층 창)
function shop(wall, glow, s, x, zc, w, d, fl, col, o = {}) {
  const h = fl * (o.fh || 3.6), fx = x - s * (d / 2 + 0.03);
  wall.box(d, h, w, x, 0, zc, col);
  wall.box(d + 0.3, 0.5, w + 0.3, x, h, zc, o.roof || '#77736c');
  glow.box(0.1, 2.5, w * 0.78, fx, 0.35, zc, R() < 0.5 ? '#ffd9a0' : '#ffe9c4');
  if (o.awning !== false && R() < 0.6) wall.box(1.3, 0.12, w * 0.7, fx - s * 0.6, 3.0, zc, pick(['#1f3b2d', '#3a2b25', '#ece6da', '#8a2b2b']));
  glow.box(0.14, 0.7, Math.min(4.5, w * 0.5), fx - s * 0.05, 3.35, zc + (R() - 0.5) * 2, pick(SIGN));
  const fh = o.fh || 3.6, lit = o.lit ?? 0.45;
  for (let f = 1; f < fl; f++) for (let wz = -w / 2 + 1.4; wz < w / 2 - 1; wz += 2.4) { const on = R() < lit; (on ? glow : wall).box(0.08, fh * 0.42, 1.4, fx, f * fh + fh * 0.25, zc + wz + 0.6, on ? pick(LIT) : o.dark || '#2b3440'); }
  return { h, fx };
}
// 공통: 줄지어 선 건물 (양쪽)
function rowOfShops(wall, glow, L0, L1, o) {
  for (const s of [-1, 1]) {
    let z = L0;
    while (z > L1) {
      const w = o.w0 + R() * o.w1, d = 10 + R() * 8, fl = o.f0 + Math.floor(R() * o.f1), x = s * (o.x0 + d / 2), zc = z - w / 2;
      if (o.skip?.(zc)) { z -= w; continue; }
      const sh = shop(wall, glow, s, x, zc, w, d, fl, o.col(), o);
      o.each?.(s, x, zc, w, d, sh);
      z -= w + 0.15;
    }
  }
}
// 공통: 스카이라인 (서울다운 아파트 · 빌딩)
function skyline(wall, glow, n, xmin, xspan, z0, zspan, hmin, hspan, cols = ['#a8adb8', '#9aa0ad', '#b9bcc4', '#8e95a3'], sides = [-1, 1]) {
  for (let i = 0; i < n; i++) {
    const s = pick(sides), x = s * (xmin + R() * xspan), z = z0 - R() * zspan, w = 10 + R() * 14, h = hmin + R() * hspan, d = 9 + R() * 6;
    wall.box(w, h, d, x, 0, z, pick(cols));
    for (let f = 2; f < h - 2; f += 3) if (R() < 0.3) glow.box(w * 0.86, 0.5, 0.1, x, f, z + d / 2 + 0.05, '#ffe6b8');
  }
}
// 공통: 젤리 행인 · 차 · 자전거
function jelly(col) { const b = new Bag(); b.add(new THREE.CapsuleGeometry(0.32, 0.55, 4, 8), col, 0, 0.62, 0); b.add(new THREE.SphereGeometry(0.3, 10, 8), col, 0, 1.38, 0); b.add(new THREE.SphereGeometry(0.11, 6, 5), col, -0.2, 1.62, 0); b.add(new THREE.SphereGeometry(0.11, 6, 5), col, 0.2, 1.62, 0); return b.mesh(lambert()); }
function car(col) { const b = new Bag(); b.box(1.8, 0.75, 4.2, 0, 0.3, 0, col); b.box(1.6, 0.6, 2.2, 0, 1.05, -0.2, '#2b3440'); for (const wx of [-0.85, 0.85]) for (const wz of [-1.3, 1.3]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10); w.rotateZ(Math.PI / 2); b.add(w, '#1d1d20', wx, 0.34, wz); } return b.mesh(lambert()); }
function bike(col) { const b = new Bag(); for (const wz of [-0.55, 0.55]) { const w = new THREE.TorusGeometry(0.34, 0.05, 6, 14); w.rotateY(Math.PI / 2); b.add(w, '#1d1d20', 0, 0.36, wz); } b.box(0.06, 0.06, 1.1, 0, 0.62, 0, col); b.add(new THREE.CapsuleGeometry(0.26, 0.45, 4, 8), JELLY[Math.floor(R() * JELLY.length)], 0, 1.15, 0.05); b.add(new THREE.SphereGeometry(0.25, 10, 8), '#ffe08a', 0, 1.75, 0.05); return b.mesh(lambert()); }

function finish(root, wall, glow, floor) { for (const [b, m] of [[floor, lambert()], [wall, lambert()], [glow, new THREE.MeshBasicMaterial({ vertexColors: true })]]) { const mesh = b.mesh(m); if (mesh) root.add(mesh); else m.dispose(); } }
// 움직이는 것들: 길이 방향(z)으로 오간다, 끝에 닿으면 반대편 끝에서 다시
function walkers(root, list, n, xs, z0, z1, make, speed) { for (let i = 0; i < n; i++) { const m = make(), x = pick(xs) + (R() - 0.5) * 1.2; m.position.set(x, 0, z0 - R() * (z0 - z1)); const v = (R() < 0.5 ? 1 : -1) * speed * (0.8 + R() * 0.4); m.rotation.y = v > 0 ? 0 : Math.PI; m.userData = { v, ph: R() * 6, z0, z1, bob: speed < 3 }; root.add(m); list.push(m); } }
function lanes(root, list, n, lanesX, z0, z1, make) { for (let i = 0; i < n; i++) { const lx = lanesX[i % lanesX.length], m = make(); m.position.set(lx, 0, z0 - (i / n) * (z0 - z1)); const v = lx > 0 ? 9 : -8; m.rotation.y = v > 0 ? Math.PI : 0; m.userData = { v, z0, z1 }; root.add(m); list.push(m); } }

// ---------------- 코스 ----------------
const COURSES = {
  // 성수 카페거리: 붉은 벽돌 공장을 고친 카페 · 톱니 지붕 창고 · 굴뚝 · 2호선 고가 · 은행나무
  seongsu(root, wall, glow, floor, mov) {
    const L0 = 60, L1 = -230, VZ = -70;
    floor.box(9, 0.02, L0 - L1, 0, -0.02, (L0 + L1) / 2, '#3b3d43');
    for (const s of [-1, 1]) { floor.box(4, 0.12, L0 - L1, s * 6.5, -0.02, (L0 + L1) / 2, '#b9aea0'); floor.box(0.25, 0.16, L0 - L1, s * 4.55, -0.02, (L0 + L1) / 2, '#d8d2c6'); }
    for (let z = L0; z > L1; z -= 6) floor.box(0.18, 0.03, 3, 0, 0, z, '#f2efe6');
    for (const zc of [-24, -128]) for (let x = -4; x <= 4; x += 1.1) floor.box(0.6, 0.03, 3.2, x, 0, zc, '#f4f1ea');
    floor.box(400, 0.01, 400, 0, -0.06, -80, '#6b6660');
    rowOfShops(wall, glow, L0, L1, { x0: 8.6, w0: 7, w1: 9, f0: 2, f1: 3, skip: (zc) => Math.abs(zc - VZ) < 8, col: () => { const k = R(); return k < 0.5 ? pick(BRICK) : k < 0.75 ? pick(CONC) : k < 0.9 ? pick(WHITE) : pick(DARK); },
      each: (s, x, zc, w, d) => { if (R() < 0.12 && w > 11) { const teeth = Math.max(2, Math.floor(w / 3.6)); for (let i = 0; i < teeth; i++) { const zz = zc - w / 2 + (i + 0.5) * (w / teeth), tri = new THREE.CylinderGeometry(1.8, 1.8, d, 3); tri.rotateZ(Math.PI / 2); wall.add(tri, '#5b5f66', x, 9.4, zz); } } } });
    wall.cyl(1.1, 1.6, 26, -24, 0, -96, '#8e3f2b'); wall.cyl(1.3, 1.3, 1, -24, 26, -96, '#5e2a1d');
    wall.box(160, 1.6, 9, 0, 8.6, VZ, '#b8b3aa'); for (const dz of [-4.3, 4.3]) wall.box(160, 0.9, 0.4, 0, 10.2, VZ + dz, '#9f9a91');
    for (const px of [-44, -24, 24, 44]) wall.box(2, 8.6, 2.6, px, 0, VZ, '#a6a199');
    glow.box(4, 0.8, 0.3, 0, 7.4, VZ + 4.6, '#00a84d');
    for (const s of [-1, 1]) for (let z = L0 - 4; z > L1; z -= 9) { if (Math.abs(z - VZ) < 6) continue; const x = s * 7.1, h = 3.2 + R() * 1.2; wall.cyl(0.13, 0.18, h, x, 0, z, '#4a3626', 5); wall.cone(1.0 + R() * 0.25, 3.6, x, h - 0.4, z, pick(['#f2c230', '#e8b21f', '#f5d04a', '#d9a51a']), 7); }
    skyline(wall, glow, 46, 40, 70, 40, 300, 18, 40);
    // 2호선 전철
    const tr = new Bag(); for (let i = 0; i < 4; i++) { const x = i * 10.4; tr.box(10, 2.6, 2.8, x, 0, 0, '#d9dde2'); tr.box(10.02, 0.45, 2.82, x, 0.9, 0, '#00a84d'); for (let k = -3; k <= 3; k++) tr.box(0.9, 0.8, 2.84, x + k * 1.35, 1.5, 0, '#3a4652'); }
    const train = tr.mesh(lambert()); train.position.set(-90, 10.4, VZ + 2); train.userData = { slide: 14, x0: -130, x1: 90 }; root.add(train); mov.push(train);
    walkers(root, mov, 9, [-6.5, 6.5], 40, -180, () => jelly(pick(JELLY)), 1.2);
    lanes(root, mov, 3, [-2.4, 2.4], 60, -230, () => car(pick(['#f4f4f2', '#2b2f36', '#c0392b', '#dfe4ea', '#1e5aa8'])));
  },
  // 명동: 차 없는 길 · 빽빽한 세로 간판 · 노점 줄 · 끝에 명동성당
  myeongdong(root, wall, glow, floor, mov) {
    const L0 = 50, L1 = -200;
    floor.box(16, 0.02, L0 - L1, 0, -0.02, (L0 + L1) / 2, '#c9c1b4');
    for (let z = L0; z > L1; z -= 2.4) floor.box(16, 0.025, 0.08, 0, 0, z, '#b3ab9e');
    floor.box(400, 0.01, 400, 0, -0.06, -80, '#77716a');
    rowOfShops(wall, glow, L0, L1, { x0: 8.2, w0: 6, w1: 7, f0: 4, f1: 5, fh: 3.4, lit: 0.6, awning: false, col: () => pick(['#d8d3cb', '#bfb9b0', '#e9e4dc', '#8f99a8', '#c9b9a5', '#3d4250']),
      each: (s, x, zc, w, d, sh) => { const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) glow.box(0.6, 3 + R() * 4, 0.9, sh.fx - s * 0.4, 4 + R() * (sh.h - 8), zc + (R() - 0.5) * (w - 1.5), pick(SIGN)); if (R() < 0.35) glow.box(0.12, 3.2, w * 0.8, sh.fx - s * 0.05, sh.h - 4, zc, pick(['#ff4d6d', '#4cc9f0', '#ffd166', '#ffffff'])); } });
    // 노점 줄 (가운데 양옆, 곰 둘레 비우고)
    for (const s of [-1, 1]) for (let z = -10; z > L1 + 10; z -= 5.5) { const x = s * 6.6; wall.box(1.6, 0.95, 2.2, x, 0, z, '#9aa3ad'); wall.box(2.2, 0.08, 2.8, x, 2.2, z, pick(['#ff7b54', '#ffb26b', '#e63946', '#2a9d8f'])); for (const dx of [-0.9, 0.9]) wall.box(0.06, 2.2, 0.06, x + dx, 0, z - 1.3, '#555'); glow.box(1.4, 0.15, 1.9, x, 1.0, z, '#ffd27a'); }
    // 명동성당: 붉은 벽돌 고딕 + 첨탑 (길 끝 언덕)
    const cz = L1 - 20; wall.box(16, 14, 34, 0, 3, cz - 10, '#8f4a34'); wall.box(9, 22, 9, 0, 3, cz + 8, '#9a5038'); wall.cone(4.2, 22, 0, 25, cz + 8, '#4f5a60', 4); glow.box(2, 4, 0.2, 0, 13, cz + 12.6, '#ffe7b0'); wall.box(40, 3, 50, 0, 0, cz, '#7a7268');
    skyline(wall, glow, 40, 30, 60, 30, 260, 30, 50, ['#9aa0ad', '#b9bcc4', '#7e8796', '#c4c7ce']);
    walkers(root, mov, 16, [-4, -2, 2, 4], 40, -180, () => jelly(pick(JELLY)), 1.2);
  },
  // 광화문 광장: 넓은 돌 광장 · 세종대왕 동상 · 광화문 · 북악산 · 양옆 찻길과 유리 빌딩
  gwanghwamun(root, wall, glow, floor, mov) {
    const L0 = 60, L1 = -260;
    floor.box(30, 0.02, L0 - L1, 0, -0.02, (L0 + L1) / 2, '#d6d1c7');
    for (let z = L0; z > L1; z -= 4) floor.box(30, 0.025, 0.1, 0, 0, z, '#c4beb2');
    for (const s of [-1, 1]) { floor.box(16, 0.02, L0 - L1, s * 23, -0.02, (L0 + L1) / 2, '#3b3d43'); for (let z = L0; z > L1; z -= 6) floor.box(0.18, 0.03, 3, s * 23, 0, z, '#f2efe6'); floor.box(1.2, 0.3, L0 - L1, s * 9, -0.02, (L0 + L1) / 2, '#6b9a4a'); }
    floor.box(500, 0.01, 500, 0, -0.06, -100, '#6d6a64');
    for (const s of [-1, 1]) for (let z = L0 - 6; z > L1; z -= 6) { if (Math.abs(z) < 8) continue; glow.box(1, 0.2, 2.4, s * 9, 0.32, z, pick(['#ff6b8a', '#ffd166', '#c77dff', '#ff9f43'])); }
    // 세종대왕 동상 (금빛) · 이순신 장군 동상 자리
    wall.box(6, 3, 8, 0, 0, -60, '#9b9488'); wall.box(3, 2, 3, 0, 3, -60, '#8a8378'); wall.add(new THREE.SphereGeometry(1.5, 12, 10), '#c9a24a', 0, 6.4, -60); wall.box(2.6, 1.2, 2, 0, 5, -60, '#c9a24a');
    wall.box(2.4, 8, 2.4, 0, 0, 12, '#9b9488'); wall.cyl(0.6, 0.8, 3.4, 0, 8, 12, '#4a5a4a');
    // 광화문: 돌 축대 + 문 셋 + 2층 기와지붕 · 뒤로 북악산
    const gz = L1 + 20; wall.box(36, 9, 12, 0, 0, gz, '#b9b0a0'); for (const dx of [-8, 0, 8]) glow.box(4, 5, 0.3, dx, 0, gz + 6.1, '#3a2b20');
    wall.box(30, 5, 9, 0, 9, gz, '#a8392c'); wall.box(40, 1.4, 14, 0, 14, gz, '#3e4a50'); wall.box(24, 4, 7, 0, 15.4, gz, '#a8392c'); wall.box(32, 1.4, 11, 0, 19.4, gz, '#3e4a50');
    wall.add(new THREE.ConeGeometry(120, 90, 7), '#4f6b3f', 10, 45, gz - 160); wall.add(new THREE.ConeGeometry(90, 60, 7), '#5c7a48', -110, 30, gz - 120);
    // 양옆 유리 빌딩
    for (const s of [-1, 1]) for (let z = L0; z > L1 + 40; z -= 26) { const h = 30 + R() * 50, w = 22, x = s * (44 + R() * 8); wall.box(18, h, w, x, 0, z, pick(['#7f93a8', '#94a3b5', '#5f7186', '#b3bcc6'])); for (let f = 3; f < h; f += 3.5) if (R() < 0.45) glow.box(0.1, 1.3, w * 0.9, x - s * 9.05, f, z, '#fff0cf'); }
    skyline(wall, glow, 30, 70, 80, 40, 260, 25, 50);
    walkers(root, mov, 10, [-6.5, -3, 3, 6.5], 40, -200, () => jelly(pick(JELLY)), 1.1);
    lanes(root, mov, 6, [-26, -20, 20, 26], 60, -260, () => car(pick(['#f4f4f2', '#2b2f36', '#dfe4ea', '#1e5aa8', '#ffcc00'])));
  },
  // 반포 한강공원: 자전거길 · 잔디 · 한강 · 반포대교 무지개 분수 · 건너편 남산타워
  hangang(root, wall, glow, floor, mov) {
    const L0 = 60, L1 = -260, RX = 12;
    floor.box(6, 0.02, L0 - L1, 0, -0.02, (L0 + L1) / 2, '#6a4d3e'); // 자전거길 (적갈색)
    for (let z = L0; z > L1; z -= 5) floor.box(0.15, 0.03, 2.4, 0, 0, z, '#f3e9c9');
    floor.box(3, 0.02, L0 - L1, -5, -0.02, (L0 + L1) / 2, '#cfc6b7'); // 산책길
    floor.box(300, 0.01, L0 - L1, -156, -0.04, (L0 + L1) / 2, '#6f9a52'); // 잔디
    floor.box(4, 0.02, L0 - L1, 5.5, -0.02, (L0 + L1) / 2, '#7da35c');
    floor.box(2.5, 0.4, L0 - L1, RX - 3.2, -0.3, (L0 + L1) / 2, '#a59d8e'); // 강가 돌
    const water = new Bag(); water.box(700, 0.02, 700, RX + 350, -0.25, -100, '#2d5f86'); const wm = water.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#0b2236' })); root.add(wm);
    // 잔디 위 나무 · 텐트 · 편의점
    for (let i = 0; i < 40; i++) { const x = -9 - R() * 40, z = L0 - R() * (L0 - L1); if (Math.abs(z) < 8 && x > -12) continue; if (R() < 0.7) { wall.cyl(0.18, 0.24, 2.6, x, 0, z, '#5a4030', 5); wall.add(new THREE.SphereGeometry(1.8, 8, 6), pick(['#6a9a3e', '#c9922e', '#d6762a', '#8aa33c']), x, 3.8, z); } else { wall.cone(1.4, 1.6, x, 0, z, pick(['#ff9f43', '#48dbfb', '#feca57', '#ff6b6b']), 4); } }
    wall.box(8, 3.4, 5, -16, 0, -40, '#e8e4dc'); glow.box(7, 0.8, 0.2, -16, 2.6, -37.4, '#3fa34d'); glow.box(6, 1.6, 0.15, -16, 0.6, -37.45, '#fff2c4');
    for (let z = L0 - 8; z > L1; z -= 16) { if (Math.abs(z) < 8) continue; wall.box(0.12, 4.4, 0.12, 7.6, 0, z, '#3c4048'); glow.box(0.5, 0.25, 0.5, 7.6, 4.4, z, '#fff1c8'); }
    // 반포대교: 강을 가로질러 (x 방향) · 아래 잠수교 · 무지개 분수
    const BZ = -90; wall.box(420, 2.2, 26, RX + 200, 9, BZ, '#c9c4ba'); wall.box(420, 1, 14, RX + 200, 1.2, BZ, '#b3ada2');
    for (let x = RX + 10; x < RX + 420; x += 28) wall.box(3, 9, 6, x, 0, BZ, '#a8a297');
    const RB = ['#ff3b5c', '#ff8a3d', '#ffd23f', '#3ddc84', '#2fb8ff', '#6c63ff', '#c77dff'];
    for (let x = RX + 6, i = 0; x < RX + 400; x += 3.2, i++) glow.box(0.8, 5.5, 0.6, x, 2.4, BZ + 13.4, RB[i % 7]);
    // 건너편: 남산 · N서울타워 · 용산 빌딩
    wall.add(new THREE.ConeGeometry(70, 50, 7), '#4e6b45', RX + 330, 25, -40); wall.cyl(1.4, 2, 26, RX + 330, 50, -40, '#e9e6e0', 8); wall.cyl(5, 5, 4, RX + 330, 70, -40, '#d8d3ca', 12); glow.cyl(0.4, 0.4, 14, RX + 330, 74, -40, '#ff5a5a', 6);
    skyline(wall, glow, 34, 260, 120, 60, 320, 20, 50, undefined, [1]);
    walkers(root, mov, 6, [-5, 5.5], 40, -200, () => jelly(pick(JELLY)), 1.1);
    walkers(root, mov, 5, [-1.4, 1.4], 50, -220, () => bike(pick(['#e63946', '#2a9d8f', '#f4a261', '#264653'])), 5);
  },
  // 석촌호수: 호숫가 길 · 롯데월드타워 · 호수 위 매직아일랜드 성 · 단풍
  jamsil(root, wall, glow, floor, mov) {
    const L0 = 60, L1 = -240, LX = 8;
    floor.box(7, 0.02, L0 - L1, 0, -0.02, (L0 + L1) / 2, '#cbb9a2');
    for (let z = L0; z > L1; z -= 3) floor.box(7, 0.025, 0.06, 0, 0, z, '#b8a68f');
    floor.box(1, 0.6, L0 - L1, LX - 3.2, 0, (L0 + L1) / 2, '#8f877b'); // 난간 돌
    floor.box(200, 0.01, L0 - L1, -104, -0.04, (L0 + L1) / 2, '#6a8a4a');
    const water = new Bag(); water.box(240, 0.02, 400, LX + 120, -0.2, -90, '#3b6f8f'); root.add(water.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#0e2a3a' })));
    for (let z = L0 - 2; z > L1; z -= 7) { if (Math.abs(z) < 8) continue; wall.box(0.08, 1, 0.08, LX - 3.2, 0.6, z, '#444'); }
    // 호숫가 단풍 · 벚나무 줄
    for (const x of [-6.8, -12]) for (let z = L0; z > L1; z -= 8) { if (Math.abs(z) < 8 && x > -8) continue; wall.cyl(0.16, 0.22, 2.8, x, 0, z, '#4a3626', 5); wall.add(new THREE.SphereGeometry(1.7, 8, 6), pick(['#d9472b', '#e8742a', '#f2b134', '#c23b22', '#e9a3b8']), x, 3.9, z + (R() - 0.5) * 2); }
    // 매직아일랜드 성 (호수 위 흰 성 · 파란 고깔)
    const MX = LX + 70, MZ = -110; wall.box(30, 2, 30, MX, 0, MZ, '#8f877b');
    for (const [dx, dz, h] of [[0, 0, 26], [-8, 6, 16], [8, 6, 16], [-6, -7, 13], [7, -7, 13]]) { wall.cyl(2.4, 2.6, h, MX + dx, 2, MZ + dz, '#f2efe8', 10); wall.cone(3.2, 7, MX + dx, 2 + h, MZ + dz, '#3f6fd8', 10); glow.box(0.6, 1.2, 0.3, MX + dx, 2 + h * 0.6, MZ + dz + 2.5, '#ffe9b0'); }
    // 롯데월드타워: 끝이 가늘어지는 하얀 탑 (멀리 크게)
    const TX = 60, TZ = -330; for (let i = 0; i < 12; i++) { const h = 16, r0 = 18 - i * 1.25, r1 = 18 - (i + 1) * 1.25; wall.cyl(Math.max(0.5, r1), Math.max(0.8, r0), h, TX, i * h, TZ, i % 2 ? '#dfe6ec' : '#cfd8df', 8); if (i % 2 === 0) glow.cyl(Math.max(0.6, r1) + 0.05, Math.max(0.9, r0) + 0.05, 0.6, TX, i * h + 8, TZ, '#fff3d6', 8); }
    glow.cyl(0.3, 0.3, 8, TX, 192, TZ, '#ff5a5a', 6);
    skyline(wall, glow, 44, 30, 120, 20, 340, 20, 45);
    walkers(root, mov, 11, [-2.4, 0, 2.4], 40, -200, () => jelly(pick(JELLY)), 1.1);
  },
};
export const SEOUL_TITLE_NAMES = { seongsu: '성수 카페거리', myeongdong: '명동', gwanghwamun: '광화문 광장', hangang: '반포 한강공원', jamsil: '석촌호수 · 롯데월드타워' };

export function makeSeoulTitle(kind) {
  const keys = Object.keys(COURSES); kind = COURSES[kind] ? kind : keys[Math.floor(Math.random() * keys.length)];
  rs = 7 + keys.indexOf(kind) * 101;
  const root = new THREE.Group(), wall = new Bag(), glow = new Bag(), floor = new Bag(), mov = [];
  COURSES[kind](root, wall, glow, floor, mov);
  finish(root, wall, glow, floor);
  return {
    root, kind, name: SEOUL_TITLE_NAMES[kind],
    update(dt, t) {
      for (const m of mov) {
        const u = m.userData;
        if (u.slide) { m.position.x += dt * u.slide; if (m.position.x > u.x1) m.position.x = u.x0; continue; }
        m.position.z += u.v * dt; if (m.position.z > u.z0) m.position.z = u.z1; if (m.position.z < u.z1) m.position.z = u.z0;
        if (u.bob) m.position.y = Math.abs(Math.sin(t * 7 + u.ph)) * 0.08;
        // 카메라가 도는 곰 둘레를 지날 때는 숨긴다 (곰을 뚫고 지나가거나 화면을 가리지 않게)
        m.visible = !(Math.abs(m.position.z) < 9 && Math.abs(m.position.x) < 6.6);
      }
    },
    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  };
}
