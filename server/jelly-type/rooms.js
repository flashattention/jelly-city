// 젤리 타자연습 경주 방: 최대 8명이 같은 문장을 쳐서 먼저 끝내기 · 진행도는 곰돌이가 트랙을 달리는 걸로 · 젤리봇 · 팀전(팀 평균 순위)
import { BaseRooms } from '../shared/rooms.js';
import { pickSentences, strokesIn } from '../../public/jelly-type/js/texts.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d'];
const MAX_KPM = 1600; // 사람이 낼 수 없는 빠르기

export class TypeRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 8, hz: 6, countdown: 3500, defaults: { count: 5, bots: 0, team: false } }); }
  allow(cur, n) {
    return {
      count: [3, 5, 8].includes(Number(n.count)) ? Number(n.count) : cur.count,
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(3, Math.round(Number(n.bots)))) : cur.bots,
      team: typeof n.team === 'boolean' ? n.team : cur.team,
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    if (m.t === 'practice') {
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults, team: false }, m.opts || {}), practice: true };
      if (!r.opts.bots) r.opts.bots = 2;
      this.rooms.set(r.id, r);
      r.players.push(c); c.room = r; c.team = null;
      this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), practice: true });
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }
  onStart(r) {
    const texts = pickSentences(r.seed, r.opts.count);
    r.total = strokesIn(texts.join(''));
    for (let i = 0; i < (r.opts.team ? 0 : r.opts.bots || 0) && r.players.length < this.o.max; i++) { // 팀전은 사람끼리
      const kpm = 180 + Math.random() * 260;
      const team = r.opts.team ? this.smaller(r, null) : null;
      r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i], color: BOT_COLORS[i], look: null, acc: [], team, kpm, st: [0, 0] });
    }
    for (const p of r.players) { p.done = false; p.result = null; if (!p.bot) p.st = [0, 0]; }
    r.firstDone = 0;
    return { texts, total: r.total };
  }
  onMessage(c, m, r) {
    if (r.state !== 'run' || m.t !== 'done' || c.done) return;
    const time = Number(m.time), kpm = Number(m.kpm), acc = Number(m.acc);
    if (![time, kpm, acc].every(Number.isFinite)) return;
    if (time < (r.total / MAX_KPM) * 60 || kpm > MAX_KPM || acc < 0 || acc > 100) return this.send(c, { t: 'error', text: '기록이 이상해요' });
    c.done = true; c.result = { time: Math.round(time * 100) / 100, kpm: Math.round(kpm), acc: Math.round(acc) };
    if (!r.firstDone) r.firstDone = Date.now();
    this.toRoom(r, { t: 'done', id: c.id, ...c.result });
  }
  onTick(r, now) {
    if (now < r.startAt) return;
    const el = (now - r.startAt) / 1000;
    // 젤리봇: 자기 빠르기대로 (가끔 쉬었다가)
    for (const b of r.players) {
      if (!b.bot || b.done) continue;
      const prog = Math.min(1, (el * b.kpm) / 60 / r.total);
      b.st = [prog, Math.round(b.kpm)];
      if (prog >= 1) { b.done = true; b.result = { time: Math.round(el * 100) / 100, kpm: Math.round(b.kpm), acc: 92 + Math.floor(Math.random() * 8) }; if (!r.firstDone) r.firstDone = now; this.toRoom(r, { t: 'done', id: b.id, ...b.result }); }
    }
    const humans = r.players.filter((p) => !p.bot);
    if (humans.every((p) => p.done) || (r.firstDone && now - r.firstDone > 40000) || el > 600) this.finish(r);
  }
  onLeave(r) { const humans = r.players.filter((p) => !p.bot); if (humans.length && humans.every((p) => p.done)) this.finish(r); }
  finish(r) {
    if (r.state !== 'run') return;
    const rows = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, team: p.team, prog: p.st?.[0] ?? 0, ...(p.result ? { time: p.result.time, kpm: p.result.kpm, accu: p.result.acc } : {}) }));
    rows.sort((a, b) => (a.time != null) - (b.time != null) ? (a.time != null ? -1 : 1) : a.time != null ? a.time - b.time : b.prog - a.prog);
    const rank = rows.map((e, i) => ({ ...e, rank: i + 1 }));
    let team = null;
    if (r.opts.team) {
      const avg = (t) => { const L = rank.filter((e) => e.team === t); return L.length ? L.reduce((a, e) => a + e.rank, 0) / L.length : 99; };
      const red = avg('red'), blue = avg('blue');
      team = { red: Math.round(red * 10) / 10, blue: Math.round(blue * 10) / 10, winner: red === blue ? 'draw' : red < blue ? 'red' : 'blue' };
    }
    if (r.practice) { r.state = 'wait'; this.toRoom(r, { t: 'finish', rank, team, practice: true }); r.players = r.players.filter((p) => !p.bot); return; }
    this.end(r, { rank, team });
  }
}
