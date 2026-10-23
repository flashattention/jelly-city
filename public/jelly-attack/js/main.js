// 젤리어택: 곰돌이 젤리들의 팀 슈팅 (연습전: 봇과 · 같이: 최대 12명, 팀 데스매치 / 개인전)
import * as THREE from 'three';
import { store } from '../../shared/js/account.js';
import { Shell, esc, TEAMS } from '../../shared/js/shell.js';
import { Roach } from '../../shared/js/roach.js';
import { MAPS, mapById, rayBoxes } from './maps.js';
import { weapon, PRIMARY, SECONDARY, CLASS_NAME, KNIFE, NADE } from './weapons.js';
import { buildMap } from './world.js';
import { Player, ViewModel } from './fps.js';
import { sfx, unlock, toggleMute, sound } from './sound.js';

const $ = (id) => document.getElementById(id);
const LOAD_KEY = 'jellyattack.loadout', PICK_KEY = 'jellyattack.pick', SENS_KEY = 'jellyattack.sens';
const coarse = matchMedia('(pointer: coarse)').matches;

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 900);
camera.rotation.order = 'YXZ';
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

const me = new Player();
let vm = new ViewModel('#8a5634');
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.attack = { me, ray: rayBoxes, // 점검용
  mode: 'title', map: null, world: null, others: new Map(), myId: 0, team: null, opts: null,
  pick: { map: pick0.map || 'depot', mode: pick0.mode || 'tdm', bots: pick0.bots ?? 6 },
  load: (() => { try { return { p: 'm4', s: 'pistol', ...JSON.parse(store.get(LOAD_KEY) || '{}') }; } catch { return { p: 'm4', s: 'pistol' }; } })(),
  stats: new Map(), score: { red: 0, blue: 0 }, endAt: 0, sens: Number(store.get(SENS_KEY)) || 1,
};

// ---------- 무기 · 탄 ----------
const slots = () => [game.load.p, game.load.s, 'knife', 'nade'];
let cur = 0, ammo = {}, nextFire = 0, reloadEnd = 0, fireLatch = false, nadeCount = 1, kickBack = 0;
// 예비 탄은 무한: 장전만 하면 계속 쏠 수 있다
function refill() { ammo = {}; for (const id of slots()) { const w = weapon(id); if (w?.mag) ammo[id] = { mag: w.mag }; } nadeCount = 1; }
function curW() { return weapon(slots()[cur]); }
// 게임 중 무기를 바꾸면: 새 무기 탄을 채우고 바로 손에 든다 (탄이 없어 쏠 때마다 멈추던 문제)
//   이미 쓰던 무기는 남은 탄 그대로 (바꿨다 돌아와서 탄을 다시 채우지 못하게)
function armNew() {
  for (const id of slots()) { const w = weapon(id); if (w?.mag && !ammo[id]) ammo[id] = { mag: w.mag }; }
  reloadEnd = 0; if (vm) vm.setWeapon(curW(), game.color);
  shell.send({ t: 'wpn', w: slots()[cur] }); renderSlots();
}
function switchTo(i) {
  if (i === cur && vm.gun) return;
  if (i === 3 && nadeCount <= 0) { shell.toast('💣 수류탄이 없어요 (부활하면 다시 1개)', 900); return; }
  cur = i; reloadEnd = 0; vm.setWeapon(curW(), game.color); sfx('switch');
  shell.send({ t: 'wpn', w: slots()[cur] }); renderSlots();
}
function reload() {
  const w = curW(), a = ammo[w.id];
  if (!a || reloadEnd || a.mag >= w.mag) return;
  reloadEnd = performance.now() + w.reload * 1000; vm.reload(w.reload); sfx('reload');
}

