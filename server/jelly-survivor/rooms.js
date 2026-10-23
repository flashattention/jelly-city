// 젤리 서바이버 방: 최대 6명 협동 · 게임 규칙(sim.js)은 서버가 돌리고 초당 15번 화면에 보낸다
//   화면은 움직이는 방향('in')과 레벨업 고르기('pick')만 보낸다
import { BaseRooms } from '../shared/rooms.js';
import { Sim } from '../../public/jelly-survivor/js/sim.js';

const HZ = 30, SEND = 2; // 1/30초마다 계산 · 두 번에 한 번 보내기 (15번/초)
export class SurvRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 6, hz: HZ, countdown: 3000, defaults: { diff: 'normal', mode: 'stage', stage: 1 } }); }
  allow(cur, n) { return { diff: n.diff === 'hard' || n.diff === 'normal' ? n.diff : cur.diff, mode: n.mode === 'endless' || n.mode === 'stage' ? n.mode : cur.mode || 'stage', stage: Number.isInteger(+n.stage) && +n.stage >= 1 && +n.stage <= 12 ? +n.stage : cur.stage || 1 }; }
  onStart(r) {
    r.sim = new Sim(r.players.map((p) => ({ id: p.id, name: p.name, color: p.color })), { coop: true, hard: r.opts.diff === 'hard', stage: r.opts.stage, endless: r.opts.mode === 'endless' });
    r.simAt = r.startAt; r.frame = 0; r.sentCh = new Map();
    return { diff: r.opts.diff, mode: r.opts.mode, stage: r.opts.stage };
  }
  onMessage(c, m, r) {
    if (r.state !== 'run' || !r.sim) return;
    if (m.t === 'in') { const dx = Number(m.d?.[0]) || 0, dz = Number(m.d?.[1]) || 0; r.sim.input(c.id, Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dz))); }
    if (m.t === 'pick') { if (r.sim.pick(c.id, Number(m.i) || 0)) r.sentCh.delete(c.id); }
  }
  onTick(r, now) {
    if (!r.sim || now < r.startAt) return;
    // 늦어진 만큼 따라잡되 한 번에 너무 많이는 안 한다
    let n = 0;
    while (r.simAt + 1000 / HZ <= now && n++ < 4) { r.simAt += 1000 / HZ; r.sim.step(1 / HZ); }
    if (n >= 4) r.simAt = now;
    // 레벨업: 고를 게 생기면 그 사람에게만 · 12초 안에 안 고르면 대신 골라 준다
    for (const P of r.sim.players.values()) {
      if (P.choices && r.sentCh.get(P.id) !== P.choices) { r.sentCh.set(P.id, P.choices); const c = r.players.find((x) => x.id === P.id); if (c) this.send(c, { t: 'ch', c: P.choices, pending: P.pending }); }
      if (P.choices && P.choiceT > 12) { r.sim.pick(P.id, Math.floor(Math.random() * P.choices.length)); r.sentCh.delete(P.id); }
    }
    if (++r.frame % SEND === 0 || r.sim.over) this.toRoom(r, { t: 's', ...r.sim.snapshot() });
    if (r.sim.over) this.finishSurv(r);
  }
  onLeave(r, c) {
    const P = r.sim?.players.get(c.id);
    if (P && P.st !== 2) { P.st = 2; P.deathT = r.sim.t; }
    if (!r.players.some((p) => p !== c)) { r.state = 'wait'; r.sim = null; }
  }
  finishSurv(r) {
    const sim = r.sim; r.sim = null;
    this.end(r, { rank: sim.result(), win: sim.win, time: Math.round(sim.t) });
  }
}
