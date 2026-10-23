// 젤리배그: 젤리어택의 무기 · 몸놀림 그대로 배틀로얄로 (최대 30명 · 젤리봇으로 채우기)
//   젤리 비행선 → 뛰어내리기(F) → 낙하산 → 착지 → 줍기(E) → 싸우기 → 줄어드는 젤리 자기장 → 마지막 한 명 '이겼젤!'
import * as THREE from 'three';
import { store } from '../../shared/js/account.js';
import { openSens, sensOf } from '../../shared/js/sens.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { Roach } from '../../shared/js/roach.js';
import { confetti } from '../../shared/js/party.js';
import { rayBoxes, floorAt } from './maps.js';
import { makeBgMap, PLACES, BG_SIZE } from './bgmap.js';
import { HEALS, DROP, zoneAt, planeAt, itemLabel, emptyInv, ARMOR_NAME } from './bgrules.js';
import { weapon, KNIFE, NADE } from './weapons.js';
import { buildMap } from './world.js';
import { Player, ViewModel, gunModel } from './fps.js';
import { sfx, unlock, toggleMute, sound } from './sound.js';

const $ = (id) => document.getElementById(id);
const PICK_KEY = 'jellybg.pick';
const MAP = makeBgMap();

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1400);
camera.rotation.order = 'YXZ';
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const world = buildMap(scene, MAP);

const me = new Player();
let vm = new ViewModel('#8a5634');
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.bg = {
  me, mode: 'title', myId: 0, others: new Map(), loot: new Map(), inv: emptyInv(), zones: null, plane: null, t0: 0, alive: 0, total: 0, kills: 0, place: 0,
  pick: { fill: pick0.fill ?? 24 }, watch: null, color: '#8a5634', fall: null,
};
const sec = () => (performance.now() - game.t0) / 1000;

// ---------- 무기 칸: 1 · 2 주무기 · 3 권총 · 4 나이프 · 5 수류탄 ----------
let cur = 3, ammo = {}, nextFire = 0, reloadEnd = 0, fireLatch = false, kickBack = 0;
const slotIds = () => [game.inv.guns[0], game.inv.guns[1], game.inv.pistol, 'knife', game.inv.nade > 0 ? 'nade' : null];
const curW = () => weapon(slotIds()[cur]) || KNIFE;
function ensureAmmo() { for (const id of slotIds()) { const w = id && weapon(id); if (w?.mag && !ammo[id]) ammo[id] = { mag: w.mag }; } }
function switchTo(i) {
  const ids = slotIds(); if (!ids[i] || (i === cur && vm.gun)) return;
  cur = i; reloadEnd = 0; cancelHeal(); vm.setWeapon(curW(), game.color); sfx('switch');
  shell.send({ t: 'wpn', w: ids[i] }); renderSlots();
}
function reload() { const w = curW(), a = ammo[w.id]; if (!a || reloadEnd || a.mag >= w.mag) return; reloadEnd = performance.now() + w.reload * 1000; vm.reload(w.reload); sfx('reload'); }

// ---------- 입력 ----------
const keys = new Set(); let mouseL = false, mouseR = false, bigMap = false;
const locked = () => !!game.testLock || document.pointerLockElement === $('c');
function lock() { unlock(); $('c').requestPointerLock?.(); }
document.addEventListener('pointerlockchange', () => { if (game.mode !== 'title' && game.mode !== 'over') $('lockmsg').classList.toggle('hidden', locked() || game.mode === 'dead'); });
$('c').addEventListener('click', () => { if (game.mode === 'dead') return cycleWatch(); if (game.mode !== 'title' && game.mode !== 'over' && !locked()) lock(); });
$('lock-btn').onclick = lock; $('sens-btn').onclick = () => openSens('bg'); $('quit-btn').onclick = () => quit();
document.addEventListener('mousemove', (e) => {
  if (!locked() || game.mode === 'title' || game.mode === 'over') return;
  const s = 0.0022 * sensOf('bg') * (mouseR ? 0.55 * (curW()?.scope ? 0.35 : 1) : 1);
  me.yaw -= e.movementX * s; me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch - e.movementY * s));
});
document.addEventListener('mousedown', (e) => { if (!locked()) return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) { mouseL = false; fireLatch = false; } if (e.button === 2) mouseR = false; });
document.addEventListener('contextmenu', (e) => { if (game.mode !== 'title') e.preventDefault(); });
document.addEventListener('wheel', (e) => { if (game.mode === 'ground' && locked()) { const ids = slotIds(); for (let k = 1; k <= 5; k++) { const i = (cur + (e.deltaY > 0 ? k : 5 - k)) % 5; if (ids[i]) { switchTo(i); break; } } } });
addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (game.mode === 'title' || game.mode === 'over') return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyM') { bigMap = !bigMap; $('bigmap').classList.toggle('hidden', !bigMap); }
  if (game.mode === 'plane' && (e.code === 'KeyF' || e.code === 'Space')) return jump();
  if (game.mode === 'dead' && e.code === 'Space') return cycleWatch();
  if (game.mode !== 'ground') return;
  if (e.code === 'KeyR') reload();
  if (/^Digit[1-5]$/.test(e.code)) switchTo(+e.code.slice(5) - 1);
  if (e.code === 'KeyQ') switchTo(cur === 0 ? 1 : 0);
  if (e.code === 'KeyE') pickUp();
  if (e.code === 'Digit7') startHeal('band');
  if (e.code === 'Digit8') startHeal('med');
  if (e.code === 'KeyG' && game.inv.nade > 0) { const was = cur; cur = 4; throwNade(); cur = was; }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
function muteBtn() { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (game.mode !== 'dead' && !confirm('젤리배그에서 나갈까요?')) return; quit(); };

