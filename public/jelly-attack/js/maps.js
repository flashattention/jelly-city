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
// ---------- 꾸밈 · 더 많은 엄폐물 (보기 좋게 + 싸울 거리) ----------
//   숨은 상자(hide) 는 충돌만 하고, 모양은 deco 가 그린다 (드럼통 · 자동차)
const hidden = (x, z, w, d, h) => ({ ...B(x, z, w, d, h, 'low'), hide: true });
const barrel = (x, z, c) => [hidden(x, z, 0.85, 0.85, 1), { t: 'barrel', x, z, c }];
const car = (x, z, r, c) => [hidden(x, z, r ? 3.9 : 1.9, r ? 1.9 : 3.9, 1.5), { t: 'car', x, z, r: r ? Math.PI / 2 : 0, c }];
function dress(map, items) { for (const it of items.flat()) (it.t ? (map.deco ||= []) : map.boxes).push(it); }
// 제3보급창고: 지게차 길 · 가로등 · 드럼통 · 차 · 깃발 · 표지판
dress(MAPS[0], [
  barrel(-6, -12), barrel(-5, -12.9, '#3f7cb5'), barrel(6, 12), barrel(7, 12.8, '#5f8f4e'), barrel(-28, -24), barrel(28, 24, '#ffd84d'),
  car(-26, 6, 0, '#ff8fb8'), car(26, -6, 0, '#7cd8ff'), car(-6, -28, 1, '#ffd27a'),
  B(-20, 0, 1, 4, 1.5, 'low'), B(20, 0, 1, 4, 1.5, 'low'),
  { t: 'lamp', x: -12, z: 0, light: true }, { t: 'lamp', x: 12, z: 0, light: true }, { t: 'lamp', x: -34, z: -28 }, { t: 'lamp', x: 34, z: 28 },
  { t: 'flags', x: -20, z: -20, x2: -8, z2: -20, h: 6.5 }, { t: 'flags', x: 8, z: 20, x2: 20, z2: 20, h: 6.5 },
  { t: 'cone', x: -3, z: -23 }, { t: 'cone', x: 3, z: 23 }, { t: 'cone', x: -1, z: -23.5 }, { t: 'puddle', x: 15, z: -4, c: '#7cd8ff' }, { t: 'puddle', x: -15, z: 5 },
  { t: 'sign', x: -38, z: 26, text: '제3보급창고', c: '#5f8f4e', r: Math.PI / 2 }, { t: 'sign', x: 38, z: -26, text: '젤리 보급', c: '#c0504d', r: -Math.PI / 2 },
  { t: 'bush', x: -38, z: -30 }, { t: 'bush', x: 38, z: 30 }, { t: 'tree', x: -40, z: 30 }, { t: 'tree', x: 40, z: -30 },
]);
MAPS[0].roads = [{ x: 0, z: 0, w: 70, d: 6, c: '#8d8478', line: true }, { x: 0, z: 0, w: 6, d: 50, c: '#8d8478' }];
// 사막 마을: 세모 지붕 · 야자수 · 시장 파라솔 · 깃발 줄 · 바위
for (const b of MAPS[1].boxes) if (b.k.startsWith('house') && b.h <= 6) b.roof = 'pitch';
dress(MAPS[1], [
  barrel(-16, -8, '#a8743f'), barrel(16, 8, '#a8743f'), car(-30, -6, 1, '#ffb36b'), car(30, 6, 1, '#9be7c4'),
  B(-14, -30, 4, 1.2, 1.1, 'stall'), B(14, 30, 4, 1.2, 1.1, 'stall'),
  { t: 'palm', x: -32, z: -30 }, { t: 'palm', x: 32, z: 30 }, { t: 'palm', x: -6, z: -24 }, { t: 'palm', x: 6, z: 24 }, { t: 'palm', x: -44, z: 2 }, { t: 'palm', x: 44, z: -2 },
  { t: 'umbrella', x: -12, z: -27, c: '#ff8fb8' }, { t: 'umbrella', x: 12, z: 27, c: '#7cd8ff' }, { t: 'umbrella', x: -8, z: 32, c: '#ffd84d' }, { t: 'umbrella', x: 8, z: -32, c: '#9be7c4' },
  { t: 'flags', x: -17, z: -14, x2: -4, z2: -14, h: 6 }, { t: 'flags', x: 4, z: 14, x2: 17, z2: 14, h: 6 }, { t: 'flags', x: -17, z: 0, x2: 17, z2: 0, h: 7.5 },
  { t: 'rock', x: -40, z: -20, s: 1.6 }, { t: 'rock', x: 40, z: 20, s: 1.4 }, { t: 'rock', x: 0, z: 34, s: 1.2 }, { t: 'puddle', x: 0, z: 0, c: '#ffd27a' },
  { t: 'sign', x: 0, z: -34, text: '사막 마을', c: '#b07d4b' },
]);
MAPS[1].roads = [{ x: 0, z: 0, w: 84, d: 7, c: '#d9b67c' }, { x: 0, z: 0, w: 7, d: 64, c: '#d9b67c' }];
// 젤리 공장: 젤리 웅덩이 · 젤리 덩어리 · 드럼통 · 가로등
dress(MAPS[2], [
  barrel(-12, 4, '#ff8fb8'), barrel(12, -4, '#7cd8ff'), barrel(-30, -10, '#ff8fb8'), barrel(30, 10, '#7cd8ff'), barrel(-20, 25), barrel(20, -25),
  { t: 'jelly', x: -24, z: -2, c: '#ff8fb8', s: 1.4 }, { t: 'jelly', x: 24, z: 2, c: '#7cd8ff', s: 1.4 }, { t: 'jelly', x: 0, z: -12, c: '#b8a4ff' }, { t: 'jelly', x: 0, z: 12, c: '#9be7c4' },
  { t: 'puddle', x: -16, z: -8, c: '#ff8fb8', s: 1.6 }, { t: 'puddle', x: 16, z: 8, c: '#7cd8ff', s: 1.6 }, { t: 'puddle', x: -10, z: 22 }, { t: 'puddle', x: 10, z: -22, c: '#b8a4ff' },
  { t: 'lamp', x: -36, z: -26, light: true }, { t: 'lamp', x: 36, z: 26, light: true }, { t: 'lamp', x: -36, z: 26 }, { t: 'lamp', x: 36, z: -26 },
  { t: 'sign', x: 0, z: -28, text: '젤리 공장', c: '#ff5c8a' }, { t: 'sign', x: 0, z: 28, text: '조심! 끈적', c: '#7a5ce0', r: Math.PI },
]);
MAPS[2].roads = [{ x: 0, z: 0, w: 80, d: 4, c: '#5d5b6c', line: true }];
// 새 맵: 젤리 항구 — 컨테이너 미로 · 크레인 · 창고 · 배 · 부두
MAPS.push({
  id: 'harbor', name: '젤리 항구', emoji: '⚓', W: 100, D: 70,
  sky: ['#6fb7ff', '#d9f0ff', '#9cc3d6'], fog: [45, 180], floor: '#a9a39a', floor2: '#99928a', sea: '#3fa0d8',
  colors: { outer: '#7d7f88', ware: '#d7c3a5', roof: '#6d6a78', cont1: '#e8574f', cont2: '#3f7cb5', cont3: '#5fae6e', cont4: '#ffb02e', crate: '#b8864b', low: '#8d8a80', wall: '#c4b9a8', dock: '#8a6a4a', step: '#8d8a80' },
  boxes: [
    ...walls(100, 70, 4),
    // 창고 두 채 (가운데 통로)
    B(-30, -20, 18, 12, 6.5, 'ware'), B(30, 20, 18, 12, 6.5, 'ware'),
    // 컨테이너 미로 (2단도)
    B(-12, -6, 12, 2.6, 2.8, 'cont1'), B(-12, -6, 12, 2.6, 2.8, 'cont2', 2.8), B(12, 6, 12, 2.6, 2.8, 'cont3'), B(12, 6, 12, 2.6, 2.8, 'cont4', 2.8),
    B(-4, 14, 2.6, 12, 2.8, 'cont4'), B(4, -14, 2.6, 12, 2.8, 'cont1'), B(-22, 10, 12, 2.6, 2.8, 'cont3'), B(22, -10, 12, 2.6, 2.8, 'cont2'),
    B(0, 0, 2.6, 6, 2.8, 'cont2'), B(-34, 4, 2.6, 10, 2.8, 'cont4'), B(34, -4, 2.6, 10, 2.8, 'cont3'), B(-14, 24, 10, 2.6, 2.8, 'cont1'), B(14, -24, 10, 2.6, 2.8, 'cont4'),
    // 부두 · 배 (배는 올라설 수 있는 낮은 상자)
    B(0, -31, 40, 4, 0.6, 'dock'), B(-18, 31, 30, 4, 0.6, 'dock'),
    ...crates([[-26, -6, 2], [26, 6, 2], [-6, -20, 2], [6, 20, 2], [-42, -26], [42, 26], [-40, 18, 2], [40, -18, 2], [0, 8], [0, -8]]),
  ],
  deco: [
    { t: 'crane', x: -40, z: -30 }, { t: 'crane', x: 40, z: 30 },
    { t: 'boat', x: 22, z: -31, r: Math.PI / 2 }, { t: 'boat', x: -36, z: 31, r: Math.PI / 2 },
    { t: 'lamp', x: -20, z: -31, light: true }, { t: 'lamp', x: 20, z: 31, light: true }, { t: 'lamp', x: 0, z: -18 }, { t: 'lamp', x: 0, z: 18 },
    { t: 'flags', x: -30, z: -26, x2: -12, z2: -7.5, h: 7 }, { t: 'flags', x: 30, z: 26, x2: 12, z2: 7.5, h: 7 },
    { t: 'cone', x: -8, z: 2 }, { t: 'cone', x: 8, z: -2 }, { t: 'puddle', x: -18, z: 0, c: '#7cd8ff' }, { t: 'puddle', x: 18, z: 0, c: '#ff8fb8' },
    { t: 'sign', x: -46, z: 0, text: '젤리 항구', c: '#3f7cb5', r: Math.PI / 2 }, { t: 'bench', x: -10, z: -29 }, { t: 'bench', x: 10, z: 29, r: Math.PI },
  ],
  roads: [{ x: 0, z: 0, w: 92, d: 5, c: '#7f7a73', line: true }],
  spawns: { red: [[-46, -12], [-46, -4], [-46, 4], [-46, 12], [-43, 24], [-43, -24], [-40, 0]], blue: [[46, -12], [46, -4], [46, 4], [46, 12], [43, 24], [43, -24], [40, 0]] },
});
dress(MAPS[3], [barrel(-20, -2, '#ffb02e'), barrel(20, 2, '#e8574f'), barrel(-2, 28), barrel(2, -28, '#3f7cb5'), car(-24, 20, 0, '#ff8fb8'), car(24, -20, 0, '#9be7c4'), car(-42, -8, 0, '#ffd27a'), car(42, 8, 0, '#b8a4ff')]);

