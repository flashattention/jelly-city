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
  return fixed + known;
}
