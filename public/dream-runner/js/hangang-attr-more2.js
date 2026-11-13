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
