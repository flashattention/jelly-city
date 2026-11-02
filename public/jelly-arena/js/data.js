// 젤리 아레나: 맵 · 챔피언 20명 · 아이템 (서버 시뮬레이션과 화면이 같이 쓴다)
//   좌표: x(오른쪽) · z(아래). 소다팀 기지는 왼쪽 아래, 딸기팀 기지는 오른쪽 위. 맵은 강(z = x)을 기준으로 정확히 대칭이다
export const SIZE = 80;       // 맵 반 폭 (-80 ~ 80)
export const CELL = 1.6;      // 길찾기 칸 크기
export const N = Math.round((SIZE * 2) / CELL);
export const TEAMS = { blue: { name: '🫧 소다팀', color: '#4cc3ff' }, red: { name: '🍓 딸기팀', color: '#ff5a7a' } };
export const mirror = ([x, z]) => [z, x];                 // 소다 → 딸기 (강 기준 뒤집기)
const flipMid = ([x, z]) => [-z, -x];                     // 위쪽 숲 → 아래쪽 숲 (미드 기준 뒤집기)
export const ROLES = { top: { name: '탑', icon: '⛰️' }, jungle: { name: '정글', icon: '🌲' }, mid: { name: '미드', icon: '🔥' }, bot: { name: '바텀', icon: '🏹' }, sup: { name: '서폿', icon: '💖' } };
export const ROLE_IDS = Object.keys(ROLES);

// ---------- 길 (소다 쪽에서 적 기지까지) ----------
export const LANES = {
  top: [[-66, 66], [-68, 42], [-68, -56], [-60, -68], [42, -68], [66, -66]],
  mid: [[-66, 66], [66, -66]],
  bot: [[-66, 66], [-42, 68], [56, 68], [68, 60], [68, -42], [66, -66]],
};
export const BASE = { blue: [-66, 66], red: [66, -66] };
export const FOUNTAIN = { blue: [-74, 74], red: [74, -74] };

// ---------- 걸을 수 있는 곳: 숲을 통로로 파낸다 ----------
const Q1PATHS = [ // 소다 쪽 위 숲 (이것을 미드 · 강 기준으로 뒤집어 네 조각을 만든다)
  [[-68, -6], [-52, -8], [-40, -10]], [[-40, -10], [-30, 4], [-26, 12]], [[-26, 12], [-14, 14]], [[-40, -10], [-34, -24], [-34, -34]],
  [[-68, 24], [-50, 22]], [[-50, 22], [-26, 12]], [[-26, 12], [-16, -2], [-20, -20]], [[-50, 22], [-44, 40]],
];
const CLEARINGS = [[-40, -10, 7], [-26, 12, 6.5], [-50, 22, 6.5]];
// 자리마다 [위쪽 숲, 아래쪽 숲] 몬스터가 다르다 (한 팀 숲에 여섯 종류, 상대 숲은 똑같이 대칭)
export const CAMP_SPOTS = [
  { ids: ['wolves', 'crab'], at: [-40, -10] }, { ids: ['frogs', 'bats'], at: [-26, 12] }, { ids: ['golem', 'snail'], at: [-50, 22] },
];
// 강의 큰 몬스터 둘: 아래쪽은 벌레왕(네 종류가 번갈아, 나중엔 태고 거북) · 위쪽은 곰팡이왕
export const EPICS = [{ id: 'bee', slot: 'bug', at: [-34, -34], r: 10 }, { id: 'mold', slot: 'mold', at: [34, 34], r: 10 }];
export const BUGS = ['bee', 'moth', 'beetle', 'firefly'], BUG_SOUL = 3, ELDER_AT = 900;
export const RIVER = [{ id: 'duck', at: [-18, -18], river: true }, { id: 'duck', at: [18, 18], river: true }];
export const TOWER_RANGE = 12;
const expand = (p) => [p, p.map(flipMid), p.map(mirror), p.map(flipMid).map(mirror)];
const CORRIDORS = [
  ...Object.values(LANES).map((pts) => ({ pts, r: 7.5 })),
  { pts: [[-72, -72], [72, 72]], r: 5 }, // 강
  ...Q1PATHS.flatMap((pts) => expand(pts).map((q) => ({ pts: q, r: 3.4 }))),
];
const BLOBS = [
  ...CLEARINGS.flatMap(([x, z, r]) => expand([[x, z]]).map(([[a, b]]) => [a, b, r])),
  ...EPICS.map((e) => [e.at[0], e.at[1], e.r]),
  [BASE.blue[0], BASE.blue[1], 24], [BASE.red[0], BASE.red[1], 24], [-74, 74, 12], [74, -74, 12],
];
const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k); };
function openAt(x, z) {
  if (Math.abs(x) > SIZE - 1.5 || Math.abs(z) > SIZE - 1.5) return false;
  for (const [a, b, r] of BLOBS) if (Math.hypot(x - a, z - b) < r) return true;
  for (const c of CORRIDORS) for (let i = 0; i + 1 < c.pts.length; i++) if (segD(x, z, c.pts[i], c.pts[i + 1]) < c.r) return true;
  return false;
}
// 칸마다 걸을 수 있나 (1 = 막힘)
export const GRID = (() => { const g = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) g[j * N + i] = openAt(-SIZE + (i + 0.5) * CELL, -SIZE + (j + 0.5) * CELL) ? 0 : 1; return g; })();
export const cellOf = (x, z) => [Math.floor((x + SIZE) / CELL), Math.floor((z + SIZE) / CELL)];
export function blocked(x, z) { const [i, j] = cellOf(x, z); return i < 0 || j < 0 || i >= N || j >= N || GRID[j * N + i] === 1; }
// 두 점 사이가 뚫렸나
export function clear(ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / (CELL * 0.5)); for (let i = 1; i <= n; i++) { const k = i / n; if (blocked(ax + (bx - ax) * k, az + (bz - az) * k)) return false; } return true; }
// 길찾기 (A*). 돌아온 길은 가능한 곳은 곧게 편다
export function findPath(ax, az, bx, bz) {
  let [si, sj] = cellOf(ax, az), [gi, gj] = cellOf(bx, bz);
  const nearOpen = (i, j) => { for (let r = 0; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N && !GRID[b * N + a]) return [a, b]; } return [i, j]; };
  [si, sj] = nearOpen(si, sj); [gi, gj] = nearOpen(gi, gj);
  const start = sj * N + si, goal = gj * N + gi;
  const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), heap = [[0, start]];
  g[start] = 0;
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [, cur] = pop();
    if (cur === goal) break;
    const ci = cur % N, cj = (cur / N) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= N || b >= N || GRID[b * N + a]) continue;
      if (di && dj && (GRID[cj * N + a] || GRID[b * N + ci])) continue; // 모서리는 못 비벼 간다
      const nx = b * N + a, cost = g[cur] + (di && dj ? 1.414 : 1);
      if (cost < g[nx]) { g[nx] = cost; from[nx] = cur; push([cost + Math.hypot(a - gi, b - gj), nx]); }
    }
  }
  if (goal !== start && from[goal] < 0) return [];
  const raw = []; for (let c = goal; c >= 0 && c !== start; c = from[c]) raw.push([-SIZE + ((c % N) + 0.5) * CELL, -SIZE + (((c / N) | 0) + 0.5) * CELL]);
  raw.reverse();
  if (!blocked(bx, bz) && raw.length) raw[raw.length - 1] = [bx, bz];
  const out = []; let px = ax, pz = az, i = 0;
  while (i < raw.length) { let k = raw.length - 1; while (k > i && !clear(px, pz, raw[k][0], raw[k][1])) k--; out.push(raw[k]); [px, pz] = raw[k]; i = k + 1; }
  return out;
}

