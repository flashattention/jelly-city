// 소리: 귀엽고 통통 튀는 배경음악 + 효과음(무기·차·문·경찰·동물·비명). 파일 없이 Web Audio로 합성
import * as THREE from 'three';
import { settings, saveSettings } from './settings.js';

let ctx = null, musicBus = null, sfxBus = null, noiseBuf = null;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  // 탭을 떠나면 멈췄다가 돌아오면 이어서
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return ctx;
}

export function applyVolumes() {
  if (!ctx) return;
  musicBus.gain.value = settings.music && !ducked ? 0.9 * settings.musicVol : 0;
  sfxBus.gain.value = settings.sfx ? settings.sfxVol : 0;
  if (settings.music) startMusic();
}

// 브라우저는 사용자가 한 번 누르거나 키를 쳐야 소리를 낼 수 있게 해 준다
export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state !== 'running') ctx.resume();
  if (settings.music) startMusic();
}

// 이모트 노래(유튜브)가 나오는 동안 배경음악을 잠시 끈다
let ducked = false;
export function duckMusic(on) { ducked = !!on; applyVolumes(); }
export function setMusic(on) { settings.music = !!on; saveSettings(); ensure(); applyVolumes(); }

// ---------------- 배경음악: C장조 132bpm, I–V–vi–IV, 8분음표 스타카토 ----------------
const BPM = 132, STEP = 60 / BPM / 2; // 8분음표
const _ = null;
const MELODY = [
  [76, 79, 84, 79, 76, _, 74, 76], [74, 79, 83, 79, 74, _, 71, 74],
  [72, 76, 81, 76, 72, _, 71, 72], [69, 72, 77, 81, 79, _, _, _],
  [79, 79, 81, 79, 76, _, 72, _], [74, 74, 76, 74, 71, _, 67, _],
  [69, 72, 77, 72, 74, 77, 83, 79], [84, _, 79, _, 72, _, _, _],
].flat();
// 마디별 화음 [근음, 단조?] (7마디는 반 마디씩 F → G)
const CHORDS = [[48], [43], [45, 1], [41], [48], [43], [41], [48]];
let playing = false, step = 0, nextT = 0, timer = null;

function startMusic() {
  if (playing || !ctx) return;
  playing = true; step = 0; nextT = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}
function schedule() {
  if (!settings.music) { clearInterval(timer); playing = false; return; }
  if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05; // 멈췄다 돌아오면 박자를 다시 맞춘다
  while (nextT < ctx.currentTime + 0.15) { playStep(step, nextT); step = (step + 1) % MELODY.length; nextT += STEP; }
}
function playStep(i, t) {
  const bar = (i / 8) | 0, s = i % 8;
  let [root, minor] = CHORDS[bar];
  if (bar === 6 && s >= 4) { root = 43; minor = 0; }
  // 베이스: 근음 ↔ 옥타브 위를 오가며 통통
  tone(midi(root - 12 + (s % 2 ? 12 : 0)), t, STEP * 0.7, 'triangle', 0.32);
  // 화음: 엇박에 짧게 '짠'
  if (s % 2) for (const k of [0, minor ? 3 : 4, 7]) tone(midi(root + 12 + k), t, STEP * 0.35, 'square', 0.025);
  // 멜로디: 살짝 아래에서 미끄러져 올라가는 '뿅' + 한 옥타브 위 반짝이
  const n = MELODY[i];
  if (n) { tone(midi(n), t, STEP * 0.55, 'square', 0.06, 0.94); tone(midi(n + 12), t, STEP * 0.4, 'triangle', 0.025); }
  // 드럼: 킥(정박) · 스네어(2·4박) · 하이햇(엇박)
  if (s === 0 || s === 4) kick(t);
  if (s === 2 || s === 6) noise(t, 0.09, 'bandpass', 1800, 0.12);
  if (s % 2) noise(t, 0.03, 'highpass', 7000, 0.05);
}
function tone(f, t, dur, type, vol, slide = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f * slide, t);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t); o.stop(t + dur + 0.02);
}
function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.16);
}
function noise(t, dur, ftype, freq, vol) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; f.type = ftype; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(musicBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.01);
}

