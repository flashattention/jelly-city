// 젤리 숨바꼭질 맵: 무늬 있는 상자들로 만든다. 화면 · 서버(봇 · 위장도) 가 같이 쓴다 (DOM · three 없음)
//   상자 = { x, z: 가운데, w(x 폭), d(z 폭), y: 바닥 높이, h: 높이, s: 겉면 무늬 }
//   무늬 s = { c: 바탕색, p: 무늬 종류, c2: 무늬색, k: 무늬색이 차지하는 비율(0~1), sc: 무늬 한 칸 크기(m) }

export const S = (c, p = 'solid', c2 = null, sc = 1) => ({ c, p, c2: c2 || c, k: p === 'solid' ? 0 : KCOV[p] ?? 0.4, sc });
// 무늬마다 무늬색이 차지하는 대략의 비율 (위장도 계산용 · 화면 그림과 맞춘다)
export const KCOV = { stripe: 0.5, hstripe: 0.5, check: 0.5, dot: 0.22, wave: 0.38, flower: 0.3, wood: 0.25, waffle: 0.36, doodle: 0.18, brick: 0.2, star: 0.16, grass: 0.35, leaf: 0.4 };
export const PATTERNS = Object.keys(KCOV);
const B = (x, z, w, d, h, s, y = 0, o = {}) => ({ x, z, w, d, h, y, s, ...o });

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 둘레 벽: 쪽마다 다른 벽지
function room(W, D, H, walls) {
  return [B(0, -D / 2 - 0.5, W + 2, 1, H, walls[0], 0, { wall: 1 }), B(W / 2 + 0.5, 0, 1, D, H, walls[1], 0, { wall: 1 }), B(0, D / 2 + 0.5, W + 2, 1, H, walls[2], 0, { wall: 1 }), B(-W / 2 - 0.5, 0, 1, D, H, walls[3], 0, { wall: 1 })];
}

// ---------- 🧸 장난감 방 ----------
function toy() {
  const W = 30, D = 30, R = rng(11);
  const boxes = room(W, D, 6, [S('#ffd1dc', 'stripe', '#fff4ea', 0.9), S('#cfeee6', 'check', '#ffffff', 1.2), S('#fff1a8', 'dot', '#ff9eb5', 0.8), S('#d9d0ff', 'star', '#ffffff', 1)]);
  const rugs = [
    B(-6, 4, 9, 7, 0.05, S('#ff6b6b', 'check', '#ffffff', 1)), B(7, -6, 7, 7, 0.05, S('#5ec8ff', 'doodle', '#ffffff', 1.4)), B(6, 9, 6, 4, 0.05, S('#9be15d', 'wave', '#f6ffde', 1)),
  ];
  boxes.push(...rugs.map((b) => ({ ...b, rug: 1 })));
  const blockC = [['#ff5c7a', null], ['#ffd23f', null], ['#4a9dff', null], ['#62cf7a', null], ['#ff9334', null], ['#9a6bff', null]];
  // 큰 장난감 블록 탑
  for (const [x, z, n] of [[-11, -11, 3], [-8.5, -11.5, 2], [11, 11, 3], [-12, 8, 2], [3, -12, 1], [12.5, -1, 2], [-3, 12.5, 1]]) {
    for (let i = 0; i < n; i++) { const [c] = blockC[Math.floor(R() * blockC.length)]; const pat = R() < 0.5 ? S(c) : S(c, R() < 0.5 ? 'dot' : 'stripe', '#ffffff', 0.45); boxes.push(B(x + (R() - 0.5) * 0.3, z + (R() - 0.5) * 0.3, 1.4, 1.4, 1.4, pat, i * 1.4)); }
  }
  // 크레용 (누워 있는 긴 막대)
  for (const [x, z, c, rot] of [[-2, -7, '#ff5c7a', 0], [-1.2, -6.2, '#4a9dff', 0], [9, 3, '#62cf7a', 1], [9.8, 4, '#ffd23f', 1], [-9, -2, '#9a6bff', 0]]) boxes.push(rot ? B(x, z, 0.5, 3.6, 0.5, S(c, 'hstripe', '#ffffff', 0.6)) : B(x, z, 3.6, 0.5, 0.5, S(c, 'stripe', '#ffffff', 0.6)));
  // 침대 · 장난감 상자 · 책장 · 소파
  boxes.push(B(-11, -1, 4, 6, 0.9, S('#bfe3ff', 'stripe', '#ffffff', 0.7)), B(-12.7, -1, 0.6, 6, 2.2, S('#c98a4b', 'wood', '#a86a32', 0.8)));
  boxes.push(B(4, 12, 3, 1.8, 1.4, S('#c98a4b', 'wood', '#a86a32', 0.8)));
  boxes.push(B(13.6, 6, 1.6, 6, 4, S('#e3b07a', 'wood', '#b8834d', 0.8)));
  for (let i = 0; i < 6; i++) boxes.push(B(12.5, 3.6 + i * 0.9, 0.5, 0.7, 0.9, S(['#ff5c7a', '#4a9dff', '#ffd23f', '#62cf7a', '#9a6bff', '#ff9334'][i]), 1.3));
  boxes.push(B(0, -13.4, 6, 2, 1.1, S('#ff9eb5', 'waffle', '#ffd1dc', 0.6)), B(0, -14.3, 6, 0.6, 2.4, S('#ff9eb5', 'waffle', '#ffd1dc', 0.6)));
  // 공 · 기차 (상자 몇 개)
  boxes.push(B(2, 3, 1.1, 1.1, 1.1, S('#ffffff', 'star', '#ffd23f', 0.5)), B(4.6, 3, 2, 1.1, 1, S('#ff5c7a', 'brick', '#ffffff', 0.5)), B(6.8, 3, 2, 1.1, 1, S('#4a9dff', 'brick', '#ffffff', 0.5)));
  return { id: 'toy', name: '장난감 방', emoji: '🧸', desc: '거대한 블록 · 크레용 · 줄무늬 벽지', W, D, H: 6, floor: S('#e8c08e', 'wood', '#cf9f68', 1.2), sky: ['#ffe8f1', '#ffd1e3'], indoor: true, boxes };
}

