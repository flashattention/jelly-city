// 이미 만든 지도 파일들에 높이 바로잡기를 한 번 적용한다 (새로 만드는 지도는 hangang-map.mjs 가 저절로 한다)
//   node tools/fix-heights.mjs  → public/dream-runner/seoul · hangang 의 .json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixHeights } from './height-sanity.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let total = 0;
for (const sub of ['seoul', 'hangang']) {
  const dir = path.join(ROOT, 'public/dream-runner', sub);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const file = path.join(dir, f), M = JSON.parse(fs.readFileSync(file, 'utf8'));
    const n = fixHeights(M, (m) => console.log(`${sub}/${f} ${m}`)); if (n) { fs.writeFileSync(file, JSON.stringify(M)); total += n; }
  }
}
console.log(`바로잡은 건물 ${total}`);
