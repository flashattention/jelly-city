// 젤리 게임 서버 (게임 여러 개가 한 서버 · 한 계정을 같이 쓴다)
//   - public/            정적 파일: / 게임 고르기 · /jelly-city/ · /dream-runner/ · /shared/ (여러 게임이 같이 쓰는 모듈)
//   - server/jelly-city/ 젤리시티 세계 (계정 · 로그인 세션도 여기 저장)
//   - server/dream-runner/ 드림 러너 (최고 기록 리더보드)
//   - /ws  WebSocket: 공유 세계 동기화
//   - /api/*  구글 로그인 · 캐릭터 목록/생성/삭제
//   - 환경변수: PORT, GAME_PASSWORD, GOOGLE_CLIENT_ID, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL, TIME_SPEED, DATA_DIR
import zlib from 'zlib';
import crypto from 'node:crypto';
import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { World, isAdmin } from './jelly-city/world.js';
import { SwMetrics, swMetricsApi } from './seoul-walk/metrics.js';
import { llmEnabled, MODEL } from './jelly-city/llm.js';
import { GOOGLE_CLIENT_ID, DEV_LOGIN, verifyGoogle, readJson } from './auth.js';
import { DreamBoard, dreamApi } from './dream-runner/leaderboard.js';
import { TossAccounts, tossAccountApi, cors as tossCors } from './toss.js';
import { PlayTime, playtimeApi } from './playtime.js';
import { seoulApi } from './seoul.js';
import { Board, boardApi } from './board.js';
import { DreamRooms } from './dream-runner/rooms.js';
import { DriftRooms } from './jelly-drift/rooms.js';
import { TacticalRooms } from './jelly-tactical/rooms.js';
import { DropRooms } from './jelly-drop/rooms.js';
import { GuardRooms } from './jelly-guard/rooms.js';
import { TenRooms } from './jelly-ten/rooms.js';
import { SurvRooms } from './jelly-survivor/rooms.js';
import { SketchRooms } from './jelly-sketch/rooms.js';
import { WordRooms } from './jelly-word/rooms.js';
import { Dict } from './jelly-word/dict.js';
import { DrawRooms } from './jelly-draw/rooms.js';
import { TypeRooms } from './jelly-type/rooms.js';
import { RumbleRooms } from './jelly-rumble/rooms.js';
import { MergeRooms } from './jelly-merge/rooms.js';
import { CourtRooms } from './jelly-court/rooms.js';
import { DingRooms } from './jelly-ding/rooms.js';
import { SlideRooms } from './jelly-slide/rooms.js';
import { HideRooms } from './jelly-hide/rooms.js';
import { ArenaRooms } from './jelly-arena/rooms.js';
import { ArcadeRooms } from './jelly-arcade/rooms.js';
import { normWord } from '../public/jelly-draw/js/prompts.js';
import { complete } from './jelly-city/llm.js';
import { Records } from './shared/records.js';
import { Cosmetics, cosApi, setNames } from './cosmetics.js';
import { sec, clientIp, limited as rateLimited, publicPath, publicError, DayCount } from './shared/guard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
// 이름이 바뀐 게임들: 옛 주소 → 새 주소 (이미 나간 초대 링크 · 즐겨찾기가 깨지지 않게)
const RENAMED = [
  ['/jelly-attack/bg', '/jelly-drop'], ['/jelly-bg', '/jelly-drop'], ['/jelly-watch', '/jelly-guard'], ['/jelly-rider', '/jelly-drift'],
  ['/jelly-attack', '/jelly-tactical'], ['/jelly-guys', '/jelly-rumble'], ['/jelly-bang', '/jelly-court'], ['/jelly-apple', '/jelly-ten'],
];
const OLD_WS = { '/bg-ws': '/drop-ws', '/watch-ws': '/guard-ws', '/rider-ws': '/drift-ws', '/attack-ws': '/tactical-ws', '/guys-ws': '/rumble-ws', '/bang-ws': '/court-ws', '/apple-ws': '/ten-ws' };
const PORT = Number(process.env.PORT) || 8000;
const PASSWORD = process.env.GAME_PASSWORD || '';
const TICK = 1 / 20;
const SNAP_EVERY = 2; // 10Hz

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// 서버 이전용: 데이터 폴더에 import.json 이 있으면 그걸로 세계를 복원하고 지운다
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
try {
  const imp = path.join(DATA_DIR, 'import.json');
  if (fs.existsSync(imp)) { fs.renameSync(imp, path.join(DATA_DIR, 'world.json')); console.log('📦 import.json 으로 세계를 복원했어요'); }
} catch (e) { console.error('복원 실패', e); }
sec.init(DATA_DIR); // 보안 사건 기록
const world = new World({ dataDir: DATA_DIR });
const dreamBoard = new DreamBoard(DATA_DIR); // 드림 러너 리더보드
const swMetrics = new SwMetrics(DATA_DIR); // 젤리 서울 러너 이용 지표 (익명)
const GAME_IDS = fs.readdirSync(path.join(ROOT, 'public')).filter((d) => /^jelly-[a-z]+$/.test(d) && d !== 'jelly-city');
const playtime = new PlayTime(DATA_DIR); // 게임마다 플레이 시간 (메인 화면 카드 · 인기순)
const cosmetics = new Cosmetics(DATA_DIR); cosmetics.dream = dreamBoard; // 치장 · 업적 (모든 게임 공용)
// 토스 미니앱: 계정 · 드림 러너 기록을 웹과 따로 (같은 서버 · 같은 게임 코드, 파일만 다르다)
const toss = new TossAccounts(DATA_DIR);
const dreamToss = new DreamBoard(DATA_DIR, 'dream-runner-toss', { pool: dreamBoard.pool, ads: true }); cosmetics.dreamToss = dreamToss;
setNames({ nick: (sub) => (sub.startsWith('toss:') ? toss.nickOf(sub) : world.users[sub]?.nick) || null, chars: (sub) => (world.users[sub]?.chars || []).map((token) => ({ token, name: world.accounts[token]?.name })) }); // 순위표에는 지금 닉네임 · 캐릭터 이름
const board = new Board(DATA_DIR); // 메인 화면 게시판
const dreamRooms = new DreamRooms((sid) => world.userOf(sid), DATA_DIR); // 드림 러너 같이 달리기 방
// 젤리드리프트: 방 · 트랙별 최고 기록 (짧을수록 좋다)
const RIDER_TRACKS = ['candy', 'cloud', 'neon', 'lava', 'sakura', 'synth', 'snow', 'deep', 'hairpin', 'choco', 'crystal', 'steam', 'park', 'rainbow', 'moon', 'chess'];
const driftRooms = new DriftRooms((sid) => world.userOf(sid));
const tacticalRooms = new TacticalRooms((sid) => world.userOf(sid)); // 젤리택티컬 방 (봇은 서버가 움직인다)
const dropRooms = new DropRooms((sid) => world.userOf(sid)); // 젤리드롭 (최대 30명)
const guardRooms = new GuardRooms((sid) => world.userOf(sid)); // 젤리수호대 (6 대 6 · 봇은 서버가)
// 젤리텐: 방 · 시간별 최고 점수 (클수록 좋다)
const tenRooms = new TenRooms((sid) => world.userOf(sid));
// 기록 파일도 새 이름으로 (한 번만 · 새 파일이 이미 있으면 그대로)
for (const [o, n] of [['jelly-apple', 'jelly-ten'], ['jelly-rider', 'jelly-drift']]) {
  const a = path.join(DATA_DIR, `${o}.json`), b = path.join(DATA_DIR, `${n}.json`);
  try { if (fs.existsSync(a) && !fs.existsSync(b)) { fs.renameSync(a, b); console.log(`📦 기록 파일 ${o}.json → ${n}.json`); } } catch (e) { console.warn('기록 파일 옮기기 실패', o, e.message); }
}
const tenRecords = new Records(DATA_DIR, 'jelly-ten', {
  boards: ['t60', 't120', 't180'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.score)),
  check: (b) => (Number.isInteger(Number(b.score)) && Number(b.score) >= 0 && Number(b.score) <= 170 ? null : '기록이 이상해요'),
});
// 젤리 서바이버: 협동 방 · 혼자 하기 최고 점수 (보통 · 어려움)
const survRooms = new SurvRooms((sid) => world.userOf(sid));
const survRecords = new Records(DATA_DIR, 'jelly-survivor', {
  boards: ['normal', 'hard', 'endless'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.score)), // endless = 버틴 시간(초)
  check: (b) => (Number.isInteger(Number(b.score)) && Number(b.score) >= 0 && Number(b.score) <= 60000 ? null : '기록이 이상해요'),
});
const wordDict = new Dict(DATA_DIR); // 끝말잇기 사전 판정 (LLM 결과를 저장해 둔다)
const wordRooms = new WordRooms((sid) => world.userOf(sid), wordDict);
const drawRooms = new DrawRooms((sid) => world.userOf(sid)); // 젤리 그림릴레이 방
const sketchRooms = new SketchRooms((sid) => world.userOf(sid)); // 젤리 스케치퀴즈 방 (최대 12명)
const guessHits = new Map();
// 젤리 타자연습: 경주 방 · 짧은 글 최고 타수(정확도 90% 이상) · 젤리비 최고 점수
const typeRooms = new TypeRooms((sid) => world.userOf(sid));
const rumbleRooms = new RumbleRooms((sid) => world.userOf(sid)); // 젤리대소동 (파티 장애물 레이스 · 봇은 서버가)
const mergeRooms = new MergeRooms((sid) => world.userOf(sid)); // 젤리 머지
const courtRooms = new CourtRooms((sid) => world.userOf(sid)); // 젤리궁정 (숨은 역할 카드 결투)
const dingRooms = new DingRooms((sid) => world.userOf(sid)); // 젤리 땡 (종 치기)
const slideRooms = new SlideRooms((sid) => world.userOf(sid)); // 젤리 슬라이드 (밀어서 합치기)
const hideRooms = new HideRooms((sid) => world.userOf(sid)); // 젤리 숨바꼭질 (몸에 색칠해 숨기)
const arenaRooms = new ArenaRooms((sid) => world.userOf(sid)); // 젤리 아레나 (5 대 5 라인전)
// 젤리 아케이드: 방 경기가 끝날 때 서버가 승리 수 · 톡 수를 더한다 (화면에서 보내는 기록은 받지 않는다)
const arcadeRecords = new Records(DATA_DIR, 'jelly-arcade', { boards: ['wins', 'pops'], better: (a, b) => a.value > b.value, value: () => 0, check: () => '같이 하기 방 경기로만 남아요' });
const arcadeRooms = new ArcadeRooms((sid) => world.userOf(sid), arcadeRecords); // 젤리 아케이드 (격자 젤리 폭탄 대전)
const typeRecords = new Records(DATA_DIR, 'jelly-type', {
  boards: ['kpm', 'rain'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.value)),
  check: (b) => { const v = Number(b.value); return Number.isFinite(v) && v >= 0 && v <= (b.b === 'kpm' ? 1600 : 5000000) ? null : '기록이 이상해요'; },
});
// 젤리 머지 · 젤리 슬라이드: 혼자 하기 최고 점수 (통 · 판 크기마다)
const mergeRecords = new Records(DATA_DIR, 'jelly-merge', {
  boards: ['box', 'bowl', 'cup'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.value)),
  check: (b) => { const v = Number(b.value); return Number.isFinite(v) && v >= 0 && v <= 500000 ? null : '기록이 이상해요'; },
});
const slideRecords = new Records(DATA_DIR, 'jelly-slide', {
  boards: ['s4', 's5'], better: (a, b) => a.value > b.value, value: (b) => Math.round(Number(b.value)),
  check: (b) => { const v = Number(b.value); return Number.isFinite(v) && v >= 0 && v <= 5000000 ? null : '기록이 이상해요'; },
});
const driftRecords = new Records(DATA_DIR, 'jelly-drift', {
  boards: RIDER_TRACKS, better: (a, b) => a.value < b.value, value: (b) => Math.round(Number(b.time) * 1000) / 1000,
  check: (b) => (Number.isFinite(Number(b.time)) && Number(b.time) >= 25 && Number(b.time) <= 3600 ? null : '기록이 이상해요'),
});
// 업적: 기록판 · 방 경기 결과를 치장 쪽에 잇는다
Object.assign(cosmetics.records, { 'jelly-ten': tenRecords, 'jelly-survivor': survRecords, 'jelly-type': typeRecords, 'jelly-merge': mergeRecords, 'jelly-slide': slideRecords, 'jelly-drift': driftRecords });
for (const [k, R] of Object.entries({ 'jelly-drift': driftRooms, 'jelly-tactical': tacticalRooms, 'jelly-drop': dropRooms, 'jelly-guard': guardRooms, 'jelly-ten': tenRooms, 'jelly-survivor': survRooms, 'jelly-word': wordRooms, 'jelly-draw': drawRooms, 'jelly-sketch': sketchRooms, 'jelly-type': typeRooms, 'jelly-rumble': rumbleRooms, 'jelly-merge': mergeRooms, 'jelly-court': courtRooms, 'jelly-ding': dingRooms, 'jelly-slide': slideRooms, 'jelly-hide': hideRooms, 'jelly-arena': arenaRooms, 'jelly-arcade': arcadeRooms })) R.gameKey = k;
// 옛 주소: REDIRECT_TO 가 있으면 모든 요청을 새 주소로 보낸다
const REDIRECT_TO = (process.env.REDIRECT_TO || '').replace(/\/$/, '');

