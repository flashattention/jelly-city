// 젤리 그림릴레이 (텔레스트레이션 방식): 제시어 → 그림 → 맞히기 → 그림 … 그림책을 돌려 가며 · 끝나면 함께 넘겨 보기
//   혼자서는 '혼자 그려보기': 그린 그림을 AI 젤리봇이 맞힌다
import { account, store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { pickPrompts } from './prompts.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellydraw');
const PICK_KEY = 'jellydraw.pick';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.draw = { mode: 'title', players: new Map(), order: [], k: -1, kind: '', dl: 0, dlTotal: 1, submitted: false, books: null, steps: 0, rv: { b: 0, i: 0 }, likes: {}, myLikes: new Set(), host: 0, myId: 0, pick: { draw: pick0.draw || 80 } };
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
function render(cv, strokes) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, k = W / LW;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  for (const s of strokes || []) strokePath(g, s, k);
}
function fitCanvas(cv, maxW, maxH) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.floor(Math.min(maxW, (maxH * LW) / LH)), h = Math.floor((w * LH) / LW);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
}
// 그리는 종이
const paper = { cv: $('paper'), strokes: [], cur: null, color: 0, size: 1, erase: false };
const toLocal = (e) => { const r = paper.cv.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * LW), Math.round(((e.clientY - r.top) / r.height) * LH)]; };
paper.cv.addEventListener('pointerdown', (e) => {
  if (game.kind !== 'draw' || game.submitted) return;
  S.unlock(); paper.cv.setPointerCapture(e.pointerId);
  const [x, y] = toLocal(e);
  paper.cur = [paper.erase ? ERASE : paper.color, SIZES[paper.size] * (paper.erase ? 1.6 : 1), x, y];
  paper.strokes.push(paper.cur);
  const g = paper.cv.getContext('2d'); strokePath(g, paper.cur, paper.cv.width / LW);
});
paper.cv.addEventListener('pointermove', (e) => {
  const s = paper.cur; if (!s) return;
  const co = e.getCoalescedEvents?.() || [], evs = co.length ? co : [e]; // 빠르게 그어도 점이 빠지지 않게
  const g = paper.cv.getContext('2d'), k = paper.cv.width / LW;
  for (const ev of evs) {
    const [x, y] = toLocal(ev), px = s[s.length - 2], py = s[s.length - 1];
    if (Math.hypot(x - px, y - py) < 3) continue;
    s.push(x, y);
    g.strokeStyle = colOf(s[0]); g.lineWidth = s[1] * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(px * k, py * k); g.lineTo(x * k, y * k); g.stroke();
  }
  if (Math.random() < 0.15) S.sfx('pen');
});
const endStroke = () => { if (paper.cur) { paper.cur = null; render(paper.cv, paper.strokes); } };
paper.cv.addEventListener('pointerup', endStroke); paper.cv.addEventListener('pointercancel', endStroke);
function tools() {
  $('palette').innerHTML = PAL.map((c, i) => `<button data-c="${i}" style="background:${c}" class="${!paper.erase && i === paper.color ? 'on' : ''}"></button>`).join('');
  $('sizes').innerHTML = SIZES.map((s, i) => `<button data-s="${i}" class="${i === paper.size ? 'on' : ''}"><i style="width:${4 + i * 6}px;height:${4 + i * 6}px"></i></button>`).join('');
  $('t-erase').classList.toggle('on', paper.erase);
  $('palette').querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { paper.color = +b.dataset.c; paper.erase = false; tools(); }; });
  $('sizes').querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => { paper.size = +b.dataset.s; tools(); }; });
}
$('t-erase').onclick = () => { paper.erase = !paper.erase; tools(); };
$('t-undo').onclick = () => { paper.strokes.pop(); render(paper.cv, paper.strokes); };
$('t-clear').onclick = () => { if (paper.strokes.length && confirm('다 지울까요?')) { paper.strokes = []; render(paper.cv, paper.strokes); } };
window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && game.kind === 'draw') { e.preventDefault(); $('t-undo').click(); } });
function layoutPaper() {
  const maxW = Math.min(900, innerWidth - 32), maxH = innerHeight - (innerWidth < 700 ? 300 : 260);
  fitCanvas(paper.cv, maxW, Math.max(200, maxH)); render(paper.cv, paper.strokes);
}
window.addEventListener('resize', () => { if (game.kind === 'draw' && !game.submitted) layoutPaper(); });

