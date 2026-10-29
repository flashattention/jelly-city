// 젤리궁정 방: 4~7명 숨은 역할 카드 대결 · 모자라는 자리는 젤리봇이 채운다 · 규칙은 서버가 판정 (손패는 주인에게만)
import { BaseRooms } from '../shared/rooms.js';
import { newGame, act, tick, botMove, view } from '../../public/jelly-court/js/rules.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91', '#6ec6ff'];
const MIN = 4, MAX = 7;

export class CourtRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: MAX, hz: 5, countdown: 2500, defaults: { bots: 3 } }); }
  allow(cur, n) { return { bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(6, Math.round(Number(n.bots)))) : cur.bots }; }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    if (m.t === 'practice') {
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults }, m.opts || {}), practice: true };
      this.rooms.set(r.id, r);
      r.players.push(c); c.room = r; c.team = null;
      this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), practice: true });
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }
  onStart(r) {
    const humans = r.players.length;
    const want = Math.max(MIN, Math.min(MAX, humans + (r.opts.bots || 0)));
    for (let i = 0; r.players.length < want; i++) r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i % 6], color: BOT_COLORS[i % 6], look: null, acc: [], team: null });
    r.g = newGame(r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, bot: !!p.bot })), Math.random, r.startAt);
    r.botAt = r.startAt + 1200; r.reactAt = 0; r.overAt = 0;
    setTimeout(() => this.flush(r), this.o.countdown + 50);
    return {};
  }
  seatOf(r, id) { return r.g.seats.findIndex((s) => s.id === id); }
  // 바뀐 판을 한 사람씩 (자기 손패 · 몰래 본 역할만 보이게)
  flush(r) {
    const G = r.g; if (!G) return;
    const now = Date.now(), ev = G.ev.splice(0);
    for (const p of r.players) {
      if (p.bot) continue;
      const me = this.seatOf(r, p.id);
      const mine = ev.filter((e) => (e.k === 'peek' ? e.i === me : true)).map((e) => (e.k === 'steal' && e.i !== me && e.from !== me ? { ...e, c: null } : e));
      this.send(p, { t: 'gs', g: view(G, me, now), ev: mine });
    }
    if (G.win && !r.overAt) r.overAt = now + 4000;
  }
  onMessage(c, m, r) {
    const G = r.g; if (!G || r.state !== 'run' || Date.now() < r.startAt) return;
    if (!['play', 'end', 'react'].includes(m.t)) return;
    const i = this.seatOf(r, c.id); if (i < 0) return;
    if (act(G, i, { t: m.t, id: Number(m.id), to: Number(m.to), use: !!m.use }, Date.now())) { r.botAt = Math.max(r.botAt, Date.now() + 700); this.flush(r); }
    else this.send(c, { t: 'nope' });
  }
  onTick(r, now) {
    const G = r.g; if (!G || now < r.startAt) return;
    if (r.overAt) { if (now >= r.overAt) this.finish(r); return; }
    const before = G.turns + G.log.length + (G.pend?.wait.length || 0) + G.phase;
    tick(G, now);
    // 봇: 막기는 1~2초 생각하고 · 내 차례면 1~1.6초마다 한 장씩
    if (G.phase === 'react' && G.pend) {
      if (!r.reactAt) r.reactAt = now + 900 + Math.random() * 900;
      if (now >= r.reactAt) { r.reactAt = 0; for (const j of [...G.pend.wait]) if (G.seats[j].bot) act(G, j, { t: 'react', use: Math.random() < 0.92 }, now); }
    } else if (G.phase === 'play' && G.seats[G.turn].bot && now >= r.botAt) {
      act(G, G.turn, botMove(G, G.turn), now) || act(G, G.turn, { t: 'end' }, now);
      r.botAt = now + 1000 + Math.random() * 600;
    }
    if (G.ev.length || before !== G.turns + G.log.length + (G.pend?.wait.length || 0) + G.phase) this.flush(r);
  }
  // 나가면 그 자리는 젤리봇이 이어서 한다
  onLeave(r, c) {
    const G = r.g; if (!G) return;
    const s = G.seats.find((x) => x.id === c.id); if (s) { s.bot = true; s.name = `${s.name}(봇)`; }
    if (!r.players.some((p) => !p.bot)) { r.state = 'wait'; r.g = null; return; }
    this.flush(r);
  }
  finish(r) {
    const G = r.g; if (!G) return;
    const seats = G.seats.map((s) => ({ id: s.id, name: s.name, color: s.color, look: s.look, bot: s.bot, role: s.role, ch: s.ch, alive: s.alive, kills: s.kills }));
    const payload = { win: G.win, seats };
    r.g = null; r.overAt = 0;
    if (r.practice) { r.state = 'wait'; this.toRoom(r, { t: 'finish', ...payload, practice: true }); r.players = r.players.filter((p) => !p.bot); return; }
    this.end(r, payload);
  }
}
