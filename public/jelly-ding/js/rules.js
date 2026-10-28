// 젤리 땡 규칙 (서버 · 화면이 같이 쓴다)
//   차례대로 맨 위 카드를 뒤집어 내 앞 더미에 올린다. 모두의 '맨 위 카드'만 센다
//   한 가지 맛 곰젤리가 가운데 '목표 숫자'와 딱 같아지면 종을 친다 → 땡!
//   🌟 황금곰: 보이면 바로 땡   🌈 무지개곰: 모든 맛에 1마리씩 더해진다   🍋 시큼젤리: 보이는 동안은 절대 치면 안 된다 (쉿!)
//   맞게 치면 가운데 더미를 모두 가져가고, 틀리면 다른 사람 모두에게 카드 1장씩 준다
//   목표 숫자는 누가 더미를 가져갈 때마다 바뀐다 (사람이 적으면 작은 숫자 · 많으면 큰 숫자)

export const FLAVORS = [
  { name: '딸기', emoji: '🍓', color: '#ff4f6d' },
  { name: '레몬', emoji: '🍋', color: '#ffc93c' },
  { name: '메론', emoji: '🍈', color: '#5fd36a' },
  { name: '소다', emoji: '🫧', color: '#45b4ff' },
  { name: '포도', emoji: '🍇', color: '#a66bff' },
];
export const GOLD = 100, SOUR = 101, RAIN = 102;
export const targetsFor = (n) => (n <= 2 ? [3, 4, 5] : n <= 4 ? [4, 5, 6] : [5, 6, 7]); // 보이는 카드가 많을수록 큰 숫자
export const TIMES = [120, 180, 300];
export const SPEEDS = { normal: 3200, fast: 2200 }; // 차례마다 이 시간이 지나면 저절로 뒤집힌다

export const isSpecial = (c) => c >= 100;
export const flavorOf = (c) => Math.floor(c / 8);
export const countOf = (c) => c % 8;
export const card = (f, n) => f * 8 + n;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 카드 한 벌: 맛마다 1마리 ×5 · 2마리 ×3 · 3마리 ×3 · 4마리 ×2 · 5마리 ×1 (= 14장 × 5맛) + 특수 카드
export function makeDeck(R, specials = true) {
  const d = [];
  for (let f = 0; f < FLAVORS.length; f++) for (const [n, k] of [[1, 5], [2, 3], [3, 3], [4, 2], [5, 1]]) for (let i = 0; i < k; i++) d.push(card(f, n));
  if (specials) for (const s of [GOLD, SOUR, RAIN]) for (let i = 0; i < 4; i++) d.push(s);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// 지금 보이는 맨 위 카드들로: 쳐도 되나?
//   돌려주는 값: { ok, why, totals, hit: 맞은 맛 번호 | -1 }
export function judge(tops, target) {
  const totals = new Array(FLAVORS.length).fill(0);
  let gold = false, sour = false, rain = 0;
  for (const c of tops) {
    if (c == null || c < 0) continue;
    if (c === GOLD) gold = true; else if (c === SOUR) sour = true; else if (c === RAIN) rain++;
    else totals[flavorOf(c)] += countOf(c);
  }
  for (let f = 0; f < totals.length; f++) totals[f] += rain;
  if (sour) return { ok: false, why: 'sour', totals, hit: -1 };
  if (gold) return { ok: true, why: 'gold', totals, hit: -1 };
  const hit = totals.findIndex((v) => v === target);
  return { ok: hit >= 0, why: hit >= 0 ? 'match' : 'none', totals, hit };
}
