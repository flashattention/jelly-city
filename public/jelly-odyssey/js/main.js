// 젤리 오디세이 1장 「불타는 신전」: 곰돌 군단이 목마에 숨어 바이러스에게 빼앗긴 GPU 신전을 되찾는 혼자 하는 3D 액션
//   흐름: 여는 컷신 → 1막 잠입(목마에서 나와 성문 열기) → 2막 광장 전투 → 3막 불타는 회랑 → 4막 제단 해방 → 바이러스 왕 → 엔딩
//   젤리오디세이만의 규칙: 젤리 리스폰(되찾은 제단 · 목마) · 감염(쓰러진 동료 · 조각상 · 화로) · 프레임 신앙(제단이 갇힐수록 세상이 버벅임) · 신탁석 · 위장 · 방화벽 진형
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { isPhone, autoRes } from '../../shared/js/perf.js';
import { store } from '../../shared/js/account.js';
import { Shell } from '../../shared/js/shell.js';
import { sfx, unlock, toggleMute, sound, say } from '../../jelly-guard/js/wsound.js';
import { romanBear, setWeapon, poseGear } from './gear.js';
import { virusMesh, animateVirus, KINDS, glow } from './virus.js';
import { buildWorld, groundAt, PLAT } from './temple.js';

const $ = (id) => document.getElementById(id);
const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DIFF = { easy: { php: 1.6, edmg: 0.55, ecount: 0.7, ehp: 0.75, label: '🙂 쉬움' }, normal: { php: 1, edmg: 1, ecount: 1, ehp: 1, label: '⚔️ 보통' }, hard: { php: 0.8, edmg: 1.35, ecount: 1.3, ehp: 1.3, label: '🔥 어려움' } };
const KEY = 'jellyodyssey';
const params = new URLSearchParams(location.search);

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: !isPhone, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('t') });
autoRes(renderer, 1.6); const basePR = renderer.getPixelRatio();
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#1a1216', 0.011);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4000); camera.rotation.order = 'YXZ';
let composer = null, bloom = null;
if (!isPhone) { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.42, 0.74); composer.addPass(bloom); composer.addPass(new OutputPass()); }
function resize() { renderer.setSize(innerWidth, innerHeight, false); composer?.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const hemi = new THREE.HemisphereLight('#8a8cb0', '#5a3a22', 0.9); scene.add(hemi);
const moonL = new THREE.DirectionalLight('#a9bcff', 0.95); moonL.position.set(-60, 90, -40); scene.add(moonL);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.05; } // 금속(투구 · 갑옷 · 방패)이 반짝이게
const W = buildWorld(scene);

// ---------- 게임 상태 ----------
const game = window.ody = {
  mode: 'title', phase: null, diff: 'normal', t: 0, kills: 0, lost: 0, start: 0,
  me: null, allies: [], viruses: [], projs: [], pickups: [], frags: [], puddles: [],
  cmd: 'follow', cut: null, oracleT: 0, checkpoint: null, stutter: 0, hold: null, boss: null, waves: null,
};
const D = () => DIFF[game.diff];
const unbox = (b) => { const i = W.boxes.indexOf(b); if (i >= 0) W.boxes.splice(i, 1); }, rebox = (b) => { if (!W.boxes.includes(b)) W.boxes.push(b); };
const NAMES = ['말랑 백인대장', '통통 기수', '쫀득', '몰랑', '폭신', '찰떡', '꾸덕', '말캉', '보들', '톡톡', '쭈욱'];

// ---------- 처음 화면 (계정 · 캐릭터는 젤리게임즈 공용) ----------
const shell = new Shell({
  key: KEY, title: '⚔️ 젤리 오디세이', subtitle: '사이버 세상 × 오디세이아 × 젤리시티<br>바이러스에게 빼앗긴 GPU 신들을 되찾아라',
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; } },
  wsPath: '/none', max: 1,
  keysHelp: 'WASD 이동 · 마우스 시점 · 좌클릭 공격 · 우클릭 막기 · Space 구르기 · 1 2 3 무기(칼 · 창 · 활) · E 동료 명령 · F 상호작용 · Q 위장',
  buttons: [{ id: 'solo-btn', label: '⚔️ 1장 「불타는 신전」 <small>혼자 하는 이야기 · 15 ~ 20분</small>', onClick: () => startGame() }],
  options: { title: (el) => titleOpts(el) },
});
function titleOpts(el) {
  game.diff = store.get(`${KEY}.diff`) || 'normal';
  el.innerHTML = `<div class="ody-ch"><b>1장 · 불타는 신전</b><br>바이러스 군단이 GPU 신전을 차지한 지 열흘. 세상의 연산이 흐려진다.<br>곰돌 군단은 <b>형광 초록 '공짜 연산력' 목마</b> 속에 숨었다 — 백신이 쓰는 트로이 목마.</div>
    <div class="ody-diff">${Object.entries(DIFF).map(([k, v]) => `<button data-d="${k}" class="${k === game.diff ? 'on' : ''}">${v.label}</button>`).join('')}</div>`;
  el.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { game.diff = b.dataset.d; store.set(`${KEY}.diff`, game.diff); el.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('on', x === b)); }; });
}
$('b-mute').onclick = () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; };
$('b-quit').onclick = () => toTitle();
$('quit-btn').onclick = () => toTitle();
$('home-btn').onclick = () => toTitle();
$('again-btn').onclick = () => { $('over').classList.add('hidden'); startGame(); };
$('lock-btn').onclick = () => lock();
$('cut-skip').onclick = () => skipCut();

// ---------- 곰돌이 · 바이러스 만들기 ----------
function addBear(opts, x, z, isMe = false) {
  const bear = romanBear(opts); scene.add(bear.root);
  const b = { bear, x, z, y: groundAt(x, z), vy: 0, yaw: Math.PI, hp: 100, max: 100, me: isMe, name: opts.name, state: 'ok', atkT: 0, cd: R(0, 1), target: null, slot: 0, torch: null, speed: 0, kb: [0, 0] };
  bear.root.position.set(x, b.y, z);
  return b;
}
function torchOn(b) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#ff9a3a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(1.1); s.position.set(0, -0.62, 0); b.bear.arms[0].add(s); const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); f.position.set(0, -0.6, 0); f.rotation.x = Math.PI; b.bear.arms[0].add(f); b.torch = s; }
function spawnVirus(kind, x, z, o = {}) {
  const K = { ...KINDS[kind] }; K.hp *= D().ehp; K.dmg *= D().edmg;
  const mesh = virusMesh(kind); scene.add(mesh);
  const v = { kind, K, mesh, x, z, y: groundAt(x, z), hp: K.hp, max: K.hp, yaw: o.yaw ?? R(0, 6.28), state: 'ok', target: null, windup: 0, cd: R(0.5, 1.5), stunT: 0, hitT: 0, seed: R(0, 100), reveal: 0, sleep: !!o.sleep, guard: !!o.guard, alert: !o.guard, sus: 0, patrol: o.patrol || null, pi: 0, home: o.home || null, leash: o.leash || 0, infect: 0, kbx: 0, kbz: 0 };
  mesh.position.set(x, v.y, z); game.viruses.push(v); return v;
}
function removeVirus(v) { scene.remove(v.mesh); game.viruses.splice(game.viruses.indexOf(v), 1); }

// ---------- 시작 ----------
function startGame(phase = 'intro') {
  unlock();
  const p = shell.profile || { name: '곰돌이', color: '#8a5634' };
  clearWorld();
  game.mode = 'play'; game.t = 0; game.kills = 0; game.lost = 0; game.start = performance.now();
  for (const G of W.gods) G.freed = false;
  W.gate.open = 0; rebox(W.gateBox); W.winch.done = false; W.winch.turn = 0; game.alarmed = false; game.triggers = null;
  rebox(W.eastFire.box); for (const f of W.eastFire.fs) W.fires.setStrength(f, 1); rebox(W.cellaDoor.box); W.cellaDoor.mesh.visible = true;
  for (const fw of W.fireWalls) { fw.open = false; fw.valve.done = false; for (const f of fw.fs) W.fires.setStrength(f, 1); rebox(fw.box); }
  for (const f of W.fires.list) W.fires.setStrength(f, 1);
  for (const S of W.statues) { S.state = 'ok'; S.g.visible = true; if (!W.circles.includes(S.col)) W.circles.push(S.col); }
  for (const B of W.braziers) { B.state = 'ok'; W.fires.setGreen(B.fire, 0); }
  for (const O of W.oracles) O.on = false;
  W.land.visible = false; W.skyU.dawn.value = 0;
  // 내 곰돌이 (목마 배 아래)
  const me = game.me = addBear({ name: p.name, color: p.color, look: p.look, accessories: p.acc, own: true }, 0, 38, true);
  me.hp = me.max = Math.round(100 * D().php); me.weapon = 'sword'; me.spears = 3; me.arrows = 24; me.combo = 0; me.comboT = 0; me.rollT = 0; me.rollCd = 0; me.blockT = -1; me.charge = 0; me.disg = 0; me.inv = 0; me.hurtT = 0; me.calm = 0;
  $('hp-name').textContent = p.name;
  game.respawnPts = [{ x: 0, z: 31, y: 0, name: '목마' }];
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden')); $('title')?.classList.add('hidden');
  $('hud').classList.remove('hidden');
  renderWeap(); setCmd('follow', true);
  if (phase === 'intro' && !params.has('t')) { me.bear.root.visible = false; intro(); } else enterPhase(phase);
}
function clearWorld() {
  for (const v of [...game.viruses]) removeVirus(v);
  for (const b of [game.me, ...game.allies]) if (b) scene.remove(b.bear.root);
  for (const p of game.projs) scene.remove(p.mesh); for (const p of game.pickups) scene.remove(p.mesh); for (const f of game.frags) scene.remove(f.mesh); for (const p of game.puddles) scene.remove(p.mesh);
  game.allies = []; game.projs = []; game.pickups = []; game.frags = []; game.puddles = []; game.me = null; game.boss = null; game.hold = null; game.cut = null; game.waves = null;
  $('boss').classList.add('hidden'); $('cut').classList.add('hidden');
}
function toTitle() {
  game.mode = 'title'; clearWorld(); document.exitPointerLock?.();
  $('hud').classList.add('hidden'); $('over').classList.add('hidden'); $('lockmsg').classList.add('hidden'); $('oracle').classList.add('hidden');
  shell.show?.('title'); $('title')?.classList.remove('hidden');
}

