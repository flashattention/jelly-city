// 젤리 오디세이 배경음악: 음원 파일 없이 Web Audio 로 합성하는 '비장한' 관현악 흉내
//   곡 8개(애가 · 잔치 · 잠입 · 진군 · 불의 회랑 · 신들의 찬가 · 바이러스 왕 · 새벽), 모두 D 중심음 → 바뀔 때 겹쳐도 어색하지 않다
//   곡마다 층 3개 (gain = 곡끼리 소리 크기 맞추기): 0 = 바탕(늘), 1 · 2 = 전투 세기(setIntensity 0~1)에 따라 들어온다
//   음은 오디오 시계로 조금 앞까지만 예약한다 (pump). 잔향 · 모음 필터 · 비브라토 · 비트 깎기 곡선 · 잡음은 한 번 만들어 같이 쓴다
//   기획: docs/jelly-odyssey/기획서.md 8장
const mtof = (n) => 440 * 2 ** ((n - 69) / 12);
const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const FADE = 2.5, AHEAD = 0.22, _ = null;

// 마디별 [베이스 근음, 합창 화음] → 표를 짧게 쓰려고
const CH = {
  Dm: [57, 62, 65], D: [57, 62, 66], Bb: [58, 62, 65], Gm: [55, 58, 62], G: [59, 62, 67], A: [57, 61, 64], C: [55, 60, 64],
  F: [57, 60, 65], Cm: [55, 60, 63], Eb: [55, 58, 63], Ab: [56, 60, 63], Bm: [59, 62, 66], Asus: [57, 62, 64],
};
// 선율 표 [마디, 16분 칸, 음, 길이(16분)] → 찾기 쉬운 지도로
const mel = (rows) => { const m = new Map(); for (const [b, s, n, l] of rows) m.set(b * 16 + s, [n, l]); return m; };

