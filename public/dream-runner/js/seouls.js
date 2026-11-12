// 🗺️ 서울 맵 (러너-개선 6): 젤리 서울 러너에서 달리기 좋은 실제 코스 20곳. 한 판 안에서 일정 시간마다 랜덤 순서로 바뀐다
//   course: 실제 길 (어디 → 어디, km, 낮 · 노을 · 밤) — 코스 카드에 보인다
//   길 모양 · 교차로 · 정류장은 seoul-routes.js (서울 칸 지도에서 만든 실제 경로 선, 같은 순서)
//   길 위로는 행인 젤리 · 자전거 · 차 · 버스 · 오토바이가 건너거나 마주 온다 (track.js seoulPattern)
//   그림은 seoul-run.js 가 서울 산책 엔진으로 (여기 색은 첫 화면 · 코스 카드에만 쓴다)
import { ROUTES } from './seoul-routes.js';
// 코스가 바뀌는 곳(판정 거리)이 그 코스 길의 몇 m 지점인지 (뒤로 카메라 · 문 자리를 남긴다)
export const SEOUL_U0 = 40;
// 그 꿈(코스 차례)의 코스 번호
export const seoulCourseOf = (track, dream) => track.order[dream % track.order.length];
// 그 코스 길 폭 (레인 3개): 앞 700m 가 거의 찻길(8m 넘게)이면 9m, 골목 · 산책길이면 7m (건물 · 잔디로 들어가지 않게)
export const seoulLaneW = (c) => { const w = ROUTES[c].w.slice(0, 36); return w.filter((q) => q >= 8).length >= w.length / 2 ? 9 : 7; };
export { ROUTES };

const s = (name, emoji, course, o) => { const t = { name, emoji, course, seoul: true, fog: [40, 320], stars: 0, light: 1, fx: 'none', under: 'grass', underC: '#5a5a58', style: 'road', edge: '#ffd54f', ...o }; delete t.kits; delete t.P; return t; };
const DAY = ['#5b9be8', '#d8ecff', '#cfd8dc'], SUNSET = ['#3b4a8c', '#ffb37a', '#f6c9a0'], NIGHT = ['#050a1c', '#1d2a55', '#0b1020'];
const NEON = ['#ff4081', '#40c4ff', '#ffd740', '#69f0ae', '#e040fb', '#ffffff', '#ff6e40'];
const m = (scale, root, bpm, wave) => [scale, root, bpm, wave];

