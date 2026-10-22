// 젤리라이더 트랙: 드림 러너의 꿈 테마로 꾸민 서킷. 씨앗으로 모양을 만들어서 모두에게 같은 트랙
//   트랙 = 닫힌 곡선(가운데 줄) + 폭 W 의 도로 + 양옆 벽 + 출발선 · 부스터 발판 · 아이템 상자 자리 · 풍경
import * as THREE from 'three';
import { RNG, bakeStatic } from '../../shared/js/utils.js';
import { THEMES } from '../../dream-runner/js/themes.js';
import { KITS, glow } from '../../dream-runner/js/kits.js';
import { topTexture } from '../../dream-runner/js/track.js';

const theme = (name) => THEMES.find((t) => t.name === name) || THEMES[0];
// 트랙 목록: 이름 · 꿈 테마 · 모양(씨앗 · 크기 · 굽이 · 높낮이)
export const TRACKS = [
  { id: 'candy', name: '사탕 공장 서킷', emoji: '🍬', theme: '사탕 공장', seed: 11, R: 120, wob: 0.32, hill: 3 },
  { id: 'cloud', name: '구름 위 왕국 링', emoji: '☁️', theme: '구름 위 왕국', seed: 27, R: 140, wob: 0.38, hill: 6 },
  { id: 'neon', name: '네온 시티 나이트', emoji: '🌃', theme: '네온 사이버 도시', seed: 43, R: 130, wob: 0.42, hill: 2 },
  { id: 'lava', name: '용암 계곡 랠리', emoji: '🌋', theme: '용암 지대', seed: 58, R: 125, wob: 0.45, hill: 5 },
  { id: 'sakura', name: '벚꽃 신사 코스', emoji: '🌸', theme: '벚꽃 신사', seed: 71, R: 115, wob: 0.3, hill: 4 },
  { id: 'synth', name: '신스웨이브 하이웨이', emoji: '🌅', theme: '신스웨이브 해질녘', seed: 89, R: 160, wob: 0.28, hill: 1 },
  { id: 'snow', name: '눈꽃 마을 드리프트', emoji: '❄️', theme: '눈 덮인 마을', seed: 97, R: 120, wob: 0.4, hill: 4 },
  { id: 'deep', name: '깊은 바닷속 터널', emoji: '🐙', theme: '깊은 바닷속', seed: 113, R: 135, wob: 0.36, hill: 3 },
];
export const W = 16, HW = W / 2;          // 도로 폭
export const LAPS = 3;
const STEP = 2;                            // 가운데 줄 점 간격 (m)

