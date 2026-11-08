// 서울 실시간 지하철 (서울 열린데이터광장 swopenAPI): 키는 서버 환경 변수 SEOUL_SUBWAY_KEY 에만 둔다
//   /api/seoul/subway/arrival?station=여의나루 → 그 역에 들어오는 열차 (도착까지 · 방면)
//   /api/seoul/subway/position?line=1호선   → 그 노선 열차들이 지금 어느 역에 있는지
//   같은 질문은 15 ~ 20초 동안 기억해서 돌려준다 (호출 수 제한 · 키 보호)
const KEY = process.env.SEOUL_SUBWAY_KEY || '';
// 버스 위치 (공공데이터포털 서울 버스위치정보): 키 SEOUL_BUS_KEY (인코딩된 그대로), 보여 줄 노선 아이디 SEOUL_BUS_ROUTES (쉼표)
const BUS_KEY = process.env.SEOUL_BUS_KEY || '';
// 여의도를 지나는 실제 노선 (노선정보조회로 찾은 아이디 · 3 간선 파랑 · 4 지선 초록)
const BUS_ROUTES = [['100100043', '261', 3], ['100100044', '262', 3], ['100100057', '360', 3], ['100100071', '461', 3], ['100100605', '463', 3], ['100100078', '503', 3], ['100100085', '600', 3], ['100100550', '662', 3], ['100100118', '753', 3], ['100100034', '162', 3], ['100100033', '160', 3], ['100100272', '5615', 4], ['100100275', '5618', 4], ['100100301', '6623', 4], ['100100347', '7613', 4]];
const busCache = new Map(); let busTurn = 0;
// 서울 실시간 도시데이터 (인구 혼잡도 · 도로 소통 · 날씨): 키 SEOUL_CITY_KEY · 장소는 정해 둔 곳만
const CITY_KEY = process.env.SEOUL_CITY_KEY || '', CITY_AREAS = ['여의도', '여의도한강공원', '홍대 관광특구', '남산공원', '이태원 관광특구', '반포한강공원', '뚝섬한강공원'];
const LINE_OF = { 1001: '1호선', 1002: '2호선', 1003: '3호선', 1004: '4호선', 1005: '5호선', 1006: '6호선', 1007: '7호선', 1008: '8호선', 1009: '9호선', 1063: '경의중앙선', 1065: '공항철도', 1067: '경춘선', 1075: '수인분당선', 1077: '신분당선', 1092: '우이신설선', 1032: 'GTX-A' };
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key), now = Date.now();
  if (hit && now - hit.at < ttl) return hit.v;
  try { const v = await fn(); cache.set(key, { v, at: now }); if (cache.size > 400) cache.delete(cache.keys().next().value); return v; }
  catch (e) { if (hit) return hit.v; throw e; }
}
async function call(path) {
  const r = await fetch(`http://swopenAPI.seoul.go.kr/api/subway/${KEY}/json/${path}`, { signal: AbortSignal.timeout(6000) });
  const j = await r.json(); if (j.errorMessage && j.errorMessage.code !== 'INFO-000') throw new Error(j.errorMessage.message || '지하철 정보 오류'); if (j.code && j.code !== 'INFO-000') throw new Error(j.message || '지하철 정보 오류');
  return j;
}
const clean = (s, n = 20) => String(s || '').replace(/[^\p{L}\p{N}\s()·-]/gu, '').trim().slice(0, n);
export async function seoulApi(req, res, url, json) {
  if (!url.pathname.startsWith('/api/seoul/')) return false;
  if (url.pathname === '/api/seoul/city') {
    if (!CITY_KEY) return json(res, 503, { error: '도시 정보 준비 중이에요' }), true;
    const area = String(url.searchParams.get('area') || '여의도'); if (!CITY_AREAS.includes(area)) return json(res, 400, { error: '알 수 없는 장소예요' }), true;
    try {
      const v = await cached(`c:${area}`, 300000, async () => {
        const r = await fetch(`http://openapi.seoul.go.kr:8088/${CITY_KEY}/json/citydata/1/5/${encodeURIComponent(area)}`, { signal: AbortSignal.timeout(8000) }); const c = (await r.json()).CITYDATA; if (!c) throw new Error('도시 정보가 없어요');
        const p = (c.LIVE_PPLTN_STTS || [])[0] || {}, road = c.ROAD_TRAFFIC_STTS?.AVG_ROAD_DATA || {}, w = (c.WEATHER_STTS || [])[0] || {};
        return { area, congest: p.AREA_CONGEST_LVL || '', pplMin: +p.AREA_PPLTN_MIN || 0, pplMax: +p.AREA_PPLTN_MAX || 0, at: p.PPLTN_TIME || '', road: road.ROAD_TRAFFIC_IDX || '', roadSpd: +road.ROAD_TRAFFIC_SPD || 0, temp: +w.TEMP || null, rain: w.PRECPT_TYPE && w.PRECPT_TYPE !== '없음' ? w.PRECPT_TYPE : '', sky: w.SKY_STTS || '' };
      });
      return json(res, 200, v), true;
    } catch (e) { return json(res, 502, { error: e.message }), true; }
  }
  if (url.pathname === '/api/seoul/bus/pos') {
    if (!BUS_KEY) return json(res, 503, { error: '버스 정보 준비 중이에요' }), true;
    try {
      // 하루 호출 수 제한이 있어서: 부를 때마다 2개 노선만 새로 받고, 노선마다 3분 기억 (오래된 것부터 차례로)
      const all = await cached('bus', 20000, async () => {
        const stale = BUS_ROUTES.filter(([id]) => !busCache.has(id) || Date.now() - busCache.get(id).at > 180000);
        for (const [id, no, type] of stale.slice(0, 2)) { try { const r = await fetch(`http://ws.bus.go.kr/api/rest/buspos/getBusPosByRtid?serviceKey=${BUS_KEY}&busRouteId=${id}&resultType=json`, { signal: AbortSignal.timeout(6000) }); const j = await r.json(); busCache.set(id, { at: Date.now(), list: (j.msgBody?.itemList || []).map((b) => ({ id: b.vehId, route: no, type, lon: +b.gpsX, lat: +b.gpsY, t: b.dataTm })) }); } catch { /* 다음에 */ } }
        busTurn++; return [...busCache.values()].flatMap((c) => c.list);
      });
      return json(res, 200, { buses: all, t: Date.now() }), true;
    } catch (e) { return json(res, 502, { error: e.message }), true; }
  }
  if (!KEY) return json(res, 503, { error: '지하철 정보 준비 중이에요' }), true;
  try {
    if (url.pathname === '/api/seoul/subway/arrival') {
      const st = clean(url.searchParams.get('station'), 12); if (!st) return json(res, 400, { error: '역 이름이 필요해요' }), true;
      const v = await cached(`a:${st}`, 20000, async () => (await call(`realtimeStationArrival/0/16/${encodeURIComponent(st)}`)).realtimeArrivalList?.map((t) => ({ line: LINE_OF[t.subwayId] || t.subwayId, up: t.updnLine, to: t.trainLineNm, msg: t.arvlMsg2, at: t.arvlMsg3, sec: +t.barvlDt || 0, no: t.btrainNo, kind: t.btrainSttus, last: t.lstcarAt === '1' })) || []);
      return json(res, 200, { station: st, trains: v, t: Date.now() }), true;
    }
    if (url.pathname === '/api/seoul/subway/position') {
      const line = clean(url.searchParams.get('line'), 8); if (!/^(\d호선|경의중앙선|공항철도|경춘선|수인분당선|신분당선|우이신설선)$/.test(line)) return json(res, 400, { error: '노선 이름이 이상해요' }), true;
      const v = await cached(`p:${line}`, 15000, async () => (await call(`realtimePosition/0/200/${encodeURIComponent(line)}`)).realtimePositionList?.map((t) => ({ no: t.trainNo, at: t.statnNm, sttus: +t.trainSttus, up: t.updnLine === '0', to: t.statnTnm, express: t.directAt === '1', t: t.recptnDt })) || []);
      return json(res, 200, { line, trains: v, t: Date.now() }), true;
    }
    return json(res, 404, { error: 'not found' }), true;
  } catch (e) { return json(res, 502, { error: e.message }), true; }
}
