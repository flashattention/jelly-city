// 한강 산책: 지하철역 안 (대합실 · 승강장 · 열차)
//   바깥 세상과 겹치지 않게 아주 먼 곳(x 9만 m 근처)에 역마다 하나씩 짓는다. 들어가 있는 동안 바깥은 숨긴다
//   실제 내부를 그대로 옮기진 않지만 서울 지하철역 느낌으로: 반짝이는 타일 바닥 · 호선 색 띠 · 천장 조명 · 개찰구 · 발매기 · 출구 안내 · 스크린도어 · 점자블록 · 역 이름판
import * as THREE from 'three';

export const LINE_COLOR2 = { 1: '#0052A4', 2: '#00A84D', 3: '#EF7C1C', 4: '#00A5DE', 5: '#996CAC', 6: '#CD7C2F', 7: '#747F00', 8: '#E6186C', 9: '#BDB092', 경의중앙: '#77C4A3', 공항: '#0090D2', 신림: '#6789CA' };
// 여의도 둘레 노선의 실제 역 순서 (승강장 이름판의 이전 · 다음 역)
const LINE_SEQ = {
  1: ['용산', '노량진', '대방', '신길', '영등포', '신도림'],
  2: ['이대', '신촌', '홍대입구', '합정', '당산', '영등포구청'],
  5: ['애오개', '공덕', '마포', '여의나루', '여의도', '신길', '영등포시장', '영등포구청'],
  6: ['효창공원앞', '공덕', '대흥', '광흥창', '상수', '합정', '망원', '마포구청'],
  9: ['선유도', '당산', '국회의사당', '여의도', '샛강', '노량진', '노들', '흑석'],
  신림: ['샛강', '대방', '서울지방병무청', '보라매'],
  경의중앙: ['가좌', '홍대입구', '서강대', '공덕', '효창공원앞', '용산'],
  공항: ['디지털미디어시티', '홍대입구', '공덕', '서울역'],
};
// 호선별 열차 모습 (실제 차량 느낌): 몸체 색 · 띠 색 · 띠 두께
const TRAIN_LOOK = {
  1: { body: '#d9dde2', band: '#1d4fa8', band2: '#d8352a' }, 2: { body: '#dfe3e6', band: '#00A84D' }, 5: { body: '#d6dade', band: '#996CAC' }, 6: { body: '#d6dade', band: '#CD7C2F' },
  9: { body: '#e3e1da', band: '#BDB092', band2: '#8a6d3b' }, 신림: { body: '#e8eaec', band: '#6789CA' }, 경의중앙: { body: '#e3e6e3', band: '#77C4A3' }, 공항: { body: '#f2f4f6', band: '#0090D2' },
};
const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const lam = (o) => new THREE.MeshLambertMaterial(o), phong = (o) => new THREE.MeshPhongMaterial(o);

