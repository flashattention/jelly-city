// 롯데월드타워 층들 (8-26): 층마다 F = { g, area(걸을 곳), spots(E 로 하는 것), spawn, box, tick, ... } 를 돌려준다
//   층 안쪽 좌표: 탑 가운데가 (0, 0), x 동쪽 · z 남쪽 · 바닥 y = 0. 창이 보는 방향 = 실제 동서남북
//   상표 · 가게 이름 대신 일반 이름(하늘 호텔 · 하늘 뷔페 · 전망대)
import * as THREE from 'three';
import { G, T, TKit, Atlas, Area, instanced, canvasTex, txt, clamp, lerp, hash, inRSq, rsqOutline, mats } from './hangang-tower-lib.js';
import { Riders } from './hangang-park.js';

export const FLOORS = {
  lobby: { n: 1, btn: '1', name: '1층 로비', alt: 0, sub: '안내 데스크 · 밖으로 나가는 문' },
  hlobby: { n: 79, btn: '79', name: '79층 하늘 호텔 로비', alt: 320, sub: '프론트 · 체크인' },
  buffet: { n: 81, btn: '81', name: '81층 하늘 뷔페', alt: 328, sub: '창가 자리 · 음식 줄' },
  room: { n: 87, btn: '87', name: '87층 일반 객실', alt: 352, need: 'room' },
  suite: { n: 94, btn: '94', name: '94층 스위트', alt: 381, need: 'suite' },
  ph: { n: 100, btn: '100', name: '100층 펜트하우스', alt: 405, need: 'ph' },
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
  F.viewAt = [10826, 1.7, 1983, 0.4];
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

// ============================================================
// 객실층 공용: 복도(카펫 · 방 번호판 · 벽등) · 객실 가구 · 상호작용(눕기 · 앉기 · 커튼 · 불 · TV · 미니바 · 욕조) · 룸서비스
// ============================================================
// 벽 (두께 있는 상자, a → b, 문 구멍 [t0, t1] 은 비워 둔다) + 막기
function wallSeg(F, ax, az, bx, bz, h, col = '#ffffff', m = 'fabric', holes = [], th = 0.14) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = Math.atan2(-uz, ux); let t = 0; const cuts = [...holes].sort((p, q) => p[0] - q[0]);
  const piece = (s0, s1) => { if (s1 - s0 < 0.02) return; const cx = ax + ux * (s0 + s1) / 2, cz = az + uz * (s0 + s1) / 2; F.kit.add(G.box(s1 - s0, h, th), col, m, T(cx, 0, cz, ry)); const x0 = ax + ux * s0, z0 = az + uz * s0, x1 = ax + ux * s1, z1 = az + uz * s1; F.area.wall(Math.min(x0, x1) - th / 2, Math.min(z0, z1) - th / 2, Math.max(x0, x1) + th / 2, Math.max(z0, z1) + th / 2); };
  for (const [a, b, top = 2.3] of cuts) { piece(t, a); if (top < h) { const cx = ax + ux * (a + b) / 2, cz = az + uz * (a + b) / 2; F.kit.add(G.box(b - a, h - top, th), col, m, T(cx, top, cz, ry)); } t = b; } piece(t, L);
}
// 객실 문 (문틀 · 문짝 · 번호판 · 카드 키 손잡이). 열리면 안쪽으로 돈다
function roomDoor(F, C, x, z, ry, num, { mine = false, key = null } = {}) {
  const k = F.kit, c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const sx of [-0.56, 0.56]) { const [a, b] = P(sx, 0); k.add(G.box(0.08, 2.32, 0.2), '#3a2a20', 'satin', T(a, 0, b, ry)); } { const [a, b] = P(0, 0); k.add(G.box(1.2, 0.08, 0.2), '#3a2a20', 'satin', T(a, 2.3, b, ry)); }
  const r = F.atlas.rect(220, 90, (cx, w, h) => { cx.fillStyle = '#1d1a17'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#c9a56a'; cx.lineWidth = 3; cx.strokeRect(4, 4, w - 8, h - 8); txt(cx, String(num), w / 2, h / 2 + 2, 52, '#e9c98f', 'Georgia, serif'); });
  { const [a, b] = P(0.85, 0.08); F.atlas.plane(k, r, 0.32, 0.13, T(a, 1.55, b, ry), '#ffffff', 'signGlow'); }
  const pivot = new THREE.Group(); { const [a, b] = P(-0.52, 0); pivot.position.set(a, 0, b); pivot.rotation.y = ry; F.g.add(pivot); }
  const dm = new THREE.MeshPhongMaterial({ color: mine ? '#5a3b2a' : '#4d3426', shininess: 40, specular: '#3a3028' }); dm.userData.own = true;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.24, 0.05), dm); leaf.position.set(0.5, 1.12, 0); leaf.castShadow = true; pivot.add(leaf);
  const hm = new THREE.MeshPhongMaterial({ color: '#d4af6e', shininess: 120, specular: '#ffffff' }); hm.userData.own = true; const hd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), hm); hd.position.set(0.88, 1.02, 0.05); pivot.add(hd); const rd = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: '#ff3b30' })); rd.material.userData.own = true; rd.position.set(0.88, 1.2, 0.05); pivot.add(rd);
  const blk = [0, 0, 0, 0, -1, 99]; { const [a, b] = P(0, 0); blk[0] = a - 0.6; blk[1] = b - 0.6; blk[2] = a + 0.6; blk[3] = b + 0.6; if (Math.abs(s) > 0.5) { blk[0] = a - 0.12; blk[2] = a + 0.12; } else { blk[1] = b - 0.12; blk[3] = b + 0.12; } } F.area.block.push(blk); const B0 = blk.slice();
  const D = { open: 0, want: 0, leaf, rd, pivot, set(o) { D.want = o; if (o) { blk[0] = blk[2] = 1e6; } else for (let i = 0; i < 4; i++) blk[i] = B0[i]; }, tick(dt) { D.open += (D.want - D.open) * Math.min(1, dt * 3.5); pivot.rotation.y = ry + D.open * 1.45; rd.material.color.set(D.want ? '#3bd16f' : '#ff3b30'); } };
  if (mine) { const [fx, fz] = P(0, 0.9), [ix, iz] = P(0, -0.9); F.spots.push({ x: fx, z: fz, r: 1.1, label: () => (D.want ? '문 닫기' : '카드 키로 열기'), act: () => { if (key && C.S.key2 !== key) { C.toast('🔒 이 방 카드 키가 없어요 · 79층 프론트에서 체크인해요'); return; } C.SND.click(); D.set(D.want ? 0 : 1); if (D.want) C.toast(`🔓 ${num}호 문이 열렸어요`); } }, { x: ix, z: iz, r: 1.0, label: () => (D.want ? '문 닫기' : '문 열기'), act: () => { C.SND.click(); D.set(D.want ? 0 : 1); } }); }
  else { const [fx, fz] = P(0, 0.9); F.spots.push({ x: fx, z: fz, r: 0.9, label: '노크하기', act: () => { C.SND.knock(); C.toast(`🚪 ${num}호 · 대답이 없어요`); } }); }
  (F.doors ||= []).push(D); return D;
}
// 침대: 받침 · 매트리스 · 이불(접힌 끝) · 베개 넷 · 덧이불 · 높은 머리판 (머리 = -z 쪽, ry 로 돌린다)
function bed(F, C, x, z, ry, { w = 2.0, L = 2.15, head = '#c8b8a4', throwC = '#7a4b5a', H = 0.62 } = {}) {
  const k = F.kit, c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], put = (g, col, m, lx, ly, lz, rx = 0) => { const [a, b] = P(lx, lz); k.add(g, col, m, T(a, ly, b, ry, rx)); };
  put(G.pillow(w + 0.1, 0.32, L + 0.05, 0.05), '#4a3a30', 'satin', 0, 0.06, 0); put(G.pillow(w, 0.26, L, 0.08), '#fbfaf7', 'fabric', 0, 0.36, 0.02);
  put(G.pillow(w + 0.06, 0.08, L * 0.72, 0.04), '#ffffff', 'fabric', 0, 0.6, L * 0.14); put(G.pillow(w + 0.08, 0.03, 0.5, 0.015), '#f1ece4', 'fabric', 0, 0.66, -L * 0.2);
  put(G.pillow(w + 0.1, 0.04, 0.55, 0.02), throwC, 'velvet', 0, 0.67, L * 0.34);
  for (const px of [-w * 0.25, w * 0.25]) { put(G.pillow(w * 0.44, 0.16, 0.42, 0.07), '#ffffff', 'fabric', px, 0.6, -L / 2 + 0.3, -0.35); put(G.pillow(w * 0.4, 0.13, 0.36, 0.06), '#efe7da', 'fabric', px, 0.62, -L / 2 + 0.52, -0.25); }
  put(G.pillow(w + 0.5, 1.25, 0.14, 0.05), head, 'velvet', 0, 0.3, -L / 2 - 0.06); for (let i = -2; i <= 2; i++) put(G.box(0.012, 1.1, 0.02), '#9a8a74', 'satin', i * (w + 0.5) / 5, 0.36, -L / 2 + 0.02);
  const hx = Math.abs(c) * (w / 2 + 0.25) + Math.abs(s) * (L / 2 + 0.1), hz = Math.abs(s) * (w / 2 + 0.25) + Math.abs(c) * (L / 2 + 0.1); F.area.wall(x - hx, z - hz, x + hx, z + hz);
  const [fx, fz] = P(w / 2 + 0.55, 0.2), [sx, sz] = P(w / 2 + 0.45, 0.2); void sx; void sz;
  const night = () => (C.hg.skyU?.night.value || 0) > 0.5;
  F.spots.push({ x: fx, z: fz, r: 1.0, label: () => (night() ? '눕기 · 자기' : '눕기'), act: () => {
    const [bx, bz] = P(0.15, 0.0), hy = ry + Math.PI; C.lie({ x: bx, y: H, z: bz, yaw: hy, camD: 2.8, out: [fx, fz], label: () => (night() ? '불 끄고 자기 (아침까지)' : '일어나기'), act: () => { if (night()) sleep(C, F); else C.stand(); } });
  } });
}
// 자기: 화면이 어두워지고 불이 꺼졌다가 → 아침 7시로 빨리 감기 → 커튼 사이로 아침 햇살
function sleep(C, F) {
  const fade = document.getElementById('tw-fade'); fade?.classList.add('on'); F.lamps = false; C.toast('🌙 잘 자요…');
  setTimeout(() => { C.hg.state.hour = 7.05; if (C.hg.opt.time !== 'auto') C.hg.opt.time = 'auto'; C.shell.view.all(); }, 1300);
  setTimeout(() => { fade?.classList.remove('on'); F.lamps = true; C.toast('☀️ 좋은 아침이에요! 7시'); C.stand(); }, 2600);
}
// 협탁 + 등 (갓 · 놋쇠), 불 켜기 · 끄기 대상
function nightstand(F, x, z, ry) { const k = F.kit; k.add(G.box(0.5, 0.5, 0.42), '#ffffff', 'wood', T(x, 0, z, ry)); k.add(G.box(0.46, 0.02, 0.4), '#c9a56a', 'metal', T(x, 0.5, z, ry)); k.add(G.cyl(0.07, 0.09, 0.32, 12), '#e8e0d2', 'gloss', T(x, 0.52, z)); k.add(G.cyl(0.16, 0.13, 0.22, 18, true), '#fff1d8', 'glow', T(x, 0.84, z)); F.area.wall(x - 0.27, z - 0.24, x + 0.27, z + 0.24); (F.lampPts ||= []).push([x, 0.95, z]); }
// 의자 (나무 다리 · 천 방석 · 등받이)
function chair(F, C, x, z, ry, { col = '#b9a48a', label = '앉기', out = null } = {}) { const k = F.kit, c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c]; const put = (g, col2, m, lx, ly, lz, rx = 0) => { const [a, b] = P(lx, lz); k.add(g, col2, m, T(a, ly, b, ry, rx)); }; put(G.pillow(0.5, 0.1, 0.48, 0.03), col, 'fabric', 0, 0.42, 0); put(G.pillow(0.48, 0.5, 0.07, 0.03), col, 'fabric', 0, 0.5, -0.24, -0.12); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(G.cyl(0.02, 0.016, 0.42, 6), '#4a3426', 'satin', a * 0.2, 0, b * 0.2); F.area.wall(x - 0.27, z - 0.27, x + 0.27, z + 0.27); const [fx, fz] = out || P(0, 0.7); F.spots.push({ x: fx, z: fz, r: 0.75, label, act: () => C.sit({ x, y: 0.52, z, yaw: ry, out: [fx, fz], camD: 2.2 }) }); return { x, z, ry, out: [fx, fz] }; }
// 커튼: 창 앞 두 겹(얇은 망사 · 두꺼운 암막), E 로 열고 닫기. 닫히면 창이 어두워진다
function curtains(F, C, ax, az, bx, bz, h, { col = '#cdbfae', spot } = {}) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, ry = Math.atan2(-uz, ux), nx = uz, nz = -ux;
  const mk = (col2, op, off) => { const g = new THREE.PlaneGeometry(1, h, 40, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * Math.PI * 40) * 0.05); g.computeVertexNormals(); g.translate(0.5, h / 2, 0); const m = new THREE.MeshLambertMaterial({ color: col2, side: THREE.DoubleSide, transparent: op < 1, opacity: op }); m.userData.own = true; const L2 = new THREE.Mesh(g, m), R2 = new THREE.Mesh(g, m); for (const [me, sgn] of [[L2, 1], [R2, -1]]) { me.position.set(sgn > 0 ? ax + nx * off : bx + nx * off, 0, sgn > 0 ? az + nz * off : bz + nz * off); me.rotation.y = ry + (sgn > 0 ? 0 : Math.PI); me.castShadow = op >= 1; F.g.add(me); } return [L2, R2]; };
  const sheer = mk('#f6f2ea', 0.45, 0.18), black = mk(col, 1, 0.3); F.kit.add(G.box(L, 0.05, 0.08), '#2c2622', 'satin', T((ax + bx) / 2 + nx * 0.25, h - 0.05, (az + bz) / 2 + nz * 0.25, ry));
  const CU = { open: 1, want: 1, tick(dt) { CU.open += (CU.want - CU.open) * Math.min(1, dt * 1.8); const wB = Math.max(0.35, (L / 2) * (1 - CU.open) + 0.35 * CU.open), wS = Math.max(0.3, (L / 2) * (1 - CU.open * 0.85)); for (const me of black) me.scale.x = wB; for (const me of sheer) me.scale.x = wS; F.dim = 1 - (1 - CU.open) * 0.92; } };
  F.spots.push({ ...spot, label: () => (CU.want ? '커튼 닫기' : '커튼 열기'), act: () => { CU.want = CU.want ? 0 : 1; C.SND.door(); } });
  (F.curt ||= []).push(CU); return CU;
}
// TV (벽에 걸린 얇은 화면): 켜면 서울 야경 · 날씨 채널이 돈다
function tvSet(F, C, x, y, z, ry, w = 1.4) {
  const cv = canvasTex(320, 180, (c) => { c.fillStyle = '#050608'; c.fillRect(0, 0, 320, 180); }, false), m = new THREE.MeshBasicMaterial({ map: cv, toneMapped: true }); m.userData.own = true;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5625), m); p.position.set(x, y, z); p.rotation.y = ry; F.g.add(p); F.kit.add(G.box(w + 0.04, w * 0.5625 + 0.04, 0.04), '#101114', 'gloss', T(x - Math.sin(ry) * 0.025, y - w * 0.29, z - Math.cos(ry) * 0.025, ry));
  const TV = { on: false, t: 0, ch: 0, draw() { const c = cv.image.getContext('2d'); if (!TV.on) { c.fillStyle = '#050608'; c.fillRect(0, 0, 320, 180); cv.needsUpdate = true; return; } const t = TV.t;
    if (TV.ch === 0) { const g = c.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, '#0b1636'); g.addColorStop(1, '#3a2a5a'); c.fillStyle = g; c.fillRect(0, 0, 320, 180); for (let i = 0; i < 40; i++) { const bx = (i * 37 + t * 8) % 340 - 10, bh = 30 + hash(i, 1) * 90; c.fillStyle = '#141a2e'; c.fillRect(bx, 180 - bh, 14, bh); for (let j = 0; j < bh / 8; j++) if (hash(i, j + Math.floor(t)) > 0.5) { c.fillStyle = '#ffd98a'; c.fillRect(bx + 3, 180 - bh + j * 8 + 2, 3, 3); } } txt(c, '서울 야경 채널', 160, 22, 18, '#ffffff'); }
    else { c.fillStyle = '#1f6fb8'; c.fillRect(0, 0, 320, 180); txt(c, '오늘의 서울 날씨', 160, 30, 22, '#ffffff'); const st = C.hg.state; txt(c, `${st.weather === 'rain' ? '🌧 비' : st.weather === 'snow' ? '❄ 눈' : st.weather === 'cloudy' ? '☁ 흐림' : '☀ 맑음'}  ·  ${String(Math.floor(st.hour)).padStart(2, '0')}:${String(Math.floor((st.hour % 1) * 60)).padStart(2, '0')}`, 160, 100, 30, '#ffffff'); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(0, 150, 320, 30); txt(c, '하늘 호텔 · 객실 안내는 0번', 160 - ((t * 30) % 400) + 200, 165, 14, '#ffffff', undefined, 600); }
    cv.needsUpdate = true; } };
  TV.tick = (dt) => { if (!TV.on) return; TV.t += dt; TV.acc = (TV.acc || 0) - dt; if (TV.acc <= 0) { TV.acc = 0.2; TV.draw(); } };
  return TV;
}
// 미니바: 나무 장 · 유리문 냉장고(안에 불빛 · 병) · 위에 잔 · 커피 머신
function minibar(F, C, x, z, ry) {
  const k = F.kit, c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], put = (g, col, m, lx, ly, lz) => { const [a, b] = P(lx, lz); k.add(g, col, m, T(a, ly, b, ry)); };
  put(G.box(1.1, 0.92, 0.55), '#ffffff', 'wood', 0, 0, 0); put(G.box(1.14, 0.03, 0.58), '#ffffff', 'marbleD', 0, 0.92, 0); put(G.box(0.5, 0.5, 0.02), '#ffffff', 'glass', -0.24, 0.2, 0.28); put(G.box(0.46, 0.46, 0.01), '#fff2d6', 'glow', -0.24, 0.22, 0.2);
  for (let i = 0; i < 6; i++) put(G.cyl(0.03, 0.03, 0.2, 8), ['#2e7d4f', '#d9a441', '#b8452f', '#e8e2d6', '#3a6ea5', '#f2c14e'][i], 'gloss', -0.4 + (i % 3) * 0.08, 0.04 + Math.floor(i / 3) * 0.22, 0.12);
  for (let i = 0; i < 4; i++) put(G.cyl(0.035, 0.028, 0.1, 10), '#e9f2f4', 'glass', 0.1 + i * 0.1, 0.95, -0.1); put(G.box(0.22, 0.3, 0.28), '#1a1b1e', 'gloss', 0.35, 0.95, 0.05); put(G.cyl(0.012, 0.012, 0.05, 6), '#c9a56a', 'metal', 0.35, 1.0, 0.2);
  const hx = Math.abs(c) * 0.58 + Math.abs(s) * 0.3, hz = Math.abs(s) * 0.58 + Math.abs(c) * 0.3; F.area.wall(x - hx, z - hz, x + hx, z + hz);
  const [fx, fz] = P(0, 0.9);
  F.spots.push({ x: fx, z: fz, r: 0.9, label: '미니바', act: () => C.choose('🍹 미니바', '골라서 마셔요', [['탄산수', '#cfe8f0', '🫧'], ['오렌지 주스', '#ffa53a', '🍊'], ['콜라', '#3a1f14', '🥤'], ['따뜻한 녹차', '#a8c27a', '🍵'], ['캡슐 커피', '#5a3a26', '☕']].map(([nm, col, ic]) => ({ label: `${ic} ${nm}`, on: () => drink(F, C, nm, col, ic) }))) });
}
// 마시기: 곰 손에 잔 · 몇 번 기울이고 끝
function drink(F, C, nm, col, ic) {
  const b = C.hg.bear, g = new THREE.Group(), m1 = new THREE.MeshPhongMaterial({ color: '#e9f4f6', transparent: true, opacity: 0.5, shininess: 120 }), m2 = new THREE.MeshLambertMaterial({ color: col }); m1.userData.own = m2.userData.own = true;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.3, 14), m1), liq = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.22, 14), m2); liq.position.y = -0.03; g.add(cup, liq); const hand = b.arms?.[0]; (hand || b.torso).add(g); g.position.set(0, -0.55, 0.12); C.SND.pour(); C.toast(`${ic} ${nm} 한 잔`);
  let t = 0; F.drinkT = (dt) => { t += dt; if (hand) hand.rotation.x = -1.6 - Math.max(0, Math.sin(t * 2.4)) * 0.9; liq.scale.y = Math.max(0.05, 1 - t / 4); if (t > 4.2) { g.removeFromParent(); cup.geometry.dispose(); liq.geometry.dispose(); m1.dispose(); m2.dispose(); F.drinkT = null; C.toast('😋 맛있어요'); } };
}
// 욕조 (타원 · 하얀 광택 · 물), E 로 들어가 앉기
function bathtub(F, C, x, z, ry, { L = 1.75, W = 0.85, label = '욕조에 들어가기' } = {}) {
  const k = F.kit, s = new THREE.Shape(); s.absellipse(0, 0, W / 2, L / 2, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absellipse(0, 0, W / 2 - 0.07, L / 2 - 0.07, 0, Math.PI * 2, true); s.holes.push(h);
  const rim = new THREE.ExtrudeGeometry(s, { depth: 0.58, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 32 }); rim.rotateX(-Math.PI / 2); k.add(rim, '#fbfbf9', 'gloss', T(x, 0, z, ry));
  const inner = new THREE.Shape(); inner.absellipse(0, 0, W / 2 - 0.07, L / 2 - 0.07, 0, Math.PI * 2, false); const bot = new THREE.ShapeGeometry(inner, 24); bot.rotateX(-Math.PI / 2); k.add(bot, '#f2f2f0', 'gloss', T(x, 0.12, z, ry));
  const wg = new THREE.ShapeGeometry(inner, 24); wg.rotateX(-Math.PI / 2); const wm = mats().water.clone(); wm.userData.own = true; const water = new THREE.Mesh(wg, wm); water.position.set(x, 0.42, z); water.rotation.y = ry; F.g.add(water);
  k.add(G.cyl(0.02, 0.02, 0.9, 8), '#d4af6e', 'metal', T(x + Math.sin(ry) * (L / 2 + 0.12), 0, z + Math.cos(ry) * (L / 2 + 0.12))); { const sp = new THREE.CylinderGeometry(0.018, 0.018, 0.25, 8); sp.rotateX(Math.PI / 2); k.add(sp, '#d4af6e', 'metal', T(x + Math.sin(ry) * (L / 2 + 0.02), 0.88, z + Math.cos(ry) * (L / 2 + 0.02), ry)); }
  const c = Math.cos(ry), sn = Math.sin(ry), hx = Math.abs(c) * W / 2 + Math.abs(sn) * L / 2, hz = Math.abs(sn) * W / 2 + Math.abs(c) * L / 2; F.area.wall(x - hx, z - hz, x + hx, z + hz);
  const side = [x - c * (W / 2 + 0.55), z + sn * (W / 2 + 0.55)];
  F.spots.push({ x: side[0], z: side[1], r: 0.95, label, act: () => { C.SND.pour(); C.sit({ kind: 'bath', x: x - sn * 0.25, y: 0.2, z: z - c * 0.25, yaw: ry + Math.PI, camD: 2.2, out: side, label: '욕조에서 나오기' }); C.S.pose.kind = 'bath'; } });
  return water;
}
// 세면대 (긴 대리석 · 그릇 세면기 둘 · 큰 거울 · 거울 뒤 빛)
function vanity(F, C, x, z, ry, w = 1.8) {
  const k = F.kit, c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c], put = (g, col, m, lx, ly, lz) => { const [a, b] = P(lx, lz); k.add(g, col, m, T(a, ly, b, ry)); };
  put(G.box(w, 0.08, 0.6), '#ffffff', 'marble', 0, 0.82, 0); put(G.box(w, 0.6, 0.5), '#ffffff', 'wood', 0, 0.2, -0.04); for (const px of [-w / 4, w / 4]) { put(G.cyl(0.2, 0.16, 0.14, 20), '#fbfbf9', 'gloss', px, 0.9, 0.04); put(G.cyl(0.012, 0.012, 0.28, 6), '#d4af6e', 'metal', px, 0.9, -0.22); }
  put(G.box(w - 0.1, 1.0, 0.02), '#9aa6ad', 'chrome', 0, 1.2, -0.29); put(G.box(w - 0.02, 0.03, 0.03), '#fff2dc', 'glow', 0, 2.24, -0.28); put(G.box(w - 0.02, 0.03, 0.03), '#fff2dc', 'glow', 0, 1.16, -0.28);
  const hx = Math.abs(c) * w / 2 + Math.abs(s) * 0.32, hz = Math.abs(s) * w / 2 + Math.abs(c) * 0.32; F.area.wall(x - hx, z - hz, x + hx, z + hz);
  const [fx, fz] = P(0, 0.85); F.spots.push({ x: fx, z: fz, r: 0.8, label: '손 씻기', act: () => { C.SND.pour(); C.toast('🫧 뽀득뽀득 손을 씻었어요'); } });
}
// 룸서비스: 전화 · 메뉴판 E → 메뉴 고르기 → 몇 초 뒤 노크 → 직원이 카트를 밀고 들어와 탁자에 차리고 인사 · 나간다 → 앉아서 먹기
const RS_MENU = [['불고기 정식', '밥 · 불고기 · 반찬 넷'], ['클럽 샌드위치', '감자튀김 곁들임'], ['해산물 파스타', '새우 · 홍합 · 토마토'], ['과일 · 케이크', '딸기 케이크 · 제철 과일']];
function foodSet(kind) {
  const k = new TKit(), plate = (x, z, r = 0.16) => { k.add(G.cyl(r, r * 0.8, 0.025, 24), '#fbfbf9', 'gloss', T(x, 0, z)); }; const food = new TKit();
  if (kind === 0) { plate(0, 0, 0.2); for (let i = 0; i < 9; i++) food.add(G.box(0.07, 0.02, 0.03), '#7a3a1e', 'satin', T((hash(i, 1) - 0.5) * 0.18, 0.03 + hash(i, 2) * 0.02, (hash(i, 3) - 0.5) * 0.18, hash(i, 4) * 3)); k.add(G.cyl(0.07, 0.05, 0.06, 16), '#2a2d33', 'gloss', T(0.26, 0, -0.1)); food.add(G.ball(0.065, 10), '#ffffff', 'fabric', T(0.26, 0.06, -0.1)); for (let i = 0; i < 4; i++) { const a = i * 1.6; k.add(G.cyl(0.04, 0.03, 0.03, 12), '#efe9df', 'gloss', T(-0.25 + i * 0.12, 0, 0.22)); food.add(G.ball(0.03, 6), ['#c0392b', '#3f8f3a', '#e0b84a', '#8a5a3a'][i], 'std', T(-0.25 + i * 0.12, 0.035, 0.22)); void a; } }
  else if (kind === 1) { plate(0, 0, 0.2); for (const [x, ry] of [[-0.05, 0.3], [0.06, -0.4]]) { const g = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 3); food.add(g, '#e8c48a', 'fabric', T(x, 0.06, 0, ry, Math.PI / 2)); food.add(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 3), '#5aa04a', 'std', T(x, 0.06, 0, ry, Math.PI / 2)); } for (let i = 0; i < 10; i++) food.add(G.box(0.012, 0.012, 0.08), '#f2c14e', 'std', T(0.1 + (hash(i, 1) - 0.5) * 0.08, 0.03, (hash(i, 2) - 0.5) * 0.14, hash(i, 3) * 3)); }
  else if (kind === 2) { plate(0, 0, 0.2); for (let i = 0; i < 8; i++) food.add(new THREE.TorusGeometry(0.03 + i * 0.012, 0.008, 4, 16), '#f2d58a', 'std', T(0, 0.035 + i * 0.002, 0, 0, Math.PI / 2)); for (let i = 0; i < 4; i++) food.add(new THREE.TorusGeometry(0.025, 0.012, 5, 10, Math.PI * 1.3), '#ff8a5a', 'std', T(Math.cos(i * 1.6) * 0.09, 0.05, Math.sin(i * 1.6) * 0.09, i, Math.PI / 2)); food.add(G.ball(0.02, 6), '#c0392b', 'std', T(0.02, 0.06, 0.03)); }
  else { plate(0, 0, 0.18); const w = new THREE.CylinderGeometry(0.1, 0.1, 0.09, 12, 1, false, 0, 1.1); food.add(w, '#fff4e8', 'fabric', T(0, 0.07, 0)); food.add(new THREE.CylinderGeometry(0.101, 0.101, 0.015, 12, 1, false, 0, 1.1), '#e8455a', 'std', T(0, 0.12, 0)); food.add(G.ball(0.025, 8), '#e8303f', 'gloss', T(0.04, 0.14, 0.04)); plate(0.25, 0.05, 0.13); for (let i = 0; i < 9; i++) food.add(G.ball(0.025, 6), ['#e8303f', '#f2c14e', '#7ac74f', '#8e44ad'][i % 4], 'gloss', T(0.25 + (hash(i, 1) - 0.5) * 0.12, 0.04, 0.05 + (hash(i, 2) - 0.5) * 0.12)); }
  k.add(G.cyl(0.004, 0.004, 0.2, 4), '#c9c9c9', 'chrome', T(-0.26, 0.005, 0, 0, Math.PI / 2)); k.add(G.cyl(0.004, 0.004, 0.2, 4), '#c9c9c9', 'chrome', T(-0.3, 0.005, 0, 0, Math.PI / 2));
  const g = new THREE.Group(), fg = new THREE.Group(); k.build(g); food.build(fg); g.add(fg); g.userData.food = fg; return g;
}
function roomService(F, C, { menuAt, table, chair: ch, path }) {
  const RS = { state: 'idle', t: 0, kind: 0, npc: null, set: null, bites: 0 };
  F.spots.push({ ...menuAt, label: () => (RS.state === 'idle' || RS.state === 'done' ? '룸서비스 주문' : RS.state === 'served' ? '메뉴판' : '주문 접수됨'), act: () => { if (RS.state !== 'idle' && RS.state !== 'done') { C.toast('🛎️ 곧 도착해요'); return; } C.choose('🛎️ 룸서비스', '전화로 주문해요 · 잠시 뒤 객실로 가져다 드려요', RS_MENU.map(([nm, sub], i) => ({ label: nm, sub, on: () => { RS.kind = i; RS.state = 'wait'; RS.t = 6; C.SND.click(); C.toast(`📞 ${nm} 주문했어요 · 곧 갖다 드릴게요`); if (RS.set) { RS.set.removeFromParent(); RS.set = null; } } }))); } });
  F.spots.push({ x: table.x + (ch.out[0] - ch.x) * 0, z: table.z, r: 1.4, when: () => RS.state === 'served', label: '앉아서 먹기', act: () => { C.sit({ x: ch.x, y: 0.52, z: ch.z, yaw: ch.ry, out: ch.out, camD: 2.0, label: () => (RS.bites < 5 ? '한 입 먹기' : '다 먹었어요 · 일어나기'), act: () => { if (RS.bites < 5) { RS.bites++; C.SND.clink(); const fg = RS.set?.userData.food; if (fg) { fg.scale.setScalar(Math.max(0.01, 1 - RS.bites / 5)); fg.visible = RS.bites < 5; } if (RS.bites === 5) { C.toast('😋 맛있게 먹었어요! 접시가 비었어요'); RS.state = 'done'; } } else C.stand(); } }); } });
  const door = F.doors?.find((d) => d.mine) || F.doors?.[0];
  RS.tick = (dt) => {
    if (RS.state === 'wait') { RS.t -= dt; if (RS.t <= 0) { C.SND.knock(); C.toast('🚪 똑똑 · 룸서비스입니다'); RS.state = 'knock'; RS.t = 1.2; } return; }
    if (RS.state === 'knock') { RS.t -= dt; if (RS.t > 0) return; door?.set(1); const N = npc(F, C, path[0][0], path[0][1], 0, { top: '#1f2a44', tie: '#c9a56a' }); RS.npc = N; N.i = 1; RS.cart = cartMesh(); F.g.add(RS.cart); RS.state = 'in'; return; }
    const N = RS.npc; if (!N) return;
    const go = (pts, done) => { const tg = pts[N.i]; if (!tg) return done(); const dx = tg[0] - N.x, dz = tg[1] - N.z, d = Math.hypot(dx, dz); if (d < 0.08) { N.i++; return; } const st = Math.min(d, dt * 1.1); N.x += (dx / d) * st; N.z += (dz / d) * st; N.face = Math.atan2(dx, dz); N.b.root.position.set(N.x, 0, N.z); N.b.root.rotation.y = N.face; N.b.update(dt, 1.4, { noCrawl: true }); RS.cart.position.set(N.x + Math.sin(N.face) * 0.75, 0, N.z + Math.cos(N.face) * 0.75); RS.cart.rotation.y = N.face; };
    if (RS.state === 'in') go(path, () => { RS.state = 'serve'; RS.t = 2.2; RS.set = foodSet(RS.kind); RS.set.position.set(table.x, table.y, table.z); RS.set.rotation.y = table.ry || 0; F.g.add(RS.set); RS.bites = 0; C.SND.clink(); C.toast('🍽️ 직원: 맛있게 드세요!'); });
    else if (RS.state === 'serve') { RS.t -= dt; N.b.update(dt, 0, { noCrawl: true }); N.b.torso.rotation.x = Math.max(0, Math.sin((2.2 - RS.t) * 2.8)) * 0.45; if (RS.t <= 0) { RS.state = 'out'; N.i = path.length - 2; N.b.torso.rotation.x = 0; } }
    else if (RS.state === 'out') { const tg = path[N.i]; if (!tg) { N.b.root.removeFromParent(); F.bears.splice(F.bears.indexOf(N), 1); RS.npc = null; RS.cart.removeFromParent(); RS.cart.traverse((o) => o.geometry?.dispose()); door?.set(0); RS.state = 'served'; return; } const dx = tg[0] - N.x, dz = tg[1] - N.z, d = Math.hypot(dx, dz); if (d < 0.08) { N.i--; return; } const st = Math.min(d, dt * 1.1); N.x += (dx / d) * st; N.z += (dz / d) * st; N.face = Math.atan2(dx, dz); N.b.root.position.set(N.x, 0, N.z); N.b.root.rotation.y = N.face; N.b.update(dt, 1.4, { noCrawl: true }); RS.cart.position.set(N.x - Math.sin(N.face) * 0.75, 0, N.z - Math.cos(N.face) * 0.75); RS.cart.rotation.y = N.face; }
  };
  F.rs = RS; return RS;
}
// 룸서비스 카트: 흰 식탁보 · 은빛 덮개 · 꽃 한 송이
function cartMesh() { const g = new THREE.Group(), k = new TKit(); k.add(G.box(0.9, 0.04, 0.6), '#ffffff', 'fabric', T(0, 0.76, 0)); k.add(G.box(0.92, 0.5, 0.62), '#f6f4f0', 'fabric', T(0, 0.26, 0)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(G.cyl(0.04, 0.04, 0.1, 8), '#2a2a2a', 'std', T(a * 0.38, 0, b * 0.24)); const dome = new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); k.add(dome, '#d9dde2', 'chrome', T(-0.15, 0.8, 0)); k.add(G.ball(0.02, 6), '#d9dde2', 'chrome', T(-0.15, 0.97, 0)); k.add(G.cyl(0.02, 0.02, 0.18, 8), '#e9f2f4', 'glass', T(0.25, 0.8, 0.1)); k.add(G.ball(0.04, 8), '#e8455a', 'std', T(0.25, 1.0, 0.1)); k.build(g); return g; }
// 복도: 카펫 · 낮은 천장 · 벽등 · 다른 방 문 (번호판)
function corridor(F, C, rects, h = 2.9) { const k = F.kit; for (const [x0, z0, x1, z1] of rects) { const w = x1 - x0, d = z1 - z0; k.add(G.floor(w, d, 1.6), '#ffffff', 'carpet', T((x0 + x1) / 2, 0.006, (z0 + z1) / 2)); const c = new THREE.PlaneGeometry(w, d); c.rotateX(Math.PI / 2); k.add(c, '#e6ded2', 'ceil', T((x0 + x1) / 2, h, (z0 + z1) / 2)); F.area.add(x0, z0, x1, z1); for (let t = 1.2; t < Math.max(w, d); t += 2.4) { const x = w > d ? x0 + t : (x0 + x1) / 2, z = w > d ? (z0 + z1) / 2 : z0 + t; k.add(G.cyl(0.12, 0.12, 0.02, 14), '#fff1d8', 'glow', T(x, h - 0.02, z)); } } }
function sconce(F, x, y, z, ry) { const k = F.kit; k.add(G.box(0.12, 0.3, 0.06), '#c9a56a', 'metal', T(x, y - 0.15, z, ry)); k.add(G.cyl(0.07, 0.09, 0.2, 12, true), '#fff0d4', 'glow', T(x + Math.sin(ry) * 0.08, y - 0.05, z + Math.cos(ry) * 0.08)); }

