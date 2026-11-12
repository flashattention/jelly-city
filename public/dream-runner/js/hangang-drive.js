// 서울 산책: 아무 차나 타고 운전하기 (8-27-3)
//   길 위 차 · 버스 · 트럭 · 오토바이 · 세워 둔 차 가까이에서 E = 타기. 운전하던 젤리는 깜짝 놀라 내려 인도로 걸어간다
//   W/S 가속 · 브레이크(뒤로), A/D 조향, Space 손 브레이크, H 경적, Z/X 깜빡이, L 전조등, V 시점(뒤에서 · 운전석), E 내리기
//   차 종류마다 무게 · 가속 · 최고 속도 · 회전이 다르다(오토바이는 기울며 돈다). 건물 · 차 · 가로등에 막히고, 걷는 젤리는 비켜선다
//   휴대폰: 조이스틱 = 가속 · 조향, 화면 단추 = 시점 · 경적 · 손 브레이크 · 내리기
import * as THREE from 'three';
import { sound } from './music.js';
import { TYPES } from './hangang-vehicle-models.js';
import { buildInterior, drawGauge, seatEye } from './hangang-vehicle-interior.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 소리: 경적 · 부딪힘 · 엔진(낮게 웅웅) ----------
let AC = null;
function ac() { if (sound.muted) return null; try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state !== 'running') AC.resume(); return AC; } catch { return null; } }
function tone(seq) { const A = ac(); if (!A) return; const t0 = A.currentTime; for (const [f, t, d, type = 'sine', v = 0.1] of seq) { const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + t); g.gain.linearRampToValueAtTime(v, t0 + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t0 + t + d); o.connect(g).connect(A.destination); o.start(t0 + t); o.stop(t0 + t + d + 0.05); } }
const HORN = { car: [[415, 0, 0.42, 'square', 0.05], [523, 0, 0.42, 'square', 0.04]], truck: [[262, 0, 0.6, 'sawtooth', 0.05], [330, 0, 0.6, 'sawtooth', 0.04]], bus: [[247, 0, 0.6, 'sawtooth', 0.05], [311, 0, 0.6, 'square', 0.04]], bike: [[660, 0, 0.25, 'square', 0.04]] };

