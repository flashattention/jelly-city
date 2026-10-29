// 순위표 공용 (점수 게임): 끝나면 기록 남기기(로그인 · 체험판 · 비로그인 임시 닉네임) · 처음 화면 🏆 순위표
//   서버는 server/shared/records.js (판 b 마다 계정당 최고 기록 하나). 게임은 new Ranking({...}) 하나만 만든다
//   o = { shell, api: '/api/merge', boards: [{ id, label }], unit: '점', title, nickKey }
import { account, store } from './account.js';
import { esc } from './shell.js';
import { rankIcon } from './party.js';

const ANON_KEY = 'dreamrunner.anon'; // 비로그인 기록 주인 (여러 게임이 같이 쓴다)
const $ = (id) => document.getElementById(id);
export function anonId() {
  let a = store.get(ANON_KEY);
  if (!/^[a-f0-9]{24}$/.test(a || '')) { a = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join(''); store.set(ANON_KEY, a); }
  return a;
}

export class Ranking {
  constructor(o) {
    this.o = { unit: '점', title: '🏆 순위표', ...o };
    // 순위표 화면 (처음 화면의 🏆 단추로)
    const s = document.createElement('div');
    s.id = 'board-screen'; s.className = 'screen hidden';
    s.innerHTML = `<div class="card wide"><h2>${this.o.title}</h2><div class="seg" id="bd-seg"></div><div id="bd-list" class="board" style="margin-top:14px"></div><div class="row2"><button id="bd-back" class="btn ghost">← 돌아가기</button></div></div>`;
    document.body.appendChild(s);
    $('bd-back').onclick = () => this.o.shell.show('title');
  }
  q() { return this.o.shell.logged() ? '' : `&anon=${anonId()}`; }
  render(top, me, el) {
    const u = this.o.unit;
    el.innerHTML = (top || []).slice(0, 10).map((e) => `<div class="brow${e.id === me?.id ? ' me' : ''}"><span class="rk">${rankIcon(e.rank)}</span><span class="nm"><span class="dot" style="background:${esc(e.color || '#8a5634')}"></span>${esc(e.name)}${e.guest ? ' <span class="guest">체험판</span>' : e.anon ? ' <span class="guest">비로그인</span>' : ''}</span><span class="sc">${e.value}<small>${u}</small></span></div>`).join('') || '<div class="empty">아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</div>';
    if (me && me.rank > 10) el.insertAdjacentHTML('beforeend', `<div class="brow gap">⋯</div><div class="brow me"><span class="rk">${me.rank}</span><span class="nm">${esc(me.name)}</span><span class="sc">${me.value}<small>${u}</small></span></div>`);
  }
  async show(b, el) { el.innerHTML = '<div class="empty">불러오는 중…</div>'; try { const d = await account.api(`${this.o.api}/board?b=${b}${this.q()}`); this.render(d.top, d.me, el); } catch { el.innerHTML = '<div class="empty">순위표를 불러오지 못했어요</div>'; } }
  open(b = this.o.boards[0].id) {
    $('bd-seg').innerHTML = this.o.boards.map((x) => `<button data-b="${x.id}" class="${x.id === b ? 'on' : ''}">${x.label}</button>`).join('');
    $('bd-seg').querySelectorAll('[data-b]').forEach((btn) => { btn.onclick = () => this.open(btn.dataset.b); });
    this.o.shell.show('board-screen'); this.show(b, $('bd-list'));
  }
  // 혼자 하기가 끝났을 때: 결과 화면(#over)의 el 에 순위표 · 내 순위를 보여 준다. 비로그인이면 닉네임 칸
  async submit(b, value, el, note) {
    const key = `${b}:${value}`; if (this.lastKey === key && Date.now() - this.lastAt < 4000) return; // 같은 판을 두 번 보내지 않게
    this.lastKey = key; this.lastAt = Date.now();
    const rec = { b, value, color: this.o.shell.profile?.color };
    const post = async (extra) => {
      try {
        const r = await account.api(`${this.o.api}/record`, { method: 'POST', body: { ...rec, ...extra } });
        note?.(r.best ? `🏆 새 최고 기록! 전체 ${r.me?.rank}등` : `🏆 내 최고 ${r.me?.value}${this.o.unit} · 전체 ${r.me?.rank}등`, r.best);
        this.render(r.top, r.me, el);
      } catch (e) { note?.(`기록을 남기지 못했어요 (${e.message})`); }
    };
    if (this.o.shell.logged()) return post({ name: this.o.shell.profile?.name });
    // 비로그인: 닉네임을 정하면 남긴다
    let row = $('rk-save');
    if (!row) { row = document.createElement('div'); row.id = 'rk-save'; row.innerHTML = `<div class="note">로그인하지 않았어요. 순위표에 남길 닉네임을 정해 주세요</div><div class="row"><input id="rk-nick" maxlength="14" placeholder="닉네임" /><button id="rk-btn" class="btn alt">기록 남기기</button></div>`; el.before(row); }
    row.classList.remove('hidden');
    $('rk-nick').value = store.get(this.o.nickKey) || this.o.shell.profile?.name || '';
    this.show(b, el);
    $('rk-btn').onclick = async () => {
      const name = $('rk-nick').value.trim(); if (!name) return this.o.shell.toast('닉네임을 정해 주세요');
      store.set(this.o.nickKey, name); row.classList.add('hidden');
      await post({ name, anon: anonId() });
    };
  }
  hideSave() { $('rk-save')?.classList.add('hidden'); }
}
