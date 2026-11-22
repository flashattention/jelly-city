// 영어 사전: 시험하며 찾은 나머지 · 사전끼리 겹칠 때 정하기 (낱말은 맨 나중에 합쳐져 이기고, 패턴은 맨 앞에서 먼저 본다)
export default {
  // 메달 등급이 요일(금) · 나침반(동)보다 자주 보인다
  '금': 'Gold',
  '은': 'Silver',
  '동': 'Bronze',
  '언어 · Language': 'Language',
};
export const PATTERNS = [
  ['^(꿈|지옥|이공간|시대) 1개를 지났어요$', 'passed 1 $1'],
  ['^서울 코스 1개를 지났어요$', 'passed 1 Seoul course'],
];