export function createMusic(ctx, dest, { level = 0.5, muted = () => false, auto = true } = {}) {
  // ---------- 같이 쓰는 것 (한 번만 만든다) ----------
  const master = ctx.createGain(); master.gain.value = level; master.connect(dest);
  const verb = ctx.createConvolver(); verb.buffer = impulse(3.4); const verbRet = ctx.createGain(); verbRet.gain.value = 0.55; verb.connect(verbRet); verbRet.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const crushCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; crushCurve[i] = Math.round(x * 3.5) / 3.5; } // 계단 모양 = 비트 깎기
  const vibOsc = ctx.createOscillator(); vibOsc.frequency.value = 5.1; const vib = ctx.createGain(); vib.gain.value = 9; vibOsc.connect(vib); vibOsc.start(); // 합창 비브라토(센트)

  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.55 - k * 0.4); d[i] = lp * (1 - k) ** 2.6 * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1); } }
    return b;
  }
  // 층 하나: 소리 크기 + (필요할 때 처음 한 번만 만드는) 합창 모음 필터 · 어두운 현 필터 · 비트 깎기
  function makeLayer(bus, v0 = 0) {
    const g = ctx.createGain(); g.gain.value = v0; g.connect(bus);
    let choirIn = null, darkIn = null, crushIn = null;
    return {
      g, lv: v0, quietAt: 0,
      get choir() {
        if (!choirIn) {
          choirIn = ctx.createGain();
          for (const [type, f, q, a] of [['lowpass', 420, 0.7, 0.55], ['bandpass', 760, 4, 1.7], ['bandpass', 1180, 5, 1.0], ['bandpass', 2650, 7, 0.35]]) { const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const bg = ctx.createGain(); bg.gain.value = a; choirIn.connect(bp); bp.connect(bg); bg.connect(g); }
        }
        return choirIn;
      },
      get dark() { if (!darkIn) { darkIn = ctx.createBiquadFilter(); darkIn.type = 'lowpass'; darkIn.frequency.value = 650; darkIn.Q.value = 0.6; darkIn.connect(g); } return darkIn; },
      get crush() { if (!crushIn) { crushIn = ctx.createWaveShaper(); crushIn.curve = crushCurve; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180; crushIn.connect(hp); hp.connect(g); } return crushIn; },
    };
  }

  // ---------- 악기 ----------
  function env(p, t, a, hold, r, v) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(v, t + a); if (hold > a) p.setValueAtTime(v, t + hold); p.linearRampToValueAtTime(0, t + Math.max(hold, a) + r); }
  function osc(type, f, t, end, out, det = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; if (det) o.detune.value = det; o.connect(out); o.start(t); o.stop(end); return o; }
  function noiseSrc(t, end) { const s = ctx.createBufferSource(); s.buffer = noise; s.start(t, Math.random() * 1.5); s.stop(end); return s; }
  // 합창: 톱니 둘 → 층의 '아' 모음 필터, 천천히 부풀었다 숨 쉬듯 사라진다
  function choir(L, n, t, dur, v) {
    const g = ctx.createGain(), a = Math.min(1.1, dur * 0.45), r = 1.5; env(g.gain, t, a, dur, r, v);
    const f = mtof(n); for (const d of [-9, 8]) vib.connect(osc('sawtooth', f, t, t + dur + r + 0.05, g, d).detune);
    g.connect(L.choir);
  }
  // 낮은 현 · 지속음: 어긋난 톱니 둘 → 층의 어두운 필터
  function strings(L, n, t, dur, v, a = 0.4) {
    const g = ctx.createGain(), r = 0.9; env(g.gain, t, a, dur, r, v);
    const f = mtof(n); osc('sawtooth', f, t, t + dur + r + 0.05, g, -11); osc('sawtooth', f, t, t + dur + r + 0.05, g, 12);
    g.connect(L.dark);
  }
  // 금관: 음마다 열렸다 닫히는 필터 → '빠아앙' 부풀기 (atk 가 길면 크레센도)
  function brass(L, n, t, dur, v, { atk = 0.07, bright = 1, r = 0.3 } = {}) {
    const f = mtof(n), end = t + dur + r + 0.05, peak = Math.min(8000, f * (2 + 4.5 * bright) + 250);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.6;
    fl.frequency.setValueAtTime(f * 0.8, t); fl.frequency.linearRampToValueAtTime(peak, t + atk + 0.04); fl.frequency.setTargetAtTime(peak * 0.5 + f, t + atk + 0.05, dur * 0.4 + 0.05); fl.frequency.setTargetAtTime(f * 0.8, t + dur, r * 0.4);
    const g = ctx.createGain(); env(g.gain, t, atk, dur, r, v);
    osc('sawtooth', f, t, end, fl, -5); osc('sawtooth', f, t, end, fl, 6); fl.connect(g); g.connect(L.g);
  }
  // 리라 · 하프: 뜯는 소리 (삼각파 + 옥타브)
  function lyre(L, n, t, v, decay = 1.6, out = L.g) {
    const f = mtof(n), g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc('triangle', f, t, t + decay + 0.02, g); osc('sine', f * 2, t, t + decay * 0.5, g2); g2.connect(g); g.connect(out);
  }
  // 전쟁 북(타이코): 음이 떨어지는 사인 + 가죽 잡음
  function taiko(L, t, v, p = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(125 * p, t); o.frequency.exponentialRampToValueAtTime(46 * p, t + 0.32);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0); o.connect(g); g.connect(L.g); o.start(t); o.stop(t + 1.02);
    const s = noiseSrc(t, t + 0.2), fl = ctx.createBiquadFilter(), ng = ctx.createGain(); fl.type = 'lowpass'; fl.frequency.value = 650 * p; ng.gain.setValueAtTime(v * 0.55, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); s.connect(fl); fl.connect(ng); ng.connect(L.g);
  }
  // 프레임 드럼: 둠(낮게) · 텍(가장자리)
  function frame(L, t, v, tek = false) {
    const s = noiseSrc(t, t + 0.12), fl = ctx.createBiquadFilter(), ng = ctx.createGain(); fl.type = tek ? 'bandpass' : 'lowpass'; fl.frequency.value = tek ? 2600 : 900; fl.Q.value = 1.1;
    ng.gain.setValueAtTime(v * (tek ? 0.9 : 0.4), t); ng.gain.exponentialRampToValueAtTime(0.0001, t + (tek ? 0.07 : 0.1)); s.connect(fl); fl.connect(ng); ng.connect(L.g);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(tek ? 430 : 175, t); o.frequency.exponentialRampToValueAtTime(tek ? 380 : 105, t + 0.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * (tek ? 0.25 : 0.8), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (tek ? 0.08 : 0.32)); o.connect(g); g.connect(L.g); o.start(t); o.stop(t + 0.34);
  }
  // 불 타닥
  function crackle(L, t, v) { const s = noiseSrc(t, t + 0.03), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'highpass'; fl.frequency.value = 2200 + Math.random() * 3000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012 + Math.random() * 0.015); s.connect(fl); fl.connect(g); g.connect(L.g); }
  // 심벌 부풀기 (거꾸로 친 심벌처럼 점점 커진다)
  function swell(L, t, dur, v) { const s = noiseSrc(t, t + dur + 0.08), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'highpass'; fl.frequency.setValueAtTime(5000, t); fl.frequency.exponentialRampToValueAtTime(1800, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.06); s.connect(fl); fl.connect(g); g.connect(L.g); }
  // 사이버 글리치: 톱니 → 비트 깎기, 가끔 음이 튀거나 끊긴다 (바이러스 쪽)
  function glitch(L, n, t, dur, v) {
    const f = mtof(n), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
    const r = Math.random(); if (r < 0.18) o.frequency.setValueAtTime(f * 2, t + dur * 0.5); else if (r < 0.28) o.frequency.setValueAtTime(f * 0.5, t + dur * 0.33); else if (r < 0.36) o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setValueAtTime(v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur * 0.6 + 0.03);
    o.connect(g); g.connect(L.crush); o.start(t); o.stop(t + dur + 0.05);
  }
  // 종: 비정수배 배음
  function bell(L, n, t, v) { const f = mtof(n); [[1, 1, 3.2], [2.76, 0.45, 1.6], [5.4, 0.25, 0.9], [8.93, 0.12, 0.5]].forEach(([m, a, d]) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d); osc('sine', f * m, t, t + d + 0.02, g); g.connect(L.g); }); }

  // ---------- 곡 ----------
  // step(P): 16분음표마다 불린다. P.bar · P.s(0~15) · P.t(시각) · P.d(16분 길이) · P.L[층] · P.on[층](그 층을 예약할지)
  const chordBar = (P, prog) => prog[P.bar % prog.length];
  const THEMES = {
    // 애가: 빼앗긴 신전. D 에올리안, V 는 장조 A
    lament: {
      bpm: 56, bars: 8, wet: 0.6, gain: 1.35,
      prog: [[38, 'Dm'], [34, 'Bb'], [43, 'Gm'], [45, 'A'], [38, 'Dm'], [41, 'F'], [36, 'C'], [45, 'A']],
      mel: mel([[0, 0, 69, 12], [0, 12, 70, 4], [1, 0, 69, 8], [1, 8, 67, 8], [2, 0, 65, 8], [2, 8, 67, 4], [2, 12, 65, 4], [3, 0, 64, 12], [3, 12, 61, 4], [4, 0, 62, 8], [4, 8, 65, 8], [5, 0, 69, 12], [5, 12, 72, 4], [6, 0, 72, 8], [6, 8, 70, 4], [6, 12, 67, 4], [7, 0, 69, 16]]),
      step(P) {
        const [b, c] = chordBar(P, this.prog), C = CH[c], L = P.L[0], bar = P.d * 16;
        if (P.s === 0) { for (const n of C) choir(L, n, P.t, bar, 0.05); strings(L, b, P.t, bar, 0.09, 0.8); strings(L, b + 12, P.t, bar, 0.05, 0.8); }
        if (P.s % 2 === 0) { const arp = [C[0], C[1], C[2], C[0] + 12, C[2], C[1], C[0], C[1]]; lyre(L, arp[P.s / 2] + 12, P.t, P.s === 0 ? 0.075 : 0.05, 2.2); }
        const m = this.mel.get(P.bar * 16 + P.s); if (m) brass(L, m[0], P.t, m[1] * P.d, 0.045, { atk: 0.35, bright: 0.35, r: 0.8 });
        if (P.s === 0 && P.bar % 4 === 0) taiko(L, P.t, 0.32, 0.8);
        if (P.s === 8) frame(L, P.t, 0.12);
      },
    },
    // 잔치: 바이러스가 비웃으며 들뜬다. D 프리지안 + 3온음 A♭
    party: {
      bpm: 116, bars: 4, wet: 0.3, gain: 1.4,
      bass: [38, 38, 50, 38, 39, 38, 44, 38], arp: [74, 77, 80, 75, 74, 80, 77, 86],
      step(P) {
        const L = P.L[0];
        if (P.s % 2 === 0) glitch(L, this.bass[P.s / 2] + (P.bar === 3 && P.s >= 12 ? 1 : 0), P.t, P.d * 1.6, 0.075);
        if (Math.random() > 0.2) glitch(L, this.arp[(P.s + P.bar * 3) % 8], P.t, P.d * (Math.random() < 0.15 ? 0.45 : 0.9), 0.032);
        if (Math.random() < 0.06) for (let k = 0; k < 4; k++) glitch(L, this.arp[P.s % 8] + 12, P.t + k * P.d / 4, P.d / 4, 0.025); // 끊기며 떨리는 '지지직'
        if (P.s === 0) { choir(L, 50, P.t, P.d * 16, 0.035); choir(L, 56, P.t, P.d * 16, 0.03); }
        if (P.s % 4 === 2) frame(L, P.t, 0.18, true);
        if (P.s === 0 || P.s === 8) taiko(L, P.t, 0.3, 1.25);
        if (P.s === 12 && P.bar % 2 === 1) brass(L, 51, P.t, P.d * 3, 0.04, { bright: 0.5 }); // 비웃는 반음 '빠앙'
      },
    },
    // 잠입: 숨죽인 긴장. D 프리지안 / 들키면 전쟁 북 · 금관이 겹친다
    stealth: {
      bpm: 72, bars: 4, wet: 0.55, gain: 1.25,
      pz: [[38, _, _, _, _, _, 38, _, 39, _, _, _, _, _, 38, _], [38, _, _, _, _, _, 38, _, 41, _, _, _, 39, _, _, _]],
      riff: [50, _, 50, 51, 50, _, 53, 51, 50, _, 50, 51, 55, 53, 51, _],
      step(P) {
        const [L0, L1] = P.L, bar = P.d * 16;
        if (P.on[0]) {
          if (P.s === 0) taiko(L0, P.t, 0.34, 0.7); if (P.s === 3) taiko(L0, P.t, 0.22, 0.7); // 심장 박동
          const n = this.pz[P.bar % 2][P.s]; if (n) lyre(L0, n, P.t, 0.16, 0.9, L0.dark);
          if (P.s === 0) { const C = P.bar < 2 ? [62, 65, 69] : [63, 67, 70]; for (const q of C) choir(L0, q, P.t, bar, 0.022); strings(L0, P.bar === 3 ? 82 : 81, P.t, bar, 0.012, 1.2); strings(L0, 38, P.t, bar, 0.08, 1); }
        }
        if (P.on[1]) {
          if (P.s % 2 === 0) taiko(L1, P.t, P.s === 0 || P.s === 8 ? 0.5 : 0.26, 1);
          if (P.s === 6 || P.s === 14) taiko(L1, P.t, 0.38, 0.85);
          const r = this.riff[P.s]; if (r) brass(L1, r, P.t, P.d * 0.9, 0.05, { bright: 0.6, r: 0.12 });
          if (P.s === 0) { const C = P.bar % 2 ? [51, 58, 63] : [50, 57, 62]; for (const q of C) brass(L1, q + 12, P.t, P.d * 3, 0.03, { bright: 0.9 }); }
        }
      },
    },
    // 진군: 본대 돌입 · 광장 전투. D 에올리안 행군
    assault: {
      bpm: 100, bars: 8, wet: 0.4, gain: 1,
      prog: [[38, 'Dm'], [38, 'Dm'], [46, 'Bb'], [48, 'C'], [38, 'Dm'], [38, 'Dm'], [43, 'Gm'], [45, 'A']],
      drum: [1, 0, 0, 0.5, 0, 0, 0.7, 0, 0.9, 0, 0, 0.5, 0.6, 0, 0.6, 0],
      ost: [0, 0, 12, 0, 0, 12, 7, 12],
      mel: mel([[0, 0, 62, 6], [0, 6, 65, 2], [0, 8, 69, 8], [1, 0, 70, 4], [1, 4, 69, 4], [1, 8, 67, 4], [1, 12, 65, 4], [2, 0, 65, 6], [2, 6, 67, 2], [2, 8, 70, 8], [3, 0, 72, 8], [3, 8, 70, 4], [3, 12, 67, 4], [4, 0, 69, 12], [4, 12, 74, 4], [5, 0, 72, 4], [5, 4, 70, 4], [5, 8, 69, 8], [6, 0, 67, 6], [6, 6, 70, 2], [6, 8, 74, 8], [7, 0, 73, 12], [7, 12, 69, 4]]),
      step(P) {
        const [b, c] = chordBar(P, this.prog), C = CH[c], [L0, L1, L2] = P.L, bar = P.d * 16;
        if (P.on[0]) {
          const dv = this.drum[P.s]; if (dv) taiko(L0, P.t, dv * 0.55, P.s === 0 ? 0.8 : 1);
          if (P.bar % 4 === 3 && P.s >= 12) taiko(L0, P.t, 0.3 + (P.s - 12) * 0.08, 1.15); // 마디 끝 북 채움
          if (P.s % 2 === 0) brass(L0, b + 12 + this.ost[P.s / 2], P.t, P.d * 1.4, P.s % 8 === 0 ? 0.05 : 0.034, { bright: 0.45, r: 0.12 });
          if (P.s === 0) { strings(L0, b, P.t, bar, 0.09); strings(L0, b - 12 < 28 ? b : b - 12, P.t, bar, 0.06); }
        }
        if (P.on[1]) {
          const m = this.mel.get(P.bar * 16 + P.s); if (m) { brass(L1, m[0], P.t, m[1] * P.d, 0.075, { atk: 0.12, bright: 0.9 }); brass(L1, m[0] - 12, P.t, m[1] * P.d, 0.04, { atk: 0.12, bright: 0.6 }); }
          if (P.s === 0) for (const n of C) choir(L1, n + 12, P.t, bar, 0.035);
        }
        if (P.on[2]) {
          const arp = [C[0], C[1], C[2], C[1]]; lyre(L2, arp[P.s % 4] + 12 + (P.s >= 8 ? 12 : 0), P.t, 0.04, 0.6);
          if (P.s === 1 || P.s === 5 || P.s === 9 || P.s === 13) taiko(L2, P.t, 0.18, 1.3);
          if (P.bar % 4 === 3 && P.s === 0) swell(L2, P.t, bar, 0.06);
        }
      },
    },
    // 불의 회랑: 이국적이고 뜨겁다. D 히자즈(프리지안 도미넌트)
    colonnade: {
      bpm: 84, bars: 4, wet: 0.5, gain: 1.3,
      prog: [[38, 'D'], [36, 'Cm'], [38, 'D'], [43, 'Gm']],
      lyr: [[69, _, 70, 69, 66, _, 67, 66], [63, _, 62, 63, 66, 67, 69, _], [70, 69, 70, 72, 74, _, 72, 70], [69, _, 67, 66, 63, _, 62, _]],
      step(P) {
        const [b, c] = chordBar(P, this.prog), C = CH[c], [L0, L1, L2] = P.L, bar = P.d * 16;
        if (P.on[0]) {
          if (P.s === 0 || P.s === 6) frame(L0, P.t, 0.32); if (P.s === 4 || P.s === 10 || P.s === 12) frame(L0, P.t, 0.2, true);
          if (P.s === 0) { brass(L0, 50, P.t, bar, 0.025, { atk: 1.2, bright: 0.25, r: 0.9 }); brass(L0, 57, P.t, bar, 0.018, { atk: 1.2, bright: 0.25, r: 0.9 }); strings(L0, b, P.t, bar, 0.08); }
          if (P.s % 2 === 0) { const n = this.lyr[P.bar][P.s / 2]; if (n) lyre(L0, n + 12, P.t, 0.07, 1.1); }
          if (Math.random() < 0.3) crackle(L0, P.t + Math.random() * P.d, 0.05 + Math.random() * 0.07);
        }
        if (P.on[1]) { if (P.s === 0) for (const n of C) choir(L1, n, P.t, bar, 0.04); if (P.s === 0 || P.s === 8) taiko(L1, P.t, 0.42, 0.9); if (P.s === 14) taiko(L1, P.t, 0.25, 1.1); }
        if (P.on[2]) { if (P.s === 0 || P.s === 10) for (const n of C) brass(L2, n, P.t, P.d * 2, 0.035, { bright: 1 }); if (P.s % 2 === 0) taiko(L2, P.t, 0.18, 1.2); }
      },
    },
    // 신들의 찬가: 엄숙한 영웅 찬가. D 도리안 (장조 IV = G 에서 B 내추럴)
    altars: {
      bpm: 90, bars: 8, wet: 0.55, gain: 1.1,
      prog: [[38, 'Dm'], [36, 'C'], [34, 'Bb'], [36, 'C'], [38, 'Dm'], [41, 'F'], [43, 'G'], [45, 'A']],
      mel: mel([[0, 0, 69, 8], [0, 8, 67, 8], [1, 0, 67, 8], [1, 8, 64, 8], [2, 0, 65, 8], [2, 8, 62, 8], [3, 0, 64, 16], [4, 0, 69, 8], [4, 8, 72, 8], [5, 0, 72, 8], [5, 8, 74, 4], [5, 12, 72, 4], [6, 0, 71, 8], [6, 8, 74, 8], [7, 0, 73, 16]]),
      step(P) {
        const [b, c] = chordBar(P, this.prog), C = CH[c], [L0, L1, L2] = P.L, bar = P.d * 16;
        if (P.on[0]) {
          if (P.s === 0) { taiko(L0, P.t, 0.5, 0.75); for (const n of C) choir(L0, n, P.t, bar, 0.035); strings(L0, b, P.t, bar, 0.09); strings(L0, b + 12, P.t, bar, 0.05); }
          if (P.s === 8) taiko(L0, P.t, 0.32, 0.85); if (P.s === 14) taiko(L0, P.t, 0.16, 1);
        }
        if (P.on[1]) { const m = this.mel.get(P.bar * 16 + P.s); if (m) { brass(L1, m[0], P.t, m[1] * P.d, 0.055, { atk: 0.2, bright: 0.8, r: 0.5 }); brass(L1, m[0] - 12, P.t, m[1] * P.d, 0.03, { atk: 0.2, bright: 0.5, r: 0.5 }); } }
        if (P.on[2]) {
          if (P.s % 2 === 0) taiko(L2, P.t, P.s % 4 === 0 ? 0.3 : 0.18, 1.15);
          if (P.s % 2 === 0) { const arp = [C[0], C[1], C[2], C[1] + 12]; lyre(L2, arp[(P.s / 2) % 4] + 12, P.t, 0.045, 0.9); }
          if (P.bar % 4 === 3 && P.s === 0) swell(L2, P.t, bar, 0.05);
        }
      },
    },
    // 바이러스 왕: 가장 무겁고 어둡다. D 프리지안 · 로크리안 (D–E♭–A♭), 신과 바이러스가 부딪친다
    boss: {
      bpm: 108, bars: 4, wet: 0.4, gain: 0.95,
      prog: [[38, 'Dm'], [39, 'Eb'], [38, 'Dm'], [44, 'Ab']],
      drum: [1, 0, 0, 0, 0.6, 0, 0, 0.8, 0.9, 0, 0.6, 0, 0.75, 0.5, 0.7, 0.6],
      ost: [12, _, _, 12, _, _, 12, _, 12, _, _, 12, _, _, 13, _],
      arp: [74, 75, 77, 80, 74, 86, 80, 77],
      mel: mel([[0, 0, 74, 8], [0, 8, 75, 8], [1, 0, 77, 8], [1, 8, 75, 8], [2, 0, 74, 4], [2, 4, 80, 12], [3, 0, 80, 8], [3, 8, 75, 8]]),
      step(P) {
        const [b, c] = chordBar(P, this.prog), C = CH[c], [L0, L1, L2] = P.L, bar = P.d * 16;
        if (P.on[0]) {
          const dv = this.drum[P.s]; if (dv) taiko(L0, P.t, dv * 0.55, P.s === 0 ? 0.7 : 0.95);
          if (P.bar === 3 && P.s >= 8) taiko(L0, P.t, 0.25 + (P.s - 8) * 0.04, 1.2);
          const o = this.ost[P.s]; if (o !== _) brass(L0, b + o, P.t, P.d * 1.8, 0.06, { bright: 0.55, r: 0.15 });
          if (P.s === 0) { for (const n of C) choir(L0, n, P.t, bar, 0.03); strings(L0, b, P.t, bar, 0.1); }
        }
        if (P.on[1]) {
          if (Math.random() > 0.15) glitch(L1, this.arp[(P.s + P.bar * 2) % 8], P.t, P.d * 0.85, 0.03);
          if (P.s === 0 || P.s === 6) for (const n of C) brass(L1, n, P.t, P.d * 1.5, 0.035, { bright: 1.1, r: 0.15 });
        }
        if (P.on[2]) {
          taiko(L2, P.t, P.s % 4 === 0 ? 0.24 : 0.12, 1.35);
          if (P.s === 0) for (const n of C) choir(L2, n + 12, P.t, bar, 0.03);
          const m = this.mel.get(P.bar * 16 + P.s); if (m) brass(L2, m[0] - 12, P.t, m[1] * P.d, 0.05, { atk: 0.15, bright: 1 });
        }
      },
    },
    // 새벽: 단조에서 장조로 — 끝났다는 안도와 귀향의 장엄함. D 장조
    dawn: {
      bpm: 66, bars: 8, wet: 0.65, gain: 1.4,
      prog: [[38, 'D'], [45, 'A'], [47, 'Bm'], [43, 'G'], [38, 'D'], [43, 'G'], [45, 'A'], [38, 'D']],
      mel: mel([[0, 0, 66, 8], [0, 8, 69, 8], [1, 0, 69, 12], [1, 12, 67, 4], [2, 0, 66, 8], [2, 8, 71, 8], [3, 0, 71, 12], [3, 12, 69, 4], [4, 0, 74, 12], [4, 12, 73, 4], [5, 0, 71, 8], [5, 8, 74, 8], [6, 0, 73, 8], [6, 8, 76, 8], [7, 0, 74, 16]]),
      step(P) {
        const [b, c] = chordBar(P, this.prog), C = CH[c], [L0, L1, L2] = P.L, bar = P.d * 16;
        if (P.on[0]) {
          if (P.s === 0) { for (const n of C) choir(L0, n, P.t, bar, 0.04); strings(L0, b, P.t, bar, 0.08, 0.8); }
          if (P.s % 2 === 0) { const arp = [C[0], C[1], C[2], C[0] + 12, C[2], C[1], C[2], C[1] + 12]; lyre(L0, arp[P.s / 2] + 12, P.t, 0.05, 2); }
          if (P.s === 0 && P.bar % 2 === 0) taiko(L0, P.t, 0.3, 0.75);
        }
        if (P.on[1]) { const m = this.mel.get(P.bar * 16 + P.s); if (m) { brass(L1, m[0], P.t, m[1] * P.d, 0.05, { atk: 0.3, bright: 0.65, r: 0.7 }); brass(L1, m[0] - 12, P.t, m[1] * P.d, 0.025, { atk: 0.3, bright: 0.4, r: 0.7 }); } }
        if (P.on[2]) { if (P.s % 2 === 1) lyre(L2, C[(P.s >> 1) % 3] + 24, P.t, 0.025, 0.8); if (P.s === 8) taiko(L2, P.t, 0.2, 0.9); }
      },
    },
  };

  // ---------- 곡 인스턴스 (곡마다 한 번 만들어 계속 쓴다) ----------
  const insts = {}, live = new Set();
  let cur = null, x = 0, stopped = false;
  function inst(name) {
    if (insts[name]) return insts[name];
    const def = THEMES[name], bus = ctx.createGain(); bus.gain.value = 0; bus.connect(master);
    const send = ctx.createGain(); send.gain.value = def.wet; bus.connect(send); send.connect(verb);
    const L = [makeLayer(bus, 1), makeLayer(bus), makeLayer(bus)];
    return (insts[name] = { name, def, bus, L, on: [true, false, false], i: 0, nextT: 0, active: false, until: 0, vol: 1, P: { bar: 0, s: 0, t: 0, d: 0, L, on: null } });
  }
  function applyX(I, now) {
    const tg = [1, c01((x - 0.12) / 0.33), c01((x - 0.55) / 0.3)];
    for (let k = 1; k < 3; k++) {
      const lay = I.L[k]; if (Math.abs(lay.lv - tg[k]) < 0.03) continue;
      if (tg[k] < lay.lv) lay.quietAt = now + 2.5;
      lay.lv = tg[k]; lay.g.gain.cancelScheduledValues(now); lay.g.gain.setTargetAtTime(tg[k], now, 0.55);
    }
  }
  function setTheme(name, { vol = 1, fade = FADE } = {}) {
    if (!THEMES[name]) return;
    const now = ctx.currentTime; stopped = false;
    master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(level, now, 0.1);
    if (cur && cur.name === name) { vol *= cur.def.gain; if (cur.vol !== vol) { cur.vol = vol; cur.bus.gain.cancelScheduledValues(now); cur.bus.gain.setTargetAtTime(vol, now, 0.6); } return; }
    if (cur) { cur.active = false; cur.until = now + fade + 1; cur.bus.gain.cancelScheduledValues(now); cur.bus.gain.setValueAtTime(cur.bus.gain.value, now); cur.bus.gain.linearRampToValueAtTime(0, now + fade); }
    const I = inst(name); vol *= I.def.gain; I.vol = vol;
    if (!live.has(I)) { I.i = 0; I.nextT = now + 0.06; }
    I.active = true; live.add(I); cur = I;
    I.bus.gain.cancelScheduledValues(now); I.bus.gain.setValueAtTime(I.bus.gain.value, now); I.bus.gain.linearRampToValueAtTime(vol, now + fade);
    for (const lay of I.L.slice(1)) { lay.lv = 0; lay.quietAt = 0; lay.g.gain.cancelScheduledValues(now); lay.g.gain.setValueAtTime(0, now); }
    applyX(I, now);
    pump();
  }
  function setIntensity(v) { v = c01(v); if (Math.abs(v - x) < 0.04 && v !== 0 && v !== 1) return; x = v; if (cur) applyX(cur, ctx.currentTime); }
  // 오디오 시계로 AHEAD 초 앞까지 예약 (horizon 을 주면 그때까지 — 오프라인 시험용)
  function pump(horizon) {
    if (stopped) return;
    const now = ctx.currentTime, until = horizon ?? now + AHEAD, skip = muted();
    for (const I of live) {
      if (!I.active && now > I.until) { live.delete(I); continue; }
      if (I.nextT < now - 0.25) I.nextT = now + 0.05; // 탭을 떠났다 오면 박자를 다시 맞춘다
      const d = 15 / I.def.bpm, P = I.P;
      for (let k = 0; k < 3; k++) I.on[k] = k === 0 || I.L[k].lv > 0.01 || now < I.L[k].quietAt;
      P.d = d; P.on = I.on;
      while (I.nextT < until) {
        if (!skip) { const n = I.i % (I.def.bars * 16); P.bar = n >> 4; P.s = n & 15; P.t = I.nextT; I.def.step(P); }
        I.i++; I.nextT += d;
      }
    }
  }
  // ---------- 짧은 효과 음악 (스팅어) ----------
  const stingBus = ctx.createGain(); stingBus.connect(master); const stingSend = ctx.createGain(); stingSend.gain.value = 0.6; stingBus.connect(stingSend); stingSend.connect(verb);
  const SL = makeLayer(stingBus, 1);
  const STINGS = {
    titlecard: (t) => { taiko(SL, t, 0.7, 0.75); taiko(SL, t + 0.42, 0.6, 0.8); taiko(SL, t + 0.84, 0.85, 0.65); for (const n of [50, 57, 62, 65]) brass(SL, n, t + 0.84, 2.6, 0.05, { atk: 1.2, bright: 0.9, r: 1.4 }); swell(SL, t, 0.84, 0.08); },
    spotted: (t) => { taiko(SL, t, 0.8, 0.8); for (const n of [50, 51, 62, 63]) brass(SL, n, t, 0.5, 0.05, { atk: 0.02, bright: 1.2, r: 0.4 }); },
    gate: (t) => { swell(SL, t, 1.2, 0.09); for (let k = 0; k < 8; k++) taiko(SL, t + k * 0.15, 0.25 + k * 0.06, 1); [[62, 0, 0.5], [69, 0.55, 0.5], [74, 1.1, 2.2]].forEach(([n, dt, d]) => { brass(SL, n, t + 0.1 + dt, d, 0.07, { atk: 0.08, bright: 1.1, r: 0.8 }); brass(SL, n - 12, t + 0.1 + dt, d, 0.04, { atk: 0.08, r: 0.8 }); }); taiko(SL, t + 1.2, 0.9, 0.7); },
    altar: (t) => { swell(SL, t, 0.9, 0.06); for (const n of [62, 66, 69, 76]) choir(SL, n, t + 0.6, 2.6, 0.06); bell(SL, 86, t + 0.9, 0.09); bell(SL, 81, t + 1.15, 0.06); taiko(SL, t + 0.9, 0.5, 0.8); },
    boss: (t) => { for (const n of [38, 39, 50, 51, 56]) brass(SL, n, t, 3, 0.04, { atk: 2, bright: 1, r: 1.2 }); swell(SL, t, 2, 0.07); taiko(SL, t + 2, 0.95, 0.6); taiko(SL, t + 2.35, 0.7, 0.7); },
    stagger: (t) => { taiko(SL, t, 0.9, 0.7); taiko(SL, t + 0.22, 0.8, 0.85); const o = { atk: 0.03, bright: 1.2, r: 0.3 }; [74, 72, 70, 69, 67, 65, 63, 62].forEach((n, i) => brass(SL, n, t + i * 0.07, 0.12, 0.045, o)); for (let k = 0; k < 10; k++) glitch(SL, 86 - k * 3, t + 0.1 + k * 0.035, 0.05, 0.035); },
    victory: (t) => { for (let k = 0; k < 10; k++) taiko(SL, t + k * 0.11, 0.2 + k * 0.05, 1.1); [[62, 0, 0.35], [66, 0.35, 0.35], [69, 0.7, 0.35], [74, 1.05, 2.8]].forEach(([n, dt, d]) => { brass(SL, n, t + dt, d, 0.07, { atk: 0.06, bright: 1.1, r: 1 }); brass(SL, n - 12, t + dt, d, 0.035, { atk: 0.06, r: 1 }); }); for (const n of [62, 66, 69, 74]) choir(SL, n, t + 1.05, 3, 0.05); taiko(SL, t + 1.05, 1, 0.65); swell(SL, t, 1.05, 0.08); },
  };
  function stinger(name) { if (stopped || muted() || !STINGS[name]) return; STINGS[name](ctx.currentTime + 0.03); }
  // 멈추기: 모두 조용히 내리고 예약을 그만둔다 (다시 setTheme 하면 이어서)
  function stop(fade = 0.8) {
    const now = ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + fade);
    for (const I of live) { I.active = false; I.bus.gain.cancelScheduledValues(now); I.bus.gain.setValueAtTime(0, now + fade); }
    live.clear(); cur = null; stopped = true;
  }
  // 실제 게임: 60ms 마다 예약 (오프라인 시험은 auto: false 로 직접 pump)
  const timer = auto ? setInterval(() => pump(), 60) : null;
  return { setTheme, setIntensity, stinger, stop, pump, dispose: () => { stop(0.2); clearInterval(timer); }, get theme() { return cur?.name || null; }, themes: Object.keys(THEMES), stings: Object.keys(STINGS) };
}
