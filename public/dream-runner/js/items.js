// 아이템전: 길 위의 ? 상자를 먹으면 아이템이 하나 생긴다 (최대 2개). Q 로 앞의 것부터 쓴다
import * as THREE from 'three';

export const MAX_ITEMS = 2;
export const ITEMS = {
  rocket: { emoji: '🚀', name: '로켓', desc: '3초 동안 초고속', dur: 3 },
  shield: { emoji: '🛡️', name: '방어막', desc: '장애물 · 밀치기 · 함정을 한 번 막아 줘요', dur: 10 },
  cloud: { emoji: '☁️', name: '구름발판', desc: '5초 동안 떨어지지 않아요', dur: 5 },
  magnet: { emoji: '🧲', name: '자석', desc: '8초 동안 별사탕을 끌어당겨요', dur: 8 },
  ghost: { emoji: '👻', name: '유령', desc: '4초 동안 장애물을 통과해요', dur: 4 },
  wave: { emoji: '💥', name: '충격파', desc: '앞의 장애물을 부수고 주변 사람을 밀쳐 내요' },
  trap: { emoji: '🍯', name: '젤리 함정', desc: '뒤에 끈적이를 남겨요. 밟으면 미끄러지고 느려져요', multi: true },
  teleport: { emoji: '🌀', name: '순간이동', desc: '앞쪽 안전한 발판으로 휙!' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export function randomItem(multi) {
  const ids = ITEM_IDS.filter((k) => multi || !ITEMS[k].multi); // 혼자 달릴 땐 함정은 안 나온다
  return ids[Math.floor(Math.random() * ids.length)];
}

// ---------- ? 상자 ----------
let _boxTex = null;
function boxTex() {
  if (_boxTex) return _boxTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 128);
  ['#ff6fae', '#ffd166', '#7cf0c8', '#6ec3ff', '#b388ff'].forEach((col, i) => g.addColorStop(i / 4, col));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 8; x.strokeRect(6, 6, 116, 116);
  x.font = 'bold 84px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.fillText('?', 64, 70);
  _boxTex = new THREE.CanvasTexture(c); _boxTex.colorSpace = THREE.SRGBColorSpace;
  return _boxTex;
}
const BOX_G = new THREE.BoxGeometry(0.85, 0.85, 0.85);
const BOX_M = new THREE.MeshBasicMaterial({ map: null, transparent: true, opacity: 0.95 });
export function makeBox() {
  if (!BOX_M.map) { BOX_M.map = boxTex(); BOX_M.needsUpdate = true; }
  const g = new THREE.Group();
  const m = new THREE.Mesh(BOX_G, BOX_M); g.add(m);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff3b0', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(2); g.add(halo);
  return g;
}

// ---------- 젤리 함정 ----------
const TRAP_G = new THREE.CircleGeometry(1.1, 18);
const TRAP_M = new THREE.MeshBasicMaterial({ color: '#ff8fc8', transparent: true, opacity: 0.85, depthWrite: false });
export function makeTrap() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(TRAP_G, TRAP_M); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; g.add(m);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(BLOB_G, TRAP_M); const a = Math.random() * 6.28, r = Math.random() * 0.7; b.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r); b.scale.set(0.3 + Math.random() * 0.2, 0.12, 0.3 + Math.random() * 0.2); g.add(b); }
  return g;
}
const BLOB_G = new THREE.SphereGeometry(1, 10, 6);

let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (_glow = new THREE.CanvasTexture(c));
}

// ---------- 아이템 효과 모습 (나 · 같은 방 사람 모두) ----------
//   st = { shield, ghost, cloud, magnet, slow } (켜져 있으면 true/남은 시간)
export class EffectFx {
  constructor() {
    this.g = new THREE.Group();
    const add = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), add('#6ee7ff', 0.22)); this.shield.position.y = 0.95;
    this.shieldRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 6, 40), add('#c8f7ff', 0.8)); this.shieldRing.position.y = 0.95;
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#c39bff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); this.aura.scale.setScalar(3.2); this.aura.position.y = 1;
    this.magnet = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 40), add('#ff5a7a', 0.85)); this.magnet.rotation.x = Math.PI / 2; this.magnet.position.y = 0.7;
    this.cloud = new THREE.Group();
    const cm = new THREE.MeshToonMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 });
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(BLOB_G, cm); const a = (i / 6) * Math.PI * 2; p.position.set(Math.cos(a) * 0.55, -0.15, Math.sin(a) * 0.55); p.scale.setScalar(0.42 + (i % 2) * 0.12); this.cloud.add(p); }
    this.goo = new THREE.Group();
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(BLOB_G, TRAP_M); b.position.set((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.8); b.scale.set(0.25, 0.15, 0.25); this.goo.add(b); }
    this.g.add(this.shield, this.shieldRing, this.aura, this.magnet, this.cloud, this.goo);
    for (const c of this.g.children) c.visible = false;
  }
  attach(bear) { bear.root.add(this.g); this.bear = bear; }
  update(dt, t, st) {
    this.shield.visible = this.shieldRing.visible = !!st.shield;
    if (st.shield) { const k = 1 + Math.sin(t * 6) * 0.04; this.shield.scale.setScalar(k); this.shieldRing.rotation.set(t * 1.3, t * 0.7, 0); }
    this.aura.visible = !!st.ghost;
    // 유령: 몸이 깜빡깜빡
    if (this.bear) this.bear.inner.visible = !st.ghost || Math.sin(t * 40) > -0.3;
    this.magnet.visible = !!st.magnet;
    if (st.magnet) { this.magnet.rotation.z = t * 4; this.magnet.scale.setScalar(1 + Math.sin(t * 8) * 0.08); }
    this.cloud.visible = !!st.cloud;
    if (st.cloud) this.cloud.rotation.y = t * 1.5;
    this.goo.visible = !!st.slow;
  }
}
