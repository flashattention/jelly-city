// 젤리수호대 맵: 점령전(공격팀이 A → B 거점을 차례로 점령) · 쟁탈전(가운데 거점을 먼저 100% 차지)
//   상자 도구는 젤리택티컬 maps.js 를 같이 쓴다. 판마다 새로 만든다 (출발 문이 열리면 상자가 빠지니까)
import { B, walls, crates, building, stairs } from '../../jelly-tactical/js/maps.js';

const COLORS = {
  floor: '#d9c7b0', roofslab: '#8a6f5a', outer: '#a99ab8', wall: '#e8d7c3', step: '#c9b8a6', crate: '#c8925a', low: '#c7b9a8', gate: '#7cd8ff',
  house1: '#ffd0dc', house2: '#cfe6ff', house3: '#fff0b8', shop: '#ffe2c4', temple: '#f2d79b', gold: '#e8b84a', plaza: '#e7d3f0', pillar: '#fff4e0', roof: '#b86a7a',
  castle: '#e9c48f', choco: '#8a5634', hedge: '#7fc47a', ware: '#d7c3a5', cont1: '#ff7aa8', cont2: '#6cc4ff', cont3: '#ffd06b', dock: '#b08560', brick: '#c98a6a',
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
    id: 'jellymura', name: '벚꽃 젤리 마을', emoji: '🌸', mode: 'assault', W: 72, D: 124,
    sky: ['#9cc4ff', '#ffe1ec', '#f3c8d8'], fog: [50, 190], floor: '#e8d2c2', floor2: '#d9bfae', colors: COLORS, boxes,
    points: [{ id: 'A', x: 0, z: 4, y: 0, r: 5.5 }, { id: 'B', x: 0, z: -35, y: 1.2, r: 5.5 }],
    spawns: {
      atk: [[-10, 54], [-4, 56], [4, 56], [10, 54], [-14, 57], [14, 57]],
      atk2: [[-24, 24], [-20, 26], [20, 26], [24, 24], [-27, 27], [27, 27]], // A 를 뺏으면 앞으로
      def: [[-16, -56], [-6, -57], [6, -57], [16, -56], [-24, -57], [24, -57]],
      def1: [[-28, -30], [-24, -34], [-28, -35], [24, -28], [28, -31], [24, -32]], // A 를 지킬 때는 B 옆 집에서 (앞쪽 출발)
    },
    rooms: { atk: { x0: -36, x1: 36, z0: 46.5, z1: 62 }, atk2: { x0: -36, x1: 36, z0: 21, z1: 30 }, def: { x0: -36, x1: 36, z0: -62, z1: -50.5 }, def1: { x0: -31, x1: -21, z0: -38, z1: -26, x2: 21, x3: 31, z2: -35, z3: -25 } },
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
    id: 'jellyos', name: '레몬 신전', emoji: '🏛️', mode: 'control', W: 96, D: 92,
    sky: ['#7fc4ff', '#ffe9c4', '#ffd2a3'], fog: [60, 210], floor: '#f0dcc0', floor2: '#e2c8a6', colors: COLORS, boxes: symmetric(boxes),
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


// 🍪 쿠키 성 (점령전): 성 밖 마을 → 성문 마당 A → 안쪽 성벽 → 왕좌의 방 B · 성벽 위를 걸을 수 있다
function cookieKeep() {
  const boxes = [
    ...walls(76, 128, 10),
    // 공격팀 출발 방
    B(-22, 48, 32, 1, 6, 'wall'), B(22, 48, 32, 1, 6, 'wall'), { ...B(0, 48, 12, 1, 6, 'gate'), gate: 'atk', hide: true },
    // 성 밖 마을: 집 · 울타리 · 수레
    ...building(-26, 36, 11, 8, 'house3', { doors: 'NE', roof: 'pitch' }), ...building(26, 37, 10, 8, 'house1', { floors: 2, doors: 'NW', roof: 'flat' }), ...stairs(31.4, 30.5, 0, 1, 6.4, 1.3),
    B(-10, 32, 6, 1, 1.1, 'hedge'), B(10, 30, 6, 1, 1.1, 'hedge'), B(-4, 40, 1, 5, 1.1, 'hedge'), ...crates([[8, 40, 2], [-14, 28], [16, 26], [-2, 26]]),
    // 바깥 성벽 (z = 22): 가운데 성문 + 양쪽 탑 + 성벽 위 길 (계단으로 올라간다)
    B(-23, 22, 30, 2, 8, 'castle'), B(23, 22, 30, 2, 8, 'castle'), B(0, 22, 10, 2, 3, 'castle', 5),
    B(-7, 22, 4, 4, 11, 'choco'), B(7, 22, 4, 4, 11, 'choco'), B(-36, 22, 4, 4, 11, 'choco'), B(36, 22, 4, 4, 11, 'choco'),
    ...stairs(-18, 27.4, 0, -1, 8, 1.6), ...stairs(18, 27.4, 0, -1, 8, 1.6),
    for8(-23), for8(23),
    // 성문 마당 (A): 우물 · 마구간 · 2층 병영 · 짐수레
    B(0, 9, 3, 3, 1.1, 'brick'), ...building(-24, 6, 12, 12, 'house2', { doors: 'ES', roof: 'pitch', inside: [[-3, -3]] }), ...building(24, 4, 12, 14, 'castle', { floors: 2, doors: 'NWS', roof: 'flat' }),
    B(-10, -2, 1.2, 1.2, 4, 'pillar'), B(10, -2, 1.2, 1.2, 4, 'pillar'), B(-10, 14, 1.2, 1.2, 4, 'pillar'), B(10, 14, 1.2, 1.2, 4, 'pillar'), ...crates([[-12, 2, 2], [12, 10], [5, -4], [-5, 16]]),
    // 안쪽 성벽 (z = -14): 문 셋
    B(-27, -14, 20, 2, 7, 'castle'), B(-6.5, -14, 13, 2, 7, 'castle'), B(13, -14, 14, 2, 7, 'castle'), B(31.5, -14, 7, 2, 7, 'castle'), B(-14.5, -14, 3, 2, 3, 'castle', 4.5), B(4.5, -14, 6, 2, 3, 'castle', 4.5),
    // 왕좌의 방 (B): 높은 단 + 기둥 + 왕좌 + 옆방
    B(0, -36, 26, 18, 1.2, 'castle'), ...stairs(0, -26.4, 0, -1, 1.2, 6), ...stairs(-13.6, -36, 1, 0, 1.2, 3), ...stairs(13.6, -36, -1, 0, 1.2, 3),
    ...[-9, -3, 3, 9].flatMap((x) => [B(x, -30, 1.3, 1.3, 6, 'pillar', 1.2), B(x, -42, 1.3, 1.3, 6, 'pillar', 1.2)]),
    B(0, -43.5, 4, 1.4, 2.6, 'gold', 1.2), B(0, -44.2, 2.4, 0.6, 4.2, 'gold', 1.2), B(-6, -38, 4, 1, 1.1, 'choco', 1.2), B(6, -34, 4, 1, 1.1, 'choco', 1.2),
    ...building(-27, -34, 10, 14, 'castle', { floors: 2, doors: 'ENS', roof: 'flat' }), ...building(27, -32, 10, 12, 'house2', { doors: 'WN', roof: 'pitch' }),
    ...crates([[-16, -22, 2], [17, -21], [-20, -46], [20, -46, 2]]),
    // 수비팀 출발 방
    B(-27, -52, 18, 1, 6, 'wall'), B(0, -52, 24, 1, 6, 'wall'), B(27, -52, 18, 1, 6, 'wall'),
  ];
  return {
    id: 'cookie', name: '쿠키 성', emoji: '🍪', mode: 'assault', W: 76, D: 128,
    sky: ['#8fb8ff', '#ffe8cc', '#e8c49a'], fog: [50, 190], floor: '#cbe3a6', floor2: '#b6d491', colors: COLORS, boxes,
    points: [{ id: 'A', x: 0, z: 4, y: 0, r: 6, cap: 38 }, { id: 'B', x: 0, z: -36, y: 1.2, r: 5.5, cap: 34 }],
    spawns: {
      atk: [[-10, 56], [-4, 58], [4, 58], [10, 56], [-16, 59], [16, 59]],
      atk2: [[-12, 28], [-6, 30], [6, 30], [12, 28], [0, 32], [-3, 34]],
      def: [[-16, -58], [-6, -59], [6, -59], [16, -58], [-24, -59], [24, -59]],
      def1: [[-29, -31], [-25, -35], [-29, -38], [25, -30], [29, -33], [25, -35]],
    },
    rooms: { atk: { x0: -38, x1: 38, z0: 48.5, z1: 64 }, atk2: { x0: -16, x1: 16, z0: 25, z1: 36 }, def: { x0: -38, x1: 38, z0: -64, z1: -52.5 }, def1: { x0: -32, x1: -22, z0: -41, z1: -27, x2: 22, x3: 32, z2: -38, z3: -26 } },
    deco: [
      { t: 'flags', x: -36, z: 22.5, x2: -7, z2: 22.5, h: 9.6 }, { t: 'flags', x: 7, z: 22.5, x2: 36, z2: 22.5, h: 9.6 }, { t: 'flags', x: -9, z: -30, x2: 9, z2: -30, h: 7.4 }, { t: 'flags', x: -9, z: -42, x2: 9, z2: -42, h: 7.4 },
      { t: 'tree', x: -33, z: 44, c: '#ff9ec7' }, { t: 'tree', x: 33, z: 44 }, { t: 'tree', x: -33, z: -6 }, { t: 'tree', x: 33, z: -20, c: '#ffd27a' }, { t: 'bush', x: -14, z: 36 }, { t: 'bush', x: 14, z: 34 },
      { t: 'lamp', x: -3, z: 26, light: true }, { t: 'lamp', x: 3, z: -17, light: true }, { t: 'lamp', x: -12, z: 8 }, { t: 'lamp', x: 12, z: -30, light: true },
      { t: 'jelly', x: 0, z: 9, c: '#7cd8ff', s: 0.8, y: 1.1 }, { t: 'flowers', x: -6, z: 34 }, { t: 'flowers', x: 6, z: -24 }, { t: 'bench', x: -8, z: 0 }, { t: 'barrel', x: 16, z: 18 }, { t: 'barrel', x: -16, z: -20 },
      { t: 'sign', x: 0, z: 60, text: '공격팀 출발', c: '#ff5a7a' }, { t: 'sign', x: 0, z: -60, text: '수비팀 출발', c: '#4cc3ff', r: Math.PI }, { t: 'sign', x: 12, z: 26, text: '쿠키 성', c: '#8a5634' },
    ],
    roads: [{ x: 0, z: 10, w: 10, d: 100, c: '#e8d7b0' }],
  };
}
// 성벽 위 길 끝 난간 (보기 좋게 · 앉으면 숨는다)
function for8(x) { return B(x, 21.2, 30, 0.4, 0.8, 'choco', 8); }

// 🍭 솜사탕 항구 (쟁탈전): 컨테이너 사이 부두 광장 · 2단 컨테이너 높은 곳 · 창고 2층
function cottonPort() {
  const stack = (x, z, w, d, k1, k2) => [B(x, z, w, d, 2.8, k1), B(x, z, w, d, 2.8, k2, 2.8)];
  const boxes = [
    ...walls(96, 92, 9),
    B(-37, -26, 1, 40, 6, 'wall'), B(-37, 26, 1, 40, 6, 'wall'), { ...B(-37, 0, 1, 12, 6, 'gate'), gate: 'all', hide: true },
    B(37, -26, 1, 40, 6, 'wall'), B(37, 26, 1, 40, 6, 'wall'), { ...B(37, 0, 1, 12, 6, 'gate'), gate: 'all', hide: true },
    // 가운데 부두 광장: 낮은 화물 · 컨테이너 L 자 (서로 마주 보게)
    B(-3, -4, 2.6, 1.4, 1.2, 'crate'), B(3, 4, 2.6, 1.4, 1.2, 'crate'),
    ...stack(-12, -10, 9, 2.6, 'cont1', 'cont2'), B(-15.2, -5, 2.6, 7, 2.8, 'cont3'), ...stairs(-9, -6.4, 0, -1, 2.8, 2.2),
    ...stack(12, 10, 9, 2.6, 'cont2', 'cont1'), B(15.2, 5, 2.6, 7, 2.8, 'cont3'), ...stairs(9, 6.4, 0, 1, 2.8, 2.2),
    B(-12, 12, 8, 2.6, 2.8, 'cont3'), B(12, -12, 8, 2.6, 2.8, 'cont3'), B(-14, 18, 2.6, 6, 2.8, 'cont1'), B(14, -18, 2.6, 6, 2.8, 'cont2'),
    // 창고 (2층, 옥상) · 사무실
    ...building(-22, -26, 14, 10, 'ware', { floors: 2, doors: 'SEW', roof: 'flat' }), ...building(22, 26, 14, 10, 'ware', { floors: 2, doors: 'NEW', roof: 'flat' }),
    ...building(24, -28, 9, 8, 'house2', { doors: 'SW', roof: 'pitch' }), ...building(-24, 28, 9, 8, 'house2', { doors: 'NE', roof: 'pitch' }),
    // 부두 (바다 쪽 나무 데크) · 기둥 · 화물
    B(0, -40, 40, 6, 0.4, 'dock'), B(0, 40, 40, 6, 0.4, 'dock'), ...[-16, -8, 0, 8, 16].flatMap((x) => [B(x, -43, 0.6, 0.6, 1.2, 'low', 0.4), B(x, 43, 0.6, 0.6, 1.2, 'low', 0.4)]),
    ...crates([[-6, -36, 2], [6, 36, 2], [-28, 6], [28, -6], [-28, -10, 2], [28, 10, 2], [-4, 24], [4, -24], [-30, -40], [30, 40]]),
    B(-30, 16, 6, 1, 1.2, 'low'), B(30, -16, 6, 1, 1.2, 'low'),
    { ...B(-6, -36, 1, 1, 18, 'low'), hide: true }, { ...B(6, 36, 1, 1, 18, 'low'), hide: true }, // 크레인 기둥
  ];
  return {
    id: 'cotton', name: '솜사탕 항구', emoji: '🍭', mode: 'control', W: 96, D: 92,
    sky: ['#ffb3d9', '#ffe9f4', '#c8e8ff'], fog: [60, 210], floor: '#d9d4e8', floor2: '#c6c0da', colors: COLORS, boxes: symmetric(boxes),
    points: [{ id: 'C', x: 0, z: 0, y: 0, r: 6.5 }],
    spawns: { red: [[-43, -8], [-43, 0], [-43, 8], [-40, -4], [-40, 4], [-41, 12]], blue: [[43, 8], [43, 0], [43, -8], [40, 4], [40, -4], [41, -12]] },
    rooms: { red: { x0: -48, x1: -37.5, z0: -46, z1: 46 }, blue: { x0: 37.5, x1: 48, z0: -46, z1: 46 } },
    deco: [
      { t: 'crane', x: -6, z: -36 }, { t: 'crane', x: 6, z: 36 }, { t: 'boat', x: 12, z: -44, r: Math.PI / 2 }, { t: 'boat', x: -12, z: 44, r: Math.PI / 2 },
      { t: 'lamp', x: -6, z: 6, light: true }, { t: 'lamp', x: 6, z: -6, light: true }, { t: 'lamp', x: -20, z: -14 }, { t: 'lamp', x: 20, z: 14 },
      { t: 'barrel', x: -2, z: 8 }, { t: 'barrel', x: 2, z: -8 }, { t: 'barrel', x: -30, z: 20, c: '#ffd84d' }, { t: 'barrel', x: 30, z: -20, c: '#7cd8ff' },
      { t: 'flags', x: -12, z: -9, x2: 12, z2: 9, h: 7 }, { t: 'jelly', x: -32, z: -30, c: '#ff9ec7', s: 1.3 }, { t: 'jelly', x: 32, z: 30, c: '#7cd8ff', s: 1.3 },
      { t: 'umbrella', x: -18, z: 2, c: '#ff8fb8' }, { t: 'umbrella', x: 18, z: -2, c: '#7cd8ff' }, { t: 'puddle', x: 0, z: 18, c: '#ffb3d9', s: 1.5 },
      { t: 'sign', x: -44, z: 20, text: '딸기팀', c: '#ff5a7a', r: Math.PI / 2 }, { t: 'sign', x: 44, z: -20, text: '소다팀', c: '#4cc3ff', r: -Math.PI / 2 },
    ],
    roads: [{ x: 0, z: 0, w: 74, d: 10, c: '#ece6f5' }, { x: 0, z: -40, w: 44, d: 8, c: '#b08560' }, { x: 0, z: 40, w: 44, d: 8, c: '#b08560' }],
  };
}

// 쟁탈전 맵은 정확히 대칭: 서쪽 절반(+ 가운데 줄의 남쪽)만 쓰고 동쪽은 점대칭으로 만든다 (집 계단 · 창문까지 양 팀이 똑같게)
function symmetric(boxes) {
  const center = boxes.filter((b) => Math.abs(b.x) < 0.01 && Math.abs(b.z) < 0.01);
  const half = boxes.filter((b) => b.x < -0.01 || (Math.abs(b.x) < 0.01 && b.z < -0.01));
  return [...center, ...half, ...half.map((b) => ({ ...b, x: -b.x, z: -b.z }))];
}
export const WMAPS = [
  { id: 'jellymura', name: '벚꽃 젤리 마을', emoji: '🌸', mode: 'assault', make: jellymura, desc: '점령전 · 공격팀은 A → B 거점을 차례로 점령!' },
  { id: 'jellyos', name: '레몬 신전', emoji: '🏛️', mode: 'control', make: jellyos, desc: '쟁탈전 · 가운데 거점을 먼저 100% 차지하면 승리' },
  { id: 'cookie', name: '쿠키 성', emoji: '🍪', mode: 'assault', make: cookieKeep, desc: '점령전 · 성문 마당(A) → 왕좌의 방(B) · 성벽 위를 걸어요' },
  { id: 'cotton', name: '솜사탕 항구', emoji: '🍭', mode: 'control', make: cottonPort, desc: '쟁탈전 · 컨테이너 사이 부두 광장 · 2단 컨테이너 위 높은 곳' },
];
export const wmapById = (id) => WMAPS.find((m) => m.id === id) || WMAPS[0];
export const makeMap = (id) => wmapById(id).make();
// 출발 문 열기 (상자에서 빼고 격자를 다시)
export function openGates(map) { map.boxes = map.boxes.filter((b) => !b.gate); delete map._grid; }
export const inRoom = (rm, x, z) => !!rm && ((x > rm.x0 && x < rm.x1 && z > rm.z0 && z < rm.z1) || (rm.x2 != null && x > rm.x2 && x < rm.x3 && z > rm.z2 && z < rm.z3));
