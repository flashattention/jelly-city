// 도시 밖 세상 (브라우저): 지형 · 물 · 고속도로 · 대교 · 표지판 · 숲/정글/늪 식물 · 목장
import * as THREE from 'three';
import { HALF } from './config.js';
import { PIER, onPier } from './terrain.js';
import { WORLD_HALF, WATER_Y, BRIDGE, REGIONS, ROADS, regionAt, buildHeightGrid, sampleGrid, roadHeight, bridgeDeck, onBridge, roadSigns, distToPolyline, fbm, GRID_STEP, terrainH } from './terrain.js';
import { Props, defineCommonProps } from './props.js';
import { toon, signMesh, RNG } from '../../shared/js/utils.js';

const CANYON = ['#b5603a', '#d08850', '#9c4a2e', '#c4733f', '#8a3f28'];
const BIOME_COL = {
  mountain: ['#7c8a5e', '#8d8d7d', '#f5f7fa'], valley: ['#6fae5e'], forest: ['#3f7d36'], meadow: ['#9ccc65'],
  swamp: ['#5b6e3f'], jungle: ['#2f7a32'], amazon: ['#235f27'], island: ['#a5d36f'], park: ['#d9cfc3'], dragon: ['#c98a5a'], sea: ['#d9c58f'], none: ['#93c96f'],
};