export class Track {
  constructor(scene, def) {
    this.def = def; this.theme = { ...theme(def.theme), under: 'void' };
    this.group = new THREE.Group(); scene.add(this.group); this.scene = scene;
    this.build();
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { o.geometry?.dispose?.(); }); }

  // ---------- 모양 ----------
  build() {
    const d = this.def, r = new RNG(d.seed), th = this.theme;
    // 둘레를 따라 고르게 · 반지름만 부드럽게 들쭉날쭉 (꼬이지 않게)
    const N = 14, pts = [];
    const rad = Array.from({ length: N }, () => 1 + r.range(-d.wob, d.wob));
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + r.range(-0.12, 0.12);
      const k = (rad[(i + N - 1) % N] + rad[i] * 2 + rad[(i + 1) % N]) / 4;
      const R = d.R * k * (1 + 0.25 * Math.sin(a * 2 + d.seed));
      pts.push(new THREE.Vector3(Math.cos(a) * R * 1.25, Math.sin(a * 2 + d.seed) * d.hill + Math.sin(a * 3) * d.hill * 0.5, Math.sin(a) * R));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.length = curve.getLength();
    const M = this.M = Math.round(this.length / STEP);
    this.P = []; this.T = []; this.Nrm = [];
    for (let i = 0; i < M; i++) {
      const p = curve.getPointAt(i / M);
      const t = curve.getTangentAt(i / M); t.y = 0; t.normalize();
      this.P.push(p); this.T.push(t); this.Nrm.push(new THREE.Vector3(t.z, 0, -t.x)); // 진행 방향 오른쪽
    }
    this.minY = Math.min(...this.P.map((p) => p.y));
    this.groundY = this.minY - 0.6;
    // 출발선 · 체크포인트
    this.start = 0;
    this.pads = [0.18, 0.43, 0.68, 0.93].map((f) => Math.floor(f * M));
    this.boxRows = [0.1, 0.35, 0.6, 0.85].map((f) => Math.floor(f * M));
    this.makeRoad(); this.makeWalls(); this.makeGround(); this.makeStart(); this.makePads(); this.makeScenery(r);
  }
  // 도로: 가운데 줄을 따라 폭 W 의 띠
  makeRoad() {
    const { P, Nrm, M } = this;
    const pos = new Float32Array((M + 1) * 2 * 3), uv = new Float32Array((M + 1) * 2 * 2), idx = [];
    let v = 0;
    for (let i = 0; i <= M; i++) {
      const k = i % M, p = P[k], n = Nrm[k];
      pos.set([p.x - n.x * HW, p.y + 0.02, p.z - n.z * HW, p.x + n.x * HW, p.y + 0.02, p.z + n.z * HW], i * 6);
      uv.set([0, v, 1, v], i * 4);
      v += STEP / 8;
      if (i < M) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const tex = roadTexture(this.theme); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
    this.group.add(new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: tex, side: THREE.DoubleSide })));
  }
  // 양옆 낮은 벽 (줄무늬) + 도로에서 땅까지 둑
  makeWalls() {
    const { P, Nrm, M } = this, th = this.theme;
    const acc = th.edge || th.P?.b || th.P?.a || '#ff5a7a';
    const stripe = stripeTex(acc);
    for (const side of [-1, 1]) {
      const wall = [], skirt = [];
      for (let i = 0; i <= M; i++) { const k = i % M, p = P[k], n = Nrm[k]; const x = p.x + n.x * (HW + 0.3) * side, z = p.z + n.z * (HW + 0.3) * side; wall.push([x, p.y, z], [x, p.y + 1.1, z]); skirt.push([x, this.groundY, z], [x, p.y, z]); }
      this.group.add(new THREE.Mesh(strip(wall, M, 1.1), new THREE.MeshToonMaterial({ map: stripe, side: THREE.DoubleSide })));
      this.group.add(new THREE.Mesh(strip(skirt, M), new THREE.MeshToonMaterial({ color: th.plat[1], side: THREE.DoubleSide })));
      // 벽 위 빛줄
      const top = [];
      for (let i = 0; i <= M; i++) { const k = i % M, p = P[k], n = Nrm[k]; const x = p.x + n.x * (HW + 0.3) * side, z = p.z + n.z * (HW + 0.3) * side; top.push([x, p.y + 1.1, z], [x + n.x * 0.25 * side, p.y + 1.15, z + n.z * 0.25 * side]); }
      this.group.add(new THREE.Mesh(strip(top, M), glow(th.edge || '#ffffff', 0.9)));
    }
  }
  makeGround() {
    const th = this.theme, R = this.def.R * 3.2;
    const tex = topTexture(th.style, th.plat[0], th.plat[1], th.edge).clone(); tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(R / 6, R / 6);
    const g = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshToonMaterial({ map: tex }));
    g.rotation.x = -Math.PI / 2; g.position.y = this.groundY; this.group.add(g);
  }
  // 출발선: 체크무늬 + 아치
  makeStart() {
    const p = this.P[0], n = this.Nrm[0], t = this.T[0];
    const c = document.createElement('canvas'); c.width = 256; c.height = 32;
    const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    line.rotation.x = -Math.PI / 2; line.rotation.z = Math.atan2(t.x, t.z); // 체크무늬가 도로를 가로지르게
    line.position.set(p.x, p.y + 0.04, p.z); this.group.add(line);
    const arch = new THREE.Group(); arch.position.copy(p); arch.rotation.y = Math.atan2(t.x, t.z);
    const col = this.theme.P?.a || '#ff8fc4';
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 8, 12), new THREE.MeshToonMaterial({ color: col })); post.position.set(s * (HW + 1.2), 4, 0); arch.add(post); }
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 96;
    const bx = bc.getContext('2d'); bx.fillStyle = '#1b1035'; bx.fillRect(0, 0, 512, 96); bx.font = 'bold 60px Jua, sans-serif'; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillStyle = '#ffd84d'; bx.fillText('🏁 JELLY RIDER 🏁', 256, 50);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(W + 3.4, 1.8, 0.4), [0, 1, 2, 3].map(() => new THREE.MeshToonMaterial({ color: col })).concat([new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) }), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })]));
    banner.position.y = 8; arch.add(banner);
    this.group.add(arch);
  }
  // 부스터 발판 (빛나는 화살표)
  makePads() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#7cf0ff'; x.lineWidth = 16; x.lineCap = 'round'; x.shadowColor = '#7cf0ff'; x.shadowBlur = 12;
    for (const y of [20, 64]) { x.beginPath(); x.moveTo(24, y + 40); x.lineTo(64, y); x.lineTo(104, y + 40); x.stroke(); }
    const tex = new THREE.CanvasTexture(c);
    this.padMeshes = [];
    for (const i of this.pads) {
      const p = this.P[i], t = this.T[i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(t.x, t.z) + Math.PI;
      m.position.set(p.x, p.y + 0.06, p.z); this.group.add(m); this.padMeshes.push(m);
    }
  }
  // 풍경: 꿈 테마의 조각들을 트랙 바깥 땅 위에
  makeScenery(r) {
    const th = this.theme, P = this.P;
    const R = { next: () => r.next(), range: (a, b) => r.range(a, b), int: (a, b) => r.int(a, b), pick: (a) => r.pick(a), chance: (p) => r.chance(p) };
    const far = (x, z, m) => { for (let i = 0; i < this.M; i += 6) { const p = P[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < m * m) return false; } return true; };
    this.anims = [];
    const place = (name, x, y, z) => {
      const k = KITS[name]; if (!k) return;
      let o = k.build(R, th.P || {}, W);
      if (!o.userData.anim) o = bakeStatic(o); else this.anims.push(o);
      o.position.set(x, y, z); o.userData.y0 = y; o.rotation.y = r.range(0, 6.28);
      this.group.add(o);
    };
    for (const name of th.kits) {
      const k = KITS[name]; if (!k) continue;
      if (k.place === 'over') continue;
      const n = k.place === 'far' ? 10 : k.place === 'sky' ? 8 : 26;
      for (let j = 0; j < n; j++) {
        if (k.place === 'side' || k.place === 'drift') {
          const i = r.int(0, this.M - 1), p = P[i], nn = this.Nrm[i], side = r.chance(0.5) ? 1 : -1;
          const off = HW + r.range(5, k.place === 'drift' ? 10 : 26);
          const x = p.x + nn.x * off * side, z = p.z + nn.z * off * side;
          if (!far(x, z, HW + 3.5)) continue;
          place(name, x, k.place === 'drift' ? p.y + r.range(2, 6) : this.groundY, z);
        } else {
          const a = r.range(0, 6.28), d = this.def.R * (k.place === 'far' ? r.range(1.9, 2.8) : r.range(0.5, 2.2));
          place(name, Math.cos(a) * d * 1.25, k.place === 'far' ? this.groundY - 2 : r.range(25, 60), Math.sin(a) * d);
        }
      }
    }
  }

  // ---------- 판정 ----------
  // pos 에서 가장 가까운 가운데 줄 점 (hint 근처부터 찾는다)
  nearest(pos, hint = -1) {
    const { P, M } = this;
    let best = 0, bd = Infinity;
    const scan = (a, b) => { for (let j = a; j <= b; j++) { const i = ((j % M) + M) % M, p = P[i]; const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2; if (d < bd) { bd = d; best = i; } } };
    if (hint >= 0) scan(hint - 25, hint + 25); else scan(0, M - 1);
    if (bd > (HW + 6) ** 2 && hint >= 0) scan(0, M - 1); // 많이 벗어났으면 전체에서
    return best;
  }
  // 가운데 줄에서 옆으로 얼마나 (오른쪽 +)
  offset(pos, i) { const p = this.P[i], n = this.Nrm[i]; return (pos.x - p.x) * n.x + (pos.z - p.z) * n.z; }
  // 가운데 줄 위 i 에서 옆으로 off 만큼 떨어진 곳
  at(i, off = 0, out = new THREE.Vector3()) { const k = ((Math.round(i) % this.M) + this.M) % this.M, p = this.P[k], n = this.Nrm[k]; return out.set(p.x + n.x * off, p.y, p.z + n.z * off); }
  heading(i) { const t = this.T[((i % this.M) + this.M) % this.M]; return Math.atan2(t.x, t.z); }
  // 앞쪽이 얼마나 굽었나 (0 = 곧음)
  curve(i, ahead = 20) { const a = this.heading(i), b = this.heading(i + ahead); let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; }
  update(t, dt) {
    for (const m of this.padMeshes) m.material.opacity = 0.7 + Math.sin(t * 8) * 0.3;
    for (const o of this.anims) o.userData.anim?.(o, t, dt);
  }
}

// 위아래로 이은 띠 (pts = [아래, 위] × (M+1))
function strip(pts, M, vScale = 1) {
  const pos = new Float32Array(pts.length * 3), uv = new Float32Array(pts.length * 2), idx = [];
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    pos.set(pts[i], i * 3);
    if (i % 2 === 0 && i > 0) { const a = pts[i], b = pts[i - 2]; u += Math.hypot(a[0] - b[0], a[2] - b[2]) / 4; }
    uv.set([u, i % 2 ? vScale : 0], i * 2);
  }
  for (let i = 0; i < M; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 아스팔트 + 가운데 점선 + 양옆 연석 (테마 색)
function roadTexture(th) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  const base = new THREE.Color(th.plat[1]).lerp(new THREE.Color('#2a2a33'), 0.55);
  x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const acc = th.edge || th.P?.a || '#ff5a7a';
  for (let j = 0; j < 4; j++) { x.fillStyle = j % 2 ? '#ffffff' : acc; x.fillRect(0, j * 64, 14, 64); x.fillRect(242, j * 64, 14, 64); }
  x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(125, 20, 6, 90); x.fillRect(125, 148, 6, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function stripeTex(c) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
  const x = cv.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 32); x.fillStyle = c; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
