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
.at-stage{position:relative;height:196px;display:flex;align-items:center;justify-content:center;margin-top:8px}
.at-cap{width:96px;height:96px;border-radius:50%;background:linear-gradient(180deg,#ff8fc0 0 50%,#fff 50% 100%);border:3px solid rgba(255,255,255,.85);box-shadow:inset -8px -10px 0 rgba(0,0,0,.08),0 10px 24px rgba(0,0,0,.35);position:relative}
.at-cap::before{content:'';position:absolute;left:-3px;right:-3px;top:calc(50% - 4px);height:8px;background:#ffe27a;border-radius:4px}
.at-cap.shake{animation:atShake .14s ease-in-out infinite}
@keyframes atShake{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg) translateY(-3px)}}
.at-cap.pop{animation:atPop .35s ease-in forwards}
@keyframes atPop{to{transform:scale(1.6);opacity:0}}
.at-res{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;animation:atIn .4s cubic-bezier(.2,1.6,.4,1)}
.at-res .em{font-size:52px;filter:drop-shadow(0 0 14px var(--c))}
.at-res .nm{font-size:19px}.at-res .rr{font-size:13px;padding:2px 10px;border-radius:999px;background:var(--c);color:#1d1a33}
.at-res .sub{font-size:13px;color:#b9b3d6}
@keyframes atIn{from{transform:scale(.4);opacity:0}}
.at-odds{margin-top:10px;font-size:12px;line-height:1.6;color:#9d97bd}
.at-msg{min-height:18px;font-size:13px;color:#ff9b9b;margin-top:6px;text-align:center}
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
export async function openAttend(opt = {}) {
  css();
  const wrap = document.createElement('div'); wrap.className = 'at-wrap';
  wrap.innerHTML = `<div class="at-card"><div class="at-head"><h2>📅 출석체크</h2><button class="at-x">✕</button></div>
    <div class="at-sec"><div class="at-streak"></div><div class="at-week"></div><button class="at-btn at-go">출석하기</button></div>
    <div class="at-hr"></div>
    <div class="at-sec"><div class="at-tk">🎟️ 기본 치장 뽑기권 <span class="n">0장</span></div>
      <div class="at-stage"><div class="at-cap"></div></div>
      <button class="at-btn pink at-pull">뽑기</button><div class="at-msg"></div>
      <div class="at-odds">치장 25% (일반 80% · 희귀 18% · 영웅 2%) · 별 75% (30 ~ 80개)<br>이미 가진 치장이 나오면 그 값의 절반을 별로 돌려받아요. 7일 연속 출석하면 뽑기권을 1장 더 줘요.</div></div></div>`;
  document.body.append(wrap);
  const $ = (s) => wrap.querySelector(s), close = () => { wrap.remove(); opt.onClose?.(); };
  $('.at-x').onclick = close; wrap.onclick = (e) => { if (e.target === wrap) close(); };
  let me = null, busy = false;
  const render = () => {
    const A = me.att, done = A.last === A.today, days = new Set(A.log || []);
    $('.at-streak').textContent = A.streak ? `🔥 ${A.streak}일 연속 출석 · 모두 ${A.days}일` : '오늘 첫 출석을 해 보세요';
    $('.at-week').innerHTML = week(A.today).map((d, i) => `<div class="at-d${days.has(d) ? ' on' : ''}${d === A.today ? ' today' : ''}"><span>${'월화수목금토일'[i]}</span><b>${+d.slice(8)}</b></div>`).join('');
    const go = $('.at-go'); go.disabled = done; go.textContent = done ? '오늘 출석 완료 · 내일 또 와요' : '출석하기 · 뽑기권 받기';
    $('.at-tk .n').textContent = `${me.tickets || 0}장`; $('.at-pull').disabled = !(me.tickets > 0) || busy;
  };
  const msg = (t) => { $('.at-msg').textContent = t || ''; };
  try { me = await account.api('/api/cos/me' + qs()); render(); } catch { msg('불러오지 못했어요. 잠시 뒤 다시 열어 주세요'); return; }
  $('.at-go').onclick = async () => {
    if (busy) return; busy = true; msg('');
    try { const r = await api('/api/cos/attend', {}); me = r.me; render(); const d = wrap.querySelector('.at-d.today'); d?.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,1.6,.4,1)' }); msg(''); $('.at-msg').style.color = '#ffe27a'; $('.at-msg').textContent = r.got > 1 ? `🎉 ${r.streak}일 연속! 뽑기권 ${r.got}장을 받았어요` : '🎟️ 뽑기권 1장을 받았어요'; }
    catch (e) { $('.at-msg').style.color = ''; msg(e.message); }
    busy = false; render();
  };
  $('.at-pull').onclick = async () => {
    if (busy || !(me.tickets > 0)) return; busy = true; render(); $('.at-msg').style.color = ''; msg('');
    const stage = $('.at-stage'); stage.querySelector('.at-res')?.remove(); let cap = stage.querySelector('.at-cap'); if (!cap) { cap = document.createElement('div'); cap.className = 'at-cap'; stage.append(cap); }
    cap.className = 'at-cap shake';
    let r; try { [r] = await Promise.all([api('/api/cos/gacha', {}), new Promise((ok) => setTimeout(ok, 1100))]); } catch (e) { cap.className = 'at-cap'; msg(e.message); busy = false; render(); return; }
    cap.className = 'at-cap pop'; await new Promise((ok) => setTimeout(ok, 330)); cap.remove();
    me = r.me; const res = document.createElement('div'); res.className = 'at-res';
    if (r.kind === 'item') {
      const it = itemById.get(r.id), R = RARITY[it?.rarity] || RARITY.common;
      res.style.setProperty('--c', R.color);
      res.innerHTML = `<div class="em">${it?.emoji || '🎁'}</div><div class="nm">${esc(it?.name || r.id)}</div><span class="rr">${R.name}</span><div class="sub">${r.dup ? `이미 가진 치장이라 ⭐ ${r.stars}개로 바꿨어요` : '옷장에 넣었어요'}</div>`;
      if (!r.dup) { const b = document.createElement('button'); b.className = 'at-btn'; b.style.cssText = 'width:auto;padding:7px 18px;font-size:15px;margin-top:6px'; b.textContent = '👕 입어 보기'; b.onclick = () => { close(); opt.onTry?.(r.id); }; res.append(b); }
    } else { res.style.setProperty('--c', '#ffc93c'); res.innerHTML = `<div class="em">⭐</div><div class="nm">별 ${r.stars}개</div><div class="sub">별 상점에서 쓸 수 있어요</div>`; }
    stage.append(res); busy = false; render(); opt.onChange?.();
  };
}
// 오늘 아직 출석 안 했는지 (머리 단추에 점 표시용)
export async function attendPending() {
  try { const me = await account.api('/api/cos/me' + qs()); return me.att?.last !== me.att?.today; } catch { return false; }
}
