// 로컬 시험용 흉내 자료 (SEOUL_MOCK=1 일 때만): 키 없이 실제 API 와 같은 꼴로 답한다. 운영에선 쓰지 않는다
//   버스: 서울 칸 지도(public/dream-runner/seoul/t_*.json)의 넓은 찻길을 노선으로 삼아, 버스가 시간에 따라 길을 따라 달리고 정류장에서 선다 (GPS 는 몇 m 흔들림)
//   지하철: subway.json 의 운행 순서대로 6분 간격 열차가 달리며, 역마다 전역출발(3) · 진입(0) · 도착(1) · 출발(2) 을 알린다
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), SEOUL = path.join(ROOT, 'public/dream-runner/seoul');
const LAT0 = 37.53, LON0 = 126.98, KX = 111320 * Math.cos((LAT0 * Math.PI) / 180), KZ = 110574;
const XY = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ], LL = (x, z) => [LAT0 - z / KZ, LON0 + x / KX];
const ok = (obj) => ({ ok: true, status: 200, text: async () => JSON.stringify(obj), json: async () => obj });
const busOk = (list) => ok({ msgHeader: { headerCd: '0', headerMsg: '정상적으로 처리되었습니다.', itemCount: list.length }, msgBody: { itemList: list } });
export const mockCalls = { n: 0 };

// ---------- 버스 ----------
const tiles = new Map();
function tile(i, j) {
  const k = `${i}_${j}`; if (tiles.has(k)) return tiles.get(k); let routes = [];
  try { const M = JSON.parse(fs.readFileSync(path.join(SEOUL, `t_${k}.json`), 'utf8')), S = M.scale;
    M.roads.forEach((rd, n) => { if (rd[1] || rd[0] < 14 || rd[0] >= 18) return; const pts = []; for (let q = 2; q < rd.length; q += 2) pts.push([rd[q] * S, rd[q + 1] * S]); const cum = [0]; for (let q = 1; q < pts.length; q++) cum.push(cum[q - 1] + Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1])); if (cum[cum.length - 1] > 350) routes.push({ id: `9${String(i + 50).padStart(3, '0')}${String(j + 50).padStart(3, '0')}${String(n).padStart(3, '0')}`, no: String(100 + ((Math.abs(i * 31 + j * 17 + n * 7)) % 900)), type: [3, 4, 3, 4, 6, 2, 5][n % 7], pts, cum, len: cum[cum.length - 1], name: M.roadNames?.[n] || '' }); }); } catch { routes = []; }
  tiles.set(k, routes); return routes;
}
const routeById = (id) => { const i = +id.slice(1, 4) - 50, j = +id.slice(4, 7) - 50; return tile(i, j).find((r) => r.id === id); };
function along(r, d) { let q = 1; while (q < r.cum.length - 1 && r.cum[q] < d) q++; const a = r.pts[q - 1], b = r.pts[q], L = r.cum[q] - r.cum[q - 1] || 1, t = (d - r.cum[q - 1]) / L; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L }; }
// 버스 하나의 자리: 정류장 간격 300m, 8m/s 로 달리고 20초 선다. 끝에 닿으면 반대 방향으로
function busAt(r, k, now) {
  const SEG = 300, V = 8, DW = 20, legT = SEG / V + DW, nSeg = Math.max(1, Math.ceil(r.len / SEG)), cycle = nSeg * legT * 2, t = ((now / 1000 + k * 97.3) % cycle + cycle) % cycle;
  const leg = Math.floor(t / legT), u = t - leg * legT, back = leg >= nSeg, li = back ? leg - nSeg : leg, run = Math.min(1, u / (SEG / V)), stop = u >= SEG / V;
  let d = Math.min(r.len, (li + run) * SEG); if (back) d = r.len - d; const p = along(r, d), sgn = back ? -1 : 1;
  return { x: p.x - p.dz * 3 * sgn, z: p.z + p.dx * 3 * sgn, stop };
}
function stationsNear(lat, lon, radius) {
  const [x, z] = XY(lat, lon), out = []; const ti = Math.floor(x / 2000), tj = Math.floor(z / 2000);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const r of tile(ti + a, tj + b)) for (let d = 0; d < r.len; d += 300) { const p = along(r, d); if (Math.hypot(p.x - x, p.z - z) < radius) { const [la, lo] = LL(p.x, p.z); out.push({ arsId: `${r.id}-${d}`, stationId: `${r.id}${d}`, stationNm: `${r.name || '정류장'} ${d / 300 + 1}`, gpsX: String(lo), gpsY: String(la), dist: String(Math.round(Math.hypot(p.x - x, p.z - z))) }); } }
  return out;
}
const jit = (s) => { const v = Math.sin(s * 12.9898) * 43758.5453; return (v - Math.floor(v) - 0.5) * 8; };

