// 젤리배그 섬: 240m 섬 (20~30명이 붙기 좋은 크기) · 이름 있는 동네 7곳 · 들어갈 수 있는 집(문 · 2층 · 계단) · 숲 · 바위 · 길
//   서버 · 화면이 같은 씨앗으로 같은 섬을 만든다. 아이템이 나올 자리(loot)도 함께
import { rng } from '../../jelly-apple/js/board.js';

const B = (x, z, w, d, h, k = 'wall', y = 0, extra = {}) => ({ x, z, w, d, h, k, y, ...extra });
export const BG_SIZE = 240;
export const PLACES = [
  { id: 'village', name: '젤리 마을', x: -62, z: -48 },
  { id: 'factory', name: '사탕 공장', x: 58, z: -60 },
  { id: 'school', name: '곰돌 학교', x: 0, z: 0 },
  { id: 'farm', name: '딸기 농장', x: -70, z: 52 },
  { id: 'base', name: '젤리 군기지', x: 68, z: 54 },
  { id: 'harbor', name: '소다 항구', x: 92, z: -4 },
  { id: 'forest', name: '민트 숲', x: -92, z: 0 },
];

export function makeBgMap() {
  const R = rng(20261023), rnd = (a, b) => a + R() * (b - a);
  const boxes = [], deco = [], loot = [], roads = [];
  const T = 0.4; // 벽 두께
  // 문이 있는 벽 한 면: 축(axis 'x' 면 x 방향으로 뻗은 벽), 가운데에 폭 1.6 문 (door=false 면 막힌 벽 + 창문 구멍)
  function wallX(cx, z, len, h, y, k, door, win) {
    const g = door ? 1.6 : win ? 1.4 : 0;
    if (!g) { boxes.push(B(cx, z, len, T, h, k, y)); return; }
    const side = (len - g) / 2, off = (g + side) / 2;
    boxes.push(B(cx - off, z, side, T, h, k, y), B(cx + off, z, side, T, h, k, y));
    if (door) boxes.push(B(cx, z, g, T, h - 2.3, k, y + 2.3)); // 문 위
    else { boxes.push(B(cx, z, g, T, 1.0, k, y), B(cx, z, g, T, h - 2.2, k, y + 2.2)); } // 창문 아래 · 위
  }
  function wallZ(x, cz, len, h, y, k, door, win) {
    const g = door ? 1.6 : win ? 1.4 : 0;
    if (!g) { boxes.push(B(x, cz, T, len, h, k, y)); return; }
    const side = (len - g) / 2, off = (g + side) / 2;
    boxes.push(B(x, cz - off, T, side, h, k, y), B(x, cz + off, T, side, h, k, y));
    if (door) boxes.push(B(x, cz, T, g, h - 2.3, k, y + 2.3));
    else { boxes.push(B(x, cz, T, g, 1.0, k, y), B(x, cz, T, g, h - 2.2, k, y + 2.2)); }
  }
  // 집: 네 벽(한 면에 문, 나머지 창문) + 지붕(세모) · floors=2 면 2층 바닥 + 계단
  function house(x, z, w, d, k = 'home', floors = 1, doorSide = 'S', items = 2) {
    const h = 3.2;
    for (let f = 0; f < floors; f++) {
      const y = f * h;
      wallX(x, z - d / 2, w, h, y, k, f === 0 && doorSide === 'N', true);
      wallX(x, z + d / 2, w, h, y, k, f === 0 && doorSide === 'S', true);
      wallZ(x - w / 2, z, d, h, y, k, f === 0 && doorSide === 'W', true);
      wallZ(x + w / 2, z, d, h, y, k, f === 0 && doorSide === 'E', d > 6);
      if (f > 0) {
        // 2층 바닥 (계단 자리는 비운다) + 계단
        const sw = 1.4;
        boxes.push(B(x - sw / 2, z, w - sw, d, 0.25, 'floor', y - 0.25));
        boxes.push(B(x + w / 2 - sw / 2 - T / 2, z - d / 4 - 0.2, sw, d / 2 - 0.4, 0.25, 'floor', y - 0.25));
        const steps = 6;
        for (let i = 0; i < steps; i++) boxes.push(B(x + w / 2 - sw / 2 - T / 2, z + d / 2 - T - 0.55 - i * 0.55, sw, 0.55, (i + 1) * (h / steps), 'step', 0));
        loot.push([x - w / 4, y + 0.05, z + d / 4], [x - w / 4, y + 0.05, z - d / 4]);
      }
    }
    boxes.push(B(x, z, w + 0.2, d + 0.2, 0.3, 'roofslab', floors * h, { roof: 'pitch' }));
    for (let i = 0; i < items; i++) loot.push([x + rnd(-w / 3, w / 3), 0.05, z + rnd(-d / 3, d / 3)]);
  }
  const tree = (x, z, kind = 'tree') => { boxes.push(B(x, z, 0.6, 0.6, 3, 'trunk', 0, { hide: true })); deco.push({ t: kind, x, z, s: rnd(0.9, 1.25) }); };
  const rock = (x, z, s = 1) => { boxes.push(B(x, z, 1.8 * s, 1.5 * s, 1.1 * s, 'rock', 0, { hide: true })); deco.push({ t: 'rock', x, z, s }); };
  const crate = (x, z, n = 1) => { for (let i = 0; i < n; i++) boxes.push(B(x, z, 1.3, 1.3, 1.3, 'crate', i * 1.3)); };
  const car = (x, z, r, c) => { boxes.push(B(x, z, r ? 3.9 : 1.9, r ? 1.9 : 3.9, 1.5, 'low', 0, { hide: true })); deco.push({ t: 'car', x, z, r: r ? Math.PI / 2 : 0, c }); };

  // 섬 테두리 (보이지 않는 벽) · 길
  const S = BG_SIZE;
  boxes.push(B(0, -S / 2 - 0.5, S + 2, 1, 12, 'outer', 0, { hide: true }), B(0, S / 2 + 0.5, S + 2, 1, 12, 'outer', 0, { hide: true }), B(-S / 2 - 0.5, 0, 1, S, 12, 'outer', 0, { hide: true }), B(S / 2 + 0.5, 0, 1, S, 12, 'outer', 0, { hide: true }));
  roads.push({ x: 0, z: 0, w: 200, d: 7, c: '#7a7480', line: true }, { x: 0, z: 0, w: 7, d: 200, c: '#7a7480', line: true }, { x: -62, z: -20, w: 6, d: 56, c: '#8a8070' }, { x: 62, z: 20, w: 6, d: 70, c: '#8a8070' });

  // 1) 젤리 마을: 집 8채 (몇 채는 2층)
  const V = PLACES[0];
  [[-14, -10, 'S', 2], [0, -12, 'S', 1], [14, -10, 'S', 1], [-14, 10, 'N', 1], [2, 12, 'N', 2], [16, 10, 'N', 1], [-28, 0, 'E', 1], [28, -2, 'W', 2]].forEach(([dx, dz, door, fl], i) => house(V.x + dx, V.z + dz, i % 3 ? 8 : 9, 7, i % 2 ? 'home' : 'house', fl, door, 3));
  for (let i = 0; i < 6; i++) deco.push({ t: 'flowers', x: V.x + rnd(-20, 20), z: V.z + rnd(-3, 3) }, { t: 'tree', x: V.x + rnd(-32, 32), z: V.z + (i % 2 ? 22 : -22), s: 1 });
  deco.push({ t: 'lamp', x: V.x - 6, z: V.z, light: true }, { t: 'lamp', x: V.x + 8, z: V.z }, { t: 'flags', x: V.x - 14, z: V.z - 3, x2: V.x + 14, z2: V.z - 3, h: 5 }, { t: 'sign', x: V.x - 34, z: V.z + 4, text: '젤리 마을', c: '#ff5c8a', r: Math.PI / 2 });
  car(V.x - 4, V.z + 1, 1, '#ff8fb8'); car(V.x + 22, V.z + 2, 0, '#7cd8ff');

  // 2) 사탕 공장: 큰 창고(안이 트임) + 탱크 + 컨테이너
  const F = PLACES[1];
  wallX(F.x, F.z - 12, 30, 7, 0, 'ware', false, true); wallX(F.x, F.z + 12, 30, 7, 0, 'ware', true, false); wallZ(F.x - 15, F.z, 24, 7, 0, 'ware', true, false); wallZ(F.x + 15, F.z, 24, 7, 0, 'ware', false, true);
  boxes.push(B(F.x, F.z, 30.4, 24.4, 0.4, 'roofslab', 7));
  boxes.push(B(F.x - 6, F.z - 4, 10, 4, 1.4, 'belt'), B(F.x + 6, F.z + 4, 10, 4, 1.4, 'belt'));
  boxes.push(B(F.x - 24, F.z - 8, 6, 6, 9, 'tank'), B(F.x - 24, F.z + 6, 6, 6, 9, 'tank2'), B(F.x + 24, F.z, 6, 6, 9, 'tank'));
  crate(F.x - 8, F.z + 6, 2); crate(F.x + 9, F.z - 6, 2); crate(F.x, F.z + 8);
  for (let i = 0; i < 7; i++) loot.push([F.x + rnd(-12, 12), 0.05, F.z + rnd(-9, 9)]);
  deco.push({ t: 'jelly', x: F.x - 18, z: F.z + 16, c: '#ff8fb8', s: 1.6 }, { t: 'puddle', x: F.x + 18, z: F.z - 16, c: '#7cd8ff', s: 2 }, { t: 'sign', x: F.x, z: F.z + 16, text: '사탕 공장', c: '#7a5ce0' });

  // 3) 곰돌 학교: 2층 큰 건물 + 운동장
  const Sc = PLACES[2];
  house(Sc.x - 10, Sc.z - 18, 18, 10, 'school', 2, 'S', 4); house(Sc.x + 12, Sc.z - 18, 14, 10, 'school', 2, 'S', 3);
  boxes.push(B(Sc.x + 22, Sc.z + 18, 1, 6, 1.2, 'low'), B(Sc.x - 22, Sc.z + 18, 1, 6, 1.2, 'low'));
  deco.push({ t: 'fence', x: Sc.x - 26, z: Sc.z + 6, x2: Sc.x + 26, z2: Sc.z + 6 }, { t: 'fence', x: Sc.x - 26, z: Sc.z + 30, x2: Sc.x + 26, z2: Sc.z + 30 }, { t: 'sign', x: Sc.x, z: Sc.z - 26, text: '곰돌 학교', c: '#3f7cb5' }, { t: 'bench', x: Sc.x - 8, z: Sc.z + 8 }, { t: 'bench', x: Sc.x + 8, z: Sc.z + 8 });
  crate(Sc.x, Sc.z + 18, 2); crate(Sc.x - 10, Sc.z + 24); crate(Sc.x + 10, Sc.z + 12);
  loot.push([Sc.x, 0.05, Sc.z + 14], [Sc.x - 14, 0.05, Sc.z + 22], [Sc.x + 14, 0.05, Sc.z + 22]);

  // 4) 딸기 농장: 헛간 2 + 울타리 밭 + 건초(나무상자)
  const Fa = PLACES[3];
  house(Fa.x - 8, Fa.z - 6, 12, 9, 'house2', 1, 'E', 3); house(Fa.x + 12, Fa.z + 8, 9, 7, 'home', 1, 'N', 2);
  deco.push({ t: 'fence', x: Fa.x - 26, z: Fa.z + 14, x2: Fa.x, z2: Fa.z + 14 }, { t: 'fence', x: Fa.x - 26, z: Fa.z + 28, x2: Fa.x, z2: Fa.z + 28 }, { t: 'fence', x: Fa.x - 26, z: Fa.z + 14, x2: Fa.x - 26, z2: Fa.z + 28 });
  for (let i = 0; i < 12; i++) deco.push({ t: 'bush', x: Fa.x - 22 + (i % 6) * 4, z: Fa.z + 18 + Math.floor(i / 6) * 6, c: '#5fae5a' }, { t: 'flowers', x: Fa.x - 22 + (i % 6) * 4, z: Fa.z + 20 + Math.floor(i / 6) * 6 });
  crate(Fa.x + 2, Fa.z - 14, 2); crate(Fa.x + 4, Fa.z - 14); crate(Fa.x - 18, Fa.z - 2);
  deco.push({ t: 'sign', x: Fa.x + 4, z: Fa.z - 20, text: '딸기 농장', c: '#e0645c' });
  loot.push([Fa.x - 12, 0.05, Fa.z + 22], [Fa.x + 2, 0.05, Fa.z - 10]);

  // 5) 젤리 군기지: 담 · 컨테이너 · 감시탑(올라갈 수 있는 계단) · 막사
  const Bs = PLACES[4];
  wallX(Bs.x, Bs.z - 18, 40, 2.6, 0, 'brick', true, false); wallX(Bs.x, Bs.z + 18, 40, 2.6, 0, 'brick', false, false); wallZ(Bs.x - 20, Bs.z, 36, 2.6, 0, 'brick', true, false); wallZ(Bs.x + 20, Bs.z, 36, 2.6, 0, 'brick', false, false);
  boxes.push(B(Bs.x - 8, Bs.z - 6, 12, 2.6, 2.8, 'cont1'), B(Bs.x + 8, Bs.z + 6, 12, 2.6, 2.8, 'cont2'), B(Bs.x + 8, Bs.z + 6, 12, 2.6, 2.8, 'cont3', 2.8), B(Bs.x - 12, Bs.z + 10, 2.6, 8, 2.8, 'cont3'));
  house(Bs.x + 10, Bs.z - 9, 10, 6, 'house2', 1, 'S', 3);
  // 감시탑: 기둥 4개 + 높은 바닥 + 계단
  for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) boxes.push(B(Bs.x - 14 + dx, Bs.z - 12 + dz, 0.3, 0.3, 5, 'low'));
  boxes.push(B(Bs.x - 14, Bs.z - 12, 3.4, 3.4, 0.3, 'floor', 5));
  for (let i = 0; i < 9; i++) boxes.push(B(Bs.x - 14 + 2.4, Bs.z - 12 - 1.2 + i * 0.6, 1.2, 0.6, (i + 1) * 0.56, 'step'));
  loot.push([Bs.x - 14, 5.35, Bs.z - 12], [Bs.x, 0.05, Bs.z], [Bs.x - 4, 0.05, Bs.z + 12], [Bs.x + 14, 0.05, Bs.z + 12]);
  crate(Bs.x, Bs.z + 2, 2); crate(Bs.x - 4, Bs.z - 12); deco.push({ t: 'sign', x: Bs.x, z: Bs.z - 21, text: '젤리 군기지', c: '#5f8f4e' }, { t: 'flags', x: Bs.x - 20, z: Bs.z - 18, x2: Bs.x + 20, z2: Bs.z - 18, h: 4 });

  // 6) 소다 항구: 컨테이너 줄 · 크레인 · 배 · 부두
  const H = PLACES[5];
  for (let i = 0; i < 5; i++) boxes.push(B(H.x - 4 + (i % 2) * 6, H.z - 28 + i * 12, 2.6, 9, 2.8, `cont${(i % 3) + 1}`), ...(i % 2 ? [] : [B(H.x - 4, H.z - 28 + i * 12, 2.6, 9, 2.8, `cont${((i + 1) % 3) + 1}`, 2.8)]));
  boxes.push(B(H.x + 12, H.z, 6, 50, 0.6, 'dock'));
  deco.push({ t: 'crane', x: H.x + 10, z: H.z - 20 }, { t: 'boat', x: H.x + 18, z: H.z + 12 }, { t: 'sign', x: H.x - 10, z: H.z + 30, text: '소다 항구', c: '#3f7cb5', r: -Math.PI / 2 }, { t: 'lamp', x: H.x + 10, z: H.z + 4, light: true });
  for (let i = 0; i < 5; i++) loot.push([H.x - 9, 0.05, H.z - 28 + i * 12]);
  crate(H.x + 4, H.z - 8, 2); crate(H.x + 4, H.z + 14);

  // 7) 민트 숲: 나무 · 바위 · 오두막
  const Fo = PLACES[6];
  house(Fo.x + 6, Fo.z + 4, 7, 6, 'home', 1, 'E', 2);
  for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, r = 6 + R() * 22, x = Fo.x + Math.cos(a) * r, z = Fo.z + Math.sin(a) * r * 1.3; if (Math.abs(x - Fo.x - 6) < 6 && Math.abs(z - Fo.z - 4) < 6) continue; tree(x, z, i % 3 ? 'pine' : 'tree'); }
  for (let i = 0; i < 6; i++) rock(Fo.x + rnd(-20, 20), Fo.z + rnd(-26, 26), rnd(0.8, 1.6));
  loot.push([Fo.x - 6, 0.05, Fo.z - 12], [Fo.x - 10, 0.05, Fo.z + 14]);

  // 들판: 흩어진 나무 · 바위 · 덤불 · 젤리 웅덩이 · 길가 차
  for (let i = 0; i < 70; i++) {
    const x = rnd(-112, 112), z = rnd(-112, 112);
    if (PLACES.some((p) => Math.hypot(p.x - x, p.z - z) < 30) || Math.abs(x) < 6 || Math.abs(z) < 6) continue;
    const k = R();
    if (k < 0.55) tree(x, z, R() < 0.3 ? 'pine' : 'tree');
    else if (k < 0.75) rock(x, z, rnd(0.8, 1.8));
    else if (k < 0.92) deco.push({ t: 'bush', x, z });
    else { deco.push({ t: 'jelly', x, z, c: ['#ff8fb8', '#7cd8ff', '#ffd27a', '#9be7c4'][i % 4], s: rnd(1, 1.8) }); boxes.push(B(x, z, 2, 2, 1.3, 'low', 0, { hide: true })); }
    if (i % 9 === 0) loot.push([x + 2, 0.05, z]);
  }
  car(-30, 3, 1, '#ffd27a'); car(34, -3, 1, '#b8a4ff'); car(3, 60, 0, '#9be7c4'); car(-3, -66, 0, '#ff8fb8');
  for (const [x, z] of [[-20, 4], [20, -4], [4, 40], [-4, -40], [4, 90], [-4, -90], [90, 4], [-90, -4]]) deco.push({ t: 'lamp', x, z });

  return {
    id: 'island', name: '젤리 섬', emoji: '🏝️', W: S, D: S,
    sky: ['#68b7ff', '#e6f5ff', '#bfe3f0'], fog: [90, 330], floor: '#8fc979', floor2: '#7db96a', sea: '#3fa0d8', clouds: 14,
    colors: { outer: '#888', home: '#f1dcc0', house: '#e8d4f0', house2: '#d9e9c8', school: '#f5e3b5', ware: '#d7c3a5', roofslab: '#a07a6a', floor: '#b89a7a', step: '#a89480', wall: '#c9b99a', brick: '#b5694f', low: '#9e9686', crate: '#b8864b', tank: '#ff8fb8', tank2: '#7cd8ff', belt: '#3c3a4c', cont1: '#e8574f', cont2: '#3f7cb5', cont3: '#5fae6e', dock: '#8a6a4a', trunk: '#7a5232', rock: '#9a9a9e' },
    boxes, deco, roads, loot,
    spawns: { red: [[0, 0]], blue: [[0, 0]] },
  };
}
