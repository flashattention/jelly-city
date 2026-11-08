// 드림 러너 게임 코드 판(버전)과 보관
//   판 = 다시 돌리기에 쓰는 게임 코드(public/dream-runner/js, public/shared/js)의 해시. 브라우저 · 토스 미니앱 번들 · 서버가 같은 방법으로 계산한다
//   서버는 켜질 때마다 지금 코드를 데이터 폴더(dream-code/<판>/)에 보관해 둔다. 토스 미니앱처럼 검수 때문에 예전 판으로 도는 기록도 그 판의 코드로 다시 돌려 볼 수 있다
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DIRS = ['public/dream-runner/js', 'public/shared/js'];
const KEEP_DAYS = 180; // 이 기간 동안 쓰이지 않은 예전 판은 지운다
export const VER_RE = /^[0-9a-f]{12}$/;

// [보관 경로(public/ 아래), 실제 파일] 목록
export function codeFiles(root = ROOT) {
  const out = [];
  for (const d of DIRS) for (const f of fs.readdirSync(path.join(root, d)).filter((x) => x.endsWith('.js')).sort()) out.push([path.posix.join(d.replace(/^public\//, ''), f), path.join(root, d, f)]);
  return out;
}
export function codeVer(root = ROOT) {
  try { const h = crypto.createHash('sha1'); for (const [rel, abs] of codeFiles(root)) { h.update(rel); h.update('\0'); h.update(fs.readFileSync(abs)); h.update('\0'); } return h.digest('hex').slice(0, 12); } catch { return 'x'; }
}

let store = null; // 보관 폴더 (archiveCode 가 정한다)
export const codeStore = () => store;
export function hasVer(v) {
  if (!store || !VER_RE.test(String(v || ''))) return false;
  const d = path.join(store, v);
  try { if (!fs.existsSync(path.join(d, 'dream-runner/js/track.js'))) return false; const now = new Date(); fs.utimesSync(d, now, now); return true; } catch { return false; }
}
// 지금 코드를 보관하고, 오래 안 쓴 판은 지운다. 보관 폴더의 node_modules 는 앱의 node_modules 를 가리켜서 three 를 같은 것으로 불러온다
export function archiveCode(dataDir, ver) {
  try {
    store = path.join(dataDir, 'dream-code'); fs.mkdirSync(store, { recursive: true });
    const nm = path.join(store, 'node_modules'), target = path.join(ROOT, 'node_modules');
    try { if (fs.readlinkSync(nm) !== target) fs.rmSync(nm, { force: true }); } catch { fs.rmSync(nm, { recursive: true, force: true }); }
    if (!fs.existsSync(nm)) fs.symlinkSync(target, nm, 'dir');
    const dst = path.join(store, ver);
    if (!fs.existsSync(path.join(dst, 'dream-runner/js/track.js'))) {
      const tmp = `${dst}.tmp`; fs.rmSync(tmp, { recursive: true, force: true });
      for (const [rel, abs] of codeFiles()) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(abs, path.join(tmp, rel)); }
      fs.renameSync(tmp, dst); console.log(`드림 러너 게임 코드 보관: ${ver}`);
    } else { const now = new Date(); fs.utimesSync(dst, now, now); }
    const old = Date.now() - KEEP_DAYS * 864e5;
    for (const v of fs.readdirSync(store)) { if (v === ver || !VER_RE.test(v)) continue; const d = path.join(store, v); if (fs.statSync(d).mtimeMs < old) fs.rmSync(d, { recursive: true, force: true }); }
  } catch (e) { console.warn('드림 러너 게임 코드 보관 실패', e.message); }
  return store;
}
