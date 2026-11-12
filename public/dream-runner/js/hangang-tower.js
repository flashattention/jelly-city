// 롯데월드타워 안을 모두 체험하기 (8-26): 1층 로비 · 엘리베이터 · 하늘 호텔(로비 · 객실 · 룸서비스 · 펜트하우스) · 하늘 뷔페 · 118층 전망대
//   타워 아래 남쪽 출입구에서 E = 타워로 들어가기. 실내는 서울 밖 먼 곳(O)에 짓는 기존 실내 방식(enterMall)을 쓰고, 지금 있는 층만 짓는다
//   창밖: 실제 탑 자리(10829, 1931) · 그 층 실제 높이에서 바깥 서울을 6면 그림(큐브)으로 그려 창이 보는 방향대로 읽는다 (드물게 한 면씩 새로)
//   체험 하나(exp)가 타워에 있는 동안 내내 이어진다: E(휴대폰은 띠의 단추) = 가까운 것(앉기 · 눕기 · 엘리베이터 …), 띠의 [그만하기] = 타워 밖으로
import * as THREE from 'three';
import { registerAttraction } from './hangang-attractions.js';
import { isPhone } from '../../shared/js/perf.js';
import { windowMat, clamp, lerp, tone, noise, ac, TKit, G, T, canvasTex, txt } from './hangang-tower-lib.js';
import { FLOORS, buildFloor } from './hangang-tower-floors.js';

// 탑 가운데 (OSM 외곽선 가운데) · 1층 출입구 (남쪽 광장 쪽 유리문) · 실내를 짓는 먼 곳
export const TW = { x: 10829, z: 1931 };
const ENT = { x: 10826, z: 1978, nx: 0, nz: 1 };
const O = new THREE.Vector3(126000, 0, 8000);
const BEAR = 0.42;
// 그 높이의 탑 반지름 (밑 반지름 약 43m, 위로 갈수록 0.3배까지 가늘어진다: LANDMARKS 의 taper 와 같게)
export const towerR = (alt) => 43 * (1 - 0.7 * Math.min(1, alt / 555));

