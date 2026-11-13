// 서울 산책: 실시간 버스 · 지하철 타기 (8-20)
//   실제(hangang-transit.js) 버스가 정류장에 서 있으면 7m 안에서, 지하철은 역 안 · 출구 앞에서 그 역에 들어오는 실제 열차가 있으면 E 로 탄다
//   타면 좌석 고르기 → 그 자리 눈높이에서 창밖으로 지금 그 자리의 진짜 서울이 지나간다 (실내를 실제 탈 것 자리에 겹쳐 두고 바깥 껍데기는 숨김)
//   지하 구간은 실내를 땅 밑으로 내려 터널로 감싸고, 역에 서면 승강장. 안내 방송(실제 정류소 · 역 순서) · 하차벨(B) · 내리기(E)
//   실내 좌표: x 옆(+x = 왼쪽), y 위, z 앞(+z = 앞). 버스 문은 오른쪽(-x)
import * as THREE from 'three';
import { sound } from './music.js';

const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const norm = (s) => String(s || '').replace(/\(.*?\)/g, '').replace(/\s/g, '').replace(/역$/, '');
const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const BUS_COLOR = { 1: '#2a9fd8', 2: '#6fb92c', 3: '#3d5bab', 4: '#4fa83a', 5: '#f2b70a', 6: '#e0312a', 7: '#3d5bab', 8: '#e0312a', 0: '#8a8f99' };

// ---------- 소리: 카드 찍는 소리 · 안내 차임 · 하차벨 (작은 웹 오디오) · 안내 목소리(브라우저 말하기) ----------
let AC = null;
function beep(seq) { if (sound.muted) return; try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state !== 'running') AC.resume(); const t0 = AC.currentTime; for (const [f, t, d, type = 'sine', v = 0.12] of seq) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t0 + t); g.gain.linearRampToValueAtTime(v, t0 + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + d); o.connect(g); g.connect(AC.destination); o.start(t0 + t); o.stop(t0 + t + d + 0.05); } } catch { /* 소리 없음 */ } }
const SND = { card: [[1760, 0, 0.11, 'square', 0.06]], chime: [[880, 0, 0.5], [659, 0.32, 0.7]], bell: [[1318, 0, 0.35, 'triangle', 0.1], [1046, 0.18, 0.5, 'triangle', 0.1]], door: [[392, 0, 0.25, 'triangle', 0.08], [330, 0.2, 0.3, 'triangle', 0.08]], close: [[988, 0, 0.18, 'square', 0.05], [988, 0.3, 0.18, 'square', 0.05], [988, 0.6, 0.18, 'square', 0.05], [988, 0.9, 0.18, 'square', 0.05]] };
function say(text) { if (sound.muted || !window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.05; u.volume = 0.8; speechSynthesis.speak(u); } catch { /* 말하기 없음 */ } }

// ---------- 화면 ----------
const CSS = `
#rd-card{position:absolute;left:50%;bottom:176px;transform:translateX(-50%);display:flex;gap:12px;align-items:center;padding:9px 10px 9px 14px;border-radius:18px;background:rgba(14,20,36,.8);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);color:#fff;font-family:'Jua',sans-serif;z-index:6;transition:opacity .2s}
#rd-card.hidden{opacity:0;pointer-events:none}
#rd-card .ic{font-size:28px}
#rd-card b{font-size:16px;display:block}
#rd-card small{display:block;font-family:system-ui,sans-serif;font-size:12px;opacity:.85;margin-top:2px}
#rd-card button,#rd-seat button.go{border:0;border-radius:14px;padding:9px 13px;font-family:'Jua',sans-serif;font-size:15px;cursor:pointer;background:linear-gradient(180deg,#8fe08a,#4fbf5a);color:#0f3312;box-shadow:0 3px 0 #2f8a3a}
#rd-card button kbd{font-family:inherit;background:rgba(0,0,0,.14);border-radius:6px;padding:1px 6px;margin-left:6px;font-size:13px}
#rd-card button.bell{background:linear-gradient(180deg,#ff8a8a,#e0453a);color:#fff;box-shadow:0 3px 0 #a52a22}
/* 8-41-1: 운전실에선 계기판을 가리지 않게 위 안내판 아래 한 줄 띠로 */
#rd-card.cab{top:126px;bottom:auto;max-width:calc(100vw - 24px);gap:8px;padding:4px 5px 4px 10px;border-radius:12px}
#rd-card.cab .ic{font-size:16px}
#rd-card.cab>span:nth-child(2){min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#rd-card.cab b{display:inline;font-size:13px}
#rd-card.cab small{display:inline;margin:0 0 0 8px;font-size:11.5px}
#rd-card.cab button{padding:4px 9px;font-size:13px;border-radius:10px;box-shadow:0 2px 0 #2f8a3a;flex:none}
#rd-led{position:absolute;left:50%;top:62px;transform:translateX(-50%);min-width:300px;max-width:calc(100vw - 32px);padding:7px 16px;border-radius:10px;background:#0b0b0c;border:2px solid #2a2a2e;color:#ffae1a;font-family:'Jua',sans-serif;font-size:17px;text-align:center;letter-spacing:.5px;z-index:6;box-shadow:0 4px 18px rgba(0,0,0,.4)}
#rd-led.hidden{display:none}
#rd-led small{display:block;color:#7cd3ff;font-size:12.5px;margin-top:2px;font-family:system-ui,sans-serif}
#rd-led .stop{color:#ff5a4a}
#rd-seat{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(6,10,20,.5);backdrop-filter:blur(3px)}
#rd-seat.hidden{display:none}
#rd-seat .pg{width:min(560px,calc(100vw - 24px));border-radius:20px;padding:14px 16px;background:#f6f3ec;color:#2a2a2a;font-family:'Jua',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.35)}
#rd-seat h3{margin:0;font-size:20px}
#rd-seat .sub{font-family:system-ui,sans-serif;font-size:12.5px;opacity:.7;margin:2px 0 10px}
#rd-seat .map{position:relative;margin:0 auto;background:#d9dde2;border-radius:14px;border:3px solid #9aa1aa}
#rd-seat .s{position:absolute;border:0;border-radius:6px;cursor:pointer;font-size:11px;color:#fff;padding:0}
#rd-seat .s.taken{cursor:default;background:#8a8f99!important;opacity:.75}
#rd-seat .s.taken::after{content:'🐻';font-size:13px}
#rd-seat .s:not(.taken):hover{outline:3px solid #ffd23f}
#rd-seat .lab{position:absolute;font-family:system-ui,sans-serif;font-size:10.5px;color:#4a4f57}
#rd-seat .row{display:flex;gap:8px;justify-content:center;margin-top:12px}
#rd-seat .row button{border:0;border-radius:12px;padding:8px 12px;font-family:'Jua',sans-serif;font-size:14px;cursor:pointer;background:#e4e1d8}
`;
function ui() {
  if (document.getElementById('rd-card')) return; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const host = document.getElementById('hg-hud') || document.body, d = document.createElement('div');
  d.innerHTML = `<div id="rd-card" class="hidden"><span class="ic">🚌</span><span><b></b><small></small></span><button class="b2 bell hidden">🔔 하차벨 <kbd>B</kbd></button><button class="b1"></button></div><div id="rd-led" class="hidden"></div><div id="rd-seat" class="hidden"><div class="pg"><h3></h3><div class="sub">빈 자리를 누르면 앉아요 · 🐻 = 다른 승객</div><div class="map"></div><div class="row"><button class="stand">🧍 서서 손잡이 잡기</button><button class="auto">아무 데나</button><button class="cab go hidden">🧑‍✈️ 맨 앞 운전실 · 직접 운전</button></div></div></div>`;
  while (d.firstChild) host.appendChild(d.firstChild);
}

