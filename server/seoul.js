// 서울 실시간 교통 · 도시 정보: 키는 서버 환경 변수에만 두고, 서버가 불러 기억했다가 모든 접속자에게 나눠 준다
//   지하철 (서울 열린데이터광장 swopenAPI, 키 SEOUL_SUBWAY_KEY)
//     /api/seoul/subway/arrival?station=여의나루        → 그 역에 들어오는 열차 (도착까지 · 방면)
//     /api/seoul/subway/position?line=1호선            → 그 노선 열차들이 지금 어느 역에 있는지
//     /api/seoul/subway/positions?lines=2호선,5호선     → 여러 노선을 한 번에 (노선마다 20초 기억)
//   버스 (공공데이터포털 서울 버스 정보, 키 SEOUL_BUS_KEY · 인코딩된 그대로)
//     /api/seoul/bus/near?lat=&lon=&c=접속아이디        → 곰 둘레 1.6km 안 실제 버스 (서울 어디든)
//       1km 칸마다 정류소(getStationByPos) → 그 정류소를 지나는 노선(getRouteByStation) → 노선별 버스 위치(getBusPosByRtid)
//       칸 · 노선 목록은 2일 기억(DATA_DIR/seoul-bus.json 에 적어 다시 켜도 남는다), 위치는 노선마다 100초 기억
//       사람이 있는 칸(최근 2분 30초)의 노선만, 사람이 많은 곳 · 오래된 것부터 새로 받는다
//     /api/seoul/bus/pos                               → 예전 방식(여의도 노선 15개), 예전 화면을 위해 남겨 둔다
//   하루 호출 예산 (한국 시각 자정에 새로): 환경 변수로 바꿀 수 있다
//     SEOUL_BUS_POS_DAILY(9000) · SEOUL_BUS_STATION_DAILY(600) · SEOUL_BUS_ROUTE_DAILY(1200) · SEOUL_SUBWAY_DAILY(40000)
//     시간마다 남은 예산을 고르게 나눠 쓰고, 한도 초과 · 키 미등록 응답이 오면 그 기능만 자정까지 쉬며 마지막 값을 준다
//   /api/seoul/transit/status → 오늘 호출 수 · 예산 · 쉬는 기능 · 마지막 오류 (키는 안 보인다)
//   도시 데이터 (키 SEOUL_CITY_KEY): /api/seoul/city?area=여의도 (5분 기억)
//   로컬 시험: SEOUL_MOCK=1 이면 키 없이 흉내 자료(server/seoul-mock.js)로 돈다 (운영에선 쓰지 않는다)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MOCK = process.env.SEOUL_MOCK === '1';
const KEY = process.env.SEOUL_SUBWAY_KEY || (MOCK ? 'mock' : '');
const BUS_KEY = process.env.SEOUL_BUS_KEY || (MOCK ? 'mock' : '');
const CITY_KEY = process.env.SEOUL_CITY_KEY || '';
const F = MOCK ? (await import('./seoul-mock.js')).mockFetch : fetch;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = path.join(process.env.DATA_DIR || path.join(ROOT, 'data'), 'seoul-bus.json');
// 정류소 기능이 안 될 때 쓰는 여의도 노선 (노선정보조회로 찾은 아이디 · 3 간선 파랑 · 4 지선 초록)
const BUS_ROUTES = [['100100043', '261', 3], ['100100044', '262', 3], ['100100057', '360', 3], ['100100071', '461', 3], ['100100605', '463', 3], ['100100078', '503', 3], ['100100085', '600', 3], ['100100550', '662', 3], ['100100118', '753', 3], ['100100034', '162', 3], ['100100033', '160', 3], ['100100272', '5615', 4], ['100100275', '5618', 4], ['100100301', '6623', 4], ['100100347', '7613', 4]];
const CITY_AREAS = ['여의도', '여의도한강공원', '홍대 관광특구', '남산공원', '이태원 관광특구', '반포한강공원', '뚝섬한강공원', '성수카페거리', '강남역', '잠실 관광특구', '명동 관광특구', '인사동', '북촌한옥마을', '신촌·이대역'];
const LINE_OF = { 1001: '1호선', 1002: '2호선', 1003: '3호선', 1004: '4호선', 1005: '5호선', 1006: '6호선', 1007: '7호선', 1008: '8호선', 1009: '9호선', 1063: '경의중앙선', 1065: '공항철도', 1067: '경춘선', 1075: '수인분당선', 1077: '신분당선', 1092: '우이신설선', 1093: '서해선', 1094: '신림선', 1032: 'GTX-A' };
const LINE_RE = /^(\d호선|경의중앙선|공항철도|경춘선|수인분당선|신분당선|우이신설선|서해선|신림선|GTX-A)$/;

