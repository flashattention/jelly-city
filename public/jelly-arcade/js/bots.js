// 젤리봇 머리: 위험한 칸 피하기 · 상자 부수기 · 아이템 줍기 · 상대 노리기 · 갇힌 친구 구하기
//   화면(혼자 하기)과 서버(같이 하기)가 같이 쓴다. 쉬움은 늦게 생각하고 덜 욕심내고 가끔 딴짓을 한다
import { W, H, FUSE, FLAME_T, DIRS, EMPTY, BOX, idx, inb, bombAt, cellOf, speedOf, blastCells, free, placeBomb } from './sim.js';

const DIFF = {
  easy: { think: 0.42, attack: 0.35, box: 0.75, item: 2, hunt: false, wander: 0.18, margin: 0.2, escape: 1.6 },
  normal: { think: 0.12, attack: 1, box: 1, item: 4, hunt: true, wander: 0.03, margin: 0.35, escape: 0.6 },
};
export function newBrain(seed = 1) { let a = (seed * 2654435761) >>> 0 || 7; return { t: 0, goal: null, path: null, rnd: () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }, trapT: 0, bombCd: 0 }; }

// 칸마다 물결이 닿기까지 남은 시간 (Infinity = 안전). 연쇄를 생각한다. extra = 놓아 볼 폭탄
export function dangerMap(S, extra) {
  const bombs = extra ? [...S.bombs, extra] : S.bombs;
  const eff = new Map(bombs.map((b) => [b, b.t]));
  const view = extra ? { ...S, bombs } : S;
  const blasts = new Map(bombs.map((b) => [b, blastCells(view, b)]));
  // 연쇄: 먼저 터지는 폭탄에 닿은 폭탄은 같이 터진다
  for (let k = 0; k < bombs.length; k++) {
    let changed = false;
    for (const a of bombs) for (const ob of blasts.get(a).hitBombs) { const ta = eff.get(a); if (ta < eff.get(ob)) { eff.set(ob, ta); changed = true; } }
    if (!changed) break;
  }
  const d = new Float32Array(W * H).fill(Infinity);
  for (const b of bombs) { const t = eff.get(b); for (const [x, y] of blasts.get(b).cells) { const i = idx(x, y); if (t < d[i]) d[i] = t; } }
  // 지금 있는 물결은 따로 (곧 터질 폭탄이 가려지지 않게)
  d.flame = new Float32Array(W * H);
  for (const f of S.flames) { const i = idx(f.x, f.y); d.flame[i] = Math.max(d.flame[i], f.t); }
  return d;
}
// 지나가도 되는 칸인가: 물결이 지금 있거나, 도착할 즈음 터지면 안 된다
//   steps 칸째: 반 칸 앞에서 들어가고 반 칸 지나 나온다
const okAt = (d, i, steps, sp, margin) => {
  const t = d[i], enter = Math.max(0, steps - 0.6) / sp, leave = (steps + 0.6) / sp;
  if (d.flame[i] > 0 && enter < d.flame[i] + 0.08) return false; // 지금 물결: 사라진 뒤에 들어가면 된다
  if (t === Infinity) return true;
  return leave + margin < t || enter > t + FLAME_T + 0.08;
};
// 걸어서 갈 수 있는 칸들 (가까운 순). 각 칸까지 걸리는 시간 · 첫 걸음
function reach(S, p, d, margin, extraBlock) {
  const [sx, sy] = cellOf(p), sp = speedOf(p), start = idx(sx, sy);
  const dist = new Int16Array(W * H).fill(-1), first = new Int16Array(W * H).fill(-1), order = [];
  dist[start] = 0; order.push(start);
  for (let h = 0; h < order.length; h++) {
    const i = order[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
      const j = idx(nx, ny); if (dist[j] >= 0) continue;
      if (S.grid[j] !== EMPTY || bombAt(S, nx, ny) || (extraBlock && extraBlock === j)) continue;
      if (d && !okAt(d, j, dist[i] + 1, sp, margin)) continue;
      dist[j] = dist[i] + 1; first[j] = i === start ? j : first[i]; order.push(j);
    }
  }
  return { dist, first, order, start };
}
// 여기에 폭탄을 놓으면 피할 곳이 있나
export function canEscape(S, p, cfg = DIFF.normal) {
  const [x, y] = cellOf(p);
  if (bombAt(S, x, y)) return false;
  const fake = { id: -1, x, y, owner: p.id, range: p.range, t: FUSE };
  const d = dangerMap(S, fake);
  const R = reach(S, p, d, cfg.margin);
  for (const i of R.order) if (d[i] === Infinity && R.dist[i] / speedOf(p) < FUSE - cfg.escape * 0.3) return true;
  return false;
}
// 여기에 폭탄을 놓으면 무엇이 맞나
function bombValue(S, p, x, y) {
  const b = { id: -1, x, y, owner: p.id, range: p.range, t: FUSE };
  const { cells, boxes } = blastCells(S, b);
  let enemies = 0;
  for (const q of S.players) {
    if (q.out || q === p || q.team === p.team) continue;
    const [qx, qy] = cellOf(q);
    if (cells.some(([cx, cy]) => cx === qx && cy === qy)) enemies++;
  }
  return { boxes: boxes.length, enemies };
}

