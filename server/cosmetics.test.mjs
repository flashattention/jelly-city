// 별 · 출석 · 혼자 하기 끝 알림 시험: node --test server/cosmetics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Cosmetics } from './cosmetics.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jelly-cos-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('6-3 혼자 하기: 시작 없이 끝 · 30초 안 끝 · 하루 상한', () => {
  const c = new Cosmetics(dir), sub = 'anon:0123456789abcdef';
  assert.equal(c.soloEnd(sub, 'jelly-arcade', true), false, '시작 없음');
  c.soloStart(sub, 'jelly-arcade'); assert.equal(c.soloEnd(sub, 'jelly-arcade', true), false, '30초 안');
  let ok = 0;
  for (let i = 0; i < 200; i++) { c.soloStart(sub, 'jelly-arcade'); c.u(sub).solo.at -= 60e3; if (c.soloEnd(sub, 'jelly-arcade', true)) ok++; }
  assert.equal(ok, 150, '하루 150판까지');
  assert.throws(() => c.soloStart(sub, 'jelly-ten'), /game/);
});
test('6-1 출석은 하루 한 번 · 뽑기권 없이는 뽑기 못 함 · 별이 모자라면 못 삼', () => {
  const c = new Cosmetics(dir), sub = 'g:1';
  c.attend(sub, Date.UTC(2026, 10, 13, 3));
  assert.throws(() => c.attend(sub, Date.UTC(2026, 10, 13, 5)), /이미/);
  assert.throws(() => c.gacha(sub), /뽑기권/);
  c.u(sub).stars = 0; assert.throws(() => c.buy(sub, 'nope'), /살 수 없는/);
});
