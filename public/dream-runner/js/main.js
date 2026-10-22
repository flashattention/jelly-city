// 드림 러너: 잠든 곰돌이가 꿈속을 끝없이 달린다
//   혼자 달리기 · 같이 달리기(방, 최대 12명: 같은 길 · 같은 꿈 · 서로 밀치기) · 최고 기록 순위표
import * as THREE from 'three';
import { account, store } from '../../shared/js/account.js';
import { Env } from './env.js';
import { Track, speedAt, V0 } from './track.js';
import { Runner, Ghost } from './runner.js';
import { THEMES } from './themes.js';
import { sfx, setMusic, unlock, toggleMute, sound } from './music.js';

const $ = (id) => document.getElementById(id);
const CHAR_KEY = 'dreamrunner.char', NICK_KEY = 'dreamrunner.nick';

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

const env = new Env(scene, renderer);
const track = new Track(scene, env, (Math.random() * 2 ** 31) | 0);
env.originRef = track;
const runner = new Runner(scene, {});
env.setTheme(track.themeOf(0), true);

const game = window.dream = {
  mode: 'title',       // title · count · run · dead · over
  multi: false, seed: 0, runT: 0, countT: 0, dream: 0, dreamsSeen: 1,
  ghosts: new Map(), myId: 0, room: null, members: [],
  profile: { name: '꿈꾸는 곰돌이', color: '#8a5634' },
  titleT: 0, deadT: 0, submitted: null, sendT: 0, bumpT: 0,
};
game.runner = runner; game.track = track; game.env = env; window.__THEMES = THEMES; // 점검용 (콘솔에서 dream.runner 등)

