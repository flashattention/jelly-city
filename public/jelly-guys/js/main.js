// 젤리 가이즈: 최대 20명(+ 젤리봇)이 여러 판의 장애물 레이스 · 버티기 · 결승을 거쳐 마지막 한 명을 가린다
//   내 몸은 이 화면이 움직이고(phys.js), 다른 곰돌이는 서버가 보내는 위치를 부드럽게 따라간다
import * as THREE from 'three';
import { Shell, esc } from '../../shared/js/shell.js';
import { makeBear, poseBear } from '../../dream-runner/js/runner.js';
import { sfx, setMusic, stopMusic, unlock, toggleMute, sound } from '../../dream-runner/js/music.js';
import { buildRound, ROUNDS } from './rounds.js';
import { newBody, step, pushApart } from './phys.js';
import { World } from './world.js';

const $ = (id) => document.getElementById(id);
const FILLS = [8, 12, 16, 20];

// ---------- 그리기 준비 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 1200);
scene.add(new THREE.HemisphereLight('#ffffff', '#9a8ab0', 1.7));
const sun = new THREE.DirectionalLight('#fff4e0', 1.5); sun.position.set(30, 60, -20); scene.add(sun);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const game = window.guys = {
  mode: 'title', // title · play · over
  L: null, world: null, st: { tiles: new Map(), doors: new Set() },
  me: null, body: null, bear: null, ghosts: new Map(), alive: new Set(),
  playAt: 0, round: null, myState: 'run', // run · fin · out · spec
  camYaw: 0, camPitch: 0.32, spec: null, sendT: 0, fill: Number(localStorage.getItem('jellyguys.fill')) || 16,
  quota: 0, passN: 0, outN: 0, start: 0, events: [],
};

// ---------- 곰돌이 (나 · 다른 곰돌이) ----------
function nameTag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 7; x.strokeStyle = 'rgba(30,20,40,.85)'; x.strokeText(name, 128, 32); x.fillStyle = color || '#fff'; x.fillText(name, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1); s.renderOrder = 10; return s;
}
const lighten = (hex) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.45).getHexString();
class Jelly {
  constructor(m, mine) {
    this.id = m.id; this.name = m.name; this.mine = mine;
    this.bear = makeBear({ name: m.name, color: m.color, look: m.look, acc: m.acc });
    this.bear.root.scale.setScalar(0.92);
    scene.add(this.bear.root);
    this.tag = nameTag(mine ? '나' : m.name, mine ? '#ffe066' : lighten(m.color || '#ffffff')); scene.add(this.tag);
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.yaw = 0; this.tyaw = 0; this.flags = 1; this.vy = 0; this.at = 0; this.t = 0; this.lie = 0;
  }
  snap(x, y, z, yaw, f) { this.tgt.set(x, y, z); this.tyaw = yaw; this.flags = f; if (!this.at) { this.pos.copy(this.tgt); this.yaw = yaw; } this.at = performance.now(); }
  place(x, y, z, yaw) { this.pos.set(x, y, z); this.tgt.set(x, y, z); this.yaw = this.tyaw = yaw; }
  update(dt) {
    if (!this.mine) {
      const py = this.pos.y;
      if (this.pos.distanceTo(this.tgt) > 6) this.pos.copy(this.tgt); else this.pos.lerp(this.tgt, Math.min(1, dt * 14));
      this.vy = (this.pos.y - py) / Math.max(dt, 1e-3);
      let d = this.tyaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 12);
    }
    const b = this.bear, ground = !!(this.flags & 1), dive = !!(this.flags & 2), stun = !!(this.flags & 4), run = !!(this.flags & 8);
    b.root.position.copy(this.pos); b.root.rotation.set(0, this.yaw, 0);
    b.update(dt, run && ground && !stun ? 9 : 0, { airborne: !ground, noCrawl: true });
    poseBear(b, { alive: true, ground, slide: false, flip: null, vy: this.vy }, dt);
    // 다이브: 배로 납작 · 맞으면 빙글
    this.lie += ((dive ? 1 : 0) - this.lie) * Math.min(1, dt * 12);
    if (this.lie > 0.02) { b.inner.rotation.x = this.lie * 1.35; b.inner.position.y += this.lie * -0.35; for (const ar of b.arms.slice(0, 2)) ar.rotation.x = -2.6 * this.lie; }
    if (stun && !dive) { this.t += dt; b.inner.rotation.z = Math.sin(this.t * 22) * 0.35; } else b.inner.rotation.z = 0;
    // 이름표: 내 것은 숨기고, 가까운 곰돌이만 (멀수록 흐리게)
    const d = camera.position.distanceTo(this.pos);
    this.tag.visible = !this.mine && d < 22 && this.bear.root.visible;
    if (this.tag.visible) { this.tag.material.opacity = Math.min(1, (22 - d) / 8); this.tag.position.set(this.pos.x, this.pos.y + 2.25, this.pos.z); }
  }
  remove() { scene.remove(this.bear.root); scene.remove(this.tag); }
}

