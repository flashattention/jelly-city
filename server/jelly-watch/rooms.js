// 젤리워치 방: 최대 12명(6 대 6) + 봇. 영웅 고르기 → 준비 시간 → 점령전(A → B) / 쟁탈전(가운데 거점)
//   맞았는지는 쏜 사람 화면이 알리고, 서버가 거리 · 벽 · 연사 · 쿨타임을 확인해서 피해 · 치유 · 상태 이상 · 궁극기 충전을 정한다
//   봇은 서버가 움직인다 (거점으로 길찾기 → 보이면 영웅 무기로 공격 · 지원가는 아군 치유 · 궁극기도 쓴다)
import { BaseRooms } from '../shared/rooms.js';
import { HEROES, heroById, PROJ, falloff, blockBy, RESPAWN_MS, ULT_PASSIVE, QUICK_MELEE } from '../../public/jelly-watch/js/heroes.js';
import { makeMap, wmapById, WMAPS, openGates, inRoom } from '../../public/jelly-watch/js/watchmaps.js';
import { clearLine, floorAt } from '../../public/jelly-attack/js/maps.js';

const EYE = 1.55;
const SELECT_MS = 25000, SETUP_ASSAULT = 20000, SETUP_CONTROL = 12000;
const ASSAULT_SEC = Number(process.env.WATCH_SEC) || 4 * 60, BONUS_SEC = 120, CONTROL_LIMIT = 8 * 60;
const CAP_SOLO = Number(process.env.WATCH_CAP) || 21, CTRL_CAP = 9, CTRL_WIN = 85; // 점령 시간(초) · 쟁탈전 100% 까지 초
const CAP_MUL = [0, 1, 1.5, 1.85, 2.1, 2.3, 2.45];
const ULT_X = Number(process.env.WATCH_ULTX) || 1; // 점검용: 궁극기 빨리 채우기
const BOT_NAMES = ['젤리봇 딸기', '젤리봇 소다', '젤리봇 푸딩', '젤리봇 망고', '젤리봇 민트', '젤리봇 라임', '젤리봇 자두', '젤리봇 복숭아', '젤리봇 포도', '젤리봇 레몬', '젤리봇 체리', '젤리봇 키위'];
// 영웅마다 쏠 수 있는 투사체
const PKINDS = { rein: ['fire'], dva: ['mini'], zarya: ['egren', 'grav'], pharah: ['rocket', 'conc', 'barrage'], hog: ['hook'], soldier: ['helix'], genji: ['shuri'], cassidy: ['flash'], widow: ['mine'], tracer: ['pulse'], mercy: ['bolt'], ana: ['sleep', 'biotic'], lucio: ['sonic'], moira: [] };
// 상태 이상 → 화면에 보내는 비트
const F = { stun: 1, sleep: 2, invuln: 4, nano: 8, boost: 16, matrix: 32, deflect: 64, grav: 128, anti: 256, hboost: 512, primal: 1024, pilot: 2048, valk: 4096, bub: 8192, reveal: 16384, blossom: 32768, hogult: 65536, blade: 131072, barrage: 262144, deadeye: 524288, coal: 1 << 20, ghost: 1 << 21, spd: 1 << 22, amp: 1 << 23, visor: 1 << 24, breath: 1 << 25, songheal: 1 << 26, poison: 1 << 27, shield: 1 << 28 };
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const d3 = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);
const fwd = (yaw, pitch = 0) => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
const chest = (p) => ({ x: p.pos.x, y: p.pos.y + 1.1, z: p.pos.z });
const eyeOf = (p) => ({ x: p.pos.x, y: p.pos.y + EYE, z: p.pos.z });
const rnd = (a, b) => a + Math.random() * (b - a);

export class WatchRooms extends BaseRooms {
  teamChat() { return true; }
  constructor(userOf) {
    super(userOf, { max: 12, hz: 20, countdown: 1500, defaults: { map: 'jellymura', size: 5 } });
    this.navs = new Map();
  }
  allow(cur, n) {
    return {
      map: WMAPS.some((m) => m.id === n.map) ? n.map : cur.map,
      size: [3, 4, 5, 6].includes(Number(n.size)) ? Number(n.size) : cur.size,
      team: true,
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.private).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    if (m.t === 'practice') return this.practice(c, m);
    return super.handle(c, m);
  }
  // 연습전: 혼자 봇들과 (내 팀 + 상대 팀 모두 봇이 채운다)
  practice(c, m) {
    if (!c.hi) return;
    this.leave(c);
    const r = { id: this.newCode(), name: `${c.name}의 연습전`, players: [], host: c, state: 'wait', startAt: 0, private: true, opts: this.allow({ ...this.o.defaults }, m.opts || {}) };
    this.rooms.set(r.id, r);
    this.join(c, r);
    this.handle(c, { t: 'start' });
  }

  // ---------- 시작: 봇 채우기 → 영웅 고르기 ----------
  onStart(r) {
    const info = wmapById(r.opts.map);
    const map = makeMap(info.id), size = r.opts.size;
    // 사람이 한쪽에 몰리면 나눈다
    for (const t of ['red', 'blue']) while (r.players.filter((p) => p.team === t).length > size) r.players.find((p) => p.team === t).team = t === 'red' ? 'blue' : 'red';
    let bi = 0;
    for (const t of ['red', 'blue']) {
      while (r.players.filter((p) => p.team === t).length < size) {
        const i = bi++;
        r.players.push({ bot: true, id: this.nextPid++, name: BOT_NAMES[i % BOT_NAMES.length], color: '#ffd27a', room: r, st: null, team: t, skill: 0.5 + Math.random() * 0.35 });
      }
    }
    const atk = Math.random() < 0.5 ? 'red' : 'blue';
    const now = Date.now();
    r.g = {
      map, info, mode: info.mode, atk, def: atk === 'red' ? 'blue' : 'red', phase: 'select', until: now + this.o.countdown + (r.private ? SELECT_MS - 5000 : SELECT_MS),
      ents: [], eid: 1, pi: 0, prog: 0, lastAtk: 0, endAt: 0, ot: false, otFuse: 0, owner: null, cap: { team: null, v: 0 }, pct: { red: 0, blue: 0 },
      infra: { red: 0, blue: 0 }, psT: 0, winner: null, overAt: 0, start: now,
    };
    for (const p of r.players) {
      Object.assign(p, { hero: null, ready: false, alive: false, hp: 0, k: 0, fb: 0, d: 0, dmg: 0, heal: 0, obj: 0, ult: 0, fx: {}, cd: {}, last: {}, tok: {}, beamAt: {}, dmgBy: new Map(), pilot: false, over: 0, prim: 0, bub: 0, energy: 0, shp: 1200, mtx: 3, res: 100, blinks: 3, song: 'heal', hist: [] });
      p.pos = { x: 0, y: 0, z: 0 }; p.yaw = 0; p.pitch = 0;
    }
    // 봇은 천천히 하나씩 고른다 (역할이 비는 자리부터)
    r.players.filter((p) => p.bot).forEach((b, i) => setTimeout(() => { if (r.g?.phase === 'select' && !b.hero) this.botPick(r, b); }, 2500 + i * 900 + Math.random() * 1500));
    return { map: map.id, mode: info.mode, atk, size, until: r.g.until - now };
  }
  comp(size) { return size >= 6 ? { tank: 2, dps: 2, sup: 2 } : size === 5 ? { tank: 1, dps: 2, sup: 2 } : size === 4 ? { tank: 1, dps: 2, sup: 1 } : { tank: 1, dps: 1, sup: 1 }; }
  botPick(r, b) {
    const mates = r.players.filter((p) => p.team === b.team && p.hero), need = this.comp(r.opts.size);
    const have = { tank: 0, dps: 0, sup: 0 }; for (const p of mates) have[heroById(p.hero).role]++;
    const role = ['tank', 'sup', 'dps'].find((ro) => have[ro] < need[ro]) || ['tank', 'dps', 'sup'][Math.floor(Math.random() * 3)];
    const free = HEROES.filter((h) => h.role === role && !mates.some((p) => p.hero === h.id));
    const h = (free.length ? free : HEROES.filter((x) => !mates.some((p) => p.hero === x.id)))[Math.floor(Math.random() * free.length || 0)] || HEROES[0];
    this.setHero(r, b, h.id);
  }
  setHero(r, p, id) {
    const h = heroById(id);
    p.hero = h.id; p.pilot = false; p.ult = 0; p.cd = {}; p.fx = {}; p.over = 0; p.prim = 0; p.bub = 0; p.energy = 0; p.shp = 1200; p.mtx = 3; p.res = 100; p.blinks = 3;
    this.toRoom(r, { t: 'pick', id: p.id, h: h.id });
  }
  maxHp(p) { const h = heroById(p.hero); return p.pilot ? h.pilot.hp : h.hp; }

  // ---------- 단계 ----------
  toSetup(r, now) {
    const g = r.g;
    for (const p of r.players) if (!p.hero) { if (p.bot) this.botPick(r, p); else { const mates = r.players.filter((q) => q.team === p.team && q.hero); const free = HEROES.filter((h) => !mates.some((q) => q.hero === h.id)); this.setHero(r, p, free[Math.floor(Math.random() * free.length)].id); } }
    g.phase = 'setup'; g.until = now + (g.mode === 'assault' ? (r.private ? 12000 : SETUP_ASSAULT) : SETUP_CONTROL);
    for (const p of r.players) this.spawn(r, p, now);
    this.toRoom(r, { t: 'phase', ph: 'setup', ms: g.until - now, atk: g.atk });
  }
  toPlay(r, now) {
    const g = r.g;
    g.phase = 'play'; openGates(g.map);
    g.endAt = now + (g.mode === 'assault' ? ASSAULT_SEC : CONTROL_LIMIT) * 1000;
    this.toRoom(r, { t: 'phase', ph: 'play', ms: g.endAt - now });
  }
  finishWatch(r, winner, why) {
    const g = r.g; if (!g || g.phase === 'over') return;
    g.phase = 'over'; g.winner = winner; g.overAt = Date.now();
    const stats = r.players.map((p) => ({ id: p.id, name: p.name, team: p.team, hero: p.hero, k: p.k, fb: p.fb, d: p.d, dmg: Math.round(p.dmg), heal: Math.round(p.heal), obj: Math.round(p.obj), bot: !!p.bot }));
    const score = (s) => s.k * 400 + s.fb * 150 + s.dmg + s.heal * 1.1 + s.obj * 25 - s.d * 250 + (s.team === winner ? 600 : 0);
    const mvp = [...stats].sort((a, b) => score(b) - score(a))[0];
    g.result = { winner, why, stats, mvp: mvp?.id, map: g.info.id, mode: g.mode, atk: g.atk, pct: g.pct };
    this.toRoom(r, { t: 'phase', ph: 'over', winner, why, mvp: mvp?.id, stats });
    setTimeout(() => { if (r.g === g && r.state === 'run') { r.g = null; this.end(r, g.result); } }, 11000);
  }
  onLeave(r) {
    const g = r.g; if (!g) return;
    if (!r.players.some((p) => !p.bot)) r.g = null;
  }

  // ---------- 부활 ----------
  spawnPts(r, team) {
    const g = r.g, sp = g.map.spawns;
    if (g.mode === 'assault') return team === g.atk ? (g.pi >= 1 ? sp.atk2 : sp.atk) : (g.pi === 0 && sp.def1 ? sp.def1 : sp.def);
    return sp[team];
  }
  roomOf(r, team) {
    const g = r.g, rm = g.map.rooms;
    if (g.mode === 'assault') return team === g.atk ? (g.pi >= 1 ? rm.atk2 : rm.atk) : (g.pi === 0 && rm.def1 ? rm.def1 : rm.def);
    return rm[team];
  }
  objPt(r) { const g = r.g; return g.map.points[Math.min(g.pi, g.map.points.length - 1)]; }
  spawn(r, p, now, at) {
    const pts = this.spawnPts(r, p.team), s = at || pts[Math.floor(Math.random() * pts.length)];
    const x = s[0] + (at ? 0 : rnd(-0.8, 0.8)), z = s[1] + (at ? 0 : rnd(-0.8, 0.8)), y = at ? s[2] : floorAt(r.g.map, x, z, 0.6); // 1층 바닥에 (2층 집 안에서 태어나도)
    const o = this.objPt(r), yaw = Math.atan2(-(o.x - x), -(o.z - z));
    Object.assign(p, { alive: true, hp: this.maxHp(p), over: 0, prim: 0, bub: 0, fx: {}, respawnAt: 0, shieldOn: false, mtxOn: false, hist: [] });
    if (p.hero === 'dva' && p.pilot) { p.pilot = false; p.hp = this.maxHp(p); }
    p.pos = { x, y, z }; p.yaw = yaw; p.pitch = 0; p.st = [x, y, z, yaw, 0, 0];
    p.dmgBy = new Map(); p.lastHurt = 0;
    if (p.bot) Object.assign(p, { path: null, target: null, react: 0, fireT: 0, mag: heroById(p.hero).p.mag || 0, reloadT: 0, burst: 0, abilT: now + rnd(3000, 7000), vy: 0 });
    this.toRoom(r, { t: 'spawn', id: p.id, h: p.hero, p: [x, y, z, yaw] });
  }

