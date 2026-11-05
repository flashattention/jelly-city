// 드림 러너: 최고 기록 리더보드 (계정마다 가장 좋은 기록 하나). 체험판 계정도 순위에 오른다
// 비로그인은 브라우저마다 만든 임시 아이디(anon) + 직접 정한 닉네임으로 남긴다
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../auth.js';
import { DIFFS, diffOf } from '../../public/dream-runner/js/diff.js';

const MAX_SPEED = 50;
const MAX_SPEED_ITEM = 75; // 아이템전: 로켓 · 순간이동이 있어서 더 넉넉하게      // 게임 속 최고 속도(30m/s × 가속 1.5)보다 넉넉하게: 이보다 빠른 기록은 조작으로 본다
const TOP = 50;
const STAR_PTS = 10;       // 별사탕 하나 = 10점

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class DreamBoard {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'dream-runner.json');
    this.best = {};   // 스피드전: sub → { name, color, score, dist, stars, themes, time, at, guest }
    this.bestItem = {}; // 아이템전
    this.boards = {};   // 이지 말고 다른 난이도: 'speed:hard' → { sub → 기록 } (이지는 위 둘을 그대로 쓴다)
    this.stats = {};    // sub → { runs, time, by: { easy: { runs, time } } } (순위와 상관없이 달린 판수 · 시간)
    this.runs = 0;
    this.lastPost = new Map();
    this.lastPlay = new Map();
    this.ipHits = new Map();
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.best = d.best || {}; this.bestItem = d.bestItem || {}; this.boards = d.boards || {}; this.stats = d.stats || {}; this.runs = d.runs || 0;
    } catch { /* 처음 */ }
    this.dirty = false;
    setInterval(() => this.save(), 20000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ best: this.best, bestItem: this.bestItem, boards: this.boards, stats: this.stats, runs: this.runs })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('드림 러너 저장 실패', e); }
  }
  // map: 'hell' 은 난이도마다 따로 (꿈나라 이지는 예전 표 그대로)
  table(mode, diff, map = 'dream') { if (map === 'hell') return (this.boards[`hell:${mode}:${diff}`] ||= {}); if (diff !== 'easy') return (this.boards[`${mode}:${diff}`] ||= {}); return mode === 'item' ? this.bestItem : this.best; }
  sorted(mode, diff, map) { return Object.entries(this.table(mode, diff, map)).sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at); }
  top(mode, diff, map) {
    return this.sorted(mode, diff, map).slice(0, TOP).map(([sub, e], i) => ({ rank: i + 1, id: sub.slice(-8), name: e.name, color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon }));
  }
  mine(sub, mode, diff, map) {
    const T = this.table(mode, diff, map);
    if (!sub || !T[sub]) return null;
    const i = this.sorted(mode, diff, map).findIndex(([s]) => s === sub);
    const e = T[sub];
    return { rank: i + 1, id: sub.slice(-8), name: e.name, color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon };
  }
  // 달린 기록: 탈락 · 그만두기 · 팀전 끝 모두 센다 (순위에 올리지 않아도 센다)
  played(sub, b) {
    const now = Date.now(), time = Number(b.time);
    if (now - (this.lastPlay.get(sub) || 0) < 2000) throw new Error('너무 빨라요');
    if (!Number.isFinite(time) || time < 3 || time > 4 * 3600) throw new Error('기록이 이상해요');
    this.lastPlay.set(sub, now);
    const s = (this.stats[sub] ||= { runs: 0, time: 0, by: {} }), d = (s.by[diffOf(b.diff)] ||= { runs: 0, time: 0 });
    s.runs++; s.time += Math.round(time); d.runs++; d.time += Math.round(time); this.dirty = true;
  }
  // 내 기록 한눈에: 판수 · 시간 · 난이도 · 모드별 지금 순위
  myStats(sub, map = 'dream') {
    const s = (sub && this.stats[sub]) || { runs: 0, time: 0, by: {} }, diffs = {};
    for (const k of Object.keys(DIFFS)) {
      const row = { runs: s.by[k]?.runs || 0, time: s.by[k]?.time || 0 };
      for (const mode of ['speed', 'item']) { const m = this.mine(sub, mode, k, map); row[mode] = m ? { rank: m.rank, score: m.score, of: Object.keys(this.table(mode, k, map)).length } : null; }
      diffs[k] = row;
    }
    return { runs: s.runs, time: s.time, diffs };
  }
  // 한 판 끝: 말이 안 되는 기록은 거르고, 점수는 서버가 다시 계산한다
  submit(who, b) {
    const now = Date.now();
    if (now - (this.lastPost.get(who.sub) || 0) < 2500) throw new Error('너무 빨라요');
    this.lastPost.set(who.sub, now);
    const time = Number(b.time), dist = Math.floor(Number(b.dist)), stars = Math.floor(Number(b.stars)), themes = Math.floor(Number(b.themes));
    if (![time, dist, stars, themes].every(Number.isFinite) || time < 1 || time > 4 * 3600 || dist < 0 || stars < 0 || themes < 1) throw new Error('기록이 이상해요');
    const mode = b.mode === 'item' ? 'item' : 'speed', diff = diffOf(b.diff), map = b.map === 'hell' ? 'hell' : 'dream', T = this.table(mode, diff, map), k = DIFFS[diff].k;
    if (dist > time * (mode === 'item' ? MAX_SPEED_ITEM : MAX_SPEED) * k + 60 || stars > dist / 2 + 5 || themes > (time / 15) * k * (DIFFS[diff].full ? 1.5 : 1) + 3) throw new Error('기록이 이상해요');
    const score = dist + stars * STAR_PTS;
    this.runs++; this.dirty = true;
    const name = clean(b.name, 14) || clean(who.user.nick || (who.user.guest ? who.user.name : ''), 14) || '꿈꾸는 곰돌이'; // 구글 실명은 쓰지 않는다
    const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#8a5634';
    const old = T[who.sub];
    const newBest = !old || score > old.score;
    if (newBest) T[who.sub] = { name, color, score, dist, stars, themes, time: Math.round(time), at: now, guest: !!who.user.guest, anon: !!who.user.anon };
    else { old.name = name; old.color = color; } // 이름·색은 최근 것으로
    return { score, mode, diff, map, newBest, prev: old?.score || 0, me: this.mine(who.sub, mode, diff, map), top: this.top(mode, diff, map), runs: this.runs };
  }
}