// ---------- 입력 ----------
const keys = new Set(); let jumpEdge = false, diveEdge = false;
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', (e) => {
  if (typing()) return;
  unlock();
  if (e.code === 'KeyM') { toggleMute(); syncMute(); }
  if (game.mode !== 'play') return;
  if (!e.repeat) { if (e.code === 'Space') jumpEdge = true; if (['ShiftLeft', 'ShiftRight', 'KeyE', 'ControlLeft'].includes(e.code)) diveEdge = true; }
  if (e.code === 'Space' && game.myState !== 'run') nextSpec();
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// 마우스로 카메라 돌리기 (화면을 누르면 마우스 잠금 · Esc 로 풀기)
canvas.addEventListener('click', () => { if (game.mode === 'play' && !touchMode) canvas.requestPointerLock?.(); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  game.camYaw -= e.movementX * 0.0032; game.camPitch = Math.max(-0.2, Math.min(1.15, game.camPitch + e.movementY * 0.0026));
});
// 휴대폰: 왼쪽 막대 = 움직이기 · 오른쪽 끌기 = 카메라 · 단추 = 점프 · 다이브
const touchMode = matchMedia('(pointer: coarse)').matches;
const stick = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, look = { id: null, x: 0, y: 0 };
if (touchMode) document.body.classList.add('touch');
addEventListener('touchstart', (e) => {
  if (game.mode !== 'play') return;
  for (const t of e.changedTouches) {
    if (t.target.closest?.('#t-btns')) continue;
    if (t.clientX < innerWidth * 0.45 && stick.id == null) { stick.id = t.identifier; stick.x = t.clientX; stick.y = t.clientY; stick.dx = stick.dy = 0; showStick(true); }
    else if (look.id == null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) { stick.dx = Math.max(-1, Math.min(1, (t.clientX - stick.x) / 55)); stick.dy = Math.max(-1, Math.min(1, (t.clientY - stick.y) / 55)); showStick(true); }
    if (t.identifier === look.id) { game.camYaw -= (t.clientX - look.x) * 0.006; game.camPitch = Math.max(-0.2, Math.min(1.15, game.camPitch + (t.clientY - look.y) * 0.004)); look.x = t.clientX; look.y = t.clientY; }
  }
}, { passive: true });
addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.id = null; stick.dx = stick.dy = 0; showStick(false); } if (t.identifier === look.id) look.id = null; } });
function showStick(on) { const s = $('stick'); s.classList.toggle('hidden', !on); if (on) { s.style.left = stick.x + 'px'; s.style.top = stick.y + 'px'; s.firstElementChild.style.transform = `translate(${stick.dx * 30}px, ${stick.dy * 30}px)`; } }
$('t-jump').addEventListener('touchstart', (e) => { e.preventDefault(); jumpEdge = true; if (game.myState !== 'run') nextSpec(); });
$('t-dive').addEventListener('touchstart', (e) => { e.preventDefault(); diveEdge = true; });

