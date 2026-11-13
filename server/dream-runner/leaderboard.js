// 드림 러너: 최고 기록 리더보드 (계정마다 가장 좋은 기록 하나). 체험판 계정도 순위에 오른다
// 비로그인은 브라우저마다 만든 임시 아이디(anon) + 직접 정한 닉네임으로 남긴다
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../auth.js';
import { DIFFS, diffOf } from '../../public/dream-runner/js/diff.js';
import { getCos, boardMedal, nameOf, tagChar } from '../cosmetics.js';
import crypto from 'node:crypto';
import { Tickets, ReplayPool, decodeReplay } from './verify.js';
import { codeVer, archiveCode, hasVer, VER_RE } from './codever.js';
import { publicId, sec, anonOk, ANON_FULL } from '../shared/guard.js';
// 죽은 이유 종류 → 이름 (runner.js die 의 code)
export const DIE_LABEL = { step: '높은 턱 · 벽', fall: '떨어짐', hurdle: '낮은 장애물', wall: '높은 장애물', bar: '머리 위 가로대', meteor: '운석', laser: '빛줄기', slam: '괴물의 일격', car: '승용차', suv: 'SUV', taxi: '택시', bus: '버스', moto: '배달 오토바이', bike: '자전거', ped: '행인 젤리', cones: '공사 고깔', barrier: '공사 가림막', banner: '현수막' };
import { itemById } from '../../public/shared/js/cos-items.js';

// 게임 코드 판: 서버가 다시 돌려 보는 코드와 브라우저 코드가 같아야 기록이 맞는다. 배포로 바뀌면 브라우저가 달리기 전에 새로 고친다
export const DREAM_VER = codeVer();
const MAX_SPEED = 50;
const MAX_SPEED_ITEM = 75; // 아이템전: 로켓 · 순간이동이 있어서 더 넉넉하게      // 게임 속 최고 속도(30m/s × 가속 1.5)보다 넉넉하게: 이보다 빠른 기록은 조작으로 본다
const TOP = 50;
const TICKET_TTL = 6 * 3600e3; // 출발표는 받은 뒤 6시간까지 (한 판은 4시간을 넘지 못한다)
const STAR_PTS = 10;       // 별사탕 하나 = 10점
const TOP_GUARD = 10, DAY_STARS = 300000; // 확인 안 된 기록이 이 순위 안에 들면 비상 리포트 · 하루에 벌 수 있는 별 (사람이 닿지 못할 만큼 넉넉하게)

// 운영 지표: 하루(한국 시간)마다 달린 사람 · 판수 · 광고 (기획 지표용, tools/metrics.mjs 가 읽는다)
const dayKey = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
const DAILY_KEEP = 120;
// 서울 명소 도장: 명소 id → 체험에 걸리는 최소 시간(초, 실제 시간). 시작(begin)을 알리고 이 시간이 지나야 도장(done)이 찍힌다
const HG_STAMPS = { gbg: 30, cable: 40, lock: 3, cruise: 60, bike: 45, obs63: 20, lwt: 20, lotteworld: 30, market: 15, haneul: 25, naksan: 30, nodeul: 18, huwon: 20, museum: 20, ddp: 20, library: 15, botanic: 20, baseball: 30 };
const HG_TTL = 10 * 3600e3, HG_MO = ['sunset', 'sunrise', 'night', 'rain', 'snow', 'spring', 'summer', 'autumn', 'winter']; // 한강 러닝: 한 번에 10시간까지 · 순간들 // 이 날수보다 오래된 하루 기록은 지운다
const MAPS = ['dream', 'hell', 'void', 'seoul'], mapOf = (m) => (m === 'hell' || m === 'void' || m === 'seoul' ? m : 'dream'); // 꿈나라 · 지옥 · 이공간 · 서울
const SEP = new Set(['hell', 'void', 'seoul']); // 난이도마다 따로 쓰는 맵 (꿈나라 노멀만 예전 표)
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

