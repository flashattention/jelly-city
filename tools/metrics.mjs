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
const date = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
const out = [];
const p = (s = '') => out.push(s);

const world = read('world'), dr = read('dream-runner'), drT = read('dream-runner-toss'), cos = read('cosmetics'), board = read('board');
const DIFF = { easy: '노멀', hard: '하드', extreme: '익스트림', lightspeed: '광속', beyond: '초월' };
// 난이도 키 → 화면 이름 (public/dream-runner/js/diff.js 기준)
try { const { DIFFS } = await import('../public/dream-runner/js/diff.js'); for (const [k, v] of Object.entries(DIFFS)) DIFF[k] = v.name || v.label || DIFF[k]; } catch { /* 기본 이름 */ }
const MAP = { dream: '꿈나라', hell: '지옥', void: '이공간' };

p('# 운영 지표');
p();
p(`> ${date(now)} 기준 · 실제 서버 저장 파일에서 \`tools/metrics.mjs\`로 뽑은 합계예요. 매일 00:17(KST)에 GitHub Actions(\`.github/workflows/metrics.yml\`)가 자동으로 다시 뽑아요. 개인 정보와 닉네임은 넣지 않아요.`);
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

// ---------- 게임별 플레이 시간 (playtime.json: 날짜 → 게임 → 1분마다 한 번 알림 · '#n' 은 판수) ----------
const pt = read('playtime');
if (pt?.d) {
  const names = {}; try { const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'); for (const m of html.matchAll(/href="\/((?:dream-runner|jelly-[a-z]+))\/"[\s\S]{0,1500}?<h3>([^<]+)</g)) names[m[1]] ??= m[2].trim(); } catch { /* 이름 없이 */ }
  const days = Object.keys(pt.d).sort(), kst = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10), since = (n) => kst(now - (n - 1) * DAY);
  const sum = (from, g, suffix = '') => days.filter((d) => d >= from).reduce((a, d) => a + (pt.d[d][`${g}${suffix}`] || 0), 0);
  const games = [...new Set(days.flatMap((d) => Object.keys(pt.d[d]).filter((k) => !k.includes('#'))))];
  const rowsP = games.map((g) => ({ g, m7: sum(since(7), g), m30: sum(since(30), g), all: sum('', g), n30: sum(since(30), g, '#n') })).filter((x) => x.all > 0).sort((a, b) => b.m30 - a.m30 || b.all - a.all);
  if (rowsP.length) {
    p('## 게임별 플레이 시간'); p();
    p(`- 집계 기간: ${days[0]} ~ ${days.at(-1)} (서버가 최근 120일만 보관) · 화면이 보이고 사람이 움직이는 동안 1분마다 한 번 센다`); p();
    p('| 게임 | 최근 7일 | 최근 30일 | 30일 판수 | 보관 기간 합계 |'); p('|---|---|---|---|---|');
    for (const x of rowsP) p(`| ${names[x.g] || x.g} | ${hours(x.m7 * 60)} | ${hours(x.m30 * 60)} | ${fmt(x.n30)}판 | ${hours(x.all * 60)} |`);
    p();
    const last = days.slice(-14); p('### 최근 14일 일별 (모든 게임)'); p(); p('| 날짜 | 플레이 시간 | 판수 |'); p('|---|---|---|');
    for (const d of last) { const D = pt.d[d]; let m = 0, n = 0; for (const [k, v] of Object.entries(D)) if (k.endsWith('#n')) n += v; else m += v; p(`| ${d} | ${hours(m * 60)} | ${fmt(n)}판 |`); }
    p();
  }
}