function readInput() {
  let f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  let s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  if (stick.id != null) { f = -stick.dy; s = stick.dx; }
  // 카메라가 보는 쪽이 앞
  const fx = Math.sin(game.camYaw), fz = Math.cos(game.camYaw), rx = -fz, rz = fx;
  const inp = { mx: fx * f + rx * s, mz: fz * f + rz * s, jump: jumpEdge, dive: diveEdge }; // (rx, rz) = 화면 오른쪽
  jumpEdge = diveEdge = false;
  return inp;
}

// ---------- 소리 · 화면 단추 ----------
function syncMute() { $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = () => { toggleMute(); syncMute(); };
$('b-quit').onclick = () => quit();

// ---------- 공용 틀 (처음 화면 · 방) ----------
function fillSeg(el, cur, host, onPick) {
  const d = document.createElement('div'); d.className = 'seg';
  d.innerHTML = `<span class="lbl">🤖 젤리봇까지 모두</span>` + FILLS.map((n) => `<button class="${n === cur ? 'on' : ''}" data-n="${n}" ${host ? '' : 'disabled'}>${n}명</button>`).join('');
  d.querySelectorAll('button').forEach((b) => { b.onclick = () => onPick(+b.dataset.n); });
  el.appendChild(d);
}
const shell = new Shell({
  key: 'jellyguys', title: '🎉 젤리 가이즈', subtitle: '젤리 곰돌이 20명이 장애물 레이스 · 버티기 · 결승을 거쳐<br>마지막 한 명의 왕관을 다퉈요!', wsPath: '/guys-ws', max: 20,
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); syncMute(); } },
  multiLabel: '👥 같이 하기', roomIcon: '🎉', startLabel: '🎉 다 같이 출발!',
  keysHelp: 'W A S D 움직이기 · Space 점프 · Shift / E 다이브 · 마우스 카메라 (화면 클릭) · M 소리',
  buttons: [{ id: 'solo-btn', label: '🎉 바로 한 판 <small>젤리봇과 함께</small>', onClick: () => startSolo() }],
  screens: ['over'],
  describe: (o) => `${o.fill || 16}명 경기`,
  options: {
    title: () => {},
    room: (el, opts, host) => { el.innerHTML = ''; fillSeg(el, opts.fill || 16, host, (n) => shell.send({ t: 'opts', opts: { fill: n } })); },
  },
  onAccount: () => renderTitleOpts(),
  onStart: (m) => onEpisodeStart(m),
  onFinish: (m) => onEpisodeEnd(m),
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ fill: game.fill });
function renderTitleOpts() {
  const el = $('title-opts'); el.innerHTML = '';
  fillSeg(el, game.fill, true, (n) => { game.fill = n; localStorage.setItem('jellyguys.fill', n); renderTitleOpts(); });
  const box = document.createElement('div'); box.className = 'round-list';
  box.innerHTML = '<div class="lbl">🗺️ 맵 하나만 연습하기</div>' + Object.entries(ROUNDS).map(([id, r]) => `<button class="rk ${r.kind}" data-r="${id}" title="${esc(r.desc)}">${r.emoji} ${esc(r.name)}</button>`).join('');
  box.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => startSolo(b.dataset.r); });
  el.appendChild(box);
}
function startSolo(round) { unlock(); game.soloPending = true; game.lastOnly = typeof round === 'string' ? round : null; shell.sendAfterHello({ t: 'practice', opts: { fill: game.fill, round: game.lastOnly } }); }

