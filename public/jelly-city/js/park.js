// 젤리랜드 놀이공원: 롤러코스터 · 바이킹 · 관람차 · 회전목마 (브라우저)
// 모든 놀이기구는 "현재 시각"으로 움직임이 정해져서 모든 플레이어 화면에서 똑같이 돈다.
import * as THREE from 'three';
import { toon, box, cyl, sph, signMesh } from '../../shared/js/utils.js';
import { PARK } from './terrain.js';

const now = () => Date.now() / 1000;
const CX = (PARK.x0 + PARK.x1) / 2, CZ = (PARK.z0 + PARK.z1) / 2, Y0 = PARK.y;
const UP = new THREE.Vector3(0, 1, 0);

// ---------------- 롤러코스터 ----------------
// 정거장 → 체인 리프트로 천천히 올라가 → 중력으로 내리꽂고 언덕·급커브를 지나 → 정거장으로
const COASTER_PTS = [
  [-95, 70, 3], [-60, 72, 3], [-30, 72, 9], [5, 72, 22], [35, 70, 33], [58, 62, 34], [78, 40, 18], [88, 12, 4],
  [80, -20, 6], [55, -45, 20], [25, -55, 10], [-5, -50, 5], [-35, -62, 21], [-70, -55, 12], [-105, -35, 4],
  [-118, 0, 9], [-112, 35, 18], [-108, 58, 8],
];
const DWELL = 12; // 정거장에서 기다리는 시간 (탑승 가능)
function buildCoaster(root) {
  const pts = COASTER_PTS.map(([x, z, y]) => new THREE.Vector3(CX + x, Y0 + y, CZ + z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  const N = 900;
  const sp = curve.getSpacedPoints(N);
  const L = curve.getLength();
  // 속도: 출발~꼭대기는 체인 리프트(5m/s), 그 뒤는 높이에 따라 (마찰 조금)
  let top = 0;
  for (let i = 0; i < N; i++) if (sp[i].y > sp[top].y) top = i;
  const ds = L / N;
  const times = [0];
  const yTop = sp[top].y;
  for (let i = 0; i < N; i++) {
    const v = i < top ? 5 : Math.max(5, Math.sqrt(4 + 2 * 9.8 * (yTop - sp[i].y)) * 0.93);
    times.push(times[i] + ds / v);
  }
  const runT = times[N];
  const cycle = runT + DWELL;
  // 레일 + 침목 + 기둥
  const g = new THREE.Group(); root.add(g);
  const rail = new THREE.MeshToonMaterial({ color: '#e53935' }), wood = toon('#8d6e63'), steel = toon('#b0bec5');
  for (const off of [-0.55, 0.55]) {
    const opts = [];
    for (let i = 0; i <= N; i++) {
      const t = curve.getTangentAt(i / N), side = new THREE.Vector3().crossVectors(t, UP).normalize();
      opts.push(sp[i % N].clone().addScaledVector(side, off));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(opts, true), N, 0.12, 5, true), rail));
  }
  for (let i = 0; i < N; i += 3) {
    const p = sp[i], t = curve.getTangentAt(i / N);
    const tie = box(g, 1.4, 0.1, 0.25, wood, p.x, p.y - 0.12, p.z, { cast: false });
    tie.rotation.y = Math.atan2(t.x, t.z);
    if (i % 12 === 0 && p.y > Y0 + 1) cyl(g, 0.16, p.y - Y0, steel, p.x, Y0 + (p.y - Y0) / 2, p.z, { low: true });
  }
  // 정거장 지붕
  const st = sp[0];
  const stat = new THREE.Group(); stat.position.set(st.x + 10, Y0, st.z); root.add(stat);
  box(stat, 26, 0.4, 6, '#ffe0b2', 0, 0.2, 0);
  for (const x of [-12, 12]) for (const z of [-2.6, 2.6]) cyl(stat, 0.2, 5, '#6d4c41', x, 2.7, z);
  box(stat, 27, 0.4, 7, '#d32f2f', 0, 5.3, 0);
  const sg = signMesh('젤리 익스프레스 롤러코스터', '🎢', 10, '#d32f2f', '#ffffff'); sg.position.set(0, 6.4, 3.6); stat.add(sg);
  // 열차: 3칸, 칸마다 2자리
  const cars = [];
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Group(); root.add(c);
    box(c, 1.6, 0.7, 2.2, k === 0 ? '#ffd54f' : '#ffb300', 0, 0.45, 0);
    box(c, 1.5, 0.5, 0.15, '#263238', 0, 0.95, 0.9);
    for (const sx of [-0.4, 0.4]) box(c, 0.6, 0.15, 0.7, '#455a64', sx, 0.85, -0.1);
    cars.push(c);
  }
  const at = (u) => { // u: 0..1 → 위치, 방향
    const i = ((u % 1) + 1) % 1 * N;
    const a = Math.floor(i), f = i - a;
    const p = sp[a % N].clone().lerp(sp[(a + 1) % N], f);
    return { p, t: curve.getTangentAt(((u % 1) + 1) % 1) };
  };
  // 시각 → 앞칸 위치 (u)
  const headU = (T) => {
    const c = ((T % cycle) + cycle) % cycle;
    if (c < DWELL) return 0;
    const rt = c - DWELL;
    let lo = 0, hi = N;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (times[mid] <= rt) lo = mid; else hi = mid - 1; }
    const f = Math.min(1, (rt - times[lo]) / ((times[lo + 1] ?? runT) - times[lo] || 1));
    return (lo + f) / N;
  };
  const spacing = 2.6 / L;
  const carPose = (k, T) => {
    const { p, t } = at(headU(T) - k * spacing);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.clone().normalize());
    return { p, q, heading: Math.atan2(t.x, t.z) };
  };
  return {
    id: 'coaster', name: '롤러코스터', emoji: '🎢', station: new THREE.Vector3(st.x + 10, Y0, st.z - 4.5), seats: 6, fun: 5,
    update(T) { cars.forEach((c, k) => { const { p, q } = carPose(k, T); c.position.copy(p); c.quaternion.copy(q); }); },
    seat(i, T) {
      const k = Math.floor(i / 2), sx = i % 2 ? 0.4 : -0.4;
      const { p, q, heading } = carPose(k, T);
      return { pos: new THREE.Vector3(sx, 0.85, -0.1).applyQuaternion(q).add(p), q, yaw: 0, heading };
    },
    boardable: (T) => ((T % cycle) + cycle) % cycle < DWELL - 1.5,
    wait: (T) => Math.ceil(cycle - (((T % cycle) + cycle) % cycle)),
    // 정거장을 떠난 뒤 다시 들어오면 끝
    done: (T, t0) => T - t0 > DWELL && ((T % cycle) + cycle) % cycle < DWELL && T - t0 > runT * 0.5,
  };
}

