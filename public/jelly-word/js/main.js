// 젤리 끝말잇기: 차례대로 끝 글자를 이어요 · 두음법칙 · 사전 확인 · 젤리 하트 · 젤리봇과 연습 · 같이 최대 8명
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellyword');
const PICK_KEY = 'jellyword.pick';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.word = {
  mode: 'title', players: new Map(), order: [], turn: 0, need: '', starts: [], dl: 0, dlTotal: 1, myId: 0, practice: false,
  pick: { bots: pick0.bots ?? 2, speed: pick0.speed || 'normal', lives: pick0.lives || 3 },
};
for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// ---------- 화면 ----------
const hearts = (n, max) => Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'gone'}">🍬</span>`).join('');
function renderPlayers() {
  $('players').innerHTML = game.order.map((id) => {
    const p = game.players.get(id); if (!p) return '';
    return `<div class="pl${id === game.turn ? ' turn' : ''}${id === game.myId ? ' me' : ''}${p.out ? ' out' : ''}" id="pl-${id}">${p.say ? `<div class="say${p.sayBad ? ' bad' : ''}">${esc(p.say)}</div>` : ''}${faceHtml(p, 56)}<div class="nm">${p.bot ? '🤖 ' : ''}${esc(p.name)}</div><div class="hp">${hearts(p.lives, game.maxLives)}</div><div class="sc">${p.score}점</div></div>`;
  }).join('');
}
function say(id, text, bad) { const p = game.players.get(id); if (!p) return; p.say = text; p.sayBad = !!bad; renderPlayers(); clearTimeout(p.sayT); if (bad || !text) p.sayT = setTimeout(() => { p.say = ''; renderPlayers(); }, bad ? 1600 : 0); }
function setNeed(need, starts) {
  game.need = need; game.starts = starts || [need];
  const el = $('need'); el.textContent = need; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  $('need-alt').textContent = game.starts.length > 1 ? `두음법칙: '${game.starts.slice(1).join("', '")}'(으)로도 시작할 수 있어요` : '';
}
function addCap(w, by, pts) {
  const el = $('chain');
  if (el.children.length) el.insertAdjacentHTML('beforeend', '<i class="link"></i>');
  const p = by ? game.players.get(by) : null;
  const html = p
    ? `<div class="cap" style="--c:${esc(p.color)}">${faceHtml(p, 34)}<span>${esc(w.slice(0, -1))}<b>${esc(w.at(-1))}</b></span>${pts ? `<span class="pts">+${pts}</span>` : ''}</div>`
    : `<div class="cap sys">✨ ${esc(w.slice(0, -1))}<b>${esc(w.at(-1))}</b></div>`;
  el.insertAdjacentHTML('beforeend', html);
  const wrap = $('chain-wrap'); requestAnimationFrame(() => wrap.scrollTo({ left: wrap.scrollWidth, behavior: 'smooth' }));
}
function setTurn(id, dl) {
  game.turn = id; game.dl = performance.now() + dl; game.dlTotal = dl; game.checking = false;
  for (const p of game.players.values()) { if (!p.sayBad) p.say = ''; }
  renderPlayers();
  const p = game.players.get(id), mine = id === game.myId;
  $('turn-info').innerHTML = mine ? '🫵 내 차례! 단어를 이어요' : `${p?.bot ? '🤖 ' : ''}${esc(p?.name || '')}의 차례`;
  const inp = $('word-in');
  inp.disabled = !mine; $('word-btn').disabled = !mine;
  inp.value = ''; inp.placeholder = mine ? `'${game.starts.join("' · '")}'(으)로 시작하는 단어` : '내 차례를 기다려요…';
  $('word-msg').textContent = ''; $('word-msg').className = '';
  if (mine) { inp.focus(); S.sfx('turn'); }
}

