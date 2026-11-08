// 젤리 서울 러너 랜딩 3D — 웹 워커에서 그린다 (OffscreenCanvas). 메인 스레드는 스크롤 · 글자만 맡아 늘 부드럽고, 3D 는 여기서 1초 30장(약한 기기 20장 · 가만히 있으면 24장)
//   메인 → 워커: init { canvas, w, h, dpr, tier } · resize { w, h } · film { P, active } · vis { v }
//   워커 → 메인: progress { k, s } · ready · fail · has { list: 준비된 장면 번호 }
//   엔진 모듈은 서버가 워커용으로 바꿔 준 것(?w=1: 'three' → jsDelivr ESM)을 쓴다
self.window = self;
// 워커 안 오류는 메인으로 보내 콘솔에 (워커 콘솔은 잘 안 보여서)
self.addEventListener('error', (e) => self.postMessage({ type: 'log', msg: 'error ' + (e.message || e) }));
self.addEventListener('unhandledrejection', (e) => self.postMessage({ type: 'log', msg: 'reject ' + (e.reason?.stack || e.reason) }));
// 엔진은 글씨 · 무늬 그림을 document.createElement('canvas') 로 만든다 → 워커에선 OffscreenCanvas 로
self.document = { createElement: (tag) => { const c = new OffscreenCanvas(1, 1); c.style = {}; return c; } };

const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
const SCENES = [
  { map: 'yeouido', hour: 18.15, season: 'summer', weather: 'clear', cam: { type: 'orbit', lm: '63빌딩', az0: 214, az1: 204, d0: 580, d1: 490, el0: 18, el1: 15, ty0: 95, ty1: 85 } },
  { map: 'jamsil', hour: 13.6, season: 'spring', weather: 'clear', cam: { type: 'route', near: '롯데월드타워', back0: 420, back1: 200, lat: 3, h0: 4.5, h1: 10, ahead: 30, lookH: 5, toward: 0.42, towardH: 150 } },
  { map: 'hongdae', hour: 18.55, season: 'summer', weather: 'clear', cam: { type: 'route', s0: 260, s1: 400, lat: 0.5, h0: 2.6, h1: 3.4, ahead: 46, lookH: 5 } },
  { map: 'insadong', hour: 17.3, season: 'winter', weather: 'snow', cam: { type: 'route', s0: 120, s1: 250, lat: 0, h0: 2.8, h1: 3.6, ahead: 40, lookH: 4.5 } },
  { map: 'namsan', hour: 20.6, season: 'autumn', weather: 'clear', cam: { type: 'orbit', lm: '남산서울타워', az0: 130, az1: 195, d0: 230, d1: 150, el0: 115, el1: 95, ty0: 175, ty1: 160 } },
  { map: 'yeouido', hour: 20.8, season: 'summer', weather: 'clear', cam: { type: 'orbit', lm: '63빌딩', az0: 150, az1: 205, d0: 1500, d1: 1050, el0: 60, el1: 40, ty0: 90, ty1: 110 } },
];

let THREE, Hangang, makePost, makeBear, renderer, cam, Q, W = 1, H = 1, P = 0, active = false, lastActive = 0, visible = true;
const maps = new Map();
const post = (m) => self.postMessage(m);
const tellHas = () => post({ type: 'has', list: SCENES.map((S, i) => (maps.has(S.map) ? i : -1)).filter((i) => i >= 0) });

function gpuTier() {
  let name = ''; try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { /* 모름 */ }
  if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 0;
  let t = /intel|uhd|iris|mali|adreno|powervr|apple gpu/i.test(name) ? 1 : 2; if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) t = Math.min(t, 1); return t;
}
function size() { renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); for (const m of maps.values()) m.post.setSize(W, H); }
const applyQ = () => { renderer.setPixelRatio(Q.pr); renderer.shadowMap.enabled = Q.shadows; size(); };

