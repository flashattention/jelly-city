// 🌐 드림 러너 랜딩 언어 (웹 랜딩만 · docs/dream-runner/랜딩-작업지시서.md 5차)
//   정하기: 저장한 선택(localStorage 'dr-lang') → 없으면 브라우저 언어 목록 첫 번째가 한국어면 한국어, 아니면 영어
//   한국어는 index.html 그대로, 영어는 아래 표대로 바꿔 끼운다 (실시간 숫자 자리 data-st 는 그대로 살린다)
const KEY = 'dr-lang';
const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
const first = ((navigator.languages && navigator.languages[0]) || navigator.language || 'ko').toLowerCase();
export const LANG = saved === 'ko' || saved === 'en' ? saved : first.startsWith('ko') ? 'ko' : 'en';
export const EN = LANG === 'en';
export const t = (ko, en) => (EN ? en : ko);
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch { /* 이번만 */ } location.reload(); }

// 세계 · 난이도 · 모드 이름
export const WORLD_EN = { dream: 'Dreamland', hell: 'Hell', void: 'The Void', seoul: 'Seoul', time: 'History of Everything' };
const DIFF_EN = { 노멀: 'Normal', 하드: 'Hard', 광속: 'Lightspeed', 초월: 'Beyond', 특이점: 'Singularity' };
// '🙂 노멀' → '🙂 Normal'
export const diffName = (ko) => (EN ? ko.replace(/(\S+)$/, (w) => DIFF_EN[w] || w) : ko);
export const modeName = (item) => (item ? t('🎁 아이템전', '🎁 Item battle') : t('⚡ 스피드전', '⚡ Speed run'));

