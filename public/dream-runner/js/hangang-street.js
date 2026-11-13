// 서울 거리 시설 · 이름난 조형물 (서울 전체 칸)
//   - 가로등: 큰길(폭 10m 이상) 보도 끝에 30 ~ 35m 마다, 넓은 길은 양쪽 엇갈려. 회색 기둥 + 길 쪽으로 뻗은 팔 + 납작한 LED 등 (밤에 켜진다)
//   - 버스정류장: 폭 14m 이상 길, 교차로를 지나 30m 쯤 (같은 쪽은 300m 넘게 띄워서). 서울 표준 쉘터: 유리 뒷벽 · 짙은 지붕 · 벤치 · 도착 안내 화면 · 정류장 표지
//     중앙버스전용차로 길은 길 가운데 섬 정류장 (승강장 + 긴 지붕)
//   - 공원 벤치: 녹지 안 산책로 옆 45m 마다
//   - 조형물: 광화문광장 이순신 장군 동상 · 세종대왕 동상, 청계광장 소라 모양 조형물(빨강 · 파랑 띠가 감아 오르는 20m 탑)
//   실제 정류장 자리 자료는 아직 지도에 없어 서울 정류장 배치 습관(교차로 지나 30m)으로 둔다
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lam = (o) => new THREE.MeshLambertMaterial(o);
const BUS_MID = /^(강남대로|송파대로|천호대로|도봉로|미아로|동소문로|왕산로|망우로|통일로|의주로|수색로|성산로|마포대로|한강대로|경인로|시흥대로|공항대로|종로|동작대로)$/;
const box = (w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
const cyl = (r0, r1, h, x, y, z, seg = 8) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); return g; };
// 부분마다 색을 꼭짓점에 칠해 한 그물로 (재질 하나 = 그리기 한 번)
const paint = (g, col) => { const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const merge = (list) => { const m = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false); list.forEach((g) => g.dispose()); return m; };
// 여러 자리에 같은 모양 (y 축 회전만)
function instances(hg, geo, mat, list, { shadow = false } = {}) {
  if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
  list.forEach(([x, z, ry, s = 1], i) => { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.scale.set(1, s, 1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.castShadow = shadow; im.userData.furn = true; hg.scene.add(im); return im;
}

export function buildStreetFurniture(hg, roads, xs, side = []) {
  const near = (list, x, z, d) => list.some((p) => Math.abs(p[0] - x) < d && Math.abs(p[1] - z) < d && Math.hypot(p[0] - x, p[1] - z) < d);
  // 교차로 둘레(길 폭 + 8m)와 건물 안은 비운다
  const inX = (x, z, pad = 8) => xs.some((X) => { const R = Math.max(X.A.w, X.B.w) / 2 + pad; return Math.abs(X.x - x) < R && Math.abs(X.z - z) < R; });
  const free = (x, z) => hg.groundAt(x, z, 9999) === 0 && !hg.inWater?.(x, z);
  const grid = new Map(), G = 25, onRoad = (x, z, pad = 0) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [A, B, hw] of grid.get(`${Math.floor(x / G) + a},${Math.floor(z / G) + b}`) || []) { const dx = B[0] - A[0], dz = B[1] - A[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (z - A[1]) * dz) / L2)); if (Math.hypot(A[0] + dx * t - x, A[1] + dz * t - z) < hw + pad) return true; } return false; };
  for (const r of roads) for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 20)); for (let k = 0; k < n; k++) { const A = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], B = [a[0] + ((b[0] - a[0]) * (k + 1)) / n, a[1] + ((b[1] - a[1]) * (k + 1)) / n], key = `${Math.floor((A[0] + B[0]) / 2 / G)},${Math.floor((A[1] + B[1]) / 2 / G)}`; if (!grid.has(key)) grid.set(key, []); grid.get(key).push([A, B, r.w / 2]); } }
  // 길을 따라 걸으며 s(m) 마다 부르기: fn(x, z, ux, uz, s)
  const walk = (pts, step, start, fn) => { let acc = 0, next = start; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue; const ux = (bx - ax) / L, uz = (bz - az) / L; while (next <= acc + L) { const t = next - acc; fn(ax + ux * t, az + uz * t, ux, uz, next); next += step; } acc += L; } };

  // ---------- 가로등 ----------
  const lamps = [];
  roads.forEach((r, ri) => { if (r.w < 10 || r.pts.length < 2) return; const sd = side[ri] || 0, step = r.w >= 20 ? 30 : 34;
    // 한 방향 도로는 바깥(짝이 없는 쪽)만, 넓은 양방향 길은 양쪽 엇갈려, 좁은 길은 한쪽
    const sides = sd ? [-sd] : r.w >= 14 ? [1, -1] : [1];
    for (const s of sides) walk(r.pts, step, s > 0 ? 6 : 6 + step / 2, (x, z, ux, uz) => { const nx = -uz * s, nz = ux * s, d = r.w / 2 + 0.75, px = x + nx * d, pz = z + nz * d;
      if (inX(px, pz) || onRoad(px, pz, 0.3) || !free(px, pz) || near(lamps, px, pz, 9)) return; lamps.push([px, pz, Math.atan2(-nx, -nz), r.w >= 20 ? 1.12 : 1]); }); });
  if (lamps.length) {
    // 기둥(아래가 굵고 위로 가늘게) · 바닥 받침 · 길 쪽으로 휘어 나간 팔. 팔은 +z(길 쪽)
    const pole = merge([cyl(0.13, 0.17, 0.35, 0, 0, 0, 10), cyl(0.07, 0.11, 8.6, 0, 0.35, 0, 10), (() => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 8.7, 0), new THREE.Vector3(0, 9.2, 0.5), new THREE.Vector3(0, 9.35, 1.4), new THREE.Vector3(0, 9.3, 2.3)]); return new THREE.TubeGeometry(c, 10, 0.055, 6, false); })()]);
    const lens = merge([box(0.26, 0.02, 0.8, 0, 9.18, 2.55)]), body = merge([paint(pole, '#a3a9ae'), paint(box(0.34, 0.1, 0.95, 0, 9.24, 2.55), '#5b6066')]);
    const lensM = lam({ color: '#f4f1e6', emissive: '#ffe2b0', emissiveIntensity: 0 });
    instances(hg, body, lam({ color: '#ffffff', vertexColors: true }), lamps, { shadow: true }); instances(hg, lens, lensM, lamps);
    // 밤: 등 아래 보도 · 찻길에 따뜻한 빛 웅덩이 (더하기 섞기, 땅에 붙인 판)
    const pool = new THREE.PlaneGeometry(15, 15); pool.rotateX(-Math.PI / 2); pool.translate(0, 0.06, 2.2);
    const poolM = new THREE.MeshBasicMaterial({ map: poolTex(), color: '#ffcf8f', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const pools = instances(hg, pool, poolM, lamps); pools.renderOrder = -45; pools.userData.noMerge = true; pools.userData.drapeTilt = true;
    const glow = []; for (const [x, z, ry, s] of lamps) { glow.push(x + Math.sin(ry) * 2.55, 9.15 * s, z + Math.cos(ry) * 2.55); hg.addCircle(x, z, 0.16, 9); }
    // 빛 방울은 등마다 하나 (땅 높이는 칸을 얹을 때 더해진다)
    const gp = hg.glowPoints(glow, '#ffd9a8', 2.6); gp.userData.noMerge = true;
    (hg.litFns ||= []).push((lit) => { lensM.emissiveIntensity = lit * 2.4; gp.material.opacity = lit * 0.9; poolM.opacity = lit * 0.32; pools.visible = lit > 0.02; });
  }

  // ---------- 버스정류장 ----------
  const stops = [], islands = [];
  roads.forEach((r, ri) => { if (r.w < 14 || r.pts.length < 2) return; const sd = side[ri] || 0, mid = BUS_MID.test(r.name);
    // 이 길의 교차로까지 거리(s): 그 30m 뒤에 정류장
    const cs = []; { let acc = 0; for (let i = 1; i < r.pts.length; i++) { const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i], L = Math.hypot(bx - ax, bz - az); for (const X of xs) { if (X.A.ri !== ri && X.B.ri !== ri) continue; const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((X.x - ax) * dx + (X.z - az) * dz) / (L * L || 1))); if (Math.hypot(ax + dx * t - X.x, az + dz * t - X.z) < 3) cs.push({ s: acc + t * L, o: (X.A.ri === ri ? X.B.w : X.A.w) / 2 }); } acc += L; } }
    cs.sort((a, b) => a.s - b.s);
    // 방향: +1 = 길 방향으로 달리는 버스 (오른쪽 = +n 쪽 보도), -1 = 반대. 한 방향 도로는 그 방향만
    for (const dir of sd ? [1] : [1, -1]) { let last = -1e9;
      for (const c of dir > 0 ? cs : [...cs].reverse()) { const s0 = c.s + dir * (c.o + 30); if (Math.abs(s0 - last) < 320) continue; let hit = null; walk(r.pts, 1e9, Math.max(0, s0), (x, z, ux, uz) => { hit ||= [x, z, ux, uz]; }); if (!hit) continue; const [x, z, ux, uz] = hit;
        if (mid && !sd) { if (dir < 0 || inX(x, z, 14) || near(islands, x, z, 120)) continue; islands.push([x, z, Math.atan2(ux, uz)]); last = s0; continue; }
        const nx = -uz * dir, nz = ux * dir, d = r.w / 2 + 1.6, px = x + nx * d, pz = z + nz * d;
        if (inX(px, pz, 12) || onRoad(px, pz, 0.6) || !free(px, pz) || !free(px + nx * 1.2, pz + nz * 1.2) || near(stops, px, pz, 60)) continue;
        // 쉘터는 보도 쪽에서 길(-n)을 본다
        stops.push([px, pz, Math.atan2(-nx, -nz)]); last = s0; } } });
  if (stops.length) {
    // 쉘터 (앞 = +z = 길 쪽): 기둥 4 · 유리 뒷벽 · 옆 유리 · 지붕(살짝 앞으로 기운 짙은 판) · 벤치 · 도착 안내 화면 · 표지 기둥
    const frame = merge([...[-3, 3].flatMap((x) => [box(0.1, 2.6, 0.1, x, 1.3, -0.65), box(0.1, 2.5, 0.1, x, 1.25, 0.65)]), box(6.2, 0.12, 0.1, 0, 2.55, -0.65), box(0.08, 0.08, 6, 0, 0.45, -0.3, Math.PI / 2), cyl(0.05, 0.05, 3.0, 3.9, 0, 0.6, 8)]);
    const glass = merge([box(6, 2.1, 0.04, 0, 1.25, -0.68), box(0.04, 2.0, 1.1, -3, 1.2, -0.1), box(0.04, 2.0, 1.1, 3, 1.2, -0.1)]);
    const roof = merge([(() => { const g = new THREE.BoxGeometry(6.6, 0.14, 1.9); g.rotateX(-0.06); g.translate(0, 2.68, 0); return g; })()]);
    const bench = merge([box(4.2, 0.06, 0.42, 0, 0.46, -0.38), box(4.2, 0.4, 0.05, 0, 0.72, -0.6), box(0.06, 0.44, 0.38, -1.9, 0.22, -0.38), box(0.06, 0.44, 0.38, 1.9, 0.22, -0.38)]);
    const sign = merge([box(0.62, 0.62, 0.05, 3.9, 2.85, 0.6), box(1.1, 0.36, 0.1, -1.6, 2.32, 0.2)]);
    const screen = merge([box(1.0, 0.27, 0.02, -1.6, 2.32, 0.26)]);
    const screenM = lam({ color: '#1b1b1b', emissive: '#ffb02e', emissiveIntensity: 0.4 });
    const solid = merge([paint(frame, '#b9bec3'), paint(bench, '#b98a5a'), paint(sign, '#2a63c8'), paint(roof, '#3b4148')]);
    instances(hg, solid, lam({ color: '#ffffff', vertexColors: true }), stops, { shadow: true }); instances(hg, glass, new THREE.MeshLambertMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.35, depthWrite: false }), stops); instances(hg, screen, screenM, stops);
    for (const [x, z, ry] of stops) for (const o of [-3, 3]) hg.addCircle(x + Math.cos(ry) * o, z - Math.sin(ry) * o, 0.12, 2.6);
    (hg.litFns ||= []).push((lit) => { screenM.emissiveIntensity = 0.4 + lit * 1.4; });
  }
  if (islands.length) {
    // 가운데 섬 정류장: 낮은 승강장(30 × 3m) + 가운데 기둥 줄 + 긴 지붕 + 양쪽 난간 + 가운데 벤치
    const plat = merge([box(3.0, 0.2, 30, 0, 0.1, 0)]), rail = merge([box(0.05, 0.9, 26, -1.45, 0.65, 0), box(0.05, 0.9, 26, 1.45, 0.65, 0)]);
    const cols = merge([-11, -4, 4, 11].map((z) => box(0.14, 2.7, 0.14, 0, 1.55, z))), roofI = merge([box(3.6, 0.14, 24, 0, 2.95, 0)]), benchI = merge([-7.5, 0, 7.5].map((z) => box(0.45, 0.06, 2.6, 0, 0.66, z)));
    instances(hg, merge([paint(plat, '#c9c3b8'), paint(rail, '#9aa1a8'), paint(cols, '#b9bec3'), paint(roofI, '#39424c'), paint(benchI, '#b98a5a')]), lam({ color: '#ffffff', vertexColors: true }), islands, { shadow: true });
    for (const [x, z, ry] of islands) for (const t of [-12, -4, 4, 12]) hg.addCircle(x + Math.sin(ry) * t, z + Math.cos(ry) * t, 1.6, 0.2);
  }

  // ---------- 공원 벤치: 녹지 안 산책로 옆 ----------
  const benches = [], M = hg.map, S = M.scale;
  for (const pa of M.paths || []) { if (pa[0]) continue; const pts = []; for (let k = 2; k < pa.length; k += 2) pts.push([pa[k] * S, pa[k + 1] * S]); if (pts.length < 2) continue; let flip = 1;
    walk(pts, 45, 12, (x, z, ux, uz) => { flip = -flip; const d = (pa[1] || 2) / 2 + 0.9, bx = x - uz * d * flip, bz = z + ux * d * flip; if (!(hg.greenPolys || []).some((g) => inPolyQuick(bx, bz, g)) || !free(bx, bz) || onRoad(bx, bz, 1) || near(benches, bx, bz, 15)) return; benches.push([bx, bz, Math.atan2(uz * flip, -ux * flip)]); }); }
  if (benches.length) {
    const seat = merge([box(1.8, 0.05, 0.42, 0, 0.44, 0), box(1.8, 0.38, 0.04, 0, 0.7, -0.22)]), legs = merge([box(0.06, 0.44, 0.44, -0.75, 0.22, -0.02), box(0.06, 0.44, 0.44, 0.75, 0.22, -0.02)]);
    instances(hg, merge([paint(seat, '#a8794e'), paint(legs, '#4a4f55')]), lam({ color: '#ffffff', vertexColors: true }), benches);
    for (const [x, z] of benches) hg.addCircle(x, z, 0.5, 0.5);
  }
  return { lamps: lamps.length, stops: stops.length, islands: islands.length, benches: benches.length };
}
// 빛 웅덩이 그림: 가운데가 밝고 가장자리로 부드럽게 사라지는 원 (한 장을 모든 칸이 같이 쓴다)
let POOL_T = null;
function poolTex() { if (POOL_T) return POOL_T; const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), gr = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, N, N); POOL_T = new THREE.CanvasTexture(cv); return POOL_T; }
function inRingQ(x, z, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; }
function inPolyQuick(x, z, poly) { return inRingQ(x, z, poly[0]) && !poly.slice(1).some((h) => inRingQ(x, z, h)); }

