// 젤리 서울 러너 랜딩: 게임 엔진으로 실시간 3D 렌더링 — 스크롤에 맞춰 카메라가 장면 안을 미끄러지듯 날아간다
//   window.SW_FILM = { P, N } (landing.js 가 스크롤로 정한다: P = 장면 번호 + 장면 안 진행 0 ~ 1)
//   최적화: 지도는 단계별로 쉬어 가며 만든다(스크롤 중 멈춤 없게) · 기기 등급(그래픽 칩 · 코어 수)으로 시작해 그리는 속도를 보며 해상도 · 그림자 · 빛 번짐을 낮추고 올린다
//          사람 · 차 계산은 1초에 30번까지, 장면이 화면 밖이거나 탭이 숨으면 멈춘다
import * as THREE from 'three';
import { Hangang } from '/dream-runner/js/hangang.js';
import { makePost } from '/dream-runner/js/hangang-post.js';
import { makeBear } from '/dream-runner/js/runner.js';

const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t, ease = (x) => x * x * (3 - 2 * x);
// 장면: 지도 · 시각 · 계절 · 날씨 · 카메라 길 (route = 코스를 따라 미끄러지기, orbit = 건물 둘레를 돌며 다가가기)
export const SCENES = [
  { map: 'yeouido', hour: 18.15, season: 'summer', weather: 'clear', cam: { type: 'orbit', lm: '63빌딩', az0: 214, az1: 204, d0: 580, d1: 490, el0: 18, el1: 15, ty0: 95, ty1: 85 } },
  { map: 'jamsil', hour: 13.6, season: 'spring', weather: 'clear', cam: { type: 'route', near: '롯데월드타워', back0: 420, back1: 200, lat: 3, h0: 4.5, h1: 10, ahead: 30, lookH: 5, toward: 0.42, towardH: 150 } },
  { map: 'hongdae', hour: 18.55, season: 'summer', weather: 'clear', cam: { type: 'route', s0: 260, s1: 400, lat: 0.5, h0: 2.6, h1: 3.4, ahead: 46, lookH: 5 } },
  { map: 'insadong', hour: 17.3, season: 'winter', weather: 'snow', cam: { type: 'route', s0: 120, s1: 250, lat: 0, h0: 2.8, h1: 3.6, ahead: 40, lookH: 4.5 } },
  { map: 'namsan', hour: 20.6, season: 'autumn', weather: 'clear', cam: { type: 'orbit', lm: '남산서울타워', az0: 130, az1: 195, d0: 230, d1: 150, el0: 115, el1: 95, ty0: 175, ty1: 160 } },
  { map: 'yeouido', hour: 20.8, season: 'summer', weather: 'clear', cam: { type: 'orbit', lm: '63빌딩', az0: 150, az1: 205, d0: 1500, d1: 1050, el0: 60, el1: 40, ty0: 90, ty1: 110 } },
];

// 기기 등급: 그래픽 칩 이름 · 코어 수로 처음 정하고, 그리는 속도를 보며 고친다
function gpuTier(renderer) {
  let name = ''; try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { /* 모름 */ }
  if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 0;
  let t = /intel|uhd|iris|mali|adreno|powervr|apple gpu/i.test(name) ? 1 : 2; if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) t = Math.min(t, 1); return t;
}

