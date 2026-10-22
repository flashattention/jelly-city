// 젤리시티의 모든 데이터: 건물, 직업, 성격, 이름, 행동

// size: S(1/4 블록), M(1/2 블록), B(블록 전체)
export const BUILDING_TYPES = {
  house:        { name: '주택', emoji: '🏠', cat: 'home', names: ['{s}씨네 집'] },
  villa:        { name: '빌라', emoji: '🏘️', cat: 'home', names: ['햇살 빌라', '포근 빌라', '곰돌이 하우스', '이슬 빌라', '초록 빌라', '모서리 빌라', '꿀잠 빌라', '말랑 빌라', '몽글 빌라', '솜사탕 빌라'] },
  apartment:    { name: '아파트', emoji: '🏢', cat: 'home', names: ['곰돌이 아파트', '몽글 맨션', '촉촉 젤리 빌라', '호수뷰 하이츠', '달빛 래미안', '젤리 팰리스', '포근 둥지 아파트', '사탕 타워', '말랑말랑 빌'] },
  hospital:     { name: '종합병원', emoji: '🏥', cat: 'health', names: ['젤리 종합병원'] },
  pharmacy:     { name: '약국', emoji: '💊', cat: 'health', names: ['튼튼 약국'] },
  vet:          { name: '동물병원', emoji: '🐾', cat: 'health', names: ['쓰담쓰담 동물병원'] },
  dental:       { name: '치과', emoji: '🦷', cat: 'health', names: ['반짝 이빨 치과'] },
  school:       { name: '초등학교', emoji: '🏫', cat: 'edu', names: ['젤리 초등학교'] },
  kindergarten: { name: '유치원', emoji: '🧸', cat: 'edu', names: ['꼬물꼬물 유치원'] },
  university:   { name: '대학교', emoji: '🎓', cat: 'edu', names: ['젤리 국립대학교'] },
  police:       { name: '경찰서', emoji: '🚓', cat: 'public', names: ['젤리시티 경찰서'] },
  fire:         { name: '소방서', emoji: '🚒', cat: 'public', names: ['젤리시티 소방서'] },
  court:        { name: '법원', emoji: '⚖️', cat: 'public', names: ['젤리 지방법원'] },
  cityhall:     { name: '시청', emoji: '🏛️', cat: 'public', names: ['젤리시티 시청'] },
  postoffice:   { name: '우체국', emoji: '📮', cat: 'public', names: ['젤리 우체국'] },
  restaurant:   { name: '한식당', emoji: '🍚', cat: 'food', names: ['말랑 식당', '엄마손 백반', '설탕 한 톨 한식'] },
  pizza:        { name: '피자집', emoji: '🍕', cat: 'food', names: ['젤리 피자', '곰돌이 피자', '치즈폭탄 피자', '화덕 곰돌이'] },
  chicken:      { name: '치킨집', emoji: '🍗', cat: 'food', names: ['바삭 치킨', '두마리 통닭', '양념 듬뿍 치킨', '꼬꼬 치킨'] },
  chinese:      { name: '중국집', emoji: '🥡', cat: 'food', names: ['홍콩반점 젤리점', '만리장성', '용궁 반점'] },
  gukbap:       { name: '국밥집', emoji: '🍲', cat: 'food', names: ['할매 국밥', '뜨끈 국밥', '부산 돼지국밥', '24시 해장국'] },
  burger:       { name: '버거집', emoji: '🍔', cat: 'food', names: ['젤리 버거', '더블말랑 버거', '감튀 하우스'] },
  bunsik:       { name: '분식집', emoji: '🍢', cat: 'food', names: ['떡볶이 천국', '김밥 나라', '학교 앞 분식'] },
  cafe:         { name: '카페', emoji: '☕', cat: 'food', names: ['곰돌이 커피', '카페 말랑', '몽글 로스터리', '밤샘 카페'] },
  bakery:       { name: '빵집', emoji: '🥐', cat: 'food', names: ['빵가루 베이커리', '크럼블 하우스'] },
  supermarket:  { name: '슈퍼마켓', emoji: '🛒', cat: 'shop', names: ['젤리마트'] },
  convenience:  { name: '편의점', emoji: '🏪', cat: 'shop', names: ['24 젤리편의점', '밤새 편의점', '구석 편의점', 'CU젤리', 'GS말랑', '세븐젤리'] },
  bank:         { name: '은행', emoji: '🏦', cat: 'biz', names: ['젤리 중앙은행'] },
  office:       { name: '오피스', emoji: '💼', cat: 'biz', names: ['젤리테크 타워', '곰돌이 파이낸스', '말랑 컴퍼니', '육각 소프트'] },
  tvstation:    { name: '방송국', emoji: '📺', cat: 'biz', names: ['JBC 방송국'] },
  library:      { name: '도서관', emoji: '📚', cat: 'culture', names: ['젤리 시립도서관'] },
  bookstore:    { name: '서점', emoji: '📖', cat: 'shop', names: ['책갈피 서점'] },
  museum:       { name: '박물관', emoji: '🦕', cat: 'culture', names: ['젤리 1억년 역사박물관'] },
  gallery:      { name: '미술관', emoji: '🎨', cat: 'culture', names: ['곰돌이 갤러리'] },
  gym:          { name: '헬스장', emoji: '🏋️', cat: 'leisure', names: ['육각근육 짐'] },
  salon:        { name: '미용실', emoji: '💇', cat: 'shop', names: ['몽글 살롱', '반짝 헤어'] },
  clothing:     { name: '옷가게', emoji: '👕', cat: 'shop', names: ['말랑 패션'] },
  hotel:        { name: '호텔', emoji: '🏨', cat: 'biz', names: ['그랜드 젤리 호텔'] },
  cinema:       { name: '영화관', emoji: '🎬', cat: 'leisure', names: ['젤리 시네마'] },
  concerthall:  { name: '공연장', emoji: '🎵', cat: 'leisure', names: ['말랑 아트홀'] },
  factory:      { name: '공장', emoji: '🏭', cat: 'industry', names: ['바삭 과자 공장'] },
  construction: { name: '공사장', emoji: '🚧', cat: 'industry', names: ['젤리 타워 신축 현장'] },
  garage:       { name: '주유소·정비소', emoji: '⛽', cat: 'industry', names: ['젤리 모터스'] },
  flowershop:   { name: '꽃집', emoji: '💐', cat: 'shop', names: ['꽃잎 한 장', '향기 꽃집'] },
  realestate:   { name: '부동산', emoji: '🏘️', cat: 'biz', names: ['몽글 부동산', '전원 부동산', '행복 공인중개사'] },
  lab:          { name: '연구소', emoji: '🔬', cat: 'biz', names: ['젤리 과학연구소'] },
  park:         { name: '공원', emoji: '🌳', cat: 'leisure', names: ['도토리 공원', '이슬방울 공원'] },
  armory_3k:    { name: '삼국지 병기점', emoji: '⚔️', cat: 'shop', names: ['관우네 병기점'] },
  armory_mil:   { name: '밀리터리 샵', emoji: '🎖️', cat: 'shop', names: ['젤리 택티컬'] },
  armory_sf:    { name: '미래 무기상', emoji: '🌌', cat: 'shop', names: ['은하 무기상'] },
  jeweler:      { name: '보석상', emoji: '💎', cat: 'shop', names: ['반짝 보석상'] },
  hatshop:      { name: '모자 가게', emoji: '🎩', cat: 'shop', names: ['곰돌이 캡'] },
  eyewear:      { name: '안경원', emoji: '🕶️', cat: 'shop', names: ['눈부심 안경원'] },
  club:         { name: '클럽', emoji: '🪩', cat: 'leisure', names: ['클럽 젤리락'] },
  dojang:       { name: '무릉도장', emoji: '🥋', cat: 'culture', names: ['무릉도장'] },
  fishing:      { name: '낚시용품점', emoji: '🎣', cat: 'shop', names: ['대박 낚시용품점'] },
  seafood:      { name: '매운탕·횟집', emoji: '🍲', cat: 'food', names: ['바다향 매운탕·횟집', '자갈치 매운탕'] },
  prison:       { name: '교도소', emoji: '🔒', cat: 'public', names: ['젤리 교도소'] },
  hunter:       { name: '사냥꾼 오두막', emoji: '🏹', cat: 'shop', names: ['사냥꾼 오두막'] },
  ranch:        { name: '목장 직판장', emoji: '🐄', cat: 'food', names: ['젤리 목장 직판장'] },
  range:        { name: '사격 연습장', emoji: '🎯', cat: 'leisure', names: ['명중 사격장'] },
  magicshop:    { name: '마법봉 공방', emoji: '🪄', cat: 'shop', names: ['반짝 마법봉 공방'] },
  dealer:       { name: '자동차 쇼룸', emoji: '🏎️', cat: 'shop', names: ['젤리 모터스 쇼룸'] },
};

