// 🗺️ 서울 맵 풍경 (러너-개선 6): 젤리 서울 러너 코스를 닮은 조각들
//   가게 건물 줄 · 간판 · 아파트 · 유리 빌딩 · 한옥 · 궁궐 문 · 돌담 · 은행나무 · 버스 정류장 · 신호등 · 한강 다리 · 남산타워 · 롯데월드타워 · 63빌딩 · DDP …
//   색은 코스(P)가 고르고, 창 · 간판은 빛나는 재질(밤 코스에서 불이 켜진 것처럼)
import * as THREE from 'three';
import { toon, G, geo } from '../../shared/js/utils.js';
import { KITS, glow } from './kits.js';

const M = (c) => (typeof c === 'object' ? c : toon(c));
function add(p, g, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(g, M(mat)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); p.add(m); return m; }
const box = (p, c, x, y, z, w, h, d, ry = 0) => add(p, G.box(), c, x, y + h / 2, z, w, h, d, 0, ry);
const cyl = (p, c, x, y, z, r, h, low = true) => add(p, low ? G.cylLow() : G.cyl(), c, x, y + h / 2, z, r, h, r);
const ball = (p, c, x, y, z, a, b = a, d = a) => add(p, G.sphereLow(), c, x, y, z, a, b, d);
const cone = (p, c, x, y, z, r, h) => add(p, G.cone(), c, x, y + h / 2, z, r, h, r);
const grp = () => new THREE.Group();
// 기와지붕: 네 모서리가 살짝 들린 낮은 피라미드 (사각뿔을 납작하게)
const roofG = () => geo('sRoof', () => { const g = new THREE.ConeGeometry(0.75, 1, 4, 1); g.rotateY(Math.PI / 4); return g; });
const roof = (p, c, x, y, z, w, h, d) => add(p, roofG(), c, x, y + h / 2, z, w, h, d);
// 창 띠: 층마다 앞 · 옆 면에 빛나는 가로 띠 (사무실 빌딩)
function bands(p, x, z, w, d, h0, h1, floor, win, frame) {
  for (let y = h0 + floor * 0.35; y < h1 - floor * 0.3; y += floor) {
    box(p, glow(win), x, y, z - d / 2 - 0.02, w * 0.92, floor * 0.5, 0.04); box(p, glow(win), x, y, z + d / 2 + 0.02, w * 0.92, floor * 0.5, 0.04); box(p, glow(win), x - w / 2 - 0.02, y, z, 0.04, floor * 0.5, d * 0.92); box(p, glow(win), x + w / 2 + 0.02, y, z, 0.04, floor * 0.5, d * 0.92);
    if (frame) box(p, frame, x, y + floor * 0.5, z - d / 2 - 0.03, w * 0.94, 0.06, 0.05);
  }
}
// 창 칸: 집 · 가게 건물 위층 (낱낱의 창)
function wins(p, x, z, w, d, h0, h1, floor, win, cols, r) {
  for (let y = h0 + floor * 0.3; y < h1 - floor * 0.35; y += floor) for (let i = 0; i < cols; i++) { if (r && r.chance(0.12)) continue; const wx = x - w / 2 + (i + 0.5) * (w / cols); for (const sz of [-1, 1]) box(p, glow(win), wx, y, z + sz * (d / 2 + 0.02), (w / cols) * 0.55, floor * 0.45, 0.04); }
  // 옆면 창 (길 쪽을 보는 면이 어느 쪽이든 보이게)
  for (let y = h0 + floor * 0.3; y < h1 - floor * 0.35; y += floor) for (const sx of [-1, 1]) box(p, glow(win), x + sx * (w / 2 + 0.02), y, z, 0.04, floor * 0.45, d * 0.6);
}
// 잎 덩어리: 햇빛 반대쪽에서 봐도 칙칙한 갈색이 되지 않게 제 색으로 은은히 빛난다
const leafM = (c) => glow(c);
const SIGN = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#ffffff', '#00acc1', '#f06292'];

