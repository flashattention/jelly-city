// 서울 명소 체험 2차 (8-18 2차): 광장시장 먹거리 골목 · 하늘공원 억새 · 낙산 성곽길 밤 산책 · 노들섬 노을 · 창덕궁 후원 부용지
//   상표 · 실제 상호 없이 일반 이름. 실내(먹거리 골목)는 서울 밖 먼 곳에 짓고 카메라만 옮긴다. 바깥 명소는 제자리(지형 높이)에 짓는다
//   참고(보기 전용, 위키미디어 공용): 광장시장 정문 · 부용지 파노라마 · 하늘공원 풍력 발전기 사진
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerAttraction, part, merge, vcMat, signTex, LL, colored, ATTR_SKIP } from './hangang-attractions.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rndS = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const lit = (A, fn) => A.addLit(fn);
// 둥근 흐린 점 (김 · 음표 빛): 네모 점으로 보이지 않게
let DOT = null; const dotTex = () => DOT ||= (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
// 김(수증기): 화면을 보는 둥근 판(인스턴스 하나 = 그리기 1번). 가장자리가 투명한 뭉게 모양을 셰이더로 그리고,
//   위로 오르며 커지고 옅어진다. 시간은 셰이더 안에서 (매 프레임 CPU 일 없음). src = [[x, y, z], ...] (그룹 안 자리)
function makeSteam(src, per = 6, o = {}) {
  const n = src.length * per, geo = new THREE.PlaneGeometry(1, 1), seed = new Float32Array(n), U = { uT: { value: 0 }, uA: { value: o.alpha ?? 0.42 }, uC: { value: new THREE.Color(o.color || '#f1ece4') } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `attribute float aSeed; uniform float uT; varying vec2 vUv; varying float vA; varying float vS;
      void main(){ float ph = fract(uT * ${(o.speed ?? 0.32).toFixed(3)} + aSeed); vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float rise = ph * ${(o.rise ?? 1.6).toFixed(2)}; c += viewMatrix * vec4(sin(ph * 5.0 + aSeed * 40.0) * 0.12 * ph, rise, cos(aSeed * 31.0) * 0.08 * ph, 0.0);
        float s = ${(o.size ?? 0.22).toFixed(2)} + ph * ${(o.grow ?? 0.85).toFixed(2)}; float ang = aSeed * 6.28 + ph * 1.2; mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        c.xy += R * position.xy * s; vUv = uv; vS = aSeed; vA = smoothstep(0.0, 0.18, ph) * pow(1.0 - ph, 1.6); gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform float uA; uniform vec3 uC; varying vec2 vUv; varying float vA; varying float vS;
      void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float lump = 0.82 + 0.1 * sin(a * 3.0 + vS * 20.0) + 0.08 * sin(a * 5.0 - vS * 13.0);
        float m = smoothstep(lump, lump * 0.25, r) * (0.75 + 0.25 * sin(p.x * 9.0 + vS * 7.0) * sin(p.y * 8.0 - vS * 5.0));
        float al = m * vA * uA; if (al < 0.004) discard; gl_FragColor = vec4(uC, al); }` });
  const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(); let k = 0;
  for (const [x, y, z] of src) for (let j = 0; j < per; j++) { m4.makeTranslation(x + (Math.sin(k * 7.3) * 0.12), y, z + Math.cos(k * 3.1) * 0.12); im.setMatrixAt(k, m4); seed[k] = (j / per + Math.sin(k * 12.9898) * 0.07 + 1) % 1; k++; }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1)); im.frustumCulled = false; im.renderOrder = 3; im.userData.U = U; return im;
}
// ---------- 한옥 · 돌 도우미 (부용지 · 낙산 성곽 · 아래 명소들이 같이 쓴다) ----------
const plainBox = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d); g.deleteAttribute('uv'); return g; };
const cvTex = (w, h, draw, rep = true) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
// 상자인데 면마다 크기만큼 그림을 되풀이 (mx · my = 그림 한 장이 덮는 미터). 돌 줄눈이 늘어나지 않는다
function boxUV(w, h, d, mx = 4, my = 2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, F = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * F[f][0] / mx, uv.getY(i) * F[f][1] / my); }
  return g;
}
// 그림 붙은 모양 여럿을 한 덩어리로 (uv 를 지키고, 꼭짓점 색으로 돌마다 색을 조금씩)
function partUV(geo, x = 0, y = 0, z = 0, ry = 0, tint = '#ffffff', rx = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z);
  const c = new THREE.Color(tint), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); return g;
}
const mergeUV = (list) => mergeGeometries(list.filter(Boolean).map((g) => (g.attributes.color && g.attributes.uv && !g.index ? g : partUV(g))), false);
// 다듬은 돌을 켜켜이 쌓은 벽 (장대석 · 성돌): 한 장 = 4m × 2m, 줄마다 높이 · 길이 · 색이 다르고 줄눈은 어둡게
function stoneTex(seed = 3, o = {}) {
  return cvTex(512, 256, (c, W, H) => {
    const r = rndS(seed); c.fillStyle = o.joint || '#5f5a52'; c.fillRect(0, 0, W, H);
    let y = 0; const rows = o.rows || [34, 30, 36, 28, 32, 30, 34, 32];
    for (let k = 0; y < H; k++) {
      const rh = rows[k % rows.length]; let x = -r() * 60;
      while (x < W) {
        const bw = (o.minW || 56) + r() * (o.varW || 70), l = (o.base || 168) + r() * 34, warm = r() * 10, j = () => (r() - 0.5) * (o.rough || 3);
        c.fillStyle = `rgb(${l + warm},${l - 2},${l - 8 - warm})`; c.beginPath(); c.moveTo(x + 2 + j(), y + 2 + j()); c.lineTo(x + bw - 2 + j(), y + 2 + j()); c.lineTo(x + bw - 2 + j(), y + rh - 2 + j()); c.lineTo(x + 2 + j(), y + rh - 2 + j()); c.closePath(); c.fill();
        // 돌 표면: 위는 밝게 · 아래는 그늘, 잔 점, 가끔 물때
        const gr = c.createLinearGradient(0, y, 0, y + rh); gr.addColorStop(0, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(0,0,0,.16)'); c.fillStyle = gr; c.fillRect(x + 2, y + 2, bw - 4, rh - 4);
        for (let q = 0; q < 26; q++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '30,28,24'},${0.05 + r() * 0.08})`; c.fillRect(x + r() * bw, y + r() * rh, 2, 2); }
        if (r() < 0.25) { c.fillStyle = 'rgba(70,80,50,.18)'; c.fillRect(x + 3, y + rh - 8, bw * r(), 5); }
        x += bw;
      }
      y += rh;
    }
  });
}
// 기와 지붕: 골기와 줄(경사를 따라 내려가는 둥근 기와) · 가로 겹침 선
const tileTex = () => cvTex(256, 256, (c, W, H) => { c.fillStyle = '#3e4146'; c.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 32) { const g = c.createLinearGradient(x + 14, 0, x + 32, 0); g.addColorStop(0, '#2c2e32'); g.addColorStop(0.35, '#5a5e64'); g.addColorStop(0.6, '#6a6e74'); g.addColorStop(1, '#2a2c30'); c.fillStyle = g; c.fillRect(x + 14, 0, 18, H); } for (let y = 0; y < H; y += 21) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(0, y, W, 2); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, y + 2, W, 2); } });
// 창호: 붉은 밤색 문틀 · 띠살 창살 · 창호지 (밤엔 안에서 불빛)
const latticeTex = () => cvTex(128, 256, (c, W, H) => { c.fillStyle = '#efe4c8'; c.fillRect(0, 0, W, H); c.strokeStyle = '#6a3a24'; c.lineWidth = 3; for (let x = 8; x < W; x += 11) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (const y0 of [20, 120, 220]) for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(0, y0 + k * 7); c.lineTo(W, y0 + k * 7); c.stroke(); } c.lineWidth = 10; c.strokeStyle = '#7a2a1e'; c.strokeRect(0, 0, W, H); c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.lineWidth = 6; c.stroke(); });
// 단청 띠 (뇌록 바탕 · 머리초 연화 · 붉은 테)
const dcTex = () => cvTex(256, 32, (c, W) => { c.fillStyle = '#2f7a62'; c.fillRect(0, 0, W, 32); for (let x = 0; x < W; x += 64) { c.fillStyle = '#b8352a'; c.fillRect(x, 0, 6, 32); c.fillRect(x + 58, 0, 6, 32); for (const [r, col] of [[12, '#f1f0e8'], [9, '#d8402e'], [6, '#f2c230'], [3, '#2a5db0']]) { c.fillStyle = col; c.beginPath(); c.arc(x + 32, 16, r, 0, 7); c.fill(); } c.fillStyle = '#2a5db0'; c.fillRect(x + 8, 4, 10, 24); c.fillRect(x + 46, 4, 10, 24); c.fillStyle = '#f1f0e8'; c.fillRect(x + 18, 2, 3, 28); c.fillRect(x + 43, 2, 3, 28); } c.fillStyle = '#1c2a24'; c.fillRect(0, 0, W, 2); c.fillRect(0, 30, W, 2); });
// 휜 처마 지붕 (팔작: 용마루 · 합각 · 네 귀가 들린다). 용마루는 x 축. w · d = 처마 끝까지 크기, h = 처마 → 용마루 높이
//   결과 = uv · 꼭짓점 색이 있는 모양 (지붕 재질 하나로 묶는다). 아래 면(서까래)은 재질이 단청 녹색으로 칠한다
function curvedRoof(w, d, h, o = {}) {
  const ridge = o.ridge ?? w * 0.28, lift = o.lift ?? Math.min(w, d) * 0.07, N = 10, R = 7, pos = [], uv = [], idx = [], M = N * 4 + 1;
  const ringK = (t) => Math.pow(t, 0.95), Y = (t) => h * Math.pow(t, 1.75);
  for (let r = 0; r <= R; r++) {
    const t = r / R, k = ringK(t), hw = w / 2 + (ridge - w / 2) * k, hd = d / 2 + (0.14 - d / 2) * k, y = Y(t); let acc = 0, prev = null;
    for (let i = 0; i < M; i++) {
      const s = (i % N) / N, side = Math.floor(i / N) % 4; let x, z, u;
      if (i === M - 1) { x = -hw; z = hd; u = -1; } else if (side === 0) { x = -hw + s * 2 * hw; z = hd; u = -1 + s * 2; } else if (side === 1) { x = hw; z = hd - s * 2 * hd; u = 1 - s * 2; } else if (side === 2) { x = hw - s * 2 * hw; z = -hd; u = 1 - s * 2; } else { x = -hw; z = -hd + s * 2 * hd; u = -1 + s * 2; }
      const a = Math.pow(Math.abs(u), 3.2) * (1 - t) * (1 - t), out = 1 + a * 0.05; x *= out; z *= out;
      if (prev) acc += Math.hypot(x - prev[0], z - prev[1]); prev = [x, z]; pos.push(x, y + a * lift * 1.6, z); uv.push(acc / 2, 0.05 + t * 0.85);
    }
  }
  for (let r = 0; r < R; r++) for (let i = 0; i < M - 1; i++) { const a = r * M + i, b = a + 1, c2 = a + M, e = c2 + 1; idx.push(a, b, c2, b, e, c2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // 앞면이 위를 보게 (감기는 방향 확인)
  if (g.attributes.normal.getY(M + Math.floor(N / 2)) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const q = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = q; } g.computeVertexNormals(); }
  const list = [partUV(g)], top = h + 0.12;
  // 용마루 · 취두(양 끝 솟은 장식) · 합각(양옆 세모 벽, 흰 회벽)
  list.push(partUV(plainBox(ridge * 2 + 0.3, 0.32, 0.34), 0, top, 0, 0, '#8e8e8e'));
  for (const sx of [-1, 1]) {
    list.push(partUV(plainBox(0.22, 0.36, 0.3), sx * (ridge + 0.1), top + 0.1, 0, 0, '#8a8a8a'));
    const tg = 0.5, gy = Y(tg), gd = d / 2 + (0.14 - d / 2) * ringK(tg), tri = new THREE.BufferGeometry(), gx = sx * (ridge + 0.02);
    tri.setAttribute('position', new THREE.Float32BufferAttribute(sx > 0 ? [gx, gy, gd * 0.85, gx, gy, -gd * 0.85, gx, top, 0] : [gx, gy, -gd * 0.85, gx, gy, gd * 0.85, gx, top, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0.01, 0.99, 0.01, 0.99, 0.01, 0.99], 2)); tri.computeVertexNormals(); list.push(partUV(tri));
  }
  return mergeUV(list);
}
// 지붕 재질: 기와 그림 · 아래 면은 단청 녹색 서까래 (붉은 띠 · 흰 마구리) · 합각은 uv 구석 = 흰 회벽
function roofMat() {
  const m = new THREE.MeshLambertMaterial({ map: tileTex(), vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    if (vMapUv.y > 0.97) diffuseColor.rgb = vec3(0.84, 0.80, 0.72);
    else if (!gl_FrontFacing) { float st = fract(vMapUv.x * 9.0); diffuseColor.rgb = mix(vec3(0.12, 0.34, 0.28), vec3(0.6, 0.19, 0.15), step(0.8, st)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.88, 0.8), step(0.9, st) * step(vMapUv.y, 0.12)); }`); };
  m.customProgramCacheKey = () => 'hanokRoof'; return m;
}
// 멋대로 굽은 소나무 (적송): 휘어 오르는 줄기 · 옆으로 뻗은 가지 · 층층이 납작한 솔잎 덩이. 꼭짓점 색 모양 하나
function crookedPine(seed = 5, s = 1, o = {}) {
  const r = rndS(seed), out = [], lean = o.lean ?? 0.9, dir = o.dir ?? r() * 6.28, dx = Math.cos(dir), dz = Math.sin(dir), pts = [new THREE.Vector3(0, 0, 0)];
  for (let k = 1; k <= 5; k++) { const kk = k / 5; pts.push(new THREE.Vector3(dx * lean * kk * kk * 3.2 * s + Math.sin(k * 1.7 + seed) * 0.35 * s, (k * 1.05 + Math.sin(k) * 0.1) * s * (o.tall ?? 1), dz * lean * kk * kk * 3.2 * s + Math.cos(k * 2.3 + seed) * 0.35 * s)); }
  const curve = new THREE.CatmullRomCurve3(pts), trunk = new THREE.TubeGeometry(curve, 16, 0.2 * s, 7, false), tp = trunk.attributes.position, col = new Float32Array(tp.count * 3), cA = new THREE.Color('#4a3a30'), cB = new THREE.Color('#a8603e'), cc = new THREE.Color(), ctr = new THREE.Vector3();
  // 줄기: 아래 굵고 위로 가늘게, 색은 아래 잿빛 밤색 → 위 붉은 적송 껍질
  for (let i = 0; i < tp.count; i++) { const seg = Math.floor(i / 8) / 16; curve.getPointAt(Math.min(1, seg), ctr); const f = 1.3 - seg * 0.8; tp.setXYZ(i, ctr.x + (tp.getX(i) - ctr.x) * f, ctr.y + (tp.getY(i) - ctr.y) * f, ctr.z + (tp.getZ(i) - ctr.z) * f); cc.copy(cA).lerp(cB, Math.min(1, seg * 1.4)); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
  trunk.setAttribute('color', new THREE.BufferAttribute(col, 3)); trunk.computeVertexNormals(); out.push(trunk);
  const pads = [[curve.getPointAt(1), 1.25]], nb = o.branches ?? 5;
  for (let b = 0; b < nb; b++) {
    const t = 0.4 + (b / nb) * 0.55, a = r() * 6.28, L = (1.4 + r() * 1.6) * s, st = curve.getPointAt(t), en = st.clone().add(new THREE.Vector3(Math.cos(a) * L, (0.15 + r() * 0.35) * s, Math.sin(a) * L)), mid = st.clone().lerp(en, 0.5).add(new THREE.Vector3(0, 0.35 * s, 0));
    out.push(colored(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(st, mid, en), 6, 0.07 * s, 5, false), '#7a4a32')); pads.push([en, 0.8 + r() * 0.5]);
  }
  const greens = o.greens || ['#2f4f2a', '#3a5c30', '#29462a', '#456a36'];
  for (const [c, k] of pads) for (let q = 0; q < 3; q++) { const sp = new THREE.SphereGeometry(1, 9, 6); sp.scale(1.15 * k * s * (1 - q * 0.18), 0.32 * k * s, 0.95 * k * s * (1 - q * 0.18)); sp.translate(c.x + (r() - 0.5) * 0.6 * s, c.y + q * 0.22 * s - 0.1 * s, c.z + (r() - 0.5) * 0.6 * s); out.push(colored(sp, greens[Math.floor(r() * greens.length)])); }
  return mergeGeometries(out.map((g) => { const q = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; }), false);
}
// 지도 나무 숨기기: fn(x, z) 가 참인 나무를 치우고, 돌려놓는 함수를 돌려준다 (칸 나무 · 숲 채움 나무 모두)
function hideTrees(hg, fn) {
  const saved = [], zero = new THREE.Matrix4().makeScale(0, 0, 0), m4 = new THREE.Matrix4();
  for (const o of hg.chunks?.values?.() || []) for (const G of o.treeGroups || []) {
    const A = G.arr === 'f' ? o.forestFill || [] : o.trees || []; let hit = false;
    G.idx.forEach((si, q) => { const p = A[si]; if (!p || p.cut || !fn(p[0], p[1])) return; for (const m of G.ms) if (m) { m.getMatrixAt(q, m4); if (m4.elements[0] === 0 && m4.elements[5] === 0) continue; saved.push([m, q, m4.clone()]); m.setMatrixAt(q, zero); } hit = true; });
    if (hit) for (const m of G.ms) if (m) m.instanceMatrix.needsUpdate = true;
  }
  return () => { const up = new Set(); for (const [m, q, M] of saved) { m.setMatrixAt(q, M); up.add(m); } for (const m of up) m.instanceMatrix.needsUpdate = true; saved.length = 0; };
}
// 곰 대신 보이는 작은 젤리 손님 (몸 · 머리 · 귀, 색만 다르게)
function jelly(col, s = 1) { const p = []; p.push(part(new THREE.SphereGeometry(0.32, 10, 8), col, 0, 0.45, 0, 0, 0, 0, 1, 1.15, 0.9), part(new THREE.SphereGeometry(0.26, 10, 8), col, 0, 0.98, 0), part(new THREE.SphereGeometry(0.08, 6, 4), col, -0.17, 1.2, 0), part(new THREE.SphereGeometry(0.08, 6, 4), col, 0.17, 1.2, 0), part(new THREE.SphereGeometry(0.04, 6, 4), '#2a1c14', -0.08, 1.0, 0.23), part(new THREE.SphereGeometry(0.04, 6, 4), '#2a1c14', 0.08, 1.0, 0.23)); return p.map((g) => (g.scale(s, s, s), g)); }

// ============================================================
// 2-1 광장시장 먹거리 골목: 지붕 덮인 골목, 좌판 두 줄 (철판 빈대떡 · 육회 · 김밥 · 떡볶이 · 순대 · 칼국수)
//   실내는 먼 곳(MO)에 짓고, 체험하면 카메라가 그 골목으로. 메뉴를 고르면 그 좌판 의자에 앉아 음식이 나오고 먹는다
// ============================================================
const MARKET_ENT = LL(37.5700, 126.9990), MO = new THREE.Vector3(146000, 0, -26000);
const MENU = [['빈대떡', '녹두를 갈아 철판에 지진 두툼한 전', '#c98a3a'], ['육회', '양념한 생고기 · 배채 · 노른자', '#c83a3a'], ['꼬마김밥', '한입 크기 김밥 · 겨자 간장', '#2f4a2a'], ['떡볶이', '빨간 고추장 떡볶이 · 어묵', '#e0482a'], ['순대', '찹쌀 순대 · 간 · 허파', '#5a3a3a'], ['칼국수', '손으로 민 면 · 바지락 국물', '#e8dcc0']];
function foodMesh(i) {
  const p = [], plate = (c = '#f4f2ee', r = 0.22) => p.push(part(new THREE.CylinderGeometry(r, r * 0.8, 0.04, 20), c, 0, 0.02, 0));
  if (i === 0) { plate(); for (let k = 0; k < 2; k++) p.push(part(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), '#c98a3a', (k - 0.5) * 0.12, 0.06 + k * 0.03, 0)); }
  else if (i === 1) { plate('#2a2a2a'); p.push(part(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#b8282a', 0, 0.03, 0, 0, 0, 0, 1, 0.5, 1), part(new THREE.SphereGeometry(0.04, 8, 6), '#ffb020', 0, 0.09, 0)); for (let k = 0; k < 6; k++) p.push(part(new THREE.BoxGeometry(0.15, 0.01, 0.012), '#f0e6c8', Math.cos(k) * 0.13, 0.05, Math.sin(k) * 0.13, 0, k, 0)); }
  else if (i === 2) { plate(); for (let k = 0; k < 7; k++) { const g = new THREE.CylinderGeometry(0.03, 0.03, 0.035, 10); p.push(part(g, '#1c2a1c', Math.cos(k * 0.9) * 0.1, 0.04, Math.sin(k * 0.9) * 0.1), part(new THREE.CylinderGeometry(0.022, 0.022, 0.037, 8), '#f6f0e0', Math.cos(k * 0.9) * 0.1, 0.04, Math.sin(k * 0.9) * 0.1)); } }
  else if (i === 3) { plate('#2e6a3e'); for (let k = 0; k < 9; k++) p.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 6), '#f0ece0', Math.cos(k) * 0.1, 0.05, Math.sin(k * 1.7) * 0.1, Math.PI / 2, k, 0)); p.push(part(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 20), '#d8301c', 0, 0.035, 0)); }
  else if (i === 4) { plate(); for (let k = 0; k < 8; k++) p.push(part(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), '#3a2424', (k % 4 - 1.5) * 0.08, 0.04, (k > 3 ? 0.05 : -0.05), 0, 0, Math.PI / 2)); }
  else { p.push(part(new THREE.CylinderGeometry(0.17, 0.12, 0.12, 20), '#e8e4dc', 0, 0.06, 0), part(new THREE.CylinderGeometry(0.155, 0.155, 0.01, 20), '#e6d6a8', 0, 0.11, 0)); for (let k = 0; k < 5; k++) p.push(part(new THREE.SphereGeometry(0.025, 6, 4), '#6a5a48', Math.cos(k * 1.3) * 0.08, 0.12, Math.sin(k * 1.3) * 0.08)); }
  return new THREE.Mesh(merge(p), vcMat());
}
function buildMarketHall() {
  const g = new THREE.Group(); g.position.copy(MO); const p = [], L = 40, W = 9;
  // 바닥 · 양옆 가게 벽 · 지붕(반투명 채광판 + 철골)
  p.push(part(new THREE.BoxGeometry(W, 0.1, L), '#8f8a82', 0, -0.05, 0));
  for (let z = -L / 2; z <= L / 2; z += 1.2) p.push(part(new THREE.BoxGeometry(W, 0.012, 0.05), '#7d7870', 0, 0.006, z));
  for (const sx of [-1, 1]) { p.push(part(new THREE.BoxGeometry(0.3, 7, L), '#b8a88e', sx * (W / 2 + 2.6), 3.5, 0)); for (let z = -L / 2 + 2; z < L / 2; z += 4) p.push(part(new THREE.BoxGeometry(0.05, 2.6, 3.2), '#5a4a3a', sx * (W / 2 + 2.44), 1.6, z), part(new THREE.BoxGeometry(0.08, 0.7, 3.4), ['#d84a2a', '#2a6ad8', '#e8b82a', '#3a9a5a'][Math.abs(Math.round(z)) % 4], sx * (W / 2 + 2.42), 3.4, z)); }
  for (let z = -L / 2; z <= L / 2; z += 3) { const a = new THREE.TorusGeometry(W / 2 + 2.6, 0.08, 4, 20, Math.PI); p.push(part(a, '#6a7078', 0, 6.4, z)); }
  g.add(new THREE.Mesh(merge(p), vcMat()));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2 + 2.6, W / 2 + 2.6, L, 20, 1, true, Math.PI / 2, Math.PI), new THREE.MeshLambertMaterial({ color: '#f2e9cf', emissive: '#fff4d6', emissiveIntensity: 0.35, side: THREE.DoubleSide })); roof.rotation.x = Math.PI / 2; roof.position.y = 6.4; g.add(roof);
  // 좌판 두 줄 (가운데 길 양옆): 스테인리스 판 · 앞판 색 · 둥근 의자 · 매단 전등 · 음식 · 이름 판
  const stalls = []; const sp = [];
  for (let i = 0; i < 12; i++) { const sd = i % 2 ? 1 : -1, k = Math.floor(i / 2), z = -15 + k * 6, x = sd * 2.3, mi = i % MENU.length;
    sp.push(part(new THREE.BoxGeometry(1.8, 0.85, 4.6), '#c9c4bc', x, 0.42, z), part(new THREE.BoxGeometry(1.9, 0.04, 4.7), '#e4e8ea', x, 0.87, z), part(new THREE.BoxGeometry(0.04, 0.6, 4.6), MENU[mi][2], x - sd * 0.92, 0.45, z));
    for (let s = 0; s < 4; s++) sp.push(part(new THREE.CylinderGeometry(0.18, 0.16, 0.05, 12), '#d8402a', x - sd * 1.35, 0.5, z - 1.6 + s * 1.05), part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), '#8a8a8a', x - sd * 1.35, 0.25, z - 1.6 + s * 1.05));
    if (mi === 0) for (let s = 0; s < 3; s++) sp.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20), '#2a2a2a', x + sd * 0.3, 0.9, z - 1.4 + s * 1.4), part(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), '#c98a3a', x + sd * 0.3, 0.94, z - 1.4 + s * 1.4));
    stalls.push({ x, z, sd, mi }); }
  g.add(new THREE.Mesh(merge(sp), vcMat()));
  // 진열 음식 · 손님 젤리
  for (const S of stalls) for (let s = 0; s < 3; s++) { const f = foodMesh(S.mi); f.position.set(S.x + S.sd * 0.5, 0.89, S.z - 1.5 + s * 1.5); f.scale.setScalar(1.4); g.add(f); }
  const cust = []; const r = rndS(7); for (const S of stalls) for (let s = 0; s < 4; s++) if (r() < 0.45) { const j = jelly(['#ff9ec0', '#9ad0ff', '#ffd76a', '#a8e0a0', '#e8c8ff'][Math.floor(r() * 5)], 0.75); j.forEach((q) => { q.rotateY(S.sd > 0 ? -Math.PI / 2 : Math.PI / 2); q.translate(S.x - S.sd * 1.35, 0.5, S.z - 1.6 + s * 1.05); cust.push(q); }); }
  if (cust.length) g.add(new THREE.Mesh(merge(cust), vcMat()));
  // 이름 판 (좌판 위) · 매단 전등 (밤엔 따뜻하게)
  const bulbM = new THREE.MeshLambertMaterial({ color: '#fff1c8', emissive: '#ffcf80', emissiveIntensity: 0.9 });
  for (const S of stalls) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshLambertMaterial({ map: signTex(MENU[S.mi][0], '', '#3a2418', '#ffe8b8'), emissive: '#ffffff', emissiveIntensity: 0.25, side: THREE.DoubleSide })); sg.material.emissiveMap = sg.material.map; sg.position.set(S.x + S.sd * 0.6, 2.6, S.z); sg.rotation.y = S.sd > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sg);
    for (let s = 0; s < 3; s++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbM); b.position.set(S.x, 2.1, S.z - 1.5 + s * 1.5); g.add(b); } }
  // 김: 빈대떡 철판 · 칼국수 솥 · 떡볶이 판 위에서 오르는 둥근 김 (가장자리 투명, 오르며 커지고 옅어짐)
  const src = []; for (const S of stalls) { if (S.mi === 0) for (let s = 0; s < 3; s++) src.push([S.x + S.sd * 0.3, 0.98, S.z - 1.4 + s * 1.4]); else if (S.mi === 5 || S.mi === 3) src.push([S.x + S.sd * 0.5, 1.02, S.z]); }
  const steam = makeSteam(src, 5); g.add(steam);
  const pl = new THREE.PointLight('#ffd9a0', 2.2, 30, 1.6); pl.position.set(0, 4, 0); g.add(pl);
  g.userData = { stalls, steam };
  return g;
}
registerAttraction({
  id: 'market', name: '광장시장 먹거리 골목', seal: '광장시장', icon: '🥘', x: MARKET_ENT[0], z: MARKET_ENT[1], r: 22, buildR: 900, verb: '골목에서 먹기',
  go: [MARKET_ENT[0], MARKET_ENT[1] + 10, Math.PI], intro: '지붕 덮인 시장 골목 좌판에서 빈대떡 · 육회 · 꼬마김밥을 주문해 먹어요',
  start(A) {
    const hg = A.hg; A.mkt ||= buildMarketHall(); const g = A.mkt; if (!g.parent) A.root.add(g); g.visible = true;
    const D = g.userData; let pick = null, food = null, bites = 0, sit = null, t0 = 0, yaw = 0;
    const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;left:50%;bottom:118px;transform:translateX(-50%);padding:12px 14px;border-radius:18px;background:rgba(14,20,36,.86);color:#fff;font-family:Jua,sans-serif;z-index:7;text-align:center;max-width:calc(100vw - 32px)';
    ui.innerHTML = `<div style="font-size:16px;margin-bottom:8px">🥘 무엇을 먹을까요?</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${MENU.map((m, i) => `<button data-i="${i}" style="border:0;border-radius:12px;padding:8px 10px;font-family:Jua,sans-serif;font-size:15px;background:#fff6e4;color:#3a2418;cursor:pointer">${m[0]}<br><small style="font:11px system-ui;opacity:.7">${m[1]}</small></button>`).join('')}</div>`;
    document.getElementById('hg-hud')?.appendChild(ui); if (document.pointerLockElement) document.exitPointerLock?.();
    const order = (i) => { pick = i; ui.remove(); sit = D.stalls.find((S) => S.mi === i) || D.stalls[0]; food = foodMesh(i); if (i !== 1 && i !== 2) { const st = makeSteam([[0, 0.08, 0]], 7, { size: 0.08, grow: 0.32, rise: 0.75, alpha: 0.5, speed: 0.4 }); food.add(st); food.userData.steam = st; } food.scale.setScalar(1.6); food.position.set(MO.x + sit.x - sit.sd * 0.75, 0.9, MO.z + sit.z); g.parent.add(food); t0 = E.t; hg.onToast?.(`🥘 ${MENU[i][0]} 나왔어요! E 로 한 입씩`); A.drum(0.4, 300, 0.1); };
    for (const b of ui.querySelectorAll('button')) b.onclick = () => order(+b.dataset.i);
    const E = {
      title: '광장시장 먹거리 골목', lock: true,
      status() { if (pick == null) return '좌판을 둘러보고 메뉴를 골라요'; return bites >= 4 ? '잘 먹었습니다! 😋' : `${MENU[pick][0]} · ${bites} / 4 입 · E 로 먹기`; },
      actLabel() { return pick != null && bites < 4 ? '😋 한 입' : ''; },
      act() { if (pick == null || bites >= 4) return; bites++; food.scale.setScalar(1.6 * (1 - bites * 0.22)); A.drum(0.3, 500, 0.06); if (bites >= 4) { this.doneT = this.t; } },
      tick(dt) {
        if (pick != null && bites < 4 && this.t - t0 > 4 + bites * 2.5) this.act(); // 가만히 있어도 천천히 먹는다
        if (this.doneT != null && this.t - this.doneT > 2.5) { A.finish(E); return; }
        D.steam.userData.U.uT.value = this.t; if (food?.userData.steam) food.userData.steam.userData.U.uT.value = this.t;
        if (hg.bear) hg.bear.root.visible = false;
      },
      cam(camera, dt) {
        if (pick == null) { yaw = Math.sin(this.t * 0.25) * 0.5; camera.position.set(MO.x + Math.sin(yaw) * 1.2, 1.7, MO.z - 18 + Math.min(10, this.t * 0.8)); this.cp = camera.position.clone(); camera.lookAt(MO.x + Math.sin(yaw) * 4, 1.3, MO.z + 6); return; }
        const sx = MO.x + sit.x - sit.sd * 1.35, sz = MO.z + sit.z, want = new THREE.Vector3(sx - sit.sd * 0.3, 1.75, sz - 2.9); (this.cp ||= camera.position.clone()).lerp(want, 1 - Math.exp(-dt * 4)); camera.position.copy(this.cp); camera.lookAt(sx + sit.sd * 1.25, 0.95, sz - 0.2); // 손님 줄 끝에서 음식이 놓인 판을 본다
      },
      end() { ui.remove(); food?.parent?.remove(food); g.visible = false; if (hg.bear) hg.bear.root.visible = true; },
      where() { return '광장시장 먹거리 골목'; },
    };
    return E;
  },
});

