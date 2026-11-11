// 남산 정상 (지도 kind 'summit'): 정상 광장은 높이 0, 서울은 발아래로 (도시 · 한강 · 먼 건물을 drop 만큼 내린다)
//   숲으로 덮인 산비탈 · N서울타워(흰 콘크리트 기둥 · 전망대 · 빨강 · 흰 안테나 · 밤 색조명) · 사랑의 자물쇠 울타리 · 팔각정 · 봉수대 · 케이블카
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lam = (o) => new THREE.MeshLambertMaterial(o);
const lerpN = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => t * t * (3 - 2 * t);

// world: 서울 전체(진짜 지형) — 산 · 발아래로 내리기 · 걷는 범위는 빼고 타워 · 광장 · 자물쇠 · 케이블카 · 전망대 · 비탈 숲만 (지형 높이는 칸을 얹을 때 더해진다)
export function buildSummit(hg, { world = false } = {}) {
  const M = hg.map, S = M.scale, sc = hg.scene, DROP = world ? 0 : 228, H = (x, z) => (world ? hg.host.terrAt(x, z, true) : 0);
  // 정상 한가운데: 타워 조각들의 가운데 (없으면 코스 가운데)
  const ni = M.names.indexOf('남산서울타워'); let cx = 0, cz = 0, n = 0;
  for (const b of M.buildings) if (b[4] === ni && b[1] > 1) for (let k = 7; k < b.length; k += 2) { cx += b[k] * S; cz += b[k + 1] * S; n++; }
  if (!n) { for (const p of hg.rp) { cx += p[0]; cz += p[1]; n++; } } cx /= n; cz /= n;
  let R = 60; if (!world) { for (const p of hg.rp) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cz) + 30); hg.walkLimit = { x: cx, z: cz, r: R - 4 }; }
  if (!world) {
  // 1) 발아래로: 먼 땅 · 물 · 섬 · 먼 건물 (깊이를 쓰게 해서 산비탈 뒤로 숨는다)
  for (const o of [...sc.children]) { if (!o.isMesh && !o.isInstancedMesh) continue; let bs; if (o.isInstancedMesh) { o.computeBoundingSphere(); bs = o.boundingSphere; } else { o.geometry.computeBoundingSphere?.(); bs = o.geometry.boundingSphere; } if (bs && bs.radius > 9000) continue; const far = o === hg.farIM || (bs && Math.hypot(bs.center.x - cx, bs.center.z - cz) > R * 2.2) || o.renderOrder === -60; if (!far) continue; o.position.y -= DROP; if (o.material) o.material.depthTest = true; }
  // 2) 산: 정상 평지(반지름 R) → 비탈 → 도시 높이 (가장자리 1400m), 숲 색 + 바위 · 길 무늬
  const RIM = 1400, rings = 46, segs = 96, P = [], C2 = [], I = [], col = new THREE.Color();
  for (let i = 0; i <= rings; i++) { const t = i / rings, r = t < 0.12 ? (t / 0.12) * R : R + ((t - 0.12) / 0.88) ** 1.15 * (RIM - R); for (let j = 0; j <= segs; j++) { const a = (j / segs) * Math.PI * 2, wob = 1 + Math.sin(a * 3 + 1.3) * 0.12 + Math.sin(a * 7) * 0.05, rr = r <= R ? r : R + (r - R) * wob, k = r <= R ? 0 : Math.min(1, (r - R) / (RIM - R)), y = r <= R ? -0.03 : -DROP * (1 - Math.cos(k * Math.PI)) / 2 + Math.sin(a * 11 + r * 0.02) * 6 * Math.sin(k * Math.PI);
      P.push(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr); if (r <= R) col.set('#b8b0a2'); else { col.set(k < 0.08 ? '#6f8a55' : '#3f6a3c').offsetHSL((Math.sin(a * 17 + r) * 0.5) * 0.03, 0, (Math.sin(a * 29 + r * 0.05) * 0.5) * 0.06); if (k > 0.85) col.lerp(new THREE.Color('#8a8f86'), (k - 0.85) * 4); } C2.push(col.r, col.g, col.b); } }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3)); mg.setIndex(I); mg.computeVertexNormals();
  const mtn = new THREE.Mesh(mg, lam({ vertexColors: true })); mtn.renderOrder = -61; mtn.receiveShadow = true; sc.add(mtn);
  }
  // 비탈 숲: 둥근 나무 덩어리 (봄 · 가을엔 계절 색이 조금)
  const NT = world ? 4600 : 2600, tg = new THREE.IcosahedronGeometry(1, 1), tm = lam({ color: '#ffffff', vertexColors: false }), trees = new THREE.InstancedMesh(tg, tm, NT), o3 = new THREE.Object3D(), tc = new THREE.Color();
  // 진짜 지형이면 높은 비탈(땅 높이 45m 위)에만 — 아래 동네(명동 · 이태원)에는 안 심는다
  const RIM_ = 1400;
  // 건물 위 · 바로 옆에는 심지 않는다 (후암동 빌라 사이로 둥근 나무가 박혔다)
  let q = 0; for (let i = 0; i < NT * 5 && q < NT; i++) { const a = Math.random() * Math.PI * 2, r = R + 12 + Math.random() ** 0.8 * (RIM_ * 0.85 - R), tx = cx + Math.cos(a) * r, tz = cz + Math.sin(a) * r; if (world && (H(tx, tz) < 45 || hg.host.inWater(tx, tz) || hg.groundAt(tx, tz, 9999) > 0 || hg.groundAt(tx + 4, tz, 9999) > 0 || hg.groundAt(tx - 4, tz, 9999) > 0 || hg.groundAt(tx, tz + 4, 9999) > 0 || hg.groundAt(tx, tz - 4, 9999) > 0)) continue; const k = Math.min(1, (r - R) / (RIM_ - R)), y = -DROP * (1 - Math.cos(k * Math.PI)) / 2, s2 = world ? 4.5 + Math.random() * 4.5 : 3 + Math.random() * 4; o3.position.set(cx + Math.cos(a) * r, y + s2 * 0.6, cz + Math.sin(a) * r); o3.scale.set(s2, s2 * (0.8 + Math.random() * 0.5), s2); o3.updateMatrix(); trees.setMatrixAt(q, o3.matrix); trees.setColorAt(q, tc.set(['#3f6a3c', '#4f7a44', '#355f36', '#5a8a4a', '#2f5a34'][q % 5])); q++; }
  trees.count = q; sc.add(trees); hg.summitTrees = trees;
  // 3) N서울타워 (실제 비율): 기단 → 흰 콘크리트 기둥(살짝 가늘어짐) → 전망대(여러 층 · 창 띠) → 위 기둥 → 빨강 · 흰 안테나 (꼭대기 236m)
  const T = new THREE.Group(); T.position.set(cx, 0, cz); sc.add(T); const conc = lam({ color: '#ecebe6' }), dark = lam({ color: '#3a3f47' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 132, 24), conc); shaft.position.y = 66; T.add(shaft);
  for (let y = 10; y < 130; y += 12) { const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6 - y * 0.0105 + 0.05, 0.08, 4, 32), lam({ color: '#d9d6cf' })); ring.rotation.x = Math.PI / 2; ring.position.y = y; T.add(ring); }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(13, 4.4, 9, 32, 1, true), conc); skirt.material.side = THREE.DoubleSide; skirt.position.y = 129; T.add(skirt);
  const winT = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c = cv.getContext('2d'); c.fillStyle = '#2f3a46'; c.fillRect(0, 0, 256, 32); for (let x = 0; x < 256; x += 8) { c.fillStyle = 'rgba(255,240,210,.85)'; c.fillRect(x + 1, 6, 6, 20); } const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const podWin = lam({ map: winT, emissive: '#ffffff', emissiveMap: winT, emissiveIntensity: 0.15 }); hg.towerWinM = podWin;
  for (const [y, r0, r1, h] of [[135, 13.4, 13.4, 4.5], [140, 14.2, 14.2, 4.5], [145, 13.6, 13.6, 4.2], [149.5, 12.2, 12.2, 3.8]]) { const lv = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 40, 1, true), podWin); lv.position.y = y + h / 2; T.add(lv); const cap = new THREE.Mesh(new THREE.CylinderGeometry(r1 + 0.4, r1 + 0.4, 0.5, 40), conc); cap.position.y = y + h; T.add(cap); }
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 22, 16), conc); upper.position.y = 165; T.add(upper);
  for (let i = 0; i < 9; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.4 - i * 0.12, 1.5 - i * 0.12, 7.2, 10), lam({ color: i % 2 ? '#f2f0ea' : '#d8352a' })); seg.position.y = 179.6 + i * 7.2; T.add(seg); }
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3b30' })); tipL.position.y = 236.5; T.add(tipL); hg.towerTip = tipL;
  // 밤 색조명: 기둥에 은은한 색 (천천히 바뀐다) + 전망대 아래 빛 띠
  const glowM = new THREE.MeshBasicMaterial({ color: '#7a6cff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); const glow = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6.0, 128, 24, 1, true), glowM); glow.position.y = 64; T.add(glow); hg.towerGlowM = glowM;
  hg.addCircle(cx, cz, 6, 300);
  // 기단 건물 둘레 테라스 바닥 (돌)
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(28, 48), lam({ color: '#cfc8bb' })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.02, cz); sc.add(plaza);
  // 4) 사랑의 자물쇠: 타워 둘레 울타리(기둥 · 난간 세 줄)에 색색 자물쇠가 난간마다 빼곡히 매달린다. 서울 전체에선 건물이 있는 자리는 건너뛴다
  { const rr = 34, A0 = 2.2, A1 = 2.2 + Math.PI * 2 * 0.62, STEP = 1.8 / rr, pts = [], RAILS = [0.45, 0.8, 1.15];
    for (let a = A0; a <= A1 + 1e-6; a += STEP) { const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; pts.push({ a, x, z, ok: !world || hg.groundAt(x, z, 9999) <= 0 }); }
    const fp = []; const box = (w, h, d, x, y, z, ry) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(x, y, z); fp.push(g); };
    const segs = []; for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (!p.ok) continue; box(0.08, 1.3, 0.08, p.x, 0.65, p.z, -p.a); const q = pts[k + 1]; if (q?.ok) { const L2 = Math.hypot(q.x - p.x, q.z - p.z), ry = Math.atan2(q.x - p.x, q.z - p.z) + Math.PI / 2; for (const y of RAILS) box(L2, 0.035, 0.035, (p.x + q.x) / 2, y, (p.z + q.z) / 2, ry); segs.push([p, q]); } }
    if (fp.length) sc.add(new THREE.Mesh(mergeGeometries(fp), lam({ color: '#5a5f66' })));
    // 자물쇠: 몸통 + 고리 (흰색 모양을 인스턴스 색으로 칠한다)
    const body = new THREE.BoxGeometry(0.07, 0.075, 0.028); body.translate(0, -0.05, 0); const shk = new THREE.TorusGeometry(0.024, 0.006, 4, 10, Math.PI); shk.translate(0, -0.012, 0); const lg = mergeGeometries([body.toNonIndexed(), shk.toNonIndexed()]);
    const N = Math.min(3200, segs.length * 34), im = new THREE.InstancedMesh(lg, new THREE.MeshPhongMaterial({ color: '#ffffff', shininess: 60 }), Math.max(1, N)), oo = new THREE.Object3D(), c3 = new THREE.Color(), PAL = ['#ff4d6d', '#ffd23f', '#4fc3ff', '#7be07b', '#ff9ec0', '#b57bff', '#ffffff', '#ff8a3d', '#d9dde2', '#c9a24a'];
    let s0 = 7; const R = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) { const [p, q] = segs[Math.floor(R() * segs.length)], t = R(), y = RAILS[Math.floor(R() * 3)], side = R() < 0.5 ? -0.03 : 0.03, a = p.a + (q.a - p.a) * t; oo.position.set(p.x + (q.x - p.x) * t + Math.cos(a) * side, y - R() * 0.03, p.z + (q.z - p.z) * t + Math.sin(a) * side); oo.rotation.set(0, Math.PI / 2 - a, (R() - 0.5) * 0.5); const sz = 0.8 + R() * 0.6; oo.scale.set(sz, sz, sz); oo.updateMatrix(); im.setMatrixAt(i, oo.matrix); im.setColorAt(i, c3.set(PAL[Math.floor(R() * PAL.length)])); }
    im.count = N; sc.add(im);
    const LF = { cx, cz, r: rr, a0: A0, a1: A1, ok: segs.map(([p, q]) => [p.a, q.a]), rails: RAILS }; hg.lockFence = LF; if (world) hg.host.lockFence = LF; }
  // 5) 팔각정 · 봉수대 (이정표 자리 옆)
  const markAt = (re, lat) => { const m = (M.marks || []).find(([nm]) => re.test(nm)); return m ? hg.world(m[1], lat) : null; };
  const pv = markAt(/팔각정/, 10); if (pv) { const g = new THREE.Group(); g.position.set(pv[0], 0, pv[1]); sc.add(g); const base = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.8, 8), lam({ color: '#b9b0a0' })); base.position.y = 0.4; g.add(base); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8, col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 3.6, 10), lam({ color: '#9a2a1e' })); col2.position.set(Math.cos(a) * 5.6, 2.6, Math.sin(a) * 5.6); g.add(col2); hg.addCircle(pv[0] + Math.cos(a) * 5.6, pv[1] + Math.sin(a) * 5.6, 0.3, 4.4); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.0, 0.6, 8, 1, true), lam({ color: '#2f7a6a', side: THREE.DoubleSide })); beam.position.y = 4.5; g.add(beam); const roof = new THREE.Mesh(new THREE.ConeGeometry(8.6, 3.6, 8, 1), lam({ color: '#4a4e55' })); roof.position.y = 6.5; roof.scale.y = 0.85; g.add(roof); const eave = new THREE.Mesh(new THREE.CylinderGeometry(8.9, 8.9, 0.25, 8), lam({ color: '#3a3e44' })); eave.position.y = 5.0; g.add(eave); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), lam({ color: '#c9a24a' })); knob.position.y = 8.2; g.add(knob); }
  const bs = markAt(/봉수대/, 12); if (bs) for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.position.set(bs[0] + (i - 2) * 4.2, 0, bs[1]); sc.add(g); const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.4, 12), lam({ color: '#a59a88' })); mound.position.y = 0.7; g.add(mound); const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 2.2, 12), lam({ color: '#b8ad9a' })); chim.position.y = 2.5; g.add(chim); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.3, 12), dark); top.position.y = 3.7; g.add(top); hg.addCircle(g.position.x, g.position.z, 1.8, 3.8); }
  // 6) 케이블카: 위 정류장(타워에 가까운 지도 건물) ↔ 아래 정류장(회현 쪽, 서울 전체에선 실제 건물 · 없으면 600m 아래로) — 줄 두 가닥(처짐) + 서로 엇갈려 오가는 빨간 · 노란 객차 (두 대가 한 줄에 매달려 반대로 움직인다)
  { const kn = M.names.indexOf('남산케이블카'), sts = [];
    for (const b of M.buildings) if (b[4] === kn) { let x = 0, z = 0, n = 0; for (let k = 7; k < b.length; k += 2) { x += b[k] * S; z += b[k + 1] * S; n++; } sts.push([x / n, z / n]); }
    sts.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    if (sts.length) { const [kx, kz] = sts[0], low = world ? sts.find((q) => Math.hypot(q[0] - kx, q[1] - kz) > 200) : null, dir = low ? new THREE.Vector3(low[0] - kx, 0, low[1] - kz).normalize() : new THREE.Vector3(kx - cx, 0, kz - cz).normalize(), L = low ? Math.hypot(low[0] - kx, low[1] - kz) : 600;
      const start = new THREE.Vector3(kx, 8 + H(kx, kz), kz), end = new THREE.Vector3(kx + dir.x * L, world ? 8 + H(kx + dir.x * L, kz + dir.z * L) : -150, kz + dir.z * L), side = new THREE.Vector3(-dir.z, 0, dir.x), SAG = 14;
      // 줄 높이: 양 끝을 잇는 처진 줄, 서울 전체에선 숲 위로 넉넉히 (땅 + 26m, 정류장 가까이는 낮게) — 부드럽게 다듬는다
      const NP = 48, prof = []; for (let k = 0; k <= NP; k++) { const u = k / NP, x = lerpN(start.x, end.x, u), z = lerpN(start.z, end.z, u), chord = lerpN(start.y, end.y, u) - Math.sin(u * Math.PI) * SAG, clr = 8 + 18 * Math.min(1, Math.min(u, 1 - u) / 0.12); prof.push(world ? Math.max(chord, H(x, z) + clr) : chord); }
      for (let pass = 0; pass < 4; pass++) for (let k = 1; k < NP; k++) prof[k] = (prof[k - 1] + prof[k] * 2 + prof[k + 1]) / 4;
      const at = (u, sd) => { const f = Math.max(0, Math.min(NP - 1e-6, u * NP)), i = Math.floor(f); return start.clone().lerp(end, u).addScaledVector(side, sd).setY(lerpN(prof[i], prof[i + 1], f - i)); };
      const lm = new THREE.LineBasicMaterial({ color: '#26282c' }); for (const sd of [-1.6, 1.6]) { const pts = []; for (let k = 0; k <= 40; k++) pts.push(at(k / 40, sd).setY(at(k / 40, sd).y + 0.02)); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm); ln.userData.noDrape = true; sc.add(ln); }
      // 객차: 바닥 · 둥근 지붕 · 네 귀퉁이 기둥 · 큰 유리(안에 탄 곰이 보인다) · 색 띠 · 매달린 팔 · 줄을 잡는 바퀴
      const glassM = new THREE.MeshPhongMaterial({ color: '#bfd8e6', transparent: true, opacity: 0.28, shininess: 90, depthWrite: false, side: THREE.DoubleSide });
      hg.cable = { start, end, side, at, cabins: [0, 1].map((k) => { const cab = new THREE.Group(), col = k ? '#f2c230' : '#d8352a', paint = lam({ color: col }), steel = lam({ color: '#c9ccd0' });
        const floor = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.35, 3.8), paint); floor.position.y = -3.4; cab.add(floor);
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.3, 3.84), paint); skirt.position.y = -3.2; cab.add(skirt);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.32, 3.96), paint); roof.position.y = -1.0; cab.add(roof); const roof2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 3.2), steel); roof2.position.y = -0.74; cab.add(roof2);
        for (const [x, z] of [[-1.3, -1.85], [1.3, -1.85], [-1.3, 1.85], [1.3, 1.85]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.1), steel); p.position.set(x, -2.0, z); cab.add(p); }
        const glass = new THREE.Mesh(new THREE.BoxGeometry(2.62, 1.75, 3.74), glassM); glass.position.y = -2.0; glass.renderOrder = 2; cab.add(glass);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), dark); arm.position.y = -0.62; cab.add(arm);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 1.6), dark); grip.position.y = 0; cab.add(grip); for (const z of [-0.6, 0.6]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), steel); wh.rotation.z = Math.PI / 2; wh.position.set(0, 0.12, z); cab.add(wh); }
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 2.8), new THREE.MeshBasicMaterial({ color: '#fff1cf', transparent: true, opacity: 0.0 })); lamp.position.y = -1.18; cab.add(lamp); cab.userData.lamp = lamp;
        cab.userData.noDrape = true; sc.add(cab); return { cab, k }; }), t: 0 };
      if (world) hg.host.cableRef = hg.cable; } }
  // 7) 전망대 안 (실제 높이 140m): 바닥 · 천장 · 유리창 틀 · 가운데 엘리베이터 기둥 · 망원경 · 경치 보는 곰. 바깥이 진짜로 내려다보인다
  const DY = 140, DR = 12.6, deck = new THREE.Group(); deck.position.set(cx, DY, cz); sc.add(deck);
  const fl = new THREE.Mesh(new THREE.RingGeometry(4.6, DR, 48), lam({ color: '#c9b49a', side: THREE.DoubleSide })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.02; deck.add(fl);
  const ce = new THREE.Mesh(new THREE.RingGeometry(4.6, DR, 48), lam({ color: '#f0ece4', side: THREE.DoubleSide })); ce.rotation.x = Math.PI / 2; ce.position.y = 3.4; deck.add(ce);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, mu = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), dark); mu.position.set(Math.cos(a) * (DR - 0.1), 1.7, Math.sin(a) * (DR - 0.1)); deck.add(mu); }
  const sill = new THREE.Mesh(new THREE.TorusGeometry(DR - 0.25, 0.06, 4, 64), lam({ color: '#8a6440' })); sill.rotation.x = Math.PI / 2; sill.position.y = 0.95; deck.add(sill);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3.4, 32), lam({ color: '#e8e2d8' })); core.position.y = 1.7; deck.add(core);
  const evT = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#c9ced4'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#2b3039'; c.fillRect(0, 0, 128, 14); c.fillStyle = '#ffd98a'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('엘리베이터 ▼', 64, 11); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ev = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), lam({ map: evT, emissive: '#ffffff', emissiveMap: evT, emissiveIntensity: 0.2 })); ev.position.set(0, 1.3, 4.52); deck.add(ev);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.2, l = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12), new THREE.MeshBasicMaterial({ color: '#fff3dc' })); l.rotation.x = Math.PI / 2; l.position.set(Math.cos(a) * 8.6, 3.38, Math.sin(a) * 8.6); deck.add(l); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5, tg = new THREE.Group(); tg.position.set(Math.cos(a) * (DR - 1.1), 0, Math.sin(a) * (DR - 1.1)); tg.rotation.y = -a + Math.PI / 2; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 8), dark); st.position.y = 0.6; tg.add(st); const sc2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 10), lam({ color: '#c9a24a' })); sc2.rotation.x = Math.PI / 2; sc2.position.set(0, 1.25, 0.1); tg.add(sc2); deck.add(tg); }
  const ring = (r, h) => { const pts = []; for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return pts; };
  // 밟는 바닥(140m) + 바깥 유리벽 (조각 32개) — 부딪힘만
  hg.addFoot({ ring: ring(DR, 0), h: DY, x0: cx - DR, x1: cx + DR, z0: cz - DR, z1: cz + DR, name: 'N서울타워 전망대', type: 'stone', noClimb: true, deck: true });
  for (let i = 0; i < 32; i++) { const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2, r0 = DR - 0.2, r1 = DR + 0.3, q = [[cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1]], xs = q.map((p) => p[0]), zs = q.map((p) => p[1]); hg.addFoot({ ring: q, h: DY + 3.4, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name: '', type: 'stone', noClimb: true, deckWall: true }); }
  hg.deckInfo = { cx, cz, DY, DR, deck }; if (world) hg.host.deckInfo = hg.deckInfo; // 전망대 드나들기는 서울 전체(바깥) 쪽에서 본다
  return { cx, cz, R, DROP };
}
export function deckBears(hg, makeBear) { const D = hg.deckInfo; if (!D || D.bears) return; D.bears = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.9, b = makeBear({ color: ['#ffd1dc', '#c8e6ff', '#fff3c4', '#d8f5d0', '#e8d5ff', '#f2d4b0', '#ffffff'][i] }); b.root.scale.setScalar(0.42); b.root.position.set(Math.cos(a) * (D.DR - 1.4), 0.02, Math.sin(a) * (D.DR - 1.4)); b.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); D.deck.add(b.root); D.bears.push(b); } }
// 밤 조명 · 케이블카 움직임
export function tickSummit(hg, dt, lit) {
  if (hg.towerGlowM) { const h = (hg.time * 0.01) % 1; hg.towerGlowM.color.setHSL(0.62 + Math.sin(h * Math.PI * 2) * 0.12, 0.7, 0.55); hg.towerGlowM.opacity = lit * 0.45; }
  if (hg.towerWinM) hg.towerWinM.emissiveIntensity = 0.15 + lit * 0.85;
  if (hg.towerTip) hg.towerTip.visible = Math.sin(hg.time * 3) > -0.2;
  // 케이블카: 90초에 한 번 오르내림. 명소 체험으로 타는 동안은 C.hold(0 = 위 정류장 ~ 1 = 아래)로 그 자리에 (정류장에선 잠깐 멈춘다)
  const C = hg.cable; if (C) { if (C.hold != null) C.t = C.hold; else { C.ph = ((C.ph || 0) + dt / 110) % 1; const p = C.ph; C.t = p < 0.06 ? 0 : p < 0.5 ? smooth01((p - 0.06) / 0.44) : p < 0.56 ? 1 : 1 - smooth01((p - 0.56) / 0.44); } for (const { cab, k } of C.cabins) { const u = k ? 1 - C.t : C.t; cab.position.copy(C.at(u, k ? 1.6 : -1.6)); cab.userData.lamp.material.opacity = lit * 0.9; } }
}
