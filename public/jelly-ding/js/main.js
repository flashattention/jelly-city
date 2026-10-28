// 젤리 땡: 차례대로 젤리 카드를 뒤집다가, 한 맛 곰젤리가 목표 숫자와 딱 맞으면 종을 친다! (봇과 대결 · 같이 2 ~ 6명)
//   글자 입력 없이 키 두 개: Space(J · Enter) = 종 · F(↓) = 뒤집기 · 휴대폰은 큰 단추
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { FLAVORS, GOLD, SOUR, RAIN, TIMES, flavorOf, countOf } from './rules.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellyding');
const PICK_KEY = 'jellyding.pick';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.ding = {
  mode: 'title', myId: 0, players: new Map(), st: null, startAt: 0, endAt: 0, turnEnd: 0, lockEnd: 0, rangV: -1,
  pick: { time: TIMES.includes(pick0.time) ? pick0.time : 180, bots: pick0.bots ?? 3, speed: pick0.speed === 'fast' ? 'fast' : 'normal', specials: pick0.specials !== false },
};

// 배경 거품
for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// ---------- 소리: 종(여러 배음이 길게 울리는 손종) · 카드 넘기는 소리 ----------
let ac = null, acBus = null;
function audio() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ac = new AC(); acBus = ac.createGain(); acBus.gain.value = 0.55; acBus.connect(ac.destination);
  return ac;
}
function bellSound(pitch = 1, vol = 1) {
  if (S.sound.muted || !audio()) return;
  if (ac.state !== 'running') ac.resume();
  const t = ac.currentTime + 0.005, f0 = 1046 * pitch;
  // 손종: 서로 어긋난 배음 (금속성) + 처음 '딱' 소리
  for (const [k, v, d] of [[1, 0.5, 1.6], [2.01, 0.22, 1.1], [2.76, 0.2, 0.9], [5.4, 0.08, 0.5], [8.93, 0.04, 0.3]]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f0 * k;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * vol * 0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(acBus); o.start(t); o.stop(t + d + 0.05);
  }
  noise(0.03, 3000, 0.25 * vol);
}
function noise(dur, freq, vol, type = 'bandpass') {
  if (S.sound.muted || !audio()) return;
  const t = ac.currentTime + 0.005, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(acBus); s.start(t);
}
const flipSound = () => { noise(0.09, 1800, 0.35); noise(0.05, 600, 0.2, 'lowpass'); };
const unlock = () => { S.unlock(); if (audio() && ac.state !== 'running') ac.resume(); };

