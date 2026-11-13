// 젤리 아케이드 판 규칙: 격자 맵 · 곰 움직임 · 젤리 폭탄 · 물결 · 갇힘 · 구조 · 아이템 · 좁아지는 판
//   화면(혼자 하기)과 서버(같이 하기)가 같은 파일을 쓴다. three.js 없이 숫자만 다룬다
//   좌표: 칸 단위 (x 0 ~ 12, y 0 ~ 10). 곰 위치는 소수 · 칸 가운데가 정수
export const W = 13, H = 11;
export const FUSE = 2.5, FLAME_T = 0.6, TRAP_T = 5, MATCH_T = 180, FALL_EVERY = 0.38, FALL_WARN = 1.0, END_CAP = 300;
export const SPEED0 = 3.1, SPEED_STEP = 0.42, TRAP_SPEED = 0.45, CONVEYOR = 1.7;
export const MAX = { bombs: 7, range: 7, speed: 5, escape: 2 };
// 칸 종류
export const EMPTY = 0, SOLID = 1, BOX = 2, HOLE = 3, FALLEN = 4;
// 바닥: 0 보통 · 1 얼음 · 2 ~ 5 컨베이어 (→ ← ↓ ↑)
export const ICE = 1;
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const ITEMS = {
  candy: { name: '별사탕', desc: '폭탄 +1', emoji: '⭐' },
  syrup: { name: '시럽병', desc: '물결 길이 +1', emoji: '🍯' },
  shoe: { name: '운동화', desc: '빨라져요', emoji: '👟' },
  escape: { name: '탈출 젤리', desc: '갇히면 한 번 스스로 풀려요', emoji: '🍬' },
};
const ITEM_ROLL = [['candy', 0.34], ['syrup', 0.34], ['shoe', 0.2], ['escape', 0.12]];
export const ITEM_CHANCE = 0.4;

// ---------- 맵 ----------
// 왼쪽 위 4분의 1(7칸 × 6줄)만 그리고, 좌우 · 위아래로 뒤집어 붙인다 (네 구석이 공평하게)
//   S 시작 · . 빈칸 · ? 상자 자리 · # 안 부서지는 것 · w 물 (못 걷고 물결은 지나감)
//   ~ 얼음(상자 자리) · _ 얼음(빈칸) · > < v ^ 컨베이어
export const MAPS = {
  candy: {
    name: '사탕 마을', emoji: '🍭', desc: '알록달록 사탕 지붕 집 사이 골목',
    q: ['S.???.S', '.#?##?.', '?#????#', '??##?#?', '?.????.', 'S.?#??#'],
  },
  factory: {
    name: '젤리 공장', emoji: '🏭', desc: '컨베이어가 곰을 밀어요',
    q: ['S.??#?S', '.#????.', '?#>>>>?', '??^#?#v', '#?^??.v', 'S.^#?.#'],
  },
  ice: {
    name: '얼음 과자 섬', emoji: '🧊', desc: '얼음 위에서는 멈추지 못하고 미끄러져요',
    q: ['S.?~~.S', '.#~w~#.', '?~~w~~?', '?#~__#~', '??~##~.', 'S.~#~_w'],
  },
};
export const MAP_IDS = Object.keys(MAPS);
// 시작 자리: 네 구석 → 가운데 변 네 곳 (팀전은 왼쪽 · 오른쪽으로 나눈다)
export const SPAWNS = [[0, 0], [12, 10], [12, 0], [0, 10], [6, 0], [6, 10], [0, 5], [12, 5]];
export const TEAM_SPAWNS = { red: [[0, 0], [0, 10], [0, 5], [6, 0]], blue: [[12, 10], [12, 0], [12, 5], [6, 10]] };

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FLIP_X = { '>': '<', '<': '>' }, FLIP_Y = { v: '^', '^': 'v' };
export function mapRows(id) {
  const q = MAPS[id].q, rows = [];
  for (let y = 0; y < H; y++) {
    const qy = y < 6 ? y : H - 1 - y, flipY = y >= 6;
    let s = '';
    for (let x = 0; x < W; x++) {
      const qx = x < 7 ? x : W - 1 - x;
      let ch = q[qy][qx];
      if (x >= 7) ch = FLIP_X[ch] || ch;
      if (flipY) ch = FLIP_Y[ch] || ch;
      s += ch;
    }
    rows.push(s);
  }
  return rows;
}
export const idx = (x, y) => y * W + x;
export const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

