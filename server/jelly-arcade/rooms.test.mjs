// 젤리 아케이드 방 서버 시험: node --test server/jelly-arcade/
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../public/jelly-arcade/js/sim.js';
import { ArcadeRooms, netMove, starsFor } from './rooms.js';

function fakeClient(R, name, sub) {
  const msgs = [], h = {};
  const ws = { readyState: 1, send: (s) => msgs.push(JSON.parse(s)), on: (k, f) => { h[k] = f; } };
  R.connect(ws);
  const c = [...R.clients].at(-1);
  R.handle(c, { t: 'hello', name, session: sub });
  return { c, msgs, last: (t) => [...msgs].reverse().find((m) => m.t === t), all: (t) => msgs.filter((m) => m.t === t) };
}
function setup(opts) {
  const records = { data: {}, dirty: false };
  const R = new ArcadeRooms((sid) => (sid ? { sub: sid, user: { nick: sid } } : null), records);
  const a = fakeClient(R, '가나', 'u1'), b = fakeClient(R, '다라', 'u2');
  R.handle(a.c, { t: 'create', name: '시험방', opts });
  const room = a.c.room;
  R.handle(b.c, { t: 'join', id: room.id });
  return { R, a, b, room, records };
}

test('방: 2명 + 봇으로 채우고, 판 정보를 모두에게 보낸다', () => {
  const { R, a, b, room } = setup({ map: 'ice', fill: 6, diff: 'easy' });
  assert.equal(room.players.length, 2);
  R.handle(a.c, { t: 'start' });
  const st = b.last('start');
  assert.ok(st && st.map === 'ice' && st.mode === 'ffa' && st.plist.length === 6);
  assert.equal(st.plist.filter((p) => p.bot).length, 4);
  assert.ok(st.plist.every((p) => p.diff === 'easy'));
  // 화면이 같은 씨앗 · 같은 목록으로 만든 판 = 서버 판
  const V = G.createGame({ map: st.map, seed: st.seed, mode: st.mode, players: st.plist });
  assert.deepEqual([...V.grid], [...room.S.grid]);
  assert.deepEqual(V.players.map((p) => [p.id, p.x, p.y]), room.S.players.map((p) => [p.id, p.x, p.y]));
});

test('방 설정: 맵 · 방식 · 인원 · 봇 실력만 받는다', () => {
  const { R, a, b, room } = setup({});
  R.handle(a.c, { t: 'opts', opts: { map: 'nope', team: true, fill: 7, diff: 'hard', x: 1 } });
  assert.deepEqual(room.opts, { map: 'candy', team: true, fill: 4, diff: 'normal' });
  R.handle(b.c, { t: 'opts', opts: { map: 'factory' } });
  assert.equal(room.opts.map, 'candy', '방장만 바꾼다');
});

test('2팀전: 팀 인원 차이는 1명까지 · 한 팀 최대 4명', () => {
  const { R, a, b, room } = setup({ team: true, fill: 8 });
  a.c.team = 'red'; b.c.team = 'red';
  R.handle(a.c, { t: 'start' });
  const st = a.last('start');
  const red = st.plist.filter((p) => p.team === 'red').length, blue = st.plist.filter((p) => p.team === 'blue').length;
  assert.equal(st.mode, 'team'); assert.equal(red, 4); assert.equal(blue, 4);
  assert.ok(st.plist.filter((p) => !p.bot).every((p) => p.team === 'red'), '친구끼리 고른 같은 팀은 그대로');
});