// ---------- 입력 ----------
const keys = new Set();
const input = { dir: 0, jump: false, slide: false, slideHeld: false, shove: false };
const isTyping = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
window.addEventListener('keydown', (e) => {
  if (isTyping()) return;
  unlock();
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
  keys.add(e.code);
  if (['Space', 'KeyW', 'ArrowUp'].includes(e.code)) input.jump = true;
  if (['KeyS', 'ArrowDown'].includes(e.code)) input.slide = true;
  if (['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code)) input.shove = true;
  if (e.code === 'KeyM') muteBtn();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (game.mode === 'over' && (e.code === 'Space' || e.code === 'Enter') && !game.multi) { e.preventDefault(); startSolo(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function readInput() {
  const L = keys.has('KeyA') || keys.has('ArrowLeft') || touchHeld.has('left');
  const Rt = keys.has('KeyD') || keys.has('ArrowRight') || touchHeld.has('right');
  input.dir = (Rt ? 1 : 0) - (L ? 1 : 0);
  input.slideHeld = keys.has('KeyS') || keys.has('ArrowDown') || touchHeld.has('slide');
}
// 휴대폰: 버튼 + 밀어서(스와이프) 점프·숙이기
const touchHeld = new Set();
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
for (const b of document.querySelectorAll('#touch button')) {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); touchHeld.add(k); if (k === 'jump') input.jump = true; if (k === 'slide') input.slide = true; if (k === 'shove') input.shove = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => touchHeld.delete(k));
}
let swipe = null;
$('c').addEventListener('pointerdown', (e) => { unlock(); swipe = { x: e.clientX, y: e.clientY }; });
$('c').addEventListener('pointerup', (e) => {
  if (!swipe || game.mode !== 'run') return;
  const dy = e.clientY - swipe.y;
  if (dy < -40) input.jump = true; else if (dy > 40) input.slide = true;
  swipe = null;
});

// ---------- 화면 ----------
const screens = ['title', 'lobby', 'room', 'over', 'board'];
function show(id) { for (const s of screens) $(s).classList.toggle('hidden', s !== id); }
function hideScreens() { for (const s of screens) $(s).classList.add('hidden'); }
function toast(text, ms = 1600) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), ms); }
function err(text) { $('err').textContent = text || ''; }
function muteBtn() { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; }
$('b-mute').onclick = muteBtn;
$('b-mute').textContent = sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (game.multi) { net.send({ t: 'leave' }); leaveRun(); show('lobby'); net.send({ t: 'list' }); } else toTitle(); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 로그인 · 캐릭터 ----------
async function boot() {
  let status = {};
  try { status = await account.status(); } catch { err('서버에 연결할 수 없어요'); }
  game.status = status;
  const ok = await account.restore();
  // 점검용: ?autostart&name=이름 (개발 서버에서만)
  const q = new URLSearchParams(location.search);
  if (!ok && q.has('autostart') && status.devLogin) { try { await account.login({ dev: q.get('name') || '러너' }); } catch (e) { err(e.message); } }
  renderAccount();
}
function renderAccount() {
  const logged = !!account.session && !!account.user;
  $('login-box').classList.toggle('hidden', logged);
  $('me-box').classList.toggle('hidden', !logged);
  if (!logged) {
    const s = game.status || {};
    if (s.googleClientId) account.googleButton($('g-btn'), s.googleClientId, () => renderAccount(), (e) => err(e.message)).catch(() => err('구글 로그인 버튼을 불러오지 못했어요'));
    else $('g-btn').innerHTML = '';
    $('dev-box').classList.toggle('hidden', !s.devLogin);
    return;
  }
  $('me-name').textContent = account.user.name;
  const chars = account.chars || [];
  let sel = store.get(CHAR_KEY) || (chars[0]?.token ?? 'default');
  if (sel !== 'default' && !chars.some((c) => c.token === sel)) sel = chars[0]?.token ?? 'default';
  const box = $('chars'); box.innerHTML = '';
  const chip = (token, name, color) => {
    const b = document.createElement('button');
    b.className = 'chip' + (token === sel ? ' on' : '');
    b.innerHTML = `<span class="dot" style="background:${esc(color)}"></span>${esc(name)}`;
    b.onclick = () => { store.set(CHAR_KEY, token); renderAccount(); };
    box.appendChild(b);
  };
  for (const c of chars) chip(c.token, c.name, c.profile?.color || '#8a5634');
  chip('default', '🐻 기본 곰돌이', '#8a5634');
  const c = chars.find((x) => x.token === sel);
  $('nick-row').classList.toggle('hidden', !!c);
  if (!$('nick').value) {
    // 기본 이름: 체험판은 손님 이름, 아니면 번호 붙은 곰돌이 (구글 실명은 순위표에 안 보이게)
    let nick = store.get(NICK_KEY);
    if (!nick) { nick = account.user.name?.startsWith('체험판') ? account.user.name : `꿈꾸는 곰돌이 ${1000 + Math.floor(Math.random() * 9000)}`; store.set(NICK_KEY, nick); }
    $('nick').value = nick;
  }
  game.profile = c ? { name: c.name, color: c.profile?.color || '#8a5634', look: c.profile?.look, acc: c.profile?.accessories || [], gender: c.profile?.gender } : { name: $('nick').value.trim() || '꿈꾸는 곰돌이', color: '#8a5634' };
  runner.setLook(game.profile);
}
$('nick').addEventListener('input', () => { store.set(NICK_KEY, $('nick').value.trim()); if (!$('nick-row').classList.contains('hidden')) game.profile.name = $('nick').value.trim() || '꿈꾸는 곰돌이'; });
$('guest-btn').onclick = async () => { try { await account.login({ guest: true }); renderAccount(); } catch (e) { err(e.message); } };
$('dev-btn').onclick = async () => { try { await account.login({ dev: $('dev-name').value || '러너' }); renderAccount(); } catch (e) { err(e.message); } };
$('logout').onclick = async () => { await account.logout(); renderAccount(); };
$('solo-btn').onclick = () => { unlock(); startSolo(); };
$('multi-btn').onclick = () => { unlock(); openLobby(); };
$('board-btn').onclick = async () => { show('board'); renderBoard($('board-list'), await loadBoard()); };
$('board-close').onclick = () => show('title');
$('home-btn').onclick = () => { if (game.multi) { net.send({ t: 'leave' }); game.multi = false; } toTitle(); };
$('again-btn').onclick = () => { if (game.multi) { leaveRun(); show('room'); } else startSolo(); };

// ---------- 순위표 ----------
async function loadBoard() { try { return await account.api('/api/dream/board'); } catch { return { top: [] }; } }
function renderBoard(el, d, hl) {
  const top = d.top || [], me = d.me;
  const myId = me?.id;
  const row = (e) => `<div class="brow${e.id === myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : ''}</span><span class="sc">${e.score.toLocaleString()}<small>${e.dist.toLocaleString()}m · ⭐${e.stars}</small></span></div>`;
  let html = top.slice(0, hl ? 10 : 50).map(row).join('');
  if (me && me.rank > (hl ? 10 : 50)) html += '<div class="brow gap">⋯</div>' + row(me);
  el.innerHTML = html || '<div class="empty">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</div>';
}

// ---------- 시작 · 끝 ----------
function newRun(seed) {
  game.seed = seed;
  for (const g of game.ghosts.values()) g.remove();
  game.ghosts.clear();
  env.clear();
  track.reset(seed);
  runner.reset(0, 0);
  game.dream = 0; game.dreamsSeen = 1; game.runT = 0; game.submitted = null;
  env.setTheme(track.themeOf(0), true);
  setMusic(track.themeOf(0).mus);
  $('h-alive').classList.toggle('hidden', !game.multi);
  $('t-shove').classList.toggle('hidden', !game.multi);
}
function startSolo() {
  if (!account.session) { show('title'); err('먼저 로그인하거나 체험판으로 시작해 주세요'); return; }
  game.multi = false;
  newRun((Math.random() * 2 ** 31) | 0);
  countdown(3000);
}
function countdown(ms) {
  hideScreens();
  game.mode = 'count'; game.countT = ms / 1000; game.countN = null;
  $('hud').classList.remove('hidden');
  if (document.body.classList.contains('touch')) $('touch').classList.remove('hidden');
  showDreamCard(0);
}
function goRun() { game.mode = 'run'; $('countdown').classList.add('hidden'); }
function toTitle() {
  game.mode = 'title'; game.multi = false;
  for (const g of game.ghosts.values()) g.remove(); game.ghosts.clear();
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('spectate').classList.add('hidden'); $('countdown').classList.add('hidden');
  newRun((Math.random() * 2 ** 31) | 0);
  game.mode = 'title';
  show('title'); renderAccount();
}
function leaveRun() {
  game.mode = 'over';
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('spectate').classList.add('hidden');
}
function score() { return Math.floor(runner.s) + runner.stars * 10; }

async function died(why) {
  sfx(why.includes('떨어') ? 'die' : 'bonk');
  game.mode = 'dead'; game.deadT = 0; game.why = why;
  const rec = { dist: Math.floor(runner.s), stars: runner.stars, themes: game.dreamsSeen, time: game.runT, name: game.profile.name, color: game.profile.color };
  if (game.multi) net.send({ t: 'dead', dist: rec.dist, stars: rec.stars, why });
  try { game.submitted = await account.api('/api/dream/score', { method: 'POST', body: rec }); } catch (e) { game.submitted = { error: e.message }; }
}
async function showOver() {
  game.mode = 'over';
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('spectate').classList.add('hidden');
  show('over');
  $('ov-why').textContent = `💤 ${game.why || '꿈에서 깼어요'}`;
  $('ov-score').textContent = score().toLocaleString();
  $('ov-detail').textContent = `${Math.floor(runner.s).toLocaleString()}m 달림 · 별사탕 ${runner.stars}개 · 꿈 ${game.dreamsSeen}개를 지났어요 · ${Math.floor(game.runT)}초`;
  const r = game.submitted;
  $('ov-best').textContent = r?.error ? `기록을 올리지 못했어요 (${r.error})` : r?.newBest ? `🎉 내 최고 기록! 전체 ${r.me?.rank}위` : r?.me ? `내 최고 ${r.me.score.toLocaleString()}점 · 전체 ${r.me.rank}위` : '';
  if (r?.newBest) sfx('best');
  $('again-btn').textContent = game.multi ? '👥 방으로 돌아가기' : '🔁 다시 달리기';
  renderBoard($('ov-board'), r?.top ? r : await loadBoard(), true);
}

// ---------- 꿈이 바뀔 때 ----------
function showDreamCard(d) {
  const th = track.themeOf(d);
  const el = $('dream-card');
  el.classList.add('hidden'); void el.offsetWidth;
  el.querySelector('.dc-n').textContent = `DREAM ${d + 1}`;
  el.querySelector('.dc-e').textContent = th.emoji;
  el.querySelector('.dc-name').textContent = th.name;
  el.classList.remove('hidden');
  $('h-dream-n').textContent = `꿈 #${d + 1}`;
  $('h-dream-name').textContent = `${th.emoji} ${th.name}`;
}
function enterDream(d) {
  game.dream = d; game.dreamsSeen = Math.max(game.dreamsSeen, d + 1);
  const th = track.themeOf(d);
  env.setTheme(th);
  setMusic(th.mus);
  sfx('portal');
  showDreamCard(d);
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.85'; void f.offsetWidth; f.style.transition = 'opacity .9s'; f.style.opacity = '0';
}

// ---------- 같이 달리기 (방) ----------
const net = {
  ws: null, open: false, handlers: {},
  connect() {
    if (this.ws && this.ws.readyState <= 1) return;
    this.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/dream-ws`);
    this.ws.onopen = () => { this.open = true; this.send({ t: 'hello', session: account.session, name: game.profile.name, color: game.profile.color, look: game.profile.look, acc: game.profile.acc }); };
    this.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.handlers[m.t]?.(m); };
    this.ws.onclose = () => { this.open = false; if (game.multi && game.mode !== 'title') { toast('연결이 끊겼어요'); setTimeout(() => { if (game.multi) toTitle(); }, 800); } };
  },
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); },
  on(t, f) { this.handlers[t] = f; },
};
function openLobby() {
  if (!account.session) { err('먼저 로그인하거나 체험판으로 시작해 주세요'); return; }
  game.multi = true;
  show('lobby'); $('rooms').innerHTML = '<div class="empty">방 목록을 불러오는 중…</div>';
  if (net.open) { net.send({ t: 'hello', session: account.session, name: game.profile.name, color: game.profile.color, look: game.profile.look, acc: game.profile.acc }); }
  else net.connect();
}
function renderRooms(list) {
  const el = $('rooms');
  if (!list.length) { el.innerHTML = '<div class="empty">열린 방이 없어요. 방을 만들거나 빠른 참가를 눌러 보세요!</div>'; return; }
  el.innerHTML = '';
  for (const r of list) {
    const d = document.createElement('div'); d.className = 'room';
    d.innerHTML = `<span class="nm">${esc(r.name)}</span><span class="meta">👑 ${esc(r.host)} · ${r.n}/${r.max}</span><span class="tag ${r.state === 'run' ? 'run' : ''}">${r.state === 'run' ? '달리는 중' : '기다리는 중'}</span>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '들어가기';
    b.disabled = r.state === 'run' || r.n >= r.max;
    b.onclick = () => net.send({ t: 'join', id: r.id });
    d.appendChild(b); el.appendChild(d);
  }
}
function renderRoom(rank) {
  const r = game.room; if (!r) return;
  $('room-title').textContent = `🌙 ${r.name}`;
  const me = game.members.find((m) => m.id === game.myId);
  const host = !!me?.host;
  const el = $('members'); el.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const m = game.members[i];
    const d = document.createElement('div');
    d.className = 'mem' + (m ? (m.id === game.myId ? ' me' : '') : ' slot');
    d.innerHTML = m ? `<span class="dot" style="background:${esc(m.color)}"></span>${m.host ? '👑 ' : ''}${esc(m.name)}` : '빈 자리';
    el.appendChild(d);
  }
  $('start-btn').classList.toggle('hidden', !host);
  $('room-hint').textContent = host ? `${game.members.length}명이 모였어요. 준비되면 출발을 눌러요! (혼자서도 시작할 수 있어요)` : '방장이 출발을 누르면 다 같이 달려요 🌙';
  if (rank) {
    $('room-rank').classList.remove('hidden');
    $('room-rank').innerHTML = '<h3>🏁 지난 판 순위</h3>' + rank.map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}</span><span class="sc">${e.dist.toLocaleString()}m<small>⭐${e.stars}</small></span></div>`).join('');
  }
}
net.on('hello', (m) => { game.myId = m.id; renderRooms(m.rooms); });
net.on('rooms', (m) => { if (!game.room) renderRooms(m.rooms); });
net.on('error', (m) => { if (m.code === 'login') { toast('로그인이 필요해요'); toTitle(); } else toast(m.text || '문제가 생겼어요'); });
net.on('joined', (m) => { game.room = m.room; game.members = m.members; $('room-rank').classList.add('hidden'); show('room'); renderRoom(); });
net.on('room', (m) => { game.room = m.room; game.members = m.members; if (game.mode !== 'run' && game.mode !== 'count' && game.mode !== 'dead') { if (!$('room').classList.contains('hidden') || !$('over').classList.contains('hidden')) renderRoom(); } });
net.on('left', () => { game.room = null; show('lobby'); net.send({ t: 'list' }); });
net.on('start', (m) => {
  game.members = m.members;
  newRun(m.seed);
  for (const mem of m.members) if (mem.id !== game.myId) game.ghosts.set(mem.id, new Ghost(scene, mem));
  game.alive = m.members.length;
  countdown(m.in);
});
net.on('snap', (m) => {
  const p = m.p;
  for (let i = 0; i + 5 < p.length; i += 6) {
    const g = game.ghosts.get(p[i]);
    if (g) g.snap(p[i + 1], p[i + 2], p[i + 3], p[i + 4], p[i + 5]);
  }
});
net.on('dead', (m) => {
  const g = game.ghosts.get(m.id);
  if (g) { g.alive = false; if (m.left) { g.remove(); game.ghosts.delete(m.id); } }
  if (m.id !== game.myId && game.mode !== 'over') { const who = game.members.find((x) => x.id === m.id); if (who) toast(`💤 ${who.name} 탈락${m.result ? ` · ${m.result.dist}m` : ''}`, 1400); }
});
net.on('shoved', (m) => { if (game.mode !== 'run' || !runner.alive) return; runner.shoved(m.dir); sfx('shoved'); const who = game.members.find((x) => x.id === m.by); toast(`🫸 ${who?.name || '누군가'}에게 밀쳐졌어요!`, 1000); });
net.on('shovefx', (m) => { const g = game.ghosts.get(m.by); if (g) g.shoveT = 0.3; });
net.on('finish', (m) => {
  // 모두 탈락: 방 안 순위 + 전체 순위표
  game.lastRank = m.rank;
  const show2 = () => { showOver().then(() => { $('ov-room').classList.remove('hidden'); $('ov-room').innerHTML = '<h3>🏁 이번 판 순위</h3>' + m.rank.map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}</span><span class="sc">${e.dist.toLocaleString()}m<small>⭐${e.stars}</small></span></div>`).join(''); renderRoom(m.rank); }); };
  if (game.mode === 'dead' && game.deadT < 1.4) setTimeout(show2, (1.4 - game.deadT) * 1000); else show2();
});
$('quick-btn').onclick = () => net.send({ t: 'quick' });
$('create-btn').onclick = () => net.send({ t: 'create', name: $('room-name').value });
$('lobby-back').onclick = () => { game.multi = false; show('title'); };
$('leave-btn').onclick = () => { net.send({ t: 'leave' }); game.room = null; $('ov-room').classList.add('hidden'); };
$('start-btn').onclick = () => net.send({ t: 'start' });