// ---------- 창밖 6면 그림 ----------
class SkyView {
  constructor(hg) {
    this.hg = hg; const res = isPhone ? 512 : 1024;
    this.rt = new THREE.WebGLCubeRenderTarget(res, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.cam = new THREE.CubeCamera(30, 26000, this.rt); this.t = 0; this.next = 0; this.queue = []; this.ready = false; this.calls = 0;
  }
  place(x, y, z, near) { this.cam.position.set(x, y, z); for (const c of this.cam.children) { c.near = near; c.far = 26000; c.updateProjectionMatrix(); } this.cam.updateMatrixWorld(true); this.ready = false; }
  all() { this.queue = [0, 1, 2, 3, 4, 5]; }
  // 바깥(숨겨 둔 서울)을 잠깐 켜고 실내 · 곰을 끈 채로 면을 그린다. 안개는 바깥 그대로(높은 곳이라 조금 옅게)
  render(faces, shell) {
    const hg = this.hg, R = globalThis.dream?.renderer, sc = hg.scene; if (!R || !faces.length) return;
    if (this.cam.coordinateSystem !== R.coordinateSystem) { this.cam.coordinateSystem = R.coordinateSystem; this.cam.updateCoordinateSystem(); this.place(this.cam.position.x, this.cam.position.y, this.cam.position.z, this.cam.children[0].near); }
    const on = []; for (const o of hg.hidden || []) if (!o.visible) { o.visible = true; on.push(o); }
    shell.g.visible = false; const bv = hg.bear?.root.visible, sv = hg.shadow?.visible; if (hg.bear) hg.bear.root.visible = false; if (hg.shadow) hg.shadow.visible = false;
    const fog = sc.fog, fc = fog.color.getHex(), fdv = fog.density, wt = hg.state.weather, fd = (wt === 'rain' ? 0.00095 : wt === 'snow' ? 0.0012 : wt === 'cloudy' ? 0.00055 : 0.00042) * (wt === 'clear' ? 0.32 : 0.6);
    if (hg.fogOutC) fog.color.copy(hg.fogOutC); fog.density = fd; const wf = hg.waterU?.fogD.value; if (hg.waterU) hg.waterU.fogD.value = fd;
    const skyP = hg.sky?.position.clone(); if (hg.sky) hg.sky.position.set(this.cam.position.x, 0, this.cam.position.z);
    const au = R.shadowMap.autoUpdate, prev = R.getRenderTarget(), ai = R.info.autoReset; R.shadowMap.autoUpdate = false; R.info.autoReset = false; const c0 = R.info.render.calls;
    for (const i of faces) { R.setRenderTarget(this.rt, i); R.render(sc, this.cam.children[i]); }
    this.calls = R.info.render.calls - c0; R.info.autoReset = ai; R.setRenderTarget(prev); R.shadowMap.autoUpdate = au;
    if (hg.sky) hg.sky.position.copy(skyP); fog.color.setHex(fc); fog.density = fdv; if (hg.waterU) hg.waterU.fogD.value = wf;
    for (const o of on) o.visible = false; shell.g.visible = true; if (hg.bear) hg.bear.root.visible = bv; if (hg.shadow) hg.shadow.visible = sv;
    if (faces.length === 6) this.ready = true;
  }
  // 한 면씩 천천히 새로 (휴대폰은 더 드물게). 시간 · 날씨가 확 바뀌면 여섯 면을 한 프레임에 하나씩
  tick(dt, shell) {
    const hg = this.hg, st = hg.state; this.t += dt;
    if (this.lastH != null && (Math.abs(((st.hour - this.lastH + 36) % 24) - 12) < 11.7 || st.weather !== this.lastW) && !this.queue.length) this.all();
    if (this.queue.length) { this.render([this.queue.shift()], shell); if (!this.queue.length) { this.ready = true; this.lastH = st.hour; this.lastW = st.weather; } return; }
    if (this.t > (isPhone ? 0.9 : 0.45)) { this.t = 0; this.render([this.next], shell); this.next = (this.next + 1) % 6; if (!this.next) { this.lastH = st.hour; this.lastW = st.weather; } }
  }
}

// ---------- 고르기 판 (엘리베이터 단추 · 방 종류 · 메뉴): 누르거나 숫자 키 ----------
const CSS = `
#tw-pick{position:fixed;inset:0;z-index:42;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.45);backdrop-filter:blur(3px)}
#tw-pick.hidden{display:none}
#tw-pick .pg{width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 60px);overflow:auto;border-radius:22px;padding:16px 16px 12px;background:linear-gradient(180deg,#2a2622,#1a1714);color:#f6efe4;font-family:'Jua',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.45);border:1px solid rgba(214,180,120,.35)}
#tw-pick h3{margin:0 0 2px;font-size:20px;color:#e9c98f}
#tw-pick .sub{font-family:system-ui,sans-serif;font-size:12.5px;opacity:.75;margin-bottom:10px}
#tw-pick .o{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-radius:14px;padding:10px 12px;margin-bottom:6px;cursor:pointer;background:rgba(255,255,255,.07);color:inherit;font-family:inherit;font-size:16px}
#tw-pick .o:hover{background:rgba(233,201,143,.18)}
#tw-pick .o[disabled]{opacity:.38;cursor:default}
#tw-pick .o.cur{outline:2px solid rgba(233,201,143,.6)}
#tw-pick .o i{font-style:normal;flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(233,201,143,.16);border:1px solid rgba(233,201,143,.5);font-size:13px}
#tw-pick .o small{display:block;font-family:system-ui,sans-serif;font-size:11.5px;opacity:.7}
#tw-pick .x{width:100%;border:0;border-radius:12px;padding:8px;background:rgba(255,255,255,.1);color:#fff;font-family:inherit;cursor:pointer;margin-top:2px}
#tw-fade{position:fixed;inset:0;z-index:41;background:#05060a;opacity:0;pointer-events:none;transition:opacity 1.1s}
#tw-fade.on{opacity:1}
`;
function ui() {
  if (document.getElementById('tw-pick')) return { pick: document.getElementById('tw-pick'), fade: document.getElementById('tw-fade') };
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const pick = document.createElement('div'); pick.id = 'tw-pick'; pick.className = 'hidden'; document.body.appendChild(pick);
  const fade = document.createElement('div'); fade.id = 'tw-fade'; document.body.appendChild(fade);
  pick.addEventListener('pointerdown', (e) => { if (e.target === pick) closePick(); });
  window.addEventListener('keydown', (e) => { if (pick.classList.contains('hidden')) return; const n = /^Digit([1-9])$/.exec(e.code); if (n) { const b = pick.querySelectorAll('.o')[+n[1] - 1]; if (b && !b.disabled) b.click(); e.stopPropagation(); } if (e.code === 'Escape') closePick(); }, true);
  return { pick, fade };
}
let PICK_CB = null;
function closePick() { const el = document.getElementById('tw-pick'); el?.classList.add('hidden'); const cb = PICK_CB; PICK_CB = null; cb?.(); }
// opts: [{ label, sub, on(), disabled, cur }]
export function choose(title, sub, opts, onClose) {
  const { pick } = ui(); PICK_CB = onClose || null;
  pick.innerHTML = `<div class="pg"><h3>${title}</h3><div class="sub">${sub || ''}</div>${opts.map((o, i) => `<button class="o${o.cur ? ' cur' : ''}"${o.disabled ? ' disabled' : ''}><i>${i + 1}</i><span>${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}</span></button>`).join('')}<button class="x">닫기 (Esc)</button></div>`;
  pick.querySelectorAll('.o').forEach((b, i) => { b.onclick = () => { if (opts[i].disabled) return; PICK_CB = null; pick.classList.add('hidden'); opts[i].on(); }; });
  pick.querySelector('.x').onclick = () => closePick(); pick.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock?.();
}
export const pickOpen = () => !document.getElementById('tw-pick')?.classList.contains('hidden');

// ---------- 소리 ----------
export const SND = {
  ding() { tone([1318.5, 1975.5], { dur: 1.4, vol: 0.09 }); tone([1046.5, 1568], { dur: 1.6, vol: 0.08, at: 0.35 }); },
  door() { noise({ dur: 0.9, vol: 0.05, freq: 380 }); },
  knock() { for (const t of [0, 0.22, 0.44]) noise({ dur: 0.12, vol: 0.5, freq: 220, at: t, q: 4, type: 'bandpass' }); },
  click() { noise({ dur: 0.04, vol: 0.2, freq: 2400, type: 'highpass' }); },
  clink() { tone([2637, 3520], { dur: 0.35, vol: 0.04, type: 'triangle' }); },
  pour() { noise({ dur: 1.1, vol: 0.06, freq: 1600, type: 'bandpass', q: 2 }); },
  note(f) { tone([f, f * 2], { dur: 1.6, vol: 0.08, type: 'triangle', attack: 0.004 }); tone(f * 3, { dur: 0.7, vol: 0.02 }); },
  // 엘리베이터 소리: 낮게 웅웅 (빠를수록 크게) + 귀가 먹먹하게(높은 소리를 깎는다)
  hum(on, k = 0) {
    const a = ac(); if (!a) return; const H = (SND.h ||= {});
    if (on && !H.src) { const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } H.src = a.createBufferSource(); H.src.buffer = buf; H.src.loop = true; H.f = a.createBiquadFilter(); H.f.type = 'lowpass'; H.f.frequency.value = 260; H.g = a.createGain(); H.g.gain.value = 0; H.src.connect(H.f).connect(H.g).connect(a.destination); H.src.start(); }
    if (H.src) { H.g.gain.setTargetAtTime(on ? 0.05 + k * 0.22 : 0, a.currentTime, 0.25); H.f.frequency.setTargetAtTime(160 + k * 220, a.currentTime, 0.3); if (!on) { const s = H.src; setTimeout(() => { try { s.stop(); } catch { /* 이미 멈춤 */ } }, 900); H.src = null; } }
  },
};

