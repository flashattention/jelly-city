// 젤리 슬라이드: 판을 밀어 같은 젤리곰끼리 부딪히면 한 단계 큰 곰으로! 🍬 설탕 덩어리는 옆에서 합쳐서 녹이고, 🌈 무지개 젤리는 아무 곰과 합쳐진다
//   혼자 하기(4×4 · 5×5 · 최고 점수 · 되돌리기 한 번) · 봇과 대결 · 같이 하기(최대 8명 · 큰 곰 · 콤보 = 상대 판에 설탕 덩어리)
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { Ranking } from '../../shared/js/ranking.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { Board, FLAVORS, SUGAR, RAINBOW, KING, SIZES, DIRS } from './engine.js';

const TIMES = [120, 180, 300];
const $ = (id) => document.getElementById(id);
const S = makeSound('jellyslide');
const PICK_KEY = 'jellyslide.pick', BEST_KEY = 'jellyslide.best';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const bestOf = (() => { try { return JSON.parse(store.get(BEST_KEY) || '{}'); } catch { return {}; } })();
const game = window.slide = {
  mode: 'title', kind: 'solo', board: null, players: new Map(), myId: 0, time: 180, startAt: 0, endAt: 0, out: false,
  pick: { size: SIZES.includes(pick0.size) ? pick0.size : 4, time: TIMES.includes(pick0.time) ? pick0.time : 180, bots: pick0.bots ?? 3, star: pick0.star !== false, sugar: pick0.sugar !== false },
};
for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// ---------- 젤리 그림 ----------
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const tint = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v + (255 - v) * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const RAINBOW_C = ['#ff4d6d', '#ff9334', '#ffd23f', '#62cf7a', '#4a9dff', '#9a6bff'];
// 곰젤리: 반투명 몸 · 귀 · 광택 · 설탕 반짝이 · 얼굴 (단계가 오를수록 표정이 신난다)
function drawJelly(g, r, lv) {
  const col = FLAVORS[lv].c;
  if (lv === SUGAR) {
    const s = r * 1.62;
    g.fillStyle = 'rgba(120,100,170,.25)'; g.beginPath(); g.roundRect(-s / 2 + 2, -s / 2 + 3, s, s, r * 0.32); g.fill();
    const gr = g.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9d2ea');
    g.fillStyle = gr; g.beginPath(); g.roundRect(-s / 2, -s / 2, s, s, r * 0.32); g.fill();
    g.strokeStyle = 'rgba(150,130,200,.5)'; g.lineWidth = Math.max(1, r * 0.08); g.stroke();
    g.strokeStyle = 'rgba(170,150,215,.35)'; g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath(); g.moveTo(-s / 2 + r * 0.2, 0); g.lineTo(s / 2 - r * 0.2, 0); g.moveTo(0, -s / 2 + r * 0.2); g.lineTo(0, s / 2 - r * 0.2); g.stroke();
    g.fillStyle = '#fff'; for (const [x, y] of [[-0.35, -0.4], [0.4, 0.3], [-0.2, 0.42], [0.35, -0.3]]) { g.beginPath(); g.arc(x * r, y * r, r * 0.07, 0, 7); g.fill(); }
    return;
  }
  const ears = lv !== RAINBOW;
  const fill = (path) => {
    if (lv === KING || lv === RAINBOW) {
      const cg = g.createConicGradient ? g.createConicGradient(0, 0, 0) : null;
      if (cg) { RAINBOW_C.forEach((c, i) => cg.addColorStop(i / RAINBOW_C.length, c)); cg.addColorStop(1, RAINBOW_C[0]); g.fillStyle = cg; } else g.fillStyle = '#ffcf33';
      g.fill(path);
      const wash = g.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r * 1.05); wash.addColorStop(0, 'rgba(255,255,255,.55)'); wash.addColorStop(1, 'rgba(255,255,255,.05)');
      g.fillStyle = wash; g.fill(path);
    } else {
      const gr = g.createLinearGradient(-r * 0.5, -r, r * 0.4, r); gr.addColorStop(0, tint(col, 0.35)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, 0.78));
      g.fillStyle = gr; g.fill(path);
    }
  };
  // 바닥 그림자
  g.fillStyle = 'rgba(60,20,90,.18)'; g.beginPath(); g.ellipse(0, r * 0.92, r * 0.8, r * 0.16, 0, 0, 7); g.fill();
  const body = new Path2D(); body.arc(0, 0, r, 0, Math.PI * 2);
  if (ears) for (const sx of [-1, 1]) { const e = new Path2D(); e.arc(sx * r * 0.62, -r * 0.7, r * 0.33, 0, 7); g.globalAlpha = 0.95; fill(e); g.globalAlpha = 1; g.strokeStyle = shade(col, 0.65); g.globalAlpha = 0.4; g.lineWidth = Math.max(1, r * 0.06); g.stroke(e); g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(sx * r * 0.62, -r * 0.7, r * 0.15, 0, 7); g.fill(); }
  g.globalAlpha = 0.96; fill(body); g.globalAlpha = 1;
  const glow = g.createRadialGradient(0, r * 0.45, r * 0.1, 0, r * 0.35, r * 1.1); glow.addColorStop(0, 'rgba(255,255,255,.4)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fill(body);
  g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = lv === KING ? '#c98a00' : shade(col, 0.6); g.globalAlpha = 0.55; g.stroke(body); g.globalAlpha = 1;
  // 광택
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-r * 0.42, -r * 0.45, r * 0.26, r * 0.13, -0.6, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(-r * 0.12, -r * 0.62, r * 0.06, 0, 7); g.fill();
  // 설탕 반짝이
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 7; i++) { const a = (lv * 1.7 + i * 2.4) % (Math.PI * 2), d = r * (0.4 + ((i * 37 + lv * 11) % 45) / 100); g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d * 0.9, r * 0.03, 0, 7); g.fill(); }
  if (lv === RAINBOW) {
    g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.25 : r * 0.58; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); g.fill();
    return;
  }
  if (lv === 10) { g.fillStyle = 'rgba(255,240,220,.55)'; for (const [x, y, s] of [[0.5, 0.3, 0.08], [0.6, -0.1, 0.06], [-0.55, 0.35, 0.07], [0.25, 0.6, 0.05]]) { g.beginPath(); g.arc(x * r, y * r, s * r, 0, 7); g.fill(); } }
  // 얼굴
  const ink = lv === KING ? '#5a3a00' : shade(col, 0.32);
  const ey = r * 0.02, ex = r * 0.3, es = r * (lv >= 6 ? 0.1 : 0.085);
  g.fillStyle = ink;
  if (lv >= 9) { // 반짝 눈
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * ex, ey, es * 1.15, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * ex - es * 0.35, ey - es * 0.4, es * 0.45, 0, 7); g.fill(); g.fillStyle = ink; }
  } else if (lv % 3 === 2) { // 웃는 눈 ^^
    g.strokeStyle = ink; g.lineWidth = es * 0.8; g.lineCap = 'round';
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * ex, ey + es * 0.6, es * 1.1, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  } else for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * ex, ey, es, 0, 7); g.fill(); }
  g.strokeStyle = ink; g.lineWidth = Math.max(1, r * 0.06); g.lineCap = 'round';
  g.beginPath(); if (lv >= 7) { g.fillStyle = shade(col, 0.45); g.moveTo(-r * 0.14, r * 0.2); g.quadraticCurveTo(0, r * 0.46, r * 0.14, r * 0.2); g.closePath(); g.fill(); } else { g.arc(0, r * 0.16, r * 0.11, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  g.fillStyle = 'rgba(255,110,150,.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.52, r * 0.2, r * 0.13, r * 0.08, 0, 0, 7); g.fill(); }
  if (lv === KING) { // 왕관
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#b07800'; g.lineWidth = r * 0.04;
    g.beginPath(); g.moveTo(-r * 0.36, -r * 0.78); g.lineTo(-r * 0.4, -r * 1.12); g.lineTo(-r * 0.18, -r * 0.94); g.lineTo(0, -r * 1.2); g.lineTo(r * 0.18, -r * 0.94); g.lineTo(r * 0.4, -r * 1.12); g.lineTo(r * 0.36, -r * 0.78); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, -r * 0.9, r * 0.06, 0, 7); g.fill();
  }
}
let dpr = 1, sprites = new Map();
function sprite(lv, r) {
  const key = lv + ':' + r.toFixed(1);
  let c = sprites.get(key);
  if (!c) { const s = Math.ceil(r * 2.9 * dpr); c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'); x.scale(dpr, dpr); x.translate(s / dpr / 2, s / dpr / 2 + r * 0.08); drawJelly(x, r, lv); sprites.set(key, c); }
  return c;
}

// ---------- 판 그리기 (미끄러짐 · 합쳐짐 · 생김 · 녹음 움직임) ----------
const cv = $('board'), g = cv.getContext('2d');
const SLIDE_MS = 120, POP_MS = 220, PAD = 10;
let cell = 90, gap = 10, BW = 400;
const vis = new Map(); let ghosts = [];
game.vis = vis; // 점검용
const fx = { parts: [], texts: [], shake: 0, flash: 0 };
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const n = game.board?.n || 4, small = innerWidth <= 900, multi = game.kind !== 'solo';
  const availW = innerWidth - (small ? 16 : 170 + (multi ? 250 : 0) + 70);
  const availH = innerHeight - (small ? 58 + 70 + (multi ? 120 : 0) + 20 : 60);
  BW = Math.max(240, Math.min(560, availW, availH));
  gap = BW * (n === 5 ? 0.022 : 0.026); cell = (BW - PAD * 2 - gap * (n - 1)) / n;
  cv.width = Math.round(BW * dpr); cv.height = Math.round(BW * dpr); cv.style.width = cv.style.height = `${BW}px`;
  sprites = new Map(); renderLadder();
}
addEventListener('resize', () => { if (game.mode !== 'title') layout(); });
const cx = (x) => PAD + x * (cell + gap) + cell / 2;
const ease = (k) => 1 - (1 - k) ** 3;
function rebuild() { vis.clear(); ghosts = []; for (const t of game.board.cells) if (t) vis.set(t.id, { lv: t.lv, fx: t.x, fy: t.y, tx: t.x, ty: t.y, t0: 0 }); }
// 엔진이 남긴 사건 → 움직임 · 소리 · 효과
function onEvents(B) {
  game.lastEv = B.ev.slice();
  const now = performance.now();
  for (const e of B.ev) {
    if (e.k === 'slide') {
      const next = new Map();
      for (const s of e.s) {
        const old = vis.get(s.id); const lv = old ? old.lv : B.cells.find((t) => t?.id === s.id)?.lv ?? 1;
        if (s.gone) ghosts.push({ lv, fx: s.fx, fy: s.fy, tx: s.tx, ty: s.ty, t0: now, until: now + SLIDE_MS });
        else next.set(s.id, { lv, fx: s.fx, fy: s.fy, tx: s.tx, ty: s.ty, t0: now });
      }
      vis.clear(); for (const [k, v] of next) vis.set(k, v);
      S.sfx('swish');
    } else if (e.k === 'merge') {
      const v = vis.get(e.id); if (v) { v.newLv = e.lv; v.popAt = now + SLIDE_MS; }
      const c = FLAVORS[e.lv].c;
      setTimeout(() => { burst(cx(e.x), cx(e.y), c, 8 + e.lv * 2); if (e.lv >= 7) { fx.shake = Math.min(1, 0.15 + (e.lv - 6) * 0.12); } }, SLIDE_MS);
      S.sfx('pop', Math.min(5, 1 + Math.floor(e.lv / 2)));
      if (e.lv > (game.ladderBest || 0)) { game.ladderBest = e.lv; renderLadder(e.lv); if (e.lv >= 6) { feed(`✨ 처음으로 ${FLAVORS[e.lv].n} 곰을 만들었어요!`, true); S.sfx('lvl'); } }
    } else if (e.k === 'spawn' || e.k === 'sugar') {
      vis.set(e.id, { lv: e.lv ?? SUGAR, fx: e.x, fy: e.y, tx: e.x, ty: e.y, t0: 0, born: now + SLIDE_MS * 0.8 });
      if (e.k === 'sugar') { fx.shake = Math.max(fx.shake, 0.3); S.sfx('bad'); }
    } else if (e.k === 'melt') {
      vis.delete(e.id); ghosts.push({ lv: SUGAR, fx: e.x, fy: e.y, tx: e.x, ty: e.y, t0: now, melt: now + SLIDE_MS, until: now + SLIDE_MS + 280 });
      setTimeout(() => burst(cx(e.x), cx(e.y), '#ffffff', 10, 200, true), SLIDE_MS); S.sfx('kill');
    } else if (e.k === 'burst') {
      vis.delete(e.id);
      setTimeout(() => { fx.flash = 1; fx.shake = 1; for (const c of RAINBOW_C) burst(cx(e.x), cx(e.y), c, 14, 600); fx.texts.push({ x: cx(e.x), y: cx(e.y), s: '젤리 대폭발! +5000', c: '#ffd84d', size: 30, life: 1.6 }); }, SLIDE_MS);
      S.sfx('win'); confetti(120);
    } else if (e.k === 'score') {
      bumpScore();
      if (e.combo >= 2) { comboBanner(`${e.combo} 콤보! +${e.gain}${e.combo >= 4 ? ' 🔥' : ''}`); S.sfx('ten'); }
    } else if (e.k === 'warn') { S.sfx('hurt'); renderWarn(); }
    else if (e.k === 'cancel') { feed(`🛡️ 들어오던 설탕 ${e.n}개를 막았어요!`, true); renderWarn(); }
    else if (e.k === 'undo') { rebuild(); bumpScore(); }
    else if (e.k === 'over') setTimeout(gameOver, 450);
  }
  B.ev.length = 0;
  // 혹시 빠진 곰이 있으면 (되돌리기 등) 제자리에
  for (const t of B.cells) if (t && !vis.has(t.id)) vis.set(t.id, { lv: t.lv, fx: t.x, fy: t.y, tx: t.x, ty: t.y, t0: 0 });
  renderWarn();
}
function drawTile(lv, x, y, s, alpha = 1) {
  const r = cell * (lv === SUGAR ? 0.36 : lv === RAINBOW ? 0.34 : 0.3 + Math.min(lv, KING) * 0.009);
  const sp = sprite(lv, r), w = sp.width / dpr;
  g.save(); g.translate(x, y); g.scale(s, s); if (alpha < 1) g.globalAlpha = alpha;
  g.drawImage(sp, -w / 2, -w / 2, w, w); g.restore();
}
function draw(now) {
  const B = game.board; if (!B) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, BW, BW);
  let sx = 0, sy = 0; if (fx.shake > 0) { sx = (Math.random() - 0.5) * fx.shake * 10; sy = (Math.random() - 0.5) * fx.shake * 10; }
  g.translate(sx, sy);
  // 판 · 칸
  g.fillStyle = 'rgba(40,20,80,.42)'; g.beginPath(); g.roundRect(0, 0, BW, BW, 22); g.fill();
  const n = B.n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.roundRect(PAD + x * (cell + gap), PAD + y * (cell + gap), cell, cell, cell * 0.2); g.fill(); }
  // 떠난 곰 (합쳐지며 사라지는 쪽 · 녹는 설탕)
  ghosts = ghosts.filter((q) => now < q.until);
  for (const q of ghosts) {
    const k = ease(Math.min(1, (now - q.t0) / SLIDE_MS)), x = q.fx + (q.tx - q.fx) * k, y = q.fy + (q.ty - q.fy) * k;
    const a = q.melt ? Math.max(0, 1 - (now - q.melt) / 280) : 1;
    drawTile(q.lv, cx(x), cx(y), q.melt && now > q.melt ? 1 + (1 - a) * 0.4 : 1, a);
  }
  // 곰들 (뒤 → 앞: 막 합쳐진 곰이 위에)
  const list = [...vis.values()].sort((a, b) => (a.popAt ? 1 : 0) - (b.popAt ? 1 : 0));
  for (const v of list) {
    const k = v.t0 ? ease(Math.min(1, (now - v.t0) / SLIDE_MS)) : 1;
    const x = v.fx + (v.tx - v.fx) * k, y = v.fy + (v.ty - v.fy) * k;
    let s = 1;
    if (v.born) { const b = (now - v.born) / 180; if (b < 0) continue; s = b < 1 ? ease(b) * (1 + 0.15 * Math.sin(b * Math.PI)) : 1; if (b >= 1) v.born = 0; }
    if (v.popAt && now >= v.popAt) { if (v.newLv != null) { v.lv = v.newLv; v.newLv = null; } const p = (now - v.popAt) / POP_MS; s = p < 1 ? 1 + 0.28 * Math.sin(p * Math.PI) : 1; if (p >= 1) v.popAt = 0; }
    // 들썩들썩 (살아 있는 젤리 느낌)
    const wob = v.lv === SUGAR ? 0 : Math.sin(now / 300 + v.tx * 1.3 + v.ty * 0.7) * 0.015;
    // 칸 바탕: 맛 색으로 은은하게
    if (v.lv !== SUGAR) { g.fillStyle = v.lv === RAINBOW || v.lv === KING ? 'rgba(255,240,180,.22)' : `${FLAVORS[v.lv].c}33`; const c = cell * s; g.beginPath(); g.roundRect(cx(x) - c / 2, cx(y) - c / 2, c, c, cell * 0.2); g.fill(); }
    drawTile(v.lv, cx(x), cx(y), s + wob);
    // 단계 표시 (작게)
    if (v.lv >= 1 && v.lv <= KING && cell > 54) { g.font = `${Math.round(cell * 0.15)}px Jua`; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(`Lv${v.lv}`, cx(x) + cell * 0.44, cx(y) + cell * 0.46); }
  }
  // 효과
  for (const p of fx.parts) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); if (p.sq) g.rect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); else g.arc(p.x, p.y, p.s, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const t of fx.texts) { g.globalAlpha = Math.max(0, Math.min(1, t.life * 1.5)); g.font = `${t.size}px Jua`; g.lineWidth = 6; g.strokeStyle = 'rgba(60,20,90,.6)'; g.strokeText(t.s, t.x, t.y); g.fillStyle = t.c; g.fillText(t.s, t.x, t.y); }
  g.globalAlpha = 1;
  if (fx.flash > 0) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = `rgba(255,255,255,${fx.flash * 0.6})`; g.fillRect(0, 0, BW, BW); }
}
function burst(x, y, c, n, sp = 280, sq = false) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = sp * (0.3 + Math.random()); fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, s: 2 + Math.random() * 4, c, life: 0.6 + Math.random() * 0.4, sq }); } }
function stepFx(dt) {
  for (const p of fx.parts) { p.vy += 800 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.5; }
  for (const t of fx.texts) { t.y -= 40 * dt; t.life -= dt * 0.9; }
  fx.parts = fx.parts.filter((p) => p.life > 0); fx.texts = fx.texts.filter((p) => p.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 2.5); fx.flash = Math.max(0, fx.flash - dt * 2);
}
function comboBanner(s) { const el = $('combo'); el.textContent = s; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(el.t); el.t = setTimeout(() => el.classList.add('hidden'), 900); }
function bumpScore() { const el = $('score'); el.textContent = game.board.score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function renderWarn() { const n = game.board?.incoming || 0, el = $('warn'); el.classList.toggle('hidden', !n); if (n) el.innerHTML = `⚠️ 설탕 덩어리 <b>${n}</b>개가 날아와요! <small>다음에 밀 때 떨어져요 · 큰 곰을 만들면 막아요</small>`; }
function renderLadder(fresh) {
  const el = $('ladder'); const got = game.ladderBest || 0;
  if (el.children.length !== KING) { el.innerHTML = ''; for (let lv = 1; lv <= KING; lv++) { const c = document.createElement('canvas'); c.width = c.height = 64; c.title = `${lv}단계 ${FLAVORS[lv].n}`; const x = c.getContext('2d'); x.translate(32, 34); drawJelly(x, 21, lv); el.appendChild(c); } }
  [...el.children].forEach((c, i) => { c.classList.toggle('got', i + 1 <= got); c.classList.toggle('new', i + 1 === fresh); });
}
function renderUndo() { const b = $('undo-btn'); b.classList.toggle('hidden', game.kind !== 'solo'); b.disabled = !game.board?.undo || game.undoUsed; b.textContent = game.undoUsed ? '↩️ 되돌리기 (다 썼어요)' : '↩️ 되돌리기 (1번)'; }

// ---------- 입력: 화살표 · WASD · 밀기(스와이프) ----------
const canPlay = () => game.mode === 'play' && !game.out && performance.now() >= game.startAt;
let lastMove = 0;
function push(dir) {
  if (!canPlay()) return;
  const now = performance.now(); if (now - lastMove < 70) return; // 너무 빠른 연타는 한 박자 쉬고
  const B = game.board;
  if (!B.move(dir, game.kind === 'solo' && !game.undoUsed)) { S.sfx('tick'); return; }
  lastMove = now; onEvents(B); renderUndo();
  if (game.kind !== 'solo') sendBoard();
}
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'KeyM') muteBtn();
  if (game.mode !== 'play') return;
  if (KEYS[e.code]) { e.preventDefault(); S.unlock(); push(KEYS[e.code]); }
  if (e.code === 'KeyZ') doUndo();
});
let sw = null;
const wrap = $('board-wrap');
wrap.addEventListener('pointerdown', (e) => { S.unlock(); sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; wrap.setPointerCapture(e.pointerId); });
wrap.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) < 26) return;
  push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); sw = null;
});
wrap.addEventListener('pointerup', () => { sw = null; });
wrap.addEventListener('pointercancel', () => { sw = null; });
function doUndo() { if (game.kind !== 'solo' || game.undoUsed || !game.board?.undo || game.mode !== 'play') return; game.board.doUndo(); game.undoUsed = true; onEvents(game.board); renderUndo(); S.sfx('page'); }
$('undo-btn').onclick = () => doUndo();

