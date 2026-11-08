// 젤리 서울 산책 랜딩: 장면 넘기기 · 동네 카드(이어 걷기) · 서울 지도에서 고르기 · 계정(선택) · 스크롤에 나타나기
import { account, store } from '/shared/js/account.js';
import { SeoulMap } from '/dream-runner/js/seoul-map.js';

const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAY = '/seoul-walk/play/';

// ---------- 첫 화면 장면 (게임 속에서 찍은 랜드마크) ----------
const SCENES = [['63', '63빌딩', '여의도 · 해 질 녘'], ['tower', 'N서울타워', '남산 · 밤'], ['namsanview', '남산에서 본 서울', '진짜 지형 · 해 질 녘'], ['lotte', '롯데월드타워', '잠실 · 노을'], ['hongdae', '홍대 거리', '마포 · 여름밤'], ['gangnam', '강남역 거리', '강남 · 겨울밤'], ['hangang', '한강의 밤', '여의도 · 여름']];
{
  const box = $('scenes'), dots = $('dots'), els = SCENES.map(([f]) => { const d = document.createElement('div'); d.className = 's'; d.dataset.src = `/dream-runner/sw/${f}.webp`; box.appendChild(d); return d; });
  dots.innerHTML = SCENES.map(() => '<i></i>').join(''); const ds = [...dots.children];
  let k = -1, timer = null; const load = (i) => { if (!els[i].style.backgroundImage) els[i].style.backgroundImage = `url(${els[i].dataset.src})`; };
  const show = (i) => { if (k >= 0) { els[k].classList.remove('on'); ds[k].classList.remove('on'); } k = (i + SCENES.length) % SCENES.length; load(k); load((k + 1) % SCENES.length); void els[k].offsetWidth; els[k].classList.add('on'); ds[k].classList.add('on'); $('cap-n').textContent = SCENES[k][1]; $('cap-s').textContent = SCENES[k][2]; };
  const loop = () => { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) show(k + 1); }, 7000); };
  ds.forEach((d, i) => { d.onclick = () => { show(i); loop(); }; });
  show(0); loop();
}

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
  $('go-now').href = last ? `${PLAY}?go=last` : `${PLAY}?r=yeouido&go=start`; $('go-now-sub').textContent = last ? `이어서 · ${String(last.where || '').slice(0, 26)}` : '여의도 한강에서';
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
