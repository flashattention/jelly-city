// 젤리 아케이드 판 규칙 시험: node --test server/jelly-arcade/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../public/jelly-arcade/js/sim.js';
import { think, newBrain, dangerMap, canEscape } from '../../public/jelly-arcade/js/bots.js';

const { W, H, idx, EMPTY, SOLID, BOX, HOLE, FALLEN } = G;
// 빈 판 하나 (시험마다 칸을 직접 놓는다)
function blank(players = [{ id: 1 }, { id: 2 }], mode = 'ffa') {
  const S = G.createGame({ map: 'candy', seed: 5, players, mode });
  S.grid.fill(EMPTY); S.floor.fill(0); S.rnd = () => 0.99; // 아이템 안 나오게
  return S;
}
const at = (S, id, x, y) => { const p = S.players.find((q) => q.id === id); p.x = x; p.y = y; return p; };
const run = (S, sec, inputs) => { const ev = []; for (let t = 0; t < sec; t += 1 / 60) ev.push(...G.step(S, 1 / 60, inputs)); return ev; };

test('맵: 13×11 · 맵 셋 · 시작 구석과 옆 칸은 비어 있다', () => {
  for (const id of G.MAP_IDS) for (const seed of [1, 2, 99]) {
    const { grid } = G.buildGrid(id, seed);
    assert.equal(grid.length, W * H);
    for (const [sx, sy] of G.SPAWNS) {
      assert.equal(grid[idx(sx, sy)], EMPTY, `${id} 시작 ${sx},${sy}`);
      const open = G.DIRS.filter(([dx, dy]) => G.inb(sx + dx, sy + dy) && grid[idx(sx + dx, sy + dy)] === EMPTY).length;
      assert.ok(open >= 1, `${id} ${sx},${sy} 옆이 막혔다`);
    }
    // 부서지는 상자 · 안 부서지는 블록이 모두 있다
    assert.ok(grid.includes(BOX) && grid.includes(SOLID));
  }
  assert.deepEqual(G.mapRows('candy')[0].split('').reverse().join(''), G.mapRows('candy')[0]);
});

test('같은 씨앗이면 같은 판', () => {
  assert.deepEqual([...G.buildGrid('ice', 42).grid], [...G.buildGrid('ice', 42).grid]);
});

test('움직임: 칸 가운데로 붙고 블록에 막힌다', () => {
  const S = blank(); const p = at(S, 1, 2, 2);
  S.grid[idx(4, 2)] = SOLID;
  p.y = 2.3; // 살짝 어긋난 채로 오른쪽
  for (let i = 0; i < 120; i++) G.movePlayer(S, p, 1, 0, 1 / 60);
  assert.ok(Math.abs(p.y - 2) < 1e-6, '줄 가운데로 붙는다');
  assert.ok(Math.abs(p.x - 3) < 1e-6, `블록 앞 칸 가운데에서 멈춘다 (${p.x})`);
});