// ---------- 단계 ----------
function stage(id) { for (const s of ['st-word', 'st-draw', 'st-guess', 'st-wait', 'st-reveal', 'st-ai']) $(s).classList.toggle('hidden', s !== id); }
const nameOf = (id) => game.players.get(id)?.name || '누군가';
function renderReady(done = new Set()) {
  $('ready').innerHTML = game.order.map((id) => { const p = game.players.get(id); return p ? `<span class="rd${done.has(id) ? ' ok' : ''}" title="${esc(p.name)}">${faceHtml(p, 32)}</span>` : ''; }).join('');
}
function setTimer(ms) { game.dl = performance.now() + ms; game.dlTotal = ms; }
const KIND_LABEL = { word: '📖 제시어 고르기', draw: '🎨 그리기', guess: '🤔 맞히기' };
function onPhase(m) {
  game.k = m.k; game.kind = m.kind; game.submitted = false; game.done = new Set(); game.prompt = m.prompt;
  $('step').textContent = `${m.k + 1} / ${m.steps} · ${KIND_LABEL[m.kind]}`;
  setTimer(m.dl); renderReady();
  $('head').classList.remove('hidden');
  if (m.kind === 'word') {
    stage('st-word');
    $('choices').innerHTML = (m.choices || []).map((w) => `<button type="button" data-w="${esc(w)}">${esc(w)}</button>`).join('');
    $('choices').querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => submit(b.dataset.w); });
    $('word-in').value = ''; game.firstChoice = m.choices?.[0];
  } else if (m.kind === 'draw') {
    stage('st-draw');
    const t = m.prompt?.text;
    $('draw-q').innerHTML = t ? `🎨 <b>「${esc(t)}」</b> 을(를) 그려요!` : '🎨 자유롭게 그려요! (앞 사람이 비워 뒀어요)';
    paper.strokes = []; paper.cur = null; paper.erase = false; tools(); layoutPaper();
  } else {
    stage('st-guess');
    $('guess-by').textContent = `${nameOf(m.prompt?.by)}의 그림`;
    const cv = $('view'); fitCanvas(cv, Math.min(820, innerWidth - 32), innerHeight - 280); render(cv, m.prompt?.strokes || []);
    $('guess-in').value = ''; $('guess-in').focus();
  }
  S.sfx('page');
}
function submit(text) {
  if (game.submitted || game.k < 0) return;
  game.submitted = true;
  const msg = { t: 'sub', k: game.k };
  if (game.kind === 'draw') msg.strokes = paper.strokes; else msg.text = text;
  shell.send(msg); S.sfx('ok');
  stage('st-wait'); renderWait();
}
function renderWait() { $('wait-faces').innerHTML = game.order.map((id) => { const p = game.players.get(id); return p ? `<span class="rd${game.done.has(id) ? ' ok' : ''}">${faceHtml(p, 56)}</span>` : ''; }).join(''); }
$('word-form').onsubmit = (e) => { e.preventDefault(); const v = $('word-in').value.trim(); if (v) submit(v); };
$('guess-form').onsubmit = (e) => { e.preventDefault(); const v = $('guess-in').value.trim(); if (v) submit(v); };
$('draw-done').onclick = () => {
  if (game.solo) return soloDone();
  if (!paper.strokes.length && !confirm('아무것도 안 그렸어요. 이대로 낼까요?')) return;
  submit();
};
// 시간이 다 되면 지금 것으로 낸다
function autoSubmit() {
  if (game.submitted) return;
  if (game.solo) return soloDone();
  if (game.kind === 'word') submit($('word-in').value.trim() || game.firstChoice);
  else if (game.kind === 'draw') submit();
  else submit($('guess-in').value.trim() || '(모르겠어요)');
}
let lastSec = -1;
function frame(now) {
  requestAnimationFrame(frame);
  if (game.mode !== 'play' || game.kind === 'reveal') return;
  const left = Math.max(0, game.dl - now);
  $('timer').firstElementChild.style.width = `${(left / game.dlTotal) * 100}%`;
  $('timer').classList.toggle('hurry', left < 8000);
  const sec = Math.ceil(left / 1000);
  if (sec !== lastSec && sec <= 5 && sec > 0 && !game.submitted) S.sfx('clock');
  lastSec = sec;
  if (left <= 0 && !game.submitted && game.k >= 0) autoSubmit();
}
requestAnimationFrame(frame);