// 한 번 생각: 입력 { x, y, bomb } 를 돌려준다
export function think(S, p, brain, dt) {
  const cfg = DIFF[p.diff] || DIFF.normal;
  brain.t -= dt; brain.bombCd -= dt;
  const inp = brain.inp || (brain.inp = { x: 0, y: 0, bomb: false });
  inp.bomb = false;
  if (p.out) { inp.x = inp.y = 0; return inp; }
  // 갇힘: 탈출 젤리가 있으면 조금 뒤에 쓴다
  if (p.trap > 0) {
    brain.trapT += dt; inp.x = inp.y = 0;
    if (p.escape > 0 && brain.trapT > cfg.escape) { inp.bomb = true; brain.trapT = 0; }
    return inp;
  }
  brain.trapT = 0;
  // 목표 칸으로 걸어가는 중이면 계속 (가운데에 닿으면 다시 생각)
  if (brain.goal != null && brain.t > 0) { steer(p, brain.goal, inp); if (!arrived(p, brain.goal)) return inp; }
  if (brain.t > 0 && brain.goal == null) return inp;
  brain.t = cfg.think * (0.7 + brain.rnd() * 0.6);
  const d = dangerMap(S);
  const [cx, cy] = cellOf(p), here = idx(cx, cy);
  // 1) 위험하면 가장 가까운 안전한 칸으로
  if (d[here] !== Infinity) {
    const R = reach(S, p, d, cfg.margin * 0.5);
    let best = -1; for (const i of R.order) if (d[i] === Infinity) { best = i; break; }
    if (best < 0) {
      // 안전한 칸이 없으면: 가장 늦게 터지는 칸으로 (조금이라도 버틴다)
      const R2 = reach(S, p, null, 0); let bt = -Infinity;
      for (const i of R2.order) { const v = d[i] === Infinity ? 99 - R2.dist[i] : d[i] - R2.dist[i] / speedOf(p); if (v > bt) { bt = v; best = i; } }
      if (best >= 0 && best !== here) best = R2.first[best];
    }
    else best = best === here ? here : R.first[best];
    go(p, brain, best, inp);
    return inp;
  }
  // 2) 폭탄을 놓을까
  if (p.placed < p.bombs && brain.bombCd <= 0) {
    const v = bombValue(S, p, cx, cy);
    const want = (v.enemies > 0 && brain.rnd() < cfg.attack) || (v.boxes > 0 && brain.rnd() < cfg.box);
    if (want && canEscape(S, p, cfg)) { inp.bomb = true; brain.bombCd = 0.35; brain.goal = null; brain.t = 0; return inp; }
  }
  // 3) 갈 곳 고르기: 아이템 · 갇힌 상대(터뜨리기) · 갇힌 친구(구하기) · 상자 옆 · 상대 근처
  const R = reach(S, p, d, cfg.margin);
  if (brain.rnd() < cfg.wander) { const opts = R.order.filter((i) => R.dist[i] > 0 && R.dist[i] <= 3 && d[i] === Infinity); if (opts.length) { go(p, brain, R.first[opts[Math.floor(brain.rnd() * opts.length)]], inp); return inp; } }
  const trapped = new Map(), foes = [];
  for (const q of S.players) {
    if (q === p || q.out) continue;
    const [qx, qy] = cellOf(q), qi = idx(qx, qy);
    if (q.trap > 0) trapped.set(qi, q.team === p.team ? 'ally' : 'foe');
    else if (q.team !== p.team) foes.push([qx, qy]);
  }
  let best = -1, bestScore = Infinity;
  for (const i of R.order) {
    if (d[i] !== Infinity) continue;
    // 제자리: 할 일이 없으면 가만히 (왔다 갔다 떨지 않게)
    if (i === here) { const sc = p.placed >= p.bombs ? 3.2 : 5.5; if (sc < bestScore) { bestScore = sc; best = i; } continue; }
    const x = i % W, y = (i / W) | 0, steps = R.dist[i];
    let score = steps + 0.5;
    const it = S.items.get(i);
    const tr = trapped.get(i);
    if (tr) score -= tr === 'ally' ? 9 : 7;
    else if (it) score -= cfg.item;
    else {
      const v = p.placed < p.bombs ? bombValue(S, p, x, y) : { boxes: 0, enemies: 0 };
      if (v.enemies && cfg.hunt) score -= 2.5;
      else if (v.boxes) score -= 0.8 + v.boxes * 0.4;
      else if (cfg.hunt && foes.length) { const fd = Math.min(...foes.map(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y))); score += fd * 0.25 + 2; }
      else score += 6;
    }
    if (score < bestScore) { bestScore = score; best = i; }
  }
  if (best >= 0) go(p, brain, best === here ? here : R.first[best], inp);
  else { brain.goal = null; inp.x = inp.y = 0; }
  return inp;
}
function go(p, brain, i, inp) {
  if (i == null || i < 0) { brain.goal = null; inp.x = inp.y = 0; return; }
  brain.goal = i; steer(p, i, inp);
}
function steer(p, i, inp) {
  const gx = i % W, gy = (i / W) | 0, dx = gx - p.x, dy = gy - p.y;
  // 가로세로 하나만: 많이 남은 쪽
  if (Math.abs(dx) > Math.abs(dy)) { inp.x = Math.abs(dx) > 0.06 ? Math.sign(dx) : 0; inp.y = 0; }
  else { inp.y = Math.abs(dy) > 0.06 ? Math.sign(dy) : 0; inp.x = 0; }
}
const arrived = (p, i) => Math.abs(i % W - p.x) < 0.08 && Math.abs(((i / W) | 0) - p.y) < 0.08;
export { DIFF };