test('서버 판정: 위치는 말이 되는 만큼만 · 폭탄 · 사건 · 위치 중계', () => {
  const { R, a, b, room } = setup({ map: 'candy', fill: 2 });
  R.handle(a.c, { t: 'start' });
  const t0 = room.startAt;
  const pa = room.S.players.find((p) => p.id === a.c.id);
  assert.deepEqual([pa.x, pa.y], [0, 0]);
  // 시작 전 폭탄은 무시
  R.handle(a.c, { t: 'bomb', x: 0, y: 0 }); R.onTick(room, t0 - 10); assert.equal(room.S.bombs.length, 0);
  // 순간이동은 안 된다
  R.handle(a.c, { t: 'mv', x: 8, y: 0, d: 0, m: 1 }); R.onTick(room, t0 + 50);
  assert.ok(pa.x < 1, `멀리 못 간다 (${pa.x})`);
  // 걸어서 오른쪽 한 칸
  for (let i = 1; i <= 8; i++) { R.handle(a.c, { t: 'mv', x: Math.min(1, i * 0.15), y: 0, d: 0, m: 1 }); a.c.mvAt = t0 + 50 * i; R.onTick(room, t0 + 50 + 50 * i); }
  assert.ok(Math.abs(pa.x - 1) < 0.01, `한 칸 움직임 (${pa.x})`);
  R.handle(a.c, { t: 'bomb', x: 1, y: 0 }); R.onTick(room, t0 + 600);
  const ev = b.all('ev').flatMap((m) => m.e);
  assert.ok(ev.some((e) => e.k === 'bomb' && e.owner === a.c.id && e.x === 1 && e.y === 0));
  // 위치 중계: 사람 · 봇 모두 [id, x, y, 방향, 움직임]
  R.tick();
  const snap = b.last('snap'); assert.ok(snap.p.some((r) => r[0] === a.c.id && r.length === 5));
  // 2.5초 뒤 서버가 터뜨린다
  for (let k = 1; k <= 54; k++) R.onTick(room, t0 + 600 + k * 50);
  assert.ok(b.all('ev').flatMap((m) => m.e).some((e) => e.k === 'boom'));
});

test('막힌 칸 · 두 칸 건너뛰기는 받지 않는다', () => {
  const S = G.createGame({ map: 'candy', seed: 3, players: [{ id: 1 }, { id: 2 }] });
  S.grid.fill(G.EMPTY); S.grid[G.idx(1, 0)] = G.SOLID;
  const p = S.players[0];
  assert.equal(netMove(S, p, 0.7, 0, 0.5), false);
  assert.equal(p.x, 0);
  assert.equal(netMove(S, p, 0, 0.4, 0.2), true);
});

test('판이 끝나면: 결과 · 승리 수 · 톡 수 기록 · 기다리는 방으로', () => {
  const { R, a, b, room, records } = setup({ fill: 2 });
  R.handle(a.c, { t: 'start' });
  const t0 = room.startAt, S = room.S;
  R.onTick(room, t0 + 100);
  // b 가 갇히고 a 가 닿아 톡
  const pb = S.players.find((p) => p.id === b.c.id), pa = S.players.find((p) => p.id === a.c.id);
  G.trap(S, pb, a.c.id); pa.x = pb.x; pa.y = pb.y;
  S.t = 40; R.onTick(room, t0 + 40100);
  assert.ok(S.over); assert.equal(S.winner, `p${a.c.id}`);
  R.onTick(room, t0 + 40100 + 3000);
  const fin = a.last('finish');
  assert.ok(fin); assert.equal(fin.winner, String(a.c.id));
  assert.equal(fin.rows[0].id, a.c.id); assert.ok(fin.rows[0].win); assert.equal(fin.rows[0].pops, 1);
  assert.equal(records.data.wins.u1.value, 1); assert.equal(records.data.pops.u1.value, 1); assert.ok(!records.data.wins.u2);
  assert.equal(room.state, 'wait'); assert.equal(room.players.length, 2, '봇은 빠진다');
  assert.equal(starsFor(true, 1), 35); assert.equal(starsFor(false, 20), 60);
});

test('경기 중 나가면 탈락 처리', () => {
  const { R, a, b, room } = setup({ fill: 4 });
  R.handle(a.c, { t: 'start' });
  R.onTick(room, room.startAt + 100);
  R.handle(b.c, { t: 'leave' });
  const pb = room.S.players.find((p) => p.id === b.c.id);
  assert.ok(pb.out);
  assert.ok(a.all('ev').flatMap((m) => m.e).some((e) => e.k === 'out' && e.id === b.c.id && e.why === 'left'));
});
