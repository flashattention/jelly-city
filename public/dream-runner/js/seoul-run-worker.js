// 🗺️ 서울 맵 칸 고르기 일꾼 (러너-개선 6-7): 서울 칸 지도를 받아 코스 길 둘레만 남긴다 (화면이 멈추지 않게 따로 스레드에서)
//   받는 것: { id, url, pts: [x, z, ...] (코스 길 8m 간격), RB (건물 반지름), RR (길 · 녹지 · 물 반지름), taken: { 칸 항목: [이미 지은 번호] } }
//   주는 것: { id, M (고른 지도), kept: { 칸 항목: [남긴 번호] } }
const GS = 20;
// 길 둘레 칸 표시 (20m 칸): 반지름 R 안이면 1
function mask(pts, R) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 1]); z1 = Math.max(z1, pts[i + 1]); }
  const gx0 = Math.floor((x0 - R) / GS) - 1, gz0 = Math.floor((z0 - R) / GS) - 1, nx = Math.ceil((x1 + R) / GS) + 2 - gx0, nz = Math.ceil((z1 + R) / GS) + 2 - gz0, g = new Uint8Array(nx * nz), n = Math.ceil(R / GS) + 1, R2 = (R + GS * 0.71) ** 2;
  for (let i = 0; i < pts.length; i += 2) { const px = pts[i], pz = pts[i + 1], cx = Math.floor(px / GS) - gx0, cz = Math.floor(pz / GS) - gz0;
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) { const X = cx + a, Z = cz + b; if (X < 0 || Z < 0 || X >= nx || Z >= nz) continue; const mx = (X + gx0 + 0.5) * GS - px, mz = (Z + gz0 + 0.5) * GS - pz; if (mx * mx + mz * mz < R2) g[Z * nx + X] = 1; } }
  return (x, z) => { const X = Math.floor(x / GS) - gx0, Z = Math.floor(z / GS) - gz0; return X >= 0 && Z >= 0 && X < nx && Z < nz && g[Z * nx + X] === 1; };
}
// 코스 길 차로 위 점(8m 마다 + 사이 4m, 옆으로 -h · 0 · +h)이 다각형(f, o부터 x z ...) 안에 있는지
function laneTest(pts, h) {
  const Q = [];
  if (h > 0) for (let i = 0; i + 3 < pts.length; i += 2) { const x = pts[i], z = pts[i + 1], dx = pts[i + 2] - x, dz = pts[i + 3] - z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    for (const k of [0, 0.5]) for (const o of [-h, -h / 2, 0, h / 2, h]) Q.push(x + dx * k + nx * o, z + dz * k + nz * o); }
  return (f, o, S) => {
    if (!Q.length) return false;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; const n = (f.length - o) >> 1;
    for (let i = 0; i < n; i++) { const x = f[o + i * 2] * S, z = f[o + i * 2 + 1] * S; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    for (let q = 0; q < Q.length; q += 2) { const px = Q[q], pz = Q[q + 1]; if (px < x0 || px > x1 || pz < z0 || pz > z1) continue;
      let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = f[o + i * 2] * S, zi = f[o + i * 2 + 1] * S, xj = f[o + j * 2] * S, zj = f[o + j * 2 + 1] * S; if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) c = !c; }
      if (c) return true; }
    return false;
  };
}
self.onmessage = async (e) => {
  const { id, url, pts, RB, RR, taken = {}, half = 0 } = e.data;
  try {
    const res = await fetch(url); if (!res.ok) throw new Error('칸 없음'); const M = await res.json(), S = M.scale || 0.1;
    const nearB = mask(pts, RB), nearR = mask(pts, RR);
    const flatNear = (f, o, near) => { const n = (f.length - o) >> 1; if (n <= 0) return false; const st = Math.max(1, Math.floor(n / 32)); for (let i = 0; i < n; i += st) if (near(f[o + i * 2] * S, f[o + i * 2 + 1] * S)) return true; return near(f[f.length - 2] * S, f[f.length - 1] * S); };
    // 넓은 면(물 · 녹지 · 공원): 테두리 상자 안에 길 둘레 점이 있으면
    const boxNear = (f, o, R) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = o; i < f.length; i += 2) { const x = f[i] * S, z = f[i + 1] * S; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } for (let i = 0; i < pts.length; i += 2) if (pts[i] > x0 - R && pts[i] < x1 + R && pts[i + 1] > z0 - R && pts[i + 1] < z1 + R) return true; return false; };
    const kept = {}, sel = (field, test) => { const arr = M[field] || [], tk = new Set(taken[field] || []), out = [], idx = []; arr.forEach((it, i) => { if (!tk.has(i) && test(it)) { out.push(it); idx.push(i); } }); kept[field] = idx; return [out, idx]; };
    const N = { ...M };
    [N.water] = sel('water', (p) => boxNear(p[0], 0, RR)); [N.island] = sel('island', (p) => boxNear(p[0], 0, RR));
    [N.green] = sel('green', (p) => boxNear(p[1], 0, RR)); [N.areas] = sel('areas', (p) => boxNear(p, 1, RR));
    { const [r, idx] = sel('roads', (rd) => flatNear(rd, 2, nearR)); N.roads = r; N.roadNames = idx.map((i) => M.roadNames?.[i] || ''); }
    [N.alleys] = sel('alleys', (a) => flatNear(a, 1, nearR)); [N.paths] = sel('paths', (a) => flatNear(a, 2, nearR)); [N.rails] = sel('rails', (a) => flatNear(a, 0, nearR));
    [N.bridges] = sel('bridges', (b) => flatNear(b.p, 0, nearR));
    // 건물: 가게 간판(shops2)은 건물 번호로 이어져 있어 번호를 새로 매긴다
    // 6-10: 곰이 달리는 차로(바깥 레인 가운데 + 0.2m) 안으로 들어온 건물은 뺀다 (지도 외곽선이 길 위로 나와 곰이 건물을 뚫고 달렸다)
    const lane = laneTest(pts, (half * 2) / 3 + 0.2);
    { const [b, idx] = sel('buildings', (bd) => flatNear(bd, 7, nearB) && !lane(bd, 7, S)), map = new Map(idx.map((i, k) => [i, k])); N.buildings = b; N.binfo = idx.map((i) => M.binfo?.[i] || null); N.shops2 = (M.shops2 || []).filter((s2) => map.has(s2[2])).map((s2) => { const t = [...s2]; t[2] = map.get(s2[2]); return t; }); }
    [N.shops] = sel('shops', (s2) => nearB(s2[2] * S, s2[3] * S)); [N.stations] = sel('stations', (s2) => nearB(s2[1] * S, s2[2] * S)); [N.entrances] = sel('entrances', (en) => nearB(en[0] * S, en[1] * S));
    self.postMessage({ id, M: N, kept });
  } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
