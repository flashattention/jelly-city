// ⏳ 시간 여행: 길 위 배역 모양 (브라우저만, track.makeMover 로 넣는다)
//   역할마다 판정 크기가 같다 (track.js timePattern): cross 0.6 × 0.6 × 1.25 · on 1.86 × 4.8 × 1.45 · big 2.5 × 9 × 3 · weave 0.75 × 2 × 1.4
//   서 있는 것(wall · hurdle · bar)은 fit(o, 폭, 높이) 로 판정 폭에 맞춘다 (bar 는 y=1.0 에서 시작)
//   모양은 판정 상자를 넉넉히 채우되 넘치지 않게. 앞 = +z (마주 오는 것은 곰을 본다)
import { THREE, add, B, C, S, Sh, K, T, Oct, Rock, glow, G, flame, liven } from './time-lib.js';
import { CAST_PEOPLE } from './time-cast-people.js';
import { COSMOS } from './time-kits-cosmos.js';

const rnd = (n) => { let s = (n * 2654435761) >>> 0; const f = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; return { next: f, range: (a, b) => a + (b - a) * f(), int: (a, b) => Math.floor(a + (b - a + 1) * f()), pick: (a) => a[Math.floor(f() * a.length)], chance: (p) => f() < p }; };
const g0 = () => new THREE.Group();
const anim = (o, f) => { o.userData.anim = f; return o; };
// 빛 웅덩이 (밤 · 어두운 시대에도 길 위 것이 잘 보이게): 아래에 깔리는 둥근 빛
let HALO = null;
function haloMat() { if (HALO) return HALO; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); HALO = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); return HALO; }
const G_PLANE = new THREE.PlaneGeometry(1, 1);
export function halo(p, w, l, y = 0.03) { const m = new THREE.Mesh(G_PLANE, haloMat()); m.rotation.x = -Math.PI / 2; m.scale.set(w, l, 1); m.position.y = y; m.renderOrder = 3; p.add(m); return m; }
// 서 있는 것: 판정 폭 w · 높이 h 에 맞춰 한 칸(unit)씩 반복해 채운다
const fitRow = (unit, build) => { const g = g0(); g.userData.fit = (o, w, h) => { const k = Math.max(1, Math.round(w / unit)); for (let i = 0; i < k; i++) { const x = -w / 2 + (i + 0.5) * (w / k); build(o, x, w / k, h, i); } }; return g; };
const fitBar = (build) => { const g = g0(); g.userData.fit = (o, w, h) => build(o, w, h); return g; };

