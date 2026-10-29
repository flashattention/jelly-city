import * as THREE from 'three';
import { BLOCK, ROAD, GRID, CITY, HALF, ASPHALT_HALF, WALK_OFF, roadC, blockMin, signalPhase } from './config.js';
import { BUILDING_TYPES, CITY_PLAN, CATEGORY_COLORS, isSuburbBlock } from './data.js';
import { toon, basic, box, cyl, sph, cone, G, signMesh, windowPlane, stripeMat, bakeStatic, RNG } from '../../shared/js/utils.js';
import { Roach } from '../../shared/js/roach.js';
import { makeCarMesh } from './traffic.js';
import { OUTER_BUILDINGS, terrainH } from './terrain.js';
import { Props, defineCommonProps } from './props.js';

const FH = 3.4; // 층 높이
const BASE = 0.12; // 블록/보도 윗면 높이
const PASTELS = ['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#ffadad', '#f7d6e0', '#e4c1f9', '#d0f4de', '#fcf6bd', '#ffe5d9', '#cde7f0'];
const ROOFS = ['#e76f51', '#f4a261', '#8d6e63', '#6d597a', '#457b9d', '#e5989b', '#b5838d', '#2a9d8f'];

function shade(hex, f) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * f));
  return '#' + c.getHexString();
}

// ------------------------------------------------------------------
// 1단계: 도시 배치 계획 (데이터만)
// ------------------------------------------------------------------
export function planCity(seed) {
  const rng = new RNG(seed);
  const buildings = [];
  const usedNames = {};
  const nameFor = (type) => {
    const list = BUILDING_TYPES[type].names;
    const i = usedNames[type] = (usedNames[type] ?? -1) + 1;
    const n = list[i % list.length];
    return i >= list.length ? `${n} ${Math.floor(i / list.length) + 1}호점` : n;
  };
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const x0 = blockMin(c), z0 = blockMin(r);
      const lots = [];
      for (const part of CITY_PLAN[r][c].split('|')) {
        const [kind, list] = part.split(':');
        const types = list.split(',');
        if (kind === 'B') lots.push({ size: 'B', type: types[0], x: x0 + BLOCK / 2, z: z0 + BLOCK / 2, dir: 1 });
        else if (kind === 'M') {
          const north = !lots.some((l) => l.zone === 'N');
          lots.push({ size: 'M', type: types[0], x: x0 + BLOCK / 2, z: z0 + (north ? BLOCK / 4 : BLOCK * 3 / 4), dir: north ? -1 : 1, zone: north ? 'N' : 'S' });
        } else {
          const hasNorth = lots.some((l) => l.zone === 'N');
          const quarters = hasNorth ? [[0, 1], [1, 1]] : [[0, 0], [1, 0], [0, 1], [1, 1]];
          types.forEach((t, k) => {
            const [qx, qz] = quarters[k];
            lots.push({ size: 'S', type: t, x: x0 + BLOCK / 4 + qx * BLOCK / 2, z: z0 + BLOCK / 4 + qz * BLOCK / 2, dir: qz === 0 ? -1 : 1, zone: qz === 0 ? 'N' : 'S' });
          });
        }
      }
      for (const lot of lots) {
        const b = makeBuilding(lot, r, c, rng);
        b.id = buildings.length;
        b.suburb = isSuburbBlock(r, c);
        b.name = nameFor(lot.type);
        buildings.push(b);
      }
    }
  }
  // 도시 밖 건물 (교도소, 사냥꾼 오두막, 휴게소...)
  for (const e of OUTER_BUILDINGS) {
    const def = BUILDING_TYPES[e.type];
    const door = new THREE.Vector3(e.x, 0.15, e.z + e.dir * (e.d / 2 + 0.9));
    const b = {
      type: e.type, def, size: e.w > 30 ? 'B' : 'S', cat: def.cat, row: -1, col: -1,
      x: e.x, z: e.z, w: e.w, d: e.d, floors: e.floors, dir: e.dir, door, walk: door.clone().add(new THREE.Vector3(0, 0, e.dir * 4)),
      lot: { x0: e.x - e.w / 2, z0: e.z - e.d / 2, x: e.x, z: e.z, size: 'S' }, residents: [], workers: [],
      seed: Math.floor(rng.next() * 1e9), color: rng.pick(PASTELS), roof: rng.pick(ROOFS), outer: true, base: terrainH(e.x, e.z),
    };
    b.id = buildings.length;
    b.name = e.name;
    buildings.push(b);
  }
  return buildings;
}

function makeBuilding(lot, r, c, rng) {
  const type = lot.type;
  const def = BUILDING_TYPES[type];
  let w, d, floors;
  if (lot.size === 'S') {
    w = type === 'house' ? rng.range(10, 12.5) : rng.range(12, 14.5);
    d = type === 'house' ? rng.range(9, 11) : rng.range(11, 13.5);
    floors = type === 'house' ? rng.int(1, 2) : type === 'convenience' ? 1 : type === 'villa' ? rng.int(3, 4) : ['pizza', 'chicken', 'burger', 'bunsik'].includes(type) ? 1 : 2;
  } else if (lot.size === 'M') {
    w = rng.range(28, 33); d = rng.range(13, 15);
    floors = { apartment: rng.int(5, 8), office: rng.int(9, 14), hotel: 10, tvstation: 6, police: 3, court: 3, bank: 3, lab: 3, library: 2, cinema: 3, club: 2 }[type] || 2;
    if (type === 'garage') { w = 13; d = 10; floors = 1; }
  } else {
    w = 30; d = type === 'park' ? 34 : 20;
    floors = { hospital: 5, school: 3, university: 3, cityhall: 3, museum: 3, factory: 2, dojang: 3 }[type] || 1;
    if (type === 'dojang') { w = 28; d = 18; }
    if (type === 'school' || type === 'university') { w = 30; d = 13; }
    if (type === 'construction') { w = 8; d = 5; floors = 1; }
  }
  // 앞쪽(도로쪽) 여백
  const setback = lot.size === 'B' ? (type === 'school' || type === 'university' || type === 'cityhall' || type === 'museum' || type === 'dojang' ? 16 : type === 'construction' ? 4 : 6) : 2.6;
  const bz0 = blockMin(r), x0 = blockMin(c);
  let cx = lot.x, cz;
  if (lot.size === 'B') {
    cz = type === 'park' ? lot.z : bz0 + BLOCK - setback - d / 2;
    if (type === 'construction') { cx = x0 + BLOCK - 7; }
  } else if (lot.dir === -1) cz = bz0 + setback + d / 2;
  else cz = bz0 + BLOCK - setback - d / 2;
  // 정비소는 옆에 주유 캐노피(로컬 -x)가 있으므로 반대편으로 비켜 세운다
  if (type === 'garage') cx = lot.x + (lot.dir === -1 ? -9 : 9);

  const dir = lot.dir;
  const frontZ = cz + dir * d / 2;
  const door = new THREE.Vector3(cx, BASE, frontZ + dir * 0.9);
  const lineZ = dir === 1 ? roadC(r + 1) - WALK_OFF : roadC(r) + WALK_OFF;
  if (type === 'park') {
    door.set(lot.x, BASE, bz0 + BLOCK - 1.5);
  }
  const walk = new THREE.Vector3(door.x, BASE, lineZ);
  return {
    type, def, size: lot.size, cat: def.cat, row: r, col: c,
    x: cx, z: cz, w, d, floors, dir, door, walk,
    lot: { x0, z0: bz0, x: lot.x, z: lot.z, size: lot.size },
    residents: [], workers: [],
    seed: Math.floor(rng.next() * 1e9),
    color: rng.pick(PASTELS), roof: rng.pick(ROOFS),
  };
}

