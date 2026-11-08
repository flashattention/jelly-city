// 드림 러너: 잠든 곰돌이가 꿈속을 끝없이 달린다
//   혼자 달리기 · 같이 달리기(방, 최대 12명: 같은 길 · 같은 꿈 · 서로 밀치기) · 최고 기록 순위표
import * as THREE from 'three';
import { isPhone, autoRes } from '../../shared/js/perf.js';
import { account, store, apiUrl } from '../../shared/js/account.js';
import { TOSS, bridge } from '../../shared/js/platform.js';
// 토스 미니앱: 혼자 달리기 · 토스 로그인 · 광고 보너스 (같이 달리기 · 메인 화면 없음)
// 웹: PWA 로 설치할 수 있게 (마이크로소프트 스토어 등). 토스 미니앱은 토스가 담아 주니 서비스 워커를 안 쓴다
if (TOSS) document.body.classList.add('toss');
else if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
import { localChars, LOCAL_MAX } from '../../shared/js/local-chars.js';
import { Chat } from '../../shared/js/chat.js';
import { Env } from './env.js';
import { Track, speedAt, V0 } from './track.js';
import { Runner, Ghost, BOOST } from './runner.js';
import { THEMES } from './themes.js';
import { sfx, setMusic, unlock, toggleMute, sound } from './music.js';
import { ITEMS } from './items.js';
import { DIFFS, diffOf } from './diff.js';
import { HELLS } from './hells.js';
import { VOIDS } from './voids.js';
import { openPatchNotes, showWhatsNew } from '../../shared/js/patchnotes.js';
import { openWardrobe, notifyNew, titleHtml, medalHtml, loadCos } from '../../shared/js/wardrobe.js';
import { starsEarned } from '../../shared/js/cos-items.js';

const $ = (id) => document.getElementById(id);
const MODE_KEY = 'dreamrunner.mode', DIFF_KEY = 'dreamrunner.diff', CAM_KEY = 'dreamrunner.cam', MAP_KEY = 'dreamrunner.map';
const mapOf = (m) => (m === 'hell' || m === 'void' ? m : 'dream'), mapName = (m) => (m === 'hell' ? '🔥 랜덤 지옥' : m === 'void' ? '🌌 랜덤 이공간' : '🌙 랜덤 꿈나라');
const mapTag = (m) => (m === 'hell' ? '🔥 지옥 · ' : m === 'void' ? '🌌 이공간 · ' : ''); // 순위표 · 방 이름 앞에
const CHAR_KEY = 'dreamrunner.char', NICK_KEY = 'dreamrunner.nick', ANON_KEY = 'dreamrunner.anon';
// 비로그인: 이 브라우저의 임시 아이디 (순위표에서 내 기록을 찾는 데만 쓴다)
function anonId() {
  let a = store.get(ANON_KEY);
  if (!/^[a-f0-9]{24}$/.test(a || '')) { a = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set(ANON_KEY, a); }
  return a;
}
const logged = () => !!account.session && !!account.user;

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: !isPhone, powerPreference: 'high-performance' });
autoRes(renderer, 2);
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
game.runner = runner; game.track = track; game.env = env; game.scene = scene; game.renderer = renderer; window.__THEMES = THEMES; // 점검용 (콘솔에서 dream.runner 등)