// ---------- 경기 흐름 ----------
function onEpisodeStart(m) {
  game.practice = !!game.soloPending; game.soloPending = false;
  game.mode = 'play'; game.myId = shell.myId; game.members = new Map(m.members.map((x) => [x.id, x]));
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('over').classList.add('hidden');
  game.plan = m.plan || [];
  showCard('🎉', '젤리 가이즈', `${m.members.length}명이 모였어요! ${game.plan.length}판 안에 마지막 한 명이 정해져요`, 'start', 1500);
  setMusic(['major', 64, 150, 'square']);
}
function quit() { if (shell.room) { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() {
  clearRound(); game.mode = 'title'; shell.multi = false; shell.playing = false; document.exitPointerLock?.();
  for (const id of ['hud', 'card', 'banner', 'count', 'spec', 'over']) $(id).classList.add('hidden');
  stopMusic(); shell.show('title'); renderTitleOpts(); titleScene();
}
function clearRound() {
  for (const g of game.ghosts.values()) g.remove(); game.ghosts.clear();
  if (game.me) { game.me.remove(); game.me = null; }
  if (game.world) { game.world.dispose(); game.world = null; }
  game.body = null;
}

shell.on('round', (m) => {
  clearRound();
  const L = game.L = buildRound(m.id, m.seed);
  game.world = new World(scene, L);
  game.st = { tiles: new Map(), doors: new Set() };
  game.round = m; game.quota = m.quota; game.passN = 0; game.outN = 0; game.start = m.alive.length;
  game.alive = new Set(m.alive);
  game.playAt = performance.now() + m.intro + m.count;
  const arena = !(L.kind === 'race' || L.crown);
  m.alive.forEach((id, i) => {
    const s = L.spawn[i % L.spawn.length], yaw = arena ? Math.atan2(-s.x, -s.z) : 0;
    const mem = game.members.get(id) || { id, name: '곰돌이', color: '#8a5634' };
    const j = new Jelly(mem, id === game.myId); j.place(s.x, s.y, s.z, yaw);
    if (id === game.myId) { game.me = j; game.body = newBody(s); game.body.yaw = yaw; } else game.ghosts.set(id, j);
  });
  game.myState = game.me ? 'run' : 'spec';
  game.camYaw = game.me ? game.body.yaw : 0; game.camPitch = arena ? 0.55 : 0.32;
  game.spec = game.me ? null : m.alive[0];
  game.flyT = 0;
  const kindTxt = L.kind === 'race' ? (L.crown ? '결승 · 왕관 잡기' : `레이스 · ${m.quota}명 통과`) : L.kind === 'survive' ? `버티기 · ${m.alive.length - m.quota}명 탈락하면 끝` : '결승 · 마지막 한 명';
  showCard(L.emoji, L.name, L.desc, L.kind, m.intro, `${m.i + 1}판 / 최대 ${m.n}판 · ${kindTxt}`);
  setTimeout(() => countdown(m.count), m.intro);
  $('spec').classList.toggle('hidden', !!game.me);
  if (!game.me) $('spec').innerHTML = '👀 구경 중 · <b>Space</b> 로 다른 곰돌이 보기';
  hudCounter();
});
shell.on('snap', (m) => {
  for (const [id, x, y, z, yaw, f] of m.p) { if (id === game.myId) continue; game.ghosts.get(id)?.snap(x, y, z, yaw, f); }
});
shell.on('q', (m) => {
  game.passN = m.n;
  if (m.id === game.myId) { game.myState = 'fin'; banner(m.crown ? '👑 왕관 획득!' : `🎉 통과! ${m.n}등`, 'good'); sfx('finish'); toSpec(); confetti(); }
  else { dropGhost(m.id, 'pass'); }
  hudCounter();
});
shell.on('out', (m) => {
  game.outN = m.n;
  if (m.id === game.myId) { if (game.myState === 'run' || game.myState === 'falling') { game.myState = 'out'; banner('💧 탈락…', 'bad'); sfx('die'); toSpec(); } }
  else dropGhost(m.id, 'out');
  hudCounter();
});
shell.on('gone', (m) => { dropGhost(m.id, 'out'); });
shell.on('tile', (m) => { game.st.tiles.set(m.id, m.at); });
shell.on('door', (m) => { if (!game.st.doors.has(m.id)) { game.st.doors.add(m.id); sfx('bump'); } });
shell.on('rend', (m) => {
  const passed = m.pass.includes(game.myId), was = game.alive.has(game.myId);
  if (m.final) {
    const names = m.pass.map((id) => game.members.get(id)?.name || '?').join(', ');
    banner(passed ? '👑 우승!!' : `👑 우승: ${esc(names)}`, passed ? 'good' : '');
    if (passed) { sfx('best'); confetti(); }
  } else if (was) banner(passed ? '✅ 다음 판으로!' : '❌ 탈락… 구경하며 응원해요', passed ? 'good' : 'bad');
  else banner('⏱️ 판 끝!', '');
  game.myState = game.me ? (passed ? 'fin' : 'out') : 'spec';
});
function dropGhost(id, why) {
  const g = game.ghosts.get(id); if (!g) return;
  if (why === 'pass') puff(g.pos, '#ffe066'); else puff(g.pos, '#7fd3ff');
  g.remove(); game.ghosts.delete(id);
  if (game.spec === id) nextSpec();
}
function toSpec() {
  if (game.me) { const p = game.me.pos.clone(); setTimeout(() => { if (game.me && game.myState !== 'run') { puff(p, '#ffe066'); game.me.bear.root.visible = false; game.me.tag.visible = false; } }, 900); }
  setTimeout(() => { if (game.myState !== 'run') { nextSpec(); $('spec').classList.remove('hidden'); $('spec').innerHTML = '👀 구경 중 · <b>Space</b> 로 다른 곰돌이 보기'; } }, 1200);
}
function nextSpec() {
  const ids = [...game.ghosts.keys()]; if (!ids.length) { game.spec = null; return; }
  const i = ids.indexOf(game.spec); game.spec = ids[(i + 1) % ids.length];
  const g = game.ghosts.get(game.spec); if (g) $('spec').innerHTML = `👀 <b>${esc(g.name)}</b> 구경 중 · Space 로 바꾸기`;
}
function onEpisodeEnd(m) {
  document.exitPointerLock?.();
  stopMusic();
  const rows = m.rows || [], mine = rows.find((r) => r.id === game.myId);
  $('ov-title').innerHTML = mine?.win ? '👑 우승했어요!' : `${mine?.place || '-'}등 / ${rows.length}명`;
  $('ov-me').textContent = mine?.win ? '모든 젤리 곰돌이를 이겼어요! 대단해요 🎉' : `${m.rounds}판을 함께 달렸어요`;
  $('ov-rank').innerHTML = rows.slice(0, 20).map((r) => `<div class="row${r.id === game.myId ? ' me' : ''}"><b>${r.win ? '👑' : r.place}</b><span class="dot" style="background:${esc(r.color)}"></span><span class="nm">${r.bot ? '🤖 ' : ''}${esc(r.name)}</span></div>`).join('');
  setTimeout(() => { $('hud').classList.add('hidden'); $('spec').classList.add('hidden'); shell.show('over'); $('over').classList.remove('hidden'); }, 2200);
  if (mine?.win) setTimeout(() => sfx('best'), 300);
}
$('again-btn').onclick = () => { $('over').classList.add('hidden'); clearRound(); if (game.practice || !shell.room) startSolo(game.lastOnly); else { game.mode = 'room'; shell.backToRoom(); titleScene(); } };
$('home-btn').onclick = () => quit();

// ---------- 화면 알림 ----------
let cardT = 0;
function showCard(emoji, name, desc, kind, ms, sub = '') {
  const c = $('card'); c.className = 'card-in ' + kind;
  c.innerHTML = `<div class="em">${emoji}</div><div class="nm">${esc(name)}</div><div class="ds">${esc(desc)}</div>${sub ? `<div class="sb">${esc(sub)}</div>` : ''}`;
  c.classList.remove('hidden'); clearTimeout(cardT); cardT = setTimeout(() => c.classList.add('hidden'), ms);
  sfx('portal');
}
function countdown(ms) {
  const el = $('count'); let n = Math.round(ms / 1000);
  const tick = () => {
    el.classList.remove('hidden'); el.textContent = n > 0 ? n : 'GO!'; el.className = n > 0 ? '' : 'go';
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    sfx('beep', n <= 0);
    if (n-- > 0) setTimeout(tick, 1000); else setTimeout(() => el.classList.add('hidden'), 700);
  };
  tick();
}
let banT = 0;
function banner(html, cls) { const b = $('banner'); b.innerHTML = html; b.className = cls || ''; clearTimeout(banT); banT = setTimeout(() => b.classList.add('hidden'), 2600); }
function hudCounter() {
  const L = game.L; if (!L) return;
  const r = game.round;
  let txt;
  if (L.kind === 'race' && !L.crown) txt = `🏁 통과 <b>${game.passN}</b> / ${game.quota}`;
  else if (L.crown) txt = '👑 왕관을 먼저 잡아요!';
  else if (L.kind === 'survive') txt = `💧 탈락 <b>${game.outN}</b> / ${game.start - game.quota}`;
  else txt = `🙂 남은 곰돌이 <b>${game.start - game.outN}</b>`;
  $('h-round').innerHTML = `${L.emoji} ${esc(L.name)} <small>${r.i + 1}판</small>`;
  $('h-count').innerHTML = txt;
}
// 반짝 가루 · 꽃가루
const parts = [];
function puff(p, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(p).add(new THREE.Vector3(0, 0.8, 0)); scene.add(m);
    parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 6 + 2, (Math.random() - 0.5) * 6), life: 0.9 });
  }
}
function confetti() { const c = document.createElement('div'); c.className = 'confetti'; for (let i = 0; i < 60; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = ['#ff5fa2', '#ffd84d', '#5ec8ff', '#7be07b', '#b388ff'][i % 5]; s.style.animationDelay = Math.random() * 0.6 + 's'; s.style.animationDuration = 1.6 + Math.random() * 1.2 + 's'; c.appendChild(s); } document.body.appendChild(c); setTimeout(() => c.remove(), 3500); }

