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
// 맵 고르기 (모두 240m · 큰길 십자 + 옆길 둘은 같다 → 차 자리가 같다)
export const BG_MAPS = [
  { id: 'island', name: '젤리 섬', emoji: '🏝️', desc: '마을 · 공장 · 학교 · 농장 · 군기지 · 항구 · 숲' },
  { id: 'snow', name: '눈꽃 섬', emoji: '❄️', desc: '통나무 마을 · 스키 산장 · 얼음 호수 · 북극 기지 · 이글루' },
  { id: 'desert', name: '캔디 사막', emoji: '🏜️', desc: '오아시스 · 캐러멜 신전(계단 피라미드) · 붉은 협곡 · 시장' },
];
const cache = new Map();
// 같은 맵은 한 번만 만든다 (서버 · 화면 모두 판정용으로 같이 쓴다)
export function getBgMap(id) { const k = BG_MAPS.some((m) => m.id === id) ? id : 'island'; if (!cache.has(k)) cache.set(k, makeBgMap(k)); return cache.get(k); }

// 맵을 짓는 도구 (상자 · 꾸밈 · 아이템 자리)
function tools(R) {
  const rnd = (a, b) => a + R() * (b - a);
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
  // 집: 네 벽(한 면에 문, 나머지 창문) + 지붕(세모 · 평평) · floors=2 면 2층 바닥 + 계단 · 안에 탁자 · 선반 (엄폐물, 탁자 위에도 아이템)
  function house(x, z, w, d, k = 'home', floors = 1, doorSide = 'S', items = 2, roof = 'pitch') {
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
        if (w >= 8) boxes.push(B(x - w / 2 + 0.7, z - d / 2 + 0.6, 1, 0.8, 1.1, 'furn', y)); // 2층 서랍장
      }
    }
    // 1층 탁자 (왼쪽 안) · 선반 (북쪽 벽, 문이 북쪽이면 남쪽 벽)
    const tx = x - w / 4, tz = z, tw = Math.min(1.6, w / 4), td = Math.min(1, d / 5);
    if (w >= 7) boxes.push(B(tx, tz, tw, td, 0.8, 'furn'));
    const sz = doorSide === 'N' ? z + d / 2 - 0.55 : z - d / 2 + 0.55;
    if (w >= 8) boxes.push(B(x + 0.6, sz, w / 4, 0.5, 1.7, 'shelf'));
    if (roof === 'pitch') boxes.push(B(x, z, w + 0.2, d + 0.2, 0.3, 'roofslab', floors * h, { roof: 'pitch' }));
    else { boxes.push(B(x, z, w + 0.2, d + 0.2, 0.3, 'roofslab', floors * h, { roof: 'none' })); for (const [px, pz, pw, pd] of [[x, z - d / 2, w, T], [x, z + d / 2, w, T], [x - w / 2, z, T, d], [x + w / 2, z, T, d]]) boxes.push(B(px, pz, pw, pd, 0.5, k, floors * h + 0.3)); }
    for (let i = 0; i < items; i++) {
      const lx = x + rnd(-w / 3, w / 3), lz = z + rnd(-d / 3, d / 3);
      const onTable = w >= 7 && Math.abs(lx - tx) < tw / 2 + 0.3 && Math.abs(lz - tz) < td / 2 + 0.3;
      loot.push(onTable ? [tx, 0.85, tz] : [lx, 0.05, lz]);
    }
  }
  const tree = (x, z, kind = 'tree', extra = {}) => { boxes.push(B(x, z, 0.6, 0.6, 3, 'trunk', 0, { hide: true })); deco.push({ t: kind, x, z, s: rnd(0.9, 1.25), ...extra }); };
  const rock = (x, z, s = 1, c) => { boxes.push(B(x, z, 1.8 * s, 1.5 * s, 1.1 * s, 'rock', 0, { hide: true })); deco.push({ t: 'rock', x, z, s, c }); };
  const crate = (x, z, n = 1) => { for (let i = 0; i < n; i++) boxes.push(B(x, z, 1.3, 1.3, 1.3, 'crate', i * 1.3)); };
  const car = (x, z, r, c) => { boxes.push(B(x, z, r ? 3.9 : 1.9, r ? 1.9 : 3.9, 1.5, 'low', 0, { hide: true })); deco.push({ t: 'car', x, z, r: r ? Math.PI / 2 : 0, c }); };
  // 감시탑: 기둥 4개 + 높은 바닥 + 계단 + 낮은 난간 (꼭대기에 아이템)
  const tower = (x, z, k = 'low') => {
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) boxes.push(B(x + dx, z + dz, 0.3, 0.3, 5, k));
    boxes.push(B(x, z, 3.4, 3.4, 0.3, 'floor', 5));
    for (let i = 0; i < 9; i++) boxes.push(B(x + 2.4, z - 1.2 + i * 0.6, 1.2, 0.6, (i + 1) * 0.56, 'step'));
    for (const [px, pz, pw, pd] of [[x, z - 1.7, 3.4, 0.2], [x, z + 1.7, 3.4, 0.2], [x - 1.7, z, 0.2, 3.4]]) boxes.push(B(px, pz, pw, pd, 0.9, k, 5.3));
    loot.push([x, 5.35, z]);
  };
  // 섬 테두리 (보이지 않는 벽) · 큰길 십자 + 옆길 둘 (차 자리)
  const S = BG_SIZE;
  boxes.push(B(0, -S / 2 - 0.5, S + 2, 1, 12, 'outer', 0, { hide: true }), B(0, S / 2 + 0.5, S + 2, 1, 12, 'outer', 0, { hide: true }), B(-S / 2 - 0.5, 0, 1, S, 12, 'outer', 0, { hide: true }), B(S / 2 + 0.5, 0, 1, S, 12, 'outer', 0, { hide: true }));
  const roadSet = (main, side) => roads.push({ x: 0, z: 0, w: 200, d: 7, c: main, line: true }, { x: 0, z: 0, w: 7, d: 200, c: main, line: true }, { x: -62, z: -20, w: 6, d: 56, c: side }, { x: 62, z: 20, w: 6, d: 70, c: side });
  // 들판: 마을에서 떨어진 곳에 흩뿌리기 (f 가 하나씩 만든다)
  const field = (places, n, f) => { for (let i = 0; i < n; i++) { const x = rnd(-112, 112), z = rnd(-112, 112); if (places.some((p) => Math.hypot(p.x - x, p.z - z) < 30) || Math.abs(x) < 6 || Math.abs(z) < 6) continue; f(x, z, i); } };
  return { rnd, boxes, deco, loot, roads, wallX, wallZ, house, tree, rock, crate, car, tower, roadSet, field };
}

