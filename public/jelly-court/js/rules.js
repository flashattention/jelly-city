// 젤리궁정 규칙 (서버 · 화면 · 시뮬레이션이 같이 쓴다 · 화면 코드 없음)
//   숨은 역할 카드 대결: 👑 젤리왕(모두 공개) · 🛡️ 근위대 · 😈 말썽꾼 · 🦊 여우
//   차례마다 설탕 🍬 을 받아 카드값을 내고 쓴다 · 자리(원형)가 가까울수록 던지기 쉽다
export const TURN_MS = 30000, REACT_MS = 7000, MELT_ROUND = 8, SUGAR_MAX = 6, START_HAND = 4, HAND_MAX = 6;

export const CARDS = {
  throw: { n: '젤리 던지기', e: '🍮', cost: 1, tg: 'range', cnt: 28, d: '사거리 안의 한 명에게 피해 1 · 방울 막기로 막을 수 있어요' },
  block: { n: '방울 막기', e: '🫧', cost: 0, tg: 'react', cnt: 11, d: '공격받을 때 저절로 물어봐요 · 피해 1 을 막아요' },
  syrup: { n: '딸기 시럽', e: '🍓', cost: 1, tg: 'self', cnt: 6, d: '내 말랑함 ❤️ 1 회복' },
  cake: { n: '파티 케이크', e: '🎂', cost: 2, tg: 'none', cnt: 2, d: '살아 있는 모두 ❤️ 1 회복' },
  soda: { n: '탄산 폭탄', e: '💥', cost: 3, tg: 'none', cnt: 3, d: '나를 뺀 모두에게 피해 1 · 각자 방울 막기로 막을 수 있어요' },
  spicy: { n: '매운 젤리', e: '🌶️', cost: 3, tg: 'any', cnt: 3, d: '거리 상관없이 한 명에게 피해 1 · 막을 수 없어요' },
  honey: { n: '끈적 꿀', e: '🍯', cost: 1, tg: 'range', cnt: 4, d: '사거리 안의 한 명은 다음 차례에 설탕을 못 받아요' },
  grab: { n: '슬쩍', e: '🧲', cost: 1, tg: 'near', cnt: 5, d: '거리 1 안의 한 명에게서 카드 1장을 몰래 가져와요' },
  sugar: { n: '설탕 충전', e: '🍬', cost: 0, tg: 'none', cnt: 5, d: '설탕 🍬 +2' },
  peek: { n: '수정 젤리', e: '🔮', cost: 2, tg: 'any', cnt: 3, d: '한 명의 숨은 역할을 나만 몰래 봐요' },
  swap: { n: '자리 바꾸기', e: '🔄', cost: 1, tg: 'adj', cnt: 3, d: '바로 옆자리 사람과 자리를 바꿔요 (거리가 달라져요)' },
  gift: { n: '선물 상자', e: '🎁', cost: 1, tg: 'none', cnt: 4, d: '카드 2장 뽑기' },
  sling: { n: '젤리 새총', e: '🪃', cost: 1, eq: 'tool', range: 2, cnt: 3, d: '도구 · 던지기 사거리 2' },
  cannon: { n: '젤리 대포', e: '🎯', cost: 2, eq: 'tool', range: 3, cnt: 2, d: '도구 · 던지기 사거리 3' },
  ladle: { n: '큰 국자', e: '🥄', cost: 1, eq: 'tool', range: 1, cnt: 2, d: '도구 · 젤리 던지기가 설탕 0' },
  coat: { n: '솜사탕 갑옷', e: '🧥', cost: 1, eq: 'coat', cnt: 2, d: '옷 · 다른 사람이 볼 때 나와의 거리 +1' },
  bell: { n: '경보 종', e: '🔔', cost: 1, eq: 'coat', cnt: 2, d: '옷 · 피해를 받을 때마다 카드 1장' },
  helmet: { n: '푸딩 투구', e: '🪖', cost: 2, eq: 'coat', cnt: 2, d: '옷 · 내 차례 사이에 처음 받는 피해 1 을 막아요' },
};
export const CHARS = {
  bear: { n: '곰젤리', e: '🐻', d: '말랑함 ❤️ +1' },
  berry: { n: '딸기젤리', e: '🍓', d: '딸기 시럽으로 ❤️ 2 회복' },
  soda: { n: '소다젤리', e: '🥤', d: '차례마다 설탕 🍬 +1 더' },
  grape: { n: '포도젤리', e: '🍇', d: '던지기 사거리 +1' },
  lemon: { n: '레몬젤리', e: '🍋', d: '피해를 받으면 카드 1장' },
  mint: { n: '민트젤리', e: '🌿', d: '방울 막기를 쓰면 카드 1장' },
  peach: { n: '복숭아젤리', e: '🍑', d: '슬쩍을 거리 상관없이' },
  choco: { n: '초코젤리', e: '🍫', d: '내 던지기가 막히면 설탕 🍬 1 돌려받기' },
  blue: { n: '블루베리젤리', e: '🫐', d: '손패 한도 +3 · 처음 카드 +1' },
};
export const ROLES = {
  king: { n: '젤리왕', e: '👑', team: 'kingdom', d: '모두에게 공개돼요 · 말썽꾼과 여우를 모두 녹이면 승리 · 인원이 많으면 ❤️ 더' },
  guard: { n: '근위대', e: '🛡️', team: 'kingdom', d: '젤리왕을 지켜요 · 왕과 함께 승리' },
  rebel: { n: '말썽꾼', e: '😈', team: 'rebel', d: '젤리왕을 녹이면 승리 (말썽꾼끼리도 서로 몰라요)' },
  fox: { n: '여우', e: '🦊', team: 'fox', d: '혼자 편 · 내 손으로 두 명을 녹이면 바로 승리 · 마지막까지 남아도 승리' },
};
export const KING_BONUS = { 4: 0, 5: 0, 6: 2, 7: 1 }; // 인원마다 왕의 말랑함 더하기 (봇 시뮬레이션으로 맞춤)
export const ROLESET = { 4: ['king', 'guard', 'rebel', 'rebel'], 5: ['king', 'guard', 'rebel', 'rebel', 'fox'], 6: ['king', 'guard', 'rebel', 'rebel', 'rebel', 'fox'], 7: ['king', 'guard', 'guard', 'rebel', 'rebel', 'rebel', 'fox'] };

