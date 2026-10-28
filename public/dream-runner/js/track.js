// 꿈길 만들기: 씨앗(seed) 하나로 발판 · 장애물 · 별사탕 · 꿈이 바뀌는 문까지 똑같이 만든다
//   → 같은 방 사람들은 모두 같은 길을 달린다. 꿈(테마)은 거리로 정해서(약 20초 분량) 모두 같은 자리에서 바뀐다
//   좌표: s = 달린 거리(앞), x = 좌우(오른쪽 +), y = 높이. 화면에는 z = origin - s 로 그린다
import * as THREE from 'three';
import { RNG } from '../../shared/js/utils.js';
import { THEMES } from './themes.js';
import { glow, starG } from './kits.js';
import { makeBox, makeTrap } from './items.js';

export const V0 = 13, VMAX = 30;
export const speedAt = (s) => Math.min(VMAX, V0 + Math.max(0, s) / 220); // 달릴수록 빨라진다
export const DREAM_SEC = 20;
export const DEATH_Y = -16;       // 이 아래로 떨어지면 탈락
const AHEAD = 280, BEHIND = 40;

// ---------- 발판 무늬 (윗면 텍스처) ----------
const texCache = new Map();
function canvasTex(key, draw, size = 128) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const lum = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }; // 선형 밝기
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
// 발판 테두리 색: 테마 빛 색이 바닥과 잘 구분되면 그대로, 아니면 어두운 바닥엔 밝게 · 밝은 바닥엔 진하게
function rimColor(th) {
  if (th.edge && contrast(th.edge, th.plat[0]) >= 2.2) return th.edge;
  return lum(th.plat[0]) < 0.3 ? mix(th.plat[0], '#ffffff', 0.72) : shade(th.plat[1], th.style === 'cloud' ? 0.75 : 0.5);
}
// 장애물 색: 하늘 · 바닥과 모두 구분되는 강조색 + 하늘과 반대 밝기의 바탕/외곽선
const OB_ALT = ['#ff3b5c', '#ffb300', '#7c4dff', '#00c853'];
function obColors(th) {
  const sky = th.sky[1], cands = [th.edge, th.P?.a, ...OB_ALT].filter(Boolean);
  const acc = cands.find((c) => contrast(c, sky) >= 2 && contrast(c, th.plat[0]) >= 1.6) || cands.reduce((a, c) => (contrast(c, sky) > contrast(a, sky) ? c : a));
  const bright = lum(sky) > 0.45;
  return { acc, base: bright ? '#2a2a36' : '#ffffff', line: bright ? '#1a1a24' : '#ffffff' };
}
export function topTexture(style, top, side, edge) {
  const a = top, b = shade(top, 0.86), d = shade(top, 0.7);
  return canvasTex(`${style}|${top}|${side}|${edge}`, (x, n) => {
    x.fillStyle = a; x.fillRect(0, 0, n, n);
    const R = (k) => Math.random() * k;
    switch (style) {
      case 'brick': x.fillStyle = b; for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) { const o = r % 2 ? n / 6 : 0; x.fillRect(i * n / 3 + o + 3, r * n / 4 + 3, n / 3 - 6, n / 4 - 6); } break;
      case 'tile': x.strokeStyle = d; x.lineWidth = 3; for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * n / 2, 0); x.lineTo(i * n / 2, n); x.moveTo(0, i * n / 2); x.lineTo(n, i * n / 2); x.stroke(); } break;
      case 'wood': for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * n / 4, 0, n / 4, n); x.fillStyle = d; x.fillRect(i * n / 4, 0, 2, n); x.fillRect(i * n / 4 + 6, R(n), 3, 8); } break;
      case 'stripe': x.fillStyle = edge || '#ffffff'; for (let i = -1; i < 4; i++) { x.beginPath(); x.moveTo(i * n / 2, 0); x.lineTo(i * n / 2 + n / 4, 0); x.lineTo(i * n / 2 + n / 4 + n, n); x.lineTo(i * n / 2 + n, n); x.fill(); } break;
      case 'check': case 'disco': { const k = style === 'disco' ? 4 : 2; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { x.fillStyle = style === 'disco' ? ['#ff00ff', '#00f5ff', '#ffee00', '#7b2cbf'][(i * 3 + j * 5) % 4] : (i + j) % 2 ? side : top; x.fillRect(i * n / k, j * n / k, n / k, n / k); } break; }
      case 'grass': x.fillStyle = b; for (let i = 0; i < 40; i++) x.fillRect(R(n), R(n), 3, 7); x.fillStyle = shade(top, 1.15); for (let i = 0; i < 25; i++) x.fillRect(R(n), R(n), 2, 6); break;
      case 'noise': for (let i = 0; i < 90; i++) { x.fillStyle = Math.random() < 0.5 ? b : shade(top, 1.1); x.beginPath(); x.arc(R(n), R(n), 2 + R(7), 0, 7); x.fill(); } break;
      case 'cloud': x.fillStyle = shade(top, 0.95); for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(R(n), R(n), 8 + R(14), 0, 7); x.fill(); } break;
      case 'glass': x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.strokeRect(4, 4, n - 8, n - 8); x.beginPath(); x.moveTo(12, 30); x.lineTo(40, 12); x.stroke(); break;
      case 'grid': x.fillStyle = top; x.fillRect(0, 0, n, n); x.strokeStyle = edge || '#ff2bd6'; x.lineWidth = 3; x.shadowColor = edge || '#ff2bd6'; x.shadowBlur = 8; x.strokeRect(1, 1, n - 2, n - 2); break;
      case 'paper': x.fillStyle = shade(top, 0.92); for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(R(n), R(n)); x.lineTo(R(n), R(n)); x.lineTo(R(n), R(n)); x.fill(); } x.strokeStyle = 'rgba(80,140,220,.35)'; for (let y = 16; y < n; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(n, y); x.stroke(); } break;
      case 'rainbow': ['#ff5252', '#ffab40', '#ffee58', '#69f0ae', '#40c4ff', '#7c4dff'].forEach((c, i) => { x.fillStyle = c; x.fillRect(i * n / 6, 0, n / 6 + 1, n); }); break;
      case 'road': x.fillStyle = '#ffffff'; x.fillRect(n / 2 - 3, 8, 6, n / 2 - 16); x.fillStyle = '#ffd54f'; x.fillRect(4, 0, 4, n); x.fillRect(n - 8, 0, 4, n); break;
      case 'static': for (let i = 0; i < 600; i++) { const v = Math.floor(R(255)); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(R(n), R(n), 3, 3); } break;
      case 'swirl': x.strokeStyle = shade(top, 1.25); x.lineWidth = 5; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(R(n), R(n), 14 + R(20), R(3), R(3) + 4); x.stroke(); } x.strokeStyle = '#3f6fb5'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(R(n), R(n), 10 + R(16), R(3), R(3) + 3); x.stroke(); } break;
      case 'stained': { const cs = ['#c9184a', '#ffd166', '#06d6a0', '#118ab2', '#9d4edd']; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = cs[(i * 7 + j * 3) % 5]; x.fillRect(i * n / 4 + 2, j * n / 4 + 2, n / 4 - 4, n / 4 - 4); } break; }
      case 'hex': x.strokeStyle = d; x.lineWidth = 4; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const cx = i * n / 3 + (j % 2) * n / 6, cy = j * n / 3.4; x.beginPath(); for (let k = 0; k < 6; k++) { const an = (k / 6) * Math.PI * 2; x.lineTo(cx + Math.cos(an) * n / 6.5, cy + Math.sin(an) * n / 6.5); } x.closePath(); x.stroke(); } break;
      default: x.fillStyle = b; x.fillRect(0, n - 6, n, 6); x.fillRect(n - 6, 0, 6, n);
    }
  });
}