export function makeBgMap(id = 'island') {
  const R = rng(id === 'island' ? 20261023 : id === 'snow' ? 20261111 : 20261205);
  const K = tools(R);
  const map = id === 'snow' ? snowMap(K, R) : id === 'desert' ? desertMap(K, R) : islandMap(K, R);
  fixLoot(map);
  return map;
}
// 아이템 자리가 상자(탁자 · 컨베이어 · 기둥) 속이면: 낮으면 그 위로 올리고, 높으면 옆 빈자리로
function fixLoot(map) {
  const at = (x, y, z) => map.boxes.find((b) => !b.k.startsWith('outer') && x > b.x - b.w / 2 - 0.15 && x < b.x + b.w / 2 + 0.15 && z > b.z - b.d / 2 - 0.15 && z < b.z + b.d / 2 + 0.15 && y + 0.1 > b.y && y + 0.1 < b.y + b.h);
  for (const L of map.loot) {
    const b = at(L[0], L[1], L[2]); if (!b) continue;
    if (b.y + b.h - L[1] <= 1.4 && !at(L[0], b.y + b.h + 0.05, L[2])) { L[1] = b.y + b.h + 0.05; continue; }
    for (let r = 1; r <= 4; r += 0.5) {
      const spot = [[r, 0], [-r, 0], [0, r], [0, -r]].find(([dx, dz]) => !at(L[0] + dx, L[1], L[2] + dz));
      if (spot) { L[0] += spot[0]; L[2] += spot[1]; break; }
    }
  }
}

