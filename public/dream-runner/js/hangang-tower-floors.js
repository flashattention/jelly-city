// 롯데월드타워 층들 (8-26): 층마다 F = { g, area(걸을 곳), spots(E 로 하는 것), spawn, box, tick, ... } 를 돌려준다
//   층 안쪽 좌표: 탑 가운데가 (0, 0), x 동쪽 · z 남쪽 · 바닥 y = 0. 창이 보는 방향 = 실제 동서남북
//   상표 · 가게 이름 대신 일반 이름(하늘 호텔 · 하늘 뷔페 · 전망대)
import * as THREE from 'three';
import { G, T, TKit, Atlas, Area, instanced, canvasTex, txt, clamp, lerp, hash, inRSq, rsqOutline } from './hangang-tower-lib.js';
import { Riders } from './hangang-park.js';

export const FLOORS = {
  lobby: { n: 1, btn: '1', name: '1층 로비', alt: 0, sub: '안내 데스크 · 밖으로 나가는 문' },
  hlobby: { n: 79, btn: '79', name: '79층 하늘 호텔 로비', alt: 320, sub: '프론트 · 체크인' },
  buffet: { n: 81, btn: '81', name: '81층 하늘 뷔페', alt: 328, sub: '창가 자리 · 음식 줄', soon: true },
  room: { n: 87, btn: '87', name: '87층 일반 객실', alt: 352, need: 'room', soon: true },
  suite: { n: 94, btn: '94', name: '94층 스위트', alt: 381, need: 'suite', soon: true },
  ph: { n: 100, btn: '100', name: '100층 펜트하우스', alt: 405, need: 'ph', soon: true },
  obs: { n: 118, btn: '118', name: '118층 전망대', alt: 478, sub: '유리 바닥 · 478m', soon: true },
  car: { n: 0, btn: '', name: '엘리베이터 안', alt: 0 },
};
export function buildFloor(key, C) { return (BUILD[key] || BUILD.lobby)(C); }

// ---------- 공용 ----------
function floorBase(key, C) {
  const g = new THREE.Group(); g.name = 'floor-' + key; const atlas = new Atlas();
  const kit = new TKit({ win: C.shell.win, sign: atlas.mat, signGlow: atlas.glow });
  return { g, atlas, kit, area: new Area(), spots: [], bears: [], key };
}
// 직원 · 손님 곰 (진짜 곰: 몇 마리만). top = 옷 색, hat = 'chef' 면 하얀 요리사 모자
function npc(F, C, x, z, face, o = {}) {
  let sd = (Math.floor(Math.abs(x * 7919 + z * 104729)) + F.bears.length * 31 + 7) % 2147483646 + 1; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647, b = C.hg.mkBear('stroll', r, o.scale || 1, { weather: 'clear', top: o.top, fur: o.fur });
  b.root.removeFromParent(); F.g.add(b.root); b.root.position.set(x, o.y || 0, z); b.root.rotation.y = face; b.root.userData.npc = false; b.root.userData.bear = b;
  if (o.hat === 'chef') { const m = new THREE.MeshLambertMaterial({ color: '#ffffff' }); m.userData.own = true; const h = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.5, 14), m); h.position.y = 0.62; b.head.add(h); const t = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 8), m); t.position.y = 0.92; t.scale.y = 0.6; b.head.add(t); }
  if (o.tie) { const m = new THREE.MeshLambertMaterial({ color: o.tie }); m.userData.own = true; const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), m); t.position.set(0, 1.05, 0.42); t.rotation.x = Math.PI; b.torso.add(t); }
  const N = { b, x, z, face, home: [x, z, face], wave: 0, greet: false, ...o }; F.bears.push(N); return N;
}
// 직원이 다가온 곰을 바라보고 인사 (머리를 돌리고 앞발을 흔든다)
function tickStaff(N, dt, C, F, say) {
  const hg = C.hg, lx = hg.px - C.O.x, lz = hg.pz - C.O.z, d = Math.hypot(lx - N.x, lz - N.z);
  const want = Math.atan2(lx - N.x, lz - N.z) - N.face, a = ((want + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  N.look = lerp(N.look || 0, d < 7 ? clamp(a, -1.1, 1.1) : 0, Math.min(1, dt * 4));
  if (d < 4.5 && !N.greet) { N.greet = true; N.wave = 1.8; if (say) C.toast(say); } if (d > 9) N.greet = false;
  N.b.update(dt, 0, { noCrawl: true }); N.b.head.rotation.y = N.look;
  if (N.wave > 0) { N.wave -= dt; const a0 = N.b.arms[0]; if (a0) { a0.rotation.x = -2.4; a0.rotation.z = Math.sin(N.wave * 14) * 0.35; } N.b.torso.rotation.x = Math.max(0, Math.sin((1.8 - N.wave) * 2.2)) * 0.25; }
}
// 창 한 줄: 바닥 ~ 천장 유리 + 세로 창살 (a → b, 방 안쪽을 본다)
function glassWall(F, ax, az, bx, bz, h, { step = 1.5, y0 = 0, frame = '#3b3e43', transom = [], inward = 1 } = {}) {
  // 판의 앞(+z)이 방 안쪽을 보게: 걷는 방향 (dx, dz) 의 안쪽 법선 = (dz, -dx)
  const k = F.kit, L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)), ry = Math.atan2(bz - az, -(bx - ax)) + (inward < 0 ? Math.PI : 0);
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, cx = lerp(ax, bx, (t0 + t1) / 2), cz = lerp(az, bz, (t0 + t1) / 2); const p = new THREE.PlaneGeometry(L / n - 0.02, h); p.translate(0, h / 2, 0); k.add(p, '#ffffff', 'win', T(cx, y0, cz, ry)); }
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(ax, bx, t), z = lerp(az, bz, t); k.add(G.box(0.07, h, 0.22), frame, 'metal', T(x, y0, z, ry)); }
  for (const y of [0, h, ...transom]) { k.add(G.box(L, 0.07, 0.16), frame, 'metal', T((ax + bx) / 2, y0 + y - 0.035, (az + bz) / 2, ry)); }
}

