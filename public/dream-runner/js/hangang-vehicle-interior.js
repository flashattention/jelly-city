// 서울 산책: 차 안 (8-27-2)
//   내가 탄 차 한 대만 만든다. 바깥 몸통(유리 빼고) + 안쪽 내장(같은 면을 뒤집어 안쪽 색) + 엷은 유리
//   + 좌석(차마다 실제 배치) · 대시보드 · 계기판(속도 바늘 · 밤 조명) · 운전대 · 기어 · 백미러 · 해 가리개 · 버스 손잡이 기둥
//   좌표는 차와 같다 (앞 +z, 운전석 +x, 바닥 0)
import * as THREE from 'three';
import { TYPES, vehicleGeo, vehicleMat, VK, Build, T, topAt, halfW } from './hangang-vehicle-models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 창 아랫선 높이 (승용은 belt, 상자형은 운전석 눈높이에서)
export function beltOf(t) { return t.belt ?? (t.cat === 'bus' ? t.eye[1] - 0.55 : t.eye[1] - 0.5); }

// 바깥 몸통 그물에서 유리 · 나머지 나누기 (꼭짓점 종류 vk)
function split(src) {
  const P = src.attributes.position, vk = src.attributes.vk, keep = [], glass = [];
  for (let t = 0; t < P.count; t += 3) (vk.getX(t) === VK.glass ? glass : keep).push(t);
  const pick = (list) => { const g = new THREE.BufferGeometry(); for (const [name, a] of Object.entries(src.attributes)) { const n = a.itemSize, out = new Float32Array(list.length * 3 * n); list.forEach((t, i) => { for (let j = 0; j < 3; j++) for (let c = 0; c < n; c++) out[(i * 3 + j) * n + c] = a.array[(t + j) * n + c]; }); g.setAttribute(name, new THREE.BufferAttribute(out, n)); } return g; };
  return { body: pick(keep), glass: pick(glass) };
}
// 안쪽 내장: 면을 뒤집고 안으로 2.5cm, 높이에 따라 천장(밝은 천) · 문 안쪽(어두운 판 + 창틀 띠) · 바닥
function liner(body, t) {
  const g = body.clone(), P = g.attributes.position, N = g.attributes.normal, n = P.count, C = new Float32Array(n * 3), col = new THREE.Color(), belt = beltOf(t);
  for (let i = 0; i < n; i++) { P.setXYZ(i, P.getX(i) - N.getX(i) * 0.025, P.getY(i) - N.getY(i) * 0.025, P.getZ(i) - N.getZ(i) * 0.025); N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i)); }
  for (let tr = 0; tr < n; tr += 3) { const y = (P.getY(tr) + P.getY(tr + 1) + P.getY(tr + 2)) / 3; const ny = (N.getY(tr) + N.getY(tr + 1) + N.getY(tr + 2)) / 3; col.set(y > belt + 0.06 ? (ny < -0.6 ? '#d6d2ca' : '#6f6c66') : y > belt - 0.07 ? '#56595f' : y > 0.4 ? '#34363b' : '#242527'); for (let j = 0; j < 3; j++) col.toArray(C, (tr + j) * 3); const a = P.array, b = tr * 3; for (let c = 0; c < 3; c++) { const s = a[b + 3 + c]; a[b + 3 + c] = a[b + 6 + c]; a[b + 6 + c] = s; } const na = N.array; for (let c = 0; c < 3; c++) { const s = na[b + 3 + c]; na[b + 3 + c] = na[b + 6 + c]; na[b + 6 + c] = s; } }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g;
}
// 계기판 그림 (속도계 · 회전계 · 가운데 숫자) — 바늘은 그림에 다시 그린다
function gaugeCanvas() { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return { cv, g: cv.getContext('2d'), tex }; }
export function drawGauge(G, kmh, rpm, night, opt = {}) {
  const g = G.g, W = 512, H = 192; g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
  const glow = night > 0.3 ? '#9fd8ff' : '#e8eef4', dim = night > 0.3 ? '#2e5a7a' : '#5a6470';
  const dial = (cx, max, val, label, step) => {
    const R = 74, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25; g.lineWidth = 4; g.strokeStyle = dim; g.beginPath(); g.arc(cx, 100, R, a0, a1); g.stroke();
    g.fillStyle = glow; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= max; v += step) { const a = a0 + (a1 - a0) * (v / max); g.fillRect(cx + Math.cos(a) * (R - 6) - 1, 100 + Math.sin(a) * (R - 6) - 1, 3, 3); g.fillText(String(v), cx + Math.cos(a) * (R - 20), 100 + Math.sin(a) * (R - 20)); }
    const a = a0 + (a1 - a0) * clamp(val / max, 0, 1); g.strokeStyle = '#ff4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, 100); g.lineTo(cx + Math.cos(a) * (R - 8), 100 + Math.sin(a) * (R - 8)); g.stroke();
    g.fillStyle = '#ff4a2a'; g.beginPath(); g.arc(cx, 100, 7, 0, 7); g.fill(); g.fillStyle = dim; g.font = '12px sans-serif'; g.fillText(label, cx, 150);
  };
  dial(110, opt.max || 220, kmh, 'km/h', opt.step || 20); dial(402, 8, rpm, '×1000 rpm', 1);
  g.fillStyle = glow; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText(String(Math.round(kmh)), 256, 92); g.font = '13px sans-serif'; g.fillStyle = dim; g.fillText(opt.gear || 'D', 256, 132);
  if (opt.blink & 1 && opt.on) { g.fillStyle = '#3ad15a'; g.beginPath(); g.moveTo(205, 40); g.lineTo(222, 30); g.lineTo(222, 50); g.fill(); }
  if (opt.blink & 2 && opt.on) { g.fillStyle = '#3ad15a'; g.beginPath(); g.moveTo(307, 40); g.lineTo(290, 30); g.lineTo(290, 50); g.fill(); }
  if (opt.head) { g.fillStyle = '#3ad15a'; g.font = '16px sans-serif'; g.fillText('◐', 256, 30); }
  G.tex.needsUpdate = true;
}