function islandMap(K, R) {
  const { rnd, boxes, deco, loot, roads, wallX, wallZ, house, tree, rock, crate, car } = K;
  const S = BG_SIZE;
  K.roadSet('#7a7480', '#8a8070');

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
  for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, r = 6 + R() * 22, x = Fo.x + Math.cos(a) * r, z = Fo.z + Math.sin(a) * r * 1.3; if ((Math.abs(x - Fo.x - 6) < 6 && Math.abs(z - Fo.z - 4) < 6) || Math.abs(z) < 5) continue; tree(x, z, i % 3 ? 'pine' : 'tree'); }
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
    id: 'island', name: '젤리 섬', emoji: '🏝️', W: S, D: S, places: PLACES, land: '#8fc979',
    sky: ['#68b7ff', '#e6f5ff', '#bfe3f0'], fog: [90, 330], floor: '#8fc979', floor2: '#7db96a', sea: '#3fa0d8', clouds: 14,
    colors: { outer: '#888', home: '#f1dcc0', house: '#e8d4f0', house2: '#d9e9c8', school: '#f5e3b5', ware: '#d7c3a5', roofslab: '#a07a6a', floor: '#b89a7a', step: '#a89480', wall: '#c9b99a', brick: '#b5694f', low: '#9e9686', crate: '#b8864b', tank: '#ff8fb8', tank2: '#7cd8ff', belt: '#3c3a4c', cont1: '#e8574f', cont2: '#3f7cb5', cont3: '#5fae6e', dock: '#8a6a4a', trunk: '#7a5232', rock: '#9a9a9e', furn: '#a8784f', shelf: '#8f6a4a' },
    boxes, deco, roads, loot,
    spawns: { red: [[0, 0]], blue: [[0, 0]] },
  };
}

