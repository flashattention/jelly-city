// 젤리라이더 방: 최대 12명 · 트랙 · 스피드전/아이템전 · 개인전/팀전. 모두 들어오면(또는 1등 뒤 25초) 끝
import { BaseRooms } from '../shared/rooms.js';

const TRACK_IDS = ['candy', 'cloud', 'neon', 'lava', 'sakura', 'synth', 'snow', 'deep', 'hairpin', 'choco', 'crystal', 'steam', 'park', 'rainbow', 'moon', 'chess'];
const LV = { candy: 1, sakura: 1, synth: 1, cloud: 2, deep: 2, neon: 2, snow: 3, lava: 3, steam: 3, moon: 3, choco: 4, crystal: 4, hairpin: 4, rainbow: 5, park: 5, chess: 5 };
const ITEM_KINDS = ['trap', 'bomb', 'missile', 'zap'];
const POINTS = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]; // 팀전 순위 점수 (12등까지)

export class RiderRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 12, hz: 15, countdown: 4000, defaults: { track: 'candy', mode: 'speed', team: false } }); }
  allow(cur, n) {
    return {
      track: TRACK_IDS.includes(n.track) || /^rand[1-5]?$/.test(n.track || '') ? n.track : cur.track,
      mode: n.mode === 'item' || n.mode === 'speed' ? n.mode : cur.mode,
      team: typeof n.team === 'boolean' ? n.team : cur.team,
    };
  }
  onStart(r) {
    r.firstDone = 0;
    // 랜덤 트랙: 출발할 때 하나를 정해 모두에게 같은 트랙 (TRACK_IDS 순서 = 화면의 TRACKS 순서, 난이도는 LV)
    const id = r.opts.track, n = Number(String(id).slice(4)) || 0;
    if (/^rand[1-5]?$/.test(id)) { const list = TRACK_IDS.filter((t) => !n || LV[t] === n); return { track: list[Math.floor(Math.random() * list.length)] }; }
    return { track: id };
  }
  onMessage(c, m, r) {
    if (r.state !== 'run') return;
    if (m.t === 'item' && ITEM_KINDS.includes(m.k)) {
      const now = Date.now();
      if (now - (c.lastItem || 0) < 300) return;
      c.lastItem = now;
      const p = Array.isArray(m.p) ? m.p.slice(0, 4).map(Number) : [];
      if (!p.every(Number.isFinite)) return;
      this.toRoom(r, { t: 'item', by: c.id, k: m.k, p, to: Number(m.to) || 0, team: r.opts.team ? c.team : null }, c);
    }
    if (m.t === 'done' && !c.done) {
      const time = Number(m.time);
      if (!Number.isFinite(time) || time < 20 || time > 3600) return;
      c.done = true; c.result = { time };
      if (!r.firstDone) r.firstDone = Date.now();
      this.toRoom(r, { t: 'done', id: c.id, time });
    }
  }
  onTick(r, now) {
    const humans = r.players.filter((p) => !p.bot);
    if (humans.length && (humans.every((p) => p.done) || (r.firstDone && now - r.firstDone > 25000))) this.finishRace(r);
  }
  finishRace(r) {
    const rows = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, team: p.team, time: p.result?.time ?? null, prog: p.st?.[8] ?? 0 }));
    rows.sort((a, b) => (a.time != null) - (b.time != null) ? (a.time != null ? -1 : 1) : a.time != null ? a.time - b.time : b.prog - a.prog);
    const rank = rows.map((e, i) => ({ rank: i + 1, ...e, pts: POINTS[i] || 0 }));
    let team = null;
    if (r.opts.team) {
      const pts = { red: 0, blue: 0 };
      for (const e of rank) if (e.team) pts[e.team] += e.pts;
      team = { red: pts.red, blue: pts.blue, winner: pts.red === pts.blue ? 'draw' : pts.red > pts.blue ? 'red' : 'blue' };
    }
    this.end(r, { rank, team });
  }
}
