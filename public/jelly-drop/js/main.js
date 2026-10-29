// 젤리드롭: 젤리택티컬의 무기 · 몸놀림 그대로 배틀로얄로 (최대 30명 · 젤리봇으로 채우기)
//   젤리 비행선 → 뛰어내리기(F) → 낙하산 → 착지 → 줍기(E) → 싸우기 → 줄어드는 젤리 자기장 → 마지막 한 명 '마지막 곰젤리!'
import '../../shared/js/renamed.js'; // 옛 이름으로 저장된 값 옮기기 (맨 먼저)
import * as THREE from 'three';
import { store } from '../../shared/js/account.js';
import { openSens, sensOf } from '../../shared/js/sens.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { Roach } from '../../shared/js/roach.js';
import { confetti } from '../../shared/js/party.js';
import { rayBoxes, floorAt } from '../../jelly-tactical/js/maps.js';
import { getBgMap, BG_MAPS, BG_SIZE } from './bgmap.js';
import { HEALS, DROP, zoneAt, planeAt, itemLabel, emptyInv, ARMOR_NAME, AMMO, AMMO_OF, ATTS, SLOTS, CAP, BOOSTS, BAG_NAME, ammoTotal, VEHICLES, THROWS, THROW_ORDER, inWater } from './bgrules.js';
import { buildWater, makeRedZone, makeCrate, makeFire, updateFire, vaultTarget, WATER_Y } from './bgextra.js';
import { buildVehicle, drive, poseVehicle, dressGear, extraLoot } from './bgparts.js';
import { weapon, KNIFE, NADE, SMOKE } from '../../jelly-tactical/js/weapons.js';
import { buildMap } from '../../jelly-tactical/js/world.js';
import { Player, ViewModel, gunModel } from '../../jelly-tactical/js/fps.js';
import { sfx, unlock, toggleMute, sound } from '../../jelly-tactical/js/sound.js';
import { explosion, smoke, updateFx as updateBig, stepNade, NadeArc } from '../../jelly-tactical/js/fx.js';

const $ = (id) => document.getElementById(id);
const wpn = (id) => weapon(id) || THROWS[id]; // 총 · 투척(화염병 · 섬광탄 · 신호탄 총)
const PICK_KEY = 'jellydrop.pick';
let MAP = getBgMap('island');

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1400);
camera.rotation.order = 'YXZ';
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let world = buildMap(scene, MAP), water = buildWater(scene, MAP);
// 맵 바꾸기 (판마다 · 처음 화면 미리보기)
function loadBgMap(id) { const m = getBgMap(id); if (m === MAP) return; world.dispose(); water.dispose(); MAP = m; world = buildMap(scene, MAP); water = buildWater(scene, MAP); }

const me = new Player();
let vm = new ViewModel('#8a5634');
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.bg = {
  me, mode: 'title', myId: 0, others: new Map(), loot: new Map(), inv: emptyInv(), zones: null, plane: null, t0: 0, alive: 0, total: 0, kills: 0, place: 0,
  pick: { fill: pick0.fill ?? 24, map: pick0.map || 'random', squad: pick0.squad || 1 }, watch: null, color: '#8a5634', fall: null,
  // 몸: 엎드리기 · 기울이기 · 넘기 · 헤엄 · 기절 / 분대 · 레드존 · 보급상자 · 불
  prone: false, lean: 0, vault: null, swim: false, knocked: false, free: null, single: {}, squad: 1, sq: {}, sqInfo: [], squads: 0, red: null, drops: new Map(), fires: [], reviving: null, revBar: null, refuel: null,
};
const sec = () => (performance.now() - game.t0) / 1000;

// ---------- 무기 칸: 1 · 2 주무기 · 3 권총 · 4 나이프 · 5 수류탄 ----------
let cur = 3, ammo = {}, nextFire = 0, reloadEnd = 0, fireLatch = false, kickBack = 0, throwK = 'nade';
// 5번 칸: 수류탄 · 연막탄 (5를 한 번 더 누르면 바꾼다)
const throwId = () => { const i = game.inv; if (i[throwK] > 0) return throwK; return THROW_ORDER.find((k) => i[k] > 0) || null; };
const slotIds = () => [game.inv.guns[0], game.inv.guns[1], game.inv.pistol, 'knife', throwId()];
const curW = () => wpn(slotIds()[cur]) || KNIFE;
const attOf = (i) => (i === 0 || i === 1 ? game.inv.att?.[i] : i === 2 ? game.inv.patt : null) || {};
const curAtt = () => attOf(cur);
const magOf = (w, att) => Math.max(1, Math.round(w.mag * (ATTS[att?.mag]?.mag || 1)));
// 바닥에서 주운 총은 빈 탄창 (배그처럼) · 장전하면 가방의 탄을 쓴다
function ensureAmmo() { for (const id of slotIds()) { const w = id && wpn(id); if (w?.mag && !ammo[id]) ammo[id] = { mag: 0 }; } }
function switchTo(i) {
  const ids = slotIds();
  if (i === 4 && cur === 4) { const have = THROW_ORDER.filter((k) => game.inv[k] > 0); if (have.length > 1) { throwK = have[(have.indexOf(throwId()) + 1) % have.length]; vm.setWeapon(curW(), game.color); renderSlots(); sfx('switch'); } return; }
  if (!ids[i] || (i === cur && vm.gun)) return;
  cur = i; reloadEnd = 0; cancelHeal(); vm.setWeapon(curW(), game.color); sfx('switch');
  shell.send({ t: 'wpn', w: ids[i] }); renderSlots();
}
function reload() {
  const w = curW(), a = ammo[w.id]; if (!a || reloadEnd) return;
  if (a.mag >= magOf(w, curAtt())) return;
  const type = AMMO_OF[w.id], have = game.inv.ammo?.[type] || 0;
  if (have <= 0) { shell.toast(`${AMMO[type]?.emoji || ''} ${AMMO[type]?.name || ''} 탄약이 없어요`, 1300); return; }
  const rt = w.reload * (ATTS[curAtt().mag]?.reload || 1);
  reloadEnd = performance.now() + rt * 1000; vm.reload(rt); sfx('reload');
}
function finishReload() {
  const w = curW(), a = ammo[w.id]; reloadEnd = 0; if (!a) return;
  const type = AMMO_OF[w.id], n = Math.min(magOf(w, curAtt()) - a.mag, game.inv.ammo?.[type] || 0);
  if (n <= 0) return;
  a.mag += n; game.inv.ammo[type] -= n; shell.send({ t: 'rl', w: w.id, n }); renderSlots();
}