const shuffle = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// players: [{ id, name, color, bot, look }]
export function newGame(players, R = Math.random, now = 0) {
  const roles = shuffle([...ROLESET[players.length]], R);
  const charKeys = shuffle(Object.keys(CHARS), R);
  const ps = shuffle(players.slice(), R);
  const seats = ps.map((p, i) => {
    const role = roles[i], ch = charKeys[i % charKeys.length];
    const max = 3 + (role === 'king' ? KING_BONUS[players.length] : 0) + (ch === 'bear' ? 1 : 0);
    return { id: p.id, name: p.name, color: p.color, look: p.look || null, bot: !!p.bot, role, ch, hp: max, max, sugar: 0, hand: [], eq: { tool: null, coat: null }, alive: true, kills: 0, sticky: false, helm: false, known: new Set(), shown: false };
  });
  const k = seats.findIndex((s) => s.role === 'king');
  const order = seats.map((_, i) => (i + k) % seats.length); // 왕부터 시계 방향
  let nid = 1;
  const deck = [];
  for (const [key, c] of Object.entries(CARDS)) for (let i = 0; i < c.cnt; i++) deck.push({ id: nid++, k: key });
  const G = { seats, order, deck: shuffle(deck, R), pile: [], turn: order[0], round: 1, phase: 'play', pend: null, deadline: 0, log: [], ev: [], win: null, sus: seats.map(() => 0), R, turns: 0 };
  for (const s of seats) draw(G, s, START_HAND + (s.ch === 'blue' ? 1 : 0));
  startTurn(G, now, true);
  return G;
}