// ---------- 실내 만들기 ----------
function lamb(color, glow = 0) { const m = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: glow }); m.userData.glow = glow; return m; }
function box(g, w, h, d, m, x, y, z) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; }
function canvasTex(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return { cv, c: cv.getContext('2d'), t }; }
// 버스: 길이 11m · 폭 2.5m, 바닥 높이 0.45m (저상)
//   8-42-2: 마을버스(종류 2)는 길이 7.2m · 폭 2.06m 짧은 차 — 좌석 줄 · 문 · 기둥 자리를 차 길이에 맞춘다
function buildBus(type) {
  const mini = +type === 2, L = mini ? 7.2 : 11, W = mini ? 2.06 : 2.5, H = mini ? 2.15 : 2.3;
  const g = new THREE.Group(), F = 0.45, hw = W / 2 - 0.08, col = BUS_COLOR[type] || BUS_COLOR[3], mats = [];
  const M = (c, glow = 0.12) => { const m = lamb(c, glow); mats.push(m); return m; };
  const floorM = M('#4a4d52', 0.05), wallM = M('#e9e6df'), panelM = M(col, 0.1), ceilM = M('#f4f2ee', 0.2), seatM = M('#3c5a9a', 0.08), prioM = M('#e8a22c', 0.1), poleM = M('#f2c230', 0.15), steel = M('#c9ced4', 0.1), bellM = new THREE.MeshBasicMaterial({ color: '#ff3b30' }), lightM = new THREE.MeshBasicMaterial({ color: '#fffbea' }), darkM = M('#24272c', 0.02), frameM = M('#1c1f24', 0.02);
  // 유리: 살짝 푸른 빛 (밖이 잘 보이게 아주 옅게, 양면)
  const glassM = new THREE.MeshBasicMaterial({ color: '#9fc6d8', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  box(g, W - 0.16, 0.06, L - 0.3, floorM, 0, F - 0.03, 0);
  box(g, W - 0.16, 0.04, L - 0.3, ceilM, 0, F + H, 0);
  for (const zz of mini ? [-1.8, 1.2] : [-3, 0, 3]) box(g, 0.5, 0.03, mini ? 1.8 : 2.2, lightM, 0, F + H - 0.03, zz);
  // 옆벽: 창 아래 · 위, 창 사이 기둥. 오른쪽(-x)엔 앞문(z 4 ~ 5.1) · 뒷문(z -0.6 ~ 0.6) 자리를 비운다
  //   마을버스: 앞문은 같은 자리(앞바퀴 앞), 뒷문은 차 가운데보다 조금 뒤 · 좁게
  const fd = [L / 2 - 1.5, L / 2 - 0.4], rd = mini ? [-1.0, -0.05] : [-0.6, 0.6], doors = [fd, rd];
  for (const sx of [1, -1]) {
    const x = sx * hw, spans = sx < 0 ? [[-L / 2 + 0.2, rd[0]], [rd[1], fd[0]]] : [[-L / 2 + 0.2, L / 2 - 0.4]];
    // 창: 아래 벽(바닥 ~ 1m, 앉으면 어깨 높이) · 창틀(검은 고무) · 가운데 미닫이 틀 · 위 벽, 창 사이 기둥은 좌석 줄마다
    for (const [z0, z1] of spans) { const zc = (z0 + z1) / 2, w = z1 - z0; box(g, 0.06, 1.0, w, wallM, x, F + 0.5, zc); box(g, 0.1, 0.06, w, M('#9aa0a8', 0.1), x - sx * 0.03, F + 1.02, zc); box(g, 0.07, 0.12, w, panelM, x * 1.01, F + 0.95, zc); box(g, 0.06, 0.42, w, wallM, x, F + H - 0.21, zc); box(g, 0.08, 0.05, w, frameM, x, F + H - 0.43, zc); box(g, 0.07, 0.035, w, frameM, x, F + 1.55, zc);
      const n = Math.max(1, Math.round(w / 1.1)); for (let k = 0; k <= n; k++) box(g, 0.08, H - 1.0, 0.13, frameM, x, F + 1.0 + (H - 1.0) / 2, z0 + (w * k) / n);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.8), glassM); gl.position.set(x - sx * 0.005, F + 1.45, zc); gl.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(gl); }
  }
  // 문: 접히는 문짝 (서 있을 때 열림)
  const doorP = [];
  for (const [z0, z1] of doors) for (const k of [0, 1]) { const w = (z1 - z0) / 2, p = box(g, 0.05, H - 0.15, w - 0.04, M('#2b3038', 0.05), -hw, F + (H - 0.15) / 2, z0 + w * (k + 0.5)); p.userData.closedZ = p.position.z; p.userData.openZ = k ? z1 - 0.12 : z0 + 0.12; doorP.push(p); }
  // 앞: 계기판 · 운전석 · 핸들 · 요금 단말기, 위에 LED 안내판
  box(g, W - 0.2, 0.5, 0.6, darkM, 0, F + 0.65, L / 2 - 0.45);
  const dx = hw - 0.48, dz = L / 2 - 1.2, drv = { x: dx, y: F + 0.42, z: dz, face: 0 };
  box(g, 0.5, 0.08, 0.5, M('#2c2f35'), dx, F + 0.42, dz); box(g, 0.5, 0.6, 0.08, M('#2c2f35'), dx, F + 0.75, dz - 0.25);
  { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), darkM); wh.position.set(dx, F + 1.0, dz + 0.45); wh.rotation.x = -0.9; g.add(wh); }
  box(g, 0.16, 0.24, 0.1, M('#5a6068'), -hw + 0.62, F + 1.05, fd[0]); box(g, 0.12, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: '#47e07a' }), -hw + 0.62, F + 1.12, fd[0] - 0.06);
  box(g, 0.16, 0.24, 0.1, M('#5a6068'), -hw + 0.22, F + 1.05, rd[0] - 0.15); box(g, 0.12, 0.08, 0.02, new THREE.MeshBasicMaterial({ color: '#47e07a' }), -hw + 0.22, F + 1.12, rd[0] - 0.21);
  const led = canvasTex(512, 64); const ledM = new THREE.MeshBasicMaterial({ map: led.t, toneMapped: false }), ledP = new THREE.Mesh(new THREE.PlaneGeometry(mini ? 1.2 : 1.5, 0.19), ledM); ledP.position.set(0, F + H - 0.2, L / 2 - 0.75); ledP.rotation.y = Math.PI; g.add(ledP);
  box(g, mini ? 1.26 : 1.56, 0.25, 0.06, darkM, 0, F + H - 0.2, L / 2 - 0.72);
  { const ws = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.25, 1.4), glassM); ws.position.set(0, F + 1.6, L / 2 - 0.16); g.add(ws); box(g, 0.08, 1.5, 0.08, frameM, 0, F + 1.6, L / 2 - 0.17); for (const sx of [1, -1]) box(g, 0.12, H, 0.12, frameM, sx * (W / 2 - 0.12), F + H / 2, L / 2 - 0.2); }
  // 뒤벽 (뒤 창 아래 · 위)
  box(g, W - 0.16, 0.95, 0.05, wallM, 0, F + 0.47, -L / 2 + 0.18); box(g, W - 0.16, 0.4, 0.05, wallM, 0, F + H - 0.2, -L / 2 + 0.18);
  // 좌석 (앞을 본다): 왼쪽 2인 줄 · 오른쪽 1인 · 맨 뒤 5인 (뒤쪽은 한 칸 높게)
  const seats = [], seat = (x, z, prio, up = 0) => { const m = prio ? prioM : seatM; box(g, 0.44, 0.1, 0.44, m, x, F + 0.42 + up, z); box(g, 0.44, 0.72, 0.08, m, x, F + 0.8 + up, z - 0.24); box(g, 0.34, 0.035, 0.035, steel, x, F + 1.2 + up, z - 0.26); seats.push({ x, y: F + 0.42 + up, z, face: 0, prio, side: x > 0 ? 'L' : 'R' }); };
  const sxo = hw - 0.25, sxi = sxo - 0.46;
  if (!mini) {
    for (let i = 0; i < 9; i++) { const z = 3.4 - i * 0.82; if (z > -0.9 && z < 0.9) continue; for (const x of [0.92, 0.46]) seat(x, z, i < 2, z < -0.9 ? 0.18 : 0); }
    for (let i = 0; i < 6; i++) { const z = 3.0 - i * 0.82; if (z > -1.0 && z < 1.0) continue; seat(-0.92, z, false, z < -0.9 ? 0.18 : 0); }
    for (let k = 0; k < 5; k++) seat(-0.92 + k * 0.46, -L / 2 + 0.6, false, 0.3);
  } else {
    // 마을버스: 왼쪽 2인 4줄(앞 1줄 노약자석, 뒷바퀴 위 둘은 한 칸 높게) · 오른쪽 1인은 앞문 ~ 뒷문 사이 1개 · 뒷문 뒤 1개 · 맨 뒤 4인
    for (let i = 0; i < 4; i++) { const z = 1.75 - i * 0.84; for (const x of [sxo, sxi]) seat(x, z, i < 1, z < -0.6 ? 0.18 : 0); }
    for (const z of [1.15, -1.8]) seat(-sxo, z, z > 0, z < -0.6 ? 0.18 : 0);
    for (let k = 0; k < 4; k++) seat(-0.69 + k * 0.46, -L / 2 + 0.6, false, 0.3);
  }
  // 기둥 · 천장 봉 · 손잡이 · 하차벨
  const bells = [];
  for (const [x, z] of mini ? [[-hw + 0.42, fd[0] - 0.1], [-hw + 0.42, rd[1] + 0.12], [-hw + 0.42, rd[0] - 0.12], [sxi - 0.24, 0.5], [sxi - 0.24, -1.6]] : [[-0.75, 3.9], [-0.75, 0.75], [-0.75, -0.75], [0.25, 2.2], [0.25, -1.6], [-0.4, -2.6]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, H, 8), poleM); p.position.set(x, F + H / 2, z); g.add(p); bells.push(box(g, 0.07, 0.09, 0.05, bellM, x, F + 1.3, z + 0.04)); }
  for (const x of mini ? [0.08, -0.4] : [0.22, -0.42]) { box(g, 0.03, 0.03, L - 1.8, steel, x, F + H - 0.18, -0.3); for (let z = -L / 2 + 1.1; z < L / 2 - 1.9; z += 0.5) { box(g, 0.02, 0.2, 0.02, M('#e8e8e8'), x, F + H - 0.3, z); const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 12), M('#f2c230')); r.position.set(x, F + H - 0.46, z); g.add(r); } }
  for (let z = -L / 2 + 1.3; z < L / 2 - 1.9; z += 1.45) bells.push(box(g, 0.04, 0.06, 0.08, bellM, hw - 0.05, F + 1.15, z));
  const stand = mini ? [{ x: -0.15, y: F, z: 0.7, face: 0, stand: true }, { x: -0.15, y: F, z: -1.3, face: 0, stand: true }] : [{ x: -0.1, y: F, z: 1.6, face: 0, stand: true }, { x: -0.1, y: F, z: -1.9, face: 0, stand: true }];
  // 자리 고르기 그림의 글씨 자리
  const labs = [['운전석', dx, dz + 0.45], ['앞문', -hw + 0.13, (fd[0] + fd[1]) / 2], ['뒷문', -hw + 0.13, (rd[0] + rd[1]) / 2]];
  return { g, kind: 'bus', seats, stand, mats, doorP, led, bells, F, L, W, drv, labs };
}
// 지하철 한 칸: 길이 19.5m · 폭 3.1m, 바닥은 레일 위 1.1m
function buildCar(line, L0) {
  const g = new THREE.Group(), L = 19.5, hw = 1.45, F = 1.1, H = 2.2, col = L0.color, mats = [];
  const M = (c, glow = 0.15) => { const m = lamb(c, glow); mats.push(m); return m; };
  const floorM = M('#8f949b', 0.06), wallM = M('#ecebe6'), ceilM = M('#f6f5f2', 0.25), seatM = M({ '1호선': '#4a5fb5', '2호선': '#3f8f55', '3호선': '#d77a2a', '4호선': '#3a8fc4', '5호선': '#8a5fa8', '6호선': '#b0752e', '7호선': '#6b7a1a', '8호선': '#c9356f', '9호선': '#9a8a5a' }[line] || '#4f5fa8', 0.08), prioM = M('#e98a2a', 0.1), pinkM = M('#f29bb8', 0.12), steel = M('#d0d5da', 0.15), lightM = new THREE.MeshBasicMaterial({ color: '#fffdf4' }), doorM = M('#cfd3d8', 0.1), bandM = M(col, 0.15);
  box(g, hw * 2, 0.06, L, floorM, 0, F - 0.03, 0); box(g, hw * 2, 0.04, L, ceilM, 0, F + H, 0);
  for (const sx of [-0.55, 0.55]) box(g, 0.28, 0.03, L - 1, lightM, sx, F + H - 0.03, 0);
  const DZ = [-7.3, -2.45, 2.45, 7.3], DW = 1.3, seats = [];
  for (const sx of [1, -1]) {
    const x = sx * hw;
    // 벽 조각: 문과 문 사이 (창 아래 · 창 위 · 띠), 문 자리는 문짝 (위쪽 창은 열려 있어 밖이 보임)
    const cuts = [-L / 2, ...DZ.flatMap((z) => [z - DW / 2, z + DW / 2]), L / 2];
    for (let i = 0; i < cuts.length; i += 2) { const z0 = cuts[i], z1 = cuts[i + 1], zc = (z0 + z1) / 2, w = z1 - z0; box(g, 0.05, 0.85, w, wallM, x, F + 0.42, zc); box(g, 0.05, 0.45, w, wallM, x, F + H - 0.22, zc); box(g, 0.06, 0.06, w, bandM, x * 0.995, F + 0.86, zc); for (let z = z0; z < z1; z += 2.2) box(g, 0.07, 0.95, 0.12, M('#b9bec4'), x, F + 1.3, z + 0.06); }
    for (const z of DZ) { for (const k of [-1, 1]) { box(g, 0.05, 0.9, DW / 2 - 0.02, doorM, x, F + 0.45, z + k * DW / 4); box(g, 0.05, 0.42, DW / 2 - 0.02, doorM, x, F + H - 0.21, z + k * DW / 4); box(g, 0.06, 0.95, 0.06, doorM, x, F + 1.35, z + k * (DW / 2 - 0.03)); } box(g, 0.06, 0.06, DW, bandM, x * 0.99, F + H - 0.02, z); }
    // 긴 의자: 문 사이 7인 (한쪽 끝은 임산부석), 맨 끝 노약자석 3인 (안쪽을 본다)
    const face = sx > 0 ? -Math.PI / 2 : Math.PI / 2, bench = (z0, z1, n, mFor) => { const sw = (z1 - z0) / n; for (let k = 0; k < n; k++) { const z = z0 + sw * (k + 0.5), m = mFor(k); box(g, 0.48, 0.1, sw - 0.03, m, x - sx * 0.3, F + 0.44, z); box(g, 0.08, 0.5, sw - 0.03, m, x - sx * 0.06, F + 0.72, z); seats.push({ x: x - sx * 0.3, y: F + 0.44, z, face, prio: m === prioM, pink: m === pinkM, side: sx > 0 ? 'L' : 'R' }); } };
    for (let i = 0; i < 3; i++) { const z0 = DZ[i] + DW / 2 + 0.25, z1 = DZ[i + 1] - DW / 2 - 0.25; bench(z0, z1, 7, (k) => (k === 6 && i === 1 ? pinkM : seatM)); }
    bench(-L / 2 + 0.3, DZ[0] - DW / 2 - 0.25, 3, () => prioM); bench(DZ[3] + DW / 2 + 0.25, L / 2 - 0.3, 3, () => prioM);
    // 손잡이 봉 · 고리 · 문 옆 기둥
    box(g, 0.03, 0.03, L - 1, steel, sx * 0.95, F + 1.95, 0); for (let z = -L / 2 + 0.6; z < L / 2 - 0.5; z += 0.45) { if (DZ.some((d) => Math.abs(d - z) < 0.75)) continue; box(g, 0.02, 0.22, 0.02, M('#f0f0f0'), sx * 0.95, F + 1.83, z); const r = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 5, 12), sx > 0 ? steel : M('#f2c230')); r.position.set(sx * 0.95, F + 1.66, z); r.rotation.y = Math.PI / 2; g.add(r); }
    for (const z of DZ) for (const k of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, H, 8), steel); p.position.set(sx * 1.05, F + H / 2, z + k * (DW / 2 + 0.2)); g.add(p); }
  }
  // 노선도 (창 위, 양쪽) · 문 위 안내 화면 · 끝 통로문
  const map = canvasTex(2048, 64), mapM = new THREE.MeshBasicMaterial({ map: map.t, toneMapped: false });
  for (const sx of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(L - 3, 0.26), mapM); p.position.set(sx * (hw - 0.04), F + 2.02, 0); p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(p); }
  const scr = canvasTex(512, 96), scrM = new THREE.MeshBasicMaterial({ map: scr.t, toneMapped: false });
  for (const sx of [1, -1]) for (const z of DZ) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.15), scrM); p.position.set(sx * (hw - 0.05), F + H - 0.12, z); p.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(p); }
  for (const ez of [-1, 1]) { box(g, hw * 2, H, 0.06, wallM, 0, F + H / 2, ez * L / 2); box(g, 0.8, 1.9, 0.07, doorM, 0, F + 0.95, ez * (L / 2 - 0.01)); box(g, 0.5, 0.7, 0.08, M('#3a4048', 0.05), 0, F + 1.35, ez * (L / 2 - 0.02)); }
  // 서는 자리: 통로 가운데에서 창 쪽을 본다 (손잡이 고리는 머리 위 옆)
  const stand = [{ x: -0.05, y: F, z: -4.9, face: Math.PI / 2, stand: true }, { x: 0.05, y: F, z: 4.9, face: -Math.PI / 2, stand: true }, { x: 0, y: F, z: 0.3, face: Math.PI / 2, stand: true }];
  return { g, kind: 'train', seats, stand, mats, map, scr, F, L, line };
}
// 터널 (땅 밑 구간): 짙은 콘크리트 통 + 지나가는 불빛, 역에 가까우면 승강장 (스크린도어 · 역 이름판)
function buildTunnel() {
  const g = new THREE.Group(), t = canvasTex(256, 512), c = t.c;
  c.fillStyle = '#26282c'; c.fillRect(0, 0, 256, 512); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.05)`; c.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); }
  c.fillStyle = '#3b3e44'; for (const y of [40, 52, 64]) c.fillRect(0, y, 256, 4);
  c.fillStyle = '#ffe9b0'; c.fillRect(110, 0, 36, 22); t.t.wrapS = t.t.wrapT = THREE.RepeatWrapping; t.t.repeat.set(1, 6);
  const m = new THREE.MeshBasicMaterial({ map: t.t, side: THREE.BackSide }), tube = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6, 160), m); tube.position.y = 2.6; g.add(tube);
  return { g, tex: t.t };
}
// 승강장 (8-41-2): 오른쪽(-x) 폭 6m · 길이 120m, 높이는 열차 바닥과 같게. 그리기를 줄이려고 되풀이되는 것은 인스턴스
//   스크린도어: 열차 문 자리(칸마다 4개)마다 미닫이 두 짝 + 사이 고정 유리, 열차가 서서 문이 열리면 양옆으로 열린다
//   지하: 타일 벽 · 천장 / 지상 · 고가: 벽 없이 지붕 · 기둥 · 낮은 유리 난간 (서울 고가역처럼)
const PSD_N = 32;
function cpart(w, h, d, x, y, z, col) { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); const cc = new THREE.Color(col), n = b.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) cc.toArray(a, i * 3); b.setAttribute('color', new THREE.BufferAttribute(a, 3)); b.deleteAttribute('uv'); return b.toNonIndexed(); }
function buildPlatform() {
  const g = new THREE.Group(), name = canvasTex(512, 128), nameM = new THREE.MeshBasicMaterial({ map: name.t, toneMapped: false }), mats = [];
  const LM = (c, e) => { const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e }); m.userData.glow = e; mats.push(m); return m; };
  const tile = LM('#d9d4c8', 0.45), floorM = LM('#b8b2a6', 0.35), frame = LM('#8d949c', 0.3), roofM = LM('#e4e2dc', 0.3), yellow = LM('#f2c230', 0.35), lightM = new THREE.MeshBasicMaterial({ color: '#fffbea' });
  const glass = new THREE.MeshBasicMaterial({ color: '#a8c8d8', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }), leafM = new THREE.MeshBasicMaterial({ color: '#8fc3d2', transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  box(g, 6, 1.1, 120, floorM, -4.7, 0.55, 0); box(g, 0.32, 0.015, 120, yellow, -2.15, 1.105, 0);
  const wall = box(g, 0.3, 6, 120, tile, -7.8, 3, 0); box(g, 6.5, 0.2, 120, roofM, -4.7, 5.0, 0);
  const inst = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; g.add(m); return m; };
  const o3 = new THREE.Object3D(), put = (m, x, y, z, sx = 1, sy = 1, sz = 1) => { o3.position.set(x, y, z); o3.rotation.set(0, 0, 0); o3.scale.set(sx, sy, sz); o3.updateMatrix(); m.setMatrixAt(m.count++, o3.matrix); };
  // 천장 등 · 뒤 기둥(지붕을 받친다) · 뒤 유리 난간
  const lights = inst(new THREE.BoxGeometry(1.2, 0.05, 3), lightM, 20); for (let z = -55; z <= 55; z += 6) put(lights, -4.7, 4.88, z);
  const cols = inst(new THREE.BoxGeometry(0.35, 3.9, 0.35), frame, 13); for (let z = -60; z <= 60; z += 10) put(cols, -7.45, 3.05, z);
  box(g, 0.04, 1.0, 120, glass, -7.65, 1.6, 0); box(g, 0.08, 0.06, 120, frame, -7.65, 2.12, 0);
  for (const z of [-30, 0, 30]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), nameM); p.position.set(-7.26, 3.0, z); p.rotation.y = Math.PI / 2; g.add(p); }
  // 스크린도어: 위 머리(안내 띠) · 기둥 · 고정 유리 · 문짝(유리 + 틀)
  box(g, 0.14, 0.36, 120, frame, -1.75, 3.33, 0);
  const posts = inst(new THREE.BoxGeometry(0.1, 2.05, 0.12), frame, PSD_N * 2 + 2), fixedG = new THREE.PlaneGeometry(1, 1.95); fixedG.rotateY(Math.PI / 2); const fixed = inst(fixedG, glass, PSD_N + 1);
  const leafG = new THREE.BoxGeometry(0.03, 1.92, 0.96), leaf = inst(leafG, leafM, PSD_N * 2);
  const lfG = mergeGeoms([cpart(0.05, 1.98, 0.06, 0, 0, -0.47, '#6f777f'), cpart(0.05, 1.98, 0.06, 0, 0, 0.47, '#6f777f'), cpart(0.05, 0.07, 0.98, 0, 0.96, 0, '#6f777f'), cpart(0.05, 0.12, 0.98, 0, -0.93, 0, '#7d848c'), cpart(0.055, 0.1, 0.9, 0, 0.25, 0, '#2f9f5a')]);
  const leafF = inst(lfG, LM('#ffffff', 0.25), PSD_N * 2); leafF.material.vertexColors = true;
  const P = { g, name, wall, mats, doors: [], open: 0, flip: false };
  // 문 자리(승강장 기준 z, 문 가운데) → 고정 유리 · 기둥 · 문짝 자리
  P.lay = (doors) => {
    P.doors = doors.slice(0, PSD_N); posts.count = fixed.count = 0; let z0 = -60;
    for (const zc of [...P.doors, 61]) { const z1 = zc - 1.0; if (z1 - z0 > 0.05) { put(fixed, -1.8, 2.15, (z0 + z1) / 2, z1 - z0); } if (zc < 61) { put(posts, -1.75, 2.13, zc - 1.0); put(posts, -1.75, 2.13, zc + 1.0); } z0 = zc + 1.0; }
    for (const m of [posts, fixed]) m.instanceMatrix.needsUpdate = true; P.setOpen(P.open, true);
  };
  P.setOpen = (a, force = false) => { if (!force && Math.abs(a - P.open) < 1e-3) return; P.open = a; leaf.count = leafF.count = 0; const k = 0.5 + 0.92 * a * a * (3 - 2 * a); for (const zc of P.doors) for (const sg of [-1, 1]) { put(leaf, -1.69, 2.15, zc + sg * k); put(leafF, -1.69, 2.15, zc + sg * k); } leaf.instanceMatrix.needsUpdate = leafF.instanceMatrix.needsUpdate = true; };
  P.lay([]);
  return P;
}

// ---------- 지하철 운전실 (8-40-2) ----------
//   맨 앞 칸 앞머리: 앞 유리(가운데 기둥) · 옆 창 · 운전대(계기판 그림 · 주간제어기 손잡이) · 운전석 · 뒤 칸막이
//   좌표는 열차 맨 앞 끝이 0, 뒤로 -z. 바닥은 레일 위 1.1m (객실과 같다)
function buildCab(color) {
  const g = new THREE.Group(), F = 1.1, W = 2.9, hw = W / 2, H = 2.15, LEN = 3.4, mats = [];
  const M = (c, glow = 0.12) => { const m = lamb(c, glow); mats.push(m); return m; };
  const body = M('#e4e6e8'), dark = M('#2a2e34', 0.04), desk = M('#3a4048', 0.06), frame = M('#1c1f24', 0.02), band = M(color, 0.2), floorM = M('#6f747b', 0.05), ceilM = M('#eeeeea', 0.2), seatM = M('#4a5160', 0.06), red = M('#c8302a', 0.15), steel = M('#c9ced4', 0.12);
  const glass = new THREE.MeshBasicMaterial({ color: '#a9cfe0', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  box(g, W, 0.06, LEN, floorM, 0, F - 0.03, -LEN / 2); box(g, W, 0.05, LEN, ceilM, 0, F + H, -LEN / 2);
  box(g, 0.5, 0.03, 1.2, new THREE.MeshBasicMaterial({ color: '#fff6e0' }), 0, F + H - 0.03, -2.2);
  // 옆벽: 창 아래 · 위, 옆 창(유리), 창틀
  for (const sx of [1, -1]) { const x = sx * hw; box(g, 0.06, 0.95, LEN, body, x, F + 0.47, -LEN / 2); box(g, 0.065, 0.12, LEN, band, x * 1.002, F + 0.9, -LEN / 2); box(g, 0.06, 0.4, LEN, body, x, F + H - 0.2, -LEN / 2); box(g, 0.08, 1.0, 0.1, frame, x, F + 1.45, -1.6); box(g, 0.08, 1.0, 0.1, frame, x, F + 1.45, -LEN + 0.05); const gl = new THREE.Mesh(new THREE.PlaneGeometry(LEN - 0.2, 0.85), glass); gl.position.set(x * 0.99, F + 1.45, -LEN / 2); gl.rotation.y = Math.PI / 2; g.add(gl); }
  // 앞: 아래 코(노선 색 띠) · 앞 유리 (가운데 비상문 기둥) · 위 행선 안내판 자리
  box(g, W, 0.95, 0.08, body, 0, F + 0.47, -0.04); box(g, W + 0.01, 0.16, 0.085, band, 0, F + 0.78, -0.035);
  box(g, W, 0.2, 0.08, frame, 0, F + H - 0.1, -0.04);
  // 앞 유리 틀: 양끝 · 왼쪽 비상문 틀 (운전석은 오른쪽이라 앞이 트여 있다)
  for (const x of [-hw + 0.06, -0.45, hw - 0.06]) box(g, x === -0.45 ? 0.07 : 0.14, 0.92, 0.09, frame, x, F + 1.42, -0.05);
  { const ws = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 0.9), glass); ws.position.set(0, F + 1.42, -0.06); g.add(ws); }
  // 운전대: 비스듬한 책상 · 계기판 그림 · 손잡이
  { const d = box(g, W - 0.2, 0.08, 0.7, desk, 0, F + 0.98, -0.42); d.rotation.x = 0.28; box(g, W - 0.2, 0.86, 0.5, dark, 0, F + 0.47, -0.36); }
  const gauge = canvasTex(512, 256), gM = new THREE.MeshBasicMaterial({ map: gauge.t, toneMapped: false }), gp = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), gM); gp.position.set(0.35, F + 1.03, -0.3); gp.rotation.set(-1.15, Math.PI, 0, 'YXZ'); g.add(gp);
  const lever = new THREE.Group(); { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 6), steel); st.position.y = 0.075; lever.add(st); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), red); kn.position.y = 0.16; lever.add(kn); } lever.position.set(-0.2, F + 1.0, -0.4); g.add(lever);
  box(g, 0.08, 0.04, 0.18, dark, -0.2, F + 1.0, -0.4);
  // 운전석 · 뒤 칸막이 (가운데 문, 작은 창)
  box(g, 0.5, 0.1, 0.48, seatM, 0.4, F + 0.5, -1.25); box(g, 0.5, 0.6, 0.08, seatM, 0.4, F + 0.85, -1.5); box(g, 0.08, 0.45, 0.08, steel, 0.4, F + 0.25, -1.25);
  box(g, W, H, 0.06, body, 0, F + H / 2, -LEN); box(g, 0.75, 1.9, 0.07, M('#cfd3d8', 0.1), 0, F + 0.95, -LEN + 0.02); box(g, 0.45, 0.5, 0.075, frame, 0, F + 1.4, -LEN + 0.03);
  // 바깥 앞: 전조등 두 개 · 밤엔 선로 앞으로 퍼지는 불빛
  const headM = new THREE.MeshBasicMaterial({ color: '#fff4d6' }); for (const sx of [-1, 1]) box(g, 0.3, 0.12, 0.04, headM, sx * 0.95, F + 0.55, 0.01);
  const bc = canvasTex(64, 256); { const c = bc.c; for (let y = 0; y < 256; y++) { const t = y / 256, w = 64 * (0.3 + 0.7 * t), a = Math.pow(1 - t, 1.5) * Math.min(1, t * 8); const gr = c.createLinearGradient((64 - w) / 2, 0, (64 + w) / 2, 0); gr.addColorStop(0, 'rgba(255,240,210,0)'); gr.addColorStop(0.5, `rgba(255,240,210,${a})`); gr.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = gr; c.fillRect(0, 255 - y, 64, 1); } }
  const beamM = new THREE.MeshBasicMaterial({ map: bc.t, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), beam = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 46), beamM); beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.3, 23); g.add(beam);
  return { g, mats, gauge, lever, beamM, F };
}
// 운전실 계기판: 속도계(바늘 · 숫자) · 방향 · 다음 역 · 남은 거리 · 문 표시
function drawCab(G, o) {
  const { c, t } = G; c.fillStyle = '#0d1014'; c.fillRect(0, 0, 512, 256);
  const cx = 128, cy = 140, R = 96, max = 100, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, ang = a0 + (a1 - a0) * Math.min(1, o.kmh / max);
  c.strokeStyle = '#2a3440'; c.lineWidth = 14; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
  c.strokeStyle = o.kmh > 80 ? '#ff5a4a' : '#5ad0ff'; c.beginPath(); c.arc(cx, cy, R, a0, ang); c.stroke();
  c.fillStyle = '#9fb0c0'; c.font = '16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let k = 0; k <= max; k += 20) { const a = a0 + (a1 - a0) * (k / max); c.fillText(String(k), cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); }
  c.strokeStyle = '#ff4a3a'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * (R - 8), cy + Math.sin(ang) * (R - 8)); c.stroke();
  c.fillStyle = '#ffffff'; c.font = 'bold 40px sans-serif'; c.fillText(String(Math.round(o.kmh)), cx, cy + 46); c.font = '14px sans-serif'; c.fillStyle = '#9fb0c0'; c.fillText('km/h', cx, cy + 74);
  c.textAlign = 'left'; c.fillStyle = o.color; c.fillRect(262, 22, 230, 30); c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.fillText(`${o.line} 운전`, 272, 38);
  c.fillStyle = '#ffd25a'; c.font = 'bold 22px sans-serif'; c.fillText(o.dir > 0 ? '▲ 전진' : '▼ 후진', 272, 82);
  c.fillStyle = '#ffffff'; c.font = 'bold 26px sans-serif'; c.fillText(`다음 ${o.next || '-'}`, 272, 124, 230);
  c.fillStyle = '#7cd3ff'; c.font = '22px sans-serif'; c.fillText(o.dist != null ? `${o.dist < 1000 ? Math.round(o.dist) + ' m' : (o.dist / 1000).toFixed(1) + ' km'}` : '', 272, 160);
  c.fillStyle = o.doors ? '#47e07a' : '#3a4048'; c.beginPath(); c.arc(286, 210, 12, 0, 7); c.fill(); c.fillStyle = o.doors ? '#47e07a' : '#8a96a2'; c.font = 'bold 20px sans-serif'; c.fillText(o.doors ? '문 열림' : '문 닫힘', 306, 211);
  t.needsUpdate = true;
}

// ---------- 운전실 앞 선로 (8-41-1) ----------
//   다리 · 고가 위는 회색 바닥뿐이라, 운전실에서 보이는 앞 300m 에만 자갈 도상 · 콘크리트 침목 · 레일 두 줄 (땅 위 구간도, 땅 밑은 터널이 따로)
//   인스턴스 3개(그리기 3번): 도상 · 레일은 4m 조각, 침목은 60cm 마다
const RAIL_N = 90, SLP_N = 1400;
function buildCabRails() {
  const g = new THREE.Group();
  // 자갈: 회갈색 잔돌 무늬 (조각마다 반복)
  const t = canvasTex(128, 128), c = t.c; c.fillStyle = '#7d776d'; c.fillRect(0, 0, 128, 128);
  const r = rnd(41); for (let i = 0; i < 1400; i++) { const v = 70 + ((r() * 100) | 0), w = 2 + r() * 3; c.fillStyle = `rgb(${v + 6},${v},${v - 10})`; c.beginPath(); c.ellipse(r() * 128, r() * 128, w, w * (0.6 + r() * 0.4), r() * 3, 0, 7); c.fill(); }
  t.t.wrapS = t.t.wrapT = THREE.RepeatWrapping;
  // 도상: 위 2.9m · 아래 3.5m 사다리꼴, 위가 0, z 0~1
  const bedG = new THREE.BoxGeometry(3.2, 0.34, 1); bedG.translate(0, -0.17, 0.5); { const P = bedG.attributes.position, U = bedG.attributes.uv; for (let i = 0; i < P.count; i++) { P.setX(i, P.getX(i) * (P.getY(i) < -0.1 ? 1.1 : 0.9)); U.setXY(i, U.getX(i) * 2, U.getY(i) * 3); } }
  const bedM = new THREE.MeshLambertMaterial({ map: t.t, color: '#ffffff' });
  // 침목: 콘크리트 (2.4m × 0.24m, 두께 0.15)
  const slpG = new THREE.BoxGeometry(2.4, 0.15, 0.24), slpM = new THREE.MeshLambertMaterial({ color: '#b3aea4' });
  // 레일: 아래 녹슨 몸통 + 위 반짝이는 머리 (꼭짓점 색으로 한 덩어리), z 0~1
  const part = (w, h, y, col) => { const b = new THREE.BoxGeometry(w, h, 1); b.translate(0, y, 0.5); const cc = new THREE.Color(col), n = b.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) cc.toArray(a, i * 3); b.setAttribute('color', new THREE.BufferAttribute(a, 3)); b.deleteAttribute('uv'); return b.toNonIndexed(); };
  const one = (x) => [part(0.14, 0.03, 0.015, '#4a3d33'), part(0.04, 0.11, 0.085, '#5d4a3c'), part(0.075, 0.04, 0.16, '#c7ccd2')].map((q) => q.translate(x, 0, 0));
  const railG = mergeGeoms([...one(-0.7175), ...one(0.7175)]), railM = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bed = new THREE.InstancedMesh(bedG, bedM, RAIL_N * 2), slp = new THREE.InstancedMesh(slpG, slpM, SLP_N), rail = new THREE.InstancedMesh(railG, railM, RAIL_N * 2);
  for (const m of [bed, slp, rail]) { m.frustumCulled = false; m.count = 0; m.userData.noDrape = true; g.add(m); }
  g.userData.noDrape = true; return { g, bed, slp, rail, mats: [bedM, slpM, railM] };
}
// 꼭짓점 색 상자 여러 개 → 하나 (BufferGeometryUtils 없이: 모두 색 · 위치 · 법선만)
function mergeGeoms(list) {
  const pos = [], nor = [], col = []; for (const q of list) { pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); col.push(...q.attributes.color.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
}

export class LiveRide {
  constructor(hg) { this.hg = hg; this.on = null; this.cand = null; this.t = 0; this.cache = new Map(); ui(); this.wire(); }
  wire() {
    const $ = (id) => document.getElementById(id);
    this.el = { card: $('rd-card'), led: $('rd-led'), seat: $('rd-seat') };
    this.el.card.querySelector('.b1').onclick = () => this.act(); this.el.card.querySelector('.b2').onclick = () => this.bell();
    this.el.seat.querySelector('.stand').onclick = () => this.sit(this.on?.I.stand[0]); this.el.seat.querySelector('.auto').onclick = () => this.sit(this.freeSeat());
    this.el.seat.querySelector('.cab').onclick = () => this.cabOn();
    // 운전실: R = 앞 · 뒤 바꾸기 (선 채로만)
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyR' && !e.repeat && this.on?.cab) this.cabFlip(); });
  }
  get lock() { return !!this.on; }
  // 운전실에선 W/S(휴대폰 조이스틱 세로)를 가속 · 제동으로 쓴다 → 잠그기 전 입력을 기억해 둔다
  lockInput(inp) { this.rawIn = inp; return { ...inp, mx: 0, mz: 0, lat: 0, jump: false, jumpHeld: false, slide: false }; }
  // ---------- 탈 수 있는 것 찾기 ----------
  findCand() {
    const hg = this.hg, L = hg.live; if (!L || hg.drive?.on) return null; let best = null;
    if (!hg.inside && !hg.inShop && !hg.inMall) for (const o of L.buses.values()) { if (!o.mesh || !o.L || o.hijack) continue; const d = Math.hypot(o.x - hg.px, o.z - hg.pz), still = (o.cur ?? 0) < 0.4; if (d < 7 && still && (!best || d < best.d)) best = { kind: 'bus', o, d }; }
    if (best || !L.sub) return best;
    // 지하철: 역 안이거나 출구 8m 안 → 그 역에 진입 · 도착한 실제 열차
    // 역 안이면 승강장 층(땅 높이)에 있을 때만
    let stName = hg.inside && hg.y < 1.5 ? hg.inside.st?.name : null;
    // 땅 위 출구에선 바로 타지 않는다: E = 역으로 내려가기 (승강장까지 걸어가 들어오는 열차를 보고 탄다)
    if (!hg.inside && !hg.inShop && !hg.inMall && hg.nearSt) { const [n] = hg.nearSt.split(':'); const e = (hg.entrances || []).filter((q) => q.st.name === n).sort((a, b) => Math.hypot(a.x - hg.px, a.z - hg.pz) - Math.hypot(b.x - hg.px, b.z - hg.pz))[0]; if (e && Math.hypot(e.x - hg.px, e.z - hg.pz) < 7) return { kind: 'exit', e }; }
    if (!stName) return null;
    for (const o of L.trains.values()) { const Ln = L.sub.lines[o.line]; if (!Ln) continue; const k = L.stKey(Ln, stName); if (!k) continue;
      // 역에 선 열차는 다음 구간 맨 앞(o.e.a = 이 역, d ≈ 0)으로 넘어가 있을 때도 있다
      const atA = o.e.a === k && o.d < 3; if ((o.e.b !== k && !atA) || (!atA && o.e.len - o.d > 40) || (o.v || 0) > 2) continue;
      // 역 안에선 내가 서 있는 승강장의 호선만
      // 문이 닫히는 중(2초 안 남음)이면 못 탄다
      if (o.dwellAt && (o.dwellMax || 20) - (performance.now() / 1000 - o.dwellAt) < 2) continue;
      if (hg.inside?.S?.plats) { const S = hg.inside.S, myLi = S.plats.reduce((b, p, i) => (Math.abs(p.pz - hg.pz) < Math.abs(S.plats[b].pz - hg.pz) ? i : b), 0); if (S.lineIndex(o.line) !== myLi) continue; } const pri = o.dwellAt ? 0 : 1; if (!best || pri < best.pri) best = { kind: 'train', o, st: stName, pri, key: k }; }
    return best;
  }
  // 역 안: 그 역에 들어오는 실제 열차를 승강장 열차로 (진입 · 정차하며 스크린도어 열림, 들어올 때 안내 차임)
  platformTrains() {
    const hg = this.hg, S = hg.inside?.S, L = hg.live; if (!S?.liveArrive) return;
    // 출발 5초 전: 곰이 그 승강장에 있으면 '출입문 닫습니다' 방송 (문 위 경고등은 hangang-station.js 가 깜빡인다)
    for (const p of S.plats || []) for (const T of p.trains) if (T.phase === 'stop' && T.t < 5 && T.t > 0.5 && !T.closeSaid && S.onPlat?.(p)) { T.closeSaid = true; beep(SND.close); say('출입문 닫습니다. 출입문 닫습니다.'); }
    if (!L?.sub) return; S.live = L.subOK; this.arrSeen ||= new Set(); const now = performance.now() / 1000;
    for (const o of L.trains.values()) { const Ln = L.sub.lines[o.line]; if (!Ln) continue; const k = L.stKey(Ln, hg.inside.st.name); if (!k) continue;
      // 역에 선 열차는 다음 구간 맨 앞(o.e.a = 이 역)으로 넘어가 있을 때도 있다 (그때 놓쳐서 문이 먼저 닫혔다)
      const atA = o.e.a === k && o.d < 3 && (o.dwellAt || o.dweltE === o.e); if (o.e.b !== k && !atA) continue;
      const li = S.lineIndex(o.line), sd = o.up ? 1 : -1, rem = atA ? 0 : o.e.len - o.d; if (li < 0) continue;
      // 곰이 그 호선 승강장에 있으면 문을 더 열어 둔다 (실제 20초 → 최대 40초). 떠나면 4초 뒤 닫는다
      // 승강장 열차는 실제 열차가 60m 안에 오면 들어온다 (실제 열차는 역 앞에서 천천히 다가와, 300m 에서 들이면 문이 먼저 닫혔다)
      // 곰이 기다리는 승강장에 들어온 열차는 꼭 선다 (실시간 자료에 '도착'이 빠져 그냥 지나가던 때가 있었다)
      if (!o.dwellAt && o.dweltE !== o.e && rem < 3 && (o.v || 0) < 4 && S.plats?.[li] && S.onPlat?.(S.plats[li])) o.dwellAt = now;
      if (o.dwellAt) { const el = now - o.dwellAt, mine = S.plats?.[li] && S.onPlat?.(S.plats[li]); o.dwellMax = mine ? 40 : Math.max(20, Math.min(o.dwellMax || 20, el + 4)); S.liveStop(li, sd, Math.max(0, o.dwellMax - el)); o.dweltE = o.e; } else if (o.dweltE === o.e) continue; else if (rem < 60 && S.liveArrive(li, sd, 9) && !this.arrSeen.has(o.id + k)) { this.arrSeen.add(o.id + k); beep(SND.chime); if (hg.y < 1.5) say(`${Ln.st[k]?.[0] || ''}, ${o.to || ''}행 열차가 들어오고 있습니다.`); }
    }
    if (this.arrSeen.size > 200) this.arrSeen.clear();
  }
  // ---------- E ----------
  act() {
    if (this.el.seat && !this.el.seat.classList.contains('hidden')) return true;
    if (this.on) { if (this.canAlight()) this.alight(); else if (this.on.kind === 'bus') this.bell(); return true; }
    if (this.cand?.kind === 'exit') { this.hg.enterStation(this.cand.e); this.cand = null; return true; }
    if (this.cand) { this.board(this.cand); return true; }
    return false;
  }
  bell() { const R = this.on; if (!R || R.kind !== 'bus' || R.bell) return; R.bell = true; beep(SND.bell); this.led(); }
  // ---------- 타기 ----------
  board(c) {
    const hg = this.hg; hg.exitInterior?.(); beep(SND.card);
    // 곰이 타면 더 기다리지 않는다: 원래 20초가 지났으면 5초 뒤 출발
    if (c.kind === 'train' && c.o.dwellAt) { const el = performance.now() / 1000 - c.o.dwellAt; c.o.dwellMax = Math.max(Math.min(c.o.dwellMax || 20, 20), el + 5); }
    let I; if (c.kind === 'bus') { const k = `bus:${c.o.type}`; I = this.cache.get(k) || buildBus(c.o.type); this.cache.set(k, I); }
    else { const k = `car:${c.o.line}`; I = this.cache.get(k) || buildCar(c.o.line, hg.live.sub.lines[c.o.line]); this.cache.set(k, I); }
    I.g.userData.noDrape = true; hg.scene.add(I.g); I.g.visible = true; hg.live.rideId = c.o.id;
    const r = rnd(((Date.now() / 1000) | 0) * 7 + 1), taken = new Set(), n = Math.min(I.seats.length - 2, 3 + Math.floor(r() * 3));
    while (taken.size < n) taken.add(Math.floor(r() * I.seats.length));
    this.on = { kind: c.kind, o: c.o, I, taken, seat: null, yaw0: hg.camYaw, pitch0: hg.camPitch ?? 0.3, t: 0, lastSay: '', stName: c.st };
    this.passengers(r);
    if (c.kind === 'bus') { this.on.stops = null; if (c.o.rid && hg.api) hg.api(`/api/seoul/bus/stops?rid=${c.o.rid}`).then((j) => { if (this.on?.o === c.o) this.on.stops = (j.stops || []).map((s) => ({ ...s, xy: hg.live.toLocal(s.lat, s.lon) })); }).catch(() => {}); if (c.o.mesh) c.o.mesh.visible = false; }
    else { this.tun ||= buildTunnel(); this.plat ||= buildPlatform(); for (const q of [this.tun.g, this.plat.g]) { q.userData.noDrape = true; hg.scene.add(q); q.visible = false; } this.mapDraw(); }
    this.follow(0); this.openSeats();
    hg.onRide?.(c.kind === 'bus' ? `${c.o.route}번 버스` : `${c.o.line}`);
  }
  passengers(r) {
    const hg = this.hg, R = this.on; R.bears = [];
    const put = (s, seated) => { const b = hg.mkBear(r() < 0.5 ? 'street' : 'stroll', r, 1.05, { weather: 'clear' }); hg.scene.remove(b.root); R.I.g.add(b.root); b.root.position.set(s.x, s.y + (seated ? 0.05 : 0), s.z + (seated && R.kind === 'bus' ? 0.04 : 0)); b.root.rotation.y = s.face; if (seated) b.setSeated?.(true); b.update?.(0.016, 0, { noCrawl: true }); b.root.userData.npc = false; R.bears.push(b); };
    for (const i of R.taken) put(R.I.seats[i], true);
    // 운전사
    if (R.kind === 'bus') put(R.I.drv, true);
    if (r() < 0.6) put({ ...R.I.stand[R.I.stand.length - 1], face: R.I.stand[R.I.stand.length - 1].face + 0.4 }, false);
  }
  freeSeat() { const R = this.on; if (!R) return null; const free = R.I.seats.map((s, i) => i).filter((i) => !R.taken.has(i)); return free.length ? R.I.seats[free[Math.floor(Math.random() * free.length)]] : R.I.stand[0]; }
  // 좌석 고르기 창: 위에서 본 배치 (앞이 위)
  openSeats() {
    const R = this.on, el = this.el.seat, map = el.querySelector('.map'), I = R.I, isBus = R.kind === 'bus';
    el.querySelector('h3').textContent = isBus ? `🚌 ${R.o.route}번 버스 · 자리를 골라요` : `🚇 ${R.o.line} ${R.o.to || ''}행 · 자리를 골라요`;
    el.querySelector('.cab').classList.toggle('hidden', isBus || !!R.cab);
    const Wm = isBus ? I.W + 0.1 : 3.1, Lm = isBus ? I.L : 19.5, S = isBus ? 48 : 24, w = Wm * S, h = Lm * S; map.style.width = (isBus ? w : h) + 'px'; map.style.height = (isBus ? h : w) + 'px'; map.innerHTML = '';
    // 버스는 세로(앞이 위), 지하철은 가로(앞이 오른쪽)
    const P = (x, z) => (isBus ? [w / 2 - x * S, h / 2 - z * S] : [h / 2 + z * S, w / 2 - x * S]);
    I.seats.forEach((s, i) => { const b = document.createElement('button'), [a, c] = P(s.x, s.z), sz = isBus ? 10 : 5; b.className = 's' + (R.taken.has(i) ? ' taken' : ''); b.style.left = a - sz + 'px'; b.style.top = c - sz + 'px'; b.style.width = b.style.height = sz * 2 + 'px'; b.style.background = s.pink ? '#f29bb8' : s.prio ? '#e98a2a' : isBus ? '#3c5a9a' : '#4f6fb0'; b.title = s.pink ? '임산부석' : s.prio ? '노약자석' : '좌석'; if (!R.taken.has(i)) b.onclick = () => this.sit(s); map.appendChild(b); });
    const lab = (t, x, z) => { const d = document.createElement('span'), [a, c] = P(x, z); d.className = 'lab'; d.textContent = t; d.style.left = a - 18 + 'px'; d.style.top = c - 7 + 'px'; map.appendChild(d); };
    if (isBus) { for (const [t, x, z] of I.labs) lab(t, x, z); } else { for (const z of [-7.3, -2.45, 2.45, 7.3]) { lab('문', 1.35, z); lab('문', -1.35, z); } lab('▶ 앞', 0, 9.3); }
    el.classList.remove('hidden'); document.exitPointerLock?.();
  }
  sit(s) {
    const R = this.on; if (!R || !s) return; R.seat = s; this.el.seat.classList.add('hidden');
    // 처음엔 앞을 비스듬히 (앞 유리 · 통로 쪽), 옆 창은 돌려서 본다
    this.hg.camYaw = R.yaw0 + (s.stand ? 0 : R.kind === 'bus' ? (s.x < 0 ? 0.35 : -0.35) : 0); this.hg.camPitch = 0.3; R.pitch0 = 0.3 - (R.kind === 'bus' && !s.stand ? 0.12 : 0);
    if (R.kind === 'bus') this.say(`${R.o.route}번 버스입니다.`, true); else this.trainSay(true);
  }
  // ---------- 지하철 운전실 (8-40-2) ----------
  //   타고 있던 실제 열차의 지금 자리에서, 내 화면에서만 따로 달리는 열차가 된다 (실제 열차는 숨겨 둔 채 실시간대로 간다)
  //   W 가속 · S 제동 · R 앞뒤, 선로를 따라 역 사이를 넘어간다. 역에서 서면 문이 열리고 내릴 수 있다. 내리면 실제 열차가 다시 보인다
  cabOn() {
    const R = this.on, hg = this.hg, L = hg.live; if (!R || R.kind !== 'train' || R.cab) return; this.el.seat.classList.add('hidden');
    const k = `cab:${R.o.line}`, I = this.cache.get(k) || buildCab(L.sub.lines[R.o.line].color); this.cache.set(k, I); I.g.userData.noDrape = true; hg.scene.add(I.g); I.g.visible = true; R.cabI = I; R.I.g.visible = false;
    R.cab = { e: R.o.e, d: R.o.d, v: R.o.v || 0, dir: 1, doors: !!R.o.dwellAt, at: R.o.dwellAt ? R.o.e.b : null, stopT: 0, closeT: 0, said: null, gT: 0 };
    R.seat ||= R.I.stand[0]; hg.camYaw = R.yaw0; hg.camPitch = 0.3; R.pitch0 = 0.3;
    hg.onToast?.(`🧑‍✈️ ${R.o.line} 운전실 · 내 화면에서만 따로 달려요 · W 가속 · S 제동 · R 앞뒤 · 역에 서면 문이 열려요`);
    this.say(`${R.o.line} 운전실입니다.`, true, 'W 가속 · S 제동 · R 앞뒤');
  }
  cabFlip() { const C = this.on?.cab; if (!C) return; if (C.v > 0.3) { this.hg.onToast?.('🛑 멈춘 뒤 바꿔요 (S 제동)'); return; } C.dir *= -1; beep([[660, 0, 0.12, 'square', 0.05]]); this.hg.onToast?.(C.dir > 0 ? '▲ 앞으로' : '▼ 뒤로'); }
  // 운행 순서에서 a → b 다음 역 (없으면 null). 고리(2호선)는 이어진다
  seqNext(line, a, b) {
    const Ln = this.hg.live.sub.lines[line];
    for (const q of Ln.seqs) { const s = q.s, n = s.length; for (let i = 0; i < n; i++) { if (s[i] !== b) continue; const pv = q.loop ? s[(i - 1 + n) % n] : s[i - 1], nx = q.loop ? s[(i + 1) % n] : s[i + 1]; if (pv === a && nx) return nx; if (nx === a && pv) return pv; } }
    return null;
  }
  cabStep(dt) {
    const R = this.on, C = R.cab, L = this.hg.live, line = R.o.line, Ln = L.sub.lines[line], nm = (k) => Ln.st[k]?.[0] || k;
    let thr = clamp(this.rawIn?.mz || 0, -1, 1);
    // 문이 열려 있으면 W 로 닫고 1.5초 뒤 출발
    if (C.doors && thr > 0.05) { C.doors = false; C.closeT = 1.5; beep(SND.close); this.say('출입문 닫습니다.', false); }
    if (C.closeT > 0) { C.closeT -= dt; thr = 0; }
    const VMAX = 80 / 3.6;
    if (thr > 0.05) C.v = Math.min(VMAX, C.v + 1.0 * thr * dt * Math.max(0.15, 1 - C.v / VMAX)); else if (thr < -0.05) C.v = Math.max(0, C.v - 1.3 * -thr * dt); else C.v = Math.max(0, C.v - 0.05 * dt);
    C.d += C.v * C.dir * dt;
    // 역 사이를 넘어가기 (끝 역이면 선다)
    if (C.d > C.e.len) { const nx = this.seqNext(line, C.e.a, C.e.b), e2 = nx && L.edge(line, C.e.b, nx); if (e2) { C.d -= C.e.len; C.e = e2; C.said = null; } else { C.d = C.e.len; C.v = 0; } }
    else if (C.d < 0) { const pv = this.seqNext(line, C.e.b, C.e.a), e2 = pv && L.edge(line, pv, C.e.a); if (e2) { C.e = e2; C.d += e2.len; C.said = null; } else { C.d = 0; C.v = 0; } }
    // 가는 쪽 다음 역 · 남은 거리
    const nextK = C.dir > 0 ? C.e.b : C.e.a, dist = C.dir > 0 ? C.e.len - C.d : C.d;
    if (dist < 500 && C.said !== nextK && !C.doors) { C.said = nextK; this.say(`이번 역은 ${nm(nextK)}역입니다.`, true, `${line} 운전실 · 다음 ${nm(nextK)}`); }
    // 섰으면 승강장 안(앞머리가 역 60m 앞 ~ 140m 지남)인지 보고 문을 연다
    if (C.v < 0.05 && !C.doors && C.closeT <= 0) { C.stopT += dt; const at = C.e.len - C.d < 60 ? C.e.b : C.d < 140 ? C.e.a : null; if (at && C.stopT > 0.8) { C.doors = true; C.at = at; beep(SND.door); this.say(`${nm(at)}, ${nm(at)}역입니다. 문이 열립니다.`, true, `${line} · 내리려면 E`); } } else C.stopT = 0;
    // 손잡이 · 계기판
    const I = R.cabI; I.lever.rotation.x = -thr * 0.6;
    C.gT -= dt; if (C.gT <= 0) { C.gT = 0.1; drawCab(I.gauge, { kmh: C.v * 3.6, dir: C.dir, next: nm(nextK), dist, doors: C.doors, line, color: Ln.color }); }
  }
  // 운전실 앞 선로 다시 놓기 (16m 갈 때마다): 내 선로를 따라 4m 마다, 땅 밑(k 1)만 빼고
  cabRails() {
    const R = this.on, C = R?.cab, hg = this.hg, L = hg.live;
    if (!C || R.under) { if (this.cabRail) this.cabRail.g.visible = false; return; }
    const K = this.cabRail ||= buildCabRails(); if (K.g.parent !== hg.scene) hg.scene.add(K.g);
    // 높이가 어긋나도(겹친 고가에서 처음 자리를 잘못 잡았을 때) 다시 놓는다 — 비탈(7%)만큼은 봐준다
    const far = K.at ? Math.hypot(K.at[0] - R.x, K.at[1] - R.z) : Infinity, moved = far > 16 || K.dir !== C.dir || Math.abs(K.y - R.y) > 0.3 + far * 0.09;
    K.g.visible = K.bed.count > 0; if (!moved) return; K.at = [R.x, R.z]; K.dir = C.dir; K.y = R.y;
    const line = R.o.line, pts = []; let e = C.e, d = C.d - 24 * C.dir, way = R.way;
    for (let n = 0; n < 82; n++, d += 4 * C.dir) {
      if (d > e.len) { const nx = this.seqNext(line, e.a, e.b), e2 = nx && L.edge(line, e.b, nx); if (!e2) break; d -= e.len; e = e2; } else if (d < 0) { const pv = this.seqNext(line, e.b, e.a), e2 = pv && L.edge(line, pv, e.a); if (!e2) break; e = e2; d += e2.len; }
      const p = L.edgeAt(e, d); if (p.k === 1) { pts.push(null); continue; }
      let x = p.x - L.cx, z = p.z - L.cz; if (p.k === 2) { const cc = L.bridgeCenter(x, z, p.dx, p.dz, way); if (cc) { x = cc[0]; z = cc[1]; way = cc[5]; } }
      pts.push([x, 0, z, p.k]);
    }
    // 높이: 운전실 자리(뒤 24m = 6번째)에서 앞뒤로 이어 가며, 겹친 고가 중 이어지는 쪽 · 4m 에 35cm 넘게 꺾이지 않게
    const i0 = Math.min(6, pts.length - 1), fill = (i, prev) => { const q = pts[i]; if (!q) return null; const y = L.trackY(q[0], q[2], q[3], prev == null || q[3] !== 2 ? null : prev + 0.3) - 0.3; q[1] = prev == null ? y : clamp(y, prev - 0.35, prev + 0.35); return q[1]; };
    if (pts[i0]) pts[i0][1] = R.y; let py = pts[i0] ? R.y : null; for (let i = i0 + 1; i < pts.length; i++) py = fill(i, py); py = pts[i0] ? R.y : null; for (let i = i0 - 1; i >= 0; i--) py = fill(i, py);
    // 철교 · 고가는 OSM 에서 선로마다 따로 그어진 폭 7m 바닥이라, 내 선로 한 줄만 (옆 선로는 옆 바닥 위에 따로 있다)
    const o3 = new THREE.Object3D(), A = new THREE.Vector3(), B = new THREE.Vector3(); let nb = 0, nr = 0, ns = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; if (!a || !b) continue; const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, lx = dz / l, lz = -dx / l;
      for (const off of [0]) {
        A.set(a[0] + lx * off, a[1], a[2] + lz * off); B.set(b[0] + lx * off, b[1], b[2] + lz * off);
        o3.position.copy(A); o3.position.y += 0.03; o3.scale.set(1, 1, 1); o3.lookAt(B.x, B.y + 0.03, B.z); const len = A.distanceTo(B) + 0.05; o3.scale.set(1, 1, len); o3.updateMatrix();
        if (nb < RAIL_N * 2) K.bed.setMatrixAt(nb++, o3.matrix);
        o3.position.y = A.y + 0.14; o3.updateMatrix(); if (nr < RAIL_N * 2) K.rail.setMatrixAt(nr++, o3.matrix);
        // 침목: 0.6m 마다 (조각 시작 자리는 앞에서부터 이어지게 거리로)
        const s0 = (i * 4) % 0.6; o3.scale.set(1, 1, 1);
        for (let s = s0; s < len && ns < SLP_N; s += 0.6) { const f = s / len; o3.position.set(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f + 0.065, A.z + (B.z - A.z) * f); o3.lookAt(B.x, B.y + 0.065, B.z); o3.updateMatrix(); K.slp.setMatrixAt(ns++, o3.matrix); }
      }
    }
    K.bed.count = nb; K.rail.count = nr; K.slp.count = ns; for (const m of [K.bed, K.rail, K.slp]) m.instanceMatrix.needsUpdate = true; K.g.visible = nb > 0;
  }
  // ---------- 따라가기 ----------
  // 탈 것의 지금 자리 → 실내 무리 자리 · 방향 (지하철 땅 밑이면 땅에서 30m 아래 + 터널)
  follow(dt) {
    const hg = this.hg, R = this.on, L = hg.live; let x, z, yaw, y, under = false;
    if (R.kind === 'bus') { const o = R.o; x = o.x; z = o.z; yaw = o.yaw; y = hg.terr ? hg.terrAt(x, z) : 0; if (o.mesh) o.mesh.visible = false; }
    else if (R.cab) { const C = R.cab, p = L.edgeAt(C.e, C.d); x = p.x - L.cx; z = p.z - L.cz; yaw = Math.atan2(p.dx, p.dz); under = p.k === 1; if (p.k === 2) { const c = L.bridgeCenter(x, z, p.dx, p.dz, R.way); if (c) { x = c[0]; z = c[1]; yaw = Math.atan2(c[3], c[4]); R.way = c[5]; } } else R.way = null; y = under ? (hg.terr ? hg.terrAt(x, z) : 0) - 30 : L.trackY(x, z, p.k, p.k === 2 && R.y != null && !R.under ? R.y + 0.3 : null) - 0.3; R.under = under; R.pose = p; }
    else { const o = R.o, n = (L.sub.lines[o.line].cars || [8, 20])[0], p = L.carPose(o, Math.min(1, n - 1)); x = p.x - L.cx; z = p.z - L.cz; yaw = Math.atan2(p.dx, p.dz); under = p.k === 1; if (p.k === 2) { const c = L.bridgeCenter(x, z, p.dx, p.dz, R.way); if (c) { x = c[0]; z = c[1]; yaw = Math.atan2(c[3], c[4]); R.way = c[5]; } } else R.way = null; y = under ? (hg.terr ? hg.terrAt(x, z) : 0) - 30 : L.trackY(x, z, p.k) - 0.3; R.under = under; R.pose = p; }
    const g = R.cab ? R.cabI.g : R.I.g; g.position.set(x, y, z); g.rotation.y = yaw; R.x = x; R.z = z; R.y = y; R.yaw = yaw;
    hg.px = x; hg.pz = z; hg.y = 0;
    if (R.kind === 'train') {
      const T = R.cab || R.o;
      this.tun.g.visible = under; if (under) { this.tun.g.position.set(x, y, z); this.tun.g.rotation.y = yaw; this.tun.tex.offset.y -= ((T.v || 0) * (T.dir || 1) * dt) / 26.7; }
      // 승강장: 역 150m 안 (도착하는 역 · 막 떠난 역). 8-41-2: 지상 · 고가 역에도 (벽 대신 지붕 · 기둥)
      let show = false; const e = T.e, near = e.len - T.d < 150 ? [e, e.len, e.b] : T.d < 150 ? [e, 0, e.a] : null, P = this.plat;
      if (near) { const sp = L.edgeAt(near[0], near[1]); let sx = sp.x - L.cx, sz = sp.z - L.cz; show = Math.hypot(sx - x, sz - z) < 160;
        if (show) {
          // 승강장 가운데: 역 자리에서 들어오는 쪽으로 50m (실제 열차는 맨 앞이 역 자리에 선다 → 열차가 승강장을 다 채운다)
          //   옆으로는 열차 축에 붙인다 (역 둘레는 선로가 여러 줄이라 따로 구하면 승강장이 열차와 겹쳤다), 앞뒤 자리는 땅에 고정
          const fx = Math.sin(yaw), fz = Math.cos(yaw), s = (sx - x) * fx + (sz - z) * fz - 50;
          if (P.key !== near[0].a + near[0].b + near[2]) {
            // 역이 바뀌면: 고가에서 오른쪽에 옆 선로 바닥이 붙어 있으면 승강장을 왼쪽에
            P.key = near[0].a + near[0].b + near[2]; P.under = under; P.wall.visible = under;
            P.flip = sp.k === 2 && this.twinRight(x + fx * s, z + fz * s, yaw);
            if (P.st !== near[2]) { P.st = near[2]; this.nameBoard(L.sub.lines[R.o.line].st[near[2]]?.[0] || near[2], L.sub.lines[R.o.line].color); }
            P.at = [x + fx * s, z + fz * s]; P.ry = yaw + (P.flip ? Math.PI : 0); P.lay(this.psdDoors(R, 50)); P.open = 0; P.setOpen(0, true); P.aligned = false;
          }
          P.at = [x + fx * s, z + fz * s]; P.ry = yaw + (P.flip ? Math.PI : 0);
          P.g.position.set(P.at[0], y, P.at[1]); P.g.rotation.y = P.ry;
        } }
      P.g.visible = show;
    }
  }
  // 스크린도어 문 자리 (승강장 기준 z): 열차 맨 앞이 승강장 가운데에서 f(m) 앞일 때, 칸마다 문 4개
  psdDoors(R, f) {
    const L = this.hg.live, [n, clen] = L.sub.lines[R.o.line].cars || [8, 20], out = [], P = this.plat;
    // 열차가 없는 앞뒤도 같은 간격으로 이어 간다 (실제 스크린도어는 승강장 끝까지 있다)
    for (let c = -8; c < n + 8; c++) for (const dz of [-7.3, -2.45, 2.45, 7.3]) { const zt = f - (c + 0.5) * clen + dz * (clen / 20), z = P.flip ? -zt : zt; if (Math.abs(z) < 58.5) out.push(z); }
    return out.sort((a, b) => a - b);
  }
  // 열차 맨 앞이 승강장 가운데에서 몇 m 앞인지 (열차 방향으로)
  psdFront(R) { const P = this.plat, L = this.hg.live; if (!P?.at) return 0; let fx = R.x, fz = R.z; if (!R.cab) { const p = L.edgeAt(R.o.e, R.o.d); fx = p.x - L.cx; fz = p.z - L.cz; } const f = (fx - P.at[0]) * Math.sin(P.ry) + (fz - P.at[1]) * Math.cos(P.ry); return P.flip ? -f : f; }
  // 고가역: 오른쪽 4m 쯤에 다른 철도 바닥이 나란히 붙어 있는지 (복선 철교는 선로마다 따로 그어져 있다)
  twinRight(x, z, ry) {
    const hg = this.hg, px = x - Math.cos(ry) * 4.2, pz = z + Math.sin(ry) * 4.2; let hit = false;
    const look = (rp) => { for (const tp of rp || []) { const f = tp.fine; for (let i = 1; i < f.length && !hit; i++) { const a = f[i - 1], c = f[i]; if (Math.abs(a[0] - px) + Math.abs(a[1] - pz) > 45) continue; const ex = c[0] - a[0], ez = c[1] - a[1], t = clamp(((px - a[0]) * ex + (pz - a[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1); if (Math.hypot(px - a[0] - ex * t, pz - a[1] - ez * t) < 1.8) hit = true; } } };
    look(hg.railPaths); if (hg.chunks) for (const c of hg.chunks.values()) look(c.railPaths); return hit;
  }
  // 스크린도어 열고 닫기: 열차가 서서 문이 열리면 (운전실은 내가 세운 자리에 문 자리를 맞춘 뒤) 1.4초에 걸쳐 열린다
  psdTick(dt) {
    const R = this.on, P = this.plat; if (!P?.g.visible || !R || R.kind !== 'train') return;
    const want = R.cab ? R.cab.doors : !!R.o.dwellAt;
    if (want && !P.aligned && P.open < 0.02) { P.lay(this.psdDoors(R, this.psdFront(R))); P.aligned = true; }
    if (!want && P.open < 0.02) P.aligned = false;
    P.setOpen(clamp(P.open + (want ? dt : -dt) / 1.4, 0, 1));
    const night = this.hg.light?.night || 0; for (const m of P.mats) m.emissiveIntensity = m.userData.glow + (P.under ? 0 : night * 0.35);
  }
  nameBoard(name, color) { const { c, t } = this.plat.name; c.fillStyle = '#ffffff'; c.fillRect(0, 0, 512, 128); c.fillStyle = color; c.fillRect(0, 96, 512, 32); c.fillStyle = '#1d1d1f'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, 256, 52); t.needsUpdate = true; }
  // ---------- 안내 ----------
  say(text, chime = false, sub = '') { const R = this.on; if (!R || R.lastSay === text) return; R.lastSay = text; R.ledText = text; R.ledSub = sub; if (chime) beep(SND.chime); setTimeout(() => say(text), chime ? 900 : 0); this.led(); }
  led() { const R = this.on, el = this.el.led; if (!R) { el.classList.add('hidden'); return; } el.classList.remove('hidden'); el.innerHTML = `${R.bell ? '<span class="stop">● 정차합니다 · </span>' : ''}${R.ledText || ''}${R.ledSub ? `<small>${R.ledSub}</small>` : ''}`;
    if (R.kind === 'bus') { const { c, t } = R.I.led; c.fillStyle = '#0b0b0c'; c.fillRect(0, 0, 512, 64); c.fillStyle = R.bell ? '#ff4a3a' : '#ffae1a'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(R.bell ? '정차합니다' : (R.next ? `다음 ${R.next.n}` : `${R.o.route}번`), 256, 34, 500); t.needsUpdate = true; } }
  // 버스: 정류소 목록에서 지금 자리 다음 정류소 (버스 머리 앞쪽에서 가장 가까운 것)
  busNext() {
    const R = this.on, S = R.stops; if (!S?.length) return; const fx = Math.sin(R.yaw), fz = Math.cos(R.yaw); let bi = -1, bd = Infinity;
    S.forEach((s, i) => { const dx = s.xy[0] - R.x, dz = s.xy[1] - R.z, d = Math.hypot(dx, dz); if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) return; const s = S[bi], ahead = (s.xy[0] - R.x) * fx + (s.xy[1] - R.z) * fz; const ni = ahead > -6 ? bi : bi + 1; const nx = S[ni], nn = S[ni + 1];
    R.next = nx; R.nextD = nx ? Math.hypot(nx.xy[0] - R.x, nx.xy[1] - R.z) : Infinity;
    if (nx) this.say(`이번 정류장은 ${nx.n}입니다.${nn ? ` 다음 정류장은 ${nn.n}입니다.` : ''}`, true, nn ? `다음: ${nn.n}${nx.dir ? ` · ${nx.dir} 방면` : ''}` : '');
  }
  // 지하철: 이번 역 · 다음 역 (운행 순서), 갈아타는 노선
  trainSay(first = false) {
    const R = this.on, L = this.hg.live, Ln = L.sub.lines[R.o.line], o = R.o, nm = (k) => Ln.st[k]?.[0] || k, B = o.e.b;
    const xfer = Object.entries(L.sub.lines).filter(([n, q]) => n !== o.line && L.stKey(q, nm(B))).map(([n]) => n);
    const arrived = o.sttus === 1 && o.e.len - o.d < 30;
    const text = arrived ? `${nm(B)}, ${nm(B)}역입니다.` : `이번 역은 ${nm(B)}역입니다.`;
    this.say(first ? `이 열차는 ${o.to || ''}행 열차입니다. ${text}` : text + (xfer.length ? ` ${xfer.join(', ')}으로 갈아타실 수 있습니다.` : ''), !first, `${o.line} ${o.to || ''}행${o.next && arrived ? ` · 다음 ${nm(o.next)}` : ''}`);
    if (R.mapAt !== B) { R.mapAt = B; this.mapDraw(); }
  }
  // 노선도 · 안내 화면 (지하철 실내)
  mapDraw() {
    const R = this.on; if (!R || R.kind !== 'train') return; const L = this.hg.live, Ln = L.sub.lines[R.o.line], I = R.I, o = R.o;
    const seq = (Ln.seqs.find((q) => q.s.includes(o.e.b) && q.s.includes(o.e.a) && q.s.indexOf(o.e.b) > q.s.indexOf(o.e.a)) || Ln.seqs[0]).s, bi = Math.max(0, seq.indexOf(o.e.b)), from = Math.max(0, Math.min(bi - 6, seq.length - 16)), part = seq.slice(from, from + 16);
    { const { c, t } = I.map; c.fillStyle = '#ffffff'; c.fillRect(0, 0, 2048, 64); c.fillStyle = Ln.color; c.fillRect(30, 26, 1988, 10); c.textAlign = 'center'; part.forEach((k, i) => { const x = 60 + i * (1928 / Math.max(1, part.length - 1)), here = k === o.e.b; c.fillStyle = here ? '#ff3b30' : '#ffffff'; c.strokeStyle = Ln.color; c.lineWidth = 5; c.beginPath(); c.arc(x, 31, here ? 13 : 9, 0, 7); c.fill(); c.stroke(); c.fillStyle = here ? '#d0021b' : '#222'; c.font = `${here ? 'bold ' : ''}20px sans-serif`; c.fillText(Ln.st[k]?.[0] || k, x, 60); }); t.needsUpdate = true; }
    { const { c, t } = I.scr; c.fillStyle = '#101418'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#7cd3ff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText(`${o.line} ${o.to || ''}행`, 256, 30); c.fillStyle = '#ffffff'; c.font = 'bold 36px sans-serif'; c.fillText(`이번 역  ${Ln.st[o.e.b]?.[0] || o.e.b}`, 256, 76); t.needsUpdate = true; }
  }
  hideAbove(on) {
    const hg = this.hg, keep = new Set([this.on?.I.g, this.on?.cabI?.g, this.tun?.g, this.plat?.g, this.cabRail?.g, hg.bear?.root, hg.shadow]);
    if (on) { this.hid ||= []; for (const o of hg.scene.children) if (!keep.has(o) && o.visible && !o.isLight) { o.visible = false; this.hid.push(o); } }
    else if (this.hid) { for (const o of this.hid) o.visible = true; this.hid = null; }
  }
  canAlight() { const R = this.on; if (!R) return false; if (R.cab) return R.cab.doors; if (R.kind === 'bus') return (R.o.hold > 0 || R.o.stop) && (R.o.cur ?? 0) < 0.3 && (R.next ? R.nextD < 60 : true); return !!R.o.dwellAt && R.o.e.len - R.o.d < 40; }
  // ---------- 내리기 ----------
  alight(silent = false) {
    const hg = this.hg, R = this.on; if (!R) return; beep(SND.door);
    let tx = R.x, tz = R.z, face = R.yaw, enter = null;
    if (R.kind === 'bus') { const rx = -Math.cos(R.yaw), rz = Math.sin(R.yaw); tx += rx * 3.6; tz += rz * 3.6; if (R.o.mesh) R.o.mesh.visible = true; }
    else { const L = hg.live, Ln = L.sub.lines[R.o.line], stK = R.cab ? R.cab.at || R.cab.e.b : R.o.e.b, name = Ln.st[stK]?.[0] || ''; const e = (hg.entrances || []).filter((q) => norm(q.st.name) === norm(name)).sort((a, b) => Math.hypot(a.x - R.x, a.z - R.z) - Math.hypot(b.x - R.x, b.z - R.z))[0]; if (e && Math.hypot(e.x - R.x, e.z - R.z) < 700) enter = e; else { const s = Ln.st[stK]; if (s) { tx = s[1] - L.cx; tz = s[2] - L.cz; } } }
    this.hideAbove(false); hg.live.rideId = null;
    for (const b of R.bears || []) { R.I.g.remove(b.root); }
    R.I.g.visible = false; hg.scene.remove(R.I.g); if (R.cabI) { R.cabI.g.visible = false; hg.scene.remove(R.cabI.g); }
    if (this.tun) { this.tun.g.visible = false; this.plat.g.visible = false; this.plat.key = null; }
    if (this.cabRail) { this.cabRail.g.visible = false; this.cabRail.at = null; }
    this.on = null; this.el.led.classList.add('hidden'); this.el.seat.classList.add('hidden'); try { speechSynthesis?.cancel(); } catch { /* 없음 */ }
    if (this.camRef && this.near0) { this.camRef.near = this.near0; this.camRef.updateProjectionMatrix(); this.near0 = null; }
    // 지하철에서 내리면 그 역 승강장에 선다 (계단 · 에스컬레이터로 대합실 → 출구)
    if (enter) { const line = R.o.line; hg.enterStation(enter); const S = hg.inside?.S; if (S?.spawnPlatform) { const sp = S.spawnPlatform(Math.max(0, S.lineIndex?.(line) ?? 0)); hg.placeAt(sp.x, sp.z, sp.face); hg.y = 0; } } else hg.placeAt(tx, tz, face);
    if (!silent) hg.onRide?.(null);
  }
  // ---------- 매 프레임 ----------
  tick(dt) {
    const hg = this.hg; this.t += dt;
    if (!this.on) {
      if (this.t > 0.3) { this.t = 0; this.cand = this.findCand(); this.card(); this.platformTrains(); }
      return;
    }
    const R = this.on, L = hg.live;
    // 탈 것이 사라지면(자료가 끊김) 그 자리에서 내린다
    //   운전실에선 내 열차가 실시간 열차와 따로 달리니 상관없다
    if (!R.cab && (R.kind === 'bus' ? !L.buses.has(R.o.id) : !L.trains.has(R.o.id))) { this.alight(); return; }
    if (R.cab) this.cabStep(dt);
    this.follow(dt); R.t += dt;
    if (R.cab) this.cabRails();
    if (R.kind === 'train') this.psdTick(dt);
    // 승객 곰 자세: 앉은 곰은 무릎을 굽혀 방석에, 선 곰은 바닥에 (자세는 곰 update 에서 정해진다)
    for (const b of R.bears || []) b.update?.(dt, 0, { noCrawl: true });
    // 문: 버스가 서 있으면 열림
    // 버스: 정류장 14m 앞이면 10초 선다 (GPS 는 100초마다라 정차를 놓치기 쉬워서, 타고 있을 땐 정류소 목록으로)
    if (R.kind === 'bus' && R.next && R.nextD < 14 && R.heldAt !== R.next.seq) { R.heldAt = R.next.seq; R.o.hold = R.bell ? 12 : 8; }
    if (R.kind === 'bus') { const open = (R.o.cur ?? 0) < 0.3 && (R.o.stop || R.o.hold > 0); for (const p of R.I.doorP) p.position.z += ((open ? p.userData.openZ : p.userData.closedZ) - p.position.z) * Math.min(1, dt * 4); if (open && !R.wasOpen) { beep(SND.door); if (R.bell) { R.bell = false; this.led(); } } R.wasOpen = open; }
    const night = hg.light?.night || 0, under = R.under; for (const m of R.cab ? R.cabI.mats : R.I.mats) m.emissiveIntensity = m.userData.glow + (under ? 0.4 : night * 0.26);
    if (R.cab) R.cabI.beamM.opacity = under ? 0.22 : clamp((night - 0.3) * 0.6, 0, 0.35);
    // 땅 밑에선 바깥 세상을 숨긴다 (터널 벽 너머라 안 보이는데 그리기만 무겁다)
    this.hideAbove(R.kind === 'train' && R.under);
    if (R.cab) { if (this.t > 0.2) { this.t = 0; this.card(); } return; }
    if (this.t > 1) { this.t = 0; if (R.seat) { if (R.kind === 'bus') this.busNext(); else this.trainSay(); } this.card(); }
  }
  card() {
    const el = this.el.card, R = this.on, c = this.cand, b1 = el.querySelector('.b1'), b2 = el.querySelector('.b2'), ic = el.querySelector('.ic');
    el.classList.toggle('cab', !!R?.cab);
    if (R?.cab) { const C = R.cab, kmh = Math.round(C.v * 3.6); ic.textContent = '🧑‍✈️'; el.querySelector('b').textContent = `${R.o.line} 운전실 · ${kmh}km/h${C.dir < 0 ? ' · 뒤로' : ''}`; el.querySelector('small').textContent = C.doors ? '문이 열렸어요 · 내릴 수 있어요 (W 로 출발하면 문이 닫혀요)' : 'W 가속 · S 제동 · R 앞뒤 바꾸기 · 역에 서면 문이 열려요'; b1.innerHTML = C.doors ? '내리기 <kbd>E</kbd>' : '⇄ 앞뒤 <kbd>R</kbd>'; b1.onclick = C.doors ? () => this.alight() : () => this.cabFlip(); b2.classList.add('hidden'); el.classList.remove('hidden'); return; }
    if (R) { const can = this.canAlight(); ic.textContent = R.kind === 'bus' ? '🚌' : '🚇'; el.querySelector('b').textContent = R.kind === 'bus' ? `${R.o.route}번 버스 안` : `${R.o.line} ${R.o.to || ''}행 열차 안`; el.querySelector('small').textContent = can ? '문이 열렸어요 · 내릴 수 있어요' : R.kind === 'bus' ? (R.bell ? '다음 정류장에서 서요' : '내리려면 하차벨을 눌러요') : '역에 서면 내릴 수 있어요'; b1.innerHTML = can ? '내리기 <kbd>E</kbd>' : '🪑 자리 바꾸기'; b1.onclick = can ? () => this.alight() : () => this.openSeats(); b2.classList.toggle('hidden', R.kind !== 'bus' || can); el.classList.remove('hidden'); return; }
    if (!c) { el.classList.add('hidden'); return; }
    // 같은 실시간 버스를 운전 카드(hangang-drive.js, 운전석 · 승객 고르기)가 보여 주고 있으면 겹치지 않게 숨긴다
    if (c.kind === 'bus' && this.hg.drive?.near?.v?.live === c.o) { el.classList.add('hidden'); return; }
    b2.classList.add('hidden'); b1.onclick = () => this.act();
    if (c.kind === 'exit') { ic.textContent = '🚇'; el.querySelector('b').textContent = `${c.e.st.name}역 ${c.e.ref || ''}번 출구`; el.querySelector('small').textContent = '계단으로 내려가 승강장에서 열차를 타요'; b1.innerHTML = '역으로 내려가기 <kbd>E</kbd>'; el.classList.remove('hidden'); return; }
    if (c.kind === 'bus') { ic.textContent = '🚌'; el.querySelector('b').textContent = `${c.o.route}번 버스가 서 있어요`; el.querySelector('small').textContent = '문이 열렸어요 · 교통카드를 찍고 타요'; }
    else { ic.textContent = '🚇'; el.querySelector('b').textContent = `${c.o.line} ${c.o.to || ''}행 · ${c.o.sttus === 1 ? '도착' : '곧 도착'}`; el.querySelector('small').textContent = `${c.st}역 · 실제 열차 위치 그대로`; }
    b1.innerHTML = '타기 <kbd>E</kbd>'; el.classList.remove('hidden');
  }
  // 카메라: 고른 자리 눈높이 (앉으면 1.15m, 서면 1.6m), 끌어서 둘러보기 · 살짝 흔들림
  cam(camera) {
    const R = this.on, hg = this.hg; if (!R) return; if (hg.bear) hg.bear.root.visible = false; if (hg.shadow) hg.shadow.visible = false;
    if (R.cab) {
      // 운전석 눈높이 (앞 유리 너머 선로), 끌어서 둘러보기
      const v = new THREE.Vector3(0.35, R.cabI.F + 1.4 + Math.sin(performance.now() / 140) * 0.004 * Math.min(1, R.cab.v / 8), -1.25); R.cabI.g.localToWorld(v); camera.position.copy(v);
      const yaw = R.yaw + (hg.camYaw - R.yaw0), pt = clamp((hg.camPitch ?? 0.3) - R.pitch0, -0.6, 0.6) + 0.2;
      camera.up.set(0, 1, 0); camera.lookAt(v.x + Math.sin(yaw) * Math.cos(pt), v.y - Math.sin(pt), v.z + Math.cos(yaw) * Math.cos(pt));
      if (camera.near > 0.05) { this.camRef = camera; this.near0 = camera.near; camera.near = 0.05; camera.updateProjectionMatrix(); }
      return;
    }
    const s = R.seat || R.I.stand[0], eye = s.stand ? 1.55 : 0.8, sh = Math.sin(performance.now() / 160) * 0.006 * Math.min(1, (R.kind === 'bus' ? R.o.cur ?? 0 : R.o.v || 0) / 6);
    // 버스 창가 자리는 눈을 통로 쪽으로 20cm (창틀 · 기둥이 화면에 들어오게)
    const ex = R.kind === 'bus' && !s.stand ? s.x - Math.sign(s.x) * 0.2 : s.x;
    const v = new THREE.Vector3(ex, s.y + eye + sh, s.z); R.I.g.localToWorld(v); camera.position.copy(v);
    const yaw = R.yaw + s.face + (hg.camYaw - R.yaw0), pt = clamp((hg.camPitch ?? 0.3) - R.pitch0, -0.7, 0.7);
    camera.up.set(0, 1, 0); camera.lookAt(v.x + Math.sin(yaw) * Math.cos(pt), v.y - Math.sin(pt), v.z + Math.cos(yaw) * Math.cos(pt));
    if (camera.near > 0.05) { this.camRef = camera; this.near0 = camera.near; camera.near = 0.05; camera.updateProjectionMatrix(); }
  }
  where() { const R = this.on; if (!R) return null; if (R.cab) return `🧑‍✈️ ${R.o.line} 운전 중 · ${Math.round(R.cab.v * 3.6)}km/h`; return R.kind === 'bus' ? `🚌 ${R.o.route}번 버스 안${R.next ? ` · 다음 ${R.next.n}` : ''}` : `🚇 ${R.o.line} 열차 안 · 이번 ${this.hg.live.sub.lines[R.o.line].st[R.o.e.b]?.[0] || ''}`; }
  dispose() { if (this.on) this.alight(true); for (const I of this.cache.values()) this.hg.scene.remove(I.g); this.cache.clear(); if (this.cabRail) this.hg.scene.remove(this.cabRail.g); }
}
