// 젤리 머지 엔진: 병(통) 안에 젤리를 떨어뜨리고 같은 젤리끼리 닿으면 한 단계 큰 젤리로 합쳐진다
//   화면 · 서버(봇) 같이 쓴다 (DOM 없음). 좌표: 왼쪽 위 (0,0) · 아래로 +y · 폭 W · 높이 H
//   물리: 위치 기반(PBD) 원 충돌 — 반복해서 겹침을 풀고 속도는 움직인 만큼으로 정한다 → 쌓아도 덜덜 떨지 않는다
export const W = 400, H = 640, DL = 112, DROP_Y = 56;
// 단계: 0 = 설탕 덩어리(방해) · 1~11 젤리 · 12 무지개 젤리 · 13 탄산 폭탄
export const SUGAR = 0, RAINBOW = 12, BOMB = 13, KING = 11;
export const RAD = [18, 15, 20, 26, 33, 41, 50, 61, 74, 89, 106, 126, 18, 19];
export const FLAVORS = [
  { n: '설탕 덩어리', c: '#e9e4f2' },
  { n: '체리', c: '#ff4d6d' }, { n: '레몬', c: '#ffd23f' }, { n: '라임', c: '#62cf7a' }, { n: '블루베리', c: '#4a9dff' },
  { n: '오렌지', c: '#ff9334' }, { n: '포도', c: '#9a6bff' }, { n: '복숭아', c: '#ff9e8a' }, { n: '민트', c: '#3fd0c0' },
  { n: '딸기우유', c: '#ff86c2' }, { n: '콜라', c: '#b0642e' }, { n: '무지개 왕곰', c: '#ffcf33' },
  { n: '무지개 젤리', c: '#ffffff' }, { n: '탄산 폭탄', c: '#3a4a7a' },
];
// 만들어진 단계마다 점수 (11 + 11 = 왕곰 둘이 만나면 '젤리 대폭발')
export const PTS = [0, 0, 2, 5, 9, 14, 21, 30, 42, 56, 74, 96];
export const BURST_PTS = 300;
export const CONTAINERS = {
  box: { n: '🫙 네모 병', d: '반듯한 기본 병' },
  bowl: { n: '🥣 둥근 그릇', d: '바닥이 둥글어서 데굴데굴' },
  cup: { n: '🍸 깔때기 컵', d: '아래가 좁아요 · 어려움' },
};
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// 통 벽: 선분 [x0,y0,x1,y1] 들 + 안쪽을 가리키는 법선
function walls(kind) {
  const seg = [];
  if (kind === 'bowl') {
    const top = H - 150, Rb = 208.33, cy = H - Rb, a0 = Math.atan2(top - cy, -200), a1 = Math.atan2(top - cy, 200), N = 16;
    seg.push([0, -300, 0, top]);
    let px = 0, py = top;
    for (let i = 1; i <= N; i++) { const a = a0 + (a1 - a0) * (i / N); const x = 200 + Math.cos(a) * Rb, y = cy + Math.sin(a) * Rb; seg.push([px, py, x, y]); px = x; py = y; }
    seg.push([W, top, W, -300]);
  } else if (kind === 'cup') {
    seg.push([0, -300, 0, 130], [0, 130, 70, H], [70, H, W - 70, H], [W - 70, H, W, 130], [W, 130, W, -300]);
  } else seg.push([0, -300, 0, H], [0, H, W, H], [W, H, W, -300]);
  const ref = [W / 2, H - 200];
  return seg.map(([x0, y0, x1, y1]) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); let nx = -dy / L, ny = dx / L;
    if ((ref[0] - x0) * nx + (ref[1] - y0) * ny < 0) { nx = -nx; ny = -ny; }
    return { x0, y0, dx, dy, L2: L * L, nx, ny };
  });
}

