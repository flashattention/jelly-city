// 하루 퀘스트 (게임 날짜마다 4개)
export const QUEST_POOL = [
  { id: 'work2', text: '💼 일 2번 하기', ev: 'work', n: 2, xp: 200, money: 80 },
  { id: 'eat2', text: '🍽️ 식당에서 2번 먹고 가기', ev: 'eatin', n: 2, xp: 120, money: 30 },
  { id: 'talk3', text: '💬 시민 3명과 대화하기', ev: 'talk', n: 3, xp: 120, money: 30 },
  { id: 'flirt3', text: '💘 플러팅 3번 하기 (B)', ev: 'flirt', n: 3, xp: 100, money: 20 },
  { id: 'photo2', text: '📷 사진 2장 찍기 (P)', ev: 'photo', n: 2, xp: 90, money: 20 },
  { id: 'insta1', text: '📸 인스타그램에 사진 올리기', ev: 'insta', n: 1, xp: 130, money: 40 },
  { id: 'range300', text: '🎯 사격장에서 300점 넘기기', ev: 'range', n: 300, max: true, xp: 220, money: 60 },
  { id: 'fly300', text: '🪽 하늘을 300m 날기 (Space 두 번)', ev: 'fly', n: 300, xp: 150, money: 40 },
  { id: 'buy1', text: '🛍️ 상점에서 물건 사기', ev: 'buy', n: 1, xp: 60, money: 10 },
  { id: 'takeout2', text: '🥡 음식 2개 포장하기', ev: 'takeout', n: 2, xp: 80, money: 20 },
  { id: 'walk800', text: '🏃 800m 걷거나 달리기', ev: 'walk', n: 800, xp: 90, money: 20 },
  { id: 'drive1500', text: '🚗 1.5km 운전하기', ev: 'drive', n: 1500, xp: 130, money: 40 },
  { id: 'sms2', text: '💬 친구에게 문자 2통 보내기', ev: 'sms', n: 2, xp: 80, money: 20 },
  { id: 'magic5', text: '🪄 마법 5번 쓰기', ev: 'magic', n: 5, xp: 110, money: 30 },
  { id: 'fish3', text: '🎣 물고기 3마리 낚기', ev: 'fish', n: 3, xp: 150, money: 40 },
  { id: 'hunt2', text: '🏹 야생동물 2마리 사냥하기', ev: 'hunt', n: 2, xp: 200, money: 60 },
  { id: 'capture1', text: '🪢 동물 1마리 포획하기 (체력 절반 아래 → Z)', ev: 'capture', n: 1, xp: 250, money: 80 },
  { id: 'sleep1', text: '😴 푹 자기', ev: 'sleep', n: 1, xp: 60, money: 10 },
];
export const questDef = (id) => QUEST_POOL.find((q) => q.id === id);

// 날짜로 정해지는 퀘스트 4개 (같은 날엔 같은 퀘스트)
export function dailyQuests(day, seedStr = '') {
  let h = day * 2654435761 >>> 0;
  for (const ch of seedStr) h = (h ^ ch.charCodeAt(0)) * 16777619 >>> 0;
  const pool = [...QUEST_POOL];
  const out = [];
  while (out.length < 4 && pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0].id);
  }
  return out;
}
