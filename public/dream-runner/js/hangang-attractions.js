// 서울 명소 체험 (8-18): 명소에 다가가면 이름 · 한 줄 소개 · [체험하기](E · 휴대폰 단추) → 체험 → 명소 도장
//   명소 하나 = SPOTS 의 한 줄: { id, name, icon, intro, x, z, r(다가간 거리), build?(A) → { tick?, dispose? }, start(A) → 체험 }
//   체험(exp) = { title, lock?(움직임 잠금), tick(dt, inp), cam?(camera, dt), act?(), end(), where?() } · 끝나면 A.finish(exp)
//   다른 명소(예: 롯데월드)는 registerAttraction({ ... }) 로 붙이면 지도 · 미니맵 · 도장첩에 저절로 나온다 (도장 id 는 서버 HG_STAMPS 에도)
//   도장: 이 기기(localStorage) + 서버(/api/dream/hangang/stamp, 시작 → 최소 시간 → 끝). hg.onStamp(id, 'begin' | 'done') 로 main.js 가 보낸다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sound } from './music.js';

const KX = 111320 * Math.cos((37.53 * Math.PI) / 180), KZ = 110574;
export const LL = (lat, lon) => [(lon - 126.98) * KX, -(lat - 37.53) * KZ];
function inRingXZ(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const STAMP_KEY = 'dreamrunner.hangang.stamps';

// ---------- 명소 목록 ----------
export const SPOTS = [];
export function registerAttraction(def) { const i = SPOTS.findIndex((s) => s.id === def.id); if (i >= 0) SPOTS[i] = def; else SPOTS.push(def); return def; }
// 지도에 그릴 것: 동네(첫 화면 목록 28곳) + 체험 명소
//   동네 자리는 지역 코스 가운데(seoul.json regions) 또는 아래 좌표
export const HOOD_SPOTS = [['마곡나루', '🌿', -13433, -4018], ['목동', '🏙️', -10216, 414], ['구로디지털', '💻', -6816, 5012], ['가산디지털', '🏭', -8571, 5328], ['노량진', '🐟', -3354, 1815], ['서울대입구', '⛰️', -2407, 5390], ['연신내', '🛍️', -5201, -9815], ['수유', '🏔️', 4053, -11957], ['창동', '🚉', 5843, -13541], ['노원', '🌳', 7105, -13767], ['성신여대', '🎒', 3229, -6938], ['청량리', '🧺', 5726, -5535], ['상봉', '🌸', 9303, -7338], ['건대입구', '🍢', 7990, -1081], ['천호', '🌉', 12659, -923]];
export function mapPlaces() { return SPOTS.filter((s) => !s.hidden).map((s) => ({ kind: 'spot', id: s.id, name: s.name, icon: s.icon, x: s.x, z: s.z, go: s.go || [s.x, s.z, s.face || 0] })); }

// ---------- 화면 (도장첩 · 다가가면 뜨는 카드 · 체험 중 띠) ----------
const CSS = `
#at-card{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);display:flex;gap:12px;align-items:center;padding:10px 12px 10px 14px;border-radius:18px;background:rgba(14,20,36,.78);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);color:#fff;font-family:'Jua',sans-serif;max-width:min(560px,calc(100vw - 32px));box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .25s, transform .25s;z-index:6}
#at-card.hidden{opacity:0;pointer-events:none;transform:translate(-50%,10px)}
#at-card .ic{font-size:30px;line-height:1}
#at-card b{font-size:17px;display:block}
#at-card small{display:block;font-family:system-ui,sans-serif;font-size:12.5px;opacity:.85;margin-top:2px;line-height:1.35}
#at-card button,#at-bar button{flex:none;border:0;border-radius:14px;padding:10px 14px;font-family:'Jua',sans-serif;font-size:15px;cursor:pointer;background:linear-gradient(180deg,#ffd76a,#ffb547);color:#3a2400;box-shadow:0 3px 0 #c98418}
#at-card button kbd{font-family:inherit;background:rgba(0,0,0,.14);border-radius:6px;padding:1px 6px;margin-left:6px;font-size:13px}
#at-card .done{font-size:12px;color:#ffb3c0;margin-top:3px;display:block}
#at-bar{position:absolute;left:50%;top:62px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:8px 10px 8px 14px;border-radius:16px;background:rgba(14,20,36,.72);backdrop-filter:blur(8px);color:#fff;font-family:'Jua',sans-serif;border:1px solid rgba(255,255,255,.16);max-width:calc(100vw - 32px);z-index:6}
#at-bar.hidden{display:none}
#at-bar .t{font-size:15px}
#at-bar .s{font-family:system-ui,sans-serif;font-size:12.5px;opacity:.88;display:block;margin-top:1px}
#at-bar button{padding:7px 10px;font-size:13px}
#at-bar button.x{background:rgba(255,255,255,.16);color:#fff;box-shadow:none}
#at-book-btn{font-size:18px}
#at-book{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.55);backdrop-filter:blur(3px)}
#at-book.hidden{display:none}
#at-book .pg{width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 60px);overflow:auto;border-radius:22px;padding:18px 18px 14px;background:#fbf6ea;color:#3a2a1a;font-family:'Jua',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35);background-image:radial-gradient(rgba(160,120,60,.08) 1px,transparent 1px);background-size:9px 9px}
#at-book h3{margin:0 0 2px;font-size:22px}
#at-book .sub{font-family:system-ui,sans-serif;font-size:13px;opacity:.7;margin-bottom:12px}
#at-book .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}
#at-book .it{position:relative;border-radius:16px;border:2px dashed rgba(120,80,40,.28);padding:12px 8px 10px;text-align:center;cursor:pointer;background:rgba(255,255,255,.55)}
#at-book .it:hover{background:#fff}
#at-book .it .ic{font-size:30px;filter:grayscale(1);opacity:.45}
#at-book .it.on{border-style:solid;border-color:rgba(200,40,60,.35)}
#at-book .it.on .ic{filter:none;opacity:1}
#at-book .it .nm{display:block;font-size:15px;margin-top:4px}
#at-book .it .d{display:block;font-family:system-ui,sans-serif;font-size:11px;opacity:.65;margin-top:2px}
#at-book .seal{position:absolute;right:6px;top:6px;width:44px;height:44px;border-radius:50%;border:3px solid #d0283c;color:#d0283c;font-size:11px;line-height:1.05;display:flex;align-items:center;justify-content:center;transform:rotate(-14deg);background:rgba(255,240,240,.6);font-family:'Jua',sans-serif}
#at-book .x{float:right;border:0;background:rgba(0,0,0,.08);border-radius:12px;padding:6px 10px;font-family:'Jua',sans-serif;cursor:pointer}
#at-pop{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%) scale(.6) rotate(-16deg);opacity:0;z-index:41;pointer-events:none;width:150px;height:150px;border-radius:50%;border:6px solid #d0283c;color:#d0283c;background:rgba(255,248,240,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Jua',sans-serif;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.25);transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .3s}
#at-pop.on{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(-12deg)}
#at-pop i{font-style:normal;font-size:40px}
#at-pop b{font-size:17px;margin-top:2px}
#at-pop small{font-size:11px;opacity:.8}
body.touch #at-card{bottom:150px}
/* 체험 띠가 떠 있을 땐 알림(토스트)을 띠 아래로 (겹쳐 가렸다) */
body.at-on #toast{top:128px}
`;

class Attractions {
  constructor(hg) {
    this.hg = hg; this.built = new Map(); this.exp = null; this.near = null; this.scanT = 0; this.stamps = {};
    try { this.stamps = JSON.parse(localStorage.getItem(STAMP_KEY) || '{}') || {}; } catch { this.stamps = {}; }
    if (hg.cloudStamps) this.mergeStamps(hg.cloudStamps);
    // 명소가 만든 걸을 수 있는 곳(물 위 다리 · 섬) · 바닥 높이: { id, fn } — 그 명소를 치우면 같이 빠진다
    this.walkZones = []; this.floorZones = []; this.lits = []; this.curId = null;
    hg.attrWalk = (x, z) => { for (const w of this.walkZones) if (w.fn(x, z)) return true; return !!this.exp?.walk?.(x, z); };
    hg.attrFloor = (x, z, y) => { let g = -1; for (const f of this.floorZones) { const v = f.fn(x, z, y); if (v > g) g = v; } if (this.exp?.floor) { const v = this.exp.floor(x, z, y); if (v > g) g = v; } return g; };
    (hg.litFns ||= []).push((lit, hr) => { for (const l of this.lits) l.fn(lit, hr); });
    this.root = new THREE.Group(); this.root.userData.noDrape = true; this.root.name = 'attractions'; hg.scene.add(this.root);
    this.ui();
  }
  // 그 자리 땅 높이 (지형 그대로)
  H(x, z) { return this.hg.terrAt(x, z, true); }
  ui() {
    const hud = document.getElementById('hg-hud'); if (!hud || document.getElementById('at-card')) { this.el = { card: document.getElementById('at-card'), bar: document.getElementById('at-bar'), book: document.getElementById('at-book'), pop: document.getElementById('at-pop') }; return; }
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const card = document.createElement('div'); card.id = 'at-card'; card.className = 'hidden'; hud.appendChild(card);
    const bar = document.createElement('div'); bar.id = 'at-bar'; bar.className = 'hidden'; hud.appendChild(bar);
    const book = document.createElement('div'); book.id = 'at-book'; book.className = 'hidden'; document.body.appendChild(book);
    const pop = document.createElement('div'); pop.id = 'at-pop'; document.body.appendChild(pop);
    const r = hud.querySelector('.hg-r'); if (r) { const b = document.createElement('button'); b.id = 'at-book-btn'; b.className = 'btn ghost mini'; b.setAttribute('aria-label', '명소 도장첩'); b.textContent = '🎫'; b.onclick = () => this.openBook(); r.insertBefore(b, r.firstChild); }
    book.addEventListener('pointerdown', (e) => { if (e.target === book) book.classList.add('hidden'); });
    this.el = { card, bar, book, pop };
  }
  // ---------- 도장 ----------
  mergeStamps(S) { let ch = false; for (const [id, t] of Object.entries(S || {})) if (!this.stamps[id] || this.stamps[id] > t) { this.stamps[id] = t; ch = true; } if (ch) this.saveStamps(); }
  saveStamps() { try { localStorage.setItem(STAMP_KEY, JSON.stringify(this.stamps)); } catch { /* 무시 */ } }
  begin(id) { this.hg.onStamp?.(id, 'begin'); }
  stamp(id, label) {
    const s = SPOTS.find((q) => q.id === id) || { name: label || id, icon: '🎫' }, first = !this.stamps[id];
    if (first) { this.stamps[id] = Date.now(); this.saveStamps(); }
    this.hg.onStamp?.(id, 'done');
    const P = this.el.pop; P.innerHTML = `<i>${s.icon}</i><b>${label || s.name}</b><small>${first ? '도장 쾅!' : '또 왔어요'} · ${new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</small>`;
    P.classList.add('on'); clearTimeout(P.h); P.h = setTimeout(() => P.classList.remove('on'), 2200);
    this.drum(0.9, 70, 0.25);
  }
  openBook() {
    const B = this.el.book, list = SPOTS.filter((s) => !s.hidden && s.start), n = list.filter((s) => this.stamps[s.id]).length;
    B.innerHTML = `<div class="pg"><button class="x">닫기</button><h3>🎫 서울 명소 도장첩</h3><div class="sub">명소에서 체험하면 도장이 찍혀요 · ${n} / ${list.length} · 누르면 그곳으로 가요</div><div class="grid">${list.map((s) => { const t = this.stamps[s.id]; return `<div class="it${t ? ' on' : ''}" data-id="${s.id}"><span class="ic">${s.icon}</span><span class="nm">${s.name}</span><span class="d">${t ? new Date(t).toLocaleDateString('ko-KR') : s.intro}</span>${t ? `<span class="seal">${s.seal || s.name.slice(0, 4)}</span>` : ''}</div>`; }).join('')}</div></div>`;
    B.querySelector('.x').onclick = () => B.classList.add('hidden');
    for (const it of B.querySelectorAll('.it')) it.onclick = () => { const s = SPOTS.find((q) => q.id === it.dataset.id); B.classList.add('hidden'); if (s) this.goTo(s); };
    B.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock?.();
  }
  goTo(s) { if (this.exp) this.finish(this.exp, true); const [x, z, f] = s.go || [s.x, s.z, s.face || 0]; this.hg.placeAt(x, z, f); this.hg.onToast?.(`${s.icon} ${s.name}(으)로 왔어요`); }
  // ---------- 매 프레임 ----------
  lockInput(inp) { return { ...inp, mx: 0, mz: 0, jump: false, jumpHeld: false, slide: false, sprint: inp.sprint }; }
  get lock() { return !!this.exp?.lock; }
  tick(dt, inp) {
    const hg = this.hg, px = hg.px, pz = hg.pz;
    // 가까운 명소의 풍경 · 사람은 1.2km 안에서 만들고 2km 밖이면 치운다
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.3;
      for (const s of SPOTS) {
        const d = Math.hypot(px - s.x, pz - s.z), B = this.built.get(s.id);
        if (s.build && !B && d < (s.buildR || 1200) && !hg.chunkLoading) { this.curId = s.id; try { this.built.set(s.id, s.build(this) || {}); } catch (e) { console.warn('명소 만들기 실패', s.id, e); this.built.set(s.id, {}); } }
        else if (B && d > (s.buildR || 1200) + 800 && this.exp?.spot !== s) { B.dispose?.(); B.group && this.root.remove(B.group); this.built.delete(s.id); const keep = (a) => a.filter((w) => w.id !== s.id); this.walkZones = keep(this.walkZones); this.floorZones = keep(this.floorZones); this.lits = keep(this.lits); }
      }
      if (!this.exp) {
        let best = null, bd = Infinity; for (const s of SPOTS) { if (s.hidden || !s.start) continue; for (const [x, z] of s.pts || [[s.x, s.z]]) { const d = Math.hypot(px - x, pz - z); if (d < (s.r || 30) && d < bd) { bd = d; best = s; } } }
        if (best && hg.y > 30 && !best.high) best = null;
        // 차를 운전하는 동안엔 명소 카드를 띄우지 않는다
        if (hg.drive?.on) best = null;
        if (best !== this.near) { this.near = best; this.showCard(best); }
        // 같은 명소 안에서 옆 기구로 옮겨 가면 소개 문구도 그 기구 것으로 (롯데월드처럼 체험 자리가 여럿인 곳)
        else if (best?.introNow && best.introNow(this) !== this.cardTxt) this.showCard(best);
      }
    }
    for (const [id, B] of this.built) if (B.tick) B.tick(dt, this.exp?.spot?.id === id ? this.exp : null);
    if (this.exp) { const E = this.exp; E.t = (E.t || 0) + dt; E.tick(dt, inp); if (this.exp !== E) return; this.barT = (this.barT || 0) - dt; if (this.barT <= 0) { this.barT = 0.25; this.drawBar(); } }
  }
  cam(camera, dt) { this.exp?.cam?.(camera, dt); }
  showCard(s) {
    const C = this.el.card; if (!s) { C.classList.add('hidden'); return; }
    const t = this.stamps[s.id]; this.cardTxt = typeof s.introNow === 'function' ? s.introNow(this) : s.intro;
    C.innerHTML = `<span class="ic">${s.icon}</span><div><b>${s.name}</b><small>${this.cardTxt}</small>${t ? '<span class="done">🎫 도장 받음</span>' : ''}</div><button>${s.verb || '체험하기'}<kbd>E</kbd></button>`;
    C.querySelector('button').onclick = () => this.act(); C.classList.remove('hidden');
  }
  drawBar() {
    const E = this.exp, B = this.el.bar; document.body.classList.toggle('at-on', !!E); if (!E) { B.classList.add('hidden'); return; }
    const s = typeof E.status === 'function' ? E.status() : E.status || '', a = E.actLabel ? (typeof E.actLabel === 'function' ? E.actLabel() : E.actLabel) : '';
    const html = `<div><span class="t">${E.spot.icon} ${E.title}</span><span class="s">${s}</span></div>${a ? `<button class="a">${a} <kbd>E</kbd></button>` : ''}<button class="x">그만하기</button>`;
    if (B.dataset.h !== html) { B.dataset.h = html; B.innerHTML = html; B.querySelector('.x').onclick = () => this.finish(this.exp, true); const ab = B.querySelector('.a'); if (ab) ab.onclick = () => this.act(); }
    B.classList.remove('hidden');
  }
  // E · 단추: 체험 중이면 그 체험의 동작, 아니면 가까운 명소 체험 시작. 쓴 키면 true (아니면 속도 올리기)
  act() {
    if (this.exp) { if (this.exp.act) { this.exp.act(); this.barT = 0; return true; } return false; }
    if (!this.near) return false;
    const s = this.near; this.el.card.classList.add('hidden');
    const E = s.start(this); if (!E) { this.showCard(s); return true; }
    E.spot = s; E.t = 0; this.exp = E; this.near = null; this.begin(E.stampId || s.id); this.barT = 0; this.drawBar(); return true;
  }
  // 체험 끝 (quit = 중간에 그만둠: 도장 없음)
  finish(E, quit = false) {
    if (!E || this.exp !== E) return; this.exp = null;
    try { E.end?.(quit); } catch (e) { console.warn(e); }
    this.el.bar.classList.add('hidden'); this.el.bar.dataset.h = ''; document.body.classList.remove('at-on');
    if (!quit && !E.noStamp) this.stamp(E.stampId || E.spot.id, E.stampLabel);
    this.near = null; this.scanT = 0;
  }
  addWalk(fn) { this.walkZones.push({ id: this.curId, fn }); }
  addFloor(fn) { this.floorZones.push({ id: this.curId, fn }); }
  addLit(fn) { this.lits.push({ id: this.curId, fn }); }
  where() { return this.exp ? `${this.exp.spot.icon} ${this.exp.where?.() || this.exp.title}` : null; }
  // 미니맵: 가까운 명소 아이콘 (m = 화면 px / m, c = 가운데)
  drawMini(ctx, size, m, c) {
    const hg = this.hg; ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of SPOTS) {
      if (s.hidden) continue; let x = c + (s.x - hg.px) * m, y = c + (s.z - hg.pz) * m; const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), R = size / 2 - 13;
      const edge = d > R; if (edge) { if (d > R * 3.2) continue; x = c + (dx / d) * R; y = c + (dy / d) * R; }
      ctx.globalAlpha = edge ? 0.75 : 1; ctx.fillStyle = this.stamps[s.id] ? '#ffe7ea' : '#ffffff'; ctx.strokeStyle = this.stamps[s.id] ? '#d0283c' : '#ff9f1a'; ctx.lineWidth = 2.5;
      const rr = edge ? size / 26 : size / 20; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = `${Math.round(rr * 1.25)}px sans-serif`; ctx.fillStyle = '#000'; ctx.fillText(s.icon, x, y + 1);
    }
    ctx.restore();
  }
  // 북소리 (짧게): 낮은 사인 + 짧은 잡음
  drum(vol = 1, f0 = 90, len = 0.5) {
    if (sound.muted) return; try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ac ||= new AC(); const ac = this.ac, t = ac.currentTime; if (ac.state !== 'running') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.08); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len + 0.05);
      const n = ac.createBufferSource(), buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; n.buffer = buf; const ng = ac.createGain(); ng.gain.value = 0.12 * vol; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; n.connect(lp).connect(ng).connect(ac.destination); n.start(t);
    } catch { /* 소리 없이 */ }
  }
  // 나팔 (태평소 비슷하게): 높은 톱니파 두어 음
  horn(notes = [587, 659, 784], dur = 0.32, vol = 0.12) {
    if (sound.muted) return; try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ac ||= new AC(); const ac = this.ac; let t = ac.currentTime;
      for (const f of notes) { const o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.012, t + dur); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.4; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol, t + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(bp).connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02); t += dur; }
    } catch { /* 소리 없이 */ }
  }
}
export function setupAttractions(hg) { return new Attractions(hg); }
// 손으로 따로 만드는 건물: 지도 건물 목록에서는 빼고 그린다 (경회루: 돌기둥 위 누각이라 상자 건물이면 안 된다)
export const ATTR_SKIP = new Set(['경회루']);

