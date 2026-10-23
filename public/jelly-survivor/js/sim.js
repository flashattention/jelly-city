// 젤리 서바이버 (충치균 대습격): 서버(같이 하기)와 화면(혼자 하기)이 같이 쓰는 게임 규칙
//   곰돌이는 걷기만 하고 무기는 저절로 쏜다 · 충치균을 녹이면 설탕 결정(경험치) · 레벨업마다 3개 중 하나 고르기
//   3분에 왕 충치균 · 7분에 충치 대마왕 · 대마왕을 녹이면 승리. 같이 하기는 협동(쓰러지면 친구가 옆에 서서 살린다)
export const ARENA = 70;           // 젤리 들판 반지름 (네모 -70 ~ 70)
export const RUN = { boss1: 180, boss2: 420 };
export const MAX_LV = 5, MAX_W = 5, MAX_P = 5;

export const WEAPONS = {
  candy: { name: '사탕 총알', emoji: '🍬', desc: ['가까운 충치균에게 사탕을 쏴요', '사탕 +1', '더 빨리 · 더 세게', '사탕 +1', '꿰뚫는 사탕 (3마리)'] },
  brush: { name: '칫솔 베기', emoji: '🪥', desc: ['보는 쪽을 칫솔로 쓱 베어요', '더 넓게', '앞뒤로 베기', '더 세게', '한 바퀴 회오리 베기'] },
  orbit: { name: '곰젤리 수호대', emoji: '🐻', desc: ['곰젤리 2마리가 빙글빙글 지켜요', '곰젤리 +1', '더 빨리 돌아요', '곰젤리 +1', '곰젤리 +2 · 더 크게'] },
  bolt: { name: '탄산 번개', emoji: '⚡', desc: ['무작위 충치균에게 톡 쏘는 번개', '번개 +1', '더 자주', '번개 +1', '번개가 옆으로 튀어요'] },
  bomb: { name: '젤리 폭탄', emoji: '💣', desc: ['충치균 무리에 젤리 폭탄을 던져요', '폭발이 커져요', '끈적 웅덩이 (느려짐)', '폭탄 +1', '폭탄 +1 · 더 세게'] },
  drill: { name: '솜사탕 회오리', emoji: '🌀', desc: ['화면 안을 튕겨 다니는 회오리', '더 오래', '회오리 +1', '더 세게', '회오리 +1 · 더 커져요'] },
  aura: { name: '치약 거품', emoji: '🫧', desc: ['곁에 오면 녹는 거품 (느려짐)', '더 넓게', '더 세게', '더 넓게', '거품 폭발 · 아주 넓게'] },
  lolli: { name: '롤리팝 부메랑', emoji: '🍭', desc: ['갔다가 돌아오는 롤리팝', '더 세게', '부메랑 +1', '더 멀리', '부메랑 +1 · 더 커져요'] },
  laser: { name: '무지개 레이저', emoji: '🌈', desc: ['가까운 충치균 쪽으로 한 줄 관통 레이저', '더 길게', '레이저 +1', '더 자주', '레이저 +2 · 더 굵게'] },
  mine: { name: '젤리 지뢰', emoji: '🍮', desc: ['걸어간 자리에 젤리 지뢰를 깔아요', '지뢰가 커져요', '더 자주', '더 세게', '연쇄 폭발 · 아주 크게'] },
  frost: { name: '아이스크림 냉기', emoji: '🍦', desc: ['보는 쪽 부채꼴로 얼려요 (느려짐)', '더 넓게', '더 세게', '앞뒤로', '꽁꽁 얼리기 (멈춤)'] },
  star: { name: '별사탕 수리검', emoji: '⭐', desc: ['네 방향으로 별사탕을 던져요', '더 세게', '여섯 방향', '꿰뚫어요', '여덟 방향 · 더 커져요'] },
  meteor: { name: '별똥별 사탕', emoji: '☄️', desc: ['하늘에서 큰 사탕이 떨어져요', '더 커져요', '별똥별 +1', '더 세게', '별똥별 +2'] },
};
export const PASSIVES = {
  might: { name: '튼튼 이빨', emoji: '🦷', desc: '공격력 +12%' },
  haste: { name: '탄산 부스터', emoji: '🥤', desc: '공격 간격 -8%' },
  area: { name: '빵빵 젤리', emoji: '🎈', desc: '공격 범위 +12%' },
  speed: { name: '날쌘 발', emoji: '👟', desc: '이동 속도 +8%' },
  hpup: { name: '말랑 몸', emoji: '💗', desc: '최대 체력 +20 · 조금씩 회복' },
  magnet: { name: '설탕 자석', emoji: '🧲', desc: '줍는 거리 +40%' },
};
// 충치균 종류: 체력 · 빠르기 · 부딪힐 때 피해 · 크기 · 설탕(경험치)
export const ENEMIES = {
  germ: { name: '충치균', hp: 9, spd: 2.7, dmg: 7, r: 0.55, xp: 1 },
  bat: { name: '설탕 박쥐', hp: 5, spd: 4.4, dmg: 5, r: 0.45, xp: 1 },
  choco: { name: '초코 덩어리', hp: 38, spd: 1.8, dmg: 13, r: 0.85, xp: 3 },
  ghost: { name: '솜사탕 유령', hp: 16, spd: 2.3, dmg: 8, r: 0.6, xp: 2, ranged: true },
  sour: { name: '새콤 젤리', hp: 24, spd: 2.5, dmg: 10, r: 0.7, xp: 2, split: true },
  mini: { name: '꼬마 충치균', hp: 5, spd: 3.3, dmg: 5, r: 0.38, xp: 0 },
  king: { name: '왕 충치균', hp: 1100, spd: 2.5, dmg: 22, r: 2.2, xp: 60, boss: 1 },
  lord: { name: '충치 대마왕', hp: 3600, spd: 1.9, dmg: 30, r: 2.9, xp: 0, boss: 2 },
};
export const E_KEYS = Object.keys(ENEMIES);
// 스테이지: 갈수록 충치균이 세지고 · 많아지고 · 센 놈이 일찍 나온다 (들판 색도 바뀐다)
export const STAGES = [
  { name: '사탕 들판', emoji: '🍬', g: ['#ffe3f1', '#ffd3ea'], sky: '#ffd9ec' },
  { name: '민트 초원', emoji: '🌿', g: ['#e3fff1', '#ccf5df'], sky: '#d9fff0' },
  { name: '레몬 사막', emoji: '🍋', g: ['#fff8d6', '#ffefb0'], sky: '#fff3c4' },
  { name: '블루베리 호수', emoji: '🫐', g: ['#e3ecff', '#cddcff'], sky: '#dbe6ff' },
  { name: '초콜릿 숲', emoji: '🍫', g: ['#f0dccb', '#e2c6ad'], sky: '#efd8c4' },
  { name: '포도 동굴', emoji: '🍇', g: ['#efe1ff', '#ddc6ff'], sky: '#e6d6ff' },
  { name: '오렌지 화산', emoji: '🍊', g: ['#ffe6d1', '#ffd1ad'], sky: '#ffdcc2' },
  { name: '솜사탕 구름', emoji: '☁️', g: ['#fbf4ff', '#efe3fb'], sky: '#f6eeff' },
  { name: '콜라 늪', emoji: '🥤', g: ['#e6d7cf', '#d4beb2'], sky: '#dccbc2' },
  { name: '얼음 사탕 빙하', emoji: '🧊', g: ['#e6fbff', '#c9f1ff'], sky: '#dff7ff' },
  { name: '썩은 과자 성', emoji: '🏚️', g: ['#e4dde8', '#d0c6d6'], sky: '#d8d0de' },
  { name: '충치 대마왕의 입속', emoji: '🦷', g: ['#ffd6d6', '#f5bcbc'], sky: '#f7c9c9' },
];
export const ENDLESS_STEP = 180; // 무한 모드: 3분마다 한 단계씩 어려워진다
export const P_KINDS = ['candy', 'lolli', 'drill', 'bomb', 'spit', 'mine', 'star', 'meteor']; // 뒤에만 덧붙인다 (스냅샷 번호)

