// 롯데월드 어드벤처 안 (실내): 실제 건물 외곽선 · 기구 자리 그대로 1:1, 멀리(+150km) 옮긴 공간
//   한가운데 커다란 유리 돔 (낮엔 하늘빛, 밤엔 짙은 남색) · 그 아래 뚫린 곳으로 지하 아이스링크(스케이트 타는 곰들)를 내려다본다
//   둘레 2층 회랑(에스컬레이터로 오르내림) · 벽을 따라 2층짜리 유럽풍 거리(가게 · 발코니) · 1층 퍼레이드 길(꽃수레 행렬)
//   기구(실제 자리): 2층 회전목마 · 실내 롤러코스터(세로 루프) · 천장 레일 열기구 · 바이킹(해적선) · 통나무 보트(물길 낙하) · 실내 모노레일
import * as THREE from 'three';
import { Kit, G, T, rod, tube, canvasTex, Riders, Ride, Coaster, Monorail, R_ADV, R_MONO_IN, inRing, buildPark, rideExp, parkWalk } from './hangang-park.js';
import { registerAttraction } from './hangang-attractions.js';

export const OX = 150000, OZ = 150000;
const RINK = [[10403.5, 2067], [10397, 2072.5], [10393.5, 2080], [10393.5, 2086.5], [10399, 2105.5], [10402.5, 2109], [10407.5, 2111], [10415.5, 2112.5], [10490.5, 2089.5], [10495.5, 2085.5], [10498.5, 2078], [10499, 2073], [10492.5, 2052], [10488, 2048.5], [10482, 2045], [10475.5, 2045], [10403.5, 2067]];
const ROT = 0.29, CS = Math.cos(ROT), SN = Math.sin(ROT);
// 타원 (가운데 c, 반지름 ax · az, 건물 긴 축 방향으로 기울임) 위 점
const ell = (c, ax, az, th) => { const lx = Math.cos(th) * ax, lz = Math.sin(th) * az; return [c[0] + lx * CS + lz * SN, c[1] - lx * SN + lz * CS]; };
const AT = [10446, 2079], AX = 58, AZ = 36; // 아이스링크 위로 뚫린 곳
const DOME = [10438, 2095], DX = 95, DZ = 60, CEIL = 27, DH = 22;
const W = ([x, z]) => [x + OX, z + OZ];
const SHOPS = ['기념품 가게', '츄러스', '팝콘 마차', '카페 테라스', '아이스크림', '모자 가게', '풍선 가게', '레스토랑', '사진관', '사탕 가게', '와플', '인형 가게', '음료', '빵집', '장난감', '안내소'];

class Carousel extends Ride {
  // 2층 회전목마: 아래 · 위 두 층 원판, 가운데 거울 기둥, 오르내리는 말 (인스턴스 하나), 가리비 지붕 · 전구
  constructor(park, o) {
    super(park, { name: '회전목마', cycle: 80, ...o }); const st = park.stat, { cx: x, cz: z } = this, R = 9;
    st.add(G.cyl(R + 1.2, R + 1.4, 0.45, 48), '#c9a86a', 'metal', T(x, 0, z)); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; st.add(G.cyl(0.18, 0.18, 1.0, 8), '#e8d9a8', 'metal', T(x + Math.cos(a) * (R + 1.6), 0, z + Math.sin(a) * (R + 1.6))); }
    const rot = new THREE.Group(); rot.position.set(x, 0, z); park.g.add(rot); this.rot = rot; const k = new Kit();
    for (const [y, rr] of [[0.45, R], [4.4, R - 1.2]]) { k.add(G.cyl(rr, rr, 0.35, 48), '#f6eedd', 'std', T(0, y, 0)); k.add(G.cyl(rr + 0.05, rr + 0.05, 0.3, 48, true), '#c9a86a', 'metal', T(0, y + 0.02, 0)); }
    k.add(G.cyl(2.2, 2.2, 8.6, 16), '#d8c7a0', 'metal', T(0, 0.45, 0)); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; k.add(G.box(0.9, 2.6, 0.06), '#cfe4ef', 'metal', T(Math.cos(a) * 2.22, 1.0, Math.sin(a) * 2.22, Math.PI / 2 - a)); k.add(G.box(0.9, 2.6, 0.06), '#cfe4ef', 'metal', T(Math.cos(a) * 2.22, 4.95, Math.sin(a) * 2.22, Math.PI / 2 - a)); }
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, g = new THREE.ConeGeometry(R + 0.8, 2.8, 2, 1, true, a, Math.PI * 2 / 20); g.translate(0, 10.4, 0); k.add(g, i % 2 ? '#d84a6a' : '#fff4e6', 'std'); const d = new THREE.CylinderGeometry(R + 0.8, R + 0.8, 1.0, 3, 1, true, a, Math.PI * 2 / 20); k.add(d, i % 2 ? '#d84a6a' : '#fff4e6', 'std', T(0, 8.5, 0)); }
    k.add(G.cyl(R + 0.8, R + 0.8, 0.2, 48), '#f3e6c8', 'std', T(0, 8.95, 0)); k.add(G.ball(0.9, 10), '#e6b84a', 'metal', T(0, 12.3, 0));
    for (let i = 0; i < 80; i++) { const a = (i / 80) * Math.PI * 2; k.add(G.ball(0.12, 5), '#fff3c8', 'glow', T(Math.cos(a) * (R + 0.82), 8.05, Math.sin(a) * (R + 0.82))); if (i % 2) k.add(G.ball(0.1, 5), '#fff3c8', 'glow', T(Math.cos(a) * 2.25, 3.9, Math.sin(a) * 2.25)); }
    k.build(rot);
    // 말: 몸 · 목 · 머리 · 다리 · 안장 (금 기둥에 꽂혀 오르내린다)
    const hk = new Kit(); hk.add(G.ball(0.5, 10), '#ffffff', 'std', T(0, 0, 0, 0, 0, 0, new THREE.Vector3(0.55, 0.55, 1.15))); hk.add(G.box(0.3, 0.75, 0.35), '#ffffff', 'std', T(0, 0.2, 0.5, 0, -0.5)); hk.add(G.box(0.28, 0.3, 0.55), '#ffffff', 'std', T(0, 0.75, 0.75)); for (const [sx, sz] of [[-0.18, 0.4], [0.18, 0.4], [-0.18, -0.4], [0.18, -0.4]]) hk.add(G.box(0.1, 0.6, 0.1), '#ffffff', 'std', T(sx, -0.7, sz, 0, sz > 0 ? -0.5 : 0.4)); hk.add(G.box(0.62, 0.12, 0.5), '#c23b5a', 'std', T(0, 0.48, -0.05)); hk.add(G.cyl(0.05, 0.05, 3.4, 6), '#e6c25a', 'metal', T(0, -1.4, 0.05));
    const hm = new THREE.InstancedMesh(mergeList([...hk.b.std, ...hk.b.metal]), new THREE.MeshLambertMaterial({ vertexColors: true }), 40); hm.userData.noDrape = true; hm.frustumCulled = false; rot.add(hm); this.horses = hm; this.hd = [];
    const HC = ['#ffffff', '#f2e3c6', '#e9d0d8', '#d8e4f0', '#3a3030'];
    for (let i = 0; i < 40; i++) { const up = i >= 24, n = up ? 16 : 24, j = up ? i - 24 : i, ring = up ? 1 : (j % 2), r = up ? R - 2.6 : (ring ? R - 3.6 : R - 1.4), a = (j / n) * Math.PI * 2 + (ring ? Math.PI / n : 0), y0 = up ? 4.75 + 1.25 : 0.8 + 1.25; hm.setColorAt(i, new THREE.Color(HC[i % HC.length])); this.hd.push({ a, r, y0, ph: i * 1.7 }); this.seat(rot, Math.cos(a) * r, y0 + 0.5, Math.sin(a) * r, -a); }
    park.addCircle(x, z, R + 1.3, 999); this.spec = [x + 22, 7, z + 16]; this.fill = 0.55; this.my = 0;
  }
  // 0~10 타기 · 10~70 돈다 (분당 4바퀴쯤) · 나머지 멈춤
  pose(t, dt) { const u = t < 10 ? 0 : t < 14 ? (t - 10) / 4 : t < 66 ? 1 : t < 72 ? 1 - (t - 66) / 6 : 0; this.ang = (this.ang || 0) + u * 0.42 * dt; this.rot.rotation.y = this.ang; this.bob = (this.bob || 0) + u * dt * 2.4;
    const o = this._o ||= new THREE.Object3D(); this.hd.forEach((h, i) => { const y = h.y0 + Math.sin(this.bob + h.ph) * 0.35 * Math.min(1, u * 2); o.position.set(Math.cos(h.a) * h.r, y, Math.sin(h.a) * h.r); o.rotation.set(0, -h.a + Math.PI, 0); o.updateMatrix(); this.horses.setMatrixAt(i, o.matrix); this.seats[i].position.y = y + 0.5; }); this.horses.instanceMatrix.needsUpdate = true; }
}
function mergeList(list) { const g = new THREE.BufferGeometry(); const n = list.reduce((a, q) => a + q.attributes.position.count, 0), P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0; for (const q of list) { P.set(q.attributes.position.array, o * 3); N.set(q.attributes.normal.array, o * 3); C.set(q.attributes.color.array, o * 3); o += q.attributes.position.count; } g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g; }