// ---------------- 비명: 톱니파 성대음 → '아' 모음 공명(포먼트) 필터 ----------------
// seed(0~1)로 목소리 높이·길이가 달라진다. vol 0~1, pan -1(왼쪽)~1(오른쪽)
export function scream(vol = 1, pan = 0, seed = Math.random()) {
  if (!ctx || ctx.state !== 'running' || vol <= 0.01 || !settings.sfx) return;
  const t = ctx.currentTime, dur = 0.75 + seed * 0.5, base = 260 + seed * 260;
  const out = ctx.createGain();
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p).connect(sfxBus); } else out.connect(sfxBus);
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.9 * vol, t + 0.04);
  out.gain.setValueAtTime(0.9 * vol, t + dur * 0.6);
  out.gain.exponentialRampToValueAtTime(0.001, t + dur);
  // 성대: 음이 확 치솟았다가 떨어지며 떨린다
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(base * 1.45, t + dur * 0.6);
  o.frequency.exponentialRampToValueAtTime(base * 0.8, t + dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 7 + seed * 3; lg.gain.value = base * 0.05;
  lfo.connect(lg).connect(o.frequency);
  // 거친 목소리 (살짝 찌그러뜨림)
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
  ws.curve = curve;
  o.connect(ws);
  // 숨소리
  const n = ctx.createBufferSource(), ng = ctx.createGain();
  n.buffer = noiseBuf; ng.gain.value = 0.12;
  n.connect(ng);
  // '아' 포먼트 (목소리가 높을수록 조금 위로)
  const shift = 1 + seed * 0.15;
  for (const [f, q, gain] of [[850, 5, 1], [1250, 7, 0.55], [2800, 9, 0.25]]) {
    const bp = ctx.createBiquadFilter(), bg = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f * shift; bp.Q.value = q; bg.gain.value = gain;
    ws.connect(bp); ng.connect(bp); bp.connect(bg).connect(out);
  }
  for (const s of [o, lfo, n]) { s.start(t); s.stop(t + dur + 0.05); }
}

// ================================================================
// 효과음
// ================================================================
// 듣는 위치(카메라). 소리 위치가 있으면 거리로 작게, 화면 기준 좌우로 나눈다
let listener = null;
export function setListener(camera) { listener = camera; }
const _v = new THREE.Vector3(), _r = new THREE.Vector3();
function spatial(pos, maxDist) {
  if (!pos || !listener) return { vol: 1, pan: 0 };
  _v.set(pos.x ?? pos[0], pos.y ?? pos[1], pos.z ?? pos[2]).sub(listener.position);
  const d = _v.length();
  const vol = Math.max(0, 1 - d / maxDist) ** 1.6;
  _r.set(1, 0, 0).applyQuaternion(listener.quaternion);
  return { vol, pan: d > 1 ? (_v.dot(_r) / d) * 0.8 : 0 };
}
const ready = () => ctx && ctx.state === 'running' && settings.sfx;
// 출력 노드: 크기 + 좌우
function outNode(vol, pan) {
  const g = ctx.createGain(); g.gain.value = vol;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(sfxBus); } else g.connect(sfxBus);
  return g;
}
function env(g, t, a, peak, dur, curve = 'exp') {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur); else g.gain.linearRampToValueAtTime(0, t + dur);
}
// 잡음 한 덩어리 (필터 + 주파수 스윕)
function nz(out, t, dur, { type = 'bandpass', f = 1000, f2 = null, q = 1, vol = 1, a = 0.003, curve = 'exp' } = {}) {
  const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true;
  fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, a, vol, dur, curve);
  src.connect(fl).connect(g).connect(out);
  src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.05);
  return fl;
}
// 발진기 한 음 (주파수 곡선 [[시간, 주파수], ...])
function osc(out, t, dur, { type = 'sine', f = 440, curve = null, vol = 1, a = 0.005, vib = 0, vibF = 6, filter = null, shape = 'exp' } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (curve) for (const [dt, fr] of curve) o.frequency.exponentialRampToValueAtTime(Math.max(1, fr), t + dt);
  let last = o;
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibF; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  if (filter) { const fl = ctx.createBiquadFilter(); Object.assign(fl, { type: filter.type || 'lowpass' }); fl.frequency.value = filter.f; fl.Q.value = filter.q || 1; last.connect(fl); last = fl; }
  env(g, t, a, vol, dur, shape);
  last.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}
