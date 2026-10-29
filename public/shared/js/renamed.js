// 이름이 바뀐 게임: 이 기기에 저장된 값(캐릭터 · 닉네임 · 설정 · 소리)을 새 이름으로 옮긴다
//   게임 main.js 의 맨 첫 import 로 불러서, 다른 모듈이 값을 읽기 전에 옮겨 둔다 (옛 값은 지우지 않고 복사만)
const MOVES = [['jellybg', 'jellydrop'], ['jellywatch', 'jellyguard'], ['jellyrider', 'jellydrift'], ['jellyattack', 'jellytactical'], ['jellyguys', 'jellyrumble'], ['jellybang', 'jellycourt'], ['jellyapple', 'jellyten']];
try {
  if (!localStorage.getItem('jelly.renamed1')) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i); if (!k) continue;
      for (const [o, n] of MOVES) if (k.startsWith(o + '.')) { const nk = n + k.slice(o.length); if (localStorage.getItem(nk) == null) localStorage.setItem(nk, localStorage.getItem(k)); }
    }
    localStorage.setItem('jelly.renamed1', '1');
  }
} catch { /* 저장소를 못 쓰면 그냥 넘어간다 */ }