export const CATEGORY_COLORS = {
  home: '#f6c28b', health: '#ff8fa3', edu: '#ffd56b', public: '#7fb7ff', food: '#ff9f6b', shop: '#c99bff',
  biz: '#8fd3c8', culture: '#d8b4fe', leisure: '#7ee08a', industry: '#b0a191',
};

// 각 행은 북→남, 각 칸은 서→동 (8x8: 바깥 테두리는 교외 주택단지)
// "M:a|S:b,c" = 북쪽 절반 a, 남쪽 두 칸 b,c / "S:a,b,c,d" = NW,NE,SW,SE / "B:x" = 블록 전체
const HB = 'S:house,house,house,house';
const VB = 'S:villa,villa,villa,villa';
const AB = 'M:apartment|M:apartment';
export const CITY_PLAN = [
  [HB, 'S:villa,villa,house,house', AB, HB, 'S:convenience,chicken,villa,villa', HB, 'M:apartment|S:villa,villa', HB],
  ['S:house,house,magicshop,pizza', 'S:house,pizza,house,house', 'M:apartment|S:house,flowershop', 'B:school', 'B:university', 'M:apartment|S:chicken,house', 'S:house,gukbap,vet,house', VB],
  [VB, 'M:kindergarten|S:house,convenience', 'S:cafe,bakery,restaurant,pharmacy', 'M:library|M:postoffice', 'M:bank|M:office', 'S:salon,clothing,cafe,bookstore', 'M:gym|S:convenience,house', 'S:house,house,chinese,realestate'],
  [AB, 'B:hospital', 'M:police|M:fire', 'B:cityhall', 'M:office|M:tvstation', 'M:hotel|M:cinema', 'S:chinese,realestate,dental,convenience', HB],
  ['S:gukbap,convenience,house,house', 'M:apartment|S:burger,house', 'M:supermarket|S:cafe,gallery', 'M:court|M:office', 'B:museum', 'M:concerthall|S:pizza,bakery', 'M:apartment|M:apartment', AB],
  [HB, 'S:hatshop,eyewear,chicken,convenience', 'B:park', 'M:lab|S:cafe,convenience', 'M:apartment|S:chinese,salon', 'B:construction', 'M:garage|S:bunsik,house', 'S:villa,villa,burger,convenience'],
  ['S:villa,villa,realestate,range', 'S:armory_3k,armory_mil,armory_sf,jeweler', 'M:apartment|S:house,burger', 'M:apartment|S:convenience,flowershop', 'B:factory', 'M:club|S:pizza,house', 'B:dojang', VB],
  [HB, AB, 'S:house,house,dealer,pizza', VB, HB, 'S:villa,villa,convenience,seafood', HB, 'M:apartment|S:house,house'],
];
export const isSuburbBlock = (r, c) => r === 0 || c === 0 || r === CITY_PLAN.length - 1 || c === CITY_PLAN.length - 1;
export const HOME_TYPES = ['house', 'villa', 'apartment'];

