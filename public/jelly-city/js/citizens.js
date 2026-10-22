// 시민 생성과 생활 시뮬레이션.
// 서버가 이 시뮬레이션을 돌리는 유일한 주인이고, 브라우저는 같은 시드로 generate()만 호출해
// 시민 프로필(이름, 직업, 관계 등)을 똑같이 만든 뒤 위치/상태는 서버 스냅샷으로 받는다.
import * as THREE from 'three';
import { X_LINES, Z_LINES, HALF, POPULATION } from './config.js';
import { npcLevel } from './level.js';
import {
  JOBS, SPECIAL_JOBS, PERSONALITIES, SURNAMES, NAMES_M, NAMES_F, NAMES_N, OLD_M, OLD_F,
  SOCIAL_ROLES, HOBBIES, WORRIES, DREAMS, BODY_COLORS, SMALL_TALK, BUILDING_TYPES,
} from './data.js';
import { RNG } from '../../shared/js/utils.js';

// 주말에 쉬는 직장
const WEEKDAY_ONLY = new Set(['school', 'kindergarten', 'university', 'office', 'bank', 'court', 'cityhall', 'postoffice', 'lab', 'factory', 'construction', 'realestate']);
const LEISURE_TYPES = ['cafe', 'restaurant', 'pizza', 'chicken', 'chinese', 'gukbap', 'burger', 'bunsik', 'bakery', 'park', 'library', 'gym', 'cinema', 'supermarket', 'convenience', 'bookstore', 'museum', 'gallery', 'salon', 'clothing', 'concerthall', 'flowershop', 'bank', 'postoffice', 'pharmacy', 'hospital', 'hatshop', 'eyewear', 'jeweler', 'dojang', 'armory_3k', 'armory_mil', 'armory_sf'];
const MEAL_TYPES = ['seafood', 'restaurant', 'cafe', 'bakery', 'convenience', 'pizza', 'chicken', 'chinese', 'gukbap', 'burger', 'bunsik'];

