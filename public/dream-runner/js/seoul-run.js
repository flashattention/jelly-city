// 🗺️ 서울 맵 그리기 (러너-개선 6-7): 젤리 서울 러너의 서울 전체 엔진(Hangang 'seoul')으로 실제 서울을 그리고,
//   러너 판정(곧은 길 s · x · y)은 그대로 둔 채 길 · 장애물 · 곰 · 카메라를 그 코스의 실제 경로 선 위로 휘어 놓는다
//   - 칸: 지금 코스 · 다음 코스가 지나는 2km 칸만 불러오고, 지난 코스 칸은 내린다 (하나씩, 쉬어 가며)
//   - 휘기: 물체마다 s = origin - z 자리의 길 방향 · 높이로 (판정 좌표는 그대로라 기록 다시 돌리기와 같다)
//   - 하늘 · 빛 · 시간 · 날씨 · 계절: 서울 산책 것 그대로 (코스마다 낮 · 노을 · 밤)
import * as THREE from 'three';
import { Hangang } from './hangang.js';
import { ROUTES } from './seoul-routes.js';
import { SEOUL_U0, seoulCourseOf } from './seouls.js';
import { DREAM_SEC, speedAt } from './track.js';
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
  sampleH(hw) {
    const raw = new Float32Array(this.n); for (let i = 0; i < this.n; i++) raw[i] = hw.terrAt(this.x[i], this.z[i]);
    const h = new Float32Array(this.n); for (let i = 0; i < this.n; i++) { let s = 0, c = 0; for (let j = -3; j <= 3; j++) { const q = i + j; if (q < 0 || q >= this.n) continue; s += raw[q]; c++; } h[i] = s / c; }
    this.h = h;
  }
}
const PATHS = ROUTES.map((R) => new RoutePath(R));

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
      for (const P of PATHS) P.sampleH(hw);
      this.ready = true;
    }).catch((e) => { this.failed = true; throw e; });
    return this.initP;
  }
  // 이번 판 시작: 첫 코스 칸부터 불러온다 (track 은 씨앗으로 코스 순서가 정해진 뒤)
  start(track) { this.track = track; this.course = -1; this.flashT = 0; this.tick(0, 0, true); }
  pathOf(dream) { return PATHS[seoulCourseOf(this.track, dream)]; }
  // 판정 좌표(s) → 그 코스 길 위 거리(u)
  uOf(s, dream) { return s - this.track.bounds[dream] + SEOUL_U0; }
  // 코스 c 의 길 구간(u0 ~ u1)이 지나는 칸
  tilesOf(c, u0, u1, r) {
    const P = PATHS[c], T = this.hw.world0.tile, out = new Map(), q = { x: 0, z: 0 };
    for (let u = Math.max(0, u0); u <= Math.min(P.len, u1); u += 20) { P.pos(u, q); for (const a of [-r, 0, r]) for (const b of [-r, 0, r]) { const key = `${Math.floor((q.x + a) / T)}_${Math.floor((q.z + b) / T)}`; if (!this.hw.tileHave.has(key)) continue; const d = u - u0 + Math.hypot(a, b); if (!out.has(key) || out.get(key) > d) out.set(key, d); } }
    return [...out.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  }
  // 그 코스가 달릴 길 끝(u): 코스 길이 = 시작 빠르기 × DREAM_SEC + 문 자리
  endU(c, d) { const tr = this.track, s0 = tr.bounds[d] ?? tr.nextB, s1 = tr.bounds[d + 1]; return s1 != null ? this.uOf(s1, d) + 40 : SEOUL_U0 + 14 + DREAM_SEC * speedAt(s0) + 60; }
  // 불러올 것: 지금 코스 남은 길 · 다음 코스 앞부분이 지나는 칸 (코스마다 따로, 그 코스 길 둘레만)
  plan(runnerS) {
    const tr = this.track, d = tr.dreamAt(runnerS), u = this.uOf(runnerS, d), cNow = seoulCourseOf(tr, d), cNext = seoulCourseOf(tr, d + 1);
    const now = this.tilesOf(cNow, u - 60, this.endU(cNow, d), RT).map((t) => ({ t, c: cNow, u1: this.endU(cNow, d) }));
    const next = this.tilesOf(cNext, 0, Math.min(this.endU(cNext, d + 1), 420), RT).map((t) => ({ t, c: cNext, u1: this.endU(cNext, d + 1) }));
    this.wantNow = now; this.want = [...now, ...next.filter((w) => !now.some((n) => n.t === w.t && n.c === w.c))]; return this.want;
  }
  // 첫 코스 칸이 다 지어졌나 (카운트다운이 기다린다)
  firstReady() { return !!this.wantNow && this.wantNow.every((w) => this.hw.chunks.has(`${w.t}_${w.c}`) || this.hw.chunkFail?.has(`${w.t}_${w.c}`)); }
  tick(dt, runnerS, force = false) {
    const hw = this.hw; if (!this.ready || !this.track) return;
    this.planT = (this.planT || 0) - dt; if (this.planT <= 0 || force) { this.planT = 0.5; this.plan(runnerS); }
    if (hw.chunkLoading) return;
    // 내리기: 그 칸을 바라는 코스가 하나도 없을 때 그 칸의 조각을 모두 (한 프레임에 하나씩). 한 칸에 코스 조각이 여럿이면 함께 내린다(서로 겹치는 건물을 나눠 가졌다)
    const tilesWanted = new Set(this.want.map((w) => w.t));
    for (const key of hw.chunks.keys()) { const t = key.split('_').slice(0, 2).join('_'); if (!tilesWanted.has(t)) { hw.unloadChunk(key); this.onChunk?.(); return; } }
    const w = this.want.find((q) => !hw.chunks.has(`${q.t}_${q.c}`) && !hw.chunkFail?.has(`${q.t}_${q.c}`)); if (!w) return;
    const key = `${w.t}_${w.c}`, same = [...hw.chunks.entries()].filter(([k2]) => k2.startsWith(`${w.t}_`)).map(([, c2]) => c2);
    hw.chunkLoading = key;
    hw.loadChunk(key, () => this.pick(w.t, w.c, w.u1, same)).then((c) => { c.kept = c.map.__kept; hw.chunks.set(key, c); for (const P of PATHS) if (P.R.tiles.includes(w.t)) P.sampleH(hw); this.onChunk?.(); })
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
    return new Promise((ok, no) => { this.wq.set(id, (d) => (d.error ? no(new Error(d.error)) : ok({ ...d.M, __kept: d.kept }))); this.worker.postMessage({ id, url, pts, RB, RR, taken }); });
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
  bend(objs) {
    for (const o of objs) { if (!o) continue; o.matrixAutoUpdate = false; o.updateMatrix(); this.bendM(o.position.z, undefined, this.R); o.matrix.premultiply(this.R); o.matrixWorldNeedsUpdate = true; }
  }
  unbend(objs) { for (const o of objs) if (o) { o.matrixAutoUpdate = true; o.updateMatrix(); } }
  // 매 프레임: 하늘 · 빛 · 신호등 · 먼 나무 숨기기
  frame(dt, camera, px, pz, th) {
    const hw = this.hw; if (!this.ready) return; this.t += dt; hw.t += dt; hw.time = (hw.time || 0) + dt;
    const want = HOUR[th?.course?.time] ?? 13; if (this.hourTo !== want) { this.hourTo = want; if (this.hourJump || hw.state.hour == null) hw.state.hour = want; this.hourJump = false; }
    hw.state.hour += (this.hourTo - hw.state.hour) * Math.min(1, dt * 3);
    hw.tickEnv(dt, camera, px, pz); hw.tickSignals(hw.time);
    // 먼 나무 칸 · 작은 것 숨기기 (서울 산책 tickWorld 와 같은 거리)
    this.lodT = (this.lodT || 0) - dt; if (this.lodT <= 0) { this.lodT = 0.4; const R = 1100;
      for (const c of hw.chunks.values()) c.scene.traverse((o) => { const L = o.userData.lod; if (L) o.count = Math.hypot(L[0] - px, L[1] - pz) < (L[3] ? L[3] : R + 360) ? L[2] : 0; const V = o.userData.lodV; if (V) o.visible = Math.hypot(V[0] - px, V[1] - pz) < V[2]; });
      const v = this.v; for (const o of hw.lodObjs || []) { const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere); v.copy(bs.center).applyMatrix4(o.matrixWorld); o.visible = Math.hypot(v.x - px, v.z - pz) - bs.radius < 400; } }
  }
  // 코스가 바뀌는 순간 시간은 바로 (빛 문으로 하얗게 덮인 동안)
  jumpHour() { this.hourJump = true; this.hourTo = null; }
  dispose() { const hw = this.hw; if (!hw) return; for (const key of [...hw.chunks.keys()]) hw.unloadChunk(key); }
}