// 맵 만들기: 같은 씨앗이면 어디서나 같은 판
export function buildGrid(mapId, seed) {
  const rows = mapRows(mapId), r = rng(seed ^ 0x9e3779b9);
  const grid = new Uint8Array(W * H), floor = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x], i = idx(x, y);
    if (ch === '#') grid[i] = SOLID;
    else if (ch === 'w') grid[i] = HOLE;
    else if (ch === '?') grid[i] = r() < 0.86 ? BOX : EMPTY;
    else if (ch === '~') { floor[i] = ICE; grid[i] = r() < 0.7 ? BOX : EMPTY; }
    else if (ch === '_') floor[i] = ICE;
    else if (ch === '>') floor[i] = 2; else if (ch === '<') floor[i] = 3; else if (ch === 'v') floor[i] = 4; else if (ch === '^') floor[i] = 5;
  }
  // 시작 자리와 바로 옆 두 칸은 언제나 비워 둔다
  for (const [sx, sy] of SPAWNS) {
    grid[idx(sx, sy)] = EMPTY;
    for (const [dx, dy] of DIRS) { const x = sx + dx, y = sy + dy; if (inb(x, y) && grid[idx(x, y)] === BOX) grid[idx(x, y)] = EMPTY; }
  }
  return { grid, floor };
}

// ---------- 판 만들기 ----------
// players: [{ id, team?, bot?, diff?, name? }] · mode: 'ffa' | 'team'
export function createGame({ map = 'candy', seed = 1, players = [], mode = 'ffa' }) {
  const { grid, floor } = buildGrid(map, seed);
  const S = { map, seed, mode, t: 0, grid, floor, bombs: [], flames: [], items: new Map(), players: [], falls: [], fallOrder: null, fallI: 0, fallT: 0, nextBomb: 1, over: false, winner: undefined, rnd: rng(seed * 7 + 13) };
  const used = { red: 0, blue: 0 };
  players.forEach((pl, i) => {
    const team = mode === 'team' ? (pl.team === 'blue' ? 'blue' : 'red') : `p${pl.id}`;
    const sp = mode === 'team' ? TEAM_SPAWNS[team][used[team]++ % 4] : SPAWNS[i % SPAWNS.length];
    S.players.push(newPlayer(pl, team, sp));
  });
  return S;
}
function newPlayer(pl, team, [x, y]) {
  return { id: pl.id, name: pl.name || '', team, bot: !!pl.bot, diff: pl.diff || 'normal', x, y, dir: 2, moving: false, slide: -1, lastAxis: 0, out: false, trap: 0, trapBy: 0, safe: 0, bombs: 1, range: 1, speed: 0, escape: 0, placed: 0, pops: 0, outAt: 0, wantBomb: false };
}
export const speedOf = (p) => (p.trap > 0 ? TRAP_SPEED : SPEED0 + SPEED_STEP * p.speed);
export const cellOf = (p) => [Math.round(p.x), Math.round(p.y)];
export const bombAt = (S, x, y) => S.bombs.find((b) => b.x === x && b.y === y) || null;
export const activePlayers = (S) => S.players.filter((p) => !p.out);

// 걸어 들어갈 수 있나 (지금 서 있는 칸의 폭탄은 지나갈 수 있다)
export function free(S, x, y, p) {
  if (!inb(x, y)) return false;
  const g = S.grid[idx(x, y)];
  if (g !== EMPTY) return false;
  if (p) { const [cx, cy] = cellOf(p); if (cx === x && cy === y) return true; }
  return !bombAt(S, x, y);
}

