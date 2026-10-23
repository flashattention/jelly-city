// 젤리라이더: 꿈나라 트랙을 곰돌이 카트로 달린다 (혼자: AI 5대 · 타임어택 · 같이: 최대 12명, 스피드전/아이템전 · 개인전/팀전)
import * as THREE from 'three';
import { account, store } from '../../shared/js/account.js';
import { Shell, esc, TEAMS } from '../../shared/js/shell.js';
import { Env } from '../../dream-runner/js/env.js';
import { sfx, setMusic, unlock, toggleMute, sound, engine } from '../../dream-runner/js/music.js';
import { TRACKS, Track, LAPS } from './tracks.js';
import { Kart, MAX } from './kart.js';
import { Bot } from './ai.js';
import { ITEMS, RiderItems, randomItem } from './items.js';

const $ = (id) => document.getElementById(id);
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;
const BOT_NAMES = ['딸기봇', '소다봇', '푸딩봇', '망고봇', '민트봇', '라임봇', '자두봇'];
const BOT_COLORS = ['#ff8fb1', '#7cd8ff', '#ffd27a', '#ffb36b', '#9be7a7', '#c39bff', '#ff7a7a'];
const MODE_KEY = 'jellyrider.mode', TRACK_KEY = 'jellyrider.track', ANON_KEY = 'dreamrunner.anon';

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 1800);
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
const env = new Env(scene, renderer); env.centered = true;

const game = window.rider = { Bot,
  mode: 'title', track: null, def: null, karts: [], me: null, bots: [], items: null, multi: false, itemMode: false, team: false,
  countT: 0, raceT: 0, sendT: 0, results: null, pick: { track: store.get(TRACK_KEY) || 'candy', mode: store.get(MODE_KEY) === 'item' ? 'item' : 'speed' },
};

// ---------- 트랙 ----------
function loadTrack(id) {
  const def = TRACKS.find((t) => t.id === id) || TRACKS[0];
  if (game.def === def) return;
  if (game.track) game.track.dispose();
  if (game.items) game.items.dispose();
  game.def = def; game.track = new Track(scene, def);
  env.setTheme(game.track.theme, true);
  setMusic(game.track.theme.mus);
  drawMinimapBase();
}

// ---------- 입력 ----------
const keys = new Set(), touch = new Set();
const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
let usePressed = false;
window.addEventListener('keydown', (e) => {
  if (isTyping()) return;
  unlock();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (['ControlLeft', 'ControlRight', 'Space'].includes(e.code)) usePressed = true;
  if (e.code === 'KeyM') muteBtn();
  if (e.code === 'KeyR' && game.mode === 'race' && game.me && !game.me.done) resetToTrack(game.me);
  if (e.code === 'Space' && game.mode === 'race' && game.multi && game.me?.done) cycleWatch(); // 도착한 뒤: 관전 대상 바꾸기
  if ((e.code === 'ArrowUp' || e.code === 'KeyW') && game.mode === 'count') game.startPress = game.countT;
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
const coarse = matchMedia('(pointer: coarse)').matches;
for (const b of document.querySelectorAll('#touch button')) {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); touch.add(k); if (k === 'use') usePressed = true; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => touch.delete(k));
}
function readInput() {
  const L = keys.has('ArrowLeft') || keys.has('KeyA') || touch.has('left'), R = keys.has('ArrowRight') || keys.has('KeyD') || touch.has('right');
  // 오른쪽 = 핸들 오른쪽. 카트 기준으로는 yaw 를 줄이는 쪽
  return { up: keys.has('ArrowUp') || keys.has('KeyW') || (coarse && !touch.has('brake')), down: keys.has('ArrowDown') || keys.has('KeyS') || touch.has('brake'), dir: (L ? 1 : 0) - (R ? 1 : 0), drift: keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.has('drift'), use: usePressed };
}
function muteBtn() { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; if (sound.muted) engine(0); shell.syncSound(); }
$('b-mute').onclick = muteBtn;
$('b-mute').textContent = sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (game.multi) { shell.send({ t: 'leave' }); shell.room = null; endRace(); shell.afterLeave(); } else toTitle(); };
function resetToTrack(k) { const t = game.track; t.at(k.idx, 0, k.pos); k.yaw = t.heading(k.idx); k.v = 0; k.vl = 0; k.spinT = 0; }

