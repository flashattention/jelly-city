// 젤리워치 맵: 점령전(공격팀이 A → B 거점을 차례로 점령) · 쟁탈전(가운데 거점을 먼저 100% 차지)
//   상자 도구는 젤리어택 maps.js 를 같이 쓴다. 판마다 새로 만든다 (출발 문이 열리면 상자가 빠지니까)
import { B, walls, crates, building, stairs } from '../../jelly-attack/js/maps.js';

const COLORS = {
  floor: '#d9c7b0', roofslab: '#8a6f5a', outer: '#a99ab8', wall: '#e8d7c3', step: '#c9b8a6', crate: '#c8925a', low: '#c7b9a8', gate: '#7cd8ff',
  house1: '#ffd0dc', house2: '#cfe6ff', house3: '#fff0b8', shop: '#ffe2c4', temple: '#f2d79b', gold: '#e8b84a', plaza: '#e7d3f0', pillar: '#fff4e0', roof: '#b86a7a',
};

// 공통: 출발 방 (spawn: { x0, x1, z0, z1 } 안이면 빠르게 회복 · 영웅 바꾸기)
function jellymura() {
  const boxes = [
    ...walls(72, 124, 9),
    // 공격팀 출발 방 (문은 준비 시간 동안 닫힌다)
    B(-21, 46, 30, 1, 6, 'wall'), B(21, 46, 30, 1, 6, 'wall'), { ...B(0, 46, 12, 1, 6, 'gate'), gate: 'atk', hide: true },
    // 첫 마당: 양옆 집 · 낮은 담 · 나무상자
    ...building(-25, 33, 12, 9, 'house1', { floors: 2, doors: 'NE', roof: 'flat' }), ...stairs(-31.5, 26.5, 0, 1, 6.4, 1.3),
    ...building(24, 34, 10, 8, 'house2', { doors: 'NW', roof: 'pitch' }),
    B(-8, 34, 6, 1, 1.2, 'low'), B(9, 30, 1, 6, 1.2, 'low'), ...crates([[4, 38, 2], [-14, 28], [15, 26, 2], [-3, 24]]),
    // 첫 관문 (z = 20): 가운데 큰 문 + 양옆 쪽문
    B(-14, 20, 16, 1.4, 7, 'temple'), B(14, 20, 16, 1.4, 7, 'temple'), B(0, 20, 12, 1.4, 2.6, 'temple', 4.4),
    B(-30.5, 20, 11, 1.4, 7, 'temple'), B(30.5, 20, 11, 1.4, 7, 'temple'),
    // A 거점 마당: 기둥 넷 · 왼쪽 2층 건물(발코니) · 오른쪽 높은 단
    B(-6.5, -2.5, 1.4, 1.4, 4.5, 'pillar'), B(6.5, -2.5, 1.4, 1.4, 4.5, 'pillar'), B(-6.5, 10.5, 1.4, 1.4, 4.5, 'pillar'), B(6.5, 10.5, 1.4, 1.4, 4.5, 'pillar'),
    ...building(-25, 4, 12, 14, 'shop', { floors: 2, doors: 'NES', roof: 'flat' }),
    B(25, 2, 14, 16, 3, 'temple'), ...stairs(14.4, 8, 1, 0, 3, 1.6), ...stairs(14.4, -4, 1, 0, 3, 1.6),
    B(19, 2, 1, 6, 1, 'low', 3), ...crates([[-11, 14], [11, -6, 2], [-12, -8], [3, 14]]),
    // 두 번째 관문 (z = -14)
    B(-24, -14, 12, 1.4, 7, 'temple'), B(-1, -14, 13, 1.4, 7, 'temple'), B(22, -14, 14, 1.4, 7, 'temple'),
    // B 거점: 높은 사원 단 (계단 셋) · 금빛 기둥 · 단 위 낮은 담
    B(0, -35, 24, 14, 1.2, 'temple'), ...stairs(-2, -26.6, 0, -1, 1.2, 4), ...stairs(-13.6, -35, 1, 0, 1.2, 3), ...stairs(13.6, -35, -1, 0, 1.2, 3),
    B(-10.5, -29.5, 1.3, 1.3, 5, 'gold', 1.2), B(10.5, -29.5, 1.3, 1.3, 5, 'gold', 1.2), B(-10.5, -40.5, 1.3, 1.3, 5, 'gold', 1.2), B(10.5, -40.5, 1.3, 1.3, 5, 'gold', 1.2),
    B(0, -41.2, 10, 1, 1.3, 'low', 1.2), B(-5, -32, 1, 3, 1.1, 'low', 1.2), B(5, -38, 1, 3, 1.1, 'low', 1.2),
    ...building(-26, -32, 10, 12, 'house3', { floors: 2, doors: 'ENS', roof: 'flat' }), ...building(26, -30, 10, 10, 'house1', { doors: 'WN', roof: 'pitch' }),
    ...crates([[-17, -22, 2], [17, -21], [8, -22], [-20, -44]]),
    // 수비팀 출발 방 (문 둘)
    B(-27, -50, 18, 1, 6, 'wall'), B(0, -50, 24, 1, 6, 'wall'), B(27, -50, 18, 1, 6, 'wall'),
  ];
  return {
    id: 'jellymura', name: '젤리무라', emoji: '🌸', mode: 'assault', W: 72, D: 124,
    sky: ['#9cc4ff', '#ffe1ec', '#f3c8d8'], fog: [50, 190], floor: '#e8d2c2', floor2: '#d9bfae', colors: COLORS, boxes,
    points: [{ id: 'A', x: 0, z: 4, y: 0, r: 5.5 }, { id: 'B', x: 0, z: -35, y: 1.2, r: 5.5 }],
    spawns: {
      atk: [[-10, 54], [-4, 56], [4, 56], [10, 54], [-14, 57], [14, 57]],
      atk2: [[-24, 24], [-20, 26], [20, 26], [24, 24], [-27, 27], [27, 27]], // A 를 뺏으면 앞으로
      def: [[-16, -56], [-6, -57], [6, -57], [16, -56], [-24, -57], [24, -57]],
    },
    rooms: { atk: { x0: -36, x1: 36, z0: 46.5, z1: 62 }, atk2: { x0: -36, x1: 36, z0: 21, z1: 30 }, def: { x0: -36, x1: 36, z0: -62, z1: -50.5 } },
    deco: [
      { t: 'tree', x: -32, z: 50, c: '#ffb3d1' }, { t: 'tree', x: 32, z: 50, c: '#ffb3d1' }, { t: 'tree', x: -31, z: 12, c: '#ffc8de' }, { t: 'tree', x: 31, z: 14, c: '#ffc8de' },
      { t: 'tree', x: -31, z: -20, c: '#ffb3d1' }, { t: 'tree', x: 31, z: -20, c: '#ffb3d1' }, { t: 'tree', x: 14, z: 40, c: '#ffd6e6' }, { t: 'tree', x: -15, z: -45, c: '#ffd6e6' },
      { t: 'lamp', x: -4, z: 22, light: true }, { t: 'lamp', x: 4, z: -16, light: true }, { t: 'lamp', x: 12, z: 32 }, { t: 'lamp', x: -12, z: -24 },
      { t: 'flags', x: -14, z: 20.8, x2: 14, z2: 20.8, h: 7.4 }, { t: 'flags', x: -12, z: -13.2, x2: 10, z2: -13.2, h: 7.4 }, { t: 'flags', x: -10, z: -29.5, x2: 10, z2: -29.5, h: 6.4 },
      { t: 'jelly', x: -18, z: 40, c: '#ff9ec7', s: 1.2 }, { t: 'jelly', x: 20, z: -6, c: '#9be7c4' }, { t: 'jelly', x: -18, z: -6, c: '#b8a4ff' }, { t: 'flowers', x: 0, z: 30 }, { t: 'flowers', x: -8, z: -20 },
      { t: 'bench', x: 8, z: 22 }, { t: 'bush', x: -33, z: 0 }, { t: 'bush', x: 33, z: -40 }, { t: 'umbrella', x: -10, z: 40, c: '#ff8fb8' },
      { t: 'sign', x: 0, z: 58, text: '공격팀 출발', c: '#ff5a7a' }, { t: 'sign', x: 0, z: -58, text: '수비팀 출발', c: '#4cc3ff', r: Math.PI },
    ],
    roads: [{ x: 0, z: 4, w: 10, d: 120, c: '#efe0cf' }],
  };
}

