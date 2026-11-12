// 사이트 출석체크 · 기본 치장 뽑기 창 (메인 화면 머리 단추 📅 출석)
//   하루 한 번 출석 → 뽑기권 1장 (7일 연속마다 1장 더). 뽑기는 서버가 정한다 (/api/cos/attend · /api/cos/gacha)
import { account } from './account.js';
import { anonId } from './ranking.js';
import { itemById, RARITY } from './cos-items.js';

const CSS = `
.at-wrap{position:fixed;inset:0;z-index:100002;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(8,6,20,.78);font-family:'Jua','Noto Sans KR',sans-serif;color:#fff}
.at-card{width:min(460px,100%);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#2a2350,#1d1a33 55%);border:2px solid rgba(255,255,255,.14);border-radius:22px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.at-head{display:flex;align-items:center;gap:10px;padding:14px 18px 6px}.at-head h2{margin:0;flex:1;font-size:22px;font-weight:normal}
.at-x{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-size:16px;cursor:pointer}
.at-sec{padding:10px 18px 14px}
.at-streak{font-size:15px;color:#ffe27a;margin:2px 0 10px}
.at-week{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.at-d{position:relative;aspect-ratio:1/1.15;border-radius:12px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.08);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;color:#b9b3d6}
.at-d b{font-size:16px;color:#fff;font-weight:normal}
.at-d.on{background:radial-gradient(circle at 50% 40%,rgba(255,201,60,.35),rgba(255,140,90,.12));border-color:#ffc93c}
.at-d.on::after{content:'🐻';position:absolute;font-size:22px;bottom:4px;opacity:.95;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
.at-d.on b{opacity:.45}
.at-d.today{border-color:#ff8fc0;box-shadow:0 0 0 2px rgba(255,143,192,.35),0 0 18px rgba(255,143,192,.35);animation:atPulse 1.6s ease-in-out infinite}
.at-d.today.on{animation:none}
@keyframes atPulse{50%{box-shadow:0 0 0 2px rgba(255,143,192,.55),0 0 26px rgba(255,143,192,.55)}}
.at-btn{width:100%;margin-top:12px;padding:13px 0;border:0;border-radius:14px;font:inherit;font-size:19px;color:#2b1a00;background:linear-gradient(180deg,#ffe27a,#ffb83c);box-shadow:0 4px 0 #c47f12;cursor:pointer}
.at-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #c47f12}
.at-btn[disabled],.at-btn.pink[disabled]{background:rgba(255,255,255,.12);color:#b9b3d6;box-shadow:none;cursor:default}
.at-btn.pink{background:linear-gradient(180deg,#ff9fd0,#ff5c9d);color:#fff;box-shadow:0 4px 0 #b8336c}
.at-hr{height:1px;margin:0 18px;background:rgba(255,255,255,.1)}
.at-tk{display:flex;align-items:center;gap:10px;font-size:17px}.at-tk .n{margin-left:auto;padding:4px 12px;border-radius:999px;background:rgba(255,143,192,.18);color:#ffc2dc}
.at-stage{display:none;gap:10px;justify-content:center;padding:4px 18px 0}.at-stage.open{display:flex}.at-slot{position:relative;flex:1;max-width:210px;height:200px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.08),transparent 70%)}
.at-cap{width:96px;height:96px;border-radius:50%;background:linear-gradient(180deg,var(--ca,#ff8fc0) 0 25%,var(--cb,#ff5c9d) 50%,#fff 50% 100%);border:3px solid rgba(255,255,255,.85);box-shadow:inset -8px -10px 0 rgba(0,0,0,.08),0 10px 24px rgba(0,0,0,.35);position:relative}
.at-cap::before{content:'';position:absolute;left:-3px;right:-3px;top:calc(50% - 4px);height:8px;background:#ffe27a;border-radius:4px}
.at-cap.shake{animation:atShake .14s ease-in-out infinite}
@keyframes atShake{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg) translateY(-3px)}}
.at-cap.pop{animation:atPop .35s ease-in forwards}
@keyframes atPop{to{transform:scale(1.6);opacity:0}}
.at-res{position:absolute;inset:0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;animation:atIn .4s cubic-bezier(.2,1.6,.4,1)}
.at-res .em{font-size:52px;filter:drop-shadow(0 0 14px var(--c))}
.at-res .nm{font-size:19px}.at-res .rr{font-size:13px;padding:2px 10px;border-radius:999px;background:var(--c);color:#1d1a33}
.at-res .sub{font-size:13px;color:#b9b3d6}
@keyframes atIn{from{transform:scale(.4);opacity:0}}
.at-odds{margin-top:10px;font-size:12px;line-height:1.6;color:#9d97bd}
.at-msg{min-height:18px;font-size:13px;color:#ff9b9b;margin-top:6px;text-align:center}
.at-cap.rb{background:conic-gradient(from 0deg,#ff7ab8,#ffd27a,#7fffb0,#7fe9ff,#b28bff,#ff7ab8);animation:atShake .14s ease-in-out infinite,atHue 1s linear infinite}
@keyframes atHue{to{filter:hue-rotate(360deg)}}
.at-tier{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-4px 0 10px}.at-tier small{color:#b9b3d6;font-size:13px}
.tb{padding:4px 12px;border-radius:999px;font-size:15px;color:#1d1a33}.tb-basic{background:linear-gradient(90deg,#ffb3d6,#ff8fc0)}.tb-silver{background:linear-gradient(90deg,#f2f6fb,#b9c6d8)}.tb-gold{background:linear-gradient(90deg,#fff0a0,#ffc93c)}.tb-rainbow{background:linear-gradient(90deg,#ff9fd0,#ffe27a,#9fffd0,#9fe9ff,#c9a8ff);background-size:200% 100%;animation:atSlide 3s linear infinite}
@keyframes atSlide{to{background-position:200% 0}}
.at-tbl{display:grid;gap:4px;font-size:13px}.at-tbl .tr{display:grid;grid-template-columns:1.25fr .6fr .8fr 2fr;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.04);align-items:center}.at-tbl .tr.cur{background:rgba(255,201,60,.14);outline:1px solid rgba(255,201,60,.5)}.at-tbl .dim{color:#9d97bd;font-size:12px}
.at-try{margin-top:6px;padding:6px 14px;border:0;border-radius:12px;font:inherit;font-size:14px;color:#2b1a00;background:linear-gradient(180deg,#ffe27a,#ffb83c);box-shadow:0 3px 0 #c47f12;cursor:pointer}
.at-left .at-tk{margin-top:12px}.at-pull{padding:6px 14px;border:0;border-radius:12px;font:inherit;font-size:14px;color:#fff;background:linear-gradient(180deg,#ff9fd0,#ff5c9d);cursor:pointer}.at-pull[disabled]{opacity:.5}
@media (max-width:420px){.at-tbl .tr{grid-template-columns:1.2fr .6fr .8fr}.at-tbl .dim{grid-column:1/-1}.at-slot{height:186px}}
`;
let cssOn = false;
const css = () => { if (cssOn) return; cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const who = () => (account.session ? {} : { anon: anonId() });
const qs = () => (account.session ? '' : `?anon=${anonId()}`);
const api = (p, body) => account.api(p, body ? { method: 'POST', body: { ...who(), ...body } } : undefined);
// 이번 주 (월 ~ 일) 한국 날짜 7개
function week(today) {
  const t = Date.parse(today + 'T00:00:00Z'), dow = (new Date(t).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(t + (i - dow) * 864e5).toISOString().slice(0, 10));
}
const TCOL = { basic: ['#ff8fc0', '#ff5c9d'], silver: ['#e8eef7', '#9fb0c8'], gold: ['#ffe27a', '#e0a020'], rainbow: ['#ff7ab8', '#7fe9ff'] };
const pct = (x) => `${Math.round(x * 100)}%`;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// 결과 카드 한 장
function card(r, opt, close) {
  const res = document.createElement('div'); res.className = 'at-res';
  if (r.kind === 'item') {
    const it = itemById.get(r.id), R = RARITY[it?.rarity] || RARITY.common; res.style.setProperty('--c', R.color);
    res.innerHTML = `<div class="em">${it?.emoji || '🎁'}</div><div class="nm">${esc(it?.name || r.id)}</div><span class="rr">${R.name}</span><div class="sub">${r.dup ? `이미 있어서 ⭐ ${r.stars}개로` : '옷장에 넣었어요'}</div>`;
    if (!r.dup) { const b = document.createElement('button'); b.className = 'at-try'; b.textContent = '👕 입어 보기'; b.onclick = () => { close(); opt.onTry?.(r.id); }; res.append(b); }
  } else { res.style.setProperty('--c', '#ffc93c'); res.innerHTML = `<div class="em">⭐</div><div class="nm">별 ${r.stars}개</div><div class="sub">별 상점에서 써요</div>`; }
  return res;
}
// 캡슐 하나 흔들고 열어 결과를 보여 준다 (slot = 그 자리)
async function reveal(slot, tierId, r, opt, close) {
  const [a, b] = TCOL[tierId] || TCOL.basic, cap = document.createElement('div'); cap.className = 'at-cap shake' + (tierId === 'rainbow' ? ' rb' : '');
  cap.style.setProperty('--ca', a); cap.style.setProperty('--cb', b); slot.innerHTML = ''; slot.append(cap);
  await wait(1050); cap.className = cap.className.replace('shake', 'pop'); await wait(320); cap.remove(); slot.append(card(r, opt, close));
}
export async function openAttend(opt = {}) {
  css();
  const wrap = document.createElement('div'); wrap.className = 'at-wrap';
  wrap.innerHTML = `<div class="at-card"><div class="at-head"><h2>📅 출석체크</h2><button class="at-x">✕</button></div>
    <div class="at-sec"><div class="at-streak"></div><div class="at-tier"></div><div class="at-week"></div><button class="at-btn at-go">출석하기</button></div>
    <div class="at-stage"></div><div class="at-msg"></div>
    <div class="at-sec"><div class="at-tbl"></div><div class="at-odds">치장은 별 상점의 기록 조건 없는 물건에서 나와요. 치장이 아니면 별을 받아요. 이미 가진 치장이 나오면 그 값의 절반을 별로 돌려받아요. 7일 연속마다 그날은 두 번 뽑아요.</div>
      <div class="at-left"></div></div></div>`;
  document.body.append(wrap);
  let me = null, busy = false;
  const $ = (q) => wrap.querySelector(q), close = () => { wrap.remove(); opt.onClose?.(); };
  $('.at-x').onclick = close; wrap.onclick = (e) => { if (e.target === wrap && !busy) close(); };
  const tierOf = (n) => [...(me.gtiers || [])].reverse().find((t) => n >= t.from) || me.gtiers?.[0];
  const msg = (t, ok) => { const m = $('.at-msg'); m.textContent = t || ''; m.style.color = ok ? '#ffe27a' : ''; };
  const render = () => {
    const A = me.att, done = A.last === A.today, days = new Set(A.log || []), n = done ? A.streak : A.would, T = tierOf(n), nx = (me.gtiers || []).find((t) => t.from > n);
    $('.at-streak').textContent = A.streak ? `🔥 ${A.streak}일 연속 출석 · 모두 ${A.days}일` : '오늘 첫 출석을 해 보세요';
    $('.at-tier').innerHTML = T ? `<span class="tb tb-${T.id}">${T.emoji} ${done ? '오늘 뽑은' : '오늘 받을'} ${esc(T.name)}</span>${nx ? `<small>${nx.emoji} ${esc(nx.name)}까지 ${nx.from - n}일</small>` : '<small>가장 귀한 뽑기예요</small>'}` : '';
    $('.at-week').innerHTML = week(A.today).map((d, i) => `<div class="at-d${days.has(d) ? ' on' : ''}${d === A.today ? ' today' : ''}"><span>${'월화수목금토일'[i]}</span><b>${+d.slice(8)}</b></div>`).join('');
    const go = $('.at-go'); go.disabled = done || busy; go.textContent = done ? '오늘 출석 완료 · 내일 또 와요' : `출석하고 ${T ? T.name : '뽑기'}`;
    $('.at-tbl').innerHTML = (me.gtiers || []).map((t) => `<div class="tr${t.id === T?.id ? ' cur' : ''}"><span>${t.emoji} ${esc(t.name)}</span><span>${t.from}일~</span><span>치장 ${pct(t.item)}</span><span class="dim">${t.tiers[0] ? `일반 ${pct(t.tiers[0])} · ` : ''}희귀 ${pct(t.tiers[1])} · 영웅 ${pct(t.tiers[2])}</span></div>`).join('');
    const L = $('.at-left'); L.innerHTML = me.tickets > 0 ? `<div class="at-tk">🎟️ 남은 뽑기권 <span class="n">${me.tickets}장</span><button class="at-pull"${busy ? ' disabled' : ''}>기본 뽑기</button></div>` : '';
    const pb = L.querySelector('.at-pull'); if (pb) pb.onclick = pullLeft;
  };
  // 출석 누름: 오늘 칸에 도장 → 곧바로 캡슐 → 결과 (두 번 뽑는 날은 둘이 차례로)
  const go = async () => {
    if (busy) return; busy = true; msg(''); render();
    let r; try { r = await api('/api/cos/attend', {}); } catch (e) { busy = false; msg(e.message); render(); return; }
    me = r.me; render(); wrap.querySelector('.at-d.today')?.animate([{ transform: 'scale(1.35) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    if (r.draws.length > 1) msg(`🎉 ${r.streak}일 연속! 오늘은 두 번 뽑아요`, true);
    const stage = $('.at-stage'); stage.innerHTML = ''; stage.classList.add('open');
    const slots = r.draws.map(() => { const d = document.createElement('div'); d.className = 'at-slot'; stage.append(d); return d; });
    await wait(450); for (let k = 0; k < r.draws.length; k++) await reveal(slots[k], r.tier, r.draws[k], opt, close);
    busy = false; render(); opt.onChange?.();
  };
  // 예전에 받아 둔 뽑기권 (기본 뽑기)
  const pullLeft = async () => {
    if (busy || !(me.tickets > 0)) return; busy = true; render(); msg('');
    const stage = $('.at-stage'); stage.innerHTML = ''; stage.classList.add('open'); const slot = document.createElement('div'); slot.className = 'at-slot'; stage.append(slot);
    let r; try { r = await api('/api/cos/gacha', {}); } catch (e) { busy = false; msg(e.message); render(); return; }
    await reveal(slot, 'basic', r, opt, close); me = r.me; busy = false; render(); opt.onChange?.();
  };
  $('.at-go').onclick = go;
  try { me = await account.api('/api/cos/me' + qs()); render(); } catch { msg('불러오지 못했어요. 잠시 뒤 다시 열어 주세요'); }
}
// 오늘 아직 출석 안 했는지 (머리 단추에 점 표시용)
export async function attendPending() {
  try { const me = await account.api('/api/cos/me' + qs()); return me.att?.last !== me.att?.today ? me.att.today : false; } catch { return false; }
}