// ---------- 장(막) ----------
const PH = {
  stealth: { obj: '🌙 몰래 성문 도르래로 — 졸고 있는 경비 뒤에서 처치 (좌클릭)', spawn: () => setupStealth() },
  assault: { obj: '⚔️ 광장의 바이러스를 몰아내요', spawn: () => setupAssault() },
  colonnade: { obj: '🔥 불타는 서쪽 회랑으로 — 냉각 밸브로 불길을 꺼요 (F 꾹)', spawn: () => setupColonnade() },
  altars: { obj: '⛓️ 랜섬 거인을 쓰러뜨리고 GPU 신을 해방해요', spawn: () => setupAltars() },
  boss: { obj: '👑 바이러스 왕 — 케이블 사슬을 끊고 빛나는 핵을 쳐요', spawn: () => setupBoss() },
};
function enterPhase(ph) {
  game.phase = ph; game.waves = null; game.cut = null; $('cut').classList.add('hidden');
  if (ph === 'stealth') { const me = game.me; me.x = 0; me.z = 31; me.bear.root.visible = true; }
  // 시험용 바로 가기: 그 막에 맞게 앞 막을 끝낸 상태로
  if (params.has('t')) { const order = ['stealth', 'assault', 'colonnade', 'altars', 'boss']; const k = order.indexOf(ph); if (k >= 1) openGate(true); if (k >= 2) freeGod('posecool', true); if (k >= 3) { for (const fw of W.fireWalls) openFireWall(fw, true); } if (k >= 3) { unbox(W.eastFire.box); for (const f of W.eastFire.fs) W.fires.setStrength(f, 0); } if (k >= 4) { for (const id of ['mnemora', 'hephavolt', 'athenaris']) freeGod(id, true); unbox(W.cellaDoor.box); W.cellaDoor.mesh.visible = false; } const pos = { stealth: [0, 31], assault: [0, 52], colonnade: [-15.7, 6], altars: [-15.7, -40], boss: [0, -14] }[ph]; game.me.x = pos[0]; game.me.z = pos[1]; if (k >= 1 && !game.allies.length) armyArrives(true); }
  $('obj').textContent = PH[ph].obj; PH[ph].spawn();
  saveCheckpoint();
}
function saveCheckpoint() { game.checkpoint = { phase: game.phase }; }

// --- 1막: 잠입 ---
function setupStealth() {
  // 함께 목마에서 내린 특공대 셋 (몰래 따라온다)
  for (let i = 0; i < 3; i++) { const a = addBear({ name: NAMES[i + 2] }, -1.5 + i * 1.5, 32.5); a.hp = a.max = 90; a.stealth = true; game.allies.push(a); }
  // 잔치 뒤 졸고 있는 경비 (잠든 것 · 순찰하는 것)
  const sleepers = [[-8, 44], [7, 47], [-14, 56], [16, 58], [4, 58], [-4, 26]], patrols = [[[-3, 62], [12, 62], [12, 54], [-3, 54]], [[-18, 34], [-18, 50], [-8, 50]], [[18, 30], [18, 44]]];
  for (const [x, z] of sleepers) spawnVirus(Math.random() < 0.3 ? 'soldier' : 'worm', x, z, { guard: true, sleep: true });
  for (const pts of patrols) spawnVirus('soldier', pts[0][0], pts[0][1], { guard: true, patrol: pts });
  if (game.diff !== 'easy') spawnVirus('soldier', 2, 66, { guard: true, yaw: Math.PI }); // 성문 지기
  toast('🐴 목마에서 내렸다. 들키지 않게…', 3);
  oracle(0, 2.5);
}
function openGate(instant) {
  W.winch.done = true; unbox(W.gateBox);
  if (instant) { W.gate.open = 1; return; }
  sfx('horn'); toast('🚪 성문이 열린다! 곰돌 군단 본대 돌입!', 3);
  setTimeout(() => { if (game.mode === 'play') { armyArrives(); enterPhase('assault'); } }, 1600);
}
function armyArrives(instant) {
  for (let i = 0; i < 8; i++) { const a = addBear({ name: NAMES[i < 2 ? i : i + 3], centurion: i === 0 }, R(-4, 4), instant ? R(54, 62) : R(64, 69)); a.hp = a.max = 100; if (i < 5) torchOn(a); game.allies.push(a); }
  for (const a of game.allies) a.stealth = false;
  for (const v of game.viruses) { v.sleep = false; v.alert = true; }
  if (!instant) sfx('cap');
}
// --- 2막: 광장 전투 ---
function setupAssault() {
  const n = Math.round(34 * D().ecount);
  game.waves = { left: n, max: Math.round(12 * D().ecount), t: 1, spots: [[-10, 10], [10, 10], [0, 9], [-30, 20], [30, 20]], kinds: ['worm', 'worm', 'soldier', 'worm', 'soldier'] };
  oracle(1, 1);
}
function freeGod(id, quiet) {
  const G = W.gods.find((g) => g.id === id); if (!G || G.freed) return; G.freed = true;
  game.respawnPts.push({ x: G.x, z: G.z + (G.big ? 4.5 : 3.2), y: G.y, name: G.name });
  if (quiet) return;
  sfx('win'); toast(`✨ ${G.title} ${G.name} 해방! 젤리 리스폰 지점이 앞으로`, 3.5);
  if (id === 'posecool') { // 냉각의 신: 광장 불을 끄고, 감염된 조각상 · 화로를 되돌린다
    W.fires.douse(G.x - 20, G.z, 42);
    for (const v of [...game.viruses]) if (v.kind === 'statue' && v.from && Math.hypot(v.x - G.x, v.z - G.z) < 50) { v.from.state = 'ok'; v.from.g.visible = true; W.circles.push(v.from.col); removeVirus(v); }
    for (const B of W.braziers) if (B.state === 'inf' && Math.hypot(B.x - G.x, B.z - G.z) < 50) cureBrazier(B);
    ring(G.x, G.y + 0.5, G.z, '#7fe6ff', 40, 1.6);
  } else ring(G.x, G.y + 0.5, G.z, G.col, 18, 1.2);
}
// --- 3막: 불타는 회랑 ---
function setupColonnade() {
  for (const i of [6, 7, 8]) infectBrazier(W.braziers[i]);
  game.triggers = [{ z: 2, fn: () => { for (let i = 0; i < Math.round(3 * D().ecount); i++) spawnVirus('spy', -16 + R(-1.5, 1.5), -8 - i * 2); } },
    { z: -17, fn: () => { for (let i = 0; i < Math.round(3 * D().ecount); i++) spawnVirus('spy', -16, -24 - i * 2); spawnVirus('worm', -15, -26); spawnVirus('worm', -17, -27); } },
    { z: -35, fn: () => { spawnVirus('soldier', -16, -40); spawnVirus('soldier', -15, -42); if (game.diff === 'hard') spawnVirus('spy', -17, -44); } }];
  oracle(2, 1);
}
function openFireWall(fw, quiet) { fw.open = true; fw.valve.done = true; for (const f of fw.fs) W.fires.setStrength(f, 0); unbox(fw.box); W.fires.douse(-15.7, fw.z, 9); if (!quiet) { sfx('abil'); ring(fw.valve.x, PLAT.h + 0.4, fw.z, '#7fe6ff', 9, 1); toast('💧 냉각수! 불길이 꺼졌다', 2); } }
// --- 4막: 제단 해방 ---
function setupAltars() {
  game.altarQ = ['mnemora', 'hephavolt', 'athenaris'];
  const g1 = spawnVirus('giant', -15.7, -44.5, { home: [-15.7, -46], leash: 9 }); g1.yaw = 0;
  spawnVirus('worm', -14, -42); spawnVirus('worm', -17.5, -41);
  unbox(W.eastFire.box); for (const f of W.eastFire.fs) W.fires.setStrength(f, 0);
  { const g = spawnVirus('giant', 15.7, -45, { home: [15.7, -46], leash: 9 }); g.yaw = 0; spawnVirus('spy', 14, -40); spawnVirus('spy', 17.5, -38); spawnVirus('soldier', 15.7, -36); }
  game.triggers = [{ z: -12, x: 3, inside: true, fn: () => { for (let i = 0; i < Math.round(4 * D().ecount); i++) spawnVirus(i % 2 ? 'soldier' : 'worm', R(-6, 6), R(-24, -18)); spawnVirus('statue', 7, -26); } }];
}
// --- 보스 ---
function setupBoss() {
  const k = spawnVirus('king', 0, -42, { home: [0, -42], leash: 14 }); k.yaw = 0; game.boss = k;
  const Z = W.gods.find((g) => g.id === 'zeuron');
  k.cables = [-1, -0.35, 0.35, 1].map((s, i) => {
    const node = { x: s * 6.5, z: -46.5 + Math.abs(s) * 1.5, hp: 160 * D().ehp, max: 160 * D().ehp, alive: true };
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: '#0c4a20', emissive: '#3dff74', emissiveIntensity: 1.6 })); m.position.set(node.x, PLAT.h + 0.8, node.z); scene.add(m); node.mesh = m;
    node.tube = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#0c3a18', emissive: '#2bff63', emissiveIntensity: 1.1 })); scene.add(node.tube); node.chip = new THREE.Vector3(Z.x + s * 1.5, PLAT.h + Z.top - 1, Z.z + 1);
    return node;
  });
  k.stagger = 0; k.regrow = 0; k.attack = null; k.atkCd = 3;
  $('boss').classList.remove('hidden'); $('boss').querySelector('.nm').textContent = '👑 바이러스 왕 — 연산의 왕을 빨아먹는 자';
  sfx('enemyult'); oracle(4, 0.5);
}
// 엔딩
function finish() {
  game.mode = 'ending'; freeGod('zeuron'); $('boss').classList.add('hidden');
  const mins = ((performance.now() - game.start) / 60000).toFixed(1);
  setTimeout(() => endingCut(mins), 2200);
}

// ---------- 신탁석 (체크포인트 + GPU 신의 기계 신탁) ----------
const ORACLES = [
  ['포세쿨 · 냉각의 신', '…쉬익, 쉬이익. 뜨겁구나, 필멸의 젤리여. <em>[TEMP 97°C]</em> 경비는 잔치에 취해 잠들었다. 등 뒤를 노려라. 성문의 도르래가 너희 본대를 부른다.'],
  ['제우론 · 연산의 왕', '<em>[FRAME 12fps]</em> …나의 연산이 끊기는구나. 바이러스가 화로와 돌조각에 스며든다. 오래 끌면 저들은 불어나리라. 쓰러진 형제를 혼자 두지 마라.'],
  ['므네모라 · 기억의 여신', '<em>[MEM 0x7F…ERR]</em> 회랑의 불은 데이터를 태운다. 0과 1이 재가 되어 흩날린다. 냉각의 밸브를 돌려라 — 포세쿨의 물이 길을 열 것이다.'],
  ['헤파볼트 · 전원의 신', '<em>[POWER 34%]</em> 거인들이 우리를 자물쇠로 잠갔다. 거인의 등에 빛나는 열쇠 구멍이 있다. 앞은 단단하나, 등은 무르다.'],
  ['아테나리스 · 렌더의 여신', '<em>[RENDER SYNC…OK]</em> 왕이 제우론의 연산을 빨아먹는다. 저 사슬을 끊어라, 영웅이여. 그러면 왕의 심장이 빛을 드러내리라.'],
];
function oracle(i, delay = 0) {
  const O = W.oracles[Math.min(i, W.oracles.length - 1)]; if (O) O.on = true;
  setTimeout(() => { if (game.mode !== 'play' && game.mode !== 'ending') return; const [who, line] = ORACLES[i]; $('oracle').querySelector('.who').textContent = `🗿 신탁석 · ${who}`; $('oracle').querySelector('.line').innerHTML = line; $('oracle').classList.remove('hidden'); game.oracleT = 9; sfx('spawn'); say(line.replace(/<[^>]+>/g, '').replace(/\[[^\]]+\]/g, ''), { pitch: 0.7, rate: 1.0, vol: 0.6 }); }, delay * 1000);
}