function jellyos() {
  const boxes = [
    ...walls(96, 92, 9),
    // 출발 방: 딸기팀 서쪽 · 소다팀 동쪽
    B(-37, -26, 1, 40, 6, 'wall'), B(-37, 26, 1, 40, 6, 'wall'), { ...B(-37, 0, 1, 12, 6, 'gate'), gate: 'all', hide: true },
    B(37, -26, 1, 40, 6, 'wall'), B(37, 26, 1, 40, 6, 'wall'), { ...B(37, 0, 1, 12, 6, 'gate'), gate: 'all', hide: true },
    // 가운데 광장 (한 칸 높은 단 + 계단 넷)
    B(0, 0, 18, 18, 0.9, 'plaza'), ...stairs(0, 10.4, 0, -1, 0.9, 5), ...stairs(0, -10.4, 0, 1, 0.9, 5), ...stairs(-10.4, 0, 1, 0, 0.9, 5), ...stairs(10.4, 0, -1, 0, 0.9, 5),
    B(-7.5, -7.5, 1.4, 1.4, 4, 'pillar', 0.9), B(7.5, 7.5, 1.4, 1.4, 4, 'pillar', 0.9), B(-7.5, 7.5, 1.4, 1.4, 4, 'pillar', 0.9), B(7.5, -7.5, 1.4, 1.4, 4, 'pillar', 0.9),
    B(0, -4, 4, 1, 1.2, 'low', 0.9), B(0, 4, 4, 1, 1.2, 'low', 0.9),
    // 북서 · 남동 2층 건물 (서로 마주 보는 같은 모양)
    ...building(-20, -24, 14, 10, 'house1', { floors: 2, doors: 'SEW', roof: 'flat' }), ...building(20, 24, 14, 10, 'house1', { floors: 2, doors: 'NEW', roof: 'flat' }),
    // 북동 · 남서 집 + 높은 단
    ...building(22, -26, 10, 9, 'house2', { doors: 'SW', roof: 'pitch' }), ...building(-22, 26, 10, 9, 'house2', { doors: 'NE', roof: 'pitch' }),
    B(-22, 12, 8, 6, 2.6, 'shop'), ...stairs(-22, 17.6, 0, -1, 2.6, 2), B(22, -12, 8, 6, 2.6, 'shop'), ...stairs(22, -17.6, 0, 1, 2.6, 2),
    // 골목 담 · 상자
    B(-12, -38, 1, 10, 3, 'wall'), B(12, 38, 1, 10, 3, 'wall'), B(-30, -10, 6, 1, 1.2, 'low'), B(30, 10, 6, 1, 1.2, 'low'), B(-30, 40, 6, 1, 1.2, 'low'), B(30, -40, 6, 1, 1.2, 'low'),
    ...crates([[-14, 6], [14, -6], [-16, -12, 2], [16, 12, 2], [-4, 20], [4, -20], [-28, 2], [28, -2], [6, 30], [-6, -30]]),
  ];
  return {
    id: 'jellyos', name: '젤리오스', emoji: '🏛️', mode: 'control', W: 96, D: 92,
    sky: ['#7fc4ff', '#ffe9c4', '#ffd2a3'], fog: [60, 210], floor: '#f0dcc0', floor2: '#e2c8a6', colors: COLORS, boxes,
    points: [{ id: 'C', x: 0, z: 0, y: 0.9, r: 6.5 }],
    spawns: {
      red: [[-43, -8], [-43, 0], [-43, 8], [-40, -4], [-40, 4], [-41, 12]],
      blue: [[43, 8], [43, 0], [43, -8], [40, 4], [40, -4], [41, -12]],
    },
    rooms: { red: { x0: -48, x1: -37.5, z0: -46, z1: 46 }, blue: { x0: 37.5, x1: 48, z0: -46, z1: 46 } },
    deco: [
      { t: 'palm', x: -30, z: -30 }, { t: 'palm', x: 30, z: 30 }, { t: 'palm', x: -32, z: 34 }, { t: 'palm', x: 32, z: -34 }, { t: 'palm', x: 0, z: 40 }, { t: 'palm', x: 0, z: -40 },
      { t: 'umbrella', x: -10, z: 18, c: '#7cd8ff' }, { t: 'umbrella', x: 10, z: -18, c: '#ff8fb8' }, { t: 'umbrella', x: 30, z: 20, c: '#ffd84d' }, { t: 'umbrella', x: -30, z: -20, c: '#9be7c4' },
      { t: 'flags', x: -9, z: -9, x2: 9, z2: 9, h: 6 }, { t: 'flags', x: -9, z: 9, x2: 9, z2: -9, h: 6.4 },
      { t: 'lamp', x: -12, z: 12, light: true }, { t: 'lamp', x: 12, z: -12, light: true }, { t: 'lamp', x: -34, z: -40 }, { t: 'lamp', x: 34, z: 40 },
      { t: 'jelly', x: -30, z: 28, c: '#ffb3d1', s: 1.3 }, { t: 'jelly', x: 30, z: -28, c: '#9be7c4', s: 1.3 }, { t: 'flowers', x: -18, z: 2 }, { t: 'flowers', x: 18, z: -2 },
      { t: 'rock', x: -40, z: -42, s: 1.4 }, { t: 'rock', x: 40, z: 42, s: 1.4 }, { t: 'bench', x: -6, z: 26 }, { t: 'bench', x: 6, z: -26, r: Math.PI },
      { t: 'sign', x: -44, z: 20, text: '딸기팀', c: '#ff5a7a', r: Math.PI / 2 }, { t: 'sign', x: 44, z: -20, text: '소다팀', c: '#4cc3ff', r: -Math.PI / 2 },
    ],
    roads: [{ x: 0, z: 0, w: 90, d: 8, c: '#f6e6cf' }, { x: 0, z: 0, w: 8, d: 86, c: '#f6e6cf' }],
  };
}

export const WMAPS = [
  { id: 'jellymura', name: '젤리무라', emoji: '🌸', mode: 'assault', make: jellymura, desc: '점령전 · 공격팀은 A → B 거점을 차례로 점령!' },
  { id: 'jellyos', name: '젤리오스', emoji: '🏛️', mode: 'control', make: jellyos, desc: '쟁탈전 · 가운데 거점을 먼저 100% 차지하면 승리' },
];
export const wmapById = (id) => WMAPS.find((m) => m.id === id) || WMAPS[0];
export const makeMap = (id) => wmapById(id).make();
// 출발 문 열기 (상자에서 빼고 격자를 다시)
export function openGates(map) { map.boxes = map.boxes.filter((b) => !b.gate); delete map._grid; }
export const inRoom = (rm, x, z) => rm && x > rm.x0 && x < rm.x1 && z > rm.z0 && z < rm.z1;
