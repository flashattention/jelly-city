// 젤리수호대 그림: 영웅 곰돌이(손 무기 · 장비) · 1인칭 무기 · 방벽 · 돔 · 지뢰 같은 설치물 · 투사체 · 줄기 · 폭발 · 피해 숫자
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';
import { PROJ, shieldRect } from './heroes.js';
import { dressHero, hasLook } from './herolooks.js';

const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, ...o });
const glowM = (c, op = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), SPH = new THREE.SphereGeometry(1, 16, 12), TOR = new THREE.TorusGeometry(1, 0.12, 8, 24);
function part(p, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); p.add(o); return o; }
let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c));
}
let _hex = null;
function hexTex() {
  if (_hex) return _hex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3;
  const R = 16, h = R * Math.sqrt(3);
  for (let row = -1; row < 6; row++) for (let col = -1; col < 6; col++) {
    const cx = col * R * 1.5, cy = row * h + (col % 2 ? h / 2 : 0);
    x.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (_hex = t);
}
export const TEAM_COL = { red: '#ff5a7a', blue: '#4cc3ff' };

// ---------- 3인칭 영웅 곰돌이 ----------
//   손 무기는 roach 에 있는 것은 그대로, 없는 것(망치 · 지팡이 · 캐논 …)은 여기서 만든다
function customHeld(bear, kind, col) {
  const g = bear.heldGroup; g.clear();
  const m = toon(col), dark = toon('#3b3f4a'), gold = toon('#ffd36b');
  if (kind === 'hammer') { part(g, CYL, toon('#7a5a3a'), 0, -0.7, 0, 0.05, 1.9, 0.05); part(g, BOX, toon('#c9d2e3'), 0, -1.65, 0, 0.55, 0.38, 0.38); part(g, BOX, toon('#ff8f4a'), 0.3, -1.65, 0, 0.06, 0.26, 0.26); bear.heldPose = 'melee'; }
  else if (kind === 'staff') { part(g, CYL, toon('#ffffff'), 0, -0.6, 0, 0.035, 1.6, 0.035); part(g, SPH, gold, 0, -1.45, 0, 0.1, 0.1, 0.1); part(g, BOX, gold, 0.12, -1.35, 0, 0.18, 0.04, 0.02, 0, 0, 0.5); part(g, BOX, gold, -0.12, -1.35, 0, 0.18, 0.04, 0.02, 0, 0, -0.5); bear.heldPose = 'gun'; }
  else if (kind === 'cannons') { part(g, BOX, m, 0, -0.25, 0, 0.3, 0.6, 0.3); part(g, CYL, dark, 0, -0.65, 0, 0.09, 0.4, 0.09); bear.heldPose = 'heavy'; }
  else if (kind === 'scrap') { part(g, BOX, toon('#8a6a4a'), 0, -0.3, 0, 0.22, 0.75, 0.22); part(g, CYL, dark, 0, -0.8, 0, 0.11, 0.35, 0.11); part(g, CYL, toon('#c98a3a'), 0, -0.3, 0.17, 0.14, 0.18, 0.14, 0, 0, Math.PI / 2); bear.heldPose = 'heavy'; }
  else if (kind === 'particle') { part(g, BOX, dark, 0, -0.3, 0, 0.26, 0.85, 0.26); part(g, CYL, glowM('#ff7ab8'), 0, -0.82, 0, 0.12, 0.12, 0.12); for (let i = 0; i < 3; i++) part(g, TOR, toon('#ff7ab8'), 0, -0.15 - i * 0.18, 0, 0.17, 0.17, 0.4, Math.PI / 2); bear.heldPose = 'heavy'; }
  else if (kind === 'tesla') { part(g, BOX, toon('#d8dde6'), 0, -0.25, 0, 0.24, 0.55, 0.24); part(g, CYL, glowM('#8fd8ff'), 0, -0.6, 0, 0.08, 0.2, 0.08); bear.heldPose = 'heavy'; }
  bear.detailsDirty = true;
}
export function heroBear(h, { name, look } = {}) {
  // 영웅 장비는 herolooks.js 가 직접 입힌다 (없는 영웅만 예전 꾸미기)
  const bear = new Roach({ own: true, seed: name || h.id, color: h.color, age: 25, look: { ...(look || {}), hat: 0, face: 0, outfit: 0, extra: 0, ears: 0 }, accessories: hasLook(h.id) ? [] : h.acc || [] });
  dressHero(bear, h.id);
  const held = h.held || null;
  if (['hammer', 'staff', 'cannons', 'scrap', 'particle', 'tesla'].includes(held)) { bear.setHeld(null); customHeld(bear, held, h.color); }
  else bear.setHeld(held ? (held.includes(':') ? held : `${held}:${h.color}`) : null);
  const size = h.role === 'tank' ? (h.id === 'dva' ? 1.22 : 1.14) : 1;
  bear.root.scale.setScalar(0.85 * size); bear.size = size;
  return bear;
}
// 뿅뿅 로봇: 곰돌이를 태운 분홍 젤리 로봇 (몸통 · 다리 · 양팔 캐논)
export function dvaMech() {
  const g = new THREE.Group(), pink = toon('#ff9fcf'), white = toon('#fff4fb'), dark = toon('#3b3f4a');
  part(g, SPH, pink, 0, 1.25, 0, 0.95, 0.75, 0.95); part(g, SPH, white, 0, 1.35, -0.45, 0.6, 0.45, 0.4);
  for (const s of [-1, 1]) { part(g, CYL, dark, s * 0.45, 0.45, 0.1, 0.16, 0.9, 0.16); part(g, BOX, pink, s * 0.45, 0.08, 0, 0.36, 0.18, 0.55); part(g, BOX, pink, s * 1.0, 1.2, -0.3, 0.32, 0.32, 0.8); part(g, CYL, dark, s * 1.0, 1.2, -0.85, 0.1, 0.4, 0.1, Math.PI / 2); part(g, SPH, glowM('#ffd0ec', 0.8), s * 0.6, 1.1, 0.95, 0.12, 0.08, 0.04); }
  part(g, BOX, toon('#7cd8ff'), 0, 1.45, -0.86, 0.5, 0.12, 0.05);
  // 메카: 뒤 부스터 둘 · 앞 토끼 무늬 · 흰 줄 · 어깨 범퍼
  for (const s of [-1, 1]) { part(g, CYL, dark, s * 0.45, 1.35, 0.85, 0.2, 0.5, 0.2, Math.PI / 2); part(g, SPH, glowM('#ffb3e6', 0.7), s * 0.45, 1.35, 1.12, 0.14, 0.14, 0.08); part(g, SPH, white, s * 0.78, 1.55, -0.1, 0.3, 0.22, 0.32); part(g, BOX, white, s * 0.55, 1.15, -0.82, 0.12, 0.5, 0.05); }
  part(g, SPH, toon('#ff5fa2'), 0, 1.0, -0.92, 0.12, 0.1, 0.04); for (const s of [-1, 1]) part(g, SPH, toon('#ff5fa2'), s * 0.07, 1.14, -0.9, 0.04, 0.1, 0.03);
  // 로봇 앞(-z)을 곰돌이 얼굴 쪽(+z)으로 돌려서 묶는다 (같은 방향을 보게)
  const outer = new THREE.Group(); g.rotation.y = Math.PI; outer.add(g);
  return outer;
}

// ---------- 머리 위 이름 · 체력 ----------
export class Plate {
  constructor(name, team, mine) {
    this.c = document.createElement('canvas'); this.c.width = 256; this.c.height = 72;
    this.tex = new THREE.CanvasTexture(this.c);
    this.s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthWrite: false, transparent: true }));
    this.s.scale.set(2.3, 0.65, 1); this.name = name; this.team = team; this.mine = mine; this.key = '';
  }
  draw(hp, max, temp, ult) {
    const key = `${Math.round(hp)}|${max}|${Math.round(temp)}|${ult >= 100}`; if (key === this.key) return; this.key = key;
    const x = this.c.getContext('2d'); x.clearRect(0, 0, 256, 72);
    const col = this.mine ? '#7cd8ff' : '#ff5a6e';
    x.font = 'bold 26px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText(this.name, 128, 20); x.fillStyle = this.mine ? '#e6f7ff' : '#ffe0e6'; x.fillText(this.name, 128, 20);
    // 25 마다 한 칸 (칸 나뉜 체력)
    const W = 200, X = 28, Y = 42, H = 14, segs = Math.min(26, Math.ceil(max / 25)), sw = W / segs;
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(X - 3, Y - 3, W + 6, H + 6);
    const k = Math.max(0, hp / max), kt = Math.min(1 - k, temp / max);
    for (let i = 0; i < segs; i++) {
      const s0 = i / segs, s1 = (i + 1) / segs;
      const f = Math.max(0, Math.min(1, (k - s0) / (s1 - s0))), ft = Math.max(0, Math.min(1, (k + kt - s0) / (s1 - s0)));
      x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(X + i * sw + 1, Y, sw - 2, H);
      if (ft > 0) { x.fillStyle = '#ffe48a'; x.fillRect(X + i * sw + 1, Y, (sw - 2) * ft, H); }
      if (f > 0) { x.fillStyle = col; x.fillRect(X + i * sw + 1, Y, (sw - 2) * f, H); }
    }
    if (this.mine && ult >= 100) { x.font = '22px sans-serif'; x.fillText('⭐', 240, 48); }
    this.tex.needsUpdate = true;
  }
}