// ---------- 처음 화면 · 방 (공용 틀) ----------
function trackPicker(el, cur, editable, onPick) {
  el.innerHTML = `<div class="track-pick">${TRACKS.map((t) => `<button data-t="${t.id}" class="${t.id === cur ? 'on' : ''}" ${editable ? '' : 'disabled'}><b>${t.emoji}</b>${esc(t.name)}</button>`).join('')}</div>`;
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => onPick(b.dataset.t); });
}
function modeSeg(el, opts, editable, onPick, withTeam) {
  const seg = (k, list) => `<div class="seg">${list.map(([v, l]) => `<button data-${k}="${v}" class="${String(opts[k]) === v ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}</button>`).join('')}</div>`;
  el.insertAdjacentHTML('beforeend', seg('mode', [['speed', '⚡ 스피드전'], ['item', '🎁 아이템전']]) + (withTeam ? ' ' + seg('team', [['false', '🏁 개인전'], ['true', '👥 팀전']]) : ''));
  el.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => onPick({ mode: b.dataset.mode }); });
  el.querySelectorAll('[data-team]').forEach((b) => { b.onclick = () => onPick({ team: b.dataset.team === 'true' }); });
}
const describe = (o = {}) => { const t = TRACKS.find((x) => x.id === o.track); return `${t ? t.emoji + ' ' + t.name : ''} · ${o.mode === 'item' ? '아이템전' : '스피드전'}${o.team ? ' · 팀전' : ''}`; };
function renderTitleOpts() {
  const el = $('title-opts'); el.innerHTML = '';
  trackPicker(el, game.pick.track, true, (id) => { game.pick.track = id; store.set(TRACK_KEY, id); loadTrack(id); renderTitleOpts(); placePreview(); });
  modeSeg(el, game.pick, true, (o) => { Object.assign(game.pick, o); store.set(MODE_KEY, game.pick.mode); renderTitleOpts(); }, false);
}
const shell = new Shell({
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; if (sound.muted) engine(0); } },
  key: 'jellyrider', title: '🏁 젤리라이더', subtitle: '꿈나라 트랙을 곰돌이 카트로 질주!<br>드리프트로 니트로를 모아 역전해요', wsPath: '/rider-ws', max: 12,
  multiLabel: '👥 같이 달리기', roomIcon: '🏁', startLabel: '🏁 다 같이 출발!',
  keysHelp: '↑ 가속 · ↓ 브레이크 · ← → 핸들 · Shift 드리프트(→ 니트로) · Ctrl/Space 니트로·아이템 (↓+아이템: 물폭탄 뒤로 떨구기) · R 트랙으로 · M 소리',
  buttons: [
    { id: 'solo-btn', label: '🏁 혼자 달리기 <small>AI 5대와 경주</small>', onClick: () => startSolo(true) },
    { id: 'ta-btn', label: '⏱️ 타임어택 <small>혼자 기록 도전</small>', cls: 'ghost', onClick: () => startSolo(false) },
  ],
  extraRow: [{ label: '🏆 기록판', onClick: () => openBoard(game.pick.track) }],
  screens: ['over', 'board'],
  describe,
  options: {
    room: (el, opts, host) => {
      el.innerHTML = '';
      trackPicker(el, opts.track, host, (id) => shell.send({ t: 'opts', opts: { track: id } }));
      modeSeg(el, opts, host, (o) => shell.send({ t: 'opts', opts: o }), true);
      if (opts.track) loadTrack(opts.track);
    },
  },
  onProfile: () => { if (game.mode === 'title') placePreview(); },
  onStart: (m) => startMulti(m),
  onFinish: (m) => showResults(m),
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ track: game.pick.track, mode: game.pick.mode });

// ---------- 처음 화면 미리보기: 출발선에 내 카트 ----------
function clearKarts() { for (const k of game.karts) k.remove(); game.karts = []; game.bots = []; game.me = null; }
function placePreview() {
  clearKarts();
  const me = new Kart({ scene, profile: shell.profile, id: 'me' });
  me.place(game.track, 2); game.me = me; game.karts.push(me);
}
function toTitle() {
  endRace();
  game.mode = 'title'; game.multi = false;
  shell.multi = false; shell.playing = false;
  loadTrack(game.pick.track); placePreview();
  shell.show('title'); renderTitleOpts();
}
function endRace() {
  for (const id of ['hud', 'lights', 'banner', 'wrong', 'touch', 'howto']) $(id).classList.add('hidden');
  $('speedlines').style.opacity = '0';
  engine(0);
}

