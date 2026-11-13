// 보안 공통 모듈 시험: node --test server/shared/guard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Bucket, DayCount, publicPath, parseSafe, pick, cleanText, cleanName, impersonates, publicError, WsGuard, originOk, wsShapeOk, specOk, ROOM_SPECS } from './guard.js';

test('토큰 버킷: 한 번에 burst 까지, 그 뒤엔 rate 만큼 다시 찬다', () => {
  const b = new Bucket({ rate: 2, burst: 3 }); const t = 1e6;
  assert.ok(b.take('a', 1, t) && b.take('a', 1, t) && b.take('a', 1, t));
  assert.equal(b.take('a', 1, t), false);
  assert.equal(b.take('b', 1, t), true); // 다른 사람은 따로
  assert.equal(b.take('a', 1, t + 500), true); // 0.5초에 1개
  assert.equal(b.take('a', 1, t + 500), false);
});
test('토큰 버킷: 너무 많아지면 정리한다', () => {
  const b = new Bucket({ rate: 1, burst: 1, max: 100 });
  for (let i = 0; i < 1000; i++) b.take('k' + i, 1, 1000);
  assert.ok(b.m.size <= 100);
});
test('하루 세기', () => { const d = new DayCount(); assert.equal(d.add('x'), 1); assert.equal(d.add('x', 2), 3); assert.equal(d.get('y'), 0); });

test('publicPath: 밖 · 숨김 · 이상한 글자는 null', () => {
  const R = path.resolve('/srv/app/public');
  assert.equal(publicPath(R, '/dream-runner/index.html'), path.join(R, 'dream-runner/index.html'));
  assert.equal(publicPath(R, '/'), R + path.sep);
  for (const p of ['/../.env', '/..%2f.env', '/a/%2e%2e/%2e%2e/b', '/.env', '/.git/HEAD', '/x%00.js', '/a%5c..%5cb', '/%E0%A4%A', '/../public2/x']) assert.equal(publicPath(R, p), null, p);
  assert.ok(publicPath(R, '/.well-known/x'));
});

test('parseSafe: __proto__ · constructor · prototype 키는 버린다', () => {
  assert.deepEqual(parseSafe('{"a":1,"b":{"c":[1,2]}}'), { a: 1, b: { c: [1, 2] } });
  for (const t of ['{"__proto__":{"admin":true}}', '{"a":{"constructor":{"prototype":{"x":1}}}}', '[{"prototype":1}]']) assert.throws(() => parseSafe(t), /bad json/);
  assert.equal({}.admin, undefined);
  assert.deepEqual(pick({ a: 1, b: 2 }, ['a', 'z']), { a: 1 });
});

test('cleanText: 보이지 않는 글자 · 방향 바꾸기 · 결합 문자 남용을 걷어 낸다', () => {
  assert.equal(cleanText('젤​리‮곰', 20), '젤리곰');
  assert.equal(cleanText('a\u0301\u0301\u0301\u0301\u0301b', 20), 'a\u0301\u0301b'.normalize('NFC'));
  assert.equal(cleanText('  여러   칸  ', 20), '여러 칸');
  assert.equal(cleanText('줄\n바꿈\n\n\n\n\n끝', 50, { lines: true }), '줄\n바꿈\n\n\n끝');
  assert.equal(cleanName('<b>곰</b>ㅤ', 10), 'b곰/b');
  assert.equal(cleanText('ㅤㅤ', 10), '');
});

test('impersonates: 운영자 흉내 이름', () => {
  for (const n of ['운영자', '운 영 자', '젤리게임즈 공식', 'ADMIN', 'Adm1n', 'GM곰', '관리자★', 'jelly games', 'ⓐdmin', 'оperator']) assert.ok(impersonates(n), n);
  for (const n of ['곰돌이', '달리는젤리', '젤리러버', 'gummy', '김민수', 'badminton', 'gmail곰', '공식적인곰돌이 아님x', 'systematic곰'.slice(0, 3)]) assert.equal(impersonates(n), false, n);
});

