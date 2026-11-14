// ⏳ 시간 여행 맵: 빅뱅부터 미래까지 늘 같은 순서로 이어지는 시대들 (유일하게 랜덤이 아닌 맵)
//   데이터만 (three 없음) — 서버의 기록 다시 돌리기도 이 파일로 길을 만든다 (배역 이름 고르기가 길 씨앗을 쓰므로 양쪽이 같아야 한다)
//   when: 카드 연도 · tip: 한 줄 이야기 · ch: 장 번호
//   sky [위, 지평선, 아래] · fog [가까이, 멀리] · fx 알갱이 · mus [음계, 으뜸음, 빠르기, 음색]
//   ground [바탕, 둘째, 무늬, 빛, 반복m] · road [바탕, 테두리, 무늬, 빛] (time-world.js)
//   cast: 길 위 배역 — 역할마다 그 시대 모양 이름 (time-cast.js). 판정 크기는 역할마다 같다 (난이도 같음)
//     cross 건너는 것 · on 마주 오는 것 · big 큰 것 · weave 흔들며 오는 빠른 것 · wall 옆으로 피할 것 · hurdle 뛰어넘을 것 · bar 숙여 지날 것
//   near · mid · far · skyK: 풍경 띠 (time-kits.js) · scenes: 살아 움직이는 장면 (중간 띠)
export const TIME_W = 9;
export const CHAPTERS = ['', '우주', '지구와 생명', '공룡', '인류', '고대 문명', '중세', '근대', '현대', '미래'];

const t = (name, emoji, when, tip, ch, o) => ({ name, emoji, when, tip, ch, time: true, fog: [40, 330], stars: 0, light: 1, fx: 'none', under: 'void', style: 'plain', plat: [o.road?.[0] || '#8d6e63', o.road?.[1] || '#5d4037'], edge: o.road?.[1], ...o });
const m = (scale, root, bpm, wave) => [scale, root, bpm, wave];

// 장마다 기본 배역 (시대가 따로 정하지 않은 역할)
const COSMIC = { cross: ['quark', 'photon'], on: ['plasmaBlob'], big: ['cometHead'], weave: ['spark'], wall: ['energyWall'], hurdle: ['plasmaRidge'], bar: ['lightBeam'] };
const SEA = { cross: ['trilobite'], on: ['jellyBloom'], big: ['rockArch'], weave: ['fishDart'], wall: ['coralWall'], hurdle: ['spongeRow'], bar: ['kelpArch'] };
const DINO = { cross: ['raptor'], on: ['ankylo'], big: ['sauropodLeg'], weave: ['compy'], wall: ['fernWall'], hurdle: ['logFallen'], bar: ['branchLow'] };
const STONE = { cross: ['hunter'], on: ['boar'], big: ['mammoth'], weave: ['wolf'], wall: ['boulderWall'], hurdle: ['logFallen'], bar: ['tuskArch'] };
const ANTIQ = { cross: ['peasant'], on: ['oxCart'], big: ['elephantWar'], weave: ['horseRider'], wall: ['crateWall'], hurdle: ['potRow'], bar: ['clothLine'] };
const MED = { cross: ['peasantMed'], on: ['horseCart'], big: ['siegeTower'], weave: ['knightHorse'], wall: ['haybale'], hurdle: ['barrelRow'], bar: ['bannerBar'] };
const MODERN = { cross: ['citizen'], on: ['carVintage'], big: ['tram'], weave: ['bicycleOld'], wall: ['barricade'], hurdle: ['crateRow'], bar: ['bannerBar'] };
const FUTURE = { cross: ['drone'], on: ['robotWalker'], big: ['mech'], weave: ['hoverBike'], wall: ['laserFence'], hurdle: ['cableRow'], bar: ['scanBeam'] };
const c = (base, o = {}) => ({ ...base, ...o });

