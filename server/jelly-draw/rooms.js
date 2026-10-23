// 젤리 그림릴레이 방 (텔레스트레이션 방식): 최대 8명 · 제시어 → 그림 → 맞히기 → 그림 … 을 그림책마다 한 칸씩 돌려 가며
//   모두 같은 순간에 각자 다른 그림책을 맡는다. 끝나면 그림책을 한 권씩 함께 넘겨 보고 ❤️ 를 준다
import { BaseRooms, clean } from '../shared/rooms.js';
import { pickPrompts, normWord } from '../../public/jelly-draw/js/prompts.js';

const WORD_MS = 25000, GUESS_MS = 30000, GRACE = 2500;
// 그림 자료: [[색 번호, 굵기, x, y, x, y, …], …] (0~1000 좌표 정수) · 너무 크면 자른다
export function cleanStrokes(st) {
  if (!Array.isArray(st)) return [];
  const out = []; let pts = 0;
  for (const s of st.slice(0, 600)) {
    if (!Array.isArray(s) || s.length < 4) continue;
    const c = Math.max(0, Math.min(15, Math.round(Number(s[0]) || 0))), w = Math.max(1, Math.min(80, Math.round(Number(s[1]) || 6)));
    const xy = [];
    for (let i = 2; i + 1 < s.length && pts < 12000; i += 2) { const x = Math.round(Number(s[i])), y = Math.round(Number(s[i + 1])); if (!Number.isFinite(x) || !Number.isFinite(y)) continue; xy.push(Math.max(-50, Math.min(1050, x)), Math.max(-50, Math.min(800, y))); pts++; }
    if (xy.length >= 2) out.push([c, w, ...xy]);
  }
  return out;
}