// 상자 윗면 UV 를 실제 크기에 맞춰 늘려서 무늬가 일정한 크기로 반복되게
function platGeo(w, th, len) {
  const g = new THREE.BoxGeometry(w, th, len);
  const uv = g.attributes.uv;
  // BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z (면마다 정점 4개)
  for (let f = 0; f < 6; f++) {
    const [su, sv] = f === 2 || f === 3 ? [w / 2, len / 2] : f < 2 ? [len / 2, th / 2] : [w / 2, th / 2];
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * Math.max(0.5, su), uv.getY(k) * Math.max(0.5, sv)); }
  }
  return g;
}
const sideMats = new Map();
function platMats(th) {
  const key = th.name;
  if (sideMats.has(key)) return sideMats.get(key);
  const glass = th.style === 'glass';
  const top = new THREE.MeshToonMaterial({ map: topTexture(th.style, th.plat[0], th.plat[1], th.edge), transparent: glass, opacity: glass ? 0.82 : 1 });
  const side = new THREE.MeshToonMaterial({ color: th.plat[1], transparent: glass, opacity: glass ? 0.7 : 1 });
  const bottom = new THREE.MeshToonMaterial({ color: shade(th.plat[1], 0.7) });
  const m = [side, side, top, bottom, side, side];
  sideMats.set(key, m);
  return m;
}