// ============================================================
// 87층 일반 객실 (서쪽 창): 복도 → 카드 키 → 현관(옷장 · 미니바) · 유리벽 욕실(욕조 · 세면대) · 침실(킹 침대 · 협탁 · TV · 책상 · 창가 의자 · 소파)
// ============================================================
function room(C) {
  const F = floorBase('room', C), k = F.kit, R = 22.5, H = 3.0;
  towerFloor(F, C, { R, cr: 7, H, floor: 'carpetR', floorTile: 1.6, ceil: '#ece5da', step: 1.5 });
  // 이 층은 복도 · 내 방만 걷는다 (둥근 바닥 전체가 아니라)
  F.area = new Area(); F.near = true; F.sunK = 1; F.hemiD = 0.75; F.hemiN = 0.12; F.ambN = 0.32; F.floorTint = '#b9a68c'; F.lampCol = '#ffdcb0';
  core(F, C, { hw: 9, hd: 9, H, doors: [-2.6, 0, 2.6], label: '87층 · 8701 ~ 8724' });
  corridor(F, C, [[-11.6, -11.6, -9, 11.6], [-11.6, 9, 11.6, 11.6]]);
  // 바깥 벽 (복도 · 다른 방과의 벽): 남쪽 복도 바깥 · 서쪽 복도 바깥(내 방 문 구멍)
  wallSeg(F, -11.6, 11.75, 11.6, 11.75, H, '#ddd2c2', 'fabric');
  wallSeg(F, -11.75, -11.6, -11.75, 11.6, H, '#ddd2c2', 'fabric', [[13.2, 14.25]]);
  wallSeg(F, 11.6, 9, 11.6, 11.6, H, '#ddd2c2', 'fabric'); wallSeg(F, -11.6, -11.75, -9, -11.75, H, '#ddd2c2', 'fabric');
  F.area.wall(-9, -9, 9, 9);
  const mine = roomDoor(F, C, -11.75, 2.1, Math.PI / 2, 8712, { mine: true, key: 'room' }); mine.mine = true;
  for (const [x, z, ry, n] of [[-11.75, -5, Math.PI / 2, 8711], [-11.75, 8.2, Math.PI / 2, 8713], [-6, 11.75, Math.PI, 8714], [0.8, 11.75, Math.PI, 8715], [7.2, 11.75, Math.PI, 8716]]) roomDoor(F, C, x, z, ry, n);
  for (const z of [-8.4, -1.5, 5.4]) sconce(F, -11.67, 2.1, z, Math.PI / 2); for (const x of [-3, 4]) sconce(F, x, 2.1, 11.67, Math.PI);
  // 내 방 벽: 북 · 남 (창까지), 욕실 칸막이
  wallSeg(F, -11.6, -3.5, -22.6, -3.5, H, '#e6dccd', 'fabric'); wallSeg(F, -11.6, 3.5, -22.6, 3.5, H, '#e6dccd', 'fabric');
  wallSeg(F, -11.6, 0.4, -15.2, 0.4, H, '#f1ede6', 'stone', [[1.8, 2.9]]);
  k.add(G.box(0.03, 2.4, 3.9), '#ffffff', 'glass', T(-15.2, 0, -1.55)); k.add(G.box(0.05, 0.05, 3.9), '#2c2622', 'satin', T(-15.2, 2.4, -1.55)); F.area.wall(-15.3, -3.5, -15.1, 0.4);
  // 바닥: 현관 · 욕실은 대리석
  k.add(G.floor(3.6, 7, 1.2), '#ffffff', 'marble', T(-13.4, 0.01, 0));
  F.area.add(-22.1, -3.4, -11.7, 3.4); F.area.add(-12.3, 1.45, -11.2, 2.75);
  // 현관: 옷장 (나무 미닫이 · 놋쇠 손잡이) · 미니바
  { k.add(G.box(2.2, 2.5, 0.6), '#ffffff', 'wood', T(-13.4, 0, 3.15)); for (const x of [-12.85, -13.95]) k.add(G.box(0.02, 0.4, 0.02), '#d4af6e', 'metal', T(x, 1.1, 2.84)); k.add(G.box(0.02, 2.5, 0.62), '#2a1e16', 'satin', T(-13.4, 0, 3.15)); F.area.wall(-14.5, 2.85, -12.3, 3.5); F.spots.push({ x: -13.4, z: 2.2, r: 0.9, label: '옷장 열기', act: () => C.toast('👘 가운 · 슬리퍼 · 다리미가 있어요') }); }
  minibar(F, C, -15.9, 3.15, Math.PI);
  // 욕실: 욕조 (창 쪽) · 세면대 · 비 샤워 유리칸
  F.tubWater = bathtub(F, C, -14.2, -2.4, Math.PI / 2, { L: 1.7 }); vanity(F, C, -12.05, -1.6, -Math.PI / 2, 1.8);
  k.add(G.box(1.0, 2.2, 0.03), '#ffffff', 'glass', T(-12.6, 0, -2.9)); k.add(G.cyl(0.12, 0.12, 0.02, 16), '#c9c9c9', 'chrome', T(-12.2, 2.2, -3.2));
  // 침실: 킹 침대 (머리 = 북쪽 벽) · 협탁 둘 · 등
  bed(F, C, -18.6, -2.3, 0, { head: '#c9b49a', throwC: '#6b3a48' }); nightstand(F, -20.25, -3.1, 0); nightstand(F, -16.95, -3.1, 0);
  // TV 장 · TV (남쪽 벽) · 책상 · 의자 · 전화 · 메뉴판
  k.add(G.box(2.8, 0.5, 0.45), '#ffffff', 'wood', T(-18.3, 0, 3.22)); k.add(G.box(2.82, 0.02, 0.46), '#c9a56a', 'metal', T(-18.3, 0.5, 3.22)); F.area.wall(-19.7, 2.95, -16.9, 3.5);
  F.tv = tvSet(F, C, -18.3, 1.45, 3.42, Math.PI, 1.5);
  F.spots.push({ x: -18.3, z: 1.8, r: 1.1, label: () => (F.tv.on ? (F.tv.ch ? 'TV 끄기' : '채널 바꾸기') : 'TV 켜기'), act: () => { const T2 = F.tv; if (!T2.on) { T2.on = true; T2.ch = 0; } else if (T2.ch === 0) T2.ch = 1; else T2.on = false; T2.draw(); C.SND.click(); } });
  k.add(G.box(1.5, 0.04, 0.6), '#ffffff', 'oak', T(-21.0, 0.74, 3.15)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(G.box(0.04, 0.74, 0.04), '#2a1e16', 'satin', T(-21.0 + a * 0.7, 0, 3.15 + b * 0.26)); F.area.wall(-21.8, 2.85, -20.2, 3.5);
  k.add(G.box(0.2, 0.06, 0.16), '#1a1b1e', 'gloss', T(-20.5, 0.78, 3.1)); k.add(G.box(0.22, 0.02, 0.3), '#e8dcc6', 'fabric', T(-21.3, 0.78, 3.05, 0.2));
  const deskChair = chair(F, C, -21.0, 2.45, 0, { col: '#8a6a52', out: [-21.0, 1.6] });
  // 창가: 안락의자 · 둥근 탁자 · 바닥 스탠드 · 소파(창을 보고) · 낮은 탁자
  chair(F, C, -21.3, -0.6, Math.PI * 0.75, { col: '#b8a07e', out: [-20.4, 0.1] }); lowTable(F, -21.4, 0.8, { w: 0.6, h: 0.55, round: true });
  sofa(F, C, -15.9, 0.0, -Math.PI / 2, { w: 1.6, col: '#7d8a8f', mat: 'velvet', seats: 2, camD: 2.2 }); lowTable(F, -17.3, 0.2, { w: 0.9, d: 0.55, h: 0.4 });
  { const x = -15.9, z = 1.55; k.add(G.cyl(0.14, 0.14, 0.02, 14), '#c9a56a', 'metal', T(x, 0, z)); k.add(G.cyl(0.015, 0.015, 1.5, 6), '#c9a56a', 'metal', T(x, 0, z)); k.add(G.cyl(0.22, 0.18, 0.3, 16, true), '#fff1d8', 'glow', T(x, 1.45, z)); F.area.pole(x, z, 0.18); (F.lampPts ||= []).push([x, 1.5, z]); }
  // 천장 숨은 빛 · 창 커튼
  k.add(G.box(0.05, 0.04, 6.8), '#ffe0b4', 'glow', T(-15.4, H - 0.03, 0));
  F.curtain = curtains(F, C, -22.25, -3.45, -22.25, 3.45, H - 0.05, { col: '#b9a88f', spot: { x: -21.4, z: -2.6, r: 1.0 } });
  // 불 스위치 (현관 벽)
  F.spots.push({ x: -12.4, z: 1.0, r: 0.8, label: () => (F.lamps === false ? '불 켜기' : '불 끄기'), act: () => { F.lamps = F.lamps === false; C.SND.click(); } });
  // 룸서비스 (전화는 책상 · 배달은 창가 둥근 탁자 → 책상 의자)
  roomService(F, C, { menuAt: { x: -20.5, z: 2.1, r: 0.8 }, table: { x: -21.0, y: 0.78, z: 3.0, ry: Math.PI }, chair: deskChair, path: [[-10.3, 2.1], [-12.6, 2.1], [-15.0, 1.8], [-19.2, 2.0], [-20.3, 2.2]] });
  F.box = (x) => (x < -11.7 ? [-22.2, -11.7, -3.4, 3.4] : [-11.5, 11.5, -11.5, 11.5]); F.ceil = () => H;
  F.spawn.elev = { x: 0, z: 10.4, face: -Math.PI / 2 };
  k.build(F.g); roomLights(F);
  F.tick = (dt, night) => roomTick(F, C, dt, night);
  return F;
}
// 방 불빛: 등 자리마다 따뜻한 점 빛 (최대 3), 스위치 · 잠자기로 끄고 켠다
function roomLights(F) { F.pl = (F.lampPts || []).slice(0, 3).map(([x, y, z]) => { const l = new THREE.PointLight('#ffcf98', 0, F.lightR || 7, 1.6); l.position.set(x, y + 0.1, z); F.g.add(l); return l; }); }
function roomTick(F, C, dt, night) {
  const on = F.lamps !== false; for (const l of F.pl) l.intensity += ((on ? (0.8 + night * 2.6) * (F.lightK || 1) : 0) - l.intensity) * Math.min(1, dt * 5);
  mats().glow.color.setScalar(on ? 1 : 0.12); C.shell.win.uniforms.uDim.value = F.dim ?? 1;
  for (const D of F.doors || []) D.tick(dt); for (const c of F.curt || []) c.tick(dt); F.tv?.tick(dt); F.rs?.tick(dt); F.drinkT?.(dt);
  if (F.tubWater) F.tubWater.position.y = 0.42 + Math.sin(C.hg.time * 1.3) * 0.004;
}

// ============================================================
// 94층 스위트 (북쪽 창 · 한강 쪽): 현관 → 거실(소파 · TV · 바 · 4인 식탁) | 칸막이 문 | 침실(킹 침대 · 창가 욕조 · 세면대 · 창가 의자)
// ============================================================
function suite(C) {
  const F = floorBase('suite', C), k = F.kit, R = 21.5, H = 3.2;
  towerFloor(F, C, { R, cr: 7, H, floor: 'oak', floorTile: 1.4, ceil: '#efe9e0', step: 1.5 });
  F.area = new Area(); F.near = true; F.sunK = 1; F.hemiD = 0.8; F.hemiN = 0.12; F.ambN = 0.32; F.floorTint = '#b89a78'; F.lampCol = '#ffdcb0';
  core(F, C, { hw: 9, hd: 9, H, doors: [-2.6, 0, 2.6], label: '94층 · 스위트' });
  corridor(F, C, [[-11.6, -11.6, -9, 11.6], [-11.6, 9, 11.6, 11.6], [-9, -11.6, 11.6, -9]]);
  wallSeg(F, -11.6, 11.75, 11.6, 11.75, H, '#d8cdbd', 'fabric'); wallSeg(F, -11.75, -11.6, -11.75, 11.6, H, '#d8cdbd', 'fabric'); wallSeg(F, 11.6, -9, 11.6, -11.6, H, '#d8cdbd', 'fabric'); wallSeg(F, 11.6, 9, 11.6, 11.6, H, '#d8cdbd', 'fabric');
  wallSeg(F, -11.6, -11.75, 11.6, -11.75, H, '#d8cdbd', 'fabric', [[6.05, 7.2]]);
  const mine = roomDoor(F, C, -5, -11.75, 0, 9401, { mine: true, key: 'suite' }); mine.mine = true;
  for (const [x, z, ry, n] of [[-11.75, -3, Math.PI / 2, 9405], [-11.75, 5.5, Math.PI / 2, 9406], [-5, 11.75, Math.PI, 9407], [5, 11.75, Math.PI, 9408], [10.4, -11.75, 0, 9402]]) roomDoor(F, C, x, z, ry, n);
  for (const x of [-8.5, -1.5, 5]) sconce(F, x, 2.2, -11.67, 0); for (const z of [-6, 1.5, 8]) sconce(F, -11.67, 2.2, z, Math.PI / 2);
  // 스위트 벽: 서 · 동 · 거실 | 침실 칸막이 (문 구멍)
  wallSeg(F, -11, -11.75, -11, -21.6, H, '#e3d8c8', 'fabric'); wallSeg(F, 9, -11.75, 9, -21.6, H, '#e3d8c8', 'fabric');
  wallSeg(F, -1, -11.75, -1, -21.6, H, '#efe9e0', 'stone', [[2.3, 3.5]]);
  F.area.add(-10.9, -21.1, -1.1, -11.85); F.area.add(-0.9, -21.1, 8.9, -11.85); F.area.add(-5.6, -12.3, -4.4, -11.2); F.area.add(-1.3, -15.25, -0.7, -14.05);
  // 현관 대리석 · 거실 러그
  k.add(G.floor(3, 2.2, 1.2), '#ffffff', 'marble', T(-5, 0.01, -12.9)); rug(F, -7.6, -16.6, 5.4, 4, '#e9dfcf');
  // 거실: TV (서쪽 벽) · 긴 소파 (TV 를 본다) · 안락의자 · 낮은 탁자
  k.add(G.box(0.45, 0.5, 2.6), '#ffffff', 'wood', T(-10.7, 0, -16.6)); F.area.wall(-10.95, -17.9, -10.45, -15.3);
  F.tv = tvSet(F, C, -10.93, 1.55, -16.6, Math.PI / 2, 1.8);
  F.spots.push({ x: -8.6, z: -14.6, r: 1.0, label: () => (F.tv.on ? (F.tv.ch ? 'TV 끄기' : '채널 바꾸기') : 'TV 켜기'), act: () => { const T2 = F.tv; if (!T2.on) { T2.on = true; T2.ch = 0; } else if (T2.ch === 0) T2.ch = 1; else T2.on = false; T2.draw(); C.SND.click(); } });
  sofa(F, C, -5.6, -16.6, -Math.PI / 2, { w: 2.8, col: '#3f4d45', seats: 3, camD: 2.6 }); lowTable(F, -7.6, -16.6, { w: 1.3, d: 0.8, h: 0.38, top: 'marbleD' });
  sofa(F, C, -8.4, -19.6, Math.PI * 0.85, { w: 0.95, col: '#a5764f', mat: 'satin', seats: 1, camD: 2.2 });
  { const x = -10.3, z = -20.4; k.add(G.cyl(0.15, 0.15, 0.02, 14), '#c9a56a', 'metal', T(x, 0, z)); k.add(G.cyl(0.016, 0.016, 1.55, 6), '#c9a56a', 'metal', T(x, 0, z)); k.add(G.cyl(0.24, 0.19, 0.32, 16, true), '#fff1d8', 'glow', T(x, 1.5, z)); F.area.pole(x, z, 0.2); (F.lampPts ||= []).push([x, 1.55, z]); }
  // 바 (복도 쪽 벽): 짙은 나무 · 대리석 윗판 · 술병 선반
  k.add(G.box(2.6, 1.0, 0.55), '#ffffff', 'wood', T(-9.3, 0, -12.2)); k.add(G.box(2.7, 0.04, 0.62), '#ffffff', 'marbleD', T(-9.3, 1.0, -12.2)); k.add(G.box(2.6, 0.03, 0.25), '#2a1e16', 'satin', T(-9.3, 1.6, -11.98)); for (let i = 0; i < 9; i++) k.add(G.cyl(0.035, 0.035, 0.28, 8), ['#2e7d4f', '#d9a441', '#7a1f28', '#e8e2d6', '#3a6ea5'][i % 5], 'gloss', T(-10.4 + i * 0.27, 1.63, -11.98)); k.add(G.box(2.6, 0.02, 0.02), '#ffd9a0', 'glow', T(-9.3, 1.58, -11.88)); F.area.wall(-10.65, -12.5, -7.95, -11.85);
  F.spots.push({ x: -9.3, z: -13.2, r: 1.0, label: '바에서 한 잔', act: () => drink(F, C, '레몬 에이드', '#f5e27a', '🍋') });
  // 식탁 (창가, 4인) · 의자 넷 · 꽃
  k.add(G.box(1.6, 0.05, 0.95), '#ffffff', 'wood', T(-4.4, 0.72, -19.6)); k.add(G.box(0.12, 0.72, 0.6), '#2a1e16', 'satin', T(-4.4, 0, -19.6)); k.add(G.box(1.0, 0.03, 0.5), '#2a1e16', 'satin', T(-4.4, 0, -19.6)); F.area.wall(-5.25, -20.1, -3.55, -19.1); k.add(G.cyl(0.07, 0.09, 0.2, 12), '#e8e2d6', 'gloss', T(-4.4, 0.77, -19.6)); flowers(F, -4.4, 0.98, -19.6, 0.14, 12);
  const eat = chair(F, C, -4.4, -18.75, Math.PI, { col: '#c9b9a0', out: [-4.4, -17.9] }); chair(F, C, -4.4, -20.45, 0, { col: '#c9b9a0', out: [-3.2, -20.7] }); chair(F, C, -5.55, -19.6, Math.PI / 2, { col: '#c9b9a0', out: [-6.3, -19.6] }); chair(F, C, -3.25, -19.6, -Math.PI / 2, { col: '#c9b9a0', out: [-2.4, -19.6] });
  F.curtain = curtains(F, C, -10.9, -21.25, -1.1, -21.25, H - 0.05, { col: '#a8b1a6', spot: { x: -2.2, z: -20.4, r: 0.9 } });
  // 침실: 킹 침대 (머리 = 복도 쪽 벽) · 협탁 · 창가 욕조 · 세면대 · 창가 의자
  bed(F, C, 4, -13.25, Math.PI, { head: '#8e9a92', throwC: '#d7b07a', w: 2.1 }); nightstand(F, 2.4, -12.3, Math.PI); nightstand(F, 5.6, -12.3, Math.PI);
  F.tubWater = bathtub(F, C, 6.6, -19.9, Math.PI / 2, { L: 1.8, label: '창가 욕조에 들어가기' }); rug(F, 6.6, -18.4, 2.4, 1.0, '#f4efe6');
  vanity(F, C, 8.6, -16.4, -Math.PI / 2, 1.9);
  sofa(F, C, 1.4, -19.8, Math.PI * 0.8, { w: 0.95, col: '#d6c7b0', mat: 'velvet', seats: 1, camD: 2.2 });
  F.curtain2 = curtains(F, C, -0.9, -21.25, 8.9, -21.25, H - 0.05, { col: '#a8b1a6', spot: { x: 3.5, z: -20.4, r: 0.9 } });
  F.spots.push({ x: -5, z: -13.2, r: 0.8, label: () => (F.lamps === false ? '불 켜기' : '불 끄기'), act: () => { F.lamps = F.lamps === false; C.SND.click(); } });
  k.add(G.box(9.6, 0.04, 0.05), '#ffe0b4', 'glow', T(-6, H - 0.03, -12.0)); k.add(G.box(9.6, 0.04, 0.05), '#ffe0b4', 'glow', T(4, H - 0.03, -12.0));
  roomService(F, C, { menuAt: { x: -4.4, z: -18.2, r: 0.9 }, table: { x: -4.4, y: 0.77, z: -19.35, ry: 0 }, chair: eat, path: [[-5, -10.3], [-5, -12.6], [-5, -15.5], [-3.6, -17.6], [-4.0, -18.1]] });
  F.box = (x, z) => (z < -11.8 ? (x < -1 ? [-10.9, -1.1, -21.1, -11.9] : [-0.9, 8.9, -21.1, -11.9]) : [-11.5, 11.5, -11.5, 11.5]); F.ceil = () => H;
  F.spawn.elev = { x: 0, z: 10.4, face: -Math.PI / 2 };
  k.build(F.g); roomLights(F);
  F.tick = (dt, night) => roomTick(F, C, dt, night);
  return F;
}

// ============================================================
// 100 ~ 101층 펜트하우스: 두 층 높이 거실(사방 통창) · 안쪽 계단 → 위층 침실(창가 욕조) · 그랜드 피아노 · 10인 식탁 · 서재 · 벽난로
//   바닥 높이: 아래층 0, 위층(북쪽 반) 4.2m, 계단은 그 사이 (exp.floor 로 알려 준다)
// ============================================================
function penthouse(C) {
  const F = floorBase('ph', C), k = F.kit, A = F.atlas, R = 20, H = 8.4, UP = 4.2, ZE = -4, SX0 = -7.2, SX1 = -5.8, SZ0 = 4.4;
  towerFloor(F, C, { R, cr: 6.5, H, floor: 'marble', floorTile: 1.8, ceil: '#8a7360', step: 1.4, frame: '#1d1b19', sill: '#3a3028' });
  F.sunK = 1; F.hemiD = 1.0; F.hemiN = 0.2; F.ambN = 0.55; F.lightR = 16; F.lightK = 2.2; F.floorTint = '#6a5440'; F.lampCol = '#ffd7a8'; F.near = false;
  const lower = new Area(), upper = new Area();
  lower.fn((x, z, y, r) => inRSq(x, z, R - 0.45 - r, 6.05 - r)); upper.fn((x, z, y, r) => inRSq(x, z, R - 0.45 - r, 6.05 - r) && z < ZE - r);
  // 아래층 가구는 lower 에, 위층 가구는 높이 UP 로 올린 따로 묶음(Fu)에 짓는다
  F.area = lower; F.lampPts = []; F.curt = []; F.doors = [];
  const ug = new THREE.Group(); ug.position.y = UP; F.g.add(ug); const Fu = Object.create(F); Fu.kit = new TKit(); Fu.area = upper; Fu.g = ug;
  // 코어 (엘리베이터 문은 남쪽: 집 현관으로 바로 열린다)
  { const hw = 4, hd = 3; k.add(G.box(hw * 2, H, hd * 2), '#ffffff', 'wood', T(0, 0, 0)); for (let x = -hw + 1; x < hw; x += 1) k.add(G.box(0.02, H, 0.02), '#b08a52', 'metal', T(x, 0, hd + 0.01));
    for (const x of [-1.4, 1.4]) { k.add(G.box(1.5, 2.7, 0.06), '#c9ab78', 'metal', T(x, 0, hd + 0.03)); k.add(G.box(0.012, 2.7, 0.07), '#6d5a3a', 'metal', T(x, 0, hd + 0.04)); }
    lower.wall(-hw, -hd, hw, hd); upper.wall(-hw, -hd, hw, hd); (F.camRects ||= []).push([-hw, -hd, hw, hd]);
    F.spots.push({ x: 0, z: hd + 1.3, r: 2.2, label: '엘리베이터 타기', act: () => C.enterCar() }); F.spawn = { elev: { x: 0, z: hd + 1.5, face: 0 } }; F.spawn.door = F.spawn.elev;
    // 벽난로 (코어 서쪽 면): 긴 불꽃 · 짙은 돌 테
    k.add(G.box(0.4, 1.2, 3.4), '#ffffff', 'marbleD', T(-hw - 0.2, 0.3, 0)); k.add(G.box(0.05, 0.5, 2.8), '#120d0a', 'std', T(-hw - 0.42, 0.65, 0)); }
  const fireM = new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); fireM.userData.own = true; const flames = [];
  for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6), fireM); f.position.set(-4.44, 0.75, -1.25 + i * 0.19); F.g.add(f); flames.push(f); }
  const fireL = new THREE.PointLight('#ff9a4a', 0, 8, 1.6); fireL.position.set(-5.2, 1.0, 0); F.g.add(fireL);
  F.spots.push({ x: -6.2, z: 0.8, r: 1.4, label: () => (F.fire ? '벽난로 끄기' : '벽난로 켜기'), act: () => { F.fire = !F.fire; C.SND.click(); } }); F.fire = true;
  // 위층 바닥판 · 가장자리 유리 난간 (계단 자리는 비움) · 위층 아래 천장
  { k.add(G.box(2 * R - 1, 0.3, R + ZE + 0.3), '#ffffff', 'wood', T(0, UP - 0.3, (ZE - R) / 2)); k.add(G.box(2 * R - 1, 0.02, R + ZE), '#ffffff', 'oak', T(0, UP, (ZE - R) / 2 - 0.1));
    for (const [x0, x1] of [[-R + 1, SX0], [SX1, R - 1]]) { k.add(G.box(x1 - x0, 1.0, 0.03), '#ffffff', 'glass', T((x0 + x1) / 2, UP, ZE + 0.05)); k.add(G.box(x1 - x0, 0.05, 0.08), '#c9a56a', 'metal', T((x0 + x1) / 2, UP + 1.0, ZE + 0.05)); }
    k.add(G.box(2 * R - 1, 0.02, 0.06), '#ffcf8a', 'glow', T(0, UP - 0.32, ZE + 0.25)); }
  upper.wall(-R, ZE - 0.12, SX0, ZE + 0.2, 3, 99); upper.wall(SX1, ZE - 0.12, R, ZE + 0.2, 3, 99);
  // 계단: 떠 있는 참나무 디딤판 (남 → 북으로 오른다) · 유리 난간
  const sy = (z) => clamp((SZ0 - z) / (SZ0 - ZE), 0, 1) * UP;
  for (let i = 0; i < 18; i++) { const z = SZ0 - (i + 0.5) * (SZ0 - ZE) / 18; k.add(G.box(SX1 - SX0, 0.06, (SZ0 - ZE) / 18 + 0.02), '#ffffff', 'oak', T((SX0 + SX1) / 2, sy(z) - 0.06 + UP / 36, z)); }
  { const L = Math.hypot(SZ0 - ZE, UP), g = new THREE.BoxGeometry(0.03, 1.0, L); g.translate(0, 0.5, 0); const a = Math.atan2(UP, SZ0 - ZE); k.add(g, '#ffffff', 'glass', T(SX1 + 0.02, UP / 2, (SZ0 + ZE) / 2, 0, a)); const rl = new THREE.CylinderGeometry(0.02, 0.02, L, 8); rl.rotateX(Math.PI / 2); k.add(rl, '#c9a56a', 'metal', T(SX1 + 0.02, UP / 2 + 1.0, (SZ0 + ZE) / 2, 0, a)); k.add(G.box(0.2, 0.25, L), '#2a1e16', 'satin', T(SX1 + 0.1, UP / 2 - 0.4, (SZ0 + ZE) / 2, 0, a)); }
  lower.wall(SX0 - 0.1, ZE, SX1 + 0.15, SZ0 - 1.2, -1, 99);
  const onStair = (x, z) => x > SX0 + 0.1 && x < SX1 - 0.1 && z > ZE - 0.3 && z < SZ0 + 0.3;
  const areaObj = { ok(x, z, y, r = 0.26) { if (onStair(x, z) && Math.abs(y - sy(z)) < 0.9) return true; return y > 3 ? upper.ok(x, z, y, r) : lower.ok(x, z, y, r); } };
  F.ground = (x, z, y) => { if (onStair(x, z) && Math.abs(y - sy(z)) < 1.0) return sy(z); if (z < ZE + 0.05 && y > 3) return UP; return 0; };
  F.ceil = (x, z, y) => (z < ZE && y < 3 ? UP - 0.35 : H); F.box = () => [-R + 2.2, R - 2.2, -R + 2.2, R - 2.2];
  // 거실 (남쪽, 두 층 높이): 큰 소파 둘 · 낮은 탁자 · 러그 · 긴 샹들리에
  { const P2 = rsqOutline(R - 1.1, 5.4); for (let i = 0; i < P2.length; i++) { const a2 = P2[i], b2 = P2[(i + 1) % P2.length], L2 = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]); if (L2 < 0.2) continue; k.add(G.box(L2 + 0.3, 0.01, 0.7), '#ffffff', 'marbleD', T((a2[0] + b2[0]) / 2, 0.004, (a2[1] + b2[1]) / 2, Math.atan2(b2[1] - a2[1], -(b2[0] - a2[0])))); } }
  rug(F, -1, 11, 7.5, 5.5, '#d9cdb8');
  for (const s of sofa(F, C, -1, 13.3, Math.PI, { w: 3.4, col: '#2f3d52', seats: 3, camD: 3 })) void s; sofa(F, C, -4.7, 10.5, Math.PI / 2, { w: 2.4, col: '#2f3d52', seats: 2, camD: 3 }); sofa(F, C, 2.8, 9.2, -Math.PI / 2 - 0.3, { w: 1.0, col: '#8a3a36', mat: 'velvet', seats: 1, camD: 2.4 });
  F.lampPts.push([-1, 4.6, 10.6], [10.5, 2.4, 3]);
  lowTable(F, -1, 10.6, { w: 2.0, d: 1.0, h: 0.36, top: 'marble' }); flowers(F, -1, 0.5, 10.6, 0.3, 18, ['#ffffff', '#f3d1dc', '#d9e8c2']);
  { const n = 300, m = new THREE.MeshBasicMaterial({ color: '#fff0d4' }); m.userData.own = true; const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), m, n); for (let i = 0; i < n; i++) { const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * 2.2, y = H - 0.6 - hash(i, 3) * 3.4; im.setMatrixAt(i, T(-1 + Math.cos(a) * r, y, 10.6 + Math.sin(a) * r)); } F.g.add(im); F.chand = m; for (let i = 0; i < 60; i++) { const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * 2.2; k.add(G.cyl(0.004, 0.004, 3.6, 3), '#c9a56a', 'metal', T(-1 + Math.cos(a) * r, H - 3.6, 10.6 + Math.sin(a) * r)); } }
  // 그랜드 피아노 (서남쪽 창가): 곡선 몸통 · 열린 뚜껑 · 건반 · 의자
  { const px = -11, pz = 10, ry = Math.PI * 0.25, sh = new THREE.Shape(); sh.moveTo(-0.75, 0); sh.lineTo(0.75, 0); sh.lineTo(0.75, -0.9); sh.bezierCurveTo(0.75, -1.6, 0.2, -1.4, 0.1, -1.9); sh.quadraticCurveTo(0, -2.3, -0.4, -2.2); sh.quadraticCurveTo(-0.75, -2.1, -0.75, -1.6); sh.lineTo(-0.75, 0);
    const body = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 16 }); body.rotateX(-Math.PI / 2); k.add(body, '#0c0c0e', 'gloss', T(px, 0.62, pz, ry));
    const lid = new THREE.ShapeGeometry(sh, 16); lid.rotateX(-Math.PI / 2); const c = Math.cos(ry), s = Math.sin(ry); k.add(lid, '#0c0c0e', 'gloss', T(px + s * 0, 0.96, pz, ry, 0, 0.6)); k.add(G.cyl(0.012, 0.012, 0.75, 4), '#1a1a1a', 'gloss', T(px + c * 0.6 - s * 1.0, 0.95, pz - s * 0.6 - c * 1.0));
    for (const [lx, lz] of [[-0.6, -0.15], [0.6, -0.15], [0.05, -1.8]]) k.add(G.cyl(0.05, 0.04, 0.62, 8), '#0c0c0e', 'gloss', T(px + c * lx + s * lz, 0, pz - s * lx + c * lz));
    k.add(G.box(1.42, 0.03, 0.16), '#f8f6f0', 'gloss', T(px + s * 0.08, 0.86, pz + c * 0.08, ry)); for (let i = 0; i < 25; i++) { if ([2, 6, 9, 13, 16, 20, 23].includes(i % 28) || i % 7 === 2) continue; k.add(G.box(0.025, 0.025, 0.09), '#111111', 'gloss', T(px + c * (-0.68 + i * 0.056) + s * 0.05, 0.88, pz - s * (-0.68 + i * 0.056) + c * 0.05, ry)); }
    k.add(G.box(1.0, 0.48, 0.38), '#0c0c0e', 'gloss', T(px + s * 0.75, 0, pz + c * 0.75, ry)); k.add(G.pillow(0.96, 0.06, 0.36, 0.02), '#2a1e16', 'velvet', T(px + s * 0.75, 0.48, pz + c * 0.75, ry));
    lower.pole(px - s * 0.9, pz - c * 0.9, 1.15); lower.pole(px + s * 0.75, pz + c * 0.75, 0.45);
    const melody = [523.25, 659.25, 783.99, 659.25, 698.46, 880, 783.99, 659.25, 587.33, 523.25];
    const play = () => { melody.forEach((f, i) => setTimeout(() => C.SND.note(f), i * 330)); C.toast('🎹 ♪ 도 미 솔 미 파 라 솔…'); };
    const seat = [px + s * 0.75, pz + c * 0.75], out = [px + s * 1.5, pz + c * 1.5];
    F.spots.push({ x: out[0], z: out[1], r: 1.0, label: '피아노 치기', act: () => { C.sit({ x: seat[0], y: 0.52, z: seat[1], yaw: ry + Math.PI, camD: 2.8, out, label: '일어나기' }); setTimeout(play, 300); } }); }
  // 10인 식탁 (동쪽 창가): 긴 호두나무 식탁 · 의자 10 (인스턴스) · 촛대 둘
  { const tx = 12, tz = 3; k.add(G.box(1.2, 0.06, 4.4), '#ffffff', 'wood', T(tx, 0.72, tz)); for (const dz of [-1.6, 1.6]) k.add(G.box(0.5, 0.72, 0.12), '#2a1e16', 'satin', T(tx, 0, tz + dz)); lower.wall(tx - 0.6, tz - 2.2, tx + 0.6, tz + 2.2);
    for (const dz of [-1, 1]) { k.add(G.cyl(0.08, 0.1, 0.02, 12), '#d4af6e', 'metal', T(tx, 0.75, tz + dz)); k.add(G.cyl(0.015, 0.015, 0.4, 6), '#d4af6e', 'metal', T(tx, 0.75, tz + dz)); for (const o of [-0.12, 0, 0.12]) { k.add(G.cyl(0.015, 0.015, 0.18, 6), '#fbf3e4', 'gloss', T(tx, 1.15, tz + dz + o)); k.add(G.ball(0.02, 6), '#ffb24a', 'glow', T(tx, 1.36, tz + dz + o)); } }
    const M4 = []; for (let i = 0; i < 4; i++) for (const s of [-1, 1]) M4.push(T(tx + s * 0.85, 0, tz - 1.65 + i * 1.1, s > 0 ? -Math.PI / 2 : Math.PI / 2)); M4.push(T(tx, 0, tz - 2.65, 0), T(tx, 0, tz + 2.65, Math.PI));
    instanced(F.g, (kk) => { kk.add(G.pillow(0.46, 0.1, 0.46, 0.03), '#e7dccb', 'fabric', T(0, 0.42, 0)); kk.add(G.pillow(0.46, 0.62, 0.07, 0.03), '#e7dccb', 'fabric', T(0, 0.5, -0.22, 0, -0.08)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kk.add(G.cyl(0.02, 0.016, 0.42, 6), '#2a1e16', 'satin', T(a * 0.19, 0, b * 0.19)); }, M4);
    for (const M of M4) { const p = new THREE.Vector3().setFromMatrixPosition(M); lower.pole(p.x, p.z, 0.25); }
    const sx = tx - 0.85, sz = tz + 0.55; F.spots.push({ x: sx - 0.7, z: sz, r: 0.9, label: '식탁에 앉기', act: () => C.sit({ x: sx, y: 0.52, z: sz, yaw: Math.PI / 2, out: [sx - 0.75, sz], camD: 2.4 }) }); }
  // 서재 (위층 아래 서쪽): 책장 벽 (책은 한 덩어리) · 책상 · 초록 등 · 지구본 · 가죽 의자
  { const x0 = -18, z0 = -16; for (let sx = 0; sx < 6; sx++) { const bx = -16.5 + sx * 1.6; k.add(G.box(1.5, 3.6, 0.4), '#ffffff', 'wood', T(bx, 0, -15.8)); for (let row = 0; row < 6; row++) { let x = bx - 0.68; while (x < bx + 0.66) { const w = 0.04 + hash(sx * 50 + row * 9 + x * 10, 1) * 0.05, h2 = 0.28 + hash(row, x * 13) * 0.18; k.add(G.box(w, h2, 0.26), ['#7a2a2a', '#2a4a6a', '#3e5a3a', '#c9a56a', '#5a3a2a', '#e6dccd'][Math.floor(hash(x * 31, row) * 6)], 'satin', T(x + w / 2, 0.15 + row * 0.58, -15.68)); x += w + 0.008; } k.add(G.box(1.5, 0.03, 0.4), '#2a1e16', 'satin', T(bx, 0.12 + row * 0.58, -15.8)); } } lower.wall(-17.4, -16.1, -7.8, -15.5); void x0; void z0;
    k.add(G.box(1.8, 0.05, 0.85), '#ffffff', 'wood', T(-12, 0.74, -12.5)); k.add(G.box(1.7, 0.7, 0.75), '#3a2a20', 'satin', T(-12, 0.04, -12.5)); lower.wall(-12.9, -12.95, -11.1, -12.05); k.add(G.cyl(0.08, 0.08, 0.02, 10), '#c9a56a', 'metal', T(-12.6, 0.77, -12.6)); k.add(G.cyl(0.01, 0.01, 0.3, 6), '#c9a56a', 'metal', T(-12.6, 0.77, -12.6)); k.add(G.cyl(0.12, 0.12, 0.08, 14, true), '#2e7d4f', 'gloss', T(-12.6, 1.05, -12.6)); (F.lampPts ||= []).push([-12.6, 1.1, -12.6]);
    k.add(G.cyl(0.1, 0.14, 0.7, 10), '#3a2a20', 'satin', T(-9.5, 0, -12.5)); k.add(G.ball(0.28, 16), '#3a7ab0', 'gloss', T(-9.5, 1.0, -12.5)); k.add(new THREE.TorusGeometry(0.31, 0.012, 4, 24), '#c9a56a', 'metal', T(-9.5, 1.0, -12.5, 0, 0.4)); lower.pole(-9.5, -12.5, 0.32);
    const dc = chair(F, C, -12, -11.8, Math.PI, { col: '#6a3a26', out: [-12, -11.0] }); void dc; sofa(F, C, -15.5, -10.5, Math.PI * 0.75, { w: 1.0, col: '#6a3a26', mat: 'satin', seats: 1, camD: 2.2 });
    F.spots.push({ x: -13.5, z: -14.8, r: 1.2, label: '책 꺼내 읽기', act: () => C.toast('📖 ‘서울, 하늘에서 내려다본 도시’ 몇 장을 넘겼어요') }); }
  // 위층 침실 (북동): 킹 침대 (머리 = 북쪽 창) · 협탁 · 창가 욕조 · 안락의자
  { bed(Fu, C, 7, -12.5, 0, { head: '#3a3530', throwC: '#8a3a36', w: 2.2, H: UP + 0.62 }); const B = F.spots[F.spots.length - 1]; B.y = UP; const act0 = B.act; B.act = () => { act0(); if (C.S.pose) { C.S.pose.outY = UP; } };
    for (const [x, z] of [[5.3, -13.4], [8.7, -13.4]]) { Fu.kit.add(G.box(0.5, 0.5, 0.42), '#ffffff', 'wood', T(x, 0, z)); Fu.kit.add(G.cyl(0.15, 0.12, 0.22, 16, true), '#fff1d8', 'glow', T(x, 0.8, z)); Fu.kit.add(G.cyl(0.06, 0.08, 0.3, 12), '#e8e0d2', 'gloss', T(x, 0.5, z)); upper.wall(x - 0.27, z - 0.24, x + 0.27, z + 0.24); }
    const tub = bathtub(Fu, C, 13.2, -14.8, Math.PI / 4, { L: 1.9, label: '창가 욕조에 들어가기' }); F.tubWater = tub; const T2 = F.spots[F.spots.length - 1]; T2.y = UP; const a2 = T2.act; T2.act = () => { a2(); if (C.S.pose) { C.S.pose.y += UP; C.S.pose.outY = UP; } };
    sofa(Fu, C, 1.5, -15.5, Math.PI * 0.85, { w: 1.0, col: '#c9b8a0', mat: 'velvet', seats: 1, camD: 2.2 }); const SF = F.spots[F.spots.length - 1]; SF.y = UP; const a3 = SF.act; SF.act = () => { a3(); if (C.S.pose) { C.S.pose.y += UP; C.S.pose.outY = UP; } };
    rug(Fu, 7, -10.5, 4.4, 3.2, '#e7ddcd'); }
  k.build(F.g); Fu.kit.build(ug); F.area = areaObj; roomLights(F);
  // 위층 등 자리는 높이를 올린다 (협탁 등)
  for (const l of F.pl) if (l.position.z < ZE && l.position.x > 0) l.position.y += UP;
  F.tick = (dt, night) => { roomTick(F, C, dt, night); F.chand.color.setScalar(0.7 + night * 0.8); fireM.opacity = F.fire ? 0.85 : 0; fireL.intensity = F.fire ? 1.5 + Math.sin(C.hg.time * 13) * 0.3 + night * 1.5 : 0; flames.forEach((f, i) => { const t = C.hg.time * 6 + i * 1.7; f.scale.set(1, 0.7 + Math.sin(t) * 0.25 + Math.sin(t * 2.3) * 0.15, 1); f.visible = !!F.fire; }); };
  return F;
}