const inHours = (h, [a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b);

// 네트워크로 주고받는 모드/계획 코드
export const MODES = ['inside', 'walk', 'idle', 'park', 'chat', 'player', 'fight', 'flee', 'dead'];
export const NEED_KEYS = ['hunger', 'energy', 'fun', 'social', 'hygiene'];
const COMBAT = new Set(['fight', 'flee', 'dead']);
// 성격별 기분 특성: sens 나쁜 일에 상처받는 정도, resil 회복 속도, report 신고 성향
const MOOD_TRAITS = {
  chatty: [1.0, 1.3, 0.5], cynic: [0.8, 0.9, 0.3], shy: [1.3, 0.8, 0.6], workaholic: [1.0, 1.0, 0.6], chill: [0.6, 1.6, 0.2],
  perfectionist: [1.2, 0.8, 0.9], braggart: [1.1, 1.1, 0.5], caring: [1.0, 1.1, 0.6], dreamer: [0.9, 1.2, 0.3], grumpy: [1.4, 0.7, 0.7],
  curious: [0.9, 1.2, 0.4], anxious: [1.5, 0.7, 0.95], romantic: [1.2, 0.9, 0.5], joker: [0.8, 1.4, 0.3], philosopher: [0.7, 1.0, 0.4],
  competitive: [1.1, 1.0, 0.3], gossip: [1.1, 1.1, 0.8], polite: [1.0, 1.0, 0.9], rebel: [0.9, 1.2, 0.1], planner: [1.0, 1.0, 0.8],
};
export const moodLabel = (m) => (m >= 80 ? '최고' : m >= 62 ? '좋음' : m >= 42 ? '보통' : m >= 25 ? '나쁨' : '최악');
export const moodEmoji = (m) => (m >= 80 ? '😄' : m >= 62 ? '🙂' : m >= 42 ? '😐' : m >= 25 ? '😟' : '😡');
const AGGRESSIVE = new Set(['competitive', 'rebel', 'grumpy', 'braggart']);
const FOOD_TYPES = new Set(['restaurant', 'cafe', 'bakery', 'convenience', 'supermarket', 'pizza', 'chicken', 'chinese', 'gukbap', 'burger', 'bunsik']);
const FUN_TYPES = new Set(['cinema', 'concerthall', 'club', 'museum', 'gallery', 'gym', 'library', 'bookstore', 'park', 'dojang', 'clothing', 'hatshop', 'eyewear']);
export const PLAN_KINDS = ['none', 'sleep', 'work', 'leisure', 'patrol', 'wander', 'report'];

// ------------------------------------------------------------------
// 보행 경로
// ------------------------------------------------------------------
const LIM = HALF - 1;
function nearestLine(p) {
  let best = null;
  for (const x of X_LINES) { const d = Math.abs(p.x - x); if (!best || d < best.d) best = { d, type: 'X', v: x }; }
  for (const z of Z_LINES) { const d = Math.abs(p.z - z); if (!best || d < best.d) best = { d, type: 'Z', v: z }; }
  const pt = best.type === 'X' ? new THREE.Vector3(best.v, 0, clampL(p.z)) : new THREE.Vector3(clampL(p.x), 0, best.v);
  return { point: pt, type: best.type };
}
const clampL = (v) => Math.max(-LIM, Math.min(LIM, v));
function bestLine(lines, a, b) {
  let best = lines[0], bd = Infinity;
  for (const l of lines) { const d = Math.abs(a - l) + Math.abs(b - l); if (d < bd) { bd = d; best = l; } }
  return best;
}
// p(type) → q(type): 보행 라인만 따라가는 경로 (p 제외, q 포함)
function lineRoute(p, pt, q, qt) {
  const out = [];
  if (pt === 'Z' && qt === 'Z') {
    if (Math.abs(p.z - q.z) < 0.01) out.push(q.clone());
    else { const xm = bestLine(X_LINES, p.x, q.x); out.push(new THREE.Vector3(xm, 0, p.z), new THREE.Vector3(xm, 0, q.z), q.clone()); }
  } else if (pt === 'X' && qt === 'X') {
    if (Math.abs(p.x - q.x) < 0.01) out.push(q.clone());
    else { const zm = bestLine(Z_LINES, p.z, q.z); out.push(new THREE.Vector3(p.x, 0, zm), new THREE.Vector3(q.x, 0, zm), q.clone()); }
  } else if (pt === 'Z') out.push(new THREE.Vector3(q.x, 0, p.z), q.clone());
  else out.push(new THREE.Vector3(p.x, 0, q.z), q.clone());
  return out;
}
export function randomStreetPoint(rng) {
  if (rng.chance(0.5)) return { point: new THREE.Vector3(rng.pick(X_LINES), 0, rng.range(-LIM, LIM)), type: 'X' };
  return { point: new THREE.Vector3(rng.range(-LIM, LIM), 0, rng.pick(Z_LINES)), type: 'Z' };
}

// ------------------------------------------------------------------
// 시민
// ------------------------------------------------------------------
export class Citizen {
  constructor(data) {
    Object.assign(this, data);
    this.relations = new Map();
    this.baseAffinity = data.affinity ?? 30;
    this.affinity = this.baseAffinity; // 브라우저: 나와의 친밀도
    this.memories = [];
    this.mode = 'inside';
    this.location = this.home;
    this.pos = this.home.door.clone();
    this.ipos = new THREE.Vector3();
    this.heading = 0;
    this.path = [];
    this.dest = null;
    this.plan = null;
    this.idleT = 0;
    this.chatCooldown = 0;
    this.thoughtCooldown = 5 + Math.random() * 30;
    this.bubble = null;
    this.inside = { state: 'none', target: null, spot: null };
    this.talkingTo = null; // 대화 중인 플레이어
    this.moving = 0;
    // 플레이어와 똑같은 욕구와 체력
    this.maxHp = this.age < 13 ? 60 : this.age >= 70 ? 70 : 100;
    // 레벨: 나이와 직업으로 정해지고, 높을수록 튼튼하고 주먹이 세다
    this.level = npcLevel(this, ((this.id * 7919) % 100) / 100);
    this.maxHp += (this.level - 1) * 5;
    this.hp = this.maxHp;
    const r = (a, b) => a + ((this.id * 37 + a * 13) % (b - a));
    this.needs = { hunger: r(50, 95), energy: r(55, 95), fun: r(40, 90), social: r(40, 90), hygiene: r(55, 95) };
    // 기분: 욕구에서 오는 기본값 + 최근 사건의 여운
    const [sens, resil, report] = MOOD_TRAITS[this.personality.id] || [1, 1, 0.5];
    this.trait = { sens, resil, report };
    this.moodEvent = 0;
    this.mood = 60;
    this.moodReasons = [];
    this.grudges = {}; // 플레이어 토큰 → { name, pts }
    this.report = null; // 신고하러 갈 대상
  }

  moodText() {
    const why = this.moodReasons.slice(-3).map((r) => r.text);
    const N = this.needs;
    if (N.hunger < 30) why.push('배가 고픔');
    if (N.energy < 25) why.push('피곤함');
    if (N.social < 25) why.push('외로움');
    if (N.fun < 25) why.push('심심함');
    if (this.hp < this.maxHp * 0.5) why.push('몸이 아픔');
    return `${Math.round(this.mood)}/100 (${moodLabel(this.mood)})${why.length ? ' — 이유: ' + why.join(', ') : ''}`;
  }

  needText() {
    const N = this.needs, out = [];
    if (this.hp < this.maxHp * 0.5) out.push('몸이 많이 다쳐 아프다');
    if (N.hunger < 30) out.push('배가 몹시 고프다');
    if (N.energy < 25) out.push('너무 피곤하고 졸리다');
    if (N.fun < 25) out.push('심심하다');
    if (N.social < 25) out.push('외롭고 누군가와 얘기하고 싶다');
    if (N.hygiene < 25) out.push('씻고 싶다');
    return `체력 ${Math.round(this.hp)}/${this.maxHp}, 포만감 ${Math.round(N.hunger)}, 에너지 ${Math.round(N.energy)}, 재미 ${Math.round(N.fun)}, 사교 ${Math.round(N.social)}, 청결 ${Math.round(N.hygiene)} (100이 최상)${out.length ? ' → ' + out.join(', ') : ''}`;
  }

  get label() { return `${this.name} (${this.age}세 · ${this.job.name})`; }

  get accessories() {
    const acc = [...this.job.acc];
    if (this.extraAcc) acc.push(this.extraAcc);
    if (this.age >= 65 && !acc.includes('glasses') && !acc.includes('sunglasses')) acc.push('glasses');
    return acc;
  }

  say(text, dur = 3.5) {
    this.bubble = { text, t: dur };
    this.sim?.emit({ t: 'say', id: this.id, text, dur });
  }
  emote(emotion, dur = 4) { this.sim?.emit({ t: 'emo', id: this.id, e: emotion, dur }); }
  wave() { this.sim?.emit({ t: 'wave', id: this.id }); }

  relationTo(other) { return this.relations.get(other.id); }

  activityText() {
    const p = this.plan;
    if (this.mode === 'player') return `${this.activityBeforeTalk || '길을 가던 중'} (그러다 ${this.talkingName || '누군가'}이(가) 말을 걸어 잠시 멈춤)`;
    if (this.mode === 'chat') return `${this.chatWith?.name || '이웃'}와(과) 수다 떠는 중`;
    if (this.mode === 'dead') return '쓰러져서 정신을 잃은 상태';
    if (this.mode === 'flee') return '공격을 피해 도망치는 중';
    if (this.mode === 'fight') return '자신을 때린 상대와 싸우는 중';
    if (this.plan?.kind === 'report') return this.mode === 'inside' && this.location?.type === 'police' ? `경찰서에서 ${this.report?.name || '누군가'}을(를) 신고하는 중` : `${this.report?.name || '누군가'}을(를) 신고하러 경찰서에 가는 중`;
    if (this.mode === 'walk' && this.dest) return `${this.dest.name}(으)로 가는 중`;
    if (this.mode === 'park') return p?.kind === 'work' ? '공원을 가꾸는 중' : '공원에서 산책하는 중';
    if (p?.kind === 'patrol') return { police: '거리를 순찰하는 중', mail_carrier: '우편물을 배달하는 중', street_cleaner: '거리를 청소하는 중', delivery: '음식을 배달하는 중', reporter: '취재하러 다니는 중', youtuber: '브이로그 촬영 중' }[this.job.id] || '돌아다니며 일하는 중';
    if (p?.kind === 'wander') return '거리를 산책하는 중';
    if (this.mode === 'inside' && this.location) {
      if (p?.kind === 'sleep') return '집에서 자는 중';
      if (p?.kind === 'work') return this.job.wage > 0 ? `${this.location.name}에서 일하는 중 (${this.job.duty})` : `${this.location.name}에서 수업 듣는 중`;
      if (this.location === this.home) return '집에서 쉬는 중';
      return `${this.location.name}에서 시간을 보내는 중`;
    }
    return '바쁘게 사는 중';
  }
}

// ------------------------------------------------------------------
// 시뮬레이션
// ------------------------------------------------------------------
export class Sim {
  constructor(city, seed) {
    this.city = city;
    this.rng = new RNG(seed + 7);
    this.citizens = [];
    this.active = new Map(); // 플레이어가 들어가 있는 건물 id → 실내 정보
    this.interiorFor = null; // (building) => 실내 지점 정보 (서버가 주입)
    this.chatPairs = [];
    this.encounterT = 0;
    this.events = [];
    this.onStreetChat = null; // (a, b) => Promise<lines[]|null>
    // 건물 벽 (도망·싸움 중에 건물을 뚫고 지나가지 않도록)
    this.blockers = city.buildings.filter((b) => b.type !== 'park').map((b) => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }));
  }

  pushOut(pos, r = 0.5) {
    for (const b of this.blockers) {
      if (pos.x < b.minX - r || pos.x > b.maxX + r || pos.z < b.minZ - r || pos.z > b.maxZ + r) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
      if (d > 1e-4) { if (d < r) { pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; } continue; }
      // 안쪽에 들어가 버렸으면 가장 가까운 면 밖으로
      const opts = [[b.minX - r - pos.x, 0], [b.maxX + r - pos.x, 0], [0, b.minZ - r - pos.z], [0, b.maxZ + r - pos.z]];
      opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
      pos.x += opts[0][0]; pos.z += opts[0][1];
    }
  }

  // 공격한 쪽에서 먼 보도 지점으로 달아나는 경로
  fleeRoute(c, from) {
    let best = null, bd = -1;
    for (let i = 0; i < 8; i++) {
      const sp = randomStreetPoint(this.rng);
      const away = Math.hypot(sp.point.x - from.x, sp.point.z - from.z);
      const near = Math.hypot(sp.point.x - c.pos.x, sp.point.z - c.pos.z);
      if (near < 15 || near > 90) continue;
      if (away > bd) { bd = away; best = sp; }
    }
    best ||= randomStreetPoint(this.rng);
    const nl = nearestLine(c.pos);
    c.path = [nl.point.clone(), ...lineRoute(nl.point, nl.type, best.point, best.type)];
  }

  emit(ev) { this.events.push(ev); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---------------- 생성 ----------------
  // reserved: 플레이어용으로 비워둘 집 목록
  generate(reserved = []) {
    const R = this.rng;
    const homes = this.city.buildings.filter((b) => (b.type === 'house' || b.type === 'apartment' || b.type === 'villa') && !reserved.includes(b));
    R.shuffle(homes);
    const people = [];
    let hid = 0;
    const mk = (household, role, age, gender, surname) => {
      const p = { household, familyRole: role, age, gender, surname, home: household.home };
      people.push(p); household.members.push(p);
      return p;
    };
    const randGender = () => (R.chance(0.5) ? '남' : '여');
    const households = [];
    const makeHousehold = (home, kind) => {
      const hh = { id: hid++, home, members: [], kind };
      const S = R.pick(SURNAMES);
      if (kind === 'family') {
        const sameSex = R.chance(0.08);
        const g1 = R.chance(0.5) ? '남' : '여';
        const g2 = sameSex ? g1 : g1 === '남' ? '여' : '남';
        const pa = R.int(30, 52);
        mk(hh, 'parent', pa, g1, S);
        mk(hh, 'parent', pa + R.int(-4, 4), g2, R.pick(SURNAMES));
        const nk = R.int(1, 3);
        for (let i = 0; i < nk; i++) mk(hh, 'child', Math.max(5, R.int(5, Math.min(24, pa - 22))), randGender(), S);
        if (R.chance(0.3)) mk(hh, 'grandparent', R.int(66, 88), R.chance(0.5) ? '남' : '여', S);
      } else if (kind === 'couple') {
        const a = R.int(24, 60);
        const g1 = R.chance(0.5) ? '남' : '여';
        mk(hh, 'spouse', a, g1, S);
        mk(hh, 'spouse', a + R.int(-5, 5), R.chance(0.9) ? (g1 === '남' ? '여' : '남') : g1, R.pick(SURNAMES));
      } else if (kind === 'elderly') {
        const a = R.int(66, 85);
        mk(hh, 'spouse', a, '남', S); mk(hh, 'spouse', a + R.int(-4, 3), '여', R.pick(SURNAMES));
      } else if (kind === 'roommates') {
        const n = R.int(2, 3);
        for (let i = 0; i < n; i++) mk(hh, 'roommate', R.int(20, 32), randGender(), R.pick(SURNAMES));
      } else {
        mk(hh, 'single', R.chance(0.15) ? R.int(66, 85) : R.int(22, 60), randGender(), S);
      }
      households.push(hh);
      return hh;
    };
    // 아파트 먼저 몇 가구씩, 그다음 주택
    const apartments = homes.filter((h) => h.type === 'apartment' || h.type === 'villa');
    const houses = homes.filter((h) => h.type === 'house');
    let hi = 0;
    while (people.length < POPULATION) {
      let progressed = false;
      if (hi < houses.length) {
        makeHousehold(houses[hi++], R.weighted(['family', 'couple', 'single', 'elderly', 'roommates'], (k) => ({ family: 4, couple: 2, single: 2, elderly: 1, roommates: 1 }[k])));
        progressed = true;
      }
      for (const a of apartments) {
        if (people.length >= POPULATION) break;
        if (households.filter((h) => h.home === a).length < (a.type === 'villa' ? 3 : 7)) {
          makeHousehold(a, R.weighted(['single', 'couple', 'family', 'roommates'], (k) => ({ single: 4, couple: 2, family: 2, roommates: 1 }[k])));
          progressed = true;
        }
      }
      if (!progressed) break;
    }
    while (people.length > POPULATION) {
      const p = people.pop();
      p.household.members = p.household.members.filter((m) => m !== p);
    }

    // 이름 & 성격
    const usedNames = new Set();
    for (const p of people) {
      let given, name, tries = 0;
      do {
        const list = p.gender === '논바이너리' ? NAMES_N : p.age >= 65 ? (p.gender === '남' ? OLD_M : OLD_F) : p.gender === '남' ? NAMES_M : NAMES_F;
        given = R.pick(list);
        name = p.surname + given;
        tries++;
      } while (usedNames.has(name) && tries < 30);
      usedNames.add(name);
      p.name = name;
      p.personality = R.pick(PERSONALITIES);
      p.socialRole = R.pick(SOCIAL_ROLES);
      p.hobby = R.pick(HOBBIES);
      p.worry = R.pick(WORRIES);
      p.dream = R.pick(DREAMS);
      p.color = R.pick(BODY_COLORS);
      p.lashes = p.gender === '여' && R.chance(0.7);
      p.mustache = p.gender === '남' && p.age > 35 && R.chance(0.25);
      if (R.chance(0.2)) p.extraAcc = R.pick(['bow:#ff80ab', 'bow:#80d8ff', 'scarf:#ffcc80', 'scarf:#b39ddb', 'beret:#ef9a9a', 'sunglasses']);
      p.affinity = R.int(25, 50);
    }

    // 직업 배정
    const byType = this.city.byType;
    const workerCount = new Map();
    const pickWork = (type) => {
      const list = (byType[type] || []).filter((b) => !b.outer);
      if (!list.length) return null;
      let best = list[0];
      for (const b of list) if ((workerCount.get(b) || 0) < (workerCount.get(best) || 0)) best = b;
      workerCount.set(best, (workerCount.get(best) || 0) + 1);
      return best;
    };
    const adults = [];
    for (const p of people) {
      if (p.age < 8) p.job = SPECIAL_JOBS.kindergartener;
      else if (p.age < 19) p.job = SPECIAL_JOBS.student;
      else if (p.age < 25 && R.chance(0.45)) p.job = SPECIAL_JOBS.univ_student;
      else if (p.age >= 65 && R.chance(0.75)) p.job = SPECIAL_JOBS.retired;
      else adults.push(p);
    }
    R.shuffle(adults);
    // 필수 슬롯: 모든 직업 1명씩 + 모든 일터 1명씩
    const slots = [];
    for (const j of JOBS) slots.push(j);
    for (const t of Object.keys(byType)) {
      if (t === 'house' || t === 'apartment' || t === 'villa') continue;
      const primary = JOBS.filter((j) => j.building === t);
      if (!primary.length) continue;
      for (let i = 1; i < byType[t].length; i++) slots.push(primary[i % primary.length]);
    }
    const count = {};
    for (const p of adults) {
      let job = slots.shift();
      if (!job) {
        if (R.chance(0.06)) job = SPECIAL_JOBS.jobseeker;
        else if (R.chance(0.05) && p.household.members.some((m) => m.age < 13)) job = SPECIAL_JOBS.homemaker;
        else job = R.weighted(JOBS.filter((j) => !j.max || (count[j.id] || 0) < j.max), (j) => (j.wage < 30 ? 3 : 1.5));
      }
      count[job.id] = (count[job.id] || 0) + 1;
      p.job = job;
    }
    // 시민 객체 생성
    for (const p of people) {
      const work = p.job.building ? (p.job.building === 'park' ? pickWork('park') : this.nearestOfType(p.job.building, p.home, pickWork)) : null;
      const c = new Citizen({
        id: this.citizens.length, name: p.name, age: p.age, gender: p.gender, job: p.job, personality: p.personality,
        socialRole: p.socialRole, familyRole: p.familyRole, hobby: p.hobby, worry: p.worry, dream: p.dream,
        color: p.color, lashes: p.lashes, mustache: p.mustache, extraAcc: p.extraAcc, affinity: p.affinity,
        home: p.home, work, household: p.household, sim: this,
      });
      p.citizen = c;
      // 일정
      const j = p.job;
      if (j.hours) {
        let [s, e] = j.hours;
        if (j.night && R.chance(j.night)) { s = 22; e = 6; }
        else { const sh = R.int(-1, 1) * 0.5; s += sh; e += sh; }
        c.shift = [s, e];
      }
      if (c.shift && c.shift[0] >= 20) c.sleep = [8, 15];
      else if (p.age < 13) c.sleep = [21, 7];
      else if (p.age >= 65) c.sleep = [21 + R.next(), 5.5 + R.next()];
      else {
        const wake = Math.min(c.shift ? c.shift[0] - 1 : 8, 5.5 + R.next() * 2.5);
        c.sleep = [22 + R.next() * 2 >= 24 ? 23.9 : 22 + R.next() * 2, Math.max(4.5, wake)];
      }
      c.walkSpeed = p.age < 13 ? 3.8 : p.age >= 70 ? 2.4 : R.range(3.1, 4.1);
      c.laneOff = R.range(-0.2, 0.9);
      this.citizens.push(c);
      c.home.residents.push(c);
      if (c.work) c.work.workers.push(c);
    }
    // 관계
    const byId = (p) => p.citizen;
    for (const hh of households) {
      for (const a of hh.members) for (const b of hh.members) {
        if (a === b) continue;
        let label = '가족';
        const A = byId(a), B = byId(b);
        if (a.familyRole === 'spouse' || (a.familyRole === 'parent' && b.familyRole === 'parent')) label = '배우자';
        else if (a.familyRole === 'parent' && b.familyRole === 'child') label = b.gender === '남' ? '아들' : b.gender === '여' ? '딸' : '자녀';
        else if (a.familyRole === 'child' && b.familyRole === 'parent') label = b.gender === '남' ? '아빠' : b.gender === '여' ? '엄마' : '부모님';
        else if (a.familyRole === 'child' && b.familyRole === 'child') label = '형제자매';
        else if (b.familyRole === 'grandparent') label = a.familyRole === 'child' ? (b.gender === '남' ? '할아버지' : '할머니') : '부모님(어르신)';
        else if (a.familyRole === 'grandparent') label = b.familyRole === 'child' ? '손주' : '자녀 내외';
        else if (a.familyRole === 'roommate') label = '룸메이트';
        A.relations.set(B.id, { type: 'family', label });
      }
    }
    for (const c of this.citizens) {
      if (c.work) for (const o of c.work.workers) if (o !== c && c.relations.size < 12 && !c.relations.has(o.id)) c.relations.set(o.id, { type: 'coworker', label: '직장 동료' });
      const nf = R.int(1, 3);
      for (let i = 0; i < nf; i++) {
        const o = R.pick(this.citizens);
        if (o === c || c.relations.has(o.id) || Math.abs(o.age - c.age) > 15) continue;
        const label = R.chance(0.12) && c.age > 18 && o.age > 18 ? '짝사랑 상대' : R.chance(0.15) ? '라이벌' : '친구';
        c.relations.set(o.id, { type: 'friend', label });
        if (!o.relations.has(c.id)) o.relations.set(c.id, { type: 'friend', label: label === '짝사랑 상대' ? '친구' : label });
      }
    }
    // 가족 역할 텍스트
    for (const c of this.citizens) {
      const g = c.gender;
      c.familyText = {
        parent: g === '남' ? '아빠' : g === '여' ? '엄마' : '부모', child: g === '남' ? '아들' : g === '여' ? '딸' : '자녀',
        grandparent: g === '남' ? '할아버지' : g === '여' ? '할머니' : '조부모', spouse: '배우자', roommate: '룸메이트', single: '1인 가구',
      }[c.familyRole];
    }
    // 주택 이름: 가장(첫 구성원) 성씨로
    for (const h of this.city.buildings) {
      if (h.type === 'house' && !reserved.includes(h)) h.name = h.residents.length ? `${h.residents[0].name[0]}씨네 집` : '빈 집 (매물)';
      if (h.type === 'apartment' || h.type === 'villa') h.npcHouseholds = households.filter((x) => x.home === h).length;
    }
    return this.citizens;
  }

  nearestOfType(type, from, pickWork) {
    void from;
    return pickWork(type);
  }

  // ---------------- 일정 판단 ----------------
  desire(c, m) {
    const h = (m % 1440) / 60;
    const day = Math.floor(m / 1440) % 7;
    const weekend = day >= 5;
    if (c.mode === 'player') return c.plan;
    if (c.hp < c.maxHp * 0.35) {
      if (c.plan?.heal && c.plan.until > m) return c.plan;
      const b = this.leisureAt(c, 'hospital', m + 120); b.heal = true; return b;
    }
    if (c.report && this.city.byType.police?.length) {
      if (c.plan?.kind === 'report') return c.plan;
      const b = this.leisureAt(c, 'police', m + 240); b.kind = 'report'; return b;
    }
    if (inHours(h, c.sleep) || c.needs.energy < 12) return { kind: 'sleep', building: c.home };
    if (c.work && c.shift && inHours(h, c.shift) && !(weekend && WEEKDAY_ONLY.has(c.work.type))) {
      if (c.job.mobile) {
        if (c.plan && (c.plan.kind === 'patrol' || c.plan.kind === 'work') && c.plan.until > m) return c.plan;
        if (this.rng.chance(c.job.mobile)) return { kind: 'patrol', building: null, until: m + this.rng.range(60, 120) };
        return { kind: 'work', building: c.work, until: m + this.rng.range(30, 60) };
      }
      return { kind: 'work', building: c.work };
    }
    // 급한 욕구부터 해결
    const N = c.needs;
    if (N.hunger < 25 && !(c.plan?.meal && c.plan.until > m)) {
      const p = this.chooseMeal(c, m); p.meal = true; return p;
    }
    if (N.hygiene < 20 && c.plan?.building !== c.home) return { kind: 'leisure', building: c.home, until: m + 60 };
    if (c.plan && c.plan.kind === 'leisure' && c.plan.until > m) return c.plan;
    if (c.plan && c.plan.kind === 'wander' && c.plan.until > m) return c.plan;
    if (N.fun < 25) {
      const t = this.rng.pick(c.personality.likes.filter((x) => FUN_TYPES.has(x)).concat(['park', 'cinema']));
      return this.leisureAt(c, t, m + this.rng.range(60, 120));
    }
    return this.chooseLeisure(c, m, h);
  }

  chooseLeisure(c, m, h) {
    const R = this.rng;
    const until = m + R.range(40, 140);
    const late = h >= 21 || h < 6;
    const meal = (h >= 7 && h < 8.5) || (h >= 12 && h < 13.5) || (h >= 18 && h < 20);
    if (late) {
      if (R.chance(c.personality.id === 'rebel' || (c.age >= 19 && c.age < 35) ? 0.3 : 0.08)) return this.leisureAt(c, R.pick(['convenience', 'cinema', 'concerthall', 'club', 'club']), until);
      return { kind: 'leisure', building: c.home, until };
    }
    if (meal && R.chance(0.55)) {
      if (R.chance(0.3)) return { kind: 'leisure', building: c.home, until };
      return this.leisureAt(c, R.pick(MEAL_TYPES), until);
    }
    const opts = [
      ['home', 3], ['park', 2.2], ['wander', 1.6 * c.personality.social], ['friend', 0.8 * c.personality.social],
      ...LEISURE_TYPES.map((t) => [t, c.personality.likes.includes(t) ? 3 : t === 'hospital' ? 0.15 : 0.5]),
    ];
    if (c.age < 13) opts.push(['park', 4]);
    if (c.age >= 65) opts.push(['park', 2], ['hospital', 0.4], ['library', 1]);
    if (c.job.id === 'jobseeker') opts.push(['library', 3], ['cityhall', 2]);
    const [kind] = R.weighted(opts, (o) => o[1]);
    if (kind === 'home') return { kind: 'leisure', building: c.home, until };
    if (kind === 'wander') return { kind: 'wander', building: null, until: m + R.range(20, 60) };
    if (kind === 'friend') {
      const friends = [...c.relations.entries()].filter(([, r]) => r.type === 'friend').map(([id]) => this.citizens[id]);
      if (friends.length) return { kind: 'leisure', building: R.pick(friends).home, until, visit: true };
      return { kind: 'leisure', building: c.home, until };
    }
    return this.leisureAt(c, kind, until);
  }

  chooseMeal(c, m) {
    if (this.rng.chance(0.25)) return { kind: 'leisure', building: c.home, until: m + 50 };
    return this.leisureAt(c, this.rng.pick(['restaurant', 'pizza', 'chicken', 'chinese', 'gukbap', 'burger', 'bunsik', 'cafe', 'bakery', 'convenience']), m + 50);
  }

  leisureAt(c, type, until) {
    const list = (this.city.byType[type] || []).filter((b) => !b.outer);
    if (!list.length) return { kind: 'leisure', building: c.home, until };
    const from = c.location ? c.location.door : c.pos;
    const b = this.rng.weighted(list, (x) => 1 / (20 + x.door.distanceTo(from)));
    return { kind: 'leisure', building: b, until };
  }

  // ---------------- 이동 ----------------
  startRoute(c, target) {
    let start, stype;
    const path = [];
    if (c.location && c.mode === 'inside') {
      c.pos.copy(c.location.door);
      path.push(c.location.walk.clone());
      start = c.location.walk; stype = 'Z';
    } else if (c.mode === 'park' && c.location) {
      path.push(c.location.door.clone(), c.location.walk.clone());
      start = c.location.walk; stype = 'Z';
    } else {
      const nl = nearestLine(c.pos);
      path.push(nl.point.clone());
      start = nl.point; stype = nl.type;
    }
    let end, etype;
    if (target.walk) { end = target.walk; etype = 'Z'; } else { end = target.point; etype = target.type; }
    const route = lineRoute(start, stype, end, etype);
    for (let i = 0; i < route.length; i++) {
      const k = i === route.length - 1 && target.walk ? 0 : 0.5;
      route[i].x += c.laneOff * k;
      route[i].z += c.laneOff * k;
    }
    path.push(...route);
    if (target.walk) path.push(target.door.clone());
    c.path = path;
    c.dest = target.walk ? target : null;
    c.location = null;
    c.mode = 'walk';
    c.inside.state = 'none';
  }

  arrive(c) {
    const b = c.dest;
    c.path = [];
    if (!b) { c.mode = 'idle'; c.idleT = this.rng.range(3, 10); return; }
    c.location = b;
    c.dest = null;
    if (b.type === 'park') {
      c.mode = 'park';
      c.parkTarget = null; c.idleT = 0;
      return;
    }
    c.mode = 'inside';
    if (this.active.has(b.id)) this.enterActive(c, true);
  }

  // ---------------- 실내 (플레이어가 있는 건물만 자세히 시뮬레이션) ----------------
  activate(b) {
    if (this.active.has(b.id) || !this.interiorFor) return;
    const I = this.interiorFor(b);
    this.active.set(b.id, I);
    const used = new Set();
    for (const c of this.citizens) if (c.location === b && (c.mode === 'inside' || c.mode === 'player')) this.enterActive(c, false, used);
  }
  deactivate(b) {
    this.active.delete(b.id);
    for (const c of this.citizens) if (c.location === b) c.inside = { state: 'none', target: null, spot: null };
  }

  enterActive(c, walkIn, used) {
    const I = this.active.get(c.location.id);
    if (!I) return;
    let spot;
    if (c.plan?.kind === 'work' && c.work === I.building && c.job.wage > 0) {
      const i = I.building.workers.filter((w) => w.job.wage > 0).indexOf(c);
      spot = I.workSpots[Math.max(0, i) % I.workSpots.length];
    } else {
      const free = I.visitSpots.filter((s) => !used || !used.has(s));
      spot = this.rng.pick(free.length ? free : I.visitSpots);
      used?.add(spot);
    }
    c.inside = { state: walkIn ? 'moving' : 'at', spot, target: spot.p.clone(), wanderT: this.rng.range(8, 25) };
    if (walkIn) c.ipos.copy(I.entry); else c.ipos.copy(spot.p);
    c.heading = spot.face;
  }

  // ---------------- 시간 건너뛰기 후 정리 ----------------
  resolveAll(m, scatter = 0.3) {
    for (const c of this.citizens) {
      if (c.mode === 'player' || c.mode === 'chat' || COMBAT.has(c.mode)) continue;
      const d = this.desire(c, m);
      c.plan = d;
      c.path = [];
      if (d.building && d.kind !== 'sleep' && this.rng.chance(scatter)) {
        const sp = randomStreetPoint(this.rng);
        c.location = null; c.mode = 'idle'; c.pos.copy(sp.point);
        this.startRoute(c, d.building);
        continue;
      }
      if (d.building) {
        c.location = d.building;
        c.mode = d.building.type === 'park' ? 'park' : 'inside';
        c.pos.copy(d.building.door);
        if (c.mode === 'park') c.pos.set(d.building.x + this.rng.range(-12, 12), 0.12, d.building.z + this.rng.range(-12, 12));
      } else {
        const sp = randomStreetPoint(this.rng);
        c.location = null; c.mode = 'idle'; c.idleT = this.rng.range(1, 5);
        c.pos.copy(sp.point);
      }
      c.inside = { state: 'none', target: null, spot: null };
    }
    for (const id of [...this.active.keys()]) {
      const I = this.active.get(id);
      this.active.delete(id);
      this.activate(I.building);
    }
  }

  // ---------------- 매 틱 ----------------
  // ctx.players: [{ id, name, pos, loc }]  (loc: 건물 id 또는 -1)
  update(dt, m, ctx) {
    const R = this.rng;
    this.encounterT -= dt;
    const streetPlayers = ctx.players.filter((p) => p.loc < 0);
    const gm = this.lastM === undefined ? 0 : Math.max(0, Math.min(30, m - this.lastM));
    this.lastM = m;

    for (const c of this.citizens) {
      if (c.bubble) { c.bubble.t -= dt; if (c.bubble.t <= 0) c.bubble = null; }
      c.chatCooldown -= dt;
      c.thoughtCooldown -= dt;
      if (gm > 0) this.updateNeeds(c, gm);
      // 신고하기로 마음먹으면 잠시 뒤 휴대폰으로 112에 전화 (죽어 있으면 깨어난 뒤)
      if (c.report && c.mode !== 'dead') {
        c.reportCallT = (c.reportCallT ?? 4 + R.next() * 5) - dt;
        if (c.reportCallT <= 0) {
          const rep = c.report;
          c.report = null; c.reportCallT = undefined;
          if (c.grudges[rep.token]) c.grudges[rep.token].pts = 15;
          c.say(R.pick(['📱 여보세요, 112죠? 신고할게요!', '📱 경찰이죠? 여기 이상한 바퀴가 있어요!', '📱 112! 빨리 와주세요!']), 3);
          this.onReport?.(c, rep);
          this.adjustMood(c, 12, '경찰에 신고하고 나니 속이 좀 풀림');
          if (c.plan?.kind === 'report') { c.plan = null; c.replanT = 0; }
        }
      }

      if (COMBAT.has(c.mode)) { c.moving = this.updateCombat(c, dt, ctx); continue; }

      if (c.mode !== 'player' && c.mode !== 'chat') {
        c.replanT = (c.replanT || 0) - dt;
        if (c.replanT <= 0) {
          c.replanT = 1 + R.next();
          const d = this.desire(c, m);
          const changed = !c.plan || d.kind !== c.plan.kind || d.building !== c.plan.building;
          c.plan = d;
          if (changed || (d.building && c.location !== d.building && c.mode !== 'walk') || (d.building && c.mode === 'walk' && c.dest !== d.building)) this.pursue(c);
          else if (!d.building && (c.mode === 'inside' || c.mode === 'park') && c.location) this.pursue(c);
        }
      }

      let moving = 0;
      if (c.mode === 'walk') {
        moving = this.followPath(c, dt, c.walkSpeed);
        if (!c.path.length) this.arrive(c);
      } else if (c.mode === 'idle') {
        c.idleT -= dt;
        if (c.idleT <= 0) {
          if (c.plan?.kind === 'wander' || c.plan?.kind === 'patrol') this.startRoute(c, randomStreetPoint(R));
          else this.pursue(c);
        }
      } else if (c.mode === 'park') {
        if (c.parkTarget) {
          moving = this.moveTo(c, c.pos, c.parkTarget, dt, c.walkSpeed * 0.7);
          if (moving === 0) { c.parkTarget = null; c.idleT = R.range(4, 14); }
        } else {
          c.idleT -= dt;
          if (c.idleT <= 0) {
            const b = c.location;
            const p = new THREE.Vector3(b.x + R.range(-15, 15), 0, b.z + R.range(-15, 15));
            if (Math.hypot(p.x - b.x, p.z - b.z) < 4) p.x += 5;
            c.parkTarget = p;
          }
        }
      } else if (c.mode === 'inside' && c.location && this.active.has(c.location.id)) {
        moving = this.updateInside(c, dt, R);
      } else if (c.mode === 'chat') {
        c.chatT -= dt;
        if (c.chatT <= 0) this.endChat(c);
      }
      c.moving = moving;

      // 플레이어 근처에서 혼잣말
      if (c.thoughtCooldown <= 0 && !c.bubble && c.mode !== 'player' && c.mode !== 'chat') {
        c.thoughtCooldown = 25 + R.next() * 50;
        if (this.nearPlayer(c, ctx.players, 30)) {
          const sleeping = c.mode === 'inside' && c.plan?.kind === 'sleep';
          c.say(sleeping ? '💤' : this.thought(c, m), 3.5);
        }
      }
    }

    if (this.encounterT <= 0) {
      this.encounterT = 0.5;
      this.checkEncounters(streetPlayers);
    }
    this.updateChats(dt);
  }

  // ---------------- 욕구 ----------------
  updateNeeds(c, gm) {
    const N = c.needs;
    const inside = c.mode === 'inside' && c.location;
    const t = inside ? c.location.type : null;
    const sleeping = inside && c.location === c.home && c.plan?.kind === 'sleep';
    N.hunger -= 4.5 * gm / 60;
    N.fun -= 3 * gm / 60;
    N.social -= 2.5 * gm / 60;
    N.hygiene -= 2 * gm / 60;
    if (!sleeping) N.energy -= 3.2 * gm / 60;
    if (sleeping) N.energy += 14 * gm / 60;
    if (inside && FOOD_TYPES.has(t)) N.hunger += 70 * gm / 60;
    if (inside && c.location === c.home) { N.hunger += 25 * gm / 60; N.hygiene += 40 * gm / 60; }
    if ((inside && FUN_TYPES.has(t)) || c.mode === 'park') N.fun += 40 * gm / 60;
    if (c.mode === 'chat' || c.mode === 'player') N.social += 90 * gm / 60;
    if (inside && t !== 'house' && t !== 'apartment' && t !== 'villa') N.social += 6 * gm / 60;
    if (inside && (t === 'gym' || t === 'salon')) N.hygiene += 30 * gm / 60;
    if (inside && c.plan?.kind === 'work') N.fun -= 1.5 * gm / 60;
    for (const k of NEED_KEYS) N[k] = Math.max(0, Math.min(100, N[k]));
    if (c.mode !== 'dead') c.hp = Math.min(c.maxHp, c.hp + (inside && t === 'hospital' ? 90 : 4) * gm / 60);
    // 좋아하는 곳에 있으면 기분이 좋아진다
    if (inside && c.personality.likes.includes(t)) this.adjustMood(c, 6 * gm / 60);
    this.updateMood(c, gm);
    // 신고 도착
    if (c.report && c.plan?.kind === 'report' && inside && t === 'police') {
      const rep = c.report;
      c.report = null;
      if (c.grudges[rep.token]) c.grudges[rep.token].pts = 15;
      this.onReport?.(c, rep);
      this.adjustMood(c, 12, '경찰에 신고하고 나니 속이 좀 풀림');
      c.plan = null; c.replanT = 0;
    }
  }

  // ---------------- 기분 ----------------
  updateMood(c, gm) {
    const N = c.needs, s = c.trait.sens;
    let base = 66;
    for (const k of NEED_KEYS) if (N[k] < 40) base -= (40 - N[k]) * 0.45 * s;
    if (c.hp < c.maxHp * 0.6) base -= (1 - c.hp / (c.maxHp * 0.6)) * 25 * s;
    // 사건의 여운은 성격에 따라 서서히 사라진다
    const fade = 14 * c.trait.resil * gm / 60;
    c.moodEvent = c.moodEvent > 0 ? Math.max(0, c.moodEvent - fade) : Math.min(0, c.moodEvent + fade);
    c.mood = Math.max(0, Math.min(100, base + c.moodEvent));
    for (const g of Object.values(c.grudges)) g.pts = Math.max(0, g.pts - 4 * gm / 60);
    c.moodReasons = c.moodReasons.filter((r) => this.lastM - r.m < 240);
  }

  adjustMood(c, delta, reason) {
    if (delta < 0) delta *= c.trait.sens;
    c.moodEvent = Math.max(-80, Math.min(40, c.moodEvent + delta));
    c.mood = Math.max(0, Math.min(100, c.mood + delta));
    if (reason) { c.moodReasons.push({ text: reason, m: this.lastM ?? 0 }); if (c.moodReasons.length > 5) c.moodReasons.shift(); }
  }

  // 특정 플레이어에 대한 원한이 쌓이면 경찰에 신고하러 간다
  addGrudge(c, who, pts, reason) {
    if (!who?.token) return;
    const g = (c.grudges[who.token] ||= { name: who.name, pts: 0 });
    g.name = who.name; g.pts = Math.min(150, g.pts + pts * c.trait.sens);
    if (!c.report && g.pts >= 50 && this.rng.chance(Math.min(1, c.trait.report * (g.pts / 70)))) {
      c.report = { token: who.token, name: who.name, reason };
      c.replanT = 0;
      if (c.mode !== 'dead') c.say(this.rng.pick([`${who.name}... 경찰에 신고할 거야! 🚔`, '더는 못 참아. 경찰서 간다!', '이건 신고감이야 😤']), 3);
    }
  }

  // ---------------- 전투 ----------------
  // attacker: { id, name, pos, loc }
  damage(c, amount, attacker) {
    if (c.mode === 'dead') return { died: false, ignored: true };
    if (c.mode === 'player') this.onTalkInterrupted?.(c);
    if (c.mode === 'chat' && c.chatWith) this.endChat(c.chatWith);
    c.hp -= amount;
    this.emit({ t: 'hurt', id: c.id });
    if (attacker) {
      this.adjustMood(c, c.hp <= 0 ? -50 : -25, `${attacker.name}에게 맞음`);
      this.addGrudge(c, attacker, c.hp <= 0 ? 100 : 40, c.hp <= 0 ? '살인' : '폭행');
    }
    if (c.hp <= 0) {
      c.hp = 0;
      c.mode = 'dead'; c.deadT = 7; c.path = []; c.talkingTo = null;
      c.say('으윽... 💫', 3);
      this.emit({ t: 'die', id: c.id });
      return { died: true };
    }
    const brave = AGGRESSIVE.has(c.personality.id) && c.age >= 16 && c.age < 66 && c.hp > c.maxHp * 0.4;
    if (attacker && brave && this.rng.chance(0.75)) {
      c.mode = 'fight'; c.fightT = 15; c.target = attacker.id; c.punchT = 0.6;
      c.emote('angry', 4);
      c.say(this.rng.pick(['덤벼!! 😠', '감히 날 때려?!', '가만 안 둬!! 💢', '한 판 붙자!']), 2.5);
    } else this.flee(c, attacker ? attacker.pos : c.pos, true);
    return { died: false };
  }

  flee(c, from, scream) {
    if (c.mode === 'dead' || c.mode === 'fight') return;
    if (c.mode === 'chat' && c.chatWith) this.endChat(c.chatWith);
    c.prevLoc = c.location;
    c.mode = 'flee'; c.fleeT = this.rng.range(7, 11); c.fleeFrom = from.clone ? from.clone() : new THREE.Vector3(from.x, 0, from.z);
    if (c.location?.type === 'park') c.location = null; // 공원에서는 거리로 달아난다
    const inBuilding = c.location && c.location.type !== 'park' && this.active.has(c.location.id);
    c.fleeExit = inBuilding ? this.active.get(c.location.id).exit.clone() : null;
    if (!inBuilding) this.fleeRoute(c, c.fleeFrom);
    if (!scream || c.hp >= c.maxHp) this.adjustMood(c, -12, '무서운 폭력 장면을 목격함');
    c.emote('scared', 4);
    if (scream) c.say(this.rng.pick(['살려주세요!! 😱', '으악! 경찰 불러요!!', '도망쳐!!! 🏃', '꺄아악!']), 2.5);
  }

  updateCombat(c, dt, ctx) {
    const inside = c.location && c.location.type !== 'park' && this.active.has(c.location.id);
    const pos = inside ? c.ipos : c.pos;
    if (c.mode === 'dead') {
      c.deadT -= dt;
      if (c.deadT <= 0) this.revive(c);
      return 0;
    }
    if (c.mode === 'flee') {
      c.fleeT -= dt;
      const sp = 7.5;
      if (inside) {
        // 건물 안: 출입문으로 달려 나가서 거리로 도망
        const moving = this.moveTo(c, c.ipos, c.fleeExit || this.active.get(c.location.id).exit, dt, sp);
        if (!moving) {
          const b = c.location;
          c.location = null;
          c.pos.copy(b.door);
          c.inside = { state: 'none', target: null, spot: null };
          this.fleeRoute(c, b.door);
          c.fleeT = Math.max(c.fleeT, 5);
        }
        return sp;
      }
      // 거리: 보도를 따라 달아나고, 혹시라도 벽에 닿으면 밀어낸다
      const moved = c.path.length ? this.followPath(c, dt, sp) : 0;
      if (!moved) {
        const dx = c.pos.x - c.fleeFrom.x, dz = c.pos.z - c.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
        c.pos.x += (dx / d) * sp * dt; c.pos.z += (dz / d) * sp * dt;
        c.heading = Math.atan2(dx, dz);
      }
      if (c.location?.type !== 'park') this.pushOut(c.pos);
      c.pos.x = clampL(c.pos.x); c.pos.z = clampL(c.pos.z);
      if (c.fleeT <= 0) { c.path = []; this.calm(c); }
      return sp;
    }
    // fight
    c.fightT -= dt;
    const tgt = ctx.players.find((p) => p.id === c.target);
    const tgtLoc = c.location && c.mode !== 'park' && inside ? c.location.id : -1;
    if (!tgt || tgt.dead || c.fightT <= 0 || tgt.loc !== tgtLoc) { this.calm(c); return 0; }
    const dx = tgt.pos.x - pos.x, dz = tgt.pos.z - pos.z, d = Math.hypot(dx, dz);
    c.heading = Math.atan2(dx, dz);
    if (d > 1.4) {
      const st = Math.min(d - 1.2, 5.5 * dt); pos.x += (dx / d) * st; pos.z += (dz / d) * st;
      if (!inside && c.location?.type !== 'park') this.pushOut(pos);
      return 5.5;
    }
    c.punchT -= dt;
    if (c.punchT <= 0) {
      c.punchT = 1.1;
      this.emit({ t: 'punch', id: c.id });
      this.onNpcAttack?.(c, tgt.id, (c.age < 13 ? 2 : 6) * (1 + (c.level - 1) * 0.04));
    }
    return 0;
  }

  calm(c) {
    const inside = c.location && c.location.type !== 'park' && this.active.has(c.location.id);
    c.mode = c.location ? (c.location.type === 'park' ? 'park' : 'inside') : 'idle';
    c.idleT = 1; c.replanT = 0; c.target = null;
    if (inside) { c.inside.state = 'none'; }
    if (c.mode === 'inside' && !inside) c.pos.copy(c.location.door);
  }

  revive(c) {
    c.hp = c.maxHp;
    c.needs.hunger = Math.max(c.needs.hunger, 60); c.needs.energy = Math.max(c.needs.energy, 60);
    c.location = c.home; c.mode = 'inside'; c.path = []; c.dest = null; c.plan = null; c.replanT = 3;
    c.pos.copy(c.home.door);
    c.inside = { state: 'none', target: null, spot: null };
    if (this.active.has(c.home.id)) this.enterActive(c, true);
    this.emit({ t: 'revive', id: c.id });
  }

  nearPlayer(c, players, r) {
    for (const p of players) {
      if (c.location && c.mode === 'inside') {
        if (p.loc === c.location.id) return true;
      } else if (p.loc < 0 && Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) < r) return true;
    }
    return false;
  }

  pursue(c) {
    const d = c.plan;
    if (!d) return;
    if (c.mode === 'player' || c.mode === 'chat') return;
    if (c.mode === 'inside' && c.location && this.active.has(c.location.id)) {
      if (d.building === c.location) return;
      if (c.inside.state !== 'leaving') { c.inside.state = 'leaving'; c.inside.target = this.active.get(c.location.id).exit.clone(); }
      return;
    }
    if (d.building) {
      if (c.location === d.building && (c.mode === 'inside' || c.mode === 'park')) return;
      if (c.mode === 'walk' && c.dest === d.building) return;
      this.startRoute(c, d.building);
    } else {
      if (c.mode === 'walk' && !c.dest) return;
      this.startRoute(c, randomStreetPoint(this.rng));
    }
  }

  updateInside(c, dt, R) {
    const s = c.inside;
    const I = this.active.get(c.location.id);
    let moving = 0;
    if (s.state === 'moving' || s.state === 'leaving' || s.state === 'wander') {
      moving = this.moveTo(c, c.ipos, s.target, dt, 2.6);
      if (moving === 0) {
        if (s.state === 'leaving') {
          s.state = 'none';
          const d = c.plan;
          if (d.building && d.building !== c.location) this.startRoute(c, d.building);
          else this.startRoute(c, randomStreetPoint(R));
          return 0;
        }
        s.state = 'at';
        c.heading = s.spot?.face ?? c.heading;
        s.wanderT = R.range(8, 25);
      }
    } else if (s.state === 'at') {
      s.wanderT -= dt;
      if (s.wanderT <= 0 && c.plan?.kind !== 'work' && c.plan?.kind !== 'sleep') {
        const spot = R.pick(I.visitSpots);
        s.spot = spot; s.target = spot.p.clone(); s.state = 'wander';
      } else if (s.wanderT <= 0) s.wanderT = R.range(8, 25);
    } else if (s.state === 'none') {
      this.enterActive(c, false);
    }
    return moving;
  }

  moveTo(c, pos, target, dt, speed) {
    const dx = target.x - pos.x, dz = target.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) { pos.x = target.x; pos.z = target.z; return 0; }
    const step = Math.min(d, speed * dt);
    pos.x += (dx / d) * step; pos.z += (dz / d) * step;
    c.heading = Math.atan2(dx, dz);
    return speed;
  }

  followPath(c, dt, speed) {
    if (c.slowT > 0) { c.slowT -= dt; speed *= 0.35; } // 얼음 마법
    let budget = speed * dt;
    let moved = false;
    while (budget > 0 && c.path.length) {
      const target = c.path[0];
      const dx = target.x - c.pos.x, dz = target.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= budget) { c.pos.x = target.x; c.pos.z = target.z; budget -= d; c.path.shift(); moved = true; }
      else {
        c.pos.x += (dx / d) * budget; c.pos.z += (dz / d) * budget;
        c.heading = Math.atan2(dx, dz);
        budget = 0; moved = true;
      }
    }
    return moved ? speed : 0;
  }

  // ---------------- 거리 대화 ----------------
  checkEncounters(streetPlayers) {
    const R = this.rng;
    const cand = this.citizens.filter((c) => (c.mode === 'walk' || c.mode === 'idle' || c.mode === 'park') && c.chatCooldown <= 0 && c.hp > 0);
    for (let i = 0; i < cand.length; i++) {
      const a = cand[i];
      if (a.mode === 'chat') continue;
      for (let j = i + 1; j < cand.length; j++) {
        const b = cand[j];
        if (b.mode === 'chat') continue;
        const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
        if (d > 2.4) continue;
        const rel = a.relationTo(b);
        const p = rel ? (rel.type === 'family' ? 0.5 : rel.type === 'friend' ? 0.6 : 0.35) : 0.07 * a.personality.social * b.personality.social;
        a.chatCooldown = b.chatCooldown = 20 + R.next() * 20;
        if (R.chance(p)) { this.startChat(a, b, streetPlayers); break; }
      }
    }
  }

  startChat(a, b, streetPlayers) {
    const R = this.rng;
    const dur = R.range(7, 10);
    for (const [x, y] of [[a, b], [b, a]]) {
      x.prevMode = x.mode; x.mode = 'chat'; x.chatWith = y; x.chatT = dur;
      x.heading = Math.atan2(y.pos.x - x.pos.x, y.pos.z - x.pos.z);
    }
    a.wave();
    const fill = (s, other) => s.replace('{place}', R.pick(Object.values(BUILDING_TYPES)).name).replace('{job}', other.job.name).replace('{other}', R.pick(this.citizens).name.slice(1));
    const canned = [
      [a, R.pick(SMALL_TALK.greet)], [b, R.pick(SMALL_TALK.greet)],
      [a, fill(R.pick(SMALL_TALK.topic), b)], [b, R.pick(SMALL_TALK.reply)],
      [a, R.pick(SMALL_TALK.bye)],
    ];
    const timeline = { pairs: canned, i: 0, t: 0 };
    this.chatPairs.push({ a, b, timeline });
    const near = streetPlayers.some((p) => Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < 20);
    if (near && this.onStreetChat) {
      timeline.waiting = true; // LLM 응답을 잠깐 기다림
      this.onStreetChat(a, b).then((lines) => {
        timeline.waiting = false;
        if (!lines || a.mode !== 'chat' || a.chatWith !== b) return;
        timeline.pairs = lines.map((l) => [l.speaker === 'B' ? b : a, l.text]);
        timeline.i = 0; timeline.t = 0;
        a.chatT = b.chatT = Math.max(a.chatT, lines.length * 2.6 + 1);
      }).catch(() => { timeline.waiting = false; });
    }
  }

  updateChats(dt) {
    for (let k = this.chatPairs.length - 1; k >= 0; k--) {
      const cp = this.chatPairs[k];
      if (cp.a.mode !== 'chat' || cp.a.chatWith !== cp.b) { this.chatPairs.splice(k, 1); continue; }
      const tl = cp.timeline;
      tl.t -= dt;
      if (tl.waiting && tl.i === 0 && tl.t > -2) continue;
      if (tl.t <= 0 && tl.i < tl.pairs.length) {
        const [who, text] = tl.pairs[tl.i++];
        who.say(text, 2.8);
        tl.t = 2.4;
      }
    }
  }

  endChat(c) {
    if (c.chatWith) this.adjustMood(c, c.relationTo(c.chatWith) ? 6 : 3, `${c.chatWith.name}와(과) 수다`);
    c.mode = c.prevMode === 'park' ? 'park' : c.path.length ? 'walk' : 'idle';
    if (c.mode === 'idle') c.idleT = 0.5;
    c.chatWith = null;
    c.chatCooldown = 40 + Math.random() * 40;
    if (c.path.length) {
      const p = c.path[0];
      c.heading = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
    }
  }

  // ---------------- 플레이어 대화 ----------------
  beginPlayerTalk(c, player) {
    c.activityBeforeTalk = c.activityText();
    if (c.mode === 'chat' && c.chatWith) this.endChat(c.chatWith);
    c.prevMode = c.mode === 'chat' ? (c.path.length ? 'walk' : 'idle') : c.mode;
    c.mode = 'player';
    c.talkingTo = player.id;
    c.talkingName = player.name;
    const src = c.location && c.prevMode === 'inside' ? c.ipos : c.pos;
    c.heading = Math.atan2(player.pos.x - src.x, player.pos.z - src.z);
    c.wave();
  }

  endPlayerTalk(c) {
    if (c.mode !== 'player') return;
    const pm = c.prevMode;
    c.talkingTo = null;
    if (pm === 'inside') {
      c.mode = 'inside';
      if (c.location && this.active.has(c.location.id) && c.inside.state === 'none') this.enterActive(c, false);
    } else if (pm === 'park') c.mode = 'park';
    else if (c.path.length) c.mode = 'walk';
    else { c.mode = 'idle'; c.idleT = 1; }
    c.replanT = 0;
  }

  // 차에 치일 뻔한 시민: 재빨리 피한다
  dodge(c, from, who) {
    this.adjustMood(c, -10, '차에 치일 뻔함');
    if (who) this.addGrudge(c, who, 15, '난폭 운전');
    const dx = c.pos.x - from.x, dz = c.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    c.pos.x += (dx / d) * 2.5; c.pos.z += (dz / d) * 2.5;
    if (c.location?.type !== 'park') this.pushOut(c.pos);
    c.emote('scared', 2);
    this.emit({ t: 'jump', id: c.id });
    c.say(['으아악! 🚗💨', '깜짝이야!! 😱', '운전 똑바로 해요!! 😠', '휴, 6개 다리 아니었으면...'][Math.floor(Math.random() * 4)], 2.5);
  }

  thought(c, m) {
    const R = this.rng;
    const h = (m % 1440) / 60;
    const p = c.plan;
    if (c.age < 13) return R.pick(['학교 가기 싫어~ 😝', '놀이터 가자! 🛝', '배고파~ 🍪', '엄마 어디 있지?', '우와 저거 봐! ✨']);
    if (p?.kind === 'patrol') {
      return {
        police: R.pick(['수상한 사람은 없나... 👀', '이상 무! 🚓', '교통 법규를 지킵시다!']),
        mail_carrier: R.pick(['택배 왔습니다~ 📦', '오늘 배달할 편지가 산더미야 ✉️']),
        street_cleaner: R.pick(['깨끗한 거리, 행복한 젤리! 🧹', '사탕 껍질은 쓰레기통에!']),
        delivery: R.pick(['배달 갑니다~ 🛵', '따끈할 때 드세요! 🍜']),
        reporter: R.pick(['특종 냄새가 난다 📰', '인터뷰 좀 해주실 분~?']),
        youtuber: R.pick(['구독과 좋아요 부탁해요~ 📹', '오늘의 브이로그 시작!']),
      }[c.job.id] || '열일 중! 💪';
    }
    if (c.mode === 'walk' && p?.kind === 'work' && h < 11) return R.pick(['출근하기 싫다... 😪', '오늘도 화이팅! 💪', '지각이다 지각!! 🏃', '커피가 필요해 ☕']);
    if (c.mode === 'walk' && p?.building === c.home && h > 16) return R.pick(['퇴근이다~ 🎉', '오늘 저녁 뭐 먹지? 🍜', '집에 가서 쉬어야지 😌']);
    if (c.mood < 30) return R.pick(['오늘 기분 최악이야... 😞', '하아... 다 귀찮다', `${c.moodReasons.at(-1)?.text || '이것저것'} 때문에 속상해 😢`, '건드리지 마... 😤']);
    if (c.mood > 80 && R.chance(0.4)) return R.pick(['오늘 기분 최고! 😄', '랄라~ 행복해 🎶', '세상이 아름다워 보여 ✨']);
    if (h >= 21 || h < 5) return R.pick(['졸려... 😴', '밤공기 좋다 🌙', '야식 땡긴다... 🍗']);
    if (c.mode === 'park') return R.pick(['날씨 좋다 ☀️', '♪ 흥얼흥얼 ♪', '나뭇잎 냄새 좋아 🍃', '여기서 낮잠 자고 싶다']);
    return R.pick(['♪ 흥얼흥얼 ♪', '배고프다... 🍞', `${c.hobby} 하고 싶다~`, '오늘 운세 좋을 것 같아 🍀', `${c.worry.slice(0, 14)}...`]);
  }
}

