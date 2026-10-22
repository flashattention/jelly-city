// 드림 러너 같이 달리기: 방 하나에 최대 12명. 같은 씨앗(seed)으로 모두 같은 길 · 같은 꿈 순서를 달린다
//   서버는 방 관리 · 시작 신호 · 서로의 위치 중계 · 밀치기 중계만 한다 (각자 자기 달리기는 자기 브라우저가 계산)
//   방마다 6자리 초대 코드. 방 만들기 · 빠른 참가는 로그인(구글 · 체험판)한 사람만, 초대 코드(링크)로는 비로그인도 들어온다
import crypto from 'node:crypto';

const MAX = 12;
const SNAP_HZ = 15;
const COUNTDOWN = 3500; // ms
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0 O 1 I 는 뺐다
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class DreamRooms {
  constructor(userOf) {
    this.userOf = userOf;
    this.rooms = new Map();   // id → room
    this.clients = new Set();
    this.nextPid = 1;
    setInterval(() => this.tick(), 1000 / SNAP_HZ).unref();
  }
  connect(ws) {
    const c = { ws, id: this.nextPid++, room: null, name: '곰돌이', color: '#8a5634', look: null, acc: [], who: null, st: null, dead: false, result: null, lastShove: 0 };
    this.clients.add(c);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      try { this.handle(c, m); } catch (e) { console.warn('드림 러너 메시지 오류', e.message); }
    });
    ws.on('close', () => { this.leave(c); this.clients.delete(c); });
    ws.on('error', () => {});
  }
  send(c, m) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); }
  toRoom(room, m, except) { const s = JSON.stringify(m); for (const p of room.players) if (p !== except && p.ws.readyState === 1) p.ws.send(s); }
  roomInfo(r) { return { id: r.id, name: r.name, n: r.players.length, max: MAX, state: r.state, host: r.host?.name || '' }; }
  list() { return [...this.rooms.values()].map((r) => this.roomInfo(r)); }
  members(r) { return r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, host: p === r.host, dead: p.dead, result: p.result })); }
  roomUpdate(r) { this.toRoom(r, { t: 'room', room: this.roomInfo(r), you: null, members: this.members(r) }); }

  handle(c, m) {
    switch (m.t) {
      case 'hello': {
        // 로그인(구글·체험판) 한 사람만 방에 들어온다. 이름·색·모양은 고른 캐릭터 것
        c.who = this.userOf(m.session) || null; // 없으면 비로그인 손님 (초대 코드로만 참가)
        c.hi = true;
        c.name = clean(m.name, 14) || '꿈꾸는 곰돌이';
        c.color = /^#[0-9a-fA-F]{6}$/.test(m.color || '') ? m.color : '#8a5634';
        const lj = m.look && typeof m.look === 'object' ? JSON.stringify(m.look) : '';
        c.look = lj && lj.length < 600 ? JSON.parse(lj) : null;
        c.acc = Array.isArray(m.acc) ? m.acc.slice(0, 6).map((x) => String(x).slice(0, 40)) : [];
        return this.send(c, { t: 'hello', id: c.id, rooms: c.who ? this.list() : [], anon: !c.who });
      }
      case 'list': return this.send(c, { t: 'rooms', rooms: this.list() });
      case 'create': {
        if (!c.who) return this.needLogin(c);
        this.leave(c);
        const r = { id: this.newCode(), name: clean(m.name, 20) || `${c.name}의 꿈`, players: [], host: c, state: 'wait', seed: 0, startAt: 0 };
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
        if (!c.who) return this.needLogin(c);
        // 기다리는 방 중 사람이 가장 많은 곳, 없으면 새 방
        const r = [...this.rooms.values()].filter((x) => x.state === 'wait' && x.players.length < MAX).sort((a, b) => b.players.length - a.players.length)[0];
        if (r) return this.join(c, r);
        return this.handle(c, { t: 'create', name: '' });
      }
      case 'leave': return this.leave(c, true);
      case 'start': {
        const r = c.room;
        if (!r || r.host !== c || r.state !== 'wait') return;
        r.state = 'run'; r.seed = crypto.randomInt(1, 2 ** 31 - 1); r.startAt = Date.now() + COUNTDOWN;
        for (const p of r.players) { p.dead = false; p.st = null; p.result = null; }
        this.toRoom(r, { t: 'start', seed: r.seed, in: COUNTDOWN, members: this.members(r) });
        return this.broadcastList();
      }
      case 'st': {
        // 내 위치: [거리 s, 좌우 x, 높이 y, 상태 비트(1 숙이기 · 2 공중 · 4 밀치는 중 · 8 공중제비)]
        const r = c.room;
        if (!r || r.state !== 'run' || c.dead || !Array.isArray(m.p)) return;
        const [s, x, y, f] = m.p.map(Number);
        if (![s, x, y, f].every(Number.isFinite)) return;
        c.st = [Math.round(s * 100) / 100, Math.round(x * 100) / 100, Math.round(y * 100) / 100, f | 0];
        return;
      }
      case 'shove': {
        // 밀치기: 맞은 사람 브라우저가 옆으로 밀려난다 (1초에 한 번)
        const r = c.room;
        if (!r || r.state !== 'run' || c.dead) return;
        const now = Date.now();
        if (now - c.lastShove < 800) return;
        c.lastShove = now;
        const tgt = r.players.find((p) => p.id === +m.to);
        if (!tgt || tgt.dead || !c.st || !tgt.st) return;
        if (Math.abs(tgt.st[0] - c.st[0]) > 3.5 || Math.abs(tgt.st[1] - c.st[1]) > 3.5) return; // 너무 멀면 무시
        const dir = Math.sign(+m.dir || 0) || 1;
        this.send(tgt, { t: 'shoved', by: c.id, dir });
        this.toRoom(r, { t: 'shovefx', by: c.id, to: tgt.id }, tgt);
        return;
      }
      case 'dead': {
        const r = c.room;
        if (!r || r.state !== 'run' || c.dead) return;
        c.dead = true;
        c.result = { dist: Math.max(0, Math.floor(+m.dist || 0)), stars: Math.max(0, Math.floor(+m.stars || 0)), why: clean(m.why, 30), at: Date.now() - r.startAt };
        this.toRoom(r, { t: 'dead', id: c.id, result: c.result });
        if (r.players.every((p) => p.dead)) this.finish(r);
        return;
      }
      case 'emote': { const r = c.room; if (r) this.toRoom(r, { t: 'emote', id: c.id, e: clean(m.e, 4) }, c); return; }
    }
  }
  needLogin(c) { this.send(c, { t: 'error', code: 'needlogin', text: '방 만들기 · 빠른 참가는 로그인(체험판도 돼요)이 필요해요. 초대 코드로는 바로 들어갈 수 있어요' }); }
  newCode() { let k; do { k = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); } while (this.rooms.has(k)); return k; }
  join(c, r) {
    if (c.room === r) return;
    this.leave(c);
    if (r.players.length >= MAX) return this.send(c, { t: 'error', text: '방이 꽉 찼어요 (최대 12명)' });
    if (r.state === 'run') return this.send(c, { t: 'error', text: '이미 달리는 중인 방이에요. 끝나면 들어갈 수 있어요' });
    r.players.push(c); c.room = r; c.dead = false; c.st = null; c.result = null;
    this.send(c, { t: 'joined', room: this.roomInfo(r), members: this.members(r) });
    this.roomUpdate(r);
    this.broadcastList();
  }
  leave(c, tell) {
    const r = c.room;
    if (!r) { if (tell) this.send(c, { t: 'left' }); return; }
    r.players = r.players.filter((p) => p !== c);
    c.room = null;
    if (tell) this.send(c, { t: 'left' }); // 혼자 있던 방이어도 꼭 알려 준다 (안 알려서 못 나가던 문제)
    if (!r.players.length) { this.rooms.delete(r.id); this.broadcastList(); return; }
    if (r.host === c) r.host = r.players[0];
    if (r.state === 'run') { this.toRoom(r, { t: 'dead', id: c.id, result: null, left: true }); if (r.players.every((p) => p.dead)) this.finish(r); }
    this.roomUpdate(r);
    this.broadcastList();
  }
  // 모두 탈락: 방 안 순위 (멀리 간 순서)
  finish(r) {
    r.state = 'wait';
    const rank = r.players.filter((p) => p.result).sort((a, b) => b.result.dist - a.result.dist || b.result.stars - a.result.stars).map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, color: p.color, ...p.result }));
    this.toRoom(r, { t: 'finish', rank });
    this.roomUpdate(r);
    this.broadcastList();
  }
  // 로비에 있는 사람들(방 밖)에게 방 목록
  broadcastList() {
    const s = JSON.stringify({ t: 'rooms', rooms: this.list() });
    for (const c of this.clients) if (!c.room && c.who && c.ws.readyState === 1) c.ws.send(s);
  }
  tick() {
    for (const r of this.rooms.values()) {
      if (r.state !== 'run') continue;
      const p = [];
      for (const c of r.players) if (c.st) p.push(c.id, ...c.st, c.dead ? 1 : 0);
      if (p.length) this.toRoom(r, { t: 'snap', p });
    }
  }
}
