// 야생동물 AI (서버): 돌아다니고, 사냥감은 도망치고, 맹수는 덤빈다. 쓰러지면 전리품을 떨어뜨리고 잠시 뒤 다시 태어난다
import { ANIMALS, ANIMAL_KINDS } from '../public/js/fauna.js';
import { REGIONS, terrainH, WATER_Y, PARK } from '../public/js/terrain.js';
import { HALF } from '../public/js/config.js';
import { RNG } from '../public/js/utils.js';
import { randomStreetPoint } from '../public/js/citizens.js';

const q = (v, k = 10) => Math.round(v * k);

export class Wildlife {
  constructor(world) {
    this.w = world;
    this.rng = new RNG(31337);
    this.list = [];
    for (const kind of ANIMAL_KINDS) for (let i = 0; i < ANIMALS[kind].n; i++) {
      const a = { id: this.list.length, kind, x: 0, z: 0, h: 0, ay: 0, hp: ANIMALS[kind].hp, mv: 0, dead: false, deadT: 0, atkT: 0, t: 0, tx: 0, tz: 0, angry: null, angryT: 0, gone: false, breath: 0 };
      this.place(a);
      this.list.push(a);
    }
  }

  rects(kind) {
    const d = ANIMALS[kind];
    if (d.pen) return [d.pen];
    return REGIONS.filter((r) => d.region.includes(r.id)).map((r) => r.rect);
  }
  okSpot(kind, x, z) {
    if (Math.abs(x) < HALF + 40 && Math.abs(z) < HALF + 40) return false;
    if (x > PARK.x0 - 20 && x < PARK.x1 + 20 && z > PARK.z0 - 20 && z < PARK.z1 + 20) return false; // 놀이공원엔 안 들어간다
    const h = terrainH(x, z);
    const d = ANIMALS[kind];
    if (d.swim) return h < WATER_Y + 2.5; // 물가 근처
    return h > WATER_Y + 0.3 && h < 95;
  }
  randomPoint(kind) {
    const rects = this.rects(kind);
    for (let i = 0; i < 40; i++) {
      const [x0, z0, x1, z1] = this.rng.pick(rects);
      const x = this.rng.range(x0 + 5, x1 - 5), z = this.rng.range(z0 + 5, z1 - 5);
      if (this.okSpot(kind, x, z)) return [x, z];
    }
    const [x0, z0, x1, z1] = rects[0];
    return [(x0 + x1) / 2, (z0 + z1) / 2];
  }
  // 도시 말: 차도가 아니라 인도 쪽 길 위
  streetSpot(near = null) {
    for (let i = 0; i < 30; i++) {
      const { point, type } = randomStreetPoint(this.rng);
      const off = (this.rng.chance(0.5) ? 1 : -1) * 5.6;
      if (type === 'X') point.x += off; else point.z += off;
      if (!near || Math.hypot(point.x - near.x, point.z - near.z) < 70) return [point.x, point.z];
    }
    return near ? [near.x, near.z] : [0, 0];
  }
  place(a) {
    if (ANIMALS[a.kind].city) { [a.x, a.z] = this.streetSpot(); a.tx = a.x; a.tz = a.z; a.hp = ANIMALS[a.kind].hp; a.dead = false; a.angry = null; a.gone = false; a.rider = null; a.ay = 0; return; }
    [a.x, a.z] = this.randomPoint(a.kind);
    a.tx = a.x; a.tz = a.z; a.hp = ANIMALS[a.kind].hp; a.dead = false; a.angry = null; a.gone = false;
    a.ay = ANIMALS[a.kind].fly ? this.rng.range(14, 30) : 0;
  }

  inRange(a) {
    return this.rects(a.kind).some(([x0, z0, x1, z1]) => a.x > x0 - 30 && a.x < x1 + 30 && a.z > z0 - 30 && a.z < z1 + 30);
  }