  // ---------- 메시지 ----------
  onMessage(c, m, r) {
    const g = r.g; if (!g || r.state !== 'run') return;
    const now = Date.now();
    if (m.t === 'pick') {
      const h = HEROES.find((x) => x.id === m.h); if (!h) return;
      if (r.players.some((p) => p !== c && p.team === c.team && p.hero === h.id)) return this.send(c, { t: 'toast', text: '이미 우리 팀이 고른 영웅이에요' });
      if (g.phase === 'select') return this.setHero(r, c, h.id);
      if (g.phase === 'over') return;
      // 경기 중: 죽어 있거나 출발 방 안에서만 바꿀 수 있다
      if (c.alive && !inRoom(this.roomOf(r, c.team), c.pos.x, c.pos.z)) return this.send(c, { t: 'toast', text: '영웅은 출발 방에서만 바꿀 수 있어요 (죽었을 때도 돼요)' });
      this.setHero(r, c, h.id);
      if (c.alive) this.spawn(r, c, now, [c.pos.x, c.pos.z, c.pos.y]);
      return;
    }
    if (m.t === 'ready') { if (g.phase === 'select' && c.hero) { c.ready = true; if (r.players.every((p) => p.bot || p.ready)) g.until = Math.min(g.until, now + 1500); } return; }
    if (g.phase !== 'setup' && g.phase !== 'play') return;
    if (!c.alive || !c.hero || !c.st) return;
    const h = heroById(c.hero);
    if (c.fx.stun > now || c.fx.sleep > now) return;
    switch (m.t) {
      case 'hit': return this.onHit(r, c, h, m, now);
      case 'hb': return this.onBarrierHit(r, c, h, m, now);
      case 'proj': return this.onProj(r, c, h, m, now);
      case 'pboom': return this.onBoom(r, c, h, m, now);
      case 'beam': return this.onBeam(r, c, h, m, now);
      case 'abil': return this.onAbil(r, c, h, m, now);
      case 'stick': return this.onStick(r, c, m, now);
      case 'fire': {
        // 즉발 사격 궤적 (보기만): 다른 사람 화면에 총알 줄
        if (now - (c.last.fireFx || 0) < 45 || !Array.isArray(m.o) || !Array.isArray(m.to)) return; c.last.fireFx = now;
        const o = m.o.slice(0, 3).map(Number), to = m.to.slice(0, 3).map(Number); if (![...o, ...to].every(Number.isFinite)) return;
        return this.toRoom(r, { t: 'fire', by: c.id, o, to: { x: to[0], y: to[1], z: to[2] }, heal: !!m.heal }, c);
      }
    }
  }
  // 이 공격의 정보 (a: p 기본 · s 우클릭 · m 근접 · dash · blade · punch)
  atkSpec(c, h, a) {
    if (a === 'm') return { ...QUICK_MELEE, type: 'melee' };
    if (a === 'dash') return { type: 'melee', dmg: 50, range: 18, rate: 0.05 };
    if (a === 'blade') return { type: 'melee', dmg: 110, range: 6, rate: 0.75 };
    if (a === 'punch') return { type: 'melee', dmg: 40, range: 5.5, rate: 0.55, kb: 11 };
    if (a === 's') return h.s;
    return c.pilot ? h.pilot.p : h.p;
  }
  canSee(r, a, t) { return [1.5, 1.0, 0.4].some((y) => clearLine(r.g.map, a, { x: t.pos.x, y: t.pos.y + y, z: t.pos.z })); }
  onHit(r, c, h, m, now) {
    if (m.a === 'dead') return this.deadeyeShot(r, c, m, now);
    const t = r.players.find((p) => p.id === +m.to);
    if (!t || !t.alive || t === c) return;
    const ally = t.team === c.team;
    const spec = this.atkSpec(c, h, m.a);
    if (!spec || (spec.type !== 'hit' && spec.type !== 'melee' && spec.type !== 'fan')) return;
    if (ally && !(spec.ally && spec.heal)) return;
    if (m.a === 'blade' && !(c.fx.blade > now)) return;
    if (m.a === 'punch' && !(c.fx.primal > now)) return;
    if (m.a === 'dash' && now - (c.dashAt || 0) > 900) return;
    // 같은 사격의 산탄은 한 번에 (n) · 한 번 휘두르기 · 쏘기에 여러 명 (대상마다 연사 확인) · 질풍참은 대상마다 한 번
    const key = `${m.a}:${t.id}`;
    const scoped = spec.scoped && m.charge != null;
    const rate = scoped ? spec.scoped.rate : spec.rate;
    if (m.a === 'dash') { if (c.last[key] > c.dashAt) return; } else if (now - (c.last[key] || 0) < rate * 1000 * 0.6) return;
    c.last[key] = now;
    const a = eyeOf(c), d = d3(a, chest(t));
    if (spec.type === 'melee' ? d > spec.range + 2.5 : d > 160) return;
    if (!this.canSee(r, a, t)) return;
    if (blockBy(r.g.ents, a, chest(t), c.team)) return;
    const n = Math.max(1, Math.min(spec.pellets || 1, Number(m.n) || 1));
    const head = m.part === 'head' && spec.type !== 'melee';
    if (ally) return this.heal(r, t, spec.heal * n, c, now);
    let dmg;
    // 조준경 충전은 서버도 센다: 지난 저격 뒤로 지난 시간보다 더 모일 수 없다
    if (scoped) { const k = Math.max(0, Math.min(1, +m.charge || 0, (now - (c.snipeAt || 0)) / (spec.scoped.charge * 1000))); c.snipeAt = now; dmg = (spec.scoped.min + (spec.scoped.max - spec.scoped.min) * k) * (head ? spec.scoped.head : 1); }
    else dmg = spec.dmg * n * (head ? spec.head || 2 : 1) * falloff(spec, d);
    this.damage(r, t, dmg, c, now, { a: m.a === 'p' ? 'p' : m.a, head, steal: spec.steal, melee: spec.type === 'melee', kb: spec.kb });
  }
  onBarrierHit(r, c, h, m, now) {
    const e = r.g.ents.find((x) => x.id === +m.e); if (!e || e.team === c.team || !e.hp) return;
    const spec = this.atkSpec(c, h, m.a); if (!spec || spec.type === 'beam') return;
    const key = `hb${m.a}`; if (now - (c.last[key] || 0) < (spec.rate || 0.1) * 1000 * 0.6) return; c.last[key] = now;
    const n = Math.max(1, Math.min(spec.pellets || 1, Number(m.n) || 1));
    this.hurtEnt(r, e, (spec.dmg || 30) * n * (spec.scoped && m.charge != null ? 4 : 1), c);
  }
  hurtEnt(r, e, dmg, by) {
    e.hp -= dmg; if (by) this.charge(by, dmg * 0.5);
    if (e.hp <= 0) {
      if (e.k === 'shield') { const o = e.owner; o.shieldOn = false; o.shp = 0; o.shieldBroke = Date.now(); }
      this.removeEnt(r, e, true);
    }
  }
  removeEnt(r, e, broke) { r.g.ents = r.g.ents.filter((x) => x !== e); if (broke) this.toRoom(r, { t: 'fx', k: 'break', e: e.id, ek: e.k, p: [e.x, e.y, e.z] }); }
  // 투사체 쏨: 기본 공격은 연사, 기술은 쿨타임에서 이미 확인했다 (tok)
  onProj(r, c, h, m, now) {
    const k = String(m.k || ''); if (!PROJ[k] || !PKINDS[c.hero]?.includes(k)) return;
    if (!Array.isArray(m.o) || !Array.isArray(m.v)) return;
    const prim = (h.p.type === 'proj' && h.p.k === k) || (h.p.alt?.k === k) || (h.s?.type === 'proj' && h.s.k === k && !h.s.cd);
    if (prim) {
      // 한 번 쏠 때 여러 발(점사 · 부채)은 i 로 센다: 첫 발만 연사 확인
      const spec = h.p.k === k ? h.p : h.p.alt?.k === k ? h.p.alt : h.s, vol = spec.fan || spec.burst || 1, lk = `pj${k}`;
      c.vol = c.vol || {};
      if (!m.i) { if (now - (c.last[lk] || 0) < spec.rate * 600) return; c.last[lk] = now; c.vol[k] = 1; }
      else { if (now - (c.last[lk] || 0) > 800 || (c.vol[k] || 0) >= vol) return; c.vol[k]++; }
      c.tok[k] = Math.min(10, (c.tok[k] || 0) + 1);
    } else if (!(c.tok[k] > 0)) return;
    c.tokOut = c.tokOut || {}; c.tokOut[k] = (c.tokOut[k] || 0) + 1;
    this.toRoom(r, { t: 'proj', by: c.id, k, o: m.o.slice(0, 3).map(Number), v: m.v.slice(0, 3).map(Number), id: m.id | 0 }, c);
  }
  onBoom(r, c, h, m, now) {
    const k = String(m.k || ''), P = PROJ[k]; if (!P || !PKINDS[c.hero]?.includes(k)) return;
    // 꿰뚫는 화염 강타는 한 번에 여러 명 (최대 6)
    if (k === 'fire') { if (now - (c.fireAt || 0) > 2500 || (c.fireHits = (c.fireHits || 0) + 1) > 7) return; }
    else { if (!(c.tok[k] > 0)) return; c.tok[k]--; }
    if (!Array.isArray(m.p)) return;
    const p = { x: +m.p[0], y: +m.p[1], z: +m.p[2] }; if (![p.x, p.y, p.z].every(Number.isFinite)) return;
    if (d3(p, c.pos) > P.speed * (P.life || 2) + 8) return;
    this.toRoom(r, { t: 'boom', k, p: [p.x, p.y, p.z], by: c.id });
    this.explode(r, c, k, p, m.to != null ? r.players.find((q) => q.id === +m.to) : null, m.e != null ? r.g.ents.find((e) => e.id === +m.e) : null, now, m.part === 'head');
  }
  // 투사체가 터졌다: 직격 · 폭발 · 특수 효과 (서버 봇도 같이 쓴다)
  explode(r, c, k, p, direct, ent, now, head) {
    const P = PROJ[k], g = r.g;
    if (ent && ent.team !== c.team && ent.hp) this.hurtEnt(r, ent, (P.dmg || 0) + (P.splash || 0), c);
    if (direct && direct.alive && direct.team !== c.team && !ent) {
      if (P.dmg) this.damage(r, direct, P.dmg * (head && P.head ? P.head : 1), c, now, { a: k, head: head && !!P.head, src: p });
      if (P.sleep && direct.alive && !(direct.fx.invuln > now)) { direct.fx.sleep = now + P.sleep * 1000; this.cc(r, direct, 'sleep', P.sleep * 1000); }
      if (P.chain && direct.alive) {
        // 갈고리: 내 앞으로 끌어온다
        const f = fwd(c.yaw), to = { x: c.pos.x + f.x * 2.6, y: c.pos.y, z: c.pos.z + f.z * 2.6 };
        const safe = clearLine(g.map, { x: c.pos.x, y: c.pos.y + 1, z: c.pos.z }, { ...to, y: to.y + 1 }) ? to : { ...c.pos };
        direct.fx.stun = Math.max(direct.fx.stun || 0, now + 400); this.pullTo(r, direct, safe);
        this.toRoom(r, { t: 'fx', k: 'hooked', by: c.id, to: direct.id });
      }
    }
    if (P.r) {
      for (const t of r.players) {
        if (!t.alive) continue;
        const q = chest(t), dist = d3(p, q);
        if (dist > P.r + 0.5) continue;
        if (!clearLine(g.map, p, q) || (t.team !== c.team && blockBy(g.ents, p, q, c.team))) continue;
        const k1 = Math.max(0.3, 1 - dist / (P.r + 0.5) * 0.7);
        if (t.team !== c.team || t === c) {
          if (t === c && !P.self && !P.selfKb) continue;
          if (t !== c && P.friendly && P.heal == null) continue;
          if (P.splash && t !== direct) this.damage(r, t, P.splash * k1 * (t === c ? P.self || 0 : 1), c, now, { a: k, src: p });
          if (P.stun && t !== c) { t.fx.stun = now + P.stun * 1000; this.cc(r, t, 'stun', P.stun * 1000); }
          if (P.anti && t !== c) t.fx.anti = now + P.anti * 1000;
          if (P.kb && (t !== c || P.selfKb)) { const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1; this.knock(r, t, [dx / L * P.kb * k1, (t === c ? 0.75 : 0.45) * P.kb * k1 + 2, dz / L * P.kb * k1]); }
        } else if (P.heal) { this.heal(r, t, P.heal, c, now); if (P.healBoost) t.fx.hboost = now + P.healBoost * 1000; }
      }
      if (P.heal && d3(p, chest(c)) <= P.r + 0.5) { this.heal(r, c, P.heal, c, now); if (P.healBoost) c.fx.hboost = now + P.healBoost * 1000; }
    }
    if (P.make === 'grav') this.addEnt(r, { k: 'grav', team: c.team, owner: c, x: p.x, y: p.y, z: p.z, until: now + 4000, r: 6.5 });
    if (P.make === 'mine') { for (const e of g.ents.filter((e) => e.k === 'mine' && e.owner === c)) this.removeEnt(r, e); this.addEnt(r, { k: 'mine', team: c.team, owner: c, x: p.x, y: p.y, z: p.z, until: now + 90000 }); }
  }
  // 펄스 폭탄: 붙은 곳(사람이면 따라다님) → 1초 뒤 펑
  onStick(r, c, m, now) {
    if (c.hero !== 'tracer' || !(c.tok.pulse > 0)) return; c.tok.pulse--;
    const t = m.to != null ? r.players.find((p) => p.id === +m.to && p.team !== c.team && p.alive) : null;
    const p = Array.isArray(m.p) ? { x: +m.p[0], y: +m.p[1], z: +m.p[2] } : null;
    if (!t && (!p || ![p.x, p.y, p.z].every(Number.isFinite))) return;
    this.addEnt(r, { k: 'pulse', team: c.team, owner: c, on: t, x: t ? t.pos.x : p.x, y: t ? t.pos.y + 1.1 : p.y, z: t ? t.pos.z : p.z, until: now + 1000, boom: 'pulsebomb' });
  }
  onBeam(r, c, h, m, now) {
    const key = m.k === 's' ? 's' : m.k === 'q' ? 'q' : 'p';
    const dt = Math.min(0.25, (now - (c.beamAt[key] || 0)) / 1000); c.beamAt[key] = now;
    if (dt <= 0.02) return;
    const spec = key === 's' ? h.s : c.pilot ? null : h.p;
    if (!spec || (spec.type !== 'beam' && spec.type !== 'spray')) return;
    const ids = (Array.isArray(m.to) ? m.to : [m.to]).slice(0, spec.chain || (c.fx.valk > now || spec.type === 'spray' ? 6 : 1)).map(Number);
    const a = eyeOf(c);
    if (spec.type === 'spray') {
      if (c.res <= 0) return; c.res = Math.max(0, c.res - 13 * dt); c.sprayAt = now;
    }
    c.beamTo = ids[0] || 0; c.beamToAt = now;
    for (const id of ids) {
      const t = r.players.find((p) => p.id === id); if (!t || !t.alive) continue;
      const range = (spec.range || 10) + (c.fx.valk > now ? 15 : 0) + 3;
      if (d3(a, chest(t)) > range || !this.canSee(r, a, t)) continue;
      const ally = t.team === c.team;
      if (spec.lock === 'ally' || spec.type === 'spray') {
        if (!ally || t === c) continue;
        if (spec.boost) { t.fx.boost = now + 350; t.boostBy = c; continue; }
        this.heal(r, t, (spec.hps || 0) * dt, c, now);
      } else {
        if (ally) continue;
        if (blockBy(r.g.ents, a, chest(t), c.team)) continue;
        let dmg = (spec.dps || 0) * dt;
        if (spec.energy) dmg *= 1 + c.energy / 140; // 에너지 100 이면 1.7배
        this.damage(r, t, dmg, c, now, { a: key === 's' ? 's' : 'p', beam: true });
        if (spec.selfHeal) this.heal(r, c, spec.selfHeal * dt, c, now);
      }
    }
  }
  // 쿨타임 확인: 아직이면 화면에 알려 맞춘다
  useCd(r, c, slot, cd, now) {
    if (now < (c.cd[slot] || 0) - 200) { this.send(c, { t: 'cd', s: slot, ms: c.cd[slot] - now }); return false; }
    c.cd[slot] = now + cd * 1000; return true;
  }
  onAbil(r, c, h, m, now) {
    const s = m.s, g = r.g;
    // 누르고 있는 기술 (방패 · 매트릭스)
    if (s === 's' && h.s?.type === 'hold') {
      if (c.hero === 'rein') { c.shieldOn = !!m.on && c.shp > 50 && now - (c.shieldBroke || 0) > 5000; this.syncShield(r, c); }
      if (c.hero === 'dva' && !c.pilot) c.mtxOn = !!m.on && c.mtx > 0.2;
      return;
    }
    if (s === 'pin') { // 젤리하르트 돌진에 부딪힌 적
      const t = r.players.find((p) => p.id === +m.to); if (c.hero !== 'rein' || !t || t.team === c.team || now - (c.chargeAt || 0) > 3200 || c.pinned) return;
      if (d2(t.pos, c.pos) > 4.5) return; c.pinned = true;
      this.damage(r, t, 200, c, now, { a: 'shift', melee: true }); const f = fwd(c.yaw); this.knock(r, t, [f.x * 14, 5, f.z * 14]);
      return;
    }
    if (s === 'bump') { // 디젤바 부스터에 부딪힘
      const t = r.players.find((p) => p.id === +m.to); if (c.hero !== 'dva' || !t || t.team === c.team || now - (c.boostAt || 0) > 2500) return;
      if (d2(t.pos, c.pos) > 4 || now - (t.bumpedAt || 0) < 800) return; t.bumpedAt = now;
      this.damage(r, t, 25, c, now, { a: 'shift', melee: true }); const f = fwd(c.yaw); this.knock(r, t, [f.x * 10, 4, f.z * 10]);
      return;
    }
    if (s === 'land') { // 젤리스턴 점프팩 착지 · 원시의 분노 착지
      if (c.hero !== 'winston' || now - (c.leapAt || 0) > 3500 || c.landed) return; c.landed = true;
      this.toRoom(r, { t: 'fx', k: 'land', by: c.id, p: [c.pos.x, c.pos.y, c.pos.z] });
      for (const t of r.players) if (t.alive && t.team !== c.team && d3(t.pos, c.pos) < 4.5 && this.canSee(r, eyeOf(c), t)) this.damage(r, t, 50, c, now, { a: 'shift', melee: true });
      return;
    }
    if (s === 'blink') { // 트레이젤리 점멸 (충전 3번)
      if (c.hero !== 'tracer' || c.blinks < 1) return; c.blinks--; c.blinkT = c.blinkT || now; return;
    }
    const slot = s === 'q' ? 'q' : s === 'shift' ? 'shift' : s === 'e' ? 'e' : s === 's' ? 's' : null; if (!slot) return;
    // 궁극기
    if (slot === 'q') {
      const pilotCall = c.hero === 'dva' && c.pilot;
      if (c.ult < h.ult - 1) return;
      if (!this.ultEffect(r, c, h, m, now)) return;
      c.ult = 0;
      this.toRoom(r, { t: 'fx', k: 'ult', by: c.id, h: c.hero, pilot: pilotCall, team: c.team, p: [c.pos.x, c.pos.y, c.pos.z], yaw: c.yaw });
      return;
    }
    const spec = slot === 's' ? h.s : h[slot]; if (!spec) return;
    let cd = spec.cd ?? 0;
    if (c.hero === 'winston' && slot === 'shift' && c.fx.primal > now) cd = 1.5;
    if (c.hero === 'mercy' && c.fx.valk > now) cd = Math.min(cd, slot === 'e' ? 30 : 1);
    if (c.hero === 'lucio' && slot === 'shift') { if (!this.useCd(r, c, slot, 0.5, now)) return; c.song = c.song === 'heal' ? 'speed' : 'heal'; return; }
    if (c.hero === 'soldier' && slot === 'shift') return; // 질주는 화면에서만
    if (c.hero === 'mercy' && slot === 'e') { if (!this.rez(r, c, now)) { this.send(c, { t: 'cd', s: 'e', ms: 0 }); this.send(c, { t: 'toast', text: '✝️ 가까이 쓰러진 아군이 없어요' }); return; } }
    if (!(c.hero === 'mercy' && slot === 'e') && !this.useCd(r, c, slot, cd, now)) return;
    if (c.hero === 'mercy' && slot === 'e') c.cd.e = now + cd * 1000;
    this.abilEffect(r, c, h, slot, m, now);
    this.toRoom(r, { t: 'fx', k: 'abil', by: c.id, h: c.hero, s: slot, p: [c.pos.x, c.pos.y, c.pos.z], yaw: c.yaw, to: m.to ?? null, dst: Array.isArray(m.p) ? m.p.slice(0, 3).map(Number) : null }, c);
  }
  abilEffect(r, c, h, slot, m, now) {
    const id = c.hero;
    const tok = (k, n = 1) => { c.tok[k] = Math.min(40, (c.tok[k] || 0) + n); };
    if (id === 'rein') { if (slot === 'shift') { c.chargeAt = now; c.pinned = false; c.fx.charge = now + 2600; } if (slot === 'e') { c.fireAt = now; c.fireHits = 0; tok('fire'); } }
    if (id === 'winston') { if (slot === 'shift') { c.leapAt = now; c.landed = false; } if (slot === 'e') this.addEnt(r, { k: 'dome', team: c.team, owner: c, x: c.pos.x, y: c.pos.y, z: c.pos.z, hp: 700, max: 700, until: now + 8000 }); }
    if (id === 'dva') { if (slot === 'shift') c.boostAt = now; if (slot === 'e' && !c.pilot) tok('mini', 18); }
    if (id === 'hog') { if (slot === 'shift') tok('hook'); if (slot === 'e') { c.fx.breath = now + 1800; c.hot = { until: now + 1800, rate: 300 / 1.8 }; } }
    if (id === 'zarya') {
      if (slot === 'shift') this.bubble(c, c, now);
      if (slot === 'e') { const t = r.players.find((p) => p.id === +m.to && p.team === c.team && p.alive); this.bubble(t && d3(t.pos, c.pos) < 32 ? t : c, c, now); }
    }
    if (id === 'pharah') { if (slot === 'e') tok('conc'); }
    if (id === 'reaper') { if (slot === 'shift') { c.fx.invuln = now + 3000; c.fx.ghost = now + 3000; } }
    if (id === 'cassidy') { if (slot === 'e') tok('flash'); }
    if (id === 'soldier') { if (slot === 's') tok('helix'); if (slot === 'e') this.addEnt(r, { k: 'field', team: c.team, owner: c, x: c.pos.x, y: c.pos.y, z: c.pos.z, until: now + 5000, r: 5 }); }
    if (id === 'genji') { if (slot === 'shift') c.dashAt = now; if (slot === 'e') c.fx.deflect = now + 2000; }
    if (id === 'widow') { if (slot === 'e') tok('mine'); }
    if (id === 'tracer') { if (slot === 'e') { const old = c.hist.find((x) => now - x.t >= 2800) || c.hist[0]; if (old) c.hp = Math.max(c.hp, Math.min(this.maxHp(c), old.hp)); c.fx.ghost = now + 1000; c.fx.invuln = now + 1000; } }
    if (id === 'ana') { if (slot === 'shift') tok('sleep'); if (slot === 'e') tok('biotic'); }
    if (id === 'lucio') {
      if (slot === 'e') c.fx.amp = now + 3000;
      if (slot === 's') { const f = fwd(c.yaw); for (const t of r.players) { if (!t.alive || t.team === c.team) continue; const dx = t.pos.x - c.pos.x, dz = t.pos.z - c.pos.z, L = Math.hypot(dx, dz); if (L > 9 || (dx * f.x + dz * f.z) / (L || 1) < 0.55 || !this.canSee(r, eyeOf(c), t)) continue; this.damage(r, t, 25, c, now, { a: 's' }); this.knock(r, t, [f.x * 14, 4, f.z * 14]); } }
    }
    if (id === 'moira') {
      if (slot === 'shift') { c.fx.invuln = now + 800; c.fx.ghost = now + 800; }
      if (slot === 'e') { const f = fwd(c.yaw); this.addEnt(r, { k: 'orb', team: c.team, owner: c, x: c.pos.x + f.x, y: c.pos.y + 1.3, z: c.pos.z + f.z, vx: f.x * 8.5, vz: f.z * 8.5, until: now + 7000, r: 4.2 }); }
    }
    if (id === 'mercy') { /* 수호천사 · 부활은 화면 / rez */ }
  }
  ultEffect(r, c, h, m, now) {
    const id = c.hero, f = fwd(c.yaw), tok = (k, n = 1) => { c.tok[k] = Math.min(60, (c.tok[k] || 0) + n); };
    const enemies = () => r.players.filter((t) => t.alive && t.team !== c.team);
    switch (id) {
      case 'rein': { // 대지 분쇄: 앞쪽 부채꼴 20m 기절
        for (const t of enemies()) { const dx = t.pos.x - c.pos.x, dz = t.pos.z - c.pos.z, L = Math.hypot(dx, dz); if (L > 20 || (dx * f.x + dz * f.z) / (L || 1) < 0.78 || Math.abs(t.pos.y - c.pos.y) > 2.2 || !this.canSee(r, eyeOf(c), t) || blockBy(r.g.ents, eyeOf(c), chest(t), c.team)) continue; this.damage(r, t, 50, c, now, { a: 'q' }); if (t.alive && !(t.fx.invuln > now)) { t.fx.stun = now + 2500; this.cc(r, t, 'stun', 2500); } }
        return true;
      }
      case 'winston': c.fx.primal = now + 10000; c.prim = 500; c.hp = this.maxHp(c); return true;
      case 'dva': {
        if (c.pilot) { c.pilot = false; c.hp = this.maxHp(c); this.toRoom(r, { t: 'form', id: c.id, pilot: false }); return true; }
        const bp = { x: c.pos.x + f.x * 3, y: c.pos.y + 0.5, z: c.pos.z + f.z * 3 };
        if (!clearLine(r.g.map, { ...c.pos, y: c.pos.y + 0.8 }, { ...bp, y: bp.y + 0.3 })) { bp.x = c.pos.x; bp.z = c.pos.z; }
        this.addEnt(r, { k: 'bomb', team: c.team, owner: c, x: bp.x, y: bp.y, z: bp.z, vx: f.x * 9, vz: f.z * 9, until: now + 3000 });
        c.pilot = true; c.hp = this.maxHp(c); c.mtxOn = false; this.toRoom(r, { t: 'form', id: c.id, pilot: true });
        return true;
      }
      case 'hog': c.fx.hogult = now + 6000; return true;
      case 'zarya': tok('grav'); return true;
      case 'pharah': c.fx.barrage = now + 3000; tok('barrage', 50); return true;
      case 'reaper': c.fx.blossom = now + 3000; return true;
      case 'cassidy': c.fx.deadeye = now + 7000; c.deadAt = now; c.deadDone = new Set(); return true;
      case 'soldier': c.fx.visor = now + 6000; return true;
      case 'genji': c.fx.blade = now + 6000; c.cd.shift = 0; return true;
      case 'widow': r.g.infra[c.team] = now + 15000; return true;
      case 'tracer': tok('pulse'); return true;
      case 'mercy': c.fx.valk = now + 15000; c.cd.shift = 0; c.cd.e = Math.min(c.cd.e || 0, now); return true;
      case 'ana': {
        const t = r.players.find((p) => p.id === +m.to && p.team === c.team && p.alive && p !== c);
        if (!t || d3(t.pos, c.pos) > 45 || !this.canSee(r, eyeOf(c), t)) { this.send(c, { t: 'toast', text: '💉 나노 강화제는 아군을 조준하고 써요' }); return false; }
        t.fx.nano = now + 8000; this.heal(r, t, 250, c, now); this.toRoom(r, { t: 'fx', k: 'nano', to: t.id, by: c.id }); return true;
      }
      case 'lucio': setTimeout(() => { if (!c.alive || r.g == null) return; for (const t of r.players) if (t.alive && t.team === c.team && d3(t.pos, c.pos) < 30) { t.over = 600; this.toRoom(r, { t: 'fx', k: 'drop', to: t.id }); } }, 500); return true;
      case 'moira': c.fx.coal = now + 8000; return true;
    }
    return false;
  }
  // 젤리크리 황야의 무법자: 모아 둔 피해를 한꺼번에
  deadeyeShot(r, c, m, now) {
    if (c.hero !== 'cassidy' || !(c.fx.deadeye > now - 400)) return;
    const el = (now - c.deadAt) / 1000;
    for (const [id, amt] of (Array.isArray(m.list) ? m.list : []).slice(0, 6)) {
      const t = r.players.find((p) => p.id === +id); if (!t || !t.alive || t.team === c.team || c.deadDone.has(t.id)) continue;
      if (!this.canSee(r, eyeOf(c), t)) continue;
      c.deadDone.add(t.id);
      const cap = Math.min(1200, 140 * el + 60 * el * el);
      this.damage(r, t, Math.max(0, Math.min(cap, +amt || 0)), c, now, { a: 'q' });
    }
    c.fx.deadeye = 0;
  }
  rez(r, c, now) {
    const t = r.players.filter((p) => p.team === c.team && !p.alive && p.deathPos && now - p.deadAt < 10000 && d3(p.deathPos, c.pos) < 7).sort((a, b) => d3(a.deathPos, c.pos) - d3(b.deathPos, c.pos))[0];
    if (!t) return false;
    this.toRoom(r, { t: 'fx', k: 'rez', by: c.id, to: t.id });
    this.spawn(r, t, now, [t.deathPos.x, t.deathPos.z, t.deathPos.y]);
    return true;
  }
  bubble(t, by, now) { t.bub = 200; t.fx.bub = now + 2000; t.bubBy = by; }
  syncShield(r, c) {
    let e = r.g.ents.find((x) => x.k === 'shield' && x.owner === c);
    if (c.shieldOn && c.alive) { if (!e) this.addEnt(r, { k: 'shield', team: c.team, owner: c, x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, hp: c.shp, max: 1200, until: Infinity }); }
    else if (e) { c.shp = Math.max(0, e.hp); this.removeEnt(r, e); }
  }
  addEnt(r, e) { e.id = r.g.eid++; e.yaw = e.yaw || 0; r.g.ents.push(e); return e; }