// ---------- 움직임 ----------
// 한 축으로 dist 만큼. 칸 가운데로 붙고, 모서리에 살짝 걸리면 옆으로 미끄러져 돌아간다
export function tryMove(S, p, dx, dy, dist) {
  const cx = Math.round(p.x), cy = Math.round(p.y);
  if (dx) {
    const off = p.y - cy, nx = cx + dx;
    if (free(S, nx, cy, p)) {
      const a = Math.min(Math.abs(off), dist); p.y -= Math.sign(off) * a;
      p.x += dx * (dist - a * 0.5);
      return true;
    }
    const sy = Math.sign(off);
    if (Math.abs(off) > 0.12 && free(S, nx, cy + sy, p) && free(S, cx, cy + sy, p)) { p.y += sy * dist; return true; }
    // 막혔다: 지금 칸 가운데까지만
    const rx = cx - p.x; let moved = false;
    if (dx * rx > 1e-4) { p.x += dx * Math.min(dist, Math.abs(rx)); moved = true; }
    if (Math.abs(off) > 1e-4) { p.y -= Math.sign(off) * Math.min(Math.abs(off), dist); moved = true; }
    return moved;
  }
  if (dy) {
    const off = p.x - cx, ny = cy + dy;
    if (free(S, cx, ny, p)) {
      const a = Math.min(Math.abs(off), dist); p.x -= Math.sign(off) * a;
      p.y += dy * (dist - a * 0.5);
      return true;
    }
    const sx = Math.sign(off);
    if (Math.abs(off) > 0.12 && free(S, cx + sx, ny, p) && free(S, cx + sx, cy, p)) { p.x += sx * dist; return true; }
    const ry = cy - p.y; let moved = false;
    if (dy * ry > 1e-4) { p.y += dy * Math.min(dist, Math.abs(ry)); moved = true; }
    if (Math.abs(off) > 1e-4) { p.x -= Math.sign(off) * Math.min(Math.abs(off), dist); moved = true; }
    return moved;
  }
  return false;
}
const dirIndex = (dx, dy) => (dx > 0 ? 0 : dx < 0 ? 1 : dy > 0 ? 2 : 3);
// 입력(dx, dy: -1 · 0 · 1) 으로 dt 만큼 움직이기. 두 방향을 같이 누르면 막히지 않은 쪽 · 꺾는 쪽 먼저
export function movePlayer(S, p, ix, iy, dt) {
  if (p.out) return;
  const [cx, cy] = cellOf(p), fl = S.floor[idx(cx, cy)];
  let dist = speedOf(p) * dt;
  // 얼음: 손을 떼도 가던 쪽으로 미끄러진다
  if (!ix && !iy && fl === ICE && p.slide >= 0 && p.trap <= 0) { [ix, iy] = DIRS[p.slide]; dist *= 0.95; }
  let moved = false;
  if (ix && iy) {
    const xFree = free(S, cx + ix, cy, p), yFree = free(S, cx, cy + iy, p);
    const order = xFree && !yFree ? ['x', 'y'] : yFree && !xFree ? ['y', 'x'] : p.lastAxis === 0 ? ['y', 'x'] : ['x', 'y'];
    for (const a of order) { if (a === 'x' ? tryMove(S, p, ix, 0, dist) : tryMove(S, p, 0, iy, dist)) { moved = true; p.lastAxis = a === 'x' ? 0 : 1; p.dir = a === 'x' ? dirIndex(ix, 0) : dirIndex(0, iy); break; } }
  } else if (ix || iy) {
    p.dir = dirIndex(ix, iy);
    moved = tryMove(S, p, ix, iy, dist);
    if (moved) p.lastAxis = ix ? 0 : 1;
  }
  const [ax, ay] = cellOf(p);
  if (S.floor[idx(ax, ay)] === ICE && moved && p.trap <= 0) p.slide = ix && iy ? p.dir : dirIndex(ix, iy); else if (!moved || S.floor[idx(ax, ay)] !== ICE) p.slide = -1;
  // 컨베이어가 민다
  const f2 = S.floor[idx(ax, ay)];
  if (f2 >= 2 && f2 <= 5) { const [dx, dy] = DIRS[f2 - 2]; tryMove(S, p, dx, dy, CONVEYOR * dt); }
  p.x = Math.max(0, Math.min(W - 1, p.x)); p.y = Math.max(0, Math.min(H - 1, p.y));
  p.moving = moved;
}

