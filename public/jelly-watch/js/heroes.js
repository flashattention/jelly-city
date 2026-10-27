// 젤리워치 영웅 16명 (돌격 5 · 공격 7 · 지원 4). 서버(판정 · 쿨타임 · 궁극기)와 화면이 같이 쓴다
//   공격 종류: hit(즉발 사격) · proj(투사체, PROJ 표) · melee(근접 부채꼴) · beam(대상 고정 줄기)
//   기술 칸: s(우클릭) · shift · e · q(궁극기)
export const ROLES = { tank: { name: '돌격', icon: '🛡️', color: '#7cc4ff' }, dps: { name: '공격', icon: '⚔️', color: '#ff7a8a' }, sup: { name: '지원', icon: '✚', color: '#9be7a7' } };
export const BASE_SPEED = 5.6, RESPAWN_MS = 8000, ULT_PASSIVE = 5; // 궁극기: 1초에 5점 + 준 피해 · 치유 1당 1점

// 투사체: speed(m/s) · grav(중력 배수) · dmg(직격) · splash(폭발 최대) · r(폭발 반경) · kb(밀어내기) · self(자기 피해 배수) · life(초) · size · color
export const PROJ = {
  rocket: { speed: 38, grav: 0, dmg: 55, splash: 75, r: 2.6, kb: 7, self: 0.25, life: 3, size: 0.22, color: '#7cc8ff', trail: '#cfe8ff' },
  barrage: { speed: 34, grav: 0, dmg: 20, splash: 25, r: 2.4, kb: 2, self: 0, life: 2.5, size: 0.14, color: '#9fd8ff', trail: '#e6f4ff' },
  conc: { speed: 40, grav: 0, dmg: 10, splash: 0, r: 4.5, kb: 15, self: 1, selfKb: true, life: 1.2, size: 0.3, color: '#bfe6ff', trail: '#ffffff' },
  fire: { speed: 26, grav: 0, dmg: 90, splash: 0, r: 0, pierce: true, life: 1.6, size: 0.6, color: '#ff9a3c', trail: '#ffd27a', wide: 1.2 },
  mini: { speed: 32, grav: 0, dmg: 5, splash: 6, r: 2, kb: 0.5, self: 0, life: 2, size: 0.1, color: '#ffb3d9', trail: '#ffe0f0' },
  egren: { speed: 26, grav: 0.55, dmg: 0, splash: 50, r: 3, kb: 6, self: 0, selfKb: true, life: 3, size: 0.25, color: '#ff8fd0', trail: '#ffd0ec' },
  grav: { speed: 24, grav: 0.3, dmg: 0, splash: 0, r: 0, life: 3, size: 0.4, color: '#c79bff', trail: '#e6d6ff', make: 'grav' },
  hook: { speed: 42, grav: 0, dmg: 30, splash: 0, r: 0, life: 0.5, size: 0.2, color: '#c9c9d6', trail: '#8a8a99', chain: true },
  helix: { speed: 48, grav: 0, dmg: 40, splash: 80, r: 3, kb: 5, self: 0.4, selfKb: true, life: 2.5, size: 0.16, color: '#8fe6ff', trail: '#d6f7ff', count: 3 },
  shuri: { speed: 62, grav: 0, dmg: 27, splash: 0, r: 0, life: 1, size: 0.12, color: '#b6ff8a', trail: '#e8ffd6', head: 2 },
  flash: { speed: 30, grav: 0.2, dmg: 25, splash: 0, r: 3, life: 0.45, size: 0.18, color: '#fff3a0', trail: '#ffffff', stun: 0.8, burst: true },
  mine: { speed: 18, grav: 1, dmg: 0, splash: 0, r: 0, life: 3, size: 0.2, color: '#c47bff', trail: '#e8c8ff', make: 'mine' },
  pulse: { speed: 18, grav: 0.9, dmg: 0, splash: 0, r: 0, life: 2, size: 0.2, color: '#7cf0ff', trail: '#d6fbff', stick: true },
  bolt: { speed: 55, grav: 0, dmg: 20, splash: 0, r: 0, life: 1.2, size: 0.1, color: '#ffe48a', trail: '#fff6cc', head: 2 },
  sleep: { speed: 60, grav: 0, dmg: 5, splash: 0, r: 0, life: 1, size: 0.1, color: '#d6c2ff', trail: '#efe6ff', sleep: 5, wide: 0.25 },
  biotic: { speed: 24, grav: 0.8, dmg: 0, splash: 60, r: 4, life: 3, size: 0.2, color: '#c8ff7a', trail: '#f0ffd6', heal: 100, anti: 4, healBoost: 4, friendly: true },
  sonic: { speed: 50, grav: 0, dmg: 20, splash: 0, r: 0, life: 1, size: 0.13, color: '#a6ff5e', trail: '#e6ffd0', head: 2 },
  orb: { speed: 8, grav: 0, dmg: 0, splash: 0, r: 0, life: 7, size: 0.4, color: '#d38bff', trail: '#f2deff', make: 'orb' },
  pulsebomb: { dmg: 0, splash: 350, r: 3.2, kb: 3, self: 0.1 },
};

