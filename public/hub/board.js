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
  let d; try { d = await account.api(`/api/board/list?sort=${S.sort}&page=${S.page}`); } catch { $('bd-list').innerHTML = '<div class="bd-empty">게시판을 불러오지 못했어요</div>'; return; }
  S.total = d.total; S.size = d.page;
  $('bd-list').innerHTML = d.posts.length ? d.posts.map((p) => `<button class="bd-row" data-id="${esc(p.id)}"><span class="bd-t">${esc(p.title)}${p.comments ? ` <b>[${p.comments}]</b>` : ''}</span><span class="bd-meta"><span class="bd-v">👍 ${p.up}</span><span class="bd-v">👎 ${p.down}</span><span class="bd-n">${esc(p.name)}</span><span>${ago(p.at)}</span></span></button>`).join('') : '<div class="bd-empty">아직 글이 없어요. 첫 글을 남겨 보세요!</div>';
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
const voteBtns = (it, cid = '') => `<span class="bd-votes"><button data-v="1" data-cid="${esc(cid)}" class="${it.my > 0 ? 'on' : ''}">👍 <i>${it.up}</i></button><button data-v="-1" data-cid="${esc(cid)}" class="${it.my < 0 ? 'on bad' : ''}">👎 <i>${it.down}</i></button></span>`;
const tools = (it, admin, cid = '') => `<span class="bd-tools">${it.hidden && admin ? `<button data-unhide data-cid="${esc(cid)}">복구</button>` : ''}${it.mine || admin ? `<button data-del data-cid="${esc(cid)}">지우기</button>` : `<button data-report data-cid="${esc(cid)}"${it.reported ? ' disabled' : ''}>${it.reported ? '🚩 신고함' : '🚩 신고'}</button>`}</span>`;
async function openPost(id) {
  let d; try { d = await account.api(`/api/board/post?id=${encodeURIComponent(id)}`); } catch (e) { note(null, e.message); refreshBoard(); return; }
  const { wrap, close } = modal('<div class="bd-body"></div>'); const box = wrap.querySelector('.bd-body');
  const draw = (keep = '') => {
    box.innerHTML = `<h3>${esc(d.title)}</h3><div class="bd-sub"><b>${esc(d.name)}</b> · ${ago(d.at)}${d.hidden ? ' · 🚫 가려짐' : ''}</div><div class="bd-text"></div><div class="bd-actions">${voteBtns(d)}${tools(d, d.admin)}</div>
      <h4>댓글 ${d.comments.length}</h4><div class="bd-cs">${d.comments.map((c) => `<div class="bd-c"><div class="bd-sub"><b>${esc(c.name)}</b> · ${ago(c.at)}${c.hidden ? ' · 🚫 가려짐' : ''}</div><div class="bd-text small">${esc(c.text)}</div><div class="bd-actions">${voteBtns(c, c.id)}${tools(c, d.admin, c.id)}</div></div>`).join('') || '<div class="bd-empty">첫 댓글을 남겨 보세요</div>'}</div>
      <div class="bd-form"><textarea id="bd-c-in" maxlength="500" rows="2" placeholder="${logged() ? '댓글 쓰기' : '로그인하면 댓글을 쓸 수 있어요'}"></textarea><button class="btn" id="bd-c-send">쓰기</button></div><div class="bd-msg"></div>`;
    box.querySelector('.bd-text').textContent = d.body; box.querySelector('#bd-c-in').value = keep;
    box.querySelector('#bd-c-send').onclick = async (ev) => { if (needLogin(box)) return; const v = box.querySelector('#bd-c-in'); await send(ev.currentTarget, box, '댓글', async () => { d = await account.api('/api/board/comment', { method: 'POST', body: { id, text: v.value } }); draw(); refreshBoard(); }); };
    for (const b of box.querySelectorAll('[data-v]')) b.onclick = async () => { if (needLogin(box)) return; const cid = b.dataset.cid || null; try { const r = await account.api('/api/board/vote', { method: 'POST', body: { id, cid, v: +b.dataset.v } }); Object.assign(cid ? d.comments.find((c) => c.id === cid) : d, r); draw(box.querySelector('#bd-c-in').value); refreshBoard(); } catch (e) { note(box, e.message); } };
    for (const b of box.querySelectorAll('[data-del]')) b.onclick = async () => { const cid = b.dataset.cid || null; if (!confirm(cid ? '이 댓글을 지울까요?' : '이 글을 지울까요?')) return; try { await account.api('/api/board/delete', { method: 'POST', body: { id, cid } }); refreshBoard(); if (!cid) { close(); return; } d = await account.api(`/api/board/post?id=${encodeURIComponent(id)}`); draw(box.querySelector('#bd-c-in').value); } catch (e) { note(box, e.message); } };
    for (const b of box.querySelectorAll('[data-report]')) b.onclick = async () => { if (needLogin(box)) return; if (!confirm('신고할까요? 신고는 글마다 한 번만 할 수 있어요. 신고가 쌓이면 가려져요')) return; const cid = b.dataset.cid || null; try { await account.api('/api/board/report', { method: 'POST', body: { id, cid } }); (cid ? d.comments.find((c) => c.id === cid) : d).reported = true; draw(box.querySelector('#bd-c-in').value); note(box, '신고했어요'); } catch (e) { note(box, e.message); } };
    for (const b of box.querySelectorAll('[data-unhide]')) b.onclick = async () => { try { await account.api('/api/board/unhide', { method: 'POST', body: { id, cid: b.dataset.cid || null } }); d = await account.api(`/api/board/post?id=${encodeURIComponent(id)}`); draw(); refreshBoard(); } catch (e) { note(box, e.message); } };
  };
  draw();
}
function openWrite() {
  if (needLogin(null)) return;
  const { wrap, close } = modal(`<div class="bd-body"><h3>✏️ 글쓰기</h3><input id="bd-w-t" maxlength="60" placeholder="제목" /><textarea id="bd-w-b" maxlength="2000" rows="8" placeholder="내용 (닉네임으로 올라가요 · 올리기 전에 AI 가 욕설과 부적절한 내용을 검사해요)"></textarea><div class="bd-form end"><button class="btn" id="bd-w-send">올리기</button></div><div class="bd-msg"></div></div>`);
  wrap.querySelector('#bd-w-t').focus();
  wrap.querySelector('#bd-w-send').onclick = (ev) => send(ev.currentTarget, wrap, '게시글', async () => { const r = await account.api('/api/board/write', { method: 'POST', body: { title: wrap.querySelector('#bd-w-t').value, body: wrap.querySelector('#bd-w-b').value } }); close(); S.sort = 'new'; S.page = 0; syncTabs(); await refreshBoard(); openPost(r.id); });
}
const syncTabs = () => { for (const b of $('bd-tabs').children) b.classList.toggle('on', b.dataset.s === S.sort); };
for (const b of $('bd-tabs').children) b.onclick = () => { S.sort = b.dataset.s; S.page = 0; syncTabs(); refreshBoard(); };
$('bd-write').onclick = openWrite;
$('bd-prev').onclick = () => { S.page--; refreshBoard(); }; $('bd-next').onclick = () => { S.page++; refreshBoard(); };