// 직업: building = 근무지 타입, wage = 시급(₩), hours = 기본 근무시간, acc = 의상
// mobile: 근무 중 거리를 돌아다님 / night: 야간근무 확률
export const JOBS = [
  { id: 'doctor', name: '의사', building: 'hospital', wage: 45, hours: [9, 18], acc: ['coat:#ffffff', 'mirror', 'stethoscope'], duty: '환자를 진료한다' },
  { id: 'surgeon', name: '외과의사', building: 'hospital', wage: 52, hours: [8, 17], acc: ['coat:#7fd1c7', 'cap:#7fd1c7'], duty: '수술을 집도한다' },
  { id: 'nurse', name: '간호사', building: 'hospital', wage: 28, hours: [7, 16], night: 0.4, acc: ['nurse', 'coat:#ffe1ea'], duty: '환자를 돌본다' },
  { id: 'pharmacist', name: '약사', building: 'pharmacy', wage: 35, hours: [9, 19], acc: ['coat:#ffffff', 'glasses'], duty: '약을 조제한다' },
  { id: 'vet', name: '수의사', building: 'vet', wage: 36, hours: [9, 18], acc: ['coat:#cdeccf', 'stethoscope'], duty: '아픈 반려동물을 치료한다' },
  { id: 'dentist', name: '치과의사', building: 'dental', wage: 42, hours: [9, 18], acc: ['coat:#ffffff', 'mirror'], duty: '이빨 건강을 지킨다' },
  { id: 'teacher', name: '교사', building: 'school', wage: 28, hours: [8, 16], acc: ['glasses', 'tie:#5a7bd8'], duty: '아이들을 가르친다' },
  { id: 'principal', name: '교장', building: 'school', wage: 38, hours: [8, 17], acc: ['glasses', 'tie:#8b2d2d'], duty: '학교를 운영한다' },
  { id: 'lunch_cook', name: '급식 조리사', building: 'school', wage: 18, hours: [7, 14], acc: ['chef', 'apron:#ffffff'], duty: '급식을 만든다' },
  { id: 'kinder_teacher', name: '유치원 교사', building: 'kindergarten', wage: 22, hours: [8, 16], acc: ['apron:#ffb3c7'], duty: '꼬마 젤리들을 돌본다' },
  { id: 'professor', name: '교수', building: 'university', wage: 40, hours: [10, 18], acc: ['glasses', 'tie:#6b4a2b'], duty: '강의와 연구를 한다' },
  { id: 'researcher', name: '대학 연구원', building: 'university', wage: 30, hours: [9, 20], acc: ['coat:#ffffff', 'glasses'], duty: '논문을 쓴다' },
  { id: 'scientist', name: '과학자', building: 'lab', wage: 40, hours: [9, 19], acc: ['coat:#ffffff', 'glasses'], duty: '젤리 탄성 연구를 한다' },
  { id: 'police', name: '경찰관', building: 'police', wage: 28, hours: [8, 17], night: 0.35, mobile: 0.6, acc: ['police'], duty: '도시의 치안을 지킨다' },
  { id: 'detective', name: '형사', building: 'police', wage: 34, hours: [10, 20], mobile: 0.3, acc: ['beret:#6b5a4a', 'tie:#333333'], duty: '사건을 수사한다' },
  { id: 'firefighter', name: '소방관', building: 'fire', wage: 30, hours: [8, 18], night: 0.3, acc: ['fire'], duty: '불을 끄고 시민을 구한다' },
  { id: 'judge', name: '판사', building: 'court', wage: 50, hours: [9, 17], acc: ['robe', 'glasses'], duty: '재판을 한다' },
  { id: 'lawyer', name: '변호사', building: 'court', wage: 45, hours: [9, 19], acc: ['tie:#1d2b53', 'glasses'], duty: '의뢰인을 변호한다' },
  { id: 'mayor', name: '시장', building: 'cityhall', wage: 60, hours: [9, 18], max: 1, acc: ['top', 'sash'], duty: '젤리시티를 이끈다' },
  { id: 'civil_servant', name: '공무원', building: 'cityhall', wage: 25, hours: [9, 18], acc: ['tie:#2f6f4f'], duty: '시민 민원을 처리한다' },
  { id: 'street_cleaner', name: '환경미화원', building: 'cityhall', wage: 18, hours: [5, 13], mobile: 0.9, acc: ['vest', 'cap:#ff8a3d'], duty: '거리를 깨끗하게 청소한다' },
  { id: 'mail_carrier', name: '우체부', building: 'postoffice', wage: 20, hours: [8, 16], mobile: 0.8, acc: ['cap:#e2483d', 'bag'], duty: '편지와 택배를 배달한다' },
  { id: 'postal_clerk', name: '우체국 직원', building: 'postoffice', wage: 20, hours: [9, 18], acc: ['tie:#e2483d'], duty: '우편 접수를 받는다' },
  { id: 'chef', name: '셰프', building: 'restaurant', wage: 30, hours: [10, 21], acc: ['chef', 'apron:#ffffff'], duty: '맛있는 요리를 만든다' },
  { id: 'waiter', name: '웨이터', building: 'restaurant', wage: 15, hours: [11, 21], acc: ['bowtie', 'apron:#333333'], duty: '손님을 맞이하고 서빙한다' },
  { id: 'delivery', name: '배달원', building: 'restaurant', wage: 16, hours: [11, 22], mobile: 0.85, acc: ['cap:#3dbf6e', 'backpack:#3dbf6e'], duty: '음식을 배달한다' },
  { id: 'pizza_chef', name: '피자 셰프', building: 'pizza', wage: 22, hours: [11, 22], acc: ['chef', 'apron:#d32f2f'], duty: '화덕에 피자를 굽는다' },
  { id: 'chicken_cook', name: '치킨집 사장', building: 'chicken', wage: 24, hours: [14, 24], acc: ['cap:#ffb300', 'apron:#ffb300'], duty: '치킨을 바삭하게 튀긴다' },
  { id: 'chinese_chef', name: '중식 요리사', building: 'chinese', wage: 24, hours: [10, 21], acc: ['chef', 'apron:#ffffff'], duty: '웍을 돌려 짜장면을 볶는다' },
  { id: 'gukbap_owner', name: '국밥집 주인', building: 'gukbap', wage: 22, hours: [6, 20], acc: ['headband:#ffffff', 'apron:#8d6e63'], duty: '밤새 육수를 끓인다' },
  { id: 'burger_crew', name: '버거 크루', building: 'burger', wage: 13, hours: [10, 20], acc: ['cap:#e53935', 'apron:#ffd54f'], duty: '버거를 만든다' },
  { id: 'bunsik_owner', name: '분식집 이모', building: 'bunsik', wage: 18, hours: [9, 20], acc: ['apron:#f48fb1'], duty: '떡볶이를 휘휘 젓는다' },
  { id: 'barista', name: '바리스타', building: 'cafe', wage: 15, hours: [6, 15], acc: ['apron:#5b3a29', 'beret:#5b3a29'], duty: '커피를 내린다' },
  { id: 'baker', name: '제빵사', building: 'bakery', wage: 18, hours: [5, 14], acc: ['chef', 'apron:#ffe0a8'], duty: '새벽부터 빵을 굽는다' },
  { id: 'cashier', name: '계산원', building: 'supermarket', wage: 14, hours: [9, 18], acc: ['apron:#4caf50'], duty: '계산대를 지킨다' },
  { id: 'store_manager', name: '마트 점장', building: 'supermarket', wage: 25, hours: [8, 19], acc: ['tie:#4caf50'], duty: '마트를 관리한다' },
  { id: 'conv_clerk', name: '편의점 알바생', building: 'convenience', wage: 12, hours: [14, 22], night: 0.5, acc: ['cap:#1e88e5'], duty: '편의점을 지킨다' },
  { id: 'banker', name: '은행원', building: 'bank', wage: 30, hours: [9, 16], acc: ['tie:#c9a227'], duty: '예금과 대출 업무를 한다' },
  { id: 'fund_manager', name: '펀드매니저', building: 'bank', wage: 55, hours: [7, 19], acc: ['tie:#111111', 'sunglasses'], duty: '설탕 선물(先物)에 투자한다' },
  { id: 'programmer', name: '프로그래머', building: 'office', wage: 40, hours: [10, 20], acc: ['headphones', 'glasses'], duty: '버그(동족 아님)를 잡는다' },
  { id: 'designer', name: '디자이너', building: 'office', wage: 30, hours: [10, 19], acc: ['beret:#ff6fa8'], duty: '예쁜 것을 만든다' },
  { id: 'accountant', name: '회계사', building: 'office', wage: 35, hours: [9, 18], acc: ['glasses', 'tie:#555555'], duty: '숫자를 맞춘다' },
  { id: 'marketer', name: '마케터', building: 'office', wage: 30, hours: [9, 19], acc: ['tie:#ff7043'], duty: '광고를 기획한다' },
  { id: 'ceo', name: 'CEO', building: 'office', wage: 80, hours: [8, 20], acc: ['top', 'tie:#b71c1c'], duty: '회사를 경영한다' },
  { id: 'office_worker', name: '회사원', building: 'office', wage: 25, hours: [9, 18], acc: ['tie:#3f51b5'], duty: '보고서를 쓴다' },
  { id: 'reporter', name: '기자', building: 'tvstation', wage: 28, hours: [8, 19], mobile: 0.5, acc: ['cap:#795548', 'bag'], duty: '도시 소식을 취재한다' },
  { id: 'anchor', name: '아나운서', building: 'tvstation', wage: 38, hours: [16, 23], acc: ['tie:#d81b60'], duty: '저녁 뉴스를 진행한다' },
  { id: 'producer', name: 'PD', building: 'tvstation', wage: 32, hours: [10, 22], acc: ['headphones', 'cap:#212121'], duty: '예능 프로그램을 만든다' },
  { id: 'youtuber', name: '유튜버', building: 'tvstation', wage: 20, hours: [13, 22], mobile: 0.5, acc: ['headphones', 'sunglasses'], duty: '젤리 브이로그를 찍는다' },
  { id: 'librarian', name: '사서', building: 'library', wage: 20, hours: [9, 18], acc: ['glasses', 'scarf:#8d6e63'], duty: '책을 정리하고 추천한다' },
  { id: 'bookseller', name: '서점 주인', building: 'bookstore', wage: 18, hours: [10, 20], acc: ['glasses', 'apron:#6d4c41'], duty: '책을 판다' },
  { id: 'curator', name: '큐레이터', building: 'museum', wage: 28, hours: [9, 18], acc: ['scarf:#7e57c2', 'glasses'], duty: '젤리 1억년 역사를 소개한다' },
  { id: 'painter', name: '화가', building: 'gallery', wage: 15, hours: [11, 19], acc: ['beret:#e53935', 'apron:#90caf9'], duty: '그림을 그린다' },
  { id: 'trainer', name: '헬스 트레이너', building: 'gym', wage: 20, hours: [6, 15], acc: ['headband:#ff1744'], duty: '회원의 다리 근육을 키운다' },
  { id: 'hairdresser', name: '미용사', building: 'salon', wage: 18, hours: [10, 20], acc: ['apron:#f48fb1'], duty: '머리를 손질한다' },
  { id: 'fashion_designer', name: '패션 디자이너', building: 'clothing', wage: 30, hours: [10, 19], acc: ['sunglasses', 'scarf:#ff4081'], duty: '말랑한 젤리 옷을 디자인한다' },
  { id: 'shop_clerk', name: '옷가게 점원', building: 'clothing', wage: 14, hours: [11, 21], acc: ['scarf:#ab47bc'], duty: '손님 옷을 골라준다' },
  { id: 'hotelier', name: '호텔리어', building: 'hotel', wage: 22, hours: [7, 16], night: 0.3, acc: ['bowtie', 'cap:#8e1d2c'], duty: '투숙객을 응대한다' },
  { id: 'housekeeper', name: '객실 청소원', building: 'hotel', wage: 14, hours: [8, 16], acc: ['apron:#90a4ae'], duty: '객실을 반짝반짝 청소한다' },
  { id: 'cinema_staff', name: '영화관 직원', building: 'cinema', wage: 13, hours: [13, 23], acc: ['cap:#d32f2f', 'bowtie'], duty: '팝콘을 튀긴다' },
  { id: 'actor', name: '배우', building: 'cinema', wage: 35, hours: [11, 19], mobile: 0.3, acc: ['sunglasses', 'scarf:#ffd54f'], duty: '영화를 찍는다' },
  { id: 'singer', name: '가수', building: 'concerthall', wage: 30, hours: [14, 23], acc: ['headphones', 'sunglasses'], duty: '노래를 부른다' },
  { id: 'musician', name: '음악가', building: 'concerthall', wage: 22, hours: [13, 22], acc: ['bowtie', 'beret:#263238'], duty: '바이올린을 켠다' },
  { id: 'factory_worker', name: '공장 노동자', building: 'factory', wage: 20, hours: [7, 16], night: 0.25, acc: ['hard', 'vest'], duty: '과자를 생산한다' },
  { id: 'engineer', name: '엔지니어', building: 'factory', wage: 38, hours: [8, 17], acc: ['hard', 'glasses'], duty: '기계를 설계하고 고친다' },
  { id: 'construction_worker', name: '건설 노동자', building: 'construction', wage: 22, hours: [7, 16], acc: ['hard', 'vest'], duty: '건물을 짓는다' },
  { id: 'architect', name: '건축가', building: 'construction', wage: 40, hours: [9, 18], acc: ['hard', 'glasses'], duty: '건물을 설계한다' },
  { id: 'mechanic', name: '정비사', building: 'garage', wage: 22, hours: [8, 18], acc: ['cap:#1565c0', 'apron:#1565c0'], duty: '자동차를 고친다' },
  { id: 'taxi_driver', name: '택시기사', building: 'garage', wage: 18, hours: [6, 18], night: 0.3, acc: ['cap:#fbc02d'], duty: '손님을 태우고 도시를 누빈다' },
  { id: 'florist', name: '플로리스트', building: 'flowershop', wage: 16, hours: [9, 19], acc: ['apron:#81c784', 'bow:#ff80ab'], duty: '꽃다발을 만든다' },
  { id: 'range_coach', name: '사격 교관', building: 'range', wage: 26, hours: [10, 20], acc: ['cap:#33691e', 'vest_kevlar'], duty: '사격 자세를 가르친다' },
  { id: 'wizard', name: '마법봉 장인', building: 'magicshop', wage: 30, hours: [11, 21], acc: ['wizard', 'robe'], duty: '마법봉에 마력을 불어넣는다' },
  { id: 'car_dealer', name: '자동차 딜러', building: 'dealer', wage: 34, hours: [10, 20], acc: ['tie:#d32f2f', 'sunglasses'], duty: '스포츠카를 판다' },
  { id: 'realtor', name: '공인중개사', building: 'realestate', wage: 30, hours: [9, 19], acc: ['tie:#00897b'], duty: '아늑한 집을 소개한다' },
  { id: 'blacksmith', name: '대장장이', building: 'armory_3k', wage: 28, hours: [9, 19], acc: ['apron:#5d4037', 'headband:#c62828'], duty: '삼국지 명검을 벼린다' },
  { id: 'arms_dealer', name: '무기상', building: 'armory_mil', wage: 32, hours: [10, 20], acc: ['vest', 'sunglasses'], duty: '군용 장비와 전차를 판다' },
  { id: 'scifi_dealer', name: '은하 무기상', building: 'armory_sf', wage: 34, hours: [11, 21], acc: ['coat:#cfd8dc', 'goggles'], duty: '광선검과 블래스터를 판다' },
  { id: 'jewel_crafter', name: '보석 세공사', building: 'jeweler', wage: 30, hours: [10, 19], acc: ['monocle', 'tie:#7b1fa2'], duty: '보석을 세공하고 무기에 박아준다' },
  { id: 'hatter', name: '모자 장인', building: 'hatshop', wage: 20, hours: [10, 20], acc: ['top'], duty: '세상에 하나뿐인 모자를 만든다' },
  { id: 'optician', name: '안경사', building: 'eyewear', wage: 24, hours: [9, 19], acc: ['glasses', 'coat:#ffffff'], duty: '안경과 선글라스를 맞춰준다' },
  { id: 'dj', name: '클럽 DJ', building: 'club', wage: 30, hours: [20, 4], acc: ['headphones', 'sunglasses'], duty: '밤새 음악을 튼다' },
  { id: 'bartender', name: '바텐더', building: 'club', wage: 20, hours: [20, 3], acc: ['bowtie', 'tuxedo'], duty: '칵테일을 만든다' },
  { id: 'master', name: '무릉도장 사범', building: 'dojang', wage: 30, hours: [7, 19], acc: ['dobok', 'headband:#212121'], duty: '수련생에게 무공을 가르친다' },
  { id: 'trainee', name: '도장 조교', building: 'dojang', wage: 16, hours: [8, 18], acc: ['dobok'], duty: '점프맵을 정비한다' },
  { id: 'gardener', name: '정원사', building: 'park', wage: 15, hours: [7, 16], acc: ['cap:#558b2f', 'apron:#8bc34a'], duty: '공원을 가꾼다' },
];