test('publicError: 내부 오류 · 경로 · 키는 감추고 우리 문구 · 코드만', () => {
  assert.equal(publicError('login'), 'login');
  assert.equal(publicError('글이 없어요'), '글이 없어요');
  assert.equal(publicError('too large'), '보낸 내용이 너무 커요');
  assert.doesNotMatch(publicError("Cannot read properties of undefined (reading 'x')"), /undefined/);
  assert.doesNotMatch(publicError('ENOENT: no such file, open /app/data/world.json'), /app|ENOENT/);
  assert.doesNotMatch(publicError('오류 sk-abcdefghijklmnop1234 · OPENAI_API_KEY'), /sk-abc|OPENAI_API_KEY/);
  assert.doesNotMatch(publicError('버스 오류 serviceKey=abc%2Fdef&x=1'), /abc%2F/);
});

test('originOk: 같은 호스트 · 운영 · 토스 · 로컬만', () => {
  assert.ok(originOk('https://jelly-city.fly.dev', 'jelly-city.fly.dev'));
  assert.ok(originOk('https://my.domain.kr', 'my.domain.kr'));
  assert.ok(originOk('https://x.apps.tossmini.com', 'jelly-city.fly.dev'));
  assert.ok(originOk('http://localhost:5173', 'jelly-city.fly.dev'));
  assert.ok(originOk(undefined, 'a'));
  for (const o of ['https://evil.com', 'https://jelly-city.fly.dev.evil.com', 'http://tossmini.com.evil.io', 'null', 'http://x.toss.im']) assert.equal(originOk(o, 'jelly-city.fly.dev'), false, o);
});
test('wsShapeOk · specOk', () => {
  assert.ok(wsShapeOk({ t: 'st', p: [1, 2, 3] }));
  assert.equal(wsShapeOk({ t: 'st', p: [Infinity] }), false);
  assert.equal(wsShapeOk({ t: '1x' }), false);
  assert.equal(wsShapeOk(JSON.parse('{"t":"a","__proto__":1}')), false);
  assert.ok(specOk({ t: 'chat', s: 'hi' }, ROOM_SPECS));
  assert.equal(specOk({ t: 'chat', s: { a: 1 } }, ROOM_SPECS), false);
  assert.equal(specOk({ t: 'st', p: Array(40).fill(1) }, ROOM_SPECS), false);
});
test('4-3 핑에 답이 없거나 첫 메시지가 없거나 오래 조용하면 끊는다', () => {
  const g = new WsGuard({ pingMs: 1e9 }); clearInterval(g.timer);
  const fake = () => { const w = { ev: {}, on(e, f) { (this.ev[e] ||= []).push(f); }, once(e, f) { this.on(e, f); }, emit() { return true; }, ping() { this.pinged = (this.pinged || 0) + 1; }, terminate() { this.dead = 'terminate'; }, close(c) { this.dead = c; }, readyState: 1 }; return w; };
  const req = { headers: {}, socket: { remoteAddress: '1.2.3.4' } };
  const a = fake(), b = fake(), c = fake();
  g.attach(a, req, '/x'); g.attach(b, req, '/x'); g.attach(c, req, '/x', { idleMs: 1000 });
  const t0 = Date.now();
  a.emit('message', Buffer.from('{"t":"hello"}')); c.emit('message', Buffer.from('{"t":"hello"}'));
  g.beat(t0 + 10); assert.equal(a.pinged, 1); assert.equal(a.dead, undefined);
  g.beat(t0 + 20); assert.equal(a.dead, 'terminate'); // 핑에 답(pong)이 없었다
  g.beat(t0 + 61000 + 30); assert.equal(b.dead === 4001 || b.dead === 'terminate', true);
  const d = fake(); g.attach(d, req, '/x', { idleMs: 1000 }); d.emit('message', Buffer.from('{"t":"hello"}')); d.ev.pong.forEach((f) => f());
  g.beat(Date.now() + 2000); assert.equal(d.dead, 4002);
});
