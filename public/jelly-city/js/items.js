// 아이템 데이터베이스 (서버와 브라우저 공용)
import { BASIC_ITEMS } from '../../shared/js/look.js';
import { ANIMALS, RIDE } from './fauna.js';
// cat: melee | gun | throw | launcher | vehicle | head | face | body | acc | food | doll | gift | gem
// slot: 장착 부위 (head/face/body/acc), vis: 캐릭터에 그려질 모습, held: 손에 드는 모습
// 무기: dmg 피해, rate 공격 간격(초), range 사거리, kind 공격 방식, sockets 보석 칸

export const ITEMS = {
  // ---------------- 맨손 ----------------
  fist: { name: '주먹', emoji: '👊', cat: 'melee', price: 0, dmg: 7, rate: 0.45, range: 1.7, kind: 'melee', held: null, sockets: 0 },

  // ---------------- 관우네 병기점 (삼국지) ----------------
  wood_sword: { name: '목검', emoji: '🪵', cat: 'melee', shop: 'armory_3k', price: 40, dmg: 12, rate: 0.5, range: 2.0, kind: 'melee', held: 'sword:#a1887f', sockets: 1 },
  iron_sword: { name: '철검', emoji: '🗡️', cat: 'melee', shop: 'armory_3k', price: 150, dmg: 20, rate: 0.5, range: 2.1, kind: 'melee', held: 'sword:#cfd8dc', sockets: 1 },
  twin_swords: { name: '쌍고검 (유비의 검)', emoji: '⚔️', cat: 'melee', shop: 'armory_3k', price: 1500, dmg: 28, rate: 0.32, range: 2.0, kind: 'melee', held: 'sword:#ffd54f', sockets: 2 },
  qinggang: { name: '청강검', emoji: '🗡️', cat: 'melee', shop: 'armory_3k', price: 900, dmg: 36, rate: 0.5, range: 2.2, kind: 'melee', held: 'sword:#90caf9', sockets: 2 },
  serpent_spear: { name: '장팔사모 (장비의 창)', emoji: '🔱', cat: 'melee', shop: 'armory_3k', price: 1800, dmg: 42, rate: 0.6, range: 3.0, kind: 'melee', held: 'spear:#b0bec5', sockets: 2 },
  halberd: { name: '방천화극 (여포의 극)', emoji: '🔱', cat: 'melee', shop: 'armory_3k', price: 3200, dmg: 52, rate: 0.62, range: 3.0, kind: 'melee', held: 'halberd:#ef5350', sockets: 3 },
  dragon_glaive: { name: '청룡언월도 (용월도)', emoji: '🐉', cat: 'melee', shop: 'armory_3k', price: 4500, dmg: 62, rate: 0.7, range: 3.1, kind: 'melee', held: 'glaive:#4caf50', sockets: 3 },
  yitian: { name: '의천검 (조조의 보검)', emoji: '✨', cat: 'melee', shop: 'armory_3k', price: 6000, dmg: 70, rate: 0.5, range: 2.4, kind: 'melee', held: 'sword:#e1bee7', sockets: 3 },
  bow: { name: '장궁', emoji: '🏹', cat: 'gun', shop: 'armory_3k', price: 700, dmg: 26, rate: 0.9, range: 60, kind: 'arrow', ammo: 'arrow', held: 'bow', sockets: 1 },
  composite_bow: { name: '각궁 (황충의 활)', emoji: '🏹', cat: 'gun', shop: 'armory_3k', price: 1600, dmg: 38, rate: 0.75, range: 75, kind: 'arrow', ammo: 'arrow', held: 'bow', sockets: 2 },
  recurve_bow: { name: '양궁 (올림픽 리커브)', emoji: '🏹', cat: 'gun', shop: 'armory_3k', price: 2200, dmg: 44, rate: 0.8, range: 90, kind: 'arrow', held: 'bow', sockets: 2 },
  crossbow: { name: '석궁', emoji: '🎯', cat: 'gun', shop: 'armory_3k', price: 1300, dmg: 55, rate: 1.4, range: 80, kind: 'arrow', instant: true, held: 'crossbow', sockets: 1 },
  zhuge_crossbow: { name: '제갈연노 (연발 쇠뇌)', emoji: '🎯', cat: 'gun', shop: 'armory_3k', price: 2600, dmg: 16, rate: 0.22, range: 55, kind: 'arrow', ammo: 'arrow', auto: true, held: 'crossbow', sockets: 2 },
  arrow: { name: '화살 ×20', emoji: '➶', cat: 'ammo', shop: 'armory_3k', price: 40, stack: true, pack: 20 },
  leather_helm: { name: '가죽 투구', emoji: '🪖', cat: 'head', slot: 'head', shop: 'armory_3k', price: 150, def: 5, vis: 'helm_leather', sockets: 1 },
  iron_helm: { name: '철 투구', emoji: '🪖', cat: 'head', slot: 'head', shop: 'armory_3k', price: 450, def: 10, vis: 'helm_iron', sockets: 1 },
  general_helm: { name: '장수 투구 (붉은 술)', emoji: '🪖', cat: 'head', slot: 'head', shop: 'armory_3k', price: 1400, def: 16, charm: 8, vis: 'helm_general', sockets: 2 },
  leather_armor: { name: '가죽 갑옷', emoji: '🦺', cat: 'body', slot: 'body', shop: 'armory_3k', price: 350, def: 8, vis: 'armor_leather', sockets: 1 },
  iron_armor: { name: '철갑옷', emoji: '🛡️', cat: 'body', slot: 'body', shop: 'armory_3k', price: 1000, def: 16, vis: 'armor_iron', sockets: 2 },
  legend_armor: { name: '전설의 갑옷 (황금 용린갑)', emoji: '🌟', cat: 'body', slot: 'body', shop: 'armory_3k', price: 7000, def: 32, charm: 25, vis: 'armor_legend', sockets: 3 },

  // ---------------- 젤리 택티컬 (현대 밀리터리) ----------------
  combat_knife: { name: '군용 나이프', emoji: '🔪', cat: 'melee', shop: 'armory_mil', price: 90, dmg: 17, rate: 0.35, range: 1.8, kind: 'melee', held: 'knife', sockets: 1 },
  pistol: { name: '권총', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 500, dmg: 18, rate: 0.35, range: 45, ammo: 'ammo_9mm', kind: 'hitscan', held: 'pistol', tracer: '#ffe082', sockets: 1 },
  shotgun: { name: '산탄총', emoji: '💥', cat: 'gun', shop: 'armory_mil', price: 1300, dmg: 9, pellets: 7, spread: 0.09, rate: 0.9, range: 22, ammo: 'ammo_shell', kind: 'hitscan', held: 'shotgun', tracer: '#ffcc80', sockets: 2 },
  rifle: { name: '돌격소총', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 2000, dmg: 14, rate: 0.12, range: 60, ammo: 'ammo_556', kind: 'hitscan', auto: true, held: 'rifle', tracer: '#fff59d', sockets: 2 },
  sniper: { name: '저격총', emoji: '🎯', cat: 'gun', shop: 'armory_mil', price: 3200, dmg: 75, rate: 1.3, range: 140, ammo: 'ammo_762', kind: 'hitscan', held: 'sniper', tracer: '#ffffff', sockets: 3 },
  minigun: { name: '미니건', emoji: '🌀', cat: 'gun', shop: 'armory_mil', price: 5500, dmg: 9, rate: 0.05, range: 50, ammo: 'ammo_belt', kind: 'hitscan', auto: true, held: 'minigun', tracer: '#ffab40', sockets: 2 },
  revolver: { name: '리볼버 (.357)', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 900, dmg: 34, rate: 0.55, range: 50, ammo: 'ammo_9mm', kind: 'hitscan', held: 'pistol', sockets: 1 },
  deagle: { name: '데저트 이글', emoji: '🦅', cat: 'gun', shop: 'armory_mil', price: 1800, dmg: 48, rate: 0.6, range: 55, ammo: 'ammo_9mm', kind: 'hitscan', held: 'pistol', sockets: 2 },
  uzi: { name: '우지 기관단총', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 1400, dmg: 9, rate: 0.07, range: 35, ammo: 'ammo_9mm', kind: 'hitscan', auto: true, held: 'pistol', sockets: 1 },
  mp5: { name: 'MP5 기관단총', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 1700, dmg: 11, rate: 0.08, range: 45, ammo: 'ammo_9mm', kind: 'hitscan', auto: true, held: 'rifle', sockets: 2 },
  ak47: { name: 'AK-47', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 2400, dmg: 19, rate: 0.12, range: 65, ammo: 'ammo_762', kind: 'hitscan', auto: true, held: 'rifle', sockets: 2 },
  m4: { name: 'M4A1 카빈', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 2600, dmg: 17, rate: 0.1, range: 70, kind: 'hitscan', auto: true, held: 'rifle', sockets: 2 },
  scar: { name: 'SCAR-H 전투소총', emoji: '🔫', cat: 'gun', shop: 'armory_mil', price: 3600, dmg: 24, rate: 0.14, range: 80, ammo: 'ammo_762', kind: 'hitscan', auto: true, held: 'rifle', sockets: 3 },
  m249: { name: 'M249 경기관총', emoji: '🌀', cat: 'gun', shop: 'armory_mil', price: 4800, dmg: 13, rate: 0.075, range: 60, ammo: 'ammo_belt', kind: 'hitscan', auto: true, held: 'minigun', sockets: 2 },
  double_barrel: { name: '더블배럴 샷건', emoji: '💥', cat: 'gun', shop: 'armory_mil', price: 1600, dmg: 12, pellets: 9, spread: 0.11, rate: 1.1, range: 18, ammo: 'ammo_shell', kind: 'hitscan', held: 'shotgun', sockets: 1 },
  barrett: { name: '바렛 대물저격총 (.50)', emoji: '🎯', cat: 'gun', shop: 'armory_mil', price: 7800, dmg: 160, rate: 2.2, range: 200, ammo: 'ammo_762', kind: 'hitscan', held: 'sniper', sockets: 3 },
  plasma_smg: { name: '플라즈마 기관단총', emoji: '🔫', cat: 'gun', shop: 'armory_sf', price: 3800, dmg: 14, rate: 0.08, range: 55, ammo: 'ammo_cell', kind: 'hitscan', auto: true, held: 'blaster_rifle', tracer: '#18ffff', sockets: 2 },
  grenade: { name: '수류탄', emoji: '💣', cat: 'throw', shop: 'armory_mil', price: 120, stack: true, dmg: 70, radius: 6, rate: 0.8, range: 30, kind: 'grenade', held: 'grenade', sockets: 0 },
  rpg: { name: '로켓포 (RPG)', emoji: '🚀', cat: 'launcher', shop: 'armory_mil', price: 4200, dmg: 90, radius: 6, rate: 2.2, range: 90, ammo: 'ammo_rocket', kind: 'rocket', held: 'rpg', sockets: 2 },
  kevlar_helmet: { name: '방탄모', emoji: '🪖', cat: 'head', slot: 'head', shop: 'armory_mil', price: 600, def: 14, vis: 'kevlar_helmet', sockets: 1 },
  goggles: { name: '전술 고글', emoji: '🥽', cat: 'face', slot: 'face', shop: 'armory_mil', price: 300, def: 3, charm: 4, vis: 'goggles', sockets: 1 },
  kevlar_vest: { name: '방탄조끼', emoji: '🦺', cat: 'body', slot: 'body', shop: 'armory_mil', price: 1500, def: 22, vis: 'vest_kevlar', sockets: 2 },
  ammo_9mm: { name: '권총탄 (9mm) ×30', emoji: '🟡', cat: 'ammo', shop: 'armory_mil', price: 40, stack: true, pack: 30 },
  ammo_shell: { name: '산탄 (12게이지) ×12', emoji: '🔴', cat: 'ammo', shop: 'armory_mil', price: 60, stack: true, pack: 12 },
  ammo_556: { name: '소총탄 (5.56mm) ×60', emoji: '🟠', cat: 'ammo', shop: 'armory_mil', price: 90, stack: true, pack: 60 },
  ammo_762: { name: '저격탄 (7.62mm) ×10', emoji: '🟤', cat: 'ammo', shop: 'armory_mil', price: 120, stack: true, pack: 10 },
  ammo_belt: { name: '미니건 탄띠 ×200', emoji: '⛓️', cat: 'ammo', shop: 'armory_mil', price: 250, stack: true, pack: 200 },
  ammo_rocket: { name: '로켓탄 ×2', emoji: '🧨', cat: 'ammo', shop: 'armory_mil', price: 300, stack: true, pack: 2 },
  tank: { name: '전차 (탱크)', emoji: '🪖', cat: 'vehicle', shop: 'armory_mil', price: 9000, vehicle: 'tank' },
  heli: { name: '공격 헬기', emoji: '🚁', cat: 'vehicle', shop: 'armory_mil', price: 14000, vehicle: 'heli' },

  // ---------------- 은하 무기상 (미래형) ----------------
  saber_blue: { name: '광선검 (푸른빛)', emoji: '🔵', cat: 'melee', shop: 'armory_sf', price: 4000, dmg: 58, rate: 0.38, range: 2.4, kind: 'melee', held: 'saber:#40c4ff', sockets: 2, charm: 10 },
  // 젤리병단 장비 (진격의 거인 입체기동장치처럼): 좌클릭 쌍검 · 우클릭 갈고리를 걸고 날아간다. 거대 젤리는 이걸로 뒷목을 베어야만 쓰러진다
  odm_gear: { name: '젤리병단 장비', emoji: '🪝', cat: 'melee', shop: 'armory_mil', price: 3500, dmg: 34, rate: 0.42, range: 2.6, kind: 'melee', held: 'odm', sockets: 2, odm: true, skill: '좌클릭 쌍검 · 우클릭 갈고리(꾹 = 당기기) · 걸고 Space 가스 · 놓고 Space 2단 점프 · 거대 젤리는 뒷목!' },
  saber_red: { name: '광선검 (붉은빛)', emoji: '🔴', cat: 'melee', shop: 'armory_sf', price: 4400, dmg: 64, rate: 0.4, range: 2.4, kind: 'melee', held: 'saber:#ff1744', sockets: 2, charm: 10 },
  saber_green: { name: '광선검 (초록빛)', emoji: '🟢', cat: 'melee', shop: 'armory_sf', price: 4200, dmg: 60, rate: 0.38, range: 2.4, kind: 'melee', held: 'saber:#76ff03', sockets: 3, charm: 10 },
  blaster: { name: '블래스터 권총', emoji: '🔫', cat: 'gun', shop: 'armory_sf', price: 1500, dmg: 24, rate: 0.3, range: 55, ammo: 'ammo_cell', kind: 'hitscan', held: 'blaster', tracer: '#ff5252', sockets: 2 },
  blaster_rifle: { name: '블래스터 소총', emoji: '🔫', cat: 'gun', shop: 'armory_sf', price: 3400, dmg: 17, rate: 0.11, range: 65, ammo: 'ammo_cell', kind: 'hitscan', auto: true, held: 'blaster_rifle', tracer: '#ff1744', sockets: 2 },
  ion_cannon: { name: '이온 캐논', emoji: '⚡', cat: 'launcher', shop: 'armory_sf', price: 7500, dmg: 110, radius: 7, rate: 2.5, range: 100, ammo: 'ammo_ion', kind: 'rocket', held: 'ion', tracer: '#18ffff', sockets: 3 },
  ammo_cell: { name: '블래스터 에너지 셀 ×40', emoji: '🔋', cat: 'ammo', shop: 'armory_sf', price: 120, stack: true, pack: 40 },
  ammo_ion: { name: '이온 코어 ×2', emoji: '💠', cat: 'ammo', shop: 'armory_sf', price: 500, stack: true, pack: 2 },
  thermal: { name: '열 폭탄', emoji: '🟠', cat: 'throw', shop: 'armory_sf', price: 400, stack: true, dmg: 95, radius: 7, rate: 0.8, range: 30, kind: 'grenade', held: 'thermal', sockets: 0 },
  storm_helmet: { name: '스톰 헬멧', emoji: '⚪', cat: 'head', slot: 'head', shop: 'armory_sf', price: 2000, def: 18, charm: 6, vis: 'storm_helmet', sockets: 2 },
  jedi_robe: { name: '제다이 로브', emoji: '🧥', cat: 'body', slot: 'body', shop: 'armory_sf', price: 2500, def: 12, charm: 15, vis: 'jedi_robe', sockets: 2 },
  mando_armor: { name: '베스카 강철 갑옷', emoji: '🛡️', cat: 'body', slot: 'body', shop: 'armory_sf', price: 9500, def: 38, charm: 20, vis: 'mando_armor', sockets: 3 },

  // ---------------- 모자 가게 ----------------
  baseball_cap: { name: '야구모자', emoji: '🧢', cat: 'head', slot: 'head', shop: 'hatshop', price: 40, charm: 3, vis: 'cap:#42a5f5' },
  beanie: { name: '비니', emoji: '🧶', cat: 'head', slot: 'head', shop: 'hatshop', price: 70, charm: 5, vis: 'beanie:#ef5350' },
  beret_hat: { name: '베레모', emoji: '🎨', cat: 'head', slot: 'head', shop: 'hatshop', price: 140, charm: 8, vis: 'beret:#7e57c2' },
  catears: { name: '고양이 귀 머리띠', emoji: '🐱', cat: 'head', slot: 'head', shop: 'hatshop', price: 450, charm: 16, vis: 'catears' },
  cowboy: { name: '카우보이 모자', emoji: '🤠', cat: 'head', slot: 'head', shop: 'hatshop', price: 350, charm: 13, vis: 'cowboy' },
  flowercrown: { name: '꽃 화관', emoji: '🌸', cat: 'head', slot: 'head', shop: 'hatshop', price: 600, charm: 19, vis: 'flowercrown' },
  pirate: { name: '해적 선장 모자', emoji: '🏴‍☠️', cat: 'head', slot: 'head', shop: 'hatshop', price: 900, charm: 22, vis: 'pirate' },
  silk_hat: { name: '실크햇', emoji: '🎩', cat: 'head', slot: 'head', shop: 'hatshop', price: 1300, charm: 27, vis: 'top' },
  wizard: { name: '마법사 모자', emoji: '🧙', cat: 'head', slot: 'head', shop: 'hatshop', price: 1700, charm: 30, vis: 'wizard' },
  crown: { name: '황금 왕관', emoji: '👑', cat: 'head', slot: 'head', shop: 'hatshop', price: 9000, charm: 65, vis: 'crown' },

  // ---------------- 안경 가게 ----------------
  round_glasses: { name: '동그란 안경', emoji: '👓', cat: 'face', slot: 'face', shop: 'eyewear', price: 50, charm: 3, vis: 'glasses' },
  sunglasses: { name: '선글라스', emoji: '🕶️', cat: 'face', slot: 'face', shop: 'eyewear', price: 160, charm: 9, vis: 'sunglasses' },
  heart_glasses: { name: '하트 선글라스', emoji: '💖', cat: 'face', slot: 'face', shop: 'eyewear', price: 420, charm: 15, vis: 'heartglasses' },
  star_glasses: { name: '별 선글라스', emoji: '⭐', cat: 'face', slot: 'face', shop: 'eyewear', price: 650, charm: 19, vis: 'starglasses' },
  monocle: { name: '외알 안경', emoji: '🧐', cat: 'face', slot: 'face', shop: 'eyewear', price: 1500, charm: 26, vis: 'monocle' },
  vr_goggles: { name: 'VR 고글', emoji: '🥽', cat: 'face', slot: 'face', shop: 'eyewear', price: 2400, charm: 30, vis: 'vr' },
  gold_shades: { name: '금테 선글라스', emoji: '😎', cat: 'face', slot: 'face', shop: 'eyewear', price: 3500, charm: 38, vis: 'goldshades' },

  // ---------------- 옷가게 ----------------
  hoodie: { name: '후드티', emoji: '👕', cat: 'body', slot: 'body', shop: 'clothing', price: 120, charm: 6, vis: 'hoodie:#90caf9' },
  leather_jacket: { name: '가죽 재킷', emoji: '🧥', cat: 'body', slot: 'body', shop: 'clothing', price: 650, charm: 16, vis: 'leather' },
  hanbok: { name: '한복', emoji: '👘', cat: 'body', slot: 'body', shop: 'clothing', price: 900, charm: 23, vis: 'hanbok' },
  tuxedo: { name: '턱시도', emoji: '🤵', cat: 'body', slot: 'body', shop: 'clothing', price: 1600, charm: 31, vis: 'tuxedo' },
  dress: { name: '파티 드레스', emoji: '👗', cat: 'body', slot: 'body', shop: 'clothing', price: 1600, charm: 31, vis: 'dress:#f06292' },
  princess: { name: '공주 드레스', emoji: '👸', cat: 'body', slot: 'body', shop: 'clothing', price: 4200, charm: 46, vis: 'princess' },
  idol: { name: '아이돌 무대의상', emoji: '🎤', cat: 'body', slot: 'body', shop: 'clothing', price: 5200, charm: 52, vis: 'idol' },
  gold_suit: { name: '황금 정장', emoji: '💰', cat: 'body', slot: 'body', shop: 'clothing', price: 20000, charm: 90, vis: 'goldsuit' },
  bowtie_item: { name: '나비넥타이', emoji: '🎀', cat: 'acc', slot: 'acc', shop: 'clothing', price: 100, charm: 5, vis: 'bowtie' },
  scarf_item: { name: '울 스카프', emoji: '🧣', cat: 'acc', slot: 'acc', shop: 'clothing', price: 220, charm: 8, vis: 'scarf:#ffb74d' },
  pearls: { name: '진주 목걸이', emoji: '📿', cat: 'acc', slot: 'acc', shop: 'clothing', price: 1300, charm: 24, vis: 'pearls' },
  wings: { name: '나비 날개', emoji: '🦋', cat: 'acc', slot: 'acc', shop: 'clothing', price: 2200, charm: 32, vis: 'wings' },

  // ---------------- 음식 & 선물 & 인형 ----------------
  // eat: [먹는 동작, 소품 모양:색], pack: 포장 시 모양
  kimbap: { name: '삼각김밥', emoji: '🍙', cat: 'food', shop: 'convenience', price: 3, stack: true, food: { hunger: 22 }, heal: 5, eat: ['bite', 'tri:#fafafa'] },
  snack: { name: '과자', emoji: '🍬', cat: 'food', shop: 'convenience', shops: ['supermarket'], price: 3, stack: true, food: { hunger: 8, fun: 6 }, heal: 2, gift: true, eat: ['bite', 'box:#ff7043'] },
  energy_drink: { name: '에너지 드링크', emoji: '🥫', cat: 'food', shop: 'convenience', shops: ['supermarket'], price: 4, stack: true, food: { energy: 25 }, heal: 0, eat: ['drink', 'can:#43a047'] },
  cup_ramen: { name: '컵라면', emoji: '🍜', cat: 'food', shop: 'convenience', shops: ['supermarket'], price: 4, stack: true, food: { hunger: 28, fun: 4 }, heal: 4, eat: ['slurp', 'bowl:#ffb74d'] },
  sandwich: { name: '샌드위치', emoji: '🥪', cat: 'food', shop: 'convenience', shops: ['supermarket'], price: 5, stack: true, food: { hunger: 25 }, heal: 5, eat: ['bite', 'bun:#ffeb3b'] },
  banana_milk: { name: '바나나우유', emoji: '🍌', cat: 'food', shop: 'convenience', shops: ['supermarket'], price: 3, stack: true, food: { hunger: 6, fun: 8 }, heal: 2, gift: true, eat: ['drink', 'cup:#fff176'] },
  dosirak: { name: '편의점 도시락', emoji: '🍱', cat: 'food', shop: 'convenience', shops: ['supermarket'], price: 7, stack: true, food: { hunger: 45 }, heal: 10, eat: ['spoon', 'bowl:#a1887f'] },
  bread: { name: '빵', emoji: '🥐', cat: 'food', shop: 'bakery', price: 5, stack: true, food: { hunger: 30 }, heal: 8, gift: true, eat: ['bite', 'bread:#e0a050'] },
  coffee: { name: '아메리카노', emoji: '☕', cat: 'food', shop: 'cafe', price: 6, stack: true, food: { energy: 20 }, heal: 2, gift: true, eat: ['drink', 'cup:#6d4c41'] },
  latte: { name: '솜사탕 라떼', emoji: '🥛', cat: 'food', shop: 'cafe', price: 7, stack: true, food: { energy: 18, fun: 5 }, heal: 2, gift: true, eat: ['drink', 'cup:#d7ccc8'] },
  cake: { name: '딸기 케이크', emoji: '🍰', cat: 'food', shop: 'cafe', shops: ['bakery'], price: 8, stack: true, food: { hunger: 20, fun: 12 }, heal: 4, gift: true, eat: ['bite', 'bread:#f8bbd0'] },
  croissant: { name: '크루아상', emoji: '🥐', cat: 'food', shop: 'bakery', price: 6, stack: true, food: { hunger: 28, fun: 6 }, heal: 6, gift: true, eat: ['bite', 'bread:#e0a050'] },
  cream_bread: { name: '소보로빵', emoji: '🍞', cat: 'food', shop: 'bakery', price: 4, stack: true, food: { hunger: 25 }, heal: 5, eat: ['bite', 'bread:#c68642'] },
  // 피자집
  pizza_pepperoni: { name: '페퍼로니 피자', emoji: '🍕', cat: 'food', shop: 'pizza', price: 18, stack: true, food: { hunger: 55, fun: 10 }, heal: 12, eat: ['slice', 'slice:#d32f2f'], pack: 'pizzabox' },
  pizza_cheese: { name: '치즈 피자', emoji: '🧀', cat: 'food', shop: 'pizza', price: 15, stack: true, food: { hunger: 50, fun: 8 }, heal: 10, eat: ['slice', 'slice:#fff176'], pack: 'pizzabox' },
  pizza_potato: { name: '포테이토 피자', emoji: '🥔', cat: 'food', shop: 'pizza', price: 19, stack: true, food: { hunger: 58, fun: 10 }, heal: 12, eat: ['slice', 'slice:#d7a86e'], pack: 'pizzabox' },
  pizza_bulgogi: { name: '불고기 피자', emoji: '🍕', cat: 'food', shop: 'pizza', price: 20, stack: true, food: { hunger: 60, fun: 12 }, heal: 14, eat: ['slice', 'slice:#6d4c41'], pack: 'pizzabox' },
  cola: { name: '콜라', emoji: '🥤', cat: 'food', shop: 'pizza', shops: ['pizza', 'chicken', 'burger'], price: 3, stack: true, food: { energy: 8, fun: 5 }, heal: 1, eat: ['drink', 'cup:#5d4037'] },
  // 치킨집
  fried_chicken: { name: '후라이드 치킨', emoji: '🍗', cat: 'food', shop: 'chicken', price: 17, stack: true, food: { hunger: 55, fun: 12 }, heal: 12, eat: ['drumstick', 'drumstick:#e0a050'], pack: 'chickenbox' },
  yangnyeom: { name: '양념 치킨', emoji: '🌶️', cat: 'food', shop: 'chicken', price: 18, stack: true, food: { hunger: 55, fun: 14 }, heal: 12, eat: ['drumstick', 'drumstick:#c62828'], pack: 'chickenbox' },
  half_half: { name: '반반 치킨', emoji: '🍗', cat: 'food', shop: 'chicken', price: 18, stack: true, food: { hunger: 58, fun: 15 }, heal: 13, eat: ['drumstick', 'drumstick:#d84315'], pack: 'chickenbox' },
  soy_chicken: { name: '간장 치킨', emoji: '🍗', cat: 'food', shop: 'chicken', price: 18, stack: true, food: { hunger: 55, fun: 12 }, heal: 12, eat: ['drumstick', 'drumstick:#5d4037'], pack: 'chickenbox' },
  chicken_mu: { name: '치킨무', emoji: '🥢', cat: 'food', shop: 'chicken', price: 1, stack: true, food: { hunger: 3, fun: 2 }, heal: 0, eat: ['bite', 'box:#fafafa'] },
  // 중국집
  jjajang: { name: '짜장면', emoji: '🍝', cat: 'food', shop: 'chinese', price: 7, stack: true, food: { hunger: 50 }, heal: 8, eat: ['slurp', 'bowl:#3e2723'] },
  jjamppong: { name: '짬뽕', emoji: '🌶️', cat: 'food', shop: 'chinese', price: 8, stack: true, food: { hunger: 52, energy: 5 }, heal: 9, eat: ['slurp', 'bowl:#d84315'] },
  tangsuyuk: { name: '탕수육', emoji: '🥘', cat: 'food', shop: 'chinese', price: 16, stack: true, food: { hunger: 50, fun: 12 }, heal: 12, eat: ['chopsticks', 'plate:#ffb74d'] },
  fried_rice: { name: '볶음밥', emoji: '🍛', cat: 'food', shop: 'chinese', price: 7, stack: true, food: { hunger: 48 }, heal: 8, eat: ['spoon', 'plate:#ffcc80'] },
  mandu: { name: '군만두', emoji: '🥟', cat: 'food', shop: 'chinese', price: 5, stack: true, food: { hunger: 22, fun: 4 }, heal: 4, eat: ['chopsticks', 'plate:#ffe0b2'] },
  // 국밥집
  dwaeji_gukbap: { name: '돼지국밥', emoji: '🍲', cat: 'food', shop: 'gukbap', price: 8, stack: true, food: { hunger: 60, energy: 8 }, heal: 15, eat: ['spoon', 'bowl:#efebe9'] },
  sundae_gukbap: { name: '순대국밥', emoji: '🍲', cat: 'food', shop: 'gukbap', price: 8, stack: true, food: { hunger: 60, energy: 8 }, heal: 15, eat: ['spoon', 'bowl:#d7ccc8'] },
  haejangguk: { name: '해장국', emoji: '🥣', cat: 'food', shop: 'gukbap', price: 8, stack: true, food: { hunger: 55, energy: 15 }, heal: 15, eat: ['spoon', 'bowl:#bf360c'] },
  kongnamul: { name: '콩나물국밥', emoji: '🥣', cat: 'food', shop: 'gukbap', price: 6, stack: true, food: { hunger: 45, energy: 12 }, heal: 12, eat: ['spoon', 'bowl:#fff9c4'] },
  sikhye: { name: '식혜', emoji: '🍶', cat: 'food', shop: 'gukbap', price: 2, stack: true, food: { energy: 5, fun: 6 }, heal: 2, eat: ['drink', 'cup:#fff8e1'] },
  // 햄버거
  burger: { name: '젤리 버거', emoji: '🍔', cat: 'food', shop: 'burger', price: 7, stack: true, food: { hunger: 40, fun: 8 }, heal: 8, eat: ['bite', 'bun:#ffca28'] },
  cheeseburger: { name: '더블 치즈버거', emoji: '🍔', cat: 'food', shop: 'burger', price: 9, stack: true, food: { hunger: 50, fun: 10 }, heal: 10, eat: ['bite', 'bun:#ffb300'] },
  fries: { name: '감자튀김', emoji: '🍟', cat: 'food', shop: 'burger', price: 4, stack: true, food: { hunger: 18, fun: 8 }, heal: 3, eat: ['bite', 'box:#e53935'] },
  milkshake: { name: '딸기 쉐이크', emoji: '🥤', cat: 'food', shop: 'burger', price: 5, stack: true, food: { hunger: 8, fun: 12 }, heal: 2, gift: true, eat: ['drink', 'cup:#f8bbd0'] },
  // 분식
  tteokbokki: { name: '떡볶이', emoji: '🌶️', cat: 'food', shop: 'bunsik', price: 5, stack: true, food: { hunger: 35, fun: 10 }, heal: 6, eat: ['chopsticks', 'plate:#e53935'] },
  ramyeon: { name: '라면', emoji: '🍜', cat: 'food', shop: 'bunsik', price: 5, stack: true, food: { hunger: 40, fun: 5 }, heal: 6, eat: ['slurp', 'bowl:#ff7043'] },
  gimbap_roll: { name: '김밥 한 줄', emoji: '🍙', cat: 'food', shop: 'bunsik', price: 4, stack: true, food: { hunger: 35 }, heal: 6, eat: ['bite', 'skewer:#263238'] },
  eomuk: { name: '어묵 꼬치', emoji: '🍢', cat: 'food', shop: 'bunsik', price: 2, stack: true, food: { hunger: 12, energy: 4 }, heal: 3, eat: ['bite', 'skewer:#ffcc80'] },
  twigim: { name: '모둠 튀김', emoji: '🍤', cat: 'food', shop: 'bunsik', price: 4, stack: true, food: { hunger: 22, fun: 6 }, heal: 4, eat: ['bite', 'box:#ffb74d'] },
  // 한식당
  bibimbap: { name: '비빔밥', emoji: '🍚', cat: 'food', shop: 'restaurant', price: 9, stack: true, food: { hunger: 55 }, heal: 12, eat: ['spoon', 'bowl:#ff7043'] },
  bulgogi_set: { name: '불고기 정식', emoji: '🥩', cat: 'food', shop: 'restaurant', price: 12, stack: true, food: { hunger: 65, fun: 8 }, heal: 15, eat: ['chopsticks', 'plate:#6d4c41'] },
  kimchi_jjigae: { name: '김치찌개', emoji: '🍲', cat: 'food', shop: 'restaurant', price: 8, stack: true, food: { hunger: 55, energy: 5 }, heal: 12, eat: ['spoon', 'bowl:#d84315'] },
  medkit: { name: '구급상자', emoji: '🩹', cat: 'food', shop: 'pharmacy', price: 40, stack: true, food: {}, heal: 50 },
  flowers: { name: '꽃다발', emoji: '💐', cat: 'gift', shop: 'flowershop', price: 8, stack: true, gift: true },
  book: { name: '책', emoji: '📖', cat: 'gift', shop: 'bookstore', price: 10, stack: true, gift: true },
  doll_roach: { name: '곰돌이 인형', emoji: '🧸', cat: 'doll', shop: 'convenience', price: 30, gift: true, held: 'doll:#8a5634', charm: 2 },
  doll_bear: { name: '곰 인형', emoji: '🧸', cat: 'doll', shop: 'flowershop', price: 60, gift: true, held: 'doll:#d7a86e', charm: 3 },
  doll_dino: { name: '공룡 인형', emoji: '🦖', cat: 'doll', shop: 'bookstore', price: 80, gift: true, held: 'doll:#81c784', charm: 3 },

  // ---------------- 마법봉 공방 (속성 지팡이) ----------------
  // element: 마법 속성, mana: 마나 소모. 같은 속성이면 스킬이 같다
  wand_fire: { name: '화염 지팡이', emoji: '🔥', cat: 'wand', shop: 'magicshop', price: 1800, dmg: 40, radius: 3.5, rate: 0.9, range: 60, kind: 'magic', element: 'fire', mana: 18, held: 'wand:#ff5722', sockets: 2, skill: '화염구 — 맞은 곳이 폭발해요' },
  wand_ice: { name: '얼음 지팡이', emoji: '❄️', cat: 'wand', shop: 'magicshop', price: 1600, dmg: 30, rate: 0.7, range: 55, kind: 'magic', element: 'ice', mana: 14, held: 'wand:#4fc3f7', sockets: 2, skill: '얼음 화살 — 맞으면 2초간 느려져요' },
  wand_thunder: { name: '번개 지팡이', emoji: '⚡', cat: 'wand', shop: 'magicshop', price: 2600, dmg: 34, rate: 1.0, range: 50, kind: 'magic', element: 'thunder', mana: 22, held: 'wand:#ffeb3b', sockets: 2, skill: '연쇄 번개 — 즉시 맞고 주변 2명에게 튀어요' },
  wand_wind: { name: '바람 지팡이', emoji: '🌪️', cat: 'wand', shop: 'magicshop', price: 1400, dmg: 18, rate: 0.8, range: 9, kind: 'magic', element: 'wind', mana: 12, held: 'wand:#a5d6a7', sockets: 2, skill: '돌풍 — 앞의 적들을 날려버려요' },
  wand_poison: { name: '독 지팡이', emoji: '☠️', cat: 'wand', shop: 'magicshop', price: 2000, dmg: 12, poisonDmg: 8, rate: 0.9, range: 45, kind: 'magic', element: 'poison', mana: 16, held: 'wand:#9ccc65', sockets: 2, skill: '독구름 — 4초간 계속 피해' },
  wand_holy: { name: '빛의 지팡이', emoji: '✨', cat: 'wand', shop: 'magicshop', price: 3000, dmg: 0, heal: 30, rate: 2.0, range: 8, kind: 'magic', element: 'holy', mana: 30, held: 'wand:#fff59d', sockets: 2, skill: '치유의 빛 — 나와 주변 플레이어 체력 회복' },
  wand_dark: { name: '어둠 지팡이', emoji: '🌑', cat: 'wand', shop: 'magicshop', price: 4200, dmg: 65, radius: 2.5, rate: 1.4, range: 70, kind: 'magic', element: 'dark', mana: 28, held: 'wand:#7e57c2', sockets: 3, skill: '암흑구 — 느리지만 강력한 유도 구체' },
  mana_potion: { name: '마나 물약', emoji: '🧪', cat: 'food', shop: 'magicshop', price: 25, stack: true, food: {}, heal: 0, mana: 60, eat: ['drink', 'cup:#5c6bc0'] },

  // ---------------- 낚시 ----------------
  rod_bamboo: { name: '대나무 낚싯대', emoji: '🎣', cat: 'rod', shop: 'fishing', price: 150, tier: 0, held: 'rod:#c8a165', rodLuck: 0.75 },
  rod_carbon: { name: '카본 낚싯대', emoji: '🎣', cat: 'rod', shop: 'fishing', price: 1200, tier: 1, held: 'rod:#37474f', rodLuck: 0.86 },
  rod_gold: { name: '황금 낚싯대', emoji: '✨', cat: 'rod', shop: 'fishing', price: 6000, tier: 2, held: 'rod:#ffd54f', rodLuck: 0.95 },
  bait: { name: '지렁이 미끼 ×10', emoji: '🪱', cat: 'ammo', shop: 'fishing', price: 20, stack: true, pack: 10 },
  maeuntang: { name: '매운탕', emoji: '🍲', cat: 'food', price: 0, stack: true, food: { hunger: 75, fun: 10 }, heal: 30, eat: ['spoon', 'bowl:#d84315'] },
  sashimi: { name: '모둠회', emoji: '🍣', cat: 'food', price: 0, stack: true, food: { hunger: 45, fun: 18 }, heal: 20, eat: ['chopsticks', 'plate:#ffab91'] },
  seafood_set: { name: '매운탕 정식', emoji: '🍲', cat: 'food', shop: 'seafood', price: 18, stack: true, food: { hunger: 75, fun: 10 }, heal: 30, eat: ['spoon', 'bowl:#d84315'] },
  sashimi_set: { name: '광어·우럭 모둠회', emoji: '🍣', cat: 'food', shop: 'seafood', price: 30, stack: true, food: { hunger: 45, fun: 18 }, heal: 20, eat: ['chopsticks', 'plate:#ffab91'] },

  // ---------------- 사냥 전리품 (사냥꾼 오두막에서 팔 수 있어요) ----------------
  bear_hide: { name: '곰가죽', emoji: '🐻', cat: 'loot', price: 0, sell: 420, stack: true },
  bear_meat: { name: '곰고기', emoji: '🥩', cat: 'food', price: 0, sell: 70, stack: true, food: { hunger: 60, fun: 6 }, heal: 20, eat: ['drumstick', 'drumstick:#8d3b2f'] },
  deer_meat: { name: '사슴고기', emoji: '🍖', cat: 'food', price: 0, sell: 50, stack: true, food: { hunger: 45 }, heal: 14, eat: ['drumstick', 'drumstick:#a1453a'] },
  deer_trophy: { name: '사슴머리 장식', emoji: '🦌', cat: 'loot', price: 0, sell: 650, stack: true, charm: 0 },
  wolf_pelt: { name: '늑대가죽', emoji: '🐺', cat: 'loot', price: 0, sell: 300, stack: true },
  boar_meat: { name: '멧돼지고기', emoji: '🍖', cat: 'food', price: 0, sell: 55, stack: true, food: { hunger: 50 }, heal: 15, eat: ['drumstick', 'drumstick:#8d5a3f'] },
  rabbit_fur: { name: '토끼털', emoji: '🐇', cat: 'loot', price: 0, sell: 80, stack: true },
  croc_skin: { name: '악어가죽', emoji: '🐊', cat: 'loot', price: 0, sell: 700, stack: true },
  croc_meat: { name: '악어고기', emoji: '🍗', cat: 'food', price: 0, sell: 90, stack: true, food: { hunger: 50, fun: 10 }, heal: 18, eat: ['drumstick', 'drumstick:#c8b37a'] },
  tiger_pelt: { name: '호랑이가죽', emoji: '🐯', cat: 'loot', price: 0, sell: 1300, stack: true },
  tiger_meat: { name: '호랑이고기', emoji: '🥩', cat: 'food', price: 0, sell: 120, stack: true, food: { hunger: 65, fun: 15 }, heal: 30, eat: ['drumstick', 'drumstick:#b7472a'] },
  snake_skin: { name: '아나콘다 가죽', emoji: '🐍', cat: 'loot', price: 0, sell: 1000, stack: true },
  jaguar_pelt: { name: '재규어 가죽', emoji: '🐆', cat: 'loot', price: 0, sell: 1100, stack: true },
  dragon_scale: { name: '드래곤 비늘', emoji: '🐉', cat: 'loot', price: 0, sell: 2500, stack: true },
  dragon_heart: { name: '드래곤의 심장', emoji: '❤️‍🔥', cat: 'loot', price: 0, sell: 6000, stack: true },
  baby_dragon_scale: { name: '새끼 드래곤 비늘', emoji: '🐲', cat: 'loot', price: 0, sell: 900, stack: true },
  // 드래곤을 타고 있을 때 왼쪽 클릭: 불 뿜기 (상점에서 팔지 않음)
  // 화염방사는 0.3초마다 피해 + 화상(burn: 초당 피해, 3초)
  dragon_fire: { name: '드래곤 불꽃', emoji: '🔥', cat: 'melee', price: 0, dmg: 16, rate: 0.3, range: 18, kind: 'melee', element: 'fire', burn: 8, hidden: true },
  baby_dragon_fire: { name: '새끼 드래곤 불꽃', emoji: '🔥', cat: 'melee', price: 0, dmg: 9, rate: 0.3, range: 12, kind: 'melee', element: 'fire', burn: 4, hidden: true },
  dragon_fireball: { name: '드래곤 불덩이', emoji: '☄️', cat: 'launcher', price: 0, dmg: 130, rate: 2.2, range: 160, radius: 7, kind: 'rocket', element: 'fire', burn: 8, hidden: true },
  baby_fireball: { name: '새끼 드래곤 불덩이', emoji: '☄️', cat: 'launcher', price: 0, dmg: 60, rate: 1.6, range: 110, radius: 4.5, kind: 'rocket', element: 'fire', burn: 4, hidden: true },
  hunting_rifle: { name: '사냥용 엽총', emoji: '🔫', cat: 'gun', shop: 'hunter', price: 1800, dmg: 55, rate: 1.1, range: 110, ammo: 'ammo_762', kind: 'hitscan', held: 'sniper', sockets: 1 },
  hunter_bow: { name: '사냥꾼의 활', emoji: '🏹', cat: 'gun', shop: 'hunter', price: 900, dmg: 34, rate: 0.85, range: 70, kind: 'arrow', ammo: 'arrow', held: 'bow', sockets: 1 },
  hunter_knife: { name: '사냥칼', emoji: '🔪', cat: 'melee', shop: 'hunter', price: 250, dmg: 22, rate: 0.4, range: 2.0, kind: 'melee', held: 'knife', sockets: 1 },
  // 목장 직판장
  milk: { name: '목장 우유', emoji: '🥛', cat: 'food', shop: 'ranch', price: 3, stack: true, food: { hunger: 12, fun: 4 }, heal: 4, gift: true, eat: ['drink', 'cup:#fafafa'] },
  cheese: { name: '수제 치즈', emoji: '🧀', cat: 'food', shop: 'ranch', price: 6, stack: true, food: { hunger: 20, fun: 6 }, heal: 6, gift: true, eat: ['bite', 'box:#ffd54f'] },
  steak: { name: '한우 스테이크', emoji: '🥩', cat: 'food', shop: 'ranch', price: 25, stack: true, food: { hunger: 70, fun: 15 }, heal: 25, eat: ['knife', 'plate:#8d3b2f'] },
  icecream: { name: '목장 소프트아이스크림', emoji: '🍦', cat: 'food', shop: 'ranch', shops: ['convenience'], price: 4, stack: true, food: { hunger: 8, fun: 14 }, heal: 2, gift: true, eat: ['bite', 'cup:#fff8e1'] },

  cash: { name: '현금', emoji: '💵', cat: 'cash', price: 1, stack: true },
  car_key: { name: '차 키', emoji: '🔑', cat: 'carkey', price: 0 },
  house_key: { name: '집 열쇠', emoji: '🔑', cat: 'key', price: 0 },

  // ---------------- 보석 ----------------
  ruby: { name: '루비', emoji: '🔴', cat: 'gem', shop: 'jeweler', price: 600, stack: true, gem: 'ruby' },
  sapphire: { name: '사파이어', emoji: '🔵', cat: 'gem', shop: 'jeweler', price: 600, stack: true, gem: 'sapphire' },
  emerald: { name: '에메랄드', emoji: '🟢', cat: 'gem', shop: 'jeweler', price: 800, stack: true, gem: 'emerald' },
  topaz: { name: '토파즈', emoji: '🟡', cat: 'gem', shop: 'jeweler', price: 700, stack: true, gem: 'topaz' },
  amethyst: { name: '자수정', emoji: '🟣', cat: 'gem', shop: 'jeweler', price: 700, stack: true, gem: 'amethyst' },
  diamond: { name: '다이아몬드', emoji: '💎', cat: 'gem', shop: 'jeweler', price: 1500, stack: true, gem: 'diamond' },
  obsidian: { name: '흑요석', emoji: '⚫', cat: 'gem', shop: 'jeweler', price: 500, stack: true, gem: 'obsidian' },
  opal: { name: '오팔', emoji: '⚪', cat: 'gem', shop: 'jeweler', price: 900, stack: true, gem: 'opal' },
};