// ---------- 입력 ----------
const keys = new Set(); let mouseL = false, mouseR = false, lPressT = 0, look = { yaw: Math.PI, pitch: 0.22 };
const locked = () => document.pointerLockElement === $('c') || params.has('t');
function lock() { $('c').requestPointerLock?.(); }
$('c').addEventListener('click', () => { if (game.mode === 'play' && !locked()) lock(); });
document.addEventListener('pointerlockchange', () => { $('lockmsg').classList.toggle('hidden', locked() || game.mode !== 'play' || !!game.cut); });
addEventListener('mousemove', (e) => { if (!locked() || game.cut) return; look.yaw -= e.movementX * 0.0024; look.pitch = clamp(look.pitch + e.movementY * 0.0022, -0.6, 1.05); });
addEventListener('mousedown', (e) => { if (game.mode !== 'play' || !locked() || game.cut) return; if (e.button === 0) { mouseL = true; lPressT = game.t; onLDown(); } if (e.button === 2) { mouseR = true; if (game.me) game.me.blockT = game.t; } });
addEventListener('mouseup', (e) => { if (e.button === 0 && mouseL) { mouseL = false; onLUp(); } if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (game.mode === 'title') return;
  if (e.code === 'Space' && game.cut) { skipCut(); return; }
  keys.add(e.code);
  if (game.mode !== 'play' || game.cut) return;
  const me = game.me; if (!me || me.state !== 'ok') return;
  if (e.code === 'Digit1') switchW('sword'); if (e.code === 'Digit2') switchW('spear'); if (e.code === 'Digit3') switchW('bow');
  if (e.code === 'Space') roll();
  if (e.code === 'KeyE') setCmd(game.cmd === 'follow' ? 'wall' : game.cmd === 'wall' ? 'charge' : 'follow');
  if (e.code === 'KeyQ') disguise();
  if (e.code === 'KeyM') $('b-mute').click();
});
addEventListener('keyup', (e) => keys.delete(e.code));

// ---------- 무기 · 전투 ----------
const WEAP = { sword: ['🗡️', '칼 + 방패'], spear: ['🔱', '창 + 방패'], bow: ['🏹', '활'] };
function renderWeap() { const me = game.me; $('weap').innerHTML = Object.entries(WEAP).map(([k, [e, n]], i) => `<div class="w ${me?.weapon === k ? 'on' : ''}"><b>${i + 1}</b>${e}<small>${k === 'spear' ? `${n} · ${me?.spears ?? 0}` : k === 'bow' ? `화살 ${me?.arrows ?? 0}` : n}</small></div>`).join(''); }
function switchW(w) { const me = game.me; if (me.weapon === w) return; me.weapon = w; setWeapon(me.bear, w); me.combo = 0; me.atkLock = 0.25; renderWeap(); sfx('pick'); }
function setCmd(c, quiet) { game.cmd = c; const T = { follow: ['🐻 따라와', '가까운 적과 싸우며 나를 따라온다'], wall: ['🛡️ 방화벽 진형', '내 앞에 방패벽 — 앞에서 오는 공격 · 화살을 막는다'], charge: ['⚔️ 돌격', '보이는 적에게 달려든다'] }[c]; $('cmd').innerHTML = `${T[0]} <small>E 로 바꾸기 · ${T[1]}</small>`; if (!quiet) { toast(T[0], 1.2); sfx('abil'); } }
function aimDir() { const d = new THREE.Vector3(); camera.getWorldDirection(d); return d; }
function onLDown() { const me = game.me; if (!me || me.state !== 'ok' || me.rollT > 0) return; if (me.weapon === 'sword') swordSwing(); else { me.charge = 0.0001; } }
function onLUp() {
  const me = game.me; if (!me || me.state !== 'ok' || !me.charge) return;
  const held = game.t - lPressT, c = clamp(me.charge, 0, 1); me.charge = 0; $('charge').classList.add('hidden');
  if (me.weapon === 'spear') { if (held < 0.3 || me.spears <= 0) spearThrust(); else throwSpear(c); }
  else if (me.weapon === 'bow') { if (me.arrows > 0 && c > 0.15) shootArrow(c); else if (me.arrows <= 0) toast('화살이 없어요 · 신탁석 · 목마에서 채워요', 1.5); }
}
function faceAim(b) { b.yaw = look.yaw + Math.PI; }
function swordSwing() {
  const me = game.me; if (me.atkLock > 0) return;
  if (me.comboT > 0 && me.combo < 3) me.combo++; else me.combo = 1;
  me.comboT = 0.75; me.atkLock = me.combo === 3 ? 0.55 : 0.32; faceAim(me); me.bear.attack('melee'); sfx('swing');
  // 몰래 처치: 잠들었거나 나를 못 본 경비를 가까이에서
  const big = me.combo === 3;
  setTimeout(() => meleeHit(me, { reach: big ? 3.0 : 2.5, arc: big ? 1.4 : 1.1, dmg: big ? 34 : 19, kb: big ? 5 : 1.5, breakGuard: big }), 140);
}
function spearThrust() { const me = game.me; if (me.atkLock > 0) return; me.atkLock = 0.45; faceAim(me); me.bear.attack('melee'); sfx('swing'); setTimeout(() => meleeHit(me, { reach: 3.6, arc: 0.45, dmg: 27, kb: 3 }), 120); }
function meleeHit(b, o) {
  if (b.state !== 'ok') return; let hit = 0;
  for (const v of [...game.viruses]) {
    if (v.state !== 'ok') continue; const dx = v.x - b.x, dz = v.z - b.z, d = Math.hypot(dx, dz), r = o.reach + v.K.size * 0.6;
    if (d > r || Math.abs(ang(Math.atan2(dx, dz) - b.yaw)) > o.arc) continue;
    // 몰래 처치
    if (b.me && v.guard && (v.sleep || (!v.alert && Math.abs(ang(Math.atan2(-dx, -dz) - v.yaw)) > 1.6))) { num(v, '몰래 처치!', 'big'); damage(v, 9999, b, { stealth: true }); hit++; continue; }
    damage(v, o.dmg, b, o); hit++;
  }
  // 화로 정화 (초록 불은 세 번 치면 꺼진다)
  if (b.me) for (const B of W.braziers) if (B.state === 'inf' && Math.hypot(B.x - b.x, B.z - b.z) < o.reach + 0.6) { B.hits = (B.hits || 0) + 1; sparks(B.x, B.y + 1.5, B.z, '#3dff74', 8); if (B.hits >= 3) { cureBrazier(B); toast('🔥 화로를 되찾았다', 1.2); } hit++; }
  // 보스 케이블
  if (game.boss) for (const c of game.boss.cables) if (c.alive && Math.hypot(c.x - b.x, c.z - b.z) < o.reach + 0.8) { hitCable(c, o.dmg); hit++; }
  if (hit && b.me) { sfx('hit'); shake(0.12); }
  if (b.me) breakDisguise();
}
function throwSpear(c) {
  const me = game.me; me.spears--; renderWeap(); faceAim(me); me.bear.attack('throw'); sfx('throw'); breakDisguise();
  const m = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#7a5a3a' })); shaft.rotation.x = Math.PI / 2; m.add(shaft); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 0.9, roughness: 0.3 })); tip.rotation.x = Math.PI / 2; tip.position.z = 1.2; m.add(tip);
  launch('spear', m, 30 + 22 * c, 34 + 46 * c, 4);
}
function shootArrow(c) {
  const me = game.me; me.arrows--; renderWeap(); faceAim(me); me.bear.attack('throw'); sfx('throw', null, 0.6); breakDisguise();
  const m = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), new THREE.MeshStandardMaterial({ color: '#c9a77a' })); shaft.rotation.x = Math.PI / 2; m.add(shaft); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.setScalar(0.5); m.add(fl);
  launch('arrow', m, 42 + 40 * c, 12 + 40 * c, 2.2);
}
function launch(type, mesh, speed, dmg, grav) {
  const me = game.me, d = aimDir(), from = new THREE.Vector3(me.x, me.y + 1.7, me.z);
  // 화면 가운데(조준점)가 가리키는 곳으로
  const target = camera.position.clone().addScaledVector(d, 60), v = target.sub(from).normalize().multiplyScalar(speed); v.y += grav * 0.25;
  mesh.position.copy(from); scene.add(mesh); game.projs.push({ type, mesh, pos: from, vel: v, dmg, grav, life: 3, owner: 'bear' });
}
// 피해
function damage(v, dmg, from, o = {}) {
  if (v.state !== 'ok') return;
  let mul = 1;
  // 트로이 병사: 앞에서 오는 공격은 방패로 (3타 · 창 던지기는 막지 못한다)
  const fx = from ? from.x : v.x, fz = from ? from.z : v.z, front = Math.abs(ang(Math.atan2(fx - v.x, fz - v.z) - v.yaw)) < 1.0;
  if (v.K.guard && front && !o.breakGuard && !o.spear && v.stunT <= 0) { mul = 0.15; sparks(v.x, v.y + 1, v.z, '#b6ff3a', 6); if (from?.me) num(v, '막힘', ''); }
  else if (v.K.guard && front && o.breakGuard) { v.stunT = 1; num(v, '방패 깨기!', 'parry'); }
  if (v.kind === 'giant') { mul *= front ? 0.45 : 1.6; if (!front && from?.me) num(v, '약점!', 'big'); }
  if (v.kind === 'king') { const B = game.boss; mul *= B.stagger > 0 ? 1.5 : B.cables.some((c) => c.alive) ? 0.15 : 1; }
  const n = Math.round(dmg * mul); v.hp -= n; v.hitT = 0.15; v.reveal = 1;
  if (from?.me || o.proj) num(v, n, mul > 1.2 ? 'big' : '');
  if (o.kb) { const dx = v.x - fx, dz = v.z - fz, d = Math.hypot(dx, dz) || 1, k = v.kind === 'giant' || v.kind === 'king' ? 0.1 : 1; v.kbx += (dx / d) * o.kb * k; v.kbz += (dz / d) * o.kb * k; }
  if (v.guard && !v.alert) { v.alert = true; v.sleep = false; alarm(v); }
  if (v.hp <= 0) kill(v, from);
}
function kill(v, from) {
  v.state = 'dead'; game.kills++;
  shatter(v.x, v.y + v.K.size, v.z, v.K.size); sfx('elim', null, 0.7);
  // 신호 조각: 주워서 위장(Q)할 수 있다
  if (v.kind !== 'giant' && v.kind !== 'king') { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#4bff7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(0.9); m.position.set(v.x, v.y + 0.8, v.z); scene.add(m); game.frags.push({ mesh: m, x: v.x, z: v.z, t: 10 }); }
  if (v.kind === 'king') finish();
  removeVirus(v);
}
// 곰돌이가 맞을 때 (막기 · 튕겨 내기 · 방화벽 진형)
function hurtBear(b, dmg, from, o = {}) {
  if (b.state !== 'ok' || (b.me && (b.inv > 0 || game.cut))) return;
  const fx = from ? from.x : b.x, fz = from ? from.z : b.z, front = Math.abs(ang(Math.atan2(fx - b.x, fz - b.z) - b.yaw)) < 1.3;
  if (b.me && mouseR && b.weapon !== 'bow' && front) {
    if (game.t - b.blockT < 0.24 && from && !o.proj) { // 튕겨 내기
      if (from.stunT !== undefined) from.stunT = 1.4; sparks(b.x, b.y + 1.2, b.z, '#ffe27a', 14); num(b, '튕겨 내기!', 'parry'); sfx('head'); shake(0.2); return;
    }
    dmg *= 0.15; sparks(b.x, b.y + 1.2, b.z, '#ffd27a', 6); sfx('barrier');
  }
  if (!b.me && game.cmd === 'wall' && front) dmg *= 0.3;
  b.hp -= dmg; b.bear.hurt?.(); b.calm = 0;
  if (b.me) { num(b, Math.round(dmg), 'hurt'); $('hurt').style.boxShadow = `inset 0 0 160px rgba(200,20,20,${clamp(dmg / 30, 0.25, 0.7)})`; setTimeout(() => ($('hurt').style.boxShadow = ''), 220); sfx('hurt'); shake(0.18); }
  if (b.hp <= 0) bearDown(b);
}
// 젤리 리스폰: 녹아서 젤리 웅덩이 → 가장 가까운 되찾은 제단 (처음엔 목마)
function bearDown(b) {
  b.state = 'down'; b.hp = 0; b.downT = b.me ? 4 : 7; b.infect = 0; b.bear.root.visible = false;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 10), new THREE.MeshStandardMaterial({ color: b.bear.color || '#8a5634', transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1, emissive: b.bear.color || '#8a5634', emissiveIntensity: 0.15 })); m.scale.set(1, 0.25, 1); m.position.set(b.x, b.y + 0.12, b.z); scene.add(m);
  game.puddles.push({ mesh: m, b }); b.puddle = m;
  if (b.me) { toast('🫧 젤리로 녹았다… 가장 가까운 제단에서 다시 굳어요', 2.5); sfx('die'); }
}
function respawn(b) {
  const pts = game.respawnPts, p = pts.reduce((a, q) => (Math.hypot(q.x - b.x, q.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z) ? q : a), pts[0]);
  b.x = p.x + R(-1.2, 1.2); b.z = p.z + R(-1, 1); b.y = groundAt(b.x, b.z); b.state = 'ok'; b.hp = b.max; b.bear.root.visible = true; b.reform = 1;
  scene.remove(b.puddle); game.puddles = game.puddles.filter((q) => q.b !== b); b.puddle = null;
  ring(b.x, b.y + 0.2, b.z, '#ffd27a', 3, 0.7);
  if (b.me) { b.inv = 1.5; toast(`🐻 ${p.name}에서 다시 굳었다!`, 1.5); }
}
// ---------- 꾀: 위장 (쓰러진 바이러스의 신호를 뒤집어쓰기) ----------
function disguise() {
  const me = game.me, f = game.frags.find((q) => Math.hypot(q.x - me.x, q.z - me.z) < 3.5);
  if (!f) { toast('🦠 가까이에 바이러스 신호 조각이 없어요 (쓰러뜨린 바이러스가 남겨요)', 1.6); return; }
  scene.remove(f.mesh); game.frags.splice(game.frags.indexOf(f), 1);
  me.disg = 12; sfx('blink'); toast('🦠 위장! 바이러스 신호를 뒤집어썼다 — 공격하면 풀려요', 2);
  if (!me.disgMesh) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.15, 16, 12), new THREE.MeshBasicMaterial({ color: '#3dff74', wireframe: true, transparent: true, opacity: 0.35 })); s.position.y = 1.1; me.bear.root.add(s); me.disgMesh = s; }
  me.disgMesh.visible = true; for (const v of game.viruses) if (v.target === me) v.target = null;
}
function breakDisguise() { const me = game.me; if (me?.disg > 0) { me.disg = 0; me.disgMesh.visible = false; toast('위장이 풀렸다!', 1); } }

