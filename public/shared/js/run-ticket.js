// 혼자 하기 출발표: 판을 시작할 때 서버에서 받아 두고, 기록을 남길 때 같이 보낸다
//   서버는 출발표로 실제로 지난 시간을 보고, 같은 판으로 두 번 기록하지 못하게 한다 (server/shared/records.js)
//   받지 못해도(오프라인 · 오류) 게임은 그대로 되고, 기록은 출발표 없이 보낸다
const T = {};
export function takeTicket(api, b) {
  const p = fetch(`${api}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ b }) })
    .then((r) => (r.ok ? r.json() : null)).then((j) => j?.tk || null).catch(() => null);
  T[api] = { b, p };
}
// 그 판의 출발표 (한 번 쓰면 없어진다)
export async function ticketFor(api, b) {
  const t = T[api]; if (!t || t.b !== b) return null;
  delete T[api];
  return t.p;
}
