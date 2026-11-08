// 지형 고도: 공개 지형 타일(Terrarium, AWS Open Data · Mapzen/Tilezen, SRTM 등)에서 높이(m)를 읽는다
//   PNG 를 직접 풀어서(의존성 없이) 고도 = R × 256 + G + B / 256 − 32768
//   받은 타일은 .cache/terrain/<z>/<x>/<y>.png 에 기억
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const Z = 14;
const tiles = new Map();
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 아님');
  let o = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len); if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; o += 12 + len; }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`지원 안 하는 PNG (${bd}, ${ct})`);
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? row[i - bpp] : 0, b = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0; let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255; } }
  return { w, h, bpp, px };
}
// 같은 타일을 동시에 여러 번 부르면 한 번만 받는다 (받는 중인 약속을 기억)
function tile(cacheDir, x, y) { const k = `${x}/${y}`; if (!tiles.has(k)) tiles.set(k, tile0(cacheDir, x, y).catch((e) => { tiles.delete(k); throw e; })); return tiles.get(k); }
async function tile0(cacheDir, x, y) {
  const f = path.join(cacheDir, 'terrain', String(Z), String(x), `${y}.png`); let buf;
  if (fs.existsSync(f)) buf = fs.readFileSync(f);
  else { for (let tr = 0; tr < 4 && !buf; tr++) { try { const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, { signal: AbortSignal.timeout(20000) }); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); } catch { await new Promise((res) => setTimeout(res, 2000)); } } if (!buf) throw new Error('지형 타일을 못 받았어요'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); }
  return decodePNG(buf);
}
// 위도 · 경도 → 높이(m), 이웃 네 화소를 섞어서
export async function heightAt(cacheDir, lat, lon) {
  const n = 2 ** Z, fx = ((lon + 180) / 360) * n * 256, fy = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n * 256;
  const h = async (px, py) => { const img = await tile(cacheDir, Math.floor(px / 256), Math.floor(py / 256)), ix = ((px % 256) + 256) % 256, iy = ((py % 256) + 256) % 256, o = iy * img.w * img.bpp + ix * img.bpp; return img.px[o] * 256 + img.px[o + 1] + img.px[o + 2] / 256 - 32768; };
  const x0 = Math.floor(fx - 0.5), y0 = Math.floor(fy - 0.5), tx = fx - 0.5 - x0, ty = fy - 0.5 - y0;
  const [a, b, c, d] = await Promise.all([h(x0, y0), h(x0 + 1, y0), h(x0, y0 + 1), h(x0 + 1, y0 + 1)]);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}
