// 🌐 영어 화면 엔진 (영어일 때만 main.js 가 불러온다 · docs/dream-runner/다국어-작업지시서.md)
//   게임 코드 · 데이터는 한국어 그대로 두고, 화면에 나오는 글씨만 사전(ko → en)대로 바꿔 끼운다
//   - 문서의 글씨 마디 · title · placeholder · aria-label · alt (MutationObserver 로 계속)
//   - 캔버스 글씨(fillText · strokeText · measureText) · alert · confirm · prompt
//   - translate="no" 가 붙은 곳(대화 · 직접 쓴 글)은 그대로
//   패턴 영어 쪽: $1 = 잡힌 조각을 다시 번역(못 하면 다른 방법) · %1 = 번역되면 번역, 아니면 그대로(닉네임 · 이름)
//   찾는 순서: 통째로 → 앞뒤 기호 · 이모지 · 숫자 떼고 → 패턴(잡힌 조각도 다시 사전으로) → ' · ' 등으로 나눠 조각마다 → 숫자 + 단위
//   못 찾은 한글은 window.__i18nMiss 에 모은다 (시험 때 사전에 더한다)
const PARTS = ['dreams', 'times', 'shared', 'hangang-a', 'hangang-b', 'server', 'ui', 'extra'];
const HAN = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const D = new Map(), PAT = [];
const miss = (window.__i18nMiss = new Set());

// 숫자 + 단위 (사전에 없을 때 마지막으로)
const UNIT = { 판: (n) => `${n} run${n === '1' ? '' : 's'}`, 번: (n) => `${n}×`, 개: (n) => n, 명: (n) => `${n} player${n === '1' ? '' : 's'}`, 일: (n) => `${n} day${n === '1' ? '' : 's'}`, 초: (n) => `${n}s`, 분: (n) => `${n} min`, 시간: (n) => `${n}h`, 위: (n) => `#${n}`, 점: (n) => `${n} pts`, 칸: (n) => `${n} cells`, 곳: (n) => `${n} places`, 층: (n) => `${n}F`, 년: (n) => n, 회: (n) => `${n}×`, 걸음: (n) => `${n} steps`, 마리: (n) => n, 대: (n) => n, 원: (n) => `₩${n}` };
const NUM_UNIT = new RegExp(`^([\\d,.]+)\\s?(${Object.keys(UNIT).sort((a, b) => b.length - a.length).join('|')})$`);
const SEPS = [' · ', ' — ', ' / ', '\n', ' | ', ', '];

// 패턴 바꿔 넣기: $n = 잡힌 조각을 다시 번역(못 하면 이 패턴은 포기) · %n = 번역되면 번역, 안 되면 그대로 (닉네임 · 가게 · 역 이름)
function sub(to, g, depth, fail) {
  return to.replace(/([$%])(\d)/g, (_, k, i) => { const v = g[+i] ?? ''; const w = core(v, depth + 1); if (w != null) return w; if (k === '$') fail(); return v; });
}
function core(s, depth) {
  if (!HAN.test(s)) return s;
  let r = D.get(s); if (r != null) return r;
  // 앞뒤 기호 · 이모지 · 숫자 떼기
  const m = s.match(/^([^가-힣A-Za-z]*)([\s\S]*?)([^가-힣A-Za-z]*)$/);
  const m0 = s.match(/^([^가-힣A-Za-z0-9]*)([\s\S]*?)([^가-힣A-Za-z0-9]*)$/); // 숫자는 남기고 기호 · 이모지만
  if (m0 && (m0[1] || m0[3]) && m0[2]) { r = D.get(m0[2]); if (r != null) return m0[1] + r + m0[3]; r = D.get(m0[2] + m0[3]); if (r != null) return m0[1] + r; r = D.get(m0[1] + m0[2]); if (r != null) return r + m0[3]; }
  if (m && (m[1] || m[3]) && m[2]) { r = D.get(m[2]); if (r != null) return m[1] + r + m[3]; }
  if (depth > 4) return null;
  for (const [re, to] of PAT) {
    const g = s.match(re); if (!g) continue;
    let bad = false;
    const out = sub(to, g, depth, () => { bad = true; });
    if (!bad) return out;
  }
  if (m && m[2] && m[2] !== s) { for (const [re, to] of PAT) { const g = m[2].match(re); if (!g) continue; let bad = false; const out = sub(to, g, depth, () => { bad = true; }); if (!bad) return m[1] + out + m[3]; } }
  for (const sep of SEPS) {
    if (!s.includes(sep)) continue;
    const parts = s.split(sep).map((p) => { const a = p.match(/^(\s*)([\s\S]*?)(\s*)$/); const w = core(a[2], depth + 1); return w == null ? null : a[1] + w + a[3]; });
    if (parts.every((p) => p != null)) return parts.join(sep);
  }
  const u = s.match(NUM_UNIT); if (u) return UNIT[u[2]](u[1]);
  const u2 = s.match(/^([^가-힣A-Za-z\d]*)([\d,.]+)\s?([가-힣]+)([^가-힣A-Za-z]*)$/); if (u2 && UNIT[u2[3]]) return u2[1] + UNIT[u2[3]](u2[2]) + u2[4];
  return null;
}
const cache = new Map();
export function tx(s, quiet) {
  if (typeof s !== 'string' || !HAN.test(s)) return s;
  let r = cache.get(s); if (r !== undefined) return r;
  const a = s.match(/^(\s*)([\s\S]*?)(\s*)$/), w = core(a[2], 0);
  if (w == null) { if (!quiet && miss.size < 3000) miss.add(a[2]); r = s; } else r = a[1] + w + a[3];
  if (cache.size > 30000) cache.clear(); cache.set(s, r); return r;
}

