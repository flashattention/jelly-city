// 게시판 시험 (AI 검사는 가짜로): node --test server/board.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Board, boardApi } from './board.js';
import { spamCheck } from './shared/guard.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jelly-board-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
// 가짜 요청 · 응답
const call = async (board, who, p, body, { ip = '1.1.1.1', method = 'POST', check = async () => ({ ok: true }), admin = false } = {}) => {
  const req = Readable.from(method === 'POST' ? [Buffer.from(JSON.stringify(body))] : []); req.method = method; req.headers = { 'fly-client-ip': ip }; req.socket = { remoteAddress: ip }; req.url = p;
  const url = new URL('http://x' + p); let out;
  await boardApi(req, {}, url, who, board, (res, code, obj) => { out = { code, obj }; }, () => admin, check);
  return out;
};
const OLD = Date.now() - 10 * 864e5;
const user = (n, extra = {}) => ({ sub: `g:${n}`, user: { nick: `곰${n}`, created: OLD, ...extra } });

test('정상 플레이: 글 · 댓글 · 좋아요 (AI 검사 통과)', async () => {
  const B = new Board(dir);
  const w = await call(B, user(1), '/api/board/write', { title: '버그 제보', body: '드림 러너에서 가끔 멈춰요' });
  assert.equal(w.code, 200);
  const c = await call(B, user(2), '/api/board/comment', { id: w.obj.id, text: '저도 그래요' });
  assert.equal(c.code, 200); assert.equal(c.obj.comments.length, 1);
  assert.equal((await call(B, user(2), '/api/board/vote', { id: w.obj.id, v: 1 })).obj.up, 1);
});

test('8-3 도배: 같은 글 되풀이 · 여러 계정이 같은 글 · 연락처 · 광고 · 새 계정 링크', async () => {
  const B = new Board(dir), now = Date.now();
  const w = await call(B, user(10), '/api/board/write', { title: '공지', body: '오늘 이벤트 같이 해요 여러분' });
  assert.equal(w.code, 200);
  for (const n of [11, 12]) await call(B, user(n), '/api/board/comment', { id: w.obj.id, text: '무료 다이아 받는 법 알려드림' });
  assert.match((await call(B, user(13), '/api/board/comment', { id: w.obj.id, text: '좋아요 좋아요 같이해요' })).obj.error || '', /^$/);
  // 같은 글 세 번째 계정
  B.lastComment.clear();
  const spam = ['ㅋㅋ 이 게임 진짜 꿀잼 강추합니다', 'ㅋㅋ 이 게임 진짜 꿀잼 강추합니다!!', 'ㅋㅋ이게임진짜꿀잼강추합니다'];
  const r = []; for (const [i, t] of spam.entries()) { r.push((await call(B, user(20 + i), '/api/board/comment', { id: w.obj.id, text: t })).code); }
  assert.deepEqual(r, [200, 200, 400], '세 번째 계정의 같은 글은 막힌다');
  assert.match(spamCheck('g:x', '연락주세요 010-1234-5678', { now }) || '', /연락처/);
  assert.match(spamCheck('g:x', '카톡 아이디 jelly123', { now }) || '', /연락처/);
  assert.match(spamCheck('g:x', '계정 팝니다 싸게', { now }) || '', /광고/);
  assert.match(spamCheck('g:x', '여기 와 보세요 https://evil.example', { now, strict: true }) || '', /링크/);
  assert.equal(spamCheck('g:y', '유튜브 영상 https://youtu.be/x 참고하세요', { now }), null, '오래된 계정은 링크 가능 (AI 검사가 본다)');
  // 체험판은 1분에 한 번
  const g = { sub: 'guest:1', user: { guest: true, name: '체험판 손님 1234', created: now } };
  assert.equal((await call(B, g, '/api/board/write', { title: '안녕', body: '처음 왔어요 반가워요' })).code, 200);
  B.lastPost.set('guest:1', Date.now() - 40000);
  assert.match((await call(B, g, '/api/board/write', { title: '또', body: '두 번째 글입니다 반가워요' })).obj.error, /1분/);
});

test('8-2 보이지 않는 글자 · 방향 바꾸기 글자는 걷어 낸다', async () => {
  const B = new Board(dir);
  const w = await call(B, user(30), '/api/board/write', { title: '제​목‮', body: '본⁦문‍입니다 반가워요' });
  const p = B.find(w.obj.id); assert.equal(p.title, '제목'); assert.equal(p.body, '본문입니다 반가워요');
});

test('8-4 신고: 5점이면 가림 · 같은 곳(IP)에서 계정 여러 개로 신고하면 한 번만 센다', async () => {
  const B = new Board(dir);
  const w = await call(B, user(40), '/api/board/write', { title: '평범한 글', body: '평범한 내용이에요 여러분' });
  for (let i = 0; i < 10; i++) await call(B, { sub: `guest:r${i}`, user: { guest: true, created: Date.now() } }, '/api/board/report', { id: w.obj.id, why: 'spam' }, { ip: '9.9.9.9' });
  assert.equal(B.find(w.obj.id).hidden, undefined, '한 곳에서 10번 = 0.5점');
  for (let i = 0; i < 5; i++) await call(B, user(50 + i), '/api/board/report', { id: w.obj.id, why: 'abuse' }, { ip: `8.8.8.${i}` });
  assert.equal(B.find(w.obj.id).hidden, true, '서로 다른 5곳 = 가림');
  const d = B.detail(w.obj.id, 'g:999', true); assert.ok(d.reps.length >= 5, '관리자는 사유를 본다');
  assert.ok(!JSON.stringify(d).includes('9.9.9.9'), '원래 IP 는 없다');
});
