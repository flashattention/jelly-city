// 치장 · 업적: 계정마다 별 지갑 · 산 것 · 착용 · 달성한 업적을 저장한다. 치장은 모든 게임에서 쓴다
//   착용 정보는 서버가 정한다: 브라우저가 보낸 look.cos 는 버리고 그 계정이 실제로 가진 것만 내보낸다 (1위 왕관을 위조하지 못하게)
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './auth.js';
import { ACHIEVEMENTS, achById, SHOP, ITEMS, PCT_MIN, itemById, cleanCos, starsEarned, reqText } from '../public/shared/js/cos-items.js';

const ANON = /^[a-f0-9]{16,40}$/, MAX_STARS_RUN = 6000;
// 순위 업적은 겨룬 사람이 있어야 인정한다 (빈 순위표의 1위는 왕관이 아니다)
const MIN_FIELD = { 1: 5, 2: 10, 3: 10, 10: 20 };
let inst = null;
// 순위 조건: 몇 위 안 (rank) 또는 상위 몇 % (pct). n = 순위표 사람 수
const placed = (r, rank, n) => (r.pct ? n >= PCT_MIN[r.pct] && rank <= Math.max(1, Math.ceil((n * r.pct) / 100)) : (r.any || n >= MIN_FIELD[r.rank]) && (r.exact ? rank === r.rank : rank <= r.rank));
// 훈장: 업적 id → 훈장 아이템
const TOP3 = ITEMS.filter((i) => i.slot === 'medal' && i.rule?.any); // 1 ~ 3위 메달: 업적 없이 지금 순위로
const medalByAch = new Map(); for (const i of ITEMS) if (i.slot === 'medal') { if (!medalByAch.has(i.ach)) medalByAch.set(i.ach, []); medalByAch.get(i.ach).push(i); }
export const getCos = () => inst;
// 순위표 이름: 캐릭터로 달린 기록은 그 캐릭터의 지금 이름, 아니면 계정의 지금 닉네임 (이름을 바꾸면 예전 기록에도 새 이름이 뜬다)
//   names = { nick(sub), chars(sub) → [{ token, name }] }. 기록에는 달린 캐릭터의 토큰(char)을 남긴다 (0 = 캐릭터 아님)
let names = null;
export const setNames = (n) => { names = n; };
const charByName = (sub, name) => names?.chars(sub).find((c) => c.name === name)?.token || 0;
export function tagChar(sub, e) { e.char = charByName(sub, e.name); return e; }
export function nameOf(sub, e) {
  if (!names) return e.name;
  if (e.char === undefined) e.char = charByName(sub, e.name); // 예전 기록: 지금 캐릭터 이름과 같으면 그 캐릭터로 달린 것
  if (e.char) return names.chars(sub).find((c) => c.token === e.char)?.name || e.name; // 지운 캐릭터는 그때 이름 그대로
  return names.nick(sub) || e.name;
}
// 순위표 한 줄의 메달: 그 순위표 안 순위로만 (1 ~ 3위는 인원과 상관없이, 그 아래는 상위 %)
export function boardMedal(base, rank, n) {
  if (rank <= 3) { const id = `medal.${base}.m${rank - 1}`; return itemById.has(id) ? id : null; }
  for (const [h, p] of [[3, 1], [4, 5], [5, 10]]) if (n >= PCT_MIN[p] && rank <= Math.max(1, Math.ceil((n * p) / 100))) { const id = `medal.${base}.m${h}`; return itemById.has(id) ? id : null; }
  return null;
}
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
  // 지금 자리여야 쓰는 것(1위 왕관 · 칭호 · 정상의 길)은 자리를 내주면 벗겨진다
  equipOf(sub) { const u = this.users[sub]; if (!u) { const md = sub && this.medalOf(sub); return md ? { medal: md } : null; } const eq = { ...u.equip }; for (const [sl, id] of Object.entries(eq)) { const it = itemById.get(id); if (it && this.live(it) && !this.owns(sub, id)) delete eq[sl]; } delete eq.medal; const md = this.medalOf(sub); if (md) eq.medal = md; return cleanCos(eq); }
  // games: 그 게임 칭호만 (순위표에는 다른 게임 칭호를 띄우지 않는다). 예: ['dr.', 'dream-runner.']
  titleOf(sub, games) { const id = this.users[sub]?.equip?.title; return id && itemById.has(id) && this.owns(sub, id) && (!games || games.some((g) => id.startsWith(`title.${g}`))) ? id : null; }
  owns(sub, id) { const u = this.users[sub], it = itemById.get(id); if (!u || !it) return false; if (it.shop) return u.owned.includes(id); return this.live(it) ? this.holdsNow(sub, it) : !!u.ach[it.ach]; }
  // 한 판 끝: 별을 지갑에 넣는다 (난이도 · 지옥이면 더 많이)
  earn(sub, stars, diff, map) { const n = starsEarned(Math.min(MAX_STARS_RUN, Math.max(0, stars | 0)), diff, map); if (n <= 0) return 0; const u = this.u(sub); u.stars += n; u.total += n; this.dirty = true; this.refresh(sub); return n; }
  // 방 경기 하나 끝: 판수 · 승리 (pvp = 다른 사람과 함께)
  noteGame(game, sub, won, pvp) { const u = this.u(sub); u.plays[game] = (u.plays[game] || 0) + 1; if (won) { u.wins[game] = (u.wins[game] || 0) + 1; if (pvp) u.pvp[game] = (u.pvp[game] || 0) + 1; } this.dirty = true; this.refresh(sub); }
  // 기록 · 순위를 보고 새로 달성한 업적을 적는다 (예전 기록도 여기서 인정된다)
  // 조건 하나를 지금 기록으로 확인한다 (cache 는 한 번 계산할 때만 쓴다)
  meets(sub, r, cache = new Map()) {
    const u = this.u(sub), rec = (g) => this.records[g];
    const dreamRow = (m, d) => { const k = `d:${m}:${d}`; if (!cache.has(k)) cache.set(k, this.dream?.mine(sub, 'speed', d, m, false) || null); return cache.get(k); }; // 메달 · 칭호 없이 (칭호 확인이 다시 여기로 돌아오지 않게)
    const recRow = (g, b) => { const k = `r:${g}:${b}`; if (!cache.has(k)) { const R = rec(g), e = R?.data[b]?.[sub]; cache.set(k, e ? { rank: R.sorted(b).findIndex(([x]) => x === sub) + 1, value: e.value } : null); } return cache.get(k); }; // mine() 은 칭호를 다시 물어서 쓰지 않는다
    switch (r.kind) {
      case 'dream': { const m = dreamRow(r.map, r.diff); return !!m && !this.dream.table('speed', r.diff, r.map)[sub]?.u && placed(r, m.rank, Object.keys(this.dream.table('speed', r.diff, r.map)).length); }
      case 'dreamDist': { const e = this.dream?.table('speed', r.diff, r.map)?.[sub]; return !!e && !e.u && e.dist >= r.value; }
      case 'starTotal': return u.total >= r.value;
      case 'record': { const m = recRow(r.game, r.board); return !!m && placed(r, m.rank, Object.keys(rec(r.game).data[r.board] || {}).length); }
      case 'recordVal': { const m = recRow(r.game, r.board); return !!m && m.value >= r.value; }
      case 'plays': return (r.game === 'dream-runner' ? this.dream?.stats?.[sub]?.runs || 0 : u.plays[r.game] || 0) >= r.value;
      case 'wins': return (u.wins[r.game] || 0) >= r.value;
      case 'pvp': return (u.pvp[r.game] || 0) >= r.value;
      default: return false;
    }
  }
  // 1위 업적의 왕관 · 칭호는 지금 1위인 동안만 쓴다 (업적 기록은 남는다)
  //   정상의 길(top3)은 그 난이도 순위표(꿈나라 · 지옥 어느 쪽이든) 지금 3위 안인 동안만
  live(it) { return it.slot === 'medal' || !!it.top3 || ((it.slot === 'crown' || it.slot === 'title') && !!achById.get(it.ach)?.rule.crown); }
  // 이름 옆 메달: 지금 자리 중 가장 높은 것 (1위 → 2위 → 3위 → 상위 1% → 5% → 10%, 같으면 어려운 순위표)
  medalOf(sub) {
    if (!sub) return null; const u = this.users[sub] || { ach: {} }, cache = new Map(); let best = null;
    for (const it of [...TOP3, ...Object.keys(u.ach).flatMap((id) => (medalByAch.get(id) || []).filter((m) => !m.rule?.any))]) { if (best && (it.fx.honor > best.fx.honor || (it.fx.honor === best.fx.honor && it.fx.pr <= best.fx.pr))) continue; if (this.holdsNow(sub, it, cache)) best = it; }
    return best?.id || null;
  }
  holdsNow(sub, it, cache) { if (it.top3) return ['dream', 'hell'].some((map) => this.meets(sub, { kind: 'dream', map, diff: it.top3, rank: 3, any: true }, cache)); const a = achById.get(it.ach); return !!a && (it.rule?.any || !!this.users[sub]?.ach[a.id]) && this.meets(sub, it.rule || a.rule, cache); }
  // 기록 · 순위를 보고 새로 달성한 업적을 적는다 (예전 기록도 여기서 인정된다)
  refresh(sub) {
    const u = this.u(sub), cache = new Map();
    const now = Date.now(); let n = Object.keys(u.ach).length; const fresh = [];
    for (const a of ACHIEVEMENTS) { if (u.ach[a.id] || a.rule.kind === 'count') continue; if (this.meets(sub, a.rule, cache)) { u.ach[a.id] = now; n++; fresh.push(a.id); } }
    for (const a of ACHIEVEMENTS) if (a.rule.kind === 'count' && !u.ach[a.id] && n >= a.rule.value) { u.ach[a.id] = now; n++; fresh.push(a.id); }
    if (fresh.length) { u.fresh = [...(u.fresh || []), ...fresh].slice(-40); this.dirty = true; }
    return fresh;
  }
  // 조작이 확인된 계정: 해당 업적을 거두고 별을 비운다 (남은 정상 기록으로 다시 계산)
  punish(sub, prefix) { const u = this.users[sub]; if (!u) return; for (const id of Object.keys(u.ach)) if (id.startsWith(prefix) || id.startsWith('all.')) delete u.ach[id]; u.stars = 0; u.fresh = []; for (const [s, id] of Object.entries(u.equip)) if (!this.owns(sub, id)) delete u.equip[s]; this.dirty = true; this.refresh(sub); }
  pub(sub) {
    if (!sub) return { stars: 0, total: 0, owned: [], live: [], equip: {}, ach: {}, plays: {}, wins: {}, pvp: {}, fresh: [], best: {} };
    this.refresh(sub);
    const u = this.u(sub), best = {};
    for (const s of SHOP) if (s.req) { const k = `${s.req.map}:${s.req.diff}`; if (!(k in best)) best[k] = this.dream?.table('speed', s.req.diff, s.req.map)?.[sub]?.dist || 0; }
    const live = []; const cache = new Map(); for (const it of itemById.values()) if (this.live(it) && this.holdsNow(sub, it, cache)) live.push(it.id);
    return { stars: u.stars, total: u.total, owned: u.owned, live, equip: this.equipOf(sub) || {}, ach: u.ach, plays: u.plays, wins: u.wins, pvp: u.pvp, fresh: u.fresh || [], best };
  }
  buy(sub, id) {
    const it = itemById.get(id); if (!it?.shop) throw new Error('살 수 없는 물건이에요');
    const u = this.u(sub); if (u.owned.includes(id)) throw new Error('이미 가지고 있어요');
    if (it.req && (this.dream?.table('speed', it.req.diff, it.req.map)?.[sub]?.u || (this.dream?.table('speed', it.req.diff, it.req.map)?.[sub]?.dist || 0) < it.req.dist)) throw new Error(`아직 살 수 없어요 (${reqText(it.req)})`);
    if (u.stars < it.price) throw new Error('별이 모자라요');
    u.stars -= it.price; u.owned.push(id); this.dirty = true;
  }
  equip(sub, slot, id) {
    if (slot === 'medal') throw new Error('메달은 저절로 붙어요'); const u = this.u(sub); if (!id) { delete u.equip[slot]; this.dirty = true; return; }
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