// 모든 API 응답이 여기를 지난다: 오류 문구는 publicError 로 거른다 (내부 오류 · 경로 · 키 이름이 나가지 않게)
const json = (res, code, obj) => {
  if (obj && typeof obj.error === 'string') obj = { ...obj, error: publicError(obj.error) };
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
const guestMade = new DayCount(), GUEST_PER_IP_DAY = Number(process.env.GUEST_PER_IP_DAY) || 12; // 체험판: IP 하나에 하루 12개
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
  // CSP 위반 알림 (브라우저가 보낸다): 어느 지시 · 어느 출처인지만 센다
  if (url.pathname === '/api/csp-report' && req.method === 'POST') {
    const ip = clientIp(req);
    if (!rateLimited('post', ip)) {
      try { const b = await readJson(req, 8 * 1024); const r = b['csp-report'] || b; const blocked = String(r['blocked-uri'] || '').replace(/^(https?:\/\/[^/]+).*$/, '$1'); sec.note('csp', { ip, where: String(r['violated-directive'] || r['effective-directive'] || '').slice(0, 40), detail: `${blocked} @ ${String(r['document-uri'] || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 60)}` }); } catch { /* 이상한 알림 */ }
    }
    res.writeHead(204); return res.end();
  }
  // 공통 속도 제한 (3-1): IP 하나 · 계정 하나가 너무 많이 부르면 429 "잠시 후 다시"
  //   쓰기(POST · DELETE)는 IP 1초 3번(한 번에 150) + 계정 1초 2번(한 번에 60), 읽기는 IP 1초 15번(한 번에 400)
  const ip = clientIp(req), write = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  if (write) {
    if (rateLimited('post', ip, { req, res, json, where: url.pathname })) return;
    const acct = sid && (world.userOf(sid)?.sub || toss.read(sid));
    if (acct && rateLimited('user', acct, { req, res, json, where: url.pathname })) return;
  } else if (req.method === 'GET' && rateLimited('get', ip, { req, res, json, where: url.pathname })) return;
  // 토스 미니앱: /api/toss/... 는 토스 계정으로, 드림 러너 · 치장 API 를 토스 저장소에 그대로 쓴다
  if (url.pathname.startsWith('/api/toss/')) {
    tossCors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (await tossAccountApi(req, res, url, toss, json, { cos: cosmetics, devLogin: DEV_LOGIN })) return;
    const who = toss.userOf(sid), inner = new URL(url.href); inner.pathname = url.pathname.replace('/api/toss/', '/api/');
    if (inner.pathname.startsWith('/api/dream/')) return dreamApi(req, res, inner, who, dreamToss, json, () => false);
    if (inner.pathname.startsWith('/api/cos/')) return cosApi(req, res, inner, who, cosmetics, json);
    return json(res, 404, { error: 'not found' });
  }
  if (url.pathname === '/api/status') {
    return json(res, 200, { llm: llmEnabled, model: MODEL, password: !!PASSWORD, players: world.players.size, multiplayer: true, googleClientId: GOOGLE_CLIENT_ID, devLogin: DEV_LOGIN, replay: !!dreamBoard.pool?.ok });
  }
  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (limited(req)) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
    const body = await readJson(req);
    if (PASSWORD && body.password !== PASSWORD) return json(res, 403, { error: 'password' });
    let info;
    if (body.credential) info = await verifyGoogle(body.credential);
    else if (DEV_LOGIN && typeof body.dev === 'string' && body.dev.trim()) info = { sub: `dev:${body.dev.trim().slice(0, 16)}`, email: `${body.dev.trim().slice(0, 16)}@dev.local`, name: body.dev.trim().slice(0, 16), picture: '' };
    else if (body.guest === true) {
      // 체험판: 구글 로그인 없이 바로 (이틀 동안 접속하지 않으면 캐릭터가 사라진다)
      if (world.guestCount() >= 300) return json(res, 503, { error: '체험판 자리가 꽉 찼어요. 구글로 로그인해 주세요' });
      // 한 곳(IP)에서 하루에 체험판을 너무 많이 만들어 자리를 다 채우지 못하게
      if (guestMade.get(ip) >= GUEST_PER_IP_DAY) { sec.note('rate', { ip, where: '/api/login', detail: 'guest/day' }); return json(res, 429, { error: '오늘은 이곳에서 체험판을 더 만들 수 없어요. 구글로 로그인해 주세요' }); }
      guestMade.add(ip);
      info = { sub: `guest:${crypto.randomBytes(9).toString('hex')}`, email: '', name: `체험판 손님 ${Math.floor(1000 + Math.random() * 9000)}`, picture: '', guest: true };
    }
    else return json(res, 400, { error: '구글 로그인이 필요해요' });
    const session = world.login(info, Array.isArray(body.legacy) ? body.legacy : []);
    return json(res, 200, { session, user: world.publicUser(world.users[info.sub]), chars: world.charList(info.sub), cos: cosmetics.pub(info.sub) });
  }
  // 드림 러너 (계정 · 로그인은 젤리시티와 같이 쓴다)
  if (url.pathname.startsWith('/api/cos/')) return cosApi(req, res, url, world.userOf(sid), cosmetics, json);
  if (url.pathname.startsWith('/api/board/')) return boardApi(req, res, url, world.userOf(sid), board, json, isAdmin);
  if (url.pathname.startsWith('/api/sw/')) return swMetricsApi(req, res, url, swMetrics, json, world.userOf(sid), isAdmin);
  if (url.pathname === '/api/dream/run' && rateLimited('start', ip, { req, res, json, where: url.pathname })) return;
  if (url.pathname.startsWith('/api/dream/')) return dreamApi(req, res, url, world.userOf(sid), dreamBoard, json, isAdmin);
  if (url.pathname.startsWith('/api/merge/')) return mergeRecords.api(req, res, url, world.userOf(sid), json, '/api/merge');
  if (url.pathname.startsWith('/api/seoul/') && await seoulApi(req, res, url, json)) return;
  if (url.pathname.startsWith('/api/playtime') && await playtimeApi(req, res, url, playtime, json, () => ({ ids: ['dream-runner', 'jelly-city', ...GAME_IDS], dream: [dreamBoard, dreamToss], records: { 'jelly-ten': tenRecords, 'jelly-survivor': survRecords, 'jelly-type': typeRecords, 'jelly-merge': mergeRecords, 'jelly-slide': slideRecords, 'jelly-drift': driftRecords }, cityUsers: Object.keys(world.users || {}).length }))) return;
  if (url.pathname.startsWith('/api/slide/')) return slideRecords.api(req, res, url, world.userOf(sid), json, '/api/slide');
  if (url.pathname.startsWith('/api/drift/')) return driftRecords.api(req, res, url, world.userOf(sid), json, '/api/drift');
  if (url.pathname.startsWith('/api/rider/')) return driftRecords.api(req, res, url, world.userOf(sid), json, '/api/rider'); // 옛 주소
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
  if (url.pathname.startsWith('/api/ten/')) return tenRecords.api(req, res, url, world.userOf(sid), json, '/api/ten');
  if (url.pathname.startsWith('/api/apple/')) return tenRecords.api(req, res, url, world.userOf(sid), json, '/api/apple'); // 옛 주소
  if (url.pathname.startsWith('/api/surv/')) return survRecords.api(req, res, url, world.userOf(sid), json, '/api/surv');
  if (url.pathname.startsWith('/api/arcade/')) return arcadeRecords.api(req, res, url, world.userOf(sid), json, '/api/arcade');
  const who = world.userOf(sid);
  if (!who) return json(res, 401, { error: 'login' });
  if (url.pathname === '/api/me') return json(res, 200, { user: world.publicUser(who.user), chars: world.charList(who.sub), admin: isAdmin(who.user), cos: cosmetics.pub(who.sub) });
  // 닉네임 정하기 · 바꾸기 (구글 실명 대신 모든 게임에서 쓴다)
  if (url.pathname === '/api/nick' && req.method === 'POST') { if (rateLimited('nick', who.sub, { req, res, json, where: url.pathname })) return; const b = await readJson(req); try { return json(res, 200, { user: world.setNick(who.sub, b.nick) }); } catch (e) { return json(res, 400, { error: e.message }); } }
  const char = url.searchParams.get('char') || '';
  try {
    // 사진
    if (url.pathname === '/api/photo' && req.method === 'POST') { if (rateLimited('photo', who.sub, { req, res, json, where: url.pathname })) return; const b = await readJson(req, 700 * 1024); return json(res, 200, { id: world.savePhoto(who.sub, b.char, b.data) }); }
    if (url.pathname === '/api/photos') { if (!world.ownsChar(who.sub, char)) return json(res, 403, { error: '내 캐릭터가 아니에요' }); return json(res, 200, { list: world.myPhotos(char) }); }
    if (url.pathname.startsWith('/api/photo/') && req.method === 'DELETE') {
      const id = url.pathname.slice('/api/photo/'.length);
      if (!world.ownsChar(who.sub, char) || world.photos[id]?.owner !== char) return json(res, 403, { error: '내 사진이 아니에요' });
      world.deletePhoto(id); return json(res, 200, { ok: true });
    }
    // 젤리그램
    if (url.pathname === '/api/insta' && req.method === 'GET') return json(res, 200, { feed: world.instaFeed(char, url.searchParams.get('mode') === 'following' ? 'following' : 'all') });
    if (url.pathname === '/api/insta' && req.method === 'POST') { const b = await readJson(req); world.postInsta(who.sub, b.char, b.id, b.caption); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/insta/like' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { likes: world.likeInsta(who.sub, b.char, b.id) }); }
    if (url.pathname === '/api/insta/comments') return json(res, 200, { comments: world.instaComments(char, url.searchParams.get('id')) });
    if (url.pathname === '/api/insta/comment' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { comments: world.commentInsta(who.sub, b.char, b.id, b.text) }); }
    if (url.pathname === '/api/insta/comment/del' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { comments: world.deleteComment(who.sub, b.char, b.id, b.cid) }); }
    if (url.pathname === '/api/insta/follow' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, world.follow(who.sub, b.char, b.target)); }
    if (url.pathname === '/api/insta/profile') return json(res, 200, world.instaProfile(char, url.searchParams.get('user')));
    if (url.pathname === '/api/insta/follows') return json(res, 200, { list: world.followList(url.searchParams.get('user'), url.searchParams.get('which')) });
    // 젤리그램 DM
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
    if (rateLimited('nick', who.sub, { req, res, json, where: url.pathname })) return;
    const body = await readJson(req);
    try { world.renameChar(who.sub, url.pathname.split('/')[3], body.name); return json(res, 200, { chars: world.charList(who.sub) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/api/chars/') && req.method === 'DELETE') {
    try { world.deleteChar(who.sub, url.pathname.slice('/api/chars/'.length)); return json(res, 200, { chars: world.charList(who.sub) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  return json(res, 404, { error: 'not found' });
}

// 요청 하나가 이상해도(깨진 주소 · 이상한 글자) 서버 전체가 죽지 않게: 오류는 그 요청만 400 으로 끝낸다
//   천천히 보내는 공격(slowloris): 머리글은 20초 · 요청 전체는 60초 안에 와야 한다 (5초마다 검사)
const server = http.createServer({ headersTimeout: 20000, requestTimeout: 60000, connectionsCheckingInterval: 5000, maxHeaderSize: 16 * 1024 }, (req, res) => {
  try { handle(req, res); } catch (e) {
    console.warn('요청 처리 오류:', e.message);
    if (!res.headersSent) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('bad request'); } else res.destroy();
  }
});
// 보안 헤더: 모든 응답에. CSP 는 쓰는 출처(자기 주소 · jsDelivr · 구글 로그인 · 유튜브 · 구글 글꼴)만
//   CSP_MODE=report 이면 막지 않고 위반만 /api/csp-report 로 모은다 (CSP_MODE=off 면 CSP 를 보내지 않는다)
const CSP_MODE = process.env.CSP_MODE || 'enforce';
const FRAME_ANCESTORS = "'self' https://*.toss.im https://*.tossmini.com";
const cspFor = (host) => [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com https://apis.google.com https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  `connect-src 'self' ${/^[\w.:-]+$/.test(host) ? `wss://${host} ws://${host}` : ''} https://cdn.jsdelivr.net https://accounts.google.com`,
  "worker-src 'self' blob:",
  "frame-src https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  `frame-ancestors ${FRAME_ANCESTORS}`,
  "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  'report-uri /api/csp-report',
].join('; ');
function secHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  if (CSP_MODE === 'off') return;
  const csp = cspFor(String(req.headers.host || ''));
  if (CSP_MODE === 'enforce') res.setHeader('Content-Security-Policy', csp);
  else { res.setHeader('Content-Security-Policy-Report-Only', csp); res.setHeader('Content-Security-Policy', `frame-ancestors ${FRAME_ANCESTORS}; object-src 'none'; base-uri 'self'`); }
}
function handle(req, res) {
  secHeaders(req, res);
  const url = new URL(req.url, 'http://x');
  if (REDIRECT_TO && url.pathname !== '/healthz') { res.writeHead(301, { Location: REDIRECT_TO + req.url, 'Cache-Control': 'no-store' }); res.end(); return; }
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch((e) => { console.warn('API 오류:', url.pathname, e.message); if (!res.headersSent) json(res, e.status || 400, { error: e.message }); });
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
  for (const [o, n] of RENAMED) if (url.pathname === o || url.pathname.startsWith(o + '/')) { res.writeHead(301, { Location: n + url.pathname.slice(o.length) + url.search }); res.end(); return; }
  // 젤리 서울 러너: 드림 러너 페이지를 그대로 쓰되 따로 된 주소 · 제목으로, 열면 바로 서울 산책 (기존 /dream-runner/#hangang 도 그대로)
  // /seoul-walk/ 는 따로 된 랜딩 페이지(public/seoul-walk/), 게임은 /seoul-walk/play/ (드림 러너 페이지를 서울 산책으로)
  if (url.pathname === '/seoul-walk' || url.pathname === '/seoul' || url.pathname === '/seoul/' || url.pathname === '/seoul-runner' || url.pathname === '/seoul-runner/') { res.writeHead(301, { Location: '/seoul-walk/' + url.search }); res.end(); return; } // 짧은 주소 /seoul 도
  if (url.pathname === '/seoul-walk/play') { res.writeHead(301, { Location: '/seoul-walk/play/' + url.search }); res.end(); return; }
  if (url.pathname === '/seoul-walk/play/' || url.pathname === '/seoul-walk/play/index.html') {
    fs.readFile(path.join(PUBLIC, 'dream-runner/index.html'), 'utf8', (err, html) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const desc = '실제 서울을 걷고 · 달리고 · 나는 힐링 산책. 진짜 지도 · 건물 · 지형 · 실시간 날씨와 지하철';
      html = html.replace(/\s*<link rel="manifest"[^>]*>/, '').replace('<head>', '<head>\n  <base href="/dream-runner/" />\n  <script>window.SEOUL_WALK = 1; window.SW_PLAY = 1;</script>\n  <style>#title, .screen, #hg-start { visibility: hidden !important; } #sw-load { display: flex !important; position: fixed; inset: 0; z-index: 60; align-items: center; justify-content: center; } body.swready #sw-load { display: none !important; }</style>').replace('<title>드림 러너</title>', `<title>젤리 서울 러너</title>\n  <meta name="description" content="${desc}" />\n  <meta property="og:title" content="젤리 서울 러너" />\n  <meta property="og:description" content="${desc}" />\n  <meta property="og:image" content="/dream-runner/sw/63.webp" />\n  <meta name="twitter:card" content="summary_large_image" />`).replace('<body>', '<body class="sw solo swplay">');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(html);
    });
    return;
  }
  // 웹 워커용 모듈(?w=1): 워커에선 import map 이 안 되므로 'three' · 'three/addons/…' 를 jsDelivr ESM 주소로 바꾸고, 상대 import 에도 ?w=1 을 붙여 준다 (젤리 서울 러너 랜딩의 3D 를 워커에서 그리려고)
  if (url.searchParams.has('w') && url.pathname.endsWith('.js')) {
    const wf = publicPath(PUBLIC, url.pathname);
    if (!wf || !fs.existsSync(wf)) { res.writeHead(404); res.end('not found'); return; }
    const key = wf + ':' + fs.statSync(wf).mtimeMs; let code = WMOD.get(key);
    if (!code) {
      const T = 'https://cdn.jsdelivr.net/npm/three@0.169.0';
      code = fs.readFileSync(wf, 'utf8').replace(/(from\s*|import\s*\(\s*)(['"])three\2/g, `$1$2${T}/+esm$2`).replace(/(from\s*|import\s*\(\s*)(['"])three\/addons\/([^'"]+)\2/g, (m, a, q, f) => `${a}${q}${T}/examples/jsm/${f}/+esm${q}`).replace(/(from\s*|import\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g, '$1$2$3?w=1$2'); // import './x.js' (부작용만 있는 import) 도
      WMOD.set(key, code);
    }
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(code); return;
  }
  // public 밖 · 숨김 파일(.env · .git) · 이상한 글자는 없는 파일처럼 404
  let file = publicPath(PUBLIC, url.pathname);
  if (!file) { if (/\.\.|%2e|%00|\\|%5c|\/\./i.test(url.pathname)) sec.note('path', { ip: clientIp(req), where: 'static', detail: url.pathname.slice(0, 80) }); res.writeHead(404); res.end('not found'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    // /jelly-city → /jelly-city/ (게임 안의 상대 경로가 맞게)
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
    file = path.join(file, 'index.html');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const type = MIME[path.extname(file)] || 'application/octet-stream';
    // 글자 파일(지도 json · js · css · html)은 gzip 으로 (서울 칸 지도 하나 500KB → 100KB 남짓). 만든 것은 조금 기억 (파일이 바뀌면 다시)
    if (data.length > 2048 && /json|javascript|css|html|svg|text/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const st = fs.statSync(file), key = file + ':' + st.mtimeMs, hit = GZ.get(key);
      const send = (gz) => { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); res.end(gz); };
      if (hit) { GZ.delete(key); GZ.set(key, hit); send(hit); return; }
      zlib.gzip(data, { level: 6 }, (e2, gz) => { if (e2) { res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' }); res.end(data); return; } GZ.set(key, gz); gzBytes += gz.length; for (const [k, v] of GZ) { if (gzBytes <= 40e6) break; GZ.delete(k); gzBytes -= v.length; } send(gz); });
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
server.timeout = 120000; // 아무것도 오가지 않는 연결은 2분 뒤 끊는다 (웹소켓은 업그레이드 뒤 따로)
server.maxHeadersCount = 100;
const GZ = new Map(); let gzBytes = 0;
const WMOD = new Map(); // 워커용으로 바꾼 모듈 (파일이 바뀌면 다시)

// WS_COMPRESS=1 이면 메시지를 압축해서 보낸다 (트래픽 ↓, CPU ↑)
const COMPRESS = process.env.WS_COMPRESS === '1';
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: COMPRESS ? { zlibDeflateOptions: { level: 3 }, threshold: 512 } : false });
// 드림 러너 방(최대 12명): 따로 연결
const dreamWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
dreamWss.on('connection', (ws) => dreamRooms.connect(ws));
const driftWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
driftWss.on('connection', (ws) => driftRooms.connect(ws));
const tacticalWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
tacticalWss.on('connection', (ws) => tacticalRooms.connect(ws));
const dropWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
dropWss.on('connection', (ws) => dropRooms.connect(ws));
const guardWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });
guardWss.on('connection', (ws) => guardRooms.connect(ws));
const partyWss = (rooms) => { const w = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false }); w.on('connection', (ws) => rooms.connect(ws)); return w; };
const tenWss = partyWss(tenRooms), wordWss = partyWss(wordRooms), typeWss = partyWss(typeRooms);
const rumbleWss = partyWss(rumbleRooms), mergeWss = partyWss(mergeRooms), courtWss = partyWss(courtRooms), dingWss = partyWss(dingRooms), slideWss = partyWss(slideRooms);
const drawWss = new WebSocketServer({ noServer: true, maxPayload: 160 * 1024, perMessageDeflate: { threshold: 2048 } }); // 그림은 커서 더 크게 · 압축
drawWss.on('connection', (ws) => drawRooms.connect(ws));
const survWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: { threshold: 512 } }); // 충치균이 많아서 압축
survWss.on('connection', (ws) => survRooms.connect(ws));
// 숨바꼭질: 칠한 몸 그림(작은 JPEG)을 주고받아서 크게 · 압축
const hideWss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024, perMessageDeflate: { threshold: 1024 } });
hideWss.on('connection', (ws) => hideRooms.connect(ws));
const arcadeWss = partyWss(arcadeRooms);
const arenaWss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: { threshold: 512 } });
arenaWss.on('connection', (ws) => arenaRooms.connect(ws));
const sketchWss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: { threshold: 1024 } }); // 그리는 획을 실시간으로
sketchWss.on('connection', (ws) => sketchRooms.connect(ws));
// 주소로 나눠 받는다: /ws = 젤리시티 · /dream-ws = 드림 러너
server.on('upgrade', (req, socket, head) => {
  let p0; try { p0 = new URL(req.url, 'http://x').pathname; } catch { socket.destroy(); return; }
  const p = OLD_WS[p0] || p0;
  const target = p === '/ws' ? wss : p === '/dream-ws' ? dreamWss : p === '/drift-ws' ? driftWss : p === '/tactical-ws' ? tacticalWss : p === '/drop-ws' ? dropWss : p === '/guard-ws' ? guardWss : p === '/ten-ws' ? tenWss : p === '/word-ws' ? wordWss : p === '/draw-ws' ? drawWss : p === '/type-ws' ? typeWss : p === '/surv-ws' ? survWss : p === '/sketch-ws' ? sketchWss : p === '/rumble-ws' ? rumbleWss : p === '/merge-ws' ? mergeWss : p === '/court-ws' ? courtWss : p === '/ding-ws' ? dingWss : p === '/slide-ws' ? slideWss : p === '/hide-ws' ? hideWss : p === '/arena-ws' ? arenaWss : p === '/arcade-ws' ? arcadeWss : null;
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
    try { const n = dreamRooms.maint(); if (n) console.log(`🌙 드림 러너: 달리던 방 ${n}개를 멈춰 적어 뒀어요`); } catch (e) { console.error('드림 러너 멈추기 실패', e); }
    try { swMetrics.flush(); } catch (e) { console.error('지표 저장 실패', e); }
    try { world.save(); console.log('💾 세계를 저장했어요'); } catch (e) { console.error('저장 실패', e); }
    dreamBoard.save(); dreamToss.save(); toss.save(); playtime.save(); cosmetics.save(); board.save(); driftRecords.save(); tenRecords.save(); survRecords.save(); wordDict.save(); typeRecords.save(); mergeRecords.save(); slideRecords.save(); arcadeRecords.save();
    setTimeout(() => process.exit(0), 500);
  });
}

// 놓친 오류 하나로 모든 게임이 꺼지지 않게: 기록만 남기고 계속 돈다
process.on('uncaughtException', (e) => { console.error('놓친 오류:', e?.stack || e); });
process.on('unhandledRejection', (e) => { console.error('놓친 비동기 오류:', e?.stack || e); });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🐻 젤리시티 서버: http://localhost:${PORT}`);
  console.log(`   로그인: ${GOOGLE_CLIENT_ID ? '구글 로그인 필수' : '⚠️ GOOGLE_CLIENT_ID 없음 → 개발용 이름 로그인'}`);
  console.log(`   LLM: ${llmEnabled ? `${MODEL} 사용` : '키 없음 (기본 대사)'} · 비밀번호: ${PASSWORD ? '설정됨' : '없음'}`);
});
