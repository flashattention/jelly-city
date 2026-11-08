// 젤리 서울 산책 랜딩: 장면 넘기기 · 동네 카드(이어 걷기) · 서울 지도에서 고르기 · 계정(선택) · 스크롤에 나타나기
import { account, store } from '/shared/js/account.js';
import { SeoulMap } from '/dream-runner/js/seoul-map.js';

const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAY = '/seoul-walk/play/';

// ---------- 장면 이야기: 화면에 붙은 무대에서 스크롤에 맞춰 장면이 천천히 다가오고 다음 장면으로 녹아 바뀐다 ----------
const CH = [
  ['c1', '여의도', '37.5198° N · 126.9405° E', '오후 6:06 · 여름', 'Golden Hour', '해가 63빌딩 유리벽에 마지막 빛을 걸어 둘 때, 한강공원 잔디밭이 금빛으로 물들어요.'],
  ['c2', '석촌호수 · 잠실', '37.5096° N · 127.1035° E', '오후 5:24 · 봄', 'Blossom Lake', '봄이면 호수 둘레가 벚꽃으로 덮이고, 555m 롯데월드타워가 분홍빛 노을에 잠겨요.'],
  ['c3', '남산', '37.5512° N · 126.9882° E', '오후 8:36 · 가을', 'The Tower', '진짜 산 위, 해발 262m. 해가 지면 N서울타워에 불이 켜지고 서울이 발아래에서 반짝여요.'],
  ['c4', '남산 정상', '37.5509° N · 126.9880° E', '오후 6:30 · 가을', 'City Below', '한양도성 길에 서면 지붕이 끝없이 이어져요. 저 아래 어디든, 걸어서 갈 수 있어요.'],
  ['c5', '홍대', '37.5563° N · 126.9236° E', '오후 9:30 · 비', 'Neon Rain', '비 오는 밤의 골목. 간판 불빛이 젖은 길에 번지고, 어디선가 버스킹 소리가 들려요.'],
  ['c6', '한강', '37.5265° N · 126.9340° E', '오후 8:48 · 여름', 'River Lights', '강물 위로 도시의 불빛이 흔들려요. 실제 열차가 다리를 건너는 그 순간, 여기서도.'],
  ['c7', '강남', '37.4979° N · 127.0276° E', '오후 8:12 · 첫눈', 'First Snow', '첫눈 오는 강남대로. 유리 빌딩 사이로 눈송이가 천천히, 아주 천천히 내려요.'],
];
const film = $('film'), frames = CH.map(([f]) => { const d = document.createElement('div'); d.className = 'f'; d.dataset.src = `/seoul-walk/img/${f}.webp`; $('frames').appendChild(d); return d; });
film.style.setProperty('--n', CH.length);
const chaps = CH.map(([, place, co, when, title, txt], i) => { const d = document.createElement('div'); d.className = 'chap'; d.innerHTML = `<div class="lab"><b>CH.${String(i + 1).padStart(2, '0')}</b><span>${place}</span><span>${when}</span></div><h3>${title}</h3><div class="rule"></div><p>${txt}</p><div class="co">${co}</div>`; $('chaps').appendChild(d); return d; });
$('prog').innerHTML = CH.map(() => '<i></i>').join(''); const pr = [...$('prog').children];
const load = (k) => { const d = frames[k]; if (d && !d.style.backgroundImage) d.style.backgroundImage = `url(${d.dataset.src})`; };
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), ease = (x) => x * x * (3 - 2 * x);
let ticking = false, lastP = -1;
function filmTick() {
  ticking = false; const r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight, p = cl(-r.top / span), N = CH.length, P = p * (N + 0.6); if (Math.abs(P - lastP) < 1e-4) return; lastP = P;
  for (let i = 0; i < N; i++) {
    const t = P - i; // 이 장면 안에서의 진행 (0 ~ 1)
    if (t > -0.6 && t < 1.6) { load(i); load(i + 1); }
    const fin = i === 0 ? 1 : ease(cl((t + 0.3) / 0.3)), fout = i === N - 1 ? 1 - ease(cl((t - 1) / 0.6)) : 1 - ease(cl((t - 0.85) / 0.3));
    const o = Math.min(fin, fout), F = frames[i]; F.style.opacity = o.toFixed(3); if (o > 0) { const k = cl((t + 0.3) / 1.6); F.style.transform = `scale(${(1.04 + k * 0.16).toFixed(4)}) translate3d(${(-k * 1.6).toFixed(3)}%, ${(-k * 1.1).toFixed(3)}%, 0)`; }
    const ti = ease(cl((t - 0.08) / 0.22)), to = 1 - ease(cl((t - 0.62) / 0.2)), C = chaps[i], co = Math.min(ti, to); C.style.opacity = co.toFixed(3); C.style.transform = `translate3d(0, ${((1 - ti) * 34 - (1 - to) * 24).toFixed(1)}px, 0)`;
    pr[i].classList.toggle('on', t >= 0 && t < 1);
  }
  const e = ease(cl((P - N + 0.1) / 0.4)); $('end').style.opacity = e.toFixed(3); $('end').classList.toggle('on', e > 0.5);
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(filmTick); } }, { passive: true });
addEventListener('resize', () => { lastP = -1; filmTick(); });
load(0); filmTick();
// 첫 화면 그림이 오면 불러오기 덮개를 걷는다 (늦어도 3초)
{ const im = new Image(), done = () => $('loader').classList.add('done'); im.onload = done; im.onerror = done; im.src = '/seoul-walk/img/c1.webp'; setTimeout(done, 3000); }
// 서울 지금 시각
{ const f = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }), tick = () => { $('clock').textContent = `${f.format(new Date())} KST`; }; tick(); setInterval(tick, 15000); }

