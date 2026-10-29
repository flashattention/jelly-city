// 거대 젤리의 습격 (서버): 누가 접속해 있으면 늘 최소 TITAN_MIN 마리(작은·중간·큰 것)가 있고,
// TITAN_EVERY 초마다 한 마리씩 늘어 TITAN_MAX 마리까지. 도시 밖에서 걸어 들어와 플레이어를 쫓아 짓밟는다.
// 하늘갈고리 장비로 뒷목을 베어야만 쓰러진다 (총·마법·폭발 등은 효과 없음)
import { terrainH } from '../../public/jelly-city/js/terrain.js';
import { HALF, GRID, roadC } from '../../public/jelly-city/js/config.js';
import { RNG } from '../../public/shared/js/utils.js';
import { TITAN, napePos, napeReach, titanHeight, napeHits } from '../../public/jelly-city/js/titans.js';

// 도시 안에서는 도로(가운데 줄)를 따라서만 걷는다 → 건물 속으로 들어가지 않는다
const ROADS = Array.from({ length: GRID + 1 }, (_, i) => roadC(i));
const nearRoad = (v) => ROADS.reduce((b, r) => (Math.abs(r - v) < Math.abs(b - v) ? r : b), ROADS[0]);
const footR = (s) => Math.min(5, 0.3 * s); // 발이 차지하는 넓이 (도로 폭 14m 안에 들어가게)

const MIN = Number(process.env.TITAN_MIN) || 3;        // 누가 접속해 있으면 늘 이만큼은 있다
const MAX = Number(process.env.TITAN_MAX) || 10;       // 최대 마릿수
const EVERY = Number(process.env.TITAN_EVERY) || 30;   // 몇 초마다 한 마리씩 늘어나나
const REFILL = 10;                                      // 쓰러뜨려 MIN 아래로 줄면 다시 채우기까지 (초)
const STILL = process.env.TITAN_STILL === '1';          // 시험용: 거대 젤리가 제자리에 서 있는다

export class Titans {
  constructor(world) {
    this.w = world;
    this.rng = new RNG(4242);
    this.list = [];
    this.nextId = 1;
    this.addT = EVERY; this.refillT = 0;
  }
  ground(x, z) { return Math.abs(x) < HALF && Math.abs(z) < HALF ? 0 : Math.max(0, terrainH(x, z)); }

  tick(dt) {
    const outside = [...this.w.players.values()].filter((p) => !p.dead && p.loc === -1 && !p.jailed);
    if (this.w.players.size) {
      const alive = this.list.filter((t) => !t.dead).length;
      if (alive === 0) this.raid(); // 누가 접속하자마자: 작은·중간·큰 거대 젤리가 한꺼번에
      else if (alive < MIN) { this.refillT -= dt; if (this.refillT <= 0) { this.refillT = REFILL; this.spawn(); this.w.broadcast({ t: 'titanNew', n: alive + 1 }); } }
      else this.refillT = REFILL;
      // 그 뒤로 일정 시간마다 한 마리씩 (최대까지)
      this.addT -= dt;
      if (this.addT <= 0) { this.addT = EVERY; if (alive > 0 && alive < MAX) { this.spawn(); this.w.broadcast({ t: 'titanNew', n: alive + 1 }); } }
    }
    for (const t of [...this.list]) this.update(t, dt, outside);
  }

