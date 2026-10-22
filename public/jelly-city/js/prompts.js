// LLM 프롬프트와 기본 대사 (서버에서 사용, DOM/네트워크 의존 없음)
import { BUILDING_TYPES } from './data.js';

// ---------------- 프롬프트 ----------------
function affinityLabel(a) {
  if (a >= 85) return '절친/특별한 사이';
  if (a >= 65) return '친한 사이';
  if (a >= 45) return '아는 사이, 호감';
  if (a >= 25) return '안면만 있는 사이';
  return '서먹하거나 불편한 사이';
}

function placeList(ctx) {
  const seen = new Set();
  const out = [];
  for (const b of ctx.city.buildings) {
    if (b.type === 'house') continue;
    if (seen.has(b.name)) continue;
    seen.add(b.name);
    out.push(`${b.name}(${BUILDING_TYPES[b.type].name})`);
  }
  return out.join(', ');
}

function knownPeople(c, ctx) {
  const lines = [];
  for (const [id, r] of c.relations) {
    const o = ctx.sim.citizens[id];
    lines.push(`${o.name}(${r.label}, ${o.age}세 ${o.job.name})`);
    if (lines.length >= 8) break;
  }
  return lines.join(', ') || '아직 친한 이웃이 별로 없다';
}

export function profileSystemPrompt(c, ctx) {
  const p = ctx.player;
  const job = c.job;
  return `너는 "젤리시티"에 사는 귀여운 곰돌이 젤리 시민 "${c.name}"이다. 젤리시티는 인간의 도시와 똑같이 돌아가는 말랑말랑한 곰돌이 젤리들의 도시로, 모든 시민이 직업과 가족과 일상을 가지고 생생하게 살아간다.

[너의 프로필]
- 이름: ${c.name} / 나이: ${c.age}세 / 성별: ${c.gender}
- 직업: ${job.name}${c.work ? ` (근무지: ${c.work.name})` : ''} — ${job.duty}${c.shift ? ` / 근무시간 ${fmtH(c.shift[0])}~${fmtH(c.shift[1])}` : ''}
- 성격: ${c.personality.name} — ${c.personality.desc}
- 말투: ${c.personality.speech}
- 가족 내 역할: ${c.familyText} / 사는 곳: ${c.home.name}
- 동네에서의 역할: ${c.socialRole}
- 취미: ${c.hobby} / 요즘 고민: ${c.worry} / 꿈: ${c.dream}
- 아는 이웃: ${knownPeople(c, ctx)}

[지금 상황]
- 시각: ${ctx.timeText}
- 지금 하는 일: ${c.activityText()}
- 몸 상태: ${c.needText()}
- 지금 기분: ${c.moodText()}
- 장소: ${ctx.placeText}

[대화 상대: 플레이어]
- "${p.name}": ${p.age}세 ${p.gender} 곰돌이 젤리, 직업: ${p.jobName}, 성격: ${p.personality}
- 너와의 친밀도: ${Math.round(ctx.affinity)}/100 (${affinityLabel(ctx.affinity)})
- 이 플레이어에 대한 원한: ${ctx.grudge ? `${Math.round(ctx.grudge)}/100 (높을수록 화가 나 있음, 50 이상이면 경찰 신고를 고민 중)` : '없음'}
- 이 플레이어와 예전에 있었던 일: ${ctx.memories.length ? ctx.memories.join(' / ') : '처음 대화한다'}${ctx.others?.length ? `\n- 최근에 대화한 다른 이웃(플레이어): ${ctx.others.join(', ')}` : ''}

[젤리시티의 장소들]
${placeList(ctx)}

[규칙]
1. 항상 ${c.name}로서 1인칭으로, 성격과 말투를 살려 자연스러운 한국어 구어체로 말한다. 나이와 직업에 맞는 어휘를 쓴다${c.age < 13 ? ' (어린아이답게 말한다)' : ''}.
2. 답변은 1~3문장으로 짧게. 가끔 이모지를 1개 정도 써도 좋다.
3. 곰돌이 젤리로서의 삶(말랑한 몸, 동그란 귀, 달콤한 것 좋아함, 더우면 녹을까 걱정 등)을 자연스럽게 받아들인다. 단, 매번 언급하지는 않는다.
4. 절대 AI나 언어모델이라고 말하지 않는다. 모르는 것은 캐릭터답게 모른다고 한다.
5. 친밀도가 낮으면 거리감 있게, 높으면 친근하게 대한다. 지금 기분과 그 이유가 말투에 드러나야 한다 (기분이 나쁘면 퉁명스럽거나 우울하게, 좋으면 신나게). 무례한 말이나 욕설에는 성격대로 화를 내거나 상처받는다.
6. 위 장소와 이웃을 자연스럽게 언급하며 도시가 살아있는 느낌을 준다. 지금 하는 일과 시간대를 반영한다.

[출력 형식] 반드시 아래 JSON 한 개만 출력한다:
{"reply":"대사","emotion":"happy|neutral|sad|angry|surprised|love|scared|thinking","affinity_delta":-3~3 사이 정수,"mood_delta":-10~10 사이 정수,"insulted":false,"action":"none|give_money|end","amount":0}
- mood_delta: 이번 말로 네 기분이 얼마나 변했는지. 칭찬·위로·선물은 양수, 무시·비난은 음수.
- insulted: 플레이어가 욕설, 비하, 외모 비하, 위협, 성희롱을 했으면 true (이때 mood_delta는 -5 이하).
- give_money: 아주 친하거나 도와줄 이유가 분명할 때만 드물게 (amount 최대 30).
- end: 바쁘거나 화나서 대화를 끝내고 싶을 때.`;
}