Object.assign(ITEMS, BASIC_ITEMS);
// 물고기 22종: [id, 이름, 이모지, 잡힐 확률 가중치, 판매가, 회 가능, 매운탕 가능, 필요한 낚싯대 등급, 바다/민물]
export const FISH = [
  ['shark', '상어', '🦈', 1, 2500, false, false, 2, 'sea'],
  ['tuna', '참치', '🐟', 1.6, 1800, true, false, 1, 'sea'],
  ['octopus', '문어', '🐙', 5, 350, true, false, 0, 'sea'],
  ['rock_bream', '돌돔', '🐟', 4, 600, true, false, 1, 'sea'],
  ['red_snapper', '참돔', '🐠', 6, 450, true, true, 0, 'sea'],
  ['flatfish', '광어', '🐟', 10, 300, true, true, 0, 'sea'],
  ['rockfish', '우럭', '🐟', 12, 250, true, true, 0, 'sea'],
  ['mackerel', '고등어', '🐟', 16, 80, true, false, 0, 'sea'],
  ['hairtail', '갈치', '🐟', 8, 150, false, false, 0, 'sea'],
  ['squid', '오징어', '🦑', 10, 120, true, false, 0, 'sea'],
  ['yellowtail', '방어', '🐟', 4, 500, true, false, 1, 'sea'],
  ['pufferfish', '복어', '🐡', 4, 400, false, true, 0, 'sea'],
  ['gizzard_shad', '전어', '🐟', 12, 70, true, false, 0, 'sea'],
  ['cod', '대구', '🐟', 6, 200, false, true, 0, 'sea'],
  ['monkfish', '아귀', '🐟', 5, 220, false, true, 0, 'sea'],
  ['trout', '송어', '🐟', 12, 150, true, false, 0, 'fresh'],
  ['carp', '잉어', '🐟', 14, 100, false, true, 0, 'fresh'],
  ['catfish', '메기', '🐟', 10, 130, false, true, 0, 'fresh'],
  ['crucian', '붕어', '🐟', 16, 60, false, true, 0, 'fresh'],
  ['mandarin', '쏘가리', '🐟', 4, 400, true, true, 1, 'fresh'],
  ['eel', '민물장어', '🐍', 3, 450, false, false, 1, 'fresh'],
  ['smelt', '빙어', '🐟', 14, 40, true, false, 0, 'fresh'],
];
for (const [id, name, emoji, , sell, raw, spicy] of FISH) ITEMS['fish_' + id] = { name, emoji, cat: 'fish', price: 0, sell, stack: true, raw, spicy, fish: true };
ITEMS.fish_boot = { name: '낡은 장화', emoji: '🥾', cat: 'loot', price: 0, sell: 5, stack: true };
// 젤리 모터스 쇼룸 자동차 (사면 차 키를 받아 언제든 호출)
export const DEALER_CARS = [
  ['sport_b', '🏎️', 90000], ['sport_l', '🐂', 45000], ['sport_f', '🐎', 40000], ['sport_m', '🏁', 38000], ['sport_p', '🏎️', 28000],
  ['limo', '🚘', 25000], ['convertible', '🚙', 16000], ['ev', '⚡', 15000], ['jeep', '🛻', 12000], ['truck', '🚚', 10000],
  ['suv', '🚙', 9000], ['van', '🚐', 8500], ['pickup', '🛻', 8000], ['icecream', '🍦', 7000], ['wagon', '🚗', 6500], ['sedan', '🚗', 6000], ['hatch', '🚗', 5000], ['mini', '🚗', 3500],
  // 이륜차
  ['sportbike', '🏍️', 18000], ['chopper', '🏍️', 12000], ['motorcycle', '🏍️', 7000], ['scooter', '🛵', 2500], ['bicycle', '🚲', 400],
];
// 포획한 동물: 가방에 '탈것'으로 들고 다니다가 핫바에서 쓰면 올라탄다
for (const [k, a] of Object.entries(ANIMALS)) {
  if (!RIDE[k]) continue;
  ITEMS['mount_' + k] = { name: `${a.name} (탈것)`, emoji: a.emoji, cat: 'mount', mount: k, price: 0, sell: Math.round((a.xp || 30) * 12), desc: RIDE[k].fly ? '하늘을 날고 불을 뿜어요' : '타고 달릴 수 있어요' };
}
// 총알·화살 없이 쏜다: 무기의 탄약 표시를 지우고, 탄약 상품은 팔지 않는다 (낚시 미끼만 남김)
export const NO_AMMO = new Set(Object.keys(ITEMS).filter((id) => ITEMS[id].cat === 'ammo' && id !== 'bait'));
for (const d of Object.values(ITEMS)) delete d.ammo;
for (const id of NO_AMMO) delete ITEMS[id].shop;
// 실제 총의 유효사거리와 비슷하게 (m)
const REAL_RANGE = {
  pistol: 50, revolver: 50, deagle: 70, blaster: 120, uzi: 100, mp5: 150, plasma_smg: 150,
  rifle: 400, ak47: 350, m4: 500, scar: 600, blaster_rifle: 400, m249: 800, minigun: 1000,
  shotgun: 40, double_barrel: 35, sniper: 1000, hunting_rifle: 400, barrett: 1800,
  rpg: 500, ion_cannon: 600, bow: 150, composite_bow: 200, hunter_bow: 180, zhuge_crossbow: 80, recurve_bow: 220, crossbow: 120,
};
for (const [id, r] of Object.entries(REAL_RANGE)) if (ITEMS[id]) ITEMS[id].range = r;
// 실제 무기 위력과 비슷하게 (사람 체력 100 기준 몸통 한 발 피해). 머리는 총·화살 모두 한 방
// 9mm 권총 3~4발, 소총 3발, 대구경 저격 거의 한 방, .50 대물저격·로켓은 한 방, 산탄은 가까우면 한 방
const REAL_DMG = {
  pistol: 30, revolver: 45, deagle: 60, blaster: 35,
  uzi: 22, mp5: 25, plasma_smg: 24,
  rifle: 30, m4: 32, ak47: 38, scar: 42, blaster_rifle: 30, m249: 30, minigun: 32,
  shotgun: 14, double_barrel: 15,
  sniper: 95, hunting_rifle: 90, barrett: 250,
  bow: 50, composite_bow: 60, recurve_bow: 65, hunter_bow: 55, crossbow: 80, zhuge_crossbow: 24,
  grenade: 120, thermal: 150, rpg: 200, ion_cannon: 220,
  fist: 8, combat_knife: 35, hunter_knife: 38, wood_sword: 15, iron_sword: 45, twin_swords: 40, qinggang: 55,
  serpent_spear: 60, halberd: 70, dragon_glaive: 75, yitian: 80, saber_blue: 100, saber_red: 105, saber_green: 100, odm_gear: 70,
};
for (const [id, v] of Object.entries(REAL_DMG)) if (ITEMS[id]) ITEMS[id].dmg = v;
ITEMS.shotgun.pellets = 9; ITEMS.double_barrel.pellets = 9; // 00 벅샷 9알
// 조준(우클릭) 배율
const ZOOM = { m4: 2.6, recurve_bow: 2.6, crossbow: 2.4, revolver: 1.6, deagle: 1.7, uzi: 1.3, mp5: 1.8, ak47: 2.2, scar: 3.0, m249: 1.7, double_barrel: 1.2, barrett: 8, plasma_smg: 1.8, hunting_rifle: 4.5, hunter_bow: 2.4, pistol: 1.5, blaster: 1.6, shotgun: 1.3, rifle: 2.4, blaster_rifle: 2.4, minigun: 1.5, sniper: 6, rpg: 1.8, ion_cannon: 2, bow: 2.2, composite_bow: 2.6, zhuge_crossbow: 2 };
for (const [id, z] of Object.entries(ZOOM)) if (ITEMS[id]) ITEMS[id].zoom = z;
// 반동: [위로 튀는 각도, 좌우 흔들림, 화면 흔들림] — 총마다 실제처럼
const RECOIL = {
  pistol: [0.035, 0.012, 0.08], revolver: [0.07, 0.02, 0.15], deagle: [0.11, 0.03, 0.25], blaster: [0.025, 0.01, 0.05],
  uzi: [0.018, 0.02, 0.04], mp5: [0.013, 0.012, 0.03], plasma_smg: [0.01, 0.01, 0.03],
  rifle: [0.016, 0.01, 0.05], ak47: [0.024, 0.016, 0.07], m4: [0.018, 0.012, 0.05], scar: [0.03, 0.014, 0.09], blaster_rifle: [0.012, 0.008, 0.04],
  minigun: [0.008, 0.012, 0.06], m249: [0.012, 0.016, 0.07],
  shotgun: [0.12, 0.03, 0.35], double_barrel: [0.16, 0.04, 0.45],
  sniper: [0.14, 0.02, 0.4], hunting_rifle: [0.12, 0.02, 0.35], barrett: [0.26, 0.04, 0.8],
  rpg: [0.1, 0.03, 0.6], ion_cannon: [0.08, 0.02, 0.5],
  bow: [0.01, 0.004, 0], composite_bow: [0.012, 0.004, 0], hunter_bow: [0.01, 0.004, 0], zhuge_crossbow: [0.01, 0.006, 0.02], recurve_bow: [0.012, 0.004, 0], crossbow: [0.02, 0.006, 0.03],
};
for (const [id, r] of Object.entries(RECOIL)) if (ITEMS[id]) ITEMS[id].recoil = r;
for (const d of Object.values(ITEMS)) if (d.cat === 'wand') d.zoom = 1.4;
// 포장 음식은 손에 포장 봉투/박스를 든다
for (const d of Object.values(ITEMS)) if (d.cat === 'food' && d.eat) d.held = `food:${d.pack || d.eat[1].split(':')[0]}:${d.eat[1].split(':')[1]}`;

