// 게임 공용 틀: 처음 화면(로그인 · 닉네임 · 캐릭터 · 설정 · 혼자/같이 하기 · 초대 코드) · 방 목록 · 방(초대 코드 · 팀 · 방장 설정)
//   게임은 new Shell({...}) 로 화면을 만들고, 출발(start) · 위치(snap) 같은 메시지만 직접 처리한다
import { account, store } from './account.js';
import { DEFAULT_CHAR_KEY, charLook } from './char-studio.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const TEAMS = { red: { name: '🍓 딸기팀', color: '#ff5a7a' }, blue: { name: '🫧 소다팀', color: '#4cc3ff' } };

// 초대 코드: 한글 자판 그대로 쳐도 (ㅗㅠㄹㅇㅜㅇ → HBFDND) 같은 자리의 영문으로
const KO_KEY = { ㅂ: 'Q', ㅈ: 'W', ㄷ: 'E', ㄱ: 'R', ㅅ: 'T', ㅛ: 'Y', ㅕ: 'U', ㅑ: 'I', ㅐ: 'O', ㅔ: 'P', ㅁ: 'A', ㄴ: 'S', ㅇ: 'D', ㄹ: 'F', ㅎ: 'G', ㅗ: 'H', ㅓ: 'J', ㅏ: 'K', ㅣ: 'L', ㅋ: 'Z', ㅌ: 'X', ㅊ: 'C', ㅍ: 'V', ㅠ: 'B', ㅜ: 'N', ㅡ: 'M',
  ㅃ: 'Q', ㅉ: 'W', ㄸ: 'E', ㄲ: 'R', ㅆ: 'T', ㅒ: 'O', ㅖ: 'P', ㅘ: 'HK', ㅙ: 'HO', ㅚ: 'HL', ㅝ: 'NJ', ㅞ: 'NP', ㅟ: 'NL', ㅢ: 'ML',
  ㄳ: 'RT', ㄵ: 'SW', ㄶ: 'SG', ㄺ: 'FR', ㄻ: 'FA', ㄼ: 'FQ', ㄽ: 'FT', ㄾ: 'FX', ㄿ: 'FV', ㅀ: 'FG', ㅄ: 'QT' };
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
function deHangul(str) {
  let out = '';
  for (const ch of String(str || '')) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c < 11172) for (const x of [CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)], JONG[c % 28]]) out += KO_KEY[x] || '';
    else out += KO_KEY[ch] || ch;
  }
  return out;
}
export const codeOf = (v) => deHangul(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export class Shell {
  // o = { key, title, subtitle, sound: { muted(), toggle() }, wsPath, max, keysHelp, multiLabel, buttons: [{ id, label, cls, solo }], options: { title(el, shell), room(el, opts, host, shell) }, onStart(m), onFinish(m), extraRow: [{ label, onClick }] }
  constructor(o) {
    this.o = o;
    this.KEY = { char: `${o.key}.char`, nick: `${o.key}.nick` };
    this.room = null; this.members = []; this.myId = 0; this.multi = false;
    this.net = { ws: null, open: false, handlers: {}, pendingJoin: null };
    this.mount();
    this.wire();
  }
  logged() { return !!account.session && !!account.user; }
  // ---------- 화면 만들기 ----------
  mount() {
    const o = this.o;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div id="title" class="screen"><div class="card">
      <a href="/" class="home-btn" title="메인으로">🏠</a>
      ${o.sound ? '<button class="home-btn snd-btn" data-snd title="소리 켜기 · 끄기 (M)">🔊</button>' : ''}
      <div class="logo">${o.title}</div>
      <div class="sub">${o.subtitle || ''}</div>
      <div id="login-box" class="hidden">
        <div id="pw-row" class="hidden"><input id="pw" type="password" placeholder="🔒 입장 비밀번호" autocomplete="current-password" /></div>
        <div id="g-btn"></div>
        <button id="guest-btn" class="btn ghost">🎮 체험판으로 시작 <small>구글 로그인 없이</small></button>
        <div id="dev-box" class="hidden"><input id="dev-name" placeholder="개발용 이름" /><button id="dev-btn" class="btn">입장</button></div>
        <div class="note">로그인하면 내 캐릭터로 하고 방을 만들 수 있어요.<br />로그인 없이도 혼자 하기 · 초대 코드로 같이 하기가 돼요</div>
      </div>
      <div id="who-row" class="who hidden"><span>안녕, <b id="me-name"></b></span><button id="nick-edit" class="mini" title="닉네임 바꾸기">✏️</button><button id="logout" class="mini">로그아웃</button></div>
      <div id="acct-nick" class="hidden"><div class="note" id="acct-nick-hint"></div><div class="row"><input id="acct-nick-in" maxlength="12" placeholder="닉네임 (2~12글자)" /><button id="acct-nick-save" class="btn alt">저장</button></div></div>
      <div id="chars-label" class="label hidden">누구로 할까요?</div>
      <div id="chars"></div>
      <div id="nick-row" class="hidden"><input id="nick" maxlength="14" placeholder="이름 (순위표 · 방에 보여요)" /></div>
      <div id="title-opts"></div>
      <div class="btns" id="play-btns">${(o.buttons || []).map((b) => `<button id="${b.id}" class="btn big ${b.cls || ''}">${b.label}</button>`).join('')}<button id="multi-btn" class="btn big alt">${o.multiLabel || '👥 같이 하기'} <small>최대 ${o.max || 8}명</small></button></div>
      <div class="row code-row"><input id="code-in" maxlength="6" placeholder="초대 코드 6자리" autocomplete="off" /><button id="code-btn" class="btn alt">🎟️ 코드로 참가</button></div>
      <div class="row2" id="title-row2">${(o.extraRow || []).map((b, i) => `<button class="btn ghost" data-extra="${i}">${b.label}</button>`).join('')}<a href="/" class="btn ghost">🏠 메인으로</a></div>
      <div class="keys">${o.keysHelp || ''}</div>
      <div id="err"></div>
    </div></div>
    <div id="lobby" class="screen hidden"><div class="card wide">
      ${o.sound ? '<button class="home-btn snd-btn" data-snd title="소리 켜기 · 끄기 (M)">🔊</button>' : ''}<h2>${o.multiLabel || '👥 같이 하기'}</h2>
      <div class="sub">방을 만들거나 빠른 참가 · 초대 코드로 친구를 불러요</div>
      <div class="row"><button id="quick-btn" class="btn big">⚡ 빠른 참가</button><input id="room-name" maxlength="20" placeholder="새 방 이름" /><button id="create-btn" class="btn alt">＋ 방 만들기</button></div>
      <div class="row"><input id="code-in2" maxlength="6" placeholder="초대 코드 6자리" autocomplete="off" /><button id="code-btn2" class="btn ghost">🎟️ 코드로 참가</button></div>
      <div id="rooms"></div>
      <div class="row2"><button id="lobby-back" class="btn ghost">← 돌아가기</button></div>
    </div></div>
    <div id="room" class="screen hidden"><div class="card wide">
      ${o.sound ? '<button class="home-btn snd-btn" data-snd title="소리 켜기 · 끄기 (M)">🔊</button>' : ''}<h2 id="room-title"></h2>
      <div id="room-opts"></div>
      <div id="room-code"><span>초대 코드</span><b id="code-txt"></b><button id="copy-link" class="btn alt">🔗 링크 복사</button><button id="copy-code" class="btn ghost">코드 복사</button></div>
      <div class="note">링크를 보내거나 코드를 알려 주면 로그인 안 한 친구도 들어올 수 있어요</div>
      <div id="members"></div>
      <div id="team-row" class="hidden"><button id="team-btn" class="btn ghost">🔁 팀 바꾸기</button></div>
      <div id="room-rank" class="hidden"></div>
      <div id="room-hint" class="sub"></div>
      <div class="row2"><button id="start-btn" class="btn big hidden">🚀 다 같이 시작!</button><button id="leave-btn" class="btn ghost">방 나가기</button></div>
    </div></div>
    <div id="toast" class="hidden"></div>`;
    document.body.append(...wrap.children);
  }
  // ---------- 동작 ----------
  // 소리 단추 (o.sound = { muted(), toggle() }): 처음 화면 · 방 · 게임 화면 단추 모두 같은 모양으로
  syncSound() { if (!this.o.sound) return; const m = this.o.sound.muted(); document.querySelectorAll('[data-snd]').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; }); }
  wire() {
    const o = this.o;
    document.querySelectorAll('[data-snd]').forEach((b) => { b.onclick = () => { o.sound.toggle(); this.syncSound(); }; });
    this.syncSound();
    $('pw').addEventListener('input', () => { store.set('roachcity.pw', $('pw').value); this.err(''); });
    $('guest-btn').onclick = async () => { try { await account.login({ guest: true }); this.renderAccount(); } catch (e) { this.err(e.message); } };
    $('dev-btn').onclick = async () => { try { await account.login({ dev: $('dev-name').value || '젤리' }); this.renderAccount(); } catch (e) { this.err(e.message); } };
    $('logout').onclick = async () => { await account.logout(); this.renderAccount(); };
    $('nick-edit').onclick = () => { this.editNick = true; $('acct-nick-in').value = account.user?.nick || ''; this.renderAccount(); $('acct-nick-in').focus(); };
    const saveNick = async () => {
      try { const r = await account.api('/api/nick', { method: 'POST', body: { nick: $('acct-nick-in').value } }); account.user = r.user; this.editNick = false; this.err(''); this.renderAccount(); this.toast(`😊 이제부터 '${r.user.nick}'(으)로 불러요`); }
      catch (e) { this.err(e.message); }
    };
    $('acct-nick-save').onclick = saveNick;
    $('acct-nick-in').onkeydown = (e) => { if (e.key === 'Enter') saveNick(); };
    $('nick').addEventListener('input', () => { store.set(this.KEY.nick, $('nick').value.trim()); this.updateProfile(); });
    for (const b of o.buttons || []) $(b.id).onclick = () => b.onClick?.(this);
    document.querySelectorAll('[data-extra]').forEach((b) => { b.onclick = () => o.extraRow[+b.dataset.extra].onClick(this); });
    $('multi-btn').onclick = () => this.openLobby();
    // 초대 코드 (한글 자판 · 휴대폰 조합 중엔 건드리지 않는다)
    for (const id of ['code-in', 'code-in2']) {
      const el = $(id); let composing = false;
      el.setAttribute('autocapitalize', 'characters'); el.setAttribute('spellcheck', 'false'); el.setAttribute('autocorrect', 'off');
      el.addEventListener('compositionstart', () => { composing = true; });
      el.addEventListener('compositionend', () => { composing = false; el.value = codeOf(el.value); });
      el.addEventListener('input', () => { if (!composing) { const v = codeOf(el.value); if (v !== el.value) el.value = v; } });
      el.addEventListener('blur', () => { el.value = codeOf(el.value); });
    }
    $('code-btn').onclick = () => this.joinByCode($('code-in').value);
    $('code-btn2').onclick = () => this.joinByCode($('code-in2').value);
    $('code-in').onkeydown = (e) => { if (e.key === 'Enter') $('code-btn').click(); };
    $('code-in2').onkeydown = (e) => { if (e.key === 'Enter') $('code-btn2').click(); };
    $('quick-btn').onclick = () => this.send({ t: 'quick', opts: this.pickOpts?.() });
    $('create-btn').onclick = () => this.send({ t: 'create', name: $('room-name').value, opts: this.pickOpts?.() });
    $('lobby-back').onclick = () => { this.multi = false; this.show('title'); };
    $('leave-btn').onclick = () => { this.send({ t: 'leave' }); this.room = null; this.afterLeave(); };
    $('start-btn').onclick = () => this.send({ t: 'start' });
    $('team-btn').onclick = () => this.send({ t: 'switch' });
    const copy = async (text, label) => { try { await navigator.clipboard.writeText(text); this.toast(`📋 ${label} 복사했어요`); } catch { window.prompt(`${label}을(를) 복사해 주세요`, text); } };
    $('copy-link').onclick = () => copy(`${location.origin}${location.pathname}?room=${this.room?.id}`, '초대 링크');
    $('copy-code').onclick = () => copy(this.room?.id || '', '초대 코드');
    // 네트워크 메시지
    this.on('hello', (m) => {
      this.myId = m.id;
      if (this.net.pendingJoin) { this.send({ t: 'join', id: this.net.pendingJoin }); this.net.pendingJoin = null; return; }
      if (this.net.pendingSend) { this.send(this.net.pendingSend); this.net.pendingSend = null; return; } // 연습전처럼 바로 시작하는 것
      this.renderRooms(m.rooms);
    });
    this.on('rooms', (m) => { if (!this.room) this.renderRooms(m.rooms); });
    this.on('error', (m) => { this.toast(m.text || '문제가 생겼어요', 2600); if (!this.room && !this.logged() && !this.playing) { this.multi = false; this.show('title'); } });
    this.on('joined', (m) => { this.room = m.room; this.members = m.members; $('room-rank').classList.add('hidden'); this.show('room'); this.renderRoom(); });
    this.on('room', (m) => { this.room = m.room; this.members = m.members; if (!this.playing && !$('room').classList.contains('hidden')) this.renderRoom(); });
    this.on('left', () => { const was = this.room; this.room = null; if (!this.multi || !was) return; this.afterLeave(); });
    this.on('start', (m) => { this.members = m.members; this.playing = true; o.onStart?.(m, this); });
    this.on('finish', (m) => { this.playing = false; o.onFinish?.(m, this); });
  }
  on(t, f) { this.net.handlers[t] = f; }
  send(m) { if (this.net.ws?.readyState === 1) this.net.ws.send(JSON.stringify(m)); }
  connect() {
    if (this.net.ws && this.net.ws.readyState <= 1) return;
    const ws = this.net.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${this.o.wsPath}`);
    ws.onopen = () => { this.net.open = true; this.hello(); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.net.handlers[m.t]?.(m); };
    ws.onclose = () => { this.net.open = false; if (this.multi) { this.toast('🔧 서버 업데이트 중... 20초 안에 복구돼요. 잠시 뒤 다시 들어와 주세요', 5000); this.o.onDisconnect?.(this); } };
  }
  hello() { const p = this.profile; this.send({ t: 'hello', session: this.logged() ? account.session : null, name: p.name, color: p.color, look: p.look, acc: p.acc }); }
  openLobby() {
    if (!this.logged()) { this.err('방 만들기 · 빠른 참가는 로그인이 필요해요. 초대 코드로는 바로 참가할 수 있어요'); return; }
    this.multi = true; this.net.pendingJoin = null;
    this.show('lobby'); $('rooms').innerHTML = '<div class="empty">방 목록을 불러오는 중…</div>';
    if (this.net.open) this.hello(); else this.connect();
  }
  joinByCode(v) {
    const code = codeOf(v);
    if (code.length !== 6) { this.toast('초대 코드 6자리를 넣어 주세요'); return; }
    this.multi = true; this.net.pendingJoin = code;
    this.toast(`🎟️ ${code} 방에 들어가는 중…`, 1200);
    if (this.net.open) this.hello(); else this.connect();
  }
  // 접속하자마자 보낼 것 (연습전 시작 등)
  sendAfterHello(m) { this.multi = true; this.net.pendingSend = m; if (this.net.open) this.hello(); else this.connect(); }
  afterLeave() { if (this.logged()) { this.show('lobby'); this.send({ t: 'list' }); } else { this.multi = false; this.show('title'); } }
  backToRoom() { this.playing = false; this.show('room'); this.renderRoom(); }
  // ---------- 계정 · 캐릭터 ----------
  async boot() {
    try { this.status = await account.status(); } catch { this.status = {}; this.err('서버에 연결할 수 없어요'); }
    await account.restore();
    const q = new URLSearchParams(location.search);
    if (!this.logged() && q.has('autostart') && this.status.devLogin) { try { await account.login({ dev: q.get('name') || '젤리' }); } catch (e) { this.err(e.message); } } // 점검용
    this.renderAccount();
    const inv = codeOf(q.get('room'));
    if (inv.length === 6) {
      $('code-in').value = inv;
      $('play-btns').before($('code-in').parentElement);
      history.replaceState(null, '', location.pathname);
      this.joinByCode(inv); // 링크로 들어오면 바로 그 방으로
    }
  }
  renderAccount() {
    const on = this.logged(), s = this.status || {};
    $('login-box').classList.toggle('hidden', on);
    $('who-row').classList.toggle('hidden', !on);
    $('chars-label').classList.toggle('hidden', !on);
    $('multi-btn').classList.toggle('hidden', !on);
    if (!on) {
      if (s.googleClientId) account.googleButton($('g-btn'), s.googleClientId, () => this.renderAccount(), (e) => this.err(e.message)).catch(() => this.err('구글 로그인 버튼을 불러오지 못했어요'));
      $('dev-box').classList.toggle('hidden', !s.devLogin);
      $('pw-row').classList.toggle('hidden', !s.password);
      if (s.password && !$('pw').value) $('pw').value = store.get('roachcity.pw') || '';
    } else $('me-name').textContent = account.user.name;
    $('acct-nick').classList.toggle('hidden', !(on && account.user.needNick) && !this.editNick);
    $('acct-nick-hint').textContent = on && account.user.needNick ? '구글 이름 대신 쓸 닉네임을 정해 주세요 (모든 게임에서 써요)' : '새 닉네임';
    const chars = on ? account.chars || [] : [];
    let sel = store.get(this.KEY.char) || store.get(DEFAULT_CHAR_KEY) || chars[0]?.token || 'default';
    if (sel !== 'default' && !chars.some((c) => c.token === sel)) sel = chars[0]?.token || 'default';
    this.sel = sel;
    const box = $('chars'); box.innerHTML = '';
    const chip = (token, name, color) => {
      const b = document.createElement('button');
      b.className = 'chip' + (token === sel ? ' on' : '');
      b.innerHTML = `<span class="dot" style="background:${esc(color)}"></span>${esc(name)}`;
      b.onclick = () => { store.set(this.KEY.char, token); this.renderAccount(); };
      box.appendChild(b);
    };
    if (on) {
      for (const c of chars) chip(c.token, c.name, c.profile?.color || '#8a5634');
      chip('default', '🐻 기본 곰돌이', '#8a5634');
      if (chars.length < 4) { const a = document.createElement('a'); a.className = 'chip'; a.href = `/?create=1&back=${location.pathname}`; a.textContent = '＋ 새 캐릭터'; box.appendChild(a); }
    }
    $('nick-row').classList.toggle('hidden', on);
    if (!$('nick').value) {
      let nick = store.get(this.KEY.nick);
      if (!nick) { nick = `곰돌이 ${1000 + Math.floor(Math.random() * 9000)}`; store.set(this.KEY.nick, nick); }
      $('nick').value = nick;
    }
    this.updateProfile();
    this.o.onAccount?.(this);
  }
  updateProfile() {
    const on = this.logged();
    const c = on ? (account.chars || []).find((x) => x.token === this.sel) : null;
    this.profile = c ? { ...charLook(c), name: c.name } : { name: (on && account.user.nick) || $('nick').value.trim() || '곰돌이', color: '#8a5634' };
    this.o.onProfile?.(this.profile, this);
  }
  // ---------- 방 ----------
  renderRooms(list) {
    const el = $('rooms');
    if (!list.length) { el.innerHTML = '<div class="empty">열린 방이 없어요. 방을 만들거나 빠른 참가를 눌러 보세요!</div>'; return; }
    el.innerHTML = '';
    for (const r of list) {
      const d = document.createElement('div'); d.className = 'room';
      d.innerHTML = `<span class="nm">${esc(r.name)}</span><span class="meta">${esc(this.o.describe?.(r.opts) || '')} · 👑 ${esc(r.host)} · ${r.n}/${r.max}</span><span class="tag ${r.state === 'run' ? 'run' : ''}">${r.state === 'run' ? '진행 중' : '기다리는 중'}</span>`;
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = '들어가기';
      b.disabled = r.state === 'run' || r.n >= r.max;
      b.onclick = () => this.send({ t: 'join', id: r.id });
      d.appendChild(b); el.appendChild(d);
    }
  }
  isHost() { return !!this.members.find((m) => m.id === this.myId)?.host; }
  renderRoom(rank) {
    const r = this.room; if (!r) return;
    const host = this.isHost();
    $('room-title').textContent = `${this.o.roomIcon || '🎮'} ${r.name}`;
    $('code-txt').textContent = r.id;
    this.o.options?.room?.($('room-opts'), r.opts || {}, host, this);
    $('team-row').classList.toggle('hidden', !r.opts?.team);
    const el = $('members'); el.innerHTML = '';
    el.className = r.opts?.team ? 'teams' : '';
    const row = (m) => `<div class="mem${m.id === this.myId ? ' me' : ''}"><span class="dot" style="background:${esc(m.color)}"></span>${m.host ? '👑 ' : ''}${m.bot ? '🤖 ' : ''}${esc(m.name)}</div>`;
    if (r.opts?.team) {
      for (const k of ['red', 'blue']) {
        const list = this.members.filter((m) => m.team === k);
        const col = document.createElement('div'); col.className = `team-col ${k}`;
        col.innerHTML = `<h4>${TEAMS[k].name} (${list.length})</h4>` + list.map(row).join('');
        el.appendChild(col);
      }
    } else for (let i = 0; i < (this.o.max || 8); i++) {
      const m = this.members[i];
      el.insertAdjacentHTML('beforeend', m ? row(m) : '<div class="mem slot">빈 자리</div>');
    }
    $('start-btn').classList.toggle('hidden', !host);
    $('start-btn').innerHTML = this.o.startLabel || '🚀 다 같이 시작!';
    $('room-hint').textContent = host ? `${this.members.length}명이 모였어요. 준비되면 시작을 눌러요!` : '방장이 시작을 누르면 다 같이 시작해요';
    if (rank) { $('room-rank').classList.remove('hidden'); $('room-rank').innerHTML = rank; }
  }
  // ---------- 작은 것들 ----------
  show(id) { for (const s of ['title', 'lobby', 'room', ...(this.o.screens || [])]) $(s)?.classList.toggle('hidden', s !== id); }
  hideScreens() { this.show('__none'); }
  err(t) { $('err').textContent = t || ''; }
  toast(text, ms = 1600) { const t = $('toast'); t.textContent = text; t.classList.remove('hidden'); clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.add('hidden'), ms); }
}
