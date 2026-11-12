// 드림 러너 🗺️ 서울 맵 코스 길 만들기 (러너-개선 6-7)
//   코스마다 지나는 곳(위경도)을 이어, 서울 칸 지도(public/dream-runner/seoul/t_*.json)의 찻길 · 골목 · 산책길 위로 가장 짧은 길을 찾는다
//   결과: public/dream-runner/js/seoul-routes.js (브라우저와 서버 기록 다시 돌리기가 함께 쓴다)
//     pts: 실제 경로 선 (4m 간격, 서울 좌표 x = 동쪽 · z = 남쪽, 0.1m 정수)
//     xs: 길을 가로지르는 다른 길 [거리 m, 그 길 폭 m] (교차로 · 횡단보도 자리)
//     bus: 버스정류장 자리 [거리 m] (서울 산책과 같은 규칙: 폭 14m 넘는 길, 교차로 지나 30m)
//     w: 20m 마다 달리는 길의 폭 (m, 찻길이 아니면 0)
//     tiles: 경로에서 350m 안에 걸치는 칸
//   쓰는 법: node tools/seoul-run-courses.mjs [코스 번호]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'public/dream-runner/seoul');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574, T = 2000;
const P = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];

// seouls.js 의 SEOULS 와 같은 순서
//   via = 지나는 곳 [위도, 경도] (그 사이는 찻길 · 골목 · 산책길로 가장 짧게)
//   ['R', 지역, 시작 m, 길이 m, 거꾸로] = 젤리 서울 러너 지역 코스 선(hangang/seoul.json)의 그 구간을 그대로
const COURSES = [
  ['banpo', '반포 한강공원', [['R', 'banpo', 600, 1500]]],
  ['yeouido', '여의도 한강공원', [['R', 'yeouido', 900, 1600]]],
  ['yunjung', '윤중로', [[37.53340, 126.91250], [37.53020, 126.91240], [37.52520, 126.91640]]],
  ['hongdae', '홍대 걷고싶은거리', [['R', 'hongdae', 0, 770], [37.55720, 126.92450]]],
  ['yeonnam', '경의선숲길', [[37.55780, 126.92480], [37.56150, 126.92160], [37.56600, 126.91700]]],
  ['myeongdong', '명동', [['R', 'myeongdong', 0, 521], [37.56600, 126.98870], [37.56650, 126.99350]]],
  ['insadong', '인사동', [['R', 'insadong', 0, 638], [37.57040, 126.99300]]],
  ['cheonggye', '청계천', [[37.56930, 126.97900], [37.56940, 126.98800], [37.56970, 126.99800]]],
  ['gwanghwamun', '광화문 광장', [[37.56620, 126.97790], [37.57100, 126.97690], [37.57560, 126.97690]]],
  ['bukchon', '북촌', [['R', 'bukchon', 0, 1346]]],
  ['namsan', '남산 소월길', [[37.55700, 126.97640], [37.55501, 126.97706], [37.55340, 126.97891], [37.55224, 126.98142], [37.55041, 126.98356], [37.54840, 126.98438], [37.54654, 126.98530], [37.54603, 126.98739], [37.54617, 126.98917], [37.54442, 126.99097], [37.54267, 126.99187], [37.54232, 126.99425]]],
  ['seokchon', '석촌호수', [['R', 'jamsil', 0, 1286]]],
  ['jamsil', '롯데월드타워', [[37.51370, 127.09900], [37.51480, 127.10500], [37.51650, 127.11300]]],
  ['seongsu', '성수 카페거리', [['R', 'seongsu', 0, 1264]]],
  ['itaewon', '이태원', [['R', 'itaewon', 0, 1661]]],
  ['gangnam', '강남대로', [['R', 'gangnam', 0, 1600]]],
  ['seoulforest', '서울숲', [[37.54320, 127.03780], [37.54520, 127.04050], [37.54780, 127.04250]]],
  ['deoksugung', '덕수궁 돌담길', [[37.56560, 126.97690], [37.56490, 126.97500], [37.56580, 126.97270], [37.56890, 126.96950]]],
  ['ddp', 'DDP', [[37.56240, 127.00860], [37.56620, 127.00900], [37.57110, 127.00930], [37.57180, 127.01500]]],
  ['seoullo', '서울역 · 숭례문', [[37.55500, 126.97260], [37.56000, 126.97520], [37.56380, 126.97700]]],
];
const SJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dream-runner/hangang/seoul.json'), 'utf8'));
function regionPart(id, from, len, rev) {
  const R = SJ.regions.find((q) => q.id === id), U = 1; let p = []; for (let k = 0; k < R.route.length; k += 2) p.push([R.route[k] * U, R.route[k + 1] * U]); if (rev) p.reverse();
  const out = []; let acc = 0; for (let k = 0; k < p.length; k++) { if (k) acc += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); if (acc >= from && acc <= from + len) out.push(p[k]); } return out;
}
const tileCache = new Map();
function tile(i, j) { const k = `${i}_${j}`; if (!tileCache.has(k)) { const f = path.join(DIR, `t_${k}.json`); tileCache.set(k, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null); } return tileCache.get(k); }
const unpack = (a, s = 0.1) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i] * s, a[i + 1] * s]); return o; };

