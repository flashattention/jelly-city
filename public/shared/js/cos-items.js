// 치장 · 업적 목록 (서버 · 브라우저 공용, three 없음). 치장은 계정에 저장되고 모든 게임에서 쓴다
//   상점 아이템: 드림 러너에서 모은 별로 산다 · 업적 아이템: 그 업적을 달성해야만 쓸 수 있다
export const SLOTS = {
  aura: { name: '오라', emoji: '✨', sub: '몸을 감싸는 빛' }, shoes: { name: '신발', emoji: '👟', sub: '발에 신는 것' }, back: { name: '등 장식', emoji: '🪽', sub: '날개와 빛' },
  trail: { name: '발자취', emoji: '🐾', sub: '달리면 남는 자국' }, jump: { name: '2단 점프', emoji: '🌟', sub: '드림 러너 2단 점프 효과' }, boost: { name: '가속', emoji: '🚀', sub: '드림 러너 가속 효과' }, land: { name: '착지', emoji: '💥', sub: '드림 러너 착지 효과' },
  sash: { name: '휘장', emoji: '🎗️', sub: '업적으로만 얻는 어깨띠' }, crown: { name: '왕관', emoji: '👑', sub: '지금 1위인 동안만 쓰는 왕관' }, medal: { name: '훈장', emoji: '🎖️', sub: '지금 가장 높은 순위(🥇 1위 → 🥈 2위 → 🥉 3위 → 상위 1% → 5% → 10%)가 이름 옆에 저절로 붙어요', auto: true }, title: { name: '칭호', emoji: '🏷️', sub: '이름 옆에 빛나는 글자' },
};
export const RARITY = {
  common: { name: '일반', color: '#c8d0dc' }, rare: { name: '희귀', color: '#5fb6ff' }, epic: { name: '영웅', color: '#c77dff' }, legend: { name: '전설', color: '#ffc93c' }, myth: { name: '신화', color: '#ff5c8a' }, apex: { name: '초월', color: '#7fe9ff' },
};
// 업적 등급: 숫자가 클수록 더 많이 빛난다
export const TIERS = {
  bronze: { n: 1, name: '동', color: '#d98e5a', glow: '#ffb27a' }, silver: { n: 2, name: '은', color: '#c9d6e6', glow: '#ffffff' }, gold: { n: 3, name: '금', color: '#ffc93c', glow: '#fff0a0' },
  platinum: { n: 4, name: '백금', color: '#7fe9ff', glow: '#d8fbff' }, legend: { n: 5, name: '전설', color: '#ff5c8a', glow: '#ffd27a' },
};
// shape: glow star heart bubble flame petal bolt skull rune snow feather coin / colors: 'rainbow' 이면 돌아간다
const it = (slot, id, name, emoji, price, rarity, fx, req) => ({ id: `${slot}.${id}`, slot, name, emoji, price, rarity, fx, req: req || null, shop: true });
const R = (diff, dist, map = 'dream') => ({ diff, dist, map });
const RAIN = 'rainbow';
export const SHOP = [
  // 오라
  it('aura', 'mist', '은은한 안개', '🌫️', 60, 'common', { shape: 'glow', colors: ['#dfe7f2'], n: 10, size: 0.32 }),
  it('aura', 'firefly', '반딧불이', '🪲', 120, 'common', { shape: 'glow', colors: ['#d9ff6a'], n: 14, size: 0.22 }),
  it('aura', 'petal', '벚꽃잎', '🌸', 200, 'common', { shape: 'petal', colors: ['#ffb7d2', '#ffd9e6'], n: 14, size: 0.3 }),
  it('aura', 'bubble', '비눗방울', '🫧', 280, 'common', { shape: 'bubble', colors: ['#c8f1ff'], n: 12, size: 0.34 }),
  it('aura', 'heart', '하트 구름', '💗', 500, 'rare', { shape: 'heart', colors: ['#ff5c9d', '#ff8fc0'], n: 14, size: 0.3, ring: '#ff8fc0' }),
  it('aura', 'snow', '함박눈', '❄️', 700, 'rare', { shape: 'snow', colors: ['#ffffff', '#bfe8ff'], n: 18, size: 0.28, ring: '#bfe8ff' }),
  it('aura', 'ember', '타오르는 불씨', '🔥', 1100, 'rare', { shape: 'flame', colors: ['#ff8a3d', '#ffd27a'], n: 22, size: 0.28, ring: '#ff8a3d', rise: 2 }),
  it('aura', 'bolt', '번개 폭풍', '⚡', 3200, 'epic', { shape: 'bolt', colors: ['#7ff0ff', '#ffee70'], n: 20, size: 0.4, ring: '#7ff0ff', rise: 1 }),
  it('aura', 'rune', '고대 룬', '🔯', 5200, 'epic', { shape: 'rune', colors: ['#c77dff', '#ff9be7'], n: 16, size: 0.42, ring: '#c77dff', ring2: '#ff9be7' }),
  it('aura', 'soul', '떠도는 영혼', '👻', 8000, 'epic', { shape: 'skull', colors: ['#9be7ff', '#e6fbff'], n: 12, size: 0.42, ring: '#9be7ff' }, R('hard', 1500, 'hell')),
  it('aura', 'hell', '지옥불 왕좌', '😈', 28000, 'legend', { shape: 'flame', colors: ['#ff2b2b', '#ff8a3d', '#ffd27a'], n: 34, size: 0.4, ring: '#ff2b2b', ring2: '#ff8a3d', rise: 3 }, R('extreme', 2500, 'hell')),
  it('aura', 'galaxy', '은하 소용돌이', '🌌', 45000, 'legend', { shape: 'star', colors: ['#9f7bff', '#7fe9ff', '#ffffff'], n: 36, size: 0.3, ring: '#9f7bff', ring2: '#7fe9ff' }, R('extreme', 5000)),
  it('aura', 'prism', '무지개 프리즘', '🌈', 90000, 'myth', { shape: 'star', colors: RAIN, n: 44, size: 0.34, ring: RAIN, ring2: RAIN }, R('lightspeed', 2500)),
  it('aura', 'void', '초월의 공허', '🕳️', 180000, 'myth', { shape: 'rune', colors: ['#ffffff', '#b28bff'], n: 40, size: 0.44, ring: '#ffffff', ring2: '#b28bff', rise: 2, dark: true }, R('beyond', 2500)),
  // 신발
  it('shoes', 'sneak', '젤리 운동화', '👟', 50, 'common', { color: '#ff6b8b', sole: '#ffffff' }),
  it('shoes', 'boots', '장화', '🥾', 120, 'common', { color: '#ffd54f', sole: '#8a6a2a', tall: 1 }),
  it('shoes', 'mint', '민트 스니커즈', '💚', 200, 'common', { color: '#5fe0b0', sole: '#ffffff' }),
  it('shoes', 'gold', '반짝 금구두', '🥇', 650, 'rare', { color: '#ffc93c', sole: '#b37a10', shine: '#fff0a0' }),
  it('shoes', 'ice', '얼음 스케이트', '⛸️', 1200, 'rare', { color: '#bfe8ff', sole: '#ffffff', shine: '#ffffff' }),
  it('shoes', 'wing', '날개 달린 신발', '🪽', 2600, 'epic', { color: '#ffffff', sole: '#d8e6f5', wing: '#ffffff', shine: '#d8fbff' }),
  it('shoes', 'flame', '불꽃 부츠', '🔥', 5200, 'epic', { color: '#3a2020', sole: '#ff5a1f', flame: '#ff8a3d', shine: '#ff8a3d', tall: 1 }),
  it('shoes', 'neon', '네온 러너', '💠', 8800, 'epic', { color: '#101428', sole: '#00f5ff', shine: '#00f5ff', wing: '#ff2bd6' }, R('hard', 3000)),
  it('shoes', 'gwing', '황금 날개 신발', '🏆', 32000, 'legend', { color: '#ffc93c', sole: '#fff0a0', wing: '#ffe27a', shine: '#fff0a0' }, R('extreme', 3000)),
  it('shoes', 'hell', '지옥 발굽', '👿', 40000, 'legend', { color: '#1a0606', sole: '#ff2b2b', flame: '#ff2b2b', shine: '#ff2b2b', tall: 1 }, R('extreme', 2500, 'hell')),
  it('shoes', 'light', '빛의 속도', '☄️', 120000, 'myth', { color: '#ffffff', sole: '#7fe9ff', wing: '#7fe9ff', flame: '#ffffff', shine: '#ffffff' }, R('lightspeed', 3000)),
  // 등 장식
  it('back', 'leaf', '나뭇잎 날개', '🍃', 150, 'common', { kind: 'wing', color: '#7ee081' }),
  it('back', 'candy', '사탕 날개', '🍭', 400, 'common', { kind: 'wing', color: '#ff9ed1' }),
  it('back', 'angel', '천사 날개', '👼', 1400, 'rare', { kind: 'wing', color: '#ffffff', glow: '#fff4c8' }),
  it('back', 'bat', '박쥐 날개', '🦇', 1800, 'rare', { kind: 'wing', color: '#2a1838', glow: '#c77dff', sharp: 1 }),
  it('back', 'halo', '등 뒤의 광륜', '🌕', 3800, 'epic', { kind: 'halo', color: '#ffe27a' }),
  it('back', 'phoenix', '불사조 날개', '🐦‍🔥', 16000, 'legend', { kind: 'wing', color: '#ff7a1f', glow: '#ffd27a', big: 1 }, R('extreme', 2000)),
  it('back', 'dragon', '심연의 날개', '🐉', 38000, 'legend', { kind: 'wing', color: '#120820', glow: '#ff2b6a', big: 1, sharp: 1 }, R('extreme', 2500, 'hell')),
  it('back', 'nebula', '성운의 날개', '🌠', 110000, 'myth', { kind: 'wing', color: '#6a4dff', glow: RAIN, big: 1 }, R('beyond', 2000)),
  // 발자취
  it('trail', 'dust', '먼지 구름', '💨', 40, 'common', { shape: 'glow', colors: ['#d8cfc0'], size: 0.4, life: 0.5 }),
  it('trail', 'candy', '사탕 가루', '🍬', 150, 'common', { shape: 'star', colors: ['#ff9ed1', '#ffe066', '#7fe9ff'], size: 0.24, life: 0.8 }),
  it('trail', 'flower', '꽃길', '🌼', 320, 'common', { shape: 'petal', colors: ['#ffb7d2', '#ffffff'], size: 0.3, life: 1.1 }),
  it('trail', 'coin', '금화 뿌리기', '🪙', 900, 'rare', { shape: 'coin', colors: ['#ffc93c', '#ffe27a'], size: 0.26, life: 0.9 }),
  it('trail', 'flame', '불길', '🔥', 2400, 'epic', { shape: 'flame', colors: ['#ff5a1f', '#ffd27a'], size: 0.42, life: 0.5 }),
  it('trail', 'bolt', '번개 자국', '⚡', 6000, 'epic', { shape: 'bolt', colors: ['#7ff0ff', '#ffffff'], size: 0.42, life: 0.35 }),
  it('trail', 'rainbow', '무지개 길', '🌈', 22000, 'legend', { shape: 'star', colors: RAIN, size: 0.42, life: 1.1, rate: 55, ribbon: { w: 1.25, life: 1.6 } }, R('extreme', 2000)), // 바닥에 깔리는 무지개 띠 + 반짝이
  it('trail', 'skull', '해골 발자국', '💀', 30000, 'legend', { shape: 'skull', colors: ['#e8e0c8', '#ff3b4d'], size: 0.38, life: 0.8 }, R('hard', 3000, 'hell')),
  // 리본 길: 무지개 길처럼 바닥에 띠가 깔린다 (ribbon.colors = 띠의 가로 색)
  it('trail', 'candyrib', '사탕 리본 길', '🍭', 1800, 'rare', { shape: 'star', colors: ['#ff9ed1', '#fff3b0', '#7fe9ff'], size: 0.3, life: 0.8, rate: 30, ribbon: { w: 0.95, life: 1.1, colors: ['#ff9ed1', '#fff3b0', '#7fe9ff', '#ff9ed1'] } }),
  it('trail', 'mintrib', '민트 바람 길', '🍃', 2600, 'rare', { shape: 'petal', colors: ['#5fe0b0', '#b8f5c8'], size: 0.28, life: 0.9, rate: 28, ribbon: { w: 1, life: 1.2, colors: ['#2fbf8f', '#5fe0b0', '#b8f5c8', '#4cc3ff'] } }),
  it('trail', 'sakurarib', '벚꽃 비단길', '🌸', 3600, 'epic', { shape: 'petal', colors: ['#ffb7d2', '#ffd9e6', '#ff8fc0'], size: 0.32, life: 1.2, rate: 34, ribbon: { w: 1.05, life: 1.3, colors: ['#ff8fc0', '#ffd9e6', '#ffffff', '#ffb7d2'] } }),
  it('trail', 'wave', '파도 물결 길', '🌊', 4800, 'epic', { shape: 'bubble', colors: ['#c8f1ff', '#7fe9ff'], size: 0.3, life: 1, rate: 30, ribbon: { w: 1.1, life: 1.3, colors: ['#1f5fff', '#3fc8ff', '#7fe9ff', '#e6fbff'] } }),
  it('trail', 'goldrib', '황금 융단', '✨', 7500, 'epic', { shape: 'coin', colors: ['#ffc93c', '#fff0a0'], size: 0.28, life: 0.9, rate: 36, ribbon: { w: 1.1, life: 1.4, colors: ['#b37a10', '#ffc93c', '#fff0a0', '#ffc93c', '#b37a10'] } }),
  it('trail', 'neonrib', '네온 레이저 길', '💠', 11000, 'epic', { shape: 'bolt', colors: ['#00f5ff', '#ff2bd6'], size: 0.34, life: 0.45, rate: 40, ribbon: { w: 0.9, life: 1.2, colors: ['#ff2bd6', '#101428', '#00f5ff', '#101428', '#ff2bd6'] } }, R('hard', 2500)),
  it('trail', 'aurora', '오로라 길', '🌌', 26000, 'legend', { shape: 'star', colors: ['#5fe0b0', '#7fe9ff', '#c77dff'], size: 0.38, life: 1.2, rate: 45, ribbon: { w: 1.3, life: 1.7, colors: ['#5fe0b0', '#7fe9ff', '#9f7bff', '#c77dff'] } }, R('extreme', 2500)),
  it('trail', 'lava', '용암 강', '🌋', 34000, 'legend', { shape: 'flame', colors: ['#ff5a1f', '#ffd27a'], size: 0.42, life: 0.6, rate: 48, ribbon: { w: 1.3, life: 1.5, colors: ['#5a0a0a', '#ff2b2b', '#ff8a3d', '#ffd27a', '#ff2b2b'] } }, R('extreme', 2000, 'hell')),
  it('trail', 'milky', '은하수 길', '🌠', 70000, 'myth', { shape: 'star', colors: ['#ffffff', '#b28bff', '#7fe9ff'], size: 0.4, life: 1.3, rate: 55, ribbon: { w: 1.35, life: 1.8, colors: ['#1b1450', '#6a4dff', '#ffffff', '#7fe9ff', '#1b1450'] } }, R('lightspeed', 2000)),
  it('trail', 'dawn', '여명의 길', '🌅', 140000, 'myth', { shape: 'glow', colors: ['#ffe27a', '#ff9a6b', '#ffffff'], size: 0.46, life: 1.3, rate: 55, ribbon: { w: 1.4, life: 1.9, colors: ['#3a2a8a', '#ff5c8a', '#ff9a6b', '#ffe27a', '#ffffff'] } }, R('beyond', 2000)),
  // 2단 점프
  it('jump', 'puff', '뭉게구름', '☁️', 60, 'common', { shape: 'glow', colors: ['#ffffff'], n: 12, size: 0.5 }),
  it('jump', 'star', '별 터짐', '⭐', 180, 'common', { shape: 'star', colors: ['#ffe066', '#fff3b0'], n: 14, size: 0.36 }),
  it('jump', 'heart', '하트 뿜기', '💖', 340, 'common', { shape: 'heart', colors: ['#ff5c9d', '#ff8fc0'], n: 12, size: 0.38 }),
  it('jump', 'ring', '충격파 고리', '⭕', 900, 'rare', { shape: 'glow', colors: ['#7fe9ff'], n: 16, size: 0.32, ring: '#7fe9ff' }),
  it('jump', 'feather', '깃털 날림', '🪶', 1500, 'rare', { shape: 'feather', colors: ['#ffffff', '#d8e6f5'], n: 16, size: 0.42 }),
  it('jump', 'thunder', '벼락', '🌩️', 4500, 'epic', { shape: 'bolt', colors: ['#ffee70', '#7ff0ff'], n: 22, size: 0.56, ring: '#ffee70' }),
  it('jump', 'hell', '지옥문 폭발', '🌋', 24000, 'legend', { shape: 'flame', colors: ['#ff2b2b', '#ffd27a'], n: 34, size: 0.56, ring: '#ff5a1f' }, R('extreme', 2000, 'hell')),
  it('jump', 'super', '초신성', '💫', 95000, 'myth', { shape: 'star', colors: RAIN, n: 48, size: 0.5, ring: RAIN }, R('lightspeed', 2000)),
  // 가속
  it('boost', 'wind', '바람 줄기', '🌬️', 100, 'common', { shape: 'glow', colors: ['#d8f0ff'], size: 0.3, life: 0.35, rate: 40 }),
  it('boost', 'spark', '불꽃 가루', '🎇', 260, 'common', { shape: 'star', colors: ['#ffd27a', '#ff8a3d'], size: 0.26, life: 0.4, rate: 50 }),
  it('boost', 'note', '하트 로켓', '💘', 620, 'rare', { shape: 'heart', colors: ['#ff5c9d'], size: 0.34, life: 0.5, rate: 40 }),
  it('boost', 'plasma', '플라스마', '🟣', 2800, 'epic', { shape: 'bolt', colors: ['#c77dff', '#7ff0ff'], size: 0.46, life: 0.3, rate: 60 }),
  it('boost', 'comet', '혜성 꼬리', '☄️', 20000, 'legend', { shape: 'glow', colors: ['#ffffff', '#7fe9ff', '#2f7bff'], size: 0.62, life: 0.6, rate: 90 }, R('extreme', 2500)),
  it('boost', 'warp', '시공 도약', '🌀', 85000, 'myth', { shape: 'rune', colors: RAIN, size: 0.56, life: 0.5, rate: 90 }, R('beyond', 1500)),
  // 착지
  it('land', 'dust', '폴짝 먼지', '💨', 40, 'common', { shape: 'glow', colors: ['#d8cfc0'], n: 8, size: 0.4 }),
  it('land', 'jelly', '젤리 튀김', '🍮', 200, 'common', { shape: 'bubble', colors: ['#ff9ed1', '#7fe9ff'], n: 10, size: 0.32 }),
  it('land', 'quake', '땅 울림', '🌍', 1000, 'rare', { shape: 'glow', colors: ['#ffc93c'], n: 14, size: 0.34, ring: '#ffc93c' }),
  it('land', 'meteor', '운석 충돌', '☄️', 12000, 'legend', { shape: 'flame', colors: ['#ff8a3d', '#ffd27a'], n: 26, size: 0.5, ring: '#ff5a1f' }, R('extreme', 1500)),
  // 초월 도전: 맵마다 초월 난이도 2,500m(전설) · 5,000m(신화) · 10,000m(초월 등급). 높을수록 크고 화려하다
  //   🌙 꿈나라 — 달빛 · 꿈결 (파스텔 · 무지개)
  it('aura', 'dreamb', '꿈결 오로라', '🌙', 55000, 'legend', { shape: 'star', colors: ['#ffe8a8', '#c8b6ff', '#a8e8ff'], n: 38, size: 0.32, ring: '#c8b6ff', ring2: '#ffe8a8', rise: 1 }, R('beyond', 2500)),
  it('back', 'dreamb', '달빛 꿈의 날개', '🦋', 150000, 'myth', { kind: 'wing', color: '#c8b6ff', glow: RAIN, big: 1 }, R('beyond', 5000)),
  it('trail', 'dreamb', '꿈의 끝 은하 융단', '🌌', 300000, 'apex', { shape: 'star', colors: RAIN, size: 0.5, life: 1.6, rate: 70, ribbon: { w: 1.6, life: 2.2, colors: ['#1b1450', '#ff7aa8', '#ffe8a8', '#ffffff', '#a8e8ff', '#c8b6ff', '#1b1450'] } }, R('beyond', 10000)),
  //   🔥 지옥 — 업화 · 마왕
  it('jump', 'hellb', '업화의 포효', '🐲', 60000, 'legend', { shape: 'flame', colors: ['#ff2b2b', '#ff8a3d', '#ffd27a'], n: 44, size: 0.62, ring: '#ff2b2b' }, R('beyond', 2500, 'hell')),
  it('boost', 'hellb', '염화 질주', '☄️', 160000, 'myth', { shape: 'flame', colors: ['#5a0a0a', '#ff2b2b', '#ff8a3d', '#ffd27a'], size: 0.7, life: 0.7, rate: 110 }, R('beyond', 5000, 'hell')),
  it('aura', 'hellb', '마왕의 화염 왕좌', '👹', 320000, 'apex', { shape: 'flame', colors: ['#1a0000', '#ff2b2b', '#ff8a3d', '#ffd27a'], n: 56, size: 0.46, ring: '#ff2b2b', ring2: '#ffd27a', rise: 4, dark: true }, R('beyond', 10000, 'hell')),
  //   🌌 이공간 — 차원 · 특이점
  it('land', 'voidb', '차원 균열 착지', '🌀', 65000, 'legend', { shape: 'rune', colors: ['#b28bff', '#7fe9ff', '#ffffff'], n: 30, size: 0.52, ring: '#b28bff' }, R('beyond', 2500, 'void')),
  it('shoes', 'voidb', '사건의 지평선', '🕳️', 170000, 'myth', { color: '#06040e', sole: '#b28bff', wing: '#7fe9ff', flame: '#b28bff', shine: '#ffffff' }, R('beyond', 5000, 'void')),
  it('back', 'voidb', '특이점의 날개', '✴️', 350000, 'apex', { kind: 'wing', color: '#06040e', glow: RAIN, big: 1, sharp: 1 }, R('beyond', 10000, 'void')),
];
// 난이도 · 맵별 별 보상 배수 (어려울수록 많이)
export const STAR_MULT = { easy: 1, hard: 1.6, extreme: 2.2, lightspeed: 3.2, beyond: 4.5 };
export const HELL_MULT = 1.5, VOID_MULT = 1.8; // 이공간이 가장 어려워서 별도 가장 많이
export const starsEarned = (stars, diff, map) => Math.floor((Number(stars) || 0) * (STAR_MULT[diff] || 1) * (map === 'hell' ? HELL_MULT : map === 'void' ? VOID_MULT : 1));