// ---------- 실내 껍데기 (빛 · 창 재질 · 6면 그림) ----------
function buildShell(hg) {
  const g = new THREE.Group(); g.position.copy(O); g.visible = false; g.name = 'tower-in'; hg.scene.add(g);
  const hemi = new THREE.HemisphereLight('#ffffff', '#a89880', 0.9), sun = new THREE.DirectionalLight('#ffffff', 1), amb = new THREE.AmbientLight('#ffdcb4', 0);
  if (!isPhone) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = c.bottom = -34; c.right = c.top = 34; c.near = 1; c.far = 160; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; }
  g.add(hemi, sun, sun.target, amb);
  const view = new SkyView(hg), win = windowMat(); win.uniforms.env.value = view.rt.texture;
  const I = {
    g, O, fronts: [], door: { x: 1e9, z: 1e9 }, isTower: true, F: null, win, view, sun, hemi, amb, fog: 0.0004,
    get spawn() { const s = I.F?.spawn?.door || { x: 0, z: 0, face: Math.PI }; return { x: O.x + s.x, z: O.z + s.z, face: s.face }; },
    get box() { const F = I.F; if (!F?.box) return [O.x - 30, O.x + 30, O.z - 30, O.z + 30]; const b = F.box(hg.px - O.x, hg.pz - O.z, hg.y); return [O.x + b[0], O.x + b[1], O.z + b[2], O.z + b[3]]; },
    get near() { return !!I.F?.near; },
    get ceil() { return I.F?.ceil?.(hg.px - O.x, hg.pz - O.z, hg.y) ?? null; },
    tick(dt) {
      const F = I.F; if (!F) return; const sd = hg.skyU.sunDir.value, night = hg.skyU.night.value, up = clamp(sd.y * 4, 0, 1);
      const c = F.center || [0, 0]; sun.target.position.set(c[0], 0, c[1]); sun.position.set(c[0] + sd.x * 70, Math.max(6, sd.y * 70), c[1] + sd.z * 70);
      sun.color.copy(hg.sun.color); sun.intensity = F.noSun ? 0 : up * hg.sun.intensity * (F.sunK ?? 1) * (isPhone ? 0.3 : 0.95);
      hemi.color.copy(hg.skyU.hor.value).lerp(new THREE.Color(F.lampCol || '#fff1de'), 0.4 + night * 0.5); hemi.groundColor.set(F.floorTint || '#b5a58e'); hemi.intensity = lerp(F.hemiN ?? 0.25, F.hemiD ?? 0.95, 1 - night) * (hg.state.weather === 'clear' ? 1 : 0.8);
      amb.intensity = (F.lamps === false ? 0.03 : 1) * night * (F.ambN ?? 0.45);
      const U = win.uniforms; U.uNight.value = night; U.uTime.value = hg.time; U.uRain.value += ((hg.state.weather === 'rain' ? 1 : 0) - U.uRain.value) * Math.min(1, dt * 0.5);
      F.tick?.(dt, night);
      if (!F.noView) view.tick(dt, I);
    },
  };
  return I;
}