// ---------- 모양 도우미: 꼭짓점 색으로 묶어 한 번에 그린다 ----------
export function colored(g, col) { const c = new THREE.Color(col), g2 = g.index ? g.toNonIndexed() : g, n = g2.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g2.attributes)) if (!['position', 'normal', 'color'].includes(k)) g2.deleteAttribute(k); return g2; }
export function part(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { const g = geo.clone(); g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return colored(g, col); }
export function merge(list) { return mergeGeometries(list.filter(Boolean), false); }
export const vcMat = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });

// 롯데월드(8-17, 에이전트 E 담당): 지도에만 먼저 표시. 체험(놀이기구)은 그쪽 모듈이 같은 id 로 registerAttraction 하면 바뀐다
{ const [x, z] = LL(37.5111, 127.0980); registerAttraction({ id: 'lotteworld', name: '롯데월드', icon: '🎢', intro: '석촌호수 매직아일랜드 · 실내 어드벤처', x, z, r: 0, go: [x + 60, z + 120, Math.PI] }); }
// ============================================================
// 경복궁: 수문장 교대식 (10:00 · 14:00) · 근정전 조정(품계석 · 어도 · 박석) · 경회루 연못가
// ============================================================
const G = {
  gate: [-281, -5078], heung: [-273, -5192], geunjeongmun: [-270, -5279], geunjeongjeon: [-267, -5368],
  hyeopsaeng: [-218, -5141], yongseong: [-333, -5145], gyeonghoe: [-356, -5501],
};
// 수문군 한 사람: 철릭(긴 겉옷) · 머리(곰) · 전립(검은 모자 + 붉은 상모) · 팔 · 들고 있는 것 — 부분마다 인스턴스 (부분 수만큼만 그린다)
function guardParts() {
  const robe = merge([
    part(new THREE.CylinderGeometry(0.17, 0.33, 0.62, 14, 1), '#ffffff', 0, 0.33, 0), // 치마폭 (아래로 퍼짐)
    part(new THREE.SphereGeometry(0.2, 14, 10), '#ffffff', 0, 0.72, 0, 0, 0, 0, 1, 1.1, 0.9), // 몸통
  ]);
  const trim = merge([
    part(new THREE.TorusGeometry(0.175, 0.025, 6, 18), '#ffffff', 0, 0.62, 0, Math.PI / 2), // 광다회 띠
    part(new THREE.CylinderGeometry(0.335, 0.335, 0.035, 14, 1, true), '#ffffff', 0, 0.035, 0), // 옷단
  ]);
  const head = merge([
    part(new THREE.SphereGeometry(0.2, 16, 12), '#b98a5a', 0, 1.04, 0),
    part(new THREE.SphereGeometry(0.065, 10, 8), '#b98a5a', 0.15, 1.19, 0), part(new THREE.SphereGeometry(0.065, 10, 8), '#b98a5a', -0.15, 1.19, 0),
    part(new THREE.SphereGeometry(0.085, 10, 8), '#ead2b4', 0, 1.0, 0.16, 0, 0, 0, 1, 0.8, 0.8), part(new THREE.SphereGeometry(0.028, 8, 6), '#2a1a12', 0, 1.02, 0.235),
    part(new THREE.SphereGeometry(0.022, 6, 6), '#1a1210', 0.07, 1.08, 0.17), part(new THREE.SphereGeometry(0.022, 6, 6), '#1a1210', -0.07, 1.08, 0.17),
  ]);
  const hat = merge([
    part(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), '#17161a', 0, 1.18, 0), // 넓은 챙
    part(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#1d1c21', 0, 1.18, 0, 0, 0, 0, 1, 0.9, 1),
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), '#c9a24a', 0, 1.33, 0), // 정자 (꼭지)
    part(new THREE.ConeGeometry(0.075, 0.16, 10), '#d8252e', 0, 1.36, 0, Math.PI), // 붉은 상모 (술)
    part(new THREE.SphereGeometry(0.02, 6, 6), '#c9a24a', 0.2, 1.17, 0.12), part(new THREE.SphereGeometry(0.02, 6, 6), '#c9a24a', -0.2, 1.17, 0.12), // 패영 구슬
  ]);
  const arm = (() => { const g = new THREE.CapsuleGeometry(0.06, 0.26, 4, 8); g.translate(0, -0.16, 0); return colored(g, '#ffffff'); })();
  const spear = merge([part(new THREE.CylinderGeometry(0.014, 0.014, 2.0, 6), '#5a3a22', 0, 0.9, 0), part(new THREE.ConeGeometry(0.035, 0.2, 6), '#d9dde2', 0, 2.0, 0), part(new THREE.SphereGeometry(0.05, 8, 6), '#d8252e', 0, 1.86, 0, 0, 0, 0, 1, 1.4, 1)]);
  const drum = merge([part(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 16), '#c0392b', 0, 0, 0, Math.PI / 2), part(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 16), '#f2e3c2', 0, 0, 0.1, Math.PI / 2), part(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 16), '#f2e3c2', 0, 0, -0.1, Math.PI / 2), part(new THREE.TorusGeometry(0.17, 0.012, 4, 16), '#2f7a4a', 0, 0, 0.06), part(new THREE.TorusGeometry(0.17, 0.012, 4, 16), '#2f7a4a', 0, 0, -0.06)]);
  const pole = merge([part(new THREE.CylinderGeometry(0.016, 0.016, 2.6, 6), '#4a2e1a', 0, 1.2, 0), part(new THREE.ConeGeometry(0.05, 0.18, 6), '#c9a24a', 0, 2.55, 0), part(new THREE.SphereGeometry(0.06, 8, 6), '#d8252e', 0, 2.4, 0)]);
  return { robe, trim, head, hat, arm, spear, drum, pole };
}
// 오방기 그림 (노랑 · 파랑 · 빨강 · 하양 · 검정 다섯 칸, 불꽃 테두리 화염각 + 가운데 무늬)
function flagAtlas() {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 128; const c = cv.getContext('2d');
  const F = [['#f2c230', '#d8252e'], ['#2a5db0', '#d8252e'], ['#cf2b2b', '#f2c230'], ['#f4f1e8', '#d8252e'], ['#1f1f24', '#d8252e']];
  F.forEach(([bg, fl], i) => {
    const x0 = i * 128; c.fillStyle = bg; c.fillRect(x0, 0, 128, 128);
    c.fillStyle = fl; for (let k = 0; k < 7; k++) { const y = 6 + k * 17; c.beginPath(); c.moveTo(x0 + 128, y); c.lineTo(x0 + 110, y + 8); c.lineTo(x0 + 128, y + 16); c.fill(); } // 화염각 (휘날리는 끝 쪽)
    c.fillRect(x0, 0, 128, 7); c.fillRect(x0, 121, 128, 7);
    c.strokeStyle = i === 3 ? '#2a5db0' : '#f4f1e8'; c.lineWidth = 5; c.beginPath(); c.arc(x0 + 56, 64, 24, 0, 7); c.stroke(); // 가운데 둥근 무늬
    c.fillStyle = i === 3 ? '#2a5db0' : '#f4f1e8'; c.beginPath(); c.arc(x0 + 56, 64, 9, 0, 7); c.fill();
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// 북 가죽: 삼태극
function taegeukTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#f1e2c0'; c.fillRect(0, 0, 128, 128); const C3 = ['#d8252e', '#f2c230', '#2a5db0']; for (let i = 0; i < 3; i++) { c.save(); c.translate(64, 64); c.rotate((i * Math.PI * 2) / 3); c.fillStyle = C3[i]; c.beginPath(); c.arc(0, 0, 40, 0, (Math.PI * 2) / 3); c.arc(20 * Math.cos(Math.PI / 3), 20 * Math.sin(Math.PI / 3), 20, Math.PI / 3 + Math.PI, Math.PI / 3, true); c.closePath(); c.fill(); c.restore(); } c.strokeStyle = '#7a1d22'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.stroke(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
// 박석: 크고 거친 화강암 판석 (조정 마당)
function baksukTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const c = cv.getContext('2d'); c.fillStyle = '#8d877d'; c.fillRect(0, 0, 512, 512);
  let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 512; y += 38 + R() * 0) { let x = -R() * 40; const h = 34 + R() * 10; while (x < 512) { const w = 36 + R() * 50, l = 150 + R() * 45; c.fillStyle = `rgb(${l},${l - 4 - R() * 6},${l - 12 - R() * 8})`; c.beginPath(); const j = () => (R() - 0.5) * 6; c.moveTo(x + 2 + j(), y + 2 + j()); c.lineTo(x + w - 2 + j(), y + 2 + j()); c.lineTo(x + w - 2 + j(), y + h - 2 + j()); c.lineTo(x + 2 + j(), y + h - 2 + j()); c.fill(); for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '40,36,30'},${0.05 + R() * 0.07})`; c.fillRect(x + R() * w, y + R() * h, 2, 2); } x += w; } }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 단청 띠 (초록 바탕 · 머리초 무늬)
function dancheongTex() { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c = cv.getContext('2d'); c.fillStyle = '#2f8a6a'; c.fillRect(0, 0, 256, 32); for (let x = 0; x < 256; x += 32) { c.fillStyle = '#c0392b'; c.fillRect(x, 0, 4, 32); c.fillStyle = '#f2c230'; c.beginPath(); c.arc(x + 16, 16, 8, 0, 7); c.fill(); c.fillStyle = '#2a5db0'; c.beginPath(); c.arc(x + 16, 16, 4.5, 0, 7); c.fill(); c.fillStyle = '#f4f1e8'; c.fillRect(x + 6, 2, 20, 2); c.fillRect(x + 6, 28, 20, 2); } const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }

// 교대식 순서 (초): 엄고 → 교대 수문군 행진(협생문 쪽에서) → 수문장 대면 · 암호 대조(패) → 교대 → 순라(옛 수문군 용성문 쪽으로) → 파수
const CER = [[0, '① 엄고(嚴鼓): 북을 세 번 울려 교대를 알려요'], [12, '② 교대 수문군이 깃발을 앞세우고 행진해 와요'], [38, '③ 수문장끼리 암호를 맞추고 패(牌)를 주고받아요'], [52, '④ 교대 완료 · 지키던 수문군이 순라를 돌며 물러나요'], [70, '⑤ 새 수문군이 흥례문을 지켜요 (파수)'], [80, null]];
const CER_LEN = 80;
function buildGyeongbokgung(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g); const P = guardParts();
  const robeM = new THREE.MeshLambertMaterial({ vertexColors: true }), plainM = vcMat();
  // 사람 목록: 두 무리(지키던 쪽 old · 새로 온 쪽 new) · 무리마다 수문장 1 · 참하 1 · 기수 5 · 북 2 · 수문군 8
  const ROLES = []; for (const side of ['old', 'new']) { ROLES.push({ side, role: 'chief' }, { side, role: 'aide' }); for (let k = 0; k < 5; k++) ROLES.push({ side, role: 'flag', k }); for (let k = 0; k < 2; k++) ROLES.push({ side, role: 'drum', k }); for (let k = 0; k < 8; k++) ROLES.push({ side, role: 'guard', k }); }
  const N = ROLES.length, ROBE = { chief: '#b8323a', aide: '#2f5fa0', guard: '#1f3f7a', drum: '#2f7a4a' }, FLAGR = ['#e0b02a', '#2f5fa0', '#c0392b', '#ece6d6', '#2a2a30'], TRIM = { chief: '#2a5db0', aide: '#d8252e', guard: '#d8252e', drum: '#f2c230', flag: '#d8252e' };
  const mk = (geo, mat, n) => { const im = new THREE.InstancedMesh(geo, mat, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = true; g.add(im); return im; };
  const robe = mk(P.robe, robeM, N), trim = mk(P.trim, robeM, N), head = mk(P.head, plainM, N), hat = mk(P.hat, plainM, N), arms = mk(P.arm, robeM, N * 2);
  const nSpear = ROLES.filter((r) => r.role === 'guard').length, nFlag = ROLES.filter((r) => r.role === 'flag').length, nDrum = ROLES.filter((r) => r.role === 'drum').length;
  const spear = mk(P.spear, plainM, nSpear), pole = mk(P.pole, plainM, nFlag), drum = mk(P.drum, plainM, nDrum);
  const col = new THREE.Color(); ROLES.forEach((R, i) => { robe.setColorAt(i, col.set(R.role === 'flag' ? FLAGR[R.k] : ROBE[R.role])); trim.setColorAt(i, col.set(TRIM[R.role])); arms.setColorAt(i * 2, col.set(R.role === 'flag' ? FLAGR[R.k] : ROBE[R.role])); arms.setColorAt(i * 2 + 1, col); });
  // 깃발 천: 한 장 모양을 여럿 (오방 그림 한 장에서 칸만 바꾼다) · 바람에 물결
  const flagU = { time: { value: 0 } }, fgeo = new THREE.PlaneGeometry(0.95, 0.95, 10, 4); fgeo.translate(0.475, 0, 0); const fOff = new THREE.InstancedBufferAttribute(new Float32Array(nFlag), 1); fgeo.setAttribute('aOff', fOff);
  const fmat = new THREE.MeshLambertMaterial({ map: flagAtlas(), side: THREE.DoubleSide });
  fmat.onBeforeCompile = (sh) => { sh.uniforms.time = flagU.time; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aOff; uniform float time;').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x = vMapUv.x * 0.2 + aOff * 0.2;\n#endif').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat w = position.x / 0.95; transformed.z += sin(position.x * 6.0 - time * 5.0 + aOff * 1.7) * 0.09 * w; transformed.y -= w * w * 0.06;'); };
  const flags = mk(fgeo, fmat, nFlag); for (let k = 0; k < nFlag; k++) fOff.setX(k, ROLES.filter((r) => r.role === 'flag')[k].k);
  // 큰 북(엄고): 흥례문 앞 동쪽, 붉은 북틀 위
  const [hx, hz] = G.heung, baseY = A.H(hx, hz - 20);
  { const D = new THREE.Group(); D.position.set(hx + 15, A.H(hx + 15, hz + 26), hz + 26); D.rotation.y = -Math.PI / 2; g.add(D);
    const frame = merge([part(new THREE.BoxGeometry(0.12, 2.1, 0.12), '#a8302a', -0.85, 1.05, 0), part(new THREE.BoxGeometry(0.12, 2.1, 0.12), '#a8302a', 0.85, 1.05, 0), part(new THREE.BoxGeometry(1.95, 0.12, 0.14), '#a8302a', 0, 2.05, 0), part(new THREE.BoxGeometry(2.2, 0.1, 0.5), '#3a3d44', 0, 2.18, 0), part(new THREE.BoxGeometry(1.6, 0.1, 0.5), '#5a4030', 0, 0.05, 0)]);
    D.add(new THREE.Mesh(frame, plainM));
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.75, 24, 1, true), new THREE.MeshLambertMaterial({ color: '#b03028', side: THREE.DoubleSide })); body.rotation.x = Math.PI / 2; body.position.y = 1.25; D.add(body);
    const skinM = new THREE.MeshLambertMaterial({ map: taegeukTex() }); for (const s of [1, -1]) { const sk = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), skinM); sk.position.set(0, 1.25, s * 0.376); if (s < 0) sk.rotation.y = Math.PI; D.add(sk); }
    D.userData.skin = body; g.userData.bigDrum = D; hg.addCircle(D.position.x, D.position.z, 1.1, 2.4); }
  // 사람 자리: 줄(대열)과 걷는 길
  //   흥례문 앞(남쪽 18m)에 마주 보고 선다. 지키던 쪽은 서쪽 줄, 새로 온 쪽은 동쪽 줄. 행진은 협생문(동) → 앞마당, 물러날 때는 용성문(서)
  const FX = hx, FZ = hz + 18; // 대열 가운데
  const slot = (side, R) => { const sx = side === 'old' ? -1 : 1; let lx = 0, lz = 0;
    if (R.role === 'chief') { lx = sx * 2.2; lz = 0; } else if (R.role === 'aide') { lx = sx * 3.4; lz = 0.9; }
    else if (R.role === 'flag') { lx = sx * (4.8 + (R.k % 3) * 1.1); lz = -1.6 + Math.floor(R.k / 3) * 1.1; }
    else if (R.role === 'drum') { lx = sx * (4.8 + R.k * 1.1); lz = 1.6; }
    else { lx = sx * (4.8 + (R.k % 4) * 1.1); lz = 2.9 + Math.floor(R.k / 4) * 1.1; }
    return [FX + lx, FZ + lz]; };
  const cnt = { old: 0, new: 0 }; const people = ROLES.map((R, i) => { const [x, z] = slot(R.side, R); return { ...R, i, j: cnt[R.side]++, x, z, face: R.side === 'old' ? Math.PI / 2 : -Math.PI / 2, hx: x, hz: z, walk: 0 }; });
  // 행진 길: 대열 자리로 가는 선 (줄 번호대로 늦게 출발)
  const entry = [G.hyeopsaeng[0] - 4, G.hyeopsaeng[1] - 4], exitP = [G.yongseong[0] + 6, G.yongseong[1] - 2];
  const idleSpot = (p) => (p.side === 'new' ? null : [p.hx, p.hz, 0]); // 교대식이 없을 때: 흥례문 앞 서쪽 자리에서 바깥(남쪽)을 보고 지킨다. 교대식 끝에 새 무리가 이 자리로 옮겨 와서 이어진다
  const S = { t: -1, stage: -1, showOld: false, beatT: 0, lastH: hg.state.hour };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), loc = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const place = (p, t) => {
    const y = A.H(p.x, p.z) + Math.abs(Math.sin(p.walk * 2)) * 0.05 * (p.moving ? 1 : 0);
    e.set(0, p.face, 0); q.setFromEuler(e); v.set(p.x, y, p.z); m4.compose(v, q, sc.set(0.95, 0.95, 0.95));
    robe.setMatrixAt(p.i, m4); trim.setMatrixAt(p.i, m4); head.setMatrixAt(p.i, m4); hat.setMatrixAt(p.i, m4);
    const sw = p.moving ? Math.sin(p.walk * 2) * 0.55 : 0;
    for (const sd of [0, 1]) { const s = sd ? -1 : 1; let ax = 0, az = s * 0.12; if (p.role === 'drum') { ax = -1.1 + (p.beat ? Math.max(0, Math.sin(t * 9 + sd * 3)) * -0.5 : 0); az = s * 0.25; } else if (p.role === 'guard' && sd === 0) ax = -0.5; else if (p.role === 'flag' && sd === 0) ax = -0.9; else if (p.role === 'chief' && p.salute && sd === 0) ax = -1.5; else ax = sw * s; loc.makeRotationFromEuler(e.set(ax, 0, az)); loc.setPosition(s * 0.21, 0.86, 0); tmp.multiplyMatrices(m4, loc); arms.setMatrixAt(p.i * 2 + sd, tmp); }
    if (p.role === 'guard') { loc.makeRotationX(0.05); loc.setPosition(0.27, 0.12, 0.12); tmp.multiplyMatrices(m4, loc); spear.setMatrixAt(p.k + (p.side === 'new' ? 8 : 0), tmp); }
    if (p.role === 'flag') { const fi = p.k + (p.side === 'new' ? 5 : 0); loc.makeRotationX(0.06); loc.setPosition(0.25, 0.1, 0.16); tmp.multiplyMatrices(m4, loc); pole.setMatrixAt(fi, tmp); loc.makeRotationY(Math.PI * 0.5 + Math.sin(t * 0.7 + fi) * 0.25); loc.setPosition(0.25, 2.2, 0.16); tmp.multiplyMatrices(m4, loc); flags.setMatrixAt(fi, tmp); }
    if (p.role === 'drum') { loc.makeRotationY(Math.PI / 2); loc.setPosition(0, 0.62, 0.24); tmp.multiplyMatrices(m4, loc); drum.setMatrixAt(p.k + (p.side === 'new' ? 2 : 0), tmp); }
  };
  const hide = (p) => { m4.makeScale(0, 0, 0); robe.setMatrixAt(p.i, m4); trim.setMatrixAt(p.i, m4); head.setMatrixAt(p.i, m4); hat.setMatrixAt(p.i, m4); arms.setMatrixAt(p.i * 2, m4); arms.setMatrixAt(p.i * 2 + 1, m4); if (p.role === 'guard') spear.setMatrixAt(p.k + (p.side === 'new' ? 8 : 0), m4); if (p.role === 'flag') { pole.setMatrixAt(p.k + (p.side === 'new' ? 5 : 0), m4); flags.setMatrixAt(p.k + (p.side === 'new' ? 5 : 0), m4); } if (p.role === 'drum') drum.setMatrixAt(p.k + (p.side === 'new' ? 2 : 0), m4); };
  const walkTo = (p, tx, tz, dt, speed = 1.25) => { const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < 0.05) { p.moving = false; return true; } const s = Math.min(d, speed * dt); p.x += (dx / d) * s; p.z += (dz / d) * s; p.face = Math.atan2(dx, dz); p.walk += dt * 4.2; p.moving = true; return false; };
  // 행진 길: 입구 → 대열 앞 (동쪽에서 서쪽으로 4열 종대)
  const routeNew = (p) => { const lane = (p.j) % 4, rank = Math.floor((p.j) / 4); return [[entry[0], entry[1] + lane * 1.1 - 1.6], [FX + 14 + rank * 1.2, FZ + lane * 1.1 - 1.6], [p.hx, p.hz]]; };
  const routeOld = (p) => [[FX - 12, p.hz], [exitP[0], exitP[1] + ((p.j) % 4) * 1.1 - 1.6]];
  const ceremony = () => S.t >= 0 && S.t < CER_LEN;
  const B = {
    group: g, S,
    start() { S.t = 0; S.stage = -1; S.done = false; for (const p of people) { if (p.side === 'old') { p.x = p.hx; p.z = p.hz; p.face = Math.PI / 2; } else { const r0 = routeNew(p)[0]; p.x = r0[0]; p.z = r0[1]; p.leg = 0; p.face = -Math.PI / 2; } p.moving = false; } },
    tick(dt) {
      const h = hg.state.hour; flagU.time.value += dt;
      // 실제 시각: 10시 · 14시 정각이 지나면 교대식 (게임 시계)
      if (!ceremony() && ((S.lastH < 10 && h >= 10 && h < 10.5) || (S.lastH < 14 && h >= 14 && h < 14.5))) this.start(); S.lastH = h;
      const day = h >= 9.5 && h < 17;
      if (ceremony()) {
        S.t += dt; const t = S.t; let st = 0; while (st < CER.length - 1 && t >= CER[st + 1][0]) st++; if (st !== S.stage) { S.stage = st; if (st === 1 || st === 3) A.horn(st === 1 ? [587, 659, 784, 659] : [784, 659, 587]); }
        // 엄고: 초엄 · 이엄 · 삼엄 (점점 빠르게)
        if (t < 12) { S.beatT -= dt; if (S.beatT <= 0) { const k = Math.floor(t / 4); S.beatT = [0.9, 0.6, 0.38][k] || 0.5; A.drum(Math.hypot(hg.px - hx, hg.pz - hz) < 160 ? 1 : 0.3, 70); const D = g.userData.bigDrum; D.userData.hit = 0.15; } }
        for (const p of people) {
          p.beat = p.role === 'drum' && (t < 12 || (t > 12 && t < 38 && p.side === 'new') || (t > 52 && t < 70 && p.side === 'old'));
          p.salute = false;
          if (p.side === 'new') { if (t < 12) { p.moving = false; } else if (t < 38) { const R = routeNew(p), delay = (p.j) * 0.35; if (t - 12 > delay) { const tgt = R[p.leg || 0]; if (walkTo(p, tgt[0], tgt[1], dt, 2.4) && (p.leg || 0) < R.length - 1) p.leg = (p.leg || 0) + 1; } } else if (t < 70) { if (walkTo(p, p.hx, p.hz, dt, 2.4)) p.face = -Math.PI / 2; } else if (walkTo(p, 2 * FX - p.hx, p.hz, dt, 1.8)) p.face = 0; }
          else if (t < 52) { p.moving = false; p.face = Math.PI / 2; }
          else { const R = routeOld(p), delay = (p.j) * 0.3; if (t - 52 > delay) { p.ol ||= 0; const tgt = R[p.ol]; if (walkTo(p, tgt[0], tgt[1], dt, 1.4) && p.ol < R.length - 1) p.ol++; } }
          // 수문장 대면: 서로 한 걸음 앞으로, 경례 · 패 주고받기
          if (p.role === 'chief' && t >= 38 && t < 52) { const dir = p.side === 'old' ? 1 : -1, tx = FX - dir * 0.9; walkTo(p, tx, p.hz, dt, 0.8); if (Math.abs(p.x - tx) < 0.1) { p.face = dir > 0 ? Math.PI / 2 : -Math.PI / 2; p.salute = t > 41 && t < 49; } }
          if ((p.side === 'old' && t > 74) || (p.side === 'new' && (t < 12 || t - 12 < p.j * 0.35))) hide(p); else place(p, t);
        }
        if (S.t >= CER_LEN) { S.t = -1; S.done = true; for (const p of people) { p.ol = 0; p.leg = 0; } }
      } else {
        for (const p of people) { const sp = day ? idleSpot(p) : null; if (!sp) { hide(p); continue; } p.x = sp[0]; p.z = sp[1]; p.face = sp[2]; p.moving = false; p.beat = false; p.salute = false; place(p, 0); }
      }
      const D = g.userData.bigDrum; if (D.userData.hit > 0) { D.userData.hit -= dt; D.userData.skin.scale.set(1, 1 + D.userData.hit * 0.25, 1); }
      for (const im of [robe, trim, head, hat, arms, spear, pole, flags, drum]) im.instanceMatrix.needsUpdate = true;
    },
    dispose() { g.traverse((o) => { o.geometry?.dispose?.(); }); },
  };
  for (const im of [robe, trim, arms]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  buildPalaceGround(A, g, baseY);
  B.tick(0);
  return B;
}
// 근정전 조정: 박석 마당 · 삼도(가운데 어도가 조금 높다) · 품계석(동 문관 · 서 무관 12개씩) · 드므 · 경회루(돌기둥 48개 · 누마루 · 팔작지붕) · 연못 석축 · 돌다리 셋
function buildPalaceGround(A, g) {
  const hg = A.hg, [gx, gz] = G.geunjeongmun, [jx, jz] = G.geunjeongjeon, cx = (gx + jx) / 2, z0 = gz - 8, z1 = jz + 17, gy = A.H(cx, (z0 + z1) / 2);
  const parts = [];
  // 어도: 세 줄 길 (가운데가 높고 넓다), 근정문 → 월대
  const L = z0 - z1, mz = (z0 + z1) / 2;
  // 삼도: 가운데 어도(2.2m, 20cm 높게) · 양옆 길(1.3m) — 판석 그림 그대로, 경계석만 짙게
  { const bt2 = baksukTex(); bt2.repeat.set(0.35, L / 6); const lanes = [[2.2, 0.2, 0], [1.3, 0.1, -1.95], [1.3, 0.1, 1.95]].map(([w, h, ox]) => { const b = new THREE.BoxGeometry(w, h, L); b.translate(cx + ox, gy + h / 2, mz); return b; }); const lm = new THREE.Mesh(mergeGeometries(lanes), new THREE.MeshLambertMaterial({ map: bt2, color: '#e6e0d4' })); lm.receiveShadow = true; g.add(lm); }
  for (const s of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.18, 0.22, L), '#8f897e', cx + s * 1.18, gy + 0.11, mz), part(new THREE.BoxGeometry(0.16, 0.12, L), '#8f897e', cx + s * 2.68, gy + 0.06, mz));
  // 품계석: 월대 앞에서부터 남쪽으로 12줄, 어도에서 동 · 서로 7.5m
  const gs = new THREE.BoxGeometry(0.42, 0.95, 0.24), cap = new THREE.CylinderGeometry(0.21, 0.24, 0.12, 4, 1); cap.rotateY(Math.PI / 4);
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) { const z = z1 + 3 + i * ((L - 8) / 12), x = cx + s * 7.5, y = A.H(x, z); parts.push(part(gs, '#c9c2b2', x, y + 0.47, z), part(new THREE.BoxGeometry(0.6, 0.14, 0.4), '#a7a091', x, y + 0.07, z), part(cap, '#bfb8a8', x, y + 1.0, z, 0, 0, 0, 1, 1, 0.6)); }
  // 드므 (방화수 그릇): 월대 모서리
  const dm = new THREE.CylinderGeometry(0.55, 0.42, 0.62, 16); for (const s of [-1, 1]) { const x = jx + s * 19, z = jz + 13, y = A.H(x, z); parts.push(part(dm, '#4a4038', x, y + 0.31, z), part(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 16), '#5a4a3a', x, y + 0.6, z), part(new THREE.BoxGeometry(0.9, 0.28, 0.9), '#a39c8e', x, y + 0.14 - 0.14, z)); hg.addCircle(x, z, 0.65, 1); }
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) hg.addCircle(cx + s * 7.5, z1 + 3 + i * ((L - 8) / 12), 0.3, 1);
  const stoneM = vcMat(); g.add(new THREE.Mesh(merge(parts), stoneM));
  // 박석 마당 (조정 가운데 넓게): 거친 판석 그림
  const bt = baksukTex(), W = 48; bt.repeat.set(W / 9, L / 9); const pave = new THREE.Mesh(new THREE.PlaneGeometry(W, L - 2), new THREE.MeshLambertMaterial({ map: bt, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); pave.rotation.x = -Math.PI / 2; pave.position.set(cx, gy + 0.03, mz); pave.receiveShadow = true; g.add(pave);
  buildGyeonghoeru(A, g);
}
// 경회루: 정면(동쪽) 7칸 · 옆 5칸, 아래층 돌기둥 48개(바깥 네모 · 안 둥근), 위층 누마루 · 붉은 기둥 · 난간 · 단청, 큰 팔작지붕. 연못 가운데 네모난 섬 위에, 동쪽 돌다리 셋
function buildGyeonghoeru(A, g) {
  const hg = A.hg, [lx, lz] = G.gyeonghoe, bank = A.H(lx + 40, lz), y0 = bank; // 섬 바닥 = 동쪽 둑 높이
  const W = 28.5, D = 34.4, BX = 5, BZ = 7, parts = [], wood = '#9a2b20', stone = '#cfc7b6';
  // 섬 (석축): 건물보다 사방 4m 넓게, 물에서 0.9m 위
  parts.push(part(new THREE.BoxGeometry(W + 8, 1.6, D + 8), '#b3ab9a', lx, y0 - 0.8, lz), part(new THREE.BoxGeometry(W + 8.4, 0.18, D + 8.4), '#c9c1b0', lx, y0 + 0.02, lz));
  // 돌기둥: 바깥 네모 · 안 둥근 (높이 4.9m)
  const PH = 4.9, sq = new THREE.BoxGeometry(0.62, PH, 0.62), rd = new THREE.CylinderGeometry(0.34, 0.36, PH, 14);
  for (let i = 0; i <= BX; i++) for (let j = 0; j <= BZ; j++) { const x = lx - W / 2 + (i * W) / BX, z = lz - D / 2 + (j * D) / BZ, outer = i === 0 || i === BX || j === 0 || j === BZ; if (!outer && (i === 0 || j === 0)) continue; parts.push(part(outer ? sq : rd, stone, x, y0 + PH / 2, z)); hg.addCircle(x, z, outer ? 0.45 : 0.4, y0 + PH - A.H(x, z) - 0.5); }
  // 위층: 마루판 · 붉은 기둥 · 계자 난간 · 창방(단청)
  const FY = y0 + PH; parts.push(part(new THREE.BoxGeometry(W + 1.6, 0.45, D + 1.6), '#6b4a30', lx, FY + 0.22, lz));
  const UH = 4.2; for (let i = 0; i <= BX; i++) for (let j = 0; j <= BZ; j++) { if (!(i === 0 || i === BX || j === 0 || j === BZ) && (i + j) % 2) continue; parts.push(part(new THREE.CylinderGeometry(0.26, 0.28, UH, 12), wood, lx - W / 2 + (i * W) / BX, FY + 0.45 + UH / 2, lz - D / 2 + (j * D) / BZ)); }
  for (const [w, d] of [[W + 1.5, 0.08], [0.08, D + 1.5]]) for (const s of [-1, 1]) { const ox = d === 0.08 ? 0 : s * (W / 2 + 0.75), oz = d === 0.08 ? s * (D / 2 + 0.75) : 0; parts.push(part(new THREE.BoxGeometry(w, 0.08, d === 0.08 ? 0.08 : D + 1.5), '#7a2a20', lx + ox, FY + 1.25, lz + oz)); parts.push(part(new THREE.BoxGeometry(w, 0.5, d === 0.08 ? 0.05 : D + 1.5), '#5d2a20', lx + ox, FY + 0.75, lz + oz, 0, 0, 0, 1, 1, 1)); }
  const stoneM = vcMat(); g.add(new THREE.Mesh(merge(parts), stoneM));
  // 창방 · 평방 (단청 띠)
  const dt = dancheongTex(); dt.repeat.set(8, 1); const band = new THREE.MeshLambertMaterial({ map: dt }); const bg = [];
  for (const [w, d, ox, oz] of [[W + 0.6, 0.35, 0, D / 2 + 0.3], [W + 0.6, 0.35, 0, -D / 2 - 0.3], [0.35, D + 0.6, W / 2 + 0.3, 0], [0.35, D + 0.6, -W / 2 - 0.3, 0]]) { const b = new THREE.BoxGeometry(w, 0.7, d); b.translate(lx + ox, FY + 0.45 + UH - 0.1, lz + oz); bg.push(b); }
  g.add(new THREE.Mesh(mergeGeometries(bg), band));
  // 팔작지붕: 처마가 크게 나오고 끝이 살짝 들린 지붕 (기와 짙은 회색), 용마루 · 합각
  const RY = FY + 0.45 + UH + 0.3, ex = 3.4, rw = W + ex * 2, rd2 = D + ex * 2, rh = 6.2;
  const roof = new THREE.BufferGeometry(), pos = [], idx = [], cl = [], tile = new THREE.Color('#4a4d52'), tile2 = new THREE.Color('#3b3e43');
  const N = 10; const corner = (u) => Math.pow(Math.abs(u), 3) * 0.9; // 처마 끝이 들리는 양
  const ringAt = (t) => { const k = 1 - t * 0.62, hw = (rw / 2) * k, hd = (rd2 / 2) * (1 - t * 0.38), y = RY + Math.pow(t, 1.6) * rh; const pts = []; for (let i = 0; i < N * 4; i++) { const s = (i % N) / N, side = Math.floor(i / N); let x, z, u; if (side === 0) { x = -hw + s * 2 * hw; z = hd; u = -1 + s * 2; } else if (side === 1) { x = hw; z = hd - s * 2 * hd; u = 1 - s * 2; } else if (side === 2) { x = hw - s * 2 * hw; z = -hd; u = 1 - s * 2; } else { x = -hw; z = -hd + s * 2 * hd; u = -1 + s * 2; } pts.push([lx + x, y + corner(u) * (1 - t) * 1.4, lz + z]); } return pts; };
  const RN = 6, rings = []; for (let r = 0; r <= RN; r++) rings.push(ringAt(r / RN * 0.92));
  for (let r = 0; r <= RN; r++) for (const p of rings[r]) { pos.push(...p); const c = r % 2 ? tile : tile2; cl.push(c.r, c.g, c.b); }
  const M = N * 4; for (let r = 0; r < RN; r++) for (let i = 0; i < M; i++) { const a = r * M + i, b = r * M + ((i + 1) % M), c2 = (r + 1) * M + i, d = (r + 1) * M + ((i + 1) % M); idx.push(a, c2, b, b, c2, d); }
  // 꼭대기 덮개 (용마루 높이)
  const top = rings[RN], tc = pos.length / 3; let sx = 0, sy = 0, sz = 0; for (const p of top) { sx += p[0]; sy += p[1]; sz += p[2]; } pos.push(sx / M, sy / M + 0.4, sz / M); cl.push(tile2.r, tile2.g, tile2.b); for (let i = 0; i < M; i++) idx.push(RN * M + i, tc, RN * M + ((i + 1) % M));
  roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roof.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); roof.setIndex(idx); roof.computeVertexNormals();
  const roofM = vcMat({ side: THREE.DoubleSide }); g.add(new THREE.Mesh(roof, roofM));
  const ridge = merge([part(new THREE.BoxGeometry(0.7, 0.75, rd2 * 0.62 * 0.66), '#2f3236', lx, RY + rh * 0.88 + 0.4, lz), part(new THREE.BoxGeometry(0.9, 0.5, 0.9), '#2f3236', lx, RY + rh * 0.88 + 0.75, lz + rd2 * 0.21), part(new THREE.BoxGeometry(0.9, 0.5, 0.9), '#2f3236', lx, RY + rh * 0.88 + 0.75, lz - rd2 * 0.21)]); g.add(new THREE.Mesh(ridge, vcMat()));
  // 밤: 처마 밑 은은한 불빛
  const glowM = new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0, depthWrite: false }); const glow = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, UH * 0.8, D + 0.4), glowM); glow.position.set(lx, FY + 0.45 + UH * 0.45, lz); glow.material.side = THREE.BackSide; g.add(glow);
  A.addLit((lit) => { glowM.opacity = lit * 0.22; });
  // 돌다리 셋 (동쪽 둑 → 섬), 돌난간
  const bp = [], bx0 = lx + W / 2 + 4, bx1 = lx + 40;
  for (const oz of [-D * 0.32, 0, D * 0.32]) { const len = bx1 - bx0 + 2, x = (bx0 + bx1) / 2, w = oz === 0 ? 3.6 : 2.6; bp.push(part(new THREE.BoxGeometry(len, 0.4, w), '#c4bcab', x, y0 - 0.1, lz + oz)); for (const s of [-1, 1]) { bp.push(part(new THREE.BoxGeometry(len, 0.12, 0.14), '#d2cbbb', x, y0 + 0.75, lz + oz + s * (w / 2 - 0.1))); for (let k = 0; k <= 6; k++) bp.push(part(new THREE.BoxGeometry(0.18, 0.8, 0.18), '#bdb5a4', bx0 - 1 + (k * len) / 6, y0 + 0.4, lz + oz + s * (w / 2 - 0.1))); } }
  g.add(new THREE.Mesh(merge(bp), vcMat()));
  // 연못 석축: 물가를 따라 다듬은 돌 벽 (물 위 1m) + 갓돌
  { let poly = null; for (const c of hg.chunks?.values() || []) for (const w of c.water || []) if (inRingXZ(lx + W / 2 + 6, lz, w[0]) || inRingXZ(lx - W / 2 - 6, lz, w[0])) poly = w; if (poly) { const P2 = [], C2 = [], I2 = [], sc2 = new THREE.Color('#9d9585'), sc3 = new THREE.Color('#bdb5a3'); for (const ring of poly) for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], ya = y0 - 1.1, yb = y0 + 0.15, k = P2.length / 3; P2.push(a[0], ya, a[1], b[0], ya, b[1], b[0], yb, b[1], a[0], yb, a[1]); for (let q = 0; q < 4; q++) { const c = q < 2 ? sc2 : sc3; C2.push(c.r, c.g, c.b); } I2.push(k, k + 1, k + 2, k, k + 2, k + 3); }
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); eg.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3)); eg.setIndex(I2); eg.computeVertexNormals(); g.add(new THREE.Mesh(eg, vcMat({ side: THREE.DoubleSide }))); } }
  // 걸어 들어갈 수 있게: 섬 · 다리 위 (물이어도)
  const isl = [lx - W / 2 - 4, lx + W / 2 + 4, lz - D / 2 - 4, lz + D / 2 + 4];
  A.addWalk((x, z) => (x > isl[0] && x < isl[1] && z > isl[2] && z < isl[3]) || ([-D * 0.32, 0, D * 0.32].some((oz) => x > bx0 - 2 && x < bx1 + 2 && Math.abs(z - (lz + oz)) < 1.4)));
  // 다리 · 섬은 둑과 같은 높이 (물을 판 땅 위에서도)
  A.addFloor((x, z) => { const on = (x > isl[0] && x < isl[1] && z > isl[2] && z < isl[3]) || ([-D * 0.32, 0, D * 0.32].some((oz) => x > bx0 - 2 && x < bx1 + 2 && Math.abs(z - (lz + oz)) < 1.4)); return on ? y0 + 0.1 - A.H(x, z) : -1; });
}
registerAttraction({
  id: 'gbg', name: '경복궁', seal: '경복궁', icon: '🏯', x: G.heung[0] - 4, z: G.heung[1] + 40, r: 70, face: Math.PI, buildR: 900,
  intro: '조선의 으뜸 궁궐 · 매일 10시 · 14시 흥례문 앞에서 북 · 깃발 · 행렬의 교대식',
  introNow(A) { const h = A.hg.state.hour, B = A.built.get('gbg'); if (B?.S?.t >= 0) return '지금 교대식이 열리고 있어요! 가까이에서 봐요'; const nx = h < 10 ? 10 : h < 14 ? 14 : 10; return `다음 교대식 ${nx}:00 · 지금 ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')} (체험하면 그 시각으로)`; },
  build: buildGyeongbokgung,
  start(A) {
    const hg = A.hg, B = A.built.get('gbg'); if (!B) return null;
    // 교대식 보기 좋은 자리: 대열 남서쪽 앞
    hg.placeAt(G.heung[0] - 3, G.heung[1] + 29, Math.PI * 0.97); hg.camPitch = 0.22;
    if (!(B.S.t >= 0)) { const h = hg.state.hour, nx = h < 10 ? 10 : h < 14 ? 14 : 10; hg.state.hour = nx - 0.01; B.S.lastH = nx - 0.02; hg.onToast?.(`⏩ ${nx}:00 수문장 교대식 시각으로`); }
    return {
      title: '수문장 교대식', seal: '경복궁',
      status() { const S = B.S; if (S.t < 0) return S.done ? '교대식이 끝났어요 · 근정전 마당 · 경회루 연못가도 걸어 봐요' : '곧 시작해요… 북소리를 기다려요'; let st = 0; while (st < CER.length - 1 && S.t >= CER[st + 1][0]) st++; return CER[st][1] || ''; },
      tick() { if (B.S.done && B.S.t < 0) { B.S.done = false; A.finish(this); } if (Math.hypot(hg.px - G.heung[0], hg.pz - G.heung[1]) > 260) A.finish(this, true); },
      end() {},
      where() { return '경복궁 흥례문 앞'; },
    };
  },
});