// 짐승 목소리: 성대(톱니) → 찌그러뜨림 → 모음 공명, 으르렁 떨림(AM)
function voice(out, t, dur, { f, curve, vol = 1, formants = [[600, 4, 1]], am = 0, amDepth = 0.6, breath = 0.15, drive = 2, vib = 0, vibF = 6, type = 'sawtooth', a = 0.04 }) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t);
  for (const [dt, fr] of curve || []) o.frequency.exponentialRampToValueAtTime(Math.max(1, fr), t + dt);
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibF; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  const ws = ctx.createWaveShaper(), c = new Float32Array(256);
  for (let i = 0; i < 256; i++) c[i] = Math.tanh((i / 128 - 1) * drive);
  ws.curve = c; o.connect(ws);
  const mix = ctx.createGain(); mix.gain.value = 1;
  if (breath) { const n = ctx.createBufferSource(), ng = ctx.createGain(); n.buffer = noiseBuf; n.loop = true; ng.gain.value = breath; n.connect(ng).connect(mix); n.start(t, Math.random()); n.stop(t + dur + 0.05); }
  ws.connect(mix);
  const g = ctx.createGain();
  env(g, t, a, vol, dur, 'lin');
  // 으르렁: 크기를 빠르게 떨게
  if (am) { const l = ctx.createOscillator(), lg = ctx.createGain(), dc = ctx.createGain(); l.frequency.value = am; lg.gain.value = amDepth; dc.gain.value = 1 - amDepth; l.connect(lg).connect(dc.gain); mix.connect(dc); dc.connect(g); l.start(t); l.stop(t + dur + 0.05); }
  else mix.connect(g);
  for (const [ff, q, gain] of formants) { const bp = ctx.createBiquadFilter(), bg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; bg.gain.value = gain; g.connect(bp); bp.connect(bg).connect(out); }
  o.start(t); o.stop(t + dur + 0.05);
}
// 쇠붙이 울림 (비조화 배음)
function metal(out, t, dur, base, vol = 1) {
  for (const [k, v] of [[1, 1], [2.76, 0.6], [5.4, 0.4], [8.93, 0.25]]) osc(out, t, dur * (1.2 - k * 0.08), { f: base * k, vol: vol * v * 0.5, a: 0.001 });
}

