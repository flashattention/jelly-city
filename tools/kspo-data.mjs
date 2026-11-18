// 한국체육산업개발 공공데이터(CSV) → 젤리 서울 러너 올림픽공원 자료 public/dream-runner/hangang/kspo/data.json
//   node tools/kspo-data.mjs   (받은 CSV 는 .cache/kspo/, 공공데이터포털에서 받음 · 커밋하지 않음)
//   - 15149169 영문 공연정보: 공연 제목 · 날짜 · 예매 주소 · 포스터
//   - 15143220 잔디시설정보: 장소 · 개방 기간
//   - 15164156 주차장 혼잡도: 주차구역 · 혼잡도(원활 · 혼잡 · 만차) · 등록 일시 → 구역 · 요일 · 시간대별 혼잡 비율
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), C = path.join(ROOT, '.cache/kspo');
const dec = new TextDecoder('euc-kr');
const csv = (f) => {
  const t = dec.decode(fs.readFileSync(path.join(C, f))), rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((v) => v !== '')) rows.push(row); row = []; } else cur += ch; }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [h, ...rest] = rows; return rest.map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] || '').trim()])));
};

// 공연: 날짜순, 같은 제목 · 날짜는 하나로
const shows = [], seen = new Set();
for (const r of csv('15149169.csv')) { const d = r['공연일자'], t = r['공연제목'].replace(/[＂"]/g, '"'); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || seen.has(t + d)) continue; seen.add(t + d); shows.push({ d, t, url: r['상세주소'], img: r['공연이미지'] }); }
shows.sort((a, b) => a.d.localeCompare(b.d));

// 잔디: 같은 장소는 하나로, 개방 기간 'MM-DD ~ MM-DD' 또는 상시
const lawns = []; for (const r of csv('15143220.csv')) { const n = r['장소']; if (lawns.some((l) => l.n === n)) continue; const m = r['개방내용'].match(/(\d{2}-\d{2})\s*~\s*(\d{2}-\d{2})/); lawns.push({ n, open: m ? [m[1], m[2]] : 'all', url: r['링크'] }); }

// 주차 혼잡도: 구역마다 요일(0 일 ~ 6 토) × 시간(0 ~ 23) 혼잡 점수(원활 0 · 혼잡 1 · 만차 2) 평균
const LV = { 원활: 0, 혼잡: 1, 만차: 2 }, zones = {};
for (const r of csv('15164156.csv')) { const z = r['주차구역'], lv = LV[r['혼잡도']], d = r['등록일'], t = r['등록시간']; if (!z || lv == null || !d) continue;
  const dt = new Date(`${d}T${t || '12:00:00'}+09:00`), w = (dt.getUTCDay() + (dt.getUTCHours() + 9 >= 24 ? 1 : 0)) % 7, h = (dt.getUTCHours() + 9) % 24;
  const Z = (zones[z] ||= { n: 0, sum: 0, wh: {} }); Z.n++; Z.sum += lv; const k = `${w}-${h}`; (Z.wh[k] ||= [0, 0]); Z.wh[k][0] += lv; Z.wh[k][1]++; }
const parking = Object.fromEntries(Object.entries(zones).sort().map(([z, Z]) => [z, { n: Z.n, avg: +(Z.sum / Z.n).toFixed(2), wh: Object.fromEntries(Object.entries(Z.wh).map(([k, [s, n]]) => [k, +(s / n).toFixed(2)])) }]));

const out = { src: { shows: '한국체육산업개발 영문 공연정보(15149169)', lawns: '한국체육산업개발 잔디시설정보(15143220)', parking: '한국체육산업개발 주차장 혼잡도 정보(15164156)', venues: '한국체육산업개발 올림픽공원 공연장 실감형 콘텐츠(15127487)', live: '한국체육산업개발 실시간 주차현황(15168686)' }, shows, lawns, parking };
fs.writeFileSync(path.join(ROOT, 'public/dream-runner/hangang/kspo/data.json'), JSON.stringify(out));
console.log(`공연 ${shows.length}건 (${shows[0]?.d} ~ ${shows.at(-1)?.d}) · 잔디 ${lawns.length}곳 · 주차구역 ${Object.keys(parking).length}곳`);
