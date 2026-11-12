// 롯데월드타워 창밖(8-26-10)용 서울 전체 먼 풍경 자료: 서울 칸(public/dream-runner/seoul/t_*.json)에서
//   높이 15m 넘는 건물(돌린 상자: 가운데 · 너비 · 깊이 · 방향 · 높이 · 조명 종류)과 넓은 찻길(폭 12m 넘게, 선분)을 뽑아 작은 이진 파일 하나로
//   결과: public/dream-runner/seoul/skyline.bin.gz (gzip, 브라우저가 DecompressionStream 으로 푼다)
//   형식(리틀 엔디언): Int32 건물 수 nB, Int32 선분 수 nR, 건물 nB × Int16[7] = x(m) z(m) 높이(dm) 너비(dm) 깊이(dm) 방향(0.01°) 조명(0 아파트 · 2 회사 · 3 가게), 선분 nR × Int16[5] = x1 z1 x2 z2(m) 폭(dm)
//   실행: node tools/tower-skyline.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIR = path.resolve('public/dream-runner/seoul');
const B = [], R = [];
for (const f of fs.readdirSync(DIR)) {
  if (!/^t_-?\d+_-?\d+\.json$/.test(f)) continue;
  const M = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), S = M.scale;
  (M.buildings || []).forEach((b, i) => {
    const h = b[0]; if (!(h >= 15)) return;
    const pts = []; for (let k = 7; k + 1 < b.length; k += 2) pts.push([b[k] * S, b[k + 1] * S]); if (pts.length < 3) return;
    // 가장 긴 변 방향으로 돌린 상자
    let best = 0, ang = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], c = pts[(k + 1) % pts.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L > best) { best = L; ang = Math.atan2(c[1] - a[1], c[0] - a[0]); } }
    const ux = Math.cos(ang), uz = Math.sin(ang); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of pts) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, cx = cu * ux - cv * uz, cz = cu * uz + cv * ux;
    const info = M.binfo?.[i], use = info ? info[0] : 0, prof = use === 2 ? 0 : use === 14 || h > 60 ? 2 : use === 1 ? 0 : 3;
    B.push([Math.round(cx), Math.round(cz), Math.round(h * 10), Math.min(32000, Math.round((u1 - u0) * 10)), Math.min(32000, Math.round((v1 - v0) * 10)), Math.round((ang * 18000) / Math.PI), prof]);
  });
  for (const rd of M.roads || []) {
    const w = rd[0]; if (!(w >= 12)) continue;
    let px = null, pz = null; for (let k = 2; k + 1 < rd.length; k += 2) { const x = rd[k] * S, z = rd[k + 1] * S; if (px !== null && Math.hypot(x - px, z - pz) > 1) R.push([Math.round(px), Math.round(pz), Math.round(x), Math.round(z), Math.round(w * 10)]); px = x; pz = z; }
  }
}
const buf = Buffer.alloc(8 + B.length * 14 + R.length * 10); let o = 0;
buf.writeInt32LE(B.length, o); o += 4; buf.writeInt32LE(R.length, o); o += 4;
for (const r of B) for (const v of r) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, v)), o); o += 2; }
for (const r of R) for (const v of r) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, v)), o); o += 2; }
const gz = zlib.gzipSync(buf, { level: 9 }); fs.writeFileSync(path.join(DIR, 'skyline.bin.gz'), gz);
console.log('buildings', B.length, 'road segments', R.length, 'bytes', buf.length, 'gz', gz.length);