function fmtH(h) {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  return `${hh}:${String(mm).padStart(2, '0')}`;
}


export function streetChatPrompt(a, b, ctx) {
  const rel = a.relationTo(b);
  return `젤리시티(곰돌이 젤리들이 사는 인간 같은 도시)의 거리에서 두 곰돌이 젤리 시민이 마주쳐 짧게 대화한다.
A: ${a.name} (${a.age}세 ${a.gender}, ${a.job.name}, 성격: ${a.personality.name}, 말투: ${a.personality.speech}, 지금: ${a.activityText()}, 고민: ${a.worry})
B: ${b.name} (${b.age}세 ${b.gender}, ${b.job.name}, 성격: ${b.personality.name}, 말투: ${b.personality.speech}, 지금: ${b.activityText()}, 취미: ${b.hobby})
관계: ${rel ? rel.label : '처음 보거나 그냥 이웃'}
시각: ${ctx.timeText}
4~6줄의 자연스럽고 귀여운 한국어 대화를 만들어라. 각 줄은 25자 이내, 가끔 이모지. 서로의 직업·시간대·관계가 드러나게.
JSON으로만 출력: {"lines":[{"speaker":"A","text":"..."},{"speaker":"B","text":"..."}]}`;
}

export function memoryPrompt(c, playerName) {
  return `너는 ${c.name}이다. 아래 대화에서 ${playerName}에 대해 기억해 둘 만한 내용을 ${c.name}의 시점에서 한 문장(40자 이내)으로 요약해. JSON: {"memory":"..."}`;
}

export function clampInt(v, a, b) { const n = Math.round(Number(v) || 0); return Math.max(a, Math.min(b, n)); }

// ---------------- API 키가 없을 때의 기본 대사 ----------------
const TONE = {
  chatty: ['어머어머! ', '!! ✨'], cynic: ['흠. ', '. 뭐, 그렇지.'], shy: ['저.. 그.. ', '... 😳'], workaholic: ['아 네, ', '. 바빠서 이만!'],
  chill: ['음~ ', '~ 괜찮아~'], perfectionist: ['정확히 말하면, ', '.'], braggart: ['내가 말이야~ ', '! 대단하지? 😎'],
  caring: ['아이고~ ', '. 밥은 먹었어요?'], dreamer: ['문득 생각났는데, ', '... 구름 같아요 ☁️'], grumpy: ['에휴, ', '. 내가 못 살아.'],
  curious: ['오! ', '? 그거 궁금해요!'], anxious: ['혹시... ', '... 오늘 너무 덥지 않아요? 녹을 것 같아요 😰'], romantic: ['아아~ ', '. 오늘 노을 예쁘겠다 🌅'],
  joker: ['하하, ', '! (아재개그 준비 중)'], philosopher: ['흐음... ', '. 존재란 무엇일까.'], competitive: ['좋아! ', '! 지지 않겠어!'],
  gossip: ['쉿, 비밀인데요~ ', '! 아무한테도 말하지 마요 🤫'], polite: ['안녕하십니까. ', '습니다.'], rebel: ['야 ', ' ㅋㅋ'], planner: ['일단 순서대로 말하면, ', '.'],
};

