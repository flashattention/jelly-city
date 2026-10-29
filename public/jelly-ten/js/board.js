// 젤리텐 판: 17×10 칸에 1~9 숫자 곰젤리. 네모로 묶어 합이 10이면 사라진다
//   서버도 이 파일로 같은 판을 만들고 움직임을 다시 확인한다 (점수는 서버가 센다)
export const COLS = 17, ROWS = 10;
export const TIMES = [60, 120, 180];

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function makeBoard(seed) {
  const r = rng(seed), b = new Array(COLS * ROWS);
  for (let i = 0; i < b.length; i++) b[i] = 1 + Math.floor(r() * 9);
  // 전체 합이 10의 배수가 되게 마지막 칸을 맞춘다 (끝까지 깨끗이 지울 수 있는 희망)
  const s = b.reduce((x, y) => x + y, 0), need = (10 - (s % 10)) % 10;
  if (need) { const last = b.length - 1; b[last] = ((b[last] + need - 1) % 9) + 1; }
  return b;
}
// 네모 [x0, y0, x1, y1] (칸 번호, 양끝 포함) 를 바르게
export function normRect(rc) {
  if (!Array.isArray(rc) || rc.length !== 4) return null;
  const [a, b, c, d] = rc.map((v) => Math.round(Number(v)));
  if (![a, b, c, d].every(Number.isFinite)) return null;
  const x0 = Math.max(0, Math.min(a, c)), x1 = Math.min(COLS - 1, Math.max(a, c)), y0 = Math.max(0, Math.min(b, d)), y1 = Math.min(ROWS - 1, Math.max(b, d));
  if (x0 > x1 || y0 > y1) return null;
  return [x0, y0, x1, y1];
}
export function sumRect(board, rc) {
  let s = 0, n = 0;
  for (let y = rc[1]; y <= rc[3]; y++) for (let x = rc[0]; x <= rc[2]; x++) { const v = board[y * COLS + x]; if (v) { s += v; n++; } }
  return { s, n };
}
// 합이 10이면 지우고 지운 개수를, 아니면 0
export function tryMove(board, rect) {
  const rc = normRect(rect); if (!rc) return 0;
  const { s, n } = sumRect(board, rc);
  if (s !== 10 || !n) return 0;
  for (let y = rc[1]; y <= rc[3]; y++) for (let x = rc[0]; x <= rc[2]; x++) board[y * COLS + x] = 0;
  return n;
}
// 봇 · 힌트: 합이 10인 네모 찾기 (작은 것부터 · 같은 것이 여럿이면 rand 로 고른다)
export function findMove(board, rand = Math.random, prefer = 'small') {
  // 2차원 누적합
  const W = COLS + 1, P = new Int32Array(W * (ROWS + 1)), C = new Int32Array(W * (ROWS + 1));
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const v = board[y * COLS + x], i = (y + 1) * W + (x + 1);
    P[i] = v + P[i - 1] + P[i - W] - P[i - W - 1];
    C[i] = (v ? 1 : 0) + C[i - 1] + C[i - W] - C[i - W - 1];
  }
  const q = (A, x0, y0, x1, y1) => A[(y1 + 1) * W + (x1 + 1)] - A[y0 * W + (x1 + 1)] - A[(y1 + 1) * W + x0] + A[y0 * W + x0];
  const found = [];
  for (let y0 = 0; y0 < ROWS; y0++) for (let x0 = 0; x0 < COLS; x0++) {
    if (!board[y0 * COLS + x0] && found.length > 40) continue;
    for (let y1 = y0; y1 < ROWS; y1++) for (let x1 = x0; x1 < COLS; x1++) {
      const s = q(P, x0, y0, x1, y1);
      if (s > 10) break;
      if (s === 10) {
        // 가장자리가 빈 줄이면 더 작은 네모가 같은 것 → 건너뛴다
        if (!q(C, x0, y0, x0, y1) || !q(C, x1, y0, x1, y1) || !q(C, x0, y0, x1, y0) || !q(C, x0, y1, x1, y1)) continue;
        found.push([x0, y0, x1, y1, q(C, x0, y0, x1, y1)]);
      }
    }
  }
  if (!found.length) return null;
  if (prefer === 'big') found.sort((a, b) => b[4] - a[4]); else found.sort((a, b) => a[4] - b[4]);
  const top = found.slice(0, Math.max(1, Math.ceil(found.length * 0.3)));
  return top[Math.floor(rand() * top.length)].slice(0, 4);
}