// 영웅
//   hp: 최대 체력(아머 · 보호막 포함) · speed: 기본 속도 배수 · ult: 궁극기 필요 점수
//   held: 다른 사람 눈에 보이는 손 무기 · acc: 꾸밈(곰돌이 장비) · motto: 한마디
export const HEROES = [
  // ---------- 돌격 ----------
  { id: 'rein', name: '젤리하르트', role: 'tank', emoji: '🔨', color: '#c9d2e3', hp: 550, speed: 0.92, ult: 1500, held: 'hammer', acc: ['helm_iron', 'armor_iron', 'cape:#d64545'],
    motto: '정의의 망치를 받아라!', desc: '거대한 망치와 방벽으로 팀을 지키는 젤리 기사',
    p: { type: 'melee', name: '로켓 해머', dmg: 75, rate: 0.95, range: 5, arc: 0.45, cleave: true },
    s: { type: 'hold', name: '방벽 방패', icon: '🛡️', hp: 1200, desc: '누르는 동안 앞에 큰 방벽 (총알 · 투사체를 막아요)' },
    shift: { name: '돌진', icon: '🐂', cd: 8, desc: '앞으로 돌진! 처음 부딪힌 적에게 큰 피해' },
    e: { name: '화염 강타', icon: '🔥', cd: 6, desc: '적을 꿰뚫는 불꽃을 날려요' },
    q: { name: '대지 분쇄', icon: '💥', desc: '앞쪽 넓은 땅을 내리쳐 적을 모두 기절시켜요' } },
  { id: 'winston', name: '젤리스턴', role: 'tank', emoji: '🦍', color: '#9fb0c8', hp: 500, speed: 1, ult: 1700, held: 'tesla', acc: ['glasses', 'vest'],
    motto: '과학의 힘이다!', desc: '전기 대포 · 점프팩 · 방벽 돔을 쓰는 천재 과학자 곰',
    p: { type: 'beam', name: '테슬라 캐논', range: 8.5, dps: 75, chain: 3, arc: 0.72, lock: 'enemy' },
    shift: { name: '점프 팩', icon: '🚀', cd: 6, desc: '멀리 뛰어올라 내려찍기 (착지 피해)' },
    e: { name: '방벽 생성기', icon: '🔵', cd: 13, desc: '총알을 막는 둥근 방벽을 펼쳐요' },
    q: { name: '원시의 분노', icon: '😤', desc: '10초 동안 체력이 크게 늘고 주먹으로 날려 버려요' } },
  { id: 'dva', name: '디젤바', role: 'tank', emoji: '🎮', color: '#ff9fcf', hp: 600, speed: 1, ult: 1500, held: 'cannons', acc: ['headphones', 'idol'],
    motto: '이 게임, 내가 이긴다!', desc: '젤리 로봇에 탄 프로게이머. 로봇이 부서지면 꼬마 모드!',
    p: { type: 'hit', name: '융합 캐논', dmg: 3, pellets: 9, rate: 0.16, mag: 0, spread: 0.06, pspread: 0.07, near: 10, far: 20, head: 2, auto: true },
    s: { type: 'hold', name: '방어 매트릭스', icon: '🟪', desc: '누르는 동안 앞에서 오는 공격을 먹어 치워요 (3초 분량)' },
    shift: { name: '부스터', icon: '💨', cd: 4, desc: '앞으로 날아가며 부딪힌 적을 밀쳐요' },
    e: { name: '마이크로 미사일', icon: '🎆', cd: 8, desc: '작은 미사일을 우르르 쏴요' },
    q: { name: '자폭', icon: '☢️', desc: '로봇을 날려 보내 3초 뒤 큰 폭발! (꼬마 모드일 땐 로봇 호출)' },
    pilot: { hp: 150, p: { type: 'hit', name: '광선총', dmg: 14, rate: 0.15, mag: 0, spread: 0.01, near: 20, far: 30, head: 2, auto: true } } },
  { id: 'hog', name: '젤리호그', role: 'tank', emoji: '🐷', color: '#c99a6b', hp: 650, speed: 0.95, ult: 1800, held: 'scrap', acc: ['mask', 'overalls:#5b4a3a'],
    motto: '꿀꿀! 이리 와!', desc: '갈고리로 끌어오고 한 방에 날려 버리는 덩치 큰 돼지 곰',
    p: { type: 'hit', name: '고철총', dmg: 6, pellets: 25, rate: 0.85, mag: 5, reload: 1.5, spread: 0, pspread: 0.1, near: 12, far: 25, head: 1.5 },
    shift: { name: '사슬 갈고리', icon: '⛓️', cd: 8, desc: '갈고리를 던져 적을 끌어와요' },
    e: { name: '숨 돌리기', icon: '😮‍💨', cd: 8, desc: '숨을 크게 쉬며 체력 350 회복 · 받는 피해 절반' },
    q: { name: '돼지우리', icon: '🌪️', desc: '6초 동안 고철을 마구 뿜어 앞의 적을 날려 버려요' } },
  { id: 'zarya', name: '자리젤리', role: 'tank', emoji: '💪', color: '#ff7ab8', hp: 475, speed: 1, ult: 1800, held: 'particle', acc: ['jersey:#ff5fa2'],
    motto: '힘을 모아라!', desc: '보호막으로 에너지를 모아 강해지는 근육 젤리',
    p: { type: 'beam', name: '입자포', range: 15, dps: 90, lock: 'enemy', energy: true, arc: 0.985 },
    s: { type: 'proj', k: 'egren', name: '에너지탄', icon: '🟣', rate: 0.8 },
    shift: { name: '입자 방벽', icon: '🫧', cd: 10, desc: '내 몸에 2초 보호막 (막은 피해만큼 에너지)' },
    e: { name: '방벽 씌우기', icon: '🛡️', cd: 8, desc: '조준한 아군(없으면 나)에게 보호막' },
    q: { name: '중력자탄', icon: '🌀', desc: '적을 한곳에 빨아들이는 중력 구슬' } },
  // ---------- 공격 ----------
  { id: 'pharah', name: '파라젤리', role: 'dps', emoji: '🚀', color: '#4f8fe8', hp: 250, speed: 1, ult: 2100, held: 'rpg', acc: ['storm_helmet', 'armor_legend'],
    motto: '하늘에서 정의가 내려온다!', desc: '하늘을 날며 로켓을 쏘는 젤리 경비대장 (Space 길게 = 날기)',
    p: { type: 'proj', k: 'rocket', name: '로켓 발사기', rate: 0.85, mag: 6, reload: 1.1, auto: true },
    shift: { name: '점프 추진기', icon: '⏫', cd: 10, desc: '하늘 높이 솟구쳐요' },
    e: { name: '충격탄', icon: '🌬️', cd: 8, desc: '맞은 곳의 적(과 나)을 멀리 날려요' },
    q: { name: '포화', icon: '🎇', desc: '공중에 멈춰 작은 로켓을 퍼부어요' } },
  { id: 'reaper', name: '리퍼젤리', role: 'dps', emoji: '💀', color: '#4a4356', hp: 250, speed: 1, ult: 2000, held: 'shotgun', acc: ['hoodie:#2b2733', 'mask'],
    motto: '죽어라… 죽어라… 죽어라!', desc: '그림자 속 쌍산탄총 젤리. 준 피해만큼 체력 회복',
    p: { type: 'hit', name: '헬파이어 샷건', dmg: 6, pellets: 20, rate: 0.5, mag: 8, reload: 1.5, spread: 0, pspread: 0.11, near: 10, far: 20, head: 2, auto: true, steal: 0.3 },
    shift: { name: '망령화', icon: '👻', cd: 8, desc: '3초 동안 무적 · 빨라져요 (쏠 수 없어요)' },
    e: { name: '그림자 밟기', icon: '🌑', cd: 10, desc: '조준한 곳으로 순간이동' },
    q: { name: '죽음의 꽃', icon: '🌹', desc: '빙글빙글 돌며 주변 적에게 엄청난 피해' } },
  { id: 'cassidy', name: '젤리크리', role: 'dps', emoji: '🤠', color: '#c0653a', hp: 250, speed: 1, ult: 1900, held: 'pistol', acc: ['cowboy', 'scarf:#b23a3a', 'stache'],
    motto: '해가 진다…', desc: '리볼버 한 자루면 충분한 사막의 총잡이 젤리',
    p: { type: 'hit', name: '피스키퍼', dmg: 70, rate: 0.5, mag: 6, reload: 1.4, spread: 0, near: 22, far: 45, head: 2 },
    s: { type: 'fan', name: '난사', icon: '🌀', dmg: 50, rate: 0.12, spread: 0.07 },
    shift: { name: '구르기', icon: '🎳', cd: 6, desc: '구르면서 바로 장전' },
    e: { name: '섬광탄', icon: '✨', cd: 10, desc: '가까운 적을 잠깐 기절시켜요' },
    q: { name: '황야의 무법자', icon: '🌅', desc: '보이는 적을 조준해 모아 뒀다가 한꺼번에 탕!' } },
  { id: 'soldier', name: '솔저젤리', role: 'dps', emoji: '🎖️', color: '#5a7099', hp: 250, speed: 1, ult: 2100, held: 'blaster_rifle', acc: ['goggles', 'leather'],
    motto: '목표를 포착했다!', desc: '펄스 소총 · 나선 로켓 · 치유장. 무엇이든 해내는 베테랑',
    p: { type: 'hit', name: '펄스 소총', dmg: 19, rate: 0.09, mag: 30, reload: 1.5, spread: 0.008, bloom: 0.004, near: 30, far: 50, head: 2, auto: true },
    s: { type: 'proj', k: 'helix', name: '나선 로켓', icon: '🌀', cd: 6, rate: 0.4 },
    shift: { name: '질주', icon: '🏃', cd: 0, desc: '누르는 동안 빨리 달려요' },
    e: { name: '생체장', icon: '💚', cd: 15, desc: '발밑에 아군을 치유하는 장' },
    q: { name: '전술 조준경', icon: '🎯', desc: '6초 동안 총알이 알아서 적에게 꽂혀요' } },
  { id: 'genji', name: '젤리겐지', role: 'dps', emoji: '🥷', color: '#8be05a', hp: 250, speed: 1.06, ult: 1900, held: 'sword:#b6ff8a', acc: ['goggles', 'dobok'],
    motto: '용의 검을 받아라!', desc: '표창 · 질풍참 · 튕겨내기. 두 번 점프하는 젤리 닌자',
    p: { type: 'proj', k: 'shuri', name: '수리검', rate: 0.75, mag: 24, reload: 1, burst: 3, burstGap: 0.08, auto: true },
    s: { type: 'proj', k: 'shuri', name: '부채 던지기', icon: '🔱', rate: 0.75, fan: 3 },
    shift: { name: '질풍참', icon: '⚡', cd: 8, desc: '앞으로 베며 돌진 (처치하면 쿨 초기화)' },
    e: { name: '튕겨내기', icon: '⚔️', cd: 8, desc: '2초 동안 앞에서 오는 공격을 되돌려요' },
    q: { name: '용검', icon: '🐉', desc: '6초 동안 용검을 뽑아 적을 베어요' } },
  { id: 'widow', name: '젤리메이커', role: 'dps', emoji: '🕷️', color: '#9466e0', hp: 200, speed: 1, ult: 1700, held: 'sniper', acc: ['vr', 'tuxedo'],
    motto: '한 발, 한 명.', desc: '우클릭으로 조준경을 모아 한 방! 갈고리로 높은 곳에',
    p: { type: 'hit', name: '죽음의 입맞춤', dmg: 13, rate: 0.09, mag: 30, reload: 1.5, spread: 0.03, near: 20, far: 40, head: 2, auto: true, scoped: { min: 15, max: 120, charge: 1, head: 2.5, rate: 0.6 } },
    s: { type: 'scope', name: '조준경', icon: '🔭', zoom: 2.8 },
    shift: { name: '갈고리', icon: '🪝', cd: 10, desc: '조준한 벽으로 쭉 날아가요' },
    e: { name: '맹독 지뢰', icon: '☠️', cd: 12, desc: '밟은 적에게 독 피해' },
    q: { name: '적외선 투시', icon: '👁️', desc: '15초 동안 우리 팀 모두 벽 너머 적이 보여요' } },
  { id: 'tracer', name: '트레이젤리', role: 'dps', emoji: '⚡', color: '#ffa04a', hp: 175, speed: 1.2, ult: 1300, held: 'blaster', acc: ['goggles', 'jersey:#ff8a1f'],
    motto: '기병대가 왔다!', desc: '순간이동 점멸 · 시간 역행. 가장 빠른 젤리',
    p: { type: 'hit', name: '펄스 쌍권총', dmg: 6, pellets: 2, rate: 0.05, mag: 40, reload: 1.1, spread: 0.03, pspread: 0.035, near: 11, far: 24, head: 2, auto: true },
    shift: { name: '점멸', icon: '💫', cd: 3, charges: 3, desc: '움직이는 쪽으로 순간이동 (3번)' },
    e: { name: '시간 역행', icon: '⏪', cd: 12, desc: '3초 전 자리 · 체력으로 되돌아가요' },
    q: { name: '펄스 폭탄', icon: '💣', desc: '적에게 붙는 강력한 폭탄' } },
  // ---------- 지원 ----------
  { id: 'mercy', name: '젤리시', role: 'sup', emoji: '😇', color: '#fff0c8', hp: 225, speed: 1, ult: 1800, held: 'staff', acc: ['halo', 'wings', 'dress:#fff8e6'],
    motto: '영웅은 죽지 않아요!', desc: '아군을 조준하면 치유 줄기 · 우클릭은 공격력 강화',
    p: { type: 'beam', name: '카두세우스 지팡이', range: 15, hps: 55, lock: 'ally', alt: { type: 'proj', k: 'bolt', rate: 0.2, mag: 20, reload: 1.3, auto: true } },
    s: { type: 'beam', name: '공격력 강화', icon: '💛', range: 15, boost: 0.3, lock: 'ally' },
    shift: { name: '수호천사', icon: '🪽', cd: 2.5, desc: '조준한 아군에게 날아가요' },
    e: { name: '부활', icon: '✝️', cd: 30, desc: '가까이 쓰러진 아군을 되살려요' },
    q: { name: '발키리', icon: '🌟', desc: '15초 동안 날며 치유 줄기가 주변 아군에게 퍼져요' } },
  { id: 'ana', name: '젤리아나', role: 'sup', emoji: '🎯', color: '#6f8fb2', hp: 200, speed: 1, ult: 1900, held: 'sniper', acc: ['eyepatch', 'beret:#3b5b7c', 'coat:#4a6382'],
    motto: '아직 은퇴하기엔 일러!', desc: '적은 맞추고 아군은 치유하는 생체 저격총 할머니 젤리',
    p: { type: 'hit', name: '생체 소총', dmg: 70, heal: 75, rate: 0.8, mag: 12, reload: 1.5, spread: 0, near: 999, far: 999, head: 1, ally: true },
    s: { type: 'scope', name: '조준경', icon: '🔭', zoom: 2.2 },
    shift: { name: '수면총', icon: '💤', cd: 14, desc: '맞은 적을 5초 재워요 (맞으면 깨요)' },
    e: { name: '생체 수류탄', icon: '🧪', cd: 12, desc: '아군 치유 · 치유량 증가 / 적 피해 · 치유 차단' },
    q: { name: '나노 강화제', icon: '💉', desc: '조준한 아군을 8초 동안 강하게 (공격 ↑ 받는 피해 ↓)' } },
  { id: 'lucio', name: '젤리우', role: 'sup', emoji: '🎧', color: '#86d957', hp: 225, speed: 1.1, ult: 2200, held: 'blaster', acc: ['headphones', 'jersey:#ffd84d'],
    motto: '볼륨을 올려!', desc: '음악으로 주변 아군을 치유하거나 빠르게 (Shift 로 곡 바꾸기)',
    p: { type: 'proj', k: 'sonic', name: '음파 증폭기', rate: 0.9, mag: 20, reload: 1.2, burst: 4, burstGap: 0.1, auto: true },
    s: { type: 'cone', name: '소리 파동', icon: '🔊', cd: 4, dmg: 25, range: 8, kb: 14 },
    shift: { name: '곡 바꾸기', icon: '🎵', cd: 0.6, desc: '치유 곡 ↔ 속도 곡' },
    e: { name: '볼륨 업', icon: '📢', cd: 12, desc: '3초 동안 곡 효과가 아주 커져요' },
    q: { name: '소리 방벽', icon: '🎶', desc: '주변 아군에게 아주 큰 보호막' } },
  { id: 'moira', name: '젤리라', role: 'sup', emoji: '🧬', color: '#9a63d1', hp: 225, speed: 1, ult: 1800, held: null, acc: ['coat:#4a2a6e', 'monocle'],
    motto: '과학에 희생은 따르는 법.', desc: '왼손은 치유 안개, 오른손은 흡수 줄기 · 구슬 · 융화',
    p: { type: 'spray', name: '생체 손아귀 (치유)', range: 15, hps: 65, arc: 0.86 },
    s: { type: 'beam', name: '생체 손아귀 (흡수)', icon: '🟣', range: 20, dps: 55, selfHeal: 30, lock: 'enemy' },
    shift: { name: '소멸', icon: '🌫️', cd: 6, desc: '잠깐 사라져 무적 · 빨라져요' },
    e: { name: '생체 구슬', icon: '🔮', cd: 10, desc: '튕기며 아군은 치유 · 적은 피해' },
    q: { name: '융화', icon: '🌈', desc: '8초 동안 긴 줄기: 아군 치유 · 적 피해' } },
];
export const heroById = (id) => HEROES.find((h) => h.id === id) || HEROES[0];
export const QUICK_MELEE = { dmg: 30, range: 2.6, rate: 1 };