// ---------- 화면 ----------
const CSS = `
#dv-card{position:absolute;left:50%;bottom:176px;transform:translateX(-50%);display:flex;gap:12px;align-items:center;padding:9px 10px 9px 14px;border-radius:18px;background:rgba(14,20,36,.8);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);color:#fff;font-family:'Jua',sans-serif;z-index:12;transition:opacity .2s}
#dv-card.hidden{opacity:0;pointer-events:none}
#dv-card .ic{font-size:28px}
#dv-card b{font-size:16px;display:block}
#dv-card small{display:block;font-family:system-ui,sans-serif;font-size:12px;opacity:.85;margin-top:2px}
#dv-card button{border:0;border-radius:14px;padding:9px 13px;font-family:'Jua',sans-serif;font-size:15px;cursor:pointer;background:linear-gradient(180deg,#ffd76a,#f2a93a);color:#3a2306;box-shadow:0 3px 0 #b8772a}
#dv-card button kbd,#dv-hud kbd{font-family:inherit;background:rgba(0,0,0,.14);border-radius:6px;padding:1px 6px;margin-left:6px;font-size:13px}
#dv-hud{position:absolute;right:14px;bottom:96px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;z-index:12;font-family:'Jua',sans-serif;color:#fff}
#dv-hud.hidden{display:none}
#dv-hud .spd{padding:8px 14px;border-radius:16px;background:rgba(14,20,36,.78);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);text-align:right;min-width:120px}
#dv-hud .spd b{font-size:34px;line-height:1}
#dv-hud .spd small{display:block;font-family:system-ui,sans-serif;font-size:12px;opacity:.85}
#dv-hud .row{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:330px}
#dv-hud button{border:0;border-radius:12px;padding:8px 10px;font-family:'Jua',sans-serif;font-size:14px;cursor:pointer;background:rgba(255,255,255,.88);color:#22252b;box-shadow:0 2px 0 rgba(0,0,0,.25);touch-action:none}
#dv-hud button.on{background:#ffd76a}
#dv-hud button.out{background:linear-gradient(180deg,#ff9a8a,#e0553a);color:#fff}
#dv-pop{position:absolute;left:50%;top:120px;transform:translateX(-50%);padding:6px 14px;border-radius:12px;background:rgba(14,20,36,.78);color:#fff;font-family:'Jua',sans-serif;font-size:15px;z-index:12;transition:opacity .3s}
#dv-pop.hidden{opacity:0}
body:not(.touch) #dv-hud .tch{display:none}
body.touch #dv-hud kbd,body.touch #dv-card kbd{display:none}
`;
function ui() {
  if (document.getElementById('dv-card')) return; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const host = document.getElementById('hg-hud') || document.body, d = document.createElement('div');
  d.innerHTML = `<div id="dv-card" class="hidden"><span class="ic">🚗</span><span><b></b><small></small></span><button class="b1"></button></div>
<div id="dv-hud" class="hidden"><div class="spd"><b>0</b> km/h<small></small></div>
<div class="row"><button data-k="view">🎥 시점<kbd>V</kbd></button><button data-k="horn">📯 경적<kbd>H</kbd></button><button data-k="blinkL">◀<kbd>Z</kbd></button><button data-k="blinkR">▶<kbd>X</kbd></button><button data-k="lights">💡<kbd>L</kbd></button></div>
<div class="row"><button class="tch" data-k="hand">🅿️ 손 브레이크</button><button class="out" data-k="out">🚪 내리기<kbd>E</kbd></button></div></div>
<div id="dv-pop" class="hidden"></div>`;
  while (d.firstChild) host.appendChild(d.firstChild);
}
// 놀란 젤리 머리 위 '!' (그림 한 장)
let BANG = null; function bang() { if (BANG) return BANG; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.fillStyle = '#ff7a2a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 34); BANG = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }); return BANG; }

export class Drive {
  constructor(hg) { this.hg = hg; this.on = null; this.near = null; this.scanT = 0; this.peds = []; this.held = new Set(); ui(); this.wire(); }
  wire() {
    const $ = (id) => document.getElementById(id); this.el = { card: $('dv-card'), hud: $('dv-hud'), pop: $('dv-pop') };
    this.el.card.querySelector('.b1').onclick = () => this.act();
    for (const b of this.el.hud.querySelectorAll('button')) {
      const k = b.dataset.k;
      if (k === 'hand') { b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.held.add('hand'); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => this.held.delete('hand')); }
      else b.onclick = () => this.key({ view: 'KeyV', horn: 'KeyH', blinkL: 'KeyZ', blinkR: 'KeyX', lights: 'KeyL', out: 'KeyE' }[k]);
    }
  }
  get lock() { return !!this.on; }
  lockInput(inp) { return { ...inp, mx: 0, mz: 0, jump: false, jumpHeld: false, slide: false, sprint: false }; }
  // ---------- 탈 수 있는 차 찾기: 차 몸통에서 2m 안 ----------
  findCand() {
    const hg = this.hg, T = hg.traffic; if (!T || hg.inside || hg.inShop || hg.inMall || hg.flying || hg.climb || hg.y > 1.2 || hg.rideL?.on || hg.attr?.exp) return null;
    let best = null;
    for (const v of T.list) {
      if (!v.init || v.hidden) continue; const dx = hg.px - v.x, dz = hg.pz - v.z; if (Math.abs(dx) > 14 || Math.abs(dz) > 14) continue;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lz = dx * fx + dz * fz, lx = dx * fz - dz * fx, d = Math.hypot(Math.max(0, Math.abs(lx) - v.hw), Math.max(0, Math.abs(lz) - v.len / 2));
      if (d < 2.0 && (!best || d < best.d)) best = { v, d };
    }
    return best;
  }
  // E: 타고 있으면 내리기, 아니면 가까운 차 타기 (버스 · 지하철 타기 · 역 출구가 더 가까우면 그쪽)
  act() {
    if (this.on) { this.exit(); return true; }
    const c = this.near; if (!c) return false;
    const R = this.hg.rideL?.cand; if (R) { const rd = R.d ?? (R.e ? Math.hypot(R.e.x - this.hg.px, R.e.z - this.hg.pz) : 99); if (rd < c.d) return false; }
    this.enter(c.v); return true;
  }
  key(code) {
    const D = this.on; if (!D) return false;
    if (code === 'KeyV') { D.view = D.view === 'fp' ? 'chase' : 'fp'; this.pop(D.view === 'fp' ? '🎥 운전석에서' : '🎥 뒤에서'); return true; }
    if (code === 'KeyH') { this.horn(); return true; }
    if (code === 'KeyZ') { D.v.blink = D.v.blink === 1 ? 0 : 1; return true; }
    if (code === 'KeyX') { D.v.blink = D.v.blink === 2 ? 0 : 2; return true; }
    if (code === 'KeyL') { D.lights = (D.lights + 1) % 3; this.pop(['💡 전조등 자동', '💡 전조등 켬', '💡 전조등 끔'][D.lights]); return true; }
    if (code === 'KeyE') { this.exit(); return true; }
    return false;
  }
  horn() { const D = this.on; if (!D) return; tone(HORN[D.v.t.cat === 'bike' ? 'bike' : D.v.t.cat === 'bus' ? 'bus' : D.v.t.cat === 'truck' ? 'truck' : 'car']); D.hornT = 0.6; }
  honked(v) { if (!this.on) return; tone([[392, 0, 0.3, 'square', 0.03], [494, 0, 0.3, 'square', 0.025]]); this.pop('📯 빵! 뒤차가 기다려요'); void v; }
  pop(t) { const P = this.el.pop; P.textContent = t; P.classList.remove('hidden'); clearTimeout(P.h); P.h = setTimeout(() => P.classList.add('hidden'), 1500); }
  // ---------- 타기 ----------
  enter(v) {
    const hg = this.hg, t = v.t, si = Math.max(0, t.seats.findIndex((s) => s[4]));
    // 운전하던 젤리: 세워 둔 차가 아니면 놀라서 내린다
    if (!v.parked) this.flee(v);
    v.player = true; v.parked = false; v.keep = true; v.empty = true; v.next = null; v.blink = 0; v.siren = 0;
    const I = buildInterior(v.key);
    if (I.shell) { I.shell.setColorAt(0, v.col); I.shell.instanceColor.needsUpdate = true; }
    I.g.visible = false; I.g.userData.noDrape = true; if (I.g.parent !== hg.scene) hg.scene.add(I.g);
    this.on = { v, t, I, seat: si, view: 'chase', speed: v.cur * (v.dir ? 1 : 1), steer: 0, lights: 0, t0: 0, shake: 0, hornT: 0, gT: 0, camInit: false };
    hg.exitInterior?.(); hg.flying = false; hg.climb = null; hg.v = 0;
    this.el.card.classList.add('hidden'); this.el.hud.classList.remove('hidden');
    hg.onToast?.(`${t.cat === 'bike' ? '🛵' : t.cat === 'bus' ? '🚌' : t.cat === 'truck' ? '🚚' : '🚗'} ${t.name} 운전! W 가속 · S 브레이크 · A D 핸들 · V 시점 · E 내리기`);
    this.engine(true);
  }
  // 놀란 젤리: 운전석 문 → 차 앞 돌아 → 인도로 걸어가 20m 뒤 사라진다
  flee(v) {
    const hg = this.hg, r = Math.random, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), ds = v.t.seats.find((s) => s[4]) || [0, 0.4, 0.5, 0];
    const b = hg.mkBear(r() < 0.5 ? 'office' : 'stroll', r, 0.95 + r() * 0.1); b.root.userData.npc = true;
    const door = [v.x + lx * (v.hw + 0.5) + fx * ds[3], v.z + lz * (v.hw + 0.5) + fz * ds[3]];
    // 인도: 그 차가 달리던 쪽 길 가장자리 (찻길 폭 / 2 + 1.8m)
    let side = [v.x - lx * (v.hw + 4), v.z - lz * (v.hw + 4)];
    if (v.L) { const sg = Math.sign(v.off || 1), q = hg.lineAt(v.L, v.d, sg * (v.L.w / 2 + 1.8)); side = [q.x, q.z]; }
    const front = [v.x + fx * (v.len / 2 + 1.2) + lx * (v.hw + 0.4), v.z + fz * (v.len / 2 + 1.2) + lz * (v.hw + 0.4)], front2 = [v.x + fx * (v.len / 2 + 1.2) - lx * (v.hw + 0.6), v.z + fz * (v.len / 2 + 1.2) - lz * (v.hw + 0.6)];
    const away = [side[0] + fx * 18, side[1] + fz * 18];
    const sp = new THREE.Sprite(bang()); sp.scale.set(1.0, 1.0, 1); sp.position.set(0, 2.9, 0); b.root.add(sp);
    const path = Math.abs(v.off || 0) > 0 ? [door, front, front2, side, away] : [door, side, away];
    this.peds.push({ b, path, k: 0, t: 0, v: 2.6, hop: 0.9, bangT: 1.8, sp });
  }
  tickPeds(dt) {
    const hg = this.hg;
    for (const p of [...this.peds]) {
      p.hop = Math.max(0, p.hop - dt); p.bangT -= dt; if (p.bangT <= 0 && p.sp) { p.b.root.remove(p.sp); p.sp = null; }
      const a = p.path[p.k], b = p.path[p.k + 1]; if (!b) { hg.removePerson({ bears: [p.b] }); this.peds.splice(this.peds.indexOf(p), 1); continue; }
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01; p.t += (p.hop > 0.5 ? 0 : p.v) * dt / L; if (p.t >= 1) { p.k++; p.t = 0; continue; }
      const x = a[0] + (b[0] - a[0]) * p.t, z = a[1] + (b[1] - a[1]) * p.t, ty = 0;
      // 처음엔 깡충 놀라 뛰고, 그다음 종종걸음 (땅 높이는 hangang.js liftMovers 가 더한다)
      p.b.root.position.set(x, ty + Math.max(0, Math.sin((0.9 - p.hop) * Math.PI / 0.4)) * (p.hop > 0.5 ? 0.45 : 0), z); p.b.root.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); p.b.update(dt, p.v * 2.4, { noCrawl: true });
    }
  }
  // ---------- 내리기 ----------
  exit(force = false) {
    const D = this.on, hg = this.hg; if (!D) return;
    if (!force && Math.abs(D.speed) > 2.2) { this.pop('🛑 멈춘 뒤 내려요 (S 브레이크)'); return; }
    const v = D.v, lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), s = D.t.seats[D.seat];
    // 내 자리 쪽 문 밖으로 (막혔으면 반대쪽 · 뒤)
    const tries = [[Math.sign(s[1]) || 1, s[3]], [-(Math.sign(s[1]) || 1), s[3]], [0, -v.len / 2 - 1]], out = [];
    for (const [sd, lz2] of tries) { const k = sd === 0 ? 0 : v.hw + 0.7, x = v.x + lx * sd * k + fx * lz2, z = v.z + lz * sd * k + fz * lz2; out.push([x, z]); }
    let pick = out[0]; for (const p of out) { const r = hg.pushOut(p[0], p[1], 0.2, 0.3); if (!r.hit && hg.walkable(p[0], p[1], 0)) { pick = p; break; } }
    v.player = false; v.parked = true; v.keep = false; v.hidden = false; v.cur = 0; v.brake = 0; v.blink = 0;
    D.I.g.visible = false; if (D.I.g.parent) D.I.g.parent.remove(D.I.g);
    this.on = null; this.el.hud.classList.add('hidden'); this.engine(false);
    hg.bear.setSeated?.(false); hg.bear.root.rotation.set(0, 0, 0); hg.placeAt(pick[0], pick[1], v.yaw); hg.y = 0;
    if (this.cam0) { this.cam0.near = this.near0; this.cam0.updateProjectionMatrix(); this.cam0 = null; }
    hg.onToast?.('🚪 내렸어요');
  }
  // ---------- 엔진 소리 (낮은 톱니파 + 걸러서, 속도 따라 높아짐) ----------
  engine(on) {
    if (!on) { if (this.eng) { try { this.eng.g.gain.value = 0; this.eng.o.stop(); } catch { /* 이미 멈춤 */ } this.eng = null; } return; }
    const A = ac(); if (!A || this.eng) return;
    const o = A.createOscillator(), f = A.createBiquadFilter(), g = A.createGain(); o.type = 'sawtooth'; o.frequency.value = 40; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.018; o.connect(f).connect(g).connect(A.destination); o.start(); this.eng = { o, f, g };
  }
  // ---------- 매 프레임 (곰 움직임보다 먼저): 운전 ----------
  tick(dt, inp) {
    const hg = this.hg; this.tickPeds(dt);
    if (!this.on) {
      this.scanT -= dt; if (this.scanT <= 0) { this.scanT = 0.2; this.near = this.findCand(); this.card(); }
      return;
    }
    const D = this.on, v = D.v, t = D.t, bike = t.cat === 'bike';
    D.t0 += dt; D.hornT = Math.max(0, D.hornT - dt);
    // 입력: W/S · 조이스틱 세로 = 가속 · 브레이크, A/D = 조향, Space = 손 브레이크
    const thr = clamp(inp.mz || 0, -1, 1), str = clamp(inp.mx || 0, -1, 1), hand = !!inp.jumpHeld || this.held.has('hand');
    const mk = clamp(1500 / t.mass, 0.35, 1.6);
    if (thr > 0.05) { if (D.speed < -0.3) D.speed = Math.min(0, D.speed + t.brake * dt); else D.speed += t.acc * thr * dt * Math.max(0.05, 1 - D.speed / t.vmax); }
    else if (thr < -0.05) { if (D.speed > 0.3) D.speed = Math.max(0, D.speed - t.brake * -thr * dt); else D.speed = Math.max(-t.vmax * 0.22, D.speed - t.acc * 0.6 * -thr * dt); }
    else { const drag = 0.35 + Math.abs(D.speed) * 0.02; D.speed -= Math.sign(D.speed) * Math.min(Math.abs(D.speed), drag * dt); }
    if (hand) D.speed -= Math.sign(D.speed) * Math.min(Math.abs(D.speed), t.brake * 1.3 * dt);
    // 조향: 빠를수록 덜 꺾이고, 무거운 차는 천천히 꺾인다
    const sp = Math.abs(D.speed), want = str * t.turn / (1 + (sp * sp) / (bike ? 160 : 120));
    D.steer += (want - D.steer) * Math.min(1, dt * (1.4 + mk * 1.6));
    const wb = Math.max(0.9, t.L * 0.58), yawRate = -(D.speed / wb) * Math.tan(D.steer) * (hand && sp > 4 ? 1.5 : 1);
    v.yaw = wrapA(v.yaw + yawRate * dt);
    // 오토바이는 도는 쪽으로 기운다
    if (bike) v.roll = lerp(v.roll, clamp(-yawRate * sp * 0.09, -0.6, 0.6), Math.min(1, dt * 5));
    // 움직이고 부딪히기: 차 몸을 앞뒤 동그라미 몇 개로 보고 건물 · 가로등 · 다른 차에서 밀어낸다
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); let nx = v.x + fx * D.speed * dt, nz = v.z + fz * D.speed * dt;
    if (hg.terr) { const T2 = hg.terr; nx = clamp(nx, T2.x0 + 50, T2.x0 + (T2.nx - 1) * T2.step - 50); nz = clamp(nz, T2.z0 + 50, T2.z0 + (T2.nz - 1) * T2.step - 50); }
    if (!hg.walkable(nx + fx * t.L / 2, nz + fz * t.L / 2, 0)) { nx = v.x; nz = v.z; if (sp > 3) this.bump(D, 0.4); else D.speed = 0; }
    //   겹침 정도(pen)가 늘어나는 쪽으로는 못 간다 → 벽을 따라 미끄러지거나 막혀 튕긴다. 처음부터 겹쳐 있어도 빠져나갈 수 있다
    const n = Math.max(1, Math.round(t.L / (t.W * 1.1))), rr = bike ? 0.35 : v.hw + 0.05;
    const pen = (x, z) => { let s2 = 0; for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : (i / (n - 1) - 0.5) * (t.L - t.W), cx = x + fx * k, cz = z + fz * k, r = hg.pushOut(cx, cz, 0.4, rr); if (r.hit) s2 += Math.hypot(r.x - cx, r.z - cz) + 0.01; } return s2; };
    // 탈 때 이미 무언가(출구 지붕 등)에 겹쳐 있었으면 빠져나올 때까지 부딪힘을 끈다
    if (D.ghost === undefined) D.ghost = pen(v.x, v.z) > 0;
    if (D.ghost) { D.ghostT = (D.ghostT || 0) - dt; if (D.ghostT <= 0) { D.ghostT = 0.25; if (pen(v.x, v.z) === 0) D.ghost = false; } }
    else if (nx !== v.x || nz !== v.z) {
      const p0 = pen(v.x, v.z), ok = (x, z) => pen(x, z) <= p0 + 0.002;
      if (!ok(nx, nz)) { if (ok(nx, v.z)) { nz = v.z; D.speed *= 0.985; } else if (ok(v.x, nz)) { nx = v.x; D.speed *= 0.985; } else { nx = v.x; nz = v.z; if (sp > 1.5) this.bump(D, Math.min(1, sp / 12)); else D.speed *= 0.5; } }
    }
    v.x = nx; v.z = nz; v.cur = Math.abs(D.speed); v.dir = 1;
    // 다리 · 고가 위면 그 높이를 따라 (덱), 아니면 땅
    const deck = hg.deckAt?.(v.x, v.z, v.lift ?? 0) ?? -1; v.lift = lerp(v.lift ?? 0, deck > 0 ? deck : 0, Math.min(1, dt * 8));
    // 불빛: 브레이크 · 전조등(자동은 밤 · 비)
    v.brake = thr < -0.05 && D.speed > 0.3 || hand ? 1 : 0; const night = hg.light?.night || 0;
    v.head = D.lights === 1 ? 1 : D.lights === 2 ? 0 : night > 0.3 || hg.state.weather === 'rain' ? 1 : 0;
    // 걷는 젤리는 비켜선다 (차 앞 6m · 옆 몸 폭 안이면 옆으로)
    for (const w of hg.walkers || []) { const p0 = w.bears[0]?.root.position; if (!p0) continue; const dx = p0.x - v.x, dz = p0.z - v.z, ah = dx * fx + dz * fz, sd = dx * fz - dz * fx; if (ah > -t.L / 2 && ah < t.L / 2 + 6 && Math.abs(sd) < v.hw + 1.2) { const ldx = w.L ? hg.lineAt(w.L, w.d, 0) : null; const away = Math.sign(sd) || 1; w.side += away * (ldx ? Math.sign((p0.x - ldx.x) * -ldx.dz + (p0.z - ldx.z) * ldx.dx) || 1 : 1) * dt * 5; w.dodge = 0.6; } }
    // 흔들림 · 운전대 · 계기판 · 엔진 소리
    D.shake = Math.max(0, D.shake - dt * 2.5); v.bob = Math.sin(D.t0 * 30) * D.shake * 0.04;
    if (D.I.wheel) D.I.wheel.rotation.z = -D.steer * 6;
    D.gT -= dt; if (D.gT <= 0 && D.I.gauge && D.view === 'fp') { D.gT = 0.1; const kmh = sp * 3.6, rpm = 0.8 + ((kmh % 40) / 40) * 2.6 + (thr > 0 ? 0.8 : 0); drawGauge(D.I.gauge, kmh, rpm, night, { max: t.vmax * 3.6 > 160 ? 220 : 140, step: 20, gear: D.speed < -0.2 ? 'R' : sp < 0.2 ? 'P' : 'D', blink: v.blink, on: Math.floor(D.t0 * 3.1) % 2 === 0, head: v.head }); }
    if (this.eng) { this.eng.o.frequency.value = (bike ? 70 : t.cat === 'car' ? 38 : 28) + sp * (bike ? 9 : 4) + (thr > 0 ? 8 : 0); this.eng.g.gain.value = 0.012 + Math.min(0.02, sp * 0.001); }
    // 곰 자리 = 차 자리 (주변 칸 · 차 · 사람이 이 둘레로 생긴다)
    hg.px = v.x; hg.pz = v.z; hg.face = v.yaw; hg.v = 0; hg.y = 0;
    this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hudT = 0.15; this.el.hud.querySelector('.spd b').textContent = Math.round(sp * 3.6); this.el.hud.querySelector('.spd small').textContent = `${t.name}${D.speed < -0.2 ? ' · 후진' : ''}`; for (const b of this.el.hud.querySelectorAll('button')) b.classList.toggle('on', (b.dataset.k === 'blinkL' && v.blink === 1) || (b.dataset.k === 'blinkR' && v.blink === 2) || (b.dataset.k === 'lights' && v.head === 1) || (b.dataset.k === 'view' && D.view === 'fp')); }
  }
  bump(D, k) { D.speed *= -0.25; D.shake = Math.max(D.shake, 0.5 + k); tone([[110, 0, 0.18, 'square', 0.05 * (0.4 + k)], [70, 0.03, 0.22, 'sine', 0.08 * (0.4 + k)]]); }
  // 곰 그리기 뒤에: 곰은 자리에 앉히거나(오토바이 · 1인칭이 아닐 때) 숨기고, 차 안 그림을 차에 붙인다
  post() {
    const D = this.on, hg = this.hg; if (!D) return; const v = D.v, t = D.t, bike = t.cat === 'bike', s = t.seats[D.seat];
    const ty = (hg.terr ? hg.terrAt(v.x, v.z) : 0) + (v.lift || 0);
    const inside = D.view === 'fp' && !bike; v.hidden = inside;
    const I = D.I; if (I.g) { I.g.visible = inside; I.g.position.set(v.x, ty, v.z); I.g.rotation.set(v.pitch || 0, v.yaw, v.roll || 0, 'YXZ'); if (I.shell) { const st = I.shell.geometry.attributes.iSt; st.setXYZW(0, v.head, v.brake, v.blink, 0); st.needsUpdate = true; } }
    if (hg.shadow) hg.shadow.visible = false;
    if (bike && D.view !== 'fp') {
      const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), up = s[2] + 0.02;
      hg.bear.root.visible = true; hg.bear.setSeated?.(true); hg.bear.root.position.set(v.x + fx * s[3] + lx * Math.sin(v.roll || 0) * -up, ty + up * Math.cos(v.roll || 0), v.z + fz * s[3] + lz * Math.sin(v.roll || 0) * -up); hg.bear.root.rotation.set(0, v.yaw, v.roll || 0, 'YXZ');
    } else hg.bear.root.visible = false;
  }
  // ---------- 카메라 ----------
  cam(camera, dt) {
    const D = this.on, hg = this.hg; if (!D) return; const v = D.v, t = D.t, ty = (hg.terr ? hg.terrAt(v.x, v.z) : 0) + (v.lift || 0);
    if (hg.dragT <= 0) hg.camYaw += wrapA(v.yaw - hg.camYaw) * Math.min(1, dt * 2.2);
    if (D.view === 'fp') {
      const s = t.seats[D.seat], e = seatEye(s, t), m = new THREE.Matrix4().compose(new THREE.Vector3(v.x, ty, v.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(v.pitch || 0, v.yaw, v.roll || 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
      const p = new THREE.Vector3(...e).applyMatrix4(m); p.y += Math.sin(D.t0 * 31) * D.shake * 0.02; camera.position.copy(p);
      const yaw = hg.camYaw, pt = clamp((hg.camPitch ?? 0.3) - 0.3, -0.6, 0.6) + 0.08;
      camera.up.set(0, 1, 0); camera.lookAt(p.x + Math.sin(yaw) * Math.cos(pt), p.y - Math.sin(pt), p.z + Math.cos(yaw) * Math.cos(pt));
      if (camera.near > 0.05) { this.cam0 = camera; this.near0 = camera.near; camera.near = 0.05; camera.updateProjectionMatrix(); }
    } else {
      if (this.cam0) { this.cam0.near = this.near0; this.cam0.updateProjectionMatrix(); this.cam0 = null; }
      const dist = Math.max(5.2, t.L * 1.05 + 3), h = t.H * 0.85 + 1.5 + clamp((hg.camPitch ?? 0.3) - 0.3, -0.3, 0.9) * dist * 0.6, yaw = hg.camYaw;
      const want = new THREE.Vector3(v.x - Math.sin(yaw) * dist, ty + h, v.z - Math.cos(yaw) * dist);
      // 카메라가 건물 속으로 들어가면 차 쪽으로 당긴다
      const r = hg.pushOut(want.x, want.z, h - 0.5, 0.4); if (r.hit) { want.x = lerp(want.x, v.x, 0.5); want.z = lerp(want.z, v.z, 0.5); }
      if (!D.camInit) { camera.position.copy(want); D.camInit = true; } else camera.position.lerp(want, 1 - Math.exp(-dt * 7));
      camera.up.set(0, 1, 0); camera.lookAt(v.x + Math.sin(v.yaw) * 2.5, ty + t.H * 0.6, v.z + Math.cos(v.yaw) * 2.5);
    }
  }
  card() {
    const el = this.el.card, c = this.near; if (!c || this.on) { el.classList.add('hidden'); return; }
    const t = c.v.t; el.querySelector('.ic').textContent = t.cat === 'bike' ? '🛵' : t.cat === 'bus' ? '🚌' : t.cat === 'truck' ? '🚚' : '🚗';
    el.querySelector('b').textContent = t.name; el.querySelector('small').textContent = c.v.parked ? '세워 둔 차예요' : '운전하는 젤리가 깜짝 놀라 내려요';
    el.querySelector('.b1').innerHTML = '타기 <kbd>E</kbd>'; el.classList.remove('hidden');
  }
  where() { const D = this.on; return D ? `${{ bike: '🛵', bus: '🚌', truck: '🚚' }[D.t.cat] || '🚗'} ${D.t.name} 운전 중 · ${Math.round(Math.abs(D.speed) * 3.6)}km/h` : null; }
  dispose() { if (this.on) this.exit(true); for (const p of this.peds) this.hg.removePerson({ bears: [p.b] }); this.peds = []; this.el.card.classList.add('hidden'); }
}
