// 드림 러너: 최고 기록 리더보드 (계정마다 가장 좋은 기록 하나). 체험판 계정도 순위에 오른다
// 비로그인은 브라우저마다 만든 임시 아이디(anon) + 직접 정한 닉네임으로 남긴다
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../auth.js';
import { DIFFS, diffOf } from '../../public/dream-runner/js/diff.js';
import { getCos } from '../cosmetics.js';
import crypto from 'node:crypto';
import { Tickets, ReplayPool, decodeReplay } from './verify.js';

const MAX_SPEED = 50;
const MAX_SPEED_ITEM = 75; // 아이템전: 로켓 · 순간이동이 있어서 더 넉넉하게      // 게임 속 최고 속도(30m/s × 가속 1.5)보다 넉넉하게: 이보다 빠른 기록은 조작으로 본다
const TOP = 50;
const STAR_PTS = 10;       // 별사탕 하나 = 10점
const TOP_GUARD = 10, DAY_STARS = 300000; // 확인 안 된 기록은 이 순위 안으로 바로 못 들어온다 · 하루에 벌 수 있는 별 (사람이 닿지 못할 만큼 넉넉하게)

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

export class DreamBoard {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'dream-runner.json');
    this.best = {};   // 스피드전: sub → { name, color, score, dist, stars, themes, time, at, guest }
    this.bestItem = {}; // 아이템전
    this.boards = {};   // 노멀(easy) 말고 다른 난이도: 'speed:hard' → { sub → 기록 } (노멀은 위 둘을 그대로 쓴다)
    this.stats = {};    // sub → { runs, time, by: { easy: { runs, time } } } (순위와 상관없이 달린 판수 · 시간)
    this.runs = 0; this.pending = []; this.secret = crypto.randomBytes(24).toString('hex'); this.vstat = { ok: 0, bad: 0, none: 0, skip: 0 }; this.dayStars = new Map();
    this.lastPost = new Map();
    this.lastPlay = new Map();
    this.ipHits = new Map();
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.best = d.best || {}; this.bestItem = d.bestItem || {}; this.boards = d.boards || {}; this.stats = d.stats || {}; this.runs = d.runs || 0; this.pending = d.pending || []; this.secret = d.secret || this.secret;
    } catch { /* 처음 */ }
    this.dirty = false; this.tickets = new Tickets(this.secret); this.pool = new ReplayPool();
    setInterval(() => this.save(), 20000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ best: this.best, bestItem: this.bestItem, boards: this.boards, stats: this.stats, runs: this.runs, pending: this.pending, secret: this.secret })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('드림 러너 저장 실패', e); }
  }
  // map: 'hell' 은 난이도마다 따로 (꿈나라 노멀은 예전 표 그대로)
  table(mode, diff, map = 'dream') { if (map === 'hell') return (this.boards[`hell:${mode}:${diff}`] ||= {}); if (diff !== 'easy') return (this.boards[`${mode}:${diff}`] ||= {}); return mode === 'item' ? this.bestItem : this.best; }
  sorted(mode, diff, map) { return Object.entries(this.table(mode, diff, map)).sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at); }
  top(mode, diff, map) {
    return this.sorted(mode, diff, map).slice(0, TOP).map(([sub, e], i) => ({ rank: i + 1, id: sub.slice(-8), title: getCos()?.titleOf(sub) || null, medal: getCos()?.medalOf(sub) || null, name: e.name, color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon }));
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
    // 별 지갑: 출발표 한 장에 한 번. 실제로 지난 시간 · 거리에 비해 말이 안 되는 별은 받지 않는다
    const diff = diffOf(b.diff), stars = Math.floor(Number(b.stars)) || 0, dist = Math.floor(Number(b.dist)) || 0, tk = this.tickets.read(b.tk);
    const real = tk ? (now - tk.at) / 1000 : 0, inTime = tk ? dist <= real * 80 * DIFFS[diff].k + 60 : stars <= 300; // 출발표를 못 받았으면(서버 점검) 적게만
    if (stars > 0 && stars <= dist / 2 + 5 && dist <= time * 80 * DIFFS[diff].k + 60 && inTime && (!tk || this.tickets.once(tk.id, 'stars'))) {
      const day = Math.floor(now / 864e5), dk = `${sub}:${day}`, used = this.dayStars.get(dk) || 0; if (this.dayStars.size > 50000) this.dayStars.clear();
      if (used < DAY_STARS) { const earned = getCos()?.earn(sub, stars, diff, b.map === 'hell' ? 'hell' : 'dream') || 0; this.dayStars.set(dk, used + earned); return { earned }; }
    }
    getCos()?.refresh(sub); return { earned: 0 };
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
  // 혼자 달린 스피드전은 입력 기록을 다시 돌려 확인한다. 애매해도 플레이어를 막지 않는다: 순위 상위에만 바로 못 오르고 사람이 본다
  async check(b, diff, map, mode, now, oldScore) {
    const tk = this.tickets.read(b.tk);
    if (mode !== 'speed' || b.multi) return { ok: false, why: b.multi ? 'multi' : 'item', soft: !!tk };
    const rp = decodeReplay(b.replay);
    if (!rp) { this.vstat.none++; return { ok: false, why: 'noreplay' }; }
    const claim = Math.floor(Number(b.dist)) + Math.floor(Number(b.stars)) * STAR_PTS;
    if (claim <= oldScore) { this.vstat.skip++; return { ok: false, skip: true, why: 'notbest' }; } // 내 최고보다 낮으면 돌려 볼 필요가 없다
    const sum = rp.dts.reduce((a, v) => a + v, 0) / 10000;
    if (tk && (tk.diff !== diff || tk.map !== map || sum > (now - tk.at) / 1000 + 5)) return { ok: false, why: 'time' }; // 기록된 시간이 실제로 지난 시간보다 길면 안 된다
    const seed = tk ? tk.seed : Number(b.seed) | 0;
    const r = await this.pool.run({ seed, diff, map, dts: rp.dts, evs: rp.evs });
    if (!r) return { ok: false, why: 'busy', soft: true };
    // 브라우저마다 소수점 끝자리가 조금 달라도 괜찮게 약간의 오차는 넘어간다
    const dOk = r.dead && Math.abs(r.dist - Number(b.dist)) <= Math.max(3, r.dist * 0.01), sOk = Math.abs(r.stars - Number(b.stars)) <= Math.max(1, r.stars * 0.02);
    if (!dOk || !sOk) { this.vstat.bad++; console.warn(`드림 러너 기록 불일치: 보냄 ${b.dist}m ★${b.stars} / 재생 ${r.dist}m ★${r.stars} (${diff} ${map}, ${rp.dts.length}프레임)`); return { ok: false, why: 'mismatch', r }; }
    this.vstat.ok++; return { ok: true, r, ticket: !!tk };
  }
  ticket(b) { return this.tickets.issue({ seed: Number(b.seed) | 0, diff: diffOf(b.diff), map: b.map === 'hell' ? 'hell' : 'dream', mode: b.mode === 'item' ? 'item' : 'speed' }); }
  // 사람이 볼 목록 · 승인 · 삭제 (삭제하면 그 계정의 드림 러너 업적을 다시 계산하고 별을 거둔다)
  adminList() { const flagged = []; for (const k of ['best', 'bestItem']) for (const [sub, e] of Object.entries(this[k])) if (e.u) flagged.push({ sub, t: k === 'best' ? 'speed:easy' : 'item:easy', ...e }); for (const [t, T] of Object.entries(this.boards)) for (const [sub, e] of Object.entries(T)) if (e.u) flagged.push({ sub, t, ...e }); return { pending: this.pending.slice(-100).reverse(), flagged: flagged.sort((a, b) => b.score - a.score).slice(0, 100), stat: this.vstat }; }
  approve(i) { const p = this.pending.find((x) => x.id === i); if (!p) throw new Error('없어요'); this.pending = this.pending.filter((x) => x !== p); const T = this.table(p.mode, p.diff, p.map), old = T[p.sub]; if (!old || p.e.score > old.score) T[p.sub] = p.e; this.dirty = true; getCos()?.refresh(p.sub); }
  reject(i) { this.pending = this.pending.filter((x) => x.id !== i); this.dirty = true; }
  removeRecord(sub, t) { const [a, b, c] = String(t).split(':'), T = a === 'hell' ? this.boards[t] : b === 'easy' ? (a === 'item' ? this.bestItem : this.best) : this.boards[`${a}:${b}`]; if (T?.[sub]) { delete T[sub]; this.dirty = true; } getCos()?.punish(sub, 'dr.'); void c; }
  // 한 판 끝: 말이 안 되는 기록은 거르고, 점수는 서버가 다시 계산한다
  async submit(who, b) {
    const now = Date.now();
    if (now - (this.lastPost.get(who.sub) || 0) < 2500) throw new Error('너무 빨라요');
    this.lastPost.set(who.sub, now);
    const time = Number(b.time), dist = Math.floor(Number(b.dist)), stars = Math.floor(Number(b.stars)), themes = Math.floor(Number(b.themes));
    if (![time, dist, stars, themes].every(Number.isFinite) || time < 1 || time > 4 * 3600 || dist < 0 || stars < 0 || themes < 1) throw new Error('기록이 이상해요');
    const mode = b.mode === 'item' ? 'item' : 'speed', diff = diffOf(b.diff), map = b.map === 'hell' ? 'hell' : 'dream', T = this.table(mode, diff, map), k = DIFFS[diff].k;
    if (dist > time * (mode === 'item' ? MAX_SPEED_ITEM : MAX_SPEED) * k + 60 || stars > dist / 2 + 5 || themes > (time / 15) * k * 1.5 + 3) throw new Error('기록이 이상해요');
    const score = dist + stars * STAR_PTS;
    this.runs++; this.dirty = true;
    const prevOld = T[who.sub], chk = await this.check(b, diff, map, mode, now, prevOld?.score || 0); // 확인 안 된 기록은 u 표시 (업적 · 왕관 제외)
    const name = clean(b.name, 14) || clean(who.user.nick || (who.user.guest ? who.user.name : ''), 14) || '꿈꾸는 곰돌이'; // 구글 실명은 쓰지 않는다
    const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#8a5634';
    const old = T[who.sub];
    const newBest = !old || score > old.score, entry = { name, color, score, dist, stars, themes, time: Math.round(time), at: now, guest: !!who.user.guest, anon: !!who.user.anon, ...(chk.ok ? { v: 1 } : { u: chk.why }) };
    // 확인 안 된 기록이 상위권으로 들어오려 하면 사람이 볼 때까지 순위표에 올리지 않는다
    if (newBest && !chk.ok && !chk.soft) { const higher = Object.values(T).filter((e) => e.score > score).length; if (higher < TOP_GUARD) { this.pending.push({ id: crypto.randomBytes(5).toString('hex'), sub: who.sub, mode, diff, map, why: chk.why, e: entry, r: chk.r ? { dist: chk.r.dist, stars: chk.r.stars } : null, at: now }); if (this.pending.length > 500) this.pending.shift(); this.dirty = true; console.warn(`드림 러너 기록 확인 대기: ${score}점 (${chk.why})`); return { score, mode, diff, map, pending: true, newBest: false, prev: old?.score || 0, me: this.mine(who.sub, mode, diff, map), top: this.top(mode, diff, map), runs: this.runs }; } }
    if (newBest) T[who.sub] = entry;
    else { old.name = name; old.color = color; } // 이름·색은 최근 것으로
    getCos()?.refresh(who.sub); // 업적: 거리 · 순위
    return { score, mode, diff, map, newBest, prev: old?.score || 0, me: this.mine(who.sub, mode, diff, map), top: this.top(mode, diff, map), runs: this.runs };
  }
}