export class Track {
  constructor(scene, env, seed) {
    this.scene = scene; this.env = env;
    this.root = new THREE.Group(); scene.add(this.root);
    this.reset(seed);
  }
  reset(seed, itemMode = false) {
    this.itemMode = itemMode;
    this.irng = new RNG(seed ^ 0x2545f491); // 아이템 상자 자리 (길 모양과 따로라서 스피드전 길이 바뀌지 않는다)
    this.nextBox = 120;
    for (const c of [...this.root.children]) this.drop(c);
    this.seed = seed;
    this.rng = new RNG(seed);
    // 꿈 순서: 전부 섞어서 차례로 (다 보면 처음 순서로 다시)
    this.order = new RNG(seed ^ 0x5bd1e995).shuffle([...THEMES.keys()]);
    this.plats = []; this.obs = []; this.stars = []; this.portals = []; this.boxes = []; this.traps = [];
    this.origin = 0;
    this.gs = 0; this.cx = 0; this.cy = 0;
    this.dream = 0;                 // 지금 만들고 있는 꿈 번호
    this.bounds = [0];              // 꿈이 시작하는 거리들
    this.nextB = DREAM_SEC * speedAt(0) + 20;
    // 출발 발판
    this.plat(-40, 70, 0, 10, 0);
    this.gs = 70;
    this.generate(0);
  }
  themeOf(dream) { return THEMES[this.order[dream % THEMES.length]]; }
  dreamAt(s) { let d = 0; while (d + 1 < this.bounds.length && s >= this.bounds[d + 1]) d++; return d; }
  nextBoundary(s) { for (const b of this.bounds) if (b > s) return b; return this.nextB; }
  z(s) { return this.origin - s; }

