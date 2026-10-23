import * as THREE from 'three';
import { sensOf } from '../../shared/js/sens.js';
import { SEED, HALF } from './config.js';
import { buildCity, renderMapImage } from './city.js';
import { setupWorld, housePrice, homeLabel, freeUnits } from './world-setup.js';
import { Traffic, makeCarMesh } from './traffic.js';
import { Player } from './player.js';
import { buildInterior } from './interior.js';
import { Lobby } from './lobby.js';
import { CitizenView, PlayersView, UnitsView, GroundView, Runners, RouteView, seatRoach, unseatRoach } from './views.js';
import { Inventory } from './inventory.js';
import { Combat } from './combat.js';
import { itemDef, CLUB_CHARM, ENCHANT_FEE, RARITY, SHOPS, TEMP_MINUTES } from './items.js';
import { routeTo, routeLength } from './citizens.js';
import { Net } from './net.js';
import { UI } from './ui.js';
import { settings, saveSettings } from '../../shared/js/settings.js';
import { getJob } from './data.js';
import { DAYS, clamp, lerp, angleLerp, windowMaterials, retitleSign, initBrand, cityText, brand } from '../../shared/js/utils.js';
import { expNeed, levelStats, addExp } from './level.js';
import { dailyQuests, questDef } from './quests.js';
import { SPORT_KINDS, vehicleName, CAR_KINDS, BIKES } from './traffic.js';
import { DROP_POOL, FISH } from './items.js';
import { buildWilds, renderWorldImage } from './wilds.js';
import { AnimalsView, makeMount, mouthPos } from './animals.js';
import { Roach } from '../../shared/js/roach.js';
import { buildPark } from './park.js';
import { TitansView, Odm } from './odm.js';
import { unlockAudio, setListener, sfx, loop, duckMusic } from '../../shared/js/audio.js';
// 브라우저는 처음 누르거나 키를 칠 때부터 소리를 낼 수 있다
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlockAudio, true);
initBrand(); // 화면의 '바퀴시티' → '젤리시티' (바퀴 모드면 그대로)
import { ANIMALS, ANIMAL_KINDS } from './fauna.js';
import { TVScreen, CHANNELS } from './tv.js';
import { WORLD_HALF, WATER_Y, regionAt } from './terrain.js';

// ------------------------------------------------------------------
// 렌더러 & 장면
// ------------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
setListener(camera);
camera.position.set(0, 30, 60);
scene.fog = new THREE.Fog('#cfefff', 90, 320);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ------------------------------------------------------------------
// 하늘 & 조명 (낮/밤)
// ------------------------------------------------------------------
const hemi = new THREE.HemisphereLight('#fff6e8', '#9fc88a', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3d6', 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const SC = 70;
Object.assign(sun.shadow.camera, { left: -SC, right: SC, top: SC, bottom: -SC, near: 1, far: 400 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const skyUniforms = { top: { value: new THREE.Color('#7ec8ff') }, bottom: { value: new THREE.Color('#d4f1ff') } };
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 24, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  }),
);
sky.renderOrder = -1;
scene.add(sky);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(28, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff4b0', fog: false }));
const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), new THREE.MeshBasicMaterial({ color: '#f5f3ff', fog: false }));
scene.add(sunDisc, moonDisc);
// 별
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 600; i++) {
  const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.1; v.normalize().multiplyScalar(850);
  starPos.push(v.x, v.y, v.z);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
scene.add(stars);
// 구름
const clouds = new THREE.Group();
for (let i = 0; i < 16; i++) {
  const c = new THREE.Group();
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m);
    s.scale.setScalar(8 + Math.random() * 6);
    s.position.set(k * 9 - 13, Math.random() * 4, Math.random() * 6);
    c.add(s);
  }
  c.position.set((Math.random() - 0.5) * 700, 110 + Math.random() * 40, (Math.random() - 0.5) * 700);
  c.userData.speed = 2 + Math.random() * 3;
  clouds.add(c);
}
scene.add(clouds);

const SKY_KEYS = [
  [0, '#0b1d3a', '#1d2b55', 0.0, 0.55, '#8fa8ff'],
  [4.5, '#14234a', '#2c3566', 0.0, 0.55, '#8fa8ff'],
  [6, '#6f7fc8', '#ffb38a', 0.6, 0.65, '#ffc89a'],
  [7.5, '#86cdfa', '#ffe0c0', 1.6, 1.0, '#fff1d6'],
  [10, '#7ec8ff', '#d4f1ff', 2.1, 1.15, '#fff6e6'],
  [16, '#7ec8ff', '#d9f3ff', 2.0, 1.1, '#fff1d6'],
  [18, '#ff9e7a', '#ffd08a', 1.2, 0.85, '#ffb27a'],
  [19.5, '#3a3a7a', '#ff8a80', 0.3, 0.5, '#c3a6ff'],
  [21, '#0e1f40', '#253064', 0.0, 0.58, '#8fa8ff'],
  [24, '#0b1d3a', '#1d2b55', 0.0, 0.55, '#8fa8ff'],
];
const cA = new THREE.Color(), cB = new THREE.Color();
const INDOOR_BG = new THREE.Color('#2a2233');
function sampleSky(h) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const t = (h - a[0]) / (b[0] - a[0]);
  return {
    top: cA.set(a[1]).lerp(cB.set(b[1]), t).clone(),
    bottom: cA.set(a[2]).lerp(cB.set(b[2]), t).clone(),
    sun: lerp(a[3], b[3], t), hemi: lerp(a[4], b[4], t),
    sunColor: cA.set(a[5]).lerp(cB.set(b[5]), t).clone(),
  };
}

function updateEnvironment(h, focus, dt) {
  const s = sampleSky(h);
  skyUniforms.top.value.copy(s.top);
  skyUniforms.bottom.value.copy(s.bottom);
  const indoor = game.mode === 'interior';
  scene.fog.color.copy(indoor ? new THREE.Color('#2a2233') : s.bottom);
  scene.fog.near = indoor ? 60 : 90; scene.fog.far = indoor ? 200 : 320;
  sky.visible = !indoor;
  scene.background = indoor ? INDOOR_BG : null;
  // 태양 위치 (6시 동쪽 → 18시 서쪽)
  const ang = ((h - 6) / 12) * Math.PI;
  const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
  const moonDir = sunDir.clone().negate().setZ(0.35).normalize();
  const day = sunDir.y > -0.05;
  const lightDir = day ? sunDir : moonDir;
  sun.position.copy(focus).addScaledVector(lightDir, 150);
  sun.target.position.copy(focus);
  sun.intensity = day ? s.sun : 0.6;
  sun.color.copy(day ? s.sunColor : new THREE.Color('#9fb4ff'));
  hemi.intensity = indoor ? 0.55 : s.hemi;
  if (indoor) sun.intensity = Math.min(sun.intensity, 0.9);
  // 실내에서는 바깥 해 그림자를 끈다 (해가 움직일 때 어두운 바닥이 파바박 깜빡이던 문제)
  const wantShadow = settings.shadows && !indoor;
  if (sun.castShadow !== wantShadow) sun.castShadow = wantShadow;
  hemi.color.copy(s.sunColor).lerp(new THREE.Color('#ffffff'), 0.5);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  sunDisc.position.copy(camera.position).addScaledVector(sunDir, 800);
  moonDisc.position.copy(camera.position).addScaledVector(moonDir, 800);
  sunDisc.visible = !indoor && sunDir.y > -0.1;
  moonDisc.visible = !indoor && moonDir.y > -0.1;
  const night = clamp(h < 12 ? (6.5 - h) / 1.5 : (h - 18.5) / 1.5, 0, 1);
  stars.material.opacity = indoor ? 0 : night;
  clouds.visible = !indoor;
  for (const c of clouds.children) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 400) c.position.x = -400;
  }
  clouds.children[0].children[0].material.color.set(night > 0.5 ? '#6f7aa8' : '#ffffff');
  return night;
}

// ------------------------------------------------------------------
// 게임 상태
// ------------------------------------------------------------------
const game = {
  started: false, busy: false, mode: 'city',
  minutes: 7 * 60 + 30, timeSpeed: 1.5,
  scene, camera, renderer,
  city: null, sim: null, traffic: null, player: null, interior: null, mapImage: null,
  net: new Net(), players: null, myId: null, token: null, llm: false,
  profile: null, stats: null, inv: null, combat: null, units: null, ground: null, runners: null,
  waypoint: null, route: null, autoWalk: false,
  weather: '맑음 ☀️',
  sleeping: false, sleepers: { n: 0, total: 1 },
  hp: 100, maxHp: 100, dead: false, stars: 0, course: null, shakeT: 0,
  input: { forward: false, back: false, left: false, right: false, run: false, jump: false, jumpPressed: false, dashPressed: false, enabled: true },
};
window.game = game; // 디버깅용

const ui = new UI(game);
game.ui = ui;

game.hour = () => (game.minutes % 1440) / 60;
game.day = () => Math.floor(game.minutes / 1440);
game.loc = () => (game.mode === 'interior' ? game.interior.building.id : -1);
game.regionName = (pos) => { const r = regionAt(pos.x, pos.z); return r ? `${r.emoji} ${r.name}` : null; };
game.placeText = () => {
  if (game.mode === 'interior') return `${game.interior.building.name} 안`;
  const rn = game.regionName(game.player.pos);
  if (rn) return rn;
  if (Math.abs(game.player.pos.x) > HALF || Math.abs(game.player.pos.z) > HALF) return '젤리시티 외곽';
  let best = null, bd = 30;
  for (const b of game.city.buildings) {
    const d = Math.hypot(b.door.x - game.player.pos.x, b.door.z - game.player.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best ? `${best.name} 근처 거리` : '젤리시티의 거리';
};
game.playerJob = () => (game.stats.jobId ? getJob(game.stats.jobId) : null);
game.workBuilding = () => (game.stats.workId != null ? game.city.buildings[game.stats.workId] : null);
game.homeBuilding = () => (game.stats.homeId != null ? game.city.buildings[game.stats.homeId] : game.city.buildings[game.hotelId]);
game.charm = () => game.inv.totals().charm;
game.shake = (k) => { game.shakeT = Math.max(game.shakeT, k * 0.5); };

// ------------------------------------------------------------------
// 시작 & 접속
// ------------------------------------------------------------------
const PROFILE_KEY = 'roachcity.profile';
const lobby = new Lobby();
async function boot() {
  let status = null;
  try { status = await (await fetch('/api/status', { cache: 'no-store' })).json(); } catch { status = null; }
  ui.updateServerStatus(status);
  // 로그인 화면 뒤로 지금 서버의 실제 도시를 보여준다 (관전 연결)
  try {
    const w = await game.net.connect({ t: 'spectate' });
    buildWorld(w);
    game.spectating = true;
    startTour();
  } catch (e) { console.warn('관전 연결 실패', e.message); }
  // 서버 업데이트 후 자동 재접속
  let resume = false;
  try { resume = sessionStorage.getItem('roachcity.resume') === '1'; sessionStorage.removeItem('roachcity.resume'); } catch { /* 무시 */ }
  const { session, char } = await lobby.run(status, { resume });
  startGame(session, char);
}
boot();

async function startGame(session, char) {
  document.getElementById('start').classList.add('hidden');
  ui.disposePreview();
  ui.showLoading(`젤리시티에 입장하는 중... ${brand.bug ? '🪳' : '🐻'}`);
  let welcome;
  try {
    welcome = await game.net.request({ t: 'hello', session, char });
  } catch (e) {
    ui.hideLoading();
    document.getElementById('start').classList.remove('hidden');
    if (e.message === 'login') { lobby.session = null; try { localStorage.removeItem('roachcity.session'); } catch { /* 무시 */ } lobby.renderLogin(); lobby.error('🔑 로그인이 만료됐어요. 다시 로그인해 주세요'); }
    else lobby.error(`서버에 접속하지 못했어요 (${e.message})`);
    const again = await new Promise((res) => { lobby.resolve = (c) => res(c); });
    startGame(lobby.session, again);
    return;
  }
  await new Promise((r) => setTimeout(r, 30));
  game.session = session; game.char = char;
  try {
    if (!game.city) buildWorld(welcome);
    enterGame(welcome);
  } catch (e) { console.error(e); ui.showLoading('오류가 발생했어요: ' + e.message); return; }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(game.profile));
  ui.hideLoading();
  ui.showHUD();
  game.spectating = false;
  game.started = true;
  const others = game.players.list.size;
  ui.toast(`젤리시티에 오신 걸 환영해요, ${game.profile.name}! 🎉`);
  if (others) ui.toast(`👥 지금 ${others}명의 플레이어가 함께 있어요`);
  if (game.gotOdm) setTimeout(() => ui.lootBanner('🪝 젤리병단 장비를 받았어요!', '핫바에서 골라 쓰세요 · 우클릭 갈고리(꾹 = 당기기) · 좌클릭 칼 · Space 가스 · 거대 젤리는 뒷목!', '#2f5d3e', ''), 1500);
  if (welcome.homeId == null) setTimeout(() => ui.toast('🏨 아직 집이 없어서 호텔에서 지내요. 부동산 🏘️ 에서 집을 살 수 있어요!'), 2000);
  if (!welcome.stats) setTimeout(() => ui.toast('시청 🏛️ 에서 일자리를 구해보세요. 숫자키로 핫바, I키로 가방!'), 4500);
}

// ------------------------------------------------------------------
// 로그인 화면 배경: 도시 명소를 천천히 비추는 카메라
// ------------------------------------------------------------------
const tour = { shots: [], i: 0, t: 0 };
function startTour() {
  const B = game.city.byType;
  const pick = (type, label, r = 34, h = 16) => { const b = B[type]?.[0]; if (b) tour.shots.push({ b, label, r, h }); };
  pick('cityhall', '🏛️ 시청 광장', 42, 20);
  pick('park', '🌳 도토리 공원', 38, 18);
  pick('hospital', '🏥 종합병원 앞', 36, 16);
  pick('pizza', '🍕 맛집 거리', 26, 11);
  pick('club', '🪩 클럽 젤리락', 30, 13);
  const sub = game.city.buildings.find((b) => b.suburb && b.type === 'house');
  if (sub) tour.shots.push({ b: sub, label: '🏡 교외 전원주택단지', r: 40, h: 22 });
  pick('apartment', '🏢 아파트 단지', 50, 26);
  pick('dojang', '🥋 무릉도장', 40, 18);
  pick('hotel', '🏨 그랜드 젤리 호텔', 40, 22);
  tour.i = Math.floor(Math.random() * tour.shots.length);
  tour.t = 0;
  document.getElementById('start').classList.add('live');
}
function tourFrame(dt, t) {
  const shot = tour.shots[tour.i];
  if (!shot) return;
  tour.t += dt;
  const DUR = 9;
  if (tour.t > DUR) { tour.t = 0; tour.i = (tour.i + 1) % tour.shots.length; ui.tourFade(); return; }
  const b = shot.b, k = tour.t / DUR;
  const center = new THREE.Vector3(b.x, 2, b.z + b.dir * (b.d / 2 + 6));
  const a = (b.dir === 1 ? 0 : Math.PI) + 0.9 - k * 0.9;
  camera.position.set(center.x + Math.sin(a) * shot.r, shot.h - k * 3, center.z + Math.cos(a) * shot.r);
  camera.lookAt(center);
  // 지금 이 근처에 있는 시민 수
  if (Math.floor(t * 2) !== tour.lastSec) {
    tour.lastSec = Math.floor(t * 2);
    let n = 0;
    for (const c of game.sim.citizens) if (c.visible && c.roach.root.position.distanceTo(center) < 45) n++;
    ui.tourCaption(shot.label, n, game.players.list.size, game.hour());
  }
}

// 도시·시민·차량 (관전과 플레이 공통)
function buildWorld(w) {
  game.hotelId = w.hotelId;
  game.llm = w.llm;
  const { buildings, sim } = setupWorld(SEED);
  for (const [id, name] of Object.entries(w.homes)) buildings[id].name = name;
  const city = buildCity(scene, buildings, SEED);
  // 도시 밖 넓은 세상: 지형·숲·바다·대교
  const wild = buildWilds(scene, city);
  game.wild = wild;
  const cityGround = city.groundY;
  city.groundY = (x, z, y) => (Math.abs(x) <= HALF && Math.abs(z) <= HALF ? cityGround(x, z) : wild.groundY(x, z, y));
  game.worldImage = renderWorldImage(wild.grid);
  game.park = buildPark(scene);
  game.animals = new AnimalsView(scene, w.animals || [], city.groundY);
  // 야생 드래곤이 불을 뿜으면: 뿜는 동안(1.6초) 입을 따라 불길이 계속 나오고, 가까우면 화면이 흔들린다
  game.animals.onSound = (a, type) => sfx('beast', a.pos, { kind: a.kind, type });
  game.animals.onBreath = (from0, a) => {
    const big = a.kind === 'dragon';
    sfx('breath', from0); sfx('beast', from0, { kind: a.kind, type: 'attack' });
    const dirFn = () => {
      const from = mouthPos(a.mesh), me = game.player?.pos;
      if (!from) return null;
      return me && me.distanceTo(from) < 30 ? me.clone().setY(me.y + 1).sub(from) : new THREE.Vector3(Math.sin(a.h), -0.4, Math.cos(a.h));
    };
    game.combat.fx.emitter({ from: () => (a.breathing && a.visible ? mouthPos(a.mesh) : null), dir: dirFn, len: big ? 17 : 12, power: big ? 1.3 : 0.8, until: performance.now() + 1800 });
    if (game.player && game.player.pos.distanceTo(from0) < 22) game.shake?.(big ? 0.45 : 0.25);
  };

  for (const key of w.smashed || []) smashProp(key, [1, 0], true);
  sim.city = city;
  game.city = city; game.sim = sim;
  buildShopMarkers();
  game.mapImage = renderMapImage(buildings, 1024);
  game.homes = w.homes;
  game.citizens = new CitizenView(scene, sim, city);
  for (const m of w.npcMeta) game.citizens.applyMeta(m);
  game.traffic = new Traffic(scene, city, SEED);
  w.extraCars.forEach((c) => { if (c.id === game.traffic.cars.length) game.traffic.spawnParked(new THREE.Vector3(c.x, 0, c.z), c.h, c.kind || 'sedan', c.color); });
  game.players = new PlayersView(scene, w.you);
  for (const m of w.players) game.players.add(m);
  game.units = new UnitsView(scene);
  game.titans = new TitansView(scene, city.groundY);
  game.odm = new Odm(game, scene);
  game.ground = new GroundView(scene);
  for (const g of w.ground || []) game.ground.add(g);
  game.runners = new Runners(scene, city.groundY);
  game.routeView = new RouteView(scene, city.groundY);
  game.minutes = w.minutes; game.timeSpeed = w.timeSpeed; game.weather = w.weather;
  game.combat = new Combat(game);
  // 곰돌이 젤리 모드: 맞으면 그 색 젤리가 튄다
  game.combat.fx.groundFn = (x, z, y) => (game.mode === 'interior' ? 0.1 : game.city.groundY(x, z, y));
  Roach.onHurt = (r) => {
    if (!r.gummy || !r.root.visible || !r.root.parent) return;
    // 불길·화상처럼 연달아 맞을 때 젤리가 너무 많이 튀지 않게
    const now = performance.now();
    if (!r.dead && now - (r._jellyT || 0) < 350) return;
    r._jellyT = now;
    const p = r.root.getWorldPosition(new THREE.Vector3()); p.y += r.height * 0.55;
    if (p.distanceTo(camera.position) < 90) game.combat.fx.jelly(p, r.jellyColor, r.dead ? 16 : 6, r.dead);
  };
  setupNet();
}

// 내 캐릭터로 입장
function enterGame(w) {
  game.myId = w.you;
  game.token = w.token;
  game.llm = w.llm;
  game.profile = { ...w.profile };
  game.admin = !!w.admin;
  game.phone = w.phone; game.contacts = w.contacts || []; game.sms = w.sms || [];
  game.profile.phone = w.phone;
  game.players.myId = w.you;
  game.players.remove(w.you);
  for (const m of w.players) if (m.id !== w.you && !game.players.list.has(m.id)) game.players.add(m);
  for (const c of game.sim.citizens) {
    c.affinity = w.affinity[c.id] ?? c.baseAffinity;
    c.memories = w.memories[c.id] || [];
  }
  game.minutes = w.minutes;
  game.player = new Player(scene, game.profile);
  game.player.onSfx = (name, arg) => sfx(name, null, arg);
  game.stats = Object.assign({
    money: 500, needs: { hunger: 80, energy: 85, fun: 70, social: 55, hygiene: 85 },
    jobId: null, workId: null, lastInterestDay: -1, workedDay: -1, workedToday: 0,
  }, w.stats || {});
  game.stats.homeId = w.homeId;
  game.stats.homeUnit = w.homeUnit;
  game.myHomes = w.myHomes || [];
  game.owned = w.owned || {};
  game.safeBids = w.safe || [w.hotelId];
  refreshSafeZones();
  // 직장 건물 번호가 바뀌었으면 같은 종류의 건물로 옮긴다
  const job = game.stats.jobId ? getJob(game.stats.jobId) : null;
  if (job && game.city.buildings[game.stats.workId]?.type !== job.building) game.stats.workId = game.city.byType[job.building]?.[0]?.id ?? null;
  game.inv = new Inventory(game);
  // 새 캐릭터: 고른 기본 악세서리를 가방에 넣고 착용
  if (w.starter) for (const id of Object.values(w.starter)) { const it = game.inv.add(id); if (it) game.inv.equip(it.uid); }
  // 거대 젤리와 싸울 수 있게: 접속하면 젤리병단 장비를 준다 (없을 때만, 빈 핫바 칸에 들어간다)
  game.gotOdm = !game.inv.count('odm_gear') && !!game.inv.add('odm_gear', 1);
  syncKeys();
  game.stats.level ||= 1; game.stats.exp ||= 0;
  game.maxMana = levelStats(game.stats.level).mana; game.mana = game.maxMana;
  ensureQuests();
  applySkills();
  game.inv.changed();
  game.sendProfile();
  placeAtHome();
  game.lastDay = game.day();
  ui.buildNeeds();
  ui.renderHotbar();
  document.getElementById('start').classList.remove('live');
}

// 내가 가진 집마다 열쇠 아이템 하나씩
function syncKeys() {
  const S = game.stats, inv = game.inv;
  const has = (h) => S.items.find((it) => it.id === 'house_key' && it.key?.bid === h.bid && it.key?.unit === h.unit);
  for (const it of S.items.filter((x) => x.id === 'house_key' && !game.myHomes.some((h) => h.bid === x.key?.bid && h.unit === x.key?.unit))) inv.remove(it.uid);
  for (const h of game.myHomes) if (!has(h)) S.items.push({ uid: Math.random().toString(36).slice(2, 10), id: 'house_key', n: 1, gems: [], key: { bid: h.bid, unit: h.unit } });
  inv.changed();
}
game.homeLabelOf = (k) => homeLabel(game.city.buildings[k.bid], k.unit);
game.ownsHome = (b, unit) => game.myHomes.some((h) => h.bid === b.id && (unit == null || h.unit === unit));

// 2단 점프와 대쉬는 기본. 3단 점프·대쉬 거리·점프력은 무릉도장 수련으로
function applySkills() {
  const sk = game.stats.skills;
  game.player.maxJumps = sk.includes('jump3') ? 3 : 2;
  game.player.canDash = true;
  game.player.dashPower = sk.includes('dashlong') || sk.includes('dash') ? 38 : 24;
  game.player.jumpV = sk.includes('jumpboost') ? 9.2 : 7.5;
}

// 리스폰 존 (호텔·대표 집 문 앞 10m): 바닥에 초록 원을 그리고, 안에 있으면 무적
function refreshSafeZones() {
  if (game.safeGroup) scene.remove(game.safeGroup);
  const g = game.safeGroup = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: '#69f0ae', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const fillMat = new THREE.MeshBasicMaterial({ color: '#69f0ae', transparent: true, opacity: 0.08, depthWrite: false });
  for (const id of game.safeBids || []) {
    const b = game.city.buildings[id];
    if (!b) continue;
    const y = game.city.groundY(b.door.x, b.door.z) + 0.06;
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(b.door.x, y, b.door.z); g.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(9.6, 48), fillMat); fill.rotation.x = -Math.PI / 2; fill.position.set(b.door.x, y - 0.01, b.door.z); g.add(fill);
  }
  scene.add(g);
}
game.inSafeZone = () => {
  const p = game.player;
  if (game.mode === 'interior') return (game.safeBids || []).includes(game.interior?.building?.id);
  return (game.safeBids || []).some((id) => { const d = game.city.buildings[id]?.door; return d && Math.hypot(p.pos.x - d.x, p.pos.z - d.z) < 10 && Math.abs(p.pos.y - (d.y || 0)) < 8; });
};

