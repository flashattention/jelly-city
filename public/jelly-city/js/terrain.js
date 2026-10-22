// 도시 바깥의 넓은 세상: 지형 높이, 지역(바이옴), 도로, 대교, 표지판 (서버·브라우저 공용)
import { HALF } from './config.js';

export const WORLD_HALF = 1150;   // 전체 세계 반지름 (도시는 가운데 ±223)
export const WATER_Y = -1.2;      // 바다·강·늪 수면 높이
export const BRIDGE = { x0: 330, x1: 800, z: 0, w: 14, y: 7, ramp: 60 }; // 젤리 대교 (동쪽 바다 위)

// 지역: rect = [x0, z0, x1, z1]
export const REGIONS = [
  { id: 'valley', name: '말랑 계곡', emoji: '🏞️', rect: [-90, -1150, 110, -260], color: '#7cb87a' },
  { id: 'mountain', name: '젤리산', emoji: '🏔️', rect: [-330, -1150, 330, -260], color: '#9e9e8e' },
  { id: 'forest', name: '야생의 숲', emoji: '🌲', rect: [-1150, -1150, -280, -150], color: '#3f7f3a' },
  { id: 'park', name: '젤리랜드 놀이공원', emoji: '🎢', rect: [-1070, -50, -790, 210], color: '#e0d6cc' },
  { id: 'meadow', name: '사냥꾼 들판', emoji: '🦌', rect: [-1150, -150, -280, 260], color: '#9ccc65' },
  { id: 'swamp', name: '악어 늪지대', emoji: '🐊', rect: [-1150, 260, -280, 1150], color: '#5d7a4a' },
  { id: 'jungle', name: '호랑이 정글', emoji: '🐯', rect: [-280, 280, 330, 680], color: '#2e7d32' },
  { id: 'amazon', name: '아마존', emoji: '🐍', rect: [-280, 680, 330, 1150], color: '#1b5e20' },
  { id: 'sea', name: '젤리 해협', emoji: '🌊', rect: [330, -1150, 800, 1150], color: '#4fa3d9' },
  { id: 'dragon', name: '드래곤 협곡', emoji: '🐉', rect: [800, -1150, 1150, -460], color: '#b5603a' },
  { id: 'island', name: '건너편 섬 · 목장 마을', emoji: '🐄', rect: [800, -1150, 1150, 1150], color: '#aed581' },
];
export function regionAt(x, z) {
  if (Math.abs(x) < HALF + 20 && Math.abs(z) < HALF + 20) return null;
  // 계곡이 산보다 먼저
  for (const r of REGIONS) {
    const [x0, z0, x1, z1] = r.rect;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return r;
  }
  return null;
}

// 도시 밖 건물들 (도시 격자와 따로 배치 → 기존 건물 번호는 그대로)
export const OUTER_BUILDINGS = [
  { type: 'prison', x: -400, z: 75, dir: -1, w: 44, d: 32, floors: 2, name: '젤리 교도소' },
  { type: 'hunter', x: -520, z: -34, dir: 1, w: 15, d: 11, floors: 1, name: '사냥꾼 오두막' },
  { type: 'convenience', x: -440, z: -30, dir: 1, w: 13, d: 11, floors: 1, name: '서쪽 휴게소 편의점' },
  { type: 'convenience', x: 34, z: -470, dir: 1, w: 13, d: 11, floors: 1, name: '계곡 휴게소 편의점' },
  { type: 'convenience', x: -34, z: 480, dir: -1, w: 13, d: 11, floors: 1, name: '정글 휴게소 편의점' },
  { type: 'convenience', x: 280, z: 30, dir: -1, w: 13, d: 11, floors: 1, name: '대교 휴게소 편의점' },
  { type: 'convenience', x: 1030, z: -70, dir: 1, w: 13, d: 11, floors: 1, name: '섬마을 편의점' },
  { type: 'ranch', x: 1045, z: 130, dir: -1, w: 22, d: 16, floors: 1, name: '젤리 목장 직판장' },
  { type: 'hunter', x: -720, z: 300, dir: 1, w: 15, d: 11, floors: 1, name: '늪지대 사냥 캠프' },
  { type: 'fishing', x: 282, z: 122, dir: -1, w: 14, d: 11, floors: 1, name: '대박 낚시용품점' },
  { type: 'seafood', x: 252, z: 122, dir: -1, w: 16, d: 12, floors: 1, name: '바다향 매운탕·횟집' },
  { type: 'fishing', x: 80, z: -250, dir: -1, w: 12, d: 10, floors: 1, name: '호숫가 낚시가게' },
];
// 젤리랜드 놀이공원 (사냥꾼 들판 동쪽): 평평하게 다진 터
export const PARK = { x0: -1070, z0: -50, x1: -790, z1: 210, y: 0.3 };
// 젤리 낚시터: 바다로 뻗은 나무 잔교
export const PIER = { x0: 300, x1: 380, z0: 88, z1: 95, y: 1.4 };
export const onPier = (x, z) => x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1;
const PADS = OUTER_BUILDINGS.map((b) => ({ x: b.x, z: b.z, r: Math.max(b.w, b.d) / 2 + 12 }));

