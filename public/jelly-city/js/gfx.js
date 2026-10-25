// 그래픽 품질 (상 · 중 · 하) — 컴퓨터 사양을 보고 자동으로 고르고, 실제로 느리면 한 단계씩 낮춘다
import { settings, saveSettings } from '../../shared/js/settings.js';

// pixelRatio: 화면 해상도 배율 상한 · shadowMap: 그림자 지도 크기(0 = 그림자 끔)
// citizens / animals: 시민 · 동물을 그리는 거리 · lod: 시민을 간단한 모양으로 바꾸는 거리 · wild: 숲 · 산 소품을 그리는 거리
export const GFX = {
  high: { label: '상', pixelRatio: 2, antialias: true, shadowMap: 2048, softShadow: true, citizens: 130, animals: 220, lod: 38, wild: 650,
    rec: '맥북 M1 이상 · 외장 그래픽(지포스 GTX 1060 · 라데온 RX 580 이상) 데스크톱 · 게이밍 노트북',
    desc: '선명한 화면(최대 2배) · 부드러운 그림자 · 계단 현상 없애기 · 멀리 있는 시민 · 동물까지' },
  mid: { label: '중', pixelRatio: 1, antialias: true, shadowMap: 1024, softShadow: false, citizens: 100, animals: 170, lod: 28, wild: 450,
    rec: '내장 그래픽 미니PC · 노트북(라데온 680M · 780M, 인텔 Iris Xe · Arc · UHD), 아이패드 — 사양이 낮아도 기본은 중이에요',
    desc: '보통 화면(1배) · 단순한 그림자 · 보이는 거리 조금 짧게' },
  low: { label: '하', pixelRatio: 0.75, antialias: false, shadowMap: 0, softShadow: false, citizens: 75, animals: 130, lod: 20, wild: 340,
    rec: '추천하지 않아요 · 중에서도 렉이 심할 때만 (인텔 N100 · 셀러론 · 오래된 노트북 · 저가 태블릿 · 휴대폰)',
    desc: '낮은 해상도(0.75배) · 그림자 끔 · 계단 현상 없애기 끔 · 보이는 거리 짧게' },
};
export const LEVELS = ['low', 'mid', 'high'];
const down = (lv) => LEVELS[Math.max(0, LEVELS.indexOf(lv) - 1)];
const lower = (a, b) => (LEVELS.indexOf(a) < LEVELS.indexOf(b) ? a : b);

// 그래픽 카드 이름 (브라우저가 알려 줄 때만) — 처음 한 번만 잰다
let gpuCache = null;
export function gpuName() {
  if (gpuCache === null) gpuCache = readGpu();
  return gpuCache;
}
function readGpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(name || '');
  } catch { return ''; }
}

const isMobile = () => /android|iphone|ipad|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.platform) && !/mac os x/i.test(navigator.userAgent));

