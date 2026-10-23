// 젤리배그 규칙 (서버 · 화면 같이): 아이템 · 방어구 · 회복 · 젤리 자기장 · 젤리 비행선
import { rng } from '../../jelly-apple/js/board.js';
import { BG_SIZE } from './bgmap.js';

export const ARMOR_CUT = [0, 0.3, 0.4, 0.55];   // 조끼(몸) · 헬멧(머리) 단계별 피해 줄임
export const HEALS = { band: { name: '젤리 붕대', emoji: '🩹', hp: 15, cap: 75, sec: 3 }, med: { name: '젤리 구급상자', emoji: '🧰', hp: 100, cap: 100, sec: 6 } };
export const PLANE = { h: 95, speed: 11 };
export const DROP = { free: 28, chute: 6, openAt: 42, glide: 9 };  // 떨어지는 빠르기 · 낙하산 펴는 높이 · 옆으로 미끄러지는 빠르기

// ---------- 아이템 ----------
const W_GUNS = [['m4', 9], ['ak47', 9], ['rifle', 8], ['scar', 6], ['mp5', 8], ['uzi', 8], ['plasma_smg', 6], ['shotgun', 7], ['double_barrel', 5], ['sniper', 4], ['hunting_rifle', 4], ['m249', 2], ['barrett', 1]];
const W_PISTOLS = [['pistol', 6], ['revolver', 4], ['deagle', 3], ['blaster', 3]];
const KINDS = [['gun', 36], ['pistol', 12], ['armor', 12], ['helmet', 12], ['band', 14], ['med', 4], ['nade', 8]];
const pickW = (list, r) => { let t = list.reduce((a, [, w]) => a + w, 0) * r(); for (const [v, w] of list) { if ((t -= w) <= 0) return v; } return list[0][0]; };
const lvl = (r) => { const x = r(); return x < 0.58 ? 1 : x < 0.9 ? 2 : 3; };
export function rollItem(r) {
  const k = pickW(KINDS, r);
  if (k === 'gun') return { k, w: pickW(W_GUNS, r) };
  if (k === 'pistol') return { k, w: pickW(W_PISTOLS, r) };
  if (k === 'armor' || k === 'helmet') return { k, lv: lvl(r) };
  if (k === 'band') return { k, n: 3 };
  return { k, n: 1 };
}
export function makeLoot(map, seed) {
  const r = rng(seed ^ 0x2545f491), out = [];
  let id = 1;
  for (const [x, y, z] of map.loot) {
    const n = r() < 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) out.push({ id: id++, ...rollItem(r), x: x + (i ? 0.7 : 0), y, z: z + (i ? 0.4 : 0) });
  }
  return out;
}
export const ARMOR_NAME = ['', '1단계', '2단계', '3단계'];
export function itemLabel(it, weapon) {
  if (it.k === 'gun' || it.k === 'pistol') { const w = weapon(it.w); return `${w?.emoji || '🔫'} ${w?.name || it.w}`; }
  if (it.k === 'armor') return `🦺 젤리 조끼 ${ARMOR_NAME[it.lv]}`;
  if (it.k === 'helmet') return `⛑️ 젤리 헬멧 ${ARMOR_NAME[it.lv]}`;
  if (it.k === 'band') return `${HEALS.band.emoji} ${HEALS.band.name} ×${it.n || 1}`;
  if (it.k === 'med') return `${HEALS.med.emoji} ${HEALS.med.name}`;
  if (it.k === 'nade') return '💣 젤리 수류탄';
  return '❔';
}
export const emptyInv = () => ({ guns: [null, null], pistol: null, armor: 0, helmet: 0, band: 0, med: 0, nade: 0 });

// ---------- 젤리 자기장 ----------
//   단계마다: 기다림(wait) → 줄어듦(shrink) · 밖에 있으면 초당 피해(dps)
const PHASES = [[75, 40, 92, 1], [45, 35, 56, 2], [35, 30, 33, 4], [30, 25, 18, 7], [25, 20, 8, 10], [20, 20, 0, 15]];
export function makeZones(seed) {
  const r = rng(seed ^ 0x9e3779b9), out = [];
  let cx = 0, cz = 0, cr = BG_SIZE * 0.72, t = 0;
  for (const [wait, shrink, nr, dps] of PHASES) {
    const ang = r() * Math.PI * 2, d = r() * Math.max(0, cr - nr) * 0.85;
    const lim = BG_SIZE / 2 - nr - 4;
    const nx = Math.max(-lim, Math.min(lim, cx + Math.cos(ang) * d)), nz = Math.max(-lim, Math.min(lim, cz + Math.sin(ang) * d));
    out.push({ from: [cx, cz, cr], to: [nx, nz, nr], s0: t + wait, s1: t + wait + shrink, dps });
    t += wait + shrink; cx = nx; cz = nz; cr = nr;
  }
  return out;
}
// 시작한 지 sec 초일 때: { x, z, r, next: {x,z,r}, dps, phase, shrinking, until(다음 변화까지 초) }
export function zoneAt(zones, sec) {
  let prev = zones[0].from, dps = 0.5;
  for (let i = 0; i < zones.length; i++) {
    const Z = zones[i];
    if (sec < Z.s0) return { x: prev[0], z: prev[1], r: prev[2], next: { x: Z.to[0], z: Z.to[1], r: Z.to[2] }, dps, phase: i, shrinking: false, until: Z.s0 - sec };
    if (sec < Z.s1) { const k = (sec - Z.s0) / (Z.s1 - Z.s0); return { x: prev[0] + (Z.to[0] - prev[0]) * k, z: prev[1] + (Z.to[1] - prev[1]) * k, r: prev[2] + (Z.to[2] - prev[2]) * k, next: { x: Z.to[0], z: Z.to[1], r: Z.to[2] }, dps: Z.dps, phase: i, shrinking: true, until: Z.s1 - sec }; }
    prev = Z.to; dps = Z.dps;
  }
  return { x: prev[0], z: prev[1], r: prev[2], next: null, dps: dps * 1.5, phase: zones.length, shrinking: false, until: 0 };
}

// ---------- 젤리 비행선 ----------
export function makePlane(seed) {
  const r = rng(seed ^ 0x51ed270b), ang = r() * Math.PI * 2, off = (r() - 0.5) * 60;
  const dx = Math.cos(ang), dz = Math.sin(ang), px = -dz * off, pz = dx * off, L = BG_SIZE * 0.78;
  const a = [px - dx * L, pz - dz * L], b = [px + dx * L, pz + dz * L];
  return { a, b, h: PLANE.h, dur: Math.hypot(b[0] - a[0], b[1] - a[1]) / PLANE.speed };
}
export function planeAt(p, sec) { const k = Math.max(0, Math.min(1, sec / p.dur)); return { x: p.a[0] + (p.b[0] - p.a[0]) * k, z: p.a[1] + (p.b[1] - p.a[1]) * k, y: p.h, k, yaw: Math.atan2(-(p.b[0] - p.a[0]), -(p.b[1] - p.a[1])) }; }
