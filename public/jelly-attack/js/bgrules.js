// 젤리배그 규칙 (서버 · 화면 같이): 아이템 · 방어구 · 회복 · 젤리 자기장 · 젤리 비행선
import { rng } from '../../jelly-apple/js/board.js';
import { BG_SIZE } from './bgmap.js';

export const ARMOR_CUT = [0, 0.3, 0.4, 0.55];   // 조끼(몸) · 헬멧(머리) 단계별 피해 줄임
export const HEALS = { band: { name: '젤리 붕대', emoji: '🩹', hp: 15, cap: 75, sec: 3 }, med: { name: '젤리 구급상자', emoji: '🧰', hp: 100, cap: 100, sec: 6 } };
export const PLANE = { h: 95, speed: 11 };
export const DROP = { free: 28, chute: 6, openAt: 42, glide: 9 };  // 떨어지는 빠르기 · 낙하산 펴는 높이 · 옆으로 미끄러지는 빠르기

// ---------- 아이템 ----------
const W_GUNS = [['m4', 9], ['ak47', 9], ['rifle', 7], ['scar', 6], ['mini14', 6], ['mp5', 7], ['uzi', 7], ['vector', 6], ['plasma_smg', 4], ['shotgun', 6], ['s1897', 6], ['double_barrel', 4], ['kar98', 5], ['sniper', 3], ['hunting_rifle', 4], ['crossbow', 3], ['m249', 2], ['barrett', 1]];
const W_PISTOLS = [['pistol', 6], ['revolver', 4], ['deagle', 3], ['blaster', 3]];
// 탄약: 총마다 쓰는 탄
export const AMMO = { '9mm': { name: '9mm', emoji: '🟡', n: 30 }, '556': { name: '5.56mm', emoji: '🟢', n: 30 }, '762': { name: '7.62mm', emoji: '🟠', n: 30 }, '12g': { name: '12게이지', emoji: '🔴', n: 12 }, '300': { name: '.300 매그넘', emoji: '🟣', n: 10 }, bolt: { name: '석궁 화살', emoji: '🏹', n: 8 } };
export const AMMO_OF = { m4: '556', rifle: '556', mini14: '556', m249: '556', ak47: '762', scar: '762', kar98: '762', sniper: '762', hunting_rifle: '762', mp5: '9mm', uzi: '9mm', vector: '9mm', plasma_smg: '9mm', pistol: '9mm', revolver: '9mm', deagle: '9mm', blaster: '9mm', shotgun: '12g', s1897: '12g', double_barrel: '12g', barrett: '300', crossbow: 'bolt' };
// 부착물: 자리(scope · mag · muzzle · grip) 하나에 하나
export const ATTS = {
  red: { name: '레드닷', emoji: '🔴', slot: 'scope', zoom: 1.35, w: 6 },
  x2: { name: '2배율 스코프', emoji: '🔭', slot: 'scope', zoom: 2, w: 5 },
  x4: { name: '4배율 스코프', emoji: '🔭', slot: 'scope', zoom: 4, w: 3 },
  x8: { name: '8배율 스코프', emoji: '🔭', slot: 'scope', zoom: 8, w: 1 },
  ext: { name: '대용량 탄창', emoji: '📦', slot: 'mag', mag: 1.5, w: 5 },
  quick: { name: '퀵드로우 탄창', emoji: '⚡', slot: 'mag', reload: 0.7, w: 4 },
  extq: { name: '대용량 퀵드로우 탄창', emoji: '📦', slot: 'mag', mag: 1.5, reload: 0.7, w: 2 },
  comp: { name: '보정기', emoji: '🔩', slot: 'muzzle', recoil: 0.65, w: 4 },
  supp: { name: '소음기', emoji: '🤫', slot: 'muzzle', silent: true, w: 3 },
  vgrip: { name: '수직 손잡이', emoji: '✊', slot: 'grip', recoil: 0.8, w: 4 },
  agrip: { name: '앵글 손잡이', emoji: '📐', slot: 'grip', spread: 0.78, w: 4 },
};
export const SLOTS = ['scope', 'mag', 'muzzle', 'grip'];
// 이 총에 이 부착물이 맞나
export function fits(a, w) {
  const A = ATTS[a]; if (!A || !w) return false;
  if (w.cls === 'pistol') return a === 'red' || a === 'supp' || A.slot === 'mag';
  if (A.slot === 'mag') return !['double_barrel', 'crossbow'].includes(w.id);
  if (A.slot === 'grip') return ['rifle', 'smg', 'lmg'].includes(w.cls);
  if (A.slot === 'muzzle') return w.cls !== 'shotgun' && w.id !== 'crossbow';
  return true;
}
// 가방: 단계마다 담을 수 있는 양 (0 = 가방 없음)
export const BAG_NAME = ['없음', '1단계 가방', '2단계 가방', '3단계 가방'];
export const CAP = { ammo: [90, 180, 270, 360], band: [5, 10, 15, 20], med: [1, 2, 3, 4], boost: [2, 4, 6, 8], throw: [2, 3, 4, 5] };
export const BOOSTS = { drink: { name: '에너지 젤리 음료', emoji: '🥤', sec: 4, add: 40 }, pill: { name: '진통 젤리', emoji: '💊', sec: 6, add: 60 } };
const KINDS = [['gun', 28], ['pistol', 8], ['ammo', 26], ['att', 16], ['armor', 8], ['helmet', 8], ['bag', 6], ['band', 12], ['med', 3], ['drink', 5], ['pill', 3], ['nade', 6], ['smoke', 5]];
const pickW = (list, r) => { let t = list.reduce((a, [, w]) => a + w, 0) * r(); for (const [v, w] of list) { if ((t -= w) <= 0) return v; } return list[0][0]; };
const lvl = (r) => { const x = r(); return x < 0.58 ? 1 : x < 0.9 ? 2 : 3; };
export function rollItem(r) {
  const k = pickW(KINDS, r);
  if (k === 'gun') return { k, w: pickW(W_GUNS, r) };
  if (k === 'pistol') return { k, w: pickW(W_PISTOLS, r) };
  if (k === 'ammo') { const a = pickW([['556', 4], ['762', 4], ['9mm', 4], ['12g', 2], ['300', 0.6], ['bolt', 0.8]], r); return { k, a, n: AMMO[a].n }; }
  if (k === 'att') return { k, a: pickW(Object.entries(ATTS).map(([id, A]) => [id, A.w]), r) };
  if (k === 'armor' || k === 'helmet' || k === 'bag') return { k, lv: lvl(r) };
  if (k === 'band') return { k, n: 3 };
  return { k, n: 1 };
}
export function makeLoot(map, seed) {
  const r = rng(seed ^ 0x2545f491), out = [];
  let id = 1;
  const put = (it, x, y, z) => out.push({ id: id++, ...it, x, y, z });
  for (const [x, y, z] of map.loot) {
    // 배그처럼 한 자리에 여러 개 · 총 옆에는 그 총알
    const n = 1 + (r() < 0.75) + (r() < 0.35);
    for (let i = 0; i < n; i++) {
      const it = rollItem(r), ox = x + (i % 2 ? 0.75 : 0) - (i === 2 ? 0.75 : 0), oz = z + (i ? 0.45 : 0);
      put(it, ox, y, oz);
      if (it.k === 'gun' || it.k === 'pistol') { const a = AMMO_OF[it.w]; put({ k: 'ammo', a, n: AMMO[a].n }, ox + 0.4, y, oz - 0.5); }
    }
  }
  return out;
}
export const ARMOR_NAME = ['', '1단계', '2단계', '3단계'];
export function itemLabel(it, weapon) {
  if (it.k === 'gun' || it.k === 'pistol') { const w = weapon(it.w); return `${w?.emoji || '🔫'} ${w?.name || it.w}`; }
  if (it.k === 'ammo') return `${AMMO[it.a]?.emoji || ''} ${AMMO[it.a]?.name || it.a} ×${it.n}`;
  if (it.k === 'att') return `${ATTS[it.a]?.emoji || ''} ${ATTS[it.a]?.name || it.a}`;
  if (it.k === 'armor') return `🦺 젤리 조끼 ${ARMOR_NAME[it.lv]}`;
  if (it.k === 'helmet') return `⛑️ 젤리 헬멧 ${ARMOR_NAME[it.lv]}`;
  if (it.k === 'bag') return `🎒 ${BAG_NAME[it.lv]}`;
  if (it.k === 'band') return `${HEALS.band.emoji} ${HEALS.band.name} ×${it.n || 1}`;
  if (it.k === 'med') return `${HEALS.med.emoji} ${HEALS.med.name}`;
  if (it.k === 'drink' || it.k === 'pill') return `${BOOSTS[it.k].emoji} ${BOOSTS[it.k].name}`;
  if (it.k === 'nade') return '💣 젤리 수류탄';
  if (it.k === 'smoke') return '💨 연막탄';
  return '❔';
}
export const emptyInv = () => ({ guns: [null, null], pistol: null, att: [{}, {}], patt: {}, spare: [], ammo: {}, armor: 0, helmet: 0, armorD: 0, helmetD: 0, bag: 0, band: 0, med: 0, drink: 0, pill: 0, nade: 0, smoke: 0 });
export const ammoTotal = (inv) => Object.values(inv.ammo || {}).reduce((a, b) => a + b, 0);

