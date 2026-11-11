// 밤 창문 불빛: 집마다 · 창마다 다른 조명 (주광색 흰빛 · 전구색 노란빛 · 형광등 · TV 푸른 깜빡임 · 커튼 너머 은은함)
//   켜진 창 그림(emissiveMap)은 창 모양만 하얗게 그리고, 색 · 밝기 · 켜짐은 셰이더가 창마다 정한다.
//   건물마다 꼭짓점에 [씨앗, 조명 종류, 연대] 를 적어 두어(aWin) 그리기 호출은 그대로다.
//   같은 창은 늘 같고(씨앗 고정), 시간이 흐르면 종류별 켜진 비율(WIN_U.uOn)이 줄어 창이 하나씩 꺼진다.
import * as THREE from 'three';

// 조명 종류 (aWin.y)
export const WP = { apt: 0, house: 1, office: 2, shop: 3, hotel: 4, hospital: 5, school: 6, church: 7, academy: 8, bar: 9, cafe: 10 };

// 모든 칸이 같은 값을 쓴다 (밤 처리에서 한 번 계산)
export const WIN_U = { uOn: { value: new Array(12).fill(0) }, uWinT: { value: 0 } };

// 시간대별 켜진 비율 (시각, 비율) — 하루를 돌아 이어진다
const CURVE = {
  // 아파트: 저녁 7 ~ 10시 가장 많고 11시부터 하나씩 꺼져 새벽 2 ~ 4시엔 거의 없다, 5시 반부터 일찍 일어난 집
  [WP.apt]: [[4, 0.04], [5.3, 0.07], [6.2, 0.26], [7.5, 0.3], [9, 0.12], [16.5, 0.12], [18, 0.45], [19.5, 0.68], [21.5, 0.7], [22.5, 0.62], [23.5, 0.44], [0.5, 0.26], [1.5, 0.13], [2.5, 0.07]],
  [WP.house]: [[4, 0.03], [5.3, 0.06], [6.2, 0.22], [7.5, 0.26], [9, 0.1], [16.5, 0.12], [18, 0.4], [19.5, 0.62], [21.5, 0.62], [22.5, 0.5], [23.5, 0.32], [0.5, 0.18], [1.5, 0.09], [2.5, 0.05]],
  // 회사: 층 단위. 퇴근 뒤 듬성듬성, 밤 11시엔 야근 층 몇 개
  [WP.office]: [[5, 0.04], [7, 0.25], [8.5, 0.85], [17.5, 0.9], [18.5, 0.75], [19.5, 0.56], [20.5, 0.43], [21.5, 0.33], [22.5, 0.2], [23.5, 0.12], [1, 0.06]],
  // 식당 · 카페 · 가게: 자정 무렵까지
  [WP.shop]: [[3, 0.06], [6, 0.1], [8, 0.45], [10, 0.85], [21, 0.88], [22, 0.75], [23, 0.55], [0, 0.32], [1, 0.18]],
  [WP.hotel]: [[4, 0.1], [6.5, 0.22], [8, 0.3], [17, 0.35], [19, 0.5], [21, 0.62], [23, 0.5], [0.5, 0.32], [2, 0.18]],
  // 병원: 밤새 병동 일부
  [WP.hospital]: [[3, 0.32], [6, 0.38], [9, 0.8], [18, 0.75], [20, 0.6], [22, 0.45], [0, 0.36]],
  [WP.school]: [[5, 0.03], [7.5, 0.3], [9, 0.75], [16, 0.75], [17.5, 0.42], [19, 0.24], [21, 0.12], [22.5, 0.05]],
  // 교회: 저녁 예배 · 새벽기도(4시 반 ~ 6시)
  [WP.church]: [[3.8, 0.05], [4.4, 0.55], [5.8, 0.55], [6.8, 0.12], [18, 0.25], [19.3, 0.65], [21.3, 0.55], [22.3, 0.2], [23.5, 0.06]],
  // 학원: 밤 10시에 일제히 꺼진다
  [WP.academy]: [[7, 0.05], [14, 0.6], [16, 0.9], [21.8, 0.88], [22.2, 0.35], [22.6, 0.08], [23.5, 0.02], [5, 0.02]],
  // 술집 · 노래방: 새벽 2 ~ 3시까지
  [WP.bar]: [[5, 0.08], [7, 0.02], [16, 0.15], [19, 0.6], [21, 0.85], [0, 0.9], [1.5, 0.75], [3, 0.4], [4, 0.2]],
  [WP.cafe]: [[3, 0.05], [8, 0.4], [10, 0.85], [21, 0.85], [22, 0.6], [23, 0.35], [0, 0.18], [1, 0.08]],
};
for (const k of Object.keys(CURVE)) CURVE[k].sort((a, b) => a[0] - b[0]);
function curveAt(c, h) {
  const n = c.length;
  for (let i = 0; i < n; i++) {
    const a = c[i], b = c[(i + 1) % n], ha = a[0], hb = b[0] + (i + 1 === n ? 24 : 0), hh = h < ha ? h + 24 : h;
    if (hh >= ha && hh <= hb) return a[1] + (b[1] - a[1]) * ((hh - ha) / (hb - ha || 1));
  }
  return c[0][1];
}
export function tickWindows(hour, t) {
  const o = WIN_U.uOn.value;
  for (const [k, c] of Object.entries(CURVE)) o[+k] = curveAt(c, hour);
  WIN_U.uWinT.value = t % 1000;
}

