// 젤리 숨바꼭질: 술래가 눈을 가린 동안 몸에 색을 칠해 숨고, 술래는 1인칭 물감총으로 수상한 곳을 쏴서 찾는다
//   숨는 쪽: 3인칭 · 🎨 칠하기(붓 · 지우개 · 스포이드 · 부위 채우기 · 무늬 도장) · 자세 4가지 · 위장도 계기판
//   술래: 1인칭 물감총(포물선 물감 · 맞은 자리에 자국 · 물감통 12발이 조금씩 참) · 움직이는 젤리는 반짝이 흔적
import * as THREE from 'three';
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { Player } from '../../jelly-tactical/js/fps.js';
import { getMap, MAPS, camoScore } from './maps.js';
import { Bear, tileCanvas, tileColorAt, REG, PART_NAME } from './paint.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellyhide');
const PICK_KEY = 'jellyhide.pick';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const touch = matchMedia('(pointer: coarse)').matches;
const game = window.hide = {
  mode: 'title', phase: 'wait', round: 0, rounds: 0, seeker: 0, myId: 0, mapId: null, endAt: 0, mates: new Map(), found: new Set(), practice: false,
  pick: { map: pick0.map || 'random', rounds: pick0.rounds ?? 3, hide: pick0.hide || 60, seek: pick0.seek || 120, bots: pick0.bots ?? 4 },
  camYaw: 0, camPitch: 0.35, camDist: 5, painting: false, tool: 'brush', size: 8, c1: '#ffffff', c2: '#ff5c7a', pat: 'stripe', lastSpec: null, dom: null, pose: 0, myYaw: 0, spec: null,
};

// ---------- 그리기 준비 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, 1, 0.05, 400); camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight('#ffffff', '#b7a3c9', 1.35));
const sun = new THREE.DirectionalLight('#fff6ea', 1.25); sun.position.set(12, 30, 18); scene.add(sun);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- 맵 ----------
const world = { group: null, meshes: [], map: null, id: null };
const texCache = new Map();
function texOf(s) {
  const k = `${s.c}|${s.c2}|${s.p}`;
  if (!texCache.has(k)) { const t = new THREE.CanvasTexture(tileCanvas(s, 64)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texCache.set(k, t); }
  return texCache.get(k);
}
// 상자 면마다 uv 를 크기에 맞춰 늘려서 무늬 한 칸이 sc(m) 로 같게
function boxGeo(w, h, d, sc) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / sc, uv.getY(k) * dims[f][1] / sc); }
  return g;
}
function buildWorld(id) {
  if (world.id === id) return;
  if (world.group) { scene.remove(world.group); world.group.traverse((o) => o.geometry?.dispose()); }
  const map = getMap(id), g = new THREE.Group(); world.meshes = []; world.map = map; world.id = id;
  scene.background = new THREE.Color(map.sky[1]); scene.fog = new THREE.Fog(map.sky[1], 40, map.indoor ? 90 : 140);
  // 바닥 (정원은 산울타리 밖까지 잔디)
  const FW = map.indoor ? map.W + 2 : 140, FD = map.indoor ? map.D + 2 : 140;
  const fg = new THREE.PlaneGeometry(FW, FD), fuv = fg.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * FW / map.floor.sc, fuv.getY(i) * FD / map.floor.sc);
  const floor = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: texOf(map.floor) })); floor.rotation.x = -Math.PI / 2; floor.userData.spec = map.floor;
  g.add(floor); world.meshes.push(floor);
  for (const b of map.boxes) {
    const m = new THREE.Mesh(boxGeo(b.w, b.h, b.d, b.s.sc), new THREE.MeshLambertMaterial({ map: texOf(b.s) }));
    m.position.set(b.x, b.y + b.h / 2, b.z); m.userData.spec = b.s; g.add(m); world.meshes.push(m);
  }
  // 정원 하늘: 구름 몇 개
  if (!map.indoor) for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(3 + (i % 3), 12, 10), new THREE.MeshLambertMaterial({ color: '#ffffff' })); c.position.set(Math.cos(i * 0.7) * 55, 22 + (i % 4) * 3, Math.sin(i * 0.7) * 55); c.scale.y = 0.55; g.add(c); }
  scene.add(g); world.group = g;
}

// ---------- 곰돌이들 ----------
function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = 'rgba(40,20,60,.85)'; x.strokeText(text, 128, 32); x.fillStyle = color; x.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(2.2, 0.55, 1); s.renderOrder = 9; return s;
}
const HAT = (() => { const g = new THREE.Group(); const red = new THREE.MeshLambertMaterial({ color: '#ff4a6a' }); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 18), red); cone.position.y = 0.25; const band = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 8, 20), new THREE.MeshLambertMaterial({ color: '#ffffff' })); band.rotation.x = Math.PI / 2; const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshLambertMaterial({ color: '#ffd84d' })); ball.position.y = 0.52; g.add(cone, band, ball); return g; })();
class Mate {
  constructor(m) {
    this.id = m.id; this.name = m.name; this.bot = !!m.bot;
    this.bear = new Bear(m.id === game.myId ? '#ff9ec4' : lighten(m.color || '#8a5634'));
    this.tag = nameTag(m.id === game.myId ? '나' : (m.bot ? '🤖 ' : '') + m.name, m.id === game.myId ? '#ffe066' : '#ffffff');
    scene.add(this.bear.root, this.tag);
    this.pos = new THREE.Vector3(); this.tp = new THREE.Vector3(); this.yaw = 0; this.tyaw = 0; this.flags = 0; this.at = 0; this.sp = 0;
  }
  snap(x, y, z, yaw, f) { this.tp.set(x, y, z); this.tyaw = yaw; this.flags = f; if (!this.at) { this.pos.copy(this.tp); this.yaw = yaw; } this.at = performance.now(); }
  place(x, z, yaw) { this.pos.set(x, 0, z); this.tp.copy(this.pos); this.yaw = this.tyaw = yaw; this.at = performance.now(); }
  setSeeker(on) { if (on) { const h = HAT.clone(); h.position.y = 1.32; this.bear.inner.add(h); this.hat = h; } else if (this.hat) { this.bear.inner.remove(this.hat); this.hat = null; } }
  setFound(on) { this.found = on; this.bear.mat.transparent = on; this.bear.mat.opacity = on ? 0.35 : 1; this.bear.mat.needsUpdate = true; }
  update(dt, local) {
    if (!local) { if (this.pos.distanceTo(this.tp) > 5) this.pos.copy(this.tp); else this.pos.lerp(this.tp, Math.min(1, dt * 12)); let d = this.tyaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 10); }
    const pose = this.flags & 3; if (pose !== this.bear.pose) this.bear.setPose(pose);
    const b = this.bear.root; b.position.copy(this.pos); b.rotation.y = this.yaw;
    this.bear.animate(dt, !!(this.flags & 4));
    this.tag.position.set(this.pos.x, this.pos.y + (pose === 2 ? 1.0 : 1.75), this.pos.z);
    // 찾는 동안 움직이면 반짝이 흔적
    if (game.phase === 'seek' && this.flags & 4 && !this.found && this.id !== game.seeker) { this.sp -= dt; if (this.sp <= 0) { this.sp = 0.12; sparkle(this.pos); } }
  }
  remove() { scene.remove(this.bear.root, this.tag); }
}
function lighten(hex) { const c = new THREE.Color(hex); c.lerp(new THREE.Color('#ffffff'), 0.25); return '#' + c.getHexString(); }
const me = () => game.mates.get(game.myId);
const P = new Player(); game.P = P;
game.screenOf = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; }; // 점검용