  // ---------- 만들기 ----------
  plat(s0, s1, x, w, y, opts = {}) {
    const th = this.themeOf(this.dream);
    const len = s1 - s0, thick = opts.th ?? (th.style === 'cloud' ? 1.6 : 2.4);
    const m = new THREE.Mesh(platGeo(w, thick, len), platMats(th));
    m.position.set(x, y - thick / 2, this.z((s0 + s1) / 2));
    m.userData.s = (s0 + s1) / 2;
    this.root.add(m);
    // 테두리: 윗면 네 모서리를 바닥과 대비되는 색으로 (어두운 하늘 + 어두운 바닥이어도 블록 끝이 보이게)
    const rc = rimColor(th), rm = glow(rc);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(G_EDGE, rm); e.scale.set(0.14, 0.12, len); e.position.set(sx * (w / 2 - 0.07), thick / 2 + 0.02, 0); m.add(e); }
    for (const sz of [-1, 1]) { const e = new THREE.Mesh(G_EDGE, rm); e.scale.set(w, 0.12, 0.14); e.position.set(0, thick / 2 + 0.02, sz * (len / 2 - 0.07)); m.add(e); }
    // 발판 아래로 매달린 바위/구름 (둥둥 떠 있는 느낌)
    if (th.style === 'cloud') for (let i = 0; i < Math.ceil(len / 3); i++) { const p = new THREE.Mesh(G_PUFF, glow(th.plat[0], 0.95)); const r = 0.9 + Math.random() * 0.8; p.scale.setScalar(r); p.position.set((Math.random() < 0.5 ? -1 : 1) * (w / 2) * (0.6 + Math.random() * 0.4), -thick * 0.2, -len / 2 + i * 3 + 1.5); m.add(p); }
    else if (len > 3 && !opts.thin) { const c = new THREE.Mesh(G_HANG, platMats(th)[3]); const r = Math.min(w, len) * 0.42; c.scale.set(r, Math.min(9, 2 + len * 0.18), r); c.position.set(0, -thick / 2 - c.scale.y / 2, 0); c.rotation.y = Math.random() * 3; m.add(c); }
    const p = { s0, s1, x, cx: x, w, y, th: thick, mesh: m, mv: opts.mv || null, dx: 0, dream: this.dream };
    this.plats.push(p);
    // 아이템전: 넓고 긴 발판 위에 ? 상자를 한 줄로 (모두 같은 자리)
    if (this.itemMode && len >= 12 && !opts.mv && s0 >= this.nextBox) {
      const n = w >= 6 ? 3 : w >= 3 ? 2 : 1, sb = s0 + len * 0.45;
      for (let i = 0; i < n; i++) this.box(sb, x + (n === 1 ? 0 : (i / (n - 1) - 0.5) * Math.min(w - 1.2, 5)), y + 1.1);
      this.nextBox = sb + this.irng.range(70, 120);
    }
    this.env?.decorate(s0, s1, x, w, y, th, this);
    return p;
  }
  obstacle(kind, s, x0, x1, y0, y1, depth = 0.6) {
    const th = this.themeOf(this.dream);
    const g = new THREE.Group();
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
    const { acc, base, line } = obColors(th);
    const outline = (mesh) => { const o = new THREE.Mesh(G_BOX, OUTLINE_M(line)); o.scale.copy(mesh.scale).addScalar(0.1); o.position.copy(mesh.position); g.add(o); };
    if (kind === 'spike') {
      const n = Math.max(1, Math.round(w / 0.7));
      for (let i = 0; i < n; i++) { const c = new THREE.Mesh(G_SPIKE, line === '#ffffff' ? SPIKE_LIGHT : SPIKE_M); c.scale.set(0.32, h, 0.32); c.position.set(x0 + (i + 0.5) * (w / n) - cx, h / 2, 0); g.add(c); const t = new THREE.Mesh(G_PUFF, glow(acc)); t.scale.setScalar(0.08); t.position.set(c.position.x, h, 0); g.add(t); }
    } else if (kind === 'bar') {
      // 숙여서 지나가는 가로대 (밑은 비어 있다)
      const beam = new THREE.Mesh(G_BOX, new THREE.MeshToonMaterial({ map: stripeTex(acc, base) })); beam.scale.set(w, h, depth); beam.position.y = h / 2; g.add(beam); outline(beam);
      for (const sx of [-1, 1]) { const ph = h + 1.0; const post = new THREE.Mesh(G_BOX, glow(shade(th.plat[1], 0.8))); post.scale.set(0.25, ph, 0.25); post.position.set(sx * w / 2, -1.0 + ph / 2, 0); g.add(post); } // 기둥: 발판(가로대 1m 아래)부터
    } else {
      const m = new THREE.Mesh(G_BOX, new THREE.MeshToonMaterial({ map: stripeTex(acc, base) })); m.scale.set(w, h, depth); m.position.y = h / 2; g.add(m); outline(m);
      const top = new THREE.Mesh(G_BOX, glow(acc)); top.scale.set(w + 0.05, 0.08, depth + 0.05); top.position.y = h; g.add(top);
    }
    g.position.set(cx, y0, this.z(s));
    g.userData.s = s;
    this.root.add(g);
    const o = { kind, s0: s - depth / 2, s1: s + depth / 2, x0, x1, y0, y1, mesh: g };
    this.obs.push(o);
    return o;
  }
  star(s, x, y) {
    // 입체감: 빛을 받는 금색 + 진한 테두리 + 은은한 빛 + 발판 위 그림자
    const m = new THREE.Group();
    const body = new THREE.Mesh(starG(), STAR_M); body.scale.setScalar(0.42);
    const rim = new THREE.Mesh(starG(), STAR_RIM); rim.scale.setScalar(0.42 * 1.16);
    const halo = new THREE.Sprite(STAR_HALO); halo.scale.setScalar(1.5);
    m.add(halo, rim, body);
    const g = this.ground(s, x, y);
    if (g && y - g.y < 3) { const sh = new THREE.Mesh(G_SHADOW, SHADOW_M); sh.rotation.x = -Math.PI / 2; sh.position.y = g.y + 0.04 - y; sh.scale.setScalar(0.42); m.add(sh); m.userData.shadow = sh; }
    m.position.set(x, y, this.z(s)); m.userData.s = s;
    this.root.add(m);
    this.stars.push({ s, x, y, mesh: m, got: false });
  }
  starLine(s0, s1, x, y, n) { for (let i = 0; i < n; i++) this.star(s0 + (s1 - s0) * (i + 0.5) / n, x, y + 1); }
  // 점프 별: 출발 발판(x0) → 도착 발판(x1) 으로 가로 위치도 이어진다 (앞의 별 줄과 끊기지 않게)
  starArc(s0, s1, x0, y0, y1, x1 = x0) { const n = Math.max(2, Math.round((s1 - s0) / 2.5)); for (let i = 0; i <= n; i++) { const k = i / n; this.star(s0 + (s1 - s0) * k, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 2 + 1); } }
  portal(s, x, y, w) {
    const th = this.themeOf(this.dream);
    const g = new THREE.Group();
    const R = w / 2 + 2.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 10, 48), glow(th.edge || th.P?.a || '#ffffff'));
    ring.position.y = 2; g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 48), new THREE.MeshBasicMaterial({ color: th.sky[1], transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.y = 2; g.add(disc);
    for (let i = 0; i < 16; i++) { const sp = new THREE.Mesh(G_PUFF, glow('#ffffff')); sp.scale.setScalar(0.12); const a = (i / 16) * Math.PI * 2; sp.position.set(Math.cos(a) * R, 2 + Math.sin(a) * R, 0); g.add(sp); }
    g.position.set(x, y, this.z(s)); g.userData.s = s;
    g.userData.anim = (o, t) => { ring.rotation.z = t * 0.8; disc.material.opacity = 0.25 + Math.sin(t * 3) * 0.1; };
    this.root.add(g);
    this.portals.push({ s, mesh: g, dream: this.dream });
  }

  // 앞쪽 길을 미리 만든다
  generate(playerS) {
    while (this.gs < playerS + AHEAD) {
      if (this.gs >= this.nextB) { this.newDream(); continue; }
      this.pattern();
    }
    // 지나간 것 치우기
    const cut = playerS - BEHIND;
    this.plats = this.plats.filter((p) => { if (p.s1 < cut) { this.drop(p.mesh); return false; } return true; });
    this.obs = this.obs.filter((o) => { if (o.s1 < cut) { this.drop(o.mesh); return false; } return true; });
    this.stars = this.stars.filter((o) => { if (o.s < cut) { this.drop(o.mesh); return false; } return true; });
    this.portals = this.portals.filter((o) => { if (o.s < cut - 30) { this.drop(o.mesh); return false; } return true; });
    this.boxes = this.boxes.filter((o) => { if (o.s < cut) { this.root.remove(o.mesh); return false; } return true; });
    this.traps = this.traps.filter((o) => { if (o.s < cut) { this.root.remove(o.mesh); return false; } return true; });
  }
  drop(m) { this.root.remove(m); m.traverse?.((o) => { if (o.geometry && !o.isSprite && o.geometry !== G_BOX && o.geometry !== G_EDGE && o.geometry !== G_PUFF && o.geometry !== G_HANG && o.geometry !== G_SPIKE && o.geometry !== G_SHADOW && o.geometry.type !== 'ExtrudeGeometry') o.geometry.dispose(); }); }

  // 꿈이 바뀌는 곳: 넓은 발판 + 빛나는 문
  newDream() {
    const v = speedAt(this.gs);
    const gap = this.gs > 0 ? v * 0.22 : 0;
    const s0 = this.gs + gap;
    this.dream++;
    this.bounds.push(s0 + 14);
    this.nextB = s0 + 14 + DREAM_SEC * speedAt(s0);
    this.cx *= 0.5;
    this.plat(s0, s0 + 34, this.cx, 10, this.cy);
    this.portal(s0 + 14, this.cx, this.cy, 10);
    this.starLine(s0 + 20, s0 + 32, this.cx, this.cy, 5);
    this.gs = s0 + 34;
  }

  pattern() {
    const r = this.rng, s = this.gs, v = speedAt(s);
    const d = Math.min(1, s / 3000); // 어려움 0~1
    // 좌우 · 높이가 너무 멀리 가지 않게
    const drift = () => { this.cx = Math.max(-9, Math.min(9, this.cx + r.range(-2.5, 2.5) - this.cx * 0.15)); };
    const W = () => Math.max(3.2, 9 - d * 4.5 + r.range(-1, 1));
    const gapS = () => v * r.range(0.2, 0.4 + d * 0.06);
    const pick = r.weighted([
      ['flat', 3], ['gap', 3], ['bridge', d > 0.03 ? 2 : 0], ['stones', d > 0.05 ? 2 : 0.5], ['up', 2], ['down', 2],
      ['hurdles', 2.2], ['bars', d > 0.02 ? 2 : 0.6], ['walls', d > 0.04 ? 2 : 0.5], ['spikes', d > 0.08 ? 1.6 : 0],
      ['double', d > 0.15 ? 1.4 : 0], ['movers', d > 0.25 ? 1.4 : 0], ['split', d > 0.12 ? 1.2 : 0], ['zigzag', d > 0.1 ? 1.4 : 0],
    ], (x) => x[1])[0];
    let at = s;
    const flat = (len, w = W(), gap = 0) => { at += gap; const p = this.plat(at, at + len, this.cx, w, this.cy); at += len; return p; };
    switch (pick) {
      case 'flat': { const p = flat(r.range(18, 34) * (1 + v / 40)); if (r.chance(0.6)) { r.range(-1.5, 1.5); /* 예전 무작위 비킴 (씨앗 순서 유지용, 이제는 길 가운데) */ this.starLine(p.s0 + 4, p.s1 - 4, this.cx, this.cy, r.int(3, 6)); } break; }
      case 'gap': { const g = gapS(); const a0 = at, x0 = this.cx; drift(); flat(r.range(14, 26), W(), g); this.starArc(a0 - 1, a0 + g + 1, x0, this.cy, this.cy, this.cx); break; }
      case 'bridge': { flat(r.range(16, 30), r.range(1.7, 2.6), r.chance(0.5) ? gapS() * 0.6 : 0); this.starLine(at - 12, at - 2, this.cx, this.cy, 4); break; }
      case 'stones': {
        at += gapS() * 0.6;
        for (let i = 0, n = r.int(3, 6); i < n; i++) { this.cx = Math.max(-9, Math.min(9, this.cx + (i % 2 ? 1 : -1) * r.range(1.2, 2.6))); const len = r.range(4, 6.5); this.plat(at, at + len, this.cx, r.range(2.6, 3.6), this.cy, { thin: true }); this.star(at + len / 2, this.cx, this.cy + 1); at += len + v * r.range(0.14, 0.24); }
        flat(r.range(12, 20)); break;
      }
      case 'up': { const g = v * 0.18; this.cy = Math.min(8, this.cy + r.range(0.8, 1.2)); flat(r.range(16, 26), W(), g); break; }
      case 'down': { const g = v * r.range(0.25, 0.4); this.cy = Math.max(-4, this.cy - r.range(1.5, 3)); drift(); flat(r.range(16, 26), W(), g); break; }
      case 'hurdles': {
        const n = r.int(2, 4), sp = Math.max(v * 0.9, 9), w = W();
        const p = flat(sp * (n + 1), w);
        for (let i = 1; i <= n; i++) this.obstacle('hurdle', p.s0 + sp * i, this.cx - w / 2, this.cx + w / 2, this.cy, this.cy + r.range(0.55, 0.7));
        break;
      }
      case 'bars': {
        const n = r.int(2, 3), sp = Math.max(v * 1.0, 10), w = W();
        const p = flat(sp * (n + 1), w);
        for (let i = 1; i <= n; i++) this.obstacle('bar', p.s0 + sp * i, this.cx - w / 2, this.cx + w / 2, this.cy + 1.0, this.cy + 2.0, 0.5);
        break;
      }
      case 'walls': {
        const n = r.int(2, 4), sp = Math.max(v * 0.85, 9), w = Math.max(6, W() + 2);
        const p = flat(sp * (n + 1), w);
        let side = r.chance(0.5) ? 1 : -1;
        for (let i = 1; i <= n; i++) { const half = w * r.range(0.5, 0.62); const x0 = side > 0 ? this.cx + w / 2 - half : this.cx - w / 2, x1 = x0 + half; this.obstacle('wall', p.s0 + sp * i, x0, x1, this.cy, this.cy + 1.5, 1.2); this.star(p.s0 + sp * i, side > 0 ? this.cx - w / 2 + (w - half) / 2 : this.cx + w / 2 - (w - half) / 2, this.cy + 1); if (r.chance(0.7)) side = -side; }
        break;
      }
      case 'spikes': {
        const n = r.int(2, 3), sp = Math.max(v * 0.9, 9), w = Math.max(6, W() + 2);
        const p = flat(sp * (n + 1), w);
        for (let i = 1; i <= n; i++) {
          // 빈 줄 하나를 남기고 가시 (뛰어넘어도 된다)
          const lane = r.range(this.cx - w / 2 + 1.2, this.cx + w / 2 - 1.2), lw = 1.4;
          if (lane - lw / 2 > this.cx - w / 2) this.obstacle('spike', p.s0 + sp * i, this.cx - w / 2, lane - lw / 2, this.cy, this.cy + 0.45, 1.2);
          if (lane + lw / 2 < this.cx + w / 2) this.obstacle('spike', p.s0 + sp * i, lane + lw / 2, this.cx + w / 2, this.cy, this.cy + 0.45, 1.2);
        }
        break;
      }
      case 'double': { const g = v * r.range(0.72, 0.9); const a0 = at; flat(r.range(16, 24), W(), g); this.starArc(a0, a0 + g, this.cx, this.cy + 1.5, this.cy + 0.5); break; }
      case 'movers': {
        at += gapS() * 0.7;
        for (let i = 0, n = r.int(2, 3); i < n; i++) { const len = r.range(5, 7); this.plat(at, at + len, this.cx, 3, this.cy, { mv: { amp: r.range(2, 3.5), f: r.range(0.9, 1.5), ph: r.range(0, 6) }, thin: true }); at += len + v * r.range(0.16, 0.24); }
        flat(r.range(12, 18)); break;
      }
      case 'split': {
        const off = r.range(2.2, 3), len = r.range(26, 40), sp = Math.max(v * 0.95, 9);
        at += gapS() * 0.5;
        for (const sd of [-1, 1]) {
          this.plat(at, at + len, this.cx + sd * off, 1.9, this.cy, { thin: true });
          for (let k = sp; k < len - 4; k += sp) this.obstacle(sd < 0 ? 'hurdle' : 'bar', at + k, this.cx + sd * off - 0.95, this.cx + sd * off + 0.95, sd < 0 ? this.cy : this.cy + 1.0, sd < 0 ? this.cy + 0.65 : this.cy + 2.0, 0.5);
        }
        at += len; flat(r.range(10, 16)); break;
      }
      case 'zigzag': {
        for (let i = 0, n = r.int(4, 7); i < n; i++) { this.cx = Math.max(-9, Math.min(9, this.cx + (i % 2 ? 1 : -1) * 1.7)); const len = Math.max(7, v * 0.45); this.plat(at, at + len, this.cx, 3, this.cy, { thin: true }); this.star(at + len / 2, this.cx, this.cy + 1); at += len; }
        flat(r.range(10, 16)); break;
      }
    }
    this.gs = at;
  }

  // ---------- 판정 ----------
  // 움직이는 발판 위치 갱신 (모두 같은 시계 t 로 움직여서 모두에게 같은 자리)
  update(t, playerS) {
    for (const p of this.plats) {
      if (!p.mv) continue;
      const nx = p.x + Math.sin(t * p.mv.f + p.mv.ph) * p.mv.amp;
      p.dx = nx - p.cx; p.cx = nx; p.mesh.position.x = nx;
    }
    for (const st of this.stars) if (!st.got) { st.mesh.rotation.y = t * 2.5 + st.s; }
    for (const po of this.portals) po.mesh.userData.anim(po.mesh, t);
    for (const b of this.boxes) if (!b.got) { b.mesh.children[0].rotation.set(t * 1.3, t * 1.8, 0); b.mesh.position.y = b.y + Math.sin(t * 2.5 + b.s) * 0.15; }
    // 아주 멀리 달리면 숫자가 커져서 떨리지 않게 원점을 옮긴다
    if (playerS - this.origin > 1500) this.shift(1500);
  }
  shift(k) { this.origin += k; for (const c of this.root.children) c.position.z += k; this.env?.shift(k); }
  // (s, x) 아래에서 가장 높은 발판 윗면 (y 보다 조금 위까지는 올라선다)
  ground(s, x, y) {
    let best = null;
    for (const p of this.plats) {
      if (s < p.s0 - 0.2 || s > p.s1 + 0.2 || Math.abs(x - p.cx) > p.w / 2 + 0.3) continue;
      if (p.y <= y + 0.45 && (!best || p.y > best.y)) best = p;
    }
    return best;
  }
  // 앞을 막는 발판 옆면 (위로 0.9m 안이면 훌쩍 올라선다)
  wall(s0, s1, x, y) {
    for (const p of this.plats) {
      if (p.s0 < s0 - 0.01 || p.s0 > s1 + 0.01 || Math.abs(x - p.cx) > p.w / 2) continue;
      if (y < p.y - 0.45 && y + 1.3 > p.y - p.th) return p;
    }
    return null;
  }
  hit(s, x, y, h) {
    for (const o of this.obs) {
      if (s + 0.3 < o.s0 || s - 0.3 > o.s1 || x + 0.3 < o.x0 || x - 0.3 > o.x1) continue;
      if (y + h > o.y0 + 0.05 && y < o.y1 - 0.05) return o;
    }
    return null;
  }
  // ---------- 아이템전 ----------
  box(s, x, y) {
    const m = makeBox(); m.position.set(x, y, this.z(s)); m.userData.s = s;
    this.root.add(m);
    this.boxes.push({ s, x, y, mesh: m, got: false });
  }
  takeBox(s, x, y) {
    for (const b of this.boxes) {
      if (b.got || Math.abs(b.s - s) > 1.1 || Math.abs(b.x - x) > 1.1 || Math.abs(b.y - (y + 0.8)) > 1.5) continue;
      b.got = true; b.mesh.visible = false;
      return b;
    }
    return null;
  }
  // 충격파: 앞쪽 장애물을 부순다
  breakAhead(s0, s1) {
    let n = 0;
    this.obs = this.obs.filter((o) => { if (o.s1 >= s0 && o.s0 <= s1) { this.drop(o.mesh); n++; return false; } return true; });
    return n;
  }
  breakOne(o) { this.obs = this.obs.filter((x) => x !== o); this.drop(o.mesh); }
  // 순간이동: dist 앞쪽에서 가장 가까운 발판 위
  teleport(s, dist) {
    const want = s + dist;
    const cand = this.plats.filter((p) => !p.mv && p.s1 > want + 2 && p.s1 - p.s0 > 4).sort((a, b) => Math.max(a.s0, want) - Math.max(b.s0, want))[0];
    if (!cand) return null;
    const ts = Math.max(cand.s0 + 1.5, want);
    // 장애물 바로 위에 떨어지지 않게 조금 비켜서
    let ss = ts;
    for (const o of this.obs) if (ss > o.s0 - 1.5 && ss < o.s1 + 1.5) ss = o.s1 + 1.6;
    return { s: Math.min(ss, cand.s1 - 1), x: cand.cx, y: cand.y };
  }
  // 젤리 함정
  trap(s, x, y, mine) {
    const m = makeTrap(); m.position.set(x, y, this.z(s)); m.userData.s = s;
    this.root.add(m);
    this.traps.push({ s, x, y, mesh: m, mine, hit: false });
  }
  hitTrap(s, x, y) {
    for (const t of this.traps) {
      if (t.mine || t.hit || Math.abs(t.s - s) > 1.1 || Math.abs(t.x - x) > 1.1 || Math.abs(t.y - y) > 0.6) continue;
      t.hit = true; return t;
    }
    return null;
  }
  // 자석: 가까운 별사탕을 끌어온다
  magnet(s, x, y, dt) {
    for (const st of this.stars) {
      if (st.got) continue;
      const ds = st.s - s, dx = st.x - x, dy = st.y - (y + 0.8);
      if (ds < -2 || ds > 12 || Math.abs(dx) > 9) continue;
      const k = Math.min(1, dt * 7);
      st.s -= ds * k; st.x -= dx * k; st.y -= dy * k;
      st.mesh.position.set(st.x, st.y, this.z(st.s));
      if (st.mesh.userData.shadow) st.mesh.userData.shadow.visible = false; // 끌려오는 중엔 그림자 없이
    }
  }
  takeStars(s, x, y) {
    let n = 0;
    for (const st of this.stars) {
      if (st.got || Math.abs(st.s - s) > 1.1 || Math.abs(st.x - x) > 1.1 || Math.abs(st.y - (y + 0.8)) > 1.4) continue;
      st.got = true; st.mesh.visible = false; n++;
    }
    return n;
  }
}

