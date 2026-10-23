// 젤리 끝말잇기 방: 최대 8명 · 차례대로 · 젤리 하트 3개 (시간 안에 못 이으면 하나씩) · 마지막까지 남으면 우승 · 젤리봇도 함께
import { BaseRooms, clean } from '../shared/rooms.js';
import { startsFor, isWordShape } from './dict.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0'];
const MAX_WORDS = 90;

export class WordRooms extends BaseRooms {
  constructor(userOf, dict) {
    super(userOf, { max: 8, hz: 5, countdown: 3500, defaults: { bots: 0, speed: 'normal', lives: 3 } });
    this.dict = dict;
  }
  allow(cur, n) {
    return {
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(4, Math.round(Number(n.bots)))) : cur.bots,
      speed: n.speed === 'fast' || n.speed === 'normal' ? n.speed : cur.speed,
      lives: [1, 2, 3, 5].includes(Number(n.lives)) ? Number(n.lives) : cur.lives,
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
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
  turnMs(r) { const fast = r.opts.speed === 'fast'; return Math.max(fast ? 5000 : 7000, (fast ? 10000 : 16000) - r.g.chain.length * (fast ? 250 : 350)); }
  onStart(r) {
    for (let i = 0; i < (r.opts.bots || 0) && r.players.length < this.o.max; i++) r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i], color: BOT_COLORS[i], look: null, acc: [], team: null, strong: Math.random() < 0.45 });
    const order = [...r.players].sort(() => Math.random() - 0.5);
    const used = new Set(), first = this.dict.starter(used); used.add(first);
    r.g = { order, turn: 0, chain: [{ w: first, by: 0 }], used, need: first.at(-1), checking: false, outOrder: [], ended: false };
    for (const p of r.players) { p.lives = r.opts.lives; p.score = 0; p.words = 0; p.out = false; p.botAt = 0; }
    r.g.deadline = r.startAt + this.turnMs(r);
    this.planBot(r);
    return { order: order.map((p) => p.id), chain: r.g.chain, need: r.g.need, starts: startsFor(r.g.need), turn: order[0].id, dl: r.g.deadline - Date.now(), lives: r.opts.lives };
  }
  cur(r) { return r.g.order[r.g.turn]; }
  planBot(r) { const p = this.cur(r); if (p?.bot) p.botAt = Math.max(Date.now(), r.startAt) + (p.strong ? 1200 : 1800) + Math.random() * 2600; }
  onMessage(c, m, r) {
    if (r.state !== 'run' || !r.g || r.g.ended) return;
    if (m.t === 'ty') { // 치는 중인 글자 (다른 사람 화면에 보여 준다)
      if (this.cur(r) !== c) return;
      const now = Date.now(); if (now - (c.tyAt || 0) < 120) return; c.tyAt = now;
      return this.toRoom(r, { t: 'ty', id: c.id, s: clean(m.s, 14) }, c);
    }
    if (m.t === 'w') this.submit(r, c, clean(m.w, 14).replace(/\s/g, ''));
  }
  async submit(r, c, w) {
    const g = r.g;
    if (this.cur(r) !== c || g.checking || Date.now() < r.startAt) return;
    const no = (why) => this.toRoom(r, { t: 'no', id: c.id, w, why });
    if (!isWordShape(w)) return no('두 글자 이상 한글 낱말만 돼요');
    const starts = startsFor(g.need);
    if (!starts.includes(w[0])) return no(`'${starts.join("' · '")}'(으)로 시작해야 해요`);
    if (g.used.has(w)) return no('이미 나온 단어예요');
    g.checking = true;
    this.toRoom(r, { t: 'chk', id: c.id, w });
    const res = await this.dict.check(w);
    g.checking = false;
    if (r.g !== g || g.ended || this.cur(r) !== c || r.state !== 'run') return;
    if (!res.ok) return no(res.why);
    // 인정!
    const left = Math.max(0, g.deadline - Date.now());
    const pts = 10 + (w.length - 2) * 6 + Math.floor(left / 1000);
    c.score += pts; c.words++;
    g.chain.push({ w, by: c.id }); g.used.add(w); g.need = w.at(-1);
    if (g.chain.length >= MAX_WORDS) return this.finish(r);
    this.advance(r);
    this.toRoom(r, { t: 'ok', id: c.id, w, pts, score: c.score, loose: !!res.loose, need: g.need, starts: startsFor(g.need), turn: this.cur(r).id, dl: g.deadline - Date.now() });
  }
  advance(r) {
    const g = r.g, n = g.order.length;
    for (let k = 1; k <= n; k++) { const i = (g.turn + k) % n; if (!g.order[i].out) { g.turn = i; break; } }
    g.deadline = Date.now() + this.turnMs(r);
    this.planBot(r);
  }
  onTick(r, now) {
    const g = r.g; if (!g || g.ended || now < r.startAt) return;
    const p = this.cur(r);
    // 봇 차례
    if (p?.bot && p.botAt && now >= p.botAt && !g.checking) {
      p.botAt = 0;
      const want = g.need, chainLen = g.chain.length;
      this.dict.botWord(want, g.used, p.strong).then((w) => {
        if (r.g !== g || g.ended || this.cur(r) !== p || g.chain.length !== chainLen) return;
        if (!w || Math.random() < (p.strong ? 0.03 : 0.07)) return; // 생각이 안 난다 → 시간 초과
        let i = 0; const typ = setInterval(() => {
          i++; this.toRoom(r, { t: 'ty', id: p.id, s: w.slice(0, i) });
          if (i >= w.length) { clearInterval(typ); setTimeout(() => this.submit(r, p, w), 350); }
        }, 160);
      });
    }
    if (now < g.deadline || g.checking) return;
    // 시간 초과: 젤리 하트 하나
    p.lives--;
    const out = p.lives <= 0;
    if (out) { p.out = true; g.outOrder.push(p.id); }
    const alive = g.order.filter((x) => !x.out), humans = alive.filter((x) => !x.bot);
    const over = alive.length <= 1 || (r.practice && (!humans.length || alive.length === humans.length && r.opts.bots > 0)) || (!humans.length);
    this.toRoom(r, { t: 'miss', id: p.id, lives: Math.max(0, p.lives), out });
    if (over) return this.finish(r);
    // 새 단어로 다시 시작
    const w = this.dict.starter(g.used); g.used.add(w); g.chain.push({ w, by: 0 }); g.need = w.at(-1);
    this.advance(r);
    this.toRoom(r, { t: 'new', w, need: g.need, starts: startsFor(g.need), turn: this.cur(r).id, dl: g.deadline - Date.now() });
  }
  onLeave(r, c) {
    // 나간 사람은 탈락으로 (순서는 그대로 두고 건너뛴다)
    const g = r.g; if (!g || g.ended || !g.order.includes(c) || c.out) return;
    const wasTurn = this.cur(r) === c;
    c.out = true; g.outOrder.push(c.id);
    const alive = g.order.filter((x) => !x.out);
    if (alive.length <= 1 || !alive.some((x) => !x.bot)) return this.finish(r);
    if (wasTurn) { this.advance(r); this.toRoom(r, { t: 'new', w: null, need: g.need, starts: startsFor(g.need), turn: this.cur(r).id, dl: g.deadline - Date.now() }); }
  }
  finish(r) {
    const g = r.g; if (!g || g.ended) return;
    g.ended = true;
    const alive = g.order.filter((p) => !p.out).sort((a, b) => b.score - a.score);
    const outs = [...g.outOrder].reverse().map((id) => g.order.find((p) => p.id === id)).filter(Boolean);
    const rank = [...alive, ...outs].map((p, i) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, score: p.score, words: p.words, lives: Math.max(0, p.lives), rank: i + 1 }));
    const longest = g.chain.filter((x) => x.by).sort((a, b) => b.w.length - a.w.length)[0] || null;
    const payload = { rank, chain: g.chain.length, longest };
    if (r.practice) { r.state = 'wait'; this.toRoom(r, { t: 'finish', ...payload, practice: true }); r.players = r.players.filter((p) => !p.bot); return; }
    this.end(r, payload);
  }
}