// 좌석 하나 (방석 · 등받이 · 머리받침), 같은 줄 3자리 이상은 긴 의자로
function seatMesh(B, s, w, col, opt = {}) {
  const [, x, y, z] = s, back = opt.back ?? 0.62;
  B.add(new THREE.BoxGeometry(w, 0.14, 0.5), col, 0, T(x, y - 0.07, z + 0.02));
  B.add(new THREE.BoxGeometry(w, 0.12, 0.08), col, 0, T(x, y - 0.02, z + 0.25, -0.15));
  B.add(new THREE.BoxGeometry(w * 0.96, back, 0.13), col, 0, T(x, y + back / 2, z - 0.26, -0.18));
  if (opt.head !== false) B.add(new THREE.BoxGeometry(Math.min(0.28, w * 0.6), 0.2, 0.1), col, 0, T(x, y + back + 0.14, z - 0.32, -0.12));
  if (opt.legs) B.add(new THREE.BoxGeometry(w * 0.8, y - 0.1, 0.06), '#3a3c40', 0, T(x, (y - 0.1) / 2 + 0.05, z));
}

const CACHE = new Map();
// 차 안 만들기: key 차 종류. 돌려주는 것 { g, shell(바깥 몸통 인스턴스 1), wheel(운전대), gauge, seats, eye }
export function buildInterior(key) {
  if (CACHE.has(key)) return CACHE.get(key);
  const t = TYPES[key], g = new THREE.Group(), belt = beltOf(t), bike = t.cat === 'bike';
  const out = { g, t, seats: t.seats, eye: t.eye, wheel: null, gauge: null };
  if (bike) { CACHE.set(key, out); return out; }
  const { body, glass } = split(vehicleGeo(key, true));
  // 바깥 몸통: 차 길 그림과 같은 재질 (도색 · 불빛), 인스턴스 하나
  body.setAttribute('iSt', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
  body.setAttribute('iCell', new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
  const shell = new THREE.InstancedMesh(body, vehicleMat(), 1); shell.setMatrixAt(0, new THREE.Matrix4()); shell.setColorAt(0, new THREE.Color('#ffffff')); shell.frustumCulled = false; g.add(shell); out.shell = shell;
  const inM = new THREE.MeshLambertMaterial({ vertexColors: true }); g.add(new THREE.Mesh(liner(body, t), inM));
  const gm = new THREE.MeshBasicMaterial({ color: '#a9c2d6', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }); const gl = new THREE.Mesh(glass, gm); gl.renderOrder = 5; g.add(gl);
  // 가구
  const B = new Build(), drv = t.seats.find((s) => s[4]) || t.seats[0], car = !!t.top, bus = t.cat === 'bus';
  const cloth = key === 'sedanL' || key === 'taxiB' ? '#b5a88f' : key.startsWith('taxi') || key === 'police' ? '#2a2b2e' : bus ? '#3f5f9e' : t.cat === 'truck' ? '#4a4d52' : '#34363b';
  // 바닥 · 앞 칸막이(엔진 쪽)
  const L2 = t.L / 2, Wd = t.W - 0.14, floorY = car ? 0.3 : bus ? 0.45 : drv[2] - 0.45;
  B.add(new THREE.BoxGeometry(Wd, 0.04, t.L - 0.3), '#202124', 0, T(0, floorY, 0));
  // 좌석: 같은 z 줄끼리 모아 3자리 이상(가운데 자리 있음)은 긴 의자
  const rows = new Map(); for (const s of t.seats) { const k = Math.round(s[3] * 10); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(s); }
  for (const list of rows.values()) {
    if (bus) { for (const s of list) seatMesh(B, s, s[4] ? 0.5 : 0.42, s[4] ? '#2a2b2e' : cloth, { back: s[4] ? 0.62 : 0.5, head: !!s[4], legs: !s[4] }); continue; }
    const bench = list.length >= 3 && !list.some((s) => s[4]);
    if (bench) { const xs = list.map((s) => s[1]); seatMesh(B, [0, (Math.min(...xs) + Math.max(...xs)) / 2, list[0][2], list[0][3]], Math.max(...xs) - Math.min(...xs) + 0.5, cloth); }
    else for (const s of list) seatMesh(B, s, 0.5, cloth);
  }
  // 대시보드: 운전석 앞 0.62m 부터 앞 유리 밑까지, 위는 부드러운 검은 판 · 앞면 회색
  //   dy = 대시보드 윗면 높이 (창 아랫선 조금 아래), 앞면은 운전석 앞 0.75m
  const dz = drv[3] + (bus ? 0.8 : 0.75), dl = car ? clamp(t.ws[1] - 0.02 - dz, 0.3, 0.8) : 0.45, dw = car ? halfW(t, dz + dl / 2) * 1.92 : Wd, dy = belt - 0.05;
  B.add(new THREE.BoxGeometry(dw, 0.24, dl), '#26272b', 0, T(0, dy - 0.12, dz + dl / 2));
  B.add(new THREE.BoxGeometry(dw * 0.98, 0.26, 0.22), '#33353a', 0, T(0, dy - 0.36, dz + 0.08, -0.35));
  // 송풍구 (양 끝 · 가운데)
  for (const x of car ? [-dw * 0.42, -0.1, 0.1, dw * 0.42] : [-dw * 0.4, dw * 0.4]) B.add(new THREE.BoxGeometry(0.11, 0.05, 0.02), '#5a5d63', 0, T(x, dy - 0.05, dz - 0.008));
  // 계기판 덮개 (운전석 앞, 얇게)
  B.add(new THREE.BoxGeometry(0.44, 0.035, 0.13), '#1d1e21', 0, T(drv[1], dy + 0.012, dz + 0.04));
  // 가운데 받침 · 기어 (승용 · 승합)
  if (!bus) {
    if (t.cat !== 'truck') { B.add(new THREE.BoxGeometry(0.22, 0.12, 0.42), '#2c2d31', 0, T(0, floorY + 0.28, drv[3] + 0.05)); B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), '#8a8f95', 0, T(0, floorY + 0.4, drv[3] + 0.2, -0.3)); B.add(new THREE.SphereGeometry(0.035, 10, 8), '#1a1a1c', 0, T(0, floorY + 0.47, drv[3] + 0.22)); }
  }
  // 백미러 · 해 가리개 (승용 · 승합 · 트럭)
  const roofY = car ? topAt(t, (t.ws[0] + t.rg[1]) / 2) - 0.03 : t.H - 0.12, mz = car ? t.ws[0] - 0.08 : dz + 0.3;
  B.add(new THREE.BoxGeometry(0.24, 0.07, 0.03), '#1d1e21', 0, T(0, roofY - (car ? 0.1 : 0.25), mz));
  B.add(new THREE.PlaneGeometry(0.21, 0.055), '#7d93a6', VK.glass, T(0, roofY - (car ? 0.1 : 0.25), mz - 0.016, 0, Math.PI));
  for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(0.34, 0.02, 0.17), '#cfcac0', 0, T(s * 0.36, roofY - 0.03, mz - 0.1, 0.25));
  // 버스: 노란 손잡이 기둥 · 앞문 계단
  if (bus) { for (let z = L2 - 2.6; z > -L2 + 1; z -= 1.65) for (const x of [-0.25, 0.25]) B.add(new THREE.CylinderGeometry(0.02, 0.02, t.H - floorY - 0.3, 8), '#e8b51e', 0, T(x, (t.H + floorY - 0.3) / 2, z)); B.add(new THREE.CylinderGeometry(0.018, 0.018, t.L - 2, 8).rotateX(Math.PI / 2), '#c9cdd2', 0, T(0, t.H - 0.55, -0.4)); }
  const fm = new THREE.Mesh(B.done(), new THREE.MeshLambertMaterial({ vertexColors: true })); g.add(fm);
  // 계기판 화면 (그림을 다시 그려 바늘을 움직인다): 밤엔 은은히 빛난다
  const G = gaugeCanvas(); drawGauge(G, 0, 0.8, 0); out.gauge = G;
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshBasicMaterial({ map: G.tex, toneMapped: false }));
  gp.position.set(drv[1], dy - 0.08, dz - 0.006); gp.rotation.set(0.12, Math.PI, 0, 'YXZ'); g.add(gp);
  // 가운데 화면 (지도 비슷한 파란 화면)
  if (!bus) { const sc = document.createElement('canvas'); sc.width = 128; sc.height = 80; const c = sc.getContext('2d'); c.fillStyle = '#0e1a26'; c.fillRect(0, 0, 128, 80); c.strokeStyle = '#3a6a9a'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 70); c.lineTo(50, 40); c.lineTo(80, 45); c.lineTo(120, 10); c.stroke(); c.fillStyle = '#ff6a3a'; c.beginPath(); c.arc(50, 40, 5, 0, 7); c.fill(); const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.15), new THREE.MeshBasicMaterial({ map: st, toneMapped: false })); sp.position.set(0, dy - 0.1, dz - 0.006); sp.rotation.set(0.1, Math.PI, 0, 'YXZ'); g.add(sp); }
  // 운전대: 둥근 테 + 살 셋 + 가운데, 기둥 쪽으로 기울어 있다 (돌리면 돈다)
  const wheel = new THREE.Group(), wr = bus || t.cat === 'truck' ? 0.24 : 0.19, wm = new THREE.MeshLambertMaterial({ color: '#1c1d20' });
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(wr, 0.022, 8, 28), wm));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 14).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#2a2b2f' })); wheel.add(hub);
  for (const a of [0, 2.2, -2.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, wr, 0.015), wm); sp.position.set(Math.sin(a) * wr / 2, -Math.cos(a) * wr / 2, 0); sp.rotation.z = a; wheel.add(sp); }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8).rotateX(Math.PI / 2), wm); col.position.z = 0.17; if (!bus) wheel.add(col);
  const wp = new THREE.Group(); wp.position.set(drv[1], drv[2] + (bus ? 0.3 : 0.32), drv[3] + (bus ? 0.5 : 0.45)); wp.rotation.x = bus ? -1.15 : -0.42; wp.add(wheel); g.add(wp); out.wheel = wheel;
  // 버스 운전대 기둥은 바닥에서 비스듬히 올라온다
  if (bus) { const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, wp.position.y - floorY, 8), wm); bc.position.set(drv[1], (wp.position.y + floorY) / 2, wp.position.z + 0.12); bc.rotation.x = 0.25; g.add(bc); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  CACHE.set(key, out); return out;
}
// 자리에 앉은 눈 위치 (방석 위 0.66m, 등받이 쪽으로 조금)
export function seatEye(s, t) { return [s[1], s[2] + (t?.cat === 'bike' ? 0.62 : 0.66), s[3] - (t?.cat === 'bike' ? 0.0 : 0.1)]; }