// ---------- 반짝이 · 뿅 ----------
const fx = [];
const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,240,170,.8)'); g.addColorStop(1, 'rgba(255,240,170,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
function sparkle(p) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, opacity: 0.75 })); s.position.set(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.2 + Math.random() * 0.6, p.z + (Math.random() - 0.5) * 0.4); s.scale.setScalar(0.22); scene.add(s); fx.push({ o: s, life: 1.4, vy: 0.3 }); }
function poof(p, text = '뿅!', color = '#ff7eb6') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d'); x.font = 'bold 60px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(40,20,60,.8)'; x.strokeText(text, 128, 48); x.fillStyle = color; x.fillText(text, 128, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.position.set(p[0], p[1] + 0.3, p[2]); s.scale.set(1.6, 0.6, 1); s.renderOrder = 10; scene.add(s); fx.push({ o: s, life: 1.1, vy: 0.9 });
  for (let i = 0; i < 10; i++) { const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, depthWrite: false })); q.position.set(p[0], p[1], p[2]); q.scale.setScalar(0.3); scene.add(q); fx.push({ o: q, life: 0.7, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4) }); }
}
function tickFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.life -= dt; if (f.v) { f.o.position.addScaledVector(f.v, dt); f.v.y -= 6 * dt; } else f.o.position.y += (f.vy || 0) * dt; f.o.material.opacity = Math.max(0, Math.min(1, f.life)); if (f.life <= 0) { scene.remove(f.o); f.o.material.map !== sparkTex && f.o.material.map?.dispose(); f.o.material.dispose(); fx.splice(i, 1); } }
}

