// 운영자 비상 리포트: 조작(AI) 의심 기록을 접속하자마자 크게 띄운다 (기록은 이미 순위표에 올라가 있다)
//   ✅ 정상 인정 · 🗑️ 삭제(별 · 업적 몰수) · ⏭️ 넘기기. '나중에' 로 닫으면 다음 접속 때 다시 뜬다
import { account } from './account.js';

const DIFF = { easy: '🙂 노멀', hard: '🔥 하드', extreme: '💀 익스트림', lightspeed: '⚡ 광속', beyond: '🌌 초월' };
const WHY = {
  mismatch: '서버가 입력을 다시 돌려 본 결과와 다름', slowmo: '게임을 느리게 돌린 것 같음 (게임 속 시간이 실제로 지난 시간보다 한참 짧음)', time: '실제로 지난 시간보다 긴 기록', noreplay: '입력 기록 없이 올라옴',
  jump: '재생은 맞지만 기존 1위를 갑자기 크게 앞섬 (진짜 키를 누르는 프로그램일 수 있어요)',
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
const CSS = `.aa-wrap{position:fixed;inset:0;z-index:100010;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(40,0,8,.82);font-family:'Jua','Noto Sans KR',sans-serif;color:#fff}
.aa-card{width:min(860px,100%);max-height:90vh;display:flex;flex-direction:column;background:#1d1424;border:3px solid #ff3b4d;border-radius:18px;box-shadow:0 0 50px rgba(255,59,77,.6);animation:aaPulse 1.6s ease-in-out infinite alternate}
@keyframes aaPulse{to{box-shadow:0 0 90px rgba(255,59,77,.95)}}
.aa-head{display:flex;align-items:center;gap:10px;padding:14px 18px;background:linear-gradient(90deg,#ff3b4d,#b3122a);border-radius:14px 14px 0 0}.aa-head h2{flex:1;margin:0;font-size:22px;font-weight:normal}
.aa-sub{padding:8px 18px;font-size:13px;color:#ffc9cf;font-family:'Noto Sans KR',sans-serif}
.aa-list{overflow-y:auto;padding:0 14px 14px;display:flex;flex-direction:column;gap:8px}
.aa-row{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);border-left:5px solid #ff3b4d}.aa-row.yellow{border-left-color:#ffc93c}
.aa-t{font-size:17px}.aa-t small{color:#c9b8cf;font-size:13px}.aa-w{margin:3px 0 7px;font-size:13px;color:#ffd0d5;font-family:'Noto Sans KR',sans-serif}.aa-row.yellow .aa-w{color:#ffe7a0}
.aa-b{display:flex;gap:6px;flex-wrap:wrap}.aa-b button,.aa-x{padding:6px 12px;border:0;border-radius:9px;font:inherit;font-size:14px;cursor:pointer}.aa-ok{background:#5fe0b0;color:#08261a}.aa-del{background:#ff3b4d;color:#fff}.aa-skip{background:rgba(255,255,255,.14);color:#fff}.aa-x{background:rgba(0,0,0,.25);color:#fff}`;

export function reportRow(x) {
  const lvl = x.lvl === 'yellow' ? '🟡 검토 권장' : '🔴 조작 의심', where = `드림 러너 ${x.map === 'hell' ? '🔥 지옥' : x.map === 'void' ? '🌌 이공간' : '🌙 꿈나라'} ${DIFF[x.diff] || x.diff}${x.mode === 'item' ? ' 아이템전' : ''}`;
  const detail = x.why === 'mismatch' && x.r ? ` · 보낸 기록 ${x.dist}m ★${x.stars} / 다시 돌린 결과 ${x.r.dist}m ★${x.r.stars}` : x.why === 'slowmo' && x.real ? ` · 게임 속 ${x.game}초 / 실제 ${x.real}초` : x.why === 'jump' && x.prevTop ? ` · 기존 1위 ${x.prevTop.toLocaleString()}점 → ${x.score.toLocaleString()}점 (${(x.score / x.prevTop).toFixed(1)}배)` : '';
  return `<div class="aa-row ${x.lvl === 'yellow' ? 'yellow' : ''}"><div class="aa-t">${lvl} · <b>${esc(x.name)}</b> ${x.score.toLocaleString()}점 <small>${where} · ${x.dist.toLocaleString()}m · ⭐${x.stars} · ${x.time}초 · ${ago(x.at)}${x.live ? '' : ' · (이미 다른 기록으로 바뀜)'}</small></div>
    <div class="aa-w">${esc(WHY[x.why] || x.why)}${detail}</div>
    <div class="aa-b"><button class="aa-ok" data-ok="${esc(x.id)}">✅ 정상 인정</button><button class="aa-del" data-del="${esc(x.id)}">🗑️ 기록 삭제 · 별 몰수</button><button class="aa-skip" data-skip="${esc(x.id)}">⏭️ 넘기기</button></div></div>`;
}
// 버튼 달기 (순위표 운영자 칸에서도 쓴다). after(새 목록) 로 다시 그린다
export function bindReports(el, after) {
  const go = (act, id) => account.api('/api/dream/admin/resolve', { method: 'POST', body: { id, act } }).then(() => account.api('/api/dream/admin/list')).then(after).catch((e) => alert(e.message));
  for (const b of el.querySelectorAll('[data-ok]')) b.onclick = () => go('ok', b.dataset.ok);
  for (const b of el.querySelectorAll('[data-del]')) b.onclick = () => { if (confirm('이 기록을 지우고 이 사람의 드림 러너 업적과 별을 거둘까요?')) go('del', b.dataset.del); };
  for (const b of el.querySelectorAll('[data-skip]')) b.onclick = () => go('skip', b.dataset.skip);
}
let shown = false;
export async function adminAlert() {
  if (shown || !account.admin) return; shown = true;
  let d; try { d = await account.api('/api/dream/admin/list'); } catch { return; }
  if (!d.reports?.length) return;
  if (!document.getElementById('aa-css')) { const s = document.createElement('style'); s.id = 'aa-css'; s.textContent = CSS; document.head.append(s); }
  const wrap = document.createElement('div'); wrap.className = 'aa-wrap'; document.body.append(wrap);
  const draw = (d) => {
    if (!d.reports.length) { wrap.remove(); return; }
    const red = d.reports.filter((x) => x.lvl !== 'yellow').length;
    wrap.innerHTML = `<div class="aa-card"><div class="aa-head"><h2>🚨 비상 리포트 ${d.reports.length}건${red ? ` · 조작 의심 ${red}` : ''}</h2><button class="aa-x">나중에</button></div><div class="aa-sub">기록은 이미 순위표에 올라가 있어요. 조작으로 보이면 삭제하고, 정상이면 인정해 주세요 (인정하면 업적 · 왕관도 받아요)</div><div class="aa-list">${d.reports.map(reportRow).join('')}</div></div>`;
    wrap.querySelector('.aa-x').onclick = () => wrap.remove();
    bindReports(wrap, draw);
  };
  draw(d);
}