// ---------- 젤리 서울 러너 (익명 이용 이벤트: seoul-walk-metrics/날짜.jsonl, 정의는 docs/dream-runner/서울러너-지표.md) ----------
{
  const sw = path.join(DIR, 'seoul-walk-metrics'); let files = []; try { files = fs.readdirSync(sw).filter((f) => f.endsWith('.jsonl')).sort(); } catch { /* 아직 없음 */ }
  if (files.length) {
    const { buildReport } = await import('../server/seoul-walk/report.js'), readline = await import('node:readline');
    async function* rows() { for (const f of files) for await (const l of readline.createInterface({ input: fs.createReadStream(path.join(sw, f)), crlfDelay: Infinity })) { try { yield JSON.parse(l); } catch { /* 깨진 줄 */ } } }
    const R = await buildReport(rows(), { days: files.length }), O = R['개요'], Fn = R['퍼널'], Rt = R['리텐션'], A = R['지역'], B = R['행동'], T = R['기술'], U = R['유저별플레이시간'];
    const list = (xs, unit = '', n = 8) => (xs || []).slice(0, n).map(([k, v]) => `${k} ${typeof v === 'number' ? fmt(v) : v}${unit}`).join(' · ') || '-';
    const v = (x) => (x == null ? '-' : x), pc = (x) => (x == null ? '-' : `${x}%`);
    const KO = { pick: '직접 고름', random: '무작위', map: '지도', last: '이어 걷기', resume: '이어 걷기', direct: '주소로 바로', walk: '걷기', fly: '날기', idle: '멈춤', shop: '가게 안', station: '역 안', train: '열차', mall: '몰', deck: '전망대', cafe: '카페', bakery: '빵집', korean: '식당', chicken: '치킨', pizza: '피자', burger: '버거', chinese: '중식', japanese: '일식', pub: '술집', mart: '편의점' };
    const ko = (xs) => (xs || []).map(([k, n]) => [KO[k] || k, n]);
    p('## 젤리 서울 러너 (익명 이용 지표)'); p();
    p(`- 수집 기간: ${files[0].slice(0, 10)} ~ ${files.at(-1).slice(0, 10)} · 기기 = 익명 사용자 (같은 사람의 PC · 휴대폰은 둘로 센다)`); p();
    p('| 항목 | 값 |'); p('|---|---|');
    p(`| 기기 · 세션 · 게임 세션 | ${fmt(O.기기수)} · ${fmt(O.세션수)} · ${fmt(O.게임세션수)} |`);
    p(`| 총 플레이 시간 · 이동 거리 | ${v(O.총플레이시간_분)}분 · ${v(O.총이동거리_km)}km |`);
    p(`| 기기당 플레이 시간 (중앙값) | ${v(O.기기당플레이시간_중앙값_분)}분 |`);
    p(`| 세션 길이 중앙값 · p90 | ${v(O.세션시간_중앙값_분)}분 · ${v(O.세션시간_p90_분)}분 |`);
    p(`| 가 본 칸 (201칸 중) | ${fmt(O.플레이한_칸수)}칸 (${pc(O.칸_도달률_pct)}) |`);
    p(`| 재방문 D1 · D7 · D30 | ${pc(Rt.D1.pct)} · ${pc(Rt.D7.pct)} · ${pc(Rt.D30.pct)} (재방문 기기 ${fmt(Rt.재방문기기)}) |`);
    p(`| 플레이 시간 분포 (기기) | ${Object.entries(U.분포_기기수).map(([k, n]) => `${k} ${n}`).join(' · ')} |`);
    p();
    p('### 퍼널 (세션)'); p(); p('| 단계 | 세션 |'); p('|---|---|');
    for (const k of ['랜딩', '3D표시', '3장이상스크롤', '시작클릭', '게임시작', '첫화면준비', '첫이동', '플레이1분이상', '플레이5분이상']) p(`| ${k} | ${fmt(Fn[k] || 0)} |`);
    p(`| 랜딩 → 시작 클릭 | ${pc(Fn.랜딩대비시작클릭_pct)} |`); p(`| 게임 시작 → 첫 이동 | ${pc(Fn.시작대비첫이동_pct)} |`); p();
    p('### 어디서 · 무엇을'); p();
    p(`- 오래 머문 구: ${list(A.구별머문시간_분, '분')}`);
    p(`- 직접 고른 시작 (무작위 시작 제외): ${list(A.직접고른시작_상위, '회')}`);
    p(`- 시작 방식: ${list(ko(A.시작방식), '회')}`);
    p(`- 기능 사용 (게임 세션 중 비율): ${Object.entries(B.기능사용_세션).map(([k, x]) => `${k} ${pc(x.pct)}`).join(' · ')}`);
    p(`- 가게 종류 (방문): ${list(ko(B.가게종류_방문수), '회')}`);
    p(`- 가게 종류 (머문 시간): ${list(ko(B.가게종류_머문시간_분), '분')}`);
    p(`- 인기 메뉴: ${list(B.인기메뉴, '회', 5)} · 인기 역: ${list(B.인기역, '회', 5)}`);
    p(`- 걷기 · 날기 · 실내 시간: ${list(ko(B.모드별시간_분), '분')}`);
    p();
    p('### 기술 (실제 사용자 기기)'); p();
    p(`- 프레임 중앙값: PC ${v(T.프레임_PC.p50)}fps (30fps 미만 ${pc(T.프레임_PC.under30_pct)}) · 휴대폰 ${v(T.프레임_휴대폰.p50)}fps (30fps 미만 ${pc(T.프레임_휴대폰.under30_pct)})`);
    p(`- 첫 화면까지 중앙값 ${v(T.첫화면준비_ms.p50)}ms · JS 메모리 중앙값 ${v(T.JS메모리_MB.p50)}MB · 오류가 난 세션 ${pc(T.오류세션_pct)}`);
    p(`- 기기: ${list(T.기기, '')} · 브라우저: ${list(T.브라우저, '')} · 유입: ${list(R['유입'].출처, '')}`);
    p();
  }
}

