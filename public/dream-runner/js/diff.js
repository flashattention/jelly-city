// 드림 러너 난이도: 길은 그대로, 달리는 빠르기만 다르다 (서버 · 브라우저 공용)
//   순위표는 난이도마다 따로. 노멀(속 이름 easy)은 예전 기록을 그대로 쓴다 · 예전 노멀(1.25배)은 없앴다 (예전 링크 · 저장값은 노멀로)
export const DIFFS = {
  easy: { k: 1, name: '🙂 예전 노멀', hidden: true }, // 2026-11-15 없앰: 고르기 · 순위표 · 내 기록에서 숨긴다 (예전 기록은 서버에 그대로)
  hard: { k: 1.55, name: '🙂 노멀' }, // 2026-11-15 부터 이름만 '노멀' (예전 하드). 속 이름 hard 는 그대로라 기록 · 업적 · 칭호가 이어진다
  extreme: { k: 2.17, name: '🔥 하드' }, // 2026-11-15 부터 '하드' · 노멀의 1.4배 (예전 익스트림 1.9배, 그때 기록은 초기화)
  lightspeed: { k: 2.85, name: '⚡ 광속' }, // 예전 익스트림(1.9)의 1.5배
  beyond: { k: 3.8, name: '🌌 초월' }, // 예전 익스트림(1.9)의 2배
  singular: { k: 5.7, name: '💠 특이점' }, // 초월의 1.5배
};
// 고를 수 있는 난이도 (숨긴 노멀 빼고). 숨긴 난이도 · 모르는 값은 하드로
export const DIFF_KEYS = Object.keys(DIFFS).filter((k) => !DIFFS[k].hidden);
export const diffOf = (d) => (Object.hasOwn(DIFFS, d) && !DIFFS[d].hidden ? d : 'hard');
// 노멀(속 이름 hard)의 몇 배속인지 (모드 고르기에 쓴다)
export const vsHard = (d) => Math.round((DIFFS[d].k / DIFFS.hard.k) * 100) / 100;
