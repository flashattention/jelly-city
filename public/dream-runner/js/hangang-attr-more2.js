// 서울 명소 체험 2차 남은 다섯 곳 (8-18 2차 2-6 ~ 2-10 · 8-37 37-4): 국립중앙박물관 · DDP 밤 조명 · 코엑스 큰 서가 도서관 · 서울식물원 온실 · 잠실야구장
//   상표 · 실제 상호 없이 일반 이름. 실내(박물관 · 도서관)는 서울 밖 먼 곳에 짓고 카메라만 옮긴다. 바깥(DDP · 온실 · 야구장)은 제자리에
//   참고(보기 전용, 위키미디어 공용): 박물관 역사의 길 · 경천사지 십층석탑, DDP 밤, 큰 서가 도서관, 식물원 온실 안, 잠실야구장 밤 경기
import * as THREE from 'three';
import { registerAttraction, part, merge, vcMat, LL, colored, ATTR_SKIP } from './hangang-attractions.js';
import { cvTex, boxUV, partUV, mergeUV, plainBox, stoneTex, curvedRoof, crookedPine, hideTrees, jelly, rndS, clamp } from './hangang-attr-more.js';

const lit = (A, fn) => A.addLit(fn);
// 스스로 빛남을 제 색에 곱한다 (조명 받은 듯 밝아지되 흰색으로 날아가지 않게): 꼭짓점 색 · 그림 · 인스턴스 색 모두
const glowByColor = (m) => { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb;'); }; m.customProgramCacheKey = () => 'glowByColor'; return m; };
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// 실내 재질: 그림이 스스로 조금 빛나 낮 · 밤 모두 실내 조명처럼 보인다 (밤엔 조금 더)
function inMat(map, o = {}) { const m = new THREE.MeshLambertMaterial({ map, vertexColors: true, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: o.e ?? 0.35, side: o.side || THREE.FrontSide, ...(o.extra || {}) }); m.userData.e0 = o.e ?? 0.35; return m; }
// 실내를 비추는 빛 세기: 낮엔 해가 같이 비추니 덜, 밤엔 더
const inLit = (A, mats, k = 0.3) => lit(A, (L) => { for (const m of mats) m.emissiveIntensity = m.userData.e0 + L * k; });
// 걷는 사람(젤리) 여럿을 한 모양으로 (색만 다르게)
function crowd(list, seed = 1, s = 0.9) { const r = rndS(seed), cols = ['#ff9ec0', '#9ad0ff', '#ffd76a', '#a8e0a0', '#e8c8ff', '#f4b183', '#c8d8e8'], out = []; for (const [x, y, z, ry] of list) jelly(cols[Math.floor(r() * cols.length)], s * (0.85 + r() * 0.3)).forEach((q) => { q.rotateY(ry ?? r() * 6.28); q.translate(x, y, z); out.push(q); }); return out.length ? merge(out) : null; }

// ============================================================
// 2-6 국립중앙박물관 '역사의 길' (사진: 베이지 석회암 벽의 긴 홀 · 위는 긴 천창 · 양옆 층마다 발코니 · 붉은 깔개 위 경천사지 십층석탑 13.5m)
//   용산 박물관 앞(지도 건물 남쪽)에 카드 → 먼 곳의 실내 홀로. 입구에서 탑까지 걸어가 탑을 한 바퀴 올려다본다
// ============================================================
const MUSEUM_GO = [7, 716], MU = new THREE.Vector3(152000, 0, -26000);
// 밝은 석회암 판 (큰 판 줄눈 · 옅은 결)
const limeTex = () => cvTex(512, 256, (c, W, H) => { const r = rndS(21); c.fillStyle = '#d9cdb6'; c.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 64) for (let x = (y / 64) % 2 ? -64 : 0; x < W; x += 128) { const l = 212 + r() * 14; c.fillStyle = `rgb(${l},${l - 10},${l - 26})`; c.fillRect(x + 1, y + 1, 126, 62); for (let k = 0; k < 6; k++) { c.strokeStyle = `rgba(150,130,100,${0.05 + r() * 0.06})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x + r() * 128, y); c.bezierCurveTo(x + r() * 128, y + 20, x + r() * 128, y + 40, x + r() * 128, y + 64); c.stroke(); } } c.fillStyle = 'rgba(120,100,80,.35)'; for (let y = 0; y < H; y += 64) c.fillRect(0, y, W, 1.5); });
// 대리석 바닥 (밝은 크림 판, 가운데로 천창 빛이 비친다)
const marbleTex = () => cvTex(256, 256, (c, W, H) => { const r = rndS(5); for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) { const l = 226 + r() * 14; c.fillStyle = `rgb(${l},${l - 8},${l - 20})`; c.fillRect(x, y, 64, 64); c.strokeStyle = 'rgba(160,140,110,.12)'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y + r() * 64); c.quadraticCurveTo(x + 32, y + r() * 64, x + 64, y + r() * 64); c.stroke(); } } c.fillStyle = 'rgba(140,120,90,.4)'; for (let i = 0; i <= W; i += 64) { c.fillRect(i, 0, 1, H); c.fillRect(0, i, W, 1); } });
// 탑 돌 (회백색 대리석, 새김 무늬: 기둥 · 감실 · 앉은 부처 실루엣)
const reliefTex = () => cvTex(256, 128, (c, W, H) => { const r = rndS(1348); c.fillStyle = '#c9c8c2'; c.fillRect(0, 0, W, H); for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,60,58'},${0.04 + r() * 0.06})`; c.fillRect(r() * W, r() * H, 2, 2); } for (let x = 0; x < W; x += 64) { c.fillStyle = 'rgba(70,68,64,.45)'; c.fillRect(x, 0, 6, H); c.fillStyle = 'rgba(90,88,82,.35)'; c.beginPath(); c.moveTo(x + 14, H - 12); c.lineTo(x + 14, 40); c.quadraticCurveTo(x + 35, 10, x + 56, 40); c.lineTo(x + 56, H - 12); c.closePath(); c.fill(); c.fillStyle = 'rgba(230,228,220,.55)'; c.beginPath(); c.arc(x + 35, 56, 8, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + 35, 86, 14, 18, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(200,198,190,.5)'; c.fillRect(x + 18, H - 22, 34, 8); } c.fillStyle = 'rgba(50,50,48,.4)'; c.fillRect(0, 0, W, 4); c.fillRect(0, H - 4, W, 4); });
// 돌 지붕 (밝은 돌 기와 줄)
const stoneTileTex = () => cvTex(128, 128, (c, W, H) => { c.fillStyle = '#b9b7b0'; c.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 16) { c.fillStyle = 'rgba(80,78,72,.45)'; c.fillRect(x, 0, 3, H); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 6, 0, 4, H); } for (let y = 0; y < H; y += 18) { c.fillStyle = 'rgba(60,58,54,.25)'; c.fillRect(0, y, W, 2); } });
// 아(亞)자 평면 한 단: 가운데 네모 + 네 날개 (날개 폭 = w × a)
function crossBox(list, w, h, y, a = 0.62, tint = '#ffffff', mx = 2, my = 1) { list.push(partUV(boxUV(w, h, w * a, mx, my), 0, y + h / 2, 0, 0, tint), partUV(boxUV(w * a, h, w, mx, my), 0, y + h / 2, 0, 0, tint)); }
function buildPagoda() {
  const S = [], R = [], g = new THREE.Group(); let y = 0;
  // 받침 세 단 (아자 모양, 단마다 몸 · 위 갑석)
  for (const [w, h] of [[6.6, 0.75], [5.8, 0.75], [5.0, 0.7]]) { crossBox(S, w, h, y, 0.6, '#eeeeea'); y += h; crossBox(S, w + 0.35, 0.16, y, 0.6, '#ffffff'); y += 0.16; }
  // 1 ~ 3층: 아자 몸 (모서리 기둥 · 새김 판) + 가운데 지붕과 네 날개 지붕
  const lower = [[3.9, 1.25], [3.5, 1.15], [3.15, 1.05]];
  for (const [w, h] of lower) {
    crossBox(S, w, h, y, 0.56); for (const [sx, sz] of [[1, 0.28], [-1, 0.28], [1, -0.28], [-1, -0.28], [0.28, 1], [0.28, -1], [-0.28, 1], [-0.28, -1]]) S.push(partUV(plainBox(0.16, h, 0.16), sx * w / 2, y + h / 2, sz * w / 2, 0, '#d6d4ce'));
    y += h; const c = curvedRoof(w * 0.62 + 1.1, w * 0.62 + 1.1, 0.75, { ridge: 0.2, lift: 0.28, deco: false }); c.translate(0, y + 0.05, 0); R.push(c);
    for (let k = 0; k < 4; k++) { const wr = curvedRoof(w * 0.32 + 0.9, w * 0.56 + 0.7, 0.55, { ridge: w * 0.1, lift: 0.22, deco: false }); wr.rotateY(k * Math.PI / 2 + Math.PI / 2); const a = (k * Math.PI) / 2; wr.translate(Math.sin(a) * w * 0.36, y - 0.02, Math.cos(a) * w * 0.36); R.push(wr); }
    y += 0.42;
  }
  // 4 ~ 10층: 네모 몸이 위로 갈수록 작아진다 · 층마다 휜 지붕
  for (let k = 0; k < 7; k++) { const w = 2.55 - k * 0.13, h = 0.86 - k * 0.03; S.push(partUV(boxUV(w, h, w, 2, 1), 0, y + h / 2, 0)); for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) S.push(partUV(plainBox(0.14, h, 0.14), sx * w / 2, y + h / 2, sz * w / 2, 0, '#d6d4ce')); y += h; const c = curvedRoof(w + 1.0, w + 1.0, 0.62, { ridge: 0.15, lift: 0.26, deco: false }); c.translate(0, y, 0); R.push(c); y += 0.36; }
  // 상륜 (꼭대기 장식)
  for (const [r0, h] of [[0.42, 0.2], [0.32, 0.3], [0.22, 0.25], [0.16, 0.35], [0.1, 0.4]]) { S.push(partUV(new THREE.CylinderGeometry(r0 * 0.8, r0, h, 12), 0, y + h / 2, 0, 0, '#d8d6d0')); y += h; }
  const stone = new THREE.MeshLambertMaterial({ map: reliefTex(), vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.18 }); stone.emissiveMap = stone.map; stone.userData.e0 = 0.18;
  const roof = new THREE.MeshLambertMaterial({ map: stoneTileTex(), vertexColors: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.16 }); roof.emissiveMap = roof.map; roof.userData.e0 = 0.16;
  g.add(new THREE.Mesh(mergeUV(S), stone), new THREE.Mesh(mergeUV(R), roof)); g.userData.mats = [stone, roof]; g.userData.h = y; return g;
}
function buildMuseumHall(A) {
  const g = new THREE.Group(); g.position.copy(MU); const L = 84, W = 20, H = 24, WL = [], FL = [], V = [], GL = [];
  // 바닥 · 양옆 벽 (층마다 발코니 · 전시실로 들어가는 높은 틈) · 끝 유리벽
  FL.push(partUV(boxUV(W, 0.2, L, 6, 6), 0, -0.1, 0));
  for (const sx of [-1, 1]) {
    WL.push(partUV(boxUV(1, H, L, 6, 3), sx * (W / 2 + 0.5), H / 2, 0));
    for (const fy of [8, 16]) { WL.push(partUV(boxUV(2.6, 1.2, L - 6, 6, 3), sx * (W / 2 - 1.3), fy - 0.6, 0)); GL.push(partUV(plainBox(0.05, 1.05, L - 6), sx * (W / 2 - 2.6), fy + 0.52, 0)); V.push(part(new THREE.BoxGeometry(0.12, 0.08, L - 6), '#b07a3a', sx * (W / 2 - 2.6), fy + 1.08, 0)); for (let z = -L / 2 + 6; z < L / 2 - 4; z += 7) V.push(part(new THREE.SphereGeometry(0.45, 8, 6), '#4a7a3a', sx * (W / 2 - 1.6), fy + 0.35, z, 0, 0, 0, 1, 0.8, 1)); }
    for (let z = -L / 2 + 8; z < L / 2 - 6; z += sx > 0 ? 4.5 : 9) V.push(part(new THREE.BoxGeometry(0.2, sx > 0 ? 6 : 5, sx > 0 ? 1.2 : 4.5), '#4a4038', sx * (W / 2 - 0.02), sx > 0 ? 11 : 2.6, z));
  }
  WL.push(partUV(boxUV(W, 6, 1, 6, 3), 0, H - 3, -L / 2 - 0.5), partUV(boxUV(W, H, 1, 6, 3), 0, H / 2, L / 2 + 0.5));
  // 끝 유리벽 (북쪽): 창살 · 바깥 나무가 비친다
  const glassT = cvTex(256, 256, (c, w2, h2) => { const gr = c.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, '#dfeef2'); gr.addColorStop(0.6, '#b9d6c8'); gr.addColorStop(1, '#7fa878'); c.fillStyle = gr; c.fillRect(0, 0, w2, h2); c.fillStyle = 'rgba(60,110,60,.5)'; for (let i = 0; i < 20; i++) { c.beginPath(); c.arc((i * 53) % w2, 170 + (i * 29) % 70, 18 + (i % 4) * 6, 0, 7); c.fill(); } c.fillStyle = '#5a5e62'; for (let x = 0; x < w2; x += 32) c.fillRect(x, 0, 3, h2); for (let y = 0; y < h2; y += 64) c.fillRect(0, y, w2, 3); }, false);
  const glassM = new THREE.MeshBasicMaterial({ map: glassT }); const gw = new THREE.Mesh(new THREE.PlaneGeometry(W, H - 6), glassM); gw.position.set(0, (H - 6) / 2, -L / 2); g.add(gw);
  // 천장: 가운데 긴 천창(빛나는 유리 · 철골) + 양옆 흰 천장 (내림 조명 점)
  const skyT = cvTex(128, 128, (c, w2, h2) => { c.fillStyle = '#e8f2f8'; c.fillRect(0, 0, w2, h2); const gr = c.createLinearGradient(0, 0, w2, 0); gr.addColorStop(0, 'rgba(160,190,210,.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(160,190,210,.5)'); c.fillStyle = gr; c.fillRect(0, 0, w2, h2); c.fillStyle = '#9aa4ac'; c.fillRect(0, 0, w2, 5); c.fillRect(0, 0, 4, h2); c.fillRect(w2 / 2 - 1, 0, 3, h2); });
  skyT.repeat.set(1, 14); const skyM = new THREE.MeshBasicMaterial({ map: skyT, color: '#ffffff' }); const sky = new THREE.Mesh(new THREE.PlaneGeometry(9, L), skyM); sky.rotation.x = Math.PI / 2; sky.position.y = H + 0.6; g.add(sky);
  const ceilT = cvTex(128, 128, (c, w2, h2) => { c.fillStyle = '#ecebe6'; c.fillRect(0, 0, w2, h2); for (let y = 16; y < h2; y += 32) for (let x = 16; x < w2; x += 32) { const gr = c.createRadialGradient(x, y, 0, x, y, 7); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = gr; c.fillRect(x - 8, y - 8, 16, 16); } });
  for (const sx of [-1, 1]) WL.push(partUV(boxUV(5.5, 0.6, L, 6, 6), sx * 7.25, H, 0, 0, '#f4f2ee'));
  const ceilM = new THREE.MeshBasicMaterial({ map: ceilT }); ceilT.repeat.set(2, 30); for (const sx of [-1, 1]) { const cp = new THREE.Mesh(new THREE.PlaneGeometry(5.5, L), ceilM); cp.rotation.x = Math.PI / 2; cp.position.set(sx * 7.25, H - 0.31, 0); g.add(cp); }
  // 붉은 깔개 · 탑 받침(검은 화강석) · 안내판
  V.push(part(new THREE.BoxGeometry(15, 0.03, 12), '#7a1a22', 0, 0.015, -28), part(new THREE.BoxGeometry(9.6, 0.55, 9.6), '#3a3a3e', 0, 0.28, -28), part(new THREE.BoxGeometry(9.8, 0.06, 9.8), '#56565c', 0, 0.58, -28), part(new THREE.BoxGeometry(1.4, 0.8, 0.1), '#2a2a2e', 3.2, 1.0, -22.6, -0.4, 0, 0));
  // 걷는 사람들
  const ppl = []; const r = rndS(44); for (let i = 0; i < 26; i++) ppl.push([(r() - 0.5) * 14, 0, -18 + r() * 52]); for (let i = 0; i < 7; i++) { const a = r() * 6.28; ppl.push([Math.cos(a) * 6.2, 0, -28 + Math.sin(a) * 6.2, -a - Math.PI / 2]); } const cg = crowd(ppl, 3, 1.15); if (cg) V.push(cg);
  const wallM = inMat(limeTex(), { e: 0.2 }), floorM = inMat(marbleTex(), { e: 0.24 }), glassRail = new THREE.MeshLambertMaterial({ color: '#cfe4e8', transparent: true, opacity: 0.35, depthWrite: false });
  g.add(new THREE.Mesh(mergeUV(WL), wallM), new THREE.Mesh(mergeUV(FL), floorM), new THREE.Mesh(merge(V), vcMat({ emissive: '#ffffff', emissiveIntensity: 0.12 })), new THREE.Mesh(mergeUV(GL), glassRail));
  const pg = buildPagoda(); pg.scale.setScalar(0.82); pg.position.set(0, 0.61, -28); g.add(pg);
  inLit(A, [wallM, floorM, ...pg.userData.mats], 0.25); lit(A, (Lt) => { skyM.color.setRGB(1 - Lt * 0.78, 1 - Lt * 0.74, 1 - Lt * 0.6); glassM.color.setRGB(1 - Lt * 0.8, 1 - Lt * 0.78, 1 - Lt * 0.7); });
  g.userData = { L, ph: pg.userData.h };
  return g;
}
registerAttraction({
  id: 'museum', name: '국립중앙박물관 역사의 길', seal: '박물관', icon: '🏛️', x: MUSEUM_GO[0], z: MUSEUM_GO[1], r: 24, buildR: 900, verb: '안으로 걷기',
  go: [MUSEUM_GO[0], MUSEUM_GO[1] + 8, Math.PI], intro: '천창 빛이 내리는 긴 홀 끝에 선 고려 경천사지 십층석탑(13.5m)까지 걸어가 올려다봐요',
  start(A) {
    const hg = A.hg; A.museum ||= buildMuseumHall(A); const g = A.museum; if (!g.parent) A.root.add(g); g.visible = true; const D = g.userData, bearVis = hg.bear?.root.visible;
    hg.onToast?.('🏛️ 역사의 길 · 탑까지 천천히 걸어가요');
    const E = { title: '국립중앙박물관 역사의 길', lock: true,
      status() { return this.t < 14 ? `천창 아래 긴 홀을 걸어요 · ${Math.ceil(22 - this.t)}초` : this.t < 22 ? `경천사지 십층석탑 · 고려 1348년 · 대리석 13.5m · ${Math.ceil(22 - this.t)}초` : '다 봤어요'; },
      tick() { if (hg.bear) hg.bear.root.visible = false; if (this.t > 23) A.finish(E); },
      cam(camera, dt) {
        const t = this.t; let pos, look;
        if (t < 14) { const k = smooth(t / 14); pos = new THREE.Vector3(MU.x + Math.sin(t * 0.3) * 1.5, 1.7, MU.z + D.L / 2 - 3 - k * 15); look = new THREE.Vector3(MU.x, 4 + k * 3.5, MU.z - 28); }
        else { const a = (t - 14) * 0.18 - 0.2; pos = new THREE.Vector3(MU.x + Math.sin(a) * 14.5, 2.2, MU.z - 28 + Math.cos(a) * 14.5); look = new THREE.Vector3(MU.x, 6.2, MU.z - 28); }
        (this.cp ||= pos.clone()).lerp(pos, 1 - Math.exp(-dt * 3)); camera.position.copy(this.cp); (this.lk ||= look.clone()).lerp(look, 1 - Math.exp(-dt * 3)); camera.lookAt(this.lk);
      },
      end() { g.visible = false; if (hg.bear) hg.bear.root.visible = bearVis ?? true; }, where() { return '국립중앙박물관 역사의 길'; } };
    return E;
  },
});

// ============================================================
// 2-7 DDP 밤 조명 (사진: 은빛 알루미늄 판이 덮인 매끈한 곡면 덩어리 · 밤엔 아래 둘레가 환하고 지붕 곡선을 따라 빛이 흐른다)
//   지도 '동대문디자인플라자' 외곽선(OSM)을 부드럽게 다듬어, 벽에서 지붕으로 둥글게 넘어가는 곡면 껍질로 다시 짓는다 (지도 상자 대신)
//   동쪽 잔디엔 하얀 빛 꽃밭. 체험하면 밤이 되고 둘레를 천천히 돌며 본다
// ============================================================
const DDP_RING = [[2620, -4206], [2597, -4121], [2600, -4110], [2611, -4099], [2580, -4089], [2572, -4084], [2558, -4071], [2542, -4049], [2530, -4029], [2527, -4015], [2529, -4000], [2545, -3981], [2562, -3969], [2575, -3963], [2589, -3962], [2609, -3965], [2623, -3971], [2693, -4002], [2708, -4011], [2711, -4015], [2711, -4025], [2705, -4031], [2701, -4033], [2595, -4024], [2593, -4025], [2594, -4028], [2646, -4056], [2653, -4062], [2663, -4078], [2668, -4096], [2668, -4188], [2657, -4226], [2652, -4233], [2646, -4236], [2641, -4235], [2633, -4230], [2626, -4217]];
ATTR_SKIP.add('동대문디자인플라자');
const inRing = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if (r[i][1] > z !== r[j][1] > z && x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
function chaikin(pts, n = 2) { let p = pts; for (let k = 0; k < n; k++) { const q = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } p = q; } return p; }
// 은빛 알루미늄 판 (크기 · 밝기가 조금씩 다른 판, 가는 이음매) · 밤에 빛나는 이음매와 작은 구멍 점
const panelTex = () => cvTex(256, 256, (c, W, H) => { const r = rndS(45133); for (let y = 0; y < H; y += 32) { let x = -r() * 40; while (x < W) { const w = 50 + r() * 60, l = 208 + r() * 14; c.fillStyle = `rgb(${l - 4},${l},${l + 6})`; c.fillRect(x, y, w, 32); const g = c.createLinearGradient(x, y, x + w, y + 32); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.08)'); c.fillStyle = g; c.fillRect(x, y, w, 32); c.fillStyle = 'rgba(90,96,104,.18)'; c.fillRect(x, y, 1, 32); x += w; } c.fillStyle = 'rgba(90,96,104,.2)'; c.fillRect(0, y, W, 1); } });
const panelEm = () => cvTex(256, 256, (c, W, H) => { const r = rndS(7); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(150,190,255,.55)'; for (let y = 0; y < H; y += 32) c.fillRect(0, y, W, 1.5); for (let i = 0; i < 420; i++) { c.fillStyle = `rgba(220,235,255,${0.25 + r() * 0.5})`; c.fillRect(r() * W, r() * H, 1.6, 1.6); } });
function buildDDP(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g); const ring = chaikin(DDP_RING, 2), N = ring.length, base = Math.min(...DDP_RING.map(([x, z]) => A.H(x, z))) - 0.3;
  let per = 0; const acc = [0]; for (let i = 1; i <= N; i++) { per += Math.hypot(ring[i % N][0] - ring[i - 1][0], ring[i % N][1] - ring[i - 1][1]); acc.push(per); }
  const area = ring.reduce((s, [x, z], i) => s + x * ring[(i + 1) % N][1] - ring[(i + 1) % N][0] * z, 0), sgn = area > 0 ? 1 : -1;
  const nrm = ring.map((p, i) => { const a = ring[(i - 1 + N) % N], b = ring[(i + 1) % N]; let nx = (b[1] - a[1]) * sgn, nz = -(b[0] - a[0]) * sgn; const l = Math.hypot(nx, nz) || 1; return [nx / l, nz / l]; });
  // 높이: 둘레를 따라 15 ~ 29m 로 출렁인다 (실제 DDP 처럼 한쪽은 높고 한쪽은 낮게)
  const Hs = acc.slice(0, N).map((s) => 15 + 14 * (0.5 + 0.5 * Math.sin((s / per) * Math.PI * 2 * 2 + 0.9)) * (0.75 + 0.25 * Math.sin((s / per) * Math.PI * 2 * 5)));
  // 둥근 어깨 반지름: 좁은 곳(동쪽 목)은 작게 (안쪽으로 줄이다 반대편과 겹치지 않게)
  const K = 6, rings = [], Rv = ring.map(([x, z], i) => { let w = 0; for (; w < 24; w += 0.5) if (!inRing(x - nrm[i][0] * (w + 0.5), z - nrm[i][1] * (w + 0.5), ring)) break; return clamp(w * 0.38, 1.2, 7); });
  rings.push(ring.map(([x, z]) => [x, base, z]));
  for (let k = 0; k <= K; k++) { const th = (k / K) * (Math.PI / 2), ins = 7 * (1 - Math.cos(th)); rings.push(ring.map(([x, z], i) => [x - nrm[i][0] * ins * Rv[i] / 7, base + Hs[i] - Rv[i] + Rv[i] * Math.sin(th), z - nrm[i][1] * ins * Rv[i] / 7])); }
  const P = [], UV = [], I = []; let vacc = new Array(N + 1).fill(0);
  rings.forEach((rg, k) => { for (let i = 0; i <= N; i++) { const p = rg[i % N]; if (k) { const q = rings[k - 1][i % N]; vacc[i] += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); } P.push(...p); UV.push(acc[i] / 12, vacc[i] / 8); } });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < N; i++) { const a = k * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  // 지붕 덮개: 맨 안쪽 고리를 그대로 삼각형으로
  const top = rings[rings.length - 1], tri = THREE.ShapeUtils.triangulateShape(top.map(([x, , z]) => new THREE.Vector2(x, z)), []), o0 = P.length / 3; for (const p of top) { P.push(...p); UV.push(p[0] / 12, p[2] / 12); } for (const [a, b, c] of tri) I.push(o0 + a, o0 + b, o0 + c);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
  // 바깥을 보게 (첫 벽 면의 법선이 바깥쪽인지)
  { const nx = geo.attributes.normal.getX(N + 1), nz = geo.attributes.normal.getZ(N + 1); if (nx * nrm[0][0] + nz * nrm[0][1] < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const q = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = q; } geo.computeVertexNormals(); } }
  const shellM = new THREE.MeshPhongMaterial({ map: panelTex(), specular: '#c8d2dc', shininess: 28, emissive: '#ffffff', emissiveMap: panelEm(), emissiveIntensity: 0, side: THREE.DoubleSide }); g.add(new THREE.Mesh(geo, shellM));
  // 빛 띠: 아래 둘레(환한 띠) · 지붕 곡선을 따라 흐르는 빛 (더하기 섞기, 셰이더 안에서 흐름)
  const U = { uT: { value: 0 }, uN: { value: 0 } }, ribbons = [], RP = [], RU = [], RI = [];
  const ribbon = (k, h, out, kind) => { const rg = rings[k], o = RP.length / 3; for (let i = 0; i <= N; i++) { const p = rg[i % N], [nx, nz] = nrm[i % N]; RP.push(p[0] + nx * out, p[1], p[2] + nz * out, p[0] + nx * out, p[1] + h, p[2] + nz * out); RU.push(acc[i], kind, acc[i], kind + 0.5); } for (let i = 0; i < N; i++) { const a = o + i * 2; RI.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } };
  ribbon(0, 0.7, 0.12, 0); ribbon(1, 0.5, 0.15, 2); ribbon(3, 0.4, 0.1, 4); ribbon(5, 0.35, 0.08, 6);
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3)); rgeo.setAttribute('uv', new THREE.Float32BufferAttribute(RU, 2)); rgeo.setIndex(RI);
  const rmat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT, uN; varying vec2 vUv;
      void main(){ float kind = floor(vUv.y); float v = fract(vUv.y) * 2.0; float edge = smoothstep(0.0, 0.35, v) * smoothstep(1.0, 0.65, v);
        vec3 col; float a;
        if (kind < 1.0) { col = vec3(1.0, 0.93, 0.8); a = 0.85; }
        else { float s = vUv.x / 60.0 - uT * (0.12 + kind * 0.01) + kind * 0.37; float pulse = pow(0.5 + 0.5 * sin(s * 6.2832), 10.0); col = mix(vec3(0.55, 0.75, 1.0), vec3(1.0, 1.0, 1.0), pulse); a = 0.12 + pulse * 0.9; }
        gl_FragColor = vec4(col * a * edge * uN, 1.0); }` });
  const rib = new THREE.Mesh(rgeo, rmat); rib.renderOrder = 3; g.add(rib);
  // 빛 꽃밭: 동쪽 잔디 (하얀 꽃 머리, 셰이더로 하나씩 반짝)
  const fl = [], r = rndS(2014); for (let x = 2676; x < 2702; x += 1.3) for (let z = -4182; z < -4062; z += 1.3) { const px = x + (r() - 0.5) * 0.8, pz = z + (r() - 0.5) * 0.8; if (inRing(px, pz, DDP_RING)) continue; fl.push([px, A.H(px, pz) + 0.55 + r() * 0.25, pz]); }
  const fg = new THREE.SphereGeometry(0.16, 8, 5); fg.scale(1, 0.7, 1); const FU = { uT: U.uT, uN: U.uN };
  const fmat = new THREE.ShaderMaterial({ uniforms: FU, vertexShader: 'uniform float uT; varying float vB; varying vec3 vN; void main(){ vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0); vB = 0.6 + 0.4 * sin(uT * 1.6 + ip.x * 0.9 + ip.z * 0.7); vN = normal; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float uN; varying float vB; varying vec3 vN; void main(){ float day = 0.55 + 0.35 * max(0.0, vN.y); vec3 c = mix(vec3(day), vec3(1.0, 0.98, 0.92) * (0.7 + vB * 0.9), uN); gl_FragColor = vec4(c, 1.0); }' });
  const flowers = new THREE.InstancedMesh(fg, fmat, fl.length), m4 = new THREE.Matrix4(); fl.forEach(([x, y, z], i) => flowers.setMatrixAt(i, m4.makeTranslation(x, y, z))); flowers.frustumCulled = false; g.add(flowers);
  const stems = []; for (let i = 0; i < fl.length; i += 1) { const [x, y, z] = fl[i]; stems.push(part(new THREE.CylinderGeometry(0.015, 0.015, y - A.H(x, z), 3), '#3a4a2a', x, (y + A.H(x, z)) / 2, z)); } g.add(new THREE.Mesh(merge(stems), vcMat()));
  lit(A, (L) => { U.uN.value = L; shellM.emissiveIntensity = L * 0.55; });
  const undo = hideTrees(hg, (x, z) => inRing(x, z, DDP_RING));
  A.ddp = { ring, nrm, Hs, base, per, acc };
  return { group: g, tick(dt) { U.uT.value += dt; }, dispose() { undo(); g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'ddp', name: 'DDP 밤 조명', seal: 'DDP', icon: '✨', x: 2690, z: -4052, r: 24, buildR: 1500, verb: '밤 산책',
  go: [2694, -4048, -Math.PI / 2], intro: '은빛 곡면 지붕을 따라 흐르는 빛 · 환한 둘레 · 하얀 빛 꽃밭을 밤에 한 바퀴 돌아봐요',
  build: buildDDP,
  start(A) {
    const hg = A.hg, D = A.ddp; if (!D) return null; const h0 = hg.state.hour; if (h0 > 5 && h0 < 19.8) hg.state.hour = 20.4; const bearVis = hg.bear?.root.visible;
    // 둘레 바깥 22m 를 따라 도는 길 (꽃밭이 있는 동쪽에서 시작)
    const N = D.ring.length; let i0 = 0, bd = Infinity; D.ring.forEach(([x, z], i) => { const d = Math.hypot(x - 2690, z - 4052 * -1); if (d < bd) { bd = d; i0 = i; } });
    const at = (s) => { const f = ((s % N) + N) % N, i = Math.floor(f), t = f - i, a = D.ring[i], b = D.ring[(i + 1) % N], na = D.nrm[i], nb = D.nrm[(i + 1) % N]; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, nx: na[0] + (nb[0] - na[0]) * t, nz: na[1] + (nb[1] - na[1]) * t, h: D.Hs[i] }; };
    const E = { title: 'DDP 밤 조명', lock: true,
      status() { return this.t < 26 ? `은빛 지붕선을 따라 빛이 흘러요 · ${Math.ceil(26 - this.t)}초` : '다 돌아봤어요'; },
      tick() { if (hg.bear) hg.bear.root.visible = false; if (this.t > 27) A.finish(E); },
      // 카메라: 꽃밭이 있는 동쪽 → 남동쪽 → 남쪽 광장 위에서 DDP 를 비스듬히 내려다본다 (사이를 부드럽게)
      cam(camera, dt) { const KF = [[2750, 24, -4150, 2640, -4090], [2725, 34, -3950, 2630, -4060], [2775, 42, -4060, 2610, -4080]], u = clamp(this.t / 24, 0, 1) * (KF.length - 1), i = Math.min(KF.length - 2, Math.floor(u)), f = smooth(u - i), a = KF[i], b = KF[i + 1], L = (k) => a[k] + (b[k] - a[k]) * f;
        const pos = new THREE.Vector3(L(0), D.base + L(1), L(2)), look = new THREE.Vector3(L(3), D.base + 8, L(4)); (this.cp ||= pos.clone()).lerp(pos, 1 - Math.exp(-dt * 2)); camera.position.copy(this.cp); (this.lk ||= look.clone()).lerp(look, 1 - Math.exp(-dt * 2)); camera.lookAt(this.lk); },
      end() { if (hg.bear) hg.bear.root.visible = bearVis ?? true; }, where() { return 'DDP 둘레'; } };
    return E;
  },
});

// ============================================================
// 2-8 코엑스 큰 서가 도서관 (사진: 둥근 모서리 13m 책장 탑 · 선반마다 따뜻한 띠 조명 · 위는 사선 철골 유리 천장 · 가운데 독서 탁자)
//   코엑스 몰 남쪽 입구에 카드 → 먼 곳의 실내로. 책장으로 걸어가 책을 한 권 꺼내 탁자에 앉아 읽는다
// ============================================================
const LIB_GO = LL(37.5103, 127.0598), LB = new THREE.Vector3(152000, 0, -18000);
// 책장 그림: 한 장 = 가로 4m × 세로 4.5m (선반 10칸). 책등 색 · 높이 · 굵기가 다 다르고, 선반 판 아래 따뜻한 띠 조명
function shelfTex(seed = 3) {
  const r = rndS(seed), cols = ['#8a2a2a', '#2a4a7a', '#d8c8a0', '#3a6a4a', '#e8e0d0', '#c86a2a', '#1a1a1a', '#6a4a8a', '#e8b84a', '#4a8aa8', '#a83a5a', '#f2efe6', '#7a5a3a'];
  const map = cvTex(512, 512, (c, W, H) => { c.fillStyle = '#3a2416'; c.fillRect(0, 0, W, H);
    for (let row = 0; row < 10; row++) { const y0 = row * 51.2; let x = 4; while (x < W - 4) { const bw = 6 + r() * 12, bh = 30 + r() * 15, col = cols[Math.floor(r() * cols.length)]; if (r() < 0.06) { x += 10 + r() * 20; continue; } c.fillStyle = col; c.fillRect(x, y0 + 46 - bh, bw - 1, bh); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + 1, y0 + 46 - bh + 4, bw - 3, 2); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + bw - 2, y0 + 46 - bh, 1, bh); if (bw > 10) { c.fillStyle = 'rgba(255,240,200,.5)'; c.fillRect(x + 2, y0 + 46 - bh * 0.6, bw - 5, 2); } x += bw; }
      c.fillStyle = '#c8a070'; c.fillRect(0, y0 + 46, W, 5.2); c.fillStyle = '#fff2c8'; c.fillRect(0, y0 + 50, W, 1.2); }
    c.fillStyle = '#b08858'; for (let x = 0; x < W; x += 128) c.fillRect(x, 0, 5, H); });
  // 빛나는 부분: 선반 아래 띠 · 책등이 띠에 비친 아래쪽
  const em = cvTex(512, 512, (c, W, H) => { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); for (let row = 0; row < 10; row++) { const y0 = row * 51.2; const g = c.createLinearGradient(0, y0 + 51, 0, y0 + 51 + 30); g.addColorStop(0, 'rgba(255,214,150,.95)'); g.addColorStop(1, 'rgba(255,190,120,0)'); c.fillStyle = g; c.fillRect(0, y0 + 50, W, 30); c.fillStyle = '#ffe6b0'; c.fillRect(0, y0 + 49, W, 2.5); } });
  return { map, em };
}
// 둥근 모서리 네모 둘레를 따라 세운 책장 벽 (u = 둘레 길이 / 4m, v = 높이 / 4.5m) + 위 판
function shelfTower(w, d, h, rad, o = {}) {
  const pts = [], seg = 8, hw = w / 2 - rad, hd = d / 2 - rad; for (const [cx, cz, a0] of [[hw, hd, 0], [hw, -hd, -Math.PI / 2], [-hw, -hd, Math.PI], [-hw, hd, Math.PI / 2]]) for (let i = 0; i <= seg; i++) { const a = a0 - (i / seg) * (Math.PI / 2) + Math.PI / 2; pts.push([cx + Math.sin(a) * rad, cz + Math.cos(a) * rad]); }
  pts.push(pts[0]); const P = [], UV = [], I = []; let acc = 0;
  for (let i = 0; i < pts.length; i++) { if (i) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); P.push(pts[i][0], 0, pts[i][1], pts[i][0], h, pts[i][1]); UV.push(acc / 4, 0, acc / 4, h / 4.5); if (i) { const a = (i - 1) * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  if (g.attributes.normal.getX(0) * pts[0][0] + g.attributes.normal.getZ(0) * pts[0][1] < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const q = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = q; } g.computeVertexNormals(); }
  return g;
}
function buildLibrary(A) {
  const g = new THREE.Group(); g.position.copy(LB); const V = [], SH = [], FL = [], WL = [], GL = [], H = 21;
  // 바닥(밝은 돌 판) · 둘레 벽 · 2층 마루(뒤쪽) · 에스컬레이터
  FL.push(partUV(boxUV(60, 0.2, 50, 4, 4), 0, -0.1, 0));
  for (const [x, z, w, d] of [[0, -25.5, 60, 1], [0, 25.5, 60, 1], [-30.5, 0, 1, 50], [30.5, 0, 1, 50]]) WL.push(partUV(boxUV(w, H, d, 6, 3), x, H / 2, z, 0, '#e8e2d8'));
  V.push(part(new THREE.BoxGeometry(60, 0.5, 9), '#d8d2c8', 0, 5.6, -20.5), part(new THREE.BoxGeometry(60, 0.08, 0.1), '#b88a50', 0, 6.95, -16));
  GL.push(partUV(plainBox(60, 1.1, 0.05), 0, 6.4, -16));
  { const esc = []; esc.push(part(new THREE.BoxGeometry(1.6, 0.4, 12), '#8a8e94', -8, 2.9, -10, -Math.atan2(5.6, 12), 0, 0)); for (const sx of [-0.85, 0.85]) esc.push(part(new THREE.BoxGeometry(0.12, 1.1, 12.4), '#3a3e44', -8 + sx, 3.5, -10, -Math.atan2(5.6, 12), 0, 0)); V.push(...esc); GL.push(partUV(plainBox(0.04, 0.9, 12), -8.9, 3.6, -10, 0, '#ffffff', -Math.atan2(5.6, 12))); }
  // 책장: 둥근 모서리 탑 둘 (사진처럼 마주 선다) + 뒤 벽 긴 책장 (2층까지)
  for (const [x, z, w, d, rr] of [[-15, 4, 18, 11, 3.2], [15, 4, 16, 12, 3.6]]) { const t = shelfTower(w, d, 13, rr); t.translate(x, 0, z); SH.push(t); V.push(part(new THREE.BoxGeometry(w - 0.2, 0.3, d - 0.2), '#3a2416', x, 13.1, z)); }
  { const back = new THREE.PlaneGeometry(56, 13); const uv = back.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 13 / 4.5); back.translate(0, 6.5, -24.9); SH.push(back); }
  // 가운데 독서 탁자 (긴 나무 탁자 · 스탠드 · 의자 · 읽는 젤리)
  const lampM = new THREE.MeshLambertMaterial({ color: '#fff4d8', emissive: '#ffd890', emissiveIntensity: 1.2 }), lamps = [];
  const seats = []; for (let k = 0; k < 3; k++) { const z = 10 + k * 4.5; V.push(part(new THREE.BoxGeometry(12, 0.08, 1.6), '#a87a4a', 0, 0.78, z)); for (const sx of [-5.5, 5.5]) V.push(part(new THREE.BoxGeometry(0.1, 0.78, 1.4), '#6a4a2a', sx, 0.39, z)); for (let i = 0; i < 5; i++) { const x = -4.8 + i * 2.4; V.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), '#3a3a3a', x, 1.0, z), part(new THREE.BoxGeometry(0.4, 0.08, 0.4), '#2a2a2a', x, 0.82, z)); lamps.push([x, 1.24, z]); for (const sd of [-1, 1]) { V.push(part(new THREE.BoxGeometry(0.5, 0.06, 0.5), '#e8e2d6', x + 0.6, 0.46, z + sd * 1.15), part(new THREE.BoxGeometry(0.5, 0.6, 0.06), '#e8e2d6', x + 0.6, 0.76, z + sd * 1.4)); if ((i + k + (sd > 0 ? 1 : 0)) % 3 === 0 && !(k === 0 && i === 2 && sd > 0)) seats.push([x + 0.6, 0.12, z + sd * 1.15, sd > 0 ? Math.PI : 0]); } } }
  { const lg = []; for (const [x, y, z] of lamps) lg.push(part(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 12), '#ffffff', x, y, z)); g.add(new THREE.Mesh(merge(lg), lampM)); }
  const ppl = [...seats]; const r = rndS(8); for (let i = 0; i < 18; i++) ppl.push([(r() - 0.5) * 50, 0, -12 + r() * 32]); for (let i = 0; i < 6; i++) ppl.push([(r() - 0.5) * 50, 6.0, -22 + r() * 4]); const cg = crowd(ppl, 9, 0.95); if (cg) V.push(cg);
  // 위: 사선 철골 유리 천장 (밤엔 어둡게) — 그림 한 장
  const roofT = cvTex(256, 256, (c, W2, H2) => { c.fillStyle = '#eef4f8'; c.fillRect(0, 0, W2, H2); c.strokeStyle = '#c9ced2'; c.lineWidth = 3; for (let i = -W2; i < W2 * 2; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H2, H2); c.stroke(); c.beginPath(); c.moveTo(i, H2); c.lineTo(i + H2, 0); c.stroke(); } c.strokeStyle = '#aab0b6'; c.lineWidth = 2; for (let i = 0; i < W2; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H2); c.stroke(); } });
  roofT.repeat.set(6, 5); const roofM = new THREE.MeshBasicMaterial({ map: roofT }); const roof = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), roofM); roof.rotation.x = Math.PI / 2; roof.position.y = H; g.add(roof);
  const { map, em } = shelfTex(17); const shelfM = new THREE.MeshLambertMaterial({ map, emissive: '#ffffff', emissiveMap: em, emissiveIntensity: 0.7 }); shelfM.userData.e0 = 0.7;
  const floorM = inMat(cvTex(256, 256, (c, W2, H2) => { const r2 = rndS(2); for (let y = 0; y < H2; y += 64) for (let x = 0; x < W2; x += 128) { const l = 196 + r2() * 16; c.fillStyle = `rgb(${l},${l - 4},${l - 10})`; c.fillRect(x, y, 128, 64); } c.fillStyle = 'rgba(90,80,70,.35)'; for (let y = 0; y < H2; y += 64) c.fillRect(0, y, W2, 1.5); for (let x = 0; x < W2; x += 128) c.fillRect(x, 0, 1.5, H2); }), { e: 0.22 });
  const wallM = inMat(cvTex(64, 64, (c) => { c.fillStyle = '#d8d2c8'; c.fillRect(0, 0, 64, 64); }), { e: 0.2 });
  g.add(new THREE.Mesh(mergeUV(SH), shelfM), new THREE.Mesh(mergeUV(FL), floorM), new THREE.Mesh(mergeUV(WL), wallM), new THREE.Mesh(merge(V), vcMat({ emissive: '#ffffff', emissiveIntensity: 0.1 })), new THREE.Mesh(mergeUV(GL), new THREE.MeshLambertMaterial({ color: '#d8ecf0', transparent: true, opacity: 0.3, depthWrite: false })));
  inLit(A, [shelfM, floorM, wallM], 0.25); lit(A, (Lt) => roofM.color.setRGB(1 - Lt * 0.8, 1 - Lt * 0.78, 1 - Lt * 0.7));
  // 꺼내 읽는 책 (표지 둘 · 책장 묶음 · 넘어가는 한 장)
  const book = new THREE.Group(), cover = vcMat(), bc = merge([part(new THREE.BoxGeometry(0.17, 0.24, 0.012), '#2a5a8a', -0.085, 0, 0), part(new THREE.BoxGeometry(0.17, 0.24, 0.012), '#2a5a8a', 0.085, 0, 0), part(new THREE.BoxGeometry(0.16, 0.23, 0.01), '#f4efe2', -0.08, 0, 0.011), part(new THREE.BoxGeometry(0.16, 0.23, 0.01), '#f4efe2', 0.08, 0, 0.011)]);
  const bm = new THREE.Mesh(bc, cover); book.add(bm); const pageG = new THREE.PlaneGeometry(0.155, 0.225); pageG.translate(0.0775, 0, 0); const page = new THREE.Mesh(pageG, new THREE.MeshLambertMaterial({ color: '#fbf7ec', side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.25 })); page.position.z = 0.018; book.add(page); book.visible = false; g.add(book);
  g.userData = { book, page, H };
  return g;
}
registerAttraction({
  id: 'library', name: '코엑스 큰 서가 도서관', seal: '도서관', icon: '📚', x: LIB_GO[0], z: LIB_GO[1], r: 24, buildR: 900, verb: '책 읽으러',
  go: [LIB_GO[0], LIB_GO[1] + 8, Math.PI], intro: '13m 높이 책장 사이를 걸어 책을 한 권 골라 탁자에 앉아 읽어요',
  start(A) {
    const hg = A.hg; A.lib ||= buildLibrary(A); const g = A.lib; if (!g.parent) A.root.add(g); g.visible = true; const D = g.userData, bearVis = hg.bear?.root.visible; let picked = -1, flip = 0;
    const shelfP = new THREE.Vector3(LB.x - 15 + 5.5, 1.5, LB.z + 4 + 5.6), seatP = new THREE.Vector3(LB.x + 0.6, 1.25, LB.z + 10 + 0.9);
    const E = { title: '코엑스 큰 서가 도서관', lock: true,
      status() { return picked < 0 ? (this.t < 7 ? '책장 사이를 걸어요 · 위를 올려다봐요' : '책을 한 권 골라요 (E)') : this.t - picked < 3 ? '탁자로 가서 앉아요' : `📖 읽는 중 · ${Math.min(5, flip)} / 5 쪽`; },
      actLabel() { return picked < 0 && this.t >= 6 ? '📕 이 책으로' : ''; },
      act() { if (picked < 0 && this.t >= 6) { picked = this.t; D.book.visible = true; A.drum(0.25, 420, 0.06); hg.onToast?.('📕 책을 한 권 꺼냈어요'); } },
      tick() { if (hg.bear) hg.bear.root.visible = false; if (picked < 0 && this.t > 11) this.act();
        const B = D.book; if (picked >= 0) { const k = clamp((this.t - picked) / 3, 0, 1), s = smooth(k); B.position.lerpVectors(shelfP.clone().sub(LB), seatP.clone().sub(LB).add(new THREE.Vector3(0, -0.4, -0.45)), s); B.rotation.set(-1.1 * s, 0, 0); const rt = this.t - picked - 3; if (rt > 0) { flip = Math.floor(rt / 1.6); D.page.rotation.y = -Math.PI * smooth((rt % 1.6) / 1.2); } if (rt > 9) A.finish(E); } },
      cam(camera, dt) {
        const t = this.t; let pos, look;
        if (picked < 0) { const k = smooth(t / 8); pos = new THREE.Vector3(LB.x + 2 - k * 4, 1.7, LB.z + 22 - k * 9); look = new THREE.Vector3(LB.x - 12 + k * 2, 4 + Math.sin(t * 0.5) * 3 + (1 - k) * 2, LB.z + 6); }
        else { const k = smooth((t - picked) / 3); pos = new THREE.Vector3(LB.x + 2, 1.7, LB.z + 13).lerp(seatP.clone().add(new THREE.Vector3(0, 0.25, 0.5)), k); look = new THREE.Vector3(LB.x - 10, 3, LB.z + 7).lerp(seatP.clone().add(new THREE.Vector3(0, -0.45, -0.5)), k); }
        (this.cp ||= pos.clone()).lerp(pos, 1 - Math.exp(-dt * 3)); camera.position.copy(this.cp); (this.lk ||= look.clone()).lerp(look, 1 - Math.exp(-dt * 3)); camera.lookAt(this.lk);
      },
      end() { g.visible = false; D.book.visible = false; if (hg.bear) hg.bear.root.visible = bearVis ?? true; }, where() { return '코엑스 큰 서가 도서관'; } };
    return E;
  },
});

// ============================================================
// 2-9 서울식물원 온실 (사진: 흰 철골 · 유리 접시 지붕 아래 야자 · 파초 · 고사리 · 무화과 덤불, 돌 판 길, 둘레 높은 곳의 스카이워크)
//   지도 온실(식물문화센터, 가운데 -12800, -4355 · 반지름 약 44m) 안에 제자리로 심는다. 동쪽 2/3 열대관 · 서쪽 지중해관(올리브 · 선인장)
// ============================================================
const BOT = [-12800, -4355], BOT_R = 41;
// 잎 그림 (가장자리 투명): 야자 잎(가운데 줄기 · 양옆 가는 잎 조각) · 파초 잎(넓고 결이 찢어진)
const frondTex = () => cvTex(64, 256, (c, W, H) => { c.clearRect(0, 0, W, H); c.strokeStyle = '#3a5a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, H); c.lineTo(W / 2, 0); c.stroke(); for (let y = 6; y < H - 6; y += 5) { const L = (W / 2 - 2) * Math.sin((y / H) * Math.PI) ** 0.6; for (const s of [-1, 1]) { c.strokeStyle = y % 10 ? '#4f7a36' : '#5f8a40'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(W / 2, y + 2); c.lineTo(W / 2 + s * L, y + 12); c.stroke(); } } }, false);
const bananaTex = () => cvTex(128, 256, (c, W, H) => { c.clearRect(0, 0, W, H); c.fillStyle = '#4f8a3e'; c.beginPath(); c.moveTo(W / 2, H); c.bezierCurveTo(-10, H * 0.7, 4, H * 0.15, W / 2, 0); c.bezierCurveTo(W - 4, H * 0.15, W + 10, H * 0.7, W / 2, H); c.fill(); c.strokeStyle = 'rgba(200,230,170,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, H); c.lineTo(W / 2, 0); c.stroke(); c.strokeStyle = 'rgba(40,70,30,.35)'; c.lineWidth = 1; for (let y = 10; y < H; y += 7) { c.beginPath(); c.moveTo(W / 2, y + 6); c.lineTo(4, y); c.moveTo(W / 2, y + 6); c.lineTo(W - 4, y); c.stroke(); } c.globalCompositeOperation = 'destination-out'; const r = rndS(4); for (let i = 0; i < 7; i++) { const y = 30 + r() * (H - 60), s = r() < 0.5 ? 0 : W; c.fillRect(s - 1, y, W / 2 - 4, 1.6); } });
// 휘어 늘어진 잎 한 장 (길이 방향으로 굽은 판)
function droopLeaf(len, wid, bend, segs = 6) { const g = new THREE.PlaneGeometry(wid, len, 1, segs); g.translate(0, len / 2, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / len; p.setXYZ(i, p.getX(i), Math.sin(t * Math.PI * 0.5) * len * (1 - bend * 0.5) - bend * t * t * len * 0.6, t * t * bend * len * 0.9); } g.computeVertexNormals(); return g; }
function buildBotanic(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g); const [cx, cz] = BOT, y0 = A.H(cx, cz), r = rndS(2019), V = [];
  // 바닥: 흙 · 덤불 둔덕, 굽은 돌 판 길(두 갈래) · 작은 연못
  V.push(part(new THREE.CylinderGeometry(BOT_R + 1, BOT_R + 1, 0.3, 48), '#4a5232', cx, y0 + 0.1, cz));
  const pathPts = []; for (let i = 0; i <= 60; i++) { const a = -2.6 + (i / 60) * 5.4, rr = 22 + Math.sin(a * 2.3) * 9; pathPts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  for (let i = 1; i < pathPts.length; i++) { const [ax, az] = pathPts[i - 1], [bx, bz] = pathPts[i], L = Math.hypot(bx - ax, bz - az); V.push(part(new THREE.BoxGeometry(2.6, 0.08, L + 0.3), i % 2 ? '#c9c2b4' : '#bfb8aa', (ax + bx) / 2, y0 + 0.28, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0)); }
  V.push(part(new THREE.CylinderGeometry(5, 5.2, 0.12, 28), '#2f5a5a', cx + 6, y0 + 0.28, cz + 4), part(new THREE.TorusGeometry(5.1, 0.3, 6, 28), '#8a8478', cx + 6, y0 + 0.3, cz + 4, Math.PI / 2));
  const nearPath = (x, z, m = 2.6) => pathPts.some(([px, pz]) => Math.hypot(px - x, pz - z) < m) || Math.hypot(x - cx - 6, z - cz - 4) < 6;
  const spot = (minR = 0, maxR = BOT_R - 2, side = 0, m = 2.6) => { for (let k = 0; k < 40; k++) { const a = r() * 6.28, d = Math.sqrt(minR * minR + r() * (maxR * maxR - minR * minR)), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (nearPath(x, z, m)) continue; if (side && Math.sign(x - cx + 14) !== side) continue; return [x, z]; } return null; };
  // 덤불 (무화과 · 몬스테라 같은 둥근 잎 덩이): 꼭짓점 색 덩이
  for (let i = 0; i < 240; i++) { const s = 0.8 + r() * 1.4, p = spot(0, BOT_R - 1.5, 0, 2.4 + s * 1.3); if (!p) continue; for (let q = 0; q < 3; q++) V.push(part(new THREE.IcosahedronGeometry(s * (1 - q * 0.2), 1), ['#2f5a2a', '#3a6a32', '#4a7a3a', '#2a4a26'][Math.floor(r() * 4)], p[0] + (r() - 0.5) * s, y0 + 0.3 + s * 0.6 + q * 0.3, p[1] + (r() - 0.5) * s, 0, r() * 3, 0, 1, 0.75, 1)); }
  // 지중해관(서쪽): 올리브(은빛 녹색 덩이) · 기둥 선인장
  for (let i = 0; i < 14; i++) { const p = spot(8, BOT_R - 3, -1); if (!p) continue; V.push(part(new THREE.CylinderGeometry(0.14, 0.22, 2.2, 6), '#6a5a48', p[0], y0 + 1.3, p[1], 0, 0, (r() - 0.5) * 0.3)); for (let q = 0; q < 4; q++) V.push(part(new THREE.IcosahedronGeometry(1 + r() * 0.5, 1), ['#8a9a78', '#7a8a6a', '#9aa888'][q % 3], p[0] + (r() - 0.5) * 1.6, y0 + 2.8 + r() * 0.8, p[1] + (r() - 0.5) * 1.6, 0, 0, 0, 1, 0.6, 1)); }
  for (let i = 0; i < 18; i++) { const p = spot(6, BOT_R - 2, -1); if (!p) continue; const h = 1 + r() * 2.2; V.push(part(new THREE.CapsuleGeometry(0.22, h, 4, 8), '#4a7a4a', p[0], y0 + 0.3 + h / 2, p[1])); if (r() < 0.6) V.push(part(new THREE.CapsuleGeometry(0.14, h * 0.4, 4, 6), '#4a7a4a', p[0] + 0.3, y0 + 0.3 + h * 0.55, p[1], 0, 0, -0.5)); }
  // 야자: 줄기(마디 띠 색) 인스턴스 · 잎(늘어진 깃털 잎) 인스턴스 · 파초(넓은 잎) 인스턴스
  const palms = []; for (let i = 0; i < 26; i++) { const p = spot(0, BOT_R - 4, 1, 3.4) || spot(0, BOT_R - 4, 0, 3.4); if (p) palms.push([p[0], p[1], 7 + r() * 9, r() * 0.25]); }
  const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 1, 9, 8, true); trunkG.translate(0, 0.5, 0); { const tp = trunkG.attributes.position, col = new Float32Array(tp.count * 3), c1 = new THREE.Color('#a8957a'), c2 = new THREE.Color('#7a6a54'), cc = new THREE.Color(); for (let i = 0; i < tp.count; i++) { cc.copy(Math.floor(tp.getY(i) * 16) % 2 ? c1 : c2); col.set([cc.r, cc.g, cc.b], i * 3); } trunkG.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const trunks = new THREE.InstancedMesh(trunkG, vcMat(), palms.length), o = new THREE.Object3D(); palms.forEach(([x, z, h, lean], i) => { o.position.set(x, y0 + 0.2, z); o.rotation.set(lean, r() * 6.28, 0); o.scale.set(1, h, 1); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix); });
  const leafM = new THREE.MeshLambertMaterial({ map: frondTex(), alphaTest: 0.45, side: THREE.DoubleSide }), fronds = new THREE.InstancedMesh(droopLeaf(4.2, 1.3, 0.9), leafM, palms.length * 11), col = new THREE.Color(); let n = 0;
  palms.forEach(([x, z, h, lean]) => { const top = new THREE.Vector3(x, y0 + 0.2 + h * Math.cos(lean), z); for (let k = 0; k < 11; k++) { o.position.copy(top); o.rotation.set(0, (k / 11) * 6.28 + r() * 0.3, 0); o.rotateX(0.35 + r() * 0.5 + (k % 3) * 0.15); o.scale.setScalar(0.8 + r() * 0.45); o.updateMatrix(); fronds.setMatrixAt(n, o.matrix); fronds.setColorAt(n, col.setHSL(0.27 + r() * 0.05, 0.45, 0.42 + r() * 0.12)); n++; } });
  const banM = new THREE.MeshLambertMaterial({ map: bananaTex(), alphaTest: 0.4, side: THREE.DoubleSide }), bans = []; for (let i = 0; i < 80; i++) { const p = spot(3, BOT_R - 2, 1); if (p) bans.push(p); }
  const banana = new THREE.InstancedMesh(droopLeaf(2.6, 0.9, 0.55), banM, bans.length * 6); n = 0; bans.forEach(([x, z]) => { const s = 0.8 + r() * 0.8; for (let k = 0; k < 6; k++) { o.position.set(x, y0 + 0.3, z); o.rotation.set(0, (k / 6) * 6.28 + r(), 0); o.rotateX(0.15 + r() * 0.5); o.scale.setScalar(s); o.updateMatrix(); banana.setMatrixAt(n, o.matrix); banana.setColorAt(n, col.setHSL(0.26 + r() * 0.04, 0.4, 0.5 + r() * 0.1)); n++; } });
  // 고사리 (낮게 퍼지는 깃털 잎)
  const ferns = new THREE.InstancedMesh(droopLeaf(1.4, 0.6, 1.0, 4), leafM, 150 * 7); n = 0; for (let i = 0; i < 150; i++) { const p = spot(0, BOT_R - 2); if (!p) continue; for (let k = 0; k < 7; k++) { o.position.set(p[0], y0 + 0.3, p[1]); o.rotation.set(0, (k / 7) * 6.28, 0); o.rotateX(0.7 + r() * 0.4); o.scale.setScalar(0.9 + r() * 0.5); o.updateMatrix(); ferns.setMatrixAt(n, o.matrix); ferns.setColorAt(n, col.setHSL(0.25, 0.5, 0.4 + r() * 0.12)); n++; } } ferns.count = n;
  for (const im of [trunks, fronds, banana, ferns]) { im.frustumCulled = false; g.add(im); }
  // 스카이워크: 둘레 높은 곳(7m)의 다리길 · 유리 난간 · 흰 받침 기둥
  const SW = 7, sr = BOT_R - 4.5; for (let i = 0; i < 64; i++) { const a = (i / 64) * 6.28, a2 = ((i + 1) / 64) * 6.28, x = cx + Math.cos((a + a2) / 2) * sr, z = cz + Math.sin((a + a2) / 2) * sr, L = sr * (a2 - a) + 0.1, ry = -(a + a2) / 2; V.push(part(new THREE.BoxGeometry(2.4, 0.25, L), '#e6e6e2', x, y0 + SW, z, 0, ry, 0), part(new THREE.BoxGeometry(0.08, 0.06, L), '#b0b4b8', x + Math.cos((a + a2) / 2) * 1.2, y0 + SW + 1.1, z + Math.sin((a + a2) / 2) * 1.2, 0, ry, 0)); if (i % 4 === 0) V.push(part(new THREE.CylinderGeometry(0.18, 0.22, SW, 8), '#f0f0ec', x, y0 + SW / 2, z)); }
  const deco = new THREE.Mesh(merge(V), vcMat()); g.add(deco);
  // 밤: 잎이 안 보이게 너무 어둡지 않도록 안쪽 빛
  const mats = [leafM, banM, deco.material, trunks.material]; for (const m of mats) { m.emissive = new THREE.Color('#1a2a12'); m.emissiveIntensity = 0; } lit(A, (L) => { for (const m of mats) m.emissiveIntensity = L * 1.6; });
  // 온실 안 지도 나무는 치운다
  const undo = hideTrees(hg, (x, z) => Math.hypot(x - cx, z - cz) < BOT_R + 3);
  A.botY = y0; A.botSW = { sr, h: SW }; A.botPath = pathPts;
  return { group: g, dispose() { undo(); g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'botanic', name: '서울식물원 온실', seal: '식물원', icon: '🌴', x: BOT[0], z: BOT[1] + 52, r: 22, buildR: 900, verb: '온실 걷기',
  go: [BOT[0], BOT[1] + 58, Math.PI], intro: '오목한 접시 지붕 아래 열대 야자 · 파초 숲과 지중해 올리브 · 선인장 사이를 걸어요',
  build: buildBotanic,
  start(A) {
    const hg = A.hg, [cx, cz] = BOT; if (A.botY == null) return null; const y0 = A.botY, S = A.botSW, bearVis = hg.bear?.root.visible;
    const E = { title: '서울식물원 온실', lock: true,
      status() { return this.t < 24 ? (this.t < 8 ? '열대관 돌 판 길을 걸어요' : '스카이워크에서 야자 숲을 내려다봐요') + ` · ${Math.ceil(24 - this.t)}초` : '다 둘러봤어요'; },
      tick() { if (hg.bear) hg.bear.root.visible = false; if (this.t > 25) A.finish(E); },
      cam(camera, dt) {
        const t = this.t; let pos, look;
        if (t < 8) { const P = A.botPath, f = 34 + t * 0.9, i = Math.min(P.length - 2, Math.floor(f)), q = P[Math.min(P.length - 1, i + 5)], a = P[i], b = P[i + 1], k = f - i; pos = new THREE.Vector3(a[0] + (b[0] - a[0]) * k, y0 + 1.9, a[1] + (b[1] - a[1]) * k); look = new THREE.Vector3(q[0], y0 + 3 + t * 0.5, q[1]); }
        else { const a = 0.5 - (t - 8) * 0.06; pos = new THREE.Vector3(cx + Math.cos(a) * S.sr, y0 + S.h + 1.7, cz + Math.sin(a) * S.sr); look = new THREE.Vector3(cx + Math.cos(a - 0.5) * 10, y0 + 4, cz + Math.sin(a - 0.5) * 10); }
        (this.cp ||= pos.clone()).lerp(pos, 1 - Math.exp(-dt * 2.5)); camera.position.copy(this.cp); (this.lk ||= look.clone()).lerp(look, 1 - Math.exp(-dt * 2.5)); camera.lookAt(this.lk);
      },
      end() { if (hg.bear) hg.bear.root.visible = bearVis ?? true; }, where() { return '서울식물원 온실'; } };
    return E;
  },
});

// ============================================================
// 2-10 잠실야구장 경기 관람 (사진: 밤 경기 · 위 아래 두 층 관중석이 내야를 감싸고, 붉은 흙 파울 지역 · 줄무늬 잔디 · 가운데 펜스 뒤 전광판 · 조명탑 여섯)
//   지도 '잠실야구장' 둥근 자리(가운데 8108, 1970 · 반지름 약 100m)에 제자리로 짓는다. 홈은 남서쪽, 가운데 담장은 북동쪽
// ============================================================
const BB = [8108, 1970], BB_F = [0.7071, -0.7071], BB_HOME = [BB[0] - BB_F[0] * 52, BB[1] - BB_F[1] * 52], BB_ROT = Math.atan2(BB_F[0], BB_F[1]);
ATTR_SKIP.add('잠실야구장');
const fenceD = (phi) => 122 - 24 * Math.pow(Math.min(1, Math.abs(phi) / (Math.PI / 4)), 1.4);
// 줄무늬 잔디 (깎은 결 두 가지 초록) · 흙
const turfTex = () => cvTex(256, 256, (c, W, H) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#3f8a3a' : '#4a9a42'; c.fillRect(0, i * 32, W, 32); } const r = rndS(3); for (let k = 0; k < 2500; k++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,220' : '0,40,0'},.06)`; c.fillRect(r() * W, r() * H, 2, 2); } });
// 관중석 의자 줄 (한 장 = 한 줄 높이 · 가로 2m): 등받이 · 앉는 판 · 계단 그늘
const seatTex = () => cvTex(64, 32, (c, W, H) => { c.fillStyle = '#5a5e64'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; for (let x = 2; x < W; x += 10) { c.fillRect(x, 6, 8, 12); c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x, 18, 8, 6); c.fillStyle = '#ffffff'; } c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 26, W, 6); });
function scoreTex(inn = 6, h = 3, a = 2, b = 1, s = 1, o = 1) {
  return cvTex(512, 192, (c, W, H) => { c.fillStyle = '#0a0e16'; c.fillRect(0, 0, W, H); c.fillStyle = '#16304a'; c.fillRect(6, 6, W - 12, 34); c.font = 'bold 22px sans-serif'; c.fillStyle = '#ffd84a'; c.textAlign = 'left'; c.fillText('젤리 서울 리그', 16, 31);
    c.font = 'bold 18px sans-serif'; const cols = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'R']; cols.forEach((t, i) => { c.fillStyle = '#9ab'; c.fillText(t, 110 + i * 34, 64); });
    const rows = [['원정', [0, 1, 0, 0, 1, 0], a], ['홈', [1, 0, 0, 2, 0, 0], h]]; rows.forEach(([nm, sc, R], j) => { const y = 96 + j * 36; c.fillStyle = j ? '#ff8a5a' : '#7ac8ff'; c.fillText(nm, 18, y); sc.forEach((v, i) => { if (i < inn) { c.fillStyle = '#fff'; c.fillText(String(v), 112 + (i + 1) * 34 - 34, y); } }); c.fillStyle = '#ffd84a'; c.fillText(String(R), 110 + 10 * 34, y); });
    c.fillStyle = '#9ab'; c.fillText('B', 18, 172); c.fillText('S', 118, 172); c.fillText('O', 218, 172); const dot = (x, on, col) => { c.fillStyle = on ? col : '#2a3040'; c.beginPath(); c.arc(x, 166, 8, 0, 7); c.fill(); };
    for (let i = 0; i < 3; i++) dot(44 + i * 20, i < b, '#5ae07a'); for (let i = 0; i < 2; i++) dot(144 + i * 20, i < s, '#ffd84a'); for (let i = 0; i < 2; i++) dot(244 + i * 20, i < o, '#ff5a5a');
    c.fillStyle = '#1e3a24'; c.fillRect(300, 120, 200, 64); c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.fillText('PLAY BALL', 318, 162); }, false);
}
function buildBallpark(A) {
  const hg = A.hg, g = new THREE.Group(); A.root.add(g); g.position.set(BB_HOME[0], 0, BB_HOME[1]); g.rotation.y = BB_ROT;
  const W2 = (lx, lz) => [BB_HOME[0] + lx * Math.cos(BB_ROT) + lz * Math.sin(BB_ROT), BB_HOME[1] - lx * Math.sin(BB_ROT) + lz * Math.cos(BB_ROT)];
  let y0 = -1e9; for (let gx = -60; gx <= 60; gx += 15) for (let gz = -10; gz <= 130; gz += 15) y0 = Math.max(y0, A.H(...W2(gx, gz))); y0 += 0.05; const V = [], r = rndS(1982);
  const flat = (pts, y, colr) => { const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))); const geo = new THREE.ShapeGeometry(sh, 2); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); return colr ? colored(geo, colr) : geo; };
  const arc = (cx, cz, R, a0, a1, n = 24) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push([cx + Math.sin(a) * R, cz + Math.cos(a) * R]); } return o; };
  // 바깥 경계 (관중석 앞선): 외야 담장 · 파울 지역(붉은 흙) · 홈 뒤
  const fence = []; for (let i = 0; i <= 40; i++) { const phi = -Math.PI / 4 + (i / 40) * (Math.PI / 2), d = fenceD(phi); fence.push([Math.sin(phi) * d, Math.cos(phi) * d]); }
  const foulOut = 17, loop = [...fence.map(([x, z]) => [x * 1.012, z * 1.012])];
  const pL = fence[fence.length - 1], pR = fence[0];
  loop.push([pL[0] + foulOut * 0.7071, pL[1] - foulOut * 0.7071 + 2], ...arc(0, 0, 21, Math.PI / 2 + 0.25, Math.PI * 1.5 - 0.25, 18).map(([x, z]) => [x, z]), [pR[0] - foulOut * 0.7071, pR[1] - foulOut * 0.7071 + 2]);
  // 바닥: 붉은 흙(파울 지역 · 경고 트랙) 전체 → 잔디(담장 안 페어 지역 + 파울 잔디) → 내야 흙 · 내야 잔디 · 마운드 · 베이스
  V.push(flat(loop, y0 + 0.05, '#a8553a'));
  const grassFan = [[0, -2], ...fence.map(([x, z]) => [x * 0.955, z * 0.955])]; const turf = flat(grassFan, y0 + 0.08); { const uv = turf.attributes.uv; const p = turf.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 24, p.getZ(i) / 12); }
  const foulGrass = []; for (const sd of [-1, 1]) foulGrass.push(flat([[sd * 4, -2], [sd * (pL[0] * 0.95 + 0), pL[1] * 0.95], [sd * (pL[0] * 0.95 + 9), pL[1] * 0.95 - 9], [sd * 13, -6]].map(([x, z]) => [x, z]), y0 + 0.075));
  for (const fg of foulGrass) { const uv = fg.attributes.uv, p = fg.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 24, p.getZ(i) / 12); }
  const dirtPts = [[0, -1.5], [27.5, 27.5], ...arc(0, 18.4, 29, 1.25, -1.25, 30), [-27.5, 27.5]]; V.push(flat(dirtPts, y0 + 0.1, '#c48a58'));
  const ig = flat([[0, 3.6], [-16.2, 19.4], [0, 35.4], [16.2, 19.4]], y0 + 0.12); { const uv = ig.attributes.uv, p = ig.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 24, p.getZ(i) / 12); }
  V.push(part(new THREE.CylinderGeometry(4, 4, 0.06, 28), '#c48a58', 0, y0 + 0.13, 0), part(new THREE.CylinderGeometry(2.7, 2.9, 0.3, 24), '#c48a58', 0, y0 + 0.2, 18.4), part(new THREE.BoxGeometry(0.6, 0.04, 0.15), '#ffffff', 0, y0 + 0.36, 18.4));
  for (const [x, z] of [[-19.4, 19.4], [0, 38.8], [19.4, 19.4]]) V.push(part(new THREE.CylinderGeometry(2.2, 2.2, 0.05, 20), '#c48a58', x, y0 + 0.14, z), part(new THREE.BoxGeometry(0.38, 0.08, 0.38), '#ffffff', x, y0 + 0.18, z, 0, Math.PI / 4, 0));
  V.push(part(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 5), '#ffffff', 0, y0 + 0.17, 0));
  for (const sd of [-1, 1]) { const L = 98; V.push(part(new THREE.BoxGeometry(0.1, 0.03, L), '#ffffff', sd * L / 2 * 0.7071, y0 + 0.16, L / 2 * 0.7071, 0, sd * Math.PI / 4, 0)); V.push(part(new THREE.BoxGeometry(1.2, 0.03, 1.8), '#ffffff', sd * 1.1, y0 + 0.15, 0)); }
  // 외야 담장 (짙은 초록 · 위 노란 줄) · 파울 폴
  for (let i = 1; i < fence.length; i++) { const [ax, az] = fence[i - 1], [bx, bz] = fence[i], L = Math.hypot(bx - ax, bz - az); V.push(part(new THREE.BoxGeometry(0.4, 3, L + 0.05), '#1f4a3a', (ax + bx) / 2, y0 + 1.5, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0), part(new THREE.BoxGeometry(0.45, 0.15, L + 0.05), '#f2c230', (ax + bx) / 2, y0 + 3.05, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0)); }
  for (const p of [pL, pR]) V.push(part(new THREE.CylinderGeometry(0.2, 0.25, 24, 8), '#f2c230', p[0], y0 + 12, p[1]));
  // 관중석: 경계를 따라 바깥으로 층층이 (아래층 22줄 · 위층 20줄, 위층은 가파르게) · 구역마다 의자 색
  const N = loop.length, cx0 = loop.reduce((s, p) => s + p[0], 0) / N, cz0 = loop.reduce((s, p) => s + p[1], 0) / N, nrm = loop.map(([x, z], i) => { const [ax, az] = loop[(i - 1 + N) % N], [bx, bz] = loop[(i + 1) % N]; let nx = bz - az, nz = -(bx - ax); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; if (nx * (x - cx0) + nz * (z - cz0) < 0) { nx = -nx; nz = -nz; } return [nx, nz]; });
  const SP = [], SUV = [], SC = [], SI = [], rows = []; let off = 1.5, hh = 1.2; for (let k = 0; k < 44; k++) { if (k === 22) { off += 3; hh += 3.2; } rows.push([off, hh]); off += k < 22 ? 0.85 : 0.8; hh += k < 22 ? 0.42 : 0.55; }
  const secCol = (i) => { const [x, z] = loop[i]; const behind = z < 30, out = z > 80; return out ? ['#2f7a5a', '#3a8a64'][Math.floor(i / 4) % 2] : behind ? ['#1f3f8a', '#2a5ab0', '#c8402a'][Math.floor(i / 3) % 3] : ['#e07a2a', '#2a5ab0', '#c8402a', '#1f3f8a'][Math.floor(i / 4) % 4]; };
  for (let k = 0; k < rows.length; k++) { const [o, h] = rows[k]; let acc = 0; for (let i = 0; i <= N; i++) { const j = i % N, [x, z] = loop[j], [nx, nz] = nrm[j]; if (i) acc += Math.hypot(loop[j][0] - loop[i - 1][0], loop[j][1] - loop[i - 1][1]); for (const [dO, dH, v] of [[0, 0, 0], [0, 0.42, 0.55], [0.85, 0.42, 1]]) { SP.push(x + nx * (o + dO), y0 + h + dH, z + nz * (o + dO)); SUV.push(acc / 2, v); const c = new THREE.Color(secCol(j)); SC.push(c.r, c.g, c.b); } } }
  const per = (N + 1) * 3; for (let k = 0; k < rows.length; k++) for (let i = 0; i < N; i++) { const b = k * per + i * 3, b2 = b + 3; for (let q = 0; q < 2; q++) SI.push(b + q, b2 + q, b + q + 1, b2 + q, b2 + q + 1, b + q + 1); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(SUV, 2)); sg.setAttribute('color', new THREE.Float32BufferAttribute(SC, 3)); sg.setIndex(SI); sg.computeVertexNormals();
  const seatM = new THREE.MeshLambertMaterial({ map: seatTex(), vertexColors: true, side: THREE.DoubleSide }); g.add(new THREE.Mesh(sg, seatM));
  // 관중석 앞 낮은 벽 · 위층 지붕(홈 뒤 · 내야) · 바깥 벽
  for (let i = 0; i < N; i++) { const [ax, az] = loop[i], [bx, bz] = loop[(i + 1) % N], L = Math.hypot(bx - ax, bz - az); V.push(part(new THREE.BoxGeometry(0.3, 1.4, L + 0.1), '#2a3a5a', (ax + bx) / 2, y0 + 0.7, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0)); const [nx, nz] = nrm[i], o2 = rows[43][0] + 1; V.push(part(new THREE.BoxGeometry(0.6, rows[43][1] + 3, L + 0.4), '#c9c4bc', (ax + bx) / 2 + nx * o2, y0 + (rows[43][1] + 3) / 2, (az + bz) / 2 + nz * o2, 0, Math.atan2(bx - ax, bz - az), 0)); if (az < 60 && loop[i][1] < 60) V.push(part(new THREE.BoxGeometry(12, 0.4, L + 0.4), '#3a3e46', (ax + bx) / 2 + nx * (o2 - 5), y0 + rows[43][1] + 5, (az + bz) / 2 + nz * (o2 - 5), 0, Math.atan2(bx - ax, bz - az), -0.12 * Math.sign(nx || 1) * 0)); }
  // 관중 (젤리, 인스턴스 하나): 내야는 빽빽 · 외야는 듬성
  const fanG = merge([part(new THREE.SphereGeometry(0.3, 6, 4), '#ffffff', 0, 0.35, 0, 0, 0, 0, 1, 1.1, 0.9), part(new THREE.SphereGeometry(0.24, 6, 4), '#ffffff', 0, 0.82, 0), part(new THREE.SphereGeometry(0.08, 4, 3), '#ffffff', -0.15, 1.02, 0), part(new THREE.SphereGeometry(0.08, 4, 3), '#ffffff', 0.15, 1.02, 0)]);
  const fans = new THREE.InstancedMesh(fanG, vcMat(), 4200), o = new THREE.Object3D(), fc = new THREE.Color(), FC = ['#ffffff', '#1f3f8a', '#f4f0e8', '#e8e8e8', '#c8402a', '#2a2a30', '#ffd76a', '#ff9ec0', '#9ad0ff']; let nf = 0; const fanPos = [];
  for (let k = 0; k < rows.length && nf < 4200; k++) for (let i = 0; i < N && nf < 4200; i++) { const [x, z] = loop[i], [nx, nz] = nrm[i], dens = z > 80 ? 0.22 : 0.7; const [x2, z2] = loop[(i + 1) % N]; const L = Math.hypot(x2 - x, z2 - z); for (let s = 0; s < L; s += 0.9) { if (r() > dens || nf >= 4200) continue; const t = s / L, px = x + (x2 - x) * t + nx * (rows[k][0] + 0.45), pz = z + (z2 - z) * t + nz * (rows[k][0] + 0.45); o.position.set(px, y0 + rows[k][1] + 0.42, pz); o.rotation.set(0, Math.atan2(-nx, -nz), 0); o.scale.setScalar(0.9 + r() * 0.2); o.updateMatrix(); fans.setMatrixAt(nf, o.matrix); fans.setColorAt(nf, fc.set(FC[Math.floor(r() * FC.length)])); fanPos.push([px, rows[k][1], pz, r() * 6.28, fans.instanceMatrix.array.slice(nf * 16, nf * 16 + 16)]); nf++; } }
  fans.count = nf; fans.frustumCulled = false; fans.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(fans);
  // 조명탑 여섯 (기둥 · 빛 판) · 전광판 (가운데 담장 뒤)
  const towerM = new THREE.MeshLambertMaterial({ color: '#fffbea', emissive: '#fff6d8', emissiveIntensity: 0.3 }), TP = [], LP = [];
  for (const i of [3, 12, 28, 37, Math.floor(N * 0.62), Math.floor(N * 0.86)]) { const [x, z] = loop[i % N], [nx, nz] = nrm[i % N], o2 = rows[43][0] + 3, px = x + nx * o2, pz = z + nz * o2, ry = Math.atan2(-nx, -nz); TP.push(part(new THREE.CylinderGeometry(0.6, 0.9, 48, 8), '#c9ccd0', px, y0 + 24, pz)); TP.push(part(new THREE.BoxGeometry(9, 4.2, 0.5), '#3a3e46', px, y0 + 49, pz, 0.35, ry, 0)); for (let a = 0; a < 4; a++) for (let b = 0; b < 8; b++) { const lx = -3.8 + b * 1.08, ly = -1.5 + a * 1.0; LP.push(part(new THREE.BoxGeometry(0.85, 0.75, 0.1), '#ffffff', px + Math.cos(ry) * lx - Math.sin(ry) * 0.3, y0 + 49 + ly * Math.cos(0.35), pz - Math.sin(ry) * lx - Math.cos(ry) * 0.3, 0.35, ry, 0)); } }
  g.add(new THREE.Mesh(merge(TP), vcMat()), new THREE.Mesh(merge(LP), towerM));
  const sbT = scoreTex(), sbM = new THREE.MeshBasicMaterial({ map: sbT }), sb = new THREE.Mesh(new THREE.PlaneGeometry(30, 11.25), sbM); const sbz = fenceD(0) + 24; sb.position.set(0, y0 + 22, sbz); sb.rotation.y = Math.PI; g.add(sb); V.push(part(new THREE.BoxGeometry(32, 13, 1.2), '#1a1e26', 0, y0 + 22, sbz + 0.7), part(new THREE.BoxGeometry(3, 16, 2), '#2a2e36', -8, y0 + 8, sbz + 1), part(new THREE.BoxGeometry(3, 16, 2), '#2a2e36', 8, y0 + 8, sbz + 1));
  // 바닥 · 담장 · 관중석 벽을 한 번에, 잔디(줄무늬) 따로
  // 밤 경기: 조명탑이 경기장을 환하게 (잔디 · 흙 · 관중석이 스스로 밝아진다)
  const vM = vcMat({ emissive: '#fff6e0', emissiveIntensity: 0 }); g.add(new THREE.Mesh(merge(V), vM));
  const tT = turfTex(), turfM = new THREE.MeshLambertMaterial({ map: tT, emissive: '#ffffff', emissiveMap: tT, emissiveIntensity: 0 }); g.add(new THREE.Mesh(merge([turf, ...foulGrass, ig].map((q) => { const z = q.toNonIndexed ? q : q; for (const k of Object.keys(z.attributes)) if (!['position', 'normal', 'uv'].includes(k)) z.deleteAttribute(k); return z; })), turfM));
  seatM.emissive.set('#ffffff'); fans.material.emissive.set('#ffffff'); vM.emissive.set('#ffffff'); for (const m of [vM, seatM, fans.material]) glowByColor(m);
  lit(A, (L) => { towerM.emissiveIntensity = 0.3 + L * 2.2; turfM.emissiveIntensity = L * 0.55; vM.emissiveIntensity = L * 0.6; seatM.emissiveIntensity = L * 0.5; fans.material.emissiveIntensity = L * 0.6; });
  // 선수: 수비(흰 유니폼 · 남색 모자) 아홉 + 타자 · 포수 · 심판 + 주자. 한 사람 = 몸 · 머리 · 모자 묶음 하나
  const playerM = glowByColor(vcMat({ emissive: '#ffffff', emissiveIntensity: 0 })); lit(A, (L) => { playerM.emissiveIntensity = L * 0.6; });
  const player = (body, cap) => { const ps = jelly(body, 1.25); ps.push(part(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, 1.38, 0, 0, 0, 0, 1.3, 0.7, 1.3), part(new THREE.BoxGeometry(0.28, 0.03, 0.22), cap, 0, 1.38, 0.2)); return new THREE.Mesh(merge(ps), playerM); };
  const POS = { P: [0, 18.4], C: [0, -1.8], '1B': [-20, 24], '2B': [-9, 36], SS: [9, 36], '3B': [20, 24], LF: [44, 72], CF: [0, 92], RF: [-44, 72] };
  const fielders = {}; for (const [k, [x, z]] of Object.entries(POS)) { const m = player('#f4f2ee', '#1a2a5a'); m.position.set(x, y0 + 0.15, z); m.rotation.y = Math.PI; g.add(m); fielders[k] = m; }
  fielders.C.rotation.y = 0; const batter = player('#8a9ab8', '#c8402a'); batter.position.set(0.9, y0 + 0.15, 0.2); batter.rotation.y = -Math.PI / 2; g.add(batter); const ump = player('#2a2a30', '#1a1a1a'); ump.position.set(0, y0 + 0.15, -3); g.add(ump);
  const bat = new THREE.Mesh(colored(new THREE.CylinderGeometry(0.035, 0.02, 0.85, 6), '#c8a070'), vcMat()); bat.position.set(-0.25, 1.15, 0.1); bat.rotation.set(0, 0, 0.9); batter.add(bat);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); ball.visible = false; g.add(ball);
  const undo = hideTrees(hg, (x, z) => Math.hypot(x - BB[0], z - BB[1]) < 125);
  const S = { fans, fanPos, fielders, batter, bat, ball, y0, sbM, home: { ...POS } };
  A.ballpark = S;
  return { group: g, tick(dt, exp) { if (!exp) return; }, dispose() { undo(); g.traverse((q) => q.geometry?.dispose?.()); } };
}
registerAttraction({
  id: 'baseball', name: '잠실야구장 경기 관람', seal: '야구장', icon: '⚾', x: BB[0] - 30, z: BB[1] + 112, r: 26, buildR: 1200, verb: '경기 보기',
  go: [BB[0] - 30, BB[1] + 118, Math.PI], intro: '관중석에 앉아 한 이닝을 봐요 · 던지고 치고 달리는 저녁 경기 · 응원 함성',
  build: buildBallpark,
  start(A) {
    const hg = A.hg, S = A.ballpark; if (!S) return null; const h0 = hg.state.hour; if (h0 < 18 || h0 > 22) hg.state.hour = 19.1; const bearVis = hg.bear?.root.visible;
    const W2 = (lx, y, lz) => new THREE.Vector3(BB_HOME[0] + lx * Math.cos(BB_ROT) + lz * Math.sin(BB_ROT), y, BB_HOME[1] - lx * Math.sin(BB_ROT) + lz * Math.cos(BB_ROT));
    const F = S.fielders, P0 = Object.fromEntries(Object.entries(F).map(([k, m]) => [k, m.position.clone()])); let lastPitch = -1, hit = null, cheer = 0, outs = 1, balls = 0, strikes = 0, msg = '';
    const plays = ['strike', 'ball', 'hit', 'foul', 'strike', 'hit2', 'out'];
    const E = { title: '잠실야구장 · 6회말', lock: true,
      status() { return this.t < 34 ? `${msg || '⚾ 투수가 던져요'} · ${Math.ceil(34 - this.t)}초` : '경기 잘 봤어요!'; },
      tick(dt) {
        if (hg.bear) hg.bear.root.visible = false; const t = this.t, y0 = S.y0, pitchT = 4.6, k = Math.floor((t - 1) / pitchT), ph = (t - 1) - k * pitchT; if (t > 35) { A.finish(E); return; }
        const play = plays[Math.min(plays.length - 1, Math.max(0, k))];
        // 투구: 0 ~ 1.2 준비 · 1.2 ~ 1.65 공이 홈으로 · 1.65 스윙
        F.P.rotation.y = Math.PI + (ph < 1.2 ? Math.sin(ph * 2.6) * 0.5 : 0); S.bat.rotation.z = ph > 1.55 && ph < 1.9 && play !== 'ball' ? 0.9 - (ph - 1.55) * 9 : 0.9;
        if (k !== lastPitch && k >= 0) { lastPitch = k; hit = null; if (play.startsWith('hit')) { const a = play === 'hit' ? 0.5 : -0.35, d = play === 'hit' ? 70 : 105; hit = { from: new THREE.Vector3(0, y0 + 1, 0.5), to: new THREE.Vector3(Math.sin(a) * d, y0 + 0.2, Math.cos(a) * d), t0: 1.65, fld: play === 'hit' ? 'LF' : 'RF', hr: play === 'hit2' }; } }
        const B = S.ball; B.visible = ph > 1.2 && k >= 0;
        if (ph > 1.2 && ph < 1.65) { const q = (ph - 1.2) / 0.45; B.position.set(0, y0 + 1.6 - q * 0.6, 18 - q * 17.6); }
        else if (ph >= 1.65 && hit) { const q = clamp((ph - hit.t0) / 2.4, 0, 1); B.position.lerpVectors(hit.from, hit.to, q); B.position.y += Math.sin(q * Math.PI) * (hit.hr ? 34 : 18); const fm = F[hit.fld]; fm.position.lerp(new THREE.Vector3(hit.to.x * 0.92, y0 + 0.15, hit.to.z * 0.92), dt * 1.4 * (q < 1 ? 1 : 0)); S.batter.position.lerp(new THREE.Vector3(-19.4, y0 + 0.15, 19.4), dt * 0.9); if (q > 0.98 && !hit.done) { hit.done = true; cheer = 3; msg = hit.hr ? '🎉 홈런! 관중석이 들썩여요' : '안타! 1루로 달려요'; A.drum(0.7, 120, 0.3); } }
        else if (ph >= 1.65 && ph < 1.7 && !hit) { msg = play === 'ball' ? '볼' : play === 'foul' ? '파울!' : play === 'out' ? '삼진 아웃! 이닝 끝' : '스트라이크!'; }
        if (ph < 0.1 && k >= 0) { for (const [kk, m] of Object.entries(F)) if (kk !== 'P' && kk !== 'C') m.position.lerp(P0[kk], 0.5); if (!hit) S.batter.position.set(0.9, S.y0 + 0.15, 0.2); }
        // 응원: 관중이 들썩 (안타 · 홈런 때 크게)
        cheer = Math.max(0, cheer - dt); const amp = 0.05 + cheer * 0.12, arr = S.fans.instanceMatrix.array; for (let i = 0; i < S.fanPos.length; i += 1) { const fp = S.fanPos[i]; arr[i * 16 + 13] = fp[4][13] + Math.max(0, Math.sin(t * 6 + fp[3])) * amp; } S.fans.instanceMatrix.needsUpdate = true;
      },
      cam(camera, dt) { const pos = W2(-9, S.y0 + 15, -34), look = W2(0, S.y0 + 1, 34 + Math.sin(this.t * 0.2) * 4); if (S.ball.visible && this.t > 1 && S.ball.position.z > 30) look.lerp(W2(S.ball.position.x, S.ball.position.y, S.ball.position.z), 0.35); (this.cp ||= pos.clone()).lerp(pos, 1 - Math.exp(-dt * 3)); camera.position.copy(this.cp); (this.lk ||= look.clone()).lerp(look, 1 - Math.exp(-dt * 2)); camera.lookAt(this.lk); },
      end() { S.ball.visible = false; for (const [kk, m] of Object.entries(F)) m.position.copy(P0[kk]); S.batter.position.set(0.9, S.y0 + 0.15, 0.2); if (hg.bear) hg.bear.root.visible = bearVis ?? true; }, where() { return '잠실야구장 관중석'; } };
    return E;
  },
});
