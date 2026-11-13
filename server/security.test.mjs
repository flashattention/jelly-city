// 공격 시나리오 시험: 임시 데이터 폴더로 띄운 로컬 서버에만 보낸다
//   node --test server/security.test.mjs
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import WebSocket from 'ws';
import { startServer } from './test-server.mjs';

let S;
before(async () => { S = await startServer(); });
after(async () => { await S.stop(); });

const raw = (port, text) => new Promise((ok) => {
  const c = net.connect(port, '127.0.0.1', () => c.write(text)); let out = '';
  c.on('data', (d) => { out += d; }); c.on('end', () => ok(out)); c.on('error', () => ok(out)); setTimeout(() => { c.destroy(); ok(out); }, 2000);
});

test('2-1 보안 헤더가 모든 응답에 붙는다', async () => {
  for (const p of ['/', '/dream-runner/', '/api/status', '/no-such-file']) {
    const r = await fetch(S.base + p);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', p);
    assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', p);
    assert.match(r.headers.get('strict-transport-security') || '', /max-age=\d+/, p);
    const csp = r.headers.get('content-security-policy') || '';
    assert.match(csp, /frame-ancestors 'self' https:\/\/\*\.toss\.im/, p);
    assert.match(csp, /object-src 'none'/, p);
    assert.match(csp, /script-src 'self'[^;]*https:\/\/cdn\.jsdelivr\.net[^;]*https:\/\/accounts\.google\.com/, p);
  }
});

test('2-1 CSP 위반 알림을 받아 센다', async () => {
  const r = await fetch(S.base + '/api/csp-report', { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/x.js', 'document-uri': 'http://x/' } }) });
  assert.equal(r.status, 204);
});

test('급한 버그: 깨진 주소 · 이상한 요청 줄에도 서버가 죽지 않는다', async () => {
  for (const p of ['/%E0%A4%A', '/%E0.js?w=1', '/%00', '/api/%E0%A4%A']) {
    const r = await fetch(S.base + p);
    assert.ok(r.status >= 400, p);
  }
  await raw(S.port, 'GET http://[ HTTP/1.1\r\nHost: x\r\n\r\n');
  assert.equal((await fetch(S.base + '/healthz')).status, 200);
});

test('2-3 큰 본문은 읽지 않고 끊는다', async () => {
  const big = 'x'.repeat(40 * 1024);
  const r = await fetch(S.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dev: big }) });
  assert.ok(r.status >= 400 && r.status < 500);
  // 길이를 속이고 천천히 많이 보내도 한도에서 끊긴다
  const out = await raw(S.port, `POST /api/board/write HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n${(40000).toString(16)}\r\n${'a'.repeat(40000)}\r\n`);
  assert.ok(!/200 OK/.test(out));
  assert.equal((await fetch(S.base + '/healthz')).status, 200);
});

test('2-3 천천히 보내는 머리글(slowloris)은 끊긴다', { timeout: 40000 }, async () => {
  const t0 = Date.now();
  const closed = await new Promise((ok) => {
    const c = net.connect(S.port, '127.0.0.1', () => c.write('GET / HTTP/1.1\r\nHost: x\r\n'));
    const iv = setInterval(() => { try { c.write('X-a: b\r\n'); } catch { /* 끊김 */ } }, 3000);
    c.on('close', () => { clearInterval(iv); ok(true); }); c.on('error', () => {});
    setTimeout(() => { clearInterval(iv); c.destroy(); ok(false); }, 35000);
  });
  assert.ok(closed, '35초 안에 끊겨야 한다');
  assert.ok(Date.now() - t0 < 30000);
});