// ---------- 1인칭 무기 ----------
const side0 = (vm) => vm.swingSide || 1;
export class HeroVM {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 1.7));
    const dl = new THREE.DirectionalLight('#ffffff', 1.2); dl.position.set(1, 2, 1); this.scene.add(dl);
    this.cam = new THREE.PerspectiveCamera(66, 1, 0.01, 20);
    this.rig = new THREE.Group(); this.scene.add(this.rig);
    this.kickT = 0; this.swingT = 0; this.swingDur = 0.3; this.bob = 0; this.ads = 0; this.reloadT = 0; this.reloadDur = 1; this.glowT = 0; this.kind = '';
  }
  set(kind, col) {
    if (kind === this.kind && col === this.col) return;
    this.kind = kind; this.col = col; this.rig.clear(); this.muzzles = []; this.head = null; this.fl = null;
    if (this.trail) { this.scene.remove(this.trail, this.guard); this.trail = this.guard = null; }
    const g = this.rig, m = toon(col), dark = toon('#33363f'), metal = toon('#8f97a6'), gold = toon('#ffd36b');
    const paw = toon(col, { transparent: true, opacity: 0.95 });
    const pawAt = (x, y, z, s = 1) => { const p = part(g, SPH, paw, x, y, z, 0.075 * s, 0.068 * s, 0.1 * s); return p; };
    const mz = (x, y, z) => this.muzzles.push(new THREE.Vector3(x, y, z));
    switch (kind) {
      case 'hammer': { const h = new THREE.Group(); h.position.set(0.32, -0.32, -0.55); h.rotation.set(0.5, 0, -0.3); g.add(h); part(h, CYL, toon('#7a5a3a'), 0, 0.2, 0, 0.035, 1.1, 0.035); part(h, BOX, toon('#c9d2e3'), 0, 0.8, 0, 0.42, 0.3, 0.3); part(h, BOX, toon('#ff8f4a'), 0.22, 0.8, 0, 0.04, 0.22, 0.22); part(h, BOX, gold, 0, 0.8, 0, 0.44, 0.06, 0.32); pawAt(0.3, -0.42, -0.45, 1.3); pawAt(0.2, -0.3, -0.62, 1.3); this.swingDur = 0.55; this.head = h; break; }
      case 'tesla': part(g, BOX, toon('#d8dde6'), 0.25, -0.22, -0.5, 0.18, 0.16, 0.5); part(g, CYL, metal, 0.25, -0.2, -0.8, 0.05, 0.16, 0.05, Math.PI / 2); for (let i = 0; i < 3; i++) part(g, TOR, toon('#8fd8ff'), 0.25, -0.22, -0.4 - i * 0.12, 0.12, 0.12, 0.5); part(g, SPH, glowM('#bfefff'), 0.25, -0.2, -0.9, 0.05, 0.05, 0.05); pawAt(0.25, -0.33, -0.35, 1.2); mz(0.25, -0.2, -0.9); break;
      case 'cannons': for (const s of [-1, 1]) { part(g, BOX, m, s * 0.42, -0.36, -0.62, 0.22, 0.22, 0.6); part(g, CYL, dark, s * 0.42, -0.34, -0.98, 0.07, 0.2, 0.07, Math.PI / 2); part(g, BOX, toon('#fff4fb'), s * 0.42, -0.24, -0.6, 0.18, 0.04, 0.4); mz(s * 0.42, -0.34, -1.1); } break;
      case 'pilot': part(g, BOX, toon('#ff9fcf'), 0.24, -0.2, -0.45, 0.06, 0.09, 0.22); part(g, BOX, dark, 0.24, -0.27, -0.38, 0.05, 0.12, 0.06); pawAt(0.24, -0.3, -0.36); mz(0.24, -0.19, -0.58); break;
      case 'scrap': part(g, BOX, toon('#8a6a4a'), 0.26, -0.26, -0.55, 0.16, 0.18, 0.6); part(g, CYL, dark, 0.26, -0.24, -0.92, 0.08, 0.2, 0.08, Math.PI / 2); part(g, CYL, toon('#c98a3a'), 0.26, -0.36, -0.5, 0.1, 0.12, 0.1, 0, 0, Math.PI / 2); pawAt(0.26, -0.36, -0.32, 1.3); pawAt(0.22, -0.32, -0.75, 1.3); mz(0.26, -0.24, -1.02); break;
      case 'particle': part(g, BOX, dark, 0.28, -0.3, -0.55, 0.2, 0.2, 0.75); for (let i = 0; i < 3; i++) part(g, TOR, toon('#ff7ab8'), 0.28, -0.3, -0.35 - i * 0.18, 0.14, 0.14, 0.4); part(g, SPH, glowM('#ffb3dd'), 0.28, -0.29, -0.95, 0.09, 0.09, 0.09); pawAt(0.28, -0.42, -0.35, 1.2); pawAt(0.24, -0.4, -0.7, 1.2); mz(0.28, -0.29, -0.98); break;
      case 'rpg': part(g, CYL, toon('#4f8fe8'), 0.3, -0.22, -0.5, 0.1, 0.9, 0.1, Math.PI / 2); part(g, CYL, toon('#ffd36b'), 0.3, -0.22, -0.95, 0.11, 0.05, 0.11, Math.PI / 2); part(g, BOX, dark, 0.3, -0.34, -0.4, 0.05, 0.14, 0.06); pawAt(0.3, -0.36, -0.36, 1.1); pawAt(0.26, -0.3, -0.68); mz(0.3, -0.22, -1.0); break;
      case 'shotgun2': this.fl = [-1, 1].map((s) => { const f = part(g, SPH, glowM('#ff5a4a', 0.9), s * 0.3, -0.24, -0.95, 0.12, 0.12, 0.12); f.visible = false; return f; }); for (const s of [-1, 1]) { part(g, BOX, toon('#2a2733'), s * 0.3, -0.26, -0.5, 0.09, 0.12, 0.5); part(g, CYL, dark, s * 0.3, -0.24, -0.8, 0.045, 0.14, 0.045, Math.PI / 2); part(g, BOX, toon('#c0392b'), s * 0.3, -0.19, -0.5, 0.02, 0.02, 0.4); pawAt(s * 0.3, -0.34, -0.36); mz(s * 0.3, -0.24, -0.88); } break;
      case 'revolver': part(g, BOX, toon('#5a5f6a'), 0.24, -0.2, -0.48, 0.06, 0.08, 0.32); part(g, CYL, toon('#8f97a6'), 0.24, -0.2, -0.4, 0.06, 0.08, 0.06, 0, 0, Math.PI / 2); part(g, BOX, toon('#7a4f2d'), 0.24, -0.28, -0.36, 0.05, 0.14, 0.07, 0.3); pawAt(0.24, -0.31, -0.34); mz(0.24, -0.19, -0.66); break;
      case 'rifle': part(g, BOX, toon('#e8edf5'), 0.26, -0.24, -0.5, 0.1, 0.14, 0.62); part(g, BOX, toon('#5a7099'), 0.26, -0.16, -0.5, 0.08, 0.04, 0.4); part(g, CYL, dark, 0.26, -0.22, -0.88, 0.035, 0.2, 0.035, Math.PI / 2); part(g, BOX, glowM('#8fe6ff'), 0.26, -0.3, -0.7, 0.11, 0.05, 0.12); pawAt(0.26, -0.34, -0.34); pawAt(0.24, -0.3, -0.68); mz(0.26, -0.22, -0.98); break;
      case 'hands': pawAt(-0.28, -0.3, -0.5, 1.2); pawAt(0.28, -0.3, -0.5, 1.2); this.gL = part(g, SPH, glowM('#ffe48a', 0.6), -0.28, -0.24, -0.58, 0.07, 0.07, 0.07); this.gR = part(g, SPH, glowM('#c08bff', 0.6), 0.28, -0.24, -0.58, 0.07, 0.07, 0.07); mz(-0.28, -0.24, -0.62); mz(0.28, -0.24, -0.62); break;
      case 'shuriken': pawAt(0.26, -0.28, -0.5); { const s = part(g, BOX, toon('#d8dde6'), 0.26, -0.22, -0.55, 0.12, 0.012, 0.12, 0, Math.PI / 4); this.spin = s; } mz(0.26, -0.22, -0.6); break;
      case 'sword': { const s = new THREE.Group(); s.position.set(0.3, -0.3, -0.5); s.rotation.set(-0.9, 0.2, 0.3); g.add(s); part(s, CYL, toon('#3b3f4a'), 0, 0, 0, 0.03, 0.25, 0.03); part(s, BOX, glowM('#b6ff8a', 0.85), 0, 0.6, 0, 0.05, 0.95, 0.012); part(s, BOX, toon('#ffffff'), 0, 0.6, 0, 0.02, 0.95, 0.014); pawAt(0.3, -0.36, -0.46); this.swingDur = 0.4; this.head = s;
        // 용검 베기 궤적 (초승달) · 튕겨내기 막 (앞을 가리는 초록 막)
        const mat = (o) => new THREE.MeshBasicMaterial({ color: '#8dff5a', transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false });
        const add = (geo) => { const m = new THREE.Mesh(geo, mat(0)); m.visible = false; this.scene.add(m); return m; };
        this.trail = add(new THREE.RingGeometry(0.46, 0.56, 40, 1, 0.25, Math.PI * 0.6)); this.trail.position.set(0, -0.42, -0.95);
        this.guard = add(new THREE.RingGeometry(0.3, 0.33, 48)); this.guard.position.set(0, -0.1, -0.9);
        this.guard.add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 48), mat(0.07)));
        break; }
      case 'sniper': part(g, BOX, toon('#5b3f8f'), 0.24, -0.24, -0.55, 0.08, 0.12, 0.8); part(g, CYL, dark, 0.24, -0.2, -1.05, 0.025, 0.4, 0.025, Math.PI / 2); part(g, CYL, dark, 0.24, -0.13, -0.5, 0.04, 0.28, 0.04, Math.PI / 2); part(g, SPH, glowM('#ff6bd6'), 0.24, -0.13, -0.66, 0.03, 0.03, 0.03); pawAt(0.24, -0.34, -0.34); pawAt(0.22, -0.3, -0.75); mz(0.24, -0.2, -1.26); break;
      case 'pistols': for (const s of [-1, 1]) { part(g, BOX, toon('#ffa04a'), s * 0.26, -0.22, -0.45, 0.06, 0.08, 0.24); part(g, BOX, glowM('#9fe8ff'), s * 0.26, -0.18, -0.45, 0.065, 0.02, 0.2); part(g, BOX, dark, s * 0.26, -0.28, -0.38, 0.05, 0.1, 0.05); pawAt(s * 0.26, -0.3, -0.36); mz(s * 0.26, -0.21, -0.58); } break;
      case 'staff': { const s = new THREE.Group(); s.position.set(0.3, -0.36, -0.55); s.rotation.set(-1.15, 0, 0.12); g.add(s); part(s, CYL, toon('#ffffff'), 0, 0.2, 0, 0.022, 1.0, 0.022); part(s, SPH, gold, 0, 0.72, 0, 0.06, 0.06, 0.06); part(s, BOX, gold, 0.07, 0.68, 0, 0.12, 0.03, 0.015, 0, 0, 0.5); part(s, BOX, gold, -0.07, 0.68, 0, 0.12, 0.03, 0.015, 0, 0, -0.5); this.tip = part(s, SPH, glowM('#ffe48a', 0.8), 0, 0.78, 0, 0.05, 0.05, 0.05); pawAt(0.3, -0.38, -0.42); } mz(0.32, -0.12, -0.95); break;
      case 'biorifle': part(g, BOX, toon('#6f8fb2'), 0.24, -0.24, -0.55, 0.08, 0.12, 0.75); part(g, CYL, dark, 0.24, -0.21, -0.98, 0.03, 0.25, 0.03, Math.PI / 2); part(g, CYL, glowM('#c8ff7a', 0.8), 0.24, -0.33, -0.55, 0.035, 0.18, 0.035, Math.PI / 2); part(g, CYL, dark, 0.24, -0.14, -0.5, 0.035, 0.22, 0.035, Math.PI / 2); pawAt(0.24, -0.34, -0.34); pawAt(0.22, -0.3, -0.72); mz(0.24, -0.21, -1.12); break;
      case 'sonic': part(g, BOX, toon('#86d957'), 0.26, -0.24, -0.5, 0.14, 0.14, 0.42); part(g, CYL, toon('#ffd84d'), 0.26, -0.24, -0.76, 0.09, 0.08, 0.09, Math.PI / 2); part(g, SPH, glowM('#d6ff9a'), 0.26, -0.24, -0.8, 0.06, 0.06, 0.03); pawAt(0.26, -0.34, -0.36); mz(0.26, -0.24, -0.84); break;
      case 'paws': this.pL = pawAt(-0.3, -0.3, -0.45, 2.2); this.pR = pawAt(0.3, -0.3, -0.45, 2.2); this.swingDur = 0.35; break;
    }
  }
  kick(k = 0.6) { this.kickT = Math.min(1, this.kickT + k); }
  swing(dur) { this.swingT = dur || this.swingDur; this.swingLen = this.swingT; this.swingSide = -(this.swingSide || 1); }
  reload(d) { this.reloadT = d; this.reloadDur = d; }
  update(dt, aspect, moving, ads, glow, deflect, bloom) {
    this.cam.aspect = aspect; this.cam.updateProjectionMatrix();
    this.ads += ((ads ? 1 : 0) - this.ads) * Math.min(1, dt * 12);
    this.kickT = Math.max(0, this.kickT - dt * 6); this.swingT = Math.max(0, this.swingT - dt); this.reloadT = Math.max(0, this.reloadT - dt);
    if (moving) this.bob += dt * 9;
    const rel = this.reloadT > 0 ? Math.sin((1 - this.reloadT / this.reloadDur) * Math.PI) : 0, bobA = moving ? 1 - this.ads * 0.8 : 0;
    const g = this.rig;
    // 무기를 작게 · 조금 멀리 (화면을 덜 가리게)
    g.scale.setScalar(0.5);
    g.position.set(Math.sin(this.bob) * 0.007 * bobA - this.ads * 0.13 + 0.05, -Math.abs(Math.cos(this.bob)) * 0.007 * bobA - rel * 0.1 + this.ads * 0.03 - 0.03, -0.34 + this.kickT * 0.035);
    g.rotation.set(this.kickT * 0.1 + rel * 0.5, rel * 0.3, 0);
    if (this.swingT > 0) {
      const s = Math.sin((1 - this.swingT / this.swingLen) * Math.PI), side = this.swingSide || 1;
      if (this.kind === 'hammer') g.rotation.set(-s * 0.2, side * s * 1.1, side * s * 0.8);
      else if (this.kind === 'paws') { this.pL.position.z = -0.45 - (side < 0 ? s * 0.4 : 0); this.pR.position.z = -0.45 - (side > 0 ? s * 0.4 : 0); }
      else if (this.kind !== 'sword') g.rotation.set(-s * 0.3, side * s * 0.9, -side * s * 0.6);
    }
    if (this.kind === 'sword' && this.trail) this.swordPose(dt, side0(this), deflect);
    // 죽음의 꽃: 두 총을 번갈아 쏘며 좌우로 휘두른다 (총구 불꽃)
    if (this.fl) { const n = performance.now() / 1000; g.rotation.y += bloom ? Math.sin(n * 13) * 0.45 : 0; g.rotation.z += bloom ? Math.sin(n * 13) * 0.15 : 0; this.fl.forEach((f, i) => { f.visible = !!bloom && Math.sin(n * 60 + i * Math.PI) > 0.2; f.scale.setScalar(0.1 + Math.random() * 0.08); }); }
    if (this.spin) this.spin.rotation.y += dt * 20;
    const pulse = 0.6 + Math.sin(performance.now() / 90) * 0.25;
    if (this.gL) { this.gL.material.opacity = glow === 'L' ? pulse + 0.3 : 0.35; this.gR.material.opacity = glow === 'R' ? pulse + 0.3 : 0.35; }
    if (this.tip) this.tip.material.opacity = glow ? pulse + 0.3 : 0.5;
    g.visible = this.ads < 0.85 || !(this.kind === 'sniper' || this.kind === 'biorifle');
  }
  // 칼: 베기는 화면을 가로질러 크게 휘두르고(초승달 궤적), 튕겨내기는 앞에서 칼을 빠르게 휘저으며 초록 막을 친다
  swordPose(dt, side, deflect) {
    const h = this.head, now = performance.now() / 1000;
    this.guardK = Math.max(0, Math.min(1, (this.guardK || 0) + (deflect ? dt * 8 : -dt * 6)));
    if (this.swingT > 0) {
      const p = 1 - this.swingT / this.swingLen, e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      h.position.set(side * (0.75 - 1.5 * e), -0.05 - 0.25 * e, -0.55 - Math.sin(p * Math.PI) * 0.25);
      h.rotation.set(-1.25, side * (0.4 - 0.8 * e), side * (1.35 - 2.2 * e)); h.scale.setScalar(1 + Math.sin(p * Math.PI) * 0.35);
      const tr = this.trail; tr.visible = p > 0.1 && p < 0.95; tr.material.opacity = Math.sin(p * Math.PI) * 0.55;
      tr.scale.set(side, 1, 1); tr.rotation.set(-0.35, 0, side * (0.6 - 1.6 * e));
    } else if (this.guardK > 0) {
      const w = Math.sin(now * 26);
      h.position.set(0.12 + w * 0.12, -0.32, -0.55); h.rotation.set(-0.55, 0, 0.25 + w * 0.7);
      this.trail.visible = false;
    } else { h.position.set(0.3, -0.3, -0.5); h.rotation.set(-0.9, 0.2, 0.3); this.trail.visible = false; }
    if (this.swingT <= 0) h.scale.setScalar(1);
    const gd = this.guard; gd.visible = this.guardK > 0.01;
    if (gd.visible) { gd.material.opacity = this.guardK * (0.55 + Math.sin(now * 14) * 0.15); gd.scale.setScalar(0.7 + this.guardK * 0.3); gd.rotation.z = now * 3; }
  }
  render(renderer) { renderer.clearDepth(); renderer.render(this.scene, this.cam); }
}

