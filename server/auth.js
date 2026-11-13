// 구글 로그인: 브라우저가 받은 ID 토큰(JWT)을 구글 tokeninfo 엔드포인트로 검증한다
import { parseSafe, sec, clientIp } from './shared/guard.js';
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
// 구글 클라이언트 ID가 없으면 (로컬 개발) 이름만으로 로그인하는 개발용 모드
export const DEV_LOGIN = !GOOGLE_CLIENT_ID && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1');

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export async function verifyGoogle(credential) {
  if (typeof credential !== 'string' || credential.length > 4096) throw new Error('잘못된 토큰');
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('구글 인증 실패');
  const t = await res.json();
  if (t.aud !== GOOGLE_CLIENT_ID) throw new Error('다른 앱의 토큰');
  if (!ISSUERS.has(t.iss)) throw new Error('발급자 불일치');
  if (Number(t.exp) * 1000 < Date.now()) throw new Error('토큰 만료');
  if (t.email_verified !== 'true' && t.email_verified !== true) throw new Error('이메일 미인증');
  return { sub: `g:${t.sub}`, email: t.email || '', name: t.name || t.email?.split('@')[0] || '젤리', picture: t.picture || '' };
}

// JSON 본문 읽기 (작은 요청만). 모든 POST 가 여기를 거친다
//   크기: Content-Length 가 한도를 넘으면 읽지도 않고, 실제로 넘치면 끊는다
//   오염: __proto__ · constructor · prototype 키가 든 본문은 버린다 (보안 사건으로 센다)
//   꼴: 객체가 아니면(null · 숫자 · 배열) 빈 객체로
export function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    const tooBig = () => { reject(Object.assign(new Error('too large'), { status: 413 })); req.resume(); }; // 답은 보내고, 남은 본문은 버린다 (요청 시간 제한 60초)
    if (Number(req.headers?.['content-length']) > limit) return tooBig();
    let size = 0, done = false;
    const chunks = [];
    req.on('data', (c) => { if (done) return; size += c.length; if (size > limit) { done = true; reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (done) return;
      try { const v = chunks.length ? parseSafe(Buffer.concat(chunks).toString('utf8')) : {}; resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : {}); }
      catch (e) { if (e.poison) sec.note('json', { ip: clientIp(req), where: String(req.url || '').split('?')[0].slice(0, 40), detail: 'proto key' }); reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}