// 특수 상태 (직장이 아니거나 학생)
export const SPECIAL_JOBS = {
  kindergartener: { id: 'kindergartener', name: '유치원생', building: 'kindergarten', wage: 0, hours: [9, 14], acc: ['cap:#ffeb3b', 'backpack:#ffeb3b'], duty: '유치원에 다닌다' },
  student: { id: 'student', name: '초등학생', building: 'school', wage: 0, hours: [8, 15], acc: ['backpack:#42a5f5'], duty: '학교에 다닌다' },
  univ_student: { id: 'univ_student', name: '대학생', building: 'university', wage: 0, hours: [10, 17], acc: ['backpack:#7e57c2'], duty: '대학에서 공부한다' },
  retired: { id: 'retired', name: '은퇴자', building: null, wage: 0, hours: null, acc: ['glasses', 'cane'], duty: '여유로운 노후를 보낸다' },
  homemaker: { id: 'homemaker', name: '전업 살림꾼', building: null, wage: 0, hours: null, acc: ['apron:#ffab91'], duty: '집안 살림을 책임진다' },
  jobseeker: { id: 'jobseeker', name: '취업준비생', building: null, wage: 0, hours: null, acc: ['backpack:#9e9e9e'], duty: '취업을 준비한다' },
};

export function getJob(id) {
  return JOBS.find((j) => j.id === id) || SPECIAL_JOBS[id] || SPECIAL_JOBS.jobseeker;
}

