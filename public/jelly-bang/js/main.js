// 젤리뱅: 숨은 역할 카드 대결 (4~7명 · 모자라면 젤리봇) · 규칙 판정은 서버, 화면은 받은 판을 그린다
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti } from '../../shared/js/party.js';
import { CARDS, CHARS, ROLES, MELT_ROUND, HAND_MAX, SUGAR_MAX } from './rules.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellybang');
const PICK_KEY = 'jellybang.pick';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.bang = { mode: 'title', g: null, myId: 0, me: -1, aim: null, pick: { bots: Math.max(3, Math.min(6, pick0.bots ?? 4)) }, deadline: 0, reactEnd: 0, lastTurn: -1, practice: false };

for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// 카드 갈래 (색)
const KIND = { throw: 'atk', spicy: 'atk', soda: 'atk', honey: 'trick', grab: 'trick', swap: 'trick', peek: 'trick', block: 'def', syrup: 'heal', cake: 'heal', sugar: 'util', gift: 'util', sling: 'eq', cannon: 'eq', ladle: 'eq', coat: 'eq', bell: 'eq', helmet: 'eq' };
const cardHtml = (k, extra = '', cost) => { const C = CARDS[k]; return `<div class="jcard ${KIND[k]} ${extra}" title="${esc(C.d)}"><span class="cost">${C.tg === 'react' ? '막기' : `🍬${cost ?? C.cost}`}</span><span class="em">${C.e}</span><b>${C.n}</b><small>${C.d}</small></div>`; };
const roleTag = (r) => (r ? `<span class="role r-${r}" title="${esc(ROLES[r].d)}">${ROLES[r].e} ${ROLES[r].n}</span>` : '<span class="role r-unk" title="숨은 역할">❔ 비밀</span>');

// ---------- 규칙 창 ----------
function rulesHtml() {
  const sec = (t, body) => `<h3>${t}</h3>${body}`;
  return sec('🎯 목표', `<p>모두 몰래 역할을 하나씩 받아요. <b>👑 젤리왕</b>만 모두에게 공개!</p><div class="rgrid">${Object.entries(ROLES).map(([k, r]) => `<div class="rbox r-${k}"><b>${r.e} ${r.n}</b><span>${r.d}</span></div>`).join('')}</div>`)
    + sec('🔁 내 차례', `<ol><li>설탕 🍬 +2 (최대 ${SUGAR_MAX}) · 카드 2장 뽑기</li><li>설탕을 내고 카드를 원하는 만큼 써요 (카드 왼쪽 위 숫자가 값)</li><li><b>⏭️ 차례 끝</b> (30초 지나면 저절로) · 손패는 ${HAND_MAX}장까지</li></ol>`)
    + sec('📏 거리', '<p>둥근 탁자에서 몇 자리 떨어졌는지가 <b>거리</b>예요 (가까운 쪽으로). 젤리 던지기는 <b>사거리</b> 안에만 닿아요 — 기본 1, 새총 · 대포로 늘어요. 녹은 사람 자리는 빠져서 더 가까워져요.</p>')
    + sec('🫧 막기', '<p>누가 나를 노리면 방울 막기를 쓸지 물어봐요 (7초 · 그냥 두면 저절로 막아요).</p>')
    + sec('🫠 녹는 시간', `<p>${MELT_ROUND}바퀴째부터는 차례가 올 때마다 말랑함 ❤️ 1 씩 녹아요. 서둘러요!</p><p>누군가를 녹이면 카드 2장을 받아요. 녹은 사람의 역할은 모두에게 공개돼요.</p>`)
    + sec('🃏 카드', `<div class="rcards">${Object.keys(CARDS).map((k) => cardHtml(k, 'mini')).join('')}</div>`)
    + sec('🍬 젤리 캐릭터 (한 명씩 무작위)', `<div class="rgrid">${Object.values(CHARS).map((c) => `<div class="rbox"><b>${c.e} ${c.n}</b><span>${c.d}</span></div>`).join('')}</div>`);
}
$('rules-body').innerHTML = rulesHtml();
const openRules = () => { $('rules').classList.remove('hidden'); };
$('rules-x').onclick = () => $('rules').classList.add('hidden');
$('b-rules').onclick = openRules;