// ---------- 입력 ----------
const keys = new Set();
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
const amSeeker = () => game.seeker === game.myId;
const canMove = () => game.mode === 'play' && !game.painting && !game.found.has(game.myId) && (amSeeker() ? game.phase === 'seek' : game.phase === 'hide' || game.phase === 'seek');
addEventListener('keydown', (e) => {
  if (typing()) return;
  S.unlock?.();
  if (e.code === 'KeyM') muteBtn();
  if (game.mode !== 'play') return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && game.painting) { e.preventDefault(); undo(); return; }
  if (!e.repeat) {
    if (e.code === 'KeyF' && !amSeeker()) togglePaint();
    if (/^Digit[1-4]$/.test(e.code) && !amSeeker()) setPose(+e.code.slice(5) - 1);
    if (e.code === 'Space') game.jump = true;
  }
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// 마우스 · 손가락: 끌면 카메라 · 칠하기 모드에선 곰돌이를 끌면 칠한다 · 술래는 클릭(꾹)으로 물감총
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let drag = null;
function rayFrom(cx, cy) { ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray; }
canvas.addEventListener('pointerdown', (e) => {
  if (game.mode !== 'play') return;
  S.unlock?.();
  if (amSeeker() && game.phase === 'seek' && !game.found.has(game.myId)) {
    if (!touch && document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    if (!touch) { gun.firing = true; fire(); return; }
  }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, paint: false, t: performance.now(), id: e.pointerId };
  if (game.painting) {
    const h = rayFrom(e.clientX, e.clientY).intersectObjects(me().bear.meshes(), false)[0];
    if (game.tool === 'pick') { pickColor(e.clientX, e.clientY); drag = null; return; }
    if (h) { drag.paint = true; paintHit(h, true); }
  }
  try { canvas.setPointerCapture?.(e.pointerId); } catch { /* 무시 */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (document.pointerLockElement === canvas) { game.camYaw -= e.movementX * 0.0026; game.camPitch = Math.max(-1.3, Math.min(1.3, game.camPitch - e.movementY * 0.0024)); return; }
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.paint) { const h = rayFrom(e.clientX, e.clientY).intersectObjects(me().bear.meshes(), false)[0]; if (h) paintHit(h, false); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  const fp = amSeeker() && game.phase === 'seek';
  game.camYaw -= dx * (fp ? 0.005 : 0.007); game.camPitch = fp ? Math.max(-1.3, Math.min(1.3, game.camPitch - dy * 0.004)) : Math.max(-0.25, Math.min(1.25, game.camPitch + dy * 0.005));
});
addEventListener('pointerup', () => { if (!touch) gun.firing = false; });
canvas.addEventListener('pointerup', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const tap = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8 && performance.now() - drag.t < 350;
  if (drag.paint) paintChanged();
  drag = null;
});
canvas.addEventListener('wheel', (e) => { if (game.mode === 'play') { game.camDist = Math.max(2, Math.min(9, game.camDist + Math.sign(e.deltaY) * 0.5)); e.preventDefault(); } }, { passive: false });
// 휴대폰 막대
const stick = { x: 0, y: 0, id: null };
$('stick').addEventListener('pointerdown', (e) => { stick.id = e.pointerId; $('stick').setPointerCapture(e.pointerId); moveStick(e); });
$('stick').addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
$('stick').addEventListener('pointerup', () => { stick.id = null; stick.x = stick.y = 0; $('stick').firstElementChild.style.transform = ''; });
function moveStick(e) { const r = $('stick').getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stick.x = x; stick.y = y; $('stick').firstElementChild.style.transform = `translate(${x * 34}px, ${y * 34}px)`; }
$('t-jump').onclick = () => { game.jump = true; };
$('t-tag').addEventListener('pointerdown', (e) => { e.preventDefault(); gun.firing = true; fire(); });
$('t-tag').addEventListener('pointerup', () => { gun.firing = false; });
$('t-tag').addEventListener('pointerleave', () => { gun.firing = false; });

// ---------- 술래: 물감총 ----------
//   물감 덩어리가 포물선으로 날아가 맞은 자리에 자국을 남긴다 (같은 방 모두에게 보인다). 젤리를 맞히면 찾았다!
//   물감통 12발 · 0.45초마다 1발씩 다시 참 → 아무 데나 마구 쏘기는 어렵다
const AMMO_MAX = 12, AMMO_REGEN = 0.45, FIRE_GAP = 0.2, SHOT_V = 30, SHOT_G = 6;
const PAINTS = ['#ff4f9a', '#4aa3ff', '#ffd23f', '#62cf7a', '#9a6bff', '#ff9334'];
const gun = { ammo: AMMO_MAX, regen: 0, cool: 0, firing: false, ci: 0, kick: 0, model: null };
const shots = [], splats = [];
const splatTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff';
  x.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = 34 + Math.random() * 14; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.fill();
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, d = 44 + Math.random() * 16, r = 4 + Math.random() * 7; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const G_BLOB = new THREE.SphereGeometry(0.11, 12, 8), G_SPLAT = new THREE.PlaneGeometry(1, 1);
function makeGun() {
  const g = new THREE.Group(), toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.42), toon('#ffffff')); g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 14), toon('#5a4a7a')); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.33); g.add(barrel);
  const tip = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 8, 16), toon('#ff4f9a')); tip.position.set(0, 0.02, -0.48); g.add(tip);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), new THREE.MeshToonMaterial({ color: PAINTS[0], transparent: true, opacity: 0.85 })); tank.position.set(0, 0.17, 0.02); g.add(tank);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.09), toon('#ffb3d1')); handle.position.set(0, -0.15, 0.1); handle.rotation.x = 0.25; g.add(handle);
  g.position.set(0.3, -0.27, -0.66); g.scale.setScalar(0.62); g.userData = { tank, tip };
  g.traverse((o) => { if (o.isMesh) { o.renderOrder = 20; o.material.depthTest = false; } }); // 벽에 붙어도 총이 묻히지 않게
  camera.add(g); scene.add(camera); return g;
}
function fire() {
  if (!amSeeker() || game.phase !== 'seek' || gun.cool > 0) return;
  if (gun.ammo < 1) { if (!gun.dry) { gun.dry = true; S.sfx('bad'); feed('🎨 물감이 다 떨어졌어요 · 잠깐 기다리면 다시 차요'); } return; }
  gun.ammo--; gun.cool = FIRE_GAP; gun.kick = 1; gun.dry = false;
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const right = new THREE.Vector3().crossVectors(d, camera.up).normalize();
  const o = camera.position.clone().addScaledVector(d, 0.55).addScaledVector(right, 0.2).add(new THREE.Vector3(0, -0.14, 0));
  // 총구에서 조준점 쪽으로 (가까운 벽이면 그 점을 향해)
  ray.setFromCamera(new THREE.Vector2(0, 0), camera); const aim = ray.intersectObjects(world.meshes, false)[0];
  const to = aim && aim.distance < 40 ? aim.point : camera.position.clone().addScaledVector(d, 40);
  const dir = to.clone().sub(o).normalize(); dir.y += 0.012; dir.normalize();
  const ci = gun.ci = (gun.ci + 1) % PAINTS.length;
  spawnShot(o, dir, ci, true);
  shell.send({ t: 'shot', o: [o.x, o.y, o.z].map((v) => +v.toFixed(2)), d: [dir.x, dir.y, dir.z].map((v) => +v.toFixed(3)), c: ci });
  S.sfx('pop', 1);
}
function spawnShot(o, d, ci, mine) {
  const color = PAINTS[ci % PAINTS.length];
  const m = new THREE.Mesh(G_BLOB, new THREE.MeshToonMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
  m.position.copy(o); scene.add(m);
  shots.push({ m, vel: d.clone().multiplyScalar(SHOT_V), color, mine, life: 2.2 });
}
const segRay = new THREE.Raycaster(), prevP = new THREE.Vector3(), segD = new THREE.Vector3();
function tickShots(dt) {
  if (gun.model) {
    gun.cool = Math.max(0, gun.cool - dt); gun.kick = Math.max(0, gun.kick - dt * 6);
    if (gun.ammo < AMMO_MAX && (gun.regen += dt) >= AMMO_REGEN) { gun.regen = 0; gun.ammo++; }
    if (gun.firing && gun.cool <= 0) fire();
    const show = amSeeker() && game.phase === 'seek' && game.mode === 'play';
    gun.model.visible = show;
    gun.model.position.z = -0.66 + gun.kick * 0.06; gun.model.rotation.x = gun.kick * 0.12;
    gun.model.userData.tank.material.color.set(PAINTS[(gun.ci + 1) % PAINTS.length]); gun.model.userData.tank.scale.setScalar(0.45 + 0.55 * (gun.ammo / AMMO_MAX));
    const el = $('ammo'); el.classList.toggle('hidden', !show);
    if (show) el.innerHTML = `🎨 <b>${gun.ammo}</b><i style="width:${(gun.ammo / AMMO_MAX) * 100}%"></i>`;
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt;
    prevP.copy(s.m.position); s.vel.y -= SHOT_G * dt; s.m.position.addScaledVector(s.vel, dt);
    segD.copy(s.m.position).sub(prevP); const L = segD.length(); segD.normalize();
    segRay.set(prevP, segD); segRay.far = L;
    const bears = [...game.mates.values()].filter((x) => x.id !== game.seeker && !x.found);
    const hb = segRay.intersectObjects(bears.flatMap((x) => x.bear.meshes()), false)[0];
    const hw = segRay.intersectObjects(world.meshes, false)[0];
    let done = s.life <= 0;
    if (hb && (!hw || hb.distance <= hw.distance + 0.05)) {
      const mate = bears.find((x) => x.bear === hb.object.userData.bear);
      burst(hb.point, s.color);
      if (mate && s.mine) shell.send({ t: 'tag', id: mate.id });
      done = true;
    } else if (hw) {
      const n = hw.face ? hw.face.normal.clone().transformDirection(hw.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      addSplat(hw.point, n, s.color); done = true;
      if (s.mine) S.sfx('tick', 2);
    }
    if (done) { scene.remove(s.m); s.m.material.dispose(); shots.splice(i, 1); }
  }
}
function addSplat(p, n, color) {
  const m = new THREE.Mesh(G_SPLAT, new THREE.MeshBasicMaterial({ map: splatTex, color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.position.copy(p).addScaledVector(n, 0.012); m.lookAt(p.clone().add(n)); m.rotateZ(Math.random() * 6.28); m.scale.setScalar(0.45 + Math.random() * 0.3);
  scene.add(m); splats.push(m);
  if (splats.length > 260) { const o = splats.shift(); scene.remove(o); o.material.dispose(); }
}
function burst(p, color) { for (let i = 0; i < 12; i++) { const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color, transparent: true, depthWrite: false })); q.position.copy(p); q.scale.setScalar(0.35); scene.add(q); fx.push({ o: q, life: 0.7, v: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5) }); } }
function clearPaintballs() { for (const s of shots) { scene.remove(s.m); s.m.material.dispose(); } shots.length = 0; for (const m of splats) { scene.remove(m); m.material.dispose(); } splats.length = 0; gun.ammo = AMMO_MAX; gun.firing = false; }
game.fire = () => fire(); // 점검용

// ---------- 칠하기 ----------
const PALETTE = ['#ffffff', '#f3ece2', '#c9c2b8', '#6b6b78', '#2b2433', '#ff5c7a', '#ff9eb5', '#ff9334', '#ffd23f', '#fff1a8', '#62cf7a', '#3f9b4b', '#3fd0c0', '#4a9dff', '#bfe3ff', '#9a6bff', '#c98a4b', '#8a5a3a'];
const TOOLS = [['brush', '🖌️', '붓'], ['erase', '🧽', '지우개'], ['pick', '💧', '스포이드'], ['fill', '🪣', '채우기'], ['stamp', '🎨', '무늬 도장']];
const PATS = [['stripe', '줄무늬'], ['hstripe', '가로줄'], ['check', '체크'], ['dot', '땡땡이'], ['wave', '물결'], ['flower', '꽃'], ['star', '별'], ['copy', '찍은 무늬']];
function buildPaintUI() {
  $('tools').innerHTML = TOOLS.map(([k, e, n]) => `<button data-tool="${k}" class="${game.tool === k ? 'on' : ''}">${e}<small>${n}</small></button>`).join('');
  $('tools').querySelectorAll('[data-tool]').forEach((b) => { b.onclick = () => { game.tool = b.dataset.tool; buildPaintUI(); }; });
  $('sizes').innerHTML = [[4, '가는 붓'], [8, '보통'], [15, '굵은 붓']].map(([s, n]) => `<button data-size="${s}" class="${game.size === s ? 'on' : ''}">${n}</button>`).join('');
  $('sizes').querySelectorAll('[data-size]').forEach((b) => { b.onclick = () => { game.size = +b.dataset.size; buildPaintUI(); }; });
  $('c1').style.background = game.c1; $('c2').style.background = game.c2;
  $('palette').innerHTML = PALETTE.map((c) => `<button data-c="${c}" style="background:${c}"></button>`).join('');
  $('palette').querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { game.c1 = b.dataset.c; if (game.tool === 'erase' || game.tool === 'pick') game.tool = 'brush'; buildPaintUI(); }; b.oncontextmenu = (e) => { e.preventDefault(); game.c2 = b.dataset.c; buildPaintUI(); }; });
  $('pats').innerHTML = PATS.map(([p, n]) => { const s = p === 'copy' ? game.lastSpec : { c: game.c1, c2: game.c2, p }; const url = s ? tileCanvas(s, 32).toDataURL() : ''; return `<button data-pat="${p}" class="${game.pat === p ? 'on' : ''}" ${!s ? 'disabled' : ''} style="${url ? `background-image:url(${url})` : ''}"><span>${n}</span></button>`; }).join('');
  $('pats').querySelectorAll('[data-pat]').forEach((b) => { b.onclick = () => { game.pat = b.dataset.pat; game.tool = 'stamp'; buildPaintUI(); }; });
  $('parts').innerHTML = [...Object.keys(REG), 'all'].map((k) => `<button data-part="${k}">${k === 'all' ? '전체' : PART_NAME[k]}</button>`).join('');
  $('parts').querySelectorAll('[data-part]').forEach((b) => { b.onclick = () => applyPart(b.dataset.part); });
  $('pick-hint').textContent = game.tool === 'pick' ? '💧 벽 · 바닥 · 물건을 콕! 그 무늬도 함께 기억해요' : game.tool === 'fill' || game.tool === 'stamp' ? '곰돌이 부위를 누르거나 아래 단추로 한 번에' : '💧 스포이드로 벽 · 바닥 색을 콕! (오른쪽 클릭 = 두 번째 색)';
}
$('swap').onclick = () => { [game.c1, game.c2] = [game.c2, game.c1]; buildPaintUI(); };
$('c1').onclick = () => { game.tool = 'pick'; buildPaintUI(); };
$('c2').onclick = () => { [game.c1, game.c2] = [game.c2, game.c1]; buildPaintUI(); };
const curSpec = () => (game.pat === 'copy' && game.lastSpec ? game.lastSpec : { c: game.c1, c2: game.c2, p: game.pat });
function applyPart(part) {
  const b = me().bear; b.snapshot();
  const parts = part === 'all' ? Object.keys(REG) : [part];
  for (const k of parts) game.tool === 'stamp' ? b.stamp(k, curSpec()) : b.fill(k, game.tool === 'erase' ? b.base : game.c1);
  S.sfx('pop', 2); paintChanged();
}
function paintHit(h, first) {
  const b = me().bear, part = h.object.userData.part;
  if (first) b.snapshot();
  if (game.tool === 'fill' || game.tool === 'stamp') { if (first) { game.tool === 'stamp' ? b.stamp(part, curSpec()) : b.fill(part, game.c1); S.sfx('pop', 2); } return; }
  b.dab(h.uv, part, game.c1, game.size, game.tool === 'erase');
  if (Math.random() < 0.3) S.sfx('pen');
}
// 스포이드: 화면에 비친 색이 아니라 그 겉면 무늬의 실제 색 (+ 무늬도 기억)
function pickColor(cx, cy) {
  const h = rayFrom(cx, cy).intersectObjects(world.meshes, false)[0];
  if (!h) return;
  const s = h.object.userData.spec; const c = tileColorAt(s, h.uv.x, h.uv.y);
  game.c2 = c === game.c1 ? game.c2 : game.c1; game.c1 = c; game.lastSpec = s; game.tool = 'brush';
  S.sfx('heart'); feed(`💧 색을 찍었어요 · 무늬 도장 '찍은 무늬'로 그 무늬도 그대로!`); buildPaintUI();
}
function undo() { if (me()?.bear.back()) paintChanged(); }
$('undo').onclick = undo;
$('reset').onclick = () => { const b = me().bear; b.snapshot(); b.reset(); paintChanged(); };
$('done').onclick = () => togglePaint(false);
$('paint-btn').onclick = () => togglePaint();
let camoSendT = 0;
function paintChanged() { game.dom = me().bear.colors(); if (performance.now() - camoSendT > 400) { camoSendT = performance.now(); shell.send({ t: 'camo', dom: game.dom }); } game.paintDirty = true; }
function sendPaint() { if (!game.paintDirty) return; game.paintDirty = false; const b = me().bear; shell.send({ t: 'paint', img: b.toImage() }); shell.send({ t: 'camo', dom: b.colors() }); }
function togglePaint(on = !game.painting) {
  if (on && (amSeeker() || game.phase !== 'hide' || game.found.has(game.myId))) return;
  game.painting = on; $('paint').classList.toggle('hidden', !on); $('paint-btn').classList.toggle('on', on);
  if (on) { game.camDist0 = game.camDist; game.camDist = 2.6; game.camPitch = 0.25; game.camYaw = game.myYaw; buildPaintUI(); S.sfx('page'); }
  else { game.camDist = game.camDist0 || 5; sendPaint(); }
  hudRole();
}
function setPose(p) {
  if (amSeeker() || game.found.has(game.myId)) return;
  game.pose = p; me()?.bear.setPose(p); document.querySelectorAll('#poses [data-pose]').forEach((b) => b.classList.toggle('on', +b.dataset.pose === p)); S.sfx('tick', p);
}
document.querySelectorAll('#poses [data-pose]').forEach((b) => { b.onclick = () => setPose(+b.dataset.pose); });
document.querySelectorAll('#poses [data-rot]').forEach((b) => { b.onclick = () => { game.myYaw += +b.dataset.rot * Math.PI / 4; }; });