// ---------------- 바이킹 ----------------
const VK = { x: CX + 40, z: CZ + 40, pivot: 14, period: 5.2, cycle: 44 };
function vikingAngle(T) {
  const c = ((T % VK.cycle) + VK.cycle) % VK.cycle;
  // 0~9초: 정지(탑승) → 점점 크게 → 최대 70° → 점점 작게
  if (c < 9) return 0;
  const t = c - 9, dur = VK.cycle - 9;
  const amp = Math.min(1, t / 10) * Math.min(1, (dur - t) / 9) * 1.22;
  return Math.sin((t / VK.period) * Math.PI * 2) * amp;
}
function buildViking(root) {
  const g = new THREE.Group(); g.position.set(VK.x, Y0, VK.z); root.add(g);
  // A자 기둥
  for (const sx of [-4.2, 4.2]) for (const sz of [-1, 1]) { const leg = cyl(g, 0.35, 15.5, '#37474f', sx + sz * 3.4, 7.2, 0); leg.rotation.z = -sz * 0.24; }
  cyl(g, 0.3, 9.4, '#263238', 0, VK.pivot, 0, { rz: Math.PI / 2 });
  const swing = new THREE.Group(); swing.position.y = VK.pivot; g.add(swing);
  for (const sz of [-1, 1]) { const arm = cyl(swing, 0.18, 11, '#546e7a', 0, -5.5, sz * 2.6); arm.rotation.x = sz * 0.22; }
  const ship = new THREE.Group(); ship.position.y = -11; swing.add(ship);
  box(ship, 3.6, 1.6, 15, '#8d4b2a', 0, 0, 0);
  box(ship, 3.8, 0.3, 15.2, '#ffca28', 0, 0.85, 0);
  for (const sz of [-1, 1]) { const end = box(ship, 3.4, 3, 1.4, '#8d4b2a', 0, 1.3, sz * 7.6); end.rotation.x = -sz * 0.3; }
  const mast = cyl(ship, 0.15, 6, '#5d4037', 0, 3.5, 0); void mast;
  const sail = box(ship, 0.05, 3.2, 4, '#fafafa', 0, 4.6, 0); void sail;
  const flag = signMesh('바이킹', '🏴‍☠️', 3.5, '#212121', '#ffffff'); flag.position.set(0, 6.8, 0); flag.rotation.y = Math.PI / 2; ship.add(flag);
  const seatZ = [-5.4, -3.6, -1.8, 1.8, 3.6, 5.4];
  for (const z of seatZ) for (const sx of [-0.9, 0.9]) box(ship, 1.2, 0.25, 0.9, '#3e2723', sx, 0.95, z);
  return {
    id: 'viking', name: '바이킹', emoji: '🏴‍☠️', station: new THREE.Vector3(VK.x + 6, Y0, VK.z), seats: 12, fun: 4,
    update(T) { swing.rotation.x = vikingAngle(T); },
    seat(i, T) {
      swing.rotation.x = vikingAngle(T); g.updateMatrixWorld(true);
      const p = new THREE.Vector3(i % 2 ? 0.9 : -0.9, 1.1, seatZ[Math.floor(i / 2) % seatZ.length]);
      ship.localToWorld(p);
      const q = ship.getWorldQuaternion(new THREE.Quaternion());
      return { pos: p, q, yaw: i % 2 ? -Math.PI / 2 : Math.PI / 2 };
    },
    boardable: (T) => ((T % VK.cycle) + VK.cycle) % VK.cycle < 7.5,
    wait: (T) => Math.ceil(VK.cycle - (((T % VK.cycle) + VK.cycle) % VK.cycle)),
    done: (T, t0) => T - t0 > 12 && ((T % VK.cycle) + VK.cycle) % VK.cycle < 8,
  };
}