// ---------- 흐름 ----------
let last = performance.now(), lastSec = -1, lastSent = -1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.mode === 'title' || !game.board) return;
  stepFx(dt); draw(now);
  if (game.kind !== 'solo' && game.mode !== 'over') {
    const left = Math.max(0, game.endAt - now), total = game.time * 1000;
    $('timebar').firstElementChild.style.width = `${Math.min(100, (left / total) * 100)}%`;
    $('timebar').classList.toggle('hurry', left < 15000 && left > 0);
    const sec = Math.ceil(left / 1000); if (sec !== lastSec && sec <= 5 && sec > 0 && now >= game.startAt) S.sfx('clock'); lastSec = sec;
    if (now >= game.endAt && game.mode === 'play') { game.mode = 'wait'; S.stopMusic(); shell.toast('⏰ 시간 끝! 결과를 모으는 중…', 2000); }
    if (game.mode === 'play' && !game.out) netTick(now);
  }
}
requestAnimationFrame(frame);
function sendBoard() { shell.send({ t: 'bd', b: game.board.snap() }); }
function netTick(now) {
  const B = game.board;
  if (B.score !== lastSent) { lastSent = B.score; shell.send({ t: 'sc', s: B.score, lv: B.best }); const me = game.players.get(game.myId); if (me) me.score = B.score; renderRivals(); }
  if (now - (game.atkT || 0) > 250) { const n = B.takeAtk(); if (n) { game.atkT = now; shell.send({ t: 'atk', n }); feed(`🍬 설탕 ${n}개를 보냈어요!`, true); S.sfx('zap'); } }
}
function countdown(ms) {
  const el = $('count'), n = $('count-n');
  el.classList.remove('hidden');
  const t0 = performance.now();
  const tickC = () => {
    const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000);
    if (left <= 0) { n.textContent = 'GO!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 500); return; }
    if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); }
    setTimeout(tickC, 60);
  };
  tickC();
}
function clearBoard() { const el = document.getElementById('ov-board'); if (el) el.innerHTML = ''; ranking.hideSave(); }
function begin(kind, seed, size, ms, sp = game.pick) {
  clearBoard();
  game.kind = kind; game.mode = 'play'; game.out = false; game.size = size; game.undoUsed = false;
  game.board = new Board(seed, size, sp); game.ladderBest = 0; lastSent = -1;
  fx.parts = []; fx.texts = []; fx.shake = 0; fx.flash = 0;
  game.startAt = performance.now() + ms;
  shell.hideScreens(); $('game').classList.remove('hidden');
  $('side-r').classList.toggle('hidden', kind === 'solo');
  $('timebar').classList.toggle('hidden', kind === 'solo');
  $('restart-btn').classList.toggle('hidden', kind !== 'solo');
  $('outmsg').classList.add('hidden'); $('feed').innerHTML = '';
  $('score').textContent = 0;
  $('best').textContent = kind === 'solo' && bestOf[size] ? `내 최고 ${bestOf[size]}` : `${size}×${size} 판`;
  game.board.ev.length = 0; layout(); rebuild(); renderUndo(); renderWarn();
  // 처음 두 곰도 톡 하고 생긴다
  for (const v of vis.values()) v.born = performance.now() + Math.min(ms, 600);
  countdown(ms); S.sfx('start'); S.music('apple');
}
function startSolo() { S.unlock(); begin('solo', (Math.random() * 2 ** 31) | 0, game.pick.size, 1600); }
function practice() { S.unlock(); shell.sendAfterHello({ t: 'practice', opts: { time: game.pick.time, bots: Math.max(1, game.pick.bots), size: game.pick.size, star: game.pick.star, sugar: game.pick.sugar } }); }
function startMulti(m) {
  game.myId = shell.myId; game.players.clear();
  for (const mem of m.members) game.players.set(mem.id, { ...mem, score: 0, lv: 0, out: false, b: [] });
  game.time = m.time || m.opts?.time || 180;
  begin('multi', m.seed, m.size || m.opts?.size || 4, m.in, m.sp || m.opts || {});
  game.endAt = performance.now() + (m.endAt ?? (m.in + game.time * 1000));
  renderRivals(true);
  setTimeout(() => { if (game.mode === 'play') shell.toast('🍬 포도(6단계) 이상 곰이나 3콤보를 만들면 설탕 덩어리가 상대 판으로 날아가요!', 3200); }, m.in);
}
function gameOver() {
  S.stopMusic(); S.sfx('lose');
  if (game.kind === 'solo') { game.mode = 'over'; setTimeout(endSolo, 900); fx.shake = 0.6; return; }
  game.out = true; shell.send({ t: 'sc', s: game.board.score, lv: game.board.best }); shell.send({ t: 'out' });
  $('outmsg').innerHTML = `😵 더 밀 곳이 없어요!<small>점수 ${game.board.score} · 다른 곰돌이를 구경해요</small>`; $('outmsg').classList.remove('hidden');
}
function feed(s, me) { const d = document.createElement('div'); d.textContent = s; if (me) d.className = 'me'; $('feed').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('feed').children.length > 3) $('feed').firstChild.remove(); }
// 라이벌: 작은 판 + 점수
function renderRivals(full) {
  const el = $('rivals');
  const list = [...game.players.values()].sort((a, b) => b.score - a.score);
  if (full || el.children.length !== list.length) {
    el.classList.toggle('many', list.length > 4);
    el.innerHTML = list.map((p) => `<div class="rv${p.id === game.myId ? ' me' : ''}" data-id="${p.id}"><canvas width="100" height="100"></canvas><div class="nm">${faceHtml(p, 18)}${p.bot ? '🤖' : ''}${esc(p.name)}</div><div class="sc">0</div></div>`).join('');
  }
  const byId = new Map([...el.children].map((d) => [+d.dataset.id, d]));
  list.forEach((p, i) => { const d = byId.get(p.id); if (!d) return; d.style.order = i; d.querySelector('.sc').textContent = `${i + 1}등 · ${p.score}`; d.classList.toggle('out', !!p.out); drawMini(d.querySelector('canvas'), p.id === game.myId ? game.board?.snap() || [] : p.b || []); });
}
function drawMini(c, b) {
  const x = c.getContext('2d'), n = Math.round(Math.sqrt(b.length)) || game.size || 4, w = c.width, s = w / n;
  x.clearRect(0, 0, w, w); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 0, w, w);
  b.forEach((lv, i) => {
    if (lv < 0) return; const px = (i % n) * s, py = Math.floor(i / n) * s;
    x.fillStyle = lv === SUGAR ? '#f4f0fb' : lv === RAINBOW || lv === KING ? '#ffcf33' : FLAVORS[lv]?.c || '#ccc';
    x.beginPath(); x.roundRect(px + 2, py + 2, s - 4, s - 4, lv === SUGAR ? 2 : s * 0.4); x.fill();
  });
}
let rvT = 0;
setInterval(() => { if (game.kind !== 'solo' && game.mode !== 'title' && game.mode !== 'over' && performance.now() - rvT > 380) { rvT = performance.now(); renderRivals(); } }, 400);

