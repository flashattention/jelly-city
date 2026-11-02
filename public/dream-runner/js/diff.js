// 드림 러너 난이도: 길은 그대로, 달리는 빠르기만 다르다 (서버 · 브라우저 공용)
//   순위표는 난이도마다 따로. 이지는 예전 기록을 그대로 쓴다
export const DIFFS = {
  easy: { k: 1, name: '🌱 이지' },
  normal: { k: 1.25, name: '🙂 노멀' },
  hard: { k: 1.55, name: '🔥 하드' },
  extreme: { k: 1.9, name: '💀 익스트림' },
};
export const diffOf = (d) => (Object.hasOwn(DIFFS, d) ? d : 'easy');
