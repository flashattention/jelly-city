// 서울 산책: 실시간 버스 · 지하철 (서울 어디든)
//   버스: 서버 /api/seoul/bus/near 가 주는 실제 GPS 위치 → 가까운 실제 찻길에 붙여, 다음 위치까지 길을 따라 움직인다
//         종류별 실제 색(간선 파랑 · 지선 초록 · 광역 빨강 · 순환 노랑 · 마을 연두 · 공항 하늘) · 앞 옆 뒤 노선 번호판(글씨 그림 한 장) · 정류장에서 멈춤
//   지하철: 서버 /api/seoul/subway/positions 의 실제 열차(역 + 진입 · 도착 · 출발) → subway.json 의 실제 선로 위 역 사이 자리
//         지상 · 다리 구간은 3D 열차(호선 색 띠 · 실제 칸 수, 호선마다 인스턴스로 그리기 2번), 지하 구간은 미니맵 · 큰 지도에 점
//   좌표: subway.json 과 서버 위경도는 서울 전체 틀(북위 37.53 · 동경 126.98 = 0), 화면은 지도 중심(map.center)을 뺀 자리
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/\s/g, '').replace(/역$/, '');
// 서울 버스 색 (실제 도색): 1 공항 · 2 마을 · 3 간선 · 4 지선 · 5 순환 · 6 광역 · 7 인천 · 8 경기 · 0 공용
export const BUS_COLOR = { 1: '#2a9fd8', 2: '#6fb92c', 3: '#3d5bab', 4: '#4fa83a', 5: '#f2b70a', 6: '#e0312a', 7: '#3d5bab', 8: '#e0312a', 0: '#8a8f99' };
const BUS_NEAR3D = 600, TRAIN_NEAR3D = 1300;
// 같은 찻길인지 (칸을 불러오면 찻길 목록을 새로 만들어서, 같은 길도 다른 물건이 된다)
const sameRoad = (a, b) => a === b || (!!a && !!b && a.len === b.len && a.pts[0][0] === b.pts[0][0] && a.pts[0][1] === b.pts[0][1]);

