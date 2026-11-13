// 토스 미니앱(앱인토스) 계정: 웹 계정 · 기록과 섞이지 않게 따로 둔다 (아이디는 언제나 'toss:' 로 시작)
//   로그인: 미니앱이 토스 SDK(appLogin)로 받은 인가 코드를 보내면, 서버가 토스 파트너 API(mTLS)로 사용자 키를 받아 온다
//   세션: 서버가 서명한 토큰 (토스 계정 파일만 있으면 되고, 젤리시티 세계와는 상관없다)
//   기기 계정: 토스 로그인 없이도 기기마다 임시 아이디(toss:d_…)로 기록 · 별 · 치장이 남는다 (사업자 등록 전에도 낼 수 있게)
//     나중에 토스 로그인을 하면 그 토스 계정을 이 기기 계정에 잇는다: 아이디가 그대로라 기록을 옮길 필요가 없다
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { readJson } from './auth.js';
import { safeEq, cleanName, impersonates, IMPERSONATE_MSG } from './shared/guard.js';

// 토스 파트너 API: 콘솔에서 받은 mTLS 인증서 · 키 (PEM 글자 그대로 또는 base64). 없으면 토스 로그인은 '준비 중'
//   주소 · 응답 모양은 앱인토스 개발자센터 '토스 로그인' 문서로 확인해서 맞춘다
const API = (process.env.TOSS_API_BASE || 'https://apps-in-toss-api.toss.im').replace(/\/$/, '');
const TOKEN_PATH = process.env.TOSS_TOKEN_PATH || '/api-partner/v1/apps-in-toss/user/oauth2/generate-token';
const ME_PATH = process.env.TOSS_ME_PATH || '/api-partner/v1/apps-in-toss/user/oauth2/login-me';
const pem = (v) => (!v ? null : v.includes('BEGIN') ? v : Buffer.from(v, 'base64').toString('utf8'));
const CERT = pem(process.env.TOSS_MTLS_CERT), KEY = pem(process.env.TOSS_MTLS_KEY);
// 토스 로그인은 콘솔에서 열려야 쓸 수 있다 (사업자 등록 뒤). 인증서가 있어도 TOSS_LOGIN=1 을 넣어야 '토스 계정에 잇기' 버튼이 뜬다
export const tossReady = !!(CERT && KEY) && process.env.TOSS_LOGIN === '1';

function call(method, p, body, token) {
  return new Promise((ok, bad) => {
    const u = new URL(API + p), data = body ? JSON.stringify(body) : null;
    const req = https.request({ method, hostname: u.hostname, path: u.pathname + u.search, cert: CERT, key: KEY, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }, timeout: 8000 }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { try { const j = JSON.parse(s || '{}'); if (res.statusCode >= 400 || j.resultType === 'FAIL') bad(new Error(j.error?.reason || j.message || `토스 ${res.statusCode}`)); else ok(j.success ?? j); } catch { bad(new Error('토스 응답을 읽지 못했어요')); } });
    });
    req.on('error', bad); req.on('timeout', () => req.destroy(new Error('토스 응답이 늦어요')));
    if (data) req.write(data); req.end();
  });
}
// 인가 코드 → 사용자 키
async function exchange(code, referrer) {
  const t = await call('POST', TOKEN_PATH, { authorizationCode: code, referrer });
  const me = await call('GET', ME_PATH, null, t.accessToken);
  if (!me.userKey) throw new Error('토스 사용자 정보를 받지 못했어요');
  return String(me.userKey);
}

