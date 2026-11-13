// 젤리 아케이드: 격자 미로에 젤리 폭탄을 놓아 십자 물결로 상대를 젤리에 가두는 대전
//   혼자 하기: 이 화면에서 판(sim.js)과 젤리봇(bots.js)을 돌린다
//   같이 하기: 서버(server/jelly-arcade/rooms.js)가 같은 판을 돌려 사건을 보내고, 화면은 내 곰만 먼저 움직여 보여 준다
import '../../shared/js/renamed.js';
import * as THREE from 'three';
import { isPhone, autoRes } from '../../shared/js/perf.js';
import { Shell, esc, TEAMS } from '../../shared/js/shell.js';
import { account } from '../../shared/js/account.js';
import { Ranking, anonId } from '../../shared/js/ranking.js';
import { makeBear, poseBear } from '../../dream-runner/js/runner.js';
import * as G from './sim.js';
import { think, newBrain } from './bots.js';
import { Board, wx, wz, TOP, CELL, bombMesh, trapMesh, itemMesh, blobTex, THEMES } from './world.js';
import { sfx, setMusic, stopMusic, unlock, toggleMute, sound, hurry } from './sfx.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const touchMode = matchMedia('(pointer: coarse)').matches || Q.has('touch');
if (touchMode) document.body.classList.add('touch');
const BOT_NAMES = ['젤리봇 딸기', '젤리봇 소다', '젤리봇 레몬', '젤리봇 포도', '젤리봇 민트', '젤리봇 복숭아', '젤리봇 콜라', '젤리봇 메론'];
const BOT_COLORS = ['#ff6b8b', '#6ec6ff', '#ffd84d', '#9b6bff', '#5fe0b0', '#ffab91', '#c49a6c', '#b5e655'];
const MAP_LIST = [...G.MAP_IDS, 'random'];
const MAP_NAME = { ...Object.fromEntries(G.MAP_IDS.map((k) => [k, `${G.MAPS[k].emoji} ${G.MAPS[k].name}`])), random: '🎲 무작위' };

// ---------- 그리기 준비 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isPhone, powerPreference: 'high-performance' });
autoRes(renderer, 2);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 300);
const hemi = new THREE.HemisphereLight('#ffffff', '#c9a0ff', 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.0);
sun.position.set(-10, 26, 14); sun.castShadow = true;
sun.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 4, far: 70 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffd9f0', 0.45); fill.position.set(12, 8, -10); scene.add(fill);

let view = { tilt: 0 };
function fitCamera() {
  // 판 전체(울타리 포함)가 화면에 들어오도록 거리를 맞춘다
  //   세로 화면은 판을 옆으로 돌려 본다 (긴 쪽 13칸이 위아래로 → 칸이 더 크게 보인다)
  const asp = innerWidth / innerHeight, portrait = asp < 0.9;
  const pitch = portrait ? 1.08 : 0.86; // 수평에서 얼마나 내려다보나
  camera.fov = portrait ? 42 : 36; camera.aspect = asp; camera.updateProjectionMatrix();
  const look = portrait ? new THREE.Vector3(0.8, 0, 0) : new THREE.Vector3(0, 0, 1.0);
  const pts = []; const hw = (G.W * CELL) / 2 + 1.0, hd = (G.H * CELL) / 2 + 1.0;
  for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [0, 2.2]) pts.push(new THREE.Vector3(x, y, z));
  let d = 10;
  const topPad = touchMode ? 0.8 : 0.9, sidePad = 0.97, botPad = touchMode && portrait ? 0.6 : 0.94;
  for (; d < 160; d += 0.5) {
    const back = Math.cos(pitch) * d;
    camera.position.set(look.x + (portrait ? back : 0), look.y + Math.sin(pitch) * d, look.z + (portrait ? 0 : back)); camera.lookAt(look); camera.updateMatrixWorld();
    if (pts.every((p) => { const v = p.clone().project(camera); return Math.abs(v.x) < sidePad && v.y < topPad && v.y > -botPad; })) break;
  }
  view = { look, pitch, d, base: camera.position.clone(), rot: portrait };
  fogFit();
}
// 안개는 카메라 거리에 맞춰 (세로 화면은 멀리서 보니 판이 뿌옇지 않게)
function fogFit() { if (scene.fog) { scene.fog.near = view.d * 1.15; scene.fog.far = view.d * 3.2; }
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); fitCamera(); }
addEventListener('resize', resize); resize();

// ---------- 상태 ----------
const game = window.arcade = {
  mode: 'title', // title · play · over
  S: null, board: null, net: false, myId: 1, members: new Map(), bears: new Map(), bombs: new Map(), items: new Map(),
  brains: new Map(), startAt: 0, endAt: 0, map: localStorage.getItem('jellyarcade.map') || 'candy', diff: localStorage.getItem('jellyarcade.diff') || 'normal',
  acc: 0, sendT: 0, fixN: 0, result: null, lastMap: null, shake: 0, renderer,
};

