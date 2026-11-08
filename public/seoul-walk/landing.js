// 젤리 서울 러너 랜딩: 첫 화면부터 실시간 3D 장면(스크롤로 카메라가 서울 곳곳을 지나간다) · 오른쪽 위 출발(모든 동네 · 지금 걷기 · 이어 걷기 · 지도) · 만든 이야기
import { account, store } from '/shared/js/account.js';
import { SeoulMap } from '/dream-runner/js/seoul-map.js';
import { ev, trackLanding } from '/seoul-walk/metrics.js';

const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAY = '/seoul-walk/play/', cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), ease = (x) => x * x * (3 - 2 * x);

// ---------- 장 (landing3d.js 의 장면과 같은 순서) ----------
const CH = [
  ['c1', '여의도 한강', '', '여름 저녁', '63빌딩', '해가 유리벽에 마지막 빛을 걸어 두는 시간. 강바람을 따라 천천히 달려요.'],
  ['c2', '잠실', '', '봄 한낮', '석촌 호수', '호숫가가 온통 분홍빛이에요. 꽃잎 사이로 롯데월드타워가 하늘에 닿아요.'],
  ['c5', '홍대', '', '해 질 무렵', '노을 골목', '간판에 하나둘 불이 켜지고, 골목 끝 어딘가에서 노래가 흘러나와요.'],
  ['c7', '인사동', '', '눈 오는 저녁', '종로', '처마 끝에 눈이 소복이 쌓여요. 등불 아래로 발자국이 길게 이어져요.'],
  ['c3', '남산', '', '가을밤', '남산 타워', '산길을 올라 타워 아래 서면, 서울이 별처럼 발아래에서 반짝여요.'],
  ['c6', '한강', '', '여름밤', '여의도와 한강', '강물 위로 불빛이 흔들려요. 다리 위로 열차가 지나가는 그 순간까지.'],
];
const film = $('film'), N = CH.length; film.style.setProperty('--n', N);
const frames = CH.map(([f]) => { const d = document.createElement('div'); d.className = 'f'; d.dataset.src = `/seoul-walk/img/${f}.webp`; $('frames').appendChild(d); return d; });
const chaps = CH.map(([, place, co, when, title, txt], i) => { const d = document.createElement('div'); d.className = 'chap'; d.innerHTML = `<p class="lab"><b>${String(i + 1).padStart(2, '0')}</b><span>${place} · ${when}</span></p><h3>${title}</h3><p>${txt}</p>`; $('chaps').appendChild(d); return d; });
let use3d = false, W3D = null; // 3D 가 돌면 그림은 쓰지 않는다 (불러오기 전 · 휴대폰 · 약한 기기만 그림)
const loadImg = (k) => { const d = frames[k]; if (d && !d.style.backgroundImage) d.style.backgroundImage = `url(${d.dataset.src})`; };
let ticking = false, lastP = -1;
function filmTick() {
  ticking = false; const r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight, p = cl(-r.top / span), P = p * (N + 0.6); window.SW_FILM = { P: Math.min(P, N - 0.001), N }; W3D?.film(Math.min(P, N - 0.001), scrolled);
  if (Math.abs(P - lastP) < 1e-4) return; lastP = P;
  // 첫 화면 겹침(제목 · 출발)은 스크롤을 시작하면 걷힌다
  const io = 1 - ease(cl((P - 0.12) / 0.26)); $('intro').style.opacity = io.toFixed(3); $('intro').style.transform = `translate3d(0, ${(-(1 - io) * 40).toFixed(1)}px, 0)`; $('intro').style.pointerEvents = io > 0.5 ? 'auto' : 'none'; $('cue').style.opacity = (io * 0.9).toFixed(2);
  for (let i = 0; i < N; i++) {
    const t = P - i;
    if (!use3d || !window.SW_HAS?.(i)) { if (t > -0.6 && t < 1.6) { loadImg(i); loadImg(i + 1); } const fin = i === 0 ? 1 : ease(cl((t + 0.3) / 0.3)), fout = i === N - 1 ? 1 - ease(cl((t - 1) / 0.6)) : 1 - ease(cl((t - 0.85) / 0.3)), o = Math.min(fin, fout), F = frames[i]; F.style.opacity = o.toFixed(3); if (o > 0) { const k = cl((t + 0.3) / 1.6); F.style.transform = `scale(${(1.04 + k * 0.16).toFixed(4)}) translate3d(${(-k * 1.6).toFixed(3)}%, ${(-k * 1.1).toFixed(3)}%, 0)`; } } else frames[i].style.opacity = '0';
    const a = i === 0 ? 0.42 : 0.08, ti = ease(cl((t - a) / 0.2)), to = 1 - ease(cl((t - 0.66) / 0.18)), co = Math.min(ti, to), C = chaps[i]; C.style.opacity = co.toFixed(3); C.style.transform = `translate3d(0, ${((1 - ti) * 40 - (1 - to) * 26).toFixed(1)}px, 0)`;
  }
  // 워커 3D: 캔버스 비침은 여기서 (장면 끝 · 처음은 어둡게 녹아 넘어간다, 지도가 아직이면 그림)
  if (W3D) { const ci = cl(Math.floor(P), 0, N - 1), ct = cl(P - ci), fade = Math.min(ease(cl(ct / 0.12)), ease(cl((1 - ct) / 0.12))); $('gl').style.opacity = W3D.has(ci) ? (ci === 0 ? (ct < 0.5 ? 1 : fade) : fade).toFixed(3) : '0'; }
  const k = cl(Math.floor(P), 0, N - 1); $('prog-fill').style.width = `${(cl(P / N) * 100).toFixed(2)}%`; $('prog-t').textContent = `${String(k + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  const e = ease(cl((P - N + 0.1) / 0.4)); $('end').style.opacity = e.toFixed(3); $('end').classList.toggle('on', e > 0.5); document.body.classList.toggle('light', r.bottom < 80 || e > 0.5); // 파스텔 마지막 장 · 아래에선 위 막대 글자를 짙게
}
let scrolled = false; addEventListener('scroll', () => { scrolled = true; if (!ticking) { ticking = true; requestAnimationFrame(filmTick); } }, { passive: true });
addEventListener('resize', () => { lastP = -1; filmTick(); });
{ const f = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }), tick = () => { $('clock').textContent = `지금 서울은 ${f.format(new Date())}`; }; tick(); setInterval(tick, 15000); }

// ---------- 불러오기: 컴퓨터는 첫 3D 장면이 그려지면, 아니면 첫 그림이 오면 걷는다 ----------
const loader = { set: (k, s) => { $('ld-bar').style.width = `${Math.round(k * 100)}%`; if (s) $('ld-s').textContent = s; }, done: () => $('loader').classList.add('done') };
function fallbackImages() { use3d = false; lastP = -1; loadImg(0); loadImg(1); const im = new Image(); im.onload = im.onerror = () => loader.done(); im.src = frames[0].dataset.src; filmTick(); }
const want3d = (matchMedia('(min-width: 900px) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) || new URLSearchParams(location.search).has('3d');
if (want3d) {
  use3d = true; loader.set(0.08, '서울을 불러오는 중');
  const giveUp = setTimeout(() => { if (!$('loader').classList.contains('done')) fallbackImages(); }, 25000);
  const onReady = () => { ev('l_3d', { ok: 1, ms: Math.round(performance.now()), mode: W3D ? 'worker' : 'inline' }); clearTimeout(giveUp); loader.set(1); setTimeout(loader.done, 250); }, onFail = () => { ev('l_3d', { ok: 0, ms: Math.round(performance.now()), mode: 'fail' }); clearTimeout(giveUp); fallbackImages(); };
  const cv = $('gl'), qt = new URLSearchParams(location.search).get('tier');
  if (cv.transferControlToOffscreen && typeof Worker === 'function' && !new URLSearchParams(location.search).has('inline')) {
    // 3D 는 웹 워커에서 (메인 스레드는 스크롤 · 글자만 → 약한 컴퓨터에서도 스크롤이 부드럽다)
    const off = cv.transferControlToOffscreen(), wk = new Worker('/seoul-walk/landing3d-worker.js', { type: 'module' }); let hasSet = new Set();
    W3D = { film: (P, act) => wk.postMessage({ type: 'film', P, active: act }), has: (i) => hasSet.has(i) }; window.SW_HAS = W3D.has;
    wk.onmessage = (e) => { const m = e.data; if (m.type === 'progress') loader.set(0.08 + m.k * 0.9, m.s); else if (m.type === 'ready') onReady(); else if (m.type === 'fail') onFail(); else if (m.type === 'has') { hasSet = new Set(m.list); lastP = -1; filmTick(); } else if (m.type === 'log') console.error('[3D 워커]', m.msg); };
    wk.onerror = (e) => { console.warn('워커 3D 오류', e.message); onFail(); };
    wk.postMessage({ type: 'init', canvas: off, w: innerWidth, h: innerHeight, dpr: devicePixelRatio || 1, tier: qt != null ? +qt : null }, [off]);
    addEventListener('resize', () => wk.postMessage({ type: 'resize', w: innerWidth, h: innerHeight }));
    new IntersectionObserver((es) => wk.postMessage({ type: 'vis', v: es[0].isIntersecting })).observe(film);
    W3D.film(0, false);
  } else import('/seoul-walk/landing3d.js').then((m) => { const r = m.start3d(cv, { onProgress: (k, s) => loader.set(0.08 + k * 0.9, s), onReady, onFail }); if (!r) onFail(); }).catch(onFail);
} else fallbackImages();
filmTick();

// ---------- 저장된 자리 (게임과 같은 저장소) ----------
const POS_KEY = 'dreamrunner.hangang.pos', VISIT_KEY = 'dreamrunner.hangang.visit';
const posAll = () => { try { const v = JSON.parse(store.get(POS_KEY) || 'null'); if (!v) return { last: null, regions: {} }; if (v.regions) return v; return { last: v.region || 'yeouido', regions: { [v.region || 'yeouido']: { s: v.s, lat: v.lat, where: v.where } } }; } catch { return { last: null, regions: {} }; } };
const visits = () => { try { return new Set(JSON.parse(store.get(VISIT_KEY) || '[]')); } catch { return new Set(); } };

// ---------- 출발: 모든 동네 ----------
// 새로 채운 구: 대표 역 앞 길 위에서 시작 [이름, 구, 그림, x, z, 방향]
const GU_SPOTS = [['마곡나루', '강서구', '🌿', -13433, -4018, 3.04], ['목동', '양천구', '🏙️', -10216, 414, 0.36], ['구로디지털', '구로구', '💻', -6816, 5012, -0.59], ['가산디지털', '금천구', '🏭', -8571, 5328, -2.8], ['노량진', '동작구', '🐟', -3354, 1815, 1.64], ['서울대입구', '관악구', '⛰️', -2407, 5390, -0.29], ['연신내', '은평구', '🛍️', -5201, -9815, 1.86], ['수유', '강북구', '🏔️', 4053, -11957, 2.45], ['창동', '도봉구', '🚉', 5843, -13541, -2.82], ['노원', '노원구', '🌳', 7105, -13767, 0.23], ['성신여대', '성북구', '🎒', 3229, -6938, -1.08], ['청량리', '동대문구', '🧺', 5726, -5535, 2.1], ['상봉', '중랑구', '🌸', 9303, -7338, -1.39], ['건대입구', '광진구', '🍢', 7990, -1081, -0.37], ['천호', '강동구', '🌉', 12659, -923, 2.83]];
const HOODS = [['yeouido', '여의도 한강', '🌉'], ['banpo', '반포 한강', '🌈'], ['ttukseom', '뚝섬 한강', '🎶'], ['namsan', '남산타워', '🗼'], ['hongdae', '홍대', '🎸'], ['sinchon', '신촌', '🎓'], ['itaewon', '이태원', '🌍'], ['myeongdong', '명동', '🛍️'], ['insadong', '인사동 · 종로', '🏮'], ['bukchon', '북촌 한옥마을', '🏯'], ['seongsu', '성수', '☕'], ['gangnam', '강남역', '🏙️'], ['jamsil', '석촌호수', '🌸']];
// "지금 걷기": 한 동네로 고정하지 않고 28곳 중 무작위 (via=random 으로 직접 고른 시작과 구분해 기록)
function randomStart() { const k = Math.floor(Math.random() * (HOODS.length + GU_SPOTS.length)); if (k < HOODS.length) return `${PLAY}?r=${HOODS[k][0]}&go=start&via=random`; const [n, , , x, z, f] = GU_SPOTS[k - HOODS.length]; return `${PLAY}?x=${x}&z=${z}&f=${f}&via=random&n=${encodeURIComponent(n)}`; }
function renderStart() {
  const A = posAll();
  $('hoods').innerHTML = HOODS.map(([id, name, ic]) => `<li><a href="${PLAY}?r=${id}&go=${A.regions[id] ? 'resume' : 'start'}&via=pick"><i>${ic}</i><span>${name}</span>${A.regions[id] ? '<em>이어서</em>' : ''}</a></li>`).join('') + GU_SPOTS.map(([n, gu, ic, x, z, f]) => `<li><a href="${PLAY}?x=${x}&z=${z}&f=${f}&via=pick&n=${encodeURIComponent(n)}" title="${gu}"><i>${ic}</i><span>${n}</span></a></li>`).join('');
  const last = A.last && A.regions[A.last] ? A.regions[A.last] : null; $('resume').classList.toggle('hidden', !last);
  if (last) { $('resume').href = `${PLAY}?go=last`; $('resume-sub').textContent = last.where || ''; }
  for (const id of ['go-now', 'go-end', 'go-last', 'bar-go']) $(id).href = last ? `${PLAY}?go=last` : randomStart();
  const n = visits().size; $('tile-n').textContent = n ? `· 가 본 서울 ${n}/201칸` : '';
}

// ---------- 서울 지도 (화면 가득) ----------
let map = null, pick = null, mapRAF = 0;
async function openMap(e) {
  e?.preventDefault(); $('mapbox').classList.remove('hidden');
  if (!map) { const d = await (await fetch('/dream-runner/hangang/seoul.json')).json(); map = new SeoulMap(d, Object.fromEntries(HOODS.map(([id, n]) => [id, n]))); map.allOpen = true; }
  const cv = $('seoul'), ctx = cv.getContext('2d'), here = () => { const A = posAll(), p = A.last && A.regions[A.last]; return p && p.x != null ? { x: p.x, z: p.z } : null; };
  const draw = (t) => { if ($('mapbox').classList.contains('hidden')) return; map.draw(ctx, cv.width, cv.height, { here: here(), pick: pick ? { ...pick, region: pick.region || 'x' } : null, t: t / 1000 }); mapRAF = requestAnimationFrame(draw); };
  cancelAnimationFrame(mapRAF); mapRAF = requestAnimationFrame(draw);
}
document.querySelectorAll('[data-open-map]').forEach((a) => a.addEventListener('click', openMap));
$('map-x').onclick = (e) => { e.preventDefault(); $('mapbox').classList.add('hidden'); };
addEventListener('keydown', (e) => { if (e.key === 'Escape') $('mapbox').classList.add('hidden'); });
$('seoul').addEventListener('pointerdown', (e) => {
  if (!map) return; const cv = $('seoul'), r = cv.getBoundingClientRect(), p = map.pickAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); pick = p;
  const ok = !!p.gu || !!p.region; $('pick-n').textContent = p.region ? p.name : p.gu || '서울 바깥'; $('pick-s').textContent = p.region ? `${p.gu} · 이 동네 길 위에서 시작해요` : p.gu ? `${p.gu} · 이 자리에서 시작해요` : '서울 안을 눌러 주세요';
  $('go-pick').classList.toggle('disabled', !ok); $('go-pick').href = ok ? `${PLAY}?${p.region ? `r=${p.region}&` : ''}x=${Math.round(p.x)}&z=${Math.round(p.z)}&via=map&n=${encodeURIComponent(p.region ? p.name : p.gu)}` : '#';
});

// ---------- 계정 (선택) ----------
function cloudMerge(r) {
  if (!r) return; const a = posAll(); let ch = false;
  for (const [id, p] of Object.entries(r.pos?.regions || {})) if (!a.regions[id] || (a.regions[id].at || 0) < (p.at || 0)) { a.regions[id] = p; ch = true; }
  if (r.pos?.last && (r.pos.at || 0) > (a.at || 0)) { a.last = r.pos.last; a.at = r.pos.at; ch = true; } if (ch) store.set(POS_KEY, JSON.stringify(a));
  const V = visits(), n = V.size; for (const k of r.visit || []) V.add(k); if (V.size !== n) store.set(VISIT_KEY, JSON.stringify([...V]));
}
async function setupAcct() {
  let st = {}; try { st = await account.status(); } catch { /* 서버 연결 안 됨: 로그인 없이 */ }
  if (await account.restore().catch(() => false)) { try { cloudMerge(await account.api('/api/dream/hangang/me')); } catch { /* 다음에 */ } renderStart(); }
  if (account.user) { $('acct-t').textContent = `${account.user.nick || account.user.name || ''} 님 · 걸은 자리가 계정에 저장돼요`; return; }
  if (st.googleClientId) account.googleButton($('g-btn'), st.googleClientId, async () => { try { cloudMerge(await account.api('/api/dream/hangang/me')); await account.api('/api/dream/hangang/save', { method: 'POST', body: { pos: posAll(), visit: [...visits()] } }); } catch { /* 다음에 */ } $('acct-t').textContent = '로그인했어요 · 걸은 자리가 계정에 저장돼요'; $('g-btn').innerHTML = ''; renderStart(); }, () => {}).catch(() => {});
}
renderStart(); setupAcct(); trackLanding();