// ---------- 하루 예산 ----------
const LIMIT = { pos: +process.env.SEOUL_BUS_POS_DAILY || 9000, station: +process.env.SEOUL_BUS_STATION_DAILY || 600, route: +process.env.SEOUL_BUS_ROUTE_DAILY || 1200, subway: +process.env.SEOUL_SUBWAY_DAILY || 40000 };
const kst = () => new Date(Date.now() + 9 * 3600e3), dayKey = () => kst().toISOString().slice(0, 10);
let st = { day: dayKey(), used: {}, hour: -1, usedH: {}, off: {}, cells: {}, stops: {} }; const lastErr = {};
try { const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); st = { ...st, ...s, cells: s.cells || {}, stops: s.stops || {} }; } catch { /* 처음 */ }
let dirty = false; setInterval(() => { if (!dirty) return; dirty = false; try { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(st)); } catch { /* 다음에 */ } }, 60000).unref();
function roll() { const d = dayKey(), h = kst().getUTCHours(); if (st.day !== d) { st.day = d; st.used = {}; st.off = {}; dirty = true; } if (st.hour !== h) { st.hour = h; st.usedH = {}; } return h; }
// 부를 수 있나: 오늘 예산 안 · 이번 시간 몫(남은 예산 ÷ 남은 시간 × 2.5) 안 · 쉬는 중이 아님
function canCall(op) {
  const h = roll(), used = st.used[op] || 0, left = LIMIT[op] - used; if (st.off[op] === 'key' && Date.now() - (st.offAt?.[op] || 0) > 3600e3) { delete st.off[op]; dirty = true; } if (st.off[op] || left <= 0) return false;
  return (st.usedH[op] || 0) < Math.max(12, (left / (24 - h)) * 2.5);
}
function spend(op) { st.used[op] = (st.used[op] || 0) + 1; st.usedH[op] = (st.usedH[op] || 0) + 1; dirty = true; }
// 버스 API 부르기: 한도 초과 · 키 미등록이면 그 기능을 오늘 쉰다
async function busCall(op, api, q) {
  spend(op);
  const r = await F(`http://ws.bus.go.kr/api/rest/${api}?serviceKey=${BUS_KEY}&${q}&resultType=json`, { signal: AbortSignal.timeout(7000) }), t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* XML 오류 */ }
  const head = j?.msgHeader || j?.comMsgHeader || {}, msg = String(head.headerMsg || head.errMsg || (j ? `cd=${head.headerCd ?? '?'} ${t.slice(0, 160)}` : t.slice(0, 300)));
  if (j && (head.headerCd === '0' || head.headerCd === '4' || head.headerCd === 4 || head.headerCd === 0)) { delete lastErr[op]; return j.msgBody?.itemList || []; }
  if (/LIMITED|초과/i.test(msg)) st.off[op] = 'limit'; else if (/KEY|등록|DENIED|인증|권한/i.test(msg)) { st.off[op] = 'key'; (st.offAt ||= {})[op] = Date.now(); }
  lastErr[op] = { at: Date.now(), msg: msg.replace(/serviceKey=[^&\s]+/g, '').slice(0, 120) }; dirty = true;
  throw new Error('버스 정보 오류');
}