export function buildStation(hg, st, si, exitRefs) {
  const O = new THREE.Vector3(90000 + si * 700, 0, 0), g = new THREE.Group(); g.position.copy(O); g.visible = false; hg.scene.add(g);
  const lines = st.lines.length ? st.lines : [5], col0 = LINE_COLOR2[lines[0]] || '#888', foots = [], zones = [];
  const wall = (x0, z0, x1, z1, h = 4.4) => { const f = { ring: [[O.x + x0, z0], [O.x + x1, z0], [O.x + x1, z1], [O.x + x0, z1]], h, x0: O.x + Math.min(x0, x1), x1: O.x + Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), name: '', type: 'stone', noClimb: true }; foots.push(f); hg.addFoot(f); };
  const box = (w, h, d, m, x, y, z, parent = g) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); parent.add(me); return me; };
  const plane = (w, h, m, x, y, z, ry = 0, parent = g) => { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.y = ry; parent.add(me); return me; };
  // 재료: 연회색 타일 바닥(반짝) · 흰 패널 벽 · 호선 색 띠 · 천장 · 조명
  const floorT = tex(256, 256, (c) => { c.fillStyle = '#d9d6d0'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#d2cfc8' : '#dedbd4'; c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } }); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  const wallT = tex(256, 128, (c) => { c.fillStyle = '#f1efea'; c.fillRect(0, 0, 256, 128); c.fillStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x < 256; x += 64) c.fillRect(x, 0, 2, 128); c.fillRect(0, 63, 256, 1); }); wallT.wrapS = wallT.wrapT = THREE.RepeatWrapping;
  const wallM = lam({ map: wallT }), ceilM = lam({ color: '#e9e7e2' }), lineM = lam({ color: col0, emissive: col0, emissiveIntensity: 0.15 }), darkM = lam({ color: '#3a3f47' }), steelM = phong({ color: '#c9cdd2', shininess: 90 }), lightM = new THREE.MeshBasicMaterial({ color: '#fff7e8' }), tactM = lam({ color: '#e8c22a' });
  const ground = (w, d, x, z) => { const t2 = floorT.clone(); t2.needsUpdate = true; t2.repeat.set(w / 4, d / 4); const m = plane(w, d, phong({ map: t2, shininess: 70, specular: '#ffffff' }), x, 0.01, z); m.rotation.x = -Math.PI / 2; const c = plane(w, d, ceilM, x, 4.6, z); c.rotation.x = Math.PI / 2; for (let lx = x - w / 2 + 3; lx < x + w / 2 - 1; lx += 6) box(0.5, 0.04, d * 0.86, lightM, lx, 4.56, z); };
  const sideWall = (w, x, z, ry) => { const t2 = wallT.clone(); t2.needsUpdate = true; t2.repeat.set(w / 4, 1); const m = plane(w, 4.6, lam({ map: t2 }), x, 2.3, z, ry); void m; const b = plane(w, 0.32, lineM, x, 2.75, z + (ry === 0 ? 0.01 : ry === Math.PI ? -0.01 : 0), ry); if (ry === Math.PI / 2) b.position.x += 0.01; if (ry === -Math.PI / 2) b.position.x -= 0.01; };

  // ---------- 대합실 (48 × 18 m) ----------
  const CW = 48, CD = 18; ground(CW, CD, 0, 0);
  sideWall(CW, 0, -CD / 2, 0); sideWall(CW, 0, CD / 2, Math.PI); sideWall(CD, -CW / 2, 0, Math.PI / 2); sideWall(CD, CW / 2, 0, -Math.PI / 2);
  wall(-CW / 2 - 0.5, -CD / 2 - 0.5, CW / 2 + 0.5, -CD / 2); wall(-CW / 2 - 0.5, CD / 2, CW / 2 + 0.5, CD / 2 + 0.5); wall(-CW / 2 - 0.5, -CD / 2, -CW / 2, CD / 2); wall(CW / 2, -CD / 2, CW / 2 + 0.5, CD / 2);
  // 역 이름 큰 판 (호선 색 동그라미 + 한글 이름)
  const nameT = tex(1024, 160, (c, w, h) => { c.fillStyle = '#2b3039'; c.fillRect(0, 0, w, h); lines.forEach((l, i) => { c.fillStyle = LINE_COLOR2[l] || '#888'; c.beginPath(); c.arc(80 + i * 96, h / 2, 40, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = `bold ${String(l).length > 1 ? 24 : 48}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(l).slice(0, 2), 80 + i * 96, h / 2 + 2); }); c.fillStyle = '#fff'; c.font = 'bold 84px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(st.name, 60 + lines.length * 96, h / 2 + 4); });
  const nameM = lam({ map: nameT, emissive: '#ffffff', emissiveMap: nameT, emissiveIntensity: 0.55 });
  plane(9, 1.4, nameM, 0, 3.5, -CD / 2 + 0.03); plane(9, 1.4, nameM, 0, 3.5, CD / 2 - 0.03, Math.PI);
  // 개찰구 줄 (x = 6): 문 사이로 지나간다. 초록 화살표 · 카드 찍는 곳
  const gateM = phong({ color: '#b9bec4', shininess: 60 }), arrowT = tex(64, 64, (c) => { c.fillStyle = '#111'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#29d07a'; c.beginPath(); c.moveTo(14, 20); c.lineTo(38, 20); c.lineTo(38, 10); c.lineTo(56, 32); c.lineTo(38, 54); c.lineTo(38, 44); c.lineTo(14, 44); c.fill(); }), arrowM = new THREE.MeshBasicMaterial({ map: arrowT });
  for (let z = -6.6; z <= 6.6; z += 1.65) { box(1.6, 1.0, 0.28, gateM, 6, 0.5, z); plane(0.22, 0.22, arrowM, 5.18, 0.95, z, -Math.PI / 2); box(0.2, 0.06, 0.18, lam({ color: '#2a8cff', emissive: '#2a8cff', emissiveIntensity: 0.6 }), 6.5, 1.03, z); hg.addCircle(O.x + 6, z, 0.2, 1.1); hg.addCircle(O.x + 5.4, z, 0.16, 1.1); hg.addCircle(O.x + 6.6, z, 0.16, 1.1); }
  wall(5.2, -CD / 2, 6.8, -7.4, 1.1); wall(5.2, 7.4, 6.8, CD / 2, 1.1);
  // 발매기 · 교통카드 충전기 (벽 앞)
  const kioskT = tex(128, 192, (c) => { c.fillStyle = '#2f6fb7'; c.fillRect(0, 0, 128, 192); c.fillStyle = '#cfe8ff'; c.fillRect(16, 24, 96, 70); c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.fillText('승차권 발매', 64, 120); c.fillStyle = '#ffd23f'; c.fillRect(40, 140, 48, 10); });
  const kioskM = lam({ map: kioskT, emissive: '#ffffff', emissiveMap: kioskT, emissiveIntensity: 0.3 });
  for (let i = 0; i < 4; i++) { const k = box(1.0, 1.8, 0.6, [darkM, darkM, darkM, darkM, kioskM, darkM], -0.5 + i * 1.3, 0.9, -CD / 2 + 0.4); void k; hg.addCircle(O.x - 0.5 + i * 1.3, -CD / 2 + 0.6, 0.55, 1.8); }
  // 기둥 (원형, 호선 색 띠)
  for (const x of [-16, -8, 14, 20]) for (const z of [-4.5, 4.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.6, 16), wallM); c.position.set(x, 2.3, z); g.add(c); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.3, 16), lineM); b.position.set(x, 2.75, z); g.add(b); hg.addCircle(O.x + x, z, 0.5, 4.6); }
  // 출구 계단 (서쪽 끝 · 출구마다 하나씩, 노란 번호판)
  const refs = exitRefs.length ? exitRefs : ['1'], n = refs.length, exitT = (ref) => tex(256, 96, (c) => { c.fillStyle = '#2b3039'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#f6c400'; c.fillRect(10, 10, 76, 76); c.fillStyle = '#111'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ref, 48, 50); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.fillText('나가는 곳', 168, 40); c.font = '18px sans-serif'; c.fillText('Exit', 168, 70); });
  refs.forEach((ref, i) => {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), x = -CW / 2 + 4 + k * 6.5, z = side * (CD / 2 - 1.8);
    for (let q = 0; q < 6; q++) { box(3, 0.12, 0.5, lam({ color: '#a8a49c' }), x, 0.06 + q * 0.18, z + side * (-1.2 + q * 0.45)); box(3, 0.02, 0.06, tactM, x, 0.13 + q * 0.18, z + side * (-1.4 + q * 0.45)); }
    const em = lam({ map: exitT(ref), emissive: '#ffffff', emissiveMap: exitT(ref), emissiveIntensity: 0.6 }); plane(2.6, 0.95, em, x, 3.3, z - side * 1.6, side > 0 ? Math.PI : 0); plane(2.6, 0.95, em, x, 3.3, z - side * 1.6 + side * 0.02, side > 0 ? 0 : Math.PI);
    zones.push({ kind: 'exit', ref, x: O.x + x, z: z + side * 0.6, r: 1.4 });
  });
  // 승강장 가는 계단 (동쪽 · 호선마다)
  lines.forEach((l, i) => {
    const z = (i - (lines.length - 1) / 2) * 7, x = CW / 2 - 3.5, lc = LINE_COLOR2[l] || '#888';
    for (let q = 0; q < 6; q++) box(0.5, 0.1, 3.4, lam({ color: '#a8a49c' }), x + q * 0.42, -0.05 - q * 0.0, z);
    box(0.05, 1.0, 3.6, steelM, x + 1.2, 0.95, z - 1.8); box(0.05, 1.0, 3.6, steelM, x + 1.2, 0.95, z + 1.8);
    const t = tex(320, 96, (c) => { c.fillStyle = lc; c.fillRect(0, 0, 320, 96); c.fillStyle = '#fff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${l}${String(l).length === 1 ? '호선' : '선'} 타는 곳`, 160, 36); c.font = '18px sans-serif'; c.fillText('To Platform  ↓', 160, 72); });
    plane(3.2, 0.95, lam({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.6 }), x - 1.6, 3.3, z, -Math.PI / 2);
    zones.push({ kind: 'down', line: l, li: i, x: O.x + x + 0.8, z, r: 1.5 });
  });
  // 도착 안내판 (LED, 주황 글씨)
  const boardC = document.createElement('canvas'); boardC.width = 512; boardC.height = 96; const boardT = new THREE.CanvasTexture(boardC); boardT.colorSpace = THREE.SRGBColorSpace; const boardM = new THREE.MeshBasicMaterial({ map: boardT });
  box(5.4, 1.1, 0.2, darkM, 10, 3.3, 0); plane(5.2, 0.95, boardM, 9.89, 3.3, 0, -Math.PI / 2); plane(5.2, 0.95, boardM, 10.11, 3.3, 0, Math.PI / 2);

  // ---------- 승강장 (호선마다 하나: 섬식, 양쪽 선로) ----------
  const plats = lines.map((l, li) => {
    const pz = 60 + li * 50, PL = 96, PW = 10, lc = LINE_COLOR2[l] || '#888', seq = LINE_SEQ[l] || [], at = seq.indexOf(st.name), prev = at > 0 ? seq[at - 1] : '', next = at >= 0 && at < seq.length - 1 ? seq[at + 1] : '';
    ground(PL, PW, 0, pz);
    // 선로 바닥 (어둡게) · 레일 · 벽 (터널 벽에 광고 상자)
    for (const sd of [-1, 1]) {
      const tz = pz + sd * (PW / 2 + 2.6), tb = plane(PL, 5.2, lam({ color: '#3b3a38' }), 0, -0.9, tz); tb.rotation.x = -Math.PI / 2;
      for (const ro of [-0.72, 0.72]) box(PL, 0.12, 0.08, steelM, 0, -0.8, tz + ro);
      const tw = plane(PL, 6, lam({ color: '#cfccc5' }), 0, 2, pz + sd * (PW / 2 + 5.2), sd > 0 ? Math.PI : 0); void tw;
      const ceil2 = plane(PL, 5.2, ceilM, 0, 4.6, tz); ceil2.rotation.x = Math.PI / 2;
      for (let x = -PL / 2 + 8; x < PL / 2 - 4; x += 16) { const adT = tex(256, 128, (c) => { const gr = c.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, ['#ffd6e6', '#cfe8ff', '#fff1c4', '#d9f5d0'][Math.abs(x) % 4]); gr.addColorStop(1, '#ffffff'); c.fillStyle = gr; c.fillRect(0, 0, 256, 128); c.fillStyle = '#333'; c.font = 'bold 22px sans-serif'; c.fillText(['한강 산책 가요', '오늘도 수고했어요', '여의도 봄꽃축제', '서울 지하철'][Math.abs(x / 16 | 0) % 4], 20, 70); }); plane(4.2, 2.1, lam({ map: adT, emissive: '#ffffff', emissiveMap: adT, emissiveIntensity: 0.5 }), x, 2.2, pz + sd * (PW / 2 + 5.15), sd > 0 ? Math.PI : 0); }
    }
    // 스크린도어: 유리 문 + 위 띠(호선 색) + 문 번호, 승강장 가장자리 점자블록
    const glassM = phong({ color: '#cfe6f0', transparent: true, opacity: 0.32, shininess: 100, side: THREE.DoubleSide }), frameM = phong({ color: '#8d949c', shininess: 60 });
    for (const sd of [-1, 1]) {
      const ez = pz + sd * (PW / 2 - 0.15); wall(-PL / 2, ez - 0.1, PL / 2, ez + 0.1, 2.3);
      box(PL, 0.42, 0.22, lam({ color: '#2b3039' }), 0, 2.35, ez); box(PL, 0.08, 0.24, lineM.clone(), 0, 2.12, ez).material.color.set(lc);
      for (let x = -PL / 2 + 2; x < PL / 2 - 1; x += 3.6) { box(0.1, 2.1, 0.16, frameM, x, 1.05, ez); plane(1.6, 1.95, glassM, x + 0.9, 1.05, ez); plane(1.6, 1.95, glassM, x + 2.6, 1.05, ez); }
      const tp = plane(PL, 0.3, tactM, 0, 0.02, ez - sd * 0.6); tp.rotation.x = -Math.PI / 2;
    }
    wall(-PL / 2 - 0.5, pz - PW / 2, -PL / 2, pz + PW / 2); wall(PL / 2, pz - PW / 2, PL / 2 + 0.5, pz + PW / 2);
    // 역 이름판 (이전 · 다음 역) · 벤치 · 기둥
    const signT = tex(1024, 200, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = lc; c.fillRect(0, h - 46, w, 46); c.fillStyle = '#1d1d1f'; c.font = 'bold 92px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st.name, w / 2, 76); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'left'; c.fillText(prev ? `← ${prev}` : '', 24, h - 22); c.textAlign = 'right'; c.fillText(next ? `${next} →` : '', w - 24, h - 22); });
    const signM = lam({ map: signT, emissive: '#ffffff', emissiveMap: signT, emissiveIntensity: 0.45 });
    for (let x = -PL / 2 + 12; x < PL / 2 - 6; x += 24) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 4.6, 16), wallM); c.position.set(x, 2.3, pz); g.add(c); hg.addCircle(O.x + x, pz, 0.48, 4.6); plane(3.6, 0.7, signM, x, 3.2, pz - 0.42, Math.PI); plane(3.6, 0.7, signM, x, 3.2, pz + 0.42); }
    for (let x = -PL / 2 + 18; x < PL / 2 - 6; x += 24) for (const sd of [-1, 1]) { box(2.2, 0.08, 0.5, lam({ color: '#c9a77a' }), x, 0.45, pz + sd * 1.6); box(0.08, 0.45, 0.4, steelM, x - 0.9, 0.22, pz + sd * 1.6); box(0.08, 0.45, 0.4, steelM, x + 0.9, 0.22, pz + sd * 1.6); hg.addCircle(O.x + x, pz + sd * 1.6, 0.6, 0.5); }
    // 대합실로 올라가는 계단 (서쪽 끝)
    for (let q = 0; q < 6; q++) box(0.5, 0.1, 3.6, lam({ color: '#a8a49c' }), -PL / 2 + 2 + q * 0.42, 0.05 + q * 0.16, pz);
    const upT = tex(320, 96, (c) => { c.fillStyle = '#2b3039'; c.fillRect(0, 0, 320, 96); c.fillStyle = '#fff'; c.font = 'bold 32px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('나가는 곳 ↑', 160, 36); c.font = '18px sans-serif'; c.fillText('Way Out', 160, 72); });
    plane(3.2, 0.95, lam({ map: upT, emissive: '#ffffff', emissiveMap: upT, emissiveIntensity: 0.6 }), -PL / 2 + 4.5, 3.3, pz, Math.PI / 2);
    zones.push({ kind: 'up', line: l, li, x: O.x - PL / 2 + 2.6, z: pz, r: 1.6 });
    // 열차 두 대 (양쪽 방면): 들어와 서고 문 열고 떠난다
    const trains = [-1, 1].map((sd, k) => { const tr = makeTrain(l); tr.position.set(0, -0.9, pz + sd * (PW / 2 + 2.6)); tr.visible = false; g.add(tr); return { tr, sd, phase: 'gone', t: 20 + k * 70 + Math.random() * 40, to: sd < 0 ? seq[0] || '' : seq[seq.length - 1] || '' }; });
    return { l, pz, PL, trains, prev, next };
  });

  // 조명: 따뜻한 흰빛 (바깥 해 · 하늘빛은 들어가 있는 동안 꺼진다)
  g.add(new THREE.HemisphereLight('#fff4e4', '#8f8578', 1.05)); const pl = new THREE.PointLight('#ffe9c8', 14, 40, 1.6); pl.position.set(0, 4, 0); g.add(pl);
  for (const p of plats) { const l2 = new THREE.PointLight('#ffe9c8', 14, 50, 1.6); l2.position.set(0, 4, p.pz); g.add(l2); }

  const S = { g, O, zones, foots, plats, st, CD, CW,
    spawnFromExit(ref) { const z = zones.find((q) => q.kind === 'exit' && q.ref === ref) || zones.find((q) => q.kind === 'exit'); const side = Math.sign(z.z) || 1; return { x: z.x, z: z.z - side * 3.2, face: side > 0 ? Math.PI : 0 }; },
    spawnPlatform(li) { const p = plats[li] || plats[0]; return { x: O.x - p.PL / 2 + 6, z: p.pz, face: Math.PI / 2 }; },
    spawnConcourse(li) { const z = zones.find((q) => q.kind === 'down' && q.li === li) || zones.find((q) => q.kind === 'down'); return { x: z.x - 3.5, z: z.z, face: -Math.PI / 2 }; },
    zoneAt(x, z) { return zones.find((q) => Math.hypot(x - q.x, z - q.z) < q.r) || null; },
    tick(dt, arrivals, at) {
      for (const p of plats) for (const T of p.trains) {
        T.t -= dt; const half = p.PL / 2 + 120;
        // 실제 도착 정보: "○○방면" 이 다음 역이면 이쪽 선로, 이전 역이면 반대쪽. 남은 초에 맞춰 들어온다
        if (T.phase === 'gone' && arrivals?.length) { const want = T.sd > 0 ? p.next : p.prev, a = arrivals.find((q) => String(q.line).startsWith(String(p.l)) && new RegExp(`${want}\\s*방면`).test(`${q.to || ''} ${q.msg || ''}`)); if (a) { const rem = (a.sec || 0) - (Date.now() - (at || Date.now())) / 1000; if (/도착|진입/.test(a.msg || '') && !/전역|후/.test(a.msg || '')) T.t = Math.min(T.t, 0); else if (rem > 0) T.t = Math.max(0, rem - 9); } }
        if (T.phase === 'gone' && T.t <= 0) { T.phase = 'in'; T.t = 9; T.tr.visible = true; }
        if (T.phase === 'in') { const k = Math.max(0, T.t / 9); T.tr.position.x = -T.sd * half * k * k; if (T.t <= 0) { T.phase = 'stop'; T.t = 22; setDoors(T.tr, 1); } }
        else if (T.phase === 'stop') { if (T.t < 3) setDoors(T.tr, Math.max(0, T.t / 3)); if (T.t <= 0) { T.phase = 'out'; T.t = 9; setDoors(T.tr, 0); } }
        else if (T.phase === 'out') { const k = 1 - Math.max(0, T.t / 9); T.tr.position.x = T.sd * half * k * k; if (T.t <= 0) { T.phase = 'gone'; T.tr.visible = false; T.t = 120 + Math.random() * 120; } }
      }
      // 안내판: 실제 도착 정보가 있으면 그것, 없으면 열차 상태
      this.boardT = (this.boardT || 0) - dt; if (this.boardT > 0) return; this.boardT = 1;
      const c = boardC.getContext('2d'); c.fillStyle = '#0b0b0d'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ffb020'; c.font = 'bold 30px sans-serif'; c.textBaseline = 'middle';
      const rows = (arrivals && arrivals.length ? arrivals.slice(0, 2).map((a) => `${a.line} ${a.to || ''} ${a.msg || ''}`) : plats.flatMap((p) => p.trains.map((T) => `${p.l}호선 ${T.to}행 ${T.phase === 'stop' ? '도착' : T.phase === 'in' ? '진입 중' : T.phase === 'gone' ? `${Math.ceil(T.t / 60)}분 후` : '출발'}`)).slice(0, 2));
      rows.forEach((r, i) => c.fillText(r.slice(0, 22), 14, 26 + i * 44)); boardT.needsUpdate = true;
    },
    // 열차 문이 열려 있는 곳 가까이에 있으면 그 열차 (타기)
    doorTrain(x, z) { for (const p of plats) for (const T of p.trains) { if (T.phase !== 'stop' || T.t < 4) continue; const ez = p.pz + T.sd * (5 - 0.15); if (Math.abs(z - ez) < 1.2 && Math.abs(x - O.x) < p.PL / 2) return { p, T }; } return null; },
  };
  return S;
}