// ---------- 곰 ----------
function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.65, 1); s.renderOrder = 20;
  s.userData.draw = (t, col) => { x.clearRect(0, 0, 256, 64); x.font = 'bold 30px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = 'rgba(50,20,60,.85)'; x.strokeText(t, 128, 32); x.fillStyle = col; x.fillText(t, 128, 32); s.material.map.needsUpdate = true; };
  s.userData.draw(text, color);
  return s;
}
const lighten = (hex) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.45).getHexString();
const blobGeo = new THREE.CircleGeometry(0.7, 20);
class Bear {
  constructor(m, mine) {
    this.id = m.id; this.name = m.name; this.mine = mine; this.color = m.color || '#8a5634'; this.team = m.team;
    const look = { ...(m.look || {}) };
    this.bear = makeBear({ name: m.name, color: m.color, look, acc: m.acc });
    this.bear.root.scale.setScalar(1.0);
    this.root = new THREE.Group(); this.root.add(this.bear.root); scene.add(this.root);
    const tcol = game.S?.mode === 'team' && m.team ? TEAMS[m.team]?.color : null;
    this.tagText = mine ? '나' : m.name;
    this.tagCol = mine ? '#ffe066' : tcol ? lighten(tcol) : lighten(this.color);
    this.tag = nameTag(this.tagText, this.tagCol); scene.add(this.tag);
    this.shadow = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex(), color: '#3a1440', transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    // 팀전: 발밑 팀 고리
    if (tcol) { this.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 28), new THREE.MeshBasicMaterial({ color: tcol, transparent: true, opacity: 0.85, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; scene.add(this.ring); }
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.yaw = 0; this.moving = false; this.trapM = null; this.t = Math.random() * 9; this.sec = -1; this.gone = 0; this.stepT = 0;
  }
  setTrap(on, color) {
    if (on && !this.trapM) { this.trapM = trapMesh(color || '#7fd6ff'); scene.add(this.trapM); this.trapT0 = this.t; }
    if (!on && this.trapM) { scene.remove(this.trapM); this.trapM.material.dispose(); this.trapM = null; this.sec = -1; this.tag.userData.draw(this.tagText, this.tagCol); }
  }
  update(dt, p) {
    this.t += dt;
    const wpos = new THREE.Vector3(wx(p.x), TOP, wz(p.y));
    if (this.mine || !game.net) this.pos.copy(wpos);
    else { if (this.pos.distanceTo(wpos) > 4 || !this.init) this.pos.copy(wpos); else this.pos.lerp(wpos, Math.min(1, dt * 16)); this.init = true; }
    const tyaw = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][p.dir] ?? 0;
    let d = tyaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 16);
    const b = this.bear, trapped = p.trap > 0;
    // 탈락: 젤리째 톡 터지고 작아지며 사라진다
    if (p.out) { this.gone += dt; const k = Math.max(0, 1 - this.gone * 2.5); this.root.scale.setScalar(k); this.tag.visible = false; this.shadow.visible = k > 0; this.shadow.scale.setScalar(k); if (this.ring) this.ring.visible = false; this.root.position.copy(this.pos); return; }
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const speed = p.moving && !trapped ? 6 : 0;
    b.update(dt, speed, { noCrawl: true });
    poseBear(b, { alive: true, ground: true, slide: false, flip: null, vy: 0 }, dt);
    if (trapped) {
      // 갇힘: 젤리 덩어리 안에서 천천히 흔들 · 팔을 버둥
      b.inner.rotation.z = Math.sin(this.t * 3.2) * 0.22; b.inner.position.y += 0.35 + Math.sin(this.t * 2.4) * 0.08;
      for (const ar of b.arms.slice(0, 2)) ar.rotation.x = -2.4 + Math.sin(this.t * 9) * 0.5;
    }
    if (p.moving && !trapped) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.26; if (this.mine) sfx('step'); } }
    if (this.trapM) {
      const a = this.t - this.trapT0, pop = Math.min(1, a * 6), wob = Math.sin(a * 5) * 0.06, left = Math.max(0, p.trap);
      const hurryW = left < 1.5 ? Math.sin(a * 30) * 0.05 : 0;
      this.trapM.position.set(this.pos.x, TOP + 1.0, this.pos.z);
      this.trapM.scale.set(pop * (1 + wob + hurryW), pop * (1 - wob), pop * (1 + wob - hurryW));
      this.trapM.rotation.y = Math.sin(a * 1.3) * 0.12;
      this.trapM.userData.bubbles.forEach((bb, i) => { const ph = (a * 0.5 + i * 0.25) % 1; bb.position.set(Math.sin(i * 2.3) * 0.45, -0.8 + ph * 1.6, Math.cos(i * 1.7) * 0.45); bb.material.opacity = 0.7 * (1 - ph); });
      const sec = Math.ceil(left);
      if (sec !== this.sec) { this.sec = sec; this.tag.userData.draw(`${this.mine ? '나' : this.name} ${sec}`, left < 2 ? '#ff6b8b' : '#9fe7ff'); }
    }
    this.shadow.position.set(this.pos.x, TOP + 0.02, this.pos.z);
    if (this.ring) this.ring.position.set(this.pos.x, TOP + 0.03, this.pos.z);
    this.tag.visible = game.focus == null; this.tag.position.set(this.pos.x, TOP + (trapped ? 3.0 : 2.45), this.pos.z);
  }
  remove() { scene.remove(this.root, this.tag, this.shadow); if (this.ring) scene.remove(this.ring); this.setTrap(false); }
}