class Viking extends Ride {
  // 바이킹 (해적선): A자 두 쌍 위 축에 매달린 배가 75°까지 흔들린다 (배 끝에 앉은 곰들)
  constructor(park, o) {
    super(park, { name: '바이킹', cycle: 75, ...o }); const st = park.stat, { cx: x, cz: z, ax } = this, PY = 14, ux = Math.cos(ax), uz = Math.sin(ax), wx = -uz, wz = ux;
    for (const s of [-1, 1]) for (const f of [-1, 1]) rod(st, new THREE.Vector3(x + wx * s * 4.2 + ux * f * 8, 0, z + wz * s * 4.2 + uz * f * 8), new THREE.Vector3(x + wx * s * 3.2, PY + 0.5, z + wz * s * 3.2), 0.4, '#5a3a22', 'std', 8);
    st.add(G.box(0.9, 0.9, 7.4), '#3a2a1a', 'metal', T(x, PY - 0.4, z, Math.atan2(wx, wz))); st.add(G.cyl(12, 12, 0.3, 40), '#b9ad98', 'std', T(x, 0, z));
    const piv = new THREE.Group(); piv.position.set(x, PY, z); piv.rotation.y = Math.atan2(wx, wz); park.g.add(piv); const arm = new THREE.Group(); piv.add(arm); this.arm = arm;
    // 배 (긴 축 = 피벗 축에 수직 → 로컬 x): 선체 · 갑판 · 돛대 · 줄무늬 돛 · 뱃머리 장식
    const k = new Kit(), L = 15, dy = -10.5; for (const s of [-1, 1]) rod(k, new THREE.Vector3(0, 0, s * 2.6), new THREE.Vector3(0, dy + 1.5, s * 1.6), 0.25, '#c9a86a', 'metal', 8);
    const hull = new THREE.CylinderGeometry(1, 1, L, 20, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateX(Math.PI); hull.scale(1, 2.0, 1.9); k.add(hull, '#7a3a22', 'std', T(0, dy + 1.2, 0)); k.add(G.box(L * 0.98, 0.25, 3.6), '#c9a46a', 'std', T(0, dy + 1.1, 0)); k.add(G.box(L, 0.35, 0.2), '#e6b84a', 'metal', T(0, dy + 1.3, 1.85)); k.add(G.box(L, 0.35, 0.2), '#e6b84a', 'metal', T(0, dy + 1.3, -1.85));
    for (const s of [-1, 1]) { k.add(G.box(1.6, 2.4, 3.4), '#5a2a1a', 'std', T(s * (L / 2 - 0.4), dy + 1.0, 0)); k.add(G.cone(0.5, 2.2, 8), '#e6b84a', 'metal', T(s * (L / 2 + 0.6), dy + 2.4, 0, 0, 0, -s * 1.2)); }
    k.add(G.cyl(0.18, 0.18, 7, 8), '#5a3a22', 'std', T(0, dy + 1.2, 0)); for (let i = 0; i < 5; i++) k.add(G.box(5.6 - i * 0.5, 0.95, 0.06), i % 2 ? '#fff4e6' : '#c23b3b', 'std', T(0, dy + 3.2 + i * 0.95, 0));
    for (let i = 0; i < 30; i++) k.add(G.ball(0.09, 5), '#fff1cf', 'glow', T(-L / 2 + i * L / 29, dy + 1.55, 1.95));
    k.build(arm);
    for (let r = 0; r < 6; r++) for (const s of [-1, 1]) for (const c of [-1.1, -0.35, 0.35, 1.1]) { const lx = s * (1.8 + r * 1.0); this.seat(arm, lx, dy + 1.25 + Math.abs(lx) * 0.08, c, s > 0 ? Math.PI / 2 : -Math.PI / 2); }
    park.addCircle(x, z, 1.5, 999); park.addCircle(x + ux * 8, z + uz * 8, 1, 999); park.addCircle(x - ux * 8, z - uz * 8, 1, 999); this.spec = [x + wx * 26, 9, z + wz * 26]; this.fill = 0.7;
  }
  pose(t) { let A = 0; if (t > 8 && t < 66) { const u = t < 38 ? (t - 8) / 30 : t < 48 ? 1 : 1 - (t - 48) / 18; A = Math.max(0, u) * 1.3; } this.arm.rotation.z = A * Math.sin((t - 8) * 2 * Math.PI / 6.4); }
}

class Balloons extends Ride {
  // 천장 레일 열기구: 돔 둘레 높은 레일에 매달린 열기구 바구니 12개가 천천히 돈다
  constructor(park, o) {
    super(park, { name: '열기구', cycle: 110, ...o }); const st = park.stat, Y = 24.5, pts = [];
    for (let i = 0; i <= 96; i++) { const [x, z] = W(ell(DOME, DX * 0.88, DZ * 0.86, (i / 96) * Math.PI * 2)); pts.push(new THREE.Vector3(x, Y, z)); }
    tube(st, pts, 0.22, '#e8e4dc', 'metal', 6); for (let i = 0; i < 96; i += 6) rod(st, pts[i], pts[i].clone().setY(CEIL + 2), 0.08, '#c9c4bb', 'metal', 4);
    this.pts = pts; let L = 0; this.cum = [0]; for (let i = 1; i < pts.length; i++) { L += pts[i].distanceTo(pts[i - 1]); this.cum.push(L); } this.L = L; this.N = 12; this.v0 = L / 100;
    const BC = [['#ff5a7a', '#ffd23f'], ['#3fa7ff', '#ffffff'], ['#7c5cff', '#ffd23f'], ['#2ec4b6', '#ff9a3d']];
    this.cars = []; for (let c = 0; c < this.N; c++) { const g = new THREE.Group(); park.g.add(g); const k = new Kit(), [a, b] = BC[c % BC.length]; for (let i = 0; i < 12; i++) { const ag = new THREE.SphereGeometry(2.2, 12, 10, (i / 12) * Math.PI * 2, Math.PI * 2 / 12); k.add(ag, i % 2 ? a : b, 'std', T(0, -2.6, 0, 0, 0, 0, new THREE.Vector3(1, 1.2, 1))); } k.add(G.cyl(0.9, 0.6, 0.8, 10), '#f3e6c8', 'std', T(0, -5.6, 0)); k.add(G.cyl(0.8, 0.8, 1.1, 12), '#8a5a34', 'std', T(0, -7.4, 0)); for (const [sx, sz] of [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]]) rod(k, new THREE.Vector3(sx * 0.9, -5.4, sz * 0.9), new THREE.Vector3(sx, -6.3, sz), 0.03, '#3a2a1a', 'std', 4); rod(k, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.6, 0), 0.06, '#9aa3ad', 'metal', 4); k.build(g); this.seat(g, 0.3, -7.0, 0, 0); this.seat(g, -0.3, -7.0, 0, Math.PI); this.cars.push(g); }
    this.my = 0; this.fill = 0.6; this.spec = [W(DOME)[0], 12, W(DOME)[1]]; this.cycle = Math.ceil(L / this.v0) + 6;
  }
  at(s, g) { const L = this.L; s = ((s % L) + L) % L; let i = 1; while (i < this.cum.length - 1 && this.cum[i] < s) i++; const a = this.pts[i - 1], b = this.pts[i], u = (s - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1); g.position.lerpVectors(a, b, u); g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2; }
  pose(t) { const s = Math.max(0, t - 3) * this.v0; this.cars.forEach((g, i) => { this.at(s + (i * this.L) / this.N, g); g.rotation.z = Math.sin(t * 0.7 + i) * 0.04; }); }
}