// ---------------- 무기 ----------------
const GUN = {
  pistol: { f: 1500, len: 0.13, thump: 140, vol: 0.7 }, blaster: 'pew',
  revolver: { f: 900, len: 0.28, thump: 100, vol: 0.9 }, deagle: { f: 800, len: 0.3, thump: 90, vol: 1 },
  uzi: { f: 2600, len: 0.06, thump: 170, vol: 0.55 }, mp5: { f: 2200, len: 0.07, thump: 160, vol: 0.55 },
  rifle: { f: 1300, len: 0.11, thump: 110, vol: 0.75, crack: 0.4 }, ak47: { f: 1100, len: 0.13, thump: 100, vol: 0.8, crack: 0.4 },
  m4: { f: 1400, len: 0.1, thump: 120, vol: 0.75, crack: 0.4 }, scar: { f: 1000, len: 0.14, thump: 95, vol: 0.85, crack: 0.5 },
  m249: { f: 1200, len: 0.1, thump: 100, vol: 0.75, crack: 0.3 }, minigun: { f: 1600, len: 0.06, thump: 130, vol: 0.5 },
  shotgun: { f: 700, len: 0.4, thump: 70, vol: 1, low: 1 }, double_barrel: { f: 650, len: 0.45, thump: 65, vol: 1.05, low: 1 },
  sniper: { f: 900, len: 0.55, thump: 80, vol: 1, crack: 1, tail: 1 }, hunting_rifle: { f: 1000, len: 0.45, thump: 90, vol: 0.9, crack: 0.8, tail: 1 },
  barrett: { f: 600, len: 0.8, thump: 55, vol: 1.2, crack: 1, tail: 1, low: 1 },
  plasma_smg: 'pew', blaster_rifle: 'pew',
};
function gunshot(out, t, id) {
  const c = GUN[id] || GUN.rifle;
  if (c === 'pew') {
    // 광선총: 뾰옹
    const hi = id === 'blaster_rifle' ? 1300 : id === 'plasma_smg' ? 2200 : 1700;
    osc(out, t, 0.18, { type: 'square', f: hi, curve: [[0.16, hi * 0.18]], vol: 0.25, filter: { f: 3500 } });
    osc(out, t, 0.14, { type: 'sawtooth', f: hi * 1.5, curve: [[0.12, hi * 0.3]], vol: 0.12 });
    return;
  }
  nz(out, t, c.len, { f: c.f, f2: c.f * 0.4, q: 0.8, vol: c.vol });
  osc(out, t, Math.min(0.25, c.len), { f: c.thump * 2, curve: [[0.08, c.thump * 0.6]], vol: c.vol * 0.9, a: 0.001 });
  if (c.crack) nz(out, t, 0.04, { type: 'highpass', f: 3500, vol: c.vol * c.crack * 0.8 });
  if (c.low) nz(out, t, c.len * 1.2, { type: 'lowpass', f: 500, f2: 120, vol: c.vol * 0.8 });
  if (c.tail) nz(out, t + 0.05, c.len * 1.6, { type: 'lowpass', f: 900, f2: 150, vol: c.vol * 0.35, a: 0.05 });
}
function whoosh(out, t, dur, f1, f2, vol) { nz(out, t, dur, { f: f1, f2, q: 2.5, vol: vol * 3, a: dur * 0.35, curve: 'lin' }); } // 좁은 대역 잡음이라 3배
function swing(out, t, id) {
  if (id?.startsWith('saber_')) {
    // 광선검: 위이잉
    osc(out, t, 0.45, { type: 'sawtooth', f: 95, curve: [[0.15, 150], [0.45, 80]], vol: 0.35, filter: { f: 900, q: 3 }, a: 0.03 });
    osc(out, t, 0.45, { type: 'sawtooth', f: 98, curve: [[0.15, 156], [0.45, 84]], vol: 0.25, filter: { f: 1400 }, a: 0.03 });
    whoosh(out, t, 0.35, 500, 2000, 0.25);
    return;
  }
  if (id === 'fist') { whoosh(out, t, 0.14, 300, 900, 0.35); return; }
  const heavy = ['serpent_spear', 'halberd', 'dragon_glaive'].includes(id);
  whoosh(out, t, heavy ? 0.32 : 0.22, heavy ? 250 : 450, heavy ? 1200 : 2200, heavy ? 0.6 : 0.5);
  if (id !== 'wood_sword') osc(out, t + 0.02, 0.4, { f: 3200 + Math.random() * 600, vol: 0.06, a: 0.002 }); // 쇳소리 '샤앙'
}
const WAND = { wand_fire: 'fire', wand_ice: 'ice', wand_thunder: 'thunder', wand_wind: 'wind', wand_poison: 'poison', wand_holy: 'holy', wand_dark: 'dark' };
function magic(out, t, id) {
  const el = WAND[id] || 'holy';
  if (el === 'fire') { nz(out, t, 0.5, { type: 'lowpass', f: 1800, f2: 400, vol: 0.6, a: 0.05 }); for (let i = 0; i < 6; i++) nz(out, t + Math.random() * 0.4, 0.02, { type: 'highpass', f: 3000, vol: 0.3 }); }
  else if (el === 'ice') for (const [i, f] of [1568, 2093, 2637, 3136].entries()) osc(out, t + i * 0.04, 0.5, { type: 'triangle', f, vol: 0.12, a: 0.002 });
  else if (el === 'thunder') { for (let i = 0; i < 5; i++) nz(out, t + i * 0.035, 0.05, { type: 'highpass', f: 1500, vol: 0.7 }); nz(out, t + 0.1, 0.8, { type: 'lowpass', f: 400, f2: 60, vol: 0.7 }); }
  else if (el === 'wind') whoosh(out, t, 0.6, 300, 1500, 0.5);
  else if (el === 'poison') for (let i = 0; i < 5; i++) osc(out, t + i * 0.07, 0.08, { type: 'sine', f: 300 + Math.random() * 300, curve: [[0.07, 900]], vol: 0.2 });
  else if (el === 'dark') { osc(out, t, 0.7, { type: 'sawtooth', f: 110, curve: [[0.7, 55]], vol: 0.25, filter: { f: 500 } }); whoosh(out, t, 0.6, 200, 600, 0.3); }
  else for (const [i, f] of [1047, 1319, 1568, 2093].entries()) osc(out, t + i * 0.05, 0.7, { type: 'sine', f, vol: 0.12, a: 0.002 });
}
function explosion(out, t, big) {
  nz(out, t, big ? 1.6 : 0.9, { type: 'lowpass', f: 1600, f2: 60, vol: big ? 1.1 : 0.8, q: 0.7 });
  osc(out, t, big ? 0.7 : 0.4, { f: 90, curve: [[0.5, 30]], vol: big ? 1 : 0.7, a: 0.002 });
  nz(out, t, 0.08, { type: 'highpass', f: 2000, vol: 0.5 });
}