// ============================================================
// 1층 로비: 높은 천장의 흰 돌 로비 · 남쪽 유리 정면(회전문) · 안내 데스크 · 층 안내판 · 엘리베이터 넷 · 빛의 물결 조각
// ============================================================
function lobby(C) {
  const F = floorBase('lobby', C), k = F.kit, A = F.atlas, W = 36, D = 26, H = 11, hw = W / 2, hd = D / 2;
  F.center = [0, 0]; F.sunK = 0.9; F.hemiD = 1.0; F.hemiN = 0.35; F.ambN = 0.6; F.floorTint = '#d8d0c4';
  // 바깥: 남쪽 유리 앞(광장) 눈높이에서 본 거리
  F.viewAt = [10826, 1.7, 1979, 0.4];
  F.spawn = { door: { x: 0, z: hd - 2.4, face: Math.PI }, elev: { x: 0, z: -hd + 2.6, face: 0 } };
  F.box = () => [-hw, hw, -hd, hd]; F.ceil = () => H;
  // 바닥 · 천장 · 벽 (흰 돌, 벽엔 세로 돌기둥)
  k.add(G.floor(W, D, 1.5), '#ffffff', 'marble', T(0, 0, 0));
  { const c = new THREE.PlaneGeometry(W, D); c.rotateX(Math.PI / 2); k.add(c, '#f4f1ec', 'std', T(0, H, 0)); }
  for (const [x, z, ry, w] of [[0, -hd, 0, W], [-hw, 0, Math.PI / 2, D], [hw, 0, -Math.PI / 2, D]]) k.add(G.wall(w, H, 3), '#ffffff', 'stone', T(x, 0, z, ry));
  for (let z = -hd + 1.2; z < hd - 1; z += 2.4) for (const s of [-1, 1]) k.add(G.box(0.5, H, 0.28), '#f2eee7', 'stone', T(s * (hw - 0.25), 0, z));
  // 바닥 걸레받이 · 천장 띠 조명
  for (const [x, z, ry, w] of [[0, -hd + 0.03, 0, W], [-hw + 0.03, 0, Math.PI / 2, D], [hw - 0.03, 0, -Math.PI / 2, D]]) k.add(G.box(w, 0.12, 0.04), '#b9ad9c', 'satin', T(x, 0, z, ry));
  for (let x = -14; x <= 14; x += 3.5) k.add(G.box(0.16, 0.04, D - 5), '#fff4df', 'glow', T(x, H - 0.05, 0));
  // 남쪽 유리 정면 (광장) + 가운데 회전문
  glassWall(F, -hw, hd, hw, hd, H, { step: 1.8, transom: [3.4, 7.2], frame: '#4a4d52' });
  const rev = new THREE.Group(); rev.position.set(0, 0, hd - 0.2); F.g.add(rev);
  { const kk = new TKit(); kk.add(G.cyl(1.7, 1.7, 0.18, 32), '#5a5d62', 'metal', T(0, 2.75, 0)); kk.add(G.cyl(1.75, 1.75, 0.04, 32), '#c9c2b6', 'satin', T(0, 0, 0)); kk.build(rev); }
  const wings = new THREE.Group(); rev.add(wings); { const kk = new TKit(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; kk.add(G.box(1.6, 2.6, 0.04), '#ffffff', 'glass', T(Math.sin(a) * 0.82, 0.08, Math.cos(a) * 0.82, a + Math.PI / 2)); kk.add(G.box(0.06, 2.6, 0.06), '#5a5d62', 'metal', T(Math.sin(a) * 1.62, 0.08, Math.cos(a) * 1.62)); } kk.add(G.cyl(0.08, 0.08, 2.7, 10), '#5a5d62', 'metal', T(0, 0, 0)); kk.build(wings); }
  F.area.pole(0, hd - 0.2, 1.75);
  // 엘리베이터 넷 (북쪽 벽): 청동 문틀 · 스테인리스 문 · 위에 층 표시등
  const doors = [-5.4, -1.8, 1.8, 5.4];
  k.add(G.box(16, 4.2, 0.3), '#2e2a26', 'marbleD', T(0, 0, -hd + 0.15));
  for (const x of doors) { k.add(G.box(1.5, 2.7, 0.06), '#c4c7cb', 'chrome', T(x, 0, -hd + 0.33)); k.add(G.box(0.012, 2.7, 0.07), '#6d7075', 'metal', T(x, 0, -hd + 0.34)); for (const s of [-1, 1]) k.add(G.box(0.12, 2.9, 0.16), '#8a6a45', 'metal', T(x + s * 0.81, 0, -hd + 0.36)); k.add(G.box(1.74, 0.14, 0.16), '#8a6a45', 'metal', T(x, 2.84, -hd + 0.36)); k.add(G.box(0.08, 0.16, 0.03), '#d6d0c6', 'metal', T(x + 1.02, 1.1, -hd + 0.32)); k.add(G.ball(0.026, 8), '#ffb24a', 'glow', T(x + 1.02, 1.24, -hd + 0.35)); }
  // 층 표시등: 문 위 검은 유리에 주황 숫자 (네 개를 그림 한 장으로, 0.5초마다)
  const ind = canvasTex(512, 64, () => {}, false), indM = new THREE.MeshBasicMaterial({ map: ind }); indM.userData.own = true;
  { const geos = doors.map((x, i) => { const p = new THREE.PlaneGeometry(0.9, 0.22), uv = p.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j)) / 4); p.translate(x, 3.25, -hd + 0.31); return p; }); const m = new THREE.Mesh(mergeG(geos), indM); F.g.add(m); }
  const cars = doors.map((_, i) => ({ f: [1, 79, 118, 40][i], to: [118, 1, 1, 81][i], wait: 0 }));
  const drawInd = () => { const c = ind.image.getContext('2d'); c.fillStyle = '#0b0b0d'; c.fillRect(0, 0, 512, 64); cars.forEach((q, i) => { const x = i * 128 + 64; txt(c, (q.to > q.f ? '▲ ' : q.to < q.f ? '▼ ' : '') + Math.round(q.f), x, 34, 38, '#ffae3a', 'Menlo, monospace'); }); ind.needsUpdate = true; }; drawInd();
  // 엘리베이터 위 안내 글씨
  { const r = A.rect(900, 120, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '전망대 · 하늘 호텔 · 하늘 뷔페  ↑', w / 2, h / 2, 66, '#e9d2a2'); }); A.plane(k, r, 7.2, 0.96, T(0, 3.72, -hd + 0.31), '#ffffff', 'signGlow'); }
  // 안내 데스크: 둥근 흰 돌 · 참나무 윗판 · 앞면 따뜻한 빛 띠, 직원 한 명
  { const sh = new THREE.Shape(); const R0 = 1.6, R1 = 2.2, a0 = Math.PI * 0.18, a1 = Math.PI * 0.82; sh.absarc(0, 0, R1, a0, a1, false); sh.absarc(0, 0, R0, a1, a0, true); const ex = (h, b = false) => { const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: b, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 }); g.rotateX(-Math.PI / 2); return g; };
    k.add(ex(1.02), '#f5f2ec', 'gloss', T(-9, 0, -5.2)); k.add(ex(0.05, true), '#ffffff', 'oak', T(-9, 1.02, -5.2)); const s2 = new THREE.Shape(); s2.absarc(0, 0, R1 + 0.01, a0 + 0.05, a1 - 0.05, false); s2.absarc(0, 0, R1 - 0.02, a1 - 0.05, a0 + 0.05, true); const lg = new THREE.ExtrudeGeometry(s2, { depth: 0.06, bevelEnabled: false, curveSegments: 24 }); lg.rotateX(-Math.PI / 2); k.add(lg, '#ffd9a0', 'glow', T(-9, 0.12, -5.2));
    k.add(G.box(0.5, 0.32, 0.04), '#1b1d22', 'gloss', T(-9.5, 1.07, -4.0, 0.3, -0.3)); k.add(G.cyl(0.07, 0.07, 0.03, 12), '#c9a56a', 'metal', T(-8.4, 1.07, -3.6)); }
  F.area.wall(-11.3, -5.4, -6.7, -2.9);
  const staff = npc(F, C, -9, -5.6, 0, { top: '#23324f', tie: '#c9a56a' });
  // 층 안내판: 검은 유리 · 금빛 글씨 (층마다 무엇이 있는지)
  { k.add(G.box(2.6, 0.3, 0.6), '#d8d2c8', 'stone', T(9, 0, -5)); k.add(G.box(2.4, 3.6, 0.1), '#141518', 'gloss', T(9, 0.3, -5));
    const rows = [['118', '전망대 · 유리 바닥 (478m)'], ['100', '하늘 호텔 펜트하우스'], ['94', '하늘 호텔 스위트'], ['87', '하늘 호텔 객실'], ['81', '하늘 뷔페'], ['79', '하늘 호텔 로비 · 프론트'], ['1', '로비 · 안내 데스크']];
    const r = A.rect(560, 860, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '층 안내', w / 2, 70, 58, '#e9c98f'); c.fillStyle = 'rgba(233,201,143,.5)'; c.fillRect(60, 118, w - 120, 2); rows.forEach(([n, s], i) => { const y = 190 + i * 98; txt(c, n, 110, y, 54, '#f4e4c4', 'Georgia, serif', 140); txt(c, s, 190, y, 34, '#efe8dc', undefined, 340, 'left'); }); });
    A.plane(k, r, 2.2, 3.38, T(9, 1.99, -4.94), '#ffffff', 'signGlow'); F.area.wall(7.6, -5.4, 10.4, -4.6); }
  // 큰 화분 둘 (돌 상자 · 나무) · 긴 돌 의자 넷
  const tree = (x, z) => { k.add(G.box(3, 0.85, 3), '#e6e0d6', 'stone', T(x, 0, z)); k.add(G.box(2.8, 0.06, 2.8), '#4a3b2c', 'std', T(x, 0.8, z)); k.add(G.cyl(0.16, 0.11, 3.4, 8), '#6b4f38', 'std', T(x, 0.85, z)); for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.3 + hash(i, x) * 0.9, y = 3.3 + hash(i, z) * 1.6; k.add(new THREE.IcosahedronGeometry(0.75 + hash(i, 2) * 0.5, 1), ['#4f7d3e', '#5e8f48', '#6aa052'][i % 3], 'std', T(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr)); } F.area.wall(x - 1.5, z - 1.5, x + 1.5, z + 1.5); };
  tree(-13.5, 6.5); tree(13.5, 6.5);
  const bench = (x, z, ry) => { k.add(G.box(3.2, 0.42, 0.7), '#ece7df', 'stone', T(x, 0, z, ry)); k.add(G.box(3.1, 0.05, 0.6), '#ffffff', 'oak', T(x, 0.42, z, ry)); const ax = Math.abs(Math.sin(ry)) > 0.5; F.area.wall(x - (ax ? 0.4 : 1.65), z - (ax ? 1.65 : 0.4), x + (ax ? 0.4 : 1.65), z + (ax ? 1.65 : 0.4)); for (const o of [-0.8, 0.8]) { const sx = x + (ax ? 0 : o), sz = z + (ax ? o : 0); F.spots.push({ x: sx + Math.sin(ry) * 0.6, z: sz + Math.cos(ry) * 0.6, r: 0.9, label: '앉기', act: () => C.sit({ x: sx, y: 0.47, z: sz, yaw: ry, label: '일어나기', out: [sx + Math.sin(ry) * 0.9, sz + Math.cos(ry) * 0.9] }) }); } };
  // 바닥 무늬: 빛 조각 아래 짙은 돌 고리 · 금빛 줄 (반사되는 바닥 위 둥근 무늬)
  { const r1 = new THREE.RingGeometry(4.2, 5.0, 64); r1.rotateX(-Math.PI / 2); k.add(r1, '#ffffff', 'marbleD', T(0, 0.004, -0.6)); const r2 = new THREE.RingGeometry(5.0, 5.06, 64); r2.rotateX(-Math.PI / 2); k.add(r2, '#c9a56a', 'metal', T(0, 0.006, -0.6)); const r3 = new THREE.RingGeometry(1.2, 1.26, 48); r3.rotateX(-Math.PI / 2); k.add(r3, '#c9a56a', 'metal', T(0, 0.006, -0.6)); }
  // 벽 아래 · 위 숨은 빛 (돌벽을 쓸어 올리는 따뜻한 빛, 밤에 더 밝게)
  for (const s of [-1, 1]) { k.add(G.box(0.06, 0.05, D - 2), '#ffcf8a', 'glow', T(s * (hw - 0.6), 0.02, 0)); k.add(G.box(0.06, 0.05, D - 2), '#ffe4b8', 'glow', T(s * (hw - 0.6), H - 0.4, 0)); }
  // 입구 앞 짙은 매트
  k.add(G.box(5, 0.012, 2.6), '#3b3532', 'std', T(0, 0, hd - 1.9));
  bench(-5, 4.5, 0); bench(5, 4.5, 0); bench(-16.8, -2, Math.PI / 2); bench(16.8, -2, -Math.PI / 2);
  // 빛의 물결: 천장에 매달린 빛 막대 200개 (높이가 물결처럼, 인스턴스 하나)
  const rods = []; { for (let i = 0; i < 20; i++) for (let j = 0; j < 10; j++) { const x = -7.6 + i * 0.8, z = -3.6 + j * 0.8, L = 1.2 + (Math.sin(i * 0.45) + Math.cos(j * 0.7 + i * 0.2)) * 0.9 + 1.6; rods.push([x, z, L]); } const geo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6); geo.translate(0, -0.5, 0); const m = new THREE.MeshBasicMaterial({ color: '#fff1d6' }); m.userData.own = true; const im = new THREE.InstancedMesh(geo, m, rods.length); rods.forEach(([x, z, L], i) => im.setMatrixAt(i, T(x, H, z, 0, 0, 0, new THREE.Vector3(1, L, 1)))); F.g.add(im); const tip = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), m, rods.length); rods.forEach(([x, z, L], i) => tip.setMatrixAt(i, T(x, H - L, z))); F.g.add(tip); F.rodM = m; }
  // 사람들: 걷는 손님 셋 (로비를 천천히 돈다)
  const walkers = [0, 1, 2].map((i) => { const N = npc(F, C, 0, 0, 0, { top: ['#7a4b3a', '#3d5a6c', '#b28a5a'][i] }); N.path = { cx: [-2, 4, 0][i], cz: [1, -2, 6][i], rx: [9, 6, 11][i], rz: [5, 4, 3.2][i], sp: [0.09, -0.11, 0.07][i], a: i * 2 }; return N; });
  // 빛 하나: 데스크 위 따뜻한 등
  const lamp = new THREE.PointLight('#ffd7a0', 0, 12, 1.6); lamp.position.set(-9, 3.2, -4.4); F.g.add(lamp);
  F.spots.push(
    { x: 0, z: hd - 1.6, r: 2.3, label: '밖으로 나가기', hint: '회전문으로 광장에 나가요', act: () => C.finish() },
    { x: 0, z: -hd + 1.6, r: 3.6, label: '엘리베이터 타기', hint: '층 단추판이 열려요', act: () => C.enterCar() },
    { x: -9, z: -2.4, r: 1.8, label: '안내 받기', act: () => { staff.wave = 1.8; C.toast('🛎️ 직원: 전망대는 118층, 호텔 프론트는 79층이에요. 엘리베이터는 안쪽에 있어요'); } },
    { x: 9, z: -3.8, r: 2, label: '층 안내 보기', act: () => C.choose('🏙️ 층 안내', '엘리베이터에서 갈 수 있는 층', Object.entries(FLOORS).filter(([kk]) => kk !== 'car').reverse().map(([, f]) => ({ label: `${f.btn}층`, sub: f.name + (f.sub ? ' · ' + f.sub : ''), on() {} }))) },
  );
  F.area.add(-hw + 0.5, -hd + 0.55, hw - 0.5, hd - 0.3);
  k.build(F.g);
  let indT = 0;
  F.tick = (dt, night) => {
    wings.rotation.y += dt * 0.35; lamp.intensity = 2 + night * 6; F.rodM.color.setScalar(0.85 + night * 0.6);
    tickStaff(staff, dt, C, F, '🛎️ 어서 오세요! 롯데월드타워입니다');
    for (const N of walkers) { const P = N.path; P.a += dt * P.sp; const x = P.cx + Math.cos(P.a) * P.rx, z = P.cz + Math.sin(P.a) * P.rz, x2 = P.cx + Math.cos(P.a + Math.sign(P.sp) * 0.05) * P.rx, z2 = P.cz + Math.sin(P.a + Math.sign(P.sp) * 0.05) * P.rz; N.b.root.position.set(x, 0, z); N.b.root.rotation.y = Math.atan2(x2 - x, z2 - z); N.b.update(dt, 1.4, { noCrawl: true }); }
    indT -= dt; if (indT <= 0) { indT = 0.5; for (const q of cars) { if (q.wait > 0) { q.wait -= 0.5; continue; } const s = Math.sign(q.to - q.f) * Math.min(Math.abs(q.to - q.f), 6); q.f += s; if (q.f === q.to) { q.wait = 3; q.to = [1, 79, 81, 118][Math.floor(Math.random() * 4)]; } } drawInd(); }
  };
  return F;
}
function mergeG(list) { let n = 0; for (const g of list) n += g.index ? g.index.count : g.attributes.position.count; const out = list.map((g) => (g.index ? g.toNonIndexed() : g)); const pos = [], uv = [], nor = []; for (const g of out) { pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); nor.push(...g.attributes.normal.array); } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); void n; return m; }