// ---------- 입력 ----------
const keys = new Set(); let mouseL = false, mouseR = false, bigMap = false;
const locked = () => !!game.testLock || document.pointerLockElement === $('c');
// 키보드 잠금: 전체화면이면 Ctrl+W(앉아서 앞으로) 같은 브라우저 단축키도 게임이 받는다
const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyR', 'KeyQ', 'KeyE', 'KeyG', 'KeyF', 'KeyZ', 'KeyB', 'KeyX', 'Space', 'Tab', 'AltLeft', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'];
$('fs-btn').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* 무시 */ } lock(); };
const invOpen = () => !$('inv').classList.contains('hidden');
// 마우스 잠금: 실패하면(브라우저가 막으면) '클릭해서 계속' 창을 띄운다
function lock() { unlock(); try { const r = $('c').requestPointerLock?.(); r?.catch?.(() => { if (game.mode === 'ground' || game.mode === 'drive' || game.mode === 'plane' || game.mode === 'fall') $('lockmsg').classList.remove('hidden'); }); } catch { /* 무시 */ } navigator.keyboard?.lock?.(GAME_KEYS).catch?.(() => {}); }
// 게임 중 Ctrl(앉기) + 글자: 북마크(Ctrl+D) · 저장(Ctrl+S) 같은 브라우저 단축키가 끼어들지 않게
window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && !(MODE_OFF()) && /^(Key|Digit|Space)/.test(e.code) && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) e.preventDefault(); }, true);
const MODE_OFF = () => game.mode === 'title' || game.mode === 'over';
document.addEventListener('pointerlockchange', () => { if (game.mode !== 'title' && game.mode !== 'over') $('lockmsg').classList.toggle('hidden', locked() || game.mode === 'dead' || invOpen()); });
$('c').addEventListener('click', () => { if (game.mode === 'dead') return cycleWatch(); if (invOpen()) return toggleInv(false); if (game.mode !== 'title' && game.mode !== 'over' && !locked()) lock(); });
$('lock-btn').onclick = lock; $('sens-btn').onclick = () => openSens('bg'); $('quit-btn').onclick = () => quit();
document.addEventListener('mousemove', (e) => {
  if (!locked() || game.mode === 'title' || game.mode === 'over') return;
  const z = game.mode === 'ground' && mouseR ? zoomNow() : 1;
  const s = 0.0022 * sensOf('bg') * (z > 1.05 ? 0.75 / Math.pow(z, 0.85) : 1);
  // Alt 를 누르고 있으면 몸(조준)은 그대로 · 고개만 돌려 둘러보기
  if (game.free) { game.free.yaw = Math.max(-2, Math.min(2, game.free.yaw - e.movementX * s)); game.free.pitch = Math.max(-1, Math.min(1, game.free.pitch - e.movementY * s)); return; }
  me.yaw -= e.movementX * s; me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch - e.movementY * s));
});
document.addEventListener('mousedown', (e) => { if (!locked()) return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
document.addEventListener('mouseup', (e) => { if (e.button === 0) { mouseL = false; fireLatch = false; } if (e.button === 2) mouseR = false; });
document.addEventListener('contextmenu', (e) => { if (game.mode !== 'title') e.preventDefault(); });
document.addEventListener('wheel', (e) => { if (game.mode === 'ground' && locked()) { const ids = slotIds(); for (let k = 1; k <= 5; k++) { const i = (cur + (e.deltaY > 0 ? k : 5 - k)) % 5; if (ids[i]) { switchTo(i); break; } } } });
addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (game.mode === 'title' || game.mode === 'over') return;
  if (['Space', 'Tab', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if ((e.code === 'AltLeft' || e.code === 'AltRight') && (game.mode === 'ground' || game.mode === 'drive' || game.mode === 'fall')) game.free = { yaw: 0, pitch: 0 };
  if (e.code === 'KeyM') { bigMap = !bigMap; $('bigmap').classList.toggle('hidden', !bigMap); }
  if (e.code === 'Tab' && (game.mode === 'ground' || game.mode === 'drive')) return toggleInv();
  if (e.code === 'KeyF' && game.mode === 'drive') return exitVehicle();
  if (e.code === 'KeyR' && game.mode === 'drive') return startRefuel();
  // F: 기절한 동료 살리기 (누르고 있기) → 줍기 → 차 타기 (배그처럼)
  if (e.code === 'KeyF' && game.mode === 'ground' && !game.knocked) { const mate = reviveTarget(); if (mate) return startRevive(mate); if (nearestLoot()) return pickUp(); const v = nearVehicle(); if (v) return shell.send({ t: 'enter', id: v.id }); }
  if (game.mode === 'plane' && (e.code === 'KeyF' || e.code === 'Space')) return jump();
  if (game.mode === 'dead' && e.code === 'Space') return cycleWatch();
  if (game.mode !== 'ground' || game.knocked) return;
  if (e.code === 'KeyR') reload();
  if (/^Digit[1-5]$/.test(e.code)) switchTo(+e.code.slice(5) - 1);
  if (e.code === 'KeyX') dropCurrent();
  if (e.code === 'KeyZ' && !game.swim) { game.prone = !game.prone; sfx('step'); }
  if ((e.code === 'KeyC' || e.code === 'ControlLeft') && game.prone) game.prone = false;
  if (e.code === 'Space') { if (game.prone) game.prone = false; else tryVault(); }
  if (e.code === 'KeyB') { const w = curW(); if (w?.auto) { game.single[w.id] = !game.single[w.id]; shell.toast(game.single[w.id] ? '☝️ 단발' : '🔁 연사', 700); sfx('switch'); } else if (w?.mag) shell.toast('이 총은 단발만 돼요', 700); }
  if (e.code === 'Digit6') startHeal('adren');
  if (e.code === 'Digit7') startHeal('band');
  if (e.code === 'Digit8') startHeal('med');
  if (e.code === 'Digit9') startHeal('drink');
  if (e.code === 'Digit0') startHeal('pill');
  if (e.code === 'KeyG' && throwId()) throwNade(throwId());
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'KeyF' && game.reviving) stopRevive(); if (e.code === 'AltLeft' || e.code === 'AltRight') game.free = null; });
addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; game.free = null; if (game.reviving) stopRevive(); });
function muteBtn() { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => { if (game.mode !== 'dead' && !confirm('젤리드롭에서 나갈까요?')) return; quit(); };

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
    this.mate = game.squad > 1 && game.sq[m.id] === game.sq[game.myId];
    this.tag = tag(m.name, this.mate ? '#4cc3ff' : null); scene.add(this.tag);
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.flags = 8; this.alive = true; this.lastPos = new THREE.Vector3(); this.firedT = 0;
    this.setGun('knife');
  }
  setGun(id) { this.gun = id; this.bear.setHeld(heldOf(wpn(id) || KNIFE)); }
  set(st) { const [x, y, z, yaw, pitch, f, veh, lean] = st; this.tgt.set(x, y, z); this.tyaw = yaw; this.pitch = pitch; this.flags = f; this.veh = f & 16 ? veh : 0; this.lean = f & 16 ? 0 : lean || 0; if (this.pos.distanceTo(this.tgt) > 20) this.pos.copy(this.tgt); }
  // 32 엎드림 · 64 기절 · 128 헤엄
  get down() { return !!(this.flags & 96) || this.knocked; }
  get swim() { return !!(this.flags & 128); }
  get inAir() { return (this.flags & 12) !== 0; }
  update(dt) {
    const k = Math.min(1, dt * 12);
    this.pos.lerp(this.tgt, k);
    let d = (this.tyaw ?? this.yaw) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k;
    const sp = this.pos.distanceTo(this.lastPos) / Math.max(dt, 1e-3); this.lastPos.copy(this.pos);
    const b = this.bear, vis = this.alive && this.jumped;
    b.root.visible = vis; this.tag.visible = vis && !this.inAir && (game.squad === 1 || this.mate);
    b.root.position.copy(this.pos); b.root.rotation.y = this.yaw + Math.PI;
    this.speed = sp;
    // 운전 중: 차는 이 사람 위치 · 방향 그대로, 곰돌이는 운전석에 앉는다
    const car = this.veh ? game.veh.get(this.veh) : null;
    if (car) { b.setSeated(true); const st = car.mesh.userData.seat; b.root.position.set(this.pos.x, this.pos.y, this.pos.z); b.root.rotation.y = this.yaw + Math.PI; b.root.translateX(-st[0]); b.root.position.y += st[1]; b.root.translateZ(-st[2]); this.tag.visible = vis; }
    else b.setSeated(false);
    b.update(dt, this.inAir || car ? 0 : Math.min(9, sp), { noCrawl: true, airborne: this.inAir });
    if (this.inAir) { b.arms[0].rotation.x = b.arms[1].rotation.x = -2.6; }
    else if (car) { b.arms[0].rotation.x = b.arms[1].rotation.x = -1.2; }
    else { b.arms[1].rotation.x = -1.45 - this.pitch; b.arms[0].rotation.x = -1.3 - this.pitch; b.arms[0].rotation.z = b.arms[0].userData.baseZ * 0.2 + 0.5; }
    this.chute.visible = vis && (this.flags & 4) !== 0; this.chute.position.copy(this.pos);
    const crouch = this.flags & 1; b.root.scale.y = 0.85 * (crouch ? 0.75 : 1);
    // 엎드림 · 기절: 바닥에 납작 (기절은 빨갛게 깜빡) · 헤엄: 물에 잠김 · 기울이기: 옆으로 기울임
    b.root.rotation.x = this.down && !car ? -1.35 : 0; if (this.down && !car) b.root.position.y += 0.35;
    if (this.swim && !car) b.root.position.y -= 0.95 - Math.sin(performance.now() / 300 + this.id) * 0.05;
    b.root.rotation.z = car ? 0 : -(this.lean || 0) * 0.35;
    if (this.knocked && this.mate) this.tagKnock = true;
    this.tag.position.set(this.pos.x, this.pos.y + (car ? 3.2 : this.down ? 1.2 : crouch ? 1.75 : 2.2), this.pos.z);
    this.firedT -= dt;
  }
  remove() { scene.remove(this.bear.root, this.tag, this.chute); }
  hit(o, d) {
    if (!this.jumped || this.inAir || this.veh) return null; // 차 안은 차를 맞힌다
    if (this.down || this.swim) {
      // 엎드림 · 기절: 낮은 몸통 공 + 앞쪽 머리 · 헤엄: 물 위 머리만
      const p = this.pos, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const parts = this.swim ? [[p.x, p.y + 0.6, p.z, 0.36, 'head']] : [[p.x + fx * 0.7, p.y + 0.35, p.z + fz * 0.7, 0.3, 'head'], [p.x, p.y + 0.32, p.z, 0.55, 'body'], [p.x - fx * 0.6, p.y + 0.25, p.z - fz * 0.6, 0.4, 'body']];
      let best = null;
      for (const [cx, cy, cz, r, part] of parts) { const oc = new THREE.Vector3(o.x - cx, o.y - cy, o.z - cz), bq = oc.dot(d), disc = bq * bq - (oc.lengthSq() - r * r); if (disc < 0) continue; const t = -bq - Math.sqrt(disc); if (t > 0 && (!best || t < best.t)) best = { t, part }; }
      return best;
    }
    const crouch = this.flags & 1, p = this.pos, hy = p.y + (crouch ? 1.2 : 1.62);
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
  x.fillStyle = 'rgba(20,10,40,.6)'; x.beginPath(); x.roundRect(128 - w / 2, 10, w, 44, 22); x.fill(); if (color) { x.strokeStyle = color; x.lineWidth = 5; x.stroke(); } x.fillStyle = '#fff'; x.fillText(name, 128, 33);
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

const red = makeRedZone(scene);

// ---------- 바닥의 아이템 ----------
const LV_COL = ['#cccccc', '#9be7a7', '#7cd8ff', '#c39bff'];
let _glow = null;
function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c)); }
function lootMesh(it) {
  const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
  let col = '#ffd84d';
  if (it.k === 'gun' || it.k === 'pistol') { const w = wpn(it.w); const gm = gunModel(w?.cls || 'rifle', '#ff8fc4'); gm.group.scale.setScalar(1.6); gm.group.rotation.y = Math.PI / 2; spin.add(gm.group); col = w?.cls === 'sniper' || w?.id === 'm249' || w?.id === 'barrett' ? '#c39bff' : '#ffd84d'; }
  else if (it.k === 'armor') { col = LV_COL[it.lv]; const v = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.25), new THREE.MeshToonMaterial({ color: col })); spin.add(v); const s = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.28), new THREE.MeshToonMaterial({ color: '#3a3d46' })); s.position.y = -0.1; spin.add(s); }
  else if (it.k === 'helmet') { col = LV_COL[it.lv]; const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: col })); spin.add(h); }
  else if (it.k === 'band') { col = '#ffffff'; const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.3), new THREE.MeshToonMaterial({ color: '#fff3f6' })); spin.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.04), new THREE.MeshToonMaterial({ color: '#ff5c8a' })); c.position.z = 0.15; spin.add(c); }
  else if (it.k === 'med') { col = '#ff5c8a'; const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), new THREE.MeshToonMaterial({ color: '#ff5c8a' })); spin.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.32), new THREE.MeshToonMaterial({ color: '#ffffff' })); spin.add(c); const c2 = c.clone(); c2.scale.set(0.3, 1, 1); c2.scale.x = 0.27; spin.add(c2); }
  else if (it.k === 'nade') { col = '#ffb36b'; spin.add(gunModel('nade', '#ff8fc4').group); spin.scale.setScalar(1.5); }
  else col = extraLoot(it, spin) || col;
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
// ---------- 몸: 기울이기 · 넘기 ----------
// 기울인 만큼 눈(쏘는 자리)이 옆으로
function leanEye() { const e = me.eye(); if (game.lean) e.add(new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)).multiplyScalar(game.lean * 0.5)); if (game.lean) e.y -= Math.abs(game.lean) * 0.12; return e; }
function tryVault() {
  if (!me.onGround || game.swim || game.vault || healing) return false;
  const v = vaultTarget(MAP, me.pos, me.yaw); if (!v) return false;
  game.vault = { from: me.pos.clone(), to: v.to, up: v.up, t: 0, dur: 0.42 }; sfx('jump'); return true;
}
// ---------- 기절한 동료 살리기 (F 누르고 있기 · 8초) ----------
function reviveTarget() { if (game.squad < 2) return null; let best = null, bd = 2.6; for (const o of game.others.values()) { if (!o.alive || !o.knocked || !o.mate) continue; const d = o.pos.distanceTo(me.pos); if (d < bd) { bd = d; best = o; } } return best; }
function startRevive(o) { game.reviving = { id: o.id, at: me.pos.clone() }; shell.send({ t: 'revive', id: o.id }); cancelHeal(); }
function stopRevive() { if (!game.reviving) return; game.reviving = null; shell.send({ t: 'revive-stop' }); game.revBar = null; }
// ---------- 기름 넣기 (차 안 · R · 4초) ----------
function startRefuel() { const v = game.drv?.v; if (!v) return; if (!game.inv.gas) { shell.toast('⛽ 기름통이 없어요', 900); return; } if ((v.fuel ?? 100) >= 99) { shell.toast('⛽ 이미 가득', 800); return; } game.refuel = { end: performance.now() + 4000 }; $('heal-bar').classList.remove('hidden'); $('heal-txt').textContent = '⛽ 기름 넣는 중…'; }
// 신호탄: 빨간 불빛이 하늘로
function flareFx(p) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff3a2a', transparent: true, depthWrite: false })); s.scale.setScalar(2.4); s.position.copy(p).setY(p.y + 2); scene.add(s); fx.push({ o: s, t: 4, life: 4, v: new THREE.Vector3(0, 22, 0) }); }


