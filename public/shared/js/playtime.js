// 플레이 시간 알리기: 게임 화면이 보이고 2분 안에 움직임(키 · 마우스 · 터치)이 있으면 1분마다 한 번
//   메인 화면 카드의 "7일간 플레이 n시간" · 인기순 정렬에 쓴다 (누가 했는지는 보내지 않는다)
(() => {
  const game = location.pathname.split('/').filter(Boolean)[0];
  if (!/^(dream-runner|jelly-[a-z]+)$/.test(game || '')) return;
  let last = Date.now(), id = '';
  try { id = sessionStorage.getItem('jelly.pt') || Math.random().toString(36).slice(2); sessionStorage.setItem('jelly.pt', id); } catch { /* 없음 */ }
  for (const ev of ['keydown', 'pointerdown', 'pointermove', 'touchstart', 'wheel']) addEventListener(ev, () => { last = Date.now(); }, { passive: true, capture: true });
  const base = window.__TOSS__?.apiBase || '';
  setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - last > 120000) return;
    fetch(`${base}/api/playtime`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, id }), keepalive: true }).catch(() => {});
  }, 60000);
})();