// 건물 하나의 조명 종류: 외벽 종류 · 실제 용도(건축물대장 주용도 코드) · OSM 종류 · 높이로
//   용도: 1 단독 · 2 공동주택 · 3 · 4 근린생활 · 5 문화집회 · 6 종교 · 7 판매 · 8 운수 · 9 의료 · 10 교육연구 · 11 노유자 · 12 수련 · 13 운동 · 14 업무 · 15 숙박 · 16 위락 · 17 공장 · 18 창고
export function winProfile(type, info, kind, h) {
  const use = info ? info[0] : 0;
  if (type === 'hanok' || type === 'factory') return WP.cafe;
  if (type === 'church' || use === 6) return WP.church;
  if (use === 15) return WP.hotel;
  if (use === 9) return WP.hospital;
  if (use === 10 || use === 11 || use === 12 || use === 13 || use === 5 || use === 8 || kind === 5 || kind === 3) return WP.school;
  if (type === 'apt' || (use === 2 && h > 24)) return WP.apt;
  if (use === 1 || use === 2 || kind === 4 || kind === 1) return WP.house;
  if (type === 'street' || type === 'street2' || use === 3 || use === 4 || use === 7 || use === 16) return WP.shop;
  if (use === 14 || type === 'glass' || type === 'gold' || type === 'fins' || type === 'panels') return WP.office;
  return h < 20 ? WP.shop : WP.office;
}
// 연대: 0 = 1995년 이전 (형광등이 많다) · 1 = 2009년까지 · 2 = 그 뒤 (전구색 · 간접조명이 늘어난다)
export function winEra(info) { const y = info ? info[2] : 0; return !y ? 1 : y < 1995 ? 0 : y < 2010 ? 1 : 2; }
// 같은 건물은 늘 같은 씨앗 (바닥 첫 점 위치로)
export function winSeed(x, z) { const a = Math.imul(Math.round(x * 10) | 0, 73856093) ^ Math.imul(Math.round(z * 10) | 0, 19349663); return ((a >>> 0) % 100003) / 100003; }

