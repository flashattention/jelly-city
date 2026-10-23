// 서버가 소유하는 공유 세계: 시계, 시민, 차량, 플레이어, LLM 대화, 저장
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { SEED, DEFAULT_TIME_SPEED } from '../../public/jelly-city/js/config.js';
import { setupWorld, housePrice, freeUnits, isHomeType, homeLabel, WORLD_VERSION } from '../../public/jelly-city/js/world-setup.js';
import { sanitizeLook, BASIC_ACC } from '../../public/shared/js/look.js';
import { levelStats } from '../../public/jelly-city/js/level.js';
import { Combat } from './combat.js';
import { Titans } from './titans.js';
import { Wildlife } from './wildlife.js';
import { ANIMAL_KINDS } from '../../public/jelly-city/js/fauna.js';
import { itemDef } from '../../public/jelly-city/js/items.js';
import { MODES, PLAN_KINDS } from '../../public/jelly-city/js/citizens.js';
import { Traffic, AI_CARS, CAR_KINDS, BIKE_KINDS } from '../../public/jelly-city/js/traffic.js';
import { buildInterior } from '../../public/jelly-city/js/interior.js';
import { profileSystemPrompt, streetChatPrompt, memoryPrompt, fallbackReply, clampInt, INSULT } from '../../public/jelly-city/js/prompts.js';
import { DAYS, fmtTime } from '../../public/shared/js/utils.js';
import { complete, llmEnabled, SCHEMAS } from './llm.js';

const WEATHERS = ['맑음 ☀️', '구름 조금 ⛅', '흐림 ☁️', '습하고 따뜻함 💧', '맑음 ☀️'];
const CAR_MODES = ['ai', 'player', 'parked', 'wreck', 'gone'];
const q = (v, k = 10) => Math.round(v * k);
const MAX_CHARS = 4;
// 건의함을 볼 수 있는 관리자 (쉼표로 여러 명)
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isAdmin = (user) => !!user?.email && ADMINS.includes(user.email.toLowerCase());
const SPECTATOR_TYPES = new Set(['smash', 'unsmash', 'pjoin', 'pleave', 'pmeta', 'carSpawn', 'gdrop', 'gpick', 'homes', 'fx', 'runners', 'rpos', 'runnerDown', 'runnerGone', 'carSay', 'hearts']);

export class World {
  constructor({ dataDir }) {
    this.dataFile = path.join(dataDir, 'world.json');
    fs.mkdirSync(dataDir, { recursive: true });
    const { buildings, city, sim, reserved } = setupWorld(SEED);
    this.buildings = buildings;
    this.city = city;
    this.sim = sim;
    this.reserved = reserved;
    const interiorCache = new Map();
    sim.interiorFor = (b) => {
      if (!interiorCache.has(b.id)) {
        const I = buildInterior(b, {});
        interiorCache.set(b.id, { building: b, workSpots: I.workSpots, visitSpots: I.visitSpots, entry: I.entry, exit: I.exit });
      }
      return interiorCache.get(b.id);
    };
    sim.onStreetChat = (a, b) => this.streetChat(a, b);
    this.traffic = new Traffic(null, city, SEED);
    this.timeSpeed = Number(process.env.TIME_SPEED) || DEFAULT_TIME_SPEED;
    this.minutes = 7 * 60 + 30;
    this.weather = WEATHERS[0];
    this.players = new Map(); // 접속 중
    this.spectators = new Set(); // 로그인 화면에서 도시를 구경하는 연결
    this.accounts = {}; // 캐릭터 token → { name, profile, homeId, homeUnit, homes, stats, owner }
    this.users = {}; // 구글 계정 sub → { email, name, picture, chars: [token] }
    this.sessions = {}; // 세션 → { sub, exp }
    this.photos = {}; // 사진 id → { owner, ownerName, t, posted, caption, likes, postedAt }
    this.feedback = []; // 개발자에게 건의
    this.lastAct = new Map(); // '캐릭터:종류' → 마지막 시각 (댓글·DM 도배 방지, 저장 안 함)
    this.dms = {}; // 인스타 DM: 'a|b' (캐릭터 토큰 정렬) → [{ from, t, text, read }]
    this.matches = []; // 튄더 매칭 { id, a, b, t, msgs }
    this.photoDir = path.join(dataDir, 'photos');
    fs.mkdirSync(this.photoDir, { recursive: true });
    this.affinity = {}; // npcId → { token: value }
    this.memories = {}; // npcId → [{ token, name, text }]
    this.chatLogs = {}; // "npc:token" → [{ role, content }]
    this.extraCars = []; // 렌트로 생긴 차
    this.nextPid = 1;
    this.load();
    this.lastDay = Math.floor(this.minutes / 1440);
    sim.resolveAll(this.minutes);
    this.lastMeta = new Map();
    this.dirty = false;
    this.combat = new Combat(this);
    this.wild = new Wildlife(this);
    this.titans = new Titans(this);
    setInterval(() => this.purgeGuests(), 10 * 60 * 1000).unref?.();
    this.smashed = new Map(); // 부서진 소품 → 복구 시각
    this.snapN = 0;
    this.hotel = city.byType.hotel[0];
    sim.onReport = (c, rep) => this.handleReport(c, rep);
    this.streetChatTimes = [];
    this.streetChatPerMin = Number(process.env.STREET_CHAT_PER_MIN ?? 6);
    sim.onTalkInterrupted = (c) => { const p = this.players.get(c.talkingTo); if (p) { this.endTalk(p, c.id); this.send(p, { t: 'talkCut', npc: c.id }); } };
  }

