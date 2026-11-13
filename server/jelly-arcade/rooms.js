// 젤리 아케이드 방: 2 ~ 8명 · 개인전 / 2팀전 · 빈자리는 젤리봇
//   판은 서버가 돌린다 (public/jelly-arcade/js/sim.js 를 같이 쓴다): 폭탄 · 물결 · 갇힘 · 아이템 · 좁아짐은 서버가 정해서 사건으로 보낸다
//   사람 곰은 각자 화면이 먼저 움직이고 위치를 보내면, 서버가 말이 되는지 보고 받아들인다
import { BaseRooms } from '../shared/rooms.js';
import * as G from '../../public/jelly-arcade/js/sim.js';
import { think, newBrain } from '../../public/jelly-arcade/js/bots.js';
import { getCos, tagChar } from '../cosmetics.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 소다', '젤리봇 레몬', '젤리봇 포도', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 콜라', '젤리봇 메론'];
const BOT_COLORS = ['#ff6b8b', '#6ec6ff', '#ffd84d', '#9b6bff', '#5fe0b0', '#ffab91', '#c49a6c', '#b5e655'];
export const FILLS = [2, 4, 6, 8];
const DT = 1 / 60, END_WAIT = 2600;
// 별: 이기면 30 · 지면 10 · 톡 하나에 5 (한 판 최대 60)
export const starsFor = (win, pops) => Math.min(60, (win ? 30 : 10) + pops * 5);