// ---------- 🍭 사탕 가게 ----------
function candy() {
  const W = 32, D = 28, R = rng(23);
  const boxes = room(W, D, 6, [S('#ffb6d1', 'dot', '#ffffff', 0.7), S('#bdf0e4', 'stripe', '#ffffff', 0.6), S('#ffe08a', 'waffle', '#f3c75a', 0.7), S('#d7c2ff', 'dot', '#ff8ec2', 0.9)]);
  boxes.push({ ...B(0, 0, 10, 6, 0.05, S('#ff8ec2', 'check', '#ffffff', 1.4)), rug: 1 });
  // 진열대 줄: 나무 선반 + 사탕 병 (색 · 무늬가 다 다르다)
  const jarC = ['#ff5c7a', '#ffd23f', '#62cf7a', '#4a9dff', '#9a6bff', '#ff9334', '#ffffff', '#3fd0c0'];
  for (const z of [-9, -4]) for (const x0 of [-11, 3]) {
    boxes.push(B(x0 + 3.5, z, 8, 1.6, 0.9, S('#d9a066', 'wood', '#b37a42', 0.8)), B(x0 + 3.5, z, 8, 1.6, 0.15, S('#d9a066', 'wood', '#b37a42', 0.8), 2.2));
    for (let i = 0; i < 6; i++) { const c = jarC[Math.floor(R() * jarC.length)], c2 = jarC[Math.floor(R() * jarC.length)]; const p = ['dot', 'stripe', 'check', 'solid', 'wave'][Math.floor(R() * 5)]; boxes.push(B(x0 + 0.6 + i * 1.18, z, 0.9, 0.9, 1.1, S(c, p, c2, 0.4), 0.9)); }
  }
  // 계산대 · 막대사탕 기둥 · 껌볼 기계 · 상자 더미
  boxes.push(B(-9, 9, 8, 2, 1.3, S('#ff5c7a', 'stripe', '#ffffff', 0.5)), B(-9, 9, 8.4, 2.4, 0.15, S('#fff4ea'), 1.3));
  for (const [x, z, c] of [[-14, -12, '#ff5c7a'], [14, -12, '#4a9dff'], [14, 11, '#62cf7a'], [-14, 11.5, '#ffd23f'], [6, 7, '#9a6bff']]) boxes.push(B(x, z, 1, 1, 4.5, S(c, 'stripe', '#ffffff', 0.5)), B(x, z, 2.2, 2.2, 1.6, S(c, 'wave', '#ffffff', 0.7), 4.5));
  for (const [x, z] of [[10, 4], [12, 4]]) boxes.push(B(x, z, 1.2, 1.2, 1, S('#ff3b5c')), B(x, z, 1.4, 1.4, 1.4, S('#e8f6ff', 'dot', '#ff5c7a', 0.35), 1));
  for (const [x, z, n] of [[3, 11, 3], [9.5, 10.5, 2], [-3, 4, 2]]) for (let i = 0; i < n; i++) boxes.push(B(x + (i % 2) * 1.3, z, 1.2, 1.2, 1.2, S(jarC[(i + n) % jarC.length], 'star', '#ffffff', 0.6), Math.floor(i / 2) * 1.2));
  return { id: 'candy', name: '사탕 가게', emoji: '🍭', desc: '알록달록 사탕 병 · 땡땡이 벽 · 줄무늬 계산대', W, D, H: 6, floor: S('#ffffff', 'check', '#ffc2da', 1.2), sky: ['#fff0f6', '#ffd9ea'], indoor: true, boxes };
}