// ---------- 입력 ----------
const keys = new Set(); let bombEdge = false, lastKey = null;
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
const DIRKEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
addEventListener('keydown', (e) => {
  if (typing()) return;
  unlock();
  if (e.code === 'KeyM') { toggleMute(); syncMute(); }
  if (game.mode !== 'play') return;
  if (e.code === 'Space' && !e.repeat) bombEdge = true;
  if (DIRKEYS[e.code] && !keys.has(e.code)) lastKey = e.code;
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (lastKey === e.code) lastKey = [...keys].reverse().find((k) => DIRKEYS[k]) || null; });
addEventListener('blur', () => keys.clear());
// 휴대폰: 왼쪽 어디든 누르면 조이스틱 · 오른쪽 아래 폭탄 단추
const pad = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
addEventListener('touchstart', (e) => {
  unlock();
  if (game.mode !== 'play') return;
  for (const t of e.changedTouches) {
    if (t.target.closest?.('#t-btns, .hud-r')) continue;
    if (pad.id == null && t.clientX < innerWidth * 0.62) { pad.id = t.identifier; pad.x = t.clientX; pad.y = t.clientY; pad.dx = pad.dy = 0; showPad(true); }
  }
}, { passive: true });
addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === pad.id) { pad.dx = Math.max(-1, Math.min(1, (t.clientX - pad.x) / 50)); pad.dy = Math.max(-1, Math.min(1, (t.clientY - pad.y) / 50)); showPad(true); } }, { passive: true });
const padEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === pad.id) { pad.id = null; pad.dx = pad.dy = 0; showPad(false); } };
addEventListener('touchend', padEnd); addEventListener('touchcancel', padEnd);
function showPad(on) { const s = $('pad'); s.classList.toggle('hidden', !on); if (on) { s.style.left = pad.x + 'px'; s.style.top = pad.y + 'px'; s.firstElementChild.style.transform = `translate(${pad.dx * 34}px, ${pad.dy * 34}px)`; } }
$('t-bomb').addEventListener('touchstart', (e) => { e.preventDefault(); unlock(); bombEdge = true; });
// 입력 → 한 방향 (화면 위 = 판의 -y). 막대는 많이 기운 쪽, 둘 다 많이 기울면 대각선
function readInput() {
  let x = 0, y = 0;
  if (pad.id != null) {
    const ax = Math.abs(pad.dx), ay = Math.abs(pad.dy);
    if (Math.max(ax, ay) > 0.28) { if (ax > 0.28) x = Math.sign(pad.dx); if (ay > 0.28) y = Math.sign(pad.dy); if (ax > ay * 2.2) y = 0; if (ay > ax * 2.2) x = 0; }
  } else {
    // 키보드: 마지막에 누른 방향을 먼저, 같이 누른 다른 방향은 꺾을 때
    for (const k of keys) if (DIRKEYS[k]) { const [a, b] = DIRKEYS[k]; if (a) x = a; if (b) y = b; }
    if (lastKey && keys.has(lastKey) && x && y) { const [a, b] = DIRKEYS[lastKey]; if (a) { x = a; } else { y = b; } }
  }
  // 세로 화면은 판이 옆으로 돌아 있다: 화면 오른쪽 = 판 위(-y), 화면 아래 = 판 오른쪽(+x)
  if (view.rot) [x, y] = [y, -x];
  const bomb = bombEdge; bombEdge = false;
  return { x, y, bomb };
}
// 시험용 자동 조작 (arcade.auto = true): 내 곰도 젤리봇 머리로
function autoInput(inp, me, dt) {
  if (!game.auto || !me || me.out) return inp;
  const b = game.autoBrain ||= newBrain(7 + game.myId);
  const t = think(game.S, { ...me, bot: true, diff: "normal" }, b, dt);
  return { x: t.x, y: t.y, bomb: t.bomb || inp.bomb };
}
function syncMute() { $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = () => { toggleMute(); syncMute(); };
$('b-quit').onclick = () => quit();

// ---------- 공용 틀 ----------
function seg(el, label, list, cur, host, names, onPick) {
  const d = document.createElement('div'); d.className = 'seg';
  d.innerHTML = `<span class="lbl">${label}</span>` + list.map((v) => `<button class="${v === cur ? 'on' : ''}" data-v="${v}" ${host ? '' : 'disabled'}>${names[v] ?? v}</button>`).join('');
  d.querySelectorAll('button').forEach((b) => { b.onclick = () => onPick(isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); });
  el.appendChild(d);
}
const DIFF_NAME = { easy: '🍼 쉬움', normal: '🔥 보통' };
const shell = new Shell({
  key: 'jellyarcade', title: '💣 젤리 아케이드', subtitle: '격자 미로에 젤리 폭탄을 놓아 십자로 퍼지는 젤리 물결로<br>상대 곰을 젤리 속에 가둬요! 마지막까지 남으면 승리', wsPath: '/arcade-ws', max: 8,
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); syncMute(); } },
  multiLabel: '👥 같이 하기', roomIcon: '💣', startLabel: '💣 다 같이 시작!',
  keysHelp: '← ↑ ↓ → 또는 W A S D 움직이기 · Space 젤리 폭탄 · 갇혔을 때 Space = 탈출 젤리 · M 소리',
  buttons: [{ id: 'solo-btn', label: '💣 혼자 하기 <small>젤리봇 3마리와</small>', onClick: () => startSolo() }],
  screens: ['over', 'board-screen'],
  extraRow: [{ label: '🏆 순위표', onClick: () => ranking.open('wins') }],
  describe: (o) => `${MAP_NAME[o.map] || ''} · ${o.team ? '2팀전' : '개인전'} · ${o.fill}명`,
  options: {
    title: () => {},
    room: (el, opts, host) => {
      el.innerHTML = '';
      seg(el, '🗺️ 맵', MAP_LIST, opts.map, host, MAP_NAME, (v) => shell.send({ t: 'opts', opts: { ...opts, map: v } }));
      seg(el, '⚔️ 방식', ['ffa', 'team'], opts.team ? 'team' : 'ffa', host, { ffa: '🙋 개인전', team: '🤝 2팀전' }, (v) => shell.send({ t: 'opts', opts: { ...opts, team: v === 'team' } }));
      seg(el, '🤖 젤리봇까지 모두', [2, 4, 6, 8], opts.fill, host, { 2: '2명', 4: '4명', 6: '6명', 8: '8명' }, (v) => shell.send({ t: 'opts', opts: { ...opts, fill: v } }));
      seg(el, '🤖 젤리봇 실력', ['easy', 'normal'], opts.diff, host, DIFF_NAME, (v) => shell.send({ t: 'opts', opts: { ...opts, diff: v } }));
    },
  },
  onAccount: () => renderTitleOpts(),
  onStart: (m) => onNetStart(m),
  onFinish: (m) => onNetFinish(m),
  onDisconnect: () => { if (game.mode !== 'title' && game.net) toTitle(); },
});
// 순위표: 같이 하기 방에서 이긴 수 · 톡 수 (서버가 판이 끝날 때 더한다)
const ranking = new Ranking({ shell, api: '/api/arcade', boards: [{ id: 'wins', label: '🏆 이긴 판' }, { id: 'pops', label: '✨ 톡 터뜨리기' }], unit: '번', title: '🏆 젤리 아케이드 순위표 <small>(같이 하기)</small>', nickKey: 'jellyarcade.nick' });
shell.pickOpts = () => ({ map: game.map, team: false, fill: 4, diff: game.diff });
function renderTitleOpts() {
  const el = $('title-opts'); el.innerHTML = '';
  seg(el, '🗺️ 맵', MAP_LIST, game.map, true, MAP_NAME, (v) => { game.map = v; localStorage.setItem('jellyarcade.map', v); renderTitleOpts(); titleScene(); });
  seg(el, '🤖 젤리봇 실력', ['easy', 'normal'], game.diff, true, DIFF_NAME, (v) => { game.diff = v; localStorage.setItem('jellyarcade.diff', v); renderTitleOpts(); });
}
const pickMap = (m) => (m === 'random' || !G.MAPS[m] ? G.MAP_IDS[Math.floor(Math.random() * G.MAP_IDS.length)] : m);
// 내 곰 모습: 캐릭터 + 계정 치장(오라 · 신발 · 휘장 …)
function myLook() {
  const p = shell.profile || { name: '곰돌이', color: '#8a5634' };
  const eq = account.cos?.equip;
  return { ...p, look: { ...(p.look || {}), ...(eq && Object.keys(eq).length ? { cos: eq } : {}) } };
}