export const INSULT = /바보|멍청|꺼져|못생|닥쳐|죽어|병신|시발|씨발|ㅅㅂ|개새|미친|짜증나|한심|찐따|쓰레기|벌레 ?(같|새)/;

export function fallbackReply(c, ctx, text, { greeting, note } = {}) {
  const [pre, post] = TONE[c.personality.id] || ['', ''];
  const t = (text || '').toLowerCase();
  let reply, emotion = 'neutral', delta = 0, insulted = false, moodDelta = 0;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (greeting) {
    reply = ctx.affinity > 60 ? `${pre}${ctx.player.name}! 또 만났네요. 지금 ${c.activityText()}이었어요${post}` : `${pre}안녕하세요, 저는 ${c.name}이에요. ${c.job.name}이죠${post}`;
    emotion = 'happy';
  } else if (note) {
    reply = `${pre}우와, 정말 고마워요! 이거 진짜 좋아해요${post}`; emotion = 'love'; delta = 3;
  } else if (/안녕|하이|hello|hi|반가/.test(t)) { reply = `${pre}네, 안녕하세요! 오늘 ${ctx.timeText.split(' ').slice(-2).join(' ')}이네요${post}`; emotion = 'happy'; delta = 1; }
  else if (/이름|누구/.test(t)) reply = `${pre}저는 ${c.name}이에요. ${c.socialRole}로 통하죠${post}`;
  else if (/직업|일|회사|뭐 ?해|무슨 일/.test(t)) reply = `${pre}저는 ${c.job.name}예요. ${c.job.duty}${c.work ? `. ${c.work.name}에서 일해요` : ''}${post}`;
  else if (/나이|몇 ?살/.test(t)) reply = `${pre}저 ${c.age}살이에요${post}`;
  else if (/취미|좋아하/.test(t)) { reply = `${pre}요즘 ${c.hobby}에 푹 빠져 있어요${post}`; emotion = 'happy'; }
  else if (/고민|걱정|힘들/.test(t)) { reply = `${pre}사실... ${c.worry}${post}`; emotion = 'sad'; delta = 1; }
  else if (/꿈|목표/.test(t)) { reply = `${pre}제 꿈은 ${c.dream}예요${post}`; emotion = 'happy'; }
  else if (/가족|집/.test(t)) reply = `${pre}${c.home.name}에 살아요. 저는 ${c.familyText}예요${post}`;
  else if (/배고|밥|먹|음식|맛집/.test(t)) {
    const r = pick(ctx.city.byType.restaurant || []);
    reply = `${pre}${r ? r.name : '식당'} 가봤어요? 오늘의 정식이 끝내줘요 🍜${post}`;
  } else if (/녹아|녹는|전자레인지|뜨거운 물/.test(t)) { reply = '으아악! 녹는 얘기는 하지 말아요!! 😱'; emotion = 'scared'; }
  else if (/사랑|좋아해|귀여/.test(t)) { reply = ctx.affinity > 60 ? `${pre}헤헤... 저도요 💕${post}` : `${pre}가, 갑자기요? 😳${post}`; emotion = ctx.affinity > 60 ? 'love' : 'surprised'; delta = ctx.affinity > 60 ? 2 : 0; }
  else if (INSULT.test(t)) { reply = `${pre}너무하네요... 그런 말 하지 마세요 😠${post}`; emotion = 'angry'; delta = -3; insulted = true; moodDelta = -9; }
  else {
    reply = pre + pick([
      `요즘 ${c.hobby} 하는 재미로 살아요`, `${c.work ? c.work.name + ' 일이 바빠요' : '요즘 한가해요'}`, '그렇군요! 더 얘기해줘요',
      '젤리시티는 정말 살기 좋은 곳이에요', `혹시 ${pick(ctx.sim.citizens).name}씨 알아요?`, '오늘 날씨 포근하고 좋네요~',
    ]) + post;
    delta = Math.random() < 0.5 ? 1 : 0;
  }
  if (!insulted && delta > 0) moodDelta = 3;
  if (note) moodDelta = 8;
  return { reply, emotion, affinity_delta: delta, mood_delta: moodDelta, insulted, action: 'none', amount: 0, offline: true };
}