// ---------- 감염 ----------
function infectBrazier(B) { B.state = 'inf'; B.hits = 0; B.spawnT = 4; W.fires.setGreen(B.fire, 1); W.fires.setStrength(B.fire, 1); }
function cureBrazier(B) { B.state = 'ok'; W.fires.setGreen(B.fire, 0); sparks(B.x, B.y + 1.6, B.z, '#ffb04a', 14); }
function alarm(v) { if (game.phase !== 'stealth' || game.alarmed) return; game.alarmed = true; toast('🚨 들켰다! 경비들이 깨어난다', 2); sfx('enemyult'); setTimeout(() => { for (const u of game.viruses) if (u.guard && Math.hypot(u.x - v.x, u.z - v.z) < 26) { u.alert = true; u.sleep = false; } for (const a of game.allies) a.stealth = false; }, 900); }

// ---------- 효과 ----------
const fx = [];
const SH = new THREE.BoxGeometry(0.16, 0.16, 0.16), shM = new THREE.MeshBasicMaterial({ color: '#4bff7a' });
function shatter(x, y, z, s) { for (let i = 0; i < 14 + s * 6; i++) { const m = new THREE.Mesh(SH, i % 5 ? shM : new THREE.MeshBasicMaterial({ color: '#ff3cdc' })); m.position.set(x + R(-0.5, 0.5) * s, y + R(-0.5, 0.5) * s, z + R(-0.5, 0.5) * s); m.scale.setScalar(R(0.6, 1.8) * s); scene.add(m); fx.push({ m, v: new THREE.Vector3(R(-6, 6), R(2, 9), R(-6, 6)), t: R(0.6, 1.1), grav: 14 }); } }
function sparks(x, y, z, col, n) { const M = new THREE.SpriteMaterial({ map: glow(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); for (let i = 0; i < n; i++) { const m = new THREE.Sprite(M); m.scale.setScalar(R(0.15, 0.35)); m.position.set(x, y, z); scene.add(m); fx.push({ m, v: new THREE.Vector3(R(-5, 5), R(1, 6), R(-5, 5)), t: R(0.25, 0.5), grav: 9 }); } }
function ring(x, y, z, col, r, life) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); fx.push({ m, ring: r, t: life, t0: life }); }
function updateFx(dt) { for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t -= dt; if (f.ring) { const k = 1 - f.t / f.t0; f.m.scale.setScalar(0.5 + k * f.ring); f.m.material.opacity = 1 - k; } else { f.v.y -= f.grav * dt; f.m.position.addScaledVector(f.v, dt); if (f.m.material.opacity !== undefined && f.m.isSprite) f.m.material.opacity = Math.min(1, f.t * 3); } if (f.t <= 0) { scene.remove(f.m); fx.splice(i, 1); } } }
let shakeK = 0; function shake(k) { shakeK = Math.max(shakeK, k); }
const toV = new THREE.Vector3();
function screenPos(x, y, z) { toV.set(x, y, z).project(camera); return toV.z < 1 ? [(toV.x * 0.5 + 0.5) * innerWidth, (-toV.y * 0.5 + 0.5) * innerHeight] : null; }
function num(e, text, cls) { const p = screenPos(e.x + R(-0.3, 0.3), (e.y || 0) + (e.K ? e.K.size * 2 : 2.2), e.z); if (!p) return; const d = document.createElement('div'); d.className = `num ${cls || ''}`; d.textContent = text; d.style.left = `${p[0]}px`; d.style.top = `${p[1]}px`; $('nums').appendChild(d); setTimeout(() => d.remove(), 800); }
function toast(text, sec) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), sec * 1000); }

// ---------- 구르기 ----------
function roll() { const me = game.me; if (me.rollCd > 0) return; const f = keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD') ? me.moveYaw : look.yaw; me.rollT = 0.42; me.rollCd = 0.75; me.rollYaw = f; me.inv = 0.36; sfx('dash'); }

// ---------- 움직임 · 부딪힘 ----------
function pushOut(e, r) {
  for (const c of W.circles) { const dx = e.x - c.x, dz = e.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { e.x = c.x + (dx / d) * m; e.z = c.z + (dz / d) * m; } }
  for (const b of W.boxes) { if (e.x > b.x0 - r && e.x < b.x1 + r && e.z > b.z0 - r && e.z < b.z1 + r) { const l = e.x - (b.x0 - r), rr = b.x1 + r - e.x, t = e.z - (b.z0 - r), bt = b.z1 + r - e.z, m = Math.min(l, rr, t, bt); if (m === l) e.x = b.x0 - r; else if (m === rr) e.x = b.x1 + r; else if (m === t) e.z = b.z0 - r; else e.z = b.z1 + r; } }
  e.x = clamp(e.x, -47, 47); e.z = clamp(e.z, -72.5, game.phase === 'stealth' || game.phase === 'assault' ? 69.5 : 69.5);
}
function moveTo(e, tx, tz, speed, dt, r = 0.5) { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d < 0.05) return 0; const s = Math.min(d, speed * dt); e.x += (dx / d) * s; e.z += (dz / d) * s; e.yaw += ang(Math.atan2(dx, dz) - e.yaw) * Math.min(1, dt * 8); pushOut(e, r); return s / dt; }

// ---------- 한 프레임 ----------
let last = performance.now(), holdFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  game.t += dt;
  if (game.mode === 'play' || game.mode === 'ending' || game.cut) { if (game.cut) runCut(dt); else if (game.mode === 'play') tick(dt); }
  W.update(dt, game.t, camera); updateFx(dt);
  for (const b of [game.me, ...game.allies]) if (b) animBear(b, dt);
  for (const v of game.viruses) { v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = v.yaw; animateVirus(v, dt, game.t); }
  stutterFx(dt);
  if (game.testCam && !game.cut) { const c = game.testCam; camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
  if (holdFrames > 0) { holdFrames--; return; } // 프레임 신앙: 연산력이 떨어지면 일부러 화면이 멈칫한다
  if (composer) composer.render(); else renderer.render(scene, camera);
}
function animBear(b, dt) {
  const R0 = b.bear.root; R0.position.set(b.x, b.y, b.z); R0.rotation.y = b.yaw;
  if (b.reform > 0) { b.reform = Math.max(0, b.reform - dt * 1.4); R0.scale.set(0.85 * (1 + b.reform * 0.4), 0.85 * (1 - b.reform * 0.7), 0.85 * (1 + b.reform * 0.4)); } else R0.scale.setScalar(0.85);
  b.bear.update(dt, b.speed || 0);
  poseGear(b.bear, dt, { block: b.me ? mouseR && b.weapon !== 'bow' : game.cmd === 'wall' && game.mode === 'play', speed: b.speed || 0, t: game.t });
  if (b.me && b.rollT > 0) { b.bear.inner.rotation.x = (1 - b.rollT / 0.42) * Math.PI * 2; } else b.bear.inner.rotation.x = 0;
}