const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellyslide', title: '🧸 젤리 슬라이드', subtitle: '판을 밀어 같은 젤리곰끼리 부딪히면 한 단계 큰 곰으로!<br>🍬 설탕 덩어리는 옆에서 합쳐 녹이고 · 🌈 무지개 젤리는 아무 곰과 합쳐져요', wsPath: '/slide-ws', max: 8,
  multiLabel: '👥 같이 하기', roomIcon: '🧸', startLabel: '🧸 다 같이 시작!',
  keysHelp: '← → ↑ ↓ · WASD 로 밀기 · 휴대폰은 판을 손가락으로 쓱 · Z 되돌리기(혼자 하기 · 한 번) · 한 번에 여러 번 합치면 콤보 보너스',
  buttons: [{ id: 'solo-btn', label: '🧸 혼자 하기 <small>최고 점수 도전</small>', onClick: () => startSolo() }, { id: 'bot-btn', label: '🤖 봇과 대결 <small>설탕 덩어리 주고받기</small>', cls: 'ghost', onClick: () => practice() }],
  screens: ['over', 'board-screen'],
  extraRow: [{ label: '🏆 순위표', onClick: () => ranking.open(`s${game.pick.size}`) }],
  describe: (o = {}) => `${o.size || 4}×${o.size || 4} · ⏱️ ${Math.round((o.time || 180) / 60)}분 · 🤖 봇 ${o.bots || 0}`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n }), true) },
  onStart: (m) => startMulti(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title' && game.kind !== 'solo') toTitle(); },
});
const ranking = new Ranking({ shell, api: '/api/slide', boards: [{ id: 's4', label: '4×4 판' }, { id: 's5', label: '5×5 판' }], title: '🏆 젤리 슬라이드 순위표', nickKey: 'jellyslide.nick' });
shell.pickOpts = () => ({ ...game.pick });
shell.on('sc', (m) => { const p = game.players.get(m.id); if (!p || m.id === game.myId) return; p.score = m.s; p.lv = m.lv; });
shell.on('bd', (m) => { const p = game.players.get(m.id); if (p) p.b = m.b; });
shell.on('out', (m) => { const p = game.players.get(m.id); if (!p) return; p.out = true; if (m.id !== game.myId) feed(`💥 ${p.name} 님의 판이 꽉 찼어요!`); renderRivals(); });
shell.on('sugar', (m) => { if (game.out || !game.board) return; game.board.addSugar(m.n); onEvents(game.board); const p = game.players.get(m.from); feed(`⚠️ ${p ? p.name : '누군가'} 님이 설탕 ${m.n}개를 보냈어요!`, true); });
shell.on('atk', (m) => { if (m.to === game.myId || m.from === game.myId) return; const a = game.players.get(m.from), b = game.players.get(m.to); if (a && b) feed(`🍬 ${a.name} → ${b.name} 설탕 ${m.n}개`); const d = document.querySelector(`.rv[data-id="${m.to}"]`); if (d) { d.classList.remove('hit'); void d.offsetWidth; d.classList.add('hit'); } });
shell.on('gone', (m) => { game.players.delete(m.id); renderRivals(true); });
function optsUI(el, o, editable, set, multi) {
  el.innerHTML = `<div class="seg size-seg">${SIZES.map((n) => `<button data-z="${n}" class="${(o.size || 4) === n ? 'on' : ''}" ${editable ? '' : 'disabled'}>${n}×${n}<small>${n === 4 ? '빠르고 아슬아슬' : '넓게 오래오래'}</small></button>`).join('')}</div>
    ${multi ? `<div class="seg time-seg">${TIMES.map((t) => `<button data-t="${t}" class="${t === o.time ? 'on' : ''}" ${editable ? '' : 'disabled'}>⏱️ ${t / 60}분</button>`).join('')}</div>
    <div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div>` : ''}
    <div class="seg tog-seg">
      <button data-s="star" class="${o.star !== false ? 'on' : ''}" ${editable ? '' : 'disabled'} title="어떤 곰과 부딪혀도 그 곰을 한 단계 올려요">🌈 무지개 젤리<small>${o.star !== false ? '켜짐' : '꺼짐'}</small></button>
      <button data-s="sugar" class="${o.sugar !== false ? 'on' : ''}" ${editable ? '' : 'disabled'} title="가끔 움직이지 않는 설탕 덩어리가 떨어져요 · 바로 옆에서 합치면 녹아요">🍬 설탕 덩어리<small>${o.sugar !== false ? '켜짐' : '꺼짐'}</small></button>
    </div>`;
  el.querySelectorAll('[data-z]').forEach((b) => { b.onclick = () => set({ size: +b.dataset.z }); });
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => set({ time: +b.dataset.t }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(7, (o.bots || 0) + +b.dataset.b)) }); });
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => set({ [b.dataset.s]: o[b.dataset.s] === false }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }, true); }