// 지하철 전동차 (10량을 다 그리면 무거워서 6량): 스테인리스 몸체 · 호선 색 띠 · 창 띠 · 앞 유리 · 미닫이문 (문은 열고 닫는다)
function makeTrain(line) {
  const L = TRAIN_LOOK[line] || TRAIN_LOOK[5], g = new THREE.Group(), body = new THREE.MeshPhongMaterial({ color: L.body, shininess: 80, specular: '#ffffff' }), win = new THREE.MeshLambertMaterial({ color: '#2a3442', emissive: '#fff1d6', emissiveIntensity: 0.55 }), band = new THREE.MeshLambertMaterial({ color: L.band }), band2 = L.band2 ? new THREE.MeshLambertMaterial({ color: L.band2 }) : null, doorM = new THREE.MeshPhongMaterial({ color: L.body, shininess: 80 }), dark = new THREE.MeshLambertMaterial({ color: '#1d2026' });
  const CAR = 19.5, N = 6, doors = [];
  for (let i = 0; i < N; i++) {
    const car = new THREE.Group(); car.position.x = (i - (N - 1) / 2) * (CAR + 0.5); g.add(car);
    const b = new THREE.Mesh(new THREE.BoxGeometry(CAR, 3.3, 3.1), body); b.position.y = 1.65; car.add(b);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, CAR, 12, 1, false, 0, Math.PI), body); roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.22); roof.position.y = 3.3; car.add(roof);
    for (const sd of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(CAR - 1, 0.95, 0.02), win); w.position.set(0, 2.2, sd * 1.56); car.add(w);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(CAR, 0.22, 0.03), band); s1.position.set(0, 1.45, sd * 1.565); car.add(s1);
      if (band2) { const s2 = new THREE.Mesh(new THREE.BoxGeometry(CAR, 0.08, 0.03), band2); s2.position.set(0, 1.25, sd * 1.565); car.add(s2); }
      for (let d = 0; d < 4; d++) { const dx = -CAR / 2 + 2.4 + d * ((CAR - 4.8) / 3); for (const lr of [-1, 1]) { const door = new THREE.Mesh(new THREE.BoxGeometry(0.66, 2.0, 0.04), doorM); door.position.set(dx + lr * 0.33, 1.15, sd * 1.58); car.add(door); doors.push({ m: door, base: dx + lr * 0.33, lr }); const dw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.01), win); dw.position.set(0, 0.45, sd * 0.03); door.add(dw); } }
    }
    for (const sd of [-1, 1]) for (const ox of [-CAR / 2 + 2.8, CAR / 2 - 2.8]) { const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 2.6), dark); bogie.position.set(ox, 0.1, 0); car.add(bogie); void sd; }
    if (i === 0 || i === N - 1) { const f = i === 0 ? -1 : 1, nose = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, 3.0), body); nose.position.set(f * (CAR / 2 + 0.15), 1.6, 0); car.add(nose); const fw = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), dark); fw.position.set(f * (CAR / 2 + 0.36), 2.3, 0); fw.rotation.y = f * Math.PI / 2; car.add(fw); const fb = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), band); fb.position.set(f * (CAR / 2 + 0.36), 1.45, 0); fb.rotation.y = f * Math.PI / 2; car.add(fb); for (const lr of [-1, 1]) { const hl = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), new THREE.MeshBasicMaterial({ color: '#fff6dc' })); hl.position.set(f * (CAR / 2 + 0.37), 0.9, lr * 1.05); hl.rotation.y = f * Math.PI / 2; car.add(hl); } }
  }
  g.userData.doors = doors; return g;
}
function setDoors(tr, k) { for (const d of tr.userData.doors) d.m.position.x = d.base + d.lr * 0.62 * k; }

