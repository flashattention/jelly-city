// 캐릭터 외형 커스터마이징 옵션 (서버와 브라우저 공용)
// profile.look = { eyes, pupil, nose, mouth, antenna, wings, ears, tail, belly, cheek }
//   옵션은 뒤에만 덧붙인다 (저장된 번호가 바뀌지 않게)

export const LOOK_PARTS = {
  eyes: { label: '👀 눈', options: ['동글눈', '왕눈 반짝', '졸린 눈', '웃는 실눈', '별 눈', '고양이 눈', '속눈썹 눈', '점 눈', '하트 눈', '반짝 소녀눈', '윙크', '빙글빙글 눈', '네모 도트 눈'] },
  nose: { label: '👃 코', options: ['없음', '콩알 코', '딸기 코', '돼지 코', '뾰족 코', '하트 코', '별 코', '단추 코', '고양이 코'] },
  mouth: { label: '👄 입', options: ['스마일', '고양이 입', '토끼 이빨', '메롱', '무표정', '뾰족 송곳니', '활짝 웃음', '오리 입', '하트 입', '동그란 오 입', '이빨 웃음', '침 흘림'] },
  antenna: { label: '📡 더듬이', options: ['기본', '짧은 더듬이', '꼬불 더듬이', '하트 끝', '별 끝', '축 처진', '길쭉 더듬이', '방울 더듬이'] },
  wings: { label: '🪽 날개', options: ['기본 (날 때만)', '반짝 투명', '나비 날개', '천사 깃털', '박쥐 날개', '꼬마 날개', '무지개 날개', '접은 날개', '잠자리 날개', '용 날개', '구름 날개', '불꽃 날개'] },
  ears: { label: '🐻 귀', options: ['둥근 귀', '토끼 귀', '고양이 귀', '꼬마 귀', '늘어진 강아지 귀', '하트 귀', '왕 큰 귀', '유니콘 뿔'] },
  tail: { label: '🍭 꼬리', options: ['없음', '동글 꼬리', '하트 꼬리', '고양이 꼬리', '여우 꼬리', '번개 꼬리', '악마 꼬리', '별 꼬리'] },
};

export const LOOK_COLORS = {
  pupil: { label: '눈동자', options: ['#1d1410', '#3b5bdb', '#2f9e44', '#c2255c', '#7048e8', '#e8590c', '#0c8599', '#5c3d2e', '#ff6f91', '#ffb300', '#e0e0e0', '#00bfa5'] },
  belly: { label: '배 색깔', options: ['auto', '#fff3e0', '#ffe0ec', '#e3f2fd', '#e8f5e9', '#fff9c4', '#ede7f6', '#d7ccc8', '#ffccbc', '#b2ebf2', '#f8bbd0', '#c5e1a5'] },
  cheek: { label: '볼터치', options: ['#ff9fb2', '#ff7043', '#f48fb1', '#ce93d8', '#ffcc80', '#80deea', '#c5e1a5', '#ff5252', 'none'] },
};

export const SKIN_COLORS = ['#8a5634', '#6d4c41', '#a1887f', '#3e2723', '#c0794a', '#ff9fb2', '#7ec8a9', '#9fa8ff', '#ffd54f', '#90caf9', '#b39ddb', '#ef9a9a', '#80cbc4', '#bcaaa4', '#455a64', '#f5f5f5'];

export const DEFAULT_LOOK = { eyes: 0, pupil: '#1d1410', nose: 0, mouth: 0, antenna: 0, wings: 0, ears: 0, tail: 0, belly: 'auto', cheek: '#ff9fb2', hat: 0, face: 0, outfit: 0, extra: 0 };

