// 첫 화면(랜딩) 서울: 실제 서울 지도 대신 성수 카페거리를 본뜬 가벼운 임시 거리 (docs/dream-runner/랜딩-작업지시서.md D-11)
//   다른 세계와 같은 장면 · 같은 회전 카메라로 그린다. 멈춘 것은 꼭짓점 색으로 합쳐 덩어리 3개(벽 · 빛나는 창 · 바닥),
//   움직이는 것(2호선 전철 · 행인 · 차)만 따로 → 그리기 호출 약 15번
//   성수동: 붉은 벽돌 공장을 고친 카페, 톱니 지붕 창고, 벽돌 굴뚝, 길을 가로지르는 2호선 고가(초록 전철), 은행나무 가로수
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = new THREE.Color();
let rs = 7;
const R = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; }; // 늘 같은 거리 (씨앗 고정)
const pick = (a) => a[Math.floor(R() * a.length)];

// 꼭짓점 색을 입힌 도형을 모아 두었다가 한 덩어리로
class Bag {
  constructor() { this.g = []; }
  add(geo, color, x, y, z, ry = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.rotateY(ry); g.translate(x, y, z);
    C.set(color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.g.push(g);
  }
  box(w, h, d, x, y, z, color, ry = 0) { this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry); }
  mesh(mat) { const m = new THREE.Mesh(mergeGeometries(this.g), mat); for (const g of this.g) g.dispose(); this.g = []; return m; }
}

const BRICK = ['#9c4a32', '#b5573a', '#86402c', '#a5503a'], CONC = ['#a9a49b', '#8f8b84', '#c2bcb1'], WHITE = ['#ece6da', '#ddd6c8'], DARK = ['#2c2c31', '#3a3a40'];
const SIGN = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f78c6b', '#ffffff', '#c77dff'];