export const TIMES = [
  // ===================== 제1장 우주 =====================
  t('빅뱅', '💥', '138억 년 전', '아무것도 없던 한 점에서 시간과 공간, 모든 것이 시작됐어요', 1, {
    sky: ['#ffb74d', '#fff3e0', '#ff8a65'], fog: [30, 260], light: 1.0, fx: 'rise', fxC: '#fff8e1', mus: m('lydian', 64, 132, 'sine'),
    ground: ['#e65100', '#ffcc80', 'plasma', 0.5, 18], road: ['#ffe0b2', '#ff6d00', 'light', 0.35],
    cast: c(COSMIC, { cross: ['photon', 'energyBall'], on: ['plasmaBlob'] }), near: ['plasmaPillar', 'energyShard', 'lightSeed'], mid: ['shockRing', 'plasmaPillar', 'energyShard'], far: ['bangCore', 'shockRing'], skyK: ['lightSeed'], scenes: ['bangBurst'],
    P: { a: '#ff9100', b: '#fff8e1', c: '#ff4081', g: '#ffffff' } }),
  t('급팽창', '🌀', '빅뱅 후 10⁻³²초', '눈 깜빡할 새보다 짧은 순간, 우주가 엄청나게 부풀어 올랐어요', 1, {
    sky: ['#3d1a78', '#ff6fd8', '#22104a'], fog: [30, 300], light: 1.1, stars: 0.4, fx: 'sparkles', fxC: '#ffd6ff', mus: m('whole', 60, 140, 'sine'),
    ground: ['#2a1050', '#ff6fd8', 'circuit', 0.6, 10], road: ['#ff9ff3', '#ffffff', 'light', 0.8],
    cast: c(COSMIC, { cross: ['quantumBubble', 'photon'], on: ['bubbleCluster'] }), near: ['gridNode', 'quantumBubble'], mid: ['gridTower', 'quantumBubble', 'stretchRing'], far: ['gridTower', 'stretchRing'], skyK: ['quantumBubble'], scenes: ['inflateBubble'],
    P: { a: '#ff6fd8', b: '#7c4dff', c: '#00e5ff', g: '#ffffff' } }),
  t('쿼크 수프', '🍲', '빅뱅 후 백만분의 1초', '뜨거운 수프 속에서 쿼크와 글루온이 끓어올랐어요', 1, {
    sky: ['#4a0e2e', '#ff5252', '#2a0716'], fog: [20, 260], light: 1, stars: 0.2, fx: 'embers', fxC: '#ff8a65', mus: m('dorian', 55, 124, 'triangle'),
    ground: ['#5a0f2a', '#ff7043', 'plasma', 0.5, 12], road: ['#ffab91', '#ff1744', 'light', 0.6],
    cast: c(COSMIC, { cross: ['quarkTrio', 'quark'], on: ['gluonBall'], weave: ['quark'] }), near: ['quarkGlob', 'soupBubble'], mid: ['gluonString', 'quarkGlob', 'soupBubble'], far: ['soupGeyser'], skyK: ['quarkGlob'], scenes: ['quarkDance'],
    P: { a: '#ff1744', b: '#00e676', c: '#2979ff', g: '#ffd740' } }),
  t('최초의 원자핵', '⚛️', '빅뱅 후 3분', '양성자와 중성자가 처음으로 뭉쳐 헬륨 원자핵이 생겼어요', 1, {
    sky: ['#3e1f00', '#ffb74d', '#2a1500'], fog: [30, 280], light: 1.1, stars: 0.2, fx: 'sparkles', fxC: '#ffe0b2', mus: m('major', 57, 116, 'triangle'),
    ground: ['#4e2a00', '#ffb74d', 'plasma', 0.4, 14], road: ['#ffe0b2', '#ff6d00', 'light', 0.6],
    cast: c(COSMIC, { cross: ['proton', 'neutron'], on: ['heliumNucleus'], weave: ['neutron'] }), near: ['nucleonPair', 'fusionFlash'], mid: ['nucleusBig', 'nucleonPair'], far: ['nucleusBig', 'fusionGlow'], skyK: ['fusionFlash'], scenes: ['fusionDance'],
    P: { a: '#ff5252', b: '#90caf9', c: '#ffd740', g: '#ffffff' } }),
  t('우주의 첫 빛', '✨', '38만 년 뒤', '전자가 원자핵에 붙어 수소 원자가 되자, 안개가 걷히고 빛이 처음 멀리 날아갔어요', 1, {
    sky: ['#0d1b3e', '#ff9e80', '#08122a'], fog: [40, 340], light: 1, stars: 0.6, fx: 'sparkles', fxC: '#ffccbc', mus: m('lydian', 62, 96, 'sine'),
    ground: ['#10203f', '#ff9e80', 'nebula', 0.3, 20], road: ['#ffccbc', '#ff6e40', 'light', 0.5],
    cast: c(COSMIC, { cross: ['electron', 'photon'], on: ['hAtom'], big: ['heAtomBig'] }), near: ['hAtomSmall', 'lightSeed'], mid: ['hAtomBig', 'cmbPatch'], far: ['hAtomBig', 'fogWall'], skyK: ['lightSeed'], scenes: ['electronCapture'],
    P: { a: '#ff6e40', b: '#82b1ff', c: '#ffffff', g: '#ffd180' } }),
  t('우주 암흑시대', '🌑', '수억 년 동안', '별이 하나도 없는 어둠 속에서 수소 구름이 천천히 뭉쳤어요', 1, {
    sky: ['#000000', '#0b0a1a', '#000000'], fog: [20, 220], light: 0.45, stars: 0.05, fx: 'dust', fxC: '#5c6bc0', mus: m('dim', 41, 80, 'sine'),
    ground: ['#05050d', '#1a237e', 'nebula', 0.2, 24], road: ['#3949ab', '#8c9eff', 'light', 0.5],
    cast: c(COSMIC, { cross: ['darkWisp'], on: ['hCloud'], weave: ['darkWisp'] }), near: ['darkStrand', 'faintGlow'], mid: ['hCloudBig', 'darkStrand'], far: ['darkWeb'], skyK: ['faintGlow'], scenes: ['cloudCollapse'],
    P: { a: '#8c9eff', b: '#1a237e', c: '#311b92', g: '#c5cae9' } }),
  t('최초의 별', '⭐', '1억~2억 년 뒤', '태양보다 수백 배 큰 푸른 별들이 처음 켜져 우주를 밝혔어요', 1, {
    sky: ['#020a2a', '#2962ff', '#010518'], fog: [40, 340], light: 1.1, stars: 0.5, fx: 'sparkles', fxC: '#82b1ff', mus: m('lydian', 64, 104, 'sine'),
    ground: ['#06123a', '#448aff', 'nebula', 0.4, 20], road: ['#bbdefb', '#2979ff', 'light', 0.7],
    cast: c(COSMIC, { cross: ['photon', 'starlet'], on: ['plasmaBlob'] }), near: ['starlet', 'ionBubble'], mid: ['ionBubble', 'starBeam'], far: ['firstStar', 'starBeam'], skyK: ['starlet'], scenes: ['starIgnite'],
    P: { a: '#2979ff', b: '#e3f2fd', c: '#00e5ff', g: '#ffffff' } }),
  t('초신성', '🌟', '첫 별들의 마지막', '거대한 별이 폭발하며 철 · 금 · 탄소 같은 무거운 원소를 우주에 뿌렸어요', 1, {
    sky: ['#1a0030', '#ff3d00', '#0d0018'], fog: [30, 300], light: 1.2, stars: 0.4, fx: 'embers', fxC: '#ffab40', mus: m('minor', 52, 140, 'sawtooth'),
    ground: ['#2a0a2a', '#ff6d00', 'nebula', 0.4, 18], road: ['#ffd180', '#ff3d00', 'light', 0.7],
    cast: c(COSMIC, { cross: ['elementShard'], on: ['shockBlob'], big: ['cometHead'], weave: ['spark'] }), near: ['elementCrystal', 'goldNugget'], mid: ['nebulaShell', 'elementCrystal'], far: ['supernova', 'nebulaShell'], skyK: ['spark'], scenes: ['novaBlast'],
    P: { a: '#ff6d00', b: '#ffd740', c: '#e040fb', g: '#ffffff' } }),
  t('최초의 분자', '🔗', '빅뱅 후 수십만 년', '헬륨과 수소가 손을 잡은 수소화헬륨(HeH⁺)이 우주 최초의 분자예요', 1, {
    sky: ['#04242a', '#1de9b6', '#02161a'], fog: [30, 300], light: 1, stars: 0.4, fx: 'bubbles', fxC: '#a7ffeb', mus: m('pent', 60, 108, 'triangle'),
    ground: ['#05282e', '#1de9b6', 'nebula', 0.3, 18], road: ['#a7ffeb', '#00bfa5', 'light', 0.6],
    cast: c(COSMIC, { cross: ['moleculeS'], on: ['moleculeBig'], weave: ['electron'] }), near: ['moleculeS', 'waterMol'], mid: ['moleculeTall', 'molCloud'], far: ['molCloud'], skyK: ['moleculeS'], scenes: ['molBond'],
    P: { a: '#1de9b6', b: '#ff8a80', c: '#82b1ff', g: '#ffffff' } }),
  t('최초의 은하', '🌌', '134억 년 전', '별들이 모여 소용돌이치는 첫 은하들이 태어나고 서로 부딪혔어요', 1, {
    sky: ['#05001a', '#4a148c', '#020010'], fog: [40, 360], light: 0.9, stars: 1, fx: 'sparkles', fxC: '#e1bee7', mus: m('lydian', 59, 92, 'sine'),
    ground: ['#0a0326', '#7c4dff', 'nebula', 0.4, 22], road: ['#d1c4e9', '#b388ff', 'light', 0.6],
    cast: c(COSMIC, { cross: ['starlet'], on: ['starCluster'], big: ['cometHead'] }), near: ['starlet', 'starCluster'], mid: ['quasarJet', 'starCluster'], far: ['galaxyDisc', 'quasarJet'], skyK: ['galaxySmall'], scenes: ['galaxyMerge'],
    P: { a: '#b388ff', b: '#ffd180', c: '#80d8ff', g: '#ffffff' } }),
  t('우리은하', '🌠', '약 136억 ~ 100억 년 전', '은하수가 자라 가운데 거대한 블랙홀을 품은 나선 은하가 됐어요', 1, {
    sky: ['#03001a', '#311b92', '#010010'], fog: [40, 360], light: 0.85, stars: 1, fx: 'sparkles', fxC: '#ffffff', mus: m('dorian', 57, 88, 'sine'),
    ground: ['#060322', '#5e35b1', 'nebula', 0.35, 22], road: ['#c5cae9', '#7986cb', 'light', 0.6],
    cast: c(COSMIC, { cross: ['starlet'], on: ['globular'], big: ['cometHead'] }), near: ['starlet', 'globular'], mid: ['globular', 'armDust'], far: ['blackHoleBig', 'milkyArm'], skyK: ['galaxySmall'], scenes: ['orbitStars'],
    P: { a: '#7986cb', b: '#ffd180', c: '#ff8a80', g: '#ffffff' } }),
  t('태양의 요람', '☁️', '46억 년 전', '거대한 성운 기둥 속에서 가스와 먼지가 뭉쳐 새 별들이 자라났어요', 1, {
    sky: ['#0b1a2a', '#ff8a65', '#06101a'], fog: [30, 320], light: 0.95, stars: 0.5, fx: 'dust', fxC: '#ffccbc', mus: m('minor', 55, 84, 'triangle'),
    ground: ['#13212e', '#ff8a65', 'nebula', 0.3, 20], road: ['#ffe0b2', '#ff7043', 'light', 0.5],
    cast: c(COSMIC, { cross: ['dustBall'], on: ['protostarBall'], big: ['cometHead'] }), near: ['dustBall', 'protostarBall'], mid: ['nebulaPillar', 'protostarBall'], far: ['nebulaPillar'], skyK: ['starlet'], scenes: ['gasSwirl'],
    P: { a: '#ff7043', b: '#4db6ac', c: '#ffd54f', g: '#ffffff' } }),
  t('태양의 탄생', '☀️', '46억 년 전', '가스 구름 한가운데에서 우리의 태양이 불을 켰어요', 1, {
    sky: ['#3e1000', '#ffab00', '#200800'], fog: [40, 330], light: 1.3, stars: 0.3, sun: '#fff3c4', fx: 'embers', fxC: '#ffd54f', mus: m('major', 60, 112, 'triangle'),
    ground: ['#4a1600', '#ffab00', 'plasma', 0.5, 18], road: ['#fff3c4', '#ff6d00', 'light', 0.7],
    cast: c(COSMIC, { cross: ['flareBall'], on: ['plasmaBlob'], big: ['cometHead'], weave: ['spark'] }), near: ['flareLoop', 'dustBall'], mid: ['flareLoop', 'diskRock'], far: ['protoSun'], skyK: ['dustRing'], scenes: ['solarFlare'],
    P: { a: '#ff6d00', b: '#ffd740', c: '#ff3d00', g: '#ffffff' } }),
  t('원시 행성 충돌', '🪨', '45억 년 전', '태양 둘레의 바윗덩이들이 부딪히고 뭉치며 행성이 자랐어요', 1, {
    sky: ['#0d0d1a', '#795548', '#05050a'], fog: [30, 320], light: 0.95, stars: 0.6, fx: 'dust', fxC: '#bcaaa4', mus: m('dorian', 50, 120, 'sawtooth'),
    ground: ['#2a2420', '#8d6e63', 'rock', 0, 9], road: ['#a1887f', '#ff7043', 'stone', 0],
    cast: c(COSMIC, { cross: ['pebbleRoll'], on: ['asteroidRoll'], big: ['planetesimal'], weave: ['spark'], wall: ['rockWall'], hurdle: ['rockRow'], bar: ['rockArchBar'] }), near: ['rockCluster', 'craterSmall'], mid: ['planetesimal', 'rockCluster'], far: ['protoPlanet', 'crashFlash'], skyK: ['asteroidSky'], scenes: ['rockCrash'],
    P: { a: '#8d6e63', b: '#ff7043', c: '#5d4037', g: '#ffccbc' } }),
];

