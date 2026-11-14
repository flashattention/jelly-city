// 랜덤 이공간: 30가지 이공간. 모두 일자(높이 그대로) 길이지만 꿈나라보다 훨씬 빽빽하다
//   R: 그 맵의 물리 규칙 (runner 가 track.mod 로 읽는다) — grav 중력 배 · jump 점프 배 · jumps 점프 횟수 · ice 미끄러움 · inv 좌우 반대
//      speed 빠르기 배 · ramp 맵 안에서 점점 빨라짐 · bounce 저절로 통통 · wind [세기, 주기] 옆바람 · pull 한쪽으로 끌림 · gpulse [가벼움, 무거움, 주기] 중력 맥박
//      dark 가까이 와야 길이 보임 · crumble 밟고 이 초 뒤 무너짐 · flip 분홍 발판 위에서는 좌우 반대
//   pats: 그 맵에서 나오는 길 무늬와 무게 (track.js 의 vp_*)
import * as THREE from 'three';
import { toon, G, geo } from '../../shared/js/utils.js';
import { KITS, glow } from './kits.js';

const v = (name, emoji, R, pats, o) => ({ name, emoji, R, pats, void: true, fog: [16, 220], stars: 1, light: 0.75, fx: 'sparkles', under: 'void', style: 'plain', ...o });
const m = (scale, root, bpm, wave) => [scale, root, bpm, wave];