  tick(dt) {
    // 땅 동물: 차 안이나 하늘(날기·높은 곳)에 있는 플레이어는 공격하지 않는다. 드래곤은 하늘도 공격
    const outside = [...this.w.players.values()].filter((p) => !p.dead && p.loc < 0 && !p.jailed);
    const players = outside.filter((p) => p.car < 0 && !(p.air & 2) && p.pos.y - terrainH(p.pos.x, p.pos.z) < 3);
    const flyers = outside.filter((p) => p.car < 0);
    for (const a of this.list) {
      const d = ANIMALS[a.kind];
      if (a.dead) { a.deadT -= dt; if (a.deadT <= 0) this.place(a); continue; }
      if (d.fly) { this.tickDragon(a, d, dt, outside, flyers); continue; }
      if (d.city) { this.tickSteed(a, d, dt, outside); continue; }
      // 가장 가까운 플레이어 (아무도 근처에 없으면 쉬고 있는다 → 서버 부담 ↓)
      let tgt = null, td = 1e9;
      let near = 1e9;
      for (const p of outside) near = Math.min(near, Math.hypot(p.pos.x - a.x, p.pos.z - a.z));
      if (near > 320) { a.mv = 0; continue; }
      for (const p of players) { const dd = Math.hypot(p.pos.x - a.x, p.pos.z - a.z); if (dd < td) { td = dd; tgt = p; } }
      a.atkT -= dt; a.angryT -= dt; a.t -= dt;
      if (a.angry && a.angryT > 0) { const p = this.w.players.get(a.angry); if (p && players.includes(p)) { tgt = p; td = Math.hypot(p.pos.x - a.x, p.pos.z - a.z); } }
      let speed = 0, mx = 0, mz = 0;
      if (d.livestock) {
        // 가축: 우리 안에서 느긋하게
        if (a.t <= 0) { a.t = this.rng.range(4, 10); [a.tx, a.tz] = this.randomPoint(a.kind); if (this.rng.chance(0.4)) { a.tx = a.x; a.tz = a.z; } }
        speed = d.speed;
      } else if (d.hostile && tgt && (td < d.aggro || (a.angry && a.angryT > 0)) && td < 60) {
        // 맹수: 쫓아가서 공격
        a.tx = tgt.pos.x; a.tz = tgt.pos.z; speed = d.run;
        // 같은 높이에 있을 때만 문다 (위에 있으면 못 닿는다)
        if (td < d.r + 1.4 && Math.abs(tgt.pos.y - terrainH(a.x, a.z)) < 2.5) {
          speed = 0;
          if (a.atkT <= 0) {
            a.atkT = 1.4;
            a.attacking = 0.4;
            this.w.combat.damagePlayer(tgt, d.dmg, { name: `${d.emoji} ${d.name}` }, { x: a.x, y: 0, z: a.z });
          }
        }
      } else if (!d.hostile && tgt && (td < (d.flee || 0) || (a.angry && a.angryT > 0))) {
        // 사냥감: 반대쪽으로 도망
        const dx = a.x - tgt.pos.x, dz = a.z - tgt.pos.z, L = Math.hypot(dx, dz) || 1;
        a.tx = a.x + (dx / L) * 20; a.tz = a.z + (dz / L) * 20; speed = d.run;
      } else {
        if (a.t <= 0 || Math.hypot(a.tx - a.x, a.tz - a.z) < 1.5) {
          a.t = this.rng.range(5, 14);
          if (this.rng.chance(0.35)) { a.tx = a.x; a.tz = a.z; } else { [a.tx, a.tz] = [a.x + this.rng.range(-40, 40), a.z + this.rng.range(-40, 40)]; }
        }
        speed = d.speed;
        if (!this.inRange(a)) [a.tx, a.tz] = this.randomPoint(a.kind);
      }
      a.attacking = Math.max(0, (a.attacking || 0) - dt);
      // 체력이 절반 아래면 지쳐서 느릿느릿 → 포획 기회
      if (!d.livestock && a.hp <= d.hp * 0.5) speed = Math.min(speed, d.speed * 0.6);
      const dx = a.tx - a.x, dz = a.tz - a.z, L = Math.hypot(dx, dz);
      if (L > 0.5 && speed > 0) {
        mx = dx / L; mz = dz / L;
        const nx = a.x + mx * speed * dt, nz = a.z + mz * speed * dt;
        // 땅 동물은 깊은 물에 안 들어가고, 아무도 도시로는 안 들어온다
        const h = terrainH(nx, nz);
        const inPark = nx > PARK.x0 - 15 && nx < PARK.x1 + 15 && nz > PARK.z0 - 15 && nz < PARK.z1 + 15;
        const blocked = (Math.abs(nx) < HALF + 25 && Math.abs(nz) < HALF + 25) || inPark || (!d.swim && h < WATER_Y + 0.1);
        if (blocked) { a.t = 0; a.tx = a.x - mx * 10; a.tz = a.z - mz * 10; }
        else { a.x = nx; a.z = nz; a.h = Math.atan2(mx, mz); }
        a.mv = speed > d.speed + 0.5 ? 2 : 1;
      } else a.mv = 0;
    }
  }