test('움직임: 모서리에 살짝 걸리면 옆으로 미끄러져 돌아간다', () => {
  const S = blank(); const p = at(S, 1, 2, 2.35);
  S.grid[idx(3, 2)] = SOLID; // 바로 앞이 막혔지만 아래 줄은 열려 있다
  for (let i = 0; i < 40; i++) G.movePlayer(S, p, 1, 0, 1 / 60);
  assert.ok(p.x > 2.4 && Math.round(p.y) === 3, `아래 줄로 돌아 나간다 (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
});

test('폭탄: 2.5초 뒤 십자로 · 블록에서 멈추고 상자는 부수고 멈춘다', () => {
  const S = blank(); const p = at(S, 1, 5, 5); at(S, 2, 0, 0);
  p.range = 3; S.grid[idx(7, 5)] = SOLID; S.grid[idx(5, 3)] = BOX; S.grid[idx(5, 2)] = BOX;
  G.placeBomb(S, p, []);
  at(S, 1, 0, 10);
  let ev = run(S, 2.4);
  assert.ok(!ev.some((e) => e.k === 'boom'), '2.4초에는 아직');
  ev = run(S, 0.2);
  const boom = ev.find((e) => e.k === 'boom'); assert.ok(boom);
  const has = (x, y) => boom.cells.some(([a, b]) => a === x && b === y);
  assert.ok(has(5, 5) && has(6, 5) && !has(7, 5) && !has(8, 5), '오른쪽은 블록에서 멈춤');
  assert.ok(has(5, 4) && has(5, 3) && !has(5, 2), '위는 첫 상자를 부수고 멈춤');
  assert.equal(S.grid[idx(5, 3)], EMPTY); assert.equal(S.grid[idx(5, 2)], BOX);
  assert.ok(has(2, 5) && !has(1, 5), '왼쪽은 물결 길이 3');
  assert.equal(p.placed, 0);
});

test('물결은 물 위를 지나간다', () => {
  const S = blank(); const p = at(S, 1, 5, 5); at(S, 2, 0, 0); p.range = 2;
  S.grid[idx(6, 5)] = HOLE; G.placeBomb(S, p); at(S, 1, 0, 10);
  const boom = run(S, 2.6).find((e) => e.k === 'boom');
  assert.ok(boom.cells.some(([x, y]) => x === 7 && y === 5));
});

test('연쇄: 물결에 닿은 다른 폭탄도 같이 터진다', () => {
  const S = blank([{ id: 1 }, { id: 2 }, { id: 3 }]);
  const a = at(S, 1, 2, 2); a.range = 3; G.placeBomb(S, a);
  const b = at(S, 2, 4, 2); b.range = 2; G.placeBomb(S, b);
  S.bombs[1].t = 2.0; S.bombs[0].t = 1.0; // a 가 먼저
  at(S, 1, 12, 10); at(S, 2, 12, 0); at(S, 3, 0, 10);
  const boom = run(S, 1.05).filter((e) => e.k === 'boom');
  assert.equal(boom.length, 1, '한 번에');
  assert.equal(boom[0].bombs.length, 2, '두 폭탄 모두');
  assert.ok(boom[0].cells.some(([x, y]) => x === 6 && y === 2), 'b 의 물결도 퍼진다');
  assert.equal(S.bombs.length, 0);
});

test('연쇄로 같은 상자를 두 번 맞아도 한 번만 부서지고 뒤로 새지 않는다', () => {
  const S = blank([{ id: 1 }, { id: 2 }, { id: 3 }]);
  S.grid[idx(5, 2)] = BOX; S.grid[idx(5, 1)] = BOX;
  const a = at(S, 1, 3, 2); a.range = 4; G.placeBomb(S, a);
  const b = at(S, 2, 5, 4); b.range = 4; G.placeBomb(S, b);
  at(S, 1, 12, 10); at(S, 2, 12, 0); at(S, 3, 0, 10);
  S.bombs[0].t = S.bombs[1].t = 0.01;
  const boom = run(S, 0.05).find((e) => e.k === 'boom');
  assert.equal(boom.boxes.length, 1);
  assert.equal(S.grid[idx(5, 1)], BOX, '뒤 상자는 남는다');
});

test('갇힘: 물결에 맞으면 갇히고 5초가 지나면 탈락', () => {
  const S = blank([{ id: 1 }, { id: 2 }, { id: 3 }]);
  const p = at(S, 1, 5, 5); G.placeBomb(S, p); at(S, 2, 0, 0); at(S, 3, 12, 0);
  let ev = run(S, 2.6);
  assert.ok(ev.some((e) => e.k === 'trap' && e.id === 1)); assert.ok(p.trap > 0);
  ev = run(S, 5.1);
  assert.ok(ev.some((e) => e.k === 'out' && e.id === 1 && e.why === 'time')); assert.ok(p.out);
});

test('구조: 같은 편이 닿으면 풀려나고, 상대가 닿으면 탈락', () => {
  const S = blank([{ id: 1, team: 'red' }, { id: 2, team: 'red' }, { id: 3, team: 'blue' }, { id: 4, team: 'blue' }], 'team');
  const p = at(S, 1, 5, 5); at(S, 2, 8, 5); at(S, 3, 0, 10); at(S, 4, 12, 10);
  G.trap(S, p, 3);
  let ev = run(S, 0.1); assert.ok(p.trap > 0);
  at(S, 2, 5.4, 5); ev = run(S, 0.05);
  assert.ok(ev.some((e) => e.k === 'free' && e.id === 1 && e.by === 2)); assert.equal(p.trap, 0);
  // 다시 갇혔는데 상대가 닿음
  p.safe = 0; G.trap(S, p, 3); at(S, 2, 10, 0); at(S, 3, 5, 5.5);
  ev = run(S, 0.05);
  assert.ok(ev.some((e) => e.k === 'out' && e.id === 1 && e.by === 3 && e.why === 'pop'));
  assert.equal(S.players.find((q) => q.id === 3).pops, 1);
});

test('탈출 젤리: 갇혔을 때 폭탄 단추로 한 번 스스로 풀려난다', () => {
  const S = blank(); const p = at(S, 1, 5, 5); at(S, 2, 0, 0);
  G.applyItem(p, 'escape'); G.trap(S, p, 2);
  const ev = G.step(S, 1 / 60, new Map([[1, { x: 0, y: 0, bomb: true }]]));
  assert.ok(ev.some((e) => e.k === 'free' && e.self)); assert.equal(p.escape, 0); assert.equal(p.trap, 0);
  G.trap(S, p, 2); assert.equal(p.trap, 0, '풀린 직후 잠깐은 다시 안 갇힘');
});

test('아이템: 상자에서 나오고 주우면 능력이 오른다 · 물결에 녹는다', () => {
  const S = blank(); const p = at(S, 1, 5, 5); at(S, 2, 0, 0);
  S.rnd = () => 0.1; S.grid[idx(6, 5)] = BOX;
  G.placeBomb(S, p); at(S, 1, 5, 8);
  const ev = run(S, 2.6);
  const it = ev.find((e) => e.k === 'item'); assert.ok(it && it.x === 6 && it.y === 5 && it.type === 'candy');
  run(S, 0.7); // 물결이 사라진 뒤
  at(S, 1, 6, 5); const e2 = run(S, 0.05);
  assert.ok(e2.some((e) => e.k === 'pick' && e.type === 'candy')); assert.equal(p.bombs, 2);
  for (const t of ['syrup', 'shoe', 'escape']) G.applyItem(p, t);
  assert.equal(p.range, 2); assert.equal(p.speed, 1); assert.equal(p.escape, 1);
  for (let i = 0; i < 20; i++) G.applyItem(p, 'candy'); assert.equal(p.bombs, G.MAX.bombs);
  // 녹기
  S.items.set(idx(3, 3), { type: 'shoe', at: 0 }); at(S, 1, 3, 1); G.placeBomb(S, p); at(S, 1, 9, 9);
  run(S, 2.6); assert.ok(!S.items.has(idx(3, 3)));
});

test('폭탄 수 제한 · 같은 칸에 두 개 안 됨 · 놓은 폭탄 위에서 나갈 수는 있어도 다시 못 들어간다', () => {
  const S = blank(); const p = at(S, 1, 5, 5); at(S, 2, 0, 0);
  assert.ok(G.placeBomb(S, p)); assert.equal(G.placeBomb(S, p), null);
  for (let i = 0; i < 30; i++) G.movePlayer(S, p, 1, 0, 1 / 60);
  assert.ok(p.x > 5.5, '내 폭탄에서 걸어 나간다');
  for (let i = 0; i < 60; i++) G.movePlayer(S, p, -1, 0, 1 / 60);
  assert.ok(Math.round(p.x) === 6, '다시 못 들어간다');
});

test('컨베이어는 곰을 민다 · 얼음에서는 미끄러진다', () => {
  const S = blank(); const p = at(S, 1, 2, 2); at(S, 2, 0, 0);
  S.floor[idx(2, 2)] = 2; S.floor[idx(3, 2)] = 2; // →
  for (let i = 0; i < 60; i++) G.movePlayer(S, p, 0, 0, 1 / 60);
  assert.ok(p.x > 3, `밀려간다 ${p.x}`);
  const q = at(S, 2, 2, 6); for (let x = 0; x < W; x++) S.floor[idx(x, 6)] = G.ICE;
  for (let i = 0; i < 12; i++) G.movePlayer(S, q, 1, 0, 1 / 60);
  const x0 = q.x; for (let i = 0; i < 60; i++) G.movePlayer(S, q, 0, 0, 1 / 60);
  assert.ok(q.x > x0 + 2, '손을 떼도 미끄러진다');
});

test('3분 뒤 바깥부터 블록이 내려오고, 깔리면 탈락 · 마지막 편이 이긴다', () => {
  const S = blank(); at(S, 1, 0, 0); at(S, 2, 6, 5);
  S.t = G.MATCH_T - 0.01;
  const ev = run(S, 1.5);
  assert.ok(ev.some((e) => e.k === 'warn')); assert.ok(ev.some((e) => e.k === 'fall' && e.x === 0 && e.y === 0));
  assert.ok(ev.some((e) => e.k === 'out' && e.id === 1 && e.why === 'fall'));
  const end = ev.find((e) => e.k === 'end'); assert.ok(end); assert.equal(end.winner, 'p2'); assert.equal(S.grid[idx(0, 0)], FALLEN);
  const rk = G.ranking(S); assert.equal(rk[0].id, 2); assert.ok(rk[0].win);
});

test('나선 순서는 모든 칸을 한 번씩', () => {
  const s = G.spiral(); assert.equal(s.length, W * H); assert.equal(new Set(s.map(([x, y]) => idx(x, y))).size, W * H);
});

test('화면 쪽 판에 사건을 적용하면 서버 판과 같아진다', () => {
  const players = [{ id: 1 }, { id: 2 }, { id: 3, bot: true }, { id: 4, bot: true }];
  const S = G.createGame({ map: 'factory', seed: 77, players }), V = G.createGame({ map: 'factory', seed: 77, players });
  const brains = new Map(S.players.map((p) => [p.id, newBrain(p.id)]));
  for (const p of S.players) p.bot = true;
  for (let i = 0; i < 60 * 60 && !S.over; i++) {
    const inp = new Map(S.players.map((p) => [p.id, think(S, p, brains.get(p.id), 1 / 60)]));
    for (const e of G.step(S, 1 / 60, inp)) G.apply(V, e);
    G.tickView(V, 1 / 60);
  }
  assert.deepEqual([...V.grid], [...S.grid], '격자');
  assert.deepEqual([...V.items.keys()].sort(), [...S.items.keys()].sort(), '아이템');
  assert.deepEqual(V.players.map((p) => [p.out, p.bombs, p.range, p.speed]), S.players.map((p) => [p.out, p.bombs, p.range, p.speed]), '곰 상태');
});

test('봇: 위험 지도 · 피할 곳이 없으면 폭탄을 놓지 않는다', () => {
  const S = blank(); const p = at(S, 1, 0, 0); at(S, 2, 12, 10);
  S.grid[idx(1, 0)] = SOLID; S.grid[idx(0, 1)] = SOLID;
  assert.equal(canEscape(S, p), false, '갇힌 구석');
  S.grid[idx(0, 1)] = EMPTY; S.grid[idx(1, 1)] = EMPTY;
  assert.equal(canEscape(S, p), true, '옆으로 돌아 숨을 수 있다');
  G.placeBomb(S, p); const d = dangerMap(S);
  assert.ok(d[idx(0, 0)] <= G.FUSE && d[idx(1, 1)] === Infinity);
});

// 봇끼리 한 판 (diffs: 곰마다 난이도)
function botGame(seed, diffs, mode = 'ffa') {
  const S = G.createGame({ map: G.MAP_IDS[seed % 3], seed, mode, players: diffs.map((diff, i) => ({ id: i + 1, bot: true, diff, team: i % 2 ? 'blue' : 'red' })) });
  const brains = new Map(S.players.map((p) => [p.id, newBrain(p.id * 31 + seed)]));
  let early = 0;
  while (!S.over) {
    const inp = new Map(S.players.map((p) => [p.id, think(S, p, brains.get(p.id), 1 / 60)]));
    for (const e of G.step(S, 1 / 60, inp)) if (e.k === 'out' && S.t < 30) early++;
  }
  return { S, early };
}
test('봇: 상자를 부수고 오래 살아남고 판이 끝난다 (보통 · 쉬움)', () => {
  for (const diff of ['normal', 'easy']) {
    let early = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = botGame(seed, [diff, diff, diff, diff]); early += g.early;
      const boxesLeft = [...g.S.grid].filter((x) => x === BOX).length, boxes0 = [...G.buildGrid(g.S.map, seed).grid].filter((x) => x === BOX).length;
      assert.ok(boxesLeft < boxes0 * 0.6, `${diff} 봇이 상자를 부순다 (${boxesLeft}/${boxes0})`);
      assert.ok(g.S.over && g.S.t <= G.END_CAP);
    }
    assert.ok(early <= 20, `${diff} 첫 30초 탈락 ${early} / 48`);
  }
});
test('봇: 보통이 쉬움보다 세다 · 팀전도 끝난다', () => {
  let normalWins = 0, decided = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { S } = botGame(seed, ['normal', 'easy', 'normal', 'easy'], 'team');
    if (S.winner) { decided++; if (S.winner === 'red') normalWins++; }
  }
  assert.ok(decided >= 15, `승부가 난 판 ${decided}`);
  assert.ok(normalWins >= decided * 0.6, `보통 팀 승 ${normalWins} / ${decided}`);
});

test('폭탄 누름 버퍼: 지금 칸에 못 놓으면 0.25초 안에 놓을 수 있게 되는 순간 놓는다', () => {
  const S = blank(); const p = at(S, 1, 2, 2);
  p.bombs = 2;
  G.step(S, 1 / 60, new Map([[1, { x: 0, y: 0, bomb: true }]]));
  assert.equal(S.bombs.length, 1);
  // 같은 칸(폭탄 위)에서 다시 누르고 옆 칸으로 걸어가면, 옆 칸 가운데에 닿을 때 놓인다
  const inp = { x: 1, y: 0, bomb: 0.25 }, m = new Map([[1, inp]]);
  for (let i = 0; i < 15; i++) G.step(S, 1 / 60, m);
  assert.equal(S.bombs.length, 2);
  assert.equal(inp.bomb, false);
  // 끝내 못 놓으면 0.25초 뒤 사라진다 (폭탄 다 씀)
  const inp2 = { x: 0, y: 0, bomb: 0.25 };
  for (let i = 0; i < 20; i++) G.step(S, 1 / 60, new Map([[1, inp2]]));
  assert.equal(inp2.bomb, false); assert.equal(S.bombs.length, 2);
});