  // ---------- 피해 · 치유 · 처치 ----------
  charge(p, n) { const g = p.room?.g; if (!p.hero || (g && g.phase !== 'play' && g.phase !== 'setup')) return; if (p.fx.valk || p.fx.blossom || p.fx.hogult || p.fx.barrage || p.fx.blade || p.fx.coal || p.fx.visor || p.fx.primal) { const now = Date.now(); if (Object.keys(p.fx).some((k) => ['valk', 'blossom', 'hogult', 'barrage', 'blade', 'coal', 'visor', 'primal'].includes(k) && p.fx[k] > now)) return; } p.ult = Math.min(heroById(p.hero).ult, p.ult + n); }
  damage(r, t, amt, by, now, o = {}) {
    if (!t.alive || amt <= 0 || r.g?.phase === 'over') return 0;
    if (t.fx.invuln > now) return 0;
    if (by && by !== t && by.team === t.team) return 0;
    // 앞에서 오는 공격: 매트릭스는 지우고 · 튕겨내기는 되돌린다
    if (by && by !== t && !o.melee && (t.mtxOn || t.fx.deflect > now)) {
      const src = o.src || by.pos, f = fwd(t.yaw), dx = src.x - t.pos.x, dz = src.z - t.pos.z, L = Math.hypot(dx, dz) || 1;
      if ((dx * f.x + dz * f.z) / L > 0.35 && (t.mtxOn ? L < 25 || o.src : true)) {
        if (t.fx.deflect > now && !o.reflected && !o.beam && by.alive) this.damage(r, by, amt, t, now, { a: 'deflect', reflected: true });
        return 0;
      }
    }
    if (by && by !== t) { if (by.fx.boost > now) { amt *= 1.3; if (by.boostBy) this.charge(by.boostBy, amt * 0.23); } if (by.fx.nano > now) amt *= 1.5; }
    if (t.fx.nano > now) amt *= 0.5;
    if (t.fx.breath > now) amt *= 0.5;
    const dealt = amt;
    // 보호막 순서: 입자 방벽 → 원시의 분노 → 소리 방벽 → 체력
    if (t.bub > 0 && t.fx.bub > now) { const a = Math.min(t.bub, amt); t.bub -= a; amt -= a; const z = t.bubBy; if (z?.hero === 'zarya') z.energy = Math.min(100, z.energy + a * 0.35); }
    if (t.prim > 0 && amt > 0) { const a = Math.min(t.prim, amt); t.prim -= a; amt -= a; }
    if (t.over > 0 && amt > 0) { const a = Math.min(t.over, amt); t.over -= a; amt -= a; }
    t.hp -= amt;
    t.lastHurt = now; if (t.fx.sleep > now) t.fx.sleep = 0;
    if (by) {
      if (by !== t) { by.dmg += dealt; this.charge(by, dealt); t.dmgBy.set(by.id, now); }
      if (o.steal && by !== t) this.heal(r, by, dealt * o.steal, by, now);
    }
    if (o.kb && t.alive && by) { const f = fwd(by.yaw); this.knock(r, t, [f.x * o.kb, 3.5, f.z * o.kb]); }
    const msg = { t: 'dmg', to: t.id, by: by?.id, n: Math.round(dealt * 10) / 10, hp: Math.max(0, Math.round(t.hp)), head: !!o.head, p: by ? [by.pos.x, by.pos.z] : null };
    if (t.ws) this.send(t, msg); if (by?.ws && by !== t) this.send(by, msg);
    if (t.hp <= 0) {
      if (t.hero === 'dva' && !t.pilot) { t.pilot = true; t.hp = this.maxHp(t); t.mtxOn = false; this.toRoom(r, { t: 'form', id: t.id, pilot: true, eject: true }); this.charge(t, 300); return dealt; }
      this.kill(r, t, by, o.a, o.head, now);
    } else if (t.bot && by && by !== t) { t.target = by; t.react = Math.min(t.react, 0.25); }
    return dealt;
  }
  heal(r, t, amt, by, now) {
    if (!t.alive || amt <= 0 || t.fx.anti > now) return 0;
    if (t.fx.hboost > now) amt *= 1.5;
    const a = Math.min(amt, this.maxHp(t) - t.hp); if (a <= 0) return 0;
    t.hp += a;
    if (by) { by.heal += a; this.charge(by, by === t ? a * 0.5 : a); }
    return a;
  }
  kill(r, t, by, a, head, now) {
    t.alive = false; t.d++; t.respawnAt = now + RESPAWN_MS; t.deathPos = { ...t.pos }; t.deadAt = now;
    t.fx = {}; t.shieldOn = false; t.mtxOn = false; t.over = 0; t.prim = 0; t.bub = 0; t.hot = null; this.syncShield(r, t);
    const assists = [...t.dmgBy.entries()].filter(([id, at]) => now - at < 6000 && id !== by?.id).map(([id]) => id);
    if (by && by !== t) { by.k++; by.fb++; }
    for (const id of assists) { const p = r.players.find((q) => q.id === id); if (p) p.k++; }
    this.toRoom(r, { t: 'kill', by: by?.id ?? t.id, to: t.id, a: a || 'p', bh: by?.hero, th: t.hero, head: !!head, as: assists, ms: RESPAWN_MS });
    if (by?.hero === 'genji' && by !== t) { by.cd.shift = 0; this.send(by, { t: 'reset', s: 'shift' }); }
    if (t.hero === 'dva') t.pilot = false;
    for (const e of r.g.ents.filter((e) => e.owner === t && (e.k === 'shield'))) this.removeEnt(r, e);
  }
  cc(r, t, k, ms) { this.toRoom(r, { t: 'cc', to: t.id, k, ms }); if (t.bot) t.path = null; }
  knock(r, t, v) { if (t.bot) { t.kv = { x: v[0], z: v[2], until: Date.now() + 350 }; return; } this.send(t, { t: 'kb', v }); }
  pullTo(r, t, p) { if (t.bot) { t.pos.x = p.x; t.pos.z = p.z; t.pos.y = floorAt(r.g.map, p.x, p.z, p.y + 1); return; } t.pos = { ...p }; this.send(t, { t: 'pull', p: [p.x, p.y, p.z] }); }

