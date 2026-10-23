// 메인 화면: 로그인 · 닉네임 · 내 캐릭터(만들기 · 꾸미기 · 삭제 · 대표 고르기) · 게임 고르기
import { account, store } from '/shared/js/account.js';
import { Creator, thumbOf, DEFAULT_CHAR_KEY } from '/shared/js/char-studio.js';
import { localChars, addLocal, updateLocal, removeLocal, LOCAL_MAX } from '/shared/js/local-chars.js';
import { openSens } from '/shared/js/sens.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const err = (t) => { $('err').textContent = t || ''; };
const MAX_CHARS = 4;
$('sens-open').onclick = () => openSens();
const q = new URLSearchParams(location.search);
// 다른 게임에서 '새 캐릭터 만들기'로 왔으면 만든 뒤 그 게임으로 돌아간다
const back = /^\/[a-z-]+\/$/.test(q.get('back') || '') ? q.get('back') : null;
const logged = () => !!account.session && !!account.user;
let status = {};

// 떠다니는 비눗방울
const bub = document.querySelector('.bubbles');
for (let i = 0; i < 18; i++) {
  const s = document.createElement('span'), d = 10 + Math.random() * 46;
  Object.assign(s.style, { width: d + 'px', height: d + 'px', left: Math.random() * 100 + 'vw', animationDuration: 14 + Math.random() * 18 + 's', animationDelay: -Math.random() * 30 + 's' });
  bub.appendChild(s);
}
// 드림 러너 최고 기록 1~3위
fetch('/api/dream/board').then((r) => r.json()).then((d) => {
  const t = (d.top || []).slice(0, 3);
  if (t.length) $('top3').textContent = '🏆 ' + t.map((e, i) => `${['🥇', '🥈', '🥉'][i]} ${e.name} ${e.score.toLocaleString()}점`).join('  ');
}).catch(() => {});

// ---------- 계정 ----------
async function boot() {
  try { status = await account.status(); } catch { err('서버에 연결할 수 없어요'); }
  await account.restore();
  if (!logged() && q.has('autostart') && status.devLogin) { try { await account.login({ dev: q.get('name') || '젤리' }); } catch (e) { err(e.message); } } // 점검용
  render();
  if (q.has('create')) openStudio(); // 로그인 안 해도 이 기기에 만든다
}
function render() {
  const on = logged();
  $('login-box').classList.toggle('hidden', on);
  $('account').innerHTML = on
    ? `<span>👋 <b>${esc(account.user.name)}</b></span><button class="btn ghost mini" id="nick-edit" title="닉네임 바꾸기">✏️</button><button class="btn ghost mini" id="logout">로그아웃</button>`
    : '';
  if (on) {
    $('nick-edit').onclick = () => { $('nick-box').classList.remove('hidden'); $('nick-in').value = account.user.nick || ''; $('nick-in').focus(); };
    $('logout').onclick = async () => { await account.logout(); render(); };
  }
  $('nick-box').classList.toggle('hidden', !(on && account.user.needNick));
  if (!on) {
    $('pw-row').classList.toggle('hidden', !status.password);
    if (status.password && !$('pw').value) $('pw').value = store.get('roachcity.pw') || '';
    $('dev-box').classList.toggle('hidden', !status.devLogin);
    if (status.googleClientId) account.googleButton($('g-btn'), status.googleClientId, () => { render(); if (q.has('create')) openStudio(); }, (e) => err(e.message)).catch(() => err('구글 로그인 버튼을 불러오지 못했어요'));
  }
  renderChars();
}
$('pw').oninput = () => { store.set('roachcity.pw', $('pw').value); err(''); };
$('guest-btn').onclick = async () => { try { await account.login({ guest: true }); render(); if (q.has('create')) openStudio(); } catch (e) { err(e.message); } };
$('dev-btn').onclick = async () => { try { await account.login({ dev: $('dev-name').value || '젤리' }); render(); } catch (e) { err(e.message); } };
async function saveNick() {
  try { const r = await account.api('/api/nick', { method: 'POST', body: { nick: $('nick-in').value } }); account.user = r.user; $('nick-box').classList.add('hidden'); err(''); render(); }
  catch (e) { err(e.message); }
}
$('nick-save').onclick = saveNick;
$('nick-in').onkeydown = (e) => { if (e.key === 'Enter') saveNick(); };

