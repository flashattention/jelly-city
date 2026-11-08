// 토스 미니앱(앱인토스) 번들 만들기: 웹 드림 러너 코드를 그대로 복사해서 toss/app/dist/ 에 정적 파일로 모은다 (ait build 가 이 폴더를 그대로 .ait 로 포장한다)
//   - 게임 코드는 웹과 하나: 고칠 때는 public/ 만 고치고, 미니앱을 낼 때 이 스크립트를 다시 돌린다
//   - three.js 는 외부 주소 대신 번들 안에 (미니앱 화면 파일은 토스 인프라에 올려야 한다)
//   - index.html 은 게임보다 먼저 ./toss-bridge.js (토스 SDK 다리 → window.__TOSS__)를 불러온다
//   보통은 toss/app 에서 npm run build (번들 → 다리 묶기 → .ait) 로 쓴다
import fs from 'node:fs';
import path from 'node:path';
import { codeVer } from '../server/dream-runner/codever.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'toss', 'app', 'dist');
const cp = (a, b) => fs.cpSync(path.join(ROOT, a), path.join(OUT, b), { recursive: true });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
cp('public/dream-runner', 'dream-runner');
cp('public/shared', 'shared');
cp('node_modules/three/build/three.module.js', 'vendor/three/three.module.js');
cp('node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', 'vendor/three/addons/utils/BufferGeometryUtils.js');

// 진입 화면: 드림 러너 index.html 을 맨 위로 옮기고 주소만 고친다
let html = fs.readFileSync(path.join(ROOT, 'public/dream-runner/index.html'), 'utf8');
html = html
  .replace('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js', './vendor/three/three.module.js')
  .replace('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/', './vendor/three/addons/')
  .replace('href="style.css"', 'href="dream-runner/style.css"')
  .replace('src="/shared/js/playtime.js"', 'src="./shared/js/playtime.js"')
  .replace('<script type="module" src="js/main.js"></script>', '<script src="./dream-ver.js"></script>\n  <script type="module" src="./toss-bridge.js"></script>\n  <script type="module" src="./dream-runner/js/main.js"></script>');
if (!html.includes('./dream-ver.js') || !html.includes('./toss-bridge.js') || !html.includes('./vendor/three/three.module.js')) throw new Error('index.html 모양이 바뀌었어요: tools/toss-bundle.mjs 를 고쳐 주세요');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.rmSync(path.join(OUT, 'dream-runner/index.html'));

// 게임 코드 판: 미니앱 기록은 서버가 이 판의 코드로 다시 돌려 본다. 서버가 이 판을 한 번도 돌린 적이 없으면(아직 배포 전) 미니앱 기록이 모두 거절되니 번들을 만들지 않는다
const VER = codeVer(ROOT);
fs.writeFileSync(path.join(OUT, 'dream-ver.js'), `window.__DREAM_VER__ = '${VER}';\n`);
const API = process.env.TOSS_API || 'https://jelly-city.fly.dev';
if (process.env.TOSS_SKIP_VER_CHECK !== '1') {
  const j = await fetch(`${API}/api/dream/ver?has=${VER}`).then((r) => r.json()).catch(() => null);
  if (!j) throw new Error(`서버(${API})에 물어보지 못했어요. 그래도 만들려면 TOSS_SKIP_VER_CHECK=1`);
  if (!j.has) throw new Error(`이 코드(판 ${VER})는 아직 서버에 배포되지 않았어요 (서버 판 ${j.v}). 먼저 커밋 · 푸시해서 배포가 끝난 뒤 다시 만들어 주세요`);
}

// 다리: 시험용(토스 SDK 없이, 서버 주소만)을 먼저 둔다. npm run build 에서는 toss/app/bridge.js 를 SDK 와 묶어 덮어쓴다
fs.writeFileSync(path.join(OUT, 'toss-bridge.js'), "window.__TOSS__ = { apiBase: 'https://jelly-city.fly.dev' };\n");

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`토스 미니앱 번들: ${path.relative(ROOT, OUT)} (${(size(OUT) / 1024 / 1024).toFixed(1)}MB) · 게임 코드 판 ${VER}`);