// ---------- 이름난 조형물 ----------
//   자리: 위도 · 경도 (광화문광장은 2022년 넓힌 뒤에도 두 동상은 제자리, 남쪽 세종대로 사거리를 본다)
const STATUES = [
  { id: 'yi', lat: 37.57085, lon: 126.97676, build: admiral },
  { id: 'sejong', lat: 37.57275, lon: 126.97676, build: kingSejong },
  { id: 'spring', lat: 37.56909, lon: 126.97768, build: conchSpring },
];
export function buildLandmarkStatues(hg) {
  if (!hg.isChunk) return 0; const [ti, tj] = hg.chunkKey.split('_').map(Number), T = hg.host.world0.tile; let n = 0;
  for (const S of STATUES) { const [x, z] = hg.ll(S.lat, S.lon); if (Math.floor(x / T) !== ti || Math.floor(z / T) !== tj) continue; const g = S.build(hg); g.position.set(x, 0, z); hg.scene.add(g); n++; }
  return n;
}
const bronzeOf = (hg, col) => { const m = new THREE.MeshPhongMaterial({ color: col, specular: '#6b6450', shininess: 26, emissive: '#ffcf96', emissiveIntensity: 0, side: THREE.DoubleSide }); (hg.litFns ||= []).push((lit) => { m.emissiveIntensity = lit * 0.1; }); return m; };
const stoneOf = (hg, col) => { const m = lam({ color: col, emissive: '#ffe6c4', emissiveIntensity: 0 }); (hg.litFns ||= []).push((lit) => { m.emissiveIntensity = lit * 0.12; }); return m; };
const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const frustum = (r0, r1, h, x, y, z, seg = 14) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y + h / 2, z); return g; };

