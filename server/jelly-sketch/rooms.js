// 젤리 스케치퀴즈 방: 최대 12명 · 한 명씩 돌아가며 '주제를 직접 정해서' 그리고 나머지가 맞힌다
//   그리는 동안 획이 실시간으로 모두에게 간다 · 정답은 서버만 알고, 맞힐 때마다 점수 · 시간이 지나면 글자 힌트
import { BaseRooms, clean } from '../shared/rooms.js';
import { cleanStrokes } from '../jelly-draw/rooms.js';
import { pickPrompts, normWord } from '../../public/jelly-draw/js/prompts.js';

const PICK_MS = 20000, REVEAL_MS = 5000;
// 비슷한가: 글자 하나만 다르면 '거의 맞았어요'
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a.length < 2) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] === 1;
}
// 힌트: 글자 수만큼 ＿ · 열린 글자는 그대로 (띄어쓰기는 띄어쓰기)
const hintOf = (word, open) => [...word].map((ch, i) => (ch === ' ' ? ' ' : open.has(i) ? ch : '＿')).join('');

export class SketchRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 12, hz: 4, countdown: 3000, defaults: { rounds: 2, draw: 80 } }); }
  allow(cur, n) {
    return {
      rounds: [1, 2, 3].includes(Number(n.rounds)) ? Number(n.rounds) : cur.rounds,
      draw: [60, 80, 100, 120].includes(Number(n.draw)) ? Number(n.draw) : cur.draw,
    };
  }
  handle(c, m) {
    if (m.t === 'start' && c.room && c.room.host === c && c.room.state === 'wait' && c.room.players.length < 2) return this.send(c, { t: 'error', text: '스케치퀴즈는 2명 이상이 있어야 해요. 초대 링크로 친구를 불러 주세요!' });
    return super.handle(c, m);
  }
  onStart(r) {
    const order = [...r.players].sort(() => Math.random() - 0.5).map((p) => p.id);
    r.g = { order, turn: -1, total: order.length * r.opts.rounds, phase: 'wait', drawer: 0, word: '', norm: '', strokes: [], got: new Map(), open: new Set(), end: 0, hintAt: [], score: new Map(order.map((id) => [id, 0])), ended: false };
    setTimeout(() => this.nextTurn(r), Math.max(0, r.startAt - Date.now()) + 300);
    return { order, rounds: r.opts.rounds, draw: r.opts.draw };
  }
  alive(r, id) { return r.players.some((p) => p.id === id); }
  // 다음 사람 차례 (나간 사람은 건너뛴다)
  nextTurn(r) {
    const g = r.g; if (!g || g.ended || r.state !== 'run') return;
    do g.turn++; while (g.turn < g.total && !this.alive(r, g.order[g.turn % g.order.length]));
    if (g.turn >= g.total || r.players.length < 2) return this.finishSketch(r);
    g.drawer = g.order[g.turn % g.order.length]; g.phase = 'pick'; g.word = ''; g.norm = ''; g.strokes = []; g.got = new Map(); g.open = new Set();
    g.end = Date.now() + PICK_MS;
    const round = Math.floor(g.turn / g.order.length) + 1;
    this.toRoom(r, { t: 'turn', drawer: g.drawer, round, rounds: r.opts.rounds, ms: PICK_MS });
    const d = r.players.find((p) => p.id === g.drawer); if (d) this.send(d, { t: 'pickme', ideas: pickPrompts(3) });
  }
  // 그리는 사람이 주제를 정했다
  setTopic(r, word) {
    const g = r.g;
    const w = clean(word, 20); if (!w || normWord(w).length < 1) return false;
    g.word = w; g.norm = normWord(w); g.phase = 'draw'; g.end = Date.now() + r.opts.draw * 1000; g.drawStart = Date.now();
    // 힌트를 여는 때 (40% · 65% · 85% 지났을 때, 글자 수에 따라)
    const n = [...w].filter((ch) => ch !== ' ').length;
    g.hintAt = [0.4, 0.65, 0.85].slice(0, Math.max(0, Math.min(3, n - 1))).map((f) => g.drawStart + r.opts.draw * 1000 * f);
    this.toRoom(r, { t: 'draw', drawer: g.drawer, hint: hintOf(w, g.open), ms: r.opts.draw * 1000 });
    const d = r.players.find((p) => p.id === g.drawer); if (d) this.send(d, { t: 'mine', word: w });
    return true;
  }
  onMessage(c, m, r) {
    const g = r.g; if (!g || r.state !== 'run') return;
    if (m.t === 'topic' && c.id === g.drawer && g.phase === 'pick') { if (!this.setTopic(r, m.word)) this.send(c, { t: 'error', text: '주제를 1~20글자로 써 주세요' }); return; }
    // 그림: 지금 그리는 획을 통째로(i 번째) · 되돌리기 · 다 지우기 → 다른 사람에게 그대로
    if (c.id === g.drawer && g.phase === 'draw') {
      if (m.t === 'sd') { const i = Math.max(0, Math.min(g.strokes.length, m.i | 0)), s = cleanStrokes([m.s])[0]; if (!s || i > 800) return; g.strokes[i] = s; this.toRoom(r, { t: 'sd', i, s }, c); return; }
      if (m.t === 'su') { g.strokes.pop(); this.toRoom(r, { t: 'su' }, c); return; }
      if (m.t === 'sc') { g.strokes = []; this.toRoom(r, { t: 'sc' }, c); return; }
    }
    if (m.t === 'guess') {
      const text = clean(m.text, 30); if (!text) return;
      const now = Date.now();
      if (now - (c.guessAt || 0) < 400) return; c.guessAt = now;
      // 그리는 사람 · 이미 맞힌 사람 · 그리는 중이 아닐 때는 그냥 채팅처럼 (정답은 가린다)
      if (g.phase !== 'draw' || c.id === g.drawer || g.got.has(c.id)) { const hide = g.phase === 'draw' && normWord(text).includes(g.norm); this.toRoom(r, { t: 'gs', id: c.id, text: hide ? null : text, side: true }); return; }
      if (normWord(text) === g.norm) {
        // 빨리 맞힐수록 · 먼저 맞힐수록 점수가 크다 · 그린 사람도 함께
        const left = Math.max(0, (g.end - now) / (r.opts.draw * 1000)), order = g.got.size;
        const pts = Math.round(100 + 200 * left) - order * 15;
        g.got.set(c.id, pts); g.score.set(c.id, (g.score.get(c.id) || 0) + Math.max(40, pts)); g.score.set(g.drawer, (g.score.get(g.drawer) || 0) + 50);
        this.toRoom(r, { t: 'gs', id: c.id, ok: true, pts: Math.max(40, pts), score: Object.fromEntries(g.score) });
        this.send(c, { t: 'mine', word: g.word });
        const guessers = r.players.filter((p) => p.id !== g.drawer).length;
        if (g.got.size >= guessers) this.endTurn(r, true);
        else if (g.got.size === 1) g.end = Math.min(g.end, now + Math.max(15000, (g.end - now) * 0.6)); // 첫 정답이 나오면 남은 시간을 줄인다
        return;
      }
      const close = near(normWord(text), g.norm);
      this.toRoom(r, { t: 'gs', id: c.id, text });
      if (close) this.send(c, { t: 'close', text });
    }
  }
  endTurn(r, all) {
    const g = r.g; if (g.phase !== 'draw' && g.phase !== 'pick') return;
    const skipped = g.phase === 'pick';
    g.phase = 'reveal';
    this.toRoom(r, { t: 'reveal', word: g.word, drawer: g.drawer, got: Object.fromEntries(g.got), all: !!all, skipped, score: Object.fromEntries(g.score) });
    setTimeout(() => this.nextTurn(r), REVEAL_MS);
  }
  onTick(r, now) {
    const g = r.g; if (!g || g.ended) return;
    if (g.phase === 'pick' && now > g.end) {
      // 안 고르면 추천 주제 하나로
      const w = pickPrompts(1)[0]; this.setTopic(r, w);
      const d = r.players.find((p) => p.id === g.drawer); if (d) this.send(d, { t: 'auto', word: w });
    }
    if (g.phase === 'draw') {
      while (g.hintAt.length && now >= g.hintAt[0]) {
        g.hintAt.shift();
        const idx = [...g.word].map((ch, i) => i).filter((i) => g.word[i] !== ' ' && !g.open.has(i));
        if (idx.length > 1) { g.open.add(idx[Math.floor(Math.random() * idx.length)]); this.toRoom(r, { t: 'hint', hint: hintOf(g.word, g.open) }); }
      }
      if (now > g.end) this.endTurn(r, false);
    }
  }
  onLeave(r, c) {
    const g = r.g; if (!g || r.state !== 'run') return;
    if (r.players.filter((p) => p !== c).length < 2) return this.finishSketch(r);
    if (c.id === g.drawer && (g.phase === 'pick' || g.phase === 'draw')) this.endTurn(r, false);
  }
  finishSketch(r) {
    const g = r.g; if (!g || g.ended) return; g.ended = true;
    const rank = r.players.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, score: g.score.get(p.id) || 0 }))
      .sort((a, b) => b.score - a.score).map((e, i, a) => ({ ...e, rank: i && a[i - 1].score === e.score ? null : i + 1 }));
    rank.forEach((e, i) => { if (e.rank == null) e.rank = rank[i - 1].rank; });
    r.g = null;
    this.end(r, { rank });
  }
}
