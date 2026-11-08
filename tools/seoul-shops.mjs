// 서울 모든 가게: 소상공인시장진흥공단 상가(상권)정보 API(공공데이터포털)로 칸(2km + 150m 여유)마다 '사각형 안 상가'를 받아 캐시
//   .cache/shops/t_i_j.json = [[상호, 소분류, 중분류, 대분류, 층, 경도, 위도, 건물명], ...]  (이미 있는 칸은 건너뜀)
//   키는 저장소에 넣지 않는다: DATA_GO_KR_KEY=... node tools/seoul-shops.mjs   (키는 공공데이터포털이 준 그대로 · 인코딩된 것)
//   지도 도구(hangang-map.mjs tile)가 이 캐시가 있으면 가게를 여기서 쓴다
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, '.cache/shops'), KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) { console.error('DATA_GO_KR_KEY 가 없어요'); process.exit(1); }
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574, T = 2000, M = 150;
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/dream-runner/seoul/index.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(box, n) {
  const url = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRectangle?serviceKey=${KEY}&pageNo=${n}&numOfRows=1000&minx=${box[0]}&miny=${box[1]}&maxx=${box[2]}&maxy=${box[3]}&type=json`;
  for (let tr = 0; tr < 6; tr++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(40000) }); const t = await r.text(); const j = JSON.parse(t); if (j.header?.resultCode === '03') return { total: 0, items: [] }; if (j.header?.resultCode !== '00') throw new Error(j.header?.resultMsg || t.slice(0, 120)); return { total: j.body.totalCount, items: j.body.items || [] }; }
    catch (e) { if (tr === 5) throw e; await sleep(3000 * (tr + 1)); }
  }
}
let done = 0; const tiles = idx.all.filter(([i, j]) => !fs.existsSync(path.join(OUT, `t_${i}_${j}.json`)));
console.log(`칸 ${tiles.length}개 받기`);
async function worker() {
  while (tiles.length) {
    const [i, j] = tiles.shift(), x0 = i * T - M, x1 = (i + 1) * T + M, z0 = j * T - M, z1 = (j + 1) * T + M;
    const box = [(LON0 + x0 / KX).toFixed(6), (LAT0 - z1 / KZ).toFixed(6), (LON0 + x1 / KX).toFixed(6), (LAT0 - z0 / KZ).toFixed(6)];
    try {
      const first = await page(box, 1), all = [...first.items], pages = Math.ceil(first.total / 1000);
      for (let n = 2; n <= pages; n++) all.push(...(await page(box, n)).items);
      const rows = all.map((s) => [s.bizesNm, s.indsSclsNm, s.indsMclsNm, s.indsLclsNm, s.flrNo || '', +(+s.lon).toFixed(7), +(+s.lat).toFixed(7), s.bldNm || '']);
      fs.writeFileSync(path.join(OUT, `t_${i}_${j}.json`), JSON.stringify(rows)); done++;
      console.log(`✓ t_${i}_${j} ${rows.length}곳 (${pages}쪽) · ${done}칸`);
    } catch (e) { console.log(`✗ t_${i}_${j} ${e.message}`); }
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log('끝');
