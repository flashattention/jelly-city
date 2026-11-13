// 서울 명소 체험 2차 (8-18 2차): 광장시장 먹거리 골목 · 하늘공원 억새 · 낙산 성곽길 밤 산책 · 노들섬 노을 · 창덕궁 후원 부용지
//   상표 · 실제 상호 없이 일반 이름. 실내(먹거리 골목)는 서울 밖 먼 곳에 짓고 카메라만 옮긴다. 바깥 명소는 제자리(지형 높이)에 짓는다
//   참고(보기 전용, 위키미디어 공용): 광장시장 정문 · 부용지 파노라마 · 하늘공원 풍력 발전기 사진
import * as THREE from 'three';
import { registerAttraction, part, merge, vcMat, signTex, LL } from './hangang-attractions.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rndS = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const lit = (A, fn) => A.addLit(fn);
// 둥근 흐린 점 (김 · 음표 빛): 네모 점으로 보이지 않게
let DOT = null; const dotTex = () => DOT ||= (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
// 곰 대신 보이는 작은 젤리 손님 (몸 · 머리 · 귀, 색만 다르게)
function jelly(col, s = 1) { const p = []; p.push(part(new THREE.SphereGeometry(0.32, 10, 8), col, 0, 0.45, 0, 0, 0, 0, 1, 1.15, 0.9), part(new THREE.SphereGeometry(0.26, 10, 8), col, 0, 0.98, 0), part(new THREE.SphereGeometry(0.08, 6, 4), col, -0.17, 1.2, 0), part(new THREE.SphereGeometry(0.08, 6, 4), col, 0.17, 1.2, 0), part(new THREE.SphereGeometry(0.04, 6, 4), '#2a1c14', -0.08, 1.0, 0.23), part(new THREE.SphereGeometry(0.04, 6, 4), '#2a1c14', 0.08, 1.0, 0.23)); return p.map((g) => (g.scale(s, s, s), g)); }

// ============================================================
// 2-1 광장시장 먹거리 골목: 지붕 덮인 골목, 좌판 두 줄 (철판 빈대떡 · 육회 · 김밥 · 떡볶이 · 순대 · 칼국수)
//   실내는 먼 곳(MO)에 짓고, 체험하면 카메라가 그 골목으로. 메뉴를 고르면 그 좌판 의자에 앉아 음식이 나오고 먹는다
// ============================================================
const MARKET_ENT = LL(37.5700, 126.9990), MO = new THREE.Vector3(146000, 0, -26000);
const MENU = [['빈대떡', '녹두를 갈아 철판에 지진 두툼한 전', '#c98a3a'], ['육회', '양념한 생고기 · 배채 · 노른자', '#c83a3a'], ['꼬마김밥', '한입 크기 김밥 · 겨자 간장', '#2f4a2a'], ['떡볶이', '빨간 고추장 떡볶이 · 어묵', '#e0482a'], ['순대', '찹쌀 순대 · 간 · 허파', '#5a3a3a'], ['칼국수', '손으로 민 면 · 바지락 국물', '#e8dcc0']];
function foodMesh(i) {
  const p = [], plate = (c = '#f4f2ee', r = 0.22) => p.push(part(new THREE.CylinderGeometry(r, r * 0.8, 0.04, 20), c, 0, 0.02, 0));
  if (i === 0) { plate(); for (let k = 0; k < 2; k++) p.push(part(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), '#c98a3a', (k - 0.5) * 0.12, 0.06 + k * 0.03, 0)); }
  else if (i === 1) { plate('#2a2a2a'); p.push(part(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#b8282a', 0, 0.03, 0, 0, 0, 0, 1, 0.5, 1), part(new THREE.SphereGeometry(0.04, 8, 6), '#ffb020', 0, 0.09, 0)); for (let k = 0; k < 6; k++) p.push(part(new THREE.BoxGeometry(0.15, 0.01, 0.012), '#f0e6c8', Math.cos(k) * 0.13, 0.05, Math.sin(k) * 0.13, 0, k, 0)); }
  else if (i === 2) { plate(); for (let k = 0; k < 7; k++) { const g = new THREE.CylinderGeometry(0.03, 0.03, 0.035, 10); p.push(part(g, '#1c2a1c', Math.cos(k * 0.9) * 0.1, 0.04, Math.sin(k * 0.9) * 0.1), part(new THREE.CylinderGeometry(0.022, 0.022, 0.037, 8), '#f6f0e0', Math.cos(k * 0.9) * 0.1, 0.04, Math.sin(k * 0.9) * 0.1)); } }
  else if (i === 3) { plate('#2e6a3e'); for (let k = 0; k < 9; k++) p.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 6), '#f0ece0', Math.cos(k) * 0.1, 0.05, Math.sin(k * 1.7) * 0.1, Math.PI / 2, k, 0)); p.push(part(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 20), '#d8301c', 0, 0.035, 0)); }
  else if (i === 4) { plate(); for (let k = 0; k < 8; k++) p.push(part(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), '#3a2424', (k % 4 - 1.5) * 0.08, 0.04, (k > 3 ? 0.05 : -0.05), 0, 0, Math.PI / 2)); }
  else { p.push(part(new THREE.CylinderGeometry(0.17, 0.12, 0.12, 20), '#e8e4dc', 0, 0.06, 0), part(new THREE.CylinderGeometry(0.155, 0.155, 0.01, 20), '#e6d6a8', 0, 0.11, 0)); for (let k = 0; k < 5; k++) p.push(part(new THREE.SphereGeometry(0.025, 6, 4), '#6a5a48', Math.cos(k * 1.3) * 0.08, 0.12, Math.sin(k * 1.3) * 0.08)); }
  return new THREE.Mesh(merge(p), vcMat());
}
function buildMarketHall() {
  const g = new THREE.Group(); g.position.copy(MO); const p = [], L = 40, W = 9;
  // 바닥 · 양옆 가게 벽 · 지붕(반투명 채광판 + 철골)
  p.push(part(new THREE.BoxGeometry(W, 0.1, L), '#8f8a82', 0, -0.05, 0));
  for (let z = -L / 2; z <= L / 2; z += 1.2) p.push(part(new THREE.BoxGeometry(W, 0.012, 0.05), '#7d7870', 0, 0.006, z));
  for (const sx of [-1, 1]) { p.push(part(new THREE.BoxGeometry(0.3, 7, L), '#b8a88e', sx * (W / 2 + 2.6), 3.5, 0)); for (let z = -L / 2 + 2; z < L / 2; z += 4) p.push(part(new THREE.BoxGeometry(0.05, 2.6, 3.2), '#5a4a3a', sx * (W / 2 + 2.44), 1.6, z), part(new THREE.BoxGeometry(0.08, 0.7, 3.4), ['#d84a2a', '#2a6ad8', '#e8b82a', '#3a9a5a'][Math.abs(Math.round(z)) % 4], sx * (W / 2 + 2.42), 3.4, z)); }
  for (let z = -L / 2; z <= L / 2; z += 3) { const a = new THREE.TorusGeometry(W / 2 + 2.6, 0.08, 4, 20, Math.PI); p.push(part(a, '#6a7078', 0, 6.4, z)); }
  g.add(new THREE.Mesh(merge(p), vcMat()));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(W / 2 + 2.6, W / 2 + 2.6, L, 20, 1, true, Math.PI / 2, Math.PI), new THREE.MeshLambertMaterial({ color: '#f2e9cf', emissive: '#fff4d6', emissiveIntensity: 0.35, side: THREE.DoubleSide })); roof.rotation.x = Math.PI / 2; roof.position.y = 6.4; g.add(roof);
  // 좌판 두 줄 (가운데 길 양옆): 스테인리스 판 · 앞판 색 · 둥근 의자 · 매단 전등 · 음식 · 이름 판
  const stalls = []; const sp = [];
  for (let i = 0; i < 12; i++) { const sd = i % 2 ? 1 : -1, k = Math.floor(i / 2), z = -15 + k * 6, x = sd * 2.3, mi = i % MENU.length;
    sp.push(part(new THREE.BoxGeometry(1.8, 0.85, 4.6), '#c9c4bc', x, 0.42, z), part(new THREE.BoxGeometry(1.9, 0.04, 4.7), '#e4e8ea', x, 0.87, z), part(new THREE.BoxGeometry(0.04, 0.6, 4.6), MENU[mi][2], x - sd * 0.92, 0.45, z));
    for (let s = 0; s < 4; s++) sp.push(part(new THREE.CylinderGeometry(0.18, 0.16, 0.05, 12), '#d8402a', x - sd * 1.35, 0.5, z - 1.6 + s * 1.05), part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), '#8a8a8a', x - sd * 1.35, 0.25, z - 1.6 + s * 1.05));
    if (mi === 0) for (let s = 0; s < 3; s++) sp.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20), '#2a2a2a', x + sd * 0.3, 0.9, z - 1.4 + s * 1.4), part(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), '#c98a3a', x + sd * 0.3, 0.94, z - 1.4 + s * 1.4));
    stalls.push({ x, z, sd, mi }); }
  g.add(new THREE.Mesh(merge(sp), vcMat()));
  // 진열 음식 · 손님 젤리
  for (const S of stalls) for (let s = 0; s < 3; s++) { const f = foodMesh(S.mi); f.position.set(S.x + S.sd * 0.5, 0.89, S.z - 1.5 + s * 1.5); f.scale.setScalar(1.4); g.add(f); }
  const cust = []; const r = rndS(7); for (const S of stalls) for (let s = 0; s < 4; s++) if (r() < 0.45) { const j = jelly(['#ff9ec0', '#9ad0ff', '#ffd76a', '#a8e0a0', '#e8c8ff'][Math.floor(r() * 5)], 0.75); j.forEach((q) => { q.rotateY(S.sd > 0 ? -Math.PI / 2 : Math.PI / 2); q.translate(S.x - S.sd * 1.35, 0.5, S.z - 1.6 + s * 1.05); cust.push(q); }); }
  if (cust.length) g.add(new THREE.Mesh(merge(cust), vcMat()));
  // 이름 판 (좌판 위) · 매단 전등 (밤엔 따뜻하게)
  const bulbM = new THREE.MeshLambertMaterial({ color: '#fff1c8', emissive: '#ffcf80', emissiveIntensity: 0.9 });
  for (const S of stalls) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshLambertMaterial({ map: signTex(MENU[S.mi][0], '', '#3a2418', '#ffe8b8'), emissive: '#ffffff', emissiveIntensity: 0.25, side: THREE.DoubleSide })); sg.material.emissiveMap = sg.material.map; sg.position.set(S.x + S.sd * 0.6, 2.6, S.z); sg.rotation.y = S.sd > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(sg);
    for (let s = 0; s < 3; s++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbM); b.position.set(S.x, 2.1, S.z - 1.5 + s * 1.5); g.add(b); } }
  // 김 (철판 위로 오르는 하얀 점)
  const N = 90, pos = new Float32Array(N * 3), steam = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: '#ffffff', size: 0.6, map: dotTex(), transparent: true, opacity: 0.35, depthWrite: false })); steam.frustumCulled = false; g.add(steam);
  const pl = new THREE.PointLight('#ffd9a0', 2.2, 30, 1.6); pl.position.set(0, 4, 0); g.add(pl);
  g.userData = { stalls, steam, pos, N };
  return g;
}
registerAttraction({
  id: 'market', name: '광장시장 먹거리 골목', seal: '광장시장', icon: '🥘', x: MARKET_ENT[0], z: MARKET_ENT[1], r: 22, buildR: 900, verb: '골목에서 먹기',
  go: [MARKET_ENT[0], MARKET_ENT[1] + 10, Math.PI], intro: '지붕 덮인 시장 골목 좌판에서 빈대떡 · 육회 · 꼬마김밥을 주문해 먹어요',
  start(A) {
    const hg = A.hg; A.mkt ||= buildMarketHall(); const g = A.mkt; if (!g.parent) A.root.add(g); g.visible = true;
    const D = g.userData; let pick = null, food = null, bites = 0, sit = null, t0 = 0, yaw = 0;
    const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;left:50%;bottom:118px;transform:translateX(-50%);padding:12px 14px;border-radius:18px;background:rgba(14,20,36,.86);color:#fff;font-family:Jua,sans-serif;z-index:7;text-align:center;max-width:calc(100vw - 32px)';
    ui.innerHTML = `<div style="font-size:16px;margin-bottom:8px">🥘 무엇을 먹을까요?</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${MENU.map((m, i) => `<button data-i="${i}" style="border:0;border-radius:12px;padding:8px 10px;font-family:Jua,sans-serif;font-size:15px;background:#fff6e4;color:#3a2418;cursor:pointer">${m[0]}<br><small style="font:11px system-ui;opacity:.7">${m[1]}</small></button>`).join('')}</div>`;
    document.getElementById('hg-hud')?.appendChild(ui); if (document.pointerLockElement) document.exitPointerLock?.();
    const order = (i) => { pick = i; ui.remove(); sit = D.stalls.find((S) => S.mi === i) || D.stalls[0]; food = foodMesh(i); food.scale.setScalar(1.6); food.position.set(MO.x + sit.x - sit.sd * 0.75, 0.9, MO.z + sit.z); g.parent.add(food); t0 = E.t; hg.onToast?.(`🥘 ${MENU[i][0]} 나왔어요! E 로 한 입씩`); A.drum(0.4, 300, 0.1); };
    for (const b of ui.querySelectorAll('button')) b.onclick = () => order(+b.dataset.i);
    const E = {
      title: '광장시장 먹거리 골목', lock: true,
      status() { if (pick == null) return '좌판을 둘러보고 메뉴를 골라요'; return bites >= 4 ? '잘 먹었습니다! 😋' : `${MENU[pick][0]} · ${bites} / 4 입 · E 로 먹기`; },
      actLabel() { return pick != null && bites < 4 ? '😋 한 입' : ''; },
      act() { if (pick == null || bites >= 4) return; bites++; food.scale.setScalar(1.6 * (1 - bites * 0.22)); A.drum(0.3, 500, 0.06); if (bites >= 4) { this.doneT = this.t; } },
      tick(dt) {
        if (pick != null && bites < 4 && this.t - t0 > 4 + bites * 2.5) this.act(); // 가만히 있어도 천천히 먹는다
        if (this.doneT != null && this.t - this.doneT > 2.5) { A.finish(E); return; }
        const P = D.pos; for (let k = 0; k < D.N; k++) { const S = D.stalls[(k % 6) * 2], ph = (this.t * 0.6 + k * 0.137) % 1; P[k * 3] = MO.x + S.x + S.sd * 0.3 + Math.sin(k * 3.1) * 0.25 - MO.x; P[k * 3 + 1] = 1 + ph * 1.8; P[k * 3 + 2] = S.z - 1.4 + (k % 3) * 1.4 + Math.cos(k) * 0.2; } D.steam.geometry.attributes.position.needsUpdate = true;
        if (hg.bear) hg.bear.root.visible = false;
      },
      cam(camera, dt) {
        if (pick == null) { yaw = Math.sin(this.t * 0.25) * 0.5; camera.position.set(MO.x + Math.sin(yaw) * 1.2, 1.7, MO.z - 18 + Math.min(10, this.t * 0.8)); this.cp = camera.position.clone(); camera.lookAt(MO.x + Math.sin(yaw) * 4, 1.3, MO.z + 6); return; }
        const sx = MO.x + sit.x - sit.sd * 1.35, sz = MO.z + sit.z, want = new THREE.Vector3(sx - sit.sd * 0.3, 1.75, sz - 2.9); (this.cp ||= camera.position.clone()).lerp(want, 1 - Math.exp(-dt * 4)); camera.position.copy(this.cp); camera.lookAt(sx + sit.sd * 1.25, 0.95, sz - 0.2); // 손님 줄 끝에서 음식이 놓인 판을 본다
      },
      end() { ui.remove(); food?.parent?.remove(food); g.visible = false; if (hg.bear) hg.bear.root.visible = true; },
      where() { return '광장시장 먹거리 골목'; },
    };
    return E;
  },
});