// ---------- 🌷 꽃 정원 ----------
function garden() {
  const W = 34, D = 34, R = rng(37);
  const hedge = S('#3f9b4b', 'leaf', '#6fcf6a', 0.9);
  const boxes = room(W, D, 2.4, [hedge, hedge, hedge, hedge]);
  // 꽃밭 · 돌길 · 돗자리 · 모래밭
  const beds = [[-10, -10, '#ff8fb8'], [10, -10, '#ffd23f'], [-10, 10, '#b98cff'], [10, 10, '#ff7b54']];
  for (const [x, z, c] of beds) { boxes.push(B(x, z, 6, 4, 0.5, S('#5fae4e', 'flower', c, 0.8))); boxes.push(B(x, z - 2.3, 6.4, 0.4, 0.8, S('#ffffff', 'stripe', '#d8d8d8', 0.4))); }
  boxes.push({ ...B(0, 0, 3, 30, 0.04, S('#c9c2b8', 'brick', '#9e968a', 0.8)), rug: 1 }, { ...B(0, 0, 30, 3, 0.04, S('#c9c2b8', 'brick', '#9e968a', 0.8)), rug: 1 });
  boxes.push({ ...B(6, -4.5, 5, 4, 0.05, S('#ff5c7a', 'check', '#ffffff', 0.9)), rug: 1 }, { ...B(-6, 5, 5, 5, 0.05, S('#ffe9a8', 'dot', '#f2c95e', 0.5)), rug: 1 });
  // 나무 (줄기 + 잎 덩어리) · 울타리 · 새집 · 물뿌리개 · 화분
  for (const [x, z] of [[-14, 0], [14, 1], [0, -14], [1, 14], [-5, -14], [13, -7]]) { boxes.push(B(x, z, 0.9, 0.9, 2.6, S('#8a5a3a', 'wood', '#6b4127', 0.6))); boxes.push(B(x, z, 3.2, 3.2, 2.2, S('#4fae55', 'leaf', '#86d36f', 0.9), 2.6)); }
  for (let i = 0; i < 5; i++) boxes.push(B(-4 + i * 2, 9, 1.8, 0.25, 1.1, S('#ffffff', 'wood', '#e6e0d6', 0.6)));
  for (let i = 0; i < 4; i++) boxes.push(B(8.5, -1 - i * 2, 0.25, 1.8, 1.1, S('#ffffff', 'wood', '#e6e0d6', 0.6)));
  boxes.push(B(-3, -6, 1.4, 1.4, 1.2, S('#4a9dff', 'wave', '#bfe6ff', 0.6)), B(4, 6, 1.6, 1, 0.9, S('#ffd23f', 'dot', '#ff9334', 0.5)));
  for (let i = 0; i < 6; i++) { const x = (R() - 0.5) * 26, z = (R() - 0.5) * 26; if (Math.abs(x) < 2.5 || Math.abs(z) < 2.5) continue; boxes.push(B(x, z, 0.9, 0.9, 0.8, S(['#e0763c', '#ff8fb8', '#ffffff'][i % 3], 'brick', '#c25a28', 0.4))); }
  return { id: 'garden', name: '꽃 정원', emoji: '🌷', desc: '꽃밭 · 산울타리 · 돗자리 · 나무 그늘', W, D, H: 2.4, floor: S('#7cc96a', 'grass', '#5fae4e', 1.1), sky: ['#9fdcff', '#e8f8ff'], indoor: false, boxes };
}