// 옷 · 모자 꾸미기 (모든 게임에서 보인다 · 젤리시티에서 같은 자리 장비를 끼면 장비가 먼저)
//   [이름, 곰돌이 모양 이름(:색)] · 뒤에만 덧붙인다 (저장된 번호가 바뀌지 않게)
export const COSTUME = {
  hat: { label: '👒 모자', items: [['없음', ''], ['초록 캡', 'cap:#66bb6a'], ['빨간 캡', 'cap:#e53935'], ['파란 캡', 'cap:#42a5f5'], ['노랑 비니', 'beanie:#ffd54f'], ['분홍 비니', 'beanie:#f48fb1'], ['베레모', 'beret:#c62828'], ['카우보이', 'cowboy'], ['해적 모자', 'pirate'], ['마법사 모자', 'wizard'], ['왕관', 'crown'], ['꽃왕관', 'flowercrown'], ['고깔모자', 'partyhat'], ['실크햇', 'top'], ['졸업모', 'grad'], ['셰프 모자', 'chef'], ['토끼 귀', 'bunny'], ['고양이 귀', 'catears'], ['핑크 리본', 'bow:#ff7aa2'], ['하늘 리본', 'bow:#7cd8ff'], ['새싹', 'sprout'], ['천사 링', 'halo'], ['헤드폰', 'headphones'], ['민트 머리띠', 'headband:#7ec8a9'], ['데이지 꽃핀', 'flowerpin'], ['별 머리핀', 'starpin']] },
  face: { label: '👓 얼굴', items: [['없음', ''], ['뿔테 안경', 'glasses'], ['선글라스', 'sunglasses'], ['미니 선글라스', 'minishades'], ['하트 안경', 'heartglasses'], ['별 안경', 'starglasses'], ['금테 선글라스', 'goldshades'], ['고글', 'goggles'], ['외알 안경', 'monocle'], ['VR 고글', 'vr'], ['안대', 'eyepatch'], ['마스크', 'mask'], ['콧수염', 'stache'], ['주근깨', 'freckles'], ['매력점', 'mole'], ['반창고', 'bandaid'], ['하트 스티커', 'heartcheek'], ['빨간 코', 'clownnose']] },
  outfit: { label: '👕 옷', items: [['없음', ''], ['흰 티셔츠', 'tee:#fafafa'], ['분홍 티셔츠', 'tee:#f8bbd0'], ['검정 티셔츠', 'tee:#37474f'], ['파랑 줄무늬', 'stripes:#4a90e2'], ['빨강 줄무늬', 'stripes:#e53935'], ['멜빵바지', 'overalls:#5c7cfa'], ['분홍 후드티', 'hoodie:#f8bbd0'], ['회색 후드티', 'hoodie:#9e9e9e'], ['노랑 우비', 'raincoat'], ['축구 유니폼', 'jersey:#43a047'], ['파랑 유니폼', 'jersey:#1e88e5'], ['노랑 앞치마', 'apron:#ffd54f'], ['트렌치코트', 'coat:#a1887f'], ['가죽 재킷', 'leather'], ['턱시도', 'tuxedo'], ['분홍 드레스', 'dress:#f48fb1'], ['하늘 드레스', 'dress:#90caf9'], ['공주 드레스', 'princess'], ['한복', 'hanbok'], ['아이돌 의상', 'idol'], ['황금 정장', 'goldsuit'], ['도복', 'dobok'], ['마법사 로브', 'robe']] },
  extra: { label: '🎀 소품', items: [['없음', ''], ['빨간 망토', 'cape:#e53935'], ['보라 망토', 'cape:#7e57c2'], ['파란 넥타이', 'tie:#1e88e5'], ['나비넥타이', 'bowtie'], ['민트 스카프', 'scarf:#7ec8a9'], ['빨간 목도리', 'scarf:#e53935'], ['책가방', 'backpack:#ef5350'], ['크로스백', 'bag'], ['하트 목걸이', 'locket'], ['진주 목걸이', 'pearls'], ['방울 목걸이', 'bell'], ['목걸이 카메라', 'camera'], ['손목시계', 'watch'], ['구슬 팔찌', 'bracelet'], ['풍선', 'balloon'], ['천사 날개', 'wings']] },
};
// 모양 이름 → 자리 (같은 자리 장비가 있으면 꾸미기는 숨긴다)
const SLOT_KINDS = { hat: ['chef', 'police', 'fire', 'hard', 'nurse', 'helm_leather', 'helm_iron', 'helm_general', 'kevlar_helmet', 'storm_helmet'], face: [], outfit: ['vest', 'robe', 'jedi_robe', 'mando_armor', 'armor_leather', 'armor_iron', 'armor_legend', 'vest_kevlar'], extra: [] };
for (const [k, C] of Object.entries(COSTUME)) for (const [, spec] of C.items) if (spec) SLOT_KINDS[k].push(spec.split(':')[0]);
export function slotOfSpec(spec) { const kind = String(spec).split(':')[0]; for (const [k, list] of Object.entries(SLOT_KINDS)) if (list.includes(kind)) return k; return null; }
export const costumeOf = (look = {}) => Object.entries(COSTUME).map(([k, C]) => C.items[look?.[k] | 0]?.[1]).filter(Boolean);