// ---------- 회복 (붕대 3초 · 구급상자 6초, 움직이면 천천히) ----------
let healing = null;
function startHeal(k) {
  const H = HEALS[k] || BOOSTS[k]; if (!H || game.inv[k] <= 0 || healing || game.mode !== 'ground' || game.knocked || game.swim) return;
  if (HEALS[k] && me.hp >= H.cap) { shell.toast(k === 'band' ? `🩹 붕대로는 ${H.cap}까지만 회복돼요` : '❤️ 이미 가득 찼어요', 1200); return; }
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
  if (!w || game.mode !== 'ground' || game.swim || game.knocked || game.vault) return;
  if (w.cls === 'nade') { if (!fireLatch) { fireLatch = true; throwNade(w.id); } return; }
  if (w.cls === 'knife') { if (now < nextFire || fireLatch) return; fireLatch = true; nextFire = now + w.rate * 1000; return knife(); }
  if (reloadEnd || now < nextFire || ((!w.auto || game.single[w.id]) && fireLatch)) return;
  ensureAmmo(); const a = ammo[w.id]; if (!a) return;
  if (a.mag <= 0) { if (!fireLatch) sfx('dry'); fireLatch = true; reload(); return; }
  const AT = curAtt(), spreadK = ATTS[AT.grip]?.spread || 1, recoilK = (ATTS[AT.muzzle]?.recoil || 1) * (ATTS[AT.grip]?.recoil || 1);
  cancelHeal();
  fireLatch = true; nextFire = now + w.rate * 1000; a.mag--;
  const eye = leanEye(), fwd = me.forward();
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  let spread = (w.cls === 'sniper' ? (mouseR ? w.spread : 0.07) : w.spread * (mouseR ? 0.45 : 1)) * spreadK;
  spread += (moving ? w.move : 0) + (me.onGround ? 0 : 0.06) - (me.crouch > 0.5 ? spread * 0.3 : 0);
  const n = w.pellets || 1, hits = new Map(), vehHits = new Map(), end = muzzleWorld();
  for (let i = 0; i < n; i++) {
    const s = n > 1 ? w.pspread : spread;
    const d = fwd.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s)).normalize();
    const wallT = rayBoxes(MAP, eye, d, 400);
    let best = null;
    for (const o of game.others.values()) { if (!o.alive) continue; const h = o.hit(eye, d); if (h && h.t < wallT && (!best || h.t < best.h.t)) best = { o, h }; }
    // 차: 사람보다 먼저 맞으면 차 체력이 준다
    let car = null; for (const v of game.veh.values()) { if (v.dead) continue; const c = new THREE.Vector3(v.x, v.y + 0.9, v.z), oc = eye.clone().sub(c), bq = oc.dot(d), cq = oc.lengthSq() - 1.7 * 1.7, D = bq * bq - cq; if (D < 0) continue; const tt = -bq - Math.sqrt(D); if (tt > 0 && tt < wallT && (!best || tt < best.h.t) && (!car || tt < car.t)) car = { v, t: tt }; }
    if (car) { best = null; vehHits.set(car.v.id, (vehHits.get(car.v.id) || 0) + w.dmg); }
    const t = car ? car.t : best ? best.h.t : Math.min(wallT, 400), p = eye.clone().addScaledVector(d, t);
    tracer(end, p, w.tracer);
    if (car) puff(p, '#fff3b0', 4, 0.18, 2);
    if (best) { const e = hits.get(best.o) || { n: 0, head: false }; e.n++; if (best.h.part === 'head') e.head = true; hits.set(best.o, e); puff(p, best.o.color, 5, 0.22, 3); }
    else if (wallT < 400) puff(p, '#d8cbb0', 4, 0.18, 1.5);
  }
  sfx('gun', w.cls, AT.muzzle === 'supp' ? 0.35 : 1); vm.kick(0.5 + w.recoil[0] * 6 * recoilK);
  const kp = w.recoil[0] * (mouseR ? 0.7 : 1) * recoilK;
  me.pitch = Math.min(1.45, me.pitch + kp); kickBack += kp * 0.55; me.yaw += (Math.random() - 0.5) * w.recoil[1] * 2;
  shell.send({ t: 'fire', w: w.id, o: [eye.x, eye.y, eye.z], d: [fwd.x, fwd.y, fwd.z] });
  for (const [o, e] of hits) shell.send({ t: 'hit', to: o.id, w: w.id, part: e.head ? 'head' : 'body', n: e.n });
  for (const [id, dmg] of vehHits) shell.send({ t: 'vhit', id, dmg: Math.round(dmg) });
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
const nades = [], arc = new NadeArc(scene);
function throwNade(kind = throwId()) {
  if (!kind || game.inv[kind] <= 0 || game.swim || game.knocked) return;
  // 신호탄 총: 하늘로 쏘면 그 자리에 보급상자가 떨어진다
  if (kind === 'flare') { shell.send({ t: 'flare', p: [me.pos.x, me.pos.y, me.pos.z] }); game.inv.flare--; renderSlots(); if (!slotIds()[cur]) switchTo(3); sfx('gun', 'pistol'); flareFx(me.pos.clone()); banner('🎆 신호탄! 보급상자가 와요'); return; }
  vm.swing(); sfx('throw');
  const col = { smoke: '#7a9a6a', molotov: '#8fd88f', flash: '#3a3d46' }[kind] || game.color;
  const m = new THREE.Mesh(kind === 'smoke' || kind === 'flash' ? new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10) : new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshToonMaterial({ color: col }));
  const p = leanEye().addScaledVector(me.forward(), 0.5); m.position.copy(p); scene.add(m);
  nades.push({ m, kind, v: me.forward().multiplyScalar(NADE.speed).add(new THREE.Vector3(0, NADE.up, 0)), t: kind === 'smoke' ? SMOKE.fuse : THROWS[kind] ? THROWS[kind].fuse : NADE.fuse });
  game.inv[kind]--; renderSlots(); if (!slotIds()[cur]) switchTo(3);
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i], p = n.m.position, vy0 = n.v.y, vx0 = n.v.x;
    stepNade(p, n.v, dt, MAP);
    n.t -= dt;
    // 화염병은 처음 닿는 곳에서 깨진다
    if (n.kind === 'molotov' && ((vy0 < -1 && n.v.y >= 0) || Math.sign(vx0) !== Math.sign(n.v.x))) n.t = 0;
    if (n.kind === 'molotov' && inWater(MAP, p.x, p.z)) { scene.remove(n.m); nades.splice(i, 1); continue; }
    if (n.t <= 0) { shell.send({ t: n.kind, p: [p.x, p.y, p.z] }); scene.remove(n.m); nades.splice(i, 1); }
  }
}

