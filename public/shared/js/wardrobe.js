// 업적 · 옷장 · 별 상점 창 (메인 · 모든 게임 공용). 치장은 계정에 저장되어 모든 게임에서 쓴다
import { account, store } from './account.js';
import { LOOK_PARTS } from './look.js';
import { SLOTS, SHOP, RARITY, TIERS, ACHIEVEMENTS, achById, GAMES, itemById, reqText, cleanCos, TOP3_TRAILS, TOP1_TRAILS, liveTrailText } from './cos-items.js';

const CSS = `
.cw-wrap{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(8,6,20,.78);font-family:'Jua','Noto Sans KR',sans-serif;color:#fff}
.cw-card{width:min(1040px,100%);height:min(88vh,860px);display:flex;flex-direction:column;background:#1d1a33;border:2px solid rgba(255,255,255,.14);border-radius:20px;overflow:hidden}
.cw-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}.cw-head h2{margin:0;font-size:22px;font-weight:normal;flex:1}.cw-stars{padding:5px 14px;border-radius:999px;background:rgba(255,201,60,.18);color:#ffe27a;font-size:17px}.cw-x{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-size:16px;cursor:pointer}
.cw-tabs{display:flex;gap:6px;padding:10px 16px 0;flex-wrap:wrap}.cw-tabs button,.cw-chips button{padding:6px 13px;border:1px solid transparent;border-radius:999px;background:rgba(255,255,255,.08);color:#d9dcef;font:inherit;font-size:15px;cursor:pointer}.cw-tabs button.on,.cw-chips button.on{background:#fff;color:#2b1d5c}
.cw-body{flex:1;display:flex;min-height:0}.cw-left{width:270px;flex:none;display:flex;flex-direction:column;align-items:center;padding:10px;border-right:1px solid rgba(255,255,255,.08)}.cw-pv{width:250px;height:330px;border-radius:14px;background:radial-gradient(circle at 50% 40%,#3a2f6a,#14102a);cursor:grab;touch-action:none}.cw-pv:active{cursor:grabbing}.cw-spin{display:flex;align-items:center;gap:8px;width:100%;margin-top:6px;font-size:12px;color:#b9bcd2}.cw-spin button{flex:none;padding:3px 10px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font:inherit;font-size:13px;cursor:pointer}.cw-eq{width:100%;margin-top:8px;font-size:13px;line-height:1.7;overflow:auto;color:#c9cce0}.cw-eq b{color:#fff;font-weight:normal}.cw-eq button{margin-left:4px;padding:0 6px;border:0;border-radius:6px;background:rgba(255,255,255,.12);color:#fff;font:inherit;font-size:11px;cursor:pointer}
.cw-right{flex:1;min-width:0;display:flex;flex-direction:column}.cw-chips{display:flex;gap:6px;padding:10px 14px;overflow-x:auto;flex:none}.cw-chips button{flex:none;font-size:13px;padding:4px 10px}.cw-list{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:0 8px 14px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));grid-auto-rows:max-content;gap:8px;align-content:start;align-items:stretch}
.cw-it.cw-wide{grid-column:1/-1;min-height:0;cursor:default;background:rgba(255,255,255,.03)}.cw-it.cw-mini{min-height:0;flex-direction:row;align-items:center;gap:8px;padding:8px 10px}.cw-it.cw-mini .cw-n{flex:1;min-width:0}.cw-it.cw-mini .cw-b{width:auto;margin:0;padding:5px 12px;flex:none}
.cw-it{display:flex;flex-direction:column;gap:3px;padding:10px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);min-height:104px;min-width:0;cursor:pointer}.cw-it:hover{background:rgba(255,255,255,.1)}.cw-it.lock{opacity:.5}.cw-it.on{border-color:#ffe27a;box-shadow:0 0 0 1px #ffe27a inset}.cw-n{flex:none;font-size:15px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 0}.cw-it>*{flex-shrink:0}.cw-s{font-size:12px;color:#b9bcd2;font-family:'Noto Sans KR',sans-serif;line-height:1.4}.cw-r{font-size:12px;line-height:1.4;margin-top:auto;padding-top:2px}.cw-s+.cw-b,.cw-r+.cw-b,.cw-n+.cw-b{margin-top:auto}.cw-b{padding:5px;border:0;border-radius:8px;background:#fff;color:#2b1d5c;font:inherit;font-size:13px;cursor:pointer}.cw-b:disabled{background:rgba(255,255,255,.14);color:#9a9db4;cursor:default}
.cw-sum{padding:10px 14px 0;color:#c9cce0;font-size:14px}.cw-bar{height:8px;margin-top:5px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.cw-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff5c8a,#ffc93c,#7fe9ff)}
.cw-msg{padding:0 16px 8px;min-height:18px;color:#ffb3b3;font-size:13px}
.cw-look{flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 14px 12px;gap:8px}.cw-ltabs{display:flex;gap:6px;flex-wrap:wrap}.cw-ltabs button{padding:5px 11px;border:0;border-radius:999px;background:rgba(255,255,255,.08);color:#d9dcef;font:inherit;font-size:13px;cursor:pointer}.cw-ltabs button.active{background:#fff;color:#2b1d5c}
.cw-lbody{flex:1;min-height:0;overflow-y:auto;padding-right:4px}.cw-lbody .opt-row{margin:0 0 12px}.cw-lbody .opt-label{font-size:13px;color:#c9cce0;margin-bottom:5px}.cw-lbody .chips{display:flex;flex-wrap:wrap;gap:6px}.cw-lbody .chip{padding:5px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:13px;cursor:pointer}.cw-lbody .chip.sel{background:#ffe27a;border-color:#ffe27a;color:#2b1d5c}
.cw-lbody .swatch{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;font-size:10px;color:#fff}.cw-lbody .swatch.sel{border-color:#ffe27a;box-shadow:0 0 0 2px #ffe27a}.cw-lbody .sw-word{width:auto;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.08)}.cw-lbody .hint{font-size:12px;color:#9a9db4;font-family:'Noto Sans KR',sans-serif}
.cw-lfoot{display:flex;align-items:center;gap:8px;flex:none}.cw-lfoot span{flex:1;font-size:13px;color:#ffe27a}.cw-lfoot button{padding:7px 14px;border:0;border-radius:10px;font:inherit;font-size:14px;cursor:pointer;background:rgba(255,255,255,.12);color:#fff}.cw-lfoot .cw-save{background:#ffe27a;color:#2b1d5c}.cw-lfoot .cw-save:disabled{opacity:.5;cursor:default}
.cw-none{margin:auto;text-align:center;color:#c9cce0;line-height:1.7}.cw-none a{color:#ffe27a}
.cos-title{display:inline-block;margin-left:5px;padding:0 7px;border-radius:999px;font-size:.78em;line-height:1.55;vertical-align:1px;white-space:nowrap;color:#1a1030;background:linear-gradient(100deg,var(--c1),#fff 45%,var(--c1));background-size:220% 100%;animation:cosShine 2.4s linear infinite;box-shadow:0 0 calc(var(--g)*1px) var(--c1)}
.cos-title.rb{background:linear-gradient(100deg,#ff5c8a,#ffc93c,#5fe0b0,#7fe9ff,#c77dff,#ff5c8a);background-size:300% 100%;animation-name:cosShineRb;animation-duration:1.6s;font-weight:bold}
/* 무늬 한 장(배경 크기)만큼 정확히 밀어야 끝 프레임이 첫 프레임과 맞물린다: 220% → 이동 1.2배 × 183.33% = 2.2, 300% → 2배 × 150% = 3 */
.cos-title.p2{box-shadow:0 0 14px var(--c1),0 0 3px #fff inset}
.cos-title.p3{animation:cosShine 2s linear infinite,cosGlow 1.4s ease-in-out infinite alternate;text-shadow:0 0 4px #fff}
.cos-title.rb.p3{animation:cosShineRb 1.4s linear infinite,cosGlow 1.4s ease-in-out infinite alternate}
.cos-title.p4{outline:1.5px solid rgba(255,255,255,.85);outline-offset:1px;animation:cosShineRb 1.2s linear infinite,cosGlow 1s ease-in-out infinite alternate;text-shadow:0 0 5px #fff}
.cos-title.p5{position:relative;outline:2px solid #fff;outline-offset:1px;padding:0 9px;font-weight:bold;background:linear-gradient(100deg,#ff5c8a,#ffc93c,#5fe0b0,#7fe9ff,#c77dff,#ff5c8a);background-size:300% 100%;animation:cosShineRb .9s linear infinite,cosAura 2.4s linear infinite;text-shadow:0 0 6px #fff}
.cos-title.p5::after{content:'✦';position:absolute;right:-7px;top:-8px;font-size:11px;color:#fff;text-shadow:0 0 6px #fff,0 0 12px #ffe27a;animation:cosTwinkle 1.2s ease-in-out infinite}
.cos-title.p5::before{content:'✦';position:absolute;left:-6px;bottom:-7px;font-size:9px;color:#fff;text-shadow:0 0 6px #fff,0 0 12px #7fe9ff;animation:cosTwinkle 1.2s ease-in-out .6s infinite}
.cos-medal{--c1:#ffc93c}.cos-medal.h0{--c1:#ffd54a}.cos-medal.h1{--c1:#e3ebf5}.cos-medal.h2{--c1:#e0955f}.cos-medal.h3{--c1:#ff7ab0}.cos-medal.h4{--c1:#7fe9ff}.cos-medal.h5{--c1:#e9c46a}
@keyframes cosGlow{from{box-shadow:0 0 6px var(--c1)}to{box-shadow:0 0 18px var(--c1),0 0 4px #fff}}
@keyframes cosAura{0%,100%{box-shadow:0 0 12px #ff5c8a,0 0 26px #ff5c8a}25%{box-shadow:0 0 12px #ffc93c,0 0 26px #ffc93c}50%{box-shadow:0 0 12px #7fe9ff,0 0 26px #7fe9ff}75%{box-shadow:0 0 12px #c77dff,0 0 26px #c77dff}}
@keyframes cosTwinkle{0%,100%{opacity:.2;transform:scale(.6) rotate(0)}50%{opacity:1;transform:scale(1.3) rotate(45deg)}}
@keyframes cosShine{from{background-position:183.333% 0}to{background-position:0 0}}@keyframes cosShineRb{from{background-position:150% 0}to{background-position:0 0}}
.cos-toast{position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:100002;padding:14px 26px;border-radius:18px;background:linear-gradient(120deg,#3a1f6a,#1d1a33);border:2px solid #ffe27a;color:#fff;font-family:'Jua',sans-serif;text-align:center;box-shadow:0 0 40px rgba(255,226,122,.6);animation:cosPop .5s ease-out;pointer-events:none}.cos-toast small{display:block;color:#ffe27a;font-size:14px;margin-bottom:2px}.cos-toast b{font-weight:normal;font-size:22px}
@keyframes cosPop{from{transform:translateX(-50%) scale(.6);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
@media(max-width:720px){.cw-left{display:none}.cw-card{height:94vh}.cw-card.look .cw-body{flex-direction:column}.cw-card.look .cw-left{display:flex;width:auto;flex-direction:row;gap:8px;padding:6px 10px;border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}.cw-card.look .cw-pv{width:150px;height:190px}.cw-card.look .cw-eq,.cw-card.look .cw-spin span{display:none}}`;
function css() { if (!document.getElementById('cw-css')) { const s = document.createElement('style'); s.id = 'cw-css'; s.textContent = CSS; document.head.append(s); } }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 이름 옆 칭호 (빛나는 글자). 어느 게임 화면이든 HTML 로 끼워 넣는다
// 격(pr): 어려운 난이도 1위일수록 더 화려하다 (p1 ~ p5, 초월이 가장 화려)
// 무지개 칭호: 난이도마다 다른 색으로 돈다 (첫 색을 끝에 한 번 더 넣어 이음매 없이)
const gradCss = (f, force) => (f?.grad && (f.rainbow || force) ? `;background-image:linear-gradient(100deg,${[...f.grad, f.grad[0]].join(',')});background-size:300% 100%` : '');
const prCls = (f) => (f?.pr >= 1 ? ` p${Math.min(5, Math.floor(f.pr))}` : '');
export function titleHtml(id) {
  const it = id && itemById.get(id); if (!it || it.slot !== 'title') return '';
  css(); const t = TIERS[it.rarity] || TIERS.bronze;
  return `<span class="cos-title${it.fx.rainbow ? ' rb' : ''}${prCls(it.fx)}" style="--c1:${it.fx.grad && it.fx.rainbow ? it.fx.grad[0] : t.color};--g:${t.n * 3}${gradCss(it.fx)}" title="${esc(ACHIEVEMENTS.find((a) => a.id === it.ach)?.desc || '')}">${it.emoji} ${esc(it.name)}</span>`;
}
// 이름 옆 메달 (서버가 지금 가장 높은 순위를 골라 준다: 🥇 1위 → 🥈 2위 → 🥉 3위 → 상위 1% → 5% → 10%)
// title 을 주면: 같은 순위표의 1위 칭호를 이미 달고 있을 때 1위 메달은 빼서 같은 글자가 두 번 뜨지 않게
export function medalHtml(id, title) {
  const it = id && itemById.get(id); if (!it || it.slot !== 'medal') return '';
  if (title && it.fx.honor === 0 && itemById.get(title)?.ach === it.ach) return '';
  css(); const h = it.fx.honor, t = TIERS[it.rarity] || TIERS.gold;
  return `<span class="cos-title cos-medal h${h}${h === 0 || h === 3 ? ' rb' : ''}${h === 0 ? prCls(it.fx) : h <= 3 ? prCls({ pr: Math.min(3, it.fx.pr) }) : ''}" style="--g:${t.n * 3}${h === 0 || h === 3 ? gradCss(it.fx, true) : ''}" title="지금 ${esc(it.name)}">${it.emoji}${it.fx.de || ''} ${esc(it.name)}</span>`;
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
// opt.game: 그 게임에서 열면 업적 칸에 그 게임 업적만 (예: 드림 러너는 'dream-runner')
export async function openWardrobe(tab = 'ach', onChange, opt = {}) {
  css(); if (document.querySelector('.cw-wrap')) return;
  let C; try { C = await loadCos(); } catch { C = { stars: 0, owned: [], equip: {}, ach: {}, best: {} }; }
  const S = { tab, game: 'all', slot: 'aura', show: 'all' }, only = opt.game || null;
  const wrap = document.createElement('div'); wrap.className = 'cw-wrap';
  wrap.innerHTML = `<div class="cw-card"><div class="cw-head"><h2>🎨 꾸미기</h2><span class="cw-stars"></span><button class="cw-x">✕</button></div><div class="cw-tabs"><button data-t="look">🎨 모습</button><button data-t="closet">👕 옷장</button><button data-t="shop">⭐ 별 상점</button><button data-t="ach">🏆 업적</button></div><div class="cw-msg"></div><div class="cw-body"><div class="cw-left"><canvas class="cw-pv" width="500" height="660"></canvas><div class="cw-spin"><button class="cw-spin-b">⏸ 멈추기</button><span>끌어서 돌려 보세요</span></div><div class="cw-eq"></div></div><div class="cw-right"><div class="cw-sum"></div><div class="cw-chips"></div><div class="cw-list"></div><div class="cw-look hidden-look"></div></div></div></div>`;
  document.body.append(wrap);
  const $ = (s) => wrap.querySelector(s), msg = (t) => { $('.cw-msg').textContent = t || ''; };
  const owns = (it) => (it.shop ? C.owned.includes(it.id) : it.top3 || it.top1 ? !!C.live?.includes(it.id) : C.live && (it.slot === 'crown' || it.slot === 'title') && achById.get(it.ach)?.rule.crown ? C.live.includes(it.id) : !!C.ach[it.ach]);
  const post = async (path, body) => { msg(''); try { C = await account.api(path, { method: 'POST', body: { ...body, anon: anon() || undefined } }); if (account.session) account.setCos(C); else account.cos = C; onChange?.(C); draw(); pv?.set(C.equip); } catch (e) { msg(e.status === 401 ? '로그인하거나 드림 러너를 한 판 달리면 쓸 수 있어요' : e.message); } };
  // 꾸밀 캐릭터: 고른 캐릭터(opt.char) → 대표 캐릭터 → 첫 캐릭터. 로그인 안 했으면 이 기기에 만든 캐릭터
  const { localChars, updateLocal, isLocal } = await import('./local-chars.js');
  const charList = () => (account.session ? account.chars || [] : localChars());
  const myChar = () => { const L = charList(), want = opt.char || store.get('jelly.char'); return L.find((c) => c.token === want) || L[0] || null; };
  let ch = myChar(), draft = null, dirty = false, creator = null;
  const lookOf = () => { const p = draft || ch?.profile || {}; return { color: p.color || '#8a5634', look: { ...(p.look || {}), cos: undefined }, accessories: ch?.profile?.accessories || [], gender: p.gender, age: p.age }; };
  // 미리보기: 곰돌이에 입혀 빙글빙글 (휴대폰에서는 모습 탭을 열 때 처음 만든다)
  let pv = null, pvTry = false;
  const startPv = async () => {
    if (pvTry) return; const cv0 = $('.cw-pv'); if (!cv0.offsetWidth) return; pvTry = true;
    try {
      const THREE = await import('three'), { Roach } = await import('./roach.js'), cv = $('.cw-pv');
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setPixelRatio(1); r.setSize(cv.width, cv.height, false);
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, cv.width / cv.height, 0.1, 50); cam.position.set(0, 1.5, 6); cam.lookAt(0, 1.25, 0); sc.add(new THREE.HemisphereLight('#ffffff', '#6a6090', 2.4)); const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 3); sc.add(dl);
      let b = null, eq = C.equip;
      const { Booster } = await import('./booster.js'); let bst = null;
      const make = () => { const L = lookOf(), y = b?.root.rotation.y || 0; if (b) sc.remove(b.root); b = new Roach({ own: true, cosPreview: true, seed: 'pv', color: L.color, age: L.age || 25, gender: L.gender, look: L.look, accessories: L.accessories }); b.root.rotation.y = y; sc.add(b.root); b.setCos(eq); pv.bear = b;
        // 🚀 부스터 불꽃 (허브 10): 부스터 칸을 볼 때만 뿜는다
        bst ||= new Booster(sc); bst.attach(b); bst.setStyle(L.look.booster | 0); };
      pv = { set: (e) => { eq = e; b.setCos(e); }, remake: make, flame: (i) => bst?.setStyle(i ?? (lookOf().look.booster | 0)) }; make(); let last = performance.now(), T = 0, alive = true; pv.stop = () => { alive = false; r.dispose(); };
      // 돌리기: 저절로 천천히 돌고, 단추로 멈추거나 끌어서 직접 돌린다
      const spinB = $('.cw-spin-b'); let auto = true, drag = null, yaw = 0; const label = () => { spinB.textContent = auto ? '⏸ 멈추기' : '▶ 돌리기'; };
      spinB.onclick = () => { auto = !auto; label(); };
      cv.onpointerdown = (e) => { drag = { x: e.clientX, yaw }; cv.setPointerCapture?.(e.pointerId); };
      cv.onpointermove = (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012; };
      cv.onpointerup = cv.onpointercancel = () => { drag = null; };
      pv.state = () => ({ auto, yaw, drag: !!drag });
      const loop = () => { if (!alive) return; const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; T += dt; if (auto && !drag) yaw += dt * 0.6; const bb = pv.bear; bb.root.rotation.y = yaw; bb.cosBoost = 1; bb.update(dt, 3, { noCrawl: true }); const bOn = S.tab !== 'look' && S.tab !== 'ach' && S.slot === 'boost'; if (bOn && !pv.wasB && !drag) { yaw = Math.PI + 0.55 + Math.round((yaw - Math.PI) / (Math.PI * 2)) * Math.PI * 2; } pv.wasB = bOn; bst?.update(dt, bOn ? 1 : 0, T); if ((T % 1.6) < dt) { bb.cos?.fire('jump'); bb.cos?.fire('land'); } r.render(sc, cam); requestAnimationFrame(loop); }; loop();
    } catch (e) { console.warn('미리보기', e); }
  };
  startPv();
  const close = async () => { if (dirty && confirm('바꾼 모습을 저장할까요?')) await saveLook(); creator?.close(); pv?.stop?.(); wrap.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }; addEventListener('keydown', onKey, true);
  $('.cw-x').onclick = close; wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  for (const b of $('.cw-tabs').children) b.onclick = () => { S.tab = b.dataset.t; S.slot = S.tab === 'shop' ? (SLOTS[S.slot]?.name && SHOP.some((x) => x.slot === S.slot) ? S.slot : 'aura') : S.slot; draw(); };
  // 모습 저장: 계정 캐릭터는 서버에, 이 기기 캐릭터는 이 기기에 (메인 화면 꾸미기와 같은 방식)
  async function saveLook() {
    if (!ch || !draft) return; const pr = creator.profile(); $('.cw-save') && ($('.cw-save').disabled = true);
    try {
      if (account.session && !isLocal(ch.token)) account.chars = (await account.api(`/api/chars/${ch.token}/look`, { method: 'POST', body: { color: pr.color, look: pr.look } })).chars;
      else updateLocal(ch.token, { color: pr.color, look: pr.look });
      ch = charList().find((c) => c.token === ch.token) || ch; dirty = false; opt.onLook?.(ch); onChange?.(C);
      const el = $('.cw-lfoot span'); if (el) el.textContent = '저장했어요 ✨ 모든 게임에서 이 모습으로 보여요';
    } catch (e) { msg(e.message); }
    $('.cw-save') && ($('.cw-save').disabled = false);
  }
  async function drawLook() {
    const box = $('.cw-look');
    if (!ch) { box.innerHTML = `<div class="cw-none">꾸밀 캐릭터가 아직 없어요<br><a href="/?create=1&back=${encodeURIComponent(location.pathname)}">＋ 새 캐릭터 만들기</a></div>`; return; }
    if (creator) return;
    box.innerHTML = `<div class="cw-ltabs"></div><div class="cw-lbody"></div><div class="cw-lfoot"><span>${esc(ch.name)} 의 모습 · 색 · 얼굴 · 옷을 바꿔요</span><button class="cw-rand">🎲 랜덤</button><button class="cw-save">저장하기 💾</button></div>`;
    const { Creator } = await import('./char-studio.js');
    creator = new Creator({ preview: null, tabs: box.querySelector('.cw-ltabs'), body: box.querySelector('.cw-lbody'), onDraft: (d) => { draft = d; dirty = true; box.querySelector('.cw-lfoot span').textContent = '저장하지 않은 모습이 있어요'; pv?.remake(); } });
    const p = ch.profile || {};
    creator.open({ name: ch.name, gender: p.gender, age: p.age, personality: p.personality, color: p.color, look: { ...(p.look || {}) }, accessories: p.accessories, starter: ch.starter || {} }, { edit: true });
    box.querySelector('.cw-rand').onclick = () => creator.randomize();
    box.querySelector('.cw-save').onclick = () => saveLook();
  }
  const chips = (list, cur, set) => { const el = $('.cw-chips'); el.innerHTML = list.map(([k, t]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join(''); for (const b of el.children) b.onclick = () => { set(b.dataset.k); draw(); }; };
  const card = (html, cls, click) => { const d = document.createElement('div'); d.className = `cw-it ${cls}`; d.innerHTML = html; if (click) d.onclick = click; return d; };
  const stars = (n) => `⭐ ${Number(n).toLocaleString()}`;
  function drawEq() {
    const e = C.equip || {}; $('.cw-eq').innerHTML = Object.entries(SLOTS).filter(([s]) => e[s]).map(([s, v]) => `${v.emoji} ${v.name}: <b>${esc(itemById.get(e[s])?.name || '')}</b>${SLOTS[s].auto ? '' : `<button data-off="${s}">벗기</button>`}`).join('<br>') || '<div style="text-align:center">아직 입은 게 없어요</div>';
    for (const b of $('.cw-eq').querySelectorAll('[data-off]')) b.onclick = () => post('/api/cos/equip', { slot: b.dataset.off, id: null });
  }
  // 🚀 부스터 불꽃 모양 (무료 · 지금 캐릭터 모습에 저장): 예전 모습 › 부스터 탭 (허브 10)
  async function setFlame(i) {
    if (!ch) return; const p = ch.profile || {}, look = { ...(p.look || {}), booster: i };
    try {
      if (account.session && !isLocal(ch.token)) account.chars = (await account.api(`/api/chars/${ch.token}/look`, { method: 'POST', body: { color: p.color, look } })).chars;
      else updateLocal(ch.token, { color: p.color, look });
      ch = charList().find((c) => c.token === ch.token) || ch; if (draft) draft.look.booster = i; opt.onLook?.(ch); onChange?.(C); pv?.remake(); draw();
    } catch (e) { msg(e.message); }
  }
  function boosterFlames(list) {
    const cur = (ch?.profile?.look?.booster) | 0;
    list.append(card(`<div class="cw-s">🔥 <b>불꽃 모양</b> · 무료 · ${ch ? esc(ch.name) + ' 에게 저장' : '캐릭터를 만들면 고를 수 있어요'} — 가속할 때 등 뒤로 뿜어요. 아래 ✨ 흩날리는 효과와 함께 나와요</div>`, 'cw-wide'));
    LOOK_PARTS.booster.options.forEach((name, i) => { const on = cur === i; const d = card(`<div class="cw-n">${esc(name)}</div><button class="cw-b" ${ch ? '' : 'disabled'}>${on ? '✅ 쓰는 중' : '고르기'}</button>`, `cw-mini ${on ? 'on' : ''}`);
      d.onmouseenter = () => pv?.flame(i); d.onmouseleave = () => pv?.flame(); d.querySelector('button').onclick = () => { if (!on) setFlame(i); }; list.append(d); });
    list.append(card(`<div class="cw-s">✨ <b>흩날리는 효과</b> · 별 상점에서 사요 · 모든 캐릭터가 같이 써요</div>`, 'cw-wide'));
  }
  function draw() {
    $('.cw-stars').textContent = stars(C.stars || 0); for (const b of $('.cw-tabs').children) b.classList.toggle('on', b.dataset.t === S.tab); drawEq();
    const list = $('.cw-list'); list.innerHTML = ''; const sum = $('.cw-sum'), isLook = S.tab === 'look';
    $('.cw-card').classList.toggle('look', isLook); $('.cw-look').style.display = isLook ? '' : 'none';
    for (const k of ['.cw-sum', '.cw-chips', '.cw-list']) $(k).style.display = isLook ? 'none' : '';
    if (isLook) { startPv(); drawLook(); return; }
    if (S.tab === 'ach') {
      const done = Object.keys(C.ach || {}).length; sum.innerHTML = `달성 ${done} / ${ACHIEVEMENTS.length}<div class="cw-bar"><i style="width:${(done / ACHIEVEMENTS.length) * 100}%"></i></div>`;
      chips([['all', '전체'], ['done', '✅ 달성'], ...(only ? [] : Object.entries(GAMES).map(([k, g]) => [k, `${g.emoji} ${g.name}`]))], S.game, (k) => { S.game = k; });
      const rows = ACHIEVEMENTS.filter((a) => !only || a.game === only).filter((a) => (S.game === 'all' ? true : S.game === 'done' ? C.ach?.[a.id] : a.game === S.game)).sort((a, b) => (!!C.ach?.[b.id] - !!C.ach?.[a.id]) || (TIERS[b.tier].n - TIERS[a.tier].n));
      for (const a of rows.slice(0, 180)) { const T = TIERS[a.tier], ok = !!C.ach?.[a.id], rw = [`🏷️ 칭호`, T.n >= 3 && '🎗️ 휘장', a.rule.crown && '👑 왕관', a.rule.pct && '🎖️ 메달'].filter(Boolean).join(' · '), g = GAMES[a.game]; list.append(card(`<div class="cw-n">${g?.emoji || '🏆'} ${esc(a.name)}</div><div class="cw-s">${esc(a.desc)}</div><div class="cw-r" style="color:${T.color}">${T.name} 등급 · ${rw}${ok ? ' · ✅' : ''}</div>`, ok ? '' : 'lock', null)); }
      if (rows.length > 180) list.append(card(`<div class="cw-s">게임을 골라 나머지 ${rows.length - 180}개를 볼 수 있어요</div>`, ''));
    } else if (S.tab === 'closet') {
      sum.textContent = '가진 치장은 모든 게임에서 보여요. 2D 게임에서는 칭호가 이름 옆에 빛나요';
      chips(Object.entries(SLOTS).map(([k, v]) => [k, `${v.emoji} ${v.name}`]), S.slot, (k) => { S.slot = k; });
      const mine = [...itemById.values()].filter((i) => i.slot === S.slot && owns(i)).sort((a, b) => S.slot === 'medal' ? a.fx.honor - b.fx.honor || b.fx.pr - a.fx.pr : 0);
      if (S.slot === 'medal') { list.append(card(`<div class="cw-s">🎖️ 메달은 고르지 않아도 돼요. 지금 가장 높은 순위 하나가 이름 옆에 저절로 붙어요 (🥇 1위 → 🥈 2위 → 🥉 3위 → 상위 1% → 5% → 10%, 같으면 더 어려운 순위표). 자리를 내주면 다음 메달로 바뀌어요</div>`, ''));
        for (const it of mine) list.append(card(`<div class="cw-n">${medalHtml(it.id)}</div><div class="cw-r">${C.equip?.medal === it.id ? '✅ 지금 붙어 있어요' : '지금 자리에 있어요'}</div>`, C.equip?.medal === it.id ? 'on' : ''));
        if (!mine.length) list.append(card(`<div class="cw-s">아직 없어요. 순위표 3위 안에 들거나 상위 10% 업적을 달성하면 생겨요</div>`, '')); return; }
      if (S.slot === 'boost') boosterFlames(list);
      if (!mine.length) list.append(card(`<div class="cw-s">아직 없어요. ${S.slot === 'boost' ? '흩날리는 효과는 별 상점에서 살 수 있어요' : SLOTS[S.slot].sub}${S.slot === 'crown' ? ' · 지금 1위인 순위표의 왕관만 쓸 수 있어요' : ['sash', 'title'].includes(S.slot) ? ' · 업적을 달성하면 얻어요 (1위 칭호는 1위인 동안만)' : S.slot === 'boost' ? '' : ' · 별 상점에서 살 수 있어요'}</div>`, ''));
      for (const it of mine) { const on = C.equip?.[S.slot] === it.id, rc = RARITY[it.rarity]?.color || TIERS[it.rarity]?.color; const d = card(`<div class="cw-n">${it.emoji} ${esc(it.name)}</div><div class="cw-r" style="color:${rc}">${RARITY[it.rarity]?.name || TIERS[it.rarity]?.name}</div>${it.top3 || it.top1 ? `<div class="cw-s">${it.top1 ? '' : '🏆 '}${esc(liveTrailText(it))}</div>` : ''}<button class="cw-b">${on ? '벗기' : '입기'}</button>`, on ? 'on' : ''); d.querySelector('button').onclick = () => post('/api/cos/equip', { slot: S.slot, id: on ? null : it.id }); list.append(d); }
    } else {
      sum.textContent = '별은 드림 러너를 달리면 모여요. 어려운 난이도와 랜덤 지옥일수록 많이 받아요';
      chips(Object.entries(SLOTS).filter(([k]) => SHOP.some((x) => x.slot === k)).map(([k, v]) => [k, `${v.emoji} ${v.name}`]), S.slot, (k) => { S.slot = k; });
      for (const it of SHOP.filter((i) => i.slot === S.slot).sort((a, b) => a.price - b.price)) {
        const has = owns(it), locked = it.req && (C.best?.[`${it.req.map}:${it.req.diff}`] || 0) < it.req.dist, poor = (C.stars || 0) < it.price, R = RARITY[it.rarity];
        const d = card(`<div class="cw-n">${it.emoji} ${esc(it.name)}</div><div class="cw-r" style="color:${R.color}">${R.name}</div><div class="cw-s">${it.req ? `🔒 ${esc(reqText(it.req))}` : ''}</div><button class="cw-b" ${has || locked || poor ? 'disabled' : ''}>${has ? '가지고 있어요' : locked ? `잠김 · ${stars(it.price)}` : stars(it.price)}</button>`, has ? 'on' : locked ? 'lock' : '');
        const preview = () => pv?.set(cleanCos({ ...(C.equip || {}), [it.slot]: it.id }) || {}); d.onmouseenter = preview; d.onmouseleave = () => pv?.set(C.equip); d.querySelector('button').onclick = (e) => { e.stopPropagation(); if (confirm(`${it.name} 을(를) ${it.price.toLocaleString()}개로 살까요?`)) post('/api/cos/buy', { id: it.id }); }; list.append(d);
      }
      // 최정상의 길 · 정상의 길: 별로 살 수 없다. 그 순위표에서 지금 1위 · 3위 안이면 바로 입을 수 있다
      if (S.slot === 'trail') for (const it of [...TOP3_TRAILS, ...TOP1_TRAILS]) { // 정상의 길 아래에 최정상의 길
        const has = owns(it), on = C.equip?.trail === it.id, R = RARITY[it.rarity], one = !!it.top1;
        const d = card(`<div class="cw-n">${it.emoji} ${esc(it.name)}</div><div class="cw-r" style="color:${R.color}">${R.name} · ${one ? '👑 초월 1위 전용' : '🏆 3위 안 전용'}</div><div class="cw-s">${esc(liveTrailText(it))}</div><button class="cw-b" ${has ? '' : 'disabled'}>${on ? '벗기' : has ? '입기' : one ? '🔒 지금 1위가 아니에요' : '🔒 지금 3위 밖'}</button>`, on ? 'on' : has ? '' : 'lock');
        d.onmouseenter = () => pv?.set(cleanCos({ ...(C.equip || {}), trail: it.id }) || {}); d.onmouseleave = () => pv?.set(C.equip);
        d.querySelector('button').onclick = (e) => { e.stopPropagation(); post('/api/cos/equip', { slot: 'trail', id: on ? null : it.id }); }; list.append(d);
      }
    }
  }
  draw();
}
