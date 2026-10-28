// 젤리 슬라이드 엔진: 판을 한쪽으로 밀면 젤리곰이 미끄러지고, 같은 단계끼리 부딪히면 한 단계 큰 곰으로
//   화면 · 서버(봇) 같이 쓴다 (DOM 없음). 같은 씨앗 + 같은 움직임이면 언제나 같은 판
//   🍬 설탕 덩어리: 움직이지 않는 벽 · 바로 옆에서 합치면 녹는다
//   🌈 무지개 젤리: 어떤 젤리와 부딪혀도 그 젤리를 한 단계 올린다
//   한 번 밀어서 여러 번 합치면 콤보 보너스 · 큰 곰을 만들면 상대 판에 설탕 덩어리 공격
export const SUGAR = 0, KING = 11, RAINBOW = 12;
export const FLAVORS = [
  { n: '설탕 덩어리', c: '#e9e4f2' },
  { n: '체리', c: '#ff4d6d' }, { n: '레몬', c: '#ffd23f' }, { n: '라임', c: '#62cf7a' }, { n: '블루베리', c: '#4a9dff' },
  { n: '오렌지', c: '#ff9334' }, { n: '포도', c: '#9a6bff' }, { n: '복숭아', c: '#ff9e8a' }, { n: '민트', c: '#3fd0c0' },
  { n: '딸기우유', c: '#ff86c2' }, { n: '콜라', c: '#b0642e' }, { n: '무지개 왕곰', c: '#ffcf33' },
  { n: '무지개 젤리', c: '#ffffff' },
];
export const SIZES = [4, 5];
export const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
export const pts = (lv) => 10 * 2 ** (lv - 1);

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Board {
  // o = { star: 무지개 젤리 · sugar: 혼자서도 가끔 설탕 덩어리 }
  constructor(seed, n = 4, o = {}) {
    this.n = SIZES.includes(n) ? n : 4;
    this.o = { star: o.star !== false, sugar: o.sugar !== false };
    this.q = rng(seed);
    this.cells = new Array(this.n * this.n).fill(null);
    this.nid = 1; this.score = 0; this.best = 0; this.moves = 0; this.merges = 0; this.combo = 0;
    this.nextStar = 18 + Math.floor(this.q() * 10); this.nextSugar = 30 + Math.floor(this.q() * 12);
    this.atk = 0; this.incoming = 0; this.sent = 0; this.over = false; this.undo = null;
    this.ev = [];
    this.spawn(); this.spawn();
  }
  at(x, y) { return this.cells[y * this.n + x]; }
  set(x, y, t) { this.cells[y * this.n + x] = t; if (t) { t.x = x; t.y = y; } }
  empties() { const e = []; for (let i = 0; i < this.cells.length; i++) if (!this.cells[i]) e.push(i); return e; }
  put(lv, idx) { const t = { id: this.nid++, lv, x: idx % this.n, y: Math.floor(idx / this.n) }; this.cells[idx] = t; return t; }
  // 새 젤리: 대부분 체리 · 가끔 레몬 · 이따금 무지개
  spawn() {
    const e = this.empties(); if (!e.length) return null;
    const idx = e[Math.floor(this.q() * e.length)];
    let lv = this.q() < 0.86 ? 1 : 2;
    if (this.o.star && this.moves >= this.nextStar) { lv = RAINBOW; this.nextStar = this.moves + 22 + Math.floor(this.q() * 12); }
    const t = this.put(lv, idx);
    this.ev.push({ k: 'spawn', id: t.id, x: t.x, y: t.y, lv });
    return t;
  }
  addSugar(n) {
    // 내가 공격 중이면 먼저 상쇄
    const c = Math.min(n, this.atk); this.atk -= c; n -= c; if (c) this.ev.push({ k: 'cancel', n: c });
    if (n > 0) { this.incoming += n; this.ev.push({ k: 'warn', n: this.incoming }); }
  }
  dropSugar(n) {
    for (let i = 0; i < n; i++) {
      const e = this.empties(); if (!e.length) break;
      const t = this.put(SUGAR, e[Math.floor(this.q() * e.length)]);
      this.ev.push({ k: 'sugar', id: t.id, x: t.x, y: t.y });
    }
  }
  takeAtk() { const n = this.atk; this.atk = 0; this.sent += n; return n; }
  snap() { return this.cells.map((t) => (t ? t.lv : -1)); }

  // 두 젤리가 부딪히면? → 새 단계 (못 합치면 0)
  static mergeLv(a, b) {
    if (a === SUGAR || b === SUGAR) return 0;
    if (a === RAINBOW && b === RAINBOW) return 3;
    if (a === RAINBOW) return Math.min(KING + 1, b + 1);
    if (b === RAINBOW) return Math.min(KING + 1, a + 1);
    if (a === b) return a + 1; // KING + KING = 12 → 대폭발
    return 0;
  }
  // 줄 하나(벽 쪽부터)를 민다: 설탕 덩어리에서 끊긴다 · 한 번 합쳐진 곰은 그 줄에서 다시 합치지 않는다
  slideLine(line) {
    const out = new Array(line.length).fill(null), merged = [];
    let seg = 0; // 지금 칸들이 쌓이는 시작 자리
    let last = null, lastMerged = false;
    for (let i = 0; i < line.length; i++) {
      const t = line[i]; if (!t) continue;
      if (t.lv === SUGAR) { out[i] = t; seg = i + 1; last = null; lastMerged = false; continue; }
      const nl = last && !lastMerged ? Board.mergeLv(last.t.lv, t.lv) : 0;
      if (nl) { merged.push({ into: last.pos, a: last.t, b: t, lv: nl }); lastMerged = true; continue; }
      out[seg] = t; last = { t, pos: seg }; lastMerged = false; seg++;
    }
    return { out, merged };
  }
  canMove() {
    if (this.empties().length) return true;
    for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
      const t = this.at(x, y); if (!t || t.lv === SUGAR) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) { const u = this.at(x + dx, y + dy); if (x + dx < this.n && y + dy < this.n && u && Board.mergeLv(t.lv, u.lv)) return true; }
    }
    return false;
  }
  // dir: left · right · up · down → 움직였으면 true
  move(dir, keepUndo = false) {
    if (this.over || !DIRS[dir]) return false;
    const [dx, dy] = DIRS[dir], n = this.n;
    const before = keepUndo ? this.save() : null;
    const slides = [], merges = [];
    let moved = false;
    for (let k = 0; k < n; k++) {
      // 벽 쪽부터 줄 좌표
      const coords = [];
      for (let i = 0; i < n; i++) { const j = dx > 0 || dy > 0 ? n - 1 - i : i; coords.push(dx ? [j, k] : [k, j]); }
      const line = coords.map(([x, y]) => this.at(x, y));
      const { out, merged } = this.slideLine(line);
      for (let i = 0; i < n; i++) { const t = out[i]; if (t && (t.x !== coords[i][0] || t.y !== coords[i][1])) moved = true; }
      if (merged.length) moved = true;
      for (const [x, y] of coords) this.cells[y * n + x] = null;
      for (let i = 0; i < n; i++) { const t = out[i]; if (!t) continue; const [x, y] = coords[i]; slides.push({ id: t.id, fx: t.x, fy: t.y, tx: x, ty: y }); this.set(x, y, t); }
      for (const m of merged) { const [x, y] = coords[m.into]; slides.push({ id: m.b.id, fx: m.b.x, fy: m.b.y, tx: x, ty: y, gone: true }); merges.push({ x, y, a: m.a, lv: m.lv }); }
    }
    if (!moved) return false;
    if (before) this.undo = before;
    this.moves++;
    this.ev.push({ k: 'slide', s: slides });
    // 합치기 · 점수 · 녹이기
    let gain = 0, combo = merges.length, maxLv = 0, burst = false;
    for (const m of merges) {
      const t = this.at(m.x, m.y);
      if (m.lv > KING) { // 왕곰 + 왕곰 = 젤리 대폭발: 판의 설탕도 모두 녹는다
        this.cells[m.y * n + m.x] = null; burst = true; gain += 5000;
        this.ev.push({ k: 'burst', x: m.x, y: m.y, id: t.id });
        for (let i = 0; i < this.cells.length; i++) if (this.cells[i]?.lv === SUGAR) { this.ev.push({ k: 'melt', id: this.cells[i].id, x: i % n, y: Math.floor(i / n) }); this.cells[i] = null; }
        continue;
      }
      t.lv = m.lv; t.pop = true; gain += pts(m.lv); maxLv = Math.max(maxLv, m.lv); this.merges++;
      this.best = Math.max(this.best, m.lv);
      this.ev.push({ k: 'merge', id: t.id, x: m.x, y: m.y, lv: m.lv, combo });
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const sx = m.x + ox, sy = m.y + oy; if (sx < 0 || sy < 0 || sx >= n || sy >= n) continue;
        const s = this.at(sx, sy); if (s?.lv === SUGAR) { this.cells[sy * n + sx] = null; this.ev.push({ k: 'melt', id: s.id, x: sx, y: sy }); gain += 15; }
      }
    }
    if (combo >= 2) gain = Math.round(gain * (1 + 0.5 * (combo - 1)));
    this.score += gain; this.combo = combo;
    if (gain) this.ev.push({ k: 'score', gain, combo });
    // 공격: 포도(6) 이상 · 3콤보 이상 · 대폭발
    let a = 0;
    if (maxLv >= 6) a += maxLv - 5;
    if (combo >= 3) a += combo - 2;
    if (burst) a += 4;
    if (a) { const c = Math.min(a, this.incoming); this.incoming -= c; a -= c; if (c) this.ev.push({ k: 'cancel', n: c }); this.atk += a; }
    // 들어온 설탕 (한 번에 3개까지) · 새 젤리 · 혼자서도 가끔 설탕
    if (this.incoming > 0) { const k = Math.min(3, this.incoming); this.incoming -= k; this.dropSugar(k); }
    this.spawn();
    if (this.o.sugar && this.moves >= this.nextSugar) { this.dropSugar(1); this.nextSugar = this.moves + 28 + Math.floor(this.q() * 14); }
    if (!this.canMove()) { this.over = true; this.ev.push({ k: 'over' }); }
    return true;
  }
  // 되돌리기 (혼자 하기에서 한 판에 한 번)
  save() { return { cells: this.cells.map((t) => (t ? { ...t, pop: false } : null)), score: this.score, best: this.best, moves: this.moves, merges: this.merges, nid: this.nid, nextStar: this.nextStar, nextSugar: this.nextSugar }; }
  restore(s) {
    this.cells = s.cells.map((t) => (t ? { ...t } : null)); this.score = s.score; this.best = s.best; this.moves = s.moves; this.merges = s.merges;
    this.nid = Math.max(this.nid, s.nid); this.nextStar = s.nextStar; this.nextSugar = s.nextSugar; this.over = false;
  }
  doUndo() { if (!this.undo) return false; this.restore(this.undo); this.undo = null; this.ev.push({ k: 'undo' }); return true; }
  maxLv() { let m = 0; for (const t of this.cells) if (t && t.lv !== RAINBOW) m = Math.max(m, t.lv); return m; }
}

