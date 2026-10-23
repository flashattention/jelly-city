// 게임 공용 기록판: 계정마다 · 판(트랙/맵)마다 가장 좋은 기록 하나. 체험판 · 비로그인(임시 아이디 + 닉네임)도 남긴다
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../auth.js';
import { clean } from './rooms.js';

const ANON = /^[a-f0-9]{16,40}$/;
export class Records {
  // name: 파일 이름 · better(a, b): a 가 b 보다 좋은가 · check(body): 말이 되는 기록인가 (아니면 오류 문구)
  constructor(dataDir, name, { boards, better, check, value }) {
    this.file = path.join(dataDir, `${name}.json`);
    this.boards = boards; this.better = better; this.check = check; this.value = value;
    this.data = {}; this.last = new Map(); this.ipHits = new Map();
    try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* 처음 */ }
    this.dirty = false;
    setInterval(() => this.save(), 20000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('기록 저장 실패', e); }
  }
  sorted(b) { return Object.entries(this.data[b] || {}).sort((x, y) => (this.better(x[1], y[1]) ? -1 : this.better(y[1], x[1]) ? 1 : x[1].at - y[1].at)); }
  row(sub, e, i) { return { rank: i + 1, id: sub.slice(-8), name: e.name, color: e.color, value: e.value, guest: !!e.guest, anon: !!e.anon }; }
  top(b, n = 30) { return this.sorted(b).slice(0, n).map(([s, e], i) => this.row(s, e, i)); }
  mine(b, sub) { if (!sub || !this.data[b]?.[sub]) return null; const i = this.sorted(b).findIndex(([s]) => s === sub); return this.row(sub, this.data[b][sub], i); }
  async api(req, res, url, who, json, prefix) {
    const b = url.searchParams.get('b');
    // 판마다 1등만 한꺼번에 (트랙 고르는 화면에 최고 기록 표시)
    if (url.pathname === `${prefix}/tops`) return json(res, 200, { tops: Object.fromEntries(this.boards.map((x) => [x, this.top(x, 1)[0] || null])) });
    if (url.pathname === `${prefix}/board`) {
      if (!this.boards.includes(b)) return json(res, 400, { error: '판이 없어요' });
      const anon = url.searchParams.get('anon');
      return json(res, 200, { b, top: this.top(b), me: this.mine(b, who?.sub || (ANON.test(anon || '') ? 'anon:' + anon : null)) });
    }
    if (url.pathname === `${prefix}/record` && req.method === 'POST') {
      const body = await readJson(req);
      if (!this.boards.includes(body.b)) return json(res, 400, { error: '판이 없어요' });
      if (!who) {
        if (!ANON.test(String(body.anon || ''))) return json(res, 401, { error: 'login' });
        if (!clean(body.name, 14)) return json(res, 400, { error: '닉네임을 정해 주세요' });
        const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '';
        const now = Date.now(), hits = (this.ipHits.get(ip) || []).filter((t) => now - t < 60000);
        if (hits.length >= 20) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
        hits.push(now); this.ipHits.set(ip, hits);
        who = { sub: 'anon:' + body.anon, user: { anon: true } };
      }
      const now = Date.now();
      if (now - (this.last.get(who.sub) || 0) < 2000) return json(res, 400, { error: '너무 빨라요' });
      this.last.set(who.sub, now);
      const bad = this.check(body);
      if (bad) return json(res, 400, { error: bad });
      const e = { name: clean(body.name, 14) || clean(who.user.nick || (who.user.guest ? who.user.name : ''), 14) || '곰돌이', color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#8a5634', value: this.value(body), at: now, guest: !!who.user.guest, anon: !!who.user.anon };
      const T = (this.data[body.b] ||= {});
      const old = T[who.sub], best = !old || this.better(e, old);
      if (best) T[who.sub] = e; else { old.name = e.name; old.color = e.color; }
      this.dirty = true;
      return json(res, 200, { b: body.b, best, prev: old?.value ?? null, me: this.mine(body.b, who.sub), top: this.top(body.b) });
    }
    return json(res, 404, { error: 'not found' });
  }
}
