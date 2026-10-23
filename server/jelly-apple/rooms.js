// 젤리 사과게임 방: 최대 12명이 같은 판(씨앗)을 동시에 · 움직임은 서버가 다시 확인해서 점수를 센다 · 봇도 함께
import { BaseRooms } from '../shared/rooms.js';
import { makeBoard, tryMove, findMove, rng, TIMES } from '../../public/jelly-apple/js/board.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91', '#6ec6ff'];

export class AppleRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 12, hz: 4, countdown: 3500, defaults: { time: 120, bots: 0 } }); }
  allow(cur, n) {
    return {
      time: TIMES.includes(Number(n.time)) ? Number(n.time) : cur.time,
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(5, Math.round(Number(n.bots)))) : cur.bots,
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    // 봇과 바로 대결: 혼자만의 방을 만들고 바로 시작
    if (m.t === 'practice') {
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults }, m.opts || {}), practice: true };
      if (!r.opts.bots) r.opts.bots = 2;
      this.rooms.set(r.id, r);
      r.players.push(c); c.room = r; c.team = null;
      this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), practice: true });
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }
  onStart(r) {
    const R = rng(r.seed ^ 0x5bd1e995);
    for (let i = 0; i < (r.opts.bots || 0) && r.players.length < this.o.max; i++) {
      const skill = 0.55 + R() * 0.5;
      r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i], color: BOT_COLORS[i], look: null, acc: [], team: null, skill, nextAt: 0 });
    }
    r.endAt = r.startAt + r.opts.time * 1000;
    for (const p of r.players) { p.board = makeBoard(r.seed); p.score = 0; p.moves = 0; p.nextAt = r.startAt + 1500 + Math.random() * 2500; }
    return { time: r.opts.time, endAt: r.endAt - Date.now() };
  }
  onMessage(c, m, r) {
    if (r.state !== 'run' || m.t !== 'mv') return;
    const now = Date.now();
    if (now < r.startAt - 200 || now > r.endAt + 1500) return;
    const n = tryMove(c.board, m.r);
    if (!n) return this.send(c, { t: 'bad', r: m.r });
    c.score += n; c.moves++;
    this.toRoom(r, { t: 'sc', id: c.id, s: c.score, n });
  }
  onTick(r, now) {
    if (now < r.startAt) return;
    // 봇: 실력만큼 빠르게 · 가끔 큰 네모
    for (const b of r.players) {
      if (!b.bot || now < b.nextAt || now > r.endAt) continue;
      const mv = findMove(b.board, Math.random, Math.random() < b.skill * 0.4 ? 'big' : 'small');
      b.nextAt = now + (2400 + Math.random() * 3200) / b.skill;
      if (!mv) continue;
      const n = tryMove(b.board, mv);
      if (n) { b.score += n; this.toRoom(r, { t: 'sc', id: b.id, s: b.score, n }); }
    }
    if (now > r.endAt + 1200) this.finish(r);
  }
  onLeave(r) { if (!r.players.some((p) => !p.bot)) r.state = 'wait'; }
  finish(r) {
    const rank = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, score: p.score || 0 }))
      .sort((a, b) => b.score - a.score).map((e, i, a) => ({ ...e, rank: i && a[i - 1].score === e.score ? null : i + 1 }));
    rank.forEach((e, i) => { if (e.rank == null) e.rank = rank[i - 1].rank; });
    if (r.practice) { r.state = 'wait'; this.toRoom(r, { t: 'finish', rank, practice: true }); r.players = r.players.filter((p) => !p.bot); return; }
    this.end(r, { rank });
  }
}