// 스케이트 타는 곰 · 퍼레이드 곰 (타는 것 아님, 자리만 움직인다)
class Movers extends Ride {
  constructor(park, o) { super(park, { cycle: 1e9, fill: 1, ...o }); this.board = null; }
}

export function buildAdventure(hg, park, makeBear) {
  const g = new THREE.Group(); g.visible = false; g.userData.noDrape = true; hg.scene.add(g);
  const H = hg.host || hg, ring = R_ADV.map(W), xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
  const ctx = { hg, g, stat: new Kit(), ground: () => 0, bulbs: [],
    addCircle: (x, z, r, h) => { H.addCircle(x, z, r, h); },
    addFoot: (rg, h, extra = {}) => { const a = rg.map((p) => p[0]), b = rg.map((p) => p[1]); H.addFoot({ ring: rg, h, x0: Math.min(...a), x1: Math.max(...a), z0: Math.min(...b), z1: Math.max(...b), name: '', type: 'stone', key: 'park', noClimb: true, ...extra }); },
    addDeck: (ax, az, cx, cz, hw, ya, yc) => { const d = { ax, az, cx, cz, hw, ya, yc, key: 'park' }, si = H.decks.push(d) - 1; for (let gx = Math.floor((Math.min(ax, cx) - hw) / 40); gx <= Math.floor((Math.max(ax, cx) + hw) / 40); gx++) for (let gz = Math.floor((Math.min(az, cz) - hw) / 40); gz <= Math.floor((Math.max(az, cz) + hw) / 40); gz++) { const k = `${gx},${gz}`; if (!H.deckGrid.has(k)) H.deckGrid.set(k, []); H.deckGrid.get(k).push(si); } },
    bulb: (x, y, z, col, r = 0.09) => ctx.bulbs.push([x, y, z, col, r]),
  };
  H.decks ||= []; H.deckGrid ||= new Map();
  const st = ctx.stat, sh = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  // 1) 바닥: 대리석 무늬 (가운데 뚫린 곳 빼고)
  { const hole = new THREE.Path(); for (let i = 0; i <= 64; i++) { const [x, z] = W(ell(AT, AX, AZ, -(i / 64) * Math.PI * 2)); if (i) hole.lineTo(x, -z); else hole.moveTo(x, -z); } const s2 = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))); s2.holes.push(hole);
    const fg = new THREE.ShapeGeometry(s2, 32); fg.rotateX(-Math.PI / 2); const p = fg.attributes.position, uv = fg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 6, p.getZ(i) / 6);
    const mt = canvasTex(256, 256, (c) => { c.fillStyle = '#efe6d6'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#e3d4bd' : '#f3ebde'; c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } c.fillStyle = '#c98f6a'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.save(); c.translate(i * 64 + 32, j * 64 + 32); c.rotate(Math.PI / 4); c.fillRect(-5, -5, 10, 10); c.restore(); } }); mt.wrapS = mt.wrapT = THREE.RepeatWrapping;
    const fm = new THREE.Mesh(fg, new THREE.MeshPhongMaterial({ map: mt, shininess: 60, specular: '#555' })); fm.receiveShadow = true; g.add(fm); }
  // 2) 벽 (안쪽을 본다) · 천장 (돔 자리 뚫림) · 돔 (하늘 + 철골 격자 그림)
  { const P = [], C = [], c = new THREE.Color(); for (let i = 0; i < ring.length - 1; i++) { const [ax, az] = ring[i], [bx, bz] = ring[i + 1]; for (const [x, y, z] of [[ax, 0, az], [bx, 0, bz], [bx, CEIL, bz], [ax, 0, az], [bx, CEIL, bz], [ax, CEIL, az]]) { P.push(x, y, z); c.set(y > 1 ? '#e8d8c2' : '#b08a6e'); C.push(c.r, c.g, c.b); } }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); wg.computeVertexNormals(); const wm = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); g.add(wm);
    for (let i = 0; i < ring.length - 1; i++) { const [ax, az] = ring[i], [bx, bz] = ring[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue; const nx = -(bz - az) / L * 0.6, nz = (bx - ax) / L * 0.6; ctx.addFoot([[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]], 60); }
    const hole = new THREE.Path(); for (let i = 0; i <= 64; i++) { const [x, z] = W(ell(DOME, DX, DZ, (i / 64) * Math.PI * 2)); if (i) hole.lineTo(x, z); else hole.moveTo(x, z); } const s3 = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, z))); s3.holes.push(hole); const cg = new THREE.ShapeGeometry(s3, 32); cg.rotateX(Math.PI / 2); cg.translate(0, CEIL, 0); st.add(cg, '#d9cfc0', 'std');
    for (let k = 0; k < 4; k++) { const pts = []; for (let i = 0; i <= 96; i++) { const [x, z] = W(ell(DOME, DX * (1.08 + k * 0.12), DZ * (1.08 + k * 0.12) + k * 4, (i / 96) * Math.PI * 2)); pts.push(new THREE.Vector3(x, CEIL - 0.3, z)); } tube(st, pts, 0.12, '#fff3d6', 'glow', 4); }
    const skyT = canvasTex(1024, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fd0ff'); gr.addColorStop(1, '#e8f4ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(250,250,245,0.95)'; c.lineWidth = 5; for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.lineWidth = 3; for (let y = 0; y <= h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 32, h); c.stroke(); } });
    const dg = new THREE.SphereGeometry(1, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2); dg.scale(DX, DH, DZ); dg.rotateY(ROT); const [dx0, dz0] = W(DOME); dg.translate(dx0, CEIL, dz0); const dm = new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide }); g.add(new THREE.Mesh(dg, dm)); ctx.domeM = dm; }
  // 3) 가운데 뚫린 곳: 둘레 벽(아래로) · 지하 아이스링크(얼음 · 펜스) · 유리 난간 · 놋쇠 손잡이
  const RY = -12;
  { const P = [], I = []; for (let i = 0; i <= 64; i++) { const [x, z] = W(ell(AT, AX, AZ, (i / 64) * Math.PI * 2)); P.push(x, 0, z, x, RY, z); if (i < 64) I.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); } const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setIndex(I); pg.computeVertexNormals(); const pm = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: '#d9cdb8', side: THREE.DoubleSide })); g.add(pm);
    const bf = new THREE.ShapeGeometry(new THREE.Shape(Array.from({ length: 64 }, (_, i) => { const [x, z] = W(ell(AT, AX, AZ, (i / 64) * Math.PI * 2)); return new THREE.Vector2(x, -z); }))); bf.rotateX(-Math.PI / 2); bf.translate(0, RY, 0); st.add(bf, '#8a8f99', 'std');
    const ice = new THREE.ShapeGeometry(new THREE.Shape(RINK.map(W).map(([x, z]) => new THREE.Vector2(x, -z)))); ice.rotateX(-Math.PI / 2); ice.translate(0, RY + 0.06, 0); const im = new THREE.Mesh(ice, new THREE.MeshPhongMaterial({ color: '#eef6fb', shininess: 160, specular: '#ffffff' })); g.add(im);
    const fence = RINK.map(W).map(([x, z]) => new THREE.Vector3(x, RY + 1.0, z)); tube(st, fence, 0.12, '#2f6fd0', 'std', 4); for (let i = 0; i < RINK.length - 1; i++) { const [ax, az] = W(RINK[i]), [bx, bz] = W(RINK[i + 1]), L = Math.hypot(bx - ax, bz - az); st.add(G.box(L, 1.0, 0.15), '#ffffff', 'std', T((ax + bx) / 2, RY, (az + bz) / 2, Math.atan2(bz - az, -(bx - ax)) + Math.PI / 2)); }
    const top = [], gl = []; for (let i = 0; i <= 96; i++) { const [x, z] = W(ell(AT, AX + 0.3, AZ + 0.3, (i / 96) * Math.PI * 2)); top.push(new THREE.Vector3(x, 1.1, z)); if (i % 3 === 0) st.add(G.cyl(0.05, 0.05, 1.1, 6), '#c9a86a', 'metal', T(x, 0, z)); gl.push([x, z]); } tube(st, top, 0.06, '#d8b86a', 'metal', 6);
    const gp = []; for (let i = 0; i < gl.length - 1; i++) { const [ax, az] = gl[i], [bx, bz] = gl[i + 1]; gp.push(ax, 0.1, az, bx, 0.1, bz, bx, 1.05, bz, ax, 0.1, az, bx, 1.05, bz, ax, 1.05, az); } const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.computeVertexNormals(); g.add(new THREE.Mesh(gg, new THREE.MeshPhongMaterial({ color: '#cfe6f0', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })));
    ctx.addFoot(Array.from({ length: 48 }, (_, i) => W(ell(AT, AX + 0.4, AZ + 0.4, (i / 48) * Math.PI * 2))), 60); }
  // 4) 2층 회랑 (높이 7m): 뚫린 곳 둘레 고리 바닥 · 유리 난간 · 기둥, 에스컬레이터 둘
  const GY = 7, K0 = 1.1, K1 = 1.27;
  { const P = []; for (let i = 0; i < 72; i++) { const a0 = (i / 72) * Math.PI * 2, a1 = ((i + 1) / 72) * Math.PI * 2, [p0x, p0z] = W(ell(AT, AX * K0, AZ * K0, a0)), [p1x, p1z] = W(ell(AT, AX * K0, AZ * K0, a1)), [q0x, q0z] = W(ell(AT, AX * K1, AZ * K1, a0)), [q1x, q1z] = W(ell(AT, AX * K1, AZ * K1, a1)); for (const y of [GY, GY - 0.6]) { const up = y === GY; P.push(...(up ? [p0x, y, p0z, q0x, y, q0z, p1x, y, p1z, p1x, y, p1z, q0x, y, q0z, q1x, y, q1z] : [p0x, y, p0z, p1x, y, p1z, q0x, y, q0z, p1x, y, p1z, q1x, y, q1z, q0x, y, q0z])); } P.push(q0x, GY - 0.6, q0z, q1x, GY - 0.6, q1z, q1x, GY, q1z, q0x, GY - 0.6, q0z, q1x, GY, q1z, q0x, GY, q0z); P.push(p0x, GY - 0.6, p0z, p0x, GY, p0z, p1x, GY, p1z, p0x, GY - 0.6, p0z, p1x, GY, p1z, p1x, GY - 0.6, p1z); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.computeVertexNormals(); st.add(rg, '#f4efe6', 'std');
    const rail = []; for (let i = 0; i <= 96; i++) { const [x, z] = W(ell(AT, AX * K0 + 0.2, AZ * K0 + 0.2, (i / 96) * Math.PI * 2)); rail.push(new THREE.Vector3(x, GY + 1.1, z)); if (i % 4 === 0) st.add(G.cyl(0.05, 0.05, 1.1, 6), '#c9a86a', 'metal', T(x, GY, z)); } tube(st, rail, 0.06, '#d8b86a', 'metal', 6);
    for (let i = 0; i < 24; i++) { const [x, z] = W(ell(AT, AX * (K0 + K1) / 2, AZ * (K0 + K1) / 2, (i / 24) * Math.PI * 2)); st.add(G.cyl(0.35, 0.4, GY - 0.6, 12), '#f0e6d4', 'std', T(x, 0, z)); st.add(G.cyl(0.55, 0.35, 0.6, 12), '#d8b86a', 'metal', T(x, GY - 1.2, z)); ctx.addCircle(x, z, 0.42, GY - 0.6); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.bulb(x + Math.cos(a) * 0.4, GY - 0.9, z + Math.sin(a) * 0.4, '#fff1cf', 0.07); } }
    for (let i = 0; i < 72; i++) { const a0 = (i / 72) * Math.PI * 2, a1 = ((i + 1) / 72) * Math.PI * 2, [ax, az] = W(ell(AT, AX * (K0 + K1) / 2, AZ * (K0 + K1) / 2, a0)), [bx, bz] = W(ell(AT, AX * (K0 + K1) / 2, AZ * (K0 + K1) / 2, a1)); ctx.addDeck(ax, az, bx, bz, ((K1 - K0) / 2) * AZ + 0.3 + ((K1 - K0) / 2) * (AX - AZ) * Math.abs(Math.cos(a0)), GY, GY); }
    ctx.addFoot(Array.from({ length: 48 }, (_, i) => W(ell(AT, AX * K0 + 0.3, AZ * K0 + 0.3, (i / 48) * Math.PI * 2))), GY + 1.2, { mh: GY + 0.2 });
    // 에스컬레이터: 회랑 바깥 가장자리를 따라 (바닥 → 7m), 계단 줄무늬 · 유리 옆판
    for (const th of [Math.PI * 0.62, Math.PI * 1.62]) { const L = 22, [ex, ez] = W(ell(AT, AX * (K1 + 0.03), AZ * (K1 + 0.03), th)), [fx, fz] = W(ell(AT, AX * (K1 + 0.03), AZ * (K1 + 0.03), th + 0.02)), tx = fx - ex, tz = fz - ez, tl = Math.hypot(tx, tz), ux = tx / tl, uz = tz / tl, nx = -uz, nz = ux, top = [ex + nx * 1.6, ez + nz * 1.6], bot = [top[0] - ux * L, top[1] - uz * L];
      ctx.addDeck(bot[0], bot[1], top[0], top[1], 1.3, 0, GY); ctx.addDeck(top[0], top[1], top[0] + ux * 1.5, top[1] + uz * 1.5, 1.3, GY, GY);
      const ry = Math.atan2(ux, uz), slope = Math.atan2(GY, L), mid = [(bot[0] + top[0]) / 2, (bot[1] + top[1]) / 2], Ls = Math.hypot(L, GY);
      st.add(G.box(2.4, 0.5, Ls), '#8a929a', 'metal', T(mid[0], GY / 2 - 0.5, mid[1], ry, -slope)); for (let k = 0; k < 40; k++) st.add(G.box(2.0, 0.04, 0.08), '#30343a', 'std', T(bot[0] + ux * L * (k / 40), GY * (k / 40) + 0.02, bot[1] + uz * L * (k / 40), ry)); for (const s of [-1, 1]) { st.add(G.box(0.08, 1.0, Ls), '#cfe6f0', 'metal', T(mid[0] + nx * s * 1.2, GY / 2 - 0.1, mid[1] + nz * s * 1.2, ry, -slope)); st.add(G.box(0.14, 0.1, Ls), '#2a2d33', 'std', T(mid[0] + nx * s * 1.2, GY / 2 + 0.95, mid[1] + nz * s * 1.2, ry, -slope)); ctx.addFoot([[bot[0] + nx * s * 1.4, bot[1] + nz * s * 1.4], [top[0] + nx * s * 1.4, top[1] + nz * s * 1.4], [top[0] + nx * s * 1.7, top[1] + nz * s * 1.7], [bot[0] + nx * s * 1.7, bot[1] + nz * s * 1.7]], 1.0); } }
  }
  // 5) 벽을 따라 유럽풍 거리: 2층짜리 집 앞면 (가게 유리 · 차양 · 덧창 · 발코니 · 처마), 가게 이름은 글씨 그림 한 장
  const atlas = canvasTex(1024, 512, (c) => { SHOPS.forEach((nm, i) => { const x = (i % 4) * 256, y = Math.floor(i / 4) * 128; c.fillStyle = ['#7a3a22', '#2f5f8f', '#2f7a5a', '#8a2f5a'][i % 4]; c.fillRect(x + 4, y + 24, 248, 80); c.strokeStyle = '#e6b84a'; c.lineWidth = 5; c.strokeRect(x + 10, y + 30, 236, 68); c.fillStyle = '#fff6e0'; c.font = 'bold 40px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(nm, x + 128, y + 66, 224); }); });
  const SP = [], SU = [], doors = [W([10411, 2016]), W([10514, 2170.7])], HOUSE = ['#f2d7c4', '#f6e7b8', '#d9e6d2', '#f0c9c9', '#dfd5ee', '#f7efe2', '#cfe0ea', '#f3d1a8'], AWN = ['#c23b3b', '#2f6fd0', '#2f8a5a', '#e6a23a', '#8a3fbf'];
  let hi = 0; for (let i = 0; i < ring.length - 1; i++) { const [ax, az] = ring[i], [bx, bz] = ring[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 7) continue; const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = -uz, nz = ux; { const mx = (ax + bx) / 2 + nx * 2, mz = (az + bz) / 2 + nz * 2; if (!inRing(mx, mz, ring)) { nx = -nx; nz = -nz; } } const ry = Math.atan2(nx, nz), n = Math.max(1, Math.floor(L / 9));
    for (let k = 0; k < n; k++) { const w = L / n - 0.3, cx0 = ax + ux * (L / n) * (k + 0.5), cz0 = az + uz * (L / n) * (k + 0.5); if (doors.some(([dx, dz]) => Math.hypot(dx - cx0, dz - cz0) < 9)) continue; hi++; const D = 5, h = 9 + (hi % 3) * 1.2, x = cx0 + nx * D / 2, z = cz0 + nz * D / 2, col = HOUSE[hi % HOUSE.length], fx = cx0 + nx * (D + 0.02), fz = cz0 + nz * (D + 0.02);
      st.add(G.box(w, h, D), col, 'std', T(x, 0, z, ry)); st.add(G.box(w + 0.3, 0.45, D + 0.4), '#f7f1e6', 'std', T(x, h - 0.45, z, ry)); st.add(G.box(w + 0.2, 0.3, 0.3), '#f7f1e6', 'std', T(fx - nx * 0.1, 4.6, fz - nz * 0.1, ry));
      const roof = new THREE.CylinderGeometry(0, 1, 2.6, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(w * 0.72, 1, D * 0.72); roof.translate(0, 1.3, 0); st.add(roof, ['#8a4a3a', '#3a4a6a', '#5a6a4a'][hi % 3], 'std', T(x, h, z, ry));
      st.add(new THREE.PlaneGeometry(w * 0.7, 2.6), '#ffe0a8', 'glow', T(fx, 1.5, fz, ry)); st.add(G.box(w * 0.74, 0.12, 0.12), '#5a3a22', 'std', T(fx, 2.85, fz, ry));
      const aw = new THREE.BoxGeometry(w * 0.8, 0.12, 1.4); aw.rotateX(0.35); st.add(aw, AWN[hi % AWN.length], 'std', T(fx + nx * 0.7, 3.4, fz + nz * 0.7, ry));
      for (const s of [-0.3, 0.3]) { const wx = fx + ux * s * w, wz = fz + uz * s * w; st.add(new THREE.PlaneGeometry(1.1, 1.6), '#ffd79a', 'glow', T(wx, 6.4, wz, ry)); st.add(G.box(0.35, 1.7, 0.08), AWN[(hi + 2) % AWN.length], 'std', T(wx + ux * 0.75, 5.55, wz + uz * 0.75, ry)); st.add(G.box(0.35, 1.7, 0.08), AWN[(hi + 2) % AWN.length], 'std', T(wx - ux * 0.75, 5.55, wz - uz * 0.75, ry)); if (hi % 2) { st.add(G.box(1.6, 0.12, 0.7), '#f7f1e6', 'std', T(wx + nx * 0.35, 5.4, wz + nz * 0.35, ry)); st.add(G.box(1.6, 0.6, 0.05), '#2a2d33', 'std', T(wx + nx * 0.68, 5.5, wz + nz * 0.68, ry)); } }
      for (let b = 0; b < 6; b++) ctx.bulb(fx + nx * 0.2 + ux * (b - 2.5) * w * 0.15, 4.85, fz + nz * 0.2 + uz * (b - 2.5) * w * 0.15, '#fff1cf', 0.08);
      // 간판 (글씨 그림 한 장에서 잘라 쓴다)
      { const si = hi % SHOPS.length, u0 = (si % 4) / 4, v1 = 1 - Math.floor(si / 4) / 4, v0 = v1 - 0.25, sw = Math.min(w * 0.7, 4.6), shh = sw * 0.5, cxs = fx + nx * 0.05, czs = fz + nz * 0.05, base = SP.length / 3; for (const [px, py, uu, vv] of [[-sw / 2, 3.65, u0, v0 + 0.03], [sw / 2, 3.65, u0 + 0.25, v0 + 0.03], [sw / 2, 3.65 + shh * 0.62, u0 + 0.25, v1 - 0.03], [-sw / 2, 3.65 + shh * 0.62, u0, v1 - 0.03]]) { SP.push(cxs + ux * px, py + 0.55, czs + uz * px); SU.push(uu, vv); } void base; }
      const ex = (p) => [cx0 + ux * p[0] + nx * p[1], cz0 + uz * p[0] + nz * p[1]]; ctx.addFoot([ex([-w / 2, 0]), ex([w / 2, 0]), ex([w / 2, D]), ex([-w / 2, D])], 60); } }
  { const sg = new THREE.BufferGeometry(), I = []; for (let q = 0; q < SP.length / 12; q++) I.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); sg.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(SU, 2)); sg.setIndex(I); const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide })); g.add(sm); }
  // 6) 문 (북쪽 정문 · 남쪽 섬 가는 문): 안쪽 큰 유리문 + 빛
  for (const [dx, dz] of doors) { const i = ring.reduce((b, p, j) => (Math.hypot(p[0] - dx, p[1] - dz) < Math.hypot(ring[b][0] - dx, ring[b][1] - dz) ? j : b), 0); void i; st.add(G.box(8, 5, 0.3), '#cfe6f2', 'metal', T(dx, 0, dz, Math.atan2(dx - W(DOME)[0], dz - W(DOME)[1]))); st.add(new THREE.PlaneGeometry(7.6, 4.6), '#fff4dc', 'glow', T(dx - (dx - W(DOME)[0]) * 0.002, 2.4, dz - (dz - W(DOME)[1]) * 0.002, Math.atan2(W(DOME)[0] - dx, W(DOME)[1] - dz))); }
  // 7) 기구들 (실제 자리)
  const rides = [];
  rides.push(new Carousel(ctx, { cx: 10333 + OX, cz: 2124 + OZ, board: [10333 + OX + 11.2, 2124 + OZ + 1] }));
  rides.push(new Viking(ctx, { cx: 10531 + OX, cz: 2112 + OZ, ax: 1.86, board: [10531 + OX + 9, 2112 + OZ + 3] }));
  rides.push(new Balloons(ctx, { board: [10319 + OX + 3, 2138 + OZ - 5] }));
  // 실내 롤러코스터: 북서쪽, 끌어올림 → 크게 돌며 떨어져 → 세로 루프 → 나선 → 승강장 (실제 자리 10331,2098 둘레)
  //   승강장은 동쪽에서 북쪽을 보고 (퍼레이드 길 · 2층 회랑 · 회전목마를 피해), 북쪽 벽 아래로 올라 서쪽 벽을 따라 떨어진 뒤 남쪽으로 세로 루프
  { const P = [[10356, 2100, 1.5], [10356, 2088, 1.5], [10355, 2078, 1.6], [10352, 2066, 8], [10347, 2056, 14], [10338, 2052, 17.5], [10330, 2056, 16], [10325, 2068, 8], [10325, 2079, 3]];
    const lc = [10325, 2087], ld = [0, 1]; for (let i = 0; i <= 10; i++) { const th = (i / 10) * Math.PI * 2, R = 6; P.push([lc[0] + ld[0] * Math.sin(th) * R + ld[1] * (i / 10) * 3.2, lc[1] + ld[1] * Math.sin(th) * R - ld[0] * (i / 10) * 3.2, 2.6 + R * (1 - Math.cos(th))]); }
    P.push([10331, 2099, 3.5], [10340, 2106, 4.5], [10349, 2106, 3.5], [10354, 2104, 2]);
    rides.push(new Coaster(ctx, { name: '실내 롤러코스터', g0: 0, path: P.map(([x, z, y]) => [x + OX, z + OZ, y]), lift: [22, 55], brake: 0.9, nCars: 3, rows: 2, carLen: 2.8, vmin: 3.5, fric: 0.04, cols: { rail: '#d84a6a', spine: '#3a3f47', tie: '#3a3f47', post: '#f0efe9', car: '#c23b5a', trim: '#e6b84a', seat: '#2a2d33', roof: '#c23b5a' }, spec: [10395 + OX, 10, 2050 + OZ] })); }
  // 통나무 보트: 북동쪽, 끌어올려 물길을 굽이돌다 큰 낙하로 물보라 (실제 자리 10543,2098 둘레)
  rides.push(new Coaster(ctx, { name: '통나무 보트', style: 'flume', g0: 0, path: [[10546, 2097, 0.6], [10551, 2086, 0.6], [10556, 2072, 2.5], [10557, 2058, 8], [10551, 2046, 11], [10537, 2039, 10.7], [10523, 2043, 10.4], [10515, 2054, 10.1], [10519, 2065, 9.8], [10528, 2071, 9.4], [10533, 2079, 7.5], [10536, 2087, 1.4], [10539, 2093, 0.6]].map(([x, z, y]) => [x + OX, z + OZ, y]), lift: [16, 44], brake: 0.95, nCars: 1, rows: 2, carLen: 3, vmin: 2.4, fric: 0.12, vmax: 12, cols: { rail: '#8a6a4a', spine: '#5a4a3a', tie: '#5a4a3a', post: '#8a6a4a', roof: '#2f7a5a' }, spec: [10500 + OX, 14, 2070 + OZ] }));
  rides.push(new Monorail(ctx, { name: '실내 모노레일', line: R_MONO_IN.map(W), hUp: 13, board: [10512 + OX, 2150 + OZ], spec: [W(DOME)[0], 18, W(DOME)[1]] }));
  // 스케이트 타는 곰 · 퍼레이드
  const skaters = new Movers(ctx, { name: '' }); for (let i = 0; i < 26; i++) skaters.seat(g, 0, 0, 0); skaters.pose = function (t) { this.seats.forEach((s, i) => { const r = 0.45 + (i % 5) * 0.11, th = t * (0.22 + (i % 3) * 0.05) * (i % 7 === 0 ? -1 : 1) + i * 1.3, [x, z] = W(ell(AT, 44 * r, 22 * r, th)), [x2, z2] = W(ell(AT, 44 * r, 22 * r, th + 0.01 * (i % 7 === 0 ? -1 : 1))); s.position.set(x, RY + 0.06 - 0.28, z); s.rotation.set(0, Math.atan2(x2 - x, z2 - z), Math.sin(t * 3 + i) * 0.12); }); };
  rides.push(skaters);
  const parade = buildParade(ctx); rides.push(parade);
  // 움직이지 않는 것 한 덩어리 + 전구
  for (const [x, y, z, col, r] of ctx.bulbs) st.add(G.ball(r, 5), col, 'glow', T(x, y, z));
  st.build(g, { shadow: false });
  // 빛: 하늘 · 바닥 반사 + 돔에서 내려오는 햇빛, 둘레 따뜻한 점 조명
  g.add(new THREE.HemisphereLight('#fff8ee', '#c9b49a', 1.25)); const sun = new THREE.DirectionalLight('#fff2dc', 1.1); sun.position.set(W(DOME)[0] + 30, 80, W(DOME)[1] + 20); sun.target.position.set(W(DOME)[0], 0, W(DOME)[1]); g.add(sun, sun.target);
  const riders = new Riders(g, 420);
  park.inRides = rides;
  const spawnN = { x: doors[0][0] + 0.296 * 14, z: doors[0][1] + 0.955 * 14, face: Math.atan2(0.296, 0.955) }, spawnS = { x: doors[1][0] - 0.297 * 14, z: doors[1][1] - 0.955 * 14, face: Math.atan2(-0.297, -0.955) };
  const I = {
    g, O: new THREE.Vector3(W(DOME)[0], 0, W(DOME)[1]), fronts: [], name: '롯데월드 어드벤처', isPark: true, fog: 0.0012, riders, door: { x: 1e9, z: 1e9 },
    box: [Math.min(...xs) + 1, Math.max(...xs) - 1, Math.min(...zs) + 1, Math.max(...zs) - 1],
    get spawn() { return hg.inMall?.D === park.doors?.[1] ? spawnS : spawnN; },
    // 문 가까이 가면 그 문으로 나간다 (몰처럼)
    tick(dt = 1 / 60) { if ((I.cool = (I.cool ?? 1.5) - dt) > 0) return; for (let k = 0; k < 2; k++) if (Math.hypot(hg.px - doors[k][0], hg.pz - doors[k][1]) < 2.4 && !park.ride) { hg.inMall.D = park.doors[k]; I.cool = 1.5; hg.leaveMall(); return; } },
    tick2(dt, night) { ctx.domeM.color.setRGB(1 - night * 0.82, 1 - night * 0.8, 1 - night * 0.62); },
  };
  park.inside = I; return I;
}

