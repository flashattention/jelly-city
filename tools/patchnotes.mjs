// 패치노트 만들기: public/shared/patchnotes.json 뒤에 쌓인 커밋을 앞에 덧붙인다 (배포할 때 CI 가 돌린다)
//   기록에 공개되지 않는 것: 작성자 · 이메일 · 내부 작업(docs/ci/chore 등)
//   커밋 제목이 곧 플레이어가 보는 글이다. 패치노트에 안 넣을 커밋은 본문에 [노트없음] 을 적는다
//   node tools/patchnotes.mjs         새 커밋 덧붙이기
//   node tools/patchnotes.mjs --check 공개하면 안 되는 말이 있는지 검사
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../public/shared/patchnotes.json', import.meta.url);
export const GAMES = { 'jelly-city': ['젤리시티'], 'dream-runner': ['드림러너', '드림 러너'], 'jelly-rumble': ['젤리대소동', '젤리 가이즈', 'jelly-guys'], 'jelly-merge': ['젤리 머지', '젤리머지'], 'jelly-arena': ['젤리 아레나', '젤리아레나'], 'jelly-hide': ['젤리 숨바꼭질', '숨바꼭질'], 'jelly-slide': ['젤리 슬라이드', '젤리슬라이드'], 'jelly-court': ['젤리궁정', '젤리뱅'], 'jelly-ding': ['젤리 땡', '젤리땡'], 'jelly-guard': ['젤리수호대', '젤리워치', 'jelly-watch'], 'jelly-tactical': ['젤리택티컬', '젤리어택', 'jelly-attack'], 'jelly-drop': ['젤리드롭', '젤리배그', 'jelly-bg'], 'jelly-drift': ['젤리드리프트', '젤리라이더', 'jelly-rider'], 'jelly-ten': ['젤리텐', '사과게임', 'jelly-apple'], 'jelly-word': ['끝말잇기'], 'jelly-draw': ['그림릴레이'], 'jelly-type': ['타자연습'], 'jelly-sketch': ['스케치퀴즈'], 'jelly-survivor': ['서바이버'] };
// 옛 이름은 새 이름으로
const RENAME = [['젤리배그', '젤리드롭'], ['젤리워치', '젤리수호대'], ['젤리라이더', '젤리드리프트'], ['젤리어택', '젤리택티컬'], ['젤리 가이즈', '젤리대소동'], ['젤리뱅', '젤리궁정'], ['사과게임', '젤리텐'], ['젤리병단', '하늘갈고리']];
// 다른 작품 · 실제 제품 이름: 이런 말이 든 줄은 싣지 않는다
const BLOCK = /오버워치|overwatch|배그|pubg|배틀그라운드|리그 ?오브|league of|\bLoL\b|카트라이더|크레이지|서든어택|포트나이트|fortnite|폴가이즈|fall guys|진격의 거인|입체기동|텔레스트레이션|탕탕|뱀서|뱀파이어 서바이버|스타듀|마인크래프트|GTA|아이폰|iphone|인스타|튄더|틴더|제다이|스타워즈|겐지|디바|d\.va|정크랫|트레이서|위도우|윈스턴|라인하르트|메르시|모이라|리퍼|바론/i;
// 플레이어에게 뜻 없는 기술 이야기
const TECH = /\.(js|json|css|html|md)\b|\/[a-z-]+\/|[A-Z]{3,}_[A-Z]+|SIGTERM|README|\bAPI\b|WebSocket|\bCI\b|리팩터|배포 검사/;
const SKIP = new Set(['docs', 'ci', 'chore', 'style', 'test', 'build', 'refactor']);

const clean = (s) => { for (const [a, b] of RENAME) s = s.split(a).join(b); return s.trim(); };
const safe = (s) => !BLOCK.test(s) && !TECH.test(s);
function gamesOf(text) { const out = Object.entries(GAMES).filter(([id, names]) => text.includes(id) || names.some((n) => text.includes(n))).map(([id]) => id); return out.length ? out : ['all']; }
export function toEntry(sha, date, raw) {
  const lines = raw.split('\n').filter((l) => !/^(Co-Authored-By|Signed-off-by):/i.test(l));
  if (raw.includes('[노트없음]')) return null;
  const head = /^([a-z]+)(?:\s*·\s*[a-z]+)*(?:\(([^)]*)\))?:\s*(.*)$/.exec(lines[0] || '');
  if (head && SKIP.has(head[1])) return null;
  const title = clean(head ? head[3] : lines[0] || ''), games = gamesOf(`${head?.[2] || ''} ${lines[0] || ''}`);
  const items = lines.slice(1).filter((l) => /^\s*-\s/.test(l)).map((l) => clean(l.replace(/^\s*-\s*/, ''))).filter(safe);
  const name = GAMES[games[0]]?.[0] || '젤리 게임즈';
  return { d: date, g: games, t: head?.[1] === 'fix' ? 'fix' : /새 게임|새 영웅/.test(title) ? 'new' : 'up', c: [sha], title: safe(title) && title ? title : `${name} 업데이트`, items };
}
const readAll = () => JSON.parse(readFileSync(FILE, 'utf8'));
if (process.argv[1]?.endsWith('patchnotes.mjs')) {
  const data = readAll();
  if (process.argv.includes('--check')) {
    const bad = data.notes.flatMap((n) => [n.title, ...n.items]).filter((s) => BLOCK.test(s) || RENAME.some(([a]) => s.includes(a)));
    if (bad.length) { console.error('공개하면 안 되는 말:', bad); process.exit(1); }
    console.log(`패치노트 ${data.notes.length}개 검사 통과`);
  } else {
    const log = execFileSync('git', ['log', '--reverse', '--date=short', '--format=%h%x00%ad%x00%B%x01', `${data.base}..HEAD`], { encoding: 'utf8' });
    const fresh = log.split('\x01').map((r) => r.trim()).filter(Boolean).map((r) => { const [h, d, b] = r.split('\0'); return toEntry(h, d, b); }).filter(Boolean);
    data.notes.unshift(...fresh.reverse());
    writeFileSync(FILE, JSON.stringify(data));
    console.log(`새 패치노트 ${fresh.length}개`);
  }
}