// ---------- 상태 · 층 바꾸기 ----------
const S = { hg: null, A: null, shell: null, F: null, key: null, exp: null, near: null, pose: null, elev: null, key2: null, visited: {}, msg: '' };
const D = { name: '롯데월드타워', x: ENT.x, z: ENT.z, nx: ENT.nx, nz: ENT.nz };
const base = () => S.hg.terrAt(TW.x, TW.z, true);
function disposeFloor(F) {
  if (!F) return; F.dispose?.(); F.g.parent?.remove(F.g);
  // 곰(진짜 곰)은 공유 재질이라 떼어 내기만, 이 층이 만든 것만 지운다
  for (const N of F.bears || []) N.b.root.removeFromParent();
  F.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (m.userData.own) { m.map?.dispose(); m.dispose(); } });
  F.atlas?.dispose();
}
// 창밖 카메라 자리: 탑 가운데 · 그 층 눈높이. 가까운 면은 탑 자신(벽 · 아래층 지붕)이 가리지 않게 탑 반지름보다 멀리서부터
function placeView(F) {
  const V = S.shell.view; if (F.noView) return;
  if (F.viewAt) { const [x, y, z, near] = F.viewAt; V.place(x, base() + y, z, near); }
  else V.place(TW.x, base() + F.alt + 1.6, TW.z, towerR(F.alt) + 7);
}
function ctx() { return { hg: S.hg, shell: S.shell, S, O, BEAR, sit, lie, stand, choose, SND, setFloor, enterCar, toast: (t) => S.hg.onToast?.(t), finish: leaveByDoor }; }
function setFloor(key, spawn = 'elev') {
  const sh = S.shell; disposeFloor(S.F); S.pose = null; S.near = null;
  const F = buildFloor(key, ctx()); F.key = key; F.alt = FLOORS[key]?.alt ?? 0; sh.g.add(F.g); S.F = F; sh.F = F; S.key = key; S.visited[key] = true;
  placeView(F); if (!F.noView) { sh.view.render([0, 1, 2, 3, 4, 5], sh); }
  const sp = F.spawn?.[spawn] || F.spawn?.elev || F.spawn?.door; if (sp) { S.hg.placeAt(O.x + sp.x, O.z + sp.z, sp.face); S.hg.y = sp.y || 0; }
  S.last = [S.hg.px, S.hg.pz]; S.hg.camInit = false;
  if (FLOORS[key]?.toast) S.hg.onToast?.(FLOORS[key].toast);
}

