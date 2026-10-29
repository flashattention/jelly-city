// 젤리 가이즈 세상 그리기: 판(L) 하나를 three.js 로 만들고, 시간 t 에 맞춰 장애물을 움직인다
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { moverAt, spinAngle, hammerAt, ballAt, ballsNow, rng } from './rounds.js';
import { tileSolid } from './phys.js';

const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const lum = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
// 외곽선 (만화처럼 · 배경과 섞이지 않게): 뒷면만 그리는 살짝 큰 껍데기
const OUT = new Map();
const outM = (c) => { if (!OUT.has(c)) OUT.set(c, new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })); return OUT.get(c); };
function outline(mesh, c, k = 0.06) { const o = new THREE.Mesh(mesh.geometry, outM(c)); o.scale.setScalar(1 + k); o.raycast = () => {}; mesh.add(o); return o; }
const lineOf = (c) => (lum(c) > 0.35 ? shade(c, 0.45) : '#ffffff'); // 밝은 색은 진한 외곽선 · 어두운 색은 흰 외곽선

// ---------- 무늬 ----------
const TEX = new Map();
function canvasTex(key, draw, n = 128) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  TEX.set(key, t); return t;
}
const checkTex = (a, b) => canvasTex(`chk${a}${b}`, (x, n) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.fillStyle = b; x.fillRect(0, 0, n / 2, n / 2); x.fillRect(n / 2, n / 2, n / 2, n / 2); x.fillStyle = 'rgba(255,255,255,.25)'; for (const [u, v] of [[0, 0], [n / 2, n / 2]]) x.fillRect(u + 6, v + 6, 10, 4); });
const stripeTex = (a, b) => canvasTex(`str${a}${b}`, (x, n) => { x.fillStyle = a; x.fillRect(0, 0, n, n); x.fillStyle = b; for (let i = -2; i < 4; i++) { x.beginPath(); x.moveTo(i * n / 2, 0); x.lineTo(i * n / 2 + n / 4, 0); x.lineTo(i * n / 2 + n / 4 + n, n); x.lineTo(i * n / 2 + n, n); x.fill(); } });
const arrowTex = () => canvasTex('arrow', (x, n) => { x.fillStyle = '#56657a'; x.fillRect(0, 0, n, n); x.fillStyle = '#7f90a8'; for (let i = 0; i < 2; i++) { const y = i * n / 2 + 10; x.beginPath(); x.moveTo(n / 2, y + 40); x.lineTo(n / 2 - 34, y + 6); x.lineTo(n / 2 - 18, y); x.lineTo(n / 2, y + 22); x.lineTo(n / 2 + 18, y); x.lineTo(n / 2 + 34, y + 6); x.fill(); } });
const padTex = () => canvasTex('pad', (x, n) => { x.fillStyle = '#ffd84d'; x.fillRect(0, 0, n, n); x.fillStyle = '#ff8a3d'; for (let i = 0; i < 2; i++) { const y = i * n / 2 + 50; x.beginPath(); x.moveTo(n / 2, y - 40); x.lineTo(n / 2 + 30, y); x.lineTo(n / 2 - 30, y); x.fill(); } });
const doorTex = (c) => canvasTex(`door${c}`, (x, n) => { x.fillStyle = c; x.fillRect(0, 0, n, n); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 6; x.strokeRect(14, 12, n - 28, n - 20); x.fillStyle = 'rgba(255,255,255,.9)'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', n / 2, n / 2); x.fillStyle = '#ffd84d'; x.beginPath(); x.arc(n - 30, n / 2 + 10, 7, 0, 7); x.fill(); });
const waffleTex = (c) => canvasTex(`waf${c}`, (x, n) => { x.fillStyle = c; x.fillRect(0, 0, n, n); x.fillStyle = shade(c, 0.78); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(8 + i * 30, 8 + j * 30, 22, 22); });
const ballTex = (c) => canvasTex(`ball${c}`, (x, n) => { x.fillStyle = c; x.fillRect(0, 0, n, n); x.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) x.fillRect(i * n / 4, 0, n / 10, n); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, n / 2 - 6, n, 12); });
const finishTex = () => canvasTex('fin', (x, n) => { const k = 8; for (let i = 0; i < k; i++) for (let j = 0; j < k / 4; j++) { x.fillStyle = (i + j) % 2 ? '#222' : '#fff'; x.fillRect(i * n / k, j * n / 2, n / k, n / 2); } });

