// 거대 젤리의 습격 (서버): 가끔 1~TITAN_MAX 마리가 도시 밖에서 걸어 들어와 플레이어를 쫓아 짓밟는다.
// 젤리병단 장비로 뒷목을 베어야만 쓰러진다 (총·마법·폭발 등은 효과 없음)
import { terrainH } from '../public/js/terrain.js';
import { HALF } from '../public/js/config.js';
import { RNG } from '../public/js/utils.js';
import { TITAN, napePos, napeReach, titanHeight } from '../public/js/titans.js';

const MAX = Number(process.env.TITAN_MAX) || 3;        // 한 번에 최대 몇 마리
const EVERY = Number(process.env.TITAN_EVERY) || 420;  // 습격이 끝나고 다음 습격까지 (초)
const FIRST = Number(process.env.TITAN_FIRST) || 180;  // 서버가 켜지고 첫 습격까지 (초, 누군가 접속해 있을 때만 흐른다)
const STILL = process.env.TITAN_STILL === '1';          // 시험용: 거대 젤리가 제자리에 서 있는다

export class Titans {
  constructor(world) {
    this.w = world;
    this.rng = new RNG(4242);
    this.list = [];
    this.nextId = 1;
    this.raidT = FIRST;
  }
  ground(x, z) { return Math.abs(x) < HALF && Math.abs(z) < HALF ? 0 : Math.max(0, terrainH(x, z)); }

  tick(dt) {
    const outside = [...this.w.players.values()].filter((p) => !p.dead && p.loc === -1 && !p.jailed);
    if (!this.list.some((t) => !t.dead)) {
      if (outside.length) this.raidT -= dt;
      if (this.raidT <= 0) this.raid();
    }
    for (const t of [...this.list]) this.update(t, dt, outside);
  }

  raid(n = this.rng.int(1, MAX)) {
    for (let i = 0; i < n; i++) this.spawn();
    this.raidT = EVERY;
    this.w.broadcast({ t: 'sys', text: `🚨 거대 젤리 ${n}마리가 도시를 습격합니다! 젤리병단 장비로 뒷목을 노리세요!` });
    this.w.broadcast({ t: 'titanRaid', n });
  }
  spawn() {
    // 도시 바깥 둘레에서 걸어 들어온다
    const a = this.rng.range(0, Math.PI * 2), R = HALF + this.rng.range(40, 90);
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const t = { id: this.nextId++, x, z, y: this.ground(x, z), h: Math.atan2(-x, -z), s: this.rng.range(TITAN.minS, TITAN.maxS), c: this.rng.int(0, TITAN.colors.length - 1), state: 0, atkT: 3, t: 0, life: 0, dead: false, deadT: 0, gx: 0, gz: 0, noEffT: 0 };
    this.pickGoal(t);
    this.list.push(t);
    return t;
  }
  pickGoal(t) { t.gx = this.rng.range(-HALF * 0.8, HALF * 0.8); t.gz = this.rng.range(-HALF * 0.8, HALF * 0.8); t.t = this.rng.range(12, 25); }