// ---------- 밀치기 · 부딪힘 ----------
function multiTick(dt) {
  game.sendT -= dt;
  if (game.sendT <= 0 && runner.alive && game.mode === 'run') {
    game.sendT = 1 / 15;
    const f = (runner.slideT > 0 && runner.onGround ? 1 : 0) | (runner.onGround ? 0 : 2) | (runner.shoveT > 0 ? 4 : 0) | (runner.flipT > 0 ? 8 : 0);
    net.send({ t: 'st', p: [runner.s, runner.x, runner.y, f] });
  }
  for (const g of game.ghosts.values()) g.update(dt, track.origin);
  if (!runner.alive || game.mode !== 'run') return;
  // 몸끼리 닿으면 서로 옆으로 밀린다 (각자 자기 쪽에서 계산)
  game.bumpT -= dt;
  if (game.bumpT <= 0) for (const g of game.ghosts.values()) {
    if (!g.alive) continue;
    if (Math.abs(g.s - runner.s) < 0.9 && Math.abs(g.x - runner.x) < 0.85 && Math.abs(g.y - runner.y) < 1.3) { runner.bump(Math.sign(runner.x - g.x) || (Math.random() < 0.5 ? -1 : 1)); game.bumpT = 0.15; break; }
  }
  // E · Shift: 가까운 사람 밀치기
  if (input.shove && runner.shoveT <= 0) {
    let best = null, bd = 9;
    for (const g of game.ghosts.values()) {
      if (!g.alive) continue;
      const ds = Math.abs(g.s - runner.s), dx = Math.abs(g.x - runner.x);
      if (ds < 2.6 && dx < 2.6 && Math.abs(g.y - runner.y) < 2 && ds + dx < bd) { bd = ds + dx; best = g; }
    }
    runner.shoveT = 0.35; sfx('shove');
    if (best) net.send({ t: 'shove', to: best.id, dir: Math.sign(best.x - runner.x) || 1 });
  }
}

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let t = 0;
const camLook = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  readInput();
  const z = track.origin - runner.s;
  if (game.mode === 'title') {
    // 처음 화면: 출발 발판에서 제자리 달리기 + 꿈이 6초마다 바뀌며 빙글 도는 카메라
    game.titleT += dt;
    if (game.titleT > 6) { game.titleT = 0; const th = THEMES[Math.floor(Math.random() * THEMES.length)]; env.setTheme(th); }
    runner.bear.root.position.set(0, 0, z); runner.bear.root.rotation.y = Math.PI;
    runner.bear.update(dt, 8, { noCrawl: true });
    const a = t * 0.18;
    camera.position.set(Math.sin(a) * 7, 2.6, z + Math.cos(a) * 7);
    camera.lookAt(0, 1.1, z);
  } else {
    if (game.mode === 'count') {
      game.countT -= dt;
      const n = Math.max(0, Math.ceil(game.countT));
      if (n !== game.countN) {
        game.countN = n;
        const el = $('countdown'); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
        el.textContent = n > 0 ? n : 'GO!'; sfx('beep', n <= 0);
      }
      if (game.countT <= 0) { goRun(); setTimeout(() => $('countdown').classList.add('hidden'), 600); }
    }
    if (game.mode === 'run') {
      game.runT += dt;
      const why = runner.update(dt, input, track, (n, a) => sfx(n, a));
      if (why) died(why);
    } else if (game.mode === 'dead') {
      runner.update(dt, input, track);
      game.deadT += dt;
      if (game.deadT > 1.4 && !game.multi && game.submitted !== null) showOver();
      if (game.multi && game.deadT > 1.4) spectate();
    }
    track.update(game.runT, runner.s);
    track.generate(Math.max(runner.s, game.multi ? maxGhostS() : 0));
    if (game.mode === 'run') {
      const d = track.dreamAt(runner.s);
      if (d !== game.dream) enterDream(d);
    }
    runner.pose(dt, track.origin - runner.s);
    if (game.multi) multiTick(dt);
    followCamera(dt);
    hud();
  }
  input.jump = input.slide = input.shove = false;
  env.update(dt, t, camera, runner.s, runner.x, runner.y);
  renderer.render(scene, camera);
}
function maxGhostS() { let m = 0; for (const g of game.ghosts.values()) if (g.alive) m = Math.max(m, g.s); return m; }
// 관전: 탈락한 뒤엔 가장 멀리 간 사람을 따라간다
function spectate() {
  let best = null;
  for (const g of game.ghosts.values()) if (g.alive && (!best || g.s > best.s)) best = g;
  const el = $('spectate');
  if (game.mode !== 'dead') { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const alive = [...game.ghosts.values()].filter((g) => g.alive).length;
  el.textContent = best ? `👀 ${best.name} 관전 중 · 남은 곰돌이 ${alive}명` : '모두의 결과를 기다리는 중…';
  game.watch = best;
  if (best) {
    const d = track.dreamAt(best.s);
    if (d !== game.dream) { game.dream = d; env.setTheme(track.themeOf(d)); setMusic(track.themeOf(d).mus); }
  }
}
function followCamera(dt) {
  const w = game.mode === 'dead' && game.multi && game.watch && game.deadT > 1.4 ? game.watch : null;
  const s = w ? w.s : runner.s, x = w ? w.x : runner.x, y = w ? w.y : runner.y;
  const z = track.origin - s;
  const k = 1 - Math.exp(-dt * 7);
  const v = speedAt(s);
  const dead = game.mode === 'dead' && !w;
  const cx = x * 0.85, cy = Math.max(y, -6) + 3.3;
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (cy - camera.position.y) * (dead ? k * 0.3 : k);
  camera.position.z = dead ? camera.position.z : z + 7.4;
  camLook.set(x, Math.max(y, -8) + 1.2, z - 9);
  camera.lookAt(camLook);
  const fov = 60 + (v - V0) * 0.55;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
}
function hud() {
  $('h-score').textContent = score().toLocaleString();
  $('h-dist').textContent = `${Math.floor(runner.s).toLocaleString()}m`;
  $('h-stars').textContent = runner.stars;
  const b0 = track.bounds[game.dream] ?? 0, b1 = track.nextBoundary(runner.s);
  $('h-next').firstElementChild.style.width = `${Math.max(0, Math.min(1, (runner.s - b0) / Math.max(1, b1 - b0))) * 100}%`;
  if (game.multi) $('h-alive').textContent = `🐻 ${(runner.alive ? 1 : 0) + [...game.ghosts.values()].filter((g) => g.alive).length}/${game.members.length}`;
}

boot();
frame();