function placeAtHome() {
  const home = game.homeBuilding();
  const p = game.player;
  p.pos.copy(home.door).addScaledVector(new THREE.Vector3(0, 0, home.dir), 1.5);
  p.pos.y = game.city.groundY(p.pos.x, p.pos.z);
  p.vy = 0;
  p.heading = home.dir === 1 ? 0 : Math.PI;
  p.cam.yaw = (home.dir === 1 ? 0 : Math.PI) + 0.7;
  p.cam.pitch = 0.32;
  p.snap = true;
}

// ------------------------------------------------------------------
// 네트워크
// ------------------------------------------------------------------
const CAR_MODES = ['ai', 'player', 'parked', 'wreck', 'gone'];
function setupNet() {
  const net = game.net;
  net.on('snap', (s) => {
    if (Math.abs(s.m - game.minutes) > 3) game.minutes = s.m; else game.minutes += (s.m - game.minutes) * 0.2;
    if (s.w !== game.weather) { game.weather = s.w; if (game.started) ui.toast(`📅 오늘 날씨: ${s.w}`); }
    for (const m of s.meta) game.citizens.applyMeta(m);
    game.citizens.applySnap(s.n);
    if (s.nd) game.citizens.applyNeeds(s.nd);
    const cars = game.traffic.cars;
    const F = 9;
    for (let i = 0; i < cars.length && i * F < s.c.length; i++) {
      const car = cars[i], o = i * F;
      const mine = !!game.player && car === game.player.inCar;
      car.mode = CAR_MODES[s.c[o + 4]];
      car.owner = s.c[o + 5] >= 0 ? s.c[o + 5] : null;
      car.occ = s.c[o + 7];
      if (mine) { car.mode = 'player'; continue; }
      car.target = { x: s.c[o] / 10, z: s.c[o + 1] / 10, h: s.c[o + 2] / 100, y: s.c[o + 6] / 10 };
      car.turret = s.c[o + 8] / 100;
      car.speed = s.c[o + 3] / 10;
    }
    game.players.applySnap(s.p);
    game.units.apply(s.u || []);
    game.titans?.apply(s.ti || []);
    if (s.a) game.animals.apply(s.a);
    for (const ev of s.ev) game.citizens.applyEvent(ev);
  });
  net.on('pjoin', (m) => { game.players.add(m.p); if (!game.started) return; ui.toast(`👋 ${m.p.name}님이 젤리시티에 왔어요`); ui.addChatLine('sys', `${m.p.name}님이 입장했어요`); });
  net.on('pleave', (m) => { const p = game.players.list.get(m.id); if (p && game.started) ui.addChatLine('sys', `${p.name}님이 나갔어요`); game.players.remove(m.id); });
  net.on('pmeta', (m) => { if (m.p.id !== game.myId) game.players.meta(m.p); });
  net.on('psay', (m) => {
    ui.addChatLine(m.id === game.myId ? 'me' : m.anon ? 'anon' : 'other', m.text, m.name);
    if (m.anon) return; // 익명 채팅은 머리 위 말풍선을 띄우지 않는다 (누군지 드러나니까)
    if (m.id === game.myId) game.myBubble = { text: m.text, t: 5 };
    else game.players.say(m.id, m.text);
  });
  net.on('sys', (m) => { ui.addChatLine('sys', m.text); ui.toast(m.text); (game.news ||= []).unshift(m.text.replace(/^[^\s]+\s/, '')); game.news.length = Math.min(game.news.length, 6); });
  net.on('talk', (m) => ui.onTalkReply(m));
  net.on('talkCut', () => { if (ui.chatOpen()) { ui.addMsg('sys', '😱 대화가 중단됐어요!'); setTimeout(() => ui.closeChat(), 800); } });
  net.on('mem', (m) => { const c = game.sim.citizens[m.npc]; if (c) c.memories = m.list; });
  net.on('aff', (m) => { const c = game.sim.citizens[m.npc]; if (c) c.affinity = m.v; });
  net.on('carOk', (m) => {
    const car = game.traffic.cars[m.id];
    if (!car) return;
    car.mode = 'player'; car.owner = game.myId; car.occShown = 0;
    game.player.inCar = car;
    game.autoWalk = false;
    car.speed = 0; car.pos.y = car.pos.y || 0;
    if (car.kind === 'police') ui.toast('🚓 경찰차를 탔어요!');
    if (car.kind === 'tank') ui.toast('🪖 전차 탑승! 클릭하면 포를 쏴요');
    if (car.kind === 'heli') ui.toast('🚁 헬기 탑승! Space 상승 · Shift 하강 · 클릭 미사일');
  });
  net.on('carDenied', () => ui.toast('이 차는 지금 탈 수 없어요'));
  net.on('carGone', () => { ui.toast('💥 차가 폭발했어요!'); leaveCar(); });
  net.on('carSpawn', (m) => { if (m.id === game.traffic.cars.length) game.traffic.spawnParked(new THREE.Vector3(m.x, 0, m.z), m.h, m.kind || 'sedan', m.color); });
  net.on('carSay', (m) => {
    const car = game.traffic.cars[m.id];
    if (car && m.text) { car.bubble = { text: m.text, t: 2.5 }; if (m.text.includes('빵빵') && game.loc() === -1) sfx('horn', car.pos, car.kind === 'bus' || car.kind === 'truck' ? 'big' : null); }
  });
  net.on('runners', (m) => game.runners.spawn(m.list || []));
  net.on('rideNo', () => { if (game.player.mountSteed != null) { game.player.mountSteed = null; dismount(false); ui.toast('🐎 다른 사람이 먼저 탔어요'); } });
  net.on('titanNew', (m) => { ui.toast(`🧸 거대 젤리가 한 마리 더 나타났어요! (지금 ${m.n}마리)`); sfx('stomp', null, 10); });
  net.on('titanRaid', (m) => {
    ui.lootBanner(`🚨 거대 젤리 ${m.n}마리 습격!`, '🪝 젤리병단 장비(가방·핫바에 있어요)를 들고 우클릭 갈고리로 날아가 뒷목을 베세요!', '#c62828', '');
    sfx('raid');
  });
  net.on('rpos', (m) => game.runners.applyPos(m.a || []));
  net.on('runnerDown', (m) => game.runners.down(m.id));
  net.on('runnerGone', (m) => game.runners.gone(m.id));
  net.on('sleepers', (m) => { game.sleepers = m; ui.updateSleep(); });
  net.on('skip', (m) => {
    game.minutes = m.minutes;
    if (game.sleeping) stopSleeping(true);
    ui.toast('☀️ 모두 푹 자고 아침이 밝았어요!');
  });
  // 전투
  net.on('fx', (m) => game.combat.remoteFx(m));
  net.on('dmg', (m) => {
    game.hp = m.hp;
    game.player.roach.hurt();
    ui.hurtFlash(m.by);
    game.shake(0.4);
  });
  net.on('hp', (m) => { game.hp = m.hp; if (m.max) game.maxHp = m.max; });
  net.on('dead', (m) => {
    game.dead = true; game.hp = 0; game.stars = 0;
    game.autoWalk = false;
    if (game.sleeping) stopSleeping(false);
    if (game.player.inCar) leaveCar(true);
    if (ui.chatOpen()) ui.closeChat();
    game.player.roach.setDead(true);
    ui.showDeath(m.by);
  });
  net.on('respawn', async (m) => {
    game.dead = false; game.hp = m.hp;
    game.stats.homeId = m.homeId;
    game.player.roach.setDead(false);
    ui.showDeath(null);
    if (game.mode === 'interior') await exitBuilding(true);
    placeAtHome();
    ui.toast(game.stats.homeId != null ? '🏠 집에서 부활했어요. 체력이 가득 찼어요!' : '🏨 호텔에서 부활했어요');
  });
  net.on('wanted', (m) => {
    if (m.stars > 0 && !game.stars) { game.stats.wantedCount = (game.stats.wantedCount || 0) + 1; game.sendProfile(); }
    game.stars = m.stars;
  });
  net.on('arrested', (m) => goToJail(m));
  net.on('captured', (m) => {
    const d = ANIMALS[m.kind];
    if (!d) return;
    game.inv.add('mount_' + m.kind, 1);
    game.stats.captured = (game.stats.captured || 0) + 1;
    game.questEvent('capture');
    ui.lootBanner(`🪢 ${d.emoji} ${d.name} 포획 성공!`, '가방(I)의 탈것을 핫바에 놓고 쓰면 올라타요 · F로 내리기', '#8d6e63', '');
    game.sendProfile();
  });
  net.on('captureFail', (m) => ui.toast('🪢 ' + (m.reason || '포획 실패')));
  net.on('released', () => releaseFromJail());
  // 바닥 아이템
  net.on('gdrop', (m) => game.ground.add(m.g));
  net.on('gpick', (m) => game.ground.remove(m.gid));
  net.on('gotItem', (m) => {
    const d = itemDef(m.item.id);
    if (m.item.id === 'cash') { game.stats.money += m.item.n; ui.toast(`💵 ₩${m.item.n}을(를) 주웠어요`); return; }
    const extra = m.item.ttlMs ? { expiresAt: Date.now() + m.item.ttlMs, rarity: m.item.rarity || 'common' } : null;
    game.inv.add(m.item.id, m.item.n || 1, m.item.gems || [], extra);
    if (m.bonus) game.inv.add(m.bonus.id, m.bonus.n || 1, [], extra);
    if (m.world) {
      const r = RARITY[m.item.rarity] || RARITY.common;
      const bonus = m.bonus ? `+ ${itemDef(m.bonus.id).name.replace(/ ×\d+$/, '')} ${m.bonus.n}개` : '';
      ui.lootBanner(`${d.emoji} ${d.name}을(를) 획득했습니다!`, `(${TEMP_MINUTES}분 제한 / ${r.name})`, r.color, bonus);
    } else ui.toast(`${d.emoji} ${d.name}을(를) 주웠어요${extra ? ` (남은 시간 ${Math.ceil(m.item.ttlMs / 60000)}분)` : ''}`);
  });
  net.on('loot', (m) => { ui.addChatLine('loot', m.text); });
  net.on('knock', (m) => {
    const p = game.player;
    if (p.inCar) return;
    if (p.odm) { p.odm.vel.x += m.x; p.odm.vel.z += m.z; p.odm.vel.y += m.up; return; } // 입체기동 중엔 밀려날 뿐 뒤집히지 않는다
    p.knock = { x: m.x, z: m.z, t: 0.45 };
    if (p.flying) p.flying = false;
    p.vy = m.up; p.onGround = false;
    p.roach.jumpSquash = 1;
    if (m.wind) { ui.toast('🌪️ 돌풍에 날아갔어요!'); return; }
    if (m.kind === 'titan') { ui.toast('🧸💥 거대 젤리에게 짓밟혀 날아갔어요!'); return; }
    // 차에 치이면 벌러덩 뒤집힌다 → ← → 번갈아 눌러서 일어나기
    p.flipped = true;
    game.flip = { n: 0, need: 10, last: null };
    ui.flipHud(0, 10);
    ui.toast('🚗💥 차에 치여서 뒤집혔어요!');
  });
  net.on('xp', (m) => gainExp(m.v, m.reason));
  net.on('smash', (m) => smashProp(m.key, m.dir, true, true));
  net.on('unsmash', (m) => smashProp(m.key, null, false));
  net.on('hunted', (m) => { game.stats.hunted = (game.stats.hunted || 0) + 1; game.questEvent('hunt'); });
  // 휴대폰
  const refreshPhone = (tab) => { if (!document.getElementById('phone').classList.contains('hidden') && ui.phoneTab === tab) ui.openPhone(tab); };
  net.on('contacts', (m) => { game.contacts = m.list; refreshPhone('contacts'); });
  net.on('smsOut', (m) => { game.sms.push(m.m); refreshPhone('sms'); });
  net.on('smsIn', (m) => {
    game.sms.push(m.m);
    const who = game.contacts.find((c) => c.num === m.m.from)?.name || m.m.fromName;
    ui.toast(`💬 ${who}: ${m.m.text.slice(0, 40)}`);
    refreshPhone('sms');
  });
  // 인스타 DM
  net.on('dm', (m) => {
    const open = !document.getElementById('phone').classList.contains('hidden') && ui.phoneTab === 'insta' && ui.igTab === 'dm';
    if (open && (!ui.igDm || ui.igDm === m.from)) { ui.openPhone('insta'); return; }
    game.igUnread = (game.igUnread || 0) + 1;
    ui.toast(`✉️ 인스타 DM · ${m.name}: ${m.text.slice(0, 40)}`);
  });
  // 튄더
  const refreshTd = () => refreshPhone('tinder');
  net.on('tdCards', (m) => { game.tdCards = m.list; game.tdMe = m.me; refreshTd(); });
  net.on('tdMe', (m) => { game.tdMe = m.me; });
  net.on('tdMatches', (m) => { const changed = JSON.stringify(m.list) !== JSON.stringify(game.tdMatches); game.tdMatches = m.list; game.tdUnread = m.list.reduce((a, x) => a + x.unread, 0); if (changed) refreshTd(); });
  net.on('tdMsgs', (m) => { if (ui.tdChat === m.mid) { game.tdMsgs = m.msgs; game.tdOther = m.other; refreshTd(); } });
  net.on('tdMsg', (m) => {
    if (ui.tdChat === m.mid && !document.getElementById('phone').classList.contains('hidden')) { (game.tdMsgs ||= []).push(m.msg); refreshTd(); }
    else if (m.msg.from !== game.char) { game.tdUnread = (game.tdUnread || 0) + 1; ui.toast(`🔥 튄더 · ${m.name}: ${m.msg.contact ? '📇 연락처를 보냈어요' : m.msg.text.slice(0, 30)}`); }
  });
  net.on('tdMatch', (m) => { ui.lootBanner('💘 매칭 성공!', `${m.other.name}님과 서로 좋아요! 휴대폰 🔥 튄더에서 대화해 보세요`, '#ff2d6f', ''); });
  net.on('numReq', async (m) => { if (await ui.confirm(`📞 ${m.name}님이 번호를 교환하고 싶어해요. 수락할까요?`, '📞 수락', '거절')) net.send({ t: 'numAccept', id: m.id }); });
  net.on('flirtRes', (m) => ui.toast(m.player ? `💖 ${m.name}님에게 하트를 날렸어요!` : m.ok ? `💗 ${m.name}의 마음이 흔들려요! (친밀도 ↑)` : `💔 ${m.name}에게 안 통했어요...`));
  net.on('flirted', (m) => { ui.toast(`💖 ${m.name}님이 나에게 하트를 날렸어요!`); game.player.roach.setEmotion('love', 3); });
  net.on('slow', (m) => { game.slowT = m.s; ui.toast('❄️ 몸이 얼어서 느려졌어요!'); });
  net.on('canReport', (m) => { game.reportable = m.list; if (!game.reportHint) { game.reportHint = true; ui.toast('📱 휴대폰(Tab) → 112에서 나를 공격한 플레이어를 신고할 수 있어요'); } });
  // 집
  net.on('homes', (m) => {
    game.homes = m.homes;
    game.owned = m.owned || {};
    if (m.safe) { game.safeBids = m.safe; refreshSafeZones(); }
    for (const [id, name] of Object.entries(m.homes)) {
      const b = game.city.buildings[id];
      if (b && b.name !== name) { b.name = name; retitleSign(b.signMesh, name); }
    }
  });
  const setHomes = (m) => {
    game.stats.homeId = m.homeId; game.stats.homeUnit = m.homeUnit; game.myHomes = m.myHomes || [];
    syncKeys();
  };
  net.on('houseOk', (m) => {
    game.stats.money -= m.price;
    setHomes(m);
    const b = game.city.buildings[m.id];
    ui.lootBanner(`🔑 ${homeLabel(b, m.unit)} 열쇠를 받았어요!`, `₩${m.price.toLocaleString()} · 가방(I)에 열쇠가 있어요`, '#ffb300', m.id === m.homeId ? '대표 집으로 등록 — 여기서 자고 부활해요' : '');
    setWaypoint(b, `🏠 ${homeLabel(b, m.unit)}`);
  });
  net.on('houseSold', (m) => {
    game.stats.money += m.price;
    setHomes(m);
    ui.toast(`🏷️ 집을 팔아서 ₩${m.price.toLocaleString()}을 받았어요`);
  });
  net.on('myHomes', (m) => { setHomes(m); ui.toast('🏠 대표 집을 바꿨어요. 이제 이 집에서 부활해요'); });
  net.on('houseFail', (m) => ui.toast(`🏘️ ${m.reason}`));
  net.onClose = () => { if (!game.started) return; if (game.kicked) ui.kickedOut(); else ui.disconnected(); };
  net.on('kicked', () => { game.kicked = true; });
  setInterval(() => { if (game.started) sendState(); }, 100);
  setInterval(() => { if (game.started) net.send({ t: 'stats', stats: game.stats }); }, 15000);
  window.addEventListener('beforeunload', () => { if (game.started) net.send({ t: 'stats', stats: game.stats }); });
}