// ============================================================
// 2-2 하늘공원 억새: 언덕 위 은빛 억새 들판(바람에 흔들림) · 데크 길 · 흰 풍력 발전기 다섯 (사진: 격자 기둥 위 세 날개)
// ============================================================
const HANEUL = LL(37.5685, 126.8853);
function grassTex() { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d'); c.clearRect(0, 0, 64, 128); for (let i = 0; i < 9; i++) { const x = 6 + i * 6 + Math.sin(i) * 3; c.strokeStyle = i % 2 ? '#8a9a5a' : '#a8a868'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, 128); c.quadraticCurveTo(x + 4, 70, x + (i - 4) * 2, 30); c.stroke(); } for (let i = 0; i < 6; i++) { const x = 12 + i * 8, gr = c.createLinearGradient(x, 0, x, 40); gr.addColorStop(0, 'rgba(255,250,240,.95)'); gr.addColorStop(1, 'rgba(230,220,200,.4)'); c.fillStyle = gr; c.beginPath(); c.ellipse(x + (i - 3) * 2, 22, 4, 20, (i - 3) * 0.12, 0, 7); c.fill(); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function buildHaneul(A) {
  const g = new THREE.Group(); A.root.add(g); const [cx, cz] = HANEUL, R = 150, r = rndS(1985);
  const geo = new THREE.PlaneGeometry(1.4, 1.9); geo.translate(0, 0.95, 0); const g2 = geo.clone(); g2.rotateY(Math.PI / 2); const tuft = merge([geo, g2]);
  const U = { uT: { value: 0 } }, m = new THREE.MeshLambertMaterial({ map: grassTex(), alphaTest: 0.4, side: THREE.DoubleSide, color: '#fffaf0' });
  m.onBeforeCompile = (sh) => { sh.uniforms.uT = U.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float k = clamp(position.y / 1.9, 0.0, 1.0); transformed.x += sin(uT * 1.7 + ip.x * 0.15 + ip.z * 0.11) * 0.28 * k * k; transformed.z += cos(uT * 1.3 + ip.z * 0.13) * 0.12 * k * k; }'); }; m.customProgramCacheKey = () => 'eulalia';
  const N = 5200, im = new THREE.InstancedMesh(tuft, m, N), o = new THREE.Object3D(), col = new THREE.Color(); let n = 0;
  for (let t = 0; t < N * 3 && n < N; t++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (Math.abs((x - cx) - (z - cz) * 0.3) < 2.2) continue; o.position.set(x, A.H(x, z) - 0.05, z); o.rotation.set(0, r() * 6.28, 0); const s = 0.8 + r() * 0.6; o.scale.set(s, s * (0.9 + r() * 0.4), s); o.updateMatrix(); im.setMatrixAt(n, o.matrix); im.setColorAt(n, col.setHSL(0.11 + r() * 0.04, 0.25, 0.75 + r() * 0.15)); n++; }
  im.count = n; im.frustumCulled = false; g.add(im);
  // 데크 길 (들판을 가로지르는 나무 판)
  const deck = []; for (let d = -R; d <= R; d += 1) { const x = cx + d * 0.3 / 1.044, z = cz + d / 1.044; deck.push(part(new THREE.BoxGeometry(2.2, 0.12, 1.02), '#9a7448', x, A.H(x, z) + 0.15, z, 0, Math.atan2(0.3, 1), 0)); }
  g.add(new THREE.Mesh(merge(deck), vcMat()));
  // 풍력 발전기 다섯: 격자 기둥(가는 원통 + 가로대) · 머리 · 세 날개 (돈다)
  const rotors = [];
  for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.4, x = cx + Math.cos(a) * (R * 0.72), z = cz + Math.sin(a) * (R * 0.72), y = A.H(x, z), mast = [];
    for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]]) mast.push(part(new THREE.CylinderGeometry(0.04, 0.07, 14, 5), '#e8ecef', x + dx * 0.5, y + 7, z + dz * 0.5));
    for (let h = 1; h < 14; h += 1.6) mast.push(part(new THREE.BoxGeometry(0.4, 0.04, 0.04), '#e8ecef', x, y + h, z), part(new THREE.BoxGeometry(0.04, 0.04, 0.4), '#e8ecef', x, y + h, z));
    mast.push(part(new THREE.BoxGeometry(0.4, 0.4, 0.9), '#f4f6f6', x, y + 14.2, z)); g.add(new THREE.Mesh(merge(mast), vcMat()));
    const rot = new THREE.Group(); rot.position.set(x, y + 14.2, z + 0.5); const bl = []; for (let b = 0; b < 3; b++) bl.push(part(new THREE.BoxGeometry(0.18, 3.2, 0.04), '#ffffff', Math.sin((b * Math.PI * 2) / 3) * 1.6, Math.cos((b * Math.PI * 2) / 3) * 1.6, 0, 0, 0, -(b * Math.PI * 2) / 3)); rot.add(new THREE.Mesh(merge(bl), vcMat())); g.add(rot); rotors.push(rot); }
  return { group: g, tick(dt) { U.uT.value += dt; for (const ro of rotors) ro.rotation.z -= dt * 2.2; }, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'haneul', name: '하늘공원 억새', seal: '하늘공원', icon: '🌾', x: HANEUL[0], z: HANEUL[1] + 40, r: 40, buildR: 1000, verb: '억새길 걷기',
  go: [HANEUL[0] + 12, HANEUL[1] + 45, Math.PI], intro: '언덕 위 은빛 억새 들판 · 바람에 흔들리는 억새 사이 데크 길 · 풍력 발전기',
  build: buildHaneul,
  start(A) {
    const hg = A.hg, s0 = hg.opt.season, st0 = hg.state.season, h0 = hg.state.hour; hg.setOpt('season', 'autumn'); if (h0 < 15 || h0 > 19) hg.state.hour = 17.4;
    hg.onToast?.('🌾 가을 노을 · 억새 사이를 걸어 봐요 (W A S D)');
    const E = { title: '하늘공원 억새길', lock: false,
      status() { return this.t < 30 ? `억새 사이를 걸어요 · ${Math.ceil(30 - this.t)}초` : '다 걸었으면 E'; },
      actLabel() { return this.t >= 30 ? '🌾 다 걸었어요' : ''; },
      act() { if (this.t >= 30) A.finish(E); },
      tick() { if (Math.hypot(hg.px - HANEUL[0], hg.pz - HANEUL[1]) > 400) A.finish(E, true); },
      end() { hg.setOpt('season', st0); hg.opt.season = s0; },
      where() { return '하늘공원 억새 들판'; } };
    return E;
  },
});