const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_EDGE = G_BOX;
const G_PUFF = new THREE.SphereGeometry(1, 10, 8);
const G_HANG = new THREE.ConeGeometry(1, 1, 7).rotateX(Math.PI);
const G_SPIKE = new THREE.ConeGeometry(1, 1, 6);
const SPIKE_M = new THREE.MeshToonMaterial({ color: '#2b2b33' });
const SPIKE_LIGHT = new THREE.MeshToonMaterial({ color: '#d5dae3', emissive: '#30343c' }); // 어두운 꿈에서는 밝은 가시
const STAR_M = new THREE.MeshToonMaterial({ color: '#ffd23f', emissive: '#7a5200' });
const STAR_RIM = new THREE.MeshBasicMaterial({ color: '#a8560a', side: THREE.BackSide });
const STAR_HALO = new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
const G_SHADOW = new THREE.CircleGeometry(1, 20);
const outlineCache = new Map();
const OUTLINE_M = (c) => { if (!outlineCache.has(c)) outlineCache.set(c, new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })); return outlineCache.get(c); };
const SHADOW_M = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false });
const stripeCache = new Map();
function stripeTex(c, base = '#ffffff') {
  const key = c + base;
  if (stripeCache.has(key)) return stripeCache.get(key);
  const t = canvasTex('stripe-ob|' + key, (x, n) => { x.fillStyle = base; x.fillRect(0, 0, n, n); x.fillStyle = c; for (let i = -1; i < 4; i++) { x.beginPath(); x.moveTo(i * n / 2, 0); x.lineTo(i * n / 2 + n / 4, 0); x.lineTo(i * n / 2 + n / 4 + n, n); x.lineTo(i * n / 2 + n, n); x.fill(); } }, 64);
  stripeCache.set(key, t);
  return t;
}