// ---------- 폭탄 ----------
export function placeBomb(S, p, ev) {
  if (p.out) return null;
  if (p.trap > 0) {
    // 갇혔을 때 = 탈출 젤리 쓰기
    if (p.escape > 0) { p.escape--; p.trap = 0; p.safe = 1.2; ev?.push({ k: 'free', id: p.id, by: p.id, self: true }); }
    return null;
  }
  const [x, y] = cellOf(p);
  if (p.placed >= p.bombs || bombAt(S, x, y) || S.grid[idx(x, y)] !== EMPTY) return null;
  const b = { id: S.nextBomb++, x, y, owner: p.id, range: p.range, t: FUSE };
  S.bombs.push(b); p.placed++;
  ev?.push({ k: 'bomb', id: b.id, x, y, owner: p.id, range: b.range, t: FUSE });
  return b;
}
// 물결이 닿는 칸 (상자 · 다른 폭탄에서 멈춘다 · 물 위는 지나간다)
export function blastCells(S, b, breaking) {
  const cells = [[b.x, b.y]], boxes = [], hitBombs = [];
  for (const [dx, dy] of DIRS) {
    for (let k = 1; k <= b.range; k++) {
      const x = b.x + dx * k, y = b.y + dy * k;
      if (!inb(x, y)) break;
      const g = S.grid[idx(x, y)];
      if (g === SOLID || g === FALLEN) break;
      cells.push([x, y]);
      if (g === BOX || breaking?.has(idx(x, y))) { boxes.push([x, y]); break; }
      const ob = bombAt(S, x, y);
      if (ob && ob !== b) { hitBombs.push(ob); break; }
    }
  }
  return { cells, boxes, hitBombs };
}
// 폭탄 하나가 터진다 → 닿은 폭탄도 같이 (연쇄). 상자는 연쇄가 다 끝나고 한꺼번에 부서진다
export function explode(S, first, ev) {
  const queue = Array.isArray(first) ? [...first] : [first], done = new Set(), breaking = new Set(), cellSet = new Map(), order = [];
  while (queue.length) {
    const b = queue.shift(); if (done.has(b.id)) continue; done.add(b.id); order.push(b);
    const { cells, boxes, hitBombs } = blastCells(S, b, breaking);
    for (const [x, y] of cells) { const i = idx(x, y); if (!cellSet.has(i)) cellSet.set(i, b.owner); }
    for (const [x, y] of boxes) breaking.add(idx(x, y));
    for (const ob of hitBombs) if (!done.has(ob.id)) queue.push(ob);
  }
  // 터진 폭탄 치우기
  for (const b of order) { S.bombs = S.bombs.filter((o) => o !== b); const ow = S.players.find((p) => p.id === b.owner); if (ow) ow.placed = Math.max(0, ow.placed - 1); }
  // 물결에 닿은 아이템은 녹는다 (이번에 부서진 상자에서 나온 건 빼고)
  const melted = [];
  for (const i of cellSet.keys()) if (S.items.has(i) && !breaking.has(i)) { S.items.delete(i); melted.push(i); }
  const cells = [];
  for (const [i, owner] of cellSet) {
    const x = i % W, y = (i / W) | 0;
    const old = S.flames.find((f) => f.x === x && f.y === y);
    if (old) { old.t = FLAME_T; old.owner = owner; } else S.flames.push({ x, y, t: FLAME_T, owner });
    cells.push([x, y]);
  }
  const boxes = [], items = [];
  for (const i of breaking) {
    S.grid[i] = EMPTY; const x = i % W, y = (i / W) | 0; boxes.push([x, y]);
    if (S.rnd() < ITEM_CHANCE) { const type = rollItem(S.rnd()); S.items.set(i, { type, at: S.t }); items.push([x, y, type]); }
  }
  ev?.push({ k: 'boom', bombs: order.map((b) => [b.x, b.y, b.id]), cells, boxes, melted: melted.map((i) => [i % W, (i / W) | 0]) });
  for (const [x, y, type] of items) ev?.push({ k: 'item', x, y, type });
}
function rollItem(u) { let a = 0; for (const [t, p] of ITEM_ROLL) { a += p; if (u < a) return t; } return 'candy'; }
export const flameAt = (S, x, y) => S.flames.find((f) => f.x === x && f.y === y) || null;

// ---------- 갇힘 · 구조 · 탈락 ----------
export function trap(S, p, by, ev) { if (p.out || p.trap > 0 || p.safe > 0) return; p.trap = TRAP_T; p.trapBy = by; p.slide = -1; ev?.push({ k: 'trap', id: p.id, by }); }
export function knockOut(S, p, by, why, ev) {
  if (p.out) return; p.out = true; p.trap = 0; p.outAt = S.t;
  const k = S.players.find((q) => q.id === by); if (k && k !== p && k.team !== p.team) k.pops++; // 같은 편 물결로 갇혀 시간이 다 된 건 세지 않는다
  ev?.push({ k: 'out', id: p.id, by, why });
}
const sameTeam = (a, b) => a.team === b.team;

