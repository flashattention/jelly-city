// 지도 건물 높이 바로잡기: 주변보다 터무니없이 높은 이름 없는 건물(자료 오류)을 주변 수준으로 낮춘다
//   예) 1968년 4층짜리 자리에 404m · 1982년 건물에 172m 처럼 높이 값이 잘못 들어온 것 (아파트 단지 옆에 혼자 200층처럼 솟는다)
//   세 가지가 다 맞을 때만: 이름이 없고 · 높이가 바닥 짧은 변의 12배 넘게 가늘고 · 주변(220m 안) 90% 높이의 3배(그리고 +60m) 넘게 높다
//   이름이 있는 실제 초고층(롯데월드타워 · IFC 등) · 낮은 동네 옆 실제 고층 아파트(성수 트리마제 등) · 초고층 단지는 건드리지 않는다
//   건물 한 개: [높이, 아래 높이, 종류, 색, 이름 번호, …, 바닥 꼭짓점 x, z, …(7번째부터)] · 좌표 × scale = m
const GENERIC = /^(\d+|[A-Za-z]|[가-힣]?\d+동|[A-Z]동|-)$/; // '101동' · 'A' · '109' 같은 이름은 이름 없는 것으로 본다
// 이름이 있어도 높이 자료가 틀린 것으로 확인된 건물 (이름 → 실제에 가까운 높이 m)
//   헌법재판소 본관: 지상 5층 석조 청사인데 자료에 193.5m 로 들어와 북촌에서 탑처럼 솟았다
const KNOWN = { '헌법재판소 본관': 24 };
export function fixHeights(M, log = () => {}) {
  const B = M.buildings; if (!Array.isArray(B) || !B.length) return 0;
  let known = 0; for (const b of B) { const nm = (b[4] >= 0 && M.names?.[b[4]]) || ''; if (KNOWN[nm] && b[0] > KNOWN[nm] * 1.5) { log(`${nm} ${b[0]}m → ${KNOWN[nm]}m (확인된 자료 오류)`); b[0] = KNOWN[nm]; b[1] = 0; known++; } }
  const S = M.scale || 0.1, P = B.map((b) => { let x = 0, z = 0, n = 0; for (let k = 7; k < b.length; k += 2) { x += b[k]; z += b[k + 1]; n++; } return [(x / Math.max(1, n)) * S, (z / Math.max(1, n)) * S]; });
  let fixed = 0;
  B.forEach((b, i) => {
    const h = b[0], nm = (b[4] >= 0 && M.names?.[b[4]]) || '';
    if (h < 80 || (nm && !GENERIC.test(nm.trim()))) return;
    // 바닥 짧은 변: 실제 탑은 높이가 짧은 변의 5배 안팎, 자료 오류는 13 ~ 40배
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let k = 7; k < b.length; k += 2) { x0 = Math.min(x0, b[k]); x1 = Math.max(x1, b[k]); z0 = Math.min(z0, b[k + 1]); z1 = Math.max(z1, b[k + 1]); }
    if (h / Math.max(1, Math.min(x1 - x0, z1 - z0) * S) <= 12) return;
    const near = []; for (let j = 0; j < B.length; j++) if (j !== i && Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) < 220) near.push(B[j][0]);
    if (near.length < 6) return;
    near.sort((a, c) => a - c); const p90 = near[Math.floor(near.length * 0.9)];
    if (h > Math.max(3 * p90, p90 + 60)) { const nh = Math.round(Math.max(p90 * 1.3, 20) * 10) / 10; log(`${nm || '이름 없음'} ${h}m → ${nh}m (주변 90% ${p90}m · 이웃 ${near.length})`); b[0] = nh; if (b[1] > nh) b[1] = 0; fixed++; }
  });
  // (2026-11-12 8-32) 갈색 좁고 높은 건물이 아직 남아서 규칙을 더한다
  //   가. 벽돌 · 블록 · 돌 (조적, 구조 11 · 12 · 13 · 19) 건물은 실제로 5 ~ 6층이 한계 → 22m 넘으면 주변 수준(최대 18m)으로
  //   나. 단독주택(용도 1) 이 25m 넘으면 12m 로
  //   다. 바닥 150㎡ 안쪽의 작은 건물이 혼자(6m 안에 비슷한 높이의 더 큰 건물이 없음) 주변 90% 의 2배 · 40m 넘게 솟으면 주변 수준으로
  //      (붙어 있는 작은 조각 = 큰 건물의 계단실 · 탑 부분은 그대로)
  const G = B.map((b) => { let A = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const n = (b.length - 7) / 2; for (let k = 0; k < n; k++) { const ax = b[7 + k * 2] * S, az = b[8 + k * 2] * S, j = (k + 1) % n, cx = b[7 + j * 2] * S, cz = b[8 + j * 2] * S; A += ax * cz - cx * az; x0 = Math.min(x0, ax); x1 = Math.max(x1, ax); z0 = Math.min(z0, az); z1 = Math.max(z1, az); } return { A: Math.abs(A) / 2, x0, x1, z0, z1 }; });
  const near90 = (i) => { const a = []; for (let j = 0; j < B.length; j++) if (j !== i && Math.abs(P[j][0] - P[i][0]) < 220 && Math.abs(P[j][1] - P[i][1]) < 220) a.push(B[j][0]); a.sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.9)] : 15; };
  let more = 0;
  B.forEach((b, i) => {
    const h = b[0]; if (h < 22) return; const nm = (b[4] >= 0 && M.names?.[b[4]]) || '', info = Array.isArray(M.binfo?.[i]) ? M.binfo[i] : null, use = info?.[0] || 0, st = info?.[1] || 0;
    // 모두 공통: 주변(220m) 90% 높이의 2배 넘게 혼자 솟을 때만 (아파트 단지 · 업무 지구의 실제 고층은 이웃도 높아서 걸리지 않는다)
    //   건축물 정보가 이웃 건물 것으로 잘못 붙은 경우도 있어서, 정보만 보고 낮추지 않는다
    const g = G[i], p90 = near90(i);
    for (let j = 0; j < B.length; j++) { if (j === i) continue; const q = G[j]; if (q.A > g.A && B[j][0] >= 0.7 * h && q.x0 < g.x1 + 6 && q.x1 > g.x0 - 6 && q.z0 < g.z1 + 6 && q.z1 > g.z0 - 6) return; }
    // 바닥 60㎡ 안쪽(방 두어 칸 크기)인데 40m 넘게 혼자 서 있는 기둥: 실제 건물일 수 없다 (큰 건물 외곽선에서 떨어져 나온 조각) → 이름 · 해 · 단지 상관없이
    if (h > 40 && g.A <= 60 && b[1] < 5) { const nh = Math.round(Math.min(18, Math.max(9, p90 * 0.8)) * 10) / 10; log(`${nm || '이름 없음'} ${h}m → ${nh}m (바닥 ${Math.round(g.A)}㎡ 기둥)`); b[0] = nh; if (b[1] >= nh) b[1] = 0; more++; return; }
    if (h <= 2 * p90 || /성당|교회|탑|타워/.test(nm)) return;
    // 이름이 진짜 이름(브랜드 · 건물명)이거나 2005년 뒤 지은 건물은 실제 좁고 높은 건물(연필 빌딩 · 주상복합)일 수 있어 건드리지 않는다
    const yr = info?.[2] || 0, realName = nm && !GENERIC.test(nm.trim()) && !/^[가-힣]*(아파트|빌라|맨션)$/.test(nm.trim()); if (realName || yr >= 2005) return;
    // 단지: 200m 안에 비슷한 높이(0.7배 넘음) 건물이 2채 넘게 있으면 실제 고층 단지로 본다
    { let peers = 0; for (let j = 0; j < B.length && peers < 2; j++) if (j !== i && B[j][0] >= 0.7 * h && Math.hypot(P[j][0] - P[i][0], P[j][1] - P[i][1]) < 200 && G[j].A > 150) peers++; if (peers >= 2) return; }
    let nh = 0, why = '';
    if ([11, 12, 13, 19].includes(st) && g.A < 1500) { nh = Math.min(18, Math.max(9, p90)); why = '벽돌 · 블록 구조'; }
    else if (use === 1 && h > 25 && g.A < 600) { nh = 12; why = '단독주택'; }
    else if (h > 40 && g.A <= 150 && h > 2.5 * p90) { nh = Math.round(Math.max(p90 * 1.2, 15) * 10) / 10; why = `작은 바닥 ${Math.round(g.A)}㎡ 혼자 솟음`; }
    if (!nh || nh >= h) return;
    log(`${nm || '이름 없음'} ${h}m → ${nh}m (${why})`); b[0] = nh; if (b[1] >= nh) b[1] = 0; more++;
  });
  return fixed + known + more;
}
