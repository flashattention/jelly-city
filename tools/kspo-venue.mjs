// 한국체육산업개발 '올림픽공원 공연장 실감형 콘텐츠'(공공데이터 15127487) GLB → 젤리 서울 러너용 가벼운 모양
//   node tools/kspo-venue.mjs <입력.glb> <출력.json> [칸 크기 m = 0.6] [단위 배율 = 자동]
//   - 노드 변환을 모두 적용해 세상 좌표(m, Y 위)로
//   - 가까운 꼭짓점을 칸(격자)마다 하나로 모아(vertex clustering) 삼각형 수를 줄인다. 재질마다 따로 모아 색이 섞이지 않게
//   - 색: 재질 기본색, 그림(텍스처)만 있는 재질은 이름으로 어림한 색
//   - 출력: { name, unit, bbox, groups: [{ c: '#rrggbb', a: 투명도, p: [x,y,z ...] (cm 정수), i: [...] }] }
//   받은 원본은 .cache/kspo/ (커밋하지 않음), 결과는 public/dream-runner/hangang/kspo/
import fs from 'fs';
import { loadDae } from './kspo-dae.mjs';

const [IN, OUT, CELL = '0.6', UNIT = ''] = process.argv.slice(2);
if (!IN || !OUT) { console.error('node tools/kspo-venue.mjs <in.glb> <out.json> [cell] [unit]'); process.exit(1); }
const cell = +CELL;
const DAE = /\.dae$/i.test(IN);
const buf = DAE ? null : fs.readFileSync(IN);
const jl = DAE ? 0 : buf.readUInt32LE(12), J = DAE ? { materials: [] } : JSON.parse(buf.slice(20, 20 + jl).toString());
const binOff = 20 + jl + 8, BIN = DAE ? Buffer.alloc(0) : buf.subarray(binOff, binOff + buf.readUInt32LE(20 + jl));

// ---- 4×4 행렬 (열 우선, glTF 와 같음)
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const trs = (n) => {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
};

// ---- 재질 색
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('');
const GUESS = [[/grass|groundcover|green|lawn|잔디/i, '#6f9a4e'], [/wood|cherry|bamboo|veneer|lumber|osb|cork|apple/i, '#a87a4f'], [/concrete|conc|block|stone|cement/i, '#b9b5ad'], [/marble|terrazzo|tile|carrera/i, '#dcd7cd'], [/metal|alumin|chrome|steel|corrug|fenc/i, '#9aa1a8'], [/glass|mirror|espejo/i, '#9fc2e0'], [/carpet|blue/i, '#3f5a9c'], [/leather|black|plastic/i, '#2b2b2e'], [/hair|skin|shoe|pant|shirt|niraj/i, null]];
const guessOf = (name) => GUESS.find(([re]) => re.test(name || ''));
let matInfo = (J.materials || []).map((m) => {
  const sg = m.extensions?.KHR_materials_pbrSpecularGlossiness, f = m.pbrMetallicRoughness?.baseColorFactor || sg?.diffuseFactor || [1, 1, 1, 1];
  const tex = !!(m.pbrMetallicRoughness?.baseColorTexture || sg?.diffuseTexture);
  let c = hex(f[0], f[1], f[2]);
  const g = GUESS.find(([re]) => re.test(m.name || ''));
  if (g && g[1] === null) return { skip: true, name: m.name };
  if (tex && f[0] > 0.98 && f[1] > 0.98 && f[2] > 0.98) c = g ? g[1] : '#c8c2b8';
  return { c, a: +(f[3] ?? 1).toFixed(2), name: m.name };
});

// ---- 접근자 읽기
const CT = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const dv = new DataView(BIN.buffer, BIN.byteOffset, BIN.byteLength);
function read(ai) {
  const a = J.accessors[ai], bv = J.bufferViews[a.bufferView], [sz, fn] = CT[a.componentType], n = NC[a.type], st = bv.byteStride || sz * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new (a.componentType === 5126 ? Float32Array : Uint32Array)(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv[fn](base + i * st + k * sz, true);
  return out;
}

// ---- 노드를 돌며 세상 좌표 삼각형을 재질별로
let tris = new Map(); // mat → [{ W 세상 좌표, idx, cnt }]
let total = 0;
function visit(ni, parent) {
  const n = J.nodes[ni], M = mul(parent, trs(n));
  if (n.mesh != null) for (const p of J.meshes[n.mesh].primitives) {
    if ((p.mode ?? 4) !== 4 || p.attributes.POSITION == null) continue;
    const mi = p.material ?? -1, info = matInfo[mi] || { c: '#cccccc', a: 1 };
    if (info.skip) continue;
    const P = read(p.attributes.POSITION), idx = p.indices != null ? read(p.indices) : null, cnt = idx ? idx.length : P.length / 3;
    const W = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; W[i] = M[0] * x + M[4] * y + M[8] * z + M[12]; W[i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13]; W[i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14]; }
    let L = tris.get(mi); if (!L) tris.set(mi, (L = []));
    L.push({ W, idx, cnt }); total += cnt / 3;
  }
  for (const c of n.children || []) visit(c, M);
}
if (DAE) {
  const hexOf = ({ rgb, tex, a, name }) => { const g = guessOf(name); if (g && g[1] === null) return { skip: true, name }; let c = rgb ? hex(rgb[0], rgb[1], rgb[2]) : '#c8c2b8'; if ((tex || !rgb) && g) c = g[1]; return { c, a: +(+a).toFixed(2), name }; };
  const D = loadDae(IN, hexOf); tris = D.tris; total = D.total; matInfo = D.mats;
} else for (const r of J.scenes[J.scene || 0].nodes) visit(r, I4());