  // ---------- 매 틱 ----------
  onTick(r, now) {
    const g = r.g; if (!g || now < r.startAt) return;
    const dt = 1 / this.o.hz;
    if (g.phase === 'select') { if (now >= g.until) this.toSetup(r, now); else return; }
    if (g.phase === 'setup' && now >= g.until) this.toPlay(r, now);
    // 사람 위치 (받은 상태로)
    for (const p of r.players) if (!p.bot && p.st && p.alive) { p.pos = { x: p.st[0], y: p.st[1], z: p.st[2] }; p.yaw = p.st[3]; p.pitch = p.st[4]; }
    if (g.phase === 'over') { this.sendState(r, now, dt); return; }
    for (const p of r.players) if (!p.alive && p.hero && p.respawnAt && now >= p.respawnAt) this.spawn(r, p, now);
    this.statusTick(r, now, dt);
    this.entTick(r, now, dt);
    // 봇 차례는 매번 섞는다 (늘 같은 팀이 먼저 쏘지 않게)
    const bots = r.players.filter((b) => b.bot && b.alive && b.hero);
    for (let i = bots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bots[i], bots[j]] = [bots[j], bots[i]]; }
    for (const b of bots) this.botThink(r, b, dt, now);
    if (g.phase === 'play') this.objTick(r, now, dt);
    this.sendState(r, now, dt);
  }
  statusTick(r, now, dt) {
    const g = r.g;
    for (const p of r.players) {
      if (!p.alive || !p.hero) continue;
      const h = heroById(p.hero), max = this.maxHp(p);
      // 출발 방에선 빠르게 회복
      if (inRoom(this.roomOf(r, p.team), p.pos.x, p.pos.z)) p.hp = Math.min(max, p.hp + 160 * dt);
      // 지원가: 잠깐 안 맞으면 조금씩 회복
      if (h.role === 'sup' && now - (p.lastHurt || 0) > 2500) this.heal(r, p, 16 * dt, null, now);
      if (p.hot && p.hot.until > now) this.heal(r, p, p.hot.rate * dt, p, now);
      for (const ps of p.poison || []) if (ps.until > now) this.damage(r, p, ps.dps * dt, ps.by, now, { a: 'mine' });
      if (p.poison) p.poison = p.poison.filter((x) => x.until > now);
      if (!p.alive) continue;
      if (p.over > 0) p.over = Math.max(0, p.over - 85 * dt);
      if (p.prim > 0 && !(p.fx.primal > now)) p.prim = 0;
      if (p.bub > 0 && !(p.fx.bub > now)) p.bub = 0;
      if (p.hero === 'zarya' && now - (p.lastEnergy || 0) > 0) p.energy = Math.max(0, p.energy - 3 * dt);
      if (p.hero === 'rein') { if (p.shieldOn) { const e = g.ents.find((x) => x.k === 'shield' && x.owner === p); if (e) { e.x = p.pos.x; e.y = p.pos.y; e.z = p.pos.z; e.yaw = p.yaw; } } else if (now - (p.shieldBroke || 0) > 5000) p.shp = Math.min(1200, p.shp + 150 * dt); }
      if (p.hero === 'dva') { if (p.mtxOn) { p.mtx -= dt; if (p.mtx <= 0) { p.mtx = 0; p.mtxOn = false; } p.mtxUsed = now; } else if (now - (p.mtxUsed || 0) > 1000) p.mtx = Math.min(3, p.mtx + dt * 0.5); }
      if (p.hero === 'moira' && now - (p.sprayAt || 0) > 400) p.res = Math.min(100, p.res + 14 * dt);
      if (p.hero === 'tracer' && p.blinks < 3) { if (!p.blinkT) p.blinkT = now; if (now - p.blinkT >= 3000) { p.blinks++; p.blinkT = p.blinks < 3 ? now : 0; } }
      if (p.hero === 'tracer') { if (!p.hist.length || now - p.hist[p.hist.length - 1].t > 200) p.hist.push({ t: now, hp: p.hp }); while (p.hist.length && now - p.hist[0].t > 3200) p.hist.shift(); }
      this.charge(p, ULT_PASSIVE * ULT_X * dt * (g.phase === 'play' ? 1 : 0));
      // 지속 궁극기 (서버가 피해를 낸다)
      if (p.fx.blossom > now) { if ((p.tk = (p.tk || 0) + dt) >= 0.1) { p.tk = 0; for (const t of r.players) if (t.alive && t.team !== p.team && d3(t.pos, p.pos) < 8 && this.canSee(r, eyeOf(p), t)) this.damage(r, t, 17, p, now, { a: 'q', steal: 0.3 }); } }
      if (p.fx.hogult > now) {
        if ((p.tk = (p.tk || 0) + dt) >= 0.1) { p.tk = 0; const f = fwd(p.yaw); for (const t of r.players) { if (!t.alive || t.team === p.team) continue; const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, L = Math.hypot(dx, dz); if (L > 15 || (dx * f.x + dz * f.z) / (L || 1) < 0.8 || !this.canSee(r, eyeOf(p), t)) continue; this.damage(r, t, 16 * (1 - L / 25), p, now, { a: 'q' }); this.knock(r, t, [f.x * 6, 1.5, f.z * 6]); } }
      }
      if (p.fx.coal > now) {
        if ((p.tk = (p.tk || 0) + dt) >= 0.1) {
          p.tk = 0; const f = fwd(p.yaw, p.pitch), e = eyeOf(p);
          for (const t of r.players) {
            if (!t.alive || t === p) continue;
            const q = chest(t), vx = q.x - e.x, vy = q.y - e.y, vz = q.z - e.z, along = vx * f.x + vy * f.y + vz * f.z;
            if (along < 0 || along > 30) continue;
            const off = Math.hypot(vx - f.x * along, vy - f.y * along, vz - f.z * along); if (off > 1.6) continue;
            if (!clearLine(g.map, e, q)) continue;
            if (t.team === p.team) this.heal(r, t, 14, p, now); else this.damage(r, t, 7, p, now, { a: 'q', beam: true });
          }
        }
      }
      // 젤리우 음악: 주변 아군 치유 · 속도
      if (p.hero === 'lucio') {
        const amp = p.fx.amp > now;
        for (const t of r.players) {
          if (!t.alive || t.team !== p.team || d3(t.pos, p.pos) > 12) continue;
          if (p.song === 'heal') this.heal(r, t, (amp ? 48 : 13) * dt * (t === p ? 0.7 : 1), p, now); else { t.fx.spd = now + 400; t.spdK = amp ? 1.6 : 1.28; }
        }
      }
      if (p.fx.valk > now && p.hero === 'mercy') p.ult = 0;
    }
  }
  entTick(r, now, dt) {
    const g = r.g;
    for (const e of [...g.ents]) {
      if (e.until <= now) {
        if (e.k === 'bomb') this.bigBoom(r, e, now);
        if (e.k === 'pulse') { this.toRoom(r, { t: 'boom', k: 'pulsebomb', p: [e.x, e.y, e.z], by: e.owner.id }); this.explode(r, e.owner, 'pulsebomb', { x: e.x, y: e.y, z: e.z }, null, null, now); }
        this.removeEnt(r, e); continue;
      }
      if (e.k === 'pulse' && e.on) { if (e.on.alive) { e.x = e.on.pos.x; e.y = e.on.pos.y + 1.1; e.z = e.on.pos.z; } else e.on = null; }
      if (e.k === 'field') for (const t of r.players) if (t.alive && t.team === e.team && d3(t.pos, e) < e.r) this.heal(r, t, 40 * dt, e.owner, now);
      if (e.k === 'grav') {
        for (const t of r.players) {
          if (!t.alive || t.team === e.team || t.fx.invuln > now || d3(chest(t), e) > e.r) continue;
          if (!clearLine(g.map, e, chest(t))) continue;
          if (!(t.fx.grav > now)) this.toRoom(r, { t: 'cc', to: t.id, k: 'grav', ms: e.until - now, p: [e.x, e.y, e.z] });
          t.fx.grav = e.until; t.gravAt = e;
          if (t.bot) { t.pos.x += (e.x - t.pos.x) * Math.min(1, dt * 4); t.pos.z += (e.z - t.pos.z) * Math.min(1, dt * 4); }
          this.damage(r, t, 13 * dt, e.owner, now, { a: 'q', beam: true });
        }
      }
      if (e.k === 'mine') {
        const t = r.players.find((p) => p.alive && p.team !== e.team && d3(p.pos, e) < 3 && !(p.fx.invuln > now));
        if (t) { (t.poison ||= []).push({ until: now + 4000, dps: 75 / 4, by: e.owner }); t.fx.reveal = now + 4000; this.toRoom(r, { t: 'fx', k: 'mine', to: t.id, by: e.owner.id, p: [e.x, e.y, e.z] }); this.removeEnt(r, e); }
      }
      if (e.k === 'orb') {
        // 벽에 튕기며 굴러간다
        const nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
        if (!clearLine(g.map, { x: e.x, y: e.y, z: e.z }, { x: nx + Math.sign(e.vx) * 0.4, y: e.y, z: e.z })) e.vx = -e.vx; else e.x = nx;
        if (!clearLine(g.map, { x: e.x, y: e.y, z: e.z }, { x: e.x, y: e.y, z: nz + Math.sign(e.vz) * 0.4 })) e.vz = -e.vz; else e.z = nz;
        e.y += ((floorAt(g.map, e.x, e.z, e.y) + 1.2) - e.y) * Math.min(1, dt * 6);
        for (const t of r.players) {
          if (!t.alive || d3(chest(t), e) > e.r || !clearLine(g.map, e, chest(t))) continue;
          if (t.team === e.team) this.heal(r, t, 45 * dt, e.owner, now); else this.damage(r, t, 45 * dt, e.owner, now, { a: 'e', beam: true });
        }
      }
      if (e.k === 'bomb') {
        const nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
        if (clearLine(g.map, { x: e.x, y: e.y + 0.5, z: e.z }, { x: nx, y: e.y + 0.5, z: nz })) { e.x = nx; e.z = nz; } else { e.vx = 0; e.vz = 0; }
        e.vx *= Math.pow(0.4, dt); e.vz *= Math.pow(0.4, dt);
        e.y = floorAt(g.map, e.x, e.z, e.y + 0.5) + 0.5;
      }
      if (e.k === 'dome' && e.owner && !e.owner.alive) { /* 주인이 죽어도 돔은 남는다 */ }
    }
  }
  // 디젤바 자폭: 벽 뒤는 안전
  bigBoom(r, e, now) {
    this.toRoom(r, { t: 'boom', k: 'nuke', p: [e.x, e.y, e.z], by: e.owner.id });
    for (const t of r.players) {
      if (!t.alive || (t.team === e.team && t !== e.owner)) continue;
      const q = chest(t), d = d3(q, e); if (d > 21) continue;
      if (!clearLine(r.g.map, { x: e.x, y: e.y + 0.6, z: e.z }, q) || blockBy(r.g.ents, e, q, e.team)) continue;
      this.damage(r, t, t === e.owner ? 0 : 1000 * Math.max(0.35, 1 - d / 30), e.owner, now, { a: 'q', src: e });
    }
  }
  // ---------- 거점 ----------
  onPoint(r, pt, p) { return p.alive && Math.hypot(p.pos.x - pt.x, p.pos.z - pt.z) <= pt.r && p.pos.y > pt.y - 1 && p.pos.y < pt.y + 3.5; }
  objTick(r, now, dt) {
    const g = r.g;
    if (g.mode === 'assault') {
      const pt = g.map.points[g.pi];
      const on = r.players.filter((p) => this.onPoint(r, pt, p)), atkN = on.filter((p) => p.team === g.atk).length, defN = on.filter((p) => p.team === g.def).length;
      for (const p of on) p.obj += dt;
      g.atkN = atkN; g.defN = defN; g.contested = atkN > 0 && defN > 0;
      if (atkN > 0) g.lastAtk = now;
      if (atkN > 0 && defN === 0) g.prog = Math.min(100, g.prog + dt * (100 / (pt.cap || CAP_SOLO)) * CAP_MUL[Math.min(6, atkN)]); // 맵마다 거점 점령 시간이 다를 수 있다
      else if (atkN === 0 && now - g.lastAtk > 3000) { const floor = Math.floor(g.prog / 33.34) * 33.34; g.prog = Math.max(floor, g.prog - dt * 6); }
      if (g.prog >= 100) {
        if (g.pi === 0) {
          g.pi = 1; g.prog = 0; g.endAt += BONUS_SEC * 1000; g.ot = false;
          this.toRoom(r, { t: 'cap', pt: 'A', team: g.atk, ms: g.endAt - now });
          for (const p of r.players) if (p.team === g.atk) for (const s of p.bot ? [p] : []) s.path = null;
        } else return this.finishWatch(r, g.atk, 'B 거점 점령');
      }
      if (now >= g.endAt) {
        if (atkN > 0) { g.ot = true; g.otFuse = 1.8; }
        else if (g.ot && (g.otFuse -= dt) > 0) { /* 연장전 퓨즈 */ }
        else return this.finishWatch(r, g.def, '거점 방어 성공');
      }
    } else {
      const pt = g.map.points[0];
      const on = r.players.filter((p) => this.onPoint(r, pt, p)), red = on.filter((p) => p.team === 'red').length, blue = on.filter((p) => p.team === 'blue').length;
      for (const p of on) p.obj += dt;
      g.atkN = red; g.defN = blue; g.contested = red > 0 && blue > 0;
      const solo = red > 0 && blue === 0 ? 'red' : blue > 0 && red === 0 ? 'blue' : null;
      if (solo && solo !== g.owner) {
        if (g.cap.team !== solo) g.cap = { team: solo, v: Math.max(0, 0) };
        g.cap.v += dt * (100 / CTRL_CAP) * CAP_MUL[Math.min(6, solo === 'red' ? red : blue)];
        if (g.cap.v >= 100) { g.owner = solo; g.cap = { team: null, v: 0 }; this.toRoom(r, { t: 'cap', pt: 'C', team: solo }); }
      } else if (!solo && !g.contested && g.cap.v > 0) g.cap.v = Math.max(0, g.cap.v - dt * 12);
      if (g.owner) {
        const enemyOn = g.owner === 'red' ? blue > 0 : red > 0;
        g.pct[g.owner] = Math.min(enemyOn ? 99 : 100, g.pct[g.owner] + dt * (100 / CTRL_WIN));
        g.ot = enemyOn && g.pct[g.owner] >= 99;
        if (g.pct[g.owner] >= 100) return this.finishWatch(r, g.owner, '거점 100% 점령');
      }
      if (now >= g.endAt) { const w = g.pct.red === g.pct.blue ? 'draw' : g.pct.red > g.pct.blue ? 'red' : 'blue'; return this.finishWatch(r, w, '시간 종료'); }
    }
  }
  sendState(r, now, dt) {
    const g = r.g;
    if ((g.psT -= dt) > 0) return; g.psT = 0.1;
    const flags = (p) => {
      let f = 0; const x = p.fx;
      for (const k of ['stun', 'sleep', 'invuln', 'nano', 'boost', 'deflect', 'grav', 'anti', 'hboost', 'primal', 'valk', 'blossom', 'hogult', 'blade', 'barrage', 'deadeye', 'coal', 'ghost', 'spd', 'amp', 'visor', 'breath', 'reveal']) if (x[k] > now) f |= F[k];
      if (p.mtxOn) f |= F.matrix; if (p.pilot) f |= F.pilot; if (p.bub > 0 && x.bub > now) f |= F.bub; if (p.poison?.length) f |= F.poison; if (p.shieldOn) f |= F.shield; if (p.hero === 'lucio' && p.song === 'heal') f |= F.songheal;
      return f;
    };
    const ps = r.players.filter((p) => p.hero).map((p) => [p.id, Math.max(0, Math.round(p.hp)), this.maxHp(p), Math.round(p.over + p.prim + (p.fx.bub > now ? p.bub : 0)), Math.floor((p.ult / heroById(p.hero).ult) * 100), flags(p), Math.round(p.energy), p.alive ? 1 : 0, p.hero === 'rein' ? Math.round(p.shieldOn ? g.ents.find((e) => e.k === 'shield' && e.owner === p)?.hp ?? p.shp : p.shp) : p.hero === 'dva' ? Math.round(p.mtx * 100) : p.hero === 'moira' ? Math.round(p.res) : p.hero === 'tracer' ? p.blinks : 0, p.spdK && p.fx.spd > now ? p.spdK : 1, p.bot ? p.beamTo || 0 : now - (p.beamToAt || 0) < 300 ? p.beamTo : 0]);
    const ents = g.ents.map((e) => [e.id, e.k, e.team, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +(e.yaw || 0).toFixed(3), Math.round(e.hp || 0), e.max || 0, e.owner?.id || 0, Math.max(0, Math.round((e.until === Infinity ? 0 : e.until - now)))]);
    const ob = { ph: g.phase, pi: g.pi, prog: Math.round(g.prog * 10) / 10, atkN: g.atkN || 0, defN: g.defN || 0, ct: !!g.contested, ot: !!g.ot, left: Math.max(0, (g.phase === 'setup' || g.phase === 'select' ? g.until : g.endAt) - now), owner: g.owner, cap: g.cap, pct: { red: Math.floor(g.pct.red), blue: Math.floor(g.pct.blue) }, infra: { red: g.infra.red > now, blue: g.infra.blue > now } };
    this.toRoom(r, { t: 'ps', p: ps, e: ents, o: ob });
    // 점수판 (1초마다): 처치 · 결정타 · 죽음 · 피해 · 치유 · 거점 시간
    if ((g.sbT = (g.sbT || 0) + 1) % 10 === 0) this.toRoom(r, { t: 'sb', s: r.players.map((p) => [p.id, p.k, p.fb, p.d, Math.round(p.dmg), Math.round(p.heal), Math.round(p.obj)]) });
  }

  // ---------- 봇 ----------
  nav(map) {
    if (this.navs.has(map.id)) return this.navs.get(map.id);
    const S = 2, nodes = [], idx = new Map(), solid = map.boxes.filter((b) => !b.gate);
    const floorOf = (x, z) => {
      const here = solid.filter((b) => x > b.x - b.w / 2 - 0.55 && x < b.x + b.w / 2 + 0.55 && z > b.z - b.d / 2 - 0.55 && z < b.z + b.d / 2 + 0.55);
      const cands = [0, ...here.map((b) => b.y + b.h).filter((t) => t < 3.5)].sort((a, b) => a - b);
      for (const f of cands) if (!here.some((b) => b.y < f + 1.8 && b.y + b.h > f + 0.05)) return f;
      return null;
    };
    // 격자는 가운데(0)를 기준으로 대칭 (양 팀 길이가 같게)
    const X = Math.floor((map.W / 2 - 1.5) / S) * S, Z = Math.floor((map.D / 2 - 1.5) / S) * S;
    for (let x = -X; x <= X; x += S) for (let z = -Z; z <= Z; z += S) {
      const f = floorOf(x, z); if (f == null) continue;
      idx.set(`${x},${z}`, nodes.length); nodes.push({ x, z, f, n: [] });
    }
    const tmp = { boxes: solid, id: map.id + 'nav' };
    nodes.forEach((a, ai) => {
      for (const [dx, dz] of [[S, 0], [0, S], [S, S], [S, -S]]) {
        const j = idx.get(`${a.x + dx},${a.z + dz}`); if (j == null) continue;
        const b = nodes[j]; if (Math.abs(a.f - b.f) > 1.3) continue;
        const y = Math.max(a.f, b.f) + 0.35;
        if (!clearLine(tmp, { x: a.x, y, z: a.z }, { x: b.x, y, z: b.z }) || !clearLine(tmp, { x: a.x, y: y + 1, z: a.z }, { x: b.x, y: y + 1, z: b.z })) continue;
        a.n.push(j); b.n.push(ai);
      }
    });
    const nav = { nodes, near(p) { let best = 0, bd = Infinity; nodes.forEach((n, i) => { const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2 + ((n.f - (p.y || 0)) * 3) ** 2; if (d < bd && n.n.length) { bd = d; best = i; } }); return best; } };
    this.navs.set(map.id, nav);
    return nav;
  }
  // A*: 실제 거리로 (대각선을 직선과 같게 세면 한쪽 팀 봇만 지그재그로 돌아가는 일이 생긴다)
  pathTo(nav, from, to) {
    const N = nav.nodes, T = N[to], g = new Map([[from, 0]]), prev = new Map([[from, -1]]), done = new Set();
    const h = (i) => Math.hypot(N[i].x - T.x, N[i].z - T.z);
    const heap = [[h(from), from]];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [, c] = pop(); if (done.has(c)) continue; done.add(c); if (c === to) break;
      for (const n of N[c].n) { const ng = g.get(c) + Math.hypot(N[n].x - N[c].x, N[n].z - N[c].z, (N[n].f - N[c].f) * 2); if (ng < (g.get(n) ?? Infinity)) { g.set(n, ng); prev.set(n, c); push([ng + h(n), n]); } }
    }
    if (!prev.has(to)) return null;
    const out = []; for (let c = to; c !== -1; c = prev.get(c)) out.unshift(N[c]);
    return out;
  }
  // 봇이 갈 곳: 거점 (공격팀은 거점 위 · 수비팀은 거점 근처) / 준비 시간엔 출발 방 앞
  botGoal(r, b) {
    const g = r.g, pt = this.objPt(r);
    if (g.phase === 'setup' && (g.mode === 'control' || b.team === g.atk)) return null;
    const role = heroById(b.hero).role, spread = role === 'sup' ? 6 : role === 'tank' ? 2.5 : 5;
    const a = Math.random() * Math.PI * 2, rr = Math.random() * (pt.r + spread);
    return { x: pt.x + Math.cos(a) * rr, z: pt.z + Math.sin(a) * rr, y: pt.y };
  }
  botThink(r, b, dt, now) {
    const g = r.g, map = g.map, h = heroById(b.hero), nav = this.nav(map);
    if (b.fx.stun > now || b.fx.sleep > now) { b.st = [b.pos.x, b.pos.y, b.pos.z, b.yaw, 0, 0]; return; }
    if (b.kv && b.kv.until > now) { const nx = b.pos.x + b.kv.x * dt, nz = b.pos.z + b.kv.z * dt; if (clearLine(map, { ...b.pos, y: b.pos.y + 0.6 }, { x: nx, y: b.pos.y + 0.6, z: nz })) { b.pos.x = nx; b.pos.z = nz; } }
    const eye = eyeOf(b), spec = b.pilot ? h.pilot.p : h.p, sup = h.role === 'sup';
    // 보이는 적 중 가장 가까운 (방벽 뒤는 방벽을 친다)
    let tgt = null, td = sup ? 30 : 45;
    for (const p of r.players) {
      if (p.team === b.team || !p.alive || p.fx.ghost > now) continue;
      const d = d3(b.pos, p.pos);
      if (d < td && this.canSee(r, eye, p)) { td = d; tgt = p; }
    }
    // 지원가: 체력이 깎인 아군
    let ally = null;
    if (sup) { let worst = 0.97; for (const p of r.players) { if (p === b || p.team !== b.team || !p.alive) continue; const k = p.hp / this.maxHp(p), d = d3(b.pos, p.pos); if (k < worst && d < 22 && this.canSee(r, eye, p)) { worst = k; ally = p; } } }
    if (tgt !== b.target) { b.target = tgt; b.react = 0.3 + Math.random() * 0.45 * (1.3 - b.skill); }
    this.botAbil(r, b, h, tgt, td, ally, now);
    // 젤리하르트: 멀리 있는 적에겐 방패를 들고 다가가고, 가까우면 내리고 휘두른다
    if (b.hero === 'rein') { const want = !!tgt && td > 6.5 && b.shp > 150 && now - (b.shieldBroke || 0) > 5000 && !(b.fx.charge > now); if (want !== !!b.shieldOn) { b.shieldOn = want; this.syncShield(r, b); } }
    let moving = false, look = null;
    const range = spec.type === 'melee' ? 3.5 : spec.type === 'beam' ? spec.range - 1 : spec.near ? Math.max(6, spec.near * 0.8) : 18;
    // 공격 · 치유
    const healBeam = (b.hero === 'mercy' || b.hero === 'moira') && ally && d3(b.pos, ally.pos) < 14;
    if (healBeam) { look = ally; if (b.hero === 'mercy') this.heal(r, ally, h.p.hps * dt, b, now); else if (b.res > 5) { b.res -= 13 * dt; b.sprayAt = now; this.heal(r, ally, h.p.hps * dt, b, now); } b.beamTo = ally.id; }
    else b.beamTo = 0;
    if (b.hero === 'ana' && ally && ally.hp / this.maxHp(ally) < 0.7 && (!tgt || Math.random() < 0.6)) { look = ally; if (now >= b.fireT) { b.fireT = now + 900; if (Math.random() < 0.75 * b.skill + 0.2) { this.heal(r, ally, 75, b, now); this.toRoom(r, { t: 'fire', by: b.id, o: [eye.x, eye.y, eye.z], to: chest(ally), heal: true }); } } }
    else if (tgt && !healBeam) {
      look = tgt; b.react -= dt;
      if (b.react <= 0) this.botAttack(r, b, h, spec, tgt, td, dt, now);
    }
    if (look) {
      const want = Math.atan2(-(look.pos.x - b.pos.x), -(look.pos.z - b.pos.z));
      let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += Math.max(-8 * dt, Math.min(8 * dt, dy));
      b.pitch = Math.atan2((look.pos.y + 1.1) - (b.pos.y + EYE), Math.max(1, d2(look.pos, b.pos))) * 0.8;
    }
    // 이동: 싸우는 중엔 거리 맞추며 옆걸음 · 아니면 거점으로
    const speed = 5.2 * h.speed * (b.fx.spd > now ? b.spdK || 1 : 1) * (b.fx.blossom > now ? 0.6 : 1) * (b.fx.blade > now ? 1.2 : 1);
    if (b.fx.grav > now) { /* 끌려가는 중 */ }
    else if (tgt && !healBeam && !(sup && ally)) {
      b.strafeT = (b.strafeT || 0) - dt;
      if (b.strafeT <= 0) { b.strafeT = 0.5 + Math.random() * 1.1; b.strafe = (Math.random() - 0.5) * 2; }
      const closer = td > range ? 1 : td < range * 0.5 && spec.type !== 'melee' ? -0.6 : 0;
      this.botStep(r, b, closer, b.strafe * 0.7, speed, dt); moving = true;
    } else if (healBeam || (sup && ally)) {
      const d = d3(b.pos, ally.pos); if (d > 7) { this.botWalkTo(r, b, nav, ally.pos, speed, dt); moving = true; }
    } else {
      const goal = this.botGoal(r, b);
      if (goal) {
        if (!b.path || !b.path.length || (b.repath = (b.repath || 0) - dt) <= 0) {
          b.repath = 4 + Math.random() * 4;
          b.path = this.pathTo(nav, nav.near(b.pos), nav.near(goal)) || [];
        }
        const n = b.path[0];
        if (n) {
          const want = Math.atan2(-(n.x - b.pos.x), -(n.z - b.pos.z));
          let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += Math.max(-6 * dt, Math.min(6 * dt, dy)); b.pitch = 0;
          const step = speed * dt, d = d2(b.pos, n);
          if (d <= step + 0.2) { b.pos.x = n.x; b.pos.z = n.z; b.path.shift(); } else { b.pos.x += ((n.x - b.pos.x) / d) * step; b.pos.z += ((n.z - b.pos.z) / d) * step; }
          moving = true;
        }
      }
    }
    // 높이: 계단 · 단 위로 (몸 가운데가 그 위에 있을 때만 · 벽 옆을 걷다가 벽 위로 올라가던 것 막기)
    const fy = floorAt(map, b.pos.x, b.pos.z, b.pos.y + 0.8, 0.15);
    if (fy > b.pos.y) b.pos.y = Math.min(fy, b.pos.y + dt * 9); else if (fy < b.pos.y) { b.vy = (b.vy || 0) - 21 * dt; b.pos.y = Math.max(fy, b.pos.y + b.vy * dt); if (b.pos.y === fy) b.vy = 0; }
    b.st = [b.pos.x, b.pos.y, b.pos.z, b.yaw, b.pitch || 0, (moving ? 1 : 0) | (b.beamTo ? 2 : 0)];
    b.beamAtSend = b.beamTo;
  }
  botWalkTo(r, b, nav, to, speed, dt) {
    if (!b.path || !b.path.length || (b.repath = (b.repath || 0) - dt) <= 0) { b.repath = 1.5; b.path = this.pathTo(nav, nav.near(b.pos), nav.near(to)) || []; }
    const n = b.path[0]; if (!n) return;
    const step = speed * dt, d = d2(b.pos, n);
    if (d <= step + 0.2) { b.pos.x = n.x; b.pos.z = n.z; b.path.shift(); } else { b.pos.x += ((n.x - b.pos.x) / d) * step; b.pos.z += ((n.z - b.pos.z) / d) * step; }
  }
  // 앞뒤 · 옆걸음 (벽에 막히면 안 움직인다)
  botStep(r, b, f, s, speed, dt) {
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    let vx = fx * f + rx * s, vz = fz * f + rz * s; const L = Math.hypot(vx, vz); if (L < 0.05) return; vx /= Math.max(1, L); vz /= Math.max(1, L);
    const nx = b.pos.x + vx * speed * dt, nz = b.pos.z + vz * speed * dt;
    if (clearLine(r.g.map, { x: b.pos.x, y: b.pos.y + 0.6, z: b.pos.z }, { x: nx + vx * 0.6, y: b.pos.y + 0.6, z: nz + vz * 0.6 }) && Math.abs(floorAt(r.g.map, nx, nz, b.pos.y + 0.8, 0.15) - b.pos.y) < 0.8) { b.pos.x = nx; b.pos.z = nz; }
    b.path = null;
  }
  botAttack(r, b, h, spec, tgt, td, dt, now) {
    const eye = eyeOf(b), aimP = chest(tgt);
    const blocked = blockBy(r.g.ents, eye, aimP, b.team);
    const moving = !!(tgt.st && tgt.st[5] & 1) || !tgt.bot;
    const pAcc = (base) => Math.max(0.06, Math.min(0.9, base)) * (0.55 + b.skill * 0.6) * (b.fx.visor > now ? 1.6 : 1) * (moving ? 0.9 : 1);
    if (b.fx.blade > now || (b.hero === 'winston' && b.fx.primal > now)) {
      if (td < 5.5 && now >= b.fireT) { b.fireT = now + (b.fx.blade > now ? 800 : 600); this.toRoom(r, { t: 'fx', k: 'swing', by: b.id }); if (blocked) this.hurtEnt(r, blocked.e, 100, b); else this.damage(r, tgt, b.fx.blade > now ? 110 : 40, b, now, { a: b.fx.blade > now ? 'blade' : 'punch', melee: true, kb: b.fx.primal > now ? 11 : 0 }); }
      return;
    }
    if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.mag = spec.mag; return; }
    if (spec.type === 'beam') {
      if (td > spec.range) return;
      b.beamTo = tgt.id;
      if (blocked) { this.hurtEnt(r, blocked.e, (spec.dps || 60) * dt, b); return; }
      let dmg = (spec.dps || 60) * dt * (0.6 + b.skill * 0.4); if (spec.energy) dmg *= 1 + b.energy / 140;
      this.damage(r, tgt, dmg, b, now, { a: 'p', beam: true });
      return;
    }
    if (spec.type === 'spray') { // 젤리라: 적에겐 흡수 줄기
      if (td > h.s.range) return; b.beamTo = tgt.id;
      if (!blocked) { this.damage(r, tgt, h.s.dps * dt * 0.8, b, now, { a: 's', beam: true }); this.heal(r, b, h.s.selfHeal * dt, b, now); }
      return;
    }
    if (now < b.fireT) return;
    if (spec.type === 'melee') {
      if (td > spec.range) return;
      b.fireT = now + spec.rate * 1000; this.toRoom(r, { t: 'fx', k: 'swing', by: b.id });
      for (const t of r.players) { if (!t.alive || t.team === b.team || d3(t.pos, b.pos) > spec.range + 0.5) continue; if (blocked && t === tgt) { this.hurtEnt(r, blocked.e, spec.dmg, b); continue; } this.damage(r, t, spec.dmg, b, now, { a: 'p', melee: true }); }
      return;
    }
    if (spec.mag) { b.mag = (b.mag ?? spec.mag) - 1; if (b.mag <= 0) b.reloadT = spec.reload || 1.4; }
    if (spec.type === 'proj') {
      const P = PROJ[spec.k], n = spec.burst || 1;
      b.fireT = now + spec.rate * 1000 * (1 + Math.random() * 0.4);
      for (let i = 0; i < n; i++) setTimeout(() => {
        if (!b.alive || !tgt.alive || !r.g) return;
        const e = eyeOf(b), q = chest(tgt), lead = d3(e, q) / P.speed;
        const hit = Math.random() < pAcc(0.85 - td * 0.012);
        const aim = { x: q.x + (tgt.pos.x - (tgt.lx ?? tgt.pos.x)) * lead * 10 + (hit ? 0 : rnd(-2.2, 2.2)), y: q.y + (hit ? rnd(-0.3, 0.3) : rnd(-1, 1.4)), z: q.z + (tgt.pos.z - (tgt.lz ?? tgt.pos.z)) * lead * 10 + (hit ? 0 : rnd(-2.2, 2.2)) };
        const L = d3(e, aim) || 1, v = [(aim.x - e.x) / L * P.speed, (aim.y - e.y) / L * P.speed, (aim.z - e.z) / L * P.speed];
        this.toRoom(r, { t: 'proj', by: b.id, k: spec.k, o: [e.x, e.y, e.z], v });
        setTimeout(() => {
          if (!r.g || r.g.phase === 'over') return;
          const bl = blockBy(r.g.ents, e, aim, b.team);
          const p = bl ? { x: e.x + (aim.x - e.x) * bl.t, y: e.y + (aim.y - e.y) * bl.t, z: e.z + (aim.z - e.z) * bl.t } : aim;
          if (!bl && !clearLine(r.g.map, e, p)) return;
          if (P.r || P.splash) this.toRoom(r, { t: 'boom', k: spec.k, p: [p.x, p.y, p.z], by: b.id });
          this.explode(r, b, spec.k, p, hit && !bl && tgt.alive ? tgt : null, bl ? bl.e : null, Date.now(), Math.random() < 0.1);
        }, (L / P.speed) * 1000);
      }, i * (spec.burstGap || 0.1) * 1000);
      return;
    }
    // 즉발 사격
    b.fireT = now + spec.rate * 1000 * (spec.auto ? 1 : 1.3 + Math.random() * 0.6);
    const n = spec.pellets || 1, base = spec.pellets > 4 ? 1 - td / (spec.far * 1.4) : spec.dmg >= 60 ? 0.62 - td * 0.006 : 0.85 - td * 0.014;
    const hit = Math.random() < pAcc(base);
    const miss = { x: aimP.x + (hit ? 0 : rnd(-1.6, 1.6)), y: aimP.y + (hit ? 0 : rnd(-0.6, 1.2)), z: aimP.z + (hit ? 0 : rnd(-1.6, 1.6)) };
    this.toRoom(r, { t: 'fire', by: b.id, o: [eye.x, eye.y, eye.z], to: blocked ? { x: eye.x + (aimP.x - eye.x) * blocked.t, y: eye.y + (aimP.y - eye.y) * blocked.t, z: eye.z + (aimP.z - eye.z) * blocked.t } : miss });
    if (blocked) { this.hurtEnt(r, blocked.e, spec.dmg * n * 0.7, b); return; }
    if (hit) {
      const head = Math.random() < 0.13 * b.skill;
      const k = n > 1 ? Math.max(0.25, 1 - td / (spec.far * 1.2)) : 1;
      this.damage(r, tgt, spec.dmg * Math.max(1, Math.round(n * k)) * (head ? spec.head || 2 : 1) * falloff(spec, td), b, now, { a: 'p', head, steal: spec.steal });
    }
  }
  // 봇 기술: 상황에 맞춰 가끔 (쿨타임 지키며)
  botAbil(r, b, h, tgt, td, ally, now) {
    if (now < b.abilT) return;
    b.abilT = now + rnd(700, 1600);
    const cdOk = (s) => now >= (b.cd[s] || 0), use = (s) => { b.cd[s] = now + ((s === 's' ? h.s?.cd : h[s]?.cd) || 6) * 1000; this.toRoom(r, { t: 'fx', k: 'abil', by: b.id, h: b.hero, s, p: [b.pos.x, b.pos.y, b.pos.z], yaw: b.yaw, to: tgt?.id ?? null }); };
    const lowHp = b.hp / this.maxHp(b);
    const near = r.players.filter((p) => p.alive && p.team !== b.team && d3(p.pos, b.pos) < 12).length;
    // 궁극기
    if (b.ult >= h.ult && (tgt || (h.role === 'sup' && ally))) {
      const fake = { to: ally?.id };
      if ((b.hero === 'ana' && !ally) || (b.hero === 'rein' && td > 14) || (b.hero === 'reaper' && td > 7) || (b.hero === 'hog' && td > 12) || (b.hero === 'genji' && td > 14)) { /* 기다린다 */ }
      else if (b.hero === 'zarya' || b.hero === 'pharah' || b.hero === 'tracer') {
        if (tgt && td < 25) { b.ult = 0; const tp = { ...chest(tgt) }; this.toRoom(r, { t: 'fx', k: 'ult', by: b.id, h: b.hero, team: b.team, p: [b.pos.x, b.pos.y, b.pos.z], yaw: b.yaw });
          if (b.hero === 'zarya') setTimeout(() => { if (r.g) { this.toRoom(r, { t: 'boom', k: 'grav', p: [tp.x, tp.y, tp.z], by: b.id }); this.addEnt(r, { k: 'grav', team: b.team, owner: b, x: tp.x, y: tp.y, z: tp.z, until: Date.now() + 4000, r: 6.5 }); } }, 600);
          if (b.hero === 'tracer') setTimeout(() => { if (r.g && tgt.alive && Math.random() < 0.6 + b.skill * 0.3) this.addEnt(r, { k: 'pulse', team: b.team, owner: b, on: tgt, x: tp.x, y: tp.y, z: tp.z, until: Date.now() + 1000, boom: 'pulsebomb' }); }, 400);
          if (b.hero === 'pharah') { b.fx.barrage = now + 3000; for (let i = 0; i < 12; i++) setTimeout(() => { if (r.g && b.alive && tgt.alive) { const q = chest(tgt); const p = { x: q.x + rnd(-1.5, 1.5), y: q.y + rnd(-0.5, 0.5), z: q.z + rnd(-1.5, 1.5) }; if (clearLine(r.g.map, eyeOf(b), p)) { this.toRoom(r, { t: 'boom', k: 'barrage', p: [p.x, p.y, p.z], by: b.id }); this.explode(r, b, 'barrage', p, Math.random() < 0.4 ? tgt : null, null, Date.now()); } } }, 200 + i * 230); }
          return; }
      } else if (b.hero === 'cassidy') {
        b.ult = 0; b.fx.deadeye = now + 2500; this.toRoom(r, { t: 'fx', k: 'ult', by: b.id, h: b.hero, team: b.team, p: [b.pos.x, b.pos.y, b.pos.z], yaw: b.yaw });
        setTimeout(() => { if (!r.g || !b.alive) return; b.fx.deadeye = 0; for (const t of r.players) if (t.alive && t.team !== b.team && d3(t.pos, b.pos) < 35 && this.canSee(r, eyeOf(b), t)) { this.toRoom(r, { t: 'fire', by: b.id, o: [b.pos.x, b.pos.y + EYE, b.pos.z], to: chest(t) }); this.damage(r, t, 330, b, Date.now(), { a: 'q' }); } }, 2400);
        return;
      } else if (b.hero === 'widow' || b.hero === 'soldier' || b.hero === 'moira' || b.hero === 'mercy' || b.hero === 'lucio' || b.hero === 'winston' || b.hero === 'reaper' || b.hero === 'hog' || b.hero === 'rein' || b.hero === 'genji' || b.hero === 'dva' || b.hero === 'ana') {
        if (b.hero === 'dva' && b.pilot) { /* 아래에서 */ }
        if (this.ultEffect(r, b, h, fake, now)) { b.ult = 0; this.toRoom(r, { t: 'fx', k: 'ult', by: b.id, h: b.hero, team: b.team, p: [b.pos.x, b.pos.y, b.pos.z], yaw: b.yaw }); return; }
      }
    }
    // 방어 · 이동기
    if (b.hero === 'mercy' && cdOk('e')) { const dead = r.players.find((p) => p.team === b.team && !p.alive && p.deathPos && now - p.deadAt < 10000 && d3(p.deathPos, b.pos) < 7); if (dead && this.rez(r, b, now)) { b.cd.e = now + 30000; return; } }
    if (b.hero === 'tracer' && b.blinks > 0 && tgt && lowHp < 0.8 && Math.random() < 0.5) {
      // 점멸: 옆으로 휙 (벽이면 안 간다)
      const side = Math.random() < 0.5 ? 1 : -1, rx = Math.cos(b.yaw) * side, rz = -Math.sin(b.yaw) * side, nx = b.pos.x + rx * 6, nz = b.pos.z + rz * 6;
      if (clearLine(r.g.map, { x: b.pos.x, y: b.pos.y + 1, z: b.pos.z }, { x: nx, y: b.pos.y + 1, z: nz }) && Math.abs(floorAt(r.g.map, nx, nz, b.pos.y + 1) - b.pos.y) < 1) { b.pos.x = nx; b.pos.z = nz; b.blinks--; this.toRoom(r, { t: 'fx', k: 'abil', by: b.id, h: 'tracer', s: 'shift', p: [b.pos.x, b.pos.y, b.pos.z], yaw: b.yaw }); b.path = null; return; }
    }
    if (b.hero === 'widow' && cdOk('e') && tgt && td < 30) { use('e'); for (const e of r.g.ents.filter((e) => e.k === 'mine' && e.owner === b)) this.removeEnt(r, e); this.addEnt(r, { k: 'mine', team: b.team, owner: b, x: b.pos.x, y: b.pos.y + 0.05, z: b.pos.z, until: now + 90000 }); return; }
    if (b.hero === 'hog' && lowHp < 0.45 && cdOk('e')) { use('e'); b.fx.breath = now + 1800; b.hot = { until: now + 1800, rate: 300 / 1.8 }; return; }
    if (b.hero === 'winston' && cdOk('e') && near >= 1 && lowHp < 0.75) { use('e'); this.addEnt(r, { k: 'dome', team: b.team, owner: b, x: b.pos.x, y: b.pos.y, z: b.pos.z, hp: 700, max: 700, until: now + 8000 }); return; }
    if (b.hero === 'soldier' && cdOk('e') && lowHp < 0.55) { use('e'); this.addEnt(r, { k: 'field', team: b.team, owner: b, x: b.pos.x, y: b.pos.y, z: b.pos.z, until: now + 5000, r: 5 }); return; }
    if (b.hero === 'zarya' && cdOk('shift') && lowHp < 0.8 && near) { use('shift'); this.bubble(b, b, now); return; }
    if (b.hero === 'zarya' && cdOk('e') && ally && ally.hp / this.maxHp(ally) < 0.6) { use('e'); this.bubble(ally, b, now); return; }
    if (b.hero === 'genji' && cdOk('e') && lowHp < 0.6 && tgt) { use('e'); b.fx.deflect = now + 2000; return; }
    if (b.hero === 'reaper' && cdOk('shift') && lowHp < 0.3) { use('shift'); b.fx.invuln = now + 3000; b.fx.ghost = now + 3000; return; }
    if (b.hero === 'moira' && cdOk('e') && (tgt || ally)) { use('e'); const f = fwd(b.yaw); this.addEnt(r, { k: 'orb', team: b.team, owner: b, x: b.pos.x + f.x, y: b.pos.y + 1.3, z: b.pos.z + f.z, vx: f.x * 8.5, vz: f.z * 8.5, until: now + 7000, r: 4.2 }); return; }
    if (b.hero === 'lucio') { if (lowHp < 0.6 || (ally && ally.hp / this.maxHp(ally) < 0.6)) b.song = 'heal'; else if (!tgt) b.song = 'speed'; if (cdOk('e') && near && lowHp < 0.7) { use('e'); b.fx.amp = now + 3000; return; } }
    if (b.hero === 'tracer' && cdOk('e') && lowHp < 0.35) { use('e'); const old = b.hist[0]; if (old) b.hp = Math.max(b.hp, old.hp); return; }
    if (b.hero === 'lucio' && cdOk('s') && tgt && td < 7) { use('s'); this.abilEffect(r, b, h, 's', {}, now); return; }
    if (b.hero === 'rein' && cdOk('e') && tgt && td < 18) { use('e'); this.botShot(r, b, 'fire', tgt, now); return; }
    if (b.hero === 'soldier' && cdOk('s') && tgt && td < 25) { use('s'); this.botShot(r, b, 'helix', tgt, now); return; }
    if (b.hero === 'cassidy' && cdOk('e') && tgt && td < 6) { use('e'); this.botShot(r, b, 'flash', tgt, now); return; }
    if (b.hero === 'ana' && cdOk('e') && (ally && ally.hp / this.maxHp(ally) < 0.6 || (tgt && td < 18))) { use('e'); this.botShot(r, b, 'biotic', ally && ally.hp / this.maxHp(ally) < 0.6 ? ally : tgt, now); return; }
    if (b.hero === 'ana' && cdOk('shift') && tgt && td < 14 && Math.random() < 0.5) { use('shift'); this.botShot(r, b, 'sleep', tgt, now); return; }
    if (b.hero === 'dva' && !b.pilot && cdOk('e') && tgt && td < 20) { use('e'); for (let i = 0; i < 6; i++) setTimeout(() => this.botShot(r, b, 'mini', tgt, Date.now()), i * 120); return; }
    if (b.hero === 'hog' && cdOk('shift') && tgt && td < 16 && td > 5) { use('shift'); this.botShot(r, b, 'hook', tgt, now); return; }
    if (b.hero === 'pharah' && cdOk('e') && tgt && td < 8) { use('e'); this.botShot(r, b, 'conc', tgt, now); return; }
    if (b.hero === 'zarya' && tgt && td < 18 && now >= (b.gT || 0)) { b.gT = now + 2500; this.botShot(r, b, 'egren', tgt, now); }
  }
  // 봇 투사체 하나 (맞을지는 확률 · 날아가는 시간 뒤 터진다)
  botShot(r, b, k, tgt, now) {
    const P = PROJ[k], e = eyeOf(b), q = chest(tgt);
    const hit = Math.random() < 0.45 + b.skill * 0.4;
    const aim = { x: q.x + (hit ? 0 : rnd(-2, 2)), y: q.y + (hit ? 0 : rnd(-0.5, 1)), z: q.z + (hit ? 0 : rnd(-2, 2)) };
    const L = d3(e, aim) || 1;
    this.toRoom(r, { t: 'proj', by: b.id, k, o: [e.x, e.y, e.z], v: [(aim.x - e.x) / L * P.speed, (aim.y - e.y) / L * P.speed + (P.grav ? L * 0.25 : 0), (aim.z - e.z) / L * P.speed] });
    setTimeout(() => {
      if (!r.g || r.g.phase === 'over' || !b.alive) return;
      if (!clearLine(r.g.map, e, aim)) return;
      if (P.r || P.splash || P.make) this.toRoom(r, { t: 'boom', k, p: [aim.x, aim.y, aim.z], by: b.id });
      const direct = hit && tgt.alive ? tgt : null;
      if (P.friendly && tgt.team === b.team) this.explode(r, b, k, aim, null, null, Date.now());
      else this.explode(r, b, k, aim, direct, null, Date.now());
    }, (L / P.speed) * 1000);
  }
}