// ---------- 카드 그림 (SVG 곰젤리) ----------
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
function bear(col, x, y, s, extra = '') {
  // 곰젤리 하나 (x, y = 가운데 · s = 크기 %)
  const id = `g${col.slice(1)}`;
  return `<svg class="bear" style="left:${x}%;top:${y}%;width:${s}%" viewBox="0 0 40 50" ${extra}><use href="#${id}"/></svg>`;
}
function bearDefs() {
  const cols = [...FLAVORS.map((f) => f.color), '#ffcf3a'];
  const defs = cols.map((c) => {
    const id = `g${c.slice(1)}`;
    return `<linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, 1.35)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, 0.72)}"/></linearGradient>
    <g id="${id}"><g fill="url(#${id}l)" stroke="${shade(c, 0.6)}" stroke-width="1.2" stroke-opacity=".55">
      <circle cx="11" cy="7" r="5"/><circle cx="29" cy="7" r="5"/>
      <ellipse cx="7" cy="27" rx="4.5" ry="6" transform="rotate(25 7 27)"/><ellipse cx="33" cy="27" rx="4.5" ry="6" transform="rotate(-25 33 27)"/>
      <ellipse cx="13" cy="43" rx="5.5" ry="5.5"/><ellipse cx="27" cy="43" rx="5.5" ry="5.5"/>
      <ellipse cx="20" cy="31" rx="11.5" ry="13"/><circle cx="20" cy="14" r="10.5"/></g>
      <ellipse cx="15.5" cy="10" rx="3.2" ry="1.8" fill="#fff" opacity=".75" transform="rotate(-25 15.5 10)"/><ellipse cx="15" cy="26" rx="2.5" ry="5" fill="#fff" opacity=".35"/>
      <circle cx="16.5" cy="14.5" r="1.3" fill="${shade(c, 0.35)}"/><circle cx="23.5" cy="14.5" r="1.3" fill="${shade(c, 0.35)}"/>
      <path d="M18 18 q2 1.8 4 0" stroke="${shade(c, 0.35)}" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>`;
  }).join('');
  const rb = `<linearGradient id="rainl" x1="0" y1="0" x2="1" y2="1">${['#ff4f6d', '#ffc93c', '#5fd36a', '#45b4ff', '#a66bff'].map((c, i) => `<stop offset="${i / 4}" stop-color="${c}"/>`).join('')}</linearGradient>
    <g id="grain"><g fill="url(#rainl)" stroke="#fff" stroke-width="1.4"><circle cx="11" cy="7" r="5"/><circle cx="29" cy="7" r="5"/><ellipse cx="7" cy="27" rx="4.5" ry="6" transform="rotate(25 7 27)"/><ellipse cx="33" cy="27" rx="4.5" ry="6" transform="rotate(-25 33 27)"/><ellipse cx="13" cy="43" rx="5.5" ry="5.5"/><ellipse cx="27" cy="43" rx="5.5" ry="5.5"/><ellipse cx="20" cy="31" rx="11.5" ry="13"/><circle cx="20" cy="14" r="10.5"/></g><circle cx="16.5" cy="14.5" r="1.3" fill="#3b2a60"/><circle cx="23.5" cy="14.5" r="1.3" fill="#3b2a60"/><path d="M18 18 q2 1.8 4 0" stroke="#3b2a60" stroke-width="1.1" fill="none"/></g>`;
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defs}${rb}</defs></svg>`);
}
bearDefs();
// 마릿수별 자리 (카드 안 %)
const SPOTS = { 1: [[50, 50]], 2: [[32, 30], [68, 70]], 3: [[28, 26], [50, 50], [72, 74]], 4: [[30, 28], [70, 28], [30, 72], [70, 72]], 5: [[28, 24], [72, 24], [50, 50], [28, 76], [72, 76]] };
function cardHtml(c, cls = '') {
  if (c == null || c < 0) return '';
  if (c === GOLD) return `<div class="jcard sp gold ${cls}"><div class="rays"></div><svg class="bear big" viewBox="0 0 40 50" style="left:50%;top:46%;width:62%"><use href="#gffcf3a"/></svg><b class="tag">🌟 황금곰<small>바로 땡!</small></b></div>`;
  if (c === SOUR) return `<div class="jcard sp sour ${cls}"><div class="sour-blob"><i></i><i></i><span>&gt;﹏&lt;</span></div><b class="tag">🍋 시큼젤리<small>쉿! 치지 마</small></b></div>`;
  if (c === RAIN) return `<div class="jcard sp rain ${cls}"><svg class="bear big" viewBox="0 0 40 50" style="left:50%;top:46%;width:58%"><use href="#grain"/></svg><b class="tag">🌈 무지개곰<small>모든 맛 +1</small></b></div>`;
  const f = FLAVORS[flavorOf(c)], n = countOf(c);
  const sz = n === 1 ? 52 : n <= 3 ? 36 : 32;
  return `<div class="jcard f${flavorOf(c)} ${cls}" style="--fc:${f.color}"><span class="corner">${n}</span><span class="corner br">${n}</span>${SPOTS[n].map(([x, y]) => bear(f.color, x, y, sz)).join('')}</div>`;
}

// ---------- 자리 · 그리기 ----------
function seatPos(i, n, me) {
  const k = (i - me + n) % n, a = Math.PI / 2 + (k / n) * Math.PI * 2;
  return { a, x: Math.cos(a), y: Math.sin(a) };
}
function buildSeats() {
  const st = game.st; if (!st) return;
  const el = $('seats'); el.innerHTML = '';
  const n = st.seats.length, me = Math.max(0, st.seats.findIndex((s) => s[0] === game.myId));
  st.seats.forEach(([id], i) => {
    const p = game.players.get(id) || { name: '?', color: '#999' };
    const { x, y } = seatPos(i, n, me);
    const seat = document.createElement('div');
    seat.className = `seat${id === game.myId ? ' me' : ''}`; seat.id = `seat-${id}`;
    seat.style.left = `${50 + x * (innerWidth <= 720 ? 38 : 42)}%`; seat.style.top = `${50 + y * 43}%`;
    seat.innerHTML = `<div class="who">${faceHtml(p, 40)}<div class="nm">${p.bot ? '🤖 ' : ''}${esc(p.name)}</div><div class="deck"><i></i><i></i><i></i><b>0</b></div><div class="timer"><i></i></div></div><div class="say hidden">땡!</div>`;
    el.appendChild(seat);
    const slot = document.createElement('div');
    slot.className = 'slot'; slot.id = `slot-${id}`;
    slot.style.left = `${50 + x * 24}%`; slot.style.top = `${50 + y * 25}%`;
    slot.innerHTML = '<div class="pilecount"></div><div class="cards"></div>';
    el.appendChild(slot);
  });
}
function render(ev) {
  const st = game.st; if (!st) return;
  if (!$('seats').children.length || st.seats.some(([id]) => !$(`seat-${id}`))) buildSeats();
  $('target-n').textContent = st.target; $('bell-n').textContent = st.target;
  for (const [id, deckN, pileN, top, out] of st.seats) {
    const seat = $(`seat-${id}`), slot = $(`slot-${id}`); if (!seat) continue;
    seat.querySelector('.deck b').textContent = deckN;
    seat.querySelector('.deck').classList.toggle('empty', !deckN);
    seat.classList.toggle('turn', st.turn === id && !out);
    seat.classList.toggle('out', !!out);
    slot.classList.toggle('out', !!out);
    slot.querySelector('.pilecount').textContent = pileN > 1 ? `${pileN}장` : '';
    const cards = slot.querySelector('.cards');
    const fresh = ev?.k === 'flip' && ev.id === id;
    if (+cards.dataset.top !== top || +cards.dataset.n !== pileN || fresh) {
      if (!pileN) cards.innerHTML = '';
      else if (fresh) {
        // 새 카드: 뒤집히며 올라온다 (밑에 깔린 카드는 한 장만 남긴다)
        const under = cards.lastElementChild; cards.innerHTML = ''; if (under) { under.classList.remove('flipin'); under.classList.add('under'); cards.appendChild(under); }
        cards.insertAdjacentHTML('beforeend', cardHtml(top, 'flipin'));
      } else cards.innerHTML = cardHtml(top);
      cards.dataset.top = top; cards.dataset.n = pileN;
    }
  }
  const myTurn = st.turn === game.myId;
  $('flip-btn').classList.toggle('on', myTurn);
  $('table').classList.toggle('myturn', myTurn);
}
function showBanner(html, cls, ms = 1400) {
  const b = $('banner'); b.className = cls; b.innerHTML = html;
  clearTimeout(showBanner.t); showBanner.t = setTimeout(() => b.classList.add('hidden'), ms);
}
function say(id, text, cls = '') {
  const s = $(`seat-${id}`)?.querySelector('.say'); if (!s) return;
  s.textContent = text; s.className = `say ${cls}`; void s.offsetWidth; s.classList.add('pop');
  clearTimeout(s.t); s.t = setTimeout(() => s.classList.add('hidden'), 1300);
}
function shakeBell() { const b = $('bell'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
function nameOf(id) { const p = game.players.get(id); return p ? esc(p.name) : '?'; }
function onEvent(ev) {
  if (!ev) return;
  if (ev.k === 'flip') { flipSound(); if (ev.c === GOLD) S.sfx('ten'); }
  if (ev.k === 'ring') {
    const me = ev.id === game.myId;
    const who = me ? '내가' : `${nameOf(ev.id)} 님이`;
    if (ev.ok) {
      const why = ev.why === 'gold' ? '🌟 황금곰!' : `${FLAVORS[ev.hit].emoji} ${FLAVORS[ev.hit].name} ${ev.target}마리!`;
      showBanner(`<b>땡! ${why}</b><span>${who} 카드 ${ev.gain}장을 가져가요</span><em>다음 목표: <b>${ev.next}</b>마리</em>`, 'good', 1800);
      say(ev.id, `+${ev.gain}`, 'good');
      if (me) { S.sfx('win'); confetti(40); } else S.sfx('ok');
      // 가운데 카드들이 가져간 사람 쪽으로 쓸려 간다
      const to = $(`seat-${ev.id}`)?.getBoundingClientRect();
      document.querySelectorAll('#seats .slot .cards').forEach((c) => {
        const r = c.getBoundingClientRect(); if (!to || !c.children.length) return;
        c.style.transition = 'transform .45s ease-in, opacity .45s'; c.style.transform = `translate(${to.left + to.width / 2 - r.left - r.width / 2}px,${to.top + to.height / 2 - r.top - r.height / 2}px) scale(.4)`; c.style.opacity = '0';
        setTimeout(() => { c.style.transition = 'none'; c.style.transform = ''; c.style.opacity = ''; }, 480);
      });
      const tg = $('target'); tg.classList.remove('new'); void tg.offsetWidth; tg.classList.add('new');
    } else {
      const why = ev.why === 'sour' ? '🍋 시큼젤리가 있었어요!' : `목표 ${ev.target}마리인 맛이 없어요`;
      showBanner(`<b>❌ 헛땡!</b><span>${why}</span><em>${who} 모두에게 1장씩 줘요</em>`, 'bad', 1600);
      say(ev.id, `-${ev.pay?.length || 0}`, 'bad');
      S.sfx(me ? 'miss' : 'bad');
      document.querySelectorAll('#seats .slot').forEach((s) => s.classList.add('peek'));
      setTimeout(() => document.querySelectorAll('#seats .slot').forEach((s) => s.classList.remove('peek')), 1500);
    }
    for (const id of ev.late || []) if (id !== ev.id) say(id, '늦었다!', 'late');
    if (ev.totals) {
      // 그때 보이던 맛별 마릿수 (다 함께 확인)
      const chips = FLAVORS.map((f, i) => `<i class="${ev.totals[i] === ev.target ? 'hit' : ''}" style="--fc:${f.color}">${f.emoji}${ev.totals[i]}</i>`).join('');
      $('banner').insertAdjacentHTML('beforeend', `<div class="chips">${chips}</div>`);
    }
  }
  for (const id of ev.outs || []) { say(id, '탈락 😵', 'bad'); if (id === game.myId) shell.toast('😵 카드가 다 떨어졌어요! 끝날 때까지 구경해요', 2600); }
}

// ---------- 입력 ----------
const playing = () => game.mode === 'play' && performance.now() >= game.startAt;
function ring() {
  if (!playing() || !game.st) return;
  unlock();
  const me = game.st.seats.find((s) => s[0] === game.myId);
  if (!me || me[4] || performance.now() < game.lockEnd || game.rangV === game.st.v) return;
  game.rangV = game.st.v;
  shell.send({ t: 'ring', v: game.st.v });
  bellSound(1, 1); shakeBell(); say(game.myId, '땡!', 'ring');
}
function flip() {
  if (!playing() || !game.st || game.st.turn !== game.myId || performance.now() < game.lockEnd) return;
  unlock(); shell.send({ t: 'flip' });
}
$('bell').addEventListener('pointerdown', (e) => { e.preventDefault(); ring(); });
$('ring-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); ring(); });
$('flip-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); flip(); });
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'KeyM') muteBtn();
  if (game.mode !== 'play') return;
  if (['Space', 'KeyJ', 'Enter', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) ring(); }
  if (['KeyF', 'ArrowDown', 'KeyD'].includes(e.code)) { e.preventDefault(); if (!e.repeat) flip(); }
});

// ---------- 흐름 ----------
let pingT = 0, rtt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (game.mode !== 'play' || !game.st) return;
  const left = Math.max(0, game.endAt - now), sec = Math.ceil(left / 1000);
  $('clock-t').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('hurry', sec <= 15);
  // 차례 시간 막대
  const tl = Math.max(0, game.turnEnd - now), k = now < game.lockEnd ? 1 : Math.min(1, tl / game.st.speed);
  const seat = $(`seat-${game.st.turn}`); if (seat) seat.style.setProperty('--tk', k.toFixed(3));
  if (now - pingT > 2000) { pingT = now; shell.send({ t: 'pg', c: now }); }
}
requestAnimationFrame(frame);
function countdown(ms) {
  const el = $('count'), n = $('count-n');
  el.classList.remove('hidden');
  const t0 = performance.now();
  const tickC = () => {
    const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000);
    if (left <= 0) { n.textContent = '땡 준비!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 600); return; }
    if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); }
    setTimeout(tickC, 60);
  };
  tickC();
}
function applyState(s, ev) {
  const now = performance.now();
  game.st = s; game.turnEnd = now + s.tLeft; game.lockEnd = now + s.lockLeft; game.endAt = now + s.endIn;
  render(ev);
}
function practice() { unlock(); shell.sendAfterHello({ t: 'practice', opts: { ...game.pick, bots: Math.max(1, game.pick.bots) } }); }
function startMulti(m) {
  game.myId = shell.myId; game.players.clear();
  for (const mem of m.members) game.players.set(mem.id, mem);
  game.mode = 'play'; game.startAt = performance.now() + m.in; game.rangV = -1;
  shell.hideScreens(); $('game').classList.remove('hidden'); $('banner').classList.add('hidden');
  $('seats').innerHTML = '';
  applyState(m.state);
  countdown(m.in); S.sfx('start');
  if (!store.get('jellyding.seen')) { store.set('jellyding.seen', '1'); setTimeout(() => shell.toast(`🔔 한 가지 맛이 딱 ${m.state.target}마리가 되면 Space! · 내 차례엔 F 로 뒤집기`, 4200), m.in); }
}
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => muteBtn(true) },
  key: 'jellyding', title: '🔔 젤리 땡', subtitle: '차례대로 젤리 카드를 뒤집다가<br>한 맛 곰젤리가 <b>목표 숫자</b>와 딱 맞으면 종을 쳐요! 땡!', wsPath: '/ding-ws', max: 6,
  multiLabel: '👥 같이 하기', roomIcon: '🔔', startLabel: '🔔 다 같이 시작!',
  keysHelp: '<b>Space</b>(J · Enter) 종 치기 · <b>F</b>(↓) 내 차례에 카드 뒤집기 · 휴대폰은 큰 단추로<br>🌟 황금곰 = 바로 땡 · 🌈 무지개곰 = 모든 맛 +1 · 🍋 시큼젤리 = 보이면 치지 마!',
  buttons: [{ id: 'bot-btn', label: '🤖 봇과 대결 <small>바로 시작</small>', onClick: () => practice() }],
  extraRow: [{ label: '📖 규칙', onClick: () => openRules() }],
  screens: ['over', 'rules-screen'],
  describe: (o = {}) => `⏱️ ${(o.time || 180) / 60}분 · ${o.speed === 'fast' ? '⚡ 빠름' : '🐢 보통'} · 🤖 봇 ${o.bots || 0}`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onStart: (m) => startMulti(m),
  onFinish: (m) => results(m),
  onEscape: () => { if (!$('rules-screen').classList.contains('hidden')) { closeRules(); return true; } return false; },
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ ...game.pick });
shell.on('s', (m) => { applyState(m.s, m.ev); onEvent(m.ev); });
shell.on('rang', (m) => { if (m.id !== game.myId) { bellSound(0.94 + Math.random() * 0.12, 0.8); shakeBell(); say(m.id, '땡!', 'ring'); } });
shell.on('po', (m) => { const v = performance.now() - m.c; rtt = rtt ? rtt * 0.7 + v * 0.3 : v; shell.send({ t: 'rtt', ms: Math.round(rtt) }); });
shell.on('gone', (m) => { game.players.delete(m.id); });

function optsUI(el, o, editable, set) {
  const dis = editable ? '' : 'disabled';
  el.innerHTML = `<div class="seg time-seg">${TIMES.map((t) => `<button data-t="${t}" class="${t === o.time ? 'on' : ''}" ${dis}>⏱️ ${t / 60}분</button>`).join('')}</div>
    <div class="seg">${[['normal', '🐢 보통'], ['fast', '⚡ 빠름']].map(([k, l]) => `<button data-sp="${k}" class="${(o.speed || 'normal') === k ? 'on' : ''}" ${dis}>${l}</button>`).join('')}<button data-x="1" class="${o.specials !== false ? 'on' : ''}" ${dis}>🌟 특수 카드 ${o.specials !== false ? '켜짐' : '꺼짐'}</button></div>
    <div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div>`;
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => set({ time: +b.dataset.t }); });
  el.querySelectorAll('[data-sp]').forEach((b) => { b.onclick = () => set({ speed: b.dataset.sp }); });
  el.querySelectorAll('[data-x]').forEach((b) => { b.onclick = () => set({ specials: o.specials === false }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(5, (o.bots || 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }); }

// ---------- 규칙 ----------
function openRules() {
  const ex = (c) => `<div class="mini-card">${cardHtml(c)}</div>`;
  $('rules-body').innerHTML = `
    <p>① 모두 같은 수의 카드를 엎어서 받아요. 차례가 되면 <kbd>F</kbd> (또는 ↓ · 🃏 단추)로 맨 위 카드를 뒤집어 내 앞에 놓아요. 가만히 있으면 잠시 뒤 저절로 뒤집혀요.</p>
    <p>② 각자 앞에 <b>맨 위에 보이는 카드</b>만 세요. 한 가지 맛 곰젤리가 가운데 <b>목표 숫자</b>와 <b>딱</b> 같아지면 <kbd>Space</kbd>로 종을 쳐요! 땡!</p>
    <div class="ex">${ex(1 * 8 + 2)}<span>+</span>${ex(1 * 8 + 3)}<span>=</span><b>🍋 5마리 → 땡!</b></div>
    <p>③ 가장 먼저 맞게 친 사람이 깔린 카드를 <b>모두</b> 가져가요. 그러면 목표 숫자가 바뀌어요 (2명: 3 ~ 5 · 3 ~ 4명: 4 ~ 6 · 5명 이상: 5 ~ 7).</p>
    <p>④ 틀리게 치면 <b>다른 사람 모두에게 1장씩</b> 줘야 해요.</p>
    <div class="ex">${ex(GOLD)}<span>보이면 바로 땡!</span>${ex(RAIN)}<span>모든 맛 +1</span>${ex(SOUR)}<span>보이는 동안 절대 치지 마!</span></div>
    <p>⑤ 카드가 하나도 없으면 탈락. 마지막까지 남거나, 시간이 끝났을 때 카드가 가장 많은 사람이 이겨요!</p>`;
  game.rulesFrom = game.mode === 'play' ? 'play' : 'title';
  if (game.rulesFrom === 'play') { $('rules-screen').classList.remove('hidden'); return; }
  shell.show('rules-screen');
}
function closeRules() { if (game.rulesFrom === 'play') $('rules-screen').classList.add('hidden'); else shell.show('title'); }
$('rules-back').onclick = closeRules;
$('b-help').onclick = openRules;

// ---------- 결과 ----------
function results(m) {
  game.mode = 'over'; $('game').classList.add('hidden'); $('rules-screen').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  $('ov-title').textContent = m.rank[0] ? `🏆 ${m.rank[0].name} 우승!` : '끝!';
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · 카드 ${mine.score}장 · 맞게 친 종 ${mine.good}번` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${e.bot ? '🤖 ' : ''}${esc(e.name)}${e.out ? ' <small class="outtag">탈락</small>' : ''}</span><span class="sc">${e.score}<small>장 · 🔔${e.good}/${e.rings}</small></span></div>`).join('');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
}
$('again-btn').onclick = () => { if (game.lastPractice) return practice(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() { game.mode = 'title'; shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); $('rules-screen').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn(fromShell) { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; if (!fromShell) shell.syncSound(); }
$('b-mute').onclick = () => muteBtn(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => quit();

await document.fonts.load('40px Jua').catch(() => {});
renderTitleOpts();
shell.boot();