// ---------- 지하철 ----------
let SUB = null; const subway = () => (SUB ||= JSON.parse(fs.readFileSync(path.join(SEOUL, 'subway.json'), 'utf8')));
function edgeLen(L, a, b) { const e = L.edges[`${a}|${b}`] || L.edges[`${b}|${a}`]; if (!e) return 0; let s = 0; for (let i = 3; i < e.length; i += 3) s += Math.hypot(e[i] - e[i - 3], e[i + 1] - e[i - 2]); return s; }
function trainsOf(line, now) {
  const L = subway().lines[line]; if (!L) return []; const out = []; const t0 = now / 1000;
  // 방향마다 가장 긴 운행 순서 하나씩 (2호선 같은 순환은 내선 · 외선)
  const seqs = [...L.seqs].sort((a, b) => b.s.length - a.s.length).filter((q, i, arr) => arr.findIndex((p) => p.s[0] === q.s[q.s.length - 1] && p.s[p.s.length - 1] === q.s[0]) !== -1 || q.loop || i < 2).slice(0, 2);
  seqs.forEach((q, si) => {
    const legs = []; for (let i = 1; i < q.s.length; i++) { const len = edgeLen(L, q.s[i - 1], q.s[i]); legs.push({ a: q.s[i - 1], b: q.s[i], run: Math.max(40, len / 13), len }); }
    const total = legs.reduce((s, l) => s + l.run + 30, 0); if (!total) return; const head = 360;
    for (let k = 0; k * head < total; k++) {
      let t = ((t0 + k * head + si * 111) % total + total) % total, li = 0; while (li < legs.length - 1 && t > legs[li].run + 30) { t -= legs[li].run + 30; li++; }
      const g = legs[li], f = t / g.run, name = (n) => L.st[n]?.[0] || n;
      const [at, s] = t >= g.run ? [g.b, 1] : f < 0.2 ? [g.a, 2] : f < 0.8 ? [g.b, 3] : [g.b, 0];
      out.push({ subwayNm: line, statnNm: name(at), trainNo: String(1000 + si * 500 + k), updnLine: q.loop ? (q.loop === 'in' ? '0' : '1') : String(si), statnTnm: name(q.s[q.s.length - 1]), trainSttus: String(s), directAt: '0', lstcarAt: '0', recptnDt: new Date(now).toISOString() });
    }
  });
  return out;
}

export async function mockFetch(url) {
  mockCalls.n++; const u = new URL(url), now = Date.now();
  if (u.hostname === 'ws.bus.go.kr') {
    const q = u.searchParams;
    if (u.pathname.endsWith('getStationByPos')) return busOk(stationsNear(+q.get('tmY'), +q.get('tmX'), +q.get('radius') || 500));
    if (u.pathname.endsWith('getRouteByStation')) { const r = routeById(q.get('arsId').split('-')[0]); return busOk(r ? [{ busRouteId: r.id, busRouteNm: r.no, busRouteAbrv: r.no, busRouteType: String(r.type) }] : []); }
    if (u.pathname.endsWith('getStaionByRoute')) { const r = routeById(q.get('busRouteId') || ''); if (!r) return busOk([]); const list = []; let n = 0; for (let d = 0; d < r.len; d += 300) { const p = along(r, d), [la, lo] = LL(p.x, p.z); list.push({ seq: String(++n), stationNm: `${r.name || '정류장'} ${n}`, gpsX: String(lo), gpsY: String(la), direction: '종점', transYn: 'N' }); } return busOk(list); }
    if (u.pathname.endsWith('getBusPosByRtid')) { const r = routeById(q.get('busRouteId') || ''); if (!r) return busOk([]); const n = Math.max(1, Math.round(r.len / 500)), list = [];
      for (let k = 0; k < n; k++) { const b = busAt(r, k, now), [la, lo] = LL(b.x + jit(k + now / 1e5), b.z + jit(k * 3 + 1 + now / 1e5)); list.push({ vehId: `${r.id}${k}`, plainNo: `서울74사${String(1000 + k * 37).slice(-4)}`, gpsX: String(lo), gpsY: String(la), stopFlag: b.stop ? '1' : '0', busType: k % 2 ? '1' : '0', dataTm: new Date(now).toISOString().replace(/\D/g, '').slice(0, 14) }); }
      return busOk(list); }
    return busOk([]);
  }
  if (/swopenapi/i.test(u.hostname)) {
    const parts = decodeURIComponent(u.pathname).split('/'), api = parts[5], arg = parts[parts.length - 1];
    if (api === 'realtimePosition') return ok({ errorMessage: { code: 'INFO-000' }, realtimePositionList: trainsOf(arg, now) });
    return ok({ errorMessage: { code: 'INFO-000' }, realtimeArrivalList: [] });
  }
  return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
}