// ============================================================
// 2-3 낙산 성곽길 밤 산책: 흥인지문 → 낙산 정상 → 혜화문 쪽 한양도성 (돌 성벽 · 위 여장 · 길가 밤 등)
//   성벽은 길 동쪽(바깥)에. 체험하면 밤이 되고 곰이 길을 따라 정상까지 걸어 올라간다
// ============================================================
const NAKSAN = [[37.5715, 127.0094], [37.5745, 127.0085], [37.5776, 127.0081], [37.5806, 127.0075], [37.5838, 127.0062], [37.5862, 127.0044], [37.5876, 127.0022]].map(([a, b]) => LL(a, b));
function buildNaksan(A) {
  const g = new THREE.Group(); A.root.add(g); const p = [], lamps = [], r = rndS(1396);
  for (let i = 1; i < NAKSAN.length; i++) { const [ax, az] = NAKSAN[i - 1], [bx, bz] = NAKSAN[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux, ry = Math.atan2(ux, uz);
    for (let t = 0; t < L; t += 3) { const x = ax + ux * t + nx * 3, z = az + uz * t + nz * 3, y = A.H(x, z), c = ['#b9b2a3', '#a9a293', '#c4bdae', '#9f998c'][Math.floor(r() * 4)];
      p.push(part(new THREE.BoxGeometry(2.2, 4.2, 3.05), c, x, y + 1.6, z, 0, ry, 0));
      for (let k = 0; k < 4; k++) p.push(part(new THREE.BoxGeometry(2.2, 0.02, 3.06), '#8a8478', x, y + 0.5 + k * 0.9, z, 0, ry, 0));
      if (Math.floor(t / 3) % 2 === 0) p.push(part(new THREE.BoxGeometry(0.7, 0.9, 2.4), '#cfc9bc', x + nx * 0.75, y + 4.15, z + nz * 0.75, 0, ry, 0)); else p.push(part(new THREE.BoxGeometry(0.7, 0.6, 2.4), '#cfc9bc', x + nx * 0.75, y + 4.0, z + nz * 0.75, 0, ry, 0));
      if (Math.floor(t / 3) % 8 === 0) lamps.push([ax + ux * t - nx * 2.2, az + uz * t - nz * 2.2]); }
    for (let t = 0; t < L; t += 2) { const x = ax + ux * t - nx * 0.4, z = az + uz * t - nz * 0.4; p.push(part(new THREE.BoxGeometry(3, 0.08, 2.05), '#b8ab94', x, A.H(x, z) + 0.06, z, 0, ry, 0)); }
  }
  g.add(new THREE.Mesh(merge(p), vcMat()));
  const lm = new THREE.MeshLambertMaterial({ color: '#fff0c8', emissive: '#ffcf80', emissiveIntensity: 0 }), lp = [], glows = [];
  for (const [x, z] of lamps) { const y = A.H(x, z); lp.push(part(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), '#3a3d42', x, y + 1.6, z)); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lm); b.position.set(x, y + 3.3, z); g.add(b); glows.push(b); }
  g.add(new THREE.Mesh(merge(lp), vcMat())); lit(A, (L) => { lm.emissiveIntensity = 0.1 + L * 1.4; });
  // 길을 따라가는 점들 (걷기용)
  const path = []; for (let i = 1; i < NAKSAN.length; i++) { const [ax, az] = NAKSAN[i - 1], [bx, bz] = NAKSAN[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L; for (let t = 0; t < L; t += 2) path.push([ax + ux * t - uz * 0.4, az + uz * t + ux * 0.4]); }
  A.naksanPath = path;
  return { group: g, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'naksan', name: '낙산 성곽길', seal: '낙산', icon: '🏯', x: NAKSAN[1][0] - 6, z: NAKSAN[1][1], pts: NAKSAN.slice(0, 4).map(([x, z]) => [x - 6, z]), r: 26, buildR: 1400, verb: '밤 산책',
  go: [NAKSAN[1][0] - 8, NAKSAN[1][1] + 6, 0], intro: '흥인지문에서 낙산 정상까지 한양도성 성곽을 따라 걷는 밤길 · 아래로 도시 불빛',
  build: buildNaksan,
  start(A) {
    const hg = A.hg, P = A.naksanPath; if (!P) return null; const h0 = hg.state.hour; if (h0 > 5 && h0 < 19.5) hg.state.hour = 20.3;
    let i0 = 0, bd = Infinity; P.forEach(([x, z], i) => { const d = Math.hypot(x - hg.px, z - hg.pz); if (d < bd) { bd = d; i0 = i; } }); const iEnd = Math.min(P.length - 1, Math.round(P.length * 0.62)); if (i0 > iEnd - 40) i0 = 0;
    let u = i0, yawSet = false;
    const E = { title: '낙산 성곽길 밤 산책', lock: true,
      status() { return u >= iEnd ? '🌃 낙산 정상 · 서울 밤 풍경' : `성곽을 따라 걷는 중 · 정상까지 ${Math.round((iEnd - u) * 2)}m · 마우스로 둘러보기`; },
      tick(dt) { u = Math.min(iEnd, u + dt * 4.5); const k = Math.floor(u), f = u - k, a = P[k], b = P[Math.min(P.length - 1, k + 1)], x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; hg.px = x; hg.pz = z; hg.y = 0; hg.v = 2.2; hg.face = Math.atan2(b[0] - a[0], b[1] - a[1]);
        if (!yawSet) { hg.camYaw = hg.face + 0.5; hg.camPitch = 0.2; yawSet = true; } if (u >= iEnd) { this.top ||= this.t; hg.v = 0; if (this.t - this.top > 8) A.finish(E); } },
      end() {}, where() { return '낙산 성곽길'; } };
    return E;
  },
});