// ---------- 입력 ----------
let tyT = 0;
$('word-in').addEventListener('input', () => {
  const now = performance.now(); S.sfx('type');
  if (now - tyT > 140) { tyT = now; shell.send({ t: 'ty', s: $('word-in').value }); }
});
$('input-bar').addEventListener('submit', (e) => {
  e.preventDefault();
  const w = $('word-in').value.trim().replace(/\s/g, '');
  if (!w || game.turn !== game.myId || game.checking) return;
  if (!game.starts.includes(w[0])) { bad(`'${game.starts.join("' · '")}'(으)로 시작해야 해요`); return; }
  game.checking = true; $('word-msg').textContent = '📖 사전 확인 중…'; $('word-msg').className = '';
  shell.send({ t: 'w', w });
});
function bad(msg) { const inp = $('word-in'); inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); $('word-msg').textContent = `❌ ${msg}`; $('word-msg').className = ''; S.sfx('bad'); inp.select(); }

// Enter: 내 차례면 입력 칸을 직접 누르지 않아도 바로 단어를 쓴다 (채팅보다 먼저)
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing || game.mode !== 'play' || game.turn !== game.myId) return;
  const a = document.activeElement, inp = $('word-in');
  if (a === inp || (a && ['INPUT', 'TEXTAREA'].includes(a.tagName))) return; // 채팅 칸에 쓰는 중이면 그대로
  e.preventDefault(); e.stopImmediatePropagation(); inp.focus();
}, true);
// ---------- 흐름 ----------
let lastSec = -1;
function frame(now) {
  requestAnimationFrame(frame);
  if (game.mode !== 'play') return;
  const left = Math.max(0, game.dl - now), k = left / game.dlTotal;
  $('timer').firstElementChild.style.width = `${k * 100}%`;
  $('timer').classList.toggle('hurry', left < 3000);
  const sec = Math.ceil(left / 1000);
  if (sec !== lastSec && sec <= 3 && sec > 0 && game.turn === game.myId) S.sfx('clock');
  lastSec = sec;
}
requestAnimationFrame(frame);
function countdown(ms) {
  const el = $('count'), n = $('count-n'); el.classList.remove('hidden');
  const t0 = performance.now();
  const tk = () => {
    const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000);
    if (left <= 0) { n.textContent = '시작!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 500); return; }
    if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); }
    setTimeout(tk, 60);
  };
  tk();
}
function start(m) {
  game.mode = 'play'; game.myId = shell.myId; game.practice = !!shell.room?.name?.endsWith('의 연습');
  game.maxLives = m.lives; game.players.clear();
  for (const mem of m.members) game.players.set(mem.id, { ...mem, lives: m.lives, score: 0, out: false, say: '' });
  game.order = m.order;
  shell.hideScreens(); $('game').classList.remove('hidden');
  $('chain').innerHTML = '';
  for (const c of m.chain) addCap(c.w, c.by);
  setNeed(m.need, m.starts);
  setTurn(m.turn, m.dl);
  countdown(m.in); S.sfx('start'); S.music('word');
}
const practice = () => { S.unlock(); shell.sendAfterHello({ t: 'practice', opts: { ...game.pick, bots: Math.max(1, game.pick.bots) } }); };