// ============================================================
// 2-2 하늘공원 억새: 언덕 위 은빛 억새 들판(바람에 흔들림) · 데크 길 · 흰 풍력 발전기 다섯 (사진: 격자 기둥 위 세 날개)
// ============================================================
const HANEUL = LL(37.5685, 126.8853);
function grassTex() { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d'); c.clearRect(0, 0, 64, 128); for (let i = 0; i < 9; i++) { const x = 6 + i * 6 + Math.sin(i) * 3; c.strokeStyle = i % 2 ? '#8a9a5a' : '#a8a868'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 128); c.quadraticCurveTo(x + 4, 70, x + (i - 4) * 2, 30); c.stroke(); } for (let i = 0; i < 6; i++) { const x = 12 + i * 8, gr = c.createLinearGradient(x, 0, x, 40); gr.addColorStop(0, 'rgba(255,250,240,.95)'); gr.addColorStop(1, 'rgba(230,220,200,.4)'); c.fillStyle = gr; c.beginPath(); c.ellipse(x + (i - 3) * 2, 22, 4, 20, (i - 3) * 0.12, 0, 7); c.fill(); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function buildHaneul(A) {
  const g = new THREE.Group(); A.root.add(g); const [cx, cz] = HANEUL, R = 150, r = rndS(1985);
  const geo = new THREE.PlaneGeometry(1.4, 1.9); geo.translate(0, 0.95, 0); const g2 = geo.clone(); g2.rotateY(Math.PI / 2); const tuft = merge([geo, g2]);
  const U = { uT: { value: 0 } }, m = new THREE.MeshLambertMaterial({ map: grassTex(), alphaTest: 0.4, side: THREE.DoubleSide, color: '#fffaf0' });
  m.onBeforeCompile = (sh) => { sh.uniforms.uT = U.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float k = clamp(position.y / 1.9, 0.0, 1.0); transformed.x += sin(uT * 1.7 + ip.x * 0.15 + ip.z * 0.11) * 0.28 * k * k; transformed.z += cos(uT * 1.3 + ip.z * 0.13) * 0.12 * k * k; }'); }; m.customProgramCacheKey = () => 'eulalia';
  const N = 5200, im = new THREE.InstancedMesh(tuft, m, N), o = new THREE.Object3D(), col = new THREE.Color(); let n = 0;
  for (let t = 0; t < N * 3 && n < N; t++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (Math.abs((x - cx) - (z - cz) * 0.3) < 2.2) continue; o.position.set(x, A.H(x, z) - 0.05, z); o.rotation.set(0, r() * 6.28, 0); const s = 0.8 + r() * 0.6; o.scale.set(s, s * (0.9 + r() * 0.4), s); o.updateMatrix(); im.setMatrixAt(n, o.matrix); im.setColorAt(n, col.setHSL(0.11 + r() * 0.04, 0.25, 0.75 + r() * 0.15)); n++; }
  im.count = n; im.frustumCulled = false; g.add(im);
  // 데크 길 (들판을 가로지르는 나무 판)
  const deck = []; for (let d = -R; d <= R; d += 1) { const x = cx + d * 0.3 / 1.044, z = cz + d / 1.044; deck.push(part(new THREE.BoxGeometry(2.2, 0.12, 1.02), '#9a7448', x, A.H(x, z) + 0.15, z, 0, Math.atan2(0.3, 1), 0)); }
  g.add(new THREE.Mesh(merge(deck), vcMat()));
  // 풍력 발전기 다섯: 격자 기둥(가는 원통 + 가로대) · 머리 · 세 날개 (돈다)
  const rotors = [];
  for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.4, x = cx + Math.cos(a) * (R * 0.72), z = cz + Math.sin(a) * (R * 0.72), y = A.H(x, z), mast = [];
    for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]]) mast.push(part(new THREE.CylinderGeometry(0.04, 0.07, 14, 5), '#e8ecef', x + dx * 0.5, y + 7, z + dz * 0.5));
    for (let h = 1; h < 14; h += 1.6) mast.push(part(new THREE.BoxGeometry(0.4, 0.04, 0.04), '#e8ecef', x, y + h, z), part(new THREE.BoxGeometry(0.04, 0.04, 0.4), '#e8ecef', x, y + h, z));
    mast.push(part(new THREE.BoxGeometry(0.4, 0.4, 0.9), '#f4f6f6', x, y + 14.2, z)); g.add(new THREE.Mesh(merge(mast), vcMat()));
    const rot = new THREE.Group(); rot.position.set(x, y + 14.2, z + 0.5); const bl = []; for (let b = 0; b < 3; b++) bl.push(part(new THREE.BoxGeometry(0.18, 3.2, 0.04), '#ffffff', Math.sin((b * Math.PI * 2) / 3) * 1.6, Math.cos((b * Math.PI * 2) / 3) * 1.6, 0, 0, 0, -(b * Math.PI * 2) / 3)); rot.add(new THREE.Mesh(merge(bl), vcMat())); g.add(rot); rotors.push(rot); }
  return { group: g, tick(dt) { U.uT.value += dt; for (const ro of rotors) ro.rotation.z -= dt * 2.2; }, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'haneul', name: '하늘공원 억새', seal: '하늘공원', icon: '🌾', x: HANEUL[0], z: HANEUL[1] + 40, r: 40, buildR: 1000, verb: '억새길 걷기',
  go: [HANEUL[0] + 12, HANEUL[1] + 45, Math.PI], intro: '언덕 위 은빛 억새 들판 · 바람에 흔들리는 억새 사이 데크 길 · 풍력 발전기',
  build: buildHaneul,
  start(A) {
    const hg = A.hg, s0 = hg.opt.season, st0 = hg.state.season, h0 = hg.state.hour; hg.setOpt('season', 'autumn'); if (h0 < 15 || h0 > 19) hg.state.hour = 17.4;
    hg.onToast?.('🌾 가을 노을 · 억새 사이를 걸어 봐요 (W A S D)');
    const E = { title: '하늘공원 억새길', lock: false,
      status() { return this.t < 30 ? `억새 사이를 걸어요 · ${Math.ceil(30 - this.t)}초` : '다 걸었으면 E'; },
      actLabel() { return this.t >= 30 ? '🌾 다 걸었어요' : ''; },
      act() { if (this.t >= 30) A.finish(E); },
      tick() { if (Math.hypot(hg.px - HANEUL[0], hg.pz - HANEUL[1]) > 400) A.finish(E, true); },
      end() { hg.setOpt('season', st0); hg.opt.season = s0; },
      where() { return '하늘공원 억새 들판'; } };
    return E;
  },
});

