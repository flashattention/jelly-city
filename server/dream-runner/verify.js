// 드림 러너 기록 검증: 출발표(서버 시간 서명) · 입력 기록 풀기 · 다시 돌리기 스레드 관리
import { Worker } from 'node:worker_threads';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export const MAX_FRAMES = 500000;
// 입력 기록: dts = "프레임 시간(0.1ms)" 쉼표 목록 · evs = "프레임:입력" 목록 (입력이 바뀔 때만). 압축해서 온다
export function decodeReplay(raw) {
  if (!raw || typeof raw.d !== 'string' || raw.d.length > 700000) return null;
  try {
    const text = raw.z ? zlib.gunzipSync(Buffer.from(raw.d, 'base64'), { maxOutputLength: 6 * 1024 * 1024 }).toString('utf8') : raw.d;
    const [a, b = ''] = text.split('|'), dts = a ? a.split(',').map(Number) : [], evs = b ? b.split(',').map((x) => x.split(':').map(Number)) : [];
    if (!dts.length || dts.length > MAX_FRAMES || dts.some((v) => !Number.isInteger(v) || v < 0 || v > 600)) return null; // 프레임 시간은 0.05초에서 자르지만 소수점 이월로 501 이 될 수 있다
    if (evs.some(([f, v]) => !Number.isInteger(f) || !Number.isInteger(v) || f < 0 || f >= dts.length || v < 0 || v > 31)) return null;
    return { dts, evs };
  } catch { return null; }
}
export class Tickets {
  constructor(secret) { this.secret = secret; this.used = new Map(); }
  sign(p) { return crypto.createHmac('sha256', this.secret).update(p).digest('base64url').slice(0, 24); }
  issue(info) { const p = [Date.now(), info.seed | 0, info.diff, info.map, info.mode, crypto.randomBytes(4).toString('hex'), info.room ? 1 : 0].join('.'); return `${p}.${this.sign(p)}`; }
  read(tk) {
    const s = String(tk || ''), i = s.lastIndexOf('.'); if (i < 0) return null; const p = s.slice(0, i); if (this.sign(p) !== s.slice(i + 1)) return null;
    const [at, seed, diff, map, mode, id, room] = p.split('.'); return { at: +at, seed: +seed, diff, map, mode, id, room: room === '1' };
  }
  // 사용한 출발표: 파일에 저장해 서버를 다시 켜도 같은 판으로 두 번 받지 못하게 (TTL 지난 것은 버린다)
  dump(ttl) { const now = Date.now(); return [...this.used].filter(([, t]) => now - t < ttl); }
  load(list) { for (const [k, t] of list || []) this.used.set(k, t); }
  once(id, what) { const k = `${what}:${id}`, now = Date.now(); if (this.used.has(k)) return false; this.used.set(k, now); if (this.used.size > 20000) for (const [q, t] of this.used) if (now - t > 864e5) this.used.delete(q); return true; }
}
// 한 스레드에서 차례대로. 밀리거나 고장 나면 null (그 기록은 나중에 사람이 본다, 플레이어를 기다리게 하지 않는다)
export class ReplayPool {
  constructor() { this.q = new Map(); this.n = 0; this.fails = 0; this.start(); }
  start() {
    if (this.fails > 5) return;
    try {
      this.w = new Worker(new URL('./replay-worker.js', import.meta.url), { execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 256 } }); this.w.unref();
      this.w.on('message', (m) => { if (m.ready) { this.ok = true; return; } const cb = this.q.get(m.id); if (cb) { this.q.delete(m.id); cb(m.error ? null : m); if (m.error) console.warn('기록 재생 오류', m.error); } });
      const down = (e) => { console.warn('기록 재생 스레드 재시작', e?.message || ''); this.ok = false; this.fails++; for (const cb of this.q.values()) cb(null); this.q.clear(); setTimeout(() => this.start(), 1000).unref?.(); };
      this.w.on('error', down); this.w.on('exit', (c) => { if (c) down(); });
    } catch (e) { console.warn('기록 재생 스레드 실패', e.message); this.fails++; }
  }
  run(job, timeout = 5000) {
    return new Promise((res) => {
      if (!this.w || this.q.size >= 30) return res(null);
      const id = ++this.n, t = setTimeout(() => { if (this.q.has(id)) { this.q.delete(id); res(null); } }, timeout); t.unref?.();
      this.q.set(id, (r) => { clearTimeout(t); res(r); }); this.w.postMessage({ id, ...job });
    });
  }
}
