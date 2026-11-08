// 젤리 서울 산책 랜딩: 게임 엔진으로 실시간 3D 렌더링 — 스크롤에 맞춰 카메라가 장면 안을 미끄러지듯 날아간다
//   장면마다 그 동네 지도를 불러 둔다(첫 장면 먼저, 나머지는 뒤에서 하나씩). 아직 안 불러온 장면은 그림(같은 장면을 게임에서 찍은 것)이 대신 보인다
//   window.SW_FILM = { P, N } (landing.js 가 스크롤로 정한다: P = 장면 번호 + 장면 안 진행 0 ~ 1)
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

export function start3d(canvas) {
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cam = new THREE.PerspectiveCamera(52, 1, 0.5, 24000), api = (p) => fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  const maps = new Map(); // 지도 이름 → { hg, post, ready }
  const size = () => { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); for (const m of maps.values()) m.post?.setSize?.(w, h); };
  addEventListener('resize', size); size();
  // 지도 불러오기: 장면 순서대로 하나씩
  const order = [...new Set(SCENES.map((s) => s.map))];
  (async () => { for (const id of order) { try { const hg = new Hangang(); hg.api = api; await hg.load(id); hg.enter(makeBear({ color: '#e8344a' }), {}); hg.opt = { ...hg.opt, season: 'set', weather: 'set', time: 'set', flow: 0, cam: 0 }; const post = makePost(renderer, hg.scene, cam); maps.set(id, { hg, post, ready: true, look: new THREE.Vector3() }); size(); } catch (e) { console.warn('장면 지도를 못 불렀어요', id, e); } } })();
  // 장면 카메라 길
  const lmCenter = (hg, name) => { const fs = (hg.foot || []).filter((f) => f.name === name); if (!fs.length) return null; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0; for (const f of fs) { x0 = Math.min(x0, f.x0); x1 = Math.max(x1, f.x1); z0 = Math.min(z0, f.z0); z1 = Math.max(z1, f.z1); h = Math.max(h, f.h); } return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, h }; };
  const nearS = (hg, p) => { let best = 0, bd = Infinity; hg.rp.forEach(([x, z], i) => { const d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best * hg.step; };
  function pose(S, hg, t, wob) {
    const C = S.cam, out = { p: new THREE.Vector3(), l: new THREE.Vector3() };
    if (C.type === 'orbit') { const c = (S._c ||= lmCenter(hg, C.lm)) || { x: 0, z: 0, h: 100 }; const az = THREE.MathUtils.degToRad(lerp(C.az0, C.az1, t)) + wob * 0.004, d = lerp(C.d0, C.d1, t); out.p.set(c.x + Math.sin(az) * d, lerp(C.el0, C.el1, t), c.z + Math.cos(az) * d); out.l.set(c.x, lerp(C.ty0, C.ty1, t), c.z); return out; }
    let s0 = C.s0, s1 = C.s1, tw = null; if (C.near) { tw = S._c ||= lmCenter(hg, C.near); const s = tw ? nearS(hg, tw) : hg.L / 2; s0 = s - C.back0; s1 = s - C.back1; }
    const s = cl(lerp(s0, s1, t), 4, hg.L - 60), [x, z] = hg.world(s, C.lat), [ax, az] = hg.world(s + C.ahead, C.lat * 0.5); out.p.set(x, lerp(C.h0, C.h1, t) + Math.sin(wob) * 0.06, z); out.l.set(ax, C.lookH, az);
    if (tw && C.toward) out.l.lerp(new THREE.Vector3(tw.x, C.towardH, tw.z), C.toward);
    return { ...out, s };
  }
  let last = performance.now(), cur = -1, visible = true, wob = 0;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!visible || document.hidden) return;
    const F = window.SW_FILM; if (!F) return; const i = cl(Math.floor(F.P), 0, SCENES.length - 1), t = cl(F.P - i, 0, 1), S = SCENES[i], M = maps.get(S.map);
    if (!M) { canvas.style.opacity = '0'; return; }
    const hg = M.hg;
    if (cur !== i) { cur = i; hg.state.hour = S.hour; hg.state.weather = S.weather; if (hg.state.season !== S.season) { hg.state.season = S.season; hg.applySeason(); } M.post.mood?.(hg.light); }
    wob += dt; const P0 = pose(S, hg, t, wob);
    // 곰(보이지 않게)을 카메라 가까이 두어 둘레에 사람 · 차가 다니게
    if (P0.s != null) { const [bx, bz] = hg.world(P0.s + 18, -4.3); hg.px = bx; hg.pz = bz; } else { hg.px = P0.l.x + (P0.p.x - P0.l.x) * 0.15; hg.pz = P0.l.z + (P0.p.z - P0.l.z) * 0.15; }
    hg.y = 0; hg.v = 0; hg.update(dt, { mx: 0, mz: 0 }, cam); if (hg.bear) hg.bear.root.visible = false; if (hg.shadow) hg.shadow.visible = false;
    cam.position.copy(P0.p); M.look.lerp(P0.l, M.look.lengthSq() ? 1 - Math.exp(-dt * 12) : 1); cam.lookAt(M.look); cam.fov = 52; cam.updateProjectionMatrix();
    // 장면 끝 · 처음은 어둡게 녹아 넘어간다 (다른 장면으로 순간이동하는 것이 보이지 않게)
    const fade = Math.min(ease(cl(t / 0.12)), ease(cl((1 - t) / 0.12))); canvas.style.opacity = (i === 0 ? Math.max(fade, t < 0.5 ? 1 : 0) : fade).toFixed(3);
    M.post.render();
  }
  requestAnimationFrame(frame);
  return { maps };
}
