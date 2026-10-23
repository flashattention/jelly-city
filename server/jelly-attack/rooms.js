// 젤리어택 방: 최대 12명 + 봇. 팀 데스매치 · 개인전. 맞았는지는 쏜 사람 화면이 알리고, 서버가 벽 · 거리 · 연사를 확인해서 피해를 준다
//   봇은 서버가 움직인다 (길찾기 격자 → 길 따라 이동 → 보이면 조준해서 쏜다)
import { BaseRooms, clean } from '../shared/rooms.js';
import { mapById, clearLine, rayBoxes } from '../../public/jelly-attack/js/maps.js';
import { weapon, PRIMARY, SECONDARY, KNIFE, NADE, nadeDmg, falloff } from '../../public/jelly-attack/js/weapons.js';

const MAP_IDS = ['depot', 'desert', 'factory', 'harbor'];
const TIME = Number(process.env.ATTACK_SEC) || 6 * 60; // 한 판 시간 (초)
const RESPAWN = 3000, PROTECT = 2000, EYE = 1.55;
const BOT_NAMES = ['젤리봇 딸기', '젤리봇 소다', '젤리봇 푸딩', '젤리봇 망고', '젤리봇 민트', '젤리봇 라임', '젤리봇 자두', '젤리봇 복숭아', '젤리봇 포도', '젤리봇 레몬', '젤리봇 체리', '젤리봇 키위'];
const BOT_COLORS = ['#ff8fb1', '#7cd8ff', '#ffd27a', '#ffb36b', '#9be7a7', '#c39bff', '#ff7a7a', '#ffc2d1', '#b39ddb', '#fff176', '#ef5350', '#aed581'];
const BOT_GUNS = ['m4', 'ak47', 'rifle', 'mp5', 'scar', 'shotgun', 'sniper', 'uzi'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class AttackRooms extends BaseRooms {
  teamChat(r) { return r.opts.mode !== 'ffa'; } // 팀 데스매치면 팀 채팅
  constructor(userOf) {
    super(userOf, { max: 12, hz: 20, countdown: 3000, defaults: { map: 'depot', mode: 'tdm', bots: 4 } });
    this.navs = new Map();
  }
  allow(cur, n) {
    return {
      map: MAP_IDS.includes(n.map) ? n.map : cur.map,
      mode: n.mode === 'ffa' || n.mode === 'tdm' ? n.mode : cur.mode,
      bots: Number.isInteger(n.bots) ? Math.max(0, Math.min(10, n.bots)) : cur.bots,
      team: (n.mode || cur.mode) === 'tdm',
    };
  }
  list() { return [...this.rooms.values()].filter((r) => !r.private).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    if (m.t === 'practice') return this.practice(c, m);
    return super.handle(c, m);
  }
  // 연습전: 누구나 (비로그인도) 혼자 봇들과 바로 시작
  practice(c, m) {
    if (!c.hi) return;
    this.leave(c);
    const r = { id: this.newCode(), name: `${c.name}의 연습전`, players: [], host: c, state: 'wait', startAt: 0, private: true, opts: this.allow({ ...this.o.defaults }, { ...(m.opts || {}), bots: Math.max(1, Math.min(10, Number(m.opts?.bots) || 6)) }) };
    this.rooms.set(r.id, r);
    this.join(c, r);
    this.handle(c, { t: 'start' });
  }
  // ---------- 시작 ----------
  onStart(r) {
    r.map = mapById(r.opts.map);
    r.score = { red: 0, blue: 0 };
    r.endAt = Date.now() + this.o.countdown + TIME * 1000;
    r.limit = r.opts.mode === 'tdm' ? 40 : 20;
    // 봇 채우기 (팀전이면 사람이 적은 팀부터)
    const n = !r.private && r.opts.mode === 'tdm' ? 0 : r.opts.bots; // 팀전(같이 하기)에는 봇 없이 사람끼리
    for (let i = 0; i < n && r.players.length < this.o.max; i++) {
      const b = { bot: true, id: this.nextPid++, name: BOT_NAMES[i % BOT_NAMES.length], color: BOT_COLORS[i % BOT_COLORS.length], room: r, st: null, team: null, skill: 0.55 + Math.random() * 0.35, gun: BOT_GUNS[Math.floor(Math.random() * BOT_GUNS.length)] };
      b.team = this.smaller(r, b);
      r.players.push(b);
    }
    if (r.opts.mode !== 'tdm') for (const p of r.players) p.team = null;
    const spawns = {};
    for (const p of r.players) { p.k = 0; p.d = 0; p.hp = 100; p.alive = false; p.lastFire = {}; p.nades = 1; this.spawn(r, p, r.startAt, true); spawns[p.id] = [p.pos.x, 0, p.pos.z, p.yaw]; }
    // 처음 자리는 출발 메시지에 같이 (따로 보내면 출발보다 먼저 도착한다)
    return { map: r.map.id, mode: r.opts.mode, dur: TIME, limit: r.limit, spawns, guns: Object.fromEntries(r.players.filter((p) => p.bot).map((p) => [p.id, p.gun])) };
  }
  spawn(r, p, at = Date.now(), silent = false) {
    const pts = p.team ? r.map.spawns[p.team] : [...r.map.spawns.red, ...r.map.spawns.blue];
    // 적에게서 가장 먼 자리
    const enemies = r.players.filter((q) => q !== p && q.alive && (!p.team || q.team !== p.team) && q.pos);
    let best = pts[0], bd = -1;
    for (const s of pts) { const d = enemies.length ? Math.min(...enemies.map((q) => dist({ x: s[0], z: s[1] }, q.pos))) : Math.random() * 10; if (d > bd) { bd = d; best = s; } }
    const yaw = best[0] < 0 ? -Math.PI / 2 : Math.PI / 2; // 맵 가운데를 본다 (앞 = -sin, -cos)
    p.pos = { x: best[0] + (Math.random() - 0.5) * 2, y: 0, z: best[1] + (Math.random() - 0.5) * 2 };
    p.yaw = yaw; p.hp = 100; p.alive = true; p.prot = at + PROTECT; p.nades = 1; p.respawnAt = 0;
    p.st = [p.pos.x, 0, p.pos.z, yaw, 0, 0];
    if (p.bot) { p.path = null; p.target = null; p.react = 0; p.fireT = 0; p.mag = weapon(p.gun).mag; p.reloadT = 0; }
    if (!silent) this.toRoom(r, { t: 'spawn', id: p.id, p: [p.pos.x, 0, p.pos.z, yaw], gun: p.bot ? p.gun : undefined });
  }
  // ---------- 메시지 ----------
  onMessage(c, m, r) {
    if (r.state !== 'run' || Date.now() < r.startAt) return;
    if (m.t === 'wpn') { const w = String(m.w || ''); if (weapon(w)) this.toRoom(r, { t: 'wpn', id: c.id, w }, c); return; }
    if (m.t === 'fire') {
      const w = weapon(String(m.w || ''));
      if (!w || !c.alive || !Array.isArray(m.o) || !Array.isArray(m.d)) return;
      const now = Date.now();
      if (now - (c.lastFire[w.id] || 0) < w.rate * 1000 * 0.7) return;
      c.lastFire[w.id] = now; c.firedAt = now;
      this.toRoom(r, { t: 'fire', by: c.id, w: w.id, o: m.o.slice(0, 3).map(Number), d: m.d.slice(0, 3).map(Number) }, c);
      return;
    }
    if (m.t === 'hit') {
      const w = weapon(String(m.w || '')), tgt = r.players.find((p) => p.id === +m.to);
      if (!w || !tgt || !c.alive || !tgt.alive || tgt === c || !c.st) return;
      if (r.opts.mode === 'tdm' && tgt.team === c.team) return;
      const now = Date.now();
      if (w.cls !== 'knife' && now - (c.firedAt || 0) > 600) return; // 방금 쏜 총알만
      if (w.cls === 'knife') { if (now - (c.lastFire.knife || 0) < w.rate * 700) return; c.lastFire.knife = now; }
      const a = { x: c.st[0], y: c.st[1] + EYE, z: c.st[2] }, b = { x: tgt.pos.x, y: tgt.pos.y + 1.1, z: tgt.pos.z };
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d > (w.cls === 'knife' ? 3.5 : w.range * 2.2 + 5)) return;
      // 벽 너머는 안 맞는다 (머리 · 가슴 · 무릎 중 하나라도 보이면)
      if (![1.6, 1.1, 0.5].some((h) => clearLine(r.map, a, { ...b, y: tgt.pos.y + h }))) return;
      const n = Math.max(1, Math.min(w.pellets || 1, Number(m.n) || 1));
      const head = m.part === 'head';
      let dmg = w.cls === 'knife' ? (m.back ? w.back : w.dmg) : w.dmg * n * (head ? w.head : 1) * falloff(w, d);
      this.damage(r, tgt, dmg, c, w.id, head);
      return;
    }
    if (m.t === 'nade') {
      if (!Array.isArray(m.p) || c.nades <= 0) return;
      c.nades--;
      const p = { x: +m.p[0], y: +m.p[1] + 0.3, z: +m.p[2] };
      if (![p.x, p.y, p.z].every(Number.isFinite)) return;
      this.toRoom(r, { t: 'boom', p: [p.x, p.y, p.z], by: c.id });
      for (const t of r.players) {
        if (!t.alive || !t.pos) continue;
        if (r.opts.mode === 'tdm' && t.team === c.team && t !== c) continue;
        const q = { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z }, d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
        if (d > NADE.r || !clearLine(r.map, p, q)) continue;
        this.damage(r, t, nadeDmg(d) * (t === c ? 0.5 : 1), c, 'nade', false);
      }
    }
  }
  damage(r, t, dmg, by, w, head) {
    if (!t.alive || (r.now || Date.now()) < t.prot || dmg <= 0) return;
    t.hp -= dmg;
    this.toRoom(r, { t: 'dmg', to: t.id, hp: Math.max(0, Math.round(t.hp)), by: by.id, head: !!head, p: by.pos ? [by.pos.x, by.pos.z] : null });
    if (t.hp <= 0) this.kill(r, t, by, w, head);
    else if (t.bot && by !== t) { t.target = by; t.react = Math.min(t.react, 0.25); }
  }
  kill(r, t, by, w, head) {
    t.alive = false; t.d++; t.respawnAt = (r.now || Date.now()) + RESPAWN;
    if (by !== t) { by.k++; if (r.opts.mode === 'tdm' && by.team) r.score[by.team]++; }
    this.toRoom(r, { t: 'kill', by: by.id, to: t.id, w, head: !!head, score: r.score });
    const top = Math.max(...r.players.map((p) => p.k));
    if ((r.opts.mode === 'tdm' && Math.max(r.score.red, r.score.blue) >= r.limit) || (r.opts.mode !== 'tdm' && top >= r.limit)) this.finishMatch(r);
  }
  finishMatch(r) {
    const rank = [...r.players].sort((a, b) => b.k - a.k || a.d - b.d).map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, color: p.color, team: p.team, k: p.k, d: p.d, bot: !!p.bot }));
    const team = r.opts.mode === 'tdm' ? { red: r.score.red, blue: r.score.blue, winner: r.score.red === r.score.blue ? 'draw' : r.score.red > r.score.blue ? 'red' : 'blue' } : null;
    this.end(r, { rank, team });
  }
  onTick(r, now) {
    r.now = now;
    if (now < r.startAt) return;
    // 사람들 위치 (받은 상태로)
    for (const p of r.players) if (!p.bot && p.st && p.alive) p.pos = { x: p.st[0], y: p.st[1], z: p.st[2] };
    for (const p of r.players) if (!p.alive && p.respawnAt && now >= p.respawnAt) this.spawn(r, p, now);
    for (const b of r.players) if (b.bot && b.alive) this.botThink(r, b, 1 / this.o.hz, now);
    if (now >= r.endAt) this.finishMatch(r);
  }

  // ---------- 봇 ----------
  nav(map) {
    if (this.navs.has(map.id)) return this.navs.get(map.id);
    const S = 3, nodes = [], idx = new Map();
    for (let x = -map.W / 2 + 2; x <= map.W / 2 - 2; x += S) for (let z = -map.D / 2 + 2; z <= map.D / 2 - 2; z += S) {
      if (map.boxes.some((b) => b.y < 1.8 && x > b.x - b.w / 2 - 0.7 && x < b.x + b.w / 2 + 0.7 && z > b.z - b.d / 2 - 0.7 && z < b.z + b.d / 2 + 0.7)) continue;
      idx.set(`${x},${z}`, nodes.length); nodes.push({ x, z, n: [] });
    }
    for (const a of nodes) for (const [dx, dz] of [[S, 0], [0, S], [S, S], [S, -S]]) {
      const j = idx.get(`${a.x + dx},${a.z + dz}`);
      if (j == null) continue;
      const b = nodes[j];
      if (!clearLine(map, { x: a.x, y: 0.5, z: a.z }, { x: b.x, y: 0.5, z: b.z })) continue;
      a.n.push(j); b.n.push(nodes.indexOf(a));
    }
    const nav = { nodes, near(p) { let best = 0, bd = Infinity; nodes.forEach((n, i) => { const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; } };
    this.navs.set(map.id, nav);
    return nav;
  }
  pathTo(nav, from, to) {
    const prev = new Map([[from, -1]]), q = [from];
    while (q.length) { const c = q.shift(); if (c === to) break; for (const n of nav.nodes[c].n) if (!prev.has(n)) { prev.set(n, c); q.push(n); } }
    if (!prev.has(to)) return null;
    const out = []; for (let c = to; c !== -1; c = prev.get(c)) out.unshift(nav.nodes[c]);
    return out;
  }
  botThink(r, b, dt, now) {
    const map = r.map, nav = this.nav(map), w = weapon(b.gun);
    const eye = { x: b.pos.x, y: EYE, z: b.pos.z };
    // 보이는 적 중 가장 가까운
    let tgt = null, td = 60;
    for (const p of r.players) {
      if (p === b || !p.alive || !p.pos || (r.opts.mode === 'tdm' && p.team === b.team)) continue;
      const d = dist(b.pos, p.pos);
      if (d < td && clearLine(map, eye, { x: p.pos.x, y: p.pos.y + 1.2, z: p.pos.z })) { td = d; tgt = p; }
    }
    if (tgt !== b.target) { b.target = tgt; b.react = 0.35 + Math.random() * 0.45 * (1.3 - b.skill); }
    let moving = false;
    if (tgt) {
      // 조준: 천천히 돌아서 쏜다 · 옆으로 조금씩 움직이며
      const want = Math.atan2(-(tgt.pos.x - b.pos.x), -(tgt.pos.z - b.pos.z));
      let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      b.yaw += Math.max(-7 * dt, Math.min(7 * dt, dy));
      b.pitch = Math.atan2((tgt.pos.y + 1.1) - EYE, td) * 0.8;
      b.react -= dt;
      b.strafeT = (b.strafeT || 0) - dt;
      if (b.strafeT <= 0) { b.strafeT = 0.6 + Math.random() * 1.2; b.strafe = (Math.random() - 0.5) * 2; }
      if (td > (w.cls === 'shotgun' ? 8 : 12)) this.botMove(r, b, b.strafe * 0.6, dt), moving = true;
      if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.mag = w.mag; }
      else if (b.react <= 0 && Math.abs(dy) < 0.2 && now >= b.fireT) {
        b.fireT = now + w.rate * 1000 * (w.auto ? 1 : 1.4 + Math.random());
        b.mag--; if (b.mag <= 0) b.reloadT = w.reload;
        // 맞을 확률: 가까울수록 · 잘하는 봇일수록 · 서 있으면 더 잘 맞는다
        const pHit = Math.max(0.1, Math.min(0.85, 0.9 - td * (w.cls === 'sniper' ? 0.004 : 0.016))) * b.skill * (moving ? 0.8 : 1);
        const hitIt = Math.random() < pHit;
        const aim = { x: tgt.pos.x + (hitIt ? 0 : (Math.random() - 0.5) * 2.5), y: tgt.pos.y + 1.2 + (hitIt ? 0 : (Math.random() - 0.3) * 1.2), z: tgt.pos.z + (hitIt ? 0 : (Math.random() - 0.5) * 2.5) };
        const L = Math.hypot(aim.x - eye.x, aim.y - eye.y, aim.z - eye.z) || 1;
        this.toRoom(r, { t: 'fire', by: b.id, w: w.id, o: [eye.x, eye.y, eye.z], d: [(aim.x - eye.x) / L, (aim.y - eye.y) / L, (aim.z - eye.z) / L] });
        if (hitIt) {
          const head = Math.random() < 0.12 * b.skill;
          const n = w.pellets > 1 ? Math.max(1, Math.round(w.pellets * Math.max(0.2, 1 - td / 18))) : 1;
          this.damage(r, tgt, w.dmg * n * (head ? w.head : 1) * falloff(w, td), b, w.id, head);
        }
      }
    } else {
      // 길 따라 이동: 적 진영 쪽 · 마지막으로 본 곳
      if (!b.path || !b.path.length || (b.repath = (b.repath || 0) - dt) <= 0) {
        b.repath = 6 + Math.random() * 4;
        const enemySide = r.opts.mode === 'tdm' ? map.spawns[b.team === 'red' ? 'blue' : 'red'] : [...map.spawns.red, ...map.spawns.blue];
        const goal = Math.random() < 0.5 ? enemySide[Math.floor(Math.random() * enemySide.length)] : [(Math.random() - 0.5) * map.W * 0.7, (Math.random() - 0.5) * map.D * 0.7];
        b.path = this.pathTo(nav, nav.near(b.pos), nav.near({ x: goal[0], z: goal[1] })) || [];
      }
      const n = b.path[0];
      if (n) {
        const want = Math.atan2(-(n.x - b.pos.x), -(n.z - b.pos.z));
        let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        b.yaw += Math.max(-5 * dt, Math.min(5 * dt, dy));
        b.pitch = 0;
        const step = 5.2 * dt, d = dist(b.pos, n);
        if (d <= step + 0.2) { b.pos.x = n.x; b.pos.z = n.z; b.path.shift(); }
        else { b.pos.x += ((n.x - b.pos.x) / d) * step; b.pos.z += ((n.z - b.pos.z) / d) * step; }
        moving = true;
      }
    }
    b.st = [b.pos.x, 0, b.pos.z, b.yaw, b.pitch || 0, moving ? 1 : 0];
  }
  // 옆걸음 (벽에 막히면 안 움직인다)
  botMove(r, b, side, dt) {
    const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
    const nx = b.pos.x + rx * side * 3 * dt, nz = b.pos.z + rz * side * 3 * dt;
    if (clearLine(r.map, { x: b.pos.x, y: 0.6, z: b.pos.z }, { x: nx + rx * side * 0.6, y: 0.6, z: nz + rz * side * 0.6 })) { b.pos.x = nx; b.pos.z = nz; }
  }
}
