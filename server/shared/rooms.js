// 여러 게임이 같이 쓰는 '방' 서버: 6자리 초대 코드 · 비로그인은 코드로만 참가 · 방장 · 설정 · 출발 · 위치 중계
//   게임마다 이 클래스를 상속해서 onStart(r) · onMessage(c, m) · onTick(r, now) 만 채운다
import crypto from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0 O 1 I 는 뺐다
export const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class BaseRooms {
  // opts: { max: 방 최대 인원, hz: 위치 중계 횟수, countdown: 출발 전 ms, defaults: 방 설정 기본값, allow: 설정 검사 함수 }
  constructor(userOf, opts) {
    this.userOf = userOf;
    this.o = { max: 8, hz: 15, countdown: 3500, defaults: {}, ...opts };
    this.rooms = new Map();
    this.clients = new Set();
    this.nextPid = 1;
    setInterval(() => this.tick(), 1000 / this.o.hz).unref();
  }
  connect(ws) {
    const c = { ws, id: this.nextPid++, room: null, name: '곰돌이', color: '#8a5634', look: null, acc: [], who: null, hi: false, st: null, done: false, result: null, team: null };
    this.clients.add(c);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      try { this.handle(c, m); } catch (e) { console.warn('방 메시지 오류', e.message); }
    });
    ws.on('close', () => { this.leave(c); this.clients.delete(c); });
    ws.on('error', () => {});
  }
  send(c, m) { if (c.ws?.readyState === 1) c.ws.send(JSON.stringify(m)); }
  toRoom(r, m, except) { const s = JSON.stringify(m); for (const p of r.players) if (p !== except && p.ws?.readyState === 1) p.ws.send(s); }
  roomInfo(r) { return { id: r.id, name: r.name, n: r.players.length, max: this.o.max, state: r.state, host: r.host?.name || '', opts: r.opts }; }
  list() { return [...this.rooms.values()].map((r) => this.roomInfo(r)); }
  members(r) { return r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, host: p === r.host, team: p.team, bot: !!p.bot })); }
  roomUpdate(r) { this.toRoom(r, { t: 'room', room: this.roomInfo(r), members: this.members(r) }); }
  broadcastList() { const s = JSON.stringify({ t: 'rooms', rooms: this.list() }); for (const c of this.clients) if (!c.room && c.hi && c.ws.readyState === 1) c.ws.send(s); }
  needLogin(c) { this.send(c, { t: 'error', code: 'needlogin', text: '방 만들기 · 빠른 참가는 로그인(체험판도 돼요)이 필요해요. 초대 코드로는 바로 들어갈 수 있어요' }); }
  newCode() { let k; do { k = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (this.rooms.has(k)); return k; }
  // 팀: 사람이 적은 쪽으로
  smaller(r, c) { const red = r.players.filter((p) => p !== c && p.team === 'red').length, blue = r.players.filter((p) => p !== c && p.team === 'blue').length; return red <= blue ? 'red' : 'blue'; }

  handle(c, m) {
    switch (m.t) {
      case 'hello': {
        c.who = this.userOf(m.session) || null; // 없으면 비로그인 손님 (초대 코드로만 참가)
        c.hi = true;
        c.name = clean(m.name, 14) || '꿈꾸는 곰돌이';
        c.color = /^#[0-9a-fA-F]{6}$/.test(m.color || '') ? m.color : '#8a5634';
        const lj = m.look && typeof m.look === 'object' ? JSON.stringify(m.look) : '';
        c.look = lj && lj.length < 600 ? JSON.parse(lj) : null;
        c.acc = Array.isArray(m.acc) ? m.acc.slice(0, 6).map((x) => String(x).slice(0, 40)) : [];
        return this.send(c, { t: 'hello', id: c.id, rooms: this.list(), anon: !c.who });
      }
      case 'list': return this.send(c, { t: 'rooms', rooms: this.list() });
      case 'create': {
        this.leave(c);
        const r = { id: this.newCode(), name: clean(m.name, 20) || `${c.name}의 방`, players: [], host: c, state: 'wait', startAt: 0, opts: this.allow({ ...this.o.defaults }, m.opts || {}) };
        this.rooms.set(r.id, r);
        return this.join(c, r);
      }
      case 'join': {
        if (!c.hi) return;
        const r = this.rooms.get(String(m.id || '').trim().toUpperCase());
        if (!r) return this.send(c, { t: 'error', code: 'noroom', text: '그 코드의 방이 없어요. 코드를 다시 확인해 주세요' });
        return this.join(c, r);
      }
      case 'quick': {
        const r = [...this.rooms.values()].filter((x) => x.state === 'wait' && x.players.length < this.o.max).sort((a, b) => b.players.length - a.players.length)[0];
        if (r) return this.join(c, r);
        return this.handle(c, { t: 'create', name: '', opts: m.opts });
      }
      case 'leave': return this.leave(c, true);
      case 'chat': return this.chat(c, m);
      case 'opts': {
        // 방 설정 (방장, 기다리는 동안)
        const r = c.room;
        if (!r || r.host !== c || r.state !== 'wait') return;
        r.opts = this.allow(r.opts, m.opts || {});
        if (r.opts.team) for (const p of r.players) if (p.team !== 'red' && p.team !== 'blue') p.team = this.smaller(r, p);
        this.roomUpdate(r); this.broadcastList();
        return;
      }
      case 'switch': {
        const r = c.room;
        if (!r || !r.opts.team || r.state !== 'wait') return;
        c.team = c.team === 'red' ? 'blue' : 'red';
        return this.roomUpdate(r);
      }
      case 'start': {
        const r = c.room;
        if (!r || r.host !== c || r.state !== 'wait') return;
        r.state = 'run'; r.startAt = Date.now() + this.o.countdown; r.seed = crypto.randomInt(1, 2 ** 31 - 1);
        for (const p of r.players) { p.st = null; p.done = false; p.result = null; }
        if (r.opts.team && r.players.length > 1 && new Set(r.players.map((p) => p.team)).size < 2) r.players.forEach((p, i) => { p.team = i % 2 ? 'blue' : 'red'; });
        const extra = this.onStart(r) || {};
        this.toRoom(r, { t: 'start', seed: r.seed, in: this.o.countdown, members: this.members(r), opts: r.opts, ...extra });
        return this.broadcastList();
      }
      case 'st': {
        // 내 상태: 게임마다 정한 숫자 배열 (최대 12개)
        const r = c.room;
        if (!r || r.state !== 'run' || !Array.isArray(m.p) || m.p.length > 12) return;
        const p = m.p.map(Number);
        if (!p.every(Number.isFinite)) return;
        c.st = p; c.stAt = Date.now();
        return;
      }
      default:
        if (c.room) this.onMessage(c, m, c.room);
    }
  }
  // ---------- 채팅: 대기실부터 게임 중까지 · 팀전이면 팀에게만도 ----------
  teamChat(r) { return !!r.opts?.team; }
  sysChat(r, s) { this.pushChat(r, { sys: true, s }); }
  pushChat(r, m, onlyTeam) {
    m.at = Date.now();
    if (!onlyTeam) { (r.chat ||= []).push(m); if (r.chat.length > 40) r.chat.shift(); }
    const msg = JSON.stringify({ t: 'chat', ...m });
    for (const p of r.players) if (p.ws?.readyState === 1 && (!onlyTeam || p.team === onlyTeam)) p.ws.send(msg);
  }
  chat(c, m) {
    const r = c.room; if (!r) return;
    const s = clean(m.s, 120); if (!s) return;
    const now = Date.now(); c.chatAt = (c.chatAt || []).filter((t) => now - t < 6000);
    if (c.chatAt.length >= 5) return this.send(c, { t: 'chat', sys: true, s: '💬 너무 빨라요. 잠깐 쉬었다 말해요' });
    c.chatAt.push(now);
    const team = m.team && this.teamChat(r) && c.team ? c.team : null;
    this.pushChat(r, { id: c.id, name: c.name, color: c.color, s, team }, team);
  }
  join(c, r) {
    if (c.room === r) return;
    this.leave(c);
    if (r.players.length >= this.o.max) return this.send(c, { t: 'error', text: `방이 꽉 찼어요 (최대 ${this.o.max}명)` });
    if (r.state === 'run') return this.send(c, { t: 'error', text: '이미 시작한 방이에요. 끝나면 들어갈 수 있어요' });
    r.players.push(c); c.room = r; c.st = null; c.done = false; c.result = null;
    c.team = this.smaller(r, c);
    this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r), chat: r.chat || [] });
    this.sysChat(r, `👋 ${c.name} 님이 들어왔어요`);
    this.roomUpdate(r);
    this.broadcastList();
  }
  leave(c, tell) {
    const r = c.room;
    if (!r) { if (tell) this.send(c, { t: 'left' }); return; }
    r.players = r.players.filter((p) => p !== c);
    c.room = null;
    if (tell) this.send(c, { t: 'left' }); // 혼자 있던 방이어도 꼭 알려 준다
    const humans = r.players.filter((p) => !p.bot);
    if (!humans.length) { this.rooms.delete(r.id); this.broadcastList(); return; }
    if (r.host === c || r.host?.bot) r.host = humans[0];
    this.sysChat(r, `🚪 ${c.name} 님이 나갔어요`);
    if (r.state === 'run') { this.toRoom(r, { t: 'gone', id: c.id }); this.onLeave?.(r, c); }
    this.roomUpdate(r);
    this.broadcastList();
  }
  // 경기 끝 → 기다리는 방으로
  end(r, payload) {
    r.state = 'wait';
    r.players = r.players.filter((p) => !p.bot); // 봇은 경기마다 새로
    this.toRoom(r, { t: 'finish', ...payload });
    this.roomUpdate(r); this.broadcastList();
  }
  tick() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      if (r.state !== 'run') continue;
      this.onTick?.(r, now);
      if (r.state !== 'run') continue;
      const p = [];
      for (const c of r.players) if (c.st) p.push([c.id, ...c.st]);
      if (p.length) this.toRoom(r, { t: 'snap', p });
    }
  }
  // 게임마다 바꾸는 것들
  allow(cur, next) { return { ...cur, ...next }; }
  onStart() { return {}; }
  onMessage() {}
}
