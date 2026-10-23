// 로그인하지 않은 사람의 캐릭터: 이 기기(브라우저)에만 저장 · 최대 4개 · 모양은 계정 캐릭터와 똑같은 형식
//   token 은 'local:…' 로 시작해서 계정 캐릭터와 섞이지 않는다
import { store } from './account.js';

const KEY = 'jelly.localChars';
export const LOCAL_MAX = 4;
export const isLocal = (token) => String(token || '').startsWith('local:');
export function localChars() {
  try { const a = JSON.parse(store.get(KEY) || '[]'); return Array.isArray(a) ? a.filter((c) => c && isLocal(c.token) && c.name) : []; } catch { return []; }
}
function put(list) { store.set(KEY, JSON.stringify(list.slice(0, LOCAL_MAX))); }
export function addLocal(profile, starter = {}) {
  const list = localChars();
  if (list.length >= LOCAL_MAX) throw new Error(`이 기기에는 캐릭터를 ${LOCAL_MAX}개까지 만들 수 있어요`);
  const c = { token: 'local:' + Math.random().toString(36).slice(2, 10), name: String(profile.name || '곰돌이').slice(0, 12), profile: { ...profile, name: String(profile.name || '곰돌이').slice(0, 12) }, starter, local: true };
  list.push(c); put(list);
  return c;
}
export function updateLocal(token, patch) { const list = localChars(); const c = list.find((x) => x.token === token); if (c) { c.profile = { ...c.profile, ...patch }; put(list); } return list; }
export function removeLocal(token) { const list = localChars().filter((x) => x.token !== token); put(list); return list; }
