// 젤리어택 소리: 총 종류마다 다른 총소리 · 장전 · 맞힘 · 발소리 · 수류탄 (파일 없이 합성, 멀수록 작게)
const MUTE_KEY = 'jellyattack.mute';
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
export function toggleMute() { sound.muted = !sound.muted; try { localStorage.setItem(MUTE_KEY, sound.muted ? '1' : '0'); } catch { /* 무시 */ } if (bus) bus.gain.value = sound.muted ? 0 : 0.7; return sound.muted; }
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
// 총소리: 종류마다 다른 크기 · 날카로움 · 울림
const GUN = {
  rifle: { crack: 2600, body: 900, thump: 90, len: 0.22, vol: 0.55 },
  smg: { crack: 3200, body: 1300, thump: 120, len: 0.14, vol: 0.4 },
  sniper: { crack: 1800, body: 600, thump: 60, len: 0.7, vol: 0.9 },
  shotgun: { crack: 1400, body: 500, thump: 55, len: 0.45, vol: 0.85 },
  lmg: { crack: 2200, body: 800, thump: 80, len: 0.2, vol: 0.5 },
  pistol: { crack: 3000, body: 1200, thump: 140, len: 0.16, vol: 0.45 },
};
// vol: 거리에 따라 (0~1)
export function sfx(name, arg, vol = 1) {
  if (!ensure() || sound.muted || vol < 0.02) return;
  const t = ctx.currentTime, o = out(vol);
  switch (name) {
    case 'gun': { const g = GUN[arg] || GUN.rifle; hiss(o, t, 0.05, { f: g.crack, q: 0.6, vol: g.vol, type: 'highpass' }); hiss(o, t, g.len, { f: g.body, q: 0.8, vol: g.vol * 0.8, type: 'lowpass', f2: 200 }); tone(o, t, g.len * 0.8, g.thump * 2, { type: 'sine', vol: g.vol * 0.9, f2: g.thump }); if (arg === 'sniper' || arg === 'shotgun') hiss(o, t + 0.05, 0.6, { f: 500, vol: 0.12, type: 'lowpass', f2: 120 }); break; }
    case 'knife': hiss(o, t, 0.18, { f: 1500, q: 2, vol: 0.3, f2: 5000 }); break;
    case 'reload': hiss(o, t, 0.05, { f: 3000, vol: 0.25, type: 'highpass' }); hiss(o, t + 0.35, 0.06, { f: 2200, vol: 0.3, type: 'highpass' }); tone(o, t + 0.36, 0.05, 900, { type: 'square', vol: 0.05 }); break;
    case 'dry': tone(o, t, 0.04, 1800, { type: 'square', vol: 0.06 }); break;
    case 'switch': hiss(o, t, 0.08, { f: 2500, vol: 0.15, type: 'highpass' }); break;
    case 'hit': tone(o, t, 0.08, 1500, { type: 'square', vol: 0.09, f2: 900 }); break;
    case 'head': tone(o, t, 0.12, 2200, { type: 'triangle', vol: 0.14 }); tone(o, t + 0.05, 0.12, 2900, { type: 'triangle', vol: 0.1 }); break;
    case 'kill': for (let i = 0; i < 3; i++) tone(o, t + i * 0.06, 0.12, 900 + i * 300, { type: 'triangle', vol: 0.12 }); break;
    case 'hurt': tone(o, t, 0.2, 220, { type: 'sawtooth', vol: 0.12, f2: 110 }); hiss(o, t, 0.12, { f: 800, vol: 0.15, type: 'lowpass' }); break;
    case 'die': tone(o, t, 0.8, 400, { type: 'triangle', vol: 0.18, f2: 70 }); break;
    case 'boom': hiss(o, t, 0.08, { f: 3500, vol: 0.9, type: 'highpass' }); tone(o, t, 1.4, 90, { type: 'sine', vol: 1.0, f2: 24 }); tone(o, t, 0.5, 55, { type: 'sawtooth', vol: 0.25, f2: 30 }); hiss(o, t, 1.6, { f: 1800, vol: 0.85, type: 'lowpass', f2: 90 }); hiss(o, t + 0.12, 1.2, { f: 4000, q: 0.5, vol: 0.12, f2: 600 }); break; // 쾅! + 길게 울리는 땅울림 + 파편 소리
    case 'throw': hiss(o, t, 0.25, { f: 800, q: 1.5, vol: 0.2, f2: 2500 }); break;
    case 'step': hiss(o, t, 0.06, { f: 500 + Math.random() * 200, vol: 0.18, type: 'lowpass' }); break;
    case 'jump': hiss(o, t, 0.08, { f: 700, vol: 0.12, type: 'lowpass' }); break;
    case 'land': tone(o, t, 0.1, 90, { vol: 0.2, f2: 50 }); hiss(o, t, 0.08, { f: 400, vol: 0.2, type: 'lowpass' }); break;
    case 'spawn': for (let i = 0; i < 3; i++) tone(o, t + i * 0.07, 0.2, 520 + i * 260, { type: 'sine', vol: 0.08 }); break;
    case 'whizz': hiss(o, t, 0.12, { f: 3500, q: 4, vol: 0.12, f2: 1200 }); break;
    case 'win': for (let i = 0; i < 6; i++) tone(o, t + i * 0.09, 0.4, 523 * 2 ** ([0, 4, 7, 12, 16, 19][i] / 12), { type: 'triangle', vol: 0.12 }); break;
    case 'lose': for (let i = 0; i < 4; i++) tone(o, t + i * 0.15, 0.4, 392 * 2 ** (-[0, 2, 4, 7][i] / 12), { type: 'triangle', vol: 0.1 }); break;
    case 'tick': tone(o, t, 0.05, 1200, { type: 'square', vol: 0.05 }); break;
  }
}
