// 운영 지표 뽑기: 서버 데이터 폴더(/data)의 저장 파일을 읽어 합계 숫자만 마크다운으로 낸다 (개인 정보 · 닉네임은 내보내지 않는다)
//   서버에서 받기: for f in world dream-runner dream-runner-toss cosmetics board jelly-drift jelly-merge jelly-slide jelly-survivor jelly-ten jelly-type; do fly ssh console -a jelly-city -q -C "cat /data/$f.json" > DIR/$f.json; done
//   쓰기: node tools/metrics.mjs DIR > docs/metrics.md
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.argv[2];
if (!DIR) { console.error('사용법: node tools/metrics.mjs <데이터 폴더>'); process.exit(1); }
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, `${f}.json`), 'utf8')); } catch { return null; } };
const DAY = 864e5, now = Date.now();
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const hours = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)}시간` : `${Math.round(sec / 60)}분`);
const date = (t) => new Date(t).toISOString().slice(0, 10);
const out = [];
const p = (s = '') => out.push(s);

const world = read('world'), dr = read('dream-runner'), drT = read('dream-runner-toss'), cos = read('cosmetics'), board = read('board');
const DIFF = { easy: '노멀', hard: '하드', extreme: '익스트림', lightspeed: '광속', beyond: '초월' };
// 난이도 키 → 화면 이름 (public/dream-runner/js/diff.js 기준)
try { const { DIFFS } = await import('../public/dream-runner/js/diff.js'); for (const [k, v] of Object.entries(DIFFS)) DIFF[k] = v.name || v.label || DIFF[k]; } catch { /* 기본 이름 */ }
const MAP = { dream: '꿈나라', hell: '지옥', void: '이공간' };

p('# 운영 지표');
p();
p(`> ${date(now)} 기준 · 실제 서버 저장 파일에서 \`tools/metrics.mjs\`로 뽑은 합계예요. 개인 정보와 닉네임은 넣지 않아요.`);
p();

// ---------- 계정 ----------
if (world) {
  const us = Object.values(world.users || {});
  const first = Math.min(...us.map((u) => u.created || now));
  const back1 = us.filter((u) => (u.last || 0) - (u.created || 0) >= DAY).length;
  const back7 = us.filter((u) => (u.last || 0) - (u.created || 0) >= 7 * DAY).length;
  const act7 = us.filter((u) => now - (u.last || 0) < 7 * DAY).length;
  p('## 계정 (구글 로그인)');
  p();
  p('| 항목 | 값 |');
  p('|---|---|');
  p(`| 서비스 시작 (첫 가입) | ${date(first)} (${Math.floor((now - first) / DAY)}일 전) |`);
  p(`| 가입 계정 | ${fmt(us.length)}명 |`);
  p(`| 만든 캐릭터 | ${fmt(us.reduce((a, u) => a + (u.chars || []).length, 0))}개 |`);
  p(`| 가입 후 하루 이상 지나 다시 온 계정 | ${fmt(back1)}명 (${pct(back1, us.length)}) |`);
  p(`| 가입 후 7일 이상 지나 다시 온 계정 | ${fmt(back7)}명 (${pct(back7, us.length)}) |`);
  p(`| 최근 7일 안에 접속 | ${fmt(act7)}명 |`);
  p();
  p('체험판 계정은 2일 동안 접속하지 않으면 지워져서 위 숫자에서 빠져요. 로그인 없이 기록만 남긴 사람은 아래 드림 러너 숫자에 들어가요.');
  p();
}

