// 젤리 머지: 병에 젤리곰을 떨어뜨려 같은 맛끼리 닿으면 한 단계 큰 젤리로! 11단계 '무지개 왕곰' 둘이 만나면 젤리 대폭발
//   혼자 하기(끝없이 · 최고 점수) · 봇과 대결 · 같이 하기(최대 8명 · 크게 합치면 설탕 덩어리를 상대 병에 보낸다)
import { store } from '../../shared/js/account.js';
import { Shell, esc } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { Jar, W, H, DL, DROP_Y, RAD, FLAVORS, SUGAR, RAINBOW, BOMB, KING, CONTAINERS } from './engine.js';

const TIMES = [120, 180, 300];
const $ = (id) => document.getElementById(id);
const S = makeSound('jellymerge');
const PICK_KEY = 'jellymerge.pick', BEST_KEY = 'jellymerge.best';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const bestOf = (() => { try { return JSON.parse(store.get(BEST_KEY) || '{}'); } catch { return {}; } })();
const game = window.merge = {
  mode: 'title', kind: 'solo', jar: null, players: new Map(), myId: 0, time: 180, startAt: 0, endAt: 0, out: false,
  pick: { cont: CONTAINERS[pick0.cont] ? pick0.cont : 'box', time: TIMES.includes(pick0.time) ? pick0.time : 180, bots: pick0.bots ?? 3, bomb: pick0.bomb !== false, star: pick0.star !== false },
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
  if (lv === BOMB) {
    g.strokeStyle = '#8a6a3a'; g.lineWidth = r * 0.16; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -r * 0.9); g.quadraticCurveTo(r * 0.3, -r * 1.35, r * 0.55, -r * 1.25); g.stroke();
    const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); gr.addColorStop(0, '#7f93d6'); gr.addColorStop(1, '#25305c');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,220,255,.7)'; for (const [x, y, s] of [[-0.3, 0.25, 0.14], [0.25, 0.4, 0.1], [0.35, -0.05, 0.08], [-0.05, 0.55, 0.07]]) { g.beginPath(); g.arc(x * r, y * r, s * r, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-r * 0.4, -r * 0.45, r * 0.25, r * 0.12, -0.6, 0, 7); g.fill();
    g.font = `${Math.round(r * 0.62)}px Jua`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('💥', 0, r * 0.02);
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
let sprites = new Map(), dpr = 1, K = 1;
function sprite(lv, scale = K) {
  const key = lv + ':' + scale.toFixed(3);
  let c = sprites.get(key);
  if (!c) {
    const r = RAD[lv] * scale, s = Math.ceil(r * 2.9 * dpr);
    c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.translate(s / dpr / 2, s / dpr / 2); drawJelly(g, r, lv);
    sprites.set(key, c);
  }
  return c;
}