// ---------- 건물 (소다 쪽 자리 · 딸기는 뒤집는다) ----------
//   t1 바깥 · t2 안쪽 · t3 기지 입구 · gate 수문(부수면 슈퍼 꼬마가 나온다) · guard 심장 지킴이 · heart 젤리 심장
const STRUCT = [
  { k: 'tower', tier: 1, lane: 'top', at: [-68, -22] }, { k: 'tower', tier: 2, lane: 'top', at: [-68, 12] }, { k: 'tower', tier: 3, lane: 'top', at: [-67, 36] }, { k: 'gate', lane: 'top', at: [-66, 44] },
  { k: 'tower', tier: 1, lane: 'mid', at: [-16, 16] }, { k: 'tower', tier: 2, lane: 'mid', at: [-31, 31] }, { k: 'tower', tier: 3, lane: 'mid', at: [-44, 44] }, { k: 'gate', lane: 'mid', at: [-50, 50] },
  { k: 'tower', tier: 1, lane: 'bot', at: [22, 68] }, { k: 'tower', tier: 2, lane: 'bot', at: [-12, 68] }, { k: 'tower', tier: 3, lane: 'bot', at: [-36, 67] }, { k: 'gate', lane: 'bot', at: [-44, 66] },
  { k: 'tower', tier: 4, lane: 'base', at: [-61, 58] }, { k: 'tower', tier: 4, lane: 'base', at: [-58, 61] }, { k: 'heart', lane: 'base', at: [-66, 66] },
];
export const STRUCTS = [...STRUCT.map((s) => ({ ...s, team: 'blue' })), ...STRUCT.map((s) => ({ ...s, at: mirror(s.at), team: 'red' }))];
export const BUSHES = (() => { const q = [[-60, -2, 4.5], [-60, 30, 4], [-22, 26, 4], [-6, -6, 0], [-18, -30, 4.5]].filter((b) => b[2]); return [...q, ...q.map(([x, z, r]) => { const [a, b] = flipMid([x, z]); return [a, b, r]; }), ...q.map(([x, z, r]) => { const [a, b] = mirror([x, z]); return [a, b, r]; }), ...q.map(([x, z, r]) => { const [a, b] = mirror(flipMid([x, z])); return [a, b, r]; })]; })();
export const CAMPS = CAMP_SPOTS.flatMap((c) => expand([c.at]).map(([[x, z]], i) => ({ id: c.ids[i % 2], at: [x, z], side: i < 2 ? 'blue' : 'red' })));

// ---------- 정글 몬스터 (시간이 갈수록 강해진다) ----------
export const MONS = {
  wolves: { name: '솜사탕 늑대', emoji: '🐺', big: { hp: 620, ad: 28 }, small: { hp: 190, ad: 12, n: 2 }, gold: 75, xp: 130, respawn: 110, color: '#d9c7ff', as: 0.85, ms: 7 },
  frogs: { name: '젤리 개구리', emoji: '🐸', big: { hp: 680, ad: 24 }, small: { hp: 150, ad: 9, n: 3 }, gold: 80, xp: 135, respawn: 110, color: '#7ce08a', on: { slow: 0.2, slowT: 1 } },
  golem: { name: '설탕 골렘', emoji: '🗿', big: { hp: 900, ad: 34 }, small: { hp: 300, ad: 14, n: 1 }, gold: 95, xp: 150, respawn: 120, color: '#e8d6b0', as: 0.5, ar: 28 },
  crab: { name: '사탕 집게게', emoji: '🦀', big: { hp: 640, ad: 30 }, small: { hp: 170, ad: 11, n: 2 }, gold: 78, xp: 132, respawn: 110, color: '#ff8a70', ar: 34, as: 0.65 },
  bats: { name: '초코 박쥐 떼', emoji: '🦇', big: { hp: 460, ad: 20 }, small: { hp: 130, ad: 10, n: 4 }, gold: 82, xp: 135, respawn: 110, color: '#7a5a8c', as: 1.05, ms: 8, fly: 1.7 },
  snail: { name: '캐러멜 달팽이', emoji: '🐌', big: { hp: 1250, ad: 40 }, gold: 95, xp: 150, respawn: 120, color: '#e3b070', as: 0.45, ms: 3.5, ar: 40, on: { slow: 0.35, slowT: 1.5 } },
  duck: { name: '퐁당 오리', emoji: '🦆', peace: true, big: { hp: 260, ad: 0 }, gold: 45, xp: 70, respawn: 150, first: 150, color: '#fff2a8', ms: 5.2, desc: '안 싸우고 도망쳐요. 잡으면 체력 · 마나가 차고 잠깐 빨라져요' },
  // 벌레왕 넷: 다음에 무엇이 나올지 위에 보여요. 한 팀이 셋을 잡으면 왕관을 써요
  bee: { name: '왕꿀벌', emoji: '🐝', epic: true, slot: 'bug', fly: 1.3, big: { hp: 3000, ad: 70 }, gold: 150, xp: 300, respawn: 240, first: 180, color: '#ffd23f', stack: 'bee', buff: '🍯 꿀의 힘: 팀 전체 공격력 · 주문력 +8% (경기 끝까지)', boss: { name: '독침 소나기', r: 4.2, cd: 6, delay: 1, dmg: 110, on: { slow: 0.3, slowT: 1.5 } } },
  moth: { name: '달빛 나방', emoji: '🦋', epic: true, slot: 'bug', fly: 1.5, big: { hp: 2700, ad: 60 }, gold: 150, xp: 300, respawn: 240, first: 180, color: '#cfd8ff', stack: 'moth', buff: '🌙 달가루: 팀 전체 재사용 대기 8% 줄어요 (경기 끝까지)', boss: { name: '잠 가루', r: 5, cd: 7, delay: 1.1, dmg: 80, on: { silence: 1.5, slow: 0.25, slowT: 1.5 } } },
  beetle: { name: '강철 장수벌레', emoji: '🪲', epic: true, slot: 'bug', big: { hp: 3400, ad: 80 }, gold: 150, xp: 300, respawn: 240, first: 180, color: '#4f6d8f', ar: 45, stack: 'beetle', buff: '🛡️ 강철 등딱지: 팀 전체 방어력 · 마법 저항 +10 (경기 끝까지)', boss: { name: '뿔 내려찍기', r: 3.6, cd: 7, delay: 1, dmg: 130, on: { stun: 0.8 } } },
  firefly: { name: '불꽃 반딧불이', emoji: '🔥', epic: true, slot: 'bug', fly: 1.2, big: { hp: 2800, ad: 66 }, gold: 150, xp: 300, respawn: 240, first: 180, color: '#ffb347', stack: 'firefly', buff: '✨ 불꽃 꼬리: 팀 전체 이동 속도 +0.25, 초당 체력 회복 +2 (경기 끝까지)', boss: { name: '불꽃 터뜨리기', r: 4.6, cd: 6, delay: 0.9, dmg: 120 } },
  // 큰 보스 · 맨 나중의 보스
  mold: { name: '거대 곰팡이왕', emoji: '🍄', epic: true, slot: 'mold', big: { hp: 7000, ad: 130 }, gold: 300, xp: 500, respawn: 300, first: 480, color: '#b48aff', ar: 30, buff: '🍄 곰팡이왕의 축복: 2분 동안 공격력 · 주문력 +30, 함께 달리는 꼬마들이 튼튼해져요', boss: { name: '포자 구름', r: 6, cd: 6, delay: 1.2, dmg: 170, on: { slow: 0.45, slowT: 2 } } },
  turtle: { name: '태고의 별 거북', emoji: '🐢', epic: true, slot: 'bug', big: { hp: 5200, ad: 170 }, gold: 350, xp: 600, respawn: 360, first: 900, color: '#6fb8a8', ar: 50, ms: 4.5, buff: '🌟 별가루: 2분 30초 동안 챔피언을 때리면 별가루가 타오르고, 체력 15% 아래면 바로 쓰러뜨려요', boss: { name: '땅 울리기', r: 8, cd: 7, delay: 1.3, dmg: 220, on: { knock: 0.7 } } },
};