export function start3d(canvas, opt = {}) {
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch { return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 등급별 시작: 2 높음(그림자 · 빛 번짐 · 1.25배) · 1 보통(그림자 끔 · 1배) · 0 낮음(빛 번짐도 끔 · 0.75배 · 1초 30장)
  const qp = new URLSearchParams(location.search), tier = qp.has('tier') ? +qp.get('tier') : gpuTier(renderer);
  // 등급별: 해상도 · 그림자 · 빛 번짐(낮은 해상도로) · 스크롤 중 최대 장 수 · 사람 · 차 계산 횟수
  const dpr = devicePixelRatio || 1, Q = [
    { pr: 0.7, prMax: 0.8, shadows: false, bloom: false, bloomScale: 0.35, maxFps: 30, simHz: 15 },
    { pr: Math.min(dpr, 0.85), prMax: Math.min(dpr, 1), shadows: false, bloom: true, bloomScale: 0.35, maxFps: 30, simHz: 20 },
    { pr: Math.min(dpr, 1.15), prMax: Math.min(dpr, 1.4), shadows: true, bloom: true, bloomScale: 0.5, maxFps: 30, simHz: 30 },
  ][cl(tier, 0, 2)];
  Q.fps30 = Q.maxFps <= 30;
  const cam = new THREE.PerspectiveCamera(52, 1, 0.5, 24000), api = (p) => fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const maps = new Map(); // 지도 이름 → { hg, post, look }
  function size() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); for (const m of maps.values()) m.post?.setSize?.(w, h); }
  const applyQ = () => { renderer.setPixelRatio(Q.pr); renderer.shadowMap.enabled = Q.shadows; size(); };
  addEventListener('resize', size); applyQ();
  // 지도 관리: 지금 · 앞 · 뒤 장면의 지도만 둔다(나머지는 내려 메모리 ↓). 지금 장면 지도가 없으면 바로, 아니면 스크롤을 멈췄을 때(0.5초)만 불러온다(스크롤 중 멈칫 없게)
  let loading = null, lastScroll = 0, firstDone = false;
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  window.SW_HAS = (i) => maps.has(SCENES[i]?.map); // 이 장면 지도가 준비됐나 (안 됐으면 랜딩이 같은 장면 그림을 대신 보인다)
  const sceneIdx = () => { const F = window.SW_FILM; return F ? cl(Math.floor(F.P), 0, SCENES.length - 1) : 0; };
  const wantMaps = (i) => [...new Set([SCENES[i].map, SCENES[Math.min(SCENES.length - 1, i + 1)].map, SCENES[Math.max(0, i - 1)].map])];
  function dropMap(id) { const m = maps.get(id); if (!m) return; maps.delete(id); m.post.dispose?.(); m.hg.scene.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const x of ms) { for (const k of ['map', 'emissiveMap', 'normalMap', 'alphaMap']) x[k]?.dispose?.(); x.dispose?.(); } }); for (const S of SCENES) if (S.map === id) S._c = null; }
  async function loadMap(id) {
    loading = id;
    try {
      if (!firstDone) opt.onProgress?.(0.15, '서울을 불러오는 중'); const hg = new Hangang(); hg.api = api; await hg.load(id, { steps: true }); if (!firstDone) opt.onProgress?.(0.8, '장면을 준비하는 중');
      hg.enter(makeBear({ color: '#e8344a' }), {}); hg.opt = { ...hg.opt, season: 'set', weather: 'set', time: 'set', flow: 0, cam: 0 };
      const post = makePost(renderer, hg.scene, cam, { bloomScale: Q.bloomScale }); maps.set(id, { hg, post, look: new THREE.Vector3() }); size(); firstDone = true;
    } catch (e) { console.warn('장면 지도를 못 불렀어요', id, e); if (!firstDone) opt.onFail?.(); }
    loading = null;
  }
  setInterval(() => {
    if (loading) return; const i = sceneIdx(), want = wantMaps(i), now = performance.now();
    for (const id of [...maps.keys()]) if (!want.includes(id) && maps.size > 2) dropMap(id);
    const need = want.find((id) => !maps.has(id)); if (!need) return;
    if (need === SCENES[i].map || !firstDone || now - lastScroll > 500) loadMap(need);
  }, 250);
  // 장면 카메라 길
  const lmCenter = (hg, name) => { const fs = (hg.foot || []).filter((f) => f.name === name); if (!fs.length) return null; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0; for (const f of fs) { x0 = Math.min(x0, f.x0); x1 = Math.max(x1, f.x1); z0 = Math.min(z0, f.z0); z1 = Math.max(z1, f.z1); h = Math.max(h, f.h); } return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, h }; };
  const nearS = (hg, p) => { let best = 0, bd = Infinity; hg.rp.forEach(([x, z], i) => { const d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best * hg.step; };
  const vp = new THREE.Vector3(), vl = new THREE.Vector3(), vt = new THREE.Vector3();
  function pose(S, hg, t, wob) {
    const C = S.cam;
    if (C.type === 'orbit') { const c = (S._c ||= lmCenter(hg, C.lm)) || { x: 0, z: 0, h: 100 }; const az = THREE.MathUtils.degToRad(lerp(C.az0, C.az1, t)) + Math.sin(wob * 0.3) * 0.004, d = lerp(C.d0, C.d1, t); vp.set(c.x + Math.sin(az) * d, lerp(C.el0, C.el1, t), c.z + Math.cos(az) * d); vl.set(c.x, lerp(C.ty0, C.ty1, t), c.z); return null; }
    let s0 = C.s0, s1 = C.s1, tw = null; if (C.near) { tw = S._c ||= lmCenter(hg, C.near); const sn = tw ? nearS(hg, tw) : hg.L / 2; s0 = sn - C.back0; s1 = sn - C.back1; }
    const s = cl(lerp(s0, s1, t), 4, hg.L - 60), [x, z] = hg.world(s, C.lat), [ax, az] = hg.world(s + C.ahead, C.lat * 0.5); vp.set(x, lerp(C.h0, C.h1, t) + Math.sin(wob) * 0.06, z); vl.set(ax, C.lookH, az);
    if (tw && C.toward) vl.lerp(vt.set(tw.x, C.towardH, tw.z), C.toward);
    return s;
  }
  let last = performance.now(), lastDraw = 0, cur = -1, visible = true, wob = 0, simAcc = 0, ready = false, ema = 16, evalT = 0, goodT = 0;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
  function frame(now) {
    requestAnimationFrame(frame);
    // 스크롤 중엔 최대 장 수, 멈춰 있으면 1초 24장 (가만히 있을 때 그래픽 칩을 덜 쓴다)
    const active = now - lastScroll < 1200, minGap = active ? 1000 / Q.maxFps : 1000 / 24; if (now - lastDraw < minGap - 2) return;
    const raw = now - last; last = now; lastDraw = now; const dt = Math.min(0.05, raw / 1000);
    if (!visible || document.hidden) return;
    const F = window.SW_FILM; if (!F) return; const i = cl(Math.floor(F.P), 0, SCENES.length - 1), t = cl(F.P - i, 0, 1), S = SCENES[i], M = maps.get(S.map);
    if (!M) { canvas.style.opacity = '0'; return; }
    const hg = M.hg;
    if (cur !== i) { cur = i; hg.state.hour = S.hour; hg.state.weather = S.weather; if (hg.state.season !== S.season) { hg.state.season = S.season; hg.applySeason(); } M.post.mood?.(hg.light); }
    wob += dt; const s = pose(S, hg, t, wob);
    // 보이지 않는 곰을 카메라 가까이 두어 둘레에 사람 · 차가 다니게 (계산은 1초에 30번까지)
    if (s != null) { const [bx, bz] = hg.world(s + 18, -4.3); hg.px = bx; hg.pz = bz; } else { hg.px = vl.x + (vp.x - vl.x) * 0.15; hg.pz = vl.z + (vp.z - vl.z) * 0.15; }
    simAcc += dt; if (simAcc >= 1 / Q.simHz) { hg.y = 0; hg.v = 0; hg.update(Math.min(simAcc, 0.1), { mx: 0, mz: 0 }, cam); simAcc = 0; if (hg.bear) hg.bear.root.visible = false; if (hg.shadow) hg.shadow.visible = false; }
    cam.position.copy(vp); M.look.lerp(vl, M.look.lengthSq() ? 1 - Math.exp(-dt * 12) : 1); cam.lookAt(M.look); if (cam.fov !== 52) { cam.fov = 52; cam.updateProjectionMatrix(); }
    // 장면 끝 · 처음은 어둡게 녹아 넘어간다 (다른 장면으로 순간이동하는 것이 보이지 않게)
    const fade = Math.min(ease(cl(t / 0.12)), ease(cl((1 - t) / 0.12))); canvas.style.opacity = (i === 0 ? (t < 0.5 ? 1 : fade) : fade).toFixed(3);
    if (Q.bloom) M.post.render(); else renderer.render(hg.scene, cam);
    if (!ready && i === 0) { ready = true; opt.onReady?.(); }
    // 그리는 속도 보기: 2초마다. 느리면(평균 26ms 넘게) 해상도부터 낮추고, 그다음 그림자 · 빛 번짐. 아주 빠르면 해상도를 조금 올린다
    if (active) { ema = ema * 0.9 + Math.min(raw, 200) * 0.1; evalT += dt; }
    if (evalT > 1) { evalT = 0; const slow = ema > (Q.fps30 ? 40 : 22);
      if (slow) { goodT = 0; if (Q.pr > 0.56) Q.pr = Math.max(0.55, +(Q.pr * 0.85).toFixed(2)); else if (Q.shadows) Q.shadows = false; else if (Q.bloom) Q.bloom = false; else { Q.fps30 = true; Q.maxFps = 30; } applyQ(); }
      else if (ema < 13 && (goodT += 1) >= 5 && Q.pr < Q.prMax) { goodT = 0; Q.pr = Math.min(Q.prMax, +(Q.pr + 0.1).toFixed(2)); applyQ(); } }
  }
  requestAnimationFrame(frame);
  return { maps, Q };
}