export const SEOULS = [
  s('반포 한강공원 달빛무지개분수', '🌈', { from: '서래섬', to: '반포대교 · 세빛섬', km: 1.5, time: '밤' }, { sky: NIGHT, plat: ['#8a8f96', '#4a4f56'], style: 'tile', under: 'water', underC: '#13304f', stars: 0.4, light: 0.55, fx: 'fireflies', fxC: '#b3e5fc', kits: ['rainbowFountain', 'hanBridge', 'seoulLamp', 'streetTree', 'skylineSeoul', 'planter'], P: { leaf: '#2e5d3a', lamp: '#ffe7b0', win: '#ffd98a', bridge: '#fff3c4', glass: ['#26324a', '#2c3a55'] }, mus: m('lydian', 64, 92, 'triangle') }),
  s('여의도 한강공원', '🌉', { from: '여의나루', to: '63빌딩', km: 1.6, time: '낮' }, { sky: DAY, plat: ['#b0a89a', '#7d756a'], style: 'tile', under: 'water', underC: '#3a7fb0', kits: ['gold63', 'hanBridge', 'streetTree', 'seoulLamp', 'skylineSeoul', 'planter'], P: { leaf: '#5d9c4a', win: '#e3f2fd', glass: ['#6f8fae', '#7f9bb8'] }, mus: m('major', 62, 110, 'triangle') }),
  s('여의도 윤중로 벚꽃길', '🌸', { from: '국회의사당 뒤', to: '여의서로', km: 1.3, time: '낮' }, { sky: ['#7fb3ff', '#ffe9f1', '#ffd6e5'], plat: ['#c9b8a6', '#8c7a68'], style: 'brick', under: 'grass', underC: '#7fa86a', fx: 'petals', fxC: '#ffc1dc', kits: ['seoulBlossom', 'assembly', 'seoulLamp', 'busStop', 'skylineSeoul'], P: { leaf: '#ffc1dc', wood: '#5d4037', win: '#ffffff' }, mus: m('pent', 67, 104, 'sine') }),
  s('홍대 걷고싶은거리', '🎸', { from: '상수역 쪽', to: '홍대입구역', km: 1.5, time: '밤' }, { sky: NIGHT, plat: ['#7b6f6a', '#4a3f3a'], style: 'brick', stars: 0.2, light: 0.6, fx: 'none', kits: ['seoulShop', 'neonAlley', 'stall', 'seoulLamp', 'signal'], P: { signs: NEON, shop: '#ffd59a', win: '#ffcf8a', walls: ['#4e4a52', '#5d4f57', '#3e4250', '#6a5a50'] }, mus: m('dorian', 57, 124, 'square') }),
  s('연남동 경의선숲길', '🌳', { from: '홍대입구역 3번 출구', to: '연남동', km: 1.4, time: '낮' }, { sky: DAY, plat: ['#a4b07c', '#6a7550'], style: 'grass', under: 'grass', underC: '#6e9a54', fx: 'leaves', fxC: '#9ccc65', kits: ['streetTree', 'planter', 'brickCafe', 'seoulLamp', 'seoulApt'], P: { leaf: '#4f8f3e', win: '#fff3c4' }, mus: m('major', 65, 100, 'sine') }),
  s('명동 거리', '🛍️', { from: '을지로입구', to: '명동성당 · 을지로', km: 1.4, time: '밤' }, { sky: NIGHT, plat: ['#9a8f86', '#5a524c'], style: 'tile', stars: 0.2, light: 0.62, kits: ['seoulShop', 'stall', 'neonAlley', 'namsanTower', 'seoulLamp'], P: { signs: NEON, shop: '#ffe9b0', win: '#ffe0a0', towerLit: '#9ad8ff', hill: '#1f3a28' }, mus: m('major', 60, 118, 'square') }),
  s('인사동 쌈지길', '🏮', { from: '인사동 북쪽 입구', to: '종로3가', km: 1.2, time: '낮' }, { sky: DAY, plat: ['#a1887f', '#6d5a52'], style: 'brick', fx: 'lanterns', fxC: '#ffb74d', kits: ['hanok', 'stall', 'seoulShop', 'streetTree', 'seoulLamp'], P: { tile: '#455a64', paper: '#ffe7b8', walls: ['#d7ccc8', '#bcaaa4', '#efebe9'], signs: ['#3e2723', '#ffffff', '#c62828', '#1b5e20'], win: '#fff8e1' }, mus: m('pent', 62, 96, 'triangle') }),
  s('청계천', '🏞️', { from: '청계광장', to: '광장시장', km: 2.0, time: '노을' }, { sky: SUNSET, plat: ['#bdb4a6', '#857c70'], style: 'tile', under: 'water', underC: '#3f6f8a', fx: 'lanterns', fxC: '#ffcc80', light: 0.85, sun: '#ffd6a0', kits: ['streamStone', 'streetTree', 'seoulOffice', 'seoulLamp', 'planter'], P: { leaf: '#6a9a4f', win: '#ffd59a', glass: ['#5a6f88', '#6b7f99'] }, mus: m('lydian', 60, 90, 'sine') }),
  s('광화문 광장', '🏯', { from: '서울시청', to: '광화문', km: 1.1, time: '낮' }, { sky: DAY, plat: ['#cfc8bc', '#958d80'], style: 'tile', kits: ['palaceGate', 'statue', 'seoulOffice', 'seoulHill', 'ginkgo', 'signal'], P: { ginkgo: '#7cb342', hill: '#5e8a4f', win: '#e3f2fd', glass: ['#7f97ad', '#8ea3b6'] }, mus: m('major', 60, 100, 'triangle') }),
  s('북촌 한옥마을', '🏡', { from: '삼청동 · 가회동', to: '안국역', km: 1.3, time: '낮' }, { sky: ['#6aa6ee', '#f2efe6', '#d7ccc8'], plat: ['#b8b0a2', '#7e766a'], style: 'brick', under: 'grass', underC: '#7a8f5a', kits: ['hanok', 'stoneWall', 'seoulHill', 'streetTree', 'planter'], P: { tile: '#37474f', paper: '#fff3d6', hill: '#5c8a4c', leaf: '#5d8f45' }, mus: m('pent', 64, 92, 'triangle') }),
  s('남산 소월길', '🗼', { from: '회현 쪽 남산 아래', to: '남산 하얏트 쪽', km: 2.6, time: '노을' }, { sky: SUNSET, plat: ['#9c8a70', '#64553f'], style: 'wood', under: 'grass', underC: '#4f6b3a', fx: 'leaves', fxC: '#ffb74d', light: 0.85, sun: '#ffcf94', kits: ['namsanTower', 'streetTree', 'ginkgo', 'seoulLamp', 'seoulHill'], P: { hill: '#3f6b3a', leaf: '#5a8a3a', ginkgo: '#f9a825', towerLit: '#ffe0b2' }, mus: m('dorian', 62, 98, 'sine') }),
  s('석촌호수 벚꽃 둘레길', '🎡', { from: '석촌호수 서호', to: '동호 · 롯데월드', km: 1.0, time: '밤' }, { sky: NIGHT, plat: ['#a89a8e', '#6c6056'], style: 'brick', under: 'water', underC: '#1a3150', stars: 0.3, light: 0.6, fx: 'petals', fxC: '#ffc1dc', kits: ['lotteTower', 'seoulBlossom', 'seoulLamp', 'skylineSeoul', 'planter'], P: { leaf: '#ff9ec7', wood: '#4e342e', win: '#cfe8ff', glass: ['#26324a', '#2c3a55'] }, mus: m('lydian', 65, 100, 'triangle') }),
  s('잠실 롯데월드타워 앞', '🏙️', { from: '잠실역', to: '올림픽로 동쪽', km: 2.0, time: '낮' }, { sky: DAY, plat: ['#bab3a8', '#7f786d'], style: 'tile', kits: ['lotteTower', 'seoulOffice', 'streetTree', 'busStop', 'signal', 'seoulApt'], P: { leaf: '#5d9c4a', win: '#e3f2fd', busRoof: '#1565c0', glass: ['#7f97ad', '#6f8fae'] }, mus: m('major', 62, 112, 'square') }),
  s('성수동 카페거리', '☕', { from: '서울숲', to: '성수역', km: 1.3, time: '낮' }, { sky: ['#7aa6d8', '#efe6dc', '#d7c4b4'], plat: ['#9c8f84', '#62574d'], style: 'brick', kits: ['brickCafe', 'viaduct', 'streetTree', 'seoulShop', 'signal'], P: { walls: ['#9c4a32', '#b0603f', '#d7ccc8'], signs: ['#212121', '#ffffff', '#ff7043'], win: '#ffe0b2', leaf: '#5d8f45' }, mus: m('dorian', 60, 106, 'triangle') }),
  s('이태원 거리', '🌍', { from: '녹사평역', to: '한강진역', km: 1.6, time: '밤' }, { sky: NIGHT, plat: ['#7a706a', '#4a423d'], style: 'tile', stars: 0.2, light: 0.6, kits: ['neonAlley', 'seoulShop', 'stall', 'seoulLamp', 'namsanTower'], P: { signs: NEON, shop: '#ffd59a', win: '#ffcf8a', hill: '#1f3a28', towerLit: '#9ad8ff', walls: ['#4e4a52', '#5d4f57', '#3e4250'] }, mus: m('minor', 57, 116, 'sawtooth') }),
  s('강남대로', '🌃', { from: '신논현역', to: '강남역', km: 1.5, time: '밤' }, { sky: NIGHT, plat: ['#6f7378', '#3f4348'], style: 'road', stars: 0.1, light: 0.6, kits: ['seoulOffice', 'skylineSeoul', 'busStop', 'signal', 'seoulLamp', 'neonAlley'], P: { win: '#cfe8ff', top: '#40c4ff', signs: NEON, busRoof: '#1565c0', glass: ['#26324a', '#2c3a55', '#1f2a3f'] }, mus: m('minor', 59, 126, 'square') }),
  s('서울숲', '🦌', { from: '서울숲 남쪽', to: '서울숲길', km: 2.1, time: '낮' }, { sky: DAY, plat: ['#b3a17c', '#7a6b4f'], style: 'wood', under: 'grass', underC: '#5f8f4e', fx: 'leaves', fxC: '#aed581', kits: ['streetTree', 'ginkgo', 'planter', 'seoulApt', 'seoulLamp'], P: { leaf: '#4f8f3e', ginkgo: '#9ccc65', win: '#fff3c4' }, mus: m('pent', 67, 100, 'sine') }),
  s('덕수궁 돌담길', '🍂', { from: '대한문', to: '정동길', km: 1.2, time: '노을' }, { sky: SUNSET, plat: ['#b5a58e', '#7c6d58'], style: 'brick', fx: 'leaves', fxC: '#ffd54f', light: 0.85, sun: '#ffd6a0', kits: ['stoneWall', 'ginkgo', 'seoulLamp', 'seoulOffice', 'palaceGate'], P: { ginkgo: '#f9c80e', win: '#ffd59a', glass: ['#5a6f88', '#6b7f99'] }, mus: m('dorian', 60, 92, 'triangle') }),
  s('동대문 DDP', '🛸', { from: '신당 쪽', to: '흥인지문 · 종로', km: 2.3, time: '밤' }, { sky: NIGHT, plat: ['#8d9196', '#55595e'], style: 'tile', stars: 0.2, light: 0.62, kits: ['ddp', 'palaceGate', 'seoulShop', 'seoulLamp', 'skylineSeoul'], P: { signs: NEON, win: '#e3f2fd', shop: '#ffe9b0', glass: ['#26324a', '#2c3a55'] }, mus: m('lydian', 62, 112, 'square') }),
  s('서울역 · 숭례문', '🚉', { from: '서울역', to: '숭례문 · 시청', km: 1.3, time: '노을' }, { sky: SUNSET, plat: ['#c4beb4', '#8a847a'], style: 'tile', light: 0.85, sun: '#ffd6a0', kits: ['planter', 'streetTree', 'seoulOffice', 'namsanTower', 'seoulLamp'], P: { leaf: '#6a9a4f', win: '#ffd59a', hill: '#3f6b3a', towerLit: '#ffe0b2', glass: ['#5a6f88', '#6b7f99'] }, mus: m('major', 64, 100, 'triangle') }),
];

// 한 판이 길어지면 서울의 하루가 흐른다: 코스 5곳마다 낮 ↔ 밤이 바뀐다 (낮 코스는 밤 모습으로, 밤 코스는 낮 모습으로)
const VAR = new Map();
export function seoulAt(i, flip) {
  const th = SEOULS[i]; if (!flip) return th; const k = i; if (VAR.has(k)) return VAR.get(k);
  const night = th.light >= 0.7, v = { ...th, P: { ...th.P }, course: { ...th.course, time: night ? '밤' : '낮' } };
  if (night) Object.assign(v, { sky: NIGHT, light: 0.58, stars: 0.3, sun: undefined, fx: th.fx === 'petals' || th.fx === 'leaves' ? th.fx : 'none', under: th.under === 'water' ? 'water' : 'grass', underC: th.under === 'water' ? '#13304f' : '#3a3c40' });
  else Object.assign(v, { sky: DAY, light: 1, stars: 0, sun: undefined, fx: th.fx === 'fireflies' ? 'none' : th.fx, under: th.under === 'water' ? 'water' : 'grass', underC: th.under === 'water' ? '#3a7fb0' : '#9a958c' });
  VAR.set(k, v); return v;
}