// 이순신 장군 동상: 넓은 화강암 단 → 높은 받침(약 10.5m, 띠 장식) → 갑옷 입고 큰 칼을 앞에 세워 쥔 청동 입상(약 6.5m). 앞에 거북선 모형. 남쪽(+z)을 본다
function admiral(hg) {
  const g = new THREE.Group(), granite = stoneOf(hg, '#d8d3c8'), dark = stoneOf(hg, '#a9a397'), bronze = bronzeOf(hg, '#4a4936');
  const base = merge([box(16, 0.5, 16, 0, 0.25, 0), box(12, 0.5, 12, 0, 0.75, 0), box(7.6, 1.6, 7.6, 0, 1.8, 0)]);
  const shaft = merge([box(5.6, 6.4, 5.6, 0, 5.8, 0), box(6.2, 0.5, 6.2, 0, 9.25, 0), box(5.2, 1.2, 5.2, 0, 10.1, 0)]);
  const band = merge([box(5.7, 0.35, 5.7, 0, 3.4, 0), box(5.7, 0.35, 5.7, 0, 8.6, 0)]);
  g.add(new THREE.Mesh(base, granite), new THREE.Mesh(shaft, granite), new THREE.Mesh(band, dark));
  // 사람 (받침 위 10.7m 부터, 약 6.5m): 몸은 돌림판(lathe) 실루엣 — 무릎 아래까지 퍼진 갑옷 자락 · 잘록한 허리 · 넓은 가슴과 어깨, 앞뒤로 납작하게
  const Y = 10.7, prof = [[0.01, 0.95], [1.02, 0.95], [1.08, 1.15], [0.98, 1.9], [0.86, 2.55], [0.74, 2.85], [0.82, 3.25], [0.95, 3.85], [1.08, 4.35], [0.95, 4.72], [0.5, 4.95], [0.32, 5.02], [0.01, 5.03]].map(([r0, y]) => new THREE.Vector2(r0, y));
  const body = new THREE.LatheGeometry(prof, 22); body.scale(1, 1, 0.66); body.translate(0, Y, 0);
  const tube = (pts, r0) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, Y + y, z))), 10, r0, 8, false);
  const cape = new THREE.CylinderGeometry(1.0, 1.32, 3.7, 16, 1, true, Math.PI / 2, Math.PI); cape.scale(1, 1, 0.72); cape.translate(0, Y + 0.95 + 1.85, -0.08);
  const fig = [body, cape,
    frustum(0.3, 0.26, 0.95, -0.42, Y, 0.05), frustum(0.3, 0.26, 0.95, 0.42, Y, 0.05), box(0.42, 0.22, 0.75, -0.42, Y + 0.11, 0.22), box(0.42, 0.22, 0.75, 0.42, Y + 0.11, 0.22), // 장화
    sph(0.5, -1.0, Y + 4.42, 0, 1, 0.8, 0.9), sph(0.5, 1.0, Y + 4.42, 0, 1, 0.8, 0.9), // 어깨 갑옷
    tube([[-1.05, 4.35, 0.05], [-1.0, 3.6, 0.2], [-0.62, 3.55, 0.62], [-0.16, 3.7, 0.86]], 0.22), tube([[1.05, 4.35, 0.05], [1.0, 3.6, 0.2], [0.62, 3.55, 0.62], [0.16, 3.7, 0.86]], 0.22), // 두 팔 (칼자루로 모은다)
    sph(0.2, -0.13, Y + 3.72, 0.9), sph(0.2, 0.13, Y + 3.95, 0.9), // 두 손
    box(1.5, 0.22, 0.95, 0, Y + 2.75, 0.04), // 허리띠
    sph(0.36, 0, Y + 5.32, 0.04, 0.9, 1.12, 0.95), // 얼굴
    frustum(0.52, 0.5, 0.12, 0, Y + 5.55, 0), sph(0.42, 0, Y + 5.66, 0, 1, 0.82, 1), frustum(0.07, 0.02, 0.62, 0, Y + 5.95, 0, 8), sph(0.08, 0, Y + 6.0, 0), // 투구 (챙 · 둥근 몸 · 꼭지)
    (() => { const g2 = new THREE.CylinderGeometry(0.5, 0.62, 0.5, 14, 1, true, Math.PI / 2, Math.PI); g2.translate(0, Y + 5.2, -0.02); return g2; })(), // 투구 뒤 목가리개
  ];
  g.add(new THREE.Mesh(merge(fig), bronze));
  // 큰 칼: 칼집에 든 채 몸 앞에 세워 (끝이 발 앞, 손잡이는 가슴 높이)
  g.add(new THREE.Mesh(merge([cyl(0.07, 0.1, 3.3, 0, Y + 0.25, 0.92, 8), cyl(0.2, 0.2, 0.06, 0, Y + 3.55, 0.92, 12), cyl(0.06, 0.06, 0.75, 0, Y + 3.6, 0.92, 8), sph(0.08, 0, Y + 4.38, 0.92)]), bronze));
  // 앞 거북선 모형 (낮은 받침 위, 길이 약 3m)
  const ship = new THREE.Group(); ship.position.set(0, 0, 11);
  ship.add(new THREE.Mesh(box(4.2, 0.6, 2.4, 0, 0.3, 0), granite));
  // 배 몸통(앞뒤가 들린 상자) · 등껍질 지붕(납작한 반구, 철갑) · 앞 용머리 · 양옆 노
  const hull = new THREE.BoxGeometry(3.2, 0.6, 1.2, 8, 1, 1); { const p = hull.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), up = Math.pow(Math.abs(x) / 1.6, 3) * 0.35; if (p.getY(k) > 0) p.setY(k, p.getY(k) + up); p.setZ(k, p.getZ(k) * (1 - Math.pow(Math.abs(x) / 1.6, 2) * 0.45)); } hull.computeVertexNormals(); } hull.translate(0, 0.9, 0);
  const shell = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(1.45, 0.55, 0.62); shell.translate(0, 1.2, 0);
  const head = new THREE.CylinderGeometry(0.16, 0.22, 0.7, 8); head.rotateZ(-Math.PI / 2 + 0.5); head.translate(1.85, 1.45, 0);
  const oars = []; for (let k = -2; k <= 2; k++) for (const sd of [-1, 1]) { const o2 = new THREE.BoxGeometry(0.06, 0.06, 0.9); o2.rotateX(sd * 0.5); o2.translate(k * 0.55, 0.75, sd * 0.85); oars.push(o2); }
  ship.add(new THREE.Mesh(merge([hull, shell, head, ...oars]), bronze)); ship.rotation.y = Math.PI / 2; ship.scale.setScalar(0.9); g.add(ship);
  return g;
}