  // ---------------- 저장 ----------------
  load() {
    try {
      const d = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      Object.assign(this, { minutes: d.minutes ?? this.minutes, weather: d.weather ?? this.weather, accounts: d.accounts || {}, affinity: d.affinity || {}, memories: d.memories || {}, chatLogs: d.chatLogs || {}, users: d.users || {}, sessions: d.sessions || {}, photos: d.photos || {}, feedback: d.feedback || [], matches: d.matches || [], dms: d.dms || {} });
      if ((d.version || 1) < WORLD_VERSION) { this.migrate(d.version || 1); d.extraCars = []; }
      for (const c of d.extraCars || []) { const car = this.traffic.spawnParked(new THREE.Vector3(c.x, c.y || 0, c.z), c.h, c.kind || 'sedan', c.color); if (c.gone) car.mode = 'gone'; this.extraCars.push(c); }
      console.log(`📂 저장된 세계를 불러왔어요 (계정 ${Object.keys(this.accounts).length}개)`);
    } catch { /* 처음 실행 */ }
  }
  save() {
    const extraCars = this.traffic.cars.slice(AI_CARS).map((c) => ({ x: c.pos.x, y: c.pos.y || 0, z: c.pos.z, h: c.heading, kind: c.kind, color: c.color, gone: c.mode === 'gone' || c.mode === 'wreck' }));
    const now = Date.now();
    for (const [k, v] of Object.entries(this.sessions)) if (v.exp < now) delete this.sessions[k];
    const data = { version: WORLD_VERSION, users: this.users, sessions: this.sessions, photos: this.photos, feedback: this.feedback, matches: this.matches, dms: this.dms, minutes: this.minutes, weather: this.weather, accounts: this.accounts, affinity: this.affinity, memories: this.memories, chatLogs: this.chatLogs, extraCars };
    const tmp = this.dataFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, this.dataFile);
  }

  // 도시가 커지면서 건물·주민 번호가 바뀌었다 → 집은 환불, 주민 관계는 초기화
  migrate(from) {
    let refunded = 0;
    for (const acc of Object.values(this.accounts)) {
      if (acc.homeId != null) {
        if (acc.stats) acc.stats.money = (acc.stats.money || 0) + 4000;
        acc.note = '🏘️ 도시가 커져서 예전 집이 재개발됐어요! 집값 ₩4000을 돌려드렸어요. 부동산에서 새 집을 골라보세요';
        refunded++;
      }
      acc.homeId = null; acc.homeUnit = null; acc.homes = [];
      if (acc.stats) { acc.stats.workId = null; acc.stats.homeId = null; }
    }
    this.affinity = {}; this.memories = {}; this.chatLogs = {};
    console.log(`🔄 세계 v${from} → v${WORLD_VERSION} 변환 (집 환불 ${refunded}건)`);
    this.dirty = true;
  }

  // ---------------- 로그인 & 캐릭터 ----------------
  login(info, legacyTokens = []) {
    const u = (this.users[info.sub] ||= { email: info.email, name: info.name, picture: info.picture, chars: [], created: Date.now(), guest: !!info.guest });
    Object.assign(u, { email: info.email, name: info.name, picture: info.picture, last: Date.now() });
    if (u.guest) legacyTokens = []; // 체험판은 이 브라우저의 예전 캐릭터를 가져가지 않는다
    // 구글 로그인 전 이 브라우저에서 쓰던 캐릭터를 내 계정으로 가져온다
    for (const t of legacyTokens.slice(0, 5)) {
      const acc = typeof t === 'string' && this.accounts[t];
      if (acc && !acc.owner && u.chars.length < MAX_CHARS) { acc.owner = info.sub; u.chars.push(t); }
    }
    const sid = crypto.randomBytes(24).toString('hex');
    this.sessions[sid] = { sub: info.sub, exp: Date.now() + 30 * 864e5 };
    this.dirty = true;
    return sid;
  }
  // 화면에 보여 줄 계정 정보: 구글 실명 · 이메일은 보내지 않고 직접 정한 닉네임만
  publicUser(u) {
    if (!u) return null;
    return { name: u.nick || (u.guest ? u.name : '곰돌이'), nick: u.nick || '', needNick: !u.nick && !u.guest, guest: !!u.guest };
  }
  setNick(sub, nick) {
    const u = this.users[sub];
    if (!u) throw new Error('로그인이 필요해요');
    const n = String(nick || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
    if ([...n].length < 2 || [...n].length > 12) throw new Error('닉네임은 2~12글자로 정해 주세요');
    u.nick = n; this.dirty = true;
    return this.publicUser(u);
  }
  guestCount() { return Object.values(this.users).filter((u) => u.guest).length; }
  // 이틀 넘게 안 들어온 체험판 계정·캐릭터 정리 (집·차도 함께 풀린다)
  purgeGuests() {
    const cutoff = Date.now() - 2 * 864e5;
    let changed = false;
    for (const [sub, u] of Object.entries(this.users)) {
      if (!u.guest) continue;
      const last = Math.max(u.last || 0, ...u.chars.map((t) => this.accounts[t]?.last || 0));
      if (last > cutoff || [...this.players.values()].some((p) => u.chars.includes(p.token))) continue;
      for (const t of u.chars) { delete this.accounts[t]; this.forgetDms(t); }
      delete this.users[sub];
      for (const [sid, s] of Object.entries(this.sessions)) if (s.sub === sub) delete this.sessions[sid];
      changed = true;
    }
    if (changed) { this.dirty = true; this.broadcast({ t: 'homes', ...this.homesInfo() }); }
  }
  userOf(sid) {
    const s = typeof sid === 'string' && this.sessions[sid];
    if (!s || s.exp < Date.now()) return null;
    return this.users[s.sub] ? { sub: s.sub, user: this.users[s.sub] } : null;
  }
  logout(sid) { delete this.sessions[sid]; this.dirty = true; }
  charSummary(token) {
    const a = this.accounts[token];
    if (!a) return null;
    const home = a.homeId != null ? this.buildings[a.homeId] : null;
    return {
      token, name: a.name, profile: a.profile, money: Math.floor(a.stats?.money ?? 500), job: a.profile?.jobName || '',
      home: home ? homeLabel(home, a.homeUnit) : '', starter: a.stats ? null : a.starter, online: [...this.players.values()].some((p) => p.token === token), last: a.last || a.created,
    };
  }
  charList(sub) { return (this.users[sub]?.chars || []).map((t) => this.charSummary(t)).filter(Boolean); }
  createChar(sub, body) {
    const u = this.users[sub];
    if (!u) throw new Error('로그인이 필요해요');
    if (u.chars.length >= MAX_CHARS) throw new Error(`캐릭터는 ${MAX_CHARS}개까지 만들 수 있어요`);
    const profile = sanitizeProfile({ ...body.profile, accessories: [], held: null, def: 0, charm: 0, regen: 0, jobName: '' });
    const starter = {};
    for (const [slot, list] of Object.entries(BASIC_ACC)) if (list.some(([id]) => id === body.starter?.[slot])) starter[slot] = body.starter[slot];
    const token = crypto.randomBytes(12).toString('hex');
    this.accounts[token] = { name: profile.name, profile, homeId: null, homeUnit: null, homes: [], stats: null, starter, owner: sub, created: Date.now() };
    u.chars.push(token);
    this.dirty = true;
    return this.charSummary(token);
  }
  // 메인 화면 캐릭터 꾸미기: 색 · 얼굴 · 날개만 (이름 · 성격 · 가방 · 집은 그대로)
  restyleChar(sub, token, body) {
    const u = this.users[sub];
    if (!u || !u.chars.includes(token)) throw new Error('내 캐릭터가 아니에요');
    const a = this.accounts[token];
    if (!a) throw new Error('캐릭터가 없어요');
    a.profile = sanitizeProfile({ ...a.profile, color: body.color, look: body.look });
    for (const p of this.players.values()) if (p.token === token) this.send(p, { t: 'sys', text: '🎨 메인 화면에서 바꾼 모습은 다시 접속하면 보여요' });
    this.dirty = true;
    return this.charSummary(token);
  }
  // 캐릭터 이름 바꾸기 (언제나): 이름은 꾸밈일 뿐, 돈 · 집 · 팔로우 · DM 은 토큰으로 이어져 그대로
  renameChar(sub, token, name) {
    const u = this.users[sub];
    if (!u || !u.chars.includes(token)) throw new Error('내 캐릭터가 아니에요');
    const a = this.accounts[token];
    if (!a) throw new Error('캐릭터가 없어요');
    const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 8) : '';
    if (!n) throw new Error('이름을 1~8글자로 지어 주세요');
    a.name = n; a.profile = { ...a.profile, name: n };
    for (const p of this.players.values()) if (p.token === token) { p.name = n; if (p.profile) p.profile.name = n; this.send(p, { t: 'sys', text: `✏️ 이제 '${n}'(이)에요 · 다른 사람에게는 다시 접속하면 새 이름으로 보여요` }); }
    this.dirty = true;
    return this.charSummary(token);
  }
  deleteChar(sub, token) {
    const u = this.users[sub];
    if (!u || !u.chars.includes(token)) throw new Error('내 캐릭터가 아니에요');
    for (const p of this.players.values()) if (p.token === token) { this.send(p, { t: 'sys', text: '이 캐릭터가 삭제됐어요' }); p.ws.close(); }
    u.chars = u.chars.filter((t) => t !== token);
    delete this.accounts[token];
    this.forgetDms(token);
    this.dirty = true;
    this.broadcast({ t: 'homes', ...this.homesInfo() });
  }

  // ---------------- 집 ----------------
  ownedUnits(bid) {
    const out = [];
    for (const a of Object.values(this.accounts)) for (const h of a.homes || []) if (h.bid === bid) out.push(h.unit);
    return out;
  }
  // 리스폰 존: 호텔 + 누군가의 대표 집. 문 앞 10m 안(과 그 건물 안)에서는 아무도 다치지 않는다
  safeBids() {
    const s = new Set([this.hotel.id]);
    for (const a of Object.values(this.accounts)) if (a.homeId != null && this.buildings[a.homeId]) s.add(a.homeId);
    return [...s];
  }
  inSafeZone(p) {
    if (!this.safeCache || Date.now() - this.safeCache.t > 5000) this.safeCache = { t: Date.now(), bids: new Set(this.safeBids()) };
    if (p.loc >= 0) return this.safeCache.bids.has(p.loc);
    for (const id of this.safeCache.bids) { const d = this.buildings[id].door; if (Math.hypot(p.pos.x - d.x, p.pos.z - d.z) < 10 && Math.abs(p.pos.y - (d.y || 0)) < 8) return true; }
    return false;
  }

  homesInfo() {
    const names = {}, owned = {};
    for (const a of Object.values(this.accounts)) {
      for (const h of a.homes || []) {
        (owned[h.bid] ||= []).push(h.unit);
        const b = this.buildings[h.bid];
        if (b?.type === 'house') (names[h.bid] ||= []).push(a.name);
      }
    }
    this.safeCache = null;
    return {
      homes: Object.fromEntries(Object.entries(names).map(([id, n]) => [id, `${n.slice(0, 2).join('·')}${n.length > 2 ? ' 외' : ''}의 집`])),
      owned,
      safe: this.safeBids(),
    };
  }

  join(ws, msg) {
    const who = this.userOf(msg.session);
    const token = typeof msg.char === 'string' && who?.user.chars.includes(msg.char) && this.accounts[msg.char] ? msg.char : null;
    if (!token) return null;
    // 같은 캐릭터로 이미 접속 중이면 이전 접속을 끊는다
    for (const o of [...this.players.values()]) if (o.token === token) { this.send(o, { t: 'kicked' }); o.kicked = true; o.ws.close(); this.leave(o); }
    const acc = this.accounts[token];
    acc.last = Date.now();
    if (!acc.phone) acc.phone = this.newPhone();
    acc.contacts ||= []; acc.sms ||= [];
    const home = acc.homeId != null ? this.buildings[acc.homeId] : this.hotel;
    const p = {
      id: this.nextPid++, token, ws, name: acc.name, profile: acc.profile,
      pos: home.door.clone().addScaledVector(new THREE.Vector3(0, 0, home.dir), 1.5), heading: 0, speed: 0,
      loc: -1, car: -1, air: 0, sleeping: false, talking: null, talkBusy: false, lastTalk: 0, carState: null,
      hp: 100, maxHp: 100, dead: false, heat: 0, stars: 0,
    };
    p.maxHp = p.hp = levelStats(acc.profile.level || 1).maxHp;
    this.players.set(p.id, p);
    if (acc.pendingHeat) {
      const n = acc.pendingReports || 1;
      setTimeout(() => { this.combat.addHeat(p, acc.pendingHeat, '접속하지 않은 사이 들어온 신고'); this.send(p, { t: 'sys', text: `🚔 자리를 비운 사이 ${n}건의 신고가 접수됐어요! 경찰이 찾고 있어요` }); acc.pendingHeat = 0; acc.pendingReports = 0; }, 3000);
    }
    if (acc.note) { const note = acc.note; delete acc.note; setTimeout(() => this.send(p, { t: 'sys', text: note }), 2500); }
    // 이 플레이어에게 맞춘 친밀도 & 기억
    const aff = {}, mem = {};
    for (const c of this.sim.citizens) {
      aff[c.id] = this.aff(c, token);
      const m = (this.memories[c.id] || []).filter((x) => x.token === token).map((x) => x.text);
      if (m.length) mem[c.id] = m;
    }
    const hi = this.homesInfo();
    this.send(p, {
      t: 'welcome', you: p.id, token, homeId: acc.homeId, homeUnit: acc.homeUnit, myHomes: acc.homes || [], homes: hi.homes, owned: hi.owned, safe: hi.safe,
      stats: acc.stats, starter: acc.stats ? null : acc.starter, profile: acc.profile, user: this.publicUser(who.user), admin: isAdmin(who.user),
      phone: acc.phone, contacts: acc.contacts, sms: acc.sms.slice(-100),
      minutes: this.minutes, timeSpeed: this.timeSpeed, weather: this.weather, llm: llmEnabled,
      affinity: aff, memories: mem, players: [...this.players.values()].map(playerMeta),
      extraCars: this.traffic.cars.slice(AI_CARS).map((c) => ({ id: c.id, x: c.pos.x, z: c.pos.z, h: c.heading, kind: c.kind, color: c.color })),
      npcMeta: this.sim.citizens.map((c) => this.npcMeta(c)),
      ground: this.combat.groundList(), hotelId: this.hotel.id, animals: this.wild.kinds(), smashed: [...this.smashed.keys()],
      extraKinds: this.traffic.cars.slice(AI_CARS).map((c) => c.kind),
    });
    this.broadcast({ t: 'pjoin', p: playerMeta(p) }, p.id);
    this.dirty = true;
    console.log(`👋 ${p.name} 입장 (접속 ${this.players.size}명)`);
    return p;
  }

  leave(p) {
    if (!this.players.has(p.id)) return;
    this.wild.dropRider(p);
    clearTimeout(p.jailTimer);
    if (p.talking !== null) this.endTalk(p, p.talking);
    if (p.car >= 0) { const car = this.traffic.cars[p.car]; if (car) this.traffic.exit(car); }
    this.players.delete(p.id);
    this.combat.units = this.combat.units.filter((u) => u.target !== p.id);
    this.updateActiveBuildings();
    this.broadcast({ t: 'pleave', id: p.id });
    console.log(`👋 ${p.name} 퇴장 (접속 ${this.players.size}명)`);
  }

  aff(c, token) { return this.affinity[c.id]?.[token] ?? c.baseAffinity; }
  setAff(c, token, v) { (this.affinity[c.id] ||= {})[token] = Math.max(0, Math.min(100, v)); this.dirty = true; return this.affinity[c.id][token]; }

  send(p, obj) { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(obj)); }
  broadcast(obj, exceptId) {
    const s = JSON.stringify(obj);
    for (const p of this.players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(s);
    // 관전자에게는 화면에 필요한 것만 (채팅·시스템 메시지는 보내지 않는다)
    if (SPECTATOR_TYPES.has(obj.t)) for (const ws of this.spectators) if (ws.readyState === 1) ws.send(s);
  }

  addSpectator(ws) {
    if (this.spectators.size >= 60) { ws.send(JSON.stringify({ t: 'error', code: 'full' })); return; }
    this.spectators.add(ws);
    const hi = this.homesInfo();
    ws.send(JSON.stringify({
      t: 'welcome', spectate: true, you: -1, homes: hi.homes, owned: hi.owned, safe: hi.safe,
      minutes: this.minutes, timeSpeed: this.timeSpeed, weather: this.weather, llm: llmEnabled,
      players: [...this.players.values()].map(playerMeta),
      extraCars: this.traffic.cars.slice(AI_CARS).map((c) => ({ id: c.id, x: c.pos.x, z: c.pos.z, h: c.heading, kind: c.kind, color: c.color })),
      npcMeta: this.sim.citizens.map((c) => this.npcMeta(c)),
      ground: this.combat.groundList(), hotelId: this.hotel.id, animals: this.wild.kinds(), smashed: [...this.smashed.keys()],
    }));
  }

  // ---------------- 메시지 ----------------
  handle(p, msg) {
    switch (msg.t) {
      case 'st': {
        const loc = Number.isInteger(msg.loc) && this.buildings[msg.loc] ? msg.loc : -1;
        p.pos.set(+msg.x || 0, +msg.y || 0, +msg.z || 0);
        p.heading = +msg.h || 0; p.speed = +msg.s || 0; p.air = Math.max(0, Math.min(7, msg.a | 0));
        if (p.emote && (Math.hypot(p.pos.x - p.emote.x, p.pos.z - p.emote.z) > 0.6 || Math.abs(p.pos.y - p.emote.y) > 0.8 || p.car >= 0 || (p.air & 2))) p.emote = null; // 움직이면 무적 끝
        p.mount = Number.isInteger(msg.mt) && msg.mt >= 0 && msg.mt < ANIMAL_KINDS.length ? msg.mt : -1; // 타고 있는 동물
        if (loc !== p.loc) { p.loc = loc; this.updateActiveBuildings(); }
        if (p.car >= 0 && msg.car) {
          const car = this.traffic.cars[p.car];
          if (car && car.owner === p.id) { car.pos.set(+msg.car[0], +msg.car[4] || 0, +msg.car[1]); car.heading = +msg.car[2]; car.speed = +msg.car[3]; car.turret = +msg.car[5] || 0; }
        }
        break;
      }
      case 'profile': {
        const acc = this.accounts[p.token];
        acc.profile = sanitizeProfile({ ...acc.profile, ...msg.profile });
        p.profile = acc.profile;
        acc.name = p.name;
        const mh = levelStats(acc.profile.level).maxHp;
        if (mh !== p.maxHp) { if (mh > p.maxHp && !p.dead) p.hp = mh; p.maxHp = mh; this.send(p, { t: 'hp', hp: Math.round(p.hp), max: mh }); }
        this.broadcast({ t: 'pmeta', p: playerMeta(p) });
        this.dirty = true;
        break;
      }
      case 'stats': this.accounts[p.token].stats = msg.stats; this.dirty = true; break;
      case 'say': {
        const text = String(msg.text || '').slice(0, 120).trim();
        if (!text) break;
        if (msg.anon) {
          // 익명 채팅: 다른 사람에게는 누가 보냈는지(id·이름) 보내지 않는다. 도배 방지로 2초에 한 번
          if (Date.now() - (p.lastAnon || 0) < 2000) { this.send(p, { t: 'sys', text: '🕶️ 익명 채팅은 2초에 한 번만 보낼 수 있어요' }); break; }
          p.lastAnon = Date.now();
          console.log(`🕶️ 익명 채팅 [${p.name} ${p.token}]: ${text}`); // 신고 대응용 서버 로그
          for (const o of this.players.values()) this.send(o, { t: 'psay', anon: true, id: o === p ? p.id : -1, name: '🕶️ 익명', text });
          break;
        }
        this.broadcast({ t: 'psay', id: p.id, name: p.name, text });
        break;
      }
      case 'talk': this.talk(p, msg); break;
      case 'talkEnd': this.endTalk(p, msg.npc); break;
      case 'carEnter': {
        const car = this.traffic.cars[msg.id];
        if (!car || car.mode === 'player' || p.car >= 0) { this.send(p, { t: 'carDenied' }); break; }
        if (car.occ > 0) {
          this.combat.spawnRunners(car, car.occ, ['으아악! 내 차!!', '살려줘요!!', '도둑이야!!'][Math.floor(Math.random() * 3)]);
          // 쫓겨난 운전자가 절반 확률로 112에 신고
          if (Math.random() < 0.5) setTimeout(() => { if (this.players.has(p.id)) this.reportBy('차 주인', { token: p.token, name: p.name, reason: '차량 탈취' }); }, 6000);
        }
        this.traffic.enter(car, p.id);
        car.occ = 0;
        p.car = car.id;
        this.send(p, { t: 'carOk', id: car.id });
        this.broadcast({ t: 'carSay', id: car.id, text: car.bubble?.text || '' });
        break;
      }
      case 'carExit': {
        const car = this.traffic.cars[p.car];
        if (car && car.owner === p.id) this.traffic.exit(car);
        p.car = -1;
        break;
      }
      case 'carRent': {
        if (p.car >= 0) break;
        this.spawnCarFor(p, 'sedan', '#ff8a65', msg, true);
        break;
      }
      case 'sleep': p.sleeping = !!msg.on; this.broadcastSleep(); break;
      case 'hit': this.combat.hit(p, msg); break;
      case 'explode': this.combat.explode(p, msg); break;
      case 'fx': {
        // 다른 플레이어에게 보여줄 연출 (총알 궤적, 투사체, 휘두르기)
        const k = String(msg.k || '');
        if (['tracer', 'proj', 'swing', 'muzzle', 'eat', 'bolt', 'sparkle', 'cloud', 'breath', 'horn', 'emote', 'emotesync', 'gust', 'holyfx', 'odm'].includes(k)) this.broadcast({ ...msg, t: 'fx', pid: p.id, loc: p.loc }, p.id);
        // 춤추는 동안 무적: 땅 위에 서서 춤을 시작한 자리 (움직이거나 공격하면 풀린다)
        if (k === 'emote') p.emote = typeof msg.id === 'string' && msg.id.length < 20 && p.car < 0 && !p.dead && !(p.air & 2) ? { x: p.pos.x, y: p.pos.y, z: p.pos.z } : null;
        else if (['tracer', 'proj', 'swing', 'bolt', 'gust', 'breath'].includes(k)) p.emote = null;
        break;
      }
      case 'drop': {
        const it = msg.item;
        if (!it || !itemDef(it.id) || it.id === 'fist') break;
        const keep = { id: String(it.id), n: Math.max(1, Math.min(999, +it.n || 1)), gems: Array.isArray(it.gems) ? it.gems.slice(0, 3).map(String) : [] };
        if (+it.ttlMs > 0) { keep.ttlMs = Math.min(30 * 60000, +it.ttlMs); keep.rarity = String(it.rarity || 'common'); }
        this.combat.dropItem(keep, p.pos.x, p.pos.y, p.pos.z, p.loc, 60);
        break;
      }
      case 'pickup': this.combat.pickup(p, msg.gid); break;
      case 'holy': this.combat.holy(p, msg); break;
      case 'smash': {
        // 차로 가로등·나무를 들이받음 → 모두에게 알리고 1분 뒤 복구
        const key = String(msg.key || '').slice(0, 12);
        if (!/^[cw]\d+$/.test(key) || this.smashed.has(key)) break;
        this.smashed.set(key, Date.now() + 60000);
        this.broadcast({ t: 'smash', key, dir: Array.isArray(msg.dir) ? msg.dir.slice(0, 2).map(Number) : [1, 0] });
        break;
      }
      case 'contactAdd': this.contactAdd(p, msg); break;
      case 'contactDel': { const acc = this.accounts[p.token]; acc.contacts = (acc.contacts || []).filter((c) => c.num !== msg.num); this.send(p, { t: 'contacts', list: acc.contacts }); this.dirty = true; break; }
      case 'sms': this.sendSms(p, msg); break;
      case 'tdProfile': { const acc = this.accounts[p.token]; acc.tinder ||= { likes: [], passes: [] }; acc.tinder.bio = String(msg.bio || '').slice(0, 120); acc.tinder.photo = /^[0-9a-f]{20}$/.test(msg.photo || '') && this.photos[msg.photo]?.owner === p.token ? msg.photo : null; this.dirty = true; this.send(p, { t: 'tdMe', me: acc.tinder }); break; }
      case 'tdCards': this.send(p, { t: 'tdCards', list: this.tinderCards(p), me: this.accounts[p.token].tinder || null }); break;
      case 'tdSwipe': this.tinderSwipe(p, String(msg.token || ''), !!msg.like); break;
      case 'tdMatches': this.send(p, { t: 'tdMatches', list: this.tinderMatches(p) }); break;
      case 'tdMsgs': { const m = this.matches.find((x) => x.id === msg.mid && (x.a === p.token || x.b === p.token)); if (m) { for (const x of m.msgs) if (x.from !== p.token) x.read = true; this.send(p, { t: 'tdMsgs', mid: m.id, msgs: m.msgs.slice(-80), other: this.tinderPerson(m.a === p.token ? m.b : m.a) }); } break; }
      case 'tdSend': this.tinderSend(p, msg); break;
      case 'smsRead': { const acc = this.accounts[p.token]; for (const m of acc.sms || []) if (m.from === msg.num) m.read = true; this.dirty = true; break; }
      case 'numReq': {
        const v = this.players.get(msg.id);
        if (v && v !== p && v.pos.distanceTo(p.pos) < 15) { this.send(v, { t: 'numReq', id: p.id, name: p.name }); this.send(p, { t: 'sys', text: `📞 ${v.name}님에게 번호 교환을 요청했어요` }); }
        break;
      }
      case 'numAccept': {
        const v = this.players.get(msg.id);
        if (!v || v === p) break;
        const a = this.accounts[p.token], b = this.accounts[v.token];
        const add = (acc, num, name) => { acc.contacts ||= []; if (!acc.contacts.some((c) => c.num === num)) acc.contacts.push({ num, name }); };
        add(a, b.phone, v.name); add(b, a.phone, p.name);
        this.send(p, { t: 'contacts', list: a.contacts }); this.send(v, { t: 'contacts', list: b.contacts });
        this.send(v, { t: 'sys', text: `📞 ${p.name}님과 번호를 교환했어요!` }); this.send(p, { t: 'sys', text: `📞 ${v.name}님과 번호를 교환했어요!` });
        this.dirty = true;
        break;
      }
      case 'flirt': this.flirt(p, msg); break;
      case 'report112': this.combat.report112(p, String(msg.token || '')); break;
      case 'capture': this.wild.capture(p, msg.id | 0, !!msg.ok); break;
      case 'rideSteed': if (!this.wild.rideSteed(p, msg.id | 0)) this.send(p, { t: 'rideNo' }); break;
      case 'leaveSteed': this.wild.leaveSteed(p, msg.id | 0); break;
      case 'heal': if (!p.dead) this.combat.healPlayer(p, Math.max(0, Math.min(100, +msg.v || 0))); break;
      case 'buyHouse': {
        const b = this.buildings[msg.id];
        const acc = this.accounts[p.token];
        if (!b || !isHomeType(b)) break;
        const free = freeUnits(b, this.ownedUnits(b.id));
        const unit = b.type === 'house' ? '단독' : String(msg.unit || '');
        if (!free.includes(unit)) { this.send(p, { t: 'houseFail', reason: '이미 팔린 집이에요' }); break; }
        if ((acc.homes ||= []).length >= 5) { this.send(p, { t: 'houseFail', reason: '집은 5채까지만 가질 수 있어요' }); break; }
        acc.homes.push({ bid: b.id, unit });
        if (acc.homeId == null) { acc.homeId = b.id; acc.homeUnit = unit; }
        this.dirty = true;
        this.send(p, { t: 'houseOk', id: b.id, unit, price: housePrice(b, unit), homeId: acc.homeId, homeUnit: acc.homeUnit, myHomes: acc.homes });
        this.broadcast({ t: 'homes', ...this.homesInfo() });
        break;
      }
      case 'setHome': {
        const acc = this.accounts[p.token];
        const h = (acc.homes || []).find((x) => x.bid === msg.id && x.unit === msg.unit);
        if (!h) break;
        acc.homeId = h.bid; acc.homeUnit = h.unit;
        this.dirty = true;
        this.send(p, { t: 'myHomes', homeId: acc.homeId, homeUnit: acc.homeUnit, myHomes: acc.homes });
        break;
      }
      case 'sellHouse': {
        const acc = this.accounts[p.token];
        const h = (acc.homes || []).find((x) => x.bid === msg.id && x.unit === msg.unit);
        if (!h) break;
        acc.homes = acc.homes.filter((x) => x !== h);
        if (acc.homeId === h.bid && acc.homeUnit === h.unit) { acc.homeId = acc.homes[0]?.bid ?? null; acc.homeUnit = acc.homes[0]?.unit ?? null; }
        this.dirty = true;
        const b = this.buildings[h.bid];
        this.send(p, { t: 'houseSold', id: h.bid, unit: h.unit, price: Math.round(housePrice(b, h.unit) * 0.8), homeId: acc.homeId, homeUnit: acc.homeUnit, myHomes: acc.homes });
        this.broadcast({ t: 'homes', ...this.homesInfo() });
        break;
      }
      case 'buyVehicle': case 'summonCar': {
        if (p.car >= 0 || !(CAR_KINDS.includes(msg.kind) || BIKE_KINDS.includes(msg.kind) || ['tank', 'heli'].includes(msg.kind))) break;
        if (msg.t === 'summonCar' && Date.now() - (p.lastSummon || 0) < 8000) { this.send(p, { t: 'sys', text: '🔑 차를 부른 지 얼마 안 됐어요. 잠시 후 다시 불러주세요' }); break; }
        p.lastSummon = Date.now();
        // 전에 불렀던 내 차는 차고로 돌려보낸다
        const old = p.summoned != null ? this.traffic.cars[p.summoned] : null;
        if (old && old.mode === 'parked') old.mode = 'gone';
        const color = /^#[0-9a-fA-F]{6}$/.test(msg.color) ? msg.color : null;
        const car = this.spawnCarFor(p, msg.kind, color, msg, msg.t === 'buyVehicle');
        p.summoned = car.id;
        break;
      }
    }
  }

  // ---------------- 휴대폰 ----------------
  newPhone() {
    const used = new Set(Object.values(this.accounts).map((a) => a.phone));
    let n;
    do n = `010-${String(1000 + Math.floor(Math.random() * 9000))}-${String(1000 + Math.floor(Math.random() * 9000))}`; while (used.has(n));
    return n;
  }
  accByPhone(num) { return Object.entries(this.accounts).find(([, a]) => a.phone === num) || null; }
  contactAdd(p, msg) {
    const num = String(msg.num || '').trim();
    const acc = this.accounts[p.token];
    const found = this.accByPhone(num);
    if (!found) { this.send(p, { t: 'sys', text: '📵 없는 번호예요' }); return; }
    if (found[1] === acc) { this.send(p, { t: 'sys', text: '내 번호예요 😅' }); return; }
    acc.contacts ||= [];
    const name = String(msg.name || '').trim().slice(0, 12) || found[1].name;
    const ex = acc.contacts.find((c) => c.num === num);
    if (ex) ex.name = name; else acc.contacts.push({ num, name });
    if (acc.contacts.length > 100) acc.contacts.shift();
    this.dirty = true;
    this.send(p, { t: 'contacts', list: acc.contacts });
    this.send(p, { t: 'sys', text: `📞 ${name} (${num}) 저장 완료` });
  }
  sendSms(p, msg) {
    const text = String(msg.text || '').trim().slice(0, 200);
    if (!text || Date.now() - (p.lastSms || 0) < 700) return;
    p.lastSms = Date.now();
    const acc = this.accounts[p.token];
    const found = this.accByPhone(String(msg.to || ''));
    if (!found) { this.send(p, { t: 'sys', text: '📵 없는 번호예요' }); return; }
    const [tok, to] = found;
    const m = { from: acc.phone, fromName: acc.name, to: to.phone, text, t: Date.now() };
    (to.sms ||= []).push({ ...m, read: false });
    (acc.sms ||= []).push({ ...m, read: true, mine: true });
    for (const a of [to, acc]) if (a.sms.length > 200) a.sms.splice(0, a.sms.length - 200);
    this.dirty = true;
    this.send(p, { t: 'smsOut', m: { ...m, mine: true, read: true } });
    const v = [...this.players.values()].find((x) => x.token === tok);
    if (v) this.send(v, { t: 'smsIn', m: { ...m, read: false } });
  }

  // ---------------- 튄더 (다른 플레이어와 매칭) ----------------
  tinderPerson(token) {
    const a = this.accounts[token];
    if (!a) return null;
    return { token, name: a.name, gender: a.profile.gender, age: a.profile.age, level: a.profile.level || 1, job: a.profile.jobName || '', personality: a.profile.personality, color: a.profile.color, look: a.profile.look, accessories: a.profile.accessories, badges: a.profile.badges || [], bio: a.tinder?.bio || '', photo: a.tinder?.photo || null, online: [...this.players.values()].some((x) => x.token === token) };
  }
  tinderCards(p) {
    const me = this.accounts[p.token];
    const t = (me.tinder ||= { likes: [], passes: [] });
    const mine = new Set(this.users[me.owner]?.chars || [p.token]);
    return Object.keys(this.accounts).filter((tok) => !mine.has(tok) && !t.likes.includes(tok) && !t.passes.includes(tok) && this.accounts[tok].owner)
      .sort((a, b) => (this.accounts[b].last || 0) - (this.accounts[a].last || 0)).slice(0, 30).map((tok) => this.tinderPerson(tok));
  }
  tinderSwipe(p, token, like) {
    const me = this.accounts[p.token], other = this.accounts[token];
    if (!other || token === p.token) return;
    const t = (me.tinder ||= { likes: [], passes: [] });
    (like ? t.likes : t.passes).push(token);
    this.dirty = true;
    if (like && other.tinder?.likes?.includes(p.token) && !this.matches.some((m) => (m.a === p.token && m.b === token) || (m.b === p.token && m.a === token))) {
      const m = { id: crypto.randomBytes(6).toString('hex'), a: p.token, b: token, t: Date.now(), msgs: [] };
      this.matches.push(m);
      this.send(p, { t: 'tdMatch', mid: m.id, other: this.tinderPerson(token) });
      const o = [...this.players.values()].find((x) => x.token === token);
      if (o) this.send(o, { t: 'tdMatch', mid: m.id, other: this.tinderPerson(p.token) });
    }
  }
  tinderMatches(p) {
    return this.matches.filter((m) => m.a === p.token || m.b === p.token).map((m) => {
      const last = m.msgs.at(-1);
      return { mid: m.id, other: this.tinderPerson(m.a === p.token ? m.b : m.a), last: last ? (last.contact ? '📇 연락처' : last.text) : '', t: last?.t || m.t, unread: m.msgs.filter((x) => x.from !== p.token && !x.read).length };
    }).filter((x) => x.other).sort((a, b) => b.t - a.t);
  }
  tinderSend(p, msg) {
    const m = this.matches.find((x) => x.id === msg.mid && (x.a === p.token || x.b === p.token));
    if (!m || Date.now() - (p.lastTd || 0) < 500) return;
    p.lastTd = Date.now();
    const me = this.accounts[p.token];
    const item = { from: p.token, t: Date.now(), read: false };
    if (msg.contact) item.contact = { name: me.name, num: me.phone };
    else { item.text = String(msg.text || '').trim().slice(0, 300); if (!item.text) return; }
    m.msgs.push(item);
    if (m.msgs.length > 300) m.msgs.shift();
    this.dirty = true;
    const otherTok = m.a === p.token ? m.b : m.a;
    this.send(p, { t: 'tdMsg', mid: m.id, msg: item });
    const o = [...this.players.values()].find((x) => x.token === otherTok);
    if (o) this.send(o, { t: 'tdMsg', mid: m.id, msg: item, name: me.name });
  }

  // ---------------- 사진 · 인스타그램 ----------------
  ownsChar(sub, token) { return this.users[sub]?.chars.includes(token) && this.accounts[token]; }
  savePhoto(sub, char, dataUrl) {
    const acc = this.ownsChar(sub, char);
    if (!acc) throw new Error('내 캐릭터가 아니에요');
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw new Error('잘못된 사진');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > 450 * 1024) throw new Error('사진이 너무 커요');
    const id = crypto.randomBytes(10).toString('hex');
    fs.writeFileSync(path.join(this.photoDir, `${id}.jpg`), buf);
    this.photos[id] = { owner: char, ownerName: acc.name, t: Date.now(), posted: false, caption: '', likes: [] };
    // 캐릭터당 사진 80장까지 (올리지 않은 오래된 것부터 정리)
    const mine = Object.entries(this.photos).filter(([, p]) => p.owner === char && !p.posted).sort((a, b) => a[1].t - b[1].t);
    while (mine.length > 80) this.deletePhoto(mine.shift()[0]);
    this.dirty = true;
    return id;
  }
  deletePhoto(id) {
    delete this.photos[id];
    try { fs.unlinkSync(path.join(this.photoDir, `${id}.jpg`)); } catch { /* 이미 없음 */ }
    this.dirty = true;
  }
  myPhotos(char) { return Object.entries(this.photos).filter(([, p]) => p.owner === char).sort((a, b) => b[1].t - a[1].t).map(([id, p]) => ({ id, t: p.t, posted: p.posted, caption: p.caption, likes: p.likes.length })); }
  instaPost(id, p, char) {
    const acc = this.accounts[p.owner];
    return { id, owner: p.owner, name: acc?.name || p.ownerName, mine: p.owner === char, caption: p.caption, t: p.postedAt, likes: p.likes.length, liked: p.likes.includes(char), level: acc?.profile?.level || 1, following: this.isFollowing(char, p.owner), comments: (p.comments || []).slice(-3).map((c) => this.instaComment(c, p, char)), commentCount: (p.comments || []).length };
  }
  instaComment(c, p, char) { return { id: c.id, by: c.by, name: this.accounts[c.by]?.name || c.name, text: c.text, t: c.t, canDel: c.by === char || p.owner === char }; }
  // mode: 'all' 전체, 'following' 팔로우한 사람 것만, 캐릭터 토큰이면 그 사람 게시물만
  instaFeed(char, mode = 'all') {
    const follows = new Set(this.accounts[char]?.follows || []);
    return Object.entries(this.photos)
      .filter(([, p]) => p.posted && (mode === 'all' || (mode === 'following' ? follows.has(p.owner) || p.owner === char : p.owner === mode)))
      .sort((a, b) => b[1].postedAt - a[1].postedAt).slice(0, 60)
      .map(([id, p]) => this.instaPost(id, p, char));
  }
  instaComments(char, id) {
    const p = this.photos[id];
    if (!p?.posted) throw new Error('없는 게시물');
    return (p.comments || []).map((c) => this.instaComment(c, p, char));
  }
  commentInsta(sub, char, id, text) {
    const p = this.photos[id];
    const acc = this.ownsChar(sub, char);
    if (!acc || !p?.posted) throw new Error('없는 게시물');
    text = String(text || '').trim().slice(0, 200);
    if (!text) throw new Error('댓글을 적어주세요');
    if (!this.cooldown(`${char}:comment`, 1500)) throw new Error('잠시 후 다시 써주세요');
    p.comments ||= [];
    p.comments.push({ id: crypto.randomBytes(5).toString('hex'), by: char, name: acc.name, text, t: Date.now() });
    if (p.comments.length > 200) p.comments.shift();
    if (p.owner !== char) this.notify(p.owner, { t: 'sys', text: `💬 ${acc.name}님이 내 인스타 사진에 댓글을 남겼어요: ${text.slice(0, 30)}` });
    this.dirty = true;
    return this.instaComments(char, id);
  }
  deleteComment(sub, char, id, cid) {
    const p = this.photos[id];
    if (!this.ownsChar(sub, char) || !p?.posted) throw new Error('없는 게시물');
    const i = (p.comments || []).findIndex((c) => c.id === cid);
    if (i < 0) throw new Error('없는 댓글');
    if (p.comments[i].by !== char && p.owner !== char) throw new Error('내 댓글이 아니에요');
    p.comments.splice(i, 1);
    this.dirty = true;
    return this.instaComments(char, id);
  }

  // ---------------- 팔로우 ----------------
  isFollowing(char, target) { return !!this.accounts[char]?.follows?.includes(target); }
  followerCount(target) { let n = 0; for (const a of Object.values(this.accounts)) if (a.follows?.includes(target)) n++; return n; }
  follow(sub, char, target) {
    const acc = this.ownsChar(sub, char);
    if (!acc || !this.accounts[target] || target === char) throw new Error('팔로우할 수 없어요');
    acc.follows ||= [];
    const i = acc.follows.indexOf(target);
    if (i >= 0) acc.follows.splice(i, 1);
    else {
      acc.follows.push(target);
      this.notify(target, { t: 'sys', text: `👥 ${acc.name}님이 나를 팔로우했어요` });
    }
    this.dirty = true;
    return { following: i < 0, followers: this.followerCount(target) };
  }
  instaProfile(char, target) {
    const a = this.accounts[target];
    if (!a) throw new Error('없는 사람이에요');
    const posts = this.instaFeed(char, target);
    return { token: target, name: a.name, level: a.profile?.level || 1, job: a.profile?.jobName || '', mine: target === char, following: this.isFollowing(char, target), followers: this.followerCount(target), followingCount: (a.follows || []).filter((t) => this.accounts[t]).length, posts, online: [...this.players.values()].some((x) => x.token === target) };
  }
  followList(target, which) {
    const a = this.accounts[target];
    if (!a) throw new Error('없는 사람이에요');
    const toks = which === 'followers' ? Object.keys(this.accounts).filter((t) => this.accounts[t].follows?.includes(target)) : (a.follows || []).filter((t) => this.accounts[t]);
    return toks.map((t) => ({ token: t, name: this.accounts[t].name, level: this.accounts[t].profile?.level || 1 }));
  }

  // ---------------- 인스타 DM ----------------
  dmKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
  dmThreads(char) {
    const out = [];
    for (const [k, list] of Object.entries(this.dms)) {
      const [a, b] = k.split('|');
      if (a !== char && b !== char) continue;
      const other = a === char ? b : a;
      if (!this.accounts[other] || !list.length) continue;
      const last = list.at(-1);
      out.push({ token: other, name: this.accounts[other].name, last: last.text, lastMine: last.from === char, t: last.t, unread: list.filter((m) => m.from !== char && !m.read).length });
    }
    return out.sort((x, y) => y.t - x.t);
  }
  dmThread(sub, char, other) {
    if (!this.ownsChar(sub, char) || !this.accounts[other]) throw new Error('없는 사람이에요');
    const list = this.dms[this.dmKey(char, other)] || [];
    let changed = false;
    for (const m of list) if (m.from !== char && !m.read) { m.read = true; changed = true; }
    if (changed) this.dirty = true;
    return { other: { token: other, name: this.accounts[other].name, level: this.accounts[other].profile?.level || 1 }, msgs: list.map((m) => ({ mine: m.from === char, text: m.text, t: m.t })) };
  }
  sendDm(sub, char, to, text) {
    const acc = this.ownsChar(sub, char);
    if (!acc || !this.accounts[to] || to === char) throw new Error('보낼 수 없어요');
    text = String(text || '').trim().slice(0, 300);
    if (!text) throw new Error('메시지를 적어주세요');
    if (!this.cooldown(`${char}:dm`, 700)) throw new Error('천천히 보내주세요');
    const k = this.dmKey(char, to);
    const list = (this.dms[k] ||= []);
    list.push({ from: char, t: Date.now(), text, read: false });
    if (list.length > 300) list.shift();
    this.notify(to, { t: 'dm', from: char, name: acc.name, text });
    this.dirty = true;
    return this.dmThread(sub, char, to);
  }
  forgetDms(token) { for (const k of Object.keys(this.dms)) if (k.split('|').includes(token)) delete this.dms[k]; }
  cooldown(key, ms) {
    const now = Date.now();
    if (now - (this.lastAct.get(key) || 0) < ms) return false;
    this.lastAct.set(key, now);
    return true;
  }
  // 접속 중인 캐릭터에게 실시간 알림
  notify(token, obj) { for (const x of this.players.values()) if (x.token === token) this.send(x, obj); }
  postInsta(sub, char, id, caption) {
    const p = this.photos[id];
    if (!this.ownsChar(sub, char) || !p || p.owner !== char) throw new Error('내 사진이 아니에요');
    p.posted = true; p.postedAt = Date.now(); p.caption = String(caption || '').slice(0, 150);
    this.dirty = true;
    this.broadcast({ t: 'sys', text: `📸 ${this.accounts[char].name}님이 인스타그램에 새 사진을 올렸어요!` });
  }
  likeInsta(sub, char, id) {
    const p = this.photos[id];
    if (!this.ownsChar(sub, char) || !p?.posted) throw new Error('없는 게시물');
    const i = p.likes.indexOf(char);
    if (i >= 0) p.likes.splice(i, 1); else {
      p.likes.push(char);
      const owner = [...this.players.values()].find((x) => x.token === p.owner);
      if (owner && p.owner !== char) this.send(owner, { t: 'sys', text: `❤️ ${this.accounts[char].name}님이 내 인스타 사진을 좋아해요` });
    }
    this.dirty = true;
    return p.likes.length;
  }

  // ---------------- 건의함 ----------------
  addFeedback(who, char, text) {
    text = String(text || '').trim().slice(0, 2000);
    if (text.length < 2) throw new Error('내용을 적어주세요');
    const mine = this.feedback.filter((f) => f.sub === who.sub && Date.now() - f.t < 60000);
    if (mine.length >= 3) throw new Error('잠시 후 다시 보내주세요');
    this.feedback.push({ id: crypto.randomBytes(6).toString('hex'), t: Date.now(), sub: who.sub, email: who.user.email, user: who.user.name, char: this.accounts[char]?.name || '', text, done: false });
    if (this.feedback.length > 2000) this.feedback.shift();
    this.dirty = true;
  }

  // 플러팅: 하트 날리기. 매력이 높을수록 잘 먹힌다
  flirt(p, msg) {
    if (p.dead || Date.now() - (p.lastFlirt || 0) < 2000) return;
    p.lastFlirt = Date.now();
    const from = [p.pos.x, p.pos.y, p.pos.z];
    if (msg.tt === 'npc') {
      const c = this.sim.citizens[msg.id];
      if (!c || c.mode === 'dead') return;
      const pos = this.combat.npcPos(c);
      if (pos.distanceTo(p.pos) > 9) return;
      const charm = p.profile.charm || 0;
      const grudge = c.grudges[p.token]?.pts || 0;
      const aff = this.aff(c, p.token);
      const chance = Math.max(0.1, Math.min(0.95, 0.35 + charm / 120 + aff / 200 - grudge / 80 + (c.personality.id === 'romantic' ? 0.2 : 0) - (c.age < 18 ? 1 : 0)));
      const ok = Math.random() < chance;
      if (c.age < 18) c.say('어... 저 아직 학생인데요? 😅', 3);
      else if (ok) { c.say(['어머 😳💕', '헉... 설레잖아요 🥰', '저도 하트 💗', '오늘 좀 멋있네요? 😊', '부끄러워요... ☺️'][Math.floor(Math.random() * 5)], 3); c.emote('love', 4); this.sim.adjustMood(c, 8, `${p.name}가 하트를 보냄`); }
      else { c.say(['뭐예요... 😒', '저 바빠요 😑', '하하... 네... 😅', '부담스러워요 🙄'][Math.floor(Math.random() * 4)], 3); c.emote(grudge > 30 ? 'angry' : 'surprised', 3); }
      const v = this.setAff(c, p.token, aff + (c.age < 18 ? 0 : ok ? 4 + Math.round(charm / 25) : -2));
      this.send(p, { t: 'aff', npc: c.id, v });
      this.send(p, { t: 'flirtRes', ok: ok && c.age >= 18, name: c.name });
      this.broadcast({ t: 'fx', k: 'hearts', a: from, b: [pos.x, pos.y, pos.z], pid: p.id, loc: p.loc, e: ok ? '💗' : '💔' });
    } else if (msg.tt === 'player') {
      const v = this.players.get(msg.id);
      if (!v || v === p || v.loc !== p.loc || v.pos.distanceTo(p.pos) > 9) return;
      this.send(v, { t: 'flirted', name: p.name });
      this.send(p, { t: 'flirtRes', ok: true, name: v.name, player: true });
      this.broadcast({ t: 'fx', k: 'hearts', a: from, b: [v.pos.x, v.pos.y, v.pos.z], pid: p.id, loc: p.loc, e: '💖' });
    } else this.broadcast({ t: 'fx', k: 'hearts', a: from, b: null, pid: p.id, loc: p.loc, e: '💗' });
  }

  spawnCarFor(p, kind, color, msg, enter) {
    const car = this.traffic.spawnParked(new THREE.Vector3(+msg.x || p.pos.x, 0, +msg.z || p.pos.z), +msg.h || 0, kind, color);
    this.broadcast({ t: 'carSpawn', id: car.id, x: car.pos.x, z: car.pos.z, h: car.heading, kind: car.kind, color: car.color });
    if (enter) {
      this.traffic.enter(car, p.id);
      p.car = car.id;
      this.send(p, { t: 'carOk', id: car.id });
    }
    this.dirty = true;
    return car;
  }

  updateActiveBuildings() {
    const occupied = new Set([...this.players.values()].map((p) => p.loc).filter((l) => l >= 0));
    for (const id of occupied) this.sim.activate(this.buildings[id]);
    for (const id of [...this.sim.active.keys()]) if (!occupied.has(id)) this.sim.deactivate(this.buildings[id]);
  }

  broadcastSleep() {
    const list = [...this.players.values()];
    this.broadcast({ t: 'sleepers', n: list.filter((p) => p.sleeping).length, total: list.length });
  }

  // ---------------- LLM 대화 ----------------
  timeText() {
    const m = this.minutes, h = (m % 1440) / 60, day = Math.floor(m / 1440);
    const part = h < 5 ? '새벽' : h < 9 ? '아침' : h < 12 ? '오전' : h < 14 ? '점심때' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
    return `${day + 1}일차 ${DAYS[day % 7]}요일 ${part} (${fmtTime(m)}), 날씨 ${this.weather}`;
  }
  placeText(p) {
    if (p.loc >= 0) return `${this.buildings[p.loc].name} 안`;
    let best = null, bd = 30;
    for (const b of this.buildings) { const d = Math.hypot(b.door.x - p.pos.x, b.door.z - p.pos.z); if (d < bd) { bd = d; best = b; } }
    return best ? `${best.name} 근처 거리` : '젤리시티의 거리';
  }
  llmCtx(p, c) {
    const pr = p.profile;
    const mem = this.memories[c.id] || [];
    return {
      city: this.city, sim: this.sim,
      player: { name: p.name, age: pr.age, gender: pr.gender, personality: pr.personality, jobName: pr.jobName || '구직 중 (최근 이사 옴)' },
      timeText: this.timeText(), placeText: this.placeText(p),
      affinity: this.aff(c, p.token),
      grudge: c.grudges[p.token]?.pts || 0,
      memories: mem.filter((x) => x.token === p.token).map((x) => x.text),
      others: [...new Set(mem.filter((x) => x.token !== p.token).map((x) => x.name))].slice(0, 3),
    };
  }

  async talk(p, msg) {
    const c = this.sim.citizens[msg.npc];
    if (!c) return;
    if (c.talkingTo !== null && c.talkingTo !== p.id) { this.send(p, { t: 'talk', npc: c.id, busy: true }); return; }
    if (['dead', 'flee', 'fight'].includes(c.mode)) { this.send(p, { t: 'talk', npc: c.id, busy: true, reason: c.mode }); return; }
    if ((c.grudges[p.token]?.pts || 0) >= 50 || c.report?.token === p.token) {
      c.say(['말 걸지 마세요 😠', '당신하고는 할 말 없어요!', '저리 가요! 신고할 거예요 🚔'][Math.floor(Math.random() * 3)], 3);
      c.emote('angry', 3);
      this.send(p, { t: 'talk', npc: c.id, busy: true, reason: 'grudge' });
      return;
    }
    if (p.talkBusy) return;
    if (p.talking !== null && p.talking !== c.id) this.endTalk(p, p.talking);
    p.talkBusy = true;
    p.lastTalk = Date.now();
    if (c.mode !== 'player') this.sim.beginPlayerTalk(c, { id: p.id, name: p.name, pos: p.pos });
    p.talking = c.id;
    const text = msg.text ? String(msg.text).slice(0, 200) : null;
    const note = msg.note ? String(msg.note).slice(0, 120) : null;
    const key = `${c.id}:${p.token}`;
    const log = (this.chatLogs[key] ||= []);
    const ctx = this.llmCtx(p, c);
    let content = text;
    if (msg.greeting) content = '(플레이어가 다가와 말을 건다. 지금 상황에 맞게 먼저 인사해.)';
    if (note) content = note;
    let r, error;
    try {
      if (!llmEnabled) throw new Error('offline');
      const out = await complete([{ role: 'system', content: profileSystemPrompt(c, ctx) }, ...log.slice(-14), { role: 'user', content }], { schema: SCHEMAS.talk, temperature: 0.95, max_tokens: 450 });
      r = { reply: String(out.reply || '...').slice(0, 400), emotion: out.emotion || 'neutral', affinity_delta: clampInt(out.affinity_delta, -3, 3), mood_delta: clampInt(out.mood_delta, -10, 10), insulted: out.insulted === true, action: out.action || 'none', amount: clampInt(out.amount, 0, 30) };
      // LLM이 놓친 노골적인 욕설도 잡아낸다
      if (text && INSULT.test(text) && !r.insulted) { r.insulted = true; r.mood_delta = Math.min(r.mood_delta, -6); }
    } catch (e) {
      if (e.message !== 'offline') { error = e.message; console.warn('LLM 오류:', e.message); }
      r = fallbackReply(c, ctx, text, { greeting: msg.greeting, note });
    }
    p.talkBusy = false;
    if (text) log.push({ role: 'user', content: text });
    if (note) log.push({ role: 'user', content: note });
    log.push({ role: 'assistant', content: r.reply });
    if (log.length > 24) log.splice(0, log.length - 24);
    if (text || note) p.talked = true;
    const affinity = this.setAff(c, p.token, this.aff(c, p.token) + r.affinity_delta + (note ? 4 : 0));
    // 기분 & 원한
    if (text || note) {
      const md = r.mood_delta || 0;
      this.sim.adjustMood(c, md * 1.5, r.insulted ? `${p.name}에게 욕을 들음` : md > 2 ? `${p.name}와(과) 즐거운 대화` : md < -2 ? `${p.name}의 말에 기분이 상함` : null);
      if (r.insulted) this.sim.addGrudge(c, { token: p.token, name: p.name }, 22, '욕설과 모욕');
      else if (md <= -6) this.sim.addGrudge(c, { token: p.token, name: p.name }, 8, '무례한 말');
      if (c.report?.token === p.token) r.action = 'end';
    }
    c.emote(r.emotion === 'thinking' ? 'neutral' : r.emotion, 5);
    this.sim.emit({ t: 'talking', id: c.id });
    c.say(r.reply.length > 40 ? r.reply.slice(0, 38) + '…' : r.reply, 4);
    this.send(p, { t: 'talk', npc: c.id, reply: r.reply, emotion: r.emotion, delta: r.affinity_delta, affinity, action: r.action, amount: r.amount, error, offline: !llmEnabled, mood: Math.round(c.mood), moodDelta: r.mood_delta || 0, insulted: !!r.insulted, reporting: c.report?.token === p.token });
  }

  async endTalk(p, npcId) {
    const c = this.sim.citizens[npcId];
    if (!c || c.talkingTo !== p.id) { p.talking = null; return; }
    this.sim.endPlayerTalk(c);
    p.talking = null;
    if (!p.talked) return;
    p.talked = false;
    const log = this.chatLogs[`${c.id}:${p.token}`] || [];
    let text = null;
    if (llmEnabled) {
      try {
        const recent = log.slice(-12).map((m) => `${m.role === 'user' ? p.name : c.name}: ${m.content}`).join('\n');
        const out = await complete([{ role: 'system', content: memoryPrompt(c, p.name) }, { role: 'user', content: recent }], { schema: SCHEMAS.memory, temperature: 0.5, max_tokens: 200 });
        text = out.memory ? String(out.memory).slice(0, 80) : null;
      } catch { /* 무시 */ }
    } else {
      const lastUser = [...log].reverse().find((m) => m.role === 'user');
      if (lastUser) text = `${this.timeText()}에 ${p.name}가 "${lastUser.content.slice(0, 30)}"라고 말했다`;
    }
    if (!text) return;
    const list = (this.memories[c.id] ||= []);
    list.push({ token: p.token, name: p.name, text });
    const mine = list.filter((x) => x.token === p.token);
    if (mine.length > 6) list.splice(list.indexOf(mine[0]), 1);
    if (list.length > 20) list.shift();
    this.dirty = true;
    this.send(p, { t: 'mem', npc: c.id, list: list.filter((x) => x.token === p.token).map((x) => x.text) });
  }

  handleReport(c, rep) {
    this.addMemory(c, rep, `${rep.name}을(를) ${rep.reason} 때문에 경찰에 신고했다`);
    this.reportBy(c.name, rep);
  }
  handlePlayerReport(v, rep) {
    this.reportBy(`${v.name}님`, rep);
    this.send(v, { t: 'sys', text: `📱 112에 ${rep.name}님을 신고했어요. 경찰이 출동합니다 🚓` });
  }
  reportBy(who, rep) {
    const p = [...this.players.values()].find((x) => x.token === rep.token);
    const text = `🚔 ${who}이(가) 112에 ${rep.name}님을 신고했어요! (사유: ${rep.reason})`;
    const heat = { 살인: 70, '살인 목격': 60, 폭행: 35 }[rep.reason] || 25;
    if (p) {
      this.combat.addHeat(p, heat, `${who}의 신고 (${rep.reason})`);
      this.send(p, { t: 'sys', text });
    } else {
      const acc = this.accounts[rep.token];
      if (acc) { acc.pendingHeat = Math.min(200, (acc.pendingHeat || 0) + 25); acc.pendingReports = (acc.pendingReports || 0) + 1; this.dirty = true; }
    }
    for (const o of this.players.values()) if (o !== p) this.send(o, { t: 'sys', text });
  }

  addMemory(c, p, text) {
    const list = (this.memories[c.id] ||= []);
    list.push({ token: p.token, name: p.name, text });
    if (list.length > 20) list.shift();
    this.dirty = true;
  }

  async streetChat(a, b) {
    if (!llmEnabled) return null;
    const now = Date.now();
    this.streetChatTimes = this.streetChatTimes.filter((t) => now - t < 60000);
    if (this.streetChatTimes.length >= this.streetChatPerMin) return null; // 비용 상한
    this.streetChatTimes.push(now);
    try {
      const out = await complete([{ role: 'user', content: streetChatPrompt(a, b, { timeText: this.timeText() }) }], { schema: SCHEMAS.street, temperature: 1.0, max_tokens: 500 });
      const lines = (out.lines || []).filter((l) => l && l.text).slice(0, 6).map((l) => ({ speaker: l.speaker === 'B' ? 'B' : 'A', text: String(l.text).slice(0, 60) }));
      return lines.length ? lines : null;
    } catch { return null; }
  }

  // ---------------- 틱 ----------------
  tick(dt) {
    this.minutes += dt * this.timeSpeed;
    const day = Math.floor(this.minutes / 1440);
    if (day !== this.lastDay) { this.lastDay = day; this.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)]; }
    const players = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, pos: p.pos, loc: p.loc, car: p.car, dead: p.dead }));
    this.sim.update(dt, this.minutes, { players });
    this.traffic.update(dt, { players, sim: this.sim });
    // 막혀서 빵빵거린 차: 말풍선과 경적 소리를 모두에게
    for (const car of this.traffic.cars) if (car.honk) { car.honk = false; this.broadcast({ t: 'carSay', id: car.id, text: car.bubble?.text || '빵빵~ 🚗' }); }
    this.combat.tick(dt);
    this.wild.tick(dt);
    this.titans.tick(dt);
    if (this.smashed.size) { const now = Date.now(); for (const [k, t] of this.smashed) if (now > t) { this.smashed.delete(k); this.broadcast({ t: 'unsmash', key: k }); } }
    // 대화 중인 플레이어가 멀어지거나 오래 말이 없으면 대화 종료
    for (const p of this.players.values()) {
      if (p.talking === null) continue;
      const c = this.sim.citizens[p.talking];
      const src = c.location && c.prevMode === 'inside' ? c.ipos : c.pos;
      if (Date.now() - p.lastTalk > 180000 || Math.hypot(src.x - p.pos.x, src.z - p.pos.z) > 12) this.endTalk(p, p.talking);
    }
    // 모두 자면 아침으로
    const list = [...this.players.values()];
    const h = (this.minutes % 1440) / 60;
    if (list.length && list.every((p) => p.sleeping) && (h >= 20 || h < 6)) {
      this.minutes = (Math.floor(this.minutes / 1440) + (h >= 20 ? 1 : 0)) * 1440 + 7 * 60;
      this.sim.resolveAll(this.minutes);
      for (const p of list) p.sleeping = false;
      this.broadcast({ t: 'skip', minutes: this.minutes });
    }
  }

  npcMeta(c) {
    return [c.id, MODES.indexOf(c.mode), c.location ? c.location.id : -1, PLAN_KINDS.indexOf(c.plan?.kind || 'none'),
      c.plan?.building ? c.plan.building.id : -1, c.dest ? c.dest.id : -1, c.chatWith ? c.chatWith.id : -1, c.talkingTo ?? -1];
  }

  snapshot() {
    const npcs = [];
    const meta = [];
    for (const c of this.sim.citizens) {
      npcs.push(q(c.pos.x), q(c.pos.z), q(c.heading, 100), c.moving > 0 ? 1 : 0, q(c.ipos.x), q(c.ipos.z));
      const m = this.npcMeta(c);
      const key = m.join(',');
      if (this.lastMeta.get(c.id) !== key) { this.lastMeta.set(c.id, key); meta.push(m); }
    }
    const cars = [];
    for (const car of this.traffic.cars) cars.push(q(car.pos.x), q(car.pos.z), q(car.heading, 100), q(car.speed), CAR_MODES.indexOf(car.mode), car.owner ?? -1, q(car.pos.y || 0), car.occ || 0, q(car.turret || 0, 100));
    const players = [...this.players.values()].map((p) => [p.id, q(p.pos.x, 100), q(p.pos.y, 100), q(p.pos.z, 100), q(p.heading, 100), q(p.speed), p.loc, p.car, p.air, p.sleeping ? 1 : 0, Math.round(p.hp), p.dead ? 1 : 0, p.stars || 0, p.mount ?? -1]);
    const snap = { t: 'snap', m: this.minutes, w: this.weather, n: npcs, meta, c: cars, p: players, u: this.combat.unitSnap(), ti: this.titans.snap(), ev: this.sim.drainEvents() };
    if (this.snapN % 3 === 0) snap.a = this.wild.snap();
    if (++this.snapN % 10 === 0) {
      const nd = [];
      for (const c of this.sim.citizens) nd.push(Math.round(c.hp), Math.round(c.needs.hunger), Math.round(c.needs.energy), Math.round(c.needs.fun), Math.round(c.needs.social), Math.round(c.needs.hygiene), Math.round(c.mood));
      snap.nd = nd;
    }
    return snap;
  }
}

