// SketchUp COLLADA(DAE) 읽기 — kspo-venue.mjs 가 쓴다 (KSPO DOME 실감형 콘텐츠는 DAE 475MB 하나)
//   큰 파일이라 XML 해석기 없이 문자열을 훑는다. 돌려주는 것: { tris: Map(재질 → [{ W, idx, cnt }]), mats: Map(재질 → { c, a, name }) }
//   W 는 Y 위 · 단위(unit 속성)를 곱한 m 좌표
import fs from 'fs';

const num = (s) => s.trim().split(/\s+/).map(Number);
const attr = (tag, k) => (tag.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];

export function loadDae(path, hexOf) {
  const S = fs.readFileSync(path, 'latin1');
  const unit = +(attr(S.slice(0, 4000).match(/<unit[^>]*>/)?.[0] || '', 'meter') || 1);
  const zUp = /<up_axis>\s*Z_UP/.test(S.slice(0, 4000));
  const sec = (name) => { const a = S.indexOf(`<${name}`), b = S.indexOf(`</${name}>`, a); return a < 0 ? '' : S.slice(a, b); };

  // 효과 → 색
  const effects = new Map(), E = sec('library_effects');
  for (const m of E.matchAll(/<effect id="([^"]*)"[\s\S]*?<\/effect>/g)) {
    const body = m[0], dif = body.match(/<diffuse>([\s\S]*?)<\/diffuse>/)?.[1] || '', col = dif.match(/<color[^>]*>([^<]*)<\/color>/)?.[1];
    const tr = body.match(/<transparency>\s*<float[^>]*>([^<]*)</)?.[1];
    effects.set(m[1], { rgb: col ? num(col) : null, tex: /<texture/.test(dif), a: tr != null ? +tr : col ? num(col)[3] ?? 1 : 1 });
  }
  const mats = new Map(), M = sec('library_materials');
  for (const m of M.matchAll(/<material id="([^"]*)"(?: name="([^"]*)")?[^>]*>\s*<instance_effect url="#([^"]*)"/g)) {
    const e = effects.get(m[3]) || {}, name = Buffer.from(m[2] || m[1], 'latin1').toString('utf8');
    mats.set(m[1], { rgb: e.rgb, tex: e.tex, a: Math.max(0, Math.min(1, e.a ?? 1)), name });
  }
  for (const [k, v] of mats) mats.set(k, hexOf(v));

  // 모양: 위치 소스 + triangles (재질 기호 · 꼭짓점 번호)
  const geos = new Map(), G = sec('library_geometries');
  let at = 0;
  for (;;) {
    const a = G.indexOf('<geometry ', at); if (a < 0) break; const b = G.indexOf('</geometry>', a); at = b;
    const body = G.slice(a, b), id = attr(body.slice(0, 200), 'id');
    const srcs = new Map(); for (const m of body.matchAll(/<source id="([^"]*)"[\s\S]*?<float_array[^>]*>([^<]*)<\/float_array>/g)) srcs.set(m[1], m[2]);
    const vin = body.match(/<vertices id="([^"]*)"[\s\S]*?semantic="POSITION" source="#([^"]*)"/);
    if (!vin) continue;
    const pos = new Float32Array(num(srcs.get(vin[2]) || ''));
    const list = [];
    for (const t of body.matchAll(/<triangles([^>]*)>([\s\S]*?)<\/triangles>/g)) {
      const inputs = [...t[2].matchAll(/<input ([^>]*)\/>/g)].map((x) => ({ sem: attr(x[1], 'semantic'), off: +attr(x[1], 'offset') }));
      const stride = Math.max(...inputs.map((x) => x.off)) + 1, voff = inputs.find((x) => x.sem === 'VERTEX')?.off ?? 0;
      const p = num(t[2].match(/<p>([^<]*)<\/p>/)?.[1] || ''), idx = new Uint32Array(p.length / stride);
      for (let i = 0; i < idx.length; i++) idx[i] = p[i * stride + voff];
      list.push({ sym: attr(t[1], 'material'), idx });
    }
    geos.set(id, { pos, list });
  }

  // 노드 나무 (장면 + 라이브러리 노드): 행렬 · 모양 · 부품(instance_node)
  const parseNodes = (txt) => {
    const root = { kids: [], geo: [], inst: [], m: null }, stack = [root], byId = new Map();
    for (const m of txt.matchAll(/<(\/?)(node|matrix|instance_geometry|instance_material|instance_node)\b([^>]*?)(\/?)>([^<]*)/g)) {
      const [, close, tag, at2, self, text] = m, top = stack[stack.length - 1];
      if (tag === 'node') { if (close) { stack.pop(); continue; } const n = { kids: [], geo: [], inst: [], m: null }; top.kids.push(n); const id = attr(at2, 'id'); if (id) byId.set(id, n); if (!self) stack.push(n); }
      else if (tag === 'matrix' && !close) top.m = num(text);
      else if (tag === 'instance_geometry' && !close) { top.geo.push({ url: attr(at2, 'url').slice(1), bind: {} }); }
      else if (tag === 'instance_material' && !close) { const g = top.geo[top.geo.length - 1]; if (g) g.bind[attr(at2, 'symbol')] = attr(at2, 'target').slice(1); }
      else if (tag === 'instance_node' && !close) top.inst.push(attr(at2, 'url').slice(1));
    }
    return { root, byId };
  };
  const lib = parseNodes(sec('library_nodes')), scene = parseNodes(sec('library_visual_scenes'));
  const byId = new Map([...lib.byId, ...scene.byId]);

  // 행렬 (DAE 는 행 우선)
  const mul = (a, b) => { const o = new Array(16); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c]; o[r * 4 + c] = s; } return o; };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const tris = new Map();
  let total = 0;
  const walk = (n, P, depth) => {
    if (depth > 40) return;
    const W0 = n.m ? mul(P, n.m) : P;
    for (const g of n.geo) {
      const geo = geos.get(g.url); if (!geo) continue;
      const { pos } = geo, W = new Float32Array(pos.length);
      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        const X = W0[0] * x + W0[1] * y + W0[2] * z + W0[3], Y = W0[4] * x + W0[5] * y + W0[6] * z + W0[7], Z = W0[8] * x + W0[9] * y + W0[10] * z + W0[11];
        // Z 위 → Y 위 (x, z, -y), 단위 → m
        if (zUp) { W[i] = X * unit; W[i + 1] = Z * unit; W[i + 2] = -Y * unit; } else { W[i] = X * unit; W[i + 1] = Y * unit; W[i + 2] = Z * unit; }
      }
      for (const { sym, idx } of geo.list) {
        const mk = g.bind[sym] || sym, info = mats.get(mk); if (info?.skip) continue;
        let L = tris.get(mk); if (!L) tris.set(mk, (L = [])); L.push({ W, idx, cnt: idx.length }); total += idx.length / 3;
      }
    }
    for (const id of n.inst) { const t = byId.get(id); if (t) walk(t, W0, depth + 1); }
    for (const k of n.kids) walk(k, W0, depth + 1);
  };
  walk(scene.root, I, 0);
  return { tris, mats, total };
}