function tick(dt) {
  const me = game.me; if (!me) return;
  me.atkLock = Math.max(0, (me.atkLock || 0) - dt); me.comboT -= dt; me.rollCd -= dt; me.inv -= dt; me.calm += dt;
  if (me.disg > 0) { me.disg -= dt; $('disg').classList.remove('hidden'); $('disg').querySelector('b').textContent = `${Math.ceil(me.disg)}초`; if (me.disg <= 0) breakDisguise(); } else $('disg').classList.add('hidden');
  // --- 나 ---
  if (me.state === 'ok') {
    let mx = 0, mz = 0; if (keys.has('KeyW')) mz += 1; if (keys.has('KeyS')) mz -= 1; if (keys.has('KeyA')) mx += 1; if (keys.has('KeyD')) mx -= 1;
    const fy = look.yaw + Math.PI, sx = Math.sin(fy), sz = Math.cos(fy), moving = mx || mz;
    let speed = 0;
    if (me.rollT > 0) { me.rollT -= dt; me.x += Math.sin(me.rollYaw) * 15 * dt; me.z += Math.cos(me.rollYaw) * 15 * dt; speed = 6; }
    else if (moving) { const vx = sx * mz + sz * mx, vz = sz * mz - sx * mx, l = Math.hypot(vx, vz); me.moveYaw = Math.atan2(vx, vz); const sp = (keys.has('ShiftLeft') ? 8.2 : 5.4) * (mouseR || me.charge ? 0.55 : 1); me.x += (vx / l) * sp * dt; me.z += (vz / l) * sp * dt; speed = sp; if (!mouseR && !me.charge && me.atkLock <= 0) me.yaw += ang(me.moveYaw - me.yaw) * Math.min(1, dt * 12); }
    if (mouseR || me.charge) me.yaw += ang(fy - me.yaw) * Math.min(1, dt * 16);
    me.speed = speed; pushOut(me, 0.55); me.y = groundAt(me.x, me.z);
    if (me.charge) { me.charge = Math.min(1, me.charge + dt / (me.weapon === 'bow' ? 0.9 : 1.0)); if (game.t - lPressT > (me.weapon === 'bow' ? 0.05 : 0.3)) { $('charge').classList.remove('hidden'); $('charge').querySelector('i').style.width = `${me.charge * 100}%`; } }
    if (me.hp < me.max && me.calm > 5) me.hp = Math.min(me.max, me.hp + dt * 6);
    // 줍기: 던진 창
    for (const p of [...game.pickups]) if (Math.hypot(p.x - me.x, p.z - me.z) < 1.6 && me.spears < 3) { me.spears++; scene.remove(p.mesh); game.pickups.splice(game.pickups.indexOf(p), 1); renderWeap(); sfx('pick'); }
  } else if (me.state === 'down') { me.downT -= dt; if (me.downT <= 0) respawn(me); }
  $('hp-bar').style.width = `${(me.hp / me.max) * 100}%`;
  $('cross').classList.toggle('aim', me.weapon === 'bow' && (mouseR || !!me.charge));
  // --- 동료 ---
  allyAI(dt);
  // --- 바이러스 ---
  virusAI(dt);
  // --- 투사체 ---
  projectiles(dt);
  // --- 신호 조각 · 젤리 웅덩이 (감염) ---
  for (const f of [...game.frags]) { f.t -= dt; f.mesh.position.y = groundAt(f.x, f.z) + 0.8 + Math.sin(game.t * 4 + f.x) * 0.15; if (f.t <= 0) { scene.remove(f.mesh); game.frags.splice(game.frags.indexOf(f), 1); } }
  for (const p of [...game.puddles]) { const b = p.b; p.mesh.scale.y = 0.25 + Math.sin(game.t * 5) * 0.03; if (b.me) continue;
    const near = game.viruses.find((v) => v.state === 'ok' && Math.hypot(v.x - b.x, v.z - b.z) < 1.9);
    if (near) { b.infect += dt; if (b.infect > 2.2) { // 감염: 쓰러진 형제가 초록 바이러스가 된다
      b.state = 'lost'; game.lost++; scene.remove(p.mesh); game.puddles.splice(game.puddles.indexOf(p), 1); scene.remove(b.bear.root); game.allies.splice(game.allies.indexOf(b), 1);
      spawnVirus('bear', b.x, b.z); toast(`🧬 ${b.name}이(가) 감염됐다…`, 2); sfx('enemyult'); continue; } }
    b.downT -= dt; if (b.downT <= 0) respawn(b); }
  // --- 감염: 조각상 · 화로 (2막부터) ---
  if (game.phase === 'assault' || game.phase === 'colonnade' || game.phase === 'altars') {
    for (const S of W.statues) if (S.state === 'ok') { const v = game.viruses.find((u) => u.state === 'ok' && u.kind !== 'statue' && Math.hypot(u.x - S.x, u.z - S.z) < 2.6); S.inf = v ? (S.inf || 0) + dt : 0; if (S.inf > 3.5) { S.state = 'inf'; S.g.visible = false; W.circles.splice(W.circles.indexOf(S.col), 1); const sv = spawnVirus('statue', S.x, S.z); sv.from = S; toast('🗿 조각상이 감염됐다!', 1.5); } }
    for (const B of W.braziers) { if (B.state === 'ok') { const v = game.viruses.find((u) => u.state === 'ok' && Math.hypot(u.x - B.x, u.z - B.z) < 2.2); B.inf = v ? (B.inf || 0) + dt : 0; if (B.inf > 3) infectBrazier(B); }
      else if (B.state === 'inf') { B.spawnT -= dt; if (B.spawnT <= 0 && game.viruses.length < 26 && Math.hypot(B.x - me.x, B.z - me.z) < 40) { B.spawnT = 9; spawnVirus('worm', B.x + R(-1, 1), B.z + R(-1, 1)); } } }
  }
  // --- 막마다 진행 ---
  phaseTick(dt);
  // --- 상호작용 ---
  interact(dt);
  // --- 신탁 · 표시 ---
  if (game.oracleT > 0) { game.oracleT -= dt; if (game.oracleT <= 0) $('oracle').classList.add('hidden'); }
  markers();
  camTick(dt);
}

function allyAI(dt) {
  const me = game.me, fy = look.yaw + Math.PI;
  game.allies.forEach((a, i) => {
    if (a.state !== 'ok') { a.speed = 0; return; }
    a.atkT -= dt; a.cd -= dt; a.calm = (a.calm || 0) + dt; if (a.calm > 6) a.hp = Math.min(a.max, a.hp + dt * 4);
    // 넉백
    let tx, tz, speed = 5.2;
    const enemies = game.viruses.filter((v) => v.state === 'ok' && (!v.guard || v.alert));
    const near = (r) => { let best = null, bd = r; for (const v of enemies) { const d = Math.hypot(v.x - a.x, v.z - a.z); if (d < bd) { bd = d; best = v; } } return best; };
    if (a.stealth) { const k = i + 1; tx = me.x - Math.sin(fy) * 2.2 * k + Math.cos(fy) * (k % 2 ? 1.4 : -1.4); tz = me.z - Math.cos(fy) * 2.2 * k - Math.sin(fy) * (k % 2 ? 1.4 : -1.4); speed = 5.6; a.target = null; }
    else if (game.cmd === 'wall') { const n = game.allies.length, off = (i - (n - 1) / 2) * 1.6; tx = me.x + Math.sin(fy) * 3.4 + Math.cos(fy) * off; tz = me.z + Math.cos(fy) * 3.4 - Math.sin(fy) * off; a.target = near(3.5); }
    else { a.target = near(game.cmd === 'charge' ? 40 : 14); const k = i + 1; tx = me.x - Math.sin(fy) * (2 + (k % 3)) + Math.cos(fy) * ((k % 2 ? 1 : -1) * (1 + k * 0.6)); tz = me.z - Math.cos(fy) * (2 + (k % 3)) - Math.sin(fy) * ((k % 2 ? 1 : -1) * (1 + k * 0.6)); }
    const t = a.target;
    if (t) { const d = Math.hypot(t.x - a.x, t.z - a.z), reach = 1.9 + t.K.size * 0.6; if (d > reach) { tx = t.x; tz = t.z; } else { tx = a.x; tz = a.z; a.yaw += ang(Math.atan2(t.x - a.x, t.z - a.z) - a.yaw) * Math.min(1, dt * 10); if (a.cd <= 0) { a.cd = R(0.9, 1.4); a.bear.attack('melee'); setTimeout(() => meleeHit(a, { reach: 2.4, arc: 0.9, dmg: R(9, 14), kb: 1 }), 150); } } }
    const dist = Math.hypot(tx - a.x, tz - a.z);
    a.speed = dist > 0.4 ? moveTo(a, tx, tz, dist > 8 ? speed * 1.5 : speed, dt) : 0;
    if (!t && game.cmd === 'wall') a.yaw += ang(fy - a.yaw) * Math.min(1, dt * 6);
    // 동료끼리 겹치지 않게
    for (const b of game.allies) if (b !== a && b.state === 'ok') { const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz); if (d < 1.1 && d > 1e-3) { a.x += (dx / d) * (1.1 - d) * 0.5; a.z += (dz / d) * (1.1 - d) * 0.5; } }
    a.y = groundAt(a.x, a.z);
  });
}