// ---------- 지도: 지금 · 앞 · 뒤 장면 것만, 스크롤이 멈췄을 때 불러온다 ----------
let loading = null, firstDone = false;
const sceneIdx = () => cl(Math.floor(P), 0, SCENES.length - 1);
const wantMaps = (i) => [...new Set([SCENES[i].map, SCENES[Math.min(SCENES.length - 1, i + 1)].map, SCENES[Math.max(0, i - 1)].map])];
function dropMap(id) { const m = maps.get(id); if (!m) return; maps.delete(id); m.post.dispose?.(); m.hg.scene.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const x of ms) { for (const k of ['map', 'emissiveMap', 'normalMap', 'alphaMap']) x[k]?.dispose?.(); x.dispose?.(); } }); for (const S of SCENES) if (S.map === id) S._c = null; tellHas(); }
async function loadMap(id) {
  loading = id;
  try {
    if (!firstDone) post({ type: 'progress', k: 0.2, s: '서울을 불러오는 중' }); const hg = new Hangang(); hg.api = (p) => fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))); await hg.load(id, { steps: true }); if (!firstDone) post({ type: 'progress', k: 0.85, s: '장면을 준비하는 중' });
    hg.enter(makeBear({ color: '#e8344a' }), {}); hg.opt = { ...hg.opt, season: 'set', weather: 'set', time: 'set', flow: 0, cam: 0 };
    const pp = makePost(renderer, hg.scene, cam, { bloomScale: Q.bloomScale }); maps.set(id, { hg, post: pp, look: new THREE.Vector3() }); size(); firstDone = true; tellHas();
  } catch (e) { post({ type: 'log', msg: 'loadMap ' + id + ' ' + (e?.stack || e) }); if (!firstDone) post({ type: 'fail' }); }
  loading = null;
}
setInterval(() => {
  if (!renderer || loading) return; const i = sceneIdx(), want = wantMaps(i), now = performance.now();
  for (const id of [...maps.keys()]) if (!want.includes(id) && maps.size > 2) dropMap(id);
  const need = want.find((id) => !maps.has(id)); if (!need) return;
  if (need === SCENES[i].map || !firstDone || now - lastActive > 500) loadMap(need);
}, 250);