// ---------- 맵 넓히기: 배치는 그대로 펼치고(1.75배) 빈자리는 그 맵의 색 · 무늬로 소품을 더 채운다 ----------
//   서버 · 화면이 같은 씨앗으로 만들어서 모두 같은 맵 (봇 길찾기도 새 맵으로)
function widen(m, k) {
  const R = rng(m.id.length * 7919 + 3), walls = m.boxes.filter((b) => b.wall), rest = m.boxes.filter((b) => !b.wall);
  const W = Math.round(m.W * k), D = Math.round(m.D * k), H = m.indoor ? m.H + 1 : m.H;
  const out = room(W, D, H, [walls[0].s, walls[1].s, walls[2].s, walls[3].s]);
  for (const b of rest) { const g = b.rug ? k : 1.15; out.push({ ...b, x: b.x * k, z: b.z * k, w: b.w * g, d: b.d * g }); }
  // 소품 재료: 이 맵의 소품 무늬들
  const specs = rest.filter((b) => !b.rug && b.h > 0.4).map((b) => b.s);
  const pick = () => specs[Math.floor(R() * specs.length)];
  const clear = (x, z, r) => Math.abs(x) < W / 2 - r - 0.6 && Math.abs(z) < D / 2 - r - 0.6 && !out.some((b) => !b.rug && !b.wall && Math.abs(b.x - x) < b.w / 2 + r + 0.9 && Math.abs(b.z - z) < b.d / 2 + r + 0.9);
  const want = Math.round(W * D * 0.011);
  for (let t = 0, n = 0; t < 600 && n < want; t++) {
    const x = (R() - 0.5) * (W - 4), z = (R() - 0.5) * (D - 4), kind = R();
    if (kind < 0.4) { // 블록 더미 (1~3층)
      const sz = 1.1 + R() * 0.8; if (!clear(x, z, sz)) continue;
      const lv = 1 + Math.floor(R() * 3); for (let i = 0; i < lv; i++) out.push(B(x + (R() - 0.5) * 0.3, z + (R() - 0.5) * 0.3, sz * (1 - i * 0.12), sz * (1 - i * 0.12), sz * 0.9, pick(), i * sz * 0.9));
    } else if (kind < 0.65) { // 탁자 · 낮은 상자 (밑에 숨을 수 있게 다리 넷)
      const w = 2.2 + R() * 1.6, d = 1.4 + R() * 1, h = 0.9 + R() * 0.3; if (!clear(x, z, Math.max(w, d) / 2)) continue;
      const top = pick(); out.push(B(x, z, w, d, 0.18, top, h));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.push(B(x + sx * (w / 2 - 0.15), z + sz * (d / 2 - 0.15), 0.22, 0.22, h, top));
    } else if (kind < 0.85) { // 길쭉한 상자 (벽처럼 숨기 좋은 면)
      const long = R() < 0.5, w = long ? 3 + R() * 2 : 0.9, d = long ? 0.9 : 3 + R() * 2; if (!clear(x, z, Math.max(w, d) / 2)) continue;
      out.push(B(x, z, w, d, 1.2 + R() * 0.8, pick()));
    } else { // 바닥 깔개
      const w = 3 + R() * 3, d = 3 + R() * 3; if (out.some((b) => b.rug && Math.abs(b.x - x) < (b.w + w) / 2 && Math.abs(b.z - z) < (b.d + d) / 2) || !clear(x, z, 0.5)) continue;
      out.push({ ...B(x, z, w, d, 0.05, pick()), rug: 1 });
    }
    n++;
  }
  return { ...m, W, D, H, boxes: out };
}

