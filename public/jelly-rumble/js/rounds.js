// 젤리 가이즈 판(라운드) 만들기: 씨앗(seed) 하나로 코스 · 장애물을 똑같이 만든다 (서버 봇 · 모든 화면이 같은 코스)
//   좌표: x = 좌우, y = 위, z = 앞 (출발 z≈0 → 결승 z+). 장애물은 모두 '시간 t 의 함수' 라서 따로 주고받지 않아도 모두 같은 자리
//   상자 b = { x, y(바닥), z, w, h, d, c(색), mv?(움직임), conv?(컨베이어), ice?, pad?(점프대 힘), tile?, door? }

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hash = (i, s) => rng((s * 7919 + i * 104729) >>> 0)();
const TAU = Math.PI * 2;

// ---------- 테마 (하늘 · 바닥 · 장애물 색 · 아래 젤리 물) ----------
const THEMES = {
  hill: { sky: ['#5ec8ff', '#d9f4ff'], floor: ['#ff8fc4', '#ffb8dc'], side: '#d65a99', acc: ['#ffd84d', '#5ec8ff', '#7be07b', '#b388ff'], goo: '#ff6fae', fog: [60, 220] },
  factory: { sky: ['#ffb36b', '#ffe8c9'], floor: ['#c98a4b', '#e3ad6f'], side: '#8a5a2e', acc: ['#ff5252', '#ffd54f', '#4fc3f7', '#ab47bc'], goo: '#6d3b1f', fog: [60, 200] },
  cloud: { sky: ['#8ab8ff', '#fff0f8'], floor: ['#ffffff', '#e6efff'], side: '#b8c8ec', acc: ['#ff7eb6', '#7ec8ff', '#ffd166', '#9b8cff'], goo: '#a6c8ff', fog: [70, 240] },
  door: { sky: ['#7a5cff', '#ffd1f0'], floor: ['#6fd3c1', '#9be7d9'], side: '#2f9c8a', acc: ['#ff6b8b', '#ffd84d', '#ffffff', '#5ec8ff'], goo: '#ff5fa2', fog: [60, 220] },
  hammer: { sky: ['#2e9bd6', '#c5f1ff'], floor: ['#8bd36b', '#a9e58e'], side: '#4f8f3a', acc: ['#ff7043', '#ffca28', '#8d6e63', '#ec407a'], goo: '#3fb6ff', fog: [60, 220] },
  snow: { sky: ['#9ec5ef', '#f3f8ff'], floor: ['#e8f4ff', '#cfe6fb'], side: '#8fb4d8', acc: ['#ff5c7a', '#4aa3ff', '#ffd54f', '#7c4dff'], goo: '#5aa9e6', fog: [60, 220] },
  night: { sky: ['#12124a', '#5a3b9e'], floor: ['#3d3ca8', '#5755d0'], side: '#1f1e6b', acc: ['#ffd84d', '#ff5fa2', '#4dffd2', '#ffffff'], goo: '#c04dff', fog: [50, 200] },
  lava: { sky: ['#ff7a3c', '#ffd27a'], floor: ['#5d4037', '#795548'], side: '#3e2723', acc: ['#ffeb3b', '#ff5252', '#ffffff', '#ff9800'], goo: '#ff4a1c', fog: [50, 200] },
  candy: { sky: ['#ff9ed1', '#fff1f8'], floor: ['#ffe066', '#fff0a8'], side: '#e0a800', acc: ['#ff5fa2', '#5ec8ff', '#7be07b', '#b388ff'], goo: '#7be0ff', fog: [60, 220] },
};