// ---------- 레벨 ----------
export const MAX_LEVEL = 15;
export const XP_NEED = Array.from({ length: MAX_LEVEL }, (_, i) => 180 + i * 90); // i 레벨 → i+1 레벨에 필요한 경험치
export const R_LEVELS = [5, 9, 13];

// ---------- 기술 표 ----------
//   kind: shot(곧게 날아감) · aoe(땅 한 곳, delay 뒤) · nova(내 주변) · cone(부채꼴) · zone(장판) · dash(돌진) · blink(순간이동) · hit(대상 하나) · buff(내 강화) · ally(아군 치유 · 보호막)
//   dmg: 기술 레벨별 피해 · ad · ap: 계수 · type: phys | magic · on: { stun, root, slow, slowT, knock, silence, burn } · self: 시전자에게 주는 효과
const K = {
  shot: (o) => ({ kind: 'shot', range: 22, width: 1.3, speed: 34, ...o }),
  aoe: (o) => ({ kind: 'aoe', range: 18, radius: 4, delay: 0.5, ...o }),
  nova: (o) => ({ kind: 'nova', radius: 5, ...o }),
  cone: (o) => ({ kind: 'cone', range: 9, arc: 0.6, ...o }),
  zone: (o) => ({ kind: 'zone', range: 18, radius: 4.5, dur: 3, ...o }),
  dash: (o) => ({ kind: 'dash', range: 12, speed: 34, radius: 2.4, ...o }),
  blink: (o) => ({ kind: 'blink', range: 11, ...o }),
  hit: (o) => ({ kind: 'hit', range: 12, ...o }),
  buff: (o) => ({ kind: 'buff', dur: 4, ...o }),
  ally: (o) => ({ kind: 'ally', range: 16, ...o }),
};
const R5 = (a, step) => [0, 1, 2, 3, 4].map((i) => a + step * i);
const R3 = (a, step) => [0, 1, 2].map((i) => a + step * i);

// 계열별 기본 능력치 (1레벨 + 레벨당)
const CLS = {
  tank: { hp: [720, 105], mp: [300, 35], ad: [58, 3.6], ap: [0, 0], ar: [38, 4.2], mr: [34, 2], as: [0.68, 0.018], ms: 6.9, range: 2.6, reg: [1.4, 0.16] },
  fighter: { hp: [660, 98], mp: [280, 32], ad: [66, 4.2], ap: [0, 0], ar: [34, 3.6], mr: [32, 1.6], as: [0.72, 0.022], ms: 7.1, range: 2.6, reg: [1.2, 0.14] },
  assassin: { hp: [570, 86], mp: [260, 30], ad: [68, 4.6], ap: [0, 0], ar: [28, 3], mr: [30, 1.4], as: [0.74, 0.024], ms: 7.3, range: 2.5, reg: [1, 0.12] },
  mage: { hp: [510, 78], mp: [430, 52], ad: [48, 2.8], ap: [25, 2], ar: [22, 2.8], mr: [30, 1.2], as: [0.64, 0.014], ms: 6.8, range: 9.5, reg: [0.8, 0.1], proj: 1 },
  marks: { hp: [520, 84], mp: [300, 34], ad: [62, 3.8], ap: [0, 0], ar: [24, 3], mr: [28, 1.2], as: [0.72, 0.03], ms: 6.9, range: 11, reg: [0.8, 0.1], proj: 1 },
  support: { hp: [560, 86], mp: [400, 46], ad: [46, 2.6], ap: [20, 1.6], ar: [26, 3.2], mr: [30, 1.2], as: [0.62, 0.014], ms: 6.9, range: 9, reg: [1, 0.12], proj: 1 },
};
const C = (id, name, emoji, cls, roles, color, held, acc, tip, passive, q, w, e, r) => ({ id, name, emoji, cls, roles, color, held, acc, tip, passive, skills: { q, w, e, r }, stats: CLS[cls] });