// 도로 (도시 중앙 도로가 사방으로 이어진다)
export const ROADS = [
  { id: 'N', pts: [[0, -HALF], [0, -560], [30, -760], [10, -1120]], name: '북쪽 산악도로' },
  { id: 'S', pts: [[0, HALF], [0, 520], [-40, 760], [20, 1120]], name: '남쪽 정글도로' },
  { id: 'W', pts: [[-HALF, 0], [-560, 0], [-700, -260], [-900, -700]], name: '서쪽 숲길' },
  { id: 'W2', pts: [[-560, 0], [-720, 380], [-950, 820]], name: '늪지대 길' },
  { id: 'P', pts: [[-560, 0], [-680, 40], [-785, 75]], name: '놀이공원길' },
  { id: 'E', pts: [[HALF, 0], [BRIDGE.x0 - BRIDGE.ramp, 0], [BRIDGE.x1 + BRIDGE.ramp, 0], [1000, 0], [1000, -400]], name: '젤리 대교' },
  { id: 'E2', pts: [[1000, 0], [1000, 420]], name: '섬 남쪽길' },
  { id: 'D', pts: [[1000, -400], [985, -560], [1010, -760], [975, -960]], name: '드래곤 협곡길' },
];
// 강 (지형을 수면 아래로 판다)
const RIVERS = [
  { pts: [[60, -1150], [70, -800], [40, -560], [55, -330]], w: 14 }, // 계곡 강 → 이슬 호수
  { pts: [[-280, 900], [0, 880], [200, 940], [330, 900]], w: 34 },   // 아마존 강
  { pts: [[-280, 420], [-80, 460], [80, 430]], w: 10 },               // 정글 개울
];
export const LAKES = [{ x: 55, z: -310, r: 45 }, { x: -600, z: 560, r: 70 }, { x: -900, z: 900, r: 90 }, { x: -760, z: -480, r: 40 }];

// ---------- 노이즈 ----------
function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, oct = 4) {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * amp; n += amp; amp *= 0.5; f *= 2; }
  return s / n;
}
const smooth = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };

// 점과 꺾은선 사이 거리
export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

