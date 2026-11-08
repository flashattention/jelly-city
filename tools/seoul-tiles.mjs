// 서울 전체 칸(2km) 지도 만들기: 서울 경계(25개 구)에 걸치는 칸을 가운데(종로 · 중구)부터 바깥으로 차례로
//   이미 만든 칸은 건너뛴다(다시 만들려면 파일을 지운다). 칸마다 public/dream-runner/seoul/index.json 을 새로 쓴다
//   쓰는 법: VWORLD_KEY=... node tools/seoul-tiles.mjs [최대 칸 수]
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'public/dream-runner/seoul'), T = 2000;
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dream-runner/hangang/seoul.json'), 'utf8')), U = S.unit || 10;
const rings = S.gu.flatMap((g) => g.rings.map((r) => { const p = []; for (let i = 0; i < r.length; i += 2) p.push([r[i] * U, r[i + 1] * U]); return p; }));
const inRing = (x, z, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const inSeoul = (x, z) => rings.some((r) => inRing(x, z, r));
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const r of rings) for (const [x, z] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
const tiles = [];
for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) for (let j = Math.floor(z0 / T); j <= Math.floor(z1 / T); j++) {
  // 칸 안 5 × 5 점 중 하나라도 서울이면
  let hit = false; for (let a = 0; a <= 4 && !hit; a++) for (let b = 0; b <= 4 && !hit; b++) hit = inSeoul(i * T + (a / 4) * T, j * T + (b / 4) * T);
  if (hit) tiles.push([i, j]);
}
tiles.sort((a, b) => Math.hypot(a[0] + 0.5, a[1] + 1.5) - Math.hypot(b[0] + 0.5, b[1] + 1.5)); // 서울 한가운데(중구 근처)부터
const max = +process.argv[2] || tiles.length, W = +(process.env.WORKERS || 1), K = +(process.env.WORKER || 0); // 여러 개로 나눠 돌릴 때: WORKERS=3 WORKER=0 · 1 · 2
console.log(`서울 칸 ${tiles.length}개 (이번에 최대 ${max})`);
fs.mkdirSync(DIR, { recursive: true });
const writeIndex = () => { const have = fs.readdirSync(DIR).filter((f) => /^t_-?\d+_-?\d+\.json$/.test(f)).map((f) => f.slice(2, -5).split('_').map(Number)); fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ tile: T, frame: S.frame, all: tiles, have })); return have.length; };
let done = 0;
for (const [n0, [i, j]] of tiles.slice(0, max).entries()) { if (n0 % W !== K) continue;
  const f = path.join(DIR, `t_${i}_${j}.json`); if (fs.existsSync(f)) continue;
  const t0 = Date.now(), r = spawnSync('node', [path.join(ROOT, 'tools/hangang-map.mjs'), 'tile', String(i), String(j)], { env: { ...process.env, OVERPASS_START: String(K) }, encoding: 'utf8', timeout: 1800000 });
  const ok = fs.existsSync(f); done++; const n = writeIndex();
  console.log(`${ok ? '✓' : '✗'} t_${i}_${j} ${((Date.now() - t0) / 1000).toFixed(0)}초 · 다 만든 칸 ${n}/${tiles.length}${ok ? '' : ' · ' + (r.stderr || '').split('\n').filter(Boolean).slice(-2).join(' ')}`);
}
writeIndex();