// ---------- 효과 ----------
const fx = [];
export function puff(scene, p, color, n = 6, size = 0.25, spread = 2, life = 0.45) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(size * (0.6 + Math.random())); s.position.copy(p); scene.add(s);
    fx.push({ o: s, t: life, life, v: new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread), g: 6 });
  }
}
export function ring(scene, p, color, r = 4, life = 0.5, y = 0.05) {
  const o = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  o.rotation.x = -Math.PI / 2; o.position.set(p.x, p.y + y, p.z); scene.add(o);
  fx.push({ o, t: life, life, grow: r });
}
export function flashSphere(scene, p, color, r = 2, life = 0.35) {
  const o = new THREE.Mesh(SPH, glowM(color, 0.7)); o.position.copy(p); o.scale.setScalar(r * 0.3); scene.add(o);
  fx.push({ o, t: life, life, grow3: r });
}
export function line(scene, a, b, color = '#fff3b0', life = 0.08, width = 0.025) {
  const o = beamMesh(color, width); setBeam(o, a, b); scene.add(o);
  fx.push({ o, t: life, life, keep: true });
}
export function dmgNum(scene, p, n, head, heal) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d'); x.font = `bold ${head ? 46 : 38}px Jua, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.65)'; const s = `${heal ? '+' : ''}${Math.max(1, Math.round(n))}`; x.strokeText(s, 64, 32);
  x.fillStyle = heal ? '#9cff9a' : head ? '#ff5a5a' : '#ffffff'; x.fillText(s, 64, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(1.1, 0.55, 1); sp.position.copy(p); sp.position.x += (Math.random() - 0.5) * 0.6; sp.renderOrder = 10; scene.add(sp);
  fx.push({ o: sp, t: 0.8, life: 0.8, v: new THREE.Vector3(0, 1.6, 0), g: 0, tex: true });
}
export function updateFx(dt, scene) {
  for (const f of fx) {
    f.t -= dt; const k = Math.max(0, f.t / f.life);
    if (f.v) { f.o.position.addScaledVector(f.v, dt); f.v.y -= (f.g || 0) * dt; }
    if (f.grow) { const s = f.grow * (1 - k * 0.85); f.o.scale.set(s, s, s); }
    if (f.grow3) f.o.scale.setScalar(f.grow3 * (1.1 - k * 0.6));
    if (f.o.material) f.o.material.opacity = (f.keep ? 0.9 : f.grow || f.grow3 ? 0.8 : 1) * k;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t <= 0) { const o = fx[i].o; scene.remove(o); if (fx[i].tex) o.material.map.dispose(); o.material?.dispose?.(); if (o.geometry && o.geometry !== SPH && o.geometry !== CYL) o.geometry.dispose(); fx.splice(i, 1); }
}

