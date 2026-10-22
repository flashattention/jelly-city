// 첫 화면: 구글 로그인 → 내 캐릭터 고르기 → (새 캐릭터 꾸미기)
import { DEFAULT_LOOK } from '../../shared/js/look.js';
import { Creator, thumbOf, DEFAULT_CHAR_KEY } from '../../shared/js/char-studio.js'; // 캐릭터 만들기 (메인 화면과 같이 씀)

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SESSION_KEY = 'roachcity.session';
const CHAR_KEY = 'roachcity.char';
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 무시 */ } },
};

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
        const last = store.get(CHAR_KEY) || store.get(DEFAULT_CHAR_KEY);
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

  thumb(c) { return thumbOf(c); }

  // ---------------- 캐릭터 만들기 ----------------
  renderCreate() {
    this.show('v-create');
    this.creator ||= new Creator({ preview: $('create-preview'), tabs: $('create-tabs'), body: $('create-body') });
    this.creator.open();
    $('create-back').onclick = () => this.renderSelect();
    $('create-random').onclick = () => this.creator.randomize();
    $('create-ok').onclick = async () => {
      const pr = this.creator.profile();
      if (!pr.name) { this.creator.tab = 'basic'; this.creator.renderTabs(); this.error('이름을 지어주세요!'); return; }
      $('create-ok').disabled = true;
      try {
        const r = await this.api('/api/chars', { method: 'POST', body: { profile: pr, starter: this.creator.draft.starter } });
        this.chars = r.chars;
        if (!store.get(DEFAULT_CHAR_KEY)) store.set(DEFAULT_CHAR_KEY, r.char.token);
        this.resolve(r.char.token);
      } catch (e) { this.error(e.message); }
      $('create-ok').disabled = false;
    };
  }
  stopPreview() { this.creator?.close(); }
}
