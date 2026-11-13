// 서울 명소 체험 더하기 (8-18 4 ~ 6): 한강 유람선 · 공공자전거 · 63빌딩 전망대
//   상표 · 실제 상호 없이 일반 이름으로. 틀은 hangang-attractions.js 의 registerAttraction (도장 id 는 서버 HG_STAMPS 의 cruise · bike · obs63)
import * as THREE from 'three';
import { registerAttraction, part, merge, vcMat, signTex } from './hangang-attractions.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ============================================================
// 한강 유람선: 여의도 '한강유람선 선착장'(지도) → 강 가운데선을 따라 상류(동쪽)로 → 반포대교 서쪽에서 분수 구경 → 여의도로
//   경로 점은 칸 지도 물 다각형으로 검사(강가에서 30m 넘게 떨어진 물 위만)
// ============================================================
const PIER = { x: -3617, z: 515, land: [-3622, 606] };
const ROUTE = [[-3617, 515], [-3520, 380], [-3350, 280], [-3200, 300], [-3000, 433], [-2800, 548], [-2600, 715], [-2400, 1083], [-2200, 1505], [-2000, 1600], [-1800, 1695], [-1600, 1773], [-1400, 1700], [-1200, 1818], [-1000, 1910], [-800, 2010], [-600, 2088], [-400, 2130], [-200, 2183], [0, 2165], [200, 2168], [400, 2130], [600, 2085], [800, 2000], [1000, 1883], [1200, 1780], [1250, 1745]];
const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal', 0.5);
const ROUTE_LEN = curve.getLength();
const DECK = 6.4;
const BRIDGE = [1480, 1760]; // 반포대교가 강을 건너는 가운데 (칸 지도 '반포대로' 다리) // 윗갑판 높이 (물 위)