export const VOIDS = [
  v('암흑물질', '🌑', { dark: 1 }, [['gaps', 3], ['stones', 2], ['obst', 2], ['zig', 1]], { sky: ['#000000', '#0a0418', '#000000'], plat: ['#1a1030', '#07040e'], style: 'glass', edge: '#9d7bff', fx: 'dust', fxC: '#6a4cff', fog: [8, 110], stars: 0.15, light: 0.4, kits: ['blackHole', 'asteroid', 'lightOrb'], P: { a: '#9d7bff', b: '#2a1a5a', rock: '#1c1430' }, mus: m('dim', 36, 96, 'sine') }),
  v('매트릭스', '💊', { speed: 0.8 }, [['dense', 4], ['lanes', 3], ['zig', 1]], { sky: ['#000400', '#001a08', '#000200'], plat: ['#021a0a', '#000a03'], style: 'grid', edge: '#00ff66', under: 'neon', underC: '#00ff66', fx: 'code', fxC: '#00ff66', fog: [12, 170], stars: 0, kits: ['codeCol', 'gridPillar'], P: { a: '#00ff66', b: '#00a844', g: '#00ff66' }, mus: m('phryg', 40, 132, 'square') }),
  v('거울의 방', '🪞', { inv: 1 }, [['slalom', 3], ['zig', 2], ['gaps', 1], ['obst', 1]], { sky: ['#0c0c14', '#3a3d55', '#06060a'], plat: ['#c9cfe8', '#6e7392'], style: 'glass', edge: '#ffffff', fx: 'sparkles', fxC: '#e8eeff', kits: ['mirror', 'prismShard', 'mirror'], P: { a: '#ffffff', b: '#b6c4ff', wall: '#2a2c3c' }, mus: m('whole', 48, 104, 'triangle') }),
  v('화이트룸', '⬜', {}, [['narrow', 3], ['obst', 2], ['gaps', 1]], { sky: ['#ffffff', '#f2f2f6', '#e6e6ee'], plat: ['#f7f7fa', '#dcdce4'], style: 'tile', edge: '#d0d0dc', fx: 'dust', fxC: '#c8c8d8', fog: [20, 260], stars: 0, light: 1.15, kits: ['whiteCube', 'whiteCube', 'monolith'], P: { a: '#e0e0ea', b: '#ffffff', c: '#cfd0dc' }, mus: m('lydian', 52, 88, 'sine') }),
  v('섬광', '⚡', {}, [['blink', 4], ['obst', 1]], { sky: ['#05050f', '#2a2a6a', '#000004'], plat: ['#fff8c8', '#b8a84a'], style: 'grid', edge: '#ffee58', fx: 'sparkles', fxC: '#fff59d', lightning: true, kits: ['comet', 'lightOrb', 'starShape'], P: { a: '#ffee58', b: '#ffffff', c: '#7de2ff' }, mus: m('dorian', 45, 150, 'sawtooth') }),
  v('우주 무지개 길', '🌈', {}, [['narrow', 5], ['gaps', 1]], { sky: ['#02010c', '#1a0b46', '#000000'], plat: ['#ff7aa8', '#7c4dff'], style: 'rainbow', edge: '#ffffff', fx: 'sparkles', fxC: '#ffffff', kits: ['planet', 'galaxy', 'starShape'], P: { a: '#ff7aa8', b: '#7de2ff', c: '#ffee58' }, mus: m('major', 50, 128, 'triangle') }),
  v('토성 고리', '🪐', {}, [['stones', 5], ['dgaps', 1]], { sky: ['#03020a', '#2a1e10', '#000000'], plat: ['#b89a72', '#5a4630'], style: 'noise', edge: '#ffe0a8', fx: 'dust', fxC: '#ffe0a8', kits: ['ringPlanet', 'asteroid', 'asteroid'], P: { a: '#e8c89a', b: '#c99a5a', rock: '#8a7458' }, mus: m('dorian', 41, 92, 'sine') }),
  v('모든 게 시작된 곳', '💥', { grav: 0.85 }, [['breathe', 4], ['gaps', 1]], { sky: ['#fff4d6', '#ff7a3d', '#2a0010'], plat: ['#fff0c8', '#ff9a4d'], style: 'swirl', edge: '#ffffff', fx: 'rise', fxC: '#ffe8a8', stars: 0.4, light: 1.1, kits: ['galaxy', 'lightOrb', 'comet'], P: { a: '#ffd166', b: '#ff5a3d', c: '#ffffff' }, mus: m('lydian', 46, 112, 'sawtooth') }),
  v('빛과 어둠', '☯️', {}, [['yinyang', 5], ['obst', 1]], { sky: ['#000000', '#5a5a64', '#ffffff'], plat: ['#f4f4f8', '#16161c'], style: 'check', edge: '#ffd54f', fx: 'sparkles', fxC: '#ffffff', stars: 0.5, kits: ['whiteCube', 'monolith', 'lightOrb'], P: { a: '#ffffff', b: '#101014', c: '#ffd54f' }, mus: m('minor', 43, 100, 'triangle') }),
  v('블랙홀', '🕳️', { pull: 3.2 }, [['gaps', 2], ['narrow', 2], ['obst', 2]], { sky: ['#000000', '#2a0a3a', '#000000'], plat: ['#2a1a40', '#0e0818'], style: 'glass', edge: '#ff8a3d', fx: 'rise', fxC: '#ff8a3d', kits: ['blackHole', 'asteroid', 'comet'], P: { a: '#ff8a3d', b: '#7c4dff', rock: '#2a2034' }, mus: m('phryg', 36, 84, 'sawtooth') }),
  v('웜홀', '🌀', {}, [['pads', 4], ['gaps', 1]], { sky: ['#000014', '#0a3a7a', '#000006'], plat: ['#1a3a6a', '#081a33'], style: 'hex', edge: '#46e0ff', under: 'neon', underC: '#2a6aff', fx: 'rise', fxC: '#7de2ff', kits: ['galaxy', 'portalFar', 'ring'], P: { a: '#46e0ff', b: '#a78bff', c: '#ffffff' }, mus: m('whole', 44, 120, 'triangle') }),
  v('양자 터널', '🔀', {}, [['quantum', 4], ['gaps', 1]], { sky: ['#06000e', '#3a0a5a', '#000000'], plat: ['#3a1a5a', '#14081f'], style: 'grid', edge: '#ff5cf0', fx: 'sparkles', fxC: '#ff5cf0', kits: ['prismShard', 'geoShape', 'lightOrb'], P: { a: '#ff5cf0', b: '#5cf0ff', c: '#ffffff' }, mus: m('whole', 47, 140, 'square') }),
  v('중성자별', '⚫', { grav: 1.7, jump: 1.12 }, [['obst', 3], ['gaps', 2]], { sky: ['#000000', '#14203a', '#000000'], plat: ['#3a4a66', '#141c2a'], style: 'tile', edge: '#9fd8ff', fx: 'rise', fxC: '#9fd8ff', stars: 0.8, kits: ['planet', 'satellite', 'monolith'], P: { a: '#9fd8ff', b: '#ffffff', c: '#5a7aaa' }, mus: m('minor', 34, 108, 'square') }),
  v('성운 폭풍', '🌫️', { wind: [5, 18] }, [['narrow', 3], ['zig', 2], ['gaps', 1]], { sky: ['#0a0418', '#6a2a8a', '#04020a'], plat: ['#c08ad8', '#5a3a7a'], style: 'cloud', edge: '#ffd0ff', fx: 'dust', fxC: '#ffb8ff', fog: [10, 150], kits: ['nebula', 'starShape', 'lightOrb'], P: { a: '#ff9ae0', b: '#9ab8ff', c: '#ffffff' }, mus: m('dorian', 42, 96, 'sine') }),
  v('은하 소용돌이', '🌌', {}, [['movers', 4], ['zig', 1]], { sky: ['#02010a', '#1a1a5a', '#000000'], plat: ['#2a2a7a', '#0e0e33'], style: 'swirl', edge: '#ffe066', fx: 'sparkles', fxC: '#fff3b0', kits: ['galaxy', 'galaxy', 'starShape'], P: { a: '#ffe066', b: '#7de2ff', c: '#ff9ae0' }, mus: m('lydian', 45, 116, 'triangle') }),
  v('퀘이사 빔', '🔦', {}, [['lasers', 4], ['obst', 1]], { sky: ['#000008', '#0a1a4a', '#000000'], plat: ['#1a2448', '#080c1e'], style: 'grid', edge: '#ff3b6a', fx: 'sparkles', fxC: '#ff8ab0', kits: ['comet', 'blackHole', 'satellite'], P: { a: '#ff3b6a', b: '#46e0ff', c: '#ffffff' }, mus: m('phryg', 43, 138, 'sawtooth') }),
  v('소행성대', '☄️', {}, [['asteroids', 4], ['gaps', 1]], { sky: ['#030204', '#2a2018', '#000000'], plat: ['#5a4a3a', '#241c14'], style: 'noise', edge: '#ffb86b', fx: 'dust', fxC: '#d8b890', kits: ['asteroid', 'asteroid', 'planet'], P: { a: '#ffb86b', b: '#8a7458', rock: '#6a5a4a' }, mus: m('minor', 39, 118, 'square') }),
  v('초신성', '🌟', { crumble: 0.42 }, [['crumble', 4], ['gaps', 1]], { sky: ['#0a0000', '#8a2a00', '#000000'], plat: ['#ffcf7a', '#c45a1a'], style: 'stained', edge: '#fff3b0', fx: 'embers', fxC: '#ffd166', light: 1, kits: ['comet', 'lightOrb', 'starShape'], P: { a: '#ffd166', b: '#ff5a1f', c: '#ffffff' }, mus: m('minor', 44, 144, 'sawtooth') }),
  v('시간의 끝', '⏳', { speed: 1.25 }, [['obst', 2], ['gaps', 2], ['slalom', 1]], { sky: ['#0a0806', '#4a3a20', '#000000'], plat: ['#c8b080', '#5a4a2a'], style: 'tile', edge: '#ffe8b0', fx: 'dust', fxC: '#ffe8b0', kits: ['clock', 'monolith', 'hellClock'], P: { a: '#ffe8b0', b: '#c89a4a', g: '#ffe8b0', body: '#2a2010', arm: '#3a2a14' }, mus: m('whole', 41, 160, 'triangle') }),
  v('디지털 그리드', '🟦', {}, [['lanes', 5]], { sky: ['#000010', '#00184a', '#000004'], plat: ['#001a3a', '#000a1a'], style: 'grid', edge: '#00f5ff', under: 'neon', underC: '#00f5ff', fx: 'code', fxC: '#00f5ff', stars: 0.3, kits: ['gridPillar', 'codeCol', 'geoShape'], P: { a: '#00f5ff', b: '#ff2bd6', c: '#ffffff' }, mus: m('dorian', 45, 152, 'sawtooth') }),
  v('크리스탈 차원', '💎', { ice: 2.4 }, [['slalom', 3], ['zig', 2], ['gaps', 1]], { sky: ['#020a1a', '#1a5a8a', '#01040c'], plat: ['#bff4ff', '#4a9ac0'], style: 'glass', edge: '#ffffff', under: 'ice', underC: '#0d3350', fx: 'snow', fxC: '#e0fbff', kits: ['crystal', 'prismShard', 'crystal'], P: { a: '#bff4ff', b: '#ffffff', c: '#9a8aff' }, mus: m('lydian', 50, 100, 'triangle') }),
  v('무중력 정거장', '🛰️', { grav: 0.72, jumps: 3 }, [['dgaps', 4], ['stones', 1]], { sky: ['#000004', '#0a1a2a', '#000000'], plat: ['#b0bec5', '#455a64'], style: 'hex', edge: '#7de2ff', fx: 'rise', fxC: '#cfe8ff', kits: ['satellite', 'planet', 'ufo'], P: { a: '#7de2ff', b: '#cfd8dc', c: '#ffcc80' }, mus: m('pent', 47, 90, 'sine') }),
  v('프리즘 다리', '🔺', {}, [['beams', 4], ['gaps', 1]], { sky: ['#04020a', '#2a1a4a', '#000000'], plat: ['#ffffff', '#b8a8ff'], style: 'rainbow', edge: '#ffffff', fx: 'sparkles', fxC: '#ffffff', kits: ['prismShard', 'prismShard', 'galaxy'], P: { a: '#ff7aa8', b: '#7de2ff', c: '#c6ff3d' }, mus: m('lydian', 49, 124, 'triangle') }),
  v('이벤트 호라이즌', '🌒', { ramp: 0.4 }, [['obst', 2], ['gaps', 2], ['zig', 1]], { sky: ['#000000', '#3a1a00', '#000000'], plat: ['#3a2a1a', '#140c06'], style: 'glass', edge: '#ffb300', fx: 'rise', fxC: '#ffb300', kits: ['blackHole', 'comet', 'asteroid'], P: { a: '#ffb300', b: '#ff5a1f', rock: '#2a2018' }, mus: m('phryg', 38, 120, 'sawtooth') }),
  v('최후의 날', '🔥', {}, [['meteor', 5]], { sky: ['#1a0200', '#8a1a00', '#0a0000'], plat: ['#4a3a30', '#1c1410'], style: 'noise', edge: '#ff7a1f', under: 'lava', fx: 'meteors', fxC: '#ffb86b', stars: 0.3, light: 0.85, kits: ['comet', 'comet', 'asteroid'], P: { a: '#ff7a1f', b: '#ffd166', rock: '#3a2a20' }, mus: m('minor', 38, 136, 'sawtooth') }),
  v('차원의 틈', '🕸️', { jumps: 1 }, [['gaps', 3], ['obst', 2]], { sky: ['#04000a', '#2a003a', '#000000'], plat: ['#2a1a3a', '#0e0814'], style: 'hex', edge: '#c6ff3d', fx: 'static', fxC: '#c6ff3d', kits: ['portalFar', 'prismShard', 'geoShape'], P: { a: '#c6ff3d', b: '#ff2bd6', c: '#ffffff' }, mus: m('dim', 40, 112, 'square') }),
  v('오로라 트램펄린', '🎆', { bounce: 0.85 }, [['obst', 3], ['gaps', 2]], { sky: ['#000a10', '#0a4a4a', '#000004'], plat: ['#3dffd0', '#1a6a8a'], style: 'stripe', edge: '#ffffff', fx: 'sparkles', fxC: '#a8ffe8', kits: ['nebula', 'starShape', 'moonSmall'], P: { a: '#3dffd0', b: '#ff9ae0', c: '#ffffff' }, mus: m('major', 48, 126, 'triangle') }),
  v('펄서', '💫', { gpulse: [0.55, 1.45, 2.6] }, [['gaps', 2], ['obst', 2]], { sky: ['#000008', '#1a0a4a', '#000000'], plat: ['#4a3aaa', '#18104a'], style: 'grid', edge: '#7de2ff', fx: 'sparkles', fxC: '#b8f0ff', kits: ['lightOrb', 'galaxy', 'satellite'], P: { a: '#7de2ff', b: '#ff5cf0', c: '#ffffff' }, mus: m('whole', 45, 138, 'sine') }),
  v('고요의 바다', '🌕', { grav: 0.55 }, [['dgaps', 2], ['gaps', 2], ['obst', 1]], { sky: ['#000000', '#1a1a24', '#000000'], plat: ['#c8c8cc', '#6a6a70'], style: 'noise', edge: '#ffffff', fx: 'dust', fxC: '#e0e0e8', light: 0.95, kits: ['moonSmall', 'planet', 'asteroid'], P: { a: '#d8d8e0', b: '#9ab8ff', rock: '#8a8a90' }, mus: m('pent', 43, 80, 'sine') }),
  v('끝없는 반전', '♾️', { flip: 1 }, [['flipzone', 4]], { sky: ['#0a000a', '#4a0a4a', '#000000'], plat: ['#3a2a4a', '#140c1a'], style: 'check', edge: '#7de2ff', fx: 'sparkles', fxC: '#ff5cf0', kits: ['mirror', 'geoShape', 'portalFar'], P: { a: '#ff2bd6', b: '#7de2ff', wall: '#1a1020' }, mus: m('whole', 46, 118, 'square') }),
];

