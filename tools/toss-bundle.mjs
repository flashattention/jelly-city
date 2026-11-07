// 토스 미니앱(앱인토스) 번들 만들기: 웹 드림 러너 코드를 그대로 복사해서 toss/web/ 에 정적 파일로 모은다
//   - 게임 코드는 웹과 하나: 고칠 때는 public/ 만 고치고, 미니앱을 낼 때 이 스크립트를 다시 돌린다
//   - three.js 는 외부 주소 대신 번들 안에 (미니앱 화면 파일은 토스 인프라에 올려야 한다)
//   - index.html 은 게임보다 먼저 ./toss-bridge.js (토스 SDK 다리 → window.__TOSS__)를 불러온다
//   node tools/toss-bundle.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'toss', 'web');
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
  .replace('<script type="module" src="js/main.js"></script>', '<script type="module" src="./toss-bridge.js"></script>\n  <script type="module" src="./dream-runner/js/main.js"></script>');
if (!html.includes('./toss-bridge.js') || !html.includes('./vendor/three/three.module.js')) throw new Error('index.html 모양이 바뀌었어요: tools/toss-bundle.mjs 를 고쳐 주세요');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.rmSync(path.join(OUT, 'dream-runner/index.html'));

// 다리: 미니앱 프로젝트가 SDK 로 만든 것을 넣는다. 없으면 시험용(토스 SDK 없이 웹처럼 동작) 을 둔다
const bridge = path.join(ROOT, 'toss', 'bridge.js');
fs.writeFileSync(path.join(OUT, 'toss-bridge.js'), fs.existsSync(bridge) ? fs.readFileSync(bridge, 'utf8') : "window.__TOSS__ = { apiBase: 'https://jelly-city.fly.dev' };\n");

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`토스 미니앱 번들: ${path.relative(ROOT, OUT)} (${(size(OUT) / 1024 / 1024).toFixed(1)}MB)`);