// ---------------- 차 · 거리 ----------------
function horn(out, t, big) {
  // 빵빵: 두 번
  const [f1, f2] = big ? [220, 277] : [392, 494];
  for (const st of [0, 0.22]) for (const f of [f1, f2]) osc(out, t + st, 0.18, { type: 'square', f, vol: 0.18, a: 0.01, filter: { f: 2200 }, shape: 'lin' });
}
function crash(out, t, hard = 1) {
  osc(out, t, 0.3, { f: 120, curve: [[0.2, 45]], vol: 0.9 * hard, a: 0.001 });
  nz(out, t, 0.35, { type: 'lowpass', f: 2500, f2: 300, vol: 0.8 * hard });
  metal(out, t + 0.01, 0.6, 420 + Math.random() * 120, 0.5 * hard);
  for (let i = 0; i < 4; i++) nz(out, t + 0.05 + Math.random() * 0.25, 0.04, { type: 'highpass', f: 4000, vol: 0.25 * hard }); // 유리 조각
}
function treeBreak(out, t) {
  for (let i = 0; i < 6; i++) nz(out, t + i * 0.045 + Math.random() * 0.02, 0.05, { f: 1200 + Math.random() * 800, q: 3, vol: 0.6 }); // 우지끈
  osc(out, t + 0.1, 0.5, { type: 'sawtooth', f: 180, curve: [[0.5, 90]], vol: 0.12, filter: { f: 700, q: 4 } }); // 삐걱
  osc(out, t + 0.7, 0.35, { f: 90, curve: [[0.3, 40]], vol: 0.8, a: 0.002 }); // 쿵
  nz(out, t + 0.7, 0.4, { type: 'lowpass', f: 800, f2: 200, vol: 0.5 });
}
function lampBreak(out, t) {
  metal(out, t, 1.2, 310, 0.9);
  nz(out, t, 0.12, { type: 'highpass', f: 3500, vol: 0.5 });
  for (let i = 0; i < 6; i++) nz(out, t + 0.05 + Math.random() * 0.3, 0.03, { type: 'highpass', f: 5000, vol: 0.3 }); // 전구 깨짐
  osc(out, t + 0.6, 0.3, { f: 110, curve: [[0.25, 50]], vol: 0.6, a: 0.002 });
  metal(out, t + 0.6, 0.6, 520, 0.4);
}
function door(out, t, kind) {
  if (kind === 'cell') { metal(out, t, 0.8, 140, 0.8); nz(out, t, 0.6, { f: 900, f2: 300, q: 4, vol: 0.25, a: 0.1, curve: 'lin' }); metal(out, t + 0.65, 0.9, 120, 1); return; }
  nz(out, t, 0.03, { type: 'highpass', f: 2500, vol: 0.5 }); // 딸깍
  osc(out, t + 0.05, 0.45, { type: 'sawtooth', f: 260, curve: [[0.2, 420], [0.45, 300]], vol: 0.07, filter: { f: 1200, q: 6 }, a: 0.05, shape: 'lin' }); // 끼익
  osc(out, t + 0.5, 0.15, { f: 110, curve: [[0.12, 60]], vol: 0.35, a: 0.002 }); // 탁
}
function cuffs(out, t) {
  // 철컥철컥 + 호루라기
  for (let i = 0; i < 7; i++) nz(out, t + i * 0.035, 0.02, { f: 3500, q: 4, vol: 0.5 });
  metal(out, t + 0.28, 0.25, 1800, 0.4);
  osc(out, t + 0.45, 0.7, { f: 2900, vol: 0.18, vib: 0.04, vibF: 28, shape: 'lin' });
}