// ---------- 처음 화면: 무대 위 내 곰돌이 ----------
let titleBear = null;
function titleScene() {
  clearRound();
  game.L = buildRound('hill', 7); game.world = new World(scene, game.L);
  if (titleBear) titleBear.remove();
  titleBear = new Jelly({ id: 0, name: shell.profile?.name || '곰돌이', color: shell.profile?.color, look: shell.profile?.look, acc: shell.profile?.acc }, true);
  titleBear.place(0, 0, 2, Math.PI * 0.85); titleBear.tag.visible = false;
}

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let acc = 0, tt = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); tt += dt;
  const t = game.mode === 'play' && game.L ? (performance.now() - game.playAt) / 1000 : tt;
  const ts = Math.max(0, t);
  if (game.world) game.world.update(game.mode === 'play' ? ts : tt, game.st);
  if (game.mode === 'play' && game.L) playFrame(dt, t);
  else if (titleBear) {
    titleBear.yaw += dt * 0.6; titleBear.flags = 1; titleBear.update(dt);
    const a = tt * 0.15; camera.position.set(Math.sin(a) * 6, 2.6, 2 + Math.cos(a) * 6); camera.lookAt(0, 1, 2);
  }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt); p.m.material.opacity = Math.max(0, p.life); if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); parts.splice(i, 1); } }
  renderer.render(scene, camera);
}
function playFrame(dt, t) {
  const L = game.L, me = game.me, b = game.body;
  if (titleBear) { titleBear.remove(); titleBear = null; }
  // 내 몸 (1/120초로 잘게 나눠 움직인다)
  if (me && b && (game.myState === 'run' || game.myState === 'falling')) {
    const inp = t > 0 && game.myState === 'run' ? readInput() : (readInput(), { mx: 0, mz: 0 });
    acc += dt;
    const ev = [];
    let first = true;
    while (acc >= 1 / 120) {
      acc -= 1 / 120;
      step(b, first ? inp : { mx: inp.mx, mz: inp.mz }, L, Math.max(0, t), 1 / 120, game.st, ev); first = false;
      for (const g of game.ghosts.values()) if (pushApart(b, g.pos, 0.6) && b.dive) g.bump = 0.3;
    }
    for (const e of ev) handleEvent(e, t);
    me.pos.set(b.x, b.y, b.z); me.yaw = b.yaw; me.vy = b.vy;
    me.flags = (b.ground ? 1 : 0) | (b.dive || b.lie > 0 ? 2 : 0) | (b.stun > 0 && !b.lie ? 4 : 0) | (Math.hypot(b.vx, b.vz) > 1 ? 8 : 0);
    game.sendT -= dt;
    if (game.sendT <= 0) { game.sendT = 1 / 15; shell.send({ t: 'st', p: [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(2), me.flags] }); }
  }
  if (me) me.update(dt);
  for (const g of game.ghosts.values()) g.update(dt);
  // 카메라: 내 곰돌이(또는 구경하는 곰돌이) 뒤에서
  const tgt = game.myState === 'run' && me ? me : game.ghosts.get(game.spec) || me;
  if (tgt) {
    if (game.myState !== 'run' && document.pointerLockElement !== canvas && stick.id == null && look.id == null) { let d = tgt.yaw - game.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); game.camYaw += d * Math.min(1, dt * 1.5); }
    const dist = L.kind === 'final' && !L.crown ? 10 : 8.5;
    const cx = tgt.pos.x - Math.sin(game.camYaw) * Math.cos(game.camPitch) * dist, cz = tgt.pos.z - Math.cos(game.camYaw) * Math.cos(game.camPitch) * dist, cy = tgt.pos.y + 1.4 + Math.sin(game.camPitch) * dist;
    camPos.set(cx, cy, cz);
    if (camera.position.distanceTo(camPos) > 30) camera.position.copy(camPos); else camera.position.lerp(camPos, Math.min(1, dt * 10));
    camLook.set(tgt.pos.x, tgt.pos.y + 1.3, tgt.pos.z); camera.lookAt(camLook);
  }
  // 시간
  const left = Math.max(0, (game.round?.time || 0) - Math.max(0, t));
  $('h-time').textContent = t < 0 ? '' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('h-time').classList.toggle('low', left < 10 && t > 0);
}
function handleEvent(e, t) {
  const L = game.L, b = game.body;
  if (e === 'jump') sfx('jump');
  else if (e === 'dive') sfx('slide');
  else if (e === 'land') sfx('land');
  else if (e === 'pad') sfx('jump2');
  else if (e === 'spin' || e === 'knock' || e === 'ball') sfx('shoved');
  else if (e === 'bonk') sfx('bonk');
  else if (e === 'boing' || e === 'push') sfx('bump');
  else if (e === 'finish') { if (!game.sentFin) { game.sentFin = true; shell.send({ t: 'ev', k: 'fin' }); setTimeout(() => { game.sentFin = false; }, 1500); } }
  else if (e === 'crown') { if (!game.sentFin) { game.sentFin = true; shell.send({ t: 'ev', k: 'crown' }); setTimeout(() => { game.sentFin = false; }, 1500); } }
  else if (e === 'fall') {
    if (L.kind === 'race' || L.crown) {
      // 체크포인트로 돌아가기
      const c = L.cps[b.cp];
      const s = c ? { x: c.x + (Math.random() - 0.5) * c.w * 0.5, y: c.y + 1, z: c.z } : L.spawn[Math.floor(Math.random() * 16)];
      Object.assign(b, { x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, stun: 0, dive: 0 }); b.yaw = 0; game.camYaw = 0;
      sfx('die'); flash();
    } else if (game.myState === 'run') { game.myState = 'falling'; shell.send({ t: 'ev', k: 'out' }); sfx('die'); }
  } else if (Array.isArray(e)) {
    const [k, id] = e;
    if (k === 'tile' && !game.st.tiles.has(id)) { game.st.tiles.set(id, Math.max(0, t) + 0.9); shell.send({ t: 'ev', k: 'tile', id }); }
    if (k === 'door') { shell.send({ t: 'ev', k: 'door', id }); sfx('bump'); }
  }
}
function flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

renderTitleOpts();
shell.boot();
titleScene();
frame();