// 보석 효과: 무기에 박으면 weapon, 방어구에 박으면 armor 효과
export const GEMS = {
  ruby: { name: '루비', color: '#ff1744', weapon: '공격력 +20%', armor: '방어력 +6' },
  sapphire: { name: '사파이어', color: '#2979ff', weapon: '공격속도 +15%', armor: '이동속도 +5%' },
  emerald: { name: '에메랄드', color: '#00e676', weapon: '흡혈 10%', armor: '체력 재생 +1/초' },
  topaz: { name: '토파즈', color: '#ffd600', weapon: '치명타 확률 20% (피해 2배)', armor: '방어력 +6' },
  amethyst: { name: '자수정', color: '#d500f9', weapon: '독: 4초간 초당 4 피해', armor: '방어력 +6' },
  diamond: { name: '다이아몬드', color: '#e0f7fa', weapon: '방어 관통 30%', armor: '방어력 +12' },
  obsidian: { name: '흑요석', color: '#424242', weapon: '사거리 +25%', armor: '방어력 +6' },
  opal: { name: '오팔', color: '#f8bbd0', weapon: '넉백 강화', armor: '매력 +10' },
};

export const ENCHANT_FEE = 100;

export const SHOPS = {
  fishing: { title: '낚시용품점', subtitle: '낚싯대 · 미끼 · 물고기 매입' },
  seafood: { title: '매운탕·횟집', subtitle: '잡아온 물고기로 매운탕·회 · 정식 판매' },
  hunter: { title: '사냥꾼 오두막', subtitle: '사냥 장비 · 전리품 매입' },
  ranch: { title: '젤리 목장 직판장', subtitle: '우유 · 치즈 · 스테이크' },
  magicshop: { title: '마법봉 공방', subtitle: '속성 지팡이 · 마나 물약' },
  dealer: { title: '젤리 모터스 쇼룸', subtitle: '새 차 구매 · 차 키로 언제든 호출' },
  armory_3k: { title: '관우네 병기점', subtitle: '삼국지 영웅들의 무기와 갑옷' },
  armory_mil: { title: '젤리 택티컬', subtitle: '현대 밀리터리 장비 · 전차 · 헬기' },
  armory_sf: { title: '은하 무기상', subtitle: '먼 미래, 아주 먼 은하의 무기' },
  jeweler: { title: '반짝 보석상', subtitle: '보석 판매 · 무기와 방어구 인챈트' },
  hatshop: { title: '곰돌이 캡', subtitle: '모든 머리 크기의 모자' },
  eyewear: { title: '눈부심 안경원', subtitle: '선글라스와 안경' },
  clothing: { title: '말랑 패션', subtitle: '옷과 액세서리' },
  convenience: { title: '편의점', subtitle: '간식 · 도시락 · 인형' },
  pizza: { title: '피자집', subtitle: '갓 구운 피자 (포장 가능)' },
  chicken: { title: '치킨집', subtitle: '바삭바삭 치킨 (포장 가능)' },
  chinese: { title: '중국집', subtitle: '짜장 · 짬뽕 · 탕수육' },
  gukbap: { title: '국밥집', subtitle: '뜨끈한 국밥 한 그릇' },
  burger: { title: '버거집', subtitle: '버거 · 감튀 · 쉐이크' },
  bunsik: { title: '분식집', subtitle: '떡볶이 · 라면 · 김밥' },
  restaurant: { title: '한식당', subtitle: '든든한 한 끼' },
  bakery: { title: '빵집', subtitle: '갓 구운 빵' },
  cafe: { title: '카페', subtitle: '테이크아웃' },
  pharmacy: { title: '약국', subtitle: '구급상자' },
  flowershop: { title: '꽃집', subtitle: '꽃과 인형' },
  bookstore: { title: '서점', subtitle: '책과 인형' },
};

