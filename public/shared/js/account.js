// 여러 게임이 같이 쓰는 계정: 젤리시티와 같은 로그인 세션(구글 · 체험판)을 쓴다
//   토스 미니앱에서는 토스 계정 · 토스 저장소를 따로 쓴다 (웹 계정 · 기록과 섞이지 않는다)
import { TOSS, API_BASE, bridge } from './platform.js';
export const SESSION_KEY = TOSS ? 'dreamrunner.toss.session' : 'roachcity.session';
// 토스 미니앱: 드림 러너 · 치장 API 는 토스 저장소(/api/toss/…)로, 주소는 우리 서버로 (미니앱은 토스 쪽 주소에서 열린다)
export function apiUrl(path) {
  if (TOSS) path = path.replace(/^\/api\/(dream|cos)\//, '/api/toss/$1/').replace(/^\/api\/nick$/, '/api/toss/nick');
  return API_BASE + path;
}

export const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 무시 */ } },
};

export const account = {
  session: store.get(SESSION_KEY),
  user: null,
  chars: [],
  async api(path, opts = {}) {
    const res = await fetch(apiUrl(path), {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(this.session ? { Authorization: `Bearer ${this.session}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error === 'password' ? '입장 비밀번호가 맞지 않아요' : data.error || `HTTP ${res.status}`); e.status = res.status; e.code = data.error; throw e; }
    return data;
  },
  status() { return this.api(TOSS ? '/api/toss/status' : '/api/status'); },
  // 저장된 세션이 아직 살아 있으면 내 정보 · 캐릭터 목록
  async restore() {
    if (!this.session) return false;
    try {
      if (TOSS) { const me = await this.api('/api/toss/me'); this.user = me.user; this.chars = []; this.admin = false; this.setCos(me.cos); return true; }
      const me = await this.api('/api/me');
      this.user = me.user; this.chars = me.chars || []; this.admin = !!me.admin; this.setCos(me.cos);
      if (this.admin) import('./admin-alert.js').then((m) => m.adminAlert()).catch(() => {}); // 운영자: 비상 리포트를 바로 띄운다
      return true;
    } catch (e) {
      if (e.status === 401) { this.session = null; store.set(SESSION_KEY, null); }
      return false;
    }
  },
  // body: { credential } (구글) · { guest: true } (체험판) · { dev: 이름 } (개발 서버)
  async login(body) {
    const r = await this.api(TOSS ? '/api/toss/login' : '/api/login', { method: 'POST', body: { ...body, password: store.get('roachcity.pw') || '' } });
    this.session = r.session; store.set(SESSION_KEY, r.session);
    this.user = r.user; this.chars = r.chars || []; this.setCos(r.cos);
    return r;
  },
  // 토스 미니앱: 토스 앱 안에서 바로 로그인 (SDK 가 없으면 개발 서버의 시험 계정)
  // 토스 미니앱: 토스 로그인 없이 이 기기 계정으로 (기록 · 별 · 치장이 남는다)
  tossDevice() { return this.login({ device: true }); },
  async tossLogin() {
    if (bridge?.appLogin) { const { authorizationCode, referrer } = await bridge.appLogin(); return this.login({ authorizationCode, referrer }); }
    return this.login({ dev: '토스 시험' });
  },
  async logout() {
    try { await this.api('/api/logout', { method: 'POST' }); } catch { /* 무시 */ }
    this.session = null; this.user = null; this.chars = []; this.cos = null; store.set(SESSION_KEY, null);
  },
  // 치장은 계정에 저장된다: 어느 게임이든 캐릭터 모습에 얹어 준다
  setCos(cos) { this.cos = cos || null; const eq = cos?.equip && Object.keys(cos.equip).length ? cos.equip : null; for (const c of this.chars) { c.profile ||= {}; c.profile.look = { ...(c.profile.look || {}) }; if (eq) c.profile.look.cos = eq; else delete c.profile.look.cos; } },
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