// ---------- 저장된 자리 (게임과 같은 저장소) ----------
const POS_KEY = 'dreamrunner.hangang.pos', VISIT_KEY = 'dreamrunner.hangang.visit';
const posAll = () => { try { const v = JSON.parse(store.get(POS_KEY) || 'null'); if (!v) return { last: null, regions: {} }; if (v.regions) return v; return { last: v.region || 'yeouido', regions: { [v.region || 'yeouido']: { s: v.s, lat: v.lat, where: v.where } } }; } catch { return { last: null, regions: {} }; } };
const visits = () => { try { return new Set(JSON.parse(store.get(VISIT_KEY) || '[]')); } catch { return new Set(); } };

// ---------- 동네 ----------
const HOODS = [
  ['yeouido', '🌉', '여의도 한강', '서강대교 아래 강바람, 63빌딩 너머 노을. 벚꽃길과 한강공원 잔디밭.', '#f2c27b'],
  ['banpo', '🌈', '반포 한강', '밤이면 반포대교에서 무지개 분수가 쏟아지고, 세빛섬이 물 위에서 빛나요.', '#9cc7ff'],
  ['ttukseom', '🏙️', '뚝섬 한강', '자벌레 전망대와 음악분수, 강 건너 청담의 불빛.', '#7fd6c8'],
  ['namsan', '🗼', '남산타워', '진짜 산 위의 N서울타워. 전망대에 올라 서울을 내려다봐요.', '#f39bb4'],
  ['hongdae', '🎸', '홍대 거리', '버스킹과 벽화, 경의선숲길. 밤이면 네온이 켜지는 골목.', '#ff8fcf'],
  ['itaewon', '🌍', '이태원 거리', '언덕길을 따라 세계 여러 나라의 가게와 루프탑.', '#ffb27a'],
  ['myeongdong', '🛍️', '명동', '명동대성당과 붐비는 쇼핑 거리, 남산이 올려다보이는 길.', '#f2c27b'],
  ['insadong', '🏮', '인사동 · 종로', '경복궁 담장과 인사동 골목, 오래된 찻집과 공방.', '#e6a26b'],
  ['bukchon', '🏯', '북촌 한옥마을', '기와지붕이 겹겹이 이어진 언덕 골목.', '#c8b48a'],
  ['seongsu', '☕', '성수 거리', '붉은 벽돌 공장이 카페가 된 거리, 서울숲.', '#d98a6a'],
  ['gangnam', '🏙️', '강남역', '높은 유리 빌딩 사이로 쏟아지는 사람과 불빛.', '#9cc7ff'],
  ['jamsil', '🎡', '석촌호수 · 잠실', '호수 둘레 벚꽃길과 롯데월드타워.', '#f39bb4'],
  ['sinchon', '🎓', '신촌', '대학가의 젊은 거리, 연세로와 이화여대 앞.', '#b9a4ff'],
];
function renderHoods() {
  const A = posAll();
  $('hoods').innerHTML = HOODS.map(([id, em, name, desc, c]) => { const p = A.regions[id], resume = !!p; return `<a class="hood reveal" style="--c:${c}" href="${PLAY}?r=${id}&go=${resume ? 'resume' : 'start'}">${resume ? '<span class="badge">이어 걷기</span>' : ''}<span class="em">${em}</span><b>${name}</b><p>${desc}</p><span class="go">${resume ? `▶ ${esc(String(p.where || '멈춘 자리').slice(0, 30))}` : '여기서 걷기 →'}</span></a>`; }).join('');
  const last = A.last && A.regions[A.last] ? A.regions[A.last] : null;
  $('resume-all').classList.toggle('hidden', !last); if (last) { $('resume-all').href = `${PLAY}?go=last`; $('resume-all-sub').textContent = last.where || ''; }
  $('go-now').href = $('go-end').href = last ? `${PLAY}?go=last` : `${PLAY}?r=yeouido&go=start`; $('go-now-sub').textContent = last ? `이어서 · ${String(last.where || '').slice(0, 26)}` : '여의도 한강에서';
  observe();
}

