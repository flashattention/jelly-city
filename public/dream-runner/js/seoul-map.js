// 서울 전체 지도: 25개 구(이름) · 만들어 둔 지역(색 있는 코스 선 · 이름) · 아직 없는 구(회색 · 준비 중) · 내 위치
//   누른 곳에서 가장 가까운 지역 코스 지점을 고른다 (600m 안). 아니면 그 구 이름과 '준비 중'
const COLORS = ['#ff7aa8', '#ffb547', '#7be07b', '#4fc3ff', '#b57bff', '#ff8a5c', '#2fd3c8', '#ffd23f', '#9fb6ff', '#ff6b6b', '#c3e86a', '#f29bd8', '#8fd1ff'];

export class SeoulMap {
  constructor(data, labels = {}) {
    this.d = data; this.labels = labels; const U = data.unit || 10;
    this.gu = data.gu.map((g) => ({ name: g.name, rings: g.rings.map((r) => { const p = []; for (let i = 0; i < r.length; i += 2) p.push([r[i] * U, r[i + 1] * U]); return p; }) }));
    this.regions = data.regions.map((R, i) => { const pts = []; for (let k = 0; k < R.route.length; k += 2) pts.push([R.route[k], R.route[k + 1]]); const acc = [0]; for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); return { ...R, pts, acc, color: COLORS[i % COLORS.length] }; });
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const g of this.gu) for (const r of g.rings) for (const [x, z] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const pad = 900; this.b = [x0 - pad, x1 + pad, z0 - pad, z1 + pad];
    // 구마다 지역이 있는지 (코스 점이 그 구 안에)
    for (const g of this.gu) { g.regions = this.regions.filter((R) => R.pts.some(([x, z]) => g.rings.some((r) => inRing(x, z, r)))); let cx = 0, cz = 0, n = 0; for (const [x, z] of g.rings[0] || []) { cx += x; cz += z; n++; } g.c = [cx / n, cz / n]; }
  }
  // 화면 비율 맞추기
  //   확대(zoom 1 ~ 8) · 가운데(cx, cz): 확대하면 그 둘레만 크게 (끌어서 옮기기)
  fit(w, h) { const [x0, x1, z0, z1] = this.b, Z = this.zoom || 1, k0 = Math.min(w / (x1 - x0), h / (z1 - z0)), k = k0 * Z; this.cx ??= (x0 + x1) / 2; this.cz ??= (z0 + z1) / 2; const hw = w / k / 2, hh = h / k / 2; this.cx = Math.max(x0 + Math.min(hw, (x1 - x0) / 2), Math.min(x1 - Math.min(hw, (x1 - x0) / 2), this.cx)); this.cz = Math.max(z0 + Math.min(hh, (z1 - z0) / 2), Math.min(z1 - Math.min(hh, (z1 - z0) / 2), this.cz)); const ox = w / 2 - (this.cx - x0) * k, oz = h / 2 - (this.cz - z0) * k; this.v = { k, ox, oz, w, h }; }
  zoomAt(u, v, f) { if (!this.v) return; const [x, z] = this.inv(u * this.v.w, v * this.v.h), Z0 = this.zoom || 1, Z = Math.max(1, Math.min(8, Z0 * f)); if (Z === Z0) return; this.zoom = Z; this.cx = x + (this.cx - x) * (Z0 / Z); this.cz = z + (this.cz - z) * (Z0 / Z); }
  pan(du, dv) { if (!this.v) return; this.cx -= (du * this.v.w) / this.v.k; this.cz -= (dv * this.v.h) / this.v.k; }
  T(x, z) { const { k, ox, oz } = this.v; return [ox + (x - this.b[0]) * k, oz + (z - this.b[2]) * k]; }
  inv(px, pz) { const { k, ox, oz } = this.v; return [(px - ox) / k + this.b[0], (pz - oz) / k + this.b[2]]; }
  draw(c, w, h, { here = null, pick = null, t = 0 } = {}) {
    this.fit(w, h);
    c.fillStyle = '#0f1726'; c.fillRect(0, 0, w, h);
    // 구: 지역이 있는 구는 밝게, 없는 구는 회색 빗금(준비 중)
    for (const g of this.gu) { const on = this.allOpen || g.regions.length > 0; c.beginPath(); for (const r of g.rings) r.forEach(([x, z], i) => { const [a, b] = this.T(x, z); if (i) c.lineTo(a, b); else c.moveTo(a, b); }); c.closePath();
      c.fillStyle = on ? 'rgba(120, 200, 170, .22)' : 'rgba(90, 96, 110, .28)'; c.fill(); if (!on) { c.save(); c.clip(); c.strokeStyle = 'rgba(160,165,175,.12)'; c.lineWidth = 1; for (let s = -h; s < w + h; s += 9) { c.beginPath(); c.moveTo(s, 0); c.lineTo(s - h, h); c.stroke(); } c.restore(); }
      c.strokeStyle = on ? 'rgba(160, 230, 200, .7)' : 'rgba(150,155,170,.45)'; c.lineWidth = 1.2; c.stroke(); }
    // 구 이름
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const g of this.gu) { const [a, b] = this.T(...g.c), on = this.allOpen || g.regions.length > 0; c.font = `${on ? 'bold ' : ''}${Math.max(10, w * 0.016)}px sans-serif`; c.fillStyle = on ? 'rgba(220,245,235,.85)' : 'rgba(170,175,188,.7)'; c.fillText(g.name, a, b); if (!on) { c.font = `${Math.max(8, w * 0.011)}px sans-serif`; c.fillStyle = 'rgba(170,175,188,.55)'; c.fillText('준비 중', a, b + Math.max(11, w * 0.017)); } }
    // 지역 코스: 굵은 색 선 + 이름표
    for (const R of this.regions) { c.strokeStyle = R.color; c.lineWidth = Math.max(4, w * 0.007); c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = R.color; c.shadowBlur = 8; c.beginPath(); R.pts.forEach(([x, z], i) => { const [a, b] = this.T(x, z); if (i) c.lineTo(a, b); else c.moveTo(a, b); }); c.stroke(); c.shadowBlur = 0; }
    const placed = [];
    if (!this.places?.length) for (const R of this.regions) { const m = R.pts[Math.floor(R.pts.length / 2)], [a, b0] = this.T(...m); const label0 = this.labels[R.id] || R.name; c.font = `bold ${Math.max(11, w * 0.017)}px sans-serif`; const half = (c.measureText(label0).width + 12) / 2; let b = b0 - Math.max(16, w * 0.026); for (let tr = 1; tr < 12 && placed.some((p) => Math.abs(p[0] - a) < p[2] + half && Math.abs(p[1] - b) < 24); tr++) b = b0 + (tr % 2 ? -1 : 1) * Math.ceil(tr / 2) * 26 - (tr % 2 ? Math.max(16, w * 0.026) : -10); placed.push([a, b, half]); const label = this.labels[R.id] || R.name; c.font = `bold ${Math.max(11, w * 0.017)}px sans-serif`; const tw = c.measureText(label).width + 12; c.fillStyle = 'rgba(15,23,38,.85)'; c.beginPath(); c.roundRect(a - tw / 2, b - 11, tw, 22, 8); c.fill(); c.strokeStyle = R.color; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#fff'; c.fillText(label, a, b + 1); }
    this.drawPlaces(c, w);
    // 내 위치 (깜빡이는 점) · 고른 곳
    if (here) { const [a, b] = this.T(here.x, here.z), r = 6 + Math.sin(t * 5) * 2; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); c.strokeStyle = '#ff3b6b'; c.lineWidth = 3; c.stroke(); }
    if (pick) { const [a, b] = this.T(pick.x, pick.z); c.strokeStyle = pick.region ? '#ffd98a' : '#ff6b6b'; c.lineWidth = 3; c.beginPath(); c.arc(a, b, 11, 0, 7); c.stroke(); c.beginPath(); c.moveTo(a - 16, b); c.lineTo(a + 16, b); c.moveTo(a, b - 16); c.lineTo(a, b + 16); c.stroke(); }
    c.font = `${Math.max(9, w * 0.012)}px sans-serif`; c.fillStyle = 'rgba(200,205,215,.6)'; c.textAlign = 'right'; c.fillText('지도 © OpenStreetMap contributors', w - 8, h - 10);
  }
  // 동네 · 체험 명소: 아이콘 + 이름 (명소 먼저). 이름표가 겹치면 아이콘만, 아이콘도 겹치면 확대해야 보인다
  drawPlaces(c, w) {
    const P = this.places || [], Z = this.zoom || 1, fs = Math.max(11, w * 0.016), boxes = [], hit = (b) => boxes.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]); this.shown = [];
    const order = [...P].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'spot' ? -1 : 1));
    c.textBaseline = 'middle';
    for (const p of order) {
      const [a, b] = this.T(p.x, p.z); if (a < -20 || b < -20 || a > this.v.w + 20 || b > this.v.h + 20) continue;
      const spot = p.kind === 'spot', r = spot ? fs * 0.95 : fs * 0.78, ib = [a - r, b - r, a + r, b + r];
      if (hit(ib)) continue; boxes.push(ib); this.shown.push({ p, a, b, r });
      c.beginPath(); c.arc(a, b, r, 0, 7); c.fillStyle = spot ? (p.done ? '#ffe3e8' : '#fff4d6') : 'rgba(15,23,38,.86)'; c.fill(); c.lineWidth = spot ? 2.5 : 1.5; c.strokeStyle = spot ? (p.done ? '#d0283c' : '#ff9f1a') : 'rgba(160,230,200,.8)'; c.stroke();
      c.font = `${Math.round(r * 1.15)}px sans-serif`; c.textAlign = 'center'; c.fillStyle = '#000'; c.fillText(p.icon || '📍', a, b + 1);
      c.font = `bold ${Math.round(fs * (spot ? 0.95 : 0.88))}px sans-serif`; const tw = c.measureText(p.name).width + 12, lb = [a + r + 2, b - fs * 0.7, a + r + 2 + tw, b + fs * 0.7];
      if (hit(lb) || (!spot && Z < 1.3 && P.length > 30 && this.shown.length > 34)) continue; boxes.push(lb);
      c.fillStyle = spot ? 'rgba(255,248,232,.94)' : 'rgba(15,23,38,.82)'; c.beginPath(); c.roundRect(lb[0], lb[1], tw, lb[3] - lb[1], 7); c.fill(); c.fillStyle = spot ? '#3a2400' : '#fff'; c.textAlign = 'left'; c.fillText(p.name, lb[0] + 6, b + 1);
    }
    c.textAlign = 'center';
  }
  // 화면 비율(0 ~ 1) → 고른 곳
  pickAt(u, v) {
    const [x, z] = this.inv(u * this.v.w, v * this.v.h); let best = null;
    // 아이콘을 누르면 그 동네 · 명소
    { const px = u * this.v.w, pz = v * this.v.h; let bp = null, bd = Infinity; for (const s of this.shown || []) { const d = Math.hypot(s.a - px, s.b - pz); if (d < s.r + 8 && d < bd) { bd = d; bp = s.p; } } if (bp) { const [gx, gz, gf] = bp.go || [bp.x, bp.z, 0]; return { region: bp.region || null, place: bp, name: bp.name, x: gx, z: gz, face: gf, s: bp.s, gu: this.gu.find((g) => g.rings.some((r) => inRing(gx, gz, r)))?.name || '' }; } }
    for (const R of this.regions) for (let k = 1; k < R.pts.length; k++) { const [ax, az] = R.pts[k - 1], [bx, bz] = R.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz); if (!best || d < best.d) best = { d, R, s: R.acc[k - 1] + Math.sqrt(L2) * t, x: px, z: pz }; }
    const gu = this.gu.find((g) => g.rings.some((r) => inRing(x, z, r)))?.name || '';
    if (best && best.d < 600) return { region: best.R.id, name: this.labels[best.R.id] || best.R.name, s: best.s, x: best.x, z: best.z, gu };
    return { region: null, x, z, gu };
  }
}
function inRing(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