// ---------- 다른 곰돌이 ----------
const chuteM = new THREE.MeshToonMaterial({ color: '#ff8fc4', transparent: true, opacity: 0.85, side: THREE.DoubleSide });
function makeChute(color) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), color ? new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }) : chuteM);
  dome.position.y = 4.2; g.add(dome);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })); hl.position.set(-0.8, 5.6, 0.6); hl.scale.set(1, 0.4, 0.6); g.add(hl);
  const line = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 });
  for (const [x, z] of [[-1.8, 0], [1.8, 0], [0, -1.8], [0, 1.8]]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 4.3, z), new THREE.Vector3(0, 1.6, 0)]), line));
  g.visible = false; return g;
}
const heldOf = (w) => (w?.cls === 'knife' ? 'knife' : w?.cls === 'nade' ? null : `${w?.held || 'rifle'}:#3a3d46`);
class Other {
  constructor(m) {
    this.id = m.id; this.name = m.name; this.color = m.color; this.bot = m.bot; this.jumped = false;
    const r = this.bear = new Roach({ own: true, seed: m.name, color: m.color || '#8a5634', age: 25, look: m.look, accessories: m.acc || [] });
    r.root.scale.setScalar(0.85); scene.add(r.root);
    this.chute = makeChute(m.color); scene.add(this.chute);
    this.tag = tag(m.name); scene.add(this.tag);
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.flags = 8; this.alive = true; this.lastPos = new THREE.Vector3(); this.firedT = 0;
    this.setGun('knife');
  }
  setGun(id) { this.gun = id; this.bear.setHeld(heldOf(weapon(id) || KNIFE)); }
  set(st) { const [x, y, z, yaw, pitch, f] = st; this.tgt.set(x, y, z); this.tyaw = yaw; this.pitch = pitch; this.flags = f; if (this.pos.distanceTo(this.tgt) > 20) this.pos.copy(this.tgt); }
  get inAir() { return (this.flags & 12) !== 0; }
  update(dt) {
    const k = Math.min(1, dt * 12);
    this.pos.lerp(this.tgt, k);
    let d = (this.tyaw ?? this.yaw) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k;
    const sp = this.pos.distanceTo(this.lastPos) / Math.max(dt, 1e-3); this.lastPos.copy(this.pos);
    const b = this.bear, vis = this.alive && this.jumped;
    b.root.visible = vis; this.tag.visible = vis && !this.inAir;
    b.root.position.copy(this.pos); b.root.rotation.y = this.yaw + Math.PI;
    b.update(dt, this.inAir ? 0 : Math.min(9, sp), { noCrawl: true, airborne: this.inAir });
    if (this.inAir) { b.arms[0].rotation.x = b.arms[1].rotation.x = -2.6; }
    else { b.arms[1].rotation.x = -1.45 - this.pitch; b.arms[0].rotation.x = -1.3 - this.pitch; b.arms[0].rotation.z = b.arms[0].userData.baseZ * 0.2 + 0.5; }
    this.chute.visible = vis && (this.flags & 4) !== 0; this.chute.position.copy(this.pos);
    const crouch = this.flags & 1; b.root.scale.y = 0.85 * (crouch ? 0.75 : 1);
    this.tag.position.set(this.pos.x, this.pos.y + (crouch ? 1.75 : 2.2), this.pos.z);
    this.firedT -= dt;
  }
  remove() { scene.remove(this.bear.root, this.tag, this.chute); }
  hit(o, d) {
    if (!this.jumped || this.inAir) return null;
    const crouch = this.flags & 1, p = this.pos, hy = p.y + (crouch ? 1.2 : 1.62);
    let best = null;
    const oc = new THREE.Vector3(o.x - p.x, o.y - hy, o.z - p.z), bq = oc.dot(d), cq = oc.lengthSq() - 0.34 * 0.34, disc = bq * bq - cq;
    if (disc >= 0) { const t = -bq - Math.sqrt(disc); if (t > 0) best = { t, part: 'head' }; }
    const ax = o.x - p.x, az = o.z - p.z, A = d.x * d.x + d.z * d.z, Bq = 2 * (ax * d.x + az * d.z), C = ax * ax + az * az - 0.42 * 0.42, D = Bq * Bq - 4 * A * C;
    if (D >= 0 && A > 1e-6) { const t = (-Bq - Math.sqrt(D)) / (2 * A); const y = o.y + d.y * t; if (t > 0 && y > p.y + 0.1 && y < p.y + (crouch ? 1.0 : 1.38) && (!best || t < best.t)) best = { t, part: 'body' }; }
    return best;
  }
}
function tag(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.font = 'bold 28px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(250, x.measureText(name).width + 28);
  x.fillStyle = 'rgba(20,10,40,.6)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 22); x.fill(); x.fillStyle = '#fff'; x.fillText(name, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, transparent: true })); s.scale.set(2.2, 0.55, 1); return s;
}
// 내 곰돌이 (하늘에서 보이는 모습)
let myBear = null, myChute = null;
function makeMyBear(p) {
  if (myBear) scene.remove(myBear.root, myChute);
  myBear = new Roach({ own: true, seed: p.name, color: p.color, age: 25, look: p.look, accessories: p.acc || [] }); myBear.root.scale.setScalar(0.85); scene.add(myBear.root);
  myChute = makeChute(p.color); scene.add(myChute);
}

// ---------- 젤리 비행선 ----------
const ship = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshToonMaterial({ color: '#ff8fc4', transparent: true, opacity: 0.93 })); body.scale.set(5, 4.2, 14); ship.add(body);
  const hi = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 })); hi.scale.set(1.6, 0.8, 6); hi.position.set(-2.2, 2.6, 0); ship.add(hi);
  const gon = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 7), new THREE.MeshToonMaterial({ color: '#7cd8ff' })); gon.position.y = -5; ship.add(gon);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 3), new THREE.MeshToonMaterial({ color: '#ffd84d' })); f.position.set(s * 1.6, 1, 13); f.rotation.z = s * 0.6; ship.add(f); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 3), new THREE.MeshToonMaterial({ color: '#ffd84d' })); tail.position.set(0, 3.5, 13); ship.add(tail);
  ship.visible = false; scene.add(ship);
}