// ---------- 젤리 차량 ----------
//   길 위에 세워 둔 차 (F 타기 · 내리기). 버기는 빠르고 가볍게, 젤리 밴은 튼튼하게
export const VEHICLES = { buggy: { name: '젤리 버기', max: 26, acc: 15, turn: 1.9, hp: 160, r: 1.4, len: 3.2 }, van: { name: '젤리 밴', max: 21, acc: 11, turn: 1.5, hp: 260, r: 1.7, len: 4.4 } };
export function makeVehicles(seed) {
  const r = rng(seed ^ 0x3c6ef372), out = [];
  // 큰길 가장자리에 길 방향으로 (가로길: ±x 방향 · 세로길: ±z 방향)
  const H = Math.PI / 2, spots = [[-80, -1.8, -H], [-40, 1.8, H], [30, -1.8, H], [75, 1.8, H], [-1.8, -80, Math.PI], [1.8, -35, 0], [-1.8, 40, Math.PI], [1.8, 85, 0], [-62, -12, Math.PI], [62, 10, 0], [-100, 1.8, H], [100, -1.8, -H]];
  spots.forEach(([x, z, yaw], i) => { if (r() < 0.8) { const kind = r() < 0.62 ? 'buggy' : 'van'; out.push({ id: i + 1, kind, x, z, y: 0, yaw: yaw + (r() - 0.5) * 0.2, hp: VEHICLES[kind].hp, driver: 0 }); } });
  return out;
}

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