// ---------- 출발 ----------
function setupRace(trackId, itemMode, team) {
  loadTrack(trackId);
  clearKarts();
  if (game.items) game.items.dispose();
  game.items = new RiderItems(scene, game.track);
  game.itemMode = itemMode; game.team = team;
  if (itemMode) game.items.makeBoxes();
  game.raceT = 0; game.results = null; game.finishShown = false; game.doneAt = 0; game.startPress = null; game.watch = null;
  $('nitro').classList.toggle('hidden', itemMode); $('itembar').classList.toggle('hidden', !itemMode);
  renderItems();
}
function startSolo(withBots) {
  game.multi = false; shell.multi = false;
  setupRace(game.pick.track, withBots && game.pick.mode === 'item', false);
  const me = game.me = new Kart({ scene, profile: shell.profile, id: 'me' });
  game.karts.push(me);
  if (withBots) {
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 5; i++) {
      const k = new Kart({ scene, profile: { name: names[i], color: BOT_COLORS[i] }, id: 'bot' + i, bot: true });
      k.setTag(); game.karts.push(k); game.bots.push(new Bot(k, 0.86 + i * 0.025 + Math.random() * 0.02));
    }
  }
  // 출발 자리: 나는 중간쯤
  const order = [...game.karts].sort(() => Math.random() - 0.5);
  order.splice(order.indexOf(me), 1); order.splice(Math.min(3, order.length), 0, me);
  order.forEach((k, i) => k.place(game.track, i));
  game.solo = withBots ? 'race' : 'ta';
  countdown(4000);
}
function startMulti(m) {
  game.multi = true;
  const o = m.opts || {};
  setupRace(o.track, o.mode === 'item', !!o.team);
  m.members.forEach((mem, i) => {
    const mine = mem.id === shell.myId;
    const k = new Kart({ scene, profile: mine ? shell.profile : { name: mem.name, color: mem.color, look: mem.look, acc: mem.acc }, id: mem.id, remote: !mine });
    k.team = mem.team;
    if (!mine) k.setTag(o.team ? TEAMS[mem.team]?.color : null);
    k.place(game.track, i);
    game.karts.push(k); if (mine) game.me = k;
  });
  game.solo = null;
  $('teamrace').classList.toggle('hidden', !o.team);
  countdown(m.in);
}
function countdown(ms) {
  shell.hideScreens();
  game.mode = 'count'; game.countT = ms / 1000; game.lightN = -1;
  $('hud').classList.remove('hidden'); $('howto').classList.toggle('hidden', coarse);
  if (coarse) $('touch').classList.remove('hidden');
  $('lights').classList.remove('hidden');
  for (const i of $('lights').children) i.classList.remove('on');
  banner(`${game.def.emoji} ${game.def.name}`);
}
function banner(text) { const b = $('banner'); b.classList.add('hidden'); void b.offsetWidth; b.textContent = text; b.classList.remove('hidden'); clearTimeout(game.bannerT); game.bannerT = setTimeout(() => b.classList.add('hidden'), 1400); }

