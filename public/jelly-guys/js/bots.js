// 젤리봇 머리: 서버가 봇마다 돌린다 (사람과 같은 몸 움직임 · 같은 조작만 쓴다)
//   ai = { skill(0.5~1), off(-1~1 좌우 자리), wi(다음 길 점), think(다음 생각까지), inp, best(가장 멀리 간 z), stuckT, tx, tz }
import { spinAngle, hammerAt, ballAt, ballsNow, hash } from './rounds.js';
import { groundAt, tileSolid, RAD } from './phys.js';

export function newBrain(i, seed) {
  const r = (k) => hash(i * 13 + k, seed);
  return { skill: 0.5 + r(1) * 0.5, off: r(2) * 2 - 1, wi: 0, think: 0, inp: { mx: 0, mz: 0, jump: false, dive: false }, best: -1e9, stuckT: 0, lastZ: 0, wait: 0, tile: null, ang: r(3) * Math.PI * 2, rad: 4 + r(4) * 4, seed: (seed + i * 7777) >>> 0, n: 0 };
}

// 막대가 곧 나를 칠까? (지금부터 look 초 안에) → 남은 시간 (없으면 null)
function barHit(s, p, t, look) {
  for (let k = 0.05; k <= look; k += 0.05) {
    const a = spinAngle(s, t + k);
    for (let i = 0; i < s.n; i++) {
      const aa = a + (i * Math.PI * 2) / s.n, ux = Math.cos(aa), uz = -Math.sin(aa);
      const rx = p.x - s.x, rz = p.z - s.z, al = rx * ux + rz * uz;
      if (al < 0 || al > s.len + RAD) continue;
      if (Math.abs(rx * uz - rz * ux) < RAD + s.r + 0.25) return k;
    }
  }
  return null;
}
const rnd = (ai) => hash(ai.n++, ai.seed);

export function think(ai, p, L, t, st, dt) {
  const inp = ai.inp;
  inp.jump = false; inp.dive = false;
  ai.think -= dt;
  const react = 0.28 - ai.skill * 0.2; // 잘하는 봇일수록 빨리 본다
  if (ai.think > 0) return inp;
  ai.think = react * (0.6 + rnd(ai) * 0.8);
  if (L.kind === 'race' || L.crown) race(ai, p, L, t, st);
  else if (L.id === 'sweep' || L.id === 'bigsweep') sweep(ai, p, L, t);
  else if (L.id === 'ballstorm') storm(ai, p, L, t);
  else tiles(ai, p, L, t, st);
  return inp;
}

function steer(ai, p, tx, tz, slow = 1) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
  const k = Math.min(1, d / 0.8) * slow;
  ai.inp.mx = (dx / d) * k; ai.inp.mz = (dz / d) * k;
}

function race(ai, p, L, t, st) {
  const P = L.path;
  // 뒤로 밀려났으면(체크포인트로 돌아감) 길 점을 다시 찾는다
  if (ai.wi > 0 && P[ai.wi - 1].z > p.z + 3) ai.wi = Math.max(0, P.findIndex((q) => q.z > p.z - 1));
  while (ai.wi < P.length - 1 && p.z > P[ai.wi].z - 0.6) ai.wi++;
  const q = P[ai.wi];
  // 문: 펑 터진 문으로 · 아니면 고른 문으로 (막히면 다른 문)
  let tx = q.x + ai.off * q.w * 0.5, tz = q.z + 2;
  const row = L.boxes.filter((b) => b.door && b.z > p.z - 0.2 && b.z < p.z + 6);
  if (row.length) {
    const open = row.filter((b) => st?.doors?.has(b.door));
    const tried = (ai.tried ||= new Set());
    let pick = open.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (!pick || (ai.skill < 0.75 && rnd(ai) < 0.3)) pick = row.find((b) => b.door === ai.door && !tried.has(b.door)) || row.filter((b) => !tried.has(b.door)).sort(() => rnd(ai) - 0.5)[0] || row[0];
    ai.door = pick.door; tx = pick.x; tz = pick.z + 2;
    if (ai.stuckT > 0.5 && !st?.doors?.has(pick.door)) { tried.add(pick.door); ai.door = null; ai.stuckT = 0; }
  }
  if (L.crown && ai.wi >= P.length - 1) { tx = L.crown.x; tz = L.crown.z; }
  // 앞에 망치가 곧 지나가면 잠깐 기다린다
  let slow = 1;
  for (const h of L.hammers) {
    if (h.z < p.z || h.z - p.z > 3.2) continue;
    // 지금부터 0.7초 안에 머리가 내 앞을 지나가면 기다린다 (잘하는 봇일수록 잘 기다린다)
    if (rnd(ai) > ai.skill + 0.25) continue;
    for (let k = 0.1; k <= 0.7; k += 0.15) { const o = hammerAt(h, t + k, {}); if (Math.abs(o.x - p.x) < h.R + 1.2) { slow = 0; break; } }
  }
  // 굴러오는 공: 옆으로 비킨다
  for (const s of L.streams) {
    const [a, b] = ballsNow(s, t);
    for (let i = a; i <= b; i++) {
      const o = ballAt(s, i, t, {}); if (!o) continue;
      const ahead = (o.z - p.z) * Math.sign(-s.vz || 1);
      if (ahead > 0 && ahead < 9 && Math.abs(o.x - p.x) < o.R + 1) tx = p.x + (o.x > p.x ? -3 : 3) * (ai.skill > 0.6 ? 1 : 0.5);
    }
  }
  steer(ai, p, tx, tz, slow);
  if (!p.ground) return;
  const dx = ai.inp.mx, dz = ai.inp.mz, n = Math.hypot(dx, dz) || 1;
  // 낭떠러지 · 턱: 앞을 살펴서 뛴다
  const ax = p.x + (dx / n) * 1.3, az = p.z + (dz / n) * 1.3;
  const g = groundAt(L, ax, az, p.y + 2, t, st);
  if (g < p.y - 0.7 || g > p.y + 0.35) ai.inp.jump = true;
  // 낮은 회전 막대
  for (const s of L.spinners) if (s.y + s.h < p.y + 0.9 && Math.abs(s.z - p.z) < s.len + 1) { const k = barHit(s, p, t, 0.32); if (k != null && k > 0.08 && rnd(ai) < 0.55 + ai.skill * 0.45) ai.inp.jump = true; }
  // 막혀 있으면
  if (Math.abs(p.z - ai.lastZ) < 0.05) ai.stuckT += 0.15; else ai.stuckT = Math.max(0, ai.stuckT - 0.1);
  ai.lastZ = p.z;
  if (ai.stuckT > 1.2) { ai.off = rnd(ai) * 2 - 1; ai.inp.jump = true; ai.stuckT = 0.6; }
  // 결승선 · 왕관 앞에서 다이브
  if ((L.finish && L.finish.z0 - p.z < 3 && L.finish.z0 > p.z && rnd(ai) < 0.3) || (L.crown && Math.hypot(L.crown.x - p.x, L.crown.z - p.z) < 2.2)) { if (L.crown) ai.inp.jump = true; else ai.inp.dive = true; }
}

