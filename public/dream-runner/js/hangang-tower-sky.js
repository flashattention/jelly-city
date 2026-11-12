// 롯데월드타워 창밖 먼 서울 (8-26-10): 불러온 칸(3 × 3) 밖의 서울 전체를 창밖 그림에만 그린다
//   - 높이 15m 넘는 건물 11만 채 (돌린 상자, 조명 종류별 인스턴스 둘): 낮엔 빽빽한 빌딩 숲, 밤엔 창마다 불빛(같은 창 불빛 셰이더)
//   - 넓은 찻길: 밤엔 주황 가로등 줄 + 흘러가는 차 불빛(흰 전조등 · 붉은 후미등)
//   - 밤 지평선의 주황빛 도시 노을 (탑 둘레 큰 띠)
//   자료: seoul/skyline.bin.gz (tools/tower-skyline.mjs). 바깥 장면엔 늘 숨겨 두고 창밖을 그리는 순간에만 켠다
import * as THREE from 'three';
import { winLights, winSeed } from './hangang-windows.js';

const TILE = 2000;
let DATA = null, LOADING = null;
export function loadSkyline() {
  if (DATA || LOADING) return LOADING || Promise.resolve(DATA);
  LOADING = (async () => { const res = await fetch(new URL('../seoul/skyline.bin.gz', import.meta.url)); if (!res.ok) throw new Error('skyline'); const buf = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); const dv = new DataView(buf), nB = dv.getInt32(0, true), nR = dv.getInt32(4, true); DATA = { nB, nR, b: new Int16Array(buf, 8, nB * 7), r: new Int16Array(buf, 8 + nB * 14, nR * 5) }; return DATA; })().catch((e) => { console.warn('먼 서울 자료 실패', e); LOADING = null; return null; });
  return LOADING;
}
// 칸 밖(불러온 칸과 겹치지 않게) · 탑 둘레 18km 안만
export function buildSkyline(hg, D, center) {
  const g = new THREE.Group(); g.name = 'tower-skyline'; g.visible = false; g.userData.noDrape = true;
  const have = new Set(hg.chunks ? [...hg.chunks.keys()] : []), inLoaded = (x, z) => have.has(`${Math.floor(x / TILE)}_${Math.floor(z / TILE)}`);
  const ch = hg.chunks ? [...hg.chunks.values()].find((c) => c.winTex?.glass) : null;
  const tex = (t, lit) => (lit ? ch?.litTex?.[t] : ch?.winTex?.[t]) || null;
  const groups = [[], []];
  for (let i = 0; i < D.nB; i++) { const o = i * 7, x = D.b[o], z = D.b[o + 1]; if (inLoaded(x, z) || Math.hypot(x - center[0], z - center[1]) > 18000) continue; groups[D.b[o + 6] === 0 ? 0 : 1].push(o); }
  const mats = [];
  groups.forEach((list, gi) => {
    if (!list.length) return;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 6);
    const t = gi === 0 ? 'apt' : 'glass', map = tex(t, false), emap = tex(t, true);
    const m = new THREE.MeshLambertMaterial({ map, emissive: '#ffd59a', emissiveMap: emap, emissiveIntensity: 0 }); if (emap) winLights(m, [8, 8], true); mats.push(m);
    const aw = new Float32Array(list.length * 3), im = new THREE.InstancedMesh(geo, m, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    list.forEach((o, i) => { const x = D.b[o], z = D.b[o + 1], h = D.b[o + 2] / 10, w = Math.max(6, D.b[o + 3] / 10), d = Math.max(6, D.b[o + 4] / 10), a = (D.b[o + 5] / 18000) * Math.PI, y = hg.terrAt(x, z, true); q.setFromAxisAngle(up, -a); M.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d)); im.setMatrixAt(i, M); c.set(gi === 0 ? '#e6dfd2' : i % 3 ? '#b4c4d0' : '#d8d6cf').offsetHSL(0, 0, (((i * 7919) % 100) / 100 - 0.5) * 0.08); im.setColorAt(i, c); aw[i * 3] = winSeed(x, z); aw[i * 3 + 1] = gi === 0 ? 0 : 2; aw[i * 3 + 2] = 1; });
    geo.setAttribute('aWin', new THREE.InstancedBufferAttribute(aw, 3)); im.frustumCulled = false; im.userData.noDrape = true; g.add(im);
  });
  // 찻길: 가로등 줄(주황 선) · 흘러가는 차 불빛(선 위를 움직이는 점선)
  const P = [], DIST = [], SIDE = [];
  for (let i = 0; i < D.nR; i++) { const o = i * 5, x1 = D.r[o], z1 = D.r[o + 1], x2 = D.r[o + 2], z2 = D.r[o + 3]; if (inLoaded((x1 + x2) / 2, (z1 + z2) / 2) || Math.hypot(x1 - center[0], z1 - center[1]) > 18000) continue; const y1 = hg.terrAt(x1, z1, true) + 1, y2 = hg.terrAt(x2, z2, true) + 1, L = Math.hypot(x2 - x1, z2 - z1); P.push(x1, y1, z1, x2, y2, z2); DIST.push(0, L); const s = (i % 2) * 2 - 1; SIDE.push(s, s); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); lg.setAttribute('aD', new THREE.Float32BufferAttribute(DIST, 1)); lg.setAttribute('aS', new THREE.Float32BufferAttribute(SIDE, 1));
  const U = { uNight: { value: 0 }, uT: { value: 0 } };
  const lamp = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'attribute float aD; attribute float aS; varying float vD; varying float vS; void main(){ vD = aD; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uNight; uniform float uT; varying float vD; varying float vS; void main(){ float car = step(0.8, fract(vD / 35.0 - uT * 0.45 * vS)); vec3 lampC = vec3(1.0, 0.62, 0.25) * 0.55; vec3 carC = vS > 0.0 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.18, 0.12); gl_FragColor = vec4((lampC + carC * car * 0.9) * uNight, 1.0); }' });
  const lines = new THREE.LineSegments(lg, lamp); lines.frustumCulled = false; g.add(lines);
  // 밤 지평선 도시 노을: 탑 둘레 반지름 14km 띠 (아래가 진한 주황, 위로 옅게)
  const ring = new THREE.CylinderGeometry(14000, 14000, 1400, 64, 1, true); ring.translate(0, 500, 0);
  const glow = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uNight; varying float vY; void main(){ float a = pow(1.0 - vY, 3.0); gl_FragColor = vec4(vec3(1.0, 0.5, 0.22) * a * 0.22 * uNight, 1.0); }' });
  const band = new THREE.Mesh(ring, glow); band.position.set(center[0], 0, center[1]); band.frustumCulled = false; g.add(band);
  hg.scene.add(g);
  return { g, mats, U, count: groups[0].length + groups[1].length, roads: P.length / 6,
    // 창밖을 그리기 직전: 밤 정도에 맞춰 불빛
    prepare(night, t) { const lit = Math.min(1, Math.max(0, (night - 0.15) / 0.65)); for (const m of mats) { m.emissiveIntensity = lit * 0.75; m.color.setScalar(1 - lit * 0.7); } U.uNight.value = lit; U.uT.value = t; },
    dispose() { hg.scene.remove(g); g.traverse((o) => { o.geometry?.dispose(); }); mats.forEach((m) => m.dispose()); lamp.dispose(); glow.dispose(); } };
}
