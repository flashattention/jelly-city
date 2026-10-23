// 파티 게임(사과게임 · 끝말잇기 · 그림릴레이)이 같이 쓰는 것: 곰돌이 얼굴 사진 · 소리(파일 없이 합성) · 색종이
import { thumbOf } from './char-studio.js';

// ---------- 곰돌이 얼굴 (방 사람마다 한 번만 그린다) ----------
const faces = new Map();
export function avatarOf(m) {
  const key = JSON.stringify([m.name, m.color, m.look, m.acc]);
  if (!faces.has(key)) {
    let url = '';
    try { url = thumbOf({ name: m.name, profile: { name: m.name, color: m.color, look: m.look, accessories: m.acc || [] } }, 160); } catch { /* WebGL 없음 */ }
    faces.set(key, url);
  }
  return faces.get(key);
}
// 동그란 얼굴 사진 (사진이 없으면 색 동그라미)
export function faceHtml(m, size = 44, cls = '') {
  const url = avatarOf(m);
  return `<span class="face ${cls}" style="width:${size}px;height:${size}px;background:${m.color || '#8a5634'}">${url ? `<img src="${url}" alt="" />` : ''}</span>`;
}

// ---------- 소리 ----------
let ctx = null, bus = null, musicBus = null, musicT = null;
export function makeSound(key) {
  const MUTE = `${key}.mute`;
  const sound = { muted: (() => { try { return localStorage.getItem(MUTE) === '1'; } catch { return false; } })() };
  const ensure = () => {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    bus = ctx.createGain(); bus.connect(comp);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    apply();
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
    return ctx;
  };
  const apply = () => { if (!bus) return; bus.gain.value = sound.muted ? 0 : 0.6; musicBus.gain.value = sound.muted ? 0 : 0.16; };
  const tone = (t, dur, f, { type = 'sine', vol = 0.2, f2 = null, a = 0.004 } = {}) => {
    const s = ctx.createOscillator(), g = ctx.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t); if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
  };
  // 이름마다 짧은 효과음 (arg: 음 높이 등)
  const SFX = {
    pop: (t, n = 1) => { for (let i = 0; i < Math.min(5, n); i++) tone(t + i * 0.035, 0.16, 520 + i * 90 + n * 30, { type: 'triangle', vol: 0.22, f2: 1100 + i * 120 }); },
    tick: (t, k = 0) => tone(t, 0.06, 900 + k * 40, { type: 'square', vol: 0.05 }),
    ten: (t) => { tone(t, 0.12, 880, { type: 'triangle', vol: 0.14 }); tone(t + 0.05, 0.14, 1320, { type: 'triangle', vol: 0.12 }); },
    bad: (t) => tone(t, 0.18, 220, { type: 'sawtooth', vol: 0.06, f2: 140 }),
    ok: (t) => { tone(t, 0.12, 660, { type: 'triangle', vol: 0.2 }); tone(t + 0.08, 0.2, 990, { type: 'triangle', vol: 0.2 }); },
    turn: (t) => { tone(t, 0.1, 740, { vol: 0.16 }); tone(t + 0.1, 0.14, 988, { vol: 0.16 }); },
    clock: (t) => tone(t, 0.05, 1500, { type: 'square', vol: 0.06 }),
    miss: (t) => { tone(t, 0.25, 400, { type: 'sawtooth', vol: 0.1, f2: 200 }); tone(t + 0.2, 0.35, 260, { type: 'sawtooth', vol: 0.1, f2: 120 }); },
    start: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.09, 0.18, f, { type: 'triangle', vol: 0.18 })),
    win: (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.1, 0.3, f, { type: 'triangle', vol: 0.2 })),
    lose: (t) => [523, 466, 392, 330].forEach((f, i) => tone(t + i * 0.14, 0.3, f, { type: 'triangle', vol: 0.15 })),
    count: (t, k = 0) => tone(t, 0.14, k ? 1046 : 660, { type: 'triangle', vol: 0.2 }),
    pen: (t) => tone(t, 0.04, 2000 + Math.random() * 600, { type: 'sine', vol: 0.015 }),
    page: (t) => { tone(t, 0.12, 300, { type: 'triangle', vol: 0.08, f2: 600 }); },
    heart: (t) => { tone(t, 0.1, 880, { vol: 0.15 }); tone(t + 0.07, 0.16, 1175, { vol: 0.15 }); },
    type: (t) => tone(t, 0.03, 1200 + Math.random() * 300, { type: 'square', vol: 0.025 }),
  };
  // 배경음악: 통통 튀는 짧은 반복 (게임마다 음 다르게)
  const MUSIC = {
    apple: { bpm: 132, notes: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 79, 76, 74, 71], bass: [48, 48, 53, 53, 48, 48, 55, 55] },
    word: { bpm: 104, notes: [69, 72, 76, 72, 71, 74, 77, 74, 69, 72, 76, 81, 79, 76, 74, 72], bass: [45, 45, 50, 50, 45, 45, 52, 52] },
    draw: { bpm: 96, notes: [67, 71, 74, 71, 72, 76, 79, 76, 67, 71, 74, 79, 77, 74, 72, 71], bass: [43, 43, 48, 48, 43, 43, 50, 50] },
  };
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);
  return {
    sound,
    unlock() { if (ensure() && ctx.state !== 'running') ctx.resume(); },
    toggleMute() { sound.muted = !sound.muted; try { localStorage.setItem(MUTE, sound.muted ? '1' : '0'); } catch { /* 무시 */ } apply(); return sound.muted; },
    sfx(name, arg) { if (sound.muted || !ensure() || ctx.state !== 'running') return; SFX[name]?.(ctx.currentTime + 0.01, arg); },
    music(name) {
      clearInterval(musicT); musicT = null;
      const M = MUSIC[name]; if (!M || !ensure()) return;
      let i = 0; const step = 60 / M.bpm / 2;
      musicT = setInterval(() => {
        if (sound.muted || ctx.state !== 'running') { i++; return; }
        const t = ctx.currentTime + 0.02, n = M.notes[i % M.notes.length];
        const s = ctx.createOscillator(), g = ctx.createGain(); s.type = 'triangle'; s.frequency.value = midi(n);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.9);
        s.connect(g); g.connect(musicBus); s.start(t); s.stop(t + step);
        if (i % 2 === 0) {
          const b = ctx.createOscillator(), bg = ctx.createGain(); b.type = 'sine'; b.frequency.value = midi(M.bass[(i / 2) % M.bass.length]);
          bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.7, t + 0.01); bg.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.8);
          b.connect(bg); bg.connect(musicBus); b.start(t); b.stop(t + step * 2);
        }
        i++;
      }, step * 1000);
    },
    stopMusic() { clearInterval(musicT); musicT = null; },
  };
}

// ---------- 색종이 (이기거나 좋은 일이 있을 때) ----------
export function confetti(n = 80) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50';
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#ff8fc4', '#ffd84d', '#7cf0c8', '#8fd3ff', '#b388ff', '#ff9a62'];
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -6 - Math.random() * 12, r: 4 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, s: Math.random() < 0.5 }));
  const t0 = performance.now();
  const step = () => {
    const el = performance.now() - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.15;
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = Math.max(0, 1 - el / 2600); g.fillStyle = p.c;
      if (p.s) { g.beginPath(); g.arc(0, 0, p.r * 0.6, 0, Math.PI * 2); g.fill(); } else g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      g.restore();
    }
    if (el < 2600) requestAnimationFrame(step); else cv.remove();
  };
  step();
}
export const rankIcon = (r) => (r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : r);