// 줄기 (치유 · 테슬라 · 입자포 · 흡수): 늘였다 줄이는 원기둥 하나
export function beamMesh(color, width = 0.06) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(CYL, glowM(color, 0.85)), new THREE.Mesh(CYL, glowM('#ffffff', 0.7)));
  g.children[1].scale.set(0.35, 1, 0.35); g.userData.w = width; return g;
}
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function setBeam(g, a, b, wobble = 0) {
  _d.subVectors(b, a); const L = _d.length();
  g.position.copy(a).addScaledVector(_d, 0.5);
  g.quaternion.setFromUnitVectors(_up, _d.normalize());
  const w = g.userData.w * (1 + (wobble ? Math.sin(performance.now() / 40) * wobble : 0));
  g.scale.set(w, L, w);
}

// ---------- 설치물 (서버 ents) ----------
export class EntViews {
  constructor(scene) { this.scene = scene; this.map = new Map(); }
  sync(list, myTeam) {
    const seen = new Set();
    for (const [id, k, team, x, y, z, yaw, hp, max] of list) {
      seen.add(id);
      let v = this.map.get(id);
      if (!v) { v = this.make(k, team, myTeam); v.k = k; this.map.set(id, v); this.scene.add(v.o); v.o.position.set(x, y, z); }
      v.tgt = { x, y, z, yaw }; v.hp = hp; v.max = max; v.team = team; v.id = id;
    }
    for (const [id, v] of this.map) if (!seen.has(id)) { this.scene.remove(v.o); this.map.delete(id); }
  }
  list() { return [...this.map.values()].map((v) => ({ id: v.id, k: v.k, team: v.team, x: v.o.position.x, y: v.o.position.y, z: v.o.position.z, yaw: v.yaw ?? v.tgt.yaw, hp: v.hp })); }
  make(k, team, myTeam) {
    const col = team === myTeam ? '#7cd8ff' : '#ff6a8a', o = new THREE.Group();
    if (k === 'shield') {
      const tx = hexTex().clone(); tx.repeat.set(5, 2.4); tx.needsUpdate = true;
      const m = new THREE.MeshBasicMaterial({ color: col, map: tx, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const geo = new THREE.CylinderGeometry(3.2, 3.2, 3, 24, 1, true, -0.85, 1.7); geo.translate(0, 1.5, -1.6);
      const pl = new THREE.Mesh(geo, m); pl.rotation.y = Math.PI; o.add(pl);
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.06, 24, 1, true, -0.85, 1.7), glowM(col, 0.9)); edge.position.set(0, 3, 0); edge.geometry.translate(0, 0, -1.6); edge.rotation.y = Math.PI; o.add(edge);
      return { o, mat: m, own: team === myTeam };
    }
    if (k === 'dome') { const dt = hexTex().clone(); dt.repeat.set(8, 3); dt.needsUpdate = true; const m = new THREE.MeshBasicMaterial({ color: col, map: dt, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }); const s = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), m); o.add(s); part(o, CYL, toon('#d8dde6'), 0, 0.2, 0, 0.25, 0.4, 0.25); return { o, mat: m }; }
    if (k === 'field') { const r = new THREE.Mesh(new THREE.RingGeometry(4.6, 5, 48), glowM('#7cff9a', 0.6)); r.rotation.x = -Math.PI / 2; r.position.y = 0.06; o.add(r); const c = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 40, 1, true), new THREE.MeshBasicMaterial({ color: '#7cff9a', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })); c.position.y = 1.2; o.add(c); part(o, CYL, toon('#ffffff'), 0, 0.25, 0, 0.18, 0.5, 0.18); part(o, SPH, glowM('#9cff9a'), 0, 0.6, 0, 0.12, 0.12, 0.12); return { o, spin: c }; }
    if (k === 'mine') { part(o, SPH, toon('#9466e0'), 0, 0.12, 0, 0.22, 0.14, 0.22); part(o, SPH, glowM(team === myTeam ? '#c79bff' : '#ff6aa8'), 0, 0.2, 0, 0.08, 0.08, 0.08); return { o }; }
    if (k === 'orb') { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#e2a6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(1.6); o.add(s); part(o, SPH, glowM('#f2deff', 0.9), 0, 0, 0, 0.3, 0.3, 0.3); const r = new THREE.Mesh(new THREE.RingGeometry(4, 4.2, 40), glowM('#d38bff', 0.25)); r.rotation.x = -Math.PI / 2; r.position.y = -1.15; o.add(r); return { o }; }
    if (k === 'grav') { const s = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), glowM('#b48aff', 0.55)); o.add(s); const sh = new THREE.Mesh(new THREE.SphereGeometry(6.5, 32, 20), new THREE.MeshBasicMaterial({ color: '#9b6bff', transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false })); o.add(sh); for (let i = 0; i < 3; i++) { const t = part(o, TOR, glowM('#c9b0ff', 0.28), 0, 0, 0, 2 + i * 1.3, 2 + i * 1.3, 2 + i * 1.3, Math.random() * 3, Math.random() * 3, 0); t.userData.spin = 1 + i; } return { o, core: s }; }
    if (k === 'bomb') { const m = dvaMech(); m.scale.setScalar(0.8); o.add(m); const l = part(o, SPH, glowM('#ff3b6b', 0.0), 0, 1, 0, 1.4, 1.4, 1.4); return { o, blink: l }; }
    if (k === 'pulse') { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#7cf0ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(1.3); o.add(s); part(o, SPH, toon('#ffffff'), 0, 0, 0, 0.16, 0.16, 0.16); return { o, blink: s }; }
    return { o };
  }
  update(dt) {
    const t = performance.now() / 1000;
    for (const v of this.map.values()) {
      const o = v.o, g = v.tgt;
      o.position.x += (g.x - o.position.x) * Math.min(1, dt * 15); o.position.y += (g.y - o.position.y) * Math.min(1, dt * 15); o.position.z += (g.z - o.position.z) * Math.min(1, dt * 15);
      if (v.k === 'shield') { let d = g.yaw - (v.yaw ?? g.yaw); d = Math.atan2(Math.sin(d), Math.cos(d)); v.yaw = (v.yaw ?? g.yaw) + d * Math.min(1, dt * 18); o.rotation.y = v.yaw; v.mat.opacity = (v.own ? 0.12 : 0.25) + (v.own ? 0.12 : 0.3) * Math.max(0.15, v.hp / (v.max || 1)); }
      if (v.k === 'dome') v.mat.opacity = 0.18 + 0.2 * Math.max(0.2, v.hp / (v.max || 1));
      if (v.spin) v.spin.rotation.y += dt;
      if (v.core) { v.core.scale.setScalar(1 + Math.sin(t * 9) * 0.1); for (const c of o.children) if (c.userData.spin) { c.rotation.x += dt * c.userData.spin; c.rotation.y += dt * 1.3; } }
      if (v.blink) v.blink.material.opacity = (Math.sin(t * (v.k === 'bomb' ? 14 : 20)) > 0 ? 0.5 : 0.1);
      if (v.k === 'orb') o.rotation.y += dt * 3;
    }
  }
}
// 방벽 판정용 사각 (화면에서 쏠 때)
export { shieldRect };