// ---------- 좁아지는 판: 바깥 테두리부터 안쪽으로 빙글빙글 ----------
export function spiral() {
  const out = []; let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out;
}
const SPIRAL = spiral();

// ---------- 한 걸음 ----------
// inputs: Map(id → { x, y, bomb })  (사람 · 봇 모두. 서버의 사람은 위치를 따로 넣고 x, y 없이 bomb 만)
export function step(S, dt, inputs) {
  const ev = [];
  if (S.over) return ev;
  S.t += dt;
  // 움직임 · 폭탄 놓기
  for (const p of S.players) {
    if (p.out) continue;
    const inp = inputs?.get(p.id);
    if (inp && !inp.net) movePlayer(S, p, inp.x | 0, inp.y | 0, dt);
    if (inp?.bomb) { placeBomb(S, p, ev); inp.bomb = false; }
    if (p.safe > 0) p.safe -= dt;
  }
  // 폭탄 심지
  for (const b of [...S.bombs]) { b.t -= dt; }
  // 같은 순간에 터지는 폭탄은 한 번에 (같은 상자를 둘이 맞아도 한 번만 부서지고 뒤로 새지 않게)
  const lit = S.bombs.filter((b) => b.t <= 0);
  if (lit.length) explode(S, lit, ev);
  // 물결
  for (const f of S.flames) f.t -= dt;
  S.flames = S.flames.filter((f) => f.t > 0);
  for (const p of S.players) {
    if (p.out) continue;
    const [x, y] = cellOf(p);
    const f = flameAt(S, x, y);
    if (f) trap(S, p, f.owner, ev);
  }
  // 아이템 줍기
  for (const p of S.players) {
    if (p.out || p.trap > 0) continue;
    const [x, y] = cellOf(p), i = idx(x, y), it = S.items.get(i);
    if (!it) continue;
    S.items.delete(i); applyItem(p, it.type);
    ev.push({ k: 'pick', id: p.id, x, y, type: it.type });
  }
  // 갇힌 곰: 같은 편이 닿으면 풀려나고 · 상대가 닿거나 시간이 다 되면 탈락
  for (const p of S.players) {
    if (p.out || p.trap <= 0) continue;
    p.trap -= dt;
    let done = false;
    for (const q of S.players) {
      if (q === p || q.out || q.trap > 0) continue;
      if (Math.abs(q.x - p.x) < 0.7 && Math.abs(q.y - p.y) < 0.7) {
        if (sameTeam(p, q)) { p.trap = 0; p.safe = 1.2; ev.push({ k: 'free', id: p.id, by: q.id }); }
        else knockOut(S, p, q.id, 'pop', ev);
        done = true; break;
      }
    }
    if (!done && p.trap <= 0) knockOut(S, p, p.trapBy, 'time', ev);
  }
  // 3분 뒤: 바깥부터 블록이 내려온다
  if (S.t >= MATCH_T) {
    S.fallT -= dt;
    while (S.fallT <= 0 && S.fallI < SPIRAL.length) {
      S.fallT += FALL_EVERY;
      const [x, y] = SPIRAL[S.fallI++];
      if (S.grid[idx(x, y)] === SOLID || S.grid[idx(x, y)] === FALLEN) continue;
      S.falls.push({ x, y, at: S.t + FALL_WARN });
      ev.push({ k: 'warn', x, y, at: FALL_WARN });
    }
    for (const f of [...S.falls]) {
      if (S.t < f.at) continue;
      S.falls.splice(S.falls.indexOf(f), 1);
      landBlock(S, f.x, f.y, ev);
    }
  }
  // 끝: 남은 편이 하나 (또는 아무도 없음)
  const teams = new Set(activePlayers(S).map((p) => p.team));
  if (teams.size <= 1 || S.t >= END_CAP) {
    S.over = true; S.winner = teams.size === 1 ? [...teams][0] : null;
    ev.push({ k: 'end', winner: S.winner });
  }
  return ev;
}
export function landBlock(S, x, y, ev) {
  const i = idx(x, y);
  S.grid[i] = FALLEN; S.items.delete(i);
  const b = bombAt(S, x, y); if (b) { S.bombs = S.bombs.filter((o) => o !== b); const ow = S.players.find((p) => p.id === b.owner); if (ow) ow.placed = Math.max(0, ow.placed - 1); }
  S.flames = S.flames.filter((f) => !(f.x === x && f.y === y));
  ev?.push({ k: 'fall', x, y });
  for (const p of S.players) { if (p.out) continue; const [px, py] = cellOf(p); if (px === x && py === y) knockOut(S, p, 0, 'fall', ev); }
}
export function applyItem(p, type) {
  if (type === 'candy') p.bombs = Math.min(MAX.bombs, p.bombs + 1);
  else if (type === 'syrup') p.range = Math.min(MAX.range, p.range + 1);
  else if (type === 'shoe') p.speed = Math.min(MAX.speed, p.speed + 1);
  else if (type === 'escape') p.escape = Math.min(MAX.escape, p.escape + 1);
}

