// 어디서 열렸나: 토스 미니앱 번들은 게임보다 먼저 window.__TOSS__ (토스 SDK 다리)를 심어 둔다 (toss/bridge.js)
//   __TOSS__ = { apiBase: 'https://…', appLogin(): { authorizationCode, referrer }, showRewardedAd(): true(보상) / false }
//   웹에서 미니앱 화면을 시험할 때는 주소에 ?toss=1 (개발 서버에서는 토스 로그인 대신 시험 계정으로 들어간다)
const q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
export const bridge = (typeof window !== 'undefined' && window.__TOSS__) || null;
export const TOSS = !!bridge || q.has('toss');
export const API_BASE = (bridge?.apiBase || '').replace(/\/$/, '');