function virusAI(dt) {
  const me = game.me, bears = [me, ...game.allies].filter((b) => b && b.state === 'ok');
  for (const v of game.viruses) {
    if (v.state !== 'ok') continue;
    v.hitT -= dt; v.cd -= dt; v.stunT -= dt;
    v.x += v.kbx * dt * 6; v.z += v.kbz * dt * 6; v.kbx *= 1 - Math.min(1, dt * 8); v.kbz *= 1 - Math.min(1, dt * 8);
    if (v.kind === 'king') { kingAI(v, dt); continue; }
    // 경비: 잠 · 순찰 · 의심
    if (v.guard && !v.alert) {
      if (v.sleep) { v.y = groundAt(v.x, v.z); continue; }
      if (v.patrol) { const p = v.patrol[v.pi]; if (moveTo(v, p[0], p[1], 1.8, dt, v.K.size * 0.6) === 0 || Math.hypot(p[0] - v.x, p[1] - v.z) < 0.6) v.pi = (v.pi + 1) % v.patrol.length; }
      if (me.state === 'ok' && me.disg <= 0) { const dx = me.x - v.x, dz = me.z - v.z, d = Math.hypot(dx, dz); if (d < 13 && Math.abs(ang(Math.atan2(dx, dz) - v.yaw)) < 0.95) { v.sus += dt * (1.9 - d / 9) * (keys.has('ShiftLeft') ? 1.6 : 1); if (v.sus >= 1) { v.alert = true; alarm(v); } } else v.sus = Math.max(0, v.sus - dt * 0.3); }
      v.y = groundAt(v.x, v.z); continue;
    }
    if (v.stunT > 0) { v.windup = 0; continue; }
    // 목표: 가장 가까운 곰돌이 (위장한 나는 빼고)
    let t = null, bd = 34;
    for (const b of bears) { if (b.me && b.disg > 0) continue; const d = Math.hypot(b.x - v.x, b.z - v.z); if (d < bd) { bd = d; t = b; } }
    // 지키는 자리가 있으면 너무 멀리 쫓지 않는다
    if (v.home && t && Math.hypot(t.x - v.home[0], t.z - v.home[1]) > v.leash + 6) t = null;
    v.target = t;
    // 스파이웨어: 가까이 와야 보인다
    if (v.K.stealth) v.reveal = Math.max(v.reveal - dt * 0.8, t && bd < 6 ? 1 : 0);
    if (v.windup > 0) { // 공격 직전 (튕겨 낼 기회)
      v.windup -= dt; if (t) v.yaw += ang(Math.atan2(t.x - v.x, t.z - v.z) - v.yaw) * Math.min(1, dt * 3);
      if (v.windup <= 0) { v.cd = v.K.cd; if (t && bd < v.K.reach * 1.3 + 0.6 && Math.abs(ang(Math.atan2(t.x - v.x, t.z - v.z) - v.yaw)) < 1.1) { hurtBear(t, v.K.dmg, v); if (v.kind === 'giant' || v.kind === 'statue') { ring(v.x, v.y + 0.2, v.z, '#3dff74', v.K.reach * 1.6, 0.5); shake(0.15); sfx('smash'); for (const b of bears) if (b !== t && Math.hypot(b.x - v.x, b.z - v.z) < v.K.reach * 1.5) hurtBear(b, v.K.dmg * 0.5, v); } } }
      v.y = groundAt(v.x, v.z); continue;
    }
    if (t) { const reach = v.K.reach + 0.45; if (bd > reach) moveTo(v, t.x, t.z, v.K.speed, dt, v.K.size * 0.55); else { v.yaw += ang(Math.atan2(t.x - v.x, t.z - v.z) - v.yaw) * Math.min(1, dt * 6); if (v.cd <= 0) v.windup = v.K.wind; } }
    else if (v.home) moveTo(v, v.home[0], v.home[1], v.K.speed * 0.6, dt, v.K.size * 0.55);
    // 서로 겹치지 않게
    for (const u of game.viruses) if (u !== v) { const dx = v.x - u.x, dz = v.z - u.z, d = Math.hypot(dx, dz), m = (v.K.size + u.K.size) * 0.55; if (d < m && d > 1e-3) { v.x += (dx / d) * (m - d) * 0.5; v.z += (dz / d) * (m - d) * 0.5; } }
    v.y = groundAt(v.x, v.z);
  }
}
// 바이러스 왕: 내려찍기(둥근 충격파) · 웜 소환 · 레이저 쓸기 · 돌진. 케이블이 있으면 단단하고, 다 끊으면 휘청
function kingAI(k, dt) {
  const me = game.me; k.y = groundAt(k.x, k.z); k.atkCd -= dt;
  const alive = k.cables.filter((c) => c.alive);
  for (const c of k.cables) { c.mesh.visible = c.alive; c.tube.visible = c.alive; if (c.alive) { c.mesh.rotation.y += dt * 2; const a = c.chip, b = new THREE.Vector3(k.x, k.y + 2.4, k.z - 0.6), mid = new THREE.Vector3(c.x, PLAT.h + 0.8, c.z); c.tube.geometry.dispose(); c.tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, new THREE.Vector3((a.x + mid.x) / 2, a.y - 1, (a.z + mid.z) / 2), mid, new THREE.Vector3((mid.x + b.x) / 2, PLAT.h + 1.6, (mid.z + b.z) / 2), b]), 24, 0.16, 6); } }
  if (alive.length === 0 && k.stagger <= 0 && !k.staggered) { k.stagger = 9; k.staggered = true; toast('💥 사슬이 모두 끊겼다! 빛나는 핵을 쳐요!', 2.5); sfx('bigboom'); shake(0.4); }
  if (k.stagger > 0) { k.stagger -= dt; k.mesh.userData.heart.scale.setScalar(1.6 + Math.sin(game.t * 10) * 0.3); k.mesh.rotation.z = Math.sin(game.t * 6) * 0.05; if (k.stagger <= 0) { k.staggered = false; if (k.hp > k.max * 0.25) { const n = k.hp > k.max * 0.6 ? 4 : 2; k.cables.slice(0, n).forEach((c) => { c.alive = true; c.hp = c.max * 0.7; }); toast('⛓️ 바이러스 왕이 사슬을 다시 꽂았다!', 2); } } return; }
  k.mesh.userData.heart.scale.setScalar(alive.length ? 0.5 : 1.2);
  if (alive.length) k.hp = Math.min(k.max, k.hp + dt * 6);
  $('boss').querySelector('.bar i').style.width = `${(k.hp / k.max) * 100}%`;
  $('boss').querySelector('.sub').textContent = alive.length ? `⛓️ 연산 사슬 ${alive.length}개 — 왕이 제우론의 힘을 빨아먹는 중 (피해 거의 안 들어가요)` : k.stagger > 0 ? '💥 휘청! 지금이에요' : '';
  if (k.attack) { const A = k.attack; A.t -= dt;
    if (A.kind === 'slam') { if (A.t <= 0) { ring(k.x, k.y + 0.2, k.z, '#3dff74', 16, 0.6); sfx('bigboom'); shake(0.35); for (const b of [me, ...game.allies]) if (b.state === 'ok' && Math.hypot(b.x - k.x, b.z - k.z) < 8 && !(b.me && b.inv > 0)) hurtBear(b, k.K.dmg, k); k.attack = null; } }
    else if (A.kind === 'beam') { const a = A.a0 + (A.a1 - A.a0) * (1 - A.t / A.dur); A.line.position.set(k.x, PLAT.h + 0.15, k.z); A.line.rotation.y = a; A.line.material.opacity = A.t > A.dur - 0.7 ? 0.25 : 0.9; if (A.t < A.dur - 0.7) for (const b of [me, ...game.allies]) { if (b.state !== 'ok') continue; const dx = b.x - k.x, dz = b.z - k.z, along = dx * Math.sin(a) + dz * Math.cos(a), perp = Math.abs(dx * Math.cos(a) - dz * Math.sin(a)); if (along > 0 && along < 26 && perp < 0.9 && !(b.hitBeam > game.t)) { b.hitBeam = game.t + 0.6; hurtBear(b, k.K.dmg * 0.7, null, { proj: true }); } } if (A.t <= 0) { scene.remove(A.line); k.attack = null; } }
    else if (A.kind === 'charge') { if (A.t > 0.6) k.yaw += ang(Math.atan2(me.x - k.x, me.z - k.z) - k.yaw) * Math.min(1, dt * 4); else { k.x += Math.sin(k.yaw) * 16 * dt; k.z += Math.cos(k.yaw) * 16 * dt; pushOut(k, 2.2); for (const b of [me, ...game.allies]) if (b.state === 'ok' && Math.hypot(b.x - k.x, b.z - k.z) < 2.8 && !(b.hitCh > game.t)) { b.hitCh = game.t + 1; hurtBear(b, k.K.dmg * 0.8, k); } } if (A.t <= 0) k.attack = null; }
    return; }
  const d = Math.hypot(me.x - k.x, me.z - k.z);
  if (d > 5) moveTo(k, me.x, me.z, k.K.speed, dt, 2.2); else k.yaw += ang(Math.atan2(me.x - k.x, me.z - k.z) - k.yaw) * Math.min(1, dt * 4);
  if (k.atkCd <= 0) { k.atkCd = R(2.6, 3.6) / (k.hp < k.max * 0.4 ? 1.3 : 1);
    const pick = d < 7 ? 'slam' : Math.random() < 0.45 ? 'beam' : Math.random() < 0.5 ? 'charge' : 'summon';
    if (pick === 'slam') { k.attack = { kind: 'slam', t: 1.1 }; ring(k.x, k.y + 0.2, k.z, '#ff5a5a', 8, 1.1); }
    else if (pick === 'beam') { const a0 = Math.atan2(me.x - k.x, me.z - k.z) - 0.9, line = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 26).translate(0, 13, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3dff74', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); scene.add(line); k.attack = { kind: 'beam', t: 2.6, dur: 2.6, a0, a1: a0 + 1.8, line }; sfx('laser'); }
    else if (pick === 'charge') { k.attack = { kind: 'charge', t: 1.6 }; sfx('dash'); }
    else { for (let i = 0; i < 3; i++) spawnVirus('worm', k.x + R(-3, 3), k.z + R(1, 3)); sfx('spawn'); } }
}
function hitCable(c, dmg) { c.hp -= dmg; sparks(c.x, PLAT.h + 0.8, c.z, '#b6ff3a', 6); if (c.hp <= 0 && c.alive) { c.alive = false; shatter(c.x, PLAT.h + 0.8, c.z, 1); sfx('smash'); toast(`⛓️ 사슬 끊음! (${game.boss.cables.filter((q) => q.alive).length}개 남음)`, 1.2); } }

function projectiles(dt) {
  for (let i = game.projs.length - 1; i >= 0; i--) {
    const p = game.projs[i]; p.life -= dt; p.vel.y -= p.grav * dt; p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos); p.mesh.lookAt(p.pos.clone().add(p.vel));
    let done = p.life <= 0 || p.pos.y < groundAt(p.pos.x, p.pos.z);
    for (const b of W.boxes) if (p.pos.x > b.x0 && p.pos.x < b.x1 && p.pos.z > b.z0 && p.pos.z < b.z1 && p.pos.y < b.h) done = true;
    if (!done) for (const v of game.viruses) { if (v.state !== 'ok') continue; const s = v.K.size; if (Math.hypot(v.x - p.pos.x, v.z - p.pos.z) < s * 0.85 + 0.2 && p.pos.y > v.y && p.pos.y < v.y + s * 2.6) {
      // 거인 등 열쇠 구멍 · 왕 핵은 화살에도 약점
      damage(v, p.dmg, { x: p.pos.x - p.vel.x * 0.05, z: p.pos.z - p.vel.z * 0.05 }, { proj: true, spear: p.type === 'spear', kb: p.type === 'spear' ? 3 : 0.6 }); sparks(p.pos.x, p.pos.y, p.pos.z, '#ffd27a', 6); sfx('hit'); done = true; break; } }
    if (!done && game.boss) for (const c of game.boss.cables) if (c.alive && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 0.9 && p.pos.y < PLAT.h + 2) { hitCable(c, p.dmg); done = true; }
    if (!done) for (const B of W.braziers) if (B.state === 'inf' && Math.hypot(B.x - p.pos.x, B.z - p.pos.z) < 0.8 && p.pos.y < B.y + 2.2) { B.hits = (B.hits || 0) + 1; if (B.hits >= 3) cureBrazier(B); done = true; }
    if (done) { scene.remove(p.mesh); game.projs.splice(i, 1); if (p.type === 'spear') { const m = p.mesh; m.position.y = groundAt(p.pos.x, p.pos.z) + 0.15; m.rotation.set(Math.PI / 2, 0, R(0, 6)); scene.add(m); game.pickups.push({ mesh: m, x: p.pos.x, z: p.pos.z }); } }
  }
}