// ---------- 자세 (앉기 · 눕기 · 욕조) ----------
//   p: { x, y(앉는 면 높이), z, yaw(앞), label, camD, act?(), sub? } (층 안쪽 좌표)
function sit(p) { S.pose = { kind: 'sit', ...p }; S.hg.v = 0; }
function lie(p) { S.pose = { kind: 'lie', ...p }; S.hg.v = 0; }
function stand() { const P = S.pose; if (!P) return; S.pose = null; const b = S.hg.bear; b.seated = false; b.root.quaternion.identity(); const out = P.out || [P.x + Math.sin(P.yaw) * 0.7, P.z + Math.cos(P.yaw) * 0.7]; S.hg.placeAt(O.x + out[0], O.z + out[1], P.yaw); S.hg.y = P.outY || 0; S.last = [S.hg.px, S.hg.pz]; P.onStand?.(); }

// ---------- 엘리베이터 ----------
function floorOpts() {
  const k2 = S.key2;
  return Object.entries(FLOORS).filter(([k]) => k !== 'car').map(([k, f]) => ({ k, label: f.name, sub: f.soon ? '🚧 곧 열려요' : f.need && k2 !== f.need ? '🔒 프론트(79층)에서 체크인하면 켜져요' : f.sub, disabled: !!f.soon || (!!f.need && k2 !== f.need), cur: k === S.elev?.from }));
}
function pickFloor() {
  choose('🛗 층 단추', '고르면 문이 닫히고 올라가요 · 숫자 키로도', floorOpts().map((o) => ({ ...o, on: () => go(o.k) })));
}
function enterCar() {
  // 탄 뒤 문이 닫힌 칸 안에서 시작 → 층 단추판이 뜬다
  const from = S.key; setFloor('car', 'in'); S.elev = { phase: 'pick', from, t: 0 }; S.F.setDisplay(FLOORS[from].n, 0); S.F.setDoors(0); SND.door(); setTimeout(() => { if (S.elev?.phase === 'pick') pickFloor(); }, 450);
}
function go(to) {
  const E = S.elev; if (!E) return; const a = FLOORS[E.from].n, b = FLOORS[to].n;
  if (to === E.from) { E.phase = 'open'; E.to = to; E.t = 0; S.F.setDoors(0); return; }
  const dur = clamp(4.2 + Math.abs(b - a) * 0.065, 5, 12); Object.assign(E, { phase: 'close', to, t: 0, dur, a, b }); SND.door(); S.F.press?.(b);
}
function tickElev(dt) {
  const E = S.elev, F = S.F; E.t += dt;
  if (E.phase === 'pick') return;
  if (E.phase === 'close') { F.setDoors(0); if (E.t > 1.4) { E.phase = 'move'; E.t = 0; SND.hum(true, 0); } return; }
  if (E.phase === 'move') {
    // 천천히 출발 → 빠르게 → 천천히 멈춤 (가운데가 가장 빠르다)
    const u = clamp(E.t / E.dur, 0, 1), s = u * u * (3 - 2 * u), n = Math.round(lerp(E.a, E.b, s)), v = 6 * u * (1 - u); F.setDisplay(n, Math.sign(E.b - E.a)); SND.hum(true, v); F.shake = v * 0.004;
    if (u >= 1) { SND.hum(false); SND.ding(); E.phase = 'arrive'; E.t = 0; F.shake = 0; F.setDisplay(E.b, 0); }
    return;
  }
  if (E.phase === 'arrive' || E.phase === 'open') { F.setDoors(clamp((E.t - 0.4) / 1.0, 0, 1)); if (E.t > 1.5) { const to = E.to; S.elev = null; setFloor(to, 'elev'); } }
}

