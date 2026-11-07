// 토스 SDK 다리 예시: 미니앱 프로젝트에서 이 파일을 toss/bridge.js 로 복사해 채운다
//   게임 코드는 window.__TOSS__ 만 본다 (public/shared/js/platform.js). SDK 함수 이름 · 모양은 앱인토스 개발자센터 문서로 확인해서 맞춘다
//   - 토스 로그인: appLogin() → { authorizationCode, referrer } 를 그대로 돌려주면 서버가 사용자 키로 바꾼다
//   - 보상형 광고: 끝까지 봐서 보상을 받으면 true, 닫거나 실패하면 false
//   showRewardedAd 를 빼 두면 게임은 광고 버튼을 보여 주지 않는다
import { appLogin } from '@apps-in-toss/web-framework';

window.__TOSS__ = {
  apiBase: 'https://jelly-city.fly.dev',
  appLogin: () => appLogin(),
  // showRewardedAd: () => new Promise((resolve) => {
  //   // 개발자센터 '인앱 광고' 문서의 보상형 광고: 불러오기 → 보여 주기 → 보상 이벤트에서 resolve(true), 닫힘 · 실패에서 resolve(false)
  // }),
};
