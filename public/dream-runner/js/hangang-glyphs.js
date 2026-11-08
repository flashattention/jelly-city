// 간판 글씨: 글자 그림 한 장(2048 × 2048, 한 칸 48px)에 글자마다 한 번만 그려 두고, 간판은 글자 조각들로 만든다
//   예전처럼 간판마다 글씨 그림을 그리면 한 칸 1,800개가 한계였다 (그림 메모리). 이제 서울 전체 진짜 가게 간판을 모두 단다
import * as THREE from 'three';

const SIZE = 2048, CELL = 48, COLS = Math.floor(SIZE / CELL);
let atlas = null;
function getAtlas() {
  if (atlas) return atlas;
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(SIZE, SIZE);
  cv.width = cv.height = SIZE;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  atlas = { cv, c, tex, map: new Map(), n: 0, dirty: false };
  return atlas;
}
// 글자 하나의 그림 자리 (u0, v0, u1, v1, 폭 비율). 칸이 다 차면 null
export function glyph(ch) {
  const A = getAtlas();
  let g = A.map.get(ch);
  if (g !== undefined) return g;
  if (A.n >= COLS * COLS) { A.map.set(ch, null); return null; }
  const i = A.n++, x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL, c = A.c;
  c.font = `bold ${CELL - 10}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffffff';
  c.fillText(ch, x + CELL / 2, y + CELL / 2 + 2);
  const w = Math.min(1, Math.max(0.35, c.measureText(ch).width / (CELL - 8)));
  g = { u0: x / SIZE, u1: (x + CELL) / SIZE, v1: 1 - y / SIZE, v0: 1 - (y + CELL) / SIZE, w };
  A.map.set(ch, g);
  A.dirty = true;
  return g;
}
export function glyphTex() {
  const A = getAtlas();
  if (A.dirty) { A.tex.needsUpdate = true; A.dirty = false; }
  return A.tex;
}
// 밤에 간판 바탕 · 글씨가 제 색으로 빛나게: 빛(emissive)에 꼭짓점 색을 곱한다
export function signMaterial(withMap) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.15, side: THREE.DoubleSide, ...(withMap ? { map: glyphTex(), alphaTest: 0.35, transparent: false } : {}) });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor;'); };
  m.customProgramCacheKey = () => (withMap ? 'signG' : 'signB');
  return m;
}
