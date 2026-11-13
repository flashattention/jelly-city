// 🗺️ 서울 맵 그리기 (러너-개선 6-7): 젤리 서울 러너의 서울 전체 엔진(Hangang 'seoul')으로 실제 서울을 그리고,
//   러너 판정(곧은 길 s · x · y)은 그대로 둔 채 길 · 장애물 · 곰 · 카메라를 그 코스의 실제 경로 선 위로 휘어 놓는다
//   - 칸: 지금 코스 · 다음 코스가 지나는 2km 칸만 불러오고, 지난 코스 칸은 내린다 (하나씩, 쉬어 가며)
//   - 휘기: 물체마다 s = origin - z 자리의 길 방향 · 높이로 (판정 좌표는 그대로라 기록 다시 돌리기와 같다)
//   - 하늘 · 빛 · 시간 · 날씨 · 계절: 서울 산책 것 그대로 (코스마다 낮 · 노을 · 밤)
import * as THREE from 'three';
import { Hangang } from './hangang.js';
import { ROUTES } from './seoul-routes.js';
import { SEOUL_U0, seoulCourseOf, seoulLaneW, seoulSpan } from './seouls.js';
import { speedAt } from './track.js';
import { isPhone } from '../../shared/js/perf.js';

// 코스 길 둘레: 건물은 RB m, 길 · 녹지 · 물은 RR m 안만 짓는다 (휴대폰은 더 좁게). RT = 칸 고르는 반지름
const RB = isPhone ? 190 : 260, RR = isPhone ? 260 : 340, RT = RR;
const HOUR = { 낮: 13.2, 노을: 18.35, 밤: 21.3 };
const SEASON = () => { const m = new Date().getMonth() + 1; return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter'; };

// 코스 길: 4m 간격 점. 밖(시작 전 · 끝 뒤)은 끝 방향으로 곧게 늘인다
class RoutePath {
  constructor(R) {
    this.R = R; const p = R.pts, n = p.length / 2; this.n = n; this.x = new Float64Array(n); this.z = new Float64Array(n); this.acc = new Float64Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = p[i * 2] / 10; this.z[i] = p[i * 2 + 1] / 10; if (i) this.acc[i] = this.acc[i - 1] + Math.hypot(this.x[i] - this.x[i - 1], this.z[i] - this.z[i - 1]); }
    this.len = this.acc[n - 1]; this.h = null;
  }
  idx(u) { let i = Math.max(1, Math.min(this.n - 1, Math.floor(u / 4) + 1)); while (i > 1 && this.acc[i - 1] > u) i--; while (i < this.n - 1 && this.acc[i] < u) i++; return i; }
  pos(u, out) {
    const i = this.idx(u), a = this.acc[i - 1], b = this.acc[i], k = (u - a) / (b - a || 1);
    out.x = this.x[i - 1] + (this.x[i] - this.x[i - 1]) * k; out.z = this.z[i - 1] + (this.z[i] - this.z[i - 1]) * k; out.i = i; out.k = k; return out;
  }
  // 그 자리 길 방향 (앞뒤 7m 를 이어서 매끈하게) · 땅 높이
  frame(u, out) {
    const A = this.pos(u - 7, { x: 0, z: 0 }), B = this.pos(u + 7, { x: 0, z: 0 }); this.pos(u, out);
    let tx = B.x - A.x, tz = B.z - A.z; const L = Math.hypot(tx, tz) || 1; out.tx = tx / L; out.tz = tz / L;
    out.y = this.h ? this.hAt(u) : 0; return out;
  }
  hAt(u) { const f = Math.max(0, Math.min(this.n - 1.001, u / 4)), i = Math.floor(f), k = f - i; return this.h[i] * (1 - k) + this.h[Math.min(this.n - 1, i + 1)] * k; }
  // 지형 높이를 경로 점마다 (앞뒤 12m 평균: 50m 격자 지형이라 그대로 쓰면 꺾인다)
  //   6-10: 평균만 쓰면 볼록한 곳 · 옆으로 기운 길에서 곰이 땅에 묻혔다 → 레인 폭 양끝 · 가운데 지형 중 가장 높은 것보다는 내려가지 않게
  sampleH(hw, half = 4.5) {
    const raw = new Float32Array(this.n), top = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { const a = Math.max(0, i - 1), b = Math.min(this.n - 1, i + 1), dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
      raw[i] = hw.terrAt(this.x[i], this.z[i]); top[i] = Math.max(raw[i], hw.terrAt(this.x[i] + nx * half, this.z[i] + nz * half), hw.terrAt(this.x[i] - nx * half, this.z[i] - nz * half)); }
    const h = new Float32Array(this.n); for (let i = 0; i < this.n; i++) { let s = 0, c = 0; for (let j = -3; j <= 3; j++) { const q = i + j; if (q < 0 || q >= this.n) continue; s += raw[q]; c++; } h[i] = s / c; }
    // 높은 쪽으로 올린 뒤 앞뒤 4m 만 한 번 더 고르게 (계단처럼 튀지 않게, 그래도 땅 위)
    for (let i = 0; i < this.n; i++) h[i] = Math.max(h[i], top[i]);
    const h2 = new Float32Array(this.n); for (let i = 0; i < this.n; i++) h2[i] = Math.max(top[i], (h[Math.max(0, i - 1)] + h[i] * 2 + h[Math.min(this.n - 1, i + 1)]) / 4);
    // 6-11: 칸을 지을 때 물가 지형(lowerLakes · maskWater)이 바뀌어도 이미 지어 둔 길 · 땅 그물은 예전 높이에 남는다.
    //   길 높이는 한 번 올라간 곳에서 내려가지 않게 (내려가면 곰 · 장애물이 그 그물 속에 묻혔다 · 청계천 1.9m)
    if (this.h && this.h.length === h2.length) for (let i = 0; i < this.n; i++) h2[i] = Math.max(h2[i], this.h[i]);
    this.h = h2;
  }
}
const PATHS = ROUTES.map((R) => new RoutePath(R));
// 달리는 길 띠 무늬: 아스팔트 결 · 흰 가장자리 · 노란 가운데 점선 (8m 한 번)
let PATH_M = null, LANE_M = null;
function pathTex() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#5a5d61'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 900; i++) { const v = 70 + Math.floor(Math.random() * 40); g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`; g.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 1.5); }
  g.fillStyle = '#e9e6dc'; g.fillRect(2, 0, 2, 256); g.fillRect(60, 0, 2, 256);
  g.fillStyle = '#f2c53d'; g.fillRect(31, 0, 2.4, 128);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class SeoulRun {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera; this.hw = null; this.ready = false; this.loading = null; this.want = []; this.t = 0;
    this.F = { x: 0, z: 0, y: 0, tx: 0, tz: -1 }; this.M = new THREE.Matrix4(); this.R = new THREE.Matrix4(); this.v = new THREE.Vector3();
  }
  // 서울 전체 엔진 준비 (지형 · 하늘 · 빛 · 먼 풍경). 칸은 아직
  async init() {
    if (this.hw) return this.initP;
    const hw = (this.hw = new Hangang());
    hw.onCompile = (obj) => (this.renderer.compileAsync ? this.renderer.compileAsync(obj, this.camera, hw.scene) : null);
    this.initP = hw.load('seoul').then(() => {
      hw.opt = { ...hw.opt, season: 'fixed', weather: 'fixed', time: 'fixed', flow: 0 }; hw.state.season = SEASON(); hw.state.weather = 'clear'; hw.state.hour = 13; hw.applySeason();
      hw.lat = 999; if (hw.shadow) hw.shadow.visible = false;
      PATHS.forEach((P, c) => P.sampleH(hw, seoulLaneW(c) / 2));
      this.ready = true;
    }).catch((e) => { this.failed = true; throw e; });
    return this.initP;
  }
  // 이번 판 시작: 첫 코스 칸부터 불러온다 (track 은 씨앗으로 코스 순서가 정해진 뒤)
  start(track) { this.track = track; this.course = -1; this.flashT = 0; this.tick(0, 0, true); this.weather(); }
  // 날씨는 지금 서울 날씨 그대로 (서울 산책과 같은 서버 도시 정보, 5분마다). 못 받으면 맑음
  weather() {
    if (!this.api || (this.cityAt && Date.now() - this.cityAt < 300000)) return; this.cityAt = Date.now();
    this.api('/api/seoul/city?area=' + encodeURIComponent('여의도')).then((c) => { if (!c || c.rain === undefined) return; this.hw.state.weather = /눈/.test(c.rain) ? 'snow' : c.rain ? 'rain' : /흐림|구름/.test(c.sky || '') ? 'cloudy' : 'clear'; }).catch(() => {});
  }
  pathOf(dream) { return PATHS[seoulCourseOf(this.track, dream)]; }
  // 판정 좌표(s) → 그 코스 길 위 거리(u)
  uOf(s, dream) { return s - this.track.bounds[dream] + SEOUL_U0; }
  // 코스 c 의 길 구간(u0 ~ u1)이 지나는 칸
  tilesOf(c, u0, u1, r) {
    const P = PATHS[c], T = this.hw.world0.tile, out = new Map(), q = { x: 0, z: 0 };
    for (let u = Math.max(0, u0); u <= Math.min(P.len, u1); u += 20) { P.pos(u, q); for (const a of [-r, 0, r]) for (const b of [-r, 0, r]) { const key = `${Math.floor((q.x + a) / T)}_${Math.floor((q.z + b) / T)}`; if (!this.hw.tileHave.has(key)) continue; const d = u - u0 + Math.hypot(a, b); if (!out.has(key) || out.get(key) > d) out.set(key, d); } }
    return [...out.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  }
  // 그 코스가 달릴 길 끝(u): 코스 길이 = seoulSpan(시작 빠르기 × 60초, 길 끝까지) + 문 자리
  endU(c, d) { const tr = this.track, s0 = tr.bounds[d] ?? tr.nextB, s1 = tr.bounds[d + 1]; return s1 != null ? this.uOf(s1, d) + 40 : SEOUL_U0 + 14 + seoulSpan(c, speedAt(s0)) + 60; }
  // 불러올 것: 지금 코스 남은 길 · 다음 코스 앞부분이 지나는 칸 (코스마다 따로, 그 코스 길 둘레만)
  plan(runnerS) {
    const tr = this.track, d = tr.dreamAt(runnerS), u = this.uOf(runnerS, d), cNow = seoulCourseOf(tr, d), cNext = seoulCourseOf(tr, d + 1);
    const now = this.tilesOf(cNow, u - 60, this.endU(cNow, d), RT).map((t) => ({ t, c: cNow, u1: this.endU(cNow, d) }));
    const next = this.tilesOf(cNext, 0, Math.min(this.endU(cNext, d + 1), 420), RT).map((t) => ({ t, c: cNext, u1: this.endU(cNext, d + 1) }));
    this.wantNow = now; this.want = [...now, ...next.filter((w) => !now.some((n) => n.t === w.t && n.c === w.c))];
    this.paths(new Set([cNow, cNext]));
    this.show(cNow);
    return this.want;
  }
  // 지금 코스 조각(과 그 조각이 지을 때 빼 둔 건물을 가진 조각)만 보인다. 다음 코스 칸은 몇 km 떨어져 있어도 화면 쪽이면 그려져서 그리기 호출만 늘었다
  show(cNow) {
    const hw = this.hw, mine = [...hw.chunks.entries()].filter(([k]) => +k.split('_')[2] === cNow).map(([, c]) => c), on = new Set(mine);
    for (const c of mine) for (const d2 of c.deps || []) on.add(d2);
    for (const c of hw.chunks.values()) c.scene.visible = on.has(c);
    for (const [c, m] of this.pathMs || []) if (m) m.visible = c === cNow;
    this.shown = cNow;
  }
  // 첫 코스 칸이 다 지어졌나 (카운트다운이 기다린다)
  firstReady() { return !!this.wantNow && this.wantNow.every((w) => this.hw.chunks.has(`${w.t}_${w.c}`) || this.hw.chunkFail?.has(`${w.t}_${w.c}`)); }
  tick(dt, runnerS, force = false) {
    const hw = this.hw; if (!this.ready || !this.track) return;
    this.planT = (this.planT || 0) - dt; if (this.planT <= 0 || force) { this.planT = 0.5; this.plan(runnerS); }
    if (hw.chunkLoading) return;
    // 내리기: 바라지 않는 코스 조각을 하나씩. 다만 지금 바라는 조각이 지을 때 빼 둔(이 조각이 먼저 지은) 건물이 있으면 남긴다 (내리면 구멍이 난다)
    const keys = new Set(this.want.map((w) => `${w.t}_${w.c}`)), live = [...hw.chunks.entries()].filter(([k2]) => keys.has(k2)).map(([, c2]) => c2);
    for (const [key, c] of hw.chunks) if (!keys.has(key) && !live.some((c2) => c2.deps?.includes(c))) { hw.unloadChunk(key); this.onChunk?.(); return; }
    const w = this.want.find((q) => !hw.chunks.has(`${q.t}_${q.c}`) && !hw.chunkFail?.has(`${q.t}_${q.c}`)); if (!w) return;
    const key = `${w.t}_${w.c}`, same = [...hw.chunks.entries()].filter(([k2]) => k2.startsWith(`${w.t}_`)).map(([, c2]) => c2);
    hw.chunkLoading = key;
    hw.loadChunk(key, () => this.pick(w.t, w.c, w.u1, same)).then((c) => { c.kept = c.map.__kept; c.deps = same; hw.chunks.set(key, c); for (const c2 of hw.chunks.values()) if (c2.chunkKey.startsWith(`${w.t}_`)) this.cullRoute(c2, w.c); if (this.shown != null) this.show(this.shown); for (const P of PATHS) if (P.R.tiles.includes(w.t)) P.sampleH(hw); this.onChunk?.(); })
      .catch((e) => { console.warn('서울 칸', key, e); (hw.chunkFail ||= new Set()).add(key); }).finally(() => { hw.chunkLoading = null; });
  }
  // 칸 지도에서 코스 길 둘레(건물 RB · 길 · 녹지 RR)만 남긴다 (seoul-run-worker.js, 따로 스레드에서)
  //   같은 칸의 다른 코스 조각(same)이 이미 지은 것은 뺀다 (겹쳐 그리면 깜빡인다)
  pick(tile, c, u1, same) {
    this.worker ||= new Worker(new URL('./seoul-run-worker.js', import.meta.url));
    this.wq ||= new Map(); this.worker.onmessage ||= (e) => { const f = this.wq.get(e.data.id); if (f) { this.wq.delete(e.data.id); f(e.data); } };
    const P = PATHS[c], pts = [], q = { x: 0, z: 0 }; for (let u = 0; u <= Math.min(P.len, u1); u += 8) { P.pos(u, q); pts.push(q.x, q.z); }
    const taken = {}; for (const c2 of same) for (const [f, idx] of Object.entries(c2.kept || {})) (taken[f] ||= []).push(...idx);
    const id = (this.wid = (this.wid || 0) + 1), [ti, tj] = tile.split('_'), url = new URL(`../seoul/t_${ti}_${tj}.json`, import.meta.url).href;
    return new Promise((ok, no) => { this.wq.set(id, (d) => (d.error ? no(new Error(d.error)) : ok({ ...d.M, __kept: d.kept }))); this.worker.postMessage({ id, url, pts, RB, RR, taken, half: seoulLaneW(c) / 2 }); });
  }
  // 판정 좌표 → 세상 좌표 행렬: 곧은 길의 (0, 0, z) 를 그 코스 길 위 점으로, -z 를 길 방향으로
  //   dream 을 주면 그 코스 길로 (카메라: 곰이 있는 코스)
  bendM(z, dream, out) {
    const tr = this.track, s = tr.origin - z, d = dream ?? tr.dreamAt(s), P = this.pathOf(d), F = P.frame(this.uOf(s, d), this.F);
    const yaw = Math.atan2(-F.tx, -F.tz); out.makeRotationY(yaw); out.setPosition(F.x, F.y, F.z); this.M.makeTranslation(0, 0, -z); return out.multiply(this.M);
  }
  // 곧은 길 자리 점 → 세상 점
  world(p, dream, out = new THREE.Vector3()) { this.bendM(p.z, dream, this.R); return out.copy(p).applyMatrix4(this.R); }
  // 판정 자리 물체(트랙 · 곰 · 그림자 · 다른 사람)를 휘어 놓는다
  //   dream 을 주면 모두 그 코스 길로 (다른 곰: 보는 사람 코스)
  bend(objs, dream) {
    for (const o of objs) { if (!o) continue; o.matrixAutoUpdate = false; o.updateMatrix(); this.bendM(o.position.z, dream, this.R); o.matrix.premultiply(this.R); o.matrixWorldNeedsUpdate = true; }
  }
  unbend(objs) { for (const o of objs) if (o) { o.matrixAutoUpdate = true; o.updateMatrix(); } }
  // 매 프레임: 하늘 · 빛 · 신호등 · 먼 나무 숨기기
  frame(dt, camera, px, pz, th, dream) {
    const hw = this.hw; if (!this.ready) return;
    if (dream != null && this.track) { const c = seoulCourseOf(this.track, dream); if (c !== this.shown) this.show(c); } this.t += dt; hw.t += dt; hw.time = (hw.time || 0) + dt;
    const want = HOUR[th?.course?.time] ?? 13; if (this.hourTo !== want) { this.hourTo = want; if (this.hourJump || hw.state.hour == null) hw.state.hour = want; this.hourJump = false; }
    hw.state.hour += (this.hourTo - hw.state.hour) * Math.min(1, dt * 3);
    hw.tickEnv(dt, camera, px, pz); hw.tickSignals(hw.time);
    // 먼 나무 칸 · 작은 것 숨기기 (서울 산책 tickWorld 와 같은 거리)
    this.lodT = (this.lodT || 0) - dt; if (this.lodT <= 0) { this.lodT = 0.4; const R = 1100;
      // 6-11: 먼 땅(200m 성긴 격자 · 초록)을 지금 코스 칸이 있는 곳에서는 40m 내린다 (서울 산책은 tickWorld 가 한다). 안 내리면 비탈에서 길보다 3m 넘게 솟아 곰 · 장애물을 덮었다
      if (hw.farU) { const TL = hw.world0.tile, ti = Math.floor(px / TL), tj = Math.floor(pz / TL), U = hw.farU, have = new Set(); for (const c of hw.chunks.values()) if (c.scene.visible) { const [a, b] = c.chunkKey.split('_'); have.add(`${a}_${b}`); }
        U.uC.value.set(ti, tj); for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) U.uL.value[(b + 2) * 5 + a + 2] = have.has(`${ti + a}_${tj + b}`) ? 1 : 0; }
      for (const c of hw.chunks.values()) c.scene.traverse((o) => { const L = o.userData.lod; if (L) o.count = Math.hypot(L[0] - px, L[1] - pz) < (L[3] ? L[3] : R + 360) ? L[2] : 0; const V = o.userData.lodV; if (V) o.visible = Math.hypot(V[0] - px, V[1] - pz) < V[2]; });
      const v = this.v; for (const o of hw.lodObjs || []) { const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere); v.copy(bs.center).applyMatrix4(o.matrixWorld); o.visible = Math.hypot(v.x - px, v.z - pz) - bs.radius < 400; } }
  }
  // 코스가 바뀌는 순간 시간은 바로 (빛 문으로 하얗게 덮인 동안)
  jumpHour() { this.hourJump = true; this.hourTo = null; }
  dispose() { const hw = this.hw; if (!hw) return; for (const key of [...hw.chunks.keys()]) hw.unloadChunk(key); this.paths(new Set()); }
  // 코스 길 위(레인 + 숲은 나무 갓 만큼 더)에 선 나무는 숨긴다 (숲 속 길에서 화면이 나무 갓으로 덮였다)
  cullRoute(chunk, c) {
    const P = PATHS[c], G = new Map(), GS = 20, q = { x: 0, z: 0 }; for (let u = 0; u <= P.len; u += 4) { P.pos(u, q); const k = `${Math.floor(q.x / GS)},${Math.floor(q.z / GS)}`; if (!G.has(k)) G.set(k, []); G.get(k).push([q.x, q.z]); }
    const half = seoulLaneW(c) / 2, near = (x, z, R) => { const gx = Math.floor(x / GS), gz = Math.floor(z / GS), R2 = R * R; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [px, pz] of G.get(`${gx + a},${gz + b}`) || []) if ((px - x) ** 2 + (pz - z) ** 2 < R2) return true; return false; };
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const T of chunk.treeGroups || []) { const A = T.arr === 'f' ? chunk.forestFill || [] : chunk.trees || [], R = T.arr === 'f' ? half + 4.5 : half + 2.5; let hit = false;
      T.idx.forEach((si, k) => { const p = A[si]; if (!p || !near(p[0], p[1], R)) return; for (const m of T.ms) m?.setMatrixAt(k, zero); hit = true; }); if (hit) for (const m of T.ms) if (m) m.instanceMatrix.needsUpdate = true; }
    // 44-2: 골목에 세워 둔 스쿠터 · 쓰레기봉투가 차로 위(레인 폭/2 + 0.8m 안)에 있으면 숨긴다 (곰이 그 속을 지나가 숨은 장애물처럼 보였다)
    { const M4 = new THREE.Matrix4(); chunk.scene.traverse((o) => { if (!o.isInstancedMesh || !o.userData.alleyProp) return; let hit = false; for (let i = 0; i < o.instanceMatrix.count; i++) { o.getMatrixAt(i, M4); const e = M4.elements; if (e[0] === 0 && e[5] === 0) continue; if (near(e[12], e[14], half + 0.8)) { o.setMatrixAt(i, zero); hit = true; } } if (hit) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere?.(); } }); }
    this.cullPoles(chunk, c);
    this.carveLane(chunk, c);
  }
  // 6-12: 달리는 차로 위(가운데에서 레인 폭/2 + 0.6m 안) · 길 높이 + 0.35 ~ 7m 에 걸친 면을 잘라 낸다
  //   다리 경사로 · 낮은 상판 · 시설물이 곰 · 장애물 · 카메라를 가렸다(여의도 · 서울숲). 다리는 칸마다 한 그물로 묶여 있어 면 단위로 자른다
  //   땅 · 길 바닥 층(renderOrder < -40)과 인스턴스(나무 · 기둥은 cullRoute · cullPoles 가 따로)는 건드리지 않는다
  carveLane(chunk, c) {
    const P = PATHS[c], GS = 10, G = new Map(), q = { x: 0, z: 0 };
    for (let u = 0; u <= P.len; u += 2) { P.pos(u, q); const k = `${Math.floor(q.x / GS)},${Math.floor(q.z / GS)}`; if (!G.has(k)) G.set(k, []); G.get(k).push(q.x, q.z, u); }
    const R = seoulLaneW(c) / 2 + 0.6, R2 = R * R;
    // 점(x, y, z)이 차로 위 높이 창 안인가
    const inLane = (x, y, z) => { const gx = Math.floor(x / GS), gz = Math.floor(z / GS); let bu = -1, bd = R2; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = G.get(`${gx + a},${gz + b}`); if (!L) continue; for (let i = 0; i < L.length; i += 3) { const d = (L[i] - x) ** 2 + (L[i + 1] - z) ** 2; if (d < bd) { bd = d; bu = L[i + 2]; } } } if (bu < 0) return false; const dy = y - P.hAt(bu); return dy > 0.35 && dy < 7; };
    const v = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), done = (this.carved ||= new WeakMap()), uses = new Map();
    chunk.scene.traverse((o) => { if (o.geometry) uses.set(o.geometry, (uses.get(o.geometry) || 0) + 1); });
    let cut = 0;
    chunk.scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || (o.renderOrder || 0) < -40 || !o.geometry?.attributes?.position) return; { let S = done.get(o); if (!S) done.set(o, (S = new Set())); if (S.has(c)) return; S.add(c); }
      o.updateWorldMatrix(true, false); const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count, M = o.matrixWorld;
      if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(M);
      // 칸 안 차로와 상자가 안 겹치면 건너뛴다
      let near = false; for (const [k, L] of G) { for (let i = 0; i < L.length && !near; i += 3) if (L[i] > bb.min.x - R && L[i] < bb.max.x + R && L[i + 1] > bb.min.z - R && L[i + 1] < bb.max.z + R) near = true; if (near) break; } if (!near) return;
      let ia = null;
      const at = (k, out) => out.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(M);
      for (let t = 0; t + 2 < n; t += 3) {
        at(t, A); at(t + 1, B); at(t + 2, C);
        let hit = inLane((A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3, (A.z + B.z + C.z) / 3);
        if (!hit) for (const [p1, p2] of [[A, B], [B, C], [C, A], [A, A], [B, B], [C, C]]) { v.addVectors(p1, p2).multiplyScalar(0.5); if (inLane(v.x, v.y, v.z)) { hit = true; break; } }
        if (!hit) continue;
        if (!ia) { const own = (uses.get(g) || 0) <= 1, g2 = own ? g : g.clone(); if (!own) o.geometry = g2; if (!g2.index) { const arr = new Uint32Array(pos.count); for (let k = 0; k < arr.length; k++) arr[k] = k; g2.setIndex(new THREE.BufferAttribute(arr, 1)); } ia = g2.index; }
        const k0 = ia.getX(t); ia.setX(t + 1, k0); ia.setX(t + 2, k0); cut++;
      }
      if (ia) ia.needsUpdate = true;
    });
    if (cut) (this.carveN = (this.carveN || 0) + cut);
  }
  // 6-9 9-1: 판정 차로(레인 폭/2 + 0.7) 안에 선 기둥(전봇대 · 가로등 · 신호등)은 차로 밖(+0.3m)으로 민다. 민 자리가 건물 안이면 숨긴다. 판정은 주지 않는다
  //   기둥에 딸린 것(팔 · 등 · 변압기 · 불빛 웅덩이 · 빛 방울 · 전깃줄 끝)도 같이 옮긴다. 도로명판 기둥(3.6m)은 판이 묶여 있어 그대로 (길 모퉁이라 차로 밖)
  cullPoles(chunk, c) {
    const P = PATHS[c], R = seoulLaneW(c) / 2 + 0.7, GS = 20, G = new Map(), segs = [], a = { x: 0, z: 0 }, b = { x: 0, z: 0 };
    for (let u = 4; u <= P.len; u += 4) { P.pos(u - 4, a); P.pos(u, b); const sg = [a.x, a.z, b.x, b.z], k = `${Math.floor(a.x / GS)},${Math.floor(a.z / GS)}`; if (!G.has(k)) G.set(k, []); G.get(k).push(segs.push(sg) - 1); }
    // 가장 가까운 코스 길 선분: { d 옆 거리, px pz 길 위 점 }
    const nearest = (x, z) => { let best = null; const gx = Math.floor(x / GS), gz = Math.floor(z / GS); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const si of G.get(`${gx + i},${gz + j}`) || []) { const [ax, az, bx, bz] = segs[si], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz); if (!best || d < best.d) best = { d, px, pz, si }; } return best; };
    const moved = [];
    for (const list of chunk.circGrid?.values() || []) for (const ci of list) {
      if (ci.r > 0.25 || ci.h < 4 || ci.h > 10 || ci.poleDone === c) continue; ci.poleDone = c;
      const q = nearest(ci.x, ci.z); if (!q || q.d >= R) continue;
      let nx = ci.x - q.px, nz = ci.z - q.pz;
      // 길 선 바로 위면 오른쪽으로
      if (Math.hypot(nx, nz) < 0.05) { const [ax, az, bx, bz] = segs[q.si]; nx = -(bz - az); nz = bx - ax; }
      const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      // 민 자리가 건물 안이어도 벽이 1.2m 안쪽이면 벽에 붙여 세운다(골목 전봇대처럼 팔 · 등 · 전깃줄은 골목 위로). 더 깊으면 숨긴다
      const tx = q.px + nx * (R + 0.3), tz = q.pz + nz * (R + 0.3), inB = (d) => chunk.groundAt?.(q.px + nx * d, q.pz + nz * d, 9999) > 0, hide = inB(R + 0.3) && inB(R - 0.9);
      moved.push({ x: ci.x, z: ci.z, dx: tx - ci.x, dz: tz - ci.z, hide }); if (hide) ci.hidden = true; else { ci.x = tx; ci.z = tz; }
    }
    if (!moved.length) return;
    const MG = new Map(), mk = (x, z) => `${Math.floor(x / 5)},${Math.floor(z / 5)}`; moved.forEach((m, i) => { const k = mk(m.x, m.z); if (!MG.has(k)) MG.set(k, []); MG.get(k).push(i); });
    const pole = (x, z, r) => { let best = null, bd = r; const gx = Math.floor(x / 5), gz = Math.floor(z / 5); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const mi of MG.get(`${gx + i},${gz + j}`) || []) { const m = moved[mi], d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } } return best; };
    const M = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    chunk.scene.traverse((o) => {
      if (o.isInstancedMesh) {
        let hit = false; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); const e = M.elements, x = e[12], z = e[14]; if (Math.abs(e[13] - this.hw.terrAt(x, z)) > 0.8) continue; const m = pole(x, z, 1.9); if (!m) continue;
          if (m.hide) o.setMatrixAt(i, zero); else { e[12] += m.dx; e[14] += m.dz; o.setMatrixAt(i, M); } hit = true; }
        if (hit) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere?.(); }
      } else if (o.isPoints || o.isLineSegments) {
        // 빛 방울(등 높이 점) · 전깃줄(이웃 전봇대 사이 7 마디, 끝이 기둥에서 0.6m 옆)
        const p = o.geometry.attributes.position; if (!p) return; let hit = false;
        if (o.isPoints) { for (let i = 0; i < p.count; i++) { if (p.getY(i) < 4) continue; const m = pole(p.getX(i), p.getZ(i), 3); if (!m) continue; if (m.hide) p.setY(i, -1e4); else { p.setX(i, p.getX(i) + m.dx); p.setZ(i, p.getZ(i) + m.dz); } hit = true; } }
        else if (o.material?.color?.getHex?.() === 0x2a2a2c && p.count % 14 === 0) for (let w = 0; w < p.count; w += 14) {
          const A = pole(p.getX(w), p.getZ(w), 1.2), B = pole(p.getX(w + 13), p.getZ(w + 13), 1.2); if (!A && !B) continue; hit = true;
          for (let j = 0; j < 14; j++) { const t = (Math.floor(j / 2) + (j % 2)) / 7, i = w + j; if (A?.hide || B?.hide) { p.setY(i, -1e4); continue; } p.setX(i, p.getX(i) + (A ? A.dx * (1 - t) : 0) + (B ? B.dx * t : 0)); p.setZ(i, p.getZ(i) + (A ? A.dz * (1 - t) : 0) + (B ? B.dz * t : 0)); } }
        if (hit) { p.needsUpdate = true; o.geometry.computeBoundingSphere(); }
      }
    });
    this.poleMoved = (this.poleMoved || 0) + moved.filter((m) => !m.hide).length; this.poleHidden = (this.poleHidden || 0) + moved.filter((m) => m.hide).length;
  }
  // 달리는 길 띠: 코스 길이 찻길 · 골목 위가 아닌 곳(한강 공원 산책로 · 광장 · 잔디)에 짙은 아스팔트 띠 + 노란 가운데 점선 + 흰 가장자리 (한강 자전거길처럼)
  //   서울 산책은 지역 지도에서 이 띠를 깔았다. 서울 전체 칸에는 없어 러너가 그 코스 길 위에 깐다
  paths(want) {
    this.pathMs ||= new Map();
    for (const [c, m] of this.pathMs) if (!want.has(c)) { if (m) { this.hw.scene.remove(m); m.traverse((o) => o.geometry?.dispose()); } this.pathMs.delete(c); }
    for (const c of want) if (!this.pathMs.has(c)) { const m = this.pathMesh(c); this.pathMs.set(c, m); if (m) this.hw.scene.add(m); }
  }
  pathMesh(c) {
    const g = new THREE.Group(), rib = this.ribbon(c), ln = this.laneLines(c); if (rib) g.add(rib); if (ln) g.add(ln); g.userData.noDrape = true; return g;
  }
  // 6-10: 달리는 길(레인 3개)이 어디까지인지 늘 보이게 양쪽 끝선 · 레인 점선 (넓은 공원 · 광장에서 길과 배경이 헷갈렸다)
  //   빛을 받지 않는 재질이라 밤에도 은은하게 보인다. 코스 하나에 그리기 1번
  laneLines(c) {
    const P = PATHS[c], hw = this.hw, half = seoulLaneW(c) / 2, pos = [], col = [], idx = [], a = { x: 0, z: 0 };
    const strip = (off, w, u0, u1, r, g2, b) => { const base = pos.length / 3; let k = 0;
      for (let u = u0; u <= u1 + 0.01; u += Math.min(2, u1 - u0) || 2) { const F = P.frame(u, a), nx = -F.tz, nz = F.tx;
        for (const sd of [-1, 1]) { const px = F.x + nx * (off + (sd * w) / 2), pz = F.z + nz * (off + (sd * w) / 2); pos.push(px, Math.max(hw.terrAt(px, pz), F.y) + 0.1, pz); col.push(r, g2, b); }
        if (k) { const q = base + k * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); } k++; } };
    for (const sd of [-1, 1]) strip(sd * half, 0.24, 0, P.len, 1, 0.93, 0.72);
    for (const sd of [-1, 1]) for (let u = 0; u < P.len - 2; u += 6) strip((sd * half) / 3, 0.12, u, u + 2.6, 0.95, 0.95, 0.95);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    LANE_M ||= new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true });
    const m = new THREE.Mesh(geo, LANE_M); m.renderOrder = 2; m.userData.noDrape = true; return m;
  }
  ribbon(c) {
    const P = PATHS[c], sf = P.R.sf || '', hw = this.hw, W = seoulLaneW(c) + 0.6, pos = [], uv = [], idx = [], a = { x: 0, z: 0 };
    const on = (u) => { const ch = sf[Math.max(0, Math.min(sf.length - 1, Math.floor(u / 20)))]; return ch === 'p' || ch === '-'; };
    let run = null; const flush = () => { if (run && run.length > 1) { const base = pos.length / 3; run.forEach(([x, z, nx, nz, u], k) => { for (const sd of [-1, 1]) { const px = x + nx * sd * W / 2, pz = z + nz * sd * W / 2; pos.push(px, hw.terrAt(px, pz) + 0.07, pz); uv.push(sd < 0 ? 0 : 1, u / 8); } if (k) { const q = base + k * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); } }); } run = null; };
    for (let u = 0; u <= P.len; u += 4) { if (!on(u)) { flush(); continue; } const F = P.frame(u, a); (run ||= []).push([F.x, F.z, -F.tz, F.tx, u]); }
    flush(); if (!pos.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    PATH_M ||= new THREE.MeshLambertMaterial({ map: pathTex(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    const m = new THREE.Mesh(g, PATH_M); m.receiveShadow = true; m.userData.noDrape = true; return m;
  }
}