// 지형 높이 (도시 안은 0)
export function terrainH(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax < HALF + 12 && az < HALF + 12) return 0;
  const cityFade = smooth(HALF + 12, HALF + 120, Math.max(ax, az)); // 도시 근처는 평평
  let h = (fbm(x * 0.004, z * 0.004) - 0.5) * 14;
  const r = regionAt(x, z);
  const id = r?.id;
  if (id === 'mountain' || (z < -420 && id !== 'valley' && id !== 'forest' && x < 330)) {
    const k = smooth(-420, -800, z);
    h += k * (fbm(x * 0.006 + 7, z * 0.006 + 3, 5) * 160 - 20) + k * 25;
  } else if (id === 'valley') {
    const edge = Math.min(x - (-90), 110 - x); // 계곡 가장자리로 갈수록 높아진다
    const k = smooth(-420, -800, z);
    h = h * 0.4 + k * smooth(10, 90, 90 - edge) * 70;
  } else if (id === 'forest') h += fbm(x * 0.01, z * 0.01) * 18;
  else if (id === 'meadow') h *= 0.5;
  else if (id === 'swamp') h = (fbm(x * 0.02, z * 0.02) - 0.62) * 4.5;
  else if (id === 'jungle') h += fbm(x * 0.012 + 5, z * 0.012) * 16;
  else if (id === 'amazon') h = h * 0.5 + fbm(x * 0.015, z * 0.015) * 6 - 1;
  else if (id === 'island') h = Math.abs(h) * 0.6 + 3 + smooth(800, 860, x) * 0;
  else if (id === 'dragon') {
    // 붉은 바위 협곡: 층층이 깎인 높은 메사 사이로 깊은 골짜기
    const n = fbm(x * 0.009 + 11, z * 0.009 - 4, 4);
    const k = smooth(-460, -540, z);
    h = 3 + k * (smooth(0.46, 0.52, n) * 26 + smooth(0.58, 0.62, n) * 18 + smooth(0.68, 0.71, n) * 14) + (fbm(x * 0.05, z * 0.05) - 0.5) * 2;
  }
  if (id === 'sea' || (x > 330 && x < 800)) {
    // 바다: 양쪽 해안에서 깊어진다
    const coast = Math.min(x - 330, 800 - x);
    h = Math.min(h, 2 - smooth(0, 60, coast) * 14);
  }
  // 섬 해안
  if (x >= 800) h = Math.min(h, -12 + smooth(800, 840, x) * 15 + Math.abs(h) * 0.3 + (id === 'dragon' ? smooth(840, 880, x) * 200 : 0));
  // 세계 끝은 바다
  const edge = Math.max(ax, az);
  h -= smooth(WORLD_HALF - 120, WORLD_HALF, edge) * 25;
  // 강과 호수
  for (const rv of RIVERS) {
    const d = distToPolyline(x, z, rv.pts);
    if (d < rv.w * 2.5) h = Math.min(h, h * smooth(rv.w * 0.6, rv.w * 2.5, d) + (WATER_Y - 2.5) * (1 - smooth(rv.w * 0.6, rv.w * 2.5, d)));
  }
  for (const lk of LAKES) {
    const d = Math.hypot(x - lk.x, z - lk.z);
    if (d < lk.r * 1.6) h = Math.min(h, h * smooth(lk.r * 0.7, lk.r * 1.6, d) + (WATER_Y - 3) * (1 - smooth(lk.r * 0.7, lk.r * 1.6, d)));
  }
  h *= cityFade;
  // 놀이공원 터는 평평하게
  { const dx = Math.max(PARK.x0 - x, 0, x - PARK.x1), dz = Math.max(PARK.z0 - z, 0, z - PARK.z1), d = Math.hypot(dx, dz);
    if (d < 40) h = PARK.y + (h - PARK.y) * smooth(0, 40, d); }
  // 건물 터는 평평하게
  for (const p of PADS) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 25) h = 0.15 + (h - 0.15) * smooth(p.r, p.r + 25, d); }
  // 도로는 평평하게 (주변보다 살짝 높게)
  for (const rd of ROADS) {
    if (rd.id === 'E' && x > BRIDGE.x0 - 5 && x < BRIDGE.x1 + 5) continue; // 다리 밑은 바다 그대로
    const d = distToPolyline(x, z, rd.pts);
    if (d < 40) { const roadH = roadHeight(x, z); h = roadH + (h - roadH) * smooth(7, 40, d); }
  }
  return h;
}

// 도로 높이: 도시 근처 0, 산길은 완만하게 올라감, 대교 위는 다리 높이
export function roadHeight(x, z) {
  if (x > 800 && z < -440) return 3; // 드래곤 협곡 바닥길
  if (Math.abs(z) < BRIDGE.w && x > BRIDGE.x0 - BRIDGE.ramp && x < BRIDGE.x1 + BRIDGE.ramp) return bridgeDeck(x);
  if (z < -560) return Math.max(0, (-560 - z) * 0.05);
  return 0.15;
}
export function bridgeDeck(x) {
  const { x0, x1, ramp, y } = BRIDGE;
  if (x < x0) return 0.15 + (y - 0.15) * smooth(x0 - ramp, x0, x);
  if (x > x1) return 0.15 + (y - 0.15) * (1 - smooth(x1, x1 + ramp, x));
  return y;
}
export const onBridge = (x, z) => Math.abs(z - BRIDGE.z) < BRIDGE.w / 2 && x > BRIDGE.x0 - BRIDGE.ramp && x < BRIDGE.x1 + BRIDGE.ramp;