// ---------- 판 시작 ----------
function clearGame() {
  for (const b of game.bears.values()) b.remove(); game.bears.clear();
  for (const m of game.bombs.values()) scene.remove(m); game.bombs.clear();
  for (const m of game.items.values()) scene.remove(m); game.items.clear();
  if (game.board) { game.board.dispose(); game.board = null; }
}
function setTheme(map) {
  const th = THEMES[map];
  hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
  sun.color.set(th.sun[0]); sun.intensity = th.sun[1];
  document.body.style.background = th.sky;
}
function beginGame(S, members, { net, startIn = 3000 }) {
  clearGame();
  game.S = S; game.myInp = null; game.net = net; game.members = new Map(members.map((m) => [m.id, m]));
  setTheme(S.map);
  game.board = new Board(scene, S, { phone: isPhone }); fogFit();
  for (const p of S.players) game.bears.set(p.id, new Bear(game.members.get(p.id) || { id: p.id, name: '곰돌이' }, p.id === game.myId));
  game.mode = 'play'; shell.playing = true; game.startAt = performance.now() + startIn; game.acc = 0; game.over = false; game.overShown = false; game.hurried = false; game.focus = null; game.camT = 0; game.warned = false;
  shell.hideScreens(); $('hud').classList.remove('hidden'); $('over').classList.add('hidden');
  $('h-map').textContent = `${G.MAPS[S.map].emoji} ${G.MAPS[S.map].name}${S.mode === 'team' ? ' · 2팀전' : ''}`;
  countdown(startIn);
  setMusic(S.map);
  renderPlayers(); renderMe(true);
}
function startSolo() {
  unlock();
  const me = myLook(), map = pickMap(game.map);
  game.myId = 1; game.lastMap = game.map;
  const members = [{ id: 1, name: me.name, color: me.color, look: me.look, acc: me.acc }];
  for (let i = 0; i < 3; i++) members.push({ id: i + 2, name: BOT_NAMES[i], color: BOT_COLORS[i], bot: true, look: { hat: 1 + ((i * 3) % 9), outfit: (i * 2) % 7 } });
  const S = G.createGame({ map, seed: (Math.random() * 2 ** 31) | 0, players: members.map((m) => ({ id: m.id, bot: !!m.bot, diff: game.diff, name: m.name })) });
  game.brains = new Map(S.players.filter((p) => p.bot).map((p) => [p.id, newBrain(p.id * 977 + S.seed)]));
  beginGame(S, members, { net: false, startIn: 3000 });
  soloNote({});
}
// 혼자 하기 판수 · 승리 업적: 시작 · 끝을 서버에 알린다 (서버가 30초 넘은 판만 센다)
function soloNote(body) {
  const who = account.session ? {} : { anon: anonId() };
  account.api('/api/cos/solo', { method: 'POST', body: { ...who, game: 'jelly-arcade', ...body } }).catch(() => {});
}
function quit() { if (shell.room) { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() {
  game.mode = 'title'; shell.multi = false; shell.playing = false; game.net = false;
  for (const id of ['hud', 'count', 'banner', 'over', 'pad']) $(id).classList.add('hidden');
  stopMusic(); shell.show('title'); renderTitleOpts(); titleScene();
}
// 처음 화면: 고른 맵을 빙글 돌며 보여 준다
function titleScene() {
  clearGame();
  const map = G.MAPS[game.map] ? game.map : 'candy';
  const S = G.createGame({ map, seed: 7, players: [] });
  game.S = S; game.myInp = null; setTheme(map); game.board = new Board(scene, S, { phone: isPhone }); fogFit();
}

// ---------- 같이 하기 ----------
function onNetStart(m) {
  unlock();
  game.myId = shell.myId; game.lastMap = null;
  const S = G.createGame({ map: m.map, seed: m.seed, mode: m.mode, players: m.plist });
  const members = m.plist.map((p) => ({ ...(m.members.find((x) => x.id === p.id) || {}), ...p }));
  beginGame(S, members, { net: true, startIn: m.in || 3000 });
  game.netStart = performance.now() + (m.in || 3000);
}
shell.on('ev', (m) => {
  if (!game.net || !game.S) return;
  // 판 시계 맞추기: 조금씩 따라가고, 많이 어긋나면 바로
  if (Number.isFinite(m.tt)) { const d = m.tt - game.S.t; game.S.t += Math.abs(d) > 0.5 ? d : d * 0.3; }
  for (const e of m.e) { G.apply(game.S, e); onEvent(e); }
});
shell.on('snap', (m) => {
  if (!game.net || !game.S) return;
  for (const [id, x, y, dir, f] of m.p) {
    const p = game.S.players.find((q) => q.id === id); if (!p) continue;
    if (id === game.myId) {
      // 서버와 많이 어긋나면 서버 쪽으로 (밀려나거나 막힌 경우)
      const off = Math.hypot(p.x - x, p.y - y);
      game.fixN = off > 1.1 ? game.fixN + 1 : 0;
      if (game.fixN >= 4) { p.x = x; p.y = y; game.fixN = 0; }
      continue;
    }
    p.x = x; p.y = y; p.dir = dir; p.moving = !!(f & 1);
  }
});
function onNetFinish(m) { showResult(m.rows || [], m.winner, m); }

// ---------- 사건 → 화면 · 소리 ----------
const FEED_MAX = 4;
function feed(html) { const f = $('feed'); const d = document.createElement('div'); d.innerHTML = html; f.prepend(d); while (f.children.length > FEED_MAX) f.lastChild.remove(); setTimeout(() => d.remove(), 3500); }
const nm = (id) => { const m = game.members.get(id); return id === game.myId ? '나' : esc(m?.name || '?'); };
function onEvent(e) {
  const B = game.board; if (!B) return;
  const me = game.myId;
  switch (e.k) {
    case 'bomb': {
      const col = game.members.get(e.owner)?.color || '#ff8fbf';
      const g = bombMesh(col); g.position.set(wx(e.x), TOP, wz(e.y)); g.userData.born = B.t; scene.add(g); game.bombs.set(e.id, g);
      if (e.owner === me) sfx('place'); else sfx('place');
      B.wobble(e.x, e.y, 0.3);
      break;
    }
    case 'boom': {
      for (const [, , id] of e.bombs) { const g = game.bombs.get(id); if (g) { scene.remove(g); game.bombs.delete(id); } }
      for (const [x, y] of e.melted || []) removeItem(x, y, true);
      B.boom(e); sfx('boom'); if (e.boxes.length) sfx('break');
      game.shake = Math.min(0.5, game.shake + 0.18 + e.bombs.length * 0.06);
      break;
    }
    case 'item': { const g = itemMesh(e.type); g.position.set(wx(e.x), TOP + 0.9, wz(e.y)); g.userData.born = B.t; g.userData.cell = G.idx(e.x, e.y); scene.add(g); game.items.set(G.idx(e.x, e.y), g); sfx('itemPop'); break; }
    case 'pick': {
      removeItem(e.x, e.y); B.burst(e.x, e.y, '#ffe066', 10, 3, 6);
      if (e.id === me) { sfx('pick', ['candy', 'syrup', 'shoe', 'escape'].indexOf(e.type)); const it = G.ITEMS[e.type]; feed(`${it.emoji} ${it.name} · ${it.desc}`); renderMe(e.type); }
      break;
    }
    case 'trap': {
      const p = game.S.players.find((q) => q.id === e.id), bear = game.bears.get(e.id);
      const col = game.S.mode === 'team' ? (p?.team === 'red' ? '#ff9db3' : '#8fd8ff') : '#8fe3ff';
      bear?.setTrap(true, col); sfx('trap');
      if (e.id === me) banner(game.S.players.find((q) => q.id === me)?.escape > 0 ? '🫧 갇혔어요! Space = 탈출 젤리' : game.S.mode === 'team' ? '🫧 갇혔어요! 친구가 닿으면 풀려요' : '🫧 갇혔어요!', 'bad');
      renderPlayers();
      break;
    }
    case 'free': {
      const bear = game.bears.get(e.id); bear?.setTrap(false); const p = game.S.players.find((q) => q.id === e.id);
      if (p) B.burst(p.x, p.y, '#bff4ff', 18, 5, 7);
      sfx(e.self ? 'escape' : 'free');
      if (e.id === me) banner(e.self ? '🍬 탈출 젤리로 빠져나왔어요!' : `🤝 ${nm(e.by)} 덕분에 풀려났어요!`, 'good');
      else if (e.by === me) feed(`🤝 ${nm(e.id)} 구출!`);
      renderPlayers(); renderMe();
      break;
    }
    case 'out': {
      const bear = game.bears.get(e.id); const p = game.S.players.find((q) => q.id === e.id);
      if (bear) { bear.setTrap(false); }
      if (p) { B.burst(p.x, p.y, '#ffffff', 22, 6, 8); B.burst(p.x, p.y, game.members.get(e.id)?.color || '#ff8fbf', 12, 4, 6); }
      sfx('out');
      const why = e.why === 'fall' ? '푸딩 블록에 깔렸어요' : e.why === 'left' ? '나갔어요' : e.why === 'pop' ? `${nm(e.by)}에게 톡!` : e.by && e.by !== e.id ? `${nm(e.by)}의 물결에 갇혀 시간이 다 됐어요` : '젤리 속에서 시간이 다 됐어요';
      feed(`💥 ${nm(e.id)} · ${why}`);
      if (e.id === me) banner('💧 탈락… 구경하며 응원해요', 'bad');
      else if (e.by === me && e.why === 'pop') banner(`✨ ${nm(e.id)} 톡!`, 'good');
      renderPlayers();
      break;
    }
    case 'warn': if (!game.warned) { game.warned = true; banner('🍮 푸딩 블록이 내려와요!', 'warn'); hurry(true); } if (Math.random() < 0.3) sfx('warn'); break;
    case 'fall': B.landed(e.x, e.y); B.fall(e.x, e.y); removeItem(e.x, e.y, true); for (const [id, g] of game.bombs) { if (Math.abs(g.position.x - wx(e.x)) < 0.1 && Math.abs(g.position.z - wz(e.y)) < 0.1) { scene.remove(g); game.bombs.delete(id); } } sfx('fall'); break;
    case 'end': {
      game.over = true; game.endAt = performance.now();
      // 이긴 곰 쪽으로 카메라가 다가간다 (팀전은 남은 우리 팀 곰 중 하나)
      const w = game.S.players.find((p) => !p.out && p.team === e.winner);
      game.focus = w ? w.id : null;
      break;
    }
    default: break;
  }
}
function removeItem(x, y, melt) { const k = G.idx(x, y), g = game.items.get(k); if (!g) return; scene.remove(g); game.items.delete(k); if (melt) game.board?.burst(x, y, '#ffffff', 6, 2, 3); }

// ---------- 화면 위 글씨 ----------
function renderPlayers() {
  const S = game.S; if (!S) return;
  $('h-players').innerHTML = S.players.map((p) => {
    const m = game.members.get(p.id) || {}, team = S.mode === 'team' ? p.team : '';
    const st = p.out ? '탈락' : p.trap > 0 ? '갇힘' : '';
    return `<div class="pchip ${team} ${p.id === game.myId ? 'me' : ''} ${p.out ? 'out' : p.trap > 0 ? 'trap' : ''}"><span class="dot" style="background:${esc(m.color || '#8a5634')}"></span><span class="nm">${m.bot ? '🤖 ' : ''}${p.id === game.myId ? '나' : esc(m.name || '?')}</span>${st ? `<span class="st">${st}</span>` : ''}</div>`;
  }).join('');
}
function renderMe(popType) {
  const p = game.S?.players.find((q) => q.id === game.myId); if (!p) { $('h-me').innerHTML = ''; return; }
  const key = { candy: 0, syrup: 1, shoe: 2, escape: 3 }[popType];
  $('h-me').innerHTML = [['⭐', p.bombs], ['🍯', p.range], ['👟', p.speed + 1], ['🍬', p.escape]].map(([e, v], i) => `<span class="${i === key ? 'pop' : ''}">${e} ${v}</span>`).join('');
  $('t-bomb').classList.toggle('esc', p.trap > 0 && p.escape > 0);
}
let banT = 0;
function banner(html, cls) { const b = $('banner'); b.innerHTML = html; b.className = cls || ''; clearTimeout(banT); banT = setTimeout(() => b.classList.add('hidden'), 2200); }
function countdown(ms) {
  const el = $('count'); let n = Math.round(ms / 1000);
  const tick = () => {
    if (game.mode !== 'play') return el.classList.add('hidden');
    el.classList.remove('hidden'); el.textContent = n > 0 ? n : '시작!'; el.className = n > 0 ? '' : 'go';
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    sfx('beep', n <= 0);
    if (n-- > 0) setTimeout(tick, 1000); else setTimeout(() => el.classList.add('hidden'), 700);
  };
  tick();
}
function confetti() { const c = document.createElement('div'); c.className = 'confetti'; for (let i = 0; i < 60; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = ['#ff5fa2', '#ffd84d', '#5ec8ff', '#7be07b', '#b388ff'][i % 5]; s.style.animationDelay = Math.random() * 0.6 + 's'; s.style.animationDuration = 1.6 + Math.random() * 1.2 + 's'; c.appendChild(s); } document.body.appendChild(c); setTimeout(() => c.remove(), 3500); }

// ---------- 결과 ----------
function showResult(rows, winner, extra = {}) {
  if (game.overShown) return; game.overShown = true;
  const S = game.S, mine = rows.find((r) => r.id === game.myId);
  const won = !!mine?.win, draw = winner == null;
  stopMusic(); hurry(false);
  $('ov-title').innerHTML = draw ? '🤝 무승부!' : won ? (S.mode === 'team' ? '🏆 우리 팀 승리!' : '🏆 우승!') : `${mine?.place || '-'}등`;
  const stars = extra.stars?.[game.myId];
  $('ov-me').innerHTML = (won ? '마지막까지 젤리 속에 갇히지 않았어요! 🎉' : draw ? '모두 함께 사라졌어요' : '다음엔 꼭 이겨요!') + (mine?.pops ? ` · 톡 ${mine.pops}번` : '') + (stars ? ` · ⭐ 별 ${stars}개` : '');
  $('ov-rank').innerHTML = rows.map((r) => { const m = game.members.get(r.id) || {}; return `<div class="row${r.id === game.myId ? ' me' : ''}"><b>${r.win ? '🏆' : r.place}</b><span class="dot" style="background:${esc(m.color || '#8a5634')}"></span><span class="nm">${m.bot ? '🤖 ' : ''}${r.id === game.myId ? '나' : esc(m.name || '?')}</span><span class="pops">${r.pops ? `톡 ${r.pops}` : ''}</span></div>`; }).join('');
  $('again-btn').textContent = game.net ? '🏠 방으로' : '🔁 다시 하기';
  setTimeout(() => { if (game.mode !== 'play') return; game.mode = 'over'; $('hud').classList.add('hidden'); shell.show('over'); $('over').classList.remove('hidden'); }, 1800);
  if (won) { sfx('win'); confetti(); } else sfx('lose');
}
$('again-btn').onclick = () => { $('over').classList.add('hidden'); if (game.net && shell.room) { game.mode = 'room'; game.net = false; shell.backToRoom(); titleScene(); } else startSolo(); };
$('home-btn').onclick = () => quit();

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
const DT = 1 / 60;
let fpsN = 0, fpsT = 0; window.arcadeFps = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  fpsN++; fpsT += dt; if (fpsT >= 1) { window.arcadeFps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  const S = game.S, B = game.board;
  if (game.mode === 'play' && S) playFrame(dt);
  if (B) B.update(dt);
  // 폭탄: 숨 쉬듯 부풀고, 터질 때가 가까우면 빨리 깜빡인다
  if (S) for (const b of S.bombs) {
    const g = game.bombs.get(b.id); if (!g) continue;
    const u = g.userData, age = B.t - (u.born || 0), left = b.t, rate = left < 0.8 ? 26 : left < 1.6 ? 14 : 7;
    const pop = Math.min(1, age * 7), puls = Math.sin(B.t * rate) * (left < 0.8 ? 0.09 : 0.05);
    g.scale.set(pop * (1 + puls), pop * (1 - puls * 1.2) * (age < 0.25 ? 1 + Math.sin(age * 25) * 0.15 : 1), pop * (1 + puls));
    u.core.material.color.setRGB(1, 0.85 + 0.15 * Math.sin(B.t * rate), 0.7 + 0.3 * Math.sin(B.t * rate));
    u.spark.lookAt(camera.position); const sp = 0.7 + Math.random() * 0.6; u.spark.scale.set(sp, sp, sp);
  }
  // 아이템: 둥실 · 빙글
  if (B) for (const g of game.items.values()) { const a = B.t - (g.userData.born || 0); g.userData.body.position.y = Math.sin(B.t * 2.6 + g.userData.cell) * 0.12 + (a < 0.4 ? (0.4 - a) * 4 : 0); g.userData.body.rotation.y += dt * 1.6; g.userData.disc.position.y = -0.85 + 0.02; g.userData.disc.material.opacity = 0.55 + Math.sin(B.t * 4) * 0.2; }
  // 카메라
  if (game.mode === 'title' || !S?.players.length) {
    const a = performance.now() / 1000 * 0.12, d = view.d * 0.92;
    camera.position.set(Math.sin(a) * d * 0.55, Math.sin(0.85) * d, Math.cos(a) * d * 0.8); camera.lookAt(0, 0, 0);
  } else {
    const fb = game.focus != null ? game.bears.get(game.focus) : null;
    game.camT = Math.max(0, Math.min(1, game.camT + (fb ? dt * 0.9 : -dt * 2)));
    const k = game.camT * game.camT * (3 - 2 * game.camT);
    if (fb) { game.camTo = fb.pos.clone().add(view.rot ? new THREE.Vector3(8, 10, 0) : new THREE.Vector3(0, 10, 8)); game.lookTo = fb.pos.clone().add(new THREE.Vector3(0, 1.2, 0)); }
    camera.position.copy(view.base); if (game.camTo && k > 0) camera.position.lerp(game.camTo, k);
    const lk = view.look.clone(); if (game.lookTo && k > 0) lk.lerp(game.lookTo, k); camera.lookAt(lk);
    if (game.shake > 0) { game.shake = Math.max(0, game.shake - dt * 1.8); const k = game.shake * 0.35; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  }
  renderer.render(scene, camera);
}
function playFrame(dt) {
  const S = game.S, now = performance.now();
  const started = now >= game.startAt;
  const me = S.players.find((p) => p.id === game.myId);
  if (started && !game.over) {
    if (!game.net) {
      // 혼자 하기: 판 전체를 이 화면에서
      game.acc += dt;
      const inp = autoInput(readInput(), me, dt);
      const inputs = new Map();
      // 내 입력은 판 사이에도 이어진다: 이번 화면에서 판이 안 돌아도(화면이 빠른 모니터) 누른 폭탄이 사라지지 않고, 못 놓으면 0.25초 동안 다시 시도
      const mi = game.myInp ||= { x: 0, y: 0, bomb: false };
      mi.x = inp.x; mi.y = inp.y; if (inp.bomb) mi.bomb = 0.25;
      inputs.set(game.myId, mi);
      while (game.acc >= DT) {
        game.acc -= DT;
        for (const p of S.players) if (p.bot) inputs.set(p.id, think(S, p, game.brains.get(p.id), DT));
        for (const e of G.step(S, DT, inputs)) onEvent(e);
        if (S.over) break;
      }
      if (S.over && !game.resultAt) game.resultAt = now + 1200;
    } else if (me) {
      // 같이 하기: 내 곰만 먼저 움직이고 위치를 보낸다
      const inp = autoInput(readInput(), me, dt);
      if (!me.out) {
        game.acc += dt;
        while (game.acc >= DT) { game.acc -= DT; G.movePlayer(S, me, inp.x, inp.y, DT); }
        if (inp.bomb) shell.send({ t: 'bomb', x: +me.x.toFixed(2), y: +me.y.toFixed(2) });
        game.sendT -= dt;
        if (game.sendT <= 0) { game.sendT = 1 / 20; shell.send({ t: 'mv', x: +me.x.toFixed(3), y: +me.y.toFixed(3), d: me.dir, m: me.moving ? 1 : 0 }); }
      }
      G.tickView(S, dt);
    }
  }
  if (!game.net && game.resultAt && now >= game.resultAt) { game.resultAt = 0; const rows = G.ranking(S); soloNote({ end: true, win: !!rows.find((r) => r.id === game.myId)?.win }); showResult(rows, S.winner); }
  for (const p of S.players) game.bears.get(p.id)?.update(dt, p);
  // 시간 · 좁아짐
  const t = S.t, left = Math.max(0, G.MATCH_T - t), clk = $('h-clock');
  clk.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '🍮 좁아져요';
  clk.classList.toggle('low', left > 0 && left < 15); clk.classList.toggle('shrink', left <= 0);
  if (me && (game.lastTrapShown !== (me.trap > 0) || game.lastEsc !== me.escape)) { game.lastTrapShown = me.trap > 0; game.lastEsc = me.escape; renderMe(); }
}

game.startSolo = startSolo; game.shell = shell;
renderTitleOpts();
shell.boot();
titleScene();
frame();
// 시험용: ?solo=맵 이면 바로 혼자 하기
if (Q.get('solo')) { game.map = Q.get('solo'); setTimeout(() => startSolo(), 400); }