// ---------- 입력 ----------
const keys = new Set(); let mouseL = false, mouseR = false;
const locked = () => !!game.testLock || document.pointerLockElement === $('c'); // testLock: 점검용 (마우스 잠금 없이)
function lock() { unlock(); $('c').requestPointerLock?.(); }
document.addEventListener('pointerlockchange', () => { if (game.mode === 'play') $('lockmsg').classList.toggle('hidden', locked() || !$('loadout').classList.contains('hidden')); });
$('c').addEventListener('click', () => { if (game.mode === 'play' && !locked()) lock(); });
$('lock-btn').onclick = lock;
$('loadout-btn').onclick = () => openLoadout();
$('quit-btn').onclick = () => quit();
document.addEventListener('mousemove', (e) => {
  if (!locked() || game.mode !== 'play') return;
  const s = 0.0022 * game.sens * (mouseR ? 0.55 * (curW()?.scope ? 0.35 : 1) : 1);
  me.yaw -= e.movementX * s; me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch - e.movementY * s));
});
document.addEventListener('mousedown', (e) => { if (!locked()) return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) { mouseL = false; fireLatch = false; } if (e.button === 2) mouseR = false; });
document.addEventListener('contextmenu', (e) => { if (game.mode === 'play') e.preventDefault(); });
document.addEventListener('wheel', (e) => { if (game.mode === 'play' && locked() && me.alive) switchTo((cur + (e.deltaY > 0 ? 1 : 3)) % 4); });
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (game.mode !== 'play') return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') { $('scoreboard').classList.remove('hidden'); renderBoard(); return; }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyR') reload();
  if (/^Digit[1-4]$/.test(e.code) && me.alive) switchTo(+e.code.slice(5) - 1);
  if (e.code === 'KeyQ' && me.alive) switchTo(cur === 0 ? 1 : 0);
  if (e.code === 'KeyG' && me.alive && nadeCount > 0) { const was = cur; switchTo(3); throwNade(); setTimeout(() => switchTo(was === 3 ? 0 : was), 400); }
  if (e.code === 'KeyB') openLoadout();
  if (e.code === 'KeyM') muteBtn();
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Tab') $('scoreboard').classList.add('hidden'); });
window.addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
function muteBtn() { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn;
$('b-mute').textContent = sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => quit();

// ---------- 처음 화면 · 방 ----------
const describe = (o = {}) => { const m = mapById(o.map); return `${m.emoji} ${m.name} · ${o.mode === 'ffa' ? '개인전' : '팀 데스매치'} · 봇 ${o.bots ?? 0}`; };
function optsUI(el, o, editable, set) {
  el.innerHTML = `<div class="map-pick">${MAPS.map((m) => `<button data-m="${m.id}" class="${m.id === o.map ? 'on' : ''}" ${editable ? '' : 'disabled'}><b>${m.emoji}</b>${esc(m.name)}</button>`).join('')}</div>
    <div class="seg"><button data-mode="tdm" class="${o.mode !== 'ffa' ? 'on' : ''}" ${editable ? '' : 'disabled'}>👥 팀 데스매치</button><button data-mode="ffa" class="${o.mode === 'ffa' ? 'on' : ''}" ${editable ? '' : 'disabled'}>🎯 개인전</button></div>
    <div class="bots-row">🤖 봇 ${editable ? '<button data-b="-1">−</button>' : ''}<b>${o.bots ?? 0}</b>${editable ? '<button data-b="1">＋</button>' : ''}</div>`;
  el.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => set({ map: b.dataset.m }); });
  el.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => set({ mode: b.dataset.mode }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(10, (o.bots ?? 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (o) => { Object.assign(game.pick, o); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); previewMap(); }); }
const shell = new Shell({
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; } },
  key: 'jellyattack', title: '🔫 젤리어택', subtitle: '젤리시티 무기로 겨루는 곰돌이 팀 슈팅!<br>딸기팀 vs 소다팀', wsPath: '/attack-ws', max: 12,
  multiLabel: '👥 같이 하기', roomIcon: '🔫', startLabel: '🔫 작전 시작!',
  keysHelp: 'WASD 이동 · 마우스 조준 · 클릭 사격 · 우클릭 조준경 · R 장전 · 1~4 무기 · G 수류탄 · Space 점프 · Shift 달리기 · C/Ctrl 앉기 · Tab 점수 · B 무기 고르기',
  buttons: [{ id: 'practice-btn', label: '🎯 연습전 <small>봇과 바로 대결</small>', onClick: () => practice() }],
  extraRow: [{ label: '🎒 무기 고르기', onClick: () => openLoadout() }],
  screens: ['over', 'loadout'],
  describe,
  teamChat: (o) => o.mode !== 'ffa', // 팀 데스매치면 팀 채팅
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onProfile: (p) => { game.color = p.color; },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode === 'play') { shell.toast('🔧 서버 업데이트 중... 20초 안에 복구돼요. 잠시 뒤 다시 들어와 주세요', 5000); toTitle(); } },
});
shell.pickOpts = () => ({ map: game.pick.map, mode: game.pick.mode, bots: game.pick.bots });
function practice() {
  if (coarse) shell.toast('젤리어택은 키보드 · 마우스가 있는 PC에서 가장 잘 돼요', 2500);
  shell.sendAfterHello({ t: 'practice', opts: { map: game.pick.map, mode: game.pick.mode, bots: Math.max(1, game.pick.bots) } });
}
// 처음 화면 뒤: 고른 맵을 천천히 둘러본다
function previewMap() { loadMap(game.pick.map); }
function loadMap(id) {
  const m = mapById(id);
  if (game.map === m) return;
  game.world?.dispose();
  game.map = m; game.world = buildMap(scene, m);
}