// ---------- 병 그리기 ----------
const cv = $('jar'), g = cv.getContext('2d');
const OX = 22, OY = 46, LW = W + OX * 2, LH = H + OY + 20;
const fx = { parts: [], rings: [], texts: [], shake: 0, flash: 0 };
let aimX = W / 2, keyDir = 0, hover = false;
function layout() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const small = innerWidth <= 900, multi = game.kind !== 'solo';
  const availW = innerWidth - (small ? 12 : 150 + (multi ? 250 : 0) + 60 + 32);
  const availH = innerHeight - (small ? 58 + 62 + (multi ? 120 : 0) + 10 : 30);
  K = Math.max(0.35, Math.min(availW / LW, availH / LH, 1.25));
  cv.width = Math.round(LW * K * dpr); cv.height = Math.round(LH * K * dpr);
  cv.style.width = `${Math.round(LW * K)}px`; cv.style.height = `${Math.round(LH * K)}px`;
  sprites = new Map();
  renderLadder();
}
window.addEventListener('resize', () => { if (game.mode !== 'title') layout(); });
function jarPath(kind) {
  const p = new Path2D();
  if (kind === 'bowl') { const top = H - 150, Rb = 208.33, cy = H - Rb; p.moveTo(0, -10); p.lineTo(0, top); p.arc(200, cy, Rb, Math.atan2(top - cy, -200), Math.atan2(top - cy, 200), true); p.lineTo(W, -10); }
  else if (kind === 'cup') { p.moveTo(0, -10); p.lineTo(0, 130); p.lineTo(70, H); p.lineTo(W - 70, H); p.lineTo(W, 130); p.lineTo(W, -10); }
  else { p.moveTo(0, -10); p.lineTo(0, H - 30); p.quadraticCurveTo(0, H, 30, H); p.lineTo(W - 30, H); p.quadraticCurveTo(W, H, W, H - 30); p.lineTo(W, -10); }
  return p;
}
function drawBody(b, t, alpha = 1) {
  const sp = sprite(b.lv), s = sp.width / dpr, k = b.r / b.tr;
  g.save(); g.translate(b.x, b.y);
  const wob = Math.sin(t / 260 + b.id) * 0.012;
  g.scale((1 + b.sq + wob) * k, (1 - b.sq - wob) * k); g.translate(0, b.r * b.sq);
  g.rotate(b.lv === SUGAR || b.lv === BOMB ? b.ang * 0.3 : Math.max(-0.5, Math.min(0.5, Math.sin(b.ang) * 0.5)));
  if (alpha < 1) g.globalAlpha = alpha;
  if (b.lv === BOMB && b.fuse >= 0 && Math.floor(t / 70) % 2) g.filter = 'brightness(1.8)';
  g.drawImage(sp, -s / 2 / K, -s / 2 / K, s / K, s / K);
  g.restore();
}
function draw(t) {
  const J = game.jar; if (!J) return;
  g.setTransform(dpr * K, 0, 0, dpr * K, 0, 0);
  g.clearRect(0, 0, LW, LH);
  let sx = 0, sy = 0; if (fx.shake > 0) { sx = (Math.random() - 0.5) * fx.shake * 14; sy = (Math.random() - 0.5) * fx.shake * 14; }
  g.translate(OX + sx, OY + sy);
  const path = jarPath(J.kind);
  // 병 안쪽: 은은한 젤리 물
  g.save(); g.clip(path);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'rgba(40,20,80,.35)'); bg.addColorStop(0.5, 'rgba(120,70,150,.38)'); bg.addColorStop(1, 'rgba(255,150,205,.45)');
  g.fillStyle = bg; g.fillRect(-10, -20, W + 20, H + 30);
  g.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(60 + i * 60, H - 40 - ((t / 30 + i * 90) % (H - 60)), 4 + (i % 3) * 2, 0, 7); g.fill(); }
  // 위험선
  const dz = J.danger > 0 ? Math.min(1, J.danger / 2.6) : 0;
  g.strokeStyle = dz ? `rgba(255,${90 - dz * 60},${110 - dz * 60},${0.6 + 0.4 * Math.abs(Math.sin(t / (120 - dz * 60)))})` : 'rgba(255,255,255,.35)';
  g.lineWidth = dz ? 4 : 2; g.setLineDash([12, 10]); g.lineDashOffset = -t / 40;
  g.beginPath(); g.moveTo(0, DL); g.lineTo(W, DL); g.stroke(); g.setLineDash([]);
  if (dz) { g.fillStyle = `rgba(255,60,90,${0.12 + dz * 0.2})`; g.fillRect(0, -20, W, DL + 20); }
  const canAim = game.mode === 'play' && !game.out && performance.now() >= game.startAt;
  for (const b of J.bodies) drawBody(b, t);
  g.restore();
  // 병 테두리 (유리)
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 16; g.stroke(path);
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5; g.stroke(path);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(12, 40); g.lineTo(12, H * 0.45); g.stroke();
  // 들고 있는 젤리
  if (canAim) {
    const ax = J.clampAim(aimX), r = RAD[J.cur], ready = J.canDrop();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(ax, DROP_Y - r - 26); g.lineTo(ax, DROP_Y - r - 4); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ax, DROP_Y - r - 30, 6, 0, 7); g.fill();
    drawBody({ lv: J.cur, x: ax, y: DROP_Y + (ready ? Math.sin(t / 200) * 2 : -8), r, tr: r, sq: 0, ang: 0, id: 0 }, t, ready ? 1 : 0.45);
  }
  // 들어올 설탕
  if (J.incoming > 0) {
    const n = J.incoming, w = Math.min(W - 20, n * 22);
    for (let i = 0; i < n; i++) { const x = W / 2 - w / 2 + (i + 0.5) * (w / n); drawBody({ lv: SUGAR, x, y: -24 + Math.sin(t / 120 + i) * 2, r: 9, tr: RAD[SUGAR], sq: 0, ang: 0, id: i }, t, 0.9); }
    g.fillStyle = 'rgba(255,90,120,.9)'; g.fillRect(W / 2 - w / 2, -8, w * Math.max(0, J.inT / 2.2), 4);
  }
  // 이펙트
  for (const p of fx.rings) { g.globalAlpha = Math.max(0, p.life); g.strokeStyle = p.c; g.lineWidth = 6 * p.life + 1; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.stroke(); }
  for (const p of fx.parts) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); if (p.sq) g.rect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); else g.arc(p.x, p.y, p.s, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const tx of fx.texts) { g.globalAlpha = Math.max(0, Math.min(1, tx.life * 1.5)); g.font = `${tx.size}px Jua`; g.lineWidth = 6; g.strokeStyle = 'rgba(60,20,90,.6)'; g.strokeText(tx.s, tx.x, tx.y); g.fillStyle = tx.c; g.fillText(tx.s, tx.x, tx.y); }
  g.globalAlpha = 1;
  if (fx.flash > 0) { g.setTransform(dpr * K, 0, 0, dpr * K, 0, 0); g.fillStyle = `rgba(255,255,255,${fx.flash * 0.6})`; g.fillRect(0, 0, LW, LH); }
}
function burst(x, y, c, n, sp = 320, sq = false) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = sp * (0.3 + Math.random()); fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, s: 2 + Math.random() * 4, c, life: 0.7 + Math.random() * 0.5, sq }); } }
function stepFx(dt) {
  for (const p of fx.parts) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4; }
  for (const p of fx.rings) { p.r += p.v * dt; p.life -= dt * 2.2; }
  for (const t of fx.texts) { t.y -= 50 * dt; t.life -= dt * 0.9; }
  fx.parts = fx.parts.filter((p) => p.life > 0); fx.rings = fx.rings.filter((p) => p.life > 0); fx.texts = fx.texts.filter((p) => p.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 2.5); fx.flash = Math.max(0, fx.flash - dt * 2);
}
function comboBanner(s) { const el = $('combo'); el.textContent = s; el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(el.t); el.t = setTimeout(() => el.classList.add('hidden'), 800); }
// 엔진 사건 → 소리 · 효과
function onEvents(J) {
  for (const e of J.ev) {
    if (e.k === 'drop') S.sfx('swish');
    else if (e.k === 'land') S.sfx('tick', Math.round(e.s * 4));
    else if (e.k === 'merge') {
      const c = FLAVORS[e.lv].c;
      burst(e.x, e.y, c, 10 + e.lv * 3); burst(e.x, e.y, '#ffffff', 6);
      fx.rings.push({ x: e.x, y: e.y, r: RAD[e.lv] * 0.6, v: 160 + e.lv * 20, c, life: 1 });
      fx.texts.push({ x: e.x, y: e.y - RAD[e.lv] * 0.4, s: `+${e.pts}`, c: e.combo >= 3 ? '#ffd84d' : '#fff', size: 20 + e.lv * 2, life: 1 });
      S.sfx('pop', Math.min(5, 1 + Math.floor(e.lv / 2)));
      if (e.lv >= 8) { fx.shake = Math.min(1, 0.2 + (e.lv - 7) * 0.15); S.sfx('lvl'); }
      if (e.combo >= 2) comboBanner(`${e.combo} 콤보!${e.combo >= 5 ? ' 🔥' : ''}`);
      if (e.rainbow) burst(e.x, e.y, RAINBOW_C[Math.floor(Math.random() * 6)], 20);
      if (e.lv > (game.ladderBest || 0)) { game.ladderBest = e.lv; renderLadder(e.lv); if (e.lv >= 7) feed(`✨ 처음으로 ${FLAVORS[e.lv].n} 젤리를 만들었어요!`, true); }
      bumpScore();
    } else if (e.k === 'burst') {
      fx.flash = 1; fx.shake = 1; for (const c of RAINBOW_C) burst(e.x, e.y, c, 14, 600);
      fx.texts.push({ x: e.x, y: e.y, s: `젤리 대폭발! +${e.pts}`, c: '#ffd84d', size: 34, life: 1.6 });
      S.sfx('win'); confetti(120); bumpScore();
    } else if (e.k === 'pop') { burst(e.x, e.y, e.lv === SUGAR ? '#ffffff' : FLAVORS[e.lv].c, 8, 240, e.lv === SUGAR); S.sfx('kill'); bumpScore(); }
    else if (e.k === 'boom') { fx.shake = 0.8; fx.rings.push({ x: e.x, y: e.y, r: 20, v: 420, c: '#9fd8ff', life: 1 }); burst(e.x, e.y, '#9fd8ff', 30, 500); S.sfx('boom'); if (e.pts) fx.texts.push({ x: e.x, y: e.y - 20, s: `펑! +${e.pts}`, c: '#9fd8ff', size: 28, life: 1.2 }); bumpScore(); }
    else if (e.k === 'warn') { S.sfx('hurt'); }
    else if (e.k === 'sugar') { fx.shake = 0.4; S.sfx('bad'); }
    else if (e.k === 'cancel') feed(`🛡️ 들어오던 설탕 ${e.n}개를 막았어요!`, true);
    else if (e.k === 'over') gameOver();
  }
  J.ev.length = 0;
}
function bumpScore() { const el = $('score'); el.textContent = game.jar.score; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function renderNext() {
  const c = $('next'), x = c.getContext('2d'), J = game.jar; if (!J) return;
  const s = 80; c.width = c.height = s * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, s, s);
  const r = Math.min(26, RAD[J.nxt] * 0.9); x.translate(s / 2, s / 2 + 4); drawJelly(x, r, J.nxt);
}
function renderLadder(fresh) {
  const el = $('ladder'); const got = game.ladderBest || 0;
  if (el.children.length !== KING) { el.innerHTML = ''; for (let lv = 1; lv <= KING; lv++) { const c = document.createElement('canvas'); c.width = c.height = 64; c.title = FLAVORS[lv].n; const x = c.getContext('2d'); x.translate(32, 34); drawJelly(x, 21, lv); el.appendChild(c); } }
  [...el.children].forEach((c, i) => { c.classList.toggle('got', i + 1 <= got); c.classList.toggle('new', i + 1 === fresh); });
}