const MAKERS = { toy, candy, garden };
export const MAPS = [{ id: 'toy', name: '장난감 방', emoji: '🧸' }, { id: 'candy', name: '사탕 가게', emoji: '🍭' }, { id: 'garden', name: '꽃 정원', emoji: '🌷' }];
const cache = new Map();
export function getMap(id) {
  if (!MAKERS[id]) id = 'toy';
  if (!cache.has(id)) { const m = widen(MAKERS[id](), 1.75); m.spawns = spawns(m); m.spots = spots(m); m.nav = makeNav(m); cache.set(id, m); }
  return cache.get(id);
}

// ---------- 색 ----------
export function hex2rgb(h) { const n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
export function rgb2hex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
const cdist = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.15, a[2] - b[2]);
// 무늬의 색 구성: [[r,g,b, 비율], ...]
export function specColors(s) { const a = hex2rgb(s.c), b = hex2rgb(s.c2 || s.c); return s.k > 0 && s.c2 !== s.c ? [[...a, 1 - s.k], [...b, s.k]] : [[...a, 1]]; }

// ---------- 위치 · 겉면 ----------
const inBox = (b, x, z, m = 0) => x > b.x - b.w / 2 - m && x < b.x + b.w / 2 + m && z > b.z - b.d / 2 - m && z < b.z + b.d / 2 + m;
const solid = (b) => !b.rug && b.h > 0.2;
// 곰돌이 둘레의 겉면: 바닥(또는 깔개) + 1m 안에 붙어 있는 상자 (가까울수록 · 엎드렸으면 바닥 비중이 크다)
export function surfacesAt(map, x, z, pose = 0) {
  let fl = map.floor;
  for (const b of map.boxes) if (b.rug && inBox(b, x, z)) fl = b.s;
  let best = null, bd = 1.05;
  for (const b of map.boxes) {
    if (!solid(b) || b.y > 1.0) continue;
    const dx = Math.max(Math.abs(x - b.x) - b.w / 2, 0), dz = Math.max(Math.abs(z - b.z) - b.d / 2, 0), d = Math.hypot(dx, dz);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return [[fl, 1]];
  const near = 1 - bd / 1.05, wf = pose === 2 ? 0.8 : pose === 3 ? 0.45 : 0.3; // 엎드림 · 동글이는 바닥을 더 본다
  return [[best.s, (1 - wf) * (0.55 + 0.45 * near)], [fl, wf + (1 - wf) * 0.45 * (1 - near)]];
}
// 위장도 (0~100): 몸 색 구성 dom=[[r,g,b,w]...] 과 둘레 겉면 색 구성의 거리
export function camoScore(dom, map, x, z, pose = 0) {
  if (!dom || !dom.length) return 0;
  const surf = [];
  for (const [s, w] of surfacesAt(map, x, z, pose)) for (const [r, g, b, k] of specColors(s)) surf.push([r, g, b, w * k]);
  const sw = surf.reduce((a, c) => a + c[3], 0) || 1, bw = dom.reduce((a, c) => a + c[3], 0) || 1;
  // 몸의 색이 겉면 어느 색과 가까운가 + 겉면의 큰 색들이 몸에도 있는가
  let a = 0; for (const c of dom) a += (c[3] / bw) * Math.min(...surf.map((s) => cdist(c, s)));
  let b = 0; for (const s of surf) b += (s[3] / sw) * Math.min(...dom.map((c) => cdist(c, s)));
  const d = a * 0.62 + b * 0.38;
  return Math.max(0, Math.min(100, Math.round(100 - d * 0.78)));
}

// ---------- 출발 자리 · 숨을 자리 (봇) ----------
function free(map, x, z, m = 0.45) { if (Math.abs(x) > map.W / 2 - m || Math.abs(z) > map.D / 2 - m) return false; for (const b of map.boxes) if (solid(b) && b.y < 1.2 && inBox(b, x, z, m)) return false; return true; }
function spawns(map) {
  const out = []; for (let r = 1.5; out.length < 16 && r < 8; r += 1.2) for (let a = 0; a < Math.PI * 2 && out.length < 16; a += 0.9 / r) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (free(map, x, z, 0.6)) out.push([+x.toFixed(2), +z.toFixed(2), Math.atan2(x, z)]); }
  return out;
}
// 상자 옆면 앞 0.5m (등을 벽에 대고) · 깔개 위 (엎드리기)
function spots(map) {
  const out = [];
  for (const b of map.boxes) {
    if (b.rug) { for (let i = 0; i < 3; i++) { const x = b.x + (i - 1) * b.w * 0.25, z = b.z; if (free(map, x, z)) out.push({ x, z, yaw: 0, s: b.s, pose: 2 }); } continue; }
    if (b.y > 0.2 || b.h < 0.7) continue;
    const faces = [[0, -1, b.w], [0, 1, b.w], [-1, 0, b.d], [1, 0, b.d]];
    for (const [nx, nz, len] of faces) {
      const n = Math.max(1, Math.floor(len / 1.6));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        const x = nx ? b.x + nx * (b.w / 2 + 0.5) : b.x + t * len, z = nz ? b.z + nz * (b.d / 2 + 0.5) : b.z + t * len;
        if (!free(map, x, z, 0.4)) continue;
        out.push({ x: +x.toFixed(2), z: +z.toFixed(2), yaw: Math.atan2(nx, nz), s: b.s, pose: b.h < 1.3 ? 1 : 0 });
      }
    }
  }
  return out;
}