// ============================================================
// 엘리베이터 칸: 호두나무 아래 벽 · 청동빛 거울 · 놋쇠 손잡이 · 둥근 천장 조명 · 문 위 층 숫자 · 오른쪽 벽 층 단추판
// ============================================================
function car(C) {
  const F = floorBase('car', C), k = F.kit, W = 2.6, Dp = 2.4, H = 2.75, hw = W / 2, hd = Dp / 2;
  F.noView = true; F.noSun = true; F.center = [0, 0]; F.hemiD = 0.55; F.hemiN = 0.55; F.ambN = 0; F.near = true; F.lampCol = '#ffe6c4';
  F.spawn = { in: { x: 0, z: 0, face: 0 } }; F.box = () => [-hw, hw, -hd, hd]; F.ceil = () => H;
  F.camAt = { bear: [0.25, 0.45], face: 0, eye: [-0.2, 1.9, -hd + 0.2] };
  // 칸 안 조명: 천장 가운데 따뜻한 등 (창이 없다)
  { const l = new THREE.PointLight('#ffe2b8', 3.2, 6, 1.2); l.position.set(0, H - 0.25, 0); F.g.add(l); }
  k.add(G.floor(W, Dp, 1.2), '#ffffff', 'marbleD', T(0, 0, 0));
  { const c = new THREE.PlaneGeometry(W, Dp); c.rotateX(Math.PI / 2); k.add(c, '#1d1b19', 'satin', T(0, H, 0)); }
  // 벽: 아래 호두나무 판 · 위 청동빛 거울(짙은 유리) · 판 사이 놋쇠 줄
  for (const [x, z, ry, w] of [[0, -hd, 0, W], [-hw, 0, Math.PI / 2, Dp], [hw, 0, -Math.PI / 2, Dp]]) { k.add(G.wall(w, 1.0, 1.2), '#ffffff', 'wood', T(x, 0, z, ry)); const g = G.wall(w, H - 1.04, 2); g.translate(0, 1.04, 0); k.add(g, '#4a3f36', 'gloss', T(x, 0, z, ry)); k.add(G.box(w, 0.04, 0.03), '#c9a56a', 'metal', T(x, 1.0, z, ry)); for (let i = 1; i < 3; i++) k.add(G.box(0.02, H - 1.04, 0.025), '#9a7c52', 'metal', T(x + Math.cos(ry) * (i * w / 3 - w / 2), 1.04, z - Math.sin(ry) * (i * w / 3 - w / 2), ry)); }
  // 놋쇠 손잡이 (세 벽)
  for (const [x, z, ry, w] of [[0, -hd + 0.07, 0, W - 0.3], [-hw + 0.07, 0, Math.PI / 2, Dp - 0.3], [hw - 0.07, 0, -Math.PI / 2, Dp - 0.3]]) { const r = new THREE.CylinderGeometry(0.022, 0.022, w, 10); r.rotateZ(Math.PI / 2); k.add(r, '#d4af6e', 'metal', T(x, 0.92, z, ry)); }
  // 천장: 가운데 빛 판 + 둘레 작은 등
  k.add(G.box(1.5, 0.02, 1.1), '#fff3dc', 'glow', T(0, H - 0.03, 0)); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.add(G.cyl(0.045, 0.045, 0.02, 10), '#fff6e4', 'glow', T(Math.cos(a) * 1.05, H - 0.03, Math.sin(a) * 0.95)); }
  // 문틀 (앞) + 문 두 짝 (스테인리스, 열리면 양옆으로)
  k.add(G.box(0.45, H, 0.12), '#2c2622', 'satin', T(-hw + 0.22, 0, hd)); k.add(G.box(0.45, H, 0.12), '#2c2622', 'satin', T(hw - 0.22, 0, hd)); k.add(G.box(W, 0.45, 0.12), '#2c2622', 'satin', T(0, H - 0.45, hd));
  // 문: 결이 가는 스테인리스 (세로 결 그림) · 가운데 맞닿는 줄
  const brushed = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#9a9ea3'; c.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,44,50'},${0.04 + Math.random() * 0.08})`; c.fillRect(Math.random() * w, 0, 1, h); } c.fillStyle = 'rgba(20,22,26,.8)'; c.fillRect(w - 2, 0, 2, h); }, false);
  const dm = new THREE.MeshPhongMaterial({ map: brushed, color: '#c9ccd0', shininess: 90, specular: '#d8dade' }); dm.userData.own = true;
  const leaves = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.3, 0.04), dm); m.position.set(s * 0.43, 1.15, hd + 0.02); m.scale.x = s; F.g.add(m); return m; });
  // 문 너머: 도착하면 환한 층 불빛
  { const m = new THREE.MeshBasicMaterial({ color: '#fff4e2' }); m.userData.own = true; const p = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), m); p.position.set(0, 1.2, hd + 0.6); p.rotation.y = Math.PI; F.g.add(p); }
  F.setDoors = (u) => { leaves.forEach((m, i) => { m.position.x = (i ? 1 : -1) * (0.43 + u * 0.84); }); };
  // 층 숫자 (문 위)
  const disp = canvasTex(256, 96, () => {}, false), dmM = new THREE.MeshBasicMaterial({ map: disp, toneMapped: false }); dmM.userData.own = true;
  { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), dmM); p.position.set(0, H - 0.22, hd - 0.07); p.rotation.y = Math.PI; F.g.add(p); }
  F.setDisplay = (n, dir) => { const c = disp.image.getContext('2d'); c.fillStyle = '#07080a'; c.fillRect(0, 0, 256, 96); txt(c, n ? String(n) : '', 150, 50, 66, '#ffffff', 'Menlo, monospace'); if (dir) txt(c, dir > 0 ? '▲' : '▼', 52, 50, 46, '#ffb24a'); disp.needsUpdate = true; };
  // 층 단추판 (오른쪽 벽, 문 옆): 누른 층은 금빛 테두리
  const pan = canvasTex(160, 420, () => {}, false), pM = new THREE.MeshPhongMaterial({ map: pan, shininess: 80, specular: '#ffffff' }); pM.userData.own = true;
  { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.68), pM); p.position.set(hw - 0.012, 1.25, hd - 0.42); p.rotation.y = -Math.PI / 2; F.g.add(p); }
  let lit = 0; const btns = [118, 100, 94, 87, 81, 79, 1];
  const drawPan = () => { const c = pan.image.getContext('2d'), gr = c.createLinearGradient(0, 0, 160, 0); gr.addColorStop(0, '#9da1a6'); gr.addColorStop(0.5, '#d9dce0'); gr.addColorStop(1, '#a3a7ac'); c.fillStyle = gr; c.fillRect(0, 0, 160, 420); btns.forEach((n, i) => { const y = 40 + i * 52; c.beginPath(); c.arc(80, y, 20, 0, 7); c.fillStyle = '#e9ebee'; c.fill(); c.lineWidth = 4; c.strokeStyle = n === lit ? '#ffb24a' : '#7d8186'; c.stroke(); txt(c, String(n), 80, y + 1, n > 99 ? 15 : 18, n === lit ? '#d0761a' : '#2a2c30', 'Menlo, monospace'); }); pan.needsUpdate = true; };
  drawPan(); F.press = (n) => { lit = n; drawPan(); C.SND.click(); };
  F.spots.push({ x: 0, z: 0, r: 3, label: '층 단추', act: () => {} });
  F.area.add(-hw, -hd, hw, hd);
  k.build(F.g);
  F.tick = () => {};
  return F;
}

