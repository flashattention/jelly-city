// 끝말잇기 심판: 두음법칙 · 단어장 · 사전 확인(LLM, 결과는 저장해 두고 다시 묻지 않는다) · 봇이 고를 단어
import fs from 'node:fs';
import path from 'node:path';
import { WORDS } from './words.js';
import { complete, llmEnabled } from '../jelly-city/llm.js';

const BASE = new Set(WORDS);
const byFirst = new Map();
for (const w of WORDS) { if (!byFirst.has(w[0])) byFirst.set(w[0], []); byFirst.get(w[0]).push(w); }

// ---------- 한글 ----------
const S0 = 0xac00;
const split = (ch) => { const c = ch.charCodeAt(0) - S0; return c < 0 || c > 11171 ? null : { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 }; };
const join = (cho, jung, jong) => String.fromCharCode(S0 + cho * 588 + jung * 28 + jong);
const CHO_N = 2, CHO_R = 5, CHO_O = 11;
const IY = new Set([2, 6, 7, 12, 17, 20]); // ㅑ ㅕ ㅖ ㅛ ㅠ ㅣ
// 두음법칙: '력'으로 끝나면 '역'으로도 시작할 수 있다 (라→나, 려→여, 녀→여 …)
export function startsFor(ch) {
  const out = [ch], s = split(ch);
  if (!s) return out;
  if (s.cho === CHO_R) out.push(join(IY.has(s.jung) ? CHO_O : CHO_N, s.jung, s.jong));
  if (s.cho === CHO_N && IY.has(s.jung)) out.push(join(CHO_O, s.jung, s.jong));
  return out;
}
export const isWordShape = (w) => /^[가-힣]{2,12}$/.test(w);

// ---------- 사전 확인 ----------
export class Dict {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'word-cache3.json'); // 3: 인명 · 캐릭터 · 고유명사 · 외래어도 인정하는 기준 (예전 판정은 버린다)
    this.cache = {};
    try { this.cache = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* 처음 */ }
    this.dirty = false; this.pending = new Map();
    setInterval(() => this.save(), 30000).unref();
  }
  save() {
    if (!this.dirty) return;
    this.dirty = false;
    const keys = Object.keys(this.cache); if (keys.length > 30000) for (const k of keys.slice(0, keys.length - 30000)) delete this.cache[k];
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.cache)); fs.renameSync(this.file + '.tmp', this.file); } catch (e) { console.error('단어 저장 실패', e); }
  }
  // { ok, why } — 단어장에 있으면 바로, 아니면 저장된 판정, 그래도 없으면 LLM 에게 묻는다
  async check(w) {
    if (BASE.has(w)) return { ok: true };
    if (w in this.cache) return this.cache[w] ? { ok: true } : { ok: false, why: '쓸 수 없는 말이에요 (활용형 · 지어낸 말 · 비속어)' };
    if (!llmEnabled) return { ok: true, loose: true }; // 사전 확인을 못 하면 너그럽게
    if (this.pending.has(w)) return this.pending.get(w);
    const job = (async () => {
      try {
        const r = await complete([
          { role: 'system', content: '너는 너그러운 한국어 끝말잇기 심판이다. 주어진 낱말이 한국어에서 실제로 쓰이는 명사이면 인정한다. 표준국어대사전 · 우리말샘의 일반 명사, 외래어 · 전문 용어(예: 사이코패스, 알고리즘), 고유명사(사람 이름 · 연예인 · 운동선수 · 역사 인물, 나라 · 도시 · 지명, 영화 · 책 · 노래 등 작품, 상표 · 회사, 게임 · 만화 · 애니 캐릭터, 리그 오브 레전드 챔피언 같은 게임 캐릭터 이름, 예: 음바페, 이순신, 서울, 피카츄, 르블랑, 아리)를 모두 인정한다. 인정하지 않는 것: 실제로 없는 지어낸 말, 오타, 동사 · 형용사 활용형(먹었다, 예쁜), 조사가 붙은 말, 욕설 · 비속어. 애매하면 인정한다.' },
          { role: 'user', content: `단어: ${w}` },
        ], { schema: { type: 'object', properties: { valid: { type: 'boolean' } }, required: ['valid'], additionalProperties: false }, temperature: 0, max_tokens: 20 });
        const ok = !!r.valid;
        this.cache[w] = ok; this.dirty = true;
        return ok ? { ok: true } : { ok: false, why: '쓸 수 없는 말이에요 (활용형 · 지어낸 말 · 비속어)' };
      } catch (e) {
        console.warn('단어 확인 실패', e.message);
        return { ok: true, loose: true };
      } finally { this.pending.delete(w); }
    })();
    this.pending.set(w, job);
    return job;
  }
  // 봇: ch 로 시작하는 쓸 수 있는 단어 (단어장 → 예전에 인정된 단어 → LLM 에게 후보를 받아서)
  async botWord(ch, used, strong = false) {
    const starts = startsFor(ch);
    let pool = starts.flatMap((s) => byFirst.get(s) || []).filter((w) => !used.has(w));
    if (!pool.length) pool = Object.keys(this.cache).filter((w) => this.cache[w] && starts.includes(w[0]) && !used.has(w));
    if (!pool.length && llmEnabled) {
      try {
        const r = await complete([
          { role: 'system', content: '한국어 끝말잇기를 한다. 표준국어대사전에 실린 일반 명사만 답한다. 고유명사 · 줄임말 · 신조어는 쓰지 않는다.' },
          { role: 'user', content: `'${starts.join("' 또는 '")}'(으)로 시작하는 두 글자 이상 명사를 8개 알려줘.` },
        ], { schema: { type: 'object', properties: { words: { type: 'array', items: { type: 'string' } } }, required: ['words'], additionalProperties: false }, temperature: 0.7, max_tokens: 120 });
        pool = (r.words || []).map((x) => String(x).trim()).filter((x) => isWordShape(x) && starts.includes(x[0]) && !used.has(x));
        for (const x of pool) { if (!(x in this.cache)) { this.cache[x] = true; this.dirty = true; } }
      } catch { /* 봇이 진다 */ }
    }
    if (!pool.length) return null;
    // 강한 봇은 긴 단어 · 이어 가기 어려운 끝 글자를 좋아한다
    if (strong) pool.sort((a, b) => b.length - a.length);
    const top = strong ? pool.slice(0, Math.max(1, Math.ceil(pool.length / 3))) : pool;
    return top[Math.floor(Math.random() * top.length)];
  }
  // 첫 단어: 이어 가기 쉬운 끝 글자로 끝나는 단어
  starter(used = new Set()) {
    const good = WORDS.filter((w) => !used.has(w) && w.length >= 2 && startsFor(w.at(-1)).some((s) => (byFirst.get(s) || []).length >= 3));
    return good[Math.floor(Math.random() * good.length)];
  }
}