// ---------------- 동물 ----------------
// type: call(평소) · attack(공격) · hurt(아파) · die(쓰러짐)
const BEAST = {
  tiger: { f: 120, dur: 1.4, curve: (f) => [[0.25, f * 1.5], [1.4, f * 0.6]], formants: [[450, 3, 1], [1100, 5, 0.4]], am: 28, drive: 4, vol: 1 },
  jaguar: { f: 160, dur: 0.9, curve: (f) => [[0.15, f * 1.4], [0.9, f * 0.7]], formants: [[550, 3, 1], [1300, 5, 0.4]], am: 32, drive: 4, vol: 0.9 },
  bear: { f: 75, dur: 1.2, curve: (f) => [[0.3, f * 1.3], [1.2, f * 0.7]], formants: [[350, 3, 1], [900, 5, 0.4]], am: 22, drive: 5, vol: 1 },
  wolf: { f: 420, dur: 1.8, curve: (f) => [[0.5, f * 1.6], [1.4, f * 1.5], [1.8, f * 1.1]], formants: [[800, 4, 1]], type: 'triangle', breath: 0.03, drive: 1.2, vib: 0.02, vol: 1.5, a: 0.2 },
  boar: { f: 180, dur: 0.25, curve: (f) => [[0.25, f * 0.8]], formants: [[700, 5, 1], [1500, 6, 0.5]], am: 40, drive: 3, vol: 0.7, repeat: 3 },
  deer: { f: 850, dur: 0.4, curve: (f) => [[0.1, f * 1.2], [0.4, f * 0.8]], formants: [[1600, 5, 1]], type: 'triangle', drive: 1.5, vol: 1.3, breath: 0.05 },
  rabbit: { f: 1800, dur: 0.12, curve: (f) => [[0.12, f * 1.3]], formants: [[2500, 3, 1]], type: 'triangle', drive: 1, vol: 0.8, breath: 0, repeat: 2 },
  croc: 'hiss-low', anaconda: 'hiss',
  cow: { f: 140, dur: 1.4, curve: (f) => [[0.3, f * 1.15], [1.4, f * 0.85]], formants: [[320, 4, 1], [850, 6, 0.4]], drive: 2, vol: 0.8, a: 0.15 },
  sheep: { f: 320, dur: 0.8, curve: (f) => [[0.8, f * 0.9]], formants: [[800, 4, 1], [1300, 6, 0.5]], vib: 0.06, vibF: 9, drive: 2, vol: 0.6 },
  horse: { f: 600, dur: 1.1, curve: (f) => [[0.2, f * 1.5], [1.1, f * 0.6]], formants: [[900, 4, 1], [1800, 6, 0.4]], vib: 0.12, vibF: 14, drive: 2.5, vol: 0.6 },
  dragon: { f: 55, dur: 2.2, curve: (f) => [[0.4, f * 1.8], [2.2, f * 0.6]], formants: [[300, 2, 1], [700, 3, 0.7], [1500, 4, 0.3]], am: 18, drive: 6, vol: 1.3, breath: 0.4 },
  baby_dragon: { f: 140, dur: 1.0, curve: (f) => [[0.2, f * 1.7], [1.0, f * 0.8]], formants: [[600, 3, 1], [1400, 4, 0.5]], am: 30, drive: 4, vol: 0.8, breath: 0.25 },
};
function beast(out, t, kind, type) {
  const b = BEAST[kind];
  if (!b) return;
  if (b === 'hiss' || b === 'hiss-low') {
    const dur = type === 'hurt' ? 0.3 : 0.9;
    nz(out, t, dur, { type: 'highpass', f: 3000, vol: 0.5, a: 0.08, curve: 'lin' });
    if (b === 'hiss-low') osc(out, t, dur, { type: 'sawtooth', f: 50, vol: 0.4, filter: { f: 200 }, a: 0.1 });
    return;
  }
  const k = { call: [1, 1, 0.8], attack: [1, 1.1, 1], hurt: [1.5, 0.35, 0.8], die: [0.85, 1.3, 0.9] }[type] || [1, 1, 1];
  const f = b.f * k[0] * (0.92 + Math.random() * 0.16), dur = b.dur * k[1];
  let curve = b.curve(f).map(([dt, fr]) => [dt * k[1], fr]);
  if (type === 'die') curve = [[dur * 0.2, f * 1.2], [dur, f * 0.45]];
  for (let i = 0; i < (b.repeat || 1); i++) voice(out, t + i * (dur + 0.06), dur, { ...b, f, curve, vol: b.vol * k[2] });
}