// ---------- 함께 넘겨 보기 ----------
function onReveal(m) {
  game.kind = 'reveal'; game.books = m.books; game.steps = m.steps; game.host = m.host; game.likes = {}; game.myLikes = new Set();
  $('head').classList.add('hidden');
  stage('st-reveal'); showRv(0, 0); S.sfx('start');
}
function itemHtml(b, i) {
  const it = game.books[b].items[i]; if (!it) return '';
  const p = game.players.get(it.by) || { name: '누군가', color: '#999' };
  const key = `${b}:${i}`, n = game.likes[key] || 0, mine = it.by === game.myId;
  const same = i === game.steps - 1 && it.kind !== 'draw' && norm(it.text) && norm(it.text) === norm(game.books[b].items[0]?.text);
  const label = it.kind === 'word' ? '제시어' : it.kind === 'draw' ? '그림' : '맞힌 답';
  const body = it.kind === 'draw' ? `<div class="rv-draw"><canvas data-b="${b}" data-i="${i}"></canvas></div>` : `<div class="txt">${esc(it.text)}<small>${label}</small></div>`;
  return `<div class="rv${same ? ' same' : ''}"><div class="who">${faceHtml(p, 48)}<span>${esc(p.name)}</span></div>${body}${mine ? '' : `<button class="like${game.myLikes.has(key) ? ' on' : ''}" data-like="${key}">❤️ ${n || ''}</button>`}</div>`;
}
const norm = (s) => String(s || '').replace(/[^가-힣a-zA-Z0-9]/g, '').toLowerCase();
function showRv(b, i) {
  game.rv = { b, i };
  const book = game.books[b];
  $('rv-title').innerHTML = `📚 ${esc(nameOf(book.owner))}의 그림책 <small style="font-size:16px;opacity:.7">(${b + 1}/${game.books.length})</small>`;
  const el = $('rv-items');
  el.innerHTML = Array.from({ length: i + 1 }, (_, k) => itemHtml(b, k)).join('');
  el.querySelectorAll('canvas[data-b]').forEach((cv) => { fitCanvas(cv, Math.min(560, innerWidth - 140), 420); render(cv, game.books[+cv.dataset.b].items[+cv.dataset.i].strokes); });
  el.querySelectorAll('[data-like]').forEach((bt) => { bt.onclick = () => { const [bb, ii] = bt.dataset.like.split(':').map(Number); shell.send({ t: 'like', b: bb, i: ii }); }; });
  el.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const host = game.host === game.myId, lastItem = i >= game.steps - 1, lastBook = b >= game.books.length - 1;
  $('rv-next').classList.toggle('hidden', !host);
  $('rv-next').textContent = lastItem ? (lastBook ? '🏁 결과 보기' : '📚 다음 그림책') : '다음 ▶';
  $('rv-wait').classList.toggle('hidden', host);
  if (i === game.steps - 1 && el.querySelector('.rv.same')) { confetti(60); S.sfx('win'); } else S.sfx('page');
}
$('rv-next').onclick = () => {
  const { b, i } = game.rv;
  if (i < game.steps - 1) shell.send({ t: 'rv', b, i: i + 1 });
  else if (b < game.books.length - 1) shell.send({ t: 'rv', b: b + 1, i: 0 });
  else shell.send({ t: 'endrv' });
};

// ---------- 혼자 그려보기 (AI 젤리봇이 맞힌다) ----------
function soloStart() {
  S.unlock();
  game.mode = 'play'; game.solo = true; game.k = 0; game.kind = 'draw'; game.submitted = false; game.order = []; game.answer = pickPrompts(1)[0];
  shell.hideScreens(); $('game').classList.remove('hidden'); $('head').classList.remove('hidden');
  $('step').textContent = '🎨 혼자 그려보기 · AI 젤리봇이 맞혀요'; $('ready').innerHTML = '';
  stage('st-draw'); $('draw-q').innerHTML = `🎨 <b>「${esc(game.answer)}」</b> 을(를) 그려요!`;
  paper.strokes = []; paper.erase = false; tools(); layoutPaper(); setTimer(60000); S.music('draw');
}
async function soloDone() {
  if (game.submitted) return; game.submitted = true;
  stage('st-ai'); $('head').classList.add('hidden');
  $('ai-q').innerHTML = `🤖 AI 젤리봇이 보는 중…`; $('ai-say').innerHTML = '음… 🤔';
  const v = $('ai-view'); fitCanvas(v, Math.min(520, innerWidth - 40), 390); render(v, paper.strokes);
  const small = document.createElement('canvas'); small.width = 512; small.height = 384; render(small, paper.strokes);
  try {
    const r = await account.api('/api/draw/guess', { method: 'POST', body: { img: small.toDataURL('image/jpeg', 0.8), answer: game.answer } });
    const ok = r.hit >= 0;
    $('ai-q').innerHTML = ok ? `🎉 정답! 「${esc(game.answer)}」` : `😅 아쉬워요! 정답은 「${esc(game.answer)}」`;
    $('ai-say').innerHTML = `${esc(r.comment)}<br>${r.guesses.map((g, i) => (i === r.hit ? `<b>✔ ${esc(g)}</b>` : `· ${esc(g)}`)).join('<br>')}`;
    if (ok) { confetti(); S.sfx('win'); } else S.sfx('lose');
  } catch (e) { $('ai-q').textContent = '🤖 AI 젤리봇이 지금은 쉬고 있어요'; $('ai-say').textContent = e.message; }
}
$('ai-again').onclick = () => soloStart();
$('ai-home').onclick = () => toTitle();