export function shopItems(type) {
  return Object.entries(ITEMS).filter(([, d]) => d.shop === type || d.shops?.includes(type)).map(([id]) => id);
}

export const itemDef = (id) => ITEMS[id] || ITEMS.fist;
export const isWeapon = (d) => ['melee', 'gun', 'throw', 'launcher', 'wand'].includes(d.cat);
export const isWearable = (d) => !!d.slot;

// 무기 최종 능력치 (보석 반영)
export function weaponStats(id, gems = []) {
  const d = itemDef(id);
  const n = (g) => gems.filter((x) => x === g).length;
  return {
    ...d,
    dmg: (d.dmg || 0) * (1 + 0.2 * n('ruby')),
    rate: (d.rate || 0.5) * Math.pow(0.85, n('sapphire')),
    range: (d.range || 2) * (1 + 0.25 * n('obsidian')),
    lifesteal: 0.1 * n('emerald'),
    crit: Math.min(0.8, 0.2 * n('topaz')),
    poison: 4 * n('amethyst'),
    pierce: Math.min(0.9, 0.3 * n('diamond')),
    knock: 1 + n('opal'),
  };
}

// 장착 아이템 목록 → 방어력 / 매력 / 속도
export function equipTotals(items) {
  let def = 0, charm = 0, speed = 0, regen = 0;
  for (const it of items) {
    if (!it) continue;
    const d = itemDef(it.id);
    def += d.def || 0;
    charm += d.charm || 0;
    for (const g of it.gems || []) {
      if (g === 'diamond') def += 12;
      else if (g === 'sapphire') speed += 0.05;
      else if (g === 'emerald') regen += 1;
      else if (g === 'opal') charm += 10;
      else def += 6;
    }
  }
  return { def, charm, speed, regen };
}

