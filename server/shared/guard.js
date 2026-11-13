// 보안 공통 모듈: 속도 제한(토큰 버킷) · 보안 사건 기록 · 글자 정리 · 웹소켓 지킴이
//   원칙: 정상 플레이어가 억울하지 않게 넉넉히. 애매하면 막지 말고 기록(sec.note)해서 관리자가 본다
//   IP 는 저장하지 않는다. 기록에는 하루마다 바뀌는 소금을 친 해시(앞 12자)만 남긴다
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---------- 누가 보냈나 ----------
// Fly 프록시가 붙여 주는 진짜 접속 IP (없으면 소켓 주소)
//   Fly 앱은 프록시를 거쳐서만 닿고 프록시가 이 머리글을 새로 쓴다. 소켓 주소로만 보면 모든 사람이 프록시 주소 하나로 묶여 버린다
export const clientIp = (req) => String(req?.headers?.['fly-client-ip'] || req?.socket?.remoteAddress || '').slice(0, 64);
// 순위표 · 공개 응답에 나가는 사람 표시: 계정 id(익명 id 는 비밀번호와 같다)를 그대로 내보내지 않고 짧은 해시로
export const publicId = (sub) => crypto.createHash('sha256').update(`pid:${sub}`).digest('hex').slice(0, 10);
const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
let salt = crypto.randomBytes(16).toString('hex');
export const ipHash = (ip, day = kstDay()) => crypto.createHash('sha256').update(`${salt}:${day}:${ip}`).digest('hex').slice(0, 12);

// ---------- 토큰 버킷 ----------
// rate = 1초에 채워지는 개수, burst = 한 번에 쓸 수 있는 최대. take(key) 가 false 면 넘친 것
export class Bucket {
  constructor({ rate, burst, max = 50000 }) { this.rate = rate; this.burst = burst; this.max = max; this.m = new Map(); }
  take(key, n = 1, now = Date.now()) {
    let b = this.m.get(key);
    if (!b) { if (this.m.size >= this.max) this.sweep(now); b = { t: this.burst, at: now }; this.m.set(key, b); }
    b.t = Math.min(this.burst, b.t + ((now - b.at) / 1000) * this.rate); b.at = now;
    if (b.t < n) return false;
    b.t -= n; return true;
  }
  // 가득 찬(오래 안 쓴) 버킷은 지운다. 그래도 많으면 앞에서부터
  sweep(now = Date.now()) {
    for (const [k, b] of this.m) if (b.t + ((now - b.at) / 1000) * this.rate >= this.burst) this.m.delete(k);
    if (this.m.size >= this.max) { let n = this.m.size - Math.floor(this.max * 0.8); for (const k of this.m.keys()) { if (n-- <= 0) break; this.m.delete(k); } }
  }
}
// 하루 개수 세기 (한국 날짜가 바뀌면 처음부터)
export class DayCount {
  constructor(max = 100000) { this.day = kstDay(); this.m = new Map(); this.max = max; }
  roll() { const d = kstDay(); if (d !== this.day) { this.day = d; this.m.clear(); } }
  get(key) { this.roll(); return this.m.get(key) || 0; }
  add(key, n = 1) { this.roll(); if (this.m.size >= this.max && !this.m.has(key)) this.m.clear(); const v = (this.m.get(key) || 0) + n; this.m.set(key, v); return v; }
}