const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellyword', title: '🔤 젤리 끝말잇기', subtitle: '끝 글자로 시작하는 낱말을 차례대로 이어요!<br>시간 안에 못 이으면 젤리 하트가 하나씩 녹아요', wsPath: '/word-ws', max: 8,
  multiLabel: '👥 같이 하기', roomIcon: '🔤', startLabel: '🔤 끝말잇기 시작!',
  keysHelp: '내 차례엔 Enter 만 눌러도 바로 단어 칸 · 두 글자 이상 낱말 (외래어 · 사람 이름 · 캐릭터 이름도 OK) · 한 번 나온 단어는 다시 못 써요 · 두음법칙 인정 (력 → 역)',
  buttons: [{ id: 'bot-btn', label: '🤖 젤리봇과 하기 <small>바로 연습</small>', onClick: () => practice() }],
  describe: (o = {}) => `${o.speed === 'fast' ? '⚡ 빠르게' : '🐢 보통'} · 🍬 ${o.lives || 3} · 🤖 ${o.bots || 0}`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode === 'play') toTitle(); },
  onChatClose: () => { if (game.mode === 'play' && game.turn === game.myId) $('word-in').focus(); }, // 채팅을 닫으면 다시 단어 칸으로
});
shell.pickOpts = () => ({ ...game.pick });
shell.on('ty', (m) => { if (m.id !== game.turn) return; say(m.id, m.s || '…'); if (m.id !== game.myId) S.sfx('type'); });
shell.on('chk', (m) => { say(m.id, `${m.w} 📖`); });
shell.on('no', (m) => {
  if (m.id === game.myId) { game.checking = false; bad(m.why); }
  say(m.id, `${m.w} ✗`, true);
  document.getElementById(`pl-${m.id}`)?.classList.add('shake');
});
shell.on('ok', (m) => {
  const p = game.players.get(m.id); if (p) { p.score = m.score; p.say = ''; p.sayBad = false; }
  addCap(m.w, m.id, m.pts); S.sfx('ok');
  if (m.id === game.myId) { $('word-msg').textContent = m.loose ? '⭕ 인정! (사전 확인 없이)' : `⭕ +${m.pts}점`; $('word-msg').className = 'good'; }
  setNeed(m.need, m.starts); setTurn(m.turn, m.dl);
});
shell.on('miss', (m) => {
  const p = game.players.get(m.id); if (!p) return;
  p.lives = m.lives; p.out = m.out; p.say = m.out ? '탈락 😵' : '시간 초과!'; p.sayBad = true;
  renderPlayers(); document.getElementById(`pl-${m.id}`)?.classList.add('hurt');
  $('game').classList.remove('flash'); void $('game').offsetWidth; $('game').classList.add('flash');
  S.sfx('miss'); shell.toast(m.out ? `😵 ${p.name} 탈락!` : `💧 ${p.name}의 젤리 하트가 녹았어요`, 1400);
});
shell.on('new', (m) => { if (m.w) addCap(m.w, 0); setNeed(m.need, m.starts); setTimeout(() => setTurn(m.turn, m.dl - 0), 0); });
shell.on('gone', (m) => { const p = game.players.get(m.id); if (p) { p.out = true; p.name += ' (나감)'; renderPlayers(); } });

function optsUI(el, o, editable, set) {
  const dis = editable ? '' : 'disabled';
  el.innerHTML = `<div class="seg"><button data-s="normal" class="${o.speed !== 'fast' ? 'on' : ''}" ${dis}>🐢 보통</button><button data-s="fast" class="${o.speed === 'fast' ? 'on' : ''}" ${dis}>⚡ 빠르게</button></div>
    <div class="opt-row">🍬 젤리 하트 ${[1, 2, 3, 5].map((n) => `<button class="pm" data-l="${n}" style="${n === (o.lives || 3) ? 'background:#ffd84d;color:#2b1d5c' : ''}" ${dis}>${n}</button>`).join('')}</div>
    <div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div>`;
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => set({ speed: b.dataset.s }); });
  el.querySelectorAll('[data-l]').forEach((b) => { b.onclick = () => set({ lives: +b.dataset.l }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(4, (o.bots || 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }); }

// ---------- 결과 ----------
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden'); $('count').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  game.lastPractice = !!m.practice;
  $('ov-title').textContent = `🏆 ${m.rank[0]?.name || ''} 우승!`;
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · ${mine.words}단어 · ${mine.score}점` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${e.bot ? '🤖 ' : ''}${esc(e.name)} <small style="opacity:.7">${'🍬'.repeat(e.lives)}</small></span><span class="sc">${e.score}<small>점 · ${e.words}단어</small></span></div>`).join('');
  $('ov-stat').textContent = `이어진 단어 ${m.chain}개${m.longest ? ` · 가장 긴 단어 「${m.longest.w}」` : ''}`;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
}
$('again-btn').onclick = () => { if (game.lastPractice) return practice(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() { game.mode = 'title'; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => quit();
document.addEventListener('pointerdown', () => S.unlock(), { once: true });

renderTitleOpts();
shell.boot();
