// 서울 산책: 길 위 차량 (8-27)
//   가까운 차는 3D 로 찻길 오른쪽 차로를 달리고, 먼 찻길엔 밤 불빛 점이 흐른다
//   차 종류 · 모양은 hangang-vehicle-models.js. 종류마다 인스턴스 그물 하나(가까운 것 · 먼 것) → 그리기 호출이 차 수와 상관없다
//   hg.traffic = new Traffic(hg) · 실시간 버스(hangang-transit.js)와는 따로
import * as THREE from 'three';
import { isPhone } from '../../shared/js/perf.js';
import { TYPES, vehicleGeo, vehicleMat, VU, pickColor, ROUTES } from './hangang-vehicle-models.js';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function unpack(arr, S) { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([arr[i] * S, arr[i + 1] * S]); return out; }

// 종류 비율 (서울 시내 실제 비율 비슷하게): [종류, 가중치, 길 조건]
//   wide = 폭 14m 넘는 큰길만 (시내 · 관광버스), narrow = 폭 16m 아래 (마을버스)
const MIX = [
  ['sedanM', 17], ['sedanL', 7], ['hatch', 8], ['light', 7], ['suvS', 7], ['suvM', 9], ['suvL', 4], ['minivan', 4],
  ['taxiO', 6], ['taxiW', 5], ['taxiB', 1.2], ['truckS', 3], ['truckBox', 2], ['parcel', 2], ['van', 2.2],
  ['police', 0.6], ['ambul', 0.35], ['fire', 0.15], ['mixer', 0.5], ['dump', 0.5],
  ['busCity', 4.5, 'wide'], ['busTown', 1.4, 'narrow'], ['busTour', 0.5, 'wide'], ['scooter', 4.5], ['moto', 1.2],
];
// 세워 둔 차 종류
const PARK = ['sedanM', 'sedanM', 'hatch', 'light', 'light', 'suvS', 'suvM', 'sedanL', 'minivan', 'van', 'truckS', 'truckBox', 'scooter', 'scooter'];
// 가까운 차만 자세한 그물 (m)
const NEAR_D = isPhone ? 38 : 60;
const M4 = new THREE.Matrix4(), QQ = new THREE.Quaternion(), EE = new THREE.Euler(0, 0, 0, 'YXZ'), PV = new THREE.Vector3(), SV = new THREE.Vector3(1, 1, 1);

// 바닥 그림자 · 전조등 불빛 그림 (둥근 · 앞으로 퍼지는)
function blobTex() { const N = 64, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), gr = g.createRadialGradient(N / 2, N / 2, 4, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); return new THREE.CanvasTexture(cv); }
function beamTex() { const W = 64, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); for (let y = 0; y < H; y++) { const t = y / H, w = W * (0.25 + 0.75 * t), a = Math.pow(1 - t, 1.6) * Math.min(1, t * 6); const gr = g.createLinearGradient((W - w) / 2, 0, (W + w) / 2, 0); gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(0.5, `rgba(255,240,210,${a})`); gr.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = gr; g.fillRect(0, H - 1 - y, W, 1); } return new THREE.CanvasTexture(cv); }