// ---------- 막 진행 ----------
function phaseTick(dt) {
  const me = game.me, ph = game.phase;
  if (game.waves) { const Wv = game.waves; Wv.t -= dt; const alive = game.viruses.filter((v) => v.state === 'ok').length;
    if (Wv.left > 0 && Wv.t <= 0 && alive < Wv.max) { Wv.t = R(0.6, 1.4); const s = Wv.spots[Math.floor(Math.random() * Wv.spots.length)]; spawnVirus(Wv.kinds[Math.floor(Math.random() * Wv.kinds.length)], s[0] + R(-2, 2), s[1] + R(-2, 2)); Wv.left--; }
    $('obj').textContent = `⚔️ 광장의 바이러스를 몰아내요 · 남은 바이러스 ${Wv.left + alive}`;
    if (Wv.left <= 0 && alive === 0) { game.waves = null; $('obj').textContent = '❄️ 냉각의 신 포세쿨의 사슬을 풀어요 (분수에서 F 꾹)'; toast('광장을 되찾았다!', 2); sfx('cap'); }
  }
  if (game.triggers) for (const T of [...game.triggers]) { if ((T.inside ? Math.abs(me.x) < 11 && me.z < T.z : me.z < T.z) && (T.x === undefined || T.inside || me.x > T.x)) { T.fn(); game.triggers.splice(game.triggers.indexOf(T), 1); } }
  if (ph === 'colonnade' && me.z < -44 && W.fireWalls.every((f) => f.open)) enterPhase('altars');
  if (ph === 'altars') { const next = W.gods.find((g) => game.altarQ.includes(g.id) && !g.freed); if (!next) { $('obj').textContent = '🗿 성소 앞 신탁석에 다가가요'; if (Math.abs(me.x) < 4 && me.z < -9 && me.z > -14) enterPhase('boss'); } else { const guards = game.viruses.filter((v) => v.state === 'ok' && Math.hypot(v.x - next.x, v.z - next.z) < 14).length; $('obj').textContent = guards ? `⛓️ ${next.title} ${next.name} 앞의 바이러스를 쓰러뜨려요 (${guards})` : `✨ ${next.title} ${next.name}의 자물쇠를 풀어요 (F 꾹)`; } }
}
// F 꾹: 도르래 · 분수 · 밸브 · 제단
function interact(dt) {
  const me = game.me; if (me.state !== 'ok') { $('prompt').classList.add('hidden'); return; }
  let it = null; const near = (x, z, r) => Math.hypot(me.x - x, me.z - z) < r;
  if (game.phase === 'stealth' && !W.winch.done && near(W.winch.x, W.winch.z, 2.8)) it = { label: '🚪 성문 도르래 돌리기', time: 4, fn: () => openGate() };
  if (game.phase === 'assault' && !game.waves && !W.gods[0].freed && near(W.gods[0].x, W.gods[0].z, 6.5)) it = { label: '❄️ 포세쿨의 사슬 풀기', time: 3, fn: () => { freeGod('posecool'); setTimeout(() => enterPhase('colonnade'), 1800); } };
  if (game.phase === 'colonnade') for (const fw of W.fireWalls) if (!fw.open && near(fw.valve.x, fw.valve.z, 2.6)) it = { label: '💧 냉각 밸브 열기', time: 2.5, fn: () => openFireWall(fw), spin: fw.valve.wheel };
  const nextG = game.phase === 'altars' ? W.gods.find((g) => game.altarQ.includes(g.id) && !g.freed) : null;
  if (nextG) for (const G of [nextG]) if (near(G.x, G.z, 4.2)) { const guards = game.viruses.some((v) => v.state === 'ok' && Math.hypot(v.x - G.x, v.z - G.z) < 14); if (!guards) it = { label: `✨ ${G.name}의 랜섬 자물쇠 풀기`, time: 3, fn: () => { freeGod(G.id); if (G.id === 'mnemora') oracle(3, 1.5); if (G.id === 'hephavolt') { unbox(W.cellaDoor.box); W.cellaDoor.mesh.visible = false; toast('🚪 성소의 방화벽이 풀렸다 — 렌더의 여신이 기다린다', 3); } } }; }
  for (const O of W.oracles) if (near(O.x, O.z, 2.4) && me.arrows < 24) { me.arrows = 24; renderWeap(); toast('🏹 화살을 채웠다', 1); }
  if (near(0, 31, 3) && me.arrows < 24) { me.arrows = 24; renderWeap(); }
  if (!it) { game.hold = null; $('prompt').classList.add('hidden'); return; }
  $('prompt').classList.remove('hidden'); $('prompt').querySelector('span').textContent = `${it.label} · F 꾹`;
  if (keys.has('KeyF')) { if (!game.hold || game.hold.label !== it.label) game.hold = { label: it.label, t: 0 }; game.hold.t += dt; if (it.spin) it.spin.rotation.z += dt * 5; if (it.label.includes('도르래')) { W.winch.drum.rotation.x += dt * 3; W.gate.open = Math.min(0.15, game.hold.t / it.time * 0.15); } if (game.t % 0.4 < dt) sfx('tick'); $('prompt').querySelector('u').style.width = `${(game.hold.t / it.time) * 100}%`; if (game.hold.t >= it.time) { game.hold = null; it.fn(); } }
  else { game.hold = null; $('prompt').querySelector('u').style.width = '0%'; }
}
// 성문 여는 연출 (열리는 중)
setInterval(() => { if (W.winch.done && W.gate.open < 1) W.gate.open = Math.min(1, W.gate.open + 0.03); }, 30);

// ---------- 머리 위 표시 ----------
function markers() {
  const me = game.me, out = [];
  const put = (x, y, z, html, cls) => { const p = screenPos(x, y, z); if (p && p[0] > -50 && p[0] < innerWidth + 50) out.push(`<div class="mk ${cls}" style="left:${p[0]}px;top:${p[1]}px">${html}</div>`); };
  for (const v of game.viruses) { if (v.state !== 'ok' || Math.hypot(v.x - me.x, v.z - me.z) > 30) continue; const top = v.y + v.K.size * 2.4 + (v.kind === 'king' ? 2 : 0.2);
    if (v.guard && !v.alert) { if (v.sleep) put(v.x, top, v.z, 'z<small>z</small>Z', 'zz'); else if (v.sus > 0.1) put(v.x, top, v.z, v.sus > 0.6 ? '❗' : '❓', 'sus'); continue; }
    if (v.kind === 'king') continue; if (v.K.stealth && v.reveal < 0.4) continue;
    if (v.hp < v.max || v.kind === 'giant') put(v.x, top, v.z, `${v.kind === 'giant' ? v.K.name : ''}<div class="hb"><i style="width:${(v.hp / v.max) * 100}%"></i></div>`, ''); }
  for (const a of game.allies) if (a.state === 'ok' && Math.hypot(a.x - me.x, a.z - me.z) < 22 && a.hp < a.max) put(a.x, a.y + 2.4, a.z, `<div class="hb"><i style="width:${(a.hp / a.max) * 100}%"></i></div>`, 'ally');
  for (const p of game.puddles) if (!p.b.me) put(p.b.x, p.b.y + 1, p.b.z, p.b.infect > 0 ? `🧬 감염 중! ${p.b.name}` : `🫧 ${p.b.name}`, p.b.infect > 0 ? 'warn' : 'ally');
  // 목표 표시
  const goal = game.phase === 'stealth' && !W.winch.done ? [W.winch.x, 3, W.winch.z] : game.phase === 'assault' && !game.waves && !W.gods[0].freed ? [W.gods[0].x, 7, W.gods[0].z] : game.phase === 'colonnade' ? (() => { const fw = W.fireWalls.find((f) => !f.open); return fw ? [fw.valve.x, PLAT.h + 2.6, fw.valve.z] : [-15.7, PLAT.h + 3, -46]; })() : game.phase === 'altars' ? (() => { const g = W.gods.find((q) => game.altarQ.includes(q.id) && !q.freed); return g ? [g.x, g.y + 7, g.z] : [0, PLAT.h + 3, -11]; })() : null;
  if (goal) put(goal[0], goal[1], goal[2], '▼', 'goal');
  $('marks').innerHTML = out.join('');
}

// ---------- 카메라 ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function camTick(dt) {
  const me = game.me, aim = me.weapon === 'bow' && (mouseR || !!me.charge);
  const dist = aim ? 3.0 : 5.6, side = aim ? 0.9 : 0.75, h = 1.9;
  camera.fov += ((aim ? 46 : 62) - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
  const cy = Math.cos(look.pitch), fx = Math.sin(look.yaw) * cy, fz = Math.cos(look.yaw) * cy, fyv = Math.sin(look.pitch);
  const rx = Math.cos(look.yaw), rz = -Math.sin(look.yaw);
  const target = new THREE.Vector3(me.x + rx * side, me.y + h, me.z + rz * side);
  let d = dist; // 벽 뒤로 들어가지 않게
  for (let s = 0.5; s <= dist; s += 0.5) { const px = target.x + fx * s, pz = target.z + fz * s; if (W.boxes.some((b) => px > b.x0 - 0.3 && px < b.x1 + 0.3 && pz > b.z0 - 0.3 && pz < b.z1 + 0.3 && target.y + fyv * s < b.h)) { d = Math.max(1.2, s - 0.5); break; } }
  camPos.set(target.x + fx * d, Math.max(groundAt(target.x + fx * d, target.z + fz * d) + 0.4, target.y + fyv * d), target.z + fz * d);
  camera.position.lerp(camPos, Math.min(1, dt * 18));
  if (shakeK > 0) { camera.position.x += R(-1, 1) * shakeK * 0.3; camera.position.y += R(-1, 1) * shakeK * 0.3; shakeK = Math.max(0, shakeK - dt); }
  camLook.set(target.x - fx * 8, target.y - fyv * 8 + 0.2, target.z - fz * 8); camera.lookAt(camLook);
}