const rnd = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const clampA = (v) => Math.max(-ARENA, Math.min(ARENA, v));

export class Sim {
  // players: [{ id, name, color }] · coop: 같이 하기면 쓰러져도 바로 끝나지 않는다
  // stage: 1~12 (스테이지 모드) · endless: 무한 모드 (단계가 시간에 따라 오른다)
  constructor(players, { coop = false, hard = false, stage = 1, endless = false } = {}) {
    this.t = 0; this.coop = coop; this.hard = hard; this.nid = 1;
    this.stage = Math.max(1, Math.min(STAGES.length, stage | 0)); this.endless = !!endless; this.lastLv = this.endless ? 1 : this.stage; this.nextBoss = RUN.boss1; this.bossN = 0;
    this.players = new Map(); this.enemies = []; this.projs = []; this.shots = []; this.gems = []; this.items = []; this.puddles = [];
    this.ev = []; this.spawnAcc = 0; this.nextElite = 60; this.rings = [100, 260, 360, 480]; this.boss1 = false; this.boss2 = false;
    this.over = false; this.win = false; this.endT = 0; this.gemAdd = []; this.gemRm = [];
    players.forEach((p, i) => this.addPlayer(p, i, players.length));
  }
  addPlayer(m, i = 0, n = 1) {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const P = { id: m.id, name: m.name, color: m.color, x: n > 1 ? Math.cos(a) * 2 : 0, z: n > 1 ? Math.sin(a) * 2 : 0, dx: 0, dz: 0, face: 0, hp: 100, lvl: 1, xp: 0, xpNext: 5,
      w: { candy: 1 }, p: {}, cd: {}, pending: 0, choices: null, choiceT: 0, st: 0, downT: 0, rev: 0, hurtT: 0, kills: 0, dmg: 0, deathT: 0, regenAcc: 0 };
    P.hp = this.maxHp(P);
    this.players.set(m.id, P);
    return P;
  }
  // ---------- 능력치 ----------
  maxHp(P) { return 100 + 20 * (P.p.hpup || 0); }
  might(P) { return 1 + 0.12 * (P.p.might || 0); }
  haste(P) { return 1 + 0.09 * (P.p.haste || 0); }
  area(P) { return 1 + 0.12 * (P.p.area || 0); }
  speed(P) { return 6 * (1 + 0.08 * (P.p.speed || 0)); }
  magnet(P) { return 2.4 * (1 + 0.4 * (P.p.magnet || 0)); }
  alive() { return [...this.players.values()].filter((P) => P.st === 0); }
  input(id, dx, dz) { const P = this.players.get(id); if (!P) return; const L = Math.hypot(dx, dz); P.dx = L > 1 ? dx / L : dx || 0; P.dz = L > 1 ? dz / L : dz || 0; }

  // ---------- 레벨업 고르기 ----------
  rollChoices(P) {
    const pool = [];
    const nw = Object.keys(P.w).length, np = Object.keys(P.p).length;
    for (const k of Object.keys(WEAPONS)) { const l = P.w[k] || 0; if (l ? l < MAX_LV : nw < MAX_W) pool.push({ k: 'w', id: k, lv: l + 1 }); }
    for (const k of Object.keys(PASSIVES)) { const l = P.p[k] || 0; if (l ? l < MAX_LV : np < MAX_P) pool.push({ k: 'p', id: k, lv: l + 1 }); }
    // 가진 걸 올리는 쪽을 조금 더 자주
    const out = [];
    while (out.length < 3 && pool.length) {
      const wts = pool.map((o) => ((o.k === 'w' ? P.w[o.id] : P.p[o.id]) ? 2.2 : 1));
      let r = Math.random() * wts.reduce((a, b) => a + b, 0), i = 0;
      for (; i < pool.length - 1; i++) { r -= wts[i]; if (r <= 0) break; }
      out.push(pool.splice(i, 1)[0]);
    }
    if (!out.length) out.push({ k: 'heal', id: 'cake', lv: 0 });
    return out;
  }
  pick(id, i) {
    const P = this.players.get(id); if (!P || !P.choices) return false;
    const o = P.choices[Math.max(0, Math.min(P.choices.length - 1, i | 0))];
    if (o.k === 'w') P.w[o.id] = o.lv;
    else if (o.k === 'p') { const before = this.maxHp(P); P.p[o.id] = o.lv; if (o.id === 'hpup') P.hp += this.maxHp(P) - before; }
    else P.hp = Math.min(this.maxHp(P), P.hp + 40);
    P.choices = null; P.pending--; P.cd[o.id] = 0;
    this.ev.push(['pick', P.id, o.k === 'heal' ? '🍰' : (o.k === 'w' ? WEAPONS : PASSIVES)[o.id].emoji]);
    if (P.pending > 0) { P.choices = this.rollChoices(P); P.choiceT = 0; }
    return true;
  }
  gainXp(P, v) {
    P.xp += v;
    while (P.xp >= P.xpNext) { P.xp -= P.xpNext; P.lvl++; P.xpNext = Math.round(5 + P.lvl * 4.2 + P.lvl ** 1.45); P.pending++; this.ev.push(['lvl', P.id, P.lvl]); }
    if (P.pending > 0 && !P.choices) { P.choices = this.rollChoices(P); P.choiceT = 0; }
  }