export function sanitizeLook(l = {}) {
  const out = { ...DEFAULT_LOOK };
  if (!l || typeof l !== 'object') return out;
  for (const [k, part] of Object.entries(LOOK_PARTS)) {
    const v = Number(l[k]);
    if (Number.isInteger(v) && v >= 0 && v < part.options.length) out[k] = v;
  }
  for (const [k, part] of Object.entries(LOOK_COLORS)) if (part.options.includes(l[k])) out[k] = l[k];
  for (const [k, C] of Object.entries(COSTUME)) { const v = Number(l[k]); if (Number.isInteger(v) && v >= 0 && v < C.items.length) out[k] = v; }
  return out;
}

// 처음 만들 때 고를 수 있는 기본 악세서리 (부위별 10종, 무료)
export const BASIC_ACC = {
  head: [
    ['b_sprout', '새싹 머리', '🌱', 'sprout'],
    ['b_ribbon', '핑크 리본', '🎀', 'bow:#ff7aa2'],
    ['b_cap', '초록 캡모자', '🧢', 'cap:#66bb6a'],
    ['b_beanie', '노랑 비니', '🧶', 'beanie:#ffd54f'],
    ['b_headband', '민트 머리띠', '💚', 'headband:#7ec8a9'],
    ['b_bunny', '토끼 귀', '🐰', 'bunny'],
    ['b_flowerpin', '데이지 꽃핀', '🌼', 'flowerpin'],
    ['b_starpin', '별 머리핀', '⭐', 'starpin'],
    ['b_partyhat', '고깔모자', '🥳', 'partyhat'],
    ['b_halo', '천사 링', '😇', 'halo'],
  ],
  face: [
    ['b_glasses', '뿔테 안경', '👓', 'glasses'],
    ['b_bandaid', '반창고', '🩹', 'bandaid'],
    ['b_mask', '하얀 마스크', '😷', 'mask'],
    ['b_stache', '콧수염', '🥸', 'stache'],
    ['b_mole', '매력점', '⚫', 'mole'],
    ['b_freckles', '주근깨', '🟤', 'freckles'],
    ['b_eyepatch', '안대', '🏴‍☠️', 'eyepatch'],
    ['b_heartcheek', '하트 스티커', '💗', 'heartcheek'],
    ['b_minishades', '미니 선글라스', '🕶️', 'minishades'],
    ['b_clownnose', '빨간 코', '🔴', 'clownnose'],
  ],
  body: [
    ['b_tee', '흰 티셔츠', '👕', 'tee:#fafafa'],
    ['b_stripes', '줄무늬 티', '🦓', 'stripes:#4a90e2'],
    ['b_overalls', '멜빵바지', '👖', 'overalls:#5c7cfa'],
    ['b_cape', '빨간 망토', '🦸', 'cape:#e53935'],
    ['b_apron', '노랑 앞치마', '🍳', 'apron:#ffd54f'],
    ['b_knitvest', '니트 조끼', '🧶', 'tee:#a1887f'],
    ['b_hoodie', '분홍 후드티', '🩷', 'hoodie:#f8bbd0'],
    ['b_tie', '파란 넥타이', '👔', 'tie:#1e88e5'],
    ['b_raincoat', '노란 우비', '🧥', 'raincoat'],
    ['b_jersey', '축구 유니폼', '⚽', 'jersey:#43a047'],
  ],
  acc: [
    ['b_backpack', '책가방', '🎒', 'backpack:#ef5350'],
    ['b_bag', '크로스백', '👜', 'bag'],
    ['b_watch', '손목시계', '⌚', 'watch'],
    ['b_bracelet', '구슬 팔찌', '📿', 'bracelet'],
    ['b_balloon', '풍선', '🎈', 'balloon'],
    ['b_locket', '하트 목걸이', '💝', 'locket'],
    ['b_bell', '방울 목걸이', '🔔', 'bell'],
    ['b_camera', '목걸이 카메라', '📷', 'camera'],
    ['b_scarf', '민트 스카프', '🧣', 'scarf:#7ec8a9'],
    ['b_brooch', '꽃 브로치', '🌸', 'brooch'],
  ],
};

export const BASIC_ITEMS = {};
for (const [slot, list] of Object.entries(BASIC_ACC)) {
  for (const [id, name, emoji, vis] of list) BASIC_ITEMS[id] = { name, emoji, cat: slot, slot, price: 0, charm: 1, vis, basic: true };
}