const G = 1500, SUB = 1 / 120, ITER = 5, VMAX = 1100;
let NID = 1;
export class Jar {
  constructor(seed, kind = 'box') {
    this.kind = CONTAINERS[kind] ? kind : 'box';
    this.walls = walls(this.kind);
    this.q = rng(seed); this.r2 = rng(seed ^ 0x9e3779b9);
    this.bodies = []; this.ev = [];
    this.score = 0; this.combo = 0; this.comboT = 0; this.best = 0; this.merges = 0;
    this.drops = 0; this.special = 14 + Math.floor(this.q() * 6);
    this.atk = 0; this.incoming = 0; this.inT = 0; this.sent = 0;
    this.danger = 0; this.over = false; this.t = 0; this.acc = 0; this.cool = 0;
    this.aim = W / 2;
    this.cur = this.pull(); this.nxt = this.pull();
  }
  // 다음 젤리: 작은 것(1~5)만 · 가끔 특별 젤리 (같은 씨앗이면 모두 같은 순서)
  pull() {
    this.drops++;
    if (this.drops >= this.special) { this.special = this.drops + 15 + Math.floor(this.q() * 8); return this.q() < 0.5 ? RAINBOW : BOMB; }
    const x = this.q();
    return x < 0.3 ? 1 : x < 0.56 ? 2 : x < 0.78 ? 3 : x < 0.93 ? 4 : 5;
  }
  canDrop() { return !this.over && this.cool <= 0; }
  clampAim(x, lv = this.cur) { const r = RAD[lv]; return Math.max(r + 1, Math.min(W - r - 1, x)); }
  drop(x = this.aim) {
    if (!this.canDrop()) return false;
    const lv = this.cur; x = this.clampAim(x, lv);
    this.add(lv, x, DROP_Y, 0, 160, true);
    this.cur = this.nxt; this.nxt = this.pull(); this.cool = 0.5;
    this.ev.push({ k: 'drop', lv, x });
    return true;
  }
  add(lv, x, y, vx = 0, vy = 0, fresh = false, r = RAD[lv]) {
    const b = { id: NID++, lv, x, y, px: x, py: y, vx, vy, r, tr: RAD[lv], m: RAD[lv] * RAD[lv] * (lv === SUGAR ? 1.6 : 1), age: 0, fresh, ang: (this.r2() - 0.5) * 0.6, sq: 0, touch: false, fuse: -1, dead: false };
    this.bodies.push(b);
    return b;
  }
  // 방해 설탕: 몇 초 뒤 위에서 쏟아진다 (그 사이 내가 공격하면 먼저 깎인다)
  addSugar(n) { if (this.over || n <= 0) return; if (this.incoming <= 0) this.inT = 2.2; this.incoming = Math.min(24, this.incoming + n); this.ev.push({ k: 'warn', n: this.incoming }); }
  takeAtk() {
    let n = Math.floor(this.atk); if (n <= 0) return 0;
    this.atk -= n;
    const cancel = Math.min(n, this.incoming); this.incoming -= cancel; n -= cancel;
    if (cancel) this.ev.push({ k: 'cancel', n: cancel });
    this.sent += n;
    return n;
  }
  step(dt) {
    if (this.over) return;
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= SUB && !this.over) { this.acc -= SUB; this.sub(SUB); }
  }
  sub(h) {
    this.t += h; this.cool -= h; this.comboT -= h;
    if (this.comboT <= 0) this.combo = 0;
    // 들어오는 설탕
    if (this.incoming > 0) { this.inT -= h; if (this.inT <= 0) { const n = Math.min(8, this.incoming); this.incoming -= n; this.inT = 1.2; this.ev.push({ k: 'sugar', n }); for (let i = 0; i < n; i++) this.add(SUGAR, 24 + ((i * 0.618 + this.r2() * 0.3) % 1) * (W - 48), -30 - Math.floor(i / 3) * 42, 0, 60); } }
    const B = this.bodies;
    for (const b of B) {
      b.age += h; b.touch = false;
      if (b.r < b.tr) b.r = Math.min(b.tr, b.r + (b.tr - b.r) * Math.min(1, 14 * h) + 6 * h);
      b.vy += G * h;
      const sp = Math.hypot(b.vx, b.vy); if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
      b.px = b.x; b.py = b.y; b.x += b.vx * h; b.y += b.vy * h;
      b.sq *= 1 - Math.min(1, 9 * h);
    }
    const merges = [], hit = new Set();
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < B.length; i++) {
        const a = B[i]; if (a.dead) continue;
        for (let j = i + 1; j < B.length; j++) {
          const b = B[j]; if (b.dead) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
          if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
          const d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d, ov = rr - d;
          // 짝 찾기 (한 번만): 같은 단계 · 무지개 · 폭탄
          if (it === 0 && !hit.has(a.id) && !hit.has(b.id)) {
            const pair = this.pairOf(a, b);
            if (pair) { hit.add(a.id); hit.add(b.id); merges.push(pair); }
            else { if (a.lv === BOMB && a.fuse < 0) a.fuse = 0.45; if (b.lv === BOMB && b.fuse < 0) b.fuse = 0.45; }
          }
          const wa = 1 / a.m, wb = 1 / b.m, k = ov / (wa + wb) * 0.9;
          a.x -= nx * k * wa; a.y -= ny * k * wa; b.x += nx * k * wb; b.y += ny * k * wb;
          if (ny > 0.3) a.touch = true; else if (ny < -0.3) b.touch = true; // 아래에 뭔가 있다
        }
      }
      for (const b of B) {
        // 통은 모두 볼록하다 → 벽마다 반평면(안쪽으로 r 이상) 조건만 지키면 절대 빠져나가지 않는다
        for (const w of this.walls) {
          const sd = (b.x - w.x0) * w.nx + (b.y - w.y0) * w.ny;
          if (sd < b.r) { b.x += w.nx * (b.r - sd); b.y += w.ny * (b.r - sd); if (w.ny < -0.3) b.touch = true; if (b.lv === BOMB && b.fuse < 0 && w.ny < -0.5) b.fuse = 0.45; }
        }
      }
    }
    for (const b of B) {
      let vx = (b.x - b.px) / h, vy = (b.y - b.py) / h;
      const land = b.vy - vy; // 갑자기 멈춘 만큼 = 부딪힌 세기
      if (land > 260 && b.age > 0.05) { b.sq = Math.min(0.28, land / 2600); if (land > 500 && b.fresh) this.ev.push({ k: 'land', x: b.x, y: b.y + b.r, lv: b.lv, s: Math.min(1, land / 1400) }); b.fresh = false; }
      const sp = Math.hypot(vx, vy); if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
      if (b.touch) { vx *= 0.985; b.ang += (vx * h) / b.r; }
      vx *= 0.999;
      if (Math.abs(vx) < 1.5) vx = 0; if (Math.abs(vy) < 1.5 && b.touch) vy = 0; // 쉬는 젤리는 조용히
      b.vx = vx; b.vy = vy;
      if (b.lv === BOMB && b.fuse >= 0) { b.fuse -= h; if (b.fuse <= 0) this.boom(b); }
    }
    for (const m of merges) this.doMerge(m);
    if (merges.length || B.some((b) => b.dead)) this.bodies = B.filter((b) => !b.dead);
    // 위험선: 자리 잡은 젤리가 선 위로 올라와 있으면 시간이 흐르고, 2.5초 넘으면 끝
    let top = H;
    for (const b of this.bodies) if (!b.fresh && b.age > 1 && b.lv !== BOMB && Math.abs(b.vy) < 90) top = Math.min(top, b.y - b.r);
    this.top = top;
    if (top < DL) { this.danger += h; if (this.danger > 2.6) { this.over = true; this.ev.push({ k: 'over' }); } } else this.danger = Math.max(0, this.danger - h * 2);
  }
  pairOf(a, b) {
    if (a.lv === b.lv && a.lv >= 1 && a.lv <= KING) return { a, b, kind: a.lv === KING ? 'burst' : 'merge' };
    for (const [x, y] of [[a, b], [b, a]]) if (x.lv === RAINBOW && y.lv >= 1 && y.lv <= KING) return { a: y, b: x, kind: y.lv === KING ? 'burst' : 'rainbow' };
    for (const [x, y] of [[a, b], [b, a]]) if (x.lv === RAINBOW && y.lv === SUGAR) return { a: y, b: x, kind: 'melt' };
    return null;
  }
  doMerge({ a, b, kind }) {
    if (a.dead || b.dead) return;
    a.dead = b.dead = true;
    const rainbow = kind === 'rainbow' || (kind === 'burst' && b.lv === RAINBOW) || kind === 'melt';
    const x = rainbow ? a.x : (a.x * a.m + b.x * b.m) / (a.m + b.m), y = rainbow ? a.y : (a.y * a.m + b.y * b.m) / (a.m + b.m);
    if (kind === 'melt') { this.score += 1; this.ev.push({ k: 'pop', x, y, lv: SUGAR }); return; }
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 1.3;
    const mult = 1 + Math.min(10, this.combo - 1) * 0.25;
    this.merges++;
    if (kind === 'burst') {
      const pts = Math.round(BURST_PTS * mult); this.score += pts; this.atk += 5;
      this.ev.push({ k: 'burst', x, y, pts, combo: this.combo });
      this.melt(x, y, a.r * 1.6);
      return;
    }
    const lv = a.lv + 1, pts = Math.round(PTS[lv] * mult);
    this.score += pts; this.best = Math.max(this.best, lv);
    const n = this.add(lv, x, y, (a.vx + b.vx) / 2, Math.min(0, (a.vy + b.vy) / 2) - 40, false, rainbow ? a.r : Math.max(a.r, b.r));
    n.sq = 0.3; n.age = 0.6;
    if (lv >= 7) this.atk += lv - 6; // 포도(7) 이상부터 공격
    if (this.combo >= 4) this.atk += 1;
    this.ev.push({ k: 'merge', x, y, lv, pts, combo: this.combo, rainbow });
    this.melt(x, y, n.tr + 10);
  }
  // 합쳐진 자리 옆에 붙은 설탕은 녹는다
  melt(x, y, R) {
    for (const s of this.bodies) if (!s.dead && s.lv === SUGAR && Math.hypot(s.x - x, s.y - y) < R + s.r) { s.dead = true; this.score += 1; this.ev.push({ k: 'pop', x: s.x, y: s.y, lv: SUGAR }); }
  }
  boom(b) {
    b.dead = true;
    let pts = 0;
    for (const o of this.bodies) {
      if (o.dead || o === b) continue;
      const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (d < 115 + o.r * 0.3 && (o.lv <= 4 || o.lv === RAINBOW)) { o.dead = true; pts += o.lv === SUGAR ? 1 : PTS[o.lv] + 2; this.ev.push({ k: 'pop', x: o.x, y: o.y, lv: o.lv }); }
      else if (d < 220) { const f = (1 - d / 220) * 700; o.vx += dx / d * f; o.vy += dy / d * f - 120; }
    }
    this.score += pts;
    this.ev.push({ k: 'boom', x: b.x, y: b.y, pts });
  }
  // 상대에게 보여 줄 작은 판 (정수 셋씩)
  snap() { const o = []; for (const b of this.bodies) o.push(Math.round(b.x), Math.round(b.y), b.lv); return o; }
  height() { return Math.max(0, Math.min(1, (H - (this.top ?? H)) / (H - DL))); }
}

