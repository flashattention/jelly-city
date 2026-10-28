// 젤리 가이즈 방: 최대 20명 + 젤리봇으로 채워서 여러 판(레이스 · 버티기 · 결승)을 이어 한다
//   코스는 씨앗으로 모두 같게 만들고, 장애물은 시간으로 움직여서 따로 보내지 않는다
//   사람 몸은 각자 화면이 움직이고(위치만 보냄), 봇은 서버가 같은 몸 규칙으로 움직인다
//   통과 · 탈락 · 떨어지는 판 · 터진 문은 서버가 정해서 모두에게 알린다
import { BaseRooms } from '../shared/rooms.js';
import { buildRound, planEpisode, quotaFor, ROUNDS } from '../../public/jelly-guys/js/rounds.js';
import { newBody, step, pushApart } from '../../public/jelly-guys/js/phys.js';
import { newBrain, think } from '../../public/jelly-guys/js/bots.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다', '젤리봇 콜라', '젤리봇 메론', '젤리봇 자두', '젤리봇 망고', '젤리봇 체리', '젤리봇 키위', '젤리봇 라임', '젤리봇 블루', '젤리봇 코코', '젤리봇 우유', '젤리봇 녹차', '젤리봇 꿀', '젤리봇 사과', '젤리봇 귤', '젤리봇 수박', '젤리봇 바나나', '젤리봇 오렌지', '젤리봇 자몽'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91', '#6ec6ff', '#ff8a3d', '#b5e655', '#d36bff', '#ffc94d', '#ff4f6d', '#7ed957', '#c6f06b', '#4d8bff', '#c49a6c', '#fff3e0', '#8bc34a', '#ffca28', '#ef5350', '#ffa726', '#66bb6a', '#fff176', '#ff9800', '#ff7f7f'];
export const FILLS = [8, 12, 16, 20];
const INTRO = 3600, COUNT = 3000, RESULT = 3600, DT = 1 / 60;