// 퍼레이드: 1층 길(뚫린 곳 바깥 둘레)을 꽃수레 · 마차 · 케이크 · 음악대 수레가 천천히 돈다, 사이사이 걷는 곰들
function buildParade(ctx) {
  const P = new Movers(ctx, { name: '' }), K = 1.48, cars = [], kinds = 5;
  const mk = (kind) => { const g = new THREE.Group(); ctx.g.add(g); const k = new Kit();
    k.add(G.box(3.2, 0.9, 6), ['#ffffff', '#ffd6e4', '#fff1c8', '#d6f0ff', '#e8dcff'][kind], 'std', T(0, 0.35, 0)); for (const [sx, sz] of [[-1.4, 2.2], [1.4, 2.2], [-1.4, -2.2], [1.4, -2.2]]) k.add(G.cyl(0.4, 0.4, 0.2, 12), '#e6b84a', 'metal', T(sx, 0.4, sz, 0, 0, Math.PI / 2));
    if (kind === 0) { for (const [x, z, r, h] of [[0, 0, 1.0, 3.5], [-1, 1.6, 0.6, 2.4], [1, 1.6, 0.6, 2.4], [-1, -1.6, 0.6, 2.6], [1, -1.6, 0.6, 2.6]]) { k.add(G.cyl(r, r, h, 10), '#f4ecdf', 'std', T(x, 1.25, z)); k.add(G.cone(r * 1.25, r * 2.2, 10), '#2f5fb8', 'std', T(x, 1.25 + h, z)); } }
    else if (kind === 1) { k.add(G.ball(1.6, 12), '#ff8fb8', 'std', T(0, 2.6, 0, 0, 0, 0, new THREE.Vector3(1, 0.9, 1.3))); for (let i = 0; i < 14; i++) k.add(G.ball(0.35, 6), ['#ffffff', '#ffd23f', '#ff5f8a'][i % 3], 'std', T(Math.cos(i) * 1.6, 1.4 + (i % 3) * 0.6, Math.sin(i * 1.7) * 2.4)); }
    else if (kind === 2) { for (let i = 0; i < 3; i++) k.add(G.cyl(1.5 - i * 0.4, 1.5 - i * 0.4, 1.0, 20), ['#fff4e6', '#ffb7c5', '#fff4e6'][i], 'std', T(0, 1.25 + i * 1.0, 0)); k.add(G.ball(0.35, 8), '#e8202f', 'std', T(0, 4.5, 0)); }
    else if (kind === 3) { k.add(G.box(2.6, 2.2, 3.6), '#3fa7ff', 'std', T(0, 1.25, 0)); for (let i = 0; i < 4; i++) k.add(G.ball(0.9, 10), ['#ff5a7a', '#ffd23f', '#7c5cff', '#2ec4b6'][i], 'std', T((i % 2 - 0.5) * 1.6, 4.6 + (i >> 1) * 0.6, (i >> 1) - 0.5)); }
    else { k.add(G.box(2.6, 1.8, 4.4), '#e8dcff', 'std', T(0, 1.25, 0)); k.add(G.cyl(0.8, 0.8, 0.4, 16), '#e6b84a', 'metal', T(0, 3.05, 0)); k.add(G.cone(0.3, 1.6, 10), '#e6b84a', 'metal', T(0.6, 3.4, 0, 0, 0, -0.6)); }
    for (let i = 0; i < 16; i++) k.add(G.ball(0.1, 5), '#fff1cf', 'glow', T(1.62 * (i % 2 ? 1 : -1), 0.85, -2.8 + (i >> 1) * 0.8)); k.build(g); return g; };
  for (let i = 0; i < kinds; i++) cars.push(mk(i));
  const per = 10, walkers = []; for (let i = 0; i < kinds * per; i++) walkers.push(P.seat(ctx.g, 0, 0, 0));
  const len = 2 * Math.PI * Math.sqrt(((AX * K) ** 2 + (AZ * K) ** 2) / 2), spd = 0.9;
  const at = (s) => { const th = (s / len) * Math.PI * 2, [x, z] = W(ell(AT, AX * K, AZ * K, th)), [x2, z2] = W(ell(AT, AX * K, AZ * K, th + 0.01)); return [x, z, Math.atan2(x2 - x, z2 - z)]; };
  P.pose = function (t) { const s0 = t * spd; cars.forEach((g, i) => { const [x, z, ry] = at(s0 - i * 22); g.position.set(x, 0, z); g.rotation.y = ry; });
    walkers.forEach((w, j) => { const ci = Math.floor(j / per), q = j % per, [x, z, ry] = at(s0 - ci * 22 - 6 - (q >> 1) * 2.4), sd = q % 2 ? 1.6 : -1.6; w.position.set(x + Math.cos(ry) * sd, Math.abs(Math.sin(t * 6 + j)) * 0.08 - 0.06, z - Math.sin(ry) * sd); w.rotation.set(0, ry, Math.sin(t * 6 + j) * 0.08); }); };
  return P;
}