// ---------- 젤리 자기장 (파란 젤리 벽) ----------
const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.MeshBasicMaterial({ color: '#4c8dff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
zoneWall.visible = false; scene.add(zoneWall);
const zoneEdge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 6, 128), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
zoneEdge.rotation.x = Math.PI / 2; zoneEdge.visible = false; scene.add(zoneEdge);

// ---------- 바닥의 아이템 ----------
const LV_COL = ['#cccccc', '#9be7a7', '#7cd8ff', '#c39bff'];
let _glow = null;
function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c)); }
function lootMesh(it) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  let col = '#ffd84d';
  if (it.k === 'gun' || it.k === 'pistol') { const w = weapon(it.w); const gm = gunModel(w?.cls || 'rifle', '#ff8fc4'); gm.group.scale.setScalar(1.6); gm.group.rotation.y = Math.PI / 2; spin.add(gm.group); col = w?.cls === 'sniper' || w?.id === 'm249' || w?.id === 'barrett' ? '#c39bff' : '#ffd84d'; }
  else if (it.k === 'armor') { col = LV_COL[it.lv]; const v = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.25), new THREE.MeshToonMaterial({ color: col })); spin.add(v); const s = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.28), new THREE.MeshToonMaterial({ color: '#3a3d46' })); s.position.y = -0.1; spin.add(s); }
  else if (it.k === 'helmet') { col = LV_COL[it.lv]; const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: col })); spin.add(h); }
  else if (it.k === 'band') { col = '#ffffff'; const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), new THREE.MeshToonMaterial({ color: '#fff3f6' })); spin.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.04), new THREE.MeshToonMaterial({ color: '#ff5c8a' })); c.position.z = 0.15; spin.add(c); }
  else if (it.k === 'med') { col = '#ff5c8a'; const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), new THREE.MeshToonMaterial({ color: '#ff5c8a' })); spin.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.32), new THREE.MeshToonMaterial({ color: '#ffffff' })); spin.add(c); const c2 = c.clone(); c2.scale.set(0.3, 1, 1); c2.scale.x = 0.27; spin.add(c2); }
  else if (it.k === 'nade') { col = '#ffb36b'; spin.add(gunModel('nade', '#ff8fc4').group); spin.scale.setScalar(1.5); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.55, depthWrite: false })); glow.scale.setScalar(1.6); glow.position.y = 0.05; g.add(glow);
  spin.position.y = 0.45;
  g.position.set(it.x, it.y, it.z); g.userData.spin = spin;
  scene.add(g); return g;
}
function addLoot(list) { for (const it of list) { if (game.loot.has(it.id)) continue; game.loot.set(it.id, { ...it, mesh: lootMesh(it) }); } }
function removeLoot(ids) { for (const id of ids) { const it = game.loot.get(id); if (it) { scene.remove(it.mesh); game.loot.delete(id); } } }
function nearestLoot() {
  let best = null, bd = 2.6;
  for (const it of game.loot.values()) { const d = Math.hypot(it.x - me.pos.x, it.z - me.pos.z); if (d < bd && Math.abs(it.y - me.pos.y) < 2) { bd = d; best = it; } }
  return best;
}
function pickUp() { const it = nearestLoot(); if (!it) return; shell.send({ t: 'pick', id: it.id, slot: cur === 1 ? 1 : 0 }); sfx('switch'); }

// ---------- 회복 (붕대 3초 · 구급상자 6초, 움직이면 천천히) ----------
let healing = null;
function startHeal(k) {
  const H = HEALS[k]; if (!H || game.inv[k] <= 0 || healing) return;
  if (me.hp >= H.cap) { shell.toast(k === 'band' ? `🩹 붕대로는 ${H.cap}까지만 회복돼요` : '❤️ 이미 가득 찼어요', 1200); return; }
  healing = { k, end: performance.now() + H.sec * 1000, dur: H.sec * 1000 };
  $('heal-bar').classList.remove('hidden'); $('heal-txt').textContent = `${H.emoji} ${H.name} 쓰는 중…`;
}
function cancelHeal() { if (!healing) return; healing = null; $('heal-bar').classList.add('hidden'); }

// ---------- 효과 ----------
const fx = [];
function tracer(a, b, color = '#fff3b0') { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })); scene.add(l); fx.push({ o: l, t: 0.08, life: 0.08 }); }
function puff(p, color, n = 6, size = 0.25, spread = 2) { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false })); s.scale.setScalar(size * (0.6 + Math.random())); s.position.copy(p); scene.add(s); fx.push({ o: s, t: 0.4, life: 0.4, v: new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread) }); } }
function updateFx(dt) {
  for (const f of fx) { f.t -= dt; if (f.v) { f.o.position.addScaledVector(f.v, dt); f.v.y -= 9 * dt; } f.o.material.opacity = Math.max(0, f.t / f.life); }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t <= 0) { scene.remove(fx[i].o); fx[i].o.geometry?.dispose?.(); fx.splice(i, 1); }
}
const muzzleWorld = () => new THREE.Vector3(0.2, -0.16, -0.8).applyMatrix4(camera.matrixWorld);