// ---------------- 몸 움직임: 발소리 · 점프 · 착지 · 날기 · 수영 ----------------
// 젤리 발소리 '뽀득': 말랑한 저음 블립 + 바닥 재질 소리
function footstep(out, t, surface, run) {
  const f = (run ? 300 : 240) * (0.9 + Math.random() * 0.2);
  osc(out, t, run ? 0.07 : 0.09, { f, curve: [[0.06, f * 0.45]], vol: run ? 0.5 : 0.4, a: 0.002 });
  if (surface === 'road') nz(out, t, 0.025, { type: 'highpass', f: 2500, vol: run ? 0.25 : 0.18 });
  else if (surface === 'grass') nz(out, t, run ? 0.09 : 0.12, { f: 3200, q: 0.8, vol: 0.22, a: 0.01 });
  else if (surface === 'floor') nz(out, t, 0.04, { f: 1100, q: 5, vol: run ? 0.5 : 0.4 });
  else if (surface === 'snow') for (let i = 0; i < 4; i++) nz(out, t + i * 0.018, 0.03, { type: 'lowpass', f: 2200, vol: 0.25 });
  else if (surface === 'water') nz(out, t, 0.16, { f: 1400, f2: 600, q: 1.5, vol: 0.45, a: 0.01 });
}
function jump(out, t, n) {
  const f = n > 1 ? 620 : 420;
  osc(out, t, 0.13, { f, curve: [[0.11, f * 2.1]], vol: 0.35, a: 0.003 }); // 뿅
  if (n > 1) osc(out, t + 0.04, 0.2, { type: 'triangle', f: f * 3, curve: [[0.15, f * 4]], vol: 0.08 }); // 2단 점프는 반짝
}
function landing(out, t, k) {
  const v = Math.min(1, 0.35 + k / 18);
  osc(out, t, 0.18, { f: 190, curve: [[0.15, 65]], vol: v, a: 0.002 }); // 퉁
  nz(out, t, 0.08, { type: 'lowpass', f: 900, vol: v * 0.6 });
  osc(out, t + 0.02, 0.12, { f: 520, curve: [[0.1, 260]], vol: v * 0.2 }); // 말랑 출렁
}
function flap(out, t, k) { nz(out, t, 0.12, { type: 'lowpass', f: 700, f2: 300, vol: 0.25 + 0.3 * k, a: 0.03, curve: 'lin' }); }
function splash(out, t, big) {
  nz(out, t, big ? 0.6 : 0.3, { f: 1600, f2: 500, q: 0.9, vol: big ? 0.9 : 0.5, a: 0.005 });
  for (let i = 0; i < (big ? 8 : 4); i++) osc(out, t + 0.05 + Math.random() * (big ? 0.4 : 0.2), 0.05, { f: 900 + Math.random() * 1400, curve: [[0.04, 1800 + Math.random() * 1500]], vol: 0.08 }); // 물방울
}

// ---------------- 재생 ----------------
// 한 번 울리는 소리. pos 가 없으면 바로 내 귀 앞에서
const RANGE = { step: 25, land: 30, jump: 25, splash: 40, flap: 30, gun: 140, sniper: 260, boom: 260, beast: 90, dragon: 260, horn: 90, crash: 90, prop: 80, door: 30, swing: 40, magic: 60 };
export function sfx(name, pos = null, arg = null, vol = 1) {
  if (!ready()) return;
  const range = name === 'gun' && ['sniper', 'barrett', 'hunting_rifle'].includes(arg) ? RANGE.sniper : name === 'beast' && (arg?.kind || '').includes('dragon') ? RANGE.dragon : RANGE[name] || 80;
  const sp = spatial(pos, range);
  if (sp.vol * vol < 0.01) return;
  const out = outNode(sp.vol * vol, sp.pan), t = ctx.currentTime + 0.005;
  if (name === 'gun') gunshot(out, t, arg);
  else if (name === 'swing') swing(out, t, arg);
  else if (name === 'magic') magic(out, t, arg);
  else if (name === 'boom') explosion(out, t, !!arg);
  else if (name === 'bow') { osc(out, t, 0.25, { type: 'triangle', f: 160, curve: [[0.2, 120]], vol: 0.5, a: 0.001 }); whoosh(out, t, 0.2, 1500, 4000, 0.2); }
  else if (name === 'rocket') { nz(out, t, 1.0, { f: 400, f2: 2500, q: 1, vol: 0.7, a: 0.05 }); osc(out, t, 0.6, { type: 'sawtooth', f: 60, vol: 0.3, filter: { f: 300 } }); }
  else if (name === 'ion') { osc(out, t, 0.6, { type: 'square', f: 200, curve: [[0.5, 1600]], vol: 0.2, filter: { f: 3000 } }); osc(out, t + 0.5, 0.4, { type: 'sawtooth', f: 1200, curve: [[0.35, 150]], vol: 0.3 }); }
  else if (name === 'throw') whoosh(out, t, 0.25, 400, 1200, 0.35);
  else if (name === 'cannon') { gunshot(out, t, 'barrett'); explosion(out, t, false); }
  else if (name === 'breath') { nz(out, t, 0.8, { type: 'lowpass', f: 2200, f2: 500, vol: 0.9, a: 0.04 }); for (let i = 0; i < 8; i++) nz(out, t + Math.random() * 0.7, 0.02, { type: 'highpass', f: 3000, vol: 0.35 }); }
  else if (name === 'horn') horn(out, t, arg === 'big');
  else if (name === 'crash') crash(out, t, arg || 1);
  else if (name === 'tree') treeBreak(out, t);
  else if (name === 'lamp') lampBreak(out, t);
  else if (name === 'door') door(out, t, arg);
  else if (name === 'cuffs') cuffs(out, t);
  else if (name === 'beast') beast(out, t, arg.kind, arg.type);
  else if (name === 'step') footstep(out, t, arg?.surface, arg?.run);
  else if (name === 'jump') jump(out, t, arg || 1);
  else if (name === 'land') landing(out, t, arg || 6);
  else if (name === 'dash') whoosh(out, t, 0.2, 500, 1800, 0.35);
  else if (name === 'takeoff') { for (let i = 0; i < 3; i++) flap(out, t + i * 0.09, 1); whoosh(out, t, 0.4, 300, 1100, 0.3); }
  else if (name === 'flap') flap(out, t, arg ?? 0.5);
  else if (name === 'splash') splash(out, t, !!arg);
  else if (name === 'stroke') { nz(out, t, 0.22, { f: 1100, f2: 700, q: 1.2, vol: 0.3, a: 0.04 }); osc(out, t + 0.1, 0.05, { f: 1200, curve: [[0.04, 2200]], vol: 0.06 }); }
  else if (name === 'scope') { nz(out, t, 0.02, { type: 'highpass', f: 3000, vol: 0.4 }); osc(out, t, 0.04, { f: 2400, vol: 0.06, a: 0.001 }); } // 딸깍
  else if (name === 'saberOn') { osc(out, t, 0.6, { type: 'sawtooth', f: 40, curve: [[0.4, 110]], vol: 0.35, filter: { f: 1200, q: 4 } }); nz(out, t, 0.3, { type: 'highpass', f: 2500, vol: 0.2, curve: 'lin' }); }
}