// 배: 흰 선체(앞이 뾰족) · 남색 띠 · 아래 유리 선실 · 위 선실 · 윗갑판 난간 · 조타실 · 깃대. 창은 따로(밤에 빛남), 갑판 줄 조명
function buildBoat() {
  const g = new THREE.Group(), L = 46, W = 11, parts = [];
  // 선체: 앞(+z)이 뾰족한 단면을 위로 밀어 올림
  const sh = new THREE.Shape(); sh.moveTo(-W / 2, -L / 2); sh.lineTo(W / 2, -L / 2); sh.lineTo(W / 2, L / 2 - 9); sh.quadraticCurveTo(W / 2, L / 2 - 2, 0, L / 2 + 1); sh.quadraticCurveTo(-W / 2, L / 2 - 2, -W / 2, L / 2 - 9); sh.closePath();
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: false }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.6, 0); parts.push(part(hull, '#f4f2ee'));
  const band = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); band.rotateX(-Math.PI / 2); band.scale(1.01, 1, 1.005); band.translate(0, 0.2, 0); parts.push(part(band, '#1f3a6b'));
  const deck1 = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }); deck1.rotateX(-Math.PI / 2); deck1.translate(0, 2.0, 0); parts.push(part(deck1, '#b9a68a'));
  // 아래 선실 (유리 띠 위아래 흰 틀) · 위 선실 · 윗갑판 바닥
  parts.push(part(new THREE.BoxGeometry(W - 1.4, 0.5, L - 14), '#f4f2ee', 0, 2.35, -2.5), part(new THREE.BoxGeometry(W - 1.4, 0.5, L - 14), '#f4f2ee', 0, 4.15, -2.5));
  parts.push(part(new THREE.BoxGeometry(W - 1.0, 0.25, L - 12), '#e9e6e0', 0, 4.5, -2.5));
  parts.push(part(new THREE.BoxGeometry(W - 4.4, 0.4, L - 26), '#f4f2ee', 0, DECK - 0.25, -5), part(new THREE.BoxGeometry(W - 4.4, 0.3, L - 26), '#f4f2ee', 0, 4.9, -5));
  parts.push(part(new THREE.BoxGeometry(W - 1.2, 0.18, L - 12), '#a58f70', 0, DECK - 0.02, -2.5));
  // 조타실 (앞쪽 위) · 굴뚝 대신 낮은 돛대 · 깃대
  parts.push(part(new THREE.BoxGeometry(4.2, 2.2, 3.4), '#f4f2ee', 0, DECK + 1.1, 11), part(new THREE.BoxGeometry(4.4, 0.25, 3.6), '#1f3a6b', 0, DECK + 2.3, 11));
  parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), '#cfd3d6', 0, DECK + 3.5, 12.4), part(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), '#cfd3d6', 0, DECK + 1.5, -18));
  // 윗갑판 난간: 기둥 + 위 손잡이 (흰색)
  const RW = W / 2 - 0.6, Z0 = -L / 2 + 4, Z1 = L / 2 - 9;
  for (let z = Z0; z <= Z1; z += 1.6) for (const sx of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5), '#ffffff', sx * RW, DECK + 0.5, z));
  for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.08, 0.08, Z1 - Z0), '#ffffff', sx * RW, DECK + 1.0, (Z0 + Z1) / 2), part(new THREE.BoxGeometry(0.05, 0.05, Z1 - Z0), '#ffffff', sx * RW, DECK + 0.55, (Z0 + Z1) / 2));
  parts.push(part(new THREE.BoxGeometry(RW * 2, 0.08, 0.08), '#ffffff', 0, DECK + 1.0, Z0));
  // 윗갑판 벤치 두 줄 · 구명환
  for (let z = -14; z <= 6; z += 4) for (const sx of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.6, 0.45, 2.6), '#6a4a2f', sx * 2.6, DECK + 0.22, z));
  for (const z of [-8, 2]) for (const sx of [-1, 1]) { const t = new THREE.TorusGeometry(0.42, 0.11, 6, 14); t.rotateY(Math.PI / 2); parts.push(part(t, '#ff5a3a', sx * (W / 2 - 0.4), 3.2, z)); }
  g.add(new THREE.Mesh(merge(parts), vcMat()));
  // 창 (아래 · 위 선실 · 조타실): 낮엔 짙은 유리, 밤엔 따뜻한 불빛
  const winM = new THREE.MeshLambertMaterial({ color: '#3a4a5a', emissive: '#ffd79a', emissiveIntensity: 0 }), wp = [];
  wp.push(new THREE.BoxGeometry(W - 1.3, 1.3, L - 14.2).translate(0, 3.25, -2.5), new THREE.BoxGeometry(W - 4.3, 1.2, L - 26.2).translate(0, 5.5, -5), new THREE.BoxGeometry(4.25, 1.0, 3.45).translate(0, DECK + 1.3, 11));
  const win = new THREE.Mesh(merge(wp.map((q) => part(q, '#ffffff'))), winM); g.add(win);
  // 갑판 줄 조명 (밤): 난간 위 작은 전구
  const bulbM = new THREE.MeshBasicMaterial({ color: '#fff2c8', transparent: true, opacity: 0.25 }), bp = [];
  for (let z = Z0; z <= Z1; z += 1.6) for (const sx of [-1, 1]) bp.push(part(new THREE.SphereGeometry(0.11, 6, 4), '#ffffff', sx * RW, DECK + 1.12, z));
  g.add(new THREE.Mesh(merge(bp), bulbM));
  g.userData = { winM, bulbM };
  return g;
}
// 선착장: 물 위 부잔교(떠 있는 판) · 강가로 잇는 다리 · 지붕 대기실 · '한강 유람선 타는 곳' 판
function buildPier(A) {
  const g = new THREE.Group(), parts = [], [lx, lz] = PIER.land, bx = PIER.x + 9, bz = PIER.z + 4;
  parts.push(part(new THREE.BoxGeometry(8, 1.0, 30), '#8d8a84', bx, 0.3, bz), part(new THREE.BoxGeometry(8.2, 0.12, 30.2), '#c9b48f', bx, 0.86, bz));
  const dx = lx - bx, dz = lz - (bz + 10), Lg = Math.hypot(dx, dz), ry = Math.atan2(dx, dz); const gw = new THREE.BoxGeometry(2.6, 0.25, Lg); gw.rotateY(ry); parts.push(part(gw, '#b8b2a6', (lx + bx) / 2, 1.2, (lz + bz + 10) / 2));
  parts.push(part(new THREE.BoxGeometry(6, 0.25, 9), '#2f4e7a', bx, 4.0, bz - 6)); for (const sx of [-2.6, 2.6]) for (const sz of [-10, -2]) parts.push(part(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), '#d9dcde', bx + sx, 2.4, bz + sz));
  for (let z = -14; z <= 14; z += 2) parts.push(part(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 5), '#ffffff', bx - 3.9, 1.35, bz + z));
  const m = new THREE.Mesh(merge(parts), vcMat()); g.add(m);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshLambertMaterial({ map: signTex('한강 유람선 타는 곳', '여의도 → 반포대교 · 분수 구경', '#1f3a6b'), emissive: '#ffffff', emissiveIntensity: 0.15, side: THREE.DoubleSide }));
  sg.material.emissiveMap = sg.material.map; sg.position.set(bx, 4.9, bz - 1.4); g.add(sg);
  A.root.add(g); return { g, sg };
}
function boatPose(boat, u, terr) {
  const p = curve.getPointAt(clamp(u, 0, 1)), t = curve.getTangentAt(clamp(u, 0, 1));
  boat.position.set(p.x, 0.05, p.z); boat.rotation.y = Math.atan2(t.x, t.z); void terr; return { p, t };
}
registerAttraction({
  id: 'cruise', name: '한강 유람선', seal: '유람선', icon: '🛳️', x: PIER.land[0], z: PIER.land[1], r: 22, buildR: 1800, verb: '배 타기',
  go: [PIER.land[0], PIER.land[1] + 10, Math.PI], intro: '여의도 선착장 → 원효 · 한강 · 동작대교 밑을 지나 반포대교 분수까지',
  build(A) {
    const P = buildPier(A), boat = buildBoat(); A.root.add(boat); boatPose(boat, 0.004);
    A.addLit((lit) => { P.sg.material.emissiveIntensity = 0.15 + lit * 0.9; boat.userData.winM.emissiveIntensity = lit * 0.9; boat.userData.bulbM.opacity = 0.2 + lit * 0.8; });
    return { group: null, boat, P, tick(dt, exp) { if (!exp) boat.position.y = 0.05 + Math.sin(A.hg.time * 1.3) * 0.06; }, dispose() { [P.g, boat].forEach((o) => { A.root.remove(o); o.traverse((q) => q.geometry?.dispose?.()); }); } };
  },
  start(A) {
    const hg = A.hg, B = A.built.get('cruise'); if (!B) return null;
    const boat = B.boat, night = hg.state.hour >= 18 || hg.state.hour < 5, V = 38;
    let u = 0.004, fast = false, phase = 'board', stopT = 0, yawSet = false, hourHold = null;
    const E = {
      title: night ? '한강 유람선 · 밤 뱃길' : '한강 유람선', lock: true,
      status() { if (phase === 'board') return '🔔 배가 곧 떠나요 · 윗갑판으로'; if (phase === 'go') { const left = Math.max(0, (1 - u) * ROUTE_LEN); return `${fast ? '⏩ 빨리 가는 중 · ' : ''}반포대교까지 ${(left / 1000).toFixed(1)}km · 마우스로 둘러보기`; } return `🌈 반포대교 달빛무지개분수 ${night ? '밤 8시' : '낮 12시'} 공연 · ${Math.ceil(15 - stopT)}초 뒤 여의도로`; },
      actLabel() { return phase === 'go' ? (fast ? '천천히' : '⏩ 빨리 가기') : ''; },
      act() { if (phase === 'go') fast = !fast; },
      tick(dt) {
        if (phase === 'board' && this.t > 3) phase = 'go';
        if (phase === 'go') { u = Math.min(1, u + (dt * V * (fast ? 3 : 1)) / ROUTE_LEN); if (u >= 1) { phase = 'stop'; hourHold = night ? 20.0 : 12.1; hg.onToast?.('🌈 분수 공연을 보러 멈췄어요'); const c = boat.position; hg.camYaw = Math.atan2(BRIDGE[0] - c.x, BRIDGE[1] - c.z); hg.camPitch = 0.05; } }
        if (phase === 'stop') { stopT += dt; hg.state.hour = hourHold; if (stopT > 15) { A.finish(E); return; } }
        const { p, t } = boatPose(boat, u); boat.position.y = 0.05 + Math.sin(hg.time * 1.1) * 0.08;
        const yaw = Math.atan2(t.x, t.z), sx = Math.cos(yaw), sz = -Math.sin(yaw);
        // 곰: 윗갑판 왼쪽 난간 앞
        const bx = p.x - sx * 2.2 + t.x * -4, bz = p.z - sz * 2.2 + t.z * -4;
        hg.px = bx; hg.pz = bz; hg.y = DECK + 0.05 - hg.terrAt(bx, bz); hg.vy = 0; hg.v = 0; hg.flying = false; hg.face = yaw - Math.PI / 2;
        if (!yawSet) { hg.camYaw = yaw + Math.PI * 0.85; hg.camPitch = 0.12; yawSet = true; }
      },
      floor(x, z) { return Math.hypot(x - boat.position.x, z - boat.position.z) < 24 ? DECK + 0.05 - hg.terrAt(x, z) : -1; },
      cam(camera, dt) { const c = boat.position, d = 34, pt = clamp(hg.camPitch ?? 0.12, -0.2, 1.0), yaw = hg.camYaw, want = new THREE.Vector3(c.x - Math.sin(yaw) * Math.cos(pt) * d, DECK + 3 + Math.sin(pt) * d, c.z - Math.cos(yaw) * Math.cos(pt) * d); if (this.t < 0.1) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-dt * 5)); camera.lookAt(c.x, DECK + 1.5, c.z); },
      end() { boatPose(boat, 0.004); hg.placeAt(PIER.land[0], PIER.land[1] + 6, Math.PI); if (phase === 'stop') hg.onToast?.('🛳️ 여의도 선착장으로 돌아왔어요'); },
      where() { return phase === 'stop' ? '반포대교 앞 한강' : '한강 유람선 윗갑판'; },
    };
    return E;
  },
});