// ---------- 봇: 네 방향을 해 보고 점수를 매긴다 (빈칸 · 큰 곰은 구석 · 이웃끼리 비슷하게) ----------
function evalBoard(b) {
  const n = b.n; let s = b.empties().length * 30;
  let mx = 0, mi = 0;
  b.cells.forEach((t, i) => { if (t && t.lv !== SUGAR && t.lv !== RAINBOW && t.lv > mx) { mx = t.lv; mi = i; } });
  const cx = mi % n, cy = Math.floor(mi / n);
  if ((cx === 0 || cx === n - 1) && (cy === 0 || cy === n - 1)) s += mx * 25;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const t = b.at(x, y); if (!t || t.lv === SUGAR) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const u = x + dx < n && y + dy < n ? b.at(x + dx, y + dy) : null; if (u && u.lv !== SUGAR) s -= Math.abs(t.lv - u.lv) * 4; }
  }
  return s;
}
function clone(b) {
  const c = Object.create(Board.prototype);
  Object.assign(c, b, { cells: b.cells.map((t) => (t ? { ...t } : null)), ev: [], q: rng(1), undo: null, o: { ...b.o, star: false, sugar: false } });
  return c;
}
export function botMove(b, R = Math.random, skill = 0.7) {
  const opts = [];
  for (const d of Object.keys(DIRS)) {
    const c = clone(b); const s0 = c.score;
    if (!c.move(d)) continue;
    opts.push({ d, v: (c.score - s0) * 0.5 + evalBoard(c) + (c.over ? -5000 : 0) + R() * (1 - skill) * 120 });
  }
  if (!opts.length) return null;
  opts.sort((a, b2) => b2.v - a.v);
  return opts[0].d;
}