function sendState() {
  const p = game.player;
  const car = p.inCar;
  game.net.send({
    t: 'st', x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.heading.toFixed(2), s: +p.speed.toFixed(1),
    a: (p.onGround ? 0 : 1) | (p.flying ? 2 : 0) | (p.flipped ? 4 : 0), loc: game.loc(), mt: p.mount ? ANIMAL_KINDS.indexOf(p.mount.kind) : -1,
    car: car ? [+car.pos.x.toFixed(2), +car.pos.z.toFixed(2), +car.heading.toFixed(2), +car.speed.toFixed(1), +(car.pos.y || 0).toFixed(2), +(car.turret || 0).toFixed(2)] : null,
  });
}
game.sendProfile = () => {
  if (!game.inv) return;
  const job = game.playerJob();
  const t = game.inv.totals();
  const ls = levelStats(game.stats.level || 1);
  game.player.speedBonus = t.speed + ls.speed;
  game.maxHp = ls.maxHp;
  Object.assign(game.profile, { accessories: game.inv.visuals(), held: game.inv.heldVisual(), def: t.def, charm: t.charm, regen: t.regen, jobName: job ? job.name : '', level: game.stats.level || 1, badges: computeBadges() });
  localStorage.setItem(PROFILE_KEY, JSON.stringify(game.profile));
  game.net.send({ t: 'profile', profile: game.profile });
};
game.say = (text, anon = false) => game.net.send({ t: 'say', text, anon });
game.resetSave = () => { game.net.send({ t: 'stats', stats: game.stats }); setTimeout(() => location.reload(), 300); };

// ------------------------------------------------------------------
// 입력
// ------------------------------------------------------------------
const KEYMAP = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump', KeyX: 'down' };
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
window.addEventListener('keydown', (e) => {
  if (!game.started) return;
  if (e.code === 'Escape') { if (game.course) endCourse(false, '수련을 포기했어요'); ui.escape(); return; }
  if (typing()) return;
  // 휴대폰: K 또는 Tab (열려 있으면 닫기)
  if (e.code === 'Tab' || (e.code === 'KeyK' && !e.repeat)) { e.preventDefault(); ui.togglePhone(); return; }
  if (e.code === 'KeyI') { ui.toggleInventory(); return; }
  // 지도: M으로 열고, 열려 있으면 M으로 닫기
  if (e.code === 'KeyM' && !e.repeat && ui.modalKind === 'map' && !document.getElementById('modal').classList.contains('hidden')) { ui.closeModal(); return; }
  // 조작법: H로 열고, 열려 있으면 H로 닫기
  if (e.code === 'KeyH' && !e.repeat && game.player?.inCar && !ui.anyPanelOpen()) { honk(); return; }
  if (e.code === 'KeyH' && !e.repeat && (ui.modalKind === 'keys' && !document.getElementById('modal').classList.contains('hidden') || !ui.anyPanelOpen())) { ui.toggleHelp(); return; }
  if (ui.anyPanelOpen() || game.busy || game.dead) return;
  if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); clearKeys(); ui.focusPlayerChat(); return; }
  // 차에 치여 뒤집혔을 때: ← → 번갈아 빠르게
  if (game.watchingTV && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'BracketLeft' || e.code === 'BracketRight')) { switchTV(e.code === 'ArrowLeft' || e.code === 'BracketLeft' ? -1 : 1); e.preventDefault(); return; }
  if (game.flip && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') && !e.repeat) { mashFlip(e.code === 'ArrowLeft' || e.code === 'KeyA' ? 'L' : 'R'); e.preventDefault(); return; }
  const k = KEYMAP[e.code];
  if (k) {
    if (k === 'jump' && !game.input.jump) {
      // Space 두 번 연속(0.3초 안) → 날기 / 날고 있으면 날개 접고 떨어지기
      const now = performance.now();
      if (game.started && now - (game.lastSpace || 0) < 300 && !game.player?.inCar) { game.lastSpace = 0; toggleFly(); }
      else { game.input.jumpPressed = true; game.lastSpace = now; }
    }
    game.input[k] = true;
    if (e.code === 'Space') e.preventDefault();
    if (['forward', 'back', 'left', 'right'].includes(k) && game.autoWalk) { game.autoWalk = false; ui.toast('🚶 자동 이동을 멈췄어요'); }
  }
  if (/^Digit[0-9]$/.test(e.code)) { const n = +e.code.slice(5); game.inv.select(n === 0 ? 9 : n - 1); }
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'KeyF' && !e.repeat) { if (game.riding) endRide(true); else if (game.player.mount) dismount(true); else toggleCar(); }
  if (e.code === 'KeyZ' && !e.repeat) startCapture();
  if (e.code === 'KeyQ' && !e.repeat) dropSelected();
  if (e.code === 'KeyC' && !e.repeat) game.input.dashPressed = true;
  if (e.code === 'KeyR' && !e.repeat) toggleAutoWalk();
  if (e.code === 'KeyM' && !e.repeat) ui.openWorldMap();
  if (e.code === 'KeyG' && !e.repeat) toggleFly();
  if (e.code === 'KeyV' && !e.repeat) toggleView();
  if (e.code === 'KeyB' && !e.repeat) flirt();
  if (e.code === 'KeyJ' && !e.repeat) openEmoteWheel();
  if (e.code === 'KeyU' && !e.repeat) ui.openShopDirectory();
  if (e.code === 'KeyP' && !e.repeat) game.takePhoto?.();
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) game.input[k] = false; if (e.code === 'KeyZ') releaseCapture(); if (e.code === 'KeyJ') closeEmoteWheel(true); });
window.addEventListener('blur', () => closeEmoteWheel(false));
function clearKeys() { for (const k of Object.values(KEYMAP)) game.input[k] = false; game.combat?.trigger(false); }
window.addEventListener('blur', clearKeys);

let dragging = false, lastMX = 0, lastMY = 0;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!game.started || ui.anyPanelOpen()) return;
  if (game.emoteWheel) { closeEmoteWheel(true); return; } // 휠이 열려 있으면 클릭으로도 고른다
  if (e.button === 2) {
    // 젤리병단 장비: 오른쪽 클릭 = 갈고리 발사 (꾹 누르는 동안 당긴다)
    if (game.odm?.has() && game.odm.fire()) return;
    // 드래곤을 타고 있으면 오른쪽 클릭 = 불덩이
    if (game.player?.mount?.ride.fly) { game.combat.dragonFireball(game.player.mount); return; }
    game.aimHeld = true; return;
  }
  if (document.pointerLockElement === canvas) {
    if (e.button === 0 && !game.busy && !game.dead) useSelected(true);
    return;
  }
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
  if (e.button === 0) canvas.requestPointerLock?.()?.catch?.(() => {});
});
window.addEventListener('mouseup', (e) => { dragging = false; if (e.button === 0) game.combat?.trigger(false); if (e.button === 2) { game.aimHeld = false; game.odm?.release(); } });
window.addEventListener('mousemove', (e) => {
  if (!game.started || !game.player) return;
  if (game.emoteWheel) { moveEmoteWheel(e.movementX || 0, e.movementY || 0); return; }
  let dx = 0, dy = 0;
  if (document.pointerLockElement === canvas) { dx = e.movementX; dy = e.movementY; }
  else if (dragging) { dx = e.clientX - lastMX; dy = e.clientY - lastMY; lastMX = e.clientX; lastMY = e.clientY; }
  else return;
  const c = game.player.cam;
  const sens = sensOf('city') / (game.zoomNow || 1); // 줌 중에는 감도를 낮춘다 · 마우스 감도 설정(1배 = 원래)
  c.yaw -= dx * 0.0028 * sens;
  // 젤리병단 장비: 하늘(건물 꼭대기 · 거대 젤리 뒷목)을 올려다보며 갈고리를 걸 수 있게 위로도 크게 (카메라는 땅에 닿으면 땅을 타고 미끄러진다)
  c.pitch = clamp(c.pitch + dy * 0.0022 * sens, game.player.fp || game.player.aim > 0.5 || game.player.odmHeld ? -1.3 : -0.35, 1.25);
  game.mouseT = 1.5;
});
// 스코프 배율 (배그처럼 휠로 조절). 무기마다 고를 수 있는 배율과 처음 배율
const SCOPES = { hunting_rifle: { steps: [2, 3, 4, 6], start: 4 }, sniper: { steps: [2, 3, 4, 6, 8], start: 6 }, barrett: { steps: [4, 6, 8, 12, 15], start: 8 } };
game.scopeZoom = {};
function scopeZoomOf(id) { const s = SCOPES[id]; return s ? game.scopeZoom[id] ?? s.start : null; }
canvas.addEventListener('wheel', (e) => {
  if (!game.player) return;
  // 스코프로 조준 중이면 휠 = 배율 (위로 굴리면 확대)
  const sel = game.inv?.selected();
  const sc = sel && SCOPES[sel.id];
  if (sc && game.player.aim > 0.5 && !game.player.inCar) {
    game.wheelAcc = (game.wheelAcc || 0) + e.deltaY;
    if (Math.abs(game.wheelAcc) < 40) return; // 트랙패드는 조금씩 여러 번 온다
    const cur = scopeZoomOf(sel.id), i = sc.steps.indexOf(cur);
    const ni = Math.max(0, Math.min(sc.steps.length - 1, (i < 0 ? sc.steps.indexOf(sc.start) : i) + (game.wheelAcc < 0 ? 1 : -1)));
    game.wheelAcc = 0;
    if (sc.steps[ni] !== cur) { game.scopeZoom[sel.id] = sc.steps[ni]; sfx('scope'); }
    return;
  }
  game.wheelAcc = 0;
  const c = game.player.cam;
  c.dist = clamp(c.dist * (e.deltaY > 0 ? 1.1 : 0.9), 3.2, 30);
}, { passive: true });
document.addEventListener('pointerlockchange', () => { ui.setLocked(document.pointerLockElement === canvas); });
game.releaseMouse = () => { if (document.pointerLockElement) document.exitPointerLock(); };

// 선택한 핫바 아이템 사용 (무기면 공격, 음식이면 먹기)
function useSelected(down) {
  const it = game.inv.selected();
  const d = it ? itemDef(it.id) : null;
  // 드래곤을 타고 있으면 클릭 = 불 뿜기 (탈것 아이템으로 올라타기만)
  const mt = game.player.mount;
  if (mt?.ride.fly && !(d?.cat === 'mount' && d.mount !== mt.kind)) { game.combat.trigger(down); return; }
  if (game.player.inCar || !d || ['melee', 'gun', 'throw', 'launcher', 'wand'].includes(d.cat)) { game.combat.trigger(down); return; }
  if (!down) return;
  if (d.cat === 'food') {
    if (game.eating) return;
    game.inv.consume(it.uid);
    eatFood(it.id, 2.6, false);
  } else if (d.cat === 'rod') {
    fishAction(d);
  } else if (d.cat === 'mount') {
    toggleMount(d.mount, it);
  } else if (d.cat === 'carkey') {
    summonCar(it);
  } else if (d.cat === 'key') {
    setWaypoint(game.city.buildings[it.key.bid], `🔑 ${game.homeLabelOf(it.key)}`);
    ui.toast('📍 열쇠에 적힌 우리 집을 지도에 표시했어요');
  } else if (d.cat === 'doll') {
    game.player.roach.wave();
    game.myBubble = { text: `${d.emoji} 귀여워~ 💕`, t: 2 };
    addNeeds({ fun: 2 });
  }
}

// ------------------------------------------------------------------
// 상호작용
// ------------------------------------------------------------------
let focus = null;

function findFocus() {
  const p = game.player;
  const opts = [];
  if (p.inCar) return { kind: 'car-exit', label: '내리기', key: 'F' };
  if (game.riding) return { kind: 'ride-exit', label: game.riding.state === 'wait' ? `${game.riding.ride.emoji} 탑승 대기 중… (F: 그만두기)` : `${game.riding.ride.emoji} ${game.riding.ride.name} 타는 중!`, key: 'F' };
  if (game.mode === 'city' && game.park) {
    const r = game.park.near(p.pos);
    if (r) { const T = game.park.now(); opts.push({ kind: 'ride', ride: r, d: 0.5, label: `${r.emoji} ${r.name} 타기${r.boardable(T) ? '' : ` (다음 차례까지 ${r.wait(T)}초)`}` }); }
  }
  const pos = p.pos;
  // 길을 돌아다니는 도시 말: 가까이서 E로 바로 올라탄다
  if (game.mode === 'city' && !p.mount && !p.odm && game.animals) {
    let st = null, sd = 3.8;
    for (const a of game.animals.list) { if (!a.def.city || !a.visible || a.gone) continue; const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z); if (d < sd) { sd = d; st = a; } }
    if (st) opts.push({ kind: 'steed', a: st, d: sd - 0.8, label: '🐎 말 타기 (Shift 질주 · F 내리기)' });
  }
  let npc = null, nd = 2.8;
  for (const c of game.sim.citizens) {
    if (!c.visible || c.mode === 'dead') continue;
    const d = c.roach.root.position.distanceTo(pos);
    if (d < nd) { nd = d; npc = c; }
  }
  if (npc) {
    const busy = npc.mode === 'player' && npc.talkingTo !== game.myId;
    const scared = npc.mode === 'flee' || npc.mode === 'fight';
    opts.push({ kind: 'npc', c: npc, d: nd - 0.6, label: busy ? `${npc.name} — 다른 플레이어와 대화 중 💬` : scared ? `${npc.name} — 지금은 대화할 수 없어요 😱` : `대화하기 · ${npc.name} (${npc.job.name})` });
  }
  const g = game.ground.nearest(pos, game.loc());
  if (g) { const d = itemDef(g.item.id); const rar = g.rarity ? `[${g.rarity.name}] ` : ''; opts.push({ kind: 'ground', g, d: 0, label: `줍기 · ${rar}${d.emoji} ${g.item.id === 'cash' ? `₩${g.item.n}` : d.name}${g.item.n > 1 && g.item.id !== 'cash' ? ` x${g.item.n}` : ''}${g.bonus ? ` + ${itemDef(g.bonus.id).emoji}${g.bonus.n}` : ''}` }); }
  if (game.mode === 'city') {
    for (const b of game.city.buildings) {
      if (b.type === 'park') continue;
      const d = Math.hypot(b.door.x - pos.x, b.door.z - pos.z);
      // 공중(날기·점프 중, 옥상 위)에서는 들어갈 수 없다
      if (d < 3.2 && !p.flying && pos.y - b.door.y < 1.2) {
        const n = game.sim.citizens.filter((c) => c.location === b && c.mode === 'inside').length;
        const pl = [...game.players.list.values()].filter((o) => o.loc === b.id).length;
        const lock = b.type === 'club' && CLUB_CHARM > 0 ? ` (매력 ${CLUB_CHARM}+)` : '';
        opts.push({ kind: 'door', b, d, label: `들어가기 · ${b.def.emoji} ${b.name}${lock}${n ? ` (${n}명)` : ''}${pl ? ` 🎮${pl}` : ''}` });
      }
    }
  } else {
    const I = game.interior;
    for (const a of I.actions) {
      const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z);
      if (d < 1.7 && Math.abs(a.pos.y - pos.y) < 1.5) {
        const cost = a.action.cost ? ` (₩${a.action.cost})` : '';
        opts.push({ kind: 'action', a, d, label: `${a.action.label}${cost}` });
      }
    }
    const de = Math.hypot(I.exit.x - pos.x, I.exit.z - pos.z);
    if (de < 2.0) opts.push({ kind: 'exit', d: de, label: game.jail ? `🔒 석방까지 ${Math.max(0, Math.ceil((game.jail.until - Date.now()) / 1000))}초 남았어요` : '밖으로 나가기 🚪' });
  }
  opts.sort((a, b) => a.d - b.d);
  const f = opts[0] || null;
  if (f) f.key = 'E';
  // 탄 동물에서 내리는 법이 늘 보이게
  if (p.mount) return { ...(f || {}), carLabel: `${p.mount.def?.emoji || '🐎'} ${p.mount.def?.name || '탈것'}에서 내리기` }; // F 줄로 따로 보인다
  if (game.mode === 'city') {
    const car = game.traffic.nearestCar(pos, 3.6);
    if (car) return { ...(f || {}), car, carLabel: car.mode === 'ai' ? (car.occ ? '자동차 빼앗기 🚗' : '자동차 타기 🚗') : car.kind === 'tank' ? '전차 타기 🪖' : car.kind === 'heli' ? '헬기 타기 🚁' : '자동차 타기 🚗' };
  }
  return f;
}