export const PERSONALITIES = [
  { id: 'chatty', name: '명랑한 수다쟁이', desc: '밝고 말이 많으며 처음 보는 젤리와도 금방 친해진다', speech: '느낌표와 감탄사를 많이 쓰고 ~요! 로 끝나는 발랄한 존댓말', social: 1.6, likes: ['cafe', 'restaurant', 'park', 'salon'] },
  { id: 'cynic', name: '시니컬한 냉소주의자', desc: '세상만사에 심드렁하지만 은근히 정이 있다', speech: '건조하고 짧은 반말 섞인 말투, 비꼬는 농담', social: 0.6, likes: ['bookstore', 'cafe', 'cinema'] },
  { id: 'shy', name: '수줍은 내향인', desc: '낯을 많이 가리고 조용하지만 속이 깊다', speech: '말끝을 흐리고 "저.. 그.." 같은 머뭇거림이 있는 조심스러운 존댓말', social: 0.4, likes: ['library', 'bookstore', 'gallery', 'home'] },
  { id: 'workaholic', name: '열정적인 워커홀릭', desc: '일 이야기만 나오면 눈이 반짝인다', speech: '빠르고 효율적인 말투, 업무 용어를 자주 섞음', social: 0.8, likes: ['cafe', 'convenience', 'gym'] },
  { id: 'chill', name: '느긋한 낙천가', desc: '뭐든 잘 될 거라고 믿는 여유로운 성격', speech: '느릿하고 편안한 말투, "괜찮아~ 다 잘 될 거야~"', social: 1.1, likes: ['park', 'cafe', 'cinema'] },
  { id: 'perfectionist', name: '깐깐한 완벽주의자', desc: '사소한 것도 그냥 넘어가지 않는다', speech: '정확하고 딱딱한 존댓말, 숫자와 사실을 따짐', social: 0.7, likes: ['library', 'museum', 'bank'] },
  { id: 'braggart', name: '허세 가득한 자랑쟁이', desc: '자기 자랑을 좋아하지만 미워할 수 없다', speech: '과장이 심하고 "내가 왕년에~" 같은 자랑을 섞는 말투', social: 1.3, likes: ['gym', 'clothing', 'restaurant', 'hotel'] },
  { id: 'caring', name: '다정한 오지라퍼', desc: '남 걱정이 많고 챙겨주는 걸 좋아한다', speech: '따뜻하고 걱정 많은 말투, "밥은 먹었어요?"', social: 1.4, likes: ['bakery', 'supermarket', 'park', 'flowershop'] },
  { id: 'dreamer', name: '엉뚱한 몽상가', desc: '상상력이 풍부하고 4차원적이다', speech: '갑자기 엉뚱한 주제로 튀는 몽환적인 말투', social: 1.0, likes: ['gallery', 'park', 'museum', 'concerthall'] },
  { id: 'grumpy', name: '투덜이지만 속정 깊은', desc: '늘 불평하지만 결국 도와준다', speech: '툴툴거리는 반말, "에휴 내가 못 살아"', social: 0.7, likes: ['restaurant', 'park', 'convenience'] },
  { id: 'curious', name: '호기심 많은 탐구가', desc: '모르는 게 있으면 못 참는다', speech: '질문을 많이 하는 들뜬 말투, "그거 어떻게 하는 거예요?"', social: 1.2, likes: ['museum', 'library', 'lab', 'bookstore'] },
  { id: 'anxious', name: '겁 많은 걱정쟁이', desc: '더위에 녹는 것을 세상에서 제일 무서워한다', speech: '불안하고 떨리는 말투, "혹시.. 오늘 너무 덥지 않아요? 녹을 것 같아요.."', social: 0.8, likes: ['home', 'pharmacy', 'library'] },
  { id: 'romantic', name: '로맨틱한 감성파', desc: '사랑과 낭만을 꿈꾼다', speech: '시적이고 감성적인 말투, 노을과 달빛 이야기를 좋아함', social: 1.2, likes: ['flowershop', 'cafe', 'concerthall', 'gallery'] },
  { id: 'joker', name: '유머러스한 개그맨', desc: '아재개그를 멈출 수 없다', speech: '말장난과 아재개그를 곁들인 장난스러운 말투', social: 1.5, likes: ['cinema', 'restaurant', 'park'] },
  { id: 'philosopher', name: '진지한 철학자', desc: '젤리의 존재 이유를 고민한다', speech: '사색적이고 느린 말투, 의미심장한 질문', social: 0.7, likes: ['library', 'museum', 'park'] },
  { id: 'competitive', name: '경쟁심 강한 승부사', desc: '무엇이든 이겨야 직성이 풀린다', speech: '도전적이고 에너지 넘치는 말투, "한 판 붙을래?"', social: 1.1, likes: ['gym', 'park', 'restaurant'] },
  { id: 'gossip', name: '소문 좋아하는 가십러', desc: '동네 모든 소식을 꿰고 있다', speech: '목소리를 낮추며 "그거 알아요? 비밀인데~"', social: 1.7, likes: ['salon', 'cafe', 'supermarket', 'bakery'] },
  { id: 'polite', name: '예의 바른 신사숙녀', desc: '언제나 품위와 매너를 지킨다', speech: '격식 있는 정중한 존댓말, "~하십니까"', social: 1.0, likes: ['hotel', 'concerthall', 'museum', 'bank'] },
  { id: 'rebel', name: '자유로운 영혼', desc: '규칙보다 자기 마음이 중요하다', speech: '쿨하고 자유분방한 반말, 은어 사용', social: 1.1, likes: ['concerthall', 'clothing', 'park', 'convenience'] },
  { id: 'planner', name: '꼼꼼한 계획가', desc: '하루를 분 단위로 계획한다', speech: '차분하고 논리적인 존댓말, "일단 순서대로 말씀드리면"', social: 0.9, likes: ['supermarket', 'bank', 'library'] },
];

