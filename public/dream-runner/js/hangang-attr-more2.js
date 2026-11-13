// 서울 명소 체험 2차 남은 다섯 곳 (8-18 2차 2-6 ~ 2-10 · 8-37 37-4): 국립중앙박물관 · DDP 밤 조명 · 코엑스 큰 서가 도서관 · 서울식물원 온실 · 잠실야구장
//   상표 · 실제 상호 없이 일반 이름. 실내(박물관 · 도서관)는 서울 밖 먼 곳에 짓고 카메라만 옮긴다. 바깥(DDP · 온실 · 야구장)은 제자리에
//   참고(보기 전용, 위키미디어 공용): 박물관 역사의 길 · 경천사지 십층석탑, DDP 밤, 큰 서가 도서관, 식물원 온실 안, 잠실야구장 밤 경기
import * as THREE from 'three';
import { registerAttraction, part, merge, vcMat, LL, colored, ATTR_SKIP } from './hangang-attractions.js';
import { cvTex, boxUV, partUV, mergeUV, plainBox, stoneTex, curvedRoof, crookedPine, hideTrees, jelly, rndS, clamp } from './hangang-attr-more.js';

const lit = (A, fn) => A.addLit(fn);
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