function interact() {
  if (!focus) return;
  if (focus.kind === 'npc') {
    const c = focus.c;
    if (c.mode === 'player' && c.talkingTo !== game.myId) { ui.toast('💬 다른 플레이어와 대화 중이에요. 잠시 후 말을 걸어보세요'); return; }
    if (c.mode === 'flee' || c.mode === 'fight') { ui.toast('😱 지금은 겁에 질려서 대화할 수 없어요'); return; }
    ui.openChat(c);
  } else if (focus.kind === 'ground') game.net.send({ t: 'pickup', gid: focus.g.id });
  else if (focus.kind === 'door') enterBuilding(focus.b);
  else if (focus.kind === 'ride') startRide(focus.ride);
  else if (focus.kind === 'steed') rideSteed(focus.a);
  else if (focus.kind === 'exit') { if (game.jail) ui.toast('🔒 감옥 문이 잠겨 있어요. 석방될 때까지 기다리세요'); else exitBuilding(); }
  else if (focus.kind === 'action') doAction(focus.a.action);
}

function leaveCar(silent) {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  const out = game.traffic.exit(car);
  if (!silent) game.net.send({ t: 'carExit' });
  if (car.kind === 'heli') { car.pos.y = 0; }
  p.pos.copy(out); p.pos.y = game.city.groundY(out.x, out.z);
  p.collide(game.city.colliders);
  p.inCar = null;
  p.roach.setSeated(false);
  p.roach.root.scale.setScalar(p.roach.baseScale);
  p.cam.dist = 7.5;
}

function toggleCar() {
  if (game.player.odm) return; // 입체기동 중엔 차를 못 탄다
  const p = game.player;
  if (p.inCar) {
    if (p.inCar.kind === 'heli' && (p.inCar.pos.y || 0) > 2) { ui.toast('🚁 먼저 착륙하세요 (Shift로 하강)'); return; }
    game.net.send({ t: 'carExit' });
    leaveCar(true);
    return;
  }
  if (game.mode !== 'city' || !focus?.car) return;
  game.net.send({ t: 'carEnter', id: focus.car.id });
}

// ------------------------------------------------------------------
// 이모트 휠: J를 꾹 누르면 8가지 춤이 뜨고, 마우스로 고른 뒤 떼면 춘다 (움직이면 멈춤)
// song: 유튜브 공식 영상의 챌린지 구간만 반복 재생 (보이는 미니 플레이어). 춤은 영상의 재생 시각으로 센 박에 맞춘다
//   start~end: 반복 구간(초, 박 위에서 시작), bpm: 박자 (영상 장면·가사가 바뀌는 시각으로 잰 값), tall: 세로 영상(쇼츠)
// ------------------------------------------------------------------
const EMOTES = [
  { id: 'creamcheese', name: '크림치즈 허니', e: '🧀', song: { id: 'hoVJeMcSeto', start: 1.58, end: 14.38, bpm: 150, tall: true, title: '권루트 - L을 가져가 챌린지' } },
  { id: 'redred', name: 'REDRED', e: '❌', song: { id: 'w9obXvHi700', start: 6.37, end: 14.37, bpm: 120, tall: true, title: "CORTIS - REDRED 공식 챌린지" } },
  { id: 'apt', name: '아파트', e: '🏢', song: { id: '5VhmJaKV10c', start: 1.145, end: 9.145, bpm: 150, tall: true, title: 'ROSÉ - APT. 공식 챌린지' } },
  { id: 'ganbare', name: '간바레', e: '💪', song: { id: 'm1o67ti-DME', start: 2.35, end: 8.776, bpm: 149.4, title: 'おだまよ - 頑張りたいソング' } },
  { id: 'slickback', name: '슬릭백', e: '🕺' },
  { id: 'heart', name: '하트 뿅뿅', e: '💖' },
  { id: 'shuffle', name: '셔플', e: '👟' },
  { id: 'wave', name: '인사', e: '👋' },
];
const EMOTE_IDS = new Set(EMOTES.map((x) => x.id));
function openEmoteWheel() {
  if (game.emoteWheel || ui.anyPanelOpen() || game.busy || game.dead) return;
  game.emoteWheel = { x: 0, y: 0, sel: -1 };
  const box = document.getElementById('ew-items');
  box.innerHTML = EMOTES.map((m, i) => {
    const a = (i / EMOTES.length) * Math.PI * 2;
    return `<div class="ew-item" data-i="${i}" style="left:${180 + Math.sin(a) * 122}px;top:${180 - Math.cos(a) * 122}px"><span>${m.e}</span><i>${m.name}</i>${m.song ? '<b class="music">🎵</b>' : ''}</div>`;
  }).join('');
  moveEmoteWheel(0, 0);
  document.getElementById('emote-wheel').classList.remove('hidden');
}
function moveEmoteWheel(dx, dy) {
  const W = game.emoteWheel;
  if (!W) return;
  W.x += dx; W.y += dy;
  const d = Math.hypot(W.x, W.y);
  if (d > 110) { W.x *= 110 / d; W.y *= 110 / d; }
  // 가운데에서 조금 벗어나면 그 방향의 춤을 고른다 (위가 첫 번째, 시계 방향)
  W.sel = d < 28 ? -1 : Math.round(((Math.atan2(W.x, -W.y) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / EMOTES.length)) % EMOTES.length;
  document.getElementById('ew-cursor').style.transform = `translate(${W.x}px, ${W.y}px)`;
  document.querySelectorAll('.ew-item').forEach((el) => el.classList.toggle('on', +el.dataset.i === W.sel));
  const m = EMOTES[W.sel];
  document.getElementById('ew-name').textContent = m ? `${m.e} ${m.name}` : '💃 이모트';
  if (W.sel !== W.lastSel) { if (W.sel >= 0) sfx('scope'); W.lastSel = W.sel; }
}
function closeEmoteWheel(apply) {
  const W = game.emoteWheel;
  if (!W) return;
  game.emoteWheel = null;
  document.getElementById('emote-wheel').classList.add('hidden');
  if (apply && W.sel >= 0) startEmote(EMOTES[W.sel].id);
}
function startEmote(id) {
  const p = game.player, m = EMOTES.find((x) => x.id === id);
  if (!m) return;
  if (p.inCar || p.flying || !p.onGround || p.mount || p.swimming || game.mode === 'ride') { ui.toast('💃 땅에 서 있을 때만 춤출 수 있어요'); return; }
  if (game.emoting) stopEmote(!!m.song); // 다음 춤에 노래가 있으면 플레이어는 그대로 두고 곡만 바꾼다
  game.emoting = { id, t: 0, song: m.song || null };
  p.roach.playEmote(id);
  game.net.send({ t: 'fx', k: 'emote', id });
  sfx('jump', null, 2);
  ui.toast('💃🛡️ 춤추는 동안 무적! (움직이거나 공격하면 풀려요)');
  if (m.song) playEmoteSong(m.song, { owner: 'me' });
}
function stopEmote(quiet = false) {
  if (!game.emoting) return;
  game.emoting = null;
  game.player.roach.playEmote(null);
  game.net.send({ t: 'fx', k: 'emote', id: null });
  if (!quiet) stopEmoteSong();
}
game.stopEmote = () => stopEmote();
// 유튜브 IFrame API (처음 쓸 때 한 번만 불러온다)
let ytReady = null, ytPlayer = null;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res, rej) => {
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.onerror = rej;
    document.head.appendChild(s);
  });
  return ytReady;
}
// 지금 미니 플레이어로 듣고 있는 노래: owner 'me'(내 춤) 또는 다른 플레이어 id (그 사람 춤을 근처에서 듣는 중)
let songSession = null;
async function playEmoteSong(song, { owner = 'me', at = null } = {}) {
  const sess = songSession = { song, owner };
  const who = owner === 'me' ? '' : `${game.players.list.get(owner)?.name || '친구'}님의 `;
  document.getElementById('es-title').textContent = `🎵 ${who}${song.title}`;
  document.getElementById('emote-song').classList.remove('hidden');
  document.getElementById('emote-song').classList.toggle('tall', !!song.tall);
  ytClock = null; sess.lastSync = 0;
  duckMusic(true);
  const from = at ?? song.start;
  try { await loadYT(); } catch { ui.toast('🎵 유튜브를 불러오지 못했어요'); stopEmoteSong(); return; }
  if (songSession !== sess) return; // 그사이 멈췄거나 다른 노래로 바뀌었으면
  if (!ytPlayer) {
    ytPlayer = await new Promise((res) => {
      const pl = new window.YT.Player('es-player', {
        width: 356, height: 200, videoId: song.id,
        playerVars: { autoplay: 1, start: Math.floor(from), playsinline: 1, rel: 0, controls: 0, disablekb: 1 },
        events: { onReady: () => res(pl), onError: () => { ui.toast('🎵 이 노래는 여기서 재생할 수 없어요'); stopEmoteSong(); } },
      });
    });
    if (songSession !== sess) { stopEmoteSong(); return; }
    ytPlayer.seekTo(from, true); ytPlayer.playVideo();
  } else ytPlayer.loadVideoById({ videoId: song.id, startSeconds: from });
  ytPlayer.setVolume?.(100);
}
game.ytNow = () => (songSession && ytPlayer?.getCurrentTime ? ytPlayer.getCurrentTime() : null); // 디버깅용: 지금 노래 위치
// 노래 시각 → 박. 플레이어가 알려 주는 시각은 띄엄띄엄 오므로 그 사이는 실제 흐른 시간으로 메운다
let ytClock = null;
function emoteSongBeat(song) {
  const st = ytPlayer?.getPlayerState?.();
  if (st === 3 && ytClock) return 0; // 되감은 뒤 불러오는 중: 첫 동작에서 노래를 기다린다
  if (st !== 1) { ytClock = null; return undefined; } // 아직 재생 전이면 혼자 춘다
  const ct = ytPlayer.getCurrentTime(), now = performance.now();
  // 처음으로 되감은 직후엔 플레이어가 잠깐 예전 시각을 알려 줄 수 있어 무시한다
  const settling = ytClock?.seekAt && now - ytClock.seekAt < 500 && ct >= song.end - 0.2;
  const first = !ytClock;
  if (!settling && (!ytClock || ct !== ytClock.ct)) ytClock = { ct, at: now, seekAt: ytClock?.seekAt };
  let t = ytClock.ct + (now - ytClock.at) / 1000;
  // 챌린지 구간 끝 → 처음으로 (박 위에서 다시 시작)
  let looped = false;
  if (t >= song.end - 0.03 || t < song.start - 1.5) { ytPlayer.seekTo(song.start, true); ytClock = { ct: song.start, at: now, seekAt: now }; t = song.start; looped = true; }
  // 내 춤이면 주변 사람들에게 지금 노래 위치를 알려 준다 (시작할 때 · 구간이 돌 때 · 2초마다)
  const S = songSession;
  if (S?.owner === 'me' && game.emoting && (first || looped || now - (S.lastSync || 0) > 2000)) {
    S.lastSync = now;
    game.net.send({ t: 'fx', k: 'emotesync', id: game.emoting.id, pos: +t.toFixed(3) });
  }
  return Math.max(0, t - song.start) * song.bpm / 60;
}
function stopEmoteSong() {
  songSession = null;
  try { ytPlayer?.pauseVideo?.(); } catch { /* 아직 준비 전 */ }
  document.getElementById('emote-song').classList.add('hidden');
  duckMusic(false);
}
// 주변 플레이어가 노래 있는 춤을 추면: 30m 안이면 같은 노래를 같은 위치로 맞춰 듣는다 (내가 추는 노래가 먼저, 여럿이면 가까운 사람)
const LISTEN_R = 30;
game.onEmoteSync = (pid, id, pos) => {
  const m = EMOTES.find((x) => x.id === id);
  if (!m?.song || game.emoting?.song) return;
  const pl = game.players.list.get(pid);
  if (!pl?.visible || game.mutedDancer === pid) return;
  const d = pl.pos.distanceTo(game.player.pos);
  if (d > LISTEN_R) return;
  const S = songSession;
  if (S && S.owner !== pid && S.owner !== 'me') { const cur = game.players.list.get(S.owner); if (cur && cur.pos.distanceTo(game.player.pos) < d) return; }
  const want = Math.min(m.song.end - 0.05, pos + 0.12); // 전달되는 동안 흐른 시간만큼 앞으로
  const anchor = { pos: want, at: performance.now() }; // 춤추는 사람의 노래가 지금 어디쯤인지 계속 계산하는 기준
  if (S?.owner === pid && S.song === m.song) { S.anchor = anchor; return; } // 이미 듣는 중: 어긋남은 매 프레임 맞춘다
  playEmoteSong(m.song, { owner: pid, at: want }).then(() => { if (songSession?.owner === pid) songSession.anchor = { pos: anchor.pos + (performance.now() - anchor.at) / 1000, at: performance.now() }; });
  if (songSession) songSession.anchor = anchor;
};
// 듣고 있는 사람의 춤을 그 노래 박에 맞추고, 멀어지면 소리를 줄이다가 끊는다
function updateListenedSong() {
  const S = songSession;
  if (!S || S.owner === 'me') return;
  const pl = game.players.list.get(S.owner);
  const d = pl ? pl.pos.distanceTo(game.player.pos) : Infinity;
  if (!pl?.visible || d > LISTEN_R + 5 || !pl.roach.emote || game.emoting) { stopEmoteSong(); return; }
  ytPlayer?.setVolume?.(Math.round(100 * Math.max(0.15, Math.min(1, 1 - (d - 6) / (LISTEN_R - 6)))));
  // 춤추는 사람 쪽 노래 위치(기준 + 흐른 시간, 구간 안에서 돌기)와 내 플레이어가 0.15초 넘게 어긋나면 맞춘다.
  // 되감으면 불러오는 데 시간이 걸리니 조금 앞으로 (1.5초에 한 번까지)
  const now = performance.now(), song = S.song;
  if (S.anchor && ytPlayer?.getPlayerState?.() === 1 && now - (S.fixAt || 0) > 1500) {
    const len = song.end - song.start;
    const exp = song.start + ((((S.anchor.pos - song.start) + (now - S.anchor.at) / 1000) % len) + len) % len;
    const off = ytPlayer.getCurrentTime() - exp;
    if (Math.abs(off) > 0.15 && Math.abs(off) < len - 0.15) { S.fixAt = now; ytPlayer.seekTo(Math.min(song.end - 0.1, exp + (S.lag ?? 0.3)), true); ytClock = null; }
    else if (S.fixAt && now - S.fixAt < 4000) S.lag = Math.max(0, Math.min(1.2, (S.lag ?? 0.3) - off)); // 되감은 뒤 남은 차이로 다음 보정량을 배운다
  }
  pl.roach.emote.beat = emoteSongBeat(S.song);
}
// ✕: 내 노래는 끄고, 남의 노래면 그 사람이 이번 춤을 멈출 때까지 다시 틀지 않는다
document.getElementById('es-close').onclick = () => { if (songSession && songSession.owner !== 'me') game.mutedDancer = songSession.owner; stopEmoteSong(); };
Roach.onEmoteFx = (r, k) => { if (k === 'heart' && r.root.visible) { const at = r.root.position.clone(); at.y += 1.2; game.combat?.fx.hearts(at, null, '💖'); } };
game.isEmote = (id) => EMOTE_IDS.has(id);

// ------------------------------------------------------------------
// 상점 표시: 가게 건물 위에 이름표를 띄워 멀리서도(건물 너머로도) 보이게
// ------------------------------------------------------------------
function shopBadgeTex(emoji, title) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 84;
  const x = c.getContext('2d');
  x.font = "bold 30px 'Jua', sans-serif";
  const w = Math.min(316, 74 + x.measureText(title).width + 22);
  const x0 = (320 - w) / 2;
  x.fillStyle = 'rgba(40,25,20,0.35)'; x.beginPath(); x.roundRect(x0 + 2, 6, w - 2, 66, 33); x.fill();
  x.fillStyle = '#fffaf2'; x.beginPath(); x.roundRect(x0, 2, w - 2, 66, 33); x.fill();
  x.strokeStyle = '#ff7e9a'; x.lineWidth = 4; x.stroke();
  x.font = '38px sans-serif'; x.textBaseline = 'middle'; x.fillText(emoji, x0 + 14, 37);
  x.font = "bold 30px 'Jua', sans-serif"; x.fillStyle = '#4a3428'; x.fillText(title, x0 + 64, 37);
  x.fillStyle = '#fffaf2'; x.beginPath(); x.moveTo(150, 66); x.lineTo(170, 66); x.lineTo(160, 82); x.fill(); // 말풍선 꼬리
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function buildShopMarkers() {
  game.shopMarkers = [];
  const group = new THREE.Group(); scene.add(group);
  for (const b of game.city.buildings) {
    const info = SHOPS[b.type];
    if (!info) continue;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: shopBadgeTex(b.def.emoji, b.name), transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
    sp.scale.set(0.19, 0.05, 1); sp.renderOrder = 50;
    sp.position.set(b.x, (b.base || 0) + (b.floors || 1) * 3.6 + 5, b.z);
    group.add(sp);
    game.shopMarkers.push({ sp, b, y0: sp.position.y });
  }
  game.shopMarkerGroup = group;
}
// 가까운(300m) 가게만, 너무 가까우면(12m) 간판이 보이니 숨김. 둥실둥실
function updateShopMarkers(t) {
  if (!game.shopMarkers) return;
  const show = game.mode === 'city' && !game.cutscene;
  game.shopMarkerGroup.visible = show;
  if (!show) return;
  const me = game.player.pos;
  for (const m of game.shopMarkers) {
    const d = Math.hypot(m.b.x - me.x, m.b.z - me.z);
    m.sp.visible = d < 300 && d > 12;
    if (!m.sp.visible) continue;
    m.sp.position.y = m.y0 + Math.sin(t * 2 + m.b.id) * 0.4;
    m.sp.material.opacity = Math.min(1, (300 - d) / 60);
  }
}
game.nearestShop = (type) => {
  const me = game.player.pos;
  let best = null, bd = Infinity;
  for (const b of game.city.buildings) if (b.type === type) { const d = Math.hypot(b.x - me.x, b.z - me.z); if (d < bd) { bd = d; best = b; } }
  return best ? { b: best, d: bd } : null;
};