Object.assign(KITS, {
  // 상가 건물: 3 ~ 6층, 1층 유리 가게 + 위층 창 + 층마다 가로 간판 · 세로 돌출 간판 (명동 · 홍대 · 강남 뒷골목)
  seoulShop: { place: 'street', every: 5, build(r, P) {
    const g = grp(), fl = 3.1, n = r.int(3, 6), w = r.range(5, 8), d = r.range(5, 7), h = n * fl + 0.4, wall = r.pick(P.walls || ['#d7ccc8', '#bcaaa4', '#eceff1', '#cfd8dc', '#a1887f']);
    box(g, wall, 0, 0, 0, w, h, d); box(g, shade(wall), 0, h, 0, w + 0.2, 0.3, d + 0.2);
    for (const sz of [-1, 1]) { box(g, glow(P.shop || '#ffe9b0'), 0, 0.2, sz * (d / 2 + 0.02), w * 0.9, 2.2, 0.05); box(g, '#3e2723', 0, 2.5, sz * (d / 2 + 0.05), w, 0.12, 0.1); }
    wins(g, 0, 0, w, d, fl, h, fl, P.win || '#fff3c4', r.int(2, 4), r);
    for (let i = 1; i < n; i++) if (r.chance(0.75)) { const c = glow(r.pick(P.signs || SIGN)), sw = w * r.range(0.6, 0.95); for (const sz of [-1, 1]) box(g, c, 0, i * fl - 0.55, sz * (d / 2 + 0.12), sw, 0.62, 0.12); }
    if (r.chance(0.7)) { const sx = (r.chance(0.5) ? -1 : 1) * (w / 2 - 0.4); box(g, glow(r.pick(P.signs || SIGN)), sx, fl * 0.9, -d / 2 - 0.55, 0.22, Math.min(h - 2, r.range(3, 7)), 0.9); }
    if (r.chance(0.4)) box(g, '#90a4ae', r.range(-w / 3, w / 3), h + 0.3, r.range(-d / 4, d / 4), 1.2, 0.7, 0.8);
    return g;
  } },
  // 유리 사무실 빌딩 (강남 · 여의도 · 광화문): 층마다 빛나는 창 띠, 꼭대기 띠
  seoulOffice: { place: 'far', every: 9, build(r, P) {
    const g = grp(), w = r.range(14, 26), d = r.range(14, 22), h = r.range(45, 110), glass = r.pick(P.glass || ['#4a6a8a', '#5b7d99', '#3d5a73', '#7a8fa3']);
    box(g, glass, 0, 0, 0, w, h, d); bands(g, 0, 0, w, d, 4, h, 4, P.win || '#cfe8ff', null);
    box(g, '#263238', 0, h, 0, w * 0.6, 3, d * 0.6); if (r.chance(0.5)) box(g, glow(P.top || '#ffffff'), 0, h - 2, -d / 2 - 0.1, w * 0.95, 0.6, 0.1);
    g.userData.rad = Math.hypot(w, d) / 2; return g;
  } },
  // 아파트 동: 판상형, 동 번호 · 층마다 베란다 창, 옥상 물탱크
  seoulApt: { place: 'far', every: 10, build(r, P) {
    const g = grp(), w = r.range(35, 60), d = 12, n = r.int(12, 25), h = n * 2.8, c = r.pick(['#eceff1', '#f5f5f5', '#e8e2d6', '#dfe6ea']);
    // 긴 쪽이 길과 나란히 (z 방향)
    box(g, c, 0, 0, 0, d, h, w); for (let y = 2; y < h - 1; y += 2.8) for (const sx of [-1, 1]) box(g, glow(P.win || '#fff3c4'), sx * (d / 2 + 0.05), y, 0, 0.06, 1.1, w * 0.94);
    for (const sx of [-1, 1]) box(g, P.apt || '#5c6bc0', sx * (d / 2 + 0.1), h - 6, w / 2 - 3, 0.1, 5, 3); box(g, '#cfd8dc', 0, h, 0, 6, 3, 8);
    g.userData.alongTrack = true; g.userData.halfW = 7; return g;
  } },
  // 한옥: 돌 기단 · 흰 벽 · 나무 기둥 · 기와지붕 (북촌 · 인사동)
  hanok: { place: 'street', every: 5, build(r, P) {
    const g = grp(), w = r.range(5, 8), d = r.range(4, 6);
    box(g, '#9e9e9e', 0, 0, 0, w + 0.6, 0.6, d + 0.6); box(g, '#f3eee4', 0, 0.6, 0, w, 2.3, d);
    for (const sx of [-1, -0.33, 0.33, 1]) box(g, '#6d4c41', sx * (w / 2 - 0.1), 0.6, -d / 2 - 0.02, 0.2, 2.3, 0.2);
    box(g, glow(P.paper || '#ffe7b8'), 0, 1.2, -d / 2 - 0.04, w * 0.55, 1.2, 0.04); for (let i = -2; i <= 2; i++) box(g, '#6d4c41', i * w * 0.11, 1.2, -d / 2 - 0.06, 0.05, 1.2, 0.03);
    roof(g, P.tile || '#37474f', 0, 2.9, 0, w * 1.75, 1.6, d * 1.8); box(g, P.tile || '#37474f', 0, 4.3, 0, w * 0.9, 0.25, 0.4);
    return g;
  } },
  // 궁궐 문 (광화문 · 흥인지문): 돌 기단에 무지개 문, 2층 누각 · 겹지붕
  palaceGate: { place: 'far', every: 40, build(r, P) {
    const g = grp(), W = 34, D = 14;
    box(g, '#bdb6a8', 0, 0, 0, W, 9, D); for (const x of [-9, 0, 9]) { box(g, '#2b2b2b', x, 0, -D / 2 - 0.05, 4.2, 5.5, 0.1); ball(g, '#2b2b2b', x, 5.5, -D / 2 - 0.05, 2.1, 1.4, 0.05); }
    box(g, '#8d3a2a', 0, 9, 0, W * 0.75, 4, D * 0.7); for (let i = -5; i <= 5; i++) box(g, '#5d2a1e', i * 2.4, 9, -D * 0.35 - 0.05, 0.4, 4, 0.4);
    roof(g, '#37474f', 0, 13, 0, W * 1.25, 3.5, D * 1.4); box(g, '#8d3a2a', 0, 16, 0, W * 0.55, 3, D * 0.5); roof(g, '#37474f', 0, 19, 0, W * 0.95, 3.5, D * 1.05);
    box(g, '#e8e2d6', 0, 9.5, -D * 0.35 - 0.3, 6, 1.6, 0.2);
    g.userData.rad = 22; return g;
  } },
  // 돌담 (덕수궁 돌담길): 길게 이어진 낮은 돌담 + 기와 지붕선
  stoneWall: { place: 'street', every: 3, build(r, P) {
    const g = grp(), L = 9;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(g, j % 2 ? '#a1887f' : '#bcaaa4', -L / 2 + (i + (j % 2) * 0.5) * (L / 6) + 0.75, j * 0.6, 0, L / 6 - 0.08, 0.56, 1.2);
    box(g, '#d7ccc8', 0, 1.8, 0, L, 0.9, 1); roof(g, '#455a64', 0, 2.7, 0, L * 1.5, 0.7, 2.2);
    return g;
  } },
  // 벚나무 (윤중로 · 석촌호수): 굽은 줄기 · 분홍 꽃 덩어리 여럿
  seoulBlossom: { place: 'street', every: 4, build(r, P) { const g = grp(), h = r.range(2.6, 3.8), c = P.leaf || '#ffc1dc'; cyl(g, P.wood || '#5d4037', 0, 0, 0, 0.2, h); for (let i = 0; i < 6; i++) ball(g, leafM(i % 2 ? c : shade(c, 1.08)), r.range(-1.3, 1.3), h + r.range(-0.2, 1.1), r.range(-1.3, 1.3), r.range(0.8, 1.3)); return g; } },
  // 은행나무 (가을 노랑 · 봄여름 초록, P.leaf 로)
  ginkgo: { place: 'street', every: 4, build(r, P) {
    const g = grp(), h = r.range(4, 6.5); cyl(g, '#6d4c41', 0, 0, 0, 0.18, h * 0.55);
    const c = P.ginkgo || '#f9c80e'; cone(g, leafM(c), 0, h * 0.35, 0, 1.5, h * 0.75); cone(g, leafM(shade(c, 0.9)), 0, h * 0.55, 0, 1.1, h * 0.55); return g;
  } },
  // 가로수 (플라타너스 · 느티나무): 둥근 잎 덩어리 셋
  streetTree: { place: 'street', every: 4, build(r, P) {
    const g = grp(), h = r.range(3.5, 5.5), c = P.leaf || '#5d9c4a'; cyl(g, '#795548', 0, 0, 0, 0.17, h * 0.6);
    ball(g, leafM(c), 0, h * 0.75, 0, 1.6, 1.3, 1.6); ball(g, leafM(shade(c, 0.88)), 0.9, h * 0.68, 0.3, 1.1); ball(g, leafM(shade(c, 1.1)), -0.8, h * 0.85, -0.2, 1.1); return g;
  } },
  // 서울 가로등: 길게 휘어진 팔 + 둥근 등 (밤에 빛난다)
  seoulLamp: { place: 'street', every: 6, build(r, P) {
    const g = grp(); cyl(g, '#546e7a', 0, 0, 0, 0.09, 6); box(g, '#546e7a', 0.8, 5.9, 0, 1.7, 0.12, 0.12); ball(g, glow(P.lamp || '#ffe7b0'), 1.6, 5.75, 0, 0.32, 0.18, 0.32);
    if (r.chance(0.5)) box(g, glow(r.pick(['#1e88e5', '#e53935', '#43a047'])), 0.2, 3.2, 0, 0.08, 1.4, 0.5); return g;
  } },
  // 버스 정류장: 지붕 · 유리 벽 · 노선도 판 · 의자 · 기다리는 젤리
  busStop: { place: 'street', every: 14, build(r, P) {
    const g = grp(); box(g, '#cfd8dc', 0, 0, 0, 5, 0.12, 2); for (const x of [-2.3, 2.3]) box(g, '#455a64', x, 0, 0.8, 0.12, 2.6, 0.12);
    box(g, P.busRoof || '#1565c0', 0, 2.6, 0.2, 5.4, 0.18, 2.2); box(g, glow('#bfe3ff', 0.5), 0, 0.3, 0.9, 4.6, 2.2, 0.05); box(g, glow('#ffffff'), -1.6, 0.6, 0.85, 1, 1.6, 0.06);
    box(g, '#6d4c41', 0.8, 0.45, 0.5, 2.4, 0.12, 0.5); box(g, P.busRoof || '#1565c0', 2.9, 0, -0.6, 0.12, 3.4, 0.12); box(g, glow('#ffffff'), 2.9, 3.0, -0.6, 0.7, 0.7, 0.05);
    for (let i = 0; i < r.int(1, 3); i++) jellyInto(g, r, r.range(-1.8, 1.8), 0.12, r.range(-0.3, 0.3), Math.PI);
    return g;
  } },
  // 신호등 + 횡단보도 표지 (건널목 옆)
  signal: { place: 'street', every: 12, build(r, P) {
    const g = grp(); cyl(g, '#37474f', 0, 0, 0, 0.1, 5); box(g, '#37474f', 1.3, 4.8, 0, 2.6, 0.12, 0.12); box(g, '#263238', 2.4, 4.4, 0, 1.3, 0.45, 0.4);
    for (const [i, c] of [[0, '#ff3d00'], [1, '#ffb300'], [2, '#00e676']]) ball(g, glow(c), 1.95 + i * 0.42, 4.62, -0.22, 0.13);
    box(g, '#263238', 0, 2.2, -0.15, 0.45, 0.9, 0.3); ball(g, glow('#00e676'), 0, 2.45, -0.32, 0.12); box(g, glow('#1e88e5'), 0, 3.3, -0.12, 0.7, 0.7, 0.05); return g;
  } },
  // 붉은 벽돌 창고 카페 (성수동): 톱니 지붕 · 큰 창 · 철제 간판
  brickCafe: { place: 'street', every: 6, build(r, P) {
    const g = grp(), w = r.range(7, 10), d = 6, h = r.range(4.5, 7);
    box(g, '#9c4a32', 0, 0, 0, w, h, d); for (let y = 0.3; y < h; y += 0.45) box(g, '#7d3624', 0, y, -d / 2 - 0.02, w, 0.05, 0.03);
    box(g, glow('#ffd59a'), 0, 0.4, -d / 2 - 0.05, w * 0.7, 2.6, 0.05); for (let i = 0; i < 3; i++) roof(g, '#5d4037', -w / 3 + i * (w / 3), h, 0, w / 2.6, 1.4, d * 1.3);
    box(g, '#212121', 0, 3.4, -d / 2 - 0.2, w * 0.4, 0.5, 0.1); return g;
  } },
  // 네온 골목 간판 무리 (홍대 · 이태원 · 명동 밤)
  neonAlley: { place: 'street', every: 7, build(r, P) {
    const g = grp(); box(g, '#263238', 0, 0, 0, 5, r.range(6, 10), 4);
    for (let i = 0; i < 5; i++) box(g, glow(r.pick(P.signs || SIGN)), r.range(-1.6, 1.6), 1.5 + i * 1.5, -2.2, r.range(1.2, 3), 0.6, 0.12);
    box(g, glow(r.pick(P.signs || SIGN)), 2.2, 2, -2.6, 0.2, 4.5, 0.8); return g;
  } },
  // 포장마차 (명동 · 종로): 주황 천막 · 따뜻한 불빛
  stall: { place: 'street', every: 9, build(r, P) {
    const g = grp(); box(g, '#8d6e63', 0, 0, 0, 2.6, 1, 1.6); box(g, glow('#ffcc80'), 0, 1, 0, 2.4, 0.08, 1.4);
    for (const x of [-1.25, 1.25]) for (const z of [-0.75, 0.75]) box(g, '#5d4037', x, 0, z, 0.08, 2.4, 0.08); add(g, roofG(), r.pick(['#ff7043', '#e53935', '#ffa000']), 0, 2.7, 0, 4.2, 0.8, 2.8);
    ball(g, glow('#ffe0b2'), 0, 2.1, -0.5, 0.18); return g;
  } },
  // 한강 다리 (멀리): 아치 · 교각 · 밤 불빛 줄
  hanBridge: { place: 'far', every: 50, build(r, P) {
    const g = grp(), L = 260; box(g, '#cfd8dc', 0, 12, 0, 18, 2, L); for (let z = -L / 2; z <= L / 2; z += 32) box(g, '#b0bec5', 0, 0, z, 6, 12, 3);
    for (let z = -L / 2 + 10; z < L / 2; z += 6) ball(g, glow(P.bridge || '#fff3c4'), 9, 14.2, z, 0.35);
    if (r.chance(0.5)) for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(16, 0.9, 6, 24, Math.PI), M('#eceff1')); a.position.set(0, 14, -60 + i * 60); a.rotation.y = Math.PI / 2; g.add(a); }
    g.userData.alongTrack = true; g.userData.halfW = 10; return g;
  } },
  // 달빛무지개분수: 다리 옆으로 쏟아지는 무지개 물줄기
  rainbowFountain: { place: 'far', every: 60, build(r, P) {
    const g = grp(), L = 200; box(g, '#b0bec5', 0, 14, 0, 16, 2.4, L);
    const C = ['#ff5252', '#ffab40', '#ffee58', '#69f0ae', '#40c4ff', '#7c4dff', '#ff4081'];
    for (let i = 0; i < 40; i++) { const z = -L / 2 + i * (L / 40), c = C[i % C.length]; add(g, G.cone(), glow(c, 0.55), -9.5, 7, z, 0.8, 14, 0.8, 0, 0, -0.35); }
    g.userData.alongTrack = true; g.userData.halfW = 11; return g;
  } },
  // 남산 N서울타워: 산 위 하얀 탑 · 전망대 · 꼭대기 안테나 (멀리)
  namsanTower: { place: 'far', every: 80, build(r, P) {
    const g = grp(); cone(g, P.hill || '#4e7d4a', 0, 0, 0, 42, 40); cyl(g, '#eceff1', 0, 40, 0, 2.2, 55, false); cyl(g, '#cfd8dc', 0, 72, 0, 6, 6, false);
    box(g, glow(P.towerLit || '#bfe3ff'), 0, 73, -6.1, 8, 2, 0.2); cyl(g, '#eceff1', 0, 78, 0, 1, 10); cyl(g, '#e53935', 0, 88, 0, 0.4, 14); ball(g, glow('#ff1744'), 0, 102, 0, 0.8);
    g.userData.rad = 44; return g;
  } },
  // 롯데월드타워: 끝이 가늘어지는 555m 탑 (멀리 · 가까이 둘 다)
  lotteTower: { place: 'far', every: 70, build(r, P) {
    const g = grp(), s = 0.45;
    for (let i = 0; i < 12; i++) { const h0 = i * 45 * s, rr = (28 - i * 1.9) * s; add(g, G.cylLow(), i % 2 ? '#9fb3c4' : '#b9cad8', 0, h0 + 22.5 * s, 0, rr, 45 * s, rr * 0.8, 0, Math.PI / 8); }
    cone(g, '#b9cad8', 0, 540 * s, 0, 6 * s, 40 * s); for (let y = 30; y < 520; y += 40) box(g, glow(P.win || '#cfe8ff'), 0, y * s, -(28 - (y / 45) * 1.9) * s * 0.78, 6, 0.6, 0.2);
    g.userData.rad = 14; return g;
  } },
  // 63빌딩: 금빛 유리 탑 (여의도)
  gold63: { place: 'far', every: 70, build(r, P) {
    const g = grp(); add(g, G.box(), '#d4a64a', 0, 62, 0, 28, 124, 24, 0, 0, 0); add(g, G.box(), '#f2c968', 0, 116, 0, 18, 18, 18); bands(g, 0, 0, 28, 24, 4, 120, 4, P.win || '#fff3c4', null); g.userData.rad = 19; return g;
  } },
  // 국회의사당: 기둥 위 초록 돔 (여의도)
  assembly: { place: 'far', every: 90, build(r, P) {
    const g = grp(); box(g, '#e0dcd2', 0, 0, 0, 60, 18, 40); for (let i = -6; i <= 6; i++) cyl(g, '#f5f5f5', i * 4.4, 0, -20.5, 0.9, 18);
    add(g, G.hemi(), '#4e8f6e', 0, 18, 0, 16, 12, 16); g.userData.rad = 36; return g;
  } },
  // DDP: 은빛 물결 지붕 (동대문)
  ddp: { place: 'far', every: 70, build(r, P) {
    const g = grp(); for (let i = 0; i < 6; i++) add(g, G.sphere(), '#cfd8dc', 0, 8, i * 18 - 45, 22, 9 + (i % 2) * 3, 18); for (let i = 0; i < 30; i++) for (const sx of [-1, 1]) box(g, glow(P.win || '#e3f2fd'), sx * 20.5, 3, i * 3.4 - 50, 0.2, 0.4, 1.4); g.userData.alongTrack = true; g.userData.halfW = 23; return g;
  } },
  // 세종대왕 · 이순신 동상 (광화문 광장, 멀리 가운데)
  statue: { place: 'street', every: 40, build(r, P) {
    const g = grp(); box(g, '#9e9e9e', 0, 0, 0, 4, 2.6, 4); box(g, '#757575', 0, 2.6, 0, 3, 0.4, 3); cyl(g, '#8d7a4a', 0, 3, 0, 0.7, 2.4); ball(g, '#8d7a4a', 0, 5.9, 0, 0.6); box(g, '#8d7a4a', 0, 3.6, -0.5, 1.8, 0.4, 1); return g;
  } },
  // 청계천 돌계단 · 징검다리 (물 옆)
  streamStone: { place: 'street', every: 5, build(r, P) {
    const g = grp(); for (let i = 0; i < 4; i++) box(g, i % 2 ? '#b0a89a' : '#c8c0b0', 0, i * 0.4, i * 0.6, 6, 0.4, 0.6); box(g, '#8d8d8d', -2.5, 0, -0.6, 1, 0.5, 1); box(g, '#8d8d8d', 1.5, 0, -0.9, 1, 0.5, 1);
    for (let i = 0; i < 3; i++) ball(g, glow(r.pick(['#ffd180', '#ff8a80', '#82b1ff'])), -2 + i * 2, 1.4, 1.5, 0.35, 0.45, 0.35); return g;
  } },
  // 고가 철길 (성수 · 지하철 2호선): 콘크리트 기둥 + 상판, 가끔 지나가는 초록 열차
  viaduct: { place: 'far', every: 60, build(r, P) {
    const g = grp(), L = 200; box(g, '#bdbdbd', 0, 8, 0, 9, 1.6, L); for (let z = -L / 2; z <= L / 2; z += 25) box(g, '#9e9e9e', 0, 0, z, 2, 8, 2);
    for (let i = 0; i < 6; i++) { box(g, '#eceff1', 0, 9.6, -20 + i * 20, 3, 3, 19); box(g, '#00a84d', 0, 10.4, -20 + i * 20, 3.05, 0.5, 19.1); box(g, glow('#fff3c4'), 0, 11.1, -20 + i * 20, 3.1, 0.8, 16); }
    g.userData.alongTrack = true; g.userData.halfW = 6; return g;
  } },
  // 서울 하늘 실루엣 (멀리 빽빽한 빌딩 숲)
  skylineSeoul: { place: 'far', every: 25, build(r, P) {
    const g = grp(); for (let i = 0; i < 9; i++) { const w = r.range(8, 16), h = r.range(20, 70), z = i * 14 - 60, x = r.range(-6, 6); box(g, r.pick(P.glass || ['#5b6f82', '#71839a', '#8a9aac']), x, 0, z, 10, h, w); for (let y = 4; y < h - 2; y += 6) for (const sx of [-1, 1]) box(g, glow(P.win || '#fff3c4'), x + sx * 5.05, y, z, 0.05, 1.2, w * 0.85); }
    g.userData.alongTrack = true; g.userData.halfW = 12; return g;
  } },
  // 북악산 · 인왕산 같은 서울 뒷산 (멀리 둥근 초록 산)
  seoulHill: { place: 'far', every: 45, build(r, P) { const g = grp(), h = r.range(30, 55); add(g, G.sphereLow(), P.hill || '#4e7d4a', 0, 0, 0, h * 1.4, h, h * 1.2); add(g, G.sphereLow(), shade(P.hill || '#4e7d4a', 0.85), h * 0.9, 0, h * 0.3, h, h * 0.7, h); g.userData.rad = h * 2; return g; } },
  // 벤치 · 화분 (서울로7017 · 경의선숲길 · 공원)
  planter: { place: 'street', every: 5, build(r, P) { const g = grp(); cyl(g, '#bdbdbd', 0, 0, 0, 1.4, 0.9, false); ball(g, leafM(P.leaf || '#5d9c4a'), 0, 1.4, 0, 1.2, 0.9, 1.2); if (r.chance(0.5)) ball(g, glow(r.pick(['#ff80ab', '#ffd180', '#ea80fc'])), 0.6, 1.9, -0.6, 0.22); return g; } },
});

function shade(hex, k = 0.8) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }
// 젤리 사람 (하나로 묶을 수 있는 단순한 모양): 몸 · 머리 · 귀 · 팔 — 정류장 · 거리 풍경
const JC = ['#8a5634', '#f2c28a', '#ffd1dc', '#c9e4ff', '#d7ccc8', '#ffe082', '#b39ddb'];
export function jellyInto(p, r, x, y, z, ry = 0, s = 1) {
  const c = r.pick(JC), top = r.pick(['#1e88e5', '#e53935', '#fafafa', '#263238', '#43a047', '#f9a825', '#8e24aa']), g = grp();
  ball(g, top, 0, 0.55 * s, 0, 0.32 * s, 0.4 * s, 0.28 * s); ball(g, c, 0, 1.08 * s, 0, 0.3 * s); for (const sx of [-1, 1]) { ball(g, c, sx * 0.2 * s, 1.35 * s, 0, 0.1 * s); ball(g, '#263238', sx * 0.1 * s, 0.25 * s, 0, 0.11 * s, 0.25 * s, 0.11 * s); }
  g.position.set(x, y, z); g.rotation.y = ry; p.add(g); return g;
}
