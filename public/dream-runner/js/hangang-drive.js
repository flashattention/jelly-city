// 서울 산책: 아무 차나 타고 운전하기 (8-27-3)
//   길 위 차 · 버스 · 트럭 · 오토바이 · 세워 둔 차 가까이에서 E = 타기. 운전하던 젤리는 깜짝 놀라 내려 인도로 걸어간다
//   W/S 가속 · 브레이크(뒤로), A/D 조향, Space 손 브레이크, H 경적, Z/X 깜빡이, L 전조등, V 시점(뒤에서 · 운전석), E 내리기
//   차 종류마다 무게 · 가속 · 최고 속도 · 회전이 다르다(오토바이는 기울며 돈다). 건물 · 차 · 가로등에 막히고, 걷는 젤리는 비켜선다
//   휴대폰: 조이스틱 = 가속 · 조향, 화면 단추 = 시점 · 경적 · 손 브레이크 · 내리기
import * as THREE from 'three';
import { sound } from './music.js';
import { TYPES, topAt, liveRoute } from './hangang-vehicle-models.js';
// 실시간 버스 종류 → 길 위 차 모델 (2 마을버스 · 나머지 시내버스)
const liveKey = (o) => (+o.type === 2 ? 'busTown' : 'busCity');
import { BUS_COLOR } from './hangang-transit.js';
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
#dv-hud.pass .drv{display:none}
#dv-seat{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.5);backdrop-filter:blur(3px)}
#dv-seat.hidden{display:none}
#dv-seat .pg{width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 40px);overflow:auto;border-radius:20px;padding:14px 16px;background:#f6f3ec;color:#2a2a2a;font-family:'Jua',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)}
#dv-seat h3{margin:0;font-size:20px}
#dv-seat .sub{font-family:system-ui,sans-serif;font-size:12.5px;color:#5a5a5a;margin:2px 0 10px}
#dv-seat .wrap{display:flex;gap:14px;align-items:flex-start;justify-content:center;flex-wrap:wrap}
#dv-seat .map{position:relative;background:#d9dde2;border-radius:28px 28px 14px 14px;border:3px solid #9aa1aa;flex:none}
#dv-seat .map .s{position:absolute;border:0;border-radius:7px;cursor:pointer;font-family:'Jua',sans-serif;font-size:12px;color:#fff;padding:0;background:#4f6fb0}
#dv-seat .map .s.drv{background:#e98a2a}
#dv-seat .map .s.me{outline:3px solid #ffd23f}
#dv-seat .list{display:flex;flex-direction:column;gap:6px;min-width:170px}
#dv-seat .list button{border:0;border-radius:12px;padding:7px 10px;font-family:'Jua',sans-serif;font-size:14px;cursor:pointer;background:#e4e1d8;text-align:left}
#dv-seat .list button.drv{background:#ffd9a8}
#dv-seat .list button.me{outline:3px solid #ffd23f}
#dv-seat .row{display:flex;gap:8px;justify-content:center;margin-top:12px}
#dv-seat .row button{border:0;border-radius:12px;padding:8px 12px;font-family:'Jua',sans-serif;font-size:14px;cursor:pointer;background:#e4e1d8}
`;
function ui() {
  if (document.getElementById('dv-card')) return; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const host = document.getElementById('hg-hud') || document.body, d = document.createElement('div');
  d.innerHTML = `<div id="dv-card" class="hidden"><span class="ic">🚗</span><span><b></b><small></small></span><button class="b1"></button></div>
