// 젤리 타자연습: 짧은 글 연습(타수 · 정확도) · 젤리비(떨어지는 낱말) · 같이 경주(같은 문장 · 곰돌이 트랙) · 젤리봇과 경주
import { account, store } from '../../shared/js/account.js';
import { Shell, esc, TEAMS } from '../../shared/js/shell.js';
import { faceHtml, makeSound, confetti, rankIcon } from '../../shared/js/party.js';
import { SENTENCES, RAIN_WORDS, strokesIn, correctStrokes } from './texts.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellytype');
const PICK_KEY = 'jellytype.pick', ANON_KEY = 'dreamrunner.anon';
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.typing = { mode: 'title', kind: '', pick: { count: pick0.count || 5, bots: pick0.bots ?? 2 }, players: new Map(), myId: 0 };
for (let i = 0; i < 14; i++) { const b = document.createElement('i'); const s = 30 + Math.random() * 90; b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; document.querySelector('.bubbles').appendChild(b); }

// ---------- 문장 치기 ----------
const T = { texts: [], i: 0, t0: 0, raceT0: 0, done: [], correctChars: 0, totalChars: 0, strokes: 0, total: 1, finished: false };
function renderTarget() {
  const tgt = [...T.texts[T.i]], val = [...$('typed').value];
  $('target').innerHTML = tgt.map((ch, k) => {
    const cls = k < val.length - 1 ? (val[k] === ch ? 'ok' : 'bad') : k === val.length - 1 ? (val[k] === ch ? 'ok' : 'cur') : '';
    return `<span class="${cls}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`;
  }).join('');
  $('next').textContent = T.texts[T.i + 1] || '';
}
function liveKpm() {
  const now = performance.now(), min = Math.max(1 / 60, (now - (T.t0 || now)) / 60000);
  return Math.round((T.strokes + correctStrokes($('typed').value, T.texts[T.i] || '')) / min);
}
function progress() { return Math.min(1, (T.done.reduce((a, s) => a + strokesIn(s), 0) + correctStrokes($('typed').value, T.texts[T.i] || '')) / T.total); }
function startTexts(kind, texts, ms) {
  game.kind = kind; game.mode = 'play';
  Object.assign(T, { texts, i: 0, t0: 0, raceT0: performance.now() + ms, done: [], correctChars: 0, totalChars: 0, strokes: 0, total: strokesIn(texts.join('')), finished: false });
  shell.hideScreens(); $('rain').classList.add('hidden'); $('game').classList.remove('hidden');
  $('lanes').classList.toggle('hidden', kind === 'solo');
  $('typed').value = ''; $('typed').disabled = true; renderTarget(); stats();
  countdown(ms, () => { $('typed').disabled = false; $('typed').focus(); });
  S.music('word');
}
function stats() {
  $('s-kpm').textContent = T.t0 ? liveKpm() : 0;
  $('s-acc').textContent = `${T.totalChars ? Math.round((T.correctChars / T.totalChars) * 100) : 100}%`;
  $('s-prog').textContent = `${Math.min(T.i + 1, T.texts.length)}/${T.texts.length}`;
  $('s-time').textContent = T.t0 ? ((performance.now() - T.t0) / 1000).toFixed(1) : '0.0';
}
$('typed').addEventListener('input', () => {
  if (!T.t0) T.t0 = performance.now(); // 첫 글자부터 시간을 잰다
  S.sfx('type'); renderTarget();
  $('typed').classList.toggle('good', $('typed').value === T.texts[T.i]);
});
$('typed').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault(); e.stopPropagation();
  const v = $('typed').value, tgt = T.texts[T.i];
  if ([...v].length < Math.ceil([...tgt].length * 0.5)) { const el = $('typed'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); S.sfx('bad'); return; }
  // 한 문장 끝: 같은 자리 글자가 맞은 만큼 정확도 · 타수
  const a = [...v], b = [...tgt]; let ok = 0; for (let k = 0; k < b.length; k++) if (a[k] === b[k]) ok++;
  T.correctChars += ok; T.totalChars += Math.max(a.length, b.length); T.strokes += correctStrokes(v, tgt); T.done.push(tgt);
  S.sfx(ok === b.length && a.length === b.length ? 'ok' : 'tick');
  T.i++; $('typed').value = ''; $('typed').classList.remove('good');
  if (T.i >= T.texts.length) return finishTexts();
  renderTarget(); stats();
});
function finishTexts() {
  T.finished = true; $('typed').disabled = true;
  const time = (performance.now() - (T.t0 || performance.now())) / 1000, kpm = Math.round(T.strokes / Math.max(1 / 60, time / 60)), acc = Math.round((T.correctChars / Math.max(1, T.totalChars)) * 100);
  T.result = { time, kpm, acc };
  if (game.kind === 'solo') return soloResult();
  const raceTime = (performance.now() - T.raceT0) / 1000;
  shell.send({ t: 'st', p: [1, kpm] });
  shell.send({ t: 'done', time: raceTime, kpm, acc });
  shell.toast(`🏁 도착! ${kpm}타 · 정확도 ${acc}%`, 2500); S.sfx('win');
}
// Enter: 입력 칸을 직접 누르지 않아도 바로 친다 (채팅 칸에 쓰는 중이 아니면)
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing || game.mode !== 'play') return;
  const inp = game.kind === 'rain' ? $('rain-in') : $('typed'), a = document.activeElement;
  if (inp.disabled || a === inp || (a && ['INPUT', 'TEXTAREA'].includes(a.tagName))) return;
  e.preventDefault(); e.stopImmediatePropagation(); inp.focus();
}, true);