// ---------- 이공간 풍경 ----------
const M = (c) => (typeof c === 'object' ? c : toon(c));
function add(p, g, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(g, M(mat)); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); p.add(o); return o; }
const grp = () => new THREE.Group();
const torus = (r, t) => geo(`vt${r}_${t}`, () => new THREE.TorusGeometry(r, t, 8, 48));
const oct = () => geo('vOct', () => new THREE.OctahedronGeometry(1, 0));

Object.assign(KITS, {
  // 고리가 있는 큰 행성
  ringPlanet: { place: 'sky', every: 140, build(r, P) { const g = grp(), R = r.range(9, 16); add(g, G.sphere(), P.a || '#e8c89a', 0, 0, 0, R, R, R); add(g, torus(R * 1.7, R * 0.12), glow(P.b || '#c99a5a', 0.75), 0, 0, 0, 1, 1, 0.25, 1.2, 0, 0.3); add(g, torus(R * 2.05, R * 0.06), glow(P.a || '#e8c89a', 0.5), 0, 0, 0, 1, 1, 0.25, 1.2, 0, 0.3); return g; } },
  // 빙글 도는 은하: 빛나는 점들이 나선으로
  galaxy: { place: 'sky', every: 90, build(r, P) { const g = grp(), cs = [P.a, P.b, P.c].filter(Boolean); for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 16; i++) { const a = arm * 2.09 + i * 0.32, d = 1 + i * 0.9; add(g, G.sphereLow(), glow(cs[(arm + i) % cs.length] || '#ffffff', 0.85), Math.cos(a) * d, Math.sin(a) * d, 0, 0.5 - i * 0.02, 0.5 - i * 0.02, 0.5 - i * 0.02); } add(g, G.sphereLow(), glow('#ffffff'), 0, 0, 0, 1.6, 1.6, 1.6); g.userData.anim = (o, t) => { o.rotation.z = t * 0.15; }; return g; } },
  // 블랙홀: 검은 구 + 빛나는 원반
  blackHole: { place: 'sky', every: 160, build(r, P) { const g = grp(), R = r.range(6, 10); add(g, G.sphere(), '#000000', 0, 0, 0, R, R, R); add(g, torus(R * 1.6, R * 0.35), glow(P.a || '#ff8a3d', 0.85), 0, 0, 0, 1, 1, 0.2, 1.35, 0, 0); add(g, torus(R * 1.1, R * 0.08), glow('#ffffff', 0.9), 0, 0, 0, 1, 1, 1); g.userData.anim = (o, t) => { o.children[1].rotation.z = t * 0.6; }; return g; } },
  // 초록 숫자 기둥
  codeCol: { place: 'side', every: 5, build(r, P) { const g = grp(), h = r.range(4, 12), c = P.a || '#00ff66'; for (let i = 0; i < h; i++) add(g, G.box(), glow(c, 0.25 + (i / h) * 0.7), 0, i * 1.05 + 0.5, 0, 0.5, 0.8, 0.1); g.userData.anim = (o, t) => { o.position.y = o.userData.y0 + ((t * 3 + o.id) % 2) - 1; }; return g; } },
  // 하얀 방의 떠 있는 상자
  whiteCube: { place: 'side', every: 6, build(r, P) { const g = grp(), s = r.range(0.8, 2.4); add(g, G.box(), r.pick([P.a, P.b, P.c].filter(Boolean)) || '#ffffff', 0, s / 2 + r.range(0, 2), 0, s, s, s, r.range(0, 1), r.range(0, 1), 0); return g; } },
  // 빛 조각 (프리즘)
  prismShard: { place: 'side', every: 6, build(r, P) { const g = grp(), cs = [P.a, P.b, P.c].filter(Boolean); for (let i = 0; i < 3; i++) { const h = r.range(1, 3.4); add(g, oct(), glow(cs[i % cs.length] || '#ffffff', 0.75), r.range(-0.8, 0.8), h, r.range(-0.8, 0.8), 0.4, h * 0.6, 0.4, 0, r.range(0, 3), 0); } g.userData.anim = (o, t) => { o.rotation.y = t * 0.8 + o.id; }; return g; } },
  // 꼬리 달린 혜성
  comet: { place: 'sky', every: 40, build(r, P) { const g = grp(); add(g, G.sphereLow(), glow('#ffffff'), 0, 0, 0, 1.2, 1.2, 1.2); for (let i = 1; i <= 8; i++) add(g, G.sphereLow(), glow(P.a || '#ffd166', 0.8 - i * 0.08), i * 1.1, i * 0.5, 0, 1.1 - i * 0.1, 1.1 - i * 0.1, 1.1 - i * 0.1); g.rotation.z = r.range(-0.4, 0.4); return g; } },
  // 성운: 옅은 빛 덩어리
  nebula: { place: 'sky', every: 50, build(r, P) { const g = grp(), cs = [P.a, P.b, P.c].filter(Boolean); for (let i = 0; i < 6; i++) { const s = r.range(4, 9); add(g, G.sphereLow(), glow(cs[i % cs.length] || '#ff9ae0', 0.18), r.range(-8, 8), r.range(-4, 4), r.range(-3, 3), s, s * 0.7, s); } return g; } },
});

