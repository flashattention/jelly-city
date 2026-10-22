// 서버와 브라우저가 똑같은 도시와 시민을 만들기 위한 공통 초기화
import { planCity } from './city.js';
import { Sim } from './citizens.js';
import { HOME_TYPES } from './data.js';

export const WORLD_VERSION = 2; // 도시 구조가 바뀌면 올린다 (저장된 집/관계 정리)

export function setupWorld(seed) {
  const buildings = planCity(seed);
  // 플레이어용 매물: 도심 주택 4채 + 교외 주택 3채 중 2채
  const houses = buildings.filter((b) => b.type === 'house');
  const central = houses.filter((b) => !b.suburb).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || a.id - b.id).slice(0, 4);
  const suburb = houses.filter((b) => b.suburb).filter((b, i) => i % 3 !== 0);
  const reserved = [...central, ...suburb];
  for (const h of reserved) { h.name = h.suburb ? '전원주택 (매물)' : '빈 집 (매물)'; h.isPlayerHome = true; }
  const city = { buildings, byType: {} };
  for (const b of buildings) (city.byType[b.type] ||= []).push(b);
  const sim = new Sim(city, seed);
  sim.generate(reserved);
  return { buildings, city, sim, reserved };
}

export const isHomeType = (b) => HOME_TYPES.includes(b.type);

// 호수 목록: 빌라는 층당 2호, 아파트는 층당 4호. 앞쪽 호수부터 주민(NPC)이 산다
export function unitLabels(b) {
  if (b.type === 'house') return ['단독'];
  const per = b.type === 'villa' ? 2 : 4;
  const out = [];
  for (let f = 1; f <= b.floors; f++) for (let n = 1; n <= per; n++) out.push(`${f}0${n}호`);
  return out;
}

// 매물로 나온 호수 (owned: 이미 플레이어가 산 호수 배열)
export function freeUnits(b, owned = []) {
  if (b.type === 'house') return b.residents.length === 0 && !owned.length ? ['단독'] : [];
  const all = unitLabels(b);
  const npc = Math.min(all.length, b.npcHouseholds || 0);
  // NPC는 위층부터 산다고 치고, 아래층 일부는 매물
  return all.slice(0, all.length - npc).filter((u) => !owned.includes(u));
}

const near = (b) => Math.max(0, 260 - Math.hypot(b.x, b.z)); // 도심 프리미엄
const r50 = (v) => Math.round(v / 50) * 50;

export function housePrice(b, unit) {
  if (b.type === 'villa') {
    const f = parseInt(unit, 10) / 100 | 0;
    return r50(900 + f * 60 + near(b) * 3);
  }
  if (b.type === 'apartment') {
    const f = parseInt(unit, 10) / 100 | 0;
    return r50(1500 + f * 110 + near(b) * 6 + b.floors * 40);
  }
  return r50(1600 + b.w * b.d * 14 + near(b) * 7 + (b.suburb ? 600 : 0));
}

export function homeLabel(b, unit) {
  if (!b) return '';
  return b.type === 'house' ? b.name : `${b.name} ${unit || ''}`.trim();
}

export const forSale = (b, owned = []) => isHomeType(b) && freeUnits(b, owned).length > 0;
