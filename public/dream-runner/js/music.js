// 드림 러너 소리: 꿈마다 음계 · 빠르기 · 음색이 바뀌는 몽글몽글한 음악 + 효과음 (파일 없이 Web Audio로 합성)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  phryg: [0, 1, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9, 12, 14], whole: [0, 2, 4, 6, 8, 10, 12], dim: [0, 2, 3, 5, 6, 8, 9],
};
// 화음 진행 (음계 몇 번째 음에서 시작)
const PROG = [[0, 5, 3, 4], [0, 3, 5, 4], [5, 3, 0, 4], [0, 4, 5, 3]];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const MUTE_KEY = 'dreamrunner.mute';

let ctx = null, master = null, musicBus = null, sfxBus = null, noise = null, verb = null;
let mus = null, step = 0, nextT = 0, timer = null, prog = PROG[0], bar = 0;
export const sound = { muted: (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })() };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createDynamicsCompressor(); master.connect(ctx.destination);
  musicBus = ctx.createGain(); sfxBus = ctx.createGain();
  // 꿈 같은 울림 (짧은 잔향)
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5; }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  musicBus.connect(master); musicBus.connect(verb); verb.connect(wet); wet.connect(master);
  sfxBus.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  apply();
  document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return ctx;
}
function apply() { if (!ctx) return; musicBus.gain.value = sound.muted ? 0 : 0.42; sfxBus.gain.value = sound.muted ? 0 : 0.7; }
export function unlock() { if (!ensure()) return; if (ctx.state !== 'running') ctx.resume(); }
export function toggleMute() { sound.muted = !sound.muted; try { localStorage.setItem(MUTE_KEY, sound.muted ? '1' : '0'); } catch { /* 무시 */ } apply(); return sound.muted; }

function tone(bus, t, dur, f, { type = 'sine', vol = 0.2, a = 0.01, f2 = null, lp = null, det = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
function hiss(bus, t, dur, { f = 6000, vol = 0.1, type = 'highpass', f2 = null } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
}

// 꿈(테마)의 음악 정하기: mus = [음계, 으뜸음, 빠르기, 음색]
export function setMusic(m) {
  if (!ensure()) return;
  const [scale, root, bpm, wave] = m || ['major', 60, 100, 'triangle'];
  mus = { sc: SCALES[scale] || SCALES.major, root, spb: 60 / bpm, wave, dark: scale === 'dim' || scale === 'phryg' || scale === 'minor' };
  prog = PROG[Math.floor(Math.random() * PROG.length)]; bar = 0;
  if (!timer) { nextT = ctx.currentTime + 0.1; step = 0; timer = setInterval(schedule, 50); }
}
export function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }
const note = (deg, oct = 0) => { const sc = mus.sc, n = sc.length; const o = Math.floor(deg / n); return mus.root + sc[((deg % n) + n) % n] + 12 * (o + oct); };
function schedule() {
  if (!ctx || !mus) return;
  while (nextT < ctx.currentTime + 0.25) {
    const t = nextT, half = mus.spb / 2;
    const chord = prog[bar % 4];
    const inBar = step % 8;
    if (inBar === 0) {
      // 화음 깔기 (부드러운 패드)
      for (const k of [0, 2, 4]) for (const det of [-7, 7]) tone(musicBus, t, mus.spb * 4.2, midi(note(chord + k, -1)), { type: 'triangle', vol: 0.035, a: 0.4, lp: 1400, det });
      tone(musicBus, t, mus.spb * 2, midi(note(chord, -2)), { type: 'sine', vol: 0.12, a: 0.02 });
    }
    // 반짝이는 아르페지오 (8분음표)
    const pat = [0, 2, 4, 7, 4, 2, 4, 9];
    if (Math.random() < 0.85) tone(musicBus, t, half * 1.6, midi(note(chord + pat[inBar], 1)), { type: mus.wave, vol: mus.wave === 'sawtooth' || mus.wave === 'square' ? 0.03 : 0.06, a: 0.005, lp: mus.wave === 'sine' ? null : 2600 });
    // 가벼운 박자
    if (inBar % 2 === 0) tone(musicBus, t, 0.18, 110, { type: 'sine', vol: 0.16, f2: 45, a: 0.002 });
    if (inBar % 2 === 1 && mus.spb < 0.6) hiss(musicBus, t, 0.05, { f: 8000, vol: 0.03 });
    if (inBar === 4 && mus.dark) hiss(musicBus, t, 0.12, { f: 1800, vol: 0.05, type: 'bandpass' });
    nextT += half; step++;
    if (step % 8 === 0) bar++;
  }
}

export function sfx(name, arg) {
  if (!ensure() || sound.muted) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'jump': tone(sfxBus, t, 0.18, 420, { type: 'square', vol: 0.08, f2: 780, lp: 2500 }); break;
    case 'jump2': tone(sfxBus, t, 0.25, 620, { type: 'triangle', vol: 0.12, f2: 1300 }); hiss(sfxBus, t, 0.25, { f: 3000, vol: 0.05, f2: 9000 }); break;
    case 'land': tone(sfxBus, t, 0.12, 140, { type: 'sine', vol: 0.18, f2: 60 }); break;
    case 'slide': hiss(sfxBus, t, 0.35, { f: 900, vol: 0.12, type: 'bandpass', f2: 300 }); break;
    case 'star': { const k = Math.min(4, arg || 1); for (let i = 0; i < k; i++) tone(sfxBus, t + i * 0.05, 0.3, midi(84 + i * 4), { type: 'sine', vol: 0.1 }); tone(sfxBus, t, 0.2, midi(96), { type: 'triangle', vol: 0.04 }); break; }
    case 'portal': for (let i = 0; i < 8; i++) tone(sfxBus, t + i * 0.06, 0.6, midi(72 + [0, 4, 7, 11, 12, 16, 19, 24][i]), { type: 'sine', vol: 0.07 }); hiss(sfxBus, t, 1.2, { f: 400, vol: 0.08, type: 'bandpass', f2: 6000 }); break;
    case 'die': tone(sfxBus, t, 0.9, 520, { type: 'triangle', vol: 0.16, f2: 80 }); tone(sfxBus, t + 0.05, 0.9, 523, { type: 'sine', vol: 0.08, f2: 90 }); break;
    case 'bonk': tone(sfxBus, t, 0.2, 200, { type: 'square', vol: 0.12, f2: 70, lp: 900 }); hiss(sfxBus, t, 0.12, { f: 1200, vol: 0.12, type: 'lowpass' }); break;
    case 'shove': hiss(sfxBus, t, 0.2, { f: 600, vol: 0.18, type: 'bandpass', f2: 1800 }); tone(sfxBus, t, 0.15, 180, { type: 'sine', vol: 0.15, f2: 90 }); break;
    case 'shoved': tone(sfxBus, t, 0.3, 300, { type: 'triangle', vol: 0.15, f2: 700 }); hiss(sfxBus, t, 0.25, { f: 2000, vol: 0.1 }); break;
    case 'beep': tone(sfxBus, t, 0.18, arg ? 880 : 520, { type: 'square', vol: 0.08, lp: 3000 }); break;
    case 'best': for (let i = 0; i < 6; i++) tone(sfxBus, t + i * 0.09, 0.4, midi(72 + [0, 4, 7, 12, 16, 19][i]), { type: 'triangle', vol: 0.1 }); break;
  }
}
