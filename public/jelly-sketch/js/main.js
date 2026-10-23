// 젤리 스케치퀴즈: 한 명씩 돌아가며 '주제를 직접 정해서' 그리고, 나머지가 실시간으로 보며 맞힌다 (최대 12명)
//   그림 자료 · 도구는 그림릴레이와 같은 모양 ([색, 굵기, x, y, x, y, …], 1000×750 좌표)
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellysketch');
const PICK_KEY = 'jellysketch.pick';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.sketch = { mode: 'title', players: new Map(), order: [], drawer: 0, phase: '', myId: 0, end: 0, total: 1, score: {}, got: new Set(), word: '', pick: { rounds: pick0.rounds || 2, draw: pick0.draw || 80 } };
for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// ---------- 그림 ----------
const PAL = ['#2b2240', '#7a5c4a', '#ff5c7a', '#ff9a3c', '#ffd23f', '#6fd36b', '#2fb39a', '#4aa3ff', '#3b5bdb', '#8c7bff', '#ff7ad9', '#ffc2d9', '#a0a0a8', '#ffffff', '#c49a6c'];
const PAPER = '#fffdf8', ERASE = 15, SIZES = [4, 10, 22, 44], LW = 1000, LH = 750;
const colOf = (i) => (i === ERASE ? PAPER : PAL[i] || PAL[0]);
function strokePath(g, s, k) {
  g.strokeStyle = colOf(s[0]); g.fillStyle = colOf(s[0]); g.lineWidth = s[1] * k; g.lineCap = 'round'; g.lineJoin = 'round';
  if (s.length <= 4) { g.beginPath(); g.arc(s[2] * k, s[3] * k, (s[1] * k) / 2, 0, Math.PI * 2); g.fill(); return; }
  g.beginPath(); g.moveTo(s[2] * k, s[3] * k);
  for (let i = 4; i + 3 < s.length; i += 2) { const mx = (s[i] + s[i + 2]) / 2, my = (s[i + 1] + s[i + 3]) / 2; g.quadraticCurveTo(s[i] * k, s[i + 1] * k, mx * k, my * k); }
  g.lineTo(s[s.length - 2] * k, s[s.length - 1] * k); g.stroke();
}
const paper = { cv: $('paper'), strokes: [], cur: null, color: 0, size: 1, erase: false, sentAt: 0, dirty: false };
function render() {
  const cv = paper.cv, g = cv.getContext('2d'), k = cv.width / LW;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, cv.width, cv.height);
  for (const s of paper.strokes) if (s) strokePath(g, s, k);
}
function layoutPaper() {
  const small = innerWidth <= 980;
  const maxW = small ? innerWidth - 32 : Math.min(980, innerWidth - 200 - 290 - 70), maxH = innerHeight - (small ? 330 : 210);
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.floor(Math.min(maxW, (Math.max(200, maxH) * LW) / LH)), h = Math.floor((w * LH) / LW);
  const cv = paper.cv; cv.style.width = `${w}px`; cv.style.height = `${h}px`; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  render();
}
addEventListener('resize', () => { if (game.mode === 'play') layoutPaper(); });
const isDrawer = () => game.drawer === game.myId && game.phase === 'draw';
const toLocal = (e) => { const r = paper.cv.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * LW), Math.round(((e.clientY - r.top) / r.height) * LH)]; };
// 그리는 획을 보낸다 (그리는 중엔 0.07초마다 지금 획 통째로)
function sendCur(force) {
  const now = performance.now();
  if (!paper.cur || (!force && now - paper.sentAt < 70)) { paper.dirty = !!paper.cur; return; }
  paper.sentAt = now; paper.dirty = false;
  shell.send({ t: 'sd', i: paper.strokes.length - 1, s: paper.cur });
}
paper.cv.addEventListener('pointerdown', (e) => {
  if (!isDrawer()) return;
  S.unlock(); paper.cv.setPointerCapture(e.pointerId);
  const [x, y] = toLocal(e);
  paper.cur = [paper.erase ? ERASE : paper.color, SIZES[paper.size] * (paper.erase ? 1.6 : 1), x, y];
  paper.strokes.push(paper.cur);
  strokePath(paper.cv.getContext('2d'), paper.cur, paper.cv.width / LW);
  sendCur(true);
});
paper.cv.addEventListener('pointermove', (e) => {
  const s = paper.cur; if (!s) return;
  const co = e.getCoalescedEvents?.() || [], evs = co.length ? co : [e];
  const g = paper.cv.getContext('2d'), k = paper.cv.width / LW;
  for (const ev of evs) {
    const [x, y] = toLocal(ev), px = s[s.length - 2], py = s[s.length - 1];
    if (Math.hypot(x - px, y - py) < 3) continue;
    s.push(x, y);
    g.strokeStyle = colOf(s[0]); g.lineWidth = s[1] * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(px * k, py * k); g.lineTo(x * k, y * k); g.stroke();
  }
  sendCur(false);
  if (Math.random() < 0.15) S.sfx('pen');
});
const endStroke = () => { if (paper.cur) { sendCur(true); paper.cur = null; render(); } };
paper.cv.addEventListener('pointerup', endStroke); paper.cv.addEventListener('pointercancel', endStroke);
setInterval(() => { if (paper.dirty) sendCur(true); }, 80);
function tools() {
  $('palette').innerHTML = PAL.map((c, i) => `<button data-c="${i}" style="background:${c}" class="${!paper.erase && i === paper.color ? 'on' : ''}"></button>`).join('');
  $('sizes').innerHTML = SIZES.map((s, i) => `<button data-s="${i}" class="${i === paper.size ? 'on' : ''}"><i style="width:${4 + i * 6}px;height:${4 + i * 6}px"></i></button>`).join('');
  $('t-erase').classList.toggle('on', paper.erase);
  $('palette').querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { paper.color = +b.dataset.c; paper.erase = false; tools(); }; });
  $('sizes').querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { paper.size = +b.dataset.s; tools(); }; });
}
$('t-erase').onclick = () => { paper.erase = !paper.erase; tools(); };
$('t-undo').onclick = () => { if (!isDrawer() || !paper.strokes.length) return; paper.strokes.pop(); render(); shell.send({ t: 'su' }); };
$('t-clear').onclick = () => { if (!isDrawer() || !paper.strokes.length || !confirm('다 지울까요?')) return; paper.strokes = []; render(); shell.send({ t: 'sc' }); };
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && isDrawer()) { e.preventDefault(); $('t-undo').click(); } });
tools();