  raid(n = MIN) {
    // 크기를 고르게: 작은 것부터 큰 것까지 나눠서
    for (let i = 0; i < n; i++) {
      const lo = TITAN.minS + ((TITAN.maxS - TITAN.minS) * i) / n, hi = TITAN.minS + ((TITAN.maxS - TITAN.minS) * (i + 1)) / n;
      this.spawn(this.rng.range(lo, hi));
    }
    this.addT = EVERY; this.refillT = REFILL;
    this.w.broadcast({ t: 'sys', text: `🚨 거대 젤리 ${n}마리가 도시를 습격합니다! ${EVERY}초마다 한 마리씩 늘어나요 (최대 ${MAX}마리) · 하늘갈고리 장비(🪝 가방·핫바에 있어요, 없으면 U 상점 → 젤리 택티컬)로 뒷목을 노리세요!` });
    this.w.broadcast({ t: 'titanRaid', n });
  }
  spawn(size = this.rng.range(TITAN.minS, TITAN.maxS)) {
    // 도시 바깥 둘레에서 걸어 들어온다
    const a = this.rng.range(0, Math.PI * 2), R = HALF + this.rng.range(40, 90);
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const t = { id: this.nextId++, x, z, y: this.ground(x, z), h: Math.atan2(-x, -z), s: size, c: this.rng.int(0, TITAN.colors.length - 1), state: 0, atkT: 3, t: 0, life: 0, dead: false, deadT: 0, gx: 0, gz: 0, noEffT: 0, napeT: 0, ax: null };
    t.hp = t.maxHp = napeHits(size);
    this.pickGoal(t);
    this.list.push(t);
    return t;
  }
  pickGoal(t) { t.gx = this.rng.range(-HALF * 0.8, HALF * 0.8); t.gz = this.rng.range(-HALF * 0.8, HALF * 0.8); t.t = this.rng.range(12, 25); }

