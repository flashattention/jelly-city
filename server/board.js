// 메인 화면 게시판: 글 · 댓글 · 좋아요/싫어요 · 신고. 보는 건 누구나, 쓰고 누르는 건 로그인(구글 · 체험판)한 사람만
//   화면에 나가는 건 닉네임뿐이다. 계정 id · 이메일은 저장만 하고 절대 내보내지 않는다
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson } from './auth.js';

const TITLE_MAX = 60, BODY_MAX = 2000, COMMENT_MAX = 500, MAX_POSTS = 3000, MAX_COMMENTS = 300, PAGE = 10;
const POST_GAP = 30000, COMMENT_GAP = 5000, HIDE_AT = 5; // 신고 점수가 이만큼이면 가린다 (체험판 신고는 0.5점)
const oneLine = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const multiLine = (s, n) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, n);
const newId = () => crypto.randomBytes(6).toString('hex');
const tally = (votes) => { let up = 0, down = 0; for (const v of Object.values(votes)) if (v > 0) up++; else down++; return { up, down }; };

export class Board {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'board.json');
    this.posts = []; this.lastPost = new Map(); this.lastComment = new Map(); this.ipHits = new Map();
    try { this.posts = JSON.parse(fs.readFileSync(this.file, 'utf8')).posts || []; } catch { /* 처음 */ }
    this.dirty = false;
    setInterval(() => this.save(), 10000).unref();
  }
  save() {
    if (!this.dirty) return; this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ posts: this.posts })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('게시판 저장 실패', e.message); }
  }
  find(id) { const p = this.posts.find((q) => q.id === id); if (!p) throw new Error('글이 없어요'); return p; }
  item(id, cid) { const p = this.find(id); if (!cid) return p; const c = p.comments.find((q) => q.id === cid); if (!c) throw new Error('댓글이 없어요'); return c; }
  hiddenFor(it, sub, admin) { return it.hidden && !admin && it.sub !== sub; }
  card(p, sub, admin) {
    const { up, down } = tally(p.votes), hide = this.hiddenFor(p, sub, admin);
    return { id: p.id, title: hide ? '🚫 신고가 많아 가려진 글이에요' : p.title, name: p.name, at: p.at, up, down, my: p.votes[sub] || 0, comments: p.comments.length, hidden: !!p.hidden, mine: !!sub && p.sub === sub };
  }
  list(sort, page, sub, admin) {
    const all = [...this.posts];
    if (sort === 'hot') { const score = (p) => { const { up, down } = tally(p.votes); return up - down + p.comments.length * 0.5; }; all.sort((a, b) => score(b) - score(a) || b.at - a.at); } else all.sort((a, b) => b.at - a.at);
    const start = Math.max(0, page) * PAGE;
    return { total: all.length, page: PAGE, posts: all.slice(start, start + PAGE).map((p) => this.card(p, sub, admin)) };
  }
  detail(id, sub, admin) {
    const p = this.find(id), hide = this.hiddenFor(p, sub, admin);
    return { ...this.card(p, sub, admin), body: hide ? '' : p.body, admin: !!admin, comments: p.comments.map((c) => { const { up, down } = tally(c.votes), h = this.hiddenFor(c, sub, admin); return { id: c.id, name: c.name, at: c.at, text: h ? '🚫 신고가 많아 가려진 댓글이에요' : c.text, up, down, my: c.votes[sub] || 0, hidden: !!c.hidden, mine: !!sub && c.sub === sub }; }) };
  }
  write(sub, name, b, now = Date.now()) {
    if (now - (this.lastPost.get(sub) || 0) < POST_GAP) throw new Error('글은 30초에 한 번만 쓸 수 있어요');
    const title = oneLine(b.title, TITLE_MAX), body = multiLine(b.body, BODY_MAX);
    if (!title) throw new Error('제목을 써 주세요'); if (!body) throw new Error('내용을 써 주세요');
    this.lastPost.set(sub, now);
    const p = { id: newId(), sub, name, title, body, at: now, votes: {}, reports: {}, comments: [] };
    this.posts.push(p); if (this.posts.length > MAX_POSTS) this.posts.shift();
    this.dirty = true; return p;
  }
  comment(sub, name, id, b, now = Date.now()) {
    if (now - (this.lastComment.get(sub) || 0) < COMMENT_GAP) throw new Error('댓글은 5초에 한 번만 쓸 수 있어요');
    const p = this.find(id), text = multiLine(b.text, COMMENT_MAX);
    if (!text) throw new Error('내용을 써 주세요'); if (p.comments.length >= MAX_COMMENTS) throw new Error('댓글이 너무 많아요');
    this.lastComment.set(sub, now);
    p.comments.push({ id: newId(), sub, name, text, at: now, votes: {}, reports: {} }); this.dirty = true;
  }
  // 같은 쪽을 다시 누르면 취소, 반대쪽을 누르면 바뀐다
  vote(sub, id, cid, v) {
    const it = this.item(id, cid); if (v !== 1 && v !== -1) throw new Error('잘못된 요청이에요');
    if (it.votes[sub] === v) delete it.votes[sub]; else it.votes[sub] = v;
    this.dirty = true; return { ...tally(it.votes), my: it.votes[sub] || 0 };
  }
  remove(sub, admin, id, cid) {
    const p = this.find(id), it = cid ? this.item(id, cid) : p;
    if (it.sub !== sub && !admin) throw new Error('내가 쓴 것만 지울 수 있어요');
    if (cid) p.comments = p.comments.filter((c) => c !== it); else this.posts = this.posts.filter((q) => q !== p);
    this.dirty = true;
  }
  report(sub, guest, id, cid) {
    const it = this.item(id, cid); if (it.sub === sub) throw new Error('내 글은 신고할 수 없어요');
    it.reports[sub] = guest ? 0.5 : 1;
    if (Object.values(it.reports).reduce((a, v) => a + v, 0) >= HIDE_AT) it.hidden = true;
    this.dirty = true;
  }
  unhide(id, cid) { const it = this.item(id, cid); it.hidden = false; it.reports = {}; this.dirty = true; }
}

