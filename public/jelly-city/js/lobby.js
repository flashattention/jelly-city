// 첫 화면: 구글 로그인 → 내 캐릭터 고르기 → (새 캐릭터 꾸미기)
import * as THREE from 'three';
import { Roach, GUMMY_COLORS } from '../../shared/js/roach.js';
// 젤리 모드에서는 젤리 색을 먼저, 바퀴 모드에서는 원래 피부색
const bodyColors = () => (Roach.style === 'roach' ? SKIN_COLORS : [...GUMMY_COLORS, ...SKIN_COLORS.filter((c) => !GUMMY_COLORS.includes(c))]);
import { PERSONALITIES } from './data.js';
import { ITEMS } from './items.js';
import { LOOK_PARTS, LOOK_COLORS, SKIN_COLORS, DEFAULT_LOOK, BASIC_ACC } from '../../shared/js/look.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SESSION_KEY = 'roachcity.session';
const CHAR_KEY = 'roachcity.char';
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 무시 */ } },
};
const SLOT_NAMES = { head: '🎩 머리', face: '👓 얼굴', body: '👕 몸', acc: '🎒 장신구' };
const starterVis = (starter) => Object.values(starter || {}).map((id) => ITEMS[id]?.vis).filter(Boolean);

export class Lobby {
  constructor() {
    this.status = null;
    this.session = store.get(SESSION_KEY);
    this.chars = [];
    this.user = null;
  }