// 5-2 입력 기록으로 본 사람 같지 않음: 누름 사이 간격의 변동계수가 2% 미만(30번 이상) · 50ms 안 연속 누름이 대부분
//   돌려주는 값: 이유 글자 또는 null. 막지 않고 검토(노란 리포트)로만 쓴다
export function inputRobotic(rp) {
  const T = [0]; for (const d of rp.dts) T.push(T[T.length - 1] + d / 10); // 프레임 시작 시각(ms)
  let prev = 0; const press = [];
  for (const [f, v] of rp.evs) { if (v & ~prev) press.push(T[f]); prev = v; }
  if (press.length < 30) return null;
  const gaps = press.slice(1).map((t, i) => t - press[i]).filter((g) => g > 0), m = gaps.reduce((a, v) => a + v, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, v) => a + (v - m) ** 2, 0) / gaps.length);
  if (m > 0 && sd / m < 0.02) return `even-gaps cv=${(sd / m).toFixed(3)}`;
  if (gaps.filter((g) => g < 50).length / gaps.length > 0.8) return 'superhuman-taps';
  return null;
}
export class DreamBoard {
  // name: 저장 파일 이름 (토스 미니앱은 'dream-runner-toss' 로 따로) · opt.pool: 기록 다시 돌리기 스레드를 같이 쓴다 · opt.ads: 광고 보너스를 주는 순위표
  constructor(dataDir, name = 'dream-runner', opt = {}) {
    this.file = path.join(dataDir, `${name}.json`); this.ads = !!opt.ads; this.adGot = new Map(); this.adDay = new Map();
    this.best = {};   // 스피드전: sub → { name, color, score, dist, stars, themes, time, at, guest }
    this.bestItem = {}; // 아이템전
    this.boards = {};   // 노멀(easy) 말고 다른 난이도: 'speed:hard' → { sub → 기록 } (노멀은 위 둘을 그대로 쓴다)
    this.dieAll = {};   // map → { 죽은 이유 → 판수 } (모든 사람)
    this.stats = {};    // sub → { runs, time, by: { easy: { runs, time } } } (순위와 상관없이 달린 판수 · 시간)
    this.hg = {}; this.hgSess = {}; // 한강 러닝: sub → { m 모두 · best 한 번에 · runs · sec · mo 순간별 } · 달리는 중인 판
    this.daily = {}; this.first = {}; // 운영 지표: 날짜(한국 시간) → 하루 숫자 · sub → 처음 달린 날
    this.runs = 0; this.pending = []; this.reports = []; this.secret = crypto.randomBytes(24).toString('hex'); this.vstat = { ok: 0, bad: 0, none: 0, skip: 0 }; this.dayStars = new Map();
    this.lastPost = new Map(); this.hourN = new Map();
    this.lastPlay = new Map();
    this.ipHits = new Map();
    try {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.best = d.best || {}; this.bestItem = d.bestItem || {}; this.boards = d.boards || {}; this.stats = d.stats || {}; this.dieAll = d.dieAll || {}; this.daily = d.daily || {}; this.first = d.first || {}; this.hg = d.hg || {}; this.hgSess = d.hgSess || {}; this.runs = d.runs || 0; this.reports = d.reports || []; this.secret = d.secret || this.secret;
      // 예전 '확인 대기' 기록: 순위표에 올리고 비상 리포트로 옮긴다 (더는 기다리게 하지 않는다)
      for (const p of d.pending || []) { this.mig = true; const T = this.table(p.mode, p.diff, p.map); if (!T[p.sub] || p.e.score > T[p.sub].score) T[p.sub] = p.e; this.report('red', p.sub, p.mode, p.diff, p.map, p.why, p.e, p.r); }
    } catch { /* 처음 */ }
    this.dirty = !!this.mig; this.tickets = new Tickets(this.secret); this.pool = opt.pool || new ReplayPool(DREAM_VER, archiveCode(dataDir, DREAM_VER)); this.done = new Map(); this.busy = new Set();
    try { this.tickets.load(JSON.parse(fs.readFileSync(this.file, 'utf8')).used); } catch { /* 처음 */ }
    setInterval(() => this.save(), 20000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify({ best: this.best, bestItem: this.bestItem, boards: this.boards, stats: this.stats, dieAll: this.dieAll, daily: this.daily, first: this.first, hg: this.hg, hgSess: this.hgSess, runs: this.runs, reports: this.reports, secret: this.secret, used: this.tickets.dump(TICKET_TTL) })); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('드림 러너 저장 실패', e); }
  }
  // map: 'hell' 은 난이도마다 따로 (꿈나라 노멀은 예전 표 그대로)
  table(mode, diff, map = 'dream') { if (SEP.has(map)) return (this.boards[`${map}:${mode}:${diff}`] ||= {}); if (diff !== 'easy') return (this.boards[`${mode}:${diff}`] ||= {}); return mode === 'item' ? this.bestItem : this.best; }
  // 보류(hold: 사람 같지 않은 입력 · 상위권)된 기록은 그 주인(viewer)에게만 보인다
  sorted(mode, diff, map, viewer = null) { return Object.entries(this.table(mode, diff, map)).filter(([s, e]) => !e.hold || s === viewer).sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at); }
  // 메달: 드림러너 모든 순위표(난이도 × 꿈나라 · 지옥)의 지금 1 ~ 3위 메달. 익스트림 이상 먼저(1위 → 2위 → 3위, 같은 순위면 높은 난이도 · 지옥 먼저), 그다음 익스트림 아래
  podium() {
    const P = new Map();
    Object.keys(DIFFS).forEach((diff, di) => { MAPS.forEach((map, mi) => { const all = this.sorted('speed', diff, map); all.slice(0, 3).forEach(([sub], i) => { const id = boardMedal(`dr.${map}.${diff}`, i + 1, all.length); if (id) { if (!P.has(sub)) P.set(sub, []); P.get(sub).push({ id, di, mi, rank: i + 1 }); } }); }); });
    return P;
  }
  // 한 줄의 메달 · 칭호: 이 순위표 메달(상위 %)도 넣고, 같은 1위를 말하는 칭호는 메달과 겹치니 뺀다. 다른 게임 칭호는 띄우지 않는다
  badges(sub, P, mode, diff, map, rank, n) {
    const L = [...(P.get(sub) || [])], own = mode === 'speed' ? boardMedal(`dr.${map}.${diff}`, rank, n) : null;
    if (own && !L.some((m) => m.id === own)) L.push({ id: own, di: Object.keys(DIFFS).indexOf(diff), mi: MAPS.indexOf(map), rank });
    const hi = (m) => (m.di >= 2 ? 0 : 1), medals = L.sort((a, b) => hi(a) - hi(b) || a.rank - b.rank || b.di - a.di || b.mi - a.mi).map((m) => m.id); // 같은 순위 · 난이도면 이공간 → 지옥 → 꿈나라
    let title = getCos()?.titleOf(sub, ['dr.', 'dream-runner.']) || null;
    if (title && medals.some((id) => { const it = itemById.get(id); return it?.fx.honor === 0 && `title.${it.ach}` === title; })) title = null;
    return { title, medals, medal: own };
  }
  top(mode, diff, map) {
    const all = this.sorted(mode, diff, map), n = all.length, P = this.podium(); return all.slice(0, TOP).map(([sub, e], i) => ({ rank: i + 1, id: publicId(sub), ...this.badges(sub, P, mode, diff, map, i + 1, n), name: nameOf(sub, e), color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon }));
  }
  // 명예의 전당: 꿈나라 초월 1위 → 지옥 초월 1위 → 꿈나라 광속 1위 → … → 지옥 익스트림 1위, 다음은 2위 · 3위 차례로. 한 사람은 한 번만 (가장 높은 자리)
  fame(n = 12) {
    const order = ['beyond', 'lightspeed', 'extreme'].flatMap((diff) => MAPS.map((map) => [diff, map])), seen = new Set(), out = [], P = this.podium();
    for (let r = 0; r < 3; r++) for (const [diff, map] of order) {
      if (out.length >= n) return out;
      const all = this.sorted('speed', diff, map), x = all[r]; if (!x || seen.has(x[0])) continue;
      const [sub, e] = x; seen.add(sub);
      out.push({ rank: r + 1, diff, map, id: publicId(sub), name: nameOf(sub, e), color: e.color, score: e.score, medals: this.badges(sub, P, 'speed', diff, map, r + 1, all.length).medals }); // 그 사람의 메달 모두 (순위표와 같은 순서)
    }
    return out;
  }
  mine(sub, mode, diff, map, badges = true) {
    const T = this.table(mode, diff, map);
    if (!sub || !T[sub]) return null;
    const i = this.sorted(mode, diff, map, sub).findIndex(([s]) => s === sub);
    const e = T[sub];
    return { rank: i + 1, id: publicId(sub), ...(badges ? this.badges(sub, this.podium(), mode, diff, map, i + 1, Object.keys(T).length) : null), name: nameOf(sub, e), color: e.color, score: e.score, dist: e.dist, stars: e.stars, themes: e.themes, guest: !!e.guest, anon: !!e.anon };
  }
  // 달린 기록: 탈락 · 그만두기 · 팀전 끝 모두 센다 (순위에 올리지 않아도 센다)
  // 출발표 확인: 서버 서명 · 맵 · 난이도 (· 모드) 가 맞고, 받은 지 6시간 안이어야 한다. 아니면 null
  ticketFor(b, diff, map, mode, now) {
    const tk = this.tickets.read(b.tk);
    if (!tk || now - tk.at > TICKET_TTL || tk.at - now > 5000 || tk.diff !== diff || tk.map !== map || (mode && tk.mode !== mode)) return null;
    return tk;
  }
  // 같은 판을 다시 보내면(네트워크 재시도) 처음 결과를 그대로 돌려준다
  remember(key, res) { this.done.set(key, { res, at: Date.now() }); if (this.done.size > 20000) { const now = Date.now(); for (const [k, v] of this.done) if (now - v.at > TICKET_TTL) this.done.delete(k); } return res; }
  // 달린 기록: 탈락 · 그만두기 · 팀전 끝 모두 센다 (순위에 올리지 않아도 센다)
  //   판수 · 시간 · 별은 출발표 한 장에 한 번만 (출발표 없는 판은 세지도 주지도 않는다)
  played(sub, b) {
    const now = Date.now(), time = Number(b.time), diff = diffOf(b.diff), map = mapOf(b.map);
    if (!Number.isFinite(time) || time < 3 || time > 4 * 3600) throw new Error('기록이 이상해요');
    const tk = this.ticketFor(b, diff, map, null, now);
    if (!tk) throw new Error('출발표가 없거나 맞지 않는 판이에요');
    const key = `played:${tk.id}`, again = this.done.get(key);
    if (again) { if (again.res.sub !== sub) throw new Error('다른 사람의 판이에요'); return again.res.out; }
    if (!this.tickets.once(tk.id, 'played')) return { earned: 0, dup: true }; // 서버를 다시 켠 뒤의 재전송
    const real = (now - tk.at) / 1000;
    if (time > real + 5) throw new Error('기록이 이상해요'); // 실제로 지난 시간보다 오래 달릴 수는 없다
    const s = (this.stats[sub] ||= { runs: 0, time: 0, by: {} }), d = (s.by[diff] ||= { runs: 0, time: 0 });
    s.runs++; s.time += Math.round(time); d.runs++; d.time += Math.round(time); this.dirty = true;
    // 죽은 이유 (6-10): 정해진 종류만 센다. 나 · 모두 따로 (맵마다)
    if (DIE_LABEL[b.die]) { const m1 = ((s.die ||= {})[map] ||= {}), m2 = (this.dieAll[map] ||= {}); m1[b.die] = (m1[b.die] || 0) + 1; m2[b.die] = (m2[b.die] || 0) + 1; }
    const D = this.day(now); D.runs++; D.time += Math.round(time); D.diff[diff] = (D.diff[diff] || 0) + 1; D.map[map] = (D.map[map] || 0) + 1; if (!D.subs.includes(sub)) D.subs.push(sub); this.first[sub] ||= dayKey(now);
    // 별 지갑: 실제로 지난 시간 · 거리에 비해 말이 안 되는 별은 받지 않는다
    const stars = Math.floor(Number(b.stars)) || 0, dist = Math.floor(Number(b.dist)) || 0;
    let out = { earned: 0 };
    if (stars > 0 && stars <= dist / 2 + 5 && dist <= time * 80 * DIFFS[diff].k + 60 && dist <= real * 80 * DIFFS[diff].k + 60) {
      const day = Math.floor(now / 864e5), dk = `${sub}:${day}`, used = this.dayStars.get(dk) || 0; if (this.dayStars.size > 50000) this.dayStars.clear();
      if (used < DAY_STARS) {
        const earned = getCos()?.earn(sub, stars, diff, map) || 0; this.dayStars.set(dk, used + earned);
        if (this.ads && earned > 0) { this.adGot.set(tk.id, { sub, earned, at: now }); if (this.adGot.size > 20000) for (const [k, v] of this.adGot) if (now - v.at > 3600e3) this.adGot.delete(k); }
        out = { earned, ad: this.ads && earned > 0 }; if (out.ad) D.adOffer++;
      }
    }
    if (!out.earned) getCos()?.refresh(sub);
    this.remember(key, { sub, out }); return out;
  }
  // 광고 보너스 (토스 미니앱): 그 판에 받은 별만큼 한 번 더. 판마다 한 번 · 하루 40번까지 · 판이 끝나고 한 시간 안
  adBonus(sub, b) {
    const tk = this.tickets.read(b.tk), got = tk && this.adGot.get(tk.id), now = Date.now();
    if (!this.ads || !got || got.sub !== sub || now - got.at > 3600e3) throw new Error('보너스를 받을 수 없는 판이에요');
    const day = `${sub}:${Math.floor(now / 864e5)}`, n = this.adDay.get(day) || 0; if (n >= 40) throw new Error('오늘 광고 보너스는 다 받았어요');
    if (!this.tickets.once(tk.id, 'ad')) throw new Error('이미 받았어요');
    this.adDay.set(day, n + 1); if (this.adDay.size > 50000) this.adDay.clear(); this.adGot.delete(tk.id);
    const bonus = getCos()?.earnRaw?.(sub, got.earned) ?? 0, D = this.day(now); D.adWatch++; D.adStars += bonus; if (!D.adSubs.includes(sub)) D.adSubs.push(sub); this.dirty = true;
    return { bonus };
  }
  // 🌉 한강 러닝: 장애물이 없는 힐링 맵이라 순위표는 없다. 달린 거리는 실제로 흐른 시간으로만 믿는다 (초속 26m 까지)
  hgStart() { return this.tickets.issue({ seed: 0, diff: 'hg', map: 'hangang', mode: 'hangang' }); }
  hgRun(sub, b) {
    const now = Date.now(), tk = this.tickets.read(b.tk);
    if (!tk || tk.mode !== 'hangang' || now - tk.at > HG_TTL || tk.at - now > 5000) throw new Error('한강 출발표가 없거나 오래됐어요');
    const S = (this.hgSess[tk.id] ||= { sub, m: 0, sec: 0, mo: {}, at: tk.at });
    if (S.sub !== sub) throw new Error('다른 사람의 달리기예요');
    const real = (now - tk.at) / 1000, m = Math.max(0, Math.min(Math.floor(Number(b.m)) || 0, real * 26 + 30)), sec = Math.max(0, Math.min(Math.floor(Number(b.sec)) || 0, real + 5));
    const U = (this.hg[sub] ||= { m: 0, best: 0, runs: 0, sec: 0, mo: {} }), delta = Math.max(0, m - S.m);
    if (!S.counted) { S.counted = 1; U.runs++; }
    U.m += delta; U.sec += Math.max(0, sec - S.sec); S.m = Math.max(S.m, m); S.sec = Math.max(S.sec, sec); U.best = Math.max(U.best, S.m);
    for (const k of HG_MO) { const v = Math.min(Math.floor(Number(b.mo?.[k])) || 0, S.m); if (v > (S.mo[k] || 0)) S.mo[k] = v; U.mo[k] = Math.max(U.mo[k] || 0, S.mo[k] || 0); }
    const D = this.day(now); D.hgM = (D.hgM || 0) + delta; D.hgSubs ||= []; if (!D.hgSubs.includes(sub)) D.hgSubs.push(sub); this.first[sub] ||= dayKey(now);
    this.dirty = true;
    for (const [id, x] of Object.entries(this.hgSess)) if (now - x.at > HG_TTL) delete this.hgSess[id];
    const fresh = getCos()?.refresh(sub) || [];
    return { m: U.m, best: U.best, fresh };
  }
  // 서울 명소 도장: 출발표(그 판) 안에서 begin → (최소 시간) → done. 같은 판에서 begin 은 명소마다 기억, 도장은 처음 찍은 시각만 남는다
  hgStamp(sub, b) {
    const now = Date.now(), tk = this.tickets.read(b.tk), id = String(b.id || '');
    if (!tk || tk.mode !== 'hangang' || now - tk.at > HG_TTL) throw new Error('출발표가 없거나 오래됐어요');
    if (!(id in HG_STAMPS)) throw new Error('모르는 명소예요');
    const S = (this.hgSess[tk.id] ||= { sub, m: 0, sec: 0, mo: {}, at: tk.at }); if (S.sub !== sub) throw new Error('다른 사람의 판이에요');
    const U = (this.hg[sub] ||= { m: 0, best: 0, runs: 0, sec: 0, mo: {} }); U.stamps ||= {};
    if (b.phase === 'begin') { S.exp ||= {}; S.exp[id] = now; this.dirty = true; return { stamps: U.stamps }; }
    const t0 = S.exp?.[id]; if (!t0 || now - t0 < HG_STAMPS[id] * 1000) throw new Error('체험을 끝까지 해 주세요');
    delete S.exp[id]; const fresh0 = !U.stamps[id]; if (fresh0) U.stamps[id] = now; this.dirty = true;
    const fresh = fresh0 ? getCos()?.refresh(sub) || [] : [];
    return { stamps: U.stamps, fresh };
  }
  // 서울 산책: 로그인한 사람만 계정에 위치(지역마다) · 가 본 칸을 둔다 (로그인 없이도 기기에 저장되어 그대로 즐길 수 있다)
  hgMe(sub) { const U = this.hg[sub] || {}; return { pos: U.pos || null, visit: U.visit || [], m: U.m || 0, best: U.best || 0, stamps: U.stamps || {} }; }
  hgSave(sub, b) {
    const U = (this.hg[sub] ||= { m: 0, best: 0, runs: 0, sec: 0, mo: {} }), num = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.round(+v * 100) / 100 : undefined);
    if (b.pos && typeof b.pos === 'object') {
      const P = (U.pos ||= { regions: {} });
      for (const [id, r] of Object.entries(b.pos.regions || {}).slice(0, 40)) {
        if (!/^[a-z]{2,12}$/.test(id) || !r || typeof r !== 'object') continue; const at = Math.min(+r.at || 0, Date.now() + 60000), old = P.regions[id]; if (old && (old.at || 0) >= at) continue;
        P.regions[id] = { x: num(r.x), z: num(r.z), face: num(r.face), s: num(r.s), lat: num(r.lat), where: String(r.where || '').slice(0, 80), at };
      }
      const last = String(b.pos.last || ''), at = Math.min(+b.pos.at || 0, Date.now() + 60000); if (/^[a-z]{2,12}$/.test(last) && P.regions[last] && at >= (P.at || 0)) { P.last = last; P.at = at; }
    }
    if (Array.isArray(b.visit)) { const V = new Set(U.visit || []); for (const k of b.visit.slice(0, 600)) if (typeof k === 'string' && /^-?\d{1,3}_-?\d{1,3}$/.test(k)) V.add(k); U.visit = [...V].slice(0, 800); }
    this.dirty = true; return this.hgMe(sub);
  }
  // 오늘(한국 시간) 지표 칸: 달린 사람(subs) · 판수 · 시간 · 난이도 · 맵 · 광고 제안(adOffer) · 시청(adWatch) · 광고로 준 별 · 광고 본 사람
  day(now = Date.now()) {
    const k = dayKey(now);
    if (!this.daily[k]) { this.daily[k] = { runs: 0, time: 0, subs: [], diff: {}, map: {}, adOffer: 0, adWatch: 0, adStars: 0, adSubs: [] }; const old = dayKey(now - DAILY_KEEP * 864e5); for (const q of Object.keys(this.daily)) if (q < old) delete this.daily[q]; }
    return this.daily[k];
  }
  // 내 기록 한눈에: 판수 · 시간 · 난이도 · 모드별 지금 순위
  myStats(sub, map = 'dream') {
    const s = (sub && this.stats[sub]) || { runs: 0, time: 0, by: {} }, diffs = {};
    for (const k of Object.keys(DIFFS)) {
      const row = { runs: s.by[k]?.runs || 0, time: s.by[k]?.time || 0 };
      for (const mode of ['speed', 'item']) { const m = this.mine(sub, mode, k, map, false); row[mode] = m ? { rank: m.rank, score: m.score, of: Object.keys(this.table(mode, k, map)).length } : null; }
      diffs[k] = row;
    }
    const top = (o) => Object.entries(o || {}).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => ({ k, label: DIE_LABEL[k], n }));
    return { runs: s.runs, time: s.time, diffs, die: top(s.die?.[map]), dieAll: top(this.dieAll[map]) };
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
    // 그 판을 달린 게임 코드로 다시 돌린다 (토스 미니앱은 검수 때문에 예전 판으로 돌 수 있다). 서버가 보관한 적 없는 판이면 확인할 수 없다
    const ver = VER_RE.test(String(b.ver || '')) ? String(b.ver) : DREAM_VER;
    if (ver !== DREAM_VER && !hasVer(ver)) { this.vstat.old = (this.vstat.old || 0) + 1; return { ok: false, why: 'oldver' }; }
    const seed = tk ? tk.seed : Number(b.seed) | 0;
    const r = await this.pool.run({ seed, diff, map, dts: rp.dts, evs: rp.evs, ver });
    if (!r) return { ok: false, why: 'busy', soft: true };
    // 브라우저마다 소수점 끝자리가 조금 달라도 괜찮게 약간의 오차는 넘어간다
    const dOk = r.dead && Math.abs(r.dist - Number(b.dist)) <= Math.max(3, r.dist * 0.01), sOk = Math.abs(r.stars - Number(b.stars)) <= Math.max(1, r.stars * 0.02);
    if (!dOk || !sOk) { this.vstat.bad++; console.warn(`드림 러너 기록 불일치: 보냄 ${b.dist}m ★${b.stars} / 재생 ${r.dist}m ★${r.stars} (${diff} ${map}, ${rp.dts.length}프레임)`); return { ok: false, why: 'mismatch', r }; }
    // 느리게 돌리기(게임 시계를 늦추는 조작): 기록된 게임 시간이 실제로 지난 시간보다 한참 짧은데, 느린 기기처럼 프레임이 막힌(0.05초) 흔적도 없으면 의심
    if (tk) { const real = (now - tk.at) / 1000, capped = rp.dts.filter((v) => v >= 500).length / rp.dts.length;
      if (real - sum > Math.max(15, real * 0.25) && capped < 0.1) { this.vstat.slow = (this.vstat.slow || 0) + 1; console.warn(`드림 러너 느리게 돌리기 의심: 게임 ${sum.toFixed(1)}초 / 실제 ${real.toFixed(1)}초 (${diff} ${map})`); return { ok: false, why: 'slowmo', r, game: sum, real }; } }
    // 5-2 사람 같지 않은 입력: 입력 간격이 기계처럼 일정함 · 사람 반응보다 빠른 연타가 계속됨 → 막지 않고 검토로
    const bot = inputRobotic(rp);
    if (bot) { this.vstat.robot = (this.vstat.robot || 0) + 1; return { ok: false, why: 'robotic', r, detail: bot }; }
    this.vstat.ok++; return { ok: true, r, ticket: !!tk };
  }
  ticket(b) { return this.tickets.issue({ seed: Number(b.seed) | 0, diff: diffOf(b.diff), map: mapOf(b.map), mode: b.mode === 'item' ? 'item' : 'speed' }); }
  // 사람이 볼 목록 · 승인 · 삭제 (삭제하면 그 계정의 드림 러너 업적을 다시 계산하고 별을 거둔다)
  // 비상 리포트: 조작(AI) 의심 기록. 순위표에는 바로 올라가고, 운영자가 접속하면 크게 뜬다
  //   red = 서버가 다시 돌려 본 결과와 다름 · 시간이 맞지 않음 · 입력 기록 없음 (상위권)
  report(lvl, sub, mode, diff, map, why, e, r, extra) { this.reports.push({ id: crypto.randomBytes(5).toString('hex'), lvl, sub, mode, diff, map, why, name: e.name, score: e.score, dist: e.dist, stars: e.stars, time: e.time, eat: e.at, r: r ? { dist: r.dist, stars: r.stars } : null, ...extra, at: Date.now(), open: true }); if (this.reports.length > 300) this.reports.splice(0, this.reports.length - 300); this.dirty = true; console.warn(`드림 러너 비상 리포트(${lvl}): ${e.name} ${e.score}점 ${map} ${diff} (${why})`); }
  tkey(mode, diff, map) { return SEP.has(map) ? `${map}:${mode}:${diff}` : `${mode}:${diff}`; }
  adminList() { const flagged = []; for (const k of ['best', 'bestItem']) for (const [sub, e] of Object.entries(this[k])) if (e.u) flagged.push({ sub, t: k === 'best' ? 'speed:easy' : 'item:easy', ...e }); for (const [t, T] of Object.entries(this.boards)) for (const [sub, e] of Object.entries(T)) if (e.u) flagged.push({ sub, t, ...e }); for (const f of flagged) { f.name = nameOf(f.sub, f); delete f.char; } return { reports: this.reports.filter((x) => x.open).reverse().map((x) => ({ ...x, name: nameOf(x.sub, { name: x.name }), t: this.tkey(x.mode, x.diff, x.map), live: this.table(x.mode, x.diff, x.map)[x.sub]?.at === x.eat })), flagged: flagged.sort((a, b) => b.score - a.score).slice(0, 100), stat: this.vstat }; }
  // 정상으로 인정: 확인 안 됨 표시를 지워 업적 · 왕관도 받게 / 삭제: 기록을 지우고 별 · 업적을 거둔다 / 넘기기: 그대로 두고 리포트만 닫는다
  resolve(id, act) {
    const x = this.reports.find((q) => q.id === id); if (!x) throw new Error('없어요'); x.open = false; x.act = act; this.dirty = true;
    const T = this.table(x.mode, x.diff, x.map), e = T[x.sub];
    if (act === 'ok' && e && e.at === x.eat) { delete e.u; delete e.hold; e.v = 1; getCos()?.refresh(x.sub); }
    if (act === 'del') this.removeRecord(x.sub, this.tkey(x.mode, x.diff, x.map));
    for (const q of this.reports) if (q.open && q.sub === x.sub && act === 'del') q.open = false; // 지운 사람의 다른 리포트도 닫는다
  }
  verifyRecord(sub, t) { const e = this.tableOf(t)?.[sub]; if (!e) throw new Error('없어요'); delete e.u; delete e.hold; e.v = 1; this.dirty = true; for (const q of this.reports) if (q.open && q.sub === sub && this.tkey(q.mode, q.diff, q.map) === t) { q.open = false; q.act = 'ok'; } getCos()?.refresh(sub); }
  tableOf(t) { const [a, b] = String(t).split(':'); return SEP.has(a) ? this.boards[t] : b === 'easy' ? (a === 'item' ? this.bestItem : this.best) : this.boards[`${a}:${b}`]; }
  removeRecord(sub, t) { const [a, b, c] = String(t).split(':'), T = SEP.has(a) ? this.boards[t] : b === 'easy' ? (a === 'item' ? this.bestItem : this.best) : this.boards[`${a}:${b}`]; if (T?.[sub]) { delete T[sub]; this.dirty = true; } getCos()?.punish(sub, 'dr.'); void c; }
  // 한 판 끝: 말이 안 되는 기록은 거르고, 점수는 서버가 다시 계산한다
  // 한 판 끝: 출발표와 플레이 기록을 서버가 확인한 뒤에만 순위표에 올린다
  async submit(who, b) {
    const now = Date.now(), err = (msg, status = 400) => Object.assign(new Error(msg), { status });
    const time = Number(b.time), dist = Math.floor(Number(b.dist)), stars = Math.floor(Number(b.stars)), themes = Math.floor(Number(b.themes));
    if (![time, dist, stars, themes].every(Number.isFinite) || time < 1 || time > 4 * 3600 || dist < 0 || stars < 0 || themes < 1) throw new Error('기록이 이상해요');
    const mode = b.mode === 'item' ? 'item' : 'speed', diff = diffOf(b.diff), map = mapOf(b.map), T = this.table(mode, diff, map), k = DIFFS[diff].k;
    if (dist > time * (mode === 'item' ? MAX_SPEED_ITEM : MAX_SPEED) * k + 60 || stars > dist / 2 + 5 || themes > (time / 15) * k * 1.5 + 3) throw new Error('기록이 이상해요');
    const score = dist + stars * STAR_PTS;
    const tk = this.ticketFor(b, diff, map, mode, now);
    if (!tk) throw err('출발표가 없거나 맞지 않는 판이에요');
    const key = `score:${tk.id}`, again = this.done.get(key);
    if (again) { if (again.res.sub !== who.sub) throw err('다른 사람의 판이에요'); return again.res.out; } // 재전송: 처음 결과 그대로
    if (this.busy.has(tk.id)) throw err('확인하고 있어요', 503);
    if (this.tickets.used.has(`score:${tk.id}`)) throw err('이미 기록한 판이에요');
    if (time > (now - tk.at) / 1000 + 5) throw err('기록이 이상해요'); // 실제로 지난 시간보다 오래 달릴 수는 없다
    if (now - (this.lastPost.get(who.sub) || 0) < 2500) throw err('너무 빨라요');
    this.lastPost.set(who.sub, now);
    // 5-3 한 계정이 한 시간에 아주 많이 (사람은 닿지 못할 만큼: 한 시간 600판)
    const hk = `${who.sub}:${Math.floor(now / 3600e3)}`, hn = (this.hourN.get(hk) || 0) + 1; this.hourN.set(hk, hn); if (this.hourN.size > 50000) this.hourN.clear();
    if (hn > 600) { if (hn === 601) sec.note('record', { where: 'dream-runner', detail: 'too many scores/hour' }); throw err('기록을 너무 많이 남겼어요. 잠시 후 다시 해 주세요', 429); }
    this.busy.add(tk.id);
    let chk; try { chk = await this.check(b, diff, map, mode, now, T[who.sub]?.score || 0); } finally { this.busy.delete(tk.id); }
    // 혼자 달린 스피드전: 플레이 기록을 다시 돌려 봐서 맞아야만 올린다 (기록이 없거나 결과가 다르면 거절, 확인을 못 했으면 잠시 뒤 다시)
    if (chk.why === 'busy') throw err('기록을 확인하는 중이에요 · 잠시 뒤 다시 올려요', 503);
    if (['noreplay', 'mismatch', 'time', 'oldver'].includes(chk.why)) { console.warn(`드림 러너 기록 거절(${chk.why}): ${score}점 ${map} ${diff}`); throw err(chk.why === 'noreplay' ? '플레이 기록이 없는 판은 순위표에 올리지 않아요' : chk.why === 'oldver' ? '예전 버전으로 달린 판이라 확인할 수 없어요 · 앱을 업데이트해 주세요' : '플레이 기록과 점수가 맞지 않아요'); }
    if (!this.tickets.once(tk.id, 'score')) throw err('이미 기록한 판이에요');
    this.runs++; this.dirty = true;
    const name = clean(b.name, 14) || clean(who.user.nick || (who.user.guest ? who.user.name : ''), 14) || '꿈꾸는 곰돌이'; // 구글 실명은 쓰지 않는다
    const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#8a5634';
    const old = T[who.sub];
    const newBest = !old || score > old.score, entry = { name, color, score, dist, stars, themes, time: Math.round(time), at: now, guest: !!who.user.guest, anon: !!who.user.anon, ...(chk.ok ? { v: 1 } : { u: chk.why }) };
    tagChar(who.sub, entry);
    if (newBest) T[who.sub] = entry;
    // 비상 리포트 (기록은 바로 순위표에 오른다)
    if (newBest) { const higher = Object.values(T).filter((e) => e.score > score && !e.hold).length;
      if (chk.why === 'robotic' && higher < TOP_GUARD) { entry.hold = true; sec.note('record', { where: `dream-runner.${map}.${diff}`, detail: `held: robotic ${chk.detail} score=${score}` }); this.report('yellow', who.sub, mode, diff, map, 'robotic', entry, chk.r, { bot: chk.detail }); }
      else if (!chk.ok && !chk.soft && chk.why !== 'robotic' && higher < TOP_GUARD) this.report('red', who.sub, mode, diff, map, chk.why, entry, chk.r, chk.why === 'slowmo' ? { game: Math.round(chk.game), real: Math.round(chk.real) } : undefined); }
    else { old.name = name; old.color = color; old.char = entry.char; } // 이름·색은 최근 것으로
    getCos()?.refresh(who.sub); // 업적: 거리 · 순위
    const out = { score, mode, diff, map, newBest, prev: old?.score || 0, me: this.mine(who.sub, mode, diff, map), top: this.top(mode, diff, map), runs: this.runs };
    this.remember(key, { sub: who.sub, out }); return out;
  }
}