// ---------- 화면 알림 ----------
function feed(t, big) { const d = document.createElement('div'); d.textContent = t; if (big) d.className = 'big'; $('feed').appendChild(d); setTimeout(() => d.remove(), 3300); while ($('feed').children.length > 4) $('feed').firstChild.remove(); }
let introT = 0;
function intro(html, cls, ms) { const c = $('intro'); c.className = cls || ''; c.innerHTML = html; clearTimeout(introT); if (ms) introT = setTimeout(() => c.classList.add('hidden'), ms); }
const nameOf = (id) => (id === game.myId ? '나' : game.members?.get(id)?.name || '?');
function hudRole() {
  const found = game.found.has(game.myId), seeker = amSeeker();
  $('h-role').textContent = seeker ? (game.phase === 'seek' ? '🔍 술래 · 수상한 곳에 물감총! 물감통은 조금씩 다시 차요' : '🔍 이번 판 술래') : found ? '😵 들켰어요 · 술래를 따라 구경해요' : game.phase === 'seek' ? '🫥 들키지 마세요 · 움직이면 반짝이가 남아요' : `🫥 숨는 젤리 · 술래는 ${nameOf(game.seeker)}`;
  const hid = [...game.mates.keys()].filter((id) => id !== game.seeker), left = hid.filter((id) => !game.found.has(id)).length;
  $('h-found').textContent = `🫥 남은 젤리 ${left} / ${hid.length}`;
  $('h-round').textContent = `${game.round} / ${game.rounds}판 · ${MAPS.find((m) => m.id === game.mapId)?.emoji || ''} ${MAPS.find((m) => m.id === game.mapId)?.name || ''}`;
  const hider = !seeker && !found && (game.phase === 'hide' || game.phase === 'seek' || game.phase === 'ready');
  $('poses').classList.toggle('hidden', !hider); $('camo').classList.toggle('hidden', !hider);
  $('paint-btn').disabled = game.phase !== 'hide';
  $('cross').classList.toggle('hidden', !(seeker && game.phase === 'seek'));
  $('t-tag').classList.toggle('hidden', !(seeker && game.phase === 'seek'));
  $('touch').classList.toggle('hidden', !touch || game.painting);
}