const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
export class TossAccounts {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'toss-users.json'); this.users = {}; this.links = {}; this.secret = crypto.randomBytes(24).toString('hex'); this.made = new Map();
    try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); this.users = d.users || {}; this.links = d.links || {}; this.secret = d.secret || this.secret; } catch { /* 처음 */ }
    this.dirty = !fs.existsSync(this.file); setInterval(() => this.save(), 20000).unref();
  }
  save() { if (!this.dirty) return; this.dirty = false; try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ users: this.users, links: this.links, secret: this.secret })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('토스 계정 저장 실패', e.message); } }
  sign(sub) { const p = `${Buffer.from(sub).toString('base64url')}.${Date.now()}`; return `${p}.${crypto.createHmac('sha256', this.secret).update(p).digest('base64url').slice(0, 32)}`; }
  read(tok) { const s = String(tok || ''), i = s.lastIndexOf('.'); if (i < 0) return null; const p = s.slice(0, i); if (s.length > 512 || !safeEq(crypto.createHmac('sha256', this.secret).update(p).digest('base64url').slice(0, 32), s.slice(i + 1))) return null; const sub = Buffer.from(p.split('.')[0], 'base64url').toString(); return this.users[sub] ? sub : null; }
  // 다른 API 가 쓰는 모양 { sub, user } (드림 러너 · 치장 API 를 그대로 쓴다)
  userOf(tok) { const sub = this.read(tok); if (!sub) return null; const u = this.users[sub]; return { sub, user: { nick: u.nick || '', name: u.nick || '토스 곰돌이', toss: true } }; }
  nickOf(sub) { return this.users[sub]?.nick || null; }
  pub(sub) { const u = this.users[sub]; return { name: u.nick || '토스 곰돌이', nick: u.nick || '', needNick: !u.nick, toss: true, device: !!u.device && !u.key }; }
  // 토스 로그인: 이미 이은 계정 → 예전 토스 계정 → 지금 쓰던 기기 계정(아직 안 이었으면 잇는다) → 새 계정
  login(key, fromSub = null) {
    let sub = this.links[key] || (this.users[`toss:${key}`] ? `toss:${key}` : null);
    const from = fromSub && this.users[fromSub];
    if (!sub && from?.device && !from.key) { sub = fromSub; from.key = key; this.links[key] = sub; }
    sub ||= `toss:${key}`;
    const u = (this.users[sub] ||= { nick: '', created: Date.now() }); u.last = Date.now(); this.dirty = true; return sub;
  }
  // 기기 계정 만들기 (한 곳에서 하루에 너무 많이는 못 만든다)
  device(ip) {
    const day = `${ip}:${Math.floor(Date.now() / 864e5)}`, n = this.made.get(day) || 0;
    if (n >= 30) throw new Error('잠시 뒤 다시 시도해 주세요');
    this.made.set(day, n + 1); if (this.made.size > 50000) this.made.clear();
    const sub = `toss:d_${crypto.randomBytes(9).toString('hex')}`;
    this.users[sub] = { nick: '', created: Date.now(), last: Date.now(), device: true }; this.dirty = true; return sub;
  }
  touch(sub) { const u = this.users[sub]; if (u && Date.now() - (u.last || 0) > 36e5) { u.last = Date.now(); this.dirty = true; } }
  setNick(sub, nick) {
    const n = cleanName(nick, 40);
    if ([...n].length < 2 || [...n].length > 12) throw new Error('닉네임은 2~12글자로 정해 주세요');
    if (impersonates(n)) throw new Error(IMPERSONATE_MSG);
    this.users[sub].nick = n; this.dirty = true;
  }
}

// 미니앱은 토스 쪽 주소에서 열리니, 토스 API 는 어느 곳에서 불러도 된다 (쿠키 없이 Authorization 토큰만 쓴다)
export function cors(res) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }

// /api/toss/login · /api/toss/me · /api/toss/nick. 처리했으면 true
export async function tossAccountApi(req, res, url, toss, json, { cos, devLogin }) {
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (url.pathname === '/api/toss/login' && req.method === 'POST') {
    const b = await readJson(req);
    if (b.device === true) { // 토스 로그인 없이: 이 기기 계정
      try { const sub = toss.device(String(req.headers['fly-client-ip'] || req.socket.remoteAddress || '')); return json(res, 200, { session: toss.sign(sub), user: toss.pub(sub), cos: cos.pub(sub) }), true; } catch (e) { return json(res, 429, { error: e.message }), true; }
    }
    let key;
    try {
      if (devLogin && typeof b.dev === 'string' && clean(b.dev)) key = `dev-${clean(b.dev).slice(0, 16)}`; // 개발 서버: 토스 없이 시험
      else if (!tossReady) return json(res, 503, { error: '토스 로그인을 준비하고 있어요' }), true;
      else if (typeof b.authorizationCode === 'string') key = await exchange(b.authorizationCode, String(b.referrer || 'DEFAULT'));
      else return json(res, 400, { error: '토스 로그인이 필요해요' }), true;
    } catch (e) { return json(res, 502, { error: e.message }), true; }
    const sub = toss.login(key, toss.read(tok)); // 기기 계정으로 달리던 중이면 그 계정에 토스를 잇는다
    return json(res, 200, { session: toss.sign(sub), user: toss.pub(sub), cos: cos.pub(sub) }), true;
  }
  if (url.pathname === '/api/toss/status') return json(res, 200, { devLogin: !!devLogin, toss: tossReady }), true;
  if (url.pathname === '/api/toss/me') { const sub = toss.read(tok); if (!sub) return json(res, 401, { error: 'login' }), true; toss.touch(sub); return json(res, 200, { user: toss.pub(sub), cos: cos.pub(sub) }), true; }
  if (url.pathname === '/api/toss/nick' && req.method === 'POST') {
    const sub = toss.read(tok); if (!sub) return json(res, 401, { error: 'login' }), true;
    const b = await readJson(req);
    try { toss.setNick(sub, b.nick); return json(res, 200, { user: toss.pub(sub) }), true; } catch (e) { return json(res, 400, { error: e.message }), true; }
  }
  return false;
}
