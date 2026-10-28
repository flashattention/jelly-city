// 젤리 땡 방: 2 ~ 6명 · 차례대로 카드를 뒤집고 조건이 맞으면 종을 친다 (규칙: public/jelly-ding/js/rules.js)
//   서버가 심판: 카드 · 차례 · 종 친 순서를 모두 서버가 정한다
//   종은 처음 온 것부터 90ms 동안 모아서, 사람마다 왕복 시간의 절반만큼 앞당겨 가장 빠른 사람을 고른다 (느린 인터넷도 공평하게)
import { BaseRooms } from '../shared/rooms.js';
import { makeDeck, judge, rng, targetsFor, TIMES, SPEEDS } from '../../public/jelly-ding/js/rules.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91'];
const RING_WINDOW = 90, LOCK_MS = 1500, LATE_MS = 350;

export class DingRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 6, hz: 20, countdown: 3500, defaults: { time: 180, bots: 0, speed: 'normal', specials: true } }); }
  allow(cur, n) {
    return {
      time: TIMES.includes(Number(n.time)) ? Number(n.time) : cur.time,
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(5, Math.round(Number(n.bots)))) : cur.bots,
      speed: n.speed === 'fast' || n.speed === 'normal' ? n.speed : cur.speed || 'normal',
      specials: typeof n.specials === 'boolean' ? n.specials : cur.specials ?? true,
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    if (m.t === 'pg') return this.send(c, { t: 'po', c: m.c });
    if (m.t === 'rtt') { const v = Number(m.ms); if (Number.isFinite(v) && v >= 0) c.rtt = Math.min(400, v); return; }
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
    const R = rng(r.seed);
    for (let i = 0; i < (r.opts.bots || 0) && r.players.length < this.o.max; i++) {
      r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i], color: BOT_COLORS[i], look: null, acc: [], team: null, skill: 0.5 + R() * 0.5 });
    }
    const deck = makeDeck(R, r.opts.specials !== false), n = r.players.length, each = Math.floor(deck.length / n);
    r.players.forEach((p, i) => { p.deck = deck.slice(i * each, (i + 1) * each); p.pile = []; p.out = false; p.outAt = 0; p.rings = 0; p.good = 0; p.planV = -1; p.ringAt = 0; p.flipAt = 0; });
    const speed = SPEEDS[r.opts.speed] || SPEEDS.normal;
    const T = targetsFor(n);
    r.g = { v: 0, target: T[1], targets: T, turn: r.players[Math.floor(R() * n)], turnEnd: r.startAt + 600 + speed, speed, lock: 0, rings: [], resolveAt: 0, prev: null, flipAt: 0, R, over: false };
    r.endAt = r.startAt + r.opts.time * 1000;
    return { time: r.opts.time, state: this.pub(r, r.startAt) };
  }
  tops(r) { return r.players.map((p) => (p.pile.length ? p.pile[p.pile.length - 1] : -1)); }
  pub(r, now = Date.now()) {
    const g = r.g;
    return { v: g.v, target: g.target, turn: g.turn?.id || 0, tLeft: Math.max(0, g.turnEnd - now), lockLeft: Math.max(0, g.lock - now), endIn: r.endAt - now, speed: g.speed,
      seats: r.players.map((p) => [p.id, p.deck.length, p.pile.length, p.pile.length ? p.pile[p.pile.length - 1] : -1, p.out ? 1 : 0]) };
  }
  sync(r, ev) { this.toRoom(r, { t: 's', s: this.pub(r), ev }); }
  onMessage(c, m, r) {
    if (r.state !== 'run' || !r.g) return;
    const now = Date.now();
    if (now < r.startAt) return;
    if (m.t === 'flip') return this.flip(r, c, now);
    if (m.t === 'ring') return this.ring(r, c, Number(m.v), now - Math.min(150, (c.rtt || 0) / 2));
  }
  flip(r, p, now) {
    const g = r.g;
    if (g.over || g.turn !== p || now < g.lock || g.rings.length || !p.deck.length) return;
    g.prev = { v: g.v, j: judge(this.tops(r), g.target) };
    const c = p.deck.pop(); p.pile.push(c);
    g.v++; g.flipAt = now;
    this.nextTurn(r, now);
    this.sync(r, { k: 'flip', id: p.id, c });
  }
  nextTurn(r, now, from = r.g.turn) {
    const g = r.g, ps = r.players, i0 = Math.max(0, ps.indexOf(from));
    g.turn = null;
    for (let k = 1; k <= ps.length; k++) { const p = ps[(i0 + k) % ps.length]; if (!p.out && p.deck.length) { g.turn = p; break; } }
    g.turnEnd = Math.max(now, g.lock) + g.speed;
    if (!g.turn) this.finish(r); // 모두 카드가 바닥났다
  }
  ring(r, p, v, at) {
    const g = r.g;
    if (g.over || p.out || Date.now() < g.lock || g.rings.some((x) => x.p === p)) return;
    g.rings.push({ p, v, at });
    if (!g.resolveAt) g.resolveAt = Date.now() + RING_WINDOW;
    this.toRoom(r, { t: 'rang', id: p.id }); // 종 소리는 바로 (결과는 조금 뒤)
  }
  resolve(r, now) {
    const g = r.g;
    const rs = g.rings.sort((a, b) => a.at - b.at); g.rings = []; g.resolveAt = 0;
    const first = rs[0], p = first.p;
    // 카드가 막 바뀐 순간에 친 종은 바로 앞 장면으로 판단한다 (화면보다 서버가 먼저 바뀐 것)
    const j = first.v === g.v - 1 && g.prev && g.prev.v === first.v && now - g.flipAt < LATE_MS ? g.prev.j : judge(this.tops(r), g.target);
    p.rings++;
    const ev = { k: 'ring', id: p.id, ok: j.ok, why: j.why, hit: j.hit, totals: j.totals, target: g.target, late: rs.slice(1).map((x) => x.p.id) };
    if (j.ok) {
      p.good++;
      const won = [];
      for (const q of r.players) { won.push(...q.pile); q.pile = []; }
      for (let i = won.length - 1; i > 0; i--) { const k = Math.floor(g.R() * (i + 1)); [won[i], won[k]] = [won[k], won[i]]; }
      p.deck.unshift(...won); // 가져간 카드는 내 카드 묶음 맨 아래로
      ev.gain = won.length;
      const old = g.target, opts = g.targets.filter((t) => t !== old); g.target = opts[Math.floor(g.R() * opts.length)];
      ev.next = g.target;
      g.lock = now + LOCK_MS + 400;
      g.turn = p.deck.length ? p : null;
      if (!g.turn) this.nextTurn(r, now, p);
      g.turnEnd = g.lock + g.speed;
    } else {
      // 틀렸다: 다른 사람 모두에게 1장씩
      const pay = [];
      for (const q of r.players) { if (q === p || q.out || !p.deck.length) continue; q.deck.unshift(p.deck.pop()); pay.push(q.id); }
      ev.pay = pay;
      g.lock = now + LOCK_MS;
      if (g.turn) g.turnEnd = g.lock + g.speed;
      if (g.turn === p && !p.deck.length) this.nextTurn(r, now, p);
    }
    g.v++; g.prev = null;
    this.checkOut(r, now, ev);
    if (!g.over && g.turn && !g.turn.deck.length) this.nextTurn(r, now);
    if (!g.over) this.sync(r, ev);
  }
  checkOut(r, now, ev) {
    const g = r.g;
    for (const q of r.players) if (!q.out && !q.deck.length && !q.pile.length) { q.out = true; q.outAt = now; (ev.outs ||= []).push(q.id); }
    if (r.players.filter((q) => !q.out).length <= 1) { this.sync(r, ev); this.finish(r); }
  }
  onTick(r, now) {
    const g = r.g;
    if (!g || g.over || now < r.startAt) return;
    if (now >= r.endAt) return this.finish(r);
    if (g.resolveAt && now >= g.resolveAt) return this.resolve(r, now);
    if (now < g.lock || g.rings.length) return;
    // 차례 시간이 지나면 저절로 뒤집는다 (템포 유지)
    if (g.turn && now >= g.turnEnd) return this.flip(r, g.turn, now);
    // 봇: 장면이 바뀔 때마다 한 번 판단 · 사람처럼 늦게 · 가끔 실수
    const j = judge(this.tops(r), g.target);
    for (const b of r.players) {
      if (!b.bot || b.out) continue;
      if (b.planV !== g.v) {
        b.planV = g.v; b.ringAt = 0;
        const sk = b.skill;
        if (j.ok) { if (Math.random() < 0.55 + sk * 0.42) b.ringAt = now + (j.why === 'gold' ? 360 : 420) + Math.random() * (700 - sk * 350) + (1 - sk) * 300; }
        else if (j.why === 'sour' && j.totals.includes(g.target)) { if (Math.random() < 0.12 * (1.15 - sk)) b.ringAt = now + 450 + Math.random() * 500; } // 시큼젤리 함정에 걸린다
        else if (Math.random() < 0.022 * (1.3 - sk)) b.ringAt = now + 500 + Math.random() * 700; // 헛손질
        b.flipAt = 0;
      }
      if (b.ringAt && now >= b.ringAt) { b.ringAt = 0; this.ring(r, b, g.v, now); }
      if (g.turn === b && !g.rings.length) {
        if (!b.flipAt) b.flipAt = Math.max(now + 420 + Math.random() * 650, b.ringAt ? b.ringAt + 150 : 0); // 칠 생각이면 먼저 치고 뒤집는다
        else if (now >= b.flipAt) { b.flipAt = 0; this.flip(r, b, now); return; }
      }
    }
  }
  onLeave(r, c) {
    const g = r.g; if (!g || g.over) return;
    g.rings = g.rings.filter((x) => x.p !== c); if (!g.rings.length) g.resolveAt = 0;
    if (g.turn === c) { const i = Math.max(0, r.players.findIndex((p) => p.id > c.id) - 1); this.nextTurn(r, Date.now(), r.players[i] || r.players[0]); }
    if (!g.over && r.players.filter((q) => !q.out).length <= 1 && r.players.some((q) => !q.bot)) return this.finish(r);
    if (!g.over) this.sync(r);
  }
  finish(r) {
    const g = r.g; if (!g || g.over) return;
    g.over = true;
    const rank = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, score: p.deck.length + p.pile.length, good: p.good, rings: p.rings, out: p.out, outAt: p.outAt }))
      .sort((a, b) => (a.out !== b.out ? (a.out ? 1 : -1) : a.out ? b.outAt - a.outAt : b.score - a.score))
      .map((e, i) => ({ ...e, rank: i + 1 }));
    // 같은 점수는 같은 등수
    for (let i = 1; i < rank.length; i++) if (!rank[i].out && !rank[i - 1].out && rank[i].score === rank[i - 1].score) rank[i].rank = rank[i - 1].rank;
    setTimeout(() => { if (r.state === 'run') this.end(r, { rank, practice: !!r.practice }); }, 1600);
  }
}