// ---------- 화면 ----------
const nameOf = (id) => game.players.get(id)?.name || '누군가';
function renderPlayers() {
  $('sk-players').innerHTML = [...game.players.values()].sort((a, b) => (game.score[b.id] || 0) - (game.score[a.id] || 0)).map((p) =>
    `<div class="skp${p.id === game.myId ? ' me' : ''}${p.id === game.drawer ? ' drawer' : ''}${game.got.has(p.id) ? ' got' : ''}">${faceHtml(p, 34)}<span class="nm">${esc(p.name)}${p.id === game.drawer ? ' <span class="tag">✏️</span>' : game.got.has(p.id) ? ' <span class="tag">✅</span>' : ''}</span><span class="sc">${game.score[p.id] || 0}</span></div>`).join('');
}
function line(html, cls = '') { const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html; $('sk-feed').appendChild(d); $('sk-feed').scrollTop = 1e9; while ($('sk-feed').children.length > 120) $('sk-feed').firstChild.remove(); }
function banner(html, ms = 2200) { const b = $('sk-banner'); b.innerHTML = html; b.classList.remove('hidden'); clearTimeout(game.bannerT); game.bannerT = setTimeout(() => b.classList.add('hidden'), ms); }
function cover(text) { $('sk-cover').classList.toggle('hidden', !text); $('sk-cover').innerHTML = text || ''; }
function setHint(text, mine) { $('sk-hint').textContent = text; $('sk-hint').classList.toggle('mine', !!mine); }
function updateInput() {
  const canGuess = game.phase === 'draw' && game.drawer !== game.myId && !game.got.has(game.myId);
  $('sk-in').placeholder = game.drawer === game.myId ? '그리는 중 · 채팅은 친구에게 보여요 (정답은 가려져요)' : game.got.has(game.myId) ? '맞혔어요! 이제는 채팅만' : canGuess ? '정답을 써요 (Enter)' : '잠깐 기다려요…';
  $('tools').classList.toggle('hidden', !isDrawer());
}