// ---------- 같이 경주: 곰돌이 트랙 ----------
function renderLanes() {
  const L = [...game.players.values()];
  $('lanes').innerHTML = L.map((p) => {
    const pr = Math.round((p.prog || 0) * 100);
    return `<div class="lane${p.id === game.myId ? ' me' : ''}${p.team ? ' ' + p.team : ''}"><div class="road"></div><div class="fill" style="width:calc((100% - 60px) * ${pr / 100})"></div><div class="runner" style="left:calc((100% - 60px) * ${pr / 100} + 18px)">${faceHtml(p, 34)}<span class="nm">${p.bot ? '🤖 ' : ''}${esc(p.name)}</span><span class="kp">${p.kpm ? `${p.kpm}타` : ''}</span>${p.result ? '<span class="done">🏁</span>' : ''}</div><span class="goal">🏁</span></div>`;
  }).join('');
}
let sendT = 0;
function raceTick(now) {
  if (game.kind !== 'race' || game.mode !== 'play' || T.finished) return;
  const me = game.players.get(game.myId);
  if (me) { me.prog = progress(); me.kpm = T.t0 ? liveKpm() : 0; }
  if (now - sendT > 250) { sendT = now; shell.send({ t: 'st', p: [progress(), T.t0 ? liveKpm() : 0] }); renderLanes(); }
}