export async function boardApi(req, res, url, who, board, json, isAdmin) {
  const sub = who?.sub || null, admin = !!who && isAdmin(who.user), id = url.searchParams.get('id');
  try {
    if (req.method === 'GET') {
      if (url.pathname === '/api/board/list') return json(res, 200, board.list(url.searchParams.get('sort') === 'hot' ? 'hot' : 'new', Math.floor(+url.searchParams.get('page')) || 0, sub, admin));
      if (url.pathname === '/api/board/post') return json(res, 200, board.detail(String(id), sub, admin));
      return json(res, 404, { error: 'not found' });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'POST 로 보내 주세요' });
    if (!who) return json(res, 401, { error: 'login' });
    // 한 곳(IP)에서 너무 많이 못 보낸다 (체험판 계정을 여러 개 만들어 도배하지 못하게)
    const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '', now = Date.now(), hits = (board.ipHits.get(ip) || []).filter((t) => now - t < 60000);
    if (hits.length >= 60) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
    hits.push(now); board.ipHits.set(ip, hits);
    const b = await readJson(req, 16 * 1024), pid = String(b.id || ''), cid = b.cid ? String(b.cid) : null;
    const name = oneLine(who.user.nick || (who.user.guest ? who.user.name : ''), 14);
    switch (url.pathname) {
      case '/api/board/write': if (!name) return json(res, 400, { error: '닉네임을 먼저 정해 주세요' }); return json(res, 200, { id: board.write(sub, name, b).id });
      case '/api/board/comment': if (!name) return json(res, 400, { error: '닉네임을 먼저 정해 주세요' }); board.comment(sub, name, pid, b); return json(res, 200, board.detail(pid, sub, admin));
      case '/api/board/vote': return json(res, 200, board.vote(sub, pid, cid, b.v));
      case '/api/board/delete': board.remove(sub, admin, pid, cid); return json(res, 200, { ok: true });
      case '/api/board/report': board.report(sub, !!who.user.guest, pid, cid); return json(res, 200, { ok: true });
      case '/api/board/unhide': if (!admin) return json(res, 403, { error: '관리자만 할 수 있어요' }); board.unhide(pid, cid); return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) { return json(res, 400, { error: e.message }); }
}