// ---------- 보안 사건 기록 ----------
//   kind: rate(속도 제한) · origin(Origin 거절) · ws(웹소켓 폭주 · 이상한 메시지) · record(거절 · 의심 기록) · llm(주입 의심 · 예산) · anon(익명 id 농사) · path(경로 넘어가기) · json(오염 본문) · csp(CSP 위반) · admin(관리자 행동) · text(사칭 · 도배)
export const SEC_KINDS = ['rate', 'origin', 'ws', 'record', 'llm', 'anon', 'path', 'json', 'csp', 'admin', 'text'];
class SecLog {
  constructor() { this.days = {}; this.recent = []; this.file = null; this.dirty = false; this.quiet = new Bucket({ rate: 1, burst: 20 }); }
  init(dataDir) {
    this.file = path.join(dataDir, 'security.json');
    try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); this.days = d.days || {}; this.recent = d.recent || []; if (/^[0-9a-f]{32}$/.test(d.salt || '')) salt = d.salt; } catch { /* 처음 */ }
    this.dirty = true; this.save();
    setInterval(() => this.save(), 30000).unref();
  }
  save() {
    if (!this.dirty || !this.file) return; this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ salt, days: this.days, recent: this.recent })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('보안 기록 저장 실패', e.message); }
  }
  // 사건 하나: 개인정보 없이 (IP 는 해시, 글 내용은 넣지 않는다 · detail 은 짧은 설명)
  note(kind, { ip = '', where = '', detail = '' } = {}) {
    const now = Date.now(), day = kstDay(now), h = ip ? ipHash(ip, day) : '';
    const D = (this.days[day] ||= { kinds: {}, ips: {} });
    D.kinds[kind] = (D.kinds[kind] || 0) + 1;
    if (h) { D.ips[h] = (D.ips[h] || 0) + 1; const ks = Object.keys(D.ips); if (ks.length > 3000) for (const k of ks.sort((a, b) => D.ips[a] - D.ips[b]).slice(0, 1000)) delete D.ips[k]; }
    // 같은 곳이 쏟아내면 최근 목록 · 서버 로그는 조금만 (세기는 다 센다)
    if (this.quiet.take(h || kind, 1, now)) {
      this.recent.push({ at: now, kind, ip: h, where: String(where).slice(0, 60), detail: String(detail).slice(0, 120) });
      if (this.recent.length > 300) this.recent.splice(0, this.recent.length - 300);
      if (process.env.NODE_ENV !== 'test') console.warn(`🛡️ ${kind} ${where} ${detail}`.slice(0, 200));
    }
    const keep = kstDay(now - 30 * 864e5); for (const d of Object.keys(this.days)) if (d < keep) delete this.days[d];
    this.dirty = true;
  }
  // 관리자 화면: 최근 days 일 종류별 건수 · 많이 걸린 IP 해시 · 최근 사건
  summary(days = 7) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const day = kstDay(Date.now() - i * 864e5), D = this.days[day];
      out.push({ day, kinds: D?.kinds || {}, total: Object.values(D?.kinds || {}).reduce((a, v) => a + v, 0), top: Object.entries(D?.ips || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, n]) => ({ ip, n })) });
    }
    return { days: out, recent: this.recent.slice(-80).reverse() };
  }
}
export const sec = new SecLog();

// ---------- HTTP 속도 제한 ----------
// 이름별 버킷 (넉넉하게: 학교 · PC방처럼 한 IP 에 여러 명이 있어도 괜찮게)
const LIMITS = {
  post: { rate: 3, burst: 150 },     // IP 하나: 모든 쓰기 API 합쳐 1초 3번 (한 번에 150번까지)
  get: { rate: 15, burst: 400 },     // IP 하나: 읽기 API
  user: { rate: 2, burst: 60 },      // 계정(또는 익명 id) 하나: 쓰기 API
  photo: { rate: 1 / 20, burst: 30 },  // 계정: 사진 올리기 (20초에 1장, 한 번에 30장)
  nick: { rate: 1 / 30, burst: 10 }, // 계정: 닉네임 · 캐릭터 이름 바꾸기
  start: { rate: 1, burst: 60 },     // IP: 출발표 받기
};
const buckets = Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, new Bucket(v)]));
export const TOO_FAST = '요청이 너무 많아요. 잠시 후 다시 해 주세요';
// 넘쳤으면 429 를 보내고 true. key 가 비면 검사하지 않는다
export function limited(name, key, { res, json, req, where } = {}) {
  if (!key) return false;
  if (buckets[name].take(String(key))) return false;
  sec.note('rate', { ip: req ? clientIp(req) : '', where: where || name, detail: name });
  if (res && json) json(res, 429, { error: TOO_FAST, retry: true });
  return true;
}
export const _buckets = buckets; // 시험용