// 세종대왕 동상: 낮고 넓은 받침(약 4.2m) 위 의자에 앉은 금빛 좌상(약 6.2m). 왼손에 책, 오른손을 들어 앞을 가리킨다. 앞에 혼천의 · 측우기 · 해시계
function kingSejong(hg) {
  const g = new THREE.Group(), granite = stoneOf(hg, '#d6d0c4'), gold = (() => { const m = new THREE.MeshPhongMaterial({ color: '#b8923e', specular: '#ffe9a8', shininess: 60, emissive: '#ffcf80', emissiveIntensity: 0 }); (hg.litFns ||= []).push((lit) => { m.emissiveIntensity = 0.04 + lit * 0.3; }); return m; })(), bronze = bronzeOf(hg, '#5a5238');
  g.add(new THREE.Mesh(merge([box(14, 0.4, 12, 0, 0.2, 0), box(9.5, 0.6, 7.5, 0, 0.7, 0), box(8.2, 3.2, 6.4, 0, 2.6, 0), box(8.8, 0.4, 7.0, 0, 4.4, 0)]), granite));
  // 의자 (등받이 높은 어좌) + 앉은 몸: 곤룡포가 자리 위로 넓게 퍼진 돌림판 실루엣, 앞으로 나온 무릎, 발까지 늘어진 옷자락
  const Y = 4.6, prof = [[0.01, 1.5], [1.55, 1.5], [1.5, 1.9], [1.25, 2.6], [1.05, 3.1], [1.18, 3.6], [1.3, 3.95], [1.05, 4.25], [0.42, 4.45], [0.01, 4.47]].map(([r0, y]) => new THREE.Vector2(r0, y));
  const torso = new THREE.LatheGeometry(prof, 22); torso.scale(1, 1, 0.8); torso.translate(0, Y, -0.45);
  const knees = new THREE.CapsuleGeometry(0.62, 1.6, 4, 12); knees.rotateZ(Math.PI / 2); knees.scale(1.25, 1, 1.0); knees.rotateY(Math.PI / 2); knees.translate(0, Y + 1.95, 0.55);
  const drape = new THREE.CylinderGeometry(1.25, 1.55, 1.95, 18, 1, false); drape.scale(1, 1, 0.55); drape.translate(0, Y + 0.97, 1.2);
  const tube = (pts, r0) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, Y + y, z))), 10, r0, 8, false);
  const body = [torso, knees, drape,
    box(4.0, 1.5, 3.0, 0, Y + 0.75, -0.6), box(4.3, 4.4, 0.45, 0, Y + 2.2, -2.15), box(0.4, 1.0, 2.6, -2.0, Y + 1.95, -0.6), box(0.4, 1.0, 2.6, 2.0, Y + 1.95, -0.6), // 어좌 (자리 · 등받이 · 팔걸이)
    box(1.25, 0.3, 0.7, -0.55, Y + 0.15, 2.05), box(1.25, 0.3, 0.7, 0.55, Y + 0.15, 2.05), // 발 (신)
    sph(0.6, -1.2, Y + 3.9, -0.45, 1, 0.75, 0.9), sph(0.6, 1.2, Y + 3.9, -0.45, 1, 0.75, 0.9), // 어깨
    sph(0.5, 0, Y + 4.85, -0.38, 0.92, 1.12, 0.95), // 얼굴
    frustum(0.5, 0.47, 0.5, 0, Y + 5.2, -0.45), sph(0.48, 0, Y + 5.7, -0.45, 1, 0.55, 1), // 익선관 (몸 · 둥근 윗부분)
    box(0.1, 0.5, 0.42, -0.62, Y + 5.68, -0.85, 0.4), box(0.1, 0.5, 0.42, 0.62, Y + 5.68, -0.85, -0.4), // 익선관 뒤 날개 둘
    tube([[-1.3, 3.85, -0.4], [-1.45, 3.0, 0.0], [-1.0, 2.55, 0.7], [-0.55, 2.55, 1.15]], 0.3), box(1.15, 0.16, 0.85, -0.55, Y + 2.6, 1.25), // 왼팔 · 무릎 위에 펼친 책
    tube([[1.3, 3.85, -0.4], [1.5, 3.1, 0.1], [1.35, 3.0, 0.9], [1.2, 3.2, 1.55]], 0.3), sph(0.28, 1.2, Y + 3.25, 1.75, 1, 0.6, 1.3), // 오른팔을 들어 앞으로 (손바닥)
  ];
  g.add(new THREE.Mesh(merge(body), gold));
  // 앞 과학 기구 (낮은 받침 위): 혼천의(고리 셋) · 측우기(받침 위 원통) · 앙부일구(그릇 모양 해시계)
  const front = []; const ring = (r, rx, rz) => { const t = new THREE.TorusGeometry(r, 0.05, 6, 28); t.rotateX(rx); t.rotateZ(rz); t.translate(-3.2, 2.2, 9); return t; };
  front.push(ring(0.9, Math.PI / 2, 0), ring(0.9, 0, 0.4), ring(0.9, 0.9, -0.5), cyl(0.08, 0.12, 1.3, -3.2, 0.6, 9));
  front.push(cyl(0.25, 0.25, 0.7, 0, 1.0, 9.5, 12)); const bowl = new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); bowl.translate(3.2, 1.6, 9); front.push(bowl, cyl(0.1, 0.18, 0.5, 3.2, 0.6, 9));
  g.add(new THREE.Mesh(merge(front), bronze), new THREE.Mesh(merge([box(1.6, 0.6, 1.6, -3.2, 0.3, 9), box(1.2, 1.0, 1.2, 0, 0.5, 9.5), box(1.6, 0.6, 1.6, 3.2, 0.3, 9)]), granite));
  return g;
}