// ---------- 버스: 칸 → 노선 ----------
const CLAT = 0.009, CLON = 0.0113, CELL_TTL = 2 * 86400e3, POS_TTL = 100e3, NEAR = 1600;
const cellOf = (lat, lon) => `${Math.floor(lat / CLAT)}_${Math.floor(lon / CLON)}`;
const cellC = (k) => { const [i, j] = k.split('_').map(Number); return [(i + 0.5) * CLAT, (j + 0.5) * CLON]; };
const meters = (la1, lo1, la2, lo2) => Math.hypot((lo2 - lo1) * 88200, (la2 - la1) * 110574);
const cellWork = new Map();
function cellRoutes(k) {
  const c = st.cells[k]; if (c && Date.now() - c.at < (c.fb ? 3600e3 : CELL_TTL)) return Promise.resolve(c.routes);
  if (cellWork.has(k)) return cellWork.get(k);
  const p = (async () => {
    const [lat, lon] = cellC(k); let routes = null;
    if (canCall('station')) try {
      const sts = (await busCall('station', 'stationinfo/getStationByPos', `tmX=${lon.toFixed(6)}&tmY=${lat.toFixed(6)}&radius=750`)).filter((s) => s.arsId && s.arsId !== '0').map((s) => ({ ars: s.arsId, lat: +s.gpsY, lon: +s.gpsX }));
      // 정류소 8곳을 고르게 (가운데에서 가까운 곳부터, 이미 고른 곳과 먼 곳)
      const pick = []; const rest = sts.sort((a, b) => meters(lat, lon, a.lat, a.lon) - meters(lat, lon, b.lat, b.lon));
      while (pick.length < 8 && rest.length) { let bi = 0, bd = -1; if (pick.length) rest.forEach((s, i) => { const d = Math.min(...pick.map((q) => meters(q.lat, q.lon, s.lat, s.lon))); if (d > bd) { bd = d; bi = i; } }); pick.push(rest.splice(bi, 1)[0]); }
      const cnt = new Map();
      for (const s of pick) { if (!canCall('route')) break; try { for (const r of await busCall('route', 'stationinfo/getRouteByStation', `arsId=${s.ars}`)) { const ty = +r.busRouteType; if (!r.busRouteId || ty === 9) continue; const o = cnt.get(r.busRouteId) || [String(r.busRouteId).replace(/\D/g, '').slice(0, 12), xs(r.busRouteAbrv || r.busRouteNm, 10), ty, 0]; o[3]++; cnt.set(r.busRouteId, o); } } catch { break; } }
      if (cnt.size) routes = [...cnt.values()].sort((a, b) => b[3] - a[3]).slice(0, 24);
      else if (!sts.length) routes = [];
    } catch { /* 아래에서 여의도 노선으로 */ }
    if (routes) st.cells[k] = { at: Date.now(), routes };
    else st.cells[k] = { at: Date.now(), fb: 1, routes: BUS_ROUTES.map(([id, no, ty]) => [id, no, ty, 1]) };
    dirty = true; const keys = Object.keys(st.cells); if (keys.length > 3000) for (const q of keys.sort((a, b) => st.cells[a].at - st.cells[b].at).slice(0, 500)) delete st.cells[q];
    return st.cells[k].routes;
  })().finally(() => cellWork.delete(k));
  cellWork.set(k, p); return p;
}
// ---------- 버스: 노선별 위치 ----------
const pos = new Map(), routeInfo = new Map(), interest = new Map();
async function fetchRoute(id) {
  let info = routeInfo.get(id);
  if (!info) for (const c of Object.values(st.cells)) { const r = c.routes?.find((q) => q[0] === id); if (r) { info = [r[1], r[2]]; routeInfo.set(id, info); break; } }
  info ||= ['?', 3];
  // 지난번 자리(5m 넘게 움직였을 때)를 함께 줘서, 처음 보는 화면도 버스 방향을 안다
  const prev = new Map((pos.get(id)?.list || []).map((b) => [b.id, b]));
  const list = (await busCall('pos', 'buspos/getBusPosByRtid', `busRouteId=${id}`)).filter((b) => +b.gpsY > 30).map((b) => { const o = { id: xs(b.vehId, 16), rid: id, route: xs(info[0], 10), type: +info[1] || 3, lon: +b.gpsX, lat: +b.gpsY, t: xs(b.dataTm, 20), stop: b.stopFlag === '1', plate: xs(b.plainNo, 20).slice(-4), low: b.busType === '1' }, p = prev.get(o.id); if (p) { if (meters(p.lat, p.lon, o.lat, o.lon) > 5) { o.plat = p.lat; o.plon = p.lon; } else if (p.plat) { o.plat = p.plat; o.plon = p.plon; } } return o; });
  pos.set(id, { at: Date.now(), list });
}
// 사람이 있는 칸의 노선마다 무게 (칸마다 많이 지나는 노선 12개)
function priorities() {
  const now = Date.now(), pri = new Map();
  for (const [k, who] of interest) { for (const [c, t] of who) if (now - t > 150e3) who.delete(c); if (!who.size) { interest.delete(k); continue; } const routes = st.cells[k]?.routes || []; routes.slice(0, 12).forEach(([id], i) => pri.set(id, (pri.get(id) || 0) + who.size * (1 + (12 - i) / 12))); }
  return pri;
}
let refreshing = null;
function refresh(maxN) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const pri = priorities(), now = Date.now(), want = [...pri].map(([id, w]) => [id, w * Math.min(6, (now - (pos.get(id)?.at || 0)) / POS_TTL)]).filter(([id]) => now - (pos.get(id)?.at || 0) > POS_TTL).sort((a, b) => b[1] - a[1]).slice(0, maxN);
    const go = []; for (const [id] of want) { if (!canCall('pos')) break; go.push(fetchRoute(id).catch(() => { /* 다음에 */ })); }
    await Promise.all(go);
  })().finally(() => { refreshing = null; });
  return refreshing;
}
// 접속자가 있으면 15초마다 조금씩
setInterval(() => { if (interest.size && BUS_KEY) refresh(5); }, 15000).unref();
async function busNear(lat, lon, cid) {
  const now = Date.now(), ks = new Set([cellOf(lat, lon)]);
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const k = cellOf(lat + a * CLAT, lon + b * CLON), [cl, co] = cellC(k); if (meters(lat, lon, cl, co) < 1000) ks.add(k); }
  const mine = cellOf(lat, lon);
  for (const k of ks) { if (!interest.has(k)) interest.set(k, new Map()); interest.get(k).set(cid, now); }
  // 내 칸 노선은 기다렸다가, 이웃 칸은 뒤에서
  try { await Promise.race([cellRoutes(mine), new Promise((ok) => setTimeout(ok, 6000))]); } catch { /* 없음 */ }
  for (const k of ks) if (k !== mine) cellRoutes(k).catch(() => {});
  for (const k of ks) for (const [id, no, ty] of st.cells[k]?.routes || []) routeInfo.set(id, [no, ty]);
  await Promise.race([refresh(4), new Promise((ok) => setTimeout(ok, 6000))]);
  const out = [], seen = new Set(); let oldest = now, routes = 0, fb = false;
  for (const k of ks) { const c = st.cells[k]; if (c?.fb) fb = true; for (const [id] of c?.routes || []) { if (seen.has(id)) continue; seen.add(id); const p = pos.get(id); if (!p) continue; routes++; oldest = Math.min(oldest, p.at); for (const b of p.list) if (meters(lat, lon, b.lat, b.lon) < NEAR) out.push({ ...b, age: Math.round((now - p.at) / 1000) }); } }
  return { buses: out, routes, src: fb ? 'fallback' : 'live', oldest: Math.round((now - oldest) / 1000), t: now };
}

