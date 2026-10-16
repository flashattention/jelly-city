// 전투 · 현상수배 · 경찰/군대 · 바닥 아이템
import * as THREE from 'three';
import { HALF } from '../public/js/config.js';
import { weaponStats, damageTaken, itemDef, RARITY, DROP_GROUPS, rarityOf, TEMP_MINUTES } from '../public/js/items.js';
import { randomStreetPoint } from '../public/js/citizens.js';
import { RNG } from '../public/js/utils.js';
import { levelStats } from '../public/js/level.js';
import { AI_CARS } from '../public/js/traffic.js';
import { terrainH } from '../public/js/terrain.js';
import { ANIMALS } from '../public/js/fauna.js';

export const UNIT = {
  cop: { name: '경찰', hp: 120, speed: 6.5, range: 22, rate: 1.1, dmg: 22, acc: 0.6, def: 10 },
  soldier: { name: '군인', hp: 200, speed: 6.8, range: 32, rate: 0.55, dmg: 28, acc: 0.55, def: 25 },
  tank: { name: '전차', hp: 1500, speed: 5, range: 45, rate: 3.2, dmg: 120, radius: 5, acc: 0.8, def: 60 },
  heli: { name: '군용 헬기', hp: 800, speed: 14, range: 55, rate: 2.4, dmg: 70, radius: 4.5, acc: 0.75, def: 40, fly: 22 },
};
export const UNIT_KINDS = Object.keys(UNIT);
const STAR_UNITS = [
  [],
  ['cop', 'cop'],
  ['cop', 'cop', 'cop', 'cop'],
  ['cop', 'cop', 'cop', 'cop', 'cop', 'cop'],
  ['soldier', 'soldier', 'soldier', 'soldier', 'cop', 'cop', 'tank'],
  ['soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'soldier', 'tank', 'tank', 'heli'],
];
const STARS = [15, 60, 130, 220, 330];
const HEAT = { hitNpc: 16, killNpc: 45, hitUnit: 20, killUnit: 40, carjack: 10, hitPlayer: 6, killPlayer: 25 };
const q = (v, k = 10) => Math.round(v * k);

export class Combat {
  constructor(world) {
    this.w = world;
    this.units = [];
    this.nextUnit = 1;
    this.ground = new Map();
    this.nextGround = 1;
    this.rng = new RNG(4242);
    // 서버용 건물 충돌 박스 (유닛 이동)
    this.boxes = world.buildings.filter((b) => b.type !== 'park').map((b) => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.floors * 3.4 + 4 }));
    world.sim.onNpcAttack = (c, pid, dmg) => {
      const p = world.players.get(pid);
      if (p) this.damagePlayer(p, dmg, { name: c.name }, this.npcPos(c));
    };
  }

  // ---------------- 피해 ----------------
  // 플레이어가 보낸 타격 처리
  hit(p, msg) {
    if (p.dead || p.jailed) return;
    if (msg.tt === 'titan') { p.emote = null; return this.w.titans.hit(p, { id: msg.id, w: String(msg.w || '') }); } // 거대 젤리: 뒷목 판정은 따로
    const stats = weaponStats(msg.w, Array.isArray(msg.gems) ? msg.gems.slice(0, 3) : []);
    if (!stats.dmg) return;
    const pellets = Math.max(1, Math.min(10, msg.n || 1));
    const lv = levelStats(p.profile.level || 1);
    // 활은 당긴 만큼 세게, 레벨이 높을수록 강하게
    const pw = stats.kind === 'arrow' && !stats.auto ? Math.max(0.25, Math.min(1.2, +msg.pw || 1)) : 1;
    let dmg = stats.dmg * pellets * pw * lv.dmg;
    const crit = this.rng.chance(stats.crit + lv.crit);
    if (crit) dmg *= 2;
    const maxDist = stats.range * 1.15 + 8; // 하늘에서 내려다보고 쏘는 것도 허용 (3D 거리)
    // 총·화살로 머리를 맞히면 한 방에 쓰러진다
    const head = !!msg.hs && (stats.kind === 'hitscan' || stats.kind === 'arrow');
    if (head) dmg = 100000;
    if (msg.tt === 'npc') {
      const c = this.w.sim.citizens[msg.id];
      if (!c || c.mode === 'dead') return;
      const src = this.npcPos(c);
      if (!src || src.distanceTo(p.pos) > maxDist) return;
      this.damageNpc(c, dmg, p, crit, stats);
      this.elementOnNpc(c, stats, p);
      if (stats.kind === 'hitscan') this.scream(src, this.locOf(c), `n${c.id}`);
    } else if (msg.tt === 'player') {
      const v = this.w.players.get(msg.id);
      if (!v || v === p || v.dead || v.loc !== p.loc || v.pos.distanceTo(p.pos) > maxDist) return;
      if (v.emote) { this.damagePlayer(v, 1, p); return; } // 춤추는 중: 🛡️ 무적 표시만
      this.damagePlayer(v, head ? dmg : damageTaken(dmg, v.profile.def || 0, stats.pierce), p, p.pos, crit);
      this.elementOnPlayer(v, stats, p);
      if (stats.kind === 'hitscan') this.scream(v.pos, v.loc, `p${v.id}`);
      this.lifesteal(p, dmg, stats);
    } else if (msg.tt === 'unit') {
      const u = this.units.find((x) => x.id === msg.id);
      if (!u || u.loc !== p.loc || u.pos.distanceTo(p.pos) > maxDist + 6) return;
      const big = u.kind === 'tank' || u.kind === 'heli';
      this.damageUnit(u, head && !big ? dmg : damageTaken(head ? stats.dmg * 3 : dmg, UNIT[u.kind].def, stats.pierce), p, crit);
      if (stats.kind === 'hitscan' && !big) this.scream(u.pos, u.loc, `u${u.id}`);
      this.lifesteal(p, dmg, stats);
    } else if (msg.tt === 'animal') {
      const a = this.w.wild.list[msg.id];
      if (!a || p.loc !== -1 || Math.hypot(a.x - p.pos.x, a.z - p.pos.z) > maxDist + 3) return;
      this.w.wild.damage(a, dmg, p);
      // 불에 타는 동물 (드래곤은 불에 강하다)
      if (stats.element === 'fire' && stats.burn && !ANIMALS[a.kind]?.fly) { let n = 0; const iv = setInterval(() => { if (++n > 6 || a.dead) { clearInterval(iv); return; } this.w.wild.damage(a, stats.burn * 0.5, p); }, 500); }
    } else if (msg.tt === 'runner') {
      this.hitRunner(p, +msg.id, dmg, crit, maxDist, stats.kind === 'hitscan');
    } else if (msg.tt === 'occ') {
      // AI 차·버스·오토바이에 탄 시민: 맞으면 비명 지르며 모두 뛰어내려 도망가고, 차는 그 자리에 선다
      const car = this.w.traffic.cars[msg.id];
      if (!car || car.mode !== 'ai' || car.occ <= 0 || p.loc !== -1 || car.pos.distanceTo(p.pos) > maxDist + 4) return;
      this.hitOccupants(car, p, dmg, crit);
    } else if (msg.tt === 'car') {
      const car = this.w.traffic.cars[msg.id];
      if (car && p.loc < 0 && car.pos.distanceTo(p.pos) < maxDist + 4) this.damageCar(car, dmg * 0.5, p);
    }
  }

  // 마법 속성 효과
  // 화상: 3초 동안 0.5초마다 피해 (다시 맞으면 시간만 늘어난다), 몸에 불꽃 표시
  burnPlayer(v, dps, secs, attacker) {
    if (v.emote) return;
    if (!v || v.dead || !dps) return;
    const now = Date.now();
    const was = v.burnUntil > now;
    v.burnUntil = Math.max(v.burnUntil || 0, now + secs * 1000);
    this.w.broadcast({ t: 'fx', k: 'burn', pid: v.id, s: secs, loc: v.loc });
    if (was) return;
    const iv = setInterval(() => {
      if (v.dead || !this.w.players.has(v.id) || Date.now() > v.burnUntil) { clearInterval(iv); return; }
      this.damagePlayer(v, dps * 0.5, attacker, null);
    }, 500);
  }
  burnNpc(c, dps, secs, attacker) {
    if (!c || c.mode === 'dead' || !dps) return;
    const now = Date.now();
    const was = c.burnUntil > now;
    c.burnUntil = Math.max(c.burnUntil || 0, now + secs * 1000);
    this.w.broadcast({ t: 'fx', k: 'burn', nid: c.id, s: secs, loc: this.locOf(c) });
    if (was) return;
    const iv = setInterval(() => {
      if (c.mode === 'dead' || Date.now() > c.burnUntil) { clearInterval(iv); return; }
      this.damageNpc(c, dps * 0.5, attacker);
    }, 500);
  }

  elementOnNpc(c, stats, p) {
    if (c.mode === 'dead') return;
    if (stats.element === 'fire' && stats.burn) this.burnNpc(c, stats.burn, 3, p);
    if (stats.element === 'ice') c.slowT = 2.5;
    if (stats.element === 'poison' && stats.poisonDmg) this.poison(c, stats.poisonDmg, p);
    if (stats.element === 'wind') {
      const pos = this.npcPos(c);
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
      pos.x += (dx / d) * 4; pos.z += (dz / d) * 4;
      if (pos === c.pos) this.w.sim.pushOut(c.pos);
    }
  }
  elementOnPlayer(v, stats, p) {
    if (stats.element === 'fire' && stats.burn) this.burnPlayer(v, stats.burn, 3, p);
    if (v.emote) return; // 춤추는 중: 느려짐 · 밀림도 없다
    if (stats.element === 'ice') this.w.send(v, { t: 'slow', s: 2.5 });
    if (stats.element === 'wind') { const dx = v.pos.x - p.pos.x, dz = v.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1; this.w.send(v, { t: 'knock', x: (dx / d) * 9, z: (dz / d) * 9, up: 6, wind: true }); }
    if (stats.element === 'poison' && stats.poisonDmg) {
      let n = 0;
      const iv = setInterval(() => { if (++n > 4 || v.dead || !this.w.players.has(v.id)) { clearInterval(iv); return; } this.damagePlayer(v, stats.poisonDmg, p, null); }, 1000);
    }
  }
  // 빛의 지팡이: 나와 주변 플레이어 회복
  holy(p, msg) {
    const d = itemDef(msg.w);
    if (d.element !== 'holy' || Date.now() - (p.lastHoly || 0) < 1500) return;
    p.lastHoly = Date.now();
    for (const v of this.w.players.values()) if (v.loc === p.loc && v.pos.distanceTo(p.pos) < d.range) this.healPlayer(v, d.heal);
  }

  lifesteal(p, dmg, stats) {
    if (stats.lifesteal > 0) this.healPlayer(p, dmg * stats.lifesteal);
  }

  npcPos(c) {
    if (c.location && c.location.type !== 'park' && (c.mode === 'inside' || c.mode === 'player' || c.mode === 'fight' || c.mode === 'flee' || c.mode === 'dead') && this.w.sim.active.has(c.location.id)) return c.ipos;
    return c.pos;
  }

  damageNpc(c, dmg, attacker, crit = false, stats = null, reason = null) {
    const r = this.w.sim.damage(c, dmg, attacker ? { id: attacker.id, name: attacker.name, pos: attacker.pos, loc: attacker.loc, token: attacker.token } : null);
    if (r.ignored) return;
    const pos = this.npcPos(c);
    this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [pos.x, pos.y + 2.2, pos.z], v: Math.round(dmg), crit, loc: this.locOf(c) });
    if (stats?.poison) this.poison(c, stats.poison, attacker);
    if (!attacker) return;
    this.lifesteal(attacker, dmg, stats || {});
    const tok = attacker.token;
    this.w.setAff(c, tok, this.w.aff(c, tok) - (r.died ? 30 : 8));
    this.w.send(attacker, { t: 'aff', npc: c.id, v: this.w.aff(c, tok) });
    // 경찰은 시민이 신고해야만 온다 (피해자 원한 → 112 신고). 죽으면 목격자가 신고
    if (r.died) {
      this.w.addMemory(c, attacker, `${attacker.name}에게 공격당해 쓰러진 적이 있다. 무섭고 화가 난다`);
      // 쓰러진 시민은 현금을 떨어뜨린다
      const cash = 5 + Math.floor(this.rng.next() * 40);
      this.dropItem({ id: 'cash', n: cash }, pos.x, pos.y, pos.z, this.locOf(c), 60);
    } else if (this.rng.chance(0.3)) this.w.addMemory(c, attacker, `${attacker.name}에게 맞았다`);
    // 목격자들도 도망
    for (const o of this.w.sim.citizens) {
      if (o === c || o.mode === 'dead' || o.mode === 'fight') continue;
      if (this.locOf(o) !== this.locOf(c)) continue;
      if (this.npcPos(o).distanceTo(pos) < 12 && this.rng.chance(0.7)) {
        this.w.sim.flee(o, attacker.pos, this.rng.chance(0.4));
        if (r.died) this.w.sim.addGrudge(o, { token: attacker.token, name: attacker.name }, 60, '살인 목격');
      }
    }
  }

  poison(c, dps, attacker) {
    let n = 0;
    const iv = setInterval(() => {
      if (++n > 4 || c.mode === 'dead') { clearInterval(iv); return; }
      this.damageNpc(c, dps, null);
      void attacker;
    }, 1000);
  }

  locOf(c) {
    return c.location && c.location.type !== 'park' && this.w.sim.active.has(c.location.id) && c.mode !== 'walk' && c.mode !== 'idle' ? c.location.id : -1;
  }

  // 총에 맞은 사람의 비명 (귀여운 젤리 세계의 반전). 연사에 겹치지 않게 같은 대상은 0.7초에 한 번
  scream(pos, loc, key) {
    const now = Date.now();
    this.screamAt ||= new Map();
    if (now - (this.screamAt.get(key) || 0) < 700) return;
    this.screamAt.set(key, now);
    if (this.screamAt.size > 500) for (const [k, t] of this.screamAt) if (now - t > 5000) this.screamAt.delete(k);
    this.w.broadcast({ t: 'fx', k: 'scream', p: [pos.x, pos.y + 1.5, pos.z], loc, s: Math.random() });
  }
  damagePlayer(v, dmg, attacker, fromPos, crit = false) {
    if (v.dead || dmg <= 0) return;
    if (v.emote) { // 춤추는 중엔 무적 (가끔 표시)
      if (Date.now() - (v.emoteShieldT || 0) > 700) { v.emoteShieldT = Date.now(); this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [v.pos.x, v.pos.y + 2.2, v.pos.z], v: 0, shield: 1, loc: v.loc, pid: v.id }); }
      return;
    }
    if (this.w.inSafeZone(v)) return; // 리스폰 존: 무적
    v.hp -= dmg;
    v.lastHurt = Date.now();
    // 플레이어에게 당하면 112 신고할 수 있도록 기록
    if (attacker?.token && attacker !== v) { (v.attackers ||= new Map()).set(attacker.token, { name: attacker.name, t: Date.now(), reason: v.hp <= 0 ? '살인' : '폭행' }); this.w.send(v, { t: 'canReport', list: this.reportable(v) }); }
    this.w.send(v, { t: 'dmg', v: Math.round(dmg), hp: Math.max(0, Math.round(v.hp)), from: fromPos ? [fromPos.x, fromPos.y, fromPos.z] : null, by: attacker?.name || '' });
    this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [v.pos.x, v.pos.y + 2.2, v.pos.z], v: Math.round(dmg), crit, loc: v.loc, pid: v.id });
    if (v.hp <= 0) this.killPlayer(v, attacker);
  }

  healPlayer(p, amount) {
    if (p.dead) return;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    this.w.send(p, { t: 'hp', hp: Math.round(p.hp) });
  }

  killPlayer(v, attacker) {
    v.hp = 0; v.dead = true; v.heat = 0; v.stars = 0;
    if (v.car >= 0) { const car = this.w.traffic.cars[v.car]; if (car) this.w.traffic.exit(car); v.car = -1; }
    if (v.talking !== null) this.w.endTalk(v, v.talking);
    this.units = this.units.filter((u) => u.target !== v.id);
    this.w.send(v, { t: 'dead', by: attacker?.name || '', wanted: 0 });
    this.w.broadcast({ t: 'sys', text: `💀 ${v.name}님이 ${attacker?.name ? attacker.name + '에게 ' : ''}쓰러졌어요` });
    if (attacker?.token && attacker !== v) {
      v.attackers?.set(attacker.token, { name: attacker.name, t: Date.now(), reason: '살인' });
      this.w.send(v, { t: 'canReport', list: this.reportable(v) });
      // 플레이어를 쓰러뜨리면 경험치 (상대 레벨이 높을수록 많이)
      const killer = this.w.players.get(attacker.id);
      if (killer) this.w.send(killer, { t: 'xp', v: 80 + 15 * (v.profile.level || 1), reason: `${v.name} 쓰러뜨림` });
    }
    setTimeout(() => {
      v.dead = false; v.hp = v.maxHp;
      this.w.send(v, { t: 'respawn', hp: v.hp, homeId: this.w.accounts[v.token]?.homeId ?? null });
    }, 4500);
  }

  damageUnit(u, dmg, attacker, crit = false) {
    u.hp -= dmg;
    this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [u.pos.x, u.pos.y + 2.5, u.pos.z], v: Math.round(dmg), crit, loc: u.loc });
    if (attacker) this.addHeat(attacker, HEAT.hitUnit, '공무집행 방해');
    if (u.hp <= 0) {
      this.units = this.units.filter((x) => x !== u);
      this.w.broadcast({ t: 'fx', k: 'boom', p: [u.pos.x, u.pos.y + 1, u.pos.z], r: u.kind === 'tank' || u.kind === 'heli' ? 6 : 1.5, loc: u.loc, small: u.kind === 'cop' || u.kind === 'soldier' });
      if (attacker) this.addHeat(attacker, HEAT.killUnit, '경찰·군인 공격');
    }
  }

  damageCar(car, dmg, attacker) {
    if (car.mode === 'wreck' || car.mode === 'gone') return;
    car.hp -= dmg;
    if (car.hp > 0) return;
    car.mode = 'wreck'; car.wreckT = 25; car.speed = 0;
    this.w.broadcast({ t: 'fx', k: 'boom', p: [car.pos.x, (car.pos.y || 0) + 1, car.pos.z], r: 6, loc: -1 });
    for (const p of this.w.players.values()) {
      if (p.car === car.id) { p.car = -1; car.owner = null; this.w.send(p, { t: 'carGone' }); this.damagePlayer(p, 45, attacker, car.pos); }
    }
    car.occ = 0;
  }

  // 폭발: 범위 안의 모두에게 피해
  explode(p, msg) {
    const stats = weaponStats(msg.w, Array.isArray(msg.gems) ? msg.gems.slice(0, 3) : []);
    const def = itemDef(msg.w);
    if (!def.radius && !msg.vehicle) return;
    const center = new THREE.Vector3(+msg.x, +msg.y, +msg.z);
    if (p && center.distanceTo(p.pos) > (stats.range || 60) + 20) return;
    const R = msg.vehicle ? (msg.vehicle === 'tank' ? 5 : 4.5) : def.radius;
    const base = (msg.vehicle ? (msg.vehicle === 'tank' ? 85 : 70) : stats.dmg) * (p ? levelStats(p.profile.level || 1).dmg : 1);
    this.explodeAt(center, Number.isInteger(msg.loc) ? msg.loc : -1, R, base, p, stats);
  }

  explodeAt(center, loc, R, base, attacker, stats = {}, onlyPlayer = null) {
    this.w.broadcast({ t: 'fx', k: 'boom', p: [center.x, center.y, center.z], r: R, loc });
    const fall = (d) => Math.max(0, 1 - d / R);
    for (const c of this.w.sim.citizens) {
      if (c.mode === 'dead' || this.locOf(c) !== loc) continue;
      const d = this.npcPos(c).distanceTo(center);
      if (d < R) { this.damageNpc(c, base * (0.4 + 0.6 * fall(d)), attacker, false, stats); if (stats.burn) this.burnNpc(c, stats.burn, 3, attacker); }
    }
    for (const v of this.w.players.values()) {
      if (v.dead || v.loc !== loc || (onlyPlayer && v !== onlyPlayer)) continue;
      if (v === attacker && stats.kind === 'magic') continue; // 내 마법에 나는 안 다친다
      const d = v.pos.distanceTo(center);
      if (d < R) {
        this.damagePlayer(v, damageTaken(base * (0.4 + 0.6 * fall(d)), v.profile.def || 0, stats.pierce || 0), attacker, center);
        if (stats.burn) this.burnPlayer(v, stats.burn, 3, attacker);
      }
    }
    for (const u of [...this.units]) {
      if (u.loc !== loc) continue;
      const d = u.pos.distanceTo(center);
      if (d < R + 1) this.damageUnit(u, damageTaken(base * (0.4 + 0.6 * fall(d)), UNIT[u.kind].def, stats.pierce || 0), attacker);
    }
    if (loc < 0 && attacker) for (const a of this.w.wild.list) {
      if (a.dead) continue;
      const d = Math.hypot(a.x - center.x, a.z - center.z);
      if (d < R + 1) this.w.wild.damage(a, base * (0.4 + 0.6 * fall(d)), attacker);
    }
    if (loc < 0) for (const car of this.w.traffic.cars) {
      const d = car.pos.distanceTo(center);
      if (d < R + 1.5) this.damageCar(car, base * 1.5 * (0.4 + 0.6 * fall(d)), attacker);
    }
  }

  // 최근 10분 동안 나를 공격한 플레이어 (112 신고 대상)
  reportable(v) {
    const now = Date.now(), out = [];
    for (const [token, a] of v.attackers || []) if (now - a.t < 600000) out.push({ token, name: a.name, reason: a.reason });
    return out;
  }
  report112(v, token) {
    const a = v.attackers?.get(token);
    if (!a || Date.now() - a.t > 600000) return;
    v.attackers.delete(token);
    this.w.handlePlayerReport(v, { token, name: a.name, reason: a.reason });
  }

  // 체포 → 경찰차로 이송 → 교도소 60초
  arrest(p, cop) {
    if (p.jailed || p.dead) return;
    const prison = this.w.city.byType.prison?.[0];
    if (!prison) return;
    p.jailed = true;
    const reason = p.crimeReason || '경범죄';
    p.heat = 0; this.updateStars(p);
    this.units = this.units.filter((u) => u.target !== p.id);
    if (p.talking !== null) this.w.endTalk(p, p.talking);
    const secs = 60;
    this.w.send(p, { t: 'arrested', prison: prison.id, secs, reason, cop: cop ? [cop.pos.x, cop.pos.z] : null });
    this.w.broadcast({ t: 'sys', text: `🚔 ${p.name}님이 체포되어 젤리 교도소로 이송됩니다! (사유: ${reason})` });
    const acc = this.w.accounts[p.token];
    if (acc) { acc.arrests = (acc.arrests || 0) + 1; this.w.dirty = true; }
    clearTimeout(p.jailTimer);
    p.jailTimer = setTimeout(() => {
      p.jailed = false;
      if (this.w.players.has(p.id)) { this.w.send(p, { t: 'released' }); this.w.broadcast({ t: 'sys', text: `🔓 ${p.name}님이 교도소에서 석방됐어요` }); }
    }, (secs + 5) * 1000);
  }

  // ---------------- 현상수배 ----------------
  addHeat(p, v, reason = '') {
    if (!p || !p.token || p.dead || p.jailed) return;
    p.heat = Math.min(420, (p.heat || 0) + v);
    p.lastCrime = Date.now();
    if (reason) p.crimeReason = reason;
    this.updateStars(p);
  }
  updateStars(p) {
    let s = 0;
    for (const t of STARS) if (p.heat >= t) s++;
    if (s !== p.stars) {
      const up = s > (p.stars || 0);
      p.stars = s;
      this.w.send(p, { t: 'wanted', stars: s, reason: up ? p.crimeReason || '' : '' });
      if (up && s >= 4) this.w.broadcast({ t: 'sys', text: `🚨 ${p.name}님을 진압하기 위해 군대가 출동했습니다!` });
      else if (up) this.w.send(p, { t: 'sys', text: `🚓 수배 ★${s} — 사유: ${p.crimeReason || '범죄'}` });
      else if (s === 0) this.w.send(p, { t: 'sys', text: '😮‍💨 수배가 풀렸어요' });
    }
  }

  // ---------------- 유닛 AI ----------------
  spawnUnit(kind, p) {
    const info = UNIT[kind];
    let pos;
    const anchor = p.loc >= 0 ? this.w.buildings[p.loc].door : p.pos;
    for (let i = 0; i < 8; i++) {
      const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(40, 60);
      pos = new THREE.Vector3(anchor.x + Math.cos(a) * r, 0, anchor.z + Math.sin(a) * r);
      if (Math.abs(pos.x) < HALF - 2 && Math.abs(pos.z) < HALF - 2 && !this.blocked(pos, 1)) break;
      pos = randomStreetPoint(this.rng).point;
    }
    pos.y = info.fly || 0;
    this.units.push({ id: this.nextUnit++, kind, pos, h: 0, hp: info.hp, loc: -1, target: p.id, fireT: this.rng.range(1, 3), moving: 0 });
  }

  blocked(pos, r) {
    for (const b of this.boxes) if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) return true;
    return false;
  }

  // 두 점 사이를 건물이 막는지 (선분-상자 교차)
  segBlocked(a, b) {
    const d = b.clone().sub(a);
    for (const box of this.boxes) {
      let t0 = 0, t1 = 1, hit = true;
      for (const [k, mn, mx] of [['x', box.minX, box.maxX], ['y', -1, box.h], ['z', box.minZ, box.maxZ]]) {
        if (Math.abs(d[k]) < 1e-9) { if (a[k] < mn || a[k] > mx) { hit = false; break; } continue; }
        let u0 = (mn - a[k]) / d[k], u1 = (mx - a[k]) / d[k];
        if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
        if (t0 > t1) { hit = false; break; }
      }
      if (hit) return true;
    }
    return false;
  }

  pushOut(pos, r) {
    for (const b of this.boxes) {
      if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
      if (d < 1e-3) { dx = pos.x - (b.minX + b.maxX) / 2; dz = pos.z - (b.minZ + b.maxZ) / 2; d = Math.hypot(dx, dz) || 1; pos.x = cx + (dx / d) * r * 2; pos.z = cz + (dz / d) * r * 2; continue; }
      if (d < r) { pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
    }
  }

  tick(dt) {
    const now = Date.now();
    for (const p of this.w.players.values()) {
      // 수배도 감소
      if ((p.heat || 0) > 0 && now - (p.lastCrime || 0) > 20000) { p.heat = Math.max(0, p.heat - 6 * dt); this.updateStars(p); }
      // 체력 재생
      if (!p.dead && p.hp < p.maxHp && now - (p.lastHurt || 0) > 8000) { p.hp = Math.min(p.maxHp, p.hp + (2 + (p.profile.regen || 0)) * dt); p.hpSendT = (p.hpSendT || 0) - dt; if (p.hpSendT <= 0) { p.hpSendT = 1; this.w.send(p, { t: 'hp', hp: Math.round(p.hp) }); } }
      // 필요한 유닛 수 맞추기
      if (p.dead || p.jailed) continue;
      p.spawnT = (p.spawnT || 0) - dt;
      if (p.spawnT > 0) continue;
      p.spawnT = 1.5;
      const want = STAR_UNITS[p.stars || 0];
      const have = {};
      for (const u of this.units) if (u.target === p.id) have[u.kind] = (have[u.kind] || 0) + 1;
      const need = {};
      for (const k of want) need[k] = (need[k] || 0) + 1;
      for (const k of Object.keys(need)) if ((have[k] || 0) < need[k]) { this.spawnUnit(k, p); break; }
      // 별이 줄면 철수
      for (const k of Object.keys(have)) if ((need[k] || 0) < have[k]) { const u = this.units.find((x) => x.target === p.id && x.kind === k); this.units = this.units.filter((x) => x !== u); break; }
    }
    for (const u of [...this.units]) this.updateUnit(u, dt);
    this.tickDrops(dt);
    this.carHits(dt);
    this.tickRunners(dt);
    // 바닥 아이템 소멸
    for (const [id, g] of this.ground) if (now > g.expire) { this.ground.delete(id); this.w.broadcast({ t: 'gpick', gid: id }); }
    // 버려진 AI 차(빼앗겼다 내린 차, 탄 사람이 도망친 차): 1분 30초 동안 아무도 근처에 없으면 다시 도로로
    for (const car of this.w.traffic.cars) {
      if (car.id >= AI_CARS || car.mode !== 'parked') { car.idleT = 0; continue; }
      const someone = [...this.w.players.values()].some((x) => x.loc === -1 && Math.hypot(x.pos.x - car.pos.x, x.pos.z - car.pos.z) < 60);
      car.idleT = someone ? 0 : (car.idleT || 0) + dt;
      if (car.idleT > 90) { car.idleT = 0; this.w.traffic.resetAI(car); }
    }
    // 부서진 차
    for (const car of this.w.traffic.cars) {
      if (car.mode !== 'wreck') continue;
      car.wreckT -= dt;
      if (car.wreckT <= 0) {
        if (car.id < AI_CARS) this.w.traffic.resetAI(car);
        else car.mode = 'gone';
      }
    }
  }

  updateUnit(u, dt) {
    const info = UNIT[u.kind];
    const p = this.w.players.get(u.target);
    if (!p || p.dead) { this.units = this.units.filter((x) => x !== u); return; }
    u.moving = 0;
    // 건물 안팎 따라가기 (전차·헬기는 밖에서 대기)
    if (p.loc !== u.loc) {
      if (u.loc >= 0) { const b = this.w.buildings[u.loc]; u.loc = -1; u.pos.set(b.door.x, 0, b.door.z); return; }
      const door = this.w.buildings[p.loc].door;
      const d = Math.hypot(door.x - u.pos.x, door.z - u.pos.z);
      if (d < 3 && !info.fly && u.kind !== 'tank') {
        const I = this.w.sim.interiorFor(this.w.buildings[p.loc]);
        u.loc = p.loc; u.pos.set(I.entry.x + this.rng.range(-1, 1), 0.1, I.entry.z);
        return;
      }
      if (d > 6) this.moveUnit(u, door, info, dt);
      return;
    }
    const tp = p.pos;
    const dx = tp.x - u.pos.x, dz = tp.z - u.pos.z, d = Math.hypot(dx, dz);
    u.h = Math.atan2(dx, dz);
    // 경범죄 (별 1~2개): 경찰은 총을 쏘지 않고 쫓아가서 체포한다
    if (u.kind === 'cop' && (p.stars || 0) <= 2) {
      // 하늘을 날거나 옥상에 있는 플레이어는 경찰도 날아올라 쫓는다
      const pg = terrainH(tp.x, tp.z), above = tp.y - pg;
      const want = u.loc < 0 && above > 2.5 ? above : 0;
      u.fy = u.fy || 0;
      u.fy += Math.max(-7 * dt, Math.min(8 * dt, want - u.fy));
      u.flying = u.fy > 0.3 ? 1 : 0;
      const sp = u.flying ? Math.max(15, info.speed * 1.25) : info.speed * 1.25;
      if (d > 1.6) this.moveUnit(u, tp, { ...info, speed: sp, fly: u.flying ? 1 : info.fly }, dt);
      u.pos.y = u.flying ? terrainH(u.pos.x, u.pos.z) + u.fy : 0;
      const uy = u.flying ? u.pos.y : u.loc < 0 ? terrainH(u.pos.x, u.pos.z) : tp.y;
      if (Math.hypot(d, tp.y - uy) < 2.2 && p.car < 0 && !p.dead) this.arrest(p, u);
      return;
    }
    if (u.fy) { u.fy = 0; u.flying = 0; u.pos.y = 0; }
    if (d > info.range * 0.6) this.moveUnit(u, tp, info, dt);
    u.fireT -= dt;
    // 건물에 가려 있으면 쏘지 않고 다가간다 (총알이 벽을 뚫지 않게)
    const eye = new THREE.Vector3(u.pos.x, u.pos.y + (info.fly ? 0 : 1.3), u.pos.z);
    const blockedLos = u.loc < 0 && this.segBlocked(eye, new THREE.Vector3(tp.x, tp.y + 1, tp.z));
    if (blockedLos) { if (u.fireT < 0.3) u.fireT = 0.3; if (d > 3) this.moveUnit(u, tp, info, dt); return; }
    if (u.fireT <= 0 && d < info.range) {
      u.fireT = info.rate * this.rng.range(0.85, 1.2);
      const muzzle = new THREE.Vector3(u.pos.x, u.pos.y + (info.fly ? 0 : u.kind === 'tank' ? 2.2 : 1.3), u.pos.z);
      const hitChance = info.acc * (1 - (d / info.range) * 0.4);
      const hit = this.rng.chance(hitChance);
      const aim = new THREE.Vector3(tp.x + (hit ? 0 : this.rng.range(-3, 3)), tp.y + 1, tp.z + (hit ? 0 : this.rng.range(-3, 3)));
      if (info.radius) {
        this.w.broadcast({ t: 'fx', k: 'tracer', a: [muzzle.x, muzzle.y, muzzle.z], b: [aim.x, aim.y, aim.z], c: '#ff9100', w: 3, loc: u.loc });
        this.explodeAt(aim, u.loc, info.radius, info.dmg, null, {}, p);
      } else {
        this.w.broadcast({ t: 'fx', k: 'tracer', a: [muzzle.x, muzzle.y, muzzle.z], b: [aim.x, aim.y, aim.z], c: '#fff59d', loc: u.loc });
        if (hit) { this.damagePlayer(p, damageTaken(info.dmg, p.profile.def || 0), { name: info.name }, muzzle); if (!p.emote) this.scream(p.pos, p.loc, `p${p.id}`); }
      }
    }
  }

  moveUnit(u, target, info, dt) {
    const dx = target.x - u.pos.x, dz = target.z - u.pos.z, d = Math.hypot(dx, dz) || 1;
    const st = Math.min(d, info.speed * dt);
    u.pos.x += (dx / d) * st; u.pos.z += (dz / d) * st;
    u.h = Math.atan2(dx, dz);
    if (!info.fly && u.loc < 0) this.pushOut(u.pos, u.kind === 'tank' ? 2.2 : 0.6);
    if (u.loc >= 0) {
      const I = this.w.sim.interiorFor(this.w.buildings[u.loc]);
      u.pos.x = Math.max(I.entry.x - 35, Math.min(I.entry.x + 35, u.pos.x));
      u.pos.z = Math.max(I.entry.z - 50, Math.min(I.entry.z + 1, u.pos.z));
    }
    u.moving = 1;
  }

  // ---------------- 바닥 아이템 ----------------
  dropItem(item, x, y, z, loc, life = 60, extra = {}) {
    const g = { id: this.nextGround++, item, x, y, z, loc, expire: Date.now() + life * 1000, ...extra };
    this.ground.set(g.id, g);
    this.w.broadcast({ t: 'gdrop', g: groundMsg(g) });
    return g;
  }
  pickup(p, gid) {
    const g = this.ground.get(gid);
    if (!g || g.loc !== p.loc || Math.hypot(g.x - p.pos.x, g.z - p.pos.z) > 4) return;
    this.ground.delete(gid);
    this.w.broadcast({ t: 'gpick', gid });
    if (g.world) {
      // 맵에서 주운 무기는 30분 동안만 쓸 수 있다
      const item = { ...g.item, ttlMs: TEMP_MINUTES * 60 * 1000 };
      this.w.send(p, { t: 'gotItem', item, bonus: g.bonus || null, world: true });
      const r = RARITY[g.item.rarity] || RARITY.common;
      const d = itemDef(g.item.id);
      this.w.broadcast({ t: 'loot', who: p.name, id: g.item.id, rarity: g.item.rarity, text: `🎉 ${p.name}님이 [${r.name}] ${d.emoji} ${d.name}을(를) 획득했습니다!` });
    } else this.w.send(p, { t: 'gotItem', item: g.item });
  }

  // 거리 곳곳에 무기를 무작위로 떨어뜨린다
  spawnWorldDrop() {
    const grp = this.rng.weighted(DROP_GROUPS, (x) => x[1]);
    const id = this.rng.weighted(grp[2], (i) => RARITY[rarityOf(i)].weight);
    const tier = rarityOf(id);
    const d = itemDef(id);
    const item = { id, n: d.stack ? 3 : 1, gems: [], rarity: tier };
    // 총은 그 총의 탄약, 활은 화살을 함께
    const bonus = d.ammo ? { id: d.ammo, n: Math.max(2, Math.round((itemDef(d.ammo).pack || 10) * 0.5)) } : d.cat === 'wand' ? { id: 'mana_potion', n: 2 } : null; // 마법봉은 마나 물약을 함께
    const sp = randomStreetPoint(this.rng).point;
    return this.dropItem(item, sp.x, 0.12, sp.z, -1, 600, { world: true, bonus });
  }
  groundList() { return [...this.ground.values()].map(groundMsg); }

  tickDrops(dt) {
    const target = Number(process.env.WORLD_DROPS) || 14;
    if (this.dropT === undefined) { for (let i = 0; i < target; i++) this.spawnWorldDrop(); this.dropT = 15; return; } // 서버 시작 시 바로 채움
    this.dropT -= dt;
    if (this.dropT > 0) return;
    this.dropT = 15;
    const n = [...this.ground.values()].filter((g) => g.world).length;
    if (n < target) this.spawnWorldDrop();
  }

  // ---------------- 차에서 뛰어내려 도망가는 시민 ----------------
  // 차를 빼앗기거나 탄 차가 공격받으면 뛰어내려 달아난다. 서버가 움직이니 모두에게 같은 자리에 보이고, 맞힐 수 있다
  spawnRunners(car, n, say) {
    this.runners ||= []; this.runnerId ||= 1;
    const sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
    const out = [];
    for (let i = 0; i < Math.min(n, 8); i++) {
      const s = i % 2 ? 1 : -1;
      const r = { id: this.runnerId++, x: car.pos.x + sx * s * 1.8, z: car.pos.z + sz * s * 1.8, h: Math.atan2(sx * s, sz * s) + this.rng.range(-0.6, 0.6), hp: 60, t: 0, dead: false };
      this.w.sim.pushOut(r, 0.4);
      this.runners.push(r);
      out.push({ id: r.id, x: r.x, z: r.z, h: r.h, c: i, say: i === 0 ? say : null });
    }
    this.w.broadcast({ t: 'runners', list: out });
  }
  tickRunners(dt) {
    if (!this.runners?.length) return;
    const outside = [...this.w.players.values()].filter((p) => p.loc === -1);
    for (const r of [...this.runners]) {
      r.t += dt;
      const gone = r.dead ? r.t > 20 : (r.t > 15 && !outside.some((p) => Math.hypot(p.pos.x - r.x, p.pos.z - r.z) < 45)) || r.t > 60;
      if (gone) { this.runners = this.runners.filter((x) => x !== r); this.w.broadcast({ t: 'runnerGone', id: r.id }); continue; }
      if (r.dead) continue;
      // 처음엔 전력으로, 지치면 조금 느리게. 건물에 막히면 옆으로 꺾는다
      const sp = r.t < 8 ? 7 : 4.5, nx = r.x + Math.sin(r.h) * sp * dt, nz = r.z + Math.cos(r.h) * sp * dt;
      const q = { x: nx, z: nz };
      this.w.sim.pushOut(q, 0.4);
      if (Math.hypot(q.x - nx, q.z - nz) > 0.01) r.h += (this.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      r.x = q.x; r.z = q.z;
    }
    this.runnerSendT = (this.runnerSendT || 0) - dt;
    if (this.runnerSendT <= 0) {
      this.runnerSendT = 0.2;
      const a = [];
      for (const r of this.runners) if (!r.dead) a.push(r.id, Math.round(r.x * 10), Math.round(r.z * 10), Math.round(r.h * 100));
      if (a.length) this.w.broadcast({ t: 'rpos', a });
    }
  }
  hitRunner(p, id, dmg, crit, maxDist, gun) {
    const r = this.runners?.find((x) => x.id === id);
    if (!r || r.dead || p.loc !== -1 || Math.hypot(r.x - p.pos.x, r.z - p.pos.z) > maxDist + 3) return;
    r.hp -= dmg;
    const y = 0;
    this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [r.x, y + 2.2, r.z], v: Math.round(Math.min(dmg, 999)), crit, loc: -1 });
    if (gun || r.hp <= 0) this.scream({ x: r.x, y, z: r.z }, -1, `r${r.id}`);
    if (r.hp > 0) {
      if (this.rng.chance(0.25)) setTimeout(() => { if (this.w.players.has(p.id)) this.w.reportBy('도망치던 시민', { token: p.token, name: p.name, reason: '폭행' }); }, 4000);
      return;
    }
    r.dead = true; r.t = 0;
    this.w.broadcast({ t: 'runnerDown', id: r.id });
    this.dropItem({ id: 'cash', n: 5 + Math.floor(this.rng.next() * 40) }, r.x, 0.3, r.z, -1, 60);
    if (this.rng.chance(0.6)) setTimeout(() => { if (this.w.players.has(p.id)) this.w.reportBy('목격자', { token: p.token, name: p.name, reason: '살인' }); }, 4000);
  }

  hitOccupants(car, p, dmg, crit) {
    const at = { x: car.pos.x, y: (car.pos.y || 0) + 1.2, z: car.pos.z };
    this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [at.x, at.y + 1, at.z], v: Math.round(Math.min(dmg, 999)), crit, loc: -1 });
    this.scream(at, -1, `c${car.id}`);
    this.spawnRunners(car, car.occ, '으아악! 살려줘요!! 😱');
    car.bubble = { text: '으아악! 살려줘요!! 😱', t: 2.5 };
    this.w.broadcast({ t: 'carSay', id: car.id, text: car.bubble.text });
    car.occ = 0; car.mode = 'parked'; car.speed = 0; car.owner = null;
    // 도망친 시민이 절반 확률로 112에 신고
    if (this.rng.chance(0.5)) setTimeout(() => { if (this.w.players.has(p.id)) this.w.reportBy('차에 타고 있던 시민', { token: p.token, name: p.name, reason: '폭행' }); }, 5000);
  }

  // 차에 치이기: 속도가 빠를수록 크게 다친다
  carHits(dt) {
    const now = Date.now();
    for (const car of this.w.traffic.cars) {
      const sp = Math.abs(car.speed || 0);
      if (sp < 4 || car.mode === 'wreck' || car.mode === 'gone' || car.mode === 'parked' || (car.pos.y || 0) > 1.5) continue;
      const driver = car.owner != null ? this.w.players.get(car.owner) : null;
      const r = car.mesh.radius + 0.6;
      const mult = car.kind === 'tank' ? 1.6 : car.kind === 'bus' ? 1.3 : 1;
      const dmg = Math.round((sp - 3) * 5 * mult);
      for (const v of this.w.players.values()) {
        if (v === driver || v.dead || v.loc !== -1 || v.car >= 0 || v.emote) continue; // 춤추는 사람은 차도 못 친다
        const dx = v.pos.x - car.pos.x, dz = v.pos.z - car.pos.z, d = Math.hypot(dx, dz);
        // 차 높이 위로 떠 있으면(날기 · 입체기동 · 점프) 차에 안 치인다
        if (d > r || v.pos.y - (car.pos.y || 0) > (car.height || 2.4) || now - (v.lastCarHit || 0) < 1200) continue;
        v.lastCarHit = now;
        const k = sp * 0.7;
        this.w.send(v, { t: 'knock', kind: 'car', x: (dx / (d || 1)) * k, z: (dz / (d || 1)) * k, up: Math.min(9, 3 + sp * 0.3) });
        this.damagePlayer(v, dmg, driver ? { name: driver.name, token: driver.token, id: driver.id } : { name: '자동차' }, car.pos);
        this.w.broadcast({ t: 'fx', k: 'carhit', p: [v.pos.x, v.pos.y + 1, v.pos.z], loc: -1 });
        this.scream(v.pos, -1, `p${v.id}`);
      }
      // 플레이어가 모는 차에 치인 시민: 빠를수록 피하기 어렵다
      if (!driver) continue;
      for (const c of this.w.sim.citizens) {
        if (c.mode === 'dead' || (c.location && c.location.type !== 'park')) continue;
        const dx = c.pos.x - car.pos.x, dz = c.pos.z - car.pos.z, d = Math.hypot(dx, dz);
        if (d > r || now - (c.lastCarHit || 0) < 1200) continue;
        c.lastCarHit = now;
        const dodgeChance = sp < 7 ? 1 : Math.max(0.15, 1 - (sp - 7) / 14);
        if (this.rng.chance(dodgeChance)) this.w.sim.dodge(c, car.pos, sp > 16 ? { token: driver.token, name: driver.name } : null);
        else {
          c.pos.x += (dx / (d || 1)) * 3; c.pos.z += (dz / (d || 1)) * 3;
          this.w.sim.pushOut(c.pos);
          this.damageNpc(c, dmg, driver, false, null, '교통사고');
          this.w.broadcast({ t: 'fx', k: 'carhit', p: [c.pos.x, 1, c.pos.z], loc: -1 });
          this.scream(c.pos, -1, `n${c.id}`);
        }
      }
    }
  }

  unitSnap() {
    return this.units.map((u) => [u.id, UNIT_KINDS.indexOf(u.kind), q(u.pos.x), q(u.pos.y), q(u.pos.z), q(u.h, 100), u.loc, u.moving, Math.round((u.hp / UNIT[u.kind].hp) * 100), u.flying ? 1 : 0]);
  }
}

function groundMsg(g) { return { id: g.id, item: g.item, x: g.x, y: g.y, z: g.z, loc: g.loc, ttl: Math.round((g.expire - Date.now()) / 1000), world: !!g.world, bonus: g.bonus || null }; }