// ---------- 도우미 ----------
export const alive = (G) => G.order.filter((i) => G.seats[i].alive);
function draw(G, s, n) {
  for (let k = 0; k < n; k++) {
    if (!G.deck.length) { G.deck = shuffle(G.pile, G.R); G.pile = []; if (!G.deck.length) return; }
    s.hand.push(G.deck.pop());
  }
}
const log = (G, s) => { G.log.push(s); if (G.log.length > 40) G.log.shift(); };
const nm = (G, i) => G.seats[i].name;
// 원형 자리 거리 (살아 있는 사람끼리) + 상대의 솜사탕 갑옷
export function dist(G, a, b) {
  if (a === b) return 0;
  const al = alive(G), ia = al.indexOf(a), ib = al.indexOf(b);
  if (ia < 0 || ib < 0) return 99;
  const d = Math.abs(ia - ib), base = Math.min(d, al.length - d);
  return base + (G.seats[b].eq.coat?.k === 'coat' ? 1 : 0);
}
export function range(G, i) { const s = G.seats[i]; return (s.eq.tool ? CARDS[s.eq.tool.k].range : 1) + (s.ch === 'grape' ? 1 : 0); }
export function adjacent(G, a, b) { const al = alive(G), ia = al.indexOf(a), ib = al.indexOf(b); if (ia < 0 || ib < 0 || a === b) return false; const d = Math.abs(ia - ib); return d === 1 || d === al.length - 1; }
export function costOf(G, i, card) { const s = G.seats[i]; if (card.k === 'throw' && s.eq.tool?.k === 'ladle') return 0; return CARDS[card.k].cost; }
// 이 카드를 쓸 수 있는 대상 (없으면 [] · 대상이 필요 없으면 null)
export function targets(G, i, card) {
  const c = CARDS[card.k], others = alive(G).filter((j) => j !== i);
  switch (c.tg) {
    case 'range': return others.filter((j) => dist(G, i, j) <= range(G, i));
    case 'any': return others;
    case 'near': return G.seats[i].ch === 'peach' ? others.filter((j) => G.seats[j].hand.length || G.seats[j].eq.tool || G.seats[j].eq.coat) : others.filter((j) => dist(G, i, j) <= 1);
    case 'adj': return others.filter((j) => adjacent(G, i, j));
    default: return null;
  }
}
export function canPlay(G, i, card) {
  if (G.phase !== 'play' || G.turn !== i || G.win) return false;
  const c = CARDS[card.k];
  if (c.tg === 'react') return false;
  if (costOf(G, i, card) > G.seats[i].sugar) return false;
  if (c.tg === 'self' && G.seats[i].hp >= G.seats[i].max) return false;
  const t = targets(G, i, card);
  return t === null || t.length > 0;
}

// ---------- 차례 ----------
function startTurn(G, now, first) {
  const s = G.seats[G.turn];
  G.phase = 'play'; G.deadline = now + TURN_MS; G.turns++;
  s.helm = s.eq.coat?.k === 'helmet';
  if (G.round >= MELT_ROUND) {
    log(G, `🫠 ${s.name}: 젤리가 녹기 시작했어요 (${MELT_ROUND}바퀴부터)`);
    hurt(G, G.turn, 1, -1, true);
    if (G.win) return;
    if (!s.alive) return nextTurn(G, now);
  }
  if (s.sticky) { s.sticky = false; log(G, `🍯 ${s.name}: 꿀에 붙어서 설탕을 못 받았어요`); }
  else s.sugar = Math.min(SUGAR_MAX, s.sugar + 2 + (s.ch === 'soda' ? 1 : 0));
  draw(G, s, 2);
  G.ev.push({ k: 'turn', i: G.turn });
  if (!first) log(G, `▶️ ${s.name} 차례`);
}
function nextTurn(G, now) {
  const pos = G.order.indexOf(G.turn);
  for (let k = 1; k <= G.order.length; k++) {
    const p = (pos + k) % G.order.length;
    const i = G.order[p];
    if (G.seats[i].alive) {
      if (pos + k >= G.order.length) G.round++;
      G.turn = i; return startTurn(G, now);
    }
  }
}
export function endTurn(G, i, now) {
  const s = G.seats[i];
  const lim = HAND_MAX + (s.ch === 'blue' ? 3 : 0);
  while (s.hand.length > lim) { // 넘치면 덜 중요한 카드부터 버린다
    const order = ['gift', 'peek', 'swap', 'honey', 'grab', 'cake', 'sugar', 'sling', 'ladle', 'coat', 'bell', 'cannon', 'helmet', 'spicy', 'soda', 'syrup', 'throw', 'block'];
    s.hand.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
    G.pile.push(s.hand.shift());
  }
  nextTurn(G, now);
}