// ---------- 제1장 우주 ----------
const COSMIC_CAST = {
  quark: (r) => { const g = g0(), c = r.pick(['#ff1744', '#00e676', '#2979ff']); Sh(g, glow(c), 0, 0.65, 0, 0.32); Sh(g, glow(c, 0.35), 0, 0.65, 0, 0.55); Sh(g, glow('#ffffff'), 0.1, 0.78, 0.2, 0.08); return anim(g, (q, t) => { q.children[1].scale.setScalar(0.55 * (1 + Math.sin(t * 6) * 0.15)); q.children[0].position.y = 0.65 + Math.abs(Math.sin((q.userData.walk || 0) * 6)) * 0.25; }); },
  photon: (r) => { const g = g0(); Sh(g, glow('#ffffff'), 0, 0.7, 0, 0.22); Sh(g, glow('#fff59d', 0.5), 0, 0.7, 0, 0.45); add(g, G.cone(), glow('#fff59d', 0.55), 0, 0.7, -0.45, 0.2, 0.9, 0.2, -Math.PI / 2); return anim(g, (q, t) => q.children[1].scale.setScalar(0.45 * (1 + Math.sin(t * 9) * 0.2))); },
  energyBall: (r) => { const g = g0(); Oct(g, glow('#ff9100'), 0, 0.7, 0, 0.35, 0.55, 0.35); Sh(g, glow('#fff8e1', 0.45), 0, 0.7, 0, 0.5); return anim(g, (q, t) => { q.children[0].rotation.y = t * 4; }); },
  plasmaBlob: (r) => { const g = g0(), c = r.pick(['#ff9100', '#ff4081', '#7c4dff', '#00e5ff']); for (let i = 0; i < 4; i++) Sh(g, glow(c, 0.75), 0, 0.7, -1.6 + i * 1.05, 0.85 - i * 0.1, 0.65, 0.75); Sh(g, glow('#ffffff', 0.9), 0, 0.75, 1.5, 0.45); return anim(g, (q, t) => q.children.forEach((m, i) => { m.position.y = 0.7 + Math.sin(t * 5 + i) * 0.1; })); },
  cometHead: (r) => { const g = g0(); Sh(g, glow('#e3f2fd'), 0, 1.5, 3.3, 1.2); Rock(g, '#90a4ae', 0, 1.5, 3.3, 1.0); for (let i = 0; i < 6; i++) add(g, G.cone(), glow(i % 2 ? '#80d8ff' : '#ffffff', 0.45), 0, 1.5, 3.3 - 1.2 - i * 1.0, 1.2 - i * 0.16, 1.2, 1.2 - i * 0.16, -Math.PI / 2); return anim(g, (q, t) => { q.children[1].rotation.x = t * 2; }); },
  spark: (r) => { const g = g0(); for (let i = 0; i < 3; i++) Oct(g, glow(i ? '#fff59d' : '#ffffff'), 0, 0.7, 0.6 - i * 0.6, 0.3 - i * 0.07, 0.45 - i * 0.1, 0.3 - i * 0.07); return anim(g, (q, t) => q.children.forEach((m, i) => { m.rotation.y = t * 6 + i; })); },
  energyWall: () => fitRow(1.4, (o, x, w, h) => { add(o, G.box(), glow('#ff4081', 0.55), x, h / 2, 0, w - 0.1, h, 0.3); add(o, G.box(), glow('#ffffff', 0.9), x, h, 0, w - 0.1, 0.08, 0.35); add(o, G.box(), glow('#ffffff', 0.9), x, 0.04, 0, w - 0.1, 0.08, 0.35); for (const sx of [-1, 1]) add(o, G.box(), glow('#ffd740'), x + sx * (w / 2 - 0.08), h / 2, 0, 0.1, h, 0.4); }),
  plasmaRidge: () => fitRow(1.0, (o, x, w, h) => { add(o, G.sphereLow(), glow('#ff9100', 0.85), x, h * 0.4, 0, w * 0.55, h * 0.7, 0.35); add(o, G.sphereLow(), glow('#fff8e1', 0.9), x, h * 0.55, 0, w * 0.25, h * 0.35, 0.2); }),
  lightBeam: () => fitBar((o, w, h) => { add(o, G.box(), glow('#ffffff', 0.95), 0, h / 2, 0, w, h * 0.4, 0.35); add(o, G.box(), glow('#ffd740', 0.45), 0, h / 2, 0, w, h * 0.95, 0.5); for (const sx of [-1, 1]) { add(o, G.sphereLow(), glow('#ffffff'), sx * w / 2, h / 2, 0, 0.45); add(o, G.box(), glow('#ffd740', 0.5), sx * w / 2, -0.5 + h / 4, 0, 0.12, h + 1, 0.12); } }),
  quantumBubble: (r) => { const g = g0(); add(g, G.sphere(), new THREE.MeshToonMaterial({ color: r.pick(['#ff6fd8', '#7c4dff', '#00e5ff']), transparent: true, opacity: 0.55 }), 0, 0.62, 0, 0.42, 0.55, 0.42); Sh(g, glow('#ffffff'), -0.12, 0.85, 0.3, 0.08); return anim(g, (q, t) => q.children[0].scale.set(0.42 * (1 + Math.sin(t * 5) * 0.1), 0.55 * (1 - Math.sin(t * 5) * 0.08), 0.42)); },
  bubbleCluster: (r) => { const g = g0(); for (let i = 0; i < 5; i++) add(g, G.sphere(), new THREE.MeshToonMaterial({ color: ['#ff6fd8', '#7c4dff', '#00e5ff'][i % 3], transparent: true, opacity: 0.6 }), (i % 2 ? 0.4 : -0.4), 0.7, -1.8 + i * 0.9, 0.55, 0.65, 0.55); return anim(g, (q, t) => q.children.forEach((m, i) => { m.position.y = 0.7 + Math.sin(t * 4 + i) * 0.12; })); },
  quarkTrio: (r) => { const g = g0(), cols = ['#ff1744', '#00e676', '#2979ff'], w = g0(); w.position.y = 0.65; g.add(w); cols.forEach((c, i) => { const a = (i / 3) * Math.PI * 2; Sh(w, glow(c), Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0, 0.17); }); Sh(w, glow('#ffd740', 0.45), 0, 0, 0, 0.42); return anim(g, (q, t) => { w.rotation.z = t * 5; }); },
  gluonBall: (r) => { const g = g0(); for (let i = 0; i < 5; i++) Sh(g, glow(['#ffd740', '#ff1744', '#00e676', '#2979ff', '#ffd740'][i], 0.85), Math.sin(i) * 0.4, 0.75, -1.8 + i * 0.9, 0.6, 0.6, 0.6); return anim(g, (q, t) => q.children.forEach((m, i) => { m.position.x = Math.sin(t * 4 + i) * 0.45; })); },
  proton: (r) => { const g = g0(); Sh(g, '#ff5252', 0, 0.62, 0, 0.42); Sh(g, glow('#ffffff', 0.6), 0, 0.62, 0, 0.12); add(g, G.box(), glow('#ffffff'), 0, 0.62, 0.42, 0.2, 0.05, 0.02); add(g, G.box(), glow('#ffffff'), 0, 0.62, 0.42, 0.05, 0.2, 0.02); return anim(g, (q, t) => { q.children[0].position.y = 0.62 + Math.abs(Math.sin((q.userData.walk || 0) * 6)) * 0.15; }); },
  neutron: (r) => { const g = g0(); Sh(g, '#90caf9', 0, 0.62, 0, 0.42); Sh(g, '#64b5f6', 0.12, 0.72, 0.3, 0.12); return anim(g, (q, t) => { q.children[0].position.y = 0.62 + Math.abs(Math.sin((q.userData.walk || 0) * 6)) * 0.15; }); },
  heliumNucleus: (r) => { const g = g0(), w = g0(); w.position.set(0, 0.75, 0); g.add(w); for (let i = 0; i < 4; i++) { const a = i * 1.57; Sh(w, i % 2 ? '#90caf9' : '#ff5252', Math.cos(a) * 0.45, (i % 2 ? 0.2 : -0.2), Math.sin(a) * 1.4, 0.6); } Sh(w, glow('#ffd740', 0.25), 0, 0, 0, 1.2, 0.9, 2.4); return anim(g, (q, t) => { w.rotation.z = t * 1.5; }); },
  electron: (r) => { const g = g0(); Sh(g, glow('#80d8ff'), 0, 0.7, 0, 0.2); Sh(g, glow('#80d8ff', 0.3), 0, 0.7, 0, 0.45); T(g, glow('#ffffff', 0.6), 0, 0.7, 0, 0.4, 0.02, Math.PI / 2); return anim(g, (q, t) => { q.children[2].rotation.z = t * 6; }); },
  hAtom: (r) => { const g = g0(), core = Sh(g, '#ff5252', 0, 0.75, 0, 0.45), ring = g0(); ring.position.y = 0.75; g.add(ring); T(ring, glow('#ffffff', 0.55), 0, 0, 0, 0.85, 0.03, Math.PI / 2); for (let i = 0; i < 3; i++) Sh(ring, glow('#80d8ff'), 0, 0, 0, 0.15); void core; return anim(g, (q, t) => { ring.children.slice(1).forEach((e, i) => { const a = t * 4 + i * 2.1; e.position.set(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85 * 2.4); }); ring.children[0].scale.set(1, 2.6, 1); }); },
  heAtomBig: (r) => { const g = g0(), core = g0(); core.position.y = 1.5; g.add(core); for (let i = 0; i < 4; i++) Sh(core, i % 2 ? '#90caf9' : '#ff5252', Math.cos(i * 1.57) * 0.5, Math.sin(i * 1.57) * 0.5, 0, 0.6); const es = [0, 1].map(() => Sh(g, glow('#80d8ff'), 0, 1.5, 0, 0.25)); T(g, glow('#ffffff', 0.4), 0, 1.5, 0, 1.2, 0.04, Math.PI / 2).scale.set(1, 3.6, 1); return anim(g, (q, t) => { core.rotation.z = t; es.forEach((e, i) => { const a = t * 3 + i * Math.PI; e.position.set(Math.cos(a) * 1.2, 1.5, Math.sin(a) * 4.2); }); }); },
  darkWisp: (r) => { const g = g0(); for (let i = 0; i < 4; i++) Sh(g, glow(i ? '#311b92' : '#8c9eff', 0.6 - i * 0.1), 0, 0.7, -i * 0.25, 0.35 - i * 0.05); return anim(g, (q, t) => q.children.forEach((m, i) => { m.position.x = Math.sin(t * 3 - i * 0.6) * 0.15; })); },
  hCloud: (r) => { const g = g0(); for (let i = 0; i < 5; i++) add(g, G.sphere(), new THREE.MeshToonMaterial({ color: '#3949ab', transparent: true, opacity: 0.7 }), (i % 2 ? 0.35 : -0.35), 0.75, -1.8 + i * 0.9, 0.75, 0.6, 0.7); Sh(g, glow('#8c9eff'), 0, 0.8, 1.6, 0.25); return g; },
  starlet: (r) => { const g = g0(), c = r.pick(['#ffffff', '#bbdefb', '#fff59d']); Sh(g, glow(c), 0, 0.7, 0, 0.25); for (let i = 0; i < 4; i++) add(g, G.box(), glow(c, 0.8), 0, 0.7, 0, 0.05, 0.95, 0.05, 0, 0, i * Math.PI / 4); return anim(g, (q, t) => { q.rotation.y = t * 2; }); },
  elementShard: (r) => { const g = g0(), c = r.pick(['#ffd740', '#b0bec5', '#e040fb', '#ff6d00']); add(g, G.cone(), glow(c), 0, 0.85, 0, 0.25, 0.5, 0.25); add(g, G.cone(), glow(c), 0, 0.4, 0, 0.25, 0.5, 0.25, Math.PI); return anim(g, (q, t) => { q.rotation.y = t * 3; }); },
  shockBlob: (r) => { const g = g0(); for (let i = 0; i < 3; i++) T(g, glow(['#ff6d00', '#ffd740', '#e040fb'][i], 0.85), 0, 0.75, 1.5 - i * 1.5, 0.75, 0.18); Sh(g, glow('#ffffff'), 0, 0.75, 1.8, 0.3); return anim(g, (q, t) => q.children.slice(0, 3).forEach((m, i) => { m.scale.setScalar(1 + Math.sin(t * 6 + i) * 0.15); })); },
  moleculeS: (r) => { const g = g0(); Sh(g, '#ff8a80', 0, 0.75, 0, 0.3); Sh(g, '#82b1ff', 0, 0.75, -0.0, 0.22).position.set(0, 0.42, 0); add(g, G.cylLow(), glow('#ffffff'), 0, 0.58, 0, 0.04, 0.3, 0.04); return anim(g, (q, t) => { q.rotation.y = t * 3; }); },
  moleculeBig: (r) => { const g = g0(); Sh(g, '#ff8a80', 0, 0.75, 1.2, 0.7); Sh(g, '#82b1ff', 0, 0.75, -1.2, 0.55); add(g, G.cylLow(), glow('#ffffff'), 0, 0.75, 0, 0.12, 1.6, 0.12, Math.PI / 2); Sh(g, glow('#a7ffeb', 0.25), 0, 0.75, 0, 0.9, 0.7, 2.3); return anim(g, (q, t) => { q.children[3].scale.x = 0.9 * (1 + Math.sin(t * 4) * 0.1); }); },
  starCluster: (r) => { const g = g0(); for (let i = 0; i < 14; i++) Sh(g, glow(r.pick(['#fff3c4', '#bbdefb', '#ffffff'])), r.range(-0.8, 0.8), r.range(0.3, 1.3), r.range(-2.2, 2.2), r.range(0.1, 0.2)); Sh(g, glow('#b388ff', 0.25), 0, 0.75, 0, 0.9, 0.7, 2.4); return anim(g, (q, t) => { q.children[14].scale.x = 0.9 * (1 + Math.sin(t * 3) * 0.1); }); },
  globular: (r) => COSMIC_CAST.starCluster(r),
  dustBall: (r) => { const g = g0(); Rock(g, '#8d6e63', 0, 0.62, 0, 0.42, 0.4, 0.42); return anim(g, (q, t) => { q.children[0].rotation.x = (q.userData.walk || t) * 5; }); },
  protostarBall: (r) => { const g = g0(); Sh(g, glow('#fff3c4'), 0, 0.75, 0, 0.55); Sh(g, glow('#ff7043', 0.45), 0, 0.75, 0, 0.75, 0.7, 1.6); T(g, glow('#4db6ac', 0.7), 0, 0.75, 0, 0.9, 0.06, Math.PI / 2).scale.set(1, 2.4, 1); return anim(g, (q, t) => { q.children[2].rotation.z = t * 2; }); },
  flareBall: (r) => { const g = g0(); Sh(g, glow('#ffd740'), 0, 0.65, 0, 0.32); flame(g, 0, 0.3, 0, 0.6); return liven(g); },
  pebbleRoll: (r) => { const g = g0(); Rock(g, '#8d6e63', 0, 0.55, 0, 0.42, 0.5, 0.42); return anim(g, (q, t) => { q.children[0].rotation.x = (q.userData.walk || t) * 6; }); },
  asteroidRoll: (r) => { const g = g0(); Rock(g, '#6d4c41', 0, 0.72, 0, 0.9, 0.72, 2.3); Rock(g, '#5d4037', 0.3, 1.1, 1.2, 0.4); for (let i = 0; i < 3; i++) S(g, '#3e2723', r.range(-0.5, 0.5), 1.35, r.range(-1.5, 1.5), 0.25, 0.06, 0.25); return anim(g, (q, t) => { q.rotation.z = Math.sin(t * 2) * 0.1; }); },
  planetesimal: (r) => { const g = g0(); Rock(g, '#5d4037', 0, 1.5, 0, 1.25, 1.5, 4.4); for (let i = 0; i < 5; i++) S(g, glow('#ff7043', 0.8), r.range(-1, 1), r.range(0.6, 2.6), r.range(-4, 4), 0.25); return anim(g, (q, t) => { q.children[0].rotation.z = Math.sin(t) * 0.05; }); },
  rockWall: () => fitRow(1.3, (o, x, w, h, i) => { Rock(o, ['#5d4037', '#6d4c41', '#795548'][i % 3], x, h / 2, 0, w * 0.55, h / 2, 0.5, i); }),
  rockRow: () => fitRow(0.9, (o, x, w, h, i) => { Rock(o, ['#6d4c41', '#8d6e63'][i % 2], x, h * 0.45, 0, w * 0.45, h * 0.5, 0.35, i * 2); }),
  rockArchBar: () => fitBar((o, w, h) => { for (let i = 0; i < Math.round(w / 1.2); i++) Rock(o, ['#5d4037', '#6d4c41'][i % 2], -w / 2 + 0.6 + i * 1.2, h / 2, 0, 0.7, h / 2, 0.35, i); for (const sx of [-1, 1]) Rock(o, '#4e342e', sx * w / 2, -0.5 + (h + 1) / 2 - 0.5, 0, 0.5, (h + 1) / 2, 0.5); }),
};

const ALL = { ...COSMIC_CAST, ...CAST_PEOPLE };
// 빛 웅덩이 크기 (역할 크기 대충): 서 있는 것은 fit 에서 폭에 맞춘다
export function makeTimeMover(kind, n) {
  const f = ALL[kind]; if (!f) return null;
  const g = f(rnd(n + 11)); if (!g) return null;
  g.userData.keepGeo = true;
  if (g.userData.fit) { const fit = g.userData.fit; g.userData.fit = (o, w, h) => { fit(o, w, h); halo(o, w + 2, 2.6, 0.03 - o.position.y); }; }
  else halo(g, 2.4, 3.2);
  return g;
}
export const TIME_CAST_KINDS = Object.keys(ALL);
void K; void B; void C; void COSMOS;