// ---------- 입력 ----------
const local = (e) => { const r = cv.getBoundingClientRect(); return (e.clientX - r.left) / K - OX; };
const canPlay = () => game.mode === 'play' && !game.out && performance.now() >= game.startAt;
function tryDrop() { if (!canPlay()) return; const J = game.jar; J.aim = J.clampAim(aimX); J.drop(J.aim); renderNext(); }
let touching = false;
cv.addEventListener('pointerdown', (e) => { S.unlock(); aimX = local(e); hover = true; if (e.pointerType !== 'mouse') { touching = true; cv.setPointerCapture(e.pointerId); } });
cv.addEventListener('pointermove', (e) => { aimX = local(e); hover = true; });
cv.addEventListener('pointerup', (e) => { aimX = local(e); if (e.pointerType === 'mouse' && e.button !== 0) return; touching = false; tryDrop(); }); // 손가락: 끌다가 떼면 떨어진다 · 마우스: 클릭
cv.addEventListener('pointercancel', () => { touching = false; });
cv.addEventListener('pointerleave', () => { hover = false; });
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'KeyM') muteBtn();
  if (game.mode !== 'play') return;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keyDir = -1;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keyDir = 1;
  if (['Space', 'ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); if (!e.repeat) { S.unlock(); tryDrop(); } }
});
window.addEventListener('keyup', (e) => { if ((['ArrowLeft', 'KeyA'].includes(e.code) && keyDir < 0) || (['ArrowRight', 'KeyD'].includes(e.code) && keyDir > 0)) keyDir = 0; });

