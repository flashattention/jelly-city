// 젤리 가이즈 몸 움직임: 내 화면과 서버 봇이 똑같이 쓴다
//   p = { x,y,z (발), vx,vy,vz, yaw, ground, stun, dive, coyote, carry }
//   inp = { mx, mz (월드 방향, 길이 ≤ 1), jump, dive }   st = { tiles: Map(id → 떨어지는 시각), doors: Set(펑 터진 문) }
import { moverAt, spinAngle, spinOmega, hammerAt, ballAt, ballsNow } from './rounds.js';

export const RAD = 0.42, HGT = 1.3, HDIVE = 0.6, GRAV = 28, MAXV = 8.2, JUMP = 10.2;
const tmp = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }, hm = {}, bl = {};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function newBody(s) { return { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, yaw: 0, ground: false, stun: 0, dive: 0, coyote: 0, cx: 0, cz: 0, ice: false, cp: -1, knock: 0 }; }

// 상자 하나의 지금 자리 (움직이면 움직인 만큼)
export function boxNow(b, t) {
  if (!b.mv) { tmp.x = tmp.y = tmp.z = tmp.vx = tmp.vy = tmp.vz = 0; return tmp; }
  return moverAt(b.mv, t, tmp);
}
export const tileSolid = (tl, t, st) => { const f = tl.sched ? tl.fallAt : st?.tiles?.get(tl.id); return f == null || t < f; };

function knock(p, vx, vz, vy, stun, ev, kind) {
  p.vx = vx; p.vz = vz; p.vy = Math.max(p.vy, vy); p.ground = false; p.dive = 0;
  p.stun = Math.max(p.stun, stun); p.knock = 0.25;
  ev?.push(kind || 'knock');
}

