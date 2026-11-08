// 젤리 오디세이: 바이러스 군단 (형광 초록 사이버 조각 · 네온 빛 · 글리치 · 악당 얼굴)
//   얼굴은 젤리 세계 고유 디자인: 위로 치켜 올라간 가는 초승달 눈 + 빛나는 작은 눈동자 + 귀까지 찢어진 톱니 웃음
import * as THREE from 'three';
const place = (o, p) => { if (p.position) o.position.copy(p.position); if (p.rotation) o.rotation.copy(p.rotation); if (p.scale) o.scale.copy(p.scale); return o; };

const R = (a, b) => a + Math.random() * (b - a);
let faceTex = null, glowTex = null;
export function virusFace() {
  if (faceTex) return faceTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 160);
  // 눈: 바깥쪽이 위로 치켜 올라간 초승달 (안쪽 끝은 아래로 날카롭게)
  for (const s of [-1, 1]) {
    const cx = 128 + s * 52;
    g.save(); g.translate(cx, 52); g.scale(s, 1);
    g.strokeStyle = '#eaffef'; g.lineWidth = 5; g.fillStyle = '#05150a'; g.beginPath(); g.moveTo(-36, 10); g.quadraticCurveTo(-6, -4, 34, -26); g.quadraticCurveTo(14, 18, -36, 10); g.stroke(); g.fill();
    g.fillStyle = '#eaffef'; g.shadowColor = '#d6ff3a'; g.shadowBlur = 14; g.beginPath(); g.ellipse(6, 0, 6, 4, -0.5, 0, 7); g.fill(); g.restore();
  }
  // 웃음: 양 끝이 위로 말려 올라간 넓은 입 + 위아래 톱니 이빨
  g.shadowBlur = 0; g.fillStyle = '#05150a';
  g.strokeStyle = '#eaffef'; g.lineWidth = 5; g.beginPath(); g.moveTo(26, 86); g.quadraticCurveTo(128, 150, 230, 86); g.quadraticCurveTo(128, 120, 26, 86); g.stroke(); g.fill();
  g.fillStyle = '#f2fff4';
  for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, x = 26 + t * 204, yTop = 86 + Math.sin(t * Math.PI) * 17, yBot = 86 + Math.sin(t * Math.PI) * 46; g.beginPath(); g.moveTo(x - 9, yTop - 1); g.lineTo(x + 9, yTop - 1); g.lineTo(x, yTop + 11); g.fill(); if (i > 0 && i < 8) { g.beginPath(); g.moveTo(x - 8, yBot + 1); g.lineTo(x + 8, yBot + 1); g.lineTo(x, yBot - 9); g.fill(); } }
  // 글리치 줄 한 가닥
  g.fillStyle = 'rgba(255,60,220,.55)'; g.fillRect(14, 70, 228, 3);
  faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace; return faceTex;
}
export function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
// 조각 덩어리 모양: 여러 다면체를 무작위로 겹쳐 한 덩어리로 (종류마다 몇 가지 만들어 돌려 쓴다)
const shardCache = {};
function shardGeo(kind, v) {
  const key = `${kind}${v}`; if (shardCache[key]) return shardCache[key];
  const P = [], N = [], C = [], col = new THREE.Color(), dark = new THREE.Color('#0b5a25'), lite = new THREE.Color('#7dff9a');
  const add = (g, m) => { g = g.index ? g.toNonIndexed() : g.clone(); g.applyMatrix4(m); g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal; const k = Math.random(); for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); col.copy(dark).lerp(lite, Math.min(1, k * 0.7 + (n.getY(i) * 0.5 + 0.5) * 0.5)); C.push(col.r, col.g, col.b); } };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const n = kind === 'worm' ? 9 : kind === 'giant' ? 26 : 16;
  for (let i = 0; i < n; i++) {
    const g = [new THREE.TetrahedronGeometry(1), new THREE.OctahedronGeometry(1), new THREE.BoxGeometry(1.2, 1.2, 1.2)][i % 3];
    const r = i === 0 ? 0 : R(0.25, 0.75);
    p.set(R(-1, 1), R(-1, 1), R(-1, 1)).normalize().multiplyScalar(r); p.y *= 1.15;
    const sz = i === 0 ? 0.62 : R(0.18, 0.42);
    s.set(sz * R(0.7, 1.3), sz * R(0.8, 1.5), sz * R(0.7, 1.3));
    m.compose(p, q.setFromEuler(e.set(R(0, 6), R(0, 6), R(0, 6))), s); add(g, m);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return (shardCache[key] = { geo, edges: new THREE.EdgesGeometry(geo, 25) });
}
// 바이러스 공용 재질 (네온은 발광 + 화면 빛 번짐)
const BODY = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#1dff5a', emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.1, flatShading: true });
const BODY_SPY = BODY.clone(); BODY_SPY.transparent = true; BODY_SPY.opacity = 0.12; BODY_SPY.depthWrite = false;
const EDGE = new THREE.LineBasicMaterial({ color: '#c8ffd8', transparent: true, opacity: 0.9 });
const EDGE_RGB = new THREE.LineBasicMaterial({ color: '#ff3cdc', transparent: true, opacity: 0.8 });
const FACE = new THREE.MeshBasicMaterial({ map: virusFace(), transparent: true, depthWrite: false });
const HALO = new THREE.SpriteMaterial({ map: glow(), color: '#2bff63', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
// 종류: 크기 · 체력 · 속도 · 공격 (난이도 배율은 main 에서)
export const KINDS = {
  worm: { size: 0.55, hp: 22, speed: 6.2, dmg: 6, reach: 1.4, wind: 0.32, cd: 0.9, name: '웜 조각' },
  soldier: { size: 0.95, hp: 70, speed: 3.6, dmg: 12, reach: 2.0, wind: 0.5, cd: 1.4, guard: true, name: '트로이 병사' },
  spy: { size: 0.85, hp: 40, speed: 5.0, dmg: 16, reach: 1.8, wind: 0.35, cd: 1.2, stealth: true, name: '스파이웨어' },
  bear: { size: 0.9, hp: 55, speed: 4.4, dmg: 11, reach: 1.9, wind: 0.42, cd: 1.2, name: '감염된 곰돌이' },
  statue: { size: 1.4, hp: 160, speed: 2.4, dmg: 22, reach: 2.6, wind: 0.8, cd: 2.0, name: '감염된 조각상' },
  king: { size: 2.2, hp: 1800, speed: 2.6, dmg: 26, reach: 4.2, wind: 1.0, cd: 2.0, armor: 0.2, name: '바이러스 왕' },
  giant: { size: 2.6, hp: 950, speed: 1.9, dmg: 30, reach: 3.6, wind: 1.0, cd: 2.4, armor: 0.55, name: '랜섬 거인' },
};
export function virusMesh(kind) {
  const K = KINDS[kind], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  let core;
  if (kind === 'bear') {
    // 감염된 곰돌이: 곰 모양(몸 · 머리 · 귀)이 초록 조각으로 깨진 모습
    const sh = shardGeo('bear', 0);
    for (const [y, s] of [[0.75, 0.62], [1.65, 0.48]]) { const m = new THREE.Mesh(sh.geo, BODY); m.position.y = y; m.scale.setScalar(s); body.add(m); body.add(place(new THREE.LineSegments(sh.edges, EDGE), { position: m.position.clone(), scale: m.scale.clone() })); }
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), BODY); e.position.set(sx * 0.33, 2.05, 0); body.add(e); }
    core = body.children[0];
  } else if (kind === 'giant') {
    // 랜섬 거인: 커다란 자물쇠 몸 + 위 고리, 등에 빛나는 열쇠 구멍(약점)
    const sh = shardGeo('giant', 0); core = new THREE.Mesh(sh.geo, BODY); core.scale.set(1.5, 1.3, 1.1); core.position.y = 1.5; body.add(core); body.add(place(new THREE.LineSegments(sh.edges, EDGE), { position: core.position.clone(), scale: core.scale.clone() }));
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#284f33', emissive: '#1dff5a', emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 })); shackle.position.y = 2.75; body.add(shackle);
    const key = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshBasicMaterial({ color: '#fff36b' })); key.position.set(0, 1.7, -1.25); key.rotation.y = Math.PI; body.add(key);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.5), new THREE.MeshBasicMaterial({ color: '#fff36b' })); slot.position.set(0, 1.35, -1.25); slot.rotation.y = Math.PI; body.add(slot);
    g.userData.key = key;
  } else if (kind === 'king') {
    // 바이러스 왕: 큰 조각 몸 + 날카로운 조각 왕관 + 가슴의 빛나는 핵(약점) + 어깨 가시
    const sh = shardGeo('giant', 1); core = new THREE.Mesh(sh.geo, BODY); core.scale.set(1.25, 1.55, 1.05); core.position.y = 1.9; body.add(core); body.add(place(new THREE.LineSegments(sh.edges, EDGE), { position: core.position.clone(), scale: core.scale.clone() }));
    const crownM = new THREE.MeshStandardMaterial({ color: '#2a5a10', emissive: '#c8ff3a', emissiveIntensity: 1.4, flatShading: true });
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9 + (i % 2) * 0.5, 4), crownM); sp.position.set(Math.cos(a) * 0.62, 3.6, Math.sin(a) * 0.62); sp.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); body.add(sp); }
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 4), crownM); sp.position.set(sx * (1.2 + i * 0.15), 2.7 - i * 0.2, -0.2 + i * 0.25); sp.rotation.z = -sx * (0.9 + i * 0.2); body.add(sp); }
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: '#fff36b' })); heart.position.set(0, 1.75, 1.1); body.add(heart); g.userData.heart = heart;
  } else {
    const sh = shardGeo(kind, Math.floor(Math.random() * 3)); core = new THREE.Mesh(sh.geo, K.stealth ? BODY_SPY : BODY); core.position.y = 1; body.add(core);
    const ed = new THREE.LineSegments(sh.edges, EDGE); ed.position.y = 1; body.add(ed); g.userData.edge = ed;
    if (kind === 'statue') { const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), new THREE.MeshStandardMaterial({ color: '#8f9a90', roughness: 0.8 })); base.position.y = -0.55; body.add(base); }
  }
  // 얼굴: 몸 앞
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94), K.stealth ? FACE.clone() : FACE);
  face.position.set(0, kind === 'bear' ? 1.66 : kind === 'giant' ? 1.95 : kind === 'king' ? 2.75 : 1.12, kind === 'bear' ? 0.55 : kind === 'giant' ? 1.7 : kind === 'king' ? 1.45 : 1.05); face.renderOrder = 5; body.add(face); g.userData.face = face;
  if (kind === 'giant' || kind === 'king') face.scale.setScalar(kind === 'king' ? 1.5 : 1.7);
  // 방패 (트로이 병사): 육각 판
  if (K.guard) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 6), new THREE.MeshStandardMaterial({ color: '#0b3a1a', emissive: '#30ff70', emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.3 })); s.rotation.set(Math.PI / 2, 0, 0.9); s.position.set(0.85, 0.85, 0.45); body.add(s); g.userData.shield = s; }
  // 네온 빛 무리
  const halo = new THREE.Sprite(K.stealth ? HALO.clone() : HALO); halo.scale.setScalar(3.2); halo.position.y = kind === 'giant' ? 1.6 : kind === 'king' ? 2 : 1; if (kind === 'king') halo.scale.setScalar(5); body.add(halo); g.userData.halo = halo;
  // 글리치 색 분리 (가끔 분홍 외곽선이 옆으로 튄다)
  if (g.userData.edge) { const rgb = new THREE.LineSegments(g.userData.edge.geometry, EDGE_RGB); rgb.position.copy(g.userData.edge.position); rgb.visible = false; body.add(rgb); g.userData.rgb = rgb; }
  g.scale.setScalar(K.size); g.userData.body = body; g.userData.core = core;
  return g;
}
// 매 프레임: 둥실 · 글리치 떨림 · 공격 직전 부풀기 · 스파이웨어 투명도
export function animateVirus(v, dt, t) {
  const U = v.mesh.userData, b = U.body;
  b.position.y = Math.sin(t * 3 + v.seed) * 0.08;
  b.rotation.y = Math.sin(t * 1.7 + v.seed) * 0.12;
  const wind = v.windup > 0 ? 1 - v.windup / v.K.wind : 0;
  b.scale.setScalar(1 + wind * 0.18 + (v.hitT > 0 ? 0.12 : 0));
  if (U.core && U.core.rotation) U.core.rotation.y += dt * (v.kind === 'worm' ? 3 : 0.8);
  if (Math.random() < 0.03 + (v.hitT > 0 ? 0.3 : 0)) { b.position.x = R(-0.12, 0.12); if (U.rgb) { U.rgb.visible = true; U.rgb.position.x = R(-0.15, 0.15); } } else { b.position.x *= 0.7; if (U.rgb && Math.random() < 0.3) U.rgb.visible = false; }
  if (U.halo && v.kind !== 'king') U.halo.scale.setScalar(3.2 + Math.sin(t * 6 + v.seed) * 0.25 + wind * 1.2);
  if (v.K.stealth) { const vis = v.reveal; U.core.material.opacity = 0.12 + vis * 0.85; U.face.material.opacity = 0.15 + vis * 0.85; U.halo.material.opacity = 0.1 + vis * 0.5; U.edge.visible = vis > 0.3; }
}
