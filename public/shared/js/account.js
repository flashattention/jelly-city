// 여러 게임이 같이 쓰는 계정: 젤리시티와 같은 로그인 세션(구글 · 체험판)을 쓴다
export const SESSION_KEY = 'roachcity.session';

export const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 무시 */ } },
};

export const account = {
  session: store.get(SESSION_KEY),
  user: null,
  chars: [],
  async api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(this.session ? { Authorization: `Bearer ${this.session}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error === 'password' ? '입장 비밀번호가 맞지 않아요' : data.error || `HTTP ${res.status}`); e.status = res.status; e.code = data.error; throw e; }
    return data;
  },
  status() { return this.api('/api/status'); },
  // 저장된 세션이 아직 살아 있으면 내 정보 · 캐릭터 목록
  async restore() {
    if (!this.session) return false;
    try {
      const me = await this.api('/api/me');
      this.user = me.user; this.chars = me.chars || [];
      return true;
    } catch (e) {
      if (e.status === 401) { this.session = null; store.set(SESSION_KEY, null); }
      return false;
    }
  },
  // body: { credential } (구글) · { guest: true } (체험판) · { dev: 이름 } (개발 서버)
  async login(body) {
    const r = await this.api('/api/login', { method: 'POST', body: { ...body, password: store.get('roachcity.pw') || '' } });
    this.session = r.session; store.set(SESSION_KEY, r.session);
    this.user = r.user; this.chars = r.chars || [];
    return r;
  },
  async logout() {
    try { await this.api('/api/logout', { method: 'POST' }); } catch { /* 무시 */ }
    this.session = null; this.user = null; this.chars = []; store.set(SESSION_KEY, null);
  },
  loadGoogle() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'https://accounts.google.com/gsi/client';
      sc.async = true; sc.onload = res; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  },
  // 구글 로그인 버튼을 el 안에 그린다. 로그인되면 onDone(결과)
  async googleButton(el, clientId, onDone, onError) {
    await this.loadGoogle();
    /* global google */
    google.accounts.id.initialize({
      client_id: clientId, ux_mode: 'popup', auto_select: false,
      callback: (r) => this.login({ credential: r.credential }).then(onDone, onError),
    });
    el.innerHTML = '';
    google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: 260 });
  },
};