// 높이 격자 (브라우저: 지형 메쉬와 바닥 판정이 똑같도록)
export const GRID_STEP = 10;
export function buildHeightGrid() {
  const n = Math.round((WORLD_HALF * 2) / GRID_STEP) + 1;
  const hs = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) hs[j * n + i] = terrainH(-WORLD_HALF + i * GRID_STEP, -WORLD_HALF + j * GRID_STEP);
  return { n, hs };
}
export function sampleGrid(grid, x, z) {
  const fx = (x + WORLD_HALF) / GRID_STEP, fz = (z + WORLD_HALF) / GRID_STEP;
  const i = Math.max(0, Math.min(grid.n - 2, Math.floor(fx))), j = Math.max(0, Math.min(grid.n - 2, Math.floor(fz)));
  const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fz - j));
  const h = grid.hs, n = grid.n;
  // PlaneGeometry와 같은 삼각형 분할
  const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}

// 길 안내 표지판: [x, z, 바라보는 방향(rad), 줄들]
export function roadSigns() {
  const S = [];
  const label = (id) => REGIONS.find((r) => r.id === id);
  const line = (id, d) => { const r = label(id); return `${r.emoji} ${r.name} ${d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d / 10) * 10 + 'm'}`; };
  // 도시 출구
  S.push([12, -HALF - 25, 0, [line('valley', 60), line('mountain', 260), '🏞️ 이슬 호수 90m']]);
  S.push([-12, HALF + 25, Math.PI, [line('jungle', 80), line('amazon', 470)]]);
  S.push([-HALF - 25, -12, -Math.PI / 2, [line('meadow', 80), line('forest', 300), line('swamp', 600), '🔒 젤리 교도소 200m']]);
  S.push([HALF + 25, 12, Math.PI / 2, ['🌉 젤리 대교 ' + (BRIDGE.x0 - BRIDGE.ramp - HALF) + 'm', line('island', 600)]]);
  // 길 중간
  S.push([12, -600, 0, [line('mountain', 0), '🏔️ 정상 방향 ↑']]);
  S.push([-12, 600, Math.PI, [line('amazon', 100), '🐯 호랑이 주의!']]);
  S.push([-560, 14, -Math.PI / 2, [line('forest', 260), line('swamp', 280) + ' ↙']]);
  S.push([-700, 330, Math.PI, ['🐊 악어 출몰 지역! 조심하세요', line('swamp', 0)]]);
  S.push([-575, 16, -Math.PI / 2, ['🎢 젤리랜드 놀이공원 220m ↙', '롤러코스터 · 바이킹 · 관람차 · 회전목마']]);
  S.push([BRIDGE.x0 - BRIDGE.ramp - 20, 12, Math.PI / 2, ['🌉 젤리 대교 · 길이 470m', '🐄 목장 마을까지 ' + (1000 - (BRIDGE.x0 - BRIDGE.ramp)) + 'm']]);
  S.push([1015, -12, Math.PI / 2, ['🐄 목장 ↑ 북쪽', '🐉 드래곤 협곡 ↑ 460m', '🏖️ 남쪽 해변 ↓']]);
  S.push([1015, -430, 0, ['🐉 드래곤 협곡 ↑', '🔥 불 뿜는 드래곤 주의!', '체력을 절반 깎으면 Z로 포획']]);
  S.push([HALF + 40, 30, Math.PI / 2, ['🎣 젤리 낚시터 · 매운탕집 →', '🐟 상어·참치·돌돔이 잡혀요!']]);
  S.push([60, -HALF - 40, 0, ['🎣 이슬 호수 낚시터 ↑', '🐟 송어·쏘가리·빙어']]);
  return S;
}