function build(idx) {
  const [id, name, via] = COURSES[idx], parts = via.map((v) => (v[0] === 'R' ? { pts: regionPart(v[1], v[2], v[3], v[4]) } : { pts: [P(v[0], v[1])], via: true })), W = parts.flatMap((q) => q.pts);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of W) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const PAD = 500; x0 -= PAD; x1 += PAD; z0 -= PAD; z1 += PAD;
  // 그 둘레 칸들의 길 (찻길 · 골목 · 산책길)
  const roads = [], others = [];
  for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) for (let j = Math.floor(z0 / T); j <= Math.floor(z1 / T); j++) {
    const M = tile(i, j); if (!M) continue;
    M.roads.forEach((rd, k) => { if (rd[1]) return; roads.push({ w: rd[0], name: M.roadNames?.[k] || '', pts: unpack(rd.slice(2)), kind: 'road' }); });
    for (const [w, ...f] of M.alleys || []) others.push({ w: Math.max(3, w), pts: unpack(f), kind: 'alley' });
    for (const pa of M.paths || []) { if (pa[0]) continue; others.push({ w: Math.max(2.4, pa[1]), pts: unpack(pa.slice(2)), kind: 'path' }); }
  }
  // 2m 칸 비용 지도: 길 가운데일수록 싸다 (가장자리 · 골목은 조금 비싸게)
  const C = 2, NX = Math.ceil((x1 - x0) / C), NZ = Math.ceil((z1 - z0) / C), cost = new Float32Array(NX * NZ).fill(40);
  // 길이 없는 칸도 아주 비싸게는 지나갈 수 있다 (지도에서 끊긴 짧은 틈을 잇는다)
  const paint = (L, base) => { const hw = L.w / 2 + 0.5; for (let k = 1; k < L.pts.length; k++) { const [ax, az] = L.pts[k - 1], [bx, bz] = L.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const gx0 = Math.max(0, Math.floor((Math.min(ax, bx) - hw - x0) / C)), gx1 = Math.min(NX - 1, Math.floor((Math.max(ax, bx) + hw - x0) / C)), gz0 = Math.max(0, Math.floor((Math.min(az, bz) - hw - z0) / C)), gz1 = Math.min(NZ - 1, Math.floor((Math.max(az, bz) + hw - z0) / C));
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const px = x0 + (gx + 0.5) * C, pz = z0 + (gz + 0.5) * C, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)), d = Math.hypot(ax + dx * t - px, az + dz * t - pz); if (d > hw) continue; const c = base * (1 + 3 * (d / hw) ** 2), q = gz * NX + gx; if (c < cost[q]) cost[q] = c; } } };
  for (const L of others) paint(L, L.kind === 'path' ? 1.15 : 1.35);
  for (const L of roads) paint(L, 1);
  // 지나는 곳마다 가까운 길 칸으로 붙이고, 차례로 A* (8방향)
  const snap = ([x, z]) => { const gx = Math.floor((x - x0) / C), gz = Math.floor((z - z0) / C); let best = -1, bd = Infinity; for (let r = 0; r < 80 && best < 0; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const X = gx + a, Z = gz + b; if (X < 0 || Z < 0 || X >= NX || Z >= NZ) continue; const q = Z * NX + X; if (cost[q] < 40) { const d = a * a + b * b + cost[q] * 4; if (d < bd) { bd = d; best = q; } } } return best; };
  const astar = (s, g) => {
    const N = NX * NZ, gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), gxg = g % NX, gzg = Math.floor(g / NX);
    const heap = [], push = (q, f) => { heap.push([f, q]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gs[s] = 0; push(s, 0);
    while (heap.length) { const [, q] = pop(); if (q === g) break; const qx = q % NX, qz = Math.floor(q / NX);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const X = qx + a, Z = qz + b; if (X < 0 || Z < 0 || X >= NX || Z >= NZ) continue; const n = Z * NX + X; const step = (a && b ? 1.4142 : 1) * C * (cost[q] + cost[n]) / 2, ng = gs[q] + step; if (ng < gs[n]) { gs[n] = ng; from[n] = q; push(n, ng + Math.hypot(X - gxg, Z - gzg) * C); } } }
    if (from[g] < 0 && g !== s) throw new Error(`${name}: 길이 이어지지 않아요`);
    const out = []; for (let q = g; q >= 0; q = from[q]) { out.push([x0 + ((q % NX) + 0.5) * C, z0 + (Math.floor(q / NX) + 0.5) * C]); if (q === s) break; } return out.reverse();
  };
  // 지역 코스 선은 그대로, 지나는 곳 사이 · 지역 선과 지나는 곳 사이는 길 찾기
  let cells = [];
  for (let k = 0; k < parts.length; k++) { const q = parts[k];
    if (!q.via) { if (cells.length) { const seg = astar(snap(cells[cells.length - 1]), snap(q.pts[0])); cells.push(...seg.slice(1, -1)); } cells.push(...q.pts); continue; }
    if (!cells.length) { cells.push(q.pts[0]); continue; }
    const seg = astar(snap(cells[cells.length - 1]), snap(q.pts[0])); cells.push(...seg.slice(1)); }
  // 되돌아가는 곳 없애기: 지나는 곳을 조금 지나쳤다 돌아오면(갔다 오기 · 작은 고리) 그 사이를 잘라낸다
  for (let i = 0; i < cells.length; i++) { let cut = -1; for (let j = Math.min(cells.length - 1, i + 120); j > i + 2; j--) if (Math.hypot(cells[j][0] - cells[i][0], cells[j][1] - cells[i][1]) < 3) { cut = j; break; } if (cut > 0) cells.splice(i + 1, cut - i - 1); }
  // 매끈하게: 점 줄이기 → 모서리 다듬기(3번) → 4m 간격
  const dp = (pts, eps) => { if (pts.length < 3) return pts; let md = 0, mi = 0; const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1; for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > md) { md = d; mi = i; } } return md > eps ? [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)] : [pts[0], pts[pts.length - 1]]; };
  let pts = dp(cells, 2.2);
  for (let it = 0; it < 3; it++) { const o = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; o.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]); } o.push(pts[pts.length - 1]); pts = o; }
  const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = acc[acc.length - 1], at = (d) => { let i = 1; while (i < acc.length - 1 && acc[i] < d) i++; const k = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; };
  const R = []; for (let d = 0; d <= len; d += 4) R.push(at(d)); if (len % 4 > 1) R.push(at(len));
  const racc = [0]; for (let i = 1; i < R.length; i++) racc.push(racc[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]));
  // 달리는 길(가장 가까운 찻길)의 이름 · 폭
  const near = (p) => { let best = null, bd = Infinity; for (const L of roads) for (let k = 1; k < L.pts.length; k++) { const [ax, az] = L.pts[k - 1], [bx, bz] = L.pts[k], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1))), d = Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]); if (d < bd) { bd = d; best = L; } } return bd <= (best?.w || 0) / 2 + 1 ? best : null; };
  // 길바닥 종류 (20m 마다): r 찻길 · a 골목 · p 산책길 · - 아무것도 없음(잔디 · 광장 위, 러너가 길을 깐다)
  const onOther = (p) => { let best = null, bd = Infinity; for (const L of others) for (let k = 1; k < L.pts.length; k++) { const [ax, az] = L.pts[k - 1], [bx, bz] = L.pts[k], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1))), d = Math.hypot(ax + dx * t - p[0], az + dz * t - p[1]); if (d < bd) { bd = d; best = L; } } return bd <= (best?.w || 0) / 2 + 1 ? best : null; };
  const sf = []; for (let i = 0; i < R.length; i += 5) { const o = near(R[i]) ? null : onOther(R[i]); sf.push(near(R[i]) ? 'r' : o ? (o.kind === 'path' ? 'p' : 'a') : '-'); }
  const onRoad = R.map(near), w = []; for (let i = 0; i < R.length; i += 5) w.push(onRoad[i] ? Math.round(onRoad[i].w) : 0);
  const names = []; for (const L of onRoad) { const n = L?.name || ''; if (n && names[names.length - 1] !== n) names.push(n); }
  // 가로지르는 길: 경로 선분과 다른 찻길 선분이 만나는 곳 (달리는 길과 같은 이름은 빼고), 15m 안은 하나로
  // 다른 길(찻길 · 넓은 골목)을 2m 마다 짚어, 경로 가까이(달리는 길 폭 안) 닿는 곳. T자로 붙는 길도 잡힌다
  const xs = [], G2 = new Map(); R.forEach(([x, z], i) => { const k = `${Math.floor(x / 20)},${Math.floor(z / 20)}`; if (!G2.has(k)) G2.set(k, []); G2.get(k).push(i); });
  const proj = (x, z) => { let best = null; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const i of G2.get(`${Math.floor(x / 20) + a},${Math.floor(z / 20) + b}`) || []) { if (i === 0) continue; const [ax, az] = R[i - 1], [bx, bz] = R[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), d = Math.hypot(ax + dx * t - x, az + dz * t - z); if (!best || d < best.d) best = { d, s: racc[i - 1] + t * (racc[i] - racc[i - 1]), i, dx, dz }; } return best; };
  for (const L of [...roads, ...others.filter((o) => o.kind === 'alley' && o.w >= 4)]) for (let k = 1; k < L.pts.length; k++) { const [ax, az] = L.pts[k - 1], [bx, bz] = L.pts[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let q = 0; q <= n; q++) { const x = ax + ((bx - ax) * q) / n, z = az + ((bz - az) * q) / n, pr = proj(x, z); if (!pr) continue; const here = onRoad[pr.i] || onRoad[pr.i - 1]; if (here === L || (here && here.name && here.name === L.name)) continue; const lim = Math.max(3.5, (here?.w || 6) / 2 + 1); if (pr.d > lim) continue;
      const cos = Math.abs(((bx - ax) * pr.dx + (bz - az) * pr.dz) / (Math.hypot(bx - ax, bz - az) * Math.hypot(pr.dx, pr.dz) || 1)); if (cos > 0.8) continue;
      if (pr.s < 8 || pr.s > len - 8) continue; const old = xs.find((o) => Math.abs(o[0] - pr.s) < 15); if (old) { old[1] = Math.max(old[1], Math.round(L.w)); continue; } xs.push([Math.round(pr.s), Math.round(L.w)]); } }
  xs.sort((a, b) => a[0] - b[0]);
  // 버스정류장: 폭 14m 넘는 길, 교차로 지나 30m (300m 넘게 띄워서)
  const bus = []; for (const [d] of xs) { const i = Math.min(R.length - 1, Math.round((d + 30) / 4)), here = onRoad[i]; if (!here || here.w < 14 || d + 30 > len - 10) continue; if (bus.length && d + 30 - bus[bus.length - 1] < 300) continue; bus.push(Math.round(d + 30)); }
  // 칸: 경로 350m 안
  const tiles = new Set(); for (const [x, z] of R) for (const a of [-350, 0, 350]) for (const b of [-350, 0, 350]) { const i = Math.floor((x + a) / T), j = Math.floor((z + b) / T); if (tile(i, j)) tiles.add(`${i}_${j}`); }
  // 급히 꺾이는 곳 (앞뒤 10m 방향이 100° 넘게 바뀜): 달리기엔 어색하다
  const sharp = []; for (let i = 3; i < R.length - 3; i++) { const a = Math.atan2(R[i][0] - R[i - 3][0], R[i][1] - R[i - 3][1]), b = Math.atan2(R[i + 3][0] - R[i][0], R[i + 3][1] - R[i][1]); let dA = Math.abs(b - a); if (dA > Math.PI) dA = 2 * Math.PI - dA; if (dA > 1.75 && (!sharp.length || i * 4 - sharp[sharp.length - 1] > 30)) sharp.push(i * 4); }
  if (sharp.length) console.warn(`  ⚠ ${name}: 급히 꺾임 ${sharp.join(', ')}m`);
  return { id, name, len: Math.round(len), names, pts: R.flatMap(([x, z]) => [Math.round(x * 10), Math.round(z * 10)]), xs, bus, w, sf: sf.join(''), tiles: [...tiles] };
}