// ---------- 명소 체험으로 붙이기 (hangang-attractions.js 틀) ----------
//   롯데월드 한 곳(지도 · 도장첩 · 도장 id 'lotteworld'). 체험 자리(pts) = 기구마다 타는 곳 (4m 안이면 카드에 그 기구 이름 · 소개 · [타기])
let PARK = null, HG = null;
const C0 = [10540, 2240], INTRO = { '자유낙하 탑': '70m 꼭대기까지 천천히 올라 3초 만에 떨어져요', '꼬마 낙하 탑': '아이들도 타는 작은 낙하 탑', '거대 진자': '팔이 190°까지 흔들리고 원판이 돌아요', '회전그네': '빙글빙글 돌며 그네가 바깥으로 날아요', '호수 롤러코스터': '1.5초 만에 72km/h, 석촌호수 위를 달려요', '모노레일': '다리 옆 높은 선로로 섬을 한 바퀴', '회전목마': '2층짜리 회전목마', '바이킹': '75°까지 흔들리는 해적선', '열기구': '돔 천장 레일에 매달려 한 바퀴', '실내 롤러코스터': '세로로 한 바퀴 도는 실내 롤러코스터', '통나무 보트': '물길을 굽이돌다 큰 낙하로 물보라', '실내 모노레일': '어드벤처 안 높은 선로를 한 바퀴' };
const ICON = { '자유낙하 탑': '🗼', '꼬마 낙하 탑': '🗼', '거대 진자': '🌀', '회전그네': '🎠', '호수 롤러코스터': '🎢', '모노레일': '🚝', '회전목마': '🎠', '바이킹': '⛵', '열기구': '🎈', '실내 롤러코스터': '🎢', '통나무 보트': '🛶', '실내 모노레일': '🚝' };
const rideList = () => (PARK ? [...(HG?.inMall?.I?.isPark ? PARK.inRides : PARK.rides)].filter((r) => r.board) : []);
const nearest = () => { let b = null, bd = Infinity; for (const r of rideList()) { const d = Math.hypot(HG.px - r.board[0], HG.pz - r.board[1]); if (d < bd) { bd = d; b = r; } } return b; };
registerAttraction({
  id: 'lotteworld', name: '롯데월드', icon: '🎢', intro: '석촌호수 매직아일랜드 · 실내 어드벤처 · 놀이기구를 타면 도장', r: 4, buildR: 1300, verb: '타기', go: [10520, 2196, Math.PI * 0.9],
  // 어드벤처 안(멀리 옮긴 공간)에 있는 동안은 그 자리를 공원 자리로 친다 (안에서 공원을 치우지 않게)
  get x() { return HG?.inMall?.I?.isPark ? HG.px : C0[0]; }, get z() { return HG?.inMall?.I?.isPark ? HG.pz : C0[1]; },
  get pts() { return rideList().map((r) => r.board); },
  introNow() { const r = nearest(); return r ? `${ICON[r.name] || '🎢'} ${r.name} · ${INTRO[r.name] || ''}` : this.intro; },
  start(A) { const r = nearest(); return PARK && r ? rideExp(A, PARK, r) : null; },
  build(A) { HG = A.hg; A.addWalk(parkWalk); return {
    tick(dt) { const hg = A.hg; if (!PARK) { if (!hg.chunks?.has('5_1') || hg.chunkLoading) return; PARK = hg.lotte = buildPark(hg, null, buildAdventure); } PARK.hidden = false; PARK.tick(dt); },
    dispose() { if (PARK) { PARK.hidden = true; PARK.g.visible = false; } } }; },
});