// ---- 단위: 전체 크기로 어림 (SketchUp 인치 · cm 내보내기가 섞여 있다)
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const L of tris.values()) for (const { W } of L) for (let i = 0; i < W.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], W[i + k]); mx[k] = Math.max(mx[k], W[i + k]); }
const span = Math.max(mx[0] - mn[0], mx[2] - mn[2]);
const unit = UNIT ? +UNIT : DAE ? 1 : span > 3000 ? 0.01 : span > 400 ? 0.0254 : 1;
// 바닥 가운데를 (0, 0, 0) 으로
let cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, y0 = mn[1];
// CROP=반지름(m): 가운데(꼭짓점 중앙값)에서 먼 조각은 뺀다 (KSPO DOME 원본은 둘레에 방위 글자 E · W · S · N 이 떠 있다)
if (process.env.CROP) {
  const R = +process.env.CROP / unit, xs = [], zs = []; for (const L of tris.values()) for (const { W } of L) for (let i = 0; i < W.length; i += 30) { xs.push(W[i]); zs.push(W[i + 2]); }
  xs.sort((a, b) => a - b); zs.sort((a, b) => a - b); const mx0 = xs[xs.length >> 1], mz0 = zs[zs.length >> 1];
  mn = [Infinity, Infinity, Infinity]; mx = [-Infinity, -Infinity, -Infinity];
  for (const [k, L] of tris) { const L2 = []; for (const T of L) { const { W, idx, cnt } = T, keep = []; for (let t = 0; t < cnt; t += 3) { let ox = 0, oz = 0; for (let q = 0; q < 3; q++) { const j = (idx ? idx[t + q] : t + q) * 3; ox += W[j]; oz += W[j + 2]; } if (Math.hypot(ox / 3 - mx0, oz / 3 - mz0) <= R) for (let q = 0; q < 3; q++) { const j = idx ? idx[t + q] : t + q; keep.push(j); const jj = j * 3; for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], W[jj + d]); mx[d] = Math.max(mx[d], W[jj + d]); } } } if (keep.length) L2.push({ W, idx: Uint32Array.from(keep), cnt: keep.length }); } if (L2.length) tris.set(k, L2); else tris.delete(k); }
  cx = (mn[0] + mx[0]) / 2; cz = (mn[2] + mx[2]) / 2; y0 = mn[1];
}

// ---- 칸 모으기 (재질마다)
const groups = [];
let outT = 0;
for (const [mi, L] of tris) {
  const info = (DAE ? matInfo.get(mi) : matInfo[mi]) || { c: '#cccccc', a: 1 }, cells = new Map(), pos = [], acc = [], ids = [], seen = new Set();
  const cellOf = (x, y, z) => {
    const X = (x - cx) * unit, Y = (y - y0) * unit, Z = (z - cz) * unit, k = `${Math.floor(X / cell)},${Math.floor(Y / cell)},${Math.floor(Z / cell)}`;
    let id = cells.get(k); if (id == null) { id = acc.length; cells.set(k, id); acc.push([0, 0, 0, 0]); }
    const a = acc[id]; a[0] += X; a[1] += Y; a[2] += Z; a[3]++; return id;
  };
  for (const { W, idx, cnt } of L) for (let t = 0; t < cnt; t += 3) {
    const v = [0, 1, 2].map((k) => { const j = (idx ? idx[t + k] : t + k) * 3; return cellOf(W[j], W[j + 1], W[j + 2]); });
    if (v[0] === v[1] || v[1] === v[2] || v[0] === v[2]) continue;
    const key = [...v].sort((a, b) => a - b).join(','); if (seen.has(key)) continue; seen.add(key);
    ids.push(v[0], v[1], v[2]);
  }
  if (!ids.length) continue;
  // 쓰인 칸만 다시 번호
  const remap = new Map(), I = [];
  for (const id of ids) { let r = remap.get(id); if (r == null) { r = remap.size; remap.set(id, r); const a = acc[id]; pos.push(Math.round((a[0] / a[3]) * 100), Math.round((a[1] / a[3]) * 100), Math.round((a[2] / a[3]) * 100)); } I.push(r); }
  groups.push({ c: info.c, a: info.a, n: info.name, p: pos, i: I }); outT += I.length / 3;
}
const bbox = [[(mn[0] - cx) * unit, 0, (mn[2] - cz) * unit], [(mx[0] - cx) * unit, (mx[1] - y0) * unit, (mx[2] - cz) * unit]].map((v) => v.map((x) => Math.round(x * 10) / 10));
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ name: IN.replace(/^.*\//, ''), unit, cell, bbox, groups }));
console.log(`${IN}: 삼각형 ${Math.round(total).toLocaleString()} → ${outT.toLocaleString()} · 재질 ${groups.length} · 단위 ${unit} · 크기(m) ${bbox[1][0] - bbox[0][0]} × ${bbox[1][1]} × ${bbox[1][2] - bbox[0][2]} · ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
