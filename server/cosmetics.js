// 치장 · 업적: 계정마다 별 지갑 · 산 것 · 착용 · 달성한 업적을 저장한다. 치장은 모든 게임에서 쓴다
//   착용 정보는 서버가 정한다: 브라우저가 보낸 look.cos 는 버리고 그 계정이 실제로 가진 것만 내보낸다 (1위 왕관을 위조하지 못하게)
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './auth.js';
import { ACHIEVEMENTS, SHOP, itemById, cleanCos, starsEarned, reqText } from '../public/shared/js/cos-items.js';

const ANON = /^[a-f0-9]{16,40}$/, MAX_STARS_RUN = 6000;
// 순위 업적은 겨룬 사람이 있어야 인정한다 (빈 순위표의 1위는 왕관이 아니다)
const MIN_FIELD = { 1: 5, 3: 10, 10: 20 };
let inst = null;
export const getCos = () => inst;
// 방 참가할 때: 그 계정의 진짜 착용 정보로 바꾼다
export function trustLook(look, sub) {
  const out = look && typeof look === 'object' ? { ...look } : null; if (out) delete out.cos;
  const eq = sub ? inst?.equipOf(sub) : null; if (!eq) return out;
  return { ...(out || {}), cos: eq };
}
export class Cosmetics {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'cosmetics.json'); this.users = {}; this.dream = null; this.records = {};
    try { this.users = JSON.parse(fs.readFileSync(this.file, 'utf8')).users || {}; } catch { /* 처음 */ }
    this.dirty = false; setInterval(() => this.save(), 15000).unref(); inst = this;
  }
  save() { if (!this.dirty) return; this.dirty = false; try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ users: this.users })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('치장 저장 실패', e.message); } }
  u(sub) { return (this.users[sub] ||= { stars: 0, total: 0, owned: [], equip: {}, ach: {}, plays: {}, wins: {}, pvp: {}, fresh: [] }); }
  equipOf(sub) { const u = this.users[sub]; return u ? cleanCos(u.equip) : null; }
  titleOf(sub) { const id = this.users[sub]?.equip?.title; return id && itemById.has(id) ? id : null; }
  owns(sub, id) { const u = this.users[sub], it = itemById.get(id); if (!u || !it) return false; return it.shop ? u.owned.includes(id) : !!u.ach[it.ach]; }
  // 한 판 끝: 별을 지갑에 넣는다 (난이도 · 지옥이면 더 많이)
  earn(sub, stars, diff, map) { const n = starsEarned(Math.min(MAX_STARS_RUN, Math.max(0, stars | 0)), diff, map); if (n <= 0) return 0; const u = this.u(sub); u.stars += n; u.total += n; this.dirty = true; this.refresh(sub); return n; }
  // 방 경기 하나 끝: 판수 · 승리 (pvp = 다른 사람과 함께)
  noteGame(game, sub, won, pvp) { const u = this.u(sub); u.plays[game] = (u.plays[game] || 0) + 1; if (won) { u.wins[game] = (u.wins[game] || 0) + 1; if (pvp) u.pvp[game] = (u.pvp[game] || 0) + 1; } this.dirty = true; this.refresh(sub); }
  // 기록 · 순위를 보고 새로 달성한 업적을 적는다 (예전 기록도 여기서 인정된다)
  refresh(sub) {
    const u = this.u(sub), cache = new Map(), rec = (g) => this.records[g];
    const dreamRow = (m, d) => { const k = `d:${m}:${d}`; if (!cache.has(k)) cache.set(k, this.dream?.mine(sub, 'speed', d, m) || null); return cache.get(k); };
    const recRow = (g, b) => { const k = `r:${g}:${b}`; if (!cache.has(k)) cache.set(k, rec(g)?.mine(b, sub) || null); return cache.get(k); };
    const ok = (r) => {
      switch (r.kind) {
        case 'dream': { const m = dreamRow(r.map, r.diff); return !!m && m.rank <= r.rank && Object.keys(this.dream.table('speed', r.diff, r.map)).length >= MIN_FIELD[r.rank]; }
        case 'dreamDist': return (this.dream?.table('speed', r.diff, r.map)?.[sub]?.dist || 0) >= r.value;
        case 'starTotal': return u.total >= r.value;
        case 'record': { const m = recRow(r.game, r.board); return !!m && m.rank <= r.rank && Object.keys(rec(r.game).data[r.board] || {}).length >= MIN_FIELD[r.rank]; }
        case 'recordVal': { const m = recRow(r.game, r.board); return !!m && m.value >= r.value; }
        case 'plays': return (r.game === 'dream-runner' ? this.dream?.stats?.[sub]?.runs || 0 : u.plays[r.game] || 0) >= r.value;
        case 'wins': return (u.wins[r.game] || 0) >= r.value;
        case 'pvp': return (u.pvp[r.game] || 0) >= r.value;
        default: return false;
      }
    };
    const now = Date.now(); let n = Object.keys(u.ach).length; const fresh = [];
    for (const a of ACHIEVEMENTS) { if (u.ach[a.id] || a.rule.kind === 'count') continue; if (ok(a.rule)) { u.ach[a.id] = now; n++; fresh.push(a.id); } }
    for (const a of ACHIEVEMENTS) if (a.rule.kind === 'count' && !u.ach[a.id] && n >= a.rule.value) { u.ach[a.id] = now; n++; fresh.push(a.id); }
    if (fresh.length) { u.fresh = [...(u.fresh || []), ...fresh].slice(-40); this.dirty = true; }
    return fresh;
  }
  pub(sub) {
    if (!sub) return { stars: 0, total: 0, owned: [], equip: {}, ach: {}, plays: {}, wins: {}, pvp: {}, fresh: [], best: {} };
    this.refresh(sub);
    const u = this.u(sub), best = {};
    for (const s of SHOP) if (s.req) { const k = `${s.req.map}:${s.req.diff}`; if (!(k in best)) best[k] = this.dream?.table('speed', s.req.diff, s.req.map)?.[sub]?.dist || 0; }
    return { stars: u.stars, total: u.total, owned: u.owned, equip: cleanCos(u.equip) || {}, ach: u.ach, plays: u.plays, wins: u.wins, pvp: u.pvp, fresh: u.fresh || [], best };
  }
  buy(sub, id) {
    const it = itemById.get(id); if (!it?.shop) throw new Error('살 수 없는 물건이에요');
    const u = this.u(sub); if (u.owned.includes(id)) throw new Error('이미 가지고 있어요');
    if (it.req && (this.dream?.table('speed', it.req.diff, it.req.map)?.[sub]?.dist || 0) < it.req.dist) throw new Error(`아직 살 수 없어요 (${reqText(it.req)})`);
    if (u.stars < it.price) throw new Error('별이 모자라요');
    u.stars -= it.price; u.owned.push(id); this.dirty = true;
  }
  equip(sub, slot, id) {
    const u = this.u(sub); if (!id) { delete u.equip[slot]; this.dirty = true; return; }
    const it = itemById.get(id); if (!it || it.slot !== slot) throw new Error('그 칸에 쓸 수 없어요'); if (!this.owns(sub, id)) throw new Error('아직 가지고 있지 않아요');
    u.equip[slot] = id; this.dirty = true;
  }
}
// 방 경기 결과에서 이긴 사람 찾기 (게임마다 결과 모양이 조금씩 다르다)
export function noteRoomEnd(game, r, payload) {
  if (!inst || !game) return;
  try {
    const humans = r.players.filter((p) => !p.bot && p.who?.sub); if (!humans.length) return;
    const pvp = r.players.filter((p) => !p.bot).length >= 2; const win = new Set();
    const list = payload?.rank || payload?.rows;
    if (typeof payload?.winner === 'string') { for (const p of r.players) if (p.team === payload.winner || String(p.id) === payload.winner) win.add(p.id); }
    else if (typeof payload?.winner === 'number') win.add(payload.winner);
    else if (payload?.win === true) for (const p of humans) win.add(p.id);
    else if (payload?.win === false) { /* 다 같이 졌다 */ }
    else if (payload?.team?.winner) { for (const p of r.players) if (p.team === payload.team.winner) win.add(p.id); }
    else if (Array.isArray(list) && list.length) { for (const e of list) if (e.win === true || e.rank === 1) win.add(e.id); }
    for (const p of humans) inst.noteGame(game, p.who.sub, win.has(p.id), pvp);
  } catch (e) { console.warn('경기 기록 실패', game, e.message); }
}
export async function cosApi(req, res, url, who, cos, json) {
  const sub0 = who?.sub || null, anonQ = url.searchParams.get('anon');
  if (url.pathname === '/api/cos/me') return json(res, 200, cos.pub(sub0 || (ANON.test(anonQ || '') ? 'anon:' + anonQ : null)));
  if (req.method !== 'POST') return json(res, 404, { error: 'not found' });
  const b = await readJson(req), sub = sub0 || (ANON.test(String(b.anon || '')) ? 'anon:' + b.anon : null);
  if (!sub) return json(res, 401, { error: 'login' });
  try {
    if (url.pathname === '/api/cos/buy') { cos.buy(sub, String(b.id || '')); return json(res, 200, cos.pub(sub)); }
    if (url.pathname === '/api/cos/equip') { cos.equip(sub, String(b.slot || ''), b.id ? String(b.id) : null); return json(res, 200, cos.pub(sub)); }
    if (url.pathname === '/api/cos/seen') { cos.u(sub).fresh = []; cos.dirty = true; return json(res, 200, { ok: true }); }
  } catch (e) { return json(res, 400, { error: e.message }); }
  return json(res, 404, { error: 'not found' });
}