export function step(p, inp, L, t, dt, st, ev) {
  const prevY = p.y;
  p.lie = Math.max(0, (p.lie || 0) - dt);
  const h = p.dive || p.lie > 0 ? HDIVE : HGT; // 다이브 · 엎어진 동안은 납작
  // ---- 조작 ----
  p.stun = Math.max(0, p.stun - dt); p.knock = Math.max(0, p.knock - dt);
  const ctl = p.stun <= 0 && !p.dive;
  let mx = inp.mx || 0, mz = inp.mz || 0; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  if (!ctl) { mx = 0; mz = 0; }
  const acc = p.ground ? (p.ice ? 1.6 : 11) : 3.2;
  const k = Math.min(1, acc * dt);
  if (!p.dive && p.knock <= 0) { p.vx += (mx * MAXV - p.vx) * k; p.vz += (mz * MAXV - p.vz) * k; }
  else if (p.ground) { const f = Math.min(1, dt * (p.ice ? 1 : 6)); p.vx -= p.vx * f; p.vz -= p.vz * f; }
  if (ml > 0.1 && ctl) { const want = Math.atan2(mx, mz); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * Math.min(1, dt * 14); }
  p.coyote = p.ground ? 0.12 : Math.max(0, p.coyote - dt);
  if (inp.jump && ctl && (p.ground || p.coyote > 0)) { p.vy = JUMP; p.ground = false; p.coyote = 0; ev?.push('jump'); }
  if (inp.dive && ctl) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    p.dive = 1; p.vx = fx * 11.5; p.vz = fz * 11.5; p.vy = p.ground ? 3 : Math.max(p.vy, 2.5); p.ground = false; ev?.push('dive');
  }
  // ---- 움직이기 ----
  p.vy = Math.max(-34, p.vy - GRAV * dt);
  p.x += (p.vx + (p.ground ? p.cx : 0)) * dt; p.z += (p.vz + (p.ground ? p.cz : 0)) * dt; p.y += p.vy * dt;
  const wasGround = p.ground;
  p.ground = false; p.ice = false; p.cx = 0; p.cz = 0;
  // ---- 부딪히기 ----
  for (const b of L.boxes) {
    if (Math.abs(p.z - b.z) > b.d / 2 + 4 + (b.mv ? b.mv.amp * Math.abs(b.mv.az) : 0)) continue;
    if (b.door && st?.doors?.has(b.door)) continue;
    const o = boxNow(b, t);
    solidBox(p, b, b.x + o.x, b.y + o.y, b.z + o.z, b.w, b.h, b.d, o, h, prevY, dt, ev, st);
  }
  for (const tl of L.tiles) {
    if (Math.abs(p.z - tl.z) > 3 || Math.abs(p.x - tl.x) > 3 || !tileSolid(tl, t, st)) continue;
    tmp.x = tmp.y = tmp.z = tmp.vx = tmp.vy = tmp.vz = 0;
    if (solidBox(p, tl, tl.x, tl.y, tl.z, tl.w, tl.h, tl.d, tmp, h, prevY, dt, null, st) === 'top' && tl.step) ev?.push(['tile', tl.id]);
  }
  for (const d of L.disks) {
    const dx = p.x - d.x, dz = p.z - d.z, r = Math.hypot(dx, dz);
    if (r > d.R + RAD + 0.2) continue;
    const top = d.y, bot = d.y - d.h;
    if (r < d.R && p.y <= top + 0.02 && p.y > top - 0.45 && p.vy <= 0.5) {
      p.y = top; p.vy = 0; p.ground = true;
      if (d.spd) { p.cx = d.spd * dz; p.cz = -d.spd * dx; }
    } else if (p.y < top - 0.45 && p.y + h > bot && r < d.R + RAD) {
      const n = r > 1e-4 ? r : 1; p.x = d.x + (dx / n) * (d.R + RAD); p.z = d.z + (dz / n) * (d.R + RAD);
    }
  }
  p.imm = Math.max(0, (p.imm || 0) - dt); // 막대에 맞은 직후엔 같은 막대에 또 끌려가지 않게
  if (p.imm <= 0) for (const s of L.spinners) {
    if (Math.abs(p.z - s.z) > s.len + 1 || Math.abs(p.x - s.x) > s.len + 1) continue;
    const by = s.y + s.h; if (by + s.r < p.y || by - s.r > p.y + h) continue;
    const a = spinAngle(s, t), w = spinOmega(s, t);
    for (let i = 0; i < s.n; i++) {
      const aa = a + (i * Math.PI * 2) / s.n, ux = Math.cos(aa), uz = -Math.sin(aa);
      const rx = p.x - s.x, rz = p.z - s.z, along = clamp(rx * ux + rz * uz, 0, s.len);
      const qx = s.x + ux * along, qz = s.z + uz * along, dx = p.x - qx, dz = p.z - qz, dd = Math.hypot(dx, dz);
      if (dd > RAD + s.r) continue;
      // 막대 끝이 미는 방향 (빨리 돌수록 세게)
      const tvx = w * (qz - s.z), tvz = -w * (qx - s.x), sp = Math.hypot(tvx, tvz) + 2;
      const nx = dd > 1e-4 ? dx / dd : Math.sign(tvx) || 1, nz = dd > 1e-4 ? dz / dd : 0;
      p.x = qx + nx * (RAD + s.r + 0.02); p.z = qz + nz * (RAD + s.r + 0.02);
      const tl = Math.hypot(tvx, tvz) || 1;
      const kk = Math.min(8, 1.5 + sp * 0.6), out = 1 + Math.abs(w) * along * 0.2; // 바깥쪽으로도 (빨라질수록 멀리)
      knock(p, (tvx / tl) * kk + nx * 2 + ux * out, (tvz / tl) * kk + nz * 2 + uz * out, 5, 0.55, ev, 'spin'); p.imm = 0.45; break;
    }
  }
  for (const hh of L.hammers) {
    if (Math.abs(p.z - hh.z) > hh.R + 2) continue;
    const o = hammerAt(hh, t, hm);
    const cy = p.y + h / 2, dx = p.x - o.x, dy = cy - o.y, dz = p.z - o.z, dd = Math.hypot(dx, dy, dz);
    if (dd > hh.R + RAD + 0.25) continue;
    const nx = dd > 1e-4 ? dx / dd : 1, nz = dd > 1e-4 ? dz / dd : 0;
    knock(p, o.vx * 0.9 + nx * 4, nz * 4, 6.5, 0.7, ev, 'bonk');
  }
  for (const b of L.bumpers) {
    const dx = p.x - b.x, dz = p.z - b.z, r = Math.hypot(dx, dz);
    if (r > b.R + RAD || p.y > b.y + b.h || p.y + h < b.y) continue;
    const nx = r > 1e-4 ? dx / r : 1, nz = r > 1e-4 ? dz / r : 0;
    p.x = b.x + nx * (b.R + RAD + 0.01); p.z = b.z + nz * (b.R + RAD + 0.01);
    if (b.hub) { const vn = p.vx * nx + p.vz * nz; if (vn < 0) { p.vx -= vn * nx; p.vz -= vn * nz; } }
    else knock(p, nx * 11, nz * 11, 4, 0.3, ev, 'boing');
  }
  for (const s of L.streams) {
    const [a, b] = ballsNow(s, t);
    for (let i = a; i <= b; i++) {
      const o = ballAt(s, i, t, bl); if (!o) continue;
      const cy = p.y + h / 2, dx = p.x - o.x, dy = cy - o.y, dz = p.z - o.z, dd = Math.hypot(dx, dy, dz);
      if (dd > o.R + RAD + 0.1) continue;
      const hl = Math.hypot(dx, dz) || 1;
      knock(p, o.vx * 1.15 + (dx / hl) * 5, o.vz * 1.15 + (dz / hl) * 5, 6, 0.6, ev, 'ball');
    }
  }
  // ---- 내려앉기 ----
  if (p.ground) {
    if (p.dive) { p.dive = 0; p.stun = Math.max(p.stun, 0.4); p.lie = 0.45; ev?.push('land'); }
    else if (!wasGround && prevY - p.y >= 0 && p.vy <= 0) ev?.push('land');
  }
  if (p.ground && L.cps) for (let i = p.cp + 1; i < L.cps.length; i++) if (p.z > L.cps[i].z && Math.abs(p.y - L.cps[i].y) < 2.5) p.cp = i;
  // 결승선 · 왕관 · 떨어짐
  if (L.finish && p.z > L.finish.z0 && p.z < L.finish.z1 && p.x > L.finish.x0 && p.x < L.finish.x1 && p.y > L.finish.y - 1) ev?.push('finish');
  if (L.crown && Math.hypot(p.x - L.crown.x, p.y + h / 2 - L.crown.y, p.z - L.crown.z) < 1.5) ev?.push('crown');
  if (p.y < L.deathY) ev?.push('fall');
}

