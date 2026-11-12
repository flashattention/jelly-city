// 서울 산책: 길 위 차량 (차 · 택시 · 버스)
//   hangang.js 에서 떼어 냈다 (8-27). 가까운 차는 3D 로 찻길 오른쪽 차로를 달리고, 먼 찻길엔 밤 불빛 점이 흐른다
//   hg.traffic = new Traffic(hg) · 실시간 버스(hangang-transit.js)와는 따로
import * as THREE from 'three';
import { isPhone } from '../../shared/js/perf.js';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function unpack(arr, S) { const out = []; for (let i = 0; i < arr.length; i += 2) out.push([arr[i] * S, arr[i + 1] * S]); return out; }

export class Traffic {
  constructor(hg) { this.hg = hg; this.list = []; this.spawnT = 0; this.far = []; this.farPts = null; }
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
  // 가까운 3D 차: 생기기 · 달리기 · 멀어지면 치우기
  tick(dt, px, pz) {
    const hg = this.hg, r = hg.r, h = hg.state.hour;
    // 차: 오른쪽 차로로, 출퇴근 시간엔 많고 밤엔 적게 · 앞에 곰돌이가 있으면 멈춘다
    const rush = (h >= 7 && h < 9.5) || (h >= 17 && h < 20), jam = { 원활: 1, 서행: 1.35, 정체: 1.7 }[hg.city?.road] || (rush ? 1.3 : 1), maxC = Math.round((isPhone ? 10 : 34) * jam * (h >= 23 || h < 6 ? 0.35 : 0.9)); hg.jamSpeed = hg.city?.roadSpd ? clamp(hg.city.roadSpd / 40, 0.25, 1.1) : 1;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.list.length < maxC && hg.driveLines.length) {
      this.spawnT = 0.25 + r() * 0.4; const pk = hg.pickNear(hg.driveGrid, hg.driveLines, px, pz, 70, 320, r);
      if (pk) {
        const L = pk.L, dir = r() < 0.5 ? 1 : -1, lanes = Math.max(1, Math.floor(L.w / 7)), lane = Math.floor(r() * lanes), off = dir * (1.8 + lane * 3.3);
        const x = r(), kind = x < 0.08 && L.w >= 14 ? 'bus' : x < 0.24 ? 'taxi' : 'car';
        const mesh = makeVehicle(kind, r); hg.scene.add(mesh);
        this.list.push({ L, d: pk.d, dir, off, v: (kind === 'bus' ? 9 : 10 + r() * 5) * (hg.jamSpeed || 1), mesh, kind, r: kind === 'bus' ? 2.6 : 1.7 });
      }
    }
    const night = hg.light?.night || 0;
    for (const c of this.list) {
      const q = hg.lineAt(c.L, c.d, c.off), fx = q.dx * c.dir, fz = q.dz * c.dir;
      const ax = px - q.x, az = pz - q.z, ahead = ax * fx + az * fz, sideD = Math.abs(ax * -fz + az * fx);
      c.vMax ??= c.v; const want = ahead > 0 && ahead < 9 && sideD < 2.2 && hg.y < 2 ? 0 : c.vMax;
      c.cur = (c.cur ?? c.vMax) + (want - (c.cur ?? c.vMax)) * Math.min(1, dt * 3);
      c.d += c.dir * c.cur * dt; if (c.d < 0 || c.d > c.L.len) { c.dir *= -1; c.off = -c.off; c.d = clamp(c.d, 0, c.L.len); }
      c.mesh.position.set(q.x, 0, q.z); c.mesh.rotation.y = Math.atan2(fx, fz);
      c.mesh.userData.lights.material.emissiveIntensity = 0.3 + night * 2.5;
    }
    for (const c of [...this.list]) if (Math.hypot(c.mesh.position.x - px, c.mesh.position.z - pz) > 360) { hg.scene.remove(c.mesh); this.list.splice(this.list.indexOf(c), 1); }
  }
  // 부딪힘 동그라미 (곰 둘레)
  circles(x, z, out) {
    for (const c of this.list) if (c.mesh && Math.abs(c.mesh.position.x - x) < 8 && Math.abs(c.mesh.position.z - z) < 8) out.push({ x: c.mesh.position.x, z: c.mesh.position.z, r: c.r || 1.6, h: 2 });
  }
  clear() { for (const c of this.list) this.hg.scene.remove(c.mesh); this.list = []; }
}

const CAR_COLORS = ['#f4f4f2', '#f4f4f2', '#1d1d1f', '#9aa0a6', '#c9ccd0', '#2a3a5a', '#7a1d22', '#3d4a3a', '#d8d2c4'];
function makeVehicle(kind, r, busColor = null, routeNo = '') {
  const g = new THREE.Group(), M2 = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const L = kind === 'bus' ? 11 : 4.5, W = kind === 'bus' ? 2.5 : 1.8, H = kind === 'bus' ? 2.9 : 0.75;
  const color = kind === 'taxi' ? (r() < 0.6 ? '#f39a2b' : '#f4f4f2') : kind === 'bus' ? busColor || ['#3a63b8', '#47a83c', '#3a63b8', '#47a83c', '#d8352a'][Math.floor(r() * 5)] : CAR_COLORS[Math.floor(r() * CAR_COLORS.length)];
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), M2(color)); body.position.y = 0.35 + H / 2; g.add(body);
  if (kind === 'bus') { const win = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.9, L - 1.2), M2('#2a3442')); win.position.set(0, 2.25, 0.2); g.add(win); const roof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.25, L - 0.6), M2('#e8e8e8')); roof.position.y = 3.37; g.add(roof); }
  if (kind === 'bus' && routeNo) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 40; const c2 = cv.getContext('2d'); c2.fillStyle = '#111'; c2.fillRect(0, 0, 128, 40); c2.fillStyle = '#ffb020'; c2.font = 'bold 30px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(routeNo, 64, 22); const t = new THREE.CanvasTexture(cv); const sm = new THREE.MeshBasicMaterial({ map: t }); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), sm); f.position.set(0, 2.95, L / 2 + 0.02); g.add(f); const sd = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), sm); sd.position.set(W / 2 + 0.02, 2.95, 2); sd.rotation.y = Math.PI / 2; g.add(sd); }
  else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.15, 0.6, L * 0.52), M2('#24303c')); cab.position.set(0, 0.35 + H + 0.3, -0.15); g.add(cab);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W - 0.25, 0.06, L * 0.46), M2(color)); top.position.set(0, 0.35 + H + 0.62, -0.15); g.add(top);
    if (kind === 'taxi') { const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.25), M2('#ffd84a', { emissive: '#ffb020', emissiveIntensity: 0.6 })); sign.position.set(0, 0.35 + H + 0.76, -0.15); g.add(sign); }
  }
  const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12); wg.rotateZ(Math.PI / 2); const wm = M2('#1a1a1c');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(wg, wm); w.position.set(sx * (W / 2 - 0.05), 0.34, sz * (L / 2 - (kind === 'bus' ? 2.0 : 0.85))); g.add(w); }
  const lm = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fff4d8', emissiveIntensity: 0.3 }), tm = new THREE.MeshLambertMaterial({ color: '#8a1010', emissive: '#ff2a1a', emissiveIntensity: 0.8 });
  for (const sx of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.05), lm); hl.position.set(sx * (W / 2 - 0.35), 0.75, L / 2 + 0.01); g.add(hl); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.05), tm); tl.position.set(sx * (W / 2 - 0.35), 0.8, -L / 2 - 0.01); g.add(tl); }
  g.userData.lights = { material: lm };
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