  update(t, dt, outside) {
    if (t.dead) { t.deadT -= dt; if (t.deadT <= 0) this.list = this.list.filter((x) => x !== t); return; }
    t.napeT -= dt;
    if (STILL) return;
    t.life += dt; t.t -= dt; t.atkT -= dt; t.noEffT -= dt;
    // 땅 가까이에 있는 가장 가까운 플레이어를 쫓는다 (200m 안). 갈고리로 높이 떠 있는 사람은 못 쫓는다 → 그 틈에 뒷목을 노린다
    const H0 = titanHeight(t.s);
    let tgt = null, td = 200;
    for (const p of outside) { if (p.pos.y - t.y > H0 * 0.3) continue; const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z); if (d < td) { td = d; tgt = p; } }
    // 8분이 지나도 아무도 근처에 없으면 떠난다
    if (t.life > 480 && !tgt) { this.list = this.list.filter((x) => x !== t); return; }
    if (!tgt && (t.t <= 0 || Math.hypot(t.gx - t.x, t.gz - t.z) < 25)) this.pickGoal(t);
    const gx = tgt ? tgt.pos.x : t.gx, gz = tgt ? tgt.pos.z : t.gz;
    const reach = 0.9 * t.s;
    const close = tgt && td < reach; // 닿는 거리면 멈춰서 그쪽을 본다
    const sp = 2.2 + t.s * 0.12;
    // 가려는 방향: 가까우면 플레이어 쪽, 아니면 도로를 따라
    const [mx, mz] = close ? [gx - t.x, gz - t.z] : this.nav(t, gx, gz, sp * dt);
    const want = Math.atan2(mx, mz);
    let dh = want - t.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    t.h += Math.max(-dt * 0.8, Math.min(dt * 0.8, dh)); // 거대해서 천천히 돈다
    if (tgt && td < reach && Math.abs(dh) < 0.8) {
      // 짓밟기 · 내려치기: 앞쪽 발밑 근처, 너무 높이 떠 있으면(뒷목 근처 등) 못 맞힌다
      t.state = t.atkT > 2.1 ? 1 : 0;
      if (t.atkT <= 0) {
        t.atkT = 2.8; t.state = 1;
        const ax = t.x + Math.sin(t.h) * 0.6 * t.s, az = t.z + Math.cos(t.h) * 0.6 * t.s;
        this.w.broadcast({ t: 'fx', k: 'boom', p: [ax, t.y + 0.5, az], r: 0.5 * t.s, loc: -1 });
        for (const p of outside) {
          if (p.car >= 0 || Math.hypot(p.pos.x - ax, p.pos.z - az) > 0.55 * t.s || p.pos.y - t.y > 6) continue; // 발로 짓밟기: 땅 가까이만
          this.w.combat.damagePlayer(p, 45, { name: '🧸 거대 젤리' }, { x: t.x, y: t.y, z: t.z });
          const dx = p.pos.x - ax, dz = p.pos.z - az, L = Math.hypot(dx, dz) || 1;
          if (!p.emote) this.w.send(p, { t: 'knock', kind: 'titan', x: (dx / L) * 14, z: (dz / L) * 14, up: 9 });
        }
      }
    } else {
      t.state = 0;
      // 방향을 다 틀고 나서 걷는다 (모퉁이에서 제자리 돌기)
      if (!close && Math.abs(dh) < 0.45) {
        const L = Math.hypot(mx, mz) || 1, k = Math.min(sp * dt, L);
        t.x += (mx / L) * k; t.z += (mz / L) * k;
      }
    }
    this.pushOut(t);
    t.y = this.ground(t.x, t.z);
  }

  // 도로 따라 걷기: 교차로에서만 방향을 정한다. 돌려주는 값 = 이번에 움직일 방향 (x, z)
  nav(t, gx, gz, step) {
    const edge = HALF - 1;
    if (Math.abs(t.x) > edge + 6 || Math.abs(t.z) > edge + 6) {
      // 도시 밖: 가장 가까운 도로 끝(입구)으로 걸어 들어온다
      t.ax = null;
      const side = Math.abs(t.x) > Math.abs(t.z);
      const cx = Math.max(-edge, Math.min(edge, t.x)), cz = Math.max(-edge, Math.min(edge, t.z));
      const ex = side ? Math.sign(t.x) * (HALF + 4) : nearRoad(cx), ez = side ? nearRoad(cz) : Math.sign(t.z) * (HALF + 4);
      t.ax0 = side ? 'x' : 'z';
      return [ex - t.x, ez - t.z];
    }
    if (!t.ax) {
      // 도로에 올라선다
      const rz = nearRoad(t.z), rx = nearRoad(t.x);
      if (t.ax0 ? t.ax0 === 'x' : Math.abs(t.z - rz) <= Math.abs(t.x - rx)) { t.ax = 'x'; t.road = rz; } else { t.ax = 'z'; t.road = rx; }
      t.dir = Math.sign(t.ax === 'x' ? gx - t.x : gz - t.z) || 1; t.lastCross = null;
    }
    const X = t.ax === 'x';
    const along = X ? t.x : t.z, perp = X ? t.z : t.x;
    const gA = X ? gx : gz, gP = X ? gz : gx;
    const cross = nearRoad(along);
    if (Math.abs(along - cross) < Math.max(1, step * 1.5) && t.lastCross !== cross) {
      // 교차로: 옆으로 더 가야 하면 꺾는다 · 도시 끝이면 반드시 꺾는다
      t.lastCross = cross;
      const dA = gA - along, dP = gP - t.road;
      const atEnd = (cross === ROADS[0] && t.dir < 0) || (cross === ROADS[GRID] && t.dir > 0);
      if (atEnd || Math.abs(dP) > Math.abs(dA) + 4 || (Math.abs(dA) < 6 && Math.abs(dP) > 6)) {
        const old = t.road;
        t.ax = X ? 'z' : 'x'; t.road = cross; t.lastCross = old;
        let d = Math.sign(dP) || 1;
        if ((old === ROADS[0] && d < 0) || (old === ROADS[GRID] && d > 0)) d = -d;
        t.dir = d;
        return this.nav(t, gx, gz, step);
      }
      if (dA * t.dir < 0 && Math.abs(dA) > 6) t.dir = -t.dir; // 지나쳤으면 돌아선다
    } else if ((gA - along) * t.dir < -12 && Math.abs(gP - t.road) < 10) t.dir = -t.dir; // 같은 길 뒤쪽에 있으면 돌아선다
    // 길 가운데로 붙으면서 앞으로
    const fix = Math.max(-1, Math.min(1, (t.road - perp) / Math.max(step, 0.01)));
    return X ? [t.dir, fix] : [fix, t.dir];
  }
  // 그래도 건물에 걸치면 밀어낸다 (도시 밖 건물 등)
  pushOut(t) {
    const r = footR(t.s);
    for (const b of this.w.combat.boxes) {
      if (t.x < b.minX - r || t.x > b.maxX + r || t.z < b.minZ - r || t.z > b.maxZ + r) continue;
      const cx = Math.max(b.minX, Math.min(t.x, b.maxX)), cz = Math.max(b.minZ, Math.min(t.z, b.maxZ));
      let dx = t.x - cx, dz = t.z - cz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-3) { // 한가운데: 가장 가까운 면으로
        const pen = [[t.x - b.minX, -1, 0], [b.maxX - t.x, 1, 0], [t.z - b.minZ, 0, -1], [b.maxZ - t.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        dx = pen[1]; dz = pen[2]; d = 0; t.x += dx * (pen[0] + r); t.z += dz * (pen[0] + r); continue;
      }
      t.x += (dx / d) * (r - d); t.z += (dz / d) * (r - d);
    }
  }

  // 공격받음: 하늘갈고리 장비로, 뒷목 가까이에서, 뒤쪽에서 벤 것만 통한다
  hit(p, msg) {
    const t = this.list.find((x) => x.id === +msg.id);
    if (!t || t.dead || p.loc !== -1) return;
    const n = napePos(t);
    const chest = { x: p.pos.x, y: p.pos.y + 1.1, z: p.pos.z };
    const dn = Math.hypot(chest.x - n.x, chest.y - n.y, chest.z - n.z);
    const fx = Math.sin(t.h), fz = Math.cos(t.h);
    const behind = (p.pos.x - t.x) * fx + (p.pos.z - t.z) * fz < 0.3 * t.s; // 몸 앞쪽(얼굴 쪽)만 아니면
    if (msg.w === 'odm_gear' && dn < napeReach(t.s) + 2 && behind) {
      if (t.napeT > 0) return; // 같은 칼질이 두 번 들어오지 않게
      t.napeT = 0.3; t.hp -= 1;
      if (t.hp <= 0) return this.kill(t, p);
      // 큰 거대 젤리: 아직 버틴다 (뒷목이 깊게 패였다)
      return this.w.broadcast({ t: 'fx', k: 'napehit', id: t.id, p: [n.x, n.y, n.z], hp: t.hp, max: t.maxHp, pid: p.id, loc: -1 });
    }
    if (msg.w !== 'odm_gear' || t.noEffT > 0) return; // 다른 무기는 쏜 사람 화면에서 바로 '효과 없음'을 보여 준다
    t.noEffT = 0.6;
    this.w.send(p, { t: 'fx', k: 'noeffect', p: [chest.x, chest.y + 1.5, chest.z], text: '뒷목(빨간 과녁)을 뒤에서 베어야 해요!', loc: -1 });
  }
  kill(t, p) {
    t.dead = true; t.deadT = 14; t.state = 2;
    const n = napePos(t);
    this.w.broadcast({ t: 'fx', k: 'titandown', id: t.id, p: [n.x, n.y, n.z], pid: p.id, loc: -1 });
    this.w.broadcast({ t: 'sys', text: `⚔️ ${p.name}님이 거대 젤리의 뒷목을 베어 쓰러뜨렸어요!` });
    this.w.send(p, { t: 'xp', v: Math.round(150 + t.s * 15), reason: '🧸 거대 젤리 토벌' });
    this.w.combat.dropItem({ id: 'cash', n: Math.round(100 + t.s * 10) }, t.x, t.y + 0.3, t.z, -1, 120);
    const left = this.list.filter((x) => !x.dead).length;
    if (left < MIN) this.w.broadcast({ t: 'sys', text: `🧸 남은 거대 젤리 ${left}마리 · 곧 다시 몰려와요!` });
  }
  // 스냅샷: [id, x, z, 방향, 크기, 상태(0 걷기 · 1 공격 · 2 쓰러짐), 색, 남은 뒷목 횟수, 최대]
  snap() {
    const a = [];
    for (const t of this.list) a.push(t.id, Math.round(t.x * 10), Math.round(t.z * 10), Math.round(t.h * 100), Math.round(t.s * 10), t.state, t.c, Math.max(0, t.hp), t.maxHp);
    return a;
  }
}