// ============================================================
// 2-4 노들섬: 한강대교 가운데 섬의 잔디 언덕 · 작은 거리 공연 무대 · 강 위 노을
// ============================================================
const NODEUL = LL(37.5176, 126.9573);
function buildNodeul(A) {
  const g = new THREE.Group(); A.root.add(g); const [x, z] = NODEUL, y = A.H(x, z), p = [];
  for (let k = 0; k < 6; k++) p.push(part(new THREE.BoxGeometry(30 - k * 2, 0.45, 1.8), k % 2 ? '#7aa858' : '#86b462', x, y + 0.22 + k * 0.45, z - 6 - k * 1.8));
  p.push(part(new THREE.CylinderGeometry(4, 4, 0.5, 24), '#cfc8bb', x, y + 0.25, z + 6), part(new THREE.BoxGeometry(0.12, 3.2, 0.12), '#3a3d42', x - 3, y + 1.6, z + 7.5), part(new THREE.BoxGeometry(0.12, 3.2, 0.12), '#3a3d42', x + 3, y + 1.6, z + 7.5), part(new THREE.BoxGeometry(6.4, 0.2, 0.2), '#3a3d42', x, y + 3.2, z + 7.5));
  jelly('#ffb0c8', 1.1).forEach((q) => { q.translate(x, y + 0.5, z + 6); p.push(q); }); p.push(part(new THREE.BoxGeometry(0.5, 0.15, 0.12), '#c98a3a', x + 0.3, y + 1.45, z + 6.3, 0, 0, 0.6), part(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), '#2a2a2a', x - 0.8, y + 1.25, z + 6.6));
  const r = rndS(31); for (let i = 0; i < 14; i++) jelly(['#9ad0ff', '#ffd76a', '#a8e0a0', '#e8c8ff', '#ff9ec0'][i % 5], 0.8).forEach((q) => { q.rotateY(Math.PI); const k = i % 6; q.translate(x - 12 + r() * 24, y + 0.45 + k * 0.45, z - 6 - k * 1.8); p.push(q); });
  g.add(new THREE.Mesh(merge(p), vcMat()));
  const notes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3)), new THREE.PointsMaterial({ color: '#fff4c0', size: 0.6, map: dotTex(), transparent: true, opacity: 0.85, depthWrite: false })); notes.frustumCulled = false; g.add(notes);
  const lightM = new THREE.MeshLambertMaterial({ color: '#fff2d0', emissive: '#ffd890', emissiveIntensity: 0 }); for (const sx of [-3, 3]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lightM); b.position.set(x + sx, y + 3.0, z + 7.4); g.add(b); } lit(A, (L) => { lightM.emissiveIntensity = 0.2 + L * 1.5; });
  return { group: g, tick(dt) { const P = notes.geometry.attributes.position; for (let i = 0; i < 30; i++) { const ph = (A.hg.time * 0.4 + i / 30) % 1; P.setXYZ(i, x + Math.sin(i * 2.3) * (0.5 + ph * 3), y + 1.6 + ph * 4, z + 6 - ph * 3); } P.needsUpdate = true; }, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'nodeul', name: '노들섬 노을', seal: '노들섬', icon: '🌅', x: NODEUL[0], z: NODEUL[1] - 14, r: 24, buildR: 900, verb: '잔디에 앉기',
  go: [NODEUL[0], NODEUL[1] - 20, Math.PI], intro: '한강대교 가운데 섬 잔디 계단에 앉아 거리 공연과 강 노을을 봐요',
  build: buildNodeul,
  start(A) {
    const hg = A.hg, [x, z] = NODEUL, h0 = hg.state.hour; if (h0 < 17 || h0 > 19.6) hg.state.hour = 18.1;
    hg.placeAt(x + 2, z - 9.6, 0); hg.y = 1.35;
    const E = { title: '노들섬 잔디 계단', lock: true,
      status() { return this.t < 20 ? `🎸 거리 공연 · 강 위 노을 · ${Math.ceil(20 - this.t)}초` : '노을을 다 봤어요'; },
      tick() { hg.y = 1.35; hg.v = 0; if (this.t > 22) A.finish(E); },
      floor(px, pz) { return Math.hypot(px - x, pz - z + 9) < 16 ? 1.35 : -1; },
      cam(camera, dt) { const want = new THREE.Vector3(x - 4, A.H(x, z) + 6.5, z - 22); if (this.t < 0.1) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-dt * 3)); camera.lookAt(x - 20 + this.t * 0.6, A.H(x, z) + 2.5, z + 40); },
      end() { hg.y = 0; }, where() { return '노들섬 잔디 계단'; } };
    return E;
  },
});

