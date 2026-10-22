// 젤리어택 맵: 상자(벽 · 건물 · 컨테이너 · 나무상자)들로 만든다. 서버도 이 파일로 벽 판정 · 봇 길찾기
//   상자 = { x, z: 가운데, w(x 폭), d(z 폭), y: 바닥 높이, h: 높이, k: 종류(색) }
const B = (x, z, w, d, h, k = 'wall', y = 0) => ({ x, z, w, d, h, k, y });
function walls(W, D, h = 6) { return [B(0, -D / 2 - 0.5, W + 2, 1, h, 'outer'), B(0, D / 2 + 0.5, W + 2, 1, h, 'outer'), B(-W / 2 - 0.5, 0, 1, D, h, 'outer'), B(W / 2 + 0.5, 0, 1, D, h, 'outer')]; }
function crates(list) { return list.flatMap(([x, z, n = 1]) => Array.from({ length: n }, (_, i) => B(x, z, 1.3, 1.3, 1.3, 'crate', i * 1.3))); }

export const MAPS = [
  {
    id: 'depot', name: '제3보급창고', emoji: '📦', W: 84, D: 64,
    sky: ['#7fa7d6', '#e8d9b8', '#c9b48a'], fog: [40, 160], floor: '#b8a582', floor2: '#a89470',
    colors: { outer: '#8d8a80', wall: '#c9b99a', ware: '#a0846a', roof: '#6d5a48', cont1: '#c0504d', cont2: '#3f7cb5', cont3: '#5f8f4e', crate: '#b8864b', low: '#9e9686', step: '#8d8a80' },
    boxes: [
      ...walls(84, 64),
      B(0, -6, 12, 8, 5.5, 'ware'), B(0, 8, 12, 8, 5.5, 'ware'),
      B(-14, -20, 12, 3, 3, 'cont1'), B(14, 20, 12, 3, 3, 'cont2'), B(-18, 16, 3, 10, 3, 'cont3'), B(18, -16, 3, 10, 3, 'cont1'),
      B(-14, -20, 12, 3, 3, 'cont2', 3), B(14, 20, 12, 3, 3, 'cont3', 3),
      B(-30, -8, 1, 8, 1.2, 'low'), B(-30, 10, 1, 8, 1.2, 'low'), B(30, 8, 1, 8, 1.2, 'low'), B(30, -10, 1, 8, 1.2, 'low'),
      B(-10, 22, 8, 1, 2.2, 'wall'), B(10, -22, 8, 1, 2.2, 'wall'), B(0, 27, 1, 9, 3, 'wall'), B(0, -27, 1, 9, 3, 'wall'),
      ...crates([[-22, 0, 2], [-23.4, 0], [22, 2, 2], [23.4, 2], [-8, 1], [8, 1, 2], [-5, 19, 2], [5, -19, 2], [-34, 22], [34, -22], [-12, 28], [12, -28, 2], [-26, -26, 2], [26, 26, 2]]),
    ],
    spawns: { red: [[-38, -12], [-38, -4], [-38, 4], [-38, 12], [-35, 0], [-35, -20], [-35, 20]], blue: [[38, -12], [38, -4], [38, 4], [38, 12], [35, 0], [35, -20], [35, 20]] },
  },
  {
    id: 'desert', name: '사막 마을', emoji: '🏜️', W: 96, D: 72,
    sky: ['#ff9e57', '#ffe2b0', '#e8c07d'], fog: [45, 170], floor: '#e2c48a', floor2: '#d4b273',
    colors: { outer: '#c9a06a', house: '#e8d4a8', house2: '#d9b98a', roof: '#b07d4b', wall: '#d2b07a', low: '#c79c63', crate: '#a8743f', stall: '#e57373', step: '#c9a06a' },
    boxes: [
      ...walls(96, 72, 7),
      B(-22, -22, 10, 10, 6, 'house'), B(-22, 0, 10, 8, 5, 'house2'), B(-22, 22, 10, 10, 6, 'house'),
      B(22, -22, 10, 10, 6, 'house2'), B(22, 0, 10, 8, 5, 'house'), B(22, 22, 10, 10, 6, 'house2'),
      B(0, -14, 8, 8, 7, 'house'), B(0, 14, 8, 8, 7, 'house2'),
      B(-6, 0, 1, 6, 2, 'low'), B(6, 0, 1, 6, 2, 'low'),
      B(-36, -14, 6, 1, 2.4, 'wall'), B(-36, 14, 6, 1, 2.4, 'wall'), B(36, -14, 6, 1, 2.4, 'wall'), B(36, 14, 6, 1, 2.4, 'wall'),
      B(-10, -30, 1.2, 1.2, 1, 'stall'), B(10, 30, 1.2, 1.2, 1, 'stall'), B(-12, 30, 3, 1.5, 1, 'stall'), B(12, -30, 3, 1.5, 1, 'stall'),
      ...crates([[-10, 8, 2], [10, -8, 2], [-34, 0], [34, 0], [-12, -6], [12, 6], [0, 30, 2], [0, -30, 2], [-40, -28], [40, 28]]),
    ],
    spawns: { red: [[-43, -20], [-43, -8], [-43, 0], [-43, 8], [-43, 20], [-40, -30], [-40, 30]], blue: [[43, -20], [43, -8], [43, 0], [43, 8], [43, 20], [40, -30], [40, 30]] },
  },
  {
    id: 'factory', name: '젤리 공장', emoji: '🏭', W: 90, D: 60,
    sky: ['#3a2f5c', '#d97fb3', '#5c4a7a'], fog: [30, 140], floor: '#7c7a8c', floor2: '#6c6a7c',
    colors: { outer: '#5c5a6c', tank: '#ff8fb8', tank2: '#7cd8ff', pipe: '#b0b6c3', belt: '#3c3a4c', wall: '#8a8798', plat: '#9a8fb3', crate: '#c48a5a', low: '#6c6a7c', step: '#9a8fb3' },
    boxes: [
      ...walls(90, 60, 8),
      B(-16, -14, 6, 6, 8, 'tank'), B(-16, 14, 6, 6, 8, 'tank2'), B(16, -14, 6, 6, 8, 'tank2'), B(16, 14, 6, 6, 8, 'tank'),
      B(0, 0, 14, 6, 2.5, 'plat'), // 가운데 높은 단 (양쪽 계단으로 오른다)
      B(-28, -20, 14, 1.2, 1, 'belt'), B(28, 20, 14, 1.2, 1, 'belt'), B(-28, 20, 14, 1.2, 1, 'belt'), B(28, -20, 14, 1.2, 1, 'belt'),
      B(0, -22, 1, 10, 3, 'wall'), B(0, 22, 1, 10, 3, 'wall'),
      B(-32, 0, 1, 10, 1.4, 'low'), B(32, 0, 1, 10, 1.4, 'low'),
      B(-8, -24, 10, 0.8, 0.8, 'pipe', 2.6), B(8, 24, 10, 0.8, 0.8, 'pipe', 2.6),
      ...crates([[-8, -10, 2], [8, 10, 2], [-24, 8], [24, -8], [-36, -12, 2], [36, 12, 2], [-6, 14], [6, -14], [-24, -26], [24, 26]]),
    ],
    spawns: { red: [[-41, -18], [-41, -8], [-41, 0], [-41, 8], [-41, 18], [-38, -24], [-38, 24]], blue: [[41, -18], [41, -8], [41, 0], [41, 8], [41, 18], [38, -24], [38, 24]] },
  },
];
// 가운데 단 계단 (젤리 공장): 단 양 끝(x=±7)에서 바깥으로 0.5m 씩 내려간다 (2.0 · 1.5 · 1.0 · 0.5)
for (const s of [-1, 1]) MAPS[2].boxes.push(...[0, 1, 2, 3].map((i) => B(s * (7.5 + i), 0, 1, 3, 2.5 - 0.5 * (i + 1), 'step')));

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

