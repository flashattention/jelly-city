// 앱인토스 설정: appName 은 콘솔 '앱 정보'의 앱 ID(appName)와 같아야 올라간다 (한국어 · 영어 앱 이름이 아니다)
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'dreamrunner',
  permissions: [],
  navigationBar: { theme: 'dark' },
  // 게임: 화면이 튕기거나 당겨서 새로 고침 · 뒤로 가기 손짓이 달리기를 방해하지 않게. 음악은 누르지 않아도 나오게
  webView: { bounces: false, pullToRefreshEnabled: false, overScrollMode: 'never', allowsBackForwardNavigationGestures: false, mediaPlaybackRequiresUserAction: false, allowsInlineMediaPlayback: true },
  webBundleDir: 'dist',
});