// ============================================================
// 2-5 창덕궁 후원 부용지 (사진: 네모 연못 · 돌 축대 · 가운데 둥근 섬과 소나무 · 두 돌기둥을 물에 담근 부용정 · 언덕 위 주합루 · 동쪽 영화당)
//   주합루(지도 1123, -5758) 남쪽에 연못. 부용정은 남쪽 가장자리, 영화당은 동쪽
// ============================================================
const JUHAP = [1123, -5758], POND = [1121, -5716];
function hanok(p, x, y, z, w, d, h, ry, opts = {}) {
  const c = Math.cos(ry), s = Math.sin(ry), W = (a, b) => [x + a * c + b * s, z - a * s + b * c];
  p.push(part(new THREE.BoxGeometry(w + 1, opts.base ?? 0.6, d + 1), '#b9b2a3', x, y + (opts.base ?? 0.6) / 2, z, 0, ry, 0));
  const yb = y + (opts.base ?? 0.6); for (const a of [-w / 2, -w / 6, w / 6, w / 2]) for (const b of [-d / 2, d / 2]) { const [px, pz] = W(a, b); p.push(part(new THREE.CylinderGeometry(0.16, 0.18, h, 8), '#8a2a22', px, yb + h / 2, pz)); }
  p.push(part(new THREE.BoxGeometry(w - 0.2, h * 0.75, d - 0.2), '#efe6d2', x, yb + h * 0.42, z, 0, ry, 0));
  p.push(part(new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), '#3a6a5a', x, yb + h, z, 0, ry, 0)); // 단청 띠(초록)
  const roof = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1); roof.rotateY(Math.PI / 4); roof.scale((w + 2.4) / Math.SQRT2 * 1.0, h * 0.75, (d + 2.4) / Math.SQRT2); p.push(part(roof, '#4a4a4c', x, yb + h + 0.2 + h * 0.37, z, 0, ry, 0));
  const ridge = new THREE.BoxGeometry(w * 0.5, 0.28, 0.35); p.push(part(ridge, '#2f2f30', x, yb + h + 0.2 + h * 0.74, z, 0, ry, 0));
}
function buildHuwon(A) {
  const g = new THREE.Group(); A.root.add(g); const [x, z] = POND, y = A.H(x, z), p = [], PW = 34, PD = 29, wy = y - 1.3;
  // 연못 둘레 돌 축대(네모) · 물 · 둥근 섬 · 소나무
  for (const [cx, cz, w, d] of [[x, z - PD / 2, PW + 2, 1], [x, z + PD / 2, PW + 2, 1], [x - PW / 2, z, 1, PD], [x + PW / 2, z, 1, PD]]) p.push(part(new THREE.BoxGeometry(w, 1.6, d), '#a9a293', cx, wy + 0.6, cz));
  p.push(part(new THREE.CylinderGeometry(3.2, 3.4, 1.6, 24), '#9f998c', x + 2, wy + 0.5, z - 2), part(new THREE.CylinderGeometry(3.0, 3.0, 0.2, 24), '#6a8a4a', x + 2, wy + 1.35, z - 2));
  p.push(part(new THREE.CylinderGeometry(0.18, 0.26, 3.4, 7), '#6a4a32', x + 2.2, wy + 3.0, z - 2.1, 0, 0, 0.25), part(new THREE.SphereGeometry(2.2, 10, 6), '#3f6a3a', x + 1.4, wy + 4.8, z - 2, 0, 0, 0, 1.3, 0.45, 1.1), part(new THREE.SphereGeometry(1.6, 10, 6), '#4a7a40', x + 3.2, wy + 4.2, z - 1.6, 0, 0, 0, 1.2, 0.4, 1));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(PW - 1, PD - 1), new THREE.MeshPhongMaterial({ color: '#5f6e3a', specular: '#ffffff', shininess: 80, transparent: true, opacity: 0.92 })); water.rotation.x = -Math.PI / 2; water.position.set(x, wy + 0.05, z); g.add(water);
  for (let i = 0; i < 9; i++) p.push(part(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 10), '#5a8a3a', x - 8 + (i % 3) * 1.1, wy + 0.08, z + 6 + Math.floor(i / 3) * 0.9)); // 연잎
  // 부용정: 남쪽 가장자리, 두 돌기둥을 물에 담근 십자 정자 (북쪽 연못을 본다)
  const bx = x - 7, bz = z + PD / 2 + 2.5; hanok(p, bx, y, bz, 6, 5, 2.8, Math.PI, { base: 0.5 }); for (const sx of [-1.4, 1.4]) p.push(part(new THREE.BoxGeometry(0.5, 2.4, 0.5), '#b9b2a3', bx + sx, wy + 1.0, bz - 3.6)); p.push(part(new THREE.BoxGeometry(4.2, 0.35, 2.6), '#8a2a22', bx, y + 0.6, bz - 3.4), part(new THREE.BoxGeometry(4.4, 0.6, 0.1), '#8a2a22', bx, y + 1.1, bz - 4.7));
  // 주합루 (언덕 위 2층) · 영화당 (동쪽)
  const jy = A.H(JUHAP[0], JUHAP[1]); hanok(p, JUHAP[0], jy, JUHAP[1], 14, 8, 3.2, 0, { base: 1.2 }); hanok(p, JUHAP[0], jy + 4.9, JUHAP[1], 12, 6.5, 2.6, 0, { base: 0.3 });
  for (let k = 0; k < 6; k++) p.push(part(new THREE.BoxGeometry(5, 0.3, 0.8), '#b9b2a3', JUHAP[0], y + 0.15 + k * ((jy - y) / 6), z - PD / 2 - 1.5 - k * 0.8));
  hanok(p, x + PW / 2 + 6, y, z + 2, 6, 11, 3, Math.PI / 2, { base: 0.8 });
  g.add(new THREE.Mesh(merge(p), vcMat()));
  return { group: g, dispose() { g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'huwon', name: '창덕궁 후원 부용지', seal: '후원', icon: '🪷', x: POND[0] - 20, z: POND[1] + 18, r: 26, buildR: 900, verb: '연못가 거닐기',
  go: [POND[0] - 22, POND[1] + 20, -2.4], intro: '네모난 연못 · 가운데 둥근 섬 · 연못에 발을 담근 부용정 · 언덕 위 주합루',
  build: buildHuwon,
  start(A) {
    const hg = A.hg, [x, z] = POND; let yaw = -2.4;
    const E = { title: '창덕궁 후원 부용지', lock: true,
      status() { return this.t < 24 ? `연못가를 천천히 돌아요 · 마우스로 둘러보기 · ${Math.ceil(24 - this.t)}초` : '다 둘러봤어요'; },
      tick(dt) { yaw += dt * 0.11; const R = 24, px = x + Math.sin(yaw) * R * 0.85, pz = z + Math.cos(yaw) * R * 0.75; hg.px = px; hg.pz = pz; hg.y = 0; hg.v = 1.2; hg.face = yaw + Math.PI / 2; if (this.t > 26) A.finish(E); },
      cam(camera, dt) { const y = A.H(x, z), want = new THREE.Vector3(x + Math.sin(yaw - 0.35) * 30, y + 5, z + Math.cos(yaw - 0.35) * 27); if (this.t < 0.1) camera.position.copy(want); else camera.position.lerp(want, 1 - Math.exp(-dt * 2)); camera.lookAt(x, y + 1, z - 4); },
      end() { hg.placeAt(x - 22, z + 20, -2.4); }, where() { return '창덕궁 후원 부용지'; } };
    return E;
  },
});
