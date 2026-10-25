import * as THREE from 'three';
import { HALF, CITY } from './config.js';
import { WORLD_HALF } from './terrain.js';
import { JOBS, BUILDING_TYPES, EMOTE } from './data.js';
import { ITEMS, GEMS, SHOPS, ENCHANT_FEE, CLUB_CHARM, RARITY, itemDef, shopItems, weaponStats, isWeapon, ammoName } from './items.js';
import { SLOTS } from './inventory.js';
// 조준점 색 추천 (설정에서 직접 고를 수도 있다)
const XH_COLORS = ['#ffffff', '#ff3b30', '#ffcc00', '#4cd964', '#00e5ff', '#ff4fd8', '#000000'];
const APP_TITLES = { quests: '퀘스트', camera: '카메라', gallery: '사진', insta: 'Jellystagram', tinder: '튄더', contacts: '연락처', sms: '메시지', police: '112 신고', map: '지도', me: '내 정보', feedback: '건의하기', help: '도움말', settings: '설정', admin: '건의함' };
const SKILL_NAMES = { jump2: '2단 점프', jump3: '3단 점프', dash: '대쉬 거리 강화', jumpboost: '점프력 강화', dashlong: '대쉬 거리 강화' };
import { LOOK_PARTS, LOOK_COLORS, DEFAULT_LOOK } from '../../shared/js/look.js';
import { PHONE_APPS } from './phone.js';
import { expNeed } from './level.js';
import { questDef } from './quests.js';
import { CAR_COLORS, MODELS, BIKES } from './traffic.js';
import { DEALER_CARS } from './items.js';
import { housePrice, freeUnits, homeLabel, isHomeType } from './world-setup.js';
import { moodLabel, moodEmoji } from './citizens.js';
import { Roach } from '../../shared/js/roach.js';
import { settings, saveSettings } from '../../shared/js/settings.js';
import { GFX, LEVELS, detectLevel } from './gfx.js';
import { openSens, sensOf } from '../../shared/js/sens.js';
import { setMusic, applyVolumes } from '../../shared/js/audio.js';
import { fmtTime, DAYS, escapeHtml, cityText, setBrand } from '../../shared/js/utils.js';

