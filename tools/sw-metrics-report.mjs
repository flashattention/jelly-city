// 젤리 서울 러너 지표 집계를 파일에서: node tools/sw-metrics-report.mjs <jsonl 폴더> [날짜 수]
//   운영 기록 받기: fly ssh console -C "tar czf - -C /data seoul-walk-metrics" > sw-metrics.tgz
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { buildReport } from '../server/seoul-walk/report.js';
const dir = process.argv[2], days = +process.argv[3] || 3650;
if (!dir) { console.error('쓰는 법: node tools/sw-metrics-report.mjs <jsonl 폴더> [날짜 수]'); process.exit(1); }
const from = new Date(Date.now() + 9 * 3600e3 - (days - 1) * 864e5).toISOString().slice(0, 10);
async function* rows() { for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl') && x.slice(0, 10) >= from).sort()) for await (const l of readline.createInterface({ input: fs.createReadStream(path.join(dir, f)), crlfDelay: Infinity })) { try { yield JSON.parse(l); } catch { /* 깨진 줄 */ } } }
console.log(JSON.stringify(await buildReport(rows(), { days }), null, 2));