  update(t, dt, outside) {
    if (t.dead) { t.deadT -= dt; if (t.deadT <= 0) this.list = this.list.filter((x) => x !== t); return; }
    if (STILL) return;
    t.life += dt; t.t -= dt; t.atkT -= dt; t.noEffT -= dt;
    // 땅 가까이에 있는 가장 가까운 플레이어를 쫓는다 (200m 안). 입체기동으로 높이 떠 있는 사람은 못 쫓는다 → 그 틈에 뒷목을 노린다
    const H0 = titanHeight(t.s);
    let tgt = null, td = 200;
    for (const p of outside) { if (p.pos.y - t.y > H0 * 0.3) continue; const d = Math.hypot(p.pos.x - t.x, p.pos.z - t.z); if (d < td) { td = d; tgt = p; } }
    // 8분이 지나도 아무도 근처에 없으면 떠난다
    if (t.life > 480 && !tgt) { this.list = this.list.filter((x) => x !== t); return; }
    if (!tgt && (t.t <= 0 || Math.hypot(t.gx - t.x, t.gz - t.z) < 10)) this.pickGoal(t);
    const gx = tgt ? tgt.pos.x : t.gx, gz = tgt ? tgt.pos.z : t.gz;
    const want = Math.atan2(gx - t.x, gz - t.z);
    let dh = want - t.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    t.h += Math.max(-dt * 0.55, Math.min(dt * 0.55, dh)); // 거대해서 천천히 돈다
    const reach = 0.9 * t.s, H = titanHeight(t.s);
    if (tgt && td < reach && Math.abs(dh) < 0.8) {
      // 짓밟기 · 내려치기: 앞쪽 발밑 근처, 너무 높이 떠 있으면(뒷목 근처 등) 못 맞힌다
      t.state = t.atkT > 2.1 ? 1 : 0;
      if (t.atkT <= 0) {
        t.atkT = 2.8; t.state = 1;
        const ax = t.x + Math.sin(t.h) * 0.6 * t.s, az = t.z + Math.cos(t.h) * 0.6 * t.s;
        this.w.broadcast({ t: 'fx', k: 'boom', p: [ax, t.y + 0.5, az], r: 0.5 * t.s, loc: -1 });
        for (const p of outside) {
          if (p.car >= 0 || Math.hypot(p.pos.x - ax, p.pos.z - az) > 0.55 * t.s || p.pos.y - t.y > H * 0.45) continue;
          this.w.combat.damagePlayer(p, 45, { name: '🧸 거대 젤리' }, { x: t.x, y: t.y, z: t.z });
          const dx = p.pos.x - ax, dz = p.pos.z - az, L = Math.hypot(dx, dz) || 1;
          if (!p.emote) this.w.send(p, { t: 'knock', x: (dx / L) * 14, z: (dz / L) * 14, up: 9 });
        }
      }
    } else {
      t.state = 0;
      const sp = 2.2 + t.s * 0.12;
      t.x += Math.sin(t.h) * sp * dt; t.z += Math.cos(t.h) * sp * dt;
    }
    t.y = this.ground(t.x, t.z);
  }

  // 공격받음: 젤리병단 장비로, 뒷목 가까이에서, 뒤쪽에서 벤 것만 통한다
  hit(p, msg) {
    const t = this.list.find((x) => x.id === +msg.id);
    if (!t || t.dead || p.loc !== -1) return;
    const n = napePos(t);
    const chest = { x: p.pos.x, y: p.pos.y + 1.1, z: p.pos.z };
    const dn = Math.hypot(chest.x - n.x, chest.y - n.y, chest.z - n.z);
    const fx = Math.sin(t.h), fz = Math.cos(t.h);
    const behind = (p.pos.x - t.x) * fx + (p.pos.z - t.z) * fz < 0.3 * t.s; // 몸 앞쪽(얼굴 쪽)만 아니면
    if (msg.w === 'odm_gear' && dn < napeReach(t.s) + 2 && behind) return this.kill(t, p);
    if (t.noEffT > 0) return;
    t.noEffT = 0.6;
    const why = msg.w !== 'odm_gear' ? '효과 없음! 젤리병단 장비로만 쓰러뜨릴 수 있어요' : '뒷목을 베어야 해요!';
    this.w.send(p, { t: 'fx', k: 'noeffect', p: [chest.x, chest.y + 1.5, chest.z], text: why, loc: -1 });
  }
  kill(t, p) {
    t.dead = true; t.deadT = 14; t.state = 2;
    const n = napePos(t);
    this.w.broadcast({ t: 'fx', k: 'titandown', id: t.id, p: [n.x, n.y, n.z], pid: p.id, loc: -1 });
    this.w.broadcast({ t: 'sys', text: `⚔️ ${p.name}님이 거대 젤리의 뒷목을 베어 쓰러뜨렸어요!` });
    this.w.send(p, { t: 'xp', v: Math.round(150 + t.s * 15), reason: '🧸 거대 젤리 토벌' });
    this.w.combat.dropItem({ id: 'cash', n: Math.round(100 + t.s * 10) }, t.x, t.y + 0.3, t.z, -1, 120);
    if (!this.list.some((x) => !x.dead)) this.w.broadcast({ t: 'sys', text: '🎉 거대 젤리를 모두 물리쳤어요! 도시가 다시 평화로워졌어요' });
  }
  // 스냅샷: [id, x, z, 방향, 크기, 상태(0 걷기 · 1 공격 · 2 쓰러짐), 색]
  snap() {
    const a = [];
    for (const t of this.list) a.push(t.id, Math.round(t.x * 10), Math.round(t.z * 10), Math.round(t.h * 100), Math.round(t.s * 10), t.state, t.c);
    return a;
  }
}