// ============================================================
// 81층 하늘 뷔페: 창가 식탁(인스턴스) · 코어 둘레 음식 줄(샐러드 · 과일 · 음료 · 초밥 · 디저트 · 고기 굽는 곳 · 국과 밥) · 요리사 · 손님
//   접시 들기 → 음식 줄 앞에서 E 로 담기(접시에 쌓인다) → 빈자리에 앉아 한 입씩 먹기
// ============================================================
const STATIONS = [
  ['샐러드', '🥗', -8.9, -3.6, -Math.PI / 2], ['과일', '🍓', -8.9, 0.2, -Math.PI / 2], ['음료', '🥤', -8.9, 4, -Math.PI / 2],
  ['초밥', '🍣', -3, -8.9, Math.PI], ['디저트', '🍰', 3, -8.9, Math.PI],
  ['고기 굽는 곳', '🥩', 8.9, -2.4, Math.PI / 2], ['국 · 밥', '🍚', 8.9, 3.4, Math.PI / 2],
];
// 음식 한 점 (역마다 다르게)
function bite(kind, i, K = null, M = null) {
  const k0 = K || new TKit(), k = { add: (g, c, m, M4) => k0.add(g, c, m, M ? M.clone().multiply(M4) : M4) }, r = (n) => hash(i * 7 + n, kind.length);
  if (kind === '샐러드') { for (let j = 0; j < 5; j++) k.add(G.ball(0.035, 6), ['#6fb04a', '#9fd45a', '#e8453a', '#f2c14e', '#4f8a3f'][j], 'std', T((r(j) - 0.5) * 0.08, 0.02, (r(j + 9) - 0.5) * 0.08, 0, 0, 0, new THREE.Vector3(1, 0.6, 1))); }
  else if (kind === '과일') { k.add(G.ball(0.04, 8), ['#e8303f', '#f29a2e', '#8e44ad', '#7ac74f'][i % 4], 'gloss', T(0, 0.035, 0)); k.add(G.ball(0.03, 6), '#f2d14e', 'gloss', T(0.05, 0.03, 0.02)); }
  else if (kind === '음료') { k.add(G.cyl(0.035, 0.03, 0.11, 10), '#e9f4f6', 'glass', T(0, 0, 0)); k.add(G.cyl(0.031, 0.027, 0.08, 10), ['#ffa53a', '#7a3a1e', '#cfe8f0'][i % 3], 'std', T(0, 0.005, 0)); }
  else if (kind === '초밥') { k.add(G.pillow(0.07, 0.035, 0.04, 0.012), '#fbf7ee', 'fabric', T(0, 0, 0)); k.add(G.pillow(0.08, 0.012, 0.045, 0.005), ['#ff8a6a', '#f2f0e8', '#e8453a', '#f2c14e'][i % 4], 'gloss', T(0, 0.035, 0)); }
  else if (kind === '디저트') { k.add(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 10, 1, false, 0, 1.4), '#fff1e2', 'fabric', T(0, 0.022, 0)); k.add(new THREE.CylinderGeometry(0.046, 0.046, 0.012, 10, 1, false, 0, 1.4), ['#e8455a', '#5a3a26', '#7ac74f'][i % 3], 'std', T(0, 0.05, 0)); }
  else if (kind === '고기 굽는 곳') { k.add(G.pillow(0.09, 0.025, 0.06, 0.01), '#7a3a1e', 'satin', T(0, 0, 0, r(1) * 3)); for (let j = 0; j < 3; j++) k.add(G.box(0.07, 0.004, 0.006), '#2a140a', 'std', T(0, 0.026, -0.02 + j * 0.02, r(1) * 3)); }
  else { k.add(G.cyl(0.045, 0.035, 0.04, 12), '#2a2d33', 'gloss', T(0, 0, 0)); k.add(G.ball(0.04, 8), '#ffffff', 'fabric', T(0, 0.035, 0, 0, 0, 0, new THREE.Vector3(1, 0.5, 1))); }
  if (K) return null; const g = new THREE.Group(); k0.build(g); return g;
}
function buffet(C) {
  const F = floorBase('buffet', C), k = F.kit, A = F.atlas, R = 23.5, H = 4.2;
  towerFloor(F, C, { R, cr: 7, H, floor: 'oak', floorTile: 1.3, ceil: '#e9e2d7', step: 1.6 });
  F.sunK = 1; F.hemiD = 0.85; F.hemiN = 0.15; F.ambN = 0.45; F.floorTint = '#b89a78'; F.lampCol = '#ffe0b8';
  core(F, C, { hw: 7, hd: 7, H, doors: [-2.6, 0, 2.6], label: '하늘 뷔페' });
  F.spawn.door = F.spawn.elev;
  // 음식 줄: 코어 둘레 긴 대리석 판 · 유리 덮개 · 따뜻한 등 · 역 이름 (글씨 그림 한 장)
  for (const [x0, z0, x1, z1] of [[-9.6, -7.4, -8.2, 7.4], [-7.4, -9.6, 7.4, -8.2], [8.2, -7.4, 9.6, 7.4]]) { const w = x1 - x0, d = z1 - z0; k.add(G.box(w, 0.9, d), '#ffffff', 'wood', T((x0 + x1) / 2, 0, (z0 + z1) / 2)); k.add(G.box(w + 0.06, 0.04, d + 0.06), '#ffffff', 'marble', T((x0 + x1) / 2, 0.9, (z0 + z1) / 2)); F.area.wall(x0, z0, x1, z1); }
  for (const [nm, ic, x, z, ry] of STATIONS) {
    const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    // 음식 그릇 셋 · 음식 (역마다 한 덩어리로 묶어 크게 담아 둔다)
    for (const o of [-0.9, 0, 0.9]) { const [a, b] = P(o, 0); k.add(G.cyl(0.32, 0.26, 0.08, 20), '#f4f2ee', 'gloss', T(a, 0.94, b)); for (let j = 0; j < 9; j++) bite(nm, j + Math.round(o * 10), k, T(a + (hash(j, o * 9) - 0.5) * 0.35, 0.99 + hash(j, 3) * 0.03, b + (hash(j, o * 7) - 0.5) * 0.35, hash(j, 5) * 6)); }
    // 유리 덮개 · 위 등 · 이름판
    { const [a, b] = P(0, -0.1); k.add(G.box(2.9, 0.02, 0.5), '#ffffff', 'glass', T(a, 1.42, b, ry)); k.add(G.box(2.9, 0.04, 0.06), '#c9a56a', 'metal', T(a, 1.42, b, ry)); for (const o of [-1.4, 1.4]) { const [e, f] = P(o, -0.1); k.add(G.cyl(0.012, 0.012, 0.5, 6), '#c9a56a', 'metal', T(e, 0.92, f)); } for (const o of [-0.9, 0, 0.9]) { const [e, f] = P(o, -0.05); k.add(G.cyl(0.06, 0.08, 0.06, 12, true), '#fff1d6', 'glow', T(e, 1.75, f)); k.add(G.cyl(0.004, 0.004, H - 1.8, 3), '#2a2a2a', 'std', T(e, 1.8, f)); } }
    const r = A.rect(380, 100, (cx, w, h) => { cx.fillStyle = '#1d1a17'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#c9a56a'; cx.lineWidth = 3; cx.strokeRect(4, 4, w - 8, h - 8); txt(cx, `${ic} ${nm}`, w / 2, h / 2 + 2, 46, '#f0dcb4'); });
    { const [a, b] = P(0, -0.38); A.plane(k, r, 1.1, 0.29, T(a, 1.62, b, ry), '#ffffff', 'signGlow'); }
    const [fx, fz] = P(0, 1.0); F.spots.push({ x: fx, z: fz, r: 1.3, label: () => (C.S.plate ? `${nm} 담기` : '접시를 먼저 들어요'), hint: nm, act: () => { const pl = C.S.plate; if (!pl) { C.toast('🍽️ 엘리베이터 옆 접시 더미에서 접시를 먼저 들어요'); return; } if (pl.items.length >= 8) { C.toast('🍽️ 접시가 가득 찼어요 · 자리에 앉아 먹어요'); return; } const g = bite(nm, pl.items.length + Math.floor(Math.random() * 9)), a = pl.items.length * 2.39, rr = 0.03 + Math.sqrt(pl.items.length) * 0.045; g.position.set(Math.cos(a) * rr, 0.02 + Math.floor(pl.items.length / 5) * 0.03, Math.sin(a) * rr); pl.g.add(g); pl.items.push(g); C.SND.clink(); C.toast(`${ic} ${nm} 담았어요 (${pl.items.length})`); } });
  }
  // 고기 굽는 곳: 철판 · 불꽃 · 연기 없이 빛만, 요리사 둘 (모자)
  { k.add(G.box(1.2, 0.04, 0.6), '#2a2a2c', 'metal', T(8.9, 0.94, -2.4)); }
  const fireM = new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }); fireM.userData.own = true; const flames = []; for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), fireM); f.position.set(8.75 + (i % 2) * 0.3, 1.05, -2.8 + i * 0.16); F.g.add(f); flames.push(f); }
  // 요리사는 음식 줄 안쪽(코어와 판 사이)에서 손님 쪽을 본다
  const chefs = [npc(F, C, 7.6, -2.4, Math.PI / 2, { top: '#ffffff', hat: 'chef' }), npc(F, C, -3, -7.6, Math.PI, { top: '#ffffff', hat: 'chef' })];
  // 접시 더미 (엘리베이터 앞 서쪽)
  { k.add(G.box(1.0, 0.9, 0.6), '#ffffff', 'wood', T(-5.6, 0, 9.4)); k.add(G.box(1.04, 0.03, 0.64), '#ffffff', 'marble', T(-5.6, 0.9, 9.4)); for (let i = 0; i < 14; i++) k.add(G.cyl(0.14, 0.11, 0.012, 20), '#fbfbf9', 'gloss', T(-5.8, 0.93 + i * 0.014, 9.4)); for (let i = 0; i < 10; i++) k.add(G.cyl(0.14, 0.11, 0.012, 20), '#fbfbf9', 'gloss', T(-5.4, 0.93 + i * 0.014, 9.4)); F.area.wall(-6.1, 9.1, -5.1, 9.7);
    F.spots.push({ x: -5.6, z: 10.4, r: 1.0, label: () => (C.S.plate ? '접시 내려놓기' : '접시 들기'), act: () => { if (C.S.plate) { dropPlate(C); C.toast('🍽️ 접시를 내려놓았어요'); return; } holdPlate(C); C.toast('🍽️ 접시를 들었어요 · 음식 줄 앞에서 E 로 담아요'); } }); }
  // 창가 식탁: 둥근 네모 둘레에 4인 식탁 (탁자 · 의자 인스턴스), 빈 식탁에서 앉아 먹기
  const P = rsqOutline(R - 3.4, 4.5, 3), tables = []; { let acc = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = acc ? 4.6 - acc : 1.5; while (t < L) { const x = a[0] + (b[0] - a[0]) * t / L, z = a[1] + (b[1] - a[1]) * t / L; if (!(z > 8 && Math.abs(x) < 6)) tables.push([x, z, Math.atan2(b[0] - a[0], b[1] - a[1])]); t += 4.6; } acc = L - (t - 4.6); acc = acc > 0 ? acc : 0; } }
  const tM = [], cM = [], seats = []; tables.forEach(([x, z, ry], i) => { tM.push(T(x, 0, z, ry)); const c = Math.cos(ry), s = Math.sin(ry); for (const [lx, lz, f] of [[-0.5, 0.75, Math.PI], [0.5, 0.75, Math.PI], [-0.5, -0.75, 0], [0.5, -0.75, 0]]) { const sx = x + lx * c + lz * s, sz = z - lx * s + lz * c, yaw = ry + f; cM.push(T(sx, 0, sz, yaw)); seats.push({ x: sx, z: sz, yaw, t: i }); } F.area.wall(x - 1.0, z - 1.0, x + 1.0, z + 1.0); });
  instanced(F.g, (kk) => { kk.add(G.box(1.3, 0.04, 0.9), '#ffffff', 'fabric', T(0, 0.74, 0)); kk.add(G.box(1.34, 0.22, 0.94), '#f6f3ee', 'fabric', T(0, 0.54, 0)); kk.add(G.cyl(0.05, 0.05, 0.54, 8), '#2a2a2a', 'metal', T(0, 0, 0)); kk.add(G.cyl(0.3, 0.32, 0.03, 16), '#2a2a2a', 'metal', T(0, 0, 0)); kk.add(G.cyl(0.03, 0.04, 0.14, 8), '#e9f2f4', 'glass', T(0.1, 0.78, 0)); kk.add(G.ball(0.035, 6), '#e8455a', 'std', T(0.1, 0.95, 0)); }, tM);
  instanced(F.g, (kk) => { kk.add(G.pillow(0.44, 0.09, 0.44, 0.03), '#8a6a52', 'fabric', T(0, 0.42, 0)); kk.add(G.pillow(0.44, 0.48, 0.06, 0.03), '#8a6a52', 'fabric', T(0, 0.5, -0.2, 0, -0.1)); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kk.add(G.cyl(0.018, 0.014, 0.42, 6), '#2a1e16', 'satin', T(a * 0.18, 0, b * 0.18)); }, cM);
  // 손님: 식탁 셋 중 둘에 앉은 곰 (인스턴스), 남은 식탁은 빈자리
  const RD = new Riders(F.g, seats.length); RD.begin(); const free = new Set(); tables.forEach((_, i) => { if (i % 3 === 1) free.add(i); }); seats.forEach((s, i) => { if (!free.has(s.t) && hash(i, 4) < 0.75) RD.put(T(s.x, 0.43, s.z, s.yaw, 0, 0, 0.62)); }); RD.end(); RD.im.castShadow = true;
  for (const ti of free) { const s = seats.find((q) => q.t === ti); const [tx, tz] = tables[ti]; F.spots.push({ x: s.x + Math.sin(s.yaw) * -0.1 + (s.x - tx) * 0.4, z: s.z + (s.z - tz) * 0.4, r: 1.2, label: () => (C.S.plate?.items.length ? '앉아서 먹기' : '빈자리 (접시에 음식을 담아 와요)'), act: () => { const pl = C.S.plate; if (!pl?.items.length) { C.toast('🍽️ 먼저 음식을 담아 와요'); return; } sitEat(C, F, s, tables[ti]); } }); }
  // 걸어 다니는 손님 둘 (접시를 들고 음식 줄 ↔ 자리)
  const walkers = [0, 1].map((i) => { const N = npc(F, C, 0, 0, 0, { top: ['#6a4a8a', '#3a6a5a'][i] }); const pg = new THREE.Group(); const pk = new TKit(); pk.add(G.cyl(0.14, 0.11, 0.012, 16), '#fbfbf9', 'gloss', T(0, 0, 0)); for (let j = 0; j < 4; j++) pk.add(G.ball(0.035, 6), ['#e8303f', '#6fb04a', '#f2c14e', '#7a3a1e'][j], 'std', T(Math.cos(j * 1.6) * 0.05, 0.03, Math.sin(j * 1.6) * 0.05)); pk.build(pg); pg.position.set(0, 1.45, 0.75); N.b.root.add(pg); pg.scale.setScalar(2.4); N.a = i * Math.PI; return N; });
  k.build(F.g);
  const lights = [[0, 3.6, 12], [-12, 3.6, 0], [12, 3.6, 0], [0, 3.6, -12]].slice(0, 3).map(([x, y, z]) => { const l = new THREE.PointLight('#ffd4a0', 0, 14, 1.5); l.position.set(x, y, z); F.g.add(l); return l; });
  F.tick = (dt, night) => {
    for (const l of lights) l.intensity = 0.4 + night * 3; flames.forEach((f, i) => f.scale.y = 0.7 + Math.sin(C.hg.time * 9 + i * 2) * 0.3);
    tickStaff(chefs[1], dt, C, F, '🍣 요리사: 어서 오세요! 오늘 연어가 좋아요'); chefs[0].b.update(dt, 0, { noCrawl: true }); { const a0 = chefs[0].b.arms[0]; if (a0) a0.rotation.x = -1.3 + Math.sin(C.hg.time * 5) * 0.3; }
    for (const N of walkers) { N.a += dt * 0.09; const x = Math.cos(N.a) * 12.2, z = Math.sin(N.a) * 12.2, x2 = Math.cos(N.a + 0.05) * 12.2, z2 = Math.sin(N.a + 0.05) * 12.2; N.b.root.position.set(x, 0, z); N.b.root.rotation.y = Math.atan2(x2 - x, z2 - z); N.b.update(dt, 1.3, { noCrawl: true }); const a0 = N.b.arms[0], a1 = N.b.arms[1]; if (a0) a0.rotation.x = -1.4; if (a1) a1.rotation.x = -1.4; }
    const pl = C.S.plate; if (pl && !C.S.pose && pl.on === 'hand') { pl.g.position.set(0, 1.5, 0.78); }
  };
  F.dispose = () => dropPlate(C);
  return F;
}
// 접시: 곰 앞발 앞에 (곰 크기 0.42 라 곰 쪽 좌표는 2.4배)
function holdPlate(C) { const g = new THREE.Group(), k = new TKit(); k.add(G.cyl(0.15, 0.115, 0.014, 22), '#fbfbf9', 'gloss', T(0, 0, 0)); k.build(g); g.scale.setScalar(2.4); g.position.set(0, 1.5, 0.78); C.hg.bear.root.add(g); C.S.plate = { g, items: [], on: 'hand' }; }
function dropPlate(C) { const pl = C.S.plate; if (!pl) return; pl.g.removeFromParent(); pl.g.traverse((o) => o.geometry?.dispose()); C.S.plate = null; }
// 빈자리에 앉아 접시를 식탁에 놓고 한 입씩
function sitEat(C, F, s, tb) {
  const pl = C.S.plate, [tx, tz] = tb; pl.g.removeFromParent(); F.g.add(pl.g); pl.on = 'table'; pl.g.scale.setScalar(1); pl.g.position.set(s.x + (tx - s.x) * 0.45, 0.77, s.z + (tz - s.z) * 0.45);
  C.sit({ x: s.x, y: 0.52, z: s.z, yaw: s.yaw, camD: 2.2, out: [s.x - Math.sin(s.yaw) * 0.8, s.z - Math.cos(s.yaw) * 0.8], label: () => (C.S.plate?.items.length ? `한 입 먹기 (${C.S.plate.items.length})` : '다 먹었어요 · 일어나기'), act: () => { const p2 = C.S.plate; if (p2?.items.length) { const g = p2.items.pop(); g.removeFromParent(); g.traverse((o) => o.geometry?.dispose()); C.SND.clink(); if (!p2.items.length) C.toast('😋 맛있게 다 먹었어요! 접시가 비었어요'); } else { dropPlate(C); C.stand(); } } });
}