// ---------- 흐름 ----------
function start(m) {
  game.mode = 'play'; game.myId = shell.myId; game.players.clear(); game.score = {}; game.got = new Set();
  for (const mem of m.members) game.players.set(mem.id, mem);
  game.order = m.order; game.drawer = 0; game.phase = 'wait';
  shell.hideScreens(); $('game').classList.remove('hidden'); $('sk-feed').innerHTML = '';
  paper.strokes = []; layoutPaper(); renderPlayers(); setHint(''); cover('곧 시작해요!'); updateInput();
  line(`🖍️ ${m.rounds}바퀴 · 한 사람씩 주제를 정해 그려요 · 그림 ${m.draw}초`, 'sys');
  countdown(m.in); S.music('draw');
}
function countdown(ms) {
  const el = $('count'), n = $('count-n'); el.classList.remove('hidden');
  const t0 = performance.now();
  const tick = () => { const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000); if (left <= 0) { n.textContent = 'GO!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 500); return; } if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); } setTimeout(tick, 60); };
  tick();
}
function onTurn(m) {
  game.drawer = m.drawer; game.phase = 'pick'; game.got = new Set(); game.word = '';
  game.end = performance.now() + m.ms; game.total = m.ms;
  paper.strokes = []; paper.cur = null; render(); renderPlayers();
  $('sk-round').textContent = `${m.round} / ${m.rounds}바퀴 · ✏️ ${nameOf(m.drawer)} 차례`;
  const mine = m.drawer === game.myId;
  setHint(mine ? '' : '주제를 정하는 중…');
  cover(mine ? '' : `✏️ <b>${esc(nameOf(m.drawer))}</b> 님이 그릴 주제를 정하고 있어요…`);
  line(`✏️ ${esc(nameOf(m.drawer))} 님 차례예요`, 'sys');
  if (mine) S.sfx('turn');
  updateInput();
}
function showPick(ideas) {
  $('choices').innerHTML = ideas.map((w) => `<button data-w="${esc(w)}">${esc(w)}</button>`).join('');
  $('choices').querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => pickTopic(b.dataset.w); });
  $('pick-in').value = ''; $('sk-pick').classList.remove('hidden'); setTimeout(() => $('pick-in').focus(), 50);
}
function pickTopic(w) { w = (w || '').trim(); if (!w) return shell.toast('주제를 써 주세요'); shell.send({ t: 'topic', word: w }); $('sk-pick').classList.add('hidden'); }
$('pick-form').onsubmit = (e) => { e.preventDefault(); pickTopic($('pick-in').value); };
function onDraw(m) {
  game.phase = 'draw'; game.drawer = m.drawer; game.end = performance.now() + m.ms; game.total = m.ms;
  $('sk-pick').classList.add('hidden'); cover('');
  if (m.drawer !== game.myId) { setHint(m.hint); S.sfx('start'); setTimeout(() => $('sk-in').focus(), 50); }
  updateInput();
}
function onReveal(m) {
  game.phase = 'reveal'; game.score = m.score; cover('');
  const n = Object.keys(m.got).length;
  setHint(m.word, true);
  banner(m.skipped ? `🚪 ${esc(nameOf(m.drawer))} 님 차례를 건너뛰어요` : `정답은 <b>${esc(m.word)}</b>!<small>${m.all ? '🎉 모두 맞혔어요!' : `${n}명이 맞혔어요`} · ✏️ ${esc(nameOf(m.drawer))}</small>`, 3600);
  line(`💡 정답: <b>${esc(m.word)}</b> (${n}명 맞힘)`, 'sys');
  S.sfx(n ? 'ok' : 'miss'); renderPlayers(); updateInput();
}
let lastSec = -1;
function frame(now) {
  requestAnimationFrame(frame);
  if (game.mode !== 'play') return;
  const left = Math.max(0, game.end - now);
  $('timer').firstElementChild.style.width = `${Math.min(100, (left / Math.max(1, game.total)) * 100)}%`;
  $('timer').classList.toggle('hurry', game.phase === 'draw' && left < 10000);
  const sec = Math.ceil(left / 1000);
  if (game.phase === 'draw' && sec !== lastSec && sec <= 5 && sec > 0) S.sfx('clock');
  lastSec = sec;
}
requestAnimationFrame(frame);
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden'); $('sk-pick').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  $('ov-title').textContent = m.rank[0] ? `🏆 ${m.rank[0].name} 우승!` : '🖍️ 스케치퀴즈 끝!';
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · ${mine.score}점` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${esc(e.name)}</span><span class="sc">${e.score}<small>점</small></span></div>`).join('');
  if (mine?.rank === 1) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
}