// ---------- 글자 정리 ----------
// 보이지 않는 글자 · 방향 바꾸기 글자 (사칭 · 화면 속이기)
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ￰-￸]|\udb40[\udc00-\udfff]/g;
// 결합 문자(위아래로 쌓이는 장식 글자)는 한 글자에 2개까지만
const COMBINING = /(\p{M}{2})\p{M}+/gu;
export function cleanText(s, n, { lines = false } = {}) {
  let t = String(s ?? '');
  t = lines ? t.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '') : t.replace(/[\u0000-\u001f\u007f]/g, ' ');
  t = t.replace(INVISIBLE, (c) => (lines && c === '\n' ? c : '')).replace(COMBINING, '$1').normalize('NFC');
  return (lines ? t.replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n') : t.replace(/\s+/g, ' ')).trim().slice(0, n);
}
// 이름: 한 줄 · <> 없음 · 보이지 않는 글자 없음
export const cleanName = (s, n) => cleanText(String(s ?? '').replace(/[<>]/g, ''), n);
// 운영자 흉내: 비슷한 모양 글자 · 띄어쓰기 · 기호를 걷어 내고 본다
const FOLD = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', '$': 's', 'ⓐ': 'a', 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'і': 'i', 'ı': 'i' };
const RESERVED = /운영자|운영진|관리자|관리팀|젤리게임즈|젤리게임스|젤리겜즈|공식|gm|admin|administrator|moderator|operator|official|jellygames|staff|system|시스템|개발자|developer/;
export function impersonates(name) {
  const t = String(name || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}@$]/gu, '').replace(/[0-9@$ⓐаеорсхіı]/g, (c) => FOLD[c] || c);
  return RESERVED.test(t);
}

// ---------- JSON 오염 ----------
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// JSON.parse 와 같지만 __proto__ · constructor · prototype 키가 있으면 던진다
export function parseSafe(text) {
  return JSON.parse(text, (k, v) => { if (BAD_KEYS.has(k)) throw Object.assign(new Error('bad json'), { poison: true }); return v; });
}
// 객체에서 정한 키만 골라 옮긴다
export const pick = (o, keys) => { const out = {}; if (!o || typeof o !== 'object') return out; for (const k of keys) if (Object.hasOwn(o, k)) out[k] = o[k]; return out; };

// ---------- 정적 파일 경로 ----------
// 주소 → public 안의 진짜 파일 경로. 밖으로 나가거나(..) · 숨김 파일(.env · .git) · 역슬래시 · 널 문자 · 깨진 인코딩이면 null
export function publicPath(root, pathname) {
  let p; try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  const parts = p.split('/');
  if (parts.some((s) => s === '..' || (s.startsWith('.') && s !== '.well-known'))) return null;
  const file = path.normalize(path.join(root, p)), base = path.resolve(root);
  return file === base || file.startsWith(base + path.sep) ? file : null;
}