// ---------- 카메라 길 ----------
const lmCenter = (hg, name) => { const fs = (hg.foot || []).filter((f) => f.name === name); if (!fs.length) return null; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0; for (const f of fs) { x0 = Math.min(x0, f.x0); x1 = Math.max(x1, f.x1); z0 = Math.min(z0, f.z0); z1 = Math.max(z1, f.z1); h = Math.max(h, f.h); } return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, h }; };
const nearS = (hg, p) => { let best = 0, bd = Infinity; hg.rp.forEach(([x, z], i) => { const d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best * hg.step; };
let vp, vl, vt;
function pose(S, hg, t, wob) {
  const C = S.cam;
  if (C.type === 'orbit') { const c = (S._c ||= lmCenter(hg, C.lm)) || { x: 0, z: 0, h: 100 }; const az = THREE.MathUtils.degToRad(lerp(C.az0, C.az1, t)) + Math.sin(wob * 0.3) * 0.004, d = lerp(C.d0, C.d1, t); vp.set(c.x + Math.sin(az) * d, lerp(C.el0, C.el1, t), c.z + Math.cos(az) * d); vl.set(c.x, lerp(C.ty0, C.ty1, t), c.z); return null; }
  let s0 = C.s0, s1 = C.s1, tw = null; if (C.near) { tw = S._c ||= lmCenter(hg, C.near); const sn = tw ? nearS(hg, tw) : hg.L / 2; s0 = sn - C.back0; s1 = sn - C.back1; }
  const s = cl(lerp(s0, s1, t), 4, hg.L - 60), [x, z] = hg.world(s, C.lat), [ax, az] = hg.world(s + C.ahead, C.lat * 0.5); vp.set(x, lerp(C.h0, C.h1, t) + Math.sin(wob) * 0.06, z); vl.set(ax, C.lookH, az);
  if (tw && C.toward) vl.lerp(vt.set(tw.x, C.towardH, tw.z), C.toward);
  return s;
}

// ---------- 그리기: 1초 30장(약한 기기 20장), 가만히 있으면 24장. 느리면 해상도 → 그림자 → 빛 번짐 순으로 낮춘다 ----------
let last = 0, lastDraw = 0, cur = -1, wob = 0, simAcc = 0, ready = false, ema = 30, evalT = 0, goodT = 0;
const raf = self.requestAnimationFrame ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 16);
function frame(now) {
  raf(frame); if (!visible) return;
  const act = now - lastActive < 1200, gap = 1000 / (act ? Q.maxFps : Math.min(24, Q.maxFps)); if (now - lastDraw < gap - 2) return;
  const raw = last ? now - last : 33; last = now; lastDraw = now; const dt = Math.min(0.06, raw / 1000);
  const i = sceneIdx(), t = cl(P - i, 0, 1), S = SCENES[i], M = maps.get(S.map); if (!M) return;
  const hg = M.hg;
  if (cur !== i) { cur = i; hg.state.hour = S.hour; hg.state.weather = S.weather; if (hg.state.season !== S.season) { hg.state.season = S.season; hg.applySeason(); } M.post.mood?.(hg.light); }
  wob += dt; const s = pose(S, hg, t, wob);
  if (s != null) { const [bx, bz] = hg.world(s + 18, -4.3); hg.px = bx; hg.pz = bz; } else { hg.px = vl.x + (vp.x - vl.x) * 0.15; hg.pz = vl.z + (vp.z - vl.z) * 0.15; }
  simAcc += dt; if (simAcc >= 1 / Q.simHz) { hg.y = 0; hg.v = 0; hg.update(Math.min(simAcc, 0.12), { mx: 0, mz: 0 }, cam); simAcc = 0; if (hg.bear) hg.bear.root.visible = false; if (hg.shadow) hg.shadow.visible = false; }
  cam.position.copy(vp); M.look.lerp(vl, M.look.lengthSq() ? 1 - Math.exp(-dt * 12) : 1); cam.lookAt(M.look);
  if (Q.bloom) M.post.render(); else renderer.render(hg.scene, cam);
  if (!ready && i === 0) { ready = true; post({ type: 'ready' }); }
  if (act) { ema = ema * 0.85 + Math.min(raw, 250) * 0.15; evalT += dt; }
  if (evalT > 1) { evalT = 0; const target = 1000 / Q.maxFps;
    if (ema > target * 1.45) { goodT = 0; if (Q.pr > 0.56) Q.pr = Math.max(0.55, +(Q.pr * 0.85).toFixed(2)); else if (Q.shadows) Q.shadows = false; else if (Q.bloom) Q.bloom = false; else if (Q.maxFps > 20) Q.maxFps = 20; applyQ(); }
    else if (ema < target * 1.08 && (goodT += 1) >= 6 && Q.pr < Q.prMax) { goodT = 0; Q.pr = Math.min(Q.prMax, +(Q.pr + 0.08).toFixed(2)); applyQ(); } }
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      self.devicePixelRatio = m.dpr; W = m.w; H = m.h;
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/+esm');
      ({ Hangang } = await import('/dream-runner/js/hangang.js?w=1')); ({ makePost } = await import('/dream-runner/js/hangang-post.js?w=1')); ({ makeBear } = await import('/dream-runner/js/runner.js?w=1'));
      vp = new THREE.Vector3(); vl = new THREE.Vector3(); vt = new THREE.Vector3();
      renderer = new THREE.WebGLRenderer({ canvas: m.canvas, antialias: false, powerPreference: 'high-performance' });
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      cam = new THREE.PerspectiveCamera(52, W / H, 0.5, 24000);
      const tier = m.tier != null ? m.tier : gpuTier(), dpr = m.dpr || 1;
      Q = [
        { pr: 0.7, prMax: 0.8, shadows: false, bloom: false, bloomScale: 0.35, maxFps: 20, simHz: 12 },
        { pr: Math.min(dpr, 0.85), prMax: Math.min(dpr, 1), shadows: false, bloom: true, bloomScale: 0.35, maxFps: 30, simHz: 15 },
        { pr: Math.min(dpr, 1.1), prMax: Math.min(dpr, 1.3), shadows: true, bloom: true, bloomScale: 0.5, maxFps: 30, simHz: 20 },
      ][cl(tier, 0, 2)];
      applyQ(); raf(frame);
    } catch (err) { post({ type: 'log', msg: 'init ' + (err?.stack || err) }); post({ type: 'fail' }); }
  } else if (m.type === 'resize') { W = m.w; H = m.h; if (renderer) size(); }
  else if (m.type === 'film') { P = m.P; if (m.active) lastActive = performance.now(); }
  else if (m.type === 'vis') visible = m.v;
};
