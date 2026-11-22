// 한글 문자열 리터럴 뽑기 (주석 제외): node tools/ko-strings.mjs <파일…>  · V=1 이면 줄마다 출력 (다국어 사전 만들 때)
import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8'); const out = []; let i = 0, line = 1;
  while (i < s.length) { const c = s[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && s[i+1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i+1] === '*') { const e = s.indexOf('*/', i+2); for (let k=i;k<e;k++) if (s[k]==='\n') line++; i = e + 2; continue; }
    if (c === "'" || c === '"' || c === '`') { let j = i + 1, l0 = line; while (j < s.length && s[j] !== c) { if (s[j] === '\\') j++; if (s[j]==='\n') line++; j++; } const lit = s.slice(i+1, j); if (/[가-힣]/.test(lit)) out.push([l0, lit]); i = j + 1; continue; }
    i++; }
  console.log(`== ${f} ${out.length}`); if (process.env.V) for (const [l, t] of out) console.log(l + ': ' + t.slice(0, 160).replace(/\n/g, '⏎'));
}