// ---------- 젤리비 ----------
const R = window.rainState = { drops: [], parts: [], score: 0, level: 1, lives: 5, hit: 0, spawnT: 0, cv: $('rain-cv'), over: false };
const DROP_COLS = ['#ff8fc4', '#ffd84d', '#7cf0c8', '#8fd3ff', '#b388ff', '#ff9a62'];
function startRain() {
  S.unlock(); game.kind = 'rain'; game.mode = 'play';
  Object.assign(R, { drops: [], parts: [], score: 0, level: 1, lives: 5, hit: 0, spawnT: 1.2, over: false });
  shell.hideScreens(); $('game').classList.add('hidden'); $('rain').classList.remove('hidden');
  $('rain-in').value = ''; rainHud(); $('rain-in').focus(); S.music('apple');
}
function rainHud() { $('r-score').textContent = R.score; $('r-level').textContent = R.level; $('r-lives').textContent = '🍮'.repeat(R.lives) + '·'.repeat(5 - R.lives); }
function rainStep(dt) {
  const W = innerWidth, H = innerHeight, ground = H - 110;
  R.spawnT -= dt;
  if (R.spawnT <= 0) {
    R.spawnT = Math.max(0.55, 1.7 - R.level * 0.12);
    const used = new Set(R.drops.map((d) => d.w));
    const pool = RAIN_WORDS.filter((w) => !used.has(w) && (R.level > 3 || w.length <= 3));
    const w = pool[Math.floor(Math.random() * pool.length)];
    const left = W > 700 ? 190 : 70; // 왼쪽 점수판 · 오른쪽 위 단추를 피해서
    R.drops.push({ w, x: left + Math.random() * Math.max(40, W - left - 110), y: -30, v: 52 + R.level * 11 + Math.random() * 16, c: DROP_COLS[Math.floor(Math.random() * DROP_COLS.length)], wob: Math.random() * 6 });
  }
  for (const d of R.drops) d.y += d.v * dt;
  const fell = R.drops.filter((d) => d.y > ground);
  if (fell.length) {
    R.drops = R.drops.filter((d) => d.y <= ground);
    R.lives = Math.max(0, R.lives - fell.length); S.sfx('miss'); rainHud();
    for (const d of fell) burst(d.x, ground, '#ff7a8a');
    if (R.lives <= 0 && !R.over) { R.over = true; rainOver(); }
  }
  for (const p of R.parts) { p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4; }
  R.parts = R.parts.filter((p) => p.life > 0);
}
function burst(x, y, c) { for (let i = 0; i < 14; i++) R.parts.push({ x, y, vx: (Math.random() - 0.5) * 380, vy: -Math.random() * 360, r: 3 + Math.random() * 4, c, life: 1 }); }
function rainDraw(t) {
  const cv = R.cv, dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight, g = cv.getContext('2d');
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  // 젤리 둑 (목숨이 줄면 낮아진다)
  const ground = H - 110, gh = 40 + R.lives * 6;
  const gr = g.createLinearGradient(0, ground, 0, ground + gh); gr.addColorStop(0, 'rgba(255,170,210,.85)'); gr.addColorStop(1, 'rgba(180,110,220,.85)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, ground + 10);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, ground + Math.sin(x / 40 + t / 400) * 5);
  g.lineTo(W, H); g.lineTo(0, H); g.fill();
  const typed = $('rain-in').value.trim();
  for (const d of R.drops) {
    g.font = '24px Jua'; const tw = g.measureText(d.w).width, w = tw + 34, h = 46, x = d.x + Math.sin(t / 500 + d.wob) * 6, y = d.y;
    const gg = g.createRadialGradient(x - w * 0.2, y - 8, 4, x, y, w * 0.7); gg.addColorStop(0, '#fff'); gg.addColorStop(0.35, d.c); gg.addColorStop(1, d.c);
    g.fillStyle = gg; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, 22); g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(x - w * 0.25, y - 12, w * 0.18, 5, 0, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const hit = typed && d.w.startsWith(typed);
    g.fillStyle = hit ? '#e2006f' : '#3a2350'; g.fillText(d.w, x, y + 2);
  }
  for (const p of R.parts) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}
$('rain-form').onsubmit = (e) => {
  e.preventDefault();
  const w = $('rain-in').value.trim(); $('rain-in').value = '';
  if (!w || R.over) return;
  const hits = R.drops.filter((d) => d.w === w).sort((a, b) => b.y - a.y);
  if (!hits.length) { const el = $('rain-in'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); S.sfx('bad'); return; }
  const d = hits[0]; R.drops.splice(R.drops.indexOf(d), 1); burst(d.x, d.y, d.c);
  R.score += strokesIn(w) * 10 * R.level; R.hit++;
  if (R.hit % 10 === 0) { R.level++; shell.toast(`⬆️ ${R.level}단계! 젤리비가 빨라져요`, 1200); S.sfx('start'); } else S.sfx('pop', w.length);
  rainHud();
};
function rainOver() { S.stopMusic(); S.sfx('lose'); setTimeout(() => { $('rain').classList.add('hidden'); game.mode = 'over'; showSoloOver('rain', R.score, `🍬 젤리비 끝! ${R.score.toLocaleString()}점`, `${R.level}단계 · 낱말 ${R.hit}개`); }, 900); }

// ---------- 흐름 ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.mode !== 'play') return;
  if (game.kind === 'rain') { if (!R.over) rainStep(dt); rainDraw(now); return; }
  stats(); raceTick(now);
}
requestAnimationFrame(frame);
function countdown(ms, done) {
  const el = $('count'), n = $('count-n'); el.classList.remove('hidden');
  const t0 = performance.now();
  const tk = () => { const left = ms - (performance.now() - t0), k = Math.ceil(left / 1000); if (left <= 0) { n.textContent = '시작!'; S.sfx('count', 1); setTimeout(() => el.classList.add('hidden'), 450); done?.(); return; } if (n.textContent !== String(k)) { n.textContent = k; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; S.sfx('count', 0); } setTimeout(tk, 60); };
  tk();
}
function startSolo() { S.unlock(); const idx = [...SENTENCES.keys()].sort(() => Math.random() - 0.5).slice(0, game.pick.count); startTexts('solo', idx.map((i) => SENTENCES[i]), 2000); }
function practice() { S.unlock(); shell.sendAfterHello({ t: 'practice', opts: { count: game.pick.count, bots: Math.max(1, game.pick.bots) } }); }
function startRace(m) {
  game.myId = shell.myId; game.players.clear();
  for (const mem of m.members) game.players.set(mem.id, { ...mem, prog: 0, kpm: 0 });
  game.team = !!m.opts?.team; startTexts('race', m.texts, m.in); renderLanes();
}