// /api/dream/* : 순위 보기는 누구나. 기록 올리기는 로그인(구글 · 체험판)이거나, 비로그인이면 임시 아이디 + 닉네임
const ANON = /^[a-f0-9]{16,40}$/;
export async function dreamApi(req, res, url, who, board, json) {
  const anonId = url.searchParams.get('anon');
  const mode = url.searchParams.get('mode') === 'item' ? 'item' : 'speed', diff = diffOf(url.searchParams.get('diff')), map = url.searchParams.get('map') === 'hell' ? 'hell' : 'dream';
  if (url.pathname === '/api/dream/board') return json(res, 200, { mode, diff, map, top: board.top(mode, diff, map), me: board.mine(who?.sub || (ANON.test(anonId || '') ? 'anon:' + anonId : null), mode, diff, map), runs: board.runs });
  if (url.pathname === '/api/dream/me') return json(res, 200, board.myStats(who?.sub || (ANON.test(anonId || '') ? 'anon:' + anonId : null), map));
  if (url.pathname === '/api/dream/played' && req.method === 'POST') {
    const b = await readJson(req);
    if (!who && !ANON.test(String(b.anon || ''))) return json(res, 401, { error: 'login' });
    if (!who) { // 비로그인은 한 곳(IP)에서 너무 자주 못 올린다
      const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '', now = Date.now(), hits = (board.ipHits.get('p:' + ip) || []).filter((t) => now - t < 60000);
      if (hits.length >= 20) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
      hits.push(now); board.ipHits.set('p:' + ip, hits);
    }
    try { board.played(who?.sub || 'anon:' + b.anon, b); return json(res, 200, { ok: true }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
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