// ------------------------------------------------------------------
// 2단계: 메쉬 만들기
// ------------------------------------------------------------------
export function buildCity(scene, buildings, seed) {
  const rng = new RNG(seed + 1);
  const root = new THREE.Group();
  const stat = new THREE.Group();
  const dyn = new THREE.Group();
  root.add(dyn);
  const colliders = [];
  const anim = { smokes: [], spins: [], flags: [], blinks: [], fountains: [], cranes: [], roaches: [] };

  // 바닥 잔디 (도시 바깥은 지형 메쉬가 덮는다)
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(CITY + 40, CITY + 40), toon('#a8dc8c'));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.02; grass.receiveShadow = true;
  stat.add(grass);
  // 아스팔트
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CITY, CITY), toon('#6f7480'));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = 0.01; asphalt.receiveShadow = true;
  stat.add(asphalt);

  const sidewalkMat = toon('#e9dfd3');
  const curbMat = toon('#cfc3b5');
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const x0 = blockMin(c), z0 = blockMin(r);
    const cx = x0 + BLOCK / 2, cz = z0 + BLOCK / 2;
    const S = BLOCK + (ROAD / 2 - ASPHALT_HALF) * 2;
    box(stat, S, BASE, S, curbMat, cx, BASE / 2, cz, { cast: false });
    box(stat, S - 0.4, 0.02, S - 0.4, sidewalkMat, cx, BASE + 0.005, cz, { cast: false });
    // 블록 내부 바닥
    const plan = CITY_PLAN[r][c];
    const inner = isSuburbBlock(r, c) ? (plan.includes('house') ? '#a9de8f' : '#c5e6b0') : plan.includes('dojang') ? '#e8dcc6' : plan.includes('park') ? '#9ed98a' : plan.includes('construction') ? '#c9a97c' : plan.includes('factory') ? '#c7c2b8' : plan.includes('house') ? '#b9e4a1' : '#efe6da';
    box(stat, BLOCK, 0.02, BLOCK, inner, cx, BASE + 0.015, cz, { cast: false });
  }

  // 도로 표시 (중앙선, 횡단보도)
  const yellow = toon('#ffd54f'), white = toon('#ffffff');
  for (let i = 0; i <= GRID; i++) {
    const c = roadC(i);
    for (let k = 0; k < GRID; k++) {
      const a = blockMin(k), b = a + BLOCK;
      const mid = (a + b) / 2, len = BLOCK - 2;
      box(stat, 0.18, 0.02, len, yellow, c - 0.15, 0.03, mid, { cast: false });
      box(stat, 0.18, 0.02, len, yellow, c + 0.15, 0.03, mid, { cast: false });
      box(stat, len, 0.02, 0.18, yellow, mid, 0.03, c - 0.15, { cast: false });
      box(stat, len, 0.02, 0.18, yellow, mid, 0.03, c + 0.15, { cast: false });
    }
  }
  for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) {
    const cx = roadC(i), cz = roadC(j);
    for (const s of [-1, 1]) {
      // 동서 도로(가로) 위의 횡단보도 (x = cx ± WALK_OFF)
      if ((s === -1 && i > 0) || (s === 1 && i < GRID)) {
        for (let k = -3; k <= 3; k++) box(stat, 2.2, 0.02, 0.6, white, cx + s * WALK_OFF, 0.03, cz + k * 1.25, { cast: false });
      }
      if ((s === -1 && j > 0) || (s === 1 && j < GRID)) {
        for (let k = -3; k <= 3; k++) box(stat, 0.6, 0.02, 2.2, white, cx + k * 1.25, 0.03, cz + s * WALK_OFF, { cast: false });
      }
    }
  }

  // 도시 경계 산울타리: 외곽 도로까지는 다닐 수 있고, 바깥 초록 들판은 막힌다
  const hedge = toon('#4caf50'), hedgeTop = toon('#66bb6a');
  const flowers = ['#ff80ab', '#ffeb3b', '#ffffff', '#ce93d8'];
  for (const s of [-1, 1]) {
    for (const along of [0, 1]) {
      // 가운데는 고속도로 출입구 (폭 16m)
      const len = CITY + 3.2, gap = 9;
      const half = (len / 2 - gap);
      for (const side of [-1, 1]) {
        const mid = side * (gap + half / 2);
        const x = along ? mid : s * (HALF + 0.8), z = along ? s * (HALF + 0.8) : mid;
        box(stat, along ? half : 1.4, 1.3, along ? 1.4 : half, hedge, x, 0.65, z);
        box(stat, along ? half : 1.5, 0.25, along ? 1.5 : half, hedgeTop, x, 1.38, z, { cast: false });
      }
      for (let i = 0; i < 40; i++) {
        const u = -len / 2 + (i + 0.5) * (len / 40);
        if (Math.abs(u) < gap) continue;
        const x = along ? 0 : s * (HALF + 0.8), z = along ? s * (HALF + 0.8) : 0;
        sph(stat, 0.18, 0.18, 0.18, flowers[i % 4], along ? u : x + s * -0.72, 1.0, along ? z + s * -0.72 : u, { low: true, cast: false });
      }
    }
  }

  // 신호등 (공유 재질로 일괄 점멸)
  const tl = {
    ns: { r: new THREE.MeshToonMaterial({ color: '#ff5252', emissive: '#ff1744' }), y: new THREE.MeshToonMaterial({ color: '#ffd740', emissive: '#ffc400' }), g: new THREE.MeshToonMaterial({ color: '#69f0ae', emissive: '#00e676' }) },
    ew: { r: new THREE.MeshToonMaterial({ color: '#ff5252', emissive: '#ff1744' }), y: new THREE.MeshToonMaterial({ color: '#ffd740', emissive: '#ffc400' }), g: new THREE.MeshToonMaterial({ color: '#69f0ae', emissive: '#00e676' }) },
  };
  const poleMat = toon('#5c6370');
  for (let i = 1; i < GRID; i++) for (let j = 1; j < GRID; j++) {
    const cx = roadC(i), cz = roadC(j);
    for (const [sx, sz, axis] of [[1, 1, 'ns'], [-1, -1, 'ns'], [1, -1, 'ew'], [-1, 1, 'ew']]) {
      const px = cx + sx * 5.0, pz = cz + sz * 5.0;
      cyl(stat, 0.12, 4.2, poleMat, px, 2.1, pz, { low: true });
      const head = new THREE.Group();
      head.position.set(px, 4.3, pz);
      head.rotation.y = axis === 'ns' ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2);
      stat.add(head);
      box(head, 0.5, 1.4, 0.4, '#3a3f4b', 0, 0, 0);
      const m = tl[axis];
      sph(head, 0.16, 0.16, 0.08, m.r, 0, 0.42, 0.2, { low: true });
      sph(head, 0.16, 0.16, 0.08, m.y, 0, 0, 0.2, { low: true });
      sph(head, 0.16, 0.16, 0.08, m.g, 0, -0.42, 0.2, { low: true });
    }
  }

  // 가로등과 가로수
  const lampMat = new THREE.MeshToonMaterial({ color: '#fff3c4', emissive: '#ffd77a', emissiveIntensity: 0 });
  const lampPole = toon('#4a5160');
  const trunk = toon('#8d6e63');
  const leafColors = ['#6cc551', '#86d36b', '#5bb348', '#9be07f', '#f4a7c0'];
  const addTree = (parent, x, z, s = 1, col) => {
    cyl(parent, 0.22 * s, 2.2 * s, trunk, x, BASE + 1.1 * s, z, { low: true });
    const c = col || rng.pick(leafColors);
    sph(parent, 1.4 * s, 1.25 * s, 1.4 * s, c, x, BASE + 2.9 * s, z, { ico: true });
    sph(parent, 1.0 * s, 0.9 * s, 1.0 * s, shade(c, 1.12), x + 0.4 * s, BASE + 3.7 * s, z - 0.2 * s, { ico: true });
    colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, h: 4 * s, small: true });
  };
  const addLamp = (parent, x, z, ry) => {
    cyl(parent, 0.1, 5.2, lampPole, x, BASE + 2.6, z, { low: true });
    const arm = new THREE.Group(); arm.position.set(x, BASE + 5.1, z); arm.rotation.y = ry; parent.add(arm);
    box(arm, 0.1, 0.1, 1.1, lampPole, 0, 0, 0.5);
    sph(arm, 0.32, 0.22, 0.32, lampMat, 0, -0.12, 1.0, { cast: false, low: true });
    colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2, h: 5, small: true });
  };
  // 거리의 가로등·가로수는 부서지는 소품 (인스턴스)
  const props = new Props(root);
  defineCommonProps(props, { lamp: lampMat });
  const streetTree = (x, z, s) => {
    const id = props.add('tree', x, BASE, z, s, rng.range(0, 6), rng.pick(leafColors));
    const c = { minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35, h: 4 * s, small: true, pkey: 'c' + id };
    props.list[id].collider = c; colliders.push(c);
  };
  const streetLamp = (x, z, ry) => {
    const id = props.add('lamp', x, BASE, z, 1, ry);
    const c = { minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2, h: 5, small: true, pkey: 'c' + id };
    props.list[id].collider = c; colliders.push(c);
  };
  const doorXs = new Map(); // 블록 가장자리의 문 위치 (나무 피하기)
  for (const b of buildings) {
    const key = `${b.row},${b.col},${b.dir}`;
    if (!doorXs.has(key)) doorXs.set(key, []);
    doorXs.get(key).push(b.door.x);
  }
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const x0 = blockMin(c), z0 = blockMin(r);
    const edge = ROAD / 2 - 4.85; // 보도 바깥쪽
    // 북/남 가장자리
    for (const [dz, dirKey] of [[-edge, -1], [BLOCK + edge, 1]]) {
      const z = z0 + dz;
      const doors = doorXs.get(`${r},${c},${dirKey}`) || [];
      for (let k = 0; k < 5; k++) {
        const x = x0 + 4 + k * 8;
        if (doors.some((dx) => Math.abs(dx - x) < 2.6)) continue;
        if (k % 2 === 0) streetLamp(x, z, dirKey === -1 ? Math.PI : 0);
        else streetTree(x, z, 0.8);
      }
    }
    // 동/서 가장자리
    for (const [dx, ry] of [[-edge, -Math.PI / 2], [BLOCK + edge, Math.PI / 2]]) {
      const x = x0 + dx;
      for (let k = 0; k < 5; k++) {
        const z = z0 + 4 + k * 8;
        if (k % 2 === 0) streetLamp(x, z, ry);
        else streetTree(x, z, 0.8);
      }
    }
  }

  // 건물
  for (const b of buildings) {
    const g = new THREE.Group();
    g.position.set(b.x, b.outer ? 0.15 : BASE, b.z);
    g.rotation.y = b.dir === 1 ? 0 : Math.PI;
    const ctx = { rng: new RNG(b.seed), anim, colliders, addTree, b, dynParent: dyn, stat };
    (BUILDERS[b.type] || BUILDERS.generic)(g, b, ctx);
    stat.add(g);
    if (b.type === 'dojang') {
      colliders.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: 14, building: b });
    } else if (b.type !== 'park') {
      colliders.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, h: b.floors * FH + (b.type === 'concerthall' ? b.d / 2 + 1 : 4), top: (b.outer ? 0.15 : BASE) + b.floors * FH + 0.45, building: b });
    }
    // 현관 매트 (입구 표시)
    if (b.type !== 'park') {
      const mat = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true, opacity: 0.85 }));
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(b.door.x, BASE + 0.03, b.door.z);
      mat.scale.set(2.2, 1.3, 1);
      mat.userData.dynamic = true;
      dyn.add(mat);
      b.doorMat = mat;
    }
  }

  // 동적 메쉬(dynamic)는 dyn으로 옮기고 나머지는 병합
  const moveDyn = [];
  stat.traverse((o) => { if (o.userData.dynamic && o.parent && !o.parent.userData.dynamic) moveDyn.push(o); });
  stat.updateMatrixWorld(true);
  for (const o of moveDyn) {
    const m = o.matrixWorld.clone();
    o.parent.remove(o);
    m.decompose(o.position, o.quaternion, o.scale);
    dyn.add(o);
  }
  const merged = bakeStatic(stat);
  root.add(merged);
  props.build({ castShadow: true });
  scene.add(root);

  const city = {
    root, buildings, colliders, anim, tl, lampMat, props,
    roofs: colliders.filter((c) => c.top !== undefined).map((c) => ({ minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: c.maxZ, top: c.top })),
    byType: {},
    groundY(x, z) {
      // 블록(보도 포함) 위면 BASE, 차도면 0
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) return 0.01;
      const P = BLOCK + ROAD;
      // 가장 가까운 도로 중심선까지의 거리
      const dist = (v) => {
        const l = (((v + HALF - ROAD / 2) % P) + P) % P;
        return Math.min(l, P - l);
      };
      const dX = dist(x), dZ = dist(z);
      return dX < ASPHALT_HALF || dZ < ASPHALT_HALF ? 0.01 : BASE;
    },
    update(dt, t, night) {
      lampMat.emissiveIntensity = night * 1.6;
      // 신호등: 서버의 차들과 같은 박자 (실제 시각 기준 20초 주기)
      const { nsGreen, nsYellow, ewGreen, ewYellow } = signalPhase();
      const set = (m, on) => { m.emissiveIntensity = on ? 1.2 : 0; m.color.setScalar(on ? 1 : 0.35); };
      set(tl.ns.g, nsGreen); set(tl.ns.y, nsYellow); set(tl.ns.r, !nsGreen && !nsYellow);
      set(tl.ew.g, ewGreen); set(tl.ew.y, ewYellow); set(tl.ew.r, !ewGreen && !ewYellow);
      city.nsGo = nsGreen || nsYellow; city.ewGo = ewGreen || ewYellow;
      for (const s of anim.smokes) {
        for (const p of s.parts) {
          p.userData.t += dt * 0.35;
          if (p.userData.t > 1) p.userData.t -= 1;
          const k = p.userData.t;
          p.position.set(s.x + Math.sin(k * 5 + p.userData.o) * 0.6 + k * 2, s.y + k * 9, s.z);
          p.scale.setScalar(0.6 + k * 2.2);
          p.material.opacity = 0.75 * (1 - k);
        }
      }
      for (const s of anim.spins) s.obj.rotation[s.axis || 'y'] += dt * s.speed;
      for (const f of anim.flags) f.obj.rotation.y = Math.sin(t * 3 + f.o) * 0.35;
      for (const bl of anim.blinks) {
        const on = Math.floor(t * (bl.rate || 3) + bl.o) % 2 === 0;
        bl.obj.material = on ? bl.a : bl.b;
      }
      for (const f of anim.fountains) {
        const s = 1 + Math.sin(t * 4 + f.o) * 0.12;
        f.obj.scale.set(f.base * (2 - s), f.base * s * 1.4, f.base * (2 - s));
      }
      for (const c of anim.cranes) c.obj.rotation.y = Math.sin(t * 0.15) * 1.2;
      for (const r of anim.roaches) r.update(dt, 0);
    },
  };
  for (const b of buildings) (city.byType[b.type] ||= []).push(b);
  return city;
}

// ------------------------------------------------------------------
// 공통 부품
// ------------------------------------------------------------------
function shell(g, w, d, floors, color, o = {}) {
  const h = floors * FH;
  box(g, w, h, d, color, 0, h / 2, 0);
  box(g, w + 0.25, 0.45, d + 0.25, o.trim || shade(color, 0.82), 0, 0.22, 0);
  if (o.roof !== false) box(g, w + 0.5, 0.45, d + 0.5, o.roofColor || shade(color, 0.78), 0, h + 0.22, 0);
  // 층 구분 띠
  if (o.bands) for (let f = 1; f < floors; f++) box(g, w + 0.12, 0.18, d + 0.12, shade(color, 0.88), 0, f * FH, 0, { cast: false });
  if (o.windows !== false) {
    const cw = o.cellW || 2.6;
    const faces = [
      { ry: 0, x: 0, z: d / 2 + 0.03, len: w, front: true },
      { ry: Math.PI, x: 0, z: -d / 2 - 0.03, len: w },
      { ry: Math.PI / 2, x: w / 2 + 0.03, z: 0, len: d },
      { ry: -Math.PI / 2, x: -w / 2 - 0.03, z: 0, len: d },
    ];
    for (const f of faces) {
      const cols = Math.floor((f.len - 1.2) / cw);
      if (cols < 1) continue;
      const start = f.front ? (o.frontStart ?? 1) : (o.sideStart ?? 0);
      const rows = floors - start;
      if (rows < 1) continue;
      const pw = cols * cw, ph = rows * FH;
      const m = windowPlane(g, pw, ph, cw, FH, o.winKind || 'normal');
      m.position.set(f.x, start * FH + ph / 2, f.z);
      m.rotation.y = f.ry;
    }
  }
  return h;
}

function door(g, d, color = '#8b5a3c', o = {}) {
  const z = d / 2;
  const w = o.w || 2.0, h = o.h || 2.5;
  box(g, w + 0.4, h + 0.25, 0.15, o.frame || '#ffffff', o.x || 0, (h + 0.25) / 2, z + 0.04);
  if (o.glass) {
    const m = windowPlane(g, w, h, w, h * 1.0, 'dark');
    m.position.set(o.x || 0, h / 2, z + 0.13);
  } else {
    box(g, w, h, 0.12, color, o.x || 0, h / 2, z + 0.1);
    sph(g, 0.09, 0.09, 0.09, '#ffd54f', (o.x || 0) + w * 0.32, h * 0.48, z + 0.2, { low: true });
  }
  // 계단
  box(g, w + 1.2, 0.12, 1.0, '#d7ccc8', o.x || 0, 0.06, z + 0.5, { cast: false });
}

function sign(g, b, y, width, bg = '#ffffff', fg = '#4a3428', z) {
  const s = signMesh(b.name, b.def.emoji, width, bg, fg);
  s.position.set(0, y, (z ?? b.d / 2) + 0.2);
  g.add(s);
  return s;
}

function roofSign(g, b, h, bg, fg) {
  const width = Math.min(b.w * 0.85, 9);
  box(g, 0.15, 1.0, 0.15, '#666666', -width * 0.35, h + 0.9, b.d / 2 - 0.6);
  box(g, 0.15, 1.0, 0.15, '#666666', width * 0.35, h + 0.9, b.d / 2 - 0.6);
  const s = signMesh(b.name, b.def.emoji, width, bg, fg);
  s.position.set(0, h + 0.5 + width / 8 + 0.6, b.d / 2 - 0.5);
  g.add(s);
}

function awning(g, b, c1, c2, y = 2.85, width) {
  const w = width || b.w - 1;
  const m = new THREE.Mesh(G.box(), stripeMat(c1, c2, 10));
  m.scale.set(w, 0.12, 1.8);
  m.position.set(0, y, b.d / 2 + 0.85);
  m.rotation.x = 0.35;
  m.castShadow = true;
  g.add(m);
  // 가리개 끝단 물결
  for (let i = 0; i < Math.floor(w / 0.9); i++) {
    sph(g, 0.45, 0.2, 0.12, i % 2 ? c2 : c1, -w / 2 + 0.45 + i * 0.9, y - 0.35, b.d / 2 + 1.72, { low: true, cast: false });
  }
}

function shopFront(g, b, o = {}) {
  // 1층 쇼윈도
  const wing = (b.w - 3.2) / 2;
  for (const s of [-1, 1]) {
    const m = windowPlane(g, wing - 0.8, 2.0, wing - 0.8, 2.0, 'dark');
    m.position.set(s * (1.6 + wing / 2), 1.45, b.d / 2 + 0.04);
    box(g, wing - 0.4, 0.2, 0.3, '#ffffff', s * (1.6 + wing / 2), 0.35, b.d / 2 + 0.1);
  }
  door(g, b.d, o.door || '#ffffff', { glass: true });
}