  async api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(this.session ? { Authorization: `Bearer ${this.session}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  error(msg) {
    const el = $('start-error');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  show(view) {
    for (const v of ['v-login', 'v-select', 'v-create']) $(v).classList.toggle('hidden', v !== view);
    $('start-card').classList.toggle('wide', view === 'v-create');
    this.error('');
    if (view !== 'v-create') this.stopPreview();
  }

  // 결과: { session, char } 로 resolve
  async run(status, { resume = false } = {}) {
    this.status = status;
    $('start').classList.remove('hidden');
    return new Promise((resolve) => {
      this.resolve = (char) => { this.stopPreview(); store.set(CHAR_KEY, char); resolve({ session: this.session, char }); };
      this.boot(resume);
    });
  }

  async boot(resume) {
    if (this.session) {
      try {
        const me = await this.api('/api/me');
        this.user = me.user; this.chars = me.chars;
        const last = store.get(CHAR_KEY);
        if (resume && last && this.chars.some((c) => c.token === last)) { this.resolve(last); return; }
        if (await this.autostart()) return;
        this.renderSelect();
        return;
      } catch (e) {
        if (e.status === 401) { this.session = null; store.set(SESSION_KEY, null); }
        else { this.renderLogin(); this.error(`서버에 연결할 수 없어요 (${e.message})`); return; }
      }
    }
    if (await this.autostart()) return;
    this.renderLogin();
  }

  // 테스트용: ?autostart&name=이름 (개발용 로그인 서버에서만)
  async autostart() {
    const params = new URLSearchParams(location.search);
    if (!params.has('autostart') || !this.status?.devLogin) return false;
    const name = params.get('name') || '테스트';
    if (!this.session) await this.doLogin({ dev: name, password: params.get('pw') || '' }, true);
    if (!this.chars.length) {
      const look = { ...DEFAULT_LOOK };
      const r = await this.api('/api/chars', { method: 'POST', body: { profile: { name, gender: '여', age: 25, personality: '명랑한 수다쟁이', color: params.get('color') || '#8a5634', look }, starter: {} } });
      this.chars = r.chars;
    }
    this.resolve(this.chars[0].token);
    return true;
  }

  // ---------------- 로그인 ----------------
  renderLogin() {
    this.show('v-login');
    const s = this.status;
    $('pw-row').classList.toggle('hidden', !s?.password);
    $('guest-btn').onclick = () => this.doLogin({ guest: true });
    try { $('p-password').value = store.get('roachcity.pw') || ''; } catch { /* 무시 */ }
    if (s?.googleClientId) {
      $('dev-login').classList.add('hidden');
      this.loadGoogle().then(() => {
        /* global google */
        google.accounts.id.initialize({ client_id: s.googleClientId, callback: (r) => this.doLogin({ credential: r.credential }), ux_mode: 'popup', auto_select: false });
        $('g-btn').innerHTML = '';
        google.accounts.id.renderButton($('g-btn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: 280 });
      }).catch(() => this.error('구글 로그인 버튼을 불러오지 못했어요. 새로고침 해 주세요'));
    } else {
      $('g-btn').innerHTML = '<div class="g-missing">구글 로그인이 아직 설정되지 않은 서버예요' + (s?.devLogin ? '' : ' (관리자가 GOOGLE_CLIENT_ID를 설정해야 해요)') + '</div>';
      $('dev-login').classList.toggle('hidden', !s?.devLogin);
      $('dev-btn').onclick = () => this.doLogin({ dev: $('dev-name').value || '' });
      $('dev-name').onkeydown = (e) => { if (e.key === 'Enter') $('dev-btn').click(); };
    }
  }

  loadGoogle() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'https://accounts.google.com/gsi/client';
      sc.async = true; sc.onload = res; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }

  async doLogin(body, silent) {
    const password = body.password ?? $('p-password').value;
    store.set('roachcity.pw', password);
    const legacy = store.get('roachcity.token');
    try {
      const r = await this.api('/api/login', { method: 'POST', body: { ...body, password, legacy: legacy ? [legacy] : [] } });
      this.session = r.session; this.user = r.user; this.chars = r.chars;
      store.set(SESSION_KEY, r.session);
      if (legacy) store.set('roachcity.token', null);
      if (!silent) this.renderSelect();
    } catch (e) {
      this.error(e.message === 'password' ? '🔒 입장 비밀번호가 틀렸어요' : `로그인 실패: ${e.message}`);
      if (silent) throw e;
    }
  }

  // 닉네임 정하기 · 바꾸기 (모든 게임에서 같이 쓴다)
  editNick(first) {
    const box = $('who-name');
    box.innerHTML = `${first ? '<div class="nick-hint">구글 이름 대신 쓸 닉네임을 정해 주세요</div>' : ''}<input id="nick-in" maxlength="12" placeholder="닉네임 (2~12글자)" value="${esc(this.user?.nick || '')}" /> <button id="nick-save" class="btn mini">저장</button>`;
    const inp = $('nick-in'); inp.focus();
    const save = async () => {
      try { const r = await this.api('/api/nick', { method: 'POST', body: { nick: inp.value } }); this.user = r.user; this.error(''); this.renderSelect(); }
      catch (e) { this.error(e.message); inp.focus(); }
    };
    $('nick-save').onclick = save;
    inp.onkeydown = (e) => { if (e.key === 'Enter') save(); };
  }

  // ---------------- 캐릭터 고르기 ----------------
  renderSelect() {
    this.show('v-select');
    // 구글 실명 대신 직접 정한 닉네임 (처음이면 정하게 한다)
    $('who-name').innerHTML = `👋 <b>${esc(this.user?.name)}</b> <button id="nick-edit" class="btn ghost mini" title="닉네임 바꾸기">✏️</button>`;
    $('nick-edit').onclick = () => this.editNick(false);
    if (this.user?.needNick) this.editNick(true);
    $('logout-btn').onclick = async () => {
      try { await this.api('/api/logout', { method: 'POST' }); } catch { /* 무시 */ }
      this.session = null; store.set(SESSION_KEY, null);
      try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* 무시 */ }
      this.renderLogin();
    };
    const list = $('char-list');
    const cards = this.chars.map((c) => `
      <div class="char-card" data-tok="${c.token}">
        <img class="char-thumb" data-thumb="${c.token}" alt="">
        <div class="char-info">
          <b>${esc(c.profile?.name)}</b> <small>${c.profile?.gender === '남' ? '♂' : '♀'} ${c.profile?.age}살 · ${esc(c.profile?.personality)}</small>
          <div class="char-meta">💰 ₩${(c.money ?? 0).toLocaleString()} · ${c.job ? `💼 ${esc(c.job)}` : '무직'}<br>${c.home ? `🏠 ${esc(c.home)}` : '🏨 호텔 생활'}${c.online ? ' · 🟢 접속 중' : ''}</div>
        </div>
        <div class="char-acts"><button class="btn" data-play="${c.token}">플레이 ▶</button><button class="btn ghost mini" data-del="${c.token}" title="삭제">🗑️</button></div>
      </div>`).join('');
    const canMake = this.chars.length < 4;
    list.innerHTML = cards + (canMake ? `<div class="char-card new" id="new-char"><div class="plus">＋</div><div>새 캐릭터 만들기<br><small>${this.chars.length}/4</small></div></div>` : '');
    if (!this.chars.length) list.insertAdjacentHTML('afterbegin', '<p class="tagline">아직 캐릭터가 없어요. 나만의 캐릭터를 만들어 보세요! 🐻</p>');
    list.querySelectorAll('[data-play]').forEach((b) => { b.onclick = () => this.resolve(b.dataset.play); });
    list.querySelectorAll('.char-card[data-tok]').forEach((el) => { el.ondblclick = () => this.resolve(el.dataset.tok); });
    list.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const c = this.chars.find((x) => x.token === b.dataset.del);
        const typed = prompt(`정말 "${c.profile.name}" 캐릭터를 삭제할까요? 돈·아이템·집이 모두 사라져요.\n삭제하려면 캐릭터 이름을 입력하세요.`);
        if (typed !== c.profile.name) return;
        try { this.chars = (await this.api(`/api/chars/${c.token}`, { method: 'DELETE' })).chars; this.renderSelect(); } catch (e) { this.error(e.message); }
      };
    });
    if (canMake) $('new-char').onclick = () => this.renderCreate();
    // 썸네일
    for (const c of this.chars) {
      const img = list.querySelector(`[data-thumb="${c.token}"]`);
      if (img) img.src = this.thumb(c);
    }
  }

  thumb(c) {
    if (!this.thumbR) {
      this.thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.thumbR.setSize(160, 160);
      this.thumbR.outputColorSpace = THREE.SRGBColorSpace;
      this.thumbScene = new THREE.Scene();
      this.thumbScene.add(new THREE.HemisphereLight('#fff6e8', '#c9a28a', 1.4));
      const dl = new THREE.DirectionalLight('#ffffff', 1.5); dl.position.set(2, 4, 5); this.thumbScene.add(dl);
      this.thumbCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      this.thumbCam.position.set(0, 1.5, 5.6); this.thumbCam.lookAt(0, 1.05, 0);
    }
    const pr = c.profile || {};
    const r = new Roach({ own: true, seed: pr.name, color: pr.color, age: 25, gender: pr.gender, look: pr.look, accessories: pr.accessories?.length ? pr.accessories : starterVis(c.starter) });
    r.root.rotation.y = 0.35;
    r.update(0.016, 0);
    this.thumbScene.add(r.root);
    this.thumbR.render(this.thumbScene, this.thumbCam);
    const url = this.thumbR.domElement.toDataURL('image/png');
    this.thumbScene.remove(r.root);
    return url;
  }

  // ---------------- 캐릭터 만들기 ----------------
  renderCreate() {
    this.show('v-create');
    const d = this.draft = {
      name: '', gender: Math.random() < 0.5 ? '여' : '남', age: 25, personality: PERSONALITIES[0].name,
      color: Roach.style === 'roach' ? SKIN_COLORS[0] : GUMMY_COLORS[Math.floor(Math.random() * GUMMY_COLORS.length)], look: { ...DEFAULT_LOOK }, starter: { head: null, face: null, body: null, acc: null },
    };
    this.tab = 'basic';
    this.startPreview();
    this.renderTabs();
    $('create-back').onclick = () => this.renderSelect();
    $('create-random').onclick = () => { this.randomize(); this.renderTabs(); this.updatePreview(); };
    $('create-ok').onclick = async () => {
      const name = (d.name || '').trim();
      if (!name) { this.tab = 'basic'; this.renderTabs(); this.error('이름을 지어주세요!'); return; }
      $('create-ok').disabled = true;
      try {
        const r = await this.api('/api/chars', { method: 'POST', body: { profile: { name, gender: d.gender, age: d.age, personality: d.personality, color: d.color, look: d.look }, starter: d.starter } });
        this.chars = r.chars;
        this.resolve(r.char.token);
      } catch (e) { this.error(e.message); }
      $('create-ok').disabled = false;
    };
  }

  randomize() {
    const d = this.draft;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    d.color = pick(Roach.style === 'roach' ? SKIN_COLORS : GUMMY_COLORS);
    for (const [k, p] of Object.entries(LOOK_PARTS)) d.look[k] = Math.floor(Math.random() * p.options.length);
    for (const [k, p] of Object.entries(LOOK_COLORS)) d.look[k] = pick(p.options);
    for (const [slot, list] of Object.entries(BASIC_ACC)) d.starter[slot] = Math.random() < 0.7 ? pick(list)[0] : null;
  }

  renderTabs() {
    // 젤리 모드에서는 더듬이가 없으니 더듬이 탭을 숨긴다
    const tabs = Roach.style === 'roach' ? { basic: '📝 기본', body: '🎨 몸·날개', face: '😊 얼굴', antenna: '📡 더듬이', acc: '🎀 악세서리' } : { basic: '📝 기본', body: '🎨 젤리 색·날개', face: '😊 얼굴', acc: '🎀 악세서리' };
    $('create-tabs').innerHTML = Object.entries(tabs).map(([k, v]) => `<button class="${k === this.tab ? 'active' : ''}" data-tab="${k}">${v}</button>`).join('');
    $('create-tabs').querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.renderTabs(); }; });
    const d = this.draft;
    const chips = (key, part) => `<div class="opt-row"><div class="opt-label">${part.label}</div><div class="chips">${part.options.map((o, i) => `<button class="chip ${d.look[key] === i ? 'sel' : ''}" data-look="${key}" data-v="${i}">${o}</button>`).join('')}</div></div>`;
    const colors = (key, part) => `<div class="opt-row"><div class="opt-label">${part.label}</div><div class="chips">${part.options.map((c) => `<span class="swatch ${d.look[key] === c ? 'sel' : ''} ${c === 'auto' || c === 'none' ? 'sw-word' : ''}" data-lookc="${key}" data-v="${c}" style="${c.startsWith('#') ? `background:${c}` : ''}">${c === 'auto' ? '자동' : c === 'none' ? '없음' : ''}</span>`).join('')}</div></div>`;
    let html = '';
    if (this.tab === 'basic') {
      html = `<div class="opt-row"><div class="opt-label">이름</div><input id="c-name" maxlength="8" placeholder="8글자까지" value="${esc(d.name)}"></div>
        <div class="opt-row"><div class="opt-label">성별</div><div class="chips">${['여', '남'].map((g) => `<button class="chip ${d.gender === g ? 'sel' : ''}" data-gender="${g}">${g === '여' ? '♀ 여자' : '♂ 남자'}</button>`).join('')}</div></div>
        <div class="opt-row"><div class="opt-label">나이 <b id="c-age-v">${d.age}</b>살</div><input id="c-age" type="range" min="18" max="80" value="${d.age}"></div>
        <div class="opt-row"><div class="opt-label">성격</div><select id="c-pers">${PERSONALITIES.map((p) => `<option ${p.name === d.personality ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
    } else if (this.tab === 'body') {
      html = `<div class="opt-row"><div class="opt-label">${Roach.style === 'roach' ? '피부색' : '젤리 색'}</div><div class="chips">${bodyColors().map((c) => `<span class="swatch ${d.color === c ? 'sel' : ''}" data-skin="${c}" style="background:${c}"></span>`).join('')}</div></div>`
        + colors('belly', LOOK_COLORS.belly) + chips('wings', LOOK_PARTS.wings);
    } else if (this.tab === 'face') {
      html = chips('eyes', LOOK_PARTS.eyes) + colors('pupil', LOOK_COLORS.pupil) + chips('nose', LOOK_PARTS.nose) + chips('mouth', LOOK_PARTS.mouth) + colors('cheek', LOOK_COLORS.cheek);
    } else if (this.tab === 'antenna') {
      html = chips('antenna', LOOK_PARTS.antenna);
    } else {
      html = Object.entries(BASIC_ACC).map(([slot, list]) => `<div class="opt-row"><div class="opt-label">${SLOT_NAMES[slot]}</div><div class="chips">
        <button class="chip ${!d.starter[slot] ? 'sel' : ''}" data-acc="${slot}" data-v="">없음</button>
        ${list.map(([id, name, emoji]) => `<button class="chip ${d.starter[slot] === id ? 'sel' : ''}" data-acc="${slot}" data-v="${id}">${emoji} ${esc(name)}</button>`).join('')}</div></div>`).join('')
        + '<p class="hint">기본 악세서리는 가방에 들어 있어서 언제든 바꿔 낄 수 있어요. 더 멋진 건 시내 모자·안경·옷 가게에서!</p>';
    }
    const body = $('create-body');
    body.innerHTML = html;
    const re = () => { this.renderTabs(); this.updatePreview(); };
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => { d.look[b.dataset.look] = +b.dataset.v; re(); }; });
    body.querySelectorAll('[data-lookc]').forEach((b) => { b.onclick = () => { d.look[b.dataset.lookc] = b.dataset.v; re(); }; });
    body.querySelectorAll('[data-skin]').forEach((b) => { b.onclick = () => { d.color = b.dataset.skin; re(); }; });
    body.querySelectorAll('[data-gender]').forEach((b) => { b.onclick = () => { d.gender = b.dataset.gender; re(); }; });
    body.querySelectorAll('[data-acc]').forEach((b) => { b.onclick = () => { d.starter[b.dataset.acc] = b.dataset.v || null; re(); }; });
    if ($('c-name')) $('c-name').oninput = (e) => { d.name = e.target.value; };
    if ($('c-age')) $('c-age').oninput = (e) => { d.age = +e.target.value; $('c-age-v').textContent = d.age; this.updatePreview(); };
    if ($('c-pers')) $('c-pers').onchange = (e) => { d.personality = e.target.value; };
    // 얼굴 탭에서는 얼굴이 잘 보이도록 가까이
    this.zoom = this.tab === 'face' || this.tab === 'antenna' ? 1 : 0;
  }

  startPreview() {
    const el = $('create-preview');
    if (!this.pv) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio));
      r.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#fff6e8', '#c9a28a', 1.4));
      const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 5); scene.add(dl);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshToonMaterial({ color: '#ffe0ec' }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
      this.pv = { r, scene, cam, rotY: 0.3, drag: null };
      const c = r.domElement;
      c.addEventListener('pointerdown', (e) => { this.pv.drag = e.clientX; c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', (e) => { if (this.pv.drag != null) { this.pv.rotY += (e.clientX - this.pv.drag) * 0.012; this.pv.drag = e.clientX; } });
      c.addEventListener('pointerup', () => { this.pv.drag = null; });
    }
    el.innerHTML = '';
    el.appendChild(this.pv.r.domElement);
    this.zoom = 0; this.zoomK = 0;
    this.updatePreview();
    let last = performance.now();
    const loop = (now) => {
      if (!this.pvOn) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = el.clientWidth || 300, h = el.clientHeight || 300;
      if (this.pv.w !== w || this.pv.h !== h) { this.pv.r.setSize(w, h, false); this.pv.cam.aspect = w / h; this.pv.cam.updateProjectionMatrix(); this.pv.w = w; this.pv.h = h; }
      this.zoomK += (this.zoom - this.zoomK) * Math.min(1, dt * 5);
      const z = this.zoomK;
      if (this.pv.drag == null) {
        if (this.zoom) { // 얼굴을 볼 때는 정면 쪽으로 천천히 돌려 세운다
          const want = 0.35 * Math.sin(now / 1400);
          let d = ((want - this.pv.rotY) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
          this.pv.rotY += d * Math.min(1, dt * 4);
        } else this.pv.rotY += dt * 0.5;
      }
      this.pv.cam.position.set(0, 1.45 + z * 0.6, 5.4 - z * 1.9);
      this.pv.cam.lookAt(0, 1.0 + z * 0.95, 0);
      if (this.pvRoach) {
        this.pvRoach.root.rotation.y = this.pv.rotY;
        this.pvRoach.update(dt, 0);
        if (Math.random() < 0.003) this.pvRoach.wave();
      }
      this.pv.r.render(this.pv.scene, this.pv.cam);
      requestAnimationFrame(loop);
    };
    this.pvOn = true;
    requestAnimationFrame(loop);
  }
  stopPreview() { this.pvOn = false; }

  updatePreview() {
    if (!this.pv) return;
    const d = this.draft;
    if (this.pvRoach) this.pv.scene.remove(this.pvRoach.root);
    this.pvRoach = new Roach({ own: true, seed: d.name, color: d.color, age: d.age, gender: d.gender, look: d.look, accessories: starterVis(d.starter) });
    this.pvRoach.root.scale.setScalar(1);
    this.pv.scene.add(this.pvRoach.root);
  }
}