// ---------- ❄️ 눈꽃 섬 ----------
export const SNOW_PLACES = [
  { id: 'cabins', name: '통나무 마을', x: -62, z: -48 },
  { id: 'lodge', name: '스키 산장', x: 58, z: -60 },
  { id: 'plaza', name: '눈꽃 광장', x: 0, z: 0 },
  { id: 'lake', name: '얼음 호수', x: -70, z: 52 },
  { id: 'polar', name: '북극 기지', x: 68, z: 54 },
  { id: 'igloo', name: '이글루 캠프', x: 92, z: -4 },
  { id: 'woods', name: '눈사람 숲', x: -92, z: 0 },
];
function snowMap(K, R) {
  const { rnd, boxes, deco, loot, wallX, wallZ, house, tree, rock, crate, car, tower, field } = K;
  const P = SNOW_PLACES, S = BG_SIZE;
  K.roadSet('#9aa6b8', '#b3bccb');
  const pine = (x, z) => tree(x, z, 'pine', { snow: true });
  // 1) 통나무 마을: 통나무집 8채 (2층 몇 채) · 장작 더미 · 가로등
  const V = P[0];
  [[-14, -10, 'S', 2], [0, -12, 'S', 1], [14, -10, 'S', 1], [-14, 10, 'N', 1], [2, 12, 'N', 2], [16, 10, 'N', 1], [-28, 0, 'E', 1], [28, -2, 'W', 2]].forEach(([dx, dz, door, fl], i) => house(V.x + dx, V.z + dz, i % 3 ? 8 : 9, 7, i % 2 ? 'cabin' : 'cabin2', fl, door, 3));
  for (let i = 0; i < 5; i++) crate(V.x - 20 + i * 9, V.z + (i % 2 ? 3 : -3));
  deco.push({ t: 'lamp', x: V.x - 6, z: V.z, light: true }, { t: 'lamp', x: V.x + 8, z: V.z }, { t: 'snowman', x: V.x + 4, z: V.z + 2 }, { t: 'snowman', x: V.x - 22, z: V.z - 3, s: 1.3 }, { t: 'flags', x: V.x - 14, z: V.z - 3, x2: V.x + 14, z2: V.z - 3, h: 5 }, { t: 'sign', x: V.x - 34, z: V.z + 4, text: '통나무 마을', c: '#8a5634', r: Math.PI / 2 });
  car(V.x + 22, V.z + 2, 0, '#7cd8ff');
  // 2) 스키 산장: 큰 2층 산장 + 별채 + 리프트 기둥 · 스키 깃발
  const L = P[1];
  house(L.x - 4, L.z - 4, 20, 12, 'lodge', 2, 'S', 5); house(L.x + 16, L.z + 8, 9, 7, 'cabin', 1, 'W', 2);
  for (let i = 0; i < 4; i++) { boxes.push(B(L.x - 22, L.z - 20 + i * 10, 0.5, 0.5, 7, 'pole')); boxes.push(B(L.x - 22, L.z - 20 + i * 10, 3, 0.3, 0.3, 'pole', 7)); }
  deco.push({ t: 'flags', x: L.x - 14, z: L.z + 6, x2: L.x + 8, z2: L.z + 6, h: 4 }, { t: 'sign', x: L.x, z: L.z + 14, text: '스키 산장', c: '#3f7cb5' }, { t: 'lamp', x: L.x + 6, z: L.z + 4, light: true });
  crate(L.x + 4, L.z + 10, 2); crate(L.x - 12, L.z + 12);
  for (let i = 0; i < 4; i++) loot.push([L.x - 18 + i * 6, 0.05, L.z + 9]);
  // 3) 눈꽃 광장: 얼어붙은 분수 · 시청(2층) · 상점 · 큰 트리
  const Pz = P[2];
  house(Pz.x - 12, Pz.z - 18, 16, 10, 'hall', 2, 'S', 4); house(Pz.x + 13, Pz.z - 17, 12, 8, 'shop', 1, 'S', 3, 'flat');
  house(Pz.x + 14, Pz.z + 17, 12, 8, 'cabin2', 1, 'N', 3);
  boxes.push(B(Pz.x - 14, Pz.z + 16, 6, 6, 0.9, 'ice'), B(Pz.x - 14, Pz.z + 16, 2, 2, 2.6, 'ice', 0.9));
  deco.push({ t: 'pine', x: Pz.x - 26, z: Pz.z + 26, s: 2, snow: true }, { t: 'snowman', x: Pz.x - 8, z: Pz.z + 10 }, { t: 'bench', x: Pz.x - 20, z: Pz.z + 10 }, { t: 'sign', x: Pz.x, z: Pz.z - 26, text: '눈꽃 광장', c: '#7aa6d8' });
  boxes.push(B(Pz.x - 26, Pz.z + 26, 0.6, 0.6, 3, 'trunk', 0, { hide: true }));
  loot.push([Pz.x - 14, 0.95, Pz.z + 16], [Pz.x - 20, 0.05, Pz.z + 24], [Pz.x + 4, 0.05, Pz.z + 10]);
  crate(Pz.x + 4, Pz.z + 24, 2);
  // 4) 얼음 호수: 넓은 빙판 · 얼음 덩어리(엄폐) · 낚시 오두막
  const Lk = P[3];
  K.roads.push({ x: Lk.x, z: Lk.z + 8, w: 40, d: 30, c: '#bfe3f5' });
  for (let i = 0; i < 9; i++) { const x = Lk.x - 16 + R() * 32, z = Lk.z - 4 + R() * 24; boxes.push(B(x, z, 1.6 + R(), 1.4 + R(), 1 + R() * 0.8, 'ice')); }
  house(Lk.x - 10, Lk.z - 16, 6, 5, 'cabin', 1, 'S', 2); house(Lk.x + 12, Lk.z - 14, 6, 5, 'cabin2', 1, 'S', 2);
  deco.push({ t: 'sign', x: Lk.x, z: Lk.z - 22, text: '얼음 호수', c: '#4c8dff' }, { t: 'tent', x: Lk.x + 6, z: Lk.z + 14, c: '#ff8fb8' });
  loot.push([Lk.x, 0.05, Lk.z + 8], [Lk.x - 12, 0.05, Lk.z + 18], [Lk.x + 14, 0.05, Lk.z + 2]);
  // 5) 북극 기지: 담 · 컨테이너 · 레이더 · 감시탑 2 · 막사
  const Bs = P[4];
  wallX(Bs.x, Bs.z - 18, 40, 2.6, 0, 'steel', true, false); wallX(Bs.x, Bs.z + 18, 40, 2.6, 0, 'steel', false, false); wallZ(Bs.x - 20, Bs.z, 36, 2.6, 0, 'steel', true, false); wallZ(Bs.x + 20, Bs.z, 36, 2.6, 0, 'steel', false, true);
  boxes.push(B(Bs.x - 8, Bs.z - 6, 12, 2.6, 2.8, 'cont1'), B(Bs.x + 8, Bs.z + 6, 12, 2.6, 2.8, 'cont2'), B(Bs.x + 8, Bs.z + 6, 12, 2.6, 2.8, 'cont3', 2.8), B(Bs.x + 12, Bs.z - 10, 5, 5, 6, 'tank2'));
  house(Bs.x - 8, Bs.z + 10, 10, 6, 'steel', 1, 'N', 3, 'flat');
  tower(Bs.x - 14, Bs.z - 12, 'pole'); tower(Bs.x + 15, Bs.z + 13, 'pole');
  crate(Bs.x, Bs.z + 2, 2); deco.push({ t: 'sign', x: Bs.x, z: Bs.z - 21, text: '북극 기지', c: '#5f8f4e' }, { t: 'flags', x: Bs.x - 20, z: Bs.z - 18, x2: Bs.x + 20, z2: Bs.z - 18, h: 4 });
  loot.push([Bs.x, 0.05, Bs.z], [Bs.x - 4, 0.05, Bs.z + 4], [Bs.x + 4, 0.05, Bs.z - 12]);
  // 6) 이글루 캠프: 이글루 (안에 아이템) · 썰매 · 모닥불 자리
  const Ig = P[5];
  for (const [dx, dz] of [[-10, -12], [4, -14], [-6, 10], [8, 12], [16, -6]]) { const x = Ig.x + dx, z = Ig.z + dz; deco.push({ t: 'igloo', x, z }); for (const [ax, az, aw, ad] of [[0, -2.2, 4.4, 0.5], [-2.2, 0, 0.5, 4.4], [2.2, 0, 0.5, 4.4]]) boxes.push(B(x + ax, z + az, aw, ad, 2.2, 'ice', 0, { hide: true })); loot.push([x, 0.05, z]); }
  crate(Ig.x - 2, Ig.z - 8); crate(Ig.x + 2, Ig.z + 6, 2);
  deco.push({ t: 'sign', x: Ig.x - 12, z: Ig.z + 22, text: '이글루 캠프', c: '#7aa6d8', r: -Math.PI / 2 }, { t: 'lamp', x: Ig.x, z: Ig.z + 2, light: true });
  // 7) 눈사람 숲: 눈 덮인 소나무 · 눈사람 · 오두막
  const W = P[6];
  house(W.x + 6, W.z + 4, 7, 6, 'cabin', 1, 'E', 2);
  for (let i = 0; i < 44; i++) { const a = R() * Math.PI * 2, r = 6 + R() * 22, x = W.x + Math.cos(a) * r, z = W.z + Math.sin(a) * r * 1.3; if ((Math.abs(x - W.x - 6) < 6 && Math.abs(z - W.z - 4) < 6) || Math.abs(z) < 5) continue; pine(x, z); }
  for (let i = 0; i < 6; i++) { const x = W.x + rnd(-18, 18), z = W.z + rnd(-24, 24); deco.push({ t: 'snowman', x, z, s: rnd(0.9, 1.4) }); boxes.push(B(x, z, 1.2, 1.2, 1.8, 'low', 0, { hide: true })); }
  loot.push([W.x - 6, 0.05, W.z - 12], [W.x - 10, 0.05, W.z + 14], [W.x + 4, 0.05, W.z - 20]);
  // 들판: 소나무 · 눈 바위 · 눈사람 · 얼음 덩어리
  field(P, 80, (x, z, i) => {
    const k = R();
    if (k < 0.55) pine(x, z);
    else if (k < 0.78) rock(x, z, rnd(0.8, 1.8), '#cfd6e2');
    else if (k < 0.88) { deco.push({ t: 'snowman', x, z }); boxes.push(B(x, z, 1.2, 1.2, 1.8, 'low', 0, { hide: true })); }
    else boxes.push(B(x, z, 2 + R() * 2, 1.5 + R(), 1.2, 'ice'));
    if (i % 9 === 0) loot.push([x + 2, 0.05, z]);
  });
  car(-30, 3, 1, '#ffd27a'); car(34, -3, 1, '#b8a4ff'); car(3, 60, 0, '#9be7c4'); car(-3, -66, 0, '#ff8fb8');
  for (const [x, z] of [[-20, 4], [20, -4], [4, 40], [-4, -40], [4, 90], [-4, -90], [90, 4], [-90, -4]]) deco.push({ t: 'lamp', x, z });
  return {
    id: 'snow', name: '눈꽃 섬', emoji: '❄️', W: S, D: S, places: P, land: '#eef3f9',
    sky: ['#8ab8e8', '#eef6ff', '#d8e4f0'], fog: [70, 280], floor: '#f2f6fb', floor2: '#dde6f0', sea: '#4f8fc0', clouds: 18,
    colors: { outer: '#888', cabin: '#b07a52', cabin2: '#9a6a48', lodge: '#c48a5a', hall: '#e8eef6', shop: '#f2d7e2', steel: '#9aa6b5', roofslab: '#e9f1f8', floor: '#a88a6a', step: '#9a8470', wall: '#c9d1dc', brick: '#9aa6b5', low: '#b8c2cf', crate: '#a8784f', tank2: '#7cd8ff', cont1: '#e8574f', cont2: '#3f7cb5', cont3: '#5fae6e', trunk: '#6b4a2c', rock: '#cfd6e2', ice: '#bfe8ff', pole: '#5a6070', furn: '#8a5c3a', shelf: '#7a5234' },
    boxes, deco, roads: K.roads, loot,
    spawns: { red: [[0, 0]], blue: [[0, 0]] },
  };
}