// ---------- 나가기 ----------
function leaveByDoor() { const E = S.exp; if (!E) return; S.A.finish(E, !S.visited.obs); if (!S.visited.obs) S.hg.onToast?.('🏙️ 다음엔 118층 전망대까지 올라가 봐요'); }
function leaveTower() {
  const hg = S.hg; closePick(); SND.hum(false); stand(); S.elev = null; disposeFloor(S.F); S.F = null; if (S.shell) S.shell.F = null; S.near = null; S.pose = null;
  if (hg.inMall?.I === S.shell) hg.leaveMall(); if (S.cam0) { S.cam0.cam.near = S.cam0.near; S.cam0.cam.updateProjectionMatrix(); S.cam0 = null; }
  if (hg.bear) { hg.bear.seated = false; hg.bear.root.quaternion.identity(); hg.bear.root.visible = true; }
}

// ---------- 매 프레임 (체험 안) ----------
const _v = new THREE.Vector3();
function tickExp(dt) {
  const hg = S.hg, F = S.F; if (!F || !hg.inMall) return;
  if (S.elev) { tickElev(dt); hg.v = 0; return; }
  // 걸을 수 있는 곳 밖이면 한 축씩 되돌린다 (벽 · 가구를 따라 미끄러지게)
  const lx = hg.px - O.x, lz = hg.pz - O.z, y = hg.y;
  if (F.area && !S.pose) { if (!F.area.ok(lx, lz, y)) { const [px, pz] = S.last || [hg.px, hg.pz]; if (F.area.ok(px - O.x, lz, y)) hg.px = px; else if (F.area.ok(lx, pz - O.z, y)) hg.pz = pz; else { hg.px = px; hg.pz = pz; } } S.last = [hg.px, hg.pz]; }
  // 가까운 것 (0.15초마다)
  S.scan = (S.scan || 0) - dt;
  if (S.scan <= 0 && !S.pose) { S.scan = 0.15; let best = null, bd = Infinity; for (const sp of F.spots || []) { if (sp.when && !sp.when()) continue; if (sp.y != null && Math.abs(hg.y - sp.y) > 1.2) continue; const d = Math.hypot(hg.px - O.x - sp.x, hg.pz - O.z - sp.z); if (d < (sp.r || 1.2) && d < bd) { bd = d; best = sp; } } S.near = best; }
}
function camExp(camera, dt) {
  const hg = S.hg, F = S.F; if (!F) return; if (camera.near > 0.05) { S.cam0 = { cam: camera, near: camera.near }; camera.near = 0.05; camera.updateProjectionMatrix(); }
  const b = hg.bear;
  if (S.elev || F.key === 'car') {
    // 엘리베이터 안: 곰은 가운데 문 쪽을 보고 서 있고, 카메라는 뒤쪽 벽 앞 눈높이
    const C = F.camAt; b.root.position.set(O.x + C.bear[0], 0, O.z + C.bear[1]); b.root.rotation.y = C.face; b.root.visible = true;
    const yaw = C.face + (hg.camYaw - C.face) * 0.6, pt = clamp((hg.camPitch ?? 0.3) - 0.3, -0.5, 0.5), sh = F.shake ? (Math.sin(hg.time * 41) * F.shake) : 0;
    camera.position.set(O.x + C.eye[0] + sh, C.eye[1] + sh * 0.5, O.z + C.eye[2]); camera.up.set(0, 1, 0); camera.lookAt(camera.position.x + Math.sin(yaw) * Math.cos(pt), camera.position.y - Math.sin(pt) - 0.15, camera.position.z + Math.cos(yaw) * Math.cos(pt));
    if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }
    return;
  }
  if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
  // 카메라가 코어 벽 · 큰 가구 속으로 들어가면 곰 쪽으로 당긴다 (벽 안에서 보면 벽이 비쳐 보였다)
  if (!S.pose && F.camRects) { const bx = b.root.position.x - O.x, bz = b.root.position.z - O.z; let cx = camera.position.x - O.x, cz = camera.position.z - O.z, moved = false; for (const [x0, z0, x1, z1] of F.camRects) { if (cx > x0 - 0.25 && cx < x1 + 0.25 && cz > z0 - 0.25 && cz < z1 + 0.25) { let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2, x = bx + (cx - bx) * m, z = bz + (cz - bz) * m; if (x > x0 - 0.25 && x < x1 + 0.25 && z > z0 - 0.25 && z < z1 + 0.25) hi = m; else lo = m; } cx = bx + (cx - bx) * lo; cz = bz + (cz - bz) * lo; moved = true; } } if (moved) { camera.position.x = O.x + cx; camera.position.z = O.z + cz; camera.lookAt(b.root.position.x, b.root.position.y + 0.6, b.root.position.z); } }
  const P = S.pose; if (!P) return;
  // 앉기 · 눕기: 곰을 가구 높이에 맞춰 놓고, 카메라는 그 둘레를 돈다 (마우스 · 끌기로 돌려 보기)
  const wx = O.x + P.x, wz = O.z + P.z; b.seated = P.kind !== 'lie';
  if (P.kind === 'lie') { const hx = Math.sin(P.yaw), hz = Math.cos(P.yaw); b.root.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, Math.atan2(-hx, -hz), 0, 'YXZ')); b.root.position.set(wx - hx * 0.46, P.y + 0.12, wz - hz * 0.46); }
  else { b.root.quaternion.setFromEuler(new THREE.Euler(0, P.yaw, 0)); b.root.position.set(wx, P.y - 0.62 * BEAR + 0.06, wz); b.legs[0].rotation.x = b.legs[1].rotation.x = P.kind === 'bath' ? -1.35 : -1.5; b.inner.position.y = 0; }
  b.root.visible = true; if (hg.shadow) hg.shadow.visible = false;
  const d = P.camD || 2.4, pt = clamp(hg.camPitch ?? 0.35, -0.2, 1.1), yaw = hg.camYaw, cy = P.y + 0.5;
  _v.set(wx - Math.sin(yaw) * Math.cos(pt) * d, cy + Math.sin(pt) * d, wz - Math.cos(yaw) * Math.cos(pt) * d);
  const B = S.shell.box, ce = S.shell.ceil; _v.x = clamp(_v.x, B[0] + 0.3, B[1] - 0.3); _v.z = clamp(_v.z, B[2] + 0.3, B[3] - 0.3); if (ce) _v.y = Math.min(_v.y, ce - 0.2);
  camera.position.copy(_v); camera.up.set(0, 1, 0); camera.lookAt(wx, cy, wz);
}

