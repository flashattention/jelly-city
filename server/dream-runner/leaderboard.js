// 드림 러너: 최고 기록 리더보드 (계정마다 가장 좋은 기록 하나). 체험판 계정도 순위에 오른다
// 비로그인은 브라우저마다 만든 임시 아이디(anon) + 직접 정한 닉네임으로 남긴다
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../auth.js';

const MAX_SPEED = 40;      // 게임 속 최고 속도(m/s)보다 넉넉하게: 이보다 빠른 기록은 조작으로 본다
const TOP = 50;
const STAR_PTS = 10;       // 별사탕 하나 = 10점

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class DreamBoard {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'dream-runner.json');
    this.best = {};   // sub → { name, color, score, dist, stars, themes, time, at, guest }
    this.runs = 0;
    this.lastPost = new Map();
    this.ipHits = new Map();
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.best = d.best || {}; this.runs = d.runs || 0;
    } catch { /* 처음 */ }
    this.dirty = false;
    setInterval(() => this.save(), 20000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ best: this.best, runs: this.runs })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('드림 러너 저장 실패', e); }
  }
  sorted() { return Object.entries(this.best).sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at); }
  top() {
    return this.sorted().slice(0, TOP).map(([sub, e], i) => ({ rank: i + 1, id: sub.slice(-8), name: e.name, color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon }));
  }
  mine(sub) {
    if (!sub || !this.best[sub]) return null;
    const i = this.sorted().findIndex(([s]) => s === sub);
    const e = this.best[sub];
    return { rank: i + 1, id: sub.slice(-8), name: e.name, color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon };
  }
  // 한 판 끝: 말이 안 되는 기록은 거르고, 점수는 서버가 다시 계산한다
  submit(who, b) {
    const now = Date.now();
    if (now - (this.lastPost.get(who.sub) || 0) < 2500) throw new Error('너무 빨라요');
    this.lastPost.set(who.sub, now);
    const time = Number(b.time), dist = Math.floor(Number(b.dist)), stars = Math.floor(Number(b.stars)), themes = Math.floor(Number(b.themes));
    if (![time, dist, stars, themes].every(Number.isFinite) || time < 1 || time > 4 * 3600 || dist < 0 || stars < 0 || themes < 1) throw new Error('기록이 이상해요');
    if (dist > time * MAX_SPEED + 30 || stars > dist / 2 + 5 || themes > time / 15 + 3) throw new Error('기록이 이상해요');
    const score = dist + stars * STAR_PTS;
    this.runs++; this.dirty = true;
    const name = clean(b.name, 14) || (who.user.anon ? '' : clean(who.user.name, 14)) || '꿈꾸는 곰돌이';
    const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#8a5634';
    const old = this.best[who.sub];
    const newBest = !old || score > old.score;
    if (newBest) this.best[who.sub] = { name, color, score, dist, stars, themes, time: Math.round(time), at: now, guest: !!who.user.guest, anon: !!who.user.anon };
    else { old.name = name; old.color = color; } // 이름·색은 최근 것으로
    return { score, newBest, prev: old?.score || 0, me: this.mine(who.sub), top: this.top(), runs: this.runs };
  }
}

// /api/dream/* : 순위 보기는 누구나. 기록 올리기는 로그인(구글 · 체험판)이거나, 비로그인이면 임시 아이디 + 닉네임
const ANON = /^[a-f0-9]{16,40}$/;
export async function dreamApi(req, res, url, who, board, json) {
  const anonId = url.searchParams.get('anon');
  if (url.pathname === '/api/dream/board') return json(res, 200, { top: board.top(), me: board.mine(who?.sub || (ANON.test(anonId || '') ? 'anon:' + anonId : null)), runs: board.runs });
  if (url.pathname === '/api/dream/score' && req.method === 'POST') {
    const b = await readJson(req);
    if (!who) {
      if (!ANON.test(String(b.anon || ''))) return json(res, 401, { error: 'login' });
      if (!clean(b.name, 14)) return json(res, 400, { error: '닉네임을 정해 주세요' });
      // 비로그인은 한 곳(IP)에서 너무 자주 못 올린다 (1분에 20번)
      const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '';
      const now = Date.now(), hits = (board.ipHits.get(ip) || []).filter((t) => now - t < 60000);
      if (hits.length >= 20) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
      hits.push(now); board.ipHits.set(ip, hits);
      who = { sub: 'anon:' + b.anon, user: { name: '', anon: true } };
    }
    try { return json(res, 200, board.submit(who, b)); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  return json(res, 404, { error: 'not found' });
}