// ---------- 입력 ----------
const keys = new Set();
const input = { dir: 0, jump: false, slide: false, slideHeld: false, shove: false, item: false };
const isTyping = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
window.addEventListener('keydown', (e) => {
  if (isTyping()) return;
  unlock();
  if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
  keys.add(e.code);
  if (e.code === 'Space' && game.mode === 'dead' && game.multi && game.deadT > 1.4) { e.preventDefault(); cycleWatch(); return; } // 관전 대상 바꾸기
  if (e.code === 'Space') input.jump = true; // 점프는 Space
  if (['KeyS', 'ArrowDown'].includes(e.code)) input.slide = true;
  if (['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code)) input.shove = true;
  if (e.code === 'KeyM') muteBtn();
  if (e.code === 'KeyV') toggleCam();
  if (e.code === 'KeyQ') input.item = true;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (game.mode === 'over' && (e.code === 'Space' || e.code === 'Enter') && !game.multi) { e.preventDefault(); startSoloFresh(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function readInput() {
  const L = keys.has('KeyA') || keys.has('ArrowLeft') || joyDir < 0;
  const Rt = keys.has('KeyD') || keys.has('ArrowRight') || joyDir > 0;
  input.dir = (Rt ? 1 : 0) - (L ? 1 : 0);
  input.slideHeld = keys.has('KeyS') || keys.has('ArrowDown') || touchHeld.has('slide');
}
// 휴대폰: 버튼 + 밀어서(스와이프) 점프·숙이기
const touchHeld = new Set();
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
for (const b of document.querySelectorAll('#touch button')) {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); touchHeld.add(k); if (k === 'jump') input.jump = true; if (k === 'slide') input.slide = true; if (k === 'shove') input.shove = true; if (k === 'item') input.item = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => touchHeld.delete(k));
}
// 휴대폰 조이스틱: 좌우로 밀면 그쪽으로 (입력 기록은 왼쪽 · 가운데 · 오른쪽 셋이라 가운데 조금은 쉬는 자리)
let joyDir = 0, joyId = null;
// 휴대폰: 터치하다가 화면 글자가 파랗게 선택되거나 길게 누르기 메뉴가 뜨지 않게 (글 쓰는 칸은 그대로)
const typing = (t) => !!t?.closest?.('input, textarea, [contenteditable]');
document.addEventListener('selectstart', (e) => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener('contextmenu', (e) => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener('touchstart', (e) => { if (!typing(e.target)) { const sel = window.getSelection?.(); if (sel && sel.rangeCount && !typing(document.activeElement)) sel.removeAllRanges(); } }, { passive: true });
{
  const joy = $('joy'), knob = $('joy-knob'), R = 40, DEAD = 12;
  // 작은 원은 큰 원 안에서 사방으로 움직이고, 좌우로 기운 만큼만 방향이 된다
  const move = (e) => { const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; joyDir = dx > DEAD ? 1 : dx < -DEAD ? -1 : 0; joy.classList.toggle('on', joyDir !== 0); };
  const end = (e) => { if (e.pointerId !== joyId) return; joyId = null; joyDir = 0; knob.style.transform = ''; joy.classList.remove('on'); };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); joyId = e.pointerId; joy.setPointerCapture(e.pointerId); move(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) move(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(ev, end);
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
const screens = ['title', 'lobby', 'room', 'over', 'board', 'stats'];
// ESC: 순위표 · 방 목록을 닫는다
addEventListener('keydown', (e) => { if (e.key !== 'Escape' || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return; if (['board', 'lobby'].some((id) => !document.getElementById(id).classList.contains('hidden'))) show('title'); });
function show(id) { for (const s of screens) $(s).classList.toggle('hidden', s !== id); if (id === 'title') renderFame(); }
// 처음 화면 왼쪽: 명예의 전당 (높은 난이도 1위부터, 한 사람은 한 번만)
async function renderFame() {
  let d; try { d = await account.api('/api/dream/fame'); } catch { return; }
  const row = (f) => `<div class="fame-row"><span class="fame-rk">${['🥇', '🥈', '🥉'][f.rank - 1]}</span><span class="fame-nm"><span class="dot" style="background:${esc(f.color)}"></span>${esc(f.name)}</span><span class="fame-md">${(f.medals || []).map((m) => medalHtml(m)).join('')}</span></div>`;
  $('fame').innerHTML = `<div class="fame-h">🏆 명예의 전당</div>` + (d.fame.length ? d.fame.map(row).join('') : '<div class="empty">아직 기록이 없어요</div>');
}
renderFame(); // 처음 열 때
function hideScreens() { for (const s of screens) $(s).classList.add('hidden'); }
function toast(text, ms = 1600) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), ms); }
function err(text) { $('err').textContent = text || ''; }
// 소리 단추: 게임 화면(b-mute) · 처음 화면 · 방(data-snd) 모두 같이
function syncSound() { document.querySelectorAll('#b-mute, [data-snd]').forEach((b) => { b.textContent = sound.muted ? '🔇' : '🔊'; }); }
function muteBtn() { toggleMute(); syncSound(); }
document.querySelectorAll('#b-mute, [data-snd]').forEach((b) => { b.onclick = muteBtn; });
syncSound();
$('b-quit').onclick = () => { reportPlay(); if (game.multi) { net.send({ t: 'leave' }); leaveRun(); } else toTitle(); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 로그인 · 캐릭터 ----------
async function boot() {
  let status = {};
  try { status = await account.status(); } catch { err('서버에 연결할 수 없어요'); }
  game.status = status;
  const ok = await account.restore();
  // 점검용: ?autostart&name=이름 (개발 서버에서만)
  const q = new URLSearchParams(location.search);
  // 토스 미니앱: 처음이면 이 기기 계정을 만든다 (토스 로그인 없이도 기록이 남게)
  if (!ok && TOSS) { try { await account.tossDevice(); } catch (e) { err(e.message); } }
  else if (!ok && q.has('autostart') && status.devLogin) { try { await account.login({ dev: q.get('name') || '러너' }); } catch (e) { err(e.message); } }
  renderAccount();
  const inv = codeOf(q.get('room'));
  if (inv.length === 6) {
    $('code-in').value = inv; $('code-btn').classList.add('pulse');
    $('play-btns').before($('code-in').parentElement); // 초대받았으면 참가 버튼을 위로 (자동 참가가 안 되면 눌러서)
    history.replaceState(null, '', location.pathname); // 새로고침해도 다시 들어가지 않게
    joinByCode(inv); // 링크로 들어오면 바로 그 방으로
  }
}
// 토스 미니앱: '토스로 시작하기' 를 눌러야 토스 로그인 (토스 정책: 사용자가 누를 때 부른다). 로그인 전에도 달릴 수 있다
$('toss-login').onclick = async () => { const b = $('toss-login'), linking = !!account.user?.device; b.disabled = true; try { await account.tossLogin(); renderAccount(); toast(linking && !account.user?.device ? '😊 토스 계정에 이었어요 · 기록이 그대로 남아요' : '😊 토스로 들어왔어요'); } catch (e) { toast(`토스 로그인을 못 했어요 · ${e.message}`, 2600); } finally { b.disabled = false; } };
function renderAccount() {
  // 토스 로그인 버튼: 토스 로그인이 준비된 서버에서만 (기기 계정이면 '토스 계정에 잇기')
  const tossOn = TOSS && (game.status?.toss || game.status?.devLogin) && (!account.user || account.user.device);
  $('toss-login').classList.toggle('hidden', !tossOn);
  if (tossOn) $('toss-login').innerHTML = account.user?.device ? '토스 계정에 잇기 <small>지금 기록 · 별 · 치장을 토스 계정에 그대로 남겨요</small>' : '토스로 시작하기 <small>기록 · 별 · 치장이 토스 계정에 남아요</small>';
  const on = logged();
  $('login-box').classList.toggle('hidden', on);
  $('who-row').classList.toggle('hidden', !on);
  $('chars-label').classList.remove('hidden'); $('multi-btn').classList.remove('hidden'); // 로그인 안 해도 캐릭터 · 같이 하기
  if (!on) {
    const s = game.status || {};
    if (s.googleClientId) account.googleButton($('g-btn'), s.googleClientId, () => renderAccount(), (e) => err(e.message)).catch(() => err('구글 로그인 버튼을 불러오지 못했어요'));
    else $('g-btn').innerHTML = '';
    $('dev-box').classList.toggle('hidden', !s.devLogin);
    // 서버에 입장 비밀번호가 있으면 (젤리시티와 같은 비밀번호 · 같은 저장값)
    $('pw-row').classList.toggle('hidden', !s.password);
    if (s.password && !$('pw').value) $('pw').value = store.get('roachcity.pw') || '';
  } else $('me-name').textContent = account.user.name;
  // 구글 계정은 실명 대신 닉네임: 처음이면 정하게 한다
  $('acct-nick').classList.toggle('hidden', !(on && account.user.needNick) && !game.editNick);
  $('acct-nick-hint').textContent = on && account.user.needNick ? (TOSS ? '순위표에 보일 닉네임을 정해 주세요' : '구글 이름 대신 쓸 닉네임을 정해 주세요 (모든 게임에서 써요)') : '새 닉네임';
  const chars = on ? account.chars || [] : localChars(); // 로그인 안 했으면 이 기기에 만든 캐릭터
  let sel = store.get('jelly.char') || store.get(CHAR_KEY) || (chars[0]?.token ?? 'default'); // 메인 화면의 대표 캐릭터로 (고르기는 메인 화면에서)
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
  if (chars.length < (on ? 4 : LOCAL_MAX)) { const a = document.createElement('a'); a.className = 'chip'; a.href = '/?create=1&back=/dream-runner/'; a.textContent = '＋ 새 캐릭터'; a.style.textDecoration = 'none'; box.appendChild(a); }
  const c = chars.find((x) => x.token === sel);
  $('nick-row').classList.toggle('hidden', !!c || on); // 로그인했으면 계정 닉네임을 쓴다
  if (!$('nick').value) {
    // 기본 이름: 체험판은 손님 이름, 아니면 번호 붙은 곰돌이 (구글 실명은 순위표에 안 보이게)
    let nick = store.get(NICK_KEY);
    if (!nick) { nick = on && account.user.name?.startsWith('체험판') ? account.user.name : `꿈꾸는 곰돌이 ${1000 + Math.floor(Math.random() * 9000)}`; store.set(NICK_KEY, nick); }
    $('nick').value = nick;
  }
  const eq = account.cos?.equip; game.profile = c ? { name: c.name, color: c.profile?.color || '#8a5634', look: c.profile?.look, acc: c.profile?.accessories || [], gender: c.profile?.gender } : { name: (on && account.user.nick) || $('nick').value.trim() || '꿈꾸는 곰돌이', color: '#8a5634', look: eq && Object.keys(eq).length ? { cos: eq } : undefined };
  runner.setLook(game.profile);
}
$('nick-edit').onclick = () => { game.editNick = true; $('acct-nick-in').value = account.user?.nick || ''; renderAccount(); $('acct-nick-in').focus(); };
async function saveNick() {
  try { const r = await account.api('/api/nick', { method: 'POST', body: { nick: $('acct-nick-in').value } }); account.user = r.user; game.editNick = false; err(''); renderAccount(); toast(`😊 이제부터 '${r.user.nick}'(으)로 불러요`); }
  catch (e) { err(e.message); $('acct-nick-in').focus(); }
}
$('acct-nick-save').onclick = saveNick;
$('acct-nick-in').onkeydown = (e) => { if (e.key === 'Enter') saveNick(); };
$('pw').addEventListener('input', () => { store.set('roachcity.pw', $('pw').value); err(''); });
$('nick').addEventListener('input', () => { store.set(NICK_KEY, $('nick').value.trim()); if (!$('nick-row').classList.contains('hidden')) game.profile.name = $('nick').value.trim() || '꿈꾸는 곰돌이'; });
$('guest-btn').onclick = async () => { try { await account.login({ guest: true }); renderAccount(); } catch (e) { err(e.message); } };
$('dev-btn').onclick = async () => { try { await account.login({ dev: $('dev-name').value || '러너' }); renderAccount(); } catch (e) { err(e.message); } };
$('logout').onclick = async () => { await account.logout(); renderAccount(); };
// 초대 코드로 참가 (로그인 안 해도 된다)
// 초대 코드: 한글 자판 그대로 쳐도 (ㅗㅠㄹㅇㅜㅇ → HBFDND) 같은 자리의 영문으로 바꾼다
const KO_KEY = { ㅂ: 'Q', ㅈ: 'W', ㄷ: 'E', ㄱ: 'R', ㅅ: 'T', ㅛ: 'Y', ㅕ: 'U', ㅑ: 'I', ㅐ: 'O', ㅔ: 'P', ㅁ: 'A', ㄴ: 'S', ㅇ: 'D', ㄹ: 'F', ㅎ: 'G', ㅗ: 'H', ㅓ: 'J', ㅏ: 'K', ㅣ: 'L', ㅋ: 'Z', ㅌ: 'X', ㅊ: 'C', ㅍ: 'V', ㅠ: 'B', ㅜ: 'N', ㅡ: 'M',
  ㅃ: 'Q', ㅉ: 'W', ㄸ: 'E', ㄲ: 'R', ㅆ: 'T', ㅒ: 'O', ㅖ: 'P', ㅘ: 'HK', ㅙ: 'HO', ㅚ: 'HL', ㅝ: 'NJ', ㅞ: 'NP', ㅟ: 'NL', ㅢ: 'ML',
  ㄳ: 'RT', ㄵ: 'SW', ㄶ: 'SG', ㄺ: 'FR', ㄻ: 'FA', ㄼ: 'FQ', ㄽ: 'FT', ㄾ: 'FX', ㄿ: 'FV', ㅀ: 'FG', ㅄ: 'QT' };
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
function deHangul(str) {
  let out = '';
  for (const ch of String(str || '')) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c < 11172) { const j = [CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)], JONG[c % 28]]; for (const x of j) out += KO_KEY[x] || ''; } // 완성된 글자는 자모로 풀어서
    else out += KO_KEY[ch] || ch;
  }
  return out;
}
const codeOf = (v) => deHangul(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
for (const id of ['code-in', 'code-in2']) {
  const el = $(id);
  // 글자를 조합하는 중(한글 자판 · 휴대폰)엔 건드리지 않고, 다 친 뒤에 영문 대문자로 정리
  let composing = false;
  el.setAttribute('autocapitalize', 'characters'); el.setAttribute('spellcheck', 'false'); el.setAttribute('autocorrect', 'off');
  el.addEventListener('compositionstart', () => { composing = true; });
  el.addEventListener('compositionend', () => { composing = false; el.value = codeOf(el.value); });
  el.addEventListener('input', () => { if (!composing) { const v = codeOf(el.value); if (v !== el.value) el.value = v; } });
  el.addEventListener('blur', () => { el.value = codeOf(el.value); });
}
$('code-btn').onclick = () => joinByCode($('code-in').value);
$('code-btn2').onclick = () => joinByCode($('code-in2').value);
$('code-in').onkeydown = (e) => { if (e.key === 'Enter') $('code-btn').click(); };
$('code-in2').onkeydown = (e) => { if (e.key === 'Enter') $('code-btn2').click(); };
$('solo-btn').onclick = () => { unlock(); startSoloFresh(); };
$('multi-btn').onclick = () => { unlock(); openLobby(); };
// ---------- 스피드전 · 아이템전 ----------
const modeName = (m) => (m === 'item' ? '🎁 아이템전' : '⚡ 스피드전');
const TEAMS = { red: { name: '🍓 딸기팀', color: '#ff5a7a' }, blue: { name: '🫧 소다팀', color: '#4cc3ff' } };
function segSet(id, m) { for (const b of $(id).children) b.classList.toggle('on', b.dataset.m === m); }
game.pickMode = store.get(MODE_KEY) === 'item' ? 'item' : 'speed';
segSet('mode-pick', game.pickMode);
for (const b of $('mode-pick').children) b.onclick = () => { game.pickMode = b.dataset.m; store.set(MODE_KEY, game.pickMode); segSet('mode-pick', game.pickMode); };
for (const b of $('room-mode').children) b.onclick = () => net.send({ t: 'mode', mode: b.dataset.m });
// 난이도: 길은 같고 빠르기만 다르다 (노멀 · 하드 · 익스트림 · 광속 · 초월)
const diffName = (d) => DIFFS[diffOf(d)].name;
for (const id of ['diff-pick', 'room-diff', 'board-diff']) $(id).innerHTML = Object.entries(DIFFS).map(([k, d]) => `<button data-m="${k}">${d.name}</button>`).join('');
game.pickDiff = store.get(DIFF_KEY) ? diffOf(store.get(DIFF_KEY)) : 'hard'; // 처음 온 사람은 하드부터 · 그다음부터는 마지막에 고른 난이도
segSet('diff-pick', game.pickDiff);
for (const b of $('diff-pick').children) b.onclick = () => { game.pickDiff = b.dataset.m; store.set(DIFF_KEY, game.pickDiff); segSet('diff-pick', game.pickDiff); };
for (const b of $('room-diff').children) b.onclick = () => net.send({ t: 'diff', diff: b.dataset.m });
game.pickMap = mapOf(store.get(MAP_KEY)); segSet('map-pick', game.pickMap);
for (const b of $('map-pick').children) b.onclick = () => { game.pickMap = b.dataset.m; store.set(MAP_KEY, game.pickMap); segSet('map-pick', game.pickMap); game.titleT = 6; };
for (const b of $('room-map').children) b.onclick = () => net.send({ t: 'map', map: b.dataset.m });
for (const b of $('board-map').children) b.onclick = async () => { game.boardMap = b.dataset.m; segSet('board-map', game.boardMap); renderBoard($('board-list'), await loadBoard(game.boardMode, game.boardDiff, game.boardMap)); };
for (const b of $('board-diff').children) b.onclick = async () => { game.boardDiff = b.dataset.m; segSet('board-diff', game.boardDiff); renderBoard($('board-list'), await loadBoard(game.boardMode, game.boardDiff, game.boardMap)); };
for (const b of $('room-team').children) b.onclick = () => net.send({ t: 'team', on: b.dataset.t === '1' });
$('team-btn').onclick = () => net.send({ t: 'switch' });
game.boardMode = 'speed';
for (const b of $('board-mode').children) b.onclick = async () => { game.boardMode = b.dataset.m; segSet('board-mode', game.boardMode); renderBoard($('board-list'), await loadBoard(game.boardMode, game.boardDiff, game.boardMap)); };
$('board-btn').onclick = async () => { game.boardMode = game.pickMode; game.boardDiff = game.pickDiff; game.boardMap = game.pickMap; segSet('board-map', game.boardMap); segSet('board-mode', game.boardMode); segSet('board-diff', game.boardDiff); show('board'); renderAdmin(); renderBoard($('board-list'), await loadBoard(game.boardMode, game.boardDiff, game.boardMap)); };
$('board-close').onclick = () => show('title');
// 운영자: 확인 대기 기록 승인 · 거절, 수상한 기록 삭제
async function renderAdmin(d) {
  const el = $('board-admin'); if (!account.admin) { el.innerHTML = ''; return; }
  try { d ||= await account.api('/api/dream/admin/list'); } catch { return; }
  const { reportRow, bindReports } = await import('../../shared/js/admin-alert.js');
  const row = (t, btns) => `<div class="brow adm"><span class="adm-t">${t}</span><span class="adm-b">${btns}</span></div>`; // 운영자 줄: 글 + 단추 (순위표 줄 모양과 따로)
  el.innerHTML = `<h3>🛡️ 기록 확인 · 정상 ${d.stat.ok} / 불일치 ${d.stat.bad} / 기록 없음 ${d.stat.none}</h3>` + (d.reports.length ? `<h3>🚨 비상 리포트 ${d.reports.length}건</h3>` + d.reports.map(reportRow).join('') : '') + d.flagged.slice(0, 30).map((f) => row(`⚠️ ${esc(f.name)} ${f.score.toLocaleString()}점 ${esc(f.t)} (${esc(f.u)})`, `<button class="mini" data-ok-s="${esc(f.sub)}" data-t="${esc(f.t)}">정상 인정</button><button class="mini" data-s="${esc(f.sub)}" data-t="${esc(f.t)}">삭제 · 별 몰수</button>`)).join('');
  bindReports(el, (n) => renderAdmin(n));
  for (const b of el.querySelectorAll('[data-ok-s]')) b.onclick = async () => renderAdmin(await account.api('/api/dream/admin/verify', { method: 'POST', body: { sub: b.dataset.okS, t: b.dataset.t } }));
  for (const b of el.querySelectorAll('[data-s]')) b.onclick = async () => { if (confirm('이 기록을 지우고 드림 러너 업적과 별을 거둘까요?')) renderAdmin(await account.api('/api/dream/admin/remove', { method: 'POST', body: { sub: b.dataset.s, t: b.dataset.t } })); };
}
$('home-btn').onclick = () => { if (game.multi) { net.send({ t: 'leave' }); game.multi = false; } toTitle(); };
$('again-btn').onclick = () => { if (game.multi) { leaveRun(); show('room'); } else startSoloFresh(); };

// ---------- 순위표 ----------
// 내 기록: 판수 · 달린 시간 · 난이도별 지금 순위
const playTime = (t) => (t < 60 ? `${t}초` : t < 3600 ? `${Math.floor(t / 60)}분` : `${Math.floor(t / 3600)}시간 ${Math.floor(t / 60) % 60}분`);
$('stats-btn').onclick = () => { game.statsMap = game.pickMap || 'dream'; segSet('stats-map', game.statsMap); show('stats'); renderMyStats(); };
for (const b of $('stats-map').children) b.onclick = () => { game.statsMap = b.dataset.m; segSet('stats-map', game.statsMap); renderMyStats(); };
$('stats-close').onclick = () => show('title');
async function renderMyStats() {
  const el = $('my-stats'); let d;
  try { d = await account.api(`/api/dream/me?map=${game.statsMap || 'dream'}` + (logged() ? '' : `&anon=${anonId()}`)); } catch { el.innerHTML = ''; return; }
  const cell = (r) => (r ? `<b>${r.rank.toLocaleString()}위</b><small>${r.score.toLocaleString()}점 · ${r.of.toLocaleString()}명 중</small>` : '<small>기록 없음</small>');
  el.innerHTML = `<div class="ms-top"><div><small>내가 달린 판수</small><b>${d.runs.toLocaleString()}판</b></div><div><small>달린 시간</small><b>${playTime(d.time)}</b></div></div><small class="ms-note">판수와 시간은 2026년 11월 2일 패치부터 세요 (그 전 기록은 남아 있지 않아요)</small>
    <div class="ms-table"><div class="ms-row ms-head"><span>난이도</span><span>판수 · 시간</span><span>⚡ 스피드전</span><span>🎁 아이템전</span></div>${Object.entries(DIFFS).map(([k, x]) => { const r = d.diffs[k]; return `<div class="ms-row"><span>${esc(x.name)}</span><span><b>${r.runs.toLocaleString()}판</b><small>${playTime(r.time)}</small></span><span>${cell(r.speed)}</span><span>${cell(r.item)}</span></div>`; }).join('')}</div>`;
}
// 달린 판수 · 시간 올리기 (한 판에 한 번, 서버 점검 중이면 다시 시도). 나갈 때는 페이지가 닫혀도 전해지게 한다
function reportPlay(leaving) {
  if (game.playSent || game.runT < 3) return; game.playSent = true;
  const body = { time: game.runT, diff: game.diff, map: game.map, stars: runner.stars, dist: Math.floor(runner.s), tk: game.tk || undefined, anon: logged() ? undefined : anonId() };
  if (leaving) { fetch(apiUrl('/api/dream/played'), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', ...(account.session ? { Authorization: `Bearer ${account.session}` } : {}) }, body: JSON.stringify(body) }).catch(() => {}); return; }
  (async () => { if (!body.tk && game.tkP) body.tk = await Promise.race([game.tkP, new Promise((ok) => setTimeout(ok, 8000))]) || undefined; for (let i = 0; i < 100; i++) { try { offerAd(await account.api('/api/dream/played', { method: 'POST', body }), body.tk); return; } catch (e) { if (e.status && e.status < 500) return; await new Promise((ok) => setTimeout(ok, 3000)); } } })();
}
// 토스 미니앱: 판이 끝나고 별을 받았으면 '광고 보고 별 한 번 더' (보고 싶은 사람만)
function offerAd(r, tk) {
  if (!TOSS || !r?.ad || !tk || game.multi || (bridge && !bridge.showRewardedAd)) return; // 미니앱인데 광고가 아직 안 붙었으면 버튼을 안 보여 준다
  const b = $('ad-btn'); b.textContent = `📺 광고 보고 별 +${r.earned.toLocaleString()} 더 받기`; b.classList.remove('hidden');
  b.onclick = async () => {
    b.disabled = true;
    try {
      const seen = bridge?.showRewardedAd ? await bridge.showRewardedAd() : confirm('(시험) 광고를 끝까지 봤다고 칠까요?'); // 웹 시험(?toss=1)에서는 광고 대신 확인 창
      if (!seen) { toast('광고를 끝까지 봐야 받을 수 있어요'); return; }
      const g = await account.api('/api/dream/adbonus', { method: 'POST', body: { tk } });
      b.classList.add('hidden'); toast(`⭐ 별 +${g.bonus.toLocaleString()}!`, 2000); loadCos().catch(() => {});
    } catch (e) { toast(e.message); b.classList.add('hidden'); } finally { b.disabled = false; }
  };
}
addEventListener('pagehide', () => { if (game.mode === 'run' || game.mode === 'dead') reportPlay(true); });
async function loadBoard(mode = 'speed', diff = 'easy', map = 'dream') { try { return await account.api(`/api/dream/board?mode=${mode}&diff=${diff}&map=${map}` + (logged() ? '' : `&anon=${anonId()}`)); } catch { return { top: [] }; } }
function renderBoard(el, d, hl) {
  const top = d.top || [], me = d.me;
  const myId = me?.id;
  const row = (e) => `<div class="brow${e.id === myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="nm-t"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : e.anon ? ' <span class="guest">비로그인</span>' : ''}</span><span class="md">${(e.medals || (e.medal ? [e.medal] : [])).map((m) => medalHtml(m, e.title)).join('')}${titleHtml(e.title)}</span></span><span class="sc">${e.score.toLocaleString()}<small>${e.dist.toLocaleString()}m · ⭐${e.stars}</small></span></div>`;
  let html = top.slice(0, hl ? 10 : 50).map(row).join('');
  if (me && me.rank > (hl ? 10 : 50)) html += '<div class="brow gap">⋯</div>' + row(me);
  el.innerHTML = html || '<div class="empty">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!</div>';
}

// ---------- 시작 · 끝 ----------
function newRun(seed, itemMode = false, diff = 'easy', map = 'dream') {
  game.itemMode = itemMode; game.map = mapOf(map);
  game.diff = diffOf(diff); runner.speedK = DIFFS[game.diff].k;
  game.seed = seed;
  for (const g of game.ghosts.values()) g.remove();
  game.ghosts.clear();
  env.clear();
  // 지옥 길은 난이도의 실제 빠르기(가속 포함)에 맞춰 만든다 · 빠를수록 멀리 보이게
  const K = DIFFS[game.diff].k * (1 + BOOST);
  env.fogK = game.map !== 'dream' ? Math.max(1, (K / 1.9) ** 0.7) : 1;
  track.reset(seed, itemMode, { map: game.map, K });
  game.camFall = 0; game.camG = null; game.rec = null; game.shake = 0; env.underY = undefined; game.underY = -13;
  game.rp = !itemMode && !game.multi ? { dts: [], evs: [], last: -1 } : null; game.dtCarry = 0;
  game.tkP = game.mode === 'title' && !game.starting ? null : getTicket(seed, itemMode, game.diff, game.map);
  runner.reset(0, 0);
  runner.multi = game.multi;
  renderItems(true);
  game.dream = 0; game.dreamsSeen = 1; game.runT = 0; game.submitted = null; game.playSent = false; $('ad-btn').classList.add('hidden');
  env.setTheme(track.themeOf(0), true);
  setMusic(track.themeOf(0).mus);
  $('h-alive').classList.toggle('hidden', !game.multi);
  $('t-shove').classList.toggle('hidden', !game.multi);
  $('t-item').classList.toggle('hidden', !itemMode);
  $('itembar').classList.toggle('hidden', !itemMode);
}
// 출발표: 기다리지 않고 뒤에서 받아 둔다. 못 받아도 게임은 그대로 할 수 있다
function getTicket(seed, itemMode, diff, map) { return account.api('/api/dream/run', { method: 'POST', body: { seed, diff, map, mode: itemMode ? 'item' : 'speed' } }).then((r) => { game.tk = r.tk; return r.tk; }).catch(() => null); }
async function encodeReplay(R) {
  if (!R || !R.dts.length) return null;
  const text = `${R.dts.join(',')}|${R.evs.join(',')}`;
  if (typeof CompressionStream !== 'function') return text.length < 600000 ? { d: text } : null;
  try { const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192)); return { z: 1, d: btoa(s) }; } catch { return text.length < 600000 ? { d: text } : null; }
}
// 새 버전이 배포됐으면 달리기 전에 페이지를 새로 고치고 바로 출발한다 (예전 코드로 달리면 서버 확인과 길이 달라 기록이 '확인 중'에 걸린다)
game.ver = null; const verOf = () => fetch(apiUrl('/api/dream/ver'), { cache: 'no-store' }).then((r) => r.json()).then((j) => j.v).catch(() => null);
// 토스 미니앱은 번들을 만들 때 그 코드의 판을 적어 둔다 (서버가 그 판의 코드로 기록을 다시 돌린다)
if (TOSS && /^[0-9a-f]{12}$/.test(window.__DREAM_VER__ || '')) game.ver = window.__DREAM_VER__;
else verOf().then((v) => { game.ver = v; });
try { if (sessionStorage.getItem('dreamrunner.autostart')) { sessionStorage.removeItem('dreamrunner.autostart'); const go = (n) => (game.mode === 'title' && runner ? (toast('🆕 새 버전으로 바꿨어요'), startSolo()) : n > 0 && setTimeout(() => go(n - 1), 100)); setTimeout(() => go(80), 300); } } catch { /* 없음 */ }
async function startSoloFresh() {
  if (game.ver && !TOSS) { const v = await Promise.race([verOf(), new Promise((ok) => setTimeout(() => ok(null), 700))]); if (v && v !== game.ver) { try { sessionStorage.setItem('dreamrunner.autostart', '1'); } catch { /* 없음 */ } window.onbeforeunload = null; location.reload(); return; } }
  startSolo();
}
function startSolo() {
  game.multi = false; game.team = false; $('teambar').classList.add('hidden'); game.starting = true; game.tk = null;
  newRun((Math.random() * 2 ** 31) | 0, game.pickMode === 'item', game.pickDiff, game.pickMap);
  game.starting = false;
  countdown(3000);
}
function countdown(ms) {
  hideScreens();
  game.mode = 'count'; game.countT = ms / 1000; game.countN = null;
  $('hud').classList.remove('hidden');
  if (document.body.classList.contains('touch')) $('touch').classList.remove('hidden');
  showDreamCard(0);
  // 조작법: 가운데 흐리게 떴다가 사라진다
  $('t-shove-row').classList.toggle('hidden', !game.multi);
  $('t-item-row').classList.toggle('hidden', !game.itemMode);
  const h = $('howto'); h.classList.remove('show', 'dock', 'hidden'); void h.offsetWidth; h.classList.add('show');
  clearTimeout(game.howtoT); game.howtoT = setTimeout(() => h.classList.add('dock'), 5500);
}
function goRun() { game.mode = 'run'; $('countdown').classList.add('hidden'); }
function toTitle() {
  game.team = false; $('teambar').classList.add('hidden');
  $('howto').classList.add('hidden'); $('itembar').classList.add('hidden');
  game.mode = 'title'; game.multi = false;
  for (const g of game.ghosts.values()) g.remove(); game.ghosts.clear();
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('spectate').classList.add('hidden'); $('countdown').classList.add('hidden');
  newRun((Math.random() * 2 ** 31) | 0);
  game.mode = 'title';
  show('title'); renderAccount();
}
function leaveRun() {
  $('howto').classList.add('hidden'); $('itembar').classList.add('hidden');
  game.mode = 'over';
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('spectate').classList.add('hidden');
}
function score() { return Math.floor(runner.s) + runner.stars * 10; }

async function died(why) {
  sfx(why.includes('떨어') ? 'die' : 'bonk');
  game.mode = 'dead'; game.deadT = 0; game.why = why;
  const rpNow = game.rp; game.rp = null;
  reportPlay();
  const rec = { dist: Math.floor(runner.s), stars: runner.stars, themes: game.dreamsSeen, time: game.runT, name: game.profile.name, color: game.profile.color, mode: game.itemMode ? 'item' : 'speed', diff: game.diff, map: game.map, seed: game.seed, multi: game.multi || undefined, ver: game.ver || undefined };
  if (game.multi) net.send({ t: 'dead', dist: rec.dist, stars: rec.stars, why });
  game.rec = rec;
  // 출발표 · 플레이 기록이 있어야 기록이 올라간다 (출발표는 늦게 와도 조금 더 기다린다)
  rec.tk = await Promise.race([game.tkP, new Promise((ok) => setTimeout(ok, 8000))]) || game.tk || undefined; rec.replay = await encodeReplay(rpNow) || undefined;
  if (!logged()) { game.submitted = { anonPending: true }; return; } // 비로그인: 탈락 화면에서 임시 닉네임을 정해 남긴다
  try { game.submitted = await postScore(rec, () => { if (game.submitted === null) game.submitted = { waiting: true }; }); } catch (e) { game.submitted = { error: e.message }; }
  if (game.mode === 'over' && !game.multi && game.rec === rec) showOver(); // 점검이 끝나 늦게 올라갔으면 결과 화면을 고친다
}
// 기록 올리기: 서버 점검(배포) 중이면 다시 켜질 때까지 3초마다 다시 시도한다 (최대 5분)
async function postScore(body, onWait) {
  for (let i = 0; ; i++) {
    try { return await account.api('/api/dream/score', { method: 'POST', body }); }
    catch (e) { if ((e.status && e.status < 500) || i >= 100) throw e; onWait?.(); await new Promise((ok) => setTimeout(ok, 3000)); }
  }
}
async function showOver() {
  game.mode = 'over'; setTimeout(notifyNew, 900); // 별 · 기록이 들어간 뒤 새 업적을 알린다
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('spectate').classList.add('hidden'); $('howto').classList.add('hidden'); $('itembar').classList.add('hidden'); $('effects').innerHTML = ''; game.effHtml = '';
  show('over');
  $('ov-why').textContent = `💤 ${game.why || '꿈에서 깼어요'}`;
  const fin = game.rec || { dist: Math.floor(runner.s), stars: runner.stars }; // 쓰러진 순간의 기록 (쓰러지는 동안 조금 더 미끄러진 거리는 넣지 않는다 · 순위표와 같은 값)
  $('ov-score').textContent = (fin.dist + fin.stars * 10).toLocaleString();
  $('ov-detail').textContent = `${fin.dist.toLocaleString()}m 달림 · 별사탕 ${fin.stars}개 (⭐ +${starsEarned(fin.stars, game.diff, game.map).toLocaleString()}) · ${game.map === 'hell' ? '지옥' : game.map === 'void' ? '이공간' : '꿈'} ${game.dreamsSeen}개를 지났어요 · ${Math.floor(game.runT)}초`;
  const r = game.submitted;
  $('ov-save').classList.toggle('hidden', !r?.anonPending);
  if (r?.anonPending) { $('ov-nick').value = store.get(NICK_KEY) || game.profile.name; $('ov-save-btn').disabled = false; }
  $('ov-best').textContent = r?.pending ? '🔍 기록을 확인하고 있어요 · 확인되면 순위표에 올라가요' : r?.waiting ? '🔧 서버 점검 중이에요 · 끝나면 기록을 자동으로 올려요' : r?.error ? `기록을 올리지 못했어요 (${r.error})` : r?.newBest ? `🎉 내 최고 기록! 전체 ${r.me?.rank}위` : r?.me ? `내 최고 ${r.me.score.toLocaleString()}점 · 전체 ${r.me.rank}위` : '';
  if (r?.anonPending) $('ov-best').textContent = '';
  if (r?.newBest) sfx('best');
  $('again-btn').textContent = game.multi ? '👥 방으로 돌아가기' : '🔁 다시 달리기';
  $('ov-board-title').classList.remove('hidden'); $('ov-board').classList.remove('hidden');
  $('ov-board-title').textContent = `🏆 ${mapTag(game.map)}${diffName(game.diff)} · ${modeName(game.itemMode ? 'item' : 'speed')} 최고 기록`;
  renderBoard($('ov-board'), r?.top ? r : await loadBoard(game.itemMode ? 'item' : 'speed', game.diff, game.map), true);
}

$('ov-save-btn').onclick = async () => {
  const name = $('ov-nick').value.trim();
  if (!name) { $('ov-nick').focus(); toast('닉네임을 정해 주세요'); return; }
  store.set(NICK_KEY, name);
  $('ov-save-btn').disabled = true;
  try {
    const r = await postScore({ ...game.rec, name, anon: anonId() }, () => { $('ov-best').textContent = '🔧 서버 점검 중이에요 · 끝나면 기록을 자동으로 올려요'; });
    game.submitted = r;
    $('ov-save').classList.add('hidden');
    $('ov-best').textContent = r.newBest ? `🎉 내 최고 기록! 전체 ${r.me?.rank}위` : `내 최고 ${r.me.score.toLocaleString()}점 · 전체 ${r.me.rank}위`;
    if (r.newBest) sfx('best');
    renderBoard($('ov-board'), r, true);
  } catch (e) { $('ov-save-btn').disabled = false; toast(`기록을 남기지 못했어요 (${e.message})`); }
};
$('ov-nick').onkeydown = (e) => { if (e.key === 'Enter') $('ov-save-btn').click(); };

// ---------- 꿈이 바뀔 때 ----------
function showDreamCard(d) {
  const th = track.themeOf(d);
  const el = $('dream-card');
  el.classList.add('hidden'); void el.offsetWidth;
  el.querySelector('.dc-n').textContent = `${th.hell ? 'HELL' : th.void ? 'VOID' : 'DREAM'} ${d + 1}`;
  el.querySelector('.dc-tip').textContent = th.tip || '';
  el.querySelector('.dc-e').textContent = th.emoji;
  el.querySelector('.dc-name').textContent = th.name;
  el.classList.remove('hidden');
  $('h-dream-n').textContent = `${th.hell ? '지옥' : th.void ? '이공간' : '꿈'} #${d + 1}`;
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
    this.ws.onopen = () => { this.open = true; hello(); };
    this.ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.handlers[m.t]?.(m); };
    this.ws.onclose = () => {
      this.open = false;
      if (game.paused) { pauseMsg('🔧 서버 점검 중이에요', '끝나면 지금 자리에서 그대로 이어 달려요'); setTimeout(() => { if (!game.paused) return; if (performance.now() - game.paused.at > PAUSE_MAX) return pauseGiveUp(); this.connect(); }, 2000); return; }
      chat?.show(false); if (game.multi && game.mode !== 'title') { toast('🔧 서버 업데이트 중... 20초 안에 복구돼요. 잠시 뒤 다시 들어와 주세요', 5000); setTimeout(() => { if (game.multi) toTitle(); }, 800); } };
  },
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); },
  on(t, f) { this.handlers[t] = f; },
};
function hello() { net.send({ t: 'hello', session: logged() ? account.session : null, name: game.profile.name, color: game.profile.color, look: game.profile.look, acc: game.profile.acc, resume: game.paused ? { room: game.paused.room, tok: game.paused.tok } : null }); }