  // ---------- 한 걸음 ----------
  step(dt) {
    if (this.over) return;
    this.t += dt;
    const n = this.players.size;
    this.movePlayers(dt);
    this.spawn(dt, n);
    this.moveEnemies(dt);
    for (const P of this.players.values()) if (P.st === 0) this.fireWeapons(P, dt);
    this.moveProjs(dt);
    this.moveShots(dt);
    this.tickPuddles(dt);
    this.pickups(dt);
    this.checkEnd(dt);
  }
  movePlayers(dt) {
    for (const P of this.players.values()) {
      if (P.st !== 0) continue;
      const sp = this.speed(P);
      P.x = clampA(P.x + P.dx * sp * dt); P.z = clampA(P.z + P.dz * sp * dt);
      if (P.dx || P.dz) P.face = Math.atan2(P.dx, P.dz);
      P.hurtT = Math.max(0, P.hurtT - dt);
      // 말랑 몸: 조금씩 회복
      if (P.p.hpup) { P.regenAcc += dt * 0.35 * P.p.hpup; if (P.regenAcc >= 1) { const h = Math.floor(P.regenAcc); P.regenAcc -= h; P.hp = Math.min(this.maxHp(P), P.hp + h); } }
      if (P.choices) P.choiceT += dt;
    }
    // 쓰러진 친구 살리기: 산 친구가 2.2m 안에 서 있으면 2.5초에 일어난다 · 25초 지나면 완전히 탈락
    for (const P of this.players.values()) {
      if (P.st !== 1) continue;
      P.downT += dt;
      const helper = this.alive().some((Q) => dist2(P, Q) < 2.2 * 2.2);
      P.rev = helper ? P.rev + dt / 2.5 : Math.max(0, P.rev - dt * 0.5);
      if (P.rev >= 1) { P.st = 0; P.hp = this.maxHp(P) * 0.5; P.rev = 0; P.downT = 0; P.hurtT = 2; this.ev.push(['revive', P.id]); }
      else if (P.downT > 25) { P.st = 2; P.deathT = this.t; this.ev.push(['dead', P.id]); }
    }
  }
  // ---------- 충치균 나오기 ----------
  // 지금 단계: 스테이지 모드는 고른 스테이지 · 무한 모드는 3분마다 +1
  lv() { return this.endless ? 1 + Math.floor(this.t / ENDLESS_STEP) : this.stage; }
  scale(n) { const L = this.lv() - 1; return (1 + this.t / 95) * (1 + 0.45 * (n - 1)) * (this.hard ? 1.5 : 1) * (1 + 0.22 * L); }
  spawnOne(type, around, d0 = 15, d1 = 20, mult = 1) {
    const T = ENEMIES[type], a = Math.random() * Math.PI * 2, d = rnd(d0, d1);
    const n = this.players.size, hp = T.boss ? T.hp * (1 + 0.7 * (n - 1)) * (this.hard ? 1.4 : 1) : T.hp * this.scale(n) * mult;
    const L = this.lv() - 1, bossK = T.boss ? 1 + 0.35 * L : 1;
    const e = { id: this.nid++, type, x: clampA(around.x + Math.cos(a) * d), z: clampA(around.z + Math.sin(a) * d), hp: hp * bossK, maxHp: hp * bossK, spd: T.spd * (mult > 1 ? 0.9 : 1) * rnd(0.92, 1.08) * (1 + 0.025 * L), dmg: T.dmg * (mult > 1 ? 1.6 : 1) * (this.hard ? 1.3 : 1) * (1 + 0.08 * L), r: T.r * (mult > 1 ? 1.55 : 1), elite: mult > 1, atkT: 0, slowT: 0, kx: 0, kz: 0, flash: 0, act: rnd(1, 3), dashT: 0, vx: 0, vz: 0 };
    this.enemies.push(e);
    return e;
  }
  spawn(dt, n) {
    const A = this.alive(); if (!A.length) return;
    const L = this.lv() - 1;
    // 단계가 오르면 알려 준다 (무한 모드)
    if (this.lv() > this.lastLv) { this.lastLv = this.lv(); this.ev.push(['lvup', this.lastLv]); }
    const t = this.t + L * 10, cap = (210 + 45 * n + 12 * L) * (this.hard ? 1.2 : 1); // 단계마다 센 놈이 10초씩 일찍
    const rate = Math.min(16 + 1.5 * L, (1.1 + this.t / 20) * (1 + 0.55 * (n - 1)) * (this.hard ? 1.35 : 1) * (1 + 0.08 * L));
    this.spawnAcc += rate * dt;
    const pool = ['germ', 'germ', 'germ'];
    if (t > 30) pool.push('bat', 'bat');
    if (t > 80) pool.push('choco');
    if (t > 140) pool.push('ghost');
    if (t > 230) pool.push('sour', 'choco', 'bat');
    if (t > 330) pool.push('ghost', 'sour', 'choco');
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (this.enemies.length >= cap) continue;
      this.spawnOne(pool[Math.floor(Math.random() * pool.length)], A[Math.floor(Math.random() * A.length)]);
    }
    // 엘리트 (크고 단단 · 보물 사탕 상자)
    if (this.t >= this.nextElite) { this.nextElite += Math.max(25, 55 - L * 3); const e = this.spawnOne(t > 200 ? 'choco' : 'germ', A[0], 14, 16, 5); this.ev.push(['elite', e.id]); }
    // 포위: 사방에서 둘러싼다
    if (this.endless && !this.rings.length) this.rings.push(this.t + 150); // 무한: 2분 반마다 포위
    if (this.rings.length && this.t >= this.rings[0]) { this.rings.shift(); for (const P of A) for (let i = 0; i < 28; i++) { const e = this.spawnOne(t > 300 ? 'bat' : 'germ', P, 13, 13.5); const a = (i / 28) * Math.PI * 2; e.x = clampA(P.x + Math.cos(a) * 13); e.z = clampA(P.z + Math.sin(a) * 13); } this.ev.push(['warn', '사방에서 몰려와요!']); }
    if (this.endless) {
      // 무한: 3분마다 우두머리 (왕 충치균 · 대마왕이 번갈아, 점점 여러 마리)
      if (this.t >= this.nextBoss) { this.nextBoss += ENDLESS_STEP; this.bossN++; const lord = this.bossN % 2 === 0, k = 1 + Math.floor((this.bossN - 1) / 3); for (let i = 0; i < k; i++) this.spawnOne(lord ? 'lord' : 'king', A[i % A.length], 16, 19); this.ev.push(['boss', lord ? 2 : 1, k]); }
    } else {
      if (!this.boss1 && this.t >= RUN.boss1) { this.boss1 = true; this.spawnOne('king', A[0], 16, 17); this.ev.push(['boss', 1]); }
      if (!this.boss2 && this.t >= RUN.boss2) { this.boss2 = true; this.spawnOne('lord', A[0], 17, 18); this.ev.push(['boss', 2]); }
    }
  }
  nearestPlayer(e) { let best = null, bd = Infinity; for (const P of this.players.values()) { if (P.st !== 0) continue; const d = dist2(e, P); if (d < bd) { bd = d; best = P; } } return best; }
  moveEnemies(dt) {
    // 서로 밀어내기 (2m 칸)
    const grid = new Map(), key = (x, z) => (Math.floor(x / 2) + 100) * 1000 + Math.floor(z / 2) + 100;
    for (const e of this.enemies) { const k = key(e.x, e.z); let L = grid.get(k); if (!L) grid.set(k, (L = [])); L.push(e); }
    for (const e of this.enemies) {
      const P = this.nearestPlayer(e);
      e.flash = Math.max(0, e.flash - dt); e.atkT = Math.max(0, e.atkT - dt); e.slowT = Math.max(0, e.slowT - dt);
      if (!P) continue;
      const T = ENEMIES[e.type];
      let dx = P.x - e.x, dz = P.z - e.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      e.frozen = Math.max(0, (e.frozen || 0) - dt);
      let sp = e.spd * (e.slowT > 0 ? 0.55 : 1) * (e.frozen > 0 ? 0 : 1);
      // 원거리: 거리를 두고 솜사탕 침을 뱉는다
      if (T.ranged) { if (d < 7) sp *= -0.6; e.act -= dt; if (e.act <= 0 && d < 14) { e.act = rnd(2.4, 3.4); this.shoot(e, dx, dz, 7, e.dmg); } }
      if (T.boss) this.bossThink(e, P, dx, dz, d, dt);
      if (e.dashT > 0) { e.dashT -= dt; e.x += e.vx * dt; e.z += e.vz * dt; }
      else { e.x += dx * sp * dt; e.z += dz * sp * dt; }
      // 밀려남 (맞았을 때)
      e.x += e.kx * dt; e.z += e.kz * dt; e.kx *= Math.exp(-dt * 8); e.kz *= Math.exp(-dt * 8);
      e.x = clampA(e.x); e.z = clampA(e.z);
      // 겹치지 않게
      const gx = Math.floor(e.x / 2) + 100, gz = Math.floor(e.z / 2) + 100;
      for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
        const L = grid.get((gx + ix) * 1000 + gz + iz); if (!L) continue;
        for (const o of L) { if (o === e) continue; const ox = e.x - o.x, oz = e.z - o.z, rr = e.r + o.r, dd = ox * ox + oz * oz; if (dd < rr * rr && dd > 1e-6) { const k = (rr - Math.sqrt(dd)) * (T.boss ? 0.05 : 0.5); e.x += (ox / Math.sqrt(dd)) * k; e.z += (oz / Math.sqrt(dd)) * k; } }
      }
      // 곰돌이와 부딪히면 아야
      for (const Q of this.players.values()) {
        if (Q.st !== 0) continue;
        const rr = e.r + 0.45;
        if (dist2(e, Q) < rr * rr && e.atkT <= 0) { e.atkT = 0.7; this.hurt(Q, e.dmg); }
      }
    }
  }
  bossThink(e, P, dx, dz, d, dt) {
    e.act -= dt;
    if (e.act > 0) return;
    if (e.type === 'king') {
      // 돌진 · 꼬마 충치균 부르기
      if (Math.random() < 0.55) { e.dashT = 0.7; e.vx = dx * 13; e.vz = dz * 13; this.ev.push(['dash', e.id]); e.act = 3.6; }
      else { for (let i = 0; i < 6; i++) this.spawnOne('mini', e, 1.5, 3); e.act = 3; }
    } else {
      // 사방으로 충치 침 · 돌진
      const r = Math.random();
      if (r < 0.5) { const k = 18, o = Math.random(); for (let i = 0; i < k; i++) { const a = ((i + o) / k) * Math.PI * 2; this.shoot(e, Math.cos(a), Math.sin(a), 6.5, 14); } e.act = 2.6; this.ev.push(['roar', e.id]); }
      else if (r < 0.8) { e.dashT = 0.8; e.vx = dx * 12; e.vz = dz * 12; this.ev.push(['dash', e.id]); e.act = 3.2; }
      else { for (let i = 0; i < 8; i++) this.spawnOne(Math.random() < 0.5 ? 'bat' : 'mini', e, 2, 4); e.act = 2.4; }
    }
  }
  shoot(e, dx, dz, sp, dmg) { this.shots.push({ id: this.nid++, x: e.x, z: e.z, vx: dx * sp, vz: dz * sp, dmg, life: 6, r: 0.26 }); } // 작게 (너무 커서 피하기 어려웠다)
  moveShots(dt) {
    for (const s of this.shots) {
      s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
      for (const P of this.players.values()) { if (P.st === 0 && dist2(s, P) < (0.5 + s.r) ** 2) { this.hurt(P, s.dmg); s.life = 0; break; } }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && Math.abs(s.x) < ARENA + 5 && Math.abs(s.z) < ARENA + 5);
  }
  hurt(P, dmg) {
    if (P.hurtT > 0 || P.st !== 0) return;
    P.hp -= dmg; P.hurtT = 0.35;
    this.ev.push(['hurt', P.id, Math.round(dmg)]);
    if (P.hp <= 0) {
      P.hp = 0;
      // 같이 하기: 쓰러짐(친구가 살릴 수 있다) · 혼자: 끝
      if (this.coop && this.alive().length > 1) { P.st = 1; P.downT = 0; P.rev = 0; this.ev.push(['down', P.id]); }
      else { P.st = 2; P.deathT = this.t; this.ev.push(['dead', P.id]); }
    }
  }
  // ---------- 무기 ----------
  nearest(x, z, max = 30, skip) {
    let best = null, bd = max * max;
    for (const e of this.enemies) { if (e.hp <= 0 || (skip && skip.has(e.id))) continue; const d = (e.x - x) ** 2 + (e.z - z) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  fireWeapons(P, dt) {
    const H = this.haste(P), M = this.might(P), A = this.area(P);
    const ready = (k, every) => { P.cd[k] = (P.cd[k] ?? 0) - dt * H; if (P.cd[k] > 0) return false; P.cd[k] = every; return true; };
    const w = P.w;
    if (w.candy && ready('candy', w.candy >= 3 ? 0.62 : 0.85)) {
      const n = 1 + (w.candy >= 2) + (w.candy >= 4), seen = new Set();
      for (let i = 0; i < n; i++) {
        const e = this.nearest(P.x, P.z, 16, seen) || this.nearest(P.x, P.z, 16);
        const a = e ? Math.atan2(e.x - P.x, e.z - P.z) + (seen.has(e.id) ? rnd(-0.3, 0.3) : 0) : P.face + (i - (n - 1) / 2) * 0.25;
        if (e) seen.add(e.id);
        this.projs.push({ id: this.nid++, k: 'candy', o: P.id, x: P.x, z: P.z, vx: Math.sin(a) * 17, vz: Math.cos(a) * 17, r: 0.3 * A, dmg: (9 + 3 * w.candy) * M, pierce: w.candy >= 5 ? 3 : 1, life: 1.2, hits: new Map(), a });
      }
      this.ev.push(['shoot', P.id]);
    }
    if (w.brush && ready('brush', 1.25)) {
      const R = (2.4 + 0.35 * w.brush) * A, dmg = (15 + 6 * w.brush) * M;
      const dirs = w.brush >= 5 ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : w.brush >= 3 ? [0, Math.PI] : [0];
      for (const off of dirs) {
        const a0 = P.face + off;
        for (const e of this.enemies) { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > R + e.r) continue; let da = Math.atan2(dx, dz) - a0; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 1.1 || d < 1) this.damage(e, dmg, P, dx / (d || 1), dz / (d || 1), 6); }
        this.ev.push(['sweep', P.id, +a0.toFixed(2), +R.toFixed(1)]);
      }
    }
    if (w.orbit) {
      const k = 2 + (w.orbit >= 2) + (w.orbit >= 4) + (w.orbit >= 5) * 2, R = 2.7 * A, sp = w.orbit >= 3 ? 3.4 : 2.4, br = (w.orbit >= 5 ? 0.75 : 0.55) * A;
      P.orbitHit ||= new Map();
      for (let i = 0; i < k; i++) {
        const a = this.t * sp + (i / k) * Math.PI * 2, bx = P.x + Math.sin(a) * R, bz = P.z + Math.cos(a) * R;
        for (const e of this.enemies) { const rr = br + e.r; if ((e.x - bx) ** 2 + (e.z - bz) ** 2 > rr * rr) continue; const last = P.orbitHit.get(e.id) || 0; if (this.t - last < 0.45) continue; P.orbitHit.set(e.id, this.t); this.damage(e, (7 + 3 * w.orbit) * M, P, Math.sin(a + 1.57), Math.cos(a + 1.57), 4); }
      }
      if (P.orbitHit.size > 600) P.orbitHit.clear();
    }
    if (w.bolt && ready('bolt', w.bolt >= 3 ? 1.3 : 1.8)) {
      const n = 1 + (w.bolt >= 2) + (w.bolt >= 4);
      const near = this.enemies.filter((e) => (e.x - P.x) ** 2 + (e.z - P.z) ** 2 < 14 * 14);
      for (let i = 0; i < n && near.length; i++) {
        const e = near.splice(Math.floor(Math.random() * near.length), 1)[0];
        this.blast(e.x, e.z, 1.3 * A, (22 + 8 * w.bolt) * M, P, 0);
        this.ev.push(['zap', +e.x.toFixed(1), +e.z.toFixed(1)]);
        if (w.bolt >= 5) { const o = this.nearest(e.x, e.z, 6, new Set([e.id])); if (o) { this.blast(o.x, o.z, 1.2 * A, (18 + 6 * w.bolt) * M, P, 0); this.ev.push(['zap', +o.x.toFixed(1), +o.z.toFixed(1)]); } }
      }
    }
    if (w.bomb && ready('bomb', 2.4)) {
      const n = 1 + (w.bomb >= 4) + (w.bomb >= 5);
      for (let i = 0; i < n; i++) {
        const e = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        const tx = e && (e.x - P.x) ** 2 + (e.z - P.z) ** 2 < 15 * 15 ? e.x : P.x + rnd(-6, 6), tz = e && (e.x - P.x) ** 2 + (e.z - P.z) ** 2 < 15 * 15 ? e.z : P.z + rnd(-6, 6);
        this.projs.push({ id: this.nid++, k: 'bomb', o: P.id, x: P.x, z: P.z, sx: P.x, sz: P.z, tx, tz, life: 0.6, dur: 0.6, r: (2.3 + 0.3 * w.bomb) * A, dmg: (24 + 10 * w.bomb) * M * (w.bomb >= 5 ? 1.3 : 1), puddle: w.bomb >= 3 });
      }
    }
    if (w.drill && ready('drill', 3.2)) {
      const n = 1 + (w.drill >= 3) + (w.drill >= 5);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; this.projs.push({ id: this.nid++, k: 'drill', o: P.id, x: P.x, z: P.z, vx: Math.sin(a) * 11, vz: Math.cos(a) * 11, r: (w.drill >= 5 ? 0.9 : 0.6) * A, dmg: (11 + 5 * w.drill) * M, life: 3 + 0.5 * w.drill, hits: new Map(), pierce: 1e9, a }); }
    }
    if (w.aura) {
      const R = (2 + 0.4 * w.aura + (w.aura >= 5) * 1) * A;
      P.auraT = (P.auraT || 0) - dt;
      if (P.auraT <= 0) { P.auraT = 0.5; for (const e of this.enemies) { const rr = R + e.r; if ((e.x - P.x) ** 2 + (e.z - P.z) ** 2 < rr * rr) { this.damage(e, (5 + 3 * w.aura) * M, P, 0, 0, 0); e.slowT = 0.6; } } }
      if (w.aura >= 5 && ready('auraboom', 4)) { this.blast(P.x, P.z, R * 1.6, (30 + 8 * w.aura) * M, P, 8); this.ev.push(['boom', +P.x.toFixed(1), +P.z.toFixed(1), +(R * 1.6).toFixed(1), 1]); }
    }
    if (w.laser && ready('laser', w.laser >= 4 ? 1.6 : 2.2)) {
      // 한 줄로 쭉: 선 위의 충치균 모두
      const n = 1 + (w.laser >= 3) + (w.laser >= 5) * 2, L = (11 + 2 * w.laser) * A, wide = (w.laser >= 5 ? 0.9 : 0.6) * A;
      const e0 = this.nearest(P.x, P.z, L), a0 = e0 ? Math.atan2(e0.x - P.x, e0.z - P.z) : P.face;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5 : 0), dx = Math.sin(a), dz = Math.cos(a);
        for (const e of this.enemies) { const rx = e.x - P.x, rz = e.z - P.z, along = rx * dx + rz * dz; if (along < 0 || along > L) continue; if (Math.abs(rx * dz - rz * dx) < wide + e.r) this.damage(e, (16 + 7 * w.laser) * M, P, dx, dz, 2); }
        this.ev.push(['beam', +P.x.toFixed(1), +P.z.toFixed(1), +(P.x + dx * L).toFixed(1), +(P.z + dz * L).toFixed(1), +wide.toFixed(2)]);
      }
    }
    if (w.mine && ready('mine', w.mine >= 3 ? 1.1 : 1.6)) {
      this.projs.push({ id: this.nid++, k: 'mine', o: P.id, x: P.x, z: P.z, vx: 0, vz: 0, r: 0.5, life: 12, arm: 0.4, br: (2.4 + 0.35 * w.mine + (w.mine >= 5) * 1.5) * A, dmg: (22 + 9 * w.mine) * M, chain: w.mine >= 5, hits: new Map(), pierce: 1, a: 0 });
    }
    if (w.frost && ready('frost', 1.8)) {
      const R0 = (3.6 + 0.5 * w.frost) * A, dirs = w.frost >= 4 ? [0, Math.PI] : [0];
      for (const off of dirs) {
        const a0 = P.face + off;
        for (const e of this.enemies) { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); if (d > R0 + e.r) continue; let da = Math.atan2(dx, dz) - a0; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 0.75 || d < 1) { this.damage(e, (9 + 5 * w.frost) * M, P, 0, 0, 0); e.slowT = w.frost >= 5 ? 1.6 : 1.1; if (w.frost >= 5 && !ENEMIES[e.type].boss) e.frozen = 0.8; } }
        this.ev.push(['frost', P.id, +a0.toFixed(2), +R0.toFixed(1)]);
      }
    }
    if (w.star && ready('star', 1.5)) {
      const n = w.star >= 5 ? 8 : w.star >= 3 ? 6 : 4, o = this.t * 0.7;
      for (let i = 0; i < n; i++) { const a = o + (i / n) * Math.PI * 2; this.projs.push({ id: this.nid++, k: 'star', o: P.id, x: P.x, z: P.z, vx: Math.sin(a) * 13, vz: Math.cos(a) * 13, r: (w.star >= 5 ? 0.55 : 0.4) * A, dmg: (10 + 4 * w.star) * M, life: 1.0, hits: new Map(), pierce: w.star >= 4 ? 3 : 1, a: 0 }); }
    }
    if (w.meteor && ready('meteor', 3)) {
      const n = 1 + (w.meteor >= 3) + (w.meteor >= 5) * 2;
      for (let i = 0; i < n; i++) {
        const e = this.enemies.length ? this.enemies[Math.floor(Math.random() * this.enemies.length)] : null, near = e && (e.x - P.x) ** 2 + (e.z - P.z) ** 2 < 16 * 16;
        const tx = near ? e.x : P.x + rnd(-8, 8), tz = near ? e.z : P.z + rnd(-8, 8);
        this.projs.push({ id: this.nid++, k: 'meteor', o: P.id, x: tx, z: tz, vx: 0, vz: 0, r: (2.8 + 0.35 * w.meteor) * A, life: 1.1, dur: 1.1, dmg: (40 + 15 * w.meteor) * M, a: 1 });
      }
    }
    if (w.lolli && ready('lolli', 2)) {
      const n = 1 + (w.lolli >= 3) + (w.lolli >= 5);
      for (let i = 0; i < n; i++) {
        const e = this.nearest(P.x, P.z, 14), a = (e ? Math.atan2(e.x - P.x, e.z - P.z) : P.face) + (i - (n - 1) / 2) * 0.6;
        const sp = w.lolli >= 4 ? 15 : 12;
        this.projs.push({ id: this.nid++, k: 'lolli', o: P.id, x: P.x, z: P.z, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, r: (w.lolli >= 5 ? 0.85 : 0.6) * A, dmg: (13 + 6 * w.lolli) * M, life: 3, hits: new Map(), pierce: 1e9, a: 0, back: false });
      }
    }
  }
  moveProjs(dt) {
    for (const p of this.projs) {
      p.life -= dt;
      const P = this.players.get(p.o);
      if (p.k === 'bomb') {
        const u = 1 - p.life / p.dur; p.x = p.sx + (p.tx - p.sx) * u; p.z = p.sz + (p.tz - p.sz) * u;
        if (p.life <= 0 && P) { this.blast(p.tx, p.tz, p.r, p.dmg, P, 5); this.ev.push(['boom', +p.tx.toFixed(1), +p.tz.toFixed(1), +p.r.toFixed(1), 0]); if (p.puddle) this.puddles.push({ id: this.nid++, x: p.tx, z: p.tz, r: p.r * 0.85, life: 3.5, o: p.o, dmg: p.dmg * 0.15, acc: 0 }); }
        continue;
      }
      if (p.k === 'meteor') {
        p.a = Math.max(0, p.life / p.dur); // 남은 높이 (화면: 하늘에서 떨어진다)
        if (p.life <= 0 && P) { this.blast(p.x, p.z, p.r, p.dmg, P, 6); this.ev.push(['boom', +p.x.toFixed(1), +p.z.toFixed(1), +p.r.toFixed(1), 2]); }
        continue;
      }
      if (p.k === 'mine') {
        // 밟으면 펑 · Lv5 는 옆 지뢰도 따라 터진다
        p.arm -= dt; p.a += dt;
        const go = p.trig || (p.arm <= 0 && this.enemies.some((e) => (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < (0.8 + e.r) ** 2));
        if (go && P) {
          p.life = 0; this.blast(p.x, p.z, p.br, p.dmg, P, 5); this.ev.push(['boom', +p.x.toFixed(1), +p.z.toFixed(1), +p.br.toFixed(1), 0]);
          if (p.chain) for (const q of this.projs) if (q.k === 'mine' && q !== p && q.life > 0 && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < p.br * p.br) q.trig = true;
        }
        continue;
      }
      if (p.k === 'star') p.a += dt * 14;
      if (p.k === 'lolli' && P) {
        // 처음엔 나가다가 느려지고, 돌아올 때는 주인에게 끌려온다
        if (!p.back) { p.vx *= Math.exp(-dt * 1.6); p.vz *= Math.exp(-dt * 1.6); if (Math.hypot(p.vx, p.vz) < 2) p.back = true; }
        else { const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz) || 1; p.vx += (dx / d) * 40 * dt; p.vz += (dz / d) * 40 * dt; const s = Math.hypot(p.vx, p.vz); if (s > 16) { p.vx *= 16 / s; p.vz *= 16 / s; } if (d < 0.8) p.life = 0; }
        p.a += dt * 14;
      }
      if (p.k === 'drill' && P) {
        // 곰돌이 둘레 상자 안을 튕겨 다닌다 (화면 안)
        if (p.x < P.x - 13 || p.x > P.x + 13) { p.vx = -p.vx; p.x = Math.max(P.x - 13, Math.min(P.x + 13, p.x)); }
        if (p.z < P.z - 9 || p.z > P.z + 9) { p.vz = -p.vz; p.z = Math.max(P.z - 9, Math.min(P.z + 9, p.z)); }
        p.a += dt * 10;
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      // 맞히기
      for (const e of this.enemies) {
        if (e.hp <= 0 || p.pierce <= 0) continue;
        const rr = p.r + e.r; if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > rr * rr) continue;
        const last = p.hits.get(e.id);
        if (last != null && (p.k === 'candy' || this.t - last < 0.4)) continue;
        p.hits.set(e.id, this.t);
        const s = Math.hypot(p.vx, p.vz) || 1;
        if (P) this.damage(e, p.dmg, P, p.vx / s, p.vz / s, p.k === 'candy' ? 3 : 5);
        p.pierce--;
      }
      if (p.pierce <= 0) p.life = 0;
    }
    this.projs = this.projs.filter((p) => p.life > 0);
  }
  tickPuddles(dt) {
    for (const u of this.puddles) {
      u.life -= dt; u.acc -= dt;
      const P = this.players.get(u.o);
      for (const e of this.enemies) { if ((e.x - u.x) ** 2 + (e.z - u.z) ** 2 < (u.r + e.r) ** 2) { e.slowT = 0.4; if (u.acc <= 0 && P) this.damage(e, u.dmg, P, 0, 0, 0); } }
      if (u.acc <= 0) u.acc = 0.5;
    }
    this.puddles = this.puddles.filter((u) => u.life > 0);
  }
  blast(x, z, r, dmg, P, kb) { for (const e of this.enemies) { const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz); if (d < r + e.r) this.damage(e, dmg, P, dx / (d || 1), dz / (d || 1), kb); } }
  damage(e, dmg, P, nx, nz, kb) {
    if (e.hp <= 0) return;
    const crit = Math.random() < 0.08, d = dmg * (crit ? 1.8 : 1) * rnd(0.9, 1.1);
    e.hp -= d; e.flash = 0.12;
    const T = ENEMIES[e.type];
    if (kb && !T.boss) { const k = kb / (e.elite ? 3 : 1); e.kx += nx * k; e.kz += nz * k; }
    P.dmg += Math.min(d, e.hp + d);
    if (this.ev.length < 400) this.ev.push(['hit', +e.x.toFixed(1), +e.z.toFixed(1), Math.round(d), crit ? 1 : 0, e.id]);
    if (e.hp <= 0) this.kill(e, P);
  }
  kill(e, P) {
    const T = ENEMIES[e.type];
    P.kills++;
    this.ev.push(['kill', +e.x.toFixed(1), +e.z.toFixed(1), E_KEYS.indexOf(e.type), e.elite ? 1 : 0]);
    const v = T.xp * (e.elite ? 6 : 1);
    if (v) this.dropGem(e.x, e.z, v);
    if (T.split) for (let i = 0; i < 2; i++) { const m = this.spawnOne('mini', e, 0.3, 0.8); m.hp = m.maxHp = 6 * this.scale(this.players.size); }
    if (e.elite || T.boss === 1) this.dropItem(e.x, e.z, 'chest');
    if (T.boss === 1) { for (let i = 0; i < 24; i++) this.dropGem(e.x + rnd(-3, 3), e.z + rnd(-3, 3), 5); this.ev.push(['bossdown', 1]); }
    if (T.boss === 2 && !this.endless) { this.win = true; this.ev.push(['bossdown', 2]); }
    else if (T.boss === 2) { this.dropItem(e.x, e.z, 'chest'); for (let i = 0; i < 30; i++) this.dropGem(e.x + rnd(-3, 3), e.z + rnd(-3, 3), 5); this.ev.push(['bossdown', 3]); }
    else if (Math.random() < 0.007) this.dropItem(e.x, e.z, 'cake');
    else if (Math.random() < 0.0025) this.dropItem(e.x, e.z, 'magnet');
    this.enemies = this.enemies.filter((o) => o !== e);
  }
  dropGem(x, z, v) {
    // 설탕 결정이 너무 많으면 오래된 것끼리 합친다
    if (this.gems.length > 360) { const a = this.gems.shift(), b = this.gems.shift(); this.gemRm.push(a.id, b.id); this.dropGem(b.x, b.z, a.v + b.v); }
    const g = { id: this.nid++, x, z, v, fly: 0 };
    this.gems.push(g); this.gemAdd.push(g);
  }
  dropItem(x, z, k) { this.items.push({ id: this.nid++, x, z, k }); }
  pickups(dt) {
    const A = this.alive();
    if (!A.length) return;
    const keep = [];
    for (const g of this.gems) {
      let P = null, bd = Infinity;
      for (const Q of A) { const d = dist2(g, Q); if (d < bd) { bd = d; P = Q; } }
      const m = this.magnet(P);
      if (g.fly || bd < m * m) {
        g.fly = 1; const d = Math.sqrt(bd) || 1, sp = Math.min(d / dt, 14 + (g.sp = (g.sp || 0) + dt * 30));
        g.x += ((P.x - g.x) / d) * sp * dt; g.z += ((P.z - g.z) / d) * sp * dt;
        if (d < 0.6) { this.gainXp(P, g.v); this.gemRm.push(g.id); continue; }
      }
      keep.push(g);
    }
    this.gems = keep;
    this.items = this.items.filter((it) => {
      const P = A.find((Q) => dist2(it, Q) < 1.3 * 1.3); if (!P) return true;
      if (it.k === 'cake') P.hp = Math.min(this.maxHp(P), P.hp + this.maxHp(P) * 0.35);
      else if (it.k === 'magnet') for (const g of this.gems) g.fly = 1;
      else if (it.k === 'chest') { P.pending++; if (!P.choices) { P.choices = this.rollChoices(P); P.choiceT = 0; } }
      this.ev.push(['item', P.id, it.k]);
      return false;
    });
  }
  checkEnd() {
    if (this.win) { this.endT = this.endT || this.t; if (this.t - this.endT > 2.5) this.over = true; return; }
    const all = [...this.players.values()];
    if (all.length && all.every((P) => P.st !== 0)) {
      // 모두 쓰러졌으면 끝 (쓰러진 사람도 탈락으로)
      for (const P of all) if (P.st === 1) { P.st = 2; P.deathT = this.t; }
      this.endT = this.endT || this.t; if (this.t - this.endT > 1.5) this.over = true;
    }
  }
  // ---------- 결과 · 화면에 보낼 것 ----------
  result() {
    return [...this.players.values()].map((P) => ({ id: P.id, name: P.name, color: P.color, kills: P.kills, dmg: Math.round(P.dmg), lvl: P.lvl, time: Math.round(P.st === 2 ? P.deathT : this.t), alive: P.st === 0 }))
      .sort((a, b) => b.kills - a.kills).map((e, i) => ({ ...e, rank: i + 1 }));
  }
  // 같이 하기 스냅샷: 숫자 배열로 작게 (위치는 0.1m 단위)
  snapshot() {
    const q = (v) => Math.round(v * 10);
    const e = []; for (const o of this.enemies) e.push(o.id, E_KEYS.indexOf(o.type), q(o.x), q(o.z), Math.max(1, Math.round((o.hp / o.maxHp) * 100)), (o.elite ? 1 : 0) | (o.flash > 0 ? 2 : 0) | (o.slowT > 0 ? 4 : 0) | (o.dashT > 0 ? 8 : 0));
    const p = []; for (const o of this.projs) p.push(o.id, P_KINDS.indexOf(o.k), q(o.x), q(o.z), Math.round((o.a || 0) * 100), q(o.r));
    for (const o of this.shots) p.push(o.id, 4, q(o.x), q(o.z), 0, q(o.r));
    const pl = [...this.players.values()].map((P) => [P.id, q(P.x), q(P.z), Math.round(P.face * 100), Math.ceil(P.hp), this.maxHp(P), P.lvl, P.xp, P.xpNext, P.st, Math.round(P.rev * 100), P.kills, P.hurtT > 0 ? 1 : 0, Object.entries(P.w).map(([k, l]) => k + l).join(','), Object.entries(P.p).map(([k, l]) => k + l).join(',')]);
    const s = { tm: Math.round(this.t * 100), lv: this.lv(), e, p, pl, ga: this.gemAdd.map((g) => [g.id, q(g.x), q(g.z), g.v]), gr: this.gemRm, gf: this.gems.filter((g) => g.fly).flatMap((g) => [g.id, q(g.x), q(g.z)]), it: this.items.map((i) => [i.id, q(i.x), q(i.z), i.k]), pu: this.puddles.map((u) => [u.id, q(u.x), q(u.z), q(u.r)]), ev: this.ev };
    this.gemAdd = []; this.gemRm = []; this.ev = [];
    return s;
  }
  // 줄이 바뀐 설탕 결정 (혼자 하기 화면: 매 프레임)
  drain() { const out = { ga: this.gemAdd, gr: this.gemRm, ev: this.ev }; this.gemAdd = []; this.gemRm = []; this.ev = []; return out; }
  // 처음 들어오거나 다시 맞출 때: 모든 설탕 결정
  allGems() { return this.gems.map((g) => [g.id, Math.round(g.x * 10), Math.round(g.z * 10), g.v]); }
}
