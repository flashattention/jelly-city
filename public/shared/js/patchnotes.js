// 패치노트 창: 게임 안에서는 그 게임 기록을, 메인에서는 모든 게임 기록을 본다 (기록은 /shared/patchnotes.json, tools/patchnotes.mjs 가 쌓는다)
const NAMES = { all: '🎮 공통', 'jelly-city': '🏙️ 젤리시티', 'dream-runner': '🌙 드림 러너', 'jelly-rumble': '🎪 젤리대소동', 'jelly-merge': '🍬 젤리 머지', 'jelly-arena': '⚔️ 젤리 아레나', 'jelly-hide': '🫥 젤리 숨바꼭질', 'jelly-slide': '🧩 젤리 슬라이드', 'jelly-court': '👑 젤리궁정', 'jelly-ding': '🔔 젤리 땡', 'jelly-guard': '⚡ 젤리수호대', 'jelly-tactical': '🔫 젤리택티컬', 'jelly-drop': '🪂 젤리드롭', 'jelly-drift': '🏎️ 젤리드리프트', 'jelly-ten': '🔟 젤리텐', 'jelly-word': '🔤 젤리 끝말잇기', 'jelly-draw': '🖍️ 젤리 그림릴레이', 'jelly-type': '⌨️ 젤리 타자연습', 'jelly-sketch': '🎨 젤리 스케치퀴즈', 'jelly-survivor': '🦷 젤리 서바이버' };
const TAG = { new: ['새로워요', '#5fd36a'], up: ['좋아졌어요', '#4cc3ff'], fix: ['고쳤어요', '#ffb347'] };
const CSS = `
.pn-wrap { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(10,12,24,.72); font-family: 'Jua', 'Noto Sans KR', sans-serif; color: #fff; }
.pn-card { scrollbar-color: #5a6080 transparent; scrollbar-width: thin; width: min(720px, 100%); max-height: min(86vh, 900px); display: flex; flex-direction: column; background: #23263a; border: 2px solid #4a5068; border-radius: 18px; overflow: hidden; }
.pn-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px; } .pn-head h2 { flex: 1; margin: 0; font-size: 22px; font-weight: normal; }
.pn-x { width: 36px; height: 36px; border: 0; border-radius: 10px; background: rgba(255,255,255,.1); color: #fff; font-size: 16px; cursor: pointer; }
.pn-chips { display: flex; gap: 6px; padding: 0 16px 10px; overflow-x: auto; flex: none; scrollbar-width: thin; } .pn-chips button { flex: none; padding: 5px 11px; border: 1px solid transparent; border-radius: 999px; background: rgba(255,255,255,.09); color: #fff; font: inherit; font-size: 14px; cursor: pointer; } .pn-chips button.on { background: #ffd76a; color: #2a2030; }
.pn-list { flex: 1; overflow-y: auto; padding: 2px 16px 16px; text-align: left; }
.pn-date { margin: 14px 0 6px; color: #aab0c8; font-size: 14px; }
.pn-note { margin-bottom: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.06); }
.pn-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 16px; line-height: 1.35; } .pn-tag { padding: 1px 7px; border-radius: 6px; color: #1c1c28; font-size: 12px; } .pn-g { color: #aab0c8; font-size: 12px; }
.pn-note ul { margin: 6px 0 0; padding-left: 18px; color: #d5d8e6; font-size: 14px; line-height: 1.5; font-family: 'Noto Sans KR', sans-serif; }
.pn-foot { display: flex; justify-content: space-between; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid rgba(255,255,255,.1); } .pn-foot button { padding: 8px 16px; border: 0; border-radius: 999px; font: inherit; font-size: 15px; cursor: pointer; } .pn-more { background: rgba(255,255,255,.1); color: #fff; } .pn-ok { background: #ffd76a; color: #2a2030; }
.pn-empty { padding: 30px 0; text-align: center; color: #aab0c8; }`;
let data = null;
const load = async () => (data ||= await (await fetch('/shared/patchnotes.json', { cache: 'no-cache' })).json());
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const SEEN_KEY = 'jelly.patchSeen';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const writeSeen = (v) => { try { localStorage.setItem(SEEN_KEY, v); } catch { /* 저장 못 해도 창은 닫힌다 */ } };
function ensureCss() { if (!document.getElementById('pn-css')) { const s = el('style', '', CSS); s.id = 'pn-css'; document.head.append(s); } }
function noteBox(n) {
  const box = el('div', 'pn-note'), top = el('div', 'pn-top'), [label, col] = TAG[n.t] || TAG.up, tag = el('span', 'pn-tag', label); tag.style.background = col;
  top.append(tag, el('span', '', n.title), el('span', 'pn-g', n.g.map((g) => NAMES[g] || g).join(' · '))); box.append(top);
  if (n.items.length) { const ul = el('ul'); for (const it of n.items) ul.append(el('li', '', it)); box.append(ul); }
  return box;
}
// 메인에 들어올 때: 마지막으로 본 뒤 바뀐 것만 가운데 창으로 (처음 온 사람은 최근 것만, 새것이 없으면 안 뜬다)
export async function showWhatsNew() {
  let d; try { d = await load(); } catch { return; }
  const notes = d.notes || [], latest = notes[0]?.c?.[0]; if (!latest || readSeen() === latest || document.querySelector('.pn-wrap')) return;
  const at = notes.findIndex((n) => n.c?.includes(readSeen()));
  const fresh = at > 0 ? notes.slice(0, at) : notes.filter((n) => n.d === notes[0].d).slice(0, 6);
  ensureCss();
  const wrap = el('div', 'pn-wrap'), card = el('div', 'pn-card'), head = el('div', 'pn-head'), list = el('div', 'pn-list'), foot = el('div', 'pn-foot');
  const x = el('button', 'pn-x', '✕'), all = el('button', 'pn-more', '📜 전체 패치노트'), ok = el('button', 'pn-ok', '확인');
  head.append(el('h2', '', '🎉 새로워졌어요'), x); foot.append(all, ok); card.append(head, list, foot); wrap.append(card); document.body.append(wrap);
  for (const [day, group] of Object.entries(Object.groupBy ? Object.groupBy(fresh, (n) => n.d) : fresh.reduce((a, n) => { (a[n.d] ||= []).push(n); return a; }, {}))) { list.append(el('div', 'pn-date', day.replaceAll('-', '. '))); for (const n of group) list.append(noteBox(n)); }
  const close = () => { writeSeen(latest); wrap.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  addEventListener('keydown', onKey, true);
  x.onclick = close; ok.onclick = close; all.onclick = () => { close(); openPatchNotes(null); }; wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
}
// 지금 페이지의 게임 (메인이면 null)
export const pageGame = () => (NAMES[location.pathname.split('/')[1]] ? location.pathname.split('/')[1] : null);
export async function openPatchNotes(game = pageGame()) {
  if (document.querySelector('.pn-wrap')) return;
  ensureCss();
  if (document.pointerLockElement) document.exitPointerLock();
  const wrap = el('div', 'pn-wrap'), card = el('div', 'pn-card'), head = el('div', 'pn-head'), chips = el('div', 'pn-chips'), list = el('div', 'pn-list');
  const x = el('button', 'pn-x', '✕'), h = el('h2', '', '📜 패치노트'); head.append(h, x); card.append(head, chips, list); wrap.append(card); document.body.append(wrap);
  let cur = game || '*';
  const close = () => { wrap.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { e.stopImmediatePropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } }; // 뒤의 게임이 키를 받지 않게
  addEventListener('keydown', onKey, true);
  x.onclick = close; wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  const draw = () => {
    chips.replaceChildren(...['*', ...Object.keys(NAMES)].map((k) => { const b = el('button', k === cur ? 'on' : '', k === '*' ? '전체' : NAMES[k]); b.onclick = () => { cur = k; draw(); }; return b; }));
    const notes = (data?.notes || []).filter((n) => cur === '*' || n.g.includes(cur) || (cur !== 'all' && game === cur && n.g.includes('all')));
    list.replaceChildren(); let day = null;
    if (!notes.length) list.append(el('div', 'pn-empty', data ? '아직 기록이 없어요' : '불러오는 중…'));
    for (const n of notes) {
      if (n.d !== day) { day = n.d; list.append(el('div', 'pn-date', day.replaceAll('-', '. '))); }
      list.append(noteBox(n));
    }
    chips.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  draw();
  try { await load(); } catch { list.replaceChildren(el('div', 'pn-empty', '기록을 불러오지 못했어요')); return; }
  if (wrap.isConnected) draw();
}
