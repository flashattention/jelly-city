// 한강 산책: 큰 몰 안 (더현대 서울 느낌) — 지붕 유리 천창으로 쏟아지는 빛 · 층마다 둥근 흰 발코니 · 가운데 실내 정원(나무 · 잔디 · 폭포) · 1층 둘레 가게들
//   가게 앞에 서면 그 가게 안으로 (나오면 다시 몰). 큰 문으로 나가면 바깥 그 건물 앞
import * as THREE from 'three';
import { SHOP_KIND } from './hangang-shop.js';

const lam = (o) => new THREE.MeshLambertMaterial(o);
const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const MALL_SHOPS = [['카페 숲', 'cafe'], ['베이커리 하루', 'bakery'], ['한식당 소담', 'korean'], ['버거 스탠드', 'burger'], ['스시 오마카세', 'japanese'], ['딤섬 하우스', 'chinese'], ['피자 화덕', 'pizza'], ['치킨 앤 비어', 'chicken'], ['편의점', 'mart'], ['디저트 카페', 'cafe']];

export function buildMall(hg, name, slot, makeBear) {
  const O = new THREE.Vector3(104000 + slot * 300, 0, 0), g = new THREE.Group(); g.position.copy(O); g.visible = false; hg.scene.add(g);
  const W = 70, D = 40, H = 22, foot = (x0, z0, x1, z1, h = 6) => hg.addFoot({ ring: [[O.x + x0, O.z + z0], [O.x + x1, O.z + z0], [O.x + x1, O.z + z1], [O.x + x0, O.z + z1]], h, x0: O.x + Math.min(x0, x1), x1: O.x + Math.max(x0, x1), z0: O.z + Math.min(z0, z1), z1: O.z + Math.max(z0, z1), name: '', type: 'stone', noClimb: true });
  const box = (w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; };
  // 바닥: 밝은 대리석 (반짝)
  const marT = tex(256, 256, (c) => { c.fillStyle = '#ece8e1'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#e6e1d8' : '#efebe4'; c.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } c.strokeStyle = 'rgba(160,150,140,.15)'; for (let k = 0; k < 20; k++) { c.beginPath(); c.moveTo(Math.random() * 256, Math.random() * 256); c.bezierCurveTo(Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256, Math.random() * 256); c.stroke(); } }); marT.wrapS = marT.wrapT = THREE.RepeatWrapping; marT.repeat.set(W / 6, D / 6);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshPhongMaterial({ map: marT, shininess: 90, specular: '#ffffff' })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; g.add(fl);
  const white = lam({ color: '#f6f4f0', emissive: '#fff6ea', emissiveIntensity: 0.22 }), wallM = lam({ color: '#efebe5' });
  for (const [w, x, z, ry] of [[W, 0, -D / 2, 0], [W, 0, D / 2, Math.PI], [D, -W / 2, 0, Math.PI / 2], [D, W / 2, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallM); m.position.set(x, H / 2, z); m.rotation.y = ry; g.add(m); }
  foot(-W / 2 - 1, -D / 2 - 1, W / 2 + 1, -D / 2); foot(-W / 2 - 1, D / 2, W / 2 + 1, D / 2 + 1); foot(-W / 2 - 1, -D / 2, -W / 2, D / 2); foot(W / 2, -D / 2, W / 2 + 1, D / 2);
  // 지붕 천창: 격자 유리 + 하늘빛
  const skyT = tex(512, 256, (c) => { const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#bfe0ff'); gr.addColorStop(1, '#f4f9ff'); c.fillStyle = gr; c.fillRect(0, 0, 512, 256); c.strokeStyle = 'rgba(120,130,140,.55)'; c.lineWidth = 4; for (let x = 0; x <= 512; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); } for (let y = 0; y <= 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); } });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ map: skyT })); roof.rotation.x = Math.PI / 2; roof.position.y = H; g.add(roof);
  // 층마다 둥근 발코니 (가운데가 뚫린 타원 고리) + 유리 난간
  for (let f = 1; f <= 4; f++) { const y = f * 4.6, sh = new THREE.Shape(); sh.moveTo(-W / 2, -D / 2); sh.lineTo(W / 2, -D / 2); sh.lineTo(W / 2, D / 2); sh.lineTo(-W / 2, D / 2); sh.lineTo(-W / 2, -D / 2); const hole = new THREE.Path(); hole.absellipse(0, 0, W / 2 - 9 - f * 0.6, D / 2 - 7 - f * 0.4, 0, Math.PI * 2, true); sh.holes.push(hole);
    const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: false, curveSegments: 48 }), white); slab.rotation.x = -Math.PI / 2; slab.position.y = y - 0.7; g.add(slab);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.1, 64, 1, true), new THREE.MeshPhongMaterial({ color: '#dff0f8', transparent: true, opacity: 0.28, side: THREE.DoubleSide, shininess: 100 })); rail.scale.set(W / 2 - 9 - f * 0.6, 1, D / 2 - 7 - f * 0.4); rail.position.y = y + 0.55; g.add(rail);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, 96), lam({ color: '#c9b089' })); edge.scale.set(W / 2 - 9 - f * 0.6, D / 2 - 7 - f * 0.4, 1); edge.rotation.x = Math.PI / 2; edge.position.y = y + 1.1; g.add(edge);
    // 위층 가게 불빛 (벽 쪽 띠)
    for (const sd of [-1, 1]) box(W - 4, 2.6, 0.1, lam({ color: '#fff3dc', emissive: '#ffe6bc', emissiveIntensity: 0.35 }), 0, y + 1.6, sd * (D / 2 - 0.1)); }
  // 가운데 실내 정원: 잔디 둔덕 · 나무 · 폭포 (위에서 떨어지는 물줄기) · 둘레 벤치
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, 0.5, 48), lam({ color: '#7fb069' })); grass.scale.set(12, 1, 7); grass.position.y = 0.25; g.add(grass); foot(-10, -5.5, 10, 5.5, 0.5);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, x = Math.cos(a) * 8.5, z = Math.sin(a) * 4.6, tr = new THREE.Group(); tr.position.set(x, 0.5, z); const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), lam({ color: '#7a5a3e' })); trunk.position.y = 1.6; tr.add(trunk); for (let k = 0; k < 4; k++) { const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 - k * 0.12, 1), lam({ color: ['#5f9a52', '#6fae5c', '#4f8a46', '#7bbf66'][k] })); leaf.position.set((k % 2 ? 0.5 : -0.4), 3.2 + k * 0.5, (k % 3 ? 0.3 : -0.4)); tr.add(leaf); } g.add(tr); hg.addCircle(O.x + x, O.z + z, 0.25, 4); }
  const fallT = tex(64, 256, (c) => { for (let y = 0; y < 256; y++) { c.fillStyle = `rgba(220,240,255,${0.35 + Math.random() * 0.4})`; c.fillRect(Math.random() * 64, y, 2 + Math.random() * 6, 1); } }); fallT.wrapT = THREE.RepeatWrapping;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(4, 12), new THREE.MeshBasicMaterial({ map: fallT, transparent: true, opacity: 0.8, depthWrite: false })); fall.position.set(0, 6.5, -4.2); g.add(fall); const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), lam({ color: '#8a8580' })); rock.scale.set(2, 0.7, 1.2); rock.position.set(0, 0.7, -4.2); g.add(rock); const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshPhongMaterial({ color: '#7fb8d0', shininess: 100 })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.52, -3); g.add(pool);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3, x = Math.cos(a) * 13.5, z = Math.sin(a) * 8.2; box(2.2, 0.45, 0.6, lam({ color: '#c9a77a' }), x, 0.23, z).rotation.y = -a + Math.PI / 2; hg.addCircle(O.x + x, O.z + z, 0.6, 0.5); }
  // 1층 가게들 (긴 벽 두 면): 유리 앞면 · 간판 · 안쪽 불빛
  const fronts = [];
  MALL_SHOPS.forEach(([nm, kind], i) => { const sd = i % 2 ? 1 : -1, k = Math.floor(i / 2), x = -W / 2 + 8 + k * 13, z = sd * (D / 2 - 0.15), K = SHOP_KIND[kind];
    const sign = tex(256, 48, (c) => { c.fillStyle = K.awn; c.fillRect(0, 0, 256, 48); c.fillStyle = '#fff'; c.font = 'bold 24px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`${K.emoji} ${nm}`, 128, 26, 240); });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), lam({ map: sign, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: 0.4 })); s.position.set(x, 3.6, z - sd * 0.02); s.rotation.y = sd > 0 ? Math.PI : 0; g.add(s);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), lam({ color: '#fff0d8', emissive: K.light, emissiveIntensity: 0.45 })); gl.position.set(x, 1.5, z - sd * 0.03); gl.rotation.y = sd > 0 ? Math.PI : 0; g.add(gl);
    fronts.push({ name: nm, kind, x: O.x + x, z: O.z + z - sd * 0.9, nx: 0, nz: -sd, mall: true }); });
  // 큰 문 (앞 벽 가운데) + 사람들 (곰)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: tex(128, 96, (c) => { const gr = c.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#d9ecff'); gr.addColorStop(1, '#f6f2ea'); c.fillStyle = gr; c.fillRect(0, 0, 128, 96); c.fillStyle = 'rgba(80,90,100,.6)'; c.fillRect(62, 0, 4, 96); }) })); door.position.set(-W / 2 + 0.05, 2, 0); door.rotation.y = Math.PI / 2; g.add(door);
  if (makeBear) for (let i = 0; i < 14; i++) { const b = makeBear({ color: ['#ffd1dc', '#c8e6ff', '#fff3c4', '#d8f5d0', '#e8d5ff', '#f2d4b0', '#ffffff'][i % 7] }); b.root.scale.setScalar(0.42); const a = Math.random() * Math.PI * 2, rr = 15 + Math.random() * 6; b.root.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr * 0.55); b.root.rotation.y = Math.random() * 6.28; g.add(b.root); }
  g.add(new THREE.HemisphereLight('#ffffff', '#c9bfb0', 1.3)); const sun = new THREE.DirectionalLight('#fff4e0', 1.2); sun.position.set(10, 30, 8); g.add(sun); g.add(sun.target); sun.target.position.set(0, 0, 0);
  return { g, O, fronts, name, fall: fallT, door: { x: O.x - W / 2 + 1.2, z: O.z }, spawn: { x: O.x - W / 2 + 3.5, z: O.z, face: Math.PI / 2 }, tick(dt) { fallT.offset.y = (fallT.offset.y - dt * 0.8) % 1; } };
}