// ---------- 판 목록 ----------
//   kind: race(결승선 통과 · 정원까지) · survive(버티기 · 떨어지면 탈락) · final(마지막 한 명 · 왕관)
export const ROUNDS = {
  hill: { kind: 'race', emoji: '🍭', name: '젤리 언덕 달리기', desc: '빙글빙글 막대를 뛰어넘고 징검다리를 건너 결승선까지!', theme: 'hill', segs: ['spinners', 'gaps', 'pads', 'stairs', 'spinners'] },
  factory: { kind: 'race', emoji: '🏭', name: '쿠키 공장 대소동', desc: '거꾸로 도는 컨베이어 · 밀어내는 벽 · 쿵쿵 망치를 뚫어라!', theme: 'factory', segs: ['conveyor', 'pushers', 'hammers', 'conveyor'] },
  cloud: { kind: 'race', emoji: '☁️', name: '구름 위 빙글 원판', desc: '도는 원판 위를 건너고 굴러오는 공을 피해요', theme: 'cloud', segs: ['disks', 'balls', 'gaps', 'disks'] },
  doors: { kind: 'race', emoji: '🚪', name: '젤리문 와장창', desc: '진짜 문은 부딪히면 펑! 가짜 문은 꽉 막혀 있어요', theme: 'door', segs: ['doors', 'spinners', 'doors', 'pushers'] },
  hammer: { kind: 'race', emoji: '🔨', name: '망치 계곡', desc: '좁은 다리 위로 커다란 젤리 망치가 휙휙!', theme: 'hammer', segs: ['hammers', 'gaps', 'balls', 'hammers'] },
  snowslide: { kind: 'race', emoji: '❄️', name: '미끌미끌 눈꽃길', desc: '얼음 위는 미끄러워요! 공과 막대를 조심', theme: 'snow', segs: ['ice', 'spinners', 'ice', 'balls'] },
  sweep: { kind: 'survive', emoji: '🌀', name: '빙글빙글 회오리', desc: '낮은 막대는 점프! 높은 막대는 다이브(Shift)로 피해요. 점점 빨라져요', theme: 'night' },
  ballstorm: { kind: 'survive', emoji: '🎳', name: '젤리 공 폭풍', desc: '사방에서 굴러오는 공에 밀려 떨어지지 마세요', theme: 'candy' },
  vanish: { kind: 'survive', emoji: '🍬', name: '사라지는 사탕판', desc: '반짝이는 사탕은 곧 떨어져요! 남은 판으로 옮겨 다녀요', theme: 'lava' },
  tiles: { kind: 'final', emoji: '🧇', name: '와르르 와플', desc: '밟은 와플은 곧 떨어져요. 3층 중 마지막까지 남으면 우승!', theme: 'candy' },
  crown: { kind: 'final', emoji: '👑', name: '왕관 탑', desc: '꼭대기의 왕관을 가장 먼저 잡으면 우승!', theme: 'cloud', segs: ['stairs', 'gaps', 'spinners', 'stairs', 'disks'] },
  bigsweep: { kind: 'final', emoji: '🌪️', name: '최후의 회오리', desc: '두 개의 회오리 막대! 마지막까지 버티면 우승', theme: 'lava' },
};
export const POOL = { race: ['hill', 'factory', 'cloud', 'doors', 'hammer', 'snowslide'], survive: ['sweep', 'ballstorm', 'vanish'], final: ['tiles', 'crown', 'bigsweep'] };

// ---------- 움직이는 것들의 '지금' ----------
export function moverAt(m, t, o) {
  const w = TAU / m.per, s = Math.sin(w * t + m.ph), c = Math.cos(w * t + m.ph);
  o.x = m.ax * m.amp * s; o.y = m.ay * m.amp * s; o.z = m.az * m.amp * s;
  o.vx = m.ax * m.amp * w * c; o.vy = m.ay * m.amp * w * c; o.vz = m.az * m.amp * w * c;
  return o;
}
export const spinAngle = (s, t) => s.ph + s.spd * t + 0.5 * (s.acc || 0) * t * t;
export const spinOmega = (s, t) => s.spd + (s.acc || 0) * t;
export function hammerAt(h, t, o) {
  const w = TAU / h.per, a = h.amp * Math.sin(w * t + h.ph), da = h.amp * w * Math.cos(w * t + h.ph);
  o.a = a;
  o.x = h.x + Math.sin(a) * h.len; o.y = h.y - Math.cos(a) * h.len; o.z = h.z;
  o.vx = Math.cos(a) * h.len * da; o.vy = Math.sin(a) * h.len * da; o.vz = 0;
  return o;
}
// 굴러오는 공: 흐름(stream) 하나에서 i 번째 공
export function ballAt(st, i, t, o) {
  const t0 = st.t0 + i * st.every;
  const k = t - t0; if (k < 0 || k > st.life) return null;
  const u = hash(i, st.seed) * 2 - 1; // 옆 자리
  o.x = st.x + st.vx * k + st.lx * u * st.span; o.z = st.z + st.vz * k + st.lz * u * st.span; o.y = st.y + st.R;
  o.vx = st.vx; o.vz = st.vz; o.R = st.R; o.i = i;
  return o;
}
export function ballsNow(st, t) { const a = Math.max(0, Math.floor((t - st.t0 - st.life) / st.every)), b = Math.floor((t - st.t0) / st.every); return [a, b]; }