export class DrawRooms extends BaseRooms {
  constructor(userOf) { super(userOf, { max: 8, hz: 2, countdown: 3000, defaults: { draw: 80 } }); }
  allow(cur, n) { return { draw: [60, 80, 100].includes(Number(n.draw)) ? Number(n.draw) : cur.draw }; }
  handle(c, m) {
    if (m.t === 'start' && c.room && c.room.host === c && c.room.state === 'wait' && c.room.players.length < 2) return this.send(c, { t: 'error', text: '그림릴레이는 2명 이상이 있어야 해요. 초대 링크로 친구를 불러 주세요!' });
    return super.handle(c, m);
  }
  onStart(r) {
    const P = [...r.players].sort(() => Math.random() - 0.5), N = P.length;
    const steps = N % 2 === 0 ? N + 1 : N; // 마지막은 언제나 '맞히기'
    r.g = { P, N, steps, k: -1, books: P.map((p) => ({ owner: p.id, items: [] })), likes: {}, sub: new Set(), phaseEnd: 0, reveal: null, ended: false };
    r.g.choices = new Map(P.map((p) => [p.id, pickPrompts(3)]));
    setTimeout(() => this.next(r), Math.max(0, r.startAt - Date.now()));
    return { order: P.map((p) => p.id), steps };
  }
  kindOf(k) { return k === 0 ? 'word' : k % 2 ? 'draw' : 'guess'; }
  bookOf(g, j, k) { return ((j - k) % g.N + g.N) % g.N; } // k 번째 단계에서 j 번째 사람이 맡는 그림책
  next(r) {
    const g = r.g; if (!g || g.ended || r.state !== 'run') return;
    this.fillMissing(g);
    g.k++;
    if (g.k >= g.steps) return this.startReveal(r);
    g.sub.clear();
    const kind = this.kindOf(g.k), ms = kind === 'word' ? WORD_MS : kind === 'draw' ? r.opts.draw * 1000 : GUESS_MS;
    g.phaseEnd = Date.now() + ms;
    g.P.forEach((p, j) => {
      const b = g.books[this.bookOf(g, j, g.k)], prev = b.items[g.k - 1];
      const prompt = prev ? { kind: prev.kind, by: prev.by, text: prev.text, strokes: prev.strokes } : null;
      this.send(p, { t: 'phase', k: g.k, steps: g.steps, kind, dl: ms, prompt, choices: kind === 'word' ? g.choices.get(p.id) : null, book: b.owner });
    });
  }
  onMessage(c, m, r) {
    const g = r.g; if (!g || r.state !== 'run') return;
    if (m.t === 'sub' && g.k >= 0 && !g.reveal && m.k === g.k && !g.sub.has(c.id)) {
      const j = g.P.indexOf(c); if (j < 0) return;
      const b = g.books[this.bookOf(g, j, g.k)], kind = this.kindOf(g.k);
      const item = { kind, by: c.id };
      if (kind === 'draw') item.strokes = cleanStrokes(m.strokes);
      else item.text = clean(m.text, 24) || (kind === 'word' ? g.choices.get(c.id)?.[0] : '(모르겠어요)');
      b.items[g.k] = item;
      g.sub.add(c.id);
      this.toRoom(r, { t: 'done', id: c.id, n: g.sub.size, of: g.P.filter((p) => r.players.includes(p)).length });
      if (g.P.every((p) => g.sub.has(p.id) || !r.players.includes(p))) this.next(r);
      return;
    }
    // 함께 넘겨 보기: 방장이 넘긴다
    if (m.t === 'rv' && g.reveal && c === r.host) {
      const b = Math.max(0, Math.min(g.N - 1, Math.round(Number(m.b) || 0))), i = Math.max(0, Math.min(g.steps - 1, Math.round(Number(m.i) || 0)));
      g.reveal = { b, i };
      return this.toRoom(r, { t: 'rv', b, i });
    }
    if (m.t === 'like' && g.reveal) {
      const key = `${Math.round(Number(m.b))}:${Math.round(Number(m.i))}`, item = g.books[Math.round(Number(m.b))]?.items[Math.round(Number(m.i))];
      if (!item || item.by === c.id) return;
      const set = (g.likes[key] ||= new Set());
      if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
      return this.toRoom(r, { t: 'like', b: Math.round(Number(m.b)), i: Math.round(Number(m.i)), n: set.size, by: c.id, on: set.has(c.id) });
    }
    if (m.t === 'endrv' && g.reveal && c === r.host) return this.finish(r);
  }
  onTick(r, now) {
    const g = r.g; if (!g || g.ended || g.reveal || g.k < 0) return;
    if (now > g.phaseEnd + GRACE) this.next(r);
  }
  // 시간 안에 못 냈거나 나간 사람의 칸: 빈 그림 · '(시간 초과)'
  fillMissing(g) {
    if (g.k < 0) return;
    g.P.forEach((p, j) => {
      const b = g.books[this.bookOf(g, j, g.k)], kind = this.kindOf(g.k);
      if (b.items[g.k]) return;
      b.items[g.k] = kind === 'draw' ? { kind, by: p.id, strokes: [] } : { kind, by: p.id, text: kind === 'word' ? g.choices.get(p.id)?.[0] : '(시간 초과)' };
    });
  }
  startReveal(r) {
    const g = r.g;
    g.reveal = { b: 0, i: 0 };
    this.toRoom(r, { t: 'reveal', books: g.books, steps: g.steps, host: r.host?.id });
  }
  onLeave(r) {
    const g = r.g; if (!g || g.ended) return;
    if (!g.reveal && g.k >= 0 && g.P.every((p) => g.sub.has(p.id) || !r.players.includes(p))) this.next(r);
  }
  finish(r) {
    const g = r.g; if (!g || g.ended) return;
    g.ended = true;
    // 인기 그림 · 그대로 전해진 그림책
    let best = null;
    for (const [key, set] of Object.entries(g.likes)) { if (!best || set.size > best.n) { const [b, i] = key.split(':').map(Number); best = { b, i, n: set.size, by: g.books[b].items[i].by, kind: g.books[b].items[i].kind, strokes: g.books[b].items[i].strokes, text: g.books[b].items[i].text }; } }
    const perfect = g.books.filter((b) => normWord(b.items[0]?.text) && normWord(b.items[0]?.text) === normWord(b.items[g.steps - 1]?.text)).map((b) => ({ owner: b.owner, word: b.items[0].text }));
    const hearts = {};
    for (const [key, set] of Object.entries(g.likes)) { const [b, i] = key.split(':').map(Number); const by = g.books[b].items[i].by; hearts[by] = (hearts[by] || 0) + set.size; }
    const rank = g.P.map((p) => ({ id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, hearts: hearts[p.id] || 0 })).sort((a, b) => b.hearts - a.hearts).map((e, i) => ({ ...e, rank: i + 1 }));
    this.end(r, { rank, best: best && best.n ? best : null, perfect, books: g.N });
  }
}