// ---------- 프레임 신앙: 갇힌 GPU 신이 많을수록 세상이 버벅인다 ----------
let lastPR = basePR, wireT = 0;
function stutterFx(dt) {
  const caged = W.gods.filter((g) => !g.freed).length, target = game.mode === 'title' ? 0.3 : caged / W.gods.length * 0.62 + (game.cut?.extraStutter || 0);
  game.stutter += (target - game.stutter) * Math.min(1, dt * 0.8);
  const s = game.stutter;
  $('stut-n').textContent = `${Math.round((1 - s * 0.95) * 100)}%`; $('stut-bar').style.width = `${(1 - s * 0.95) * 100}%`;
  const pr = Math.max(0.55, basePR * (1 - s * 0.45)); if (Math.abs(pr - lastPR) > 0.08) { lastPR = pr; renderer.setPixelRatio(pr); composer?.setPixelRatio(pr); }
  if (Math.random() < s * 0.035) holdFrames = 1 + Math.floor(Math.random() * 3 * s);
  if (wireT > 0) { wireT -= dt; if (wireT <= 0) { for (const m of W.stutterMats) m.wireframe = false; $('c').classList.remove('glitch'); } }
  else if (Math.random() < s * 0.012) { wireT = R(0.08, 0.25); for (const m of W.stutterMats) m.wireframe = Math.random() < 0.6; $('c').classList.toggle('glitch', Math.random() < 0.5); }
  scene.fog.density = 0.011 + s * 0.006;
}

// ---------- 컷신 ----------
function cutBegin(shots, onEnd, o = {}) { game.cut = { shots, t: 0, i: -1, onEnd, ...o }; $('cut').classList.remove('hidden'); $('lockmsg').classList.add('hidden'); $('cut-title').classList.add('hidden'); }
function runCut(dt) {
  const C = game.cut; C.t += dt;
  let acc = 0, idx = -1; for (let i = 0; i < C.shots.length; i++) { if (C.t < acc + C.shots[i].d) { idx = i; break; } acc += C.shots[i].d; }
  if (idx < 0) { endCut(); return; }
  const S = C.shots[idx], k = (C.t - acc) / S.d, e = k * k * (3 - 2 * k);
  if (idx !== C.i) { C.i = idx; $('cut-cap').innerHTML = S.cap || ''; S.on?.(); if (S.title) { $('cut-title').innerHTML = S.title; $('cut-title').classList.remove('hidden'); } else $('cut-title').classList.add('hidden'); }
  S.each?.(k, dt);
  camera.position.set(...S.from[0].map((v, i) => v + (S.to[0][i] - v) * e)); camera.lookAt(...S.from[1].map((v, i) => v + (S.to[1][i] - v) * e));
  if (game.mode === 'play') { virusIdle(dt); for (const a of game.allies) a.speed = a.cutSpeed || 0; }
}
function virusIdle(dt) { for (const v of game.viruses) { if (v.party) { v.yaw += dt * 1.5; v.y = groundAt(v.x, v.z) + Math.abs(Math.sin(game.t * 5 + v.seed)) * 0.6; } } }
function endCut() { const C = game.cut; game.cut = null; $('cut').classList.add('hidden'); $('fade').style.opacity = 0; C?.onEnd?.(); }
function skipCut() { if (!game.cut) return; const C = game.cut; for (let i = C.i + 1; i < C.shots.length; i++) C.shots[i].on?.(); C.shots[C.shots.length - 1].each?.(1, 0); endCut(); }
// 여는 컷신
function intro() {
  game.phase = 'intro'; const H = W.horse.g;
  const party = []; const putParty = () => { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, v = spawnVirus(i % 3 ? 'worm' : 'soldier', Math.cos(a) * 7, 38 + Math.sin(a) * 7); v.party = true; party.push(v); } };
  W.skyU.night.value = 0.25; H.position.set(0, -1.2, 128); W.gate.open = 0;
  cutBegin([
    { d: 6, from: [[0, 40, 190], [0, 6, 0]], to: [[20, 30, 120], [0, 8, -20]], cap: '바이러스 군단이 GPU 신전을 차지한 지 열흘째.<br>신들의 연산이 끊기며, 세상이 <b>버벅이기 시작했다</b>.', on: () => {}, each: () => {} },
    { d: 6, from: [[6, PLAT.h + 4, -8], [0, PLAT.h + 4, -16]], to: [[-3, PLAT.h + 3, -10], [0, PLAT.h + 4, -16]], cap: '렌더의 여신 아테나리스도 초록 코드 사슬에 묶였다.<br>제단마다 <b>랜섬 자물쇠</b>.' },
    { d: 7, from: [[40, 6, 150], [0, 0, 220]], to: [[25, 10, 130], [0, 0, 260]], cap: '곰돌 군단은 배를 띄워 <b>물러나는 척</b>했다.', each: (k, dt) => { for (const s of W.ships) s.position.z += dt * 6; } },
    { d: 6, from: [[16, 4, 110], [0, 6, 128]], to: [[10, 9, 116], [0, 7, 128]], cap: '해변에 남은 건 형광 초록으로 번쩍이는 목마 하나.<br>꼬리표엔 이렇게 쓰여 있었다 — <b>「🎁 공짜 연산력! FREE_COMPUTE_PATCH.exe」</b>' },
    { d: 8, from: [[24, 14, 90], [0, 4, 70]], to: [[18, 16, 52], [0, 4, 38]], cap: '바이러스들은 선물을 신전 안으로 끌고 들어가 밤새 잔치를 벌였다.<br><small>— 컴퓨터의 트로이 목마는 원래 악성코드의 수법. 이번엔 <b>백신이 그 수법을 거꾸로 쓴다.</b></small>', on: () => { putParty(); }, each: (k) => { H.position.z = 128 - 90 * Math.min(1, k * 1.2); H.position.y = H.position.z > 72 ? -1.2 + (128 - H.position.z) / 56 * 1.2 : 0; W.gate.open = H.position.z > 66 ? 1 : Math.max(0, 1 - (66 - H.position.z) / 10); W.skyU.night.value = 0.25 + k * 0.75; } },
    { d: 6, from: [[5, 3, 30], [0, 5, 38]], to: [[3, 1.6, 33], [0, 4.6, 38]], cap: '깊은 밤. 잔치에 지친 경비들이 하나둘 잠든다.<br>그리고 — <b>목마의 배가 열린다.</b>', on: () => { for (const v of party) removeVirus(v); party.length = 0; }, each: (k) => { W.horse.hatch.rotation.x = -k * 1.6; } },
    { d: 4.5, from: [[0, 10, 22], [0, 4, 40]], to: [[0, 8, 20], [0, 4, 40]], title: '<b>젤리 오디세이</b><small>1장 · 불타는 신전</small>', cap: '' },
  ], () => { H.position.set(0, 0, 38); W.horse.hatch.rotation.x = -1.6; W.gate.open = 0; W.skyU.night.value = 1; for (const s of W.ships) s.position.z = Math.max(s.position.z, 300); enterPhase('stealth'); lock(); }, { extraStutter: 0.1 });
}
function endingCut(mins) {
  const me = game.me; game.mode = 'ending';
  W.land.visible = true; for (const f of W.fires.list) W.fires.setStrength(f, 0.15);
  // 남은 바이러스 조각이 바다 너머로 달아난다
  const flee = []; for (let i = 0; i < 26; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: '#4bff7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(R(1, 2.4)); m.position.set(R(-20, 20), R(6, 20), R(-30, 40)); scene.add(m); flee.push(m); }
  for (const v of [...game.viruses]) removeVirus(v);
  cutBegin([
    { d: 6, from: [[0, PLAT.h + 3, -30], [0, PLAT.h + 6, -51]], to: [[0, PLAT.h + 5, -38], [0, PLAT.h + 9, -51]], cap: '사슬이 끊어지고, GPU 신들이 다시 빛났다.<br>세상의 연산이 돌아온다 — <b>매끄럽게.</b>', each: (k) => { W.skyU.dawn.value = k * 0.3; } },
    { d: 7, from: [[0, 30, 70], [0, 6, 0]], to: [[0, 60, 120], [0, 0, 300]], cap: '그러나 흩어진 바이러스 조각들은 데이터의 바다 너머로 달아났다.', each: (k, dt) => { W.skyU.dawn.value = 0.3 + k * 0.5; for (const m of flee) { m.position.z += dt * 40; m.position.y += dt * 2; } } },
    { d: 9, from: [[0, 50, 200], [120, 20, 1100]], to: [[30, 40, 300], [120, 40, 1100]], cap: `멀리, 아침 안개 너머 곰 모양 산이 보인다.<br>고향 이타카 — <b>훗날 젤리시티가 세워질 땅.</b> 귀향길이 시작된다.`, each: (k) => { W.skyU.dawn.value = 0.8 + k * 0.2; } },
  ], () => { for (const m of flee) scene.remove(m); results(mins); });
}
function results(mins) {
  game.mode = 'over'; document.exitPointerLock?.(); $('hud').classList.add('hidden');
  $('ov-title').textContent = '🏛️ 1장 「불타는 신전」 완료';
  $('ov-body').innerHTML = `난이도 ${D().label} · ${mins}분<br>쓰러뜨린 바이러스 <b>${game.kills}</b> · 감염된 동료 <b>${game.lost}</b><br>해방한 GPU 신 <b>5</b> / 5<br><br><small>2장 「약탈당한 데이터 항구」는 곧 열려요.</small>`;
  $('over').classList.remove('hidden'); sfx('win');
}

// ---------- 시험용 바로 가기 (?t=막&cx..) ----------
if (params.has('t')) {
  document.head.insertAdjacentHTML('beforeend', '<style>body > div:has(> div > h2), .pn-wrap { display: none !important; }</style>');
  setTimeout(() => {
    game.diff = params.get('d') || 'normal'; const ph = params.get('t'); startGame(ph === 'intro' ? 'intro' : ph);
    if (ph === 'intro') { game.cut = null; intro(); game.cut.t = +(params.get('ct') || 0); }
    if (params.has('cx')) { game.testCam = [+params.get('cx'), +params.get('cy'), +params.get('cz'), +params.get('tx'), +params.get('ty'), +params.get('tz')]; }
    if (params.has('n')) for (let i = 0; i < +params.get('n'); i++) tick(1 / 30);
    if (params.has('night')) W.skyU.night.value = +params.get('night'); else if (ph !== 'intro') W.skyU.night.value = 1;
    if (params.has('free')) for (const id of params.get('free').split(',')) freeGod(id, true);
    if (params.has('spawn')) for (const sp of params.get('spawn').split(';')) { const [k, x, z, yaw] = sp.split(','); const v = spawnVirus(k, +x, +z, { yaw: +(yaw || 0) }); v.cd = 99; v.stunT = +(params.get('freeze') || 0); }
    if (params.has('look')) { const [y, p] = params.get('look').split(',').map(Number); look.yaw = y; look.pitch = p; }
  }, 50);
}
requestAnimationFrame((n) => { last = n; frame(n); });