// ---------- 탁자 ----------
const seatEls = new Map();
function seatPos(g) {
  // 내 자리가 맨 아래 · 시계 방향(다음 사람이 왼쪽)
  const n = g.order.length, k0 = Math.max(0, g.order.indexOf(game.me));
  const T = $('table').getBoundingClientRect();
  const rx = T.width / 2 - (innerWidth < 700 ? 52 : 92), ry = T.height / 2 - (innerWidth < 700 ? 58 : 74);
  const pos = new Map();
  g.order.forEach((si, k) => { const a = Math.PI / 2 + ((k - k0 + n) % n) * (Math.PI * 2 / n); pos.set(si, [T.width / 2 + rx * Math.cos(a), T.height / 2 + ry * Math.sin(a)]); });
  return pos;
}
function renderSeats(g) {
  const pos = seatPos(g), myCard = game.aim;
  for (const [i, s] of g.seats.entries()) {
    let el = seatEls.get(i);
    if (!el) { el = document.createElement('div'); el.className = 'seat'; el.dataset.i = i; el.onclick = () => clickSeat(i); $('seats').appendChild(el); seatEls.set(i, el); }
    const [x, y] = pos.get(i) || [0, 0];
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    const C = CHARS[s.ch];
    const hearts = Array.from({ length: s.max }, (_, k) => `<i class="${k < s.hp ? 'on' : ''}"></i>`).join('');
    const eq = ['tool', 'coat'].map((k) => s.eq[k] ? `<span class="eqc" title="${esc(CARDS[s.eq[k]].n)} · ${esc(CARDS[s.eq[k]].d)}">${CARDS[s.eq[k]].e}</span>` : '').join('');
    el.className = `seat${i === g.turn && !g.win ? ' turn' : ''}${i === game.me ? ' me' : ''}${s.alive ? '' : ' dead'}${myCard ? (myCard.tg?.includes(i) ? ' tgt' : ' dim') : ''}${g.pend?.wait.includes(i) ? ' wait' : ''}`;
    el.innerHTML = `<div class="av">${faceHtml(s, innerWidth < 700 ? 38 : 50)}<span class="ch" title="${esc(C.n)}: ${esc(C.d)}">${C.e}</span>${s.sticky ? '<span class="stk" title="끈적 꿀: 다음 차례 설탕 없음">🍯</span>' : ''}</div>
      <div class="nm">${s.bot ? '🤖' : ''}${esc(s.name)}</div>
      ${roleTag(s.role)}
      <div class="hp">${hearts}</div>
      <div class="meta"><span title="설탕">🍬${s.sugar}</span><span title="손패">🂠${s.n}</span>${eq}${s.kills ? `<span title="녹인 수">💧${s.kills}</span>` : ''}</div>
      ${s.d != null && i !== game.me && s.alive ? `<div class="dist${s.d <= g.range ? ' near' : ''}" title="나와의 거리 (내 사거리 ${g.range})">거리 ${s.d}</div>` : ''}`;
  }
}
function render() {
  const g = game.g; if (!g) return;
  renderSeats(g);
  $('deck-n').textContent = g.deck;
  $('pile').innerHTML = g.top ? cardHtml(g.top, 'mini') : '';
  $('round').innerHTML = `${g.round}바퀴째 ${g.round >= MELT_ROUND ? '<b class="melt">🫠 녹는 중!</b>' : `<small>· ${MELT_ROUND}바퀴부터 녹아요</small>`}`;
  const me = g.seats[game.me], myTurn = g.turn === game.me && g.phase === 'play' && !g.win && me?.alive;
  const cur = g.seats[g.turn];
  $('banner').innerHTML = (g.win ? `<b>${esc(g.win.why)}</b>` : g.phase === 'react' ? `🫧 막기를 기다리는 중…` : myTurn ? '<b class="mine">✨ 내 차례예요!</b>' : `${esc(cur.name)} 차례`)
    + (innerWidth <= 900 && g.log.length ? `<div class="last">${esc(g.log[g.log.length - 1])}</div>` : '');
  // 내 역할 · 캐릭터
  if (me) {
    const R = ROLES[me.role], C = CHARS[me.ch];
    $('myrole').innerHTML = `<div class="r r-${me.role}">${R.e} <b>${R.n}</b></div><div class="rd">${R.d}</div><div class="cd">${C.e} ${C.n} · ${C.d}</div><div class="rg">🎯 내 사거리 ${g.range}</div>`;
  }
  // 손패
  $('hand').innerHTML = g.hand.map((c) => `<div class="hslot" data-id="${c.id}">${cardHtml(c.k, `${myTurn && c.ok ? 'ok' : 'off'}${game.aim?.id === c.id ? ' sel' : ''}`, c.cost)}</div>`).join('') || '<div class="nohand">손패가 없어요</div>';
  $('hand').querySelectorAll('.hslot').forEach((el) => { el.onclick = () => clickCard(+el.dataset.id); });
  $('end-btn').disabled = !myTurn;
  $('log').innerHTML = g.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join('');
  // 막기
  const ask = g.pend?.wait.includes(game.me);
  $('react').classList.toggle('hidden', !ask);
  if (ask) { const f = g.seats[g.pend.from]; $('react-txt').innerHTML = `${CARDS[g.pend.k].e} <b>${esc(f.name)}</b>의 <b>${CARDS[g.pend.k].n}</b>!<br>🫧 방울 막기를 쓸까요?`; }
}
// ---------- 고르기 ----------
function clickCard(id) {
  const g = game.g; if (!g) return;
  const c = g.hand.find((x) => x.id === id);
  if (!c) return;
  if (g.turn !== game.me || g.phase !== 'play') return shell.toast(c.k === 'block' ? '🫧 방울 막기는 공격받을 때 저절로 물어봐요' : '내 차례에만 쓸 수 있어요');
  if (!c.ok) { S.sfx('bad'); return shell.toast(c.k === 'block' ? '🫧 방울 막기는 공격받을 때 써요' : c.cost > g.seats[game.me].sugar ? `🍬 설탕이 모자라요 (${c.cost} 필요)` : c.tg && !c.tg.length ? '닿는 사람이 없어요 (거리를 확인해요)' : '지금은 쓸 수 없어요'); }
  if (game.aim?.id === id) return cancelAim();
  if (c.tg === null) { S.sfx('swish'); shell.send({ t: 'play', id }); cancelAim(); return; }
  game.aim = c; S.sfx('tick', 4);
  $('aim').classList.remove('hidden');
  $('aim-txt').innerHTML = `${CARDS[c.k].e} <b>${CARDS[c.k].n}</b> — 빛나는 사람을 눌러요`;
  render();
}
function clickSeat(i) {
  const c = game.aim; if (!c) return;
  if (!c.tg.includes(i)) { S.sfx('bad'); return shell.toast('그 사람에게는 쓸 수 없어요'); }
  S.sfx('swish'); shell.send({ t: 'play', id: c.id, to: i }); cancelAim();
}
function cancelAim() { game.aim = null; $('aim').classList.add('hidden'); render(); }
$('aim-x').onclick = cancelAim;
$('end-btn').onclick = () => { cancelAim(); shell.send({ t: 'end' }); };
$('r-yes').onclick = () => { shell.send({ t: 'react', use: true }); $('react').classList.add('hidden'); };
$('r-no').onclick = () => { shell.send({ t: 'react', use: false }); $('react').classList.add('hidden'); };
window.addEventListener('contextmenu', (e) => { if (game.aim) { e.preventDefault(); cancelAim(); } });

