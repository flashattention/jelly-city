// 마우스 감도: FPS처럼 마우스로 시점을 돌리는 게임들이 같이 쓴다
//   '모든 게임' 감도 하나를 정하면 다 같이 바뀌고, 게임마다 '따로' 를 켜면 그 게임만 다른 값을 쓴다
//   아무것도 안 건드리면 1배 = 원래 감도 그대로. 메인 화면 · 각 게임 처음 화면 · 게임 중 어디서 바꿔도 같은 값
const KEY = 'jelly.sens';
export const SENS_GAMES = [
  { key: 'city', name: '🐻 젤리시티' },
  { key: 'attack', name: '🔫 젤리택티컬' },
  { key: 'bg', name: '🪂 젤리드롭' },
];
const MIN = 0.2, MAX = 3;

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* 무시 */ }
  if (!s || typeof s !== 'object') {
    s = { all: 1, own: {} };
    // 예전 젤리택티컬 감도가 있으면 젤리택티컬 따로 값으로 옮긴다
    try { const old = Number(localStorage.getItem('jellyattack.sens')); if (old && old !== 1) s.own.attack = old; } catch { /* 무시 */ }
  }
  s.all = clampS(s.all ?? 1); s.own ||= {};
  return s;
}
const clampS = (v) => Math.max(MIN, Math.min(MAX, Number(v) || 1));
let S = load();
const subs = new Set();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 무시 */ } for (const f of subs) f(); }
// 다른 탭에서 바꿔도 바로 따라간다
addEventListener('storage', (e) => { if (e.key === KEY) { S = load(); for (const f of subs) f(); } });

// 이 게임에서 쓰는 감도 배율 (1 = 원래)
export function sensOf(game) { const v = S.own[game]; return v != null ? clampS(v) : S.all; }
export function onSens(f) { subs.add(f); return () => subs.delete(f); }

// ---------- 설정 창 ----------
const CSS = `
#sens-dlg { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(15,6,40,.55); font-family: 'Jua', sans-serif; }
#sens-dlg .sd-card { width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 18px 20px; border-radius: 22px; background: #fff7fb; color: #3a2b5c; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
#sens-dlg h3 { margin: 0 0 4px; font-size: 22px; font-weight: normal; }
#sens-dlg .sd-sub { font-family: 'Gowun Dodum', sans-serif; font-size: 13px; opacity: .75; margin-bottom: 12px; }
#sens-dlg .sd-row { padding: 10px 12px; border-radius: 14px; background: #fff; border: 2px solid #f1e3f7; margin-bottom: 8px; }
#sens-dlg .sd-row.main { border-color: #ffb3d1; background: #fff0f6; }
#sens-dlg .sd-row.here { box-shadow: 0 0 0 3px #ffd84d inset; }
#sens-dlg .sd-top { display: flex; align-items: center; gap: 8px; font-size: 16px; }
#sens-dlg .sd-top b { font-weight: normal; flex: 1; }
#sens-dlg .sd-top label { font-family: 'Gowun Dodum', sans-serif; font-size: 13px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
#sens-dlg .sd-val { min-width: 52px; text-align: right; color: #e0457b; }
#sens-dlg .sd-row.off .sd-val { color: #b9a9c9; }
#sens-dlg input[type=range] { width: 100%; margin: 6px 0 0; accent-color: #ff6fa5; }
#sens-dlg .sd-row.off input[type=range] { opacity: .35; }
#sens-dlg .sd-btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
#sens-dlg button { font-family: 'Jua', sans-serif; font-size: 15px; padding: 8px 16px; border-radius: 999px; border: 0; cursor: pointer; background: #ff6fa5; color: #fff; }
#sens-dlg button.ghost { background: #eee3f5; color: #3a2b5c; }
`;
// here: 지금 있는 게임 키 (그 줄을 눈에 띄게)
export function openSens(here, onClose) {
  if (document.getElementById('sens-dlg')) return;
  if (!document.getElementById('sens-css')) { const st = document.createElement('style'); st.id = 'sens-css'; st.textContent = CSS; document.head.appendChild(st); }
  document.exitPointerLock?.();
  const d = document.createElement('div'); d.id = 'sens-dlg';
  const fmt = (v) => `${(+v).toFixed(2)}배`;
  const render = () => {
    d.innerHTML = `<div class="sd-card"><h3>🖱️ 마우스 감도</h3><div class="sd-sub">모든 게임이 같이 써요 · 게임마다 '따로' 를 켜면 그 게임만 다르게 · 1.00배 = 원래 감도</div>
      <div class="sd-row main"><div class="sd-top"><b>🍬 모든 게임</b><span class="sd-val">${fmt(S.all)}</span></div><input type="range" data-k="all" min="${MIN}" max="${MAX}" step="0.05" value="${S.all}"></div>
      ${SENS_GAMES.map((g) => { const own = S.own[g.key] != null; return `<div class="sd-row${own ? '' : ' off'}${g.key === here ? ' here' : ''}"><div class="sd-top"><b>${g.name}${g.key === here ? ' <small>(지금)</small>' : ''}</b><label><input type="checkbox" data-own="${g.key}" ${own ? 'checked' : ''}>따로</label><span class="sd-val">${fmt(sensOf(g.key))}</span></div><input type="range" data-k="${g.key}" min="${MIN}" max="${MAX}" step="0.05" value="${sensOf(g.key)}" ${own ? '' : 'disabled'}></div>`; }).join('')}
      <div class="sd-btns"><button class="ghost" data-reset>↺ 처음대로</button><button data-ok>확인</button></div></div>`;
    d.querySelectorAll('input[type=range]').forEach((r) => {
      r.oninput = () => {
        const v = clampS(r.value);
        if (r.dataset.k === 'all') S.all = v; else S.own[r.dataset.k] = v;
        save();
        r.parentElement.querySelector('.sd-val').textContent = fmt(v);
        if (r.dataset.k === 'all') d.querySelectorAll('.sd-row.off').forEach((row) => { row.querySelector('.sd-val').textContent = fmt(v); row.querySelector('input[type=range]').value = v; });
      };
    });
    d.querySelectorAll('[data-own]').forEach((c) => { c.onchange = () => { if (c.checked) S.own[c.dataset.own] = S.all; else delete S.own[c.dataset.own]; save(); render(); }; });
    d.querySelector('[data-reset]').onclick = () => { S = { all: 1, own: {} }; save(); render(); };
    d.querySelector('[data-ok]').onclick = close;
  };
  const close = () => { d.remove(); removeEventListener('keydown', esc, true); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  d.addEventListener('mousedown', (e) => { if (e.target === d) close(); });
  addEventListener('keydown', esc, true);
  render();
  document.body.appendChild(d);
}