// ---------- 서버 점검: 그 자리에서 멈췄다가 점검이 끝나면 다 같이 3·2·1 뒤 이어 달리기 ----------
//   maint(서버가 꺼지기 직전) → 멈춤 · 다시 접속 → resumed(자리 되찾음, 다른 사람 기다림) → resume(카운트다운 뒤 출발)
const PAUSE_MAX = 5 * 60 * 1000;
function pauseMsg(a, b) {
  let el = $('maint');
  if (!el) { el = document.createElement('div'); el.id = 'maint'; el.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(20,8,50,.55);backdrop-filter:blur(3px);z-index:15;font-family:Jua,sans-serif;text-align:center;padding:16px;pointer-events:none'; document.body.appendChild(el); }
  el.innerHTML = `<div style="font-size:34px">${esc(a)}</div><div style="font-size:19px;opacity:.85">${esc(b)}</div>`;
  el.classList.remove('hidden');
}
function pauseGiveUp() {
  game.paused = null; $('maint')?.classList.add('hidden');
  toast('점검이 길어져서 이어 달리지 못했어요 😢', 4000);
  game.room = null; toTitle();
}
net.on('maint', () => {
  if (!game.multi || !game.room || game.paused || !['count', 'run', 'dead', 'teamend'].includes(game.mode)) return;
  game.paused = { room: game.room.id, tok: net.tok, prev: game.mode, at: performance.now() };
  pauseMsg('🔧 서버 점검 중이에요', '끝나면 지금 자리에서 그대로 이어 달려요');
  keys.clear();
});
net.on('resumed', (m) => {
  if (!game.paused) return;
  game.myId = m.id; net.tok = m.tok; game.room = m.room; game.members = m.members;
  chat.reset(m.chat || []); chat.show(true);
  pauseMsg('✅ 점검이 끝났어요', '다른 친구들이 돌아오길 기다리는 중…');
});
net.on('resume', (m) => {
  const p = game.paused; if (!p) return;
  game.paused = null; $('maint')?.classList.add('hidden');
  game.members = m.members;
  for (const id of m.gone || []) { game.ghosts.get(id)?.remove(); game.ghosts.delete(id); }
  if (game.team) game.endAt = performance.now() + m.in + m.left;
  if (p.prev === 'run' || p.prev === 'count') { game.mode = 'count'; game.countT = m.in / 1000; game.countN = null; }
  else game.mode = p.prev;
  toast('🌙 이어 달려요!', 1500);
});
function openLobby() {
  game.multi = true; net.pendingJoin = null;
  show('lobby'); $('rooms').innerHTML = '<div class="empty">방 목록을 불러오는 중…</div>';
  if (net.open) hello(); else net.connect();
}
function joinByCode(v) {
  const code = codeOf(v);
  if (code.length !== 6) { toast('초대 코드 6자리를 넣어 주세요'); return; }
  unlock();
  if (!game.profile.name?.trim()) { toast('달리기 이름을 정해 주세요'); return; }
  game.multi = true; net.pendingJoin = code;
  toast(`🎟️ ${code} 방에 들어가는 중…`, 1200);
  if (net.open) hello(); else net.connect();
}
function renderRooms(list) {
  const el = $('rooms');
  if (!list.length) { el.innerHTML = '<div class="empty">열린 방이 없어요. 방을 만들거나 빠른 참가를 눌러 보세요!</div>'; return; }
  el.innerHTML = '';
  for (const r of list) {
    const d = document.createElement('div'); d.className = 'room';
    d.innerHTML = `<span class="nm">${esc(r.name)}</span><span class="meta">${r.team ? '👥 팀전 · ' : ''}${mapTag(r.map)}${diffName(r.diff)} · ${modeName(r.mode)} · 👑 ${esc(r.host)} · ${r.n}/${r.max}</span><span class="tag ${r.state === 'run' ? 'run' : ''}">${r.state === 'run' ? '달리는 중' : '기다리는 중'}</span>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '들어가기';
    b.disabled = r.state === 'run' || r.n >= r.max;
    b.onclick = () => net.send({ t: 'join', id: r.id });
    d.appendChild(b); el.appendChild(d);
  }
}
function renderRoom(rank) {
  const r = game.room; if (!r) return;
  $('room-title').textContent = `🌙 ${r.name}`;
  $('code-txt').textContent = r.id;
  segSet('room-mode', r.mode || 'speed'); segSet('room-diff', diffOf(r.diff)); segSet('room-map', mapOf(r.map));
  const me = game.members.find((m) => m.id === game.myId);
  const host = !!me?.host;
  for (const b of $('room-team').children) { b.classList.toggle('on', (b.dataset.t === '1') === !!r.team); b.disabled = !host; }
  $('team-row').classList.toggle('hidden', !r.team);
  const el = $('members'); el.innerHTML = '';
  el.className = r.team ? 'teams' : '';
  if (r.team) {
    // 팀전: 딸기팀 · 소다팀 두 줄
    for (const k of ['red', 'blue']) {
      const col = document.createElement('div'); col.className = `team-col ${k}`;
      const list = game.members.filter((m) => m.team === k);
      col.innerHTML = `<h4>${TEAMS[k].name} (${list.length})</h4>` + list.map((m) => `<div class="mem${m.id === game.myId ? ' me' : ''}"><span class="dot" style="background:${esc(m.color)}"></span>${m.host ? '👑 ' : ''}${esc(m.name)}</div>`).join('');
      el.appendChild(col);
    }
  } else for (let i = 0; i < 12; i++) {
    const m = game.members[i];
    const d = document.createElement('div');
    d.className = 'mem' + (m ? (m.id === game.myId ? ' me' : '') : ' slot');
    d.innerHTML = m ? `<span class="dot" style="background:${esc(m.color)}"></span>${m.host ? '👑 ' : ''}${esc(m.name)}` : '빈 자리';
    el.appendChild(d);
  }
  $('start-btn').classList.toggle('hidden', !host);
  for (const b of [...$('room-mode').children, ...$('room-diff').children, ...$('room-map').children]) b.disabled = !host; // 모드 · 난이도는 방장이 정한다
  $('room-hint').textContent = host ? `${game.members.length}명이 모였어요. 준비되면 출발을 눌러요! (혼자서도 시작할 수 있어요)` : '방장이 출발을 누르면 다 같이 달려요 🌙';
  if (rank) {
    $('room-rank').classList.remove('hidden');
    $('room-rank').innerHTML = '<h3>🏁 지난 판 순위</h3>' + rank.map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}</span><span class="sc">${e.dist.toLocaleString()}m<small>⭐${e.stars}</small></span></div>`).join('');
  }
}
net.on('hello', (m) => {
  game.myId = m.id; net.tok = m.tok;
  if (game.paused) { pauseGiveUp(); return; } // 점검 사이에 방이 사라졌다
  if (net.pendingJoin) { net.send({ t: 'join', id: net.pendingJoin }); net.pendingJoin = null; return; }
  renderRooms(m.rooms);
});
net.on('rooms', (m) => { if (!game.room) renderRooms(m.rooms); });
net.on('error', (m) => {
  toast(m.text || '문제가 생겼어요', 2600);
  // 코드로 들어가다 실패했는데 방 밖이면: 로그인 안 했으면 처음 화면으로
  if (!game.room && game.mode !== 'run' && $('lobby').classList.contains('hidden')) { game.multi = false; show('title'); }
});
// 방 채팅 (대기실부터 달리는 중까지 · 팀전이면 팀에게만도)
const chat = new Chat({ send: (m) => net.send(m), myId: () => game.myId, teamMode: () => !!game.room?.team, myTeam: () => game.members?.find((x) => x.id === game.myId)?.team, teamColor: (t) => TEAMS[t]?.color });
net.on('chat', (m) => chat.receive(m));
net.on('joined', (m) => { chat.reset(m.chat || []); chat.show(true); game.room = m.room; game.members = m.members; $('room-rank').classList.add('hidden'); show('room'); renderRoom(); });
net.on('room', (m) => { game.room = m.room; game.members = m.members; chat.renderScope(); if (game.mode !== 'run' && game.mode !== 'count' && game.mode !== 'dead') { if (!$('room').classList.contains('hidden') || !$('over').classList.contains('hidden')) renderRoom(); } });
net.on('left', () => { chat.show(false); const was = game.room; game.room = null; if (!game.multi || !was) return; afterLeave(); });
net.on('start', (m) => {
  game.members = m.members;
  game.team = !!m.team; game.tk = null; game.starting = true;
  game.myTeam = m.members.find((x) => x.id === game.myId)?.team;
  game.endAt = performance.now() + m.in + (m.dur || 180) * 1000; game.respawnT = 0;
  newRun(m.seed, m.mode === 'item', m.diff, m.map); game.starting = false;
  for (const mem of m.members) if (mem.id !== game.myId) { const g = new Ghost(scene, game.team ? { ...mem, teamColor: TEAMS[mem.team]?.color } : mem); g.speedK = runner.speedK; game.ghosts.set(mem.id, g); }
  $('teambar').classList.toggle('hidden', !game.team);
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
net.on('shoved', (m) => { if (game.mode !== 'run' || !runner.alive) return; if (runner.shoved(m.dir) === 'blocked') { toast('🛡️ 밀치기를 막았어요!', 1000); return; } sfx('shoved'); const who = game.members.find((x) => x.id === m.by); toast(`🫸 ${who?.name || '누군가'}에게 밀쳐졌어요!`, 1000); });
// 다른 사람이 쓴 아이템: 충격파는 가까우면 밀려나고, 함정은 그 자리에 생긴다
net.on('item', (m) => {
  if (!Array.isArray(m.p) || game.mode === 'title') return;
  const [s, x, y] = m.p.map(Number);
  const who = game.members.find((q) => q.id === m.by)?.name || '누군가';
  const friend = game.team && m.team === game.myTeam; // 팀전: 우리 팀 함정 · 충격파는 나한테 안 통한다
  if (m.k === 'trap') track.trap(s, x, y, friend);
  if (m.k === 'wave') {
    sfx('wave');
    if (!friend && game.mode === 'run' && runner.alive && Math.abs(s - runner.s) < 8 && Math.abs(x - runner.x) < 7) {
      const r = runner.shoved(Math.sign(runner.x - x) || 1);
      toast(r === 'blocked' ? '🛡️ 충격파를 막았어요!' : `💥 ${who}의 충격파에 밀려났어요!`, 1200);
    }
  }
});
net.on('shovefx', (m) => { const g = game.ghosts.get(m.by); if (g) g.shoveT = 0.3; });
function showTeamOver(m) {
  game.mode = 'over';
  for (const id of ['hud', 'touch', 'spectate', 'howto', 'itembar', 'teambar']) $(id).classList.add('hidden');
  show('over');
  const T = m.team, mine = game.myTeam;
  $('ov-why').textContent = T.winner === 'draw' ? '🤝 비겼어요!' : `🏆 ${TEAMS[T.winner].name} 승리!`;
  $('ov-score').textContent = T.winner === 'draw' ? '무승부' : T.winner === mine ? '이겼어요! 🎉' : '아쉽게 졌어요';
  if (T.winner === mine) sfx('best');
  $('ov-best').textContent = '';
  $('ov-detail').innerHTML = `<div id="ov-team">${TEAMS.red.name} ${T.red.toLocaleString()}m${T.redBy ? ` <small>(${esc(T.redBy)})</small>` : ''} · ${TEAMS.blue.name} ${T.blue.toLocaleString()}m${T.blueBy ? ` <small>(${esc(T.blueBy)})</small>` : ''}</div>`;
  $('ov-save').classList.add('hidden');
  $('ov-room').classList.remove('hidden');
  $('ov-room').innerHTML = '<h3>🏁 이번 판 순위</h3>' + m.rank.map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${TEAMS[e.team]?.color || esc(e.color)}"></span>${esc(e.name)}</span><span class="sc">${e.dist.toLocaleString()}m</span></div>`).join('');
  // 팀전은 시간 제한 경기라 개인 최고 기록 순위표에는 올리지 않는다
  $('ov-board-title').classList.add('hidden'); $('ov-board').classList.add('hidden');
  $('again-btn').textContent = '👥 방으로 돌아가기';
  renderRoom(m.rank);
}
net.on('finish', (m) => {
  reportPlay(); // 팀전은 탈락 없이 끝난다
  if (m.team) { showTeamOver(m); return; }
  $('ov-board-title').classList.remove('hidden'); $('ov-board').classList.remove('hidden');
  // 모두 탈락: 방 안 순위 + 전체 순위표
  game.lastRank = m.rank;
  const show2 = () => { showOver().then(() => { $('ov-room').classList.remove('hidden'); $('ov-room').innerHTML = '<h3>🏁 이번 판 순위</h3>' + m.rank.map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}</span><span class="sc">${e.dist.toLocaleString()}m<small>⭐${e.stars}</small></span></div>`).join(''); renderRoom(m.rank); }); };
  if (game.mode === 'dead' && game.deadT < 1.4) setTimeout(show2, (1.4 - game.deadT) * 1000); else show2();
});
$('quick-btn').onclick = () => net.send({ t: 'quick', mode: game.pickMode, diff: game.pickDiff, map: game.pickMap });
$('create-btn').onclick = () => net.send({ t: 'create', name: $('room-name').value, mode: game.pickMode, diff: game.pickDiff, map: game.pickMap });
$('lobby-back').onclick = () => { game.multi = false; show('title'); };
$('leave-btn').onclick = () => { net.send({ t: 'leave' }); game.room = null; $('ov-room').classList.add('hidden'); afterLeave(); };
// 방에서 나온 뒤: 로그인했으면 방 목록, 아니면 처음 화면
function afterLeave() { show('lobby'); net.send({ t: 'list' }); }
$('start-btn').onclick = () => net.send({ t: 'start' });
async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); toast(`📋 ${label} 복사했어요`); }
  catch { window.prompt(`${label}을(를) 복사해 주세요`, text); }
}
$('copy-link').onclick = () => copy(`${location.origin}/dream-runner/?room=${game.room?.id}`, '초대 링크');
$('copy-code').onclick = () => copy(game.room?.id || '', '초대 코드');

// ---------- 밀치기 · 부딪힘 ----------
function multiTick(dt) {
  game.sendT -= dt;
  if (game.sendT <= 0 && runner.alive && game.mode === 'run') {
    game.sendT = 1 / 15;
    const f = (runner.slideT > 0 && runner.onGround ? 1 : 0) | (runner.onGround ? 0 : 2) | (runner.shoveT > 0 ? 4 : 0) | (runner.flipT > 0 ? 8 : 0) | (runner.boost > 0.5 ? 16 : 0) | (runner.eff.shield > 0 ? 32 : 0) | (runner.eff.ghost > 0 ? 64 : 0) | (runner.eff.cloud > 0 ? 128 : 0) | (runner.eff.magnet > 0 ? 256 : 0) | (runner.eff.rocket > 0 ? 512 : 0) | (runner.eff.slow > 0 ? 1024 : 0) | (runner.invul > 0 ? 2048 : 0);
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
      if (!g.alive || (game.team && game.members.find((x) => x.id === g.id)?.team === game.myTeam)) continue; // 팀전: 같은 팀은 못 밀친다
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
// 시점: 기본은 살짝 위에서 내려다봐 바로 앞 낮은 장애물까지 보인다. V 로 낮은 예전 시점과 바꾼다
const CAM = { high: { up: 4.9, back: 7.2, look: 0.75, ahead: 10 }, low: { up: 3.3, back: 7.4, look: 1.2, ahead: 9 } };
game.camLow = store.get(CAM_KEY) === 'low'; game.camK = game.camLow ? 1 : 0;
function toggleCam() { game.camLow = !game.camLow; store.set(CAM_KEY, game.camLow ? 'low' : 'high'); $('b-cam').textContent = game.camLow ? '🎬' : '🎥'; toast(game.camLow ? '🎬 낮은 시점 (V)' : '🎥 높은 시점 (V)', 1200); }
$('b-cam').onclick = toggleCam; $('b-cam').textContent = game.camLow ? '🎬' : '🎥';
$('pn-btn').onclick = () => openPatchNotes();
$('cos-btn').onclick = () => openWardrobe('shop', () => { renderAccount(); }, { game: 'dream-runner' }); // 업적 칸엔 드림 러너 업적만
function frame() {
  requestAnimationFrame(frame);
  // 프레임 시간을 0.1ms 단위로 (기록과 똑같이 다시 돌릴 수 있게 · 몸으로 느낄 수 없는 차이)
  const dtRaw = Math.min(0.05, clock.getDelta()) + (game.dtCarry || 0), dtT = Math.round(dtRaw * 10000), dt = dtT / 10000; game.dtCarry = dtRaw - dt;
  t += dt;
  readInput();
  const z = track.origin - runner.s;
  if (game.mode === 'title') {
    // 처음 화면: 출발 발판에서 제자리 달리기 + 꿈이 6초마다 바뀌며 빙글 도는 카메라
    game.titleT += dt;
    if (game.titleT > 6) { game.titleT = 0; const pool = game.pickMap === 'hell' ? HELLS : game.pickMap === 'void' ? VOIDS : THEMES, th = pool[Math.floor(Math.random() * pool.length)]; env.setTheme(th); }
    runner.bear.root.position.set(0, 0, z); runner.bear.root.rotation.y = Math.PI;
    runner.bear.update(dt, 8, { noCrawl: true });
    const a = t * 0.18;
    camera.position.set(Math.sin(a) * 7, 2.6, z + Math.cos(a) * 7);
    camera.lookAt(0, 1.1, z);
  } else if (game.paused) {
    hud(); // 서버 점검: 그 자리에서 멈춰 있는다
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
      if (game.rp && game.rp.dts.length < 450000) { const R = game.rp, bits = (input.dir + 1) | (input.jump ? 4 : 0) | (input.slide ? 8 : 0) | (input.slideHeld ? 16 : 0); if (bits !== R.last) { R.evs.push(`${R.dts.length}:${bits}`); R.last = bits; } R.dts.push(dtT); } else if (game.rp) game.rp = null; // 이 판의 입력 기록
      // 빠를 때는 잘게 나눠 움직인다 (한 프레임에 장애물을 뛰어넘어 버리지 않게)
      const steps = Math.min(16, Math.max(1, Math.ceil(runner.v * dt / 0.6)));
      let why = null;
      for (let i = 0; i < steps && !why; i++) {
        runner.substep = i; why = runner.update(dt / steps, input, track, onFx);
        input.jump = input.slide = false; // 누른 순간은 첫 조각에서만
      }
      runner.substep = 0;
      if (input.item && runner.alive) useItem();
      if (why) { if (game.team) teamDown(why); else died(why); }
      if (game.team && !runner.alive) { game.respawnT -= dt; if (game.respawnT <= 0) { runner.respawn(track); sfx('use_shield'); } }
      if (game.team && performance.now() >= game.endAt) { game.mode = 'teamend'; toast('⏰ 시간 끝! 결과를 기다리는 중…', 4000); sfx('beep', true); }
    } else if (game.mode === 'dead') {
      runner.update(dt, input, track);
      game.deadT += dt;
      if (game.deadT > 1.4 && !game.multi && game.submitted !== null) showOver();
      if (game.multi && game.deadT > 1.4) spectate();
    }
    track.update(game.runT, runner.s, game.mode === 'run' && runner.alive ? runner.v : 0, dt);
    if (track.hell) { game.underY += (track.deathY(runner.s) + 3 - game.underY) * Math.min(1, dt * 2); env.underY = game.underY; }
    track.generate(Math.max(runner.s, game.multi ? maxGhostS() : 0));
    if (game.mode === 'run') {
      const d = track.dreamAt(runner.s);
      if (d !== game.dream) enterDream(d);
    }
    runner.pose(dt, track.origin - runner.s);
    if (game.multi) multiTick(dt);
    followCamera(dt);
    game.camHook?.(camera, runner, track); // 점검용: 카메라를 옆에 두고 동작 보기
    hud();
  }
  input.jump = input.slide = input.shove = input.item = false;
  env.update(dt, t, camera, runner.s, runner.x, runner.y);
  renderer.render(scene, camera);
}
$('spectate').onclick = () => cycleWatch();
function teamDown(why) {
  sfx(why.includes('떨어') ? 'die' : 'bonk');
  game.respawnT = 1.0;
  toast(`💫 ${why} · 1초 뒤 그 자리에서 부활!`, 1200);
}
function maxGhostS() { let m = 0; for (const g of game.ghosts.values()) if (g.alive) m = Math.max(m, g.s); return m; }
// 관전: 탈락한 뒤엔 가장 멀리 간 사람을 따라간다
// Space: 다음 사람 (멀리 간 순서대로)
const aliveGhosts = () => [...game.ghosts.values()].filter((g) => g.alive).sort((a, b) => b.s - a.s);
function cycleWatch() { const L = aliveGhosts(); if (!L.length) return; game.watchPick = L[(L.indexOf(game.watch) + 1) % L.length]; sfx('item'); }
function spectate() {
  let best = game.watchPick?.alive ? game.watchPick : null;
  if (!best) for (const g of game.ghosts.values()) if (g.alive && (!best || g.s > best.s)) best = g;
  const el = $('spectate');
  if (game.mode !== 'dead') { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const alive = [...game.ghosts.values()].filter((g) => g.alive).length;
  el.innerHTML = best ? `👀 <b>${esc(best.name)}</b> 관전 중 · ${aliveGhosts().indexOf(best) + 1}/${alive}등 <span class="key">Space</span> 다른 사람` : '모두의 결과를 기다리는 중…';
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
  const v = w ? speedAt(s) * (runner.speedK || 1) : runner.v;
  const dead = game.mode === 'dead' && !w;
  game.camK += ((game.camLow ? 1 : 0) - game.camK) * Math.min(1, dt * 6);
  const mix = (a, b) => a + (b - a) * game.camK, up = mix(CAM.high.up, CAM.low.up), back = mix(CAM.high.back, CAM.low.back), look = mix(CAM.high.look, CAM.low.look), ahead = mix(CAM.high.ahead, CAM.low.ahead);
  // 지옥: 바닥 높이가 계속 바뀐다 · 떨어지는 동안은 위에서 내려다봐서 내릴 곳이 보이게
  const hell = track.hell, fl = hell ? track.deathY(s) + 6 : -6, drop = hell && !w && runner.alive && !runner.onGround ? y - (fl + 10) : 0, falling = drop > 7 ? Math.min(1, (drop - 7) / 12) : 0; // 숙이기 · 작은 턱에는 시점이 흔들리지 않고, 까마득히 떨어질 때만 내려다본다
  game.camFall = (game.camFall || 0) + (falling - (game.camFall || 0)) * Math.min(1, dt * 2.5);
  // 지옥 공중: 오르는 동안만 따라가고 내려오는 동안은 그 높이에 머문다 (계단에서 꼭대기 → 발판으로 출렁이지 않게). 뛴 발판보다 아래로 떨어지면 다시 따라간다
  let yc = y;
  if (hell && !w && runner.alive) {
    if (runner.onGround || game.camG == null) { game.camG = y; game.camR = y; }
    else if (y < game.camG - 0.5) game.camR = y;
    else game.camR = Math.max(game.camR, game.camG + Math.max(0, y - game.camG - 0.8));
    yc = game.camR;
  } else game.camG = null;
  const cx = x * 0.85, cy = Math.max(yc, fl) + up + game.camFall * 5;
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (cy - camera.position.y) * (dead ? k * 0.3 : hell ? Math.min(1, k * 1.5) : k);
  camera.position.z = dead ? camera.position.z : z + back;
  camLook.set(x, Math.max(yc, fl - 2) + look - game.camFall * 9, z - ahead);
  camera.lookAt(camLook);
  if (game.shake > 0) { game.shake = Math.max(0, game.shake - dt * 2.4); camera.rotation.z += (Math.random() - 0.5) * game.shake * 0.05; camera.position.y += (Math.random() - 0.5) * game.shake * 0.3; }
  const fov = Math.min(88, 60 + (v - V0) * 0.55); // 아주 빠른 난이도에서 화면이 지나치게 벌어지지 않게
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
}
// 달리는 중 생기는 일 (소리 · 아이템 칸)
// 괴물이 내리쳤다: 가까울수록 크게 흔들린다
track.onSlam = (st, d) => { if (game.mode !== 'run' || d > 240) return; sfx('bonk'); game.shake = Math.max(game.shake || 0, 1); };
function onFx(n, a) {
  if (n === 'jump2') runner.bear.cos?.fire('jump'); else if (n === 'land') runner.bear.cos?.fire('land');
  if (n === 'item') { sfx('item'); renderItems(false, true); return; }
  if (n === 'itemfull') { toast('🎒 아이템은 2개까지 들 수 있어요 (Q로 쓰기)', 1000); return; }
  if (n === 'use') return;
  if (n === 'shieldbreak') { sfx('shieldbreak'); toast('🛡️ 방어막이 막아 줬어요!', 900); return; }
  if (n === 'trapped') { sfx('trapped'); toast('🍯 끈적! 젤리 함정을 밟았어요', 1000); return; }
  sfx(n, a);
}
function useItem() {
  const id = runner.useItem(track);
  if (!id) return;
  const d = ITEMS[id];
  sfx('use_' + id);
  toast(`${d.emoji} ${d.name}!`, 800);
  if (id === 'teleport') { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.7'; void f.offsetWidth; f.style.transition = 'opacity .5s'; f.style.opacity = '0'; }
  if (id === 'trap') { track.trap(runner.s - 1.5, runner.x, runner.y, true); if (game.multi) net.send({ t: 'item', k: 'trap', p: [runner.s - 1.5, runner.x, runner.y] }); }
  if (id === 'wave' && game.multi) net.send({ t: 'item', k: 'wave', p: [runner.s, runner.x, runner.y] });
  renderItems();
}
// 아이템 칸 (먹으면 잠깐 룰렛처럼 돌다가 멈춘다)
const EMOJIS = Object.values(ITEMS).map((d) => d.emoji);
function renderItems(reset, roll) {
  if (reset) { clearInterval(game.rollT); game.rolling = false; }
  const slots = [$('slot0'), $('slot1')];
  if (roll) {
    clearInterval(game.rollT); game.rolling = true;
    const i = runner.items.length - 1, el = slots[i];
    el.classList.add('spin'); let n = 0;
    game.rollT = setInterval(() => { el.textContent = EMOJIS[n++ % EMOJIS.length]; if (n > 10) { clearInterval(game.rollT); game.rolling = false; el.classList.remove('spin'); renderItems(); } }, 70);
    return;
  }
  if (game.rolling) return;
  slots.forEach((el, i) => { el.textContent = runner.items[i] ? ITEMS[runner.items[i]].emoji : ''; el.classList.remove('spin'); });
}
function teamHud() {
  if (!game.team) return;
  const left = Math.max(0, (game.endAt - performance.now()) / 1000);
  const tt = $('tb-time'); tt.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  tt.classList.toggle('hurry', left < 20);
  const best = { red: 0, blue: 0 };
  if (game.myTeam) best[game.myTeam] = Math.max(best[game.myTeam], runner.s);
  for (const g of game.ghosts.values()) { const tm = game.members.find((x) => x.id === g.id)?.team; if (tm) best[tm] = Math.max(best[tm], g.s); }
  $('tb-red').textContent = `${Math.floor(best.red).toLocaleString()}m`; $('tb-blue').textContent = `${Math.floor(best.blue).toLocaleString()}m`;
  document.querySelector('#teambar .red').classList.toggle('lead', best.red > best.blue);
  document.querySelector('#teambar .blue').classList.toggle('lead', best.blue > best.red);
}
function hud() {
  teamHud();
  // 켜져 있는 아이템 효과와 남은 시간
  if (game.itemMode) {
    const on = Object.entries(runner.eff).filter(([k, v]) => v > 0 && ITEMS[k]).map(([k, v]) => `<span>${ITEMS[k].emoji} ${Math.ceil(v)}</span>`).join('') + (runner.eff.slow > 0 ? '<span>🍯 끈적</span>' : '');
    if (on !== game.effHtml) { game.effHtml = on; $('effects').innerHTML = on; }
  } else if (game.effHtml) { game.effHtml = ''; $('effects').innerHTML = ''; }
  $('h-score').textContent = score().toLocaleString();
  $('h-dist').textContent = `${Math.floor(runner.s).toLocaleString()}m`;
  $('h-stars').textContent = runner.stars;
  $('h-speed').textContent = `${Math.round(runner.v * 3.6)}km/h`;
  $('h-speed').classList.toggle('on', runner.boost > 0.3);
  $('speedlines').style.opacity = game.mode === 'run' ? '0.4' : '0'; // 늘 가속이라 앞이 잘 보이게 옅게
  const b0 = track.bounds[game.dream] ?? 0, b1 = track.nextBoundary(runner.s);
  $('h-next').firstElementChild.style.width = `${Math.max(0, Math.min(1, (runner.s - b0) / Math.max(1, b1 - b0))) * 100}%`;
  if (game.multi) $('h-alive').textContent = `🐻 ${(runner.alive ? 1 : 0) + [...game.ghosts.values()].filter((g) => g.alive).length}/${game.members.length}`;
}

boot();
frame();
setTimeout(() => { if (game.mode === 'title' && !new URLSearchParams(location.search).has('room')) showWhatsNew('dream-runner'); }, 900);
