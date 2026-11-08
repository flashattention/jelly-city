// 토스 SDK 다리: 게임 코드는 window.__TOSS__ 만 본다 (public/shared/js/platform.js)
//   esbuild 로 SDK 와 함께 묶어서 dist/toss-bridge.js 가 된다 (npm run build)
import { appLogin, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

// 보상형 광고 그룹 아이디: 콘솔에서 받은 것으로 바꾼다 (아래는 개발용 시험 아이디)
const AD_GROUP = 'ait.v2.live.05380489906a496f'; // 콘솔에서 받은 보상형 광고 그룹 (운영)
let ready = false;
function preload() {
  if (loadFullScreenAd.isSupported && !loadFullScreenAd.isSupported()) return; // 광고를 못 띄우는 환경
  loadFullScreenAd({ options: { adGroupId: AD_GROUP }, onEvent: (e) => { if (e.type === 'loaded') ready = true; }, onError: () => { ready = false; } });
}

window.__TOSS__ = {
  apiBase: 'https://jelly-city.fly.dev',
  // 토스 로그인: 인가 코드 · referrer 를 서버로 보내면 서버가 사용자 키로 바꾼다 (버튼을 눌렀을 때 부른다)
  appLogin: () => appLogin(),
  // 끝까지 봐서 보상을 받으면 true · 닫거나 실패하면 false (보상은 userEarnedReward 에서만)
  showRewardedAd: () => new Promise((resolve) => {
    if (!ready) { preload(); resolve(false); return; }
    ready = false; let earned = false;
    showFullScreenAd({
      options: { adGroupId: AD_GROUP },
      onEvent: (e) => { if (e.type === 'userEarnedReward') earned = true; if (e.type === 'dismissed') { resolve(earned); preload(); } },
      onError: () => { resolve(false); preload(); },
    });
  }),
};
preload();