// ============================================================
// 2-3 낙산 성곽길 밤 산책: 흥인지문 → 낙산 정상 → 혜화문 쪽 한양도성 (돌 성벽 · 위 여장 · 길가 밤 등)
//   성벽은 길 동쪽(바깥)에. 체험하면 밤이 되고 곰이 길을 따라 정상까지 걸어 올라간다
// ============================================================
// 아래쪽(흥인지문 → 이화동)은 지도 집들과 겹쳐 빼고, 낙산공원 안 구간(이화마을 위 → 정상 → 장수마을 쪽)만
const NAKSAN = [[37.5776, 127.0081], [37.5792, 127.0079], [37.5806, 127.0075], [37.5822, 127.0069], [37.5838, 127.0062]].map(([a, b]) => LL(a, b));
// 성벽 아래에서 위로 비추는 조명 빛 (가운데 밝고 위 · 옆으로 옅어짐)
const upGlowTex = () => cvTex(128, 128, (c, W, H) => { c.save(); c.translate(W / 2, H); c.scale(1, 2.1); const g = c.createRadialGradient(0, 0, 1, 0, 0, W / 2); g.addColorStop(0, 'rgba(255,214,150,1)'); g.addColorStop(0.3, 'rgba(255,192,122,.6)'); g.addColorStop(0.7, 'rgba(255,175,105,.16)'); g.addColorStop(1, 'rgba(255,170,100,0)'); c.fillStyle = g; c.fillRect(-W / 2, -H, W, H); c.restore(); }, false);
function buildNaksan(A) {
  const g = new THREE.Group(); A.root.add(g); const p = [], S = [], GL = [], lamps = [], r = rndS(1396);
  // 성벽(몸체): 다듬은 성돌을 켜켜이 (줄눈 그림) · 위에 여장(타구 사이 틈, 근총안 · 원총안) · 옥개석. 길 쪽 아래엔 위로 비추는 조명
  for (let i = 1; i < NAKSAN.length; i++) {
    const [ax, az] = NAKSAN[i - 1], [bx, bz] = NAKSAN[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux, ry = Math.atan2(ux, uz);
    for (let t = 0; t < L; t += 3) {
      const x = ax + ux * t - nx * 3, z = az + uz * t - nz * 3, y = A.H(x, z), tint = ['#ffffff', '#f2eee6', '#e8e4dc', '#fbf6ee'][Math.floor(r() * 4)];
      S.push(partUV(boxUV(2.2, 4.4, 3.06, 3.2, 1.6), x, y + 1.5, z, ry, tint));
      // 여장: 타구(한 덩이 2.5m) 사이 0.5m 틈, 덩이마다 총안 셋(가운데 아래로 기운 근총안, 양옆 원총안) · 지붕돌
      const k = Math.floor(t / 3), px = x - nx * 0.6, pz = z - nz * 0.6, yt = y + 3.7;
      S.push(partUV(boxUV(0.85, 1.05, 2.5, 3.2, 1.6), px, yt + 0.52, pz, ry, '#f4f0e8'), partUV(boxUV(1.05, 0.14, 2.6, 3.2, 1.6), px, yt + 1.11, pz, ry, '#cfc8bc'));
      for (const [o, h, w] of [[-0.8, 0.55, 0.16], [0, 0.32, 0.22], [0.8, 0.55, 0.16]]) for (const sd of [-1, 1]) p.push(part(new THREE.BoxGeometry(0.04, w * 1.2, w), '#1c1a18', px + nx * sd * 0.44 + ux * o, yt + h, pz + nz * sd * 0.44 + uz * o, 0, ry, 0));
      if (k % 8 === 0) lamps.push([ax + ux * t + nx * 2.4, az + uz * t + nz * 2.4]);
      // 아래에서 비추는 조명: 성벽 길 쪽 면에 빛 자국(더하기 섞기) · 땅에 작은 등기구
      if (k % 2 === 0) { const fx = ax + ux * t - nx * 1.86, fz = az + uz * t - nz * 1.86, fy = y; const pl = new THREE.PlaneGeometry(5.2, 4.4); pl.translate(0, 2.2, 0); GL.push(partUV(pl, fx, fy - 0.05, fz, Math.atan2(nx, nz))); p.push(part(new THREE.BoxGeometry(0.3, 0.16, 0.22), '#2a2c30', fx + nx * 0.25, fy + 0.08, fz + nz * 0.25, 0, ry, 0)); }
    }
    for (let t = 0; t < L; t += 2) { const x = ax + ux * t + nx * 0.2, z = az + uz * t + nz * 0.2; p.push(part(new THREE.BoxGeometry(3, 0.08, 2.05), ['#b8ab94', '#b0a48e', '#bcb09a'][Math.floor(r() * 3)], x, A.H(x, z) + 0.06, z, 0, ry, 0)); }
  }
  const wallM = new THREE.MeshLambertMaterial({ map: stoneTex(1396, { rows: [46, 40, 50, 42, 44, 38], minW: 44, varW: 52, base: 150, rough: 5, joint: '#4a463f' }), vertexColors: true });
  g.add(new THREE.Mesh(mergeUV(S), wallM), new THREE.Mesh(merge(p), vcMat()));
  const glowM = new THREE.MeshBasicMaterial({ map: upGlowTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), glow = new THREE.Mesh(mergeUV(GL), glowM); glow.renderOrder = 2; g.add(glow);
  const lm = new THREE.MeshLambertMaterial({ color: '#fff0c8', emissive: '#ffcf80', emissiveIntensity: 0 }), lp = [];
  for (const [x, z] of lamps) { const y = A.H(x, z); lp.push(part(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), '#3a3d42', x, y + 1.6, z)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lm); b.position.set(x, y + 3.3, z); g.add(b); }
  g.add(new THREE.Mesh(merge(lp), vcMat())); lit(A, (L) => { lm.emissiveIntensity = 0.1 + L * 1.4; glowM.opacity = L * 0.75; glow.visible = L > 0.02; });
  // 길을 따라가는 점들 (걷기용)
  const path = []; for (let i = 1; i < NAKSAN.length; i++) { const [ax, az] = NAKSAN[i - 1], [bx, bz] = NAKSAN[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L; for (let t = 0; t < L; t += 2) path.push([ax + ux * t + uz * 0.6, az + uz * t - ux * 0.6]); }
  A.naksanPath = path;
  return { group: g, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
// 체험 중 카메라와 곰 사이를 가리는 나무: 성곽 길에서 도시 쪽 11m · 성벽 쪽 성벽 면까지 안의 지도 나무를 치운다
function naksanTreeTest(x, z) {
  for (let i = 1; i < NAKSAN.length; i++) {
    const [ax, az] = NAKSAN[i - 1], [bx, bz] = NAKSAN[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, t = (x - ax) * ux + (z - az) * uz;
    if (t < -12 || t > L + 12) continue; const s = (x - ax) * uz - (z - az) * ux; if (s > -2.2 && s < 11) return true;
  }
  return false;
}
registerAttraction({
  id: 'naksan', name: '낙산 성곽길', seal: '낙산', icon: '🏯', x: NAKSAN[0][0] - 6, z: NAKSAN[0][1], pts: NAKSAN.slice(0, 3).map(([x, z]) => [x - 6, z]), r: 26, buildR: 1400, verb: '밤 산책',
  go: [NAKSAN[0][0] - 8, NAKSAN[0][1] + 6, 0], intro: '이화마을 위에서 낙산 정상 너머까지 한양도성 성곽을 따라 걷는 밤길 · 아래로 도시 불빛',
  build: buildNaksan,
  start(A) {
    const hg = A.hg, P = A.naksanPath; if (!P) return null; const h0 = hg.state.hour; if (h0 > 5 && h0 < 19.5) hg.state.hour = 20.3;
    let i0 = 0, bd = Infinity; P.forEach(([x, z], i) => { const d = Math.hypot(x - hg.px, z - hg.pz); if (d < bd) { bd = d; i0 = i; } }); const iEnd = P.length - 1; if (i0 > iEnd - 60) i0 = 0;
    let u = i0, yawSet = false, treeT = 0; const undo = [hideTrees(hg, naksanTreeTest)];
    const E = { title: '낙산 성곽길 밤 산책', lock: true,
      status() { return u >= iEnd ? '🌃 성곽 끝 · 서울 밤 풍경' : `성곽을 따라 걷는 중 · 남은 길 ${Math.round((iEnd - u) * 2)}m · 마우스로 둘러보기`; },
      tick(dt) { treeT += dt; if (treeT > 1.5) { treeT = 0; undo.push(hideTrees(hg, naksanTreeTest)); } u = Math.min(iEnd, u + dt * 5.5); const k = Math.floor(u), f = u - k, a = P[k], b = P[Math.min(P.length - 1, k + 1)], x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; hg.px = x; hg.pz = z; hg.y = 0; hg.v = 2.2; hg.face = Math.atan2(b[0] - a[0], b[1] - a[1]);
        if (!yawSet) { hg.camYaw = hg.face + 0.5; hg.camPitch = 0.2; yawSet = true; } if (u >= iEnd) { this.top ||= this.t; hg.v = 0; if (this.t - this.top > 8) A.finish(E); } },
      // 카메라: 곰 뒤 · 성벽 반대(서쪽, 도시 쪽) 위에서 성벽과 길을 함께
      cam(camera, dt) { const fx = Math.sin(hg.face), fz = Math.cos(hg.face), y = A.H(hg.px, hg.pz), want = new THREE.Vector3(hg.px - fx * 8 + fz * 3.5, y + 4.8, hg.pz - fz * 8 - fx * 3.5); (this.cp ||= want.clone()).lerp(want, 1 - Math.exp(-dt * 3)); camera.position.copy(this.cp); camera.lookAt(hg.px + fx * 8 - fz * 1.5, y + 1.6, hg.pz + fz * 8 + fx * 1.5); },
      end() { for (const f of undo.reverse()) f(); }, where() { return '낙산 성곽길'; } };
    return E;
  },
});

// ============================================================
// 2-4 노들섬: 한강대교 가운데 섬의 잔디 언덕 · 작은 거리 공연 무대 · 강 위 노을
// ============================================================
const NODEUL = LL(37.5176, 126.9573);
function buildNodeul(A) {
  const g = new THREE.Group(); A.root.add(g); const [x, z] = NODEUL, y = A.H(x, z), p = [];
  for (let k = 0; k < 6; k++) p.push(part(new THREE.BoxGeometry(30 - k * 2, 0.45, 1.8), k % 2 ? '#7aa858' : '#86b462', x, y + 0.22 + k * 0.45, z - 6 - k * 1.8));
  p.push(part(new THREE.CylinderGeometry(4, 4, 0.5, 24), '#cfc8bb', x, y + 0.25, z + 6), part(new THREE.BoxGeometry(0.12, 3.2, 0.12), '#3a3d42', x - 3, y + 1.6, z + 7.5), part(new THREE.BoxGeometry(0.12, 3.2, 0.12), '#3a3d42', x + 3, y + 1.6, z + 7.5), part(new THREE.BoxGeometry(6.4, 0.2, 0.2), '#3a3d42', x, y + 3.2, z + 7.5));
  jelly('#ffb0c8', 1.1).forEach((q) => { q.translate(x, y + 0.5, z + 6); p.push(q); }); p.push(part(new THREE.BoxGeometry(0.5, 0.15, 0.12), '#c98a3a', x + 0.3, y + 1.45, z + 6.3, 0, 0, 0.6), part(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), '#2a2a2a', x - 0.8, y + 1.25, z + 6.6));
  const r = rndS(31); for (let i = 0; i < 14; i++) jelly(['#9ad0ff', '#ffd76a', '#a8e0a0', '#e8c8ff', '#ff9ec0'][i % 5], 0.8).forEach((q) => { const k = i % 6; // 무대(+z)를 본다
 q.translate(x - 12 + r() * 24, y + 0.45 + k * 0.45, z - 6 - k * 1.8); p.push(q); });
  g.add(new THREE.Mesh(merge(p), vcMat()));
  const notes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.PointsMaterial({ color: '#fff4c0', size: 0.6, map: dotTex(), transparent: true, opacity: 0.85, depthWrite: false })); notes.frustumCulled = false; g.add(notes);
  const lightM = new THREE.MeshLambertMaterial({ color: '#fff2d0', emissive: '#ffd890', emissiveIntensity: 0 }); for (const sx of [-3, 3]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lightM); b.position.set(x + sx, y + 3.0, z + 7.4); g.add(b); } lit(A, (L) => { lightM.emissiveIntensity = 0.2 + L * 1.5; });
  return { group: g, tick(dt) { const P = notes.geometry.attributes.position; for (let i = 0; i < 30; i++) { const ph = (A.hg.time * 0.4 + i / 30) % 1; P.setXYZ(i, x + Math.sin(i * 2.3) * (0.5 + ph * 3), y + 1.6 + ph * 4, z + 6 - ph * 3); } P.needsUpdate = true; }, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'nodeul', name: '노들섬 노을', seal: '노들섬', icon: '🌅', x: NODEUL[0], z: NODEUL[1] - 14, r: 24, buildR: 900, verb: '잔디에 앉기',
  go: [NODEUL[0], NODEUL[1] - 20, Math.PI], intro: '한강대교 가운데 섬 잔디 계단에 앉아 거리 공연과 강 노을을 봐요',
  build: buildNodeul,
  start(A) {
    const hg = A.hg, [x, z] = NODEUL, h0 = hg.state.hour; if (h0 < 17 || h0 > 19.6) hg.state.hour = 18.1;
    hg.placeAt(x + 2, z - 9.6, 0); hg.y = 1.35;
    const E = { title: '노들섬 잔디 계단', lock: true,
      status() { return this.t < 20 ? `🎸 거리 공연 · 강 위 노을 · ${Math.ceil(20 - this.t)}초` : '노을을 다 봤어요'; },
      tick() { hg.y = 1.35; hg.v = 0; if (this.t > 22) A.finish(E); },
      floor(px, pz) { return Math.hypot(px - x, pz - z + 9) < 16 ? 1.35 : -1; },
      cam(camera, dt) { const want = new THREE.Vector3(x - 4, A.H(x, z) + 6.5, z - 22); if (this.t < 0.1) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-dt * 3)); camera.lookAt(x - 20 + this.t * 0.6, A.H(x, z) + 2.5, z + 40); },
      end() { hg.y = 0; }, where() { return '노들섬 잔디 계단'; } };
    return E;
  },
});


