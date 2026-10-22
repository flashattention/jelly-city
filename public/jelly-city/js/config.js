// 도시 격자 치수 (단위: 미터)
export const BLOCK = 40;          // 블록 한 변
export const ROAD = 14;           // 도로 폭 (보도 포함)
export const GRID = 8;            // 8 x 8 블록 (바깥 한 줄은 교외 주택단지)
export const CELL = BLOCK + ROAD; // 54
export const CITY = GRID * BLOCK + (GRID + 1) * ROAD;
export const HALF = CITY / 2;
export const ASPHALT_HALF = 4.5;  // 차도 반폭
export const WALK_OFF = 5.75;     // 도로 중심 → 보행 라인
export const LANE_OFF = 2.2;      // 도로 중심 → 차선

export const roadC = (i) => -HALF + ROAD / 2 + i * CELL;
export const blockMin = (j) => roadC(j) + ROAD / 2;

// 실내는 도시에서 멀리 떨어진 곳에 만든다
export const INTERIOR_ORIGIN = { x: 1200, z: 1200 };

// 1초 = 게임 내 몇 분
export const DEFAULT_TIME_SPEED = 1.5;

export const POPULATION = 180;
export const SEED = 20261006;

// 신호등: 실제 시각 기준 20초 주기. 서버의 AI 차와 모든 화면의 신호등이 같은 박자로 바뀐다
export function signalPhase(ms = Date.now()) {
  const ph = (ms / 1000) % 20;
  return { nsGreen: ph < 8, nsYellow: ph >= 8 && ph < 10, ewGreen: ph >= 10 && ph < 18, ewYellow: ph >= 18 };
}

// 보행 라인 (x 고정 라인은 남북 이동, z 고정 라인은 동서 이동)
export const X_LINES = [];
export const Z_LINES = [];
for (let i = 0; i <= GRID; i++) {
  if (i > 0) { X_LINES.push(roadC(i) - WALK_OFF); Z_LINES.push(roadC(i) - WALK_OFF); }
  if (i < GRID) { X_LINES.push(roadC(i) + WALK_OFF); Z_LINES.push(roadC(i) + WALK_OFF); }
}