  // 드래곤: 협곡 하늘을 돌다가 플레이어(날고 있어도)를 보면 다가가 불을 뿜는다.
  // 체력이 절반 아래로 떨어지면 지쳐서 땅에 내려앉는다 → 포획 기회
  tickDragon(a, d, dt, outside, flyers) {
    let near = 1e9;
    for (const p of outside) near = Math.min(near, Math.hypot(p.pos.x - a.x, p.pos.z - a.z));
    if (near > 320) { a.mv = 0; return; }
    a.atkT -= dt; a.angryT -= dt; a.t -= dt; a.breath = Math.max(0, a.breath - dt);
    const tired = a.hp <= d.hp * 0.5;
    const gy = Math.max(terrainH(a.x, a.z), WATER_Y);
    const eye = (p) => Math.hypot(p.pos.x - a.x, p.pos.z - a.z, p.pos.y - (gy + a.ay + d.h * 0.5));
    let tgt = null, td = 1e9;
    for (const p of flyers) { const dd = eye(p); if (dd < td) { td = dd; tgt = p; } }
    if (a.angry && a.angryT > 0) { const p = this.w.players.get(a.angry); if (p && flyers.includes(p)) { tgt = p; td = eye(p); } }
    let wantY, speed;
    a.fbT = (a.fbT ?? 3) - dt;
    if (a.breath > 0) this.breathTick(a, d, dt, flyers, gy);
    if (tired) {
      // 지쳐서 내려앉아 천천히 걷는다
      wantY = 0; speed = d.speed * 0.5;
      if (a.t <= 0) { a.t = this.rng.range(4, 9); a.tx = a.x + this.rng.range(-12, 12); a.tz = a.z + this.rng.range(-12, 12); }
      if (tgt && td < 10 && a.atkT <= 0) this.breathe(a, d, tgt);
      if (tgt) a.h = Math.atan2(tgt.pos.x - a.x, tgt.pos.z - a.z);
    } else if (tgt && (td < d.aggro || (a.angry && a.angryT > 0)) && td < 90) {
      // 대상 옆 9m 정도에서 맴돌며 불 뿜기, 멀면 불덩이를 날린다
      const pg = terrainH(tgt.pos.x, tgt.pos.z);
      wantY = Math.max(6, tgt.pos.y - pg + 4);
      const dx = a.x - tgt.pos.x, dz = a.z - tgt.pos.z, L = Math.hypot(dx, dz) || 1;
      a.tx = tgt.pos.x + (dx / L) * 9; a.tz = tgt.pos.z + (dz / L) * 9; speed = a.breath > 0 ? d.speed : d.run;
      if (td < 17 && a.atkT <= 0) this.breathe(a, d, tgt);
      else if (td > 20 && td < 60 && a.fbT <= 0 && a.breath <= 0) this.fireball(a, d, tgt, gy);
      a.h = Math.atan2(tgt.pos.x - a.x, tgt.pos.z - a.z);
    } else {
      wantY = a.wantY ?? 22; speed = d.speed;
      if (a.t <= 0 || Math.hypot(a.tx - a.x, a.tz - a.z) < 3) {
        a.t = this.rng.range(6, 14); a.wantY = this.rng.chance(0.2) ? 0 : this.rng.range(14, 34);
        [a.tx, a.tz] = this.rng.chance(0.5) ? this.randomPoint(a.kind) : [a.x + this.rng.range(-60, 60), a.z + this.rng.range(-60, 60)];
      }
      if (!this.inRange(a)) [a.tx, a.tz] = this.randomPoint(a.kind);
    }
    a.ay += Math.max(-6 * dt, Math.min(7 * dt, wantY - a.ay));
    a.ay = Math.max(0, a.ay);
    const dx = a.tx - a.x, dz = a.tz - a.z, L = Math.hypot(dx, dz);
    if (L > 0.8) {
      const st = Math.min(L, speed * dt);
      const nx = a.x + (dx / L) * st, nz = a.z + (dz / L) * st;
      if (Math.abs(nx) < HALF + 25 && Math.abs(nz) < HALF + 25) { a.t = 0; a.tx = a.x - dx; a.tz = a.z - dz; }
      else { a.x = nx; a.z = nz; if (!tgt || td >= 16) a.h = Math.atan2(dx, dz); }
      a.mv = speed > d.speed + 0.5 ? 2 : 1;
    } else a.mv = 0;
  }
  // 불길: 1.6초 동안 뿜으며 0.3초마다 입 앞 원뿔 안을 태운다 (+ 화상)
  breathe(a, d, p) {
    a.atkT = 4.4; a.breath = 1.6; a.attacking = 1.6; a.btick = 0.15;
    a.aimY = p.pos.y;
  }
  mouth(a, d, gy) {
    const s = d.size || 1;
    return { x: a.x + Math.sin(a.h) * d.r * s, y: gy + a.ay + d.h * 0.85 * s, z: a.z + Math.cos(a.h) * d.r * s };
  }
  breathTick(a, d, dt, flyers, gy) {
    if ((a.btick -= dt) > 0) return;
    a.btick = 0.3;
    const m = this.mouth(a, d, gy), len = d.size > 1 ? 17 : 12;
    // 입에서 대상 쪽(아래로 기울여)으로
    const dir = { x: Math.sin(a.h), y: ((a.aimY ?? m.y) - m.y) / len, z: Math.cos(a.h) };
    const dl = Math.hypot(dir.x, dir.y, dir.z); dir.x /= dl; dir.y /= dl; dir.z /= dl;
    const who = { name: `${d.emoji} ${d.name}의 불길` };
    for (const p of flyers) {
      const vx = p.pos.x - m.x, vy = p.pos.y + 1 - m.y, vz = p.pos.z - m.z, L = Math.hypot(vx, vy, vz);
      if (L > len || L < 0.1 || (vx * dir.x + vy * dir.y + vz * dir.z) / L < 0.7) continue;
      this.w.combat.damagePlayer(p, d.dmg * 0.22, who, m);
      this.w.combat.burnPlayer(p, d.size > 1 ? 5 : 2.5, 3, who);
    }
  }
  // 불덩이: 멀리 있는 대상에게 날려 터뜨린다 (날아가는 동안 피할 수 있다)
  fireball(a, d, p, gy) {
    a.fbT = this.rng.range(5, 8); a.attacking = 0.6;
    const m = this.mouth(a, d, gy);
    const to = { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z };
    const dist = Math.hypot(to.x - m.x, to.y - m.y, to.z - m.z), t = dist / 30;
    this.w.broadcast({ t: 'fx', k: 'dball', p: [m.x, m.y, m.z], b: [to.x, to.y, to.z], t, loc: -1 });
    const big = (d.size || 1) > 1;
    setTimeout(() => this.w.combat.explodeAt({ x: to.x, y: to.y, z: to.z, distanceTo(o) { return Math.hypot(o.x - this.x, o.y - this.y, o.z - this.z); } }, -1, big ? 6 : 4, d.dmg * (big ? 1.5 : 1.2), null, { burn: big ? 6 : 3, kind: 'fire' }), t * 1000);
  }

