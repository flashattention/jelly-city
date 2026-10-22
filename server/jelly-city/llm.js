// OpenAI Chat Completions 호출 (서버 전용, 키는 브라우저에 노출되지 않음)
const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export const PROVIDER = 'openai';
export const llmEnabled = !!API_KEY;

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

export async function complete(messages, { json = true, schema = null, temperature = 0.9, max_tokens = 300 } = {}) {
  const body = { model: MODEL, messages, temperature, max_tokens };
  if (json) body.response_format = schema ? { type: 'json_schema', json_schema: { name: 'out', strict: true, schema } } : { type: 'json_object' };
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return json ? parseJson(text) : text;
}
