// 젤리 아레나 시뮬레이션: 화면 · 네트워크 없이 경기 전체를 계산한다 (서버가 돌리고, 시험 때는 빠르게 돌린다)
//   new Arena(players) → tick(dt) 를 반복 · cmd(id, m) 로 명령 · take(team) 로 그 팀에게 보낼 사건 · snapshot(team) 으로 그 팀이 보는 모습
import { LANES, BASE, FOUNTAIN, STRUCTS, CAMPS, EPICS, MONS, BUSHES, MAX_LEVEL, XP_NEED, R_LEVELS, champById, SPELLS, SPELL_OF_ROLE, ITEMS, BUILD, SKILL_ORDER, findPath, blocked, clear, CHAMPS } from '../../public/jelly-arena/js/data.js';

const ME = { melee: { hp: 460, ad: 14, range: 2.2, ar: 10, mr: 0, as: 0.9, ms: 5.6, gold: 21, xp: 34 }, caster: { hp: 300, ad: 22, range: 8.5, ar: 0, mr: 0, as: 0.75, ms: 5.6, gold: 15, xp: 26, proj: 1 }, siege: { hp: 900, ad: 42, range: 10, ar: 30, mr: 0, as: 0.5, ms: 5.6, gold: 48, xp: 60, proj: 1 }, super: { hp: 2000, ad: 90, range: 2.6, ar: 60, mr: 30, as: 0.85, ms: 6.2, gold: 60, xp: 80 } };
const STRUCT_HP = { 1: 2600, 2: 3000, 3: 3400, 4: 2600 }, GATE_HP = 2400, HEART_HP = 5200;
const WAVE_EVERY = 30, FIRST_WAVE = 25, CAMP_FIRST = 60, TOWER_RANGE = 15;
const VISION = { champ: 16, minion: 10, tower: 17, gate: 12, heart: 22, ward: 12, mon: 0 };
const OTHER = { blue: 'red', red: 'blue' };
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Arena {
  constructor(players, o = {}) {
    this.t = 0; this.next = 1; this.units = []; this.shots = []; this.aoes = []; this.zones = []; this.over = null;
    this.ev = { blue: [], red: [] }; this.R = o.rand || Math.random;
    this.waveAt = FIRST_WAVE; this.waveN = 0; this.vis = { blue: new Set(), red: new Set() }; this.visT = 0; this.gates = { blue: {}, red: {} }; this.towerDead = { blue: {}, red: {} };
    this.teamBuff = { blue: { honey: 0, moldUntil: 0 }, red: { honey: 0, moldUntil: 0 } }; this.kills = { blue: 0, red: 0 }; this.towers = { blue: 0, red: 0 }; this.epicN = { blue: 0, red: 0 };
    this.champs = players.map((p) => this.makeChamp(p));
    for (const s of STRUCTS) this.makeStruct(s);
    this.camps = CAMPS.map((c, i) => ({ i, ...c, def: MONS[c.id], at2: c.at, nextAt: CAMP_FIRST, mons: [] }));
    this.camps.push(...EPICS.map((e, i) => ({ i: 100 + i, id: e.id, at: e.at, def: MONS[e.id], nextAt: MONS[e.id].first, mons: [], epic: true })));
    this.refreshVision();
  }
  // ---------- 만들기 ----------
  unit(o) { const u = { id: this.next++, alive: true, fx: {}, buffs: [], shields: [], dots: [], hitBy: new Map(), cd: 0, attackT: 0, windup: 0, target: null, path: null, r: 0.7, lastHit: -99, ...o }; this.units.push(u); return u; }
  makeChamp(p) {
    const def = champById(p.champ) || CHAMPS[0], f = FOUNTAIN[p.team];
    const u = this.unit({ kind: 'champ', pid: p.id, name: p.name, team: p.team, def, role: p.role, bot: !!p.bot, skill: p.skill ?? 0.6, color: p.color, x: f[0], z: f[1], level: 1, xp: 0, gold: 500, items: [], rank: { q: 0, w: 0, e: 0, r: 0 }, pts: 1, cds: { q: 0, w: 0, e: 0, r: 0, d: 0, f: 0 }, spell: SPELL_OF_ROLE[p.role] || 'ignite', k: 0, de: 0, a: 0, cs: 0, potions: 2, potT: 0, wards: 2, wardT: 0, respawnAt: 0, atkN: 0, stackAs: 0, stackT: 0, nextMul: 1, spellblade: false, lane: p.role === 'jungle' ? null : p.role === 'sup' ? 'bot' : p.role, think: this.R() * 0.3, dealt: 0 });
    u.s = {}; this.recalc(u); u.hp = u.s.hp; u.mp = u.s.mp;
    if (u.bot) { u.rank.q = 1; u.pts = 0; this.botBuy(u); }
    return u;
  }
  makeStruct(s) {
    const hp = s.k === 'heart' ? HEART_HP : s.k === 'gate' ? GATE_HP : STRUCT_HP[s.tier];
    return this.unit({ kind: s.k, team: s.team, lane: s.lane, tier: s.tier || 0, x: s.at[0], z: s.at[1], hp, max: hp, ar: 45, mr: 45, r: s.k === 'heart' ? 3.2 : s.k === 'gate' ? 2.4 : 1.6, reload: 0, baseAd: 150 + (s.tier === 4 ? 50 : (s.tier || 1) * 15) });
  }
  // ---------- 능력치 ----------
  recalc(u) {
    const c = u.def.stats, L = u.level - 1, s = u.s;
    s.hp = c.hp[0] + c.hp[1] * L; s.mp = c.mp[0] + c.mp[1] * L; s.ad = c.ad[0] + c.ad[1] * L; s.ap = c.ap[0] + c.ap[1] * L; s.ar = c.ar[0] + c.ar[1] * L; s.mr = c.mr[0] + c.mr[1] * L;
    s.as = c.as[0] + c.as[1] * L; s.ms = c.ms; s.range = c.range; s.reg = c.reg[0] + c.reg[1] * L; s.haste = 0; s.crit = 0; s.lifesteal = 0; s.arp = 0; s.mpen = 0; s.siege = 0;
    const add = (a, mul = 1) => { for (const k in a) if (k in s) s[k] += a[k] * mul; };
    for (const id of u.items) add(ITEMS[id].add);
    for (const b of u.buffs) add(b.stats);
    const tb = this.teamBuff[u.team];
    if (tb.honey) { s.ad *= 1 + 0.12 * tb.honey; s.ap *= 1 + 0.12 * tb.honey; }
    if (tb.moldUntil > this.t) { s.ad += 30; s.ap += 30; }
    const pv = u.def.passive;
    if (pv.kind === 'rage' && u.hp != null) s.ad *= 1 + pv.v * (1 - u.hp / s.hp);
    if (pv.kind === 'stackas') s.as += pv.v * u.stackAs;
    if (u.aura) s.ms += u.aura;
    s.as = Math.min(2.5, s.as);
    let slow = u.fx.slowK && u.fx.slowT > this.t ? u.fx.slowK : 0;
    s.moveSpeed = Math.max(1.5, s.ms * (1 - slow));
  }
  // ---------- 사건 ----------
  emit(team, e) { (team ? [team] : ['blue', 'red']).forEach((t) => this.ev[t].push(e)); }
  // 이 자리가 보이는 팀에게만
  emitSeen(u, e) { for (const t of ['blue', 'red']) if (t === u.team || this.vis[t].has(u.id)) this.ev[t].push(e); }
  take(team) { const e = this.ev[team]; this.ev[team] = []; return e; }

  // ---------- 명령 ----------
  champOf(pid) { return this.champs.find((c) => c.pid === pid); }
  cmd(pid, m) {
    const u = this.champOf(pid); if (!u || this.over) return;
    const num = (v) => (Number.isFinite(+v) ? clamp(+v, -90, 90) : null);
    switch (m.t) {
      case 'mv': { const x = num(m.x), z = num(m.z); if (x == null || z == null || !u.alive) return; u.target = null; u.amove = null; u.moveTo = { x, z }; u.path = null; return; }
      case 'amove': { const x = num(m.x), z = num(m.z); if (x == null || z == null || !u.alive) return; u.target = null; u.amove = { x, z }; u.moveTo = { x, z }; u.path = null; return; }
      case 'atk': { const t = this.units.find((q) => q.id === +m.id); if (t && t.team !== u.team && t.alive && u.alive && this.canSee(u.team, t)) { u.target = t; u.moveTo = null; u.amove = null; u.path = null; } return; }
      case 'stop': u.target = null; u.moveTo = null; u.amove = null; u.path = null; return;
      case 'cast': return this.cast(u, String(m.s), num(m.x) ?? u.x, num(m.z) ?? u.z, +m.id || 0);
      case 'spell': return this.useSpell(u, m.s === 'f' ? 'f' : 'd', num(m.x) ?? u.x, num(m.z) ?? u.z, +m.id || 0);
      case 'lvl': return this.levelSkill(u, String(m.s));
      case 'buy': return this.buy(u, String(m.it));
      case 'sell': return this.sell(u, m.i | 0);
      case 'potion': return this.drink(u);
      case 'ward': { const x = num(m.x), z = num(m.z); if (x == null || z == null) return; return this.placeWard(u, x, z); }
    }
  }
  levelSkill(u, s) {
    if (u.pts <= 0 || !(s in u.rank)) return;
    if (s === 'r') { if (u.rank.r >= 3 || u.level < R_LEVELS[u.rank.r]) return; }
    else if (u.rank[s] >= 5 || u.rank[s] >= Math.ceil(u.level / 2)) return;
    u.rank[s]++; u.pts--;
  }
  inBase(u) { return d2(u, { x: FOUNTAIN[u.team][0], z: FOUNTAIN[u.team][1] }) < 18; }
  buy(u, id) {
    const it = ITEMS[id]; if (!it || !this.inBase(u) && u.alive) return;
    if (u.gold < it.cost) return;
    if (it.use) { if (u.potions >= 5) return; u.gold -= it.cost; u.potions++; return; }
    if (it.tag === 'boots') { const old = u.items.findIndex((q) => ITEMS[q].tag === 'boots'); if (old >= 0) { if (u.items[old] === id) return; const back = Math.round(ITEMS[u.items[old]].cost * 0.7); u.gold += back; u.items.splice(old, 1); } }
    if (u.items.length >= 6) return;
    u.gold -= it.cost; u.items.push(id); this.recalc(u);
  }
  sell(u, i) { const id = u.items[i]; if (!id || !this.inBase(u)) return; u.gold += Math.round(ITEMS[id].cost * 0.7); u.items.splice(i, 1); this.recalc(u); u.hp = Math.min(u.hp, u.s.hp); }
  drink(u) { if (u.potions <= 0 || !u.alive || u.potT > 0) return; u.potions--; u.potT = 10; }
  placeWard(u, x, z) { if (u.wards <= 0 || !u.alive || Math.hypot(x - u.x, z - u.z) > 10 || blocked(x, z)) return; u.wards--; this.unit({ kind: 'ward', team: u.team, x, z, hp: 3, max: 3, until: this.t + 75, r: 0.4, owner: u.id }); this.emit(u.team, { k: 'ward', x, z }); }

  // ---------- 기술 ----------
  spec(u, s) { return u.def.skills[s]; }
  isCC(u) { return (u.fx.stunT || 0) > this.t; }
  cast(u, s, x, z, id) {
    const sk = this.spec(u, s); if (!sk || !u.alive || u.rank[s] <= 0 || u.cds[s] > 0 || this.isCC(u) || (u.fx.silT || 0) > this.t || u.dash) return false;
    if (u.mp < sk.mana) return false;
    const rank = u.rank[s] - 1;
    let target = id ? this.units.find((q) => q.id === id && q.alive) : null;
    const dx0 = x - u.x, dz0 = z - u.z, L0 = Math.hypot(dx0, dz0) || 1, fx = dx0 / L0, fz = dz0 / L0;
    if (sk.kind === 'hit') {
      if (!target || target.team === u.team || !this.hitable(target) || !this.canSee(u.team, target)) target = this.nearestEnemy(u, x, z, 5, (q) => this.canSee(u.team, q) && q.kind !== 'ward');
      if (!target || d2(u, target) > sk.range + target.r) return false;
    }
    u.mp -= sk.mana; u.cds[s] = sk.cd * (1 - Math.min(0.5, u.s.haste)); u.stealthT = 0; u.fx.stealth = 0;
    const baseDmg = (sk.dmg?.[rank] || 0) + (sk.ad || 0) * u.s.ad + (sk.ap || 0) * u.s.ap;
    const pack = { src: u, dmg: baseDmg, type: sk.type || 'magic', on: sk.on, sk, rank };
    this.emitSeen(u, { k: 'cast', id: u.id, s, c: sk.kind, col: sk.color, x, z, ic: sk.icon });
    const pv = u.def.passive;
    if (pv.kind === 'spellblade') u.spellblade = true;
    if (pv.kind === 'msburst') u.buffs.push({ stats: { ms: pv.v }, until: this.t + 1.5 });
    switch (sk.kind) {
      case 'shot': {
        const n = sk.fan || 1;
        for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.22, c = Math.cos(a), si = Math.sin(a); this.fire(u, fx * c - fz * si, fz * c + fx * si, sk, pack, s); }
        break;
      }
      case 'aoe': { const R = Math.min(sk.range, L0), ax = u.x + fx * R, az = u.z + fz * R; this.aoes.push({ x: ax, z: az, at: this.t + sk.delay, r: sk.radius, pack, team: u.team }); this.emit(null, { k: 'aoe', x: ax, z: az, r: sk.radius, d: sk.delay, col: sk.color, team: u.team, id: u.id }); break; }
      case 'nova': this.burst(u.x, u.z, sk.radius, pack); this.emitSeen(u, { k: 'nova', x: u.x, z: u.z, r: sk.radius, col: sk.color, id: u.id }); if (sk.healMissing) this.heal(u, u, (u.s.hp - u.hp) * sk.healMissing); break;
      case 'cone': { let hits = 0; for (const t of this.targets(u)) { const dx = t.x - u.x, dz = t.z - u.z, L = Math.hypot(dx, dz) || 1; if (L < sk.range + t.r && (dx * fx + dz * fz) / L > sk.arc) { this.hitBy(pack, t); hits++; } } this.emitSeen(u, { k: 'cone', x: u.x, z: u.z, fx, fz, r: sk.range, arc: sk.arc, col: sk.color, id: u.id }); break; }
      case 'zone': { const R = Math.min(sk.range, L0), ax = sk.follow ? u.x : u.x + fx * R, az = sk.follow ? u.z : u.z + fz * R; const zn = { x: ax, z: az, r: sk.radius, until: this.t + sk.dur, tick: 0, pack, team: u.team, follow: sk.follow ? u : null, tickDmg: baseDmg / 2 }; this.zones.push(zn); this.emit(null, { k: 'zone', x: ax, z: az, r: sk.radius, d: sk.dur, col: sk.color, team: u.team, follow: sk.follow ? u.id : 0 }); if (sk.stats) u.buffs.push({ stats: sk.stats, until: zn.until }); break; }
      case 'dash': {
        const R = Math.min(sk.range, L0), dirx = sk.back ? -fx : fx, dirz = sk.back ? -fz : fz, lim = sk.back ? sk.range : Math.max(2.5, R);
        let tx = u.x + dirx * lim, tz = u.z + dirz * lim;
        // 먼 도약은 막힌 곳을 넘어 간다: 닿을 수 있는 가장 먼 자리
        for (let k = 0; k < 20 && blocked(tx, tz); k++) { tx -= dirx * 0.8; tz -= dirz * 0.8; }
        u.dash = { tx, tz, speed: sk.speed, pack, r: sk.radius || 2.4, hit: new Set(), buffNext: sk.buffNext };
        u.path = null; u.moveTo = null; u.target = sk.back ? u.target : u.target;
        this.emitSeen(u, { k: 'dash', id: u.id, tx, tz, col: sk.color });
        break;
      }
      case 'blink': { const R = Math.min(sk.range, L0); let tx = u.x + fx * R, tz = u.z + fz * R; for (let k = 0; k < 20 && blocked(tx, tz); k++) { tx -= fx * 0.8; tz -= fz * 0.8; } this.emit(null, { k: 'blink', x: u.x, z: u.z, tx, tz, col: sk.color, team: u.team }); u.x = tx; u.z = tz; u.path = null; break; }
      case 'hit': {
        if (sk.jump) { const dx = u.x - target.x, dz = u.z - target.z, L = Math.hypot(dx, dz) || 1; let tx = target.x + (dx / L) * 1.8, tz = target.z + (dz / L) * 1.8; if (!blocked(tx, tz)) { this.emit(null, { k: 'blink', x: u.x, z: u.z, tx, tz, col: sk.color, team: u.team }); u.x = tx; u.z = tz; u.path = null; } }
        let dmg = baseDmg; if (sk.execute) dmg *= 1 + sk.execute * (1 - target.hp / this.maxOf(target));
        this.deal(u, target, dmg, pack.type, { skill: true, on: sk.on });
        if (sk.healHit) this.heal(u, u, dmg * sk.healHit);
        this.emitSeen(u, { k: 'hit', id: u.id, to: target.id, col: sk.color });
        u.target = target; u.moveTo = null;
        break;
      }
      case 'buff': {
        const stats = { ...(sk.stats || {}) }; if (sk.statsUp) for (const k of Object.keys(stats)) if (k === 'ad' || k === 'ar' || k === 'mr') stats[k] += sk.statsUp * rank; else if (k === 'as') stats[k] += (sk.statsUp > 1 ? 0.05 : sk.statsUp) * rank;
        u.buffs.push({ stats, until: this.t + sk.dur });
        if (sk.shield) u.shields.push({ v: sk.shield[rank] + (sk.shieldAp || 0) * u.s.ap, until: this.t + sk.dur });
        if (sk.stealth) { u.fx.stealth = this.t + sk.dur; u.stealthT = this.t + sk.dur; }
        this.emitSeen(u, { k: 'buff', id: u.id, col: sk.color, d: sk.dur, ic: sk.icon });
        break;
      }
      case 'ally': {
        const list = sk.global ? this.champs.filter((c) => c.team === u.team && c.alive) : sk.radius ? this.champs.filter((c) => c.team === u.team && c.alive && d2(c, u) < sk.radius) : [this.bestAlly(u, x, z, sk.range)];
        for (const c of list) {
          if (sk.heal) this.heal(u, c, sk.heal[rank] + (sk.healAp || 0) * u.s.ap);
          if (sk.shield) c.shields.push({ v: sk.shield[rank] + (sk.shieldAp || 0) * u.s.ap, until: this.t + (sk.dur || 3) });
          if (sk.teamBuff) c.buffs.push({ stats: sk.teamBuff, until: this.t + (sk.dur || 4) });
          this.emit(c.team, { k: 'buff', id: c.id, col: sk.color, d: 1, ic: sk.icon }); this.emit(OTHER[c.team], this.vis[OTHER[c.team]].has(c.id) ? { k: 'buff', id: c.id, col: sk.color, d: 1, ic: sk.icon } : { k: 'x' });
        }
        break;
      }
    }
    return true;
  }
  bestAlly(u, x, z, range) { let best = u, bd = 1e9; for (const c of this.champs) { if (c.team !== u.team || !c.alive || d2(c, u) > range) continue; const d = Math.hypot(c.x - x, c.z - z) + (c === u ? 3 : 0); if (d < bd) { bd = d; best = c; } } return best; }
  fire(u, fx, fz, sk, pack, s) {
    const sh = { x: u.x, z: u.z, fx, fz, speed: sk.speed, left: sk.range, w: sk.width, pack, team: u.team, hit: new Set(), pierce: sk.pierce, burst: sk.burst, pull: sk.pull, sid: this.next++, col: sk.color };
    this.shots.push(sh);
    this.emit(null, { k: 'shot', id: sh.sid, x: u.x, z: u.z, fx, fz, v: sk.speed, L: sk.range, w: sk.width, col: sk.color, team: u.team, ic: sk.icon, big: sk.width > 2 });
  }
  useSpell(u, slot, x, z, id) {
    if (!u.alive || u.cds[slot] > 0 || this.isCC(u)) return;
    const name = slot === 'd' ? 'flash' : u.spell, S = SPELLS[name];
    if (name === 'flash') { const L = Math.hypot(x - u.x, z - u.z) || 1, R = Math.min(S.range, L); let tx = u.x + (x - u.x) / L * R, tz = u.z + (z - u.z) / L * R; const fx = (x - u.x) / L, fz = (z - u.z) / L; for (let k = 0; k < 16 && blocked(tx, tz); k++) { tx -= fx * 0.7; tz -= fz * 0.7; } this.emit(null, { k: 'blink', x: u.x, z: u.z, tx, tz, col: '#fff3a0', team: u.team }); u.x = tx; u.z = tz; u.path = null; u.dash = null; }
    else if (name === 'smite') { const t = (id && this.units.find((q) => q.id === id && q.alive)) || this.nearestAny(u, x, z, 8, (q) => q.kind === 'mon' || (q.kind === 'minion' && q.team !== u.team)); if (!t || (t.kind !== 'mon' && t.kind !== 'minion') || d2(u, t) > S.range + 2 || t.team === u.team) return; this.deal(u, t, 450 + 40 * u.level, 'true', { skill: true }); this.emit(null, { k: 'smite', to: t.id, x: t.x, z: t.z }); }
    else if (name === 'heal') { for (const c of this.champs) if (c.team === u.team && c.alive && d2(c, u) < 10) { this.heal(u, c, 120 + 18 * u.level); c.buffs.push({ stats: { ms: 1.8 }, until: this.t + 1.5 }); this.emit(c.team, { k: 'buff', id: c.id, col: '#9be7a7', d: 1, ic: '💗' }); } }
    else if (name === 'ignite') { const t = (id && this.units.find((q) => q.id === id && q.alive)) || this.nearestAny(u, x, z, 6, (q) => q.kind === 'champ' && q.team !== u.team && this.canSee(u.team, q)); if (!t || t.kind !== 'champ' || t.team === u.team || d2(u, t) > S.range) return; t.dots.push({ dps: (60 + 20 * u.level) / 3, until: this.t + 3, by: u, tick: 0, ic: 1 }); this.emit(null, { k: 'ignite', to: t.id }); }
    u.cds[slot] = S.cd;
  }
  targets(u) { return this.units.filter((q) => q.team !== u.team && q.alive && this.hitable(q)); }
  hitable(q) { return q.kind === 'champ' || q.kind === 'minion' || q.kind === 'mon'; }
  burst(x, z, r, pack) { for (const t of this.units) if (t.team !== pack.src.team && t.alive && this.hitable(t) && Math.hypot(t.x - x, t.z - z) < r + t.r) this.hitBy(pack, t); }
  hitBy(pack, t, mul = 1) {
    const sk = pack.sk, src = pack.src;
    if (pack.dmg > 0) this.deal(src, t, pack.dmg * mul, pack.type, { skill: true, on: sk.on }); else if (sk.on) this.applyOn(src, t, sk.on);
    if (sk.healHit && pack.dmg) this.heal(src, src, pack.dmg * sk.healHit);
  }
  applyOn(src, t, on) {
    if (!on || !t.alive) return;
    if (on.stun) { t.fx.stunT = Math.max(t.fx.stunT || 0, this.t + on.stun); t.dash = null; t.path = null; this.emit(null, { k: 'cc', to: t.id, c: 'stun', d: on.stun }); }
    if (on.knock) { t.fx.stunT = Math.max(t.fx.stunT || 0, this.t + on.knock); t.fx.airT = this.t + on.knock; t.dash = null; this.emit(null, { k: 'cc', to: t.id, c: 'knock', d: on.knock }); }
    if (on.root) { t.fx.rootT = Math.max(t.fx.rootT || 0, this.t + on.root); this.emit(null, { k: 'cc', to: t.id, c: 'root', d: on.root }); }
    if (on.slow) { t.fx.slowK = Math.max(t.fx.slowT > this.t ? t.fx.slowK : 0, on.slow); t.fx.slowT = this.t + (on.slowT || 1.5); }
    if (on.burn && src.s) t.dots.push({ dps: on.burn, until: this.t + 2, by: src, tick: 0 });
    if (on.silence) t.fx.silT = this.t + on.silence;
  }
  nearestEnemy(u, x, z, r, f) { return this.nearestAny(u, x, z, r, (q) => q.team !== u.team && this.hitable(q) && (!f || f(q))); }
  nearestAny(u, x, z, r, f) { let best = null, bd = r; for (const q of this.units) { if (!q.alive || !f(q)) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; }
  maxOf(t) { return t.kind === 'champ' ? t.s.hp : t.max; }
  heal(src, t, n) { if (!t.alive || n <= 0) return; const v = Math.min(this.maxOf(t) - t.hp, n); t.hp += v; if (v > 1 && t.kind === 'champ') this.emit(t.team, { k: 'dmg', to: t.id, n: Math.round(v), ty: 'heal' }); if (src.def?.passive.kind === 'sharedheal' && src !== t) { const a = Math.min(src.s.hp - src.hp, n * src.def.passive.v); src.hp += a; } }

  // ---------- 피해 ----------
  deal(src, t, amt, type, o = {}) {
    if (!t.alive || amt <= 0) return 0;
    if (t.kind === 'tower' || t.kind === 'gate' || t.kind === 'heart') { if (this.invuln(t)) return 0; if (!o.basic) return 0; if (!this.minionsNear(t)) amt *= 0.45; }
    const sp = src.s || {};
    const pv = src.def?.passive;
    if (pv) {
      if (pv.kind === 'isolate' && t.kind === 'champ' && !this.units.some((q) => q !== t && q.alive && q.team === t.team && (q.kind === 'champ' || q.kind === 'minion') && d2(q, t) < 6)) amt *= 1 + pv.v;
      if (pv.kind === 'lowhp' && t.kind === 'champ' && t.hp / t.s.hp < 0.35) amt *= 1 + pv.v;
      if (pv.kind === 'mark' && o.basic && (t.fx.markT || 0) > this.t) amt *= 1 + pv.v;
      if (o.skill) {
        if (pv.kind === 'burn' && src.s) t.dots.push({ dps: amt * pv.v / 2, until: this.t + 2, by: src, tick: 0 });
        if (pv.kind === 'frost') { t.fx.slowK = Math.max(t.fx.slowT > this.t ? t.fx.slowK : 0, pv.v); t.fx.slowT = this.t + 1; }
        if (pv.kind === 'mark') t.fx.markT = this.t + 4;
      }
    }
    if (o.basic && sp.siege && t.max && t.kind !== 'minion' && t.kind !== 'mon') amt *= 1 + sp.siege;
    let res = type === 'phys' ? (t.s ? t.s.ar : t.ar || 0) * (1 - (sp.arp || 0)) : type === 'magic' ? (t.s ? t.s.mr : t.mr || 0) * (1 - (sp.mpen || 0)) : 0;
    let dmg = amt * (100 / (100 + Math.max(0, res)));
    if (t.def?.passive.kind === 'armor') dmg *= 1 - t.def.passive.v;
    // 보호막이 먼저
    for (const b of t.shields) { if (b.v <= 0) continue; const a = Math.min(b.v, dmg); b.v -= a; dmg -= a; if (dmg <= 0) break; }
    t.hp -= dmg; t.lastHit = this.t;
    if (src.kind === 'champ') {
      src.lastCombat = this.t; src.revealT = this.t + 1.5; if (t.kind === 'champ') { src.dealt += dmg; t.hitBy.set(src.id, this.t); t.lastCombat = this.t; }
      if (o.basic && sp.lifesteal) this.heal(src, src, dmg * sp.lifesteal);
      if (src.fx.stealth) { src.fx.stealth = 0; }
    }
    if (o.on) this.applyOn(src, t, o.on);
    this.emitDamage(src, t, dmg, type, o.crit);
    if (t.kind === 'mon' && !t.aggro) t.aggro = src;
    if (t.kind === 'mon') t.aggro = t.aggro?.alive ? t.aggro : src;
    if (t.kind === 'minion' && src.kind === 'champ') t.lastHitChamp = src;
    if (t.hp <= 0) this.die(t, src);
    return dmg;
  }
  emitDamage(src, t, n, ty, crit) {
    const e = { k: 'dmg', to: t.id, n: Math.round(n), ty, crit: crit ? 1 : 0, by: src.id };
    if (src.kind === 'champ' || t.kind === 'champ') this.emit(null, e);
  }
  invuln(t) {
    const dead = this.towerDead[t.team], lane = t.lane;
    if (t.kind === 'tower') { if (t.tier === 1) return false; if (t.tier <= 3) return !dead[`${lane}${t.tier - 1}`]; return !Object.keys(this.gates[t.team]).length; }
    if (t.kind === 'gate') return !dead[`${lane}3`];
    if (t.kind === 'heart') return !(dead.base >= 2);
    return false;
  }
  minionsNear(t) { return this.units.some((q) => q.kind === 'minion' && q.alive && q.team !== t.team && d2(q, t) < 13); }
  die(t, src) {
    t.alive = false; t.hp = 0; t.dash = null;
    const killer = src.kind === 'champ' ? src : null;
    switch (t.kind) {
      case 'champ': {
        t.de++; t.respawnAt = this.t + 6 + t.level * 1.5 + this.t / 240; t.target = null; t.moveTo = null; t.path = null; t.amove = null; t.buffs = []; t.shields = []; t.dots = []; t.dieT = this.t;
        const ks = t.streak || 0; t.streak = 0;
        const bounty = 300 + Math.min(300, ks * 60);
        const assists = [...t.hitBy.entries()].filter(([id, at]) => this.t - at < 12 && id !== killer?.id).map(([id]) => this.units.find((q) => q.id === id)).filter((q) => q && q.kind === 'champ');
        if (killer && killer.team !== t.team) {
          killer.k++; killer.streak = (killer.streak || 0) + 1; this.kills[killer.team]++; this.give(killer, bounty + (killer.def.passive.kind === 'killgold' ? killer.def.passive.v : 0), t);
          this.giveXp(killer, 120 + t.level * 40);
        }
        for (const a of assists) if (a.team !== t.team) { a.a++; this.give(a, Math.round(bounty * 0.4 / Math.max(1, assists.length)), t); this.giveXp(a, 40 + t.level * 16); }
        t.hitBy.clear();
        this.emit(null, { k: 'kill', by: killer?.id || 0, byName: killer?.name || (src.kind === 'tower' ? '포탑' : src.kind === 'minion' ? '꼬마' : '몬스터'), byC: killer?.def.emoji || (src.kind === 'tower' ? '🗼' : '👶'), to: t.id, toName: t.name, toC: t.def.emoji, team: t.team, as: assists.length, sk: killer?.streak || 0, x: t.x, z: t.z });
        break;
      }
      case 'minion': {
        // 꼬마: 마지막으로 친 챔피언만 금화 · CS
        if (killer && killer.team !== t.team) { killer.cs++; this.give(killer, t.gold + Math.floor(this.t / 90), t); }
        for (const c of this.champs) if (c.team !== t.team && c.alive && d2(c, t) < 16) this.giveXp(c, t.xpv / (this.champs.filter((q) => q.team !== t.team && q.alive && d2(q, t) < 16).length || 1));
        break;
      }
      case 'mon': {
        const def = t.camp.def;
        if (t.big) {
          if (killer) { killer.cs += def.epic ? 4 : 4; this.give(killer, def.gold, t); this.giveXp(killer, def.xp); if (def.epic) this.epicKill(killer.team, t.camp); }
          t.camp.nextAt = this.t + def.respawn;
        } else if (killer) { killer.cs++; this.give(killer, 12, t); this.giveXp(killer, 22); }
        if (t.camp.mons.every((m) => m === t || !m.alive)) t.camp.mons = [];
        break;
      }
      case 'tower': case 'gate': case 'heart': {
        const team = t.team, side = OTHER[team];
        if (t.kind === 'tower') { if (t.tier === 4) this.towerDead[team].base = (this.towerDead[team].base || 0) + 1; else this.towerDead[team][`${t.lane}${t.tier}`] = 1; this.towers[side]++; for (const c of this.champs) if (c.team === side) { c.gold += 150; if (killer === c) c.gold += 100; } }
        if (t.kind === 'gate') { this.gates[team][t.lane] = 1; for (const c of this.champs) if (c.team === side) c.gold += 50; }
        this.emit(null, { k: 'fall', sk: t.kind, team, lane: t.lane, tier: t.tier, x: t.x, z: t.z, id: t.id, by: killer?.name || '꼬마들' });
        if (t.kind === 'heart') { this.over = { winner: side, at: this.t }; this.emit(null, { k: 'over', winner: side }); }
        break;
      }
    }
  }
  epicKill(team, camp) {
    this.epicN[team]++;
    const tb = this.teamBuff[team];
    if (camp.id === 'bee') tb.honey++;
    if (camp.id === 'mold') tb.moldUntil = this.t + 120;
    this.emit(null, { k: 'epic', id: camp.id, team, name: camp.def.name, icon: camp.def.emoji, buff: camp.def.buff });
  }
  give(c, n, at) { c.gold += n; this.emit(c.team, { k: 'gold', id: c.id, n, x: at.x, z: at.z }); }
  giveXp(c, n) {
    if (c.level >= MAX_LEVEL) return;
    c.xp += n;
    while (c.level < MAX_LEVEL && c.xp >= XP_NEED[c.level - 1]) {
      c.xp -= XP_NEED[c.level - 1]; c.level++; c.pts++;
      const hpK = c.hp / c.s.hp, mpK = c.mp / c.s.mp; this.recalc(c); c.hp = c.s.hp * hpK + 40; c.hp = Math.min(c.hp, c.s.hp); c.mp = c.s.mp * mpK;
      this.emit(null, { k: 'lvl', id: c.id, lv: c.level });
      if (c.bot) this.botLevel(c);
    }
  }

  // ---------- 시야 ----------
  bushOf(u) { for (let i = 0; i < BUSHES.length; i++) { const b = BUSHES[i]; if (Math.hypot(u.x - b[0], u.z - b[1]) < b[2]) return i; } return -1; }
  refreshVision() {
    for (const team of ['blue', 'red']) {
      const eyes = this.units.filter((q) => q.alive && q.team === team && VISION[q.kind]);
      const seen = new Set();
      for (const u of this.units) {
        if (!u.alive) continue;
        if (u.team === team) { seen.add(u.id); continue; }
        if (u.kind === 'tower' || u.kind === 'gate' || u.kind === 'heart') { seen.add(u.id); continue; } // 건물은 언제나 보인다
        const stealth = (u.fx.stealth || 0) > this.t, bush = u.kind === 'champ' ? this.bushOf(u) : -1, revealed = (u.revealT || 0) > this.t;
        for (const e of eyes) {
          const d = d2(e, u); if (d > VISION[e.kind]) continue;
          if (stealth && d > 3) continue;
          if (bush >= 0 && !revealed && this.bushOf(e) !== bush && e.kind !== 'ward') continue;
          seen.add(u.id); break;
        }
      }
      this.vis[team] = seen;
    }
  }
  canSee(team, u) { return u.team === team || this.vis[team].has(u.id); }

  // ---------- 매 틱 ----------
  tick(dt) {
    if (this.over) return;
    this.t += dt;
    if ((this.visT -= dt) <= 0) { this.visT = 0.2; this.refreshVision(); }
    if (this.t >= this.waveAt) { this.spawnWave(); this.waveAt += WAVE_EVERY; }
    for (const c of this.camps) if (!c.mons.length && this.t >= c.nextAt) this.spawnCamp(c);
    for (const c of this.champs) this.champTick(c, dt);
    this.units = this.units.filter((u) => u.alive || u.kind === 'champ');
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.kind === 'minion') this.minionTick(u, dt);
      else if (u.kind === 'tower') this.towerTick(u, dt);
      else if (u.kind === 'mon') this.monTick(u, dt);
      else if (u.kind === 'ward' && u.until <= this.t) { u.alive = false; }
      if (this.over) return;
    }
    this.shotTick(dt); this.zoneTick(dt);
    for (const a of this.aoes) if (a.at <= this.t) { a.done = true; this.burst(a.x, a.z, a.r, a.pack); this.emit(null, { k: 'boom', x: a.x, z: a.z, r: a.r, col: a.pack.sk.color }); }
    this.aoes = this.aoes.filter((a) => !a.done);
    this.separate(dt);
    for (const c of this.champs) if (c.bot && c.alive) { if ((c.think -= dt) <= 0) { c.think = 0.22 + (1 - c.skill) * 0.25; this.botThink(c); } }
    this.fountainTick(dt);
  }
  champTick(u, dt) {
    if (!u.alive) {
      if (this.t >= u.respawnAt) { const f = FOUNTAIN[u.team]; u.alive = true; u.x = f[0]; u.z = f[1]; this.recalc(u); u.hp = u.s.hp; u.mp = u.s.mp; u.fx = {}; this.emit(null, { k: 'spawn', id: u.id }); if (u.bot) this.botBuy(u); }
      else { for (const k in u.cds) u.cds[k] = Math.max(0, u.cds[k] - dt); return; }
    }
    for (const k in u.cds) u.cds[k] = Math.max(0, u.cds[k] - dt);
    u.buffs = u.buffs.filter((b) => b.until > this.t); u.shields = u.shields.filter((b) => b.until > this.t && b.v > 0);
    this.recalc(u);
    u.hp = Math.min(u.s.hp, u.hp + u.s.reg * dt); u.mp = Math.min(u.s.mp, u.mp + u.s.mp * 0.012 * dt + 0.8 * dt);
    if (u.potT > 0) { u.potT -= dt; u.hp = Math.min(u.s.hp, u.hp + 12 * dt); }
    const pv = u.def.passive;
    if (pv.kind === 'regen' && this.t - (u.lastCombat || -99) > 5) u.hp = Math.min(u.s.hp, u.hp + u.s.hp * pv.v * dt);
    if (u.stackT > 0) { u.stackT -= dt; if (u.stackT <= 0) u.stackAs = 0; }
    if ((u.wardT += dt) >= 70) { u.wardT = 0; u.wards = Math.min(2, u.wards + 1); }
    this.dotTick(u, dt); if (!u.alive) return;
    // 응원가: 근처에 노래새가 있으면 빨라진다
    u.aura = this.champs.some((c) => c !== u && c.team === u.team && c.alive && c.def.passive.kind === 'aura' && d2(c, u) < 12) ? 0.4 : 0;
    u.attackT -= dt;
    if (u.dash) return this.dashTick(u, dt);
    if (this.isCC(u)) return;
    // 공격 준비 중이면 잠깐 선다
    if (u.windup > 0) { u.windup -= dt; if (u.windup <= 0 && u.pending) { this.landAttack(u, u.pending); u.pending = null; } return; }
    if (u.target && (!u.target.alive || (u.target.team !== u.team && !this.canSee(u.team, u.target)))) { u.target = null; u.path = null; }
    // 공격 이동: 가다가 적을 만나면 공격
    if (u.amove && !u.target) { const t = this.acquire(u, u.s.range + 5); if (t) u.target = t; }
    if (u.target) {
      const t = u.target, reach = u.s.range + t.r + 0.2, d = d2(u, t);
      if (d <= reach) {
        u.path = null; u.face = Math.atan2(t.x - u.x, t.z - u.z);
        if (u.attackT <= 0 && this.attackable(t)) this.startAttack(u, t);
        return;
      }
      if ((u.fx.rootT || 0) > this.t) return;
      if (!u.path || (u.repath = (u.repath || 0) - dt) <= 0) { u.repath = 0.35; u.path = findPath(u.x, u.z, t.x, t.z); }
      this.follow(u, dt); return;
    }
    if (u.moveTo) {
      if (!u.path) { u.path = findPath(u.x, u.z, u.moveTo.x, u.moveTo.z); }
      if ((u.fx.rootT || 0) > this.t) return;
      this.follow(u, dt);
      if (!u.path?.length) { u.moveTo = null; u.amove = null; }
      return;
    }
    // 가만히 있으면 사거리 안의 적을 때린다 (사람만: 봇은 스스로 고른다)
    if (!u.bot && !(u.stopT > this.t)) { const t = this.acquire(u, u.s.range + 2); if (t) u.target = t; }
  }
  attackable(t) { return !((t.kind === 'tower' || t.kind === 'gate' || t.kind === 'heart') && this.invuln(t)); }
  acquire(u, r) {
    let best = null, bd = 1e9;
    for (const q of this.units) {
      if (!q.alive || q.team === u.team || !this.canSee(u.team, q)) continue;
      if (q.kind === 'ward') continue;
      const d = d2(u, q); if (d > r + q.r) continue;
      if (!this.attackable(q)) continue;
      const score = d + (q.kind === 'champ' ? -3 : q.kind === 'minion' ? 0 : 4);
      if (score < bd) { bd = score; best = q; }
    }
    return best;
  }
  startAttack(u, t) {
    const as = u.s.as; u.attackT = 1 / as; u.windup = 0.28 / as; u.pending = t;
    this.emitSeen(u, { k: 'atk', id: u.id, to: t.id, r: u.def.stats.proj ? 1 : 0, col: u.def.color });
  }
  landAttack(u, t) {
    if (!t.alive) return;
    u.atkN++;
    let dmg = u.s.ad, crit = false, type = 'phys';
    const pv = u.def.passive;
    if (this.R() < u.s.crit) { dmg *= 1.75; crit = true; }
    if (pv.kind === 'fourth' && u.atkN % 4 === 0) { dmg *= 1 + pv.v; crit = true; }
    if (pv.kind === 'third' && u.atkN % 3 === 0) dmg += u.s.ad * pv.v;
    if (u.nextMul > 1) { dmg *= u.nextMul; u.nextMul = 1; }
    if (pv.kind === 'stackas') { u.stackAs = Math.min(4, u.stackAs + 1); u.stackT = 3; }
    const delay = u.def.stats.proj ? d2(u, t) / 22 : 0;
    const land = () => {
      if (!t.alive || !u) return;
      this.deal(u, t, dmg, type, { basic: true, crit });
      if (pv.kind === 'onhitap' && t.alive) this.deal(u, t, u.s.ad * 0.15 + u.s.ap * pv.v, 'magic', {});
      if (pv.kind === 'spellblade' && u.spellblade && t.alive) { u.spellblade = false; this.deal(u, t, u.s.ad * pv.v, 'magic', {}); }
      if (pv.kind === 'splash') for (const q of this.units) if (q !== t && q.alive && q.team !== u.team && this.hitable(q) && d2(q, t) < 3) this.deal(u, q, dmg * pv.v, type, {});
    };
    if (delay > 0.04) this.later(delay, land); else land();
    if (u.amove || u.target === t) { /* 계속 */ }
  }
  later(d, f) { (this.lat ||= []).push({ at: this.t + d, f }); }
  follow(u, dt) {
    if (!u.path?.length) return;
    let step = u.s.moveSpeed * dt;
    while (step > 0 && u.path.length) {
      const [px, pz] = u.path[0], dx = px - u.x, dz = pz - u.z, L = Math.hypot(dx, dz);
      if (L <= step) { u.x = px; u.z = pz; step -= L; u.path.shift(); continue; }
      u.x += (dx / L) * step; u.z += (dz / L) * step; u.face = Math.atan2(dx, dz); step = 0;
    }
  }
  dashTick(u, dt) {
    const D = u.dash, dx = D.tx - u.x, dz = D.tz - u.z, L = Math.hypot(dx, dz), step = D.speed * dt;
    const stepTo = (x, z) => { u.x = x; u.z = z; };
    if (L <= step) { stepTo(D.tx, D.tz); } else { stepTo(u.x + (dx / L) * step, u.z + (dz / L) * step); u.face = Math.atan2(dx, dz); }
    if (D.pack.dmg > 0 || D.pack.sk.on) for (const t of this.units) { if (t.team === u.team || !t.alive || !this.hitable(t) || D.hit.has(t.id) || d2(t, u) > D.r + t.r) continue; D.hit.add(t.id); this.hitBy(D.pack, t); }
    if (L <= step) { if (D.buffNext) u.nextMul = D.buffNext; u.dash = null; this.emitSeen(u, { k: 'land', id: u.id, x: u.x, z: u.z, r: D.r, col: D.pack.sk.color }); }
  }
  dotTick(u, dt) {
    if (!u.dots.length) return;
    u.dots = u.dots.filter((b) => b.until > this.t && u.alive);
    for (const b of u.dots) { b.tick = (b.tick || 0) + dt; if (b.tick >= 0.5) { b.tick = 0; this.deal(b.by, u, b.dps * 0.5, 'true', {}); if (!u.alive) return; } }
  }
  shotTick(dt) {
    if (this.lat?.length) { const due = this.lat.filter((l) => l.at <= this.t); this.lat = this.lat.filter((l) => l.at > this.t); for (const l of due) l.f(); }
    for (const sh of this.shots) {
      const step = sh.speed * dt; sh.x += sh.fx * step; sh.z += sh.fz * step; sh.left -= step;
      for (const t of this.units) {
        if (t.team === sh.team || !t.alive || !this.hitable(t) || sh.hit.has(t.id)) continue;
        if (Math.hypot(t.x - sh.x, t.z - sh.z) > sh.w + t.r) continue;
        sh.hit.add(t.id);
        if (sh.burst) { this.burst(sh.x, sh.z, sh.burst, sh.pack); this.emit(null, { k: 'boom', x: sh.x, z: sh.z, r: sh.burst, col: sh.col }); sh.done = true; break; }
        this.hitBy(sh.pack, t);
        if (sh.pull && t.alive) { const src = sh.pack.src, dx = t.x - src.x, dz = t.z - src.z, L = Math.hypot(dx, dz) || 1; t.dash = null; const nx = src.x + dx / L * 1.8, nz = src.z + dz / L * 1.8; if (!blocked(nx, nz)) { this.emit(null, { k: 'blink', x: t.x, z: t.z, tx: nx, tz: nz, col: sh.col, team: t.team }); t.x = nx; t.z = nz; t.path = null; } }
        if (!sh.pierce) { sh.done = true; this.emit(null, { k: 'pop', x: sh.x, z: sh.z, col: sh.col, id: sh.sid }); break; }
        sh.dmgMul = (sh.dmgMul || 1) * 0.85;
      }
      if (sh.left <= 0) { sh.done = true; if (sh.burst) { this.burst(sh.x, sh.z, sh.burst, sh.pack); this.emit(null, { k: 'boom', x: sh.x, z: sh.z, r: sh.burst, col: sh.col }); } }
    }
    this.shots = this.shots.filter((s) => !s.done);
  }
  zoneTick(dt) {
    for (const z of this.zones) {
      if (z.follow) { if (!z.follow.alive) { z.until = 0; continue; } z.x = z.follow.x; z.z = z.follow.z; }
      z.tick -= dt;
      if (z.tick <= 0) { z.tick = 0.5; const p = z.pack; for (const t of this.units) { if (t.team === z.team || !t.alive || !this.hitable(t) || Math.hypot(t.x - z.x, t.z - z.z) > z.r + t.r) continue; if (z.tickDmg > 0) this.deal(p.src, t, z.tickDmg, p.type, { skill: true, on: p.sk.on }); else this.applyOn(p.src, t, p.sk.on); } }
    }
    this.zones = this.zones.filter((z) => z.until > this.t);
  }
  fountainTick(dt) {
    for (const c of this.champs) {
      if (!c.alive) continue;
      const f = FOUNTAIN[c.team];
      if (Math.hypot(c.x - f[0], c.z - f[1]) < 12) { c.hp = Math.min(c.s.hp, c.hp + c.s.hp * 0.12 * dt); c.mp = Math.min(c.s.mp, c.mp + c.s.mp * 0.15 * dt); }
      const ef = FOUNTAIN[OTHER[c.team]];
      if (Math.hypot(c.x - ef[0], c.z - ef[1]) < 12) { c.hp -= 400 * dt; if (c.hp <= 0) this.die(c, this.units.find((q) => q.kind === 'heart' && q.team !== c.team) || { kind: 'tower' }); }
    }
  }
  // 겹치지 않게 살짝 밀어낸다 (꼬마 · 몬스터끼리)
  separate(dt) {
    const list = this.units.filter((u) => u.alive && (u.kind === 'minion' || u.kind === 'mon'));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], dx = a.x - b.x, dz = a.z - b.z, L = Math.hypot(dx, dz) || 0.01, R = a.r + b.r;
      if (L >= R) continue;
      const k = ((R - L) / L) * 0.5 * Math.min(1, dt * 8); const ax = a.x + dx * k, az = a.z + dz * k, bx = b.x - dx * k, bz = b.z - dz * k;
      if (!blocked(ax, az)) { a.x = ax; a.z = az; } if (!blocked(bx, bz)) { b.x = bx; b.z = bz; }
    }
  }

  // ---------- 건물 ----------
  towerTick(t, dt) {
    if ((t.reload -= dt) > 0) return;
    // 아군 챔피언을 때린 적 챔피언 → 꼬마 → 챔피언 순
    const near = this.units.filter((q) => q.alive && q.team !== t.team && (q.kind === 'champ' || q.kind === 'minion') && d2(q, t) < TOWER_RANGE && this.canSee(t.team, q));
    if (!near.length) return;
    const allies = this.champs.filter((c) => c.team === t.team && c.alive && d2(c, t) < TOWER_RANGE + 4);
    const agg = near.find((q) => q.kind === 'champ' && (q.lastCombat || -9) > this.t - 1 && allies.some((a) => a.hitBy.get(q.id) > this.t - 2));
    const pick = agg || (t.cur?.alive && near.includes(t.cur) ? t.cur : null) || near.filter((q) => q.kind === 'minion').sort((a, b) => d2(a, t) - d2(b, t))[0] || near.sort((a, b) => d2(a, t) - d2(b, t))[0];
    t.cur = pick; t.reload = 0.95;
    const ad = t.baseAd + this.t / 60 * 8;
    const dmg = pick.kind === 'minion' ? pick.max * (pick.type === 'siege' ? 0.14 : pick.type === 'super' ? 0.06 : 0.42) : ad;
    this.emit(null, { k: 'tshot', id: t.id, to: pick.id, team: t.team });
    this.later(d2(t, pick) / 34, () => { if (pick.alive && t.alive) this.deal(t, pick, dmg, 'phys', {}); });
  }

  // ---------- 꼬마 ----------
  spawnWave() {
    this.waveN++;
    for (const team of ['blue', 'red']) for (const lane of Object.keys(LANES)) {
      const path = team === 'blue' ? LANES[lane] : [...LANES[lane]].reverse();
      const sup = this.gates[OTHER[team]][lane]; // 상대 수문을 부수면 슈퍼 꼬마
      const types = ['melee', 'melee', 'melee', ...(this.waveN % 3 === 0 ? ['siege'] : []), 'caster', 'caster', 'caster'];
      if (sup) types.unshift('super');
      types.forEach((ty, i) => setTimeoutLike(this, i * 0.45, () => this.spawnMinion(team, lane, path, ty)));
    }
  }
  spawnMinion(team, lane, path, ty) {
    if (this.over) return;
    const M = ME[ty], g = this.t / 60, tb = this.teamBuff[team], mold = tb.moldUntil > this.t ? 1.5 : 1;
    const [sx, sz] = path[1]; const dir = [path[1][0] - path[0][0], path[1][1] - path[0][1]], L = Math.hypot(...dir) || 1;
    const hp = (M.hp + g * (ty === 'super' ? 60 : 16)) * mold;
    this.unit({ kind: 'minion', type: ty, team, lane, lanePts: path, wp: 1, x: path[0][0] + (dir[0] / L) * 16 + (this.R() - 0.5) * 2, z: path[0][1] + (dir[1] / L) * 16 + (this.R() - 0.5) * 2, hp, max: hp, ad: (M.ad + g * 1.6) * mold, ar: M.ar, mr: M.mr, as: M.as, ms: M.ms, range: M.range, gold: M.gold, xpv: M.xp, proj: M.proj, r: ty === 'super' ? 1 : ty === 'siege' ? 0.9 : 0.6, reload: 0 });
  }
  minionTick(u, dt) {
    u.reload -= dt;
    if ((u.fx.stunT || 0) > this.t) return;
    u.dots.length && this.dotTick(u, dt); if (!u.alive) return;
    // 다시 고르기 (0.3초마다)
    if ((u.pickT = (u.pickT || 0) - dt) <= 0 || !u.target?.alive) {
      u.pickT = 0.3; let best = null, bs = 1e9;
      for (const q of this.units) {
        if (!q.alive || q.team === u.team || q.kind === 'ward') continue;
        const d = d2(u, q); if (d > 11) continue;
        if ((q.kind === 'tower' || q.kind === 'gate' || q.kind === 'heart') && this.invuln(q)) continue;
        if (q.kind === 'champ' && !this.vis[u.team].has(q.id)) continue;
        if (q.kind === 'mon') continue;
        // 우리 챔피언을 때리는 적 챔피언이 먼저, 그다음 꼬마, 건물, 그냥 챔피언
        const aggro = q.kind === 'champ' && this.champs.some((a) => a.team === u.team && a.alive && a.hitBy.get(q.id) > this.t - 2 && d2(a, u) < 14);
        const s = d + (aggro ? -8 : q.kind === 'minion' ? 0 : q.kind === 'champ' ? 6 : 2);
        if (s < bs) { bs = s; best = q; }
      }
      u.target = best;
    }
    if (u.target) {
      const t = u.target, d = d2(u, t);
      if (d <= u.range + t.r) {
        u.face = Math.atan2(t.x - u.x, t.z - u.z);
        if (u.reload <= 0) { u.reload = 1 / u.as; this.emitSeen(u, { k: 'matk', id: u.id, to: t.id, r: u.proj ? 1 : 0 }); const go = () => { if (t.alive && u.alive) this.deal(u, t, t.kind === 'champ' ? u.ad * 1.1 : u.ad, 'phys', { basic: true }); }; if (u.proj) this.later(d / 22, go); else go(); }
        return;
      }
      this.stepTo(u, t.x, t.z, dt); return;
    }
    // 길 따라 가기
    const p = u.lanePts[u.wp]; if (!p) return;
    if (Math.hypot(p[0] - u.x, p[1] - u.z) < 3) { u.wp = Math.min(u.lanePts.length - 1, u.wp + 1); return; }
    this.stepTo(u, p[0], p[1], dt);
  }
  stepTo(u, x, z, dt) {
    const dx = x - u.x, dz = z - u.z, L = Math.hypot(dx, dz) || 1, st = u.ms * ((u.fx.slowT || 0) > this.t ? 1 - u.fx.slowK : 1) * dt;
    const nx = u.x + (dx / L) * st, nz = u.z + (dz / L) * st; u.face = Math.atan2(dx, dz);
    if (!blocked(nx, nz)) { u.x = nx; u.z = nz; return; }
    if (!blocked(nx, u.z)) { u.x = nx; return; } if (!blocked(u.x, nz)) u.z = nz;
  }

  // ---------- 정글 ----------
  spawnCamp(c) {
    const d = c.def, g = this.t / 60, k = 1 + g * 0.09;
    const mk = (big, ox, oz, s) => { const hp = s.hp * k; const m = this.unit({ kind: 'mon', team: 'neutral', camp: c, big, mid: c.id, x: c.at[0] + ox, z: c.at[1] + oz, hx: c.at[0] + ox, hz: c.at[1] + oz, hp, max: hp, ad: s.ad * (1 + g * 0.05), ar: 15 + g * 2, mr: 10 + g, as: 0.7, ms: 6, range: d.epic ? 4 : 2.4, r: d.epic ? 2.4 : big ? 1.2 : 0.7, reload: 0, target: null }); c.mons.push(m); return m; };
    mk(true, 0, 0, d.big);
    if (d.small) for (let i = 0; i < d.small.n; i++) { const a = (i / d.small.n) * 6.28 + 0.6; mk(false, Math.cos(a) * 2.6, Math.sin(a) * 2.6, d.small); }
    if (d.epic) this.emit(null, { k: 'epicUp', id: c.id, name: d.name, icon: d.emoji });
  }
  monTick(u, dt) {
    u.reload -= dt;
    if ((u.fx.stunT || 0) > this.t) return;
    u.dots.length && this.dotTick(u, dt); if (!u.alive) return;
    const homeD = Math.hypot(u.x - u.hx, u.z - u.hz);
    let t = u.aggro;
    // 한 마리를 건드리면 같은 무리 모두 달려든다
    if (!t) { const m = u.camp.mons.find((q) => q.aggro?.alive); if (m) t = u.aggro = m.aggro; }
    if (t && (!t.alive || homeD > 16 || d2(t, u) > 18)) { u.aggro = null; t = null; u.returning = true; for (const m of u.camp.mons) m.aggro = null; }
    if (t) {
      const d = d2(u, t);
      if (d <= u.range + t.r) { if (u.reload <= 0) { u.reload = 1 / u.as; this.emitSeen(u, { k: 'matk', id: u.id, to: t.id, r: 0 }); this.deal(u, t, u.ad, 'phys', {}); } }
      else this.stepTo(u, t.x, t.z, dt);
      return;
    }
    if (homeD > 0.6) { this.stepTo(u, u.hx, u.hz, dt); u.hp = Math.min(u.max, u.hp + u.max * 0.15 * dt); return; }
    if (u.hp < u.max) u.hp = Math.min(u.max, u.hp + u.max * 0.15 * dt);
  }

  // ---------- 봇 ----------
  botLevel(c) {
    let guard = 0;
    while (c.pts > 0 && guard++ < 6) {
      if (R_LEVELS.includes(c.level) || (c.rank.r < R_LEVELS.filter((l) => l <= c.level).length)) { const b = c.pts; this.levelSkill(c, 'r'); if (c.pts < b) continue; }
      const want = SKILL_ORDER[c.level - 1] || 'q'; const before = c.pts; this.levelSkill(c, want); if (c.pts === before) { for (const s of ['q', 'w', 'e']) { this.levelSkill(c, s); if (c.pts < before) break; } if (c.pts === before) break; }
    }
  }
  nextBuild(c) { const list = BUILD[c.def.cls]; for (const id of list) { if (c.items.includes(id)) continue; if (ITEMS[id].tag === 'boots' && c.items.some((q) => ITEMS[q].tag === 'boots' && ITEMS[q].cost >= ITEMS[id].cost)) continue; return id; } return null; }
  botBuy(c) {
    if (!this.inBase(c) && c.alive) return;
    for (let i = 0; i < 6; i++) { const id = this.nextBuild(c); if (!id || c.gold < ITEMS[id].cost) break; const had = c.items.length; const g = c.gold; this.buy(c, id); if (c.gold === g && c.items.length === had) break; }
    while (c.gold > 400 && c.potions < 2) { c.gold -= 60; c.potions++; }
  }
  // 이 레인에서 우리 꼬마가 가장 앞선 자리 (없으면 우리 앞쪽 포탑)
  laneFront(c, lane) {
    const path = c.team === 'blue' ? LANES[lane] : [...LANES[lane]].reverse();
    const prog = (u) => { let best = -1, bd = 1e9, acc = 0; for (let i = 0; i + 1 < path.length; i++) { const a = path[i], b = path[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], LL = Math.hypot(dx, dz), k = clamp(((u.x - a[0]) * dx + (u.z - a[1]) * dz) / (LL * LL), 0, 1), d = Math.hypot(u.x - a[0] - dx * k, u.z - a[1] - dz * k); if (d < bd) { bd = d; best = acc + k * LL; } acc += LL; } return best; };
    let best = null, bp = -1;
    for (const m of this.units) if (m.alive && m.team === c.team && (m.kind === 'minion' ? m.lane === lane : m.kind === 'tower' && m.lane === lane)) { const p = prog(m); if (p > bp) { bp = p; best = m; } }
    return best;
  }
  botAim(c, t) { // 움직이는 대상은 조금 앞을 노린다 (실력에 따라 오차)
    const e = (1 - c.skill) * 3.5, lead = t.path?.[0] ? 0.25 : 0, dx = t.path?.[0] ? t.path[0][0] - t.x : 0, dz = t.path?.[0] ? t.path[0][1] - t.z : 0, L = Math.hypot(dx, dz) || 1;
    return { x: t.x + (dx / L) * lead * (t.s?.moveSpeed || 5) * 2 + (this.R() - 0.5) * e, z: t.z + (dz / L) * lead * (t.s?.moveSpeed || 5) * 2 + (this.R() - 0.5) * e };
  }
  botCast(c, enemy) {
    // 쓸 수 있는 기술을 사거리 안의 적에게
    for (const s of ['r', 'q', 'w', 'e']) {
      const sk = this.spec(c, s); if (c.rank[s] <= 0 || c.cds[s] > 0 || c.mp < sk.mana) continue;
      if (sk.kind === 'ally') {
        const low = this.champs.filter((a) => a.team === c.team && a.alive && d2(a, c) < (sk.range || sk.radius || 16)).sort((a, b) => a.hp / a.s.hp - b.hp / b.s.hp)[0];
        if (low && low.hp / low.s.hp < (sk.heal ? 0.7 : 0.8) && (enemy || sk.heal)) { if (this.cast(c, s, low.x, low.z, low.id)) return true; }
        continue;
      }
      if (sk.kind === 'buff') { if (enemy && d2(c, enemy) < 12 && (s !== 'r' || enemy.hp / enemy.s.hp < 0.7)) if (this.cast(c, s, c.x, c.z)) return true; continue; }
      if (!enemy) continue;
      const d = d2(c, enemy), reach = sk.kind === 'nova' ? sk.radius : sk.kind === 'zone' && sk.follow ? sk.radius : sk.kind === 'cone' ? sk.range : sk.kind === 'blink' ? 0 : Math.min(sk.range, 30);
      if (sk.kind === 'blink') { if (c.hp / c.s.hp < 0.35 && this.R() < 0.5) { const f = FOUNTAIN[c.team]; if (this.cast(c, s, f[0], f[1])) return true; } else if (d < 12 && d > 4 && enemy.hp / enemy.s.hp < 0.5) { if (this.cast(c, s, enemy.x, enemy.z)) return true; } continue; }
      if (d > reach) continue;
      if (s === 'r' && enemy.hp / enemy.s.hp > 0.75 && this.R() > 0.15) continue;
      const a = this.botAim(c, enemy);
      if (this.cast(c, s, a.x, a.z, enemy.id)) return true;
    }
    return false;
  }
  enemyChampsNear(c, r) { return this.champs.filter((e) => e.team !== c.team && e.alive && d2(e, c) < r && this.canSee(c.team, e)); }
  alliesNear(c, r) { return this.champs.filter((a) => a !== c && a.team === c.team && a.alive && d2(a, c) < r); }
  enemyTowerNear(c, x = c.x, z = c.z) { return this.units.find((t) => t.alive && t.kind === 'tower' && t.team !== c.team && Math.hypot(t.x - x, t.z - z) < TOWER_RANGE); }
  go(c, x, z) { c.target = null; if (!c.moveTo || Math.hypot(c.moveTo.x - x, c.moveTo.z - z) > 3) { c.moveTo = { x, z }; c.path = null; } }
  attack(c, t) { if (c.target !== t) { c.target = t; c.moveTo = null; c.path = null; } }
  retreat(c) { const f = FOUNTAIN[c.team]; this.go(c, f[0], f[1]); }
  botThink(c) {
    if (c.dash || this.isCC(c)) return;
    if (c.pts > 0) this.botLevel(c);
    const hpK = c.hp / c.s.hp, f = FOUNTAIN[c.team], atHome = Math.hypot(c.x - f[0], c.z - f[1]) < 14;
    if (atHome) { this.botBuy(c); if (hpK < 0.9 && c.retreating) return; c.retreating = false; }
    const en = this.enemyChampsNear(c, 15), al = this.alliesNear(c, 14);
    // 주문 · 물약
    if (hpK < 0.55 && c.potions > 0 && c.potT <= 0) this.drink(c);
    if (hpK < 0.25 && en.length && c.cds.f <= 0 && c.spell === 'heal') this.useSpell(c, 'f', c.x, c.z);
    if (hpK < 0.2 && en.length && c.cds.d <= 0 && this.R() < 0.6) this.useSpell(c, 'd', f[0], f[1]);
    if (c.spell === 'ignite' && c.cds.f <= 0 && en[0] && en[0].hp / en[0].s.hp < 0.3 && d2(en[0], c) < 12) this.useSpell(c, 'f', en[0].x, en[0].z, en[0].id);
    // 돌아가기: 체력이 적거나, 불리하거나, 돈이 많을 때
    const pow = (list, me) => list.reduce((a, u) => a + (u.hp / u.s.hp) * u.level, me ? (hpK * c.level) : 0);
    const outnumbered = en.length > 0 && pow(en) > pow(al, true) * 1.45;
    const nb = this.nextBuild(c), rich = nb && !en.length && c.gold >= ITEMS[nb].cost + 100 && (ITEMS[nb].cost >= 1500 || c.gold > 1200);
    if (hpK < 0.27 || c.retreating || (rich && !atHome)) { c.retreating = hpK < 0.55 || rich; if (c.retreating) { if (en[0]) this.botCast(c, en[0]); this.retreat(c); return; } }
    if (outnumbered && hpK < 0.7) { if (en[0]) this.botCast(c, en[0]); this.retreat(c); return; }
    // 싸움 고르기: 처치할 수 있어 보이거나, 사거리 안이면
    const tgt = en.filter((e) => !this.enemyTowerNear(c, e.x, e.z) || al.length >= 1 || e.hp / e.s.hp < 0.25).sort((a, b) => a.hp - b.hp)[0];
    if (tgt && d2(tgt, c) < 14) this.botCast(c, tgt); else if (al[0]) this.botCast(c, null);
    const late = this.t > 720;
    if (c.role === 'jungle') return this.botJungle(c, tgt, al);
    if (c.role === 'sup') return this.botSupport(c, tgt, al);
    return this.botLane(c, tgt, al, late);
  }
  // 라인: 꼬마 뒤에서 막타 · 견제, 밀리면 포탑 근처로, 후반엔 약한 길로
  botLane(c, tgt, al, late) {
    if (late && !c.laneT) c.laneT = 0;
    if (late && (c.laneT -= 0.25) <= 0) { c.laneT = 25; c.lane = this.weakLane(c); }
    const front = this.laneFront(c, c.lane || 'mid');
    const near = this.units.filter((q) => q.alive && q.team !== c.team && (q.kind === 'minion') && d2(q, c) < c.s.range + 8);
    const inRange = near.filter((q) => d2(q, c) < c.s.range + q.r + 2.5);
    // 막타: 내 공격력으로 잡히는 꼬마
    const lh = inRange.filter((q) => q.hp < c.s.ad * (100 / (100 + q.ar)) * 1.05).sort((a, b) => a.hp - b.hp)[0];
    if (lh) return this.attack(c, lh);
    if (tgt && d2(tgt, c) < c.s.range + 2.5 && (!this.enemyTowerNear(c, tgt.x, tgt.z) || tgt.hp / tgt.s.hp < 0.3)) return this.attack(c, tgt);
    // 포탑은 우리 꼬마가 맞아 줄 때만
    const t = this.enemyTowerNear(c);
    const shielded = t && this.units.filter((q) => q.alive && q.kind === 'minion' && q.team === c.team && d2(q, t) < TOWER_RANGE - 1).length >= 2;
    if (t && !shielded && !(t.cur && t.cur.kind === 'minion')) { const h = BASE[c.team]; this.go(c, c.x + (h[0] - c.x) * 0.2, c.z + (h[1] - c.z) * 0.2); return; }
    const st = this.units.filter((q) => q.alive && q.team !== c.team && (q.kind === 'tower' || q.kind === 'gate' || q.kind === 'heart') && this.attackable(q) && d2(q, c) < c.s.range + q.r + 3).sort((a, b) => a.hp - b.hp)[0];
    if (st && shielded !== false && (this.units.some((q) => q.alive && q.kind === 'minion' && q.team === c.team && d2(q, st) < 11))) return this.attack(c, st);
    // 꼬마 줄 앞을 때리거나, 뒤에 선다
    const low = inRange.sort((a, b) => a.hp - b.hp)[0];
    if (low && (low.hp < c.s.ad * 3 || this.t > 240 || c.def.stats.proj)) return this.attack(c, low);
    if (front) {
      const h = BASE[c.team], dx = h[0] - front.x, dz = h[1] - front.z, L = Math.hypot(dx, dz) || 1, back = c.def.stats.proj ? 6 : 3;
      return this.go(c, front.x + (dx / L) * back, front.z + (dz / L) * back);
    }
  }
  weakLane(c) { // 상대 포탑이 가장 적게 남은 길
    let best = 'mid', n = 99;
    for (const lane of Object.keys(LANES)) { const k = this.units.filter((t) => t.alive && t.kind === 'tower' && t.team !== c.team && t.lane === lane).length + (this.R() - 0.5) * 0.8; if (k < n) { n = k; best = lane; } }
    return best;
  }
  botSupport(c, tgt, al) {
    if (tgt && d2(tgt, c) < c.s.range + 2) { if (!this.enemyTowerNear(c, tgt.x, tgt.z)) return this.attack(c, tgt); }
    const carry = this.champs.find((a) => a.team === c.team && a.role === 'bot' && a.alive) || this.champs.find((a) => a !== c && a.team === c.team && a.alive);
    if (!carry) return this.botLane(c, tgt, al, false);
    const h = BASE[c.team], dx = h[0] - carry.x, dz = h[1] - carry.z, L = Math.hypot(dx, dz) || 1, x = carry.x + (dx / L) * 4, z = carry.z + (dz / L) * 4;
    if (Math.hypot(x - c.x, z - c.z) > 3) this.go(c, x, z);
  }
  botJungle(c, tgt, al) {
    if (tgt && d2(tgt, c) < c.s.range + 6) return this.attack(c, tgt);
    // 도와줄 싸움: 아군이 싸우고 있고 상대가 약하면
    const fight = this.champs.filter((e) => e.team !== c.team && e.alive && this.canSee(c.team, e) && e.hp / e.s.hp < 0.6 && d2(e, c) < 45 && !this.enemyTowerNear(c, e.x, e.z) && this.champs.some((a) => a !== c && a.team === c.team && a.alive && d2(a, e) < 14)).sort((a, b) => d2(a, c) - d2(b, c))[0];
    if (fight) return this.go(c, fight.x, fight.z);
    // 큰 몬스터: 우리가 강하면
    const epic = this.camps.find((k) => k.epic && k.mons.length && k.mons[0].alive && c.level >= (k.id === 'bee' ? 6 : 11) && d2(c, { x: k.at[0], z: k.at[1] }) < 80 && c.hp / c.s.hp > 0.55);
    const camps = this.camps.filter((k) => !k.epic && k.mons.length && (k.side === c.team || this.t > 300));
    const pick = (epic && this.t > 170) ? epic : camps.sort((a, b) => Math.hypot(a.at[0] - c.x, a.at[1] - c.z) - Math.hypot(b.at[0] - c.x, b.at[1] - c.z))[0];
    if (pick) {
      const m = pick.mons.filter((q) => q.alive).sort((a, b) => (a.big ? 1 : 0) - (b.big ? 1 : 0))[0];
      if (m) {
        if (d2(m, c) < c.s.range + 6) {
          if (c.spell === 'smite' && c.cds.f <= 0 && m.big && m.hp < 450 + 40 * c.level) this.useSpell(c, 'f', m.x, m.z, m.id);
          for (const s of ['q', 'w', 'e']) { const sk = this.spec(c, s); if (c.rank[s] > 0 && c.cds[s] <= 0 && c.mp > c.s.mp * 0.3 && sk.kind !== 'ally' && sk.kind !== 'blink') { this.cast(c, s, m.x, m.z, m.id); break; } }
          return this.attack(c, m);
        }
        return this.go(c, m.x, m.z);
      }
    }
    // 잡을 게 없으면 강가로
    const rv = c.team === 'blue' ? [-14, -14] : [14, 14];
    if (Math.hypot(rv[0] - c.x, rv[1] - c.z) > 6) this.go(c, rv[0], rv[1]);
  }

  // ---------- 보내기 ----------
  // 그 팀이 보는 모습 (안 보이는 적은 빠진다)
  snapshot(team) {
    const out = [];
    for (const u of this.units) {
      if (!u.alive || !this.canSee(team, u)) continue;
      const x = +u.x.toFixed(2), z = +u.z.toFixed(2), hp = Math.round(u.hp);
      if (u.kind === 'champ') {
        const f = ((u.fx.stunT || 0) > this.t ? 1 : 0) | ((u.fx.rootT || 0) > this.t ? 2 : 0) | ((u.fx.slowT || 0) > this.t ? 4 : 0) | ((u.fx.stealth || 0) > this.t ? 8 : 0) | ((u.fx.airT || 0) > this.t ? 16 : 0) | (u.dash ? 32 : 0) | (u.windup > 0 ? 64 : 0) | (u.path?.length || u.dash ? 128 : 0);
        const sh = Math.round(u.shields.reduce((a, b) => a + b.v, 0));
        out.push([u.id, 0, u.team === 'blue' ? 0 : 1, x, z, hp, Math.round(u.s.hp), Math.round(u.mp), Math.round(u.s.mp), u.level, f, sh, +(u.face ?? 0).toFixed(2)]);
      } else if (u.kind === 'minion') out.push([u.id, 1, u.team === 'blue' ? 0 : 1, x, z, hp, Math.round(u.max), u.type, +(u.face ?? 0).toFixed(2), u.target ? 1 : 0]);
      else if (u.kind === 'mon') out.push([u.id, 3, 2, x, z, hp, Math.round(u.max), u.mid, u.big ? 1 : 0, +(u.face ?? 0).toFixed(2)]);
      else if (u.kind === 'ward') out.push([u.id, 4, u.team === 'blue' ? 0 : 1, x, z, 1, 1]);
      else out.push([u.id, 2, u.team === 'blue' ? 0 : 1, x, z, hp, Math.round(u.max), u.kind, u.tier, this.invuln(u) ? 1 : 0]);
    }
    return out;
  }
  // 내 상태 (사람에게)
  mine(pid) {
    const u = this.champOf(pid); if (!u) return null; const s = u.s, cds = {}; for (const k in u.cds) cds[k] = +u.cds[k].toFixed(1);
    return { id: u.id, gold: Math.floor(u.gold), lv: u.level, xp: Math.round(u.xp), need: XP_NEED[u.level - 1] || 1, pts: u.pts, rank: u.rank, cds, items: u.items, pot: u.potions, potT: +u.potT.toFixed(1), wards: u.wards, alive: u.alive, resp: u.alive ? 0 : Math.ceil(u.respawnAt - this.t), base: this.inBase(u) || !u.alive, spell: u.spell, st: { ad: Math.round(s.ad), ap: Math.round(s.ap), ar: Math.round(s.ar), mr: Math.round(s.mr), as: +s.as.toFixed(2), ms: +(s.moveSpeed * 10).toFixed(0), range: +s.range.toFixed(1), crit: Math.round(s.crit * 100), haste: Math.round(s.haste * 100), ls: Math.round(s.lifesteal * 100) }, cc: this.isCC(u) ? 1 : 0, sh: Math.round(u.shields.reduce((a, b) => a + b.v, 0)) };
  }
  score() {
    return { time: Math.floor(this.t), kills: this.kills, towers: this.towers, epics: this.epicN, honey: { blue: this.teamBuff.blue.honey, red: this.teamBuff.red.honey }, mold: { blue: this.teamBuff.blue.moldUntil > this.t, red: this.teamBuff.red.moldUntil > this.t }, list: this.champs.map((c) => ({ id: c.id, pid: c.pid, name: c.name, team: c.team, champ: c.def.id, role: c.role, lv: c.level, k: c.k, d: c.de, a: c.a, cs: c.cs, items: c.items, alive: c.alive, resp: c.alive ? 0 : Math.ceil(c.respawnAt - this.t), bot: c.bot, dealt: Math.round(c.dealt) })),
      camps: this.camps.filter((k) => k.epic).map((k) => ({ id: k.id, up: !!k.mons.length, inS: k.mons.length ? 0 : Math.max(0, Math.ceil(k.nextAt - this.t)) })) };
  }
}
function setTimeoutLike(a, d, f) { a.later(d, f); }