export class Traffic {
  constructor(hg) { this.hg = hg; this.list = []; this.spawnT = 0; this.far = []; this.farPts = null; this.meshes = new Map(); this.root = null; }
  // 먼 찻길 불빛 점 (지도 하나에 한 번): dotTex = 동그란 빛 그림 만드는 함수
  buildFar(r, dotTex) {
    const hg = this.hg;
    const cars = []; for (const rd of hg.map.roads) if (rd[0] >= 14 && !rd[1]) { const pts = unpack(rd.slice(2), hg.map.scale); if (pts.length > 1) cars.push(pts); }
    this.farLines = cars; const cN = isPhone ? 260 : 600, cp = new Float32Array(cN * 3), cc = new Float32Array(cN * 3);
    this.far = []; for (let i = 0; i < cN; i++) { const line = cars[Math.floor(r() * cars.length)]; if (!line) break; this.far.push({ line, t: r(), v: (r() < 0.5 ? 1 : -1) * (0.00004 + r() * 0.00004), seg: 0 }); const cl = this.far[i].v > 0 ? [1, 0.95, 0.85] : [1, 0.25, 0.2]; cc.set(cl, i * 3); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    this.farPts = new THREE.Points(cg, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, map: hg.dot ||= dotTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })); hg.scene.add(this.farPts);
    for (const c of this.far) { const L = c.line.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - c.line[i - 1][0], p[1] - c.line[i - 1][1]) : 0), 0); c.len = L; c.v *= 3000 / Math.max(L, 50); }
  }
  tickFar(dt, lit) {
    const hg = this.hg; if (!this.farPts) return;
    this.farPts.material.opacity = 0.25 + lit * 0.75;
    const cp = this.farPts.geometry.attributes.position;
    for (let i = 0; i < this.far.length; i++) { const c = this.far[i]; c.t = (c.t + c.v * dt + 1) % 1; const want = c.t * c.len; let acc = 0, k = 1; const L = c.line; for (; k < L.length; k++) { const d = Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]); if (acc + d >= want) break; acc += d; } k = Math.min(k, L.length - 1); const a = L[k - 1], b = L[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = clamp((want - acc) / d, 0, 1); cp.setXYZ(i, lerp(a[0], b[0], t), 1, lerp(a[1], b[1], t)); }
    cp.needsUpdate = true;
  }

  // ---------- 그리기: 종류 · 단계마다 인스턴스 그물 하나 ----------
  setupDraw() {
    const hg = this.hg; if (this.root && this.root.parent === hg.scene) return;
    this.root = new THREE.Group(); this.root.userData.noDrape = true; hg.scene.add(this.root); this.meshes = new Map();
    const shM = new THREE.MeshBasicMaterial({ color: '#000000', map: blobTex(), transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    this.blob = new THREE.InstancedMesh(sg, shM, 96); this.blob.frustumCulled = false; this.blob.renderOrder = -30; this.root.add(this.blob);
    const bm = new THREE.MeshBasicMaterial({ color: '#fff0d2', map: beamTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2); bg.translate(0, 0, 0.5);
    this.beam = new THREE.InstancedMesh(bg, bm, 48); this.beam.frustumCulled = false; this.beam.renderOrder = -29; this.root.add(this.beam);
  }
  mesh(key, lod, need, empty = false) {
    const k = key + (lod ? 'n' : 'f') + (empty ? 'e' : ''); let m = this.meshes.get(k);
    if (m && m.instanceMatrix.count >= need) return m;
    const cap = Math.max(8, 1 << Math.ceil(Math.log2(need + 1)));
    if (m) { this.root.remove(m); m.dispose(); }
    const g = vehicleGeo(key, lod, empty).clone();
    g.setAttribute('iSt', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCell', new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage));
    m = new THREE.InstancedMesh(g, vehicleMat(), cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color()); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.count = 0; m.userData.noDrape = true; m.userData.lod = lod; this.root.add(m); this.meshes.set(k, m); return m;
  }
  // ---------- 차 한 대 만들기 ----------
  pickType(L, r) {
    const h = this.hg.state.hour, night = h >= 22 || h < 5;
    const list = MIX.filter(([, , cond]) => (cond === 'wide' ? L.w >= 14 : cond === 'narrow' ? L.w < 16 : true)).map(([k, w]) => {
      const c = TYPES[k].cat; let k2 = w;
      if (night) k2 *= c === 'truck' ? 0.35 : c === 'bus' ? 0.5 : k.startsWith('taxi') ? 2.2 : c === 'bike' ? 1.3 : 1;
      if (L.w < 12 && (k === 'mixer' || k === 'dump' || k === 'fire' || k === 'busTour')) k2 *= 0.2;
      return [k, k2];
    });
    let s = r() * list.reduce((a, b) => a + b[1], 0); for (const [k, w] of list) { s -= w; if (s <= 0) return k; } return 'sedanM';
  }
  spawn(L, d, dir, r, opt = {}) {
    const key = opt.key || this.pickType(L, r), t = TYPES[key], lanes = Math.max(1, Math.floor(L.w / 7));
    let lane = Math.floor(r() * lanes);
    if (t.cat === 'bus') lane = L.w >= 30 ? 0 : lanes - 1;
    let off = dir * (1.8 + lane * 3.3);
    if (t.cat === 'bike') off += dir * (r() < 0.6 ? 0.9 : -0.6);
    const base = t.cat === 'bus' ? 9 : t.cat === 'truck' ? 9.5 + r() * 2.5 : t.cat === 'bike' ? 11 + r() * 4 : 10 + r() * 5;
    const v = { key, t, L, d, dir, off, vMax: base * (this.hg.jamSpeed || 1), cur: 0, x: 0, z: 0, yaw: 0, roll: 0, pitch: 0, y: 0, init: false,
      col: new THREE.Color(pickColor(t, r)), plate: Math.floor(r() * 32) + (t.commercial ? 32 : 0), route: Math.floor(r() * ROUTES.length),
      head: 0, brake: 0, blink: 0, siren: t.siren && r() < t.siren * 0.6 ? 1 : 0, len: t.L, hw: t.W / 2, next: null, ...opt.extra };
    v.cur = v.vMax; this.list.push(v); return v;
  }
  // 찻길 끝: 끝점 14m 안에서 시작하거나 끝나는 다른 찻길로 (곧은 쪽을 더 자주), 없으면 돌아서
  pickNext(v) {
    const hg = this.hg, L = v.L, end = v.dir > 0 ? L.pts[L.pts.length - 1] : L.pts[0], prev = v.dir > 0 ? L.pts[L.pts.length - 2] : L.pts[1];
    const hx = end[0] - prev[0], hz = end[1] - prev[1], hl = Math.hypot(hx, hz) || 1, cand = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [li, i] of hg.driveGrid?.get(`${Math.floor(end[0] / 50) + a},${Math.floor(end[1] / 50) + b}`) || []) {
      const M = hg.driveLines[li]; if (!M || M === L || (i !== 0 && i !== M.pts.length - 1)) continue;
      const p = M.pts[i]; if (Math.hypot(p[0] - end[0], p[1] - end[1]) > 14) continue;
      const q = i === 0 ? M.pts[1] : M.pts[M.pts.length - 2], nx = q[0] - p[0], nz = q[1] - p[1], nl = Math.hypot(nx, nz) || 1, dot = (hx * nx + hz * nz) / (hl * nl);
      if (dot < -0.35) continue;
      cand.push({ M, dir: i === 0 ? 1 : -1, d: i === 0 ? 0 : M.len, w: 0.4 + Math.max(0, dot) * 2, turn: (hx * nz - hz * nx) / (hl * nl) });
    }
    if (!cand.length) return null;
    let s = Math.random() * cand.reduce((a, c) => a + c.w, 0); for (const c of cand) { s -= c.w; if (s <= 0) return c; } return cand[0];
  }
  // ---------- 매 프레임 ----------
  tick(dt, px, pz) {
    const hg = this.hg, r = hg.r, h = hg.state.hour;
    // 역 · 가게 · 몰 안에선 멈춘다 (바깥 것은 hangang.js 가 숨긴다)
    if (hg.inside || hg.inShop || hg.inMall) return;
    this.setupDraw();
    // 차: 오른쪽 차로로, 출퇴근 시간엔 많고 밤엔 적게 · 앞에 곰돌이가 있으면 멈춘다
    const rush = (h >= 7 && h < 9.5) || (h >= 17 && h < 20), jam = { 원활: 1, 서행: 1.35, 정체: 1.7 }[hg.city?.road] || (rush ? 1.3 : 1), maxC = Math.round((isPhone ? 14 : 56) * jam * (h >= 23 || h < 6 ? 0.35 : 0.9)); hg.jamSpeed = hg.city?.roadSpd ? clamp(hg.city.roadSpd / 40, 0.25, 1.1) : 1;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.list.filter((v) => !v.parked).length < maxC && hg.driveLines?.length) {
      // 큰길(폭 20m 넘게)에 더 많이: 좁은 길이 뽑히면 반은 다시 뽑는다
      this.spawnT = 0.15 + r() * 0.25; let pk = hg.pickNear(hg.driveGrid, hg.driveLines, px, pz, 55, 300, r);
      if (pk && pk.L.w < 20 && r() < 0.5) pk = hg.pickNear(hg.driveGrid, hg.driveLines, px, pz, 55, 300, r);
      if (pk) this.spawn(pk.L, pk.d, r() < 0.5 ? 1 : -1, r);
    }
    // 세워 둔 차: 좁은 길 가장자리에 (골목마다 차가 서 있다), 겹치거나 건물에 닿으면 안 만든다
    this.parkT = (this.parkT || 0) - dt;
    if (this.parkT <= 0 && hg.driveLines?.length) {
      this.parkT = 0.4; let np = 0; for (const v of this.list) if (v.parked && !v.player) np++;
      const pk = np < (isPhone ? 4 : 12) ? hg.pickNear(hg.driveGrid, hg.driveLines, px, pz, 25, 160, r) : null;
      if (pk && pk.L.w >= 8 && pk.L.w < 22 && pk.d > 10 && pk.d < pk.L.len - 10) {
        const sg = r() < 0.5 ? 1 : -1, key = PARK[Math.floor(r() * PARK.length)], off = sg * (pk.L.w / 2 - (TYPES[key].W / 2 + 0.35)), q = hg.lineAt(pk.L, pk.d, off);
        const clash = this.list.some((o) => Math.hypot(o.x - q.x, o.z - q.z) < 6.5) || hg.pushOut(q.x, q.z, 0.4, TYPES[key].W / 2).hit || !hg.walkable(q.x, q.z, 0);
        if (!clash) { const v = this.spawn(pk.L, pk.d, sg, r, { key, extra: { parked: true, empty: true } }); v.off = off; v.x = q.x; v.z = q.z; v.yaw = Math.atan2(q.dx * sg, q.dz * sg); v.init = true; v.cur = 0; v.siren = 0; }
      }
    }
    const night = hg.light?.night || 0, headOn = night > 0.3 || hg.state.weather === 'rain' ? 1 : 0;
    VU.uTime.value = hg.t; VU.uNight.value = clamp(night * 1.3, 0, 1);
    for (const v of this.list) {
      if (v.player || v.parked) continue;
      // 앞차 · 곰돌이 앞에서 선다
      const q = hg.lineAt(v.L, v.d, v.off), fx = q.dx * v.dir, fz = q.dz * v.dir;
      let want = v.stopReq ? 0 : v.vMax, blocked = false;
      const ax = px - q.x, az = pz - q.z, ahead = ax * fx + az * fz, sideD = Math.abs(ax * -fz + az * fx);
      if (ahead > 0 && ahead < 6 + v.len / 2 && sideD < v.hw + 0.9 && hg.y < 2 && !hg.drive?.on) want = 0;
      for (const o of this.list) {
        if (o === v) continue;
        if (o.L === v.L && o.dir === v.dir && Math.abs(o.off - v.off) < 1.6) { const gap = (o.d - v.d) * v.dir - (o.len + v.len) / 2; if (gap > -1 && gap < 30) want = Math.min(want, Math.max(0, (gap - 2.2) / 1.3)); }
        else if (o.player || o.parked) { const dx = o.x - q.x, dz = o.z - q.z, fa = dx * fx + dz * fz, sd = Math.abs(dx * -fz + dz * fx); if (fa > 0 && fa < (o.len + v.len) / 2 + 7 && sd < o.hw + v.hw + 0.4) { blocked = true; want = Math.min(want, Math.max(0, (fa - (o.len + v.len) / 2 - 1.5) / 1.3)); if (o.player && fa < (o.len + v.len) / 2 + 4 && (v.honkT || 0) <= 0) { v.honkT = 4; hg.drive?.honked?.(v); } } }
      }
      v.honkT = Math.max(0, (v.honkT || 0) - dt);
      // 세워 둔 차 · 내 차에 3초 넘게 막히면 옆 차로로 (없으면 돌아서)
      v.stuck = blocked && v.cur < 0.6 ? (v.stuck || 0) + dt : 0;
      if (v.stuck > 3) { v.stuck = 0; const a = v.off + v.dir * 3.3, b = v.off - v.dir * 3.3, ok = (o2) => Math.sign(o2) === v.dir && Math.abs(o2) < v.L.w / 2 - 1; if (ok(a)) v.off = a; else if (ok(b)) v.off = b; else { v.dir *= -1; v.off = -v.off; } }
      v.brake = want < v.cur - 0.4 || v.cur < 0.3 ? 1 : 0;
      v.cur += (want - v.cur) * Math.min(1, dt * (want < v.cur ? 3.5 : 1.2));
      v.d += v.dir * v.cur * dt;
      // 끝 30m 전: 다음 길을 골라 깜빡이
      const rem = v.dir > 0 ? v.L.len - v.d : v.d;
      if (rem < 30 && v.next === null) { v.next = this.pickNext(v) || false; v.blink = v.next && Math.abs(v.next.turn) > 0.45 ? (v.next.turn > 0 ? 2 : 1) : 0; }
      if (rem <= 0) {
        const n = v.next; v.next = null; v.blink = 0;
        if (n) { v.L = n.M; v.dir = n.dir; v.d = n.d; v.off = Math.sign(n.dir) * Math.abs(v.off); }
        else { v.dir *= -1; v.off = -v.off; v.d = clamp(v.d, 0, v.L.len); }
      }
      // 자리 · 방향은 부드럽게 따라간다 (길을 갈아탈 때 순간이동 대신 미끄러지듯)
      const q2 = hg.lineAt(v.L, v.d, v.off), tyaw = Math.atan2(q2.dx * v.dir, q2.dz * v.dir);
      if (!v.init) { v.x = q2.x; v.z = q2.z; v.yaw = tyaw; v.init = true; }
      const k = Math.min(1, dt * 5); v.x += (q2.x - v.x) * k; v.z += (q2.z - v.z) * k;
      const dy = wrapA(tyaw - v.yaw); v.yaw += dy * Math.min(1, dt * 4);
      if (v.t.cat === 'bike') v.roll = lerp(v.roll, clamp(-dy * 2.2 * Math.min(1, v.cur / 8), -0.5, 0.5), Math.min(1, dt * 4));
      v.head = headOn;
    }
    // 멀어지면 치운다
    for (let i = this.list.length - 1; i >= 0; i--) { const v = this.list[i]; if (!v.player && !v.keep && Math.hypot(v.x - px, v.z - pz) > (v.parked ? 260 : 360)) this.list.splice(i, 1); }
    this.draw(px, pz, night);
  }
  // 인스턴스 쓰기: 지형 높이 · 앞뒤 기울기 · 오토바이 기울기
  draw(px, pz, night) {
    const hg = this.hg, cam = hg.camPos || { x: px, z: pz }, groups = new Map();
    for (const v of this.list) {
      if (!v.init || v.hidden) continue;
      const dd = Math.hypot(v.x - cam.x, v.z - cam.z), lod = dd < NEAR_D, empty = !!v.empty && v.t.cat === 'bike', k = v.key + (lod ? 'n' : 'f') + (empty ? 'e' : '');
      if (!groups.has(k)) groups.set(k, { key: v.key, lod, empty, list: [] }); groups.get(k).list.push(v); v.dist = dd;
    }
    for (const [k, m] of this.meshes) if (!groups.has(k)) { m.count = 0; m.visible = false; }
    let nb = 0, nl = 0;
    const terr = !!hg.terr, sh = this.blob, bm = this.beam;
    for (const [, G] of groups) {
      const m = this.mesh(G.key, G.lod, G.list.length, G.empty), st = m.geometry.attributes.iSt, ce = m.geometry.attributes.iCell;
      G.list.forEach((v, i) => {
        const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), hl = v.len * 0.4;
        let y = 0, pitch = 0; if (terr) { const a = hg.terrAt(v.x + fx * hl, v.z + fz * hl), b = hg.terrAt(v.x - fx * hl, v.z - fz * hl); y = (a + b) / 2; pitch = -Math.atan2(a - b, hl * 2); }
        v.y = y; v.pitch = pitch;
        EE.set(pitch + (v.bob || 0), v.yaw, v.roll); QQ.setFromEuler(EE); M4.compose(PV.set(v.x, y + (v.lift || 0), v.z), QQ, SV); m.setMatrixAt(i, M4); m.setColorAt(i, v.col);
        st.setXYZW(i, v.head, v.brake, v.blink, v.siren); ce.setXY(i, v.plate, v.route);
        if (nb < sh.instanceMatrix.count) { M4.compose(PV.set(v.x, y + 0.04, v.z), QQ.setFromEuler(EE.set(0, v.yaw, 0)), SV.set(v.t.W + 0.5, 1, v.len + 0.6)); sh.setMatrixAt(nb++, M4); SV.set(1, 1, 1); }
        if (v.head && v.dist < 140 && nl < bm.instanceMatrix.count && v.t.cat !== 'bike') { M4.compose(PV.set(v.x + fx * v.len / 2, y + 0.05, v.z + fz * v.len / 2), QQ, SV.set(v.t.W * 2.3, 1, 13)); bm.setMatrixAt(nl++, M4); SV.set(1, 1, 1); }
      });
      m.count = G.list.length; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; st.needsUpdate = true; ce.needsUpdate = true;
    }
    sh.count = nb; sh.instanceMatrix.needsUpdate = true; sh.visible = nb > 0;
    bm.count = nl; bm.instanceMatrix.needsUpdate = true; bm.material.opacity = clamp((night - 0.3) * 0.5, 0, 0.32); bm.visible = nl > 0 && bm.material.opacity > 0.01;
  }
  // 부딪힘 동그라미 (곰 둘레): 긴 차는 앞뒤로 여러 개
  circles(x, z, out) {
    for (const v of this.list) {
      if (!v.init || v.hidden || v.player || Math.abs(v.x - x) > 14 || Math.abs(v.z - z) > 14) continue;
      const n = Math.max(1, Math.round(v.len / (v.hw * 2.2))), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : (i / (n - 1) - 0.5) * (v.len - v.hw * 2); out.push({ x: v.x + fx * k, z: v.z + fz * k, r: v.hw + 0.1, h: v.t.H }); }
    }
  }
  stats() { let near = 0, far = 0, calls = 0; for (const [k, m] of this.meshes) if (m.visible && m.count) { calls++; if (m.userData.lod) near += m.count; else far += m.count; } return { n: this.list.length, near, far, calls, types: this.meshes.size }; }
  clear() { this.list = []; for (const m of this.meshes.values()) { m.count = 0; m.visible = false; } }
}