// ============================================================
// 공공자전거: 대여소에서 빌려 타고 어디든 달리다가 아무 대여소에서나 반납 (45초 넘게 타야 도장)
// ============================================================
const STATIONS = [{ x: -3660, z: 652, ry: 0.6, name: '여의도 한강공원' }, { x: 1180, z: 1990, ry: 1.2, name: '반포 한강공원' }];
function bikeMesh() {
  // 미터 단위: 바퀴 반지름 0.33, 초록 · 흰 몸체, 앞 바구니, 검은 안장 · 손잡이
  const g = new THREE.Group(), frame = [], wheels = [];
  const tube = (a, b, r, col) => { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), L = va.distanceTo(vb), c = new THREE.CylinderGeometry(r, r, L, 6); c.translate(0, L / 2, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())); c.translate(...a); return part(c, col); };
  frame.push(tube([0, 0.33, -0.5], [0, 0.62, -0.05], 0.03, '#3aa35a'), tube([0, 0.33, -0.5], [0, 0.36, 0.05], 0.03, '#3aa35a'), tube([0, 0.36, 0.05], [0, 0.66, 0.42], 0.035, '#f2f2f2'), tube([0, 0.62, -0.05], [0, 0.66, 0.42], 0.03, '#f2f2f2'), tube([0, 0.66, 0.42], [0, 0.33, 0.52], 0.025, '#d9dcde'), tube([0, 0.62, -0.05], [0, 0.82, -0.1], 0.02, '#d9dcde'), tube([0, 0.66, 0.42], [0, 0.95, 0.4], 0.02, '#d9dcde'));
  frame.push(part(new THREE.BoxGeometry(0.16, 0.05, 0.26), '#202020', 0, 0.86, -0.12), part(new THREE.BoxGeometry(0.56, 0.03, 0.03), '#202020', 0, 0.96, 0.4), part(new THREE.BoxGeometry(0.3, 0.18, 0.24), '#3aa35a', 0, 0.82, 0.62));
  frame.push(part(new THREE.TorusGeometry(0.33, 0.06, 6, 18, Math.PI), '#f2f2f2', 0, 0.36, -0.5, 0, Math.PI / 2, 0), part(new THREE.TorusGeometry(0.33, 0.06, 6, 18, Math.PI), '#f2f2f2', 0, 0.36, 0.52, 0, Math.PI / 2, 0));
  g.add(new THREE.Mesh(merge(frame), vcMat()));
  for (const z of [-0.5, 0.52]) { const w = new THREE.Group(); w.position.set(0, 0.33, z); const tg = new THREE.TorusGeometry(0.31, 0.035, 6, 20); tg.rotateY(Math.PI / 2); const sp = []; sp.push(part(tg, '#1c1c1c')); for (let k = 0; k < 6; k++) sp.push(part(new THREE.BoxGeometry(0.01, 0.6, 0.012), '#c8ccd0', 0, 0, 0, (k * Math.PI) / 6)); w.add(new THREE.Mesh(merge(sp), vcMat())); g.add(w); wheels.push(w); }
  // 크랭크: 오른쪽 팔은 위(+y), 왼쪽은 아래로 엇갈리고 끝에 페달. 곰 발이 이 끝(PEDAL)을 따라 돈다
  const ped = new THREE.Group(); ped.position.set(0, 0.36, 0.05); ped.add(new THREE.Mesh(merge([part(new THREE.BoxGeometry(0.34, 0.03, 0.03), '#303030'), part(new THREE.BoxGeometry(0.03, 0.15, 0.03), '#303030', 0.17, 0.075, 0), part(new THREE.BoxGeometry(0.03, 0.15, 0.03), '#303030', -0.17, -0.075, 0), part(new THREE.BoxGeometry(0.1, 0.025, 0.06), '#202020', 0.22, 0.15, 0), part(new THREE.BoxGeometry(0.1, 0.025, 0.06), '#202020', -0.22, -0.15, 0)]), vcMat())); g.add(ped);
  g.userData = { wheels, ped };
  return g;
}
function buildStation(A, S) {
  const g = new THREE.Group(); g.position.set(S.x, A.H(S.x, S.z), S.z); g.rotation.y = S.ry; const parts = [];
  // 거치대 줄 · 무인 대여기 · 판
  parts.push(part(new THREE.BoxGeometry(9, 0.12, 2.4), '#c9c3b6', 0, 0.06, 0));
  for (let i = 0; i < 8; i++) parts.push(part(new THREE.BoxGeometry(0.14, 0.75, 0.14), '#5f6670', -3.9 + i * 1.1, 0.4, -0.7));
  parts.push(part(new THREE.BoxGeometry(0.7, 1.6, 0.45), '#3aa35a', 4.6, 0.8, -0.6), part(new THREE.BoxGeometry(0.5, 0.36, 0.05), '#16202a', 4.6, 1.25, -0.36));
  g.add(new THREE.Mesh(merge(parts), vcMat()));
  for (let i = 0; i < 8; i++) { if (i === 3 || i === 6) continue; const b = bikeMesh(); b.position.set(-3.9 + i * 1.1, 0, -0.1); g.add(b); }
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshLambertMaterial({ map: signTex('공공자전거 대여소', S.name, '#2f7a46'), emissive: '#ffffff', emissiveIntensity: 0.15, side: THREE.DoubleSide })); sg.material.emissiveMap = sg.material.map; sg.position.set(0, 2.3, -1.1); g.add(sg);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), new THREE.MeshLambertMaterial({ color: '#5f6670' })); pole.position.set(-1.7, 1.2, -1.15); g.add(pole); const pole2 = pole.clone(); pole2.position.x = 1.7; g.add(pole2);
  A.root.add(g); A.addLit((lit) => { sg.material.emissiveIntensity = 0.15 + lit * 0.9; });
  return g;
}
const nearStation = (x, z) => STATIONS.find((S) => Math.hypot(x - S.x, z - S.z) < 12);
registerAttraction({
  id: 'bike', name: '공공자전거', seal: '자전거', icon: '🚲', x: STATIONS[0].x, z: STATIONS[0].z, pts: STATIONS.map((S) => [S.x, S.z]), r: 12, buildR: 1500, verb: '빌리기',
  go: [STATIONS[0].x + Math.sin(STATIONS[0].ry) * 7, STATIONS[0].z + Math.cos(STATIONS[0].ry) * 7, STATIONS[0].ry + Math.PI], intro: '대여소에서 빌려 한강공원을 달려요 · 아무 대여소에서나 반납',
  build(A) { const gs = STATIONS.map((S) => buildStation(A, S)); return { dispose() { gs.forEach((g) => { A.root.remove(g); g.traverse((q) => q.geometry?.dispose?.()); }); } }; },
  start(A) {
    const hg = A.hg, b = bikeMesh(), root = hg.bear?.root; if (!root) return null;
    // 곰 키(약 1.3m, 다리가 짧다)에 맞춘 작은 자전거(0.6배): 안장 윗면 0.53m. 곰 몸 밑면(곰 단위 0.36)을 안장에 올리도록 몸 전체를 LIFT 만큼 들고, 자전거는 그만큼 내려 땅에 둔다
    const sc = root.scale.x || 1, BS = 0.6, LIFT = 0.89 * BS - 0.36 * sc; b.scale.setScalar(BS / sc); b.name = 'rent-bike'; b.position.set(0, -LIFT / sc, 0); root.add(b);
    const toRoot = (x, y, z) => [(x * BS) / sc, (-LIFT + y * BS) / sc, (z * BS) / sc]; // 자전거 m → 곰 몸 단위
    const aim = (pivot, from, to, len0) => { const dy = to[1] - from[1], dz = to[2] - from[2], L = Math.hypot(dy, dz) || 1; pivot.rotation.x = Math.atan2(-dz, -dy); pivot.rotation.z = 0; pivot.scale.y = clamp(L / len0, 0.6, 2.4); };
    const target0 = hg.target; let dist = 0, lastX = hg.px, lastZ = hg.pz, spin = 0;
    hg.onToast?.('🚲 자전거를 빌렸어요! W A S D 로 달리고, 대여소에서 E 로 반납');
    const E = {
      title: '공공자전거', lock: false,
      status() { const S = nearStation(hg.px, hg.pz); return `${(dist / 1000).toFixed(2)}km · ${(hg.v * 3.6).toFixed(0)}km/h${S ? ` · ${S.name} 대여소 — E 로 반납` : ' · 대여소에서 반납해요'}`; },
      actLabel() { return nearStation(hg.px, hg.pz) && this.t > 2 ? '반납하기' : ''; },
      act() { if (!nearStation(hg.px, hg.pz) || this.t < 2) { hg.onToast?.('🚲 반납은 대여소(지도 🚲) 12m 안에서 해요'); return; } if (this.t < 45) { this.noStamp = true; hg.onToast?.('🚲 반납했어요 · 45초 넘게 타면 도장을 받아요'); } A.finish(E); },
      tick(dt) {
        hg.target = hg.boostOn ? 7.5 : 6.4; if (hg.flying) hg.flying = false;
        const d = Math.hypot(hg.px - lastX, hg.pz - lastZ); if (d < 30) dist += d; lastX = hg.px; lastZ = hg.pz;
        spin += d / (0.33 * BS); for (const w of b.userData.wheels) w.rotation.x = spin; b.userData.ped.rotation.x = spin * 0.5;
      },
      // 곰 자세(매 프레임, 기본 자세 다음): 안장에 앉아 몸을 살짝 앞으로, 두 손은 손잡이, 두 발은 페달 끝을 따라 돈다
      post() {
        const B = hg.bear; if (!B?.legs) return; root.position.y += LIFT; B.inner.rotation.x = 0.18;
        const th = b.userData.ped.rotation.x;
        B.legs.forEach((leg, i) => { const sd = i === 0 ? -1 : 1, py = 0.36 + sd * 0.15 * Math.cos(th), pz = 0.05 + sd * 0.15 * Math.sin(th); aim(leg, [sd * 0.2, 0.62, 0], toRoot(sd * 0.21, py, pz), 0.6); });
        for (const i of [0, 1]) { const a = B.arms[i], sd = i === 0 ? -1 : 1; aim(a, [sd * 0.42, 1.32, 0.04], toRoot(sd * 0.27, 0.96, 0.4), 0.42); a.rotation.z = sd * 0.15; }
      },
      end() { root.remove(b); b.traverse((q) => q.geometry?.dispose?.()); hg.target = target0; const B = hg.bear; if (B?.legs) { for (const l of B.legs) l.scale.y = 1; for (const a of B.arms) { a.scale.y = 1; a.rotation.z = a.userData.baseZ; } B.inner.rotation.x = 0; } },
      where() { return '공공자전거 타는 중'; },
    };
    return E;
  },
});

