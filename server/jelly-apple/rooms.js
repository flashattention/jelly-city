// 젤리 사과게임 방: 최대 12명 · 움직임은 서버가 다시 확인해서 점수를 센다 · 봇도 함께
//   mode 'race': 각자 같은 판(씨앗)으로 겨루기 · 'shared': 판 하나를 다 같이 (먼저 묶는 사람이 임자 = 땅따먹기)
import { BaseRooms } from '../shared/rooms.js';
import { makeBoard, tryMove, findMove, rng, normRect, COLS, ROWS, TIMES } from '../../public/jelly-apple/js/board.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91', '#6ec6ff'];

export class AppleRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 12, hz: 4, countdown: 3500, defaults: { time: 120, bots: 0, mode: 'race' } }); }
  allow(cur, n) {
    return {
      time: TIMES.includes(Number(n.time)) ? Number(n.time) : cur.time,
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(5, Math.round(Number(n.bots)))) : cur.bots,
      mode: n.mode === 'shared' || n.mode === 'race' ? n.mode : cur.mode || 'race',
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
    r.shared = r.opts.mode === 'shared';
    if (r.shared) { r.board = makeBoard(r.seed); r.own = new Array(COLS * ROWS).fill(0); r.over = false; }
    for (const p of r.players) { p.board = r.shared ? r.board : makeBoard(r.seed); p.score = 0; p.moves = 0; p.nextAt = r.startAt + 1500 + Math.random() * 2500; p.drT = 0; p.plan = null; }
    return { time: r.opts.time, endAt: r.endAt - Date.now() };
  }
  onMessage(c, m, r) {
    if (r.state !== 'run') return;
    const now = Date.now();
    // 한 판 같이: 지금 드래그하는 네모를 다른 사람에게 보여 준다 (초당 10번까지)
    if (m.t === 'dr' && r.shared) { if (now - c.drT < 90) return; c.drT = now; const rc = m.r ? normRect(m.r) : null; this.toRoom(r, { t: 'dr', id: c.id, r: rc }, c); return; }
    if (m.t !== 'mv') return;
    if (now < r.startAt - 200 || now > r.endAt + 1500 || r.over) return;
    if (r.shared) return this.sharedMove(r, c, m.r);
    const n = tryMove(c.board, m.r);
    if (!n) return this.send(c, { t: 'bad', r: m.r });
    c.score += n; c.moves++;
    this.toRoom(r, { t: 'sc', id: c.id, s: c.score, n });
  }
  // 판 하나: 먼저 묶은 사람이 임자. 늦으면 'bad' 와 지금 판을 돌려줘서 화면을 맞춘다
  sharedMove(r, c, rect) {
    const rc = normRect(rect);
    const n = rc ? tryMove(r.board, rc) : 0;
    if (!n) return this.send(c, { t: 'bad', r: rect, b: r.board, own: r.own });
    for (let y = rc[1]; y <= rc[3]; y++) for (let x = rc[0]; x <= rc[2]; x++) if (!r.own[y * COLS + x]) r.own[y * COLS + x] = c.id;
    c.score += n; c.moves++;
    this.toRoom(r, { t: 'clr', id: c.id, r: rc, n, s: c.score });
    // 더 묶을 수 있는 네모가 없으면 바로 끝
    if (!findMove(r.board)) { r.over = true; this.toRoom(r, { t: 'cleared' }); setTimeout(() => { if (r.state === 'run') this.finish(r); }, 1500); }
  }
  onTick(r, now) {
    if (now < r.startAt) return;
    // 봇: 실력만큼 빠르게 · 가끔 큰 네모
    for (const b of r.players) {
      if (!b.bot || now < b.nextAt || now > r.endAt) continue;
      if (r.over) continue;
      // 한 판 같이: 봇도 먼저 네모를 보여 주고(0.6초) 가져간다 → 사람이 가로챌 수도 있다
      if (r.shared && b.plan) { const mv = b.plan; b.plan = null; b.nextAt = now + (2400 + Math.random() * 3200) / b.skill; this.toRoom(r, { t: 'dr', id: b.id, r: null }); this.sharedMove(r, b, mv); continue; }
      if (r.shared) { const mv = findMove(b.board, Math.random, Math.random() < b.skill * 0.4 ? 'big' : 'small'); if (mv) { b.plan = mv; b.nextAt = now + 600; this.toRoom(r, { t: 'dr', id: b.id, r: mv }); } else b.nextAt = now + 1000; continue; }
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