const $ = (id) => document.getElementById(id);
// 젤리 모드용 귀여운 곰돌이 젤리 아이콘 (바퀴 모드면 CSS로 바퀴벌레 아이콘을 보여준다)
const CUTE_BEAR = `<svg class="cute-bear" viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">  <circle cx="30" cy="26" r="15" fill="#ff7eb6" opacity=".9"/><circle cx="90" cy="26" r="15" fill="#ff7eb6" opacity=".9"/>  <circle cx="30" cy="27" r="7" fill="#ffc1dc"/><circle cx="90" cy="27" r="7" fill="#ffc1dc"/>  <ellipse cx="60" cy="100" rx="31" ry="27" fill="#ff7eb6" opacity=".92"/>  <ellipse cx="60" cy="104" rx="19" ry="17" fill="#ffc1dc"/>  <ellipse cx="28" cy="96" rx="9" ry="14" fill="#ff7eb6"/><ellipse cx="92" cy="96" rx="9" ry="14" fill="#ff7eb6"/>  <ellipse cx="60" cy="54" rx="35" ry="31" fill="#ff7eb6" opacity=".95"/>  <ellipse cx="60" cy="66" rx="14" ry="10" fill="#ffc1dc"/><ellipse cx="60" cy="62" rx="5" ry="3.6" fill="#7a2848"/>  <ellipse cx="45" cy="50" rx="7" ry="8.5" fill="#1d1410"/><ellipse cx="75" cy="50" rx="7" ry="8.5" fill="#1d1410"/>  <circle cx="43" cy="47" r="2.4" fill="#fff"/><circle cx="73" cy="47" r="2.4" fill="#fff"/>  <ellipse cx="34" cy="64" rx="6" ry="3.6" fill="#ff4f8f" opacity=".6"/><ellipse cx="86" cy="64" rx="6" ry="3.6" fill="#ff4f8f" opacity=".6"/>  <path d="M54 71 Q60 76 66 71" stroke="#7a2848" stroke-width="2.6" fill="none" stroke-linecap="round"/>  <ellipse cx="44" cy="36" rx="6" ry="10" fill="#fff" opacity=".45" transform="rotate(-25 44 36)"/></svg>`;
const CUTE_ROACH = `<svg class="cute-roach" viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">  <path d="M46 34 Q30 6 14 8" stroke="#5d3a24" stroke-width="4" fill="none" stroke-linecap="round"/>  <path d="M74 34 Q90 6 106 8" stroke="#5d3a24" stroke-width="4" fill="none" stroke-linecap="round"/>  <circle cx="14" cy="8" r="6" fill="#a86b3e"/><circle cx="106" cy="8" r="6" fill="#a86b3e"/>  <ellipse cx="60" cy="98" rx="30" ry="28" fill="#8a5634"/>  <ellipse cx="60" cy="102" rx="19" ry="19" fill="#c08a5c"/>  <path d="M30 92 l-14 10 M30 104 l-14 8 M90 92 l14 10 M90 104 l14 8" stroke="#5d3a24" stroke-width="5" stroke-linecap="round"/>  <ellipse cx="60" cy="52" rx="34" ry="31" fill="#8a5634"/>  <ellipse cx="46" cy="52" rx="10" ry="12" fill="#fff"/><ellipse cx="74" cy="52" rx="10" ry="12" fill="#fff"/>  <ellipse cx="47" cy="54" rx="6" ry="7.5" fill="#1d1410"/><ellipse cx="75" cy="54" rx="6" ry="7.5" fill="#1d1410"/>  <circle cx="45" cy="50" r="2.4" fill="#fff"/><circle cx="73" cy="50" r="2.4" fill="#fff"/>  <ellipse cx="34" cy="64" rx="6" ry="3.6" fill="#ff9fb2"/><ellipse cx="86" cy="64" rx="6" ry="3.6" fill="#ff9fb2"/>  <path d="M53 66 Q60 73 67 66" stroke="#1d1410" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
const NEEDS = [
  ['hunger', '🍙', '포만감', '#ff9f6b'],
  ['fun', '🎈', '재미', '#c99bff'],
  ['social', '💬', '사교', '#7ec8a9'],
  ['hygiene', '🫧', '청결', '#80d8ff'],
];

export class UI {
  constructor(game) {
    this.game = game;
    this.labels = new Map();
    this.toastQ = [];
    this.chatC = null;
    this.chatTalked = false;
    this.busy = false;
    this.phoneTab = 'citizens';
    this.mapT = 0;
    this.setupChat();
    this.setupPhone();
    this.setupPlayerChat();
    $('minimap').addEventListener('click', () => this.openWorldMap());
    $('map-hint').addEventListener('click', () => this.openWorldMap());
    $('confirm-yes').onclick = () => this.confirmResolve?.(true);
    $('confirm-no').onclick = () => this.confirmResolve?.(false);
    $('sleep-wake').onclick = () => game.wakeUp();
  }

  // ---------------- 시작 화면 ----------------

  updatePreview(color) {
    if (this.pvRoach) this.pvScene.remove(this.pvRoach.root);
    this.pvRoach = new Roach({ color, age: 25, accessories: [] });
    this.pvRoach.root.scale.setScalar(1);
    this.pvScene.add(this.pvRoach.root);
  }
  renderPreview(dt) {
    if (!this.pvRoach) return;
    this.pvRoach.root.rotation.y += dt * 0.8;
    this.pvRoach.update(dt, 0);
    if (Math.random() < 0.004) this.pvRoach.wave();
    this.pvRenderer.render(this.pvScene, this.pvCam);
  }
  disposePreview() { this.pvRoach = null; this.pvRenderer?.dispose(); }

  updateServerStatus(s) {
    this.serverStatus = s;
    const el = $('llm-status');
    if (!s) { el.innerHTML = '⚠️ 서버에 연결할 수 없어요. 서버가 켜져 있는지 확인하세요.'; return; }
    const who = s.players ? `지금 <b>${s.players}명</b>이 플레이 중이에요!` : '아직 아무도 없어요. 첫 주민이 되어보세요!';
    const llm = s.llm ? `🤖 LLM(<b>${escapeHtml(s.model)}</b>)으로 젤리들이 대화해요` : '💤 서버에 LLM 키가 없어 기본 대사로 대화해요';
    el.innerHTML = `👥 ${who}<br>${llm}`;
    $('pw-row').classList.toggle('hidden', !s.password);
  }

  // 로그인 화면 배경 투어
  tourCaption(label, npcs, players, hour) {
    let el = $('tour-cap');
    if (!el) { el = document.createElement('div'); el.id = 'tour-cap'; $('start').appendChild(el); }
    const hh = Math.floor(hour), mm = Math.floor((hour % 1) * 60);
    el.innerHTML = `<b>LIVE</b> ${label}<small>${hh < 12 ? '오전' : '오후'} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} · 근처 시민 ${npcs}명 · 접속 중 플레이어 ${players}명</small>`;
  }
  tourFade() {
    let f = $('tour-fade');
    if (!f) { f = document.createElement('div'); f.id = 'tour-fade'; document.body.appendChild(f); }
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }

  showLoading(text) { $('loading').classList.remove('hidden'); $('loading-text').textContent = text; }
  hideLoading() { $('loading').classList.add('hidden'); }
  showHUD() {
    for (const id of ['hud', 'minimap-wrap', 'help-hint', 'pchat', 'hotbar-wrap', 'keys-btn', 'topbar', 'online-bar']) $(id).classList.remove('hidden');
    $('keys-btn').onclick = () => this.openKeys();
    $('tb-phone').onclick = () => this.togglePhone();
    $('tb-feedback').onclick = () => this.openPhone('feedback');
    $('tb-exit').onclick = async () => { if (await this.confirm('저장하고 캐릭터 선택 화면으로 나갈까요?<br><small>돈·아이템·집은 서버에 저장돼요</small>', '💾 저장하고 나가기', '계속 하기')) this.game.resetSave(); };
    $('bag-btn').onclick = () => this.toggleInventory();
    $('quest-card').onclick = () => this.openPhone('quests');
    $('online-bar').onclick = (e) => {
      const c = e.target.closest('[data-pid]'); if (!c) return;
      const g = this.game, o = g.players.list.get(+c.dataset.pid);
      if (!o) { this.openOnline(); return; }
      g.setWaypoint(o.loc >= 0 ? g.city.buildings[o.loc] : o.pos.clone(), `🎮 ${o.name}`);
      this.toast(`📍 ${o.name}님 위치를 표시했어요`);
    };
    $('tb-badges').onclick = () => this.openBadges();
    $('tb-map').onclick = () => this.openWorldMap();
    $('tb-shops').onclick = () => this.openShopDirectory();
    const musicBtn = () => { $('tb-music').textContent = settings.music ? '🎵 음악 켬' : '🔇 음악 끔'; };
    $('tb-music').onclick = () => { setMusic(!settings.music); musicBtn(); };
    musicBtn();
    this.setBugMode(settings.bugMode, true);
    this.applyCrosshair();
    this.renderQuests();
    let seen = false;
    try { seen = localStorage.getItem('roachcity.keysSeen') === '1'; } catch { /* 무시 */ }
    if (!seen) setTimeout(() => this.openKeys(), 800);
    this.disposePreview();
    setTimeout(() => $('help-hint').classList.add('hidden'), 25000);
  }
  toggleHelp() {
    if (!$('modal').classList.contains('hidden') && this.modalKind === 'keys') this.closeModal();
    else this.openKeys();
  }

  // 조작법 안내
  openKeys() {
    const K = (k) => k.split('+').map((x) => `<kbd>${x}</kbd>`).join('');
    const groups = [
      ['🚶 이동', [['W A S D', '걷기 (방향키도 OK)'], ['Shift', '달리기 (바퀴 모드에선 여섯 다리로 기어 달려요!)'], ['Space', '점프 · 공중에서 한 번 더 2단 점프 (3단은 수련*)'], ['C', '대쉬 (거리 강화는 수련*)'], ['Space 두 번', '🪽 날기 — 날면서 Space 꾹 위로 · X 아래로 · Space 두 번 = 날개 접고 떨어지기 (G도 가능)'], ['V', '1인칭 ↔ 3인칭'], ['벽으로 걷기', '🧗 벽에 대고 계속 걸으면 벽을 기어올라요 (W/S 위아래 · A/D 옆 · Space 뛰어내리기) — 옥상도 걸을 수 있어요'], ['마우스', '화면 클릭 후 움직이면 시점 회전 · 휠로 확대/축소'], ['R', '지도에 찍은 목적지까지 자동으로 걷기']]],
      ['💬 생활', [['E', '대화하기 · 건물 들어가기/나가기 · 행동하기 · 아이템 줍기'], ['B', '💘 플러팅 — 앞에 있는 상대에게 하트 날리기'], ['P', '📷 사진 찍기 (갤러리·인스타는 휴대폰)'], ['Enter', '전체 채팅 (T도 가능)'], ['I', '가방'], ['M', '도시 전체 지도'], ['K / Tab', '📱 휴대폰 열기·닫기 — 퀘스트·카메라·인스타·튄더·연락처·문자·112'], ['Esc', '창 닫기']]],
      ['⚔️ 전투 · 아이템', [['1 ~ 0', '핫바 칸 선택 (무기, 마법봉, 음식, 차 키)'], ['왼쪽 클릭', '공격 / 마법 / 먹기 · 활은 꾹 눌러 당겼다가 놓기!'], ['오른쪽 클릭', '🔭 1인칭 조준 (총·활) · 저격총은 스코프 · 총마다 반동이 달라요'], ['우클릭 (젤리병단 장비)', '🪝 갈고리를 건물·거대 젤리에 박고 꾹 = 당겨서 날기, 떼면 그 기세로 날아감 · 건 동안 Space 가스 · 놓은 뒤 Space 2단 점프(옥상 올라서기) · 좌클릭 쌍검 · 거대 젤리는 뒷목(빨간 과녁)을 베야 쓰러져요 — 작은 건 한 번, 클수록 여러 번(머리 위 체력바)'], ['E (도시 말 옆)', '🐎 바로 올라타기 · Shift 질주 · F 내리기'], ['U', '🛒 상점 목록 — 어디서든 가게를 골라 바로 구경·구매, 📍 길 안내'], ['J 꾹 누르기', '💃 이모트 휠 — 마우스로 고르고 떼면 춤 (🎵 표시는 공식 챌린지 노래도 나와요)'], ['스코프 중 휠', '🔍 배율 조절 (저격총 2~8배 · 엽총 2~6배 · 바렛 4~15배)'], ['낚싯대 클릭', '🎣 물을 보고 던지기 → "입질!" 뜨면 바로 클릭'], ['Q', '선택한 아이템 바닥에 버리기'], ['Z 꾹 → 떼기', '🪢 동물 포획 — 체력을 절반 아래로 깎고, 바늘이 초록칸일 때 떼기 (가축은 언제나)'], ['F (탈것)', '🐎 포획한 동물에서 내리기 · 드래곤은 클릭으로 불 뿜기'], ['← →', '차에 치여 뒤집히면 번갈아 연타해서 일어나기']]],
      ['🚗 자동차', [['F', '차 타기 · 빼앗기 · 내리기'], ['H (차 안)', '📯 빵빵 경적'], ['W / S', '가속 / 후진'], ['A / D', '핸들'], ['Space', '브레이크 (헬기는 상승)'], ['Shift', '부스트 (헬기는 하강)'], ['왼쪽 클릭', '전차 주포 · 헬기 미사일']]],
    ];
    this.openModal(`<h3 class="mh">⌨️ 조작법 <small>H 키로 열고 닫아요</small></h3>
      <div class="keys">${groups.map(([t, rows]) => `<div class="keygroup"><b>${t}</b>${rows.map(([k, d]) => `<div class="keyrow"><span class="kk">${K(k)}</span><span>${d}</span></div>`).join('')}</div>`).join('')}</div>
      <div class="keynote">* 3단 점프 · 대쉬 거리 강화 · 점프력 강화는 무릉도장 🥋 수련으로 배워요. 처음 화면을 클릭하면 마우스가 화면에 고정되고, Esc로 풀 수 있어요.</div>
      <div style="margin-top:12px"><button class="btn" id="keys-ok">알겠어요! 🎮 <kbd>H</kbd></button> <button class="btn ghost" id="keys-bug" title="곰돌이 젤리 ↔ 바퀴벌레 모습 바꾸기 (내 화면에서만)"></button></div>`, 'keys');
    $('modal-inner').classList.add('wide');
    $('keys-ok').onclick = () => this.closeModal();
    const bugBtn = () => { $('keys-bug').textContent = settings.bugMode ? '🐻 젤리 모드로' : '🪳 바퀴 모드로'; };
    $('keys-bug').onclick = () => { this.setBugMode(!settings.bugMode); bugBtn(); };
    bugBtn();
    try { localStorage.setItem('roachcity.keysSeen', '1'); } catch { /* 무시 */ }
  }
  setLocked(v) { this.locked = v; }

  buildNeeds() {
    const el = $('needs-card');
    el.innerHTML = `<div class="need hp"><span>❤️</span><span>체력 <b id="hp-num">100</b></span><div class="bar"><div id="need-hp" style="background:#ff5252"></div></div></div><div class="need mana-row"><span>💧</span><span>마나</span><div class="bar"><div id="need-mana"></div></div></div>` + NEEDS.map(([k, ic, nm, col]) => `<div class="need"><span>${ic}</span><span>${nm}</span><div class="bar"><div id="need-${k}" style="background:${col}"></div></div></div>`).join('');
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, 3600);
    setTimeout(() => el.remove(), 4100);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  // ---------------- 패널 상태 ----------------
  anyPanelOpen() { return !$('chat').classList.contains('hidden') || !$('phone').classList.contains('hidden') || !$('modal').classList.contains('hidden'); }
  chatOpen() { return !$('chat').classList.contains('hidden'); }
  escape() {
    if (!$('confirm').classList.contains('hidden')) { this.confirmResolve?.(false); return; }
    if (!$('modal').classList.contains('hidden')) this.closeModal();
    else if (!$('phone').classList.contains('hidden')) this.closePhone();
    else if (this.chatOpen()) this.closeChat();
  }

  async flash() {
    const f = $('fade');
    $('fade-text').textContent = '';
    $('fade-bar').style.display = 'none';
    f.style.transition = 'opacity .18s'; f.style.opacity = '0';
    f.classList.remove('hidden');
    await sleep(10); f.style.opacity = '1';
    await sleep(200);
    setTimeout(() => { f.style.opacity = '0'; setTimeout(() => { f.classList.add('hidden'); $('fade-bar').style.display = ''; }, 200); }, 120);
  }

  async fade(text, ms) {
    const f = $('fade');
    f.style.opacity = '1';
    $('fade-text').textContent = text;
    f.classList.remove('hidden');
    const bar = $('fade-bar').firstElementChild;
    bar.style.transition = 'none'; bar.style.width = '0';
    await sleep(30);
    bar.style.transition = `width ${ms}ms linear`; bar.style.width = '100%';
    await sleep(ms + 100);
    f.classList.add('hidden');
  }

  // ---------------- HUD ----------------
  update(dt) {
    const g = this.game;
    const S = g.stats;
    $('clock-day').textContent = `${g.day() + 1}일차 · ${DAYS[g.day() % 7]}요일 · ${g.weather}`;
    this.renderOnlineBar();
    $('clock-time').textContent = fmtTime(g.minutes);
    if (!$('phone').classList.contains('hidden')) this.updatePhoneClock();
    $('money').textContent = `₩${Math.floor(S.money)}`;
    const job = g.playerJob();
    $('job-label').textContent = job ? `${job.name}` : '무직';
    for (const [k] of NEEDS) { const el = $('need-' + k); if (el) el.style.width = `${S.needs[k]}%`; }
    $('need-hp').style.width = `${(g.hp / g.maxHp) * 100}%`;
    $('need-mana').style.width = `${((g.mana || 0) / (g.maxMana || 100)) * 100}%`;
    const L = S.level || 1, need = expNeed(L);
    $('lv').textContent = `Lv.${L}`;
    $('xp-fill').style.width = `${Math.min(100, ((S.exp || 0) / need) * 100)}%`;
    $('xp-txt').textContent = `${S.exp || 0}/${need}`;
    // 오래된 채팅은 흐리게
    if ((this.chatAgeT = (this.chatAgeT || 0) - dt) <= 0) { this.chatAgeT = 1; const now = Date.now(); for (const el of $('pchat-log').children) el.classList.toggle('old', now - (+el.dataset.t || 0) > 20000); }
    $('hp-num').textContent = Math.round(g.hp);
    const charm = g.charm();
    $('charm').textContent = `✨ 매력 ${charm}`;
    $('stars').innerHTML = g.stars ? '★'.repeat(g.stars) + '<span style="opacity:.25">' + '★'.repeat(5 - g.stars) + '</span>' : '';
    $('stars').classList.toggle('hidden', !g.stars);
    const sel = g.inv.selected();
    const d = sel ? itemDef(sel.id) : ITEMS.fist;
    const aim = !!g.player.inCar ? ['tank', 'heli'].includes(g.player.inCar.kind) : ['gun', 'launcher', 'throw', 'wand'].includes(d.cat) || !!d.odm;
    $('crosshair').classList.toggle('hidden', !(aim && this.locked));
    // 젤리병단 장비: 갈고리가 닿는 곳(95m 안의 건물 · 거대 젤리)을 겨누면 초록
    $('crosshair').classList.toggle('hookable', !!d.odm && !g.player.inCar && !!g.odm?.canHook());
    const ammoTxt = d.ammo ? ` · ${ammoName(d.ammo)} ${g.inv.count(d.ammo)}발` : d.cat === 'wand' ? ` · 💧${d.mana} · ${d.skill}` : d.skill ? ` · ${d.skill}` : '';
    const tmpTxt = sel?.expiresAt ? ` · ⏳ ${Math.max(0, Math.ceil((sel.expiresAt - Date.now()) / 60000))}분 남음` : '';
    $('weapon-name').textContent = g.player.inCar ? (g.player.inCar.kind === 'tank' ? '🪖 전차 주포' : g.player.inCar.kind === 'heli' ? '🚀 헬기 미사일' : '🚗 운전 중') : `${d.emoji} ${d.name}${sel?.gems?.length ? ' ' + sel.gems.map((x) => GEMS[x] ? '◆' : '').join('') : ''}${ammoTxt}${tmpTxt}`;
    if (this.hotbarT === undefined || (this.hotbarT -= dt) <= 0) { this.hotbarT = 10; this.renderHotbar(); } // 남은 시간 갱신
    // 위치
    $('location-label').textContent = g.mode === 'interior' ? `${g.interior.building.def.emoji} ${g.interior.building.name}` : `📍 ${g.placeText()}`;
    this.updateLabels();
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.1; this.drawMinimap(); }
  }

  setPrompt(f) {
    const el = $('prompt');
    if (!f || (!f.label && !f.carLabel)) { el.classList.add('hidden'); return; }
    let html = '';
    if (f.label) html += `<div class="row"><span class="key">${f.key || 'E'}</span>${escapeHtml(f.label)}</div>`;
    if (f.carLabel) html += `<div class="row"><span class="key">F</span>${escapeHtml(f.carLabel)}</div>`;
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.remove('hidden');
  }

  // 이름표 & 말풍선
  updateLabels() {
    const g = this.game;
    const cam = g.camera;
    const W = window.innerWidth, H = window.innerHeight;
    const pp = g.player.pos;
    const v = new THREE.Vector3();
    const seen = new Set();
    const place = (key, worldPos, html, cls) => {
      v.copy(worldPos).project(cam);
      if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) return;
      let el = this.labels.get(key);
      if (!el) { el = document.createElement('div'); $('labels').appendChild(el); this.labels.set(key, el); }
      el.className = cls;
      if (el._html !== html) { el.innerHTML = html; el._html = html; }
      el.style.left = `${(v.x * 0.5 + 0.5) * W}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * H}px`;
      el.style.display = '';
      seen.add(key);
    };
    for (const c of g.sim.citizens) {
      if (!c.visible) continue;
      const root = c.roach.root.position;
      const d = root.distanceTo(pp);
      const top = root.clone(); top.y += c.roach.height + 0.35;
      if (d < 13 || (c.hp < c.maxHp && d < 30)) {
        const heart = c.affinity >= 65 ? ' 💗' : '';
        const hpBar = c.hp < c.maxHp ? `<div class="hpbar"><div style="width:${(c.hp / c.maxHp) * 100}%"></div></div>` : '';
        const mood = c.mood < 38 || c.mood > 78 ? ' ' + moodEmoji(c.mood) : '';
        place('t' + c.id, top, `<span class="lvb">Lv.${c.level}</span>${escapeHtml(c.name)}${heart}${mood}<small>${c.mode === 'dead' ? '💫 기절' : `${escapeHtml(c.job.name)} · ${c.age}세`}</small>${hpBar}`, 'tag');
      }
      if (c.bubble && d < 35) {
        const b = top.clone(); b.y += d < 13 ? 0.9 : 0.2;
        place('b' + c.id, b, escapeHtml(c.bubble.text), 'bubble');
      }
    }
    for (const o of g.players.list.values()) {
      if (!o.visible) continue;
      const top = o.pos.clone(); top.y += o.roach.height + 0.35;
      const d = top.distanceTo(pp);
      const badges = (o.profile.badges || []).map((b) => `<span class="bdg">${escapeHtml(b)}</span>`).join('');
      if (d < 40) place('p' + o.id, top, `<span class="lvb">Lv.${o.profile.level || 1}</span>🎮 ${escapeHtml(o.name)}${o.stars ? ' <span style="color:#ffd600">' + '★'.repeat(o.stars) + '</span>' : ''}<small>${o.dead ? '💀' : escapeHtml(o.profile.jobName || '플레이어')}</small>${badges ? `<div class="bdgs">${badges}</div>` : ''}<div class="hpbar"><div style="width:${Math.min(100, (o.hp / (100 + ((o.profile.level || 1) - 1) * 6)) * 100)}%"></div></div>`, 'tag player');
      if (o.bubble && d < 40) { const b = top.clone(); b.y += 0.9; place('pb' + o.id, b, escapeHtml(o.bubble.text), 'bubble player'); }
    }
    // 내 이름표 (레벨 + 훈장)
    if (!g.player.fp && !g.player.inCar) {
      const top = g.player.pos.clone(); top.y += g.player.roach.height + 0.35;
      const badges = (g.profile.badges || []).map((b) => `<span class="bdg">${escapeHtml(b)}</span>`).join('');
      place('mytag', top, `<span class="lvb">Lv.${g.stats.level || 1}</span>${escapeHtml(g.profile.name)}${badges ? `<div class="bdgs">${badges}</div>` : ''}`, 'tag player mine');
    }
    if (g.myBubble && !g.player.inCar) {
      const top = g.player.pos.clone(); top.y += g.player.roach.height + 0.6;
      place('me', top, escapeHtml(g.myBubble.text), 'bubble player');
    }
    for (const u of g.units.list.values()) {
      if (!u.visible) continue;
      const top = u.obj.position.clone(); top.y += u.kind === 'tank' ? 4 : u.kind === 'heli' ? 4 : 2.3;
      if (top.distanceTo(pp) < 70) place('u' + u.id, top, `${{ cop: '🚓 경찰', soldier: '🪖 군인', tank: '🛡️ 전차', heli: '🚁 군용 헬기' }[u.kind]}<div class="hpbar enemy"><div style="width:${u.hp}%"></div></div>`, 'tag enemy');
    }
    for (const [i, r] of g.runners.list.entries()) if (r.bubble) { const b = r.r.root.position.clone(); b.y += 2.4; place('run' + i, b, escapeHtml(r.bubble.text), 'bubble'); }
    if (g.bouncerSay && g.mode === 'city') {
      const r = g.bouncerSay.b.bouncers[0].root.position.clone(); r.y += 3.4;
      place('bouncer', r, '🕶️ ' + escapeHtml(g.bouncerSay.text), 'bubble');
    }
    if (g.mode === 'city') {
      for (const [i, car] of g.traffic.cars.entries()) {
        if (!car.bubble) continue;
        const p = car.pos.clone(); p.y = car.height + 0.6;
        if (p.distanceTo(pp) < 40) place('car' + i, p, escapeHtml(car.bubble.text), 'bubble');
      }
      if (g.waypoint) {
        const p = g.waypoint.pos.clone(); p.y = 4;
        place('wp', p, `📍 ${escapeHtml(g.waypoint.label)}<small>${Math.round(g.routeLen || g.waypoint.pos.distanceTo(pp))}m</small>`, 'tag');
      }
    }
    for (const [k, el] of this.labels) if (!seen.has(k)) el.style.display = 'none';
  }

  // 미니맵: 미터 단위 좌표계로 세계 지도 + 도시 지도를 겹쳐 그린다
  drawMinimap() {
    const g = this.game;
    const cv = $('minimap');
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const p = g.mode === 'interior' ? g.interior.building.door : g.player.inCar ? g.player.inCar.pos : g.player.pos;
    const outside = Math.abs(p.x) > HALF || Math.abs(p.z) > HALF;
    const zoom = outside ? 0.55 : 1.6; // 화면 px / m (밖에서는 넓게)
    const yaw = g.player.cam.yaw;
    const k = 1 / zoom; // 1px 크기 (m)
    ctx.save();
    ctx.fillStyle = '#4fa3d9'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(yaw);
    ctx.scale(zoom, zoom);
    ctx.translate(-p.x, -p.z);
    if (g.worldImage) ctx.drawImage(g.worldImage, -WORLD_HALF, -WORLD_HALF, WORLD_HALF * 2, WORLD_HALF * 2);
    ctx.drawImage(g.mapImage, -HALF, -HALF, CITY, CITY);
    for (const c of g.sim.citizens) {
      if (c.location && c.mode !== 'park') continue;
      ctx.fillStyle = c.affinity >= 65 ? '#ff4f81' : '#6b4a3a';
      ctx.beginPath(); ctx.arc(c.pos.x, c.pos.z, 2.2 * k, 0, Math.PI * 2); ctx.fill();
    }
    for (const car of g.traffic.cars) {
      if (car.mode === 'gone') continue;
      ctx.fillStyle = car.mode === 'player' ? '#ff6f91' : '#455a64';
      ctx.fillRect(car.pos.x - 2 * k, car.pos.z - 2 * k, 4 * k, 4 * k);
    }
    for (const a of g.animals?.list || []) {
      if (!a.alive || Math.abs(a.pos.x - p.x) > 200 || Math.abs(a.pos.z - p.z) > 200) continue;
      ctx.fillStyle = a.hostile ? '#ff5252' : '#fff59d';
      ctx.beginPath(); ctx.arc(a.pos.x, a.pos.z, 2.6 * k, 0, Math.PI * 2); ctx.fill();
    }
    for (const un of g.units.list.values()) {
      if (un.loc >= 0) continue;
      ctx.fillStyle = '#ff1744';
      ctx.beginPath(); ctx.arc(un.pos.x, un.pos.z, 3.5 * k, 0, Math.PI * 2); ctx.fill();
    }
    if (g.shopMarkers) {
      ctx.font = `${13 * k}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const m of g.shopMarkers) {
        const b = m.b;
        if (Math.abs(b.x - p.x) > S * k || Math.abs(b.z - p.z) > S * k) continue;
        ctx.save(); ctx.translate(b.x, b.z); ctx.rotate(-yaw);
        ctx.fillStyle = '#fffaf2'; ctx.strokeStyle = '#ff7e9a'; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.arc(0, 0, 9 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillText(b.def.emoji, 0, 0.5 * k);
        ctx.restore();
      }
    }
    for (const gi of g.ground.list.values()) {
      if (!gi.rarity || gi.loc !== -1) continue;
      ctx.fillStyle = gi.rarity.color; ctx.strokeStyle = '#000'; ctx.lineWidth = k;
      const x = gi.x, y = gi.z, r = 4 * k;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (g.route?.length) {
      ctx.strokeStyle = '#2979ff'; ctx.lineWidth = 3 * k; ctx.setLineDash([6 * k, 4 * k]);
      ctx.beginPath(); ctx.moveTo(p.x, p.z);
      for (const r of g.route) ctx.lineTo(r.x, r.z);
      ctx.stroke(); ctx.setLineDash([]);
    }
    // 글자·이모지는 화면을 따라 똑바로 세운다
    const upright = (x, z, fn) => { ctx.save(); ctx.translate(x, z); ctx.scale(k, k); ctx.rotate(-yaw); fn(); ctx.restore(); };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const home = g.homeBuilding();
    upright(home.x, home.z, () => { ctx.font = '16px sans-serif'; ctx.fillText(g.stats.homeId != null ? '🏡' : '🏨', 0, 0); });
    const wb = g.workBuilding();
    if (wb) upright(wb.x, wb.z, () => { ctx.font = '16px sans-serif'; ctx.fillText('💼', 0, 0); });
    if (g.waypoint) upright(g.waypoint.pos.x, g.waypoint.pos.z, () => { ctx.font = '16px sans-serif'; ctx.fillText('📍', 0, 0); });
    // 접속 중인 다른 플레이어 (닉네임과 위치)
    for (const o of g.players.list.values()) {
      const op = o.loc >= 0 ? g.city.buildings[o.loc].door : o.pos;
      upright(op.x, op.z, () => {
        ctx.fillStyle = '#7c4dff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 11px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(o.name, 0, -11); ctx.fillStyle = '#fff'; ctx.fillText(o.name, 0, -11);
      });
    }
    ctx.restore();
    // 플레이어 화살표
    ctx.save();
    ctx.translate(S / 2, S / 2);
    const h = g.player.inCar ? g.player.inCar.heading : g.player.heading;
    ctx.rotate(-(h - yaw) + Math.PI);
    ctx.fillStyle = '#ff6f91'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 북쪽 표시
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(yaw);
    ctx.fillStyle = '#e53935'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(0, -S / 2 + 16); ctx.rotate(-yaw);
    ctx.fillText('N', 0, 0);
    ctx.restore();
  }

  // ---------------- 대화 ----------------
  setupChat() {
    $('chat-close').onclick = () => this.closeChat();
    $('chat-send').onclick = () => this.sendChat();
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.sendChat(); }
      if (e.key === 'Escape') this.closeChat();
      e.stopPropagation();
    });
    $('chat-gift').onchange = () => {
      const v = $('chat-gift').value;
      if (v !== '') this.giveGift(v);
      $('chat-gift').value = '';
    };
  }

  openChat(c) {
    const g = this.game;
    if (this.chatC) this.closeChat();
    this.chatC = c;
    this.chatTalked = false;
    g.releaseMouse();
    // 플레이어도 상대를 바라봄
    const src = c.roach.root.position;
    g.player.heading = Math.atan2(src.x - g.player.pos.x, src.z - g.player.pos.z);
    // 어깨 너머로 상대를 비추는 카메라
    g.player.cam.yaw = g.player.heading + Math.PI - 0.55;
    g.player.cam.pitch = 0.22;
    this.prevDist = g.player.cam.dist;
    g.player.cam.dist = 5.5;
    $('chat').classList.remove('hidden');
    $('chat-avatar').style.background = c.color;
    $('chat-avatar').innerHTML = CUTE_ROACH + CUTE_BEAR;
    $('chat-name').textContent = c.name;
    $('chat-sub').textContent = `${c.age}세 · ${c.gender} · ${c.job.name} · ${c.personality.name} · 기분 ${moodEmoji(c.mood)}`;
    this.renderProfile(c);
    this.refreshAffinity();
    this.refreshGifts();
    $('chat-log').innerHTML = '';
    // 이전 대화 몇 줄
    const prev = (c.chatLog ||= []).slice(-4);
    if (prev.length) {
      this.addMsg('sys', '— 지난 대화 —');
      for (const m of prev) this.addMsg(m.role === 'user' ? 'me' : 'npc', m.content);
      this.addMsg('sys', '— 오늘 —');
    }
    if (!g.llm) this.addMsg('sys', '💤 서버에 LLM 키가 없어 기본 대사로 대화해요');
    $('chat-input').value = '';
    $('chat-input').focus();
    this.request(null, { greeting: true });
  }

  renderProfile(c) {
    const g = this.game;
    const rels = [...c.relations.entries()].slice(0, 6).map(([id, r]) => `${escapeHtml(g.sim.citizens[id].name)}(${r.label})`).join(', ');
    $('chat-profile').innerHTML = `
      <b>역할</b> ${escapeHtml(c.familyText)} · ${escapeHtml(c.socialRole)}<br>
      <b>직장</b> ${c.work ? escapeHtml(c.work.name) : '없음'} · <b>집</b> ${escapeHtml(c.home.name)}<br>
      <b>취미</b> ${escapeHtml(c.hobby)} · <b>꿈</b> ${escapeHtml(c.dream)}<br>
      <b>지금</b> ${escapeHtml(c.activityText())}<br>
      <b>아는 사이</b> ${rels || '-'}${needBars(c)}`;
  }

  refreshAffinity() {
    const c = this.chatC;
    if (!c) return;
    $('chat-affinity-bar').style.width = `${c.affinity}%`;
    $('chat-affinity').title = `친밀도 ${Math.round(c.affinity)}/100`;
  }

  refreshGifts() {
    const items = this.game.stats.items.filter((it) => { const d = itemDef(it.id); return d.gift || d.cat === 'gem' || (d.price >= 100 && d.cat !== 'vehicle'); });
    const sel = $('chat-gift');
    sel.innerHTML = '<option value="">🎁 선물</option>' + items.map((it) => { const d = itemDef(it.id); return `<option value="${it.uid}">${d.emoji} ${escapeHtml(d.name)}</option>`; }).join('');
    sel.disabled = !items.length;
  }

  addMsg(kind, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + kind;
    el.textContent = text;
    $('chat-log').appendChild(el);
    $('chat-log').scrollTop = 1e9;
    return el;
  }

  // 서버로 보내고, 답은 onTalkReply로 받는다
  request(text, opts = {}) {
    const c = this.chatC;
    if (!c || this.busy) return;
    this.busy = true;
    this.typingEl = this.addMsg('npc typing', '...');
    clearTimeout(this.talkTimeout);
    this.talkTimeout = setTimeout(() => { if (this.busy) { this.typingEl?.remove(); this.busy = false; this.addMsg('sys', '⚠️ 응답이 없어요. 다시 말해보세요'); } }, 35000);
    this.game.talk(c, text, opts);
  }

  onTalkReply(m) {
    const c = this.chatC;
    if (!c || m.npc !== c.id) return;
    clearTimeout(this.talkTimeout);
    this.typingEl?.remove();
    this.busy = false;
    if (m.busy) {
      this.addMsg('sys', m.reason === 'grudge' ? `😠 ${c.name}은(는) 당신에게 화가 나서 말하기 싫대요` : m.reason ? `😱 ${c.name}은(는) 지금 대화할 상황이 아니에요` : `💬 ${c.name}은(는) 다른 플레이어와 대화 중이에요`);
      setTimeout(() => { if (this.chatC === c) this.closeChat(false); }, 1500);
      return;
    }
    const emo = EMOTE[m.emotion] || '';
    this.addMsg('npc', `${m.reply} ${m.delta > 0 ? '💗' : m.delta < 0 ? '💔' : ''}`.trim());
    c.chatLog.push({ role: 'assistant', content: m.reply });
    if (m.error) this.addMsg('sys', '⚠️ LLM 오류로 기본 대사를 사용했어요: ' + m.error.slice(0, 80));
    this.game.onTalkResult(c, m);
    if (m.mood !== undefined) c.mood = m.mood;
    if (m.insulted) this.addMsg('sys', `😠 ${c.name}의 기분이 크게 상했어요 (기분 ${moodLabel(c.mood)})`);
    else if (m.moodDelta >= 4) this.addMsg('sys', `😊 ${c.name}의 기분이 좋아졌어요`);
    if (m.reporting) this.addMsg('sys', `🚔 ${c.name}이(가) 경찰에 신고하러 가려고 해요!`);
    this.refreshAffinity();
    this.renderProfile(c);
    $('chat-sub').textContent = `${c.age}세 · ${c.gender} · ${c.job.name} · ${c.personality.name} · 기분 ${moodEmoji(c.mood)} ${emo}`;
    if (m.action === 'end') {
      this.addMsg('sys', `${c.name}이(가) 대화를 끝내고 싶어해요.`);
      setTimeout(() => { if (this.chatC === c) this.closeChat(); }, 2200);
    }
  }

  sendChat() {
    const t = $('chat-input').value.trim();
    if (!t || this.busy) return;
    $('chat-input').value = '';
    this.addMsg('me', t);
    this.chatC.chatLog.push({ role: 'user', content: t });
    this.chatTalked = true;
    this.request(t);
  }

  giveGift(u) {
    const c = this.chatC;
    const it = this.game.inv.find(u);
    if (!it || !c || this.busy) return;
    const d = itemDef(it.id);
    const item = `${d.name}(₩${d.price})`;
    this.game.inv.consume(u);
    this.refreshGifts();
    this.addMsg('sys', `🎁 ${c.name}에게 ${item}을(를) 선물했어요`);
    this.chatTalked = true;
    this.request(null, { note: `(플레이어가 ${item}을(를) 선물로 줬다. ${c.name}답게 반응해.)` });
  }

  closeChat() {
    const c = this.chatC;
    $('chat').classList.add('hidden');
    $('chat-input').blur();
    this.chatC = null;
    this.busy = false;
    this.typingEl?.remove();
    if (this.prevDist) { this.game.player.cam.dist = this.prevDist; this.prevDist = null; }
    if (c) this.game.endTalk(c);
  }

  // ---------------- 플레이어 채팅 ----------------
  focusPlayerChat() {
    $('pchat').classList.add('open');
    $('pchat-input').focus();
  }
  setupPlayerChat() {
    const inp = $('pchat-input');
    // 익명 채팅: 켜면 이름 대신 '🕶️ 익명'으로 보이고 머리 위 말풍선도 안 뜬다
    const setAnon = (on) => {
      this.anonChat = on;
      $('pchat').classList.toggle('anon', on);
      $('pchat-anon').textContent = on ? '🕶️ 익명 켬' : '🕶️ 익명 끔';
      inp.placeholder = on ? '익명으로 말하기... (Enter 전송 · Tab 실명으로 · Esc 닫기)' : '모두에게 말하기... (Enter 전송 · Tab 익명으로 · Esc 닫기)';
    };
    setAnon(false);
    $('pchat-anon').addEventListener('mousedown', (e) => e.preventDefault()); // 누를 때 입력창 포커스를 잃지 않게
    $('pchat-anon').onclick = () => setAnon(!this.anonChat);
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.isComposing) {
        const t = inp.value.trim();
        if (t) this.game.say(t, !!this.anonChat);
        inp.value = '';
        inp.blur();
      } else if (e.key === 'Tab') { e.preventDefault(); setAnon(!this.anonChat); }
      else if (e.key === 'Escape') inp.blur();
    });
    inp.addEventListener('blur', () => $('pchat').classList.remove('open'));
  }
  addChatLine(kind, text, name) {
    const el = document.createElement('div');
    el.className = 'pline ' + kind;
    el.innerHTML = name ? `<b>${escapeHtml(name)}</b> ${escapeHtml(text)}` : escapeHtml(text);
    $('pchat-log').appendChild(el);
    while ($('pchat-log').children.length > 30) $('pchat-log').firstChild.remove();
    $('pchat-log').scrollTop = 1e9;
    el.dataset.t = Date.now();
  }

  // ---------------- 잠 ----------------
  showSleep(on) {
    $('sleep').classList.toggle('hidden', !on);
    if (on) this.updateSleep();
  }
  updateSleep() {
    const g = this.game;
    if (!g.sleeping) return;
    const { n, total } = g.sleepers;
    const h = g.hour();
    const night = h >= 20 || h < 6;
    $('sleep-text').innerHTML = total <= 1
      ? (night ? '😴 쿨쿨... 곧 아침이 와요' : '😴 낮잠 자는 중... (밤 8시 이후에 자면 아침으로 넘어가요)')
      : `😴 자는 중... <b>${n}/${total}명</b>이 잠들었어요<br><small>${night ? '모두 잠들면 아침이 와요' : '밤 8시 이후에 모두 자면 아침으로 넘어가요'}</small>`;
  }

  kickedOut() {
    $('fade').classList.remove('hidden');
    $('fade').style.opacity = '1';
    $('fade-text').innerHTML = '🔌 다른 창이나 기기에서 이 캐릭터로 접속해서 연결을 끊었어요<br><small><a href="/jelly-city/" style="color:#ff8a65">처음 화면으로</a></small>';
    $('fade-bar').style.display = 'none';
  }

  // 서버가 재시작(배포)되면 다시 살아날 때까지 기다렸다가 자동으로 재접속
  disconnected() {
    $('fade').classList.remove('hidden');
    $('fade').style.opacity = '1';
    $('fade-text').innerHTML = '🔧 서버 업데이트 중...<br><small>20초 안에 복구돼요 · 돌아오면 자동으로 다시 접속해요</small>';
    $('fade-bar').style.display = 'none';
    try { sessionStorage.setItem('roachcity.resume', '1'); } catch { /* 무시 */ }
    this.game.net.send({ t: 'stats', stats: this.game.stats });
    const poll = async () => {
      try { const r = await fetch('/healthz', { cache: 'no-store' }); if (r.ok) { location.reload(); return; } } catch { /* 아직 */ }
      setTimeout(poll, 2000);
    };
    setTimeout(poll, 1500);
  }

  // ---------------- 휴대폰 ----------------
  setupPhone() {
    $('phone-close').onclick = () => this.closePhone();
    $('app-back').onclick = () => this.phoneHome();
    $('homebar').onclick = () => this.phoneHome();
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
  }

  togglePhone(tab) {
    if (!$('phone').classList.contains('hidden') && !tab) this.closePhone();
    else this.openPhone(tab);
  }
  closePhone() { $('phone').classList.add('hidden'); }
  // 홈 화면: 앱 아이콘
  phoneHome() {
    const g = this.game;
    this.phoneTab = null;
    $('phone-app').classList.add('hidden');
    $('phone-home').classList.remove('hidden');
    const unread = (g.sms || []).filter((m) => !m.mine && !m.read).length;
    const apps = [
      ['quests', '📋', '퀘스트', '#7e57c2'], ['camera', '📷', '카메라', '#455a64'], ['gallery', '🖼️', '사진', '#ffb300'], ['insta', '📸', '인스타', 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)'],
      ['tinder', '🔥', '튄더', 'linear-gradient(135deg,#ff6a3d,#ff2d6f)'], ['contacts', '📞', '연락처', '#43a047'], ['sms', '💬', '메시지', '#2ecc71', unread], ['police', '🚨', '112', '#e53935'],
      ['map', '🗺️', '지도', '#29b6f6'], ['online', '👥', '접속자', '#5c6bc0'], ['badges', '🏅', '훈장', '#ff8f00'], ['me', '🙂', '내 정보', '#8d6e63'],
      ['feedback', '💡', '건의하기', '#fdd835'], ['help', '❓', '도움말', '#78909c'], ['settings', '⚙️', '설정', '#9e9e9e'],
    ];
    if (g.admin) apps.push(['admin', '📮', '건의함', '#d81b60']);
    const icon = ([id, e, n, bg, badge]) => `<button class="app" data-app="${id}"><span class="ai" style="background:${bg}">${e}${badge ? `<i>${badge}</i>` : ''}</span><span class="an">${n}</span></button>`;
    $('ph-apps').innerHTML = apps.map(icon).join('');
    $('ph-dock').innerHTML = [['tinder', '🔥', '', 'linear-gradient(135deg,#ff6a3d,#ff2d6f)'], ['sms', '💬', '', '#2ecc71', unread], ['camera', '📷', '', '#455a64'], ['map', '🗺️', '', '#29b6f6']].map(icon).join('');
    this.phoneClockKey = null;
    this.updatePhoneClock();
    $('phone').querySelectorAll('[data-app]').forEach((b) => { b.onclick = () => this.openPhone(b.dataset.app); });
  }

  // 휴대폰 시계: 상태 표시줄과 홈 화면 큰 시계 모두 게임 시각. 열려 있는 동안 계속 간다
  updatePhoneClock() {
    const g = this.game;
    const m = Math.floor(g.minutes) % 1440, hh = Math.floor(m / 60), mm = m % 60; // HUD 시계(fmtTime)와 같은 계산
    const key = `${hh}:${mm}|${g.day()}|${g.weather}`;
    if (key === this.phoneClockKey) return;
    this.phoneClockKey = key;
    const hm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('ph-time').textContent = hm;
    $('ph-clock').innerHTML = `<b>${hm}</b><small>${g.day() + 1}일차 · ${DAYS[g.day() % 7]}요일 · ${escapeHtml(g.weather)}</small>`;
  }

  openPhone(tab) {
    if (this.chatOpen()) this.closeChat();
    this.game.releaseMouse();
    $('phone').classList.remove('hidden');
    this.phoneClockKey = null;
    this.updatePhoneClock();
    if (!tab || tab === 'citizens') { this.phoneHome(); return; }
    if (tab === 'online') { this.closePhone(); this.openOnline(); return; }
    if (tab === 'badges') { this.closePhone(); this.openBadges(); return; }
    this.phoneTab = tab;
    $('phone-home').classList.add('hidden');
    $('phone-app').classList.remove('hidden');
    $('app-title').textContent = APP_TITLES[tab] || '';
    const body = $('phone-body');
    body.scrollTop = 0;
    const g = this.game;
    if (PHONE_APPS[tab]) { PHONE_APPS[tab](this, body, g); return; }
    if (tab === 'citizens_removed') {
      body.innerHTML = `<input class="search" id="cit-search" placeholder="이름, 직업, 성격으로 검색... (총 ${g.sim.citizens.length}명)" /><div class="grid" id="cit-grid"></div>`;
      const render = (q) => {
        const list = g.sim.citizens.filter((c) => !q || `${c.name}${c.job.name}${c.personality.name}${c.socialRole}${c.home.name}`.includes(q));
        list.sort((a, b) => b.affinity - a.affinity);
        $('cit-grid').innerHTML = list.map((c) => `
          <div class="cit" data-id="${c.id}">
            <div class="av" style="background:${c.color}">${CUTE_ROACH}${CUTE_BEAR}</div>
            <div><div class="nm">${escapeHtml(c.name)} ${c.affinity >= 65 ? '💗' : ''}</div>
            <div class="sb">${c.age}세 ${c.gender} · ${escapeHtml(c.job.name)}<br>${escapeHtml(c.personality.name)} · 친밀도 ${Math.round(c.affinity)}</div></div>
          </div>`).join('');
        $('cit-grid').querySelectorAll('.cit').forEach((el) => { el.onclick = () => this.showCitizen(g.sim.citizens[+el.dataset.id]); });
      };
      render('');
      $('cit-search').oninput = (e) => render(e.target.value.trim());
      $('cit-search').addEventListener('keydown', (e) => e.stopPropagation());
    } else if (tab === 'me') {
      const S = g.stats, P = g.profile;
      const job = g.playerJob();
      body.innerHTML = `<div class="profile-big">
        <h3>🙂 ${escapeHtml(P.name)}</h3>
        ${P.age}세 · ${escapeHtml(P.gender)} · ${escapeHtml(P.personality)}<br>
        💰 소지금 <b>₩${Math.floor(S.money)}</b><br>
        💼 직업 <b>${job ? `${escapeHtml(job.name)} @ ${escapeHtml(g.workBuilding().name)} (시급 ₩${job.wage})` : '무직 — 시청에서 일자리를 구해보세요'}</b><br>
        🏠 집 <b>${S.homeId != null ? escapeHtml(g.city.buildings[S.homeId].name) : '없음 (호텔 생활 중 · 부동산에서 구매)'}</b><br>
        🎒 가방 ${S.items.length}종 (I키로 열기) · ✨ 매력 ${g.charm()} · 🥋 무공 ${S.skills.length ? S.skills.map((k) => (SKILL_NAMES[k] || k)).join(', ') : '없음'}<br>
        📞 내 번호 <b>${escapeHtml(g.phone || '')}</b> · ⭐ Lv.${S.level || 1}
      </div>
      <div style="margin-top:12px">
        <button class="btn" id="go-home">🏠 집 위치 표시</button>
        ${job ? '<button class="btn" id="go-work">💼 직장 위치 표시</button><button class="btn ghost" id="quit-job">그만두기</button>' : '<button class="btn" id="go-hall">🏛️ 시청 위치 표시</button>'}
      </div>
      <div class="profile-big" style="margin-top:14px"><h3>👥 접속 중인 플레이어</h3>
        🎮 ${escapeHtml(P.name)} (나)${[...g.players.list.values()].map((o) => `<br>🎮 ${escapeHtml(o.name)} · ${escapeHtml(o.profile.jobName || '무직')} · ${o.loc >= 0 ? escapeHtml(g.city.buildings[o.loc].name) : '거리'}`).join('')}
      </div>`;
      $('go-home').onclick = () => this.setWaypoint(g.homeBuilding());
      if ($('go-work')) $('go-work').onclick = () => this.setWaypoint(g.workBuilding());
      if ($('go-hall')) $('go-hall').onclick = () => this.setWaypoint(g.city.byType.cityhall[0]);
      if ($('quit-job')) $('quit-job').onclick = () => { g.quitJob(); this.openPhone('me'); };
    } else if (tab === 'map') {
      body.innerHTML = `<canvas id="bigmap" width="1024" height="1024"></canvas><div style="text-align:center;font-size:13px;margin-top:6px;color:var(--ink-soft)">건물을 클릭하면 위치가 표시돼요 · 🏡 우리 집 · 💼 직장 · 🔴 나</div>`;
      const cv = $('bigmap');
      const ctx = cv.getContext('2d');
      ctx.drawImage(g.mapImage, 0, 0);
      const u = 1024 / CITY;
      const mark = (txt, x, z, size = 28) => { ctx.font = `${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, (x + HALF) * u, (z + HALF) * u); };
      const home = g.homeBuilding();
      mark('🏡', home.x, home.z, 30);
      if (g.workBuilding()) mark('💼', g.workBuilding().x, g.workBuilding().z, 30);
      const pp = g.mode === 'interior' ? g.interior.building.door : g.player.pos;
      ctx.fillStyle = '#ff1744'; ctx.beginPath(); ctx.arc((pp.x + HALF) * u, (pp.z + HALF) * u, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
      cv.onclick = (e) => {
        const r = cv.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * CITY - HALF, z = ((e.clientY - r.top) / r.height) * CITY - HALF;
        let best = null, bd = 18;
        for (const b of g.city.buildings) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
        if (best) this.setWaypoint(best);
      };
    } else if (tab === 'settings') {
      const st = this.serverStatus || {};
      body.innerHTML = `
        <div class="set-row"><b>🤖 서버 LLM</b><span>${g.llm ? `${escapeHtml(st.model || 'gpt-4o-mini')} 사용 중 ✅ (키는 서버에만 있어요)` : '키 없음 — 기본 대사 사용 중 💤'}</span></div>
        <div class="set-row"><b>⏱️ 시간 속도</b><span>현실 1초 = 게임 ${g.timeSpeed}분 (서버 설정, 모든 플레이어 공통)</span></div>
        <div class="set-row"><b>🖥️ 그래픽</b><select id="set-gfx">
          <option value="auto">자동 (지금: ${GFX[g.gfxLevel()].label})</option>
          ${[...LEVELS].reverse().map((k) => `<option value="${k}">${GFX[k].label}${k === detectLevel() ? ' · 이 컴퓨터 추천' : ''}</option>`).join('')}
        </select></div>
        <div class="set-gfx-help">${[...LEVELS].reverse().map((k) => `<div><b>${GFX[k].label}</b> — ${GFX[k].desc}<br><small>추천: ${GFX[k].rec}</small></div>`).join('')}
          <div><small>자동은 사양을 보고 고르고, 플레이 중 계속 느리면(30fps 아래) 한 단계씩 낮춰요. 렉이 있으면 한 단계 낮춰 보세요.</small></div></div>
        <div class="set-row"><label><input type="checkbox" id="set-fps" ${settings.showFps ? 'checked' : ''}/> 📈 FPS 표시 (오른쪽 아래)</label></div>
        <div class="set-row"><label><input type="checkbox" id="set-bug" ${settings.bugMode ? 'checked' : ''}/> 🪳 바퀴 모드 (끄면 모두 🐻 곰돌이 젤리로 보여요)</label></div>
        <div class="set-row"><label><input type="checkbox" id="set-music" ${settings.music ? 'checked' : ''}/> 🎵 배경음악</label><input type="range" id="set-music-vol" min="0" max="1" step="0.05" value="${settings.musicVol}"></div>
        <div class="set-row"><label><input type="checkbox" id="set-sfx" ${settings.sfx ? 'checked' : ''}/> 🔊 효과음 (무기·차·동물·비명 등)</label><input type="range" id="set-sfx-vol" min="0" max="1" step="0.05" value="${settings.sfxVol}"></div>
        <div class="set-row"><b>🎯 조준점 색</b><div class="xh-row">${XH_COLORS.map((c) => `<button class="xh-sw" data-xh="${c}" style="background:${c}" title="${c}"></button>`).join('')}<input type="color" id="set-xh" value="${escapeHtml(settings.crosshairColor)}" title="직접 고르기"><span class="xh-prev" id="xh-prev">＋</span></div></div>
        <div class="set-row"><b>🖱️ 마우스 감도</b><button class="btn ghost" id="set-sens">${sensOf('city').toFixed(2)}배 · 바꾸기</button></div>
        <button class="btn" id="set-save">저장</button>
        <button class="btn ghost" id="set-reset">👥 캐릭터 선택 화면으로</button>`;
      $('set-sens').onclick = () => openSens('city', () => { const b = $('set-sens'); if (b) b.textContent = `${sensOf('city').toFixed(2)}배 · 바꾸기`; });
      $('set-save').onclick = () => {
        if ($('set-gfx').value === 'auto' && settings.gfx !== 'auto') delete settings.gfxAuto; // 자동으로 돌아오면 사양부터 다시 본다
        settings.gfx = $('set-gfx').value;
        settings.showFps = $('set-fps').checked;
        if (settings.bugMode !== $('set-bug').checked) this.setBugMode($('set-bug').checked);
        saveSettings();
        const reload = g.applySettings();
        this.toast(reload ? '⚙️ 저장했어요 · 계단 현상 설정은 새로고침(F5)하면 적용돼요' : '⚙️ 설정을 저장했어요');
      };
      $('set-gfx').value = settings.gfx in GFX ? settings.gfx : 'auto';
      $('set-reset').onclick = () => g.resetSave();
      // 조준점 색은 고르는 즉시 적용·저장
      const pickXh = (c) => {
        settings.crosshairColor = c; saveSettings(); this.applyCrosshair();
        $('set-xh').value = c; $('xh-prev').style.color = c;
        body.querySelectorAll('[data-xh]').forEach((b) => b.classList.toggle('on', b.dataset.xh === c));
      };
      body.querySelectorAll('[data-xh]').forEach((b) => { b.onclick = () => pickXh(b.dataset.xh); });
      // 소리: 바꾸는 즉시 적용·저장
      const snd = () => {
        Object.assign(settings, { music: $('set-music').checked, musicVol: +$('set-music-vol').value, sfx: $('set-sfx').checked, sfxVol: +$('set-sfx-vol').value });
        saveSettings(); applyVolumes();
        $('tb-music').textContent = settings.music ? '🎵 음악 켬' : '🔇 음악 끔';
      };
      for (const id of ['set-music', 'set-music-vol', 'set-sfx', 'set-sfx-vol']) $(id).oninput = snd;
      $('set-xh').oninput = (e) => pickXh(e.target.value);
      pickXh(settings.crosshairColor);
    } else if (tab === 'help') {
      body.innerHTML = `<div class="profile-big">
        <h3>📘 젤리시티 생활 가이드</h3>
        <b>조작</b>: WASD 이동 · Shift 달리기 · Space 점프(배우면 2·3단) · C 대쉬 · 마우스(클릭 후) 시점 · 클릭 공격/먹기 · 1~0 핫바 · E 대화/입장/줍기 · F 차 타기/빼앗기 · Q 버리기 · I 가방 · M 지도 · R 자동 이동 · Enter 채팅 · Tab 휴대폰 · Esc 닫기<br>
        <b>생활</b>: 포만감·재미·사교·청결과 체력을 관리하세요. NPC들도 똑같은 욕구가 있어서 배고프면 밥을 먹으러 가고, 다치면 병원에 가요.<br>
        <b>직업</b>: 시청 🏛️ 일자리 게시판에서 직업을 골라 직장에서 일하세요.<br>
        <b>집</b>: 처음엔 호텔에서 지내요. 부동산 🏘️ 에서 집을 사면 그 집에서 자고 부활해요.<br>
        <b>무기 상점</b>: 관우네 병기점(삼국지), 젤리 택티컬(밀리터리·전차·헬기), 은하 무기상(광선검·블래스터). 보석상 💎 에서 보석을 사서 무기와 방어구에 박을 수 있어요.<br>
        <b>치장</b>: 모자 가게·안경원·옷가게의 아이템을 장착하면 매력이 올라가요. 클럽 🪩 은 누구나 들어갈 수 있어요.<br>
        <b>무릉도장</b> 🥋: 점프맵은 점프력 강화, 고급 점프맵은 3단 점프, 용암 징검다리는 대쉬 거리 강화를 배워요.<br>
        <b>범죄 · 112</b>: 경찰은 누군가 112에 신고해야만 출동해요. 시민은 맞으면 화가 나서 신고하고, 플레이어는 휴대폰 🚨 112에서 나를 공격한 사람을 신고할 수 있어요. 신고가 쌓이면 별 4~5개에 군대가 출동해요.<br>
        <b>레벨</b>: 일하기·퀘스트·수련·사격장·플레이어 쓰러뜨리기로 경험치를 얻어 레벨업! 레벨이 오르면 체력·파워·명중률이 좋아져요 (만렙 없음).<br>
        <b>마법</b>: 마법봉 공방 🪄 에서 화염·얼음·번개·바람·독·빛·어둠 지팡이를 팔아요. 마나 💧 를 써요.<br>
        <b>자동차</b>: 자동차 쇼룸 🏎️ 에서 스포츠카 5종 등 18종을 살 수 있어요. 차 키를 핫바에서 쓰면 내 앞으로 불러와요.<br>
        <b>멀티플레이</b>: 같은 서버의 동료들과 같은 도시, 같은 시간, 같은 이웃을 공유해요. 밤에 모두 잠들면 아침이 와요.      </div>`;
    }
  }

  setWaypoint(b) {
    const g = this.game;
    g.setWaypoint(b);
    this.toast(`📍 ${b.name} 위치를 표시했어요`);
    this.closePhone();
  }

  showCitizen(c) {
    const g = this.game;
    const rels = [...c.relations.entries()].map(([id, r]) => `${escapeHtml(g.sim.citizens[id].name)}(${r.label})`).join(', ');
    const where = c.location ? c.location : null;
    $('phone-body').innerHTML = `<div class="profile-big">
      <div style="display:flex;gap:14px;align-items:center"><div class="av" style="width:70px;height:70px;border-radius:50%;background:${c.color};display:grid;place-items:center;font-size:40px">${CUTE_ROACH}${CUTE_BEAR}</div>
      <div><h3>${escapeHtml(c.name)} ${c.affinity >= 65 ? '💗' : ''}</h3>${c.age}세 · ${c.gender} · 친밀도 ${Math.round(c.affinity)}/100</div></div>
      <b>직업</b> ${escapeHtml(c.job.name)} — ${escapeHtml(c.job.duty)} ${c.work ? `(${escapeHtml(c.work.name)})` : ''}<br>
      ${c.shift ? `<b>근무시간</b> ${fmtH(c.shift[0])} ~ ${fmtH(c.shift[1])}<br>` : ''}
      <b>성격</b> ${escapeHtml(c.personality.name)} — ${escapeHtml(c.personality.desc)}<br>
      <b>가족 내 역할</b> ${escapeHtml(c.familyText)} · <b>동네 역할</b> ${escapeHtml(c.socialRole)}<br>
      <b>집</b> ${escapeHtml(c.home.name)}<br>
      <b>취미</b> ${escapeHtml(c.hobby)} · <b>고민</b> ${escapeHtml(c.worry)} · <b>꿈</b> ${escapeHtml(c.dream)}<br>
      <b>지금</b> ${escapeHtml(c.activityText())}<br>
      <b>관계</b> ${rels || '-'}<br>${needBars(c)}
      <b>나에 대한 기억</b> ${c.memories.length ? c.memories.map(escapeHtml).join(' / ') : '아직 없음'}
      </div>
      <button class="btn" id="cit-find">📍 위치 표시</button> <button class="btn ghost" id="cit-back">← 목록</button>`;
    $('cit-back').onclick = () => this.openPhone('citizens');
    $('cit-find').onclick = () => {
      if (where) this.setWaypoint(where);
      else { g.waypoint = { pos: c.pos.clone(), label: c.name }; this.toast(`📍 ${c.name}의 현재 위치를 표시했어요`); this.closePhone(); }
    };
  }


  // ---------------- 핫바 & 가방 ----------------
  renderHotbar() {
    const g = this.game;
    if (!g.inv) return;
    const S = g.stats;
    const el = $('hotbar');
    el.innerHTML = S.hotbar.map((u, i) => {
      const it = u ? g.inv.find(u) : null;
      const d = it ? itemDef(it.id) : null;
      const rar = it?.expiresAt ? RARITY[it.rarity] : null;
      const ammo = d?.ammo ? g.inv.count(d.ammo) : null;
      const mins = it?.expiresAt ? Math.max(0, Math.ceil((it.expiresAt - Date.now()) / 60000)) : null;
      return `<div class="slot${i === S.sel ? ' sel' : ''}" data-i="${i}" ${rar ? `style="box-shadow:0 0 0 2px ${rar.color} inset, 0 0 10px ${rar.color}"` : ''}><span class="num">${(i + 1) % 10}</span>${d ? `<span class="ic">${d.emoji}</span>${(it.n || 1) > 1 ? `<span class="cnt">${it.n}</span>` : ''}${ammo !== null ? `<span class="cnt${ammo ? '' : ' empty'}">${ammo}</span>` : ''}${mins !== null ? `<span class="tmr">⏳${mins}분</span>` : ''}${it.gems?.length ? '<span class="gem">◆</span>' : ''}` : ''}</div>`;
    }).join('');
    el.querySelectorAll('.slot').forEach((s) => { s.onclick = () => g.inv.select(+s.dataset.i); });
    if (!$('modal').classList.contains('hidden') && this.modalKind === 'inv') this.renderInventory();
  }

  toggleInventory() {
    if (!$('modal').classList.contains('hidden') && this.modalKind === 'inv') { this.closeModal(); return; }
    this.openModal('<div id="inv-body"></div>', 'inv');
    this.renderInventory();
  }

  renderInventory() {
    const g = this.game, S = g.stats, inv = g.inv;
    const t = inv.totals();
    const CATS = { all: '전체', weapon: '⚔️ 무기', gear: '🛡️ 장비', food: '🍔 음식', key: '🔑 열쇠', etc: '🎁 기타' };
    const catOf = (d) => (isWeapon(d) || d.cat === 'ammo' ? 'weapon' : d.slot ? 'gear' : d.cat === 'food' ? 'food' : d.cat === 'key' || d.cat === 'carkey' ? 'key' : 'etc');
    this.invCat ||= 'all';
    const statLine = (d, it) => {
      const parts = [];
      if (isWeapon(d) && d.dmg) { const w = weaponStats(it.id, it.gems || []); parts.push(`공격 ${Math.round(w.dmg)}${d.pellets ? `×${d.pellets}` : ''}`, `사거리 ${Math.round(w.range)}`); }
      if (d.cat === 'wand') parts.push(`💧${d.mana} · ${d.skill}`);
      if (d.zoom) parts.push(`조준 ×${d.zoom}`);
      if (d.def) parts.push(`방어 ${d.def}`);
      if (d.charm) parts.push(`매력 ${d.charm}`);
      if (d.sockets) parts.push(`보석 ${(it.gems || []).length}/${d.sockets}${(it.gems || []).length ? ' ' + it.gems.map((x) => `<span style="color:${GEMS[x].color}">◆</span>`).join('') : ''}`);
      if (d.food) parts.push(Object.entries(d.food).map(([k, v]) => `${{ hunger: '🍚', energy: '☕', fun: '🎉' }[k] || k}+${v}`).join(' ') + (d.heal ? ` ❤️+${d.heal}` : '') + (d.mana ? ` 💧+${d.mana}` : ''));
      if (d.ammo) parts.push(`탄약 ${ammoName(d.ammo)} ${inv.count(d.ammo)}발`);
      if (it.car) parts.push(`${MODELS[it.car.kind]?.name || it.car.kind} · 핫바에서 쓰면 호출`);
      if (it.expiresAt) parts.push(`<span style="color:${RARITY[it.rarity]?.color || '#999'}">[${RARITY[it.rarity]?.name || ''}] ⏳ ${Math.max(0, Math.ceil((it.expiresAt - Date.now()) / 60000))}분 남음</span>`);
      return parts.join(' · ');
    };
    const nameOf = (it, d) => (it.key ? `${d.name} · ${g.homeLabelOf(it.key)}` : it.car ? `🔑 ${MODELS[it.car.kind]?.name || '차'} 키` : d.name);
    const slotsHtml = Object.entries(SLOTS).map(([k, nm]) => {
      const it = S.equip[k] ? inv.find(S.equip[k]) : null;
      const d = it ? itemDef(it.id) : null;
      return `<div class="eq" ${it ? `data-pick="${it.uid}"` : ''}><span class="eqn">${nm}</span><span class="eqi">${d ? d.emoji : '·'}</span><b>${d ? escapeHtml(d.name) : '비어 있음'}</b></div>`;
    }).join('');
    const items = S.items.filter((it) => this.invCat === 'all' || catOf(itemDef(it.id)) === this.invCat);
    const sel = items.find((it) => it.uid === this.invPick) || items[0] || null;
    this.invPick = sel?.uid;
    const grid = items.map((it) => {
      const d = itemDef(it.id);
      const hb = S.hotbar.indexOf(it.uid);
      const rar = it.expiresAt ? RARITY[it.rarity] : null;
      return `<div class="ic-card ${it === sel ? 'sel' : ''}" data-pick="${it.uid}" ${rar ? `style="box-shadow:0 0 0 2px ${rar.color} inset"` : ''}>
        <span class="e">${d.emoji}</span>${(it.n || 1) > 1 ? `<span class="n">${it.n}</span>` : ''}${inv.isEquipped(it.uid) ? '<span class="eqb">장착</span>' : ''}${hb >= 0 ? `<span class="hb">${(hb + 1) % 10}</span>` : ''}
        <small>${escapeHtml(nameOf(it, d)).slice(0, 14)}</small></div>`;
    }).join('') || '<div style="padding:20px;color:var(--ink-soft)">비어 있어요</div>';
    let detail = '<div class="inv-detail empty">아이템을 골라보세요</div>';
    if (sel) {
      const d = itemDef(sel.id);
      const hb = S.hotbar.indexOf(sel.uid);
      const eq = inv.isEquipped(sel.uid);
      const usable = isWeapon(d) || ['food', 'doll', 'carkey', 'key', 'rod', 'mount'].includes(d.cat);
      detail = `<div class="inv-detail"><div class="big">${d.emoji}</div><b>${escapeHtml(nameOf(sel, d))}${(sel.n || 1) > 1 ? ` ×${sel.n}` : ''}</b><small>${statLine(d, sel) || (d.price ? `가격 ₩${d.price}` : '')}</small>
        <div class="acts">
          ${d.slot ? `<button class="btn" data-eq="${sel.uid}">${eq ? '장착 해제' : '장착하기'}</button>` : ''}
          ${usable ? `<div class="hbpick">핫바 ${[...Array(10)].map((_, i) => `<button class="hbb ${hb === i ? 'on' : ''}" data-hb="${sel.uid}" data-i="${i}">${(i + 1) % 10}</button>`).join('')}</div>` : ''}
          ${sel.key ? `<button class="btn" data-keyloc="${sel.uid}">📍 집 위치</button>` : sel.car ? '' : `<button class="btn ghost" data-drop="${sel.uid}">버리기</button>`}
        </div></div>`;
    }
    $('inv-body').innerHTML = `<h3 class="mh">🎒 가방 <small>💰 ₩${Math.floor(S.money).toLocaleString()} · ⭐ Lv.${S.level || 1} · 🛡️ 방어 ${t.def} · ✨ 매력 ${t.charm} · ❤️ ${Math.round(g.hp)}/${g.maxHp}</small></h3>
      <div class="eqrow">${slotsHtml}</div>
      <div class="skills">🥋 무공: 2단 점프 · 대쉬(C)${S.skills.length ? ' · ' + S.skills.map((k) => (SKILL_NAMES[k] || k)).join(', ') : ''} <small>(무릉도장에서 3단 점프·대쉬 거리·점프력 수련)</small></div>
      <div class="tabs-row">${Object.entries(CATS).map(([k, v]) => `<button class="btn mini ${k === this.invCat ? '' : 'ghost'}" data-cat="${k}">${v}</button>`).join('')}</div>
      <div class="inv-wrap"><div class="inv-grid">${grid}</div>${detail}</div>
      <div style="margin-top:10px"><button class="btn ghost" id="inv-close">닫기 (I)</button></div>`;
    $('modal-inner').classList.add('wide');
    const B = $('inv-body');
    $('inv-close').onclick = () => this.closeModal();
    B.querySelectorAll('[data-cat]').forEach((b) => { b.onclick = () => { this.invCat = b.dataset.cat; this.invPick = null; this.renderInventory(); }; });
    B.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { this.invPick = b.dataset.pick; this.renderInventory(); }; });
    B.querySelectorAll('[data-eq]').forEach((b) => { b.onclick = () => { inv.equip(b.dataset.eq); this.renderInventory(); }; });
    B.querySelectorAll('[data-hb]').forEach((b) => { b.onclick = () => { inv.setHotbar(+b.dataset.i, b.dataset.hb); this.renderInventory(); }; });
    B.querySelectorAll('[data-keyloc]').forEach((b) => { b.onclick = () => { const k = inv.find(b.dataset.keyloc).key; g.setWaypoint(g.city.buildings[k.bid], `🔑 ${g.homeLabelOf(k)}`); this.closeModal(); this.toast('📍 지도에 우리 집을 표시했어요'); }; });
    B.querySelectorAll('[data-drop]').forEach((b) => { b.onclick = async () => { await g.dropItem(b.dataset.drop); if (this.modalKind === 'inv' && !$('modal').classList.contains('hidden')) this.renderInventory(); }; });
  }

  // ---------------- 상점 ----------------
  // ---------------- 상점 목록 (U): 어디서든 가게를 골라 구경하고 바로 산다 ----------------
  openShopDirectory() {
    const g = this.game;
    const groups = [
      ['⚔️ 무기 · 마법 · 방어구', ['armory_3k', 'armory_mil', 'armory_sf', 'magicshop', 'hunter', 'jeweler']],
      ['🎽 패션', ['clothing', 'hatshop', 'eyewear']],
      ['🚗 탈것', ['dealer']],
      ['🍔 먹거리', ['convenience', 'burger', 'pizza', 'chicken', 'chinese', 'bunsik', 'gukbap', 'restaurant', 'bakery', 'cafe', 'seafood', 'ranch']],
      ['🎁 그 밖에', ['fishing', 'pharmacy', 'flowershop', 'bookstore']],
    ];
    const row = (type) => {
      const info = SHOPS[type]; if (!info) return '';
      const near = g.nearestShop(type);
      const emoji = near?.b.def.emoji || '🛒';
      return `<div class="item sd-row"><div class="ic">${emoji}</div><div class="info"><b>${escapeHtml(info.title)}</b><small>${escapeHtml(info.subtitle)}${near ? ` · 📍 ${Math.round(near.d)}m` : ''}</small></div>
        <div class="acts"><button class="btn mini" data-sd-buy="${type}">🛒 구경 · 구매</button>${near ? `<button class="btn mini ghost" data-sd-go="${type}">📍 길 안내</button>` : ''}</div></div>`;
    };
    this.openModal(`<h3 class="mh">🛒 상점 목록 <small>어디서든 바로 구경하고 살 수 있어요 · 물고기·전리품 팔기는 가게에 직접 가야 해요</small></h3>
      <div class="money-line">💰 소지금 <b>₩${Math.floor(g.stats.money).toLocaleString()}</b></div>
      ${groups.map(([title, types]) => `<div class="sd-group"><h4>${title}</h4><div class="itemlist">${types.map(row).join('')}</div></div>`).join('')}
      <div style="margin-top:12px"><button class="btn ghost" id="sd-close">닫기</button></div>`, 'shops');
    $('sd-close').onclick = () => this.closeModal();
    $('modal-inner').querySelectorAll('[data-sd-buy]').forEach((b) => {
      b.onclick = () => { const t = b.dataset.sdBuy; if (t === 'dealer') this.openDealer(); else this.openShop(t, { back: true }); };
    });
    $('modal-inner').querySelectorAll('[data-sd-go]').forEach((b) => {
      b.onclick = () => { const n = g.nearestShop(b.dataset.sdGo); if (n) { g.setWaypoint(n.b, `${n.b.def.emoji} ${n.b.name}`); this.closeModal(); this.toast(`📍 ${n.b.name}까지 길을 안내해요 (R: 자동으로 걷기)`); } };
    });
  }

  openShop(type, opts = {}) {
    const g = this.game;
    const info = SHOPS[type] || { title: '상점', subtitle: '' };
    const ids = shopItems(type);
    const desc = (id) => {
      const d = ITEMS[id];
      const p = [];
      if (d.cat === 'vehicle') p.push(d.vehicle === 'tank' ? '주포 발사 · 체력 1500' : '비행 · 미사일 · 체력 700');
      if (isWeapon(d)) p.push(`공격 ${d.dmg}${d.pellets ? `×${d.pellets}` : ''}`, `속도 ${(1 / d.rate).toFixed(1)}/초`, `사거리 ${d.range}`, d.radius ? `폭발 반경 ${d.radius}` : '', d.auto ? '연사' : '');
      if (d.def) p.push(`방어 ${d.def}`);
      if (d.charm) p.push(`매력 +${d.charm}`);
      if (d.sockets) p.push(`보석칸 ${d.sockets}`);
      if (d.gem) p.push(`무기: ${GEMS[d.gem].weapon} / 방어구: ${GEMS[d.gem].armor}`);
      if (d.food) p.push(Object.entries(d.food).map(([k, v]) => `${{ hunger: '포만감', energy: '활력', fun: '재미' }[k]} +${v}`).join(' '), d.heal ? `체력 +${d.heal}` : '');
      if (d.stack && d.cat === 'throw') p.push('3개 묶음');
      if (d.ammo) p.push(`탄약: ${ammoName(d.ammo)} (첫 ${ITEMS[d.ammo].pack}발 증정)`);
      if (d.cat === 'ammo') p.push(`${d.pack}발 묶음`);
      return p.filter(Boolean).join(' · ');
    };
    const html = `<h3 class="mh">${escapeHtml(info.title)} <small>${escapeHtml(info.subtitle)}</small></h3>
      <div class="money-line">💰 소지금 <b id="shop-money">₩${Math.floor(g.stats.money)}</b></div>
      <div class="shop-grid">${ids.map((id) => {
        const d = ITEMS[id];
        return `<div class="shop-item"><div class="ic">${d.emoji}</div><b>${escapeHtml(d.name)}</b><small>${desc(id)}</small><button class="btn mini" data-buy="${id}">₩${d.price.toLocaleString()}</button></div>`;
      }).join('')}</div>
      <div style="margin-top:12px">${opts.back ? '<button class="btn ghost" id="shop-back">← 상점 목록</button> ' : ''}<button class="btn ghost" id="shop-close">닫기</button></div>`;
    this.openModal(html, 'shop');
    $('shop-close').onclick = () => this.closeModal();
    if (opts.back) $('shop-back').onclick = () => this.openShopDirectory();
    $('modal-inner').querySelectorAll('[data-buy]').forEach((b) => {
      const d = ITEMS[b.dataset.buy];
      if (d.price > g.stats.money) b.classList.add('ghost');
      b.onclick = async () => { const ok = await g.buy(b.dataset.buy); if (ok && $('shop-money')) $('shop-money').textContent = `₩${Math.floor(g.stats.money)}`; };
    });
  }

  // ---------------- 인챈트 ----------------
  openEnchant() {
    const g = this.game, inv = g.inv;
    const targets = g.stats.items.filter((it) => (itemDef(it.id).sockets || 0) > (it.gems || []).length);
    const gems = g.stats.items.filter((it) => itemDef(it.id).cat === 'gem');
    let selT = targets[0]?.uid, selG = gems[0]?.uid;
    const render = () => {
      $('modal-inner').innerHTML = `<h3 class="mh">✨ 보석 인챈트 <small>비용 ₩${ENCHANT_FEE} · 한 번 박은 보석은 뺄 수 없어요</small></h3>
        <div class="ench">
          <div><b>1. 무기 / 방어구</b>${targets.map((it) => { const d = itemDef(it.id); return `<div class="pick${it.uid === selT ? ' on' : ''}" data-t="${it.uid}">${d.emoji} ${escapeHtml(d.name)} <small>${(it.gems || []).map((x) => `<span style="color:${GEMS[x].color}">◆</span>`).join('')} ${(it.gems || []).length}/${d.sockets}</small></div>`; }).join('') || '<small>보석 칸이 남은 장비가 없어요</small>'}</div>
          <div><b>2. 보석</b>${gems.map((it) => { const d = itemDef(it.id); const G2 = GEMS[d.gem]; return `<div class="pick${it.uid === selG ? ' on' : ''}" data-g="${it.uid}">${d.emoji} ${escapeHtml(d.name)} x${it.n || 1}<small>무기: ${G2.weapon}<br>방어구: ${G2.armor}</small></div>`; }).join('') || '<small>보석이 없어요. 보석을 먼저 사세요</small>'}</div>
        </div>
        <div style="margin-top:12px"><button class="btn" id="ench-go" ${selT && selG ? '' : 'disabled'}>💎 박기 (₩${ENCHANT_FEE})</button> <button class="btn ghost" id="ench-close">닫기</button></div>`;
      $('modal-inner').querySelectorAll('[data-t]').forEach((e) => { e.onclick = () => { selT = e.dataset.t; render(); }; });
      $('modal-inner').querySelectorAll('[data-g]').forEach((e) => { e.onclick = () => { selG = e.dataset.g; render(); }; });
      $('ench-close').onclick = () => this.closeModal();
      $('ench-go').onclick = () => { g.enchant(selT, selG); this.openEnchant(); };
    };
    this.openModal('', 'enchant');
    render();
    void inv;
  }

  // ---------------- 부동산 ----------------
  openHouses(tab = 'house') {
    const g = this.game;
    const owned = g.owned || {};
    const typeName = { house: '🏡 주택', villa: '🏘️ 빌라', apartment: '🏢 아파트', mine: '🔑 내 집' };
    const here = g.interior?.building || g.player.pos;
    const dist = (b) => Math.round(Math.hypot(b.x - here.x, b.z - here.z));
    let body = '';
    if (tab === 'mine') {
      body = g.myHomes.map((h) => {
        const b = g.city.buildings[h.bid];
        const main = h.bid === g.stats.homeId && h.unit === g.stats.homeUnit;
        return `<div class="item"><div class="ic">${b.def.emoji}</div><div class="info"><b>${escapeHtml(homeLabel(b, h.unit))}${main ? ' <span class="badge">대표 집</span>' : ''}</b><small>${b.suburb ? '🌳 교외' : '🏙️ 도심'} · 여기서 ${dist(b)}m · 되팔면 ₩${Math.round(housePrice(b, h.unit) * 0.8).toLocaleString()}</small></div>
          <div class="acts"><button class="btn mini ghost" data-see="${b.id}">위치</button>${main ? '' : `<button class="btn mini" data-main="${b.id}" data-unit="${escapeHtml(h.unit)}">대표 집으로</button>`}<button class="btn mini ghost" data-sell="${b.id}" data-unit="${escapeHtml(h.unit)}">팔기</button></div></div>`;
      }).join('') || '<div style="padding:16px">아직 집이 없어요. 매물을 둘러보세요!</div>';
    } else {
      const list = g.city.buildings.filter((b) => b.type === tab).map((b) => ({ b, free: freeUnits(b, owned[b.id] || []) })).filter((x) => x.free.length).sort((a, b) => dist(a.b) - dist(b.b));
      body = list.map(({ b, free }) => {
        const prices = free.map((u) => housePrice(b, u));
        const lo = Math.min(...prices), hi = Math.max(...prices);
        const size = tab === 'house' ? `${b.floors}층 단독 · ${Math.round(b.w * b.d)}㎡${b.suburb ? ' · 마당' : ''}` : `${b.floors}층 건물 · 빈 호수 ${free.length}개`;
        const pick = tab === 'house' ? '' : `<select class="mini" data-unitsel="${b.id}">${free.map((u) => `<option value="${u}">${u} · ₩${housePrice(b, u).toLocaleString()}</option>`).join('')}</select>`;
        return `<div class="item"><div class="ic">${b.def.emoji}</div><div class="info"><b>${escapeHtml(b.name)}</b><small>${b.suburb ? '🌳 교외 주택단지' : '🏙️ 도심'} · ${size} · 여기서 ${dist(b)}m</small></div>
          <div class="acts"><button class="btn mini ghost" data-see="${b.id}">위치</button>${pick}<button class="btn mini" data-house="${b.id}">${tab === 'house' ? `₩${lo.toLocaleString()}` : lo === hi ? `₩${lo.toLocaleString()}` : `₩${lo.toLocaleString()}~`} 구매</button></div></div>`;
      }).join('') || '<div style="padding:16px">지금은 매물이 없어요</div>';
    }
    const cur = g.stats.homeId != null ? homeLabel(g.city.buildings[g.stats.homeId], g.stats.homeUnit) : null;
    const html = `<h3 class="mh">🏘️ 부동산 <small>집을 사면 🔑 열쇠를 받아요. 대표 집에서 부활하고, 자고, 씻을 수 있어요</small></h3>
      <div class="money-line">💰 소지금 <b>₩${Math.floor(g.stats.money).toLocaleString()}</b> · ${cur ? `대표 집: ${escapeHtml(cur)}` : '집 없음 (호텔에서 부활)'} · 집 ${g.myHomes.length}/5채</div>
      <div class="tabs-row">${Object.entries(typeName).map(([k, v]) => `<button class="btn mini ${k === tab ? '' : 'ghost'}" data-tab="${k}">${v}</button>`).join('')}</div>
      <div class="itemlist">${body}</div>
      <div style="margin-top:12px"><button class="btn ghost" id="house-close">닫기</button></div>`;
    this.openModal(html, 'house');
    const M = $('modal-inner');
    $('house-close').onclick = () => this.closeModal();
    M.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => this.openHouses(b.dataset.tab); });
    M.querySelectorAll('[data-see]').forEach((b) => { b.onclick = () => { const bd = g.city.buildings[+b.dataset.see]; g.setWaypoint(bd, `${bd.def.emoji} ${bd.name}`); this.toast('📍 지도에 표시했어요'); }; });
    M.querySelectorAll('[data-house]').forEach((b) => {
      b.onclick = async () => {
        const bd = g.city.buildings[+b.dataset.house];
        const unit = bd.type === 'house' ? '단독' : M.querySelector(`[data-unitsel="${bd.id}"]`).value;
        const price = housePrice(bd, unit);
        if (!(await this.confirm(`${bd.def.emoji} <b>${escapeHtml(homeLabel(bd, unit))}</b><br>₩${price.toLocaleString()}에 살까요?`, '🏠 살게요'))) { this.openHouses(tab); return; }
        g.buyHouse(bd, unit); this.closeModal();
      };
    });
    M.querySelectorAll('[data-main]').forEach((b) => { b.onclick = () => { g.setMainHome(+b.dataset.main, b.dataset.unit); setTimeout(() => this.openHouses('mine'), 300); }; });
    M.querySelectorAll('[data-sell]').forEach((b) => {
      b.onclick = async () => {
        const bd = g.city.buildings[+b.dataset.sell];
        if (!(await this.confirm(`${escapeHtml(homeLabel(bd, b.dataset.unit))}을(를) ₩${Math.round(housePrice(bd, b.dataset.unit) * 0.8).toLocaleString()}에 팔까요?<br><small>열쇠가 사라져요</small>`, '🏷️ 팔기'))) { this.openHouses('mine'); return; }
        g.sellHouse(+b.dataset.sell, b.dataset.unit); setTimeout(() => this.openHouses('mine'), 300);
      };
    });
  }

  // ---------------- 미용실: 얼굴·더듬이·날개 바꾸기 ----------------
  openStyle(cost = 30) {
    const g = this.game;
    const orig = JSON.stringify(g.profile.look || DEFAULT_LOOK);
    const look = JSON.parse(orig);
    const p = g.player;
    this.prevCam = { yaw: p.cam.yaw, dist: p.cam.dist, pitch: p.cam.pitch };
    p.cam.yaw = p.heading - 0.5; p.cam.dist = 4.2; p.cam.pitch = 0.1;
    const render = () => {
      const chips = (key, part) => `<div class="opt-row"><div class="opt-label">${part.label}</div><div class="chips">${part.options.map((o, i) => `<button class="chip ${look[key] === i ? 'sel' : ''}" data-look="${key}" data-v="${i}">${o}</button>`).join('')}</div></div>`;
      const colors = (key, part) => `<div class="opt-row"><div class="opt-label">${part.label}</div><div class="chips">${part.options.map((c) => `<span class="swatch ${look[key] === c ? 'sel' : ''} ${c.startsWith('#') ? '' : 'sw-word'}" data-lookc="${key}" data-v="${c}" style="${c.startsWith('#') ? `background:${c}` : ''}">${c === 'auto' ? '자동' : c === 'none' ? '없음' : ''}</span>`).join('')}</div></div>`;
      this.openModal(`<h3 class="mh">💇 미용실 <small>거울을 보며 골라보세요 · ₩${cost}</small></h3>
        <div class="style-body">${chips('eyes', LOOK_PARTS.eyes)}${colors('pupil', LOOK_COLORS.pupil)}${chips('nose', LOOK_PARTS.nose)}${chips('mouth', LOOK_PARTS.mouth)}${colors('cheek', LOOK_COLORS.cheek)}${chips('antenna', LOOK_PARTS.antenna)}${chips('wings', LOOK_PARTS.wings)}${colors('belly', LOOK_COLORS.belly)}</div>
        <div style="margin-top:10px"><button class="btn" id="st-ok">이 스타일로! (₩${cost})</button> <button class="btn ghost" id="st-cancel">취소</button></div>`, 'recolor');
      const M = $('modal-inner');
      M.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => { look[b.dataset.look] = +b.dataset.v; g.setLook({ ...look }); render(); }; });
      M.querySelectorAll('[data-lookc]').forEach((b) => { b.onclick = () => { look[b.dataset.lookc] = b.dataset.v; g.setLook({ ...look }); render(); }; });
      const done = (apply) => {
        Object.assign(p.cam, this.prevCam);
        this.closeModal();
        if (!apply) { if (JSON.stringify(look) !== orig) g.setLook(JSON.parse(orig)); return; }
        if (JSON.stringify(look) === orig) return;
        if (g.stats.money < cost) { g.setLook(JSON.parse(orig)); this.toast('💸 돈이 부족해요!'); return; }
        g.stats.money -= cost;
        this.toast('💇 새 스타일 완성! 다들 알아볼까요? ✨');
      };
      $('st-ok').onclick = () => done(true);
      $('st-cancel').onclick = () => done(false);
    };
    render();
  }

  // ---------------- 식당 메뉴 ----------------
  openMenu(type, microwave = false) {
    const g = this.game;
    const info = SHOPS[type] || { title: '메뉴', subtitle: '' };
    const ids = shopItems(type).filter((id) => ITEMS[id].cat === 'food' && (!microwave || ['dosirak', 'cup_ramen', 'kimbap', 'sandwich'].includes(id)));
    const fx = (d) => Object.entries(d.food || {}).map(([k, v]) => `${{ hunger: '🍚', energy: '⚡', fun: '🎉' }[k]}+${v}`).join(' ') + (d.heal ? ` ❤️+${d.heal}` : '');
    const motion = { bite: '냠냠 베어 물기', slurp: '젓가락으로 후루룩', spoon: '그릇은 식탁에, 숟가락으로 떠먹기', drink: '꿀꺽꿀꺽', slice: '치즈 쭈욱~', drumstick: '두 손으로 와구와구', chopsticks: '젓가락으로 집어먹기', knife: '나이프·포크로 썰어먹기' };
    const html = `<h3 class="mh">${microwave ? '♨️ 전자레인지' : escapeHtml(g.interior.building.name)} <small>${escapeHtml(microwave ? '데워서 바로 먹어요' : info.subtitle)}</small></h3>
      <div class="money-line">💰 소지금 <b>₩${Math.floor(g.stats.money)}</b> · 매장에서 먹으면 배가 20% 더 불러요 · 포장은 가방에 보관돼요</div>
      <div class="itemlist">${ids.map((id) => { const d = ITEMS[id]; return `<div class="item"><div class="ic">${d.emoji}</div><div class="info"><b>${escapeHtml(d.name)} <span style="color:var(--accent)">₩${d.price}</span></b><small>${fx(d)} · ${motion[d.eat?.[0]] || ''}</small></div>
        <div class="acts"><button class="btn mini" data-eat="${id}">🍽️ 먹고 가기</button>${microwave ? '' : `<button class="btn mini ghost" data-take="${id}">🥡 포장</button>`}</div></div>`; }).join('')}</div>
      <div style="margin-top:12px"><button class="btn ghost" id="menu-close">닫기</button></div>`;
    this.openModal(html, 'menu');
    $('menu-close').onclick = () => this.closeModal();
    $('modal-inner').querySelectorAll('[data-eat]').forEach((b) => { b.onclick = () => g.eatIn(b.dataset.eat); });
    $('modal-inner').querySelectorAll('[data-take]').forEach((b) => { b.onclick = () => { if (g.takeout(b.dataset.take)) this.openMenu(type, microwave); }; });
  }

  // ---------------- 몸 색깔 ----------------
  openRecolor() {
    const g = this.game;
    const colors = [
      ['#8a5634', '초콜릿'], ['#a86b3e', '캐러멜'], ['#6e3f25', '다크 브라운'], ['#b07945', '꿀'], ['#c9a27e', '밀크티'],
      ['#ff9fb2', '딸기 우유'], ['#f48fb1', '핫핑크'], ['#ffab91', '복숭아'], ['#ffd54f', '레몬'], ['#e0b84a', '황금'],
      ['#7ec8a9', '민트'], ['#81c784', '연두'], ['#4db6ac', '청록'], ['#90caf9', '하늘'], ['#9fa8ff', '라벤더'],
      ['#b39ddb', '보라'], ['#eceff1', '눈사람'], ['#9e9e9e', '회색'], ['#37474f', '밤하늘'], ['#5d4037', '초코'],
    ];
    const orig = g.profile.color;
    let pick = orig;
    this.openModal(`<h3 class="mh">🎨 몸 색깔 바꾸기 <small>거울에 비친 모습을 보며 골라보세요</small></h3>
      <div class="swatches">${colors.map(([c, n]) => `<div class="swatch-big${c === orig ? ' sel' : ''}" data-c="${c}"><span style="background:${c}"></span>${n}</div>`).join('')}</div>
      <div style="margin-top:12px"><button class="btn" id="rc-ok">이 색으로 할래요</button> <button class="btn ghost" id="rc-cancel">취소</button></div>`, 'recolor');
    // 카메라를 정면으로 돌려 미리보기
    const p = g.player;
    this.prevCam = { yaw: p.cam.yaw, dist: p.cam.dist, pitch: p.cam.pitch };
    p.cam.yaw = p.heading - 0.5; p.cam.dist = 5; p.cam.pitch = 0.12; // 캐릭터가 화면 왼쪽에 보이도록
    const done = (apply) => {
      if (!apply && pick !== orig) g.setBodyColor(orig);
      Object.assign(p.cam, this.prevCam);
      this.closeModal();
      if (apply && pick !== orig) this.toast('🎨 새 몸 색깔이 마음에 들어요!');
    };
    $('modal-inner').querySelectorAll('[data-c]').forEach((el) => {
      el.onclick = () => {
        pick = el.dataset.c;
        $('modal-inner').querySelectorAll('.swatch-big').forEach((x) => x.classList.toggle('sel', x === el));
        g.setBodyColor(pick);
      };
    });
    $('rc-ok').onclick = () => done(true);
    $('rc-cancel').onclick = () => done(false);
  }

  // ---------------- 월드맵 ----------------
  // 지도: 스크롤로 확대·축소(마우스 위치 기준), 드래그로 이동, 클릭하면 목적지
  openWorldMap(view) {
    const g = this.game;
    const N = 1024; // 캔버스 해상도
    const MIN = N / (WORLD_HALF * 2), MAX = 14, CITYS = N / (CITY + 16);
    const pp0 = () => (g.mode === 'interior' ? g.interior.building.door : g.player.pos);
    // 열 때는 항상 전체 지도부터 (휠로 확대하면 상세 구역)
    const V = (this.mapCam ||= { cx: 0, cz: 0, s: MIN });
    if (view === 'city') Object.assign(V, { cx: 0, cz: 0, s: CITYS });
    else Object.assign(V, { cx: 0, cz: 0, s: MIN });
    this.openModal(`<h3 class="mh">🗺️ 지도 <kbd>M</kbd> <small>휠: 확대해서 상세 구역 보기 · 드래그: 이동 · 클릭: 목적지 · M/Esc: 닫기</small></h3>
      <div class="tabs-row"><button class="btn mini ghost" id="wm-world">🌍 전체 세계</button><button class="btn mini ghost" id="wm-city">🏙️ 젤리시티</button><button class="btn mini ghost" id="wm-me">📍 내 위치</button><button class="btn mini ghost" id="wm-in">＋</button><button class="btn mini ghost" id="wm-out">－</button></div>
      <canvas id="worldmap" width="${N}" height="${N}"></canvas>
      <div id="wm-info" class="money-line"></div>
      <div><button class="btn" id="wm-walk">🚶 자동으로 걸어가기 (R)</button> <button class="btn ghost" id="wm-clear">목적지 지우기</button> <button class="btn ghost" id="wm-close">닫기 (M)</button></div>`, 'map');
    $('modal-inner').classList.add('wide');
    const cv = $('worldmap');
    const clamp = () => {
      V.s = Math.min(MAX, Math.max(MIN, V.s));
      const lim = Math.max(0, WORLD_HALF - N / 2 / V.s);
      V.cx = Math.min(lim, Math.max(-lim, V.cx)); V.cz = Math.min(lim, Math.max(-lim, V.cz));
    };
    const X = (x) => (x - V.cx) * V.s + N / 2;
    const Z = (z) => (z - V.cz) * V.s + N / 2;
    const toWorld = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width * N - N / 2) / V.s + V.cx, z: ((e.clientY - r.top) / r.height * N - N / 2) / V.s + V.cz }; };
    const draw = () => {
      clamp();
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#4fa3d9'; ctx.fillRect(0, 0, N, N);
      if (g.worldImage) ctx.drawImage(g.worldImage, X(-WORLD_HALF), Z(-WORLD_HALF), WORLD_HALF * 2 * V.s, WORLD_HALF * 2 * V.s);
      ctx.drawImage(g.mapImage, X(-HALF), Z(-HALF), CITY * V.s, CITY * V.s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // 많이 확대하면 도시 건물 이름까지 보인다
      const cityNames = V.s >= CITYS * 0.75;
      const fs = Math.round(Math.min(16, Math.max(10, 9 + V.s * 1.4)));
      for (const b of g.city.buildings) {
        if (isHomeType(b) && !g.ownsHome?.(b)) continue;
        if (!cityNames && !b.outer) continue;
        const bx = X(b.x), bz = Z(b.z);
        if (bx < -80 || bx > N + 80 || bz < -40 || bz > N + 40) continue;
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        const w = ctx.measureText(b.name).width + 8;
        ctx.fillRect(bx - w / 2, bz + 9, w, fs + 4);
        ctx.fillStyle = '#4a3428'; ctx.fillText(cityText(b.name), bx, bz + 11 + fs / 2);
        if (b.outer || V.s > CITYS * 2) { ctx.font = `${fs + 4}px sans-serif`; ctx.fillText(b.def.emoji, bx, bz - 2); }
      }
      if (g.route?.length) {
        ctx.strokeStyle = '#2979ff'; ctx.lineWidth = 5; ctx.setLineDash([10, 6]);
        const from = pp0();
        ctx.beginPath(); ctx.moveTo(X(from.x), Z(from.z));
        for (const r of g.route) ctx.lineTo(X(r.x), Z(r.z));
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.font = '26px sans-serif';
      const home = g.homeBuilding();
      ctx.fillText(g.stats.homeId != null ? '🏡' : '🏨', X(home.x), Z(home.z) - 10);
      if (g.workBuilding()) ctx.fillText('💼', X(g.workBuilding().x), Z(g.workBuilding().z) - 10);
      if (g.waypoint) ctx.fillText('📍', X(g.waypoint.pos.x), Z(g.waypoint.pos.z) - 14);
      for (const o of g.players.list.values()) {
        const op = o.loc >= 0 ? g.city.buildings[o.loc].door : o.pos;
        ctx.fillStyle = '#7c4dff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(op.x), Z(op.z), 8, 0, 7); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 14px sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(o.name, X(op.x), Z(op.z) - 16); ctx.fillStyle = '#311b92'; ctx.fillText(o.name, X(op.x), Z(op.z) - 16);
      }
      const pp = pp0();
      ctx.fillStyle = '#ff1744'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(X(pp.x), Z(pp.z), 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#b71c1c'; ctx.fillText('나', X(pp.x), Z(pp.z) + 22);
      // 축척 막대
      const meters = [10, 25, 50, 100, 250, 500, 1000].find((m) => m * V.s >= 70) || 1000;
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(14, N - 54, Math.max(meters * V.s, 60) + 20, 40);
      ctx.fillStyle = '#263238'; ctx.fillRect(24, N - 24, meters * V.s, 4);
      ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${meters}m`, 26, N - 38);
      $('wm-info').innerHTML = g.waypoint ? `📍 목적지: <b>${escapeHtml(g.waypoint.label)}</b> · ${Math.round(g.routeLen || g.waypoint.pos.distanceTo(pp))}m` : '목적지를 클릭하세요';
    };
    draw();
    // 확대·축소: 마우스가 가리키는 곳을 기준으로
    const zoomAt = (k, e) => {
      const before = e ? toWorld(e) : { x: V.cx, z: V.cz };
      V.s = Math.min(MAX, Math.max(MIN, V.s * k));
      if (e) { const after = toWorld(e); V.cx += before.x - after.x; V.cz += before.z - after.z; }
      draw();
    };
    cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e); }, { passive: false });
    // 드래그 이동 (조금만 움직이면 클릭으로 본다)
    let drag = null;
    cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, cx: V.cx, cz: V.cz, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ } cv.style.cursor = 'grabbing'; };
    cv.onpointermove = (e) => {
      if (!drag) return;
      const r = cv.getBoundingClientRect(), k = N / r.width / V.s;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (drag.moved) { V.cx = drag.cx - dx * k; V.cz = drag.cz - dy * k; draw(); }
    };
    cv.onpointerup = (e) => {
      const d = drag; drag = null; cv.style.cursor = '';
      if (!d || d.moved) return;
      const { x, z } = toWorld(e);
      let best = null, bd = 18 / V.s + 2;
      for (const b of g.city.buildings) {
        if (isHomeType(b) && !g.ownsHome?.(b)) continue;
        if (V.s < CITYS * 0.75 && !b.outer && Math.abs(x) < HALF && Math.abs(z) < HALF) continue;
        const dd = Math.hypot(b.x - x, b.z - z); if (dd < bd) { bd = dd; best = b; }
      }
      if (best) g.setWaypoint(best); else g.setWaypoint(new THREE.Vector3(x, 0, z), '찍은 위치');
      draw();
    };
    // 다른 플레이어·내 위치가 움직이니 열려 있는 동안 1초마다 다시 그린다
    clearInterval(this.mapTimer);
    this.mapTimer = setInterval(() => { if (this.modalKind !== 'map' || $('modal').classList.contains('hidden') || !document.body.contains(cv)) { clearInterval(this.mapTimer); return; } if (!drag) draw(); }, 1000);
    $('wm-world').onclick = () => { Object.assign(V, { cx: 0, cz: 0, s: MIN }); draw(); };
    $('wm-city').onclick = () => { Object.assign(V, { cx: 0, cz: 0, s: CITYS }); draw(); };
    $('wm-me').onclick = () => { const p = pp0(); Object.assign(V, { cx: p.x, cz: p.z, s: Math.max(V.s, CITYS * 1.5) }); draw(); };
    $('wm-in').onclick = () => zoomAt(1.5);
    $('wm-out').onclick = () => zoomAt(1 / 1.5);
    $('wm-walk').onclick = () => { this.closeModal(); if (!g.autoWalk) g.toggleAutoWalk(); };
    $('wm-clear').onclick = () => { g.waypoint = null; g.route = null; g.autoWalk = false; draw(); };
    $('wm-close').onclick = () => this.closeModal();
  }

  // ---------------- 확인 창 ----------------
  // yes/no 버튼 글자는 상황마다 다르게 (기본: 확인 / 취소)
  confirm(html, yes = '확인', no = '취소') {
    $('confirm-text').innerHTML = html;
    $('confirm-yes').textContent = yes; $('confirm-no').textContent = no;
    $('confirm').classList.remove('hidden');
    this.game.releaseMouse();
    return new Promise((res) => { this.confirmResolve = (v) => { $('confirm').classList.add('hidden'); this.confirmResolve = null; res(v); }; });
  }

  // ---------------- 전투 HUD ----------------
  hurtFlash(by) {
    const el = $('hurt');
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    if (by && Date.now() - (this.lastHurtMsg || 0) > 3000) { this.lastHurtMsg = Date.now(); this.addChatLine('sys', `💥 ${by}에게 공격받고 있어요!`); }
  }
  showDeath(by) {
    $('death').classList.toggle('hidden', by === null);
    if (by !== null) $('death-text').innerHTML = `💀 쓰러졌어요...${by ? `<br><small>${escapeHtml(by)}에게 당했어요</small>` : ''}<br><small>잠시 후 집에서 체력이 가득 찬 채로 부활해요</small>`;
  }
  courseHud(text) {
    $('course').classList.toggle('hidden', !text);
    if (text) $('course').textContent = '🥋 ' + text;
  }
  xpPop(text) {
    const el = document.createElement('div');
    el.className = 'xp-pop'; el.textContent = text;
    $('xp-pops').appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }
  renderQuests() {
    const g = this.game, el = $('quest-card');
    const list = g.stats?.quests?.list || [];
    if (!list.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<b>📋 오늘의 퀘스트</b>` + list.map((q) => { const d = questDef(q.id); return `<div class="q ${q.done ? 'done' : ''}">${escapeHtml(d.text)}<span class="qp">${q.done ? '✅' : `${Math.floor(q.p)}/${d.n}`}</span></div>`; }).join('');
    if (!$('phone').classList.contains('hidden') && this.phoneTab === 'quests') this.openPhone('quests');
  }
  flipHud(n, need) {
    if (n === null || n === undefined) { $('flip').classList.add('hidden'); return; }
    $('flip').classList.remove('hidden');
    $('flip-fill').style.width = `${(n / need) * 100}%`;
  }
  // 맞혔을 때 조준점에 ✕ (block: 거대 젤리처럼 막힘)
  hitMarker(block = false) {
    const el = $('hitmarker');
    el.classList.toggle('block', block);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  applyCrosshair() {
    const c = /^#[0-9a-fA-F]{6}$/.test(settings.crosshairColor || '') ? settings.crosshairColor : '#ffffff';
    $('crosshair').style.setProperty('--crosshair', c);
  }
  setScope(on, zoom = null) {
    if (this.scopeOn !== on) { this.scopeOn = on; $('scope').classList.toggle('hidden', !on); $('crosshair').style.opacity = on ? '0' : ''; }
    if (on && zoom && this.scopeZoom !== zoom) { this.scopeZoom = zoom; $('scope-zoom').textContent = `${zoom}배율 · 휠로 조절`; }
  }
  drawMeter(k) {
    if (k === null) { if (!this.drawHidden) { $('draw-meter').classList.add('hidden'); this.drawHidden = true; } return; }
    this.drawHidden = false;
    $('draw-meter').classList.remove('hidden');
    $('draw-fill').style.width = `${k * 100}%`;
  }
  scorePop(text, color) {
    const el = $('score-pop');
    el.textContent = text; el.style.color = color || '#fff';
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }
  tvRemote(ch, handlers) {
    let el = $('tv-remote');
    if (!el) { el = document.createElement('div'); el.id = 'tv-remote'; document.body.appendChild(el); }
    if (!ch) { el.style.display = 'none'; return; }
    if (handlers) this.tvH = handlers;
    el.style.display = '';
    el.innerHTML = `<div class="tvr-ch">📺 ${ch.emoji} ${escapeHtml(ch.name)}</div><div class="tvr-btns"><button id="tvr-prev">◀ 이전</button><button id="tvr-power">⏻</button><button id="tvr-next">다음 ▶</button><button id="tvr-close">그만 보기</button></div><small>← → 키로도 채널을 바꿀 수 있어요 · 보는 동안 재미가 올라가요</small>`;
    $('tvr-prev').onclick = () => this.tvH.prev(); $('tvr-next').onclick = () => this.tvH.next(); $('tvr-power').onclick = () => this.tvH.power(); $('tvr-close').onclick = () => this.tvH.close();
  }
    // ---------------- 전리품 팔기 ----------------
  openSell() {
    const g = this.game;
    const items = g.stats.items.filter((it) => itemDef(it.id).sell > 0);
    this.openModal(`<h3 class="mh">💰 전리품 팔기 <small>가죽·고기·트로피를 사들여요</small></h3>
      <div class="money-line">💰 소지금 <b>₩${Math.floor(g.stats.money).toLocaleString()}</b></div>
      <div class="itemlist">${items.map((it) => { const d = itemDef(it.id); return `<div class="item"><div class="ic">${d.emoji}</div><div class="info"><b>${escapeHtml(d.name)} ×${it.n || 1}</b><small>개당 ₩${d.sell.toLocaleString()}</small></div><div class="acts"><button class="btn mini ghost" data-s1="${it.uid}">1개 팔기</button><button class="btn mini" data-sa="${it.uid}">모두 ₩${(d.sell * (it.n || 1)).toLocaleString()}</button></div></div>`; }).join('') || '<div style="padding:14px">팔 전리품이 없어요. 숲·늪·정글·아마존에서 사냥해 보세요! 🏹</div>'}</div>
      <div style="margin-top:10px"><button class="btn ghost" id="sell-close">닫기</button></div>`, 'sell');
    $('sell-close').onclick = () => this.closeModal();
    $('modal-inner').querySelectorAll('[data-s1]').forEach((b) => { b.onclick = () => { g.sell(b.dataset.s1, 1); this.openSell(); }; });
    $('modal-inner').querySelectorAll('[data-sa]').forEach((b) => { b.onclick = () => { g.sell(b.dataset.sa, 9999); this.openSell(); }; });
  }

  // ---------------- 잡아온 물고기 요리 ----------------
  openCookFish(kind) {
    const g = this.game;
    const fish = g.stats.items.filter((it) => itemDef(it.id).fish);
    const ok = (d) => (kind === 'spicy' ? d.spicy : d.raw);
    this.openModal(`<h3 class="mh">${kind === 'spicy' ? '🌶️ 매운탕 끓이기' : '🔪 회 뜨기'} <small>${kind === 'spicy' ? '매운탕: 참돔·광어·우럭·복어·대구·아귀·잉어·메기·붕어·쏘가리' : '회: 참치·문어·돌돔·참돔·광어·우럭·고등어·오징어·방어·전어·송어·쏘가리·빙어'}</small></h3>
      <div class="itemlist">${fish.map((it) => { const d = itemDef(it.id); const can = ok(d); return `<div class="item"><div class="ic">${d.emoji}</div><div class="info"><b>${escapeHtml(d.name)} ×${it.n || 1}</b><small>${can ? (kind === 'spicy' ? '매운탕 가능 ✅' : '회 가능 ✅') : it.id === 'fish_shark' ? '🦈 상어는 먹을 수 없어요' : kind === 'spicy' ? '매운탕으로는 안 돼요 ❌' : '회로는 안 돼요 ❌'}</small></div><div class="acts">${can ? `<button class="btn mini" data-eat="${it.uid}">🍽️ 바로 먹기</button><button class="btn mini ghost" data-take="${it.uid}">🥡 포장</button>` : ''}</div></div>`; }).join('') || '<div style="padding:14px">물고기가 없어요. 젤리 낚시터나 호수에서 낚아 오세요! 🎣</div>'}</div>
      <div style="margin-top:10px"><button class="btn ghost" id="cf-close">닫기</button></div>`, 'cook');
    $('cf-close').onclick = () => this.closeModal();
    $('modal-inner').querySelectorAll('[data-eat]').forEach((b) => { b.onclick = () => g.cookFish(b.dataset.eat, kind, true); });
    $('modal-inner').querySelectorAll('[data-take]').forEach((b) => { b.onclick = () => { g.cookFish(b.dataset.take, kind, false); this.openCookFish(kind); }; });
  }

  // ---------------- 접속 중인 플레이어 ----------------
  // 화면 상단 칩 줄: 나 → 다른 유저 순서, 넘치면 다음 줄로 (바뀔 때만 다시 그린다)
  renderOnlineBar() {
    const g = this.game;
    const chip = (id, lv, name, stars, me) => `<span class="oc${me ? ' me' : ''}"${me ? '' : ` data-pid="${id}" title="클릭하면 위치 표시"`}><b>Lv.${lv}</b>${escapeHtml(name)}${me ? ' (나)' : ''}${stars ? ` <i>${'★'.repeat(stars)}</i>` : ''}</span>`;
    const others = [...g.players.list.values()].sort((a, b) => a.id - b.id);
    const html = `<span class="oc cnt">👥 ${others.length + 1}명</span>` + chip(0, g.stats.level || 1, g.profile.name, g.stars || 0, true) + others.map((o) => chip(o.id, o.profile.level || 1, o.name, o.stars, false)).join('');
    if (html === this._onlineHtml) return;
    this._onlineHtml = html;
    const bar = $('online-bar');
    bar.innerHTML = html;
    // 토스트가 칩 줄을 가리지 않게 아래로 내린다
    $('toasts').style.top = `${bar.offsetTop + bar.offsetHeight + 8}px`;
  }

  openOnline() {
    const g = this.game;
    const me = g.player.pos;
    const where = (o) => (o.loc >= 0 ? g.city.buildings[o.loc]?.name : g.regionName?.(o.pos) || '젤리시티 거리');
    const rows = [...g.players.list.values()].map((o) => {
      const op = o.loc >= 0 ? g.city.buildings[o.loc].door : o.pos;
      const d = Math.round(op.distanceTo(me));
      return `<div class="item"><div class="ic">🎮</div><div class="info"><b><span class="lvb2">Lv.${o.profile.level || 1}</span> ${escapeHtml(o.name)}</b><small>${escapeHtml(o.profile.jobName || '무직')} · 📍 ${escapeHtml(where(o))} · ${d}m${o.stars ? ' · ' + '★'.repeat(o.stars) : ''}</small><div class="bdgline">${(o.profile.badges || []).map((b) => `<span class="bdg2">${escapeHtml(b)}</span>`).join('')}</div></div>
        <div class="acts"><button class="btn mini" data-goto="${o.id}">📍 위치</button>${d < 15 ? `<button class="btn mini ghost" data-num="${o.id}">📞 번호 교환</button>` : ''}</div></div>`;
    }).join('');
    this.openModal(`<h3 class="mh">👥 접속 중인 플레이어 <small>나 포함 ${g.players.list.size + 1}명</small></h3>
      <div class="item"><div class="ic">🙂</div><div class="info"><b><span class="lvb2">Lv.${g.stats.level || 1}</span> ${escapeHtml(g.profile.name)} (나)</b><small>📍 ${escapeHtml(g.placeText())}</small></div></div>
      <div class="itemlist">${rows || '<div style="padding:14px">지금은 나 혼자예요. 동료를 불러보세요!</div>'}</div>
      <div style="margin-top:10px"><button class="btn ghost" id="on-close">닫기</button></div>`, 'online');
    $('on-close').onclick = () => this.closeModal();
    $('modal-inner').querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => { const o = g.players.list.get(+b.dataset.goto); if (!o) return; const pos = o.loc >= 0 ? g.city.buildings[o.loc].door.clone() : o.pos.clone(); g.setWaypoint(o.loc >= 0 ? g.city.buildings[o.loc] : pos, `🎮 ${o.name}`); this.closeModal(); this.toast(`📍 ${o.name}님 위치를 표시했어요`); }; });
    $('modal-inner').querySelectorAll('[data-num]').forEach((b) => { b.onclick = () => g.net.send({ t: 'numReq', id: +b.dataset.num }); });
  }

  // ---------------- 훈장 고르기 ----------------
  openBadges() {
    const g = this.game, S = g.stats;
    const all = g.allBadges();
    const cur = S.badgeSel || null;
    const shown = new Set(cur || g.profile.badges?.map((t) => all.find((b) => b.text === t)?.key).filter(Boolean));
    this.openModal(`<h3 class="mh">🏅 내 훈장 <small>이름표 아래에 보여줄 훈장을 골라요 (최대 8개)</small></h3>
      <div class="badge-pick">${all.map((b) => `<label class="bp ${shown.has(b.key) ? 'on' : ''}"><input type="checkbox" data-k="${b.key}" ${shown.has(b.key) ? 'checked' : ''}> ${escapeHtml(b.text)}</label>`).join('')}</div>
      <p class="hint">재산 훈장은 지금 가진 돈이 그대로 보여요. 훈장은 집·자동차·전설무기·사냥·수배 기록 등을 모으면 늘어나요.</p>
      <div><button class="btn" id="bd-ok">저장</button> <button class="btn ghost" id="bd-close">닫기</button></div>`, 'badges');
    $('modal-inner').querySelectorAll('[data-k]').forEach((c) => { c.onchange = () => c.parentElement.classList.toggle('on', c.checked); });
    $('bd-close').onclick = () => this.closeModal();
    $('bd-ok').onclick = () => {
      S.badgeSel = [...$('modal-inner').querySelectorAll('[data-k]:checked')].map((c) => c.dataset.k).slice(0, 8);
      g.sendProfile(); this.closeModal(); this.toast('🏅 훈장을 바꿨어요!');
    };
  }

    safeBadge(on) {
    let el = $('safe-badge');
    if (!el) { el = document.createElement('div'); el.id = 'safe-badge'; el.textContent = '🛡️ 안전지대 — 여기서는 아무도 다치지 않아요'; document.body.appendChild(el); }
    el.style.display = on ? '' : 'none';
  }

  // 곰돌이 젤리 ↔ 바퀴 모드 (내 화면에서만 바뀐다)
  setBugMode(on, quiet = false) {
    settings.bugMode = !!on; saveSettings();
    Roach.setStyle(on ? 'roach' : 'gummy');
    setBrand(on); // 바퀴 모드일 때만 '바퀴시티', 아니면 '젤리시티'
    if (!quiet) this.toast(on ? '🪳 바퀴 모드! 모두 바퀴벌레로, 도시 이름은 바퀴시티로 보여요' : '🐻 곰돌이 젤리 모드! 모두 말랑한 젤리 곰이에요 (젤리시티)');
  }

  // 포획 타이밍 막대: 바늘이 초록칸에 있을 때 Z를 떼면 성공
  captureMeter(C) {
    let el = $('cap-meter');
    if (!el) { el = document.createElement('div'); el.id = 'cap-meter'; el.innerHTML = '<div class="cm-t"></div><div class="cm-bar"><div class="cm-zone"></div><div class="cm-needle"></div></div><div class="cm-s">바늘이 초록칸에 왔을 때 <kbd>Z</kbd>를 떼세요!</div>'; document.body.appendChild(el); }
    if (!C) { el.style.display = 'none'; this._capFor = null; return; }
    el.style.display = '';
    if (this._capFor !== C) {
      this._capFor = C;
      el.querySelector('.cm-t').textContent = `🪢 ${C.a.def.emoji} ${C.a.def.name} 포획 중…`;
      const z = el.querySelector('.cm-zone');
      z.style.left = `${(C.zone - C.width / 2) * 100}%`; z.style.width = `${C.width * 100}%`;
    }
    const inZone = Math.abs(C.needle - C.zone) <= C.width / 2;
    const n = el.querySelector('.cm-needle');
    n.style.left = `${C.needle * 100}%`; n.classList.toggle('in', inZone);
  }

  jailHud(left) {
    let el = $('jail-hud');
    if (!el) { el = document.createElement('div'); el.id = 'jail-hud'; document.body.appendChild(el); }
    if (left === null) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = `🔒 수감 중 · 석방까지 <b>${left}</b>초`;
  }
    rangeHud(text) { $('range-hud').classList.toggle('hidden', !text); if (text) $('range-hud').innerHTML = text; }
  shutter() { const f = $('shutter'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

  // ---------------- 자동차 쇼룸 ----------------
  openDealer() {
    const g = this.game;
    let pick = {};
    const render = () => {
      this.openModal(`<h3 class="mh">🏎️ 젤리 모터스 쇼룸 <small>사면 🔑 차 키를 받아요 · 핫바에서 키를 쓰면 언제든 내 앞으로 호출</small></h3>
        <div class="money-line">💰 소지금 <b>₩${Math.floor(g.stats.money).toLocaleString()}</b></div>
        <div class="itemlist">${DEALER_CARS.map(([kind, emoji, price]) => { const md = MODELS[kind] || BIKES[kind]; const c = pick[kind] || CAR_COLORS[0]; return `<div class="item"><div class="ic">${emoji}</div><div class="info"><b>${escapeHtml(md.name)} <span style="color:var(--accent)">₩${price.toLocaleString()}</span></b><small>최고속도 ${Math.round(md.max * 1.4 * 3.6 * 1.35)}km/h${BIKES[kind] ? ' · 🏍️ 이륜차' : md.sport ? ' · 🏁 스포츠카' : ''}</small><div class="carcols">${CAR_COLORS.map((cc) => `<span class="cc ${cc === c ? 'sel' : ''}" data-k="${kind}" data-c="${cc}" style="background:${cc}"></span>`).join('')}</div></div><div class="acts"><button class="btn mini" data-buy="${kind}" data-p="${price}">구매</button></div></div>`; }).join('')}</div>
        <div style="margin-top:10px"><button class="btn ghost" id="dl-close">닫기</button></div>`, 'dealer');
      const M = $('modal-inner');
      $('dl-close').onclick = () => this.closeModal();
      M.querySelectorAll('.cc').forEach((el) => { el.onclick = () => { pick[el.dataset.k] = el.dataset.c; const y = M.querySelector('.itemlist').scrollTop; render(); $('modal-inner').querySelector('.itemlist').scrollTop = y; }; });
      M.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = async () => { const k = b.dataset.buy; if (await this.confirm(`${escapeHtml((MODELS[k] || BIKES[k]).name)}을(를) ₩${(+b.dataset.p).toLocaleString()}에 살까요?`, '🏎️ 살게요')) g.buyCar(k, pick[k] || CAR_COLORS[0], +b.dataset.p); else render(); }; });
    };
    render();
  }

  lootBanner(title, sub, color, bonus) {
    const el = $('loot');
    el.style.setProperty('--rc', color);
    el.innerHTML = `<div class="lt">${escapeHtml(title)}</div><div class="ls">${escapeHtml(sub)}</div>${bonus ? `<div class="lb">${escapeHtml(bonus)}</div>` : ''}`;
    el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.lootT);
    this.lootT = setTimeout(() => el.classList.add('hidden'), 3600);
  }

  celebrate(title, sub) {
    const el = $('celebrate');
    el.innerHTML = `<div>${escapeHtml(title)}</div><small>${escapeHtml(sub)}</small>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }
  floatText(pos, text, color) {
    const v = pos.clone().project(this.game.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'floatnum';
    el.style.color = color;
    el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    $('labels').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ---------------- 모달 ----------------
  openModal(html, kind = 'misc') { this.game.releaseMouse(); this.modalKind = kind; $('modal-inner').classList.remove('wide'); $('modal-inner').innerHTML = html; $('modal').classList.remove('hidden'); }
  closeModal() { $('modal').classList.add('hidden'); }

  openJobBoard() {
    const g = this.game;
    const cur = g.playerJob();
    const groups = {};
    for (const j of JOBS) {
      if (j.max && g.sim.citizens.some((c) => c.job.id === j.id) && j.id === 'mayor') continue;
      (groups[j.building] ||= []).push(j);
    }
    const html = `<h3 style="font-family:Jua;margin:0 0 6px">📋 젤리시티 일자리 게시판</h3>
      <div style="font-size:13px;color:var(--ink-soft)">${cur ? `현재 직업: <b>${escapeHtml(cur.name)}</b> · ` : ''}마음에 드는 일을 골라보세요! 시급은 4시간 근무 단위로 받아요.</div>
      ${Object.entries(groups).map(([t, js]) => `<div style="margin-top:12px;font-family:Jua">${BUILDING_TYPES[t].emoji} ${BUILDING_TYPES[t].name}</div>
        <div class="job-list">${js.map((j) => `<div class="job" data-id="${j.id}"><b>${escapeHtml(j.name)}</b>₩${j.wage}/시간<br><span style="color:var(--ink-soft)">${escapeHtml(j.duty)}</span></div>`).join('')}</div>`).join('')}
      <div style="margin-top:14px"><button class="btn ghost" id="job-close">닫기</button></div>`;
    this.openModal(html);
    $('job-close').onclick = () => this.closeModal();
    document.querySelectorAll('#modal .job').forEach((el) => {
      el.onclick = () => { g.takeJob(JOBS.find((j) => j.id === el.dataset.id)); this.closeModal(); };
    });
  }
}

function S_home(g) { return g.stats.homeId; }
function fmtH(h) { return `${Math.floor(h) % 24}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function needBars(c) {
  const mc = c.mood >= 62 ? '#69f0ae' : c.mood >= 42 ? '#ffd54f' : c.mood >= 25 ? '#ffab40' : '#ff5252';
  const rows = [[moodEmoji(c.mood), `기분 ${moodLabel(c.mood)}`, c.mood, mc], ['❤️', '체력', (c.hp / c.maxHp) * 100, '#ff5252'], ...NEEDS.map(([k, ic, nm, col]) => [ic, nm, c.needs[k], col])];
  return `<div class="npc-needs">${rows.map(([ic, nm, v, col]) => `<div class="need"><span>${ic}</span><span>${nm}</span><div class="bar"><div style="width:${Math.round(v)}%;background:${col}"></div></div></div>`).join('')}</div>`;
}