export const CHAMPS = [
  // ---------- 탑 ----------
  C('mongle', '몽글장군', '🛡️', 'tank', ['top', 'sup'], '#9fb7d9', 'sword', ['helm_iron'], '맞으면서 버티다 적을 붙잡는 푹신한 방패 장군',
    { name: '푹신한 갑옷', desc: '받는 피해가 10% 줄어요', kind: 'armor', v: 0.1 },
    { name: '방패 던지기', icon: '🛡️', cd: 8, mana: 40, color: '#9fd8ff', desc: '방패를 던져 맞은 적을 느리게 해요', ...K.shot({ dmg: R5(70, 40), ap: 0.4, ad: 0.5, type: 'phys', on: { slow: 0.35, slowT: 2 } }) },
    { name: '젤리 몸통', icon: '💪', cd: 14, mana: 50, color: '#bfe6ff', desc: '4초 동안 방어력 · 마법 저항이 크게 올라요', ...K.buff({ stats: { ar: 40, mr: 40 }, statsUp: 12 }) },
    { name: '돌진 박치기', icon: '🐏', cd: 12, mana: 60, color: '#9fb7d9', desc: '앞으로 돌진해 부딪힌 적을 띄워요', ...K.dash({ range: 10, dmg: R5(60, 35), ap: 0.4, ad: 0.4, type: 'phys', on: { knock: 0.8 } }) },
    { name: '대지 내려찍기', icon: '💥', cd: 90, mana: 100, color: '#7cc4ff', desc: '주변 적을 크게 띄우고 피해를 줘요', ...K.nova({ radius: 7, dmg: R3(180, 110), ap: 0.6, ad: 0.5, type: 'magic', on: { knock: 1.4 } }) }),
  C('ironbear', '철판곰', '🍳', 'fighter', ['top', 'jungle'], '#b9a58a', 'sword', ['chef'], '프라이팬으로 치고 빠지는 곰. 체력이 낮을수록 강해져요',
    { name: '뜨거운 팬', desc: '체력이 적을수록 공격력이 최대 30% 높아져요', kind: 'rage', v: 0.3 },
    { name: '팬 휘두르기', icon: '🍳', cd: 6, mana: 25, color: '#ffb36b', desc: '주변을 휘둘러 피해를 주고 맞은 만큼 회복해요', ...K.nova({ radius: 4.2, dmg: R5(70, 38), ad: 0.9, type: 'phys', healHit: 0.25 }) },
    { name: '기름 튀기기', icon: '💧', cd: 11, mana: 40, color: '#ffe08a', desc: '앞으로 기름을 뿌려 느리게 하고 불태워요', ...K.cone({ range: 9, dmg: R5(50, 30), ad: 0.5, type: 'magic', on: { slow: 0.4, slowT: 2, burn: 40 } }) },
    { name: '구르기', icon: '🌀', cd: 9, mana: 30, color: '#d9c7a8', desc: '짧게 굴러 빠져요. 다음 공격이 강해져요', ...K.dash({ range: 7, dmg: R5(0, 0), buffNext: 1.5 }) },
    { name: '끓는 분노', icon: '🔥', cd: 100, mana: 80, color: '#ff6b3c', desc: '8초 동안 공격력 · 공격 속도 · 이동 속도가 크게 올라요', ...K.buff({ dur: 8, stats: { ad: 40, as: 0.45, ms: 1.2 }, statsUp: 25 }) }),
  C('berryaxe', '도끼딸기', '🪓', 'fighter', ['top', 'mid'], '#ff6b7a', 'axe', ['bow:#3d8b37'], '도끼를 던져 잡아 오면 강해지는 싸움꾼 딸기',
    { name: '딸기 씨 출혈', desc: '기본 공격이 3번째마다 추가 피해를 줘요', kind: 'third', v: 0.6 },
    { name: '도끼 던지기', icon: '🪓', cd: 7, mana: 30, color: '#ff8a7a', desc: '곧게 도끼를 던져요. 줄 끝까지 꿰뚫어요', ...K.shot({ range: 20, width: 1.6, dmg: R5(75, 42), ad: 0.9, type: 'phys', pierce: true }) },
    { name: '줄기 올가미', icon: '🌱', cd: 13, mana: 45, color: '#7ce08a', desc: '땅에 올가미를 놓아 잠깐 묶어요', ...K.aoe({ range: 15, radius: 3.4, delay: 0.6, dmg: R5(60, 30), ad: 0.5, type: 'phys', on: { root: 1.2 } }) },
    { name: '뛰어들기', icon: '🦘', cd: 12, mana: 40, color: '#ffb3b3', desc: '적에게 뛰어들어 피해를 줘요', ...K.dash({ range: 11, speed: 28, dmg: R5(60, 34), ad: 0.6, type: 'phys', on: { slow: 0.3, slowT: 1.5 } }) },
    { name: '딸기 처형', icon: '⚔️', cd: 85, mana: 90, color: '#ff3b5c', desc: '대상 하나를 내려쳐요. 체력이 적을수록 큰 피해', ...K.hit({ range: 8, dmg: R3(170, 110), ad: 1, type: 'phys', execute: 1.2 }) }),
  // ---------- 정글 ----------
  C('vine', '덩굴곰', '🌿', 'tank', ['jungle', 'sup'], '#6aa84f', 'club', ['sprout'], '덩굴로 붙잡아 끌고 다니는 숲의 수호자',
    { name: '숲의 숨결', desc: '싸우지 않을 때 체력이 빠르게 차요', kind: 'regen', v: 0.012 },
    { name: '덩굴 채찍', icon: '🌿', cd: 9, mana: 40, color: '#7cd04a', desc: '덩굴을 뻗어 맞은 적을 묶어요', ...K.shot({ range: 19, width: 1.5, speed: 30, dmg: R5(65, 35), ap: 0.5, type: 'magic', on: { root: 1.3 } }) },
    { name: '가시 껍질', icon: '🌵', cd: 12, mana: 45, color: '#a6ff5e', desc: '주변 적에게 3초 동안 피해를 주고 방어력이 올라요', ...K.zone({ range: 0, radius: 5, dur: 3, follow: true, dmg: R5(30, 16), ap: 0.25, type: 'magic', stats: { ar: 25, mr: 15 } }) },
    { name: '뿌리 박기', icon: '🪵', cd: 11, mana: 40, color: '#8f6a3f', desc: '주변 땅을 울려 적을 느리게 해요', ...K.nova({ radius: 6, dmg: R5(55, 30), ap: 0.4, type: 'magic', on: { slow: 0.5, slowT: 2 } }) },
    { name: '거대 덩굴', icon: '🌳', cd: 100, mana: 100, color: '#3f8f3a', desc: '넓은 곳을 덩굴로 뒤덮어 모두 묶어요', ...K.aoe({ range: 20, radius: 8, delay: 0.7, dmg: R3(150, 100), ap: 0.7, type: 'magic', on: { root: 1.8 } }) }),
  C('fang', '송곳니', '🦷', 'assassin', ['jungle', 'mid'], '#8e8ea8', 'dagger', ['mask'], '혼자 있는 적을 물어뜯는 그림자 사냥꾼',
    { name: '외톨이 사냥', desc: '주변에 다른 적이 없는 대상에게 피해 +20%', kind: 'isolate', v: 0.2 },
    { name: '물어뜯기', icon: '🦷', cd: 6, mana: 25, color: '#c9c9e6', desc: '대상을 물어 피해를 주고 회복해요', ...K.hit({ range: 5, dmg: R5(75, 42), ad: 1, type: 'phys', healHit: 0.3 }) },
    { name: '안개 몸', icon: '🌫️', cd: 18, mana: 45, color: '#8e8ea8', desc: '2.5초 동안 빨라지고 모습을 감춰요', ...K.buff({ dur: 2.5, stats: { ms: 2.5 }, stealth: true }) },
    { name: '덮치기', icon: '🐾', cd: 10, mana: 35, color: '#a8a8c8', desc: '멀리 덮쳐 주변에 피해를 줘요', ...K.dash({ range: 12, speed: 36, dmg: R5(65, 35), ad: 0.7, type: 'phys', on: { slow: 0.35, slowT: 1.5 } }) },
    { name: '피의 굶주림', icon: '🩸', cd: 85, mana: 80, color: '#c2255c', desc: '6초 동안 공격력과 흡혈이 크게 올라요', ...K.buff({ dur: 6, stats: { ad: 45, lifesteal: 0.35, ms: 1 }, statsUp: 30 }) }),
  C('boltbun', '번개토끼', '🐰', 'fighter', ['jungle', 'top'], '#ffe066', 'staff_lightning', ['bunny'], '번개처럼 들어가 치고 튀는 토끼',
    { name: '정전기', desc: '기술을 쓰면 다음 기본 공격이 마법 피해를 더 줘요', kind: 'spellblade', v: 0.7 },
    { name: '번개 찌르기', icon: '⚡', cd: 5, mana: 25, color: '#ffe066', desc: '앞으로 번개를 찔러요', ...K.shot({ range: 13, width: 1.8, speed: 60, dmg: R5(65, 36), ad: 0.7, type: 'magic' }) },
    { name: '토끼 뜀', icon: '🐇', cd: 8, mana: 30, color: '#fff3a0', desc: '짧게 뛰어 주변에 피해를 줘요', ...K.dash({ range: 9, speed: 42, dmg: R5(55, 30), ad: 0.5, type: 'magic' }) },
    { name: '전기 그물', icon: '🕸️', cd: 13, mana: 45, color: '#9fe8ff', desc: '주변 적을 잠깐 기절시켜요', ...K.nova({ radius: 4.5, dmg: R5(50, 28), ad: 0.4, type: 'magic', on: { stun: 0.8 } }) },
    { name: '천둥 강하', icon: '🌩️', cd: 90, mana: 90, color: '#ffd23f', desc: '먼 곳으로 뛰어올라 번개로 내려꽂아요', ...K.dash({ range: 26, speed: 50, radius: 5.5, dmg: R3(170, 110), ad: 0.9, type: 'magic', on: { knock: 1 } }) }),
  C('sweetthief', '달콤도적', '🍭', 'assassin', ['jungle', 'mid'], '#ff9fe0', 'dagger', ['headband:#ff5fb2'], '사탕을 뿌려 정신 빼놓고 금화를 훔치는 도적',
    { name: '슬쩍', desc: '챔피언을 처치하면 금화를 100 더 받아요', kind: 'killgold', v: 100 },
    { name: '사탕 표창', icon: '🍬', cd: 5, mana: 25, color: '#ff9fe0', desc: '표창 3개를 부채꼴로 던져요', ...K.shot({ range: 17, width: 1.2, speed: 38, fan: 3, dmg: R5(55, 30), ad: 0.7, type: 'phys' }) },
    { name: '끈적 함정', icon: '🍯', cd: 14, mana: 45, color: '#ffc14d', desc: '끈끈한 장판으로 적을 느리게 해요', ...K.zone({ range: 15, radius: 4.5, dur: 3, dmg: R5(20, 12), ap: 0.2, type: 'magic', on: { slow: 0.5, slowT: 1 } }) },
    { name: '뒤로 돌기', icon: '💨', cd: 9, mana: 30, color: '#ffd1ec', desc: '대상 뒤로 순간이동해요', ...K.blink({ range: 10 }) },
    { name: '설탕 폭풍', icon: '🌪️', cd: 90, mana: 90, color: '#ff5fb2', desc: '3초 동안 주변을 휘감아 큰 피해를 줘요', ...K.zone({ range: 0, radius: 6, dur: 3, follow: true, dmg: R3(100, 65), ad: 0.6, type: 'phys', stats: { ms: 1 } }) }),
  // ---------- 미드 ----------
  C('flame', '불꽃마녀', '🔥', 'mage', ['mid'], '#ff7a3c', 'wand', ['wizard'], '먼 거리에서 불로 태워 버리는 마녀',
    { name: '잔불', desc: '기술에 맞은 적이 2초 동안 타요', kind: 'burn', v: 0.3 },
    { name: '불덩이', icon: '🔥', cd: 5, mana: 45, color: '#ff8a3c', desc: '곧게 날아가 터지는 불덩이', ...K.shot({ range: 24, width: 1.5, speed: 30, burst: 2.8, dmg: R5(85, 45), ap: 0.75, type: 'magic' }) },
    { name: '불기둥', icon: '🌋', cd: 10, mana: 65, color: '#ff5a1f', desc: '잠시 뒤 땅에서 불기둥이 솟아 기절시켜요', ...K.aoe({ range: 20, radius: 3.6, delay: 0.75, dmg: R5(90, 45), ap: 0.8, type: 'magic', on: { stun: 1 } }) },
    { name: '불의 장막', icon: '🧱', cd: 14, mana: 60, color: '#ffb36b', desc: '땅에 불길을 남겨요', ...K.zone({ range: 18, radius: 4.5, dur: 3.5, dmg: R5(30, 16), ap: 0.2, type: 'magic' }) },
    { name: '대폭염', icon: '☀️', cd: 95, mana: 120, color: '#ff3b1f', desc: '넓은 곳을 한꺼번에 불태워요', ...K.aoe({ range: 26, radius: 8, delay: 1, dmg: R3(240, 140), ap: 1, type: 'magic' }) }),
  C('icestar', '얼음별', '❄️', 'mage', ['mid', 'sup'], '#8fd8ff', 'wand', ['beanie:#bfe8ff'], '느리게 하고 얼려서 아무도 못 다가오게 해요',
    { name: '서리', desc: '기술에 맞은 적이 잠깐 느려져요', kind: 'frost', v: 0.2 },
    { name: '얼음 화살', icon: '🧊', cd: 5, mana: 40, color: '#8fd8ff', desc: '꿰뚫는 얼음 화살', ...K.shot({ range: 24, width: 1.4, speed: 36, pierce: true, dmg: R5(75, 40), ap: 0.7, type: 'magic', on: { slow: 0.3, slowT: 1.5 } }) },
    { name: '서리 고리', icon: '💠', cd: 12, mana: 60, color: '#bfefff', desc: '땅을 얼려 잠시 뒤 묶어요', ...K.aoe({ range: 18, radius: 4.2, delay: 0.8, dmg: R5(70, 38), ap: 0.6, type: 'magic', on: { root: 1.4 } }) },
    { name: '눈보라 막', icon: '🌨️', cd: 16, mana: 55, color: '#e6fbff', desc: '4초 동안 보호막을 두르고 빨라져요', ...K.buff({ dur: 4, shield: R5(80, 45), shieldAp: 0.5, stats: { ms: 0.8 } }) },
    { name: '영원의 겨울', icon: '🌌', cd: 100, mana: 120, color: '#5fb7ff', desc: '넓은 장판으로 적을 크게 느리게 하고 피해를 줘요', ...K.zone({ range: 24, radius: 9, dur: 4, dmg: R3(70, 40), ap: 0.35, type: 'magic', on: { slow: 0.6, slowT: 1 } }) }),
  C('shade', '그림자꼬리', '🌙', 'assassin', ['mid', 'jungle'], '#6a5acd', 'dagger', ['cape:#3a2f6a'], '그림자로 뛰어들어 순식간에 끝내는 암살자',
    { name: '꼬리 표식', desc: '체력 35% 아래인 적에게 피해 +20%', kind: 'lowhp', v: 0.2 },
    { name: '그림자 칼날', icon: '🌙', cd: 5, mana: 35, color: '#9b8bff', desc: '칼날을 날려 줄 위 적을 베요', ...K.shot({ range: 19, width: 1.6, speed: 44, pierce: true, dmg: R5(75, 42), ad: 0.85, type: 'phys' }) },
    { name: '어둠 베기', icon: '🗡️', cd: 8, mana: 30, color: '#6a5acd', desc: '주변을 베어 느리게 해요', ...K.nova({ radius: 4.4, dmg: R5(65, 36), ad: 0.7, type: 'phys', on: { slow: 0.3, slowT: 1.2 } }) },
    { name: '그림자 넘기', icon: '🌑', cd: 11, mana: 40, color: '#3a2f6a', desc: '순간이동해요', ...K.blink({ range: 12 }) },
    { name: '꼬리의 심판', icon: '🌠', cd: 85, mana: 80, color: '#b48aff', desc: '대상에게 날아가 큰 피해를 줘요', ...K.hit({ range: 16, jump: true, dmg: R3(190, 120), ad: 1.1, type: 'phys', execute: 0.8 }) }),
  C('meteor', '별똥술사', '☄️', 'mage', ['mid', 'bot'], '#b48aff', 'wand', ['starpin'], '맵 어디든 별똥별을 떨어뜨리는 먼 거리 마법사',
    { name: '별빛 충전', desc: '기술을 쓰면 잠깐 빨라져요', kind: 'msburst', v: 0.8 },
    { name: '별 조각', icon: '⭐', cd: 4, mana: 40, color: '#ffe066', desc: '별 조각을 쏘아요', ...K.shot({ range: 25, width: 1.2, speed: 42, dmg: R5(70, 36), ap: 0.65, type: 'magic' }) },
    { name: '중력 끌기', icon: '🕳️', cd: 13, mana: 60, color: '#8a6bff', desc: '잠시 뒤 적을 띄우고 피해를 줘요', ...K.aoe({ range: 20, radius: 4, delay: 0.7, dmg: R5(70, 38), ap: 0.65, type: 'magic', on: { knock: 0.9 } }) },
    { name: '별의 보호', icon: '🌟', cd: 14, mana: 55, color: '#d6c2ff', desc: '잠깐 보호막을 둘러요', ...K.buff({ dur: 3, shield: R5(70, 40), shieldAp: 0.55 }) },
    { name: '유성 낙하', icon: '☄️', cd: 110, mana: 130, color: '#c79bff', desc: '맵 어디든 2초 뒤 거대한 유성이 떨어져요', ...K.aoe({ range: 400, radius: 9, delay: 2, dmg: R3(280, 170), ap: 1, type: 'magic', on: { knock: 0.8 } }) }),
  C('clockfairy', '시계요정', '⏰', 'mage', ['mid', 'sup'], '#ffd166', 'wand', ['goggles'], '시간을 비틀어 적은 느리게, 나는 빠르게',
    { name: '시간 빚', desc: '기본 공격이 마법 피해를 더 줘요', kind: 'onhitap', v: 0.35 },
    { name: '초침 던지기', icon: '🕰️', cd: 5, mana: 40, color: '#ffd166', desc: '초침을 던져 느리게 해요', ...K.shot({ range: 22, width: 1.4, speed: 32, dmg: R5(65, 36), ap: 0.65, type: 'magic', on: { slow: 0.4, slowT: 1.5 } }) },
    { name: '시간 정지 지뢰', icon: '⏳', cd: 14, mana: 60, color: '#fff3b0', desc: '땅 한 곳의 시간을 멈춰 기절시켜요', ...K.aoe({ range: 18, radius: 3.4, delay: 1, dmg: R5(60, 34), ap: 0.5, type: 'magic', on: { stun: 1.3 } }) },
    { name: '빨리 감기', icon: '⏩', cd: 14, mana: 50, color: '#ffe9a0', desc: '4초 동안 나를 크게 빠르게 해요', ...K.buff({ dur: 4, stats: { ms: 2.2, as: 0.3 } }) },
    { name: '되돌리기', icon: '🔁', cd: 110, mana: 100, color: '#ffb300', desc: '잃은 체력의 절반을 되돌리고 주변 적을 느리게 해요', ...K.nova({ radius: 7, dmg: R3(120, 80), ap: 0.5, type: 'magic', healMissing: 0.5, on: { slow: 0.5, slowT: 2.5 } }) }),
  // ---------- 바텀 ----------
  C('pine', '솔방울궁수', '🏹', 'marks', ['bot'], '#8fbf6a', 'bow', ['cap:#5c7c3a'], '꾸준히 활을 쏘는 정석 원거리',
    { name: '연속 활시위', desc: '공격할수록 공격 속도가 올라요 (최대 4번)', kind: 'stackas', v: 0.08 },
    { name: '관통 화살', icon: '🏹', cd: 6, mana: 35, color: '#b6ff8a', desc: '멀리 꿰뚫는 화살', ...K.shot({ range: 26, width: 1.2, speed: 48, pierce: true, dmg: R5(70, 36), ad: 1, type: 'phys' }) },
    { name: '화살 비', icon: '🌧️', cd: 12, mana: 50, color: '#d6f7a8', desc: '한 곳에 화살을 쏟아 느리게 해요', ...K.aoe({ range: 20, radius: 4.4, delay: 0.5, dmg: R5(60, 32), ad: 0.6, type: 'phys', on: { slow: 0.35, slowT: 1.5 } }) },
    { name: '구르기', icon: '🌀', cd: 11, mana: 25, color: '#e8ffd6', desc: '짧게 굴러 빠져요', ...K.dash({ range: 8, speed: 40, dmg: R5(0, 0) }) },
    { name: '숲의 큰 화살', icon: '🎯', cd: 80, mana: 90, color: '#7cd04a', desc: '맵 멀리까지 날아가 맞은 적을 기절시켜요', ...K.shot({ range: 80, width: 2.4, speed: 42, dmg: R3(220, 130), ad: 1, type: 'phys', on: { stun: 1.5 } }) }),
  C('honeygun', '꿀총잡이', '🔫', 'marks', ['bot', 'mid'], '#ffc14d', 'pistol', ['cowboy'], '한 방 한 방 묵직한 총잡이',
    { name: '끈적 총알', desc: '4번째 공격은 치명타예요', kind: 'fourth', v: 1 },
    { name: '꿀탄', icon: '🍯', cd: 7, mana: 35, color: '#ffc14d', desc: '맞으면 느려지는 꿀탄', ...K.shot({ range: 22, width: 1.3, speed: 46, dmg: R5(70, 40), ad: 1.1, type: 'phys', on: { slow: 0.4, slowT: 1.5 } }) },
    { name: '속사', icon: '⚙️', cd: 13, mana: 40, color: '#ffe08a', desc: '4초 동안 공격 속도가 크게 올라요', ...K.buff({ dur: 4, stats: { as: 0.7 }, statsUp: 0.1 }) },
    { name: '뒤로 뛰며 쏘기', icon: '💨', cd: 11, mana: 30, color: '#fff3b0', desc: '뒤로 물러나며 맞은 적에게 피해', ...K.dash({ range: 8, speed: 36, back: true, dmg: R5(45, 28), ad: 0.5, type: 'phys', radius: 4 }) },
    { name: '마지막 한 발', icon: '💥', cd: 75, mana: 80, color: '#ff9a3c', desc: '먼 대상에게 강력한 한 발. 체력이 적을수록 커요', ...K.hit({ range: 26, dmg: R3(220, 130), ad: 1.3, type: 'phys', execute: 0.7 }) }),
  C('firework', '폭죽소녀', '🎆', 'marks', ['bot', 'mid'], '#ff6fd8', 'cannon', ['partyhat'], '폭죽으로 건물까지 터뜨리는 공성 전문가',
    { name: '터지는 탄', desc: '기본 공격이 주변에도 조금 튀어요', kind: 'splash', v: 0.35 },
    { name: '폭죽 다발', icon: '🎇', cd: 6, mana: 40, color: '#ff6fd8', desc: '날아가 터지는 폭죽', ...K.shot({ range: 22, width: 1.5, speed: 34, burst: 3.2, dmg: R5(70, 38), ad: 0.8, type: 'phys' }) },
    { name: '폭죽 지뢰', icon: '🧨', cd: 12, mana: 45, color: '#ffb43a', desc: '잠시 뒤 터져 띄워요', ...K.aoe({ range: 17, radius: 3.6, delay: 0.9, dmg: R5(70, 36), ad: 0.6, type: 'phys', on: { knock: 0.7 } }) },
    { name: '공성 자세', icon: '🏰', cd: 16, mana: 40, color: '#ffd0ec', desc: '4초 동안 사거리와 건물 피해가 올라요', ...K.buff({ dur: 4, stats: { range: 3, as: 0.2, siege: 0.5 } }) },
    { name: '대형 축포', icon: '🎉', cd: 85, mana: 100, color: '#ff3bb0', desc: '멀리까지 거대한 축포를 날려요', ...K.shot({ range: 60, width: 3, speed: 36, burst: 6.5, dmg: R3(230, 140), ad: 1, type: 'phys' }) }),
  C('hunter', '사냥꾼곰', '🪤', 'marks', ['bot', 'top'], '#a07850', 'crossbow', ['cap:#5c7c3a'], '덫을 깔아 놓고 기다리는 침착한 사냥꾼',
    { name: '사냥감 표시', desc: '기술에 맞은 적이 받는 기본 공격 피해 +15%', kind: 'mark', v: 0.15 },
    { name: '석궁 저격', icon: '🎯', cd: 7, mana: 35, color: '#d9c7a8', desc: '곧게 날아가는 강한 화살', ...K.shot({ range: 26, width: 1.1, speed: 56, dmg: R5(80, 42), ad: 1.1, type: 'phys' }) },
    { name: '곰덫', icon: '🪤', cd: 10, mana: 40, color: '#c9c9d6', desc: '땅에 덫을 놓아 밟으면 묶어요 (금방 터져요)', ...K.aoe({ range: 14, radius: 2.8, delay: 0.4, dmg: R5(55, 30), ad: 0.5, type: 'phys', on: { root: 1.6 } }) },
    { name: '뛰어 물러나기', icon: '🦘', cd: 12, mana: 25, color: '#e8d6b0', desc: '보는 방향으로 뛰어요', ...K.dash({ range: 9, speed: 40, dmg: R5(0, 0) }) },
    { name: '일제 사격', icon: '🌠', cd: 80, mana: 90, color: '#a07850', desc: '넓은 곳에 화살을 퍼부어요', ...K.zone({ range: 24, radius: 7, dur: 2.5, dmg: R3(110, 70), ad: 0.6, type: 'phys', on: { slow: 0.3, slowT: 1 } }) }),
  // ---------- 서폿 ----------
  C('healbean', '치유콩', '💚', 'support', ['sup'], '#9be7a7', 'staff', ['halo'], '아군을 끝없이 채워 주는 콩',
    { name: '콩 나눔', desc: '아군을 치유하면 나도 조금 회복해요', kind: 'sharedheal', v: 0.3 },
    { name: '치유 콩', icon: '💚', cd: 7, mana: 55, color: '#9be7a7', desc: '아군(없으면 나)을 치유해요', ...K.ally({ heal: R5(70, 35), healAp: 0.5 }) },
    { name: '콩알탄', icon: '🟢', cd: 6, mana: 35, color: '#7cd04a', desc: '콩을 쏴서 느리게 해요', ...K.shot({ range: 20, width: 1.3, speed: 34, dmg: R5(55, 30), ap: 0.5, type: 'magic', on: { slow: 0.35, slowT: 1.5 } }) },
    { name: '콩깍지', icon: '🫛', cd: 12, mana: 50, color: '#c8ff7a', desc: '아군에게 보호막을 씌워요', ...K.ally({ shield: R5(80, 40), shieldAp: 0.5, dur: 3 }) },
    { name: '콩나무 숲', icon: '🌱', cd: 110, mana: 120, color: '#5fe0b0', desc: '맵 전체 아군을 치유해요', ...K.ally({ global: true, heal: R3(180, 100), healAp: 0.6 }) }),
  C('shieldbean', '방패콩', '🥜', 'tank', ['sup', 'top'], '#c9a26b', 'club', ['hard'], '앞장서서 적을 끌어오는 든든한 콩',
    { name: '단단한 껍질', desc: '받는 피해가 8% 줄어요', kind: 'armor', v: 0.08 },
    { name: '갈고리 콩줄', icon: '🪝', cd: 13, mana: 60, color: '#d9c7a8', desc: '맞은 적을 내 앞으로 끌어와요', ...K.shot({ range: 20, width: 1.4, speed: 36, dmg: R5(60, 32), ap: 0.4, type: 'magic', pull: true, on: { stun: 0.6 } }) },
    { name: '껍질 나눔', icon: '🛡️', cd: 12, mana: 50, color: '#e8d6b0', desc: '아군에게 보호막을 씌워요', ...K.ally({ shield: R5(90, 45), shieldAp: 0.5, dur: 3 }) },
    { name: '땅 구르기', icon: '🥁', cd: 11, mana: 45, color: '#c9a26b', desc: '주변 적을 잠깐 기절시켜요', ...K.nova({ radius: 4.5, dmg: R5(55, 30), ap: 0.4, type: 'magic', on: { stun: 0.9 } }) },
    { name: '대왕 콩 낙하', icon: '💥', cd: 100, mana: 100, color: '#a07850', desc: '뛰어올라 내려찍어 모두 기절시켜요', ...K.dash({ range: 16, speed: 30, radius: 6.5, dmg: R3(140, 90), ap: 0.6, type: 'magic', on: { stun: 1.4 } }) }),
  C('songbird', '노래새', '🎵', 'support', ['sup'], '#6ec6ff', 'lute', ['bowtie'], '노래로 아군을 빠르게, 적을 느리게 해요',
    { name: '응원가', desc: '주변 아군의 이동 속도가 조금 올라요', kind: 'aura', v: 0.4 },
    { name: '음표 날리기', icon: '🎶', cd: 5, mana: 35, color: '#6ec6ff', desc: '꿰뚫는 음표', ...K.shot({ range: 22, width: 1.5, speed: 30, pierce: true, dmg: R5(55, 30), ap: 0.55, type: 'magic' }) },
    { name: '신나는 곡', icon: '🎸', cd: 13, mana: 50, color: '#a6ff5e', desc: '주변 아군이 4초 동안 빨라지고 공격 속도가 올라요', ...K.ally({ teamBuff: { ms: 1.4, as: 0.25 }, radius: 12, dur: 4 }) },
    { name: '자장가', icon: '💤', cd: 14, mana: 60, color: '#d6c2ff', desc: '잠시 뒤 한 곳의 적을 기절시켜요', ...K.aoe({ range: 18, radius: 3.6, delay: 0.8, dmg: R5(45, 25), ap: 0.4, type: 'magic', on: { stun: 1.3 } }) },
    { name: '대합창', icon: '🎤', cd: 100, mana: 110, color: '#ffd23f', desc: '주변 아군을 크게 치유하고 빠르게 해요', ...K.ally({ global: false, radius: 16, heal: R3(160, 90), healAp: 0.6, teamBuff: { ms: 2, as: 0.3 }, dur: 5 }) }),
  C('dreamer', '꿈꾸미', '💤', 'support', ['sup', 'mid'], '#d6c2ff', 'wand', ['beanie:#d6c2ff'], '적을 재우고 아군을 지키는 졸린 곰',
    { name: '하품', desc: '기술에 맞은 적이 잠깐 느려져요', kind: 'frost', v: 0.25 },
    { name: '수면탄', icon: '😴', cd: 12, mana: 60, color: '#d6c2ff', desc: '맞은 적을 재워요 (기절)', ...K.shot({ range: 22, width: 1.2, speed: 26, dmg: R5(50, 28), ap: 0.5, type: 'magic', on: { stun: 1.6 } }) },
    { name: '폭신 구름', icon: '☁️', cd: 13, mana: 55, color: '#ffffff', desc: '아군에게 보호막을 씌워요', ...K.ally({ shield: R5(75, 40), shieldAp: 0.55, dur: 3 }) },
    { name: '양 세기', icon: '🐑', cd: 12, mana: 50, color: '#efe6ff', desc: '장판으로 적을 느리게 해요', ...K.zone({ range: 16, radius: 4.4, dur: 3, dmg: R5(20, 12), ap: 0.25, type: 'magic', on: { slow: 0.45, slowT: 1 } }) },
    { name: '깊은 잠', icon: '🌙', cd: 110, mana: 120, color: '#9b8bff', desc: '넓은 곳의 적을 모두 재워요', ...K.aoe({ range: 22, radius: 7.5, delay: 0.9, dmg: R3(110, 70), ap: 0.5, type: 'magic', on: { stun: 1.8 } }) }),
];
export const champById = (id) => CHAMPS.find((c) => c.id === id);