export function buildWilds(scene, city) {
  const root = new THREE.Group();
  scene.add(root);
  const grid = buildHeightGrid();
  const rng = new RNG(7777);

  // ---------- 지형 ----------
  const size = WORLD_HALF * 2;
  const seg = grid.n - 1;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), sand = new THREE.Color('#d9c58f'), rock = new THREE.Color('#8a8a7a'), snow = new THREE.Color('#f5f7fa'), mud = new THREE.Color('#5d4e37');
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k);
    const i = Math.round((x + WORLD_HALF) / GRID_STEP), j = Math.round((z + WORLD_HALF) / GRID_STEP);
    let h = grid.hs[j * grid.n + i];
    const inCity = Math.abs(x) < HALF + 14 && Math.abs(z) < HALF + 14;
    if (inCity) h = -0.6;
    pos.setY(k, h);
    const r = regionAt(x, z);
    c.set((BIOME_COL[r?.id] || BIOME_COL.none)[0]);
    c.offsetHSL(0, 0, (fbm(x * 0.03, z * 0.03) - 0.5) * 0.12);
    if (h < WATER_Y + 0.6) c.lerp(r?.id === 'swamp' ? mud : sand, 0.85);
    if (r?.id === 'mountain' || r?.id === 'valley') { if (h > 45) c.lerp(rock, Math.min(1, (h - 45) / 30)); if (h > 95) c.lerp(snow, Math.min(1, (h - 95) / 15)); }
    if (r?.id === 'dragon' && h > 6) c.set(CANYON[Math.floor(h / 6) % CANYON.length]).offsetHSL(0, 0, (fbm(x * 0.05, z * 0.05) - 0.5) * 0.08); // 붉은 바위 지층
    colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true }));
  terrain.receiveShadow = true;
  root.add(terrain);

  // ---------- 물 ----------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size + 800, size + 800), new THREE.MeshToonMaterial({ color: '#4fa3d9', transparent: true, opacity: 0.82 }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y;
  root.add(water);

  // ---------- 고속도로 ----------
  const asphalt = toon('#5f646e'), line = toon('#ffd54f');
  const roadGround = (x, z) => (onBridge(x, z) ? bridgeDeck(x) : Math.max(sampleGrid(grid, x, z), roadHeight(x, z)));
  for (const rd of ROADS) {
    for (let s = 0; s < rd.pts.length - 1; s++) {
      const [ax, az] = rd.pts[s], [bx, bz] = rd.pts[s + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 6));
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      const verts = [], idx = [], lv = [], li = [];
      for (let k = 0; k <= n; k++) {
        const x = ax + dx * (L * k / n), z = az + dz * (L * k / n);
        if (Math.abs(x) < HALF && Math.abs(z) < HALF) { verts.push(x, -5, z, x, -5, z); lv.push(x, -5, z, x, -5, z); continue; }
        const y = roadGround(x, z) + 0.06;
        const W = 5.2;
        verts.push(x - dz * W, y, z + dx * W, x + dz * W, y, z - dx * W);
        lv.push(x - dz * 0.12, y + 0.02, z + dx * 0.12, x + dz * 0.12, y + 0.02, z - dx * 0.12);
      }
      for (let k = 0; k < n; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); if (k % 2 === 0) li.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, asphalt); m.receiveShadow = true; root.add(m);
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3)); g2.setIndex(li); g2.computeVertexNormals();
      root.add(new THREE.Mesh(g2, line));
    }
  }

  // ---------- 젤리 대교 (현수교) ----------
  const red = toon('#e53935'), cable = toon('#b71c1c'), deckMat = toon('#7a7f88');
  {
    const { x0, x1, w, y } = BRIDGE;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.2, w), deckMat);
    deck.position.set((x0 + x1) / 2, y - 0.6, 0); deck.castShadow = true; deck.receiveShadow = true; root.add(deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.0, 0.3), red); rail.position.set((x0 + x1) / 2, y + 0.5, s * (w / 2 - 0.15)); root.add(rail);
    }
    const towers = [x0 + (x1 - x0) * 0.25, x0 + (x1 - x0) * 0.75];
    for (const tx of towers) for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.4, 52, 2.4), red); t.position.set(tx, y + 20, s * (w / 2 + 1)); t.castShadow = true; root.add(t);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 2, w + 4), red); beam.position.set(tx, y + 40, 0); root.add(beam);
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 30, 10), toon('#9e9e9e')); pier.position.set(tx, y - 16, s * (w / 2 + 1)); root.add(pier);
    }
    // 주 케이블 (포물선) + 수직 케이블
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const x = x0 + (x1 - x0) * (k / 40);
        const u = (x - towers[0]) / (towers[1] - towers[0]);
        const yy = x < towers[0] || x > towers[1] ? y + 46 - Math.min(Math.abs(x - towers[0]), Math.abs(x - towers[1])) * 0.3 : y + 46 - Math.sin(u * Math.PI) * 38;
        pts.push(new THREE.Vector3(x, yy, s * (w / 2 + 1)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.35, 6), cable));
      for (let k = 2; k < 40; k += 2) { const p = pts[k]; const h = p.y - y; const v = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 4), cable); v.position.set(p.x, y + h / 2, p.z); root.add(v); }
    }
  }

  // ---------- 표지판 ----------
  for (const [x, z, ry, lines] of roadSigns()) {
    const gy = Math.max(0, roadGround(x, z));
    const g = new THREE.Group(); g.position.set(x, gy, z); g.rotation.y = ry; root.add(g);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 6), toon('#9e9e9e')); p.position.set(s * 2.4, 2.1, 0); g.add(p); }
    const H = lines.length * 0.9 + 0.5;
    const board = new THREE.Mesh(new THREE.BoxGeometry(6, H, 0.15), toon('#2e7d32')); board.position.set(0, 4 + H / 2, 0); g.add(board);
    lines.forEach((t, i) => { const sm = signMesh(t, '', 5.6, '#2e7d32', '#ffffff'); sm.position.set(0, 4 + H - 0.7 - i * 0.9, 0.1); sm.scale.multiplyScalar(0.85); g.add(sm); const back = sm.clone(); back.rotation.y = Math.PI; back.position.z = -0.1; g.add(back); });
  }

  // ---------- 지역 입구 아치 ----------
  const archs = [[0, -270, 'valley'], [-300, 0, 'meadow'], [0, 300, 'jungle'], [0, 690, 'amazon'], [-560, 255, 'swamp'], [870, 0, 'island'], [1000, -470, 'dragon']];
  for (const [x, z, id] of archs) {
    const r = REGIONS.find((q) => q.id === id);
    const gy = roadGround(x, z);
    const g = new THREE.Group(); g.position.set(x, gy, z); g.rotation.y = Math.abs(x) > Math.abs(z) ? Math.PI / 2 : 0; root.add(g);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8), toon('#6d4c41')); p.position.set(s * 7, 3.5, 0); g.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(15.5, 1.6, 0.6), toon('#6d4c41')); top.position.set(0, 7.2, 0); g.add(top);
    for (const ry of [0, Math.PI]) { const sm = signMesh(r.name, r.emoji, 10, '#fff8e1', '#4e342e'); sm.position.set(0, 7.2, ry ? -0.35 : 0.35); sm.rotation.y = ry; g.add(sm); }
  }

  // ---------- 드래곤 협곡: 용암 웅덩이 + 거대한 용 뼈 ----------
  {
    const lrng = new RNG(4242); // 다른 소품 배치가 바뀌지 않게 따로
    const lavaMat = new THREE.MeshBasicMaterial({ color: '#ff6d00' });
    const crust = toon('#4e342e');
    let n = 0;
    for (let i = 0; i < 400 && n < 14; i++) {
      const x = 830 + lrng.next() * 300, z = -1100 + lrng.next() * 600;
      const h = sampleGrid(grid, x, z);
      if (h > 6 || h < 1 || Math.min(...ROADS.map((rd) => distToPolyline(x, z, rd.pts))) < 14) continue;
      const r = 3 + lrng.next() * 5;
      const rim = new THREE.Mesh(new THREE.CircleGeometry(r + 1.2, 18), crust); rim.rotation.x = -Math.PI / 2; rim.position.set(x, h + 0.08, z); root.add(rim);
      const lava = new THREE.Mesh(new THREE.CircleGeometry(r, 18), lavaMat); lava.rotation.x = -Math.PI / 2; lava.position.set(x, h + 0.12, z); root.add(lava);
      n++;
    }
    // 입구의 거대한 용 갈비뼈
    const bone = toon('#efe6d2');
    const bx = 1030, bz = -520, by = sampleGrid(grid, bx, bz);
    for (let i = 0; i < 7; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(4.5 - Math.abs(i - 3) * 0.5, 0.35, 6, 14, Math.PI), bone);
      rib.position.set(bx, by, bz - 6 + i * 2); root.add(rib);
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 6), bone); spine.rotation.x = Math.PI / 2; spine.position.set(bx, by + 4.4, bz); root.add(spine);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), bone); skull.scale.set(1, 0.8, 1.5); skull.position.set(bx, by + 1.6, bz + 11); root.add(skull);
  }

  // ---------- 낚시터 잔교 ----------
  {
    const wood = toon('#a1887f'), dark = toon('#6d4c41');
    const L = PIER.x1 - PIER.x0, W = PIER.z1 - PIER.z0;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, W), wood); deck.position.set((PIER.x0 + PIER.x1) / 2, PIER.y - 0.15, (PIER.z0 + PIER.z1) / 2); deck.receiveShadow = true; root.add(deck);
    for (let x = PIER.x0 + 2; x < PIER.x1; x += 6) for (const z of [PIER.z0 + 0.4, PIER.z1 - 0.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), dark); p.position.set(x, PIER.y - 4.4, z); root.add(p); const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.15), dark); r.position.set(x, PIER.y + 0.5, z); root.add(r); }
    for (const z of [PIER.z0 + 0.4, PIER.z1 - 0.4]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.12), dark); rail.position.set((PIER.x0 + PIER.x1) / 2, PIER.y + 1, z); root.add(rail); }
    const sg = signMesh('젤리 낚시터', '🎣', 5, '#0277bd', '#ffffff'); sg.position.set(PIER.x0 + 1, PIER.y + 2.6, (PIER.z0 + PIER.z1) / 2); sg.rotation.y = -Math.PI / 2; root.add(sg);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.6, 8), toon('#4fc3f7')); b.position.set(PIER.x0 + 15 + i * 20, PIER.y + 0.3, PIER.z1 - 1.2); root.add(b); }
  }

  // ---------- 목장 (섬) ----------
  const ranch = new THREE.Group(); root.add(ranch);
  {
    const wood = toon('#8d6e63');
    const fence = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 3);
      for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25), wood); p.position.set(x, sampleGrid(grid, x, z) + 0.7, z); ranch.add(p); }
      for (const hy of [0.5, 1.1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.1), wood); r.position.set((x0 + x1) / 2, sampleGrid(grid, (x0 + x1) / 2, (z0 + z1) / 2) + hy, (z0 + z1) / 2); r.rotation.y = -Math.atan2(z1 - z0, x1 - x0); ranch.add(r); }
    };
    fence(880, -360, 980, -360); fence(980, -360, 980, -60); fence(880, -360, 880, -60); fence(880, -60, 940, -60);
    fence(1020, -360, 1120, -360); fence(1120, -360, 1120, -100); fence(1020, -100, 1120, -100); fence(1020, -360, 1020, -150);
    // 빨간 헛간 + 사일로 + 건초
    const bx = 950, bz = -420, by = sampleGrid(grid, bx, bz);
    const barn = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 14), toon('#c62828')); barn.position.set(bx, by + 4.5, bz); barn.castShadow = true; ranch.add(barn);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 18.4, 3, 1), toon('#5d4037')); roof.rotation.set(0, 0, Math.PI / 2); roof.rotation.order = 'ZYX'; roof.position.set(bx, by + 11, bz); ranch.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.3), toon('#fafafa')); door.position.set(bx, by + 3, bz + 7.05); ranch.add(door);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 12), toon('#cfd8dc')); silo.position.set(bx + 14, by + 8, bz); ranch.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#90a4ae')); dome.position.set(bx + 14, by + 16, bz); ranch.add(dome);
    for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10), toon('#ffd54f')); h.rotation.z = Math.PI / 2; h.position.set(905 + (i % 3) * 3, sampleGrid(grid, 905, -300) + 1.1, -300 + Math.floor(i / 3) * 3); ranch.add(h); }
    city.colliders.push({ minX: bx - 9, maxX: bx + 9, minZ: bz - 7, maxZ: bz + 7, h: by + 12, base: by });
  }

  // ---------- 식물 · 바위 ----------
  const props = new Props(root);
  defineCommonProps(props);
  const pick = (a) => a[Math.floor(rng.next() * a.length)];
  const cells = new Map(); // 나무 충돌 격자 (16m)
  const addCollider = (id, x, z, r, h) => {
    const col = { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r, h, small: true, pkey: 'w' + id };
    props.list[id].collider = col;
    const key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(col);
  };
  const STEP = 10;
  for (let z = -WORLD_HALF + 20; z < WORLD_HALF - 20; z += STEP) {
    for (let x = -WORLD_HALF + 20; x < WORLD_HALF - 20; x += STEP) {
      const px = x + (rng.next() - 0.5) * STEP * 0.9, pz = z + (rng.next() - 0.5) * STEP * 0.9;
      if (Math.abs(px) < HALF + 30 && Math.abs(pz) < HALF + 30) continue;
      const h = sampleGrid(grid, px, pz);
      const r = regionAt(px, pz);
      const id = r?.id || 'none';
      const roadD = Math.min(...ROADS.map((rd) => distToPolyline(px, pz, rd.pts)));
      if (roadD < 9) continue;
      if (Math.hypot(px - 950, pz + 420) < 30) continue; // 헛간
      const wet = h < WATER_Y + 0.3;
      const roll = rng.next();
      if (id === 'park') continue; // 놀이공원 안에는 나무를 심지 않는다
      const dens = { dragon: 0.05, forest: 0.5, jungle: 0.55, amazon: 0.62, mountain: h > 90 ? 0.03 : 0.22, valley: 0.18, swamp: 0.3, meadow: 0.06, island: 0.04, none: 0.05, sea: 0 }[id] ?? 0.05;
      if (roll > dens + 0.12) continue;
      const s = 0.8 + rng.next() * 0.7, ry = rng.next() * 6.28;
      if (wet) {
        if (id === 'swamp' || id === 'amazon' || id === 'jungle') { if (h > WATER_Y - 1.5) props.add('reed', px, h, pz, s, ry); }
        continue;
      }
      let type;
      if (roll > dens) type = id === 'meadow' ? pick(['flower', 'flower', 'bush']) : id === 'mountain' ? 'rock' : pick(['bush', 'rock', 'fern']);
      else if (id === 'forest') type = pick(['pine', 'pine', 'broad', 'pine']);
      else if (id === 'mountain' || id === 'valley') type = h > 70 ? 'pine' : pick(['pine', 'broad', 'rock']);
      else if (id === 'jungle') type = pick(['jungle', 'jungle', 'palm', 'fern']);
      else if (id === 'amazon') type = pick(['jungle', 'jungle', 'jungle', 'palm', 'fern']);
      else if (id === 'swamp') type = pick(['dead', 'dead', 'reed', 'broad']);
      else if (id === 'island') type = h < 2 ? 'palm' : pick(['broad', 'bush']);
      else if (id === 'dragon') type = pick(['dead', 'rock', 'rock']);
      else type = pick(['broad', 'pine', 'bush']);
      const tint = { broad: pick(['#43a047', '#66bb6a', '#7cb342', '#9ccc65']), pine: pick(['#2e7d32', '#1b5e20', '#33691e']), rock: pick(['#9e9e9e', '#8d8d8d', '#a1887f']), bush: pick(['#558b2f', '#689f38']), flower: pick(['#ff80ab', '#ffeb3b', '#ffffff', '#ce93d8', '#ff7043']), jungle: pick(['#1b5e20', '#2e7d32', '#33691e']) }[type] || null;
      const pid = props.add(type, px, h - 0.1, pz, type === 'rock' ? s * 1.4 : s, ry, tint);
      if (['pine', 'broad', 'palm', 'jungle', 'dead'].includes(type)) addCollider(pid, px, pz, 0.45 * s, h + 8 * s);
      else if (type === 'rock' && s > 1.1) addCollider(pid, px, pz, 1.4 * s, h + 1.4 * s);
    }
  }
  props.build({ castShadow: false });

  const wild = {
    root, grid, props, terrain,
    // 바닥 높이: 도시 밖이면 지형, 대교 위면 다리 상판 (y로 다리 아래/위 구분)
    groundY(x, z, y = 99) {
      if (onBridge(x, z) && y > bridgeDeck(x) - 2.5) return bridgeDeck(x);
      if (onPier(x, z) && y > PIER.y - 2) return PIER.y;
      const g = sampleGrid(grid, x, z);
      return g;
    },
    near(x, z, r = 12) {
      const out = [];
      const x0 = Math.floor((x - r) / 16), x1 = Math.floor((x + r) / 16), z0 = Math.floor((z - r) / 16), z1 = Math.floor((z + r) / 16);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const l = cells.get(`${i},${j}`); if (l) out.push(...l); }
      return out;
    },
    update(camPos) { props.cull(camPos, 650); },
  };
  return wild;
}