export function makeSeoulTitle() {
  rs = 7;
  const root = new THREE.Group(), wall = new Bag(), glow = new Bag(), floor = new Bag();
  const L0 = 60, L1 = -230; // 곰(0) 기준 뒤 60m · 앞 230m
  // 바닥: 아스팔트 찻길(폭 9) · 보도블록 · 차선 · 횡단보도
  floor.box(9, 0.02, L0 - L1, 0, -0.02, (L0 + L1) / 2, '#3b3d43');
  for (const s of [-1, 1]) { floor.box(4, 0.12, L0 - L1, s * 6.5, -0.02, (L0 + L1) / 2, '#b9aea0'); floor.box(0.25, 0.16, L0 - L1, s * 4.55, -0.02, (L0 + L1) / 2, '#d8d2c6'); }
  for (let z = L0; z > L1; z -= 6) floor.box(0.18, 0.03, 3, 0, 0, z, '#f2efe6');
  for (const zc of [-24, -128]) for (let x = -4; x <= 4; x += 1.1) floor.box(0.6, 0.03, 3.2, x, 0, zc, '#f4f1ea');
  floor.box(400, 0.01, 400, 0, -0.06, -80, '#6b6660');
  // 건물 줄: 양쪽으로 붙어 선 2 ~ 4층
  for (const s of [-1, 1]) {
    let z = L0;
    while (z > L1) {
      const w = 7 + R() * 9, d = 10 + R() * 8, fl = 2 + Math.floor(R() * 3), h = fl * 3.6, x = s * (8.6 + d / 2), zc = z - w / 2;
      const kind = R(), col = kind < 0.5 ? pick(BRICK) : kind < 0.75 ? pick(CONC) : kind < 0.9 ? pick(WHITE) : pick(DARK);
      if (Math.abs(zc + 70) < 8) { z -= w; continue; } // 2호선 고가 밑은 비운다
      if (R() < 0.14 && w > 11) {
        // 톱니 지붕 창고 (성수동 옛 공장)
        wall.box(d, 5.5, w, x, 0, zc, pick(BRICK));
        const teeth = Math.max(2, Math.floor(w / 3.6));
        for (let i = 0; i < teeth; i++) { const zz = zc - w / 2 + (i + 0.5) * (w / teeth); const tri = new THREE.CylinderGeometry(1.8, 1.8, d, 3); tri.rotateZ(Math.PI / 2); wall.add(tri, '#5b5f66', x, 6.4, zz); glow.box(0.1, 1.1, w / teeth * 0.6, x - s * (d / 2 - 0.3), 6.2, zz, '#ffe2a8'); }
        glow.box(0.12, 2.6, w * 0.7, x - s * (d / 2 + 0.02), 0.4, zc, '#ffd29a');
      } else {
        wall.box(d, h, w, x, 0, zc, col);
        wall.box(d + 0.3, 0.5, w + 0.3, x, h, zc, kind < 0.5 ? '#6e3324' : '#77736c'); // 옥상 난간
        // 1층: 큰 유리창(카페) · 차양 · 간판
        const fx = x - s * (d / 2 + 0.03);
        glow.box(0.1, 2.5, w * 0.78, fx, 0.35, zc, R() < 0.5 ? '#ffd9a0' : '#ffe9c4');
        wall.box(0.12, 0.25, w * 0.8, fx, 0.15, zc, '#2a2522');
        if (R() < 0.6) wall.box(1.3, 0.12, w * 0.7, fx - s * 0.6, 3.0, zc, pick(['#1f3b2d', '#3a2b25', '#ece6da', '#8a2b2b']));
        glow.box(0.14, 0.7, Math.min(4.5, w * 0.5), fx - s * 0.05, 3.35, zc + (R() - 0.5) * 2, pick(SIGN));
        // 위층 창: 칸마다 켜짐 · 꺼짐
        for (let f = 1; f < fl; f++) for (let wz = -w / 2 + 1.4; wz < w / 2 - 1; wz += 2.4) {
          const lit = R() < 0.45;
          (lit ? glow : wall).box(0.08, 1.5, 1.4, fx, f * 3.6 + 0.9, zc + wz + 0.6, lit ? pick(['#ffe1ad', '#fff3d6', '#ffd18a']) : '#2b3440');
        }
      }
      z -= w + 0.15;
    }
  }
  // 벽돌 굴뚝 (성수동 공장 굴뚝)
  wall.add(new THREE.CylinderGeometry(1.1, 1.6, 26, 10), '#8e3f2b', -24, 13, -96);
  wall.add(new THREE.CylinderGeometry(1.3, 1.3, 1, 10), '#5e2a1d', -24, 26.2, -96);
  // 2호선 고가: 길을 가로지르는 콘크리트 다리 + 기둥
  const VZ = -70;
  wall.box(160, 1.6, 9, 0, 8.6, VZ, '#b8b3aa');
  wall.box(160, 0.9, 0.4, 0, 10.2, VZ - 4.3, '#9f9a91'); wall.box(160, 0.9, 0.4, 0, 10.2, VZ + 4.3, '#9f9a91');
  for (const px of [-44, -24, 24, 44]) wall.box(2, 8.6, 2.6, px, 0, VZ, '#a6a199');
  glow.box(4, 0.8, 0.3, 0, 7.4, VZ + 4.6, '#00a84d'); // 역 이름판 자리 (2호선 초록)
  // 은행나무 가로수 (가을 노랑) · 가로등
  for (const s of [-1, 1]) for (let z = L0 - 4; z > L1; z -= 9) {
    if (Math.abs(z - VZ) < 6) continue;
    // 첫 화면 카메라가 곰 둘레 반지름 5m 로 돌아서, 나무 · 가로등은 보도 바깥쪽(6.8m ~)에 둔다
    const x = s * 7.1, h = 3.2 + R() * 1.2;
    wall.add(new THREE.CylinderGeometry(0.13, 0.18, h, 5), '#4a3626', x, h / 2, z);
    wall.add(new THREE.ConeGeometry(1.0 + R() * 0.25, 3.6, 7), pick(['#f2c230', '#e8b21f', '#f5d04a', '#d9a51a']), x, h + 1.4, z);
    if (Math.round(z) % 27 < 9) { wall.box(0.14, 5.4, 0.14, s * 7.9, 0, z + 4, '#3c4048'); wall.box(1.1, 0.12, 0.2, s * 7.4, 5.4, z + 4, '#3c4048'); glow.box(0.5, 0.12, 0.3, s * 6.95, 5.28, z + 4, '#fff1c8'); }
  }
  // 뒤로 아파트 · 빌딩 실루엣 (서울다운 스카이라인)
  for (let i = 0; i < 46; i++) {
    const s = R() < 0.5 ? -1 : 1, x = s * (40 + R() * 70), z = 40 - R() * 300, w = 10 + R() * 14, h = 18 + R() * 40;
    wall.box(w, h, 9 + R() * 6, x, 0, z, pick(['#a8adb8', '#9aa0ad', '#b9bcc4', '#8e95a3']));
    for (let f = 2; f < h - 2; f += 3) if (R() < 0.35) glow.box(w * 0.86, 0.5, 0.1, x, f, z + s * 0 + 5.2, '#ffe6b8');
  }
  root.add(floor.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
  root.add(wall.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
  root.add(glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));

  // ---- 움직이는 것 ----
  // 2호선 전철: 초록 띠 은색 차량 4칸 (한 덩어리) — 고가 위를 오간다
  const tr = new Bag();
  for (let i = 0; i < 4; i++) { const x = i * 10.4; tr.box(10, 2.6, 2.8, x, 0, 0, '#d9dde2'); tr.box(10.02, 0.45, 2.82, x, 0.9, 0, '#00a84d'); for (let k = -3; k <= 3; k++) tr.box(0.9, 0.8, 2.84, x + k * 1.35, 1.5, 0, '#3a4652'); }
  const train = tr.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); train.position.set(-90, 10.4, VZ + 2); root.add(train);
  // 행인 젤리 · 차 (꼭짓점 색 한 덩어리씩)
  const movers = [];
  const jelly = (col) => { const b = new Bag(); b.add(new THREE.CapsuleGeometry(0.32, 0.55, 4, 8), col, 0, 0.62, 0); b.add(new THREE.SphereGeometry(0.3, 10, 8), col, 0, 1.38, 0); b.add(new THREE.SphereGeometry(0.11, 6, 5), col, -0.2, 1.62, 0); b.add(new THREE.SphereGeometry(0.11, 6, 5), col, 0.2, 1.62, 0); return b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); };
  for (let i = 0; i < 9; i++) { const m = jelly(pick(['#ff9fb3', '#9fd3ff', '#ffe08a', '#b6f0a8', '#d7b8ff', '#ffbf8f'])), s = i % 2 ? 1 : -1; m.position.set(s * (6 + R() * 1.6), 0, 30 - R() * 200); m.userData = { v: (R() < 0.5 ? 1 : -1) * (1 + R() * 0.5), ph: R() * 6 }; root.add(m); movers.push(m); }
  const car = (col) => { const b = new Bag(); b.box(1.8, 0.75, 4.2, 0, 0.3, 0, col); b.box(1.6, 0.6, 2.2, 0, 1.05, -0.2, '#2b3440'); for (const wx of [-0.85, 0.85]) for (const wz of [-1.3, 1.3]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10); w.rotateZ(Math.PI / 2); b.add(w, '#1d1d20', wx, 0.34, wz); } return b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); };
  const cars = [];
  for (let i = 0; i < 3; i++) { const m = car(pick(['#f4f4f2', '#2b2f36', '#c0392b', '#dfe4ea', '#1e5aa8'])), lane = i % 2 ? 2.4 : -2.4; m.position.set(lane, 0, 20 - i * 70); m.rotation.y = lane > 0 ? Math.PI : 0; m.userData = { v: lane > 0 ? 9 : -7 }; root.add(m); cars.push(m); }

  return {
    root,
    update(dt, t) {
      train.position.x += dt * 14; if (train.position.x > 90) train.position.x = -130;
      for (const m of movers) { m.position.z += m.userData.v * dt; if (m.position.z > 40) m.position.z = -180; if (m.position.z < -180) m.position.z = 40; m.position.y = Math.abs(Math.sin(t * 7 + m.userData.ph)) * 0.08; m.rotation.y = m.userData.v > 0 ? 0 : Math.PI; }
      for (const m of cars) { m.position.z += m.userData.v * dt; if (m.position.z > 60) m.position.z = -230; if (m.position.z < -230) m.position.z = 60; }
    },
    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); },
  };
}
