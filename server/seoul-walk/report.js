// 젤리 서울 러너 지표 집계: 이벤트 줄들을 받아 숫자 묶음으로 (정의는 docs/dream-runner/서울러너-지표.md)
const DAY = 864e5, kst = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10), rate = (a, b) => (b ? r1((a / b) * 100) : null);
const bump = (m, k, n = 1) => { if (k != null && k !== '') m.set(k, (m.get(k) || 0) + n); };
const top = (m, n = 30, f = (v) => v) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, f(v)]);
const min = (s) => r1(s / 60);

export async function buildReport(rows, opt = {}) {
  const users = new Map(), S = new Map(), C = {}; const c = (n) => (C[n] ||= new Map());
  const sess = (r) => { let s = S.get(r.s); if (!s) S.set(r.s, s = { d: r.d, t0: r.t, sec: 0, m: 0, f: new Set(), ch: 0 }); return s; };
  const fps = { phone: [], desktop: [] }, ready = [], firstMove = [], chunk = [], heap = [], dt = new Map(); let rows_n = 0;
  for await (const r of rows) {
    rows_n++; const p = r.p || {}, s = sess(r); let u = users.get(r.d); if (!u) users.set(r.d, u = { first: r.t, last: r.t, days: new Set(), sec: 0, m: 0, gu: new Map() });
    u.first = Math.min(u.first, r.t); u.last = Math.max(u.last, r.t); u.days.add(kst(r.t));
    switch (r.e) {
      case 'l_view': s.f.add('landing'); bump(c('ref'), p.ref || '직접'); bump(c('utm'), p.utm); bump(c('os'), p.os); bump(c('browser'), p.br); bump(c('form'), p.phone ? '휴대폰' : 'PC'); if (p.ret) s.f.add('returning'); break;
      case 'l_3d': s.f.add(p.ok ? '3d_ok' : '3d_fail'); bump(c('l3d'), p.mode || '?'); break;
      case 'l_ch': s.ch = Math.max(s.ch, p.i || 0); bump(c('chapter'), p.i); break;
      case 'l_sec': s.f.add(`sec_${p.n}`); break;
      case 'l_go': s.f.add('clicked'); bump(c('click'), p.via); bump(c('click_place'), p.name); break;
      case 'l_map': s.f.add('map'); break;
      case 'l_leave': bump(c('l_dwell_n')); (C.l_dwell ||= []).push(p.sec || 0); break;
      case 'g_start': s.f.add('start'); bump(c('via'), p.via); s.via = p.via; if (p.via === 'pick' || p.via === 'map') bump(c('chosen'), p.name || p.r); bump(c('entry'), p.entry); bump(c('gpu'), p.gpu); if (p.login) s.f.add('login'); bump(c(`form_g`), p.phone ? '휴대폰' : 'PC'); s.phone = !!p.phone; break;
      case 'g_ready': s.f.add('ready'); ready.push(p.ms); break;
      case 'g_move': s.f.add('moved'); firstMove.push(p.ms); break;
      case 'g_hb': if (p.fps) { (s.phone ? fps.phone : fps.desktop).push(p.fps); s.fpsMin = Math.min(s.fpsMin ?? 999, p.fps); } if (p.heap) heap.push(p.heap); for (const k of ['walk', 'fly', 'shop', 'station', 'train', 'mall', 'deck', 'idle']) if (p[k]) bump(c('mode'), k, p[k]); bump(c('season'), p.season, p.sec || 0); bump(c('weather'), p.weather, p.sec || 0); if (p.hour != null) bump(c('hour'), Math.floor(p.hour), p.sec || 0); for (const k of ['jump']) if (p[k]) bump(c('count'), k, p[k]); if (p.ms) bump(c('hb_real'), 'x'); break;
      case 'g_dw': { const sec = p.sec || 0; s.sec += sec; s.m += p.m || 0; u.sec += sec; u.m += p.m || 0; bump(c('gu_sec'), p.gu, sec); bump(c('tile_sec'), p.t, sec); bump(c('hood_sec'), p.hood, sec); if (p.gu) { bump(u.gu, p.gu, sec); (C.gu_users ||= new Map()); if (!C.gu_users.has(p.gu)) C.gu_users.set(p.gu, new Set()); C.gu_users.get(p.gu).add(r.d); } (C.tiles ||= new Set()).add(p.t); bump(dt, kst(r.t), sec); break; }
      case 'g_pl': bump(c('place_sec'), p.n, p.sec || 0); break;
      case 'g_tile': s.tiles = (s.tiles || 0) + 1; break;
      case 'g_gu': s.gus = (s.gus || 0) + 1; bump(c('gu_cross'), p.gu); break;
      case 'g_tp': s.f.add('teleport'); bump(c('tp'), p.gu); break;
      case 'g_fly': s.f.add('fly'); bump(c('count'), 'fly'); break;
      case 'g_shop': s.f.add('shop'); bump(c('count'), 'shop'); bump(c('shop_kind'), p.k); bump(c('shop_name'), p.n); if (p.k) { (C.kind_users ||= new Map()); if (!C.kind_users.has(p.k)) C.kind_users.set(p.k, new Set()); C.kind_users.get(p.k).add(r.d); } if (p.real) bump(c('count'), 'shop_real'); break;
      case 'g_order': s.f.add('order'); bump(c('count'), 'order'); bump(c('order_item'), p.item); bump(c('order_mode'), p.mode); break;
      case 'g_st': s.f.add('station'); bump(c('count'), 'station'); bump(c('station'), p.n); break;
      case 'g_ride': s.f.add('ride'); bump(c('count'), 'ride'); bump(c('line'), p.line); bump(c('ride_to'), p.to); break;
      case 'g_mall': s.f.add('mall'); bump(c('mall'), p.n); break;
      case 'g_deck': s.f.add('deck'); bump(c('count'), 'deck'); break;
      case 'g_out': bump(c('in_sec'), p.w, p.sec || 0); if (p.w === 'shop' && p.k) bump(c('kind_sec'), p.k, p.sec || 0); break;
      case 'g_set': s.f.add('settings'); bump(c('set'), `${p.k}=${p.v}`); break;
      case 'g_lb': bump(c('label'), p.n); break;
      case 'g_chunk': if (p.ms) chunk.push(p.ms); break;
      case 'g_err': s.f.add('error'); bump(c('err'), `${p.m} @ ${p.f || ''}`); break;
      case 'g_end': bump(c('end'), p.why); break;
      default:
    }
  }
  const G = [...S.values()], game = G.filter((s) => s.f.has('start')), mins = game.map((s) => s.sec / 60), has = (f, L = G) => L.filter((s) => s.f.has(f)).length, U = [...users.values()];
  const playing = U.filter((u) => u.sec > 0), userMin = playing.map((u) => u.sec / 60);
  const ret = (d) => { const elig = U.filter((u) => u.first + d * DAY <= Date.now()); const back = elig.filter((u) => u.days.has(kst(u.first + d * DAY))); return { eligible: elig.length, returned: back.length, pct: rate(back.length, elig.length) }; };
  const land = has('landing'), bucket = (lo, hi) => playing.filter((u) => u.sec / 60 >= lo && u.sec / 60 < hi).length;
  const dailyU = new Map(); for (const [d, u] of users) for (const k of u.days) { if (!dailyU.has(k)) dailyU.set(k, new Set()); dailyU.get(k).add(d); }
  const fpsOf = (a) => ({ samples: a.length, p10: pct(a, 0.1), p50: pct(a, 0.5), under30_pct: rate(a.filter((v) => v < 30).length, a.length) });
  const totalSec = U.reduce((a, u) => a + u.sec, 0), A = (k) => adopt(k);
  function adopt(k) { return { sessions: has(k, game), pct: rate(has(k, game), game.length) }; }
  const list = (k, n, f) => (C[k] ? top(C[k], n, f) : []);
  return {
    range_days: opt.days, generated_at: new Date().toISOString(), events: rows_n,
    개요: { 기기수: users.size, 세션수: S.size, 게임세션수: game.length, 총플레이시간_분: min(totalSec), 총이동거리_km: r1(U.reduce((a, u) => a + u.m, 0) / 1000), 기기당플레이시간_중앙값_분: r1(pct(userMin, 0.5)), 세션시간_중앙값_분: r1(pct(mins, 0.5)), 세션시간_p90_분: r1(pct(mins, 0.9)), 플레이한_칸수: C.tiles?.size || 0, 칸_도달률_pct: rate(C.tiles?.size || 0, 201) },
    일별: [...dailyU.keys()].sort().map((k) => ({ 날짜: k, DAU: dailyU.get(k).size, 플레이_분: min(dt.get(k) || 0) })),
    퍼널: { 랜딩: land, '3D표시': has('3d_ok'), '3장이상스크롤': G.filter((s) => s.ch >= 3).length, 시작클릭: has('clicked'), 게임시작: game.length, 첫화면준비: has('ready', game), 첫이동: has('moved', game), 플레이1분이상: game.filter((s) => s.sec >= 60).length, 플레이5분이상: game.filter((s) => s.sec >= 300).length, 랜딩대비시작클릭_pct: rate(has('clicked'), land), 시작대비첫이동_pct: rate(has('moved', game), game.length) },
    리텐션: { D1: ret(1), D7: ret(7), D30: ret(30), 재방문기기: U.filter((u) => u.days.size > 1).length, 재방문율_pct: rate(U.filter((u) => u.days.size > 1).length, U.length) },
    유저별플레이시간: { 분포_기기수: { '1분미만': bucket(0, 1), '1~5분': bucket(1, 5), '5~15분': bucket(5, 15), '15~30분': bucket(15, 30), '30분이상': bucket(30, 1e9) }, 상위20: [...users.entries()].filter(([, u]) => u.sec > 0).sort((a, b) => b[1].sec - a[1].sec).slice(0, 20).map(([d, u]) => ({ 기기: d.slice(0, 6), 분: min(u.sec), km: r1(u.m / 1000), 방문일수: u.days.size, 가장오래머문구: top(u.gu, 1)[0]?.[0] || null })) },
    지역: { 구별머문시간_분: list('gu_sec', 30, min), 구별방문기기: C.gu_users ? [...C.gu_users.entries()].map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1]) : [], 동네별머문시간_분: list('hood_sec', 30, min), 칸별머문시간_분_상위30: list('tile_sec', 30, min), 장소별머문시간_분_상위30: list('place_sec', 30, min), 직접고른시작_상위: list('chosen', 30), 시작방식: list('via', 10), 세션당구수_평균: game.length ? r1(game.reduce((a, s) => a + (s.gus || 0), 0) / game.length) : null, 세션당칸수_평균: game.length ? r1(game.reduce((a, s) => a + (s.tiles || 0), 0) / game.length) : null, 지도순간이동_도착구: list('tp', 25) },
    행동: { 기능사용_세션: { 날기: A('fly'), 가게입장: A('shop'), 주문: A('order'), 지하철입장: A('station'), 열차탑승: A('ride'), 몰입장: A('mall'), 타워전망대: A('deck'), 설정변경: A('settings'), 순간이동: A('teleport') }, 횟수: list('count', 20), 모드별시간_분: list('mode', 10, min), 안에머문시간_분: list('in_sec', 10, min), 가게종류_방문수: list('shop_kind', 30), 가게종류_방문기기: C.kind_users ? [...C.kind_users.entries()].map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1]) : [], 가게종류_머문시간_분: list('kind_sec', 30, min), 인기가게: list('shop_name', 30), 인기메뉴: list('order_item', 30), 주문방식: list('order_mode', 5), 인기역: list('station', 30), 열차호선: list('line', 20), 열차도착역: list('ride_to', 30), 몰: list('mall', 10), 많이본건물: list('label', 30), 설정: list('set', 40), 시간대_분: list('hour', 24, min), 계절_분: list('season', 4, min), 날씨_분: list('weather', 5, min) },
    랜딩: { 머문시간_중앙값_초: pct(C.l_dwell || [], 0.5), 장면도달: list('chapter', 6), 시작클릭종류: list('click', 10), 클릭한장소: list('click_place', 30), 지도열기: has('map'), '3D성공_pct': rate(has('3d_ok'), has('3d_ok') + has('3d_fail')), '3D방식': list('l3d', 5) },
    유입: { 출처: list('ref', 30), 캠페인: list('utm', 30), 게임진입경로: list('entry', 5), 로그인세션: has('login', game), 로그인비율_pct: rate(has('login', game), game.length), 재방문세션: has('returning') },
    기술: { 기기: list('form', 2), OS: list('os', 8), 브라우저: list('browser', 8), GPU: list('gpu', 8), 프레임_PC: fpsOf(fps.desktop), 프레임_휴대폰: fpsOf(fps.phone), 첫화면준비_ms: { p50: pct(ready, 0.5), p90: pct(ready, 0.9) }, 첫이동까지_ms: { p50: pct(firstMove, 0.5), p90: pct(firstMove, 0.9) }, 칸만들기_ms: { p50: pct(chunk, 0.5), p90: pct(chunk, 0.9) }, JS메모리_MB: { p50: pct(heap, 0.5), p90: pct(heap, 0.9) }, 오류세션_pct: rate(has('error', game), game.length), 오류: list('err', 20), 종료방식: list('end', 5) },
  };
}