// ---------- 젤리 차량 ----------
//   F 로 타고 내리기 · WASD 운전 · Space 브레이크 · Shift 부스트(부스트 아이템이 있으면 더) · 마우스로 둘러보기
game.veh = new Map();
const VCOL = ['#ff8fc4', '#7cd8ff', '#ffd84d', '#9be7a7', '#c39bff', '#ffb36b'];
function setVehicles(list) {
  for (const a of list) {
    const [id, kind, x, y, z, yaw, hp, driver, dead, fuel] = Array.isArray(a) ? a : [a.id, a.kind, a.x, a.y, a.z, a.yaw, a.hp, a.driver, a.dead ? 1 : 0, a.fuel];
    let v = game.veh.get(id);
    if (!v) { v = { id, kind, x, y, z, yaw, speed: 0, mesh: buildVehicle(kind, VCOL[id % VCOL.length]) }; scene.add(v.mesh); game.veh.set(id, v); }
    const mine = game.drv && game.drv.v === v;
    if (!mine && !driver) Object.assign(v, { x, y, z, yaw });
    v.hp = hp; v.driver = driver; v.max = VEHICLES[kind].hp; if (!mine && fuel != null) v.fuel = fuel;
    if (dead && !v.dead) { v.dead = true; v.mesh.traverse((o) => { if (o.material?.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.25); } }); }
    if (driver === game.myId && !game.drv && game.mode === 'ground') enterVehicle(v);
    if (mine && driver !== game.myId) exitVehicle(true);
  }
}
function nearVehicle() { let best = null, bd = 3.6; for (const v of game.veh.values()) { if (v.dead || v.driver) continue; const d = Math.hypot(v.x - me.pos.x, v.z - me.pos.z); if (d < bd) { bd = d; best = v; } } return best; }
function enterVehicle(v) {
  cancelHeal(); reloadEnd = 0;
  game.mode = 'drive'; game.drv = { v, runAt: new Map() }; v.speed = 0;
  myBear.root.visible = true; myBear.setSeated(true); myChute.visible = false;
  game.prone = false; game.lean = 0; game.swim = false; game.vault = null; sfx('switch'); banner(`${v.kind === 'boat' ? '🚤' : '🚙'} ${VEHICLES[v.kind].name} · F 내리기${game.inv.gas ? ' · R 기름 넣기' : ''}`); tip(null);
}
function exitVehicle(forced) {
  const D = game.drv; if (!D) return;
  const v = D.v; game.drv = null; game.mode = 'ground';
  // 운전석 옆으로 내린다
  const side = new THREE.Vector3(-Math.cos(v.yaw), 0, Math.sin(v.yaw)).multiplyScalar(VEHICLES[v.kind].r + 0.9);
  me.pos.set(v.x + side.x, v.y, v.z + side.z); me.vel.set(0, 0, 0);
  myBear.root.visible = false; myBear.setSeated(false);
  if (!forced) shell.send({ t: 'exit', v: [v.x, v.y, v.z, v.yaw] });
  v.speed = 0; sfx('switch');
}
function driveStep(dt, kf, typing) {
  const D = game.drv, v = D.v;
  const crash = drive(v, { f: kf('KeyW') - kf('KeyS'), s: kf('KeyD') - kf('KeyA'), brake: !typing && keys.has('Space'), boost: !typing && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && game.boost > 0 }, dt, MAP);
  if (crash > 7) { game.shake = Math.min(1, crash / 22); sfx('land'); }
  me.pos.set(v.x, v.y, v.z);
  poseVehicle(v.mesh, v, dt);
  // 곰돌이는 운전석에
  const st = v.mesh.userData.seat;
  myBear.root.position.set(v.x, v.y, v.z); myBear.root.rotation.y = v.yaw + Math.PI; myBear.root.translateX(-st[0]); myBear.root.position.y += st[1]; myBear.root.translateZ(-st[2]);
  myBear.update(dt, 0, {}); myBear.arms[0].rotation.x = myBear.arms[1].rotation.x = -1.2;
  // 치기: 빠르면 앞에 있는 사람을 친다
  if (Math.abs(v.speed) > 7) {
    const now = performance.now();
    for (const o of game.others.values()) {
      if (!o.alive || !o.jumped || o.inAir || o.veh) continue;
      if (Math.hypot(o.pos.x - v.x, o.pos.z - v.z) < VEHICLES[v.kind].r + 0.7 && Math.abs(o.pos.y - v.y) < 1.5 && now - (D.runAt.get(o.id) || 0) > 800) { D.runAt.set(o.id, now); shell.send({ t: 'hit', to: o.id, w: 'car', part: 'body', n: Math.abs(v.speed) }); puff(o.pos.clone().setY(o.pos.y + 1), o.color, 10, 0.3, 4); sfx('hit'); }
    }
  }
  // 카메라: 차 뒤 위에서 (마우스로 둘러보기)
  const back = new THREE.Vector3(Math.sin(me.yaw) * 8, 3.2 - me.pitch * 5, Math.cos(me.yaw) * 8);
  camera.position.set(v.x, v.y + 1.2, v.z).add(back); camera.lookAt(v.x, v.y + 1.4, v.z);
}
function updateVehicles(dt) {
  for (const v of game.veh.values()) {
    if (game.drv?.v === v) continue;
    // 남이 운전 중이면 그 사람 위치 · 방향
    const o = v.driver ? game.others.get(v.driver) : null;
    if (o) { v.speed = o.speed || 0; v.x = o.pos.x; v.y = o.pos.y; v.z = o.pos.z; v.yaw = o.yaw; }
    else v.speed *= 0.9;
    poseVehicle(v.mesh, v, dt);
  }
}
// 걷다가 세워 둔 차에 막힌다
function pushFromVehicles() {
  for (const v of game.veh.values()) {
    if (game.drv?.v === v) continue;
    const r = VEHICLES[v.kind].r + 0.3, dx = me.pos.x - v.x, dz = me.pos.z - v.z, d = Math.hypot(dx, dz);
    if (d < r && d > 1e-3 && me.pos.y < v.y + 1.5) { me.pos.x = v.x + (dx / d) * r; me.pos.z = v.z + (dz / d) * r; }
  }
}

// ---------- 가방 (Tab) ----------
function toggleInv(force) {
  const el = $('inv'), open = force ?? el.classList.contains('hidden');
  if (open === invOpen()) return;
  el.classList.toggle('hidden', !open);
  // 열면 마우스를 풀어 단추를 누르게 (걷기는 계속) · 닫으면 바로 다시 조준
  if (open) { $('lockmsg').classList.add('hidden'); document.exitPointerLock?.(); renderInv(); } else if (game.mode === 'ground' || game.mode === 'drive') lock();
}
// X: 가방을 열지 않고 지금 든 것 버리기 (주무기 · 권총 · 투척 1개)
function dropCurrent() {
  const ids = slotIds(), id = ids[cur];
  if (cur === 3 || !id) { shell.toast('🔪 나이프는 버릴 수 없어요', 1000); return; }
  reloadEnd = 0; cancelHeal();
  if (cur === 4) shell.send({ t: 'drop', k: id });
  else shell.send({ t: 'drop', k: cur === 2 ? 'pistol' : 'gun', g: cur });
  sfx('switch'); shell.toast(`🫳 ${wpn(id)?.emoji || ''} ${wpn(id)?.name || ''} 버림`, 900);
}
function renderInv() {
  const I = game.inv, el = $('inv'); if (el.classList.contains('hidden')) return;
  const gunRow = (id, att, g, label) => {
    const w = id && wpn(id);
    if (!w) return `<div class="ig empty">${label} · 비어 있음</div>`;
    const a = ammo[id]?.mag ?? 0, t = AMMO_OF[id];
    return `<div class="ig"><div class="ig-top"><b>${w.emoji} ${esc(w.name)}</b><span>${a}/${magOf(w, att)} · ${AMMO[t]?.emoji || ''}${AMMO[t]?.name || ''}</span><button data-drop="${g === 2 ? 'pistol' : 'gun'}" data-g="${g}">버리기</button></div>
      <div class="ig-att">${SLOTS.map((sl) => { const k = att?.[sl]; return `<span class="slot${k ? ' on' : ''}" ${k ? `data-detach="${sl}" data-g="${g}" title="눌러서 빼기"` : ''}>${k ? `${ATTS[k].emoji} ${esc(ATTS[k].name)}` : { scope: '🔭 스코프', mag: '📦 탄창', muzzle: '🔩 총구', grip: '✊ 손잡이' }[sl]}</span>`; }).join('')}</div></div>`;
  };
  const used = ammoTotal(I), cap = CAP.ammo[I.bag];
  const cnt = (k, name, emoji, c) => `<div class="ii${I[k] ? '' : ' none'}"><span>${emoji} ${name}</span><b>${I[k] || 0}${c != null ? `/${c}` : ''}</b>${I[k] ? `<button data-drop="${k}">버리기</button>` : ''}</div>`;
  el.querySelector('.inv-body').innerHTML = `
    <div class="inv-col"><h3>🔫 무기</h3>${gunRow(I.guns[0], I.att[0], 0, '1번')}${gunRow(I.guns[1], I.att[1], 1, '2번')}${gunRow(I.pistol, I.patt, 2, '권총')}
      <h3>🧩 남는 부착물 <small>(맞는 총을 주우면 저절로 끼워요)</small></h3><div class="spare">${I.spare.map((a) => `<button data-drop="att" data-a="${a}">${ATTS[a].emoji} ${esc(ATTS[a].name)} ✕</button>`).join('') || '<span class="none">없음</span>'}</div></div>
    <div class="inv-col"><h3>🎒 ${BAG_NAME[I.bag]} <small>탄약 ${used}/${cap}</small></h3>
      ${Object.keys(AMMO).map((a) => `<div class="ii${I.ammo[a] ? '' : ' none'}"><span>${AMMO[a].emoji} ${AMMO[a].name}</span><b>${I.ammo[a] || 0}</b>${I.ammo[a] ? `<button data-drop="ammo" data-a="${a}">버리기</button>` : ''}</div>`).join('')}
      <h3>❤️ 회복 · 부스트 · 투척</h3>
      ${cnt('band', '젤리 붕대 (7)', '🩹', CAP.band[I.bag])}${cnt('med', '젤리 구급상자 (8)', '🧰', CAP.med[I.bag])}${cnt('drink', '에너지 젤리 음료 (9)', '🥤')}${cnt('pill', '진통 젤리 (0)', '💊')}${cnt('nade', '젤리 수류탄', '💣')}${cnt('smoke', '연막탄', '💨')}
      <h3>🛡️ 장비</h3><div class="ii"><span>⛑️ 헬멧</span><b>${I.helmet ? `${ARMOR_NAME[I.helmet]} · ${Math.max(0, Math.round(I.helmetD))}%` : '없음'}</b></div><div class="ii"><span>🦺 조끼</span><b>${I.armor ? `${ARMOR_NAME[I.armor]} · ${Math.max(0, Math.round(I.armorD))}%` : '없음'}</b></div></div>`;
  el.querySelectorAll('[data-drop]').forEach((b) => { b.onclick = () => { shell.send({ t: 'drop', k: b.dataset.drop, a: b.dataset.a, g: +b.dataset.g }); sfx('switch'); }; });
  el.querySelectorAll('[data-detach]').forEach((b) => { b.onclick = () => { shell.send({ t: 'drop', k: 'detach', slot: b.dataset.detach, g: +b.dataset.g }); sfx('switch'); }; });
}
$('inv-close').onclick = () => toggleInv(false);
// 지금 조준 배율 (스코프 · 저격총)
function zoomNow() {
  const w = curW(); if (!w || w.cls === 'knife' || w.cls === 'nade') return 1;
  const sc = ATTS[curAtt().scope]?.zoom;
  if (sc) return w.scope ? Math.max(sc, w.zoom) : sc;
  return w.scope ? w.zoom : Math.min(1.6, w.zoom);
}

