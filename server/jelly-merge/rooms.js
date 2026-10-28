// 젤리 머지 방: 최대 8명 · 모두 같은 순서의 젤리(씨앗)로 · 크게 합치면 설탕 덩어리를 상대에게 보낸다
//   판 물리는 각자 화면에서 돌리고(점수 · 공격 · 작은 판 모습을 보낸다), 봇은 서버가 같은 엔진으로 직접 둔다
//   끝: 시간이 다 되면 점수 순 · 그 전에 혼자만 남으면 그 곰돌이가 우승
import { BaseRooms } from '../shared/rooms.js';
import { Jar, botAim, CONTAINERS } from '../../public/jelly-merge/js/engine.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다', '젤리봇 콜라'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91', '#6ec6ff', '#c98a5a'];
export const MERGE_TIMES = [120, 180, 300];

export class MergeRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 8, hz: 10, countdown: 3500, defaults: { time: 180, bots: 0, cont: 'box', bomb: true, star: true } }); }
  allow(cur, n) {
    return {
      time: MERGE_TIMES.includes(Number(n.time)) ? Number(n.time) : cur.time,
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(7, Math.round(Number(n.bots)))) : cur.bots,
      cont: CONTAINERS[n.cont] ? n.cont : cur.cont || 'box',
      bomb: n.bomb == null ? cur.bomb !== false : !!n.bomb,
      star: n.star == null ? cur.star !== false : !!n.star,
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    // 봇과 바로 대결: 혼자만의 방을 만들고 바로 시작
    if (m.t === 'practice') {
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults }, m.opts || {}), practice: true };
      if (!r.opts.bots) r.opts.bots = 3;
      this.rooms.set(r.id, r);
      r.players.push(c); c.room = r; c.team = null;
      this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), practice: true });
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }
  onStart(r) {
    for (let i = 0; i < (r.opts.bots || 0) && r.players.length < this.o.max; i++) {
      const skill = 0.45 + Math.random() * 0.5;
      r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i], color: BOT_COLORS[i], look: null, acc: [], team: null, skill });
    }
    r.endAt = r.startAt + r.opts.time * 1000;
    r.over = false; r.lastT = r.startAt; r.multi = r.players.length > 1;
    for (const p of r.players) {
      p.score = 0; p.out = false; p.outAt = 0; p.sent = 0; p.atkAt = 0; p.bdAt = 0; p.best = 0;
      if (p.bot) { p.jar = new Jar(r.seed, r.opts.cont, r.opts); p.nextAt = r.startAt + 600 + Math.random() * 900; p.aimX = null; }
    }
    return { time: r.opts.time, endAt: r.endAt - Date.now(), cont: r.opts.cont, sp: { bomb: r.opts.bomb, star: r.opts.star } };
  }
  alive(r) { return r.players.filter((p) => !p.out); }
  // 공격: 살아 있는 다른 곰돌이 중 하나에게 (점수가 높은 쪽을 조금 더 자주)
  attack(r, from, n) {
    const tg = this.alive(r).filter((p) => p !== from);
    if (!tg.length || n <= 0) return;
    const w = tg.map((p) => 1 + (p.score || 0) / 400), sum = w.reduce((a, b) => a + b, 0);
    let x = Math.random() * sum, to = tg[0];
    for (let i = 0; i < tg.length; i++) { x -= w[i]; if (x <= 0) { to = tg[i]; break; } }
    from.sent += n;
    if (to.bot) to.jar.addSugar(n); else this.send(to, { t: 'sugar', n, from: from.id });
    this.toRoom(r, { t: 'atk', from: from.id, to: to.id, n });
  }
  onMessage(c, m, r) {
    if (r.state !== 'run' || c.out) return;
    const now = Date.now();
    if (now < r.startAt - 200 || now > r.endAt + 1500) return;
    if (m.t === 'sc') {
      const s = Math.round(Number(m.s)); if (!Number.isFinite(s) || s < c.score || s > c.score + 2000) return; // 점수는 늘기만 · 한 번에 너무 많이는 안 된다
      c.score = s; c.best = Math.max(c.best, Math.min(11, Number(m.lv) || 0));
      this.toRoom(r, { t: 'sc', id: c.id, s, lv: c.best }, c);
    } else if (m.t === 'atk') {
      const n = Math.max(0, Math.min(8, Math.round(Number(m.n) || 0)));
      if (!n || now - c.atkAt < 250) return; c.atkAt = now;
      this.attack(r, c, n);
    } else if (m.t === 'bd') {
      if (!Array.isArray(m.b) || m.b.length > 240 || now - c.bdAt < 280) return; c.bdAt = now;
      const b = m.b.map((v) => Math.round(Number(v) || 0));
      this.toRoom(r, { t: 'bd', id: c.id, b, h: Math.max(0, Math.min(1, Number(m.h) || 0)) }, c);
    } else if (m.t === 'out') this.knockOut(r, c);
  }
  knockOut(r, p) {
    if (p.out) return;
    p.out = true; p.outAt = Date.now();
    this.toRoom(r, { t: 'out', id: p.id, s: p.score });
    // 혼자 남았거나 사람이 모두 아웃이면 (봇끼리 계속할 필요 없다) 곧 끝
    if (!r.over && ((r.multi && this.alive(r).length <= 1) || !this.alive(r).some((q) => !q.bot))) { r.over = true; setTimeout(() => { if (r.state === 'run') this.finish(r); }, 1800); }
  }
  onTick(r, now) {
    const dt = Math.min(0.2, (now - r.lastT) / 1000); r.lastT = now;
    if (now < r.startAt) return;
    for (const b of r.players) {
      if (!b.bot || b.out || r.over) continue;
      const J = b.jar;
      J.step(dt);
      // 실력만큼 고민하다가 떨어뜨린다
      if (now >= b.nextAt && J.canDrop()) {
        if (b.aimX == null) { b.aimX = botAim(J, Math.random, b.skill); b.nextAt = now + 200 + Math.random() * 400; }
        else { J.drop(b.aimX); b.aimX = null; b.nextAt = now + (450 + Math.random() * 750) / (0.5 + b.skill); }
      }
      J.ev.length = 0;
      const n = J.takeAtk(); if (n) this.attack(r, b, n);
      if (J.score !== b.score) { b.score = J.score; b.best = Math.max(b.best, J.best); this.toRoom(r, { t: 'sc', id: b.id, s: b.score, lv: b.best }); }
      if (now - b.bdAt > 450) { b.bdAt = now; this.toRoom(r, { t: 'bd', id: b.id, b: J.snap(), h: J.height() }); }
      if (J.over) this.knockOut(r, b);
    }
    if (now > r.endAt + 1200 && !r.over) { r.over = true; this.finish(r); }
  }
  onLeave(r, c) { if (!r.players.some((p) => !p.bot)) r.state = 'wait'; else if (!c.out) { c.out = true; if (r.multi && this.alive(r).length <= 1 && !r.over) { r.over = true; setTimeout(() => { if (r.state === 'run') this.finish(r); }, 1200); } } }
  finish(r) {
    // 혼자 남은 곰돌이가 있으면 1등 · 나머지는 점수 순
    const alive = this.alive(r), solo = r.multi && alive.length === 1 && Date.now() < r.endAt && !alive[0].bot ? alive[0] : null; // 봇이 마지막에 남은 건 점수로
    const rank = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, score: p.score || 0, lv: p.best || 0, sent: p.sent || 0, out: !!p.out, last: p === solo }))
      .sort((a, b) => (b.last - a.last) || (b.score - a.score)).map((e, i) => ({ ...e, rank: i + 1 }));
    for (const p of r.players) p.jar = null;
    if (r.practice) { r.state = 'wait'; this.toRoom(r, { t: 'finish', rank, practice: true }); r.players = r.players.filter((p) => !p.bot); return; }
    this.end(r, { rank });
  }
}