// 역할마다 그 시대 배역 하나 (길 씨앗 r 를 한 번 쓴다 — 서버 · 브라우저가 같다)
export const ROLES = ['cross', 'on', 'big', 'weave', 'wall', 'hurdle', 'bar'];
const DEF = { cross: COSMIC.cross, on: COSMIC.on, big: COSMIC.big, weave: COSMIC.weave, wall: COSMIC.wall, hurdle: COSMIC.hurdle, bar: COSMIC.bar };
export function timeCast(th, role, r) { const L = th.cast?.[role] || DEF[role]; return r.pick(L); }
// 부딪혔을 때 이름 (없으면 '시대의 무언가')
export const CAST_NAMES = {
  quark: '쿼크', photon: '광자', energyBall: '에너지 덩어리', plasmaBlob: '플라스마', cometHead: '혜성', spark: '빛 조각', energyWall: '에너지 벽', plasmaRidge: '플라스마 둔덕', lightBeam: '빛줄기',
  quantumBubble: '양자 거품', bubbleCluster: '거품 우주', quarkTrio: '쿼크 세 알', gluonBall: '글루온 덩어리', proton: '양성자', neutron: '중성자', heliumNucleus: '헬륨 원자핵',
  electron: '전자', hAtom: '수소 원자', heAtomBig: '헬륨 원자', darkWisp: '암흑물질', hCloud: '수소 구름', starlet: '아기 별', elementShard: '원소 조각', shockBlob: '충격파',
  moleculeS: '분자', moleculeBig: '수소화헬륨 분자', starCluster: '별 무리', globular: '구상성단', dustBall: '먼지 덩어리', protostarBall: '원시별', flareBall: '태양 불꽃',
  pebbleRoll: '자갈', asteroidRoll: '소행성', planetesimal: '미행성', rockWall: '바위 벽', rockRow: '돌무더기', rockArchBar: '바위 다리',
};
const jong = (w) => { const ch = w.charCodeAt(w.length - 1); return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 > 0; };
export const castHit = (kind) => { const n = CAST_NAMES[kind] || '시대의 무언가'; return `${n}${jong(n) ? '과' : '와'} 부딪혔어요`; };
