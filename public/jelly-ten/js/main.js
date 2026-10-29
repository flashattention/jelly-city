// 젤리텐: 숫자 곰젤리를 네모로 묶어 합이 10이 되면 팡! (혼자 · 봇과 대결 · 같이 최대 12명)
//   같이 하기는 '각자 판' (같은 판을 따로따로 겨루기) 과 '한 판 같이' (판 하나를 다 같이 · 먼저 묶으면 임자 · 내 색으로 물든다)
import '../../shared/js/renamed.js'; // 옛 이름으로 저장된 값 옮기기 (맨 먼저)
import { account, store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { COLS, ROWS, TIMES, makeBoard, sumRect, tryMove } from './board.js';

const MODES = [['race', '🍎 각자 판', '같은 판을 따로따로'], ['shared', '🍏 한 판 같이', '판 하나를 다 같이 · 먼저 묶으면 임자']];

const $ = (id) => document.getElementById(id);
const S = makeSound('jellyten');
const PICK_KEY = 'jellyten.pick', ANON_KEY = 'dreamrunner.anon';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.apple = {
  mode: 'title', kind: 'solo', board: null, score: 0, time: 120, startAt: 0, endAt: 0, players: new Map(), myId: 0,
  pick: { time: TIMES.includes(pick0.time) ? pick0.time : 120, bots: pick0.bots ?? 2, mode: pick0.mode === 'shared' ? 'shared' : 'race' },
  shared: false, own: null, drags: new Map(),
};

// 배경 거품
for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// ---------- 곰젤리 그림 ----------
const COLORS = ['#ff5c7a', '#ff9a3c', '#ffc23c', '#6fd36b', '#33c2b0', '#4aa3ff', '#8c7bff', '#d77bff', '#ff6fb5'];
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
// 말랑한 젤리 사탕: 반투명 몸 · 위쪽 광택 · 아래 은은한 빛 · 설탕 반짝이 · 볼터치 · 가운데 숫자
function drawGummy(g, s, col, n) {
  const r = s * 0.43;
  g.save(); g.translate(s / 2, s / 2);
  // 바닥 그림자
  g.fillStyle = 'rgba(80,40,110,.16)'; g.beginPath(); g.ellipse(0, r * 0.98, r * 0.9, r * 0.2, 0, 0, Math.PI * 2); g.fill();
  // 몸: 위가 둥근 젤리 틀 모양
  const body = new Path2D(); body.roundRect(-r, -r * 0.9, r * 2, r * 1.88, [r * 0.78, r * 0.78, r * 0.5, r * 0.5]);
  const gr = g.createLinearGradient(0, -r, 0, r);
  gr.addColorStop(0, shade(col, 1.32)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, 0.78));
  g.globalAlpha = 0.93; g.fillStyle = gr; g.fill(body); g.globalAlpha = 1;
  // 속에서 비치는 빛 (반투명 젤리 느낌)
  const glow = g.createRadialGradient(0, r * 0.45, r * 0.1, 0, r * 0.35, r * 1.1);
  glow.addColorStop(0, 'rgba(255,255,255,.42)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fill(body);
  // 테두리
  g.lineWidth = Math.max(1, r * 0.07); g.strokeStyle = shade(col, 0.62); g.globalAlpha = 0.55; g.stroke(body); g.globalAlpha = 1;
  // 광택
  g.fillStyle = 'rgba(255,255,255,.78)'; g.beginPath(); g.ellipse(-r * 0.42, -r * 0.5, r * 0.28, r * 0.14, -0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(-r * 0.12, -r * 0.66, r * 0.07, 0, Math.PI * 2); g.fill();
  // 설탕 반짝이 (숫자마다 같은 자리)
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 6; i++) { const a = (n * 1.7 + i * 2.4) % (Math.PI * 2), d = r * (0.45 + ((i * 37 + n * 11) % 40) / 100); g.beginPath(); g.arc(Math.cos(a) * d * 0.9, Math.sin(a) * d * 0.8 + r * 0.05, r * 0.035, 0, Math.PI * 2); g.fill(); }
  // 볼터치
  g.fillStyle = 'rgba(255,120,160,.33)';
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * r * 0.62, r * 0.42, r * 0.17, r * 0.1, 0, 0, Math.PI * 2); g.fill(); }
  // 숫자
  g.font = `${Math.round(r * 1.12)}px Jua, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = r * 0.2; g.strokeStyle = shade(col, 0.5); g.strokeText(String(n), 0, r * 0.1);
  g.fillStyle = '#fff'; g.fillText(String(n), 0, r * 0.1);
  g.restore();
}

// ---------- 판 그리기 ----------
const cv = $('board'), g = cv.getContext('2d');
let cell = 40, pad = 14, dpr = 1, sprites = [];
const fx = { flyers: [], parts: [], texts: [], splats: [] };
let sel = null, selRc = null, selSum = 0;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const small = innerWidth <= 900;
  const availW = innerWidth - (small ? 16 : 150 + (game.kind === 'solo' ? 0 : 220) + 48 + 28 + 16 * 2);
  const availH = innerHeight - (small ? 60 + 70 + (game.kind === 'solo' ? 0 : 110) : 40);
  cell = Math.max(18, Math.min(42, Math.floor(Math.min((availW - 28) / COLS, (availH - 28) / ROWS)))); // 젤리는 작고 촘촘하게
  pad = Math.round(cell * 0.35);
  const w = cell * COLS + pad * 2, h = cell * ROWS + pad * 2;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  $('timebar').style.height = `${h}px`;
  game.geom = { cell, pad }; // 점검용
  sprites = new Map(); // 색 × 숫자 젤리 그림 (쓸 때 만든다)
}
window.addEventListener('resize', () => { if (game.mode !== 'title') layout(); });
// 젤리 색은 숫자와 상관없이 칸마다 랜덤 (판을 새로 깔 때 정한다)
const sprSize = () => Math.ceil(cell * 1.0);
function spr(c, n) {
  const key = c * 10 + n;
  let k = sprites.get(key);
  if (!k) { const s = sprSize(); k = document.createElement('canvas'); k.width = k.height = Math.ceil(s * dpr); const kg = k.getContext('2d'); kg.scale(dpr, dpr); drawGummy(kg, s, COLORS[c], n); sprites.set(key, k); }
  return k;
}
const tintAt = (x, y) => game.tint?.[y * COLS + x] ?? 0;
const cx = (x) => pad + (x + 0.5) * cell, cy = (y) => pad + (y + 0.5) * cell;
function rcOf(s) {
  if (!s) return null;
  const minX = Math.min(s.x0, s.x1), maxX = Math.max(s.x0, s.x1), minY = Math.min(s.y0, s.y1), maxY = Math.max(s.y0, s.y1);
  const i0 = Math.max(0, Math.ceil((minX - pad) / cell - 0.5)), i1 = Math.min(COLS - 1, Math.floor((maxX - pad) / cell - 0.5));
  const j0 = Math.max(0, Math.ceil((minY - pad) / cell - 0.5)), j1 = Math.min(ROWS - 1, Math.floor((maxY - pad) / cell - 0.5));
  return i0 > i1 || j0 > j1 ? null : [i0, j0, i1, j1];
}
const inRc = (rc, x, y) => rc && x >= rc[0] && x <= rc[2] && y >= rc[1] && y <= rc[3];
function draw(t) {
  const W = cv.width / dpr, H = cv.height / dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 판 바탕: 연한 크림 젤리
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#fff6fb'); bg.addColorStop(1, '#f1ebff');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(180,140,220,.12)';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { g.beginPath(); g.roundRect(cx(x) - cell * 0.3, cy(y) - cell * 0.3, cell * 0.6, cell * 0.6, cell * 0.22); g.fill(); }
  // 위에서 흘러내리는 딸기 젤리 띠
  const drip = g.createLinearGradient(0, 0, 0, pad * 1.6); drip.addColorStop(0, 'rgba(255,120,180,.85)'); drip.addColorStop(1, 'rgba(255,160,205,.6)');
  g.fillStyle = drip; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0);
  for (let x = W; x >= 0; x -= cell * 0.5) { const d = pad * (0.35 + 0.35 * Math.abs(Math.sin(x * 0.07))) + Math.sin(t / 800 + x * 0.05) * 2; g.lineTo(x, d); }
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(W * 0.12, pad * 0.18, W * 0.06, pad * 0.08, 0, 0, Math.PI * 2); g.fill();
  for (const sp of fx.splats) { g.globalAlpha = Math.max(0, sp.life) * 0.32; g.fillStyle = sp.c; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = sp.r * (0.75 + ((i * 37) % 10) / 25); g.lineTo(sp.x + Math.cos(a) * rr, sp.y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  g.globalAlpha = 1;
  const B = game.board;
  // 한 판 같이: 내가 · 친구가 터뜨린 칸은 그 사람 색으로 물든다
  if (game.shared && game.own) {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const id = game.own[y * COLS + x]; if (!id) continue;
      const p = game.players.get(id); if (!p) continue;
      g.fillStyle = p.color || '#ccc'; g.globalAlpha = id === game.myId ? 0.42 : 0.28;
      g.beginPath(); g.roundRect(cx(x) - cell * 0.47, cy(y) - cell * 0.47, cell * 0.94, cell * 0.94, cell * 0.24); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (B) {
    const s = sprSize();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = B[y * COLS + x]; if (!v) continue;
      const on = inRc(selRc, x, y);
      const ph = on ? Math.sin(t / 70 + x + y) * 0.06 : Math.sin(t / 520 + x * 0.7 + y * 1.3) * 0.025;
      const kx = (on ? 1.1 : 1) * (1 + ph), ky = (on ? 1.1 : 1) * (1 - ph), w = s * kx, h = s * ky;
      if (on) { g.save(); g.shadowColor = selSum === 10 ? 'rgba(80,230,170,.95)' : 'rgba(255,255,255,.9)'; g.shadowBlur = 14; }
      g.drawImage(spr(tintAt(x, y), v), cx(x) - w / 2, cy(y) + s / 2 - h - (on ? 3 : 0), w, h); // 바닥에 붙어서 출렁
      if (on) g.restore();
    }
  }
  // 친구들이 지금 드래그하는 네모 (그 사람 색 · 이름표)
  if (game.shared) for (const [id, d] of game.drags) {
    const p = game.players.get(id); if (!p || !d.r || t - d.at > 1500) continue;
    const [x0, y0, x1, y1] = d.r, X = cx(x0) - cell / 2, Y = cy(y0) - cell / 2, w = (x1 - x0 + 1) * cell, h = (y1 - y0 + 1) * cell;
    g.strokeStyle = p.color || '#999'; g.lineWidth = 2.5; g.setLineDash([6, 5]); g.globalAlpha = 0.85;
    g.beginPath(); g.roundRect(X, Y, w, h, 10); g.stroke(); g.setLineDash([]);
    g.font = `${Math.max(11, cell * 0.36)}px Jua`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    const label = `${p.bot ? '🤖' : ''}${p.name}`, tw = g.measureText(label).width + 10;
    g.fillStyle = p.color || '#999'; g.beginPath(); g.roundRect(X, Y - cell * 0.44, tw, cell * 0.42, 6); g.fill();
    g.fillStyle = '#fff'; g.fillText(label, X + 5, Y - 2); g.globalAlpha = 1;
  }
  // 고르는 네모
  if (sel) {
    const x = Math.min(sel.x0, sel.x1), y = Math.min(sel.y0, sel.y1), w = Math.abs(sel.x1 - sel.x0), h = Math.abs(sel.y1 - sel.y0);
    const col = selSum === 10 ? '80,220,160' : selSum > 10 ? '255,110,120' : '120,150,255';
    g.fillStyle = `rgba(${col},.16)`; g.strokeStyle = `rgba(${col},.95)`; g.lineWidth = 3; g.setLineDash([10, 6]); g.lineDashOffset = -t / 30;
    g.beginPath(); g.roundRect(x, y, w, h, 12); g.fill(); g.stroke(); g.setLineDash([]);
  }
  // 터진 곰젤리 · 알갱이 · 점수 글자
  const s = sprSize();
  for (const f of fx.flyers) { g.save(); g.globalAlpha = Math.max(0, f.life); g.translate(f.x, f.y); g.rotate(f.r); g.drawImage(spr(f.c, f.v), -s / 2 * f.k, -s / 2 * f.k, s * f.k, s * f.k); g.restore(); }
  for (const p of fx.parts) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  for (const tx of fx.texts) {
    g.globalAlpha = Math.max(0, tx.life); g.font = `${Math.round(cell * (0.8 + tx.n * 0.06))}px Jua`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(60,20,90,.55)'; g.strokeText(`+${tx.n}`, tx.x, tx.y); g.fillStyle = tx.n >= 4 ? '#ffb300' : '#ff5ca8'; g.fillText(`+${tx.n}`, tx.x, tx.y);
  }
  g.globalAlpha = 1;
}
function stepFx(dt) {
  for (const f of fx.flyers) { f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += f.vr * dt; f.life -= dt * 1.1; f.k = Math.min(1.3, f.k + dt * 0.8); }
  for (const p of fx.parts) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.6; }
  for (const t of fx.texts) { t.y -= 60 * dt; t.life -= dt * 1.1; }
  for (const sp of fx.splats) sp.life -= dt * 0.6;
  fx.splats = fx.splats.filter((sp) => sp.life > 0);
  fx.flyers = fx.flyers.filter((f) => f.life > 0); fx.parts = fx.parts.filter((p) => p.life > 0); fx.texts = fx.texts.filter((t) => t.life > 0);
}
function popFx(rc, cells) {
  for (const [x, y, v] of cells) {
    const ci = tintAt(x, y);
    fx.flyers.push({ x: cx(x), y: cy(y), vx: (Math.random() - 0.5) * 360, vy: -380 - Math.random() * 320, r: 0, vr: (Math.random() - 0.5) * 10, v, c: ci, life: 1, k: 1 });
    fx.splats.push({ x: cx(x), y: cy(y), r: cell * 0.42, c: COLORS[ci], life: 1 });
    for (let i = 0; i < 7; i++) fx.parts.push({ x: cx(x), y: cy(y), vx: (Math.random() - 0.5) * 520, vy: -Math.random() * 520, r: 2 + Math.random() * 4, c: COLORS[ci], life: 0.8 + Math.random() * 0.4 });
  }
  fx.texts.push({ x: (cx(rc[0]) + cx(rc[2])) / 2, y: (cy(rc[1]) + cy(rc[3])) / 2, n: cells.length, life: 1 });
}

// ---------- 입력 ----------
const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const canPlay = () => game.mode === 'play' && performance.now() >= game.startAt && performance.now() < game.endAt;
function updateSel() {
  const prev = selSum;
  selRc = rcOf(sel); selSum = selRc ? sumRect(game.board, selRc).s : 0;
  if (selSum !== prev) { S.sfx(selSum === 10 ? 'ten' : 'tick', Math.min(10, selSum)); }
}
cv.addEventListener('pointerdown', (e) => { if (!canPlay()) return; S.unlock(); cv.setPointerCapture(e.pointerId); const p = local(e); sel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; updateSel(); });
let drSent = 0, drLast = '';
function sendDrag(rc) { if (!game.shared) return; const k = rc ? rc.join() : ''; const now = performance.now(); if (k === drLast || (rc && now - drSent < 100)) return; drLast = k; drSent = now; shell.send({ t: 'dr', r: rc }); }
cv.addEventListener('pointermove', (e) => { if (!sel) return; const p = local(e); sel.x1 = p.x; sel.y1 = p.y; updateSel(); sendDrag(selRc); });
const release = () => {
  if (!sel) return;
  const rc = selRc; sel = null; selRc = null; sendDrag(null);
  if (rc && canPlay() && game.shared && sumRect(game.board, rc).s === 10) { shell.send({ t: 'mv', r: rc }); selSum = 0; return; } // 한 판 같이: 서버가 먼저 온 사람에게 준다 ('clr')
  if (rc && canPlay() && sumRect(game.board, rc).s === 10) {
    const cells = [];
    for (let y = rc[1]; y <= rc[3]; y++) for (let x = rc[0]; x <= rc[2]; x++) { const v = game.board[y * COLS + x]; if (v) cells.push([x, y, v]); }
    const n = tryMove(game.board, rc);
    if (n) {
      game.score += n; popFx(rc, cells); S.sfx('pop', n);
      const el = $('score'); el.textContent = game.score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      if (game.kind !== 'solo') { shell.send({ t: 'mv', r: rc }); const me = game.players.get(game.myId); if (me) { me.score = game.score; renderLive(game.myId); } }
    }
  } else if (selSum > 0) S.sfx('bad');
  selSum = 0;
};
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);

// ---------- 흐름 ----------
let last = performance.now(), lastSec = -1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.mode === 'title') return;
  stepFx(dt);
  draw(now);
  if (game.mode !== 'play') return;
  const left = Math.max(0, game.endAt - now), total = game.time * 1000;
  $('timebar').firstElementChild.style.height = `${Math.min(100, (left / total) * 100)}%`;
  $('timebar').classList.toggle('hurry', left < 10000 && left > 0);
  const sec = Math.ceil(left / 1000);
  if (sec !== lastSec && sec <= 5 && sec > 0 && now >= game.startAt) S.sfx('clock');
  lastSec = sec;
  if (now >= game.endAt) timeUp();
}
requestAnimationFrame(frame);
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
function begin(kind, seed, time, ms) {
  game.kind = kind; game.mode = 'play'; game.time = time; game.score = 0; game.board = makeBoard(seed);
  game.tint = Uint8Array.from({ length: COLS * ROWS }, () => Math.floor(Math.random() * COLORS.length));
  game.own = game.shared ? new Array(COLS * ROWS).fill(0) : null; game.drags.clear();
  game.startAt = performance.now() + ms; game.endAt = game.startAt + time * 1000;
  fx.flyers = []; fx.parts = []; fx.texts = []; fx.splats = []; sel = null; selRc = null; selSum = 0;
  shell.hideScreens(); $('game').classList.remove('hidden');
  $('side-r').classList.toggle('hidden', kind === 'solo');
  $('restart-btn').classList.toggle('hidden', kind !== 'solo');
  $('score').textContent = 0;
  $('best').textContent = kind === 'solo' && game.bestOf?.[time] ? `내 최고 ${game.bestOf[time]}` : '';
  layout(); countdown(ms); S.sfx('start'); S.music('apple');
}
function startSolo() { S.unlock(); game.shared = false; begin('solo', (Math.random() * 2 ** 31) | 0, game.pick.time, 3000); }
function practice() { S.unlock(); shell.sendAfterHello({ t: 'practice', opts: { time: game.pick.time, bots: Math.max(1, game.pick.bots), mode: game.pick.mode } }); }
function startMulti(m) {
  game.myId = shell.myId; game.players.clear();
  for (const mem of m.members) game.players.set(mem.id, { ...mem, score: 0 });
  game.shared = m.opts?.mode === 'shared';
  begin('multi', m.seed, m.time || m.opts?.time || 120, m.in);
  game.endAt = performance.now() + (m.endAt ?? (m.in + game.time * 1000));
  renderLive();
  if (game.shared) setTimeout(() => shell.toast('🍏 한 판 같이! 먼저 묶는 사람이 임자예요 · 내가 터뜨린 칸은 내 색으로 물들어요', 3200), m.in);
}
function timeUp() {
  game.mode = 'wait'; sel = null; S.stopMusic();
  S.sfx('lose');
  if (game.kind === 'solo') return endSolo();
  shell.toast('⏰ 시간 끝! 결과를 기다려요…', 2000);
}
function renderLive(hit) {
  const list = [...game.players.values()].sort((a, b) => b.score - a.score);
  const max = Math.max(10, ...list.map((p) => p.score));
  $('live').innerHTML = list.map((p, i) => `<div class="lv${p.id === game.myId ? ' me' : ''}${p.id === hit ? ' hit' : ''}">${faceHtml(p, 34)}<span class="nm">${i + 1}. ${p.bot ? '🤖 ' : ''}${esc(p.name)}</span><span class="sc">${p.score}</span><div class="bar"><i style="width:${(p.score / max) * 100}%"></i></div></div>`).join('');
}
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellyten', title: '🔟 젤리텐', subtitle: '숫자 곰젤리를 네모로 묶어 합이 10이 되면 팡!<br>제한 시간 안에 최대한 많이 터뜨려요', wsPath: '/ten-ws', max: 12,
  multiLabel: '👥 같이 하기', roomIcon: '🍎', startLabel: '🍎 다 같이 시작!',
  keysHelp: '마우스(손가락)로 드래그해서 네모로 묶기 · 합이 딱 10이면 사라져요 · 같이 하기는 모두 같은 판으로 겨뤄요',
  buttons: [{ id: 'solo-btn', label: '🍎 혼자 하기 <small>최고 점수 도전</small>', onClick: () => startSolo() }, { id: 'bot-btn', label: '🤖 봇과 대결 <small>젤리봇과 같은 판</small>', cls: 'ghost', onClick: () => practice() }],
  extraRow: [{ label: '🏆 순위표', onClick: () => openBoard(game.pick.time) }],
  screens: ['over', 'board-screen'],
  describe: (o = {}) => `${o.mode === 'shared' ? '🍏 한 판 같이' : '🍎 각자 판'} · ⏱️ ${o.time || 120}초 · 🤖 봇 ${o.bots || 0}`,
  options: {
    room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n }), true),
  },
  onStart: (m) => startMulti(m),
  onFinish: (m) => results(m),
  onAccount: () => loadBest(),
  onDisconnect: () => { if (game.mode !== 'title' && game.kind !== 'solo') { toTitle(); } },
});
shell.pickOpts = () => ({ time: game.pick.time, bots: game.pick.bots, mode: game.pick.mode });
shell.on('sc', (m) => { const p = game.players.get(m.id); if (!p || m.id === game.myId) return; p.score = m.s; renderLive(m.id); });
shell.on('bad', (m) => {
  // 한 판 같이: 친구가 먼저 가져갔다 → 서버 판으로 맞춘다
  if (game.shared && Array.isArray(m.b) && m.b.length === COLS * ROWS) { game.board = m.b.slice(); if (Array.isArray(m.own)) game.own = m.own.slice(); S.sfx('bad'); shell.toast('😮 앗, 친구가 먼저 가져갔어요!', 900); }
});
shell.on('clr', (m) => {
  if (!game.shared || !Array.isArray(m.r)) return;
  const rc = m.r, cells = [];
  for (let y = rc[1]; y <= rc[3]; y++) for (let x = rc[0]; x <= rc[2]; x++) { const i = y * COLS + x, v = game.board[i]; if (v) { cells.push([x, y, v]); game.own[i] = m.id; } }
  game.board = game.board.slice(); for (const [x, y] of cells) game.board[y * COLS + x] = 0;
  if (cells.length) popFx(rc, cells);
  game.drags.delete(m.id);
  const p = game.players.get(m.id); if (p) p.score = m.s;
  if (m.id === game.myId) { game.score = m.s; S.sfx('pop', m.n); const el = $('score'); el.textContent = game.score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  else S.sfx('tick', 3);
  if (selRc) updateSel();
  renderLive(m.id);
});
shell.on('dr', (m) => { if (game.shared) game.drags.set(m.id, { r: m.r, at: performance.now() }); });
shell.on('cleared', () => { if (game.mode === 'play') { game.mode = 'wait'; sel = null; S.stopMusic(); confetti(); shell.toast('🎉 판을 다 비웠어요! 결과를 모으는 중…', 1800); } });
shell.on('gone', (m) => { game.players.delete(m.id); renderLive(); });
function optsUI(el, o, editable, set, bots) {
  el.innerHTML = `<div class="seg mode-seg">${MODES.map(([k, l, d]) => `<button data-mode="${k}" class="${(o.mode || 'race') === k ? 'on' : ''}" ${editable ? '' : 'disabled'} title="${d}">${l}<small>${d}</small></button>`).join('')}</div><div class="seg time-seg">${TIMES.map((t) => `<button data-t="${t}" class="${t === o.time ? 'on' : ''}" ${editable ? '' : 'disabled'}>⏱️ ${t === 60 ? '1분' : t === 120 ? '2분' : '3분'}</button>`).join('')}</div>
    ${bots ? `<div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div>` : ''}`;
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => set({ time: +b.dataset.t }); });
  el.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => set({ mode: b.dataset.mode }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(5, (o.bots || 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }, true); }

// ---------- 결과 ----------
function rowHtml(e, extra = '') { return `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${e.bot ? '🤖 ' : ''}${esc(e.name)}</span><span class="sc">${e.score}<small>개${extra}</small></span></div>`; }
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  $('ov-title').textContent = m.rank[0] ? `${game.shared ? '🍏 땅따먹기 ' : ''}🏆 ${m.rank[0].name} 우승!` : '끝!';
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · 곰젤리 ${mine.score}개` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => rowHtml(e)).join('');
  $('ov-save').classList.add('hidden');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1) { confetti(); S.sfx('win'); }
  shell.show('over');
}
async function endSolo() {
  $('game').classList.add('hidden'); game.mode = 'over';
  $('ov-title').textContent = `⏰ 끝! 곰젤리 ${game.score}개`;
  $('ov-me').textContent = '기록을 저장하는 중…';
  $('ov-rank').innerHTML = ''; $('again-btn').textContent = '🔁 한 판 더';
  shell.show('over');
  game.rec = { b: `t${game.time}`, score: game.score, color: shell.profile?.color };
  if (shell.logged()) await saveRecord({ ...game.rec, name: shell.profile?.name });
  else { $('ov-save').classList.remove('hidden'); $('ov-nick').value = store.get('jellyten.nick') || shell.profile?.name || ''; $('ov-me').textContent = '닉네임을 정하면 순위표에 남아요'; showTop(game.rec.b); }
}
function anonId() { let a = store.get(ANON_KEY); if (!/^[a-f0-9]{24}$/.test(a || '')) { a = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set(ANON_KEY, a); } return a; }
async function saveRecord(rec) {
  try {
    const r = await account.api('/api/ten/record', { method: 'POST', body: rec });
    game.bestOf = { ...(game.bestOf || {}), [game.time]: Math.max(r.me?.value || 0, game.bestOf?.[game.time] || 0) };
    $('ov-me').textContent = r.best ? `🎉 새 최고 기록! 순위 ${r.me?.rank}등` : `최고 기록 ${r.me?.value}개 · 순위 ${r.me?.rank}등`;
    if (r.best) { confetti(); S.sfx('win'); }
    renderTop(r.top, r.me);
  } catch (e) { $('ov-me').textContent = `기록을 저장하지 못했어요 (${e.message})`; }
}
$('ov-save-btn').onclick = async () => { const name = $('ov-nick').value.trim(); if (!name) return shell.toast('닉네임을 정해 주세요'); store.set('jellyten.nick', name); $('ov-save').classList.add('hidden'); await saveRecord({ ...game.rec, name, anon: anonId() }); };
function renderTop(top, me, el = $('ov-rank')) {
  const myId = me?.id;
  el.innerHTML = (top || []).slice(0, 10).map((e) => `<div class="brow${e.id === myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : e.anon ? ' <span class="guest">비로그인</span>' : ''}</span><span class="sc">${e.value}<small>개</small></span></div>`).join('') || '<div class="empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</div>';
  if (me && me.rank > 10) el.insertAdjacentHTML('beforeend', `<div class="brow gap">⋯</div><div class="brow me"><span class="rk">${me.rank}</span><span class="nm">${esc(me.name)}</span><span class="sc">${me.value}<small>개</small></span></div>`);
}
async function showTop(b, el) { try { const d = await account.api(`/api/ten/board?b=${b}` + (shell.logged() ? '' : `&anon=${anonId()}`)); renderTop(d.top, d.me, el); } catch { /* 무시 */ } }
async function loadBest() {
  game.bestOf = {};
  for (const t of TIMES) { try { const d = await account.api(`/api/ten/board?b=t${t}` + (shell.logged() ? '' : `&anon=${anonId()}`)); if (d.me) game.bestOf[t] = d.me.value; } catch { /* 무시 */ } }
}
function openBoard(t) {
  $('bd-seg').innerHTML = TIMES.map((x) => `<button data-t="${x}" class="${x === t ? 'on' : ''}">⏱️ ${x === 60 ? '1분' : x === 120 ? '2분' : '3분'}</button>`).join('');
  $('bd-seg').querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => openBoard(+b.dataset.t); });
  $('bd-list').innerHTML = '<div class="empty">불러오는 중…</div>';
  shell.show('board-screen'); showTop(`t${t}`, $('bd-list'));
}
$('bd-back').onclick = () => shell.show('title');
$('again-btn').onclick = () => {
  if (game.kind === 'solo') return startSolo();
  if (game.lastPractice) return practice();
  game.mode = 'room'; shell.backToRoom();
};
$('home-btn').onclick = () => quit();
$('restart-btn').onclick = () => startSolo();
function quit() { if (game.kind !== 'solo') { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() { game.mode = 'title'; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => quit();
window.addEventListener('keydown', (e) => { if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return; if (e.code === 'KeyM') muteBtn(); });

await document.fonts.load('40px Jua').catch(() => {});
renderTitleOpts();
shell.boot();