// ============================================================
// 118층 전망대 (실제 478m): 사방 통창 · 유리 바닥(발아래가 그대로) · 창가 방향 안내판(실제 방향 · 거리)
// ============================================================
function obs(C) {
  const F = floorBase('obs', C), k = F.kit, A = F.atlas, R = 16.5, H = 7;
  towerFloor(F, C, { R, cr: 5.5, H, floor: 'marbleD', floorTile: 1.5, ceil: '#22252b', step: 1.3, frame: '#1f2226', sill: '#2a2d33' });
  F.sunK = 1; F.hemiD = 0.7; F.hemiN = 0.06; F.ambN = 0.15; F.floorTint = '#5a5550'; F.lampCol = '#dfe8ff';
  core(F, C, { hw: 4.5, hd: 4.5, H, doors: [-1.4, 1.4], face: 'stone', label: '118층 · 478m' });
  F.spawn.door = F.spawn.elev;
  // 유리 바닥 (서쪽 창가, 4 × 3.6m): 발아래 478m 가 보인다 (아래를 따로 그린 그림) · 강철 격자 · 가장자리 빛
  const GX0 = -16, GX1 = -12, GZ0 = -1.8, GZ1 = 1.8; F.glass = { x0: GX0, x1: GX1, z0: GZ0, z1: GZ1 };
  { const gm = C.shell.glassMat(); const p = new THREE.Mesh(new THREE.PlaneGeometry(GX1 - GX0, GZ1 - GZ0), gm); p.rotation.x = -Math.PI / 2; p.position.set((GX0 + GX1) / 2, 0.012, (GZ0 + GZ1) / 2); F.g.add(p);
    for (let x = GX0; x <= GX1 + 0.01; x += 1) k.add(G.box(0.05, 0.03, GZ1 - GZ0), '#3a3e44', 'metal', T(x, 0, (GZ0 + GZ1) / 2)); for (let z = GZ0; z <= GZ1 + 0.01; z += 1.2) k.add(G.box(GX1 - GX0, 0.03, 0.05), '#3a3e44', 'metal', T((GX0 + GX1) / 2, 0, z));
    k.add(G.box(GX1 - GX0 + 0.2, 0.02, 0.06), '#9fd2ff', 'glow', T((GX0 + GX1) / 2, 0.02, GZ0 - 0.1)); k.add(G.box(GX1 - GX0 + 0.2, 0.02, 0.06), '#9fd2ff', 'glow', T((GX0 + GX1) / 2, 0.02, GZ1 + 0.1));
    const r = A.rect(560, 90, (c, w, h) => { c.clearRect(0, 0, w, h); txt(c, '유리 바닥 · 발아래 478m', w / 2, h / 2, 44, '#bfe3ff'); }); const lab = new THREE.PlaneGeometry(1.8, 0.29); lab.rotateX(-Math.PI / 2); A.plane(k, r, 1.8, 0.29, T(GX1 + 0.4, 0.015, 0, Math.PI / 2, -Math.PI / 2), '#ffffff', 'signGlow'); void lab;
    F.spots.push({ x: (GX0 + GX1) / 2, z: 0, r: 2.0, label: '발아래 내려다보기', act: () => { C.hg.camPitch = 1.15; C.toast('😱 발아래 478m · 아래가 그대로 보여요'); } }); }
  // 방향 안내판: 창턱 위 작은 판 (실제 탑 자리에서 본 방향 · 거리)
  const LMK = [['남산서울타워', 37.5512, 126.9882], ['석촌호수', 37.5090, 127.1010], ['롯데월드', 37.5111, 127.0980], ['잠실대교 · 한강', 37.5300, 127.0930], ['올림픽공원', 37.5202, 127.1215], ['잠실종합운동장', 37.5157, 127.0728], ['코엑스 · 강남', 37.5125, 127.0588], ['북한산', 37.6584, 126.9779], ['청계산', 37.4420, 127.0560]];
  const KX = 111320 * Math.cos((37.53 * Math.PI) / 180), KZ = 110574, TW = [10829, 1931];
  const dirName = (a) => ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
  for (const [nm, lat, lon] of LMK) { const x = (lon - 126.98) * KX - TW[0], z = -(lat - 37.53) * KZ - TW[1], d = Math.hypot(x, z), ux = x / d, uz = z / d; let t = 0; for (let s = 0; s < 40; s += 0.05) if (!inRSq(ux * s, uz * s, R - 0.75, 4.8)) { t = s; break; }
    const px = ux * t, pz = uz * t, ry = Math.atan2(-ux, -uz), bear = Math.atan2(x, -z), r = A.rect(380, 120, (c, w, h) => { c.fillStyle = 'rgba(16,20,28,.9)'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7fb8e8'; c.lineWidth = 2; c.strokeRect(3, 3, w - 6, h - 6); txt(c, nm, w / 2, 44, 40, '#ffffff'); txt(c, `${dirName(bear)} · ${(d / 1000).toFixed(d < 2000 ? 1 : 0)}km  ↑`, w / 2, 92, 30, '#a9d4ff'); });
    k.add(G.box(0.62, 0.22, 0.04), '#1a1d22', 'metal', T(px, 0.12, pz, ry, -0.35)); A.plane(k, r, 0.6, 0.19, T(px - ux * 0.03, 0.235, pz - uz * 0.03, ry, -0.35), '#ffffff', 'signGlow');
    F.spots.push({ x: px - ux * 0.9, z: pz - uz * 0.9, r: 0.9, label: `${nm} 보기`, act: () => { C.hg.camYaw = Math.atan2(ux, uz); C.hg.camPitch = 0.15; C.toast(`🔭 ${nm} · ${dirName(bear)}쪽 ${(d / 1000).toFixed(1)}km`); } }); }
  // 천장 둘레 숨은 빛 · 창가 긴 의자 · 망원경 둘
  { const Q = rsqOutline(R - 1.5, 4.2); for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue; k.add(G.box(L, 0.03, 0.06), '#cfe0ff', 'glow', T((a[0] + b[0]) / 2, H - 0.04, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], -(b[0] - a[0])))); } }
  for (const [x, z, ry] of [[9, 9.6, Math.PI * 0.75], [-9, -9.6, -Math.PI * 0.25]]) sofa(F, C, x, z, ry + Math.PI, { w: 2.2, col: '#2c3442', mat: 'satin', seats: 2, camD: 2.6 });
  for (const [x, z] of [[11.5, -6], [3, -14]]) { k.add(G.cyl(0.18, 0.22, 0.05, 14), '#3a3e44', 'metal', T(x, 0, z)); k.add(G.cyl(0.05, 0.06, 1.1, 10), '#3a3e44', 'metal', T(x, 0, z)); const tb = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 14); tb.rotateX(Math.PI / 2); k.add(tb, '#c7cbd0', 'chrome', T(x, 1.22, z, Math.atan2(x, z))); F.area.pole(x, z, 0.3); F.spots.push({ x: x * 0.88, z: z * 0.88, r: 0.9, label: '망원경 보기', act: () => { C.hg.camYaw = Math.atan2(x, z); C.hg.camPitch = 0.05; C.toast('🔭 멀리까지 또렷하게 보여요'); } }); }
  // 손님 몇 (서서 내려다보는 곰)
  const guests = [[-13.4, 4.5, -1.6], [6, -13.5, Math.PI], [13.8, 2, Math.PI / 2]].map(([x, z, f], i) => npc(F, C, x, z, f, { top: ['#c0392b', '#2e86c1', '#f2c14e'][i] }));
  k.build(F.g);
  F.tick = (dt, night) => { for (const N of guests) { N.b.update(dt, 0, { noCrawl: true }); N.b.head.rotation.x = 0.3; } C.shell.down?.tick(dt, C.shell, F); };
  F.onView = () => C.shell.down?.place(F);
  return F;
}

const BUILD = { lobby, car, hlobby, room, suite, ph: penthouse, buffet, obs };


