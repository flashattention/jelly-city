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

// ---------- 점수 · 기록 위조 ----------
const hex = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
test('5-1 기록판: 출발표로 남기기 · 같은 출발표 재사용 거절', async () => {
  const anon = hex(24), h = IP(50);
  const { tk } = await (await postJ('/api/slide/start', { b: 's4' }, h)).json();
  assert.ok(tk);
  await new Promise((r) => setTimeout(r, 2100)); // 같은 사람 2초 간격
  let r = await postJ('/api/slide/record', { b: 's4', value: 1234, name: '정상곰', anon, tk }, h);
  assert.equal(r.status, 200); let j = await r.json(); assert.equal(j.hold, true, '10초 안 = 너무 빠름 → 상위권이면 보류');
  await new Promise((r2) => setTimeout(r2, 2100));
  r = await postJ('/api/slide/record', { b: 's4', value: 9999, name: '정상곰', anon, tk }, h);
  assert.equal(r.status, 409, '같은 출발표는 한 번만');
});

test('5-1 기록판: 출발표 없는 1등은 공개 순위표에서 보류, 주인에게만 보인다 · 관리자가 인정하면 보인다', async () => {
  const anon = hex(24), h = IP(51);
  const r = await postJ('/api/ten/record', { b: 't60', score: 170, name: '수상한곰', anon }, h);
  assert.equal(r.status, 200); const j = await r.json(); assert.equal(j.hold, true); assert.equal(j.me.hold, true);
  const pub = await (await fetch(S.base + '/api/ten/board?b=t60', { headers: IP(52) })).json();
  assert.ok(!pub.top.some((e) => e.name === '수상한곰'), '공개 순위표에는 없다');
  const mine = await (await fetch(S.base + `/api/ten/board?b=t60&anon=${anon}`, { headers: IP(52) })).json();
  assert.equal(mine.me.name, '수상한곰');
  // 관리자 화면에서 인정
  const admin = (await (await postJ('/api/login', { dev: 'admin' }, IP(53))).json()).session;
  const list = await (await fetch(S.base + '/api/sec/held', { headers: { Authorization: `Bearer ${admin}`, ...IP(53) } })).json();
  const it = list.list.find((x) => x.name === '수상한곰'); assert.ok(it); assert.equal(it.why, 'noticket');
  assert.equal((await postJ('/api/sec/held', { game: 'jelly-ten', b: 't60', key: it.key, act: 'ok' }, IP(53), )).status, 401, '로그인 없이는 안 된다');
  const ok = await fetch(S.base + '/api/sec/held', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}`, ...IP(53) }, body: JSON.stringify({ game: 'jelly-ten', b: 't60', key: it.key, act: 'ok' }) });
  assert.equal(ok.status, 200);
  const pub2 = await (await fetch(S.base + '/api/ten/board?b=t60', { headers: IP(52) })).json();
  assert.ok(pub2.top.some((e) => e.name === '수상한곰'));
  // 관리자가 아닌 사람은 못 본다
  const user = (await (await postJ('/api/login', { dev: 'notadmin' }, IP(54))).json()).session;
  assert.equal((await fetch(S.base + '/api/sec/held', { headers: { Authorization: `Bearer ${user}`, ...IP(54) } })).status, 403);
});

test('5-1 기록판: 실제로 지난 시간보다 긴 기록은 거절', async () => {
  const anon = hex(24), h = IP(55);
  const { tk } = await (await postJ('/api/drift/start', { b: 'candy' }, h)).json();
  const r = await postJ('/api/drift/record', { b: 'candy', time: 60, name: '순간이동곰', anon, tk }, h);
  assert.equal(r.status, 400);
  const t2 = (await (await postJ('/api/surv/start', { b: 'endless' }, h)).json()).tk;
  await new Promise((r2) => setTimeout(r2, 2100));
  assert.equal((await postJ('/api/surv/record', { b: 'endless', score: 900, name: '순간이동곰', anon, tk: t2 }, h)).status, 400);
  // 다른 판의 출발표는 없는 것과 같다 (보류)
  const t3 = (await (await postJ('/api/drift/start', { b: 'neon' }, h)).json()).tk;
  await new Promise((r2) => setTimeout(r2, 2100));
  const j = await (await postJ('/api/drift/record', { b: 'candy', time: 30, name: '순간이동곰', anon, tk: t3 }, h)).json();
  assert.equal(j.hold, true);
});

test('6-2 익명 id 농사: 한 IP 가 새 익명 id 를 하루 40개 넘게 만들면 막는다 (이미 있는 id 는 그대로)', async () => {
  const h = IP(60), ids = [];
  const codes = [];
  for (let i = 0; i < 42; i++) { const a = hex(24); ids.push(a); codes.push((await postJ('/api/cos/attend', { anon: a }, h)).status); }
  assert.deepEqual(codes.slice(0, 40), Array(40).fill(200));
  assert.equal(codes[40], 429);
  assert.equal((await postJ('/api/cos/seen', { anon: ids[0] }, h)).status, 200, '이미 쓰던 익명 id 는 된다');
  assert.equal((await postJ('/api/cos/attend', { anon: ids[0] }, h)).status, 400, '출석은 하루 한 번 (두 번 주기 금지)');
  assert.equal((await postJ('/api/cos/attend', { anon: hex(24) }, IP(61))).status, 200, '다른 IP 는 된다');
});

test('6-3 혼자 하기 끝 알림: 시작 없이 끝만 오면 버린다', async () => {
  const r = await (await postJ('/api/cos/solo', { anon: hex(24), game: 'jelly-arcade', end: true, win: true }, IP(62))).json();
  assert.equal(r.ok, false);
});

test('정상 플레이: 드림 러너 출발표 → 한 판 끝(별) · 같은 판 두 번은 한 번만', async () => {
  const h = IP(63), anon = hex(24);
  const { tk } = await (await postJ('/api/dream/run', { seed: 1, diff: 'easy', map: 'dream', mode: 'speed' }, h)).json();
  await new Promise((r) => setTimeout(r, 3600));
  const a = await (await postJ('/api/dream/played', { anon, tk, time: 3.2, diff: 'easy', map: 'dream', dist: 200, stars: 5, die: 'hurdle' }, h)).json();
  assert.equal(a.ok, true); assert.ok(a.earned >= 0);
  const b = await (await postJ('/api/dream/played', { anon, tk, time: 3.2, diff: 'easy', map: 'dream', dist: 200, stars: 5 }, h)).json();
  assert.deepEqual(b.earned, a.earned, '재전송은 처음 결과 그대로');
  const sc = await postJ('/api/dream/score', { anon, tk, name: '달리곰', time: 3.2, diff: 'easy', map: 'dream', dist: 200, stars: 5, themes: 1 }, h);
  assert.equal(sc.status, 400, '플레이 기록 없는 판은 순위표에 안 올린다(기존 규칙)');
});

test('7-2 · 7-3 위조 세션 · 관리자 아닌 사람은 관리자 기능을 못 쓴다', async () => {
  const h = IP(70);
  for (const tok of ['dG9zczp4.1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'x'.repeat(48), '']) assert.equal((await fetch(S.base + '/api/toss/me', { headers: { Authorization: `Bearer ${tok}`, ...h } })).status, 401);
  const dev = await (await postJ('/api/toss/login', { device: true }, h)).json(); assert.ok(dev.session);
  const forged = dev.session.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  assert.equal((await fetch(S.base + '/api/toss/me', { headers: { Authorization: `Bearer ${forged}`, ...h } })).status, 401, '서명이 한 글자만 달라도 거절');
  const user = (await (await postJ('/api/login', { dev: 'plainuser' }, h)).json()).session, H = { Authorization: `Bearer ${user}`, ...h };
  for (const [m, p] of [['GET', '/api/dream/admin/list'], ['POST', '/api/dream/admin/remove'], ['GET', '/api/feedback'], ['POST', '/api/feedback/abc'], ['GET', '/api/sw/report'], ['GET', '/api/sec/summary'], ['POST', '/api/board/unhide'], ['GET', '/api/toss/dream/admin/list']]) {
    const r = await fetch(S.base + p, { method: m, headers: { 'Content-Type': 'application/json', ...H }, body: m === 'POST' ? '{}' : undefined });
    assert.ok([400, 401, 403].includes(r.status) && r.status !== 200, `${m} ${p} → ${r.status}`);
  }
  // 로그아웃하면 세션이 사라진다
  await fetch(S.base + '/api/logout', { method: 'POST', headers: H });
  assert.equal((await fetch(S.base + '/api/me', { headers: H })).status, 401);
});

test('8-2 운영자 흉내 · 보이지 않는 글자 이름', async () => {
  const h = IP(80), sid = (await (await postJ('/api/login', { dev: 'nicktest' }, h)).json()).session;
  for (const n of ['운영자', '관 리 자', 'ADMIN곰', '젤리게임즈']) {
    const r = await fetch(S.base + '/api/nick', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sid}`, ...h }, body: JSON.stringify({ nick: n }) });
    assert.equal(r.status, 400, n); assert.match((await r.json()).error, /운영자처럼/);
  }
  await new Promise((r) => setTimeout(r, 50));
  const ok = await (await fetch(S.base + '/api/nick', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sid}`, ...h }, body: JSON.stringify({ nick: '착한\u200b곰\u202e' }) })).json();
  assert.equal(ok.user?.nick, '착한곰');
  const ws = await wsOpen('/ten-ws', IP(81)); ws.send(JSON.stringify({ t: 'hello', name: '운영자', color: '#000000' })); ws.send(JSON.stringify({ t: 'create', name: '방' }));
  const j = await waitFor(ws, (m) => m.t === 'joined'); assert.ok(j); assert.ok(!j.members.some((m) => m.name === '운영자')); ws.close();
});

test('10 바깥 API: 정상 · 허용 목록 밖 거절 · 키가 응답에 안 나옴 (흉내 자료)', async () => {
  const h = IP(90), get = async (p) => { const r = await fetch(S.base + p, { headers: h }); return { code: r.status, j: await r.json().catch(() => ({})), t: '' }; };
  const pos = await get('/api/seoul/subway/positions?lines=5호선,9호선');
  assert.equal(pos.code, 200); assert.ok(Array.isArray(pos.j.lines['5호선']));
  const st = pos.j.lines['5호선'][0]?.at || '여의나루';
  assert.equal((await get(`/api/seoul/subway/arrival?station=${encodeURIComponent(st)}`)).code, 200);
  for (const bad of ['../../x', '%2F..%2Fadmin', 'a/b?c=1', 'http://evil', '여의나루/../../realtimePosition']) assert.equal((await get(`/api/seoul/subway/arrival?station=${encodeURIComponent(bad)}`)).code, 400, bad);
  assert.equal((await get('/api/seoul/subway/position?line=' + encodeURIComponent('1호선/../../x'))).code, 400);
  assert.equal((await get('/api/seoul/city?area=' + encodeURIComponent('http://169.254.169.254/'))).code >= 400, true);
  const near = await get('/api/seoul/bus/near?lat=37.527&lon=126.932&c=t1');
  assert.equal(near.code, 200);
  assert.equal((await get('/api/seoul/bus/near?lat=40&lon=126.9')).code, 400, '서울 밖 좌표');
  assert.equal((await get('/api/seoul/bus/stops?rid=999999999999')).code, 400, '모르는 노선 번호로 예산을 태우지 못한다');
  const known = near.j.buses?.[0]?.rid; if (known) assert.equal((await get(`/api/seoul/bus/stops?rid=${known}`)).code, 200);
  const status = await (await fetch(S.base + '/api/seoul/transit/status', { headers: h })).text();
  assert.doesNotMatch(status, /serviceKey|SEOUL_\w*KEY|"mock"\s*:\s*"/i);
});

test('7-1 순위표에 익명 id 가 나가지 않는다', async () => {
  const anon = hex(24), h = IP(56);
  await postJ('/api/merge/record', { b: 'cup', value: 3, name: '비밀곰', anon }, h);
  const txt = await (await fetch(S.base + '/api/merge/board?b=cup', { headers: h })).text();
  assert.ok(!txt.includes(anon.slice(-8)) && !txt.includes(anon), '익명 id 조각이 없다');
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