function rbox(w, h, d, r = 0.22) { return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2)); }

export class World {
  constructor(scene, L) {
    this.scene = scene; this.L = L;
    this.g = new THREE.Group(); scene.add(this.g);
    this.dyn = []; // (t, st) => void
    const th = L.theme;
    // 하늘 · 안개
    scene.background = new THREE.Color(th.sky[1]);
    scene.fog = new THREE.Fog(th.sky[1], th.fog[0], th.fog[1]);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { a: { value: new THREE.Color(th.sky[0]) }, b: { value: new THREE.Color(th.sky[1]) } }, vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float h; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(-0.05, 0.6, h)), 1.); }' }));
    this.g.add(sky); this.sky = sky;
    // 아래 젤리 물 (떨어지면 여기로)
    const goo = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), toon(th.goo, { emissive: shade(th.goo, 0.25) }));
    goo.rotation.x = -Math.PI / 2; goo.position.y = L.gooY ?? -5; this.g.add(goo);
    const ripples = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: canvasTex('rip' + th.goo, (x, n) => { x.clearRect(0, 0, n, n); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 4; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(Math.random() * n, Math.random() * n, 8 + Math.random() * 16, 0, 7); x.stroke(); } }), transparent: true, depthWrite: false }));
    ripples.material.map.repeat.set(60, 60); ripples.rotation.x = -Math.PI / 2; ripples.position.y = (L.gooY ?? -5) + 0.05; this.g.add(ripples);
    this.dyn.push((t) => { ripples.material.map.offset.set(t * 0.01, t * 0.013); });
    this.build(L);
    this.decorate(L);
  }
  add(m) { this.g.add(m); return m; }

  build(L) {
    const th = L.theme;
    // 상자들
    for (const b of L.boxes) {
      const geo = rbox(b.w, b.h, b.d, b.door ? 0.12 : 0.28);
      let mat;
      if (b.pad) { mat = toon('#ffffff', { map: padTex().clone(), emissive: '#5a4300' }); mat.map.repeat.set(b.w / 2, 1); mat.map.needsUpdate = true; }
      else if (b.conv) { mat = toon('#ffffff', { map: arrowTex().clone() }); mat.map.repeat.set(1, b.d / 4); mat.map.needsUpdate = true; mat.map.rotation = b.conv[1] < 0 ? 0 : Math.PI; }
      else if (b.door) mat = toon('#ffffff', { map: doorTex(b.c) });
      else if (b.ice) mat = toon(b.c, { transparent: true, opacity: 0.92, emissive: '#3d6a8a' });
      else if (b.push) { mat = toon('#ffffff', { map: stripeTex(b.c, '#2a2a36').clone() }); mat.map.repeat.set(2, 1); mat.map.needsUpdate = true; }
      else if (b.w * b.d > 20) { mat = toon('#ffffff', { map: checkTex(th.floor[0], th.floor[1]).clone() }); mat.map.repeat.set(b.w / 4, b.d / 4); mat.map.needsUpdate = true; }
      else mat = toon(b.c);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(b.x, b.y + b.h / 2, b.z);
      outline(m, lineOf(b.c || th.floor[0]), Math.min(0.06, 0.12 / Math.max(b.w, b.d, b.h)));
      this.add(m);
      // 큰 판 옆면: 테마 옆색 띠
      if (!b.door && !b.push && b.w * b.d > 20) { const s = new THREE.Mesh(rbox(b.w + 0.02, b.h * 0.55, b.d + 0.02, 0.2), toon(th.side)); s.position.y = -b.h * 0.22; m.add(s); }
      if (b.door) {
        m.userData.door = b.door;
        this.dyn.push((t, st) => {
          if (!st.doors.has(b.door)) return;
          m.userData.popT ??= 0; m.userData.popT += 1 / 60;
          const k = m.userData.popT; m.scale.set(1 + k * 3, Math.max(0.01, 1 - k * 5), 1 + k * 3); m.material.transparent = true; m.material.opacity = Math.max(0, 1 - k * 4);
          if (k > 0.3) m.visible = false;
        });
      }
      if (b.mv) this.dyn.push((t) => { const o = moverAt(b.mv, t, {}); m.position.set(b.x + o.x, b.y + b.h / 2 + o.y, b.z + o.z); });
      if (b.conv) this.dyn.push((t) => { mat.map.offset.y = (t * Math.abs(b.conv[1]) / 4) % 1; });
      if (b.pad) this.dyn.push((t) => { mat.emissive.setRGB(0.35 + Math.sin(t * 8) * 0.15, 0.26, 0); });
    }
    // 떨어지는 판
    this.tileMeshes = L.tiles.map((tl) => {
      const m = new THREE.Mesh(rbox(tl.w, tl.h, tl.d, 0.12), toon('#ffffff', { map: waffleTex(tl.c), transparent: true }));
      m.position.set(tl.x, tl.y + tl.h / 2, tl.z); outline(m, lineOf(tl.c), 0.03);
      this.add(m); return m;
    });
    const tmpC = new THREE.Color();
    this.dyn.push((t, st) => {
      L.tiles.forEach((tl, i) => {
        const m = this.tileMeshes[i], f = tl.sched ? tl.fallAt : st.tiles.get(tl.id);
        if (f == null) return;
        const left = f - t;
        if (left > (tl.sched ? 1.6 : 1.2)) return;
        if (left > 0) { // 반짝 · 떨림
          const k = Math.sin(t * (tl.sched ? 26 : 40)) * 0.5 + 0.5;
          m.material.color.copy(tmpC.set('#ffffff').lerp(new THREE.Color('#ff4a5c'), k * 0.8));
          m.position.x = tl.x + Math.sin(t * 60 + i) * 0.04;
        } else { // 떨어진다
          const k = -left;
          m.position.y = tl.y + tl.h / 2 - k * k * 14; m.material.opacity = Math.max(0, 1 - k * 1.6); m.visible = k < 0.7;
        }
      });
    });
    // 도는 원판
    for (const d of L.disks) {
      const tex = canvasTex(`disk${d.c}`, (x, n) => { for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? d.c : shade(d.c, 1.25); x.beginPath(); x.moveTo(n / 2, n / 2); x.arc(n / 2, n / 2, n / 2, (i / 12) * 6.283, ((i + 1) / 12) * 6.283); x.fill(); } x.fillStyle = '#ffffff'; x.beginPath(); x.arc(n / 2, n / 2, n * 0.08, 0, 7); x.fill(); }, 256);
      const top = toon('#ffffff', { map: tex }), side = toon(shade(d.c, 0.75));
      const m = new THREE.Mesh(new THREE.CylinderGeometry(d.R, d.R * 0.92, d.h, 48), [side, top, side]);
      m.position.set(d.x, d.y - d.h / 2, d.z); outline(m, lineOf(d.c), 0.02); this.add(m);
      if (!d.arena) { const c = new THREE.Mesh(new THREE.ConeGeometry(d.R * 0.5, 4, 16), toon(shade(d.c, 0.6))); c.rotation.x = Math.PI; c.position.y = -d.h / 2 - 2; m.add(c); }
      else { const c = new THREE.Mesh(new THREE.CylinderGeometry(d.R * 0.92, 1.5, 9, 48), toon(shade(d.c, 0.55))); c.position.y = -d.h / 2 - 4.5; m.add(c); }
      if (d.spd) this.dyn.push((t) => { m.rotation.y = d.spd * t; });
    }
    // 빙글빙글 막대
    for (const s of L.spinners) {
      const g = new THREE.Group(); g.position.set(s.x, s.y + s.h, s.z); this.add(g);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, s.h + 0.7, 16), toon(shade(s.c, 0.7))); post.position.y = -s.h / 2 + 0.3; this.add(post); post.position.set(s.x, s.y + (s.h + 0.7) / 2, s.z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 10), toon(s.c)); cap.position.set(s.x, s.y + s.h + 0.35, s.z); this.add(cap);
      const mat = toon('#ffffff', { map: stripeTex(s.c, '#ffffff').clone() }); mat.map.repeat.set(s.len / 1.4, 1); mat.map.needsUpdate = true;
      for (let i = 0; i < s.n; i++) {
        const arm = new THREE.Group(); arm.rotation.y = (i * Math.PI * 2) / s.n; g.add(arm);
        const bar = new THREE.Mesh(new THREE.CapsuleGeometry(s.r, s.len - s.r * 2, 6, 12), mat); bar.rotation.z = Math.PI / 2; bar.position.x = s.len / 2; arm.add(bar); outline(bar, lineOf(s.c), 0.08);
      }
      this.dyn.push((t) => { g.rotation.y = spinAngle(s, Math.max(0, t)); });
    }
    // 흔들리는 망치
    for (const h of L.hammers) {
      const frame = toon('#8d6e63');
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, h.y + 0.6, 10), frame); p.position.set(h.x + sx * 7.6, h.y / 2 - 0.3, h.z); this.add(p); }
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 15.6, 10), frame); top.rotation.z = Math.PI / 2; top.position.set(h.x, h.y, h.z); this.add(top);
      const g = new THREE.Group(); g.position.set(h.x, h.y, h.z); this.add(g);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h.len, 8), toon('#c9c2e8')); rod.position.y = -h.len / 2; g.add(rod);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(h.R, h.R, h.R * 2.4, 24), [toon(h.c), toon('#ffffff'), toon('#ffffff')]); head.rotation.x = Math.PI / 2; head.position.y = -h.len; g.add(head); outline(head, lineOf(h.c), 0.05);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(h.R * 1.02, h.R * 1.02, 0.35, 24), toon('#ffffff')); band.rotation.x = Math.PI / 2; band.position.y = -h.len; g.add(band);
      const o = {};
      this.dyn.push((t) => { hammerAt(h, Math.max(0, t), o); g.rotation.z = o.a; });
    }
    // 통통 범퍼
    for (const b of L.bumpers) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(b.R, b.R * 1.08, b.h, 24), b.hub ? toon(b.c) : toon('#ffffff', { map: stripeTex(b.c, '#ffffff') }));
      m.position.set(b.x, b.y + b.h / 2, b.z); outline(m, lineOf(b.c), 0.05); this.add(m);
      if (!b.hub) { const cap = new THREE.Mesh(new THREE.SphereGeometry(b.R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(b.c)); cap.position.y = b.h / 2; m.add(cap); this.dyn.push((t) => { const k = 1 + Math.sin(t * 5 + b.x) * 0.04; m.scale.set(k, 2 - k, k); }); }
    }
    // 굴러오는 공 (흐름마다 공 몇 개를 돌려 쓴다)
    for (const s of L.streams) {
      const pool = [], n = Math.ceil(s.life / s.every) + 2;
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(s.R, 24, 16), toon('#ffffff', { map: ballTex(s.c) })); outline(m, lineOf(s.c), 0.04); m.visible = false; this.add(m); pool.push(m); }
      const o = {};
      this.dyn.push((t) => {
        for (const m of pool) m.visible = false;
        const [a, b] = ballsNow(s, t);
        for (let i = a; i <= b; i++) {
          const q = ballAt(s, i, t, o); if (!q) continue;
          const m = pool[i % n]; m.visible = true; m.position.set(q.x, q.y, q.z);
          const roll = (t - s.t0 - i * s.every) * Math.hypot(s.vx, s.vz) / s.R;
          m.rotation.set(s.vz ? roll * Math.sign(s.vz) : 0, 0, s.vx ? -roll * Math.sign(s.vx) : 0);
        }
      });
    }
    // 결승선 · 왕관
    if (L.finish) {
      const f = L.finish, g = new THREE.Group(); g.position.set(0, f.y, f.z0); this.add(g);
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 7, 16), toon(sx < 0 ? L.theme.acc[0] : L.theme.acc[1])); p.position.set(sx * 9, 3.5, 0); g.add(p); outline(p, '#ffffff', 0.05); const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon('#ffd84d')); b.position.set(sx * 9, 7.6, 0); g.add(b); }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(18.6, 1.6, 0.4), toon('#ffffff', { map: finishTex() })); banner.material.map.repeat.set(4, 1); banner.position.y = 6.5; g.add(banner);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.2), new THREE.MeshBasicMaterial({ map: finishTex() })); line.material.map.repeat.set(9, 1); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, 0.4); g.add(line);
    }
    if (L.crown) {
      const c = new THREE.Group(); c.position.set(L.crown.x, L.crown.y, L.crown.z); this.add(c);
      const gold = toon('#ffd84d', { emissive: '#6a4b00' });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.65, 0.6, 20, 1, true), gold); ring.material.side = THREE.DoubleSide; c.add(ring);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), gold); sp.position.set(Math.cos(a) * 0.68, 0.5, Math.sin(a) * 0.68); c.add(sp); const gem = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(['#ff4a6d', '#4aa3ff', '#7be07b'][i % 3])); gem.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72); c.add(gem); }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex('glow', (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,230,120,1)'); g.addColorStop(1, 'rgba(255,230,120,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(4); c.add(glow);
      this.dyn.push((t) => { c.rotation.y = t * 1.5; c.position.y = L.crown.y + Math.sin(t * 2) * 0.15; });
    }
    // 체크포인트 깃발
    for (const cp of L.cps) for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), toon('#ffffff')); p.position.set(sx * 6.5, cp.y + 1.3, cp.z); this.add(p);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshToonMaterial({ color: L.theme.acc[2], side: THREE.DoubleSide })); fl.position.set(sx * 6.5 + 0.55, cp.y + 2.2, cp.z); this.add(fl);
      this.dyn.push((t) => { fl.rotation.y = Math.sin(t * 3 + sx) * 0.3; });
    }
  }

  // 코스 둘레 꾸미기: 둥둥 뜬 섬 · 사탕 · 풍선 · 구름 (씨앗으로 늘 같게)
  decorate(L) {
    const R = rng(L.id.length * 7919 + (L.end | 0)), th = L.theme;
    const zMax = L.end || 20, zMin = L.end ? -20 : -25;
    const n = L.end ? Math.floor(zMax / 7) : 14;
    for (let i = 0; i < n; i++) {
      const side = R() < 0.5 ? -1 : 1, x = side * (16 + R() * 30), z = zMin + R() * (zMax - zMin + 30), y = -3 + R() * 10;
      const c = th.acc[Math.floor(R() * th.acc.length)];
      const k = R();
      if (k < 0.35) { // 둥둥 섬 + 사탕 나무
        const isl = new THREE.Mesh(new THREE.CylinderGeometry(3 + R() * 2, 0.5, 4, 9), toon(th.floor[0])); isl.position.set(x, y, z); this.add(isl);
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), toon('#ffffff')); stick.position.set(x, y + 3.5, z); this.add(stick);
        const top = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10), toon(c)); top.position.set(x, y + 5.4, z); this.add(top);
      } else if (k < 0.6) { // 풍선
        const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 12), toon(c, { emissive: shade(c, 0.15) })); b.scale.y = 1.2; b.position.set(x, y + 8, z); this.add(b);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 4), toon('#ffffff')); s.position.set(x, y + 5.5, z); this.add(s);
        const ph = R() * 6; this.dyn.push((t) => { b.position.y = y + 8 + Math.sin(t + ph) * 0.6; });
      } else if (k < 0.8) { // 구름
        const g = new THREE.Group(); g.position.set(x * 1.5, 14 + R() * 12, z); this.add(g);
        for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(new THREE.SphereGeometry(2 + R() * 2, 12, 10), toon('#ffffff')); p.position.set(j * 2.4 - 3.6, R(), R() * 1.5); g.add(p); }
      } else { // 커다란 젤리 곰 모양 기둥 · 도넛
        const d = new THREE.Mesh(new THREE.TorusGeometry(2, 0.9, 12, 24), toon(c)); d.position.set(x, y + 4, z); d.rotation.set(R() * 3, R() * 3, 0); this.add(d);
        const sp = 0.3 + R() * 0.5; this.dyn.push((t) => { d.rotation.y = t * sp; });
      }
    }
  }
  update(t, st) { for (const f of this.dyn) f(t, st); }
  dispose() {
    this.scene.remove(this.g);
    this.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map && !m.map.isCached) m.map !== undefined; m.dispose(); } });
  }
}