// ---------- 흐름 ----------
let last = performance.now(), lastSec = -1, sendT = 0, bdT = 0, lastSent = -1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.mode === 'title' || !game.jar) return;
  const J = game.jar;
  if (keyDir) aimX = Math.max(0, Math.min(W, J.clampAim(aimX) + keyDir * 430 * dt));
  if ((game.mode === 'play' || game.mode === 'wait') && now >= game.startAt && !game.out) { J.step(dt); onEvents(J); }
  stepFx(dt);
  draw(now);
  if (game.kind !== 'solo' && game.mode === 'play' && !game.out) netTick(now);
  if (game.kind !== 'solo' && game.mode !== 'over') {
    const left = Math.max(0, game.endAt - now), total = game.time * 1000;
    $('timebar').firstElementChild.style.height = `${Math.min(100, (left / total) * 100)}%`;
    $('timebar').classList.toggle('hurry', left < 15000 && left > 0);
    const sec = Math.ceil(left / 1000); if (sec !== lastSec && sec <= 5 && sec > 0 && now >= game.startAt) S.sfx('clock'); lastSec = sec;
    if (now >= game.endAt && game.mode === 'play') { game.mode = 'wait'; S.stopMusic(); shell.toast('⏰ 시간 끝! 결과를 모으는 중…', 2000); }
  }
}
requestAnimationFrame(frame);
// 같이 하기: 점수 · 공격 · 작은 판을 보낸다
function netTick(now) {
  const J = game.jar;
  if (J.score !== lastSent && now - sendT > 200) { sendT = now; lastSent = J.score; shell.send({ t: 'sc', s: J.score, lv: J.best }); const me = game.players.get(game.myId); if (me) { me.score = J.score; } renderRivals(); }
  if (now - (game.atkT || 0) > 320) { const n = J.takeAtk(); if (n) { game.atkT = now; shell.send({ t: 'atk', n }); feed(`🍬 설탕 ${n}개를 보냈어요!`, true); S.sfx('zap'); } }
  if (now - bdT > 400) { bdT = now; shell.send({ t: 'bd', b: J.snap().slice(0, 240), h: J.height() }); }
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
function begin(kind, seed, cont, ms, sp = game.pick) {
  game.kind = kind; game.mode = 'play'; game.out = false; game.cont = cont;
  game.jar = new Jar(seed, cont, sp); game.ladderBest = 0; lastSent = -1;
  fx.parts = []; fx.rings = []; fx.texts = []; fx.shake = 0; fx.flash = 0; aimX = W / 2;
  game.startAt = performance.now() + ms;
  shell.hideScreens(); $('game').classList.remove('hidden');
  $('side-r').classList.toggle('hidden', kind === 'solo');
  $('timebar').classList.toggle('hidden', kind === 'solo');
  $('restart-btn').classList.toggle('hidden', kind !== 'solo');
  $('outmsg').classList.add('hidden'); $('feed').innerHTML = '';
  $('score').textContent = 0;
  $('best').textContent = kind === 'solo' && bestOf[cont] ? `내 최고 ${bestOf[cont]}` : CONTAINERS[cont].n;
  layout(); renderNext(); countdown(ms); S.sfx('start'); S.music('draw');
}
function startSolo() { S.unlock(); begin('solo', (Math.random() * 2 ** 31) | 0, game.pick.cont, 2400); }
function practice() { S.unlock(); shell.sendAfterHello({ t: 'practice', opts: { time: game.pick.time, bots: Math.max(1, game.pick.bots), cont: game.pick.cont, bomb: game.pick.bomb, star: game.pick.star } }); }
function startMulti(m) {
  game.myId = shell.myId; game.players.clear();
  for (const mem of m.members) game.players.set(mem.id, { ...mem, score: 0, lv: 0, out: false, b: [], h: 0 });
  game.time = m.time || m.opts?.time || 180;
  begin('multi', m.seed, m.cont || m.opts?.cont || 'box', m.in, m.sp || m.opts || {});
  game.endAt = performance.now() + (m.endAt ?? (m.in + game.time * 1000));
  renderRivals(true);
  setTimeout(() => { if (game.mode === 'play') shell.toast('🍬 큰 젤리를 만들거나 콤보를 이으면 설탕 덩어리가 상대 병으로 날아가요!', 3200); }, m.in);
}
function gameOver() {
  S.stopMusic(); S.sfx('lose');
  if (game.kind === 'solo') { game.mode = 'over'; setTimeout(endSolo, 1100); fx.shake = 0.6; return; }
  game.out = true; shell.send({ t: 'sc', s: game.jar.score, lv: game.jar.best }); shell.send({ t: 'out' });
  $('outmsg').innerHTML = `😵 병이 넘쳤어요!<small>점수 ${game.jar.score} · 다른 곰돌이를 구경해요</small>`; $('outmsg').classList.remove('hidden');
}
function feed(s, me) { const d = document.createElement('div'); d.textContent = s; if (me) d.className = 'me'; $('feed').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('feed').children.length > 3) $('feed').firstChild.remove(); }
// 라이벌: 작은 병 + 점수
function renderRivals(full) {
  const el = $('rivals');
  const list = [...game.players.values()].sort((a, b) => b.score - a.score);
  if (full || el.children.length !== list.length) {
    el.classList.toggle('many', list.length > 4);
    el.innerHTML = list.map((p) => `<div class="rv${p.id === game.myId ? ' me' : ''}" data-id="${p.id}"><canvas width="100" height="160"></canvas><div class="nm">${faceHtml(p, 18)}${p.bot ? '🤖' : ''}${esc(p.name)}</div><div class="sc">0</div></div>`).join('');
  }
  const byId = new Map([...el.children].map((d) => [+d.dataset.id, d]));
  list.forEach((p, i) => { const d = byId.get(p.id); if (!d) return; d.style.order = i; d.querySelector('.sc').textContent = `${i + 1}등 · ${p.score}`; d.classList.toggle('out', !!p.out); if (p.id !== game.myId) drawMini(d.querySelector('canvas'), p); else drawMini(d.querySelector('canvas'), { b: game.jar?.snap() || [], h: game.jar?.height() || 0 }); });
}
function drawMini(c, p) {
  const x = c.getContext('2d'), k = c.width / W;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = p.h > 0.85 ? 'rgba(255,80,110,.25)' : 'rgba(255,255,255,.05)'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(255,90,120,.6)'; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(0, DL * k); x.lineTo(c.width, DL * k); x.stroke(); x.setLineDash([]);
  const b = p.b || [];
  for (let i = 0; i + 2 < b.length; i += 3) { const lv = b[i + 2]; x.fillStyle = lv === KING ? '#ffcf33' : lv === RAINBOW ? '#ffffff' : FLAVORS[lv]?.c || '#ccc'; x.beginPath(); if (lv === SUGAR) x.rect((b[i] - 14) * k, (b[i + 1] - 14) * k, 28 * k, 28 * k); else x.arc(b[i] * k, b[i + 1] * k, RAD[lv] * k, 0, 7); x.fill(); }
}
let rvT = 0;
setInterval(() => { if (game.kind !== 'solo' && game.mode !== 'title' && game.mode !== 'over' && performance.now() - rvT > 380) { rvT = performance.now(); renderRivals(); } }, 400);

