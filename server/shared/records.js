// 게임 공용 기록판: 계정마다 · 판(트랙/맵)마다 가장 좋은 기록 하나. 체험판 · 비로그인(임시 아이디 + 닉네임)도 남긴다
//   출발표(2026-11-13 보안 5-1): 혼자 하기를 시작할 때 POST {prefix}/start 로 받고, 기록에 같이 보낸다
//     - 같은 출발표로 두 번은 못 남긴다 · 판이 다르거나 6시간 지난 출발표는 없는 것과 같다
//     - 실제로 지난 시간으로 말이 안 되는 기록(timing 이 reject)은 거절, 애매한 것(출발표 없음 · 너무 빠름)은 받되
//       순위표 10등 안이면 공개 순위표에서 잠깐 빼 두고(hold) 관리자가 본다. 주인에게는 그대로 보인다
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson } from '../auth.js';
import { clean } from './rooms.js';
import { getCos, boardMedal, nameOf, tagChar } from '../cosmetics.js';
import { sec, clientIp, publicId, anonOk, ANON_FULL } from './guard.js';

const ANON = /^[a-f0-9]{16,40}$/;
const TICKET_TTL = 6 * 3600e3, HOLD_TOP = 10;
const PER_HOUR = 120; // 계정(익명 id) 하나가 한 시간에 남길 수 있는 기록 (사람은 닿지 못할 만큼)
// 사람 같지 않은 간격: 최근 기록 간격이 기계처럼 일정한가 (변동계수 2% 미만, 6번 이상)
export function robotic(times) {
  if (times.length < 6) return false;
  const gaps = times.slice(1).map((t, i) => t - times[i]), m = gaps.reduce((a, v) => a + v, 0) / gaps.length;
  if (m <= 0) return true;
  const sd = Math.sqrt(gaps.reduce((a, v) => a + (v - m) ** 2, 0) / gaps.length);
  return sd / m < 0.02;
}
export class Records {
  // name: 파일 이름 · better(a, b): a 가 b 보다 좋은가 · check(body): 말이 되는 기록인가 (아니면 오류 문구)
  // timing(b, body, sec): 출발표가 있을 때 실제로 지난 시간(sec)으로 본다 → null(괜찮음) · { reject: 문구 } · { flag: 이유 }
  constructor(dataDir, name, { boards, better, check, value, timing = null }) {
    this.file = path.join(dataDir, `${name}.json`); this.name = name;
    this.boards = boards; this.better = better; this.check = check; this.value = value; this.timing = timing;
    this.data = {}; this.last = new Map(); this.ipHits = new Map(); this.used = new Map(); this.hour = new Map(); this.times = new Map();
    try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* 처음 */ }
    // 출발표 서명 열쇠: 기록 파일 옆에 따로 (기록 파일 안에 넣으면 판 목록과 섞인다)
    this.keyFile = path.join(dataDir, `${name}.key`);
    try { this.secret = fs.readFileSync(this.keyFile, 'utf8').trim(); } catch { /* 처음 */ }
    if (!/^[0-9a-f]{48}$/.test(this.secret || '')) { this.secret = crypto.randomBytes(24).toString('hex'); try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(this.keyFile, this.secret); } catch { /* 다음에 */ } }
    this.dirty = false;
    setInterval(() => this.save(), 20000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('기록 저장 실패', e); }
  }
  // ---------- 출발표 ----------
  sign(p) { return crypto.createHmac('sha256', this.secret).update(p).digest('base64url').slice(0, 22); }
  issue(b, now = Date.now()) { const p = `${now}.${b}.${crypto.randomBytes(6).toString('hex')}`; return `${p}.${this.sign(p)}`; }
  readTicket(tk, now = Date.now()) {
    const s = String(tk || ''), i = s.lastIndexOf('.'); if (i < 0 || s.length > 120) return null;
    const p = s.slice(0, i); if (this.sign(p) !== s.slice(i + 1)) return null;
    const [at, b, id] = p.split('.'); const t = { at: +at, b, id };
    return now - t.at > TICKET_TTL || t.at - now > 5000 ? null : t;
  }
  // 공개 순위: 보류(hold)된 기록은 그 주인(viewer)에게만 보인다
  sorted(b, viewer = null) { return Object.entries(this.data[b] || {}).filter(([s, e]) => !e.hold || s === viewer).sort((x, y) => (this.better(x[1], y[1]) ? -1 : this.better(y[1], x[1]) ? 1 : x[1].at - y[1].at)); }
  count(b) { return Object.values(this.data[b] || {}).filter((e) => !e.hold).length; }
  row(sub, e, i, b) { return { rank: i + 1, id: publicId(sub), title: getCos()?.titleOf(sub, [`${this.name}.`]) || null, medal: b && !e.hold ? boardMedal(`${this.name}.${b}`, i + 1, this.count(b)) : null, name: nameOf(sub, e), color: e.color, value: e.value, guest: !!e.guest, anon: !!e.anon, ...(e.hold ? { hold: true } : {}) }; }
  top(b, n = 30) { return this.sorted(b).slice(0, n).map(([s, e], i) => this.row(s, e, i, b)); }
  mine(b, sub) { if (!sub || !this.data[b]?.[sub]) return null; const i = this.sorted(b, sub).findIndex(([s]) => s === sub); return this.row(sub, this.data[b][sub], i, b); }
  // 관리자: 보류된 기록 · 인정 · 지우기
  heldList() { const out = []; for (const b of this.boards) for (const [sub, e] of Object.entries(this.data[b] || {})) if (e.hold || e.u) out.push({ game: this.name, b, sub: publicId(sub), key: sub, name: nameOf(sub, e), value: e.value, why: e.u || '', hold: !!e.hold, at: e.at, sec: e.sec ?? null }); return out; }
  resolveHeld(b, key, act) {
    const e = this.data[b]?.[key]; if (!e) throw new Error('없어요');
    if (act === 'ok') { delete e.hold; delete e.u; e.v = 1; } else if (act === 'del') delete this.data[b][key]; else throw new Error('잘못된 요청이에요');
    this.dirty = true; getCos()?.refresh(key);
  }
  async api(req, res, url, who, json, prefix) {
    const b = url.searchParams.get('b');
    // 판마다 1등만 한꺼번에 (트랙 고르는 화면에 최고 기록 표시)
    if (url.pathname === `${prefix}/tops`) return json(res, 200, { tops: Object.fromEntries(this.boards.map((x) => [x, this.top(x, 1)[0] || null])) });
    if (url.pathname === `${prefix}/board`) {
      if (!this.boards.includes(b)) return json(res, 400, { error: '판이 없어요' });
      const anon = url.searchParams.get('anon');
      return json(res, 200, { b, top: this.top(b), me: this.mine(b, who?.sub || (ANON.test(anon || '') ? 'anon:' + anon : null)) });
    }
    // 혼자 하기 시작: 출발표 (로그인 없이도 받는다 · 속도 제한은 api() 공통)
    if (url.pathname === `${prefix}/start` && req.method === 'POST') {
      const body = await readJson(req);
      if (!this.boards.includes(body.b)) return json(res, 400, { error: '판이 없어요' });
      return json(res, 200, { tk: this.issue(body.b) });
    }
    if (url.pathname === `${prefix}/record` && req.method === 'POST') {
      const body = await readJson(req), ip = clientIp(req);
      if (!this.boards.includes(body.b)) return json(res, 400, { error: '판이 없어요' });
      if (!who) {
        if (!ANON.test(String(body.anon || ''))) return json(res, 401, { error: 'login' });
        if (!clean(body.name, 14)) return json(res, 400, { error: '닉네임을 정해 주세요' });
        if (!anonOk(req, body.anon)) return json(res, 429, { error: ANON_FULL });
        const now = Date.now(), hits = (this.ipHits.get(ip) || []).filter((t) => now - t < 60000);
        if (hits.length >= 20) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
        hits.push(now); this.ipHits.set(ip, hits); if (this.ipHits.size > 20000) this.ipHits.clear();
        who = { sub: 'anon:' + body.anon, user: { anon: true } };
      }
      const now = Date.now();
      if (now - (this.last.get(who.sub) || 0) < 2000) return json(res, 400, { error: '너무 빨라요' });
      this.last.set(who.sub, now); if (this.last.size > 50000) this.last.clear();
      // 5-3 짧은 시간에 아주 많이
      const hk = `${who.sub}:${Math.floor(now / 3600e3)}`, hn = (this.hour.get(hk) || 0) + 1; this.hour.set(hk, hn); if (this.hour.size > 50000) this.hour.clear();
      if (hn > PER_HOUR) { if (hn === PER_HOUR + 1) sec.note('record', { ip, where: this.name, detail: 'too many records/hour' }); return json(res, 429, { error: '기록을 너무 많이 남겼어요. 잠시 후 다시 해 주세요' }); }
      const bad = this.check(body);
      if (bad) { sec.note('record', { ip, where: this.name, detail: `rejected: ${bad}` }); return json(res, 400, { error: bad }); }
      // 출발표 · 실제로 지난 시간
      let why = '', sec0 = null;
      const tk = body.tk ? this.readTicket(body.tk, now) : null;
      if (body.tk && !tk) why = 'badticket';
      else if (!tk) why = 'noticket';
      else if (tk.b !== body.b) why = 'badticket';
      else {
        if (this.used.has(tk.id)) { sec.note('record', { ip, where: this.name, detail: 'ticket reuse' }); return json(res, 409, { error: '이미 기록을 남긴 판이에요' }); }
        sec0 = Math.round((now - tk.at) / 100) / 10;
        const t = this.timing?.(body.b, body, sec0);
        if (t?.reject) { sec.note('record', { ip, where: this.name, detail: `impossible time ${sec0}s` }); return json(res, 400, { error: t.reject }); }
        if (t?.flag) why = t.flag;
        this.used.set(tk.id, now); if (this.used.size > 30000) for (const [k, at] of this.used) if (now - at > TICKET_TTL) this.used.delete(k);
      }
      // 5-2 기계처럼 일정한 간격으로 계속 남기면 의심
      const ts = [...(this.times.get(who.sub) || []), now].slice(-8); this.times.set(who.sub, ts); if (this.times.size > 20000) this.times.clear();
      if (!why && robotic(ts)) why = 'robotic';
      const e = { name: clean(body.name, 14) || clean(who.user.nick || (who.user.guest ? who.user.name : ''), 14) || '곰돌이', color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#8a5634', value: this.value(body), at: now, guest: !!who.user.guest, anon: !!who.user.anon, ...(sec0 != null ? { sec: sec0 } : {}) };
      tagChar(who.sub, e);
      const T = (this.data[body.b] ||= {});
      const old = T[who.sub], best = !old || this.better(e, old);
      if (best) {
        // 애매한 기록: 공개 순위 10등 안에 들 때만 보류하고 관리자에게 (그 아래는 그대로 올린다)
        if (why) {
          e.u = why;
          const higher = this.sorted(body.b).filter(([s, x]) => s !== who.sub && this.better(x, e)).length;
          if (higher < HOLD_TOP) { e.hold = true; sec.note('record', { ip, where: `${this.name}.${body.b}`, detail: `held: ${why} value=${e.value}` }); }
        }
        T[who.sub] = e;
      } else { old.name = e.name; old.color = e.color; old.char = e.char; }
      this.dirty = true;
      getCos()?.refresh(who.sub); // 업적: 기록 · 순위
      return json(res, 200, { b: body.b, best, prev: old?.value ?? null, me: this.mine(body.b, who.sub), top: this.top(body.b), ...(best && e.hold ? { hold: true } : {}) });
    }
    return json(res, 404, { error: 'not found' });
  }
}