// ---------- 무기 고르기 ----------
function openLoadout() {
  document.exitPointerLock?.();
  const card = (id, sel) => { const w = weapon(id); return `<button data-w="${id}" class="${id === sel ? 'on' : ''}"><b>${w.emoji} ${esc(w.name)}</b>${CLASS_NAME[w.cls]} · 탄창 ${w.mag}
    <div class="bar" title="위력"><i style="width:${Math.min(100, (w.dmg * (w.pellets || 1)) / 1.2)}%"></i></div><div class="bar" title="연사"><i style="width:${Math.min(100, 12 / w.rate)}%"></i></div><div class="bar" title="사거리"><i style="width:${Math.min(100, w.range / 1.4)}%"></i></div></button>`; };
  $('lo-primary').innerHTML = PRIMARY.map((id) => card(id, game.load.p)).join('');
  $('lo-secondary').innerHTML = SECONDARY.map((id) => card(id, game.load.s)).join('');
  $('lo-primary').querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { game.load.p = b.dataset.w; openLoadout(); }; });
  $('lo-secondary').querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { game.load.s = b.dataset.w; openLoadout(); }; });
  $('loadout').classList.remove('hidden'); $('lockmsg').classList.add('hidden');
}
$('lo-ok').onclick = () => {
  store.set(LOAD_KEY, JSON.stringify(game.load)); $('loadout').classList.add('hidden');
  if (game.mode === 'play') { if (!me.alive) shell.toast('🎒 다음 부활부터 새 무기를 들어요', 1400); else { armNew(); $('lockmsg').classList.remove('hidden'); } }
};

// ---------- 다른 곰돌이 ----------
const heldOf = (w) => (w?.cls === 'knife' ? 'knife' : w?.cls === 'nade' ? null : `${w?.held || 'rifle'}:#3a3d46`);
class Other {
  constructor(m) {
    this.id = m.id; this.name = m.name; this.team = m.team; this.color = m.color; this.bot = m.bot;
    const r = this.bear = new Roach({ own: true, seed: m.name, color: m.color || '#8a5634', age: 25, look: m.look, accessories: m.acc || [] });
    r.root.scale.setScalar(0.85); scene.add(r.root);
    this.tag = tag(m.name, game.opts.mode === 'tdm' ? TEAMS[m.team]?.color : null);
    scene.add(this.tag);
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.flags = 0; this.alive = true; this.lastPos = new THREE.Vector3(); this.flashT = 0; this.firedT = 0;
    this.setGun(m.gun || 'm4');
  }
  setGun(id) { this.gun = id; this.bear.setHeld(heldOf(weapon(id))); }
  set(st, snap) { const [x, y, z, yaw, pitch, f] = st; this.tgt.set(x, y, z); this.tyaw = yaw; this.pitch = pitch; this.flags = f; if (snap) { this.pos.copy(this.tgt); this.yaw = yaw; } }
  update(dt) {
    const k = Math.min(1, dt * 14);
    if (this.pos.distanceTo(this.tgt) > 6) this.pos.copy(this.tgt); else this.pos.lerp(this.tgt, k);
    let d = (this.tyaw ?? this.yaw) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k;
    const sp = this.pos.distanceTo(this.lastPos) / Math.max(dt, 1e-3); this.lastPos.copy(this.pos);
    const b = this.bear;
    b.root.position.copy(this.pos); b.root.rotation.y = this.yaw + Math.PI;
    b.root.visible = this.alive;
    b.update(dt, Math.min(9, sp), { noCrawl: true });
    // 총을 들고 겨누는 자세
    b.arms[1].rotation.x = -1.45 - this.pitch; b.arms[1].rotation.z = b.arms[1].userData.baseZ * 0.3;
    b.arms[0].rotation.x = -1.3 - this.pitch; b.arms[0].rotation.z = b.arms[0].userData.baseZ * 0.2 + 0.5;
    const crouch = this.flags & 1; b.root.scale.y = 0.85 * (crouch ? 0.75 : 1);
    this.tag.position.set(this.pos.x, this.pos.y + (crouch ? 1.75 : 2.2), this.pos.z); this.tag.visible = this.alive;
    this.firedT -= dt;
  }
  remove() { scene.remove(this.bear.root, this.tag); }
  // 맞았나: 머리(공) · 몸(원기둥). 돌려주는 값 { t, part } 또는 null
  hit(o, d) {
    const crouch = this.flags & 1, p = this.pos;
    const hy = p.y + (crouch ? 1.2 : 1.62);
    let best = null;
    const oc = new THREE.Vector3(o.x - p.x, o.y - hy, o.z - p.z), bq = oc.dot(d), cq = oc.lengthSq() - 0.34 * 0.34, disc = bq * bq - cq;
    if (disc >= 0) { const t = -bq - Math.sqrt(disc); if (t > 0) best = { t, part: 'head' }; }
    const ax = o.x - p.x, az = o.z - p.z, A = d.x * d.x + d.z * d.z, Bq = 2 * (ax * d.x + az * d.z), C = ax * ax + az * az - 0.42 * 0.42, D = Bq * Bq - 4 * A * C;
    if (D >= 0 && A > 1e-6) { const t = (-Bq - Math.sqrt(D)) / (2 * A); const y = o.y + d.y * t; if (t > 0 && y > p.y + 0.1 && y < p.y + (crouch ? 1.0 : 1.38) && (!best || t < best.t)) best = { t, part: 'body' }; }
    return best;
  }
}
function tag(name, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.font = 'bold 28px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(250, x.measureText(name).width + 28);
  x.fillStyle = 'rgba(20,10,40,.6)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 22); x.fill();
  if (color) { x.strokeStyle = color; x.lineWidth = 5; x.stroke(); }
  x.fillStyle = '#fff'; x.fillText(name, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true }));
  s.scale.set(2.2, 0.55, 1); return s;
}
const enemy = (o) => o && (game.opts.mode !== 'tdm' || o.team !== game.team);