// ---------- 서울 지도 ----------
let map = null, pick = null;
async function setupMap() {
  const d = await (await fetch('/dream-runner/hangang/seoul.json')).json(); map = new SeoulMap(d, Object.fromEntries(HOODS.map(([id, em, n]) => [id, `${em} ${n}`]))); map.allOpen = true;
  const cv = $('seoul'), ctx = cv.getContext('2d');
  const here = () => { const A = posAll(), p = A.last && A.regions[A.last]; return p && p.x != null ? { x: p.x, z: p.z } : null; };
  let vis = false; new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(cv);
  const draw = (t) => { if (vis) map.draw(ctx, cv.width, cv.height, { here: here(), pick: pick ? { ...pick, region: pick.region || 'x' } : null, t: t / 1000 }); requestAnimationFrame(draw); };
  map.draw(ctx, cv.width, cv.height, { here: here() }); requestAnimationFrame(draw);
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), p = map.pickAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); pick = p;
    $('pick').innerHTML = `<b>${esc(p.region ? p.name : p.gu || '서울')}</b><span>${p.region ? `${esc(p.gu)} · 이 동네 길 위에서 시작해요` : p.gu ? `${esc(p.gu)} · 이 자리에서 시작해요` : '서울 바깥이에요 · 서울 안을 눌러 주세요'}</span>`;
    const ok = !!p.gu || !!p.region; $('go-pick').classList.toggle('disabled', !ok);
    $('go-pick').href = ok ? `${PLAY}?${p.region ? `r=${p.region}&` : ''}x=${Math.round(p.x)}&z=${Math.round(p.z)}` : '#';
  });
}

// ---------- 계정 (선택) ----------
function cloudMerge(r) {
  if (!r) return; const a = posAll(); let ch = false;
  for (const [id, p] of Object.entries(r.pos?.regions || {})) if (!a.regions[id] || (a.regions[id].at || 0) < (p.at || 0)) { a.regions[id] = p; ch = true; }
  if (r.pos?.last && (r.pos.at || 0) > (a.at || 0)) { a.last = r.pos.last; a.at = r.pos.at; ch = true; } if (ch) store.set(POS_KEY, JSON.stringify(a));
  const V = visits(), n = V.size; for (const k of r.visit || []) V.add(k); if (V.size !== n) store.set(VISIT_KEY, JSON.stringify([...V]));
}
function renderAcct() {
  const n = visits().size; $('visits').textContent = n ? `🗺️ 가 본 서울 ${n} / 201칸` : '';
  if (account.user) { $('acct-t').textContent = `${account.user.nick || account.user.name || ''} 님, 다시 만나요`; $('acct-p').textContent = '걸은 자리와 가 본 동네가 계정에 저장되고 있어요. 다른 기기에서도 이어서 걸을 수 있어요.'; $('g-btn').innerHTML = ''; }
}
async function setupAcct() {
  let st = {}; try { st = await account.status(); } catch { /* 서버 연결 안 됨: 로그인 없이 */ }
  if (await account.restore().catch(() => false)) { try { cloudMerge(await account.api('/api/dream/hangang/me')); } catch { /* 다음에 */ } renderHoods(); }
  renderAcct();
  if (!account.user && st.googleClientId) account.googleButton($('g-btn'), st.googleClientId, async () => { try { cloudMerge(await account.api('/api/dream/hangang/me')); await account.api('/api/dream/hangang/save', { method: 'POST', body: { pos: posAll(), visit: [...visits()] } }); } catch { /* 다음에 */ } renderAcct(); renderHoods(); }, () => {}).catch(() => {});
}

// ---------- 스크롤에 나타나기 ----------
let io = null;
function observe() { io ||= new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { threshold: 0.12 }); document.querySelectorAll('.reveal:not(.in)').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; io.observe(el); }); }
document.querySelectorAll('.head, .trio article, .why > div, .col, .facts > div, .acct-in, .map-wrap').forEach((el) => el.classList.add('reveal'));

renderHoods(); renderAcct(); setupMap(); setupAcct();