// 가운데 단 계단 (젤리 공장): 단 양 끝(x=±7)에서 바깥으로 0.5m 씩 내려간다 (2.0 · 1.5 · 1.0 · 0.5)
for (const s of [-1, 1]) MAPS[2].boxes.push(...[0, 1, 2, 3].map((i) => B(s * (7.5 + i), 0, 1, 3, 2.5 - 0.5 * (i + 1), 'step')));

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

// ---------- 판정 (서버 · 화면 같이) ----------
// 상자가 많은 맵(젤리배그)도 빠르게: 12m 격자에 상자를 나눠 담고, 필요한 칸만 본다
const CELL = 12;
function gridOf(map) {
  if (map._grid) return map._grid;
  const cells = new Map();
  map.boxes.forEach((b, i) => {
    const x0 = Math.floor((b.x - b.w / 2) / CELL), x1 = Math.floor((b.x + b.w / 2) / CELL), z0 = Math.floor((b.z - b.d / 2) / CELL), z1 = Math.floor((b.z + b.d / 2) / CELL);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x * 4096 + z; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); }
  });
  return (map._grid = { cells, stamp: new Uint32Array(map.boxes.length), mark: 0 });
}
// 사각 범위 [x0, z0] ~ [x1, z1] 에 걸친 상자들
export function boxesIn(map, x0, z0, x1, z1) {
  if (map.boxes.length < 120) return map.boxes;
  const g = gridOf(map), out = [];
  g.mark = (g.mark + 1) >>> 0 || 1;
  const cx0 = Math.floor(Math.min(x0, x1) / CELL), cx1 = Math.floor(Math.max(x0, x1) / CELL), cz0 = Math.floor(Math.min(z0, z1) / CELL), cz1 = Math.floor(Math.max(z0, z1) / CELL);
  for (let x = cx0; x <= cx1; x++) for (let z = cz0; z <= cz1; z++) {
    const L = g.cells.get(x * 4096 + z); if (!L) continue;
    for (const i of L) if (g.stamp[i] !== g.mark) { g.stamp[i] = g.mark; out.push(map.boxes[i]); }
  }
  return out;
}

// 반직선 o + d·t 가 상자들과 처음 만나는 t (없으면 max)
export function rayBoxes(map, o, d, max) {
  let best = max;
  const ex = Math.min(max, 400), list = boxesIn(map, o.x, o.z, o.x + d.x * ex, o.z + d.z * ex);
  for (const b of list) {
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
  for (const b of boxesIn(map, x - 1, z - 1, x + 1, z + 1)) {
    if (x < b.x - b.w / 2 - r || x > b.x + b.w / 2 + r || z < b.z - b.d / 2 - r || z > b.z + b.d / 2 + r) continue;
    const t = b.y + b.h;
    if (t <= y + 0.55 && t > top) top = t;
  }
  return top;
}