// ---------- 쏘기 ----------
function shoot(now) {
  const w = curW();
  if (!w || game.mode !== 'ground') return;
  if (w.cls === 'nade') { if (!fireLatch) { fireLatch = true; throwNade(); } return; }
  if (w.cls === 'knife') { if (now < nextFire || fireLatch) return; fireLatch = true; nextFire = now + w.rate * 1000; return knife(); }
  if (reloadEnd || now < nextFire || (!w.auto && fireLatch)) return;
  ensureAmmo(); const a = ammo[w.id]; if (!a) return;
  if (a.mag <= 0) { if (!fireLatch) sfx('dry'); fireLatch = true; reload(); return; }
  cancelHeal();
  fireLatch = true; nextFire = now + w.rate * 1000; a.mag--;
  const eye = me.eye(), fwd = me.forward();
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  let spread = w.cls === 'sniper' ? (mouseR ? w.spread : 0.07) : w.spread * (mouseR ? 0.45 : 1);
  spread += (moving ? w.move : 0) + (me.onGround ? 0 : 0.06) - (me.crouch > 0.5 ? spread * 0.3 : 0);
  const n = w.pellets || 1, hits = new Map(), end = muzzleWorld();
  for (let i = 0; i < n; i++) {
    const s = n > 1 ? w.pspread : spread;
    const d = fwd.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s)).normalize();
    const wallT = rayBoxes(MAP, eye, d, 400);
    let best = null;
    for (const o of game.others.values()) { if (!o.alive) continue; const h = o.hit(eye, d); if (h && h.t < wallT && (!best || h.t < best.h.t)) best = { o, h }; }
    const t = best ? best.h.t : Math.min(wallT, 400), p = eye.clone().addScaledVector(d, t);
    tracer(end, p, w.tracer);
    if (best) { const e = hits.get(best.o) || { n: 0, head: false }; e.n++; if (best.h.part === 'head') e.head = true; hits.set(best.o, e); puff(p, best.o.color, 5, 0.22, 3); }
    else if (wallT < 400) puff(p, '#d8cbb0', 4, 0.18, 1.5);
  }
  sfx('gun', w.cls, 1); vm.kick(0.5 + w.recoil[0] * 6);
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
  for (const o of game.others.values()) { if (!o.alive || o.inAir) continue; const to = o.pos.clone().setY(o.pos.y + 1).sub(eye), d = to.length(); if (d < bd && to.normalize().dot(fwd) > 0.6) { bd = d; best = o; } }
  if (!best) return;
  const back = Math.cos(best.yaw - me.yaw) > 0.4;
  puff(best.pos.clone().setY(best.pos.y + 1.1), best.color, 8, 0.25, 3);
  shell.send({ t: 'hit', to: best.id, w: 'knife', part: 'body', back });
}
const nades = [];
function throwNade() {
  if (game.inv.nade <= 0) return;
  vm.swing(); sfx('throw');
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshToonMaterial({ color: game.color }));
  const p = me.eye().addScaledVector(me.forward(), 0.5); m.position.copy(p); scene.add(m);
  nades.push({ m, v: me.forward().multiplyScalar(17).add(new THREE.Vector3(0, 4, 0)), t: NADE.fuse });
  game.inv.nade--; renderSlots(); if (!slotIds()[cur]) switchTo(3);
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i], p = n.m.position;
    n.v.y -= 18 * dt;
    const step = n.v.clone().multiplyScalar(dt), L = step.length();
    if (L > 0) { const d = step.clone().divideScalar(L), wt = rayBoxes(MAP, p, d, L + 0.15); if (wt < L + 0.15) { n.v.x *= -0.4; n.v.z *= -0.4; step.set(0, step.y, 0); } }
    p.add(step);
    const fl = floorAt(MAP, p.x, p.z, p.y, 0.1) + 0.13;
    if (p.y < fl) { p.y = fl; n.v.y = Math.abs(n.v.y) * 0.35; n.v.x *= 0.7; n.v.z *= 0.7; }
    n.t -= dt;
    if (n.t <= 0) { shell.send({ t: 'nade', p: [p.x, p.y, p.z] }); scene.remove(n.m); nades.splice(i, 1); }
  }
}