// ---------- 탑 층 바탕: 둥근 네모 바닥 · 천장 · 둘레 통유리 · 창턱 ----------
function towerFloor(F, C, { R, cr = 7, H = 4, floor = 'marble', floorTile = 1.2, ceil = '#efe9e0', sill = '#d8d0c4', frame = '#2f3236', step = 1.6 }) {
  const k = F.kit; F.R = R; F.cr = cr; F.H = H; F.center = [0, 0];
  { const sh = new THREE.Shape(rsqOutline(R + 0.4, cr + 0.4).map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(sh, 6); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / floorTile, uv.getY(i) / floorTile); k.add(g, '#ffffff', floor, T(0, 0, 0)); const c = g.clone(); c.rotateX(Math.PI); k.add(c, ceil, 'ceil', T(0, H, 0)); }
  const P = rsqOutline(R, cr); for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.2) continue; glassWall(F, a[0], a[1], b[0], b[1], H, { step, frame }); const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[1] - a[1], -(b[0] - a[0])); k.add(G.box(L + 0.05, 0.12, 0.32), sill, 'satin', T((a[0] + b[0]) / 2 + Math.sin(ry) * 0.16, 0, (a[1] + b[1]) / 2 + Math.cos(ry) * 0.16, ry)); }
  F.area.fn((x, z, y, r) => inRSq(x, z, R - 0.45 - r, Math.max(0.5, cr - 0.45 - r)));
  const m = R - 2.4; F.box = () => [-m, m, -m, m]; F.ceil = () => H;
}
// 가운데 코어 (엘리베이터 · 계단이 있는 벽): 호두나무 판 · 놋쇠 줄눈, 남쪽 면에 엘리베이터 문
function core(F, C, { hw = 6, hd = 6, H = 4, doors = [-2.6, 0, 2.6], face = 'wood', label = '' }) {
  const k = F.kit; k.add(G.box(hw * 2, H, hd * 2), '#ffffff', face, T(0, 0, 0)); for (let x = -hw + 1.5; x < hw; x += 1.5) for (const z of [-hd - 0.01, hd + 0.01]) k.add(G.box(0.025, H, 0.02), '#b08a52', 'metal', T(x, 0, z)); for (let z = -hd + 1.5; z < hd; z += 1.5) for (const x of [-hw - 0.01, hw + 0.01]) k.add(G.box(0.02, H, 0.025), '#b08a52', 'metal', T(x, 0, z));
  for (const x of doors) { k.add(G.box(1.5, 2.7, 0.06), '#c4c7cb', 'chrome', T(x, 0, hd + 0.03)); k.add(G.box(0.012, 2.7, 0.07), '#6d7075', 'metal', T(x, 0, hd + 0.04)); for (const s of [-1, 1]) k.add(G.box(0.12, 2.9, 0.12), '#8a6a45', 'metal', T(x + s * 0.81, 0, hd + 0.05)); k.add(G.box(1.74, 0.14, 0.12), '#8a6a45', 'metal', T(x, 2.84, hd + 0.05)); k.add(G.box(0.4, 0.07, 0.02), '#140f0c', 'gloss', T(x, 3.15, hd + 0.03)); k.add(G.ball(0.025, 8), '#ffb24a', 'glow', T(x - 0.12, 3.185, hd + 0.05)); }
  k.add(G.box(0.08, 0.16, 0.03), '#d6d0c6', 'metal', T(doors[doors.length - 1] + 1.05, 1.1, hd + 0.02)); k.add(G.ball(0.026, 8), '#ffb24a', 'glow', T(doors[doors.length - 1] + 1.05, 1.24, hd + 0.05));
  if (label) { const r = F.atlas.rect(720, 100, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, label, w / 2, h / 2, 54, '#e9d2a2'); }); F.atlas.plane(k, r, 4.3, 0.6, T(0, 3.55, hd + 0.03), '#ffffff', 'signGlow'); }
  F.area.wall(-hw, -hd, hw, hd); (F.camRects ||= []).push([-hw, -hd, hw, hd]);
  F.spots.push({ x: 0, z: hd + 1.4, r: 2.8, label: '엘리베이터 타기', hint: '층 단추판이 열려요', act: () => C.enterCar() });
  F.spawn = { ...(F.spawn || {}), elev: { x: 0, z: hd + 1.6, face: 0 } };
}
// 소파 (등받이 · 팔걸이 · 방석이 둥근 상자), 앉을 자리마다 spots. 돌려주는 값 = 앉는 자리 [x, z, 앞 방향]
function sofa(F, C, x, z, ry, { w = 2.2, col = '#3d4a5c', mat = 'velvet', seats = 2, legs = '#b08a52', label = '앉기', camD = 2.6 } = {}) {
  const k = F.kit, M = (lx, lz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
  const put = (g, col2, m, lx, ly, lz) => { const [a, c] = M(lx, lz); k.add(g, col2, m, T(a, ly, c, ry)); };
  put(G.pillow(w, 0.24, 0.9, 0.06), col, mat, 0, 0.18, 0); put(G.pillow(w, 0.55, 0.22, 0.08), col, mat, 0, 0.36, -0.36); for (const s2 of [-1, 1]) put(G.pillow(0.2, 0.42, 0.9, 0.06), col, mat, s2 * (w / 2 - 0.08), 0.18, 0);
  for (let i = 0; i < seats; i++) put(G.pillow(w / seats - 0.12, 0.14, 0.66, 0.06), col, mat, -w / 2 + 0.2 + (i + 0.5) * (w - 0.4) / seats, 0.4, 0.06);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(G.cyl(0.025, 0.02, 0.18, 6), legs, 'metal', a * (w / 2 - 0.1), 0, b * 0.38);
  const c = Math.cos(ry), s = Math.sin(ry), hx = Math.abs(c) * w / 2 + Math.abs(s) * 0.48, hz = Math.abs(s) * w / 2 + Math.abs(c) * 0.48; F.area.wall(x - hx, z - hz, x + hx, z + hz);
  const out = [];
  for (let i = 0; i < seats; i++) { const lx = -w / 2 + 0.2 + (i + 0.5) * (w - 0.4) / seats, [sx, sz] = M(lx, 0.08), [fx, fz] = M(lx, 0.95); out.push([sx, sz, ry]); F.spots.push({ x: fx, z: fz, r: 0.85, label, act: () => C.sit({ x: sx, y: 0.54, z: sz, yaw: ry, label: '일어나기', out: [fx, fz], camD }) }); }
  return out;
}
// 낮은 탁자: 대리석 윗판 · 놋쇠 다리
function lowTable(F, x, z, { w = 1.2, d = 0.7, h = 0.42, top = 'marble', round = false } = {}) {
  const k = F.kit; if (round) { k.add(G.cyl(w / 2, w / 2, 0.04, 28), '#ffffff', top, T(x, h - 0.04, z)); k.add(G.cyl(0.05, 0.05, h - 0.04, 10), '#b08a52', 'metal', T(x, 0, z)); k.add(G.cyl(w * 0.3, w * 0.32, 0.03, 20), '#b08a52', 'metal', T(x, 0, z)); F.area.pole(x, z, w / 2); }
  else { k.add(G.box(w, 0.04, d), '#ffffff', top, T(x, h - 0.04, z)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(G.box(0.03, h - 0.04, 0.03), '#b08a52', 'metal', T(x + a * (w / 2 - 0.06), 0, z + b * (d / 2 - 0.06))); F.area.wall(x - w / 2, z - d / 2, x + w / 2, z + d / 2); }
}
// 러그 (둥근 · 네모)
function rug(F, x, z, w, d, col = '#ffffff', round = false) { const g = round ? new THREE.CircleGeometry(w / 2, 40) : new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.6, uv.getY(i) * (round ? w : d) / 1.6); F.kit.add(g, col, 'carpetR', T(x, 0.008, z)); }
// 꽃 (꽃송이 여럿 · 잎): 꽃병 위
function flowers(F, x, y, z, R = 0.6, n = 40, cols = ['#ffffff', '#f6c9d4', '#e88aa6', '#fff1c9', '#c9b6e8']) { const k = F.kit; for (let i = 0; i < n; i++) { const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * R, h = y + (1 - (r / R) ** 2) * R * 0.7 + hash(i, 3) * 0.12; k.add(G.ball(0.07 + hash(i, 4) * 0.06, 7), cols[i % cols.length], 'std', T(x + Math.cos(a) * r, h, z + Math.sin(a) * r)); if (i % 2) k.add(new THREE.ConeGeometry(0.05, 0.22, 4), '#4f7a3e', 'std', T(x + Math.cos(a) * r * 1.1, h - 0.08, z + Math.sin(a) * r * 1.1, a, 0.9 + hash(i, 5), 0)); } }

// ============================================================
// 79층 하늘 호텔 로비: 두 층 높이 통유리 · 대리석 바닥 · 프론트(뒤에 빛나는 오닉스 벽) · 라운지 소파 · 큰 꽃 장식 · 벨 데스크 · 짐 수레 · 샹들리에
// ============================================================
function hlobby(C) {
  const F = floorBase('hlobby', C), k = F.kit, A = F.atlas, R = 24, H = 8.4;
  towerFloor(F, C, { R, cr: 7, H, floor: 'marble', floorTile: 1.4, ceil: '#e8e1d6', step: 1.7 });
  F.sunK = 1; F.hemiD = 0.85; F.hemiN = 0.18; F.ambN = 0.4; F.floorTint = '#c9b9a2'; F.lampCol = '#ffe2b8';
  core(F, C, { hw: 6, hd: 5.5, H, doors: [-2.6, 0, 2.6], label: '엘리베이터 · 객실 · 뷔페' });
  F.spawn.door = F.spawn.elev;
  // 바닥 테두리: 짙은 대리석 띠 (창가 둘레)
  { const P = rsqOutline(R - 1.2, 6); for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue; k.add(G.box(L + 0.3, 0.01, 0.6), '#ffffff', 'marbleD', T((a[0] + b[0]) / 2, 0.003, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], -(b[0] - a[0])))); } }
  // 천장: 코어 둘레 숨은 빛
  for (const [x, z, w, d] of [[0, -5.8, 12.6, 0.06], [0, 5.8, 12.6, 0.06], [-6.3, 0, 0.06, 11.6], [6.3, 0, 0.06, 11.6]]) k.add(G.box(w, 0.05, d), '#ffdcae', 'glow', T(x, H - 0.06, z));
  // 프론트 데스크 (동쪽): 긴 짙은 대리석 · 참나무 윗판 · 뒤에 빛나는 오닉스 벽 · 직원 둘
  { k.add(G.box(1.0, 1.05, 7), '#ffffff', 'marbleD', T(12.5, 0, 1)); k.add(G.box(1.1, 0.05, 7.1), '#ffffff', 'oak', T(12.5, 1.05, 1)); k.add(G.box(0.02, 0.06, 6.8), '#ffd29a', 'glow', T(11.99, 0.9, 1));
    for (const z2 of [-1.2, 1, 3.2]) k.add(G.box(0.36, 0.26, 0.03), '#16181c', 'gloss', T(12.7, 1.1, z2, -Math.PI / 2, 0.25));
    k.add(G.cyl(0.08, 0.1, 0.05, 14), '#c9a56a', 'metal', T(12.3, 1.08, -2.0)); k.add(G.ball(0.07, 12), '#d4af6e', 'metal', T(12.3, 1.12, -2.0));
    const onyx = canvasTex(512, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f6d29a'); gr.addColorStop(0.5, '#ffe9c4'); gr.addColorStop(1, '#e9b874'); c.fillStyle = gr; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(${150 + hash(i, 1) * 60},${90 + hash(i, 2) * 50},40,${0.1 + hash(i, 3) * 0.25})`; c.lineWidth = 1 + hash(i, 4) * 5; c.beginPath(); let x = hash(i, 5) * w, y = 0; c.moveTo(x, y); while (y < h) { y += 20; x += (hash(i, y) - 0.5) * 40; c.lineTo(x, y); } c.stroke(); } }, false);
    const om = new THREE.MeshBasicMaterial({ map: onyx, color: '#ffffff' }); om.userData.own = true; const op = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.2), om); op.position.set(15.33, 2.3, 1); op.rotation.y = -Math.PI / 2; F.g.add(op); F.onyx = om;
    k.add(G.box(0.3, 4.6, 8.4), '#ffffff', 'wood', T(15.5, 0, 1)); k.add(G.box(0.2, 0.2, 8.4), '#b08a52', 'metal', T(15.3, 4.4, 1));
    const r = A.rect(600, 110, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '하늘 호텔  ·  프론트', w / 2, h / 2, 58, '#3a2410', 'Georgia, serif'); }); A.plane(k, r, 3.6, 0.66, T(15.31, 3.9, 1, -Math.PI / 2), '#ffffff', 'sign');
    F.area.wall(11.9, -2.6, 16, 4.6); }
  const staff = [npc(F, C, 13.6, -0.3, -Math.PI / 2, { top: '#1f2a44', tie: '#c9a56a' }), npc(F, C, 13.6, 2.4, -Math.PI / 2, { top: '#1f2a44', tie: '#c9a56a', fur: '#f2e6d8' })];
  // 라운지 (서쪽 · 남쪽 · 북쪽 창가): 소파 무리 · 낮은 탁자 · 러그 · 스탠드 등
  const seats = [];
  const group = (cx, cz, ry, col) => { rug(F, cx, cz, 5.2, 4.2, '#efe6d8'); seats.push(...sofa(F, C, cx - Math.sin(ry) * 1.4, cz - Math.cos(ry) * 1.4, ry, { w: 2.4, col, seats: 3 })); seats.push(...sofa(F, C, cx + Math.cos(ry) * 1.9, cz - Math.sin(ry) * 1.9, ry - Math.PI / 2, { w: 1.0, col: '#8a5a3a', mat: 'satin', seats: 1 })); seats.push(...sofa(F, C, cx - Math.cos(ry) * 1.9, cz + Math.sin(ry) * 1.9, ry + Math.PI / 2, { w: 1.0, col: '#8a5a3a', mat: 'satin', seats: 1 })); lowTable(F, cx, cz, { w: 1.4, d: 0.8 }); k.add(G.cyl(0.12, 0.14, 0.26, 12), '#2d4a3e', 'gloss', T(cx + 0.3, 0.42, cz)); flowers(F, cx + 0.3, 0.7, cz, 0.16, 10); };
  group(-15.5, -8, Math.PI / 2, '#334257'); group(-16.5, 3, Math.PI / 2, '#5a3c4a'); group(-11, 15.5, 0, '#334257'); group(-11, -16, Math.PI, '#5a3c4a');
  // 스탠드 등 (따뜻한 갓 · 놋쇠 기둥)
  const lampAt = [[-19.2, -11.5], [-19.2, 6.8], [-14.8, 19]]; for (const [x, z] of lampAt) { k.add(G.cyl(0.18, 0.18, 0.03, 16), '#b08a52', 'metal', T(x, 0, z)); k.add(G.cyl(0.02, 0.02, 1.5, 8), '#b08a52', 'metal', T(x, 0, z)); k.add(G.cyl(0.26, 0.2, 0.34, 18, true), '#fff0d6', 'glow', T(x, 1.45, z)); F.area.pole(x, z, 0.25); }
  // 큰 꽃 장식 (남쪽 가운데 둥근 탁자)
  { lowTable(F, 0, 13, { w: 2.2, h: 0.78, round: true, top: 'marbleD' }); k.add(G.cyl(0.32, 0.22, 0.7, 20), '#f2efe9', 'gloss', T(0, 0.78, 13)); flowers(F, 0, 1.45, 13, 0.9, 90); for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; k.add(new THREE.ConeGeometry(0.06, 0.9, 4), '#5c8a46', 'std', T(Math.cos(a) * 0.5, 1.6, 13 + Math.sin(a) * 0.5, a, 0.5, 0)); }
    F.spots.push({ x: 0, z: 11.4, r: 1.6, label: '꽃 향기 맡기', act: () => C.toast('🌷 장미 · 작약 · 백합… 은은한 꽃 향기') }); }
  // 벨 데스크 · 벨보이
  const bell = npc(F, C, 8, 13.2, Math.PI, { top: '#5a1f24', tie: '#c9a56a' });
  { k.add(G.box(1.2, 1.0, 0.6), '#ffffff', 'wood', T(8, 0, 14)); k.add(G.box(1.3, 0.04, 0.7), '#ffffff', 'marble', T(8, 1.0, 14)); k.add(G.cyl(0.09, 0.11, 0.03, 14), '#c9a56a', 'metal', T(8.3, 1.04, 14)); k.add(G.ball(0.08, 12), '#d4af6e', 'metal', T(8.3, 1.07, 14)); F.area.wall(7.3, 13.6, 8.7, 14.4);
    const r = A.rect(300, 80, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '벨 데스크', w / 2, h / 2, 44, '#e9d2a2'); }); A.plane(k, r, 0.9, 0.24, T(8, 0.7, 14.31), '#ffffff', 'signGlow');
    F.spots.push({ x: 8, z: 15.3, r: 1.4, label: '짐 맡기기', act: () => { bell.wave = 1.8; C.SND.clink(); C.toast('🧳 벨보이: 짐은 방으로 올려 드릴게요'); } }); }
  // 짐 수레: 놋쇠 아치 · 붉은 융단 바닥 · 여행 가방
  { const cx = 10.2, cz = 15.2; k.add(G.box(1.2, 0.08, 0.7), '#7a1f28', 'velvet', T(cx, 0.22, cz)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(G.cyl(0.04, 0.04, 0.12, 8), '#222222', 'std', T(cx + a * 0.5, 0.02, cz + b * 0.28)); for (const s2 of [-1, 1]) k.add(G.cyl(0.025, 0.025, 1.8, 8), '#d4af6e', 'metal', T(cx + s2 * 0.55, 0.26, cz)); k.add(new THREE.TorusGeometry(0.55, 0.025, 6, 20, Math.PI), '#d4af6e', 'metal', T(cx, 2.06, cz)); const bar = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8); bar.rotateZ(Math.PI / 2); k.add(bar, '#d4af6e', 'metal', T(cx, 1.7, cz)); k.add(G.pillow(0.5, 0.7, 0.26, 0.04), '#2e4a6b', 'satin', T(cx - 0.22, 0.3, cz)); k.add(G.pillow(0.44, 0.56, 0.24, 0.04), '#b8452f', 'satin', T(cx + 0.28, 0.3, cz)); k.add(G.pillow(0.36, 0.26, 0.5, 0.04), '#d9c39a', 'satin', T(cx + 0.05, 1.0, cz)); F.area.wall(cx - 0.65, cz - 0.4, cx + 0.65, cz + 0.4); }
  // 샹들리에: 라운지 위 고리에 매달린 유리 방울 (인스턴스 하나, 밤에 반짝)
  { const n = 240, geo = new THREE.OctahedronGeometry(0.07, 0), m = new THREE.MeshBasicMaterial({ color: '#fff3dc' }); m.userData.own = true; const im = new THREE.InstancedMesh(geo, m, n); for (let i = 0; i < n; i++) { const ring = i % 4, a = (i / n) * Math.PI * 2 * 4 + ring, r = 1.0 + ring * 0.7, y = H - 1.4 - ring * 0.5 - hash(i, 7) * 1.6; im.setMatrixAt(i, T(-10 + Math.cos(a) * r, y, Math.sin(a) * r, a, 0, 0, new THREE.Vector3(1, 2.2, 1))); } F.g.add(im); F.chand = m;
    for (let r2 = 1; r2 <= 3.2; r2 += 0.7) k.add(new THREE.TorusGeometry(r2, 0.015, 4, 48), '#d4af6e', 'metal', T(-10, H - 1.15, 0, 0, Math.PI / 2)); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.add(G.cyl(0.006, 0.006, 1.15, 4), '#d4af6e', 'metal', T(-10 + Math.cos(a) * 3.1, H - 1.15, Math.sin(a) * 3.1)); } }
  // 앉아 있는 손님 (인스턴스 하나)
  const RD = new Riders(F.g, 16); RD.begin(); seats.forEach(([x, z, ry], i) => { if (hash(i, 9) < 0.4) RD.put(T(x, 0.45, z, ry, 0, 0, 0.62)); }); RD.end(); RD.im.castShadow = true;
  // 프론트에서 체크인
  const checkIn = (key, nm) => { C.S.key2 = key; C.SND.clink(); staff[1].wave = 1.8; C.toast(`🗝️ 카드 키를 받았어요 · ${nm} · 엘리베이터 단추가 켜졌어요`); };
  F.spots.push({ x: 11.2, z: 1, r: 2.2, label: () => (C.S.key2 ? '방 바꾸기' : '체크인'), hint: '방 종류를 골라요', act: () => { staff[0].wave = 1.8; C.choose('🛎️ 하늘 호텔 체크인', '방 종류를 고르면 카드 키를 드려요 · 엘리베이터에서 그 층 단추가 켜져요', [
    { label: '일반 객실 (87층)', sub: '킹 침대 · 창가 소파 · 욕조 · 서쪽 전망', on: () => checkIn('room', '87층 일반 객실') },
    { label: '스위트 (94층)', sub: '거실 · 침실 · 창가 욕조 · 북쪽 한강 전망', on: () => checkIn('suite', '94층 스위트') },
    { label: '펜트하우스 (100 ~ 101층)', sub: '두 층 높이 거실 · 피아노 · 사방 통창', on: () => checkIn('ph', '100층 펜트하우스') },
  ]); } });
  k.build(F.g);
  const lamps = lampAt.map(([x, z]) => { const l = new THREE.PointLight('#ffcf94', 0, 9, 1.8); l.position.set(x, 1.6, z); F.g.add(l); return l; });
  F.tick = (dt, night) => {
    tickStaff(staff[0], dt, C, F, '🛎️ 직원: 어서 오세요, 하늘 호텔입니다'); tickStaff(staff[1], dt, C, F, null); tickStaff(bell, dt, C, F, null);
    for (const l of lamps) l.intensity = 0.6 + night * 3.2; F.chand.color.setScalar(0.75 + night * 0.7); F.onyx.color.setScalar(0.75 + night * 0.35);
  };
  return F;
}

const BUILD = { lobby, car, hlobby };