// 열차 안 (호선마다 하나): 양옆 긴 의자(끝은 노약자석 · 가운데 분홍 임산부석) · 손잡이 · 기둥 · 천장 조명 · 노선도 띠 · 안내 화면 · 창밖 터널 불빛이 흘러간다
const SEAT = { 1: '#3d6db5', 2: '#3d8f5a', 5: '#5b5fb0', 6: '#b5743d', 9: '#6d6a74', 신림: '#4f6fae', 경의중앙: '#3d8f7a', 공항: '#2f7fbf' };
export function buildCar(hg, line, slot) {
  const O = new THREE.Vector3(96000 + slot * 120, 0, -600), g = new THREE.Group(); g.position.copy(O); g.visible = false; hg.scene.add(g);
  const lc = LINE_COLOR2[line] || '#888', CL = 19.5, CW = 3.0, H = 2.4;
  const wallF = (x0, z0, x1, z1) => hg.addFoot({ ring: [[O.x + x0, O.z + z0], [O.x + x1, O.z + z0], [O.x + x1, O.z + z1], [O.x + x0, O.z + z1]], h: 3, x0: O.x + Math.min(x0, x1), x1: O.x + Math.max(x0, x1), z0: O.z + Math.min(z0, z1), z1: O.z + Math.max(z0, z1), name: '', type: 'stone', noClimb: true });
  const box = (w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; };
  const floorT = tex(128, 128, (c) => { c.fillStyle = '#8f949b'; c.fillRect(0, 0, 128, 128); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.08)`; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } }); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(8, 1.2);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(CL, CW), lam({ map: floorT })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; g.add(fl);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CL, CW), lam({ color: '#f2f1ee' })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; g.add(ceil);
  for (const sd of [-1, 1]) box(CL, 0.06, 0.3, new THREE.MeshBasicMaterial({ color: '#fffaf0' }), 0, H - 0.04, sd * 0.75);
  const wallM = lam({ color: '#eceae5' }), seatM = lam({ color: SEAT[line] || '#5b5fb0' }), prioM = lam({ color: '#e0a23a' }), pinkM = lam({ color: '#f29bb8' }), steel = phong({ color: '#d5d9de', shininess: 100 });
  // 창밖: 어두운 터널 + 흘러가는 불빛 (텍스처를 밀어서)
  const tunT = tex(512, 64, (c) => { c.fillStyle = '#121418'; c.fillRect(0, 0, 512, 64); for (let x = 0; x < 512; x += 128) { const gr = c.createRadialGradient(x + 64, 30, 2, x + 64, 30, 40); gr.addColorStop(0, 'rgba(255,220,160,.9)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = gr; c.fillRect(x, 0, 128, 64); } c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 44, 512, 3); }); tunT.wrapS = THREE.RepeatWrapping; tunT.repeat.set(4, 1);
  const tunM = new THREE.MeshBasicMaterial({ map: tunT });
  const mapT = tex(1024, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = lc; c.fillRect(20, 28, w - 40, 8); const seq = LINE_SEQ[line] || []; seq.forEach((n, i) => { const x = 40 + i * ((w - 80) / Math.max(1, seq.length - 1)); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, 32, 9, 0, 7); c.fill(); c.strokeStyle = lc; c.lineWidth = 4; c.stroke(); c.fillStyle = '#222'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText(n, x, 58); }); });
  const mapM = lam({ map: mapT, emissive: '#ffffff', emissiveMap: mapT, emissiveIntensity: 0.3 });
  for (const sd of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(CL, H), wallM); w.position.set(0, H / 2, sd * CW / 2); w.rotation.y = sd > 0 ? Math.PI : 0; g.add(w);
    for (let k = 0; k < 4; k++) { const x = -CL / 2 + 3.2 + k * 4.4; const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.85), tunM); win.position.set(x, 1.55, sd * (CW / 2 - 0.01)); win.rotation.y = sd > 0 ? Math.PI : 0; g.add(win); }
    for (let k = 0; k < 4; k++) { const dx = -CL / 2 + 1.0 + k * ((CL - 2.0) / 3); const door = box(1.3, 1.9, 0.03, lam({ color: '#d9dde2' }), dx, 0.95, sd * (CW / 2 - 0.02)); void door; box(1.3, 0.08, 0.035, lam({ color: lc }), dx, 1.92, sd * (CW / 2 - 0.02)); }
    // 긴 의자: 문 사이마다 (끝 칸은 노약자석, 가운데 한 자리는 임산부석)
    for (let k = 0; k < 3; k++) { const x0 = -CL / 2 + 1.0 + k * ((CL - 2.0) / 3) + 0.8, x1 = x0 + (CL - 2.0) / 3 - 1.6, mid = (x0 + x1) / 2, m = k === 0 || k === 2 ? (k === 0 ? prioM : seatM) : seatM; box(x1 - x0, 0.12, 0.5, m, mid, 0.45, sd * (CW / 2 - 0.32)); box(x1 - x0, 0.45, 0.08, m, mid, 0.72, sd * (CW / 2 - 0.08)); if (k === 1) box(0.5, 0.125, 0.5, pinkM, mid, 0.455, sd * (CW / 2 - 0.32)); wallF(x0, sd * (CW / 2 - 0.6), x1, sd * CW / 2); }
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(CL - 2, 0.28), mapM); mp.position.set(0, 2.12, sd * (CW / 2 - 0.02)); mp.rotation.y = sd > 0 ? Math.PI : 0; g.add(mp);
    // 손잡이 줄
    box(CL - 1, 0.03, 0.03, steel, 0, 2.05, sd * 0.85); for (let x = -CL / 2 + 1; x < CL / 2 - 0.8; x += 0.55) { const strap = box(0.02, 0.22, 0.02, lam({ color: '#f2f2f2' }), x, 1.93, sd * 0.85); void strap; const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14), lam({ color: k2(line) })); ring.position.set(x, 1.78, sd * 0.85); ring.rotation.x = Math.PI / 2; ring.rotation.y = Math.PI / 2; g.add(ring); }
  }
  for (let x = -CL / 2 + 2.6; x < CL / 2 - 1; x += 4.4) for (const sd of [-1, 1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, H, 8), steel); pole.position.set(x, H / 2, sd * 0.55); g.add(pole); hg.addCircle(O.x + x, O.z + sd * 0.55, 0.06, H); }
  // 양 끝 벽 (통로문) + 안내 화면
  const scrC = document.createElement('canvas'); scrC.width = 512; scrC.height = 96; const scrT = new THREE.CanvasTexture(scrC); scrT.colorSpace = THREE.SRGBColorSpace;
  for (const ex of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(CW, H), wallM); w.position.set(ex * CL / 2, H / 2, 0); w.rotation.y = -ex * Math.PI / 2; g.add(w); const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: scrT })); s.position.set(ex * (CL / 2 - 0.02), 2.05, 0); s.rotation.y = -ex * Math.PI / 2; g.add(s); const dr = box(0.03, 1.9, 0.9, lam({ color: '#c9ced4' }), ex * (CL / 2 - 0.02), 0.95, 0); void dr; }
  wallF(-CL / 2 - 0.4, -CW / 2 - 0.4, CL / 2 + 0.4, -CW / 2); wallF(-CL / 2 - 0.4, CW / 2, CL / 2 + 0.4, CW / 2 + 0.4); wallF(-CL / 2 - 0.4, -CW / 2, -CL / 2, CW / 2); wallF(CL / 2, -CW / 2, CL / 2 + 0.4, CW / 2);
  g.add(new THREE.HemisphereLight('#fffaf0', '#8a8378', 1.1)); const pl = new THREE.PointLight('#fff4e0', 6, 14, 1.6); pl.position.set(0, 2.2, 0); g.add(pl);
  return {
    g, spawn: { x: O.x, z: O.z, face: Math.PI / 2 },
    setText(next, line2) { const c = scrC.getContext('2d'); c.fillStyle = '#0b0b0d'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#ff5a3c'; c.font = 'bold 26px sans-serif'; c.textBaseline = 'middle'; c.fillText(`${line2}`, 14, 30); c.fillStyle = '#ffb020'; c.font = 'bold 34px sans-serif'; c.fillText(next ? `이번 역은 ${next}입니다` : '종착역입니다', 14, 68); scrT.needsUpdate = true; },
    tick(dt, speed) { tunT.offset.x = (tunT.offset.x + dt * speed) % 1; },
  };
}
const k2 = (line) => ({ 9: '#d9a23a' }[line] || '#ffd23f');