const S = (n) => `<span data-st="${n}">—</span>`;
// [선택자, 영어 HTML, (속성 이름)] — 속성 이름을 주면 그 속성을 바꾼다
const T = [
  ['.dl-bar nav', `<a href="#dl-worlds" data-dl-go="dl-worlds">Worlds</a><a href="#dl-why" data-dl-go="dl-why">Design</a><a href="#dl-num" data-dl-go="dl-num">Numbers</a><a href="#dl-how" data-dl-go="dl-how">How it's built</a><a href="/" class="dl-home">Jelly Games</a><span data-slot="snd"></span>`],
  ['.dl-mark', '🌙 Dream Runner'],
  // 다섯 세계 판
  ['.dl-pane[data-map="dream"] .dl-pane-hd', `<i>01</i><b>Dreamland</b><em>${S('content.dreams')} dreams</em><small>Floating platforms · the dream changes every 20s</small>`],
  ['.dl-pane[data-map="hell"] .dl-pane-hd', `<i>02</i><b>Hell</b><em>${S('content.hells')} hells</em><small>Lava paths · smashing fists</small>`],
  ['.dl-pane[data-map="void"] .dl-pane-hd', `<i>03</i><b>The Void</b><em>${S('content.voids')} rules</em><small>Every space bends one rule</small>`],
  ['.dl-pane[data-map="seoul"] .dl-pane-hd', `<i>04</i><b>Seoul</b><em>${S('content.courses')} courses</em><small>Real Seoul streets · cars and people</small>`],
  ['.dl-pane[data-map="time"] .dl-pane-hd', `<i>05</i><b>History of Everything</b><em>${S('content.eras')} eras</em><small>From the Big Bang to an AI future, run after run</small>`],
  ['.dl-pane[data-map="dream"] .dl-pane-more p', 'Run across platforms floating in the sky — pass the gate of time and the whole dream changes. Every dream has its own colors, music and obstacles.'],
  ['.dl-pane[data-map="hell"] .dl-pane-more p', 'Giant fists slam down on paths rising and falling over lava. Read the warning, then dodge — short, punchy rhythm.'],
  ['.dl-pane[data-map="void"] .dl-pane-more p', 'A mirror room where left is right, the last day under falling meteors — each space twists one rule.'],
  ['.dl-pane[data-map="seoul"] .dl-pane-more p', 'Seongsu café streets, Han River bridges, back alleys — dodge cars and people on Seoul courses built from real maps.'],
  ['.dl-pane[data-map="time"] .dl-pane-more p', 'From the Big Bang through dinosaurs, pyramids, Rome and the Moon landing to an AI future. Fall, and you pick up from that era.'],
  ['.dl-intro .dl-lab', 'A sleeping bear’s dream · 3D runner'],
  ['.dl-intro h1', 'Run through endless dreams'],
  ['.dl-intro .dl-lead', `A new dream unfolds every ${S('game.sec')} seconds. Pick one of the five worlds below and play.`],
  ['.dl-meta', `<div><dt>runs</dt><dd data-st="runs">—</dd></div><div><dt>bears</dt><dd data-st="players">—</dd></div><div><dt>worlds</dt><dd data-st="worlds">5</dd></div><div><dt>sub-maps</dt><dd data-st="content.total">321</dd></div>`],
  // 팝업 (출발 카드)
  ['#dl-board-t', '🏆 Leaderboard'],
  ['.dl-board-more', 'See all ›'],
  ['.dl-cue', 'The story of five worlds ↓'],
  // 다섯 세계 카드
  ['.dl-worlds > .dl-head', '<p class="dl-lab">Five worlds</p><h2>One bear,<br />five dreams</h2>'],
  ['.dl-world:nth-of-type(1) .dl-txt', `<p class="dl-no">01 · 2026.10.22</p><h3>Dreamland</h3><p>Run across platforms floating in the sky; pass the gate of time and the whole dream changes. A rainy city, an endlessly falling sky, an abstract space — every dream has its own colors, musical scale and obstacles.</p><dl><div><dt>dreams</dt><dd data-st="content.dreams">116</dd></div><div><dt>changes every</dt><dd>${S('game.sec')}s</dd></div><div><dt>bears ranked</dt><dd data-st="maps.dream">—</dd></div></dl><button class="dl-link" data-map="dream">Run in Dreamland</button>`],
  ['.dl-world:nth-of-type(2) .dl-txt', `<p class="dl-no">02 · 2026.11.05</p><h3>Hell</h3><p>Giant fists slam down on paths rising and falling over lava. Read the warning before each strike and dodge — shorter and punchier than Dreamland, with tension that never lets up.</p><dl><div><dt>hells</dt><dd data-st="content.hells">30</dd></div><div><dt>changes every</dt><dd>${S('game.sec')}s</dd></div><div><dt>bears ranked</dt><dd data-st="maps.hell">—</dd></div></dl><button class="dl-link" data-map="hell">Run into Hell</button>`],
  ['.dl-world:nth-of-type(3) .dl-txt', `<p class="dl-no">03 · 2026.11.07</p><h3>The Void</h3><p>A mirror room where left is right, the last day under falling meteors, the end of time — each space twists one rule. The runner you know, made new again.</p><dl><div><dt>spaces</dt><dd data-st="content.voids">30</dd></div><div><dt>twisted rules</dt><dd data-st="content.voids">30</dd></div><div><dt>bears ranked</dt><dd data-st="maps.void">—</dd></div></dl><button class="dl-link" data-map="void">Run into the Void</button>`],
  ['.dl-world:nth-of-type(4) .dl-txt', `<p class="dl-no">04 · 2026.11.12</p><h3>Seoul</h3><p>Seongsu café streets, Han River bridges, back alleys — real Seoul courses built from OpenStreetMap and VWorld data. Dodge cars and people; the weather follows Seoul right now.</p><dl><div><dt>courses</dt><dd data-st="content.courses">20</dd></div><div><dt>map data</dt><dd>OSM · VWorld</dd></div><div><dt>bears ranked</dt><dd data-st="maps.seoul">—</dd></div></dl><button class="dl-link" data-map="seoul">Run in Seoul</button>`],
  ['.dl-world:nth-of-type(5) .dl-txt', `<p class="dl-no">05 · 2026.11.15</p><h3>History of Everything</h3><p>The only world with a fixed order. The first stars, dinosaurs, a mammoth hunt, the pyramids, Roman legions and the Moon landing — all the way to a future where jelly bears stand up to AI. Fall, and your next run continues from that era.</p><dl><div><dt>eras</dt><dd data-st="content.eras">125</dd></div><div><dt>per era</dt><dd>${S('game.sec')}s</dd></div><div><dt>bears ranked</dt><dd data-st="maps.time">—</dd></div></dl><button class="dl-link" data-map="time">Run through history</button>`],
  // 기획 의도
  ['#dl-why .dl-side', '<p class="dl-lab">Design intent</p><h2>Quick runs,<br />a new dream every time</h2>'],
  ['#dl-why .dl-steps', `<li><b>30 seconds, one hand</b>The bear runs by itself — you only steer, jump and slide. An average run lasts ${S('avgSec')} seconds, and Enter starts the next one. Short enough for a single subway stop.</li><li><b>A new dream each run, the same path for everyone</b>Dreams and obstacles are generated from a seed, so every run is different. The same seed gives everyone the exact same path, so the server can replay your run and verify the record. That's why the leaderboard can be trusted.</li><li><b>You grow as you run</b>Collect wings, trails and titles with star candies, and climb separate leaderboards and the Hall of Fame for every world and difficulty. #1 on Singularity earns a rainbow-flame title.</li><li><b>Louder together</b>Up to ${S('game.roomMax')} players run the same dream, bumping and shoving. In item battles, grab up to ${S('game.maxItems')} of ${S('game.items')} items from ? boxes.</li>`],
  // 숫자
  ['#dl-num .dl-head', `<p class="dl-lab">Dream Runner in numbers</p><h2>Dreams so far</h2><p class="dl-asof">Counted from real records on the server · totals only, no personal data · refreshed daily at 8 AM, 12 PM and 4 PM KST · <span id="dl-asof">—</span></p>`],
  ['.dl-big', `<div><dd data-st="runs" data-n>—</dd><dt>runs played</dt></div><div><dd data-st="hours" data-n data-dec="1">—</dd><dt>hours in dreams</dt></div><div><dd data-st="players" data-n>—</dd><dt>bears</dt></div><div><dd data-st="records" data-n>—</dd><dt>leaderboard records</dt></div><div><dd data-st="verified" data-n data-suf="%">—</dd><dt>replay-verified by the server</dt></div><div><dd data-st="today.runs" data-n>—</dd><dt>runs today</dt></div>`],
  // 명예의 전당
  ['.dl-fame .dl-side', '<p class="dl-lab">Hall of Fame</p><h2>The bears<br />at the very top</h2><p>Starting from #1 on Singularity. Leaderboards are separate for every world, mode and difficulty.</p><button class="dl-link" data-tool="board-btn">See all leaderboards</button>'],
  // 만든 방식
  ['#dl-how .dl-side', '<p class="dl-lab">How it’s built</p><h2>Design &amp;<br />engineering</h2>'],
  ['#dl-how .dl-steps', `<li><b>A leaderboard you can trust</b>Each run starts with a ticket signed by the server; when it ends, the server replays your inputs with the same game code. Distance and stars must match within ${S('game.tol')}%. Slowed game clocks and machine-perfect inputs are filtered out too.</li><li><b>Smooth on phones</b>Static scenery is merged into one mesh per chunk, and repeated objects are drawn as instances. History of Everything went from 1,000 draw calls to 300–600 on PC and 250–350 on phones (measured 2026-11-15).</li><li><b>${S('game.diffN')} difficulty levels</b><span data-st-diffs>Normal ×1 · Hard ×1.4 · Lightspeed ×1.84 · Beyond ×2.45 · Singularity ×3.68</span>. Each speed has its own leaderboard, achievements and titles.</li><li><b>One codebase, three places</b>The web, the Microsoft Store app and the Toss mini-app run the same game code. The mini-app remembers the code version it was built from, so the server verifies records against exactly that version.</li><li><b>Built by one person</b>${S('code.files')} game files · ${S('code.lines')} lines. 3D with three.js, server on Node.js, deploys via GitHub Actions → Fly.io. Every scene is drawn in code.</li>`],
  // 걸어온 길
  ['.dl-road .dl-head', `<p class="dl-lab">The road so far</p><h2>${S('age.days')} days of footprints</h2>`],
  ['.dl-road .dl-line', `<li><time>10.22</time><b>First release</b><span>116 dreams · 12-player runs · item battles</span></li><li><time>11.05</time><b>Hell · record verification</b><span>The server replays inputs to stop cheating</span></li><li><time>11.07</time><b>The Void</b><span>30 spaces with different rules</span></li><li><time>11.12</time><b>Seoul</b><span>20 real Seoul courses</span></li><li><time>11.15</time><b>Singularity · History of Everything</b><span>The fastest difficulty · 125 eras</span></li><li><time>11.15</time><b>Toss mini-app review</b><span>Rated for all ages · out on Microsoft Store</span></li><li class="now"><time>Now</time><b>Day ${S('age.days')} since launch</b><span>${S('runs')} runs · ${S('players')} bears</span></li>`],
  ['.dl-end', '<h2>Which dream will you<br />run today?</h2><button class="dl-btn" data-dl-top>Start running</button>'],
  ['.dl-foot', '<span>🌙 Dream Runner · Jelly Games</span><span>Seoul map © OpenStreetMap contributors · MOLIT VWorld</span><span>Rated for all ages · rating no. MSFT-SG-261107-0045</span>'],
  // 팝업 안 게임 단추 (랜딩으로 옮겨 온 것)
  ['#mode-pick [data-m="speed"]', '⚡ Speed run'],
  ['#mode-pick [data-m="item"]', '🎁 Item battle'],
  ['#solo-btn', '🏃 Run solo'],
  ['#multi-btn', '👥 Run together <small>up to 12</small>'],
  ['#hg-btn', '🌉 Jelly Seoul Runner <small>Yeouido · Banpo · Hongdae · Itaewon · Namsan — stroll real maps</small>'],
  ['#code-in', '6-digit invite code', 'placeholder'],
  ['#code-btn', '🎟️ Join with code'],
  ['#cos-btn', '🎨 Customize'],
  ['#board-btn', '🏆 Leaderboard'],
  ['#stats-btn', '📊 My stats'],
  ['#pn-btn', '📜 Patch notes'],
  ['#time-notice', '<b>📢 Dream Runner news</b><span class="n-time">⏳ New map <em>History of Everything</em> — <em>125 eras</em> from the Big Bang to an AI future; keep running from the era where you fell</span><span class="n-diff">⚠️ Difficulty update — old Hard → <em>🙂 Normal</em> · old Extreme → <em>🔥 Hard</em> · new <em>💠 Singularity</em></span><small>Tap to try History of Everything ▶</small>'],
];
const PANE_AL = { dream: 'Choose Dreamland', hell: 'Choose Hell', void: 'Choose the Void', seoul: 'Choose Seoul', time: 'Choose History of Everything' };

