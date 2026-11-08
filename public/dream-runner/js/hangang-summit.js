// 남산 정상 (지도 kind 'summit'): 정상 광장은 높이 0, 서울은 발아래로 (도시 · 한강 · 먼 건물을 drop 만큼 내린다)
//   숲으로 덮인 산비탈 · N서울타워(흰 콘크리트 기둥 · 전망대 · 빨강 · 흰 안테나 · 밤 색조명) · 사랑의 자물쇠 울타리 · 팔각정 · 봉수대 · 케이블카
import * as THREE from 'three';

const lam = (o) => new THREE.MeshLambertMaterial(o);

// world: 서울 전체(진짜 지형) — 산 · 발아래로 내리기 · 걷는 범위는 빼고 타워 · 광장 · 자물쇠 · 케이블카 · 전망대 · 비탈 숲만 (지형 높이는 칸을 얹을 때 더해진다)
export function buildSummit(hg, { world = false } = {}) {
  const M = hg.map, S = M.scale, sc = hg.scene, DROP = world ? 0 : 228, H = (x, z) => (world ? hg.host.terrAt(x, z, true) : 0);
  // 정상 한가운데: 타워 조각들의 가운데 (없으면 코스 가운데)
  const ni = M.names.indexOf('남산서울타워'); let cx = 0, cz = 0, n = 0;
  for (const b of M.buildings) if (b[4] === ni && b[1] > 1) for (let k = 7; k < b.length; k += 2) { cx += b[k] * S; cz += b[k + 1] * S; n++; }
  if (!n) { for (const p of hg.rp) { cx += p[0]; cz += p[1]; n++; } } cx /= n; cz /= n;
  let R = 60; if (!world) { for (const p of hg.rp) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cz) + 30); hg.walkLimit = { x: cx, z: cz, r: R - 4 }; }
  if (!world) {
  // 1) 발아래로: 먼 땅 · 물 · 섬 · 먼 건물 (깊이를 쓰게 해서 산비탈 뒤로 숨는다)
  for (const o of [...sc.children]) { if (!o.isMesh && !o.isInstancedMesh) continue; let bs; if (o.isInstancedMesh) { o.computeBoundingSphere(); bs = o.boundingSphere; } else { o.geometry.computeBoundingSphere?.(); bs = o.geometry.boundingSphere; } if (bs && bs.radius > 9000) continue; const far = o === hg.farIM || (bs && Math.hypot(bs.center.x - cx, bs.center.z - cz) > R * 2.2) || o.renderOrder === -60; if (!far) continue; o.position.y -= DROP; if (o.material) o.material.depthTest = true; }
  // 2) 산: 정상 평지(반지름 R) → 비탈 → 도시 높이 (가장자리 1400m), 숲 색 + 바위 · 길 무늬
  const RIM = 1400, rings = 46, segs = 96, P = [], C2 = [], I = [], col = new THREE.Color();
  for (let i = 0; i <= rings; i++) { const t = i / rings, r = t < 0.12 ? (t / 0.12) * R : R + ((t - 0.12) / 0.88) ** 1.15 * (RIM - R); for (let j = 0; j <= segs; j++) { const a = (j / segs) * Math.PI * 2, wob = 1 + Math.sin(a * 3 + 1.3) * 0.12 + Math.sin(a * 7) * 0.05, rr = r <= R ? r : R + (r - R) * wob, k = r <= R ? 0 : Math.min(1, (r - R) / (RIM - R)), y = r <= R ? -0.03 : -DROP * (1 - Math.cos(k * Math.PI)) / 2 + Math.sin(a * 11 + r * 0.02) * 6 * Math.sin(k * Math.PI);
      P.push(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr); if (r <= R) col.set('#b8b0a2'); else { col.set(k < 0.08 ? '#6f8a55' : '#3f6a3c').offsetHSL((Math.sin(a * 17 + r) * 0.5) * 0.03, 0, (Math.sin(a * 29 + r * 0.05) * 0.5) * 0.06); if (k > 0.85) col.lerp(new THREE.Color('#8a8f86'), (k - 0.85) * 4); } C2.push(col.r, col.g, col.b); } }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3)); mg.setIndex(I); mg.computeVertexNormals();
  const mtn = new THREE.Mesh(mg, lam({ vertexColors: true })); mtn.renderOrder = -61; mtn.receiveShadow = true; sc.add(mtn);
  }
  // 비탈 숲: 둥근 나무 덩어리 (봄 · 가을엔 계절 색이 조금)
  const NT = world ? 4600 : 2600, tg = new THREE.IcosahedronGeometry(1, 1), tm = lam({ color: '#ffffff', vertexColors: false }), trees = new THREE.InstancedMesh(tg, tm, NT), o3 = new THREE.Object3D(), tc = new THREE.Color();
  // 진짜 지형이면 높은 비탈(땅 높이 45m 위)에만 — 아래 동네(명동 · 이태원)에는 안 심는다
  const RIM_ = 1400;
  let q = 0; for (let i = 0; i < NT * 5 && q < NT; i++) { const a = Math.random() * Math.PI * 2, r = R + 12 + Math.random() ** 0.8 * (RIM_ * 0.85 - R), tx = cx + Math.cos(a) * r, tz = cz + Math.sin(a) * r; if (world && (H(tx, tz) < 45 || hg.host.inWater(tx, tz))) continue; const k = Math.min(1, (r - R) / (RIM_ - R)), y = -DROP * (1 - Math.cos(k * Math.PI)) / 2, s2 = world ? 4.5 + Math.random() * 4.5 : 3 + Math.random() * 4; o3.position.set(cx + Math.cos(a) * r, y + s2 * 0.6, cz + Math.sin(a) * r); o3.scale.set(s2, s2 * (0.8 + Math.random() * 0.5), s2); o3.updateMatrix(); trees.setMatrixAt(q, o3.matrix); trees.setColorAt(q, tc.set(['#3f6a3c', '#4f7a44', '#355f36', '#5a8a4a', '#2f5a34'][q % 5])); q++; }
  trees.count = q; sc.add(trees); hg.summitTrees = trees;
  // 3) N서울타워 (실제 비율): 기단 → 흰 콘크리트 기둥(살짝 가늘어짐) → 전망대(여러 층 · 창 띠) → 위 기둥 → 빨강 · 흰 안테나 (꼭대기 236m)
  const T = new THREE.Group(); T.position.set(cx, 0, cz); sc.add(T); const conc = lam({ color: '#ecebe6' }), dark = lam({ color: '#3a3f47' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 132, 24), conc); shaft.position.y = 66; T.add(shaft);
  for (let y = 10; y < 130; y += 12) { const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6 - y * 0.0105 + 0.05, 0.08, 4, 32), lam({ color: '#d9d6cf' })); ring.rotation.x = Math.PI / 2; ring.position.y = y; T.add(ring); }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(13, 4.4, 9, 32, 1, true), conc); skirt.material.side = THREE.DoubleSide; skirt.position.y = 129; T.add(skirt);
  const winT = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c = cv.getContext('2d'); c.fillStyle = '#2f3a46'; c.fillRect(0, 0, 256, 32); for (let x = 0; x < 256; x += 8) { c.fillStyle = 'rgba(255,240,210,.85)'; c.fillRect(x + 1, 6, 6, 20); } const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const podWin = lam({ map: winT, emissive: '#ffffff', emissiveMap: winT, emissiveIntensity: 0.15 }); hg.towerWinM = podWin;
  for (const [y, r0, r1, h] of [[135, 13.4, 13.4, 4.5], [140, 14.2, 14.2, 4.5], [145, 13.6, 13.6, 4.2], [149.5, 12.2, 12.2, 3.8]]) { const lv = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 40, 1, true), podWin); lv.position.y = y + h / 2; T.add(lv); const cap = new THREE.Mesh(new THREE.CylinderGeometry(r1 + 0.4, r1 + 0.4, 0.5, 40), conc); cap.position.y = y + h; T.add(cap); }
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 22, 16), conc); upper.position.y = 165; T.add(upper);
  for (let i = 0; i < 9; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(1.4 - i * 0.12, 1.5 - i * 0.12, 7.2, 10), lam({ color: i % 2 ? '#f2f0ea' : '#d8352a' })); seg.position.y = 179.6 + i * 7.2; T.add(seg); }
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff3b30' })); tipL.position.y = 236.5; T.add(tipL); hg.towerTip = tipL;
  // 밤 색조명: 기둥에 은은한 색 (천천히 바뀐다) + 전망대 아래 빛 띠
  const glowM = new THREE.MeshBasicMaterial({ color: '#7a6cff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); const glow = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6.0, 128, 24, 1, true), glowM); glow.position.y = 64; T.add(glow); hg.towerGlowM = glowM;
  hg.addCircle(cx, cz, 6, 300);
  // 기단 건물 둘레 테라스 바닥 (돌)
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(28, 48), lam({ color: '#cfc8bb' })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.02, cz); sc.add(plaza);
  // 4) 사랑의 자물쇠: 타워 둘레 울타리에 색색 자물쇠가 빼곡
  { const N = 1800, rr = 34, lg = new THREE.BoxGeometry(0.12, 0.14, 0.05), im = new THREE.InstancedMesh(lg, lam({ color: '#ffffff' }), N), oo = new THREE.Object3D(), c3 = new THREE.Color(); for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 * 0.62 + 2.2, y = 0.35 + Math.random() * 0.95, jit = (Math.random() - 0.5) * 0.06; oo.position.set(cx + Math.cos(a) * (rr + jit), y, cz + Math.sin(a) * (rr + jit)); oo.rotation.set(0, -a, (Math.random() - 0.5) * 0.6); oo.updateMatrix(); im.setMatrixAt(i, oo.matrix); im.setColorAt(i, c3.set(['#ff4d6d', '#ffd23f', '#4fc3ff', '#7be07b', '#ff9ec0', '#b57bff', '#ffffff', '#ff8a3d'][i % 8])); } sc.add(im);
    const railM = lam({ color: '#5a5f66' }); for (const y of [0.3, 1.35]) { const rail = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.04, 4, 120, Math.PI * 2 * 0.62), railM); rail.rotation.x = Math.PI / 2; rail.rotation.z = -2.2; rail.position.set(cx, y, cz); sc.add(rail); } }
  // 5) 팔각정 · 봉수대 (이정표 자리 옆)
  const markAt = (re, lat) => { const m = (M.marks || []).find(([nm]) => re.test(nm)); return m ? hg.world(m[1], lat) : null; };
  const pv = markAt(/팔각정/, 10); if (pv) { const g = new THREE.Group(); g.position.set(pv[0], 0, pv[1]); sc.add(g); const base = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 0.8, 8), lam({ color: '#b9b0a0' })); base.position.y = 0.4; g.add(base); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8, col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 3.6, 10), lam({ color: '#9a2a1e' })); col2.position.set(Math.cos(a) * 5.6, 2.6, Math.sin(a) * 5.6); g.add(col2); hg.addCircle(pv[0] + Math.cos(a) * 5.6, pv[1] + Math.sin(a) * 5.6, 0.3, 4.4); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.0, 0.6, 8, 1, true), lam({ color: '#2f7a6a', side: THREE.DoubleSide })); beam.position.y = 4.5; g.add(beam); const roof = new THREE.Mesh(new THREE.ConeGeometry(8.6, 3.6, 8, 1), lam({ color: '#4a4e55' })); roof.position.y = 6.5; roof.scale.y = 0.85; g.add(roof); const eave = new THREE.Mesh(new THREE.CylinderGeometry(8.9, 8.9, 0.25, 8), lam({ color: '#3a3e44' })); eave.position.y = 5.0; g.add(eave); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), lam({ color: '#c9a24a' })); knob.position.y = 8.2; g.add(knob); }
  const bs = markAt(/봉수대/, 12); if (bs) for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.position.set(bs[0] + (i - 2) * 4.2, 0, bs[1]); sc.add(g); const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.4, 12), lam({ color: '#a59a88' })); mound.position.y = 0.7; g.add(mound); const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 2.2, 12), lam({ color: '#b8ad9a' })); chim.position.y = 2.5; g.add(chim); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.3, 12), dark); top.position.y = 3.7; g.add(top); hg.addCircle(g.position.x, g.position.z, 1.8, 3.8); }
  // 6) 케이블카: 위 정류장(지도 건물) → 북쪽 아래로 줄 두 개 + 오가는 빨간 · 노란 객차
  { const kn = M.names.indexOf('남산케이블카'); let kx = 0, kz = 0, kc = 0; for (const b of M.buildings) if (b[4] === kn) for (let k = 7; k < b.length; k += 2) { kx += b[k] * S; kz += b[k + 1] * S; kc++; }
    if (kc) { kx /= kc; kz /= kc; const dir = new THREE.Vector3(kx - cx, 0, kz - cz).normalize(), L = 600, end = new THREE.Vector3(kx + dir.x * L, world ? 8 : -150, kz + dir.z * L), start = new THREE.Vector3(kx, 8, kz), side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const sd of [-1.6, 1.6]) { const g = new THREE.BufferGeometry().setFromPoints([start.clone().addScaledVector(side, sd), end.clone().addScaledVector(side, sd)]); sc.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#2a2a2a' }))); }
      hg.cable = { start, end, side, cabins: [0, 1].map((k) => { const cab = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 3.4), lam({ color: k ? '#ffd23f' : '#d8352a' })); body.position.y = -2.4; cab.add(body); const win = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.9, 3.0), lam({ color: '#2a3442', emissive: '#ffe8b0', emissiveIntensity: 0.2 })); win.position.y = -2.1; cab.add(win); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), dark); arm.position.y = -0.7; cab.add(arm); cab.userData.noDrape = true; sc.add(cab); return { cab, k }; }), t: 0 };
      // 진짜 지형: 줄(선)은 칸을 얹을 때 양 끝 땅 높이가 더해진다. 객차가 다니는 길도 같은 높이로
      if (world) { hg.cable.start = start.clone().setY(8 + H(start.x, start.z)); hg.cable.end = end.clone().setY(8 + H(end.x, end.z)); } } }
  // 7) 전망대 안 (실제 높이 140m): 바닥 · 천장 · 유리창 틀 · 가운데 엘리베이터 기둥 · 망원경 · 경치 보는 곰. 바깥이 진짜로 내려다보인다
  const DY = 140, DR = 12.6, deck = new THREE.Group(); deck.position.set(cx, DY, cz); sc.add(deck);
  const fl = new THREE.Mesh(new THREE.RingGeometry(4.6, DR, 48), lam({ color: '#c9b49a', side: THREE.DoubleSide })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.02; deck.add(fl);
  const ce = new THREE.Mesh(new THREE.RingGeometry(4.6, DR, 48), lam({ color: '#f0ece4', side: THREE.DoubleSide })); ce.rotation.x = Math.PI / 2; ce.position.y = 3.4; deck.add(ce);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, mu = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), dark); mu.position.set(Math.cos(a) * (DR - 0.1), 1.7, Math.sin(a) * (DR - 0.1)); deck.add(mu); }
  const sill = new THREE.Mesh(new THREE.TorusGeometry(DR - 0.25, 0.06, 4, 64), lam({ color: '#8a6440' })); sill.rotation.x = Math.PI / 2; sill.position.y = 0.95; deck.add(sill);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3.4, 32), lam({ color: '#e8e2d8' })); core.position.y = 1.7; deck.add(core);
  const evT = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#c9ced4'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#2b3039'; c.fillRect(0, 0, 128, 14); c.fillStyle = '#ffd98a'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('엘리베이터 ▼', 64, 11); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ev = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), lam({ map: evT, emissive: '#ffffff', emissiveMap: evT, emissiveIntensity: 0.2 })); ev.position.set(0, 1.3, 4.52); deck.add(ev);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.2, l = new THREE.Mesh(new THREE.CircleGeometry(0.25, 12), new THREE.MeshBasicMaterial({ color: '#fff3dc' })); l.rotation.x = Math.PI / 2; l.position.set(Math.cos(a) * 8.6, 3.38, Math.sin(a) * 8.6); deck.add(l); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5, tg = new THREE.Group(); tg.position.set(Math.cos(a) * (DR - 1.1), 0, Math.sin(a) * (DR - 1.1)); tg.rotation.y = -a + Math.PI / 2; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.2, 8), dark); st.position.y = 0.6; tg.add(st); const sc2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 10), lam({ color: '#c9a24a' })); sc2.rotation.x = Math.PI / 2; sc2.position.set(0, 1.25, 0.1); tg.add(sc2); deck.add(tg); }
  const ring = (r, h) => { const pts = []; for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return pts; };
  // 밟는 바닥(140m) + 바깥 유리벽 (조각 32개) — 부딪힘만
  hg.addFoot({ ring: ring(DR, 0), h: DY, x0: cx - DR, x1: cx + DR, z0: cz - DR, z1: cz + DR, name: 'N서울타워 전망대', type: 'stone', noClimb: true, deck: true });
  for (let i = 0; i < 32; i++) { const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2, r0 = DR - 0.2, r1 = DR + 0.3, q = [[cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1]], xs = q.map((p) => p[0]), zs = q.map((p) => p[1]); hg.addFoot({ ring: q, h: DY + 3.4, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), name: '', type: 'stone', noClimb: true, deckWall: true }); }
  hg.deckInfo = { cx, cz, DY, DR, deck }; if (world) hg.host.deckInfo = hg.deckInfo; // 전망대 드나들기는 서울 전체(바깥) 쪽에서 본다
  return { cx, cz, R, DROP };
}
export function deckBears(hg, makeBear) { const D = hg.deckInfo; if (!D || D.bears) return; D.bears = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.9, b = makeBear({ color: ['#ffd1dc', '#c8e6ff', '#fff3c4', '#d8f5d0', '#e8d5ff', '#f2d4b0', '#ffffff'][i] }); b.root.scale.setScalar(0.42); b.root.position.set(Math.cos(a) * (D.DR - 1.4), 0.02, Math.sin(a) * (D.DR - 1.4)); b.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); D.deck.add(b.root); D.bears.push(b); } }
// 밤 조명 · 케이블카 움직임
export function tickSummit(hg, dt, lit) {
  if (hg.towerGlowM) { const h = (hg.time * 0.01) % 1; hg.towerGlowM.color.setHSL(0.62 + Math.sin(h * Math.PI * 2) * 0.12, 0.7, 0.55); hg.towerGlowM.opacity = lit * 0.45; }
  if (hg.towerWinM) hg.towerWinM.emissiveIntensity = 0.15 + lit * 0.85;
  if (hg.towerTip) hg.towerTip.visible = Math.sin(hg.time * 3) > -0.2;
  const C = hg.cable; if (C) { C.t = (C.t + dt / 90) % 1; for (const { cab, k } of C.cabins) { const u = k ? 1 - C.t : C.t, p = C.start.clone().lerp(C.end, u).addScaledVector(C.side, k ? 1.6 : -1.6); p.y -= Math.sin(u * Math.PI) * 18; cab.position.copy(p); } }
}
