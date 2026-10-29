// 젤리 숨바꼭질 방: 술래 한 명 · 나머지는 몸에 색을 칠해 맵에 숨는다. 판마다 술래가 바뀐다
//   흐름: 준비(역할 보기) → 숨기(술래는 눈 가림) → 찾기(술래가 물감총으로 쏴서 찾기) → 판 결과 → … → 최종 순위
//   서버가 정하는 것: 판 · 시간 · 찾기 판정(거리) · 점수 · 물감 중계(연사 제한). 봇은 서버가 길찾기 · 숨기 · 찾기를 한다
import { BaseRooms } from '../shared/rooms.js';
import { getMap, MAPS, camoScore, specColors, findPath, randomOpen, lineClear, rgb2hex, hex2rgb } from '../../public/jelly-hide/js/maps.js';

const BOT_NAMES = ['젤리봇 딸기', '젤리봇 포도', '젤리봇 레몬', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 소다', '젤리봇 코코'];
const BOT_COLORS = ['#ff6b8b', '#9b6bff', '#ffd84d', '#5fe0b0', '#ffab91', '#6ec6ff', '#c98a5a'];
export const HIDE_TIMES = [45, 60, 90], SEEK_TIMES = [90, 120, 180], ROUNDS = [0, 2, 3, 5];
const READY = 4500, RESULT = 7000, TAG_RANGE = 26, SHOT_V = 30, SHOT_G = 6; // 물감은 30m/s 포물선 · 맞힌 거리는 26m 까지 인정
const FAST = Number(process.env.HIDE_FAST) || 1; // 점검용: 숨기 · 찾기 시간을 줄인다

export class HideRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 10, hz: 12, countdown: 2500, defaults: { map: 'random', rounds: 0, hide: 60, seek: 120, bots: 0, role: 'hide' } }); }
  allow(cur, n) {
    const pick = (list, v, d) => (list.includes(Number(v)) ? Number(v) : d);
    return {
      map: n.map === 'random' || MAPS.some((m) => m.id === n.map) ? n.map : cur.map || 'random',
      rounds: pick(ROUNDS, n.rounds, cur.rounds ?? 0),
      hide: pick(HIDE_TIMES, n.hide, cur.hide || 60),
      seek: pick(SEEK_TIMES, n.seek, cur.seek || 120),
      bots: Number.isFinite(Number(n.bots)) ? Math.max(0, Math.min(7, Math.round(Number(n.bots)))) : cur.bots || 0,
      role: n.role === 'seek' || n.role === 'hide' ? n.role : cur.role || 'hide',
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.practice).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    // 연습: 혼자만의 방 + 젤리봇 → 바로 시작 (내가 숨을지 · 찾을지 고른다)
    if (m.t === 'practice') {
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults }, m.opts || {}), practice: true };
      if (!r.opts.bots) r.opts.bots = 4;
      this.rooms.set(r.id, r);
      r.players.push(c); c.room = r; c.team = null;
      this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), practice: true });
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }

  onStart(r) {
    const humans = r.players.filter((p) => !p.bot).length;
    const nb = Math.min(this.o.max - humans, Math.max(r.opts.bots || 0, Math.max(0, 3 - humans)));
    for (let i = 0; i < nb; i++) r.players.push({ id: this.nextPid++, bot: true, name: BOT_NAMES[i], color: BOT_COLORS[i], look: null, acc: [], team: null, skill: 0.35 + Math.random() * 0.6, st: null });
    for (const p of r.players) { p.score = 0; p.finds = 0; p.survived = 0; p.dom = null; p.paint = null; }
    const ids = r.players.map((p) => p.id), human = r.players.find((p) => !p.bot);
    const n = r.opts.rounds || Math.min(8, ids.length);
    let order;
    if (r.practice && r.opts.role === 'seek') order = Array(n).fill(human.id);
    else if (r.practice) { const bots = ids.filter((id) => id !== human.id).sort(() => Math.random() - 0.5); order = Array.from({ length: n }, (_, i) => bots[i % bots.length]); }
    else { const sh = [...ids].sort(() => Math.random() - 0.5); order = Array.from({ length: n }, (_, i) => sh[i % sh.length]); }
    const maps = MAPS.map((m) => m.id).sort(() => Math.random() - 0.5);
    r.g = { round: 0, rounds: n, order, maps, phase: 'wait', until: r.startAt, found: new Map(), lastT: Date.now() };
    return { rounds: n };
  }

  // ---------- 판 진행 ----------
  setPhase(r, phase, ms, extra = {}) {
    const g = r.g; g.phase = phase; g.until = Date.now() + ms;
    this.toRoom(r, { t: 'ph', phase, ms, round: g.round, rounds: g.rounds, seeker: g.seeker, mapId: g.mapId, found: [...g.found.keys()], scores: r.players.map((p) => [p.id, p.score]), ...extra });
  }
  startRound(r) {
    const g = r.g; g.round++;
    g.seeker = g.order[g.round - 1]; g.mapId = r.opts.map === 'random' ? g.maps[(g.round - 1) % g.maps.length] : r.opts.map;
    g.map = getMap(g.mapId); g.found = new Map(); g.shots = 0; g.pend = [];
    // 출발 자리: 술래는 가운데, 나머지는 둘레에
    const sp = g.map.spawns, spawn = {};
    let k = 1;
    for (const p of r.players) {
      const s = p.id === g.seeker ? sp[0] : sp[k++ % sp.length];
      spawn[p.id] = s;
      p.pos = { x: s[0], y: 0, z: s[1] }; p.yaw = s[2]; p.pose = 0; p.moving = false; p.path = null;
      p.st = [s[0], 0, s[1], s[2], 0];
      if (p.bot) { p.ai = { delay: 0.6 + Math.random() * 4, spot: null, chase: null, think: 0 }; p.dom = null; }
    }
    this.setPhase(r, 'ready', READY, { spawn });
  }
  // 봇이 숨을 자리 고르기 + 몸에 칠하기 (겉면 무늬를 실력만큼 비슷하게)
  botHide(r, b) {
    const g = r.g, taken = r.players.filter((p) => p !== b && p.ai?.spot).map((p) => p.ai.spot);
    const cand = g.map.spots.filter((s) => taken.every((t) => Math.hypot(t.x - s.x, t.z - s.z) > 2.2));
    const spot = cand[Math.floor(Math.random() * cand.length)] || g.map.spots[0];
    b.ai.spot = spot;
    const noise = (1 - b.skill) * 85;
    const jit = (h) => rgb2hex(hex2rgb(h).map((v) => v + (Math.random() - 0.5) * noise));
    const spec = { c: jit(spot.s.c), c2: jit(spot.s.c2 || spot.s.c), p: b.skill > 0.45 ? spot.s.p : 'solid', k: b.skill > 0.45 ? spot.s.k : 0, sc: spot.s.sc };
    b.paint = { spec }; b.dom = specColors(spec);
    this.toRoom(r, { t: 'pt', id: b.id, spec });
    b.path = findPath(g.map, [b.pos.x, b.pos.z], [spot.x, spot.z]) || [[spot.x, spot.z]];
  }
  onTick(r, now) {
    const g = r.g; if (!g) return;
    const dt = Math.min(0.25, (now - g.lastT) / 1000); g.lastT = now;
    if (g.phase === 'wait') { if (now >= g.until) this.startRound(r); return; }
    if (g.phase === 'ready' && now >= g.until) { for (const b of r.players) if (b.bot && b.id !== g.seeker) this.botHide(r, b); this.setPhase(r, 'hide', (r.opts.hide * 1000) / FAST); }
    else if (g.phase === 'hide' && now >= g.until) { g.seekAt = now; this.setPhase(r, 'seek', (r.opts.seek * 1000) / FAST); }
    else if (g.phase === 'seek') { if (g.pend.length) { const due = g.pend.filter((p) => now >= p.at); g.pend = g.pend.filter((p) => now < p.at); for (const p of due) { const by = r.players.find((x) => x.id === p.by); if (by) this.tag(r, by, p.id); } }
      if (now >= g.until || this.hiders(r).every((p) => g.found.has(p.id))) this.endRound(r); }
    else if (g.phase === 'result' && now >= g.until) { if (g.round >= g.rounds) return this.finish(r); this.startRound(r); }
    if (g.phase === 'hide' || g.phase === 'seek') this.tickBots(r, dt, now);
    for (const b of r.players) if (b.bot && b.pos) b.st = [+b.pos.x.toFixed(2), 0, +b.pos.z.toFixed(2), +b.yaw.toFixed(2), b.pose | (b.moving ? 4 : 0)];
  }
  hiders(r) { return r.players.filter((p) => p.id !== r.g.seeker); }
  posOf(p) { return p.bot ? p.pos : p.st ? { x: p.st[0], y: p.st[1], z: p.st[2] } : null; }
  tickBots(r, dt, now) {
    const g = r.g;
    for (const b of r.players) {
      if (!b.bot || g.found.has(b.id)) continue;
      const ai = b.ai;
      if (b.id === g.seeker) { if (g.phase === 'seek') this.botSeek(r, b, dt, now); continue; }
      // 숨는 봇: 잠깐 둘러보다가 자리로 걸어가서 등을 대고 자세를 잡는다
      if ((ai.delay -= dt) > 0) continue;
      b.moving = this.walk(b, dt, g.phase === 'seek' ? 0.9 : 3);
      if (!b.moving && ai.spot && Math.hypot(b.pos.x - ai.spot.x, b.pos.z - ai.spot.z) < 0.4 && !ai.set) { ai.set = true; b.yaw = ai.spot.yaw; b.pose = ai.spot.pose === 2 ? 2 : Math.random() < 0.35 ? 3 : ai.spot.pose; }
    }
  }
  walk(b, dt, speed) {
    const n = b.path?.[0]; if (!n) return false;
    const dx = n[0] - b.pos.x, dz = n[1] - b.pos.z, d = Math.hypot(dx, dz), st = speed * dt;
    if (d <= st) { b.pos.x = n[0]; b.pos.z = n[1]; b.path.shift(); } else { b.pos.x += (dx / d) * st; b.pos.z += (dz / d) * st; }
    if (d > 0.01) b.yaw = Math.atan2(dx, dz);
    return true;
  }
  // 술래 봇: 돌아다니며 둘러보다가, 잘 안 숨은(위장도 낮은 · 움직이는 · 가까운) 젤리를 알아챈다
  botSeek(r, b, dt, now) {
    const g = r.g, ai = b.ai;
    if (ai.chase) {
      const t = r.players.find((p) => p.id === ai.chase), tp = t && this.posOf(t);
      if (!t || g.found.has(t.id) || !tp) { ai.chase = null; b.path = null; }
      else if (Math.hypot(tp.x - b.pos.x, tp.z - b.pos.z) < 8 && lineClear(g.map, [b.pos.x, b.pos.z], [tp.x, tp.z])) {
        // 물감총: 서서 조준해 쏜다 (실력만큼 맞힌다 · 빗나간 물감은 자국으로)
        b.yaw = Math.atan2(tp.x - b.pos.x, tp.z - b.pos.z); b.moving = false;
        if ((ai.gun = (ai.gun || 0) - dt) <= 0) { ai.gun = 0.45 + Math.random() * 0.3; this.botShoot(r, b, t, tp, Math.random() < 0.45 + b.skill * 0.35); }
        return;
      }
      else if (!b.path?.length || (ai.re = (ai.re || 0) - dt) <= 0) { ai.re = 1; b.path = findPath(g.map, [b.pos.x, b.pos.z], [tp.x, tp.z]) || []; }
    }
    if (!b.path?.length) b.path = findPath(g.map, [b.pos.x, b.pos.z], randomOpen(g.map)) || [];
    b.moving = this.walk(b, dt, ai.chase ? 3.6 : 2.8);
    if ((ai.think -= dt) > 0 || ai.chase) return;
    ai.think = 0.35;
    for (const h of this.hiders(r)) {
      if (g.found.has(h.id)) continue;
      const hp = this.posOf(h); if (!hp) continue;
      const d = Math.hypot(hp.x - b.pos.x, hp.z - b.pos.z);
      if (d > 11 || !lineClear(g.map, [b.pos.x, b.pos.z], [hp.x, hp.z])) continue;
      const pose = h.bot ? h.pose : (h.st?.[4] ?? 0) & 3, moving = h.bot ? h.moving : !!((h.st?.[4] ?? 0) & 4);
      const camo = h.dom ? camoScore(h.dom, g.map, hp.x, hp.z, pose) : 5;
      const p = 0.3 * (1 - camo / 100) ** 1.6 * (d < 3 ? 2 : d < 6 ? 1.2 : 0.55) * (moving ? 4 : 1) * (0.6 + b.skill * 0.6);
      if (Math.random() < p) { ai.chase = h.id; b.path = null; return; }
    }
    // 가끔은 수상해 보이는 곳에 그냥 쏴 본다
    if (Math.random() < 0.02) { const a = b.yaw + (Math.random() - 0.5) * 0.8; this.botShoot(r, b, null, { x: b.pos.x + Math.sin(a) * 6, y: 0, z: b.pos.z + Math.cos(a) * 6 }, false); }
  }
  tag(r, by, id) {
    const g = r.g; if (g.phase !== 'seek' || by.id !== g.seeker || g.found.has(id) || id === g.seeker) return false;
    const t = r.players.find((p) => p.id === id); if (!t) return false;
    const a = this.posOf(by), b = this.posOf(t); if (!a || !b || Math.hypot(a.x - b.x, a.z - b.z) > TAG_RANGE) return false;
    const sec = (Date.now() - g.seekAt) / 1000;
    g.found.set(id, sec);
    t.moving = false;
    this.toRoom(r, { t: 'found', id, by: by.id, sec: Math.round(sec), left: this.hiders(r).filter((p) => !g.found.has(p.id)).length });
    return true;
  }
  // 봇 술래의 물감 한 발: 맞힐 거면 젤리 가운데로, 아니면 옆으로 빗겨서. 맞으면 날아가는 시간 뒤에 찾았다
  botShoot(r, b, t, tp, hit) {
    const g = r.g, o = [b.pos.x + Math.sin(b.yaw) * 0.5, (b.pos.y || 0) + 1.0, b.pos.z + Math.cos(b.yaw) * 0.5];
    const err = hit ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.2);
    const px = tp.x + Math.cos(b.yaw) * err, pz = tp.z - Math.sin(b.yaw) * err, py = (tp.y || 0) + 0.55;
    const dx = px - o[0], dz = pz - o[2], dist = Math.hypot(dx, dz) || 1, time = dist / SHOT_V;
    const dy = py - o[1] + 0.5 * SHOT_G * time * time; // 떨어지는 만큼 조금 위로
    const L = Math.hypot(dx, dy, dz) || 1;
    g.shots++;
    this.toRoom(r, { t: 'shot', by: b.id, o: o.map((v) => +v.toFixed(2)), d: [dx / L, dy / L, dz / L].map((v) => +v.toFixed(3)), c: (g.shots % 6) });
    if (hit && t) g.pend.push({ by: b.id, id: t.id, at: Date.now() + time * 1000 });
  }
  endRound(r) {
    const g = r.g, now = Date.now(), seekSec = Math.max(1, (now - g.seekAt) / 1000), seeker = r.players.find((p) => p.id === g.seeker);
    const res = [];
    for (const h of this.hiders(r)) {
      const f = g.found.get(h.id), alive = f == null ? seekSec : f;
      const pts = Math.round(alive / 2) + (f == null ? 40 : 0);
      h.score += pts; if (f == null) h.survived++;
      res.push({ id: h.id, pts, found: f != null, sec: Math.round(alive) });
    }
    if (seeker) {
      const all = this.hiders(r).every((p) => g.found.has(p.id));
      const pts = g.found.size * 35 + (all ? Math.round(Math.max(0, (g.until - now) / 1000) / 2) : 0);
      seeker.score += pts; seeker.finds += g.found.size;
      res.push({ id: seeker.id, pts, seeker: true, finds: g.found.size, all });
    }
    this.setPhase(r, 'result', RESULT, { res, shots: g.shots });
  }
  onMessage(c, m, r) {
    const g = r.g; if (!g || r.state !== 'run') return;
    if (m.t === 'paint' && typeof m.img === 'string' && m.img.startsWith('data:image/jpeg;base64,') && m.img.length < 100000) {
      if (g.phase === 'seek' && c.id !== g.seeker) return; // 찾는 동안엔 다시 칠할 수 없다
      c.paint = { img: m.img }; this.toRoom(r, { t: 'pt', id: c.id, img: m.img }, c);
    } else if (m.t === 'camo' && Array.isArray(m.dom)) {
      c.dom = m.dom.slice(0, 6).map((e) => (Array.isArray(e) ? e.slice(0, 4).map((v) => Math.max(0, Math.min(255, Number(v) || 0))) : [0, 0, 0, 0]));
    } else if (m.t === 'tag') { if (!this.tag(r, c, Number(m.id))) this.send(c, { t: 'far' }); }
    else if (m.t === 'shot' && c.id === g.seeker && g.phase === 'seek' && Array.isArray(m.o) && Array.isArray(m.d)) {
      // 물감 한 발: 연사 제한(0.15초) 뒤 다른 사람에게 그대로 보여 준다 (맞힘은 'tag' 로 따로 · 거리는 서버가 확인)
      const now = Date.now(); if (now - (c.shotAt || 0) < 150) return; c.shotAt = now;
      const o = m.o.slice(0, 3).map(Number), d = m.d.slice(0, 3).map(Number); if (![...o, ...d].every(Number.isFinite)) return;
      g.shots++; this.toRoom(r, { t: 'shot', by: c.id, o, d, c: (Number(m.c) | 0) % 6 }, c);
    }
  }
  onLeave(r, c) {
    const g = r.g; if (!g) return;
    if (!r.players.some((p) => !p.bot)) { r.state = 'wait'; return; }
    if (c.id === g.seeker && (g.phase === 'hide' || g.phase === 'seek' || g.phase === 'ready')) this.endRound(r);
  }
  finish(r) {
    const rank = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, score: p.score, finds: p.finds, survived: p.survived }))
      .sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
    r.g = null;
    if (r.practice) { r.state = 'wait'; this.toRoom(r, { t: 'finish', rank, practice: true }); r.players = r.players.filter((p) => !p.bot); return; }
    this.end(r, { rank });
  }
}