// /api/dream/* : 순위 보기는 누구나. 기록 올리기는 로그인(구글 · 체험판)이거나, 비로그인이면 임시 아이디 + 닉네임
const ANON = /^[a-f0-9]{16,40}$/;
export async function dreamApi(req, res, url, who, board, json, isAdmin) {
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
    try { return json(res, 200, { ok: true, ...board.played(who?.sub || 'anon:' + b.anon, b) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  // 출발표: 기다리지 않고 시작하고, 뒤에서 받아 둔다
  if (url.pathname === '/api/dream/run' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { tk: board.ticket(b) }); }
  if (url.pathname.startsWith('/api/dream/admin/')) {
    if (!who || !isAdmin?.(who.user)) return json(res, 403, { error: '관리자만 할 수 있어요' });
    if (url.pathname === '/api/dream/admin/list') return json(res, 200, board.adminList());
    const b = await readJson(req);
    try { if (url.pathname === '/api/dream/admin/approve') board.approve(String(b.id)); else if (url.pathname === '/api/dream/admin/reject') board.reject(String(b.id)); else if (url.pathname === '/api/dream/admin/remove') board.removeRecord(String(b.sub), String(b.t)); else return json(res, 404, { error: 'not found' }); return json(res, 200, board.adminList()); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (url.pathname === '/api/dream/score' && req.method === 'POST') {
    const b = await readJson(req, 900 * 1024);
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
    try { return json(res, 200, await board.submit(who, b)); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  return json(res, 404, { error: 'not found' });
}