// ============================================================
// 남산 케이블카: 회현 쪽 아래 정류장 ↔ 정상 아래 위 정류장 (실제 건물 자리, 줄 두 가닥에 객차 두 대가 엇갈린다)
//   타면 문이 닫히고 → 줄을 따라 오르내리며(객차 밖에서 보는 시점, 마우스로 돌려 보기) → 반대편 정류장에 내린다
// ============================================================
const CABLE_LOW = [355.6, -2946.3], CABLE_TOP = [649.6, -2481.8];
// 판 글씨 (정류장 · 선착장 · 대여소 안내판)
export function signTex(text, sub, bg = '#1d3b2f', fg = '#fff6dc') { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, 512, 128); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 4; c.strokeRect(6, 6, 500, 116); c.fillStyle = fg; c.textAlign = 'center'; c.font = 'bold 54px "Jua", sans-serif'; c.fillText(text, 256, sub ? 66 : 82); if (sub) { c.font = '28px sans-serif'; c.globalAlpha = 0.8; c.fillText(sub, 256, 108); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// 정류장 지붕: 줄 끝을 감는 큰 바퀴 · 철골 문틀 · 지붕 · 타는 곳 바닥 · '케이블카 타는 곳' 판 (밤에 불)
function buildCable(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g); const C = hg.cableRef;
  const ends = C ? [[C.end.x, C.end.z, C.end.y, -1], [C.start.x, C.start.z, C.start.y, 1]] : [];
  const parts = [];
  for (const [x, z, cy, sgn] of ends) {
    // u = 줄이 정류장 밖으로 나가는 쪽
    const dx = sgn > 0 ? C.end.x - C.start.x : C.start.x - C.end.x, dz = sgn > 0 ? C.end.z - C.start.z : C.start.z - C.end.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ry = Math.atan2(ux, uz), gy = A.H(x, z);
    for (const o of [-3, 4]) { const px = x - ux * o, pz = z - uz * o; for (const sd of [-2.6, 2.6]) parts.push(part(new THREE.BoxGeometry(0.35, cy - gy + 1.5, 0.35), '#5f6670', px + uz * sd, gy + (cy - gy + 1.5) / 2, pz - ux * sd)); parts.push(part(new THREE.BoxGeometry(5.6, 0.45, 0.45), '#5f6670', px, cy + 1.3, pz, 0, ry + Math.PI / 2, 0)); }
    parts.push(part(new THREE.BoxGeometry(7.2, 0.3, 11), '#e8e4dc', x - ux * 0.5, cy + 1.9, z - uz * 0.5, 0, ry, 0), part(new THREE.BoxGeometry(7.4, 0.5, 11.2), '#2f6b4f', x - ux * 0.5, cy + 2.2, z - uz * 0.5, 0, ry, 0));
    parts.push(part(new THREE.CylinderGeometry(1.9, 1.9, 0.3, 28), '#3a3f47', x - ux * 4.6, cy + 0.9, z - uz * 4.6), part(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 10), '#3a3f47', x - ux * 4.6, cy + 1.4, z - uz * 4.6));
    parts.push(part(new THREE.BoxGeometry(3.2, 0.3, 8), '#b9b3a8', x + uz * 3.8, cy - 3.55, z - ux * 3.8, 0, ry, 0));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshLambertMaterial({ map: signTex('케이블카 타는 곳', sgn > 0 ? '남산 정상 · N서울타워' : '회현 · 명동 방면'), emissive: '#ffffff', emissiveIntensity: 0.15, side: THREE.DoubleSide }));
    sg.material.emissiveMap = sg.material.map; sg.position.set(x - ux * 0.5 + uz * 3.75, cy + 2.95, z - uz * 0.5 - ux * 3.75); sg.rotation.y = ry + Math.PI / 2; g.add(sg); A.addLit((lit) => { sg.material.emissiveIntensity = 0.15 + lit * 0.9; });
  }
  if (parts.length) g.add(new THREE.Mesh(merge(parts), vcMat()));
  return { group: g, dispose() { g.traverse((o) => o.geometry?.dispose?.()); } };
}
function cableStart(A) {
  const hg = A.hg, C = hg.cableRef; if (!C) { hg.onToast?.('케이블카를 불러오는 중이에요'); return null; }
  const fromLow = Math.hypot(hg.px - C.end.x, hg.pz - C.end.z) < Math.hypot(hg.px - C.start.x, hg.pz - C.start.z), cab = C.cabins[0].cab, dir = new THREE.Vector3(C.start.x - C.end.x, 0, C.start.z - C.end.z).normalize();
  const T0 = 3.5, T1 = 52, T2 = 3; let yaw0 = null;
  return {
    title: fromLow ? '남산 케이블카 · 올라가는 길' : '남산 케이블카 · 내려가는 길', lock: true,
    status() { const t = this.t; if (t < T0) return '🔔 문이 닫혀요… 손잡이를 잡아요'; if (t < T0 + T1) { const k = (t - T0) / T1, p = fromLow ? k : 1 - k; return `${Math.round(p * 100)}% · 땅에서 ${Math.max(0, Math.round(cab.position.y - 3.4 - A.H(cab.position.x, cab.position.z)))}m · 마우스로 둘러보기`; } return '🔔 도착했어요! 문이 열려요'; },
    tick() {
      const t = this.t, k = clamp((t - T0) / T1, 0, 1), e2 = k * k * (3 - 2 * k), p = fromLow ? e2 : 1 - e2; C.hold = 1 - p;
      const q = C.at(C.hold, -1.6); cab.position.copy(q);
      hg.px = q.x; hg.pz = q.z; hg.y = q.y - 3.22 - hg.terrAt(q.x, q.z); hg.vy = 0; hg.v = 0; hg.flying = false; hg.face = Math.atan2(fromLow ? dir.x : -dir.x, fromLow ? dir.z : -dir.z) + Math.PI / 2;
      if (yaw0 == null) { yaw0 = hg.face + Math.PI * 0.75; hg.camYaw = yaw0; hg.camPitch = 0.15; }
      if (t > T0 + T1 + T2) A.finish(this);
    },
    floor(x, z) { return Math.hypot(x - cab.position.x, z - cab.position.z) < 3 ? cab.position.y - 3.22 - hg.terrAt(x, z) : -1; },
    cam(camera, dt) { const c = cab.position, d = 15, pt = clamp(hg.camPitch ?? 0.15, -0.3, 1.0), yaw = hg.camYaw; const tx = c.x - Math.sin(yaw) * Math.cos(pt) * d, ty = c.y - 1.6 + Math.sin(pt) * d + 2, tz = c.z - Math.cos(yaw) * Math.cos(pt) * d, want = new THREE.Vector3(tx, Math.max(ty, A.H(tx, tz) + 6), tz); if (this.t < 0.1) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-dt * 6)); camera.lookAt(c.x, c.y - 2.2, c.z); },
    end(quit) { C.hold = null; C.ph = fromLow ? 0.5 : 0; const up = fromLow !== !!quit, ex = up ? C.start : C.end, s = up ? 1 : -1, x = ex.x + dir.x * 9 * s, z = ex.z + dir.z * 9 * s; hg.placeAt(x, z, Math.atan2(dir.x * s, dir.z * s)); },
    where() { return '케이블카 안'; },
  };
}
registerAttraction({
  id: 'cable', name: '남산 케이블카', seal: '케이블카', icon: '🚡', x: CABLE_LOW[0], z: CABLE_LOW[1], pts: [CABLE_LOW, CABLE_TOP], r: 24, buildR: 1600,
  go: [CABLE_LOW[0] - 14, CABLE_LOW[1] - 8, 0.6], intro: '회현 쪽 정류장 ↔ 남산 정상, 줄에 매달린 객차로 오르내려요',
  build: buildCable, start: cableStart,
});