// ---------- 결과 ----------
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId), top = m.rank[0];
  $('ov-title').textContent = top ? `🏆 ${top.name} 우승!${top.last ? ' (마지막 생존)' : ''}` : '끝!';
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · ${mine.score}점 · 보낸 설탕 ${mine.sent}개` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${e.bot ? '🤖 ' : ''}${esc(e.name)}${e.out ? ' 😵' : ''}</span><span class="sc">${e.score}<small>점 · ${e.lv ? FLAVORS[e.lv].n : '-'}</small></span></div>`).join('');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1) { confetti(); S.sfx('win'); }
  shell.show('over');
}
function endSolo() {
  const B = game.board, size = game.size, prev = bestOf[size] || 0, isBest = B.score > prev;
  if (isBest) { bestOf[size] = B.score; store.set(BEST_KEY, JSON.stringify(bestOf)); }
  $('game').classList.add('hidden');
  $('ov-title').textContent = `🧸 ${B.score}점`;
  $('ov-me').textContent = isBest ? `🎉 ${size}×${size} 새 최고 기록!` : `${size}×${size} 내 최고 ${prev}점`;
  $('ov-rank').innerHTML = `<div class="res-row me"><span class="rk">🍬</span><span></span><span class="nm">가장 큰 곰</span><span class="sc">${B.best ? FLAVORS[B.best].n : '-'}<small>${B.best}단계</small></span></div><div class="res-row"><span class="rk">✨</span><span></span><span class="nm">합친 횟수 · 민 횟수</span><span class="sc">${B.merges}<small>번 · ${B.moves}번</small></span></div>`;
  $('again-btn').textContent = '🔁 한 판 더';
  if (isBest && prev) { confetti(); S.sfx('win'); }
  shell.show('over');
  ranking.submit(`s${size}`, B.score, $('ov-board'), (t, best) => { $('ov-me').textContent += ` · ${t}`; if (best) confetti(); });
}
$('again-btn').onclick = () => { if (game.kind === 'solo') return startSolo(); if (game.lastPractice) return practice(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
$('restart-btn').onclick = () => startSolo();
function quit() { if (game.kind !== 'solo') { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() { game.mode = 'title'; game.board = null; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = () => muteBtn();
$('b-quit').onclick = () => quit();
$('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
renderTitleOpts();
shell.boot();