// ---------- 공용 틀 ----------
function countdown(ms) {
  const el = $('count'), n = $('count-n'); el.classList.remove('hidden');
  const t0 = performance.now();
  const tk = () => { const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000); if (left <= 0) { el.classList.add('hidden'); return; } if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); } setTimeout(tk, 60); };
  tk();
}
function start(m) {
  game.mode = 'play'; game.solo = false; game.myId = shell.myId; game.k = -1; game.kind = '';
  game.players.clear(); for (const mem of m.members) game.players.set(mem.id, mem);
  game.order = m.order; game.steps = m.steps;
  shell.hideScreens(); $('game').classList.remove('hidden'); $('head').classList.remove('hidden');
  $('step').textContent = `그림책 ${m.order.length}권 · ${m.steps}단계`; renderReady(); stage('st-wait'); $('wait-faces').innerHTML = '';
  countdown(m.in); S.music('draw');
}
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellydraw', title: '🎨 젤리 그림릴레이', subtitle: '제시어 → 그림 → 맞히기 → 그림…<br>그림책이 돌고 나면 얼마나 바뀌었는지 함께 봐요!', wsPath: '/draw-ws', max: 8,
  multiLabel: '👥 같이 하기 (2~8명)', roomIcon: '🎨', startLabel: '🎨 그림릴레이 시작!',
  keysHelp: '마우스 · 손가락으로 그리기 · Ctrl+Z 되돌리기 · 텔레스트레이션처럼 모두 동시에 각자 다른 그림책을 이어요',
  buttons: [{ id: 'solo-btn', label: '🎨 혼자 그려보기 <small>AI 젤리봇이 맞혀요</small>', onClick: () => soloStart() }],
  describe: (o = {}) => `🎨 그리기 ${o.draw || 80}초`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode === 'play' && !game.solo) toTitle(); },
});
shell.pickOpts = () => ({ ...game.pick });
shell.on('phase', (m) => onPhase(m));
shell.on('done', (m) => { game.done?.add(m.id); renderReady(game.done); if (game.submitted) renderWait(); });
shell.on('reveal', (m) => onReveal(m));
shell.on('rv', (m) => showRv(m.b, m.i));
shell.on('like', (m) => {
  const key = `${m.b}:${m.i}`; game.likes[key] = m.n;
  if (m.by === game.myId) { if (m.on) game.myLikes.add(key); else game.myLikes.delete(key); }
  const bt = document.querySelector(`[data-like="${key}"]`);
  if (bt) { bt.textContent = `❤️ ${m.n || ''}`; bt.classList.toggle('on', game.myLikes.has(key)); bt.classList.remove('bump'); void bt.offsetWidth; bt.classList.add('bump'); }
  S.sfx('heart');
});
shell.on('gone', (m) => { const p = game.players.get(m.id); if (p) p.name += ' (나감)'; });
function optsUI(el, o, editable, set) {
  el.innerHTML = `<div class="seg">${[60, 80, 100].map((t) => `<button data-d="${t}" class="${t === (o.draw || 80) ? 'on' : ''}" ${editable ? '' : 'disabled'}>🎨 ${t}초</button>`).join('')}</div>`;
  el.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => set({ draw: +b.dataset.d }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }); }
function results(m) {
  game.mode = 'over'; game.kind = ''; S.stopMusic(); $('game').classList.add('hidden');
  const best = m.best;
  $('ov-best').innerHTML = best ? `<div class="ptitle" style="font-size:22px">❤️ 인기상 · ${esc(nameOf(best.by))} (${best.n}표)</div>${best.kind === 'draw' ? '<canvas id="ov-cv"></canvas>' : `<div class="big-q">「${esc(best.text)}」</div>`}` : '';
  if (best?.kind === 'draw') { const cv = $('ov-cv'); fitCanvas(cv, 360, 270); render(cv, best.strokes); }
  $('ov-perfect').textContent = m.perfect?.length ? `🎯 끝까지 그대로 전해진 그림책: ${m.perfect.map((x) => `${nameOf(x.owner)}의 「${x.word}」`).join(', ')}` : '🌀 모든 그림책이 무언가로 변신했어요!';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${esc(e.name)}</span><span class="sc">${e.hearts}<small>❤️</small></span></div>`).join('');
  if (best && best.by === game.myId) confetti();
  S.sfx('win');
  shell.show('over');
}
$('again-btn').onclick = () => { game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { if (!game.solo) { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() { game.mode = 'title'; game.solo = false; game.kind = ''; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (game.mode === 'play' && !game.solo && !confirm('그림릴레이에서 나갈까요?')) return; quit(); };
document.addEventListener('pointerdown', () => S.unlock(), { once: true });

tools(); renderTitleOpts();
shell.boot();