// ---------- 움직임 ----------
const center = (i) => { const el = seatEls.get(i), T = $('table').getBoundingClientRect(); if (!el) return [T.width / 2, T.height / 2]; return [parseFloat(el.style.left), parseFloat(el.style.top)]; };
function fly(k, from, to) {
  const [x0, y0] = center(from), T = $('table').getBoundingClientRect();
  const [x1, y1] = to >= 0 ? center(to) : [T.width / 2, T.height / 2];
  const f = document.createElement('div'); f.className = `flyer ${KIND[k]}`; f.textContent = CARDS[k].e;
  f.style.left = `${x0}px`; f.style.top = `${y0}px`;
  $('flyer-layer').appendChild(f);
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) rotate(${(Math.random() - 0.5) * 60}deg) scale(1.2)`; f.style.opacity = '0.95'; }));
  setTimeout(() => { f.style.opacity = '0'; }, 520); setTimeout(() => f.remove(), 900);
}
function pop(i, txt, cls, delay = 0) {
  setTimeout(() => {
    const [x, y] = center(i), p = document.createElement('div'); p.className = `popt ${cls}`; p.textContent = txt; p.style.left = `${x}px`; p.style.top = `${y - 30}px`;
    $('flyer-layer').appendChild(p); setTimeout(() => p.remove(), 1300);
    const el = seatEls.get(i); if (el && cls) { el.classList.remove(`fx-${cls}`); void el.offsetWidth; el.classList.add(`fx-${cls}`); }
  }, delay);
}
function events(ev, g) {
  for (const e of ev) {
    switch (e.k) {
      case 'play': fly(e.c, e.i, e.to); if (KIND[e.c] === 'eq') S.sfx('lvl'); else S.sfx(e.c === 'soda' ? 'boom' : 'swish'); break;
      case 'hit': pop(e.i, '-1 💔', 'hit', 380); setTimeout(() => S.sfx('hurt'), 380); break;
      case 'block': pop(e.i, '🫧 막음!', 'block', 380); setTimeout(() => S.sfx('pop'), 380); break;
      case 'helm': pop(e.i, '🪖 막음!', 'block', 380); break;
      case 'heal': pop(e.i, '+❤️', 'heal', 300); S.sfx('heart'); break;
      case 'steal': pop(e.i, e.c ? `🧲 ${CARDS[e.c].e}` : '🧲', 'heal', 380); if (e.from === game.me && e.c) shell.toast(`🧲 ${g.seats[e.i].name}이(가) 내 ${CARDS[e.c].n}을(를) 가져갔어요`, 2200); break;
      case 'peek': if (e.i === game.me) { const R = ROLES[e.role]; shell.toast(`🔮 ${g.seats[e.to].name}의 정체는… ${R.e} ${R.n}!`, 3600); S.sfx('lvl'); } break;
      case 'swap': S.sfx('page'); break;
      case 'die': pop(e.i, `💧 ${ROLES[e.role].e}`, 'die', 450); setTimeout(() => S.sfx('miss'), 450); break;
      case 'turn': if (e.i === game.me) { S.sfx('turn'); shell.toast('✨ 내 차례! 설탕 +2 · 카드 2장', 1400); } break;
      case 'win': { const me = g.seats[game.me]; if (me?.role && ROLES[me.role].team === e.team) { confetti(); S.sfx('win'); } else S.sfx('lose'); break; }
    }
  }
}

// ---------- 시간 ----------
let lastSec = -1;
function frame() {
  requestAnimationFrame(frame);
  const g = game.g; if (game.mode !== 'play' || !g) return;
  const now = performance.now();
  const total = g.phase === 'react' ? 7000 : 30000, left = Math.max(0, game.deadline - now);
  $('timer').firstElementChild.style.width = `${Math.min(100, (left / total) * 100)}%`;
  $('timer').classList.toggle('hurry', left < 6000 && g.phase === 'play');
  if (g.phase === 'react') $('react-bar').style.width = `${Math.min(100, (left / 7000) * 100)}%`;
  const sec = Math.ceil(left / 1000);
  if (sec !== lastSec && sec <= 5 && sec > 0 && g.turn === game.me && g.phase === 'play') S.sfx('clock');
  lastSec = sec;
}
requestAnimationFrame(frame);
new ResizeObserver(() => { if (game.g) renderSeats(game.g); }).observe($('table'));

// ---------- 흐름 ----------
function countdown(ms) {
  const el = $('count'), n = $('count-n');
  el.classList.remove('hidden');
  const t0 = performance.now();
  const tickC = () => {
    const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000);
    if (left <= 0) { n.textContent = '뱅!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 500); return; }
    if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); }
    setTimeout(tickC, 60);
  };
  tickC();
}
function startGame(m) {
  game.mode = 'play'; game.g = null; game.myId = shell.myId; game.aim = null;
  for (const el of seatEls.values()) el.remove(); seatEls.clear();
  $('hand').innerHTML = ''; $('log').innerHTML = ''; $('myrole').innerHTML = ''; $('banner').textContent = '역할을 나누는 중…';
  shell.hideScreens(); $('game').classList.remove('hidden');
  countdown(m.in); S.sfx('start'); S.music('word');
}
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden'); $('react').classList.add('hidden'); cancelAimQuiet();
  const win = m.win, mine = m.seats.find((s) => s.id === game.myId);
  const iWon = mine && win && ROLES[mine.role].team === win.team;
  $('ov-title').textContent = win ? win.why : '끝!';
  $('ov-me').innerHTML = mine ? `나는 ${ROLES[mine.role].e} ${ROLES[mine.role].n} — ${iWon ? '<b class="w">🎉 승리!</b>' : '아쉽게 졌어요'}` : '';
  $('ov-rank').innerHTML = m.seats.slice().sort((a, b) => (ROLES[b.role].team === win?.team) - (ROLES[a.role].team === win?.team)).map((s) => {
    const w = win && ROLES[s.role].team === win.team;
    return `<div class="res-row${s.id === game.myId ? ' me' : ''}${w ? ' won' : ''}"><span class="rk">${w ? '🏆' : s.alive ? '🙂' : '💧'}</span>${faceHtml(s, 40)}<span class="nm">${s.bot ? '🤖 ' : ''}${esc(s.name)} <small>${CHARS[s.ch].e}</small></span><span class="sc">${ROLES[s.role].e} ${ROLES[s.role].n}${s.kills ? `<small> · 💧${s.kills}</small>` : ''}</span></div>`;
  }).join('');
  game.practice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  shell.show('over');
}
function cancelAimQuiet() { game.aim = null; $('aim').classList.add('hidden'); }
function practice() { S.unlock(); game.practice = true; shell.sendAfterHello({ t: 'practice', opts: { bots: game.pick.bots } }); }

const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellybang', title: '🍮 젤리뱅', subtitle: '숨은 역할을 지키며 젤리를 던지는 카드 대결!<br>👑 젤리왕을 지킬까, 노릴까? 아무도 믿지 마요', wsPath: '/bang-ws', max: 7,
  multiLabel: '👥 같이 하기', roomIcon: '🍮', startLabel: '🍮 다 같이 시작!',
  keysHelp: '카드를 누르고 → 빛나는 사람을 눌러 써요 · 4명이 안 되면 젤리봇이 채워요 · 📖 규칙에서 카드를 다 볼 수 있어요',
  buttons: [{ id: 'bot-btn', label: '🤖 젤리봇과 한 판 <small>바로 시작</small>', onClick: () => practice() }],
  extraRow: [{ label: '📖 규칙', onClick: () => openRules() }],
  screens: ['over', 'rules'],
  describe: (o = {}) => `🤖 봇 ${o.bots || 0} · 4~7명`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n }), 0, 6) },
  onStart: (m) => startGame(m),
  onFinish: (m) => results(m),
  onEscape: () => { if (!$('rules').classList.contains('hidden')) { $('rules').classList.add('hidden'); return true; } if (game.aim) { cancelAim(); return true; } return false; },
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ bots: game.pick.bots });
shell.on('gs', (m) => {
  const g = m.g;
  const first = !game.g;
  game.g = g; game.me = g.me;
  game.deadline = performance.now() + g.left;
  if (game.aim) { const c = g.hand.find((x) => x.id === game.aim.id); if (!c || !c.ok || g.turn !== game.me || g.phase !== 'play') cancelAimQuiet(); else game.aim = c; }
  render();
  if (!first) events(m.ev || [], g);
  else { const me = g.seats[game.me]; if (me) shell.toast(`🤫 내 역할은 ${ROLES[me.role].e} ${ROLES[me.role].n}! 들키지 마요`, 3200); }
});
shell.on('nope', () => { S.sfx('bad'); });
function optsUI(el, o, editable, set, lo, hi) {
  el.innerHTML = `<div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div><div class="note">사람 + 봇이 4명보다 적으면 봇이 더 들어와요 (최대 7명)</div>`;
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(lo, Math.min(hi, (o.bots || 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }, 3, 6); }
$('again-btn').onclick = () => { if (game.practice) return practice(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() { game.mode = 'title'; game.g = null; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('react').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (confirm('게임에서 나갈까요? 내 자리는 젤리봇이 이어서 해요')) quit(); };
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'KeyM') muteBtn();
  if (game.mode !== 'play' || !game.g) return;
  if (e.code === 'Space' && !$('react').classList.contains('hidden')) { e.preventDefault(); $('r-yes').click(); }
  else if (e.code === 'Enter' && !$('end-btn').disabled) { e.preventDefault(); $('end-btn').click(); }
  else if (/^Digit[1-9]$/.test(e.code)) { const c = game.g.hand[+e.code.slice(5) - 1]; if (c) clickCard(c.id); }
});

await document.fonts.load('40px Jua').catch(() => {});
renderTitleOpts();
shell.boot();