// ---------- 바깥 출입구 ----------
function buildEntrance(hg) {
  const g = new THREE.Group(), y0 = hg.terrAt(ENT.x, ENT.z - 2.5, true), k = new TKit(); g.position.set(ENT.x, y0, ENT.z - 2.5); g.userData.noDrape = true;
  // 차양: 얇은 유리판 + 금속 테 · 기둥 둘
  k.add(G.box(9, 0.08, 4.4), '#ffffff', 'glass', T(0, 4.6, 2.2)); k.add(G.box(9.1, 0.18, 0.12), '#3c3f44', 'metal', T(0, 4.52, 4.4)); for (const s of [-1, 1]) { k.add(G.box(0.12, 0.18, 4.4), '#3c3f44', 'metal', T(s * 4.5, 4.52, 2.2)); k.add(G.cyl(0.09, 0.09, 4.6, 10), '#3c3f44', 'metal', T(s * 4.3, 0, 4.25)); }
  // 문틀 · 양옆 유리 · 바닥 매트
  k.add(G.box(5.2, 3.4, 0.2), '#ffffff', 'glass', T(0, 0, 0)); for (const s of [-1, 1]) k.add(G.box(0.16, 3.6, 0.3), '#8a6a45', 'metal', T(s * 2.6, 0, 0)); k.add(G.box(5.4, 0.2, 0.3), '#8a6a45', 'metal', T(0, 3.5, 0)); k.add(G.box(3.6, 0.02, 2.2), '#3a3633', 'std', T(0, 0.01, 1.4));
  k.add(G.cyl(1.55, 1.55, 0.16, 28), '#3c3f44', 'metal', T(0, 2.75, 0.2));
  k.build(g);
  const wing = new THREE.Group(); wing.position.set(0, 0, 0.2); g.add(wing); { const kk = new TKit(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; kk.add(G.box(1.45, 2.6, 0.04), '#ffffff', 'glass', T(Math.sin(a) * 0.74, 0.08, Math.cos(a) * 0.74, a + Math.PI / 2)); } kk.add(G.cyl(0.07, 0.07, 2.7, 10), '#3c3f44', 'metal', T(0, 0, 0)); kk.build(wing); }
  // 안내 글씨 (차양 앞) · 문 안 따뜻한 불빛
  const tx = canvasTex(512, 96, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '전망대 · 하늘 호텔 입구', w / 2, h / 2, 46, '#f3dcae'); }, false), m = new THREE.MeshBasicMaterial({ map: tx, transparent: true, color: '#ffffff' }); const p = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), m); p.position.set(0, 5.1, 4.42); g.add(p);
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe2b0' }), pg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), glow); pg.position.set(0, 1.6, -0.4); g.add(pg);
  g.userData.glow = glow; g.userData.wing = wing; return g;
}