// ---------- 맞히기 · 채팅 ----------
$('sk-form').onsubmit = (e) => { e.preventDefault(); const t = $('sk-in').value.trim(); if (!t) return; shell.send({ t: 'guess', text: t }); $('sk-in').value = ''; };
// Enter: 맞히는 사람은 바로 답 칸으로 (공용 채팅보다 먼저)
addEventListener('keydown', (e) => {
  if (game.mode !== 'play' || e.key !== 'Enter' || e.isComposing) return;
  const a = document.activeElement?.tagName; if (a === 'INPUT' || a === 'TEXTAREA') return;
  if (!$('sk-pick').classList.contains('hidden')) return;
  e.preventDefault(); e.stopImmediatePropagation(); $('sk-in').focus();
}, true);

// ---------- 공용 틀 ----------
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellysketch', title: '🖍️ 젤리 스케치퀴즈', subtitle: '한 명씩 주제를 직접 정해서 그리면<br>나머지가 실시간으로 보고 맞혀요!', wsPath: '/sketch-ws', max: 12,
  multiLabel: '👥 같이 하기', roomIcon: '🖍️', startLabel: '🖍️ 그리기 시작!',
  keysHelp: '내 차례: 주제를 직접 쓰거나 추천에서 골라 그리기 (Ctrl+Z 되돌리기) · 친구 차례: Enter 로 바로 답 쓰기 · 빨리 맞힐수록 점수가 커요 · 그린 사람도 맞힐 때마다 점수',
  buttons: [],
  screens: ['over'],
  describe: (o = {}) => `🔁 ${o.rounds || 2}바퀴 · ⏱️ ${o.draw || 80}초`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ rounds: game.pick.rounds, draw: game.pick.draw });
shell.on('turn', (m) => onTurn(m));
shell.on('pickme', (m) => showPick(m.ideas));
shell.on('draw', (m) => onDraw(m));
shell.on('mine', (m) => { game.word = m.word; setHint(m.word, true); });
shell.on('auto', (m) => { $('sk-pick').classList.add('hidden'); shell.toast(`⏰ 시간이 다 돼서 '${m.word}' 로 정했어요`, 2200); });
shell.on('hint', (m) => { if (game.drawer !== game.myId && !game.got.has(game.myId)) { setHint(m.hint); S.sfx('tick', 4); line('💡 글자 힌트가 하나 열렸어요', 'sys'); } });
shell.on('sd', (m) => { paper.strokes[m.i] = m.s; if (m.i === paper.strokes.length - 1) { const g = paper.cv.getContext('2d'); strokePath(g, m.s, paper.cv.width / LW); } else render(); });
shell.on('su', () => { paper.strokes.pop(); render(); });
shell.on('sc', () => { paper.strokes = []; render(); });
shell.on('gs', (m) => {
  if (m.ok) {
    game.got.add(m.id); game.score = m.score; renderPlayers();
    line(`🎉 ${esc(nameOf(m.id))} 님 정답! <b>+${m.pts}</b>`, 'ok');
    if (m.id === game.myId) { S.sfx('win'); confetti(40); banner(`🎉 정답! <b>+${m.pts}</b>`, 1400); } else S.sfx('ok');
    updateInput(); return;
  }
  line(`<b style="color:${esc(game.players.get(m.id)?.color || '#ffd84d')}">${esc(nameOf(m.id))}</b>${m.text == null ? '<i>(정답이 들어 있어서 가렸어요)</i>' : esc(m.text)}`, m.side ? 'side' : '');
});
shell.on('close', (m) => { line(`🤏 '${esc(m.text)}' 거의 맞았어요!`, 'close'); S.sfx('tick', 8); });
shell.on('reveal', (m) => onReveal(m));
shell.on('gone', (m) => { const p = game.players.get(m.id); if (p) { line(`🚪 ${esc(p.name)} 님이 나갔어요`, 'sys'); game.players.delete(m.id); renderPlayers(); } });
function optsUI(el, o, editable, set) {
  el.innerHTML = `<div class="seg">${[1, 2, 3].map((n) => `<button data-r="${n}" class="${(o.rounds || 2) === n ? 'on' : ''}" ${editable ? '' : 'disabled'}>🔁 ${n}바퀴</button>`).join('')}</div>
    <div class="seg">${[60, 80, 100, 120].map((n) => `<button data-d="${n}" class="${(o.draw || 80) === n ? 'on' : ''}" ${editable ? '' : 'disabled'}>⏱️ ${n}초</button>`).join('')}</div>`;
  el.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => set({ rounds: +b.dataset.r }); });
  el.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => set({ draw: +b.dataset.d }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }); }
$('again-btn').onclick = () => { game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() { game.mode = 'title'; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); $('sk-pick').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (confirm('나갈까요?')) quit(); };
renderTitleOpts();
shell.boot();