function gable(g, w, d, h, roofH, color, overhang = 0.6) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - overhang, 0);
  shape.lineTo(w / 2 + overhang, 0);
  shape.lineTo(0, roofH);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: d + overhang * 2, bevelEnabled: false });
  const m = new THREE.Mesh(geom, toon(color));
  m.position.set(0, h, -d / 2 - overhang);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return m;
}

function columns(g, n, span, z, h, color = '#f5f0e6', r = 0.45) {
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span / (n - 1)) * i;
    cyl(g, r, h, color, x, h / 2, z);
    box(g, r * 2.6, 0.3, r * 2.6, color, x, h + 0.15, z);
    box(g, r * 2.6, 0.3, r * 2.6, color, x, 0.15, z);
  }
}

function pediment(g, w, y, z, depth, color) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, w * 0.18); shape.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), toon(color));
  m.position.set(0, y, z - depth / 2);
  m.castShadow = true;
  g.add(m);
}

function smoke(ctx, g, x, y, z) {
  // 굴뚝 연기: 월드 좌표로 계산하기 위해 g의 변환 적용
  const wp = new THREE.Vector3(x, y, z);
  g.updateMatrixWorld(true);
  wp.applyMatrix4(g.matrixWorld);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(G.sphereLow(), new THREE.MeshToonMaterial({ color: '#f2f2f2', transparent: true, opacity: 0.6, depthWrite: false }));
    m.userData.t = i / 6; m.userData.o = Math.random() * 6;
    m.userData.dynamic = true;
    ctx.dynParent.add(m);
    parts.push(m);
  }
  ctx.anim.smokes.push({ x: wp.x, y: wp.y, z: wp.z, parts });
}

function dynamicMesh(obj) { obj.userData.dynamic = true; return obj; }

function simpleCar(g, color, x, z, ry = 0, extra) {
  const c = new THREE.Group();
  c.position.set(x, 0, z); c.rotation.y = ry;
  g.add(c);
  box(c, 2.0, 0.9, 3.8, color, 0, 0.75, 0);
  box(c, 1.7, 0.75, 2.0, shade(color, 1.15), 0, 1.55, -0.2);
  const glass = windowPlane(c, 1.5, 0.6, 1.5, 0.6, 'dark'); glass.position.set(0, 1.55, 0.81);
  for (const sx of [-1, 1]) for (const sz of [-1.2, 1.2]) cyl(c, 0.42, 0.3, '#2b2b2b', sx * 1.0, 0.42, sz, { rz: Math.PI / 2 });
  if (extra === 'police') { box(c, 0.9, 0.2, 0.3, '#ff1744', -0.25, 2.0, -0.2); box(c, 0.9, 0.2, 0.3, '#2979ff', 0.25, 2.0, -0.2); }
  if (extra === 'taxi') box(c, 0.8, 0.3, 0.4, '#fff59d', 0, 2.05, -0.2);
  return c;
}
export { simpleCar };

function bench(g, x, z, ry = 0) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
  box(c, 2.2, 0.12, 0.6, '#c58b5b', 0, 0.55, 0);
  box(c, 2.2, 0.5, 0.1, '#c58b5b', 0, 0.85, -0.28);
  for (const s of [-1, 1]) box(c, 0.1, 0.55, 0.5, '#555555', s * 0.95, 0.27, 0);
}

function flowerBed(g, x, z, w, d, rng) {
  box(g, w, 0.35, d, '#8d6e63', x, 0.17, z);
  const cols = ['#ff6b9a', '#ffd166', '#ff8fab', '#c77dff', '#ffffff', '#ff595e'];
  for (let i = 0; i < Math.floor(w * d * 1.2); i++) {
    sph(g, 0.22, 0.22, 0.22, rng.pick(cols), x + rng.range(-w / 2 + 0.3, w / 2 - 0.3), 0.5, z + rng.range(-d / 2 + 0.3, d / 2 - 0.3), { low: true, cast: false });
  }
}