// ---------- 명소 등록 ----------
registerAttraction({
  id: 'lwt', name: '롯데월드타워', seal: '123층', icon: '🏙️', verb: '타워로 들어가기', x: ENT.x, z: ENT.z, r: 7, face: Math.PI, go: [ENT.x, ENT.z + 14, Math.PI],
  intro: '1층 로비 · 79층 하늘 호텔 · 81층 하늘 뷔페 · 118층 전망대(유리 바닥)',
  // 바깥 출입구: 유리 차양 · 청동 문틀 · 회전문 · 안내 글씨 (남쪽 광장 쪽)
  build(A) { const g = buildEntrance(A.hg); A.root.add(g); return { group: g, tick() { const n = A.hg.light?.night ?? A.hg.skyU?.night.value ?? 0; g.userData.glow.color.setScalar(0.55 + n * 0.6); g.userData.wing.rotation.y += 0.006; } }; },
  start(A) {
    const hg = A.hg; S.hg = hg; S.A = A; S.visited = {}; ui(); hg.towerS = S; S.go = go;
    S.shell ||= buildShell(hg); (hg.mallInt ||= {})[D.name] = S.shell;
    // 바깥이 아직 보일 때 1층을 짓고 창밖을 그린 뒤 들어간다 (enterMall 이 바깥을 숨기고 출입구 자리에 세운다)
    setFloor('lobby', 'door'); hg.enterMall(D);
    const E = {
      title: '롯데월드타워', stampId: 'lwt', stampLabel: '롯데월드타워 · 118층',
      get lock() { return !!(S.pose || S.elev); },
      status() { const F = S.F; if (!F) return ''; if (S.elev) return S.elev.phase === 'pick' ? '층 단추를 골라요' : S.elev.phase === 'move' ? `${FLOORS[S.elev.to].name}(으)로 가는 중…` : '도착!'; return `${FLOORS[F.key]?.name || ''}${S.msg ? ' · ' + S.msg : S.near?.hint ? ' · ' + S.near.hint : ''}`; },
      actLabel() { if (S.elev) return S.elev.phase === 'pick' ? '층 단추' : ''; if (S.pose) return typeof S.pose.label === 'function' ? S.pose.label() : S.pose.label || '일어나기'; return S.near ? (typeof S.near.label === 'function' ? S.near.label() : S.near.label) : ''; },
      act() { if (pickOpen()) return; if (S.elev) { if (S.elev.phase === 'pick') pickFloor(); return; } if (S.pose) { if (S.pose.act) S.pose.act(); else stand(); return; } S.near?.act?.(); S.scan = 0; },
      tick(dt) { if (!hg.inMall || hg.inMall.I !== S.shell) { A.finish(E, true); return; } tickExp(dt); },
      cam: camExp,
      // 펜트하우스 계단 · 위층: 층이 알려 주는 바닥 높이
      floor(x, z, y) { return S.F?.ground ? S.F.ground(x - O.x, z - O.z, y) : -1; },
      where() { return `롯데월드타워 ${FLOORS[S.F?.key]?.name || ''}`; },
      end() { leaveTower(); S.exp = null; },
    };
    S.exp = E; return E;
  },
});
// 시험용 (콘솔): dream.hg 에서 꺼내 쓰기
export const towerState = S;