// ============================================================
// 사랑의 자물쇠: N서울타워 아래 울타리에 색 · 글씨를 골라 내 자물쇠를 건다 (이 기기에 기억 · 다시 오면 그대로)
// ============================================================
const LOCK_KEY = 'dreamrunner.hangang.locks', LOCK_COL = ['#ff4d6d', '#ffd23f', '#4fc3ff', '#7be07b', '#ff9ec0', '#b57bff', '#ff8a3d', '#f4f1e8'];
const locksSaved = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || '[]') || []; } catch { return []; } };
function lockMesh(c, text) {
  const g = new THREE.Group(), m = new THREE.MeshPhongMaterial({ color: c, shininess: 80, specular: '#ffffff' }), steel = new THREE.MeshPhongMaterial({ color: '#d9dde2', shininess: 120 });
  // 하트 몸통 · 고리
  const sh = new THREE.Shape(); sh.moveTo(0, -0.11); sh.bezierCurveTo(0.02, -0.07, 0.11, -0.04, 0.11, 0.02); sh.bezierCurveTo(0.11, 0.07, 0.06, 0.09, 0, 0.05); sh.bezierCurveTo(-0.06, 0.09, -0.11, 0.07, -0.11, 0.02); sh.bezierCurveTo(-0.11, -0.04, -0.02, -0.07, 0, -0.11);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), m); body.position.z = -0.02; g.add(body);
  const sk = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 16, Math.PI), steel); sk.position.y = 0.06; g.add(sk);
  if (text) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.font = 'bold 30px "Jua", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text.slice(0, 8), 64, 34); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.085), new THREE.MeshBasicMaterial({ map: t, transparent: true })); lab.position.set(0, 0.0, 0.03); g.add(lab); }
  return g;
}
function lockFence(hg) { return hg.lockFence || null; }
function buildLocks(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g);
  // 울타리(남산 칸)가 아직 안 만들어졌으면 만들어진 뒤에 건다
  const B = { group: g, shown: false, tick() { if (!this.shown && lockFence(hg)) this.show(); }, show() { const F = lockFence(hg); while (g.children.length) g.remove(g.children[0]); if (!F) return; this.shown = true; for (const L of locksSaved()) { const x = F.cx + Math.cos(L.a) * (F.r - 0.05), z = F.cz + Math.sin(L.a) * (F.r - 0.05), m = lockMesh(L.c, L.t); m.position.set(x, A.H(x, z) + L.y, z); m.rotation.y = -Math.PI / 2 - L.a; m.scale.setScalar(0.9); g.add(m); } }, dispose() { g.traverse((o) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); }); } };
  B.show(); return B;
}
function lockStart(A) {
  const hg = A.hg, F = lockFence(hg), B = A.built.get('lock'); if (!F || !B) return null;
  let a = Math.atan2(hg.pz - F.cz, hg.px - F.cx); if (a < F.a0) a += Math.PI * 2; a = clamp(a, F.a0 + 0.02, F.a1 - 0.02);
  // 건물에 막힌 곳이면 가장 가까운 난간으로
  if (F.ok?.length && !F.ok.some(([p, q]) => a >= p && a <= q)) { let best = a, bd = Infinity; for (const [p, q] of F.ok) { const m = (p + q) / 2; if (Math.abs(m - a) < bd) { bd = Math.abs(m - a); best = m; } } a = best; }
  // 울타리 앞에 서서 바깥(서울 쪽)을 본다
  const sx = F.cx + Math.cos(a) * (F.r - 1.1), sz = F.cz + Math.sin(a) * (F.r - 1.1); hg.placeAt(sx, sz, Math.atan2(Math.cos(a), Math.sin(a))); hg.camYaw = hg.face + 0.5; hg.camPitch = 0.12;
  const ui = document.createElement('div'); ui.id = 'at-lock'; ui.style.cssText = 'position:absolute;left:50%;bottom:120px;transform:translateX(-50%);padding:12px 14px;border-radius:18px;background:rgba(14,20,36,.84);backdrop-filter:blur(8px);color:#fff;font-family:Jua,sans-serif;z-index:7;text-align:center;max-width:calc(100vw - 32px)';
  ui.innerHTML = `<div style="font-size:16px;margin-bottom:8px">💝 자물쇠 색을 고르고, 새길 글씨를 적어요</div><div class="cs" style="display:flex;gap:8px;justify-content:center;margin-bottom:10px">${LOCK_COL.map((c, i) => `<button data-i="${i}" style="width:30px;height:30px;border-radius:50%;border:3px solid ${i ? 'transparent' : '#fff'};background:${c};cursor:pointer"></button>`).join('')}</div><input maxlength="8" placeholder="이름 · 날짜 (8자)" style="font:16px system-ui;padding:8px 10px;border-radius:10px;border:0;width:180px;text-align:center"> <button class="go" style="border:0;border-radius:12px;padding:9px 14px;font-family:Jua,sans-serif;font-size:15px;background:linear-gradient(180deg,#ff8fa8,#ff4d6d);color:#fff;cursor:pointer">🔒 걸기</button>`;
  document.getElementById('hg-hud').appendChild(ui); if (document.pointerLockElement) document.exitPointerLock?.();
  let ci = 0, hung = null; for (const b of ui.querySelectorAll('.cs button')) b.onclick = () => { ci = +b.dataset.i; for (const o of ui.querySelectorAll('.cs button')) o.style.borderColor = 'transparent'; b.style.borderColor = '#fff'; };
  const E = {
    title: '사랑의 자물쇠', lock: true,
    status() { return hung != null ? '찰칵! 울타리에 자물쇠를 걸었어요 · 다시 오면 그대로 있어요' : '울타리 앞 · 색과 글씨를 골라 걸어요'; },
    hang() { if (hung != null) return; const L = locksSaved(), y = (F.rails || [0.8])[Math.floor(Math.random() * (F.rails || [0.8]).length)] - 0.02; this.hy = y; a += (Math.random() - 0.5) * 0.012; L.push({ a, y, c: LOCK_COL[ci], t: (ui.querySelector('input')?.value || '').trim().slice(0, 8), at: Date.now() }); while (L.length > 24) L.shift(); try { localStorage.setItem(LOCK_KEY, JSON.stringify(L)); } catch { /* 무시 */ } B.show(); hung = this.t; ui.remove(); A.drum(0.5, 600, 0.08); setTimeout(() => A.drum(0.4, 900, 0.06), 120); },
    tick() { if (hung != null && this.t - hung > 3.4) A.finish(this); },
    cam(camera) { if (hung == null) return; const x2 = F.cx + Math.cos(a) * F.r, z2 = F.cz + Math.sin(a) * F.r, h = A.H(x2, z2), x = F.cx + Math.cos(a) * (F.r - 0.62) - Math.sin(a) * 0.42, z = F.cz + Math.sin(a) * (F.r - 0.62) + Math.cos(a) * 0.42; camera.position.set(x, h + this.hy + 0.12, z); camera.lookAt(x2, h + this.hy - 0.03, z2); },
    end() { ui.remove(); },
  };
  ui.querySelector('.go').onclick = () => E.hang(); E.act = () => E.hang(); E.actLabel = () => (hung != null ? '' : '🔒 걸기');
  setTimeout(() => ui.querySelector('input')?.focus(), 50);
  return E;
}
{ const D0 = [725, -2343]; registerAttraction({
  id: 'lock', name: '사랑의 자물쇠', seal: '자물쇠', icon: '💝', x: D0[0] + Math.cos(3.6) * 34, z: D0[1] + Math.sin(3.6) * 34, r: 9, buildR: 900, go: [D0[0] + Math.cos(3.6) * 30, D0[1] + Math.sin(3.6) * 30, Math.atan2(Math.cos(3.6), Math.sin(3.6))],
  pts: Array.from({ length: 16 }, (_, i) => { const a = 2.2 + (i / 15) * Math.PI * 2 * 0.62; return [D0[0] + Math.cos(a) * 33, D0[1] + Math.sin(a) * 33]; }),
  intro: 'N서울타워 아래 울타리, 색과 글씨를 골라 내 자물쇠를 걸어요', verb: '자물쇠 걸기',
  build: buildLocks, start: lockStart,
}); }
