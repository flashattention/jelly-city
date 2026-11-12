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
import { SEOULS } from './seouls.js';
import { makeSeoulMover, seoulNight, seoulTick } from './seoul-movers.js';
import { SeoulRun } from './seoul-run.js';
import { openPatchNotes, showWhatsNew } from '../../shared/js/patchnotes.js';
import { openWardrobe, notifyNew, titleHtml, medalHtml, loadCos } from '../../shared/js/wardrobe.js';
import { starsEarned } from '../../shared/js/cos-items.js';
import { Hangang, SEASONS, WEATHERS, TIMES, SPEEDS, V_MIN, V_MAX } from './hangang.js';
import { mapPlaces, HOOD_SPOTS } from './hangang-attractions.js';
import { setupMapWin } from './hangang-mapwin.js';

const $ = (id) => document.getElementById(id);
const MODE_KEY = 'dreamrunner.mode', DIFF_KEY = 'dreamrunner.diff', CAM_KEY = 'dreamrunner.cam', MAP_KEY = 'dreamrunner.map';
const mapOf = (m) => (m === 'hell' || m === 'void' || m === 'seoul' ? m : 'dream'), mapName = (m) => (m === 'hell' ? '🔥 랜덤 지옥' : m === 'void' ? '🌌 랜덤 이공간' : m === 'seoul' ? '🗺️ 서울' : '🌙 랜덤 꿈나라');
const mapTag = (m) => (m === 'hell' ? '🔥 지옥 · ' : m === 'void' ? '🌌 이공간 · ' : m === 'seoul' ? '🗺️ 서울 · ' : ''); // 순위표 · 방 이름 앞에
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
// 🗺️ 서울 맵: 길 위 차 · 버스 · 오토바이 · 자전거 · 행인 젤리 모양 (서버의 기록 다시 돌리기에선 모양 없이 판정만)
track.makeMover = makeSeoulMover;
env.originRef = track;
const runner = new Runner(scene, {});
// 🗺️ 서울 맵 그리기 (6-7): 서울 산책 엔진으로 실제 서울을, 판정 자리 물체는 실제 길 위로 휘어서
const seoulRun = new SeoulRun(renderer, camera), seoulCam = new THREE.PerspectiveCamera();
let seoulPost = null, seoulWas = false, seoulWaitT = 0;
const seoulOn = () => track.seoul && seoulRun.ready && game.mode !== 'title';
// 서울 맵 판에 들어가고 나올 때: 곰 · 길 · 그림자를 서울 장면으로 옮기고, 화면 설정(색 · 그림자 · 먼 거리)을 서울 산책처럼
function seoulSwap(on) {
  const to = on ? seoulRun.hw.scene : scene;
  for (const o of [track.root, runner.bear.root, runner.shadow]) to.add(o);
  for (const g of game.ghosts.values()) { to.add(g.bear.root); if (g.tag) to.add(g.tag); }
  if (on) {
    renderer.shadowMap.enabled = !isPhone; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.domElement.style.filter = '';
    camera.far = 24000; camera.updateProjectionMatrix();
    if (!isPhone && !seoulPost) import('./hangang-post.js').then(({ makePost }) => { if (!seoulPost) seoulPost = makePost(renderer, seoulRun.hw.scene, camera); }).catch(() => {});
  } else {
    seoulRun.unbend([...track.root.children, runner.bear.root, runner.shadow, ...[...game.ghosts.values()].flatMap((g) => [g.bear.root, g.tag])]);
    renderer.shadowMap.enabled = false; renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1; camera.far = 1600; camera.updateProjectionMatrix();
  }
}
env.setTheme(track.themeOf(0), true);