// ---------- 업적 ----------
const DIFF_NAMES = { easy: '노멀', hard: '하드', extreme: '익스트림', lightspeed: '광속', beyond: '초월' }, MAPS = { dream: '꿈나라', hell: '지옥', void: '이공간' };
export const GAMES = {
  'dream-runner': { name: '드림 러너', emoji: '🌙', color: '#8f7bff' }, 'jelly-guard': { name: '젤리수호대', emoji: '🛡️', color: '#4cc3ff' }, 'jelly-arena': { name: '젤리 아레나', emoji: '⚔️', color: '#ff5c5c' },
  'jelly-tactical': { name: '젤리택티컬', emoji: '🎯', color: '#7ee081' }, 'jelly-drop': { name: '젤리드롭', emoji: '🪂', color: '#ffb347' }, 'jelly-drift': { name: '젤리드리프트', emoji: '🏎️', color: '#ff7ac6' },
  'jelly-rumble': { name: '젤리대소동', emoji: '🎪', color: '#ffd84d' }, 'jelly-hide': { name: '젤리 숨바꼭질', emoji: '🫥', color: '#9be7a7' }, 'jelly-survivor': { name: '젤리 서바이버', emoji: '🧟', color: '#a6ff5e' },
  'jelly-ten': { name: '젤리텐', emoji: '🍎', color: '#ff6b6b' }, 'jelly-ding': { name: '젤리 땡', emoji: '🔔', color: '#ffc93c' }, 'jelly-court': { name: '젤리궁정', emoji: '👑', color: '#c77dff' },
  'jelly-merge': { name: '젤리 머지', emoji: '🍬', color: '#ff9ed1' }, 'jelly-slide': { name: '젤리 슬라이드', emoji: '🧩', color: '#7fe9ff' }, 'jelly-type': { name: '젤리 타자연습', emoji: '⌨️', color: '#b6c4ff' },
  'jelly-word': { name: '젤리 끝말잇기', emoji: '🔤', color: '#ffb7d2' }, 'jelly-draw': { name: '젤리 그림릴레이', emoji: '🎨', color: '#ffa94d' }, 'jelly-sketch': { name: '젤리 스케치퀴즈', emoji: '✏️', color: '#69db7c' },
};
// 기록판이 있는 게임: board(판) 이름 · 값 문턱. lower: 작을수록 좋은 기록 / unit: 단위
const RECORD_GAMES = {
  'jelly-ten': { boards: { t60: '1분', t120: '2분', t180: '3분' }, steps: [40, 80, 120, 150], unit: '점' },
  'jelly-survivor': { boards: { normal: '보통', hard: '어려움', endless: '무한' }, steps: [3000, 10000, 25000, 50000], unit: '점', over: { endless: [120, 300, 600, 1200] } },
  'jelly-type': { boards: { kpm: '타수', rain: '젤리비' }, steps: [200, 400, 600, 900], unit: '점', over: { rain: [5000, 30000, 150000, 800000] } },
  'jelly-merge': { boards: { box: '상자', bowl: '그릇', cup: '컵' }, steps: [1000, 3000, 8000, 20000], unit: '점' },
  'jelly-slide': { boards: { s4: '4칸', s5: '5칸' }, steps: [2000, 8000, 30000, 120000], unit: '점' },
  'jelly-drift': { boards: { candy: '사탕', cloud: '구름', neon: '네온', lava: '용암', sakura: '벚꽃', synth: '신스', snow: '눈', deep: '심해', hairpin: '헤어핀', choco: '초코', crystal: '수정', steam: '증기', park: '공원', rainbow: '무지개', moon: '달', chess: '체스' }, steps: [], lower: true, unit: '초' },
};
export const RECORD_GAME_KEYS = Object.keys(RECORD_GAMES);
// 상위 % 업적은 이만큼 겨룬 순위표에서만 (사람이 적으면 1위와 다를 게 없다)
export const PCT_MIN = { 1: 100, 5: 40, 10: 20 };
// 훈장(메달): 0 = 🥇 1위, 1 = 🥈 2위, 2 = 🥉 3위, 3 = 상위 1%, 4 = 5%, 5 = 10%. 숫자가 작을수록 먼저 보인다
//   [순서, 열쇠 업적 꼬리, 지금 확인할 조건, 아이콘, 이름 꼬리]
//   1 ~ 3위 메달은 인원 · 업적과 상관없이 지금 그 순위면 붙는다 (any)
export const MEDALS = [[0, 'r1', { rank: 1, exact: true, any: true }, '🥇', '1위'], [1, 'r3', { rank: 2, exact: true, any: true }, '🥈', '2위'], [2, 'r3', { rank: 3, exact: true, any: true }, '🥉', '3위'], [3, 'p1', { pct: 1 }, '💎', '상위 1%'], [4, 'p5', { pct: 5 }, '🏅', '상위 5%'], [5, 'p10', { pct: 10 }, '🎖️', '상위 10%']];
// 순위 업적의 격: 어려운 난이도 · 지옥일수록 높다 (1 ~ 5.5). 높을수록 왕관 · 칭호 · 휘장이 화려하다
const DIFF_ORDER = ['easy', 'hard', 'extreme', 'lightspeed', 'beyond'];
// 드림 러너 난이도마다 아이콘 · 무지개 색이 다르다 (지옥은 끝에 용암색이 섞인다)
export const DIFF_STYLE = {
  easy: { e: '🙂', grad: ['#5fe0b0', '#b8f5c8', '#4cc3ff'] }, hard: { e: '🔥', grad: ['#ff5c3a', '#ffa23a', '#ffd27a'] }, extreme: { e: '💀', grad: ['#ff2e63', '#b026ff', '#ff7ab0'] },
  lightspeed: { e: '⚡', grad: ['#ffee70', '#7ff0ff', '#4d7cff'] }, beyond: { e: '🌌', grad: ['#ff5c8a', '#ffc93c', '#5fe0b0', '#7fe9ff', '#c77dff'] },
};
// 정상의 길: 드림 러너 난이도마다 하나. 그 난이도 순위표(꿈나라 · 지옥 어느 쪽이든) 지금 3위 안에 있는 동안만 쓴다 (사지 않는다)
//   띠 · 반짝이 색은 그 난이도 아이콘 색(DIFF_STYLE.grad)이고, 어려운 난이도일수록 띠가 넓고 반짝이가 많다
export const TOP3_TRAILS = DIFF_ORDER.map((d, i) => {
  const st = DIFF_STYLE[d], cols = st.grad;
  return { id: `trail.top3.${d}`, slot: 'trail', name: `${DIFF_NAMES[d]} 정상의 길`, emoji: st.e, rarity: 'myth', top3: d,
    fx: { shape: i >= 3 ? 'star' : 'glow', colors: cols, size: 0.36 + i * 0.03, life: 1.1 + i * 0.1, rate: 45 + i * 6, ribbon: { w: 1.25 + i * 0.07, life: 1.6 + i * 0.12, colors: [...cols, cols[0]] } } };
});
export const top3Text = (it) => `${DIFF_STYLE[it.top3]?.e || ''} ${DIFF_NAMES[it.top3]} 순위표(꿈나라 · 지옥 · 이공간) 지금 3위 안에 있는 동안만 쓸 수 있어요`;
const styleOf = (r) => { const d = r?.diff && DIFF_STYLE[r.diff]; return d ? { e: d.e, grad: r.map === 'hell' ? [...d.grad, '#ff3a1a'] : r.map === 'void' ? [...d.grad, '#7c4dff'] : d.grad } : null; };
export const prestigeOf = (r) => (r?.kind === 'dream' ? 1 + Math.max(0, DIFF_ORDER.indexOf(r.diff)) + (r.map === 'hell' ? 0.5 : r.map === 'void' ? 0.7 : 0) : r?.kind === 'record' ? 1 : 0);
const TIER_STEP = ['bronze', 'silver', 'gold', 'platinum', 'legend'];
const ach = (id, game, name, desc, tier, rule) => ({ id, game, name, desc, tier, rule });
function buildAch() {
  const A = [];
  // 순위 업적: 1위 → 상위 1% → 5% → 10% → 3위권 → 10위권 순서로 보인다
  const rankSet = (base, game, label, rule) => {
    A.push(ach(`${base}.r1`, game, `${label} 1위`, `${label} 순위표 1위에 오르기 (5명 이상 겨룬 순위표) · 1위인 동안 왕관 · 1위 칭호를 쓸 수 있어요`, 'legend', { ...rule, rank: 1, crown: true }));
    for (const [p, t] of [[1, 'legend'], [5, 'platinum'], [10, 'gold']]) A.push(ach(`${base}.p${p}`, game, `${label} 상위 ${p}%`, `${label} 순위표 상위 ${p}% 안에 들기 (${PCT_MIN[p]}명 이상 겨룬 순위표) · 그 자리에 있는 동안 메달이 붙어요`, t, { ...rule, pct: p }));
    A.push(ach(`${base}.r3`, game, `${label} 3위권`, `${label} 순위표 3위 안에 들기 (10명 이상 겨룬 순위표) `, 'platinum', { ...rule, rank: 3 }));
    A.push(ach(`${base}.r10`, game, `${label} 10위권`, `${label} 순위표 10위 안에 들기 (20명 이상 겨룬 순위표)`, 'silver', { ...rule, rank: 10 }));
  };
  // 드림 러너: 맵 × 난이도마다 순위 · 거리
  const STEP = { easy: [1000, 3000, 6000, 12000], hard: [800, 2000, 4000, 8000], extreme: [500, 1500, 3000, 6000], lightspeed: [500, 1200, 2500, 5000], beyond: [300, 800, 2000, 4000] };
  for (const [m, mn] of Object.entries(MAPS)) for (const [d, dn] of Object.entries(DIFF_NAMES)) {
    const base = `dr.${m}.${d}`, label = `${mn} ${dn}`;
    rankSet(base, 'dream-runner', label, { kind: 'dream', map: m, diff: d });
    STEP[d].forEach((v, i) => A.push(ach(`${base}.d${v}`, 'dream-runner', `${label} ${v.toLocaleString()}m`, `${label} 스피드전에서 ${v.toLocaleString()}m 달리기`, TIER_STEP[i], { kind: 'dreamDist', map: m, diff: d, value: v })));
  }
  [[1000, 'bronze'], [10000, 'silver'], [50000, 'gold'], [250000, 'platinum'], [1000000, 'legend']].forEach(([v, t]) => A.push(ach(`dr.stars.${v}`, 'dream-runner', `별 ${v.toLocaleString()}개 모으기`, `드림 러너에서 별을 모두 ${v.toLocaleString()}개 벌기`, t, { kind: 'starTotal', value: v })));
  // 기록판 게임
  for (const [g, c] of Object.entries(RECORD_GAMES)) for (const [b, bn] of Object.entries(c.boards)) {
    const base = `${g}.${b}`, label = `${GAMES[g].name} ${bn}`;
    rankSet(base, g, label, { kind: 'record', game: g, board: b });
    (c.over?.[b] || c.steps).forEach((v, i) => A.push(ach(`${base}.v${v}`, g, `${label} ${v.toLocaleString()}${c.over?.[b] && b === 'endless' ? '초' : c.unit}`, `${label}에서 ${v.toLocaleString()}${c.over?.[b] && b === 'endless' ? '초' : c.unit} 넘기기`, TIER_STEP[i + 1], { kind: 'recordVal', game: g, board: b, value: v })));
  }
  // 경기 수 · 승리: 모든 게임
  for (const [g, G] of Object.entries(GAMES)) {
    [[10, 'bronze'], [100, 'silver'], [500, 'gold'], [2000, 'platinum']].forEach(([v, t]) => A.push(ach(`${g}.play${v}`, g, `${G.name} ${v.toLocaleString()}판`, `${G.name}을 ${v.toLocaleString()}판 하기`, t, { kind: 'plays', game: g, value: v })));
    if (g === 'dream-runner') continue;
    [[1, 'bronze'], [10, 'silver'], [50, 'gold'], [200, 'platinum'], [1000, 'legend']].forEach(([v, t]) => A.push(ach(`${g}.win${v}`, g, `${G.name} ${v.toLocaleString()}승`, `${G.name}에서 ${v.toLocaleString()}번 이기기`, t, { kind: 'wins', game: g, value: v })));
    [[1, 'silver'], [25, 'gold'], [100, 'platinum'], [500, 'legend']].forEach(([v, t]) => A.push(ach(`${g}.pvp${v}`, g, `${G.name} 대인전 ${v.toLocaleString()}승`, `다른 사람과 함께한 ${G.name}에서 ${v.toLocaleString()}번 이기기`, t, { kind: 'pvp', game: g, value: v })));
  }
  // 전체
  [[10, 'bronze'], [50, 'silver'], [150, 'gold'], [300, 'platinum'], [500, 'legend']].forEach(([v, t]) => A.push(ach(`all.count${v}`, 'all', `업적 수집가 ${v}`, `업적 ${v}개 달성하기`, t, { kind: 'count', value: v })));
  return A;
}
export const ACHIEVEMENTS = buildAch();
export const achById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
const gameColor = (a) => GAMES[a.game]?.color || '#ffc93c';
// 업적이 주는 아이템: 칭호는 모두 · 휘장은 금 이상 · 왕관은 1위만. 빛나는 정도는 등급을 따른다
function rewardItems() {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    const T = TIERS[a.tier], pr = a.rule.rank || a.rule.pct ? prestigeOf(a.rule) : 0, st = styleOf(a.rule), fx = { tier: T.n, color: gameColor(a), tierColor: T.color, glow: T.glow, rainbow: a.tier === 'legend', pr, ...(st ? { grad: st.grad, de: st.e } : {}) };
    out.push({ id: `title.${a.id}`, slot: 'title', name: a.name, emoji: st?.e || GAMES[a.game]?.emoji || '🏆', ach: a.id, rarity: a.tier, fx });
    if (T.n >= 3) out.push({ id: `sash.${a.id}`, slot: 'sash', name: `${a.name} 휘장`, emoji: '🎗️', ach: a.id, rarity: a.tier, fx });
    if (a.rule.crown) out.push({ id: `crown.${a.id}`, slot: 'crown', name: `${a.name} 왕관`, emoji: '👑', ach: a.id, rarity: 'legend', fx });
    // 메달: 열쇠 업적(1위 · 3위권 · 상위 %)을 가진 사람 중 지금 그 자리인 사람에게 붙는다
    const tail = a.id.slice(a.id.lastIndexOf('.') + 1), base = a.id.slice(0, a.id.lastIndexOf('.')), label = a.name.replace(/ (1위|3위권|상위 \d+%)$/, '');
    for (const [h, key, cond, em, nm] of MEDALS) if (key === tail) { const { rank, pct, crown, ...rest } = a.rule; out.push({ id: `medal.${base}.m${h}`, slot: 'medal', name: `${label} ${nm}`, emoji: em, ach: a.id, rule: { ...rest, ...cond }, rarity: ['legend', 'platinum', 'gold', 'legend', 'platinum', 'gold'][h], fx: { ...fx, honor: h }, auto: true }); }
  }
  return out;
}
export const ITEMS = [...SHOP, ...TOP3_TRAILS, ...rewardItems()];
export const itemById = new Map(ITEMS.map((i) => [i.id, i]));
// 착용 정보 다듬기: 없는 아이템 · 칸이 맞지 않는 것은 뺀다 (서버 · 브라우저 공용)
export function cleanCos(c) {
  if (!c || typeof c !== 'object') return null;
  const out = {}; for (const s of Object.keys(SLOTS)) { const id = c[s]; if (typeof id === 'string' && itemById.get(id)?.slot === s) out[s] = id; }
  return Object.keys(out).length ? out : null;
}
export const reqText = (r) => (r ? `${MAPS[r.map]} ${DIFF_NAMES[r.diff]}에서 ${r.dist.toLocaleString()}m 달성` : '');