// 방어력 → 받는 피해 배율
export const damageTaken = (dmg, def, pierce = 0) => dmg * (60 / (60 + def * (1 - pierce)));

export const CLUB_CHARM = 0; // 매력과 상관없이 누구나 클럽 입장

// ---------------- 희귀도 (맵에 떨어지는 무기) ----------------
export const RARITY = {
  common: { name: '일반', color: '#cfd8dc', weight: 50 },
  rare: { name: '고급', color: '#40c4ff', weight: 30 },
  epic: { name: '희귀', color: '#d500f9', weight: 15 },
  legendary: { name: '전설', color: '#ffab00', weight: 5 },
};
const RARITY_OF = {
  common: ['wood_sword', 'iron_sword', 'combat_knife', 'pistol', 'revolver', 'uzi', 'shotgun', 'bow', 'crossbow'],
  rare: ['qinggang', 'twin_swords', 'deagle', 'mp5', 'double_barrel', 'rifle', 'ak47', 'm4', 'hunting_rifle', 'blaster', 'composite_bow', 'recurve_bow', 'grenade', 'wand_wind', 'wand_ice', 'wand_fire', 'wand_poison'],
  epic: ['serpent_spear', 'scar', 'sniper', 'plasma_smg', 'blaster_rifle', 'm249', 'rpg', 'zhuge_crossbow', 'thermal', 'wand_thunder', 'wand_holy'],
  legendary: ['halberd', 'dragon_glaive', 'yitian', 'minigun', 'barrett', 'saber_blue', 'saber_red', 'saber_green', 'ion_cannon', 'wand_dark'],
};
// 맵 드랍: 먼저 무기 종류를 고르게 뽑고(근접무기만 몰리지 않게), 그 안에서 희귀도 가중치로 뽑는다
export const DROP_GROUPS = [
  ['melee', 1, ['wood_sword', 'iron_sword', 'combat_knife', 'qinggang', 'twin_swords', 'serpent_spear', 'halberd', 'dragon_glaive', 'yitian']],
  ['saber', 0.5, ['saber_blue', 'saber_red', 'saber_green']],
  ['pistol', 1, ['pistol', 'revolver', 'deagle', 'blaster']],
  ['smg', 0.8, ['uzi', 'mp5', 'plasma_smg']],
  ['shotgun', 0.9, ['shotgun', 'double_barrel']],
  ['rifle', 1.2, ['ak47', 'm4', 'rifle', 'scar', 'blaster_rifle']],
  ['sniper', 0.9, ['sniper', 'hunting_rifle', 'barrett']],
  ['bow', 0.9, ['bow', 'recurve_bow', 'composite_bow']],
  ['crossbow', 0.7, ['crossbow', 'zhuge_crossbow']],
  ['heavy', 0.5, ['m249', 'minigun', 'rpg', 'ion_cannon']],
  ['throw', 0.4, ['grenade', 'thermal']],
  ['wand', 1, ['wand_fire', 'wand_ice', 'wand_thunder', 'wand_wind', 'wand_poison', 'wand_holy', 'wand_dark']], // 마법봉도 길에 떨어진다
];
export const rarityOf = (id) => Object.keys(RARITY_OF).find((r) => RARITY_OF[r].includes(id)) || 'common';
export const DROP_POOL = RARITY_OF;
export const TEMP_MINUTES = 30;

// 무기에 맞는 탄약 이름
export const ammoName = (ammoId) => (ITEMS[ammoId]?.name || '').replace(/ ×\d+$/, '');
