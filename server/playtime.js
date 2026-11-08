// 게임마다 플레이 시간: 게임 화면이 보이고 사람이 움직이는 동안 1분마다 한 번 알려 온다 → 날짜(한국 시간)별 분 합계
//   메인 화면 카드의 "7일간 플레이 n시간" 과 인기순 정렬에 쓴다 (누가 했는지는 남기지 않는다)
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './auth.js';

const GAME = /^(dream-runner|jelly-[a-z]+)$/, KEEP = 120;
const dayKey = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
export class PlayTime {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'playtime.json'); this.d = {}; this.hits = new Map();
    try { this.d = JSON.parse(fs.readFileSync(this.file, 'utf8')).d || {}; } catch { /* 처음 */ }
    setInterval(() => this.save(), 30000).unref();
  }
  save() { if (!this.dirty) return; this.dirty = false; try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ d: this.d })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('플레이 시간 저장 실패', e.message); } }
  // 같은 곳(IP + 게임)에서 50초에 한 번만
  ping(game, who, first = false) {
    if (!GAME.test(game)) return false;
    const now = Date.now(), k = `${who}:${game}`; if (now - (this.hits.get(k) || 0) < 50000) return false; this.hits.set(k, now); if (this.hits.size > 50000) this.hits.clear();
    const day = dayKey(now), D = (this.d[day] ||= {}); D[game] = (D[game] || 0) + 1; if (first) D[`${game}#n`] = (D[`${game}#n`] || 0) + 1; this.dirty = true;
    const old = dayKey(now - KEEP * 864e5); for (const q of Object.keys(this.d)) if (q < old) delete this.d[q];
    return true;
  }
  total(game) { let m = 0; for (const D of Object.values(this.d)) m += D[game] || 0; return m; }
  plays(game) { let n = 0; for (const D of Object.values(this.d)) n += D[`${game}#n`] || 0; return n; }
  summary(days = 7) { const from = dayKey(Date.now() - (days - 1) * 864e5), games = {}; let first = null; for (const [day, D] of Object.entries(this.d)) { if (!first || day < first) first = day; if (day < from) continue; for (const [g, m] of Object.entries(D)) games[g] = (games[g] || 0) + m; } return { days, since: first, games }; }
}
// 출시 후 지금까지: 드림 러너는 저장된 판 시간, 나머지는 집계한 플레이 시간 + 기록을 남긴 사람 수 (판수는 따로 모은 적이 없다)
export function allTime(pt, src) {
  const games = {};
  const add = (g, k, v) => { (games[g] ||= { min: 0, players: 0, plays: 0 })[k] += v; };
  for (const g of src.ids) { add(g, 'min', pt.total(g)); add(g, 'plays', pt.plays(g)); }
  for (const B of src.dream) { const subs = new Set(); for (const [sub, st] of Object.entries(B.stats || {})) { add('dream-runner', 'min', (st.time || 0) / 60); add('dream-runner', 'plays', st.runs || 0); subs.add(sub); } for (const T of [B.best, B.bestItem, ...Object.values(B.boards || {})]) for (const sub of Object.keys(T || {})) subs.add(sub); for (const sub of Object.keys(B.hg || {})) subs.add(sub); add('dream-runner', 'players', subs.size); }
  for (const [g, R] of Object.entries(src.records)) { const subs = new Set(); for (const T of Object.values(R.data || {})) for (const sub of Object.keys(T || {})) subs.add(sub); add(g, 'players', subs.size); }
  if (src.cityUsers) add('jelly-city', 'players', src.cityUsers);
  for (const v of Object.values(games)) v.min = Math.round(v.min);
  return { games };
}
export async function playtimeApi(req, res, url, pt, json, src) {
  if (url.pathname === '/api/playtime/all') return json(res, 200, allTime(pt, src())), true;
  if (url.pathname === '/api/playtime' && req.method === 'POST') { const b = await readJson(req); const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || ''; pt.ping(String(b.game || ''), `${ip}:${String(b.id || '').slice(0, 40)}`, !!b.first); return json(res, 200, { ok: true }), true; }
  if (url.pathname === '/api/playtime') return json(res, 200, pt.summary(Math.min(30, Math.max(1, +url.searchParams.get('days') || 7)))), true;
  return false;
}
