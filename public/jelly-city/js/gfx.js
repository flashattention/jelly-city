// 그래픽 품질 (상 · 중 · 하) — 컴퓨터 사양을 보고 자동으로 고르고, 실제로 느리면 한 단계씩 낮춘다
import { settings, saveSettings } from '../../shared/js/settings.js';

// pixelRatio: 화면 해상도 배율 상한 · shadowMap: 그림자 지도 크기(0 = 그림자 끔)
// citizens / animals: 시민 · 동물을 그리는 거리 · lod: 시민을 간단한 모양으로 바꾸는 거리 · wild: 숲 · 산 소품을 그리는 거리
export const GFX = {
  high: { label: '상', pixelRatio: 2, antialias: true, shadowMap: 2048, softShadow: true, citizens: 130, animals: 220, lod: 38, wild: 650,
    rec: '맥북 M1 이상 · 외장 그래픽(지포스 GTX 1060 · 라데온 RX 580 이상) 데스크톱 · 게이밍 노트북',
    desc: '선명한 화면(최대 2배) · 부드러운 그림자 · 계단 현상 없애기 · 멀리 있는 시민 · 동물까지' },
  mid: { label: '중', pixelRatio: 1, antialias: true, shadowMap: 1024, softShadow: false, citizens: 100, animals: 170, lod: 28, wild: 450,
    rec: '내장 그래픽 미니PC · 노트북(라데온 680M · 780M, 인텔 Iris Xe · Arc), 아이패드',
    desc: '보통 화면(1배) · 단순한 그림자 · 보이는 거리 조금 짧게' },
  low: { label: '하', pixelRatio: 0.75, antialias: false, shadowMap: 0, softShadow: false, citizens: 75, animals: 130, lod: 20, wild: 340,
    rec: '인텔 UHD(N100 · 셀러론 등) · 오래된 노트북 · 저가 태블릿 · 휴대폰',
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

// 사양으로 처음 단계를 고른다
export function detectLevel(gpu = gpuName()) {
  const g = gpu.toLowerCase();
  const mobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.platform) && !/mac os x/i.test(navigator.userAgent));
  let lv;
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(g)) lv = 'low';
  else if (/mali|adreno|powervr|videocore/.test(g)) lv = 'low';
  else if (/nvidia|geforce|rtx|gtx|quadro/.test(g)) lv = 'high';
  else if (/radeon.*\b(rx|pro|vega \d{2})|\brx ?\d{3,4}/.test(g)) lv = 'high'; // 라데온 외장
  else if (/arc.*\ba\d{3}/.test(g)) lv = 'high'; // 인텔 Arc 외장(A380 · A770 …)
  else if (/apple/.test(g)) lv = mobile ? 'mid' : 'high'; // 맥 M 시리즈
  else if (/radeon|amd/.test(g)) lv = 'mid'; // 라데온 내장(780M · Radeon Graphics)
  else if (/iris|arc/.test(g)) lv = 'mid'; // 인텔 Iris Xe · Arc 내장
  else if (/intel/.test(g)) lv = 'low'; // 인텔 UHD · HD (N100 · 셀러론 …)
  else lv = 'mid'; // 모르면 중간
  // CPU 코어 · 메모리가 적으면 한 단계 낮게
  if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) lv = down(lv);
  if (mobile) lv = lower(lv, 'mid');
  return lv;
}

// 지금 쓰는 단계 (auto 면 사양 + 실제 느렸던 기록)
export function gfxLevel() {
  if (GFX[settings.gfx]) return settings.gfx;
  const gpu = gpuName();
  if (settings.gfxAuto?.gpu !== gpu) { settings.gfxAuto = { gpu, level: detectLevel(gpu) }; saveSettings(); }
  return settings.gfxAuto.level;
}
export const gfx = () => GFX[gfxLevel()];

// 자동일 때: 6초 평균이 32fps 아래면 한 단계 낮춘다 (불러온 직후 10초 · 다른 탭에 있을 때는 재지 않는다)
export function watchFps(onDrop) {
  let frames = 0, t0 = 0, skipUntil = performance.now() + 10000;
  document.addEventListener('visibilitychange', () => { skipUntil = performance.now() + 3000; frames = 0; t0 = 0; });
  return () => {
    const now = performance.now();
    if (now < skipUntil || settings.gfx !== 'auto' || document.hidden) { frames = 0; t0 = 0; return; }
    if (!t0) t0 = now;
    frames++;
    if (now - t0 < 6000) return;
    const fps = (frames * 1000) / (now - t0);
    frames = 0; t0 = now;
    const cur = gfxLevel();
    if (fps < 32 && cur !== 'low') {
      settings.gfxAuto.level = down(cur); saveSettings();
      skipUntil = now + 8000;
      onDrop(settings.gfxAuto.level, fps);
    }
  };
}
