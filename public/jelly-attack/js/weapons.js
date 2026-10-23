// 젤리어택 무기: 젤리시티 무기(위력 · 연사 · 사거리 · 반동 · 산탄 수)를 그대로 쓰고, 탄창 · 장전 · 퍼짐만 더한다
//   서버도 이 파일로 피해를 계산한다
import { ITEMS } from '../../jelly-city/js/items.js';

// cls: 종류 (화면 총 모양 · 소리) · mag: 탄창 · reload: 장전(초) · spread: 기본 퍼짐(라디안) · move: 움직일 때 퍼짐
const EXTRA = {
  m4: { cls: 'rifle', mag: 30, reload: 2.1, spread: 0.012, move: 0.035 },
  ak47: { cls: 'rifle', mag: 30, reload: 2.4, spread: 0.016, move: 0.04 },
  rifle: { cls: 'rifle', mag: 30, reload: 2.2, spread: 0.014, move: 0.035 },
  scar: { cls: 'rifle', mag: 20, reload: 2.5, spread: 0.012, move: 0.045 },
  mp5: { cls: 'smg', mag: 30, reload: 1.8, spread: 0.02, move: 0.025 },
  uzi: { cls: 'smg', mag: 32, reload: 1.6, spread: 0.03, move: 0.03 },
  plasma_smg: { cls: 'smg', mag: 40, reload: 1.9, spread: 0.022, move: 0.026 },
  sniper: { cls: 'sniper', mag: 5, reload: 3.0, spread: 0.002, move: 0.12, scope: true },
  hunting_rifle: { cls: 'sniper', mag: 5, reload: 2.8, spread: 0.003, move: 0.1, scope: true },
  barrett: { cls: 'sniper', mag: 5, reload: 3.6, spread: 0.002, move: 0.15, scope: true },
  shotgun: { cls: 'shotgun', mag: 8, reload: 3.0, spread: 0.0, move: 0.02 },
  double_barrel: { cls: 'shotgun', mag: 2, reload: 2.2, spread: 0.0, move: 0.02 },
  m249: { cls: 'lmg', mag: 100, reload: 4.5, spread: 0.022, move: 0.06 },
  pistol: { cls: 'pistol', mag: 12, reload: 1.4, spread: 0.012, move: 0.02 },
  revolver: { cls: 'pistol', mag: 6, reload: 2.2, spread: 0.01, move: 0.025 },
  deagle: { cls: 'pistol', mag: 7, reload: 1.9, spread: 0.014, move: 0.03 },
  blaster: { cls: 'pistol', mag: 15, reload: 1.5, spread: 0.012, move: 0.02 },
  // 젤리배그 전용 (젤리시티에는 없는 총)
  kar98: { cls: 'sniper', mag: 5, reload: 3.2, spread: 0.002, move: 0.12, iron: true },
  mini14: { cls: 'sniper', mag: 20, reload: 2.4, spread: 0.004, move: 0.06, iron: true },
  vector: { cls: 'smg', mag: 19, reload: 1.6, spread: 0.022, move: 0.024 },
  s1897: { cls: 'shotgun', mag: 5, reload: 3.4, spread: 0.0, move: 0.02 },
  crossbow: { cls: 'sniper', mag: 1, reload: 3.4, spread: 0.002, move: 0.1, iron: true },
};
// 젤리배그 전용 총 (이름 · 위력 · 연사 · 사거리 · 반동)
const BG_DEF = {
  kar98: { name: 'Kar98k', emoji: '🎯', dmg: 82, rate: 1.7, range: 150, held: 'sniper', tracer: '#ffffff', recoil: [0.06, 0.01, 0.3], zoom: 1.6 },
  mini14: { name: 'Mini14', emoji: '🔫', dmg: 34, rate: 0.22, range: 120, held: 'sniper', recoil: [0.03, 0.01, 0.12], zoom: 1.6 },
  vector: { name: 'Vector', emoji: '🔫', dmg: 10, rate: 0.055, range: 40, held: 'rifle', auto: true, recoil: [0.012, 0.012, 0.05] },
  s1897: { name: 'S1897 펌프 샷건', emoji: '💥', dmg: 10, pellets: 8, spread: 0.08, rate: 1.0, range: 24, held: 'shotgun', tracer: '#ffcc80', recoil: [0.12, 0.03, 0.35] },
  crossbow: { name: '석궁', emoji: '🏹', dmg: 95, rate: 2.8, range: 90, held: 'crossbow', tracer: '#c8a46a', recoil: [0.02, 0, 0.1], zoom: 1.6 },
};
export const PRIMARY = ['m4', 'ak47', 'rifle', 'scar', 'mp5', 'uzi', 'plasma_smg', 'sniper', 'hunting_rifle', 'barrett', 'shotgun', 'double_barrel', 'm249'];
export const SECONDARY = ['pistol', 'revolver', 'deagle', 'blaster'];
export const CLASS_NAME = { rifle: '돌격소총', smg: '기관단총', sniper: '저격총', shotgun: '산탄총', lmg: '기관총', pistol: '권총' };
export const HEAD = 2.5;          // 머리 배율 (저격총은 3)
export const KNIFE = { id: 'knife', name: '군용 나이프', emoji: '🔪', cls: 'knife', dmg: 55, back: 100, rate: 0.55, range: 2.4 };
export const NADE = { id: 'nade', name: '젤리 수류탄', emoji: '💣', cls: 'nade', dmg: 130, r: 10.5, inner: 4, fuse: 2.2, speed: 25, up: 5.5 };
export const SMOKE = { id: 'smoke', name: '연막탄', emoji: '💨', cls: 'nade', dmg: 0, r: 7, fuse: 1.6 };
// 수류탄 피해 (서든어택처럼): 4m 안은 거의 즉사 · 10.5m 까지 점점 약해진다
export const nadeDmg = (d) => (d <= NADE.inner ? NADE.dmg : d >= NADE.r ? 0 : NADE.dmg * ((NADE.r - d) / (NADE.r - NADE.inner)) ** 1.3);

const cache = new Map();
export function weapon(id) {
  if (id === 'knife') return KNIFE;
  if (id === 'nade') return NADE;
  if (id === 'smoke') return SMOKE;
  if (cache.has(id)) return cache.get(id);
  const d = ITEMS[id] || BG_DEF[id], x = EXTRA[id];
  if (!d || !x) return null;
  const w = { id, iron: false, name: d.name, emoji: d.emoji, dmg: d.dmg, rate: d.rate, range: d.range || 60, pellets: d.pellets || 1, pspread: d.spread || 0.1, recoil: d.recoil || [0.02, 0.01, 0.05], zoom: d.zoom || 1.5, auto: !!d.auto, held: d.held, tracer: d.tracer || '#fff3b0', ...x };
  w.head = w.cls === 'sniper' ? 3 : HEAD;
  cache.set(id, w);
  return w;
}
// 거리에 따른 위력 (사거리를 넘으면 점점 약해진다)
export const falloff = (w, dist) => (dist <= w.range ? 1 : Math.max(0.35, 1 - (dist - w.range) / w.range));