// 전체 세계 지도 이미지 (도시 부분은 도시 지도를 위에 겹쳐 그린다)
export function renderWorldImage(grid, size = 1024) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const N = 256, px = size / N, u = size / (WORLD_HALF * 2);
  const col = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -WORLD_HALF + (i + 0.5) * (WORLD_HALF * 2 / N), z = -WORLD_HALF + (j + 0.5) * (WORLD_HALF * 2 / N);
    const h = sampleGrid(grid, x, z);
    const r = regionAt(x, z);
    if (h < WATER_Y) col.set(h < WATER_Y - 6 ? '#3b8ccf' : '#5fb0e0');
    else { col.set((BIOME_COL[r?.id] || BIOME_COL.none)[0]); if (h > 45) col.lerp(new THREE.Color('#9a9a8a'), Math.min(1, (h - 45) / 40)); if (h > 95) col.set('#f5f7fa'); col.offsetHSL(0, 0, Math.min(0.08, h * 0.0015)); }
    ctx.fillStyle = '#' + col.getHexString();
    ctx.fillRect(i * px, j * px, px + 1, px + 1);
  }
  const X = (v) => (v + WORLD_HALF) * u;
  ctx.strokeStyle = '#5f646e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const rd of ROADS) { ctx.beginPath(); rd.pts.forEach(([x, z], k) => (k ? ctx.lineTo(X(x), X(z)) : ctx.moveTo(X(x), X(z)))); ctx.stroke(); }
  ctx.strokeStyle = '#e53935'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(X(BRIDGE.x0), X(0)); ctx.lineTo(X(BRIDGE.x1), X(0)); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of REGIONS) {
    const [x0, z0, x1, z1] = r.rect;
    const cx = r.id === 'valley' ? 10 : r.id === 'mountain' ? -200 : (x0 + x1) / 2, cz = r.id === 'valley' ? -700 : r.id === 'mountain' ? -800 : (z0 + z1) / 2;
    ctx.font = `${Math.round(size / 26)}px sans-serif`; ctx.fillText(r.emoji, X(cx), X(cz) - size / 40);
    ctx.font = `bold ${Math.round(size / 48)}px sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(r.name, X(cx), X(cz) + size / 60);
    ctx.fillStyle = '#263238'; ctx.fillText(r.name, X(cx), X(cz) + size / 60);
  }
  return cv;
}

export { terrainH };