// ---------- 아이템 ----------
function ranked() { const M = game.track.M; return [...game.karts].sort((a, b) => (a.done && b.done ? a.finishT - b.finishT : a.done ? -1 : b.done ? 1 : b.progress(M) - a.progress(M))); }
function useItem(k) {
  const id = k.items.shift();
  if (!id) return;
  const T = game.track, mine = k === game.me;
  const send = (m) => { if (game.multi && mine) shell.send({ t: 'item', ...m }); };
  if (mine) { sfx('use_' + (id === 'boost' ? 'rocket' : id === 'zap' ? 'wave' : id === 'missile' ? 'teleport' : id === 'bomb' ? 'trap' : id)); shell.toast(`${ITEMS[id].emoji} ${ITEMS[id].name}!`, 700); renderItems(); }
  if (id === 'boost') { k.boostT = 2; k.boostP = 0.55; if (mine) sfx('nitro'); }
  if (id === 'shield') k.eff.shield = 6;
  if (id === 'ghost') k.eff.ghost = 3.5;
  if (id === 'magnet') k.eff.magnet = 3;
  if (id === 'trap') { const x = k.pos.x - Math.sin(k.yaw) * 3.5, z = k.pos.z - Math.cos(k.yaw) * 3.5; game.items.addTrap(x, k.pos.y + 0.05, z, k.id); send({ k: 'trap', p: [x, k.pos.y + 0.05, z] }); }
  if (id === 'bomb') { const back = !!k.useBack, off = T.offset(k.pos, k.idx); game.items.addBomb(k.idx, off, k.id, back); send({ k: 'bomb', p: [k.idx, off, back ? 1 : 0] }); } // ↓ 누르고 쓰면 뒤에 떨군다
  if (id === 'missile') {
    const R = ranked(), i = R.indexOf(k), tgt = R[i - 1];
    if (!tgt) { const off = T.offset(k.pos, k.idx); game.items.addBomb(k.idx, off, k.id); send({ k: 'bomb', p: [k.idx, off] }); return; } // 1등이면 앞으로 던진다
    game.items.addMissile(k, tgt, k.id); send({ k: 'missile', p: [0], to: tgt.id }); sfx('missile');
  }
  if (id === 'zap') {
    const prog = k.progress(T.M);
    sfx('zap');
    for (const o of game.karts) if (o !== k && !o.remote && o.progress(T.M) > prog && !friendly(k.id, o)) hit(o, 'zap');
    send({ k: 'zap', p: [prog] });
  }
}
const friendly = (ownerId, k) => game.team && game.karts.find((x) => x.id === ownerId)?.team === k.team;
// 맞음 (내 화면에서 움직이는 카트만)
function hit(k, kind) {
  if (kind === 'zap') { if (k.eff.shield > 0) { k.eff.shield = 0; return; } if (k.eff.ghost > 0) return; k.eff.shrink = 3; if (k === game.me) { sfx('zap'); shell.toast('⚡ 번개를 맞아 작아졌어요!', 900); } return; }
  const r = k.spin(kind === 'missile' ? 1.6 : kind === 'bomb' ? 1.4 : 1.2);
  if (k === game.me) {
    if (r === 'blocked') { sfx('shieldbreak'); shell.toast('🛡️ 막았어요!', 800); }
    else { sfx(kind === 'trap' ? 'trapped' : 'boom'); sfx('spin'); shell.toast(kind === 'trap' ? '🍯 끈적! 미끄러졌어요' : kind === 'bomb' ? '💣 물폭탄에 맞았어요!' : '🎯 미사일에 맞았어요!', 1000); }
  }
}
shell.on('item', (m) => {
  if (game.mode !== 'race' && game.mode !== 'count') return;
  const from = game.karts.find((k) => k.id === m.by); const p = (m.p || []).map(Number);
  if (m.k === 'trap') game.items.addTrap(p[0], p[1], p[2], m.by);
  if (m.k === 'bomb') game.items.addBomb(p[0], p[1], m.by, !!p[2]);
  if (m.k === 'missile' && from) { const tgt = game.karts.find((k) => k.id === m.to); if (tgt) game.items.addMissile(from, tgt, m.by); sfx('missile'); }
  if (m.k === 'zap' && game.me && game.me.progress(game.track.M) > p[0] && !(game.team && m.team === game.me.team)) hit(game.me, 'zap');
});
function renderItems(roll) {
  const k = game.me, slots = [$('slot0'), $('slot1')];
  if (roll) { const el = slots[k.items.length - 1]; el.classList.add('spin'); let n = 0; const ids = Object.values(ITEMS).map((d) => d.emoji); clearInterval(game.rollT); game.rollT = setInterval(() => { el.textContent = ids[n++ % ids.length]; if (n > 9) { clearInterval(game.rollT); el.classList.remove('spin'); renderItems(); } }, 70); return; }
  slots.forEach((el, i) => { el.textContent = k?.items[i] ? ITEMS[k.items[i]].emoji : ''; });
}