function sweep(ai, p, L, t) {
  // 자리 잡기: 가운데 기둥과 가장자리 사이를 천천히 돈다
  ai.ang += 0.05 * (ai.off > 0 ? 1 : -1);
  const big = L.disks[0].R;
  const r = Math.min(big - 3, ai.rad);
  steer(ai, p, Math.cos(ai.ang) * r, Math.sin(ai.ang) * r, 0.5);
  if (!p.ground) return;
  for (const s of L.spinners) {
    const k = barHit(s, p, t, 0.42);
    if (k == null) continue;
    const ok = rnd(ai) < 0.45 + ai.skill * 0.5;
    if (s.h < 0.9) { if (k < 0.3 && ok && !L.spinners.some((o) => o !== s && o.h > 0.9 && barHit(o, p, t, 0.75) != null)) ai.inp.jump = true; }
    else if (k < 0.34 && ok) ai.inp.dive = true;
  }
}

function storm(ai, p, L, t) {
  let tx = Math.cos(ai.ang) * 3, tz = Math.sin(ai.ang) * 3;
  ai.ang += 0.03;
  for (const s of L.streams) {
    const [a, b] = ballsNow(s, t);
    for (let i = a; i <= b; i++) {
      const o = ballAt(s, i, t, {}); if (!o) continue;
      const rx = p.x - o.x, rz = p.z - o.z, v = Math.hypot(o.vx, o.vz), ux = o.vx / v, uz = o.vz / v;
      const ahead = rx * ux + rz * uz, side = rx * -uz + rz * ux;
      if (ahead > 0 && ahead < 7 && Math.abs(side) < o.R + 1.2) { const s2 = side >= 0 ? 1 : -1; tx = p.x - uz * s2 * 4; tz = p.z + ux * s2 * 4; }
    }
  }
  tx = Math.max(-9, Math.min(9, tx)); tz = Math.max(-9, Math.min(9, tz));
  steer(ai, p, tx, tz);
}

// 떨어지는 판: 오래 남을 판으로 옮겨 다닌다
function tiles(ai, p, L, t, st) {
  const fall = (tl) => (tl.sched ? tl.fallAt : st?.tiles?.get(tl.id));
  const safe = (tl) => { const f = fall(tl); return f == null ? 1e9 : f - t; };
  const near = L.tiles.filter((tl) => tileSolid(tl, t, st) && Math.abs(tl.y + tl.h - p.y) < 1 && safe(tl) > 1.2);
  let under = L.tiles.find((tl) => Math.abs(p.x - tl.x) < tl.w / 2 + 0.2 && Math.abs(p.z - tl.z) < tl.d / 2 + 0.2 && Math.abs(tl.y + tl.h - p.y) < 0.6);
  if (!ai.tile || safe(ai.tile) < 1 || !tileSolid(ai.tile, t, st) || Math.abs(ai.tile.y + ai.tile.h - p.y) > 1 || (under === ai.tile && L.id === 'tiles')) {
    // 가까운 · 오래 버틸 판 (사람처럼 가끔은 엉뚱한 판도)
    const cands = near.filter((tl) => tl !== under).map((tl) => ({ tl, s: Math.hypot(tl.x - p.x, tl.z - p.z) - Math.min(6, safe(tl)) * 0.4 + rnd(ai) * (2.5 - ai.skill * 2) }));
    cands.sort((a, b) => a.s - b.s);
    ai.tile = cands[0]?.tl || null;
  }
  if (ai.tile) steer(ai, p, ai.tile.x, ai.tile.z); else { ai.inp.mx = 0; ai.inp.mz = 0; }
  if (p.ground && ai.tile) {
    const dx = ai.inp.mx, dz = ai.inp.mz, n = Math.hypot(dx, dz) || 1;
    if (groundAt(L, p.x + (dx / n) * 1.0, p.z + (dz / n) * 1.0, p.y + 1, t, st) < p.y - 0.5 && Math.hypot(ai.tile.x - p.x, ai.tile.z - p.z) < 4.5) ai.inp.jump = true;
  }
}
