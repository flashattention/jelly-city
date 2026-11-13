// 공격 시나리오 시험: 임시 데이터 폴더로 띄운 로컬 서버에만 보낸다
//   node --test server/security.test.mjs
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
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
