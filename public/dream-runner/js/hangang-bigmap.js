// 서울 산책 큰 지도 (8-25): 게임 위 반투명 창 · 따로 띄운 브라우저 창(map.html) 이 같은 그림을 그린다
//   S = { img(지도 그림), o: [ox, oz, R](그림이 덮는 곳: 가운데 ± R m), x, z, face, yaw, trail: [[x, z] …], marks: [[이름, x, z, 색]], where, span(화면 반 폭 m), cx?, cz?(끌어 옮긴 가운데), top?(위 단추 줄 높이) }
//   좌표: x = 동쪽, z = 남쪽 (미터). 늘 북쪽이 위
export const MAP_CH = 'jelly-seoul-map';

export function drawBigMap(ctx, W, H, S) {
  const span = S.span || 600, k = Math.min(W, H) / 2 / span, cx = S.cx ?? S.x, cz = S.cz ?? S.z;
  const T = (x, z) => [W / 2 + (x - cx) * k, H / 2 + (z - cz) * k];
  ctx.save(); ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#e9e5dc'; ctx.fillRect(0, 0, W, H);
  // 지도 그림 (불러온 동네 칸들)
  if (S.img && S.o) {
    const [ox, oz, R] = S.o, N = S.img.width, ik = N / (2 * R), sx = (cx - span * (W / Math.min(W, H)) - ox + R) * ik, sz = (cz - span * (H / Math.min(W, H)) - oz + R) * ik, sw = 2 * span * (W / Math.min(W, H)) * ik, sh = 2 * span * (H / Math.min(W, H)) * ik;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(S.img, sx, sz, sw, sh, 0, 0, W, H);
  }
  // 지나온 길
  if (S.trail?.length > 1) { ctx.strokeStyle = 'rgba(255,77,109,.85)'; ctx.lineWidth = 3; ctx.lineJoin = ctx.lineCap = 'round'; ctx.setLineDash([6, 5]); ctx.beginPath(); S.trail.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); ctx.stroke(); ctx.setLineDash([]); }
  // 역 · 명소 이름
  const fs = Math.max(11, Math.round(Math.min(W, H) / 36)); ctx.font = `bold ${fs}px 'Jua', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const [n, x, z, col] of S.marks || []) { const [a, b] = T(x, z); if (a < -40 || a > W + 40 || b < -20 || b > H + 20) continue; ctx.fillStyle = col || '#3a6fd8'; ctx.beginPath(); ctx.arc(a, b, 4.5, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.strokeText(n, a, b - 6); ctx.fillStyle = '#1d2333'; ctx.fillText(n, a, b - 6); }
  // 나: 보는 쪽 부채꼴 + 가는 쪽 화살표
  { const [a, b] = T(S.x, S.z); ctx.save(); ctx.translate(a, b);
    const ya = Math.atan2(Math.cos(S.yaw), Math.sin(S.yaw)), r = Math.min(W, H) * 0.16; const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, r); gr.addColorStop(0, 'rgba(47,128,237,.45)'); gr.addColorStop(1, 'rgba(47,128,237,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, ya - 0.55, ya + 0.55); ctx.closePath(); ctx.fill();
    ctx.rotate(-S.face + Math.PI); ctx.fillStyle = '#ff2d55'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // 나침반 (오른쪽 위): N 빨강 · E S W
  { const r = Math.max(22, Math.min(W, H) * 0.07), a = W - r - 12, b = r + 12 + (S.top || 0); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(30,35,50,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#d0283c'; ctx.beginPath(); ctx.moveTo(a, b - r * 0.5); ctx.lineTo(a + r * 0.16, b); ctx.lineTo(a - r * 0.16, b); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#8a92a3'; ctx.beginPath(); ctx.moveTo(a, b + r * 0.5); ctx.lineTo(a + r * 0.16, b); ctx.lineTo(a - r * 0.16, b); ctx.closePath(); ctx.fill();
    ctx.font = `bold ${Math.round(r * 0.36)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#d0283c'; ctx.fillText('N', a, b - r * 0.74); ctx.fillStyle = '#4a5266'; ctx.fillText('E', a + r * 0.74, b); ctx.fillText('S', a, b + r * 0.74); ctx.fillText('W', a - r * 0.74, b); }
  // 축척 막대 (왼쪽 아래)
  { const want = span / 3, nice = [50, 100, 200, 250, 500, 1000, 2000].find((q) => q >= want) || 2000, L = nice * k, x0 = 14, y0 = H - 16; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x0 - 6, y0 - 22, L + 12, 30); ctx.fillStyle = '#1d2333'; ctx.fillRect(x0, y0 - 4, L, 4); ctx.fillRect(x0, y0 - 9, 2, 9); ctx.fillRect(x0 + L - 2, y0 - 9, 2, 9); ctx.font = `bold ${Math.round(fs * 0.9)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(nice >= 1000 ? `${nice / 1000}km` : `${nice}m`, x0 + L / 2, y0 - 7); }
  ctx.restore();
}