// 계속 울리는 소리: 경찰 사이렌 · 헬기 · 광선검 웅웅. vol 0이면 조용히 끈다
const loops = {};
export function loop(name, vol = 0, pos = null, range = 150) {
  if (!ctx) return;
  const sp = pos ? spatial(pos, range) : { vol: 1, pan: 0 };
  const v = settings.sfx && ctx.state === 'running' ? vol * sp.vol : 0;
  let L = loops[name];
  if (!L) {
    if (v < 0.005) return;
    L = loops[name] = makeLoop(name);
  }
  const t = ctx.currentTime;
  L.g.gain.setTargetAtTime(v, t, 0.15);
  if (L.p) L.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, sp.pan)), t, 0.1);
}
function makeLoop(name) {
  const g = ctx.createGain(); g.gain.value = 0;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) g.connect(p).connect(sfxBus); else g.connect(sfxBus);
  const src = [];
  if (name === 'siren') {
    // 위이잉 위이잉: 높낮이가 천천히 오르내린다
    const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), fl = ctx.createBiquadFilter(), og = ctx.createGain();
    o.type = 'square'; o.frequency.value = 950; l.frequency.value = 0.45; lg.gain.value = 330; fl.type = 'lowpass'; fl.frequency.value = 2500; og.gain.value = 0.18;
    l.connect(lg).connect(o.frequency); o.connect(fl).connect(og).connect(g); src.push(o, l);
  } else if (name === 'heli') {
    const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), am = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    n.buffer = noiseBuf; n.loop = true; fl.type = 'lowpass'; fl.frequency.value = 350; l.frequency.value = 11; lg.gain.value = 0.7; am.gain.value = 0.3;
    l.connect(lg).connect(am.gain); n.connect(fl).connect(am).connect(g); src.push(n, l);
  } else if (name === 'wind') {
    // 날 때 바람: 빠를수록 크게 (크기는 loop 의 vol 로)
    const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), ng = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    n.buffer = noiseBuf; n.loop = true; fl.type = 'bandpass'; fl.frequency.value = 650; fl.Q.value = 0.7; ng.gain.value = 0.5;
    l.frequency.value = 0.3; lg.gain.value = 250; l.connect(lg).connect(fl.frequency);
    n.connect(fl).connect(ng).connect(g); src.push(n, l);
  } else if (name === 'saber') {
    for (const f of [92, 95.5]) { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = 600; og.gain.value = 0.15; o.connect(fl).connect(og).connect(g); src.push(o); }
  }
  for (const s of src) s.start();
  return { g, p, src };
}