// ---------- 판 만들기 ----------
export function buildRound(id, seed) {
  const def = ROUNDS[id] || ROUNDS.hill;
  const R = rng(seed ^ 0x9e3779b9);
  const rr = (a, b) => a + (b - a) * R();
  const L = { id, kind: def.kind, name: def.name, emoji: def.emoji, desc: def.desc, theme: THEMES[def.theme], boxes: [], spinners: [], hammers: [], disks: [], bumpers: [], streams: [], tiles: [], path: [], cps: [], spawn: [], deco: [], finish: null, crown: null, deathY: -7, time: 75 };
  const th = L.theme;
  let ci = 0; const accent = () => th.acc[ci++ % th.acc.length];
  const box = (b) => { b.c ||= th.floor[L.boxes.length % 2]; L.boxes.push(b); return b; };
  const floor = (x, z0, z1, w, top, o = {}) => box({ x, y: top - 1.4, z: (z0 + z1) / 2, w, h: 1.4, d: z1 - z0, ...o });
  const ctx = { z: 0, y: 0 };
  const cp = (seg, w = 12) => L.cps.push({ z: ctx.z + 1.5, x: 0, y: ctx.y, w, seg });
  const pth = (x, z, w = 8) => L.path.push({ x, z, y: ctx.y, w });

  // 이어 붙이는 구간들 (길이 · 높이를 ctx 로 넘긴다)
  const SEG = {
    spinners() {
      const len = 30; floor(0, ctx.z, ctx.z + len, 16, ctx.y);
      for (const k of [9, 21]) { const dir = R() < 0.5 ? 1 : -1; L.spinners.push({ x: 0, z: ctx.z + k, y: ctx.y, h: 0.45, len: 7.8, r: 0.32, n: 2, spd: dir * rr(1.5, 2.1), ph: R() * TAU, c: accent() }); }
      pth(0, ctx.z + 4, 10); pth(0, ctx.z + 15, 10); pth(0, ctx.z + 27, 10); ctx.z += len;
    },
    gaps() {
      let z = ctx.z; const n = 5;
      for (let i = 0; i < n; i++) {
        const len = rr(4, 5.5), w = rr(5, 8), x = i === n - 1 ? 0 : rr(-3, 3);
        const mv = i % 2 === 1 ? { ax: 1, ay: 0, az: 0, amp: rr(2, 3.2), per: rr(3.2, 4.5), ph: R() * TAU } : null;
        floor(x, z, z + len, w, ctx.y + (i % 2 ? 0 : 0.0), { c: mv ? accent() : undefined, mv });
        pth(x, z + len / 2, w * 0.6); z += len + rr(1.6, 2.3);
      }
      floor(0, z - 0.2, z + 5, 16, ctx.y); pth(0, z + 3, 10);
      ctx.z = z + 5;
    },
    pads() {
      floor(0, ctx.z, ctx.z + 7, 16, ctx.y); pth(0, ctx.z + 3, 10);
      box({ x: 0, y: ctx.y - 0.05, z: ctx.z + 5.9, w: 15, h: 0.25, d: 1.8, pad: 17, c: '#ffd84d' }); // 점프대 (길 전체)
      // 구덩이 (가운데 작은 디딤돌은 고수용)
      floor(rr(-4, 4), ctx.z + 9.4, ctx.z + 10.8, 2, ctx.y + 0.8, { c: accent() });
      ctx.z += 12.8; ctx.y += 2.5; floor(0, ctx.z, ctx.z + 9, 16, ctx.y); pth(0, ctx.z + 3, 10); pth(0, ctx.z + 7, 10); ctx.z += 9;
    },
    stairs() {
      floor(0, ctx.z, ctx.z + 4, 14, ctx.y);
      ctx.z += 4;
      for (let i = 0; i < 4; i++) {
        ctx.y += 1.0;
        const mv = i === 1 || i === 3 ? { ax: 1, ay: 0, az: 0, amp: 2.5, per: rr(3, 4), ph: R() * TAU } : null;
        floor(mv ? 0 : 0, ctx.z, ctx.z + 3.2, mv ? 8 : 14, ctx.y, { c: i % 2 ? accent() : undefined, mv });
        pth(0, ctx.z + 1.6, 4); ctx.z += 3.2;
      }
      floor(0, ctx.z, ctx.z + 5, 14, ctx.y); pth(0, ctx.z + 3, 8); ctx.z += 5;
    },
    conveyor() {
      const len = 30; floor(0, ctx.z, ctx.z + 3, 16, ctx.y);
      for (let i = 0; i < 3; i++) { const lane = [-5.2, 0, 5.2][i]; floor(lane, ctx.z + 3, ctx.z + len - 3, 5, ctx.y, { conv: [0, -(2.2 + i * 0.8)], c: '#6b7a8f' }); }
      for (let i = 0; i < 5; i++) L.bumpers.push({ x: rr(-6, 6), z: ctx.z + 6 + i * 4.5 + rr(-1, 1), y: ctx.y, R: 0.85, h: 1.4, c: accent() });
      floor(0, ctx.z + len - 3, ctx.z + len, 16, ctx.y);
      pth(0, ctx.z + 2, 10); pth(0, ctx.z + 15, 10); pth(0, ctx.z + len - 1, 10); ctx.z += len;
    },
    pushers() {
      const len = 28; floor(0, ctx.z, ctx.z + len, 14, ctx.y);
      for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1; box({ x: s * 9.5, y: ctx.y, z: ctx.z + 5 + i * 5.8, w: 6, h: 1.6, d: 1.8, c: accent(), mv: { ax: -s, ay: 0, az: 0, amp: 5.2, per: rr(2.2, 3), ph: R() * TAU }, push: true }); }
      // 벽에 붙은 기둥 (밀개 집)
      pth(0, ctx.z + 3, 8); pth(0, ctx.z + 14, 8); pth(0, ctx.z + 25, 8); ctx.z += len;
    },
    hammers() {
      floor(0, ctx.z, ctx.z + 4, 14, ctx.y); pth(0, ctx.z + 2, 8);
      const len = 26, bw = 7; floor(0, ctx.z + 4, ctx.z + 4 + len, bw, ctx.y, { c: accent() });
      for (let i = 0; i < 3; i++) L.hammers.push({ x: 0, y: ctx.y + 7.2, z: ctx.z + 9 + i * 7.5, len: 6.4, R: 1.1, amp: 0.95, per: rr(2.4, 3.1), ph: R() * TAU, c: accent() });
      pth(0, ctx.z + 10, 2); pth(0, ctx.z + 20, 2); pth(0, ctx.z + 4 + len - 1, 2);
      ctx.z += 4 + len; floor(0, ctx.z, ctx.z + 4, 14, ctx.y); pth(0, ctx.z + 2, 8); ctx.z += 4;
    },
    disks() {
      floor(0, ctx.z, ctx.z + 3, 12, ctx.y); ctx.z += 3;
      for (let i = 0; i < 3; i++) { const Rr = rr(4.2, 5), x = rr(-2, 2); L.disks.push({ x, z: ctx.z + 1.3 + Rr, y: ctx.y, R: Rr, h: 1.2, spd: (i % 2 ? 1 : -1) * rr(0.7, 1.1), c: accent() }); pth(x, ctx.z + 1.3 + Rr, 4); ctx.z += 1.3 + Rr * 2; }
      ctx.z += 1.3; floor(0, ctx.z, ctx.z + 5, 14, ctx.y); pth(0, ctx.z + 3, 8); ctx.z += 5;
    },
    balls() {
      const len = 34; floor(0, ctx.z, ctx.z + len, 14, ctx.y);
      // 기둥 몇 개 (공을 막아 주는 숨을 곳)
      for (let i = 0; i < 3; i++) box({ x: rr(-4, 4), y: ctx.y, z: ctx.z + 8 + i * 8, w: 1.4, h: 2.4, d: 1.4, c: accent() });
      L.streams.push({ x: 0, z: ctx.z + len + 2, y: ctx.y, vx: 0, vz: -8, lx: 1, lz: 0, span: 5.6, R: 1.5, every: 0.85, t0: 0, life: (len + 6) / 8, seed: (seed ^ L.streams.length * 977) >>> 0, c: accent() });
      pth(0, ctx.z + 4, 10); pth(0, ctx.z + 17, 10); pth(0, ctx.z + 31, 10); ctx.z += len;
    },
    ice() {
      const len = 26; floor(0, ctx.z, ctx.z + 3, 14, ctx.y);
      floor(0, ctx.z + 3, ctx.z + len, 12, ctx.y, { ice: true, c: '#bfe6ff' });
      for (let i = 0; i < 4; i++) L.bumpers.push({ x: rr(-4.5, 4.5), z: ctx.z + 7 + i * 4.8, y: ctx.y, R: 0.9, h: 1.4, c: accent() });
      pth(0, ctx.z + 2, 8); pth(0, ctx.z + 14, 8); pth(0, ctx.z + len - 1, 8); ctx.z += len;
    },
    doors() {
      const len = 28; floor(0, ctx.z, ctx.z + len, 16, ctx.y);
      for (let row = 0; row < 3; row++) {
        const z = ctx.z + 6 + row * 7.5, real = new Set();
        const n = 5; while (real.size < 3 - (row === 2 ? 1 : 0)) real.add(Math.floor(R() * n));
        for (let i = 0; i < n; i++) box({ x: -6.4 + i * 3.2, y: ctx.y, z, w: 3.1, h: 3.4, d: 0.7, c: th.acc[(row + i) % th.acc.length], door: L.boxes.length + 1, real: real.has(i) });
        pth(0, z - 2, 14); pth(0, z + 1.2, 14);
      }
      pth(0, ctx.z + len - 2, 10); ctx.z += len;
    },
  };

  if (def.kind === 'race' || id === 'crown') {
    L.time = id === 'crown' ? 120 : 80;
    floor(0, -6, 6, 18, 0); // 출발 판
    for (let i = 0; i < 32; i++) L.spawn.push({ x: -7 + (i % 8) * 2, y: 0, z: -4 + Math.floor(i / 8) * 2 });
    ctx.z = 6; pth(0, 4, 10);
    const segs = [...def.segs];
    // 같은 맵도 판마다 조금씩: 가운데 구간 순서를 섞는다
    for (let i = segs.length - 2; i > 1; i--) { const j = 1 + Math.floor(R() * i); [segs[i], segs[j]] = [segs[j], segs[i]]; }
    for (const s of segs) { cp(s); SEG[s](); }
    if (id === 'crown') {
      floor(0, ctx.z, ctx.z + 12, 12, ctx.y); ctx.y += 0; L.crown = { x: 0, y: ctx.y + 2.4, z: ctx.z + 8 };
      box({ x: 0, y: ctx.y, z: ctx.z + 8, w: 3, h: 1, d: 3, c: '#ffd84d' }); // 왕관 받침 (점프해서 잡는다)
      L.crown.y = ctx.y + 2.6; pth(0, ctx.z + 8, 2);
    } else {
      floor(0, ctx.z, ctx.z + 12, 18, ctx.y, { c: '#ffffff' });
      L.finish = { x0: -9, x1: 9, z0: ctx.z + 2, z1: ctx.z + 12, y: ctx.y };
      pth(0, ctx.z + 6, 10);
    }
    L.end = ctx.z + 12;
    L.deathY = Math.min(-7, ctx.y - 30); // 떨어지면 체크포인트로 (race)
    L.gooY = -5;
  } else if (id === 'sweep' || id === 'bigsweep') {
    const big = id === 'bigsweep';
    L.time = big ? 100 : 60;
    L.disks.push({ x: 0, z: 0, y: 0, R: big ? 11 : 13, h: 1.6, spd: 0, c: th.floor[0], arena: true });
    L.spinners.push({ x: 0, z: 0, y: 0, h: 0.45, len: big ? 11.5 : 13.5, r: 0.38, n: 2, spd: 0.9, acc: big ? 0.022 : 0.018, ph: R() * TAU, c: th.acc[0] });
    L.spinners.push({ x: 0, z: 0, y: 0, h: 1.3, len: big ? 11.5 : 13.5, r: 0.38, n: big ? 2 : 1, spd: -0.65, acc: big ? -0.016 : -0.012, ph: R() * TAU, c: th.acc[1] });
    L.bumpers.push({ x: 0, z: 0, y: 0, R: 1.1, h: 2.4, c: th.side, hub: true });
    for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU + 0.1, r = big ? 6 : 7; L.spawn.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }); }
    L.deathY = -6; L.gooY = -4;
  } else if (id === 'ballstorm') {
    L.time = 60;
    floor(0, -12, 12, 24, 0);
    // 네 방향에서 공 (점점 촘촘해지도록 흐름이 차례로 켜진다)
    const D = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    D.forEach(([dx, dz], k) => {
      for (let j = 0; j < 2; j++) L.streams.push({ x: -dx * 16, z: -dz * 16, y: 0, vx: dx * 9, vz: dz * 9, lx: Math.abs(dz), lz: Math.abs(dx), span: 10.5, R: 1.6, every: rr(1.7, 2.3), t0: 1 + k * 4 + j * 14 + rr(0, 1), life: 34 / 9, seed: (seed * 31 + k * 7 + j) >>> 0, c: th.acc[(k + j) % th.acc.length] });
    });
    for (let i = 0; i < 32; i++) L.spawn.push({ x: -7 + (i % 8) * 2, y: 0, z: -4.5 + Math.floor(i / 8) * 3 });
    L.deathY = -6; L.gooY = -4;
  } else if (id === 'vanish') {
    L.time = 60;
    const n = 8, s = 3, order = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) order.push([i, j]);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // 6초부터 떨어지기 시작 · 마지막 몇 칸은 끝까지 남는다
    order.forEach(([i, j], k) => { const at = k < n * n - 9 ? 6 + k * (48 / (n * n)) : null; L.tiles.push({ id: L.tiles.length + 1, x: (i - (n - 1) / 2) * s, y: -0.6, z: (j - (n - 1) / 2) * s, w: s - 0.12, h: 0.6, d: s - 0.12, c: th.acc[(i + j) % 2 ? 0 : 1], fallAt: at, sched: true }); });
    for (let i = 0; i < 32; i++) L.spawn.push({ x: -8 + (i % 8) * 2.3, y: 0, z: -6 + Math.floor(i / 8) * 3.6 });
    L.deathY = -6; L.gooY = -4;
  } else if (id === 'tiles') {
    L.time = 120;
    const n = 12, s = 2.4;
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) L.tiles.push({ id: L.tiles.length + 1, x: (i - (n - 1) / 2) * s, y: -layer * 7 - 0.5, z: (j - (n - 1) / 2) * s, w: s - 0.14, h: 0.5, d: s - 0.14, c: th.acc[layer], layer, step: true });
    for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU, r = 3 + (i % 3) * 2.6; L.spawn.push({ x: Math.cos(a) * r, y: 0.2, z: Math.sin(a) * r }); }
    L.deathY = -22; L.gooY = -20;
  }
  return L;
}

// 몇 명이 남을지 (정원)
export function quotaFor(kind, alive) {
  if (kind === 'race') return Math.max(1, Math.min(alive - 1, Math.round(alive * 0.62)));
  if (kind === 'survive') return Math.max(1, Math.min(alive - 1, Math.round(alive * 0.6)));
  return 1;
}
// 몇 판을 어떤 순서로 (사람 수에 맞춰): 레이스 → (레이스|버티기) … → 결승
export function planEpisode(n, seed) {
  const R = rng(seed ^ 0x51ed27);
  const pick = (arr, used) => { const a = arr.filter((x) => !used.has(x)); const v = (a.length ? a : arr)[Math.floor(R() * (a.length ? a.length : arr.length))]; used.add(v); return v; };
  const used = new Set(), plan = [];
  let alive = n;
  while (alive > 4 && plan.length < 4) {
    const kind = plan.length === 0 || R() < 0.55 ? 'race' : 'survive';
    plan.push(pick(POOL[kind], used));
    alive = quotaFor(kind, alive);
  }
  plan.push(pick(POOL.final, used));
  return plan;
}
