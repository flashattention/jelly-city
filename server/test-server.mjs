// 시험용: 임시 데이터 폴더로 진짜 서버를 하나 띄운다 (운영 서버는 절대 부르지 않는다)
//   const s = await startServer(); ... await s.stop();
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function startServer(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jelly-sec-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), DATA_DIR: dir, SEOUL_MOCK: '1', NODE_ENV: 'test', ADMIN_EMAILS: 'admin@dev.local', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/healthz')).ok) break; } catch { /* 아직 */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return {
    base, port, dir, child, log: () => log,
    async stop() { child.kill('SIGKILL'); await new Promise((r) => child.once('exit', r)); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
// 개발용 이름 로그인 (구글 키가 없는 시험 서버에서만 된다)
export async function devLogin(base, name, headers = {}) {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ dev: name }) });
  return (await r.json()).session;
}
export const post = (base, p, body, sid, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(sid ? { Authorization: `Bearer ${sid}` } : {}), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