// ---------- 흐름 ----------
function start(m) {
  game.mode = 'plane'; game.myId = shell.myId; game.zones = m.zones; game.plane = m.plane; game.t0 = performance.now() + m.in;
  game.total = m.total; game.alive = m.total; game.kills = 0; game.place = 0; game.inv = emptyInv(); game.watch = null;
  ammo = {}; cur = 3; reloadEnd = 0; healing = null; me.hp = 100; me.alive = true; me.vel.set(0, 0, 0); me.pitch = -0.25;
  for (const o of game.others.values()) o.remove(); game.others.clear();
  for (const it of game.loot.values()) scene.remove(it.mesh); game.loot.clear();
  for (const mem of m.members) if (mem.id !== game.myId) game.others.set(mem.id, new Other(mem));
  addLoot(m.loot);
  makeMyBear(shell.profile || { name: '나', color: game.color });
  vm = new ViewModel(game.color); vm.setWeapon(KNIFE, game.color);
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('spec').classList.add('hidden'); $('over').classList.add('hidden');
  ship.visible = true; zoneWall.visible = true; zoneEdge.visible = true;
  tip('🪂 F · Space 로 뛰어내려요', '젤리 비행선이 섬을 가로질러요. 끝까지 가면 자동으로 뛰어내려요');
  if (!locked()) $('lockmsg').classList.remove('hidden');
  renderSlots(); renderGear();
  banner(`🏝️ 젤리 섬 · ${m.total}명`);
}
function tip(a, b) { const t = $('phase-tip'); if (!a) { t.classList.add('hidden'); return; } t.innerHTML = `${a}${b ? `<small>${b}</small>` : ''}`; t.classList.remove('hidden'); }
function jump() {
  if (game.mode !== 'plane' || sec() < 0) return;
  const P = planeAt(game.plane, sec());
  game.mode = 'fall'; game.fall = { chute: false };
  me.pos.set(P.x, P.y - 6, P.z); me.vel.set(0, 0, 0); me.yaw = P.yaw;
  shell.send({ t: 'jump' }); sfx('jump');
  tip('🪂 WASD 로 내릴 곳을 골라요', `${Math.round(DROP.openAt)}m 아래에서 젤리 낙하산이 펴져요 · M 지도`);
}
function land() {
  game.mode = 'ground'; me.vel.set(0, 0, 0); me.onGround = true;
  myBear.root.visible = false; myChute.visible = false; sfx('land'); tip(null);
  banner('🍬 착지! E 로 줍기'); setTimeout(() => { if (game.mode === 'ground' && !game.inv.guns[0]) tip('🔎 집 안에 무기 · 방어구가 있어요', 'E 줍기 · 1~5 무기 · 7 붕대 · 8 구급상자 · G 수류탄 · M 지도'); }, 1600);
}
function onLoot(m) { removeLoot(m.rm || []); addLoot(m.add || []); }
function onInv(m) {
  const had = slotIds(); game.inv = m.inv; ensureAmmo();
  const ids = slotIds();
  if (!had[0] && !had[1] && (ids[0] || ids[1])) switchTo(ids[0] ? 0 : 1); // 첫 총은 바로 손에
  else if (!ids[cur]) switchTo(3);
  else if (had[cur] !== ids[cur]) { vm.setWeapon(curW(), game.color); shell.send({ t: 'wpn', w: ids[cur] }); }
  renderSlots(); renderGear();
  if (ids[0] || ids[1]) tip(null);
}
function cycleWatch() {
  const L = [...game.others.values()].filter((o) => o.alive && o.jumped);
  if (!L.length) return;
  game.watch = L[(L.indexOf(game.watch) + 1) % L.length]; sfx('switch');
}
function die(byName) {
  game.mode = 'dead'; me.alive = false; cancelHeal(); document.exitPointerLock?.();
  $('spec').classList.remove('hidden'); $('lockmsg').classList.add('hidden');
  $('spec-place').textContent = `#${game.place}등 · ${game.kills}킬`;
  banner(byName ? `💥 ${byName}에게 당했어요` : '🌀 젤리 자기장에 녹았어요');
  cycleWatch(); sfx('die');
}
function results(m) {
  game.mode = 'over'; document.exitPointerLock?.();
  for (const id of ['hud', 'lockmsg', 'spec', 'bigmap', 'scope']) $(id).classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId), won = mine?.rank === 1;
  const out = !won && game.alive > 1; // 연습에서 내가 떨어지면 남은 봇끼리는 끝까지 안 겨룬다
  $('ov-title').innerHTML = won ? '🍬 이겼젤! 오늘 간식은 젤리다!' : out ? `💥 #${mine?.rank || game.place}등으로 탈락!` : `🏆 ${esc(m.rank[0]?.name || '')} 우승!`;
  $('ov-me').textContent = mine ? `나는 #${mine.rank}등 / ${m.rank.length}명 · ${mine.k}킬 · 피해 ${mine.dmg}` : '';
  $('ov-rank').innerHTML = m.rank.slice(0, 30).map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${e.bot ? '🤖 ' : ''}${esc(e.name)}</span><span class="sc">${e.k}<small>킬 · ${e.dmg}</small></span></div>`).join('');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (won) { confetti(); sfx('win'); } else sfx('lose');
  ship.visible = false;
  shell.show('over');
}

// ---------- 화면 표시 ----------
function renderSlots() {
  const ids = slotIds(), names = ['1', '2', '3', '4', '5'];
  $('bg-slots').innerHTML = ids.map((id, i) => { const w = id && weapon(id); const label = w ? `${w.emoji} ${w.name}${i === 4 ? ` ×${game.inv.nade}` : ''}` : ['빈 주무기', '빈 주무기', '빈 권총', '', '수류탄 없음'][i]; return `<span class="${i === cur ? 'on' : ''}${w ? '' : ' empty'}">${names[i]} · ${esc(label)}</span>`; }).join('');
  $('heals').innerHTML = `<span class="${game.inv.band ? '' : 'none'}">7 🩹 ×${game.inv.band}</span><span class="${game.inv.med ? '' : 'none'}">8 🧰 ×${game.inv.med}</span>`;
}
function renderGear() {
  const a = game.inv.armor, h = game.inv.helmet;
  $('gear').innerHTML = `<span class="l${a}">🦺 ${a ? ARMOR_NAME[a] : '없음'}</span><span class="l${h}">⛑️ ${h ? ARMOR_NAME[h] : '없음'}</span>`;
}
function hud(now) {
  const w = curW(), a = ammo[w?.id];
  $('hp-n').textContent = Math.max(0, Math.round(me.hp)); $('hp-bar').firstElementChild.style.width = `${Math.max(0, me.hp)}%`;
  $('w-name').textContent = `${w?.emoji || ''} ${w?.name || ''}${reloadEnd ? ' · 장전 중…' : ''}`;
  $('ammo-n').textContent = a ? a.mag : w?.cls === 'nade' ? game.inv.nade : ''; $('ammo-r').textContent = a ? '/ ∞' : '';
  $('alive').textContent = `🪂 생존 ${game.alive}`; $('kills').textContent = `🎯 ${game.kills}킬`;
  const Z = zoneAt(game.zones, sec()), mm = Math.floor(Z.until / 60), ss = String(Math.floor(Z.until % 60)).padStart(2, '0');
  const zt = $('zone-txt');
  zt.textContent = sec() < 0 ? '곧 출발!' : Z.next ? (Z.shrinking ? `🌀 자기장이 줄어드는 중 ${mm}:${ss}` : `⏳ ${mm}:${ss} 뒤 자기장이 줄어요`) : '🌀 마지막 자기장';
  zt.classList.toggle('warn', Z.shrinking);
  const out = game.mode !== 'dead' && Math.hypot(me.pos.x - Z.x, me.pos.z - Z.z) > Z.r && game.mode !== 'plane';
  $('zone-tint').style.opacity = out ? '1' : '0';
  // 줍기 안내
  const it = game.mode === 'ground' ? nearestLoot() : null;
  if (it) { const swap = (it.k === 'gun' && game.inv.guns[0] && game.inv.guns[1]) || (it.k === 'pistol' && game.inv.pistol); $('prompt').innerHTML = `<kbd>E</kbd>${esc(itemLabel(it, weapon))}${swap ? ' (바꾸기)' : ''}`; }
  $('prompt').classList.toggle('hidden', !it);
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  const gap = 6 + (mouseR ? 0 : 6) + (moving ? 10 : 0) + (me.onGround ? 0 : 12) + vm.kickT * 14;
  const c = $('cross'); c.classList.toggle('ads', mouseR && w?.cls !== 'knife');
  c.querySelector('.u').style.bottom = c.querySelector('.d').style.top = c.querySelector('.l').style.right = c.querySelector('.r').style.left = `${gap}px`;
  c.classList.toggle('hidden', game.mode !== 'ground' || !!(w?.scope && mouseR));
  $('scope').classList.toggle('hidden', !(w?.scope && mouseR && game.mode === 'ground'));
  if (healing) $('heal-bar').querySelector('i').style.width = `${Math.min(100, (1 - (healing.end - now) / healing.dur) * 100)}%`;
  drawMap($('mini'), 220, true, Z);
  if (bigMap) drawMap($('big'), 720, false, Z);
}
function drawMap(cv, S, mini, Z) {
  const x = cv.getContext('2d'), k = S / (mini ? 120 : BG_SIZE + 20);
  const cx = mini ? me.pos.x : 0, cz = mini ? me.pos.z : 0; // 작은 지도는 나를 가운데
  const P = (wx, wz) => [S / 2 + (wx - cx) * k, S / 2 + (wz - cz) * k];
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#3fa0d8'; x.fillRect(0, 0, S, S);
  const [ix, iz] = P(-BG_SIZE / 2, -BG_SIZE / 2); x.fillStyle = '#8fc979'; x.beginPath(); x.roundRect(ix, iz, BG_SIZE * k, BG_SIZE * k, 12 * k); x.fill();
  x.fillStyle = 'rgba(110,100,120,.8)'; for (const r of MAP.roads) { const [a, b] = P(r.x - r.w / 2, r.z - r.d / 2); x.fillRect(a, b, r.w * k, r.d * k); }
  x.fillStyle = 'rgba(80,60,60,.55)'; for (const b of MAP.boxes) { if (b.hide || b.h < 1.5 || b.y > 0.5) continue; const [a, c] = P(b.x - b.w / 2, b.z - b.d / 2); x.fillRect(a, c, Math.max(1, b.w * k), Math.max(1, b.d * k)); }
  x.font = `${mini ? 11 : 15}px Jua`; x.textAlign = 'center'; x.fillStyle = '#fff';
  for (const p of PLACES) { const [a, b] = P(p.x, p.z); if (a > 0 && a < S && b > 0 && b < S) { x.lineWidth = 3; x.strokeStyle = 'rgba(20,10,40,.7)'; x.strokeText(p.name, a, b); x.fillText(p.name, a, b); } }
  // 자기장: 지금(파랑) · 다음(흰 줄)
  if (Z) {
    const [zx, zz] = P(Z.x, Z.z);
    x.save(); x.fillStyle = 'rgba(40,80,220,.35)'; x.beginPath(); x.rect(0, 0, S, S); x.arc(zx, zz, Z.r * k, 0, Math.PI * 2, true); x.fill('evenodd'); x.restore();
    x.strokeStyle = '#4c8dff'; x.lineWidth = 2; x.beginPath(); x.arc(zx, zz, Z.r * k, 0, Math.PI * 2); x.stroke();
    if (Z.next) { const [nx, nz] = P(Z.next.x, Z.next.z); x.strokeStyle = '#ffffff'; x.setLineDash([6, 4]); x.beginPath(); x.arc(nx, nz, Z.next.r * k, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
  }
  // 비행선 길
  if (game.mode === 'plane' || game.mode === 'fall') { const [a, b] = P(game.plane.a[0], game.plane.a[1]), [c, d] = P(game.plane.b[0], game.plane.b[1]); x.strokeStyle = 'rgba(255,143,196,.9)'; x.lineWidth = 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); x.setLineDash([]); }
  // 나 (보는 방향 화살표)
  const v = game.mode === 'dead' && game.watch ? game.watch.pos : me.pos, yaw = game.mode === 'dead' && game.watch ? game.watch.yaw : me.yaw;
  const [mx, mz] = P(v.x, v.z);
  x.save(); x.translate(mx, mz); x.rotate(-yaw); x.fillStyle = '#ffd84d'; x.strokeStyle = '#2b1d5c'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 6); x.lineTo(-6, 6); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function banner(text) { const b = $('banner'); b.classList.add('hidden'); void b.offsetWidth; b.textContent = text; b.classList.remove('hidden'); clearTimeout(game.bannerT); game.bannerT = setTimeout(() => b.classList.add('hidden'), 1800); }
function dirMark(p) { const ang = Math.atan2(-(p[0] - me.pos.x), -(p[1] - me.pos.z)) - me.yaw; const i = document.createElement('i'); i.style.transform = `translate(-50%, -120px) rotate(${-ang}rad)`; $('dirs').appendChild(i); setTimeout(() => i.remove(), 1200); }

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let t = 0, sendT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), now = performance.now();
  t += dt;
  if (game.mode !== 'title' && game.mode !== 'over' && game.zones) {
    const s = sec(), typing = !locked();
    const kf = (c) => (typing ? 0 : keys.has(c) ? 1 : 0);
    // 비행선
    const P = planeAt(game.plane, Math.max(0, s));
    ship.position.set(P.x, P.y + 4, P.z); ship.rotation.y = P.yaw;
    if (game.mode === 'plane') {
      me.pos.set(P.x, P.y, P.z);
      if (s > game.plane.dur) jump();
      // 비행선 뒤 위에서 본다 (마우스로 둘러보기)
      const back = new THREE.Vector3(Math.sin(me.yaw) * 30, 12 - me.pitch * 20, Math.cos(me.yaw) * 30);
      camera.position.copy(ship.position).add(back); camera.lookAt(ship.position);
      myBear.root.visible = false; myChute.visible = false;
    } else if (game.mode === 'fall') {
      const F = game.fall;
      if (!F.chute && me.pos.y < DROP.openAt) { F.chute = true; sfx('spawn'); }
      const vy = F.chute ? DROP.chute : DROP.free, glide = F.chute ? DROP.glide : DROP.glide * 1.4;
      const fwd = kf('KeyW') - kf('KeyS'), side = kf('KeyD') - kf('KeyA');
      const fx2 = -Math.sin(me.yaw), fz2 = -Math.cos(me.yaw), rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw);
      me.pos.x += (fx2 * fwd + rx * side) * glide * dt; me.pos.z += (fz2 * fwd + rz * side) * glide * dt; me.pos.y -= vy * dt;
      me.pos.x = Math.max(-BG_SIZE / 2 + 2, Math.min(BG_SIZE / 2 - 2, me.pos.x)); me.pos.z = Math.max(-BG_SIZE / 2 + 2, Math.min(BG_SIZE / 2 - 2, me.pos.z));
      const fl = floorAt(MAP, me.pos.x, me.pos.z, me.pos.y + 2, 0.35);
      myBear.root.visible = true; myBear.root.position.copy(me.pos); myBear.root.rotation.y = me.yaw + Math.PI;
      myBear.update(dt, 0, { airborne: true }); myBear.arms[0].rotation.x = myBear.arms[1].rotation.x = -2.6;
      myChute.visible = F.chute; myChute.position.copy(me.pos);
      const back = new THREE.Vector3(Math.sin(me.yaw) * 8, 4 - me.pitch * 6, Math.cos(me.yaw) * 8);
      camera.position.copy(me.pos).add(back); camera.lookAt(me.pos.x, me.pos.y + 1.5, me.pos.z);
      if (me.pos.y <= fl + 0.05) { me.pos.y = fl; land(); }
    } else if (game.mode === 'ground') {
      if (reloadEnd && now >= reloadEnd) { const w = curW(), a = ammo[w.id]; if (a) a.mag = w.mag; reloadEnd = 0; }
      const inp = { f: kf('KeyW') - kf('KeyS'), s: kf('KeyD') - kf('KeyA'), jump: keys.has('Space') && !typing, crouch: !typing && (keys.has('KeyC') || keys.has('ControlLeft')), sprint: !typing && keys.has('ShiftLeft') && !mouseL && !healing, ads: mouseR };
      if (healing) { inp.f *= 0.4; inp.s *= 0.4; }
      for (const e of me.update(dt, inp, MAP)) sfx(e, null, e === 'step' ? 0.6 : 1);
      if (mouseL && locked()) shoot(now);
      if (kickBack > 0) { const r = Math.min(kickBack, dt * 1.2); me.pitch -= r; kickBack -= r; }
      if (healing && now >= healing.end) { shell.send({ t: 'heal', k: healing.k }); cancelHeal(); }
      camera.position.copy(me.eye()); camera.rotation.set(me.pitch, me.yaw, 0);
      const w = curW(), zoom = mouseR && w?.cls !== 'knife' && w?.cls !== 'nade' ? (w.scope ? w.zoom : Math.min(1.6, w.zoom)) : 1;
      const fov = (me.sprinting ? 80 : 72) / zoom;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
      vm.update(dt, camera.aspect, Math.hypot(me.vel.x, me.vel.z) > 1.5 && me.onGround, mouseR, t);
    } else if (game.mode === 'dead') {
      const o = game.watch && game.watch.alive ? game.watch : null;
      if (!o) cycleWatch();
      if (o) { const back = new THREE.Vector3(Math.sin(o.yaw) * 5, 2.6, Math.cos(o.yaw) * 5); camera.position.lerp(o.pos.clone().add(back), Math.min(1, dt * 5)); camera.lookAt(o.pos.x, o.pos.y + 1.4, o.pos.z); $('spec-who').textContent = `👀 ${o.name} 관전 중 · 생존 ${game.alive}`; }
      if (camera.fov !== 72) { camera.fov = 72; camera.updateProjectionMatrix(); }
    }
    if (game.mode === 'plane' || game.mode === 'fall' || game.mode === 'dead') { camera.rotation.order = 'YXZ'; if (camera.fov !== 72) { camera.fov = 72; camera.updateProjectionMatrix(); } }
    // 자기장 벽
    const Z = zoneAt(game.zones, Math.max(0, s));
    zoneWall.position.set(Z.x, 60, Z.z); zoneWall.scale.set(Math.max(0.1, Z.r), 160, Math.max(0.1, Z.r));
    zoneEdge.position.set(Z.x, 0.3, Z.z); zoneEdge.scale.setScalar(Math.max(0.1, Z.r));
    zoneWall.material.opacity = 0.16 + Math.sin(t * 2) * 0.04;
    updateNades(dt);
    for (const o of game.others.values()) o.update(dt);
    // 아이템 빙글빙글 (가까운 것만)
    for (const it of game.loot.values()) { const d = Math.abs(it.x - camera.position.x) + Math.abs(it.z - camera.position.z); it.mesh.visible = d < 160; if (d < 40) { it.mesh.userData.spin.rotation.y += dt * 1.2; it.mesh.userData.spin.position.y = 0.45 + Math.sin(t * 2 + it.id) * 0.06; } }
    // 내 상태 보내기 (flags: 1 앉기 · 2 조준 · 4 낙하산 · 8 비행선 · 자유낙하)
    sendT -= dt;
    if (sendT <= 0 && game.mode !== 'dead') { sendT = 0.066; const f = game.mode === 'plane' ? 8 : game.mode === 'fall' ? (game.fall.chute ? 4 : 8) : (me.crouch > 0.5 ? 1 : 0) | (mouseR ? 2 : 0); shell.send({ t: 'st', p: [me.pos.x, me.pos.y, me.pos.z, me.yaw, me.pitch, f] }); }
    hud(now);
  } else {
    // 처음 화면: 섬 위를 천천히 돈다
    const a = t * 0.04;
    camera.position.set(Math.cos(a) * 170, 90, Math.sin(a) * 170); camera.lookAt(0, 0, 0);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
  }
  updateFx(dt);
  renderer.clear(); renderer.render(scene, camera);
  if (game.mode === 'ground') vm.render(renderer);
}

// ---------- 공용 틀 ----------
const shell = new Shell({
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; } },
  key: 'jellybg', title: '🪂 젤리배그', subtitle: '젤리 비행선에서 뛰어내려 무기를 줍고<br>줄어드는 젤리 자기장 속 마지막 곰돌이가 되어요!', wsPath: '/bg-ws', max: 30,
  multiLabel: '👥 같이 하기', roomIcon: '🪂', startLabel: '🪂 비행선 출발!',
  keysHelp: 'F/Space 뛰어내리기 · WASD 이동 · 마우스 조준 · 클릭 사격 · 우클릭 조준경 · E 줍기 · 1~5 무기 · 7 붕대 · 8 구급상자 · G 수류탄 · R 장전 · Shift 달리기 · C 앉기 · M 지도',
  buttons: [{ id: 'practice-btn', label: '🪂 바로 하기 <small>젤리봇과 배틀로얄</small>', onClick: () => practice() }],
  extraRow: [{ label: '🖱️ 마우스 감도', onClick: () => openSens('bg') }, { label: '🔫 젤리어택으로', onClick: () => { location.href = '/jelly-attack/'; } }],
  screens: ['over'],
  describe: (o = {}) => `🪂 ${o.fill || 24}명 (젤리봇으로 채우기)`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onProfile: (p) => { game.color = p.color; },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onChatClose: () => { if (game.mode !== 'title' && game.mode !== 'over' && game.mode !== 'dead') lock(); },
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ fill: game.pick.fill });
shell.on('snap', (m) => { for (const [id, ...st] of m.p) { if (id === game.myId) continue; const o = game.others.get(id); if (o) o.set(st); } });
shell.on('jumped', (m) => { const o = game.others.get(m.id); if (o) { o.jumped = true; o.pos.copy(o.tgt); } });
shell.on('loot', (m) => onLoot(m));
shell.on('inv', (m) => onInv(m));
shell.on('hp', (m) => { me.hp = m.hp; sfx('spawn'); });
shell.on('wpn', (m) => { game.others.get(m.id)?.setGun(m.w); });
shell.on('fire', (m) => {
  const o = game.others.get(m.by); if (!o || !Array.isArray(m.o)) return;
  const w = weapon(m.w); o.firedT = 0.8;
  const eye = new THREE.Vector3(...m.o), d = new THREE.Vector3(...m.d).normalize();
  const tt = rayBoxes(MAP, eye, d, 300), st = eye.clone().addScaledVector(d, 0.7); st.y -= 0.25;
  tracer(st, eye.clone().addScaledVector(d, tt), w?.tracer);
  const dist = eye.distanceTo(camera.position);
  if (dist < 140) sfx('gun', w?.cls, Math.max(0.05, 1 - dist / 140) * 0.8);
  const toMe = me.eye().sub(eye), along = toMe.dot(d);
  if (game.mode === 'ground' && along > 0 && along < tt && toMe.addScaledVector(d, -along).length() < 1.5) sfx('whizz');
});
shell.on('dmg', (m) => {
  if (m.to === game.myId) {
    me.hp = m.hp; cancelHeal(); sfx('hurt');
    $('hurt').style.opacity = '1'; clearTimeout(game.hurtT); game.hurtT = setTimeout(() => { $('hurt').style.opacity = '0'; }, 250);
    if (m.p) dirMark(m.p);
  }
  if (m.by === game.myId && m.to !== game.myId) { sfx(m.head ? 'head' : 'hit'); const h = $('hitmark'); h.classList.toggle('head', !!m.head); h.classList.remove('hidden'); clearTimeout(game.hitT); game.hitT = setTimeout(() => h.classList.add('hidden'), 140); }
});
shell.on('kill', (m) => {
  game.alive = m.alive;
  const K = m.by === game.myId ? { name: '나' } : game.others.get(m.by), V = m.to === game.myId ? { name: '나' } : game.others.get(m.to);
  const w = weapon(m.w);
  const row = document.createElement('div'); row.className = m.by === game.myId || m.to === game.myId ? 'me' : '';
  row.innerHTML = m.w === 'zone' ? `🌀 ${esc(V?.name || '?')} 자기장에 녹음` : m.w === 'leave' ? `🚪 ${esc(V?.name || '?')} 나감` : `${esc(K?.name || '?')} ${w?.emoji || '💥'}${m.head ? '🎯' : ''} ${esc(V?.name || '?')}`;
  $('feed').prepend(row); setTimeout(() => row.remove(), 5000);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
  const o = game.others.get(m.to); if (o) { o.alive = false; puff(o.pos.clone().setY(o.pos.y + 1), o.color, 14, 0.35, 4); }
  if (m.by === game.myId && m.to !== game.myId) { game.kills++; sfx('kill'); banner(m.head ? '🎯 헤드샷!' : `💥 ${game.kills}킬!`); }
  if (m.to === game.myId) { game.place = m.place; die(m.w === 'zone' ? null : K?.name); }
});
shell.on('boom', (m) => { const p = new THREE.Vector3(...m.p); puff(p, '#ffb36b', 24, 0.9, 9); puff(p, '#ffffff', 10, 1.4, 4); sfx('boom', null, Math.max(0.1, 1 - p.distanceTo(camera.position) / 90)); });
shell.on('gone', (m) => { game.others.get(m.id)?.remove(); game.others.delete(m.id); });
function optsUI(el, o, editable, set) {
  el.innerHTML = `<div class="bots-row">🪂 판 인원 (젤리봇으로 채우기) ${editable ? '<button data-b="-2">−</button>' : ''}<b>${o.fill ?? 24}</b>${editable ? '<button data-b="2">＋</button>' : ''}</div>`;
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ fill: Math.max(2, Math.min(30, (o.fill ?? 24) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }); }
function practice() { shell.sendAfterHello({ t: 'practice', opts: { fill: game.pick.fill } }); }
$('again-btn').onclick = () => { if (game.lastPractice) return practice(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() {
  game.mode = 'title'; game.zones = null; shell.multi = false; shell.playing = false; document.exitPointerLock?.();
  for (const id of ['hud', 'lockmsg', 'spec', 'bigmap', 'scope']) $(id).classList.add('hidden');
  for (const o of game.others.values()) o.remove(); game.others.clear();
  for (const it of game.loot.values()) scene.remove(it.mesh); game.loot.clear();
  ship.visible = false; zoneWall.visible = false; zoneEdge.visible = false; if (myBear) { myBear.root.visible = false; myChute.visible = false; }
  $('zone-tint').style.opacity = '0';
  shell.show('title'); renderTitleOpts();
}
void world;
renderTitleOpts();
shell.boot();
frame();