// 화면 지켜보기
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
const skip = (el) => !!el?.closest?.('[translate="no"], script, style, textarea, [contenteditable="true"]');
function fixText(n) { const v = n.nodeValue; if (!v || !HAN.test(v)) return; if (skip(n.parentElement)) return; const r = tx(v); if (r !== v) n.nodeValue = r; }
function fixAttrs(el) { for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v && HAN.test(v)) { if (skip(el)) return; const r = tx(v); if (r !== v) el.setAttribute(a, r); } } if ((el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) && HAN.test(el.value)) el.value = tx(el.value); }
function walk(root) {
  if (root.nodeType === 3) { fixText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) { if (skip(root)) return; fixAttrs(root); }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
}

export async function start() {
  const got = await Promise.allSettled(PARTS.map((p) => import(`./${p}.js`)));
  for (const [gi, g] of got.entries()) {
    if (g.status !== 'fulfilled') continue;
    const at = PAT.length, first = PARTS[gi] === 'extra'; // extra 패턴은 맨 앞에서 먼저 본다
    for (const [k, v] of Object.entries(g.value.default || {})) if (k && v != null) D.set(k.trim(), v);
    // 정규식 밖 한글이 3자 이상인 패턴(문장이 분명함)은 잡힌 조각을 못 번역해도 그대로 넣는다 ($ → %) — 닉네임 · 역 · 가게 이름 때문에 문장 전체가 한국어로 남지 않게
    for (const [re, to] of g.value.PATTERNS || []) { try { const soft = (re.replace(/\((?:[^()\\]|\\.)*\)/g, '').match(/[가-힣]/g) || []).length >= 3; PAT.push([new RegExp(re), soft ? to.replace(/\$(\d)/g, '%$1') : to]); } catch { /* 잘못된 패턴은 건너뜀 */ } }
    if (first) PAT.unshift(...PAT.splice(at));
  }
  document.documentElement.lang = 'en';
  walk(document.documentElement);
  window.__i18nMs = 0; // 화면 지켜보기에 쓴 시간 합(ms) — 성능 확인용
  new MutationObserver((recs) => {
    const t0 = performance.now();
    for (const r of recs) {
      if (r.type === 'characterData') fixText(r.target);
      else if (r.type === 'attributes') fixAttrs(r.target);
      else for (const n of r.addedNodes) walk(n);
    }
    window.__i18nMs += performance.now() - t0;
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // 캔버스 글씨 · 대화상자
  for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
    if (!C) continue;
    for (const f of ['fillText', 'strokeText', 'measureText']) { const o = C.prototype[f]; C.prototype[f] = function (s, ...a) { return o.call(this, tx(String(s), true), ...a); }; }
  }
  for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f]; window[f] = (m, ...a) => o.call(window, tx(String(m ?? '')), ...a); }
  return { tx, D, PAT };
}