// ---------------- 관람차 ----------------
const FW = { x: CX - 20, z: CZ - 75, r: 14, n: 12, period: 72 };
function buildFerris(root) {
  const g = new THREE.Group(); g.position.set(FW.x, Y0, FW.z); root.add(g);
  const hub = FW.r + 2.5;
  for (const sx of [-1.6, 1.6]) for (const sz of [-1, 1]) { const leg = cyl(g, 0.3, hub + 0.6, '#eceff1', sx, hub / 2, sz * 4.6); leg.rotation.x = sz * 0.3; }
  const wheel = new THREE.Group(); wheel.position.y = hub; g.add(wheel);
  const rimMat = toon('#ff4081');
  for (const sx of [-1.2, 1.2]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(FW.r, 0.18, 6, 48), rimMat); rim.rotation.y = Math.PI / 2; rim.position.x = sx; wheel.add(rim);
  }
  for (let i = 0; i < FW.n; i++) { const sp = box(wheel, 0.12, FW.r * 2, 0.12, '#f8bbd0', 0, 0, 0, { cast: false }); sp.rotation.x = (i / FW.n) * Math.PI; }
  const cols = ['#ef5350', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc', '#ff7043'];
  const gondolas = [];
  for (let i = 0; i < FW.n; i++) {
    const c = new THREE.Group(); g.add(c);
    box(c, 2.2, 1.6, 2.2, cols[i % cols.length], 0, -1.2, 0);
    box(c, 2.3, 0.2, 2.3, '#fafafa', 0, -0.3, 0);
    cyl(c, 0.06, 0.6, '#9e9e9e', 0, 0, 0, { low: true });
    gondolas.push(c);
  }
  const ang = (i, T) => (T / FW.period) * Math.PI * 2 + (i / FW.n) * Math.PI * 2;
  const gpos = (i, T) => { const a = ang(i, T); return new THREE.Vector3(FW.x, Y0 + hub - Math.cos(a) * FW.r, FW.z + Math.sin(a) * FW.r); };
  const step = FW.period / FW.n;
  return {
    id: 'ferris', name: '관람차', emoji: '🎡', station: new THREE.Vector3(FW.x + 5, Y0, FW.z), seats: FW.n, fun: 2,
    update(T) { wheel.rotation.x = -(T / FW.period) * Math.PI * 2; gondolas.forEach((c, i) => c.position.copy(gpos(i, T))); },
    // 맨 아래에 온 곤돌라에 탄다
    pickSeat(T) { let best = 0, bd = 9; for (let i = 0; i < FW.n; i++) { const a = ((ang(i, T) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); const d = Math.min(a, Math.PI * 2 - a); if (d < bd) { bd = d; best = i; } } return best; },
    seat(i, T) { return { pos: gpos(i, T).add(new THREE.Vector3(0, -1.65, 0)), q: new THREE.Quaternion(), yaw: -Math.PI / 2 }; },
    boardable: (T) => { const a = ((ang(0, T) % (Math.PI * 2 / FW.n)) + Math.PI * 2 / FW.n) % (Math.PI * 2 / FW.n); return a < 0.12 || a > Math.PI * 2 / FW.n - 0.06; },
    wait: (T) => Math.ceil(step - (((T % step) + step) % step)),
    done: (T, t0) => T - t0 > FW.period - 0.5,
  };
}

// ---------------- 회전목마 ----------------
const CR = { x: CX - 80, z: CZ - 20, r: 6, n: 12, period: 16 };
function buildCarousel(root) {
  const g = new THREE.Group(); g.position.set(CR.x, Y0, CR.z); root.add(g);
  cyl(g, CR.r + 0.6, 0.5, '#f8bbd0', 0, 0.25, 0);
  cyl(g, 0.6, 6, '#ffd54f', 0, 3, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(CR.r + 1.2, 2.6, 16), toon('#e91e63')); roof.position.y = 7; g.add(roof);
  sph(g, 0.5, 0.5, 0.5, '#ffd54f', 0, 8.5, 0);
  const deck = new THREE.Group(); g.add(deck);
  const horses = [];
  const hc = ['#ffffff', '#ffe0b2', '#f8bbd0', '#b3e5fc'];
  for (let i = 0; i < CR.n; i++) {
    const a = (i / CR.n) * Math.PI * 2;
    const pole = cyl(deck, 0.06, 6, '#ffd54f', Math.sin(a) * (CR.r - 1), 3.3, Math.cos(a) * (CR.r - 1), { low: true }); void pole;
    const h = new THREE.Group(); h.position.set(Math.sin(a) * (CR.r - 1), 1.5, Math.cos(a) * (CR.r - 1)); h.rotation.y = a + Math.PI / 2; deck.add(h);
    const c = hc[i % hc.length];
    box(h, 0.5, 0.6, 1.4, c, 0, 0, 0); box(h, 0.35, 0.8, 0.4, c, 0, 0.5, 0.65); box(h, 0.3, 0.3, 0.55, c, 0, 0.85, 0.85);
    for (const [x, z] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) box(h, 0.12, 0.7, 0.12, c, x, -0.55, z);
    box(h, 0.08, 0.6, 0.5, '#ff7043', 0, 0.75, 0.4);
    horses.push(h);
  }
  const bob = (i, T) => 1.5 + Math.sin(T * 2.2 + i * 1.3) * 0.35;
  return {
    id: 'carousel', name: '회전목마', emoji: '🎠', station: new THREE.Vector3(CR.x + CR.r + 2.5, Y0, CR.z), seats: CR.n, fun: 2,
    update(T) { deck.rotation.y = (T / CR.period) * Math.PI * 2; horses.forEach((h, i) => { h.position.y = bob(i, T); }); },
    pickSeat() { return Math.floor(Math.random() * CR.n); },
    seat(i, T) {
      deck.rotation.y = (T / CR.period) * Math.PI * 2; horses[i].position.y = bob(i, T);
      g.updateMatrixWorld(true);
      const p = horses[i].localToWorld(new THREE.Vector3(0, 0.35, -0.1));
      return { pos: p, q: horses[i].getWorldQuaternion(new THREE.Quaternion()), yaw: 0 };
    },
    boardable: () => true,
    wait: () => 0,
    done: (T, t0) => T - t0 > CR.period * 2,
  };
}

// ---------------- 입구 · 장식 ----------------
function buildDecor(root) {
  const gate = new THREE.Group(); gate.position.set(PARK.x1 - 2, Y0, 75); gate.rotation.y = Math.PI / 2; root.add(gate);
  for (const s of [-1, 1]) { cyl(gate, 0.8, 9, s < 0 ? '#e91e63' : '#29b6f6', s * 8, 4.5, 0); sph(gate, 1.3, 1.3, 1.3, '#ffd54f', s * 8, 9.6, 0); }
  box(gate, 17, 2.2, 1, '#7e57c2', 0, 8.2, 0);
  for (const ry of [0, Math.PI]) { const sg = signMesh('젤리랜드', '🎢', 12, '#7e57c2', '#ffffff'); sg.position.set(0, 8.2, ry ? -0.55 : 0.55); sg.rotation.y = ry; gate.add(sg); }
  // 울타리
  const fence = toon('#ffccbc');
  const W = PARK.x1 - PARK.x0, D = PARK.z1 - PARK.z0;
  box(root, W, 1.2, 0.3, fence, CX, Y0 + 0.6, PARK.z0);
  box(root, W, 1.2, 0.3, fence, CX, Y0 + 0.6, PARK.z1);
  box(root, 0.3, 1.2, D, fence, PARK.x0, Y0 + 0.6, CZ);
  box(root, 0.3, 1.2, 75 - 10 - PARK.z0, fence, PARK.x1, Y0 + 0.6, (PARK.z0 + 65) / 2);
  box(root, 0.3, 1.2, PARK.z1 - 85, fence, PARK.x1, Y0 + 0.6, (PARK.z1 + 85) / 2);
  // 풍선 다발과 솜사탕 노점
  const bc = ['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff', '#e040fb'];
  for (let i = 0; i < 10; i++) {
    const x = CX + Math.sin(i * 2.4) * 60, z = CZ + Math.cos(i * 1.7) * 60;
    cyl(root, 0.02, 4, '#eeeeee', x, Y0 + 2, z, { low: true, cast: false });
    for (let k = 0; k < 3; k++) sph(root, 0.45, 0.55, 0.45, bc[(i + k) % bc.length], x + (k - 1) * 0.5, Y0 + 4.3 + (k % 2) * 0.4, z, { low: true });
  }
  const stall = new THREE.Group(); stall.position.set(PARK.x1 - 18, Y0, 95); root.add(stall);
  box(stall, 4, 2.2, 2.5, '#ffffff', 0, 1.1, 0);
  box(stall, 4.6, 0.3, 3, '#f06292', 0, 2.9, 0);
  sph(stall, 0.6, 0.6, 0.6, '#f8bbd0', 1, 3.5, 0); sph(stall, 0.5, 0.5, 0.5, '#b3e5fc', -1, 3.4, 0);
  const sg = signMesh('솜사탕', '🍭', 3.5, '#f06292', '#ffffff'); sg.position.set(0, 2.2, 1.3); stall.add(sg);
}

export function buildPark(scene) {
  const root = new THREE.Group(); scene.add(root);
  buildDecor(root);
  const rides = [buildCoaster(root), buildViking(root), buildFerris(root), buildCarousel(root)];
  return {
    root, rides,
    update() { const T = now(); for (const r of rides) r.update(T); },
    near(pos, d = 4.5) { return rides.find((r) => Math.hypot(r.station.x - pos.x, r.station.z - pos.z) < d) || null; },
    now,
  };
}