// ---------- 효과 ----------
const fx = [];
let _glow = null;
function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c)); }
function tracer(a, b, color = '#fff3b0') {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  scene.add(l); fx.push({ o: l, t: 0.08, life: 0.08, line: true });
}
function puff(p, color, n = 6, size = 0.25, spread = 2) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false }));
    s.scale.setScalar(size * (0.6 + Math.random())); s.position.copy(p); scene.add(s);
    fx.push({ o: s, t: 0.4, life: 0.4, v: new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread) });
  }
}
function updateFx(dt) {
  for (const f of fx) {
    f.t -= dt;
    if (f.v) { f.o.position.addScaledVector(f.v, dt); f.v.y -= 9 * dt; }
    f.o.material.opacity = Math.max(0, f.t / f.life);
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t <= 0) { scene.remove(fx[i].o); fx[i].o.geometry?.dispose?.(); fx.splice(i, 1); }
}
const muzzleWorld = () => new THREE.Vector3(0.2, -0.16, -0.8).applyMatrix4(camera.matrixWorld);

// ---------- 쏘기 ----------
function shoot(now) {
  const w = curW();
  if (!w || !me.alive) return;
  if (w.cls === 'nade') { if (!fireLatch) { fireLatch = true; throwNade(); } return; }
  if (w.cls === 'knife') { if (now < nextFire || fireLatch) return; fireLatch = true; nextFire = now + w.rate * 1000; return knife(); }
  if (reloadEnd || now < nextFire || (!w.auto && fireLatch)) return;
  const a = ammo[w.id];
  if (!a) return armNew();
  if (a.mag <= 0) { if (!fireLatch) sfx('dry'); fireLatch = true; reload(); return; }
  fireLatch = true; nextFire = now + w.rate * 1000;
  a.mag--;
  const eye = me.eye(), fwd = me.forward();
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  let spread = w.cls === 'sniper' ? (mouseR ? w.spread : 0.07) : w.spread * (mouseR ? 0.45 : 1);
  spread += (moving ? w.move : 0) + (me.onGround ? 0 : 0.06) - (me.crouch > 0.5 ? spread * 0.3 : 0);
  const n = w.pellets || 1, hits = new Map(), end = muzzleWorld();
  for (let i = 0; i < n; i++) {
    const s = n > 1 ? w.pspread : spread;
    const d = fwd.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s)).normalize();
    const wallT = rayBoxes(game.map, eye, d, 300);
    let best = null;
    for (const o of game.others.values()) { if (!o.alive || !enemy(o)) continue; const h = o.hit(eye, d); if (h && h.t < wallT && (!best || h.t < best.h.t)) best = { o, h }; }
    const t = best ? best.h.t : Math.min(wallT, 300), p = eye.clone().addScaledVector(d, t);
    tracer(end, p, w.tracer);
    if (best) { const e = hits.get(best.o) || { n: 0, head: false }; e.n++; if (best.h.part === 'head') e.head = true; hits.set(best.o, e); puff(p, best.o.color, 5, 0.22, 3); }
    else if (wallT < 300) puff(p, '#d8cbb0', 4, 0.18, 1.5);
  }
  sfx('gun', w.cls, 1);
  vm.kick(0.5 + w.recoil[0] * 6);
  const kp = w.recoil[0] * (mouseR ? 0.7 : 1);
  me.pitch = Math.min(1.45, me.pitch + kp); kickBack += kp * 0.55; me.yaw += (Math.random() - 0.5) * w.recoil[1] * 2;
  shell.send({ t: 'fire', w: w.id, o: [eye.x, eye.y, eye.z], d: [fwd.x, fwd.y, fwd.z] });
  for (const [o, e] of hits) shell.send({ t: 'hit', to: o.id, w: w.id, part: e.head ? 'head' : 'body', n: e.n });
  if (a.mag <= 0) setTimeout(reload, 200);
}
function knife() {
  vm.swing(); sfx('knife');
  const eye = me.eye(), fwd = me.forward();
  let best = null, bd = KNIFE.range;
  for (const o of game.others.values()) {
    if (!o.alive || !enemy(o)) continue;
    const to = o.pos.clone().setY(o.pos.y + 1).sub(eye), d = to.length();
    if (d < bd && to.normalize().dot(fwd) > 0.6) { bd = d; best = o; }
  }
  if (!best) return;
  // 등 뒤에서 찌르면 한 방
  const back = Math.cos(best.yaw - me.yaw) > 0.4;
  puff(best.pos.clone().setY(best.pos.y + 1.1), best.color, 8, 0.25, 3);
  shell.send({ t: 'hit', to: best.id, w: 'knife', part: 'body', back });
}
// 수류탄: 던져서 튕기다가 터진다 (터진 곳을 서버에 알린다)
const nades = [];
function throwNade() {
  if (nadeCount <= 0 || !me.alive) return;
  nadeCount--; renderSlots(); vm.swing(); sfx('throw');
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshToonMaterial({ color: game.color || '#ff8fc4' }));
  const p = me.eye().addScaledVector(me.forward(), 0.5); m.position.copy(p); scene.add(m);
  nades.push({ m, v: me.forward().multiplyScalar(17).add(new THREE.Vector3(0, 4, 0)), t: NADE.fuse });
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i], p = n.m.position;
    n.v.y -= 18 * dt;
    const step = n.v.clone().multiplyScalar(dt), L = step.length();
    if (L > 0) { const d = step.clone().divideScalar(L), wt = rayBoxes(game.map, p, d, L + 0.15); if (wt < L + 0.15) { n.v.x *= -0.4; n.v.z *= -0.4; step.set(0, step.y, 0); } }
    p.add(step);
    if (p.y < 0.13) { p.y = 0.13; n.v.y = Math.abs(n.v.y) * 0.35; n.v.x *= 0.7; n.v.z *= 0.7; }
    n.t -= dt;
    if (n.t <= 0) { shell.send({ t: 'nade', p: [p.x, p.y, p.z] }); scene.remove(n.m); nades.splice(i, 1); }
  }
}