// ---------- 판정 (서버 · 화면 같이) ----------
// 반직선 o + d·t 가 상자들과 처음 만나는 t (없으면 max)
export function rayBoxes(map, o, d, max) {
  let best = max;
  for (const b of map.boxes) {
    const t = rayBox(o, d, b);
    if (t !== null && t < best) best = t;
  }
  return best;
}
export function rayBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  const mn = [b.x - b.w / 2, b.y, b.z - b.d / 2], mx = [b.x + b.w / 2, b.y + b.h, b.z + b.d / 2], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dd[a]) < 1e-9) { if (oo[a] < mn[a] || oo[a] > mx[a]) return null; continue; }
    let ta = (mn[a] - oo[a]) / dd[a], tb = (mx[a] - oo[a]) / dd[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}
// 두 점 사이가 트였나
export function clearLine(map, a, b) {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, L = Math.hypot(d.x, d.y, d.z) || 1;
  d.x /= L; d.y /= L; d.z /= L;
  return rayBoxes(map, a, d, L) >= L - 0.05;
}
// 그 자리 바닥 높이 (올라설 수 있는 상자 위)
export function floorAt(map, x, z, y, r = 0.35) {
  let top = 0;
  for (const b of map.boxes) {
    if (x < b.x - b.w / 2 - r || x > b.x + b.w / 2 + r || z < b.z - b.d / 2 - r || z > b.z + b.d / 2 + r) continue;
    const t = b.y + b.h;
    if (t <= y + 0.55 && t > top) top = t;
  }
  return top;
}