// 차 안에서 H: 빵빵 (다른 사람에게도 들린다)
function honk() {
  const car = game.player.inCar;
  if (!car || performance.now() - (game.honkT || 0) < 500) return;
  game.honkT = performance.now();
  const big = ['bus', 'truck', 'tank'].includes(car.kind);
  sfx('horn', null, big ? 'big' : null);
  car.bubble = { text: '빵빵! 🚗', t: 1.2 };
  game.net.send({ t: 'fx', k: 'horn', p: [car.pos.x, (car.pos.y || 0) + 1, car.pos.z], big });
}
async function enterBuilding(b, opts = {}) {
  if (!opts.jail && b.type === 'club' && game.charm() < CLUB_CHARM) {
    const msg = `매력 ${CLUB_CHARM} 이상만 입장 가능합니다. 😎 (지금 ${game.charm()})`;
    game.bouncerSay = { b, text: msg, t: 3.5 };
    b.bouncers?.forEach((r) => r.setEmotion('angry', 3));
    ui.toast('🕶️ 경호원: ' + msg + ' 모자·안경·옷 가게에서 꾸며보세요!');
    return;
  }
  if (b.type === 'club') { game.bouncerSay = { b, text: '어서 오십시오. 즐거운 시간 되세요 🎶', t: 2.5 }; b.bouncers?.forEach((r) => r.wave()); }
  const mine = game.myHomes.filter((h) => h.bid === b.id);
  if (!opts.jail && b.type === 'prison') { ui.toast('🔒 교도소는 면회 시간에만... 지금은 들어갈 수 없어요'); return; }
  if (b.type === 'house' && !mine.length && (game.owned[b.id] || []).length) {
    ui.toast(`🔒 ${b.name}이에요. 열쇠가 없으면 들어갈 수 없어요`);
    return;
  }
  sfx('door', null, opts.jail ? 'cell' : null);
  await ui.flash();
  const isHome = mine.length > 0;
  // 여러 호수를 가졌으면 대표 집 호수를 우선
  const unit = (mine.find((h) => h.bid === game.stats.homeId && h.unit === game.stats.homeUnit) || mine[0])?.unit;
  const job = game.playerJob();
  const isWork = job && b.id === game.stats.workId;
  const I = buildInterior(b, { isHome, unit, workJob: isWork ? job : null });
  scene.add(I.group);
  // TV·영화관 스크린에 방송을 튼다
  game.tvs = I.screens.map((m) => { const tv = new TVScreen(m, tvInfo); if (typeof m.userData.tv === 'string') tv.setChannel(CHANNELS.findIndex((c) => c.id === m.userData.tv)); else tv.setChannel(game.tvChannel || 0); tv.switchT = 0; return tv; });
  game.interior = I;
  game.mode = 'interior';
  game.city.root.visible = false;
  game.wild.root.visible = false;
  const p = game.player;
  const cell = opts.jail && I.cells.length ? I.cells[Math.floor(Math.random() * I.cells.length)] : null;
  if (cell && game.jail) game.jail.cell = cell.rect;
  p.pos.copy(cell || I.entry);
  p.heading = Math.PI;
  p.cam.yaw = 0;
  p.cam.target.copy(p.pos);
  p.snap = true;
  sendState();
  ui.toast(`${b.def.emoji} ${b.name}에 들어왔어요`);
  if (isHome) ui.toast(`🔑 ${homeLabel(b, unit)} — 우리 집! 침대에서 자고, 여기서 부활해요`);
  else if ((b.type === 'villa' || b.type === 'apartment') && freeUnits(b, game.owned[b.id] || []).length) ui.toast('🏘️ 빈 호수가 있어요. 부동산에서 살 수 있어요');
  if (b.type === 'dojang') ui.toast('🥋 시작 발판 위에서 E를 눌러 수련을 시작해요');
}

async function exitBuilding(silent) {
  const b = game.interior.building;
  if (!game.jail) sfx('door');
  if (!silent) await ui.flash();
  if (game.sleeping) stopSleeping(false);
  if (game.course) endCourse(false, null);
  game.interior.dispose();
  game.interior = null;
  game.tvs = null; stopTV();
  game.mode = 'city';
  game.city.root.visible = true;
  game.wild.root.visible = true;
  const p = game.player;
  p.pos.copy(b.door).addScaledVector(new THREE.Vector3(0, 0, b.dir), 1.2);
  p.pos.y = game.city.groundY(p.pos.x, p.pos.z);
  p.heading = b.dir === 1 ? 0 : Math.PI;
  p.cam.yaw = (b.dir === 1 ? 0 : Math.PI) + 0.5;
  p.cam.target.copy(p.pos);
  p.snap = true;
  sendState();
  if (ui.chatOpen()) ui.closeChat();
}

// ------------------------------------------------------------------
// 아이템 버리기
// ------------------------------------------------------------------
async function dropSelected() {
  const it = game.inv.selected();
  if (!it) { ui.toast('선택한 칸이 비어 있어요'); return; }
  const d = itemDef(it.id);
  const value = (d.price || 0) * (it.n || 1);
  if (value >= 300 && !(await ui.confirm(`${d.emoji} ${d.name}${it.n > 1 ? ` x${it.n}` : ''} (₩${value})<br>정말 버리시겠습니까?<br><small>버린 아이템은 1분 뒤에 사라지고, 다른 사람이 주울 수 있어요.</small>`, '🗑️ 버리기'))) return;
  const out = game.inv.remove(it.uid);
  game.net.send({ t: 'drop', item: { id: out.id, n: out.n || 1, gems: out.gems || [], ttlMs: out.expiresAt ? Math.max(0, out.expiresAt - Date.now()) : 0, rarity: out.rarity } });
  ui.toast(`${d.emoji} ${d.name}을(를) 바닥에 버렸어요`);
}
game.dropItem = async (u) => { const sel = game.stats.hotbar.indexOf(u); if (sel >= 0) { game.inv.select(sel); await dropSelected(); } else { const old = game.stats.hotbar[game.stats.sel]; game.stats.hotbar[game.stats.sel] = u; await dropSelected(); if (game.inv.find(old)) game.stats.hotbar[game.stats.sel] = old; game.inv.changed(); } };

// ------------------------------------------------------------------
// 행동
// ------------------------------------------------------------------
async function busyFor(text, ms) {
  game.busy = true;
  clearKeys();
  await ui.fade(text, ms);
  game.busy = false;
}
const actionMs = (dur) => Math.min(5000, 1200 + (dur || 0) * 30);

async function doAction(a) {
  const S = game.stats;
  if (a.jobBoard) { ui.openJobBoard(); return; }
  if (a.shop) { ui.openShop(game.interior.building.type); return; }
  if (a.enchant) { ui.openEnchant(); return; }
  if (a.houses) { ui.openHouses(); return; }
  if (a.restyle) { ui.openStyle(a.cost); return; }
  if (a.id === 'tv') { watchTV(); return; }
  if (a.sell) { ui.openSell(); return; }
  if (a.cookFish) { ui.openCookFish(a.cookFish); return; }
  if (a.dealer) { ui.openDealer(); return; }
  if (a.rangeStart) { startRange(); return; }
  if (a.rangeRent) {
    const it = game.inv.add('pistol', 1, [], { expiresAt: Date.now() + 600000, rarity: 'common' });
    if (it) game.inv.select(Math.max(0, game.stats.hotbar.indexOf(it.uid)));
    ui.toast('🔫 연습용 권총을 빌렸어요 (10분). 우클릭으로 조준해 보세요!');
    return;
  }
  if (a.menu) { ui.openMenu(game.interior.building.type, a.id === 'microwave'); return; }
  if (a.recolor) { ui.openRecolor(); return; }
  if (a.course) { startCourse(a.course); return; }
  if (a.cost && S.money < a.cost) { ui.toast('💸 돈이 부족해요! 일을 해서 돈을 벌어보세요'); return; }
  if (a.interest) {
    if (S.lastInterestDay === game.day()) { ui.toast('오늘 이자는 이미 받았어요 🏦'); return; }
    const v = Math.max(2, Math.floor(S.money * 0.03));
    S.money += v; S.lastInterestDay = game.day();
    ui.toast(`🏦 이자 ₩${v}를 받았어요!`);
    return;
  }
  if (a.work) {
    const job = game.playerJob();
    if (S.workedDay !== game.day()) { S.workedDay = game.day(); S.workedToday = 0; }
    if (S.workedToday >= 24) { ui.toast('😮‍💨 오늘은 충분히 일했어요. 내일 또 해요!'); return; }
    const hours = 4;
    await busyFor(`💼 ${job.name}(으)로 열심히 일하는 중...`, 6000);
    const pay = job.wage * hours;
    S.money += pay;
    S.workedToday += hours;
    addNeeds({ energy: -18, hunger: -10, fun: -6, social: 6, hygiene: -6 });
    ui.toast(`💰 ${hours}시간치 일을 해서 ₩${pay}를 벌었어요!`);
    gainExp(40 + Math.round(job.wage * 1.2), `${job.name} 근무`);
    game.questEvent('work');
    return;
  }
  if (a.rent) {
    S.money -= a.cost;
    const b = game.interior.building;
    await exitBuilding();
    const pos = b.walk.clone().add(new THREE.Vector3(0, 0, b.dir * 2.5));
    game.net.send({ t: 'carRent', x: pos.x, z: pos.z, h: Math.PI / 2 });
    ui.toast('🚗 렌트한 자동차를 탔어요! F 키로 내릴 수 있어요');
    return;
  }
  if (a.sleep) {
    S.money -= a.cost || 0;
    if (a.fx?.hygiene) addNeeds({ hygiene: a.fx.hygiene });
    startSleeping();
    return;
  }
  S.money -= a.cost || 0;
  if (a.id === 'dance') game.player.roach.dancing = true;
  if (a.dur) await busyFor(`${a.label.split(' (')[0]} 중...`, actionMs(a.dur));
  game.player.roach.dancing = false;
  if (a.fx) addNeeds(a.fx);
  if (a.heal) game.net.send({ t: 'heal', v: a.heal });
  if (a.earn) { S.money += a.earn; ui.toast(`📺 출연료 ₩${a.earn}을 받았어요!`); }
  ui.toast(`${a.label} 완료!`);
}

// ------------------------------------------------------------------
// 음식: 먹고 가기 / 포장
// ------------------------------------------------------------------
const EAT_WORDS = { bite: ['냠냠', '와앙', '쩝쩝'], slurp: ['후루룩', '호로록', '쓰읍'], spoon: ['후~ 후~', '냠', '캬~'], drink: ['꿀꺽', '벌컥벌컥', '캬'], slice: ['쭈욱~', '냠냠', '치즈 늘어난다~'], drumstick: ['바삭!', '와구와구', '냠냠'] };
async function eatFood(id, secs, seated) {
  const onTable = seated && game.mode === 'interior';
  const d = itemDef(id);
  const [motion, prop] = d.eat || ['bite', 'bun:#ffcc80'];
  const roach = game.player.roach;
  game.eating = true;
  roach.eat(motion, prop, secs, d.emoji, onTable);
  game.net.send({ t: 'fx', k: 'eat', m: motion, prop, d: secs, e: d.emoji, tb: onTable ? 1 : 0 });
  const words = EAT_WORDS[motion] || EAT_WORDS.bite;
  const head = () => game.player.pos.clone().add(new THREE.Vector3(0, 2.3, 0));
  for (let i = 0; i < Math.floor(secs / 0.9); i++) setTimeout(() => { if (game.eating) ui.floatText(head(), `${d.emoji} ${words[i % words.length]}`, '#ff8a65'); }, 300 + i * 900);
  await new Promise((r) => setTimeout(r, secs * 1000));
  game.eating = false;
  if (d.food) addNeeds(seated ? Object.fromEntries(Object.entries(d.food).map(([k, v]) => [k, Math.round(v * 1.2)])) : d.food);
  if (seated) addNeeds({ social: 4, fun: 3 });
  if (d.heal) game.net.send({ t: 'heal', v: d.heal });
  if (d.mana) game.mana = Math.min(game.maxMana, (game.mana || 0) + d.mana);
  roach.setEmotion('happy', 3);
  ui.toast(`${d.emoji} ${d.name} 맛있게 먹었어요!${d.heal ? ` (체력 +${d.heal})` : ''}${seated ? ' 🍽️ 매장 식사 보너스' : ''}`);
}

game.eatIn = async (id) => {
  const d = itemDef(id);
  if (game.eating) return;
  if (game.stats.money < d.price) { ui.toast('💸 돈이 부족해요!'); return; }
  game.stats.money -= d.price;
  ui.closeModal();
  // 비어 있는 자리로 가서 앉아 먹는다
  const I = game.interior, p = game.player;
  const taken = [...game.players.list.values()].filter((o) => o.loc === I.building.id).map((o) => o.pos);
  const seat = (I.seats || []).filter((st) => !taken.some((t) => t.distanceTo(st.p) < 0.8)).sort((a, b) => a.p.distanceTo(p.pos) - b.p.distanceTo(p.pos))[0];
  if (seat) { p.pos.copy(seat.p); p.heading = seat.face; p.snap = true; }
  p.cam.yaw = p.heading - 0.6; p.cam.dist = 5.2; p.cam.pitch = 0.2; // 얼굴이 보이게 앞쪽에서
  game.busy = true; clearKeys();
  await eatFood(id, 4.5, true);
  game.busy = false;
  game.questEvent('eatin');
};

game.takeout = (id) => {
  const d = itemDef(id);
  if (game.stats.money < d.price) { ui.toast('💸 돈이 부족해요!'); return false; }
  game.stats.money -= d.price;
  game.inv.add(id, 1);
  game.questEvent('takeout');
  ui.toast(`🥡 ${d.emoji} ${d.name} 포장 완료! 핫바에서 골라 클릭하면 어디서든 먹을 수 있어요`);
  return true;
};

// 상점 구매 (UI에서 호출)
game.buy = async (id) => {
  const d = itemDef(id);
  const S = game.stats;
  if (S.money < d.price) { ui.toast('💸 돈이 부족해요!'); return false; }
  if (d.cat === 'vehicle') return game.buyCar(d.vehicle, null, d.price);
  S.money -= d.price;
  game.questEvent('buy');
  const it = game.inv.add(id, d.cat === 'ammo' ? d.pack : d.stack && d.cat === 'throw' ? 3 : 1);
  if (d.slot && it && !game.stats.equip[d.slot]) game.inv.equip(it.uid);
  let gift = '';
  if (d.ammo) { const a = itemDef(d.ammo); game.inv.add(d.ammo, a.pack); gift = ` + ${a.name.replace(/ ×\d+$/, '')} ${a.pack}발 증정!`; }
  if (d.cat === 'rod') { game.inv.add('bait', 10); gift = ' + 🪱 미끼 10개 증정! 물을 바라보고 클릭하면 던져요'; }
  ui.toast(`${d.emoji} ${d.name}을(를) 샀어요!${gift}${d.slot ? ' (I키 가방에서 장착)' : ''}`);
  return true;
};

// 자동차 구매: 차 키를 받고 가게 앞에 배송
// 전리품 팔기
game.sell = (uid, n) => {
  const it = game.inv.find(uid);
  if (!it) return;
  const d = itemDef(it.id);
  const k = Math.min(n, it.n || 1);
  game.inv.remove(uid, k);
  game.stats.money += d.sell * k;
  ui.toast(`💰 ${d.emoji} ${d.name} ${k}개를 ₩${(d.sell * k).toLocaleString()}에 팔았어요`);
  game.sendProfile();
};

game.buyCar = async (kind, color, price) => {
  const S = game.stats;
  if (S.money < price) { ui.toast('💸 돈이 부족해요!'); return false; }
  S.money -= price;
  game.questEvent('buy');
  const it = { uid: Math.random().toString(36).slice(2, 10), id: 'car_key', n: 1, gems: [], car: { kind, color } };
  S.items.push(it);
  game.inv.changed();
  ui.closeModal();
  const b = game.interior.building;
  await exitBuilding();
  const pos = b.walk.clone().add(new THREE.Vector3(0, 0, b.dir * 3));
  game.net.send({ t: 'buyVehicle', kind, color, x: pos.x, z: pos.z, h: Math.PI / 2 });
  ui.lootBanner(`🔑 ${vehicleName(kind)} 출고!`, '가방(I)의 차 키를 핫바에서 쓰면 언제든 내 앞으로 불러요', SPORT_KINDS.includes(kind) ? '#ff1744' : '#42a5f5', '');
  return true;
};
// 차 키로 내 차 부르기
function summonCar(it) {
  const p = game.player;
  if (game.mode !== 'city' || p.inCar) { ui.toast('🔑 거리에서만 차를 부를 수 있어요'); return; }
  const side = new THREE.Vector3(Math.cos(p.heading), 0, -Math.sin(p.heading));
  const pos = p.pos.clone().addScaledVector(side, 3.2);
  game.net.send({ t: 'summonCar', kind: it.car.kind, color: it.car.color, x: pos.x, z: pos.z, h: p.heading });
  ui.toast(`🔑 ${vehicleName(it.car.kind)}을(를) 불렀어요! F로 타세요`);
}

// ------------------------------------------------------------------
// 놀이기구 타기 (젤리랜드)
// ------------------------------------------------------------------
function startRide(ride) {
  const p = game.player;
  if (p.mount) dismount(false);
  p.flying = false;
  game.riding = { ride, state: 'wait', seat: 0, t0: 0 };
  const T = game.park.now();
  if (!ride.boardable(T)) ui.toast(`${ride.emoji} 다음 차례를 기다려요… ${ride.wait(T)}초 (F: 그만두기)`);
}
function updateRide(dt) {
  const R = game.riding, p = game.player, ride = R.ride, T = game.park.now();
  if (game.mode !== 'city' || game.dead) { endRide(false); return; }
  if (R.state === 'wait') {
    if (!ride.boardable(T)) { p.roach.update(dt, 0, {}); return; }
    R.state = 'on'; R.t0 = T;
    R.seat = ride.pickSeat ? ride.pickSeat(T) : Math.floor(Math.random() * ride.seats);
    ui.toast(`${ride.emoji} ${ride.name} 출발! 꽉 잡아요~`);
    p.cam.yaw = 0;
  }
  if (ride.done(T, R.t0)) { endRide(true); game.questEvent('ride'); return; }
  const st = ride.seat(R.seat, T);
  p.pos.copy(st.pos);
  p.vy = 0; p.speed = 0; p.onGround = true;
  const root = p.roach.root;
  root.position.copy(st.pos);
  root.quaternion.copy(st.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.yaw || 0));
  p.heading = new THREE.Euler().setFromQuaternion(root.quaternion, 'YXZ').y;
  p.roach.setSeated(true); p.roach.riding = true; p.roach.pedal = 0;
  p.roach.update(dt, 0, { noCrawl: true });
  addNeeds({ fun: dt * (ride.fun || 2) });
  // 신나서 가끔 소리 지르기
  if ((R.yell = (R.yell || 0) - dt) <= 0) { R.yell = 4 + Math.random() * 5; if (ride.fun >= 4) ui.floatText(st.pos.clone().setY(st.pos.y + 2), ['꺄아아~!', '우와아!!', '살려줘~ 😆', '한 번 더!'][Math.floor(Math.random() * 4)], '#ff4081'); }
}
function endRide(say) {
  const R = game.riding, p = game.player;
  if (!R) return;
  game.riding = null;
  const st = R.ride.station;
  p.pos.set(st.x, game.city.groundY(st.x, st.z) + 0.05, st.z);
  p.roach.root.quaternion.identity(); p.roach.root.rotation.set(0, p.heading, 0);
  p.roach.setSeated(false); p.roach.riding = false;
  p.snap = true;
  if (say) ui.toast(R.state === 'on' ? `${R.ride.emoji} 재밌었다! 또 타요~` : `${R.ride.emoji} 줄에서 나왔어요`);
}