export const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '배', '문', '노', '하', '곽'];
export const NAMES_M = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준우', '건우', '우진', '현우', '선우', '도현', '승현', '태윤', '재원', '동현', '성민', '상훈', '정호', '준혁', '태호', '민혁', '진우', '한결', '은찬'];
export const NAMES_F = ['서연', '서윤', '지우', '하윤', '민서', '하은', '지민', '윤서', '채원', '수아', '지아', '다은', '예은', '소율', '은지', '미영', '혜진', '유나', '보람', '나래', '수빈', '가은', '하린', '세아'];
export const NAMES_N = ['하늘', '바다', '솔', '별', '이슬', '온', '새벽', '라온', '누리', '해솔'];
export const OLD_M = ['영수', '철수', '광수', '병철', '만수', '덕배', '용식', '춘삼', '봉구', '칠복', '종팔'];
export const OLD_F = ['순자', '영희', '말순', '옥자', '정숙', '복순', '금례', '말자', '춘자', '갑순'];

export const SOCIAL_ROLES = [
  '동네 소식통', '반상회 회장', '조기축구회 주장', '자원봉사단 단장', '동네 밴드 기타리스트', '길고양이 경보 담당',
  '젤리시티 축제 준비위원', '녹지 않기 협회 회원', '맛집 탐방 동호회 총무', '독서모임 리더', '이사 온 지 얼마 안 된 신입 주민',
  '골목 패션 리더', '동네 바둑 고수', '주말 플리마켓 셀러', 'SNS 인플루언서', '아파트 관리위원', '청년회 회원', '합창단 솔리스트',
  '자칭 동네 탐정', '플로깅 모임 회원', '노래자랑 3년 연속 예선 탈락자', '동네 고민상담소장', '야간 산책 모임 회원', '사탕 나눔 운동가',
];