// ---------- 버스 모양: 종류 색마다 몸체 하나(꼭짓점 색으로 묶은 것) ----------
function boxC(w, h, d, x, y, z, color) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; }
const busGeoCache = new Map();
function busGeo(type) {
  if (busGeoCache.has(type)) return busGeoCache.get(type);
  const col = BUS_COLOR[type] ?? BUS_COLOR[3], L = 11, W = 2.5, parts = [];
  parts.push(boxC(W, 2.35, L, 0, 0.35 + 1.175, 0, col));
  // 아래 치마(짙은 회색) · 옆 창 띠 · 앞 유리(크게) · 뒤 유리 · 지붕 냉방기 · 문(오른쪽 앞 · 가운데)
  parts.push(boxC(W + 0.02, 0.32, L - 0.2, 0, 0.5, 0, '#3b3f46'));
  parts.push(boxC(W + 0.03, 1.05, L - 2.2, 0, 2.05, -0.35, '#1d2631'));
  parts.push(boxC(W - 0.16, 1.55, 0.06, 0, 1.85, L / 2 + 0.01, '#1a222c'));
  parts.push(boxC(W - 0.4, 0.8, 0.06, 0, 2.15, -L / 2 - 0.01, '#1a222c'));
  parts.push(boxC(W - 0.5, 0.32, 3.2, 0, 2.86, -1.2, '#d9dbde'));
  parts.push(boxC(W - 0.1, 0.12, L - 0.4, 0, 2.74, 0, '#eceef0'));
  // 문은 오른쪽(-x: 앞을 +z 로 볼 때 오른쪽)
  for (const z of [L / 2 - 1.3, -0.4]) parts.push(boxC(0.05, 2.1, 1.1, -W / 2 - 0.02, 1.45, z, '#2a3440'));
  // 바퀴 (둥근 통)
  for (const sx of [-1, 1]) for (const z of [L / 2 - 2.2, -L / 2 + 2.4]) { const w = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12); w.rotateZ(Math.PI / 2); w.translate(sx * (W / 2 - 0.12), 0.48, z); const c = new THREE.Color('#15171a'), n = w.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); w.setAttribute('color', new THREE.BufferAttribute(a, 3)); w.deleteAttribute('uv'); parts.push(w); }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed())); busGeoCache.set(type, g); return g;
}
// 빛나는 것: 전조등 · 미등 · 차 안 불빛(옆 창 칸마다) — 낮엔 어둡게, 밤엔 밝게 (재질 색을 곱해서). 모든 버스가 같은 그물
let lampGeo = null; function busLampGeo() {
  if (lampGeo) return lampGeo; const L = 11, W = 2.5, parts = [];
  for (const sx of [-1, 1]) { parts.push(boxC(0.42, 0.18, 0.05, sx * (W / 2 - 0.35), 0.8, L / 2 + 0.03, '#fff6dc')); parts.push(boxC(0.3, 0.5, 0.05, sx * (W / 2 - 0.25), 1.0, -L / 2 - 0.03, '#ff3322')); }
  // 옆 창: 칸마다 기둥을 두고 (앞문 자리는 비움), 앞 유리는 푸르스름하게 어둡게
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const z = -L / 2 + 1.1 + i * 1.45; if (sx < 0 && (i === 3)) continue; parts.push(boxC(0.02, 0.86, 1.25, sx * (W / 2 + 0.035), 2.06, z, i % 3 === 1 ? '#ffd998' : '#ffe6b4')); }
  parts.push(boxC(W - 0.3, 1.3, 0.02, 0, 1.95, L / 2 + 0.05, '#8fa6bb'));
  lampGeo = mergeGeometries(parts.map((p) => p.toNonIndexed())); return lampGeo;
}
// 노선 번호판 글씨: 한 장(1024 × 512)에 칸 96개, 오래 안 쓴 칸부터 다시 쓴다
class PlateAtlas {
  constructor() { this.cv = document.createElement('canvas'); this.cv.width = 1024; this.cv.height = 512; this.g = this.cv.getContext('2d'); this.g.fillStyle = '#0b0b0c'; this.g.fillRect(0, 0, 1024, 512); this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.slots = new Map(); this.free = [...Array(96).keys()]; this.mat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }); }
  slot(no) {
    let s = this.slots.get(no); if (s) { s.t = performance.now(); return s.i; }
    let i = this.free.pop(); if (i === undefined) { let old = null; for (const [k, v] of this.slots) if (!old || v.t < old[1].t) old = [k, v]; i = old[1].i; this.slots.delete(old[0]); }
    this.slots.set(no, { i, t: performance.now() }); const x = (i % 8) * 128, y = Math.floor(i / 8) * 40, g = this.g;
    g.fillStyle = '#0b0b0c'; g.fillRect(x, y, 128, 40); g.fillStyle = '#ffae1a'; g.font = `bold ${no.length > 5 ? 22 : 30}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(no, x + 64, y + 22, 120); this.tex.needsUpdate = true; return i;
  }
  uv(i) { const u0 = (i % 8) / 8, v1 = 1 - Math.floor(i / 8) * 40 / 512, v0 = v1 - 40 / 512; return [u0, v0, u0 + 1 / 8, v1]; }
}
// 번호판 그물: 앞(위 LED) · 옆(오른쪽 창 위) · 뒤
function plateGeo(atlas, no) {
  const [u0, v0, u1, v1] = atlas.uv(atlas.slot(no)), L = 11, W = 2.5, P = [], U = [], I = [];
  const quad = (cx, cy, cz, w, h, ax, az) => { const k = P.length / 3, hx = (w / 2) * ax, hz = (w / 2) * az; P.push(cx - hx, cy - h / 2, cz - hz, cx + hx, cy - h / 2, cz + hz, cx + hx, cy + h / 2, cz + hz, cx - hx, cy + h / 2, cz - hz); U.push(u0, v0, u1, v0, u1, v1, u0, v1); I.push(k, k + 1, k + 2, k, k + 2, k + 3); };
  quad(0, 2.5, L / 2 + 0.05, 1.7, 0.42, 1, 0); quad(W / 2 + 0.05, 2.72, 1.6, 1.5, 0.3, 0, -1); quad(-W / 2 - 0.05, 2.72, -1.6, 1.5, 0.3, 0, 1); quad(0, 2.68, -L / 2 - 0.05, 1.1, 0.3, -1, 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); return g;
}

// ---------- 열차 모양: 한 칸 = 몸체(꼭짓점 색) + 창 띠(밤에 빛남) ----------
function carGeos(color, len) {
  const W = 3.1, body = [boxC(W, 3.3, len - 0.6, 0, 1.95, 0, '#dfe3e6'), boxC(W + 0.02, 0.22, len - 0.6, 0, 1.55, 0, color), boxC(W + 0.02, 0.12, len - 0.6, 0, 3.2, 0, color), boxC(W - 0.3, 0.25, len - 1.2, 0, 3.65, 0, '#b8bdc3'), boxC(W - 0.2, 0.5, len - 3, 0, 0.35, 0, '#2b2e33')];
  for (const z of [-len / 4, len / 4]) for (const sx of [-1, 1]) body.push(boxC(0.05, 2.0, 1.3, sx * (W / 2 + 0.02), 1.65, z, '#6d747c'));
  const win = [boxC(W + 0.04, 0.85, len - 2.4, 0, 2.5, 0, '#ffffff')];
  return [mergeGeometries(body.map((p) => p.toNonIndexed())), mergeGeometries(win.map((p) => p.toNonIndexed()))];
}

// 찻길 위 가장 가까운 자리
function projOn(L, x, z) { let best = null; for (let k = 1; k < L.pts.length; k++) { const p = L.pts[k - 1], q = L.pts[k], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - p[0]) * dx + (z - p[1]) * dz) / l2, 0, 1), d = Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t); if (!best || d < best.dist) best = { dist: d, d: L.cum[k - 1] + Math.sqrt(l2) * t }; } return best; }
export class LiveTransit {
  constructor(hg) {
    this.hg = hg; this.buses = new Map(); this.trains = new Map(); this.cid = Math.random().toString(36).slice(2, 12);
    this.busT = 1; this.subT = 2; this.busOK = false; this.subOK = false; this.sub = null; this.lineMesh = new Map();
    this.bodyM = new THREE.MeshLambertMaterial({ vertexColors: true }); this.lampM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); this.atlas = null;
    this.winM = new THREE.MeshLambertMaterial({ color: '#2a3442', emissive: '#ffe9b8', emissiveIntensity: 0.15 });
    fetch(new URL('../seoul/subway.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) this.setSubway(j); }).catch(() => {});
  }
  // 지도 중심 (지역 지도는 중심이 0 이 아니다)
  get cx() { return this.hg.map?.center?.[0] || 0; }
  get cz() { return this.hg.map?.center?.[1] || 0; }
  toLocal(lat, lon) { return [(lon - LON0) * KX - this.cx, -(lat - LAT0) * KZ - this.cz]; }
  setSubway(j) {
    this.sub = j; this.edgeCache = new Map();
    for (const L of Object.values(j.lines)) { L.byName = new Map(); for (const [k, v] of Object.entries(L.st)) { L.byName.set(k, k); L.byName.set(norm(v[0]), k); } }
  }
  // ---------- 받아 오기 ----------
  async pollBus() {
    const hg = this.hg; if (!hg.api || hg.px == null) return;
    if (hg.inside || hg.inShop || hg.inMall) return; // 실내(멀리 따로 지은 곳)에선 버스를 받지 않는다
    const wx = hg.px + this.cx, wz = hg.pz + this.cz, lat = LAT0 - wz / KZ, lon = LON0 + wx / KX;
    try { const j = await hg.api(`/api/seoul/bus/near?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&c=${this.cid}`); this.busOK = true; this.busSrc = j.src; this.ingestBus(j.buses || []); }
    catch { try { const j = await hg.api('/api/seoul/bus/pos'); this.busOK = true; this.busSrc = 'old'; this.ingestBus(j.buses || []); } catch { this.busOK = false; } }
  }
  async pollSub(all = false) {
    const hg = this.hg; if (!hg.api || !this.sub || hg.px == null) return;
    // 곰 둘레 3km 안에 역이 있는 노선만 (큰 지도를 열면 모든 노선)
    // 역 안에서는 그 역의 실제 자리 둘레로 (역 안 공간은 서울 밖 먼 곳에 지어 둔다)
    const st = hg.inside?.st, wx = (st ? st.x : hg.px) + this.cx, wz = (st ? st.z : hg.pz) + this.cz, lines = Object.entries(this.sub.lines).filter(([, L]) => all || Object.values(L.st).some(([, x, z]) => Math.hypot(x - wx, z - wz) < 3000)).map(([n]) => n);
    for (let i = 0; i < lines.length; i += 8) { try { const j = await hg.api(`/api/seoul/subway/positions?lines=${encodeURIComponent(lines.slice(i, i + 8).join(','))}`); this.subOK = true; for (const [line, list] of Object.entries(j.lines || {})) this.ingestLine(line, list); } catch { if (!this.trains.size) this.subOK = false; } }
  }
  poll() { this.pollBus(); }
  // ---------- 버스 ----------
  // 가까운 찻길 (30m 안), 방향 힌트(hx, hz)가 있으면 그 방향과 맞는 길을 고른다
  snap(x, z, hx = 0, hz = 0) {
    const hg = this.hg, G = hg.driveGrid, lines = hg.driveLines; if (!G || !lines) return null; let best = null;
    const gx = Math.floor(x / 50), gz = Math.floor(z / 50);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [li, i] of G.get(`${gx + a},${gz + b}`) || []) {
      const L = lines[li]; for (const k of [i, i + 1]) { if (k < 1 || k >= L.pts.length) continue; const p = L.pts[k - 1], q = L.pts[k], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - p[0]) * dx + (z - p[1]) * dz) / l2, 0, 1), px = p[0] + dx * t, pz = p[1] + dz * t, l = Math.sqrt(l2);
        let d = Math.hypot(x - px, z - pz) - Math.min(L.w / 2, 8); if (hx || hz) d += (1 - Math.abs((dx * hx + dz * hz) / l)) * 12; if (L.w < 10) d += 6;
        if (d < 30 && (!best || d < best.score)) best = { score: d, L, d: L.cum[k - 1] + l * t, x: px, z: pz, dx: dx / l, dz: dz / l }; }
    }
    return best;
  }
  ingestBus(list) {
    const now = performance.now() / 1000, seen = new Set();
    for (const b of list) {
      const id = String(b.id); seen.add(id); let o = this.buses.get(id); const [x, z] = this.toLocal(b.lat, b.lon), key = `${b.lat},${b.lon}`;
      if (!o) { o = { id, rid: b.rid, route: String(b.route || ''), type: +b.type || 3, x, z, yaw: 0, miss: 0, key: '', at: now, gap: 90 }; this.buses.set(id, o);
        // 처음 볼 때 방향: 서버가 준 지난 자리에서, 없으면 길 방향 그대로
        let hx = 0, hz = 0; if (b.plat) { const [x0, z0] = this.toLocal(b.plat, b.plon); hx = x - x0; hz = z - z0; const l = Math.hypot(hx, hz) || 1; hx /= l; hz /= l; }
        const s = this.snap(x, z, hx, hz); if (s) { o.L = s.L; o.d = s.d; o.dir = hx || hz ? (s.dx * hx + s.dz * hz >= 0 ? 1 : -1) : 1; o.x = s.x; o.z = s.z; o.yaw = Math.atan2(s.dx * o.dir, s.dz * o.dir); o.tgtD = s.d; } else o.yaw = hx || hz ? Math.atan2(hx, hz) : 0;
        o.key = key; o.stop = b.stop; o.plate = b.plate; continue; }
      o.miss = 0; o.stop = b.stop; if (key === o.key) continue;
      // 새 위치: 받는 간격에 맞춰 그 자리까지 (같은 길이면 길을 따라, 아니면 곧게)
      o.gap = clamp(now - o.at, 25, 150); o.at = now; o.key = key;
      const mx = x - o.x, mz = z - o.z, ml = Math.hypot(mx, mz); if (ml < 2) continue;
      const s = this.snap(x, z, mx / ml, mz / ml);
      // 900m 넘게 건너뛰면 그 자리로, 찻길을 못 찾으면 곧게 그 자리까지 (닿으면 다시 찻길 찾기)
      if (ml > 900) { if (s) { o.L = s.L; o.d = s.d; o.x = s.x; o.z = s.z; o.tgtD = s.d; } else { o.L = null; o.x = x; o.z = z; } o.yaw = Math.atan2(mx, mz); continue; }
      if (!s) { o.line = { x0: o.x, z0: o.z, s: { x, z, L: null, d: 0, dx: mx / ml, dz: mz / ml }, t: 0 }; o.v = clamp(ml / (o.gap * 0.9), 1.5, 16); continue; }
      // 다른 찻길로 붙었어도 새 자리가 지금 길에서 20m 안이면(교차로 · 갈림길) 지금 길을 따라 간다
      const pj = o.L && !sameRoad(o.L, s.L) ? projOn(o.L, s.x, s.z) : null;
      if (sameRoad(o.L, s.L) && Math.abs(s.d - o.d) > 2) { o.L = s.L; o.dir = s.d > o.d ? 1 : -1; o.tgtD = s.d; o.line = null; }
      else if (pj && pj.dist < 20 && Math.abs(pj.d - o.d) > 2) { o.dir = pj.d > o.d ? 1 : -1; o.tgtD = pj.d; o.line = null; }
      else { o.line = { x0: o.x, z0: o.z, s, t: 0 }; }
      o.v = clamp((o.line ? ml : Math.abs(o.tgtD - o.d)) / (o.gap * 0.9), 1.5, 16);
    }
    for (const [id, o] of this.buses) if (!seen.has(id) && ++o.miss > 4) { this.dropBus(o); this.buses.delete(id); }
  }
  dropBus(o) { if (o.mesh) { this.hg.scene.remove(o.mesh); o.mesh.children[1]?.geometry.dispose(); o.mesh = null; } }
  busMesh(o) {
    this.atlas ||= new PlateAtlas(); const g = new THREE.Group(); g.add(new THREE.Mesh(busGeo(o.type), this.bodyM), new THREE.Mesh(plateGeo(this.atlas, o.route || '버스'), this.atlas.mat), new THREE.Mesh(busLampGeo(), this.lampM));
    g.userData.bus = o.id; this.hg.scene.add(g); return g;
  }
  tickBus(dt, px, pz) {
    for (const o of this.buses.values()) {
      if (o.line) { // 다른 길로 옮겨 가는 중: 곧게
        const s = o.line.s, L0 = Math.hypot(s.x - o.line.x0, s.z - o.line.z0) || 1; o.line.t = Math.min(1, o.line.t + (o.v * dt) / L0); const nx = o.line.x0 + (s.x - o.line.x0) * o.line.t, nz = o.line.z0 + (s.z - o.line.z0) * o.line.t; if (Math.hypot(nx - o.x, nz - o.z) > 0.01) o.yaw = Math.atan2(nx - o.x, nz - o.z); o.x = nx; o.z = nz;
        o.cur = o.line.t < 1 ? o.v : 0; if (o.line.t >= 1) { o.L = s.L; o.d = s.d; o.tgtD = s.d; o.dir = s.dx * Math.sin(o.yaw) + s.dz * Math.cos(o.yaw) >= 0 ? 1 : -1; o.line = null; }
      } else if (!o.L) { // 찻길을 아직 못 찾았으면(칸이 덜 왔을 때) 가끔 다시
        o.retry = (o.retry || 0) - dt; if (o.retry <= 0) { o.retry = 2; const s = this.snap(o.x, o.z, Math.sin(o.yaw), Math.cos(o.yaw)); if (s) { o.L = s.L; o.d = s.d; o.tgtD = s.d; o.dir = s.dx * Math.sin(o.yaw) + s.dz * Math.cos(o.yaw) >= 0 ? 1 : -1; } }
      } else {
        // 받은 자리까지 길을 따라, 닿은 뒤엔 정차 중이 아니면 같은 방향으로 60m 까지 천천히 (새 소식이 늦을 때)
        const ahead = (o.tgtD - o.d) * o.dir; let v = 0; if (ahead > 0.3) v = o.v || 6; else if (!o.stop && ahead > -60) v = 2.2;
        // 타고 있는 버스는 정류장마다 잠깐 선다 (hangang-ride.js 가 hold 를 준다)
        if (o.hold > 0) { o.hold -= dt; v = 0; }
        o.cur = (o.cur ?? v) + (v - (o.cur ?? v)) * Math.min(1, dt * 1.5); o.d = clamp(o.d + o.dir * o.cur * dt, 0, o.L.len);
        const hg = this.hg, q = hg.lineAt(o.L, o.d, 0), lane = o.L.w >= 30 ? 1.8 : Math.max(1.8, o.L.w / 2 - (o.id === this.rideId ? 3.3 : 1.8)), fx = q.dx * o.dir, fz = q.dz * o.dir;
        // 넓은 길(30m 넘게)은 가운데 버스 전용 차로, 아니면 바깥 차로
        const tx = q.x - fz * lane, tz = q.z + fx * lane; o.x += (tx - o.x) * Math.min(1, dt * 4); o.z += (tz - o.z) * Math.min(1, dt * 4);
        const want = Math.atan2(fx, fz); let dy = want - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 3);
      }
      const near = Math.hypot(o.x - px, o.z - pz) < BUS_NEAR3D;
      if (near && !o.mesh) o.mesh = this.busMesh(o); else if (!near && o.mesh) this.dropBus(o);
      if (o.mesh) { o.mesh.position.set(o.x, 0, o.z); o.mesh.rotation.y = o.yaw; }
    }
    const night = this.hg.light?.night || 0; this.lampM.color.setScalar(0.07 + night * 0.9);
  }
  // ---------- 지하철 ----------
  edge(line, a, b) {
    const k = `${line}|${a}|${b}`; if (this.edgeCache.has(k)) return this.edgeCache.get(k); const L = this.sub.lines[line]; let f = L.edges[`${a}|${b}`], rev = false; if (!f) { f = L.edges[`${b}|${a}`]; rev = true; } if (!f) { this.edgeCache.set(k, null); return null; }
    let P = []; for (let i = 0; i < f.length; i += 3) P.push([f[i], f[i + 1], f[i + 2]]); if (rev) { P = P.reverse(); for (let i = P.length - 1; i > 0; i--) P[i][2] = P[i - 1][2]; }
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const e = { P, cum, len: cum[cum.length - 1] || 1, a, b }; this.edgeCache.set(k, e); return e;
  }
  // 선로 위 d 자리 (세상 좌표) · 종류(0 땅 · 1 지하 · 2 다리, 점마다 그 점으로 들어오는 조각의 종류)
  edgeAt(e, d) { d = clamp(d, 0, e.len); let i = 1; while (i < e.cum.length - 1 && e.cum[i] < d) i++; const p = e.P[i - 1], q = e.P[i], l = e.cum[i] - e.cum[i - 1] || 1, t = (d - e.cum[i - 1]) / l; return { x: p[0] + (q[0] - p[0]) * t, z: p[1] + (q[1] - p[1]) * t, dx: (q[0] - p[0]) / l, dz: (q[1] - p[1]) / l, k: q[2] }; }
  // 역 이름 → 그 노선 역 열쇠
  stKey(L, name) { const n = norm(name); if (L.byName.has(n)) return L.byName.get(n); const m = /\((.*?)\)/.exec(name || ''); if (m && L.byName.has(norm(m[1]))) return L.byName.get(norm(m[1])); return null; }
  // 운행 순서에서 at 의 이전 · 다음 역 (행선지 to 쪽으로)
  neighbors(line, L, at, to, up, hint, express = false) {
    const cand = [];
    for (const q of L.seqs) { const s = q.s, n = s.length; for (let i = 0; i < n; i++) { if (s[i] !== at) continue; let score = 0;
      if (q.loop) { if ((q.loop === 'in') === up) score = 5; else if (q.loop === 'loop') score = 1; else continue; const nx = s[(i + 1) % n] === at ? s[(i + 2) % n] : s[(i + 1) % n], pv = s[(i - 1 + n) % n] === at ? s[(i - 2 + n) % n] : s[(i - 1 + n) % n]; cand.push({ score, next: nx, prev: pv }); continue; }
      const j = to ? s.indexOf(to, i + 1) : -1; if (j > i) score = 10 - Math.min(5, (j - i) / 10); else if (to && s.indexOf(to) >= 0) continue; else score = 1;
      if (hint && s[i - 1] === hint) score += 4; if (!!q.x !== express) score -= 6; cand.push({ score, next: s[i + 1] || null, prev: s[i - 1] || null }); } }
    cand.sort((p, q) => q.score - p.score); return cand[0] || null;
  }
  ingestLine(line, list) {
    const L = this.sub?.lines[line]; if (!L) return; const now = performance.now() / 1000, seen = new Set();
    for (const t of list) {
      const id = `${line}:${t.no}`, at = this.stKey(L, t.at); if (!at) continue; seen.add(id); let o = this.trains.get(id);
      const to = this.stKey(L, t.to), nb = this.neighbors(line, L, at, to, t.up, o?.lastAt && o.lastAt !== at ? o.lastAt : null, !!t.express); if (!nb) continue;
      // 상태 → 역 사이 자리: 0 진입(앞 역 → at 의 85%) · 1 도착(at) · 2 출발(at → 다음 역 12%) · 3 전역출발(앞 역 → at 의 25%)
      let A, B, f; if (t.sttus === 2) { A = at; B = nb.next; f = 0.12; } else { A = nb.prev; B = at; f = t.sttus === 0 ? 0.85 : t.sttus === 3 ? 0.25 : 1; }
      if (!A || !B) { if (t.sttus === 1 && nb.next) { A = at; B = nb.next; f = 0; } else continue; }
      const e = this.edge(line, A, B); if (!e) continue;
      if (!o) { o = { id, line, e, d: e.len * f, v: 0 }; this.trains.set(id, o); }
      const was = o.sttus; if (o.lastAt !== at) o.prevAt = o.lastAt; o.lastAt = at; o.sttus = t.sttus; o.at = now; o.miss = 0; o.to = t.to; o.next = nb.next;
      // 같은 역 사이면 그대로 따라가고, 바로 다음 역 사이면 이어서, 아니면 그 자리로 (처음 · 건너뜀)
      if (o.e === e) o.tgt = { e, d: e.len * f }; else if (o.e.b === A) { if (o.e.len - o.d < 40 && !o.dwellAt && (was === 0 || was === 1)) { o.d = o.e.len; o.dwellAt = now - 6; } o.tgt = { e, d: e.len * f, hop: true }; } else { o.e = e; o.d = e.len * f; o.tgt = { e, d: e.len * f }; }
    }
    for (const [id, o] of this.trains) if (o.line === line && !seen.has(id) && ++o.miss > 3) { this.trains.delete(id); }
  }
  tickTrains(dt, px, pz) {
    const now = performance.now() / 1000, wx = px + this.cx, wz = pz + this.cz;
    for (const o of this.trains.values()) {
      const T = o.tgt; if (!T) continue; const remain = T.hop ? o.e.len - o.d + T.d : T.d - o.d;
      // 다음 소식(20초 남짓) 전에 닿게, 닿은 뒤엔 상태대로 조금 더 (출발 · 전역출발이면 다음 역 앞 92% 까지, 도착이면 정차)
      // 역에 닿으면 20초 선다 (문 열림 · 타고 내리기)
      if (o.sttus === 1 && !T.hop && T.e === o.e && o.e.len - o.d < 1.5 && !o.dwellAt) o.dwellAt = now;
      // 곰이 승강장에 있으면 hangang-ride.js 가 dwellMax 를 40초까지 늘린다
      if (o.dwellAt && (now - o.dwellAt > (o.dwellMax || 20) || o.e.len - o.d > 30)) { o.dwellAt = 0; o.dwellMax = 0; }
      let v; if (o.dwellAt) v = 0; else if (remain > 0.5) v = clamp(remain / (T.hop ? 14 : 8), remain < 25 ? 1.5 : 3, 26); else if (o.sttus === 2 || o.sttus === 3) v = (T.e.len * 0.92 - o.d > 0 && !T.hop) ? 11 : 0; else if (o.sttus === 0) v = o.d < T.e.len - 0.5 ? 4 : 0; else if (o.sttus === 1 && !T.hop && o.e.len - o.d > 0.5) v = clamp((o.e.len - o.d) / 8, 1.5, 26); else { v = 0; if (now - o.at > 40 && o.next) { const ne = this.edge(o.line, T.e.b, o.next); if (ne) { o.tgt = { e: ne, d: ne.len * 0.25, hop: true }; o.sttus = 3; } } }
      o.v += (v - o.v) * Math.min(1, dt * 1.2); o.d += o.v * dt;
      if (o.d >= o.e.len && T.hop) { o.d -= o.e.len; o.e = T.e; T.hop = false; }
      o.d = clamp(o.d, 0, o.e.len);
      const h = this.edgeAt(o.e, o.d); o.wx = h.x; o.wz = h.z; o.k = h.k;
      o.show = Math.hypot(h.x - wx, h.z - wz) < TRAIN_NEAR3D;
    }
    this.drawTrains();
  }
  // c 번째 칸 가운데 자리 (세상 좌표 · 종류): 타고 있을 때 실내를 둘 곳
  carPose(o, c) { const clen = (this.sub.lines[o.line].cars || [8, 20])[1]; let d = o.d - clen * (c + 0.5), e = o.e; const prevE = o.prevAt ? this.edge(o.line, o.prevAt, o.e.a) : null; if (d < 0 && prevE) { e = prevE; d += prevE.len; } return this.edgeAt(e, Math.max(0, d)); }
  // 3D 열차: 호선마다 칸 인스턴스 (몸체 · 창), 칸마다 선로를 따라 뒤로 (앞 역 사이까지)
  drawTrains() {
    const hg = this.hg, cnt = new Map(), mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (const im of this.lineMesh.values()) { im.body.count = 0; im.win.count = 0; }
    for (const o of this.trains.values()) {
      // 타고 있는 열차는 바깥 껍데기를 그리지 않는다 (안에서 보면 껍데기가 창을 가린다)
      if (!o.show || o.id === this.rideId) continue; const L = this.sub.lines[o.line], [n, clen] = L.cars || [8, 20]; let im = this.lineMesh.get(o.line);
      if (!im) { const [bg, wg] = carGeos(L.color, clen); const body = new THREE.InstancedMesh(bg, this.bodyM, 120), win = new THREE.InstancedMesh(wg, this.winM, 120); body.frustumCulled = win.frustumCulled = false; body.userData.noDrape = win.userData.noDrape = true; body.count = win.count = 0; hg.scene.add(body, win); im = { body, win }; this.lineMesh.set(o.line, im); }
      const prevE = o.prevAt ? this.edge(o.line, o.prevAt, o.e.a) : null;
      for (let c = 0; c < n; c++) {
        let d = o.d - clen * (c + 0.5), e = o.e; if (d < 0 && prevE) { e = prevE; d += prevE.len; } if (d < 0) continue;
        const p = this.edgeAt(e, d); if (p.k === 1) continue; const x = p.x - this.cx, z = p.z - this.cz; if (im.body.count >= 120) break;
        pos.set(x, this.trackY(x, z, p.k), z); q.setFromAxisAngle(up, Math.atan2(p.dx, p.dz)); mat.compose(pos, q, one);
        im.body.setMatrixAt(im.body.count++, mat); im.win.setMatrixAt(im.win.count++, mat);
      }
      cnt.set(o.line, 1);
    }
    for (const im of this.lineMesh.values()) { im.body.instanceMatrix.needsUpdate = true; im.win.instanceMatrix.needsUpdate = true; im.body.visible = im.body.count > 0; im.win.visible = im.win.count > 0; }
    this.winM.emissiveIntensity = 0.15 + (hg.light?.night || 0) * 1.4;
  }
  // 선로 높이: 다리 · 고가면 가까운 철교 선로(그 높이), 아니면 땅
  trackY(x, z, k) {
    const hg = this.hg, ground = hg.terr ? hg.terrAt(x, z) : 0; if (k !== 2) return ground + 0.3;
    let best = null; const look = (rp) => { for (const tp of rp || []) { const f = tp.fine; for (let i = 0; i < f.length; i += 1) { const d = Math.abs(f[i][0] - x) + Math.abs(f[i][1] - z); if (d < 25 && (!best || d < best.d)) best = { d, y: tp.ys[i] }; } } };
    look(hg.railPaths); if (hg.chunks) for (const c of hg.chunks.values()) look(c.railPaths);
    // 서울 전체 칸의 다리는 땅 높이(원래 지형) 위에 얹혀 있다
    return best ? best.y + (hg.terr ? hg.terrAt(x, z, true) : 0) + 0.4 : ground + 6.5;
  }
  // 철교 가운데선으로 옮긴 자리 (복선이라 선로가 다리 가운데서 2m 쯤 비켜 있어, 탄 채로는 트러스가 칸을 뚫는다)
  bridgeCenter(x, z, dx, dz) {
    const hg = this.hg; let best = null; const look = (rp) => { for (const tp of rp || []) for (const f of tp.fine) { const d = Math.abs(f[0] - x) + Math.abs(f[1] - z); if (d < 25 && (!best || d < best.d)) best = { d, f }; } };
    look(hg.railPaths); if (hg.chunks) for (const c of hg.chunks.values()) look(c.railPaths); if (!best) return null;
    const t = (x - best.f[0]) * dx + (z - best.f[1]) * dz; return [best.f[0] + dx * t, best.f[1] + dz * t];
  }
  tick(dt, px, pz) {
    this.busT -= dt; if (this.busT <= 0) { this.busT = 20; this.pollBus(); }
    const all = performance.now() - (this.allAt || 0) < 1500; this.subT -= dt; if (this.subT <= 0) { this.subT = all ? 25 : 20; this.pollSub(all); }
    this.tickBus(dt, px, pz); if (this.sub) this.tickTrains(dt, px, pz);
  }
  // 미니맵: 열차 = 노선 색 둥근 네모(지하는 흐리게), 버스 = 종류 색 작은 점
  drawMini(ctx, c, m, px, pz, size) {
    for (const o of this.buses.values()) { const x = c + (o.x - px) * m, y = c + (o.z - pz) * m; if (x < 0 || y < 0 || x > size || y > size) continue; ctx.fillStyle = BUS_COLOR[o.type] || '#3d5bab'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill(); ctx.stroke(); }
    if (!this.sub) return;
    for (const o of this.trains.values()) { if (o.wx == null) continue; const x = c + (o.wx - this.cx - px) * m, y = c + (o.wz - this.cz - pz) * m; if (x < -6 || y < -6 || x > size + 6 || y > size + 6) continue; ctx.globalAlpha = o.k === 1 ? 0.75 : 1; ctx.fillStyle = this.sub.lines[o.line].color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - 4, y - 4, 8, 8, 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // 큰 지도가 열려 있는 동안(그리는 동안) 모든 노선을 받는다. 처음 열면 곧바로
  mapOpen() { if (performance.now() - (this.allAt || 0) > 1500) this.subT = 0; this.allAt = performance.now(); }
  // 큰 지도(서울 전체)용 점 (세상 좌표)
  mapDots() { if (!this.sub) return []; const out = []; for (const o of this.trains.values()) if (o.wx != null) out.push({ x: o.wx, z: o.wz, color: this.sub.lines[o.line].color }); return out; }
  stats() { let b3 = 0, t3 = 0; for (const o of this.buses.values()) if (o.mesh) b3++; for (const im of this.lineMesh.values()) t3 += im.body.count; return { buses: this.buses.size, bus3d: b3, trains: this.trains.size, cars3d: t3, busOK: this.busOK, subOK: this.subOK, src: this.busSrc }; }
  dispose() { for (const o of this.buses.values()) this.dropBus(o); this.buses.clear(); for (const im of this.lineMesh.values()) this.hg.scene.remove(im.body, im.win); this.lineMesh.clear(); this.trains.clear(); }
}