// ---------- 흐름 ----------
function start(m) {
  loadBgMap(m.map);
  game.mode = 'plane'; game.myId = shell.myId; game.zones = m.zones; game.plane = m.plane; game.t0 = performance.now() + m.in;
  game.total = m.total; game.alive = m.total; game.kills = 0; game.place = 0; game.inv = emptyInv(); game.watch = null;
  ammo = {}; cur = 3; reloadEnd = 0; healing = null; me.hp = 100; me.alive = true; me.vel.set(0, 0, 0); me.pitch = -0.25; game.boost = 0; game.drv = null; throwK = 'nade';
  for (const v of game.veh.values()) scene.remove(v.mesh); game.veh.clear();
  toggleInv(false);
  for (const o of game.others.values()) o.remove(); game.others.clear();
  for (const it of game.loot.values()) scene.remove(it.mesh); game.loot.clear();
  game.squad = m.squad || 1; game.sq = m.sq || {}; game.squads = m.squads || 0; game.sqInfo = []; game.knocked = false; game.prone = false; game.lean = 0; game.vault = null; game.swim = false; game.reviving = null; game.revBar = null; game.refuel = null; game.free = null;
  for (const D of game.drops.values()) scene.remove(D.c.g); game.drops.clear(); for (const f of game.fires) scene.remove(f.g); game.fires = []; game.red = null; red.set(null);
  for (const mem of m.members) if (mem.id !== game.myId) game.others.set(mem.id, new Other(mem));
  addLoot(m.loot);
  setVehicles(m.veh || []);
  makeMyBear(shell.profile || { name: '나', color: game.color });
  vm = new ViewModel(game.color); vm.setWeapon(KNIFE, game.color);
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('spec').classList.add('hidden'); $('over').classList.add('hidden');
  ship.visible = true; zoneWall.visible = true; zoneEdge.visible = true;
  tip('🪂 F · Space 로 뛰어내려요', '젤리 비행선이 섬을 가로질러요. 끝까지 가면 자동으로 뛰어내려요');
  if (!locked()) $('lockmsg').classList.remove('hidden');
  renderSlots(); renderGear();
  banner(`${MAP.emoji} ${MAP.name} · ${m.total}명${game.squad > 1 ? ` · ${game.squad === 2 ? '듀오' : '스쿼드'} ${game.squads}팀` : ''}`);
  $('squad').classList.toggle('hidden', game.squad < 2);
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
  banner('🍬 착지! F 로 줍기'); setTimeout(() => { if (game.mode === 'ground' && !game.inv.guns[0]) tip('🔎 집 안에 무기 · 탄약 · 방어구 · 부착물이 있어요', 'F 줍기 · 차 타기 · 동료 살리기 · R 장전 · 1~5 무기 · 6~0 회복/부스트 · G 던지기 · Z 엎드리기 · Q/E 기울이기 · Tab 가방 · M 지도'); }, 1600);
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
  const all = [...game.others.values()].filter((o) => o.alive && o.jumped), mates = all.filter((o) => o.mate);
  const L = mates.length ? mates : all;
  if (!L.length) return;
  game.watch = L[(L.indexOf(game.watch) + 1) % L.length]; sfx('switch');
}
function die(byName) {
  arc.show(false);
  if (game.drv) { game.drv = null; myBear.setSeated(false); myBear.root.visible = false; }
  $('inv').classList.add('hidden');
  game.mode = 'dead'; me.alive = false; game.knocked = false; game.reviving = null; game.revBar = null; cancelHeal(); document.exitPointerLock?.();
  $('knock').classList.add('hidden');
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
  $('ov-title').innerHTML = won ? '🍬 마지막 곰젤리! 우승!' : out ? `💥 #${mine?.rank || game.place}등으로 탈락!` : `🏆 ${esc(m.rank[0]?.name || '')} 우승!`;
  const teams = new Set(m.rank.map((e) => e.sq)).size;
  $('ov-me').textContent = mine ? `${game.squad > 1 ? `우리 팀 #${mine.rank}등 / ${teams}팀` : `나는 #${mine.rank}등 / ${m.rank.length}명`} · ${mine.k}킬 · 피해 ${mine.dmg}` : '';
  if (won && game.squad > 1) $('ov-title').innerHTML = '🍬 마지막 곰젤리 팀! 우승!';
  const mySq = mine?.sq;
  $('ov-rank').innerHTML = m.rank.slice(0, 30).map((e) => `<div class="brow${e.id === game.myId ? ' me' : ''}${game.squad > 1 && e.sq === mySq ? ' mysq' : ''}"><span class="rk">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${e.bot ? '🤖 ' : ''}${esc(e.name)}</span><span class="sc">${e.k}<small>킬 · ${e.dmg}</small></span></div>`).join('');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (won) { confetti(); sfx('win'); } else sfx('lose');
  ship.visible = false;
  shell.show('over');
}