// ---------- 길찾기 (봇) ----------
const CELL = 0.5;
function makeNav(map) {
  const nx = Math.floor(map.W / CELL), nz = Math.floor(map.D / CELL), ok = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) ok[i * nz + j] = free(map, -map.W / 2 + (i + 0.5) * CELL, -map.D / 2 + (j + 0.5) * CELL, 0.4) ? 1 : 0;
  return { nx, nz, ok };
}
const cellOf = (map, x, z) => [Math.max(0, Math.min(map.nav.nx - 1, Math.floor((x + map.W / 2) / CELL))), Math.max(0, Math.min(map.nav.nz - 1, Math.floor((z + map.D / 2) / CELL)))];
const posOf = (map, i, j) => [-map.W / 2 + (i + 0.5) * CELL, -map.D / 2 + (j + 0.5) * CELL];
export function findPath(map, from, to) {
  const { nx, nz, ok } = map.nav; const [si, sj] = cellOf(map, from[0], from[1]); let [ti, tj] = cellOf(map, to[0], to[1]);
  if (!ok[ti * nz + tj]) { let best = null, bd = 1e9; for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) { const i = ti + di, j = tj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz || !ok[i * nz + j]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i, j]; } } if (!best) return null; [ti, tj] = best; }
  const N = nx * nz, g = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), open = [si * nz + sj], done = new Uint8Array(N);
  g[si * nz + sj] = 0; const goal = ti * nz + tj; const h = (k) => Math.hypot(Math.floor(k / nz) - ti, (k % nz) - tj);
  let guard = 0;
  while (open.length && guard++ < 20000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (g[open[k]] + h(open[k]) < g[open[bi]] + h(open[bi])) bi = k;
    const cur = open.splice(bi, 1)[0]; if (cur === goal) break; if (done[cur]) continue; done[cur] = 1;
    const ci = Math.floor(cur / nz), cj = cur % nz;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; const k = i * nz + j;
      if (!ok[k] || done[k] || (di && dj && (!ok[ci * nz + j] || !ok[i * nz + cj]))) continue;
      const ng = g[cur] + (di && dj ? 1.414 : 1); if (ng < g[k]) { g[k] = ng; prev[k] = cur; open.push(k); }
    }
  }
  if (prev[goal] < 0 && goal !== si * nz + sj) return null;
  const path = []; for (let k = goal; k >= 0 && k !== si * nz + sj; k = prev[k]) path.unshift(posOf(map, Math.floor(k / nz), k % nz));
  return path;
}
export function randomOpen(map, R = Math.random) { for (let t = 0; t < 200; t++) { const x = (R() - 0.5) * (map.W - 2), z = (R() - 0.5) * (map.D - 2); if (free(map, x, z, 0.5)) return [x, z]; } return [0, 0]; }
// 두 점 사이가 트였나 (눈높이에서 상자에 막히는지)
export function lineClear(map, a, b, y = 0.7) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), n = Math.ceil(L / 0.3);
  for (let i = 1; i < n; i++) { const x = a[0] + (dx * i) / n, z = a[1] + (dz * i) / n; for (const bx of map.boxes) if (solid(bx) && bx.y < y && bx.y + bx.h > y && inBox(bx, x, z)) return false; }
  return true;
}
