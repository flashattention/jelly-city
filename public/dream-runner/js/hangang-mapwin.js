// 서울 산책 큰 지도 창 (8-25): M 키 · 🗺️ 단추로 여닫는 반투명 창 (끌어 옮기기 · 크기 조절 · 켜 둔 채 달리기)
//   ⧉ 단추 = 브라우저 창을 따로 띄워(두 번째 모니터용) 같은 지도를 실시간으로 (BroadcastChannel, map.html)
//   휴대폰은 화면 가득 (새 창 단추 없음)
import { drawBigMap, MAP_CH } from './hangang-bigmap.js';

const css = `
#hg-bigmap{position:fixed;right:16px;top:70px;width:min(440px,46vw);height:min(470px,70vh);min-width:240px;min-height:240px;z-index:25;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;resize:both;background:rgba(18,22,36,.55);backdrop-filter:blur(6px);box-shadow:0 10px 34px rgba(0,0,0,.4);border:2px solid rgba(255,255,255,.55);opacity:.96}
#hg-bigmap.hidden{display:none}
#hg-bigmap .bm-head{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;color:#fff;font-family:'Jua',sans-serif;cursor:move;user-select:none;touch-action:none;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0))}
#hg-bigmap .bm-head b{font-weight:normal;font-size:16px;white-space:nowrap}
#hg-bigmap .bm-where{flex:1;min-width:0;font-size:13px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hg-bigmap .bm-btns{display:flex;gap:4px}
#hg-bigmap .bm-btns button{border:0;border-radius:10px;min-width:30px;height:30px;padding:0 6px;font-size:15px;cursor:pointer;background:rgba(255,255,255,.88);color:#1d2333;font-family:'Jua',sans-serif}
#hg-bigmap .bm-btns button:hover{background:#fff}
#hg-bigmap canvas{flex:1;width:100%;min-height:0;display:block;touch-action:none;cursor:grab}
body.touch #hg-bigmap{inset:0;width:auto;height:auto;border-radius:0;resize:none;border:0;opacity:1}
body.touch #hg-bigmap .bm-head{cursor:default;padding-top:max(6px,env(safe-area-inset-top))}
body.touch #hg-bigmap .bm-win{display:none}
body.touch #hg-bigmap .bm-btns button{min-width:38px;height:38px;font-size:18px}
`;

