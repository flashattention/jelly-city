// OpenAI Chat Completions 호출 (서버 전용, 키는 브라우저에 노출되지 않음)
//   돈 공격 막기 (2026-11-13 보안 9-2): 모든 호출이 여기를 지난다
//     - 사람(who) 하나 1분 8번 · 하루 150번, 전체 1분 90번 · 하루 LLM_DAILY_CALLS(15000)번. 넘으면 'budget' 오류 → 부른 쪽이 기본 대사로
//     - 출력 최대 토큰 500 · 입력 글자 합 12000 (넘으면 오래된 대화부터 뺀다)
import { Budget } from './llm-guard.js';

const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export const PROVIDER = 'openai';
export let llmEnabled = !!API_KEY;
export const budget = new Budget({ allDay: Number(process.env.LLM_DAILY_CALLS) || 15000, allMin: Number(process.env.LLM_PER_MIN) || 90 });
export const llmStats = () => budget.summary();
const MAX_OUT = 500, MAX_IN = 12000;

// 시험용: 진짜 API 대신 가짜 모델 (돈이 들지 않게). fn(body) → 모델이 낸 글자
let fake = null;
export function _setFakeLlm(fn) { fake = fn; llmEnabled = !!fn || !!API_KEY; budget.reset(); }

// 출력 JSON 스키마 (structured outputs)
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const SCHEMAS = {
  talk: obj({
    reply: { type: 'string' },
    emotion: { type: 'string', enum: ['happy', 'neutral', 'sad', 'angry', 'surprised', 'love', 'scared', 'thinking'] },
    affinity_delta: { type: 'integer' },
    mood_delta: { type: 'integer' },
    insulted: { type: 'boolean' },
    action: { type: 'string', enum: ['none', 'give_money', 'end'] },
    amount: { type: 'integer' },
  }),
  street: obj({ lines: { type: 'array', items: obj({ speaker: { type: 'string', enum: ['A', 'B'] }, text: { type: 'string' } }) } }),
  memory: obj({ memory: { type: 'string' } }),
};

function parseJson(text) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('JSON 파싱 실패');
  }
}
// 입력이 너무 길면 시스템 메시지와 마지막 말은 두고 가운데 대화부터 뺀다
const size = (m) => (typeof m.content === 'string' ? m.content.length : 2000);
function trimInput(messages) {
  const out = [...messages];
  while (out.length > 2 && out.reduce((a, m) => a + size(m), 0) > MAX_IN) out.splice(1, 1);
  return out;
}

// who: 누가 부르게 했나 (계정 · 캐릭터 · IP — 사람별 횟수), kind: 무엇에 쓰나 (talk · memory · street · board · word · draw)
export async function complete(messages, { json = true, schema = null, temperature = 0.9, max_tokens = 300, model = MODEL, who = '', kind = 'etc' } = {}) {
  const ok = budget.take(String(who || ''), kind);
  if (!ok.ok) throw Object.assign(new Error(`budget:${ok.why}`), { budget: ok.why });
  const body = { model, messages: trimInput(messages), temperature, max_tokens: Math.min(MAX_OUT, max_tokens) };
  if (json) body.response_format = schema ? { type: 'json_schema', json_schema: { name: 'out', strict: true, schema } } : { type: 'json_object' };
  let text;
  if (fake) text = await fake(body);
  else {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    // 오류 문구에 요청 내용 · 키가 섞이지 않게 상태 코드와 짧은 종류만
    if (!res.ok) { let code = ''; try { code = String((await res.json())?.error?.code || '').slice(0, 40); } catch { /* 글자 아님 */ } throw new Error(`LLM ${res.status} ${code}`.trim()); }
    const data = await res.json();
    text = data.choices?.[0]?.message?.content || '';
  }
  return json ? parseJson(text) : text;
}
