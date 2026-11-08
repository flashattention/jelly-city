// 젤리 서울 산책 랜딩: 첫 화면부터 실시간 3D 장면(스크롤로 카메라가 서울 곳곳을 지나간다) · 오른쪽 위 출발(모든 동네 · 지금 걷기 · 이어 걷기 · 지도) · 만든 이야기
import { account, store } from '/shared/js/account.js';
import { SeoulMap } from '/dream-runner/js/seoul-map.js';

const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAY = '/seoul-walk/play/', cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), ease = (x) => x * x * (3 - 2 * x);

// ---------- 장 (landing3d.js 의 장면과 같은 순서) ----------
const CH = [
  ['c1', '여의도 한강', '북위 37.5198° · 동경 126.9405°', '오후 6:09 · 여름', '해 질 녘 러닝', '63빌딩을 등지고 달리는 저녁. 한강 러닝 코스 위로 곰들이 하나둘 지나가요.'],
  ['c2', '석촌호수 · 잠실', '북위 37.5126° · 동경 127.1025°', '오후 1:36 · 봄', '봄날의 타워', '벚꽃이 호수를 두르는 봄날 낮, 555m 롯데월드타워가 맑은 하늘을 찔러요.'],
  ['c5', '홍대', '북위 37.5563° · 동경 126.9236°', '오후 6:33 · 노을', '노을 골목', '해가 기우는 골목. 간판에 하나둘 불이 들어오고, 거리에 사람들이 모여들어요.'],
  ['c7', '종로 · 인사동', '북위 37.5740° · 동경 126.9850°', '오후 5:18 · 눈', '눈 오는 종로', '오래된 골목에 눈이 내려요. 처마 끝 등불 아래로 발자국이 이어져요.'],
  ['c3', '남산', '북위 37.5512° · 동경 126.9882°', '오후 8:36 · 가을', '밤의 타워', '진짜 산 위, 해발 262m. 밤이면 N서울타워에 불이 켜지고 서울이 발아래에서 반짝여요.'],
  ['c6', '한강', '북위 37.5265° · 동경 126.9340°', '오후 8:48 · 여름', '강 위의 불빛', '강물 위로 도시의 불빛이 흔들려요. 실제 열차가 다리를 건너는 그 순간, 여기서도.'],
];
const film = $('film'), N = CH.length; film.style.setProperty('--n', N);
const frames = CH.map(([f]) => { const d = document.createElement('div'); d.className = 'f'; d.dataset.src = `/seoul-walk/img/${f}.webp`; $('frames').appendChild(d); return d; });
const chaps = CH.map(([, place, co, when, title, txt], i) => { const d = document.createElement('div'); d.className = 'chap'; d.innerHTML = `<p class="lab"><b>${String(i + 1).padStart(2, '0')}</b><span>${place}</span><span>${when}</span></p><h3>${title}</h3><p>${txt}</p><p class="co">${co}</p>`; $('chaps').appendChild(d); return d; });
let use3d = false; // 3D 가 돌면 그림은 쓰지 않는다 (불러오기 전 · 휴대폰 · 약한 기기만 그림)
const loadImg = (k) => { const d = frames[k]; if (d && !d.style.backgroundImage) d.style.backgroundImage = `url(${d.dataset.src})`; };
let ticking = false, lastP = -1;
function filmTick() {
  ticking = false; const r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight, p = cl(-r.top / span), P = p * (N + 0.6); window.SW_FILM = { P: Math.min(P, N - 0.001), N }; document.body.classList.toggle('light', r.bottom < 80);
  if (Math.abs(P - lastP) < 1e-4) return; lastP = P;
  // 첫 화면 겹침(제목 · 출발)은 스크롤을 시작하면 걷힌다
  const io = 1 - ease(cl((P - 0.12) / 0.26)); $('intro').style.opacity = io.toFixed(3); $('intro').style.transform = `translate3d(0, ${(-(1 - io) * 40).toFixed(1)}px, 0)`; $('intro').style.pointerEvents = io > 0.5 ? 'auto' : 'none'; $('cue').style.opacity = (io * 0.9).toFixed(2);
  for (let i = 0; i < N; i++) {
    const t = P - i;
    if (!use3d) { if (t > -0.6 && t < 1.6) { loadImg(i); loadImg(i + 1); } const fin = i === 0 ? 1 : ease(cl((t + 0.3) / 0.3)), fout = i === N - 1 ? 1 - ease(cl((t - 1) / 0.6)) : 1 - ease(cl((t - 0.85) / 0.3)), o = Math.min(fin, fout), F = frames[i]; F.style.opacity = o.toFixed(3); if (o > 0) { const k = cl((t + 0.3) / 1.6); F.style.transform = `scale(${(1.04 + k * 0.16).toFixed(4)}) translate3d(${(-k * 1.6).toFixed(3)}%, ${(-k * 1.1).toFixed(3)}%, 0)`; } }
    const a = i === 0 ? 0.42 : 0.08, ti = ease(cl((t - a) / 0.2)), to = 1 - ease(cl((t - 0.66) / 0.18)), co = Math.min(ti, to), C = chaps[i]; C.style.opacity = co.toFixed(3); C.style.transform = `translate3d(0, ${((1 - ti) * 40 - (1 - to) * 26).toFixed(1)}px, 0)`;
  }
  const k = cl(Math.floor(P), 0, N - 1); $('prog-fill').style.width = `${(cl(P / N) * 100).toFixed(2)}%`; $('prog-t').textContent = `${String(k + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  const e = ease(cl((P - N + 0.1) / 0.4)); $('end').style.opacity = e.toFixed(3); $('end').classList.toggle('on', e > 0.5);
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(filmTick); } }, { passive: true });
addEventListener('resize', () => { lastP = -1; filmTick(); });
{ const f = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }), tick = () => { $('clock').textContent = `지금 ${f.format(new Date())}`; }; tick(); setInterval(tick, 15000); }

// ---------- 불러오기: 컴퓨터는 첫 3D 장면이 그려지면, 아니면 첫 그림이 오면 걷는다 ----------
const loader = { set: (k, s) => { $('ld-bar').style.width = `${Math.round(k * 100)}%`; if (s) $('ld-s').textContent = s; }, done: () => $('loader').classList.add('done') };
function fallbackImages() { use3d = false; lastP = -1; loadImg(0); loadImg(1); const im = new Image(); im.onload = im.onerror = () => loader.done(); im.src = frames[0].dataset.src; filmTick(); }
const want3d = (matchMedia('(min-width: 900px) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) || new URLSearchParams(location.search).has('3d');
if (want3d) {
  use3d = true; loader.set(0.08, '서울을 불러오는 중');
  const giveUp = setTimeout(() => { if (!$('loader').classList.contains('done')) fallbackImages(); }, 25000);
  import('/seoul-walk/landing3d.js').then((m) => { const r = m.start3d($('gl'), { onProgress: (k, s) => loader.set(0.08 + k * 0.9, s), onReady: () => { clearTimeout(giveUp); loader.set(1); setTimeout(loader.done, 250); }, onFail: () => { clearTimeout(giveUp); fallbackImages(); } }); if (!r) { clearTimeout(giveUp); fallbackImages(); } }).catch(() => { clearTimeout(giveUp); fallbackImages(); });
} else fallbackImages();
filmTick();

// ---------- 저장된 자리 (게임과 같은 저장소) ----------
const POS_KEY = 'dreamrunner.hangang.pos', VISIT_KEY = 'dreamrunner.hangang.visit';
const posAll = () => { try { const v = JSON.parse(store.get(POS_KEY) || 'null'); if (!v) return { last: null, regions: {} }; if (v.regions) return v; return { last: v.region || 'yeouido', regions: { [v.region || 'yeouido']: { s: v.s, lat: v.lat, where: v.where } } }; } catch { return { last: null, regions: {} }; } };
const visits = () => { try { return new Set(JSON.parse(store.get(VISIT_KEY) || '[]')); } catch { return new Set(); } };

// ---------- 출발: 모든 동네 ----------
const HOODS = [['yeouido', '여의도 한강'], ['banpo', '반포 한강'], ['ttukseom', '뚝섬 한강'], ['namsan', '남산타워'], ['hongdae', '홍대'], ['sinchon', '신촌'], ['itaewon', '이태원'], ['myeongdong', '명동'], ['insadong', '인사동 · 종로'], ['bukchon', '북촌 한옥마을'], ['seongsu', '성수'], ['gangnam', '강남역'], ['jamsil', '석촌호수 · 잠실']];
function renderStart() {
  const A = posAll();
  $('hoods').innerHTML = HOODS.map(([id, name], i) => `<li><a href="${PLAY}?r=${id}&go=${A.regions[id] ? 'resume' : 'start'}"><i>${String(i + 1).padStart(2, '0')}</i>${name}${A.regions[id] ? '<em>이어서</em>' : ''}</a></li>`).join('');
  const last = A.last && A.regions[A.last] ? A.regions[A.last] : null; $('resume').classList.toggle('hidden', !last);
  if (last) { $('resume').href = `${PLAY}?go=last`; $('resume-sub').textContent = last.where || ''; }
  for (const id of ['go-now', 'go-end', 'go-last', 'bar-go']) $(id).href = last ? `${PLAY}?go=last` : `${PLAY}?r=yeouido&go=start`;
  const n = visits().size; $('tile-n').textContent = n ? `· 가 본 서울 ${n}/201칸` : '';
}

// ---------- 서울 지도 (화면 가득) ----------
let map = null, pick = null, mapRAF = 0;
async function openMap(e) {
  e?.preventDefault(); $('mapbox').classList.remove('hidden');
  if (!map) { const d = await (await fetch('/dream-runner/hangang/seoul.json')).json(); map = new SeoulMap(d, Object.fromEntries(HOODS)); map.allOpen = true; }
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
  $('go-pick').classList.toggle('disabled', !ok); $('go-pick').href = ok ? `${PLAY}?${p.region ? `r=${p.region}&` : ''}x=${Math.round(p.x)}&z=${Math.round(p.z)}` : '#';
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
renderStart(); setupAcct();
