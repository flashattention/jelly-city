# 드림 러너 토스 미니앱 (앱인토스)

웹 드림 러너와 **같은 게임 코드**를 토스 미니앱으로 포장해요. 게임을 고칠 때는 `public/`만 고치고, 미니앱을 낼 때 번들을 다시 만들어 올려요.

## 웹과 다른 점

| | 웹 | 토스 미니앱 |
|---|---|---|
| 로그인 | 구글 · 체험판 | 처음 열면 **기기 계정**(`toss:d_…`)을 자동으로 만들어 기록 · 별 · 치장이 남아요. 서버에 토스 로그인이 준비되면 '토스 계정에 잇기' 버튼이 떠요 |
| 계정 · 기록 · 별 · 치장 | `dream-runner.json` · 웹 계정 | `dream-runner-toss.json` · `toss-users.json` (계정 아이디는 `toss:`로 시작) |
| 모드 | 혼자 · 같이 달리기 | 혼자 달리기만 |
| 광고 | 없음 | 판이 끝나면 "광고 보고 별 한 번 더" (보고 싶은 사람만, 판마다 한 번, 하루 40번) |

- 미니앱 요청은 `/api/toss/…`로 와요. 서버는 같은 드림 러너 · 치장 API를 토스 저장소에 써요 (`server/index.js`, `server/toss.js`).
- 게임 코드는 `window.__TOSS__`가 있으면 토스 모드로 돌아요 (`public/shared/js/platform.js`).

## 기기 계정과 토스 로그인

- 사업자 등록 전에는 토스 로그인을 쓸 수 없어서, 미니앱은 기기마다 임시 아이디로 시작해요 (`server/toss.js`의 `device`). 한 곳(IP)에서 하루 30개까지 만들 수 있어요.
- 사업자 등록 후 mTLS 인증서 · 키를 서버에 넣으면 `/api/toss/status`가 `toss: true`가 되고, 기기 계정에 '토스 계정에 잇기' 버튼이 떠요.
- 이을 때는 토스 사용자 키를 **그 기기 계정 아이디에 연결**해요 (`toss-users.json`의 `links`). 아이디가 그대로라 기록 · 별 · 치장을 옮길 필요가 없고, 다른 기기에서 같은 토스 계정으로 들어오면 그 계정이 열려요.
- 기기 계정은 미니앱 저장소(localStorage)에 있는 세션으로만 열려요. 토스 앱 데이터를 지우면 그 기기 계정은 다시 열 수 없어요 (토스 계정에 이어 두면 괜찮아요).

## .ait 만들기

```bash
cd toss/app
npm install        # 처음 한 번 (앱인토스 SDK · esbuild)
npm run build      # 판 확인 → 번들(dist/) → SDK 다리 묶기(dist/toss-bridge.js) → toss/app/dreamrunner.ait
```

- `dist/`는 웹 드림 러너 코드를 그대로 복사한 것이에요 (`tools/toss-bundle.mjs`). 게임은 `public/`만 고치면 돼요.
- `bridge.js`가 토스 SDK를 게임에 잇는 다리예요: 토스 로그인(`appLogin`) · 보상형 광고(`loadFullScreenAd` / `showFullScreenAd`, 보상은 `userEarnedReward`에서만).
- `apps-in-toss.config.ts`의 `appName`은 콘솔 '앱 정보'의 앱 ID(`dreamrunner`)와 같아야 올라가요. 한국어 · 영어 앱 이름이 아니에요.

## 출시 · 업데이트할 때

1. `npm run build`로 `dreamrunner.ait`를 만들어 콘솔 '앱 번들'에 올리고 '토스앱 테스트'로 확인해요.
2. 검수 요청 (평균 2~3일) → 승인되면 '출시하기'.
3. 보상형 광고: `bridge.js`의 `AD_GROUP`을 콘솔에서 받은 광고 그룹 아이디로 바꿔요 (지금은 개발용 시험 아이디).
4. 토스 로그인: 서버(Fly) 환경 변수에 mTLS 인증서 · 키를 넣어요.
   - `TOSS_MTLS_CERT`, `TOSS_MTLS_KEY`: PEM 글자 그대로 또는 base64
   - 키가 없으면 서버는 "토스 로그인을 준비하고 있어요"라고 답해요 (로그인 없이 달리기는 돼요).

## 웹에서 미니앱 화면 시험하기

개발 서버(`DEV_LOGIN`)에서 `/dream-runner/?toss=1`로 열면 토스 모드로 떠요. 토스 로그인 대신 시험 계정으로 들어가고, 광고는 확인 창으로 대신해요.

## 기록 확인 판 (게임 코드 버전)

미니앱은 검수 때문에 며칠씩 예전 판으로 돌 수 있어요. 그래서 기록을 그 판의 게임 코드로 다시 돌려 봐요.

- 판 = `public/dream-runner/js` · `public/shared/js` 코드의 해시 (`server/dream-runner/codever.js`).
- 서버는 켜질 때마다 지금 코드를 데이터 볼륨 `/data/dream-code/<판>/`에 보관해요. 180일 동안 안 쓰인 판은 지워요.
- 번들을 만들 때 그 판을 `dist/dream-ver.js`에 적어 두고, 미니앱은 기록을 올릴 때 그 판을 같이 보내요.
- **번들은 배포된 코드로만 만들어요.** `npm run build`는 서버에 그 판이 있는지 먼저 물어보고, 없으면(커밋 · 푸시 · 배포 전) 멈춰요. 서버가 모르는 판으로 달린 기록은 확인할 수 없어서 거절되기 때문이에요.

## 아직 남은 것

- 운영자 비상 리포트 창은 아직 웹 기록만 보여 줘요.