export function setupMapWin({ getHg, openPicker }) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'hg-bigmap'; el.className = 'hidden';
  el.innerHTML = `<div class="bm-head"><b>🗺️ 지도</b><span class="bm-where"></span><div class="bm-btns"><button data-a="out" aria-label="작게">−</button><button data-a="in" aria-label="크게">+</button><button data-a="me" aria-label="내 위치로">◎</button><button data-a="win" class="bm-win" aria-label="새 창으로" title="새 창으로 (두 번째 화면)">⧉</button><button data-a="pick" aria-label="다른 곳으로 가기" title="다른 곳으로 가기">📍</button><button data-a="x" aria-label="닫기">✕</button></div></div><canvas></canvas>`;
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), head = el.querySelector('.bm-head'), whereEl = el.querySelector('.bm-where');
  const S = { span: 650, cx: null, cz: null, trail: [], last: null, out: null, drawT: 0, sendT: 0, imgKey: '', win: null };
  let ch = null; try { ch = new BroadcastChannel(MAP_CH); } catch { /* 없음 */ }
  // 지금 바깥 자리: 역 · 가게 · 몰 · 열차 안(먼 곳에 지은 실내)이면 들어간 입구 자리
  const outPos = (hg) => {
    if (hg.inside?.from) return [hg.inside.from.x, hg.inside.from.z];
    if (hg.inShop?.F && !hg.inShop.F.mall) return [hg.inShop.F.x, hg.inShop.F.z];
    if (hg.inMall?.D) return [hg.inMall.D.x, hg.inMall.D.z];
    if (Math.abs(hg.px) > 60000 || Math.abs(hg.pz) > 60000) return S.out || [0, 0];
    return [hg.px, hg.pz];
  };
  const marks = (hg, x, z) => (hg.stations || []).filter((q) => Math.abs(q.x - x) < 3200 && Math.abs(q.z - z) < 3200).map((q) => [q.name, q.x, q.z, '#2f6fd8']);
  const state = (hg) => { const [x, z] = S.out || outPos(hg); return { x, z, face: hg.face || 0, yaw: hg.camYaw || 0, trail: S.trail, marks: marks(hg, x, z), where: hg.where?.() || '', o: hg.miniO }; };
  const draw = () => {
    const hg = getHg(); if (!hg?.ready) return; const dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(50, cv.clientWidth), H = Math.max(50, cv.clientHeight);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = state(hg); drawBigMap(ctx, W, H, { ...s, img: hg.minimapImage(), o: hg.miniO, span: S.span, cx: S.cx ?? undefined, cz: S.cz ?? undefined });
    whereEl.textContent = s.where;
  };
  // 따로 띄운 창으로: 지도 그림은 바뀔 때만, 자리는 0.1초마다
  const sendImg = (hg, force) => { if (!ch || !hg.minimapImage) return; const img = hg.minimapImage(), key = hg.miniKey || 'one'; if (!force && key === S.imgKey) return; S.imgKey = key; img.toBlob((b) => { try { ch.postMessage({ t: 'img', blob: b, o: hg.miniO }); } catch { /* 못 보냄 */ } }, 'image/png'); };
  if (ch) ch.onmessage = (e) => { if (e.data?.t === 'hello') { const hg = getHg(); if (hg?.ready) { S.winAlive = performance.now(); sendImg(hg, true); ch.postMessage({ t: 'pos', ...state(hg) }); } } else if (e.data?.t === 'alive') S.winAlive = performance.now(); };
  const api = {
    get open() { return !el.classList.contains('hidden'); },
    toggle(on = !api.open) { el.classList.toggle('hidden', !on); if (on) { S.cx = S.cz = null; draw(); } },
    // 매 프레임 (main.js hgFrame)
    tick(dt) {
      const hg = getHg(); if (!hg?.ready) return;
      const [x, z] = outPos(hg); S.out = [x, z];
      const L = S.trail.at(-1); if (!L || Math.hypot(L[0] - x, L[1] - z) > 8) { if (L && Math.hypot(L[0] - x, L[1] - z) > 400) S.trail.length = 0; S.trail.push([Math.round(x), Math.round(z)]); if (S.trail.length > 700) S.trail.splice(0, S.trail.length - 700); }
      if (api.open) { S.drawT -= dt; if (S.drawT <= 0) { S.drawT = 1 / 20; draw(); } }
      if (ch && S.winAlive && performance.now() - S.winAlive < 6000) { S.sendT -= dt; if (S.sendT <= 0) { S.sendT = 0.1; sendImg(hg); try { ch.postMessage({ t: 'pos', ...state(hg) }); } catch { /* 못 보냄 */ } } }
    },
  };
  el.querySelector('.bm-btns').onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'in') S.span = Math.max(120, S.span / 1.5); else if (a === 'out') S.span = Math.min(3000, S.span * 1.5);
    else if (a === 'me') S.cx = S.cz = null;
    else if (a === 'x') api.toggle(false);
    else if (a === 'pick') { api.toggle(false); openPicker?.(); }
    else if (a === 'win') { S.win = window.open(new URL('../map.html', import.meta.url).href, 'jelly-seoul-map', 'width=720,height=720'); S.winAlive = performance.now(); }
    draw();
  };
  // 창 끌어 옮기기 (머리줄)
  head.addEventListener('pointerdown', (e) => { if (e.target.closest('button') || document.body.classList.contains('touch')) return; const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top; head.setPointerCapture(e.pointerId);
    const mv = (ev) => { el.style.left = `${Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox))}px`; el.style.top = `${Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy))}px`; el.style.right = 'auto'; };
    const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); }; head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); });
  // 지도 끌어 둘러보기 · 휠 = 확대 · 두 손가락 = 확대
  const pts = new Map(); let pinch0 = 0, span0 = 0;
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); span0 = S.span; } });
  cv.addEventListener('pointermove', (e) => { const p = pts.get(e.pointerId); if (!p) return; const hg = getHg(); if (!hg) return;
    if (pts.size === 2) { pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 10) S.span = Math.max(120, Math.min(3000, span0 * pinch0 / d)); draw(); return; }
    const k = Math.min(cv.clientWidth, cv.clientHeight) / 2 / S.span, [x, z] = S.out || [hg.px, hg.pz]; S.cx = (S.cx ?? x) - (e.clientX - p[0]) / k; S.cz = (S.cz ?? z) - (e.clientY - p[1]) / k; pts.set(e.pointerId, [e.clientX, e.clientY]); draw(); });
  const end = (e) => { pts.delete(e.pointerId); pinch0 = 0; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); S.span = Math.max(120, Math.min(3000, S.span * (e.deltaY > 0 ? 1.15 : 1 / 1.15))); draw(); }, { passive: false });
  // 게임 키(W A S D …)가 지도 창 단추에 걸리지 않게
  el.addEventListener('keydown', (e) => e.stopPropagation());
  return api;
}
