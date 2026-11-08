// 젤리 서울 러너 이용 지표 (익명): 기기 무작위 아이디 · 세션 · 이벤트만 서버로. 구글 계정 · 정확한 좌표(2km 칸까지만)는 보내지 않는다
//   보내지 않는 경우: Do Not Track · 자동화 브라우저, 주소에 ?nometrics=1 을 한 번 붙인 기기 (만든 사람 플레이 빼기)
import { account } from '/shared/js/account.js';
const API = '/api/sw/m', ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 안 됨 */ } } };
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
const local = /^(localhost|127\.)/.test(location.hostname);
const off = (() => { const q = new URLSearchParams(location.search); if (q.get('nometrics') === '1') ls.set('sw.nometrics', '1'); if (q.get('nometrics') === '0') ls.set('sw.nometrics', ''); return ls.get('sw.nometrics') === '1' || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true || (navigator.webdriver && !local); })();
const ret = !!ls.get('sw.aid'); let device = ls.get('sw.aid'); if (!device) { device = rid(); ls.set('sw.aid', device); }
// 세션: 30분 쉬면 새로 (랜딩 → 게임은 같은 세션)
const session = (() => { let v = null; try { v = JSON.parse(ls.get('sw.ses') || 'null'); } catch { /* 처음 */ } const now = Date.now(), id = v && now - v.at < 18e5 ? v.id : rid(); ls.set('sw.ses', JSON.stringify({ id, at: now })); return id; })();
let Q = [];
export function ev(name, p = {}) { if (off) return; Q.push([name, Date.now(), p]); if (Q.length >= 60) flush(); }
export function flush(beacon = false) {
  if (off || !Q.length) return; const t = Date.now(), body = JSON.stringify({ d: device, s: session, ev: Q.slice(0, 80).map(([n, at, p]) => [n, t - at, p]) }); Q = Q.slice(80); ls.set('sw.ses', JSON.stringify({ id: session, at: t }));
  try { if (beacon && navigator.sendBeacon?.(API, new Blob([body], { type: 'application/json' }))) return; fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 }).catch(() => {}); } catch { /* 보내기 실패는 무시 */ }
}
if (!off) { setInterval(() => flush(), 15000); addEventListener('pagehide', () => flush(true)); document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); }); }
export function ctx() {
  const u = navigator.userAgent, os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : '기타', br = /SamsungBrowser/.test(u) ? 'Samsung' : /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : '기타';
  return { os, br, phone: matchMedia('(pointer: coarse)').matches, cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0, sw: Math.round(innerWidth / 100) * 100, dpr: Math.round((devicePixelRatio || 1) * 10) / 10, lang: (navigator.language || '').slice(0, 2), ret };
}

// ---------- 랜딩 ----------
export function trackLanding() {
  if (off) return; const q = new URLSearchParams(location.search); let ref = ''; try { const r = new URL(document.referrer); if (r.origin !== location.origin) ref = r.hostname.replace(/^www\./, ''); } catch { /* 직접 */ }
  ev('l_view', { ...ctx(), ref, utm: [q.get('utm_source'), q.get('utm_medium'), q.get('utm_campaign')].filter(Boolean).join('/') });
  const t0 = Date.now(), seen = new Set(); let depth = 0;
  setInterval(() => { const film = document.getElementById('film'); if (!film) return; const H = film.offsetHeight - innerHeight, p = H > 0 ? scrollY / H : 0, i = Math.min(6, Math.floor(Math.max(0, p) * 6) + 1); if (p <= 1 && !seen.has(i)) { seen.add(i); ev('l_ch', { i }); } depth = Math.max(depth, Math.round((scrollY + innerHeight) / document.documentElement.scrollHeight * 100)); }, 1000);
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { ev('l_sec', { n: e.target.dataset.m }); io.unobserve(e.target); } }, { threshold: 0.3 });
  for (const [sel, n] of [['#story', 'story'], ['.facts', 'facts'], ['.last', 'last']]) { const el = document.querySelector(sel); if (el) { el.dataset.m = n; io.observe(el); } }
  document.addEventListener('click', (e) => { const a = e.target.closest?.('a'); if (!a) return; if (a.hasAttribute('data-open-map')) return ev('l_map', {}); if (!a.href.includes('/seoul-walk/play')) return; const u = new URL(a.href), via = u.searchParams.get('via') || (u.searchParams.get('go') === 'last' ? 'last' : 'direct'); ev('l_go', { via, name: u.searchParams.get('n') || u.searchParams.get('r') || '' }); flush(true); }, true);
  addEventListener('pagehide', () => { ev('l_leave', { sec: Math.round((Date.now() - t0) / 1000), depth }); flush(true); });
}