const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => { S.toggleMute(); syncMute(); } },
  key: 'jellytype', title: '⌨️ 젤리 타자연습', subtitle: '짧은 글 따라 치기 · 떨어지는 젤리비 막기<br>친구들과 같은 문장으로 타자 경주까지!', wsPath: '/type-ws', max: 8,
  multiLabel: '👥 같이 경주', roomIcon: '⌨️', startLabel: '⌨️ 경주 시작!',
  keysHelp: '화면의 글을 그대로 치고 Enter · 타수는 한글 자모 단위(한컴타자 방식) · 정확도 90% 이상이어야 순위표에 올라요',
  buttons: [{ id: 'solo-btn', label: '⌨️ 짧은 글 연습 <small>타수 · 정확도</small>', onClick: () => startSolo() }, { id: 'rain-btn', label: '🍬 젤리비 <small>떨어지는 낱말 막기</small>', cls: 'ghost', onClick: () => startRain() }, { id: 'bot-btn', label: '🤖 봇과 경주 <small>젤리봇과 같은 문장</small>', cls: 'ghost', onClick: () => practice() }],
  extraRow: [{ label: '🏆 순위표', onClick: () => openBoard('kpm') }],
  screens: ['over', 'board-screen'],
  describe: (o = {}) => `📝 ${o.count || 5}문장 · ${o.team ? '👥 팀전' : `🏁 개인전 · 🤖 ${o.bots || 0}`}`,
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n }), true) },
  onStart: (m) => startRace(m),
  onFinish: (m) => results(m),
  onChatClose: () => { if (game.mode === 'play') (game.kind === 'rain' ? $('rain-in') : $('typed')).focus(); },
  onDisconnect: () => { if (game.mode === 'play' && game.kind === 'race') toTitle(); },
});
shell.pickOpts = () => ({ ...game.pick });
shell.on('snap', (m) => { for (const [id, prog, kpm] of m.p) { if (id === game.myId) continue; const p = game.players.get(id); if (p) { p.prog = prog; p.kpm = kpm; } } if (game.kind === 'race') renderLanes(); });
shell.on('done', (m) => { const p = game.players.get(m.id); if (!p) return; p.result = m; p.prog = 1; renderLanes(); if (m.id !== game.myId) shell.toast(`🏁 ${p.name} 도착! ${m.kpm}타`, 1400); });
shell.on('gone', (m) => { game.players.delete(m.id); renderLanes(); });
function optsUI(el, o, editable, set, room) {
  const dis = editable ? '' : 'disabled';
  el.innerHTML = `<div class="seg">${[3, 5, 8].map((n) => `<button data-c="${n}" class="${n === (o.count || 5) ? 'on' : ''}" ${dis}>📝 ${n}문장</button>`).join('')}</div>
    ${room ? `<div class="seg"><button data-tm="0" class="${!o.team ? 'on' : ''}" ${dis}>🏁 개인전</button><button data-tm="1" class="${o.team ? 'on' : ''}" ${dis}>👥 팀전</button></div>` : ''}
    ${room && o.team ? '<div class="opt-row">👥 팀전은 사람끼리 (젤리봇 없음)</div>' : `<div class="opt-row">🤖 젤리봇 ${editable ? '<button class="pm" data-b="-1">−</button>' : ''}<b>${o.bots || 0}</b>${editable ? '<button class="pm" data-b="1">＋</button>' : ''}</div>`}`;
  el.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => set({ count: +b.dataset.c }); });
  el.querySelectorAll('[data-tm]').forEach((b) => { b.onclick = () => set({ team: b.dataset.tm === '1' }); });
  el.querySelectorAll('[data-b]').forEach((b) => { b.onclick = () => set({ bots: Math.max(0, Math.min(3, (o.bots || 0) + +b.dataset.b)) }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (n) => { Object.assign(game.pick, n); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); }); }