// ------------------------------------------------------------------
// 동물 포획 (Z 꾹 → 타이밍 맞춰 떼기) · 탈것
// ------------------------------------------------------------------
function startCapture() {
  if (!game.started || game.mode !== 'city' || game.catching || game.player.inCar || game.dead) return;
  const p = game.player;
  const a = game.animals.nearestCapturable(p.pos, 10);
  if (!a) {
    const any = game.animals.nearest(p.pos, 12);
    ui.toast(any && any.alive ? `${any.def.emoji} ${any.def.name}은(는) 아직 쌩쌩해요. 체력을 절반 아래로 깎으면 포획할 수 있어요` : '🪢 근처에 포획할 동물이 없어요 (10m 안)');
    return;
  }
  // 강한 동물일수록 바늘이 빠르고 초록칸이 좁다
  const hp = a.def.hp;
  game.catching = { a, t: 0, speed: 0.55 + hp / 900, zone: 0.25 + Math.random() * 0.5, width: Math.max(0.08, Math.min(0.3, 0.34 - hp / 4500)), needle: 0 };
  if (!game.rope) {
    game.rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#d7a86e' }));
    game.rope.frustumCulled = false; scene.add(game.rope);
  }
  game.rope.visible = true;
}
function updateCapture(dt) {
  const C = game.catching;
  if (!C) return;
  const p = game.player, a = C.a;
  if (!a.alive || a.gone || !a.visible || Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) > 16) { cancelCapture('🪢 동물이 너무 멀어졌어요'); return; }
  C.t += dt;
  C.needle = 0.5 - 0.5 * Math.cos(C.t * C.speed * Math.PI * 2);
  ui.captureMeter(C);
  const pa = game.rope.geometry.attributes.position;
  pa.setXYZ(0, p.pos.x, p.pos.y + 1.2 + (p.mount ? p.mount.ride.seat * p.mount.scale : 0), p.pos.z);
  pa.setXYZ(1, a.pos.x, a.pos.y + a.def.h * (a.mesh?.size || 1) * 0.7, a.pos.z);
  pa.needsUpdate = true;
}
function cancelCapture(msg) {
  game.catching = null; ui.captureMeter(null);
  if (game.rope) game.rope.visible = false;
  if (msg) ui.toast(msg);
}
function releaseCapture() {
  const C = game.catching;
  if (!C) return;
  const ok = Math.abs(C.needle - C.zone) <= C.width / 2;
  game.net.send({ t: 'capture', id: C.a.id, ok });
  cancelCapture(ok ? '🪢 휙! 밧줄을 던졌어요…' : null);
}
game.startCapture = startCapture; game.releaseCapture = releaseCapture; game.toggleMount = (k) => toggleMount(k); // 테스트용
game.test = { enterBuilding: (b) => enterBuilding(b), exitBuilding: () => exitBuilding(), toggleCar: () => toggleCar(), toggleFly: () => toggleFly(), interact: () => interact(), startRide: (r) => startRide(r), endRide: () => endRide(true), eatFood: (id) => eatFood(id, 1.5, false), dismount: () => dismount(true), mount: (k, v) => toggleMount(k, null, v) }; // 점검용

function toggleMount(kind, it, variantOf = null) {
  const p = game.player;
  if (p.mount?.kind === kind) { if (!p.mount.ride.fly) dismount(true); return; }
  if (game.mode !== 'city' || p.inCar) { ui.toast('🐾 탈것은 바깥에서만 탈 수 있어요'); return; }
  if (p.mount) dismount(false);
  const variant = variantOf ?? (it?.uid ? [...it.uid].reduce((s, ch) => s + ch.charCodeAt(0), 0) : 0);
  p.mount = makeMount(kind, variant);
  scene.add(p.mount.mesh.g);
  const d = ANIMALS[kind];
  ui.toast(p.mount.ride.fly ? `${d.emoji} ${d.name}에 올라탔어요! Space 두 번 = 날기 · 클릭 = 불 뿜기 · F = 내리기` : `${d.emoji} ${d.name}에 올라탔어요! Shift로 달리기 · F = 내리기`);
  sendState();
}
// 도시 말에 올라타기: 서버에 알리고(그동안 길에서는 사라진다) 바로 탄다
function rideSteed(a) {
  const p = game.player;
  if (p.mount || p.inCar) return;
  game.net.send({ t: 'rideSteed', id: a.id });
  toggleMount('horse', null, a.id); // 타기 전 그 말의 털색 그대로
  p.mountSteed = a.id; a.gone = true;
}
game.dismountForOdm = () => dismount(false);
function dismount(say) {
  const p = game.player;
  if (!p.mount) return;
  if (p.mountSteed != null) { game.net.send({ t: 'leaveSteed', id: p.mountSteed }); p.mountSteed = null; } // 내린 자리에 말을 둔다
  scene.remove(p.mount.mesh.g);
  if (say) ui.toast(`${p.mount.def.emoji} ${p.mount.def.name}에서 내렸어요`);
  p.mount = null;
  p.roach.setSeated(false); p.roach.riding = false;
  p.roach.root.scale.setScalar(p.roach.baseScale);
  sendState();
}

// ------------------------------------------------------------------
// 체포 → 경찰차 이송 → 교도소
// ------------------------------------------------------------------
async function goToJail(m) {
  const p = game.player;
  game.jail = { until: Date.now() + (m.secs + 5) * 1000, prison: m.prison };
  game.autoWalk = false; game.range = null;
  if (game.sleeping) stopSleeping(false);
  if (game.course) endCourse(false, null);
  if (ui.chatOpen()) ui.closeChat();
  ui.closeModal(); ui.closePhone();
  if (p.inCar) leaveCar(true);
  p.flying = false; p.flipped = false; game.flip = null; ui.flipHud(null);
  ui.lootBanner('🚔 체포되었습니다!', `사유: ${m.reason} · 경찰차로 교도소에 이송 중...`, '#1e88e5', '');
  sfx('cuffs');
  game.busy = true; clearKeys();
  if (game.mode === 'interior') await exitBuilding(true);
  // 경찰차에 태워 4초간 달린다
  const h = p.heading;
  const car = makeCarMesh('police', '#ffffff', ['#0f3c8c', '#0f3c8c']) // 젤리 모드에선 하늘색 젤리 경찰;
  const fake = { mesh: car, pos: p.pos.clone().add(new THREE.Vector3(Math.cos(h) * 2.5, 0, -Math.sin(h) * 2.5)), heading: h, kind: 'police' };
  // 앞자리에 경찰 젤리 둘 (경찰 모자), 나는 뒷자리
  const capMat = new THREE.MeshToonMaterial({ color: '#1a2f5c' }), badgeMat = new THREE.MeshToonMaterial({ color: '#ffd54f' });
  for (const cop of car.occ.slice(0, 2)) {
    cop.visible = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), capMat); cap.position.set(0, 0.6, 0.02); cop.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.16), capMat); brim.position.set(0, 0.55, 0.2); cop.add(brim);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), badgeMat); badge.position.set(0, 0.62, 0.22); cop.add(badge);
  }
  const backSeat = Math.min(3, car.seats.length - 1);
  fake.pos.y = game.city.groundY(fake.pos.x, fake.pos.z);
  scene.add(car.g);
  // 경광등만 번갈아 깜빡인다 (재질은 공유되므로 복사해서 바꾼다)
  const siren = (car.sirens || []).map((o) => { o.material = o.material.clone(); return o; });
  game.cutscene = {
    t: 0,
    update(dt) {
      this.t += dt;
      const sp = Math.min(14, this.t * 6);
      if (this.t > 1) { fake.pos.x += Math.sin(fake.heading) * sp * dt; fake.pos.z += Math.cos(fake.heading) * sp * dt; fake.pos.y = game.city.groundY(fake.pos.x, fake.pos.z); }
      car.g.position.copy(fake.pos); car.g.rotation.y = fake.heading;
      siren.forEach((o, i) => { o.material.emissiveIntensity = Math.floor(this.t * 6 + i) % 2 === 0 ? 1.4 : 0.08; });
      loop('siren', this.t < 3.6 ? 0.8 : 0);
      p.pos.copy(fake.pos);
      seatRoach(p.roach, fake, backSeat); p.roach.update(dt, 0, {});
    },
  };
  await new Promise((r) => setTimeout(r, 4200));
  game.cutscene = null;
  scene.remove(car.g);
  unseatRoach(p.roach);
  await enterBuilding(game.city.buildings[m.prison], { jail: true });
  game.busy = false;
  ui.toast('🔒 감방에 들어왔어요. 60초 뒤에 석방돼요');
}
async function releaseFromJail() {
  if (!game.jail) return;
  game.jail = null;
  ui.jailHud(null);
  if (game.mode === 'interior' && game.interior.building.type === 'prison') await exitBuilding();
  ui.lootBanner('🔓 석방!', '이제 착하게 살아요 🙏', '#43a047', '');
}

// ------------------------------------------------------------------
// TV 보기 (채널 바꾸기)
// ------------------------------------------------------------------
function tvInfo() {
  const h = game.hour();
  return {
    headline: game.news?.[0] ? `속보: ${game.news[0].slice(0, 34)}` : `${game.players.list.size + 1}명이 젤리시티에서 생활 중`,
    ticker: [`오늘 날씨 ${game.weather}`, ...(game.news || []).slice(1, 5), '설탕 값 대폭락 🎉', '무릉도장 신규 수련생 모집 🥋'].join('   ·   '),
    weather: game.weather, temp: Math.round(18 + Math.sin(((h - 9) / 24) * Math.PI * 2) * 6), newsEmoji: game.stars ? '🚓' : '🏙️',
  };
}
function watchTV() {
  const tv = game.tvs?.[0];
  if (!tv) return;
  game.watchingTV = true;
  const p = game.player;
  const sp = tv.mesh.getWorldPosition(new THREE.Vector3());
  p.heading = Math.atan2(sp.x - p.pos.x, sp.z - p.pos.z);
  p.cam.yaw = p.heading + Math.PI; p.cam.dist = 4.5; p.cam.pitch = 0.18;
  ui.tvRemote(CHANNELS[tv.ch], { prev: () => switchTV(-1), next: () => switchTV(1), power: () => { tv.on = !tv.on; }, close: stopTV });
}
function switchTV(d) {
  const tv = game.tvs?.[0];
  if (!tv) return;
  tv.setChannel(tv.ch + d); game.tvChannel = tv.ch; tv.on = true;
  for (const o of game.tvs.slice(1)) if (!o.mesh.userData.tv || o.mesh.userData.tv === true) o.setChannel(tv.ch);
  ui.tvRemote(CHANNELS[tv.ch]);
}
function stopTV() { if (!game.watchingTV) return; game.watchingTV = false; ui.tvRemote(null); }
game.switchTV = switchTV;
game.useSelected = (down) => useSelected(down); // 테스트용

// 차로 들이받은 가로등·나무 (c: 도시, w: 야생)
// 발 밑 재질: 실내 바닥 · 도시 길 · 들판 풀 · 산꼭대기 눈 · 얕은 물
function surfaceAt(pos) {
  if (game.mode === 'interior') return 'floor';
  if (pos.y < WATER_Y + 0.35) return 'water';
  if (Math.abs(pos.x) < HALF + 5 && Math.abs(pos.z) < HALF + 5) return 'road';
  return regionAt(pos.x, pos.z)?.id === 'mountain' && pos.y > 28 ? 'snow' : 'grass';
}
// 발소리: 나는 또렷하게, 다른 플레이어·시민은 가까이(25m) 있을 때 작게 (한꺼번에 너무 많이 울리지 않게)
const stepPos = new THREE.Vector3();
Roach.onStep = (r, speed) => {
  if (!game.started || !game.player) return;
  const p = game.player;
  if (r === p.roach) {
    if (!p.onGround || p.swimming || p.flying || p.inCar || p.mount || p.climb) return;
    sfx('step', null, { surface: surfaceAt(p.pos), run: speed > 7 }, 0.6);
    return;
  }
  const now = performance.now();
  if (r.titan) {
    r.root.getWorldPosition(stepPos);
    const d = stepPos.distanceTo(p.pos);
    sfx('stomp', stepPos, r.root.scale.x);
    if (d < 70) game.shake(Math.max(0, 0.5 - d / 140));
    return;
  }
  if (now - (game.stepT || 0) < 70) return;
  r.root.getWorldPosition(stepPos);
  if (stepPos.distanceTo(p.pos) > 25) return;
  game.stepT = now;
  sfx('step', stepPos, { surface: surfaceAt(stepPos), run: speed > 7 }, 0.4);
};
// 날기(바람 + 날갯짓) · 헤엄(찰방)
function updateMoveSounds(dt) {
  const p = game.player;
  const fly = p.flying && !p.inCar && !game.dead;
  const sp = fly ? Math.min(1, (p.speed || 0) / 19) : 0;
  loop('wind', fly ? 0.25 + 0.75 * sp : 0);
  if (fly) {
    game.flapT = (game.flapT || 0) - dt;
    // 올라갈 때·빨리 날 때 더 자주 퍼덕인다
    if (game.flapT <= 0) { game.flapT = p.vy > 1 ? 0.22 : 0.45 - sp * 0.15; sfx('flap', null, p.vy > 1 ? 1 : 0.4); }
  }
  if (p.swimming && (p.speed || 0) > 0.5 && !p.inCar) {
    game.strokeT = (game.strokeT || 0) - dt;
    if (game.strokeT <= 0) { game.strokeT = 0.55; sfx('stroke'); }
  }
}
// 수배 중이면 가까운 경찰·군인 쪽에서 사이렌, 헬기는 두두두
function updateUnitSounds() {
  if (game.cutscene) return;
  let cop = null, cd = 1e9, heli = null, hd = 1e9;
  const me = game.player.pos;
  for (const u of game.units.list.values()) {
    if (!u.visible) continue;
    const d = u.pos.distanceTo(me);
    if (u.kind === 'heli') { if (d < hd) { hd = d; heli = u; } } else if (d < cd) { cd = d; cop = u; }
  }
  loop('siren', game.stars > 0 && cop ? 0.7 : 0, cop?.pos, 170);
  loop('heli', heli ? 0.9 : 0, heli?.pos, 200);
}
function smashProp(key, dir, broken, sound = false) {
  if (!key || !game.city) return;
  const props = key[0] === 'c' ? game.city.props : game.wild?.props;
  const pr = props?.list[+key.slice(1)];
  // 우지끈(나무) · 쨍그랑(가로등): 실제로 새로 부러질 때만
  if (sound && broken && pr && !pr.broken) sfx(pr.type === 'lamp' ? 'lamp' : 'tree', pr);
  props?.setBroken(+key.slice(1), broken, dir || [1, 0]);
}
// 지금 위치 근처의 충돌 상자 (도시 + 숲 나무)
function wildColliders(pos) {
  if (Math.abs(pos.x) < HALF - 20 && Math.abs(pos.z) < HALF - 20) return game.city.colliders;
  return game.city.colliders.concat(game.wild.near(pos.x, pos.z, 6));
}

// ------------------------------------------------------------------
// 레벨 · 경험치 · 퀘스트
// ------------------------------------------------------------------
function gainExp(v, reason = '') {
  const S = game.stats;
  const before = S.level || 1;
  const ups = addExp(S, v);
  ui.xpPop(`+${Math.round(v)} EXP${reason ? ' · ' + reason : ''}`);
  if (ups) {
    const ls = levelStats(S.level);
    game.maxMana = ls.mana;
    ui.celebrate(`⬆️ 레벨 업! Lv.${before} → Lv.${S.level}`, `체력 ${ls.maxHp} · 파워 ×${ls.dmg.toFixed(2)} · 명중률 +${Math.round((1 - ls.acc) * 100)}%`);
    game.combat.fx.sparkle(game.player.pos.clone(), '#ffd54f', 30, 2.5);
    game.net.send({ t: 'fx', k: 'sparkle', p: [game.player.pos.x, game.player.pos.y, game.player.pos.z], c: '#ffd54f' });
    game.sendProfile();
  }
  ui.renderXp?.();
}
game.gainExp = gainExp;

function ensureQuests() {
  const S = game.stats;
  const day = game.day();
  if (S.quests?.day === day) return;
  S.quests = { day, list: dailyQuests(day, game.token || '').map((id) => ({ id, p: 0, done: false })) };
  ui.renderQuests?.();
}
game.questEvent = (ev, n = 1) => {
  if (!game.stats?.quests) return;
  for (const q of game.stats.quests.list) {
    const d = questDef(q.id);
    if (!d || q.done || d.ev !== ev) continue;
    q.p = d.max ? Math.max(q.p, n) : q.p + n;
    if (q.p >= d.n) {
      q.done = true; q.p = d.n;
      game.stats.money += d.money;
      ui.lootBanner(`📋 퀘스트 완료! ${d.text}`, `+${d.xp} EXP · ₩${d.money}`, '#7e57c2', '');
      gainExp(d.xp);
    }
  }
  ui.renderQuests?.();
};