// ---------- 지하철 ----------
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key), now = Date.now();
  if (hit && now - hit.at < ttl) return hit.v;
  try { const v = await fn(); cache.set(key, { v, at: now }); if (cache.size > 400) cache.delete(cache.keys().next().value); return v; }
  catch (e) { if (hit) return hit.v; throw e; }
}
async function call(p) {
  spend('subway');
  const r = await F(`http://swopenAPI.seoul.go.kr/api/subway/${KEY}/json/${p}`, { signal: AbortSignal.timeout(6000) });
  const j = await r.json(), e = j.errorMessage && j.errorMessage.code !== 'INFO-000' ? j.errorMessage : j.code && j.code !== 'INFO-000' ? j : null;
  if (e) { if (e.code === 'INFO-200') return {}; lastErr.subway = { at: Date.now(), msg: String(e.message || e.code).slice(0, 120) }; if (/ERROR-337|한도|초과/.test(`${e.code} ${e.message}`)) st.off.subway = 'limit'; throw new Error(e.message || '지하철 정보 오류'); }
  return j;
}
const lineWork = new Map();
// 노선 위치: 20초 기억, 예산이 없으면 마지막 값
async function linePos(line) {
  const hit = cache.get(`p:${line}`); if (hit && Date.now() - hit.at < 20000) return hit.v;
  if (!canCall('subway')) return hit?.v || [];
  if (lineWork.has(line)) return lineWork.get(line);
  const p = cached(`p:${line}`, 20000, async () => (await call(`realtimePosition/0/200/${encodeURIComponent(line)}`)).realtimePositionList?.map((t) => (seen(t.statnNm), seen(t.statnTnm), { no: xs(t.trainNo, 12), at: xs(t.statnNm, 20), sttus: +t.trainSttus || 0, up: t.updnLine === '0', to: xs(t.statnTnm, 20), express: t.directAt === '1', last: t.lstcarAt === '1', t: xs(t.recptnDt, 24) })) || []).catch(() => hit?.v || []).finally(() => lineWork.delete(line));
  lineWork.set(line, p); return p;
}
const clean = (s, n = 20) => String(s || '').replace(/[^\p{L}\p{N}\s()·-]/gu, '').trim().slice(0, n);
// 바깥(서울시 · 버스) 응답의 글자: 화면 innerHTML 에 들어갈 수 있으니 꺾쇠 · 따옴표 · 제어 문자를 빼고 짧게 (보안 10-3, 이 API 들은 http 라 중간에서 바뀔 수도 있다)
function xs(v, n = 40) { return (typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(/[<>&"'`\u0000-\u001f\u007f]/g, '').slice(0, n); }
// 역 이름 허용 (보안 10-1): 노선 위치 응답에서 본 역 이름 + 처음 보는 이름은 한 시간 200번까지만 바깥에 묻는다 (아무 이름으로 하루 예산을 태우지 못하게)
const stations = new Set(); let unknownHour = -1, unknownN = 0;
function seen(n) { if (typeof n === 'string' && n && n.length <= 20) { stations.add(n.replace(/역$/, '')); if (stations.size > 3000) stations.clear(); } }
function stationOk(sn) {
  if (!/^[가-힣A-Za-z0-9·()]{1,12}$/.test(sn)) return false;
  if (stations.has(sn)) return true;
  const h = Math.floor(Date.now() / 3600e3); if (h !== unknownHour) { unknownHour = h; unknownN = 0; }
  return ++unknownN <= 200;
}

export async function seoulApi(req, res, url, json) {
  if (!url.pathname.startsWith('/api/seoul/')) return false;
  if (url.pathname === '/api/seoul/transit/status') {
    roll(); const now = Date.now();
    return json(res, 200, { day: st.day, used: st.used, limit: LIMIT, off: st.off, err: Object.fromEntries(Object.entries(lastErr).map(([k, v]) => [k, { ago: Math.round((now - v.at) / 1000), msg: v.msg }])), cells: Object.keys(st.cells).length, fbCells: Object.values(st.cells).filter((c) => c.fb).length, active: interest.size, routes: pos.size, bus: !!BUS_KEY, subway: !!KEY, mock: MOCK }), true;
  }
  if (url.pathname === '/api/seoul/city') {
    if (!CITY_KEY) return json(res, 503, { error: '도시 정보 준비 중이에요' }), true;
    const area = String(url.searchParams.get('area') || '여의도'); if (!CITY_AREAS.includes(area)) return json(res, 400, { error: '알 수 없는 장소예요' }), true;
    try {
      const v = await cached(`c:${area}`, 300000, async () => {
        const r = await fetch(`http://openapi.seoul.go.kr:8088/${CITY_KEY}/json/citydata/1/5/${encodeURIComponent(area)}`, { signal: AbortSignal.timeout(8000) }); const c = (await r.json()).CITYDATA; if (!c) throw new Error('도시 정보가 없어요');
        const p = (c.LIVE_PPLTN_STTS || [])[0] || {}, road = c.ROAD_TRAFFIC_STTS?.AVG_ROAD_DATA || {}, w = (c.WEATHER_STTS || [])[0] || {};
        return { area, congest: xs(p.AREA_CONGEST_LVL, 12), pplMin: +p.AREA_PPLTN_MIN || 0, pplMax: +p.AREA_PPLTN_MAX || 0, at: xs(p.PPLTN_TIME, 20), road: xs(road.ROAD_TRAFFIC_IDX, 12), roadSpd: +road.ROAD_TRAFFIC_SPD || 0, temp: Number.isFinite(+w.TEMP) && w.TEMP !== '' ? +w.TEMP : null, rain: w.PRECPT_TYPE && w.PRECPT_TYPE !== '없음' ? xs(w.PRECPT_TYPE, 12) : '', sky: xs(w.SKY_STTS, 12) };
      });
      return json(res, 200, v), true;
    } catch (e) { return json(res, 502, { error: e.message }), true; }
  }
  if (url.pathname === '/api/seoul/bus/near') {
    if (!BUS_KEY) return json(res, 503, { error: '버스 정보 준비 중이에요' }), true;
    const lat = +url.searchParams.get('lat'), lon = +url.searchParams.get('lon');
    if (!(lat > 37.41 && lat < 37.72 && lon > 126.75 && lon < 127.2)) return json(res, 400, { error: '서울 밖이에요' }), true;
    const cid = String(url.searchParams.get('c') || '').replace(/[^\w-]/g, '').slice(0, 24) || String(req.headers['fly-client-ip'] || req.socket?.remoteAddress || 'x');
    try { return json(res, 200, await busNear(lat, lon, cid)), true; } catch (e) { return json(res, 502, { error: e.message }), true; }
  }
  // 노선 정류소 순서 (버스를 탔을 때 안내 방송): 7일 기억, 파일에 남긴다
  if (url.pathname === '/api/seoul/bus/stops') {
    if (!BUS_KEY) return json(res, 503, { error: '버스 정보 준비 중이에요' }), true;
    const rid = String(url.searchParams.get('rid') || '').replace(/\D/g, '').slice(0, 12); if (!rid) return json(res, 400, { error: '노선이 필요해요' }), true;
    // 서버가 아는 노선만 (칸 노선 목록 · 여의도 노선 · 이미 받은 정류소): 아무 번호로 하루 예산을 태우지 못하게 (보안 10-1)
    if (!routeInfo.has(rid) && !st.stops[rid] && !BUS_ROUTES.some(([id]) => id === rid) && !Object.values(st.cells).some((c) => c.routes?.some((q) => q[0] === rid))) return json(res, 400, { error: '알 수 없는 노선이에요' }), true;
    const hit = st.stops[rid];
    if (hit && Date.now() - hit.at < 7 * 86400e3) return json(res, 200, { rid, stops: hit.list }), true;
    if (!canCall('route')) return json(res, 200, { rid, stops: hit?.list || [], stale: true }), true;
    try {
      const list = (await busCall('route', 'busRouteInfo/getStaionByRoute', `busRouteId=${rid}`)).map((q) => ({ n: xs(q.stationNm, 30), lat: +q.gpsY, lon: +q.gpsX, seq: +q.seq || 0, dir: xs(q.direction, 20), tr: q.transYn === 'Y' })).filter((q) => q.lat > 30).sort((a, b) => a.seq - b.seq);
      st.stops[rid] = { at: Date.now(), list }; dirty = true; const ks = Object.keys(st.stops); if (ks.length > 1500) for (const k of ks.sort((a, b) => st.stops[a].at - st.stops[b].at).slice(0, 300)) delete st.stops[k];
      return json(res, 200, { rid, stops: list }), true;
    } catch (e) { return json(res, 200, { rid, stops: hit?.list || [], stale: true }), true; }
  }
  if (url.pathname === '/api/seoul/bus/pos') {
    if (!BUS_KEY) return json(res, 503, { error: '버스 정보 준비 중이에요' }), true;
    try {
      // 예전 화면: 여의도 노선 15개, 부를 때마다 2개 노선만 새로 (노선마다 3분)
      const all = await cached('bus', 20000, async () => {
        for (const [id, no, ty] of BUS_ROUTES) routeInfo.set(id, [no, ty]);
        const stale = BUS_ROUTES.filter(([id]) => Date.now() - (pos.get(id)?.at || 0) > 180000);
        for (const [id] of stale.slice(0, 2)) { if (!canCall('pos')) break; try { await fetchRoute(id); } catch { /* 다음에 */ } }
        return BUS_ROUTES.flatMap(([id]) => pos.get(id)?.list || []);
      });
      return json(res, 200, { buses: all, t: Date.now() }), true;
    } catch (e) { return json(res, 502, { error: e.message }), true; }
  }
  if (!KEY) return json(res, 503, { error: '지하철 정보 준비 중이에요' }), true;
  try {
    if (url.pathname === '/api/seoul/subway/arrival') {
      const sn = clean(url.searchParams.get('station'), 12).replace(/\s/g, ''); if (!sn) return json(res, 400, { error: '역 이름이 필요해요' }), true;
      if (!/^[가-힣A-Za-z0-9·()\s]{1,14}$/.test(String(url.searchParams.get('station'))) || !stationOk(sn)) return json(res, 400, { error: '알 수 없는 역이에요' }), true;
      const hit = cache.get(`a:${sn}`); if (!canCall('subway') && !(hit && Date.now() - hit.at < 20000)) return json(res, 200, { station: sn, trains: hit?.v || [], t: Date.now(), stale: true }), true;
      const v = await cached(`a:${sn}`, 20000, async () => (await call(`realtimeStationArrival/0/16/${encodeURIComponent(sn)}`)).realtimeArrivalList?.map((t) => ({ line: LINE_OF[t.subwayId] || xs(t.subwayId, 8), up: xs(t.updnLine, 8), to: xs(t.trainLineNm, 40), msg: xs(t.arvlMsg2, 40), at: xs(t.arvlMsg3, 20), sec: Math.max(0, Math.min(36000, +t.barvlDt || 0)), no: xs(t.btrainNo, 12), kind: xs(t.btrainSttus, 12), last: t.lstcarAt === '1' })) || []);
      return json(res, 200, { station: sn, trains: v, t: Date.now() }), true;
    }
    if (url.pathname === '/api/seoul/subway/position') {
      const line = clean(url.searchParams.get('line'), 8); if (!LINE_RE.test(line)) return json(res, 400, { error: '노선 이름이 이상해요' }), true;
      return json(res, 200, { line, trains: await linePos(line), t: Date.now() }), true;
    }
    if (url.pathname === '/api/seoul/subway/positions') {
      const lines = [...new Set(String(url.searchParams.get('lines') || '').split(',').map((s) => clean(s, 8)).filter((s) => LINE_RE.test(s)))].slice(0, 8);
      if (!lines.length) return json(res, 400, { error: '노선 이름이 이상해요' }), true;
      const all = await Promise.all(lines.map((l) => linePos(l)));
      return json(res, 200, { lines: Object.fromEntries(lines.map((l, i) => [l, all[i]])), t: Date.now() }), true;
    }
    return json(res, 404, { error: 'not found' }), true;
  } catch (e) { return json(res, 502, { error: e.message }), true; }
}
