// 메인 화면 맨 위 게시판: 글 목록 · 글 보기 · 글쓰기 · 댓글 · 좋아요/싫어요
import { account } from '/shared/js/account.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const logged = () => !!account.session && !!account.user;
const ago = (t) => { const s = (Date.now() - t) / 1000; if (s < 60) return '방금'; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`; const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
const S = { sort: 'new', page: 0, total: 0, size: 10 };

function needLogin(el) {
  if (logged()) return false;
  note(el, '로그인하거나 체험판으로 시작하면 쓸 수 있어요 (아래 내 캐릭터 칸)');
  return true;
}
function note(el, text, keep) { const n = el?.querySelector?.('.bd-msg') || $('bd-msg'); if (n) { n.textContent = text; n.classList.toggle('bd-reject', !!keep); clearTimeout(n.t); if (!keep) n.t = setTimeout(() => { n.textContent = ''; }, 4000); } }
// 올리기: AI 검사를 기다리는 동안 단추를 막는다. 안 되면 사유를 계속 보여 주고 쓴 내용은 그대로 둔다
async function send(btn, el, what, fn) {
  const label = btn.textContent, msg = el.querySelector('.bd-msg'), wait = document.createElement('div');
  btn.disabled = true; btn.textContent = '검토 중…'; note(el, '', true);
  wait.className = 'bd-checking'; wait.innerHTML = `<i class="bd-spin"></i><span>🤖 LLM 가이드가 ${what}을 검토 중입니다<b class="bd-dots"><u>.</u><u>.</u><u>.</u></b></span>`; msg.before(wait);
  try { await fn(); } catch (e) { note(el, e.status === 422 ? `✋ 이대로는 올릴 수 없어요. ${e.message}` : e.message, e.status === 422 || e.status === 503); }
  finally { wait.remove(); if (btn.isConnected) { btn.disabled = false; btn.textContent = label; } }
}

export async function refreshBoard() {
  let d; try { d = await account.api(`/api/board/list?sort=${S.sort}&page=${S.page}`); } catch { $('bd-list').innerHTML = '<div class="bd-empty">건의 게시판을 불러오지 못했어요</div>'; return; }
  S.total = d.total; S.size = d.page;
  $('bd-list').innerHTML = d.posts.length ? d.posts.map((p) => `<button class="bd-row" data-id="${esc(p.id)}"><span class="bd-t"><span class="bd-tt">${esc(p.title)}</span>${p.comments ? `<b>[${p.comments}]</b>` : ''}</span><span class="bd-meta"><span class="bd-v">👍 ${p.up}</span><span class="bd-v">👎 ${p.down}</span><span class="bd-n">${esc(p.name)}</span><span>${ago(p.at)}</span></span></button>`).join('') : '<div class="bd-empty">아직 건의가 없어요. 바라는 점을 남겨 주세요!</div>';
  for (const b of $('bd-list').querySelectorAll('[data-id]')) b.onclick = () => openPost(b.dataset.id);
  const pages = Math.ceil(S.total / S.size);
  $('bd-pages').classList.toggle('hidden', pages < 2);
  $('bd-page').textContent = `${S.page + 1} / ${Math.max(1, pages)}`;
  $('bd-prev').disabled = S.page <= 0; $('bd-next').disabled = S.page >= pages - 1;
}
// 창 하나 띄우기 (Esc · 바깥 클릭으로 닫는다)
function modal(html) {
  const wrap = document.createElement('div'); wrap.className = 'bd-wrap'; wrap.innerHTML = `<div class="bd-card"><button class="bd-x" aria-label="닫기">✕</button>${html}</div>`; document.body.append(wrap);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { wrap.remove(); removeEventListener('keydown', onKey); };
  addEventListener('keydown', onKey); wrap.querySelector('.bd-x').onclick = close; wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  return { wrap, close };
}
// 내 글 · 내 댓글은 추천 · 비추천을 누를 수 없다 (숫자만 보인다)
const voteBtns = (it, cid = '') => { const off = it.mine ? ' disabled title="내 글에는 누를 수 없어요"' : ''; return `<span class="bd-votes${it.mine ? ' mine' : ''}"><button data-v="1" data-cid="${esc(cid)}" class="${it.my > 0 ? 'on' : ''}"${off}>👍 <i>${it.up}</i></button><button data-v="-1" data-cid="${esc(cid)}" class="${it.my < 0 ? 'on bad' : ''}"${off}>👎 <i>${it.down}</i></button></span>`; };
// 관리자: 신고 사유 목록
const reps = (it) => (it.reps?.length ? `<div class="bd-reps">🚩 ${it.reps.map((r) => esc(r.why + (r.text ? `(${r.text})` : ''))).join(' · ')}</div>` : '');
// Enter = 보내기, Shift+Enter = 줄바꿈 (한글 조합 중에는 보내지 않는다)
const onEnter = (el, fn) => el.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return; e.preventDefault(); fn(); });
const WHY = [['abuse', '욕설 · 비방'], ['spam', '도배 · 광고'], ['lewd', '음란 · 불쾌'], ['privacy', '개인정보'], ['etc', '기타']];
// 신고 사유 고르기 창 → { why, text } 또는 null
function askReason() {
  return new Promise((done) => {
    const { wrap, close } = modal(`<div class="bd-body bd-rep"><h3>🚩 신고하기</h3><p class="bd-hint">신고 사유를 골라 주세요. 신고는 글마다 한 번만 할 수 있고, 쌓이면 가려져요.</p><div class="bd-why">${WHY.map(([k, t]) => `<label><input type="radio" name="bd-why" value="${k}"> ${t}</label>`).join('')}</div><textarea id="bd-why-t" maxlength="200" rows="2" placeholder="기타 사유 (5자 넘게)" style="display:none"></textarea><div class="bd-form end"><button class="btn ghost" id="bd-why-no">그만두기</button><button class="btn" id="bd-why-ok" disabled>신고하기</button></div><div class="bd-msg"></div></div>`);
    const ok = wrap.querySelector('#bd-why-ok'), ta = wrap.querySelector('#bd-why-t');
    const pick = () => wrap.querySelector('input[name=bd-why]:checked')?.value;
    const check = () => { const w = pick(); ta.style.display = w === 'etc' ? '' : 'none'; ok.disabled = !w || (w === 'etc' && ta.value.trim().length < 5); };
    wrap.addEventListener('change', check); ta.addEventListener('input', check);
    let sent = false; const fin = (v) => { if (sent) return; sent = true; close(); done(v); };
    wrap.querySelector('#bd-why-no').onclick = () => fin(null); ok.onclick = () => fin({ why: pick(), text: ta.value.trim() });
    const mo = new MutationObserver(() => { if (!wrap.isConnected) { mo.disconnect(); if (!sent) { sent = true; done(null); } } }); mo.observe(document.body, { childList: true });
  });
}
const tools = (it, admin, cid = '') => `<span class="bd-tools">${it.hidden && admin ? `<button data-unhide data-cid="${esc(cid)}">복구</button>` : ''}${it.mine && !cid ? '<button data-edit>✏️ 고치기</button>' : ''}${it.mine || admin ? `<button data-del data-cid="${esc(cid)}">🗑️ 지우기</button>` : `<button data-report data-cid="${esc(cid)}"${it.reported ? ' disabled' : ''}>${it.reported ? '🚩 신고함' : '🚩 신고'}</button>`}</span>${admin ? reps(it) : ''}`;
// 댓글 + 답글(한 단계): 원 댓글 아래에 들여 써서 묶는다
const cHtml = (c, admin, reply) => `<div class="bd-c${reply ? ' bd-re' : ''}" data-c="${esc(c.id)}"><div class="bd-sub">${reply ? '<i class="bd-arrow">↳</i>' : ''}<b>${esc(c.name)}</b> · ${ago(c.at)}${c.hidden ? ' · 🚫 가려짐' : ''}</div><div class="bd-text small">${esc(c.text)}</div><div class="bd-actions">${voteBtns(c, c.id)}<button class="bd-rbtn" data-reply="${esc(c.parent || c.id)}" data-to="${esc(c.name)}">↳ 답글</button>${tools(c, admin, c.id)}</div></div>`;
function thread(d) {
  const tops = d.comments.filter((c) => !c.parent || !d.comments.some((q) => q.id === c.parent));
  if (!tops.length) return '<div class="bd-empty">첫 댓글을 남겨 보세요</div>';
  return tops.map((c) => `<div class="bd-grp" data-g="${esc(c.id)}">${cHtml(c, d.admin, false)}${d.comments.filter((r) => r.parent === c.id).map((r) => cHtml(r, d.admin, true)).join('')}</div>`).join('');
}
async function openPost(id) {
  let d; try { d = await account.api(`/api/board/post?id=${encodeURIComponent(id)}`); } catch (e) { note(null, e.message); refreshBoard(); return; }
  const { wrap, close } = modal('<div class="bd-body"></div>'); const box = wrap.querySelector('.bd-body');
  const draw = (keep = '') => {
    box.innerHTML = `<h3>${esc(d.title)}</h3><div class="bd-sub"><b>${esc(d.name)}</b> · ${ago(d.at)}${d.edited ? ' · 고침' : ''}${d.hidden ? ' · 🚫 가려짐' : ''}</div><div class="bd-text"></div><div class="bd-actions">${voteBtns(d)}${tools(d, d.admin)}</div>
      <h4>댓글 ${d.comments.length}</h4><div class="bd-cs">${thread(d)}</div>
      <div class="bd-form"><textarea id="bd-c-in" maxlength="500" rows="2" placeholder="${logged() ? '댓글 쓰기 (Enter 올리기 · Shift+Enter 줄바꿈)' : '로그인하면 댓글을 쓸 수 있어요'}"></textarea><button class="btn" id="bd-c-send">쓰기</button></div><div class="bd-msg"></div>`;
    box.querySelector('.bd-text').textContent = d.body; box.querySelector('#bd-c-in').value = keep;
    onEnter(box.querySelector('#bd-c-in'), () => box.querySelector('#bd-c-send').click());
    box.querySelector('#bd-c-send').onclick = async (ev) => { if (needLogin(box)) return; const v = box.querySelector('#bd-c-in'); await send(ev.currentTarget, box, '댓글', async () => { d = await account.api('/api/board/comment', { method: 'POST', body: { id, text: v.value } }); draw(); refreshBoard(); }); };
    for (const b of box.querySelectorAll('[data-v]')) b.onclick = async () => { if (needLogin(box)) return; const cid = b.dataset.cid || null; try { const r = await account.api('/api/board/vote', { method: 'POST', body: { id, cid, v: +b.dataset.v } }); Object.assign(cid ? d.comments.find((c) => c.id === cid) : d, r); draw(box.querySelector('#bd-c-in').value); refreshBoard(); } catch (e) { note(box, e.message); } };
    for (const b of box.querySelectorAll('[data-del]')) b.onclick = async () => { const cid = b.dataset.cid || null; if (!confirm(cid ? '이 댓글을 지울까요?' : '이 글을 지울까요?')) return; try { await account.api('/api/board/delete', { method: 'POST', body: { id, cid } }); refreshBoard(); if (!cid) { close(); return; } d = await account.api(`/api/board/post?id=${encodeURIComponent(id)}`); draw(box.querySelector('#bd-c-in').value); } catch (e) { note(box, e.message); } };
    for (const b of box.querySelectorAll('[data-edit]')) b.onclick = () => openWrite(d, (nd) => { d = nd; draw(box.querySelector('#bd-c-in').value); refreshBoard(); });
    for (const b of box.querySelectorAll('[data-report]')) b.onclick = async () => { if (needLogin(box)) return; const cid = b.dataset.cid || null; const R = await askReason(); if (!R) return; try { await account.api('/api/board/report', { method: 'POST', body: { id, cid, why: R.why, text: R.text } }); (cid ? d.comments.find((c) => c.id === cid) : d).reported = true; draw(box.querySelector('#bd-c-in').value); note(box, '신고했어요'); } catch (e) { note(box, e.message); } };
    // 답글: 그 댓글 묶음 아래에 입력 칸 (답글의 답글은 '@이름 ' 을 붙여 같은 묶음에)
    for (const b of box.querySelectorAll('[data-reply]')) b.onclick = () => {
      if (needLogin(box)) return; box.querySelector('.bd-rform')?.remove();
      const g = box.querySelector(`.bd-grp[data-g="${CSS.escape(b.dataset.reply)}"]`), f = document.createElement('div'); f.className = 'bd-form bd-rform';
      f.innerHTML = '<textarea maxlength="500" rows="1" placeholder="답글 쓰기 (Enter 올리기 · Shift+Enter 줄바꿈)"></textarea><button class="btn mini">답글</button>';
      g.append(f); const ta = f.querySelector('textarea'), btn = f.querySelector('button'); if (b.closest('.bd-re')) ta.value = `@${b.dataset.to} `; ta.focus();
      btn.onclick = (ev) => send(ev.currentTarget, box, '답글', async () => { d = await account.api('/api/board/comment', { method: 'POST', body: { id, text: ta.value, parent: b.dataset.reply } }); draw(box.querySelector('#bd-c-in').value); refreshBoard(); });
      onEnter(ta, () => btn.click());
    };
    for (const b of box.querySelectorAll('[data-unhide]')) b.onclick = async () => { try { await account.api('/api/board/unhide', { method: 'POST', body: { id, cid: b.dataset.cid || null } }); d = await account.api(`/api/board/post?id=${encodeURIComponent(id)}`); draw(); refreshBoard(); } catch (e) { note(box, e.message); } };
  };
  draw();
}
// 글쓰기 · 고치기 (old: 고칠 글, onSaved: 고친 뒤 새 글 내용으로)
function openWrite(old = null, onSaved = null) {
  if (needLogin(null)) return;
  const { wrap, close } = modal(`<div class="bd-body"><h3>${old ? '✏️ 글 고치기' : '💡 건의하기'}</h3><div class="bd-tline"><input id="bd-w-t" maxlength="30" placeholder="제목 (30자까지 · 예: 드림러너 새 맵 건의)" /><span class="bd-cnt">0/30</span></div><textarea id="bd-w-b" maxlength="2000" rows="8" placeholder="바라는 점 · 불편한 점 · 버그를 자유롭게 (닉네임으로 올라가요 · 올리기 전에 AI 가 욕설과 부적절한 내용을 검사해요)"></textarea><p class="bd-hint">Enter 올리기 · Shift+Enter 줄바꿈</p><div class="bd-form end"><button class="btn" id="bd-w-send">${old ? '고치기' : '올리기'}</button></div><div class="bd-msg"></div></div>`);
  if (old) { wrap.querySelector('#bd-w-t').value = old.title; wrap.querySelector('#bd-w-b').value = old.body; }
  wrap.querySelector('#bd-w-t').focus();
  { const t = wrap.querySelector('#bd-w-t'), c = wrap.querySelector('.bd-cnt'), up = () => { c.textContent = `${t.value.length}/30`; }; t.addEventListener('input', up); setTimeout(up); }
  // 제목에서 Enter: 내용이 있으면 올리기, 없으면 내용 칸으로 · 내용에서 Enter: 올리기
  onEnter(wrap.querySelector('#bd-w-t'), () => { const bd = wrap.querySelector('#bd-w-b'); if (bd.value.trim()) wrap.querySelector('#bd-w-send').click(); else bd.focus(); });
  onEnter(wrap.querySelector('#bd-w-b'), () => wrap.querySelector('#bd-w-send').click());
  if (old) { wrap.querySelector('#bd-w-send').onclick = (ev) => send(ev.currentTarget, wrap, '게시글', async () => { const nd = await account.api('/api/board/edit', { method: 'POST', body: { id: old.id, title: wrap.querySelector('#bd-w-t').value, body: wrap.querySelector('#bd-w-b').value } }); close(); onSaved?.(nd); }); return; }
  wrap.querySelector('#bd-w-send').onclick = (ev) => send(ev.currentTarget, wrap, '게시글', async () => { const r = await account.api('/api/board/write', { method: 'POST', body: { title: wrap.querySelector('#bd-w-t').value, body: wrap.querySelector('#bd-w-b').value } }); close(); S.sort = 'new'; S.page = 0; syncTabs(); await refreshBoard(); openPost(r.id); });
}
const syncTabs = () => { for (const b of $('bd-tabs').children) b.classList.toggle('on', b.dataset.s === S.sort); };
for (const b of $('bd-tabs').children) b.onclick = () => { S.sort = b.dataset.s; S.page = 0; syncTabs(); refreshBoard(); };
$('bd-write').onclick = () => openWrite();
$('bd-prev').onclick = () => { S.page--; refreshBoard(); }; $('bd-next').onclick = () => { S.page++; refreshBoard(); };