const only = process.argv[2] != null ? [+process.argv[2]] : COURSES.map((_, i) => i);
const out = [];
for (const i of only) { const t0 = Date.now(), R = build(i); out[i] = R; console.log(`${i} ${R.name} ${R.len}m · 교차 ${R.xs.length} · 정류장 ${R.bus.length} · 칸 ${R.tiles.join(' ')} · ${R.names.slice(0, 6).join(' → ')} (${Date.now() - t0}ms)`); }
if (only.length === COURSES.length) {
  const body = out.map((R) => `  ${JSON.stringify(R)},`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'public/dream-runner/js/seoul-routes.js'), `// 🗺️ 서울 맵 코스 길 (러너-개선 6-7): tools/seoul-run-courses.mjs 가 서울 칸 지도에서 만든다. 손으로 고치지 않는다\n//   pts: 4m 간격 경로 선 (서울 좌표 0.1m 정수) · xs: [거리, 가로지르는 길 폭] · bus: 정류장 거리 · w: 20m 마다 길 폭 · sf: 20m 마다 길바닥(r 찻길 · a 골목 · p 산책길 · - 없음) · tiles: 지나는 칸\n//   © OpenStreetMap contributors\nexport const ROUTES = [\n${body}\n];\n`);
  console.log('→ public/dream-runner/js/seoul-routes.js');
}
