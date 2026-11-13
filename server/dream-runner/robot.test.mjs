// 사람 같지 않은 입력 · 기록 간격 찾기 시험: node --test server/dream-runner/robot.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { inputRobotic } from './leaderboard.js';
import { robotic } from '../shared/records.js';

// dts: 프레임 시간(0.1ms) · evs: [프레임, 입력 비트]
const replay = (gapsMs) => {
  const dts = [], evs = []; let f = 0;
  for (const g of gapsMs) { const n = Math.max(2, Math.round(g / 16.6)); for (let i = 0; i < n; i++) dts.push(Math.round((g / n) * 10)); evs.push([f, 1], [f + 1, 0]); f += n; }
  return { dts, evs };
};
test('기계처럼 일정한 누름 간격은 찾는다', () => {
  assert.match(inputRobotic(replay(Array(40).fill(500))) || '', /even-gaps/);
});
test('사람처럼 흔들리는 간격은 그냥 둔다', () => {
  let x = 1; const rnd = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  assert.equal(inputRobotic(replay(Array.from({ length: 60 }, () => 300 + rnd() * 400))), null);
  assert.equal(inputRobotic(replay(Array(10).fill(500))), null, '누름이 적으면 판단하지 않는다');
});
test('기록을 기계처럼 같은 간격으로 계속 남기면 찾는다', () => {
  assert.ok(robotic([0, 10000, 20000, 30000, 40000, 50000]));
  assert.equal(robotic([0, 9000, 21000, 30500, 41000, 49000]), false);
  assert.equal(robotic([0, 1, 2]), false);
});
