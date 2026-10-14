// 야생동물 데이터 (서버·브라우저 공용)
// region: 사는 곳, hostile: 플레이어를 보면 덤빈다, flee: 플레이어를 보면 도망, livestock: 목장 가축 (사냥 불가)
export const ANIMALS = {
  bear: { name: '곰', emoji: '🐻', hp: 260, speed: 3, run: 8.5, dmg: 24, aggro: 16, hostile: true, region: ['forest', 'mountain'], loot: [['bear_hide', 1, 1], ['bear_meat', 2, 1]], n: 12, xp: 70, r: 1.3, h: 1.8 },
  deer: { name: '사슴', emoji: '🦌', hp: 70, speed: 2.5, run: 11, flee: 22, region: ['forest', 'meadow', 'valley'], loot: [['deer_meat', 2, 1], ['deer_trophy', 1, 0.6]], n: 22, xp: 25, r: 0.9, h: 1.8 },
  wolf: { name: '늑대', emoji: '🐺', hp: 110, speed: 3.5, run: 10, dmg: 12, aggro: 20, hostile: true, region: ['forest', 'mountain'], loot: [['wolf_pelt', 1, 1]], n: 10, xp: 40, r: 0.8, h: 1.1 },
  boar: { name: '멧돼지', emoji: '🐗', hp: 130, speed: 2.5, run: 9, dmg: 15, aggro: 8, hostile: true, region: ['forest', 'jungle', 'meadow'], loot: [['boar_meat', 2, 1]], n: 12, xp: 30, r: 0.9, h: 1.0 },
  rabbit: { name: '토끼', emoji: '🐇', hp: 20, speed: 2, run: 12, flee: 14, region: ['meadow', 'forest', 'island'], loot: [['rabbit_fur', 1, 1]], n: 18, xp: 8, r: 0.4, h: 0.6 },
  croc: { name: '악어', emoji: '🐊', hp: 240, speed: 1.6, run: 7.5, dmg: 28, aggro: 11, hostile: true, swim: true, region: ['swamp', 'amazon'], loot: [['croc_skin', 1, 1], ['croc_meat', 1, 1]], n: 16, xp: 65, r: 1.2, h: 0.8 },
  tiger: { name: '호랑이', emoji: '🐯', hp: 300, speed: 3.2, run: 12, dmg: 30, aggro: 24, hostile: true, region: ['jungle'], loot: [['tiger_pelt', 1, 1], ['tiger_meat', 1, 0.6]], n: 9, xp: 100, r: 1.2, h: 1.5 },
  anaconda: { name: '아나콘다', emoji: '🐍', hp: 280, speed: 1.8, run: 6, dmg: 26, aggro: 12, hostile: true, swim: true, region: ['amazon'], loot: [['snake_skin', 1, 1]], n: 9, xp: 90, r: 1.1, h: 0.6 },
  jaguar: { name: '재규어', emoji: '🐆', hp: 220, speed: 3.5, run: 13, dmg: 24, aggro: 22, hostile: true, region: ['amazon'], loot: [['jaguar_pelt', 1, 1]], n: 9, xp: 90, r: 1.0, h: 1.3 },
  cow: { name: '젖소', emoji: '🐄', hp: 150, speed: 1.2, livestock: true, pen: [882, -358, 978, -62], n: 10, r: 1.2, h: 1.6 },
  sheep: { name: '양', emoji: '🐑', hp: 80, speed: 1.3, livestock: true, pen: [1022, -358, 1118, -102], n: 12, r: 0.8, h: 1.1 },
  horse: { name: '말', emoji: '🐎', hp: 160, speed: 2.2, livestock: true, pen: [882, -358, 978, -62], n: 6, r: 1.1, h: 2.0 },
  // 드래곤 협곡: 하늘을 날며 불을 뿜는다 (fly: 날기, fire: 불 뿜기). 체력이 절반 아래로 떨어지면 지쳐서 땅에 내려앉는다
  dragon: { name: '드래곤', emoji: '🐉', hp: 1200, speed: 6, run: 16, dmg: 30, aggro: 34, hostile: true, fly: true, fire: true, region: ['dragon'], loot: [['dragon_scale', 2, 1], ['dragon_heart', 1, 0.5]], n: 5, xp: 500, r: 2.6, h: 3.6, size: 1.6 },
  baby_dragon: { name: '새끼 드래곤', emoji: '🐲', hp: 380, speed: 5, run: 13, dmg: 13, aggro: 24, hostile: true, fly: true, fire: true, region: ['dragon'], loot: [['baby_dragon_scale', 1, 1]], n: 7, xp: 160, r: 1.3, h: 1.8, size: 0.75 },
  // 도시 말: 길을 어슬렁거리고, 가까이 가서 E를 누르면 바로 올라탄다 (잡거나 다치게 할 수 없다)
  steed: { name: '도시 말', emoji: '🐎', hp: 160, speed: 2.4, livestock: true, city: true, region: [], loot: [], n: 14, r: 1.1, h: 2.0 },
};

// 포획해서 타고 다닐 때: walk/run 땅 속도(m/s), jump 점프력, swim 헤엄 속도, fly/flyRun 날기 속도, seat 등 높이(크기 1 기준), scale 탈 때 크기
// 실제 동물처럼: 말·재규어·사슴이 가장 빠르고, 곰·멧돼지는 묵직하게, 악어·아나콘다는 물에서 빠르다
export const RIDE = {
  bear: { walk: 4.5, run: 11, jump: 7, seat: 1.7 },
  deer: { walk: 5.5, run: 15, jump: 12, seat: 1.68 },
  wolf: { walk: 5.5, run: 13.5, jump: 9.5, seat: 1.12, scale: 1.2 },
  boar: { walk: 4.5, run: 11, jump: 6.5, seat: 1.08, scale: 1.2 },
  rabbit: { walk: 4.5, run: 12, jump: 13, seat: 0.5, scale: 1.9, hop: true },
  croc: { walk: 3, run: 6, jump: 4, swim: 9, seat: 0.56 },
  tiger: { walk: 5.5, run: 15, jump: 10, seat: 1.24 },
  anaconda: { walk: 3, run: 6.5, jump: 3, swim: 8, seat: 0.48, slither: true },
  jaguar: { walk: 5.5, run: 16, jump: 11, seat: 1.22 },
  cow: { walk: 3.5, run: 8.5, jump: 5.5, seat: 1.7 },
  sheep: { walk: 3.5, run: 8, jump: 6.5, seat: 1.42 },
  horse: { walk: 6, run: 18, jump: 10, seat: 1.9 },
  dragon: { walk: 4.5, run: 9, jump: 9, fly: 17, flyRun: 30, seat: 1.95 },
  baby_dragon: { walk: 4, run: 8, jump: 8, fly: 12, flyRun: 20, seat: 1.95 },
};
export const ANIMAL_KINDS = Object.keys(ANIMALS);