// x 에서 떨어뜨리면 처음 닿는 젤리와 그때의 중심 높이
export function landAt(jar, x, r) {
  let hit = null, hy = Infinity;
  for (const b of jar.bodies) {
    if (b.y < DROP_Y - 20) continue;
    const dx = Math.abs(b.x - x), rr = b.r + r; if (dx >= rr) continue;
    const cy = b.y - Math.sqrt(rr * rr - dx * dx);
    if (cy < hy) { hy = cy; hit = b; }
  }
  const fy = floorY(jar, x, r);
  return hit && hy < fy ? { hit, y: hy } : { hit: null, y: fy };
}
// 젤리봇: 떨어뜨릴 자리 고르기 (같은 젤리 위 · 낮은 곳 · 특별 젤리는 알맞은 곳)
export function botAim(jar, rnd = Math.random, skill = 0.7) {
  const lv = jar.cur, r = RAD[lv];
  let best = W / 2, bs = -1e9;
  for (let x = r + 2; x <= W - r - 2; x += 9) {
    const { hit, y: hy } = landAt(jar, x, r);
    let s = hy * 0.12;
    if (hit) {
      if (lv === RAINBOW) s += hit.lv >= 1 && hit.lv <= KING ? 30 + hit.lv * 14 : -20;
      else if (lv === BOMB) s += jar.bodies.filter((o) => o.lv <= 4 && Math.hypot(o.x - x, o.y - hy) < 120).length * 18;
      else if (hit.lv === lv) s += 90 + lv * 6;
      else if (hit.lv === SUGAR) s -= 25;
      else s -= Math.abs(hit.lv - lv) * (hit.lv < lv ? 14 : 6);
    }
    if (hy - r < DL + 40) s -= 300;
    s += rnd() * 40 * (1.3 - skill);
    if (s > bs) { bs = s; best = x; }
  }
  return best;
}
// 벽만 있을 때 바닥에 닿는 높이 (반평면: 아래를 막는 벽마다 y 를 풀면 된다)
function floorY(jar, x, r) {
  let y = Infinity;
  for (const w of jar.walls) if (w.ny < -0.05) { const yy = w.y0 + (r - (x - w.x0) * w.nx) / w.ny; if (yy < y) y = yy; } // (x-x0)nx + (y-y0)ny = r
  return Math.min(y, H - r);
}
