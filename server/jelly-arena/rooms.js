// 젤리 아레나 방: 5 대 5 (빈 자리는 젤리봇). 흐름: 방 → 챔피언 고르기(35초) → 경기 → 결과
//   경기 계산은 sim.js 가 다 한다. 여기서는 사람 명령을 넘기고, 팀마다 보이는 모습 · 사건 · 내 상태를 보낸다
import { BaseRooms } from '../shared/rooms.js';
import { Arena } from './sim.js';
import { CHAMPS, champById, ROLE_IDS } from '../../public/jelly-arena/js/data.js';

const PICK_MS = Number(process.env.ARENA_PICK_MS) || 35000, STEP = 0.05, SPEED = Number(process.env.ARENA_SPEED) || 1; // 점검용: 고르기 시간 · 경기 빨리 감기
const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다', '젤리봇 코코', '젤리봇 망고', '젤리봇 체리', '젤리봇 라임'];
export const LEVELS = { easy: 0.3, normal: 0.6, hard: 0.9 };

export class ArenaRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 10, hz: 20, countdown: 0, defaults: { team: true, level: 'normal' } }); }
  allow(cur, n) { return { team: true, level: Object.hasOwn(LEVELS, n.level) ? n.level : cur.level || 'normal' }; }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  teamChat() { return true; }
  handle(c, m) {
    if (m.t === 'practice') {
      // 연습: 혼자 + 젤리봇 9명
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults }, m.opts || {}), practice: true };
      this.rooms.set(r.id, r); r.players.push(c); c.room = r; c.team = 'blue';
      this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), practice: true });
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }
  onStart(r) {
    for (const p of r.players) { p.pick = null; p.role = null; }
    // 사람이 한쪽에 몰려 있어도 5명까지만
    for (const t of ['blue', 'red']) { const l = r.players.filter((p) => p.team === t); for (const p of l.slice(5)) p.team = t === 'blue' ? 'red' : 'blue'; }
    r.g = { phase: 'pick', until: Date.now() + PICK_MS, acc: 0, sendT: 0, sbT: 0, lastT: Date.now() };
    return { pickMs: PICK_MS };
  }
  onMessage(c, m, r) {
    const g = r.g; if (!g) return;
    if (g.phase === 'pick') {
      if (m.t === 'pick' && champById(m.c)) { if (r.players.some((p) => p !== c && p.team === c.team && p.pick === m.c)) return; c.pick = m.c; if (ROLE_IDS.includes(m.role)) c.role = m.role; else c.role ||= champById(m.c).roles[0]; this.pickUpdate(r); }
      if (m.t === 'role' && ROLE_IDS.includes(m.role)) { c.role = m.role; this.pickUpdate(r); }
      if (m.t === 'lock' && c.pick) { c.locked = true; this.pickUpdate(r); if (r.players.every((p) => p.locked)) this.launch(r); }
      return;
    }
    if (g.phase === 'play') g.arena.cmd(c.id, m);
  }
  pickUpdate(r) { this.toRoom(r, { t: 'picks', list: r.players.map((p) => ({ id: p.id, team: p.team, c: p.pick, role: p.role, locked: !!p.locked })) }); }
  // 고르기 끝: 빈 자리는 봇, 안 고른 사람은 알아서
  launch(r) {
    const level = LEVELS[r.opts.level] ?? 0.6, entries = [];
    let botI = 0, nextId = 100000;
    for (const team of ['blue', 'red']) {
      const humans = r.players.filter((p) => p.team === team);
      const taken = new Set(humans.map((p) => p.pick).filter(Boolean)), roles = new Set();
      for (const p of humans) {
        if (!p.pick) { const f = CHAMPS.filter((x) => !taken.has(x.id)); p.pick = f[Math.floor(Math.random() * f.length)].id; taken.add(p.pick); }
        if (!p.role || roles.has(p.role)) p.role = ROLE_IDS.find((x) => !roles.has(x) && champById(p.pick).roles.includes(x)) || ROLE_IDS.find((x) => !roles.has(x));
        roles.add(p.role);
        entries.push({ id: p.id, name: p.name, team, role: p.role, champ: p.pick, bot: false, color: p.color });
      }
      for (const role of ROLE_IDS) {
        if (roles.has(role)) continue;
        const f = CHAMPS.filter((x) => x.roles.includes(role) && !taken.has(x.id)); const pool = f.length ? f : CHAMPS.filter((x) => !taken.has(x.id));
        const ch = pool[Math.floor(Math.random() * pool.length)]; taken.add(ch.id);
        entries.push({ id: nextId++, name: BOT_NAMES[botI++ % BOT_NAMES.length], team, role, champ: ch.id, bot: true, skill: level + (Math.random() - 0.5) * 0.15, color: ch.color });
      }
    }
    const g = r.g; g.phase = 'play'; g.arena = new Arena(entries); g.lastT = Date.now(); g.acc = 0;
    const roster = g.arena.champs.map((c) => ({ id: c.id, pid: c.pid, name: c.name, team: c.team, champ: c.def.id, role: c.role, bot: c.bot, look: r.players.find((p) => p.id === c.pid)?.look || null }));
    this.toRoom(r, { t: 'go', roster });
  }
  onLeave(r, c) { const u = r.g?.arena?.champOf(c.id); if (u) { u.bot = true; u.skill = 0.5; u.name = `${u.name} (봇)`; } if (r.g?.phase === 'pick' && r.players.every((p) => p.locked)) this.launch(r); }
  onTick(r, now) {
    const g = r.g; if (!g) return;
    if (g.phase === 'pick') { if (now >= g.until) this.launch(r); return; }
    if (g.phase !== 'play') return;
    const A = g.arena;
    g.acc += Math.min(0.25, (now - g.lastT) / 1000) * SPEED; g.lastT = now;
    let n = 0; while (g.acc >= STEP && n++ < 6 * SPEED) { A.tick(STEP); g.acc -= STEP; }
    // 사건은 틱마다 바로(반응이 늦지 않게), 모습은 10Hz, 내 상태는 20Hz
    const evB = A.take('blue'), evR = A.take('red'), jB = evB.length ? JSON.stringify({ t: 'e', e: evB }) : null, jR = evR.length ? JSON.stringify({ t: 'e', e: evR }) : null;
    g.sendT++; g.sbT++;
    const full = g.sendT >= 2; if (full) g.sendT = 0;
    const snapB = full ? JSON.stringify({ t: 's', T: +A.t.toFixed(2), u: A.snapshot('blue') }) : null, snapR = full ? JSON.stringify({ t: 's', T: +A.t.toFixed(2), u: A.snapshot('red') }) : null;
    for (const p of r.players) {
      if (p.ws?.readyState !== 1) continue;
      const blue = (A.champOf(p.id)?.team || p.team) === 'blue', ev = blue ? jB : jR;
      if (full) p.ws.send(blue ? snapB : snapR);
      if (ev) p.ws.send(ev);
      p.ws.send(JSON.stringify({ t: 'me', ...A.mine(p.id) }));
    }
    if (g.sbT >= 20) { g.sbT = 0; this.toRoom(r, { t: 'sb', ...A.score() }); }
    if (A.over) {
      const score = A.score(); g.phase = 'over'; r.g = null;
      for (const p of r.players) p.locked = false;
      this.end(r, { winner: A.over.winner, score });
    }
  }
}
