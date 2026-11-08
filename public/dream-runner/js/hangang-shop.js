// 한강 산책: 가게 (실제 이름 · 종류, OSM)
//   가게 앞: 가장 가까운 건물 1층 벽에 유리문 · 종류 색 차양 · 실제 이름 간판 (간판 글씨는 큰 그림 몇 장에 모아 그려 가볍게)
//   가게 안: 종류마다 하나씩 (먼 곳에 짓고 들어가 있는 동안 바깥은 숨긴다) — 계산대 · 메뉴판 · 진열장 · 테이블 · 직원 곰 · 손님 곰
import * as THREE from 'three';

export const SHOP_KIND = {
  cafe: { label: '카페', emoji: '☕', awn: '#2f5d4a', wall: '#efe6da', floor: ['wood', '#b58a5e', '#a67c52'], light: '#ffe2b0' },
  bakery: { label: '빵집', emoji: '🥐', awn: '#b5733d', wall: '#f6efe2', floor: ['wood', '#c79a6a', '#b88b5c'], light: '#ffe6bc' },
  korean: { label: '식당', emoji: '🍚', awn: '#7a3b2e', wall: '#f1e9dc', floor: ['tile', '#d9d2c4', '#cfc7b8'], light: '#fff0d4' },
  chicken: { label: '치킨', emoji: '🍗', awn: '#d8752a', wall: '#fbf1e0', floor: ['tile', '#e3d8c4', '#d6cab4'], light: '#fff0d0' },
  pizza: { label: '피자', emoji: '🍕', awn: '#b8322a', wall: '#f7ede0', floor: ['tile', '#e8e2d4', '#2f2f2f'], light: '#ffe8c4' },
  burger: { label: '버거', emoji: '🍔', awn: '#c0392b', wall: '#fff6e8', floor: ['tile', '#f0e6d6', '#d9cdb8'], light: '#fff4dc' },
  chinese: { label: '중식', emoji: '🥟', awn: '#a8231d', wall: '#f4e6d4', floor: ['tile', '#d8c7ad', '#c9b699'], light: '#ffe4bc' },
  japanese: { label: '일식', emoji: '🍣', awn: '#2b2b2b', wall: '#efe7d8', floor: ['wood', '#c9a77a', '#bb996c'], light: '#ffe8c8' },
  pub: { label: '술집', emoji: '🍺', awn: '#3b2a22', wall: '#d9c8b4', floor: ['wood', '#7a5a3e', '#6d4f35'], light: '#ffcf8a' },
  mart: { label: '편의점', emoji: '🏪', awn: '#2f7fd8', wall: '#f7f8fa', floor: ['tile', '#eef0f2', '#e3e6ea'], light: '#f4fbff' },
};
// 메뉴 (실제 서울 가게에서 흔한 것 · 가격)
export const SHOP_MENU = {
  cafe: [['아이스 아메리카노', 4500, '🧊'], ['카페 라떼', 5000, '☕'], ['바닐라 라떼', 5500, '🥛'], ['딸기 케이크', 6500, '🍰'], ['크로플', 5800, '🧇']],
  bakery: [['소금빵', 3200, '🥐'], ['크림빵', 2800, '🍞'], ['단팥빵', 2500, '🥯'], ['우유', 1800, '🥛']],
  korean: [['김치찌개', 9000, '🍲'], ['된장찌개', 9000, '🥘'], ['제육볶음', 10000, '🍛'], ['비빔밥', 9500, '🍚'], ['순두부찌개', 9000, '🍲']],
  chicken: [['후라이드 치킨', 20000, '🍗'], ['양념 치킨', 21000, '🍗'], ['치킨 + 맥주', 25000, '🍺']],
  pizza: [['페퍼로니 피자', 19000, '🍕'], ['고르곤졸라', 17000, '🍕'], ['콜라', 2000, '🥤']],
  burger: [['불고기 버거 세트', 7900, '🍔'], ['치즈 버거 세트', 7500, '🍔'], ['감자튀김', 2500, '🍟'], ['콜라', 2000, '🥤']],
  chinese: [['짜장면', 7000, '🍜'], ['짬뽕', 8500, '🍜'], ['탕수육', 18000, '🥢'], ['군만두', 6000, '🥟']],
  japanese: [['연어 초밥', 14000, '🍣'], ['돈코츠 라멘', 10000, '🍜'], ['돈가스', 11000, '🍱']],
  pub: [['생맥주', 5000, '🍺'], ['소주', 5000, '🍶'], ['감자전', 13000, '🥞'], ['모둠 꼬치', 16000, '🍢']],
  mart: [['삼각김밥', 1500, '🍙'], ['컵라면', 1800, '🍜'], ['바나나 우유', 1700, '🍌'], ['아이스크림', 2000, '🍦'], ['도시락', 4900, '🍱']],
};
const lam = (o) => new THREE.MeshLambertMaterial(o);
const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// ---------- 가게 앞 ----------
//   shops: [[이름, 종류, x, z], ...] (지도 단위) → 가까운 건물 벽에 붙인다. 붙일 벽이 없으면 건너뛴다
export function buildShopFronts(hg, raw, S) {
  const fronts = [], used = new Map();
  for (const [name, kind, x0, z0] of raw) {
    const x = x0 * S, z = z0 * S, cell = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const fi of hg.footGrid?.get(`${Math.floor(x / 40) + a},${Math.floor(z / 40) + b}`) || []) cell.push(fi);
    let best = null;
    for (const fi of cell) { const f = hg.foot[fi]; if (f.noClimb || f.h < 3) continue; const ring = f.ring, sg = ringSign(ring); for (let k = 0; k < ring.length; k++) { const a = ring[k], c = ring[(k + 1) % ring.length], ex = c[0] - a[0], ez = c[1] - a[1], L = Math.hypot(ex, ez); if (L < 4) continue; const t = Math.max(1.4 / L, Math.min(1 - 1.4 / L, ((x - a[0]) * ex + (z - a[1]) * ez) / (L * L))), px = a[0] + ex * t, pz = a[1] + ez * t, d = Math.hypot(x - px, z - pz); if (d < 22 && (!best || d < best.d)) best = { d, px, pz, nx: (sg > 0 ? ez : -ez) / L, nz: (sg > 0 ? -ex : ex) / L, fi, k }; } }
    if (!best) continue;
    // 같은 벽 같은 자리에 겹치면 옆으로 4m 씩
    const key = `${best.fi}:${best.k}`, n = used.get(key) || 0; used.set(key, n + 1); if (n > 5) continue;
    const tx = best.nz, tz = -best.nx, sh = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 4.2;
    fronts.push({ name, kind: SHOP_KIND[kind] ? kind : 'korean', x: best.px + tx * sh + best.nx * 0.05, z: best.pz + tz * sh + best.nz * 0.05, nx: best.nx, nz: best.nz });
  }
  // 문 · 차양 (한 번에) + 간판 글씨 (큰 그림에 모아서)
  const N = fronts.length; if (!N) return fronts;
  const o = new THREE.Object3D(), doorG = new THREE.PlaneGeometry(1.7, 2.3); doorG.translate(0, 1.15, 0.06); const frameG = new THREE.BoxGeometry(2.0, 2.5, 0.08); frameG.translate(0, 1.25, 0); const winG = new THREE.PlaneGeometry(3.6, 2.3); winG.translate(0, 1.25, 0.06);
  const awnG = new THREE.BoxGeometry(3.6, 0.12, 1.1); awnG.rotateX(0.32); awnG.translate(0, 2.85, 0.5);
  const place = (im, i, F) => { o.position.set(F.x, 0, F.z); o.rotation.y = Math.atan2(F.nx, F.nz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); };
  const frame = new THREE.InstancedMesh(frameG, lam({ color: '#3a3d42' }), N), inT = tex(128, 128, (c) => { const gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#f6d7a4'); gr.addColorStop(0.6, '#c99a64'); gr.addColorStop(1, '#6e4f34'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); for (const x of [26, 98]) { const rg = c.createRadialGradient(x, 18, 2, x, 18, 26); rg.addColorStop(0, 'rgba(255,248,220,.95)'); rg.addColorStop(1, 'rgba(255,248,220,0)'); c.fillStyle = rg; c.fillRect(x - 26, 0, 52, 46); } c.fillStyle = 'rgba(60,40,28,.55)'; c.fillRect(14, 84, 40, 6); c.fillRect(74, 84, 40, 6); c.fillRect(30, 90, 4, 30); c.fillRect(92, 90, 4, 30); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(40, 0); c.lineTo(0, 60); c.fill(); }), door = new THREE.InstancedMesh(doorG, new THREE.MeshPhongMaterial({ map: inT, shininess: 90, emissive: '#ffffff', emissiveMap: inT, emissiveIntensity: 0.1 }), N), win = new THREE.InstancedMesh(winG, new THREE.MeshPhongMaterial({ map: inT, shininess: 90, emissive: '#ffffff', emissiveMap: inT, emissiveIntensity: 0.1 }), N), awn = new THREE.InstancedMesh(awnG, lam({ color: '#ffffff' }), N);
  const col = new THREE.Color(); fronts.forEach((F, i) => { place(frame, i, F); place(door, i, F); place(awn, i, F); place(win, i, F); awn.setColorAt(i, col.set(SHOP_KIND[F.kind].awn)); });
  // 진열 창은 문 옆으로 (문을 가리지 않게 살짝 옆)
  fronts.forEach((F, i) => { o.position.set(F.x + F.nz * 2.0, 0, F.z - F.nx * 2.0); o.rotation.y = Math.atan2(F.nx, F.nz); o.scale.set(0.42, 1, 1); o.updateMatrix(); win.setMatrixAt(i, o.matrix); o.scale.set(1, 1, 1); });
  hg.scene.add(frame, door, win, awn); hg.shopWinM = [door.material, win.material];
  // 가게 앞: 문 양옆 화분(초록 잎 · 가끔 꽃) · 식당 · 카페 앞엔 입간판(A자 칠판)
  { const pots = [], boards = []; fronts.forEach((F, i) => { const tx = F.nz, tz = -F.nx; if (i % 3 !== 2) for (const sd of [-1, 1]) pots.push([F.x + F.nx * 0.55 + tx * sd * 1.25, F.z + F.nz * 0.55 + tz * sd * 1.25, i]); if (!/mart|pub/.test(F.kind) && i % 2 === 0) boards.push([F.x + F.nx * 1.6 + tx * 1.9, F.z + F.nz * 1.6 + tz * 1.9, Math.atan2(F.nx, F.nz)]); });
    const potG = new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12); potG.translate(0, 0.25, 0); const leafG = new THREE.IcosahedronGeometry(0.34, 1); leafG.scale(1, 1.25, 1); leafG.translate(0, 0.92, 0);
    const pm = new THREE.InstancedMesh(potG, lam({ color: '#ffffff' }), pots.length), lm = new THREE.InstancedMesh(leafG, lam({ color: '#ffffff' }), pots.length), c = new THREE.Color();
    pots.forEach(([x, z, i], k) => { o.position.set(x, 0, z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); pm.setMatrixAt(k, o.matrix); lm.setMatrixAt(k, o.matrix); pm.setColorAt(k, c.set(['#d9cfc2', '#6b5a4a', '#e8e4dc', '#3a3f47', '#b5733d'][i % 5])); lm.setColorAt(k, c.set(i % 4 === 0 ? '#ff9ec0' : ['#4f8a4a', '#5f9a52', '#3f7a44'][i % 3])); hg.addCircle(x, z, 0.3, 1.2); });
    hg.scene.add(pm, lm);
    const bT = tex(64, 96, (c2) => { c2.fillStyle = '#2a2a2a'; c2.fillRect(0, 0, 64, 96); c2.strokeStyle = '#a8865a'; c2.lineWidth = 6; c2.strokeRect(3, 3, 58, 90); c2.fillStyle = '#ffffff'; c2.font = 'bold 13px sans-serif'; c2.textAlign = 'center'; c2.fillText('오늘의', 32, 28); c2.fillText('메뉴', 32, 46); c2.fillStyle = '#ffd98a'; c2.fillRect(14, 60, 36, 3); c2.fillRect(14, 70, 30, 3); c2.fillRect(14, 80, 34, 3); });
    const boardG = new THREE.BoxGeometry(0.7, 1.05, 0.05); boardG.rotateX(-0.18); boardG.translate(0, 0.55, 0.1); const board2 = boardG.clone(); board2.rotateY(Math.PI); const bm = new THREE.InstancedMesh(boardG, lam({ map: bT }), boards.length), bm2 = new THREE.InstancedMesh(board2, lam({ map: bT }), boards.length);
    boards.forEach(([x, z, ry], k) => { o.position.set(x, 0, z); o.rotation.set(0, ry, 0); o.updateMatrix(); bm.setMatrixAt(k, o.matrix); bm2.setMatrixAt(k, o.matrix); hg.addCircle(x, z, 0.3, 0.9); }); hg.scene.add(bm, bm2); }
  // 간판: 256 × 64 칸, 2048 × 2048 그림 하나에 256 개
  const PER = 256; for (let a0 = 0; a0 < N; a0 += PER) {
    const list = fronts.slice(a0, a0 + PER), cv = document.createElement('canvas'); cv.width = cv.height = 2048; const c = cv.getContext('2d');
    list.forEach((F, j) => { const cx = (j % 8) * 256, cy = Math.floor(j / 8) * 64, K = SHOP_KIND[F.kind]; c.fillStyle = K.awn; c.fillRect(cx, cy, 256, 64); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(cx, cy, 256, 6); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${K.emoji} ${F.name}`, cx + 128, cy + 34, 240); });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const P = [], U = [], I = []; list.forEach((F, j) => { const u0 = (j % 8) / 8, v1 = 1 - Math.floor(j / 8) / 32, v0 = v1 - 1 / 32, tx = F.nz, tz = -F.nx, W = 3.6, y0 = 3.15, y1 = 4.05, ox = F.x + F.nx * 0.3, oz = F.z + F.nz * 0.3, k = P.length / 3; P.push(ox - tx * W / 2, y0, oz - tz * W / 2, ox + tx * W / 2, y0, oz + tz * W / 2, ox + tx * W / 2, y1, oz + tz * W / 2, ox - tx * W / 2, y1, oz - tz * W / 2); U.push(u0, v0, u0 + 1 / 8, v0, u0 + 1 / 8, v1, u0, v1); I.push(k, k + 1, k + 2, k, k + 2, k + 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const m = lam({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 }); (hg.shopSignMs ||= []).push(m); hg.scene.add(new THREE.Mesh(g, m));
  }
  return fronts;
}
const ringSign = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length]; a += x1 * z2 - x2 * z1; } return a > 0 ? 1 : -1; };

// ---------- 가게 안 (종류마다 하나) ----------
export function buildShopInterior(hg, kind, slot, makeBear) {
  const K = SHOP_KIND[kind] || SHOP_KIND.korean, O = new THREE.Vector3(100000 + slot * 120, 0, 600), g = new THREE.Group(); g.position.copy(O); g.visible = false; hg.scene.add(g);
  const W = 14, D = 11, H = 3.4, foot = (x0, z0, x1, z1, h = 3) => hg.addFoot({ ring: [[O.x + x0, O.z + z0], [O.x + x1, O.z + z0], [O.x + x1, O.z + z1], [O.x + x0, O.z + z1]], h, x0: O.x + Math.min(x0, x1), x1: O.x + Math.max(x0, x1), z0: O.z + Math.min(z0, z1), z1: O.z + Math.max(z0, z1), name: '', type: 'stone', noClimb: true });
  const box = (w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; };
  const [fk, f1, f2] = K.floor, floorT = tex(256, 256, (c) => { if (fk === 'wood') { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? f1 : f2; c.fillRect(0, i * 32, 256, 32); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, i * 32, 256, 2); c.fillRect((i * 97) % 256, i * 32, 2, 32); } } else { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? f1 : f2; c.fillRect(i * 64, j * 64, 64, 64); } } }); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(W / 3, D / 3);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshPhongMaterial({ map: floorT, shininess: 40 })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; g.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lam({ color: '#f4f0ea' })); ce.rotation.x = Math.PI / 2; ce.position.y = H; g.add(ce);
  const wallM = lam({ color: K.wall }), accM = lam({ color: K.awn }), woodM = lam({ color: '#8a6440' }), dark = lam({ color: '#2b2d31' });
  for (const [w, x, z, ry] of [[W, 0, -D / 2, 0], [W, 0, D / 2, Math.PI], [D, -W / 2, 0, Math.PI / 2], [D, W / 2, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallM); m.position.set(x, H / 2, z); m.rotation.y = ry; g.add(m); const b = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), accM); b.position.set(x, 0.45, z); b.rotation.y = ry; b.translateZ(0.01); g.add(b); }
  foot(-W / 2 - 0.4, -D / 2 - 0.4, W / 2 + 0.4, -D / 2); foot(-W / 2 - 0.4, D / 2, W / 2 + 0.4, D / 2 + 0.4); foot(-W / 2 - 0.4, -D / 2, -W / 2, D / 2); foot(W / 2, -D / 2, W / 2 + 0.4, D / 2);
  // 문 (앞벽 가운데, z = +D/2): 유리문 + 밖이 밝게 보이는 창
  const outT = tex(128, 128, (c) => { const gr = c.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#cfe4f4'); gr.addColorStop(1, '#f2efe8'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); });
  const outM = new THREE.MeshBasicMaterial({ map: outT }); for (const dx of [-4, 0, 4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(dx ? 3 : 1.8, dx ? 1.8 : 2.4), outM); m.position.set(dx, dx ? 1.6 : 1.2, D / 2 - 0.02); m.rotation.y = Math.PI; g.add(m); }
  // 계산대 (뒤쪽) + 메뉴판 + 직원
  box(5.5, 1.05, 0.9, woodM, 0, 0.52, -D / 2 + 1.8); box(5.6, 0.06, 1.0, lam({ color: '#efe9df' }), 0, 1.07, -D / 2 + 1.8); foot(-2.8, -D / 2 + 1.3, 2.8, -D / 2 + 2.3, 1.1);
  box(0.4, 0.35, 0.3, dark, 1.6, 1.28, -D / 2 + 1.7);
  const menuC = document.createElement('canvas'); menuC.width = 512; menuC.height = 256; const menuT = new THREE.CanvasTexture(menuC); menuT.colorSpace = THREE.SRGBColorSpace;
  const mb = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), lam({ map: menuT, emissive: '#ffffff', emissiveMap: menuT, emissiveIntensity: 0.4 })); mb.position.set(0, 2.35, -D / 2 + 0.03); g.add(mb);
  const drawMenu = (title) => { const c = menuC.getContext('2d'); c.fillStyle = '#1f2226'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#ffd98a'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText(`${K.emoji} ${title}`, 256, 44, 480); c.font = '24px sans-serif'; c.textAlign = 'left'; (SHOP_MENU[kind] || []).slice(0, 5).forEach(([n, p], i) => { c.fillStyle = '#fff'; c.fillText(n, 40, 92 + i * 34); c.textAlign = 'right'; c.fillStyle = '#ffd98a'; c.fillText(`${p.toLocaleString()}원`, 472, 92 + i * 34); c.textAlign = 'left'; }); menuT.needsUpdate = true; };
  if (makeBear) { const staff = makeBear({ color: ['#f2d4b0', '#c98d5e', '#fff1e0'][slot % 3] }); staff.root.scale.setScalar(0.42); staff.root.position.set(-0.8, 0.4, -D / 2 + 1.0); box(1.2, 0.4, 1.0, woodM, -0.8, 0.2, -D / 2 + 1.0); g.add(staff.root); const apron = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.2), accM); apron.position.set(0, 1.1, 0.42); staff.root.add(apron); }
  // 진열장 / 선반 (종류에 따라)
  if (kind === 'mart') { for (let i = 0; i < 3; i++) { const x = -4 + i * 4; box(0.8, 1.8, 6, lam({ color: '#e9ecef' }), x, 0.9, 1); for (let s = 0; s < 4; s++) for (let q = 0; q < 10; q++) box(0.3, 0.3, 0.42, lam({ color: ['#ff6b6b', '#ffd23f', '#4fc3ff', '#7be07b', '#ff9ec0', '#ffffff'][(i + s + q) % 6] }), x + (q % 2 ? 0.25 : -0.25), 0.3 + s * 0.42, -1.6 + q * 0.55); foot(x - 0.45, -2, x + 0.45, 4, 1.8); } box(1.6, 1.9, 0.8, lam({ color: '#dfe7ef', emissive: '#cfe8ff', emissiveIntensity: 0.3 }), 6, 0.95, -2); }
  else if (kind === 'bakery' || kind === 'cafe') { box(3, 0.9, 0.9, lam({ color: '#f2ece2' }), -4.4, 0.45, -D / 2 + 1.8); const glass = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.9), new THREE.MeshPhongMaterial({ color: '#dff0f8', transparent: true, opacity: 0.4 })); glass.position.set(-4.4, 1.15, -D / 2 + 1.8); g.add(glass); for (let q = 0; q < 8; q++) box(0.32, 0.18, 0.32, lam({ color: ['#e0a458', '#f2d0a0', '#c97b3e', '#ffd6e6'][q % 4] }), -5.6 + (q % 4) * 0.8, 1.0, -D / 2 + 1.6 + Math.floor(q / 4) * 0.4); foot(-5.9, -D / 2 + 1.3, -2.9, -D / 2 + 2.3, 1.2); }
  // 테이블 · 의자 (먹고 가기 자리) + 펜던트 조명
  const seats = []; const tabM = lam({ color: kind === 'pub' ? '#5a3e2a' : '#d8c3a5' });
  if (kind !== 'mart') for (let i = 0; i < 4; i++) { const x = -4.5 + (i % 2) * 9 * (i < 2 ? 0.5 : 1) + (i >= 2 ? 0 : 0), z = 0.6 + Math.floor(i / 2) * 2.6, tx = i % 2 ? 3 : -3; box(1.2, 0.06, 1.2, tabM, tx, 0.78, z); box(0.1, 0.75, 0.1, dark, tx, 0.38, z); foot(tx - 0.62, z - 0.62, tx + 0.62, z + 0.62, 0.8); for (const sd of [-1, 1]) { box(0.5, 0.06, 0.5, woodM, tx + sd * 1.0, 0.46, z); box(0.06, 0.45, 0.06, dark, tx + sd * 1.0, 0.23, z); } seats.push({ x: tx - 1.0, z, tx, tz: z }); void x; if (makeBear && i % 2 === 0) { const cu = makeBear({ color: ['#ffd1dc', '#c8e6ff', '#fff3c4', '#d8f5d0', '#e8d5ff'][(slot + i) % 5] }); cu.root.scale.setScalar(0.42); cu.root.position.set(tx + 1.0, 0.18, z); cu.root.rotation.y = -Math.PI / 2; g.add(cu.root); }
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#2b2b2b', side: THREE.DoubleSide, emissive: K.light, emissiveIntensity: 0.25 })); lamp.position.set(tx, 2.6, z); g.add(lamp); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: K.light })); bulb.position.set(tx, 2.45, z); g.add(bulb); }
  // 화분 · 벽 그림
  for (const [x, z] of [[-6.2, 4.6], [6.2, 4.6]]) { box(0.5, 0.5, 0.5, lam({ color: '#c9b49a' }), x, 0.25, z); const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), lam({ color: '#4f8a4a' })); leaf.position.set(x, 0.95, z); g.add(leaf); }
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), lam({ map: tex(160, 110, (c) => { const gr = c.createLinearGradient(0, 0, 160, 110); gr.addColorStop(0, '#ffd6e6'); gr.addColorStop(1, '#cfe8ff'); c.fillStyle = gr; c.fillRect(0, 0, 160, 110); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(110, 40, 18, 0, 7); c.fill(); c.fillStyle = '#7fb27a'; c.beginPath(); c.moveTo(0, 110); c.lineTo(60, 60); c.lineTo(110, 110); c.fill(); }) })); art.position.set(-W / 2 + 0.03, 1.9, 1.5); art.rotation.y = Math.PI / 2; g.add(art);
  g.add(new THREE.HemisphereLight('#fff6ea', '#9a8e80', 1.1)); const pl = new THREE.PointLight(K.light, 10, 18, 1.5); pl.position.set(0, 3, 0); g.add(pl);
  // 먹을 것 (주문하면 테이블 · 손에)
  return { g, O, K, kind, seats, drawMenu,
    door: { x: O.x, z: O.z + D / 2 - 0.8 }, counter: { x: O.x, z: O.z - D / 2 + 2.9 },
    spawn: { x: O.x, z: O.z + D / 2 - 1.8, face: Math.PI },
  };
}
// 음식 모형 (작게): 그릇 + 내용물 색 / 컵 / 봉투
export function foodMesh(kind, item) {
  const g = new THREE.Group(), name = item?.[0] || '';
  if (/라떼|아메리카노|콜라|우유|맥주|소주/.test(name)) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.24, 14), new THREE.MeshPhongMaterial({ color: /맥주/.test(name) ? '#f2b33a' : /콜라/.test(name) ? '#3a1f14' : '#f7f2ea', transparent: true, opacity: 0.92, shininess: 80 })); cup.position.y = 0.12; g.add(cup); return g; }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.12, 18), new THREE.MeshPhongMaterial({ color: '#f4f1ec', shininess: 60 })); bowl.position.y = 0.06; g.add(bowl);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 18), new THREE.MeshLambertMaterial({ color: /김치|짬뽕|제육|양념|순두부/.test(name) ? '#d8432a' : /짜장/.test(name) ? '#3a2416' : /된장/.test(name) ? '#9a6a34' : /치킨|후라이드|돈가스|감자/.test(name) ? '#d9932f' : /피자|페퍼/.test(name) ? '#e8a23a' : /초밥|연어/.test(name) ? '#ff8a5c' : '#f2d28a' })); top.position.y = 0.12; g.add(top);
  return g;
}