// ============================================================
// 2-5 창덕궁 후원 부용지 (사진: 네모 연못 · 장대석 축대 · 가운데 둥근 섬과 굽은 소나무 · 두 돌기둥을 물에 담근 십자 부용정 · 언덕 위 2층 주합루와 어수문 · 동쪽 영화당)
//   연못은 지도(OSM) 물 모양 그대로: 가운데 (1137, -5716), 22° 돌아 있다. 그 틀(가로 = 동쪽 변, 세로 = 남쪽)에 짓는다
// ============================================================
const POND = [1137, -5716], HROT = 0.37, PW = 36, PD = 28;
ATTR_SKIP.add('주합루'); ATTR_SKIP.add('영화당');
// 연못 틀 → 서울 좌표 (lx = 동쪽, lz = 남쪽)
const hw2 = (lx, lz) => [POND[0] + lx * Math.cos(HROT) + lz * Math.sin(HROT), POND[1] - lx * Math.sin(HROT) + lz * Math.cos(HROT)];
// 한옥 한 채(또는 한 날개): 기둥 · 창호 · 난간 · 단청 띠 · 휜 지붕. 모두 틀 안 좌표, 목록(K)에 모양만 넣는다
function hanokBlock(K, cx, cz, by, w, d, colH, o = {}) {
  const bays = o.bays || [Math.max(1, Math.round(w / 2.4)), Math.max(1, Math.round(d / 2.4))], col = o.col || '#8a2a22';
  const xs = [], zs = []; for (let i = 0; i <= bays[0]; i++) xs.push(-w / 2 + (i * w) / bays[0]); for (let j = 0; j <= bays[1]; j++) zs.push(-d / 2 + (j * d) / bays[1]);
  const edge = (side) => (side === 'n' ? xs.map((x) => [x, -d / 2]) : side === 's' ? xs.map((x) => [x, d / 2]) : side === 'w' ? zs.map((z) => [-w / 2, z]) : zs.map((z) => [w / 2, z]));
  const posts = new Set(); for (const sd of ['n', 's', 'e', 'w']) for (const [x, z] of edge(sd)) { const k = `${x.toFixed(2)},${z.toFixed(2)}`; if (posts.has(k)) continue; posts.add(k); K.V.push(part(new THREE.CylinderGeometry(0.13, 0.15, colH, 10), col, cx + x, by + colH / 2, cz + z), part(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 10), '#b7b0a2', cx + x, by + 0.08, cz + z)); }
  // 창호(문살 문) · 계자 난간
  for (const sd of ['n', 's', 'e', 'w']) {
    const E = edge(sd), wall = (o.walls ?? 'nsew').includes(sd), rail = (o.rail || '').includes(sd), inset = o.inset || 0;
    for (let i = 1; i < E.length; i++) {
      const [ax, az] = E[i - 1], [bx, bz] = E[i], L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2, ry = Math.abs(bx - ax) > 0.01 ? 0 : Math.PI / 2, nx = sd === 'e' ? -1 : sd === 'w' ? 1 : 0, nz = sd === 's' ? -1 : sd === 'n' ? 1 : 0;
      if (wall) K.L.push(partUV(new THREE.BoxGeometry(L - 0.26, colH * 0.72, 0.06), cx + mx + nx * inset, by + 0.12 + colH * 0.36, cz + mz + nz * inset, ry));
      if (wall) K.V.push(part(new THREE.BoxGeometry(L - 0.2, 0.32, 0.1), '#7a2a1e', cx + mx + nx * inset, by + colH * 0.86, cz + mz + nz * inset, 0, ry, 0));
      if (rail) {
        K.V.push(part(new THREE.BoxGeometry(L, 0.07, 0.07), '#7a2a1e', cx + mx, by + 0.88, cz + mz, 0, ry, 0), part(new THREE.BoxGeometry(L, 0.28, 0.05), '#8a2a22', cx + mx, by + 0.2, cz + mz, 0, ry, 0));
        for (let t = 0.35; t < L - 0.2; t += 0.42) { const px = ax + ((bx - ax) * t) / L, pz = az + ((bz - az) * t) / L; K.V.push(part(new THREE.BoxGeometry(0.05, 0.5, 0.05), '#6a2a1e', cx + px, by + 0.6, cz + pz), part(new THREE.SphereGeometry(0.05, 6, 4), '#2f7a62', cx + px, by + 0.86, cz + pz)); }
      }
    }
  }
  // 창방 단청 띠 · 바닥 마루
  for (const [bw, bd, ox, oz] of [[w + 0.3, 0.26, 0, d / 2], [w + 0.3, 0.26, 0, -d / 2], [0.26, d + 0.3, w / 2, 0], [0.26, d + 0.3, -w / 2, 0]]) K.D.push(partUV(boxUV(bw, 0.38, bd, 2.6, 0.38), cx + ox, by + colH - 0.12, cz + oz));
  K.V.push(part(new THREE.BoxGeometry(w + 0.2, 0.14, d + 0.2), '#6b4a30', cx, by + 0.07, cz));
  // 지붕 (o.roof === false 면 없음): 처마가 기둥 밖으로 ex 만큼
  if (o.roof !== false) { const ex = o.ex ?? 1.25, along = o.ridgeZ ? d : w, across = o.ridgeZ ? w : d, rg = curvedRoof(along + ex * 2 + (o.extend || 0), across + ex * 2, o.rh ?? across * 0.42, { ridge: o.ridge ?? along * 0.3, lift: o.lift }); if (o.ridgeZ) rg.rotateY(Math.PI / 2); rg.translate(cx + (o.rox || 0), by + colH + 0.18, cz + (o.roz || 0)); K.R.push(rg); }
}
// 고인 연못 물: 짙은 올리브 녹색, 비스듬히 볼수록 하늘이 비치고 잔물결이 반짝인다 (밤엔 어둡게)
function pondWaterMat(A, o = {}) {
  const U = { uT: { value: 0 }, uN: { value: 0 }, uDeep: { value: new THREE.Color(o.deep || '#2e3a1a') }, uSky: { value: new THREE.Color(o.sky || '#b9c6c2') } };
  const m = new THREE.ShaderMaterial({ uniforms: U, depthFunc: THREE.AlwaysDepth,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT, uN; uniform vec3 uDeep, uSky; varying vec3 vW;
      void main(){ vec3 V = normalize(cameraPosition - vW); vec2 q = vW.xz;
        vec3 N = normalize(vec3(sin(q.x * 1.7 + uT * 1.1) * 0.03 + sin(q.y * 2.3 - uT * 0.8) * 0.025, 1.0, cos(q.y * 1.9 + uT * 0.9) * 0.03 + sin((q.x + q.y) * 3.1 + uT) * 0.015));
        float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0) * 0.6; vec3 sky = mix(mix(vec3(0.17, 0.23, 0.12), uSky, 0.22 + 0.1 * smoothstep(0.15, 0.0, V.y)), vec3(0.06, 0.08, 0.14), uN);
        vec3 c = mix(uDeep * (1.0 - uN * 0.75), sky, fr); c += vec3(0.9, 0.88, 0.75) * pow(max(0.0, N.x * 8.0 + N.z * 6.0), 6.0) * 0.04 * (1.0 - uN);
        gl_FragColor = vec4(c, 1.0); }` });
  A.addLit((L) => { U.uN.value = L; }); m.userData.U = U; return m;
}
function buildHuwon(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g); g.position.set(POND[0], 0, POND[1]); g.rotation.y = HROT;
  const HL = (lx, lz) => A.H(...hw2(lx, lz)), y0 = (HL(0, PD / 2 + 2.5) + HL(0, -PD / 2 - 2.5) + HL(PW / 2 + 2.5, 0) + HL(-PW / 2 - 2.5, 0)) / 4 + 0.05, wy = y0 - 0.85, K = { S: [], V: [], R: [], L: [], D: [] };
  // ---- 연못: 장대석 돌 축대 (줄눈) · 위 덮개돌 · 물 · 둥근 섬 · 굽은 소나무 · 연잎 ----
  const wallH = y0 + 0.1 - (wy - 0.7), wallY = (wy - 0.7 + y0 + 0.1) / 2;
  for (const [cx, cz, w, d] of [[0, -PD / 2 - 0.4, PW + 1.6, 0.8], [0, PD / 2 + 0.4, PW + 1.6, 0.8], [-PW / 2 - 0.4, 0, 0.8, PD], [PW / 2 + 0.4, 0, 0.8, PD]]) {
    K.S.push(partUV(boxUV(w, wallH, d, 4, 2), cx, wallY, cz));
    K.S.push(partUV(boxUV(w + (d < 1 ? 0.3 : 0.5), 0.22, d + (d < 1 ? 0.5 : 0.3), 4, 2), cx, y0 + 0.16, cz, 0, '#e6e0d4'));
  }
  // 물: 지도 물(땅 높이)보다 가라앉힌 연못 물. 땅 깊이를 덮어 쓰도록(항상 그림) 땅 다음 · 다른 것보다 먼저 그린다.
  //   지도 물은 반투명이라 나중에 그려지므로, 연못 위에 보이지 않는 뚜껑(깊이만 씀)을 맨 나중에 덮어 지도 물이 안 비치게 한다
  const water = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), pondWaterMat(A)); water.rotation.x = -Math.PI / 2; water.position.y = wy; water.renderOrder = -40; g.add(water);
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(PW + 12, PD + 12), new THREE.MeshBasicMaterial({ colorWrite: false })); lid.rotation.x = -Math.PI / 2; lid.position.y = y0 + 0.3; lid.renderOrder = 999; g.add(lid);
  const isl = new THREE.CylinderGeometry(5.5, 5.7, y0 + 0.2 - wy + 0.4, 28, 1, true), iu = isl.attributes.uv; for (let i = 0; i < iu.count; i++) iu.setXY(i, iu.getX(i) * 7, iu.getY(i) * 0.8);
  K.S.push(partUV(isl, 0.5, (y0 + 0.2 + wy - 0.4) / 2, -0.5, 0, '#d8d2c6'));
  const iy = y0 + 0.2; K.V.push(part(new THREE.CylinderGeometry(5.55, 5.55, 0.2, 28), '#5a7a3a', 0.5, iy, -0.5));
  { const r = rndS(77); for (let i = 0; i < 9; i++) { const a = i * 0.7 + r(), d = 2 + r() * 2.8; K.V.push(part(new THREE.SphereGeometry(0.6 + r() * 0.5, 8, 6), ['#3e6a32', '#4a7a3a', '#5a8a40'][i % 3], 0.5 + Math.cos(a) * d, iy + 0.2, -0.5 + Math.sin(a) * d, 0, 0, 0, 1.3, 0.6, 1.1)); } }
  { const pine = crookedPine(31, 1.05, { lean: 1.1, dir: 2.3, branches: 6 }); pine.translate(0.8, iy, -0.2); K.V.push(pine); }
  { const r = rndS(9); for (let i = 0; i < 16; i++) { const lp = new THREE.CircleGeometry(0.32 + r() * 0.18, 12, 0.3, Math.PI * 2 - 0.3); lp.rotateX(-Math.PI / 2); K.V.push(part(lp, ['#5a8a3a', '#4a7a32', '#6a9a44'][i % 3], 9 + (r() - 0.5) * 3, wy + 0.04, 3 + (r() - 0.5) * 2.4, 0, r() * 6, 0)); } }
  // ---- 부용정: 십(十)자 평면 정자. 가운데 칸 + 네 날개, 북쪽 날개는 연못으로 나와 두 돌기둥이 물에 잠긴다 ----
  const bx = -6, bz = 16.6, by = y0 + 0.75;
  K.S.push(partUV(boxUV(5.2, 1.0, 5.2, 4, 2), bx, y0 + 0.25, bz), partUV(boxUV(4.4, 1.0, 2.4, 4, 2), bx, y0 + 0.25, bz + 3.3), partUV(boxUV(2.4, 1.0, 3.8, 4, 2), bx - 3.4, y0 + 0.25, bz), partUV(boxUV(2.4, 1.0, 3.8, 4, 2), bx + 3.4, y0 + 0.25, bz));
  for (let k = 0; k < 3; k++) K.S.push(partUV(boxUV(2.2, 0.25, 0.4, 4, 2), bx, y0 + 0.12 + k * 0.22, bz + 5.1 - k * 0.38));
  hanokBlock(K, bx, bz, by, 4.2, 4.2, 2.6, { walls: 'nsew', bays: [2, 2], roof: false });
  hanokBlock(K, bx, bz - 3.55, by, 3.4, 2.9, 2.4, { walls: '', rail: 'new', bays: [2, 1], ridgeZ: true, extend: 2.6, roz: 1.3, rh: 1.7, ridge: 1.6 });
  hanokBlock(K, bx, bz + 2.85, by, 3.4, 1.5, 2.4, { walls: 's', bays: [2, 1], ridgeZ: true, extend: 2.2, roz: -1.1, rh: 1.6, ridge: 1.1 });
  for (const sx of [-1, 1]) hanokBlock(K, bx + sx * 2.95, bz, by, 1.7, 3.0, 2.4, { walls: sx < 0 ? 'w' : 'e', bays: [1, 2], extend: 2.2, rox: -sx * 1.1, rh: 1.6, ridge: 1.1 });
  { const c = curvedRoof(6.6, 6.6, 2.5, { ridge: 0.9, lift: 0.5 }); c.translate(bx, by + 2.8, bz); K.R.push(c); }
  K.V.push(part(new THREE.BoxGeometry(3.6, 0.3, 3.1), '#6b4a30', bx, by - 0.1, bz - 3.55));
  for (const sx of [-1.6, 1.6]) K.S.push(partUV(boxUV(0.5, by - wy + 0.4, 0.5, 1, 1), bx + sx, (by + wy - 0.4) / 2 - 0.2, bz - 4.9, 0, '#dcd6c8'));
  K.V.push(part(new THREE.BoxGeometry(0.9, 0.4, 0.06), '#2a2420', bx, by + 2.25, bz - 5.06), part(new THREE.BoxGeometry(1.0, 0.5, 0.04), '#c9a24a', bx, by + 2.25, bz - 5.04));
  // ---- 주합루: 언덕 위 2층 (아래 규장각 · 위 열람 마루와 난간), 앞 화계(돌 계단 단) · 어수문 · 양옆 취병 ----
  const jx = -6, jz = -46, jy = Math.max(HL(jx, jz), y0 + 6.5);
  K.S.push(partUV(boxUV(16, jy + 0.9 - y0 + 0.3, 10, 4, 2), jx, (jy + 0.9 + y0 - 0.3) / 2, jz));
  hanokBlock(K, jx, jz, jy + 0.9, 13.5, 7.6, 3.1, { walls: 'nsew', bays: [5, 3], roof: false, inset: 0 });
  K.V.push(part(new THREE.BoxGeometry(14.6, 0.32, 8.7), '#6b4a30', jx, jy + 4.1, jz));
  hanokBlock(K, jx, jz, jy + 4.25, 13.5, 7.6, 2.7, { walls: 'nsew', rail: 'nsew', bays: [5, 3], inset: 0.9, ex: 1.6, rh: 3.6, ridge: 4.2, lift: 0.75 });
  K.V.push(part(new THREE.BoxGeometry(2.0, 0.7, 0.08), '#2a2420', jx, jy + 6.4, jz + 3.95), part(new THREE.BoxGeometry(2.15, 0.85, 0.05), '#c9a24a', jx, jy + 6.4, jz + 3.93));
  // 화계: 연못 북쪽에서 주합루까지 세 단 (돌 축대 · 가운데 계단)
  const steps = 3; for (let k = 0; k < steps; k++) {
    const z = -16.5 - k * 8.5, yt = y0 + ((jy - y0) * (k + 1)) / (steps + 0.4), yb = k ? y0 + ((jy - y0) * k) / (steps + 0.4) : y0 - 0.2, hh = yt - yb + 0.4;
    K.S.push(partUV(boxUV(26, hh, 0.7, 4, 2), jx - 1, (yt + yb) / 2 - 0.15, z, 0, '#e2dccf'));
    K.V.push(part(new THREE.BoxGeometry(26, yt - y0 + 0.3, 7.8), '#4a5a34', jx - 1, (yt + y0 - 0.3) / 2, z - 4.25), part(new THREE.BoxGeometry(26.05, 0.08, 7.85), k % 2 ? '#c8bc9c' : '#cfc3a4', jx - 1, yt + 0.02, z - 4.25));
    for (let q = 0; q < 5; q++) K.S.push(partUV(boxUV(3.2, hh / 5 + 0.05, 0.5, 4, 2), jx, yb + (hh / 5) * (q + 0.5) - 0.2, z + 1.4 - q * 0.32, 0, '#efe9dd'));
  }
  // 어수문: 첫 단 위, 작은 문 (가운데 높은 칸 + 양옆 낮은 칸) · 화려한 단청 · 양옆 대나무 취병(초록 울타리)
  { const ay = y0 + (jy - y0) / (steps + 0.4), az = -21.5;
    hanokBlock(K, jx, az, ay, 2.6, 1.2, 2.6, { walls: '', bays: [1, 1], ex: 0.8, rh: 1.3, ridge: 0.7, lift: 0.4 });
    for (const sx of [-1, 1]) { hanokBlock(K, jx + sx * 2.1, az, ay, 1.4, 1.0, 2.0, { walls: '', bays: [1, 1], ex: 0.6, rh: 0.9, ridge: 0.3, lift: 0.3 }); K.V.push(part(new THREE.BoxGeometry(1.1, 1.6, 0.08), '#7a2a1e', jx + sx * 2.1, ay + 0.9, az)); }
    for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) K.V.push(part(new THREE.BoxGeometry(1.4, 1.8, 0.7), ['#3a5a2e', '#45683a', '#3f6034'][k % 3], jx + sx * (3.6 + k * 1.35), ay + 0.9, az, 0, 0, 0, 1, 1 + Math.sin(k * 2.1) * 0.06, 1));
    K.V.push(part(new THREE.BoxGeometry(1.8, 0.14, 1.2), '#6b4a30', jx, ay + 0.07, az)); }
  // ---- 영화당: 동쪽 언덕 아래, 연못을 보는(서향) 긴 집. 높은 장대석 기단 · 앞 계단 ----
  const ex0 = 30, ez0 = -8, ey = Math.max(HL(ex0, ez0), y0);
  K.S.push(partUV(boxUV(8.6, 1.6, 16, 4, 2), ex0, ey + 0.3, ez0)); for (let k = 0; k < 4; k++) K.S.push(partUV(boxUV(0.4, 0.3, 3.4, 4, 2), ex0 - 4.5 - k * 0.38, ey + 0.95 - k * 0.3, ez0));
  hanokBlock(K, ex0, ez0, ey + 1.1, 6.6, 14, 3.0, { walls: 'nsew', bays: [2, 5], ridgeZ: true, ex: 1.5, rh: 3.0, ridge: 4.5, lift: 0.6 });
  // ---- 연못가 마당(마사토) · 동쪽 둑 돌말뚝과 줄 ----
  { const P = [], C = [], c = new THREE.Color(), r = rndS(5), inPond = (x, z) => Math.abs(x) < PW / 2 + 0.9 && Math.abs(z) < PD / 2 + 0.9, inB = (x, z) => (Math.abs(x - bx) < 4.5 && Math.abs(z - bz - 0.5) < 4.5) || (Math.abs(x - ex0) < 4.6 && Math.abs(z - ez0) < 8.4);
    for (let x = -28; x < 40; x += 2) for (let z = -16; z < 26; z += 2) { const cxm = x + 1, czm = z + 1; if (inPond(cxm, czm) || inB(cxm, czm)) continue; const d = Math.max(Math.abs(cxm) - PW / 2, Math.abs(czm) - PD / 2); if (d > 9 && !(cxm > 18 && cxm < 28)) continue;
      const q = [[x, z], [x + 2, z], [x + 2, z + 2], [x, z], [x + 2, z + 2], [x, z + 2]]; const l = 0.95 + r() * 0.06; c.set('#cdbf9c').multiplyScalar(l); for (const [qx, qz] of q) { P.push(qx, Math.max(HL(qx, qz) + 0.16, Math.max(Math.abs(qx) - PW / 2, Math.abs(qz) - PD / 2) < 4 ? y0 + 0.22 : y0 - 0.05), qz); C.push(c.r, c.g, c.b); } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); gg.computeVertexNormals(); K.V.push(gg);
    for (let z = -PD / 2 + 1; z < PD / 2; z += 2.6) { K.V.push(part(new THREE.BoxGeometry(0.16, 0.7, 0.16), '#bdb6a6', PW / 2 + 1.6, y0 + 0.5, z)); if (z + 2.6 < PD / 2) K.V.push(part(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 4), '#3a3028', PW / 2 + 1.6, y0 + 0.72, z + 1.3, Math.PI / 2, 0, 0)); } }
  // ---- 묶어 그리기: 돌 · 꼭짓점 색 · 지붕 · 창호 · 단청 = 5번 ----
  const stoneM = new THREE.MeshLambertMaterial({ map: stoneTex(11), vertexColors: true }), latM = new THREE.MeshLambertMaterial({ map: latticeTex(), vertexColors: true, emissive: '#ffcf8a', emissiveIntensity: 0 }); latM.emissiveMap = latM.map;
  const meshes = [[K.S, stoneM], [K.V, vcMat()], [K.R, roofMat()], [K.L, latM], [K.D, new THREE.MeshLambertMaterial({ map: dcTex(), vertexColors: true })]];
  for (const [list, m] of meshes) { const geo = list === K.V ? merge(list) : mergeUV(list); const mesh = new THREE.Mesh(geo, m); mesh.castShadow = list !== K.V; g.add(mesh); }
  lit(A, (L) => { latM.emissiveIntensity = L * 0.75; });
  // 연못 · 집 자리의 지도 나무는 치운다
  const treeOut = (x, z) => { const dx = x - POND[0], dz = z - POND[1], lx = dx * Math.cos(HROT) - dz * Math.sin(HROT), lz = dx * Math.sin(HROT) + dz * Math.cos(HROT); return (Math.abs(lx) < PW / 2 + 3 && Math.abs(lz) < PD / 2 + 3) || (Math.abs(lx - bx) < 6 && Math.abs(lz - bz) < 7) || (Math.abs(lx - ex0) < 6 && Math.abs(lz - ez0) < 10) || (Math.abs(lx - jx) < 15 && lz < -14 && lz > -54); };
  // 칸 나무는 나중에 심기기도 해서 몇 번 더 치운다 · 멀리서는 가라앉힌 물을 끈다 (항상 그리는 물이라 언덕 너머로 비칠 수 있다)
  const undo = [hideTrees(hg, treeOut)]; let tT = 0, tN = 0;
  A.huwonY = { y0, wy, by, jy, ey };
  return { group: g, tick(dt) { tT += dt; if (tT > 2 && tN < 12) { tT = 0; tN++; undo.push(hideTrees(hg, treeOut)); } water.visible = lid.visible = Math.hypot(hg.px - POND[0], hg.pz - POND[1]) < 220; water.material.userData.U.uT.value += dt; }, dispose() { for (const u of undo.reverse()) u(); g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'huwon', name: '창덕궁 후원 부용지', seal: '후원', icon: '🪷', x: hw2(4, 21)[0], z: hw2(4, 21)[1], r: 26, buildR: 900, verb: '연못가 거닐기',
  go: [...hw2(4, 23), Math.PI + HROT], intro: '네모난 연못 · 가운데 둥근 섬 · 연못에 발을 담근 부용정 · 언덕 위 주합루',
  build: buildHuwon,
  start(A) {
    const hg = A.hg, Y = A.huwonY; if (!Y) return null;
    const v3 = (lx, y, lz) => { const [x, z] = hw2(lx, lz); return new THREE.Vector3(x, y, z); };
    // 남쪽 둑(부용정 동쪽)에 서서 사진과 같은 방향(북)을 본다: 부용정 → 섬 · 주합루 → 영화당 순으로 고개를 돌리고, 동쪽 둑을 따라 걷는다
    const looks = [v3(-6, Y.by + 1.6, 13), v3(-3, Y.jy + 4.5, -46), v3(30, Y.ey + 3, -8)];
    const E = { title: '창덕궁 후원 부용지', lock: true,
      status() { return this.t < 26 ? (this.t < 13 ? '남쪽 연못가에서 부용지를 둘러봐요' : '동쪽 둑을 따라 걸어요') + ` · ${Math.ceil(26 - this.t)}초` : '다 둘러봤어요'; },
      tick() { const t = this.t, k = clamp((t - 13) / 13, 0, 1), lx = 5.5 + k * 15, lz = 18.5 - k * 24, [x, z] = hw2(lx, lz); hg.px = x; hg.pz = z; hg.y = 0; hg.v = t > 13 ? 1.4 : 0; hg.face = t > 13 ? Math.PI + HROT - 0.6 : Math.PI + HROT - 0.3; if (t > 27) A.finish(E); },
      cam(camera, dt) {
        const t = this.t; let pos, look;
        if (t < 13) { const s = clamp(t / 12, 0, 1), u = s * s * (3 - 2 * s) * 2, i = Math.min(1, Math.floor(u)), f = u - i; pos = v3(9, Y.y0 + 1.75, 21.5); look = looks[i].clone().lerp(looks[i + 1], f); }
        else { const k = clamp((t - 13) / 13, 0, 1); pos = v3(3.2 + k * 15.5, Y.y0 + 1.9, 20.5 - k * 24); look = v3(-4 + k * 2, Y.y0 + 2.2, 4 - k * 14); }
        if (!this.cp) this.cp = pos.clone(); this.cp.lerp(pos, 1 - Math.exp(-dt * 3)); camera.position.copy(this.cp); (this.lk ||= look.clone()).lerp(look, 1 - Math.exp(-dt * 3)); camera.lookAt(this.lk);
      },
      end() { const [x, z] = hw2(4, 23); hg.placeAt(x, z, Math.PI + HROT); }, where() { return '창덕궁 후원 부용지'; } };
    return E;
  },
});
