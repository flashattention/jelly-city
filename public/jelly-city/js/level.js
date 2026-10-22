// 레벨: 만렙 없음. 레벨이 오를수록 필요한 경험치가 빠르게 늘고, 능력치가 좋아진다 (서버·브라우저 공용)
export const expNeed = (L) => Math.round(80 * Math.pow(Math.max(1, L), 1.65));

export function levelStats(L) {
  L = Math.max(1, Math.floor(L) || 1);
  const k = L - 1;
  return {
    maxHp: 100 + k * 6,                       // 체력
    dmg: 1 + k * 0.04,                        // 파워 (공격력 배율)
    acc: Math.max(0.2, 1 - k * 0.03),         // 명중률 (탄 퍼짐 배율, 낮을수록 정확)
    crit: Math.min(0.3, k * 0.005),           // 치명타 추가 확률
    speed: Math.min(0.2, k * 0.005),          // 이동 속도 보너스
    mana: 100 + k * 4,                        // 마나 (마법봉)
  };
}

// 경험치를 더하고 레벨업 횟수를 돌려준다
export function addExp(stats, v) {
  stats.level ||= 1; stats.exp ||= 0;
  stats.exp += Math.max(0, Math.round(v));
  let ups = 0;
  while (stats.exp >= expNeed(stats.level)) { stats.exp -= expNeed(stats.level); stats.level++; ups++; }
  return ups;
}

// 시민 레벨: 나이와 직업 시급으로 정해진다
export function npcLevel(c, rnd = 0.5) {
  const wage = c.job?.wage || 15;
  return Math.max(1, Math.round(c.age / 9 + wage / 10 + rnd * 4));
}
