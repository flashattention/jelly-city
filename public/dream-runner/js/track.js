// 꿈길 만들기: 씨앗(seed) 하나로 발판 · 장애물 · 별사탕 · 꿈이 바뀌는 문까지 똑같이 만든다
//   → 같은 방 사람들은 모두 같은 길을 달린다. 꿈(테마)은 거리로 정해서(약 20초 분량) 모두 같은 자리에서 바뀐다
//   좌표: s = 달린 거리(앞), x = 좌우(오른쪽 +), y = 높이. 화면에는 z = origin - s 로 그린다
import * as THREE from 'three';
import { isPhone } from '../../shared/js/perf.js';
import { RNG } from '../../shared/js/utils.js';
import { THEMES } from './themes.js';
import { HELLS } from './hells.js';
import { VOIDS } from './voids.js';
import { SEOULS, seoulAt, SEOUL_U0, seoulCourseOf, seoulLaneW, ROUTES } from './seouls.js';
import { glow, starG } from './kits.js';
import { buildMonster, buildFist } from './hellkits.js';
import { G } from '../../shared/js/utils.js';
import { makeBox, makeTrap } from './items.js';

export const V0 = 13, VMAX = 30;
export const speedAt = (s) => Math.min(VMAX, V0 + Math.max(0, s) / 220); // 달릴수록 빨라진다
export const DREAM_SEC = 20;
export const DEATH_Y = -16;       // 이 아래로 떨어지면 탈락
const AHEAD = isPhone ? 190 : 280, BEHIND = 40; // 휴대폰은 앞을 덜 만들어 그리기 횟수를 줄인다

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
// 장애물 색: 하늘 · 바닥과 모두 구분되는 강조색 + 둘 다에서 더 잘 보이는 쪽(어둡게/밝게)의 바탕 · 외곽선
const OB_ALT = ['#ff3b5c', '#ffb300', '#7c4dff', '#00c853'];
export function obColors(th) {
  const sky = th.sky[1], cands = [th.edge, th.P?.a, ...OB_ALT].filter(Boolean), seen = (c) => Math.min(contrast(c, sky), contrast(c, th.plat[0]));
  const acc = cands.find((c) => contrast(c, sky) >= 2 && contrast(c, th.plat[0]) >= 1.6) || cands.reduce((a, c) => (seen(c) > seen(a) ? c : a));
  const dark = seen('#1a1a24') >= seen('#ffffff');
  return { acc, base: dark ? '#2a2a36' : '#ffffff', line: dark ? '#1a1a24' : '#ffffff' };
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
      case 'pastel': ['#ffd6e4', '#ffe6cf', '#fff6cf', '#d8f3dc', '#d3e9ff', '#e6dcf8'].forEach((c, i) => { x.fillStyle = c; x.fillRect(i * n / 6, 0, n / 6 + 1, n); }); break;
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
  // opt.map: 'hell' 이면 랜덤 지옥 · 'void' 면 랜덤 이공간 · opt.K: 난이도 빠르기 (지옥 · 이공간 길은 시간 기준이라 빠를수록 길어진다)
  reset(seed, itemMode = false, opt = {}) {
    this.itemMode = itemMode; this.hell = opt.map === 'hell'; this.void = opt.map === 'void'; this.seoul = opt.map === 'seoul'; this.xLim = null; this.movers = []; this.decos = []; this.gateN = 0; this.K = opt.K || 1; this.time = 0; this.meteors = []; this.strikes = []; this.nextStrike = 0; this.lastFloor = 0; this.trend = 0; this.lastPat = '';
    this.irng = new RNG(seed ^ 0x2545f491); // 아이템 상자 자리 (길 모양과 따로라서 스피드전 길이 바뀌지 않는다)
    this.nextBox = 120;
    for (const c of [...this.root.children]) this.drop(c);
    this.seed = seed;
    this.rng = new RNG(seed);
    // 꿈 순서: 전부 섞어서 차례로 (다 보면 처음 순서로 다시)
    this.order = new RNG(seed ^ 0x5bd1e995).shuffle([...THEMES.keys()]);
    // 지옥 순서: 올라가는 지옥과 떨어지는 지옥을 번갈아
    if (this.void) this.order = new RNG(seed ^ 0x6a09e667).shuffle([...VOIDS.keys()]);
    // 서울 코스 순서: 20곳을 섞어서 차례로
    if (this.seoul) { this.order = new RNG(seed ^ 0x1f83d9ab).shuffle([...SEOULS.keys()]); this.xLim = seoulLaneW(this.order[0]) / 2 - 0.2; }
    if (this.hell) { const q = new RNG(seed ^ 0x3c6ef372), keys = (l) => q.shuffle([...HELLS.keys()].filter((i) => HELLS[i].layout === l)), a = keys('climb'), b = keys('plunge'); this.order = []; for (let i = 0; i < Math.max(a.length, b.length); i++) this.order.push(a[i % a.length], b[i % b.length]); }
    this.plats = []; this.obs = []; this.stars = []; this.portals = []; this.boxes = []; this.traps = [];
    this.origin = 0;
    this.gs = 0; this.cx = 0; this.cy = 0;
    this.dream = 0;                 // 지금 만들고 있는 꿈 번호
    this.bounds = [0];              // 꿈이 시작하는 거리들
    this.nextB = DREAM_SEC * speedAt(0) * (this.hell || this.void ? this.K : 1) + 20;
    // 출발 발판
    this.plat(-40, 70, 0, 10, 0);
    this.gs = 70;
    this.generate(0);
  }
  themeOf(dream) { if (this.seoul) return seoulAt(this.order[dream % this.order.length], this.seoulFlip ?? Math.floor(dream / 5) % 2 === 1); return this.hell || this.void ? (this.void ? VOIDS : HELLS)[this.order[dream % this.order.length]] : THEMES[this.order[dream % THEMES.length]]; }
  // 이 아래로 떨어지면 탈락 (지옥은 높이가 계속 바뀌니 눈앞 발판을 기준으로)
  deathY(s) {
    if (this.void) return -9; // 이공간: 한 번 떨어지면 금방 끝
    if (!this.hell) return DEATH_Y;
    const far = s + speedAt(s) * this.K * 1.6 + 20; let m = Infinity;
    for (const p of this.plats) if (p.s1 >= s - 6 && p.s0 <= far && !p.doomed && p.y < m) m = p.y;
    if (m !== Infinity) this.lastFloor = m;
    return this.lastFloor - 16;
  }
  dreamAt(s) { let d = 0; while (d + 1 < this.bounds.length && s >= this.bounds[d + 1]) d++; return d; }
  nextBoundary(s) { for (const b of this.bounds) if (b > s) return b; return this.nextB; }
  z(s) { return this.origin - s; }

  // ---------- 만들기 ----------
  plat(s0, s1, x, w, y, opts = {}) {
    const th = this.themeOf(this.dream);
    const len = s1 - s0, thick = opts.th ?? (th.style === 'cloud' ? 1.6 : 2.4);
    // 서울 맵: 발판은 판정만 (보이는 길은 실제 서울 찻길 · 보도, seoul-run.js)
    if (this.seoul) { const m = new THREE.Object3D(); m.position.set(x, y, this.z((s0 + s1) / 2)); m.userData.s = (s0 + s1) / 2; this.root.add(m); const p = { s0, s1, x, cx: x, w, y, th: thick, mesh: m, mv: null, dx: 0, dream: this.dream }; this.plats.push(p); return p; }
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
    if (opts.beacon) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const e = new THREE.Mesh(G_EDGE, rm); e.scale.set(0.1, 5, 0.1); e.position.set(sx * (w / 2 - 0.1), thick / 2 + 2.5, sz * (len / 2 - 0.1)); m.add(e); } // 멀리서 떨어져도 내릴 곳이 보이게
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
    if (kind === 'laser') {
      // 이공간 빛줄기: 위아래로 오르내린다 (기둥 없이 빛나는 막대 + 양 끝 발사기)
      const beam = new THREE.Mesh(G_BOX, glow(acc)); beam.scale.set(w, h, depth); beam.position.y = h / 2; g.add(beam);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(G_BOX, glow('#ffffff')); e.scale.set(0.4, h + 0.3, depth + 0.3); e.position.set(sx * w / 2, h / 2, 0); g.add(e); }
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
    if (this.void && th.R?.dark) o.dark = true;
    this.obs.push(o);
    return o;
  }
  star(s, x, y) {
    // 입체감: 빛을 받는 금색 + 진한 테두리 + 은은한 빛 + 발판 위 그림자
    const m = new THREE.Group();
    const body = new THREE.Mesh(starG(), STAR_M); body.scale.setScalar(0.42);
    const rim = new THREE.Mesh(starG(), STAR_RIM); rim.scale.setScalar(0.42 * 1.16);
    m.add(rim, body);
    if (!isPhone) { const halo = new THREE.Sprite(STAR_HALO); halo.scale.setScalar(1.5); m.add(halo); }
    const g = this.ground(s, x, y);
    if (!isPhone && g && y - g.y < 3) { const sh = new THREE.Mesh(G_SHADOW, SHADOW_M); sh.rotation.x = -Math.PI / 2; sh.position.y = g.y + 0.04 - y; sh.scale.setScalar(0.42); m.add(sh); m.userData.shadow = sh; }
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
    const ahead = this.hell || this.void ? Math.max(AHEAD, speedAt(playerS) * this.K * 2.4) : AHEAD; // 내리치기 예고가 보일 만큼 앞을 만든다
    while (this.gs < playerS + ahead) {
      if (this.gs >= this.nextB) { this.newDream(); continue; }
      if (this.hell) this.hellPattern(); else if (this.void) this.voidPattern(); else if (this.seoul) this.seoulPattern(); else this.pattern();
    }
    // 지나간 것 치우기
    const cut = playerS - BEHIND;
    this.plats = this.plats.filter((p) => { if (p.s1 < cut) { this.drop(p.mesh); return false; } return true; });
    this.obs = this.obs.filter((o) => { if (o.s1 < cut) { this.drop(o.mesh); return false; } return true; });
    this.stars = this.stars.filter((o) => { if (o.s < cut) { this.drop(o.mesh); return false; } return true; });
    this.portals = this.portals.filter((o) => { if (o.s < cut - 30) { this.drop(o.mesh); return false; } return true; });
    this.boxes = this.boxes.filter((o) => { if (o.s < cut) { this.root.remove(o.mesh); return false; } return true; });
    this.traps = this.traps.filter((o) => { if (o.s < cut) { this.root.remove(o.mesh); return false; } return true; });
    this.decos = this.decos.filter((o) => { if (o.userData.s < cut - 20) { this.drop(o); return false; } return true; });
    this.movers = this.movers.filter((o) => o.sEnd >= cut);
    this.strikes = this.strikes.filter((o) => { if (o.s < cut) { this.root.remove(o.g); return false; } return true; });
    this.meteors = this.meteors.filter((o) => { if (o.s < cut) { this.root.remove(o.g); return false; } return true; });
  }
  drop(m) { this.root.remove(m); if (m.userData?.keepGeo) return; m.traverse?.((o) => { if (o.geometry && !o.isSprite && o.geometry !== G_BOX && o.geometry !== G_EDGE && o.geometry !== G_PUFF && o.geometry !== G_HANG && o.geometry !== G_SHADOW && o.geometry.type !== 'ExtrudeGeometry') o.geometry.dispose(); }); }

  // 꿈이 바뀌는 곳: 넓은 발판 + 빛나는 문
  newDream() {
    const v = speedAt(this.gs) * (this.hell || this.void ? this.K : 1);
    const gap = this.gs > 0 && !this.seoul ? v * 0.22 : 0;
    const s0 = this.gs + gap;
    this.dream++;
    this.bounds.push(s0 + 14); this.trend = 0;
    this.nextB = s0 + 14 + DREAM_SEC * v;
    this.cx *= 0.5; if (this.void) this.cy = 0;
    const len = this.hell || this.void ? Math.max(34, v * 0.8) : 34; // 빠른 난이도의 지옥은 숨 돌릴 자리도 같은 시간만큼
    this.plat(s0, s0 + len, this.cx, 10, this.cy);
    if (this.seoul) this.seoulGate(s0 + 12, this.cx, this.cy, 10); else this.portal(s0 + 14, this.cx, this.cy, 10);
    this.starLine(s0 + 20, s0 + 32, this.cx, this.cy, 5);
    this.gs = s0 + len;
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
      ['hurdles', 2.2], ['bars', d > 0.02 ? 2 : 0.6], ['walls', d > 0.04 ? 2 : 0.5], ['lanes', d > 0.08 ? 1.6 : 0],
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
      case 'lanes': {
        const n = r.int(2, 3), sp = Math.max(v * 0.9, 9), w = Math.max(6, W() + 2);
        const p = flat(sp * (n + 1), w);
        for (let i = 1; i <= n; i++) {
          // 빈 줄 하나를 남기고 낮은 턱 (뛰어넘어도 된다)
          const lane = r.range(this.cx - w / 2 + 1.2, this.cx + w / 2 - 1.2), lw = 1.4;
          if (lane - lw / 2 > this.cx - w / 2) this.obstacle('hurdle', p.s0 + sp * i, this.cx - w / 2, lane - lw / 2, this.cy, this.cy + 0.45, 1.2);
          if (lane + lw / 2 < this.cx + w / 2) this.obstacle('hurdle', p.s0 + sp * i, lane + lw / 2, this.cx + w / 2, this.cy, this.cy + 0.45, 1.2);
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

  // ---------- 랜덤 지옥 ----------
  //   길이는 시간으로 정한다: 빠른 난이도에서도 2단 점프 · 낙하에 걸리는 시간이 맞도록 빠르기(vv)만큼 늘린다
  hellPattern() {
    const r = this.rng, th = this.themeOf(this.dream), vv = speedAt(this.gs) * this.K, late = Math.min(1, this.gs / vv / 70), tf = (1.12 / this.K ** 0.25) * (1 - late * 0.12);
    const W = () => Math.max(3.2, 6.4 + r.range(-1.5, 1) - late * 2.4), y0 = this.cy;
    // 지옥마다 성격은 있지만 한쪽으로만 가지 않는다: 많이 올랐으면 떨어지고, 많이 떨어졌으면 오른다 · 같은 무늬는 연달아 안 나온다
    const up = th.layout === 'climb' ? 2.4 : 0.9, down = th.layout === 'plunge' ? 2.4 : 0.9, tr = this.trend || 0, U = tr > 9 ? 0 : up, D = tr < -22 ? 0 : down;
    const table = [['stair', U], ['zig', U * 0.8], ['narrow', U * 0.8], ['drop', D], ['steps', D * 0.8], ['needle', D * 0.8], ['twinDrop', D * 0.9], ['wave', 2.4], ['fork', 2], ['gauntlet', 5], ['slalom', 2.2], ['mover', 1.8], ['crusher', 2.4], ['rest', 1.2]];
    const pick = r.weighted(table.map(([k, w]) => [k, k === this.lastPat ? 0 : w]), (x) => x[1])[0]; this.lastPat = pick;
    const start = this.gs, at = this[`hp_${pick}`](r, vv, tf, W); (this.patLog ||= []).push([start, pick]); if (this.patLog.length > 60) this.patLog.shift();
    this.gs = at; this.trend = tr + this.cy - y0;
  }
  // 빠른 난이도 · 오래 버틸수록 장애물 간격이 좁아진다 (꿈나라보다 늘 빽빽하게)
  hellPace() { const late = Math.min(1, this.gs / (speedAt(this.gs) * this.K) / 70); return (1 - late * 0.14) / (1 + Math.max(0, this.K - 1.5) * 0.07); }
  // 길 위 장애물: 뛰어넘기 · 숙이기 · 옆으로 피하기를 섞는다. 다음 조작까지 시간 간격을 지킨다
  hellObstacles(r, vv, s0, s1, cx, w, y, every = 1) {
    let at = s0, jumped = false;
    while (at < s1 - vv * 1) { // 뛰어넘어도 길 안에 내려앉도록 끝에는 안 놓는다
      const kinds = w >= 6 ? ['hurdle', 'bar', 'wall', 'lanes', 'combo', 'tall', 'twin2'] : w >= 4.4 ? ['hurdle', 'bar', 'wall', 'combo', 'tall', 'twin2'] : ['hurdle', 'bar', 'tall', 'twin2'], k = r.pick(kinds), L = cx - w / 2, R = cx + w / 2;
      if ((k === 'bar' || k === 'combo') && jumped) at += vv * 0.3; // 뛰어넘은 뒤 내려앉아 숙일 시간은 준다
      jumped = k === 'hurdle' || k === 'tall' || k === 'twin2' || k === 'lanes';
      if (k === 'hurdle') this.obstacle('hurdle', at, L, R, y, y + r.range(0.5, 0.7));
      else if (k === 'bar') this.obstacle('bar', at, L, R, y + 1, y + 2, 0.5);
      else if (k === 'tall') this.obstacle('hurdle', at, L, R, y, y + 1.15, 0.7); // 일찍 뛰어야 넘는 높은 턱
      else if (k === 'twin2') { this.obstacle('hurdle', at, L, R, y, y + 0.55); this.obstacle('hurdle', at + vv * 0.42, L, R, y, y + 0.55); at += vv * 0.42; } // 한 번에 넘는 쌍둥이 턱
      else if (k === 'combo') { const half = w * r.range(0.5, 0.58), right = r.chance(0.5), a = right ? R - half : L, b = right ? R : L + half; this.obstacle('wall', at, a, b, y, y + 1.5, 1.2); this.obstacle('bar', at, right ? L : b, right ? a : R, y + 1, y + 2, 0.5); this.star(at, right ? L + (w - half) / 2 : R - (w - half) / 2, y + 0.4); } // 벽 옆으로 가면서 숙이기
      else if (k === 'wall') { const half = w * r.range(0.5, 0.62), right = r.chance(0.5); this.obstacle('wall', at, right ? R - half : L, right ? R : L + half, y, y + 1.5, 1.2); this.star(at, right ? L + (w - half) / 2 : R - (w - half) / 2, y + 1); }
      else { const lane = r.range(L + 1.3, R - 1.3); if (lane - 0.8 > L) this.obstacle('hurdle', at, L, lane - 0.8, y, y + 0.45, 1.2); if (lane + 0.8 < R) this.obstacle('hurdle', at, lane + 0.8, R, y, y + 0.45, 1.2); this.star(at, lane, y + 1); }
      at += vv * r.range(0.7, 0.98) * every * this.hellPace();
    }
  }
  // 장애물 몰이: 길게 달리며 연달아 피한다 (별은 피하는 자리에)
  hp_gauntlet(r, vv, tf, W) { const w = Math.max(4.6, W()), len = vv * r.range(5, 7.5), // 내리치기 자리를 뺀 나머지에 장애물을 빽빽하게
      p = this.plat(this.gs, this.gs + len, this.cx, w, this.cy); const hit = this.gs >= this.nextStrike; this.hellObstacles(r, vv, p.s0 + vv * 0.55, hit ? p.s1 - vv * 1.6 : p.s1, this.cx, w, this.cy, 0.9); if (hit) { this.strike(r.pick(this.themeOf(this.dream).strikes.filter((k) => k !== 'twin' && k !== 'break')), p.s1 - vv * 1.25, this.cx, w, this.cy); this.nextStrike = p.s1 + vv * r.range(2, 4); } return p.s1; }
  // 2단 점프로만 닿는 계단 (턱은 1.3m 까지 훌쩍 올라서므로 3.6m 부터는 한 번 점프로 안 된다)
  // 계단 한 칸의 길이 · 틈 (초): 빠른 난이도 · 오래 달린 뒤에도 이보다 짧아지지 않는다 (점프를 누를 수 있는 때가 0.4초는 남게)
  stepT(vv, tf) { return { gap: vv * Math.max(tf * 0.36, 0.32), len: vv * Math.max(tf * 0.62, 0.6) }; }
  hellSteps(r, vv, tf, at, n, opt = {}) {
    const { gap, len } = this.stepT(vv, tf);
    for (let i = 0; i < n; i++) {
      const y0 = this.cy, x0 = this.cx; at += gap; this.cy += r.range(3.6, 4);
      if (opt.zig) this.cx = Math.max(-12, Math.min(12, this.cx + (i % 2 ? 1 : -1) * r.range(3.8, 5.6))); else this.cx = Math.max(-12, Math.min(12, this.cx + r.range(-1.5, 1.5)));
      this.plat(at, at + len, this.cx, opt.w ? opt.w() : r.range(5, 8), this.cy, { thin: !!opt.zig || !!opt.narrow });
      // 별: 2단 점프로 올라가는 길 위에 (턱에 닿기 0.5초 전 뛰면 지나가는 자리) + 내려선 발판 위에
      [[0.46, 1.5], [0.3, 2.5], [0.14, 3.2]].forEach(([b, h], q) => this.star(at - vv * b, x0 + (this.cx - x0) * ((q + 1) / 3), y0 + h - 1 + 1));
      this.star(at + len * 0.25, this.cx, this.cy + 1);
      at += len;
    }
    return at;
  }
  hp_stair(r, vv, tf) { return this.hellSteps(r, vv, tf, this.gs, r.int(2, 4), { w: () => r.range(3.8, 6) }); }
  hp_zig(r, vv, tf) { return this.hellSteps(r, vv, tf, this.gs, r.int(2, 4), { zig: true, w: () => r.range(3.6, 4.6) }); }
  hp_narrow(r, vv, tf) { return this.hellSteps(r, vv, tf, this.gs, r.int(2, 3), { narrow: true, w: () => r.range(2.8, 3.4) }); }
  // 떨어지는 지옥: 까마득히 아래 있는 발판에 정확히 내려앉는다 (공중에서 좌우로 맞춘다)
  hellRun(vv, tf, w) { const run = this.plat(this.gs, this.gs + vv * tf * 0.55, this.cx, w, this.cy); return run.s1; }
  hp_drop(r, vv, tf, W) { return this.hellDrop(r, vv, this.hellRun(vv, tf, W()), r.range(14, 28), r.range(4, 10) * r.pick([-1, 1]), Math.min(5.4, W()), 1.15); }
  hp_steps(r, vv, tf, W) { let at = this.hellRun(vv, tf, W()); for (let i = 0, n = r.int(2, 4); i < n; i++) at = this.hellDrop(r, vv, at, r.range(7, 12), r.range(3.5, 6.5) * (i % 2 ? 1 : -1), r.range(3.4, 4.6), 0.8); return at; }
  hp_needle(r, vv, tf, W) { return this.hellDrop(r, vv, this.hellRun(vv, tf, W()), r.range(26, 42), r.range(6, 12) * r.pick([-1, 1]), r.range(2.8, 3.6), 1.25, { amp: r.range(1.2, 2.4), f: r.range(0.7, 1.1), ph: r.range(0, 6) }); }
  // 파도: 올라갔다 떨어지기를 되풀이한다
  hp_wave(r, vv, tf) {
    let at = this.gs;
    for (let i = 0, n = r.int(2, 3); i < n; i++) { at = this.hellSteps(r, vv, tf, at, 2, { w: () => r.range(4.6, 6.5) }); at = this.hellDrop(r, vv, at, r.range(6, 9.5), r.range(3.5, 6.5) * (i % 2 ? 1 : -1), r.range(3.6, 5), 0.78); }
    return at;
  }
  // 갈림길: 낮은 길은 쉽지만 별이 적고, 높은 길은 2단 점프 두 번에 별이 잔뜩 있다 (실력껏 고른다)
  hp_fork(r, vv, tf) {
    const y = this.cy, cx = this.cx, entry = this.plat(this.gs, this.gs + vv * tf * 1.35, cx, 15, y), side = r.chance(0.5) ? 1 : -1, xA = cx - side * 6, xB = cx + side * 6, { gap, len } = this.stepT(vv, tf);
    this.star(entry.s0 + vv * tf * 0.45, xB, y + 1); this.star(entry.s0 + vv * tf * 0.6, xB, y + 1); // 높은 길 쪽을 알려 준다
    let at = entry.s1, py = y;
    for (let i = 0; i < 2; i++) { at += gap; py += r.range(3.6, 4); this.plat(at, at + len, xB, 3.6, py, { thin: true }); for (let k = 0; k < 4; k++) this.star(at + (len * (k + 0.5)) / 4, xB, py + 1); at += len; }
    const tF = (-14 + Math.sqrt(196 + 60 * (py - y))) / 30, merge = at + vv * tF * 0.92, low = this.plat(entry.s1, merge, xA, 5.2, y);
    this.hellObstacles(r, vv, entry.s1 + vv * 0.5, merge + vv * 0.6, xA, 5.2, y); // 낮은 길도 공짜가 아니다
    this.star(entry.s1 + (merge - entry.s1) * 0.2, xA, y + 1);
    const m = this.plat(merge, merge + vv * tf * 2.6, cx, 18, y); this.hellObstacles(r, vv, merge + vv * 1.1, m.s1, cx, 10, y); void low; return m.s1;
  }
  // 고르는 낙하: 넓은 발판은 안전하고, 좁은 발판에는 별 더미가 있다
  hp_twinDrop(r, vv, tf, W) {
    const edge = this.hellRun(vv, tf, W()), h = r.range(14, 24), side = r.chance(0.5) ? 1 : -1, tW = Math.sqrt(2 * h / 30), tF = (-14 + Math.sqrt(196 + 60 * h)) / 30, y = this.cy - h, cx = this.cx, s0 = edge + vv * tF * 0.92, s1 = s0 + vv * (tW - tF * 0.92 + 1.1);
    const reach = Math.min(8.5 * tW * 0.7, 11), xS = cx - side * Math.min(5, reach * 0.6), xR = cx + side * reach;
    this.plat(s0, s1, xS, 5, y, { beacon: true, thin: true }); this.plat(s0, s1, xR, r.range(2.6, 3.2), y, { beacon: true, thin: true });
    for (let i = 0; i < 6; i++) this.star(s0 + (s1 - s0) * (0.45 + (i % 3) * 0.1) + i * 0.1, xR + ((i % 3) - 1) * 0.8, y + 1 + (i >> 1) % 2);
    this.dropStars(vv, edge, cx, y + h, xR, h); // 위험한 쪽으로 점프해 떨어지면 별이 이어진다
    this.cy = y; const m = this.plat(s1, s1 + vv * tf * 2.4, cx, 18, y); this.hellObstacles(r, vv, s1 + vv * 0.7, m.s1, cx, 10, y); return m.s1;
  }
  // 지그재그: 좌우로 뛰어 건넌다
  hp_slalom(r, vv, tf) {
    let at = this.gs, s = r.chance(0.5) ? 1 : -1; const len = vv * 0.82, gap = vv * 0.22; // 한 번 점프(0.77초)로 다음 발판 안에 내린다
    for (let i = 0, n = r.int(4, 6); i < n; i++, s = -s) { at += gap; this.cx = Math.max(-11, Math.min(11, this.cx + s * r.range(3.6, 5.6))); this.plat(at, at + len, this.cx, 3.4, this.cy, { thin: true }); this.star(at + len / 2, this.cx, this.cy + 1); if (i % 2) this.star(at - gap / 2, this.cx, this.cy + 2.6); at += len; }
    return at;
  }
  // 움직이는 발판: 때를 봐서 건넌다
  hp_mover(r, vv, tf) {
    let at = this.gs; const len = vv * 0.82, gap = vv * 0.22;
    for (let i = 0, n = r.int(3, 4); i < n; i++) { at += gap; this.plat(at, at + len, this.cx, 3.8, this.cy, { thin: true, mv: { amp: r.range(2.2, 4), f: r.range(1, 1.6), ph: r.range(0, 6) } }); this.star(at + len / 2, this.cx, this.cy + 1); at += len; }
    const m = this.plat(at + gap, at + gap + vv * tf * 0.7, this.cx, 9, this.cy); return m.s1;
  }
  hp_rest(r, vv, tf, W) { return this.hellRest(r, vv, tf, W()); }
  // 분쇄기: 좁은 길에 내리치기가 연달아 온다 (괴물이 쉬지 않는다)
  hp_crusher(r, vv, tf, W) {
    const w = Math.max(6.2, W() + 1), n = r.int(2, 3), len = vv * tf * (n + 1) * 1.35, p = this.plat(this.gs, this.gs + len, this.cx, w, this.cy), kinds = this.themeOf(this.dream).strikes.filter((k) => k !== 'break');
    for (let i = 0; i < n; i++) this.strike(r.pick(kinds), p.s0 + (len * (i + 0.7)) / (n + 1), this.cx, w, this.cy);
    this.nextStrike = p.s1 + vv * r.range(2, 4); this.starLine(p.s0 + len * 0.1, p.s1 - vv * 0.3, this.cx, this.cy, 5); return p.s1;
  }
  // 별: 끝에서 점프해야 지나가는 포물선 위에 놓는다 (그냥 걸어 떨어지면 훨씬 아래로 지나가서 놓친다)
  dropStars(vv, edge, x0, y0, x1, h) {
    const lead = 0.08, tEnd = (11.5 + Math.sqrt(132.25 + 60 * Math.max(0, h - 0.8))) / 30, n = Math.max(5, Math.min(10, Math.round(tEnd * 6)));
    for (let i = 1; i <= n; i++) { const t = (tEnd * i) / n, k = Math.min(1, t / tEnd); this.star(edge - vv * lead + vv * t, x0 + Math.sign(x1 - x0) * Math.min(Math.abs(x1 - x0), 8.2 * t), y0 + 11.5 * t - 15 * t * t + 0.75); void k; }
  }
  // 낙하 한 번. 그냥 떨어지면 시작 부근에, 가장 늦게(2단 점프 후) 떨어져도 끝 안쪽에 내린다
  hellDrop(r, vv, edge, h, off, w, stay, mv = null) {
    const tWalk = Math.sqrt(2 * h / 30), tFast = (-14 + Math.sqrt(196 + 60 * h)) / 30, x0 = this.cx, y0 = this.cy; // 숙이기(빨리 내려오기)로도 앞면에 부딪히지 않게 tFast 부터
    this.cy -= h; this.cx = Math.max(-14, Math.min(14, this.cx + Math.sign(off) * Math.min(Math.abs(off), 8.5 * tWalk * 0.65)));
    const s0 = edge + vv * tFast * 0.92, s1 = s0 + vv * (tWalk - tFast * 0.92 + stay);
    this.plat(s0, s1, this.cx, w, this.cy, { beacon: true, thin: true, mv });
    if (!mv) { const tJump = (11.5 + Math.sqrt(132.25 + 60 * h)) / 30, safe = edge + vv * (tJump + 0.3); if (s1 - safe > vv * 0.6) this.hellObstacles(r, vv, safe, s1, this.cx, w, this.cy); } // 어떻게 떨어져도 내린 뒤 숨 돌릴 틈을 두고
    this.dropStars(vv, edge, x0, y0, this.cx, h);
    return s1;
  }
  // 넓은 길: 괴물이 내리치는 자리
  hellRest(r, vv, tf, w) {
    const at = this.gs, th = this.themeOf(this.dream), len = vv * tf * 2.4, kind = this.gs >= this.nextStrike ? r.pick(th.strikes.filter((k) => k !== 'twin' || w >= 6)) : null;
    if (kind === 'break') { // 가운데 토막이 부서진다: 앞 토막 끝에서 뛰어넘는다
      const a = this.plat(at, at + len * 0.5, this.cx, w, this.cy), hole = vv * 0.34, b = this.plat(a.s1, a.s1 + hole, this.cx, w, this.cy, { thin: true }), c = this.plat(b.s1, b.s1 + len * 0.5, this.cx, w, this.cy);
      b.doomed = true; this.strike('break', (b.s0 + b.s1) / 2, this.cx, w, this.cy, b, hole); this.nextStrike = c.s1 + vv * r.range(2, 4);
      this.starArc(a.s1 - 2, c.s0 + 2, this.cx, this.cy, this.cy);
      return c.s1;
    }
    const p = this.plat(at, at + len, this.cx, w, this.cy);
    if (!kind) this.hellObstacles(r, vv, at + vv * 0.6, p.s1, this.cx, w, this.cy);
    if (kind) { this.strike(kind, at + len * 0.3, this.cx, w, this.cy); this.hellObstacles(r, vv, at + len * 0.3 + vv * 0.9, p.s1, this.cx, w, this.cy); // 피한 뒤 다음 점프까지 숨 돌릴 시간을 남긴다
      this.nextStrike = p.s1 + vv * r.range(2, 4); }
    this.starLine(at + len * 0.5, at + len * 0.8, this.cx, this.cy, 3);
    for (let i = 0; i < 5; i++) this.star(at + len * (0.55 + i * 0.07), this.cx, this.cy + 3.6); // 2단 점프해야 닿는 보너스
    return p.s1;
  }
  // 괴물이 내리치는 자리: 판정은 그 자리에 늘 있다 (곰돌이가 닿기 전에 반드시 먼저 떨어지니 누구에게나 같다)
  strike(kind, s, cx, w, y, plat, holeLen = 0) {
    const r = this.rng, th = this.themeOf(this.dream), P = th.P, col = P.g || '#ff3b30', side = r.chance(0.5) ? 1 : -1;
    const g = new THREE.Group(); g.position.set(cx, y, this.z(s)); g.userData.s = s; g.userData.keepGeo = true; g.visible = false; this.root.add(g);
    const rects = [], D = kind === 'sweep' || kind === 'beam' ? 0.9 : 2.6;
    if (kind === 'fist') { const left = r.chance(0.5), half = w * r.range(0.5, 0.6); rects.push(left ? [-w / 2, -w / 2 + half] : [w / 2 - half, w / 2]); }
    else if (kind === 'twin') { const lane = r.range(-w / 2 + 2, w / 2 - 2); rects.push([-w / 2, lane - 1.3], [lane + 1.3, w / 2]); }
    else if (kind !== 'break') rects.push([-w / 2, w / 2]);
    const y0 = kind === 'beam' ? 1.02 : 0, h = kind === 'beam' ? 1.2 : kind === 'sweep' ? 1.05 : 1.5, fists = [];
    for (const [a, b] of rects) {
      const m = buildFist(th.monster, P, b - a, h, D), x = (a + b) / 2; m.position.set(x, 18, 0); g.add(m); fists.push({ m, x, y: y0 });
      this.obs.push({ kind: kind === 'beam' ? 'bar' : 'slam', s0: s - D / 2, s1: s + D / 2, x0: cx + a, x1: cx + b, y0: y + y0, y1: y + y0 + h, mesh: g });
    }
    if (kind === 'break') { const m = buildFist(th.monster, P, Math.min(w, 4), 2, Math.min(holeLen, 4)); m.position.set(0, 18, 0); g.add(m); fists.push({ m, x: 0, y: 0 }); }
    // 바닥 예고: 내리칠 곳이 번쩍인다 (멀리서도 보이게 달리는 방향으로 길게)
    const tele = new THREE.Group(); for (const [a, b] of rects.length ? rects : [[-w / 2, w / 2]]) { const t = new THREE.Mesh(G_EDGE, glow(col, 0.55)), L = kind === 'break' ? holeLen : Math.max(D + 1.5, speedAt(s) * this.K * 0.1); t.scale.set(b - a, 0.03, L); t.position.set((a + b) / 2, 0.07, 0); tele.add(t); } g.add(tele);
    const mon = buildMonster(th.monster, P); mon.position.set(side * (w / 2 + 9), -18, 0); mon.rotation.y = Math.PI + side * 0.55; mon.scale.setScalar(1.25); g.add(mon);
    const arm = new THREE.Mesh(G.cyl(), glow(col, 0.45)); g.add(arm);
    this.strikes.push({ s, kind, g, side, w, fists, tele, mon, arm, plat, landed: false, t: 0, shock: 0 });
  }
  updateStrikes(t, playerS, v, dt) {
    const vs = Math.max(v || 0, 1), flash = Math.sin(t * 30) > -0.2;
    for (const st of this.strikes) {
      const eta = (st.s - playerS) / vs;
      if (eta > 1.35 || !v) continue;
      st.g.visible = true;
      st.mon.position.y += (-3 - st.mon.position.y) * Math.min(1, dt * 7);
      if (!st.landed) {
        st.tele.visible = flash;
        const p = eta > 0.5 ? 0 : Math.min(1, (0.5 - eta) / 0.12); // 닿기 0.5초 전부터 0.12초 만에 떨어진다
        for (const f of st.fists) {
          if (st.kind === 'sweep' || st.kind === 'beam') { f.m.position.y = f.y; f.m.position.x = f.x + st.side * (st.w + 16) * (1 - p * p); }
          else { f.m.position.y = f.y + 13 * (1 - p * p) * (eta > 0.5 ? 1 : 1) ; f.m.position.x = f.x; }
        }
        if (p >= 1) { st.landed = true; st.tele.visible = false; this.onSlam?.(st, st.s - playerS); }
      } else if (st.plat?.doomed) { st.fallV = (st.fallV || 0) + 40 * dt; st.plat.mesh.position.y -= st.fallV * dt; st.fists[0].m.position.y -= st.fallV * dt * 0.3; }
      // 팔: 어깨에서 손까지
      const hand = st.fists[0].m.position, sx = st.mon.position.x - st.side * 3, sy = st.mon.position.y + 3.5, dx = hand.x - sx, dy = hand.y + 1 - sy, L = Math.hypot(dx, dy);
      st.arm.position.set(sx + dx / 2, sy + dy / 2, 0); st.arm.scale.set(0.45, L, 0.45); st.arm.rotation.z = -Math.atan2(dx, dy);
    }
  }

  // ---------- 랜덤 이공간 ----------
  //   모두 일자(높이 0) 길. 맵마다 물리 규칙(R)이 달라서, 틈 · 장애물 간격은 그 맵의 점프 시간으로 잰다 (조작만 잘하면 늘 깰 수 있게)
  vR(d = this.dream) { return this.themeOf(d).R || NOR; }
  // 그 맵의 점프: 한 번 점프 시간 T1 · 높이 H1 · 점프를 다 쓴 가장 긴 체공 T (중력이 바뀌는 맵은 가장 무거울 때로 잰다)
  vPhys(R) {
    const g = 30 * (R.gpulse ? R.gpulse[1] : R.grav || 1), J = 11.5 * (R.jump || 1), J2 = 10.5 * (R.jump || 1), n = R.jumps ?? 2;
    const T1 = (2 * J) / g, H1 = (J * J) / (2 * g);
    let t = J / g, h = H1, T = T1;
    for (let k = 2; k <= n; k++) { t += J2 / g; h += (J2 * J2) / (2 * g); T = t + Math.sqrt((2 * h) / g); }
    return { g, J, T1, H1, T, side: 8.5 * (R.side || 1) * (R.ice ? 0.55 : 1) };
  }
  // 맵 안에서 얼마나 왔나 (0~1): 점점 빨라지는 맵 · 점점 세지는 끌림에 쓴다
  dreamProg(s, d) { const a = this.bounds[d] ?? 0, b = this.bounds[d + 1] ?? this.nextB; return Math.max(0, Math.min(1, (s - a) / Math.max(1, b - a))); }
  // 곰돌이가 지금 받는 이공간 규칙 (같은 씨앗 · 같은 시계라 다시 돌려 봐도 같다)
  mod(s) {
    if (!this.void) return null;
    const d = this.dreamAt(s), R = this.vR(d), p = this.dreamProg(s, d);
    let grav = R.grav || 1;
    if (R.gpulse) { const [lo, hi, per] = R.gpulse; grav = lo + (hi - lo) * (0.5 - 0.5 * Math.cos((this.time / per) * Math.PI * 2)); }
    const wind = R.wind ? R.wind[0] * Math.sin(s / R.wind[1] + d) : R.pull ? R.pull * (0.6 + p) * (d % 2 ? 1 : -1) : 0;
    return { grav, jump: R.jump || 1, jumps: R.jumps ?? 2, side: R.side || 1, ice: R.ice || 0, inv: !!R.inv, speed: (R.speed || 1) * (R.ramp ? 1 + R.ramp * p : 1), bounce: R.bounce || 0, wind };
  }
  voidPattern() {
    const r = this.rng, th = this.themeOf(this.dream), R = th.R || NOR, P = this.vPhys(R);
    const vv = speedAt(this.gs) * this.K * (R.speed || 1) * (R.ramp ? 1 + R.ramp * this.dreamProg(this.gs, this.dream) : 1);
    const pick = r.weighted(th.pats.map(([k, w]) => [k, k === this.lastPat && th.pats.length > 1 ? w * 0.3 : w]), (x) => x[1])[0]; this.lastPat = pick;
    this.cy = 0;
    const start = this.gs; this.gs = this[`vp_${pick}`](r, vv, P, R); (this.patLog ||= []).push([start, pick]); if (this.patLog.length > 60) this.patLog.shift();
  }
  // 이공간 발판 (높이 0). extra: blink · br · qx · crumble · pad · inv 같은 성질
  vp(s0, s1, x, w, extra) {
    const p = this.plat(s0, s1, x, w, 0, { thin: true, mv: extra?.mv, beacon: extra?.beacon });
    p.w0 = w; if (this.vR().dark) p.dark = true;
    if (extra) { const { mv, ...rest } = extra; Object.assign(p, rest); void mv; }
    if (extra?.inv || extra?.pad) { const m = glow(extra.pad ? '#7dff5a' : '#ff2bd6'); for (const c of p.mesh.children) if (c.geometry === G_EDGE) c.material = m; } // 분홍 = 좌우 반대 · 초록 = 발사대
    return p;
  }
  // 분홍(좌우 반대) 발판의 바닥 영역 위에 있나: 앞뒤 · 좌우가 발판 안이고 높이는 발판 윗면 이상 (뛰어올라도 그 위면 반대, 벗어나면 원래대로)
  overFlip(s, x, y) { for (const p of this.plats) if (p.inv && !p.doomed && s >= p.s0 && s <= p.s1 && Math.abs(x - p.cx) <= p.w / 2 && y >= p.y - 0.05) return true; return false; }
  vx(d) { this.cx = Math.max(-8, Math.min(8, this.cx + d)); return this.cx; }
  // 길 위 장애물: 다음 조작까지 '바쁜 시간'(점프 체공 · 숙이기 · 옆으로 비키기)에 짧은 반응 시간만 더해서 꿈나라보다 훨씬 빽빽하게
  vObs(r, vv, P, s0, s1, cx, w, kinds, gapK = 1) {
    let at = s0;
    const tall = P.H1 > 1.8;
    while (at < s1 - vv * Math.max(0.8, P.T1)) {
      const L = cx - w / 2, Rr = cx + w / 2, ok = kinds.filter((k) => (k !== 'wall' && k !== 'combo' && k !== 'lanes') || w >= 4.4).filter((k) => k !== 'tall' || tall), k = r.pick(ok.length ? ok : ['hurdle']);
      let busy = 0.4;
      if (k === 'hurdle') { this.obstacle('hurdle', at, L, Rr, 0, r.range(0.5, Math.min(0.75, P.H1 * 0.45))); busy = P.T1; }
      else if (k === 'tall') { this.obstacle('hurdle', at, L, Rr, 0, Math.min(1.25, P.H1 * 0.6), 0.7); busy = P.T1 * 1.05; }
      else if (k === 'bar') { this.obstacle('bar', at, L, Rr, 1, 2, 0.5); busy = 0.35; }
      else if (k === 'wall') { const half = w * r.range(0.5, 0.6), right = r.chance(0.5); this.obstacle('wall', at, right ? Rr - half : L, right ? Rr : L + half, 0, 1.6, 1.2); this.star(at, right ? L + (w - half) / 2 : Rr - (w - half) / 2, 1); busy = 0.45 / (P.side / 8.5); }
      else if (k === 'combo') { const half = w * r.range(0.5, 0.56), right = r.chance(0.5), a = right ? Rr - half : L, b = right ? Rr : L + half; this.obstacle('wall', at, a, b, 0, 1.6, 1.2); this.obstacle('bar', at, right ? L : b, right ? a : Rr, 1, 2, 0.5); busy = 0.55 / (P.side / 8.5); }
      else { const lane = r.range(L + 1.3, Rr - 1.3); if (lane - 0.8 > L) this.obstacle('hurdle', at, L, lane - 0.8, 0, 0.45, 1.2); if (lane + 0.8 < Rr) this.obstacle('hurdle', at, lane + 0.8, Rr, 0, 0.45, 1.2); this.star(at, lane, 1); busy = Math.min(P.T1, 0.5); }
      at += vv * (busy + r.range(0.14, 0.32) * gapK);
    }
  }
  vp_obst(r, vv, P, R) { const w = r.range(4.6, 7), p = this.vp(this.gs, this.gs + vv * r.range(3.5, 5.5), this.vx(r.range(-2, 2)), w); this.vObs(r, vv, P, p.s0 + vv * 0.5, p.s1, this.cx, w, R.bounce ? ['bar', 'hurdle', 'bar'] : ['hurdle', 'bar', 'wall', 'combo', 'lanes', 'tall']); this.starLine(p.s0 + 2, p.s0 + vv * 0.4, this.cx, 0, 3); return p.s1; }
  // 매트릭스: 느린 대신 숨 돌릴 틈이 거의 없다
  vp_dense(r, vv, P) { const w = r.range(5, 7), p = this.vp(this.gs, this.gs + vv * r.range(4, 6), this.vx(r.range(-2, 2)), w); this.vObs(r, vv, P, p.s0 + vv * 0.5, p.s1, this.cx, w, ['hurdle', 'bar', 'wall', 'combo', 'lanes'], 0.35); return p.s1; }
  // 틈 건너기: 한 번 점프(dbl 이면 점프를 다 써서) 체공의 절반 남짓
  vGaps(r, vv, P, T, n, wR, lR) {
    let at = this.gs;
    for (let i = 0; i < n; i++) {
      const gap = vv * T * r.range(0.48, 0.66), x0 = this.cx, a0 = at; this.vx(r.range(-1, 1) * Math.min(3.2, P.side * T * 0.3));
      at += gap; const len = vv * r.range(lR[0], lR[1]); this.vp(at, at + len, this.cx, r.range(wR[0], wR[1]));
      this.starArc(a0 - 1, at + 1, x0, 0, 0, this.cx); at += len;
    }
    return at;
  }
  vp_gaps(r, vv, P) { return this.vGaps(r, vv, P, P.T1, r.int(3, 5), [3, 5], [0.45, 0.8]); }
  vp_dgaps(r, vv, P) { return this.vGaps(r, vv, P, P.T, r.int(2, 4), [3.2, 5], [0.55, 0.9]); }
  // 토성 고리: 띄엄띄엄 떠 있는 운석. 점프를 다 써야 닿고, 한 번 빠지면 끝
  vp_stones(r, vv, P) {
    let at = this.gs;
    for (let i = 0, n = r.int(4, 7); i < n; i++) {
      const T = i % 3 === 2 ? P.T1 : P.T, gap = vv * T * r.range(0.5, 0.66), x0 = this.cx, a0 = at; this.vx((i % 2 ? 1 : -1) * r.range(1.4, Math.min(3.6, P.side * T * 0.32)));
      at += gap; const len = vv * r.range(0.34, 0.46); this.vp(at, at + len, this.cx, r.range(2.3, 3.2), { rock: true });
      this.starArc(a0 - 1, at + 1, x0, 0, 0, this.cx); at += len;
    }
    const p = this.vp(at, at + vv * 0.8, this.cx, 4); return p.s1;
  }
  // 좁고 구불구불한 길 (난간 없음)
  vp_narrow(r, vv, P) {
    let at = this.gs; const ph = r.range(0, 6), turn = Math.min(1.1, P.side * 0.12);
    for (let i = 0, n = r.int(10, 16); i < n; i++) {
      if (i > 2 && r.chance(0.16)) at += vv * P.T1 * r.range(0.38, 0.5);
      const len = vv * 0.3; this.vx(Math.sin(ph + i * 0.7) * turn); this.vp(at, at + len, this.cx, r.range(1.9, 2.4)); if (i % 2) this.star(at + len / 2, this.cx, 1); at += len;
    }
    return at;
  }
  vp_zig(r, vv, P) {
    let at = this.gs; const sh = Math.min(1.6, P.side * 0.5 * 0.38);
    for (let i = 0, n = r.int(5, 8); i < n; i++) { const len = vv * 0.5; this.vx((i % 2 ? 1 : -1) * sh * 2 * (i ? 1 : 0.5)); this.vp(at, at + len, this.cx, 2.6); this.star(at + len / 2, this.cx, 1); at += len; }
    return at;
  }
  // 은하 소용돌이: 좌우로 흔들리는 발판을 연달아
  vp_movers(r, vv, P) {
    let at = this.gs;
    for (let i = 0, n = r.int(3, 5); i < n; i++) { at += vv * P.T1 * r.range(0.32, 0.45); const len = vv * r.range(0.6, 0.8); this.vp(at, at + len, this.cx, 3, { mv: { amp: r.range(2, 3.4), f: r.range(0.9, 1.5), ph: r.range(0, 6) } }); this.star(at + len / 2, this.cx, 1); at += len; }
    const p = this.vp(at + vv * 0.25, at + vv * 0.95, this.cx, 5); return p.s1;
  }
  // 섬광: 발판이 박자에 맞춰 꺼졌다 켜진다. 꺼지기 전에 깜빡이고, 꺼진 시간은 점프 한 번보다 짧다
  vp_blink(r, vv, P) {
    const per = r.range(1.5, 1.9), off = Math.min(0.5, P.T1 * 0.6), len = vv * r.range(4, 6), p = this.vp(this.gs, this.gs + len, this.vx(r.range(-2, 2)), r.range(4, 5.5), { blink: [per, per - off, r.range(0, per)] });
    this.starLine(p.s0 + 2, p.s1 - 2, this.cx, 0, 6); return p.s1 + vv * 0.1;
  }
  // 빛과 어둠: 두 줄이 번갈아 단단해진다 (바뀔 때 잠깐 둘 다 있다)
  vp_yinyang(r, vv, P) {
    const per = r.range(1.9, 2.3), on = per / 2 + 0.15, ph = r.range(0, per), len = vv * r.range(4, 6), cx = this.vx(r.range(-1.5, 1.5));
    this.vp(this.gs, this.gs + len, cx - 1.8, 2.4, { blink: [per, on, ph] }); this.vp(this.gs, this.gs + len, cx + 1.8, 2.4, { blink: [per, on, ph + per / 2] });
    const end = this.gs + len, p = this.vp(end, end + vv * 0.6, cx, 6); return p.s1;
  }
  // 모든 게 시작된 곳: 발판이 숨 쉬듯 넓어졌다 좁아지며 흔들린다
  vp_breathe(r, vv, P) {
    let at = this.gs;
    for (let i = 0, n = r.int(2, 3); i < n; i++) { if (i) at += vv * P.T1 * r.range(0.35, 0.48); const len = vv * r.range(1.6, 2.4); this.vp(at, at + len, this.cx, 7, { br: [1.8, 7, r.range(2.4, 3.2), r.range(0, 6)], mv: { amp: 1.2, f: r.range(0.7, 1), ph: r.range(0, 6) } }); this.starLine(at + 2, at + len - 2, this.cx, 0, 4); at += len; }
    return at;
  }
  // 초신성: 밟은 조각은 잠깐 뒤 무너진다 → 계속 뛰어 넘어간다
  vp_crumble(r, vv, P, R) {
    let at = this.gs;
    for (let i = 0, n = r.int(6, 10); i < n; i++) { if (i > 1 && r.chance(0.2)) at += vv * P.T1 * r.range(0.35, 0.45); const len = vv * r.range(0.6, 0.8); this.vp(at, at + len, this.vx(r.range(-0.8, 0.8)), r.range(4, 5.5), { crumble: R.crumble || 0.42 }); this.star(at + len * 0.6, this.cx, 2); at += len; }
    const p = this.vp(at, at + vv * 0.7, this.cx, 5); return p.s1;
  }
  // 웜홀: 초록 발사대를 밟으면 하늘 높이 튀어 올라 큰 틈을 건넌다 (발사대 전에 뛰면 못 건넌다)
  vp_pads(r, vv, P) {
    const run = this.vp(this.gs, this.gs + vv * r.range(0.8, 1.2), this.cx, 5), pv = P.J * 2.6, Tp = (2 * pv) / P.g, pad = this.vp(run.s1, run.s1 + vv * 0.35, this.cx, 5, { pad: pv });
    const x0 = this.cx; this.vx(r.pick([-1, 1]) * r.range(2, Math.min(4.5, P.side * Tp * 0.3)));
    const s0 = pad.s0 + vv * Tp * 0.72, p = this.vp(s0, pad.s1 + vv * (Tp + 0.9), this.cx, 4.5, { beacon: true });
    // 별: 발사대를 밟고 날아가는 실제 궤적 위에 (별은 곰 발보다 1m 위에 있어야 몸에 닿는다)
    const fly = vv * Tp, n = Math.max(2, Math.round(fly / 2.5));
    for (let i = 1; i < n; i++) { const k = i / n, t = Tp * k; this.star(pad.s0 + fly * k, x0 + (this.cx - x0) * k, pv * t - (P.g / 2) * t * t + 1); }
    return p.s1;
  }
  // 디지털 그리드: 세 줄 길. 벽이 두 줄을 막으니 열린 줄로 옮겨 탄다
  vp_lanes(r, vv, P) {
    const cx = this.vx(r.range(-1, 1) * 1.5), len = vv * r.range(4, 6), s0 = this.gs, xs = [cx - 3.2, cx, cx + 3.2];
    for (const x of xs) this.vp(s0, s0 + len, x, 2.1);
    let at = s0 + vv * 0.6, open = r.int(0, 2);
    while (at < s0 + len - vv * 0.5) {
      for (let i = 0; i < 3; i++) if (i !== open) this.obstacle('wall', at, xs[i] - 1.05, xs[i] + 1.05, 0, 2.6, 1); else this.star(at, xs[i], 1);
      const next = r.int(0, 2), d = Math.abs(next - open); open = next; at += vv * (d * 0.4 / (P.side / 8.5) + r.range(0.22, 0.4));
    }
    const p = this.vp(s0 + len, s0 + len + vv * 0.5, cx, 9); return p.s1;
  }
  // 퀘이사 빔: 빛줄기가 위아래로 오르내린다 → 낮으면 뛰어넘고, 높으면 숙이거나 그냥 지나간다
  vp_lasers(r, vv, P) {
    const w = 6, p = this.vp(this.gs, this.gs + vv * r.range(4, 6), this.vx(r.range(-1.5, 1.5)), w);
    for (let at = p.s0 + vv * 0.6; at < p.s1 - vv * 0.8; at += vv * (P.T1 + r.range(0.18, 0.36))) { const o = this.obstacle('laser', at, this.cx - w / 2, this.cx + w / 2, 0, 0.3, 0.4); o.osc = [0.1, 2.3, r.range(2.6, 3.6), r.range(0, 6)]; }
    return p.s1;
  }
  // 소행성대: 운석이 길을 가로질러 오간다 (옆으로 피하거나 뛰어넘는다)
  vp_asteroids(r, vv, P) {
    const w = 9, p = this.vp(this.gs, this.gs + vv * r.range(4, 6), this.vx(r.range(-1, 1)), w);
    for (let at = p.s0 + vv * 0.6; at < p.s1 - vv * 0.6; at += vv * (P.T1 * 0.9 + r.range(0.12, 0.3))) { const o = this.obstacle('wall', at, this.cx - 0.8, this.cx + 0.8, 0, 1, 1.4); o.bx0 = o.x0; o.bx1 = o.x1; o.mvx = [3.2, r.range(1, 1.6), r.range(0, 6)]; }
    this.starLine(p.s0 + 2, p.s0 + vv * 0.5, this.cx, 0, 3); return p.s1;
  }
  // 최후의 날: 넓은 길 위로 운석이 쉴 새 없이 떨어진다. 떨어질 자리에는 점선이 먼저 보인다
  vp_meteor(r, vv, P) {
    const w = 8, p = this.vp(this.gs, this.gs + vv * r.range(4.5, 6.5), this.vx(r.range(-1, 1)), w);
    let lastX = this.cx;
    for (let at = p.s0 + vv * 0.7; at < p.s1 - vv * 0.4; at += vv * r.range(0.42, 0.66)) { const rr = r.range(1, 1.5); let x = this.cx + r.range(-w / 2 + rr, w / 2 - rr); if (Math.abs(x - lastX) < 1) x = this.cx + (x > this.cx ? -1 : 1) * r.range(1, w / 2 - rr); lastX = x; this.meteor(at, x, rr); }
    this.starLine(p.s0 + 2, p.s0 + vv * 0.6, this.cx, 0, 3); return p.s1;
  }
  // 양자 터널: 발판이 두 자리 사이를 순간 이동한다 (바뀌기 전에 깜빡인다)
  vp_quantum(r, vv, P) {
    let at = this.gs;
    for (let i = 0, n = r.int(3, 5); i < n; i++) { if (i) at += vv * P.T1 * r.range(0.3, 0.4); const len = vv * r.range(1, 1.4); this.vp(at, at + len, this.vx(r.range(-0.6, 0.6)), 3.2, { qx: [-1.8, 1.8, r.range(1.3, 1.7), r.range(0, 2)] }); this.star(at + len / 2, this.cx, 2.4); at += len; }
    const p = this.vp(at + vv * 0.25, at + vv * 0.9, this.cx, 6); return p.s1;
  }
  // 좌우로 번갈아 막는 벽 (거울 · 얼음 · 반전 맵에서 특히 어렵다)
  vp_slalom(r, vv, P, R) {
    // 얼음: 미끄러져 멈추는 데까지 시간을 더 준다
    const w = R.ice ? 8 : 7, p = this.vp(this.gs, this.gs + vv * r.range(4, 6), this.vx(r.range(-1.5, 1.5)), w, R.flip ? { inv: true } : undefined);
    let side = r.chance(0.5) ? 1 : -1;
    for (let at = p.s0 + vv * 0.6; at < p.s1 - vv * 0.5; at += vv * ((R.ice ? 1.35 : 0.55 / (P.side / 8.5)) + r.range(0.15, 0.3))) { const half = w * 0.55, x0 = side > 0 ? this.cx + w / 2 - half : this.cx - w / 2; this.obstacle('wall', at, x0, x0 + half, 0, 2.6, 1); this.star(at, side > 0 ? this.cx - w / 2 + (w - half) / 2 : this.cx + w / 2 - (w - half) / 2, 1); side = -side; }
    return p.s1;
  }
  // 끝없는 반전: 분홍 발판 위에서는 좌우가 반대 (발판마다 바뀐다)
  vp_flipzone(r, vv, P, R) {
    let at = this.gs;
    for (let i = 0, n = r.int(3, 4); i < n; i++) {
      const inv = i % 2 === 1, w = 6.5, len = vv * r.range(1.6, 2.2), p = this.vp(at, at + len, this.vx(r.range(-1.5, 1.5)), w, inv ? { inv: true } : undefined);
      let side = r.chance(0.5) ? 1 : -1;
      for (let s = p.s0 + vv * 0.55; s < p.s1 - vv * 0.3; s += vv * (0.6 + r.range(0.15, 0.3))) { const half = w * 0.55, x0 = side > 0 ? this.cx + w / 2 - half : this.cx - w / 2; this.obstacle('wall', s, x0, x0 + half, 0, 2.6, 1); side = -side; }
      at = p.s1 + vv * P.T1 * r.range(0.3, 0.4);
    }
    const p = this.vp(at, at + vv * 0.6, this.cx, 6); void R; return p.s1;
  }
  // 프리즘 다리: 아주 좁은 빛 다리를 옆으로 뛰어 옮겨 탄다
  vp_beams(r, vv, P) {
    let at = this.gs;
    for (let i = 0, n = r.int(4, 6); i < n; i++) { const x0 = this.cx, a0 = at; at += vv * P.T1 * r.range(0.25, 0.4); this.vx((i % 2 ? 1 : -1) * r.range(2.2, Math.min(3.4, P.side * P.T1 * 0.4))); const len = vv * r.range(0.7, 1); this.vp(at, at + len, this.cx, 1.5); this.starArc(a0 - 1, at + 1, x0, 0, 0, this.cx); at += len; }
    const p = this.vp(at, at + vv * 0.6, this.cx, 5); return p.s1;
  }
  // 운석 하나: 판정은 처음부터 그 자리에 있다 (곰돌이가 닿기 전에 반드시 먼저 떨어지니 누구에게나 같다)
  meteor(s, x, rr) {
    const th = this.themeOf(this.dream), col = th.P?.a || '#ff7a1f', g = new THREE.Group(); g.position.set(x, 0, this.z(s)); g.userData.s = s; g.userData.keepGeo = true; this.root.add(g);
    const dots = new THREE.Group(), dm = glow(col, 0.9); // 떨어질 자리: 점선 동그라미
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, d = new THREE.Mesh(G_BOX, dm); d.scale.set(0.34, 0.05, 0.14); d.position.set(Math.cos(a) * rr, 0.06, Math.sin(a) * rr); d.rotation.y = -a; dots.add(d); }
    g.add(dots);
    const rock = new THREE.Group(), body = new THREE.Mesh(G_ROCK, new THREE.MeshToonMaterial({ color: th.P?.rock || '#3a2a20' })); body.scale.setScalar(rr * 0.85); rock.add(body);
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(G_PUFF, glow(i % 2 ? col : '#ffd166', 0.8 - i * 0.1)); f.scale.setScalar(rr * (0.8 - i * 0.1)); f.position.set(i * 0.9, i * 1.4, 0); rock.add(f); }
    rock.visible = false; g.add(rock);
    const o = { kind: 'meteor', s0: s - rr * 0.8, s1: s + rr * 0.8, x0: x - rr * 0.8, x1: x + rr * 0.8, y0: 0, y1: 1.1, mesh: g };
    this.obs.push(o); this.meteors.push({ s, g, rock, dots, landed: false, side: this.rng.chance(0.5) ? 1 : -1 });
  }
  updateVoid(t, playerS, v, dt) {
    const fl = Math.sin(t * 40) > 0;
    for (const p of this.plats) {
      if (p.blink) { const [per, on, ph] = p.blink, c = (((t + ph) % per) + per) % per; p.off = c >= on; p.mesh.visible = !p.off && (c < on - 0.35 || fl); }
      if (p.br) { const [lo, hi, f, ph] = p.br; p.w = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * f + ph)); p.mesh.scale.x = p.w / p.w0; }
      if (p.qx) { const [a, b, per, ph] = p.qx, c = (((t + ph) % per) + per) % per, half = per / 2, nx = p.x + (c < half ? a : b); p.dx = 0; p.cx = nx; p.mesh.position.x = nx; p.mesh.visible = (c < half ? half - c : per - c) > 0.35 || fl; }
      if (p.crumble && p.touchT != null && !p.doomed) { if (t - p.touchT > p.crumble) p.doomed = true; else p.mesh.position.x = p.cx + Math.sin(t * 70) * 0.06; }
      if (p.crumble && p.doomed) { p.fallV = (p.fallV || 0) + 40 * dt; p.mesh.position.y -= p.fallV * dt; }
      if (p.dark) p.mesh.visible = p.s0 - playerS < 26;
    }
    for (const o of this.obs) {
      if (o.mvx) { const [amp, f, ph] = o.mvx, dx = Math.sin(t * f + ph) * amp; o.x0 = o.bx0 + dx; o.x1 = o.bx1 + dx; o.mesh.position.x = (o.x0 + o.x1) / 2; }
      if (o.osc) { const [lo, hi, f, ph] = o.osc, h = o.y1 - o.y0, y = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * f + ph)); o.y0 = y; o.y1 = y + h; o.mesh.position.y = y; }
      if (o.dark) o.mesh.visible = o.s0 - playerS < 26;
    }
    // 운석: 닿기 1.4초 전부터 비스듬히 떨어져서 0.55초 전에 땅에 박힌다
    const vs = Math.max(v || 0, 1);
    for (const m of this.meteors) {
      const eta = (m.s - playerS) / vs;
      m.dots.visible = !m.landed && (eta > 1.4 || fl);
      if (m.landed || !v || eta > 1.4) continue;
      const k = Math.max(0, Math.min(1, (1.4 - eta) / 0.85));
      m.rock.visible = true; m.rock.position.set(m.side * 26 * (1 - k), 0.6 + 44 * (1 - k) * (1 - k), -10 * (1 - k)); m.rock.rotation.set(t * 3, t * 2, 0);
      if (k >= 1) { m.landed = true; for (let i = 1; i < m.rock.children.length; i++) m.rock.children[i].visible = false; this.onSlam?.(m, m.s - playerS); }
    }
  }

  // ---------- 🗺️ 서울 맵 (러너-개선 6) ----------
  //   찻길 · 보도 위를 달린다. 행인 젤리 · 자전거는 건널목을 건너고, 차는 교차로를 가로지르고, 차 · 버스 · 오토바이는 마주 온다
  //   움직임은 모두 같은 시계 t 로만 정해서(곰 위치와 상관없이) 같은 방 사람 · 기록 다시 돌리기에서 똑같다
  //   모양은 브라우저가 this.makeMover(kind, n) 로 넣는다 (서버의 기록 다시 돌리기에선 빈 묶음)
  mover(kind, o) {
    const g = this.makeMover?.(kind, o.n ?? 0) || new THREE.Group();
    this.root.add(g); g.userData.s = o.sEnd ?? o.s ?? 0;
    const ob = { kind: o.hitKind || 'mover', s0: -1e9, s1: -1e9, x0: 1e9, x1: 1e9, y0: o.y, y1: o.y + o.h, mesh: g, seoul: kind };
    this.obs.push(ob);
    const mv = { kind, ob, g, ...o }; this.movers.push(mv); this.placeMover(mv, this.time || 0); return mv;
  }
  placeMover(m, t) {
    const ob = m.ob, g = m.g;
    if (m.type === 'cross') {
      // 건너기: 길 한쪽 밖 → 반대쪽 밖, 그다음 쉬었다가 다시 (방향은 정해진 대로)
      const run = (m.xR - m.xL) / m.v, cyc = run + m.rest, tau = (((t + m.ph * cyc) % cyc) + cyc) % cyc;
      if (tau > run) { ob.x0 = ob.x1 = 1e9; g.visible = false; return; }
      const xc = m.dir > 0 ? m.xL + m.v * tau : m.xR - m.v * tau;
      ob.x0 = xc - m.lx / 2; ob.x1 = xc + m.lx / 2; ob.s0 = m.s - m.ls / 2; ob.s1 = m.s + m.ls / 2; g.visible = true;
      g.position.set(xc, m.y, this.z(m.s)); g.rotation.y = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2; g.userData.walk = tau;
    } else {
      // 마주 오기: sFar(길 끝 너머 40m)에서 나타나 sNear 까지, 쉬었다가 다시. 오토바이는 좌우로 흔들며
      const span = m.sFar - m.sNear, run = span / m.v, cyc = run + m.rest, tau = (((t + m.ph * cyc) % cyc) + cyc) % cyc;
      if (tau > run) { ob.s0 = ob.s1 = -1e9; g.visible = false; return; }
      const sc = m.sFar - m.v * tau, xc = m.x + (m.weave ? Math.sin(t * 1.7 + m.ph * 6) * m.weave : 0);
      // 부딪힘은 그 길 구간 안에서만 (나타나는 곳은 늘 40m 앞)
      if (sc < m.sEnd + 2) { ob.s0 = sc - m.ls / 2; ob.s1 = sc + m.ls / 2; ob.x0 = xc - m.lx / 2; ob.x1 = xc + m.lx / 2; } else { ob.s0 = ob.s1 = -1e9; }
      g.visible = true; g.position.set(xc, m.y, this.z(sc)); g.rotation.y = m.weave ? Math.cos(t * 1.7 + m.ph * 6) * 0.25 : 0; g.userData.walk = tau;
    }
    g.userData.anim?.(g, t);
  }
  updateMovers(t) { for (const m of this.movers) this.placeMover(m, t); }
  // 길 위 장식 (건널목 줄무늬 · 정지선 · 중앙선): 발판 윗면에 얇게
  deco(s0, s1, x, w, y, kind) {
    const g = new THREE.Group(), white = glow('#f4f4f2'), yel = glow('#ffcf33');
    if (kind === 'zebra') for (let i = 0; i < Math.floor(w / 0.9); i++) { const m = new THREE.Mesh(G_BOX, white); m.scale.set(0.5, 0.03, s1 - s0); m.position.set(-w / 2 + 0.45 + i * 0.9, 0.02, 0); g.add(m); }
    if (kind === 'stop') { const m = new THREE.Mesh(G_BOX, white); m.scale.set(w * 0.9, 0.03, 0.35); m.position.y = 0.02; g.add(m); }
    if (kind === 'center') { for (const sx of [-0.12, 0.12]) { const m = new THREE.Mesh(G_BOX, yel); m.scale.set(0.12, 0.03, s1 - s0); m.position.set(sx, 0.02, 0); g.add(m); } }
    g.position.set(x, y, this.z((s0 + s1) / 2)); g.userData.s = (s0 + s1) / 2; this.root.add(g); this.decos.push(g); return g;
  }
  // 코스가 바뀌는 곳 (6-7): 서울 밤거리 빛 축제 같은 문을 번갈아 (지나면 빛으로 하얗게 덮였다가 다음 코스)
  //   빛 터널: 전구 줄 아치가 겹겹이 · 청사초롱 문: 기둥 둘 + 가로대에 청사초롱 줄 · 무지개 빛 문: 색 아치 다섯
  seoulGate(s, x, y, w) {
    const kind = ['tunnel', 'bridge', 'light'][this.gateN++ % 3], g = new THREE.Group(), R = w / 2 + 1.4;
    // 아치 하나: 가는 관 + 전구 (전구는 그물 하나에 모아 그리기 호출을 줄인다)
    const bulbs = [], arch = (z, col, r = R, tube = 0.06) => { const a = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 5, 28, Math.PI), glow(col)); a.position.set(0, 0.1, z); g.add(a); for (let i = 0; i <= 14; i++) { const t = (i / 14) * Math.PI; bulbs.push([Math.cos(t) * r, 0.1 + Math.sin(t) * r, z]); } };
    if (kind === 'tunnel') {
      for (let i = 0; i < 7; i++) arch(-9 + i * 3, i % 2 ? '#ffe2a8' : '#fff4dc');
    } else if (kind === 'bridge') {
      // 청사초롱: 위는 파랑 · 아래는 빨강 등, 노란 술
      const pole = new THREE.MeshToonMaterial({ color: '#6d3b26' }), beam = new THREE.MeshToonMaterial({ color: '#8b4a2c' });
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(G_BOX, pole); p.scale.set(0.4, 6.6, 0.4); p.position.set(sx * (R + 0.2), 3.3, 0); g.add(p); }
      const b = new THREE.Mesh(G_BOX, beam); b.scale.set(2 * R + 1.6, 0.42, 0.5); b.position.set(0, 6.4, 0); g.add(b);
      const blue = glow('#3d6cff'), red = glow('#ff4a5c'), tassel = glow('#ffd54f');
      for (let i = 0; i < 7; i++) { const lx = -R + 0.9 + (i * (2 * R - 1.8)) / 6, L = new THREE.Group(); L.position.set(lx, 5.2, 0);
        const top = new THREE.Mesh(G_PUFF, blue); top.scale.set(0.42, 0.34, 0.42); top.position.y = 0.2; const bot = new THREE.Mesh(G_PUFF, red); bot.scale.set(0.42, 0.42, 0.42); bot.position.y = -0.2; const t2 = new THREE.Mesh(G_BOX, tassel); t2.scale.set(0.06, 0.5, 0.06); t2.position.y = -0.75; L.add(top, bot, t2); g.add(L); }
      arch(-4, '#ffe2a8', R + 0.6); arch(4, '#ffe2a8', R + 0.6);
    } else {
      ['#ff4081', '#ffb74d', '#ffee58', '#69f0ae', '#40c4ff'].forEach((c, i) => arch(-6 + i * 3, c, R, 0.09));
    }
    if (bulbs.length) { const im = new THREE.InstancedMesh(G_PUFF, glow('#fffaf0'), bulbs.length), o = new THREE.Object3D(); bulbs.forEach(([bx, by, bz], i) => { o.position.set(bx, by, bz); o.scale.setScalar(0.11); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); g.add(im); }
    g.position.set(x, y, this.z(s)); g.userData.s = s;
    g.userData.anim = (o, t) => { const k = 1 + Math.sin(t * 4) * 0.035; o.children.forEach((c, i) => { if (c.isInstancedMesh) c.scale.setScalar(1); else if (kind === 'light') c.scale.setScalar(k + Math.sin(t * 3 + i) * 0.02); }); };
    this.root.add(g); this.portals.push({ s, mesh: g, dream: this.dream });
  }
  // 서울 맵 길 (6-7): 실제 그 코스 길(seoul-routes.js)의 교차로 · 정류장 거리에 맞춰 장애물을 둔다
  //   길은 끊김 · 턱 없이 한 줄(폭 9m · 골목 코스는 7m, 레인 3개). 그 코스 길 위 거리 u = s - (코스 시작 s) + SEOUL_U0
  //   교차로 앞: 넓은 길이면 교차로를 가로지르는 차 + 횡단보도 행인, 좁은 길 · 골목이면 건너는 행인 · 자전거
  //   정류장 앞: 정류장으로 들어오는 버스. 그 밖은 길 폭에 맞게 (큰길 = 차 · 버스, 골목 · 산책길 = 자전거 · 행인 · 배달 오토바이)
  seoulPattern() {
    const r = this.rng, s = this.gs, v = speedAt(s), d = Math.min(1, s / 3000), W = seoulLaneW(seoulCourseOf(this, this.dream));
    this.cx = 0; this.cy = 0;
    const R = ROUTES[seoulCourseOf(this, this.dream)], base = this.bounds[this.dream] - SEOUL_U0, u = s - base;
    const roadW = R.w[Math.max(0, Math.min(R.w.length - 1, Math.floor((u + 20) / 20)))] || 0, big = roadW >= 14;
    // 앞의 실제 교차로 · 정류장 (판정 거리로)
    const X = R.xs.find(([du]) => du > u + 16), xS = X ? base + X[0] : Infinity, bS = (R.bus.find((b) => b > u + 24) ?? Infinity) + base;
    let at = s;
    const flat = (len) => { const p = this.plat(at, at + len, 0, W, 0); at += len; return p; };
    const L = [-W / 3, 0, W / 3];
    const VEH = { car: [1.86, 4.8, 1.45], suv: [1.9, 4.7, 1.72], taxi: [1.86, 4.9, 1.6], bus: [2.5, 11, 3.25], moto: [0.75, 2.0, 1.4], bike: [0.6, 1.8, 1.2], ped: [0.6, 0.6, 1.25] };
    const oncoming = (p, kind, lane, speed, ph, extra = {}) => { const [wx, ls, h] = VEH[kind]; return this.mover(kind, { type: 'on', x: lane, y: 0, h, lx: wx, ls, sNear: p.s0 - 12, sFar: p.s1 + 40, sEnd: p.s1, v: speed, rest: r.range(0.6, 2.2), ph, n: r.int(0, 1e6), ...extra }); };
    const cross = (p, kind, sAt, dir, speed, ph, rest, half = W / 2 + 4) => { const [wx, ls, h] = VEH[kind]; return this.mover(kind, { type: 'cross', s: sAt, sEnd: sAt + 4, y: 0, h, lx: ls, ls: wx, xL: -half, xR: half, dir, v: speed, rest, ph, n: r.int(0, 1e6) }); };
    const carKind = () => r.pick(['car', 'car', 'suv', 'taxi']);
    if (xS - s < 46) {
      // 실제 교차로: 그 너머 12m 까지 한 구간
      const p = flat(Math.max(14, xS - s + 12)), ow = X[1];
      if (big && ow >= 8) {
        // 큰 교차로: 가로지르는 차(교차로 한가운데) + 그 앞 횡단보도 행인
        const n = d > 0.15 ? 3 : d > 0.05 ? 2 : 1; for (let i = 0; i < n; i++) cross(p, carKind(), xS - ow / 4 + (i * ow) / 4, i % 2 ? -1 : 1, r.range(8, 11), r.next(), r.range(0.8, 1.8), W / 2 + 14);
        const zs = xS - ow / 2 - 3.2; for (let i = 0, m = r.int(1, 2) + Math.round(d * 2); i < m; i++) cross(p, r.chance(0.2) ? 'bike' : 'ped', zs + r.range(-1.4, 1.4), r.chance(0.5) ? 1 : -1, r.chance(0.2) ? 4.2 : r.range(1.3, 1.9), r.next(), r.range(0.2, 1.5));
        this.starArc(xS - 5, xS + 5, 0, 0, 0);
      } else {
        // 골목 · 작은 길이 만나는 곳: 건너는 행인 · 자전거 (가끔 골목에서 나오는 오토바이)
        const n = r.int(2, 3) + Math.round(d * 2); for (let i = 0; i < n; i++) { const moto = d > 0.08 && r.chance(0.2), bike = !moto && r.chance(0.25); cross(p, moto ? 'moto' : bike ? 'bike' : 'ped', xS + r.range(-1.6, 1.6), r.chance(0.5) ? 1 : -1, moto ? 7 : bike ? 4.2 : r.range(1.3, 1.9), r.next(), r.range(0.2, 1.5)); }
        this.starLine(p.s0 + 3, xS - 4, r.pick(L), 0, 3);
      }
    } else if (bS - s < 50) {
      // 정류장: 들어오는 버스(바깥 차로) + 옆 차로 차
      const p = flat(bS - s + 16); oncoming(p, 'bus', L[2], r.range(6, 8.5), r.next()); if (r.chance(0.6)) oncoming(p, carKind(), L[0], r.range(8, 11), r.next()); this.starLine(p.s0 + 4, p.s1 - 4, L[0], 0, 5);
    } else {
      // 다음 교차로 · 정류장 앞 30m 까지 채운다 (너무 길면 나눠서)
      const room = Math.min(xS, bS) - s - 30, len = Math.max(18, Math.min(room, r.range(30, 48) * (1 + v / 40)));
      const pick = r.weighted(big ? [['street', 3], ['rush', d > 0.3 ? 1.4 : 0], ['delivery', d > 0.1 ? 1.2 : 0.3], ['construction', 1.4]] : [['bikepath', 3], ['delivery', d > 0.1 ? 1.4 : 0.4], ['construction', 1.0], ['street', roadW ? 1.2 : 0]], (x) => x[1])[0];
      const p = flat(len);
      switch (pick) {
        case 'street': { const n = r.int(1, 2) + Math.round(d * 3); for (let i = 0; i < n; i++) oncoming(p, carKind(), L[(i + r.int(0, 2)) % 3], r.range(8, 12), r.next(), { rest: r.range(0.3, 1.2) }); this.starLine(p.s0 + 6, p.s1 - 6, r.pick(L), 0, r.int(3, 6)); break; }
        case 'rush': { for (let i = 0; i < 4; i++) oncoming(p, i === 0 && r.chance(0.5) ? 'bus' : carKind(), L[i % 3], r.range(8, 12), r.next()); break; }
        case 'delivery': { for (let i = 0; i < r.int(3, 4); i++) oncoming(p, 'moto', L[i % 3], r.range(10, 14), r.next(), { weave: r.range(0.6, 1.4), rest: r.range(0.3, 1) }); break; }
        case 'bikepath': { for (let i = 0; i < r.int(3, 4); i++) oncoming(p, r.chance(0.5) ? 'bike' : 'ped', L[i % 3], r.range(2.5, 5), r.next(), { rest: r.range(0.2, 0.8) }); this.starLine(p.s0 + 4, p.s1 - 4, r.pick(L), 0, 4); break; }
        case 'construction': { const at2 = p.s0 + (p.s1 - p.s0) * 0.35, side = r.chance(0.5) ? 1 : -1, half = W * r.range(0.45, 0.6);
          const x0 = side > 0 ? W / 2 - half : -W / 2, x1 = x0 + half; this.seoulStatic('barrier', at2, x0, x1, 0, 1.4, 1.4);
          if (p.s1 - at2 > v * 0.9) this.seoulStatic('cones', at2 + v * 0.75, -W / 2, W / 2, 0, 0.6, 0.6);
          if (d > 0.05 && p.s1 - at2 > v * 1.6) this.seoulStatic('banner', at2 + v * 1.5, -W / 2, W / 2, 1.0, 2.2, 0.5);
          this.starLine(p.s0 + 2, at2 - 2, side > 0 ? x0 - 1 : x1 + 1, 0, 4); break; }
      }
    }
    this.gs = at;
  }
  // 서 있는 장애물 (공사 가림막 · 고깔 줄 · 머리 위 현수막): 판정은 기존 장애물과 같고 모양만 서울
  seoulStatic(kind, sAt, x0, x1, y0, y1, depth) {
    if (!this.makeMover) return this.obstacle(kind === 'banner' ? 'bar' : kind === 'barrier' ? 'wall' : 'hurdle', sAt, x0, x1, y0, y1, depth);
    const g = this.makeMover(kind, Math.round((x1 - x0) * 100)) || new THREE.Group(); g.userData.w = x1 - x0;
    g.position.set((x0 + x1) / 2, y0, this.z(sAt)); g.userData.s = sAt; g.userData.fit?.(g, x1 - x0, y1 - y0); this.root.add(g);
    const o = { kind: kind === 'banner' ? 'bar' : kind === 'barrier' ? 'wall' : 'hurdle', s0: sAt - depth / 2, s1: sAt + depth / 2, x0, x1, y0, y1, mesh: g, seoul: kind }; this.obs.push(o); return o;
  }

  // ---------- 판정 ----------
  // 움직이는 발판 위치 갱신 (모두 같은 시계 t 로 움직여서 모두에게 같은 자리)
  update(t, playerS, v = 0, dt = 0) {
    this.time = t;
    if (this.hell) this.updateStrikes(t, playerS, v, dt);
    if (this.void) this.updateVoid(t, playerS, v, dt);
    for (const p of this.plats) {
      if (!p.mv) continue;
      const nx = p.x + Math.sin(t * p.mv.f + p.mv.ph) * p.mv.amp;
      p.dx = nx - p.cx; p.cx = nx; p.mesh.position.x = nx;
    }
    for (const st of this.stars) if (!st.got) { st.mesh.rotation.y = t * 2.5 + st.s; }
    for (const po of this.portals) po.mesh.userData.anim(po.mesh, t);
    if (this.seoul) { this.updateMovers(t); this.xLim = seoulLaneW(seoulCourseOf(this, this.dreamAt(playerS))) / 2 - 0.2; }
    for (const b of this.boxes) if (!b.got) { b.mesh.children[0].rotation.set(t * 1.3, t * 1.8, 0); b.mesh.position.y = b.y + Math.sin(t * 2.5 + b.s) * 0.15; }
    // 아주 멀리 달리면 숫자가 커져서 떨리지 않게 원점을 옮긴다
    if (playerS - this.origin > 1500) this.shift(1500);
  }
  shift(k) { this.origin += k; for (const c of this.root.children) c.position.z += k; this.env?.shift(k); }
  // (s, x) 아래에서 가장 높은 발판 윗면 (y 보다 조금 위까지는 올라선다)
  ground(s, x, y) {
    let best = null;
    for (const p of this.plats) {
      if (p.doomed || p.off || s < p.s0 - 0.2 || s > p.s1 + 0.2 || Math.abs(x - p.cx) > p.w / 2 + 0.3) continue;
      if (p.y <= y + 0.45 && (!best || p.y > best.y)) best = p;
    }
    return best;
  }
  // 앞을 막는 발판 옆면 (위로 0.9m 안이면 훌쩍 올라선다)
  wall(s0, s1, x, y) {
    for (const p of this.plats) {
      if (p.doomed || p.off || p.s0 < s0 - 0.01 || p.s0 > s1 + 0.01 || Math.abs(x - p.cx) > p.w / 2) continue;
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
  breakOne(o) { this.obs = this.obs.filter((x) => x !== o && x.mesh !== o.mesh); this.drop(o.mesh); }
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
const STAR_M = new THREE.MeshToonMaterial({ color: '#ffd23f', emissive: '#7a5200' });
const STAR_RIM = new THREE.MeshBasicMaterial({ color: '#a8560a', side: THREE.BackSide });
const STAR_HALO = new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,220,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
const G_SHADOW = new THREE.CircleGeometry(1, 20);
const G_ROCK = new THREE.DodecahedronGeometry(1, 0);
const NOR = {};
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