// ---------- 게임: 0.25초마다 상태를 보고 바뀐 것을 기록 (엔진을 고치지 않는다) ----------
export function trackGame(getHg, game, entry) {
  if (off) return;
  const q = new URLSearchParams(location.search), via = q.get('via') || (q.get('go') === 'last' ? 'last' : q.get('go') === 'resume' ? 'resume' : 'direct'), T0 = performance.now();
  let on = false, S = null, frames = 0, slow = 0, maxMs = 0, lastF = 0;
  const raf = (t) => { if (lastF && !document.hidden) { const d = t - lastF; frames++; if (d > 50) slow++; if (d > maxMs && d < 5000) maxMs = d; } lastF = t; requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  let errs = 0; const err = (m, f) => { if (errs++ < 10 && on) ev('g_err', { m: String(m).slice(0, 60), f: String(f || '').split('/').pop().slice(0, 40) }); };
  addEventListener('error', (e) => err(e.message, e.filename ? `${e.filename}:${e.lineno}` : '')); addEventListener('unhandledrejection', (e) => err(e.reason?.message || e.reason, e.reason?.stack?.split('\n')[1]?.trim()));
  const gpu = () => { try { const g = game.renderer.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'), s = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : ''; return /Apple/i.test(s) ? 'Apple' : /NVIDIA|GeForce/i.test(s) ? 'NVIDIA' : /AMD|Radeon/i.test(s) ? 'AMD' : /Intel/i.test(s) ? 'Intel' : /Adreno/i.test(s) ? 'Adreno' : /Mali/i.test(s) ? 'Mali' : /SwiftShader|llvmpipe/i.test(s) ? '소프트웨어' : '기타'; } catch { return ''; } };
  const fresh = () => ({ t0: Date.now(), tick: 0, last: performance.now(), lastMove: Date.now(), px: null, pz: null, dw: new Map(), pl: new Map(), mode: {}, sec: 0, jump: 0, m: 0, tiles: new Set(), gus: new Set(), labs: new Set(), chunks: new Set(), hb: 15, room: null, gu: '', tile: '', hood: '', ready: false, moved: false, fly: false, vy: 0, opt: null, tot: 0, totM: 0 });
  const roomOf = (h) => (h.ride ? ['train', {}] : h.inShop ? ['shop', { k: h.inShop.F.kind }] : h.inMall ? ['mall', {}] : h.inside ? ['station', {}] : h.inDeck ? ['deck', {}] : null);
  const dump = () => { for (const [k, v] of S.dw) { const [t, gu, hood] = k.split('|'); ev('g_dw', { t, gu, hood, sec: Math.round(v.s * 10) / 10, m: Math.round(v.m) }); } S.dw.clear(); for (const [n, s] of S.pl) ev('g_pl', { n, sec: Math.round(s * 10) / 10 }); S.pl.clear(); };
  const beat = (h) => { const secs = S.vis || 0; S.vis = 0; ev('g_hb', { sec: Math.round(S.sec), ...Object.fromEntries(Object.entries(S.mode).map(([k, v]) => [k, Math.round(v)])), jump: S.jump, fps: frames && secs >= 3 ? Math.round(frames / secs) : 0, slow, max: Math.round(maxMs), ch: h.chunks?.size || 0, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : 0, season: h.state?.season, weather: h.state?.weather, hour: Math.round((h.state?.hour || 0) * 10) / 10 }); S.sec = 0; S.mode = {}; S.jump = 0; frames = 0; slow = 0; maxMs = 0; dump(); };
  const end = (why, h) => { if (!on) return; on = false; if (h) beat(h); if (S.room) ev('g_out', { w: S.room[0], k: S.room[1].k, sec: Math.round((Date.now() - S.roomT) / 1000) }); ev('g_end', { why, sec: Math.round(S.tot), km: Math.round(S.totM / 100) / 10, tiles: S.tiles.size, gus: S.gus.size }); flush(true); };
  setInterval(() => {
    const h = getHg(); if (game.mode !== 'hangang' || !h?.ready || !h.chunks) { if (on) end('exit', h); return; }
    if (!on) { on = true; S = fresh(); frames = slow = maxMs = 0; ev('g_start', { ...ctx(), via, r: q.get('r') || '', name: q.get('n') || q.get('r') || '', entry, gpu: gpu(), login: !!account.user }); }
    const now = performance.now(), dt = Math.min(1, (now - S.last) / 1000); S.last = now; S.tick++; const vis = !document.hidden, room = roomOf(h), key = `${Math.floor(h.px / 2000)}_${Math.floor(h.pz / 2000)}`;
    if (!S.ready && h.chunks.has(key)) { S.ready = true; ev('g_ready', { ms: Math.round(now - T0) }); }
    for (const [k, c] of h.chunks) if (!S.chunks.has(k)) { S.chunks.add(k); if (S.chunks.size <= 80 && c.buildMs) ev('g_chunk', { ms: c.buildMs[0] + c.buildMs[1] }); }
    // 안에 들어감 · 나옴
    const rk = room ? room[0] : null; if (rk !== (S.room?.[0] || null)) { if (S.room) ev('g_out', { w: S.room[0], k: S.room[1].k, sec: Math.round((Date.now() - S.roomT) / 1000) }); S.room = room; S.roomT = Date.now();
      if (rk === 'shop') ev('g_shop', { n: h.inShop.F.name, k: h.inShop.F.kind, real: !!h.inShop.F.real, gu: S.gu }); else if (rk === 'station') ev('g_st', { n: h.inside.st?.name }); else if (rk === 'mall') ev('g_mall', { n: h.inMall.D?.name }); else if (rk === 'deck') ev('g_deck', {}); else if (rk === 'train') ev('g_ride', { line: String(h.ride.line), to: h.ride.dest?.name }); S.px = null; }
    { const od = h.inShop?.ordered || null; if (od && od !== S.ord) ev('g_order', { item: od.item?.[0], mode: od.mode, k: h.inShop.F.kind }); S.ord = od; }
    let moving = false;
    if (!room) { if (S.px != null) { const d = Math.hypot(h.px - S.px, h.pz - S.pz); if (d > 150) ev('g_tp', { gu: h.guAt?.(h.px, h.pz) || '' }); else if (d > 0.02) { moving = true; S.m += d; S.mNow = d; S.totM += d; } } S.px = h.px; S.pz = h.pz; }
    else { if (S.rx != null && Math.hypot(h.px - S.rx, h.pz - S.rz) > 0.02) moving = true; S.rx = h.px; S.rz = h.pz; }
    if (moving) S.lastMove = Date.now(); if (moving && !S.moved) { S.moved = true; ev('g_move', { ms: Math.round(now - T0) }); }
    if (h.flying !== S.fly) { S.fly = h.flying; if (h.flying) ev('g_fly', {}); } if ((h.vy || 0) > 4 && S.vy <= 4 && !h.flying) S.jump++; S.vy = h.vy || 0;
    // 머문 시간: 화면이 보이고 1분 안에 움직였을 때만 (자리를 비운 시간은 빼고)
    if (vis) { S.vis = (S.vis || 0) + dt; const act = Date.now() - S.lastMove < 60000, m = !act ? 'idle' : room ? rk : h.flying ? 'fly' : 'walk'; S.mode[m] = (S.mode[m] || 0) + dt;
      if (act) { S.sec += dt; S.tot += dt; if (!room) { if (key !== S.tile) { S.tile = key; if (!S.tiles.has(key)) { S.tiles.add(key); ev('g_tile', { t: key }); } S.tick = 0; } if (S.tick % 16 === 0) { const g = h.guAt?.(h.px, h.pz) || ''; if (g && g !== S.gu) { S.gu = g; S.gus.add(g); ev('g_gu', { gu: g }); } const n = h.nearRegion?.(h.px, h.pz); S.hood = n && n.d < 1400 ? n.id : ''; }
        const dk = `${key}|${S.gu}|${S.hood}`, D = S.dw.get(dk) || { s: 0, m: 0 }; D.s += dt; D.m += S.mNow || 0; S.mNow = 0; S.dw.set(dk, D); if (h.regionName) S.pl.set(h.regionName, (S.pl.get(h.regionName) || 0) + dt); } } }
    for (const l of h.activeLabels || []) if (!S.labs.has(l.name) && S.labs.size < 150) { S.labs.add(l.name); ev('g_lb', { n: l.name }); }
    const o = h.opt || {}, cur = { season: o.season, weather: o.weather, time: o.time, flow: o.flow, cam: o.cam || 0 }; if (S.opt) for (const k of Object.keys(cur)) if (cur[k] !== S.opt[k]) ev('g_set', { k, v: String(cur[k]) }); S.opt = cur;
    S.hb -= dt0(now); if (S.hb <= 0) { S.hb = 30; beat(h); }
  }, 250);
  let wall = performance.now(); function dt0(t) { const d = (t - wall) / 1000; wall = t; return d; }
  addEventListener('pagehide', () => end('close', getHg()));
}
