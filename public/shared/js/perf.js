// 휴대폰 성능: 해상도를 낮춰 시작하고, 느리면 더 낮추고, 여유가 생기면 되돌린다 (PC 는 그대로)
export const isPhone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const STEPS = [1.5, 1.25, 1, 0.85];
export function autoRes(renderer, pcMax = 2) {
  const dpr = devicePixelRatio || 1;
  if (!isPhone) { renderer.setPixelRatio(Math.min(pcMax, dpr)); return; }
  const levels = STEPS.filter((v) => v < dpr).length ? [...new Set(STEPS.map((v) => Math.min(v, dpr)))] : [dpr];
  let i = 0, sum = 0, n = 0, last = performance.now(), goodT = 0, ups = 0;
  renderer.setPixelRatio(levels[0]);
  const loop = (now) => {
    requestAnimationFrame(loop);
    const ms = now - last; last = now;
    if (ms > 250) { sum = 0; n = 0; return; } // 탭을 내렸다 돌아옴
    sum += ms; n++;
    if (sum < 1500) return;
    const avg = sum / n; sum = 0; n = 0;
    if (avg > 24 && i < levels.length - 1) { renderer.setPixelRatio(levels[++i]); goodT = 0; return; }
    // 다시 올리는 건 드물게: 오르내리며 화면이 흔들리지 않게
    goodT = avg < 18 ? goodT + 1 : 0;
    if (goodT >= 8 && i > 0 && ups < 2) { renderer.setPixelRatio(levels[--i]); goodT = 0; ups++; }
  };
  requestAnimationFrame(loop);
}