// ---------- 결과 · 순위표 ----------
function results(m) {
  game.mode = 'over'; S.stopMusic(); $('game').classList.add('hidden'); $('count').classList.add('hidden');
  const mine = m.rank.find((e) => e.id === game.myId);
  game.lastPractice = !!m.practice;
  $('ov-title').textContent = m.team ? (m.team.winner === 'draw' ? '🤝 무승부!' : `🏆 ${TEAMS[m.team.winner].name} 승리!`) : `🏆 ${m.rank[0]?.name || ''} 우승!`;
  $('ov-me').textContent = mine ? `나는 ${mine.rank}등${mine.kpm ? ` · ${mine.kpm}타 · 정확도 ${mine.accu}% · ${mine.time}초` : ' · 완주 못 함'}${m.team ? ` · 평균 순위 ${TEAMS.red.name} ${m.team.red} : ${m.team.blue} ${TEAMS.blue.name}` : ''}` : '';
  $('ov-rank').innerHTML = m.rank.map((e) => `<div class="res-row${e.id === game.myId ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span>${faceHtml(e, 40)}<span class="nm" style="${e.team ? `color:${TEAMS[e.team].color}` : ''}">${e.bot ? '🤖 ' : ''}${esc(e.name)}</span><span class="sc">${e.kpm ? `${e.kpm}<small>타 · ${e.accu}% · ${e.time}초</small>` : `${Math.round(e.prog * 100)}<small>%</small>`}</span></div>`).join('');
  $('ov-save').classList.add('hidden');
  $('again-btn').textContent = m.practice ? '🔁 한 번 더' : '🔁 방으로 돌아가기';
  if (mine?.rank === 1 || (m.team && m.team.winner === mine?.team)) { confetti(); S.sfx('win'); }
  shell.show('over');
}
function soloResult() {
  S.stopMusic(); $('game').classList.add('hidden'); game.mode = 'over';
  const { time, kpm, acc } = T.result;
  showSoloOver('kpm', acc >= 90 ? kpm : null, `⌨️ ${kpm}타 · 정확도 ${acc}%`, `${T.texts.length}문장 · ${time.toFixed(1)}초${acc < 90 ? ' · 정확도 90% 이상이어야 순위표에 올라요' : ''}`);
}
async function showSoloOver(b, value, title, sub) {
  $('ov-title').textContent = title; $('ov-me').textContent = sub; $('ov-rank').innerHTML = ''; $('again-btn').textContent = '🔁 한 번 더';
  game.lastSolo = b; $('ov-save').classList.add('hidden');
  shell.show('over');
  if (value == null) return showTop(b);
  game.rec = { b, value, color: shell.profile?.color };
  if (shell.logged()) await saveRecord({ ...game.rec, name: shell.profile?.name });
  else { $('ov-save').classList.remove('hidden'); $('ov-nick').value = store.get('jellytype.nick') || shell.profile?.name || ''; showTop(b); }
}
function anonId() { let a = store.get(ANON_KEY); if (!/^[a-f0-9]{24}$/.test(a || '')) { a = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join(''); store.set(ANON_KEY, a); } return a; }
async function saveRecord(rec) {
  try {
    const r = await account.api('/api/type/record', { method: 'POST', body: rec });
    $('ov-me').textContent += r.best ? ` · 🎉 새 최고 기록! ${r.me?.rank}등` : ` · 최고 ${r.me?.value} · ${r.me?.rank}등`;
    if (r.best) { confetti(); S.sfx('win'); }
    renderTop(r.top, r.me, rec.b);
  } catch (e) { $('ov-me').textContent += ` · 기록을 저장하지 못했어요 (${e.message})`; }
}
$('ov-save-btn').onclick = async () => { const name = $('ov-nick').value.trim(); if (!name) return shell.toast('닉네임을 정해 주세요'); store.set('jellytype.nick', name); $('ov-save').classList.add('hidden'); await saveRecord({ ...game.rec, name, anon: anonId() }); };
const unit = (b) => (b === 'kpm' ? '타' : '점');
function renderTop(top, me, b, el = $('ov-rank')) {
  el.innerHTML = (top || []).slice(0, 10).map((e) => `<div class="brow${e.id === me?.id ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span><span class="nm"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : e.anon ? ' <span class="guest">비로그인</span>' : ''}</span><span class="sc">${e.value.toLocaleString()}<small>${unit(b)}</small></span></div>`).join('') || '<div class="empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</div>';
}
async function showTop(b, el) { try { const d = await account.api(`/api/type/board?b=${b}` + (shell.logged() ? '' : `&anon=${anonId()}`)); renderTop(d.top, d.me, b, el); } catch { /* 무시 */ } }
function openBoard(b) {
  $('bd-seg').querySelectorAll('[data-b]').forEach((x) => { x.classList.toggle('on', x.dataset.b === b); x.onclick = () => openBoard(x.dataset.b); });
  $('bd-list').innerHTML = '<div class="empty">불러오는 중…</div>'; shell.show('board-screen'); showTop(b, $('bd-list'));
}
$('bd-back').onclick = () => shell.show('title');
$('again-btn').onclick = () => {
  if (game.kind === 'solo') return startSolo();
  if (game.kind === 'rain') return startRain();
  if (game.lastPractice) return practice();
  game.mode = 'room'; shell.backToRoom();
};
$('home-btn').onclick = () => quit();
function quit() { if (game.kind === 'race') { shell.send({ t: 'leave' }); shell.room = null; } toTitle(); }
function toTitle() { game.mode = 'title'; game.kind = ''; S.stopMusic(); shell.multi = false; shell.playing = false; $('game').classList.add('hidden'); $('rain').classList.add('hidden'); $('count').classList.add('hidden'); shell.show('title'); renderTitleOpts(); }
function syncMute() { for (const id of ['b-mute', 'b-mute2']) $(id).textContent = S.sound.muted ? '🔇' : '🔊'; }
function muteBtn() { S.toggleMute(); syncMute(); shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute2').onclick = muteBtn; syncMute();
$('b-quit').onclick = () => quit(); $('b-quit2').onclick = () => { R.over = true; quit(); };
document.addEventListener('pointerdown', () => S.unlock(), { once: true });

await document.fonts.load('24px Jua').catch(() => {});
renderTitleOpts();
shell.boot();