// ---------- 오류 문구 ----------
// 응답에 나가는 오류: 우리가 쓴 한국어 문구 · 약속된 코드만 그대로, 나머지(TypeError · 바깥 API 문구 · 경로)는 감춘다
const CODES = new Set(['login', 'not found', 'password', 'admin', 'needlogin']);
const KNOWN = { 'too large': '보낸 내용이 너무 커요', 'bad json': '요청 꼴이 이상해요' };
const SECRETISH = /(sk-[A-Za-z0-9_-]{8,}|serviceKey=[^&\s]+|[A-Za-z0-9+/]{32,}={0,2}|\/(?:app|Users|home|data|private|tmp)\/[^\s'"]+|[A-Z][A-Z0-9_]{2,}_(?:KEY|SECRET|TOKEN|PASSWORD)\b)/g;
export function publicError(msg) {
  const m = String(msg ?? '');
  if (CODES.has(m)) return m;
  if (KNOWN[m]) return KNOWN[m];
  if (!/[가-힣]/.test(m)) return '요청을 처리하지 못했어요. 잠시 후 다시 해 주세요';
  return m.replace(SECRETISH, '…').slice(0, 300);
}

// ---------- 웹소켓 메시지 꼴 (4-2) ----------
// 모든 게임 공통: JSON 객체 · t 는 짧은 이름 · 깊이 8 · 오염 키 없음 · 숫자는 유한하고 1e15 안 · 글자는 maxLen 안
const T_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
export function wsShapeOk(m, { maxNodes = 4000, maxStr = 4096 } = {}) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string' || !T_RE.test(m.t)) return false;
  let nodes = 0;
  const walk = (v, d) => {
    if (++nodes > maxNodes || d > 8) return false;
    if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= 1e15;
    if (typeof v === 'string') return v.length <= maxStr;
    if (v === null || typeof v === 'boolean') return true;
    if (Array.isArray(v)) { for (const x of v) if (!walk(x, d + 1)) return false; return true; }
    if (typeof v === 'object') { for (const k of Object.keys(v)) { if (BAD_KEYS.has(k) || k.length > 64 || !walk(v[k], d + 1)) return false; } return true; }
    return false;
  };
  return walk(m, 0);
}
// 방 게임 공통 메시지 (BaseRooms · 드림 러너 방): 종류마다 필드 형 · 길이
const str = (n) => (v) => v === undefined || v === null || (typeof v === 'string' && v.length <= n);
const num = (lo, hi) => (v) => v === undefined || (typeof v === 'number' && v >= lo && v <= hi) || (typeof v === 'string' && v.length <= 12 && Number(v) >= lo && Number(v) <= hi);
const arr = (n) => (v) => v === undefined || (Array.isArray(v) && v.length <= n);
export const ROOM_SPECS = {
  hello: { session: str(128), name: str(80), color: str(32), acc: arr(24) },
  create: { name: str(80) },
  join: { id: str(16) },
  chat: { s: str(600) },
  st: { p: arr(16) },
  shove: { to: num(0, 1e9), dir: num(-10, 10) },
};
export function specOk(m, specs) {
  const sp = specs?.[m.t]; if (!sp) return true;
  for (const [k, ok] of Object.entries(sp)) if (!ok(m[k])) return false;
  return true;
}

// ---------- 웹소켓 지킴이 (3-2 · 3-3 · 3-4 · 4-1 · 4-3) ----------
// 허용 출처: 같은 호스트 · 운영 주소 · 토스 미니앱 · 로컬 개발. Origin 이 없으면(브라우저가 아닌 것) 받되 기록한다
const PROD_ORIGINS = new Set(['https://jelly-city.fly.dev']);
export function originOk(origin, host) {
  if (!origin) return true;
  let u; try { u = new URL(origin); } catch { return false; }
  if (host && u.host === host) return true;
  if (PROD_ORIGINS.has(u.origin)) return true;
  if (u.protocol === 'https:' && /(^|\.)(toss\.im|tossmini\.com)$/.test(u.hostname)) return true;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return true;
  for (const o of String(process.env.WS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)) if (u.origin === o) return true;
  return false;
}
export class WsGuard {
  // perIp: IP 하나 동시 접속 · newPerMin: IP 하나 1분 새 접속 · rate/burst: 접속 하나 메시지 · idleMs: 조용하면 끊기 (0 = 안 끊음)
  constructor({ perIp = 80, newPerMin = 120, rate = 60, burst = 240, pingMs = 30000, firstMs = 60000 } = {}) {
    this.o = { perIp, rate, burst, pingMs, firstMs };
    this.live = new Map(); this.fresh = new Bucket({ rate: newPerMin / 60, burst: newPerMin });
    this.joins = new Bucket({ rate: 0.5, burst: 20 }); this.creates = new Bucket({ rate: 0.2, burst: 10 });
    this.socks = new Set();
    this.timer = setInterval(() => this.beat(), pingMs); this.timer.unref?.();
  }
  // 업그레이드 전에: { ok } 또는 { ok: false, status, why }
  admit(req, where) {
    const ip = clientIp(req), origin = req.headers.origin, host = String(req.headers.host || '');
    if (!originOk(origin, host)) { sec.note('origin', { ip, where, detail: String(origin).slice(0, 80) }); return { ok: false, status: 403, why: 'origin' }; }
    if ((this.live.get(ip) || 0) >= this.o.perIp) { sec.note('ws', { ip, where, detail: 'too many sockets' }); return { ok: false, status: 429, why: 'busy' }; }
    if (!this.fresh.take(ip)) { sec.note('ws', { ip, where, detail: 'too many new sockets' }); return { ok: false, status: 429, why: 'busy' }; }
    if (!origin) sec.note('origin', { ip, where, detail: 'no origin (not a browser)' });
    return { ok: true, ip };
  }
  // 접속 뒤: 메시지 속도 · 꼴 확인 (ws.emit 을 감싸서, 넘친 메시지는 게임 코드에 닿지 않는다) · 핑
  attach(ws, req, where, { specs = null, maxNodes, maxStr, idleMs = 0 } = {}) {
    const ip = clientIp(req), bucket = { t: this.o.burst, at: Date.now() };
    this.live.set(ip, (this.live.get(ip) || 0) + 1);
    const st = { ip, where, alive: true, last: Date.now(), first: false, born: Date.now(), drop: 0, bad: 0, win: Date.now(), idleMs };
    ws._guard = st; this.socks.add(ws);
    ws.on('pong', () => { st.alive = true; });
    ws.once('close', () => { this.socks.delete(ws); const n = (this.live.get(ip) || 1) - 1; if (n <= 0) this.live.delete(ip); else this.live.set(ip, n); });
    const emit = ws.emit.bind(ws);
    const tell = (text) => { try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'error', code: 'slow', text })); } catch { /* 끊김 */ } };
    ws.emit = (ev, ...a) => {
      if (ev !== 'message') return emit(ev, ...a);
      const now = Date.now(); st.last = now; st.first = true;
      if (now - st.win > 10000) { st.win = now; st.drop = 0; st.bad = 0; }
      bucket.t = Math.min(this.o.burst, bucket.t + ((now - bucket.at) / 1000) * this.o.rate); bucket.at = now;
      if (bucket.t < 1) { if (++st.drop === 1) sec.note('ws', { ip, where, detail: 'message flood' }); if (st.drop > 300) ws.close(1008, 'too fast'); return false; }
      bucket.t -= 1;
      let m; try { m = parseSafe(String(a[0])); } catch { m = null; }
      if (!m || !wsShapeOk(m, { maxNodes, maxStr }) || !specOk(m, specs)) { if (++st.bad === 1) sec.note('ws', { ip, where, detail: `bad message ${typeof m?.t === 'string' ? m.t.slice(0, 20) : ''}` }); if (st.bad > 50) ws.close(1008, 'bad messages'); return false; }
      // 초대 코드 맞히기 · 방 만들기 폭탄: IP 하나 기준
      if ((m.t === 'join' || m.t === 'quick') && !this.joins.take(ip, 1, now)) { sec.note('ws', { ip, where, detail: 'join flood (code guessing?)' }); tell('방 찾기를 너무 많이 했어요. 잠시 후 다시 해 주세요'); return false; }
      if (m.t === 'create' && !this.creates.take(ip, 1, now)) { sec.note('ws', { ip, where, detail: 'create flood' }); tell('방을 너무 많이 만들었어요. 잠시 후 다시 해 주세요'); return false; }
      return emit(ev, ...a);
    };
  }
  // 30초마다: 지난 핑에 답이 없으면 끊는다 · 첫 메시지를 60초 안에 안 보내면 끊는다 · (방 게임) 오래 조용하면 끊는다
  beat(now = Date.now()) {
    for (const ws of this.socks) {
      const st = ws._guard;
      if (!st.alive) { ws.terminate(); continue; }
      if (!st.first && now - st.born > this.o.firstMs) { ws.close(4001, 'hello timeout'); continue; }
      if (st.idleMs && now - st.last > st.idleMs) { ws.close(4002, 'idle'); continue; }
      st.alive = false; try { ws.ping(); } catch { /* 끊김 */ }
    }
  }
}
