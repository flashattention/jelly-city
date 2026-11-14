// ⏳ 시간 여행 풍경 조각 모음: 이름 → { build(r, P, th) → Object3D, band?, face?, y?, high?, gap? }
//   userData.anim 이 있으면 움직이고(묶지 않음), 없으면 칸마다 한 장으로 묶인다 (time-world.js)
import { COSMOS } from './time-kits-cosmos.js';
import { LIFE_KITS } from './time-life.js';
import { CIV_KITS } from './time-civ.js';
export const TK = { ...COSMOS, ...LIFE_KITS, ...CIV_KITS };