// ---------- 공용 틀 ----------
function seg(list, cur, attr, editable) { return `<div class="seg mode-seg">${list.map(([v, l, s]) => `<button data-${attr}="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}${s ? `<small>${s}</small>` : ''}</button>`).join('')}</div>`; }
function optsUI(el, o, editable, set, multi) {
  el.innerHTML = `<div class="opt-grid">
    ${seg([['random', '🎲 돌아가며'], ...MAPS.map((m) => [m.id, `${m.emoji} ${m.name}`])], o.map, 'map', editable)}
    ${seg([[0, '모두 한 번씩', '술래 차례'], [2, '2판'], [3, '3판'], [5, '5판']], o.rounds, 'rounds', editable)}
    ${seg([[45, '숨기 45초'], [60, '숨기 60초'], [90, '숨기 90초']], o.hide, 'hide', editable)}
    ${seg([[90, '찾기 90초'], [120, '찾기 2분'], [180, '찾기 3분']], o.seek, 'seek', editable)}
    <div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}${multi ? '' : ' <small>(연습)</small>'}</div>
  </div>`;
  for (const a of ['map', 'rounds', 'hide', 'seek']) el.querySelectorAll(`[data-${a}]`).forEach((b) => { b.onclick = () => set({ [a]: a === 'map' ? b.dataset[a] : +b.dataset[a] }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(multi ? 0 : 1, Math.min(7, (o.bots || 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }, false); }
function practice(role) { S.unlock?.(); game.lastRole = role; shell.sendAfterHello({ t: 'practice', opts: { ...game.pick, role } }); }
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellyhide', title: '🫥 젤리 숨바꼭질', subtitle: '몸에 색을 칠해 방 · 가게 · 정원과 똑같아지기!<br>술래는 물감총으로 수상한 곳을 쏴서 찾아요', wsPath: '/hide-ws', max: 10,
  multiLabel: '👥 같이 하기', roomIcon: '🫥', startLabel: '🫥 숨바꼭질 시작!',
  keysHelp: 'WASD 이동 · 마우스 끌기 카메라 · F 칠하기 · 💧 스포이드로 겉면 색 찍기 · 1~4 자세 · Q/E 돌기 · 술래는 클릭 · 꾹 누르기로 물감총 발사',
  buttons: [{ id: 'hide-btn', label: '🫥 숨기 연습 <small>젤리봇 술래에게서 숨어요</small>', onClick: () => practice('hide') }, { id: 'seek-btn', label: '🔍 술래 연습 <small>숨은 젤리봇을 찾아요</small>', cls: 'ghost', onClick: () => practice('seek') }],
  screens: ['over'],
  describe: (o = {}) => `${o.map === 'random' ? '🎲 돌아가며' : MAPS.find((m) => m.id === o.map)?.name || ''} · ${o.rounds ? `${o.rounds}판` : '모두 한 번씩'} · 🤖 ${o.bots || 0}`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n }), true) },
  onStart: (m) => startGame(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
});
shell.pickOpts = () => ({ ...game.pick, bots: 0 });