// ---------- 🏜️ 캔디 사막 ----------
export const DESERT_PLACES = [
  { id: 'oasis', name: '오아시스 마을', x: -62, z: -48 },
  { id: 'refinery', name: '사탕 정제소', x: 58, z: -60 },
  { id: 'temple', name: '캐러멜 신전', x: 0, z: 0 },
  { id: 'canyon', name: '붉은 협곡', x: -76, z: 52 },
  { id: 'outpost', name: '사막 기지', x: 68, z: 54 },
  { id: 'market', name: '버려진 시장', x: 92, z: -4 },
  { id: 'dunes', name: '선인장 언덕', x: -94, z: -2 },
];
function desertMap(K, R) {
  const { rnd, boxes, deco, loot, wallX, wallZ, house, rock, crate, car, tower, field } = K;
  const P = DESERT_PLACES, S = BG_SIZE;
  K.roadSet('#c9a875', '#d6b98a');
  const cactus = (x, z, s = 1) => { boxes.push(B(x, z, 0.7, 0.7, 2.4 * s, 'trunk', 0, { hide: true })); deco.push({ t: 'cactus', x, z, s }); };
  const palm = (x, z) => { boxes.push(B(x, z, 0.6, 0.6, 3, 'trunk', 0, { hide: true })); deco.push({ t: 'palm', x, z, s: rnd(0.9, 1.2) }); };
  // 1) 오아시스 마을: 흙벽돌 집(평평한 지붕 · 옥상 난간) · 오아시스 연못 · 야자수
  const V = P[0];
  [[-14, -10, 'S', 2], [0, -13, 'S', 1], [14, -10, 'S', 1], [-14, 11, 'N', 1], [2, 13, 'N', 2], [16, 10, 'N', 1], [-28, 0, 'E', 1], [28, -2, 'W', 2]].forEach(([dx, dz, door, fl], i) => house(V.x + dx, V.z + dz, i % 3 ? 8 : 9, 7, i % 2 ? 'adobe' : 'adobe2', fl, door, 3, 'flat'));
  deco.push({ t: 'puddle', x: V.x + 2, z: V.z, c: '#46c2d8', s: 4 });
  for (const [dx, dz] of [[-6, -3], [9, 3], [-3, 4], [10, -4]]) palm(V.x + dx, V.z + dz);
  deco.push({ t: 'umbrella', x: V.x - 20, z: V.z + 2, c: '#ff8fb8' }, { t: 'sign', x: V.x - 34, z: V.z + 4, text: '오아시스 마을', c: '#c0784a', r: Math.PI / 2 });
  car(V.x + 22, V.z + 2, 0, '#ffd27a');
  // 2) 사탕 정제소: 큰 탱크 · 파이프(위로 지나는 관) · 창고
  const F = P[1];
  boxes.push(B(F.x - 14, F.z - 8, 7, 7, 10, 'tank'), B(F.x - 14, F.z + 8, 7, 7, 10, 'tank2'), B(F.x + 2, F.z - 10, 6, 6, 8, 'tank'));
  boxes.push(B(F.x - 4, F.z, 20, 0.8, 0.8, 'pipe', 4), B(F.x - 14, F.z, 0.8, 16, 0.8, 'pipe', 5.5));
  for (const x of [F.x - 10, F.x, F.x + 6]) boxes.push(B(x, F.z, 0.4, 0.4, 4, 'pole'));
  house(F.x + 14, F.z + 6, 14, 10, 'ware', 1, 'W', 5, 'flat');
  crate(F.x + 2, F.z + 6, 2); crate(F.x - 4, F.z + 12); crate(F.x + 8, F.z - 4, 2);
  tower(F.x + 22, F.z - 12, 'pole');
  for (let i = 0; i < 4; i++) loot.push([F.x - 8 + i * 5, 0.05, F.z + 4]);
  deco.push({ t: 'sign', x: F.x, z: F.z + 18, text: '사탕 정제소', c: '#7a5ce0' });
  // 3) 캐러멜 신전: 3층 계단 피라미드 (사방 계단) · 꼭대기 사당 · 기둥들
  const Tm = P[2];
  for (let t = 0; t < 3; t++) boxes.push(B(Tm.x, Tm.z, 30 - t * 8, 30 - t * 8, 1.2, 'temple', t * 1.2));
  for (let t = 0; t < 3; t++) {
    const e = 15 - t * 4 + 0.5, y = t * 1.2;
    for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { for (let i = 0; i < 2; i++) { const o = e + 0.6 - i * 0.6; boxes.push(B(Tm.x + dx * o, Tm.z + dz * o, dx ? 0.6 : 3, dx ? 3 : 0.6, y + (i + 1) * 0.6, 'tstep')); } }
  }
  // 사당 (꼭대기 3.6m): 기둥 넷 + 지붕
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) boxes.push(B(Tm.x + dx, Tm.z + dz, 0.9, 0.9, 3, 'gold', 3.6));
  boxes.push(B(Tm.x, Tm.z, 8, 8, 0.4, 'gold', 6.6));
  for (const [dx, dz] of [[-17, -17], [17, -17], [-17, 17], [17, 17], [-17, 0], [17, 0]]) boxes.push(B(Tm.x + dx, Tm.z + dz + (dx && !dz ? 7 : 0), 1.2, 1.2, 5, 'pillar'));
  loot.push([Tm.x, 3.65, Tm.z], [Tm.x + 2, 3.65, Tm.z - 2], [Tm.x - 9, 2.45, Tm.z - 9], [Tm.x + 9, 2.45, Tm.z + 9], [Tm.x + 13, 1.25, Tm.z - 13]);
  deco.push({ t: 'sign', x: Tm.x + 20, z: Tm.z - 20, text: '캐러멜 신전', c: '#c0784a' });
  // 4) 붉은 협곡: 높은 바위 벽 사이 꼬불꼬불 길 · 동굴 같은 바위 지붕
  const C = P[3];
  for (const [dx, dz, w, d, h] of [[-14, -14, 4, 22, 8], [-4, -20, 16, 4, 9], [10, -8, 4, 18, 7], [-8, 4, 14, 4, 6], [-18, 14, 4, 16, 9], [6, 18, 18, 4, 8], [18, 6, 4, 14, 10], [-2, 12, 4, 6, 5]]) boxes.push(B(C.x + dx, C.z + dz, w, d, h, 'cliff'));
  boxes.push(B(C.x - 6, C.z - 8, 10, 6, 0.8, 'cliff', 4)); // 바위 다리 (아래로 지나간다)
  for (const [dx, dz] of [[-8, -10], [2, -12], [0, 0], [-10, 10], [8, 8], [4, -4]]) loot.push([C.x + dx, 0.05, C.z + dz]);
  for (let i = 0; i < 6; i++) rock(C.x + rnd(-22, 22), C.z + rnd(-22, 22), rnd(0.8, 1.6), '#c86a4a');
  deco.push({ t: 'sign', x: C.x + 26, z: C.z - 20, text: '붉은 협곡', c: '#c0503a', r: -Math.PI / 2 });
  // 5) 사막 기지: 모래주머니 담 · 컨테이너 · 감시탑 · 막사
  const Bs = P[4];
  wallX(Bs.x, Bs.z - 18, 40, 2.4, 0, 'sandbag', true, false); wallX(Bs.x, Bs.z + 18, 40, 2.4, 0, 'sandbag', false, true); wallZ(Bs.x - 20, Bs.z, 36, 2.4, 0, 'sandbag', true, false); wallZ(Bs.x + 20, Bs.z, 36, 2.4, 0, 'sandbag', false, false);
  boxes.push(B(Bs.x - 8, Bs.z - 6, 12, 2.6, 2.8, 'cont1'), B(Bs.x + 8, Bs.z + 6, 12, 2.6, 2.8, 'cont2'), B(Bs.x - 12, Bs.z + 10, 2.6, 8, 2.8, 'cont3'));
  house(Bs.x + 10, Bs.z - 9, 10, 6, 'adobe2', 1, 'S', 3, 'flat');
  tower(Bs.x - 14, Bs.z - 12, 'pole');
  for (let i = 0; i < 6; i++) boxes.push(B(Bs.x - 6 + i * 2.6, Bs.z + 2, 2.4, 0.9, 1.1, 'sandbag'));
  crate(Bs.x, Bs.z - 2, 2); loot.push([Bs.x, 0.05, Bs.z], [Bs.x - 4, 0.05, Bs.z + 12], [Bs.x + 14, 0.05, Bs.z + 12]);
  deco.push({ t: 'sign', x: Bs.x, z: Bs.z - 21, text: '사막 기지', c: '#5f8f4e' }, { t: 'flags', x: Bs.x - 20, z: Bs.z - 18, x2: Bs.x + 20, z2: Bs.z - 18, h: 4 });
  // 6) 버려진 시장: 노점 · 천막 · 파라솔 · 상점 몇 채
  const M = P[5];
  for (let i = 0; i < 6; i++) { const x = M.x - 12 + (i % 3) * 10, z = M.z + (i < 3 ? -12 : 12); boxes.push(B(x, z, 4, 1.4, 1.1, 'stall')); deco.push({ t: 'umbrella', x, z: z + (i < 3 ? 1.6 : -1.6), c: ['#ff8fb8', '#7cd8ff', '#ffd84d'][i % 3] }); loot.push([x, 1.15, z]); }
  house(M.x - 6, M.z - 24, 9, 7, 'adobe', 2, 'S', 3, 'flat'); house(M.x + 8, M.z + 24, 9, 7, 'adobe2', 1, 'N', 2, 'flat');
  for (const [dx, dz] of [[-16, -14], [14, 10]]) { deco.push({ t: 'tent', x: M.x + dx, z: M.z + dz, c: '#e8b84a', s: 1.4 }); boxes.push(B(M.x + dx, M.z + dz, 3.4, 3.4, 1.6, 'low', 0, { hide: true })); }
  deco.push({ t: 'sign', x: M.x - 12, z: M.z + 32, text: '버려진 시장', c: '#c0784a', r: -Math.PI / 2 });
  // 7) 선인장 언덕: 모래 둔덕(올라설 수 있는 낮은 단) · 선인장 · 해골 바위
  const Du = P[6];
  for (let i = 0; i < 7; i++) { const x = Du.x + rnd(-18, 18), w = rnd(8, 14), d = rnd(6, 12); let z = Du.z + rnd(-26, 26); if (Math.abs(z) < d / 2 + 5) z = (z < 0 ? -1 : 1) * (d / 2 + 5); boxes.push(B(x, z, w, d, 0.5, 'sand'), B(x, z, w * 0.6, d * 0.6, 0.5, 'sand', 0.5)); loot.push([x, 1.05, z]); }
  for (let i = 0; i < 18; i++) { const x = Du.x + rnd(-22, 22), z = Du.z + rnd(-30, 30), sc = rnd(0.8, 1.4); if (Math.abs(z) > 5) cactus(x, z, sc); }
  house(Du.x + 10, Du.z + 6, 7, 6, 'adobe', 1, 'E', 2, 'flat');
  // 들판: 선인장 · 바위 · 둔덕
  field(P, 80, (x, z, i) => {
    const k = R();
    if (k < 0.45) cactus(x, z, rnd(0.8, 1.4));
    else if (k < 0.72) rock(x, z, rnd(0.8, 1.9), '#d29a6a');
    else if (k < 0.85) { const w = rnd(6, 12), d = rnd(5, 10); boxes.push(B(x, z, w, d, 0.5, 'sand')); }
    else palm(x, z);
    if (i % 9 === 0) loot.push([x + 2, 0.05, z]);
  });
  car(-30, 3, 1, '#ffd27a'); car(34, -3, 1, '#b8a4ff'); car(3, 60, 0, '#9be7c4'); car(-3, -66, 0, '#ff8fb8');
  for (const [x, z] of [[-20, 4], [20, -4], [4, 40], [-4, -40], [4, 90], [-4, -90], [90, 4], [-90, -4]]) deco.push({ t: 'lamp', x, z });
  return {
    id: 'desert', name: '캔디 사막', emoji: '🏜️', W: S, D: S, places: P, land: '#e8cf98',
    sky: ['#6cb2ff', '#fff0d2', '#f2d6a0'], fog: [90, 330], floor: '#ebd39e', floor2: '#dfc28a', sea: '#3fb6c8', clouds: 6,
    colors: { outer: '#888', adobe: '#e2b48a', adobe2: '#d79a72', ware: '#d7c3a5', roofslab: '#c99a72', floor: '#b89a7a', step: '#c4a07a', wall: '#d9b88a', low: '#c9a87a', crate: '#b8864b', tank: '#ff8fb8', tank2: '#ffd27a', cont1: '#e8574f', cont2: '#3f7cb5', cont3: '#5fae6e', trunk: '#6b8a3a', rock: '#d29a6a', temple: '#e8c27a', tstep: '#d9ae66', gold: '#ffcf4a', pillar: '#f2dfb4', cliff: '#c86a4a', sandbag: '#c9b083', stall: '#a8784f', sand: '#e4c890', pipe: '#9aa0ab', pole: '#6a6a78', furn: '#a8784f', shelf: '#8f6a4a' },
    boxes, deco, roads: K.roads, loot,
    spawns: { red: [[0, 0]], blue: [[0, 0]] },
  };
}