  // 포획: 체력이 절반 이하(가축은 언제나)일 때 타이밍을 맞추면 성공 → 가방에 탈것으로
  capture(p, id, ok) {
    const a = this.list[id];
    if (!a || a.dead || p.dead || p.loc >= 0 || p.car >= 0) return;
    const d = ANIMALS[a.kind];
    if (Date.now() - (p.lastCapture || 0) < 1200) return;
    p.lastCapture = Date.now();
    const ay = terrainH(a.x, a.z) + a.ay;
    if (Math.hypot(a.x - p.pos.x, a.z - p.pos.z, (p.pos.y - ay) * 0.5) > d.r * (d.size || 1) + 13) { this.w.send(p, { t: 'captureFail', reason: '너무 멀어요! 더 가까이 가세요' }); return; }
    if (!d.livestock && a.hp > d.hp * 0.5) { this.w.send(p, { t: 'captureFail', reason: '아직 너무 쌩쌩해요. 체력을 절반 아래로 깎아요' }); return; }
    if (!ok) {
      a.angry = p.id; a.angryT = 20;
      this.w.send(p, { t: 'captureFail', reason: `${d.emoji} 타이밍이 빗나갔어요! ${d.name}이(가) 화났어요` });
      return;
    }
    a.dead = true; a.gone = true; a.deadT = 120; a.mv = 0;
    this.w.send(p, { t: 'captured', kind: a.kind });
    if (d.xp) this.w.send(p, { t: 'xp', v: Math.round(d.xp * 1.2), reason: `${d.emoji} ${d.name} 포획` });
    if (d.fly || ['tiger', 'bear', 'jaguar', 'croc', 'anaconda'].includes(a.kind)) this.w.broadcast({ t: 'sys', text: `🪢 ${p.name}님이 ${d.emoji} ${d.name}을(를) 포획했어요!` });
  }