// ---------- 피해 · 녹기 · 승리 ----------
function hurt(G, t, n, from, melt) {
  const s = G.seats[t];
  if (!s.alive) return;
  if (s.helm && !melt) { s.helm = false; G.ev.push({ k: 'helm', i: t }); log(G, `🪖 ${s.name}의 푸딩 투구가 막았어요`); return; }
  s.hp -= n;
  G.ev.push({ k: 'hit', i: t, from, n });
  if (s.hp <= 0) return die(G, t, from);
  if (s.ch === 'lemon') draw(G, s, 1);
  if (s.eq.coat?.k === 'bell') draw(G, s, 1);
}
function die(G, t, from) {
  const s = G.seats[t];
  s.alive = false; s.hp = 0; s.shown = true;
  G.pile.push(...s.hand); s.hand = [];
  for (const k of ['tool', 'coat']) if (s.eq[k]) { G.pile.push(s.eq[k]); s.eq[k] = null; }
  log(G, `💧 ${s.name} 녹아버렸어요! 정체는 ${ROLES[s.role].e} ${ROLES[s.role].n}`);
  G.ev.push({ k: 'die', i: t, role: s.role });
  if (from >= 0 && G.seats[from].alive) { const f = G.seats[from]; f.kills++; draw(G, f, 2); }
  checkWin(G, from);
}
function checkWin(G, killer) {
  const al = alive(G).map((i) => G.seats[i]);
  const king = G.seats.find((s) => s.role === 'king');
  const fox = G.seats.find((s) => s.role === 'fox');
  let win = null;
  if (fox && fox.alive && fox.kills >= 2) win = { team: 'fox', why: '🦊 여우가 두 명을 녹여서 혼자 승리!' };
  else if (!king.alive) {
    if (al.some((s) => s.role === 'rebel') || G.seats[killer]?.role === 'rebel') win = { team: 'rebel', why: '😈 젤리왕이 녹았어요! 말썽꾼 승리!' };
    else if (fox?.alive) win = { team: 'fox', why: '🦊 젤리왕까지 녹이고 여우 혼자 남았어요!' };
    else win = { team: 'rebel', why: '😈 젤리왕이 녹았어요! 말썽꾼 승리!' };
  } else if (!al.some((s) => s.role === 'rebel' || s.role === 'fox')) win = { team: 'kingdom', why: '👑 말썽꾼과 여우를 모두 물리쳤어요! 왕국 승리!' };
  if (win) { G.win = win; G.phase = 'over'; for (const s of G.seats) s.shown = true; log(G, win.why); G.ev.push({ k: 'win', team: win.team }); }
}
export const isWinner = (G, s) => G.win && (G.win.team === ROLES[s.role].team);