// ---------- 화면 표시 ----------
function renderSlots() {
  const ids = slotIds(), I = game.inv;
  $('bg-slots').innerHTML = ids.map((id, i) => {
    const w = id && wpn(id);
    const att = attOf(i), icons = w && i < 3 ? SLOTS.map((sl) => (att[sl] ? ATTS[att[sl]].emoji : '')).join('') : '';
    const nThrow = THROW_ORDER.filter((k) => I[k] > 0).length;
    const label = w ? `${w.emoji} ${w.name}${i === 4 ? ` ×${I[id]}${nThrow > 1 ? ' (5: 바꾸기)' : ''}` : ''}${i < 2 && w.auto ? (game.single[id] ? ' ☝️' : ' 🔁') : ''}` : ['빈 주무기', '빈 주무기', '빈 권총', '', '투척 무기 없음'][i];
    const am = w && i < 3 ? ` <small>${ammo[id]?.mag ?? 0}/${I.ammo?.[AMMO_OF[id]] || 0}</small>` : '';
    return `<span class="${i === cur ? 'on' : ''}${w ? '' : ' empty'}">${i + 1} · ${esc(label)}${am}${icons ? ` <i>${icons}</i>` : ''}</span>`;
  }).join('');
  $('heals').innerHTML = [['adren', '6', '💉'], ['band', '7', '🩹'], ['med', '8', '🧰'], ['drink', '9', '🥤'], ['pill', '0', '💊']].filter(([k]) => k !== 'adren' || I.adren).map(([k, key, e]) => `<span class="${I[k] ? '' : 'none'}">${key} ${e} ×${I[k] || 0}</span>`).join('') + `${I.gas ? `<span>⛽ ×${I.gas}</span>` : ''}<span class="tabk">Tab 🎒 가방 · X 버리기</span>`;
  renderInv();
}
function renderGear() {
  const I = game.inv, a = I.armor, h = I.helmet;
  const dur = (lv, d) => (lv ? `<i class="dur"><b style="width:${Math.max(0, Math.min(100, d))}%"></b></i>` : '');
  $('gear').innerHTML = `<span class="l${h}">⛑️ ${h ? ARMOR_NAME[h] : '없음'}${dur(h, I.helmetD)}</span><span class="l${a}">🦺 ${a ? ARMOR_NAME[a] : '없음'}${dur(a, I.armorD)}</span><span class="l${I.bag}">🎒 ${I.bag ? I.bag + '단계' : '없음'}</span>`;
  if (myBear) dressGear(myBear, a, h, I.bag);
}
function hud(now) {
  const w = curW(), a = ammo[w?.id];
  $('hp-n').textContent = Math.max(0, Math.round(me.hp)); $('hp-bar').firstElementChild.style.width = `${Math.max(0, me.hp)}%`;
  $('w-name').textContent = `${w?.emoji || ''} ${w?.name || ''}${w?.auto ? (game.single[w.id] ? ' · 단발 (B)' : ' · 연사 (B)') : ''}${reloadEnd ? ' · 장전 중…' : ''}`;
  $('ammo-n').textContent = a ? a.mag : w?.cls === 'nade' ? game.inv[w.id] : ''; $('ammo-r').textContent = a ? `/ ${game.inv.ammo?.[AMMO_OF[w.id]] || 0}` : '';
  $('boost').style.width = `${game.boost || 0}%`; $('boost').parentElement.classList.toggle('hidden', !(game.boost > 0));
  $('alive').textContent = `🪂 생존 ${game.alive}${game.squad > 1 ? ` · 팀 ${game.squads}` : ''}`; $('kills').textContent = `🎯 ${game.kills}킬`;
  // 몸 상태 표시
  $('stance').textContent = game.mode !== 'ground' ? '' : game.knocked ? '💫 기절' : game.swim ? '🏊 헤엄' : game.vault ? '🧗 넘는 중' : me.prone > 0.5 ? '🛌 엎드림 (Z)' : me.crouch > 0.5 ? '🧎 앉음' : '';
  $('stance').classList.toggle('hidden', !$('stance').textContent);
  $('knock').classList.toggle('hidden', !game.knocked); if (game.knocked) $('knock-bar').style.width = `${Math.max(0, me.hp)}%`;
  if (game.revBar) { const k = Math.min(1, 1 - (game.revBar.end - now) / game.revBar.ms); $('rev').classList.remove('hidden'); $('rev-txt').textContent = game.revBar.label; $('rev-bar').style.width = `${k * 100}%`; } else $('rev').classList.add('hidden');
  renderSquad();
  const Z = zoneAt(game.zones, sec()), mm = Math.floor(Z.until / 60), ss = String(Math.floor(Z.until % 60)).padStart(2, '0');
  const zt = $('zone-txt');
  zt.textContent = sec() < 0 ? '곧 출발!' : Z.next ? (Z.shrinking ? `🌀 자기장이 줄어드는 중 ${mm}:${ss}` : `⏳ ${mm}:${ss} 뒤 자기장이 줄어요`) : '🌀 마지막 자기장';
  zt.classList.toggle('warn', Z.shrinking);
  const out = game.mode !== 'dead' && Math.hypot(me.pos.x - Z.x, me.pos.z - Z.z) > Z.r && game.mode !== 'plane';
  $('zone-tint').style.opacity = out ? '1' : '0';
  // 줍기 안내
  const mate = game.mode === 'ground' && !game.knocked ? reviveTarget() : null, it = game.mode === 'ground' && !game.knocked && !mate ? nearestLoot() : null, car = game.mode === 'ground' && !game.knocked && !it && !mate ? nearVehicle() : null;
  if (mate) $('prompt').innerHTML = `<kbd>F</kbd>누르고 있기: 💫 ${esc(mate.name)} 살리기`;
  else if (it) { const swap = (it.k === 'gun' && game.inv.guns[0] && game.inv.guns[1]) || (it.k === 'pistol' && game.inv.pistol); $('prompt').innerHTML = `<kbd>F</kbd>${esc(itemLabel(it, wpn))}${swap ? ' (바꾸기)' : ''}`; }
  else if (car) $('prompt').innerHTML = `<kbd>F</kbd>${car.kind === 'boat' ? '🚤' : '🚙'} ${VEHICLES[car.kind].name} 타기 <small>${Math.round((car.hp / car.max) * 100)}% · ⛽ ${Math.round(car.fuel ?? 100)}%</small>`;
  else if (game.mode === 'drive') { const v = game.drv.v, fu = Math.round(v.fuel ?? 100); $('prompt').innerHTML = `${v.kind === 'boat' ? '🚤' : '🚙'} ${Math.round(Math.abs(v.speed) * 3.6)}km/h · 차 ${Math.max(0, Math.round((v.hp / v.max) * 100))}% · <span class="${fu < 20 ? 'low' : ''}">⛽ ${fu}%</span>${game.inv.gas && fu < 100 ? ' · <kbd>R</kbd>기름 넣기' : ''} · <kbd>F</kbd>내리기`; }
  $('prompt').classList.toggle('hidden', !mate && !it && !car && game.mode !== 'drive');
  const moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  const gap = 6 + (mouseR ? 0 : 6) + (moving ? 10 : 0) + (me.onGround ? 0 : 12) + vm.kickT * 14;
  const c = $('cross'); c.classList.toggle('ads', mouseR && w?.cls !== 'knife');
  c.querySelector('.u').style.bottom = c.querySelector('.d').style.top = c.querySelector('.l').style.right = c.querySelector('.r').style.left = `${gap}px`;
  // 조준: 4배율 이상 · 저격총은 원형 스코프, 레드닷 · 2배율은 빨간 점
  const z = zoomNow(), sc = curAtt().scope, ads = mouseR && game.mode === 'ground' && w?.cls !== 'knife' && w?.cls !== 'nade';
  const bigScope = ads && (z >= 3.5 || (w?.scope && !sc));
  c.classList.toggle('hidden', game.mode !== 'ground' || bigScope || (ads && !!sc) || game.swim || game.knocked);
  $('scope').classList.toggle('hidden', !bigScope);
  $('scope').dataset.z = bigScope ? `${Math.round(z)}x` : '';
  $('reddot').classList.toggle('hidden', !(ads && !bigScope && sc));
  if (healing) $('heal-bar').querySelector('i').style.width = `${Math.min(100, (1 - (healing.end - now) / healing.dur) * 100)}%`;
  drawMap($('mini'), 220, true, Z);
  if (bigMap) drawMap($('big'), 720, false, Z);
}
function renderSquad() {
  if (game.squad < 2) return;
  const key = JSON.stringify(game.sqInfo.map((q) => q.slice(0, 4))); if (key === game.sqKey) return; game.sqKey = key;
  $('squad').innerHTML = game.sqInfo.map(([id, hp, kn, al]) => { const o = id === game.myId ? { name: '나' } : game.others.get(id); const col = !al ? '#666' : kn ? '#ff5a5a' : hp > 60 ? '#7be04a' : hp > 30 ? '#ffd23b' : '#ff7a5a'; return `<div class="sm${al ? '' : ' dead'}${id === game.myId ? ' me' : ''}"><b>${!al ? '💀' : kn ? '💫' : '🐻'}</b><span>${esc(o?.name || '?')}</span><i><u style="width:${al ? hp : 0}%;background:${col}"></u></i></div>`; }).join('');
}
function drawMap(cv, S, mini, Z) {
  const x = cv.getContext('2d'), k = S / (mini ? 120 : BG_SIZE + 20);
  const cx = mini ? me.pos.x : 0, cz = mini ? me.pos.z : 0; // 작은 지도는 나를 가운데
  const P = (wx, wz) => [S / 2 + (wx - cx) * k, S / 2 + (wz - cz) * k];
  x.clearRect(0, 0, S, S);
  x.fillStyle = MAP.sea || '#3fa0d8'; x.fillRect(0, 0, S, S);
  const [ix, iz] = P(-BG_SIZE / 2, -BG_SIZE / 2); x.fillStyle = MAP.land || '#8fc979'; x.beginPath(); x.roundRect(ix, iz, BG_SIZE * k, BG_SIZE * k, 12 * k); x.fill();
  x.fillStyle = 'rgba(110,100,120,.8)'; for (const r of MAP.roads) { const [a, b] = P(r.x - r.w / 2, r.z - r.d / 2); x.fillRect(a, b, r.w * k, r.d * k); }
  x.fillStyle = 'rgba(80,60,60,.55)'; for (const b of MAP.boxes) { if (b.hide || b.h < 1.5 || b.y > 0.5) continue; const [a, c] = P(b.x - b.w / 2, b.z - b.d / 2); x.fillRect(a, c, Math.max(1, b.w * k), Math.max(1, b.d * k)); }
  x.font = `${mini ? 11 : 15}px Jua`; x.textAlign = 'center'; x.fillStyle = '#fff';
  for (const p of MAP.places || []) { const [a, b] = P(p.x, p.z); if (a > 0 && a < S && b > 0 && b < S) { x.lineWidth = 3; x.strokeStyle = 'rgba(20,10,40,.7)'; x.strokeText(p.name, a, b); x.fillText(p.name, a, b); } }
  // 자기장: 지금(파랑) · 다음(흰 줄)
  if (Z) {
    const [zx, zz] = P(Z.x, Z.z);
    x.save(); x.fillStyle = 'rgba(40,80,220,.35)'; x.beginPath(); x.rect(0, 0, S, S); x.arc(zx, zz, Z.r * k, 0, Math.PI * 2, true); x.fill('evenodd'); x.restore();
    x.strokeStyle = '#4c8dff'; x.lineWidth = 2; x.beginPath(); x.arc(zx, zz, Z.r * k, 0, Math.PI * 2); x.stroke();
    if (Z.next) { const [nx, nz] = P(Z.next.x, Z.next.z); x.strokeStyle = '#ffffff'; x.setLineDash([6, 4]); x.beginPath(); x.arc(nx, nz, Z.next.r * k, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
  }
  // 레드존 (빨강) · 보급상자 (빨간 네모) · 분대 동료 (하늘색 점)
  if (game.red) { const [rx, rz] = P(game.red.x, game.red.z); x.fillStyle = 'rgba(255,50,50,.35)'; x.beginPath(); x.arc(rx, rz, game.red.r * k, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#ff3b3b'; x.lineWidth = 2; x.stroke(); }
  for (const D of game.drops.values()) { const [a, b] = P(D.x, D.z); x.fillStyle = '#ff3b3b'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.rect(a - 4, b - 4, 8, 8); x.fill(); x.stroke(); }
  for (const [id, , kn, al, px, pz] of game.sqInfo) { if (id === game.myId || !al) continue; const [a, b] = P(px, pz); x.fillStyle = kn ? '#ff5a5a' : '#4cc3ff'; x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(a, b, 5, 0, Math.PI * 2); x.fill(); x.stroke(); }
  // 비행선 길
  if (game.mode === 'plane' || game.mode === 'fall') { const [a, b] = P(game.plane.a[0], game.plane.a[1]), [c, d] = P(game.plane.b[0], game.plane.b[1]); x.strokeStyle = 'rgba(255,143,196,.9)'; x.lineWidth = 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); x.setLineDash([]); }
  // 차 (분홍 네모)
  for (const v of game.veh.values()) { if (v.dead) continue; const [a, b] = P(v.x, v.z); x.save(); x.translate(a, b); x.rotate(-v.yaw); x.fillStyle = v.driver ? '#ffd84d' : '#ff8fc4'; x.strokeStyle = '#2b1d5c'; x.lineWidth = 1.5; x.fillRect(-3, -5, 6, 10); x.strokeRect(-3, -5, 6, 10); x.restore(); }
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
    const s = sec(), typing = !locked() && !invOpen();
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
      if (reloadEnd && now >= reloadEnd) finishReload();
      // 헤엄: 물 칸 안 · 땅 높이 · 기절: 엎드려 기어가기만
      game.swim = inWater(MAP, me.pos.x, me.pos.z, 0.3) && me.pos.y < 0.3;
      if (game.swim) game.prone = false;
      const inp = { f: kf('KeyW') - kf('KeyS'), s: kf('KeyD') - kf('KeyA'), jump: keys.has('Space') && !typing && !game.vault && !game.swim && !game.knocked, crouch: !typing && !game.swim && (keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')), prone: (game.prone || game.knocked) && !game.swim, sprint: !typing && !game.swim && !game.knocked && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !mouseL && !healing, ads: mouseR && !game.swim && !game.knocked };
      if (healing || game.reviving || game.revBar?.me) { inp.f *= game.reviving ? 0 : 0.4; inp.s *= game.reviving ? 0 : 0.4; }
      inp.speedMul = (game.boost >= 60 ? 1.06 : 1) * (game.swim ? 0.55 : 1) * (game.knocked ? 1.6 : 1); // 부스트가 높으면 조금 빨라진다 · 헤엄은 느리게
      // 기울이기 (Q · E 누르고 있기)
      const lt = typing || game.swim || game.knocked || !me.onGround ? 0 : (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
      game.lean += (lt - game.lean) * Math.min(1, dt * 10);
      if (game.vault) {
        // 넘기: 위로 올랐다가 앞으로
        const V = game.vault; V.t += dt / V.dur; const k = Math.min(1, V.t);
        me.pos.lerpVectors(V.from, V.to, k); me.pos.y = k < 0.5 ? V.from.y + (V.up - V.from.y) * (k * 2) : V.up + (V.to.y - V.up) * ((k - 0.5) * 2);
        me.vel.set(0, 0, 0); if (k >= 1) { game.vault = null; me.onGround = true; }
      } else for (const e of me.update(dt, inp, MAP)) sfx(e, null, e === 'step' ? 0.6 : 1);
      if (game.reviving) { const o = game.others.get(game.reviving.id); if (!o || !o.knocked || o.pos.distanceTo(me.pos) > 3 || !keys.has('KeyF')) stopRevive(); }
      pushFromVehicles();
      if (mouseL && locked()) shoot(now);
      { const tw = curW(), on = tw?.cls === 'nade'; arc.show(on); if (on) { const k = tw.id === 'smoke'; arc.update(me.eye().addScaledVector(me.forward(), 0.5), me.forward().multiplyScalar(NADE.speed).add(new THREE.Vector3(0, NADE.up, 0)), MAP, k ? SMOKE.fuse : NADE.fuse, k ? SMOKE.r : NADE.r); } }
      if (kickBack > 0) { const r = Math.min(kickBack, dt * 1.2); me.pitch -= r; kickBack -= r; }
      if (healing && now >= healing.end) { shell.send({ t: 'heal', k: healing.k }); cancelHeal(); }
      camera.position.copy(me.viewEye());
      if (game.lean) { camera.position.addScaledVector(new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)), game.lean * 0.5); camera.position.y -= Math.abs(game.lean) * 0.12; }
      if (game.swim) camera.position.y = me.pos.y + WATER_Y + 0.2 + Math.sin(t * 2.4) * 0.04;
      camera.rotation.set(me.pitch + (game.free?.pitch || 0), me.yaw + (game.free?.yaw || 0), -game.lean * 0.2);
      if (game.shake > 0) { game.shake = Math.max(0, game.shake - dt * 1.6); const k = game.shake * game.shake * 0.35; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.rotation.z += (Math.random() - 0.5) * k * 0.3; }
      const zoom = mouseR ? zoomNow() : 1;
      const fov = (me.sprinting ? 80 : 72) / zoom;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
      vm.update(dt, camera.aspect, Math.hypot(me.vel.x, me.vel.z) > 1.5 && me.onGround, mouseR, t);
      vm.rig.visible = vm.rig.visible && !game.swim && !game.knocked && !game.vault && !game.free;
    } else if (game.mode === 'drive') {
      arc.show(false);
      driveStep(dt, kf, typing);
      if (healing && now >= healing.end) { shell.send({ t: 'heal', k: healing.k }); cancelHeal(); }
      if (game.refuel) { $('heal-bar').querySelector('i').style.width = `${Math.min(100, (1 - (game.refuel.end - now) / 4000) * 100)}%`; if (now >= game.refuel.end) { game.refuel = null; $('heal-bar').classList.add('hidden'); shell.send({ t: 'refuel', id: game.drv.v.id }); game.drv.v.fuel = Math.min(100, (game.drv.v.fuel ?? 0) + 60); sfx('reload'); } }
      if (game.free) camera.rotation.y += game.free.yaw * 0.6;
      if (camera.fov !== 72) { camera.fov = 72; camera.updateProjectionMatrix(); }
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
    water.update(t);
    red.update(t, game.red, now); if (game.red && now > game.red.end) { game.red = null; red.set(null); }
    for (const D of game.drops.values()) {
      const k = Math.min(1, 1 - (D.land - now) / D.ms), y = D.landed ? D.gy : 90 - (90 - D.gy) * k;
      D.c.g.position.y = y; D.c.chute.visible = !D.landed; D.c.light.material.opacity = 0.5 + Math.sin(t * 6) * 0.4;
      if (D.landed && (D.c.smokeT -= dt) <= 0) { D.c.smokeT = 0.12; puff(new THREE.Vector3(D.x, D.gy + 1.4, D.z), '#ff5a4a', 1, 1.6, 0.6); fx[fx.length - 1].v.y = 3.5; fx[fx.length - 1].t = fx[fx.length - 1].life = 3; }
      // 상자 안 아이템을 다 가져가면 상자도 사라진다
      if (D.landed && now - D.landAt > 3000 && ![...game.loot.values()].some((it) => it.crate === D.id)) { scene.remove(D.c.g); game.drops.delete(D.id); }
    }
    for (let i = game.fires.length - 1; i >= 0; i--) { const f = game.fires[i]; updateFire(f, t); if (now > f.end) { scene.remove(f.g); game.fires.splice(i, 1); } }
    for (const o of game.others.values()) o.update(dt);
    updateVehicles(dt);
    // 아이템 빙글빙글 (가까운 것만)
    for (const it of game.loot.values()) { const d = Math.abs(it.x - camera.position.x) + Math.abs(it.z - camera.position.z); it.mesh.visible = d < 160; if (d < 40) { it.mesh.userData.spin.rotation.y += dt * 1.2; it.mesh.userData.spin.position.y = 0.45 + Math.sin(t * 2 + it.id) * 0.06; } }
    // 내 상태 보내기 (flags: 1 앉기 · 2 조준 · 4 낙하산 · 8 비행선 · 자유낙하)
    sendT -= dt;
    if (sendT <= 0 && game.mode !== 'dead') {
      sendT = 0.066;
      if (game.mode === 'drive') { const v = game.drv.v; shell.send({ t: 'st', p: [v.x, v.y, v.z, v.yaw, 0, 16, v.id, Math.round(v.fuel ?? 100)] }); } // 운전 중: 차 위치 · 방향 · 기름
      else { const f = game.mode === 'plane' ? 8 : game.mode === 'fall' ? (game.fall.chute ? 4 : 8) : (me.crouch > 0.5 ? 1 : 0) | (mouseR ? 2 : 0) | (me.prone > 0.5 && !game.knocked ? 32 : 0) | (game.knocked ? 64 : 0) | (game.swim ? 128 : 0); shell.send({ t: 'st', p: [me.pos.x, me.pos.y, me.pos.z, me.yaw, me.pitch, f, 0, Math.round(game.lean * 100) / 100] }); }
    }
    hud(now);
  } else {
    // 처음 화면: 섬 위를 천천히 돈다
    const a = t * 0.04;
    camera.position.set(Math.cos(a) * 170, 90, Math.sin(a) * 170); camera.lookAt(0, 0, 0);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
  }
  updateFx(dt); updateBig(dt);
  renderer.clear(); renderer.render(scene, camera);
  if (game.mode === 'ground' && vm.rig.visible) vm.render(renderer);
}

// ---------- 공용 틀 ----------
const shell = new Shell({
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; } },
  key: 'jellydrop', title: '🪂 젤리드롭', subtitle: '젤리 비행선에서 뛰어내려 무기를 줍고<br>줄어드는 젤리 자기장 속 마지막 곰돌이가 되어요!', wsPath: '/drop-ws', max: 30,
  multiLabel: '👥 같이 하기', roomIcon: '🪂', startLabel: '🪂 비행선 출발!',
  keysHelp: 'F/Space 뛰어내리기 · WASD 이동 · 마우스 조준 · 클릭 사격 · 우클릭 조준(스코프 배율) · F 줍기 · 차 타기 · 동료 살리기(누르고 있기) · R 장전(차 안: 기름) · 1~5 무기(5 여러 번: 투척 고르기) · 6 아드레날린 · 7 붕대 · 8 구급상자 · 9 음료 · 0 진통제 · G 던지기 · X 버리기 · B 단발/연사 · Z 엎드리기 · Q/E 기울이기 · Space 점프 · 넘기 · Alt 둘러보기 · Tab 가방 · Shift 달리기 · C/Ctrl 앉기 · M 지도',
  buttons: [{ id: 'practice-btn', label: '🪂 바로 하기 <small>젤리봇과 배틀로얄</small>', onClick: () => practice() }],
  extraRow: [{ label: '🖱️ 마우스 감도', onClick: () => openSens('bg') }],
  screens: ['over'],
  describe: (o = {}) => { const m = BG_MAPS.find((x) => x.id === o.map); return `${m ? `${m.emoji} ${m.name}` : '🎲 무작위 맵'} · ${['', '솔로', '듀오', '', '스쿼드'][o.squad || 1]} · 🪂 ${o.fill || 24}명`; },
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onProfile: (p) => { game.color = p.color; },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onChatClose: () => { if (game.mode !== 'title' && game.mode !== 'over' && game.mode !== 'dead') lock(); },
  onEscape: () => { if (bigMap) { bigMap = false; $('bigmap').classList.add('hidden'); return true; } if (invOpen()) { toggleInv(false); return true; } return false; },
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
game.shell = shell; // 점검용
shell.pickOpts = () => ({ fill: game.pick.fill, map: game.pick.map, squad: game.pick.squad });
shell.on('snap', (m) => { for (const [id, ...st] of m.p) { if (id === game.myId) continue; const o = game.others.get(id); if (o) o.set(st); } });
shell.on('jumped', (m) => { const o = game.others.get(m.id); if (o) { o.jumped = true; o.pos.copy(o.tgt); } });
shell.on('loot', (m) => onLoot(m));
shell.on('inv', (m) => onInv(m));
shell.on('hp', (m) => { me.hp = m.hp; });
shell.on('boost', (m) => { game.boost = m.v; });
shell.on('veh', (m) => setVehicles(m.v));
shell.on('gear', (m) => { const o = game.others.get(m.id); if (o) dressGear(o.bear, m.a, m.h, m.b); });
shell.on('smoke', (m) => { smoke(scene, new THREE.Vector3(...m.p), 7, 18); sfx('throw'); });
shell.on('full', (m) => shell.toast(m.text, 1300));
shell.on('broke', (m) => { shell.toast(m.k === 'helmet' ? '⛑️ 헬멧이 부서졌어요!' : '🦺 조끼가 부서졌어요!', 1600); sfx('hurt'); });
shell.on('wpn', (m) => { game.others.get(m.id)?.setGun(m.w); });
shell.on('fire', (m) => {
  if (m.ms) { game.fires.push(makeFire(scene, new THREE.Vector3(...m.p), m.r || 3.6, m.ms)); sfx('boom', null, Math.max(0.1, 0.5 - new THREE.Vector3(...m.p).distanceTo(camera.position) / 120)); return; }
  const o = game.others.get(m.by); if (!o || !Array.isArray(m.o)) return;
  const w = wpn(m.w); o.firedT = 0.8;
  const eye = new THREE.Vector3(...m.o), d = new THREE.Vector3(...m.d).normalize();
  const tt = rayBoxes(MAP, eye, d, 300), st = eye.clone().addScaledVector(d, 0.7); st.y -= 0.25;
  const dist = eye.distanceTo(camera.position);
  // 소음기: 멀리서는 궤적도 안 보이고 소리도 작다
  if (!m.s || dist < 30) tracer(st, eye.clone().addScaledVector(d, tt), w?.tracer);
  const far = m.s ? 45 : 140;
  if (dist < far) sfx('gun', w?.cls, Math.max(0.05, 1 - dist / far) * (m.s ? 0.35 : 0.8));
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
  game.alive = m.alive; if (m.squads != null) game.squads = m.squads;
  { const ok = game.others.get(m.to); if (ok) ok.knocked = false; }
  const K = m.by === game.myId ? { name: '나' } : game.others.get(m.by), V = m.to === game.myId ? { name: '나' } : game.others.get(m.to);
  const w = wpn(m.w);
  const row = document.createElement('div'); row.className = m.by === game.myId || m.to === game.myId ? 'me' : '';
  row.innerHTML = m.w === 'car' ? `${esc(K?.name || '?')} 🚙 ${esc(V?.name || '?')}` : m.w === 'zone' ? `🌀 ${esc(V?.name || '?')} 자기장에 녹음` : m.w === 'leave' ? `🚪 ${esc(V?.name || '?')} 나감` : `${esc(K?.name || '?')} ${w?.emoji || '💥'}${m.head ? '🎯' : ''} ${esc(V?.name || '?')}`;
  $('feed').prepend(row); setTimeout(() => row.remove(), 5000);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
  const o = game.others.get(m.to); if (o) { o.alive = false; puff(o.pos.clone().setY(o.pos.y + 1), o.color, 14, 0.35, 4); }
  if (m.by === game.myId && m.to !== game.myId) { game.kills++; sfx('kill'); banner(m.head ? '🎯 헤드샷!' : `💥 ${game.kills}킬!`); }
  if (m.to === game.myId) { game.place = m.place; die(m.w === 'zone' ? null : K?.name); }
});
shell.on('boom', (m) => {
  const p = new THREE.Vector3(...m.p);
  explosion(scene, p, NADE.r);
  sfx('boom', null, Math.max(0.15, 1 - p.distanceTo(camera.position) / 110));
  // 가까울수록 크게 흔들리고 하얗게 번쩍
  const d = p.distanceTo(camera.position);
  game.shake = Math.max(game.shake || 0, Math.max(0, 1 - d / 26) * 0.9);
  if (d < 12) { const f = document.getElementById('nade-flash') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'nade-flash' }); f.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;background:#fff8e8;transition:opacity .6s;opacity:' + (0.85 * (1 - d / 12)).toFixed(2); requestAnimationFrame(() => requestAnimationFrame(() => { f.style.opacity = '0'; })); }
});
shell.on('gone', (m) => { game.others.get(m.id)?.remove(); game.others.delete(m.id); });
// 기절 · 살리기
shell.on('knock', (m) => {
  const V = m.id === game.myId ? { name: '나' } : game.others.get(m.id), K = m.by === game.myId ? { name: '나' } : game.others.get(m.by);
  const row = document.createElement('div'); row.className = m.by === game.myId || m.id === game.myId ? 'me' : '';
  row.innerHTML = `${esc(K?.name || '?')} 💫 ${esc(V?.name || '?')} 기절`; $('feed').prepend(row); setTimeout(() => row.remove(), 5000);
  const o = game.others.get(m.id); if (o) { o.knocked = true; puff(o.pos.clone().setY(o.pos.y + 0.6), '#ffd84d', 8, 0.25, 2); }
  if (m.id === game.myId) {
    game.knocked = true; game.prone = true; game.lean = 0; game.vault = null; cancelHeal(); if (game.reviving) stopRevive(); sfx('hurt');
    if (game.drv) { const v = game.drv.v; game.drv = null; game.mode = 'ground'; me.pos.set(v.x + 2, v.y, v.z); myBear.root.visible = false; myBear.setSeated(false); }
    banner('💫 기절! 동료가 살려 줄 수 있어요');
  }
  if (m.by === game.myId && m.id !== game.myId) { sfx('kill'); banner('💫 기절시켰어요!'); }
});
shell.on('reviving', (m) => {
  if (m.to === game.myId) game.revBar = { end: performance.now() + m.ms, ms: m.ms, label: `💚 ${game.others.get(m.by)?.name || '동료'}이(가) 살리는 중…`, me: true };
  if (m.by === game.myId) game.revBar = { end: performance.now() + m.ms, ms: m.ms, label: `💚 ${game.others.get(m.to)?.name || '동료'} 살리는 중… (F 계속)` };
});
shell.on('revive-stop', (m) => { if (m.to === game.myId || m.by === game.myId) { game.revBar = null; if (m.by === game.myId) game.reviving = null; } });
shell.on('revived', (m) => {
  const o = game.others.get(m.id); if (o) { o.knocked = false; puff(o.pos.clone().setY(o.pos.y + 1), '#9be7a7', 14, 0.3, 3); }
  if (m.id === game.myId) { game.knocked = false; game.prone = false; me.hp = 20; banner('💚 살아났어요!'); sfx('spawn'); }
  if (m.by === game.myId) { game.reviving = null; banner('💚 동료를 살렸어요!'); sfx('spawn'); }
  if (m.id === game.myId || m.by === game.myId) game.revBar = null;
});
shell.on('sq', (m) => { game.sqInfo = m.m; for (const [id, , kn, al] of m.m) { const o = game.others.get(id); if (o) o.knocked = !!kn && !!al; } });
// 레드존 · 보급상자 · 화염병 · 섬광탄
shell.on('red', (m) => { const now = performance.now(); game.red = { x: m.x, z: m.z, r: m.r, start: now + m.in, end: now + m.in + m.dur }; red.set(game.red); banner('🔴 레드존! 건물 안으로 피해요'); sfx('whizz'); });
shell.on('drop', (m) => {
  const gy = Math.max(0, floorAt(MAP, m.x, m.z, 30));
  const D = { id: m.id, x: m.x, z: m.z, ms: m.ms, land: performance.now() + m.ms, gy, landed: false, c: makeCrate(scene, m.x, m.z) };
  game.drops.set(m.id, D);
  shell.toast(m.flare === game.myId ? '🎆 내가 부른 보급상자가 떨어지는 중!' : '📦 보급상자가 떨어지는 중! (지도에 빨간 네모)', 2200);
});
shell.on('landed', (m) => { const D = game.drops.get(m.id); if (D) { D.landed = true; D.landAt = performance.now(); sfx('land'); } });
shell.on('flash', (m) => {
  const p = new THREE.Vector3(...m.p), e = camera.position.clone(), d = p.distanceTo(e);
  puff(p, '#ffffff', 12, 1.2, 4); sfx('boom', null, Math.max(0.1, 0.8 - d / 60));
  if (game.mode === 'dead' || d > 24) return;
  const dir = p.clone().sub(e).normalize(), look = new THREE.Vector3(); camera.getWorldDirection(look);
  const seen = rayBoxes(MAP, e, dir, d) >= d - 0.3;
  const k = (seen ? Math.max(0.3, (look.dot(dir) + 1) / 2) : 0.15) * Math.max(0, 1 - d / 24);
  if (k < 0.05) return;
  const f = $('flashw'); f.style.transition = 'none'; f.style.opacity = String(Math.min(1, k * 1.6)); void f.offsetWidth;
  f.style.transition = `opacity ${1.5 + k * 3}s ease-in`; f.style.opacity = '0';
  game.shake = Math.max(game.shake || 0, k * 0.4);
});
function optsUI(el, o, editable, set) {
  const mp = o.map || 'random';
  el.innerHTML = `<div class="map-pick bgmaps">${[{ id: 'random', name: '무작위', emoji: '🎲', desc: '판마다 다른 맵' }, ...BG_MAPS].map((m) => `<button data-m="${m.id}" class="${m.id === mp ? 'on' : ''}" ${editable ? '' : 'disabled'} title="${esc(m.desc)}"><b>${m.emoji}</b>${esc(m.name)}</button>`).join('')}</div>
    <div class="note">${esc(([{ id: 'random', desc: '🎲 젤리 섬 · 눈꽃 섬 · 캔디 사막 중 하나' }, ...BG_MAPS].find((m) => m.id === mp) || {}).desc || '')}</div>
    <div class="seg sqseg">${[[1, '🧍 솔로'], [2, '👯 듀오'], [4, '👨‍👩‍👧‍👦 스쿼드']].map(([n, l]) => `<button data-sq="${n}" class="${(o.squad || 1) === n ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}</button>`).join('')}</div>
    <div class="note">${(o.squad || 1) > 1 ? '같은 방 친구끼리 먼저 한 팀 · 빈자리는 젤리봇 · 쓰러지면 기절 → 동료가 F 로 살려요' : '혼자서 끝까지 살아남기'}</div>
    <div class="bots-row">🪂 판 인원 (젤리봇으로 채우기) ${editable ? '<button data-b="-2">−</button>' : ''}<b>${o.fill ?? 24}</b>${editable ? '<button data-b="2">＋</button>' : ''}</div>`;
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ fill: Math.max(2, Math.min(30, (o.fill ?? 24) + +b.dataset.b)) }); });
  el.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => set({ map: b.dataset.m }); });
  el.querySelectorAll('[data-sq]').forEach((b) => { b.onclick = () => set({ squad: +b.dataset.sq }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); if (game.mode === 'title') loadBgMap(game.pick.map === 'random' ? 'island' : game.pick.map); }); }
function practice() { shell.sendAfterHello({ t: 'practice', opts: { fill: game.pick.fill, map: game.pick.map, squad: game.pick.squad } }); }
$('again-btn').onclick = () => { if (game.lastPractice) return practice(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() {
  game.mode = 'title'; game.zones = null; shell.multi = false; shell.playing = false; document.exitPointerLock?.();
  for (const id of ['hud', 'lockmsg', 'spec', 'bigmap', 'scope']) $(id).classList.add('hidden');
  for (const o of game.others.values()) o.remove(); game.others.clear();
  for (const it of game.loot.values()) scene.remove(it.mesh); game.loot.clear();
  ship.visible = false; zoneWall.visible = false; zoneEdge.visible = false; if (myBear) { myBear.root.visible = false; myChute.visible = false; }
  for (const v of game.veh.values()) scene.remove(v.mesh); game.veh.clear(); game.drv = null; $('inv').classList.add('hidden');
  $('zone-tint').style.opacity = '0';
  shell.show('title'); renderTitleOpts();
}
renderTitleOpts(); loadBgMap(game.pick.map === 'random' ? 'island' : game.pick.map);
shell.boot();
frame();