// ---------- 같이 달리기 ----------
shell.on('snap', (m) => {
  for (const [id, ...st] of m.p) { const k = game.karts.find((x) => x.id === id); if (k && k.remote) k.netSet(st); }
});
shell.on('done', (m) => { const k = game.karts.find((x) => x.id === m.id); if (k && k.remote) { k.done = true; k.finishT = m.time; if (k !== game.me) shell.toast(`🏁 ${k.name} 도착! ${fmt(m.time)}`, 1400); } });
shell.on('gone', (m) => { const k = game.karts.find((x) => x.id === m.id); if (k) { k.remove(); game.karts = game.karts.filter((x) => x !== k); } });

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let t = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  const T = game.track;
  if (game.mode === 'title') {
    const a = t * 0.15, me = game.me;
    camera.position.set(me.pos.x + Math.sin(a) * 9, me.pos.y + 3.2, me.pos.z + Math.cos(a) * 9);
    camera.lookAt(me.pos.x, me.pos.y + 0.8, me.pos.z);
    me.pose(dt, t);
  } else {
    if (game.mode === 'count') {
      game.countT -= dt;
      const n = Math.min(3, Math.floor(3 - game.countT + 1));
      if (n !== game.lightN && game.countT < 3) { game.lightN = n; const L = $('lights').children; for (let i = 0; i < 3; i++) L[i].classList.toggle('on', i < n); sfx('light', false); }
      if (game.countT <= 0) {
        game.mode = 'race'; $('lights').children[3].classList.add('on'); sfx('light', true); banner('GO!');
        // 출발 부스터: GO 직전 0.4초 안에 가속을 누르면
        if (game.startPress != null && game.startPress < 0.4) { game.me.boostT = 1.5; game.me.boostP = 0.4; sfx('nitro'); shell.toast('🚀 출발 부스터!', 1000); }
        setTimeout(() => $('lights').classList.add('hidden'), 900);
      }
    }
    if (game.mode === 'race') race(dt);
    for (const k of game.karts) { if (k.remote) k.follow(dt); k.pose(dt, t); }
    followCam(dt);
    hud();
  }
  T?.update(t, dt);
  env.update(dt, t, camera, 0, camera.position.x, camera.position.y);
  renderer.render(scene, camera);
}
function race(dt) {
  const T = game.track, me = game.me;
  game.raceT += dt;
  const inp = game.autopilot ? game.autopilot.input(dt, T, me.progress(T.M)) : readInput(); usePressed = false; // autopilot: 점검용
  if (me.done) { inp.up = true; inp.dir = 0; inp.use = false; inp.drift = false; } // 도착하면 천천히 굴러간다
  const fx = (n, a) => { if (n === 'miniboost') { sfx('nitro'); return; } if (n === 'pad') { sfx('nitro'); return; } sfx(n, a); };
  const wasDone = me.done;
  me.update(dt, inp, T, fx, game.itemMode ? 'item' : 'speed');
  if (inp.use && game.itemMode) { me.useBack = !!inp.down; useItem(me); }
  if (!wasDone && me.done) onMeDone();
  // AI
  const pp = me.progress(T.M);
  for (const b of game.bots) {
    const k = b.k, bi = b.input(dt, T, pp);
    if (k.done) { bi.up = true; bi.dir *= 0.5; }
    const was = k.done;
    k.update(dt, bi, T, null, game.itemMode ? 'item' : 'speed');
    if (bi.use && game.itemMode && k.items.length) useItem(k);
    if (!was && k.done) k.finishT = k.time;
  }
  // 카트끼리 부딪힘 (내 화면에서 움직이는 카트만 밀린다)
  //   앞뒤로는 절대 밀지 않는다 (같이 할 때 서로의 위치가 조금씩 늦게 보여서, 둘 다 뒤로 밀려 멈추던 문제)
  //   → 트랙 옆 방향으로만 조금씩 벌어지고, 부딪힌 순간 살짝 튕기며 속도가 약간 준다
  const locals = game.karts.filter((k) => !k.remote);
  for (const a of locals) for (const b of game.karts) {
    if (a === b || a.eff.ghost > 0 || b.eff.ghost > 0) continue;
    const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d = Math.hypot(dx, dz);
    if (d >= 2.4) continue;
    const n = T.Nrm[a.idx], t = T.T[a.idx];
    const along = dx * t.x + dz * t.z;           // + 면 내가 앞
    let side = dx * n.x + dz * n.z;             // 옆으로 얼마나 떨어져 있나
    if (Math.abs(along) > 1.9 && Math.abs(side) < 1.2) {
      // 바로 뒤에 붙음: 뒤쪽 카트만 앞 카트 속도보다 조금 느리게 (멈추지는 않는다)
      if (along < 0 && a.v > b.v) a.v = Math.max(b.v - 0.5, a.v - 20 * dt);
      continue;
    }
    if (Math.abs(side) < 0.05) side = (String(a.id) < String(b.id) ? 1 : -1) * 0.05; // 똑같은 자리면 id 로 방향을 정한다
    const dir = Math.sign(side), push = Math.min(0.12, (2.4 - d) * 0.25);
    a.pos.x += n.x * dir * push; a.pos.z += n.z * dir * push;
    a.vl = Math.max(-6, Math.min(6, a.vl + dir * 10 * dt * (a.v >= 0 ? 1 : -1)));
    if (a === me && Math.abs(me.v) > 12 && !game.bumpCd) { sfx('bump'); game.bumpCd = 0.5; me.v *= 0.96; }
  }
  game.bumpCd = Math.max(0, (game.bumpCd || 0) - dt);
  // 아이템 상자 · 아이템
  if (game.itemMode) {
    const R = ranked();
    for (const k of locals) if (k.items.length < 2 && game.items.takeBoxes(k)) { k.items.push(randomItem(R.indexOf(k) + 1, R.length)); if (k === me) { sfx('item'); renderItems(true); } }
  }
  game.items.update(dt, t, locals, (k, kind) => hit(k, kind));
  // 같이 달리기: 내 상태 보내기
  if (game.multi) {
    game.sendT -= dt;
    if (game.sendT <= 0) { game.sendT = 1 / 15; shell.send({ t: 'st', p: [me.pos.x, me.pos.y, me.pos.z, me.yaw, me.v, me.lap, me.idx, me.flags(), me.progress(T.M)] }); }
  }
  // 혼자: 모두 들어오거나 내가 들어오고 12초 뒤 끝
  if (!game.multi && me.done && (game.karts.every((k) => k.done) || game.raceT - game.doneAt > 12)) showResults(null);
  // 소리
  engine(game.mode === 'race' ? Math.min(1, Math.abs(me.v) / MAX) : 0, me.boostT > 0 ? 1 : 0);
}
// 관전: 같이 달리기에서 먼저 들어오면 아직 달리는 사람을 따라간다 (Space 로 바꾸기)
const watchList = () => ranked().filter((k) => k !== game.me && !k.done);
function cycleWatch() {
  const L = watchList(); if (!L.length) return;
  game.watch = L[(L.indexOf(game.watch) + 1) % L.length]; game.watchPick = true; sfx('item');
}
function updateWatch() {
  const el = $('spectate'), on = game.mode === 'race' && game.multi && game.me?.done && game.raceT - game.doneAt > 2.5;
  if (!on) { el.classList.add('hidden'); game.watch = null; return; }
  const L = watchList();
  if (!L.includes(game.watch)) { game.watch = L[0] || null; game.watchPick = false; }
  el.classList.remove('hidden');
  el.innerHTML = game.watch ? `👀 <b>${esc(game.watch.name)}</b> 관전 중 · ${L.indexOf(game.watch) + 1}/${L.length} <span class="key">Space</span> 다른 사람` : '모두 들어오길 기다리는 중…';
}
$('spectate').onclick = () => cycleWatch();
function onMeDone() {
  game.doneAt = game.raceT;
  banner('🏁 FINISH!');
  shell.toast(`⏱️ ${fmt(game.me.finishT)}`, 2500);
  if (game.multi) shell.send({ t: 'done', time: game.me.finishT });
}
function followCam(dt) {
  updateWatch();
  const k = game.watch || game.me; if (!k) return;
  const sx = Math.sin(k.yaw), sz = Math.cos(k.yaw);
  const back = 7 + Math.min(2, Math.abs(k.v) / 20), up = 2.9;
  camPos.set(k.pos.x - sx * back, k.pos.y + up, k.pos.z - sz * back);
  const kk = 1 - Math.exp(-dt * (game.mode === 'race' ? 4.5 : 3)); // 카메라는 살짝 늦게 따라와서 드리프트가 부드럽게 보인다
  camera.position.lerp(camPos, kk);
  camLook.set(k.pos.x + sx * 6, k.pos.y + 1, k.pos.z + sz * 6);
  camera.lookAt(camLook);
  const fov = 66 + Math.min(14, Math.abs(k.v) * 0.25) + (k.boostT > 0 ? 8 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * kk; camera.updateProjectionMatrix(); }
}