// 청계광장 소라 모양 조형물: 바닥 둥근 연못 위로 빨강(바깥) · 파랑(안쪽) 띠 두 줄이 소용돌이치며 20m 까지 가늘게 감아 오른다
function conchSpring(hg) {
  const g = new THREE.Group();
  const H = 20, turns = 2.7, N = 220;
  // 띠: 원뿔 면 위 나선을 따라, 띠 폭은 아래 넓고 위로 좁게. 같은 띠의 바깥 면 = 빨강, 안 면 = 파랑
  const ribbon = (phase) => { const P = [], I = []; for (let i = 0; i <= N; i++) { const t = i / N, a = phase + t * turns * Math.PI * 2, R = 3.4 * Math.pow(1 - t, 0.85) + 0.25, y = 0.6 + t * H, w = 1.5 * (1 - t) + 0.3, lean = t * t * 1.6;
      const cx = Math.cos(a) * R + lean, cz = Math.sin(a) * R; P.push(cx, y - w / 2, cz, cx * 0.98, y + w / 2, cz * 0.98); if (i) { const k = i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setIndex(I); geo.computeVertexNormals(); return geo; };
  const red = new THREE.MeshPhongMaterial({ color: '#c8262c', specular: '#553333', shininess: 40, side: THREE.FrontSide, emissive: '#ff6a5a', emissiveIntensity: 0 }), blue = new THREE.MeshPhongMaterial({ color: '#2a4fa8', specular: '#334466', shininess: 40, side: THREE.BackSide, emissive: '#6a8aff', emissiveIntensity: 0 });
  (hg.litFns ||= []).push((lit) => { red.emissiveIntensity = lit * 0.35; blue.emissiveIntensity = lit * 0.35; });
  for (const ph of [0, Math.PI]) { const geo = ribbon(ph); g.add(new THREE.Mesh(geo, red), new THREE.Mesh(geo, blue)); }
  // 둥근 연못 (얕은 물 · 돌 테두리)
  const stone = lam({ color: '#cfc9bd' }), pond = new THREE.RingGeometry(4.2, 5.2, 40); pond.rotateX(-Math.PI / 2); pond.translate(0, 0.35, 0);
  g.add(new THREE.Mesh(merge([frustum(5.4, 5.3, 0.35, 0, 0, 0, 40)]), stone), new THREE.Mesh(pond, stone));
  const water = new THREE.CircleGeometry(4.2, 40); water.rotateX(-Math.PI / 2); water.translate(0, 0.33, 0); g.add(new THREE.Mesh(water, new THREE.MeshPhongMaterial({ color: '#7fa8c0', specular: '#ffffff', shininess: 90 })));
  return g;
}