// 훈장: 이름표 아래에 보이는 자랑거리 (유저가 고른 것만 보여준다)
const won = (v) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${Math.floor(v / 1e4)}만` : `${Math.floor(v)}`);
function allBadges() {
  const S = game.stats, out = [];
  out.push({ key: 'money', text: `💰재산 ₩${won(S.money)}` });
  if (S.wantedCount) out.push({ key: 'wanted', text: `🚨수배 ${S.wantedCount}번` });
  if (S.hunted) out.push({ key: 'hunted', text: `🏹사냥 ${S.hunted}마리` });
  out.push({ key: 'level', text: `⭐레벨 ${S.level || 1}` });
  const legend = new Set(DROP_POOL.legendary || []);
  const legends = S.items.filter((it) => legend.has(it.id) && !it.expiresAt).length;
  if (legends) out.push({ key: 'legend', text: `🌟전설무기 ${legends}개` });
  const keys = S.items.filter((it) => it.id === 'car_key');
  const cnt = (k) => keys.filter((it) => it.car?.kind === k).length;
  if (cnt('sport_f')) out.push({ key: 'ferrari', text: `🐎풰라리 ${cnt('sport_f')}대` });
  if (cnt('sport_l')) out.push({ key: 'lambo', text: `🐂람부르기니${cnt('sport_l') > 1 ? ' ' + cnt('sport_l') + '대' : ''}` });
  if (cnt('sport_b')) out.push({ key: 'bugatti', text: '💎부가디' });
  if (cnt('sport_m') || cnt('sport_p')) out.push({ key: 'sports', text: `🏁스포츠카 ${cnt('sport_m') + cnt('sport_p')}대` });
  const bikes = keys.filter((it) => BIKES[it.car?.kind]).length;
  if (keys.length - bikes) out.push({ key: 'cars', text: `🚗자동차 ${keys.length - bikes}대` });
  if (bikes) out.push({ key: 'bike', text: `🏍️바이크 ${bikes}대` });
  const types = new Set(game.myHomes.map((h) => game.city.buildings[h.bid]?.type));
  if (types.has('house')) out.push({ key: 'house', text: '🏡개인주택' });
  if (types.has('apartment')) out.push({ key: 'apt', text: '🏢아파트' });
  if (types.has('villa')) out.push({ key: 'villa', text: '🏘️빌라' });
  if (game.myHomes.length > 1) out.push({ key: 'homes', text: `🏘️집 ${game.myHomes.length}채` });
  if (S.skills.includes('jump3')) out.push({ key: 'dojang', text: '🥋무릉고수' });
  if ((S.rangeBest || 0) >= 800) out.push({ key: 'sniper', text: '🎯명사수' });
  if (S.captured) out.push({ key: 'captured', text: `🪢포획 ${S.captured}마리` });
  if (S.items.some((it) => it.id === 'mount_dragon')) out.push({ key: 'dragon', text: '🐉드래곤 라이더' });
  if (S.items.some((it) => it.id === 'deer_trophy')) out.push({ key: 'trophy', text: '🦌사슴 트로피' });
  return out;
}
game.allBadges = allBadges;
function computeBadges() {
  const all = allBadges();
  const sel = game.stats.badgeSel; // 없으면 기본: 재산 빼고 앞에서 5개
  const list = sel ? all.filter((b) => sel.includes(b.key)) : all.filter((b) => b.key !== 'money' && b.key !== 'level').slice(0, 5);
  return list.slice(0, 8).map((b) => b.text);
}

// ------------------------------------------------------------------
// 날기 · 1인칭 · 플러팅 · 뒤집힘
// ------------------------------------------------------------------
function toggleFly() {
  if (game.player.odm) return;
  const p = game.player;
  if (p.inCar) return;
  if (game.jail && !p.flying) { ui.toast('🔒 감옥 안에서는 날 수 없어요'); return; }
  if (!p.flying && game.odm?.has() && !p.mount?.ride.fly) { ui.toast('🪝 젤리병단 장비를 든 동안엔 날개로 못 날아요 — 우클릭 갈고리로 날아요!'); return; }
  if (p.mount && !p.mount.ride.fly) { ui.toast(`${p.mount.def.emoji} ${p.mount.def.name}은(는) 날 수 없어요. F로 내려서 날아요`); return; }
  if (p.flying) { p.flying = false; p.vy = 0; p.onGround = false; p.jumps = p.maxJumps; ui.toast('🪽 날개를 접었어요 — 떨어진다!'); return; }
  if (p.takeOff()) ui.toast('🪽 날기! Space 꾹 위로 · X 아래로 · Shift 빠르게 · Space 두 번 = 날개 접기');
}
function toggleView() {
  const p = game.player;
  p.fp = !p.fp;
  if (p.fp) p.cam.pitch = 0;
  ui.toast(p.fp ? '👀 1인칭 시점 (V로 되돌리기)' : '🎥 3인칭 시점');
}
function flirt() {
  const p = game.player;
  if (p.inCar || game.dead) return;
  if (performance.now() - (game.lastFlirt || 0) < 2000) return;
  game.lastFlirt = performance.now();
  // 바라보는 방향의 가장 가까운 상대
  const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  let best = null, bd = 9;
  for (const t of game.combat.targets()) {
    if (t.tt !== 'npc' && t.tt !== 'player') continue;
    const v = t.base.clone().sub(p.pos); v.y = 0;
    const d = v.length();
    if (d < bd && v.normalize().dot(fwd) > 0.3) { bd = d; best = t; }
  }
  p.roach.flirt();
  const a = p.pos.clone();
  game.combat.fx.hearts(a, best ? best.base.clone() : null);
  game.net.send({ t: 'flirt', tt: best?.tt || 'none', id: best?.id ?? -1 });
  game.questEvent('flirt');
}
function mashFlip(side) {
  const f = game.flip;
  if (!f || side === f.last) return;
  f.last = side; f.n++;
  game.player.roach.jumpSquash = 0.6;
  if (f.n >= f.need) {
    game.flip = null;
    game.player.flipped = false;
    game.player.vy = 5; game.player.onGround = false;
    ui.flipHud(null);
    ui.toast('💪 영차! 다시 일어났어요');
  } else ui.flipHud(f.n, f.need);
}

game.enchant = (itemUid, gemUid) => {
  const S = game.stats;
  const it = game.inv.find(itemUid), gem = game.inv.find(gemUid);
  if (!it || !gem) return;
  const d = itemDef(it.id);
  if ((it.gems || []).length >= (d.sockets || 0)) { ui.toast('빈 보석 칸이 없어요'); return; }
  if (S.money < ENCHANT_FEE) { ui.toast('💸 인챈트 비용이 부족해요'); return; }
  S.money -= ENCHANT_FEE;
  (it.gems ||= []).push(itemDef(gem.id).gem);
  game.inv.consume(gemUid);
  game.inv.changed();
  ui.toast(`✨ ${d.name}에 ${itemDef(gem.id).name}을(를) 박았어요!`);
};

game.setLook = (look) => {
  game.profile.look = look;
  game.player.setColor(game.profile.color);
  game.inv.lastKey = null;
  game.inv.changed();
  game.sendProfile();
};

game.setBodyColor = (color) => {
  game.player.setColor(color);
  game.inv.lastKey = null;
  game.inv.changed();
  game.sendProfile();
};

game.buyHouse = (b, unit) => {
  const price = housePrice(b, unit);
  if (game.stats.money < price) { ui.toast(`💸 ₩${price.toLocaleString()}이 필요해요`); return; }
  game.net.send({ t: 'buyHouse', id: b.id, unit });
};
game.sellHouse = (bid, unit) => game.net.send({ t: 'sellHouse', id: bid, unit });
game.setMainHome = (bid, unit) => game.net.send({ t: 'setHome', id: bid, unit });

// ------------------------------------------------------------------
// 사격 연습장
// ------------------------------------------------------------------
function startRange() {
  const w = game.combat.selectedWeapon();
  const d = w ? itemDef(w.id) : null;
  if (!d || !['gun', 'launcher', 'wand'].includes(d.cat)) { ui.toast('🔫 총·활·마법봉을 핫바에서 골라 들고 시작하세요 (연습용 총 빌리기도 있어요)'); return; }
  game.range = { score: 0, hits: 0, left: 60 };
  for (const t of game.interior.targets) { t.up = 1; t.downT = 0; }
  ui.toast('🎯 60초 사격 시작!');
}
function updateRange(dt) {
  const R = game.range;
  if (!R) return;
  if (game.mode !== 'interior' || game.interior.building.type !== 'range') { game.range = null; ui.rangeHud(null); return; }
  R.left -= dt;
  ui.rangeHud(`🎯 점수 <b>${R.score}</b> · 명중 ${R.hits} · ⏱️ ${Math.max(0, R.left).toFixed(1)}초`);
  if (R.left <= 0) {
    game.range = null;
    ui.rangeHud(null);
    const best = Math.max(game.stats.rangeBest || 0, R.score);
    const isBest = R.score > (game.stats.rangeBest || 0);
    game.stats.rangeBest = best;
    ui.celebrate(`🎯 사격 종료! ${R.score}점`, `명중 ${R.hits}발 · 최고 기록 ${best}점${isBest ? ' 🏆 신기록!' : ''}`);
    gainExp(Math.round(R.score / 4), '사격 연습');
    game.questEvent('range', R.score);
    game.sendProfile();
  }
}
game.hitRangeTarget = (t, point) => {
  if (!t.up) return;
  const c = t.obj.getWorldPosition(new THREE.Vector3()); c.y = t.y0;
  const d = point ? Math.hypot(point.x - c.x, point.y - c.y) / t.r : 0.6;
  const pts = d < 0.22 ? 100 : d < 0.5 ? 50 : 25;
  const bonus = Math.round(t.speed * 10);
  t.up = 0; t.downT = 1.6;
  if (!game.range) { ui.scorePop(`${pts === 100 ? '🎯 정중앙!' : '명중!'} (연습)`, '#fff'); return; }
  game.range.score += pts + bonus; game.range.hits++;
  ui.scorePop(pts === 100 ? `🎯 BULLSEYE +${pts + bonus}` : `+${pts + bonus}`, pts === 100 ? '#ffd54f' : '#fff');
};

// ------------------------------------------------------------------
// 낚시: 물가에서 낚싯대 사용 → 기다리다 "입질!" 때 클릭
// ------------------------------------------------------------------
function fishAction(rod) {
  const F = game.fishing, p = game.player;
  if (F) {
    if (F.state === 'bite') {
      const ok = Math.random() < rod.rodLuck;
      endFishing();
      if (!ok) { ui.toast('💨 앗! 줄이 끊어졌어요... 다시 던져봐요'); return; }
      catchFish(rod, F.sea);
    } else { endFishing(); ui.toast('🎣 낚싯줄을 감았어요'); }
    return;
  }
  if (game.mode !== 'city' || p.inCar || p.flying) { ui.toast('🎣 물가에서 써요 (젤리 낚시터, 호수, 강, 바다)'); return; }
  if (game.inv.count('bait') <= 0) { ui.toast('🪱 미끼가 없어요! 낚시용품점에서 지렁이 미끼를 사세요'); return; }
  // 바라보는 방향의 물 찾기
  let spot = null;
  for (let d = 2.5; d <= 12; d += 0.5) {
    const x = p.pos.x + Math.sin(p.heading) * d, z = p.pos.z + Math.cos(p.heading) * d;
    if (game.city.groundY(x, z, -50) < WATER_Y - 0.35) { spot = new THREE.Vector3(x, WATER_Y, z); break; }
  }
  if (!spot) { ui.toast('🌊 물을 바라보고 던져야 해요! 물가에 가까이 가세요'); return; }
  game.inv.consumeId('bait', 1);
  const bob = new THREE.Group();
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#ff1744' }));
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#ffffff' }));
  bob.add(red, white); bob.position.copy(spot); scene.add(bob);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.pos, spot]), new THREE.LineBasicMaterial({ color: '#eeeeee' }));
  scene.add(line);
  game.fishing = { state: 'wait', t: 3 + Math.random() * 7, bob, line, spot, from: p.pos.clone(), sea: spot.x > 290 };
  p.roach.attack('throw');
  ui.toast('🎣 휙~ 찌가 물 위에 떴어요. 입질을 기다려요...');
}
function updateFishing(dt) {
  const F = game.fishing;
  if (!F) return;
  const p = game.player;
  if (p.pos.distanceTo(F.from) > 4 || game.mode !== 'city' || p.inCar) { endFishing(); ui.toast('🎣 자리를 떠서 낚시를 그만뒀어요'); return; }
  F.t -= dt;
  const now = performance.now() / 1000;
  if (F.state === 'wait') {
    F.bob.position.y = WATER_Y + Math.sin(now * 3) * 0.04;
    if (F.t <= 0) { F.state = 'bite'; F.t = 1.4; ui.scorePop('❗ 입질! 지금 클릭!', '#ffd54f'); game.shake(0.15); p.roach.reel = true; }
  } else if (F.state === 'bite') {
    F.bob.position.y = WATER_Y - 0.15 + Math.sin(now * 25) * 0.12;
    if (F.t <= 0) { endFishing(); ui.toast('🐟 물고기가 미끼만 먹고 도망갔어요!'); }
  }
  const tip = p.roach.rodTip ? p.roach.rodTip.getWorldPosition(new THREE.Vector3()) : p.pos.clone().setY(p.pos.y + 2);
  F.line.geometry.setFromPoints([tip, F.bob.position]);
}
function endFishing() {
  const F = game.fishing;
  if (!F) return;
  scene.remove(F.bob); scene.remove(F.line); F.line.geometry.dispose();
  game.player.roach.reel = false;
  game.fishing = null;
}
function catchFish(rod, sea) {
  if (Math.random() < 0.04) { game.inv.add('fish_boot', 1); ui.toast('🥾 ...낡은 장화를 낚았어요'); return; }
  const pool = FISH.filter((f) => f[8] === (sea ? 'sea' : 'fresh') && f[7] <= rod.tier);
  const total = pool.reduce((a, f) => a + f[3], 0);
  let r = Math.random() * total, pick = pool[0];
  for (const f of pool) { r -= f[3]; if (r <= 0) { pick = f; break; } }
  const [id, name, emoji, w, sell, raw, spicy] = pick;
  const cm = Math.round((id === 'shark' ? 180 : id === 'tuna' ? 120 : 20) * (0.7 + Math.random() * 0.8));
  game.inv.add('fish_' + id, 1);
  const rare = w <= 2 ? '#ff1744' : w <= 5 ? '#ffab00' : '#29b6f6';
  ui.lootBanner(`${emoji} ${name} ${cm}cm 낚았다!`, `판매가 ₩${sell.toLocaleString()} · ${id === 'shark' ? '상어는 먹을 수 없어요 (팔기만)' : [raw && '회 가능', spicy && '매운탕 가능'].filter(Boolean).join(' · ') || '팔거나 보관'}`, rare, '');
  game.combat.fx.sparkle(game.player.pos.clone().setY(game.player.pos.y + 1), '#4fc3f7', 16, 2);
  gainExp(Math.round(10 + sell / 25), '낚시');
  game.questEvent('fish');
  game.stats.fishCaught = (game.stats.fishCaught || 0) + 1;
}
// 매운탕·횟집에서 잡아온 물고기 요리
game.cookFish = async (uid, kind, eatNow) => {
  const it = game.inv.find(uid);
  if (!it) return;
  const d = itemDef(it.id);
  const fee = kind === 'spicy' ? 10 : 8;
  if (game.stats.money < fee) { ui.toast('💸 수고비가 부족해요'); return; }
  game.stats.money -= fee;
  game.inv.remove(uid, 1);
  const dish = kind === 'spicy' ? 'maeuntang' : 'sashimi';
  ui.toast(`${kind === 'spicy' ? '🍲' : '🍣'} 사장님이 ${d.name}${kind === 'spicy' ? ' 매운탕을 보글보글 끓였어요!' : '을 슥슥 회 떴어요!'}`);
  if (eatNow) { ui.closeModal(); await game.eatIn(dish); }
  else { game.inv.add(dish, 1); ui.toast('🥡 포장해서 가방에 넣었어요'); }
};

// ------------------------------------------------------------------
// 사진 찍기 (렌더 직후 캔버스를 저장)
// ------------------------------------------------------------------
game.takePhoto = () => new Promise((resolve) => {
  if (!game.started || !game.session) { resolve(null); return; }
  game.capture = async (dataUrl) => {
    ui.shutter();
    try {
      const r = await fetch('/api/photo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${game.session}` }, body: JSON.stringify({ char: game.char, data: dataUrl }) });
      if (!r.ok) throw new Error((await r.json()).error);
      ui.toast('📷 찰칵! 갤러리에 저장했어요 (Tab → 🖼️ 갤러리)');
      game.questEvent('photo');
    } catch (e) { ui.toast(`📷 사진 저장 실패: ${e.message}`); }
    resolve(true);
  };
});
// 셀카: 카메라를 얼굴 앞으로 돌리고 찍는다
game.selfie = () => {
  const p = game.player;
  const prev = { yaw: p.cam.yaw, dist: p.cam.dist, pitch: p.cam.pitch, fp: p.fp };
  p.fp = false; p.cam.yaw = p.heading; p.cam.dist = 3.6; p.cam.pitch = 0.15;
  p.roach.setEmotion('happy', 3); p.roach.wave();
  setTimeout(() => game.takePhoto().finally(() => Object.assign(p.cam, { yaw: prev.yaw, dist: prev.dist, pitch: prev.pitch }) && (p.fp = prev.fp)), 700);
};
function grabCanvas() {
  const W = 1280, H = Math.round((canvas.height / canvas.width) * W);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(canvas, 0, 0, W, H);
  // 워터마크
  x.font = 'bold 22px sans-serif'; x.fillStyle = 'rgba(255,255,255,.85)'; x.shadowColor = '#000'; x.shadowBlur = 4;
  x.fillText(cityText(`${brand.bug ? '🪳' : '🐻'} 젤리시티 · ${game.profile.name} · ${DAYS[game.day() % 7]}요일`), 18, H - 20);
  return c.toDataURL('image/jpeg', 0.82);
}

// ------------------------------------------------------------------
// 무릉도장 수련
// ------------------------------------------------------------------
function startCourse(id) {
  const c = game.interior.courses.find((x) => x.id === id);
  if (!c) return;
  if (c.require && !game.stats.skills.includes(c.require)) { ui.toast('🥋 사범: 먼저 2단 점프를 익히고 오너라!'); return; }
  if (game.stats.skills.includes(c.reward)) ui.toast(`이미 ${c.rewardName}을(를) 익혔어요. 연습 모드로 도전!`);
  game.course = { c, left: c.time, falls: 0 };
  resetToCourseStart();
  ui.toast(`🥋 ${c.name} 시작! ${c.time}초 안에 깃발까지 가세요${c.lavaCourse ? ' (용암 조심!)' : ''}`);
}
function resetToCourseStart() {
  const p = game.player;
  p.pos.copy(game.course.c.start); p.vy = 0; p.heading = Math.PI;
  p.cam.yaw = 0; p.snap = true;
}
function endCourse(success, msg) {
  const c = game.course?.c;
  game.course = null;
  ui.courseHud(null);
  if (!c) return;
  if (success) {
    if (!game.stats.skills.includes(c.reward)) {
      game.stats.skills.push(c.reward);
      applySkills();
      ui.celebrate(`🥋 ${c.rewardName}을(를) 전수받았어요!`, { dashlong: '이제 C키 대쉬가 훨씬 멀리 나가요', jumpboost: '점프가 더 높아졌어요', jump3: '공중에서 점프를 두 번 더! 3단 점프' }[c.reward] || '');
      gainExp(400, `${c.name} 첫 클리어`);
    } else { ui.toast(`🏁 ${c.name} 클리어!`); gainExp(60, `${c.name} 클리어`); }
  } else if (msg) ui.toast(`❌ ${msg}`);
}
function updateCourse(dt) {
  const C = game.course;
  if (!C) return;
  const p = game.player, c = C.c;
  C.left -= dt;
  ui.courseHud(`${c.name} · 남은 시간 ${Math.max(0, C.left).toFixed(1)}초 · 낙하 ${C.falls}회`);
  if (C.left <= 0) { endCourse(false, '시간 초과! 다시 도전해보세요'); return; }
  const onLava = game.interior.lava.some((l) => p.pos.x > l.minX && p.pos.x < l.maxX && p.pos.z > l.minZ && p.pos.z < l.maxZ) && p.pos.y < 0.35;
  const fell = p.pos.y < 0.2 && p.pos.z < c.safeZ;
  if (onLava || fell) { C.falls++; ui.toast(onLava ? '🔥 앗 뜨거! 처음부터 다시!' : '😵 떨어졌어요! 처음부터 다시!'); resetToCourseStart(); return; }
  if (Math.hypot(p.pos.x - c.goal.x, p.pos.z - c.goal.z) < 2 && p.pos.y >= c.goal.y - 0.3) endCourse(true);
}

// ------------------------------------------------------------------
// 잠
// ------------------------------------------------------------------
function startSleeping() {
  game.sleeping = true;
  game.questEvent('sleep');
  game.busy = true;
  clearKeys();
  game.net.send({ t: 'sleep', on: true });
  ui.showSleep(true);
}
function stopSleeping(morning) {
  if (!game.sleeping) return;
  game.sleeping = false;
  game.busy = false;
  game.net.send({ t: 'sleep', on: false });
  ui.showSleep(false);
  if (morning) addNeeds({ energy: 100, hunger: -10, hygiene: -10 });
}
game.wakeUp = () => stopSleeping(false);

function addNeeds(fx) {
  const N = game.stats.needs;
  for (const [k, v] of Object.entries(fx)) if (k in N) N[k] = clamp(N[k] + v, 0, 100);
}
game.addNeeds = addNeeds;

const DECAY = { hunger: 4.5, fun: 3, social: 2.5, hygiene: 2 }; // 에너지는 없앴어요 (언제든 달리고 날 수 있게)
function decayNeeds(mins) {
  const N = game.stats.needs;
  for (const k of Object.keys(DECAY)) N[k] = clamp(N[k] - (DECAY[k] * mins) / 60, 0, 100);
}
const warned = {};
const NEED_MSG = { hunger: '🍜 포만감이 바닥이에요! 식당이나 편의점에 가보세요', fun: '🎈 심심해요! 영화관이나 클럽은 어때요?', social: '💬 외로워요... 이웃과 대화해보세요', hygiene: '🚿 씻을 때가 됐어요 (집, 헬스장, 미용실)' };
function checkNeeds() {
  for (const [k, v] of Object.entries(game.stats.needs)) {
    if (v < 20 && !warned[k]) { warned[k] = true; ui.toast(NEED_MSG[k]); }
    if (v > 35) warned[k] = false;
  }
}
function checkNewDay() {
  const d = game.day();
  if (d !== game.lastDay) { game.lastDay = d; ui.toast(`📅 ${d + 1}일차 ${DAYS[d % 7]}요일이 밝았어요! 새 퀘스트가 생겼어요 📋`); ensureQuests(); }
}

game.takeJob = (job) => {
  const list = [...(game.city.byType[job.building] || [])];
  if (!list.length) return;
  const home = game.homeBuilding();
  list.sort((a, b) => a.door.distanceTo(home.door) - b.door.distanceTo(home.door));
  game.stats.jobId = job.id;
  game.stats.workId = list[0].id;
  ui.toast(`🎉 ${list[0].name}의 ${job.name}(으)로 취직했어요! 시급 ₩${job.wage}`);
  ui.toast('💼 직장에 가서 E 키로 일할 수 있어요');
  game.sendProfile();
  setWaypoint(list[0]);
};
game.quitJob = () => { game.stats.jobId = null; game.stats.workId = null; game.sendProfile(); ui.toast('직장을 그만뒀어요...'); };

