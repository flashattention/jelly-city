// 젤리 서울 러너 이용 지표: 익명 이벤트를 날짜별 파일(JSONL)에 덧붙인다
//   저장: 기기 무작위 아이디 · 세션 아이디 · 이벤트 이름 · 값 뿐. IP 는 속도 제한에만 메모리에서 쓰고 저장하지 않는다
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { readJson } from '../auth.js';
import { buildReport } from './report.js';

export const EVENTS = new Set(['l_view', 'l_3d', 'l_ch', 'l_sec', 'l_go', 'l_map', 'l_leave', 'g_start', 'g_ready', 'g_move', 'g_hb', 'g_dw', 'g_pl', 'g_tile', 'g_gu', 'g_tp', 'g_fly', 'g_shop', 'g_order', 'g_st', 'g_ride', 'g_mall', 'g_deck', 'g_out', 'g_set', 'g_lb', 'g_chunk', 'g_err', 'g_end']);
const ID = /^[a-z0-9]{8,32}$/, KEY = /^[a-zA-Z0-9_]{1,16}$/, MAX_EV = 80, DAY_CAP = 200e6;
const dayKey = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

function cleanProps(p) {
  const out = {}; if (!p || typeof p !== 'object' || Array.isArray(p)) return out; let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (n >= 40 || !KEY.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    else if (typeof v === 'string' && v) out[k] = v.replace(/[\u0000-\u001f]/g, ' ').slice(0, 60);
    else continue;
    n++;
  }
  return out;
}

export class SwMetrics {
  constructor(dataDir) {
    this.dir = path.join(dataDir, 'seoul-walk-metrics'); this.buf = []; this.hits = new Map(); this.size = {};
    setInterval(() => this.flush(), 5000).unref();
    setInterval(() => { const t = Date.now(); for (const [k, v] of this.hits) if (t - v.t > 120000) this.hits.delete(k); }, 60000).unref();
  }
  allow(k, lim) { const t = Date.now(), h = this.hits.get(k); if (!h || t - h.t > 60000) { this.hits.set(k, { t, n: 1 }); return true; } return ++h.n <= lim; }
  // 들어온 묶음을 검사해 쌓는다. 돌려주는 값 = 받은 이벤트 수 (거부면 -1)
  add(body, ip) {
    if (!body || !ID.test(body.d || '') || !ID.test(body.s || '') || !Array.isArray(body.ev)) return -1;
    if (!this.allow(`i:${ip}`, 120) || !this.allow(`d:${body.d}`, 30)) return -1;
    const now = Date.now(); let n = 0;
    for (const e of body.ev.slice(0, MAX_EV)) {
      if (!Array.isArray(e) || !EVENTS.has(e[0])) continue;
      const ago = Math.max(0, Math.min(180000, +e[1] || 0));
      this.buf.push({ t: now - Math.round(ago), d: body.d, s: body.s, e: e[0], p: cleanProps(e[2]) }); n++;
    }
    return n;
  }
  flush() {
    if (!this.buf.length) return; const rows = this.buf; this.buf = []; const byDay = new Map();
    for (const r of rows) { const k = dayKey(r.t); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(JSON.stringify(r)); }
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      for (const [k, lines] of byDay) {
        const f = path.join(this.dir, `${k}.jsonl`);
        this.size[k] ??= fs.existsSync(f) ? fs.statSync(f).size : 0; if (this.size[k] > DAY_CAP) continue;
        const text = `${lines.join('\n')}\n`; fs.appendFileSync(f, text); this.size[k] += text.length;
      }
    } catch (e) { console.error('서울 러너 지표 저장 실패', e.message); }
  }
  // 최근 days 일의 기록을 한 줄씩
  async *rows(days) {
    this.flush(); const from = dayKey(Date.now() - (days - 1) * 864e5); let names = []; try { names = fs.readdirSync(this.dir).filter((f) => f.endsWith('.jsonl') && f.slice(0, 10) >= from).sort(); } catch { return; }
    for (const f of names) for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(this.dir, f)), crlfDelay: Infinity })) { try { yield JSON.parse(line); } catch { /* 깨진 줄 */ } }
  }
}

export async function swMetricsApi(req, res, url, M, json, who, isAdmin) {
  if (url.pathname === '/api/sw/m' && req.method === 'POST') {
    const body = await readJson(req, 64 * 1024).catch(() => null), ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '';
    const n = M.add(body, ip); return json(res, n < 0 ? 429 : 200, { n });
  }
  // 집계: 관리자만 (개별 기기 기록은 내보내지 않는다)
  if (url.pathname === '/api/sw/report') {
    if (!who || !isAdmin(who.user)) return json(res, 403, { error: 'admin' });
    const days = Math.max(1, Math.min(400, +url.searchParams.get('days') || 30));
    return json(res, 200, await buildReport(M.rows(days), { days }));
  }
  return json(res, 404, { error: 'not found' });
}