// 사람 곰 위치 받기: 한 번에 너무 멀리 · 막힌 칸으로는 못 간다
export function netMove(S, p, x, y, dt) {
  if (p.out || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  x = Math.max(0, Math.min(G.W - 1, x)); y = Math.max(0, Math.min(G.H - 1, y));
  const max = (G.speedOf(p) + G.CONVEYOR) * Math.min(0.5, Math.max(dt, 0.02)) * 1.6 + 0.35;
  const d = Math.hypot(x - p.x, y - p.y);
  if (d > max) { const k = max / d; x = p.x + (x - p.x) * k; y = p.y + (y - p.y) * k; }
  const cx = Math.round(x), cy = Math.round(y), [px, py] = G.cellOf(p);
  if ((cx !== px || cy !== py) && (!G.free(S, cx, cy, p) || Math.abs(cx - px) + Math.abs(cy - py) > 1)) return false;
  p.x = x; p.y = y;
  return true;
}

export class ArcadeRooms extends BaseRooms {
  // records: 승리 수 · 톡 수 순위표 (server/shared/records.js)
  constructor(userOf, records) {
    super(userOf, { max: 8, hz: 20, countdown: 3500, defaults: { map: 'candy', team: false, fill: 4, diff: 'normal' } });
    this.records = records;
  }
  allow(cur, n) {
    return {
      map: [...G.MAP_IDS, 'random'].includes(n.map) ? n.map : cur.map || 'candy',
      team: n.team === undefined ? !!cur.team : !!n.team,
      fill: FILLS.includes(Number(n.fill)) ? Number(n.fill) : cur.fill || 4,
      diff: ['easy', 'normal'].includes(n.diff) ? n.diff : cur.diff || 'normal',
    };
  }
  // 2팀전에서 친구끼리 같은 팀을 골랐으면 그대로 (빈자리는 봇이 상대 팀을 채운다)
  handle(c, m) {
    if (m.t === 'start' && c.room?.host === c && c.room.opts.team) c.room.wantTeams = new Map(c.room.players.map((p) => [p.id, p.team]));
    return super.handle(c, m);
  }
  onStart(r) {
    if (r.wantTeams) { for (const p of r.players) if (r.wantTeams.has(p.id)) p.team = r.wantTeams.get(p.id); r.wantTeams = null; }
    const humans = r.players.filter((p) => !p.bot);
    const fill = Math.max(humans.length, r.opts.fill || 4);
    for (let i = 0; humans.length + i < fill; i++) {
      const k = (i + (r.seed % 5)) % BOT_NAMES.length;
      const team = r.opts.team ? this.smaller(r, null) : null;
      r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[k], color: BOT_COLORS[k], look: { hat: 1 + ((r.seed >> i) % 9), outfit: (r.seed >> (i + 3)) % 7 }, acc: [], team, st: null });
    }
    // 2팀전: 한 팀 최대 4명 · 차이는 1명까지 (봇부터 옮긴다)
    if (r.opts.team) {
      const cnt = (t) => r.players.filter((p) => p.team === t).length;
      for (let g = 0; g < 8 && Math.abs(cnt('red') - cnt('blue')) > 1; g++) {
        const big = cnt('red') > cnt('blue') ? 'red' : 'blue', mv = r.players.find((p) => p.team === big && p.bot) || [...r.players].reverse().find((p) => p.team === big);
        mv.team = big === 'red' ? 'blue' : 'red';
      }
    }
    const map = r.opts.map === 'random' || !G.MAPS[r.opts.map] ? G.MAP_IDS[r.seed % G.MAP_IDS.length] : r.opts.map;
    const mode = r.opts.team ? 'team' : 'ffa';
    const plist = r.players.map((p) => ({ id: p.id, team: r.opts.team ? p.team : null, bot: !!p.bot, diff: r.opts.diff, name: p.name }));
    r.S = G.createGame({ map, seed: r.seed, mode, players: plist });
    r.brains = new Map(r.players.filter((p) => p.bot).map((p) => [p.id, newBrain(p.id * 131 + r.seed)]));
    r.inputs = new Map(r.players.map((p) => [p.id, p.bot ? null : { net: true, bomb: false }]));
    r.endAt = 0;
    for (const p of r.players) { p.mv = null; p.mvAt = 0; p.st = this.stOf(r.S.players.find((q) => q.id === p.id)); }
    return { map, mode, plist };
  }
  stOf(sp) { return sp ? [+sp.x.toFixed(3), +sp.y.toFixed(3), sp.dir, sp.moving ? 1 : 0] : null; }
  onMessage(c, m, r) {
    const S = r.S; if (!S || S.over) return;
    const p = S.players.find((q) => q.id === c.id); if (!p || p.out) return;
    if (m.t === 'mv') { c.mv = { x: Number(m.x), y: Number(m.y), d: m.d | 0, m: m.m ? 1 : 0 }; return; }
    if (m.t === 'bomb') {
      if (S.t <= 0) return; // 시작 전
      if (Number.isFinite(Number(m.x))) this.takeMove(r, c, p, { x: Number(m.x), y: Number(m.y), d: p.dir, m: p.moving ? 1 : 0 }, Date.now());
      const inp = r.inputs.get(c.id); if (inp) inp.bomb = true;
    }
  }
  takeMove(r, c, p, mv, now) {
    const dt = c.mvAt ? (now - c.mvAt) / 1000 : 0.05;
    if (netMove(r.S, p, mv.x, mv.y, dt)) { p.dir = Math.max(0, Math.min(3, mv.d)); p.moving = !!mv.m; }
    c.mvAt = now;
  }
  onLeave(r, c) {
    const S = r.S; if (!S || S.over) return;
    const p = S.players.find((q) => q.id === c.id); if (!p || p.out) return;
    const ev = []; G.knockOut(S, p, 0, 'left', ev);
    this.toRoom(r, { t: 'ev', e: ev });
  }
  onTick(r, now) {
    const S = r.S; if (!S) return;
    if (now < r.startAt) return;
    if (S.over) { if (now >= r.endAt) this.finish(r); return; }
    // 사람 곰 위치
    for (const c of r.players) {
      if (c.bot || !c.mv) continue;
      const p = S.players.find((q) => q.id === c.id);
      if (p && !p.out) this.takeMove(r, c, p, c.mv, now);
      c.mv = null;
    }
    // 판 돌리기 (1/60초씩, 실제 흐른 시간만큼)
    const target = (now - r.startAt) / 1000, ev = [];
    let guard = 0;
    while (S.t + DT <= target && !S.over && guard++ < 30) {
      for (const p of S.players) if (p.bot) r.inputs.set(p.id, think(S, p, r.brains.get(p.id), DT));
      ev.push(...G.step(S, DT, r.inputs));
    }
    // 서버가 밀렸으면 따라잡지 않고 판 시계를 늦춘다 (폭탄 심지와 판 시간이 같이 멈춘다)
    if (guard >= 30) r.startAt += (target - S.t) * 1000;
    // 사건과 함께 판 시계도 보낸다 (화면 시계가 서버와 어긋나지 않게 · 사건이 없어도 1초마다)
    r.ttN = (r.ttN || 0) + 1;
    if (ev.length || r.ttN % 20 === 0) this.toRoom(r, { t: 'ev', e: ev, tt: +S.t.toFixed(3) });
    for (const c of r.players) c.st = this.stOf(S.players.find((q) => q.id === c.id));
    if (S.over) r.endAt = now + END_WAIT;
  }
  finish(r) {
    const S = r.S; r.S = null;
    const by = new Map(r.players.map((p) => [p.id, p]));
    const rows = G.ranking(S).map((x) => ({ ...x, name: by.get(x.id)?.name || '?', color: by.get(x.id)?.color, bot: !!by.get(x.id)?.bot }));
    const winner = S.winner == null ? null : S.mode === 'team' ? S.winner : String(S.winner).replace(/^p/, '');
    // 별 · 기록: 로그인한 사람만 (30초도 안 된 판은 별 없음)
    const stars = {};
    for (const row of rows) {
      const c = by.get(row.id); if (!c || c.bot || !c.who?.sub) continue;
      const sub = c.who.sub;
      if (S.t >= 30) { const n = starsFor(row.win, row.pops); stars[row.id] = getCos()?.earnRaw(sub, n) || 0; }
      this.bump(sub, c, 'wins', row.win ? 1 : 0);
      this.bump(sub, c, 'pops', row.pops);
    }
    this.end(r, { rows, winner, mode: S.mode, map: S.map, stars, time: Math.round(S.t) });
  }
  // 순위표: 판이 끝날 때마다 승리 수 · 톡 수를 더한다
  bump(sub, c, b, add) {
    const R = this.records; if (!R || !add) return;
    const T = (R.data[b] ||= {}), e = T[sub] || { value: 0 };
    Object.assign(e, { name: c.name, color: c.color, value: (e.value || 0) + add, at: Date.now(), guest: !!c.who?.user?.guest });
    tagChar(sub, e); T[sub] = e; R.dirty = true;
    getCos()?.refresh(sub);
  }
}