// ---------- 시작 · 메시지 ----------
function start(m) {
  game.opts = m.opts; game.mode = 'play';
  for (const o of game.others.values()) o.remove();
  game.others.clear(); game.stats.clear(); game.score = { red: 0, blue: 0 };
  game.myId = shell.myId; loadMap(m.map);
  game.endAt = performance.now() + m.in + m.dur * 1000; game.limit = m.limit;
  for (const mem of m.members) {
    game.stats.set(mem.id, { name: mem.name, team: mem.team, color: mem.color, k: 0, d: 0, bot: mem.bot });
    if (mem.id === game.myId) { game.team = mem.team; continue; }
    const o = new Other({ ...mem, gun: m.guns?.[mem.id] }); game.others.set(mem.id, o);
    if (m.spawns?.[mem.id]) o.set(m.spawns[mem.id], true);
  }
  const sp = m.spawns?.[game.myId];
  if (sp) spawnMe(sp);
  vm = new ViewModel(game.color); cur = 0; vm.setWeapon(curW(), game.color);
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('death').classList.add('hidden');
  $('top').classList.toggle('ffa', m.opts.mode !== 'tdm');
  banner(`${game.map.emoji} ${game.map.name} · ${m.opts.mode === 'tdm' ? `${TEAMS[game.team]?.name || ''}` : '개인전'}`);
  if (!locked()) $('lockmsg').classList.remove('hidden');
  renderSlots();
}
function spawnMe(p) {
  me.pos.set(p[0], p[1], p[2]); me.yaw = p[3]; me.pitch = 0; me.vel.set(0, 0, 0); me.alive = true; me.hp = 100;
  refill(); cur = 0; reloadEnd = 0; if (vm) vm.setWeapon(curW(), game.color);
  $('death').classList.add('hidden'); sfx('spawn'); renderSlots();
  shell.send({ t: 'wpn', w: slots()[0] });
}
shell.on('snap', (m) => { for (const [id, ...st] of m.p) { if (id === game.myId) continue; const o = game.others.get(id); if (o) o.set(st); } });
shell.on('spawn', (m) => {
  if (m.id === game.myId) return spawnMe(m.p);
  const o = game.others.get(m.id); if (!o) return;
  o.alive = true; o.set(m.p, true); if (m.gun) o.setGun(m.gun);
});
shell.on('wpn', (m) => { game.others.get(m.id)?.setGun(m.w); });
shell.on('fire', (m) => {
  const o = game.others.get(m.by); if (!o || !Array.isArray(m.o)) return;
  const w = weapon(m.w); o.firedT = 0.8;
  const eye = new THREE.Vector3(...m.o), d = new THREE.Vector3(...m.d).normalize();
  const t = rayBoxes(game.map, eye, d, 250), start = eye.clone().addScaledVector(d, 0.7); start.y -= 0.25;
  tracer(start, eye.clone().addScaledVector(d, t), w?.tracer);
  const dist = eye.distanceTo(me.eye());
  sfx('gun', w?.cls, Math.max(0.05, 1 - dist / 90) * 0.8);
  // 내 옆을 스쳐 지나가면 '휙'
  const toMe = me.eye().sub(eye), along = toMe.dot(d);
  if (along > 0 && along < t && toMe.addScaledVector(d, -along).length() < 1.5 && m.by !== game.myId) sfx('whizz');
});
shell.on('dmg', (m) => {
  if (m.to === game.myId) {
    me.hp = m.hp; sfx('hurt');
    $('hurt').style.opacity = '1'; clearTimeout(game.hurtT); game.hurtT = setTimeout(() => { $('hurt').style.opacity = '0'; }, 250);
    if (m.p) dirMark(m.p);
  }
  if (m.by === game.myId && m.to !== game.myId) { sfx(m.head ? 'head' : 'hit'); const h = $('hitmark'); h.classList.toggle('head', !!m.head); h.classList.remove('hidden'); clearTimeout(game.hitT); game.hitT = setTimeout(() => h.classList.add('hidden'), 140); }
});
shell.on('kill', (m) => {
  const K = game.stats.get(m.by), V = game.stats.get(m.to);
  if (K && m.by !== m.to) K.k++; if (V) V.d++;
  if (m.score) game.score = m.score;
  const w = weapon(m.w);
  const row = document.createElement('div');
  row.className = m.by === game.myId || m.to === game.myId ? 'me' : '';
  const nm = (s) => `<span style="color:${s && game.opts.mode === 'tdm' ? TEAMS[s.team]?.color : '#fff'}">${esc(s?.name || '?')}</span>`;
  row.innerHTML = `${nm(K)} ${w?.emoji || '💥'}${m.head ? '🎯' : ''} ${nm(V)}`;
  $('feed').prepend(row); setTimeout(() => row.remove(), 5000);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
  const o = game.others.get(m.to); if (o) { o.alive = false; puff(o.pos.clone().setY(o.pos.y + 1), o.color, 14, 0.35, 4); }
  if (m.to === game.myId) { me.alive = false; sfx('die'); showDeath(K); }
  if (m.by === game.myId && m.to !== game.myId) { sfx('kill'); if (m.head) banner('🎯 헤드샷!'); }
});
shell.on('boom', (m) => {
  const p = new THREE.Vector3(...m.p);
  puff(p, '#ffb36b', 24, 0.9, 9); puff(p, '#ffffff', 10, 1.4, 4);
  sfx('boom', null, Math.max(0.1, 1 - p.distanceTo(me.eye()) / 80));
});
shell.on('gone', (m) => { game.others.get(m.id)?.remove(); game.others.delete(m.id); });
function showDeath(K) {
  $('death').classList.remove('hidden');
  $('death-by').textContent = K ? `💥 ${K.name}에게 당했어요` : '💥 쓰러졌어요';
  game.deadAt = performance.now();
}
function dirMark(p) {
  const ang = Math.atan2(-(p[0] - me.pos.x), -(p[1] - me.pos.z)) - me.yaw;
  const i = document.createElement('i'); i.style.transform = `translate(-50%, -120px) rotate(${-ang}rad)`;
  $('dirs').appendChild(i); setTimeout(() => i.remove(), 1200);
}
function banner(text) { const b = $('banner'); b.classList.add('hidden'); void b.offsetWidth; b.textContent = text; b.classList.remove('hidden'); clearTimeout(game.bannerT); game.bannerT = setTimeout(() => b.classList.add('hidden'), 1600); }

