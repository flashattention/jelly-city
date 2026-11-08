# 젤리 게임즈 문서

웹 게임 모음 **젤리 게임즈**(https://jelly-city.fly.dev)를 기획 · 개발 · 운영하며 남긴 문서예요.

| 문서 | 내용 |
|---|---|
| [드림 러너 기획서](dream-runner/기획서.md) | 핵심 재미, 맵 · 난이도 · 모드, 재화와 치장 등급, 경쟁 장치, 공정성, 플랫폼, 지표에서 나온 다음 할 일 |
| [드림 러너 의사결정 기록](dream-runner/의사결정.md) | 운영 중 생긴 문제 11개를 문제 → 근거 → 결정 → 결과로 정리 |
| [운영 지표](metrics.md) | 실제 서버 데이터로 뽑은 계정 · 판수 · 난이도 분포 · 재화 · 순위표 숫자 |
| [젤리시티 기능 정리](기능정리.md) | 3D 멀티플레이 생활 게임 젤리시티의 기능 목록 |
| [토스 미니앱](../toss/README.md) | 드림 러너 토스 미니앱 빌드 · 출시 방법 |

## 한눈에 보기

- 2026년 10월 6일 첫 가입자 이후 한 달 동안 운영하고 있어요. 커밋은 240개가 넘어요.
- 게임 19개 가운데 **드림 러너**가 주력이에요. 웹 운영 중이고, 토스 미니앱과 Microsoft Store 출시를 준비하고 있어요.
- 기획 · 결정 · 검수 · 운영은 직접 하고, 구현에는 AI 코딩 도구를 활용했어요.

## 지표 다시 뽑기

```bash
# 서버 저장 파일 받기 (개인 정보가 있으니 저장소 밖 폴더에)
for f in world dream-runner dream-runner-toss cosmetics board jelly-drift jelly-merge jelly-slide jelly-survivor jelly-ten jelly-type; do
  fly ssh console -a jelly-city -q -C "cat /data/$f.json" > ~/jelly-data/$f.json
done
node tools/metrics.mjs ~/jelly-data > docs/metrics.md
```