// ------------------------------------------------------------------
// 건물별 외관
// ------------------------------------------------------------------
const BUILDERS = {
  generic(g, b) {
    const h = shell(g, b.w, b.d, b.floors, b.color, { roofColor: b.roof });
    door(g, b.d);
    sign(g, b, 3.2, Math.min(b.w * 0.6, 6));
    return h;
  },

  house(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, b.color, { roof: false, frontStart: 1, cellW: 2.8 });
    gable(g, b.w, b.d, h, 2.6 + ctx.rng.range(0, 1), b.roof);
    box(g, 0.9, 2.2, 0.9, shade(b.roof, 0.8), b.w * 0.25, h + 1.8, -b.d * 0.15);
    door(g, b.d, ctx.rng.pick(['#8b5a3c', '#e57373', '#64b5f6', '#81c784', '#ba68c8']));
    for (const s of [-1, 1]) {
      const m = windowPlane(g, 1.8, 1.8, 1.8, 1.8, 'wood');
      m.position.set(s * b.w * 0.3, 1.6, b.d / 2 + 0.04);
      box(g, 2.0, 0.15, 0.35, '#ffffff', s * b.w * 0.3, 0.65, b.d / 2 + 0.12);
      for (let i = 0; i < 3; i++) sph(g, 0.22, 0.2, 0.2, ctx.rng.pick(['#ff6b9a', '#ffd166', '#c77dff']), s * b.w * 0.3 - 0.6 + i * 0.6, 0.8, b.d / 2 + 0.15, { low: true, cast: false });
    }
    // 문패
    const s = signMesh(b.name, b.def.emoji, 3.2, '#fffaf0', '#5d4037');
    s.position.set(0, 2.95, b.d / 2 + 0.2);
    g.add(s);
    b.signMesh = s;
    // 우편함 & 덤불
    cyl(g, 0.06, 1.0, '#795548', 2.2, 0.5, b.d / 2 + 2.0, { low: true });
    box(g, 0.45, 0.35, 0.6, '#e53935', 2.2, 1.1, b.d / 2 + 2.0);
    for (const s2 of [-1, 1]) sph(g, 0.9, 0.7, 0.8, '#7cc96b', s2 * (b.w / 2 - 0.6), 0.5, b.d / 2 + 0.9, { ico: true });
    if (b.suburb) {
      // 전원주택: 낮은 울타리 + 뒷마당
      const fc = '#fffaf0';
      const fx = b.w / 2 + 2.2, bz = -b.d / 2 - 2.6, fz = b.d / 2 + 2.3;
      for (const s2 of [-1, 1]) {
        box(g, 0.12, 0.9, fz - bz, fc, s2 * fx, 0.45, (fz + bz) / 2, { cast: false });
        box(g, 0.12, 0.12, fz - bz, fc, s2 * fx, 0.75, (fz + bz) / 2, { cast: false });
        // 앞 울타리 (가운데는 출입구)
        box(g, fx - 1.8, 0.9, 0.12, fc, s2 * (fx + 1.8) / 2, 0.45, fz, { cast: false });
        box(g, fx - 1.8, 0.12, 0.12, fc, s2 * (fx + 1.8) / 2, 0.75, fz, { cast: false });
      }
      box(g, fx * 2, 0.9, 0.12, fc, 0, 0.45, bz, { cast: false });
      // 뒷마당 장식
      const pick = ctx.rng.int(0, 2);
      if (pick === 0) { box(g, 1.6, 0.6, 1.0, '#ff8a65', -b.w / 4, 0.3, bz + 1.2); box(g, 1.7, 0.1, 1.1, '#ffffff', -b.w / 4, 0.62, bz + 1.2); }
      else if (pick === 1) { cyl(g, 1.0, 0.35, '#4fc3f7', b.w / 4, 0.18, bz + 1.3); }
      else ctx.addTree(g, b.w / 3, bz + 1.4, 0.7);
      // 차고 앞 자동차
      if (ctx.rng.next() < 0.5) simpleCar(g, ctx.rng.pick(['#ef5350', '#42a5f5', '#fdd835', '#ffffff', '#66bb6a']), -b.w / 2 - 1.2 + 0.2, b.d / 2 + 0.2, 0);
    }
  },

  villa(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, b.color, { roofColor: b.roof, bands: true, frontStart: 1, cellW: 3 });
    // 1층 필로티 주차장
    box(g, b.w - 0.8, FH - 0.3, 0.2, shade(b.color, 0.7), 0, (FH - 0.3) / 2, b.d / 2 - 0.4, { cast: false });
    for (const s2 of [-1, 1]) box(g, 0.5, FH, 0.5, shade(b.color, 0.85), s2 * (b.w / 2 - 0.4), FH / 2, b.d / 2 - 0.2);
    // 발코니 & 화분
    for (let f = 1; f < b.floors; f++) for (const s2 of [-1, 1]) {
      box(g, 3.2, 0.15, 1.0, '#ffffff', s2 * b.w / 4, f * FH + 0.08, b.d / 2 + 0.5, { cast: false });
      box(g, 3.2, 0.6, 0.06, '#90a4ae', s2 * b.w / 4, f * FH + 0.45, b.d / 2 + 0.98, { cast: false });
      sph(g, 0.3, 0.3, 0.3, ctx.rng.pick(['#ff6b9a', '#66bb6a', '#ffd166']), s2 * b.w / 4 + 1.1, f * FH + 0.45, b.d / 2 + 0.6, { low: true, cast: false });
    }
    door(g, b.d, '#795548', { w: 1.8 });
    // 옥상 물탱크
    cyl(g, 0.9, 1.4, '#e3f2fd', -b.w / 4, h + 1.0, -1);
    const s = signMesh(b.name, b.def.emoji, 4.5, '#ffffff', '#5d4037');
    s.position.set(0, h - 0.9, b.d / 2 + 0.22); g.add(s);
  },

  apartment(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, b.color, { roofColor: b.roof, bands: true });
    const n = Math.floor(b.w / 5.2);
    for (let f = 1; f < b.floors; f++) for (let i = 0; i < n; i++) {
      const x = -b.w / 2 + 2.6 + i * (b.w - 5.2) / Math.max(1, n - 1);
      box(g, 3.0, 0.2, 1.2, '#ffffff', x, f * FH + 0.1, b.d / 2 + 0.6, { cast: false });
      box(g, 3.0, 0.7, 0.08, shade(b.color, 0.85), x, f * FH + 0.55, b.d / 2 + 1.18, { cast: false });
    }
    box(g, 5, 0.25, 2.5, '#ffffff', 0, 2.9, b.d / 2 + 1.2);
    cyl(g, 0.1, 2.8, '#ffffff', -2.2, 1.4, b.d / 2 + 2.3, { low: true });
    cyl(g, 0.1, 2.8, '#ffffff', 2.2, 1.4, b.d / 2 + 2.3, { low: true });
    door(g, b.d, '#ffffff', { glass: true, w: 2.4 });
    cyl(g, 1.5, 2.2, '#90a4ae', b.w * 0.3, h + 1.5, 0);
    const s = signMesh(b.name, b.def.emoji, 7, '#ffffff', '#37474f');
    s.position.set(0, h - 1.4, b.d / 2 + 0.25); g.add(s);
    void ctx;
  },

  hospital(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#f7fbff', { roofColor: '#cfe3f5', trim: '#9ec5e8', bands: true });
    door(g, b.d, '#ffffff', { glass: true, w: 3.2, h: 2.6 });
    // 응급실 캐노피
    box(g, 8, 0.4, 4, '#ffffff', 0, 3.0, b.d / 2 + 2);
    box(g, 8.05, 0.2, 4.05, '#e53935', 0, 2.75, b.d / 2 + 2);
    for (const s of [-1, 1]) cyl(g, 0.18, 2.8, '#ffffff', s * 3.6, 1.4, b.d / 2 + 3.7, { low: true });
    sign(g, b, 4.0, 9, '#ffffff', '#e53935');
    // 큰 십자가
    box(g, 4.4, 4.4, 0.4, '#ffffff', 0, h + 2.8, b.d / 2 - 1);
    box(g, 3.6, 1.1, 0.5, '#e53935', 0, h + 2.8, b.d / 2 - 1);
    box(g, 1.1, 3.6, 0.5, '#e53935', 0, h + 2.8, b.d / 2 - 1);
    // 헬리패드
    cyl(g, 4, 0.2, '#546e7a', -5, h + 0.5, -2);
    box(g, 0.5, 0.05, 2.6, '#ffffff', -5.8, h + 0.62, -2);
    box(g, 0.5, 0.05, 2.6, '#ffffff', -4.2, h + 0.62, -2);
    box(g, 1.6, 0.05, 0.5, '#ffffff', -5, h + 0.62, -2);
    // 구급차
    const amb = simpleCar(g, '#ffffff', 9, b.d / 2 + 3, 0);
    box(amb, 2.05, 0.3, 3.85, '#e53935', 0, 0.9, 0);
    void ctx;
  },

  school(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#ffe9a8', { roofColor: '#e57373', bands: true });
    door(g, b.d, '#ffffff', { glass: true, w: 3 });
    sign(g, b, 3.2, 8, '#fff8e1', '#5d4037');
    // 시계
    cyl(g, 1.3, 0.3, '#ffffff', 0, h - 1.4, b.d / 2 + 0.2, { rx: Math.PI / 2 });
    box(g, 0.12, 0.9, 0.1, '#333333', 0, h - 1.1, b.d / 2 + 0.4);
    box(g, 0.7, 0.12, 0.1, '#333333', 0.3, h - 1.4, b.d / 2 + 0.4);
    // 운동장
    box(g, 26, 0.03, 12, '#d9b38c', 0, 0.02, b.d / 2 + 8.5, { cast: false });
    box(g, 0.2, 0.04, 12, '#ffffff', 0, 0.05, b.d / 2 + 8.5, { cast: false });
    for (const s of [-1, 1]) {
      const gx = s * 12;
      box(g, 0.15, 2, 0.15, '#ffffff', gx, 1, b.d / 2 + 6.5);
      box(g, 0.15, 2, 0.15, '#ffffff', gx, 1, b.d / 2 + 10.5);
      box(g, 0.15, 0.15, 4, '#ffffff', gx, 2, b.d / 2 + 8.5);
    }
    // 국기 게양대
    cyl(g, 0.08, 8, '#cfd8dc', -b.w / 2 + 1.5, 4, b.d / 2 + 2, { low: true });
    const flag = box(g, 1.8, 1.1, 0.05, '#ffffff', -b.w / 2 + 2.4, 7.3, b.d / 2 + 2);
    dynamicMesh(flag); ctx.anim.flags.push({ obj: flag, o: 1 });
  },

  kindergarten(g, b, ctx) {
    const cols = ['#ffadad', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff'];
    const seg = b.w / 5;
    for (let i = 0; i < 5; i++) box(g, seg, b.floors * FH + (i % 2) * 1.2, b.d, cols[i], -b.w / 2 + seg / 2 + i * seg, (b.floors * FH + (i % 2) * 1.2) / 2, 0);
    for (let i = 0; i < 5; i++) {
      const m = windowPlane(g, 2.4, 2.4, 2.4, 2.4, 'wood');
      m.position.set(-b.w / 2 + seg / 2 + i * seg, FH * 1.5, b.d / 2 + 0.05);
    }
    door(g, b.d, '#ff7043');
    sign(g, b, 3.2, 7, '#fffde7', '#ff7043');
    // 무지개 아치
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(3.2 - i * 0.35, 0.18, 8, 24, Math.PI), toon(['#ff595e', '#ffca3a', '#8ac926', '#1982c4'][i]));
      t.position.set(-b.w / 2 + 4, 0, b.d / 2 + 0.2); t.castShadow = true;
      g.add(t);
    }
    void ctx;
  },

  university(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#c9705a', { roofColor: '#7b3f30', winKind: 'normal', bands: true });
    columns(g, 4, 9, b.d / 2 + 1.6, 7, '#f5f0e6', 0.4);
    box(g, 11, 0.6, 3.6, '#f5f0e6', 0, 7.4, b.d / 2 + 1.2);
    door(g, b.d, '#5d4037', { w: 2.6, h: 3 });
    sign(g, b, 8.6, 9, '#3e2723', '#ffe082');
    // 시계탑
    box(g, 5, 10, 5, '#b85c47', 0, h + 5, -1);
    cyl(g, 1.4, 0.3, '#ffffff', 0, h + 7.5, 1.6, { rx: Math.PI / 2 });
    const roofCone = new THREE.Mesh(new THREE.ConeGeometry(4, 4, 4), toon('#4e342e'));
    roofCone.position.set(0, h + 12, -1); roofCone.rotation.y = Math.PI / 4; roofCone.castShadow = true; g.add(roofCone);
    // 잔디밭 & 나무
    box(g, 26, 0.03, 12, '#8fd17a', 0, 0.03, b.d / 2 + 9, { cast: false });
    box(g, 3.4, 0.04, 12, '#e8dccb', 0, 0.05, b.d / 2 + 9, { cast: false });
    ctx.addTree(g, -9, b.d / 2 + 8, 1.2);
    ctx.addTree(g, 9, b.d / 2 + 8, 1.2);
    fixTreeColliders(ctx, g, 2);
  },

  police(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#f4f7fb', { roofColor: '#23356b', trim: '#23356b' });
    box(g, b.w + 0.1, 1.0, b.d + 0.1, '#2f4a9a', 0, FH - 0.2, 0, { cast: false });
    door(g, b.d, '#ffffff', { glass: true, w: 2.6 });
    sign(g, b, FH + 1.0, 8, '#23356b', '#ffffff');
    const red = toon('#ff1744', { emissive: '#ff1744' }), blue = toon('#2979ff', { emissive: '#2979ff' }), off = toon('#444444');
    const r1 = dynamicMesh(sph(g, 0.5, 0.5, 0.5, red, -0.8, h + 0.9, 0));
    const b1 = dynamicMesh(sph(g, 0.5, 0.5, 0.5, blue, 0.8, h + 0.9, 0));
    ctx.anim.blinks.push({ obj: r1, a: red, b: off, rate: 2, o: 0 }, { obj: b1, a: blue, b: off, rate: 2, o: 1 });
    simpleCar(g, '#ffffff', -10, b.d / 2 + 2.2, Math.PI / 2, 'police');
    simpleCar(g, '#ffffff', 10, b.d / 2 + 2.2, Math.PI / 2, 'police');
  },

  fire(g, b, ctx) {
    shell(g, b.w, b.d, b.floors, '#d9534f', { roofColor: '#8e2b28', frontStart: 1 });
    for (const s of [-1, 1]) {
      box(g, 6, 4.2, 0.2, '#fff3e0', s * 7, 2.1, b.d / 2 + 0.05);
      for (let i = 0; i < 5; i++) box(g, 5.6, 0.1, 0.1, '#bcaaa4', s * 7, 0.6 + i * 0.8, b.d / 2 + 0.2, { cast: false });
    }
    door(g, b.d, '#ffffff', { x: 0 });
    sign(g, b, 4.9, 7, '#ffffff', '#d9534f');
    // 소방차
    const t = new THREE.Group(); t.position.set(-7, 0, b.d / 2 + 3.5); g.add(t);
    box(t, 2.4, 1.6, 6, '#e53935', 0, 1.3, 0);
    box(t, 2.2, 1.0, 1.8, '#ffffff', 0, 2.5, 2);
    box(t, 0.4, 0.4, 5, '#cfd8dc', 0, 2.4, -0.6);
    for (const sx of [-1, 1]) for (const sz of [-2, 0, 2]) cyl(t, 0.5, 0.35, '#212121', sx * 1.15, 0.5, sz, { rz: Math.PI / 2 });
    // 훈련 탑
    box(g, 4, 14, 4, '#bf3f3a', b.w / 2 - 2.5, 7, -b.d / 2 + 2.5);
    void ctx;
  },

  court(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#ece6d6', { roofColor: '#cfc6b0', frontStart: 0 });
    for (let i = 0; i < 4; i++) box(g, b.w * 0.8 - i * 0.8, 0.3, 1.2, '#ded6c2', 0, 0.15 + i * 0.3, b.d / 2 + 3.6 - i * 0.6);
    columns(g, 6, b.w * 0.7, b.d / 2 + 2, h - 0.6, '#f8f4ea');
    box(g, b.w * 0.78, 0.6, 4, '#f8f4ea', 0, h, b.d / 2 + 1.8);
    pediment(g, b.w * 0.78, h + 0.3, b.d / 2 + 1.8, 4, '#f8f4ea');
    door(g, b.d, '#6d4c41', { w: 2.6, h: 3.2 });
    sign(g, b, h - 1.6, 8, '#3e2723', '#ffe082', b.d / 2 + 3.6);
    void ctx;
  },

  cityhall(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fbf7ef', { roofColor: '#d8cfbd', bands: true });
    columns(g, 6, 16, b.d / 2 + 2, h - 0.4);
    box(g, 18, 0.8, 4, '#fbf7ef', 0, h, b.d / 2 + 1.8);
    pediment(g, 18, h + 0.4, b.d / 2 + 1.8, 4, '#fbf7ef');
    cyl(g, 5, 3, '#fbf7ef', 0, h + 1.5, -1);
    sph(g, 5, 5, 5, '#5fb3a3', 0, h + 3, -1, { hemi: true });
    sph(g, 0.6, 0.6, 0.6, '#ffd54f', 0, h + 8.2, -1);
    door(g, b.d, '#8d6e63', { w: 3, h: 3.4 });
    sign(g, b, h - 2.2, 9, '#2e7d32', '#ffffff', b.d / 2 + 2.6);
    // 광장 분수 (입구 동선을 막지 않도록 옆으로)
    const fz = b.d / 2 + 9, fx = -8;
    cyl(g, 4, 0.7, '#b0bec5', fx, 0.35, fz);
    cyl(g, 3.6, 0.1, '#64b5f6', fx, 0.68, fz, { cast: false });
    cyl(g, 0.5, 2.2, '#cfd8dc', fx, 1.1, fz);
    const water = dynamicMesh(sph(g, 1, 1, 1, new THREE.MeshToonMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.8 }), fx, 2.4, fz, { cast: false }));
    ctx.anim.fountains.push({ obj: water, base: 0.9, o: 0 });
    ctx.colliders.push(worldBox(g, fx, fz, 4.2, 4.2));
    // 깃발
    for (const s of [-1, 1]) {
      cyl(g, 0.08, 9, '#cfd8dc', s * 12, 4.5, b.d / 2 + 4, { low: true });
      const f = dynamicMesh(box(g, 2, 1.2, 0.05, s > 0 ? '#81c784' : '#64b5f6', s * 12 + 1, 8.2, b.d / 2 + 4));
      ctx.anim.flags.push({ obj: f, o: s });
    }
    ctx.addTree(g, 8, fz, 1.1); ctx.addTree(g, 13, fz - 1, 1.0);
    fixTreeColliders(ctx, g, 2);
  },

  postoffice(g, b) {
    shell(g, b.w, b.d, b.floors, '#ff9e80', { roofColor: '#d84315' });
    door(g, b.d, '#ffffff', { glass: true, w: 2.4 });
    sign(g, b, 3.2, 7, '#ffffff', '#d84315');
    cyl(g, 0.5, 1.4, '#e53935', 3.5, 0.7, b.d / 2 + 1.5);
    sph(g, 0.5, 0.4, 0.5, '#e53935', 3.5, 1.4, b.d / 2 + 1.5, { hemi: true });
    box(g, 0.6, 0.1, 0.1, '#212121', 3.5, 1.15, b.d / 2 + 2.0);
  },

  restaurant(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, b.color, { roofColor: '#c0392b' });
    shopFront(g, b, { door: '#ffffff' });
    awning(g, b, '#e74c3c', '#ffffff');
    roofSign(g, b, h, '#fff3e0', '#c0392b');
    for (const s of [-1, 1]) {
      cyl(g, 0.6, 0.08, '#ffffff', s * (b.w / 2 - 1.6), 0.9, b.d / 2 + 2.6);
      cyl(g, 0.06, 0.9, '#888888', s * (b.w / 2 - 1.6), 0.45, b.d / 2 + 2.6, { low: true });
      cyl(g, 0.05, 2.4, '#888888', s * (b.w / 2 - 1.6), 1.6, b.d / 2 + 2.6, { low: true });
      cone(g, 1.4, 0.6, ctx.rng.pick(['#ff8a80', '#ffd180', '#a7ffeb']), s * (b.w / 2 - 1.6), 2.9, b.d / 2 + 2.6);
    }
  },

  prison(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#b0bec5', { roofColor: '#607d8b', bands: true, winKind: 'dark', frontStart: 1 });
    // 높은 담장 + 철조망 + 감시탑
    const W = b.w + 16, D = b.d + 16;
    for (const [x, z, w, d] of [[0, -D / 2, W, 0.8], [-W / 2, 0, 0.8, D], [W / 2, 0, 0.8, D], [-W / 4 - 2, D / 2, W / 2 - 4, 0.8], [W / 4 + 2, D / 2, W / 2 - 4, 0.8]]) {
      box(g, w, 5, d, '#90a4ae', x, 2.5, z);
      box(g, w + 0.2, 0.3, d + 0.2, '#546e7a', x, 5.4, z, { cast: false });
    }
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
      box(g, 2.4, 9, 2.4, '#78909c', x, 4.5, z);
      box(g, 3.4, 2, 3.4, '#455a64', x, 10, z);
      const lamp = sph(g, 0.4, 0.4, 0.4, toon('#fff59d', { emissive: '#ffeb3b', emissiveIntensity: 0.8 }), x, 11.2, z, { low: true }); void lamp;
    }
    // 정문 철창
    for (let i = 0; i < 8; i++) box(g, 0.1, 4.5, 0.1, '#37474f', -3.5 + i, 2.25, D / 2);
    box(g, 8, 0.3, 0.2, '#37474f', 0, 4.5, D / 2);
    door(g, b.d, '#37474f', { w: 2.4 });
    sign(g, b, 3.4, 8, '#263238', '#ffffff');
    // 경찰차 두 대
    simpleCar(g, '#ffffff', -6, b.d / 2 + 4, 0.3, 'police'); simpleCar(g, '#ffffff', 6, b.d / 2 + 4, -0.3, 'police');
    void h; void ctx;
  },

  hunter(g, b, ctx) {
    // 통나무 오두막
    const logs = ['#8d6e63', '#795548'];
    for (let i = 0; i < 8; i++) {
      for (const [x, z, w, d] of [[0, b.d / 2, b.w, 0.5], [0, -b.d / 2, b.w, 0.5], [b.w / 2, 0, 0.5, b.d], [-b.w / 2, 0, 0.5, b.d]]) {
        const m = cyl(g, 0.28, 1, logs[i % 2], x, 0.3 + i * 0.5, z, { rz: w > d ? Math.PI / 2 : 0, rx: w > d ? 0 : Math.PI / 2 });
        m.scale.set(0.28, Math.max(w, d) + 0.6, 0.28);
      }
    }
    gable(g, b.w, b.d, 4.1, 3, '#4e342e', 0.9);
    door(g, b.d, '#5d4037');
    // 문 위 사슴뿔 + 간판
    const ant = new THREE.Group(); ant.position.set(0, 3.6, b.d / 2 + 0.3); g.add(ant);
    for (const s of [-1, 1]) { const a = cyl(ant, 0.06, 1.2, '#efebe9', s * 0.35, 0.4, 0, { rz: s * -0.6 }); void a; cyl(ant, 0.05, 0.6, '#efebe9', s * 0.6, 0.8, 0, { rz: s * 0.4 }); }
    sph(ant, 0.25, 0.3, 0.25, '#8d6e63', 0, 0, 0.05);
    sign(g, b, 2.6, 5, '#4e342e', '#ffe0b2');
    // 장작더미 + 모닥불
    for (let i = 0; i < 6; i++) cyl(g, 0.2, 1.6, '#6d4c41', b.w / 2 + 1.5, 0.2 + Math.floor(i / 3) * 0.4, -1 + (i % 3) * 0.45, { rx: Math.PI / 2 });
    cyl(g, 1, 0.2, '#616161', -b.w / 2 - 3, 0.1, b.d / 2 + 2);
    sph(g, 0.5, 0.8, 0.5, toon('#ff9100', { emissive: '#ff6d00', emissiveIntensity: 0.9 }), -b.w / 2 - 3, 0.6, b.d / 2 + 2, { low: true });
    void ctx;
  },

  ranch(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff8e1', { roof: false, frontStart: 1 });
    gable(g, b.w, b.d, h, 3.2, '#c62828');
    shopFront(g, b, { door: '#c62828' });
    awning(g, b, '#c62828', '#ffffff');
    sign(g, b, h + 1, 8, '#ffffff', '#c62828');
    // 우유통 + 건초
    for (let i = 0; i < 3; i++) cyl(g, 0.35, 1.0, '#cfd8dc', -b.w / 2 + 1 + i * 0.8, 0.5, b.d / 2 + 1.6);
    cyl(g, 1, 1.4, '#ffd54f', b.w / 2 - 1.2, 0.9, b.d / 2 + 2, { rz: Math.PI / 2 });
    void ctx;
  },

  fishing(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#e1f5fe', { roofColor: '#0277bd', frontStart: 1 });
    shopFront(g, b);
    awning(g, b, '#0277bd', '#ffffff');
    roofSign(g, b, h, '#0277bd', '#ffffff');
    // 커다란 물고기 간판 + 낚싯대 진열
    const f = new THREE.Group(); f.position.set(b.w / 2 - 2.5, h + 1.4, -0.5); g.add(f);
    sph(f, 1.6, 0.9, 0.5, '#4fc3f7', 0, 0, 0); cone(f, 0.8, 1.2, '#29b6f6', -1.9, 0, 0).rotation.z = Math.PI / 2;
    sph(f, 0.18, 0.18, 0.1, '#ffffff', 1.0, 0.25, 0.4, { low: true });
    for (let i = 0; i < 4; i++) cyl(g, 0.04, 3.2, '#5d4037', -b.w / 2 + 1 + i * 0.4, 1.6, b.d / 2 + 0.6, { rz: 0.15, low: true });
    void ctx;
  },

  seafood(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff3e0', { roofColor: '#d84315', frontStart: 1 });
    shopFront(g, b, { door: '#d84315' });
    awning(g, b, '#d84315', '#fff3e0');
    roofSign(g, b, h, '#d84315', '#ffffff');
    // 앞 수족관
    const tank = new THREE.Mesh(G.box(), new THREE.MeshToonMaterial({ color: '#81d4fa', transparent: true, opacity: 0.55 }));
    tank.scale.set(3, 1.6, 1.2); tank.position.set(-b.w / 2 + 2.2, 0.9, b.d / 2 + 1.2); g.add(tank);
    for (let i = 0; i < 4; i++) sph(g, 0.25, 0.12, 0.08, ['#ff7043', '#90a4ae', '#ffca28', '#8d6e63'][i], -b.w / 2 + 1.2 + i * 0.6, 0.6 + (i % 2) * 0.5, b.d / 2 + 1.2, { low: true });
    void ctx;
  },

  range(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#cfd8c4', { roofColor: '#556b2f', frontStart: 1 });
    door(g, b.d, '#37474f', { w: 2.4 });
    roofSign(g, b, h, '#33691e', '#ffffff');
    // 커다란 과녁 간판
    const t = new THREE.Group(); t.position.set(-b.w / 2 + 2.2, h + 2.2, b.d / 2 - 1); g.add(t);
    ['#ffffff', '#e53935', '#ffffff', '#e53935', '#ffd54f'].forEach((c, i) => { const m = cyl(t, 1.6 - i * 0.32, 0.12 + i * 0.02, c, 0, 0, 0, { rx: Math.PI / 2 }); void m; });
    for (const s of [-1, 1]) box(g, 0.4, 1.2, 0.4, '#795548', s * (b.w / 2 - 1), 0.6, b.d / 2 + 1.4);
    void ctx;
  },

  magicshop(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#d1c4e9', { roof: false, frontStart: 1 });
    // 뾰족 마법사 지붕 + 별
    const roof = new THREE.Mesh(new THREE.ConeGeometry(b.w * 0.62, 6, 4), toon('#4527a0'));
    roof.rotation.y = Math.PI / 4; roof.position.set(0, h + 3, 0); roof.castShadow = true; g.add(roof);
    sph(g, 0.6, 0.6, 0.6, toon('#ffeb3b', { emissive: '#ffd54f', emissiveIntensity: 0.8 }), 0, h + 6.3, 0);
    shopFront(g, b, { door: '#311b92' });
    awning(g, b, '#5e35b1', '#ede7f6');
    sign(g, b, 3.6, Math.min(b.w * 0.75, 8), '#311b92', '#ffeb3b');
    // 거대한 지팡이
    cyl(g, 0.15, 4.5, '#5d4037', b.w / 2 + 0.6, 2.25, b.d / 2 - 1);
    sph(g, 0.5, 0.5, 0.5, toon('#e040fb', { emissive: '#e040fb', emissiveIntensity: 0.7 }), b.w / 2 + 0.6, 4.7, b.d / 2 - 1);
    void ctx;
  },

  dealer(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#eceff1', { roofColor: '#212121', frontStart: 2 });
    // 통유리 쇼룸
    const gl = windowPlane(g, b.w - 1.2, FH * 2 - 0.6, b.w - 1.2, FH * 2 - 0.6, 'dark');
    gl.position.set(0, FH, b.d / 2 + 0.05);
    door(g, b.d, '#ffffff', { glass: true, w: 2.4 });
    roofSign(g, b, h, '#212121', '#ff1744');
    // 앞마당 전시 스포츠카
    const car = makeCarMesh('sport_f', '#e53935');
    car.g.position.set(b.w / 2 - 2.6, 0, b.d / 2 + 3.2); car.g.rotation.y = -0.6; car.g.scale.setScalar(0.9);
    g.add(car.g);
    ctx.colliders.push({ minX: b.x + (b.dir === 1 ? b.w / 2 - 4.8 : -b.w / 2 + 0.4), maxX: b.x + (b.dir === 1 ? b.w / 2 - 0.4 : -b.w / 2 + 4.8), minZ: b.z + b.dir * (b.d / 2 + 1.4) - (b.dir === 1 ? 0 : 3.6), maxZ: b.z + b.dir * (b.d / 2 + 1.4) + (b.dir === 1 ? 3.6 : 0), h: 1.4, small: true });
  },

  pizza(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff3e0', { roofColor: '#c62828', frontStart: 1 });
    shopFront(g, b);
    awning(g, b, '#c62828', '#ffffff');
    roofSign(g, b, h, '#ffffff', '#c62828');
    // 지붕 위 피자 한 판
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 20), toon('#ffca28'));
    p.position.set(b.w / 2 - 2.4, h + 1.6, -1.5); p.rotation.x = 1.2; p.castShadow = true; g.add(p);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; sph(p, 0.28, 0.6, 0.28, '#d32f2f', Math.cos(a) * 1.0, 0.2, Math.sin(a) * 1.0, { low: true, cast: false }); }
    // 배달 오토바이
    box(g, 0.6, 0.8, 1.6, '#c62828', -b.w / 2 + 1.2, 0.6, b.d / 2 + 2.2);
    box(g, 0.8, 0.6, 0.7, '#ffffff', -b.w / 2 + 1.2, 1.3, b.d / 2 + 1.7);
    void ctx;
  },

  chicken(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff8e1', { roofColor: '#ff8f00', frontStart: 1 });
    shopFront(g, b);
    awning(g, b, '#ffb300', '#ffffff');
    roofSign(g, b, h, '#ffb300', '#4e342e');
    // 대형 닭다리
    const leg = new THREE.Group(); leg.position.set(-b.w / 2 + 2.2, h + 1.6, -1.2); leg.rotation.z = 0.6; g.add(leg);
    sph(leg, 1.0, 1.3, 1.0, '#e0a050', 0, 0.6, 0);
    cyl(leg, 0.25, 1.4, '#fff8e1', 0, -0.9, 0, { low: true });
    sph(leg, 0.35, 0.35, 0.35, '#fff8e1', 0, -1.6, 0, { low: true });
    // 야외 테이블 (치맥)
    cyl(g, 0.7, 0.08, '#ffffff', b.w / 2 - 1.6, 0.9, b.d / 2 + 2.6);
    cyl(g, 0.06, 0.9, '#888888', b.w / 2 - 1.6, 0.45, b.d / 2 + 2.6, { low: true });
    void ctx;
  },

  chinese(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#ffebee', { roofColor: '#b71c1c', trim: '#ffd54f' });
    shopFront(g, b, { door: '#b71c1c' });
    // 기와 처마
    box(g, b.w + 1.2, 0.3, 2.0, '#b71c1c', 0, 3.1, b.d / 2 + 0.8);
    for (const s2 of [-1, 1]) { const t = box(g, 0.8, 0.25, 0.5, '#b71c1c', s2 * (b.w / 2 + 0.6), 3.35, b.d / 2 + 1.6); void t; }
    // 홍등
    for (const s2 of [-1, 1]) {
      sph(g, 0.45, 0.55, 0.45, toon('#ff1744', { emissive: '#ff1744', emissiveIntensity: 0.4 }), s2 * (b.w / 2 - 1.5), 2.3, b.d / 2 + 1.4, { low: true });
      cyl(g, 0.2, 0.12, '#ffd54f', s2 * (b.w / 2 - 1.5), 2.9, b.d / 2 + 1.4, { low: true });
    }
    roofSign(g, b, h, '#b71c1c', '#ffd54f');
    void ctx;
  },

  gukbap(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#efebe9', { roofColor: '#5d4037', trim: '#8d6e63' });
    shopFront(g, b, { door: '#8d6e63' });
    // 나무 간판 + 가마솥
    box(g, b.w - 1.5, 1.1, 0.25, '#6d4c41', 0, h - 0.8, b.d / 2 + 0.2);
    const s = signMesh(b.name, b.def.emoji, b.w - 2, '#6d4c41', '#fff8e1');
    s.position.set(0, h - 0.8, b.d / 2 + 0.36); g.add(s);
    b.signMesh = s;
    sph(g, 0.9, 0.7, 0.9, '#37474f', b.w / 2 - 1.3, 0.75, b.d / 2 + 1.8);
    cyl(g, 1.0, 0.12, '#263238', b.w / 2 - 1.3, 1.35, b.d / 2 + 1.8);
    smoke(ctx, g, b.w / 2 - 1.3, 1.6, b.d / 2 + 1.8);
    void ctx;
  },

  burger(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fffde7', { roofColor: '#e53935', frontStart: 1 });
    shopFront(g, b);
    awning(g, b, '#e53935', '#ffd54f');
    roofSign(g, b, h, '#ffd54f', '#c62828');
    const bg = new THREE.Group(); bg.position.set(b.w / 2 - 2.2, h + 1.2, -1.5); g.add(bg);
    sph(bg, 1.3, 0.8, 1.3, '#e0a050', 0, 0.6, 0, { hemi: true });
    cyl(bg, 1.35, 0.35, '#6d4c41', 0, 0.35, 0);
    cyl(bg, 1.45, 0.12, '#8bc34a', 0, 0.12, 0);
    cyl(bg, 1.3, 0.35, '#e0a050', 0, -0.1, 0);
    void ctx;
  },

  bunsik(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fce4ec', { roofColor: '#f06292', frontStart: 1 });
    shopFront(g, b);
    awning(g, b, '#f06292', '#ffffff');
    roofSign(g, b, h, '#ffffff', '#d81b60');
    // 떡볶이 철판 노점
    box(g, 2.4, 1.0, 1.2, '#b0bec5', -b.w / 2 + 1.8, 0.5, b.d / 2 + 2.0);
    box(g, 2.2, 0.15, 1.0, '#e53935', -b.w / 2 + 1.8, 1.07, b.d / 2 + 2.0);
    for (let i = 0; i < 6; i++) box(g, 0.3, 0.1, 0.1, '#ff7043', -b.w / 2 + 1.0 + i * 0.3, 1.18, b.d / 2 + 1.8 + (i % 2) * 0.3, { cast: false });
    void ctx;
  },

  cafe(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, b.color, { roofColor: '#6d4c41' });
    shopFront(g, b);
    awning(g, b, '#2e7d32', '#f1f8e9');
    roofSign(g, b, h, '#efebe9', '#4e342e');
    // 대형 커피잔
    cyl(g, 1.3, 1.8, '#ffffff', -b.w / 2 + 2.2, h + 1.3, -1);
    cyl(g, 1.15, 0.1, '#6d4c41', -b.w / 2 + 2.2, h + 2.2, -1);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.15, 8, 16), toon('#ffffff'));
    handle.position.set(-b.w / 2 + 3.6, h + 1.3, -1); g.add(handle);
    void ctx;
  },

  bakery(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#ffe0b2', { roofColor: '#8d6e63' });
    shopFront(g, b);
    awning(g, b, '#8d6e63', '#fff8e1');
    roofSign(g, b, h, '#fff8e1', '#6d4c41');
    const croissant = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.6, 10, 16, Math.PI * 1.2), toon('#e0a050'));
    croissant.position.set(b.w / 2 - 2.5, h + 1.2, -1); croissant.rotation.x = -Math.PI / 2; croissant.castShadow = true;
    g.add(croissant);
    void ctx;
  },

  convenience(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#ffffff', { roofColor: '#eeeeee', frontStart: 1 });
    box(g, b.w + 0.1, 0.4, b.d + 0.1, '#43a047', 0, h - 0.6, 0, { cast: false });
    box(g, b.w + 0.1, 0.3, b.d + 0.1, '#ff9800', 0, h - 0.95, 0, { cast: false });
    shopFront(g, b);
    sign(g, b, 2.95, Math.min(7, b.w * 0.7), '#ffffff', '#2e7d32');
    box(g, 1.0, 1.6, 0.8, '#90caf9', b.w / 2 - 1.2, 0.8, b.d / 2 + 1.0);
  },

  supermarket(g, b) {
    shell(g, b.w, b.d, b.floors, '#e8f5e9', { roofColor: '#2e7d32', frontStart: 1 });
    const m = windowPlane(g, b.w - 8, 2.4, 2.6, 2.4, 'dark');
    m.position.set(0, 1.5, b.d / 2 + 0.05);
    door(g, b.d, '#ffffff', { glass: true, w: 3.2 });
    sign(g, b, FH + 1.6, 10, '#2e7d32', '#ffffff');
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group(); c.position.set(b.w / 2 - 3 - i * 0.5, 0, b.d / 2 + 1.6); g.add(c);
      box(c, 0.9, 0.6, 1.2, '#b0bec5', 0, 0.8, 0);
    }
  },

  pharmacy(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#f1f8e9', { roofColor: '#43a047' });
    shopFront(g, b);
    roofSign(g, b, h, '#ffffff', '#2e7d32');
    box(g, 0.3, 1.8, 0.6, '#43a047', b.w / 2 + 0.3, 3.6, b.d / 2 - 0.5);
    box(g, 0.3, 0.6, 1.8, '#43a047', b.w / 2 + 0.3, 3.6, b.d / 2 - 0.5);
  },

  vet(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#e3f2fd', { roofColor: '#1e88e5' });
    shopFront(g, b);
    roofSign(g, b, h, '#ffffff', '#1565c0');
    // 작은 개미집
    box(g, 1.6, 1.2, 1.4, '#ffcc80', b.w / 2 - 1.2, 0.6, b.d / 2 + 1.6);
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 4), toon('#e65100'));
    r.position.set(b.w / 2 - 1.2, 1.6, b.d / 2 + 1.6); r.rotation.y = Math.PI / 4; g.add(r);
  },

  dental(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#e0f7fa', { roofColor: '#00acc1' });
    shopFront(g, b);
    roofSign(g, b, h, '#ffffff', '#00838f');
    sph(g, 1.2, 1.0, 1.0, '#ffffff', -b.w / 2 + 2.2, h + 2.2, -1);
    cone(g, 0.4, 1.4, '#ffffff', -b.w / 2 + 1.7, h + 1.0, -1).rotation.x = Math.PI;
    cone(g, 0.4, 1.4, '#ffffff', -b.w / 2 + 2.7, h + 1.0, -1).rotation.x = Math.PI;
  },

  salon(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fce4ec', { roofColor: '#ec407a' });
    shopFront(g, b);
    awning(g, b, '#ec407a', '#ffffff');
    roofSign(g, b, h, '#ffffff', '#ad1457');
    const pole = new THREE.Mesh(G.cyl(), stripeMat('#e53935', '#ffffff', 8));
    pole.scale.set(0.3, 2, 0.3); pole.position.set(b.w / 2 - 0.5, 1.6, b.d / 2 + 0.5); pole.rotation.z = 0.0;
    dynamicMesh(pole); g.add(pole);
    ctx.anim.spins.push({ obj: pole, speed: 2 });
  },

  clothing(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#f3e5f5', { roofColor: '#8e24aa' });
    shopFront(g, b);
    roofSign(g, b, h, '#ffffff', '#6a1b9a');
    for (const s of [-1, 1]) {
      cyl(g, 0.05, 1.2, '#9e9e9e', s * (b.w / 4 + 0.6), 0.6, b.d / 2 - 0.4, { low: true });
      sph(g, 0.4, 0.55, 0.3, ctx.rng.pick(['#ff80ab', '#80d8ff', '#ffff8d', '#b9f6ca']), s * (b.w / 4 + 0.6), 1.5, b.d / 2 - 0.4);
      sph(g, 0.3, 0.3, 0.3, '#f5f5f5', s * (b.w / 4 + 0.6), 2.2, b.d / 2 - 0.4);
    }
  },

  bookstore(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#efebe9', { roofColor: '#5d4037' });
    shopFront(g, b);
    awning(g, b, '#5d4037', '#d7ccc8');
    roofSign(g, b, h, '#fff8e1', '#4e342e');
    const cols = ['#e57373', '#64b5f6', '#81c784', '#ffd54f'];
    for (let i = 0; i < 4; i++) box(g, 3 - i * 0.2, 0.6, 2, cols[i], b.w / 2 - 2.5, h + 0.75 + i * 0.6, -1.5, { ry: i * 0.15 });
  },

  gallery(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fafafa', { roofColor: '#212121', windows: false });
    const cols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    for (let i = 0; i < 5; i++) box(g, ctx.rng.range(1.5, 3.5), ctx.rng.range(1.5, 3.5), 0.2, cols[i], ctx.rng.range(-b.w / 2 + 2, b.w / 2 - 2), ctx.rng.range(3.2, h - 1.4), b.d / 2 + 0.1, { cast: false });
    door(g, b.d, '#212121', { glass: true });
    sign(g, b, 3.0, 5.5, '#212121', '#ffffff');
    sph(g, 1.4, 1.4, 1.4, '#ff8a65', b.w / 2 - 2, h + 1.4, 0);
  },

  flowershop(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff0f5', { roofColor: '#f06292' });
    shopFront(g, b);
    awning(g, b, '#81c784', '#ffffff');
    roofSign(g, b, h, '#ffffff', '#c2185b');
    for (let i = 0; i < 6; i++) {
      const x = -b.w / 2 + 1.2 + i * 0.9;
      cyl(g, 0.3, 0.5, '#a1887f', x, 0.25, b.d / 2 + 1.4, { low: true });
      sph(g, 0.4, 0.4, 0.4, ctx.rng.pick(['#ff4081', '#ffeb3b', '#e040fb', '#ff6e40', '#ffffff']), x, 0.75, b.d / 2 + 1.4, { ico: true });
    }
  },

  realestate(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#e0f2f1', { roofColor: '#00897b' });
    shopFront(g, b);
    roofSign(g, b, h, '#ffffff', '#00695c');
    box(g, 2.4, 1.8, 0.4, '#ffcc80', -b.w / 2 + 2, h + 1.4, -1.5);
    const r = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.3, 4), toon('#e64a19'));
    r.position.set(-b.w / 2 + 2, h + 2.9, -1.5); r.rotation.y = Math.PI / 4; g.add(r);
  },

  bank(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#e0e0e0', { roofColor: '#9e9e9e', frontStart: 0 });
    columns(g, 4, 12, b.d / 2 + 1.4, h - 0.5, '#fafafa');
    box(g, 14, 0.6, 3, '#fafafa', 0, h - 0.2, b.d / 2 + 1.2);
    door(g, b.d, '#5d4037', { w: 2.6, h: 3 });
    sign(g, b, 3.9, 6, '#1a237e', '#ffd54f', b.d / 2 + 2.6);
    cyl(g, 2, 0.5, '#ffd54f', b.w / 2 - 3, h + 2.4, 0, { rx: Math.PI / 2 });
    cyl(g, 1.6, 0.55, '#ffca28', b.w / 2 - 3, h + 2.4, 0, { rx: Math.PI / 2 });
  },

  office(g, b, ctx) {
    const color = ctx.rng.pick(['#b3c7e6', '#c5d9e8', '#d7ccc8', '#cfd8dc', '#b2dfdb']);
    const h = shell(g, b.w, b.d, b.floors, color, { winKind: 'dark', roofColor: shade(color, 0.7), cellW: 2.2, frontStart: 1 });
    const m = windowPlane(g, b.w - 8, 2.6, 2.6, 2.6, 'dark'); m.position.set(0, 1.6, b.d / 2 + 0.05);
    door(g, b.d, '#ffffff', { glass: true, w: 3 });
    sign(g, b, 3.25, 7, '#263238', '#ffffff');
    cyl(g, 0.12, 6, '#90a4ae', b.w / 4, h + 3, 0, { low: true });
    const tip = dynamicMesh(sph(g, 0.3, 0.3, 0.3, toon('#ff1744', { emissive: '#ff1744' }), b.w / 4, h + 6.1, 0));
    ctx.anim.blinks.push({ obj: tip, a: tip.material, b: toon('#5a1a1a'), rate: 1, o: 0 });
    box(g, 6, 2, 4, shade(color, 0.85), -b.w / 4, h + 1.2, 0);
  },

  tvstation(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#ede7f6', { roofColor: '#5e35b1', frontStart: 1 });
    door(g, b.d, '#ffffff', { glass: true, w: 3 });
    sign(g, b, 3.25, 7, '#5e35b1', '#ffffff');
    // 대형 스크린
    const scr = new THREE.Mesh(G.plane(), new THREE.MeshBasicMaterial({ color: '#4fc3f7' }));
    scr.scale.set(8, 4.5, 1); scr.position.set(-b.w / 4, h - 4, b.d / 2 + 0.3); g.add(scr);
    dynamicMesh(scr);
    const cols = ['#4fc3f7', '#ff8a80', '#b9f6ca', '#ffd180'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    ctx.anim.blinks.push({ obj: scr, a: cols[0], b: cols[1], rate: 0.5, o: 0 });
    // 송신탑
    for (let i = 0; i < 4; i++) box(g, 1.2 - i * 0.25, 4, 1.2 - i * 0.25, i % 2 ? '#ffffff' : '#e53935', b.w / 3, h + 2 + i * 4, -2);
    const dish = sph(g, 2, 2, 0.8, '#eceff1', -b.w / 3, h + 2, -1, { hemi: true });
    dish.rotation.x = -Math.PI / 2 - 0.5;
  },

  library(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#f3e0c7', { roofColor: '#8d6e63', frontStart: 0 });
    columns(g, 4, 10, b.d / 2 + 1.4, h - 0.4, '#fffaf0');
    box(g, 12, 0.6, 3, '#fffaf0', 0, h - 0.1, b.d / 2 + 1.2);
    door(g, b.d, '#6d4c41', { w: 2.4, h: 2.9 });
    sign(g, b, 3.9, 6.5, '#4e342e', '#fff8e1', b.d / 2 + 2.6);
  },

  museum(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#f5efe0', { roofColor: '#d6ccb4', frontStart: 0 });
    for (let i = 0; i < 4; i++) box(g, 24 - i * 1.2, 0.3, 1.2, '#e6dcc6', 0, 0.15 + i * 0.3, b.d / 2 + 4.6 - i * 0.6);
    columns(g, 8, 22, b.d / 2 + 2.4, h - 0.6, '#fffaf0', 0.5);
    box(g, 24, 0.7, 4.6, '#fffaf0', 0, h, b.d / 2 + 2.2);
    pediment(g, 24, h + 0.35, b.d / 2 + 2.2, 4.6, '#fffaf0');
    door(g, b.d, '#6d4c41', { w: 3, h: 3.6 });
    sign(g, b, h - 2.0, 10, '#3e2723', '#ffe082', b.d / 2 + 4.6);
    // 거대 곰돌이 화석 조각상
    box(g, 4, 1.2, 4, '#bcaaa4', -9, 0.6, b.d / 2 + 10);
    const statue = new Roach({ color: '#e8dcc0', age: 40 });
    statue.root.scale.setScalar(2.2);
    statue.root.position.set(-9, 1.2, b.d / 2 + 10);
    statue.arms[1].rotation.z = 2.4;
    statue.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(statue.root);
    ctx.colliders.push(worldBox(g, -9, b.d / 2 + 10, 2.2, 2.2));
    ctx.addTree(g, 9, b.d / 2 + 10, 1.2);
    fixTreeColliders(ctx, g, 1);
  },

  gym(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#455a64', { roofColor: '#263238', winKind: 'dark' });
    box(g, b.w + 0.1, 0.35, b.d + 0.1, '#ff1744', 0, h - 0.4, 0, { cast: false });
    shopFront(g, b);
    sign(g, b, 3.0, 7, '#ff1744', '#ffffff');
    cyl(g, 0.25, 7, '#b0bec5', 0, h + 2, 0, { rz: Math.PI / 2 });
    for (const s of [-1, 1]) cyl(g, 1.4, 0.8, '#212121', s * 3.2, h + 2, 0, { rz: Math.PI / 2 });
    void ctx;
  },

  hotel(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff3e0', { roofColor: '#c9a227', trim: '#c9a227', bands: true });
    box(g, 8, 0.4, 4.5, '#8e1d2c', 0, 3.2, b.d / 2 + 2.2);
    for (const s of [-1, 1]) cyl(g, 0.15, 3.1, '#c9a227', s * 3.7, 1.55, b.d / 2 + 4.2, { low: true });
    box(g, 2.5, 0.03, 6, '#b71c1c', 0, 0.04, b.d / 2 + 2.6, { cast: false });
    door(g, b.d, '#ffffff', { glass: true, w: 3 });
    const s = signMesh(b.name, b.def.emoji, 9, '#8e1d2c', '#ffe082');
    s.position.set(0, h + 1.6, b.d / 2 - 0.4); g.add(s);
    for (const sx of [-1, 1]) {
      cyl(g, 0.07, 7, '#cfd8dc', sx * 6, 3.5, b.d / 2 + 4.5, { low: true });
      const f = dynamicMesh(box(g, 1.6, 1.0, 0.05, sx > 0 ? '#ffd54f' : '#8e1d2c', sx * 6 + 0.8, 6.4, b.d / 2 + 4.5));
      ctx.anim.flags.push({ obj: f, o: sx * 2 });
    }
  },

  cinema(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#7e57c2', { roofColor: '#4527a0', winKind: 'dark', frontStart: 3 });
    door(g, b.d, '#ffffff', { glass: true, w: 3.2 });
    box(g, 14, 2.4, 1.2, '#311b92', 0, 4.2, b.d / 2 + 0.6);
    sign(g, b, 4.2, 9, '#ffd54f', '#311b92', b.d / 2 + 1.1);
    const on = toon('#fff59d', { emissive: '#ffeb3b', emissiveIntensity: 1 }), off = toon('#8d6e63');
    for (let i = 0; i < 14; i++) {
      const bulb = dynamicMesh(sph(g, 0.16, 0.16, 0.16, on, -6.6 + i * 1.02, 5.55, b.d / 2 + 1.25, { low: true, cast: false }));
      ctx.anim.blinks.push({ obj: bulb, a: on, b: off, rate: 4, o: i });
    }
    const posters = ['#ff7043', '#29b6f6', '#66bb6a', '#ec407a'];
    for (let i = 0; i < 4; i++) box(g, 2.2, 3.2, 0.1, posters[i], (i < 2 ? -1 : 1) * (5 + (i % 2) * 3), 1.9, b.d / 2 + 0.08, { cast: false });
  },

  concerthall(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fce4ec', { roofColor: '#ad1457', roof: false, frontStart: 1 });
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2 + 0.6, b.d / 2 + 0.6, b.w + 0.6, 24, 1, false, 0, Math.PI), toon('#c2185b'));
    roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.rotation.x = 0;
    roof.position.set(0, h, 0);
    roof.rotation.set(0, 0, Math.PI / 2);
    roof.castShadow = true; g.add(roof);
    door(g, b.d, '#ffffff', { glass: true, w: 3 });
    sign(g, b, 3.2, 7.5, '#ad1457', '#ffffff');
    const note = new THREE.Group(); note.position.set(b.w / 2 - 3, h + b.d / 2 + 1, 0); g.add(note);
    sph(note, 0.8, 0.6, 0.6, '#212121', 0, 0, 0);
    box(note, 0.2, 3, 0.2, '#212121', 0.7, 1.5, 0);
    box(note, 1.2, 0.4, 0.2, '#212121', 1.2, 2.8, 0, { rz: -0.4 });
    void ctx;
  },

  factory(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#cfd8dc', { roofColor: '#78909c', roof: false });
    for (let i = 0; i < 5; i++) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(b.w / 5, 0); shape.lineTo(b.w / 5, 2.4); shape.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: b.d, bevelEnabled: false }), toon(i % 2 ? '#90a4ae' : '#78909c'));
      m.position.set(-b.w / 2 + i * b.w / 5, h, -b.d / 2); m.castShadow = true; g.add(m);
    }
    door(g, b.d, '#ffb74d', { w: 4, h: 3.4 });
    sign(g, b, 4.8, 8, '#ffb74d', '#3e2723');
    for (const [x, z] of [[-b.w / 2 + 3, -b.d / 2 + 3], [-b.w / 2 + 7, -b.d / 2 + 3]]) {
      const ch = new THREE.Mesh(G.cyl(), stripeMat('#e53935', '#ffffff', 2));
      ch.scale.set(1.0, 12, 1.0); ch.position.set(x, h + 6, z); ch.castShadow = true; g.add(ch);
      smoke(ctx, g, x, h + 12.5, z);
    }
    cyl(g, 2.5, 6, '#b0bec5', b.w / 2 - 3, 3, b.d / 2 + 4);
    sph(g, 2.5, 1, 2.5, '#b0bec5', b.w / 2 - 3, 6, b.d / 2 + 4, { hemi: true });
    ctx.colliders.push(worldBox(g, b.w / 2 - 3, b.d / 2 + 4, 2.6, 2.6));
    // 박스 더미
    for (let i = 0; i < 5; i++) box(g, 1.2, 1.2, 1.2, '#d7a86e', -b.w / 2 + 2 + (i % 3) * 1.3, 0.6 + Math.floor(i / 3) * 1.2, b.d / 2 + 2);
  },

  construction(g, b, ctx) {
    // 현장 사무소 컨테이너(입구)
    shell(g, b.w, b.d, 1, '#ffb300', { roofColor: '#ff8f00', frontStart: 0, cellW: 2.4 });
    door(g, b.d, '#ffffff');
    sign(g, b, 3.9, 8, '#212121', '#ffeb3b');
    // 건설 중인 골조 (블록 중앙)
    const fx = -14, fz = -8;
    const frame = new THREE.Group(); frame.position.set(fx, 0, fz); g.add(frame);
    const levels = 5;
    for (let l = 0; l < levels; l++) {
      box(frame, 14, 0.4, 12, '#bdbdbd', 0, (l + 1) * 3.6, 0);
      for (const x of [-6.5, 0, 6.5]) for (const z of [-5.5, 5.5]) box(frame, 0.5, 3.6, 0.5, '#9e9e9e', x, l * 3.6 + 1.8, z);
    }
    for (let i = 0; i < 6; i++) box(frame, 0.12, 2, 12, '#ff9800', -6.8, levels * 3.6 + 1.2, 0, { cast: false });
    ctx.colliders.push(worldBox(g, fx, fz, 7.2, 6.2));
    // 크레인
    const crane = new THREE.Group(); crane.position.set(fx + 12, 0, fz - 2); g.add(crane);
    for (let i = 0; i < 9; i++) box(crane, 1.4, 3, 1.4, i % 2 ? '#fdd835' : '#f9a825', 0, 1.5 + i * 3, 0);
    const jib = new THREE.Group(); jib.position.set(fx + 12, 27.5, fz - 2); g.add(jib);
    jib.userData.dynamic = true;
    box(jib, 22, 0.9, 1.0, '#fdd835', -7, 0, 0);
    box(jib, 2.4, 2.0, 2.4, '#f57f17', 3.4, 0, 0);
    cyl(jib, 0.04, 8, '#424242', -14, -4, 0, { low: true });
    box(jib, 1.6, 0.8, 1.6, '#795548', -14, -8.2, 0);
    ctx.anim.cranes.push({ obj: jib });
    ctx.colliders.push(worldBox(g, fx + 12, fz - 2, 0.9, 0.9));
    // 펜스
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(G.box(), stripeMat('#ff9800', '#ffffff', 6));
      p.scale.set(3.2, 1.6, 0.15); p.position.set(-24 + i * 3.3, 0.8, 4.2); g.add(p);
    }
    for (let i = 0; i < 5; i++) cone(g, 0.3, 0.8, '#ff6d00', -8 + i * 1.6, 0.4, 5.5);
    // 흙더미
    sph(g, 3, 1.6, 3, '#a1887f', -24, 0, -14, { hemi: true });
  },

  garage(g, b, ctx) {
    shell(g, b.w, b.d, b.floors, '#e3f2fd', { roofColor: '#1565c0', frontStart: 1 });
    door(g, b.d, '#ffffff', { glass: true });
    sign(g, b, 3.0, 7, '#1565c0', '#ffffff');
    // 주유 캐노피 (건물 옆)
    const cx = -18;
    box(g, 12, 0.6, 8, '#ffffff', cx, 5, 2);
    box(g, 12.1, 0.3, 8.1, '#1e88e5', cx, 4.7, 2);
    for (const sx of [-5, 5]) for (const sz of [-1.5, 5.5]) cyl(g, 0.25, 4.6, '#cfd8dc', cx + sx, 2.3, sz, { low: true });
    for (const sx of [-2, 2]) {
      box(g, 0.8, 1.8, 0.6, '#e53935', cx + sx, 0.9, 2);
      box(g, 0.6, 0.4, 0.62, '#ffffff', cx + sx, 1.4, 2);
      ctx.colliders.push(worldBox(g, cx + sx, 2, 0.5, 0.4));
    }
    simpleCar(g, '#fbc02d', cx + 4, 6.5, 0, 'taxi');
    // 정비 리프트 공간
    box(g, 4.5, 3.2, 0.2, '#90a4ae', 0, 1.6, -b.d / 2 - 0.05);
  },

  lab(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#f5f5f5', { roofColor: '#b0bec5', winKind: 'dark', cellW: 2.2 });
    box(g, b.w + 0.1, 0.25, b.d + 0.1, '#00bcd4', 0, FH, 0, { cast: false });
    door(g, b.d, '#ffffff', { glass: true, w: 2.8 });
    sign(g, b, 3.0, 7, '#00838f', '#ffffff');
    sph(g, 4, 4, 4, new THREE.MeshToonMaterial({ color: '#b2ebf2', transparent: true, opacity: 0.75 }), -b.w / 4, h + 0.4, 0, { hemi: true });
    cyl(g, 0.1, 5, '#90a4ae', b.w / 3, h + 2.5, 0, { low: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 20), toon('#00e5ff', { emissive: '#00bcd4', emissiveIntensity: 0.6 }));
    ring.position.set(b.w / 3, h + 5, 0); dynamicMesh(ring); g.add(ring);
    ctx.anim.spins.push({ obj: ring, speed: 1.5 });
  },

  armory_3k(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#c62828', { roof: false, frontStart: 1, winKind: 'wood', trim: '#4e342e' });
    // 겹처마 지붕
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(new THREE.ConeGeometry((b.w * 0.82) - i * 3, 2.2, 4), toon(i ? '#2e7d32' : '#1b5e20'));
      r.position.set(0, h + 1 + i * 1.8, 0); r.rotation.y = Math.PI / 4; r.scale.z = b.d / b.w; r.castShadow = true; g.add(r);
    }
    for (const sx of [-1, 1]) cyl(g, 0.3, h, '#8e1b1b', sx * (b.w / 2 - 0.6), h / 2, b.d / 2 + 0.6);
    door(g, b.d, '#4e342e', { w: 2.4 });
    sign(g, b, 3.1, 5.6, '#fff3e0', '#b71c1c');
    for (const sx of [-1, 1]) {
      const f = dynamicMesh(box(g, 0.9, 2.2, 0.05, '#ffca28', sx * (b.w / 2 + 0.6), 2.4, b.d / 2 + 0.8));
      ctx.anim.flags.push({ obj: f, o: sx });
      cyl(g, 0.05, 3.6, '#5d4037', sx * (b.w / 2 + 0.15), 1.8, b.d / 2 + 0.8, { low: true });
    }
    // 무기 거치대
    const rack = new THREE.Group(); rack.position.set(-b.w / 2 + 1.5, 0, b.d / 2 + 1.6); g.add(rack);
    box(rack, 1.6, 0.15, 0.4, '#5d4037', 0, 1.6, 0);
    for (let i = 0; i < 3; i++) box(rack, 0.06, 2.2, 0.06, '#cfd8dc', -0.5 + i * 0.5, 1.1, 0);
  },

  armory_mil(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#6b7b3a', { roofColor: '#3e4a1e', frontStart: 1, trim: '#3e4a1e' });
    for (let i = 0; i < 5; i++) box(g, ctx.rng.range(1.5, 3), ctx.rng.range(1, 2.5), 0.05, ctx.rng.pick(['#4a5d23', '#8b7d4b', '#33401a']), ctx.rng.range(-b.w / 2 + 1.5, b.w / 2 - 1.5), ctx.rng.range(3.6, h - 0.8), b.d / 2 + 0.04, { cast: false });
    door(g, b.d, '#33401a', { w: 2.4 });
    sign(g, b, 3.1, 5.6, '#212121', '#c0ca33');
    // 모래주머니 & 드럼통
    for (let i = 0; i < 6; i++) sph(g, 0.45, 0.25, 0.3, '#c2b280', -b.w / 2 + 1 + (i % 3) * 0.85, 0.25 + Math.floor(i / 3) * 0.45, b.d / 2 + 1.6);
    cyl(g, 0.4, 1.2, '#2e7d32', b.w / 2 - 1.2, 0.6, b.d / 2 + 1.5);
    // 지붕 위 미니 탱크
    const t = new THREE.Group(); t.position.set(0, h + 0.4, -0.5); g.add(t);
    box(t, 3, 0.9, 4.4, '#556b2f', 0, 0.6, 0);
    sph(t, 1.0, 0.6, 1.1, '#4a5d23', 0, 1.2, -0.2);
    cyl(t, 0.13, 2.4, '#33401a', 0, 1.3, 1.2, { rx: Math.PI / 2 });
  },

  armory_sf(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#eceff1', { roofColor: '#90a4ae', winKind: 'dark', frontStart: 1, cellW: 2.2 });
    box(g, b.w + 0.1, 0.18, b.d + 0.1, toon('#18ffff', { emissive: '#00e5ff', emissiveIntensity: 0.8 }), 0, 3.4, 0, { cast: false });
    door(g, b.d, '#263238', { glass: true, w: 2.4 });
    sign(g, b, 3.0, 5.6, '#0d1b2a', '#18ffff');
    sph(g, 2.6, 2.6, 2.6, '#b0bec5', 0, h + 0.4, -1, { hemi: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 30), toon('#ff1744', { emissive: '#ff1744', emissiveIntensity: 0.8 }));
    ring.position.set(0, h + 1.5, -1); ring.rotation.x = Math.PI / 2; dynamicMesh(ring); g.add(ring);
    ctx.anim.spins.push({ obj: ring, speed: 0.8, axis: 'z' });
    // 홀로그램 빛 막대
    const saber = new THREE.Mesh(G.cylLow(), new THREE.MeshBasicMaterial({ color: '#40c4ff', transparent: true, opacity: 0.8 }));
    saber.scale.set(0.12, 3, 0.12); saber.position.set(b.w / 2 - 1, 2, b.d / 2 + 1); saber.rotation.z = 0.4; dynamicMesh(saber); g.add(saber);
  },

  jeweler(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#4a148c', { roofColor: '#ffd54f', frontStart: 1, trim: '#ffd54f' });
    shopFront(g, b, { door: '#ffd54f' });
    awning(g, b, '#6a1b9a', '#ffd54f');
    roofSign(g, b, h, '#4a148c', '#ffd54f');
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), toon('#b2ebf2', { emissive: '#80deea', emissiveIntensity: 0.5 }));
    dia.position.set(-b.w / 2 + 2.2, h + 2.4, -1); dia.scale.y = 1.4; dynamicMesh(dia); g.add(dia);
    ctx.anim.spins.push({ obj: dia, speed: 1.2 });
  },

  hatshop(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#fff8e1', { roofColor: '#6d4c41' });
    shopFront(g, b);
    awning(g, b, '#3e2723', '#ffe0b2');
    roofSign(g, b, h, '#3e2723', '#ffe0b2');
    cyl(g, 2.2, 0.15, '#212121', b.w / 2 - 2.6, h + 0.6, -1.5);
    cyl(g, 1.3, 2.4, '#212121', b.w / 2 - 2.6, h + 1.8, -1.5);
    cyl(g, 1.32, 0.4, '#c62828', b.w / 2 - 2.6, h + 1.0, -1.5);
  },

  eyewear(g, b) {
    const h = shell(g, b.w, b.d, b.floors, '#e1f5fe', { roofColor: '#0277bd' });
    shopFront(g, b);
    roofSign(g, b, h, '#ffffff', '#0277bd');
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.18, 8, 20), toon('#212121'));
      r.position.set(sx * 1.2, 4.6, b.d / 2 + 0.3); r.castShadow = true; g.add(r);
      const lens = new THREE.Mesh(G.cyl(), toon('#263238'));
      lens.scale.set(0.85, 0.05, 0.85); lens.rotation.x = Math.PI / 2; lens.position.set(sx * 1.2, 4.6, b.d / 2 + 0.25); g.add(lens);
    }
    box(g, 0.7, 0.18, 0.18, '#212121', 0, 4.8, b.d / 2 + 0.3);
  },

  club(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#1a1030', { roofColor: '#0d0820', winKind: 'dark', frontStart: 2 });
    const neon = [['#ff4081', 1.2], ['#18ffff', 2.2], ['#ffea00', 3.2]];
    for (const [c, y] of neon) {
      const on = toon(c, { emissive: c, emissiveIntensity: 1 }), off = toon('#2a1a40');
      const strip = dynamicMesh(box(g, b.w + 0.1, 0.15, b.d + 0.1, on, 0, h - y * 0.9, 0, { cast: false }));
      ctx.anim.blinks.push({ obj: strip, a: on, b: off, rate: 2.5, o: y * 2 });
    }
    door(g, b.d, '#311b92', { w: 2.6, frame: '#ff4081' });
    const s = signMesh(b.name, b.def.emoji, 9, '#120a24', '#ff4081');
    s.position.set(0, 4.2, b.d / 2 + 0.25); g.add(s);
    // 레드카펫 & 벨벳 로프
    box(g, 2.6, 0.03, 4, '#b71c1c', 0, 0.03, b.d / 2 + 2.2, { cast: false });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      cyl(g, 0.06, 1.0, '#ffd54f', sx * 1.6, 0.5, b.d / 2 + 1.2 + i * 1.3, { low: true });
      if (i < 2) box(g, 0.05, 0.05, 1.3, '#c62828', sx * 1.6, 0.85, b.d / 2 + 1.85 + i * 1.3, { cast: false });
    }
    // 덩치 큰 경호원 젤리 두 마리 (양복 + 선글라스)
    b.bouncers = [];
    for (const sx of [-1, 1]) {
      const r = new Roach({ color: '#4e342e', age: 40, accessories: ['suit', 'sunglasses'] });
      r.root.scale.setScalar(1.25);
      r.root.position.set(sx * 2.4, 0, b.d / 2 + 1.4);
      r.root.rotation.y = 0;
      r.arms[0].userData.baseZ = 1.1; r.arms[1].userData.baseZ = 0.4;
      r.root.userData.dynamic = true;
      g.add(r.root);
      ctx.anim.roaches.push(r);
      b.bouncers.push(r);
      ctx.colliders.push(worldBox(g, sx * 2.4, b.d / 2 + 1.4, 0.7, 0.7));
    }
  },

  dojang(g, b, ctx) {
    const h = shell(g, b.w, b.d, b.floors, '#fff3e0', { roof: false, frontStart: 1, winKind: 'wood', trim: '#4e342e', bands: true });
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.ConeGeometry(b.w * 0.8 - i * 5, 3, 4), toon(['#37474f', '#455a64', '#546e7a'][i]));
      r.position.set(0, h + 1.4 + i * 2.4, 0); r.rotation.y = Math.PI / 4; r.scale.z = (b.d + 4) / (b.w + 4); r.castShadow = true; g.add(r);
    }
    for (let i = 0; i < 6; i++) cyl(g, 0.4, h, '#b71c1c', -b.w / 2 + 2 + i * ((b.w - 4) / 5), h / 2, b.d / 2 + 0.8);
    door(g, b.d, '#5d4037', { w: 3.2, h: 3.4 });
    const s = signMesh(b.name, b.def.emoji, 7, '#212121', '#ffd54f');
    s.position.set(0, h - 1.4, b.d / 2 + 1.3); g.add(s);
    // 일주문
    const gz = b.d / 2 + 11;
    for (const sx of [-1, 1]) cyl(g, 0.45, 6, '#b71c1c', sx * 4, 3, gz);
    box(g, 11, 0.8, 1.4, '#212121', 0, 6.2, gz);
    box(g, 12.5, 0.4, 2, '#37474f', 0, 6.8, gz);
    for (const sx of [-1, 1]) ctx.colliders.push(worldBox(g, sx * 4, gz, 0.5, 0.5));
    // 수련용 나무 인형 & 석등
    for (const sx of [-1, 1]) {
      const x = sx * 10, z = b.d / 2 + 6;
      cyl(g, 0.3, 2.2, '#8d6e63', x, 1.1, z);
      cyl(g, 0.05, 0.9, '#6d4c41', x, 1.4, z, { rz: Math.PI / 2 });
      sph(g, 0.3, 0.3, 0.3, '#a1887f', x, 2.4, z);
      ctx.colliders.push(worldBox(g, x, z, 0.4, 0.4));
      box(g, 0.8, 1.6, 0.8, '#9e9e9e', sx * 7, 0.8, b.d / 2 + 13);
      box(g, 1.2, 0.3, 1.2, '#757575', sx * 7, 1.75, b.d / 2 + 13);
    }
  },

  park(g, b, ctx) {
    // g의 원점 = 블록 중심 (park은 dir=1)
    const R = ctx.rng;
    box(g, 4, 0.03, 38, '#e8d9c0', 0, 0.04, 0, { cast: false });
    box(g, 38, 0.03, 4, '#e8d9c0', 0, 0.04, 0, { cast: false });
    // 연못
    cyl(g, 6, 0.12, '#81d4fa', 9.5, 0.06, -9.5, { cast: false });
    cyl(g, 6.4, 0.1, '#bcaaa4', 9.5, 0.03, -9.5, { cast: false });
    for (let i = 0; i < 4; i++) cyl(g, 0.7, 0.05, '#81c784', 9.5 + R.range(-4, 4), 0.14, -9.5 + R.range(-4, 4), { cast: false });
    ctx.colliders.push(worldBox(g, 9.5, -9.5, 5.6, 5.6));
    // 분수 (중앙)
    cyl(g, 3, 0.6, '#cfd8dc', 0, 0.3, 0);
    cyl(g, 2.7, 0.1, '#64b5f6', 0, 0.6, 0, { cast: false });
    const water = dynamicMesh(sph(g, 1, 1, 1, new THREE.MeshToonMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.8 }), 0, 1.5, 0, { cast: false }));
    ctx.anim.fountains.push({ obj: water, base: 0.8, o: 1 });
    ctx.colliders.push(worldBox(g, 0, 0, 3, 3));
    // 놀이터
    box(g, 12, 0.05, 12, '#ffe0b2', -9.5, 0.04, 9.5, { cast: false });
    const slide = new THREE.Group(); slide.position.set(-11, 0, 8); g.add(slide);
    box(slide, 1.6, 3, 1.6, '#ff7043', 0, 1.5, 0);
    box(slide, 1.2, 0.15, 4.5, '#ffd54f', 0, 1.6, 2.6, { rx: 0.6 });
    const swing = new THREE.Group(); swing.position.set(-7, 0, 11); g.add(swing);
    for (const s of [-1.8, 1.8]) box(swing, 0.15, 3.2, 0.15, '#42a5f5', s, 1.6, 0);
    box(swing, 3.8, 0.15, 0.15, '#42a5f5', 0, 3.2, 0);
    for (const s of [-0.8, 0.8]) { box(swing, 0.04, 2.2, 0.04, '#616161', s, 2.1, 0); box(swing, 0.7, 0.08, 0.4, '#ef5350', s, 1.0, 0); }
    ctx.colliders.push(worldBox(g, -11, 8, 0.9, 0.9));
    // 정자
    const gz = new THREE.Group(); gz.position.set(-9.5, 0, -9.5); g.add(gz);
    box(gz, 6, 0.4, 6, '#d7ccc8', 0, 0.2, 0);
    for (const sx of [-2.6, 2.6]) for (const sz of [-2.6, 2.6]) cyl(gz, 0.2, 3, '#8d6e63', sx, 1.9, sz, { low: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.2, 4), toon('#c62828'));
    roof.position.y = 4.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true; gz.add(roof);
    // 벤치 & 꽃밭 & 나무
    bench(g, 3.8, 6, -Math.PI / 2); bench(g, -3.8, -6, Math.PI / 2); bench(g, 6, 3.8, Math.PI); bench(g, -6, -3.8, 0);
    flowerBed(g, 4.5, 14, 6, 2, R); flowerBed(g, 14, 4.5, 2, 6, R); flowerBed(g, -14, -4.5, 2, 6, R);
    const spots = [[-16, -16], [-16, 16], [16, 16], [16, -2], [-3, -16], [3, 16], [-16, 2], [16, 10], [-2, -17], [12, 16], [-17, -2], [6, -17]];
    for (const [x, z] of spots) ctx.addTree(g, x, z, R.range(1, 1.4), R.chance(0.25) ? '#f4a7c0' : undefined);
    fixTreeColliders(ctx, g, spots.length);
  },
};