// ---------- 투사체 (보기 · 내 것은 판정도) ----------
export function projMesh(k) {
  const P = PROJ[k] || PROJ.rocket, g = new THREE.Group();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: P.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(P.size * 4); g.add(s);
  if (k === 'rocket' || k === 'helix' || k === 'barrage' || k === 'mini') { const b = part(g, CYL, toon(k === 'mini' ? '#ff9fcf' : '#dfe8f5'), 0, 0, 0, P.size * 0.45, P.size * 2.4, P.size * 0.45); b.rotation.x = Math.PI / 2; g.userData.orient = true; }
  else if (k === 'shuri') { const b = part(g, BOX, toon('#e6eef5'), 0, 0, 0, 0.22, 0.02, 0.22, 0, Math.PI / 4); g.userData.spin = b; }
  else if (k === 'fire') { s.scale.set(3.4, 1.6, 1); s.material.color.set('#ff8a3c'); const s2 = s.clone(); s2.material = s.material.clone(); s2.material.color.set('#ffe08a'); s2.scale.set(1.8, 0.9, 1); g.add(s2); }
  else if (k === 'hook') { part(g, BOX, toon('#9aa0ab'), 0, 0, 0, 0.3, 0.3, 0.12); }
  else if (k === 'grav') part(g, SPH, glowM('#e6d6ff', 0.9), 0, 0, 0, 0.3, 0.3, 0.3);
  else part(g, SPH, toon(P.color), 0, 0, 0, P.size * 0.6, P.size * 0.6, P.size * 0.6);
  return g;
}
export function trailPuff(scene, p, k) { const P = PROJ[k]; if (!P?.trail) return; puff(scene, p, P.trail, 1, P.size * 2.2, 0.3, 0.3); }