// ---------- 화면 표시 ----------
function hud() {
  const me = game.me, T = game.track; if (!me) return;
  const R = ranked(), pos = R.indexOf(me) + 1;
  $('h-pos').innerHTML = `${pos}<small>/${R.length}</small>`;
  $('h-lap').textContent = me.done ? '🏁 도착!' : `LAP ${Math.min(LAPS, me.lap + 1)}/${LAPS}`;
  $('h-time').textContent = fmt(me.done ? me.finishT : me.time);
  $('h-speed').textContent = Math.round(Math.abs(me.v) * 3.6);
  $('speedlines').style.opacity = game.mode === 'race' ? String(Math.min(0.9, me.boostT > 0 ? 0.9 : Math.max(0, (Math.abs(me.v) - 26) / 12))) : '0';
  if (!game.itemMode) { $('gauge').firstElementChild.style.width = `${me.gauge * 100}%`; $('ns0').classList.toggle('on', me.nitro > 0); $('ns1').classList.toggle('on', me.nitro > 1); }
  $('wrong').classList.toggle('hidden', !(me.wrongT > 1.2 && game.mode === 'race'));
  if (game.team) {
    const pts = { red: 0, blue: 0 }, P = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0];
    R.forEach((k, i) => { if (k.team) pts[k.team] += P[i] || 0; });
    $('teamrace').innerHTML = `<span style="background:${TEAMS.red.color}88">${TEAMS.red.name} ${pts.red}</span><span style="background:${TEAMS.blue.color}88">${TEAMS.blue.name} ${pts.blue}</span>`;
  }
  drawMinimap(R);
}
let mm = null;
function drawMinimapBase() {
  const T = game.track, c = $('minimap'), x = c.getContext('2d');
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of T.P) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const s = 150 / Math.max(x1 - x0, z1 - z0);
  mm = { s, ox: 85 - ((x0 + x1) / 2) * s, oz: 85 - ((z0 + z1) / 2) * s };
  const b = document.createElement('canvas'); b.width = b.height = 170;
  const g = b.getContext('2d');
  g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.85)';
  g.beginPath(); T.P.forEach((p, i) => { const X = mm.ox + p.x * s, Y = mm.oz + p.z * s; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.stroke();
  g.lineWidth = 5; g.strokeStyle = 'rgba(60,40,90,.9)'; g.stroke();
  mm.base = b;
}
function drawMinimap(R) {
  if (!mm) return;
  const x = $('minimap').getContext('2d');
  x.clearRect(0, 0, 170, 170); x.drawImage(mm.base, 0, 0);
  for (const k of [...R].reverse()) {
    const X = mm.ox + k.pos.x * mm.s, Y = mm.oz + k.pos.z * mm.s, me = k === game.me;
    x.fillStyle = me ? '#ffd84d' : game.team && k.team ? TEAMS[k.team].color : k.bot ? '#ff8fb1' : '#7cd8ff';
    x.beginPath(); x.arc(X, Y, me ? 6 : 4.5, 0, 7); x.fill();
    if (me) { x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke(); }
  }
}

// ---------- 결과 ----------
function showResults(m) {
  if (game.mode === 'over') return;
  game.mode = 'over'; endRace();
  let rows;
  if (m?.rank) rows = m.rank.map((e) => ({ name: e.name, color: e.color, team: e.team, time: e.time, prog: e.prog, me: e.id === shell.myId }));
  else rows = ranked().map((k) => ({ name: k.name, color: k.o.profile?.color, time: k.done ? k.finishT : null, prog: k.progress(game.track.M), me: k === game.me }));
  const myRank = rows.findIndex((r) => r.me) + 1, mine = rows[myRank - 1];
  $('ov-title').textContent = game.solo === 'ta' ? '⏱️ 타임어택 기록' : myRank === 1 ? '🏆 1등! 우승!' : `🏁 ${myRank}등으로 들어왔어요`;
  $('ov-me').textContent = mine?.time != null ? `⏱️ ${fmt(mine.time)}` : '아직 못 들어왔어요';
  $('ov-team').innerHTML = m?.team ? (m.team.winner === 'draw' ? '🤝 팀 무승부!' : `🏆 ${TEAMS[m.team.winner].name} 승리! · ${TEAMS.red.name} ${m.team.red}점 vs ${TEAMS.blue.name} ${m.team.blue}점`) : '';
  $('ov-rank').innerHTML = rows.map((r, i) => `<div class="brow${r.me ? ' me' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="nm"><span class="dot" style="background:${esc(r.team ? TEAMS[r.team].color : r.color || '#ccc')}"></span>${esc(r.name)}</span><span class="sc">${r.time != null ? fmt(r.time) : `<small>${Math.round((r.prog / LAPS) * 100)}%</small>`}</span></div>`).join('');
  $('again-btn').textContent = game.multi ? '🏁 방으로 돌아가기' : '🔁 다시 달리기';
  $('ov-best').textContent = ''; $('ov-save').classList.add('hidden');
  shell.show('over');
  if (myRank === 1 || mine?.time != null) sfx('finish');
  // 스피드전 기록 남기기 (아이템전은 운이 커서 안 남긴다)
  if (!game.itemMode && mine?.time != null) {
    game.rec = { b: game.def.id, time: mine.time, name: shell.profile.name, color: shell.profile.color };
    if (shell.logged()) saveRecord(game.rec); else { $('ov-save').classList.remove('hidden'); $('ov-nick').value = shell.profile.name; }
  }
  if (game.multi) shell.renderRoom(`<h3>🏁 지난 경기</h3>${$('ov-rank').innerHTML}`);
}
function anonId() { let a = store.get(ANON_KEY); if (!/^[a-f0-9]{24}$/.test(a || '')) { a = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set(ANON_KEY, a); } return a; }
async function saveRecord(rec) {
  try {
    const r = await account.api('/api/rider/record', { method: 'POST', body: rec });
    $('ov-best').textContent = r.best ? `🎉 이 트랙 내 최고 기록! 전체 ${r.me.rank}위` : `내 최고 ${fmt(r.me.value)} · 전체 ${r.me.rank}위`;
    if (r.best) sfx('best');
  } catch (e) { $('ov-best').textContent = `기록을 남기지 못했어요 (${e.message})`; }
}
$('ov-save-btn').onclick = async () => { const name = $('ov-nick').value.trim(); if (!name) return shell.toast('닉네임을 정해 주세요'); $('ov-save').classList.add('hidden'); await saveRecord({ ...game.rec, name, anon: anonId() }); };
$('again-btn').onclick = () => { if (game.multi) { game.mode = 'title-room'; shell.backToRoom(); } else startSolo(game.solo !== 'ta'); };
$('home-btn').onclick = () => { if (game.multi) { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); };

// ---------- 기록판 ----------
async function openBoard(id) {
  shell.show('board');
  const el = $('board-tracks');
  el.innerHTML = TRACKS.map((t) => `<button data-t="${t.id}" class="${t.id === id ? 'on' : ''}"><b>${t.emoji}</b>${esc(t.name)}</button>`).join('');
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => openBoard(b.dataset.t); });
  $('board-list').innerHTML = '<div class="empty">불러오는 중…</div>';
  let d = { top: [] };
  try { d = await account.api(`/api/rider/board?b=${id}` + (shell.logged() ? '' : `&anon=${anonId()}`)); } catch { /* 무시 */ }
  const myId = d.me?.id;
  const row = (e) => `<div class="brow${e.id === myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : e.anon ? ' <span class="guest">비로그인</span>' : ''}</span><span class="sc">${fmt(e.value)}</span></div>`;
  $('board-list').innerHTML = (d.top || []).map(row).join('') + (d.me && d.me.rank > 30 ? '<div class="brow gap">⋯</div>' + row(d.me) : '') || '<div class="empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</div>';
}
$('board-close').onclick = () => shell.show('title');

// ---------- 시작 ----------
loadTrack(game.pick.track);
renderTitleOpts();
shell.boot().then(() => { placePreview(); });
placePreview();
frame();