// ---------- 같이 하기: 서버가 보낸 사건을 내 화면의 판에 똑같이 적용 ----------
export function apply(S, e) {
  const P = (id) => S.players.find((p) => p.id === id);
  switch (e.k) {
    case 'bomb': if (!S.bombs.some((b) => b.id === e.id)) { S.bombs.push({ id: e.id, x: e.x, y: e.y, owner: e.owner, range: e.range, t: e.t }); const o = P(e.owner); if (o) o.placed++; } break;
    case 'boom': {
      for (const [, , id] of e.bombs) { const b = S.bombs.find((o) => o.id === id); if (b) { S.bombs = S.bombs.filter((o) => o !== b); const o = P(b.owner); if (o) o.placed = Math.max(0, o.placed - 1); } }
      for (const [x, y] of e.cells) { const old = flameAt(S, x, y); if (old) old.t = FLAME_T; else S.flames.push({ x, y, t: FLAME_T, owner: 0 }); }
      for (const [x, y] of e.boxes) S.grid[idx(x, y)] = EMPTY;
      for (const [x, y] of e.melted || []) S.items.delete(idx(x, y));
      break;
    }
    case 'item': S.items.set(idx(e.x, e.y), { type: e.type, at: S.t }); break;
    case 'pick': { S.items.delete(idx(e.x, e.y)); const p = P(e.id); if (p) applyItem(p, e.type); break; }
    case 'trap': { const p = P(e.id); if (p) { p.trap = TRAP_T; p.trapBy = e.by; p.slide = -1; } break; }
    case 'free': { const p = P(e.id); if (p) { p.trap = 0; p.safe = 1.2; if (e.self) p.escape = Math.max(0, p.escape - 1); } break; }
    case 'out': { const p = P(e.id); if (p) { p.out = true; p.trap = 0; p.outAt = S.t; } const k = P(e.by); if (k && p && k.id !== e.id && k.team !== p.team) k.pops++; break; }
    case 'warn': S.falls.push({ x: e.x, y: e.y, at: S.t + e.at }); break;
    case 'fall': { const i = idx(e.x, e.y); S.grid[i] = FALLEN; S.items.delete(i); S.falls = S.falls.filter((f) => !(f.x === e.x && f.y === e.y)); S.bombs = S.bombs.filter((b) => !(b.x === e.x && b.y === e.y)); break; }
    case 'end': S.over = true; S.winner = e.winner; break;
    default: break;
  }
}
// 화면 쪽 판에서 시간만 흐르게 (폭탄 심지 · 물결 · 갇힘 남은 시간 표시용)
export function tickView(S, dt) {
  S.t += dt;
  for (const b of S.bombs) b.t = Math.max(0, b.t - dt);
  for (const f of S.flames) f.t -= dt;
  S.flames = S.flames.filter((f) => f.t > 0);
  for (const p of S.players) { if (p.trap > 0) p.trap = Math.max(0.01, p.trap - dt); if (p.safe > 0) p.safe -= dt; }
}
// 결과: 이긴 편 먼저, 나머지는 늦게 탈락한 순
export function ranking(S) {
  const rows = S.players.map((p) => ({ id: p.id, team: p.team, win: S.winner != null && p.team === S.winner, out: p.out, outAt: p.outAt, pops: p.pops }));
  rows.sort((a, b) => (b.win - a.win) || ((a.out ? 1 : 0) - (b.out ? 1 : 0)) || (b.outAt - a.outAt) || (b.pops - a.pops));
  rows.forEach((r, i) => { r.place = i + 1; });
  return rows;
}
