// 젤리어택 맵 그리기: 상자마다 종류에 맞는 무늬(나무상자 · 컨테이너 · 벽돌 · 집 · 탱크) + 바닥 + 하늘 + 빛
import * as THREE from 'three';
import { bakeStatic } from '../../shared/js/utils.js';

const texCache = new Map();
function canvasTex(key, draw, n = 128) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
// 종류별 무늬
function kindTex(kind, col) {
  const a = col, b = shade(col, 0.85), d = shade(col, 0.68), R = Math.random;
  return canvasTex(`${kind}|${col}`, (x, n) => {
    x.fillStyle = a; x.fillRect(0, 0, n, n);
    if (kind === 'crate') { x.strokeStyle = d; x.lineWidth = 10; x.strokeRect(5, 5, n - 10, n - 10); x.beginPath(); x.moveTo(8, 8); x.lineTo(n - 8, n - 8); x.moveTo(n - 8, 8); x.lineTo(8, n - 8); x.stroke(); x.fillStyle = b; for (let i = 1; i < 4; i++) x.fillRect(0, (i * n) / 4, n, 2); }
    else if (kind.startsWith('cont')) { for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * n) / 12, 0, n / 12, n); } x.fillStyle = d; x.fillRect(0, 0, n, 6); x.fillRect(0, n - 6, n, 6); }
    else if (kind === 'wall' || kind === 'outer' || kind === 'low') { x.fillStyle = b; for (let r = 0; r < 8; r++) for (let i = 0; i < 4; i++) { const o = r % 2 ? n / 8 : 0; x.fillRect(i * n / 4 + o + 2, r * n / 8 + 2, n / 4 - 4, n / 8 - 4); } }
    else if (kind.startsWith('house') || kind === 'ware') { x.fillStyle = b; for (let i = 0; i < 40; i++) { x.globalAlpha = 0.3; x.fillRect(R() * n, R() * n, 4 + R() * 12, 3); } x.globalAlpha = 1; x.fillStyle = shade(col, 0.45); x.fillRect(n * 0.3, n * 0.25, n * 0.18, n * 0.22); x.fillRect(n * 0.6, n * 0.25, n * 0.18, n * 0.22); }
    else if (kind.startsWith('tank')) { const g = x.createLinearGradient(0, 0, n, 0); g.addColorStop(0, d); g.addColorStop(0.5, shade(col, 1.2)); g.addColorStop(1, d); x.fillStyle = g; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, n * 0.2, n, 4); x.fillRect(0, n * 0.7, n, 4); }
    else if (kind === 'belt') { x.fillStyle = '#222'; x.fillRect(0, 0, n, n); x.fillStyle = '#555'; for (let i = 0; i < 8; i++) x.fillRect(i * n / 8, 0, 4, n); }
    else { x.fillStyle = b; x.fillRect(0, n - 8, n, 8); x.fillRect(n - 8, 0, 8, n); }
  });
}
export function floorTex(a, b) {
  return canvasTex(`floor|${a}|${b}`, (x, n) => {
    x.fillStyle = a; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 80; i++) { x.fillStyle = Math.random() < 0.5 ? b : shade(a, 1.06); x.globalAlpha = 0.5; x.beginPath(); x.arc(Math.random() * n, Math.random() * n, 2 + Math.random() * 9, 0, 7); x.fill(); }
    x.globalAlpha = 0.25; x.strokeStyle = shade(a, 0.7); x.lineWidth = 2; x.strokeRect(0, 0, n, n);
  });
}

export function buildMap(scene, map) {
  const g = new THREE.Group();
  // 바닥
  const ft = floorTex(map.floor, map.floor2).clone(); ft.needsUpdate = true; ft.repeat.set(map.W / 4, map.D / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.W + 40, map.D + 40), new THREE.MeshToonMaterial({ map: ft }));
  floor.rotation.x = -Math.PI / 2; g.add(floor);
  // 상자들: 크기에 맞춰 무늬가 반복되게 (면마다 UV 를 늘린다)
  const parts = new THREE.Group();
  const mats = new Map(), mat = (key, make) => mats.get(key) || mats.set(key, make()).get(key); // 같은 종류는 재질을 같이 써서 합쳐 그린다
  for (const b of map.boxes) {
    const col = map.colors[b.k] || '#aaaaaa';
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = geo.attributes.uv, S = b.k === 'crate' ? 1.3 : 3;
    for (let f = 0; f < 6; f++) { const [su, sv] = f < 2 ? [b.d, b.h] : f < 4 ? [b.w, b.d] : [b.w, b.h]; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * Math.max(1, su / S), uv.getY(k) * Math.max(1, sv / S)); } }
    const m = new THREE.Mesh(geo, mat(b.k, () => new THREE.MeshToonMaterial({ map: kindTex(b.k, col) })));
    m.position.set(b.x, b.y + b.h / 2, b.z);
    parts.add(m);
    // 지붕 테두리 (큰 건물)
    if (b.h >= 5 && b.k !== 'outer') { const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4), mat('roof|' + col, () => new THREE.MeshToonMaterial({ color: map.colors.roof || shade(col, 0.6) }))); roof.position.set(b.x, b.y + b.h + 0.2, b.z); parts.add(roof); }
  }
  g.add(bakeStatic(parts));
  // 하늘 (그라데이션 공)
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(map.sky[0]) }, mid: { value: new THREE.Color(map.sky[1]) }, bot: { value: new THREE.Color(map.sky[2]) } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.5, 0.0, 1.0), 0.7)) : mix(mid, bot, clamp(-h * 3.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
  }));
  g.add(sky);
  scene.add(g);
  scene.fog = new THREE.Fog(map.sky[1], map.fog[0], map.fog[1]);
  const hemi = new THREE.HemisphereLight(map.sky[0], map.floor2, 1.3); g.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(30, 60, 20); g.add(sun);
  return { group: g, sky, dispose() { scene.remove(g); } };
}