function playerMeta(p) {
  return { id: p.id, name: p.name, profile: p.profile };
}

function sanitizeProfile(pr = {}) {
  const str = (v, n, d) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : d);
  return {
    name: str(pr.name, 8, '젤리'),
    gender: ['여', '남'].includes(pr.gender) ? pr.gender : '여',
    age: Math.max(18, Math.min(80, Number(pr.age) || 25)),
    personality: str(pr.personality, 20, '명랑한 수다쟁이'),
    color: /^#[0-9a-fA-F]{6}$/.test(pr.color) ? pr.color : '#8a5634',
    accessories: Array.isArray(pr.accessories) ? pr.accessories.slice(0, 6).map((a) => String(a).slice(0, 24)) : [],
    jobName: str(pr.jobName, 20, ''),
    held: typeof pr.held === 'string' ? pr.held.slice(0, 32) : null,
    def: Math.max(0, Math.min(150, Number(pr.def) || 0)),
    charm: Math.max(0, Math.min(500, Number(pr.charm) || 0)),
    regen: Math.max(0, Math.min(6, Number(pr.regen) || 0)),
    look: sanitizeLook(pr.look),
    level: Math.max(1, Math.min(9999, Math.floor(Number(pr.level)) || 1)),
    badges: Array.isArray(pr.badges) ? pr.badges.slice(0, 8).map((b) => String(b).slice(0, 24)) : [],
    phone: typeof pr.phone === 'string' ? pr.phone.slice(0, 16) : '',
  };
}
