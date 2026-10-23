// 젤리 게임 서버 (게임 여러 개가 한 서버 · 한 계정을 같이 쓴다)
//   - public/            정적 파일: / 게임 고르기 · /jelly-city/ · /dream-runner/ · /shared/ (여러 게임이 같이 쓰는 모듈)
//   - server/jelly-city/ 젤리시티 세계 (계정 · 로그인 세션도 여기 저장)
//   - server/dream-runner/ 드림 러너 (최고 기록 리더보드)
//   - /ws  WebSocket: 공유 세계 동기화
//   - /api/*  구글 로그인 · 캐릭터 목록/생성/삭제
//   - 환경변수: PORT, GAME_PASSWORD, GOOGLE_CLIENT_ID, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL, TIME_SPEED, DATA_DIR
import crypto from 'node:crypto';
import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { World, isAdmin } from './jelly-city/world.js';
import { llmEnabled, MODEL } from './jelly-city/llm.js';
import { GOOGLE_CLIENT_ID, DEV_LOGIN, verifyGoogle, readJson } from './auth.js';
import { DreamBoard, dreamApi } from './dream-runner/leaderboard.js';
import { DreamRooms } from './dream-runner/rooms.js';
import { RiderRooms } from './jelly-rider/rooms.js';
import { AttackRooms } from './jelly-attack/rooms.js';
import { BgRooms } from './jelly-attack/bg.js';
import { AppleRooms } from './jelly-apple/rooms.js';
import { WordRooms } from './jelly-word/rooms.js';
import { Dict } from './jelly-word/dict.js';
import { DrawRooms } from './jelly-draw/rooms.js';
import { TypeRooms } from './jelly-type/rooms.js';
import { normWord } from '../public/jelly-draw/js/prompts.js';
import { complete } from './jelly-city/llm.js';
import { Records } from './shared/records.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 8000;
const PASSWORD = process.env.GAME_PASSWORD || '';
const TICK = 1 / 20;
const SNAP_EVERY = 2; // 10Hz

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// 서버 이전용: 데이터 폴더에 import.json 이 있으면 그걸로 세계를 복원하고 지운다
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
try {
  const imp = path.join(DATA_DIR, 'import.json');
  if (fs.existsSync(imp)) { fs.renameSync(imp, path.join(DATA_DIR, 'world.json')); console.log('📦 import.json 으로 세계를 복원했어요'); }
} catch (e) { console.error('복원 실패', e); }
const world = new World({ dataDir: DATA_DIR });
const dreamBoard = new DreamBoard(DATA_DIR); // 드림 러너 리더보드
const dreamRooms = new DreamRooms((sid) => world.userOf(sid)); // 드림 러너 같이 달리기 방
// 젤리라이더: 방 · 트랙별 최고 기록 (짧을수록 좋다)
const RIDER_TRACKS = ['candy', 'cloud', 'neon', 'lava', 'sakura', 'synth', 'snow', 'deep'];
const riderRooms = new RiderRooms((sid) => world.userOf(sid));
const attackRooms = new AttackRooms((sid) => world.userOf(sid)); // 젤리어택 방 (봇은 서버가 움직인다)
const bgRooms = new BgRooms((sid) => world.userOf(sid)); // 젤리배그 (최대 30명)
// 젤리 사과게임: 방 · 시간별 최고 점수 (클수록 좋다)
const appleRooms = new AppleRooms((sid) => world.userOf(sid));
const appleRecords = new Records(DATA_DIR, 'jelly-apple', {
  boards: ['t60', 't120', 't180'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.score)),
  check: (b) => (Number.isInteger(Number(b.score)) && Number(b.score) >= 0 && Number(b.score) <= 170 ? null : '기록이 이상해요'),
});
const wordDict = new Dict(DATA_DIR); // 끝말잇기 사전 판정 (LLM 결과를 저장해 둔다)
const wordRooms = new WordRooms((sid) => world.userOf(sid), wordDict);
const drawRooms = new DrawRooms((sid) => world.userOf(sid)); // 젤리 그림릴레이 방
const guessHits = new Map();
// 젤리 타자연습: 경주 방 · 짧은 글 최고 타수(정확도 90% 이상) · 젤리비 최고 점수
const typeRooms = new TypeRooms((sid) => world.userOf(sid));
const typeRecords = new Records(DATA_DIR, 'jelly-type', {
  boards: ['kpm', 'rain'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.value)),
  check: (b) => { const v = Number(b.value); return Number.isFinite(v) && v >= 0 && v <= (b.b === 'kpm' ? 1600 : 5000000) ? null : '기록이 이상해요'; },
});
const riderRecords = new Records(DATA_DIR, 'jelly-rider', {
  boards: RIDER_TRACKS, better: (a, b) => a.value < b.value, value: (b) => Math.round(Number(b.time) * 1000) / 1000,
  check: (b) => (Number.isFinite(Number(b.time)) && Number(b.time) >= 40 && Number(b.time) <= 3600 ? null : '기록이 이상해요'),
});
// 옛 주소: REDIRECT_TO 가 있으면 모든 요청을 새 주소로 보낸다
const REDIRECT_TO = (process.env.REDIRECT_TO || '').replace(/\/$/, '');

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
// 로그인 시도 제한 (IP당 분당 20회)
const loginHits = new Map();
const limited = (req) => {
  const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '';
  const now = Date.now();
  const list = (loginHits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now); loginHits.set(ip, list);
  return list.length > 20;
};