// ---------- 행동 ----------
// a = { t: 'play', id, to } · { t: 'end' } · { t: 'react', use }
export function act(G, i, a, now) {
  if (G.win) return false;
  const s = G.seats[i];
  if (a.t === 'react') {
    const P = G.pend; if (!P || !P.wait.includes(i)) return false;
    P.wait = P.wait.filter((j) => j !== i);
    const bi = s.hand.findIndex((c) => c.k === 'block');
    if (a.use && bi >= 0) {
      G.pile.push(s.hand.splice(bi, 1)[0]);
      if (s.ch === 'mint') draw(G, s, 1);
      G.ev.push({ k: 'block', i, from: P.from }); log(G, `🫧 ${s.name} 방울 막기!`);
      if (P.k === 'throw' && G.seats[P.from].ch === 'choco') G.seats[P.from].sugar++;
    } else hurt(G, i, 1, P.from);
    if (!P.wait.length && !G.win) { G.pend = null; G.phase = 'play'; G.deadline = Math.max(G.deadline, now + 8000); }
    return true;
  }
  if (G.phase !== 'play' || G.turn !== i || !s.alive) return false;
  if (a.t === 'end') { endTurn(G, i, now); return true; }
  if (a.t !== 'play') return false;
  const hi = s.hand.findIndex((c) => c.id === a.id);
  if (hi < 0) return false;
  const card = s.hand[hi], C = CARDS[card.k];
  if (!canPlay(G, i, card)) return false;
  const tg = targets(G, i, card);
  const to = tg === null ? -1 : Number(a.to);
  if (tg !== null && !tg.includes(to)) return false;
  s.sugar -= costOf(G, i, card);
  s.hand.splice(hi, 1);
  G.ev.push({ k: 'play', i, to, c: card.k });
  const T = to >= 0 ? G.seats[to] : null;
  if (to >= 0) {
    // 공개된 행동으로 의심 점수 (봇이 쓴다): 왕을 노리면 의심 ↑ · 의심스러운 사람을 노리면 ↓
    if (['throw', 'spicy', 'honey', 'grab'].includes(card.k)) {
      const w = card.k === 'grab' ? 0.4 : card.k === 'honey' ? 0.6 : 1;
      if (T.role === 'king') G.sus[i] += 3 * w; else G.sus[i] -= 0.6 * w * G.sus[to] - (T.shown && T.role === 'guard' ? 2 * w : 0) + (T.shown && T.role === 'rebel' ? 2 * w : 0);
    }
  }
  if (C.eq) {
    if (s.eq[C.eq]) G.pile.push(s.eq[C.eq]);
    s.eq[C.eq] = card; if (C.eq === 'coat' && card.k === 'helmet') s.helm = true;
    log(G, `${C.e} ${s.name}: ${C.n} 장착`);
    return true;
  }
  G.pile.push(card);
  log(G, `${C.e} ${s.name}${T ? ` → ${T.name}` : ''}: ${C.n}`);
  switch (card.k) {
    case 'throw': {
      if (T.hand.some((c) => c.k === 'block')) { G.pend = { k: 'throw', from: i, wait: [to], c: 'throw' }; G.phase = 'react'; G.reactAt = now + REACT_MS; }
      else hurt(G, to, 1, i);
      break;
    }
    case 'soda': {
      const wait = [];
      for (const j of alive(G)) { if (j === i) continue; if (G.seats[j].hand.some((c) => c.k === 'block')) wait.push(j); else hurt(G, j, 1, i); if (G.win) break; }
      if (wait.length && !G.win) { G.pend = { k: 'soda', from: i, wait, c: 'soda' }; G.phase = 'react'; G.reactAt = now + REACT_MS; }
      break;
    }
    case 'spicy': hurt(G, to, 1, i); break;
    case 'honey': T.sticky = true; break;
    case 'grab': {
      const pool = [...T.hand.map((c) => ['h', c]), ...(T.hand.length ? [] : ['tool', 'coat'].filter((k) => T.eq[k]).map((k) => ['e', k]))];
      if (pool.length) {
        const [w, x] = pool[Math.floor(G.R() * pool.length)];
        let got;
        if (w === 'h') { T.hand.splice(T.hand.indexOf(x), 1); got = x; } else { got = T.eq[x]; T.eq[x] = null; }
        s.hand.push(got); G.ev.push({ k: 'steal', i, from: to, c: got.k });
      }
      break;
    }
    case 'sugar': s.sugar += 2; break;
    case 'peek': s.known.add(to); G.ev.push({ k: 'peek', i, to, role: T.role }); break;
    case 'swap': {
      const a1 = G.order.indexOf(i), b1 = G.order.indexOf(to);
      [G.order[a1], G.order[b1]] = [G.order[b1], G.order[a1]];
      G.ev.push({ k: 'swap', i, to });
      break;
    }
    case 'gift': draw(G, s, 2); break;
    case 'syrup': s.hp = Math.min(s.max, s.hp + (s.ch === 'berry' ? 2 : 1)); G.ev.push({ k: 'heal', i }); break;
    case 'cake': for (const j of alive(G)) { const x = G.seats[j]; if (x.hp < x.max) { x.hp++; G.ev.push({ k: 'heal', i: j }); } } break;
  }
  return true;
}
// 시간 넘기기: 막기 대기 → 들고 있으면 저절로 막기 · 차례 시간 끝 → 다음 사람
export function tick(G, now) {
  if (G.win) return;
  if (G.phase === 'react' && G.pend && now >= G.reactAt) { for (const j of [...G.pend.wait]) act(G, j, { t: 'react', use: true }, now); return; }
  if (G.phase === 'play' && now >= G.deadline) { log(G, `⏰ ${G.seats[G.turn].name}: 시간이 다 됐어요`); endTurn(G, G.turn, now); }
}

