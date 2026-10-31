// 젤리수호대 소리: 파일 없이 합성 (총 · 로켓 · 줄기 · 치유 · 기술 · 궁극기 · 거점 · 승리/패배) + 궁극기 대사 (브라우저 음성)
const MUTE_KEY = 'jellyguard.mute';
let ctx = null, bus = null, noise = null;
export const sound = { muted: (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })() };
function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
  bus = ctx.createGain(); bus.gain.value = sound.muted ? 0 : 0.7; bus.connect(comp);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return ctx;
}
export function unlock() { if (ensure() && ctx.state !== 'running') ctx.resume(); }
export function toggleMute() { sound.muted = !sound.muted; try { localStorage.setItem(MUTE_KEY, sound.muted ? '1' : '0'); } catch { /* 무시 */ } if (bus) bus.gain.value = sound.muted ? 0 : 0.7; if (sound.muted) speechSynthesis?.cancel?.(); return sound.muted; }
function out(vol) { const g = ctx.createGain(); g.gain.value = vol; g.connect(bus); return g; }
function tone(o, t, dur, f, { type = 'sine', vol = 0.2, f2 = null, a = 0.003 } = {}) {
  const s = ctx.createOscillator(), g = ctx.createGain();
  s.type = type; s.frequency.setValueAtTime(f, t); if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g); g.connect(o); s.start(t); s.stop(t + dur + 0.05);
}
function hiss(o, t, dur, { f = 2000, q = 0.7, type = 'bandpass', vol = 0.3, f2 = null } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(o); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const chord = (o, t, notes, base, dt, dur, type = 'triangle', vol = 0.12) => notes.forEach((n, i) => tone(o, t + i * dt, dur, base * 2 ** (n / 12), { type, vol }));
// 총소리 크기 · 날카로움
const GUN = { pistol: [3000, 1200, 140, 0.16, 0.45], heavy: [1400, 500, 55, 0.45, 0.8], rifle: [2600, 900, 90, 0.18, 0.45], smg: [3400, 1400, 130, 0.1, 0.32], sniper: [1800, 600, 60, 0.7, 0.85], pulse: [4200, 1800, 300, 0.1, 0.3] };
export function sfx(name, arg, vol = 1) {
  if (!ensure() || sound.muted || vol < 0.02) return;
  const t = ctx.currentTime, o = out(vol);
  switch (name) {
    case 'gun': { const [crack, body, thump, len, v] = GUN[arg] || GUN.rifle; hiss(o, t, 0.05, { f: crack, q: 0.6, vol: v, type: 'highpass' }); hiss(o, t, len, { f: body, q: 0.8, vol: v * 0.8, type: 'lowpass', f2: 200 }); tone(o, t, len * 0.8, thump * 2, { vol: v * 0.8, f2: thump }); break; }
    case 'laser': tone(o, t, 0.12, 1800, { type: 'square', vol: 0.06, f2: 600 }); hiss(o, t, 0.06, { f: 5000, vol: 0.1, type: 'highpass' }); break;
    case 'rocket': hiss(o, t, 0.35, { f: 600, q: 1, vol: 0.4, f2: 1800 }); tone(o, t, 0.2, 140, { vol: 0.25, f2: 70 }); break;
    case 'throw': hiss(o, t, 0.22, { f: 900, q: 1.5, vol: 0.2, f2: 2600 }); break;
    case 'shuri': hiss(o, t, 0.1, { f: 4500, q: 3, vol: 0.18, f2: 2200 }); break;
    case 'boom': hiss(o, t, 0.06, { f: 3000, vol: 0.6, type: 'highpass' }); tone(o, t, 0.7, 110, { vol: 0.6, f2: 35 }); hiss(o, t, 0.8, { f: 1500, vol: 0.5, type: 'lowpass', f2: 100 }); break;
    case 'bigboom': hiss(o, t, 0.1, { f: 3500, vol: 1, type: 'highpass' }); tone(o, t, 2, 80, { vol: 1, f2: 20 }); hiss(o, t, 2.2, { f: 1600, vol: 0.9, type: 'lowpass', f2: 60 }); break;
    case 'swing': hiss(o, t, 0.25, { f: 700, q: 1.2, vol: 0.35, f2: 2200 }); break;
    case 'thud': tone(o, t, 0.2, 120, { vol: 0.45, f2: 50 }); hiss(o, t, 0.15, { f: 600, vol: 0.3, type: 'lowpass' }); break;
    case 'smash': tone(o, t, 0.4, 95, { vol: 0.75, f2: 32 }); tone(o, t, 0.09, 260, { type: 'square', vol: 0.16, f2: 70 }); hiss(o, t, 0.3, { f: 1500, vol: 0.45, type: 'lowpass' }); break; // 망치에 맞았을 때: 묵직하게 쾅
    case 'beam': tone(o, t, 0.11, arg || 520, { type: 'sawtooth', vol: 0.03 }); break;
    case 'heal': tone(o, t, 0.12, 880, { type: 'sine', vol: 0.05, f2: 1320 }); break;
    case 'hit': tone(o, t, 0.06, 1500, { type: 'square', vol: 0.07, f2: 900 }); break;
    case 'head': tone(o, t, 0.1, 2200, { type: 'triangle', vol: 0.13 }); tone(o, t + 0.05, 0.12, 2900, { type: 'triangle', vol: 0.1 }); break;
    case 'barrier': tone(o, t, 0.08, 400, { type: 'triangle', vol: 0.08, f2: 260 }); break;
    case 'elim': chord(o, t, [0, 7, 12], 784, 0.05, 0.18, 'triangle', 0.13); break;
    case 'hurt': tone(o, t, 0.16, 230, { type: 'sawtooth', vol: 0.1, f2: 120 }); break;
    case 'die': tone(o, t, 0.9, 420, { type: 'triangle', vol: 0.18, f2: 70 }); break;
    case 'step': hiss(o, t, 0.06, { f: 500 + Math.random() * 200, vol: 0.14, type: 'lowpass' }); break;
    case 'jump': hiss(o, t, 0.08, { f: 700, vol: 0.12, type: 'lowpass' }); break;
    case 'land': tone(o, t, 0.1, 90, { vol: 0.2, f2: 50 }); break;
    case 'reload': hiss(o, t, 0.05, { f: 3000, vol: 0.2, type: 'highpass' }); hiss(o, t + 0.3, 0.06, { f: 2200, vol: 0.25, type: 'highpass' }); break;
    case 'dry': tone(o, t, 0.04, 1800, { type: 'square', vol: 0.05 }); break;
    case 'abil': hiss(o, t, 0.25, { f: 1200, q: 2, vol: 0.25, f2: 3500 }); tone(o, t, 0.2, 500, { type: 'triangle', vol: 0.08, f2: 900 }); break;
    case 'dash': hiss(o, t, 0.3, { f: 2500, q: 1, vol: 0.35, f2: 600 }); break;
    case 'blink': tone(o, t, 0.12, 1400, { type: 'sine', vol: 0.12, f2: 2600 }); hiss(o, t, 0.1, { f: 6000, vol: 0.1, type: 'highpass' }); break;
    case 'cd': tone(o, t, 0.06, 300, { type: 'square', vol: 0.05 }); break;
    case 'ultready': chord(o, t, [0, 4, 7, 12], 660, 0.07, 0.3, 'triangle', 0.1); break;
    case 'ult': hiss(o, t, 0.5, { f: 800, q: 1, vol: 0.3, f2: 4000 }); chord(o, t, [0, 7, 12, 19], 330, 0.06, 0.5, 'sawtooth', 0.06); break;
    case 'enemyult': chord(o, t, [0, 6, 0, 6], 300, 0.12, 0.2, 'square', 0.07); break;
    case 'cap': chord(o, t, [0, 4, 7, 12, 16], 523, 0.08, 0.35, 'triangle', 0.12); break;
    case 'lost': chord(o, t, [7, 4, 0, -5], 440, 0.1, 0.35, 'triangle', 0.1); break;
    case 'tick': tone(o, t, 0.05, 1000, { type: 'square', vol: 0.04 }); break;
    case 'horn': tone(o, t, 0.9, 220, { type: 'sawtooth', vol: 0.12 }); tone(o, t, 0.9, 330, { type: 'sawtooth', vol: 0.08 }); break;
    case 'win': chord(o, t, [0, 4, 7, 12, 16, 19, 24], 523, 0.1, 0.6, 'triangle', 0.13); break;
    case 'lose': chord(o, t, [0, -2, -4, -7, -12], 392, 0.18, 0.6, 'triangle', 0.1); break;
    case 'spawn': chord(o, t, [0, 4, 7], 520, 0.07, 0.2, 'sine', 0.08); break;
    case 'pick': tone(o, t, 0.1, 900, { type: 'triangle', vol: 0.1, f2: 1400 }); break;
  }
}
// 궁극기 대사: 브라우저 한국어 목소리로 (없으면 조용히)
export function say(text, { pitch = 1.3, rate = 1.05, vol = 0.9 } = {}) {
  if (sound.muted || !window.speechSynthesis || !text) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.pitch = pitch; u.rate = rate; u.volume = vol;
    const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('ko')); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* 무시 */ }
}