// ============================================================
// 63빌딩 전망대: 바깥 유리 엘리베이터로 건물 옆을 따라 오르고 → 60층(약 240m) 전망대에서 둘러보기 · 유리 바닥 · 밤 야경
// ============================================================
const B63 = { x: -3509, z: 1122, ent: [-3498, 1168], top: 240 };
function buildObsFrame() {
  // 전망대 창틀(둘레 14m · 세로 틀 24개 · 위아래 띠) + 발밑 유리 바닥 판(틀 · 옅은 유리)
  const g = new THREE.Group(), parts = [], R = 14;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; parts.push(part(new THREE.BoxGeometry(0.22, 4.4, 0.3), '#2a2e33', Math.cos(a) * R, 2.2, Math.sin(a) * R, 0, -a, 0)); }
  for (const y of [0.05, 4.35]) { const t = new THREE.TorusGeometry(R, 0.18, 4, 48); t.rotateX(Math.PI / 2); parts.push(part(t, '#2a2e33', 0, y, 0)); }
  const fl = new THREE.RingGeometry(4.2, R, 48); fl.rotateX(-Math.PI / 2); parts.push(part(fl, '#8a8378', 0, 0, 0));
  for (const [x, z] of [[-4.2, 0], [4.2, 0], [0, -4.2], [0, 4.2]]) parts.push(part(new THREE.BoxGeometry(Math.abs(x) ? 0.2 : 8.4, 0.12, Math.abs(z) ? 0.2 : 8.4), '#2a2e33', x, 0.02, z));
  g.add(new THREE.Mesh(merge(parts), vcMat({ side: THREE.DoubleSide })));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), new THREE.MeshPhongMaterial({ color: '#cfe6f0', transparent: true, opacity: 0.16, shininess: 100, side: THREE.DoubleSide, depthWrite: false })); glass.rotation.x = -Math.PI / 2; glass.position.y = 0.01; g.add(glass);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 4.3, 48, 1, true), new THREE.MeshPhongMaterial({ color: '#d8ecf4', transparent: true, opacity: 0.07, shininess: 120, side: THREE.DoubleSide, depthWrite: false })); win.position.y = 2.2; g.add(win);
  return g;
}
registerAttraction({
  id: 'obs63', name: '63빌딩 전망대', seal: '63', icon: '🌇', x: B63.ent[0], z: B63.ent[1], r: 16, buildR: 900, verb: '전망대 오르기', high: false,
  go: [B63.ent[0], B63.ent[1] + 12, Math.PI], intro: '바깥 유리 엘리베이터로 60층까지 · 한강과 서울을 내려다봐요 (유리 바닥 · 밤 야경)',
  build(A) {
    const g = new THREE.Group(), parts = [], [x, z] = B63.ent, gy = A.H(x, z);
    // 입구: 금빛 유리 차양 · 문 · '전망대 입구' 판
    parts.push(part(new THREE.BoxGeometry(10, 0.3, 4), '#d9b25c', x, gy + 4.4, z), part(new THREE.BoxGeometry(6, 3.6, 0.2), '#3a3020', x, gy + 1.8, z - 1.9));
    for (const sx of [-4.6, 4.6]) parts.push(part(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 8), '#8a6a3a', x + sx, gy + 2.2, z + 1.6));
    g.add(new THREE.Mesh(merge(parts), vcMat()));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshLambertMaterial({ map: signTex('63빌딩 전망대', '60층 · 유리 엘리베이터', '#5a4220', '#ffe8b0'), emissive: '#ffffff', emissiveIntensity: 0.2 })); sg.material.emissiveMap = sg.material.map; sg.position.set(x, gy + 5.4, z + 2.05); g.add(sg);
    A.root.add(g); A.addLit((lit) => { sg.material.emissiveIntensity = 0.2 + lit * 0.9; });
    return { dispose() { A.root.remove(g); g.traverse((q) => q.geometry?.dispose?.()); } };
  },
  start(A) {
    const hg = A.hg, gy = A.H(B63.x, B63.z), top = gy + B63.top, frame = buildObsFrame(); frame.position.set(B63.x, top - 1.7, B63.z); frame.visible = false; A.root.add(frame);
    // 외벽 바깥에 내민 유리 바닥 판 (유리 바닥 볼 때만, 보는 쪽으로): 짙은 틀 + 옅은 유리
    const gp = new THREE.Group(); gp.add(new THREE.Mesh(merge([part(new THREE.BoxGeometry(3.4, 0.12, 0.14), '#2a2e33', 0, 0, -1.7), part(new THREE.BoxGeometry(3.4, 0.12, 0.14), '#2a2e33', 0, 0, 1.7), part(new THREE.BoxGeometry(0.14, 0.12, 3.4), '#2a2e33', -1.7, 0, 0), part(new THREE.BoxGeometry(0.14, 0.12, 3.4), '#2a2e33', 1.7, 0, 0)]), vcMat())); { const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshPhongMaterial({ color: '#d6eef6', transparent: true, opacity: 0.18, shininess: 120, side: THREE.DoubleSide, depthWrite: false })); gl.rotation.x = -Math.PI / 2; gp.add(gl); } gp.visible = false; A.root.add(gp);
    const bearVis = hg.bear?.root.visible; let phase = 'up', glassView = false, look = { yaw: 2.4, pitch: -0.05 }, h0 = hg.state.hour, nightSet = false;
    // 엘리베이터: 건물 남동쪽 모서리 바깥을 따라 오른다 (바깥 유리 엘리베이터)
    const ex = B63.x + 22, ez = B63.z + 14, ELV = 22;
    hg.onToast?.('🛗 유리 엘리베이터가 올라가요 — 창밖을 봐요');
    const E = {
      title: '63빌딩 전망대', lock: true,
      status() { if (phase === 'up') return `🛗 ${Math.round(clamp(this.t / ELV, 0, 1) * 60)}층 · 땅에서 ${Math.round(clamp(this.t / ELV, 0, 1) * B63.top)}m`; return `60층 전망대 · ${glassView ? '유리 바닥 아래 · 발밑 240m' : '마우스로 둘러보기'}${nightSet ? ' · 밤 야경' : ''}`; },
      actLabel() { return phase === 'up' ? '' : glassView ? '창밖 보기' : '유리 바닥 내려다보기'; },
      act() { if (phase !== 'obs') return; glassView = !glassView; },
      tick(dt) {
        if (hg.bear) hg.bear.root.visible = false;
        if (phase === 'up' && this.t >= ELV) { phase = 'obs'; frame.visible = true; hg.camYaw = look.yaw; hg.camPitch = 0.05; hg.onToast?.('🌇 60층 전망대 · E = 유리 바닥, 아래 단추로 밤 야경'); this.nightBtn(); }
        if (phase === 'obs') { look.yaw = hg.camYaw; look.pitch = clamp(-(hg.camPitch - 0.05), -0.5, 0.6); }
        hg.px = B63.x; hg.pz = B63.z; hg.y = 0; hg.vy = 0; hg.v = 0;
      },
      nightBtn() { const bt = document.createElement('button'); bt.id = 'obs63-night'; bt.textContent = '🌙 밤 야경 / ☀️ 낮'; bt.style.cssText = 'position:absolute;left:50%;bottom:120px;transform:translateX(-50%);border:0;border-radius:14px;padding:10px 16px;font-family:Jua,sans-serif;font-size:15px;background:rgba(14,20,36,.8);color:#fff;z-index:7;cursor:pointer'; bt.onclick = () => { nightSet = !nightSet; hg.state.hour = nightSet ? 21.2 : h0 >= 18 || h0 < 5 ? 12 : h0; }; document.getElementById('hg-hud')?.appendChild(bt); this.bt = bt;
        const dn = bt.cloneNode(); dn.id = 'obs63-down'; dn.textContent = '⬇️ 내려가기'; dn.style.left = 'calc(50% + 150px)'; dn.onclick = () => { if (this.t < ELV + 20) { this.noStamp = true; hg.onToast?.('🌇 20초 넘게 둘러보면 도장을 받아요'); } A.finish(E); }; document.getElementById('hg-hud')?.appendChild(dn); this.dn = dn; },
      setNight(v) { nightSet = v; hg.state.hour = v ? 21.2 : 12; },
      cam(camera, dt) {
        if (phase === 'up') { const k = clamp(this.t / ELV, 0, 1), e = k * k * (3 - 2 * k), y = gy + 3 + e * (B63.top - 3); camera.position.set(ex, y, ez); const a = 2.2 + e * 0.9; camera.lookAt(ex + Math.sin(a) * 40, y - 6 - e * 10, ez + Math.cos(a) * 40); return; }
        const yaw = hg.camYaw, rr = glassView ? 21 : 9, eye = new THREE.Vector3(B63.x + Math.sin(yaw) * rr, glassView ? top - 0.6 : top, B63.z + Math.cos(yaw) * rr); // 유리 바닥: 외벽 바로 바깥에 내민 유리판 위에서 발밑으로 (금빛 외벽이 비스듬히 내려가는 모습)
        camera.position.copy(eye);
        gp.visible = glassView; if (glassView) { gp.position.set(B63.x + Math.sin(yaw) * 22, top - 1.75, B63.z + Math.cos(yaw) * 22); gp.rotation.y = yaw; }
        if (glassView) camera.lookAt(eye.x + Math.sin(yaw) * 9, eye.y - 40, eye.z + Math.cos(yaw) * 9); else camera.lookAt(eye.x + Math.sin(yaw) * 30, eye.y - 4 + look.pitch * 30, eye.z + Math.cos(yaw) * 30);
      },
      end() { gp.parent?.remove(gp); frame.parent?.remove(frame); frame.traverse((q) => q.geometry?.dispose?.()); this.bt?.remove(); this.dn?.remove(); if (hg.bear) hg.bear.root.visible = bearVis !== false; if (nightSet) hg.state.hour = h0; hg.placeAt(B63.ent[0], B63.ent[1] + 8, Math.PI); },
      where() { return phase === 'up' ? '63빌딩 유리 엘리베이터' : '63빌딩 60층 전망대'; },
    };
    // 전망대에서 E 두 번이 아니라 띠의 [그만하기]로 내려온다. 20초 넘게 있어야 도장(서버 최소 시간)
    return E;
  },
});