// ---------- 봇 ----------
// 상대를 얼마나 노리고 싶은지 (+ 면 적 · - 면 편)
function want(G, i, t) {
  const me = G.seats[i], T = G.seats[t];
  const known = T.shown || T.role === 'king' || me.known.has(t) ? T.role : null;
  const sus = G.sus[t];
  switch (me.role) {
    case 'king': case 'guard':
      if (known === 'king') return -99;
      if (known === 'guard') return -5;
      if (known === 'rebel' || known === 'fox') return 5;
      return sus - 0.1;
    case 'rebel':
      if (known === 'king') return 6;
      if (known === 'rebel') return -5;
      if (known === 'guard') return 3;
      return -sus * 0.8 + 0.45;
    case 'fox': {
      const n = alive(G).length;
      if (known === 'king') return n <= 2 ? 6 : -2;
      return 1.2 - T.hp * 0.25 + (G.R() - 0.5) * 0.3 + (G.sus[t] > 1 && G.seats.find((s) => s.role === 'king').hp <= 2 ? 1 : 0);
    }
  }
  return 0;
}
export function botMove(G, i) {
  const s = G.seats[i];
  const has = (k) => s.hand.find((c) => c.k === k && canPlay(G, i, c));
  const best = (card, min = 0.3) => { const tg = targets(G, i, card) || []; let b = -1, bv = min; for (const t of tg) { const v = want(G, i, t) + (G.seats[t].hp <= 1 ? 0.6 : 0); if (v > bv) { bv = v; b = t; } } return b; };
  let c;
  if ((c = has('syrup')) && (s.hp <= 2 || s.hp < s.max - 1)) return { t: 'play', id: c.id };
  if ((c = has('cake')) && s.hp < s.max) { const al = alive(G); const v = al.reduce((a, j) => a + (G.seats[j].hp < G.seats[j].max ? (j === i ? 2 : -Math.sign(want(G, i, j))) : 0), 0); if (v > 0) return { t: 'play', id: c.id }; }
  for (const k of ['cannon', 'sling', 'helmet', 'coat', 'bell', 'ladle']) {
    if ((c = has(k))) { const C = CARDS[k], cur = s.eq[C.eq]; const rank = ['ladle', 'sling', 'cannon', 'bell', 'coat', 'helmet']; if (!cur || rank.indexOf(k) > rank.indexOf(cur.k) && C.eq === CARDS[cur.k].eq) return { t: 'play', id: c.id }; }
  }
  if ((c = has('sugar')) && s.sugar < 3) return { t: 'play', id: c.id };
  if ((c = has('gift')) && s.hand.length < 5 && s.sugar >= 2) return { t: 'play', id: c.id };
  if ((c = has('spicy'))) { const t = best(c, 1); if (t >= 0) return { t: 'play', id: c.id, to: t }; }
  if ((c = has('soda'))) { const v = alive(G).filter((j) => j !== i).reduce((a, j) => a + Math.sign(want(G, i, j)) * (G.seats[j].hp <= 1 ? 2 : 1), 0); if (v >= 1) return { t: 'play', id: c.id }; }
  if ((c = has('throw'))) { const t = best(c, G.round >= 3 ? -0.2 : 0.2); if (t >= 0) return { t: 'play', id: c.id, to: t }; }
  if ((c = has('honey'))) { const t = best(c, 0.8); if (t >= 0) return { t: 'play', id: c.id, to: t }; }
  if ((c = has('grab'))) { const t = best(c, s.hand.length < 3 ? -0.5 : 0.5); if (t >= 0) return { t: 'play', id: c.id, to: t }; }
  if ((c = has('peek')) && s.sugar >= 3) { const unk = alive(G).filter((j) => j !== i && !G.seats[j].shown && G.seats[j].role !== 'king' && !s.known.has(j)); if (unk.length) { unk.sort((a, b) => Math.abs(G.sus[b]) - Math.abs(G.sus[a])); return { t: 'play', id: c.id, to: unk[0] }; } }
  if ((c = has('swap'))) {
    // 노리는 사람이 사거리 밖이면 자리를 바꿔 다가간다
    const foes = alive(G).filter((j) => j !== i && want(G, i, j) > 1 && dist(G, i, j) > range(G, i));
    if (foes.length && s.hand.some((x) => x.k === 'throw')) { const tg = targets(G, i, c); for (const t of tg) { const o = G.order.slice(); const a1 = o.indexOf(i), b1 = o.indexOf(t); [G.order[a1], G.order[b1]] = [G.order[b1], G.order[a1]]; const ok = foes.some((f) => dist(G, i, f) <= range(G, i)); G.order = o; if (ok && want(G, i, t) > -3) return { t: 'play', id: c.id, to: t }; } }
  }
  return { t: 'end' };
}