// ---------- 주문 ----------
export const SPELLS = {
  flash: { name: '번쩍', icon: '✨', cd: 150, desc: '짧은 거리를 순간이동해요', range: 9 },
  smite: { name: '강타', icon: '⚔️', cd: 45, desc: '몬스터 · 꼬마에게 큰 고정 피해 (정글)', range: 8 },
  heal: { name: '회복', icon: '💗', cd: 120, desc: '나와 가까운 아군의 체력을 채우고 빨라져요' },
  ignite: { name: '점화', icon: '🔥', cd: 100, desc: '적 챔피언을 3초 동안 태워요', range: 12 },
};
export const SPELL_OF_ROLE = { top: 'ignite', jungle: 'smite', mid: 'ignite', bot: 'heal', sup: 'heal' };

// ---------- 아이템 ----------
//   add: 올라가는 능력치 (hp · mp · ad · ap · ar · mr · as · ms · haste(재사용 %) · crit · lifesteal · reg)
export const ITEMS = {
  boots: { name: '젤리 신발', icon: '👟', cost: 300, add: { ms: 0.9 }, tag: 'boots', desc: '이동 속도' },
  fastboots: { name: '번개 신발', icon: '⚡', cost: 900, add: { ms: 1.5, as: 0.25 }, tag: 'boots', desc: '이동 속도 · 공격 속도' },
  magicboots: { name: '마법사 신발', icon: '🥾', cost: 950, add: { ms: 1.4, haste: 0.1, ap: 15 }, tag: 'boots', desc: '이동 속도 · 재사용 · 주문력' },
  ironboots: { name: '강철 신발', icon: '🦿', cost: 900, add: { ms: 1.4, ar: 25, mr: 20 }, tag: 'boots', desc: '이동 속도 · 방어' },
  sword: { name: '설탕 검', icon: '🗡️', cost: 900, add: { ad: 30 }, desc: '공격력' },
  bigsword: { name: '왕사탕 대검', icon: '⚔️', cost: 2400, add: { ad: 70, haste: 0.1 }, desc: '공격력 · 재사용' },
  fang: { name: '피 묻은 이빨', icon: '🩸', cost: 2500, add: { ad: 55, lifesteal: 0.18 }, desc: '공격력 · 흡혈' },
  crit: { name: '행운의 네잎', icon: '🍀', cost: 2600, add: { ad: 40, crit: 0.35, as: 0.15 }, desc: '치명타 · 공격력' },
  rapid: { name: '번개 활시위', icon: '🎐', cost: 2400, add: { as: 0.55, crit: 0.2, ms: 0.5 }, desc: '공격 속도 · 치명타' },
  lance: { name: '방패 뚫는 창', icon: '🔱', cost: 2600, add: { ad: 45, arp: 0.3 }, desc: '공격력 · 방어구 관통' },
  wand: { name: '꿈 지팡이', icon: '🪄', cost: 900, add: { ap: 35 }, desc: '주문력' },
  bigwand: { name: '별빛 대지팡이', icon: '🔮', cost: 2500, add: { ap: 95 }, desc: '주문력' },
  book: { name: '시간의 책', icon: '📖', cost: 2400, add: { ap: 60, haste: 0.2, mp: 350 }, desc: '주문력 · 재사용 · 마나' },
  deathcap: { name: '마녀 모자', icon: '🎩', cost: 3000, add: { ap: 120, mpen: 0.25 }, desc: '큰 주문력 · 마법 관통' },
  belt: { name: '튼튼 허리띠', icon: '🧷', cost: 900, add: { hp: 300 }, desc: '체력' },
  plate: { name: '철판 갑옷', icon: '🦺', cost: 2300, add: { hp: 350, ar: 60 }, desc: '체력 · 방어력' },
  cloak: { name: '마법 망토', icon: '🧥', cost: 2300, add: { hp: 350, mr: 60 }, desc: '체력 · 마법 저항' },
  heart: { name: '젤리 심장석', icon: '💖', cost: 2800, add: { hp: 800, reg: 6 }, desc: '큰 체력 · 재생' },
  charm: { name: '응원 부적', icon: '🧿', cost: 2200, add: { hp: 250, ap: 45, haste: 0.2 }, desc: '서폿: 체력 · 주문력 · 재사용' },
  potion: { name: '딸기 물약', icon: '🧃', cost: 60, use: true, desc: '10초 동안 체력 120 회복 (5개까지)' },
};
// 계열별 추천 구매 순서 (봇 · 추천 표시)
export const BUILD = {
  tank: ['boots', 'belt', 'ironboots', 'plate', 'cloak', 'heart', 'bigsword'],
  fighter: ['boots', 'sword', 'ironboots', 'fang', 'plate', 'bigsword', 'heart'],
  assassin: ['boots', 'sword', 'fastboots', 'fang', 'lance', 'bigsword', 'crit'],
  mage: ['boots', 'wand', 'magicboots', 'bigwand', 'book', 'deathcap', 'cloak'],
  marks: ['boots', 'sword', 'fastboots', 'crit', 'rapid', 'lance', 'fang'],
  support: ['boots', 'wand', 'magicboots', 'charm', 'book', 'plate', 'cloak'],
};
// 기술을 찍는 순서 (봇)
export const SKILL_ORDER = ['q', 'w', 'e', 'q', 'q', 'w', 'q', 'w', 'q', 'w', 'w', 'e', 'e', 'e', 'e'];