// 사양으로 처음 단계를 고른다 (왜 그 단계인지 이유도 함께)
export function explainLevel(gpu = gpuName()) {
  const g = gpu.toLowerCase();
  const mobile = isMobile();
  const why = [];
  let lv;
  if (!g) { lv = 'mid'; why.push('브라우저가 그래픽 카드 이름을 알려 주지 않아서 중간(중)으로 시작'); }
  else if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(g)) { lv = 'low'; why.push('그래픽 가속이 꺼져 있어 CPU로 그리고 있음 → 하 (크롬 설정 → 시스템 → 그래픽 가속 사용을 켜 보세요)'); }
  else if (/mali|adreno|powervr|videocore/.test(g)) { lv = 'low'; why.push('휴대폰 · 태블릿용 그래픽 → 하'); }
  else if (/nvidia|geforce|rtx|gtx|quadro/.test(g)) { lv = 'high'; why.push('엔비디아 외장 그래픽 → 상'); }
  else if (/radeon.*\b(rx|pro|vega \d{2})|\brx ?\d{3,4}/.test(g)) { lv = 'high'; why.push('라데온 외장 그래픽 → 상'); }
  else if (/arc.*\ba\d{3}/.test(g)) { lv = 'high'; why.push('인텔 Arc 외장 그래픽 → 상'); }
  else if (/apple/.test(g)) { lv = mobile ? 'mid' : 'high'; why.push(mobile ? '아이패드 · 아이폰의 애플 그래픽 → 중' : '맥 애플 실리콘(M 시리즈) 그래픽 → 상'); }
  else if (/radeon|amd/.test(g)) { lv = 'mid'; why.push('AMD 라데온 내장 그래픽(680M · 780M 등) → 중'); }
  else if (/iris|arc/.test(g)) { lv = 'mid'; why.push('인텔 Iris Xe · Arc 내장 그래픽 → 중'); }
  else if (/intel/.test(g)) { lv = 'low'; why.push('인텔 UHD · HD 내장 그래픽(N100 · 셀러론 등) → 하'); }
  else { lv = 'mid'; why.push('잘 모르는 그래픽 카드라서 중간(중)으로 시작'); }
  // CPU 코어 · 메모리가 적으면 한 단계 낮게
  const cores = navigator.hardwareConcurrency || 0, mem = navigator.deviceMemory || 0;
  if ((cores && cores <= 4) || (mem && mem <= 4)) {
    const to = down(lv);
    if (to !== lv) why.push(`${cores && cores <= 4 ? `CPU 코어가 ${cores}개뿐` : `메모리가 ${mem}GB 이하`}이라 한 단계 낮춤 → ${GFX[to].label}`);
    lv = to;
  }
  if (mobile && lv === 'high') { lv = 'mid'; why.push('휴대 기기라 최대 중'); }
  // 원만한 플레이를 위해 자동은 '중' 아래로 내리지 않는다. 사양이 낮으면 렉이 심할 때 '하'를 권한다
  const lowSpec = lv === 'low';
  if (lowSpec) { lv = 'mid'; why.push("화면이 너무 거칠어지지 않게 자동은 '중'부터 시작해요 · 렉이 심하면 '하'가 맞을 수도 있어요"); }
  return { level: lv, why, lowSpec };
}
export const detectLevel = (gpu) => explainLevel(gpu).level;

// 이 컴퓨터 사양 (브라우저가 알려 주는 만큼)
export function specInfo() {
  const dpr = window.devicePixelRatio || 1;
  return {
    gpu: gpuName() || '알 수 없음',
    cores: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency}개` : '알 수 없음',
    memory: navigator.deviceMemory ? `${navigator.deviceMemory >= 8 ? '8GB 이상' : `${navigator.deviceMemory}GB`}` : '알 수 없음 (크롬 · 엣지만 알려 줘요)',
    screen: `${Math.round(window.innerWidth * dpr)} × ${Math.round(window.innerHeight * dpr)} (배율 ${+dpr.toFixed(2)})`,
    mobile: isMobile(),
  };
}

// 지금 쓰는 단계 (auto 면 사양 + 실제 느렸던 기록)
export function gfxLevel() {
  if (GFX[settings.gfx]) return settings.gfx;
  const gpu = gpuName();
  if (settings.gfxAuto?.gpu !== gpu) { settings.gfxAuto = { gpu, level: detectLevel(gpu) }; saveSettings(); }
  if (settings.gfxAuto.level === 'low') { settings.gfxAuto.level = 'mid'; saveSettings(); } // 예전에 자동으로 '하'가 됐던 기록
  return settings.gfxAuto.level;
}
export const gfx = () => GFX[gfxLevel()];

// 6초 평균이 32fps 아래면: 자동 '상'은 '중'으로 낮추고(onDrop), '중' 이상인데도 느리면 '하'를 권한다(onSlow, 한 번만)
// 불러온 직후 10초 · 다른 탭에 있을 때는 재지 않는다
export function watchFps(onDrop, onSlow) {
  let frames = 0, t0 = 0, skipUntil = performance.now() + 10000, suggested = false;
  document.addEventListener('visibilitychange', () => { skipUntil = performance.now() + 3000; frames = 0; t0 = 0; });
  return () => {
    const now = performance.now();
    if (now < skipUntil || document.hidden) { frames = 0; t0 = 0; return; }
    if (!t0) t0 = now;
    frames++;
    if (now - t0 < 6000) return;
    const fps = (frames * 1000) / (now - t0);
    frames = 0; t0 = now;
    if (fps >= 32) return;
    const cur = gfxLevel();
    if (settings.gfx === 'auto' && cur === 'high') {
      settings.gfxAuto.level = 'mid';
      settings.gfxAuto.drops = [...(settings.gfxAuto.drops || []), { from: cur, to: 'mid', fps: Math.round(fps) }];
      saveSettings();
      skipUntil = now + 8000;
      onDrop('mid', fps);
    } else if (cur !== 'low' && !suggested) {
      suggested = true;
      onSlow(fps);
    }
  };
}