// 맵에 들어갈 때 카드에 보이는 한 줄 규칙
const TIPS = {
  '암흑물질': '가까이 가야 길이 보여요', '매트릭스': '느려진 대신 장애물이 빽빽해요', '거울의 방': '좌우가 반대예요!', '화이트룸': '하얀 장애물을 놓치지 마세요',
  '섬광': '발판이 깜빡이면 곧 꺼져요 · 뛰어넘기', '우주 무지개 길': '난간 없는 좁은 길', '토성 고리': '띄엄띄엄 운석 · 2단 점프로 멀리', '모든 게 시작된 곳': '발판이 넓어졌다 좁아져요',
  '빛과 어둠': '두 길이 번갈아 사라져요 · 옮겨 타기', '블랙홀': '한쪽으로 점점 세게 끌려가요', '웜홀': '초록 발사대를 밟으면 날아올라요 · 미리 뛰면 안 돼요', '양자 터널': '발판이 깜빡이면 옆으로 순간 이동',
  '중성자별': '중력이 무거워 점프가 낮아요', '성운 폭풍': '옆바람이 불어요', '은하 소용돌이': '흔들리는 발판을 건너요', '퀘이사 빔': '빛줄기가 오르내려요 · 낮으면 점프, 높으면 숙이기',
  '소행성대': '운석이 길을 가로질러요', '초신성': '밟으면 무너져요 · 계속 뛰기', '시간의 끝': '시간이 빨리 흘러요', '디지털 그리드': '세 줄 길 · 열린 줄로 옮겨 타기',
  '크리스탈 차원': '미끄러워요 · 미리 움직이기', '무중력 정거장': '3단 점프!', '프리즘 다리': '아주 좁은 빛 다리를 옮겨 타요', '이벤트 호라이즌': '갈수록 빨라져요',
  '최후의 날': '점선 자리에 운석이 떨어져요', '차원의 틈': '2단 점프가 안 돼요', '오로라 트램펄린': '저절로 통통 · 숙이기를 누르고 있으면 멈춰요', '펄서': '중력이 맥박처럼 바뀌어요',
  '고요의 바다': '중력이 약해 높이 날아요', '끝없는 반전': '분홍 발판 위에서는 좌우가 반대',
};
for (const t of VOIDS) t.tip = TIPS[t.name] || '';
