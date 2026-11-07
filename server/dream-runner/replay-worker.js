// 드림 러너 기록 다시 돌리기 (별도 스레드라 다른 플레이어에게 렉이 없다)
//   브라우저와 같은 Runner · Track 코드로, 받은 프레임 시간과 입력만 가지고 처음부터 다시 달려 본다
import { parentPort } from 'node:worker_threads';

// 화면 없이 돌리려고 브라우저 것을 흉내 낸다 (그림은 쓰지 않는다)
const ctx = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx, addEventListener() {} }), head: { append() {} }, body: { append() {} } };
globalThis.window ??= globalThis; globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.addEventListener ??= () => {};

const THREE = await import('three');
const { Track } = await import('../../public/dream-runner/js/track.js');
const { Runner, BOOST } = await import('../../public/dream-runner/js/runner.js');
const { DIFFS, diffOf } = await import('../../public/dream-runner/js/diff.js');

const bear = { inner: { rotation: { set() {} } }, root: { scale: { setScalar() {} }, visible: true } };
const scene = new THREE.Scene();
function replay({ seed, diff, map, dts, evs }) {
  const k = DIFFS[diffOf(diff)].k, r = Object.create(Runner.prototype); r.bear = bear; r.shadow = { visible: true }; r.reset(0, 0); r.speedK = k; r.multi = false;
  const t = new Track(scene, null, seed); t.reset(seed, false, { map: map === 'hell' || map === 'void' ? map : 'dream', K: k * (1 + BOOST) });
  const input = { dir: 0, jump: false, slide: false, slideHeld: false }; let T = 0, ei = 0; t.update(0, 0, 0, 0);
  let i = 0;
  for (; i < dts.length; i++) {
    while (ei < evs.length && evs[ei][0] === i) { const b = evs[ei][1]; input.dir = (b & 3) - 1; input.jump = !!(b & 4); input.slide = !!(b & 8); input.slideHeld = !!(b & 16); ei++; }
    const jumpBit = input.jump, slideBit = input.slide, dt = dts[i] / 10000; T += dt;
    const steps = Math.min(16, Math.max(1, Math.ceil(r.v * dt / 0.6))); let why = null;
    for (let j = 0; j < steps && !why; j++) { r.substep = j; why = r.update(dt / steps, input, t); input.jump = input.slide = false; }
    r.substep = 0;
    if (why) { const out = { dead: true, why, dist: Math.floor(r.s), stars: r.stars, time: T, frames: i + 1, dreams: t.dreamAt(r.s) + 1 }; t.root.removeFromParent(); return out; }
    t.update(T, r.s, r.v, dt); t.generate(r.s);
    void jumpBit; void slideBit;
  }
  const out = { dead: false, dist: Math.floor(r.s), stars: r.stars, time: T, frames: i, dreams: t.dreamAt(r.s) + 1 }; t.root.removeFromParent(); return out;
}
parentPort.on('message', (m) => { try { parentPort.postMessage({ id: m.id, ...replay(m) }); } catch (e) { parentPort.postMessage({ id: m.id, error: String(e?.message || e) }); } });
parentPort.postMessage({ ready: true });
