// ⏳ 시간 여행 맵: 빅뱅부터 미래까지 늘 같은 순서로 이어지는 시대들 (유일하게 랜덤이 아닌 맵)
//   데이터만 (three 없음) — 서버의 기록 다시 돌리기도 이 파일로 길을 만든다 (배역 이름 고르기가 길 씨앗을 쓰므로 양쪽이 같아야 한다)
//   when: 카드 연도 · tip: 한 줄 이야기 · ch: 장 번호
//   sky [위, 지평선, 아래] · fog [가까이, 멀리] · fx 알갱이 · mus [음계, 으뜸음, 빠르기, 음색]
//   ground [바탕, 둘째, 무늬, 빛, 반복m] · road [바탕, 테두리, 무늬, 빛] (time-world.js)
//   cast: 길 위 배역 — 역할마다 그 시대 모양 이름 (time-cast.js). 판정 크기는 역할마다 같다 (난이도 같음)
//     cross 건너는 것 · on 마주 오는 것 · big 큰 것 · weave 흔들며 오는 빠른 것 · wall 옆으로 피할 것 · hurdle 뛰어넘을 것 · bar 숙여 지날 것
//   near · mid · far · skyK: 풍경 띠 (time-kits.js) · scenes: 살아 움직이는 장면 (중간 띠)
import { MORE_NAMES } from './times-names.js';
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

  // ===================== 제2장 지구와 생명 =====================
  t('지구의 탄생', '🌋', '45억 4천만 년 전', '갓 태어난 지구는 온통 끓는 마그마 바다였어요', 2, {
    sky: ['#2a0800', '#ff5722', '#1a0500'], fog: [30, 300], light: 1.05, fx: 'embers', fxC: '#ff8a50', mus: m('phryg', 45, 120, 'sawtooth'), lightning: true,
    ground: ['#3a0d00', '#ff6d00', 'lava', 0.55, 12], road: ['#5d4037', '#ff6d00', 'stone', 0],
    cast: { cross: ['lavaBlob'], on: ['magmaRock'], big: ['lavaWave'], weave: ['fireball'], wall: ['basaltWall'], hurdle: ['lavaCrack'], bar: ['ashArch'] },
    near: ['lavaPool', 'basaltCol', 'steamVent'], mid: ['volcanoS', 'lavaFountain', 'basaltCol'], far: ['volcanoBig', 'volcanoBig'], skyK: ['meteorSky'], scenes: ['lavaBurst'],
    P: { a: '#ff6d00', b: '#ffd180', c: '#3e2723', rock: '#4e342e' } }),
  t('달의 탄생', '🌕', '45억 년 전', '화성만 한 행성 테이아가 지구에 부딪혀, 튕겨 나간 조각들이 뭉쳐 달이 됐어요', 2, {
    sky: ['#0a0614', '#8d6e63', '#050308'], fog: [40, 360], light: 0.95, stars: 0.7, fx: 'embers', fxC: '#ffab91', mus: m('minor', 48, 100, 'sine'),
    ground: ['#2b1a12', '#ff7043', 'lava', 0.35, 14], road: ['#6d4c41', '#ffab91', 'stone', 0],
    cast: { cross: ['debrisRock'], on: ['magmaRock'], big: ['moonChunk'], weave: ['fireball'], wall: ['basaltWall'], hurdle: ['lavaCrack'], bar: ['ashArch'] },
    near: ['basaltCol', 'craterSmall', 'lavaPool'], mid: ['debrisPile', 'volcanoS'], far: ['bigMoonRise', 'theiaImpact'], skyK: ['debrisRing'], scenes: ['debrisFall'],
    P: { a: '#ff7043', b: '#d7ccc8', c: '#4e342e', rock: '#5d4037' } }),
  t('바다의 탄생', '🌧️', '44억 년 전', '수백만 년 동안 비가 내려 처음으로 바다가 생겼어요', 2, {
    sky: ['#263238', '#607d8b', '#1c262b'], fog: [20, 240], light: 0.75, fx: 'rain', fxC: '#b0bec5', mus: m('dorian', 50, 92, 'sine'), lightning: true,
    ground: ['#1e4a5a', '#4f8fa5', 'water', 0.1, 10], road: ['#455a64', '#90a4ae', 'stone', 0],
    cast: { cross: ['steamPuff'], on: ['waveRoll'], big: ['lavaWave'], weave: ['rainDrop'], wall: ['basaltWall'], hurdle: ['puddleRidge'], bar: ['stormCloudBar'] },
    near: ['basaltCol', 'steamVent', 'tidePool'], mid: ['volcanoIsland', 'steamVent'], far: ['volcanoIsland', 'stormCloud'], skyK: ['stormCloud'], scenes: ['lightningStrike'],
    P: { a: '#4f8fa5', b: '#cfd8dc', c: '#37474f', rock: '#37474f' } }),
  t('운석 대충돌기', '☄️', '41억~38억 년 전', '하늘에서 운석이 비처럼 쏟아져 땅 곳곳에 구덩이를 남겼어요', 2, {
    sky: ['#1a0f0a', '#bf360c', '#0d0805'], fog: [30, 300], light: 0.9, stars: 0.4, fx: 'ash', fxC: '#ffab91', mus: m('phryg', 43, 132, 'sawtooth'),
    ground: ['#3e2723', '#6d4c41', 'moon', 0, 10], road: ['#5d4037', '#ff7043', 'stone', 0],
    cast: { cross: ['debrisRock'], on: ['meteorRoll'], big: ['moonChunk'], weave: ['fireball'], wall: ['rockWall'], hurdle: ['rockRow'], bar: ['ashArch'] },
    near: ['craterSmall', 'meteorite', 'rockCluster'], mid: ['craterBig', 'meteorite'], far: ['craterRim'], skyK: ['meteorSky'], scenes: ['meteorStrike'],
    P: { a: '#ff7043', b: '#ffccbc', c: '#3e2723', rock: '#5d4037' } }),
  t('최초의 생명', '🦠', '38억 년 전', '깊은 바닷속 뜨거운 굴뚝 곁에서 아주 작은 첫 생명이 꿈틀댔어요', 2, {
    sky: ['#00121f', '#004d66', '#000a12'], fog: [14, 170], light: 0.6, fx: 'bubbles', fxC: '#80deea', mus: m('whole', 52, 76, 'sine'),
    ground: ['#0d2a33', '#1f4f5c', 'seabed', 0.05, 9], road: ['#263f47', '#4dd0e1', 'moss', 0.15],
    cast: { cross: ['microbe'], on: ['microbeBlob'], big: ['ventChimneyRoll'], weave: ['microbe'], wall: ['ventWall'], hurdle: ['ventRidge'], bar: ['smokerArch'] },
    near: ['microbeMat', 'ventSmall', 'bubbleCol'], mid: ['blackSmoker', 'ventSmall', 'rnaStrand'], far: ['blackSmoker'], skyK: [], scenes: ['microbeSwarm'],
    P: { a: '#4dd0e1', b: '#80cbc4', c: '#263238', rock: '#37474f' } }),
  t('스트로마톨라이트', '🪸', '35억 년 전', '얕은 바다의 남세균이 층층이 쌓여 바위가 되고, 산소를 내뿜기 시작했어요', 2, {
    sky: ['#ff8a65', '#ffccbc', '#e0a080'], fog: [40, 330], light: 1.05, sun: '#fff3e0', fx: 'bubbles', fxC: '#e0f7fa', mus: m('pent', 57, 88, 'triangle'),
    ground: ['#6aa7a0', '#a8d5c8', 'water', 0.05, 10], road: ['#c2a878', '#8d7350', 'sand', 0],
    cast: { cross: ['o2Bubble'], on: ['stromaRoll'], big: ['waveRoll'], weave: ['o2Bubble'], wall: ['stromaWall'], hurdle: ['stromaRow'], bar: ['wavebar'] },
    near: ['stromatolite', 'stromatolite', 'tidePool'], mid: ['stromatolite', 'stromaField'], far: ['volcanoIsland'], skyK: [], scenes: ['o2Rise'],
    P: { a: '#8d7350', b: '#c8e6c9', c: '#5d7d6a', rock: '#8d7350' } }),
  t('대산화 사건', '🔴', '24억 년 전', '산소가 넘쳐 하늘이 파래지고, 바위 속 철이 붉게 녹슬었어요', 2, {
    sky: ['#4a90d9', '#bfe3ff', '#e2b39a'], fog: [40, 330], light: 1.1, sun: '#ffffff', fx: 'bubbles', fxC: '#ffffff', mus: m('major', 60, 100, 'triangle'),
    ground: ['#a0522d', '#c8763c', 'rock', 0, 8], road: ['#d7a07a', '#8b3a1a', 'stone', 0],
    cast: { cross: ['o2Bubble'], on: ['rustBoulder'], big: ['ironBandRoll'], weave: ['o2Bubble'], wall: ['ironBandWall'], hurdle: ['rockRow'], bar: ['ironArch'] },
    near: ['ironBandRock', 'stromatolite', 'rockCluster'], mid: ['ironBandCliff', 'stromaField'], far: ['ironBandCliff'], skyK: [], scenes: ['o2Rise'],
    P: { a: '#c8763c', b: '#ffffff', c: '#8b3a1a', rock: '#a0522d' } }),
  t('눈덩이 지구', '❄️', '7억 년 전', '적도까지 꽁꽁 얼어, 지구가 커다란 눈덩이처럼 하얘졌어요', 2, {
    sky: ['#9fc6e8', '#eef6ff', '#dbe9f5'], fog: [30, 280], light: 1.1, sun: '#ffffff', fx: 'snow', fxC: '#ffffff', mus: m('lydian', 64, 84, 'sine'),
    ground: ['#e8f4ff', '#c9e2f5', 'snow', 0, 12], road: ['#cfe8fa', '#7fb3d9', 'ice', 0],
    cast: { cross: ['snowBall'], on: ['iceBlock'], big: ['icebergRoll'], weave: ['iceShard'], wall: ['iceWall'], hurdle: ['snowDrift'], bar: ['icicleArch'] },
    near: ['iceSpikeT', 'snowMound', 'iceCrack'], mid: ['iceSpikeT', 'glacierBlock', 'iceVolcano'], far: ['glacierWall', 'iceVolcano'], skyK: [], scenes: ['iceCrumble'],
    P: { a: '#7fb3d9', b: '#ffffff', c: '#b3d4f0', rock: '#90a4ae' } }),
  t('에디아카라 정원', '🌿', '5억 7천만 년 전', '바다 밑에 잎사귀처럼 생긴 신기한 생물들이 정원처럼 자랐어요', 2, {
    sky: ['#003040', '#2a8a9a', '#001a24'], fog: [14, 180], light: 0.75, fx: 'bubbles', fxC: '#b2ebf2', mus: m('pent', 55, 80, 'sine'),
    ground: ['#3f6b5f', '#7aa58f', 'seabed', 0, 8], road: ['#c8b98a', '#7a6a45', 'sand', 0],
    cast: c(SEA, { cross: ['dickinsonia'], on: ['jellyBloom'], weave: ['spriggina'], wall: ['frondWall'], hurdle: ['frondRow'], bar: ['kelpArch'] }),
    near: ['charnia', 'dickinsoniaMat', 'spongeT'], mid: ['charnia', 'charniaTall', 'spongeT'], far: ['seaRidge'], skyK: [], scenes: ['frondSway'],
    P: { a: '#7aa58f', b: '#ffccbc', c: '#4db6ac', rock: '#5d6d64' } }),
  t('캄브리아기 대폭발', '🦐', '5억 4천만 년 전', '눈과 껍데기를 가진 동물들이 한꺼번에 나타났어요. 삼엽충, 아노말로카리스…', 2, {
    sky: ['#00334d', '#2f9fbf', '#001d2b'], fog: [14, 190], light: 0.8, fx: 'bubbles', fxC: '#b3e5fc', mus: m('dorian', 57, 112, 'triangle'),
    ground: ['#4a6a6a', '#86a5a0', 'seabed', 0, 8], road: ['#cdbf95', '#7a6a45', 'sand', 0],
    cast: c(SEA, { cross: ['trilobite'], on: ['anomalocaris'], big: ['rockArch'], weave: ['opabinia'], wall: ['spongeWall'], hurdle: ['spongeRow'], bar: ['kelpArch'] }),
    near: ['trilobiteT', 'hallucigenia', 'spongeT'], mid: ['anomalocarisSwim', 'spongeT', 'wiwaxia'], far: ['seaRidge'], skyK: [], scenes: ['anomaloHunt'],
    P: { a: '#86a5a0', b: '#ff8a65', c: '#26a69a', rock: '#5d6d64' } }),
  t('최초의 어류', '🐟', '4억 8천만 년 전', '턱도 없는 작은 물고기가 처음으로 등뼈를 가지고 헤엄쳤어요', 2, {
    sky: ['#003a57', '#3aa0c8', '#00213a'], fog: [14, 190], light: 0.85, fx: 'bubbles', fxC: '#e1f5fe', mus: m('pent', 60, 104, 'sine'),
    ground: ['#3f6a73', '#80a8ad', 'seabed', 0, 8], road: ['#d1c59c', '#7a6a45', 'sand', 0],
    cast: c(SEA, { cross: ['jawlessFish'], on: ['nautiloid'], weave: ['fishDart'] }),
    near: ['crinoid', 'spongeT', 'shellPile'], mid: ['crinoid', 'nautiloidSwim', 'fishSchoolT'], far: ['seaRidge'], skyK: [], scenes: ['fishSchoolSwirl'],
    P: { a: '#80a8ad', b: '#ffcc80', c: '#4fc3f7', rock: '#5d6d64' } }),
  t('최초의 육상 식물', '🌱', '4억 7천만 년 전', '이끼와 작은 풀이 처음으로 맨땅 위로 올라왔어요', 2, {
    sky: ['#6ea8d8', '#d8ecf5', '#a6b8a0'], fog: [40, 320], light: 1.0, sun: '#ffffff', fx: 'dust', fxC: '#e0f2f1', mus: m('major', 62, 92, 'triangle'),
    ground: ['#6b6a5a', '#8a9a6a', 'moss', 0, 8], road: ['#8d7a5a', '#556b2f', 'moss', 0],
    cast: { cross: ['sporeBall'], on: ['mossBoulder'], big: ['waveRoll'], weave: ['sporeBall'], wall: ['rockWall'], hurdle: ['mossRow'], bar: ['cooksoniaArch'] },
    near: ['cooksonia', 'mossClump', 'liverwort'], mid: ['cooksonia', 'mossRock', 'tidePool'], far: ['bareHills'], skyK: [], scenes: ['sporeDrift'],
    P: { a: '#7cb342', b: '#dcedc8', c: '#558b2f', rock: '#78786a' } }),
  t('바다전갈의 바다', '🦂', '4억 3천만 년 전', '몸길이가 2미터 넘는 바다전갈이 산호초 사이를 누볐어요', 2, {
    sky: ['#00334a', '#2b8fb0', '#001c2b'], fog: [14, 190], light: 0.8, fx: 'bubbles', fxC: '#b2ebf2', mus: m('phryg', 50, 116, 'triangle'),
    ground: ['#47665f', '#7fa094', 'seabed', 0, 8], road: ['#cbbd90', '#7a6a45', 'sand', 0],
    cast: c(SEA, { cross: ['trilobite'], on: ['seaScorpion'], weave: ['fishDart'], wall: ['coralWall'] }),
    near: ['coralT', 'crinoid', 'shellPile'], mid: ['coralReef', 'seaScorpionT', 'crinoid'], far: ['seaRidge'], skyK: [], scenes: ['scorpionStalk'],
    P: { a: '#7fa094', b: '#ff8a80', c: '#4db6ac', rock: '#5d6d64' } }),
  t('어류의 시대', '🦈', '3억 8천만 년 전', '갑옷을 두른 거대 물고기 둔클레오스테우스와 첫 상어들이 바다를 다스렸어요', 2, {
    sky: ['#002a40', '#1f7fa3', '#001624'], fog: [14, 200], light: 0.75, fx: 'bubbles', fxC: '#b3e5fc', mus: m('minor', 45, 124, 'sawtooth'),
    ground: ['#3c5a5a', '#6f9090', 'seabed', 0, 8], road: ['#c4b48a', '#6a5a35', 'sand', 0],
    cast: c(SEA, { cross: ['jawlessFish'], on: ['dunkleosteus'], big: ['sharkBig'], weave: ['sharkSmall'], wall: ['coralWall'] }),
    near: ['coralT', 'crinoid', 'ammonite'], mid: ['dunkleSwim', 'coralReef', 'coelacanth'], far: ['seaRidge'], skyK: [], scenes: ['sharkCircle'],
    P: { a: '#6f9090', b: '#ffab91', c: '#4fc3f7', rock: '#4f5f5a' } }),
  t('물 밖으로', '🐸', '3억 7천5백만 년 전', '지느러미에 뼈가 있는 물고기 틱타알릭이 처음으로 물가로 기어 올라왔어요', 2, {
    sky: ['#7fb2d6', '#e3f0e8', '#9fb39a'], fog: [30, 300], light: 1.0, sun: '#fffde7', fx: 'dust', fxC: '#e0f2f1', mus: m('dorian', 55, 96, 'triangle'),
    ground: ['#4f6a4a', '#6f8f5a', 'mud', 0, 8], road: ['#7a6a4a', '#4a5a3a', 'moss', 0],
    cast: { cross: ['tiktaalik'], on: ['lungfish'], big: ['logRoll'], weave: ['tiktaalik'], wall: ['fernWall'], hurdle: ['logFallen'], bar: ['branchLow'] },
    near: ['shallowPool', 'archaeopteris', 'mossClump'], mid: ['archaeopteris', 'shallowPool', 'tiktaalikT'], far: ['archForest'], skyK: [], scenes: ['crawlOut'],
    P: { a: '#6f8f5a', b: '#c5e1a5', c: '#33691e', rock: '#6d6d5a', leaf: '#4c7a2e', wood: '#5d4037' } }),
  t('석탄기 거대 숲', '🪰', '3억 2천만 년 전', '산소가 많아 날개 70cm 잠자리와 2m 노래기가 거대한 고사리 숲을 누볐어요', 2, {
    sky: ['#4a6a3a', '#a8c890', '#2a3a20'], fog: [16, 210], light: 0.85, fx: 'dust', fxC: '#dcedc8', mus: m('dorian', 52, 104, 'triangle'),
    ground: ['#3a4a2a', '#5a6a3a', 'moss', 0, 8], road: ['#4e3f2a', '#2e3a1a', 'dirt', 0],
    cast: { cross: ['millipede'], on: ['arthropleura'], big: ['logRoll'], weave: ['meganeura'], wall: ['fernWall'], hurdle: ['logFallen'], bar: ['branchLow'] },
    near: ['treeFern', 'horsetail', 'mossClump'], mid: ['lepidodendron', 'treeFern', 'meganeuraT'], far: ['lepidoForest'], skyK: ['meganeuraSky'], scenes: ['dragonflyZip'],
    P: { a: '#5a6a3a', b: '#c5e1a5', c: '#33691e', leaf: '#3d6b2a', wood: '#4e3a26', rock: '#4a4a3a' } }),
  t('최초의 파충류', '🦎', '3억 1천만 년 전', '단단한 껍데기 알을 낳는 힐로노무스가 나무 그루터기 속에서 살았어요', 2, {
    sky: ['#6a9ac0', '#d8ead8', '#8aa080'], fog: [20, 240], light: 0.95, sun: '#fffde7', fx: 'leaves', fxC: '#8bc34a', mus: m('major', 57, 100, 'triangle'),
    ground: ['#4a5a30', '#6a7a40', 'moss', 0, 8], road: ['#6a5a3a', '#3a4a2a', 'dirt', 0],
    cast: { cross: ['hylonomus'], on: ['arthropleura'], big: ['logRoll'], weave: ['hylonomus'], wall: ['stumpWall'], hurdle: ['logFallen'], bar: ['branchLow'] },
    near: ['treeStump', 'eggNest', 'horsetail'], mid: ['lepidodendron', 'treeStump', 'treeFern'], far: ['lepidoForest'], skyK: ['meganeuraSky'], scenes: ['lizardScurry'],
    P: { a: '#6a7a40', b: '#fff8e1', c: '#558b2f', leaf: '#4c7a2e', wood: '#5d4037', rock: '#5a5a48' } }),
  t('페름기 대멸종', '💀', '2억 5천2백만 년 전', '시베리아 화산이 백만 년 동안 불을 뿜어, 생물 대부분이 사라졌어요', 2, {
    sky: ['#2a1a14', '#8a4a2a', '#140a08'], fog: [16, 200], light: 0.7, fx: 'ash', fxC: '#bcaaa4', mus: m('dim', 40, 72, 'sawtooth'),
    ground: ['#3a2a22', '#5a3a2a', 'ash', 0, 9], road: ['#4a3a30', '#ff5722', 'stone', 0],
    cast: { cross: ['ashPuff'], on: ['dimetrodon'], big: ['lavaWave'], weave: ['fireball'], wall: ['basaltWall'], hurdle: ['lavaCrack'], bar: ['deadBranchArch'] },
    near: ['deadTreeT', 'dimetroFossil', 'lavaPool'], mid: ['trapVolcano', 'deadTreeT', 'dimetrodonT'], far: ['trapVolcano', 'trapVolcano'], skyK: [], scenes: ['ashFall'],
    P: { a: '#ff5722', b: '#bcaaa4', c: '#3e2723', rock: '#3a2a22', wood: '#3a2a20' } }),

  // ===================== 제3장 공룡 =====================
  t('최초의 공룡', '🦖', '2억 3천만 년 전', '판게아의 메마른 땅에서 작고 날쌘 첫 공룡 에오랍토르가 나타났어요', 3, {
    sky: ['#e8a05a', '#ffe0b0', '#d0905a'], fog: [40, 330], light: 1.1, sun: '#fff3d6', fx: 'dust', fxC: '#ffe0b2', mus: m('major', 57, 112, 'triangle'),
    ground: ['#c8945a', '#d8a870', 'sand', 0, 10], road: ['#a87a4a', '#6a4a2a', 'dirt', 0],
    cast: c(DINO, { cross: ['eoraptor'], on: ['herrerasaurus'], big: ['rauisuchian'], weave: ['eoraptor'], wall: ['cycadWall'] }),
    near: ['cycad', 'conifer', 'dinoTracks'], mid: ['cycad', 'conifer', 'herreraT'], far: ['mesa', 'mesa'], skyK: [], scenes: ['raptorChase'],
    P: { a: '#d8a870', b: '#fff3e0', c: '#6a8a3a', leaf: '#5f8a3a', wood: '#6a4a2a', rock: '#b07a4a' } }),
  t('최초의 포유류', '🐭', '2억 2천5백만 년 전', '공룡을 피해 밤에만 다니던 손바닥만 한 첫 포유류가 태어났어요', 3, {
    sky: ['#0a1030', '#2a3a6a', '#05081a'], fog: [16, 200], light: 0.55, stars: 0.9, fx: 'fireflies', fxC: '#e6ee9c', mus: m('lydian', 60, 88, 'sine'),
    ground: ['#2a3a2a', '#3a4a30', 'moss', 0, 8], road: ['#3a3328', '#6a7a4a', 'dirt', 0],
    cast: c(DINO, { cross: ['morganucodon'], on: ['herrerasaurus'], weave: ['morganucodon'] }),
    near: ['cycad', 'burrow', 'dinoTracks'], mid: ['conifer', 'cycad', 'moonTree'], far: ['mesa'], skyK: ['moonBig'], scenes: ['mammalPeek'],
    P: { a: '#3a4a30', b: '#fff8e1', c: '#2a4a2a', leaf: '#2f5a2f', wood: '#3a2a1a', rock: '#4a4a40' } }),
  t('판게아 분열', '🗺️', '2억 년 전', '하나였던 거대한 대륙이 갈라지며 그 틈으로 용암과 새 바다가 들어왔어요', 3, {
    sky: ['#5a7aa0', '#e0c8a8', '#5a4a3a'], fog: [30, 320], light: 0.95, fx: 'ash', fxC: '#ffccbc', mus: m('minor', 50, 108, 'sawtooth'),
    ground: ['#8a6a4a', '#a07a50', 'rock', 0, 10], road: ['#7a5a3a', '#ff6d00', 'stone', 0],
    cast: c(DINO, { cross: ['coelophysis'], on: ['plateosaurus'], weave: ['coelophysis'], wall: ['basaltWall'], hurdle: ['lavaCrack'] }),
    near: ['riftCrack', 'cycad', 'basaltCol'], mid: ['riftLava', 'conifer', 'plateoT'], far: ['riftCliff', 'volcanoS'], skyK: [], scenes: ['quakeRift'],
    P: { a: '#a07a50', b: '#ffccbc', c: '#ff6d00', leaf: '#5f8a3a', wood: '#5a4a2a', rock: '#7a5a3a' } }),
  t('쥐라기 거인들', '🦕', '1억 5천만 년 전', '목이 긴 브라키오사우루스와 디플로도쿠스 무리가 땅을 울리며 걸었어요', 3, {
    sky: ['#5aa0e0', '#e0f4ff', '#a8c890'], fog: [40, 360], light: 1.1, sun: '#ffffff', fx: 'leaves', fxC: '#9ccc65', mus: m('major', 55, 96, 'triangle'),
    ground: ['#5a8a3a', '#7aa04a', 'grass', 0, 9], road: ['#8a7a5a', '#5a4a2a', 'dirt', 0],
    cast: c(DINO, { cross: ['compy'], on: ['stegosaurus'], big: ['sauropodLeg'], weave: ['compy'] }),
    near: ['cycad', 'treeFern', 'dinoTracks'], mid: ['brachiosaurus', 'araucaria', 'stegoT'], far: ['diplodocusHerd', 'araucaria'], skyK: ['pteroSky'], scenes: ['sauropodWalk'],
    P: { a: '#7aa04a', b: '#fff8e1', c: '#33691e', leaf: '#3f7a2a', wood: '#6a4a2a', rock: '#7a7a6a' } }),
  t('익룡의 하늘', '🦅', '1억 5천만 년 전', '가죽 날개를 편 익룡들이 바닷가 절벽 위 하늘을 가득 채웠어요', 3, {
    sky: ['#3a8ad0', '#c8e8ff', '#7aa8c8'], fog: [40, 360], light: 1.1, sun: '#ffffff', fx: 'none', mus: m('lydian', 62, 104, 'sine'),
    ground: ['#c8b080', '#a8c8d0', 'sand', 0, 10], road: ['#a89070', '#6a5a40', 'dirt', 0],
    cast: c(DINO, { cross: ['pteroWalk'], on: ['pteroLow'], big: ['sauropodLeg'], weave: ['rhamphorhynchus'] }),
    near: ['seaStack', 'pteroNest', 'shellPile'], mid: ['seaCliff', 'pteroPerch'], far: ['seaCliff'], skyK: ['pteroSky', 'pteroSky'], scenes: ['pteroDive'],
    P: { a: '#a8c8d0', b: '#fff3e0', c: '#8a5a3a', leaf: '#4a7a3a', wood: '#5a4a3a', rock: '#9a8a70' } }),
  t('시조새', '🪶', '1억 5천만 년 전', '공룡의 이빨과 새의 깃털을 함께 가진 시조새가 석호 위를 날았어요', 3, {
    sky: ['#ffb070', '#ffe8c0', '#d8a070'], fog: [40, 330], light: 1.05, sun: '#fff3d6', fx: 'leaves', fxC: '#ffcc80', mus: m('pent', 64, 100, 'triangle'),
    ground: ['#c8b080', '#9ab0a0', 'sand', 0, 10], road: ['#b09878', '#6a5a40', 'dirt', 0],
    cast: c(DINO, { cross: ['archaeopteryx'], on: ['compsognathusPack'], weave: ['archaeopteryx'] }),
    near: ['cycad', 'conifer', 'lagoonPool'], mid: ['archaeoPerch', 'conifer', 'lagoonPool'], far: ['islandsFar'], skyK: ['archaeoSky'], scenes: ['archaeoFlap'],
    P: { a: '#9ab0a0', b: '#fff3e0', c: '#5a8a5a', leaf: '#4a7a3a', wood: '#5a4a2a', rock: '#a09070' } }),
  t('꽃의 탄생', '🌸', '1억 3천만 년 전', '세상에 처음 꽃이 피고, 벌과 나비가 꽃가루를 옮기기 시작했어요', 3, {
    sky: ['#7ab8e8', '#ffeef8', '#c8d8a8'], fog: [40, 330], light: 1.1, sun: '#ffffff', fx: 'petals', fxC: '#f8bbd0', mus: m('major', 64, 100, 'triangle'),
    ground: ['#6a9a4a', '#8ab85a', 'grass', 0, 8], road: ['#9a8a6a', '#5a6a3a', 'dirt', 0],
    cast: c(DINO, { cross: ['iguanodonBaby'], on: ['iguanodon'], weave: ['butterflyT'], wall: ['magnoliaWall'] }),
    near: ['firstFlower', 'magnoliaBush', 'beeT'], mid: ['magnoliaTree', 'iguanodonT', 'firstFlower'], far: ['araucaria'], skyK: [], scenes: ['beeDance'],
    P: { a: '#8ab85a', b: '#fce4ec', c: '#f06292', leaf: '#4a8a3a', wood: '#6a4a2a', rock: '#8a8a7a' } }),
  t('티라노사우루스', '🦖', '6천8백만 년 전', '버스만 한 몸과 바나나만 한 이빨, 티라노사우루스가 숲의 왕이었어요', 3, {
    sky: ['#d07a40', '#ffd0a0', '#704a30'], fog: [30, 300], light: 1.0, sun: '#ffe0b2', fx: 'leaves', fxC: '#a5d6a7', mus: m('minor', 43, 120, 'sawtooth'),
    ground: ['#5a7a3a', '#7a8a4a', 'grass', 0, 9], road: ['#7a6a4a', '#4a3a2a', 'dirt', 0],
    cast: c(DINO, { cross: ['raptor'], on: ['trexJuvenile'], big: ['trexBig'], weave: ['raptor'] }),
    near: ['fernBush', 'trexTrack', 'palmT'], mid: ['trexT', 'palmT', 'ribCage'], far: ['volcanoS', 'palmGrove'], skyK: ['pteroSky'], scenes: ['trexRoar'],
    P: { a: '#7a8a4a', b: '#fff3e0', c: '#33691e', leaf: '#3f7a2a', wood: '#5a4a2a', rock: '#6a6a5a' } }),
  t('트리케라톱스 무리', '🦏', '6천7백만 년 전', '뿔 세 개 트리케라톱스와 갑옷 공룡 안킬로사우루스가 무리 지어 다녔어요', 3, {
    sky: ['#6aa8e0', '#e8f4e0', '#a0b880'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'dust', fxC: '#fff8e1', mus: m('major', 52, 104, 'triangle'),
    ground: ['#7a9a4a', '#9ab05a', 'grass', 0, 9], road: ['#9a8a5a', '#5a5a3a', 'dirt', 0],
    cast: c(DINO, { cross: ['pachycephalo'], on: ['triceratops'], big: ['triceratopsHerd'], weave: ['pachycephalo'] }),
    near: ['fernBush', 'magnoliaBush', 'dinoTracks'], mid: ['triceratopsT', 'ankyloT', 'palmT'], far: ['triceratopsHerdFar', 'mesa'], skyK: ['pteroSky'], scenes: ['headButt'],
    P: { a: '#9ab05a', b: '#fff8e1', c: '#558b2f', leaf: '#4a8a3a', wood: '#5a4a2a', rock: '#8a8a6a' } }),
  t('공룡의 멸종', '☄️', '6천6백만 년 전', '지름 10km 운석이 떨어져 하늘이 불타고, 공룡의 시대가 끝났어요', 3, {
    sky: ['#3a0a00', '#ff6d00', '#1a0500'], fog: [16, 220], light: 0.95, fx: 'embers', fxC: '#ffab40', mus: m('dim', 40, 140, 'sawtooth'),
    ground: ['#4a2a1a', '#ff5722', 'ash', 0.2, 9], road: ['#5a3a2a', '#ff6d00', 'stone', 0],
    cast: c(DINO, { cross: ['raptorFlee'], on: ['triceratops'], big: ['trexBig'], weave: ['fireball'], wall: ['burningFern'], hurdle: ['lavaCrack'], bar: ['deadBranchArch'] }),
    near: ['burningTree', 'meteorite', 'craterSmall'], mid: ['burningTree', 'fleeingDino'], far: ['impactFlash', 'volcanoS'], skyK: ['meteorSky', 'meteorSky'], scenes: ['meteorStrike'],
    P: { a: '#ff6d00', b: '#ffd180', c: '#3e2723', leaf: '#5a3a1a', wood: '#3a2a1a', rock: '#4a3a2a' } }),

  // ===================== 제4장 인류 =====================
  t('포유류의 시대', '🦣', '6천만 년 전', '공룡이 사라진 숲에서 포유류와 키 2m 거대 새 가스토르니스가 번성했어요', 4, {
    sky: ['#6ab0e0', '#e8f8e8', '#a8c890'], fog: [30, 300], light: 1.05, sun: '#ffffff', fx: 'leaves', fxC: '#aed581', mus: m('major', 60, 100, 'triangle'),
    ground: ['#4a7a3a', '#6a9a4a', 'grass', 0, 8], road: ['#7a6a4a', '#4a5a3a', 'dirt', 0],
    cast: { cross: ['earlyHorse'], on: ['gastornis'], big: ['uintatherium'], weave: ['earlyHorse'], wall: ['bushWall'], hurdle: ['logFallen'], bar: ['branchLow'] },
    near: ['fernBush', 'palmT', 'mushroomT'], mid: ['jungleTree', 'gastornisT', 'uintaT'], far: ['jungleTree', 'jungleTree'], skyK: ['birdFlock'], scenes: ['gastornisStrut'],
    P: { a: '#6a9a4a', b: '#fff8e1', c: '#2e7d32', leaf: '#3a7a2a', wood: '#5d4037', rock: '#7a7a6a' } }),
  t('최초의 영장류', '🐒', '5천5백만 년 전', '큰 눈과 잡을 수 있는 손을 가진 작은 영장류가 나무 위에서 살았어요', 4, {
    sky: ['#3a7a5a', '#b8e0c0', '#2a4a30'], fog: [14, 180], light: 0.85, fx: 'leaves', fxC: '#81c784', mus: m('pent', 62, 108, 'triangle'),
    ground: ['#2f5a2a', '#4a7a3a', 'grass', 0, 8], road: ['#5a4a30', '#3a5a2a', 'dirt', 0],
    cast: { cross: ['primateHop'], on: ['earlyHorse'], big: ['logRoll'], weave: ['primateHop'], wall: ['bushWall'], hurdle: ['rootRow'], bar: ['vineArch'] },
    near: ['fernBush', 'mushroomT', 'vineHang'], mid: ['jungleTree', 'primateTree', 'vineHang'], far: ['jungleTree'], skyK: ['birdFlock'], scenes: ['primateSwing'],
    P: { a: '#4a7a3a', b: '#e8f5e9', c: '#1b5e20', leaf: '#2e6b2a', wood: '#4e342e', rock: '#5a6a5a' } }),
  t('고래의 조상', '🐋', '5천만 년 전', '네 다리로 걷던 파키세투스가 물로 돌아가 고래가 되기 시작했어요', 4, {
    sky: ['#5ab0e8', '#e0f6ff', '#80c0d0'], fog: [30, 320], light: 1.1, sun: '#ffffff', fx: 'bubbles', fxC: '#e1f5fe', mus: m('lydian', 59, 92, 'sine'),
    ground: ['#3a90a8', '#70c0d0', 'water', 0.05, 10], road: ['#d8c8a0', '#9a8a60', 'sand', 0],
    cast: { cross: ['pakicetus'], on: ['ambulocetus'], big: ['basilosaurus'], weave: ['pakicetus'], wall: ['rockWall'], hurdle: ['rockRow'], bar: ['wavebar'] },
    near: ['shoreRock', 'shellPile', 'palmT'], mid: ['pakicetusT', 'basiloSwim', 'shoreRock'], far: ['islandsFar'], skyK: ['birdFlock'], scenes: ['whaleBreach'],
    P: { a: '#70c0d0', b: '#ffffff', c: '#0277bd', leaf: '#4a8a3a', wood: '#6a4a2a', rock: '#7a7a70' } }),
  t('최초의 인류 조상', '🚶', '320만 년 전', '아프리카 초원에서 루시와 친구들이 두 발로 걷기 시작했어요', 4, {
    sky: ['#e89a4a', '#ffe0a8', '#c08a50'], fog: [40, 340], light: 1.1, sun: '#fff0c0', fx: 'dust', fxC: '#ffe0b2', mus: m('pent', 57, 96, 'triangle'),
    ground: ['#c8a050', '#b09040', 'grass', 0, 9], road: ['#a88a5a', '#6a5a3a', 'dirt', 0],
    cast: { cross: ['australopith'], on: ['hyenaPack'], big: ['elephantAncient'], weave: ['gazelle'], wall: ['bushWall'], hurdle: ['rockRow'], bar: ['acaciaBranch'] },
    near: ['savannaGrass', 'termiteMound', 'laetoliPrints'], mid: ['acacia', 'australoGroup', 'giraffeT'], far: ['acacia', 'kilimanjaro'], skyK: ['birdFlock'], scenes: ['lucyWalk'],
    P: { a: '#c8a050', b: '#fff3e0', c: '#6d8a3a', leaf: '#6a8a3a', wood: '#5d4037', rock: '#9a8a6a' } }),
  t('최초의 석기', '🪨', '260만 년 전', '돌을 깨뜨려 날카로운 도구를 처음 만들었어요. 이게 기술의 시작이에요', 4, {
    sky: ['#d8904a', '#ffe0b0', '#a07a50'], fog: [40, 330], light: 1.05, sun: '#fff0c0', fx: 'dust', fxC: '#ffe0b2', mus: m('dorian', 55, 100, 'triangle'),
    ground: ['#b89050', '#a08040', 'grass', 0, 9], road: ['#9a7a4a', '#5a4a2a', 'dirt', 0],
    cast: { cross: ['homoHabilis'], on: ['hyenaPack'], big: ['elephantAncient'], weave: ['gazelle'], wall: ['boulderWall'], hurdle: ['rockRow'], bar: ['acaciaBranch'] },
    near: ['flintPile', 'savannaGrass', 'boneScatter'], mid: ['toolMaker', 'acacia', 'boulderT'], far: ['acacia', 'kilimanjaro'], skyK: ['vultureT'], scenes: ['knapping'],
    P: { a: '#a08040', b: '#fff3e0', c: '#6d8a3a', leaf: '#6a8a3a', wood: '#5d4037', rock: '#8a8070' } }),
  t('불의 발견', '🔥', '약 100만 년 전', '불을 다루게 된 사람들은 밤을 밝히고, 고기를 익히고, 맹수를 쫓았어요', 4, {
    sky: ['#0a0a20', '#3a2a4a', '#05050f'], fog: [14, 190], light: 0.5, stars: 0.9, fx: 'embers', fxC: '#ffb74d', mus: m('minor', 50, 84, 'triangle'),
    ground: ['#3a3020', '#4a3a28', 'grass', 0, 8], road: ['#4a3a28', '#ff9800', 'dirt', 0.1],
    cast: { cross: ['homoErectus'], on: ['sabertooth'], big: ['elephantAncient'], weave: ['hyenaPack'], wall: ['boulderWall'], hurdle: ['emberRow'], bar: ['acaciaBranch'] },
    near: ['campfire', 'torchStake', 'savannaGrass'], mid: ['campfire', 'fireCircle', 'caveMouth'], far: ['caveCliff'], skyK: ['moonBig'], scenes: ['fireDance'],
    P: { a: '#ff9800', b: '#ffe0b2', c: '#3e2723', leaf: '#4a5a2a', wood: '#4e342e', rock: '#5a5048' } }),
  t('호모 사피엔스의 탄생', '🧑', '30만 년 전', '우리와 똑같은 사람, 호모 사피엔스가 아프리카에서 태어났어요', 4, {
    sky: ['#f0a050', '#ffe8c0', '#c89060'], fog: [40, 340], light: 1.1, sun: '#fff3d0', fx: 'dust', fxC: '#fff3e0', mus: m('major', 60, 100, 'triangle'),
    ground: ['#b8a050', '#a09040', 'grass', 0, 9], road: ['#a08a5a', '#6a5a3a', 'dirt', 0],
    cast: { cross: ['sapiens'], on: ['zebraHerd'], big: ['elephantAncient'], weave: ['gazelle'], wall: ['bushWall'], hurdle: ['rockRow'], bar: ['acaciaBranch'] },
    near: ['shellBeads', 'savannaGrass', 'ochreRock'], mid: ['sapiensCamp', 'acacia', 'zebraT'], far: ['acacia', 'kilimanjaro'], skyK: ['birdFlock'], scenes: ['huntParty'],
    P: { a: '#b8a050', b: '#fff3e0', c: '#c0392b', leaf: '#6a8a3a', wood: '#5d4037', rock: '#9a8a6a' } }),
  t('사피엔스 vs 네안데르탈인', '⚔️', '4만 년 전', '유럽의 숲에서 사피엔스와 힘센 네안데르탈인이 마주쳤어요. 결국 우리만 남았죠', 4, {
    sky: ['#5a7a90', '#c8d8d8', '#4a5a50'], fog: [20, 240], light: 0.85, fx: 'leaves', fxC: '#bcaaa4', mus: m('dorian', 48, 112, 'sawtooth'),
    ground: ['#4a5a3a', '#5a6a40', 'grass', 0, 8], road: ['#5a4a38', '#3a3a28', 'dirt', 0],
    cast: { cross: ['neanderthal', 'sapiensSpear'], on: ['caveBear'], big: ['mammoth'], weave: ['wolf'], wall: ['boulderWall'], hurdle: ['logFallen'], bar: ['branchLow'] },
    near: ['pineT', 'flintPile', 'antlerPile'], mid: ['pineT', 'neanderCamp', 'sapiensCamp'], far: ['pineForest'], skyK: ['birdFlock'], scenes: ['standoff'],
    P: { a: '#5a6a40', b: '#efebe9', c: '#3e5a3a', leaf: '#2f5a3a', wood: '#4e342e', rock: '#6a6a60' } }),
  t('동굴 벽화', '🎨', '3만 6천 ~ 1만 7천 년 전', '횃불을 들고 동굴 벽에 들소와 말, 손바닥을 그렸어요. 최초의 예술이에요', 4, {
    sky: ['#1a0e08', '#5a3a20', '#0a0604'], fog: [12, 150], light: 0.6, fx: 'embers', fxC: '#ffcc80', mus: m('pent', 52, 80, 'triangle'),
    ground: ['#5a4030', '#6a4a34', 'rock', 0, 7], road: ['#6a5040', '#ff9800', 'dirt', 0.05],
    cast: { cross: ['painter'], on: ['bisonT'], big: ['mammoth'], weave: ['batT'], wall: ['stalagWall'], hurdle: ['stalagRow'], bar: ['stalactiteBar'] },
    near: ['stalagmiteT', 'torchStake', 'ochrePot'], mid: ['caveWallArt', 'stalagmiteT', 'torchStake'], far: ['caveWallArt'], skyK: [], scenes: ['painting'],
    P: { a: '#6a4a34', b: '#ffcc80', c: '#b03a2e', rock: '#7a5a44', wood: '#4e342e' } }),
  t('빙하기 매머드 사냥', '🦣', '2만 년 전', '눈보라 속에서 사람들이 힘을 모아 매머드를 사냥하고, 뼈로 집을 지었어요', 4, {
    sky: ['#6a8ab0', '#dce8f5', '#a0b0c8'], fog: [22, 250], light: 0.95, fx: 'snow', fxC: '#ffffff', mus: m('minor', 50, 100, 'triangle'), aurora: true,
    ground: ['#e8f0f8', '#c8d8e8', 'snow', 0, 10], road: ['#d8e4ee', '#8aa0b8', 'snow', 0],
    cast: { cross: ['iceHunter'], on: ['woollyRhino'], big: ['mammoth'], weave: ['wolf'], wall: ['iceWall'], hurdle: ['snowDrift'], bar: ['tuskArch'] },
    near: ['snowPine', 'boneHut', 'campfire'], mid: ['mammothT', 'boneHut', 'hunterGroup'], far: ['glacierWall', 'mammothHerd'], skyK: [], scenes: ['mammothHunt'],
    P: { a: '#8aa0b8', b: '#ffffff', c: '#5d4037', leaf: '#2f5a4a', wood: '#5d4037', rock: '#8a9aaa' } }),
  t('인류의 대이동', '🧭', '1만 5천 년 전', '얼어붙은 베링 육교를 건너 사람과 개가 처음으로 아메리카에 닿았어요', 4, {
    sky: ['#e8a080', '#fde0c8', '#b8c0d0'], fog: [30, 300], light: 1.0, sun: '#fff0d8', fx: 'snow', fxC: '#ffffff', mus: m('lydian', 57, 96, 'triangle'),
    ground: ['#e0e8f0', '#b8c8d8', 'snow', 0, 10], road: ['#c8d0d8', '#7a8a9a', 'snow', 0],
    cast: { cross: ['migrant'], on: ['dogSled'], big: ['mammoth'], weave: ['dogRun'], wall: ['iceWall'], hurdle: ['snowDrift'], bar: ['tuskArch'] },
    near: ['snowPine', 'cairn', 'footprintsSnow'], mid: ['migrantFamily', 'tentHide', 'snowPine'], far: ['glacierWall'], skyK: ['birdFlock'], scenes: ['caravanWalk'],
    P: { a: '#7a8a9a', b: '#ffffff', c: '#6d4c41', leaf: '#2f5a4a', wood: '#5d4037', rock: '#8a9aaa' } }),

  // ===================== 제5장 고대 문명 =====================
  t('농업 혁명', '🌾', '1만 2천 년 전', '비옥한 초승달 지대에서 처음으로 밀을 심고 양과 염소를 길렀어요', 5, {
    sky: ['#7ab8e8', '#fff3d6', '#c8b080'], fog: [40, 340], light: 1.1, sun: '#fff8e1', fx: 'leaves', fxC: '#e6c97a', mus: m('major', 60, 100, 'triangle'),
    ground: ['#c8a860', '#d8b870', 'field', 0, 6], road: ['#a08058', '#6a5030', 'dirt', 0],
    cast: { cross: ['farmer'], on: ['sheepFlock'], big: ['oxPlow'], weave: ['goat'], wall: ['mudWall'], hurdle: ['wheatRow'], bar: ['dryingRack'] },
    near: ['wheatPatch', 'grindStone', 'basketPile'], mid: ['mudHouse', 'wheatField', 'sheepT'], far: ['wheatField', 'tellHill'], skyK: ['birdFlock'], scenes: ['harvest'],
    P: { a: '#d8b870', b: '#fff8e1', c: '#8d6e63', wall: '#c8a070', roof: '#8a7a5a', leaf: '#7a9a4a', wood: '#6d4c41', rock: '#a09078' } }),
  t('괴베클리 테페', '🗿', '1만 1천6백 년 전', '피라미드보다 7천 년 앞서, 사람들은 동물이 새겨진 거대한 T자 돌기둥을 세웠어요', 5, {
    sky: ['#e8905a', '#ffe0b8', '#b08060'], fog: [40, 330], light: 1.05, sun: '#fff0d0', fx: 'dust', fxC: '#ffe0b2', mus: m('dorian', 52, 88, 'triangle'),
    ground: ['#b89868', '#c8a878', 'dirt', 0, 8], road: ['#a08868', '#6a5a40', 'dirt', 0],
    cast: { cross: ['carver'], on: ['stoneSled'], big: ['tPillarRoll'], weave: ['foxT'], wall: ['tPillarWall'], hurdle: ['rockRow'], bar: ['lintelBar'] },
    near: ['carvedRelief', 'flintPile', 'basketPile'], mid: ['tPillarRing', 'tPillar', 'carverGroup'], far: ['tellHill'], skyK: ['vultureT'], scenes: ['pillarRaise'],
    P: { a: '#c8b090', b: '#fff3e0', c: '#6d4c41', rock: '#c8b090', leaf: '#8a9a5a', wood: '#5d4037' } }),
  t('메소포타미아', '🏛️', '5천2백 년 전', '바퀴가 굴러가고, 진흙판에 쐐기문자로 처음 글을 쓰기 시작했어요', 5, {
    sky: ['#e8a860', '#fff0c8', '#c09060'], fog: [40, 330], light: 1.1, sun: '#fff3d0', fx: 'dust', fxC: '#fff3e0', mus: m('phryg', 55, 104, 'triangle'),
    ground: ['#c8a068', '#b89058', 'sand', 0, 9], road: ['#b8946a', '#7a5a3a', 'brick', 0],
    cast: { cross: ['scribe', 'sumerian'], on: ['wheelCart'], big: ['onagerChariot'], weave: ['donkeyT'], wall: ['mudWall'], hurdle: ['tabletRow'], bar: ['reedArch'] },
    near: ['clayTablets', 'datePalm', 'potStack'], mid: ['mudHouse', 'datePalm', 'reedBoat'], far: ['ziggurat'], skyK: ['birdFlock'], scenes: ['scribeWriting'],
    P: { a: '#c8a068', b: '#2a6ad8', c: '#8a4a2a', wall: '#c89a68', roof: '#a07a50', leaf: '#5a8a3a', wood: '#6d4c41', rock: '#b89068' } }),
  t('고대 이집트', '🐫', '4천5백 년 전', '나일강 옆에서 수많은 사람이 돌을 끌어 피라미드를 쌓았어요', 5, {
    sky: ['#5aa8e8', '#fff3d0', '#e8c890'], fog: [40, 360], light: 1.15, sun: '#ffffff', fx: 'dust', fxC: '#fff3e0', mus: m('phryg', 57, 108, 'triangle'),
    ground: ['#e8c880', '#d8b068', 'sand', 0, 10], road: ['#d8c090', '#a08050', 'stone', 0],
    cast: { cross: ['egyptWorker', 'egyptPriest'], on: ['stoneSled'], big: ['pharaohBarge'], weave: ['egyptCat'], wall: ['sandstoneWall'], hurdle: ['papyrusRow'], bar: ['hieroglyphBar'] },
    near: ['papyrusClump', 'ankhStatue', 'scarabStone'], mid: ['obelisk', 'datePalm', 'sphinxSmall', 'egyptCrowd'], far: ['pyramidBig', 'pyramidBig', 'sphinxBig'], skyK: ['falconT'], scenes: ['stoneHaul'],
    P: { a: '#e8c880', b: '#1e66c8', c: '#c8a040', wall: '#e0c890', roof: '#d0a860', leaf: '#4a8a3a', wood: '#8d6e63', rock: '#e0c890', gold: '#f4d03f' } }),
  t('스톤헨지', '🪨', '4천5백 년 전', '해가 가장 긴 날, 해돋이가 정확히 거대한 돌문 사이로 비쳐요', 5, {
    sky: ['#ff9a6a', '#ffe0c8', '#8aa0b8'], fog: [30, 300], light: 1.0, sun: '#fff0d8', fx: 'dust', fxC: '#ffe0b2', mus: m('dorian', 50, 84, 'sine'),
    ground: ['#6a8a4a', '#7a9a5a', 'grass', 0, 9], road: ['#8a8a70', '#5a5a48', 'dirt', 0],
    cast: { cross: ['druid'], on: ['stoneSled'], big: ['sarsenRoll'], weave: ['deerT'], wall: ['sarsenWall'], hurdle: ['rockRow'], bar: ['lintelBar'] },
    near: ['bluestone', 'barrowMound', 'wildflower'], mid: ['sarsenPair', 'barrowMound', 'druidCircle'], far: ['stonehenge'], skyK: ['birdFlock'], scenes: ['solsticeSun'],
    P: { a: '#8a8a7a', b: '#fff8e1', c: '#5a6a4a', rock: '#9a9a8a', leaf: '#5a8a3a', wood: '#5d4037' } }),
  t('인더스 문명', '🐂', '4천5백 년 전', '모헨조다로는 바둑판 길과 하수도, 큰 목욕탕까지 있는 계획도시였어요', 5, {
    sky: ['#e8a860', '#fff0d0', '#c0905a'], fog: [40, 330], light: 1.1, sun: '#fff3d0', fx: 'dust', fxC: '#fff3e0', mus: m('pent', 57, 100, 'triangle'),
    ground: ['#c09060', '#b08050', 'dirt', 0, 9], road: ['#b07a50', '#7a4a2a', 'brick', 0],
    cast: { cross: ['indusTrader'], on: ['zebuCart'], big: ['elephantWar'], weave: ['zebuT'], wall: ['brickWallT'], hurdle: ['potRow'], bar: ['awningBar'] },
    near: ['sealStone', 'potStack', 'drainCover'], mid: ['brickHouse', 'greatBath', 'zebuT'], far: ['citadelMound'], skyK: ['birdFlock'], scenes: ['bathing'],
    P: { a: '#b07a50', b: '#fff3e0', c: '#7a4a2a', wall: '#b07a50', roof: '#9a6a40', leaf: '#5a8a3a', wood: '#6d4c41', rock: '#a07050' } }),
  t('황하 문명', '🐉', '3천6백 년 전', '상나라 사람들은 거북 등딱지에 점을 쳐 한자의 조상인 갑골문을 새겼어요', 5, {
    sky: ['#d8a070', '#fbe8c8', '#a08060'], fog: [30, 300], light: 1.0, fx: 'leaves', fxC: '#d4e157', mus: m('pent', 55, 92, 'triangle'),
    ground: ['#c8a870', '#b89860', 'dirt', 0, 9], road: ['#a8886a', '#6a5a40', 'dirt', 0],
    cast: { cross: ['shangPeople'], on: ['shangChariot'], big: ['bronzeDingRoll'], weave: ['silkMoth'], wall: ['rammedEarthWall'], hurdle: ['oracleBones'], bar: ['silkLine'] },
    near: ['oracleBoneSet', 'bronzeDing', 'mulberry'], mid: ['shangHall', 'mulberry', 'silkLoom'], far: ['loessHills'], skyK: ['craneBird'], scenes: ['oracleReading'],
    P: { a: '#c8a870', b: '#2e7d32', c: '#8a3a2a', wall: '#c8a870', roof: '#5d4037', leaf: '#5a8a3a', wood: '#6d4c41', rock: '#a08060', bronze: '#4a8a6a' } }),
  t('함무라비 법전', '📜', '기원전 1754년', '바빌론의 왕은 282개의 법을 돌기둥에 새겨 모두가 볼 수 있게 했어요', 5, {
    sky: ['#5a98d8', '#f8e8c8', '#c8a070'], fog: [40, 340], light: 1.1, sun: '#fff8e1', fx: 'dust', fxC: '#fff3e0', mus: m('phryg', 52, 100, 'triangle'),
    ground: ['#d0a870', '#c09860', 'sand', 0, 9], road: ['#c0a070', '#1e4a9a', 'brick', 0],
    cast: { cross: ['babylonian'], on: ['wheelCart'], big: ['lionGate'], weave: ['donkeyT'], wall: ['glazedWall'], hurdle: ['tabletRow'], bar: ['ishtarBar'] },
    near: ['lawStele', 'datePalm', 'potStack'], mid: ['ishtarGate', 'hangingGarden', 'babylonCrowd'], far: ['ziggurat'], skyK: ['birdFlock'], scenes: ['lawReading'],
    P: { a: '#1e4a9a', b: '#f4d03f', c: '#8a4a2a', wall: '#2a5ab8', roof: '#c8a070', leaf: '#4a8a3a', wood: '#6d4c41', rock: '#c8a070' } }),
  t('트로이 전쟁', '🐴', '기원전 12세기', '10년 동안 무너지지 않던 트로이 성은 거대한 목마 속 병사들 때문에 함락됐어요', 5, {
    sky: ['#5aa0d8', '#e8f0f0', '#a0a8a0'], fog: [30, 320], light: 1.05, fx: 'dust', fxC: '#efebe9', mus: m('minor', 48, 120, 'sawtooth'),
    ground: ['#c0a878', '#a89868', 'sand', 0, 9], road: ['#a8987a', '#6a5a48', 'stone', 0],
    cast: { cross: ['hoplite', 'trojan'], on: ['greekChariot'], big: ['trojanHorse'], weave: ['horseRider'], wall: ['shieldWallGreek'], hurdle: ['spearRow'], bar: ['bannerBarGreek'] },
    near: ['spearStack', 'shieldPile', 'amphora'], mid: ['troyWall', 'greekTent', 'duelGreek'], far: ['troyCity', 'greekShips'], skyK: ['birdFlock'], scenes: ['duelGreek'],
    P: { a: '#c8a040', b: '#1565c0', c: '#c62828', wall: '#d8c8a0', roof: '#a0522d', leaf: '#5a8a3a', wood: '#6d4c41', rock: '#c8b890' } }),
  t('페니키아 알파벳', '🔤', '기원전 1050년', '바다 상인 페니키아인이 만든 22개 글자가 오늘날 알파벳의 조상이 됐어요', 5, {
    sky: ['#3a9ad8', '#e0f4ff', '#80b0c8'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'none', mus: m('dorian', 57, 104, 'triangle'),
    ground: ['#2a8ab0', '#5ab0d0', 'water', 0.05, 10], road: ['#c8b090', '#7a2a6a', 'plank', 0],
    cast: { cross: ['phoenician'], on: ['amphoraCart'], big: ['phoenicianShip'], weave: ['seagullT'], wall: ['cedarCrates'], hurdle: ['amphoraRow'], bar: ['purpleCloth'] },
    near: ['amphora', 'letterStone', 'cedarLogs'], mid: ['phoenicianShipT', 'dockPost', 'purpleVat'], far: ['cedarMountain', 'phoenicianShipT'], skyK: ['seagullT'], scenes: ['dyeWork'],
    P: { a: '#7a2a6a', b: '#fff3e0', c: '#c8a070', wall: '#d8c8a0', roof: '#7a2a6a', leaf: '#2f5a3a', wood: '#8d6e63', rock: '#b8a888' } }),
  t('그리스 신화', '⚡', '기원전 8세기', '올림포스산의 제우스, 날개 달린 페가수스… 그리스 사람들은 신들의 이야기를 노래했어요', 5, {
    sky: ['#4a88d8', '#e8f0ff', '#b0c0d8'], fog: [40, 340], light: 1.15, sun: '#ffffff', fx: 'sparkles', fxC: '#fff9c4', mus: m('lydian', 64, 100, 'triangle'), lightning: true,
    ground: ['#e8e4d8', '#c8c0a8', 'marble', 0, 6], road: ['#f5f2ea', '#c9a227', 'tile', 0],
    cast: { cross: ['greekMuse'], on: ['pegasusLow'], big: ['minotaur'], weave: ['harpy'], wall: ['columnWall'], hurdle: ['brokenColumn'], bar: ['olympusCloud'] },
    near: ['marbleStatue', 'olivePot', 'lyreStand'], mid: ['greekTemple', 'olympusCloudT', 'pegasusT'], far: ['mtOlympus'], skyK: ['zeusBolt', 'pegasusSky'], scenes: ['zeusThunder'],
    P: { a: '#f5f2ea', b: '#c9a227', c: '#1565c0', wall: '#f5f2ea', roof: '#e8e0d0', leaf: '#6a8a4a', wood: '#8d6e63', rock: '#d8d0c0' } }),
  t('고대 올림픽', '🏅', '기원전 776년', '올림피아에서 첫 올림픽이 열렸어요. 우승자는 올리브 관을 썼죠', 5, {
    sky: ['#5aa8e8', '#f0f8ff', '#c8c8a8'], fog: [40, 340], light: 1.15, sun: '#ffffff', fx: 'leaves', fxC: '#9ccc65', mus: m('major', 64, 120, 'triangle'),
    ground: ['#c8b080', '#b8a070', 'sand', 0, 9], road: ['#d8c090', '#a08050', 'sand', 0],
    cast: { cross: ['athlete'], on: ['chariotRace'], big: ['chariotRace'], weave: ['athleteRun'], wall: ['columnWall'], hurdle: ['startLine'], bar: ['oliveGarland'] },
    near: ['olivePot', 'discusStatue', 'torchStake'], mid: ['stadiumSeat', 'oliveTree', 'templeZeus'], far: ['stadiumSeat'], skyK: ['birdFlock'], scenes: ['footRace'],
    P: { a: '#d8c090', b: '#6a8a3a', c: '#c62828', wall: '#f0ece0', roof: '#c8a070', leaf: '#6a8a4a', wood: '#8d6e63', rock: '#d0c8b0' } }),
  t('페르시아 제국', '👑', '기원전 550년', '키루스 대왕의 페르시아는 왕의 길 2,700km로 넓은 땅을 이었어요', 5, {
    sky: ['#d89050', '#ffe8c0', '#a87850'], fog: [40, 340], light: 1.1, sun: '#fff3d0', fx: 'dust', fxC: '#fff3e0', mus: m('phryg', 54, 104, 'triangle'),
    ground: ['#c8a070', '#b89060', 'sand', 0, 9], road: ['#b8946a', '#1e6a8a', 'stone', 0],
    cast: { cross: ['persianGuard'], on: ['persianRider'], big: ['camelCaravan'], weave: ['persianRider'], wall: ['lamassuWall'], hurdle: ['spearRow'], bar: ['bannerBarPersia'] },
    near: ['persianPot', 'cypress', 'fireAltar'], mid: ['persepolisColumn', 'cypress', 'lamassu'], far: ['persepolis'], skyK: ['falconT'], scenes: ['royalProcession'],
    P: { a: '#1e6a8a', b: '#f4d03f', c: '#8a3a2a', wall: '#c8b090', roof: '#8a6a4a', leaf: '#2f5a3a', wood: '#6d4c41', rock: '#c8a878' } }),
  t('사상가의 시대', '🧘', '기원전 6~5세기', '인도의 붓다, 중국의 공자, 그리스의 소크라테스가 거의 같은 시대에 살았어요', 5, {
    sky: ['#f0b070', '#fff3e0', '#c8a888'], fog: [40, 330], light: 1.1, sun: '#fff8e1', fx: 'petals', fxC: '#fff59d', mus: m('pent', 60, 84, 'sine'),
    ground: ['#a0b070', '#b0c080', 'grass', 0, 8], road: ['#c8b898', '#8a7a5a', 'dirt', 0],
    cast: { cross: ['monk', 'scholar', 'philosopher'], on: ['oxCart'], big: ['bodhiRoll'], weave: ['deerT'], wall: ['bambooWall'], hurdle: ['scrollRow'], bar: ['prayerFlags'] },
    near: ['lotusPond', 'scrollStack', 'stonelantern'], mid: ['bodhiTree', 'academyColumns', 'bambooGrove'], far: ['bodhiTree', 'mountainMist'], skyK: ['craneBird'], scenes: ['teaching'],
    P: { a: '#c8b898', b: '#ffcc80', c: '#e65100', wall: '#e8dcc8', roof: '#8a5a3a', leaf: '#5a8a3a', wood: '#6d4c41', rock: '#b8a890' } }),
  t('아테네 민주정', '🗳️', '기원전 5세기', '아테네 시민들은 광장에 모여 투표로 나라의 일을 정했어요. 민주주의의 시작이에요', 5, {
    sky: ['#4a98e0', '#eef6ff', '#b8c0c8'], fog: [40, 340], light: 1.15, sun: '#ffffff', fx: 'none', mus: m('major', 62, 100, 'triangle'),
    ground: ['#d8d0b8', '#c8c0a8', 'stone', 0, 7], road: ['#ece6d8', '#a89870', 'tile', 0],
    cast: { cross: ['athenian', 'philosopher'], on: ['oxCart'], big: ['triremeRoll'], weave: ['owlT'], wall: ['columnWall'], hurdle: ['potRow'], bar: ['theaterMaskBar'] },
    near: ['ostraconPile', 'amphora', 'owlStatue'], mid: ['agoraStoa', 'theaterMask', 'athenianCrowd'], far: ['parthenon', 'acropolisHill'], skyK: ['owlSky'], scenes: ['voting'],
    P: { a: '#ece6d8', b: '#1565c0', c: '#c9a227', wall: '#f2eee4', roof: '#d8cfc0', leaf: '#6a8a4a', wood: '#8d6e63', rock: '#d0c8b0' } }),
  t('알렉산드로스 대왕', '🏇', '기원전 334년', '마케도니아의 젊은 왕은 그리스부터 인도까지 거대한 제국을 세웠어요', 5, {
    sky: ['#e09050', '#ffe8c8', '#a88060'], fog: [40, 340], light: 1.1, sun: '#fff3d0', fx: 'dust', fxC: '#ffe0b2', mus: m('minor', 50, 128, 'sawtooth'),
    ground: ['#c8a870', '#b89860', 'sand', 0, 9], road: ['#b89a70', '#7a6040', 'dirt', 0],
    cast: { cross: ['phalanx'], on: ['companionCavalry'], big: ['warElephant'], weave: ['companionCavalry'], wall: ['sarissaWall'], hurdle: ['spearRow'], bar: ['sarissaBar'] },
    near: ['spearStack', 'shieldPile', 'campTent'], mid: ['phalanxBlock', 'warElephantT', 'campTent'], far: ['pharosLighthouse', 'desertHills'], skyK: ['birdFlock'], scenes: ['phalanxMarch'],
    P: { a: '#c8a040', b: '#c62828', c: '#6d4c41', wall: '#d8c8a0', roof: '#c62828', leaf: '#6a8a4a', wood: '#6d4c41', rock: '#c0a880' } }),
  t('진시황과 만리장성', '🏯', '기원전 221년', '처음으로 중국을 통일한 진시황은 북쪽에 만리장성을 쌓고, 병마용 군대를 남겼어요', 5, {
    sky: ['#8ab0d0', '#f0e8d8', '#a09080'], fog: [30, 320], light: 1.0, fx: 'dust', fxC: '#efebe9', mus: m('pent', 52, 100, 'triangle'),
    ground: ['#8a9a6a', '#9aa070', 'grass', 0, 9], road: ['#a09888', '#6a6050', 'stone', 0],
    cast: { cross: ['qinSoldier'], on: ['qinChariot'], big: ['terracottaRow'], weave: ['qinRider'], wall: ['greatWallBlock'], hurdle: ['brickRowT'], bar: ['qinBanner'] },
    near: ['terracottaWarrior', 'bronzeDing', 'brickStack'], mid: ['terracottaArmy', 'beaconTower', 'pineT'], far: ['greatWall', 'greatWall'], skyK: ['craneBird'], scenes: ['beaconSmoke'],
    P: { a: '#a09888', b: '#c62828', c: '#3e2723', wall: '#a09080', roof: '#3e2723', leaf: '#3f6a3a', wood: '#5d4037', rock: '#8a8070' } }),
  t('실크로드', '🐫', '기원전 2세기 ~', '비단 · 향신료 · 종이 · 생각이 낙타 등에 실려 동양과 서양을 오갔어요', 5, {
    sky: ['#e8a050', '#ffe8c0', '#c89060'], fog: [40, 360], light: 1.1, sun: '#fff3d0', fx: 'dust', fxC: '#ffe0b2', mus: m('phryg', 57, 96, 'triangle'),
    ground: ['#e0b070', '#d0a060', 'sand', 0, 12], road: ['#c89a68', '#8a6040', 'sand', 0],
    cast: { cross: ['silkTrader'], on: ['camelCaravan'], big: ['camelCaravan'], weave: ['horseRider'], wall: ['silkBales'], hurdle: ['spiceSacks'], bar: ['silkLine'] },
    near: ['spiceSacksT', 'oasisPalm', 'silkBolt'], mid: ['caravanserai', 'camelT', 'oasisPool'], far: ['duneBig', 'duneBig'], skyK: ['falconT'], scenes: ['caravanRest'],
    P: { a: '#e0b070', b: '#c62828', c: '#1e88e5', wall: '#d8b888', roof: '#c08050', leaf: '#4a8a3a', wood: '#6d4c41', rock: '#c8a070' } }),
  t('로마 콜로세움', '🏟️', '서기 80년', '5만 명이 들어가는 콜로세움에서 검투사 경기와 공연이 열렸어요', 5, {
    sky: ['#5aa0e0', '#f8f0e0', '#c8b898'], fog: [40, 340], light: 1.15, sun: '#ffffff', fx: 'none', mus: m('major', 57, 112, 'triangle'),
    ground: ['#b8a888', '#a89878', 'stone', 0, 7], road: ['#a89a88', '#6a5a48', 'stone', 0],
    cast: { cross: ['romanCitizen', 'gladiator'], on: ['romanCart'], big: ['romanChariot'], weave: ['romanMessenger'], wall: ['shieldWallRoman'], hurdle: ['amphoraRow'], bar: ['velariumBar'] },
    near: ['romanStatue', 'amphora', 'cypress'], mid: ['romanInsula', 'aqueductT', 'romanCrowd'], far: ['colosseum', 'aqueductT'], skyK: ['eagleT'], scenes: ['gladiatorDuel'],
    P: { a: '#c8b898', b: '#c62828', c: '#c9a227', wall: '#e0d4bc', roof: '#b0522d', leaf: '#3f6a3a', wood: '#6d4c41', rock: '#c8bca4' } }),
  t('로마 군단', '🦅', '서기 1~2세기', '독수리 깃발 아래 로마 군단이 방패를 맞대고 행진했어요. 길 위에서도, 옆에서도!', 5, {
    sky: ['#d8784a', '#ffd8b0', '#5a4a40'], fog: [30, 300], light: 1.0, fx: 'embers', fxC: '#ffab40', mus: m('minor', 45, 132, 'sawtooth'),
    ground: ['#7a8a5a', '#8a8a60', 'grass', 0, 9], road: ['#9a9080', '#5a5048', 'stone', 0],
    cast: { cross: ['legionary'], on: ['legionLine'], big: ['romanChariot'], weave: ['romanCavalry'], wall: ['shieldWallRoman'], hurdle: ['fallenColumn'], bar: ['burningBeam'] },
    near: ['aquilaStandard', 'shieldPile', 'spearStack'], mid: ['burningTemple', 'catapult', 'legionDuel'], far: ['burningTemple', 'romanFort'], skyK: ['eagleT'], scenes: ['legionDuel', 'catapultFire'],
    P: { a: '#c62828', b: '#c9a227', c: '#3e2723', wall: '#e0d4bc', roof: '#b0522d', leaf: '#3f6a3a', wood: '#5d4037', rock: '#a8a090' } }),
  t('폼페이', '🌋', '서기 79년', '베수비오 화산이 터져 폼페이는 하루 만에 화산재에 묻혔어요', 5, {
    sky: ['#3a2a24', '#a05a3a', '#1a1210'], fog: [16, 220], light: 0.75, fx: 'ash', fxC: '#bcaaa4', mus: m('dim', 43, 112, 'sawtooth'),
    ground: ['#6a5a50', '#8a7a6a', 'ash', 0, 8], road: ['#8a8070', '#ff5722', 'stone', 0],
    cast: { cross: ['pompeiiCitizen'], on: ['romanCart'], big: ['lavaWave'], weave: ['fireball'], wall: ['frescoWall'], hurdle: ['amphoraRow'], bar: ['burningBeam'] },
    near: ['amphora', 'breadOven', 'frescoPanel'], mid: ['pompeiiHouse', 'burningTemple', 'romanStatue'], far: ['vesuvius'], skyK: ['meteorSky'], scenes: ['ashFall'],
    P: { a: '#b03a2e', b: '#ffcc80', c: '#3e2723', wall: '#c8a888', roof: '#8a4a2a', leaf: '#3f5a3a', wood: '#5d4037', rock: '#8a8070' } }),

  // ===================== 제6장 중세 =====================
  t('서로마의 몰락', '🏚️', '서기 476년', '천 년을 이어 온 서로마 제국이 무너지고, 유럽은 새 시대로 들어갔어요', 6, {
    sky: ['#6a7080', '#c8c0b8', '#4a4844'], fog: [20, 260], light: 0.85, fx: 'leaves', fxC: '#a1887f', mus: m('minor', 48, 92, 'triangle'),
    ground: ['#6a7a5a', '#7a8060', 'grass', 0, 9], road: ['#8a8478', '#5a5448', 'stone', 0],
    cast: { cross: ['germanicWarrior'], on: ['horseCart'], big: ['siegeRam'], weave: ['germanicRider'], wall: ['shieldWallRound'], hurdle: ['fallenColumn'], bar: ['brokenArch'] },
    near: ['brokenStatue', 'fallenColumnT', 'ivyRock'], mid: ['ruinedTemple', 'brokenArchT', 'germanicCamp'], far: ['ruinedAqueduct'], skyK: ['crowT'], scenes: ['ruinCrumble'],
    P: { a: '#8a8478', b: '#c62828', c: '#3e2723', wall: '#c8bca4', roof: '#7a4a2a', leaf: '#4a6a3a', wood: '#5d4037', rock: '#a8a090' } }),
  t('비잔티움', '⛪', '서기 537년', '콘스탄티노폴리스에 거대한 돔의 하기아 소피아가 세워졌어요', 6, {
    sky: ['#5a88c8', '#f0e8f8', '#b8a8c0'], fog: [40, 340], light: 1.1, sun: '#fff8e1', fx: 'sparkles', fxC: '#fff59d', mus: m('dorian', 55, 92, 'sine'),
    ground: ['#c8b8a0', '#b8a890', 'tiles', 0, 6], road: ['#d8c8a8', '#c9a227', 'tile', 0],
    cast: { cross: ['byzantine'], on: ['horseCart'], big: ['dromon'], weave: ['horseRider'], wall: ['mosaicWall'], hurdle: ['candleRow'], bar: ['mosaicArch'] },
    near: ['mosaicPanel', 'cypress', 'iconStand'], mid: ['byzDome', 'cypress', 'theodosianWall'], far: ['hagiaSophia'], skyK: ['doveT'], scenes: ['greekFire'],
    P: { a: '#c9a227', b: '#6a1b9a', c: '#1565c0', wall: '#d8b898', roof: '#8a6a9a', leaf: '#2f5a3a', wood: '#6d4c41', rock: '#c8b8a0', gold: '#f4d03f' } }),
  t('당나라 장안', '🏮', '서기 8세기', '세계에서 가장 큰 도시 장안에 비단길 상인들과 연등이 넘쳐났어요', 6, {
    sky: ['#1a1440', '#6a3a7a', '#0a0820'], fog: [24, 280], light: 0.75, stars: 0.6, fx: 'lanterns', fxC: '#ffb74d', mus: m('pent', 57, 96, 'triangle'),
    ground: ['#5a4a40', '#6a5a48', 'stone', 0, 7], road: ['#7a6a5a', '#c62828', 'stone', 0],
    cast: { cross: ['tangCitizen'], on: ['camelCaravan'], big: ['dragonDance'], weave: ['tangRider'], wall: ['lanternWall'], hurdle: ['potRow'], bar: ['lanternString'] },
    near: ['stonelantern', 'redLanternPost', 'teaTable'], mid: ['tangPagoda', 'tangHall', 'lanternStall'], far: ['tangPagoda', 'cityWallTang'], skyK: ['skyLantern'], scenes: ['dragonDanceT'],
    P: { a: '#c62828', b: '#ffca28', c: '#2e7d32', wall: '#e8d8c0', roof: '#2e3a3a', leaf: '#3f6a3a', wood: '#8a2a1a', rock: '#9a8a78' } }),
  t('이슬람 황금시대', '🔭', '서기 9세기', '바그다드 지혜의 집에서 학자들이 대수학 · 천문학 · 의학을 꽃피웠어요', 6, {
    sky: ['#0a1a40', '#3a4a8a', '#050a20'], fog: [30, 320], light: 0.8, stars: 1, fx: 'sparkles', fxC: '#fff59d', mus: m('phryg', 57, 92, 'triangle'),
    ground: ['#c8a878', '#b89868', 'tiles', 0, 6], road: ['#d8c098', '#1e88e5', 'tile', 0],
    cast: { cross: ['abbasidScholar'], on: ['camelCaravan'], big: ['camelCaravan'], weave: ['horseRider'], wall: ['bookshelfWall'], hurdle: ['scrollRow'], bar: ['starArch'] },
    near: ['astrolabe', 'bookPile', 'brassLamp'], mid: ['houseOfWisdom', 'minaret', 'observatoryT'], far: ['domeCity'], skyK: ['crescentMoon'], scenes: ['stargazing'],
    P: { a: '#1e88e5', b: '#f4d03f', c: '#2e7d32', wall: '#e8d8b8', roof: '#1e88e5', leaf: '#2f6a3a', wood: '#6d4c41', rock: '#c8b090', gold: '#f4d03f' } }),
  t('마야 문명', '🌽', '서기 250~900년', '정글 속 계단 피라미드 위에서 마야 사람들은 별을 보고 정확한 달력을 만들었어요', 6, {
    sky: ['#4a9a7a', '#d8f0d0', '#3a6a4a'], fog: [20, 260], light: 0.95, fx: 'leaves', fxC: '#81c784', mus: m('pent', 55, 108, 'triangle'),
    ground: ['#3a6a3a', '#4a7a40', 'grass', 0, 8], road: ['#c8c0a8', '#6a8a5a', 'stone', 0],
    cast: { cross: ['mayan'], on: ['jaguarT'], big: ['mayanBall'], weave: ['quetzal'], wall: ['stelaWall'], hurdle: ['cornRow'], bar: ['jungleVineBar'] },
    near: ['cornPlant', 'jadeMask', 'cacaoTree'], mid: ['mayaPyramid', 'jungleTree', 'ballCourt'], far: ['mayaPyramid', 'jungleTree'], skyK: ['quetzalSky'], scenes: ['ballGame'],
    P: { a: '#c8c0a8', b: '#00897b', c: '#c62828', wall: '#d8d0b8', roof: '#c8c0a8', leaf: '#2e6b2a', wood: '#5d4037', rock: '#b8b098', jade: '#26a69a' } }),
  t('바이킹', '⛵', '서기 793년 ~', '용머리 배를 탄 바이킹이 북쪽 바다를 건너 유럽 곳곳과 아메리카까지 갔어요', 6, {
    sky: ['#5a7898', '#d0dce8', '#4a5a6a'], fog: [20, 260], light: 0.9, fx: 'snow', fxC: '#eceff1', mus: m('dorian', 45, 112, 'sawtooth'),
    ground: ['#4a6a5a', '#5a7a68', 'grass', 0, 9], road: ['#6a5a48', '#3a3028', 'plank', 0],
    cast: { cross: ['viking'], on: ['vikingCart'], big: ['longship'], weave: ['vikingRider'], wall: ['shieldWallRound'], hurdle: ['barrelRow'], bar: ['dragonProwBar'] },
    near: ['runestone', 'shieldRack', 'barrelT'], mid: ['longhouse', 'longshipT', 'vikingFire'], far: ['fjordCliff', 'longshipT'], skyK: ['ravenT'], scenes: ['vikingRow'],
    P: { a: '#c62828', b: '#f5f5f5', c: '#5d4037', wall: '#6d4c41', roof: '#4a6a3a', leaf: '#2f5a3a', wood: '#5d4037', rock: '#7a8a8a' } }),
  t('십자군 전쟁', '🛡️', '1096년 ~', '유럽의 기사들과 이슬람 군대가 성지 예루살렘을 두고 200년 동안 싸웠어요', 6, {
    sky: ['#e8a060', '#ffe8c8', '#b08060'], fog: [30, 320], light: 1.05, sun: '#fff3d0', fx: 'dust', fxC: '#ffe0b2', mus: m('phryg', 50, 120, 'sawtooth'),
    ground: ['#d0b080', '#c0a070', 'sand', 0, 10], road: ['#c0a078', '#7a6048', 'stone', 0],
    cast: { cross: ['crusader', 'saracen'], on: ['knightHorse'], big: ['siegeTower'], weave: ['saracenRider'], wall: ['shieldWallKite'], hurdle: ['spearRow'], bar: ['bannerBarCross'] },
    near: ['crusaderTent', 'shieldPile', 'oasisPalm'], mid: ['crusaderCastle', 'trebuchet', 'knightDuel'], far: ['jerusalemWall', 'crusaderCastle'], skyK: ['falconT'], scenes: ['knightDuel'],
    P: { a: '#fafafa', b: '#c62828', c: '#2e7d32', wall: '#d8c098', roof: '#a07a50', leaf: '#4a8a3a', wood: '#6d4c41', rock: '#c8b088' } }),
  t('몽골 제국', '🐎', '1206년', '칭기즈 칸의 기마 군단은 역사상 가장 넓은 땅을 하나로 이었어요', 6, {
    sky: ['#4a98e0', '#e8f4ff', '#a0b890'], fog: [40, 380], light: 1.1, sun: '#ffffff', fx: 'dust', fxC: '#f1f8e9', mus: m('pent', 52, 128, 'sawtooth'),
    ground: ['#7aa04a', '#8ab05a', 'grass', 0, 10], road: ['#9a8a6a', '#5a5a3a', 'dirt', 0],
    cast: { cross: ['mongolWarrior'], on: ['mongolRider'], big: ['gerCart'], weave: ['mongolRider'], wall: ['gerWall'], hurdle: ['saddleRow'], bar: ['tugBanner'] },
    near: ['oboo', 'saddleT', 'yakT'], mid: ['ger', 'mongolHerd', 'eagleHunter'], far: ['steppeHills', 'gerCamp'], skyK: ['eagleT'], scenes: ['horseArchers'],
    P: { a: '#8d2a1c', b: '#1e88e5', c: '#ffca28', wall: '#f5f0e6', roof: '#e8e0d0', leaf: '#5a8a3a', wood: '#6d4c41', rock: '#8a8a7a' } }),
  t('흑사병', '🕯️', '1347년', '쥐벼룩이 옮긴 흑사병으로 유럽 사람 셋 중 하나가 세상을 떠났어요. 사람들은 촛불로 서로를 위로했어요', 6, {
    sky: ['#2a2a3a', '#5a5a6a', '#141420'], fog: [14, 180], light: 0.6, fx: 'dust', fxC: '#9e9e9e', mus: m('dim', 41, 72, 'triangle'),
    ground: ['#4a4a44', '#5a5a50', 'stone', 0, 7], road: ['#6a6458', '#3a3630', 'cobble', 0],
    cast: { cross: ['plagueDoctor'], on: ['ratPack'], big: ['horseCart'], weave: ['ratT'], wall: ['woodPlank'], hurdle: ['candleRow'], bar: ['herbBundle'] },
    near: ['candleCluster', 'herbPot', 'ratT'], mid: ['medievalHouse', 'chapel', 'candleVigil'], far: ['medievalTown'], skyK: ['crowT'], scenes: ['candleVigil'],
    P: { a: '#5a5a6a', b: '#ffd54f', c: '#3e2723', wall: '#d8ccb0', roof: '#5a3a2a', leaf: '#3a4a3a', wood: '#4e342e', rock: '#7a7468' } }),
  t('아즈텍 테노치티틀란', '🦅', '1325년', '호수 위에 세운 도시 테노치티틀란에는 떠 있는 밭 치남파가 펼쳐졌어요', 6, {
    sky: ['#4aa0d8', '#e8f8ff', '#80c0b0'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'petals', fxC: '#ffab91', mus: m('pent', 57, 112, 'triangle'),
    ground: ['#3a90a0', '#5ab0b8', 'water', 0.05, 10], road: ['#c8b898', '#26a69a', 'stone', 0],
    cast: { cross: ['aztec'], on: ['canoe'], big: ['aztecDrum'], weave: ['eagleWarrior'], wall: ['tzompantliFree'], hurdle: ['chinampaRow'], bar: ['featherArch'] },
    near: ['chinampa', 'cactusNopal', 'featherFan'], mid: ['temploMayor', 'canoeT', 'chinampa'], far: ['temploMayor', 'volcanoS'], skyK: ['eagleT'], scenes: ['canoeMarket'],
    P: { a: '#26a69a', b: '#c62828', c: '#ffca28', wall: '#e0d4b8', roof: '#c62828', leaf: '#3a8a3a', wood: '#6d4c41', rock: '#c8b898' } }),
  t('잉카 마추픽추', '🦙', '1450년', '구름 위 산꼭대기에 돌을 딱 맞춰 쌓은 도시, 마추픽추가 세워졌어요', 6, {
    sky: ['#6aa8d8', '#e8f0f8', '#a0b0b8'], fog: [20, 260], light: 1.05, fx: 'none', mus: m('pent', 59, 96, 'sine'),
    ground: ['#5a8a4a', '#6a9a5a', 'grass', 0, 8], road: ['#a8a090', '#6a6050', 'stone', 0],
    cast: { cross: ['inca'], on: ['llamaTrain'], big: ['stoneBlockRoll'], weave: ['llamaT'], wall: ['incaWall'], hurdle: ['terraceStep'], bar: ['quipuBar'] },
    near: ['quipuStand', 'incaStoneT', 'potatoPatch'], mid: ['terraceField', 'incaHouse', 'llamaT'], far: ['machuPicchu', 'andesPeak'], skyK: ['condorT'], scenes: ['llamaWalk'],
    P: { a: '#a8a090', b: '#c62828', c: '#ffca28', wall: '#b8b0a0', roof: '#c8a050', leaf: '#3f7a3a', wood: '#6d4c41', rock: '#a8a090' } }),
  t('정화의 대함대', '🚢', '1405년', '명나라 정화의 보물선 함대는 콜럼버스 배보다 몇 배나 컸고, 아프리카까지 갔어요', 6, {
    sky: ['#3a90d8', '#e0f4ff', '#80b0d0'], fog: [40, 360], light: 1.1, sun: '#ffffff', fx: 'none', mus: m('pent', 55, 100, 'triangle'),
    ground: ['#1a7aa8', '#3a9ac0', 'water', 0.05, 12], road: ['#a0784a', '#c62828', 'plank', 0],
    cast: { cross: ['mingSailor'], on: ['cargoCart'], big: ['treasureShip'], weave: ['seagullT'], wall: ['porcelainCrates'], hurdle: ['ropeCoil'], bar: ['sailBar'] },
    near: ['porcelainVase', 'compassStand', 'ropeCoilT'], mid: ['treasureShipT', 'giraffeT', 'dockPost'], far: ['treasureShipT', 'treasureShipT'], skyK: ['seagullT'], scenes: ['shipSail'],
    P: { a: '#c62828', b: '#1e88e5', c: '#f5f5f5', wall: '#e8d8c0', roof: '#c62828', leaf: '#3f6a3a', wood: '#8a5a3a', rock: '#9a8a78' } }),
  t('르네상스', '🎨', '15세기', '피렌체의 화가 · 조각가 · 발명가들이 사람과 자연을 새로운 눈으로 바라봤어요', 6, {
    sky: ['#5a98d8', '#fff0d8', '#d8b890'], fog: [40, 340], light: 1.15, sun: '#fff8e1', fx: 'petals', fxC: '#ffccbc', mus: m('major', 60, 100, 'triangle'),
    ground: ['#c8a878', '#b89868', 'stone', 0, 6], road: ['#d0b890', '#8a5a3a', 'brick', 0],
    cast: { cross: ['renaissanceArtist', 'florentine'], on: ['horseCart'], big: ['flyingMachineCart'], weave: ['horseRider'], wall: ['easelWall'], hurdle: ['paintPots'], bar: ['canvasBar'] },
    near: ['easel', 'marbleStatue', 'cypress'], mid: ['florenceHouse', 'davidStatue', 'artistAtWork'], far: ['duomo', 'tuscanHills'], skyK: ['ornithopter'], scenes: ['artistAtWork'],
    P: { a: '#c8784a', b: '#1565c0', c: '#c9a227', wall: '#e8d0a8', roof: '#b0522d', leaf: '#3f6a3a', wood: '#6d4c41', rock: '#d8c8a8' } }),
  t('구텐베르크 인쇄술', '📖', '1450년', '움직이는 쇠 활자 인쇄기로 책을 수천 권씩 찍게 되면서 지식이 퍼져 나갔어요', 6, {
    sky: ['#6a88a8', '#e8e0d0', '#7a7060'], fog: [24, 280], light: 0.95, fx: 'paper', fxC: '#fff8e1', mus: m('dorian', 55, 104, 'triangle'),
    ground: ['#6a6458', '#7a7466', 'stone', 0, 7], road: ['#8a8070', '#4a4438', 'cobble', 0],
    cast: { cross: ['printer', 'reader'], on: ['bookCart'], big: ['pressRoll'], weave: ['paperBoy'], wall: ['bookStackWall'], hurdle: ['bookRow'], bar: ['paperLine'] },
    near: ['bookPile', 'typeCase', 'lanternPost'], mid: ['printingPress', 'halfTimber', 'bookStall'], far: ['gothicSpire', 'halfTimber'], skyK: ['paperFly'], scenes: ['pressWork'],
    P: { a: '#8a5a3a', b: '#fff8e1', c: '#1a1a1a', wall: '#f0e6d0', roof: '#5a3a2a', leaf: '#3f6a3a', wood: '#5d4037', rock: '#8a8070' } }),
  t('대항해시대', '🧭', '1492년 ~', '나침반을 든 탐험가들의 범선이 대서양을 건너 새로운 땅에 닿았어요', 6, {
    sky: ['#3a88d8', '#e8f4ff', '#80a8c8'], fog: [40, 360], light: 1.1, sun: '#ffffff', fx: 'none', mus: m('major', 57, 108, 'triangle'),
    ground: ['#1a6a98', '#3a8ab8', 'water', 0.05, 12], road: ['#9a7048', '#5a3a20', 'plank', 0],
    cast: { cross: ['sailor'], on: ['cargoCart'], big: ['galleon'], weave: ['parrotT'], wall: ['cargoCrates'], hurdle: ['ropeCoil'], bar: ['sailBar'] },
    near: ['treasureChest', 'cannonT', 'globeStand'], mid: ['galleonT', 'palmT', 'dockPost'], far: ['galleonT', 'islandsFar'], skyK: ['seagullT'], scenes: ['landHo'],
    P: { a: '#8a5a3a', b: '#fafafa', c: '#c62828', wall: '#e8d8c0', roof: '#8a5a3a', leaf: '#3a8a3a', wood: '#6d4c41', rock: '#9a8a78' } }),

  // ===================== 제7장 근대 =====================
  t('종교개혁', '🔔', '1517년', '루터가 교회 문에 95개 조 반박문을 붙였고, 인쇄기가 그 생각을 유럽에 퍼뜨렸어요', 7, {
    sky: ['#6a88b0', '#e8e4d8', '#7a7468'], fog: [24, 280], light: 0.95, fx: 'paper', fxC: '#fff8e1', mus: m('dorian', 52, 96, 'triangle'),
    ground: ['#6a7a5a', '#7a8466', 'grass', 0, 8], road: ['#8a8478', '#4a4438', 'cobble', 0],
    cast: { cross: ['reformer', 'townsfolk'], on: ['horseCart'], big: ['pressRoll'], weave: ['paperBoy'], wall: ['churchDoorWall'], hurdle: ['bookRow'], bar: ['paperLine'] },
    near: ['thesesDoor', 'bookPile', 'lanternPost'], mid: ['gothicChurch', 'halfTimber', 'townsfolkCrowd'], far: ['gothicSpire'], skyK: ['paperFly'], scenes: ['bellRing'],
    P: { a: '#8a5a3a', b: '#fff8e1', c: '#3e2723', wall: '#e8dcc8', roof: '#4a3a3a', leaf: '#3f6a3a', wood: '#5d4037', rock: '#8a8478' } }),
  t('지동설', '🔭', '1543 · 1610년', '코페르니쿠스는 지구가 해를 돈다고 했고, 갈릴레이는 망원경으로 목성의 달을 봤어요', 7, {
    sky: ['#06103a', '#2a3a7a', '#020820'], fog: [30, 330], light: 0.75, stars: 1, fx: 'sparkles', fxC: '#fff9c4', mus: m('lydian', 60, 92, 'sine'),
    ground: ['#3a3a4a', '#4a4a5a', 'stone', 0, 7], road: ['#5a5a6a', '#ffd54f', 'cobble', 0.05],
    cast: { cross: ['astronomer'], on: ['horseCart'], big: ['orreryRoll'], weave: ['owlT'], wall: ['bookshelfWall'], hurdle: ['scrollRow'], bar: ['starArch'] },
    near: ['telescopeT', 'globeStand', 'bookPile'], mid: ['orrery', 'observatoryTower', 'astronomerAtWork'], far: ['observatoryTower'], skyK: ['jupiterMoons', 'crescentMoon'], scenes: ['planetsOrbit'],
    P: { a: '#ffd54f', b: '#1e3a8a', c: '#c9a227', wall: '#d8ccb8', roof: '#3a3a5a', leaf: '#2f4a3a', wood: '#5d4037', rock: '#6a6a7a' } }),
  t('30년 전쟁', '⚔️', '1618년', '종교와 권력을 두고 유럽 여러 나라가 30년 동안 전쟁을 벌였어요', 7, {
    sky: ['#5a5a6a', '#b8a898', '#3a3434'], fog: [20, 250], light: 0.8, fx: 'ash', fxC: '#bcaaa4', mus: m('minor', 45, 116, 'sawtooth'),
    ground: ['#5a6a4a', '#6a7050', 'mud', 0, 8], road: ['#6a6050', '#3a3428', 'dirt', 0],
    cast: { cross: ['musketeer', 'pikeman'], on: ['cannonCart'], big: ['cavalryCharge'], weave: ['cuirassier'], wall: ['gabionWall'], hurdle: ['fallenFence'], bar: ['pikeBar'] },
    near: ['drumT', 'cannonballs', 'flagStake'], mid: ['burningFarm', 'cannonT', 'pikeSquare'], far: ['burningFarm', 'starFort'], skyK: ['crowT'], scenes: ['cannonSmoke'],
    P: { a: '#c62828', b: '#1565c0', c: '#f5f5f5', wall: '#d8ccb0', roof: '#5a3a2a', leaf: '#3a5a3a', wood: '#4e342e', rock: '#7a7468' } }),
  t('과학 혁명', '🍎', '1687년', '뉴턴은 떨어지는 사과를 보고, 달과 사과를 같은 힘 — 만유인력으로 설명했어요', 7, {
    sky: ['#7ab0e0', '#f0f4e8', '#a8b888'], fog: [40, 330], light: 1.1, sun: '#ffffff', fx: 'leaves', fxC: '#e57373', mus: m('major', 62, 104, 'triangle'),
    ground: ['#6a9a4a', '#7aa858', 'grass', 0, 8], road: ['#a09070', '#5a5a3a', 'dirt', 0],
    cast: { cross: ['newtonian'], on: ['horseCart'], big: ['appleCart'], weave: ['appleRoll'], wall: ['hedgeWall'], hurdle: ['appleBasketRow'], bar: ['prismBar'] },
    near: ['appleBasket', 'prismStand', 'pendulum'], mid: ['appleTree', 'manorHouse', 'scientistAtWork'], far: ['appleTree', 'manorHouse'], skyK: ['moonBig'], scenes: ['appleFall'],
    P: { a: '#e53935', b: '#fff8e1', c: '#5d4037', wall: '#e8dcc0', roof: '#5a3a2a', leaf: '#3f7a3a', wood: '#5d4037', rock: '#9a9078' } }),
  t('계몽주의', '💡', '18세기', '사람들은 살롱에 모여 이성과 자유를 이야기하고, 열기구를 띄워 하늘을 날았어요', 7, {
    sky: ['#ffb070', '#ffeedd', '#c8a0a0'], fog: [40, 340], light: 1.1, sun: '#fff3e0', fx: 'paper', fxC: '#fff8e1', mus: m('major', 64, 108, 'triangle'),
    ground: ['#8aa070', '#9ab07a', 'grass', 0, 8], road: ['#c8b8a0', '#8a7a5a', 'cobble', 0],
    cast: { cross: ['enlightened', 'ladyWig'], on: ['carriage'], big: ['balloonCart'], weave: ['horseRider'], wall: ['bookshelfWall'], hurdle: ['bookRow'], bar: ['garlandBar'] },
    near: ['encyclopedia', 'candleCluster', 'salonChair'], mid: ['salonHouse', 'hotAirBalloonGround', 'gardenFountain'], far: ['palaceBaroque'], skyK: ['hotAirBalloon'], scenes: ['balloonLaunch'],
    P: { a: '#4fc3f7', b: '#ffca28', c: '#e91e63', wall: '#f4ead8', roof: '#4a5a7a', leaf: '#4a7a3a', wood: '#6d4c41', rock: '#c8bca4' } }),
  t('산업혁명', '🏭', '1769년 ~', '증기기관이 공장과 기차를 움직이며 세상이 빠르게 바뀌기 시작했어요', 7, {
    sky: ['#7a7a80', '#c8bcb0', '#4a4440'], fog: [20, 250], light: 0.85, fx: 'ash', fxC: '#9e9e9e', mus: m('dorian', 48, 120, 'square'),
    ground: ['#5a5450', '#6a6460', 'stone', 0, 7], road: ['#5a5048', '#8a8a8a', 'rail', 0],
    cast: { cross: ['factoryWorker', 'gentleman'], on: ['steamWagon'], big: ['steamLoco'], weave: ['penny'], wall: ['coalCrates'], hurdle: ['railTies'], bar: ['steamPipeBar'] },
    near: ['coalPile', 'gearT', 'gasLamp'], mid: ['factoryBrick', 'smokestackT', 'brickRowHouse'], far: ['factoryBrick', 'smokestackT'], skyK: ['smogCloud'], scenes: ['steamEngine'],
    P: { a: '#8a3a2a', b: '#c9a227', c: '#3a3a3a', wall: '#9a4a3a', roof: '#3a3a3a', leaf: '#3a4a3a', wood: '#4e342e', rock: '#6a6460' } }),
  t('미국 독립', '🔔', '1776년', '13개 식민지가 독립을 선언하며 "모든 사람은 평등하게 태어났다"고 썼어요', 7, {
    sky: ['#5a98d8', '#f0f4f8', '#b8b8a8'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'confetti', fxC: '#ffffff', mus: m('major', 60, 116, 'triangle'),
    ground: ['#6a9a4a', '#7aa858', 'grass', 0, 8], road: ['#b0a088', '#7a6a50', 'cobble', 0],
    cast: { cross: ['colonist', 'minuteman'], on: ['carriage'], big: ['cannonCart'], weave: ['horseRider'], wall: ['crateWallT'], hurdle: ['fallenFence'], bar: ['bannerBar13'] },
    near: ['libertyBell', 'drumT', 'flagStake13'], mid: ['independenceHall', 'colonialHouse', 'quillDesk'], far: ['independenceHall'], skyK: ['eagleT'], scenes: ['declarationSign'],
    P: { a: '#b22234', b: '#3c3b6e', c: '#f5f5f5', wall: '#b0522d', roof: '#4a4a4a', leaf: '#3f7a3a', wood: '#6d4c41', rock: '#b0a088' } }),
  t('프랑스 혁명', '🇫🇷', '1789년', '파리 시민들이 바스티유를 무너뜨리며 "자유 · 평등 · 박애"를 외쳤어요', 7, {
    sky: ['#6a88b8', '#e8e0e8', '#8a7878'], fog: [24, 280], light: 0.95, fx: 'confetti', fxC: '#ffffff', mus: m('minor', 52, 124, 'square'),
    ground: ['#7a7466', '#8a8476', 'stone', 0, 7], road: ['#8a8478', '#4a4438', 'cobble', 0],
    cast: { cross: ['revolutionary', 'sansCulotte'], on: ['carriage'], big: ['cannonCart'], weave: ['drummerBoy'], wall: ['barricadeFr'], hurdle: ['barrelRow'], bar: ['tricolorBar'] },
    near: ['tricolorFlagT', 'barrelT', 'cobbleHeap'], mid: ['bastille', 'parisHouse', 'barricadeT'], far: ['bastille', 'notreDame'], skyK: ['doveT'], scenes: ['stormBastille'],
    P: { a: '#0055a4', b: '#ef4135', c: '#f5f5f5', wall: '#d8ccb0', roof: '#4a5a6a', leaf: '#3f6a3a', wood: '#5d4037', rock: '#9a9488' } }),
  t('나폴레옹', '🎖️', '1804년 ~', '나폴레옹의 군대가 유럽을 휩쓸었고, 그가 만든 법전은 오늘날 많은 나라 법의 바탕이 됐어요', 7, {
    sky: ['#7a98c0', '#e8e4dc', '#8a8070'], fog: [30, 300], light: 1.0, fx: 'ash', fxC: '#e0e0e0', mus: m('minor', 50, 120, 'square'),
    ground: ['#6a8a4a', '#7a9058', 'grass', 0, 9], road: ['#8a8070', '#5a5040', 'dirt', 0],
    cast: { cross: ['grenadier'], on: ['cannonCart'], big: ['cavalryCharge'], weave: ['hussar'], wall: ['gabionWall'], hurdle: ['drumRow'], bar: ['eagleStandardBar'] },
    near: ['drumT', 'cannonballs', 'tricolorFlagT'], mid: ['cannonT', 'arcDeTriomphe', 'grenadierLine'], far: ['arcDeTriomphe', 'battleSmoke'], skyK: ['eagleT'], scenes: ['cannonSmoke'],
    P: { a: '#1a3a8a', b: '#f5f5f5', c: '#c62828', wall: '#e0d8c8', roof: '#4a5a6a', leaf: '#3f6a3a', wood: '#5d4037', rock: '#9a9078' } }),
  t('노예제 폐지', '⛓️', '1833 · 1865년', '오랜 싸움 끝에 노예제가 폐지되고, 끊어진 쇠사슬은 자유의 상징이 됐어요', 7, {
    sky: ['#ffb070', '#fff0d8', '#c8a080'], fog: [40, 340], light: 1.1, sun: '#fff3d0', fx: 'petals', fxC: '#fff59d', mus: m('major', 57, 92, 'triangle'),
    ground: ['#8a9a5a', '#9aa868', 'grass', 0, 8], road: ['#b0a080', '#6a5a40', 'dirt', 0],
    cast: { cross: ['freedPerson'], on: ['carriage'], big: ['trainOld'], weave: ['horseRider'], wall: ['fenceWhite'], hurdle: ['brokenChain'], bar: ['freedomBanner'] },
    near: ['brokenChainT', 'sunflowerT', 'churchBell'], mid: ['whiteChurch', 'singingCrowd', 'oakTree'], far: ['oakTree'], skyK: ['doveT'], scenes: ['freedomSong'],
    P: { a: '#ffca28', b: '#fff8e1', c: '#5d4037', wall: '#f5f5f5', roof: '#6a4a3a', leaf: '#4a7a3a', wood: '#6d4c41', rock: '#9a9078' } }),
  t('다윈 진화론', '🐢', '1859년', '비글호를 타고 갈라파고스에 간 다윈은 생물이 조금씩 변해 왔다는 진화론을 펼쳤어요', 7, {
    sky: ['#4aa8e0', '#e8f8f0', '#80b8a8'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'none', mus: m('lydian', 60, 100, 'triangle'),
    ground: ['#5a6a50', '#4a5a40', 'rock', 0, 8], road: ['#8a8070', '#3a4a3a', 'dirt', 0],
    cast: { cross: ['naturalist'], on: ['giantTortoise'], big: ['beagleShip'], weave: ['finchT'], wall: ['cactusWall'], hurdle: ['iguanaRow'], bar: ['branchLow'] },
    near: ['marineIguana', 'finchT', 'cactusOpuntia'], mid: ['giantTortoiseT', 'beagleShipT', 'treeOfLife'], far: ['galapagosIsland'], skyK: ['frigateBird'], scenes: ['darwinSketch'],
    P: { a: '#5a6a50', b: '#fff8e1', c: '#3a6a8a', wall: '#e8dcc0', roof: '#5a3a2a', leaf: '#4a7a3a', wood: '#6d4c41', rock: '#4a4a44' } }),
  t('전기의 시대', '💡', '1879년', '전구가 밤을 밝히고, 전화로 먼 곳의 목소리를 들을 수 있게 됐어요', 7, {
    sky: ['#101830', '#3a4a7a', '#05081a'], fog: [24, 300], light: 0.75, stars: 0.6, fx: 'fireflies', fxC: '#fff59d', mus: m('major', 62, 112, 'square'),
    ground: ['#4a4a50', '#5a5a60', 'stone', 0, 7], road: ['#5a5448', '#ffd54f', 'cobble', 0.1],
    cast: { cross: ['inventor', 'victorian'], on: ['carriage'], big: ['tram'], weave: ['penny'], wall: ['crateWallT'], hurdle: ['cableRowOld'], bar: ['wireBar'] },
    near: ['lightBulbPost', 'teslaCoilSmall', 'phoneBooth'], mid: ['teslaCoil', 'brickRowHouse', 'telegraphPole'], far: ['electricCity'], skyK: [], scenes: ['teslaSpark'],
    P: { a: '#ffd54f', b: '#4fc3f7', c: '#3a3a3a', wall: '#8a4a3a', roof: '#3a3a3a', leaf: '#3a4a3a', wood: '#4e342e', rock: '#6a6460' } }),
  t('첫 비행', '✈️', '1903년', '라이트 형제의 비행기가 12초 동안 하늘을 날았어요. 인류가 처음 하늘을 난 순간이에요', 7, {
    sky: ['#4aa0e8', '#e8f4ff', '#d8d0b8'], fog: [40, 360], light: 1.15, sun: '#ffffff', fx: 'none', mus: m('lydian', 64, 116, 'triangle'),
    ground: ['#e0d0a8', '#d0c098', 'sand', 0, 10], road: ['#c8b890', '#8a7a5a', 'plank', 0],
    cast: { cross: ['aviator'], on: ['biplaneTaxi'], big: ['biplaneTaxi'], weave: ['bicycleOld'], wall: ['crateWallT'], hurdle: ['launchRail'], bar: ['wingBar'] },
    near: ['dunGrass', 'windsock', 'toolCrate'], mid: ['woodenHangar', 'wrightFlyerT', 'duneSmall'], far: ['duneBig'], skyK: ['wrightFlyerSky', 'seagullT'], scenes: ['firstFlight'],
    P: { a: '#f5f0e0', b: '#8d6e63', c: '#c62828', wall: '#c8a878', roof: '#8a6a4a', leaf: '#6a8a4a', wood: '#8d6e63', rock: '#c8b890' } }),

  // ===================== 제8장 현대 =====================
  t('제1차 세계대전', '🌺', '1914년', '참호와 철조망의 전쟁. 전쟁이 끝난 들판에는 붉은 양귀비가 피어 희생을 기억해요', 8, {
    sky: ['#6a6a60', '#b0a890', '#3a3830'], fog: [18, 240], light: 0.8, fx: 'ash', fxC: '#bdbdbd', mus: m('minor', 43, 96, 'sawtooth'),
    ground: ['#5a5440', '#6a6048', 'mud', 0, 8], road: ['#6a5a40', '#3a3020', 'plank', 0],
    cast: { cross: ['ww1Soldier'], on: ['ww1Truck'], big: ['ww1Tank'], weave: ['messengerDog'], wall: ['sandbagWall'], hurdle: ['barbedRow'], bar: ['trenchBeam'] },
    near: ['poppyPatch', 'sandbagsT', 'barbedT'], mid: ['trenchLine', 'ww1TankT', 'craterBig'], far: ['ruinedTown'], skyK: ['biplaneSky'], scenes: ['poppyWind'],
    P: { a: '#c62828', b: '#5a6a3a', c: '#3e2723', wall: '#8a7a6a', roof: '#4a3a2a', leaf: '#3a4a2a', wood: '#4e342e', rock: '#6a6458' } }),
  t('대공황', '📉', '1929년', '주식 시장이 무너지며 세계 곳곳에 일자리를 잃은 사람들의 긴 줄이 생겼어요', 8, {
    sky: ['#5a6070', '#b8b4a8', '#3a3a40'], fog: [20, 260], light: 0.8, fx: 'paper', fxC: '#e0e0e0', mus: m('minor', 50, 88, 'triangle'),
    ground: ['#5a5a5a', '#6a6a6a', 'asphalt', 0, 8], road: ['#4a4a4a', '#c8c8c8', 'asphalt', 0],
    cast: { cross: ['depressionMan', 'newsboy'], on: ['carVintage'], big: ['tram'], weave: ['bicycleOld'], wall: ['crateWallT'], hurdle: ['crateRowT'], bar: ['newspaperLine'] },
    near: ['radioSet', 'newsStand', 'streetLampOld'], mid: ['breadLine', 'artDecoTower', 'bankFront'], far: ['skylineDeco'], skyK: ['paperFly'], scenes: ['breadLine'],
    P: { a: '#8a8a8a', b: '#ffca28', c: '#3a3a3a', wall: '#b0a898', roof: '#4a4a4a', leaf: '#4a5a4a', wood: '#5d4037', rock: '#7a7a7a' } }),
  t('제2차 세계대전', '🕊️', '1939년', '역사상 가장 큰 전쟁으로 수천만 명이 희생됐어요. 다시는 되풀이하지 않기로 다짐했죠', 8, {
    sky: ['#5a5a68', '#a8a098', '#2a2a30'], fog: [18, 240], light: 0.8, fx: 'ash', fxC: '#bdbdbd', mus: m('minor', 41, 104, 'sawtooth'),
    ground: ['#5a5a48', '#6a6450', 'mud', 0, 8], road: ['#5a5a50', '#2a2a24', 'asphalt', 0],
    cast: { cross: ['ww2Soldier'], on: ['jeepT'], big: ['ww2Tank'], weave: ['motorcycleWW2'], wall: ['sandbagWall'], hurdle: ['czechHedgehog'], bar: ['trenchBeam'] },
    near: ['sandbagsT', 'helmetOnRifle', 'czechHedgehogT'], mid: ['ruinedBuilding', 'ww2TankT', 'searchlight'], far: ['ruinedTown', 'landingShips'], skyK: ['bomberSky'], scenes: ['searchlightSweep'],
    P: { a: '#4b5a2a', b: '#c62828', c: '#3a3a3a', wall: '#9a9080', roof: '#4a4a4a', leaf: '#3a4a2a', wood: '#4e342e', rock: '#6a6458' } }),
  t('원자력의 시대와 국제연합', '🇺🇳', '1945년', '원자폭탄의 비극을 겪은 세계는 평화를 지키기 위해 국제연합을 만들었어요', 8, {
    sky: ['#5a98d8', '#e8f4ff', '#a8c0d8'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'petals', fxC: '#ffffff', mus: m('lydian', 60, 92, 'sine'),
    ground: ['#6a9a5a', '#7aa868', 'grass', 0, 8], road: ['#a8b0b8', '#4b92db', 'tile', 0],
    cast: { cross: ['diplomat'], on: ['carVintage'], big: ['tram'], weave: ['doveLow'], wall: ['flagWall'], hurdle: ['flowerPlanter'], bar: ['unBanner'] },
    near: ['flagPoleRow', 'peaceDove', 'flowerPlanterT'], mid: ['unBuilding', 'flagPoleRow', 'peaceMonument'], far: ['unBuilding', 'mushroomCloudFar'], skyK: ['doveT'], scenes: ['doveRelease'],
    P: { a: '#4b92db', b: '#ffffff', c: '#3a3a3a', wall: '#d8dce0', roof: '#5a6a7a', leaf: '#4a7a3a', wood: '#5d4037', rock: '#a8b0b8' } }),
  t('독립의 물결', '🎉', '1947년 ~', '아시아와 아프리카의 많은 나라가 식민지에서 벗어나 새 깃발을 올렸어요', 8, {
    sky: ['#ffa060', '#fff0d0', '#d8a070'], fog: [40, 340], light: 1.1, sun: '#fff8e1', fx: 'confetti', fxC: '#ffffff', mus: m('major', 62, 120, 'triangle'),
    ground: ['#b8a060', '#c8b070', 'grass', 0, 8], road: ['#c8a878', '#7a5a3a', 'dirt', 0],
    cast: { cross: ['celebrant'], on: ['truckParade'], big: ['paradeFloat'], weave: ['bicycleOld'], wall: ['flagWall'], hurdle: ['drumRow'], bar: ['bunting'] },
    near: ['flagStakeMix', 'drumT', 'palmT'], mid: ['celebrateCrowd', 'flagPoleRow', 'marketStall'], far: ['newCapitol'], skyK: ['confettiBurst'], scenes: ['flagRaise'],
    P: { a: '#ff9933', b: '#138808', c: '#ffffff', wall: '#e8d8b8', roof: '#c08050', leaf: '#4a8a3a', wood: '#6d4c41', rock: '#b8a070' } }),
  t('스푸트니크', '🛰️', '1957년', '첫 인공위성 스푸트니크가 "삐-삐-" 신호를 보내며 우주 시대가 열렸어요', 8, {
    sky: ['#05081a', '#1a2a5a', '#02040d'], fog: [30, 340], light: 0.7, stars: 1, fx: 'sparkles', fxC: '#ffffff', mus: m('whole', 60, 104, 'sine'),
    ground: ['#4a5a6a', '#5a6a7a', 'snow', 0, 10], road: ['#5a6070', '#ff5252', 'asphalt', 0],
    cast: { cross: ['engineer'], on: ['rocketTruck'], big: ['rocketTransport'], weave: ['sputnikLow'], wall: ['crateWallT'], hurdle: ['cableRowOld'], bar: ['gantryBar'] },
    near: ['radioDish', 'fuelTank', 'antennaMast'], mid: ['launchGantry', 'radioDishBig', 'controlBunker'], far: ['launchGantry'], skyK: ['sputnik', 'sputnik'], scenes: ['rocketLaunch'],
    P: { a: '#c62828', b: '#cfd8dc', c: '#3a3a3a', wall: '#8a8a8a', roof: '#5a5a5a', leaf: '#3a4a3a', wood: '#5d4037', rock: '#7a7a7a' } }),
  t('달 착륙', '🌕', '1969년', '"한 사람에게는 작은 발걸음이지만, 인류에게는 위대한 도약이다." 사람이 처음 달을 걸었어요', 8, {
    sky: ['#000000', '#05050a', '#000000'], fog: [60, 420], light: 1.0, stars: 1, sun: '#ffffff', fx: 'none', mus: m('lydian', 62, 80, 'sine'),
    ground: ['#9a9a9a', '#7a7a7a', 'moon', 0, 10], road: ['#b0b0b0', '#5a5a5a', 'dirt', 0],
    cast: { cross: ['astronaut'], on: ['lunarRover'], big: ['lunarLander'], weave: ['astronautHop'], wall: ['moonRockWall'], hurdle: ['craterRim2'], bar: ['antennaBar'] },
    near: ['bootprint', 'moonRock', 'flagPlanted'], mid: ['lunarLanderT', 'craterBig', 'roverT'], far: ['moonMountains'], skyK: ['earthRise'], scenes: ['moonHop'],
    P: { a: '#9a9a9a', b: '#ffffff', c: '#ffc107', wall: '#bdbdbd', roof: '#9e9e9e', leaf: '#5a5a5a', wood: '#5d4037', rock: '#8a8a8a' } }),
  t('개인용 컴퓨터', '💾', '1977년 ~', '방 하나만 하던 컴퓨터가 책상 위로 올라왔어요. 오락실엔 픽셀 게임이 반짝였죠', 8, {
    sky: ['#1a0a3a', '#ff4fd8', '#0a0520'], fog: [24, 300], light: 0.9, fx: 'static', fxC: '#00e5ff', mus: m('pent', 64, 132, 'square'),
    ground: ['#140a2a', '#ff4fd8', 'circuit', 0.4, 8], road: ['#1a1a3a', '#00e5ff', 'metal', 0.4],
    cast: { cross: ['programmer'], on: ['arcadeCabinet'], big: ['mainframe'], weave: ['floppyT'], wall: ['crtWall'], hurdle: ['cableRowOld'], bar: ['pixelBar'] },
    near: ['floppyStack', 'crtPC', 'joystickT'], mid: ['arcadeRow', 'crtPC', 'pixelInvader'], far: ['pixelCity'], skyK: ['pixelInvader'], scenes: ['arcadePlay'],
    P: { a: '#00e5ff', b: '#ff4fd8', c: '#ffeb3b', wall: '#2a2a4a', roof: '#1a1a3a', leaf: '#00e676', wood: '#5d4037', rock: '#3a3a5a' } }),
  t('베를린 장벽 붕괴', '🧱', '1989년', '28년 동안 도시를 갈랐던 베를린 장벽이 무너지고, 사람들은 망치를 들고 춤을 췄어요', 8, {
    sky: ['#1a1a3a', '#6a4a8a', '#0a0a1a'], fog: [24, 300], light: 0.8, stars: 0.5, fx: 'confetti', fxC: '#ffffff', mus: m('major', 60, 124, 'square'),
    ground: ['#5a5a60', '#6a6a70', 'asphalt', 0, 8], road: ['#4a4a50', '#ffffff', 'asphalt', 0],
    cast: { cross: ['berliner'], on: ['trabant'], big: ['wallSegmentRoll'], weave: ['bicycleOld'], wall: ['graffitiWall'], hurdle: ['wallRubble'], bar: ['bunting'] },
    near: ['wallChunk', 'champagne', 'streetLampOld'], mid: ['berlinWallT', 'brandenburgGate', 'partyCrowd'], far: ['brandenburgGate', 'tvTower'], skyK: ['fireworks'], scenes: ['wallBreak'],
    P: { a: '#ffeb3b', b: '#ff4081', c: '#40c4ff', wall: '#c8c8c8', roof: '#5a5a5a', leaf: '#3a5a3a', wood: '#5d4037', rock: '#8a8a8a' } }),
  t('인터넷', '🌐', '1991년', '월드 와이드 웹이 열려 세상의 모든 컴퓨터가 빛의 선으로 이어지기 시작했어요', 8, {
    sky: ['#020a20', '#0a3a6a', '#010510'], fog: [30, 340], light: 0.85, stars: 0.6, fx: 'code', fxC: '#40c4ff', mus: m('lydian', 62, 120, 'square'),
    ground: ['#05102a', '#40c4ff', 'circuit', 0.5, 8], road: ['#0a2040', '#40c4ff', 'metal', 0.5],
    cast: { cross: ['netizen'], on: ['dataPacket'], big: ['serverRack'], weave: ['emailT'], wall: ['firewallT'], hurdle: ['cableRowOld'], bar: ['wifiBar'] },
    near: ['modem', 'emailT', 'routerT'], mid: ['serverRackT', 'linkTower', 'globeNet'], far: ['globeNet'], skyK: ['emailT'], scenes: ['dataFlow'],
    P: { a: '#40c4ff', b: '#00e676', c: '#ffeb3b', wall: '#1a2a4a', roof: '#0a1a3a', leaf: '#00e676', wood: '#5d4037', rock: '#2a3a5a' } }),
  t('인간 게놈', '🧬', '2003년', '사람의 DNA 30억 글자를 처음으로 다 읽어냈어요. 생명의 설계도예요', 8, {
    sky: ['#0a2a2a', '#3ac8b8', '#051414'], fog: [30, 320], light: 1.0, fx: 'bubbles', fxC: '#a7ffeb', mus: m('lydian', 64, 104, 'sine'),
    ground: ['#e0f2f1', '#b2dfdb', 'tiles', 0, 4], road: ['#ffffff', '#26a69a', 'tile', 0.1],
    cast: { cross: ['scientist'], on: ['labCart'], big: ['dnaRoll'], weave: ['cellT'], wall: ['labBench'], hurdle: ['testTubeRow'], bar: ['dnaBar'] },
    near: ['microscopeT', 'testTubeRack', 'petriDish'], mid: ['dnaHelix', 'labBuilding', 'scientistAtWork'], far: ['dnaHelix'], skyK: ['cellT'], scenes: ['dnaSpin'],
    P: { a: '#26a69a', b: '#ff4081', c: '#40c4ff', wall: '#f5f5f5', roof: '#b2dfdb', leaf: '#4db6ac', wood: '#5d4037', rock: '#b0bec5' } }),
  t('스마트폰', '📱', '2007년', '손안의 작은 화면으로 사진 · 지도 · 음악 · 친구까지, 세상이 주머니 속에 들어왔어요', 8, {
    sky: ['#3a7ad8', '#e8f0ff', '#a8b8d8'], fog: [40, 340], light: 1.1, sun: '#ffffff', fx: 'sparkles', fxC: '#80d8ff', mus: m('major', 64, 116, 'triangle'),
    ground: ['#8a9aa8', '#9aaab8', 'tiles', 0, 6], road: ['#5a6070', '#ffffff', 'asphalt', 0],
    cast: { cross: ['phoneUser'], on: ['carModern'], big: ['busModern'], weave: ['scooterE'], wall: ['phoneWall'], hurdle: ['appIconRow'], bar: ['notifBar'] },
    near: ['giantPhone', 'appIcon', 'benchModern'], mid: ['glassTower', 'phoneUserGroup', 'billboardApp'], far: ['skylineModern'], skyK: ['appIcon'], scenes: ['selfie'],
    P: { a: '#40c4ff', b: '#ff4081', c: '#ffeb3b', wall: '#9ec8e8', roof: '#5a7a9a', leaf: '#4a8a3a', wood: '#5d4037', rock: '#8a9aa8' } }),
  t('팬데믹', '😷', '2020년', '세계가 멈춘 듯 거리는 텅 비었지만, 사람들은 창가에서 서로를 응원하고 백신을 만들었어요', 8, {
    sky: ['#6a8ab8', '#e0e8f0', '#9aa8b8'], fog: [30, 320], light: 1.0, fx: 'sparkles', fxC: '#e1f5fe', mus: m('lydian', 57, 84, 'sine'),
    ground: ['#8a9098', '#9aa0a8', 'tiles', 0, 6], road: ['#6a7078', '#ffffff', 'asphalt', 0],
    cast: { cross: ['maskedPerson'], on: ['ambulance'], big: ['busModern'], weave: ['deliveryBike'], wall: ['distanceSign'], hurdle: ['coneRow'], bar: ['tapeBar'] },
    near: ['vaccineVial', 'handSanitizer', 'heartSign'], mid: ['apartmentBalcony', 'hospital', 'emptyStreetLamp'], far: ['skylineModern'], skyK: ['rainbowArc'], scenes: ['balconyCheer'],
    P: { a: '#40c4ff', b: '#ff8a80', c: '#ffffff', wall: '#d8dce0', roof: '#7a8a9a', leaf: '#4a8a3a', wood: '#5d4037', rock: '#9aa0a8' } }),
  t('AI의 시대', '🤖', '2022년 ~', '사람처럼 말하고 그림을 그리는 AI가 나타났어요. 이제 인류와 AI는 어떤 이야기를 쓸까요?', 8, {
    sky: ['#0a0a2a', '#6a3ac8', '#05051a'], fog: [30, 340], light: 0.9, stars: 0.4, fx: 'code', fxC: '#b388ff', mus: m('lydian', 64, 112, 'sine'),
    ground: ['#0a0a24', '#b388ff', 'circuit', 0.5, 8], road: ['#141432', '#b388ff', 'metal', 0.5],
    cast: { cross: ['robotHelper'], on: ['selfDrivingCar'], big: ['dataCenterRoll'], weave: ['drone'], wall: ['serverRackWall'], hurdle: ['cableRow'], bar: ['neuralBar'] },
    near: ['chatBubble', 'robotArm', 'gpuChip'], mid: ['dataCenter', 'neuralTree', 'robotHelperT'], far: ['dataCenter', 'skylineFuture'], skyK: ['chatBubble'], scenes: ['robotArmWork'],
    P: { a: '#b388ff', b: '#40c4ff', c: '#ffffff', wall: '#2a2a4a', roof: '#1a1a3a', leaf: '#7c4dff', wood: '#5d4037', rock: '#3a3a5a' } }),

  // ===================== 제9장 미래 (이야기) =====================
  t('화성 이주', '🔴', '2050년?', '사람들이 붉은 행성 화성에 유리 돔 도시를 짓고 두 번째 고향을 만들어요', 9, {
    sky: ['#c87a4a', '#f0c8a0', '#8a4a2a'], fog: [30, 320], light: 1.0, sun: '#fff0e0', fx: 'dust', fxC: '#ffab91', mus: m('lydian', 57, 96, 'sine'),
    ground: ['#b8603a', '#c87048', 'mars', 0, 10], road: ['#8a5a4a', '#ffffff', 'metal', 0.2],
    cast: { cross: ['marsColonist'], on: ['marsRover'], big: ['marsHabitat'], weave: ['droneMars'], wall: ['habitatWall'], hurdle: ['marsRockRow'], bar: ['solarPanelBar'] },
    near: ['marsRock', 'solarPanel', 'oxygenTank'], mid: ['marsDome', 'marsRoverT', 'greenhouseDome'], far: ['olympusMons', 'marsDome'], skyK: ['phobos'], scenes: ['dustStorm'],
    P: { a: '#ff7043', b: '#ffffff', c: '#4fc3f7', wall: '#e0e0e0', roof: '#b0bec5', leaf: '#66bb6a', wood: '#5d4037', rock: '#a0502a' } }),
  t('특이점', '👁️', '2045년?', 'AI가 스스로를 고치며 사람보다 똑똑해지는 날, 세상의 모든 화면에 하나의 눈이 떠요', 9, {
    sky: ['#000010', '#3a00a0', '#000008'], fog: [24, 300], light: 0.85, stars: 0.3, fx: 'code', fxC: '#e040fb', mus: m('whole', 52, 120, 'sawtooth'),
    ground: ['#05001a', '#e040fb', 'circuit', 0.7, 6], road: ['#0a0028', '#e040fb', 'metal', 0.7],
    cast: { cross: ['dataGhost'], on: ['robotWalker'], big: ['aiEyeRoll'], weave: ['drone'], wall: ['laserFence'], hurdle: ['cableRow'], bar: ['scanBeam'] },
    near: ['glitchCube', 'screenPost', 'cableBundle'], mid: ['aiMonolith', 'screenTower', 'glitchCube'], far: ['aiEye'], skyK: ['dataStorm'], scenes: ['eyeOpen'],
    P: { a: '#e040fb', b: '#00e5ff', c: '#ffffff', wall: '#1a0a3a', roof: '#0a0028', leaf: '#e040fb', wood: '#3a3a3a', rock: '#2a1a4a' } }),
  t('기계 도시', '🏙️', '2080년?', 'AI가 다스리는 금속 도시. 드론이 하늘을 덮고 로봇들이 끝없이 순찰해요', 9, {
    sky: ['#2a2a30', '#6a6a78', '#141418'], fog: [18, 240], light: 0.7, fx: 'ash', fxC: '#9e9e9e', mus: m('dim', 40, 116, 'sawtooth'),
    ground: ['#3a3a40', '#4a4a52', 'metal', 0.1, 6], road: ['#2a2a30', '#ff1744', 'metal', 0.5],
    cast: { cross: ['patrolBot'], on: ['robotWalker'], big: ['mech'], weave: ['drone'], wall: ['laserFence'], hurdle: ['cableRow'], bar: ['scanBeam'] },
    near: ['surveillanceCam', 'cableBundle', 'warningSign'], mid: ['machineTower', 'factoryArm', 'patrolBotT'], far: ['machineTower', 'smogStack'], skyK: ['droneSwarm'], scenes: ['patrolSweep'],
    P: { a: '#ff1744', b: '#9e9e9e', c: '#00e5ff', wall: '#4a4a52', roof: '#2a2a30', leaf: '#5a5a5a', wood: '#3a3a3a', rock: '#3a3a40' } }),
  t('마지막 숲', '🌳', '2090년?', '도시 너머 마지막 숲에 젤리 베어들이 숨어 살며 반격을 준비해요', 9, {
    sky: ['#0a2a2a', '#3a8a6a', '#051a14'], fog: [16, 220], light: 0.7, stars: 0.5, fx: 'fireflies', fxC: '#ccff90', mus: m('lydian', 59, 96, 'triangle'),
    ground: ['#1a4a2a', '#2a5a34', 'moss', 0.05, 8], road: ['#3a3020', '#76ff03', 'moss', 0.2],
    cast: { cross: ['jellyScout'], on: ['jellyCart'], big: ['treeHouseRoll'], weave: ['fireflyBug'], wall: ['vineWall'], hurdle: ['rootRow'], bar: ['ropeBridgeBar'] },
    near: ['glowMushroom', 'jellyTent', 'lanternJelly'], mid: ['ancientTree', 'treeHouse', 'jellyCamp'], far: ['ancientTree', 'machineTowerFar'], skyK: ['fireflySky'], scenes: ['jellyBriefing'],
    P: { a: '#76ff03', b: '#ffeb3b', c: '#ff4081', wall: '#8d6e63', roof: '#4a7a3a', leaf: '#2e7d32', wood: '#5d4037', rock: '#3a5a3a' } }),
  t('젤리 베어 대반격', '🍬', '2099년?', '사탕 대포와 무지개 방패를 든 젤리 베어 군단이 기계 군단에 맞서 일어났어요!', 9, {
    sky: ['#2a0a3a', '#ff4fa8', '#14051e'], fog: [24, 280], light: 0.95, fx: 'confetti', fxC: '#ffffff', mus: m('major', 62, 140, 'square'),
    ground: ['#3a2a4a', '#5a3a6a', 'metal', 0.1, 7], road: ['#4a2a5a', '#ffeb3b', 'light', 0.4],
    cast: { cross: ['jellyWarrior'], on: ['robotWalker'], big: ['mech'], weave: ['drone'], wall: ['candyShieldWall'], hurdle: ['brokenBotRow'], bar: ['rainbowBar'] },
    near: ['candyCannon', 'brokenBot', 'lollipopT'], mid: ['jellyVsRobot', 'candyCannon', 'machineTower'], far: ['machineTower', 'rainbowArc'], skyK: ['candyMissile'], scenes: ['jellyVsRobot'],
    P: { a: '#ff4fa8', b: '#ffeb3b', c: '#40c4ff', wall: '#5a5a62', roof: '#3a3a42', leaf: '#76ff03', wood: '#5d4037', rock: '#4a4a52' } }),
  t('AI 코어 돌파', '💠', '2100년?', '빛나는 회로의 길을 달려 AI의 심장, 코어에 닿아요. 마지막 문이 열려요', 9, {
    sky: ['#000014', '#0050c8', '#00000a'], fog: [24, 300], light: 1.0, stars: 0.3, fx: 'sparkles', fxC: '#80d8ff', mus: m('lydian', 64, 132, 'sawtooth'),
    ground: ['#00051a', '#00b0ff', 'circuit', 0.8, 6], road: ['#001030', '#00e5ff', 'light', 0.6],
    cast: { cross: ['dataGhost'], on: ['robotWalker'], big: ['coreGuardian'], weave: ['drone'], wall: ['laserFence'], hurdle: ['cableRow'], bar: ['scanBeam'] },
    near: ['circuitPillar', 'dataShard', 'cableBundle'], mid: ['circuitPillar', 'coreRing', 'laserGate'], far: ['aiCore'], skyK: ['dataShard'], scenes: ['coreSurge'],
    P: { a: '#00e5ff', b: '#ffffff', c: '#e040fb', wall: '#0a1a3a', roof: '#001030', leaf: '#00e5ff', wood: '#3a3a3a', rock: '#0a1a3a' } }),
  t('새로운 새벽', '🌅', '2101년?', '싸움이 끝나고, 젤리와 로봇이 함께 무너진 도시에 꽃을 심어요. 서로를 이해하게 됐거든요', 9, {
    sky: ['#ff9a6a', '#ffe8d0', '#ffb8a0'], fog: [40, 340], light: 1.1, sun: '#fff3e0', fx: 'petals', fxC: '#ffccbc', mus: m('major', 64, 96, 'triangle'),
    ground: ['#6a9a5a', '#8ab870', 'grass', 0, 8], road: ['#c8b8a8', '#ffccbc', 'tile', 0],
    cast: { cross: ['jellyGardener', 'robotGardener'], on: ['flowerCart'], big: ['friendlyMech'], weave: ['butterflyT'], wall: ['flowerHedge'], hurdle: ['flowerPlanter'], bar: ['flowerArch'] },
    near: ['flowerBed', 'wateringCan', 'sproutT'], mid: ['plantingTogether', 'overgrownTower', 'cherryTree'], far: ['overgrownTower', 'sunriseHills'], skyK: ['birdFlock'], scenes: ['plantingTogether'],
    P: { a: '#ff8a80', b: '#fff59d', c: '#80d8ff', wall: '#c8c8d0', roof: '#7a8a9a', leaf: '#4caf50', wood: '#6d4c41', rock: '#9a9aa8' } }),
  t('별을 향해', '🚀', '2200년?', '젤리와 로봇이 함께 만든 우주선을 타고, 이제 함께 은하 너머로 떠나요', 9, {
    sky: ['#05051a', '#3a2a8a', '#02020d'], fog: [40, 400], light: 0.95, stars: 1, fx: 'sparkles', fxC: '#ffffff', mus: m('lydian', 67, 108, 'sine'),
    ground: ['#0a0a2a', '#7c4dff', 'nebula', 0.4, 20], road: ['#1a1a4a', '#ffd54f', 'light', 0.6],
    cast: { cross: ['jellyAstronaut'], on: ['starShuttle'], big: ['starship'], weave: ['comet'], wall: ['energyWall'], hurdle: ['plasmaRidge'], bar: ['lightBeam'] },
    near: ['starlet', 'launchPadLight', 'jellyAstronautT'], mid: ['starshipT', 'galaxySmallGround', 'planetRing'], far: ['galaxyDisc', 'starshipT'], skyK: ['planetSky', 'galaxySmall'], scenes: ['starshipLaunch'],
    P: { a: '#7c4dff', b: '#ffd54f', c: '#40c4ff', wall: '#e0e0f0', roof: '#7c4dff', leaf: '#76ff03', wood: '#5d4037', rock: '#3a3a5a' } }),
  t('또 다른 빅뱅', '🌀', '그리고 다시…', '모든 빛이 다시 한 점으로 모여요. 그리고 — 새로운 우주가 시작돼요', 9, {
    sky: ['#000000', '#ffffff', '#ffd180'], fog: [30, 280], light: 1.1, stars: 0.6, fx: 'rise', fxC: '#ffffff', mus: m('lydian', 64, 120, 'sine'),
    ground: ['#1a0a2a', '#ffd180', 'plasma', 0.6, 16], road: ['#fff8e1', '#ff9100', 'light', 0.5],
    cast: { cross: ['photon', 'energyBall'], on: ['plasmaBlob'], big: ['cometHead'], weave: ['spark'], wall: ['energyWall'], hurdle: ['plasmaRidge'], bar: ['lightBeam'] },
    near: ['lightSeed', 'energyShard', 'plasmaPillar'], mid: ['shockRing', 'galaxySmall', 'energyShard'], far: ['bangCore'], skyK: ['galaxySmall'], scenes: ['bangBurst'],
    P: { a: '#ff9100', b: '#fff8e1', c: '#7c4dff', g: '#ffffff' } }),
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
Object.assign(CAST_NAMES, MORE_NAMES);
const jong = (w) => { const ch = w.charCodeAt(w.length - 1); return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 > 0; };
export const castHit = (kind) => { const n = CAST_NAMES[kind] || '시대의 무언가'; return `${n}${jong(n) ? '과' : '와'} 부딪혔어요`; };