// ------------------------------------------------------------------
// 목적지 & 자동 이동
// ------------------------------------------------------------------
function setWaypoint(target, label) {
  const isB = !!target.door;
  const pos = isB ? target.door.clone() : target.clone();
  game.waypoint = { pos, label: label || (isB ? target.name : '목적지'), building: isB ? target : null };
  updateRoute();
}
game.setWaypoint = setWaypoint;
function updateRoute() {
  if (!game.waypoint) { game.route = null; return; }
  const from = game.mode === 'interior' ? game.interior.building.door : game.player.pos;
  const to = game.waypoint.pos;
  const out = (v) => Math.abs(v.x) > HALF - 4 || Math.abs(v.z) > HALF - 4;
  // 도시 밖이 끼면: 가장 가까운 도시 출입구(사방 고속도로)를 거쳐 곧장
  const GATES = [new THREE.Vector3(0, 0, -HALF), new THREE.Vector3(0, 0, HALF), new THREE.Vector3(-HALF, 0, 0), new THREE.Vector3(HALF, 0, 0)];
  const gateNear = (v) => GATES.reduce((a, b) => (a.distanceTo(v) < b.distanceTo(v) ? a : b));
  if (out(from) && out(to)) game.route = [to.clone()];
  else if (out(to)) { const gate = gateNear(to); game.route = [...routeTo(from, { point: gate }, game.sim.blockers), to.clone()]; }
  else if (out(from)) { const gate = gateNear(from); game.route = [gate, ...routeTo(gate, game.waypoint.building || { point: to }, game.sim.blockers)]; }
  else game.route = routeTo(from, game.waypoint.building || { point: to }, game.sim.blockers);
  game.routeLen = routeLength(from, game.route);
}
// 1초마다: 길에서 벗어났거나 걷지 않을 때는 경로를 새로 계산
function refreshRoute() {
  const p = game.player.pos;
  if (!game.route?.length) { updateRoute(); return; }
  const next = game.route[0];
  if (!game.autoWalk || Math.hypot(next.x - p.x, next.z - p.z) > 9) updateRoute();
  else game.routeLen = routeLength(p, game.route);
  if (game.waypoint && game.waypoint.pos.distanceTo(p) < 3.5) {
    ui.toast(`📍 ${game.waypoint.label}에 도착했어요!`);
    game.waypoint = null; game.route = null; game.autoWalk = false;
  }
}
game.updateRoute = updateRoute;
function toggleAutoWalk() {
  if (!game.waypoint) { ui.toast('🗺️ 먼저 지도(M)에서 목적지를 찍어주세요'); return; }
  if (game.player.inCar || game.mode === 'interior') { ui.toast('🚶 거리에서만 자동으로 걸을 수 있어요'); return; }
  game.autoWalk = !game.autoWalk;
  if (game.autoWalk) { updateRoute(); ui.toast(`🚶 ${game.waypoint.label}(으)로 자동 이동! (R 또는 방향키로 멈춤)`); }
}
game.toggleAutoWalk = toggleAutoWalk;
function autoWalkDir() {
  if (!game.autoWalk || !game.route || game.mode !== 'city' || game.player.inCar) return null;
  const p = game.player.pos;
  while (game.route.length && Math.hypot(game.route[0].x - p.x, game.route[0].z - p.z) < 1.2) game.route.shift();
  if (!game.route.length) { game.autoWalk = false; ui.toast(`📍 ${game.waypoint.label}에 도착했어요!`); game.waypoint = null; game.route = null; return null; }
  const t = game.route[0];
  const d = new THREE.Vector3(t.x - p.x, 0, t.z - p.z).normalize();
  return d;
}

// ------------------------------------------------------------------
// NPC 대화
// ------------------------------------------------------------------
game.talk = (c, text, opts = {}) => game.net.send({ t: 'talk', npc: c.id, text, ...opts });
game.endTalk = (c) => game.net.send({ t: 'talkEnd', npc: c.id });
game.onTalkResult = (c, m) => {
  c.affinity = m.affinity;
  if (m.action === 'give_money' && m.amount > 0) { game.stats.money += m.amount; ui.toast(`💝 ${c.name}이(가) ₩${m.amount}를 줬어요!`); }
  addNeeds({ social: 5, fun: 1 });
};

// ------------------------------------------------------------------
// 메인 루프
// ------------------------------------------------------------------
const clock = new THREE.Clock();
const NO_INPUT = { forward: false, back: false, left: false, right: false, run: false, jump: false, jumpPressed: false, dashPressed: false, enabled: false };
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  game.frames = (game.frames || 0) + 1;
  if (!game.started) {
    if (game.spectating && game.city) spectateFrame(dt, t);
    return;
  }
  const gm = dt * game.timeSpeed;
  game.minutes += gm;
  decayNeeds(gm);
  if (game.sleeping) addNeeds({ energy: dt * 6 });
  checkNeeds();
  checkNewDay();
  game.mouseT = Math.max(0, (game.mouseT || 0) - dt);
  const p = game.player;
  const panel = ui.anyPanelOpen() || typing();
  // 지도만 열어 둔 채 자동 이동 중이면 계속 걸어간다
  const mapOnly = game.autoWalk && ui.modalKind === 'map' && !document.getElementById('modal').classList.contains('hidden') && document.getElementById('phone').classList.contains('hidden') && !typing();
  const blocked = (panel && !mapOnly) || game.busy || game.dead;
  const input = blocked ? NO_INPUT : game.input;
  input.enabled = !blocked;
  input.moveDir = blocked ? null : autoWalkDir();
  const indoor = game.mode === 'interior';
  const world = indoor
    ? { colliders: game.interior.colliders, climbable: false, groundY: () => 0.1, bounds: game.interior.bounds, npcs: game.sim.citizens, cameraColliders: null, platforms: game.interior.platforms, tired: false, ceiling: 4.2 }
    : { colliders: game.autoWalk ? wildColliders(p.pos).filter((c) => !c.small) : wildColliders(p.pos), platforms: game.city.roofs, groundY: game.city.groundY, npcs: game.sim.citizens, cameraColliders: game.city.colliders, tired: false, water: WATER_Y, bounds: { minX: -WORLD_HALF + 5, maxX: WORLD_HALF - 5, minZ: -WORLD_HALF + 5, maxZ: WORLD_HALF - 5 } };
  world.mouseActive = game.mouseT > 0;

  // 차량: 내 차는 직접 운전, 나머지는 서버 위치로 보간
  const k = Math.min(1, dt * 10);
  for (const car of game.traffic.cars) {
    if (car.bubble) { car.bubble.t -= dt; if (car.bubble.t <= 0) car.bubble = null; }
    if (car === p.inCar) {
      const near = indoor ? [] : game.wild.near(car.pos.x, car.pos.z, 10);
      game.traffic.updatePlayer(car, dt, {
        input, city: game.city, colliders: near.length ? game.city.colliders.concat(near) : game.city.colliders, groundY: game.city.groundY,
        onBump: () => { ui.toast('쿵! 💥'); sfx('crash', null, 0.5); },
        onWater: () => { if (performance.now() - (game.waterMsg || 0) > 3000) { game.waterMsg = performance.now(); ui.toast('🌊 차는 물에 못 들어가요! 대교로 건너세요'); } },
        onSmash: (c, dir) => { smashProp(c.pkey, dir, true, true); game.net.send({ t: 'smash', key: c.pkey, dir }); game.shake(0.25); },
      });
      if (car.kind === 'tank') car.turret = angleLerp(car.turret || 0, (p.cam.yaw + Math.PI) - car.heading, Math.min(1, dt * 6));
      continue;
    }
    const tg = car.target;
    if (!tg) continue;
    if (Math.hypot(tg.x - car.pos.x, tg.z - car.pos.z) > 10) car.pos.set(tg.x, tg.y, tg.z);
    car.pos.x += (tg.x - car.pos.x) * k; car.pos.z += (tg.z - car.pos.z) * k; car.pos.y = (car.pos.y || 0) + ((tg.y || 0) - (car.pos.y || 0)) * k;
    car.heading = angleLerp(car.heading, tg.h, k);
  }
  game.traffic.render(!indoor, camera.position, dt);

  // 반동 회복
  if (p.recoilBack > 0.0005) { const r = Math.min(p.recoilBack, dt * 0.6); p.cam.pitch += r; p.recoilBack -= r; }
  // 얼음 마법에 맞으면 느려짐
  if (game.slowT > 0) { game.slowT -= dt; p.speedBonus = -0.55; } else if (game.slowWas) game.sendProfile();
  game.slowWas = game.slowT > 0;
  const before = p.pos.clone();
  if (game.park && !indoor) game.park.update();
  if (game.riding) updateRide(dt);
  else if (game.cutscene) game.cutscene.update(dt);
  else if (!game.dead) p.update(dt, input, world);
  else p.roach.update(dt, 0, {});
  if (game.jail) {
    const left = Math.max(0, Math.ceil((game.jail.until - Date.now()) / 1000));
    ui.jailHud(left);
    // 어떤 경우에도 감방 밖으로 못 나가게 (벽·철창 콜라이더의 안전장치)
    const r = game.jail.cell;
    if (r && game.mode === 'interior') {
      p.pos.x = Math.min(r.maxX, Math.max(r.minX, p.pos.x)); p.pos.z = Math.min(r.maxZ, Math.max(r.minZ, p.pos.z));
      p.flying = false;
    }
    if (left <= 0 && Date.now() - game.jail.until > 4000) releaseFromJail();
  }
  // 이동 거리 퀘스트
  const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
  if (moved < 5) {
    game.distAcc = (game.distAcc || 0) + moved;
    if (game.distAcc >= 20) {
      const kind = p.inCar ? 'drive' : p.flying ? 'fly' : 'walk';
      game.questEvent(kind, Math.round(game.distAcc));
      game.distAcc = 0;
    }
  }
  // 날기는 에너지를 쓴다
  // 마나 재생
  if (game.maxMana) game.mana = Math.min(game.maxMana, (game.mana || 0) + dt * 7);
  // 우클릭 조준: 총·활·마법봉 줌 (저격총은 스코프)
  const selId = game.inv.selected()?.id || null; // 아이템 정의(selD)에는 id가 없다
  const selD = selId ? itemDef(selId) : null;
  const canZoom = !p.inCar && selD?.zoom && !blocked;
  p.aim += ((canZoom && game.aimHeld ? 1 : 0) - p.aim) * Math.min(1, dt * 10);
  p.adsFP = !!selD && ['gun', 'launcher'].includes(selD.cat); // 총·활은 우클릭하면 1인칭 조준
  p.odmHeld = !!selD?.odm; // 젤리병단 장비: 카메라를 조금 더 가까이
  const maxZoom = scopeZoomOf(selId) ?? selD?.zoom ?? 1;
  game.zoomNow = 1 + (maxZoom - 1) * p.aim;
  const fov = 55 / game.zoomNow;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  ui.setScope(selD?.zoom >= 4 && p.aim > 0.85, SCOPES[selId] ? maxZoom : null);
  // 광선검을 들고 있으면 웅웅 (꺼내는 순간 치이잉)
  const saber = !!selId?.startsWith('saber_') && !p.inCar && !game.dead && !game.busy;
  if (saber && game.heldSaber !== selId) sfx('saberOn');
  game.heldSaber = saber ? selId : null;
  loop('saber', saber ? 0.3 : 0);
  updateUnitSounds();
  updateMoveSounds(dt);
  updateShopMarkers(t);
  if (p.odm && (game.mode !== 'city' || game.dead || game.busy || game.jail)) { p.odm = null; game.odm.release(); } // 건물 안 · 쓰러짐 · 체포 땐 입체기동 끝
  if (p.flying && !p.mount && game.odm.has()) { p.flying = false; p.vy = 0; p.onGround = false; p.jumps = p.maxJumps; ui.toast('🪝 젤리병단 장비를 들면 날개를 접어요 — 우클릭 갈고리로 날아요!'); }
  game.titans.update(dt, game.odm.has());
  game.odm.update(dt);
  if (game.emoting) {
    const moving = input.forward || input.back || input.left || input.right || input.jumpPressed || input.dashPressed || input.moveDir;
    if (moving || !p.onGround || p.inCar || p.flying || p.mount || game.dead || game.busy || p.swimming) stopEmote();
    else if ((game.emoting.t += dt) < 1.2 && !p.fp) p.cam.yaw = angleLerp(p.cam.yaw, p.heading, Math.min(1, dt * 4)); // 포트나이트처럼 앞모습이 보이게
    if (game.emoting?.song && songSession?.owner === 'me' && p.roach.emote) p.roach.emote.beat = emoteSongBeat(game.emoting.song);
  }
  updateListenedSong();
  // 저격 조준 중에는 멀리 있는 시민·동물까지 그려서 맞힐 수 있게
  const far = game.zoomNow > 2.5;
  game.citizens.viewDist = far ? 130 * Math.min(4, game.zoomNow / 1.5) : 130;
  game.animals.viewDist = far ? 220 * Math.min(3, game.zoomNow / 2) : 220;
  if (p.inCar) { seatRoach(p.roach, p.inCar); p.roach.update(dt, 0, {}); }
  game.citizens.update(dt, camera.position, game.loc());
  game.animals.camQuat = camera.quaternion;
  game.animals.update(dt, camera.position, !indoor, p.pos);
  // 탈것: 건물·차·감옥·죽음이면 내린다
  if (p.mount && (indoor || p.inCar || game.dead || game.jail)) dismount(false);
  updateCapture(dt);
  if ((game.safeT = (game.safeT || 0) - dt) <= 0) { game.safeT = 0.4; ui.safeBadge(!game.dead && game.inSafeZone()); }
  if (!indoor) game.wild.update(camera.position);
  // 지역에 들어서면 알려준다
  if ((game.regionT = (game.regionT || 0) - dt) <= 0) {
    game.regionT = 1;
    const r = indoor ? null : regionAt(p.pos.x, p.pos.z);
    if ((r?.id || null) !== (game.region || null)) {
      game.region = r?.id || null;
      if (r) ui.lootBanner(`${r.emoji} ${r.name}`, { forest: '곰·늑대·사슴이 사는 숲 — 조심하세요!', swamp: '악어가 숨어 있어요 🐊', jungle: '호랑이 출몰 지역 🐯', amazon: '아나콘다와 재규어의 땅 🐍🐆', island: '대교 건너 평화로운 목장 마을', dragon: '🔥 불 뿜는 드래곤이 하늘을 지배하는 협곡! 체력을 절반 깎고 Z로 포획해 타 보세요', mountain: '젤리산 — 정상은 눈으로 덮여 있어요', valley: '맑은 강이 흐르는 계곡', meadow: '사슴과 토끼가 뛰노는 들판', sea: '' }[r.id] || '', '#43a047', '');
    }
  }
  game.players.update(dt, game.loc(), game.traffic);
  game.units.update(dt, game.loc(), game.city.groundY);
  game.ground.update(t, game.loc());
  game.runners.update(dt);
  game.routeView.update(game.mode === 'city' && !p.inCar ? game.route : null, p.pos, t);
  game.combat.update(dt);
  updateCourse(dt);
  updateRange(dt);
  updateFishing(dt);
  game.secT = (game.secT || 0) - dt;
  if (game.secT <= 0) {
    game.secT = 1;
    // 재산 훈장이 바뀌면 다시 알린다
    if (Math.floor(game.stats.money) !== game.lastMoneyBadge && (game.stats.badgeSel || []).includes('money')) { game.lastMoneyBadge = Math.floor(game.stats.money); if ((game.moneyBadgeT = (game.moneyBadgeT || 0) - 1) <= 0) { game.moneyBadgeT = 5; game.sendProfile(); } }
    for (const it of game.inv.expire()) {
      const d = itemDef(it.id);
      if (d.cat === 'ammo') continue;
      const shop = SHOPS[d.shop]?.title || '상점';
      const msg = `⌛ ${d.name}(${TEMP_MINUTES}분 제한) 사용 시간이 끝나 사라졌어요. 계속 쓰려면 ${shop}에서 ₩${d.price.toLocaleString()}에 구매하세요!`;
      ui.toast(msg); ui.addChatLine('sys', msg);
    }
    if (game.waypoint && game.mode === 'city' && !p.inCar) refreshRoute();
  }
  if (p.knock && p.knock.t > 0) { p.knock.t -= dt; p.pos.x += p.knock.x * dt; p.pos.z += p.knock.z * dt; p.collide(game.city.colliders); }
  if (game.myBubble) { game.myBubble.t -= dt; if (game.myBubble.t <= 0) game.myBubble = null; }
  if (game.bouncerSay) { game.bouncerSay.t -= dt; if (game.bouncerSay.t <= 0) game.bouncerSay = null; }
  const night = updateEnvironment(game.hour(), p.cam.target, dt);
  game.city.update(dt, t, night);
  windowGlow(night);
  if (game.interior) game.interior.update(dt, t, camera.position);
  if (game.tvs) for (const tv of game.tvs) tv.draw(t, dt);
  if (game.watchingTV) { addNeeds({ fun: dt * 1.6, social: dt * 0.2 }); if (input.forward || input.back || input.left || input.right) stopTV(); }
  p.updateCamera(camera, dt, world);
  if (game.shakeT > 0) {
    game.shakeT -= dt;
    camera.position.x += (Math.random() - 0.5) * game.shakeT * 1.2;
    camera.position.y += (Math.random() - 0.5) * game.shakeT * 1.2;
  }

  focus = blocked ? null : findFocus();
  ui.setPrompt(focus);
  ui.update(dt);
  renderer.render(scene, camera);
  if (game.capture) { const cb = game.capture; game.capture = null; cb(grabCanvas()); }
  game.input.jumpPressed = false;
  game.input.dashPressed = false;
}
// 관전 중: 시민·차량만 움직이고 카메라는 명소 투어
function spectateFrame(dt, t) {
  game.minutes += dt * game.timeSpeed;
  const k = Math.min(1, dt * 10);
  for (const car of game.traffic.cars) {
    const tg = car.target;
    if (!tg) continue;
    if (Math.hypot(tg.x - car.pos.x, tg.z - car.pos.z) > 10) car.pos.set(tg.x, tg.y, tg.z);
    car.pos.x += (tg.x - car.pos.x) * k; car.pos.z += (tg.z - car.pos.z) * k; car.pos.y = (car.pos.y || 0) + ((tg.y || 0) - (car.pos.y || 0)) * k;
    car.heading = angleLerp(car.heading, tg.h, k);
  }
  tourFrame(dt, t);
  game.wild.update(camera.position);
  game.traffic.render(true, camera.position, dt);
  game.runners?.update(dt);
  game.citizens.update(dt, camera.position, -1);
  game.players.update(dt, -1, game.traffic);
  game.units.update(dt, -1, game.city.groundY);
  game.titans.update(dt, false);
  game.ground.update(t, -1);
  game.combat.fx.update(dt);
  const night = updateEnvironment(game.hour(), camera.position, dt);
  game.city.update(dt, t, night);
  windowGlow(night);
  renderer.render(scene, camera);
}

let lastGlow = -1;
function windowGlow(night) {
  if (Math.abs(night - lastGlow) < 0.01) return;
  lastGlow = night;
  for (const m of Object.values(windowMaterials())) m.emissiveIntensity = night * 1.3;
}
requestAnimationFrame(frame);

game.applySettings = () => {
  renderer.shadowMap.enabled = settings.shadows;
  sun.castShadow = settings.shadows;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  saveSettings();
};
