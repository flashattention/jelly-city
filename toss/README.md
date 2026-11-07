# 드림 러너 토스 미니앱 (앱인토스)

웹 드림 러너와 **같은 게임 코드**를 토스 미니앱으로 포장해요. 게임을 고칠 때는 `public/`만 고치고, 미니앱을 낼 때 번들을 다시 만들어 올려요.

## 웹과 다른 점

| | 웹 | 토스 미니앱 |
|---|---|---|
| 로그인 | 구글 · 체험판 | 토스 로그인 (앱 안에서 바로) |
| 계정 · 기록 · 별 · 치장 | `dream-runner.json` · 웹 계정 | `dream-runner-toss.json` · `toss-users.json` (계정 아이디는 `toss:`로 시작) |
| 모드 | 혼자 · 같이 달리기 | 혼자 달리기만 |
| 광고 | 없음 | 판이 끝나면 "광고 보고 별 한 번 더" (보고 싶은 사람만, 판마다 한 번, 하루 40번) |

- 미니앱 요청은 `/api/toss/…`로 와요. 서버는 같은 드림 러너 · 치장 API를 토스 저장소에 써요 (`server/index.js`, `server/toss.js`).
- 게임 코드는 `window.__TOSS__`가 있으면 토스 모드로 돌아요 (`public/shared/js/platform.js`).

## .ait 만들기

```bash
cd toss/app
npm install        # 처음 한 번 (앱인토스 SDK · esbuild)
npm run build      # 번들(dist/) → SDK 다리 묶기(dist/toss-bridge.js) → toss/app/dream-runner.ait
```

- `dist/`는 웹 드림 러너 코드를 그대로 복사한 것이에요 (`tools/toss-bundle.mjs`). 게임은 `public/`만 고치면 돼요.
- `bridge.js`가 토스 SDK를 게임에 잇는 다리예요: 토스 로그인(`appLogin`) · 보상형 광고(`loadFullScreenAd` / `showFullScreenAd`, 보상은 `userEarnedReward`에서만).
- `apps-in-toss.config.ts`의 `appName`은 콘솔에 등록한 앱 이름과 같아야 올라가요.

## 출시 · 업데이트할 때

1. `npm run build`로 `dream-runner.ait`를 만들어 콘솔 '앱 번들'에 올리고 '토스앱 테스트'로 확인해요.
2. 검수 요청 (평균 2~3일) → 승인되면 '출시하기'.
3. 보상형 광고: `bridge.js`의 `AD_GROUP`을 콘솔에서 받은 광고 그룹 아이디로 바꿔요 (지금은 개발용 시험 아이디).
4. 토스 로그인: 서버(Fly) 환경 변수에 mTLS 인증서 · 키를 넣어요.
   - `TOSS_MTLS_CERT`, `TOSS_MTLS_KEY`: PEM 글자 그대로 또는 base64
   - 키가 없으면 서버는 "토스 로그인을 준비하고 있어요"라고 답해요 (로그인 없이 달리기는 돼요).

## 웹에서 미니앱 화면 시험하기

개발 서버(`DEV_LOGIN`)에서 `/dream-runner/?toss=1`로 열면 토스 모드로 떠요. 토스 로그인 대신 시험 계정으로 들어가고, 광고는 확인 창으로 대신해요.

## 아직 남은 것

- **기록 확인 판 맞추기**: 서버는 지금 판의 게임 코드로 기록을 다시 돌려 봐요. 미니앱은 검수 때문에 며칠씩 예전 판으로 돌 수 있어서, 그동안 미니앱 기록이 "서버 결과와 다름"으로 잡힐 수 있어요. 미니앱을 낼 때마다 그 판의 게임 코드를 서버에 보관해 두고 그 판으로 돌려 보게 바꿔야 해요.
- 운영자 비상 리포트 창은 아직 웹 기록만 보여 줘요.
