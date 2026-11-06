// 업적 · 옷장 · 별 상점 창 (메인 · 모든 게임 공용). 치장은 계정에 저장되어 모든 게임에서 쓴다
import { account, store } from './account.js';
import { SLOTS, SHOP, RARITY, TIERS, ACHIEVEMENTS, achById, GAMES, itemById, reqText, cleanCos } from './cos-items.js';

const CSS = `
.cw-wrap{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(8,6,20,.78);font-family:'Jua','Noto Sans KR',sans-serif;color:#fff}
.cw-card{width:min(1040px,100%);height:min(88vh,860px);display:flex;flex-direction:column;background:#1d1a33;border:2px solid rgba(255,255,255,.14);border-radius:20px;overflow:hidden}
.cw-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}.cw-head h2{margin:0;font-size:22px;font-weight:normal;flex:1}.cw-stars{padding:5px 14px;border-radius:999px;background:rgba(255,201,60,.18);color:#ffe27a;font-size:17px}.cw-x{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-size:16px;cursor:pointer}
.cw-tabs{display:flex;gap:6px;padding:10px 16px 0;flex-wrap:wrap}.cw-tabs button,.cw-chips button{padding:6px 13px;border:1px solid transparent;border-radius:999px;background:rgba(255,255,255,.08);color:#d9dcef;font:inherit;font-size:15px;cursor:pointer}.cw-tabs button.on,.cw-chips button.on{background:#fff;color:#2b1d5c}
.cw-body{flex:1;display:flex;min-height:0}.cw-left{width:270px;flex:none;display:flex;flex-direction:column;align-items:center;padding:10px;border-right:1px solid rgba(255,255,255,.08)}.cw-pv{width:250px;height:330px;border-radius:14px;background:radial-gradient(circle at 50% 40%,#3a2f6a,#14102a);cursor:grab;touch-action:none}.cw-pv:active{cursor:grabbing}.cw-spin{display:flex;align-items:center;gap:8px;width:100%;margin-top:6px;font-size:12px;color:#b9bcd2}.cw-spin button{flex:none;padding:3px 10px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:13px;cursor:pointer}.cw-eq{width:100%;margin-top:8px;font-size:13px;line-height:1.7;overflow:auto;color:#c9cce0}.cw-eq b{color:#fff;font-weight:normal}.cw-eq button{margin-left:4px;padding:0 6px;border:0;border-radius:6px;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-size:11px;cursor:pointer}
.cw-right{flex:1;min-width:0;display:flex;flex-direction:column}.cw-chips{display:flex;gap:6px;padding:10px 14px;overflow-x:auto;flex:none}.cw-chips button{flex:none;font-size:13px;padding:4px 10px}.cw-list{flex:1;overflow-y:auto;padding:0 14px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:8px;align-content:start}
.cw-it{display:flex;flex-direction:column;gap:3px;padding:10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);min-height:96px;cursor:pointer}.cw-it:hover{background:rgba(255,255,255,.1)}.cw-it.lock{opacity:.5}.cw-it.on{border-color:#ffe27a;box-shadow:0 0 0 1px #ffe27a inset}.cw-n{font-size:15px;line-height:1.25}.cw-s{font-size:12px;color:#b9bcd2;font-family:'Noto Sans KR',sans-serif;line-height:1.35;flex:1}.cw-r{font-size:12px}.cw-b{margin-top:4px;padding:5px;border:0;border-radius:8px;background:#fff;color:#2b1d5c;font:inherit;font-size:13px;cursor:pointer}.cw-b:disabled{background:rgba(255,255,255,.14);color:#9a9db4;cursor:default}
.cw-sum{padding:10px 14px 0;color:#c9cce0;font-size:14px}.cw-bar{height:8px;margin-top:5px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.cw-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff5c8a,#ffc93c,#7fe9ff)}
.cw-msg{padding:0 16px 8px;min-height:18px;color:#ffb3b3;font-size:13px}
.cos-title{display:inline-block;margin-left:5px;padding:0 7px;border-radius:999px;font-size:.78em;line-height:1.55;vertical-align:1px;white-space:nowrap;color:#1a1030;background:linear-gradient(100deg,var(--c1),#fff 45%,var(--c1));background-size:220% 100%;animation:cosShine 2.4s linear infinite;box-shadow:0 0 calc(var(--g)*1px) var(--c1)}
.cos-title.rb{background:linear-gradient(100deg,#ff5c8a,#ffc93c,#5fe0b0,#7fe9ff,#c77dff,#ff5c8a);background-size:300% 100%;animation-name:cosShineRb;animation-duration:1.6s;font-weight:bold}
/* 무늬 한 장(배경 크기)만큼 정확히 밀어야 끝 프레임이 첫 프레임과 맞물린다: 220% → 이동 1.2배 × 183.33% = 2.2, 300% → 2배 × 150% = 3 */
@keyframes cosShine{from{background-position:183.333% 0}to{background-position:0 0}}@keyframes cosShineRb{from{background-position:150% 0}to{background-position:0 0}}
.cos-toast{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:100002;padding:14px 26px;border-radius:18px;background:linear-gradient(120deg,#3a1f6a,#1d1a33);border:2px solid #ffe27a;color:#fff;font-family:'Jua',sans-serif;text-align:center;box-shadow:0 0 40px rgba(255,226,122,.6);animation:cosPop .5s ease-out;pointer-events:none}.cos-toast small{display:block;color:#ffe27a;font-size:14px;margin-bottom:2px}.cos-toast b{font-weight:normal;font-size:22px}
@keyframes cosPop{from{transform:translateX(-50%) scale(.6);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
@media(max-width:720px){.cw-left{display:none}.cw-card{height:94vh}}`;
function css() { if (!document.getElementById('cw-css')) { const s = document.createElement('style'); s.id = 'cw-css'; s.textContent = CSS; document.head.append(s); } }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 이름 옆 칭호 (빛나는 글자). 어느 게임 화면이든 HTML 로 끼워 넣는다
export function titleHtml(id) {
  const it = id && itemById.get(id); if (!it || it.slot !== 'title') return '';
  css(); const t = TIERS[it.rarity] || TIERS.bronze;
  return `<span class="cos-title${it.fx.rainbow ? ' rb' : ''}" style="--c1:${t.color};--g:${t.n * 3}" title="${esc(ACHIEVEMENTS.find((a) => a.id === it.ach)?.desc || '')}">${it.emoji} ${esc(it.name)}</span>`;
}
const anon = () => (account.session ? '' : store.get('dreamrunner.anon') || '');
const q = () => (anon() ? `?anon=${anon()}` : '');
export const loadCos = async () => { const c = await account.api('/api/cos/me' + q()); if (account.session) account.setCos(c); else account.cos = c; return c; };
// 새로 달성한 업적 알림: 한 판이 끝나면 부른다
let toastQ = [], toasting = false;
function nextToast() {
  const id = toastQ.shift(); if (id == null) { toasting = false; return; } toasting = true; css();
  const a = ACHIEVEMENTS.find((x) => x.id === id); if (!a) return nextToast(); const T = TIERS[a.tier], el = document.createElement('div'); el.className = 'cos-toast'; el.style.borderColor = T.color; el.style.boxShadow = `0 0 ${T.n * 12}px ${T.color}`;
  el.innerHTML = `<small>🏆 업적 달성 · ${T.name}</small><b>${GAMES[a.game]?.emoji || '🏆'} ${esc(a.name)}</b>`; document.body.append(el);
  setTimeout(() => { el.remove(); nextToast(); }, 2400);
}
export async function notifyNew() {
  try { const c = await loadCos(); if (!c.fresh?.length) return c; toastQ.push(...c.fresh.slice(-5)); if (!toasting) nextToast(); account.api('/api/cos/seen', { method: 'POST', body: { anon: anon() || undefined } }).catch(() => {}); return c; } catch { return null; }
}
// ---------- 창 ----------
export async function openWardrobe(tab = 'ach', onChange) {
  css(); if (document.querySelector('.cw-wrap')) return;
  let C; try { C = await loadCos(); } catch { C = { stars: 0, owned: [], equip: {}, ach: {}, best: {} }; }
  const S = { tab, game: 'all', slot: 'aura', show: 'all' };
  const wrap = document.createElement('div'); wrap.className = 'cw-wrap';
  wrap.innerHTML = `<div class="cw-card"><div class="cw-head"><h2>🏆 업적 · 치장</h2><span class="cw-stars"></span><button class="cw-x">✕</button></div><div class="cw-tabs"><button data-t="ach">🏆 업적</button><button data-t="closet">👕 옷장</button><button data-t="shop">⭐ 별 상점</button></div><div class="cw-msg"></div><div class="cw-body"><div class="cw-left"><canvas class="cw-pv" width="500" height="660"></canvas><div class="cw-spin"><button class="cw-spin-b">⏸ 멈추기</button><span>끌어서 돌려 보세요</span></div><div class="cw-eq"></div></div><div class="cw-right"><div class="cw-sum"></div><div class="cw-chips"></div><div class="cw-list"></div></div></div></div>`;
  document.body.append(wrap);
  const $ = (s) => wrap.querySelector(s), msg = (t) => { $('.cw-msg').textContent = t || ''; };
  const owns = (it) => (it.shop ? C.owned.includes(it.id) : C.live && (it.slot === 'crown' || it.slot === 'title') && achById.get(it.ach)?.rule.crown ? C.live.includes(it.id) : !!C.ach[it.ach]);
  const post = async (path, body) => { msg(''); try { C = await account.api(path, { method: 'POST', body: { ...body, anon: anon() || undefined } }); if (account.session) account.setCos(C); else account.cos = C; onChange?.(C); draw(); pv?.set(C.equip); } catch (e) { msg(e.status === 401 ? '로그인하거나 드림 러너를 한 판 달리면 쓸 수 있어요' : e.message); } };
  // 미리보기: 곰돌이에 입혀 빙글빙글
  let pv = null;
  (async () => {
    try {
      const THREE = await import('three'), { Roach } = await import('./roach.js'), cv = $('.cw-pv'); if (!cv.offsetWidth) return;
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(1); r.setSize(cv.width, cv.height, false);
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, cv.width / cv.height, 0.1, 50); cam.position.set(0, 1.5, 6); cam.lookAt(0, 1.25, 0); sc.add(new THREE.HemisphereLight('#ffffff', '#6a6090', 2.4)); const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 3); sc.add(dl);
      const c0 = account.chars?.[0]?.profile, b = new Roach({ own: true, seed: 'pv', color: c0?.color || '#8a5634', age: 25, look: { ...(c0?.look || {}), cos: undefined }, accessories: c0?.accessories || [] }); sc.add(b.root); b.setCos(C.equip);
      pv = { set: (e) => b.setCos(e), bear: b }; let last = performance.now(), T = 0, alive = true; pv.stop = () => { alive = false; r.dispose(); };
      // 돌리기: 저절로 천천히 돌고, 단추로 멈추거나 끌어서 직접 돌린다
      const spinB = $('.cw-spin-b'); let auto = true, drag = null, yaw = 0; const label = () => { spinB.textContent = auto ? '⏸ 멈추기' : '▶ 돌리기'; };
      spinB.onclick = () => { auto = !auto; label(); };
      cv.onpointerdown = (e) => { drag = { x: e.clientX, yaw }; cv.setPointerCapture?.(e.pointerId); };
      cv.onpointermove = (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012; };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; };
      pv.state = () => ({ auto, yaw, drag: !!drag });
      const loop = () => { if (!alive) return; const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; T += dt; if (auto && !drag) yaw += dt * 0.6; b.root.rotation.y = yaw; b.cosBoost = 1; b.update(dt, 3, { noCrawl: true }); if ((T % 1.6) < dt) { b.cos?.fire('jump'); b.cos?.fire('land'); } r.render(sc, cam); requestAnimationFrame(loop); }; loop();
    } catch (e) { console.warn('미리보기', e); }
  })();
  const close = () => { pv?.stop?.(); wrap.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }; addEventListener('keydown', onKey, true);
  $('.cw-x').onclick = close; wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  for (const b of $('.cw-tabs').children) b.onclick = () => { S.tab = b.dataset.t; S.slot = S.tab === 'shop' ? (SLOTS[S.slot]?.name && SHOP.some((x) => x.slot === S.slot) ? S.slot : 'aura') : S.slot; draw(); };
  const chips = (list, cur, set) => { const el = $('.cw-chips'); el.innerHTML = list.map(([k, t]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join(''); for (const b of el.children) b.onclick = () => { set(b.dataset.k); draw(); }; };
  const card = (html, cls, click) => { const d = document.createElement('div'); d.className = `cw-it ${cls}`; d.innerHTML = html; if (click) d.onclick = click; return d; };
  const stars = (n) => `⭐ ${Number(n).toLocaleString()}`;
  function drawEq() {
    const e = C.equip || {}; $('.cw-eq').innerHTML = Object.entries(SLOTS).filter(([s]) => e[s]).map(([s, v]) => `${v.emoji} ${v.name}: <b>${esc(itemById.get(e[s])?.name || '')}</b><button data-off="${s}">벗기</button>`).join('<br>') || '<div style="text-align:center">아직 입은 게 없어요</div>';
    for (const b of $('.cw-eq').querySelectorAll('[data-off]')) b.onclick = () => post('/api/cos/equip', { slot: b.dataset.off, id: null });
  }
  function draw() {
    $('.cw-stars').textContent = stars(C.stars || 0); for (const b of $('.cw-tabs').children) b.classList.toggle('on', b.dataset.t === S.tab); drawEq();
    const list = $('.cw-list'); list.innerHTML = ''; const sum = $('.cw-sum');
    if (S.tab === 'ach') {
      const done = Object.keys(C.ach || {}).length; sum.innerHTML = `달성 ${done} / ${ACHIEVEMENTS.length}<div class="cw-bar"><i style="width:${(done / ACHIEVEMENTS.length) * 100}%"></i></div>`;
      chips([['all', '전체'], ['done', '✅ 달성'], ...Object.entries(GAMES).map(([k, g]) => [k, `${g.emoji} ${g.name}`])], S.game, (k) => { S.game = k; });
      const rows = ACHIEVEMENTS.filter((a) => (S.game === 'all' ? true : S.game === 'done' ? C.ach?.[a.id] : a.game === S.game)).sort((a, b) => (!!C.ach?.[b.id] - !!C.ach?.[a.id]) || (TIERS[b.tier].n - TIERS[a.tier].n));
      for (const a of rows.slice(0, 180)) { const T = TIERS[a.tier], ok = !!C.ach?.[a.id], rw = [`🏷️ 칭호`, T.n >= 3 && '🎗️ 휘장', a.rule.crown && '👑 왕관'].filter(Boolean).join(' · '), g = GAMES[a.game]; list.append(card(`<div class="cw-n">${g?.emoji || '🏆'} ${esc(a.name)}</div><div class="cw-s">${esc(a.desc)}</div><div class="cw-r" style="color:${T.color}">${T.name} 등급 · ${rw}${ok ? ' · ✅' : ''}</div>`, ok ? '' : 'lock', null)); }
      if (rows.length > 180) list.append(card(`<div class="cw-s">게임을 골라 나머지 ${rows.length - 180}개를 볼 수 있어요</div>`, ''));
    } else if (S.tab === 'closet') {
      sum.textContent = '가진 치장은 모든 게임에서 보여요. 2D 게임에서는 칭호가 이름 옆에 빛나요';
      chips(Object.entries(SLOTS).map(([k, v]) => [k, `${v.emoji} ${v.name}`]), S.slot, (k) => { S.slot = k; });
      const mine = [...itemById.values()].filter((i) => i.slot === S.slot && owns(i));
      if (!mine.length) list.append(card(`<div class="cw-s">아직 없어요. ${SLOTS[S.slot].sub}${S.slot === 'crown' ? ' · 지금 1위인 순위표의 왕관만 쓸 수 있어요' : ['sash', 'title'].includes(S.slot) ? ' · 업적을 달성하면 얻어요 (1위 칭호는 1위인 동안만)' : ' · 별 상점에서 살 수 있어요'}</div>`, ''));
      for (const it of mine) { const on = C.equip?.[S.slot] === it.id, rc = RARITY[it.rarity]?.color || TIERS[it.rarity]?.color; const d = card(`<div class="cw-n">${it.emoji} ${esc(it.name)}</div><div class="cw-r" style="color:${rc}">${RARITY[it.rarity]?.name || TIERS[it.rarity]?.name}</div><button class="cw-b">${on ? '벗기' : '입기'}</button>`, on ? 'on' : ''); d.querySelector('button').onclick = () => post('/api/cos/equip', { slot: S.slot, id: on ? null : it.id }); list.append(d); }
    } else {
      sum.textContent = '별은 드림 러너를 달리면 모여요. 어려운 난이도와 랜덤 지옥일수록 많이 받아요';
      chips(Object.entries(SLOTS).filter(([k]) => SHOP.some((x) => x.slot === k)).map(([k, v]) => [k, `${v.emoji} ${v.name}`]), S.slot, (k) => { S.slot = k; });
      for (const it of SHOP.filter((i) => i.slot === S.slot).sort((a, b) => a.price - b.price)) {
        const has = owns(it), locked = it.req && (C.best?.[`${it.req.map}:${it.req.diff}`] || 0) < it.req.dist, poor = (C.stars || 0) < it.price, R = RARITY[it.rarity];
        const d = card(`<div class="cw-n">${it.emoji} ${esc(it.name)}</div><div class="cw-r" style="color:${R.color}">${R.name}</div><div class="cw-s">${it.req ? `🔒 ${esc(reqText(it.req))}` : ''}</div><button class="cw-b" ${has || locked || poor ? 'disabled' : ''}>${has ? '가지고 있어요' : locked ? `잠김 · ${stars(it.price)}` : stars(it.price)}</button>`, has ? 'on' : locked ? 'lock' : '');
        const preview = () => pv?.set(cleanCos({ ...(C.equip || {}), [it.slot]: it.id }) || {}); d.onmouseenter = preview; d.onmouseleave = () => pv?.set(C.equip); d.querySelector('button').onclick = (e) => { e.stopPropagation(); if (confirm(`${it.name} 을(를) ${it.price.toLocaleString()}개로 살까요?`)) post('/api/cos/buy', { id: it.id }); }; list.append(d);
      }
    }
  }
  draw();
}
