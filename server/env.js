// .env 파일을 다른 모듈보다 먼저 읽는다 (index.js에서 가장 먼저 import)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
// 시험(NODE_ENV=test)은 진짜 키 · 구글 로그인 설정을 읽지 않는다
if (process.env.NODE_ENV !== 'test' && fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