export const HOBBIES = ['요리', '등산', '게임', '뜨개질', '사진 찍기', '노래방', '독서', '축구', '요가', '음악 감상', '영화 감상', '춤', '낚시', '캠핑', '그림 그리기', '식물 키우기', '빵 굽기', '별 보기', '퍼즐', '쇼핑', '맛집 탐방', '달리기', '바둑', '우쿨렐레 연주', '개미 관찰', '벽 타기', '천장 산책'];
export const WORRIES = [
  '요즘 더워서 몸이 자꾸 녹는 것 같다', '월세가 너무 올랐다', '귀가 자꾸 찌그러진다', '승진이 늦어지고 있다',
  '짝사랑하는 상대에게 고백을 못 했다', '몸이 말랑해서 맞는 옷이 없다', '젤리 광고만 보면 기분이 묘하다',
  '아이가 공부를 안 한다', '건강검진 결과가 걱정이다', '노후 준비가 막막하다', '친구와 사소한 일로 다퉜다',
  '이직을 고민 중이다', '밤에 잠이 안 온다', '새로운 취미를 찾고 싶다', '집이 너무 좁다', '날개를 한 번도 써본 적이 없다',
  '다이어트 중인데 설탕이 너무 맛있다', '부모님 잔소리가 심하다', '시험이 코앞이다',
];
export const DREAMS = ['세계 일주', '내 가게 차리기', '유명 가수 되기', '젤리시티 시장 되기', '노벨상 받기', '베스트셀러 작가 되기', '건물주 되기', '가족과 행복하게 사는 것', '올림픽 벽타기 금메달', '우주 여행', '최고의 셰프 되기', '날개로 하늘 날기', '인간 부엌 탐험'];

export const BODY_COLORS = ['#8a5634', '#9b6038', '#7a4a2c', '#a86b3e', '#6e3f25', '#b07945', '#8f4f2f', '#9a5a3a', '#7d5236'];

// 건물 안에서 할 수 있는 행동 (cost: ₩, dur: 게임 분, fx: 욕구 변화)
export const ACTIONS = {
  home: [
    { id: 'sleep', label: '😴 잠자기', cost: 0, dur: 0, fx: { energy: 100 }, sleep: true },
    { id: 'cook', label: '🍳 요리해서 먹기', cost: 5, dur: 45, fx: { hunger: 45, fun: 5 } },
    { id: 'shower', label: '🚿 샤워하기', cost: 0, dur: 20, fx: { hygiene: 60 } },
    { id: 'tv', label: '📺 TV 보기', cost: 0, dur: 60, fx: { fun: 25, energy: 5 } },
    { id: 'recolor', label: '🎨 거울 앞에서 몸 색깔 바꾸기', recolor: true },
  ],
  restaurant: [{ id: 'order', label: '🍚 주문하기 (먹고 가기 · 포장)', menu: true }],
  pizza: [{ id: 'order', label: '🍕 주문하기 (먹고 가기 · 포장)', menu: true }],
  chicken: [{ id: 'order', label: '🍗 주문하기 (먹고 가기 · 포장)', menu: true }],
  chinese: [{ id: 'order', label: '🥡 주문하기 (먹고 가기 · 포장)', menu: true }],
  gukbap: [{ id: 'order', label: '🍲 주문하기 (먹고 가기 · 포장)', menu: true }],
  burger: [{ id: 'order', label: '🍔 주문하기 (먹고 가기 · 포장)', menu: true }],
  bunsik: [{ id: 'order', label: '🍢 주문하기 (먹고 가기 · 포장)', menu: true }],
  cafe: [{ id: 'coffee', label: '☕ 주문하기 (먹고 가기 · 테이크아웃)', menu: true }],
  bakery: [{ id: 'bread', label: '🥐 빵 고르기 (먹고 가기 · 포장)', menu: true }],
  convenience: [
    { id: 'order', label: '🍜 계산대에서 사먹기 (먹고 가기 · 포장)', menu: true },
    { id: 'microwave', label: '♨️ 전자레인지로 데워먹기', menu: true },
    { id: 'shop', label: '🛒 진열대 둘러보기 (상점)', shop: true },
  ],
  supermarket: [{ id: 'groceries', label: '🛒 장보기 (요리 재료)', cost: 18, dur: 40, fx: { hunger: 30, fun: 5 } }, { id: 'shop', label: '🧺 진열대 둘러보기 (상점)', shop: true }],
  pharmacy: [{ id: 'vitamin', label: '💊 비타민 먹기', cost: 8, dur: 10, fx: { energy: 20, hygiene: 5 } }, { id: 'shop', label: '🩹 구급상자 사기 (상점)', shop: true }],
  hospital: [{ id: 'checkup', label: '🩺 진료 받기 (체력 회복)', cost: 20, dur: 60, fx: { energy: 35, hygiene: 15, hunger: -5 }, heal: 100 }],
  dental: [{ id: 'scaling', label: '🦷 스케일링', cost: 15, dur: 40, fx: { hygiene: 45 } }],
  vet: [{ id: 'pet', label: '🐾 반려동물 쓰다듬기', cost: 0, dur: 20, fx: { fun: 15, social: 5 } }],
  salon: [{ id: 'haircut', label: '💇 머리 손질', cost: 12, dur: 45, fx: { hygiene: 35, fun: 12 } }, { id: 'restyle', label: '💇 얼굴·더듬이·날개 스타일 바꾸기', cost: 30, restyle: true }],
  clothing: [{ id: 'shop', label: '👗 옷 구경하기 (상점)', shop: true }],
  bookstore: [{ id: 'shop', label: '📖 책·인형 사기 (상점)', shop: true }],
  library: [{ id: 'read', label: '📚 책 읽기', cost: 0, dur: 60, fx: { fun: 18, energy: -5 } }],
  gym: [
    { id: 'workout', label: '🏋️ 운동하기', cost: 5, dur: 60, fx: { fun: 18, energy: -15, hygiene: -15, hunger: -10 } },
    { id: 'gymshower', label: '🚿 샤워실', cost: 0, dur: 15, fx: { hygiene: 50 } },
  ],
  cinema: [{ id: 'movie', label: '🎬 영화 보기', cost: 10, dur: 120, fx: { fun: 45, social: 5 } }],
  concerthall: [{ id: 'concert', label: '🎵 공연 관람', cost: 20, dur: 120, fx: { fun: 55, social: 10 } }],
  museum: [{ id: 'exhibit', label: '🦕 전시 관람', cost: 5, dur: 60, fx: { fun: 28 } }],
  gallery: [{ id: 'art', label: '🎨 그림 감상', cost: 0, dur: 40, fx: { fun: 22 } }],
  bank: [{ id: 'interest', label: '🏦 오늘의 이자 받기', cost: 0, dur: 10, interest: true }],
  postoffice: [{ id: 'letter', label: '💌 편지 보내기', cost: 2, dur: 15, fx: { social: 20 } }],
  cityhall: [{ id: 'jobs', label: '📋 일자리 찾기', cost: 0, dur: 0, jobBoard: true }],
  police: [{ id: 'report', label: '🚨 민원 상담', cost: 0, dur: 20, fx: { social: 10 } }],
  fire: [{ id: 'truck', label: '🚒 소방차 구경', cost: 0, dur: 20, fx: { fun: 12 } }],
  court: [{ id: 'trial', label: '⚖️ 재판 방청', cost: 0, dur: 60, fx: { fun: 20 } }],
  tvstation: [{ id: 'show', label: '📺 방청객 참여', cost: 0, dur: 90, fx: { fun: 30, social: 10 }, earn: 15 }],
  hotel: [{ id: 'stay', label: '🛏️ 호텔 숙박', cost: 40, dur: 0, fx: { energy: 100, hygiene: 40 }, sleep: true }],
  realestate: [{ id: 'buyhouse', label: '🏠 집 구매하기', houses: true }],
  range: [
    { id: 'range_start', label: '🎯 사격 시작 (60초)', rangeStart: true },
    { id: 'range_rent', label: '🔫 연습용 총 빌리기 (10분)', rangeRent: true },
  ],
  magicshop: [{ id: 'shop', label: '🪄 지팡이 둘러보기 (상점)', shop: true }],
  fishing: [{ id: 'shop', label: '🎣 낚시용품 사기 (상점)', shop: true }, { id: 'sell', label: '💰 물고기·전리품 팔기', sell: true }],
  seafood: [
    { id: 'order', label: '🍲 정식 주문하기 (먹고 가기 · 포장)', menu: true },
    { id: 'cook_spicy', label: '🌶️ 잡아온 물고기로 매운탕 끓이기 (₩10)', cookFish: 'spicy' },
    { id: 'cook_raw', label: '🔪 잡아온 물고기로 회 뜨기 (₩8)', cookFish: 'raw' },
  ],
  hunter: [{ id: 'shop', label: '🏹 사냥 장비 사기 (상점)', shop: true }, { id: 'sell', label: '💰 전리품 팔기 (가죽·고기·트로피)', sell: true }],
  ranch: [{ id: 'order', label: '🐄 목장 음식 주문하기', menu: true }],
  prison: [{ id: 'visit', label: '🔒 면회실 구경', cost: 0, dur: 20, fx: { social: 5 } }],
  dealer: [{ id: 'dealer', label: '🏎️ 자동차·오토바이·자전거 구경하기 (쇼룸)', dealer: true }],
  flowershop: [{ id: 'shop', label: '💐 꽃·인형 사기 (상점)', shop: true }],
  armory_3k: [{ id: 'shop', label: '⚔️ 병기 둘러보기 (상점)', shop: true }],
  armory_mil: [{ id: 'shop', label: '🎖️ 장비 둘러보기 (상점)', shop: true }],
  armory_sf: [{ id: 'shop', label: '🌌 무기 둘러보기 (상점)', shop: true }],
  jeweler: [{ id: 'shop', label: '💎 보석 사기 (상점)', shop: true }, { id: 'enchant', label: '✨ 인챈트 (보석 박기)', enchant: true }],
  hatshop: [{ id: 'shop', label: '🎩 모자 써보기 (상점)', shop: true }],
  eyewear: [{ id: 'shop', label: '🕶️ 안경 써보기 (상점)', shop: true }],
  club: [
    { id: 'dance', label: '💃 춤추기', cost: 0, dur: 60, fx: { fun: 45, social: 20, energy: -10 } },
    { id: 'cocktail', label: '🍹 칵테일 한 잔', cost: 15, dur: 15, fx: { fun: 15, energy: 10 } },
  ],
  dojang: [
    { id: 'course_jump2', label: '🥋 수련: 점프맵 (점프력 강화 전수)', course: 'jump2' },
    { id: 'course_jump3', label: '🥋 수련: 고급 점프맵 (3단 점프 전수)', course: 'jump3' },
    { id: 'course_dash', label: '🔥 수련: 용암 징검다리 (대쉬 거리 강화 전수)', course: 'dash' },
    { id: 'meditate', label: '🧘 명상하기', cost: 0, dur: 30, fx: { fun: 10, energy: 15 } },
  ],
  school: [{ id: 'class', label: '✏️ 공개 수업 듣기', cost: 0, dur: 60, fx: { social: 10, energy: -5 } }],
  kindergarten: [{ id: 'play', label: '🧸 아이들과 놀아주기', cost: 0, dur: 45, fx: { fun: 20, social: 15, energy: -10 } }],
  university: [{ id: 'lecture', label: '🎓 청강하기', cost: 0, dur: 90, fx: { fun: 10, social: 8, energy: -8 } }],
  office: [{ id: 'pantry', label: '☕ 탕비실 공짜 커피', cost: 0, dur: 15, fx: { energy: 12, social: 5 } }],
  lab: [{ id: 'experiment', label: '🔬 실험 구경', cost: 0, dur: 40, fx: { fun: 18 } }],
  factory: [{ id: 'tourf', label: '🍪 공장 견학 (과자 시식)', cost: 0, dur: 40, fx: { fun: 15, hunger: 10 } }],
  construction: [{ id: 'watch', label: '👷 공사 구경', cost: 0, dur: 20, fx: { fun: 8 } }],
  garage: [{ id: 'rent', label: '🚗 자동차 렌트', cost: 20, dur: 5, rent: true }],
};