// 거리에 따라 줄어드는 피해 (near 까지 100% → far 에서 50%)
export function falloff(spec, d) {
  if (!spec.near || d <= spec.near) return 1;
  if (d >= spec.far) return 0.5;
  return 1 - 0.5 * ((d - spec.near) / (spec.far - spec.near));
}

// ---------- 방벽 ----------
//   shield: 젤리하르트 방패 (앞에 세운 사각판) · dome: 젤리스턴 방벽 돔(밖에서 쏘면 막는다)
//   a → b 선분이 '적 팀' 방벽에 먼저 막히면 { e, t } (t: 0~1)
export function shieldRect(e) { const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); return { cx: e.x + fx * 1.4, cz: e.z + fz * 1.4, nx: fx, nz: fz, hw: 2.6, y0: e.y, y1: e.y + 3 }; }
export function blockBy(ents, a, b, team) {
  let best = null;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  for (const e of ents) {
    if (e.team === team || (e.k !== 'shield' && e.k !== 'dome')) continue;
    if (e.k === 'shield') {
      const s = shieldRect(e), den = dx * s.nx + dz * s.nz;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((s.cx - a.x) * s.nx + (s.cz - a.z) * s.nz) / den;
      if (t < 0 || t > 1) continue;
      const px = a.x + dx * t, py = a.y + dy * t, pz = a.z + dz * t;
      const side = (px - s.cx) * -s.nz + (pz - s.cz) * s.nx;
      if (Math.abs(side) > s.hw || py < s.y0 || py > s.y1) continue;
      if (!best || t < best.t) best = { e, t };
    } else {
      // 돔: 반지름 5 구의 겉면 (밖 → 안으로 들어오는 선만)
      const R = 5, ox = a.x - e.x, oy = a.y - e.y, oz = a.z - e.z;
      if (ox * ox + oy * oy + oz * oz < R * R) continue;
      const A = dx * dx + dy * dy + dz * dz, B = 2 * (ox * dx + oy * dy + oz * dz), C = ox * ox + oy * oy + oz * oz - R * R, D = B * B - 4 * A * C;
      if (D < 0) continue;
      const t = (-B - Math.sqrt(D)) / (2 * A);
      if (t < 0 || t > 1) continue;
      if (!best || t < best.t) best = { e, t };
    }
  }
  return best;
}