<div id="dv-hud" class="hidden"><div class="spd"><b>0</b> km/h<small></small></div>
<div class="row"><button data-k="view">🎥 시점<kbd>V</kbd></button><button class="drv" data-k="horn">📯 경적<kbd>H</kbd></button><button class="drv" data-k="blinkL">◀<kbd>Z</kbd></button><button class="drv" data-k="blinkR">▶<kbd>X</kbd></button><button class="drv" data-k="lights">💡<kbd>L</kbd></button></div>
<div class="row"><button class="tch drv" data-k="hand">🅿️ 손 브레이크</button><button data-k="seat">🪑 자리 바꾸기</button><button class="out" data-k="out">🚪 내리기<kbd>E</kbd></button></div></div>
<div id="dv-seat" class="hidden"><div class="pg"><h3></h3><div class="sub"></div><div class="wrap"><div class="map"></div><div class="list"></div></div><div class="row"><button class="x">닫기</button></div></div></div>
<div id="dv-pop" class="hidden"></div>`;
  while (d.firstChild) host.appendChild(d.firstChild);
}
// 놀란 젤리 머리 위 '!' (그림 한 장)
let BANG = null; function bang() { if (BANG) return BANG; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.fillStyle = '#ff7a2a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 34); BANG = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }); return BANG; }

// 앉은 곰이 지붕을 뚫지 않게: 그 자리 천장까지 높이에 맞춰 줄인다 (최대 원래 크기)
function roofAbove(t, s) { if (t.cat === 'bike') return 9; return (t.top ? topAt(t, s[3]) - 0.07 : t.H - 0.22) - (s[2] + 0.05); }
const BOX = new THREE.Box3(), WP = new THREE.Vector3();
function fitSeated(root, t, s, base) { root.scale.setScalar(base); root.updateMatrixWorld(true); BOX.setFromObject(root); root.getWorldPosition(WP); const h = BOX.max.y - WP.y; if (!(h > 0.1)) return; const k = clamp((roofAbove(t, s) - 0.03) / h, 0.5, 1); root.scale.setScalar(base * k); }

export class Drive {
  constructor(hg) { this.hg = hg; this.on = null; this.near = null; this.scanT = 0; this.peds = []; this.held = new Set(); ui(); this.wire(); }
  wire() {
    const $ = (id) => document.getElementById(id); this.el = { card: $('dv-card'), hud: $('dv-hud'), pop: $('dv-pop'), seat: $('dv-seat') };
    this.el.seat.querySelector('.x').onclick = () => this.closeSeats();
    // 자리 고르기 창: 숫자 1 ~ 9 · 0 = 그 번호 자리, Esc = 닫기
    window.addEventListener('keydown', (e) => { if (this.el.seat.classList.contains('hidden')) return; const m = /^Digit(\d)$/.exec(e.code); if (m) { const i = (+m[1] + 9) % 10; if (this.pick && i < this.pick.v.t.seats.length) this.choose(i); e.stopPropagation(); } else if (e.code === 'Escape') { this.closeSeats(); e.stopPropagation(); } }, true);
    this.el.card.querySelector('.b1').onclick = () => this.act();
    for (const b of this.el.hud.querySelectorAll('button')) {
      const k = b.dataset.k;
      if (k === 'hand') { b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.held.add('hand'); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => this.held.delete('hand')); }
      else if (k === 'seat') b.onclick = () => this.on && this.openSeats(this.on.v, true);
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
    // 8-40-1: 실시간 버스(hangang-transit.js)도 빼앗아 운전할 수 있다. 고르기 전엔 모양(종류)만 빌린 가짜 차로 둔다
    const LV = hg.live; if (LV) for (const o of LV.buses.values()) {
      if (!o.mesh || !o.L || o.hijack || o.id === LV.rideId) continue; const dx = hg.px - o.x, dz = hg.pz - o.z; if (Math.abs(dx) > 14 || Math.abs(dz) > 14) continue;
      // 8-41-3: 마을버스(종류 2)는 마을버스 모양 그대로 (빼앗으면 시내버스로 바뀌었다)
      const t = TYPES[liveKey(o)], fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), lz = dx * fx + dz * fz, lx = dx * fz - dz * fx, d = Math.hypot(Math.max(0, Math.abs(lx) - t.W / 2), Math.max(0, Math.abs(lz) - t.L / 2));
      if (d < 2.0 && (!best || d < best.d)) best = { v: { t, live: o }, d };
    }
    return best;
  }
  // E: 타고 있으면 내리기, 아니면 가까운 차 타기 (버스 · 지하철 타기 · 역 출구가 더 가까우면 그쪽)
  //   자리 고르기 창이 열려 있으면 E = 운전석
  act() {
    if (this.pick) { this.choose(Math.max(0, this.pick.v.t.seats.findIndex((s) => s[4]))); return true; }
    if (this.on) { this.exit(); return true; }
    const c = this.near; if (!c) return false;
    // 실시간 버스가 정류장에 서 있으면 타기(hangang-ride.js)도 같은 버스를 고른다 → 이 창(운전석 · 승객)으로 한 번에
    const R = this.hg.rideL?.cand; if (R && !(c.v.live && R.o === c.v.live)) { const rd = R.d ?? (R.e ? Math.hypot(R.e.x - this.hg.px, R.e.z - this.hg.pz) : 99); if (rd < c.d) return false; }
    this.openSeats(c.v); return true;
  }
  // ---------- 자리 고르기 (8-27-4): 위에서 본 차 모양에 자리 단추, 옆에 이름 목록 ----------
  openSeats(v, switching = false) {
    const t = v.t, el = this.el.seat, map = el.querySelector('.map'), list = el.querySelector('.list'), cur = switching ? this.on?.seat : -1;
    this.pick = { v, switching };
    el.querySelector('h3').textContent = `${{ bike: '🛵', bus: '🚌', truck: '🚚' }[t.cat] || '🚗'} ${t.name} · ${switching ? '자리 바꾸기' : '어디에 앉을까요?'}`;
    if (v.live) el.querySelector('.sub').textContent = `실시간 ${v.live.route}번 버스 · 운전석 = 내 화면에서만 직접 운전 (운전하던 젤리는 내리고, 다른 사람 화면의 실제 버스는 그대로 · 내리면 실제 자리로 돌아가요) · 다른 자리 = 승객으로 실제 노선대로 · 숫자 키로도 골라요`;
    else el.querySelector('.sub').textContent = `운전석 = 직접 운전${v.parked || switching ? '' : ' (운전하던 젤리는 내려요)'} · 다른 자리 = 젤리 운전사가 길을 따라 달려요 · 숫자 키로도 골라요`;
    const S = Math.min(72, 330 / t.L), w = t.W * S + 16, h = t.L * S + 16; map.style.width = w + 'px'; map.style.height = h + 'px'; map.innerHTML = ''; list.innerHTML = '';
    const P = (x, z) => [w / 2 - x * S, h / 2 - z * S];
    t.seats.forEach((st, i) => {
      const b = document.createElement('button'), [a, c] = P(st[1], st[3]), sz = Math.max(11, Math.min(26, S * 0.42)); b.className = 's' + (st[4] ? ' drv' : '') + (i === cur ? ' me' : ''); b.style.left = a - sz / 2 + 'px'; b.style.top = c - sz / 2 + 'px'; b.style.width = b.style.height = sz + 'px'; b.textContent = i < 10 ? String((i + 1) % 10) : ''; b.title = st[0]; b.onclick = () => this.choose(i); map.appendChild(b);
      if (t.seats.length <= 10) { const l = document.createElement('button'); l.className = (st[4] ? 'drv' : '') + (i === cur ? ' me' : ''); l.textContent = `${(i + 1) % 10}. ${st[0]}${st[4] ? ' (운전)' : ''}`; l.onclick = () => this.choose(i); list.appendChild(l); }
    });
    if (t.seats.length > 10) { const l = document.createElement('button'); l.textContent = '🎲 빈자리 아무 데나'; l.onclick = () => this.choose(1 + Math.floor(Math.random() * (t.seats.length - 1))); list.appendChild(l); const d = document.createElement('button'); d.className = 'drv'; d.textContent = '🧑‍✈️ 운전석 (E)'; d.onclick = () => this.choose(0); list.appendChild(d); }
    el.classList.remove('hidden'); document.exitPointerLock?.();
  }
  closeSeats() { this.el.seat.classList.add('hidden'); this.pick = null; }
  choose(i) {
    const P = this.pick; if (!P) return; this.closeSeats();
    if (P.switching) this.switchSeat(i); else if (P.v.live) this.takeLive(P.v.live, i); else this.board(P.v, i);
  }
  key(code) {
    const D = this.on; if (!D) return false;
    if (code === 'KeyV') { D.view = D.view === 'fp' ? 'chase' : 'fp'; this.pop(D.view === 'fp' ? `🎥 ${D.t.seats[D.seat][0]}에서` : '🎥 뒤에서'); return true; }
    if (!D.driver && ['KeyH', 'KeyZ', 'KeyX', 'KeyL'].includes(code)) return true;
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
  // ---------- 실시간 버스 빼앗기 (8-40-1) ----------
  //   운전석: 그 버스를 내 화면에서만 길 위 차(hg.traffic)로 옮겨 내가 몬다 (실제 버스는 숨겨 두고 실시간 자리는 계속 따라간다)
  //   다른 자리: 승객으로 실제 노선대로 (hangang-ride.js 타기와 같다)
  takeLive(o, si) {
    const hg = this.hg, T = hg.traffic; if (!hg.live?.buses.has(o.id) || !o.L) return;
    const key = liveKey(o); if (!TYPES[key].seats[si]?.[4]) { hg.rideL?.board({ kind: 'bus', o, d: 0 }); return; }
    if (!T) return;
    const v = T.spawn(o.L, clamp(o.d ?? 0, 0, o.L.len), o.dir || 1, Math.random, { key });
    v.x = o.x; v.z = o.z; v.yaw = o.yaw; v.init = true; v.cur = o.cur || 0; v.siren = 0; v.keep = true; v.col = new THREE.Color(BUS_COLOR[o.type] || BUS_COLOR[3]); v.route = liveRoute(o.route); v.liveId = o.id;
    o.hijack = true; this.board(v, si);
    hg.onToast?.(`🚌 실시간 ${o.route}번 버스를 빼앗았어요 · 내 화면에서만 운전해요 · 내리면 실제 자리로 돌아가요`);
  }
  // ---------- 타기 ----------
  enter(v) { this.board(v, Math.max(0, v.t.seats.findIndex((s) => s[4]))); }
  //   si: 앉을 자리. 운전석이면 내가 운전(운전하던 젤리는 놀라 내림), 아니면 젤리 운전사가 길을 따라 달린다
  board(v, si) {
    const hg = this.hg, t = v.t;
    const I = buildInterior(v.key);
    if (I.shell) { I.shell.setColorAt(0, v.col); I.shell.instanceColor.needsUpdate = true; const ce = I.shell.geometry.attributes.iCell; if (ce) { ce.setXY(0, v.plate || 0, v.route || 0); ce.needsUpdate = true; } }
    I.g.visible = false; I.g.userData.noDrape = true; if (I.g.parent !== hg.scene) hg.scene.add(I.g);
    this.on = { v, t, I, seat: si, driver: false, view: 'chase', speed: v.cur, steer: 0, lights: 0, t0: 0, shake: 0, hornT: 0, gT: 0, camInit: false };
    hg.exitInterior?.(); hg.flying = false; hg.climb = null; hg.v = 0;
    this.el.card.classList.add('hidden'); this.el.hud.classList.remove('hidden');
    if (t.seats[si][4]) this.takeWheel(true); else this.giveWheel(true);
  }
  // 내가 운전석으로: 운전하던 젤리(있으면)는 놀라 내린다
  takeWheel(first = false) {
    const D = this.on, v = D.v, t = D.t;
    if (!v.parked && !v.player) { this.dropNpc(); this.flee(v); }
    v.player = true; v.ride = false; v.parked = false; v.keep = true; v.empty = true; v.next = null; v.blink = 0; v.siren = 0; v.stopReq = false;
    D.driver = true; D.speed = v.cur; D.seat = Math.max(0, t.seats.findIndex((s) => s[4])); D.view = first ? 'chase' : D.view; D.ghost = undefined;
    this.el.hud.classList.remove('pass');
    this.hg.onToast?.(`${{ bike: '🛵', bus: '🚌', truck: '🚚' }[t.cat] || '🚗'} ${t.name} 운전! W 가속 · S 브레이크 · A D 핸들 · V 시점 · E 내리기`);
    this.engine(true);
  }
  // 내가 다른 자리로: 젤리 운전사가 운전한다 (세워 둔 차 · 내가 몰던 차면 새로 앉고, 가까운 찻길로 돌아가 달린다)
  giveWheel(first = false) {
    const D = this.on, v = D.v, t = D.t, hg = this.hg;
    if (v.player || v.parked) {
      const L = this.snapRoad(v);
      if (L) { v.L = L.L; v.d = L.d; v.dir = L.dir; v.off = L.dir * Math.max(1.8, Math.min(Math.abs(v.off || 1.8), L.L.w / 2 - 1.2)); v.vMax = (t.cat === 'bus' ? 9 : t.cat === 'truck' ? 10 : 12) * (hg.jamSpeed || 1); v.parked = false; v.next = null; v.cur = Math.abs(D.speed || 0); }
      else { v.parked = true; v.cur = 0; }
      v.empty = false;
    }
    v.player = false; v.ride = true; v.keep = true; v.stopReq = false;
    D.driver = false; D.view = first ? 'fp' : D.view;
    if (t.cat !== 'bike') this.addNpc();
    this.el.hud.classList.add('pass'); this.engine(false);
    hg.onToast?.(`🪑 ${t.seats[D.seat][0]}에 앉았어요 · 젤리 운전사가 달려요 · 🪑 자리 바꾸기 · V 시점 · E 내리기`);
  }
  // 차 안 운전석의 젤리 운전사 (차 안 그림에 앉힌다)
  addNpc() {
    const D = this.on, hg = this.hg; if (this.npc || !D.I.g) return; const ds = D.t.seats.find((s) => s[4]); if (!ds) return;
    const b = hg.mkBear(Math.random() < 0.5 ? 'office' : 'stroll', Math.random, 1.0, { weather: 'clear' }); hg.scene.remove(b.root); D.I.g.add(b.root);
    b.root.position.set(ds[1], ds[2] + 0.05, ds[3]); b.root.rotation.y = 0; b.setSeated?.(true); b.update?.(0.016, 0, { noCrawl: true }); b.root.userData.npc = false; this.npc = b; b.base = b.root.scale.x; this.npcFitT = 0.1;
  }
  dropNpc() { if (!this.npc) return; this.npc.root.parent?.remove(this.npc.root); this.npc = null; }
  // 가까운 찻길 (30m 안, 차 머리 방향과 같은 쪽으로)
  snapRoad(v) {
    const hg = this.hg; let best = null; const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [li, i] of hg.driveGrid?.get(`${Math.floor(v.x / 50) + a},${Math.floor(v.z / 50) + b}`) || []) {
      const L = hg.driveLines[li]; if (!L) continue;
      for (const k of [i, i + 1]) { if (k < 1 || k >= L.pts.length) continue; const p = L.pts[k - 1], q = L.pts[k], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, tt = clamp(((v.x - p[0]) * dx + (v.z - p[1]) * dz) / l2, 0, 1), x = p[0] + dx * tt, z = p[1] + dz * tt, d = Math.hypot(x - v.x, z - v.z); if (d < 30 && (!best || d < best.dd)) { const l = Math.sqrt(l2); best = { L, d: L.cum[k - 1] + l * tt, dd: d, dir: (dx * fx + dz * fz) >= 0 ? 1 : -1 }; } }
    }
    return best;
  }
  // 타고 있는 동안 자리 바꾸기
  switchSeat(i) {
    const D = this.on; if (!D || i === D.seat) return; const t = D.t;
    if (t.seats[i][4]) { this.dropNpc(); D.seat = i; this.takeWheel(); return; }
    const wasDriver = D.driver; D.seat = i;
    if (wasDriver) this.giveWheel(); else this.hg.onToast?.(`🪑 ${t.seats[i][0]}(으)로 옮겼어요`);
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
    if (!force && !D.driver && D.v.cur > 2.2) { D.v.stopReq = true; D.exitReq = true; this.pop('🛑 세워 달라고 했어요 · 서면 내려요'); return; }
    if (!force && D.driver && Math.abs(D.speed) > 2.2) { this.pop('🛑 멈춘 뒤 내려요 (S 브레이크)'); return; }
    const v = D.v, lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), s = D.t.seats[D.seat];
    // 내 자리 쪽 문 밖으로 (막혔으면 반대쪽 · 뒤)
    const tries = [[Math.sign(s[1]) || 1, s[3]], [-(Math.sign(s[1]) || 1), s[3]], [0, -v.len / 2 - 1]], out = [];
    for (const [sd, lz2] of tries) { const k = sd === 0 ? 0 : v.hw + 0.7, x = v.x + lx * sd * k + fx * lz2, z = v.z + lz * sd * k + fz * lz2; out.push([x, z]); }
    let pick = out[0]; for (const p of out) { const r = hg.pushOut(p[0], p[1], 0.2, 0.3); if (!r.hit && hg.walkable(p[0], p[1], 0)) { pick = p; break; } }
    // 내가 몰던 차는 그 자리에 세워 두고, 젤리 운전사가 몰던 차는 다시 제 길을 간다
    if (D.driver) { v.player = false; v.parked = true; v.cur = 0; v.brake = 0; v.blink = 0; } else { v.ride = false; v.stopReq = false; }
    // 빼앗은 실시간 버스: 내 화면의 복사본은 치우고, 실제 버스를 지금 실시간 자리에 다시 보인다
    const liveBack = v.liveId != null; if (liveBack) { const T = hg.traffic, i = T?.list.indexOf(v) ?? -1; if (i >= 0) T.list.splice(i, 1); const o = hg.live?.buses.get(v.liveId); if (o) o.hijack = false; v.liveId = null; }
    v.keep = false; v.hidden = false; this.dropNpc();
    D.I.g.visible = false; if (D.I.g.parent) D.I.g.parent.remove(D.I.g);
    this.on = null; this.el.hud.classList.add('hidden'); this.engine(false);
    hg.bear.setSeated?.(false); hg.bear.root.rotation.set(0, 0, 0); if (this.bearBase != null) { hg.bear.root.scale.setScalar(this.bearBase); this.bearBase = null; this.fitSeat = -1; } hg.placeAt(pick[0], pick[1], v.yaw); hg.y = 0;
    if (this.cam0) { this.cam0.near = this.near0; this.cam0.updateProjectionMatrix(); this.cam0 = null; }
    this.el.hud.classList.remove('pass'); this.closeSeats();
    hg.onToast?.(liveBack ? '🚪 내렸어요 · 버스는 실제 자리로 돌아갔어요' : '🚪 내렸어요');
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
    // 손님 자리: 차는 hangang-vehicles.js 가 길을 따라 몬다. 나는 따라가기만
    if (!D.driver) {
      D.speed = v.cur; hg.px = v.x; hg.pz = v.z; hg.face = v.yaw; hg.v = 0; hg.y = 0;
      if (this.npc) { this.npc.update?.(dt, 0, { noCrawl: true }); this.npcFitT -= dt; if (this.npcFitT <= 0) { this.npcFitT = 1; fitSeated(this.npc.root, t, t.seats.find((q) => q[4]), this.npc.base); } }
      if (D.exitReq && v.cur < 0.4) { this.exit(true); return; }
      this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hudT = 0.2; this.el.hud.querySelector('.spd b').textContent = Math.round(v.cur * 3.6); this.el.hud.querySelector('.spd small').textContent = `${t.seats[D.seat][0]} · 젤리 운전사`; for (const b of this.el.hud.querySelectorAll('button')) b.classList.toggle('on', b.dataset.k === 'view' && D.view === 'fp'); }
      return;
    }
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
    // 탄 차는 차 안 그림(바깥 몸통 + 엷은 유리)으로 그린다 → 밖에서도 창 너머로 앉은 젤리가 보인다
    v.hidden = !bike;
    const I = D.I; if (I.g) { I.g.visible = !bike; I.g.position.set(v.x, ty, v.z); I.g.rotation.set(v.pitch || 0, v.yaw, v.roll || 0, 'YXZ'); if (I.shell) { const st = I.shell.geometry.attributes.iSt; st.setXYZW(0, v.head, v.brake, v.blink, 0); st.needsUpdate = true; } }
    if (hg.shadow) hg.shadow.visible = false;
    // 곰: 고른 자리 방석 위에 앉은 자세 (8-21-3 승객과 같은 방식), 1인칭이면 숨긴다
    if (D.view !== 'fp') {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(v.x, ty, v.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(v.pitch || 0, v.yaw, v.roll || 0, 'YXZ')), new THREE.Vector3(1, 1, 1)), p = new THREE.Vector3(s[1], s[2] + (bike ? 0.02 : 0.05), s[3]).applyMatrix4(m);
      hg.bear.root.visible = true; hg.bear.setSeated?.(true); hg.bear.root.position.copy(p); hg.bear.root.rotation.set(v.pitch || 0, v.yaw, v.roll || 0, 'YXZ');
      this.bearBase ??= hg.bear.root.scale.x; this.fitT = (this.fitT ?? 0) - 1 / 60; if (this.fitT <= 0 || this.fitSeat !== D.seat) { this.fitT = 0.5; this.fitSeat = D.seat; fitSeated(hg.bear.root, t, s, this.bearBase); }
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
    if (c.v.live) { el.querySelector('.ic').textContent = '🚌'; el.querySelector('b').textContent = `${c.v.live.route}번 버스 · 실시간`; el.querySelector('small').textContent = '운전석 = 내 화면에서만 운전 · 승객 = 실제 노선대로'; el.querySelector('.b1').innerHTML = '타기 · 자리 고르기 <kbd>E</kbd>'; el.classList.remove('hidden'); return; }
    const t = c.v.t; el.querySelector('.ic').textContent = t.cat === 'bike' ? '🛵' : t.cat === 'bus' ? '🚌' : t.cat === 'truck' ? '🚚' : '🚗';
    el.querySelector('b').textContent = t.name; el.querySelector('small').textContent = c.v.parked ? '세워 둔 차예요' : '운전하는 젤리가 깜짝 놀라 내려요';
    el.querySelector('.b1').innerHTML = '타기 · 자리 고르기 <kbd>E</kbd>'; el.classList.remove('hidden');
  }
  where() { const D = this.on; return D ? `${{ bike: '🛵', bus: '🚌', truck: '🚚' }[D.t.cat] || '🚗'} ${D.t.name} ${D.driver ? '운전 중' : D.t.seats[D.seat][0]} · ${Math.round(Math.abs(D.speed) * 3.6)}km/h` : null; }
  dispose() { if (this.on) this.exit(true); for (const p of this.peds) this.hg.removePerson({ bears: [p.b] }); this.peds = []; this.el.card.classList.add('hidden'); }
}
