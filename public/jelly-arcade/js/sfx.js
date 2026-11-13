// 젤리 아케이드 소리: 파일 없이 Web Audio 로 직접 만든 말랑한 효과음 + 맵마다 다른 통통 튀는 음악
const MUTE_KEY = 'jellyarcade.mute';
let ctx = null, master = null, sfxBus = null, musicBus = null, noise = null;
export const sound = { muted: (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })() };
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  master = ctx.createDynamicsCompressor(); master.threshold.value = -14; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); musicBus = ctx.createGain(); sfxBus.connect(master); musicBus.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  apply();
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return ctx;
}
function apply() { if (!ctx) return; sfxBus.gain.value = sound.muted ? 0 : 0.75; musicBus.gain.value = sound.muted ? 0 : 0.28; }
export function unlock() { if (!ensure()) return; if (ctx.state !== 'running') ctx.resume(); }
export function toggleMute() { sound.muted = !sound.muted; try { localStorage.setItem(MUTE_KEY, sound.muted ? '1' : '0'); } catch { /* 무시 */ } apply(); return sound.muted; }

function tone(bus, t, dur, f, { type = 'sine', vol = 0.2, a = 0.008, f2 = null, lp = null, q = 1 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = o; if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; o.connect(fl); n = fl; }
  n.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(bus, t, dur, { f = 3000, vol = 0.1, type = 'bandpass', f2 = null, q = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
}
// 젤리가 출렁이는 소리: 음이 위아래로 흔들린다
function wobble(t, f, dur, vol, rate = 18, depth = 0.25) {
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = rate; lg.gain.value = f * depth; lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
let lastBoom = 0;
export function sfx(name, arg = 0) {
  if (!ensure() || sound.muted) return;
  const t = ctx.currentTime + 0.005;
  switch (name) {
    case 'place': tone(sfxBus, t, 0.16, 300, { vol: 0.28, f2: 140 }); tone(sfxBus, t + 0.02, 0.12, 900, { type: 'triangle', vol: 0.06, f2: 500 }); break;
    case 'boom': {
      // 같은 순간 연쇄는 한 번만 크게
      if (t - lastBoom < 0.05) return; lastBoom = t;
      tone(sfxBus, t, 0.45, 160, { vol: 0.42, f2: 45 });
      wobble(t + 0.02, 220, 0.5, 0.16, 22, 0.35);
      hiss(sfxBus, t, 0.35, { f: 1400, vol: 0.22, type: 'lowpass', f2: 300 });
      hiss(sfxBus, t + 0.05, 0.4, { f: 5000, vol: 0.05, f2: 1800, q: 2 });
      break;
    }
    case 'break': for (let i = 0; i < 3; i++) hiss(sfxBus, t + i * 0.03, 0.08, { f: 2500 + i * 900, vol: 0.12, q: 3 }); tone(sfxBus, t, 0.12, 700, { type: 'triangle', vol: 0.06, f2: 350 }); break;
    case 'itemPop': for (let i = 0; i < 3; i++) tone(sfxBus, t + i * 0.05, 0.18, midi(84 + i * 5), { vol: 0.06 }); break;
    case 'pick': { const base = [72, 76, 79, 84][arg] || 76; for (let i = 0; i < 4; i++) tone(sfxBus, t + i * 0.055, 0.2, midi(base + [0, 4, 7, 12][i]), { type: 'triangle', vol: 0.11 }); break; }
    case 'trap': wobble(t, 330, 0.9, 0.2, 9, 0.3); tone(sfxBus, t, 0.5, 600, { type: 'triangle', vol: 0.08, f2: 200 }); hiss(sfxBus, t, 0.4, { f: 800, vol: 0.1, type: 'lowpass' }); break;
    case 'free': for (let i = 0; i < 5; i++) tone(sfxBus, t + i * 0.04, 0.16, midi(76 + i * 3), { type: 'triangle', vol: 0.1 }); hiss(sfxBus, t, 0.2, { f: 4000, vol: 0.06 }); break;
    case 'out': tone(sfxBus, t, 0.08, 1200, { type: 'square', vol: 0.06, lp: 3000 }); hiss(sfxBus, t, 0.12, { f: 3000, vol: 0.2, q: 0.6 }); tone(sfxBus, t + 0.06, 0.6, 500, { type: 'triangle', vol: 0.12, f2: 90 }); break;
    case 'warn': tone(sfxBus, t, 0.12, 880, { type: 'square', vol: 0.04, lp: 2000 }); break;
    case 'fall': tone(sfxBus, t, 0.3, 120, { vol: 0.35, f2: 50 }); wobble(t + 0.03, 160, 0.3, 0.1, 14, 0.25); break;
    case 'step': hiss(sfxBus, t, 0.04, { f: 1200 + Math.random() * 600, vol: 0.025, q: 2 }); break;
    case 'beep': tone(sfxBus, t, 0.16, arg ? 1046 : 660, { type: 'square', vol: 0.07, lp: 2600 }); break;
    case 'win': for (let i = 0; i < 8; i++) tone(sfxBus, t + i * 0.09, 0.4, midi(72 + [0, 4, 7, 12, 7, 12, 16, 19][i]), { type: 'triangle', vol: 0.12 }); break;
    case 'lose': for (let i = 0; i < 4; i++) tone(sfxBus, t + i * 0.16, 0.4, midi(67 - i * 3), { type: 'triangle', vol: 0.1 }); break;
    case 'escape': wobble(t, 500, 0.4, 0.12, 30, 0.4); for (let i = 0; i < 4; i++) tone(sfxBus, t + 0.1 + i * 0.05, 0.15, midi(84 + i * 2), { vol: 0.08 }); break;
    case 'deny': tone(sfxBus, t, 0.1, 220, { type: 'square', vol: 0.05, lp: 900 }); break;
    default: break;
  }
}
// 음악: 맵마다 음계 · 빠르기 · 음색. 베이스 + 마림바 같은 통통 소리 + 가벼운 박자
const SONGS = {
  candy: { root: 60, bpm: 132, scale: [0, 2, 4, 7, 9], prog: [0, 5, 3, 4], lead: 'triangle' },
  factory: { root: 57, bpm: 124, scale: [0, 3, 5, 7, 10], prog: [0, 0, 5, 3], lead: 'square' },
  ice: { root: 64, bpm: 112, scale: [0, 2, 4, 6, 7, 11], prog: [0, 4, 5, 3], lead: 'sine' },
  title: { root: 62, bpm: 104, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 3], lead: 'triangle' },
};
const CHORD = [0, 2, 4, 5, 7, 9, 11];
let timer = null, song = null, stepN = 0, nextT = 0, fast = 1;
export function setMusic(id) {
  if (!ensure()) return; song = SONGS[id] || SONGS.title; stepN = 0; nextT = ctx.currentTime + 0.1; fast = 1;
  if (!timer) timer = setInterval(schedule, 60);
}
export function hurry(on) { fast = on ? 1.18 : 1; }
export function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }
function schedule() {
  if (!ctx || !song) return;
  const spb = 60 / (song.bpm * fast) / 2; // 8분음표
  while (nextT < ctx.currentTime + 0.25) {
    const s = song, bar = Math.floor(stepN / 8), beat = stepN % 8, ch = s.root + CHORD[s.prog[bar % s.prog.length]];
    const t = nextT;
    if (beat % 2 === 0) tone(musicBus, t, spb * 1.6, midi(ch - 24 + (beat === 4 ? 7 : 0)), { type: 'triangle', vol: 0.32, lp: 600 });
    if (beat === 0 || beat === 4) tone(musicBus, t, 0.12, 90, { vol: 0.5, f2: 40 });
    if (beat === 2 || beat === 6) hiss(musicBus, t, 0.07, { f: 7000, vol: 0.06, type: 'highpass' });
    // 마림바: 음계에서 고르는 짧은 멜로디 (같은 마디는 같은 무늬)
    const h = ((bar % 4) * 13 + beat * 7) % 11;
    if (h % 3 !== 1) { const n = s.scale[(h + bar) % s.scale.length] + (h > 6 ? 12 : 0); tone(musicBus, t, 0.22, midi(s.root + 12 + n), { type: s.lead, vol: s.lead === 'square' ? 0.05 : 0.12, lp: 2600 }); tone(musicBus, t, 0.08, midi(s.root + 24 + n), { vol: 0.03 }); }
    nextT += spb; stepN++;
  }
}