// 세워진 상자와 부딪히기: 위에 서기 · 머리 쿵 · 옆으로 밀려나기 (밀개면 같이 밀린다)
function solidBox(p, b, X, Y, Z, W, H, D, o, h, prevY, dt, ev, st) {
  const top = Y + H;
  if (p.y >= top + 0.02 || p.y + h <= Y) return null;
  const x0 = X - W / 2, x1 = X + W / 2, z0 = Z - D / 2, z1 = Z + D / 2;
  const cx = clamp(p.x, x0, x1), cz = clamp(p.z, z0, z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= RAD * RAD) return null;
  // 위에 서기 (턱 0.35 까지는 그냥 올라선다 · 오르는 상자도)
  if (p.y > top - 0.38 && p.vy <= 0.5 + Math.max(0, o.vy)) {
    p.y = top; p.vy = Math.max(0, o.vy); p.ground = true; p.cx = o.vx + (b.conv ? b.conv[0] : 0); p.cz = o.vz + (b.conv ? b.conv[1] : 0); if (b.ice) p.ice = true;
    if (b.pad) { p.vy = b.pad; p.ground = false; ev?.push('pad'); }
    return 'top';
  }
  // 머리 쿵
  if (prevY + h <= Y + 0.05 && p.vy > 0) { p.y = Y - h; p.vy = 0; return 'head'; }
  // 진짜 문: 부딪히면 펑
  if (b.door && b.real) { st?.doors?.add(b.door); ev?.push(['door', b.door]); return 'door'; }
  // 옆으로
  let nx, nz, pen;
  if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = RAD - d; }
  else { // 가운데가 상자 안: 가장 가까운 면으로
    const l = p.x - x0, r = x1 - p.x, f = p.z - z0, k = z1 - p.z, m = Math.min(l, r, f, k);
    if (m === l) { nx = -1; nz = 0; pen = l + RAD; } else if (m === r) { nx = 1; nz = 0; pen = r + RAD; } else if (m === f) { nx = 0; nz = -1; pen = f + RAD; } else { nx = 0; nz = 1; pen = k + RAD; }
  }
  p.x += nx * pen; p.z += nz * pen;
  const vn = p.vx * nx + p.vz * nz; if (vn < 0) { p.vx -= vn * nx; p.vz -= vn * nz; }
  // 밀개가 밀면 같이 날아간다
  const bvn = o.vx * nx + o.vz * nz;
  if (b.push && bvn > 1) { p.vx = o.vx * 1.4 + nx * 3; p.vz = o.vz * 1.4 + nz * 3; p.vy = Math.max(p.vy, 3.5); p.stun = Math.max(p.stun, 0.4); p.knock = 0.25; ev?.push('push'); }
  return 'side';
}

// 이 자리 아래 바닥 높이 (봇이 앞을 살필 때)
export function groundAt(L, x, z, yFrom, t, st) {
  let best = -Infinity;
  for (const b of L.boxes) {
    if (b.door) continue;
    const o = boxNow(b, t), X = b.x + o.x, Z = b.z + o.z, top = b.y + o.y + b.h;
    if (top > yFrom + 0.4 || Math.abs(x - X) > b.w / 2 || Math.abs(z - Z) > b.d / 2) continue;
    if (top > best) best = top;
  }
  for (const tl of L.tiles) { if (!tileSolid(tl, t, st) || Math.abs(x - tl.x) > tl.w / 2 || Math.abs(z - tl.z) > tl.d / 2) continue; const top = tl.y + tl.h; if (top <= yFrom + 0.4 && top > best) best = top; }
  for (const d of L.disks) if (Math.hypot(x - d.x, z - d.z) < d.R && d.y <= yFrom + 0.4 && d.y > best) best = d.y;
  return best;
}
// 다른 곰돌이와 밀치기 (서로 겹치지 않게 · 다이브로 부딪히면 세게)
export function pushApart(p, q, mine = 1) {
  const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz), m = RAD * 2;
  if (d >= m || d < 1e-4 || Math.abs(p.y - q.y) > 1.1) return false;
  const k = (m - d) * mine;
  p.x += (dx / d) * k; p.z += (dz / d) * k;
  return true;
}