export class GuysRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 20, hz: 20, countdown: 1500, defaults: { fill: 16 } }); }
  allow(cur, n) { return { fill: FILLS.includes(Number(n.fill)) ? Number(n.fill) : cur.fill || 16 }; }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    // 혼자 하기: 나만의 방 + 젤리봇 → 바로 시작
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
    const humans = r.players.filter((p) => !p.bot).length;
    const fill = Math.max(humans, r.opts.fill || 16);
    for (let i = 0; humans + i < fill; i++) {
      const k = (i + (r.seed % 7)) % BOT_NAMES.length;
      r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[k], color: BOT_COLORS[k], look: { hat: 1 + ((r.seed >> i) % 9), outfit: (r.seed >> (i + 3)) % 7 }, acc: [], team: null, st: null });
    }
    r.ep = { plan: planEpisode(r.players.length, r.seed), ri: -1, alive: new Set(r.players.map((p) => p.id)), place: new Map(), elimOrder: [] };
    r.phase = 'wait'; r.phaseAt = r.startAt;
    return { plan: r.ep.plan };
  }
  onLeave(r, c) { if (r.ep?.alive.has(c.id)) this.eliminate(r, c, true); }

  // ---------- 판 시작 ----------
  startRound(r, now) {
    const ep = r.ep; ep.ri++;
    const id = ep.plan[Math.min(ep.ri, ep.plan.length - 1)];
    const alive = r.players.filter((p) => ep.alive.has(p.id));
    // 마지막 판이 아닌데 너무 적게 남았으면 바로 결승
    const final = ep.ri >= ep.plan.length - 1 || alive.length <= 3;
    const rid = final && ROUNDS[id].kind !== 'final' ? ep.plan[ep.plan.length - 1] : id;
    const seed = (r.seed * 31 + ep.ri * 977) >>> 0;
    const L = buildRound(rid, seed);
    const quota = L.kind === 'final' ? 1 : quotaFor(L.kind, alive.length);
    const slots = alive.map((p) => p.id).sort(() => Math.random() - 0.5);
    r.round = { id: rid, L, seed, quota, start: alive.length, playAt: now + INTRO + COUNT, done: [], outs: [], tiles: new Map(), doors: new Set(), over: false, slots, lastT: 0 };
    alive.forEach((p) => { p.fin = false; p.out = false; p.st = null; });
    for (const b of alive.filter((p) => p.bot)) {
      const s = L.spawn[slots.indexOf(b.id) % L.spawn.length];
      b.body = newBody(s); b.body.yaw = L.kind === 'race' || L.crown ? 0 : Math.atan2(-s.x, -s.z);
      b.ai = newBrain(b.id, seed);
      b.st = this.botSt(b);
    }
    r.phase = 'intro';
    this.toRoom(r, { t: 'round', i: ep.ri, n: ep.plan.length, id: rid, seed, quota, alive: slots, intro: INTRO, count: COUNT, time: L.time, final: L.kind === 'final' });
  }
  botSt(b) { const p = b.body; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), (p.ground ? 1 : 0) | (p.dive ? 2 : 0) | (p.stun > 0 ? 4 : 0) | (Math.hypot(p.vx, p.vz) > 1 ? 8 : 0)]; }

  onTick(r, now) {
    if (!r.ep) return;
    if (r.phase === 'wait') { if (now >= r.phaseAt) this.startRound(r, now); return; }
    if (r.phase === 'result') { if (now >= r.phaseAt) this.nextOrEnd(r, now); return; }
    const R = r.round, ep = r.ep;
    // 판에 없는 사람(탈락 · 통과)은 위치를 보내지 않는다
    for (const p of r.players) if (!ep.alive.has(p.id) || p.fin || p.out) p.st = null;
    if (r.phase === 'intro') { if (now >= R.playAt) r.phase = 'play'; else return; }
    const t = (now - R.playAt) / 1000;
    this.simBots(r, R, t);
    R.lastT = t;
    this.checkEnd(r, R, t, now);
  }
  simBots(r, R, t) {
    const L = R.L, st = { tiles: R.tiles, doors: R.doors };
    const live = r.players.filter((p) => r.ep.alive.has(p.id) && !p.fin && !p.out);
    const bots = live.filter((p) => p.bot);
    let tt = R.lastT;
    const ev = [];
    while (tt < t) {
      const dt = Math.min(DT, t - tt); tt += dt;
      for (const b of bots) {
        if (b.fin || b.out) continue;
        const inp = think(b.ai, b.body, L, tt, st, dt);
        ev.length = 0;
        step(b.body, inp, L, tt, dt, st, ev);
        for (const q of live) if (q !== b) { const o = q.bot ? q.body : q.st && { x: q.st[0], y: q.st[1], z: q.st[2] }; if (o) pushApart(b.body, o, q.bot ? 0.5 : 1); }
        for (const e of ev) this.botEvent(r, R, b, e, tt);
        // 다음 생각에서 점프를 또 누르지 않게
        b.ai.inp.jump = false; b.ai.inp.dive = false;
      }
    }
    for (const b of bots) if (!b.fin && !b.out) b.st = this.botSt(b);
  }
  botEvent(r, R, b, e, t) {
    if (e === 'finish') return this.finish(r, R, b, t);
    if (e === 'crown') return this.crown(r, R, b);
    if (e === 'fall') {
      if (R.L.kind === 'race' || R.L.crown) { const c = R.L.cps[b.body.cp] || null; const s = c ? { x: c.x + (Math.random() - 0.5) * c.w * 0.5, y: c.y + 1, z: c.z } : R.L.spawn[Math.floor(Math.random() * 16)]; Object.assign(b.body, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, stun: 0, dive: 0 }); b.ai.wi = 0; }
      else this.out(r, R, b);
      return;
    }
    if (Array.isArray(e)) this.touch(r, R, e[0], e[1], t);
  }
  // 밟은 판 · 터진 문 (사람 · 봇 같이)
  touch(r, R, kind, id, t) {
    if (kind === 'tile') {
      const tl = R.L.tiles[id - 1]; if (!tl || !tl.step || R.tiles.has(id)) return;
      const at = +(t + 0.9).toFixed(2); R.tiles.set(id, at); this.toRoom(r, { t: 'tile', id, at });
    } else if (kind === 'door') {
      const b = R.L.boxes.find((x) => x.door === id); if (!b || !b.real || R.doors.has(id)) return;
      R.doors.add(id); this.toRoom(r, { t: 'door', id });
    }
  }
  finish(r, R, p, t) {
    if (p.fin || p.out || R.over || !(R.L.kind === 'race')) return;
    if (R.done.length >= R.quota) return;
    p.fin = true; R.done.push(p.id);
    this.toRoom(r, { t: 'q', id: p.id, n: R.done.length, time: +t.toFixed(2) });
  }
  crown(r, R, p) {
    if (R.over || p.out || p.fin) return;
    p.fin = true; R.done.push(p.id);
    this.toRoom(r, { t: 'q', id: p.id, n: 1, crown: true });
  }
  out(r, R, p) {
    if (p.out || p.fin || R.over) return;
    p.out = true; R.outs.push(p.id);
    this.toRoom(r, { t: 'out', id: p.id, n: R.outs.length });
  }
  eliminate(r, c, left) {
    const R = r.round;
    if (R && !R.over && !c.out && !c.fin) { c.out = true; R.outs.push(c.id); this.toRoom(r, { t: 'out', id: c.id, n: R.outs.length, left }); }
    if (!R) { r.ep.alive.delete(c.id); r.ep.elimOrder.push([c.id]); }
  }
  onMessage(c, m, r) {
    const R = r.round;
    if (!R || r.phase !== 'play' || !r.ep.alive.has(c.id)) return;
    const t = (Date.now() - R.playAt) / 1000;
    if (m.t !== 'ev') return;
    if (m.k === 'fin' && t > 4) this.finish(r, R, c, t);
    else if (m.k === 'crown' && t > 4 && R.L.crown) this.crown(r, R, c);
    else if (m.k === 'out' && R.L.kind !== 'race' && !R.L.crown) this.out(r, R, c);
    else if (m.k === 'tile' || m.k === 'door') this.touch(r, R, m.k, Number(m.id) | 0, t);
  }

  // ---------- 판 끝 ----------
  checkEnd(r, R, t, now) {
    if (R.over) return;
    const ep = r.ep, live = r.players.filter((p) => ep.alive.has(p.id));
    const still = live.filter((p) => !p.fin && !p.out);
    let end = t >= R.L.time;
    if (R.L.kind === 'race') end ||= R.done.length >= R.quota || !still.length;
    else if (R.L.crown) end ||= R.done.length > 0 || !still.length;
    else if (R.L.kind === 'survive') end ||= R.outs.length >= R.start - R.quota || !still.length;
    else end ||= still.length <= 1;
    // 사람이 아무도 안 달리면(모두 통과 · 탈락) 봇끼리 기다리지 않고 바로 끝낸다 (빠른 진행)
    const early = !end && t > 3 && !still.some((p) => !p.bot) && R.L.kind !== 'final';
    if (!end && !early) return;
    R.over = true;
    const far = (p) => p.body?.z ?? p.st?.[2] ?? 0;
    let pass;
    if (R.L.kind === 'race') pass = [...R.done, ...(early ? still.sort((a, b) => far(b) - far(a)).slice(0, Math.max(0, R.quota - R.done.length)).map((p) => p.id) : [])];
    else if (R.L.crown) pass = R.done.length ? R.done.slice(0, 1) : [still.sort((a, b) => far(b) - far(a))[0]?.id].filter(Boolean);
    else if (R.L.kind === 'survive') pass = still.map((p) => p.id);
    else pass = still.length ? still.map((p) => p.id) : R.outs.slice(-1); // 모두 떨어지면 마지막에 떨어진 곰돌이가 우승
    const passSet = new Set(pass);
    const elim = live.filter((p) => !passSet.has(p.id));
    // 같은 판 탈락끼리: 늦게 떨어지거나 더 멀리 간 곰돌이가 앞 등수
    elim.sort((a, b) => (R.outs.indexOf(b.id) - R.outs.indexOf(a.id)) || far(b) - far(a));
    ep.elimOrder.push(elim.map((p) => p.id));
    for (const p of elim) ep.alive.delete(p.id);
    const final = R.L.kind === 'final';
    if (final) ep.winners = pass;
    r.phase = 'result'; r.phaseAt = now + RESULT;
    this.toRoom(r, { t: 'rend', pass, elim: elim.map((p) => p.id), final });
  }
  nextOrEnd(r, now) {
    const ep = r.ep;
    const humansAlive = r.players.some((p) => !p.bot && ep.alive.has(p.id));
    if (ep.winners || ep.alive.size <= 1 || !humansAlive) return this.finishEpisode(r);
    this.startRound(r, now);
  }
  finishEpisode(r) {
    const ep = r.ep;
    // 등수: 우승 → 남은 곰돌이 → 늦게 떨어진 판일수록 앞
    const order = [...(ep.winners || [...ep.alive])];
    const rest = [...ep.alive].filter((id) => !order.includes(id));
    order.push(...rest);
    for (let i = ep.elimOrder.length - 1; i >= 0; i--) for (const id of ep.elimOrder[i]) if (!order.includes(id)) order.push(id);
    const by = new Map(r.players.map((p) => [p.id, p]));
    const rows = order.map((id, i) => { const p = by.get(id); return p && { id, name: p.name, color: p.color, bot: !!p.bot, place: i + 1, win: (ep.winners || []).includes(id) }; }).filter(Boolean);
    r.ep = null; r.round = null;
    this.end(r, { rows, rounds: ep.ri + 1 });
  }
}