const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; } },
  key: 'jellymerge', title: '🍓 젤리 머지', subtitle: '병에 곰젤리를 떨어뜨려 같은 맛끼리 닿으면 더 큰 젤리로!<br>11단계 무지개 왕곰 둘을 만나게 하면 젤리 대폭발 🌈', wsPath: '/merge-ws', max: 8,
  multiLabel: '👥 같이 하기', roomIcon: '🍓', startLabel: '🍓 다 같이 시작!',
  keysHelp: '마우스로 위치를 고르고 클릭 · 휴대폰은 끌다가 떼기 · ← → 와 Space 도 돼요 · 큰 젤리 · 콤보 = 상대에게 설탕 덩어리 공격',
  buttons: [{ id: 'solo-btn', label: '🍓 혼자 하기 <small>최고 점수 도전</small>', onClick: () => startSolo() }, { id: 'bot-btn', label: '🤖 봇과 대결 <small>설탕 덩어리 주고받기</small>', cls: 'ghost', onClick: () => practice() }],
  screens: ['over'],
  describe: (o = {}) => `${CONTAINERS[o.cont || 'box'].n} · ⏱️ ${Math.round((o.time || 180) / 60)}분 · 🤖 봇 ${o.bots || 0}`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n }), true) },
  onStart: (m) => startMulti(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title' && game.kind !== 'solo') toTitle(); },
});
shell.pickOpts = () => ({ ...game.pick });
shell.on('sc', (m) => { const p = game.players.get(m.id); if (!p || m.id === game.myId) return; p.score = m.s; p.lv = m.lv; });
shell.on('bd', (m) => { const p = game.players.get(m.id); if (p) { p.b = m.b; p.h = m.h; } });
shell.on('out', (m) => { const p = game.players.get(m.id); if (!p) return; p.out = true; if (m.id !== game.myId) feed(`💥 ${p.name} 님의 병이 넘쳤어요!`); renderRivals(); });
shell.on('sugar', (m) => { if (game.out || !game.jar) return; game.jar.addSugar(m.n); onEvents(game.jar); const p = game.players.get(m.from); feed(`⚠️ ${p ? p.name : '누군가'} 님이 설탕 ${m.n}개를 보냈어요! 빨리 합쳐서 막아요`, true); });
shell.on('atk', (m) => { if (m.to === game.myId || m.from === game.myId) return; const a = game.players.get(m.from), b = game.players.get(m.to); if (a && b) feed(`🍬 ${a.name} → ${b.name} 설탕 ${m.n}개`); const d = document.querySelector(`.rv[data-id="${m.to}"]`); if (d) { d.classList.remove('hit'); void d.offsetWidth; d.classList.add('hit'); } });
shell.on('gone', (m) => { game.players.delete(m.id); renderRivals(true); });
function optsUI(el, o, editable, set, multi) {
  el.innerHTML = `<div class="seg cont-seg">${Object.entries(CONTAINERS).map(([k, c]) => `<button data-c="${k}" class="${(o.cont || 'box') === k ? 'on' : ''}" ${editable ? '' : 'disabled'}>${c.n}<small>${c.d}</small></button>`).join('')}</div>
    ${multi ? `<div class="seg time-seg">${TIMES.map((t) => `<button data-t="${t}" class="${t === o.time ? 'on' : ''}" ${editable ? '' : 'disabled'}>⏱️ ${t / 60}분</button>`).join('')}</div>
    <div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div>` : ''}
    <div class="seg mode-seg tog-seg">
      <button data-s="bomb" class="${o.bomb !== false ? 'on' : ''}" ${editable ? '' : 'disabled'} title="닿고 잠시 뒤 펑! 작은 젤리 · 설탕을 없애요">💥 폭탄 젤리<small>${o.bomb !== false ? '켜짐' : '꺼짐'}</small></button>
      <button data-s="star" class="${o.star !== false ? 'on' : ''}" ${editable ? '' : 'disabled'} title="어떤 젤리와도 합쳐져 한 단계 올려요">🌈 무지개 젤리<small>${o.star !== false ? '켜짐' : '꺼짐'}</small></button>
    </div>`;
  el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => set({ cont: b.dataset.c }); });
  el.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => set({ time: +b.dataset.t }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(7, (o.bots || 0) + +b.dataset.b)) }); });
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => set({ [b.dataset.s]: o[b.dataset.s] === false }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }, true); }