// ---------- 드림 러너 ----------
if (dr) {
  const stats = Object.values(dr.stats || {}), runs = stats.reduce((a, s) => a + (s.runs || 0), 0), time = stats.reduce((a, s) => a + (s.time || 0), 0);
  const byDiff = {}; for (const s of stats) for (const [k, v] of Object.entries(s.by || {})) { byDiff[k] ||= { runs: 0, time: 0, people: 0 }; byDiff[k].runs += v.runs || 0; byDiff[k].time += v.time || 0; if (v.runs) byDiff[k].people++; }
  const perPlayer = stats.map((s) => s.runs || 0).filter(Boolean), top = [...perPlayer].sort((a, b) => b - a);
  const top3 = top.slice(0, 3).reduce((a, b) => a + b, 0);
  const tables = Object.entries(dr.boards || {}); tables.push(['speed:easy', dr.best || {}], ['item:easy', dr.bestItem || {}]);
  const subs = new Set(), byMap = {}, byMode = { speed: 0, item: 0 }; let entries = 0, verified = 0;
  for (const [key, T] of tables) {
    const parts = key.split(':'), map = parts.length === 3 ? parts[0] : 'dream', mode = parts.length === 3 ? parts[1] : parts[0];
    byMap[map] ||= new Set();
    for (const [sub, e] of Object.entries(T)) { subs.add(sub); byMap[map].add(sub); entries++; byMode[mode] = (byMode[mode] || 0) + 1; if (e.v) verified++; }
  }
  const anon = [...subs].filter((s) => s.startsWith('anon:') || s.startsWith('guest:')).length;
  p('## 드림 러너');
  p();
  p('| 항목 | 값 |');
  p('|---|---|');
  p(`| 판수 (통계를 모으기 시작한 뒤) | ${fmt(runs)}판 · ${hours(time)} |`);
  p(`| 한 판 평균 | ${fmt(runs ? time / runs : 0)}초 |`);
  p(`| 판수가 기록된 플레이어 | ${fmt(perPlayer.length)}명 · 한 사람 중앙값 ${fmt(median(perPlayer))}판 |`);
  p(`| 상위 3명이 차지한 판수 | ${pct(top3, runs)} |`);
  p(`| 순위표에 기록이 있는 사람 | ${fmt(subs.size)}명 (로그인 없이 남긴 기록 ${fmt(anon)}명 포함) |`);
  p(`| 순위표 기록 수 | ${fmt(entries)}개 · 서버가 다시 돌려 확인한 기록 ${pct(verified, entries)} |`);
  p(`| 스피드전 : 아이템전 기록 | ${fmt(byMode.speed)} : ${fmt(byMode.item)} |`);
  p();
  p('### 맵별 기록이 있는 사람');
  p();
  p('| 맵 | 사람 |');
  p('|---|---|');
  for (const m of ['dream', 'hell', 'void']) p(`| ${MAP[m]} | ${fmt(byMap[m]?.size || 0)}명 |`);
  p();
  p('### 난이도별 플레이');
  p();
  p('| 난이도 | 판수 | 비율 | 플레이 시간 | 해 본 사람 |');
  p('|---|---|---|---|---|');
  for (const k of Object.keys(DIFF)) { const v = byDiff[k]; if (!v) continue; p(`| ${DIFF[k]} | ${fmt(v.runs)}판 | ${pct(v.runs, runs)} | ${hours(v.time)} | ${fmt(v.people)}명 |`); }
  p();
  const why = {}; for (const r of dr.reports || []) why[r.why] = (why[r.why] || 0) + 1;
  p('### 부정 기록 검사');
  p();
  p(`- 운영자에게 올라간 의심 기록: ${fmt((dr.reports || []).length)}건${Object.keys(why).length ? ` (${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`);
  p(`- 순위표에 올라간 기록 중 다시 돌려 확인된 비율: ${pct(verified, entries)}`);
  p();
}
// 지난 활동 추정: 하루 지표를 쌓기 전에는 판마다의 날짜가 없다. 대신 날짜가 남는 두 가지로 '그날 달렸다'를 추정한다
//   ① 순위표 기록의 at (그날 최고 기록을 냈다) ② 드림 러너 업적을 딴 시각 (그날 달려서 업적을 땄다)
//   기록을 깨지도 업적을 따지도 못한 날은 빠지니, 실제보다 적게 잡힌다 (재방문율도 실제보다 낮게 나온다)
const kst = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
function pastActivity(B, cosUsers, prefix = '') {
  const act = new Map(), add = (sub, t) => { if (!t || !sub.startsWith(prefix)) return; if (!act.has(sub)) act.set(sub, new Set()); act.get(sub).add(kst(t)); };
  for (const T of [...Object.values(B.boards || {}), B.best || {}, B.bestItem || {}]) for (const [sub, e] of Object.entries(T)) add(sub, e.at);
  for (const [sub, u] of Object.entries(cosUsers || {})) if (B.stats?.[sub] || Object.values(B.boards || {}).some((T) => T[sub])) for (const [k, t] of Object.entries(u.ach || {})) if (k.startsWith('dr.')) add(sub, t);
  return act;
}
// 하루 지표 (서버가 daily 를 쌓기 시작한 뒤부터): 달린 사람 · 새로 온 사람 · 판수 · 광고 · 재방문율
function dailySection(title, B, past = new Map()) {
  const days = Object.keys(B?.daily || {}).sort();
  // 날마다 달린 사람: 하루 지표(정확) + 지난 활동(추정)
  const active = {}; for (const [sub, ds] of past) for (const d of ds) (active[d] ||= new Set()).add(sub);
  for (const d of days) for (const sub of B.daily[d].subs) (active[d] ||= new Set()).add(sub);
  const allDays = Object.keys(active).sort(); if (!allDays.length) return;
  const first = {}; for (const d of allDays) for (const sub of active[d]) first[sub] ||= d;
  const newOn = {}; for (const d of Object.values(first)) newOn[d] = (newOn[d] || 0) + 1;
  const est = past.size > 0, since = days[0] || '9999';
  const plus = (d, n) => new Date(Date.parse(d) + n * DAY).toISOString().slice(0, 10), today = allDays[allDays.length - 1];
  // 주간: 월요일 시작
  const monday = (d) => { const t = new Date(`${d}T00:00:00Z`), w = (t.getUTCDay() + 6) % 7; return new Date(t - w * DAY).toISOString().slice(0, 10); };
  const weeks = {}; for (const d of allDays) { const w = (weeks[monday(d)] ||= { subs: new Set(), fresh: 0 }); for (const sub of active[d]) w.subs.add(sub); w.fresh += newOn[d] || 0; }
  p(`### ${title}: 주간 활동${est ? ' (지표를 쌓기 전은 추정)' : ''}`);
  p();
  p('| 주 (월요일) | 달린 사람 | 처음 온 사람 |');
  p('|---|---|---|');
  for (const [w, x] of Object.entries(weeks).sort()) p(`| ${w}${w < monday(since) ? ' (추정)' : ''} | ${fmt(x.subs.size)} | ${fmt(x.fresh)} |`);
  p();
  if (days.length) {
  p(`### ${title}: 하루 지표 (최근 14일)`);
  p();
  p('| 날짜 | 달린 사람 | 새로 온 사람 | 판수 | 1인당 판수 | 광고 제안 | 광고 시청 | 시청률 | 광고 본 사람 |');
  p('|---|---|---|---|---|---|---|---|---|');
  // 판수 · 광고는 하루 지표를 쌓은 날만 정확하다
  for (const d of days.slice(-14)) { const x = B.daily[d], n = x.subs.length; p(`| ${d} | ${fmt(n)} | ${fmt(newOn[d] || 0)} | ${fmt(x.runs)} | ${n ? (x.runs / n).toFixed(1) : '-'} | ${fmt(x.adOffer || 0)} | ${fmt(x.adWatch || 0)} | ${pct(x.adWatch || 0, x.adOffer || 0)} | ${fmt((x.adSubs || []).length)} |`); }
  p();
  }
  // 재방문율: 처음 달린 날(코호트) 기준으로 1일 · 7일 뒤에 다시 달린 비율. 아직 그날이 안 온 코호트는 뺀다
  const ret = (n) => { let base = 0, back = 0; for (const [sub, d] of Object.entries(first)) { const t = plus(d, n); if (t > today) continue; base++; if (active[t]?.has(sub)) back++; } return [back, base]; };
  const [b1, n1] = ret(1), [b7, n7] = ret(7);
  const all = days.reduce((a, d) => a + B.daily[d].runs, 0), offer = days.reduce((a, d) => a + (B.daily[d].adOffer || 0), 0), watch = days.reduce((a, d) => a + (B.daily[d].adWatch || 0), 0);
  p(`- 활동 기간: ${allDays[0]} ~ ${today} · 달린 사람 ${fmt(Object.keys(first).length)}명${days.length ? ` · 하루 지표는 ${days[0]}부터 (판수 ${fmt(all)}판)` : ''}`);
  p(`- 다음 날 다시 달린 비율 (D1): ${pct(b1, n1)} (${fmt(b1)}/${fmt(n1)}명) · 7일 뒤 (D7): ${pct(b7, n7)} (${fmt(b7)}/${fmt(n7)}명)${est ? ' — 지난 기간은 기록을 깨거나 업적을 딴 날만 알 수 있어서 실제보다 낮게 나와요' : ''}`);
  if (offer) p(`- 보상형 광고: 제안 ${fmt(offer)}번 · 시청 ${fmt(watch)}번 · 시청률 ${pct(watch, offer)}`);
  p();
}
if (dr) dailySection('웹', dr, pastActivity(dr, cos?.users));
if (drT) {
  const n = Object.values(drT.boards || {}).reduce((a, T) => a + Object.keys(T).length, 0) + Object.keys(drT.best || {}).length + Object.keys(drT.bestItem || {}).length;
  p('### 토스 미니앱');
  p();
  p(`- 순위표 기록 ${fmt(n)}개`);
  p();
  dailySection('토스 미니앱', drT);
}

// ---------- 치장 · 별 ----------
if (cos) {
  const us = Object.values(cos.users || {});
  const earned = us.reduce((a, u) => a + (u.total || 0), 0), left = us.reduce((a, u) => a + (u.stars || 0), 0);
  const owned = us.reduce((a, u) => a + (u.owned || []).length, 0), buyers = us.filter((u) => (u.owned || []).length).length;
  const ach = us.reduce((a, u) => a + Object.keys(u.ach || {}).length, 0), equip = us.filter((u) => u.equip && Object.keys(u.equip).length).length;
  p('## 별 · 치장 (재화)');
  p();
  p('| 항목 | 값 |');
  p('|---|---|');
  p(`| 별을 받은 계정 | ${fmt(us.length)}명 |`);
  p(`| 지금까지 번 별 | ${fmt(earned)}개 · 쓴 별 ${fmt(earned - left)}개 (${pct(earned - left, earned)}) |`);
  p(`| 상점에서 산 치장 | ${fmt(owned)}개 · 산 사람 ${fmt(buyers)}명 (${pct(buyers, us.length)}) |`);
  p(`| 치장을 하나 이상 낀 계정 | ${fmt(equip)}명 (${pct(equip, us.length)}) |`);
  p(`| 달성한 업적 | ${fmt(ach)}개 · 한 사람 평균 ${fmt(us.length ? ach / us.length : 0)}개 |`);
  p();
}

// ---------- 다른 게임 · 게시판 ----------
const others = [['jelly-drift', '젤리 드리프트'], ['jelly-merge', '젤리 머지'], ['jelly-slide', '젤리 슬라이드'], ['jelly-survivor', '젤리 서바이버'], ['jelly-ten', '젤리 텐'], ['jelly-type', '젤리 타자']];
const rows = [];
for (const [f, name] of others) { const j = read(f); if (!j) continue; const subs = new Set(); let n = 0; for (const T of Object.values(j)) if (T && typeof T === 'object') for (const s of Object.keys(T)) { subs.add(s); n++; } rows.push(`| ${name} | ${fmt(n)}개 | ${fmt(subs.size)}명 |`); }
if (rows.length) { p('## 다른 게임 순위표'); p(); p('| 게임 | 기록 | 사람 |'); p('|---|---|---|'); for (const r of rows) p(r); p(); }
if (board) {
  const ps = board.posts || [];
  p('## 건의 게시판');
  p();
  p(`- 글 ${fmt(ps.length)}개 · 댓글 ${fmt(ps.reduce((a, x) => a + (x.comments || []).length, 0))}개`);
  p();
}
if (world?.feedback) { p(`- 게임 안 문의 · 제보: ${fmt(world.feedback.length)}건`); p(); }

console.log(out.join('\n'));