// ---------- 경기 흐름 ----------
function startGame(m) {
  game.mode = 'play'; game.myId = shell.myId; game.rounds = m.rounds; game.practice = !!shell.room?.name?.includes('연습') || game.lastRole != null && !shell.room?.n;
  game.members = new Map(m.members.map((x) => [x.id, x]));
  for (const x of game.mates.values()) x.remove(); game.mates.clear();
  for (const x of m.members) game.mates.set(x.id, new Mate(x));
  if (titleBear) { scene.remove(titleBear.root); titleBear = null; }
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('over').classList.add('hidden');
  game.phase = 'wait'; game.endAt = performance.now() + (m.in || 2500);
  intro(`<div class="em">🫥</div><div class="nm">젤리 숨바꼭질</div><div class="ds">${m.members.length}마리 · ${m.rounds}판 · 판마다 술래가 바뀌어요</div>`, '', 2400);
  S.sfx('start'); hudRole();
}
shell.on('ph', (m) => {
  const prev = game.phase;
  game.phase = m.phase; game.round = m.round; game.rounds = m.rounds; game.seeker = m.seeker; game.endAt = performance.now() + m.ms;
  game.found = new Set(m.found);
  if (m.mapId) buildWorld(m.mapId), game.mapId = m.mapId;
  if (m.phase === 'ready' || m.phase === 'seek') clearPaintballs();
  for (const x of game.mates.values()) { x.setSeeker(x.id === game.seeker); x.setFound(game.found.has(x.id)); }
  const seeker = amSeeker();
  if (m.phase === 'ready') {
    for (const [id, s] of Object.entries(m.spawn || {})) { const x = game.mates.get(+id); if (x) x.place(s[0], s[1], s[2]); }
    const s = m.spawn?.[game.myId]; if (s) { P.pos.set(s[0], 0, s[1]); P.vel.set(0, 0, 0); game.myYaw = s[2]; game.camYaw = s[2] + Math.PI; }
    game.pose = 0; me()?.bear.setPose(0); game.camPitch = 0.35; game.camDist = 5;
    const mp = MAPS.find((x) => x.id === m.mapId), md = getMap(m.mapId);
    intro(seeker
      ? `<div class="em">🔍</div><div class="nm">이번엔 내가 술래!</div><div class="ds">젤리들이 숨는 동안 눈을 감아요. 그다음 수상한 곳에 <b>물감총</b>을 쏴요!<br>물감통은 12발 · 쏘면 조금씩 다시 차요</div><div class="sb">${mp.emoji} ${mp.name} · ${m.round} / ${m.rounds}판</div>`
      : `<div class="em">🫥</div><div class="nm">숨어요!</div><div class="ds">숨을 곳을 고르고 <b>🎨 칠하기(F)</b>로 몸을 겉면과 똑같이!<br>💧 스포이드로 색을 찍고 무늬 도장으로 무늬까지</div><div class="sb">${mp.emoji} ${mp.name} — ${md.desc} · 술래 ${esc(nameOf(game.seeker))}</div>`, seeker ? 'seek' : '', 4300);
    S.sfx('turn');
  } else if (m.phase === 'hide') {
    $('blind').classList.toggle('hidden', !seeker);
    if (!seeker) feed('🫥 숨을 시간! 🎨 칠하기로 위장해요', true);
  } else if (m.phase === 'seek') {
    $('blind').classList.add('hidden');
    if (game.painting) togglePaint(false); else sendPaint();
    if (seeker) { game.camPitch = 0; P.yaw = game.camYaw; feed('🔍 찾기 시작! 수상한 곳에 물감총 발사 (누르고 있으면 연사)', true); } else feed(`🔍 ${nameOf(game.seeker)} 술래가 찾기 시작했어요! 쉿…`, true);
    S.sfx('start');
  } else if (m.phase === 'result') {
    document.exitPointerLock?.(); if (game.painting) togglePaint(false);
    const res = (m.res || []).slice().sort((a, b) => b.pts - a.pts);
    intro(`<div class="em">⏱️</div><div class="nm">${m.round} / ${m.rounds}판 끝!</div><div class="ds">${res.find((e) => e.seeker)?.all ? '술래가 모두 찾았어요! 🔍' : `끝까지 숨은 젤리 ${res.filter((e) => !e.seeker && !e.found).length}마리`}${m.shots ? ` · 물감 ${m.shots}발` : ''}</div>
      <div class="res">${res.map((e) => `<div class="${e.id === game.myId ? 'me' : ''}">${e.seeker ? '🔍' : e.found ? '😵' : '🫥'} ${esc(nameOf(e.id))}<small>${e.seeker ? `${e.finds}마리 찾음` : e.found ? `${e.sec}초에 들킴` : '끝까지 숨음!'}</small><span class="p">+${e.pts}</span></div>`).join('')}</div>`, '', 6800);
    const mine = res.find((e) => e.id === game.myId); if (mine && ((mine.seeker && mine.all) || (!mine.seeker && !mine.found))) { S.sfx('win'); confetti(60); } else S.sfx('page');
  }
  if (prev !== m.phase) { drag = null; }
  hudRole();
});
shell.on('pt', (m) => { const x = game.mates.get(m.id); if (!x || m.id === game.myId) return; if (m.img) x.bear.applyImage(m.img); else if (m.spec) x.bear.applySpec(m.spec); });
shell.on('found', (m) => {
  game.found.add(m.id); const x = game.mates.get(m.id); if (x) { x.setFound(true); poof([x.pos.x, x.pos.y + 1, x.pos.z], '찾았다!', '#ffd84d'); }
  if (m.id === game.myId) { feed('😵 들켰어요! 술래를 따라 구경해요', true); S.sfx('lose'); if (game.painting) togglePaint(false); }
  else feed(`🔍 ${nameOf(m.by)} → ${nameOf(m.id)} 찾았다! (${m.sec}초) · 남은 젤리 ${m.left}`, m.by === game.myId);
  if (m.by === game.myId) S.sfx('ok'); else S.sfx('pop', 3);
  hudRole();
});
shell.on('shot', (m) => { if (m.by === game.myId || !Array.isArray(m.o) || !Array.isArray(m.d)) return; spawnShot(new THREE.Vector3(...m.o), new THREE.Vector3(...m.d).normalize(), m.c | 0, false); });
shell.on('far', () => feed('🤏 너무 멀리서 맞았어요 · 조금 더 다가가요'));
shell.on('snap', (m) => { for (const [id, x, y, z, yaw, f] of m.p) { if (id === game.myId) continue; game.mates.get(id)?.snap(x, y, z, yaw, f); } });
shell.on('gone', (m) => { const x = game.mates.get(m.id); if (x) { x.remove(); game.mates.delete(m.id); } hudRole(); });

