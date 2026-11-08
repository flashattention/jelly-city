// 서울 전체 지형 높이 격자 하나 (50m 간격): 공개 지형 타일(Terrarium)에서 읽고, 건물 때문에 생긴 좁은 혹을 걷어낸다
//   지형 자료는 땅 + 건물 높이가 섞여 있어(여의도 평지가 9 ~ 40m로 들쭉날쭉) 그대로 쓰면 빌딩 밑에 가짜 언덕이 생긴다
//   1) 열기(opening: 최솟값 → 최댓값, 반지름 150m) 로 좁은 혹을 깎고(평지만, 산은 원래 높이)  2) 부드럽게(3 × 3 평균 두 번)
//   기준 높이(BASE, 한강 둔치 정도)를 빼고 0 아래는 0 → 게임 속 높이 y
//   결과: public/dream-runner/seoul/terrain.bin.gz (줄마다 앞 칸과의 차이, Int16 데시미터 → gzip, 브라우저 DecompressionStream 으로 푼다) + terrain.json
//   쓰는 법: node tools/seoul-terrain.mjs
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { heightAt } from './terrain.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'public/dream-runner/seoul');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574, T = 2000, STEP = 50, BASE = 8;
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dream-runner/hangang/seoul.json'), 'utf8')), U = S.unit || 10;
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (const g of S.gu) for (const r of g.rings) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i] * U); x1 = Math.max(x1, r[i] * U); z0 = Math.min(z0, r[i + 1] * U); z1 = Math.max(z1, r[i + 1] * U); }
// 칸(2km) 경계에 맞춰 한 칸씩 여유
x0 = (Math.floor(x0 / T) - 1) * T; z0 = (Math.floor(z0 / T) - 1) * T; x1 = (Math.ceil(x1 / T) + 1) * T; z1 = (Math.ceil(z1 / T) + 1) * T;
const nx = (x1 - x0) / STEP + 1, nz = (z1 - z0) / STEP + 1;
console.log(`격자 ${nx} × ${nz} (${((x1 - x0) / 1000).toFixed(0)} × ${((z1 - z0) / 1000).toFixed(0)}km)`);
let h = new Float32Array(nx * nz);
for (let j = 0; j < nz; j++) {
  const row = await Promise.all(Array.from({ length: nx }, (_, i) => heightAt(path.join(ROOT, '.cache'), LAT0 - (z0 + j * STEP) / KZ, LON0 + (x0 + i * STEP) / KX)));
  h.set(row, j * nx); if (j % 40 === 0) console.log(`  ${j}/${nz}`);
}
const win = (src, r, f) => { const out = new Float32Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { let v = f === 'min' ? Infinity : f === 'max' ? -Infinity : 0, n = 0; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const ii = Math.min(nx - 1, Math.max(0, i + a)), jj = Math.min(nz - 1, Math.max(0, j + b)), s = src[jj * nx + ii]; if (f === 'min') v = Math.min(v, s); else if (f === 'max') v = Math.max(v, s); else { v += s; n++; } } out[j * nx + i] = f === 'avg' ? v / n : v; } return out; };
// 산은 꼭대기가 좁아서 열기를 하면 깎인다(남산 254m → 174m). 그래서 열기 결과가 높은 곳(산)일수록 원래 높이를 쓴다
//   낮은 평지(기준 + 25m 아래): 열기 결과 · 기준 + 65m 위: 원래(살짝 부드럽게) · 그 사이는 섞는다
const op = win(win(h, 3, 'min'), 3, 'max'), soft = win(h, 1, 'avg');
for (let k = 0; k < h.length; k++) { const w = Math.min(1, Math.max(0, (op[k] - BASE - 25) / 40)); h[k] = op[k] * (1 - w) + Math.max(op[k], soft[k]) * w; }
h = win(win(h, 1, 'avg'), 1, 'avg');
const out = new Uint16Array(nx * nz); let mx = 0;
for (let k = 0; k < out.length; k++) { out[k] = Math.max(0, Math.round((h[k] - BASE) * 10)); mx = Math.max(mx, out[k]); }
fs.mkdirSync(DIR, { recursive: true });
const dl = new Int16Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; dl[k] = out[k] - (i ? out[k - 1] : j ? out[k - nx] : 0); }
fs.writeFileSync(path.join(DIR, 'terrain.bin.gz'), zlib.gzipSync(Buffer.from(dl.buffer), { level: 9 })); try { fs.unlinkSync(path.join(DIR, 'terrain.bin')); } catch {}
fs.writeFileSync(path.join(DIR, 'terrain.json'), JSON.stringify({ x0, z0, step: STEP, nx, nz, base: BASE, unit: 0.1, enc: 'delta-i16-gz', source: 'Terrarium elevation tiles (AWS Open Data · Mapzen/Tilezen, SRTM 등)' }));
console.log(`terrain.bin.gz ${(fs.statSync(path.join(DIR, 'terrain.bin.gz')).size / 1024).toFixed(0)}KB · 가장 높은 곳 ${(mx / 10).toFixed(0)}m (기준 ${BASE}m 뺌)`);