  // 사냥 (플레이어가 때림)
  damage(a, dmg, p) {
    const d = ANIMALS[a.kind];
    if (a.dead || d.livestock) return false;
    a.hp -= dmg;
    a.angry = p.id; a.angryT = 25;
    this.w.broadcast({ t: 'fx', k: 'dmgnum', p: [a.x, terrainH(a.x, a.z) + a.ay + d.h * (d.size || 1) + 0.8, a.z], v: Math.round(dmg), loc: -1 });
    if (a.hp > 0) return true;
    a.dead = true; a.deadT = d.fly ? 240 : 90; a.mv = 0; a.ay = 0;
    const y = Math.max(terrainH(a.x, a.z), WATER_Y) + 0.1;
    for (const [id, n, chance] of d.loot) if (this.rng.chance(chance)) this.w.combat.dropItem({ id, n, gems: [] }, a.x + this.rng.range(-1, 1), y, a.z + this.rng.range(-1, 1), -1, 180);
    this.w.send(p, { t: 'xp', v: d.xp, reason: `${d.emoji} ${d.name} 사냥` });
    this.w.send(p, { t: 'hunted', kind: a.kind });
    return true;
  }

  // 플레이어 근처의 동물만 보낸다 [id, x, z, 방향, 움직임, 체력%, 상태, 공중 높이]
  // 상태: 1 쓰러짐, 2 공격 중, 4 불 뿜는 중, 8 포획돼 사라짐
  // 도시 말: 누가 타고 있으면 숨겨 두고(gone), 아니면 길을 따라 천천히 걷는다
  tickSteed(a, d, dt, outside) {
    if (a.gone) { a.mv = 0; return; }
    if (!outside.some((p) => Math.hypot(p.pos.x - a.x, p.pos.z - a.z) < 320)) { a.mv = 0; return; }
    a.t -= dt;
    if (a.t <= 0 || Math.hypot(a.tx - a.x, a.tz - a.z) < 1.5) { a.t = this.rng.range(6, 16); if (this.rng.chance(0.35)) { a.tx = a.x; a.tz = a.z; } else [a.tx, a.tz] = this.streetSpot(a); }
    const dx = a.tx - a.x, dz = a.tz - a.z, L = Math.hypot(dx, dz);
    if (L > 0.5) { a.h = Math.atan2(dx, dz); a.x += (dx / L) * d.speed * dt; a.z += (dz / L) * d.speed * dt; a.mv = 1; this.w.sim.pushOut(a, 0.9); } else a.mv = 0;
  }
  // 플레이어가 올라탐 / 내림 (main.js 의 E · F)
  rideSteed(p, id) {
    const a = this.list[id];
    if (!a || !ANIMALS[a.kind].city || a.gone || p.loc !== -1 || Math.hypot(a.x - p.pos.x, a.z - p.pos.z) > 6) return false;
    a.gone = true; a.rider = p.id;
    return true;
  }
  leaveSteed(p, id) {
    const a = this.list[id];
    if (!a || a.rider !== p.id) return;
    a.gone = false; a.rider = null; a.x = p.pos.x; a.z = p.pos.z; a.h = p.heading || 0; a.tx = a.x; a.tz = a.z; a.t = 3;
  }
  dropRider(p) { for (const a of this.list) if (a.rider === p.id) this.place(a); } // 탄 채로 나가면 말은 길로 돌아간다
  snap() {
    const outside = [...this.w.players.values()].filter((p) => p.loc < 0);
    const players = outside.filter((p) => Math.abs(p.pos.x) > HALF - 80 || Math.abs(p.pos.z) > HALF - 80);
    if (!outside.length) return [];
    const out = [];
    for (const a of this.list) {
      if (!(ANIMALS[a.kind].city ? outside : players).some((p) => Math.abs(p.pos.x - a.x) < 300 && Math.abs(p.pos.z - a.z) < 300)) continue;
      out.push(a.id, q(a.x), q(a.z), q(a.h, 100), a.mv, Math.round((a.hp / ANIMALS[a.kind].hp) * 100), (a.dead ? 1 : 0) | (a.attacking > 0 ? 2 : 0) | (a.breath > 0 ? 4 : 0) | (a.gone ? 8 : 0), q(a.ay));
    }
    return out;
  }
  kinds() { return this.list.map((a) => ANIMAL_KINDS.indexOf(a.kind)); }
}