// /api/dream/* : 순위 보기는 누구나. 기록 올리기는 로그인(구글 · 체험판)이거나, 비로그인이면 임시 아이디 + 닉네임
const ANON = /^[a-f0-9]{16,40}$/;
export async function dreamApi(req, res, url, who, board, json, isAdmin) {
  const anonId = url.searchParams.get('anon');
  const mode = url.searchParams.get('mode') === 'item' ? 'item' : 'speed', diff = diffOf(url.searchParams.get('diff')), map = mapOf(url.searchParams.get('map'));
  if (url.pathname === '/api/dream/board') return json(res, 200, { mode, diff, map, top: board.top(mode, diff, map), me: board.mine(who?.sub || (ANON.test(anonId || '') ? 'anon:' + anonId : null), mode, diff, map), runs: board.runs });
  if (url.pathname === '/api/dream/fame') return json(res, 200, { fame: board.fame() });
  if (url.pathname === '/api/dream/adbonus' && req.method === 'POST') { if (!who) return json(res, 401, { error: 'login' }); const b = await readJson(req); try { return json(res, 200, board.adBonus(who.sub, b)); } catch (e) { return json(res, 400, { error: e.message }); } }
  if (url.pathname === '/api/dream/me') return json(res, 200, board.myStats(who?.sub || (ANON.test(anonId || '') ? 'anon:' + anonId : null), map));
  if (url.pathname === '/api/dream/played' && req.method === 'POST') {
    const b = await readJson(req);
    if (!who && !ANON.test(String(b.anon || ''))) return json(res, 401, { error: 'login' });
    if (!who) { // 비로그인은 한 곳(IP)에서 너무 자주 못 올린다
      const ip = req.headers['fly-client-ip'] || req.socket.remoteAddress || '', now = Date.now(), hits = (board.ipHits.get('p:' + ip) || []).filter((t) => now - t < 60000);
      if (hits.length >= 20) return json(res, 429, { error: '잠시 후 다시 시도해 주세요' });
      hits.push(now); board.ipHits.set('p:' + ip, hits);
    }
    if (!who && !anonOk(req, b.anon)) return json(res, 429, { error: ANON_FULL });
    try { return json(res, 200, { ok: true, ...board.played(who?.sub || 'anon:' + b.anon, b) }); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  // 한강 러닝: 시작 · 달린 거리 보내기 (로그인 없이도 이 기기 아이디로)
  if (url.pathname === '/api/dream/hangang/start' && req.method === 'POST') return json(res, 200, { tk: board.hgStart() });
  if (url.pathname === '/api/dream/hangang/run' && req.method === 'POST') {
    const b = await readJson(req);
    if (!who && !ANON.test(String(b.anon || ''))) return json(res, 401, { error: 'login' });
    if (!who && !anonOk(req, b.anon)) return json(res, 429, { error: ANON_FULL });
    try { return json(res, 200, board.hgRun(who?.sub || 'anon:' + b.anon, b)); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  // 서울 명소 도장 (로그인 없이도 이 기기 아이디로)
  if (url.pathname === '/api/dream/hangang/stamp' && req.method === 'POST') {
    const b = await readJson(req);
    if (!who && !ANON.test(String(b.anon || ''))) return json(res, 401, { error: 'login' });
    if (!who && !anonOk(req, b.anon)) return json(res, 429, { error: ANON_FULL });
    try { return json(res, 200, board.hgStamp(who?.sub || 'anon:' + b.anon, b)); } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (url.pathname === '/api/dream/hangang/stamps') { const sub = who?.sub || (ANON.test(anonId || '') ? 'anon:' + anonId : null); if (!sub) return json(res, 401, { error: 'login' }); return json(res, 200, { stamps: board.hg[sub]?.stamps || {} }); }
  // 서울 산책: 계정에 저장된 위치 · 가 본 칸 (로그인한 사람만)
  if (url.pathname === '/api/dream/hangang/me') { if (!who) return json(res, 401, { error: 'login' }); return json(res, 200, board.hgMe(who.sub)); }
  if (url.pathname === '/api/dream/hangang/save' && req.method === 'POST') { if (!who) return json(res, 401, { error: 'login' }); const b = await readJson(req, 64 * 1024); return json(res, 200, board.hgSave(who.sub, b)); }
  // 출발표: 기다리지 않고 시작하고, 뒤에서 받아 둔다
  if (url.pathname === '/api/dream/ver') { const has = url.searchParams.get('has'); return json(res, 200, has ? { v: DREAM_VER, has: has === DREAM_VER || hasVer(has) } : { v: DREAM_VER }); }
  if (url.pathname === '/api/dream/run' && req.method === 'POST') { const b = await readJson(req); return json(res, 200, { tk: board.ticket(b), v: DREAM_VER }); }
  if (url.pathname.startsWith('/api/dream/admin/')) {
    if (!who || !isAdmin?.(who.user)) return json(res, 403, { error: '관리자만 할 수 있어요' });
    if (url.pathname === '/api/dream/admin/list') return json(res, 200, board.adminList());
    const b = await readJson(req);
    try { if (url.pathname === '/api/dream/admin/resolve') board.resolve(String(b.id), ['ok', 'del', 'skip'].includes(b.act) ? b.act : 'skip'); else if (url.pathname === '/api/dream/admin/verify') board.verifyRecord(String(b.sub), String(b.t)); else if (url.pathname === '/api/dream/admin/remove') board.removeRecord(String(b.sub), String(b.t)); else return json(res, 404, { error: 'not found' }); return json(res, 200, board.adminList()); } catch (e) { return json(res, 400, { error: e.message }); }
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
      if (!anonOk(req, b.anon)) return json(res, 429, { error: ANON_FULL });
      who = { sub: 'anon:' + b.anon, user: { name: '', anon: true } };
    }
    try { return json(res, 200, await board.submit(who, b)); } catch (e) { return json(res, e.status || 400, { error: e.message }); }
  }
  return json(res, 404, { error: 'not found' });
}