// ---------- 결과 · 나가기 ----------
function results(m) {
  game.mode = 'over'; document.exitPointerLock?.();
  for (const id of ['hud', 'death', 'lockmsg', 'scoreboard', 'scope']) $(id).classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  const won = m.team ? m.team.winner === game.team : mine?.rank === 1;
  $('ov-title').textContent = m.team ? (m.team.winner === 'draw' ? '🤝 무승부!' : `🏆 ${TEAMS[m.team.winner].name} 승리!`) : `🏆 ${m.rank[0]?.name} 우승!`;
  $('ov-me').textContent = mine ? `${won ? '이겼어요! 🎉' : '아쉽게 졌어요'} · ${mine.k}킬 ${mine.d}데스${m.team ? ` · ${TEAMS.red.name} ${m.team.red} : ${m.team.blue} ${TEAMS.blue.name}` : ''}` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span><span class="nm"><span class="dot" style="background:${e.team ? TEAMS[e.team].color : esc(e.color)}"></span>${e.bot ? '🤖 ' : ''}${esc(e.name)}</span><span class="sc">${e.k}<small>킬 · ${e.d}데스</small></span></div>`).join('');
  sfx(won ? 'win' : 'lose');
  shell.show('over');
}
$('again-btn').onclick = () => { game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() {
  game.mode = 'title'; shell.multi = false; shell.playing = false; document.exitPointerLock?.();
  for (const id of ['hud', 'death', 'lockmsg', 'scoreboard', 'scope', 'loadout']) $(id).classList.add('hidden');
  for (const o of game.others.values()) o.remove(); game.others.clear();
  shell.show('title'); renderTitleOpts(); previewMap();
}

// ---------- 화면 표시 ----------
function renderSlots() {
  const s = slots().map((id, i) => { const w = weapon(id); return `<span class="${i === cur ? 'on' : ''}">${i + 1} ${w.emoji}${i === 3 ? ` ×${nadeCount}` : ''}</span>`; });
  $('slots').innerHTML = s.join('');
}
function hud(now) {
  const w = curW(), a = ammo[w?.id];
  $('hp-n').textContent = Math.max(0, Math.round(me.hp)); $('hp-bar').firstElementChild.style.width = `${Math.max(0, me.hp)}%`;
  $('w-name').textContent = `${w?.emoji || ''} ${w?.name || ''}${reloadEnd ? ' · 장전 중…' : ''}`;
  $('ammo-n').textContent = a ? a.mag : w?.cls === 'nade' ? nadeCount : '∞'; $('ammo-r').textContent = a ? '/ ∞' : '';
  const left = Math.max(0, (game.endAt - now) / 1000);
  $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  if (game.opts?.mode === 'tdm') { $('sc-red').textContent = `${TEAMS.red.name} ${game.score.red}`; $('sc-blue').textContent = `${game.score.blue} ${TEAMS.blue.name}`; $('sc-red').classList.remove('hidden'); $('sc-blue').classList.remove('hidden'); }
  else { const mine = game.stats.get(game.myId); $('sc-red').textContent = `🎯 ${mine?.k || 0} / ${game.limit}킬`; $('sc-blue').classList.add('hidden'); }
  // 조준점: 퍼지는 만큼 벌어진다
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  const gap = 6 + (mouseR ? 0 : 6) + (moving ? 10 : 0) + (me.onGround ? 0 : 12) + vm.kickT * 14;
  const c = $('cross'); c.classList.toggle('ads', mouseR && w?.cls !== 'knife');
  c.querySelector('.u').style.bottom = c.querySelector('.d').style.top = c.querySelector('.l').style.right = c.querySelector('.r').style.left = `${gap}px`;
  c.classList.toggle('hidden', !me.alive || !!(w?.scope && mouseR)); // 죽었거나 조준경을 보면 조준점은 숨긴다
  $('scope').classList.toggle('hidden', !(w?.scope && mouseR && me.alive));
  if (!me.alive) $('death-t').textContent = Math.max(0, Math.ceil(3 - (now - game.deadAt) / 1000)) || '';
  drawRadar();
}
function drawRadar() {
  const x = $('radar').getContext('2d'), S = 150, sc = 1.6;
  x.clearRect(0, 0, S, S);
  x.save(); x.translate(S / 2, S / 2);
  x.strokeStyle = 'rgba(255,255,255,.15)'; x.beginPath(); x.arc(0, 0, 70, 0, 7); x.stroke();
  for (const o of game.others.values()) {
    if (!o.alive) continue;
    const friend = !enemy(o);
    if (!friend && o.firedT <= 0) continue; // 적은 총을 쏠 때만 보인다
    const dx = o.pos.x - me.pos.x, dz = o.pos.z - me.pos.z;
    // 내가 보는 쪽이 위
    const c = Math.cos(me.yaw), s = Math.sin(me.yaw), rx = (dx * c - dz * s) * sc, ry = (dx * s + dz * c) * sc;
    if (Math.hypot(rx, ry) > 70) continue;
    x.fillStyle = friend ? '#7cd8ff' : '#ff5a7a'; x.beginPath(); x.arc(rx, ry, 4.5, 0, 7); x.fill();
  }
  x.fillStyle = '#ffd84d'; x.beginPath(); x.moveTo(0, -8); x.lineTo(5, 6); x.lineTo(-5, 6); x.closePath(); x.fill();
  x.restore();
}
function renderBoard() {
  const rows = [...game.stats.entries()].map(([id, s]) => ({ id, ...s })).sort((a, b) => b.k - a.k || a.d - b.d);
  const table = (list) => `<table><tr><th>이름</th><th>킬</th><th>데스</th></tr>${list.map((r) => `<tr class="${r.id === game.myId ? 'me' : ''}"><td>${r.bot ? '🤖 ' : ''}${esc(r.name)}</td><td>${r.k}</td><td>${r.d}</td></tr>`).join('')}</table>`;
  $('scoreboard').innerHTML = game.opts?.mode === 'tdm'
    ? `<div class="cols">${['red', 'blue'].map((t) => `<div><h3 style="color:${TEAMS[t].color}">${TEAMS[t].name} ${game.score[t]}</h3>${table(rows.filter((r) => r.team === t))}</div>`).join('')}</div>`
    : `<h3>🎯 개인전 · 먼저 ${game.limit}킬</h3>${table(rows)}`;
}

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let t = 0, sendT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), now = performance.now();
  t += dt;
  if (game.mode === 'play') {
    if (reloadEnd && now >= reloadEnd) { const w = curW(), a = ammo[w.id]; if (a) a.mag = w.mag; reloadEnd = 0; }
    const typing = !locked();
    const inp = { f: typing ? 0 : (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s: typing ? 0 : (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), jump: keys.has('Space'), crouch: keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight'), sprint: (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !mouseL, ads: mouseR };
    if (me.alive) {
      for (const e of me.update(dt, inp, game.map)) sfx(e, null, e === 'step' ? 0.6 : 1);
      if (mouseL && locked()) shoot(now);
      // 반동 회복
      if (kickBack > 0) { const r = Math.min(kickBack, dt * 1.2); me.pitch -= r; kickBack -= r; }
    }
    updateNades(dt);
    for (const o of game.others.values()) o.update(dt);
    // 카메라: 살아 있으면 눈, 죽으면 그 자리에서 천천히 내려다본다
    const eye = me.eye();
    camera.position.copy(eye); camera.rotation.set(me.alive ? me.pitch : -0.5, me.yaw, 0);
    const w = curW(), zoom = mouseR && me.alive && w?.cls !== 'knife' && w?.cls !== 'nade' ? (w.scope ? w.zoom : Math.min(1.6, w.zoom)) : 1;
    const fov = (me.sprinting && me.alive ? 80 : 72) / zoom; // 달릴 때 시야가 살짝 넓어진다
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
    vm.update(dt, camera.aspect, Math.hypot(me.vel.x, me.vel.z) > 1.5 && me.onGround, mouseR && me.alive, t);
    sendT -= dt;
    if (sendT <= 0) { sendT = 0.05; const f = (me.crouch > 0.5 ? 1 : 0) | (mouseR ? 2 : 0); if (me.alive) shell.send({ t: 'st', p: [me.pos.x, me.pos.y, me.pos.z, me.yaw, me.pitch, f] }); }
    hud(now);
  } else if (game.map) {
    // 처음 화면 · 결과: 맵 위를 천천히 돈다
    const a = t * 0.06, R = Math.max(game.map.W, game.map.D) * 0.55;
    camera.position.set(Math.cos(a) * R, 26, Math.sin(a) * R); camera.lookAt(0, 0, 0);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
  }
  updateFx(dt);
  renderer.clear();
  renderer.render(scene, camera);
  if (game.mode === 'play' && me.alive) vm.render(renderer);
}

// ---------- 시작 ----------
renderTitleOpts(); previewMap();
shell.boot();
frame();