// 플레이어 길 안내용: 현재 위치에서 건물(또는 지점)까지 보도를 따라가는 경로
// blockers: 건물 상자 목록 — 첫 구간이 건물을 가로지르지 않는 보도를 고른다
export function routeTo(from, target, blockers = []) {
  const cands = [];
  for (const x of X_LINES) cands.push({ point: new THREE.Vector3(x, 0, clampL(from.z)), type: 'X' });
  for (const z of Z_LINES) cands.push({ point: new THREE.Vector3(clampL(from.x), 0, z), type: 'Z' });
  cands.sort((a, b) => a.point.distanceTo(from) - b.point.distanceTo(from));
  const clear = (a, b) => !blockers.some((bx) => segHitsBox(a, b, bx));
  const nl = cands.slice(0, 6).find((c) => clear(from, c.point)) || cands[0];
  let pts = [nl.point.clone()];
  if (target.walk) {
    pts.push(...lineRoute(nl.point, nl.type, target.walk, 'Z'));
    pts.push(target.door.clone());
  } else {
    const tl = nearestLine(target.point);
    pts.push(...lineRoute(nl.point, nl.type, tl.point, tl.type));
    pts.push(target.point.clone());
  }
  // 겹치는 점과 일직선 위의 중간 점 정리
  pts = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.3);
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cross) > 0.5) out.push(b);
  }
  if (pts.length > 1) out.push(pts[pts.length - 1]);
  return out;
}

export function routeLength(from, pts) {
  let d = 0, p = from;
  for (const q of pts) { d += Math.hypot(q.x - p.x, q.z - p.z); p = q; }
  return d;
}

function segHitsBox(a, b, bx) {
  // 선분 a→b 와 (조금 줄인) 건물 상자의 교차 (slab)
  const m = 0.3, minX = bx.minX + m, maxX = bx.maxX - m, minZ = bx.minZ + m, maxZ = bx.maxZ - m;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [p, d, lo, hi] of [[a.x, dx, minX, maxX], [a.z, dz, minZ, maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let u0 = (lo - p) / d, u1 = (hi - p) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