const game = window.dream = {
  mode: 'title',       // title · count · run · dead · over
  multi: false, seed: 0, runT: 0, countT: 0, dream: 0, dreamsSeen: 1,
  ghosts: new Map(), myId: 0, room: null, members: [],
  profile: { name: '꿈꾸는 곰돌이', color: '#8a5634' },
  titleT: 0, deadT: 0, submitted: null, sendT: 0, bumpT: 0,
};
game.runner = runner; game.seoulRun = seoulRun; game.track = track; game.env = env; game.scene = scene; game.renderer = renderer; window.__THEMES = THEMES; // 점검용 (콘솔에서 dream.runner 등)

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
  // 서울 산책: M = 큰 지도 (그 밖에선 소리 끄기)
  if (e.code === 'KeyM') { if (game.mode === 'hangang') hgMapWin?.toggle(); else muteBtn(); }
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
let joyDir = 0, joyId = null, joyY = 0, joyX = 0;
// 휴대폰: 터치하다가 화면 글자가 파랗게 선택되거나 길게 누르기 메뉴가 뜨지 않게 (글 쓰는 칸은 그대로)
const typing = (t) => !!t?.closest?.('input, textarea, [contenteditable]');
document.addEventListener('selectstart', (e) => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener('contextmenu', (e) => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener('touchstart', (e) => { if (!typing(e.target)) { const sel = window.getSelection?.(); if (sel && sel.rangeCount && !typing(document.activeElement)) sel.removeAllRanges(); } }, { passive: true });
{
  const joy = $('joy'), knob = $('joy-knob'), R = 40, DEAD = 12;
  // 작은 원은 큰 원 안에서 사방으로 움직이고, 좌우로 기운 만큼만 방향이 된다
  const move = (e) => { const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; joyDir = dx > DEAD ? 1 : dx < -DEAD ? -1 : 0; joyY = Math.abs(dy) > DEAD ? -dy / R : 0; joyX = Math.abs(dx) > DEAD ? dx / R : 0; joy.classList.toggle('on', joyDir !== 0); };
  const end = (e) => { if (e.pointerId !== joyId) return; joyId = null; joyDir = 0; joyY = 0; joyX = 0; knob.style.transform = ''; joy.classList.remove('on'); };
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
  if (chars.length < (on ? 4 : LOCAL_MAX) && !window.SEOUL_WALK) { const a = document.createElement('a'); a.className = 'chip'; a.href = '/?create=1&back=/dream-runner/'; a.textContent = '＋ 새 캐릭터'; a.style.textDecoration = 'none'; box.appendChild(a); }
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
$('solo-btn').onclick = () => { unlock(); for (const id of ['hg-start', 'hg-map']) $(id).classList.add('hidden'); startSoloFresh(); };
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
  env.fogK = game.map === 'hell' || game.map === 'void' ? Math.max(1, (K / 1.9) ** 0.7) : 1;
  track.reset(seed, itemMode, { map: game.map, K });
  // 서울 맵: 서울 산책 엔진을 준비하고 첫 코스 칸부터 만든다 (다른 맵이면 만들어 둔 칸을 내린다)
  if (game.map === 'seoul') { seoulWaitT = 0; seoulRun.init().then(() => { if (track.seoul && track.seed === seed) seoulRun.start(track); }).catch((e) => console.warn('서울 지도 없이', e)); }
  else if (seoulRun.hw?.chunks?.size) seoulRun.dispose();
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
  $('ov-detail').textContent = `${fin.dist.toLocaleString()}m 달림 · 별사탕 ${fin.stars}개 (⭐ +${starsEarned(fin.stars, game.diff, game.map).toLocaleString()}) · ${game.map === 'hell' ? '지옥' : game.map === 'void' ? '이공간' : game.map === 'seoul' ? '서울 코스' : '꿈'} ${game.dreamsSeen}개를 지났어요 · ${Math.floor(game.runT)}초`;
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

// 🗺️ 서울 맵: 차 · 버스 · 오토바이 · 자전거 · 행인을 아슬아슬하게 피하면 (스칠 듯 0.7m 안으로 지나가면) 한 번씩 알려 준다
function nearMiss() {
  const s = runner.s, x = runner.x, y = runner.y;
  for (const m of track.movers) {
    const o = m.ob; if (!o || o.s1 < -1e8 || o.x0 > 1e8 || (m.nearAt ?? -9) > game.runT - 1.2) continue;
    if (s + 0.3 < o.s0 || s - 0.3 > o.s1) continue;
    const gap = Math.max(o.x0 - (x + 0.3), (x - 0.3) - o.x1), over = y - o.y1;
    if ((gap > 0 && gap < 0.7) || (gap <= 0 && over > 0 && over < 0.6)) { m.nearAt = game.runT; game.nearN = (game.nearN || 0) + 1; nearPop(); }
  }
}
function nearPop() { let el = document.getElementById('near-pop'); if (!el) { el = document.createElement('div'); el.id = 'near-pop'; el.style.cssText = "position:fixed;left:50%;top:34%;transform:translate(-50%,0);font:900 30px 'Jua',sans-serif;color:#fff;text-shadow:0 3px 0 #ff4081,0 0 18px rgba(255,64,129,.7);pointer-events:none;z-index:20;transition:opacity .5s,transform .5s"; document.body.appendChild(el); }
  el.textContent = ['아슬아슬!', '휴~ 살짝!', '간발의 차!'][game.nearN % 3]; el.style.transition = 'none'; el.style.opacity = '1'; el.style.transform = 'translate(-50%,0) scale(1.15)'; void el.offsetWidth; el.style.transition = 'opacity .7s .3s, transform .7s'; el.style.opacity = '0'; el.style.transform = 'translate(-50%,-30px) scale(1)'; }
// ---------- 꿈이 바뀔 때 ----------
function showDreamCard(d) {
  const th = track.themeOf(d);
  const el = $('dream-card');
  el.classList.add('hidden'); void el.offsetWidth;
  el.querySelector('.dc-n').textContent = `${th.hell ? 'HELL' : th.void ? 'VOID' : th.seoul ? 'SEOUL' : 'DREAM'} ${d + 1}`;
  // 서울 코스: 실제 길 (어디 → 어디 · km · 낮/노을/밤)
  el.querySelector('.dc-tip').textContent = th.course ? `${th.course.from} → ${th.course.to} · ${th.course.km}km · ${th.course.time}` : th.tip || '';
  el.querySelector('.dc-e').textContent = th.emoji;
  el.querySelector('.dc-name').textContent = th.name;
  el.classList.remove('hidden');
  $('h-dream-n').textContent = `${th.hell ? '지옥' : th.void ? '이공간' : th.seoul ? '코스' : '꿈'} #${d + 1}`;
  $('h-dream-name').textContent = `${th.emoji} ${th.name}`;
}
function enterDream(d) {
  game.dream = d; game.dreamsSeen = Math.max(game.dreamsSeen, d + 1);
  const th = track.themeOf(d);
  env.setTheme(th);
  if (th.seoul) { seoulNight(th.light < 0.7); seoulRun.jumpHour(); }
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
// 꾸미기 창: 모습 · 옷장 · 별 상점 · 업적 (업적 칸엔 드림 러너 업적만, 모습은 지금 고른 캐릭터)
$('cos-btn').onclick = () => openWardrobe('shop', () => { renderAccount(); }, { game: 'dream-runner', char: store.get('jelly.char') || store.get(CHAR_KEY), onLook: () => renderAccount() });
function frame() {
  requestAnimationFrame(frame);
  // 프레임 시간을 0.1ms 단위로 (기록과 똑같이 다시 돌릴 수 있게 · 몸으로 느낄 수 없는 차이)
  // 서울 산책은 느린 기기에서도 실제 속도대로 (한 프레임 0.1초까지), 러너는 규칙대로 0.05초
  const dtRaw = Math.min(game.mode === 'hangang' ? 0.1 : 0.05, clock.getDelta()) + (game.dtCarry || 0), dtT = Math.round(dtRaw * 10000), dt = dtT / 10000; game.dtCarry = dtRaw - dt;
  t += dt;
  readInput();
  if (game.mode === 'hangang') { hgFrame(dt); return; }
  const z = track.origin - runner.s;
  if (game.mode === 'title') {
    // 처음 화면: 출발 발판에서 제자리 달리기 + 꿈이 6초마다 바뀌며 빙글 도는 카메라
    game.titleT += dt;
    if (game.titleT > 6) { game.titleT = 0; const pool = game.pickMap === 'hell' ? HELLS : game.pickMap === 'void' ? VOIDS : game.pickMap === 'seoul' ? SEOULS : THEMES, th = pool[Math.floor(Math.random() * pool.length)]; env.setTheme(th); }
    runner.bear.root.position.set(0, 0, z); runner.bear.root.rotation.y = Math.PI;
    runner.bear.update(dt, 8, { noCrawl: true });
    const a = t * 0.18;
    camera.position.set(Math.sin(a) * 7, 2.6, z + Math.cos(a) * 7);
    camera.lookAt(0, 1.1, z);
  } else if (game.paused) {
    hud(); // 서버 점검: 그 자리에서 멈춰 있는다
  } else {
    if (game.mode === 'count') {
      // 서울 맵 혼자 달리기: 첫 코스의 서울이 다 지어질 때까지 3에서 기다린다 (최대 25초, 같이 달리기는 기다리지 않는다)
      const wait = track.seoul && !game.multi && !seoulRun.failed && !(seoulRun.ready && seoulRun.track === track && seoulRun.firstReady()) && (seoulWaitT += dt) < 25;
      if (wait) { game.countT = Math.max(game.countT, 2.999); if (!game.seoulToast) { game.seoulToast = true; toast('🗺️ 서울을 펼치는 중…', 2500); } } else game.seoulToast = false;
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
    if (track.seoul) { seoulTick(game.runT); if (game.mode === 'run' && runner.alive) nearMiss(); }
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
  const sOn = seoulOn(); if (sOn !== seoulWas) { seoulWas = sOn; seoulSwap(sOn); }
  if (sOn) { seoulFrame(dt); return; }
  env.update(dt, t, camera, runner.s, runner.x, runner.y);
  renderer.render(scene, camera);
}
// 서울 맵 한 프레임: 칸 불러오기 · 판정 자리 물체 휘기 · 카메라 · 하늘 · 그리기
const seoulP = new THREE.Vector3();
function seoulFrame(dt) {
  seoulRun.tick(dt, runner.s);
  const objs = [...track.root.children, runner.bear.root, runner.shadow];
  for (const g of game.ghosts.values()) { if (g.bear.root.parent !== seoulRun.hw.scene) seoulRun.hw.scene.add(g.bear.root); objs.push(g.bear.root); if (g.tag) { if (g.tag.parent !== seoulRun.hw.scene) seoulRun.hw.scene.add(g.tag); objs.push(g.tag); } }
  seoulRun.bend(objs);
  // 카메라: 곧은 길 자리(seoulCam)에서 정한 것을 곰이 있는 코스 길 위로
  const w = game.watch && game.mode === 'dead' && game.multi ? game.watch : null, d = track.dreamAt(w ? w.s : runner.s);
  seoulRun.world(seoulCam.position, d, camera.position); seoulRun.world(camLook, d, seoulP); camera.lookAt(seoulP);
  if (game.shake > 0) camera.rotation.z += (Math.random() - 0.5) * game.shake * 0.05;
  seoulRun.world(new THREE.Vector3(runner.x, 0, track.origin - runner.s), track.dreamAt(runner.s), seoulP);
  seoulRun.frame(dt, camera, seoulP.x, seoulP.z, track.themeOf(game.dream));
  if (seoulPost) { seoulPost.mood(seoulRun.hw.light); seoulPost.render(); } else renderer.render(seoulRun.hw.scene, camera);
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
    // 목표 높이(camH)를 정하고, 시점은 그 높이로 부드럽게 따라간다 (착지 순간 한 번에 내려앉으면 화면이 툭 꺾인다)
    if (game.camG == null) { game.camG = y; game.camH = y; game.camR = y; }
    if (runner.onGround) { game.camG = y; game.camH = y; }
    else if (y < game.camG - 0.5) game.camH = y;
    else game.camH = Math.max(game.camH, game.camG + Math.max(0, y - game.camG - 0.8));
    game.camR += (game.camH - game.camR) * Math.min(1, dt * 7);
    yc = game.camR;
  } else game.camG = null;
  const cx = x * 0.85, cy = Math.max(yc, fl) + up + game.camFall * 5;
  // 서울 맵: 곧은 길 자리에서 정하고, 그리기 전에 실제 길 위로 옮긴다 (seoulFrame)
  const cam = seoulOn() ? seoulCam : camera;
  cam.position.x += (cx - cam.position.x) * k;
  cam.position.y += (cy - cam.position.y) * (dead ? k * 0.3 : hell ? Math.min(1, k * 1.5) : k);
  cam.position.z = dead ? cam.position.z : z + back;
  camLook.set(x, Math.max(yc, fl - 2) + look - game.camFall * 9, z - ahead);
  cam.lookAt(camLook);
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
setTimeout(() => { if (game.mode === 'title' && !window.SEOUL_WALK && !new URLSearchParams(location.search).has('room')) showWhatsNew('dream-runner'); }, 900);

// ---------- 🌉 한강 러닝 ----------
//   장애물 · 탈락 없이 내 속도로 달리는 힐링 맵. 거리 · 순간(노을 · 비 · 눈 …)은 서버에 모여 업적이 된다
let hg = new Hangang();
// 지역마다 따로 (여의도 한강 · 홍대 거리 …): 화면 쪽 연결(on…)은 처음 것에서 그대로 옮겨 단다
const HG_REGIONS = { yeouido: { label: '🌉 여의도 한강', start: '🚩 서강대교에서 시작' }, hongdae: { label: '🎸 홍대 거리', start: '🚩 상수역에서 시작' }, namsan: { label: '🗼 남산타워', start: '🚩 정상 한양도성 길에서 시작' }, itaewon: { label: '🌍 이태원 거리', start: '🚩 녹사평역에서 시작' }, banpo: { label: '🌈 반포 한강', start: '🚩 동작대교에서 시작' }, ttukseom: { label: '🏙️ 뚝섬 한강', start: '🚩 영동대교에서 시작' }, seongsu: { label: '☕ 성수 거리', start: '🚩 서울숲역에서 시작' }, gangnam: { label: '🏙️ 강남역', start: '🚩 신논현역에서 시작' }, jamsil: { label: '🎡 석촌호수 · 잠실', start: '🚩 석촌호수 서호에서 시작' }, myeongdong: { label: '🛍️ 명동', start: '🚩 명동역에서 시작' }, insadong: { label: '🏮 인사동 · 종로', start: '🚩 안국역에서 시작' }, bukchon: { label: '🏯 북촌 한옥마을', start: '🚩 안국역에서 시작' }, sinchon: { label: '🎓 신촌', start: '🚩 신촌역에서 시작' } };
const hgInst = { yeouido: hg }; let hgRegion = 'yeouido';
// 점검용 (콘솔 · 시험): 지금 쓰는 서울 산책 엔진
Object.defineProperty(game, 'hg', { get: () => hg });
// 지역을 옮길 때 넘길 시각 · 계절 · 날씨 (한 번 산책을 시작하면 그 뒤로는 유지)
let hgKeep = null;
function hgKeepNow() { if (hg?.bear) hgKeep = { opt: { ...hg.opt }, state: { ...hg.state }, weatherT: hg.weatherT }; }
// 서울 전체 이어 걷기: 서울 칸 지도가 다 만들어지면 켠다 (그 전엔 주소에 ?world=1 로 시험). 켜지면 지역은 '시작 장소'일 뿐, 장면은 하나
let hgWorld = new URLSearchParams(location.search).has('world'), hgWorldIdx = null;
async function hgCheckWorld() { try { hgWorldIdx ||= await (await fetch('seoul/index.json')).json(); if (hgWorldIdx.all?.length && hgWorldIdx.have.length >= hgWorldIdx.all.length) hgWorld = true; } catch { /* 칸 지도 없음 */ } return hgWorld; }
const hgTileAt = (x, z) => !!hgWorldIdx?.have?.some(([i, j]) => i === Math.floor(x / (hgWorldIdx.tile || 2000)) && j === Math.floor(z / (hgWorldIdx.tile || 2000)));
// 지역의 시작 자리(서울 좌표): 그 지역 코스 30m 지점, 코스 방향을 본다
async function hgRegionStart(id) { const S = await hgLoadSeoul(), R = S.regions.find((q) => q.id === id) || S.regions[0]; let k = 1; while (k < R.pts.length - 1 && R.acc[k] < 30) k++; const [ax, az] = R.pts[k - 1], [bx, bz] = R.pts[k]; return { x: bx, z: bz, face: Math.atan2(bx - ax, bz - az) }; }
// 새 지역 지도에도 기억해 둔 설정(미니맵 회전 · 계절 · 시간 …)을 그대로 (8-21: 다시 켜면 미니맵 설정이 풀리던 것)
function hgUse(id) { if (!HG_REGIONS[id]) id = 'yeouido'; if (hgWorld) { if (!hgInst.seoul) { const n = new Hangang(); for (const k of Object.keys(hg)) if (/^on[A-Z]|^api$/.test(k) && typeof hg[k] === 'function') n[k] = hg[k]; Object.assign(n.opt, hg.opt); hgInst.seoul = n; } hg = hgInst.seoul; hgRegion = id; return; } if (!hgInst[id]) { const n = new Hangang(); for (const k of Object.keys(hg)) if (/^on[A-Z]|^api$/.test(k) && typeof hg[k] === 'function') n[k] = hg[k]; Object.assign(n.opt, hg.opt); hgInst[id] = n; } hg = hgInst[id]; hgRegion = id; }
hg.api = (path) => account.api(path);
// 서울 칸의 셰이더를 보이기 전에 미리 만든다 (처음 보일 때 100 ~ 200ms 멈추던 것, 8-23)
hg.onCompile = (obj) => (renderer.compileAsync ? renderer.compileAsync(obj, camera, hg.scene) : null);
// 역 출구 계단을 오르내릴 때 잠깐 어두워졌다 밝아진다
hg.onFade = () => { let f = document.getElementById('hg-fade'); if (!f) { f = document.createElement('div'); f.id = 'hg-fade'; f.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:30;opacity:0;transition:opacity .5s ease-out'; document.body.appendChild(f); } f.style.transition = 'none'; f.style.opacity = '0.85'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .5s ease-out'; f.style.opacity = '0'; })); };
// 지하철 출입구 앞: 그 역 실시간 도착 (20초마다)
const LCOL = { '1호선': '#0052A4', '2호선': '#00A84D', '5호선': '#996CAC', '6호선': '#CD7C2F', '9호선': '#BDB092', 경의중앙선: '#77C4A3', 공항철도: '#0090D2', 신림선: '#6789CA' };
let hgSt = null, hgStT = null;
async function hgStationRender() {
  if (!hgSt) return; const el = $('hg-subway'), st0 = hgSt;
  try {
    const j = await account.api(`/api/seoul/subway/arrival?station=${encodeURIComponent(st0.name)}`); hg.arrivals = j.trains || []; hg.arrivalsAt = Date.now();
    // 기다리는 사이 역에서 멀어졌으면(hgSt 가 바뀜) 그리지 않는다 (예전엔 null.name 오류)
    if (hgSt !== st0) return;
    const rows = (j.trains || []).slice(0, 6).map((t) => `<div class="row"><span class="ln" style="background:${LCOL[t.line] || '#888'}">${String(t.line).replace('호선', '')}</span><span>${String(t.to || '').replace(/[<>&]/g, '')}</span><b>${String(t.msg || '').replace(/[<>&]/g, '')}</b></div>`).join('') || '<div class="row">곧 들어오는 열차가 없어요</div>';
    el.innerHTML = `<h4>🚇 ${hgSt.name}역${hgSt.ref ? ` · ${hgSt.ref}번 출구` : ''}</h4>${rows}<div class="note">실시간 · 서울 열린데이터광장</div>`;
  } catch (e) { if (hgSt !== st0) return; el.innerHTML = `<h4>🚇 ${hgSt.name}역${hgSt.ref ? ` · ${hgSt.ref}번 출구` : ''}</h4><div class="row">${/준비/.test(e.message) ? '실시간 도착 정보를 준비하고 있어요' : '도착 정보를 불러오지 못했어요'}</div>`; }
}
hg.onStation = (st) => { hgSt = st; clearInterval(hgStT); $('hg-subway').classList.toggle('hidden', !st); if (st) { $('hg-subway').innerHTML = `<h4>🚇 ${st.name}역</h4><div class="row">불러오는 중…</div>`; hgStationRender(); hgStT = setInterval(hgStationRender, 20000); } };
// 실시간 도시데이터 안내: 들어간 지역의 실제 장소 이름으로 (사람 수는 만 명 · 천 명 단위로)
hg.onCity = (c) => { if (!c?.congest) return; const n = (c.pplMin + c.pplMax) / 2, ppl = n >= 10000 ? `${Math.round(n / 10000)}만 명` : `${Math.max(1, Math.round(n / 1000))}천 명`; toast(`📡 지금 실제 ${c.area || HG_REGIONS[hgRegion]?.label || ''}: ${c.congest} · 약 ${ppl} · 도로 ${c.road || '-'}${c.temp != null ? ` · ${c.temp}°C` : ''}`, 3200); };
// 이웃 지역으로 걸어 들어가기: 지금 지역을 정리하고 그 지역 코스의 이쪽 끝에서 이어 걷는다
async function hgGoRegion(G) {
  hgReport(true); hgSavePos(); hg.exitInterior?.(); hg.onShop(null); hg.onStation(null); const from = hgRegion; hgKeepNow(); hg.leave(); hgUse(G.id); toast(`${G.label}(으)로 걸어가요…`, 2200);
  await startHangang(null); const back = (hg.gates || []).find((q) => q.id === from); if (back) hg.teleport(back.end === 0 ? 14 : hg.L - 14, 0);
}
hg.onRegionGate = (G) => hgGoRegion(G);
hg.onFly = (on) => toast(on === 'fall' ? '🍂 날기를 멈췄어요' : on ? '🕊️ 날기! Space 꾹 = 위로 · S = 아래로 · Space 두 번 빠르게 = 떨어지기' : '🐾 내려앉았어요', on === true ? 2600 : 1200);
hg.onTurn = (txt) => toast(`🚧 ${txt}이에요 · 돌아서 달려요`, 2200);
// 역 안: 실제 도착 정보를 계속 받아 안내판에 (hg.arrivals)
hg.onInside = (st) => hg.onStation(st ? { name: st.name } : null);
// 가게: 들어가면 인사, 계산대 앞에서 메뉴 (숫자 키 1 ~ 5 = 먹고 가기, Shift + 숫자 = 포장)
const hgEsc = (t) => String(t || '').replace(/[<>&"]/g, '');
let hgShop = null;
hg.onShopEnter = (s) => { if (s) toast(`🔔 어서 오세요! ${hgEsc(s.name)}`, 2000); };
hg.onShop = (s) => {
  hgShop = s; const el = $('hg-shop'); if (!s) { el.classList.add('hidden'); return; }
  if (document.pointerLockElement) document.exitPointerLock?.();
  el.innerHTML = `<h4>${s.emoji} ${hgEsc(s.name)} <small>${s.label}</small></h4><div class="menu">${s.menu.map(([n, p, e], i) => `<button data-i="${i}"><span>${e} ${n}</span><b>${p.toLocaleString()}원</b><i>${i + 1}</i></button>`).join('')}</div><div class="mode"><label><input type="radio" name="hgm" value="here" checked> 🍽️ 먹고 가기</label><label><input type="radio" name="hgm" value="togo"> 🛍️ 포장</label></div>`;
  el.classList.remove('hidden'); el.querySelectorAll('button').forEach((b) => { b.onclick = () => hg.shopOrder(+b.dataset.i, el.querySelector('input[name=hgm]:checked').value); });
};
addEventListener('keydown', (e) => { if (!hgShop || !/^Digit[1-9]$/.test(e.code)) return; const i = +e.code.slice(5) - 1; if (i < hgShop.menu.length) hg.shopOrder(i, e.shiftKey ? 'togo' : 'here'); });
hg.onEat = ({ item, mode }) => { if (mode === 'here') toast(`${item[2]} ${item[0]} 나왔어요 · 맛있게 먹는 중…`, 3000); else if (mode === 'done') toast(`😋 ${item[0]} 잘 먹었어요!`, 2400); else toast(`🛍️ ${item[0]} 포장했어요 · 들고 산책해요`, 2600); };
const HG_OPT_KEY = 'dreamrunner.hangang';
try { Object.assign(hg.opt, JSON.parse(store.get(HG_OPT_KEY) || '{}')); } catch { /* 기본 */ }
const hgSave = () => store.set(HG_OPT_KEY, JSON.stringify(hg.opt));
const hgRun = { tk: null, sent: 0, sendT: 0 };
let hgPost = null; // 화면 보정 (블룸 · 색감) · 컴퓨터에서만
addEventListener('resize', () => hgPost?.setSize(innerWidth, innerHeight));
// 입장: 이어 달리기 · 서강대교에서 · 지도에서 고르기
const HG_POS_KEY = 'dreamrunner.hangang.pos';
// 저장 위치: 지역마다 따로 + 마지막으로 있던 지역 ({ last, regions: { id: { s, lat, where } } }) · 예전 한 칸짜리 저장도 읽는다
function hgPosAll() { try { const v = JSON.parse(store.get(HG_POS_KEY) || 'null'); if (!v) return { last: null, regions: {} }; if (v.regions) return v; const id = v.region || 'yeouido'; return { last: id, regions: { [id]: { s: v.s, lat: v.lat, where: v.where } } }; } catch { return { last: null, regions: {} }; } }
function hgSavedPos(id = hgRegion) { return hgPosAll().regions[id] || null; }
function hgLastPos() { const a = hgPosAll(); return a.last && a.regions[a.last] ? { region: a.last, ...a.regions[a.last] } : null; }
// 지도 파일이 있는 지역만 보여 준다 (지도를 아직 안 만든 지역 단추가 먼저 배포돼도 깨지지 않게)
const hgHave = {}; async function hgCheckRegions() { await Promise.all(Object.keys(HG_REGIONS).filter((id) => hgHave[id] === undefined).map(async (id) => { try { hgHave[id] = (await fetch(`hangang/${id}.json`, { method: 'HEAD' })).ok; } catch { hgHave[id] = false; } })); hgRegionUI(); }
// 지역 고르기: 지역을 누르면 위 '이어 달리기'는 그 지역에서 마지막으로 있던 곳, 맨 끝 '▶ 이어 달리기'는 서울 전체에서 마지막으로 있던 곳
function hgResumeUI() { const p = hgSavedPos(); $('hg-resume').classList.toggle('hidden', !p); if (p) $('hg-resume-sub').textContent = p.where || ''; }
function hgRegionUI() {
  const last = hgLastPos();
  $('hg-regions').innerHTML = Object.entries(HG_REGIONS).filter(([id]) => hgHave[id] !== false).map(([id, r]) => `<button data-r="${id}" class="${id === hgRegion ? 'on' : ''}">${r.label}</button>`).join('') + (last ? `<button data-last="1" class="last">▶ 이어 달리기 · 서울 전체 마지막 위치 <small>${String(last.where || '').replace(/[<>&]/g, '')}</small></button>` : '');
  $('hg-regions').querySelectorAll('button[data-r]').forEach((b) => { b.onclick = () => { hgUse(b.dataset.r); hgRegionUI(); }; });
  const lb = $('hg-regions').querySelector('button[data-last]'); if (lb) lb.onclick = () => { const p = hgLastPos(); if (!p) return; $('hg-start').classList.add('hidden'); hgUse(p.region); startHangang(p); };
  $('hg-from-start').textContent = HG_REGIONS[hgRegion].start; hgResumeUI();
}
$('hg-btn').onclick = () => { unlock(); hgRegionUI(); hgCheckRegions(); hgAcctUI(); hgCloudLoad().then(() => { hgRegionUI(); hgAcctUI(); }); hgCheckWorld().then((w) => { if (w) hgUse(hgRegion); }); $('hg-start').classList.remove('hidden'); };
$('hg-start-x').onclick = () => $('hg-start').classList.add('hidden');
$('hg-resume').onclick = () => { $('hg-start').classList.add('hidden'); const p = hgSavedPos(); startHangang(p); };
$('hg-from-start').onclick = () => { $('hg-start').classList.add('hidden'); startHangang(hgWorld ? null : { s: 30, lat: -4.3 }); };
$('hg-pick').onclick = async () => { $('hg-start').classList.add('hidden'); try { if (await hgCheckWorld()) hgUse(hgRegion); await hg.load(hgWorld ? 'seoul' : hgRegion); } catch (e) { toast(e.message); return; } hgOpenMap(true); };
let hgPick = null, hgMapStart = false, hgMapMode = 'seoul', hgSeoul = null, hgMapT = null;
// 큰 지도: 기본은 서울 전체(지역 · 구 · 준비 중인 구), '이 지역 자세히'로 지금 지역 지도
async function hgLoadSeoul() { if (!hgSeoul) { const { SeoulMap } = await import('./seoul-map.js'); const d = await (await fetch('hangang/seoul.json')).json(); hgSeoul = new SeoulMap(d, Object.fromEntries(Object.entries(HG_REGIONS).map(([k, v]) => [k, v.label]))); } hgSeoul.allOpen = hgWorld; hgSeoul.places = hgMapPlaces(); return hgSeoul; }
// 큰 지도에 그릴 것: 첫 화면 동네 28곳(지역 코스 가운데 · 구 대표 자리) + 체험 명소 (도장 받은 곳은 빨간 테)
function hgMapPlaces() {
  const out = [], st = (() => { try { return { ...JSON.parse(store.get('dreamrunner.hangang.stamps') || '{}'), ...(hg.attr?.stamps || {}) }; } catch { return hg.attr?.stamps || {}; } })();
  for (const R of hgSeoul.regions) { if (!HG_REGIONS[R.id]) continue; const k = Math.floor(R.pts.length / 2), [x, z] = R.pts[k], [ic, ...nm] = HG_REGIONS[R.id].label.split(' '); out.push({ kind: 'hood', region: R.id, name: nm.join(' '), icon: ic, x, z, s: R.acc[k], go: [x, z, 0] }); }
  for (const [name, icon, x, z] of HOOD_SPOTS) out.push({ kind: 'hood', name, icon, x, z, go: [x, z, 0] });
  for (const p of mapPlaces()) out.push({ ...p, done: !!st[p.id] });
  return out;
}
function hgMapTitle() { $('hg-map-title').innerHTML = hgMapMode === 'seoul' ? (hgWorld ? '🗺️ 서울 전체 <small>어디든 누르면 그곳으로 가요 · 아이콘 = 동네 · 체험 명소 · 휠 · 두 손가락으로 확대, 끌어서 옮기기</small>' : '🗺️ 서울 전체 <small>색 있는 선 = 걸을 수 있는 지역 · 회색 = 준비 중 · 가고 싶은 곳을 누르세요</small>') : `🗺️ ${hg.map?.name || ''} <small>가고 싶은 곳을 누르세요 (빨간 선이 코스)</small>`; $('hg-map-mode').textContent = hgMapMode === 'seoul' ? '🔍 이 지역 자세히' : '🗺️ 서울 전체'; $('hg-map-mode').classList.toggle('hidden', !hg.ready || hgWorld); }
async function hgOpenMap(start = false) { hgMapStart = start; hgPick = null; hgMapMode = 'seoul'; $('hg-go').disabled = true; $('hg-go').textContent = start ? '🏃 여기서 시작' : '📍 새 위치로 이동'; $('hg-map').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock?.(); try { await hgLoadSeoul(); } catch { hgMapMode = 'detail'; } hgMapTitle(); hgDrawMap(); clearInterval(hgMapT); hgMapT = setInterval(() => { if ($('hg-map').classList.contains('hidden')) { clearInterval(hgMapT); return; } if (hgMapMode === 'seoul') hgDrawMap(); }, 120); }
function hgHere() { return hg.ready && game.mode === 'hangang' && hg.px != null ? { x: hg.map.center[0] + hg.px, z: hg.map.center[1] + hg.pz } : null; }
function hgDrawMap() { const c = $('hg-map-c'); if (hgMapMode === 'seoul' && hgSeoul) { hg.live?.mapOpen(); hgSeoul.draw(c.getContext('2d'), c.width, c.height, { here: hgHere(), pick: hgPick?.seoul ? hgPick : null, t: performance.now() / 1000, dots: hg.live?.mapDots() || [] }); } else hg.drawBigMap(c.getContext('2d'), c.width, hgPick?.seoul ? null : hgPick); }
$('hg-map-mode').onclick = () => { hgMapMode = hgMapMode === 'seoul' ? 'detail' : 'seoul'; hgPick = null; $('hg-go').disabled = true; hgMapTitle(); hgDrawMap(); };
// 큰 지도: 휠 · 두 손가락으로 확대, 끌어서 옮기기, 짧게 누르면 고르기 (동네 · 명소 아이콘을 누르면 그곳)
const hgMapPtr = new Map(); let hgMapDrag = null;
const hgMapUV = (e) => { const r = $('hg-map-c').getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
$('hg-map-c').addEventListener('wheel', (e) => { if (hgMapMode !== 'seoul' || !hgSeoul) return; e.preventDefault(); const [u, v] = hgMapUV(e); hgSeoul.zoomAt(u, v, e.deltaY < 0 ? 1.25 : 0.8); hgDrawMap(); }, { passive: false });
$('hg-map-c').addEventListener('pointerdown', (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); hgMapPtr.set(e.pointerId, hgMapUV(e)); hgMapDrag = { uv: hgMapUV(e), moved: false, pinch: hgMapPtr.size > 1 ? null : undefined }; });
$('hg-map-c').addEventListener('pointermove', (e) => { if (!hgMapPtr.has(e.pointerId) || !hgSeoul || hgMapMode !== 'seoul') return; const prev = hgMapPtr.get(e.pointerId), uv = hgMapUV(e); hgMapPtr.set(e.pointerId, uv);
  if (hgMapPtr.size === 2) { const [a, b] = [...hgMapPtr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (hgMapDrag) { if (hgMapDrag.pd) hgSeoul.zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / hgMapDrag.pd); hgMapDrag.pd = d; hgMapDrag.moved = true; } hgDrawMap(); return; }
  if (hgMapDrag && (hgMapDrag.moved || Math.hypot(uv[0] - hgMapDrag.uv[0], uv[1] - hgMapDrag.uv[1]) > 0.012)) { hgMapDrag.moved = true; hgSeoul.pan(uv[0] - prev[0], uv[1] - prev[1]); hgDrawMap(); } });
for (const ev of ['pointerup', 'pointercancel']) $('hg-map-c').addEventListener(ev, (e) => { const had = hgMapPtr.delete(e.pointerId); if (!had || ev === 'pointercancel' || !hgMapDrag || hgMapDrag.moved) { if (!hgMapPtr.size) hgMapDrag = null; return; } hgMapDrag = null; const [u, v] = hgMapUV(e);
  if (hgMapMode === 'seoul' && hgSeoul) { const p = hgSeoul.pickAt(u, v); hgPick = { seoul: true, ...p }; const ok = hgWorld ? hgTileAt(p.x, p.z) : !!p.region; $('hg-go').disabled = !ok; $('hg-go').textContent = !ok ? `🚧 ${p.gu || '이곳'}은 준비 중이에요` : p.place ? `${p.place.icon || '📍'} ${p.name}(으)로` : p.region ? `📍 ${p.name}(으)로` : `📍 ${p.gu || '이곳'}(으)로`; }
  else { hgPick = hg.pickAt(u, v); $('hg-go').disabled = false; $('hg-go').textContent = hgMapStart ? '🏃 여기서 시작' : '📍 새 위치로 이동'; }
  hgDrawMap(); });
// 다른 지역으로 옮기기 (지금 지역은 저장하고 정리)
async function hgSwitchRegion(id, pos) { if (game.mode === 'hangang') { hgReport(true); hgSavePos(); hg.exitInterior?.(); hg.onShop(null); hg.onStation(null); hgKeepNow(); hg.leave(); } hgUse(id); await startHangang(pos); }
$('hg-go').onclick = () => { if (!hgPick) return; $('hg-map').classList.add('hidden'); clearInterval(hgMapT);
  if (hgPick.seoul && hgWorld) { const P = hgPick, nm = P.place || P.region ? P.name : P.gu || '이곳'; if (game.mode === 'hangang') { hg.exitInterior?.(); hg.placeAt(P.x, P.z, P.face ?? hg.face); toast(`📍 ${nm} · 새 위치로 왔어요`, 1600); } else { toast(`${nm}(으)로 가요…`, 2000); if (P.region) hgUse(P.region); startHangang({ x: P.x, z: P.z }); } return; }
  if (hgPick.seoul) { if (!hgPick.region) return; const pos = { s: hgPick.s, lat: 0 }; if (game.mode === 'hangang' && hgPick.region === hgRegion) { hg.teleport(pos.s, pos.lat); toast(`📍 ${hgPick.name} · 새 위치로 왔어요`, 1600); } else { toast(`${hgPick.name}(으)로 가요…`, 2000); hgSwitchRegion(hgPick.region, pos); } return; }
  if (hgMapStart || game.mode !== 'hangang') startHangang({ s: hgPick.s, lat: hgPick.lat }); else { hg.teleport(hgPick.s, hgPick.lat); toast('📍 새 위치로 왔어요', 1400); } };
$('hg-map-x').onclick = () => $('hg-map').classList.add('hidden');
// 큰 지도 창 (8-25): 미니맵 · 🗺️ 단추 · M 키. 창 안 📍 단추 = 다른 곳으로 가기(예전 지도 고르기)
const hgMapWin = setupMapWin({ getHg: () => hg, openPicker: () => hgOpenMap(false) });
$('hg-mini').onclick = () => { if (game.mode === 'hangang') hgMapWin.toggle(); };
$('hg-map-btn').onclick = () => hgMapWin.toggle();
async function startHangang(pos = null) {
  const b = $('hg-btn'); b.disabled = true;
  await hgCheckWorld(); if (hgWorld && hg !== hgInst.seoul) hgUse(hgRegion);
  try { if (!hg.ready) toast(hgWorld ? '🗺️ 서울을 펼치는 중…' : `${HG_REGIONS[hgRegion].label} 지도를 펼치는 중…`, 4000); await hg.load(hgWorld ? 'seoul' : hgRegion); }
  catch (e) { toast(`한강 지도를 불러오지 못했어요 · ${e.message}`, 2600); b.disabled = false; return; }
  b.disabled = false;
  // 서울 전체: 시작 자리를 들어가기 전에 정한다 (예전엔 들어간 뒤 기다리는 사이 기본 자리(남산 근처) 칸부터 만들어 시작이 칸 하나만큼 늦었다)
  const startP = hgWorld ? (pos?.x != null ? pos : await hgRegionStart(hgRegion)) : null;
  // 러너 테마(흑백 영화 등)의 화면 필터가 서울 산책에 남지 않게
  renderer.domElement.style.filter = '';
  hideScreens(); game.mode = 'hangang'; document.body.classList.add('hg');
  if (!hgWorld && pos && pos.s == null) pos = null; // 서울 전체에서 저장한 자리(x, z)는 지역 지도에선 못 쓴다
  runner.shadow.visible = false; hg.enter(runner.bear, { ...(pos?.s != null && !hgWorld ? { s: pos.s } : {}), keep: hgKeep });
  if (hgWorld) hg.placeAt(startP.x, startP.z, startP.face ?? 0); else if (pos) hg.teleport(pos.s, pos.lat);
  renderer.shadowMap.enabled = !isPhone; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  if (hgPost && hgPost.scene !== hg.scene) { hgPost.dispose(); hgPost = null; } // 지역이 바뀌면 그 지역 장면으로 다시
  if (!isPhone && !hgPost) { try { const { makePost } = await import('./hangang-post.js'); hgPost = makePost(renderer, hg.scene, camera); hgPost.scene = hg.scene; } catch (e) { console.warn('화면 보정 없이', e); } }
  $('hg-hud').classList.remove('hidden'); if (document.body.classList.contains('touch')) $('touch').classList.remove('hidden');
  $('t-shove').textContent = '💨';
  setMusic(['pent', 62, 66, 'sine']); hgRun.tk = null; hgRun.sent = 0; hgRun.sendT = 20;
  account.api('/api/dream/hangang/start', { method: 'POST', body: logged() ? {} : { anon: anonId() } }).then((r) => { hgRun.tk = r.tk; }).catch(() => {});
  hgStampsLoad();
  toast(`🌉 ${hg.map.name} · ${SEASONS[hg.state.season]} · ${WEATHERS[hg.state.weather]}`, 2600);
}
// 서울 명소 도장 (hangang-attractions.js): 체험 시작 · 끝을 서버에 알리고, 계정(또는 이 기기 아이디)의 도장을 받아 합친다
function hgStampsLoad() { account.api(`/api/dream/hangang/stamps${logged() ? '' : `?anon=${anonId()}`}`).then((r) => { if (r?.stamps) { hg.cloudStamps = r.stamps; hg.attr?.mergeStamps(r.stamps); } }).catch(() => {}); }
function hgStampSend(id, phase, tries = 0) {
  if (!hgRun.tk) { if (tries < 10) setTimeout(() => hgStampSend(id, phase, tries + 1), 1500); return; }
  account.api('/api/dream/hangang/stamp', { method: 'POST', body: { tk: hgRun.tk, id, phase, ...(logged() ? {} : { anon: anonId() }) } }).then((r) => { if (r?.stamps) hg.attr?.mergeStamps(r.stamps); if (r?.fresh?.length && !document.body.classList.contains('solo')) setTimeout(notifyNew, 300); }).catch(() => {});
}
hg.onStamp = (id, phase) => hgStampSend(id, phase);
hg.onToast = (t) => toast(t, 2200);
function hgReport(final = false) {
  if (!hgRun.tk || hg.dist - hgRun.sent < (final ? 30 : 100)) return;
  hgRun.sent = hg.dist;
  const body = { tk: hgRun.tk, m: Math.floor(hg.dist), sec: Math.floor(hg.time), mo: Object.fromEntries(Object.entries(hg.moments).map(([k, v]) => [k, Math.floor(v)])), ...(logged() ? {} : { anon: anonId() }) };
  account.api('/api/dream/hangang/run', { method: 'POST', body }).then((r) => { if (r?.fresh?.length && !document.body.classList.contains('solo')) setTimeout(notifyNew, 300); }).catch(() => {});
}
function leaveHangang() {
  hgMapWin?.toggle(false);
  hgReport(true); if (document.pointerLockElement) document.exitPointerLock?.(); $('hg-labels').innerHTML = ''; hg.onStation(null); hg.exitInterior?.(); hg.onShop(null);
  hgKeepNow(); hg.leave(); document.body.classList.remove('hg'); $('t-shove').textContent = '🫸';
  $('hg-hud').classList.add('hidden'); $('hg-set').classList.add('hidden');
  camera.far = 1600; camera.fov = 62; camera.updateProjectionMatrix();
  renderer.shadowMap.enabled = false; renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
  hgSavePos(); if (window.SW_PLAY) { setTimeout(() => { location.href = '/seoul-walk/'; }, 400); } else if (window.SEOUL_WALK) setTimeout(() => $('hg-btn').onclick(), 300);
  runner.shadow.visible = true; scene.add(runner.bear.root);
  if (hg.dist > 50) toast(`🌉 ${(hg.dist / 1000).toFixed(2)}km · ${hgTime(hg.time)} 달렸어요. 수고했어요!`, 3000);
  toTitle();
}
$('hg-exit').onclick = leaveHangang;
// 설정 창: 젤리 게임즈 메인으로 (지금 자리를 저장하고 간다)
$('hg-home').onclick = () => { hgReport(true); hgSavePos(); window.onbeforeunload = null; location.href = '/'; };
const hgTime = (sec) => { const m = Math.floor(sec / 60), h = Math.floor(m / 60); return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`; };
const hgSpeedIdx = () => { let best = 0; SPEEDS.forEach(([, v], i) => { if (Math.abs(v - hg.target) < Math.abs(SPEEDS[best][1] - hg.target)) best = i; }); return best; };
const hgStep = (d) => { const i = Math.max(0, Math.min(SPEEDS.length - 1, hgSpeedIdx() + d)); hg.target = SPEEDS[i][1]; };
$('hg-slow').onclick = () => hgStep(-1); $('hg-fast').onclick = () => hgStep(1);
const CAMS = ['🎥 뒤에서', '🌊 강 쪽 옆에서', '🚁 높이서'];
$('hg-cam').onclick = () => { hg.opt.cam = ((hg.opt.cam || 0) + 1) % 3; hgSave(); toast(CAMS[hg.opt.cam], 1200); };
addEventListener('keydown', (e) => {
  if (game.mode !== 'hangang' || isTyping()) return;
  // 운전 중: V 시점 · H 경적 · Z X 깜빡이 · L 전조등 (hangang-drive.js)
  if (hg.drive?.on && ['KeyV', 'KeyH', 'KeyZ', 'KeyX', 'KeyL'].includes(e.code)) { if (!e.repeat) hg.drive.key(e.code); return; }
  if (e.code === 'KeyV') $('hg-cam').onclick();
  if (e.code === 'Escape' && !$('hg-set').classList.contains('hidden')) $('hg-set').classList.add('hidden'); // Esc 로는 나가지 않는다: 나가기는 오른쪽 위 ✕ 로만
  if (e.code === 'KeyB' && !e.repeat) hg.rideL?.bell(); // 버스 하차벨
  if (e.code === 'KeyE' && !e.repeat && !hg.drive?.act() && !hg.rideL?.act() && !hg.attr?.act()) hgStep(1); // 명소 가까이 · 체험 중이면 E = 체험하기
  if (e.code === 'KeyQ' && !e.repeat) hgStep(-1);
});
// 설정: 계절 · 날씨 · 시간 · 시간 흐름 · 시점 · 소리
function hgSeg(id, items, get, set) {
  const el = $(id); el.innerHTML = '';
  for (const [v, label] of items) { const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', get() === v); b.onclick = () => { set(v); hgSave(); hgSettings(); }; el.appendChild(b); }
}
function hgSettings() {
  hgSeg('hg-season', [['auto', '🎲 무작위'], ...Object.entries(SEASONS)], () => hg.opt.season, (v) => { hg.setOpt('season', v); if (v === 'auto') { hg.state.season = Object.keys(SEASONS)[Math.floor(Math.random() * 4)]; hg.applySeason(); } });
  hgSeg('hg-weather', [['auto', '🎲 바뀌어요'], ...Object.entries(WEATHERS)], () => hg.opt.weather, (v) => hg.setOpt('weather', v));
  hgSeg('hg-time', [['auto', '🕐 흐르는 대로'], ...Object.entries(TIMES).map(([k, [n]]) => [k, n])], () => hg.opt.time, (v) => hg.setOpt('time', v));
  hgSeg('hg-flow', [[0, '⏸️ 멈춤'], [1, '🐢 1분 = 1시간'], [4, '🐇 4배']], () => hg.opt.flow, (v) => { hg.opt.flow = v; });
  hgSeg('hg-camseg', CAMS.map((n, i) => [i, n]), () => hg.opt.cam || 0, (v) => { hg.opt.cam = v; });
  // 미니맵: 북쪽 위 고정(기본, 화살표만 돈다) · 보는 쪽이 위로 돌기
  hgSeg('hg-miniseg', [[false, '🧭 북쪽 위 고정'], [true, '🔄 보는 쪽으로 회전']], () => !!hg.opt.miniRot, (v) => { hg.opt.miniRot = v; });
  hgSeg('hg-sound', [[false, '🔊 게임 소리'], [true, '🔇 끄기 (내 음악 듣기)']], () => sound.muted, (v) => { if (sound.muted !== v) { toggleMute(); syncSound(); } });
}
$('hg-set-btn').onclick = () => { hgSettings(); $('hg-set').classList.remove('hidden'); };
$('hg-set-close').onclick = () => $('hg-set').classList.add('hidden');
function hgFrame(dt) {
  const L = keys.has('KeyA') || keys.has('ArrowLeft'), R = keys.has('KeyD') || keys.has('ArrowRight');
  const U = keys.has('KeyW') || keys.has('ArrowUp'), D = keys.has('KeyS') || keys.has('ArrowDown');
  const look = hgLook; hgLook = { yaw: 0, pitch: 0 };
  const inp = { mx: (R ? 1 : 0) - (L ? 1 : 0) + joyX, mz: (U ? 1 : 0) - (D ? 1 : 0) + joyY, yaw: look.yaw, pitch: look.pitch, jump: input.jump, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || touchHeld.has('shove'), slide: keys.has('KeyC') || keys.has('ControlLeft') || touchHeld.has('slide'), jumpHeld: keys.has('Space') || touchHeld.has('jump') };
  if (!$('hg-set').classList.contains('hidden')) { inp.mx = inp.mz = 0; inp.jump = false; }
  hg.update(dt, inp, camera);
  hgMapWin.tick(dt);
  input.jump = input.slide = input.shove = input.item = false;
  if (hgPost) { hgPost.mood(hg.light); hgPost.render(); } else renderer.render(hg.scene, camera);
  if (hg.activeLabels?.length || $('hg-labels').childElementCount) hgLabels();
  // 화면 글씨는 0.2초마다
  game.hgT = (game.hgT || 0) + dt; if (game.hgT < 0.2) return; game.hgT = 0;
  const km = hg.dist / 1000, pace = hg.v > 0.3 ? 1000 / hg.v : 0;
  $('hg-dist').textContent = km.toFixed(2);
  $('hg-sub').textContent = `${hgTime(hg.time)} · ${pace ? `${Math.floor(pace / 60)}'${String(Math.floor(pace % 60)).padStart(2, '0')}"` : `--'--"`}/km · ${(hg.v * 3.6).toFixed(1)}km/h`;
  $('hg-where').textContent = `📍 ${hg.where()}`;
  const mini = $('hg-mini'); hg.drawMinimap(mini.getContext('2d'), mini.width);
  const h = hg.state.hour, icon = h >= 5.3 && h < 6.9 ? '🌅' : h >= 17.9 && h < 19.4 ? '🌇' : h >= 20 || h < 5.3 ? '🌙' : '☀️';
  $('hg-clock').textContent = `${icon} ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  $('hg-season-c').textContent = SEASONS[hg.state.season]; $('hg-weather-c').textContent = WEATHERS[hg.state.weather];
  $('hg-pace-name').textContent = hg.boosting ? '💨 가속 중!' : SPEEDS[hgSpeedIdx()][0];
  $('hg-bar').style.width = `${Math.round(((hg.v - V_MIN) / (V_MAX - V_MIN)) * 100)}%`;
  hgRun.sendT -= 0.2; if (hgRun.sendT <= 0) { hgRun.sendT = 20; hgReport(); hgSavePos(); }
}
// 탭을 닫거나 숨길 때도 지금 자리를 기억한다 (20초마다만 저장해서, 그 사이에 닫으면 걸은 만큼 처음 자리로 돌아갔다)
addEventListener('pagehide', () => { if (game.mode === 'hangang') { hgReport(true); hgSavePos(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'hangang') { hgReport(true); hgSavePos(); } });
// 바로 가기: /dream-runner/#hangang 으로 들어오면 한강 러닝부터
// 젤리 서울 러너 랜딩 배경: 게임 속에서 찍은 랜드마크 장면이 한 장씩 천천히 다가오며 바뀐다 (7초마다)
const SW_SCENES = [['63', '63빌딩', '여의도 · 해 질 녘'], ['tower', 'N서울타워', '남산 · 밤'], ['namsanview', '남산에서 본 서울', '진짜 지형 · 해 질 녘'], ['lotte', '롯데월드타워', '잠실 · 노을'], ['hongdae', '홍대 거리', '마포 · 여름밤'], ['gangnam', '강남역 거리', '강남 · 겨울밤'], ['hangang', '한강의 밤', '여의도 · 여름']];
function swSlides() {
  const bg = $('sw-bg'); if (!bg || bg.dataset.on) return; bg.dataset.on = '1';
  const sl = SW_SCENES.map(([f]) => { const d = document.createElement('div'); d.className = 'sl'; d.dataset.src = `sw/${f}.webp`; bg.insertBefore(d, bg.firstChild); return d; });
  $('sw-dots').innerHTML = SW_SCENES.map(() => '<i></i>').join(''); const dots = [...$('sw-dots').children];
  let k = -1; const load = (i) => { const d = sl[i]; if (!d.style.backgroundImage) d.style.backgroundImage = `url(${d.dataset.src})`; };
  const show = () => { if (k >= 0) { sl[k].classList.remove('on'); dots[k].classList.remove('on'); } k = (k + 1) % sl.length; load(k); load((k + 1) % sl.length); void sl[k].offsetWidth; sl[k].classList.add('on'); dots[k].classList.add('on'); $('sw-cap-n').textContent = SW_SCENES[k][1]; $('sw-cap-s').textContent = SW_SCENES[k][2]; };
  show(); setInterval(() => { if (!document.hidden && !$('hg-start').classList.contains('hidden')) show(); }, 7000);
}
// 젤리 서울 러너(/seoul-walk/): 러너 타이틀 없이 바로 서울 산책 시작 화면. 닫기 = 메인으로, 산책을 마치면 다시 시작 화면
// 따로 된 랜딩 페이지 등에서 바로 온 사람: 젤리게임즈와 상관없이 (닫기 · 메인으로 단추 없음). 젤리게임즈 메인 카드로 온 사람(?from=hub): 메인으로 돌아가는 단추
// 서울 산책 게임(/seoul-walk/play/): 랜딩에서 고른 곳에서 바로 시작 (r = 동네, go = start · resume · last, x · z = 지도에서 고른 자리), 나가면 랜딩으로
// 젤리 서울 러너 이용 지표 (익명, 서울 러너 화면에서만 불러온다)
if (window.SW_PLAY || window.SEOUL_WALK) import('/seoul-walk/metrics.js').then((m) => m.trackGame(() => hg, game, window.SW_PLAY ? 'landing' : 'platform')).catch(() => {});
if (window.SW_PLAY) { document.body.classList.add('sw', 'solo', 'swplay'); const q = new URLSearchParams(location.search);
  // 첫 칸이 다 만들어질 때까지 덮개 (빈 땅이 보이지 않게, 늦어도 25초 뒤엔 걷힌다)
  hg.onChunk = () => document.body.classList.add('swready'); setTimeout(() => document.body.classList.add('swready'), 25000);
  setTimeout(async () => { if (game.mode !== 'title') return; const r = HG_REGIONS[q.get('r')] ? q.get('r') : 'yeouido'; let pos = null;
    if (q.get('go') === 'last') { const p = hgLastPos(); hgUse(p ? p.region : r); pos = p; } else { hgUse(r); if (q.get('go') === 'resume') pos = hgSavedPos(r); }
    if (q.has('x') && q.has('z')) pos = { x: +q.get('x'), z: +q.get('z'), face: +(q.get('f') || 0) };
    await startHangang(pos); if (game.mode !== 'hangang') location.href = '/seoul-walk/'; }, 300); }
else if (window.SEOUL_WALK) { document.body.classList.add('sw'); $('hg-how').open = true; swSlides(); const fromHub = new URLSearchParams(location.search).get('from') === 'hub' || /^\/(\?|$)/.test((() => { try { const r = new URL(document.referrer); return r.origin === location.origin ? r.pathname + r.search : 'x'; } catch { return 'x'; } })()); if (fromHub) { $('hg-start-x').textContent = '🏠 젤리게임즈로'; $('hg-start-x').onclick = () => { location.href = '/'; }; } else { $('hg-start-x').classList.add('hidden'); document.body.classList.add('solo'); document.querySelectorAll('a[href]').forEach((a) => { if (!/^\/seoul-walk/.test(a.getAttribute('href'))) a.remove(); }); } if (location.hash !== '#hangang') setTimeout(() => { if (game.mode === 'title') $('hg-btn').onclick(); }, 300); }
if (location.hash === '#hangang') setTimeout(() => { if (game.mode === 'title') { const p = hgLastPos(); if (p) hgUse(p.region); startHangang(p); } }, 700);

// 한강: 마우스로 시점 (화면을 누르면 마우스가 잠기고, Esc 로 풀린다) · 휴대폰은 화면을 끌어서
let hgLook = { yaw: 0, pitch: 0 }, hgDrag = null;
const cv = $('c');
cv.addEventListener('mousedown', (e) => { if (game.mode === 'hangang' && e.button === 0 && $('hg-set').classList.contains('hidden')) cv.requestPointerLock?.()?.catch?.(() => {}); });
document.addEventListener('mousemove', (e) => { if (game.mode !== 'hangang' || document.pointerLockElement !== cv) return; hgLook.yaw -= (e.movementX || 0) * 0.0026; hgLook.pitch += (e.movementY || 0) * 0.002; });
cv.addEventListener('pointerdown', (e) => { if (game.mode === 'hangang' && e.pointerType !== 'mouse') hgDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointermove', (e) => { if (!hgDrag || e.pointerId !== hgDrag.id) return; hgLook.yaw -= (e.clientX - hgDrag.x) * 0.006; hgLook.pitch += (e.clientY - hgDrag.y) * 0.004; hgDrag.x = e.clientX; hgDrag.y = e.clientY; });
for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, (e) => { if (hgDrag?.id === e.pointerId) hgDrag = null; });
// 위쪽 칩: 누를 때마다 시간 · 계절 · 날씨가 바뀐다
const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length];
$('hg-clock').onclick = () => { const k = cycle(Object.keys(TIMES), hg.lastTime || 'day'); hg.lastTime = k; hg.setOpt('time', k); hg.opt.time = 'auto'; hgSave(); toast(TIMES[k][0], 1200); };
$('hg-season-c').onclick = () => { const k = cycle(Object.keys(SEASONS), hg.state.season); hg.setOpt('season', k); hgSave(); };
$('hg-weather-c').onclick = () => { const k = cycle(Object.keys(WEATHERS), hg.state.weather); hg.setOpt('weather', k); hgSave(); };
// 지역 이름: 화면 가운데 위에 3초
hg.onRegion = (name) => { const el = $('hg-region'); el.textContent = /공원|광장|마당/.test(name) ? `🌳 ${name}` : /대교|철교/.test(name) ? `🌉 ${name}` : /섬/.test(name) ? `🏝️ ${name}` : `📍 ${name}`; el.classList.remove('hidden'); clearTimeout(el.h); el.h = setTimeout(() => el.classList.add('hidden'), 3000); };
// 건물 이름표: 건물에 빨간 동그라미 → 선 → 이름 (5초 뒤 사라짐)
const labV = new THREE.Vector3();
function hgLabels() {
  const box = $('hg-labels'), W = innerWidth, H = innerHeight, list = hg.activeLabels || [];
  box.innerHTML = '';
  for (const l of list) {
    labV.set(l.x, l.y, l.z).project(camera); if (labV.z > 1) continue;
    const x = (labV.x * 0.5 + 0.5) * W, y = (-labV.y * 0.5 + 0.5) * H; if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
    const a = Math.min(l.t / 0.4, Math.min(1, (l.seen ?? 1) / 0.6)), side = x > W * 0.6 ? -1 : 1, lx = 70 * side, ly = -60;
    const el = document.createElement('div'); el.className = 'hg-lab'; el.style.transform = `translate(${x}px, ${y}px)`; el.style.opacity = a;
    el.innerHTML = `<i></i><svg width="1" height="1"><line x1="0" y1="0" x2="${lx}" y2="${ly}" stroke="#ff2d55" stroke-width="2.5"/></svg><b style="left:${side > 0 ? lx : lx - 4}px;top:${ly - 14}px;${side < 0 ? 'transform:translateX(-100%)' : ''}">${l.name.replace(/[<>&]/g, '')}</b>`;
    box.appendChild(el);
  }
}

// 로그인 없이: 위치 · 가 본 칸은 이 기기(localStorage)에. 로그인하면 계정에도 (다른 기기에서 이어서 · 방문 기록 보관), 더 새로운 쪽이 이긴다
const HG_VISIT_KEY = 'dreamrunner.hangang.visit';
function hgVisits() { try { return new Set(JSON.parse(store.get(HG_VISIT_KEY) || '[]')); } catch { return new Set(); } }
function hgMarkVisit() { if (!hg.chunks || !hg.tileNow) return; const V = hgVisits(), k = hg.tileNow.join('_'); if (!V.has(k)) { V.add(k); store.set(HG_VISIT_KEY, JSON.stringify([...V])); } }
function hgCloudMerge(r) {
  if (!r) return; const a = hgPosAll(); let ch = false;
  for (const [id, p] of Object.entries(r.pos?.regions || {})) if (!a.regions[id] || (a.regions[id].at || 0) < (p.at || 0)) { a.regions[id] = p; ch = true; }
  if (r.pos?.last && (r.pos.at || 0) > (a.at || 0)) { a.last = r.pos.last; a.at = r.pos.at; ch = true; } if (ch) store.set(HG_POS_KEY, JSON.stringify(a));
  const V = hgVisits(), n = V.size; for (const k of r.visit || []) V.add(k); if (V.size !== n) store.set(HG_VISIT_KEY, JSON.stringify([...V]));
}
function hgCloudSave() { if (!logged()) return; account.api('/api/dream/hangang/save', { method: 'POST', body: { pos: hgPosAll(), visit: [...hgVisits()] } }).then(hgCloudMerge).catch(() => {}); }
async function hgCloudLoad() { if (!logged()) return; try { hgCloudMerge(await account.api('/api/dream/hangang/me')); } catch { /* 다음에 */ } }
// 시작 화면 계정 줄: 로그인 없이 바로 · 로그인하면 계정에 저장
function hgAcctUI() {
  const el = $('hg-acct'); if (!el) return; const n = hgVisits().size, all = hgWorldIdx?.all?.length || 201, seen = n ? ` · 🗺️ 가 본 서울 ${n}/${all}칸` : '';
  if (logged()) { el.innerHTML = `<span>☁️ <b>${esc(account.user.nick || account.user.name || '')}</b> 계정에 위치 · 방문 기록 저장 중${seen}</span>`; return; }
  el.innerHTML = `<span>💾 로그인 없이 바로 즐겨요 · 위치는 이 기기에 저장돼요${seen}</span><span class="sub">구글로 로그인하면 다른 기기에서도 이어서 걷고, 방문 기록이 계정에 남아요</span><div id="hg-g-btn"></div>`;
  if (game.status?.googleClientId) account.googleButton($('hg-g-btn'), game.status.googleClientId, async () => { renderAccount(); await hgCloudLoad(); hgCloudSave(); hgRegionUI(); hgAcctUI(); toast('☁️ 로그인했어요 · 이제 계정에 저장돼요', 2200); }, (e) => toast(e.message, 2000)).catch(() => {});
}
function hgSavePos() { if (!hg.ready || hg.px == null) return; if (hgWorld && hg.chunks && !hg.chunks.has(`${Math.floor(hg.px / 2000)}_${Math.floor(hg.pz / 2000)}`)) return; // 서울 전체: 곰이 선 칸이 아직 안 만들어졌으면 (불러오는 중 · 처음 자리 0,0) 저장하지 않는다
  const a = hgPosAll();
  // 서울 전체: 서울 좌표로, 가장 가까운 지역 이름 아래에
  if (hgWorld && hg.chunks) { const nr = hg.nearRegion(hg.px, hg.pz), id = nr?.id || hgRegion; a.regions[id] = { x: Math.round(hg.px), z: Math.round(hg.pz), face: Math.round(hg.face * 100) / 100, where: hg.where(), at: Date.now() }; a.last = id; a.at = Date.now(); store.set(HG_POS_KEY, JSON.stringify(a)); hgMarkVisit(); hgCloudSave(); return; } a.regions[hgRegion] = { s: Math.round(hg.s), lat: Math.round(hg.lat * 10) / 10, where: `${HG_REGIONS[hgRegion]?.label || ''} · ${hg.regionName || hg.map.name} 근처 · ${(hg.s / 1000).toFixed(1)}km 지점`, at: Date.now() }; a.at = Date.now(); setTimeout(hgCloudSave, 0); a.last = hgRegion; store.set(HG_POS_KEY, JSON.stringify(a)); }