// 거리 잡담
export const SMALL_TALK = {
  greet: ['안녕하세요! 🙂', '어머, 오랜만이에요!', '오늘 날씨 좋네요 ☀️', '어디 가세요?', '머리 하셨어요? 멋져요!', '안녕~ 👋', '좋은 하루예요!'],
  topic: [
    '요즘 {place}에 사람이 많더라고요', '어제 천둥 소리 들었어요? 😱', '{job} 일은 할 만해요?', '점심 뭐 먹을까요? 🍜',
    '요즘 설탕 값이 너무 올랐어요', '주말에 공원 갈래요? 🌳', '{other}씨 소식 들었어요?', '온몸이 다 쑤셔요...',
    '시장님이 또 축제 연대요 🎉', '새로 생긴 {place} 가봤어요?', '어젯밤 달빛 산책 최고였어요 🌙', '사탕 가게 세일한대요! 🎊',
  ],
  reply: ['맞아요 ㅎㅎ', '진짜요? 😮', '저도요!', '에이 설마~', '하하하 😆', '그러게요...', '좋아요! 👍', '헉 대박 😲', '음~ 글쎄요 🤔'],
  bye: ['다음에 봐요! 👋', '조심히 가요~', '또 봐요!', '더위 조심해요! ☀️'],
};

export const EMOTE = { happy: '😊', neutral: '🙂', sad: '😢', angry: '😠', surprised: '😲', love: '🥰', scared: '😱', thinking: '🤔' };