// ---------- 화면에 보낼 내용 (나만 아는 것은 나에게만) ----------
export function view(G, me, now) {
  const al = alive(G);
  const S = G.seats[me];
  return {
    me, turn: G.turn, phase: G.phase, round: G.round, melt: MELT_ROUND, left: Math.max(0, (G.phase === 'react' ? G.reactAt : G.deadline) - now),
    order: G.order, deck: G.deck.length, top: G.pile.length ? G.pile[G.pile.length - 1].k : null, log: G.log.slice(-14), win: G.win,
    pend: G.pend ? { k: G.pend.k, from: G.pend.from, wait: G.pend.wait } : null,
    seats: G.seats.map((s, i) => ({
      id: s.id, name: s.name, color: s.color, look: s.look, bot: s.bot, ch: s.ch, hp: s.hp, max: s.max, sugar: s.sugar, n: s.hand.length,
      eq: { tool: s.eq.tool?.k || null, coat: s.eq.coat?.k || null }, alive: s.alive, kills: s.kills, sticky: s.sticky, helm: s.helm,
      role: i === me || s.shown || s.role === 'king' || (me >= 0 && S.known.has(i)) ? s.role : null,
      d: me >= 0 && s.alive && al.includes(me) ? dist(G, me, i) : null,
    })),
    hand: me >= 0 ? S.hand.map((c) => ({ id: c.id, k: c.k, ok: canPlay(G, me, c), cost: costOf(G, me, c), tg: targets(G, me, c) })) : [],
    range: me >= 0 ? range(G, me) : 0,
  };
}