const GLSL = /* glsl */`
uniform float uOn[12]; uniform float uWinT;
varying vec3 vWin;
float wh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 wh4(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
// 조명 색 (선형). 주광색 6500K · 옛 형광등 · 주백색 4000K · 전구색 2700K · TV
const vec3 W_COOL = vec3(0.62, 0.80, 1.00);
const vec3 W_FLUO = vec3(0.70, 1.00, 0.84);
const vec3 W_NEUT = vec3(1.00, 0.84, 0.60);
const vec3 W_WARM = vec3(1.00, 0.50, 0.17);
const vec3 W_TV = vec3(0.30, 0.46, 1.00);
vec3 homeLight(float hs, float era) {
  float pC = era < 0.5 ? 0.46 : era < 1.5 ? 0.42 : 0.28, pF = era < 0.5 ? 0.16 : era < 1.5 ? 0.05 : 0.0, pN = era < 1.5 ? 0.2 : 0.27;
  return hs < pC ? W_COOL : hs < pC + pF ? W_FLUO : hs < pC + pF + pN ? W_NEUT : W_WARM;
}
// 커튼: 가운데 틈만 밝고 양옆은 천 색으로 물들어 어둡게
vec3 curtain(vec3 c, float hc, float hg, vec2 f, float det) {
  vec3 tint = hc < 0.4 ? vec3(1.0, 0.82, 0.6) : hc < 0.7 ? vec3(1.0, 0.93, 0.86) : hc < 0.85 ? vec3(1.0, 0.7, 0.66) : vec3(0.8, 0.95, 0.78);
  float gap = 0.04 + 0.32 * hg, cur = smoothstep(gap, gap + 0.05, abs(f.x - 0.5));
  return c * mix(vec3(1.0), tint * 0.45, mix(0.45, cur, det));
}
vec3 winLight(vec2 g, vec2 fw, vec3 w) {
  vec2 cell = floor(g), f = fract(g);
  float px = max(fw.x, fw.y), det = 1.0 - smoothstep(0.05, 0.22, px);
  float seed = w.x, era = w.z; int prof = int(w.y + 0.5);
  vec2 sd = vec2(seed * 173.0, seed * 291.0);
  vec4 hh = wh4(cell + sd); float h1 = hh.x, h2 = hh.y, h3 = hh.z, h4 = hh.w, hb = fract(seed * 7.31);
  vec3 c = vec3(0.0);
  if (prof <= 1) {
    // 집: 아파트는 두 칸이 한 세대 (거실 + 방), 세대마다 쓰는 조명이 다르다
    bool apt = prof == 0; vec2 unit = apt ? vec2(floor(cell.x * 0.5), cell.y) : cell; bool liv = !apt || mod(cell.x, 2.0) < 1.0;
    vec2 hq = wh4(unit + sd + 3.1).xy; float hu = hq.x, hs = hq.y, on = uOn[prof];
    vec3 hc = homeLight(hs, era); float b = 0.6 + 0.6 * h2 * h2 + 0.15 * hu;
    if (hu < on) {
      if (liv) {
        if (h3 < 0.1) {
          // 거실 불은 끄고 TV 만: 푸른빛이 장면마다 바뀌며 깜빡인다
          float ph = h4 * 50.0, t = uWinT;
          float fl = 0.6 + 0.22 * sin(t * 3.1 + ph) * sin(t * 7.3 + ph * 1.7) + 0.25 * wh(vec2(floor(t * 0.8 + ph), ph));
          c = mix(W_TV, vec3(0.85, 0.85, 1.0), 0.35 * wh(vec2(floor(t * 0.5 + ph), 1.0))) * 0.32 * fl;
        } else c = hc * b;
      } else if (h1 < 0.62) c = (h4 < 0.5 ? W_WARM : hc) * b * 0.72;
    } else if (hu < on + 0.2 && h1 < 0.3) c = W_WARM * 0.09;
    if (h4 > 0.6 && h3 >= 0.1) c = curtain(c, h1, h3, f, det);
    // 천장 등: 창 위쪽이 조금 밝고, 아래는 가구 · 난간 그림자
    c *= mix(1.0, mix(0.72, 1.08, smoothstep(0.25, 0.75, f.y)), det);
  } else if (prof == 2 || prof == 5) {
    // 회사 · 병원: 층(사무실) 단위로 켜진다. 천장 등이라 위가 밝고, 블라인드 줄무늬
    float fh = wh(vec2(cell.y, seed * 311.0)), zone = wh(vec2(floor(cell.x / 6.0), cell.y) + sd + 5.0), on = uOn[prof];
    bool lit = fh < on ? (zone < 0.88 && h1 < 0.92) : h1 < on * 0.1;
    if (prof == 2 && cell.y < 1.0) lit = h1 < 0.75;
    vec3 oc = prof == 5 ? W_COOL : hb < 0.55 ? W_COOL : hb < 0.85 ? mix(W_COOL, W_NEUT, 0.45) : hb < 0.95 ? W_FLUO : W_NEUT;
    if (lit) c = oc * (0.8 + 0.35 * wh(vec2(cell.y, 3.0) + sd)) * (0.9 + 0.2 * h2) * (prof == 5 ? 0.8 : 1.0);
    // 꺼진 층도 새카맣지 않게: 복도 · 비상등 빛이 희미하게
    else if (h3 < 0.45) c = W_COOL * 0.045;
    if (wh(vec2(cell.y, 9.0) + sd) < 0.4) c *= mix(1.0, 0.65 + 0.35 * step(0.42, fract(f.y * 11.0)), det);
    c *= mix(1.0, mix(0.68, 1.12, smoothstep(0.1, 0.9, f.y)), det);
  } else if (prof == 3) {
    if (cell.y < 1.0) {
      // 1층 가게: 식당 · 카페는 노란빛, 편의점 · 약국은 하얀빛
      vec2 sid = vec2(floor(cell.x * 0.5), 0.0) + sd; float hs = wh(sid + 2.0);
      if (wh(sid) < uOn[3] * 1.05) c = (hs < 0.22 ? vec3(0.86, 0.95, 1.0) * 1.3 : hs < 0.72 ? W_WARM * 1.15 : W_NEUT * 1.1) * (0.85 + 0.3 * h2);
    } else {
      // 위층: 층마다 · 반 층마다 다른 가게 (학원 · 식당 · 술집 · 노래방 · 살림집)
      vec2 tid = vec2(floor(cell.x / 4.0), cell.y) + sd; float ht = wh(tid + 1.3), ho = wh(tid + 6.1);
      // 높은 층(8층 위)은 술집 · 노래방 대신 사무실 · 학원
      if (cell.y >= 7.0) ht = ht < 0.45 ? ht * 0.48 : 0.25 + ht * 0.27;
      if (ht < 0.22) { if (ho < uOn[8] && h1 < 0.9) c = vec3(0.8, 0.92, 1.0) * 1.15; c *= mix(1.0, mix(0.75, 1.1, f.y), det); }
      else if (ht < 0.52) { if (ho < uOn[3] && h1 < 0.85) c = mix(W_WARM, W_NEUT, h3 * 0.6) * (0.8 + 0.3 * h2); }
      else if (ht < 0.66) { if (ho < uOn[9] && h1 < 0.9) { float hk = wh(tid + 8.8); c = (hk < 0.3 ? vec3(1.0, 0.25, 0.62) : hk < 0.55 ? vec3(0.62, 0.32, 1.0) : hk < 0.75 ? vec3(1.0, 0.22, 0.18) : hk < 0.9 ? vec3(0.25, 0.75, 1.0) : vec3(1.0, 0.45, 0.12)) * 0.75; } }
      else { if (h4 < uOn[1]) c = homeLight(h3, era) * (0.75 + 0.35 * h2); if (h1 > 0.6) c = curtain(c, h2, h3, f, det); }
    }
  } else if (prof == 4) {
    // 호텔: 따뜻한 3000K, 거의 커튼
    if (h1 < uOn[4]) c = (hb < 0.7 ? vec3(1.0, 0.68, 0.38) : W_NEUT) * (0.7 + 0.4 * h2);
    if (h4 > 0.15) c = curtain(c, 0.1 + h2 * 0.5, h3 * 0.5, f, det);
  } else if (prof == 6) {
    if (h1 < uOn[6]) c = (hb < 0.6 ? W_COOL : W_NEUT) * (0.75 + 0.3 * h2);
    c *= mix(1.0, mix(0.7, 1.1, f.y), det);
  } else if (prof == 7) {
    // 교회: 따뜻한 빛, 가끔 색유리
    if (h1 < uOn[7] * 1.25) c = (h3 < 0.25 ? mix(vec3(1.0, 0.6, 0.3), vec3(0.5 + 0.5 * h2, 0.35, 0.9 - 0.5 * h2), 0.6) : vec3(1.0, 0.7, 0.4)) * (0.8 + 0.3 * h2);
  } else {
    // 공장 카페 · 한옥: 전구색 · 창호지 불빛
    if (h1 < uOn[10]) c = mix(W_WARM, vec3(1.0, 0.7, 0.42), h2) * (0.85 + 0.3 * h3);
  }
  // 가까이서: 방 안 등 하나가 비추는 듯 한쪽이 조금 더 밝다 (평평한 판처럼 보이지 않게)
  vec2 lp = vec2(0.25 + 0.5 * h2, 0.62 + 0.2 * h3) - f;
  c *= mix(1.0, 0.78 + 0.5 * exp(-dot(lp, lp) * 7.0), det);
  // 멀리: 한 점에 여러 창이 들어가면 창마다 고르지 말고 평균 빛으로 (반짝이지 않게)
  float on = prof <= 1 ? uOn[prof] * 0.75 : prof == 3 ? uOn[3] * 0.6 : prof == 7 ? uOn[7] : prof == 8 ? uOn[8] : prof > 7 ? uOn[10] : uOn[prof] * 0.8;
  vec3 avgC = prof <= 1 ? mix(W_COOL, W_WARM, 0.32 + era * 0.08) : prof == 2 || prof == 5 || prof == 6 ? mix(W_COOL, W_NEUT, 0.3) : prof == 3 ? mix(W_WARM, W_COOL, 0.35) : vec3(1.0, 0.66, 0.36);
  return mix(c, avgC * on * 0.85, smoothstep(0.45, 1.1, px));
}
`;