async function api(req, res, url) {
  const sid = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (url.pathname === '/api/status') {
    return json(res, 200, { llm: llmEnabled, model: MODEL, password: !!PASSWORD, players: world.players.size, multiplayer: true, googleClientId: GOOGLE_CLIENT_ID, devLogin: DEV_LOGIN });
  }
  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (limited(req)) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
    const body = await readJson(req);
    if (PASSWORD && body.password !== PASSWORD) return json(res, 403, { error: 'password' });
    let info;
    if (body.credential) info = await verifyGoogle(body.credential);
    else if (DEV_LOGIN && typeof body.dev === 'string' && body.dev.trim()) info = { sub: `dev:${body.dev.trim().slice(0, 16)}`, email: '', name: body.dev.trim().slice(0, 16), picture: '' };
    else if (body.guest === true) {
      // 체험판: 구글 로그인 없이 바로 (이틀 동안 접속하지 않으면 캐릭터가 사라진다)
      if (world.guestCount() >= 300) return json(res, 503, { error: '체험판 자리가 꽉 찼어요. 구글로 로그인해 주세요' });
      info = { sub: `guest:${crypto.randomBytes(9).toString('hex')}`, email: '', name: `체험판 손님 ${Math.floor(1000 + Math.random() * 9000)}`, picture: '', guest: true };
    }
    else return json(res, 400, { error: '구글 로그인이 필요해요' });
    const session = world.login(info, Array.isArray(body.legacy) ? body.legacy : []);
    return json(res, 200, { session, user: world.publicUser(world.users[info.sub]), chars: world.charList(info.sub) });
  }
  // 드림 러너 (계정 · 로그인은 젤리시티와 같이 쓴다)
  if (url.pathname.startsWith('/api/dream/')) return dreamApi(req, res, url, world.userOf(sid), dreamBoard, json);
  if (url.pathname.startsWith('/api/rider/')) return riderRecords.api(req, res, url, world.userOf(sid), json, '/api/rider');
  // 혼자 그려보기: AI 젤리봇이 그림을 보고 맞힌다 (그림은 저장하지 않는다)
  if (url.pathname === '/api/draw/guess' && req.method === 'POST') {
    if (!llmEnabled) return json(res, 503, { error: 'AI 젤리봇이 쉬는 중이에요' });
    const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '', now = Date.now();
    const hits = (guessHits.get(ip) || []).filter((t) => now - t < 60000);
    if (hits.length >= 12) return json(res, 429, { error: '잠시 후 다시 해 주세요' });
    hits.push(now); guessHits.set(ip, hits);
    const b = await readJson(req, 400 * 1024);
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(b.img || '')) || String(b.img).length > 380 * 1024) return json(res, 400, { error: '그림이 이상해요' });
    try {
      const r = await complete([
        { role: 'system', content: '너는 그림 맞히기 게임을 하는 귀여운 AI 젤리봇이다. 사람이 마우스로 대충 그린 그림을 보고 무엇을 그렸는지 한국어 명사로 맞힌다. 가장 그럴듯한 것부터 3개.' },
        { role: 'user', content: [{ type: 'text', text: '이 그림은 무엇일까? 한국어 낱말 3개와, 그림을 보고 하는 짧고 다정한 한마디(20자 이내).' }, { type: 'image_url', image_url: { url: b.img, detail: 'low' } }] },
      ], { schema: { type: 'object', properties: { guesses: { type: 'array', items: { type: 'string' } }, comment: { type: 'string' } }, required: ['guesses', 'comment'], additionalProperties: false }, temperature: 0.4, max_tokens: 120 });
      const guesses = (r.guesses || []).map((x) => String(x).slice(0, 20)).slice(0, 3), ans = normWord(b.answer);
      const hit = ans ? guesses.findIndex((x) => { const n = normWord(x); return n && (n === ans || n.includes(ans) || ans.includes(n)); }) : -1;
      return json(res, 200, { guesses, comment: String(r.comment || '').slice(0, 40), hit });
    } catch (e) { console.warn('그림 맞히기 실패', e.message); return json(res, 502, { error: 'AI 젤리봇이 그림을 못 봤어요' }); }
  }
  if (url.pathname.startsWith('/api/type/')) return typeRecords.api(req, res, url, world.userOf(sid), json, '/api/type');
  if (url.pathname.startsWith('/api/apple/')) return appleRecords.api(req, res, url, world.userOf(sid), json, '/api/apple');
  const who = world.userOf(sid);
  if (!who) return json(res, 401, { error: 'login' });
  if (url.pathname === '/api/me') return json(res, 200, { user: world.publicUser(who.user), chars: world.charList(who.sub), admin: isAdmin(who.user) });
  // 닉네임 정하기 · 바꾸기 (구글 실명 대신 모든 게임에서 쓴다)
  if (url.pathname === '/api/nick' && req.method === 'POST') { const b = await readJson(req); try { return json(res, 200, { user: world.setNick(who.sub, b.nick) }); } catch (e) { return json(res, 400, { error: e.message }); } }
  const char = url.searchParams.get('char') || '';
  try {
    // 사진
    if (url.pathname === '/api/photo' && req.method === 'POST') { const b = await readJson(req, 700 * 1024); return json(res, 200, { id: world.savePhoto(who.sub, b.char, b.data) }); }
    if (url.pathname === '/api/photos') { if (!world.ownsChar(who.sub, char)) return json(res, 403, { error: '내 캐릭터가 아니에요' }); return json(res, 200, { list: world.myPhotos(char) }); }
    if (url.pathname.startsWith('/api/photo/') && req.method === 'DELETE') {
      const id = url.pathname.slice('/api/photo/'.length);
      if (!world.ownsChar(who.sub, char) || world.photos[id]?.owner !== char) return json(res, 403, { error: '내 사진이 아니에요' });
      world.deletePhoto(id); return json(res, 200, { ok: true });
    }
    // 인스타그램
    if (url.pathname === '/api/insta' && req.method === 'GET') return json(res, 200, { feed: world.instaFeed(char, url.searchParams.get('mode') === 'following' ? 'following' : 'all') });
    if (url.pathname === '/api/insta' && req.method === 'POST') { const b = await readJson(req); world.postInsta(who.sub, b.char, b.id, b.caption); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/insta/like' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { likes: world.likeInsta(who.sub, b.char, b.id) }); }
    if (url.pathname === '/api/insta/comments') return json(res, 200, { comments: world.instaComments(char, url.searchParams.get('id')) });
    if (url.pathname === '/api/insta/comment' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { comments: world.commentInsta(who.sub, b.char, b.id, b.text) }); }
    if (url.pathname === '/api/insta/comment/del' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { comments: world.deleteComment(who.sub, b.char, b.id, b.cid) }); }
    if (url.pathname === '/api/insta/follow' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, world.follow(who.sub, b.char, b.target)); }
    if (url.pathname === '/api/insta/profile') return json(res, 200, world.instaProfile(char, url.searchParams.get('user')));
    if (url.pathname === '/api/insta/follows') return json(res, 200, { list: world.followList(url.searchParams.get('user'), url.searchParams.get('which')) });
    // 인스타 DM
    if (url.pathname === '/api/dm' && req.method === 'GET') { if (!world.ownsChar(who.sub, char)) return json(res, 403, { error: '내 캐릭터가 아니에요' }); return json(res, 200, { threads: world.dmThreads(char) }); }
    if (url.pathname === '/api/dm/thread') return json(res, 200, world.dmThread(who.sub, char, url.searchParams.get('with')));
    if (url.pathname === '/api/dm' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, world.sendDm(who.sub, b.char, b.to, b.text)); }
    // 건의함
    if (url.pathname === '/api/feedback' && req.method === 'POST') { const b = await readJson(req); world.addFeedback(who, b.char, b.text); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/feedback' && req.method === 'GET') {
      if (!isAdmin(who.user)) return json(res, 403, { error: '관리자만 볼 수 있어요' });
      return json(res, 200, { list: [...world.feedback].reverse() });
    }
    if (url.pathname.startsWith('/api/feedback/') && req.method === 'POST') {
      if (!isAdmin(who.user)) return json(res, 403, { error: '관리자만' });
      const f = world.feedback.find((x) => x.id === url.pathname.split('/')[3]);
      if (f) { f.done = !f.done; world.dirty = true; }
      return json(res, 200, { ok: true });
    }
  } catch (e) { return json(res, 400, { error: e.message }); }
  if (url.pathname === '/api/logout' && req.method === 'POST') { world.logout(sid); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/chars' && req.method === 'POST') {
    const body = await readJson(req);
    try { return json(res, 200, { char: world.createChar(who.sub, body), chars: world.charList(who.sub) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (/^\/api\/chars\/[0-9a-f]+\/look$/.test(url.pathname) && req.method === 'POST') {
    const body = await readJson(req);
    try { world.restyleChar(who.sub, url.pathname.split('/')[3], body); return json(res, 200, { chars: world.charList(who.sub) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (/^\/api\/chars\/[0-9a-f]+\/name$/.test(url.pathname) && req.method === 'POST') {
    const body = await readJson(req);
    try { world.renameChar(who.sub, url.pathname.split('/')[3], body.name); return json(res, 200, { chars: world.charList(who.sub) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/api/chars/') && req.method === 'DELETE') {
    try { world.deleteChar(who.sub, url.pathname.slice('/api/chars/'.length)); return json(res, 200, { chars: world.charList(who.sub) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  return json(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (REDIRECT_TO && url.pathname !== '/healthz') { res.writeHead(301, { Location: REDIRECT_TO + req.url, 'Cache-Control': 'no-store' }); res.end(); return; }
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.warn('API 오류:', e.message); if (!res.headersSent) json(res, 400, { error: e.message }); });
    return;
  }
  if (url.pathname === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  // 사진 파일
  const pm = /^\/photos\/([0-9a-f]{20})\.jpg$/.exec(url.pathname);
  if (pm) {
    fs.readFile(path.join(world.photoDir, `${pm[1]}.jpg`), (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
    });
    return;
  }
  // 옛 주소: 젤리시티가 / 에 있던 시절의 관리자 페이지
  if (url.pathname === '/admin.html') { res.writeHead(301, { Location: '/jelly-city/admin.html' }); res.end(); return; }
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    // /jelly-city → /jelly-city/ (게임 안의 상대 경로가 맞게)
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
    file = path.join(file, 'index.html');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// WS_COMPRESS=1 이면 메시지를 압축해서 보낸다 (트래픽 ↓, CPU ↑)
const COMPRESS = process.env.WS_COMPRESS === '1';
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: COMPRESS ? { zlibDeflateOptions: { level: 3 }, threshold: 512 } : false });
// 드림 러너 방(최대 12명): 따로 연결
const dreamWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
dreamWss.on('connection', (ws) => dreamRooms.connect(ws));
const riderWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
riderWss.on('connection', (ws) => riderRooms.connect(ws));
const attackWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
attackWss.on('connection', (ws) => attackRooms.connect(ws));
const bgWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
bgWss.on('connection', (ws) => bgRooms.connect(ws));
const partyWss = (rooms) => { const w = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false }); w.on('connection', (ws) => rooms.connect(ws)); return w; };
const appleWss = partyWss(appleRooms), wordWss = partyWss(wordRooms), typeWss = partyWss(typeRooms);
const drawWss = new WebSocketServer({ noServer: true, maxPayload: 160 * 1024, perMessageDeflate: { threshold: 2048 } }); // 그림은 커서 더 크게 · 압축
drawWss.on('connection', (ws) => drawRooms.connect(ws));
// 주소로 나눠 받는다: /ws = 젤리시티 · /dream-ws = 드림 러너
server.on('upgrade', (req, socket, head) => {
  const p = new URL(req.url, 'http://x').pathname;
  const target = p === '/ws' ? wss : p === '/dream-ws' ? dreamWss : p === '/rider-ws' ? riderWss : p === '/attack-ws' ? attackWss : p === '/bg-ws' ? bgWss : p === '/apple-ws' ? appleWss : p === '/word-ws' ? wordWss : p === '/draw-ws' ? drawWss : p === '/type-ws' ? typeWss : null;
  if (!target) { socket.destroy(); return; }
  target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
});
wss.on('connection', (ws) => {
  if (REDIRECT_TO) { ws.close(4000, 'moved'); return; } // 이사 간 서버는 접속을 받지 않는다
  let player = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!player) {
      // 로그인 전 첫 화면: 도시를 구경만 하는 관전자
      if (msg.t === 'spectate') { world.addSpectator(ws); return; }
      if (msg.t !== 'hello') return;
      world.spectators.delete(ws);
      player = world.join(ws, msg);
      if (!player) {
        ws.send(JSON.stringify({ t: 'error', code: 'login', message: '다시 로그인해 주세요' }));
        world.spectators.add(ws); // 계속 도시 구경
      }
      return;
    }
    try { world.handle(player, msg); } catch (e) { console.error('메시지 처리 오류:', e); }
  });
  ws.on('close', () => { world.spectators.delete(ws); if (player && !player.kicked) world.leave(player); });
  ws.on('error', () => {});
});

// 시뮬레이션 루프
let n = 0, last = performance.now(), acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.5, (now - last) / 1000);
  last = now;
  while (acc >= TICK) {
    acc -= TICK;
    try { world.tick(TICK); } catch (e) { console.error('틱 오류:', e); }
    if (++n % SNAP_EVERY === 0 && (world.players.size || world.spectators.size)) {
      const s = JSON.stringify(world.snapshot());
      for (const p of world.players.values()) if (p.ws.readyState === 1) p.ws.send(s);
      for (const ws of world.spectators) if (ws.readyState === 1) ws.send(s);
    }
  }
}, 25);

// 주기적 저장
setInterval(() => { if (world.dirty) { world.save(); world.dirty = false; } }, 30000);
// 배포로 서버가 재시작될 때: 접속자에게 알리고 세계를 저장한 뒤 종료 (브라우저는 자동 재접속)
let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    world.broadcast({ t: 'sys', text: '🔧 서버가 업데이트돼요! 잠시 후 자동으로 다시 접속해요' });
    try { world.save(); console.log('💾 세계를 저장했어요'); } catch (e) { console.error('저장 실패', e); }
    dreamBoard.save(); riderRecords.save(); appleRecords.save(); wordDict.save(); typeRecords.save();
    setTimeout(() => process.exit(0), 500);
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🐻 젤리시티 서버: http://localhost:${PORT}`);
  console.log(`   로그인: ${GOOGLE_CLIENT_ID ? '구글 로그인 필수' : '⚠️ GOOGLE_CLIENT_ID 없음 → 개발용 이름 로그인'}`);
  console.log(`   LLM: ${llmEnabled ? `${MODEL} 사용` : '키 없음 (기본 대사)'} · 비밀번호: ${PASSWORD ? '설정됨' : '없음'}`);
});
