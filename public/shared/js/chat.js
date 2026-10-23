// 방 채팅 (모든 게임 공용): 대기실(방)부터 게임 중까지 · 팀전이면 '팀에게만'도 · Enter 로 열고 보내기
//   대화 내역은 왼쪽 아래에 늘 흐리게 보인다 (닫혀 있을 땐 클릭이 게임으로 지나간다) · Enter 로 쓰고 다시 Enter 로 보내고 닫기
//   new Chat({ send(m), myId(), teamMode(), myTeam(), teamName(team), teamColor(team) })
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CSS = `
#chat { position: fixed; left: 14px; bottom: 14px; z-index: 36; width: min(340px, calc(100vw - 28px)); font-family: 'Gowun Dodum', sans-serif; pointer-events: none; }
#chat.hidden { display: none; }
#chat .log { display: flex; flex-direction: column; gap: 4px; max-height: 30vh; overflow-y: auto; padding: 8px; border-radius: 18px; pointer-events: auto; scrollbar-width: thin; }
#chat.open .log { background: rgba(20, 10, 46, .45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.16); max-height: 42vh; }
#chat:not(.open) .log { pointer-events: none; overflow: hidden; }
#chat .msg { font-size: 14px; line-height: 1.45; color: #fff; padding: 4px 10px; border-radius: 12px; background: rgba(20,10,46,.32); opacity: .6; text-shadow: 0 1px 2px rgba(0,0,0,.4); word-break: break-word; transition: opacity .6s; align-self: flex-start; max-width: 100%; }
#chat.open .msg { background: transparent; padding: 2px 4px; opacity: .92; }
#chat .msg b { font-family: 'Jua', sans-serif; font-weight: normal; margin-right: 6px; }
#chat .msg .tm { font-size: 11px; padding: 1px 6px; border-radius: 999px; margin-right: 4px; color: #fff; }
#chat .msg.sys { color: #c9c1ff; font-size: 13px; font-style: italic; }
#chat .msg.me b::after { content: ' (나)'; font-size: 11px; opacity: .7; }
#chat .bar { display: flex; gap: 6px; margin-top: 6px; pointer-events: auto; align-items: center; }
#chat .toggle { width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); background: rgba(20,10,46,.45); opacity: .7; color: #fff; font-size: 20px; position: relative; flex: none; cursor: pointer; }
#chat .toggle i { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: #ff5c8a; color: #fff; font-size: 11px; font-style: normal; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
#chat .toggle i:empty { display: none; }
#chat form { flex: 1; display: none; gap: 6px; }
#chat.open form { display: flex; }
#chat input { flex: 1; min-width: 0; font-size: 15px; padding: 9px 14px; border-radius: 999px; border: 2px solid rgba(255,255,255,.3); background: rgba(20,10,46,.6); color: #fff; outline: none; font-family: inherit; }
#chat input:focus { border-color: #ff8fc4; }
#chat .scope { border: 0; border-radius: 999px; padding: 8px 10px; font-family: 'Jua', sans-serif; font-size: 13px; color: #fff; background: rgba(255,255,255,.18); cursor: pointer; white-space: nowrap; }
#chat .scope.team { background: var(--tc, #ff5a7a); }
#chat .send { border: 0; border-radius: 999px; padding: 8px 14px; font-family: 'Jua', sans-serif; background: linear-gradient(135deg, #ff8fc4, #b388ff); color: #fff; cursor: pointer; }
@media (max-width: 700px) { #chat .log { max-height: 26vh; } #chat .msg { font-size: 13px; } }
`;
export class Chat {
  constructor(o) {
    this.o = o; this.unread = 0; this.teamOnly = false; this.fadeT = new Map();
    if (!document.getElementById('chat-css')) { const st = document.createElement('style'); st.id = 'chat-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = this.el = document.createElement('div');
    el.id = 'chat'; el.className = 'hidden';
    el.innerHTML = `<div class="log"></div><div class="bar"><button class="toggle" type="button" title="채팅 (Enter)">💬<i></i></button><form autocomplete="off"><button class="scope hidden" type="button" title="전체 / 팀에게만">전체</button><input maxlength="120" placeholder="메시지 · Enter 로 보내고 닫기" autocomplete="off" /><button class="send">보내기</button></form></div>`;
    document.body.appendChild(el);
    this.log = el.querySelector('.log'); this.input = el.querySelector('input'); this.badge = el.querySelector('.toggle i'); this.scopeBtn = el.querySelector('.scope');
    el.querySelector('.toggle').onclick = () => (el.classList.contains('open') ? this.close() : this.open());
    this.scopeBtn.onclick = () => { this.teamOnly = !this.teamOnly; this.renderScope(); this.input.focus(); };
    el.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      const s = this.input.value.trim();
      if (s) { this.o.send({ t: 'chat', s, team: this.teamOnly && this.o.teamMode() }); this.input.value = ''; }
      this.close(); // 다시 Enter: 보내고 닫아서 바로 게임에 집중
    };
    this.input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') this.close(); if (e.key === 'Tab' && this.o.teamMode()) { e.preventDefault(); this.scopeBtn.click(); } });
    // Enter: 채팅 열기 (다른 입력 칸에 쓰는 중이 아닐 때)
    window.addEventListener('keydown', (e) => {
      if (el.classList.contains('hidden') || e.key !== 'Enter' || e.isComposing) return;
      const a = document.activeElement; if (a && ['INPUT', 'TEXTAREA'].includes(a.tagName) && a !== this.input) return;
      if (a === this.input) return;
      e.preventDefault(); this.open();
    });
  }
  show(on) { this.el.classList.toggle('hidden', !on); if (!on) this.close(); this.renderScope(); }
  open() { this.el.classList.add('open'); this.unread = 0; this.badge.textContent = ''; this.o.onOpen?.(); this.renderScope(); setTimeout(() => this.input.focus(), 0); this.log.scrollTop = this.log.scrollHeight; }
  close() { const was = this.isOpen; this.el.classList.remove('open'); this.input.blur(); this.log.scrollTop = this.log.scrollHeight; if (was) this.o.onClose?.(); }
  get isOpen() { return this.el.classList.contains('open'); }
  renderScope() {
    const tm = this.o.teamMode(), team = this.o.myTeam?.();
    this.scopeBtn.classList.toggle('hidden', !tm);
    if (!tm) this.teamOnly = false;
    this.scopeBtn.classList.toggle('team', this.teamOnly);
    this.scopeBtn.style.setProperty('--tc', this.o.teamColor?.(team) || '#ff5a7a');
    this.scopeBtn.textContent = this.teamOnly ? '👥 팀' : '📢 전체';
    this.input.placeholder = this.teamOnly ? '팀에게만 · Tab 전체로 · Enter 닫기' : tm ? '모두에게 · Tab 팀에게만 · Enter 닫기' : '메시지 · Enter 로 보내고 닫기';
  }
  reset(list = []) { this.log.innerHTML = ''; this.unread = 0; this.badge.textContent = ''; for (const m of list) this.receive(m, true); }
  receive(m, quiet) {
    const d = document.createElement('div');
    if (m.sys) { d.className = 'msg sys'; d.textContent = m.s; }
    else {
      const me = m.id === this.o.myId(), tc = m.team ? this.o.teamColor?.(m.team) : null;
      d.className = 'msg' + (me ? ' me' : '');
      d.innerHTML = `${m.team ? `<span class="tm" style="background:${esc(tc || '#ff5a7a')}">팀</span>` : ''}<b style="color:${esc(m.color || '#ffd84d')}">${esc(m.name)}</b>${esc(m.s)}`;
    }
    this.log.appendChild(d);
    while (this.log.children.length > 80) this.log.firstElementChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
    if (!this.isOpen && !quiet && !m.sys && m.id !== this.o.myId()) { this.unread++; this.badge.textContent = this.unread > 99 ? '99+' : this.unread; }
    if (!quiet && !m.sys && m.id !== this.o.myId()) this.o.onMessage?.(m);
  }
}