// 랜딩을 영어로 (index.html 이 그려진 뒤, 랜딩 단추를 옮기기 전에 부른다)
export function applyLandingLang() {
  document.documentElement.lang = LANG;
  // 언어 단추: 위 막대 오른쪽 (지금 언어의 반대를 보여 준다)
  const nav = document.querySelector('.dl-bar nav');
  if (!EN) { addLangBtn(nav); return; }
  document.title = 'Dream Runner — run through endless dreams';
  for (const [sel, html, attr] of T) { const el = document.querySelector(`#dl ${sel}`) || document.querySelector(sel); if (!el) continue; if (attr) el.setAttribute(attr, html); else el.innerHTML = html; }
  for (const b of document.querySelectorAll('#dl .dl-play')) b.textContent = 'Play ▶';
  const rows = document.querySelectorAll('#dl .dl-start .dl-row > span'); if (rows[0]) rows[0].textContent = 'Mode'; if (rows[1]) rows[1].textContent = 'Difficulty';
  for (const b of document.querySelectorAll('#dl .dl-pane-hd')) b.setAttribute('aria-label', PANE_AL[b.dataset.map] || b.getAttribute('aria-label'));
  for (const b of document.querySelectorAll('#dl [data-dl-close].dl-x')) b.setAttribute('aria-label', 'Close');
  addLangBtn(document.querySelector('.dl-bar nav'));
}
function addLangBtn(nav) {
  if (!nav || nav.querySelector('.dl-lang')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'dl-lang'; b.textContent = EN ? '한국어' : 'EN'; b.title = EN ? '한국어로 보기' : 'View in English';
  b.onclick = () => setLang(EN ? 'ko' : 'en');
  nav.insertBefore(b, nav.querySelector('.dl-home'));
}