// ---------- 결과 ----------
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  const top = m.rank[0];
  $('ov-title').textContent = top ? `🏆 ${top.name} 우승!${top.last ? ' (마지막 생존)' : ''}` : '끝!';
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등 · ${mine.score}점 · 보낸 설탕 ${mine.sent}개` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm">${e.bot ? '🤖 ' : ''}${esc(e.name)}${e.out ? ' 😵' : ''}</span><span class="sc">${e.score}<small>점 · ${e.lv ? FLAVORS[e.lv].n : '-'}</small></span></div>`).join('');
  game.lastPractice = !!m.practice;
  $('again-btn').textContent = m.practice ? '🔁 한 판 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1) { confetti(); S.sfx('win'); }
  shell.show('over');
}
function endSolo() {
  const J = game.jar, cont = game.cont, prev = bestOf[cont] || 0, isBest = J.score > prev;
  if (isBest) { bestOf[cont] = J.score; store.set(BEST_KEY, JSON.stringify(bestOf)); }
  $('game').classList.add('hidden');
  $('ov-title').textContent = `🍓 ${J.score}점`;
  $('ov-me').textContent = isBest ? `🎉 ${CONTAINERS[cont].n} 새 최고 기록!` : `${CONTAINERS[cont].n} 내 최고 ${prev}점`;
  $('ov-rank').innerHTML = `<div class="res-row me"><span class="rk">🍬</span><span></span><span class="nm">가장 큰 젤리</span><span class="sc">${J.best ? FLAVORS[J.best].n : '-'}<small>${J.best}단계</small></span></div><div class="res-row"><span class="rk">✨</span><span></span><span class="nm">합친 횟수</span><span class="sc">${J.merges}<small>번</small></span></div>`;
  $('again-btn').textContent = '🔁 한 판 더';
  if (isBest && prev) { confetti(); S.sfx('win'); }
  shell.show('over');
}
$('again-btn').onclick = () => {
  if (game.kind === 'solo') return startSolo();
  if (game.lastPractice) return practice();
  game.mode = 'room'; shell.backToRoom();
};
$('home-btn').onclick = () => quit();
$('restart-btn').onclick = () => startSolo();
function quit() { if (game.kind !== 'solo') { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() { game.mode = 'title'; game.jar = null; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound?.(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => quit();

await document.fonts.load('40px Jua').catch(() => {});
renderTitleOpts();
shell.boot();