function results(m) {
  game.mode = 'over'; document.exitPointerLock?.(); $('hud').classList.add('hidden'); $('blind').classList.add('hidden'); $('intro').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId), top = m.rank[0];
  $('ov-title').textContent = top ? `🏆 ${top.name} 우승!` : '끝!';
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · ${mine.score}점 · 찾은 젤리 ${mine.finds} · 끝까지 숨기 ${mine.survived}번` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${e.bot ? '🤖 ' : ''}${esc(e.name)}</span><span class="sc">${e.score}<small>점 · 🔍${e.finds} · 🫥${e.survived}</small></span></div>`).join('');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1) { confetti(); S.sfx('win'); }
  shell.show('over');
}
$('again-btn').onclick = () => { if (game.lastPractice) return practice(game.lastRole || 'hide'); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
$('b-quit').onclick = () => quit();
$('b-help').onclick = () => $('help').classList.remove('hidden');
$('help-close').onclick = () => $('help').classList.add('hidden');
function quit() { shell.send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() {
  game.mode = 'title'; game.phase = 'wait'; game.painting = false; document.exitPointerLock?.();
  for (const x of game.mates.values()) x.remove(); game.mates.clear();
  for (const id of ['hud', 'blind', 'intro', 'paint', 'over']) $(id).classList.add('hidden');
  shell.multi = false; shell.playing = false; shell.show('title'); renderTitleOpts(); titleScene();
}
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound?.(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';

// ---------- 처음 화면: 반쯤 숨은 곰돌이 ----------
let titleBear = null;
function titleScene() {
  buildWorld('toy');
  if (!titleBear) {
    titleBear = new Bear('#ff9ec4');
    // 몸 절반은 벽지 무늬로 칠해 '숨는 중' 느낌
    titleBear.stamp('body', { c: '#ffd1dc', c2: '#fff4ea', p: 'stripe' }); titleBear.stamp('limb', { c: '#ffd1dc', c2: '#fff4ea', p: 'stripe' });
    titleBear.root.position.set(0, 0, -14.4); titleBear.root.rotation.y = 0; scene.add(titleBear.root);
  }
}

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let sendT = 0, camoT = 0, tt = 0, lastSec = -1;
const tgt = new THREE.Vector3(), camPos = new THREE.Vector3(), dir = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); tt += dt;
  if (game.mode === 'play') play(dt);
  else if (titleBear) { titleBear.animate(dt, false); const a = tt * 0.18; camera.position.set(Math.sin(a) * 4.5, 2.2, -10 + Math.cos(a) * 1.5); camera.lookAt(0, 1, -14.2); }
  tickShots(dt);
  tickFx(dt);
  renderer.render(scene, camera);
}
function play(dt) {
  const mine = me(); const map = world.map;
  // 시간
  const left = Math.max(0, (game.endAt - performance.now()) / 1000), sec = Math.ceil(left);
  $('h-time').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('h-label').textContent = { wait: '곧 시작', ready: '준비', hide: '🫥 숨는 시간', seek: '🔍 찾는 시간', result: '판 결과' }[game.phase] || '';
  $('h-phase').classList.toggle('hurry', (game.phase === 'hide' || game.phase === 'seek') && left < 10);
  if ((game.phase === 'hide' || game.phase === 'seek') && left < 6 && sec !== lastSec && sec > 0) { lastSec = sec; S.sfx('clock'); }
  $('blind-t').textContent = `${sec}초`;
  // 숨는 시간이 끝나기 직전엔 칠한 것을 보낸다
  if (game.phase === 'hide' && left < 1.4 && game.painting) togglePaint(false);
  // 내 몸
  if (mine && map) {
    const seeker = amSeeker(), found = game.found.has(game.myId);
    let f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0), s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    if (stick.id != null) { f = -stick.y; s = stick.x; }
    if (!seeker && !game.painting) { if (keys.has('KeyQ')) game.myYaw += dt * 2.6; if (keys.has('KeyE')) game.myYaw -= dt * 2.6; }
    const move = canMove() && (f || s);
    P.yaw = game.camYaw;
    const slow = !seeker && game.phase === 'seek' ? 0.36 : seeker ? 1 : 0.85;
    const ev = P.update(dt, { f: canMove() ? f : 0, s: canMove() ? s : 0, jump: canMove() && game.jump && game.pose === 0, crouch: false, sprint: false, speedMul: slow }, map);
    game.jump = false;
    if (ev.includes('jump')) S.sfx('tick', 4);
    if (move && !seeker) { game.myYaw = Math.atan2(P.vel.x, P.vel.z); if (game.pose !== 0 && game.pose !== 1) setPose(0); }
    mine.pos.copy(P.pos); mine.yaw = seeker ? game.camYaw + Math.PI : game.myYaw;
    mine.flags = (seeker ? 0 : game.pose) | (move && Math.hypot(P.vel.x, P.vel.z) > 0.5 ? 4 : 0);
    // 술래는 1인칭이라 내 몸을 숨기고, 들킨 뒤엔 구경
    mine.bear.root.visible = !(seeker && game.phase === 'seek');
    sendT -= dt;
    if (sendT <= 0 && !found && game.phase !== 'result') { sendT = 0.1; shell.send({ t: 'st', p: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), +mine.yaw.toFixed(2), mine.flags] }); }
    // 위장도
    camoT -= dt;
    if (camoT <= 0 && !seeker) { camoT = 0.3; if (!game.dom) game.dom = mine.bear.colors(); const sc = camoScore(game.dom, map, P.pos.x, P.pos.z, game.pose); $('camo-n').textContent = `${sc}%`; $('camo').querySelector('.bar i').style.width = `${sc}%`; $('camo-w').textContent = sc < 35 ? '다 보여요 😳' : sc < 60 ? '조금 보여요 🙈' : sc < 80 ? '그럭저럭 🙂' : '감쪽같아요! 😎'; }
  }
  for (const x of game.mates.values()) { x.update(dt, x.id === game.myId); x.tag.visible = x.id !== game.myId && (game.phase !== 'seek' || x.found) && !(amSeeker() && game.phase === 'hide'); }
  // 카메라
  const seeker = amSeeker(), found = game.found.has(game.myId);
  if (seeker && game.phase === 'seek') { camera.position.set(P.pos.x, P.pos.y + 1.15, P.pos.z); camera.rotation.set(game.camPitch, game.camYaw, 0); }
  else {
    const follow = found && game.mates.get(game.seeker) ? game.mates.get(game.seeker) : mine;
    if (!follow) return;
    const h = game.painting ? 0.7 : 1.0;
    tgt.set(follow.pos.x, follow.pos.y + h, follow.pos.z);
    const cp = Math.cos(game.camPitch); dir.set(Math.sin(game.camYaw) * cp, Math.sin(game.camPitch), Math.cos(game.camYaw) * cp);
    let d = game.camDist;
    // 벽에 가리지 않게 카메라를 당긴다
    ray.set(tgt, dir); ray.far = d; const hit = ray.intersectObjects(world.meshes, false)[0]; ray.far = Infinity;
    if (hit) d = Math.max(0.8, hit.distance - 0.25);
    camPos.copy(tgt).addScaledVector(dir, d);
    camera.position.lerp(camPos, Math.min(1, dt * 14)); camera.lookAt(tgt);
  }
}

gun.model = makeGun();
buildPaintUI();
renderTitleOpts();
shell.boot();
titleScene();
frame();
if (!store.get('jellyhide.seenHelp')) { store.set('jellyhide.seenHelp', '1'); }