test('2-4 __proto__ 가 든 본문은 버린다', async () => {
  for (const body of ['{"__proto__":{"admin":true},"dev":"x"}', '{"dev":"y","a":{"constructor":{"prototype":{"admin":1}}}}']) {
    const r = await fetch(S.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(r.status, 400);
  }
});

const IP = (n) => ({ 'fly-client-ip': `10.9.${Math.floor(n / 250)}.${n % 250}` });
const postJ = (p, body, headers = {}) => fetch(S.base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('3-1 대량 요청: 한 IP 가 쓰기 API 를 쏟아내면 429, 다른 IP 는 그대로', async () => {
  const codes = [];
  for (let i = 0; i < 200; i++) codes.push((await postJ('/api/playtime', { game: 'jelly-ten', id: 'x' + i }, IP(1))).status);
  assert.ok(codes.filter((c) => c === 200).length >= 140, '처음 150번은 된다');
  assert.ok(codes.includes(429), '넘치면 429');
  const r = await postJ('/api/playtime', { game: 'jelly-ten', id: 'y' }, IP(1));
  assert.equal(r.status, 429); assert.match((await r.json()).error, /잠시 후/);
  assert.equal((await postJ('/api/playtime', { game: 'jelly-ten', id: 'z' }, IP(2))).status, 200);
});

test('3-1 체험판 농사: 한 IP 하루 12개까지', async () => {
  const codes = [];
  for (let i = 0; i < 14; i++) codes.push((await postJ('/api/login', { guest: true }, IP(3))).status);
  assert.deepEqual(codes.slice(0, 12), Array(12).fill(200));
  assert.equal(codes[13], 429);
  assert.equal((await postJ('/api/login', { guest: true }, IP(4))).status, 200);
});

// ---------- 웹소켓 ----------
const wsOpen = (p, headers = {}) => new Promise((ok) => {
  const ws = new WebSocket(`ws://127.0.0.1:${S.port}${p}`, { headers: { Origin: S.base, ...headers } });
  const msgs = []; ws.msgs = msgs;
  ws.on('message', (d) => { try { msgs.push(JSON.parse(d)); } catch { /* */ } });
  ws.on('open', () => ok(ws)); ws.on('unexpected-response', (q, r) => ok({ rejected: r.statusCode })); ws.on('error', () => ok({ rejected: -1 }));
});
const waitFor = async (ws, f, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = ws.msgs.find(f); if (m) return m; await new Promise((r) => setTimeout(r, 30)); } return null; };
const closed = (ws, ms = 5000) => new Promise((ok) => { if (ws.readyState === 3) return ok(true); ws.on('close', (c) => ok(c || true)); setTimeout(() => ok(false), ms); });

test('4-1 Origin: 다른 사이트에서 연 웹소켓은 거절, 자기 주소 · 토스 · 로컬은 허용', async () => {
  assert.equal((await wsOpen('/ten-ws', { Origin: 'https://evil.example', ...IP(20) })).rejected, 403);
  assert.equal((await wsOpen('/ws', { Origin: 'https://jelly-city.fly.dev.evil.example', ...IP(20) })).rejected, 403);
  for (const o of [S.base, 'https://jelly-city.fly.dev', 'https://dreamrunner.apps.tossmini.com', 'http://localhost:8000']) {
    const ws = await wsOpen('/ten-ws', { Origin: o, ...IP(21) }); assert.ok(ws instanceof WebSocket, o); ws.close();
  }
});

test('정상 플레이: 방 게임 만들기 → 초대 코드로 다른 사람 참가 → 채팅', async () => {
  const a = await wsOpen('/ten-ws', IP(30)), b = await wsOpen('/ten-ws', IP(31));
  a.send(JSON.stringify({ t: 'hello', session: null, name: '곰A', color: '#ff0000' }));
  b.send(JSON.stringify({ t: 'hello', session: null, name: '곰B', color: '#00ff00' }));
  await waitFor(a, (m) => m.t === 'hello');
  const sid = await (await postJ('/api/login', { dev: 'roomhost' }, IP(30))).json();
  a.send(JSON.stringify({ t: 'hello', session: sid.session, name: '곰A', color: '#ff0000' }));
  await new Promise((r) => setTimeout(r, 100));
  a.send(JSON.stringify({ t: 'create', name: '시험 방' }));
  const j = await waitFor(a, (m) => m.t === 'joined'); assert.ok(j, '방이 만들어진다');
  b.send(JSON.stringify({ t: 'join', id: j.room.id }));
  assert.ok(await waitFor(b, (m) => m.t === 'joined'), '초대 코드로 들어간다');
  b.send(JSON.stringify({ t: 'chat', s: '안녕 <img src=x onerror=alert(1)>' }));
  const c = await waitFor(a, (m) => m.t === 'chat' && m.name === '곰B'); assert.ok(c); assert.doesNotMatch(c.s, /</);
  a.close(); b.close();
});

test('정상 플레이: 젤리시티 구경 · 드림 러너 방 접속', async () => {
  const c = await wsOpen('/ws', IP(32)); c.send(JSON.stringify({ t: 'spectate' }));
  assert.ok(await waitFor(c, (m) => m.t === 'snap' || m.time !== undefined || m.citizens, 4000), '젤리시티 스냅샷이 온다'); c.close();
  const d = await wsOpen('/dream-ws', IP(33)); d.send(JSON.stringify({ t: 'hello', session: null, name: '달리는곰', color: '#123456', resume: { room: 'X', tok: 'y' } }));
  assert.ok(await waitFor(d, (m) => m.t === 'hello')); d.close();
});

test('3-3 메시지 폭주: 버리고, 계속 넘치면 끊는다', async () => {
  const ws = await wsOpen('/ten-ws', IP(40));
  ws.send(JSON.stringify({ t: 'hello', name: '폭주' }));
  for (let i = 0; i < 1200; i++) ws.send(JSON.stringify({ t: 'list' }));
  assert.equal((await closed(ws)), 1008);
});

test('4-2 이상한 메시지(오염 키 · 깊은 중첩 · 이상한 형)는 버리고, 많으면 끊는다', async () => {
  const ws = await wsOpen('/ten-ws', IP(41));
  ws.send(JSON.stringify({ t: 'hello', name: '이상' }));
  let deep = 1; for (let i = 0; i < 20; i++) deep = [deep];
  const bad = ['{"t":"hello","__proto__":{"x":1}}', JSON.stringify({ t: 'st', p: deep }), JSON.stringify({ t: 'join', id: { $gt: '' } }), JSON.stringify({ t: 'chat', s: 'x'.repeat(5000) }), '[1,2]', '"str"', JSON.stringify({ t: '<script>' }), JSON.stringify({ t: 'st', p: [1e300] }), 'not json'];
  for (let i = 0; i < 8; i++) for (const m of bad) ws.send(m);
  assert.equal((await closed(ws)), 1008);
  const ok = await wsOpen('/ten-ws', IP(42)); ok.send(JSON.stringify({ t: 'hello', name: '정상' })); assert.ok(await waitFor(ok, (m) => m.t === 'hello')); ok.close();
});

test('3-4 초대 코드 맞히기: IP 하나가 방 찾기를 쏟아내면 막는다', async () => {
  const ws = await wsOpen('/ten-ws', IP(43));
  ws.send(JSON.stringify({ t: 'hello', name: '맞히기' }));
  for (let i = 0; i < 40; i++) ws.send(JSON.stringify({ t: 'join', id: `AAA${String(i).padStart(3, '0')}` }));
  assert.ok(await waitFor(ws, (m) => m.t === 'error' && m.code === 'slow'), '잠시 후 다시 안내');
  assert.ok(ws.msgs.filter((m) => m.code === 'noroom').length <= 21);
  ws.close();
});

test('3-2 IP 하나당 동시 접속 상한', async () => {
  const socks = []; let rejected = 0;
  for (let i = 0; i < 90; i++) { const w = await wsOpen('/word-ws', IP(44)); if (w.rejected) rejected++; else socks.push(w); }
  assert.ok(socks.length <= 80 && rejected >= 10, `열림 ${socks.length} · 거절 ${rejected}`);
  for (const w of socks) w.close();
  const other = await wsOpen('/word-ws', IP(45)); assert.ok(other instanceof WebSocket); other.close();
});

test('2-2 정적 파일: public 밖 · 숨김 파일을 읽을 수 없다', async () => {
  const bad = ['/..%2f..%2f.env', '/..%2fpackage.json', '/%2e%2e/%2e%2e/.env', '/..%5c..%5cserver%5cindex.js', '/dream-runner/..%2f..%2fserver/index.js', '/.env', '/.git/config', '/%2egit/config', '/shared/%00.js', '/x.js%00.html', '/..%2f..%2fserver/index.js?w=1', '/.well-known/../../.env'];
  for (const p of bad) {
    const r = await raw(S.port, `GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
    const code = Number(r.split(' ')[1]);
    assert.ok(code >= 400 && code < 500, `${p} → ${code}`);
    assert.doesNotMatch(r, /GOOGLE_CLIENT_ID|"dependencies"|import http|\[core\]/, p);
  }
  assert.equal((await fetch(S.base + '/dream-runner/')).status, 200);
  assert.equal((await fetch(S.base + '/shared/patchnotes.json')).status, 200);
});