// grid: 그림 한 장(1 uv)에 창이 몇 칸인지 (보통 8 × 8, 공장 · 교회 아치 창은 4 × 4)
export function winLights(m, grid = [8, 8], far = false) {
  const prev = m.onBeforeCompile, pk = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r); sh.uniforms.uOn = WIN_U.uOn; sh.uniforms.uWinT = WIN_U.uWinT;
    sh.vertexShader = 'attribute vec3 aWin;\nvarying vec3 vWin;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWin = aWin;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL).replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
      // 창이 아닌 곳(벽 · 옥상)이나 낮(빛 세기 0)엔 창 계산을 건너뛴다
      //   (fwidth 는 갈림길 밖에서 재야 한다)
      float wMask = texture2D(emissiveMap, vEmissiveMapUv).r; vec2 wG = vEmissiveMapUv * vec2(${grid[0].toFixed(1)}, ${grid[1].toFixed(1)}), wFw = fwidth(wG);
      if (wMask > 0.004 && totalEmissiveRadiance.r > 0.0) totalEmissiveRadiance *= wMask * winLight(wG, wFw, vWin);
      else totalEmissiveRadiance = vec3(0.0);
    #endif`);
  };
  m.customProgramCacheKey = () => (pk ? pk() : '') + `|win${grid[0]}x${grid[1]}${far ? 'f' : ''}`;
  return m;
}
export const WIN_GRID = { factory: [4, 4], church: [4, 4] };
