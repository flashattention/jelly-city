// 거대 젤리 (도시를 습격한다): 서버와 브라우저가 같이 쓰는 치수와 약점 위치
// 곰돌이 젤리 모델을 s배로 키운 것. 크기 1일 때 키가 약 3, 머리 중심이 1.95 높이
export const TITAN = {
  minS: 8, maxS: 18,          // 키 약 24m ~ 54m (도시 빌딩보다 크다)
  body: 0.62, top: 3.0,       // 맞는 몸통 (반지름 · 키, 크기 1 기준)
  napeY: 1.62, napeBack: 0.42, // 뒷목: 머리 아래 뒤쪽
  napeR: 0.3,                 // 뒷목을 베었다고 볼 거리 (크기 1 기준, 여기에 여유를 더한다)
  colors: ['#ff8fb1', '#ffb74d', '#aed581', '#81d4fa', '#ce93d8', '#ffe082', '#f48fb1', '#80cbc4'],
};
export const titanHeight = (s) => TITAN.top * s;
// 뒷목 위치 (x, z, h = 바라보는 방향, y = 발 높이)
export function napePos(t, out = {}) {
  out.x = t.x - Math.sin(t.h) * TITAN.napeBack * t.s;
  out.y = (t.y || 0) + TITAN.napeY * t.s;
  out.z = t.z - Math.cos(t.h) * TITAN.napeBack * t.s;
  return out;
}
// 뒷목을 벤 것으로 칠 거리: 큰 젤리일수록 조금 넉넉하게
export const napeReach = (s) => 3 + TITAN.napeR * s;
// 뒷목을 몇 번 베어야 쓰러지나: 작은 것 한 번 · 중간 두 번 · 큰 것 세 번 · 아주 큰 것(키 51m 넘게) 네 번
export const napeHits = (s) => (s < 11.3 ? 1 : s < 14.7 ? 2 : s < 17 ? 3 : 4);