// g 로컬 좌표 → 월드 AABB
function worldBox(g, lx, lz, hx, hz) {
  const p = new THREE.Vector3(lx, 0, lz);
  g.updateMatrixWorld(true);
  p.applyMatrix4(g.matrixWorld);
  return { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz, h: 3 };
}

// addTree 는 로컬 좌표로 충돌박스를 넣으므로 월드 좌표로 보정
function fixTreeColliders(ctx, g, n) {
  g.updateMatrixWorld(true);
  const cols = ctx.colliders;
  for (let i = cols.length - n; i < cols.length; i++) {
    const c = cols[i];
    const p = new THREE.Vector3((c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2).applyMatrix4(g.matrixWorld);
    const hx = (c.maxX - c.minX) / 2;
    cols[i] = { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hx, maxZ: p.z + hx, h: c.h, small: true };
  }
}

// ------------------------------------------------------------------
// 미니맵 정적 이미지
// ------------------------------------------------------------------
export function renderMapImage(buildings, size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const s = size / CITY;
  const tx = (x) => (x + HALF) * s;
  ctx.fillStyle = '#9fd38a'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#7b808c'; ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < GRID; r++) for (let col = 0; col < GRID; col++) {
    const x0 = blockMin(col), z0 = blockMin(r);
    ctx.fillStyle = '#e9dfd3';
    ctx.fillRect(tx(x0 - 2.5), tx(z0 - 2.5), (BLOCK + 5) * s, (BLOCK + 5) * s);
    const plan = CITY_PLAN[r][col];
    ctx.fillStyle = isSuburbBlock(r, col) ? '#b4e09a' : plan.includes('park') ? '#8fd17a' : plan.includes('house') ? '#bfe6a8' : '#f3ece2';
    ctx.fillRect(tx(x0), tx(z0), BLOCK * s, BLOCK * s);
  }
  for (const b of buildings) {
    if (b.type === 'park') {
      ctx.fillStyle = '#81d4fa';
      ctx.beginPath(); ctx.arc(tx(b.x + (b.dir === 1 ? 9.5 : -9.5)), tx(b.z - 9.5), 6 * s, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = CATEGORY_COLORS[b.cat] || '#ccc';
      ctx.fillRect(tx(b.x - b.w / 2), tx(b.z - b.d / 2), b.w * s, b.d * s);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(tx(b.x - b.w / 2), tx(b.z - b.d / 2), b.w * s, b.d * s);
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(size / 34)}px sans-serif`;
  for (const b of buildings) {
    if (b.type === 'house' || b.type === 'villa') continue;
    ctx.fillText(b.def.emoji, tx(b.x), tx(b.z));
  }
  return c;
}