// ---------- 내 캐릭터 ----------
// 로그인하면 계정 캐릭터, 아니면 이 기기에 저장한 캐릭터
const myChars = () => (logged() ? account.chars || [] : localChars());
function mainToken() {
  const chars = myChars();
  const t = store.get(DEFAULT_CHAR_KEY);
  return chars.some((c) => c.token === t) ? t : chars[0]?.token || null;
}
function renderChars() {
  const el = $('char-list');
  const chars = myChars(), main = mainToken(), on = logged();
  $('chars-sub').textContent = on ? `만든 캐릭터는 모든 게임에서 써요 · ⭐ 대표 캐릭터가 게임의 기본이에요 (${chars.length}/${MAX_CHARS})` : `로그인 없이도 만들 수 있어요 · 이 기기에만 저장돼요 (${chars.length}/${LOCAL_MAX}) · 젤리시티는 로그인(체험판)한 캐릭터로 해요`;
  el.innerHTML = chars.map((c) => `
    <div class="ch${c.token === main ? ' main' : ''}" data-tok="${c.token}">
      ${c.token === main ? '<span class="badge">⭐ 대표</span>' : ''}${c.local ? '<span class="badge local">📱 이 기기</span>' : ''}
      <img data-thumb="${c.token}" alt="">
      <div class="nm">${esc(c.name)}</div>
      <div class="meta">${c.profile?.gender === '남' ? '♂' : '♀'} ${c.profile?.age || 25}살 · ${esc(c.profile?.personality || '')}</div>
      <div class="acts">
        ${c.token === main ? '' : `<button class="btn mini" data-main="${c.token}">⭐ 대표로</button>`}
        <button class="btn ghost mini" data-style="${c.token}">🎨 꾸미기</button>
        <button class="btn ghost mini" data-name="${c.token}" title="이름 바꾸기">✏️</button>
        <button class="btn ghost mini" data-del="${c.token}" title="삭제">🗑️</button>
      </div>
    </div>`).join('') + (chars.length < (on ? MAX_CHARS : LOCAL_MAX) ? '<div class="ch new" id="new-char"><div class="plus">＋</div>새 캐릭터 만들기</div>' : '');
  if (!chars.length) el.insertAdjacentHTML('afterbegin', '<p class="empty">아직 캐릭터가 없어요. 나만의 곰돌이를 만들어 보세요! 🐻</p>');
  for (const c of chars) { const img = el.querySelector(`[data-thumb="${c.token}"]`); if (img) img.src = thumbOf(c); }
  el.querySelectorAll('[data-main]').forEach((b) => { b.onclick = () => { store.set(DEFAULT_CHAR_KEY, b.dataset.main); renderChars(); }; });
  el.querySelectorAll('[data-style]').forEach((b) => { b.onclick = () => openStudio(chars.find((c) => c.token === b.dataset.style)); });
  el.querySelectorAll('[data-name]').forEach((b) => {
    b.onclick = async () => {
      const c = chars.find((x) => x.token === b.dataset.name), max = c.local ? 12 : 8;
      const v = prompt(`'${c.name}' 의 새 이름 (1~${max}글자) · 돈 · 집 · 친구는 그대로예요`, c.name);
      const n = (v || '').trim().replace(/\s+/g, ' ').slice(0, max);
      if (!n || n === c.name) return;
      try {
        if (c.local) updateLocal(c.token, { name: n });
        else account.chars = (await account.api(`/api/chars/${c.token}/name`, { method: 'POST', body: { name: n } })).chars;
        err(''); renderChars();
      } catch (e) { err(e.message); }
    };
  });
  el.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const c = chars.find((x) => x.token === b.dataset.del);
      if (c.local) { if (confirm(`"${c.name}" 캐릭터를 지울까요?`)) { removeLocal(c.token); renderChars(); } return; }
      const typed = prompt(`정말 "${c.name}" 캐릭터를 삭제할까요? 젤리시티의 돈·아이템·집도 모두 사라져요.\n삭제하려면 캐릭터 이름을 입력하세요.`);
      if (typed !== c.name) return;
      try { account.chars = (await account.api(`/api/chars/${c.token}`, { method: 'DELETE' })).chars; renderChars(); } catch (e) { err(e.message); }
    };
  });
  $('new-char')?.addEventListener('click', () => openStudio());
}

// ---------- 만들기 · 꾸미기 ----------
const creator = new Creator({ preview: $('create-preview'), tabs: $('create-tabs'), body: $('create-body') });
let editing = null;
function openStudio(c) {
  editing = c || null;
  $('studio').classList.remove('hidden');
  $('studio-err').textContent = '';
  $('studio-title').textContent = c ? `🎨 ${c.name} 꾸미기` : '✨ 새 캐릭터 만들기';
  $('create-ok').textContent = c ? '저장하기 💾' : '만들기 ✨';
  creator.open(c ? { name: c.name, gender: c.profile?.gender, age: c.profile?.age, personality: c.profile?.personality, color: c.profile?.color, look: { ...(c.profile?.look || {}) }, accessories: c.profile?.accessories, starter: c.starter || {} } : null, { edit: !!c });
}
function closeStudio() { creator.close(); $('studio').classList.add('hidden'); }
$('create-back').onclick = closeStudio;
$('create-random').onclick = () => creator.randomize();
$('create-ok').onclick = async () => {
  const pr = creator.profile();
  if (!editing && !pr.name) { $('studio-err').textContent = '이름을 지어 주세요!'; creator.tab = 'basic'; creator.renderTabs(); return; }
  $('create-ok').disabled = true;
  try {
    if (!logged()) {
      // 로그인 안 함: 이 기기에 저장
      if (editing) updateLocal(editing.token, { color: pr.color, look: pr.look });
      else {
        const c = addLocal(pr, creator.draft.starter);
        if (!store.get(DEFAULT_CHAR_KEY) || localChars().length === 1 || back) store.set(DEFAULT_CHAR_KEY, c.token);
        if (back) { location.href = back; return; }
      }
    } else if (editing) {
      account.chars = (await account.api(`/api/chars/${editing.token}/look`, { method: 'POST', body: { color: pr.color, look: pr.look } })).chars;
    } else {
      const r = await account.api('/api/chars', { method: 'POST', body: { profile: pr, starter: creator.draft.starter } });
      account.chars = r.chars;
      if (!store.get(DEFAULT_CHAR_KEY) || account.chars.length === 1) store.set(DEFAULT_CHAR_KEY, r.char.token);
      if (back) { store.set(DEFAULT_CHAR_KEY, r.char.token); location.href = back; return; }
    }
    closeStudio(); renderChars();
  } catch (e) { $('studio-err').textContent = e.message; }
  $('create-ok').disabled = false;
};

boot();