// ---------- 개발 · 운영 (저장소 기록: 사람이 만든 커밋만, 매일 갱신 커밋은 뺀다) ----------
try {
  const { execFileSync } = await import('node:child_process'), root = new URL('..', import.meta.url).pathname;
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 64e6 });
  const logs = git('log', '--no-merges', '--format=%H%x09%at%x09%an%x09%s%x09%(trailers:key=Co-Authored-By,valueonly,separator=;)').trim().split('\n').map((l) => l.split('\t')).filter((c) => c[1] && !/github-actions/.test(c[2]) && !/운영 지표 매일 갱신/.test(c[3]));
  if (logs.length > 10) {
    const at = (c) => +c[1] * 1000, first = Math.min(...logs.map(at)), n = (d) => logs.filter((c) => now - at(c) < d * DAY), claude = logs.filter((c) => /claude/i.test(c[4] || ''));
    const kind = (re, L) => L.filter((c) => re.test(c[3])).length, L30 = n(30), activeDays = new Set(L30.map((c) => date(at(c)))).size;
    const games = fs.readdirSync(path.join(root, 'public')).filter((d) => /^(jelly-[a-z]+|dream-runner|seoul-walk)$/.test(d) && d !== 'jelly-city').length;
    let loc = 0, files = 0; for (const f of git('ls-files', 'public', 'server', 'tools').split('\n')) if (/\.(m?js|html|css)$/.test(f) && !/_hg\.html$/.test(f)) { try { const t = fs.readFileSync(path.join(root, f), 'utf8'); if (t.length < 2e6) { loc += t.split('\n').length; files++; } } catch { /* 지워진 파일 */ } }
    let notes = 0; try { notes = (JSON.parse(fs.readFileSync(path.join(root, 'public/shared/patchnotes.json'), 'utf8')).notes || []).length; } catch { /* 없음 */ }
    p('## 개발 · 운영'); p();
    p('main 에 올라간 커밋은 모두 GitHub Actions 로 자동 검사 · 배포된다 (커밋 수 ≈ 배포 수).'); p();
    p('| 항목 | 값 |'); p('|---|---|');
    p(`| 첫 커밋 | ${date(first)} (${Math.round((now - first) / DAY)}일 전) |`);
    p(`| 커밋 (전체 · 최근 30일 · 최근 7일) | ${fmt(logs.length)} · ${fmt(L30.length)} · ${fmt(n(7).length)} |`);
    p(`| 최근 30일 하루 평균 커밋 (커밋한 날 기준) | ${activeDays ? (L30.length / activeDays).toFixed(1) : '-'}개 · 커밋한 날 ${activeDays}일 |`);
    p(`| 최근 30일 기능 · 고침 · 성능 커밋 | ${kind(/^feat/, L30)} · ${kind(/^fix/, L30)} · ${kind(/^perf/, L30)} |`);
    p(`| Claude 와 함께 쓴 커밋 (Co-Authored-By) | ${pct(claude.length, logs.length)} (${fmt(claude.length)}개) · 최근 30일 ${pct(claude.filter((c) => now - at(c) < 30 * DAY).length, L30.length)} |`);
    p(`| 서비스 중인 게임 | ${games}개 |`);
    p(`| 코드 (public · server · tools 의 js · html · css) | ${fmt(loc)}줄 · ${fmt(files)}개 파일 |`);
    p(`| 패치노트 항목 | ${fmt(notes)}개 |`);
    p();
  }
} catch { /* git 이 없는 곳에서 돌릴 때 */ }

console.log(out.join('\n'));
