// 드림 러너 PWA 서비스 워커: 언제나 인터넷에서 새로 받는다 (새 버전 · 기록 확인이 어긋나지 않게)
//   인터넷이 끊겼을 때만 마지막으로 받은 화면 · 파일을 보여 준다. API(/api/)와 다른 곳 파일은 손대지 않는다
const CACHE = 'dream-runner-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('/dream-runner/'))));
});
