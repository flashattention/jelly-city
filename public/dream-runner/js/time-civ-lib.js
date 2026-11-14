// ⏳ 제5 ~ 9장 (문명 · 미래) 모양 만들기 틀: 사람 옷차림표 · 건물 · 탈것 · 서 있는 장애물 · 소품 · 장면
//   이름 하나에 한 줄로 그 시대 모양을 만들 수 있게 (time-civ.js 가 쓴다)
import { THREE, add, B, C, S, Sh, K, T, hemi, Oct, Rock, glow, G, flame, smoke, liven, person, quad, shadeHex, SKINS, latheG, shapeG, dotsInst } from './time-lib.js';

export const g0 = () => new THREE.Group();
export const anim = (o, f) => { o.userData.anim = f; return o; };
export const ranim = (o, f) => { o.userData.anim = f; o.userData.rootAnim = true; return o; };
export const still = (o) => { delete o.userData.anim; return o; };
const TOONT = new Map();
export const toonT = (c, op) => { const k = c + op; if (!TOONT.has(k)) TOONT.set(k, new THREE.MeshToonMaterial({ color: c, transparent: true, opacity: op, depthWrite: op > 0.6 })); return TOONT.get(k); };

// ---------- 사람 옷차림표: 이름 → person() 옵션 ----------
const sk = (r) => r.pick(SKINS);
export const PEOPLE = {
  farmer: (r) => ({ top: '#c8a070', bot: '#8d6e63', belt: '#6d4c41', r: 'sickle', l: 'wheat', hat: r.chance(0.5) ? 'straw' : null }),
  carver: (r) => ({ top: '#a1887f', bot: '#6d4c41', r: 'hammer', hair: '#3e2723' }),
  scribe: (r) => ({ top: '#f5f0e0', robe: '#e8dcc0', r: 'scroll', l: 'book', lc: '#bf8f5a', hair: '#212121' }),
  sumerian: (r) => ({ top: '#d8b888', robe: '#c8a070', beard: '#212121', hair: '#212121', r: 'basket' }),
  egyptWorker: (r) => ({ skin: r.pick(['#a86f43', '#8a5634', '#c68e5d']), top: '#f5f0e0', bot: '#a86f43', belt: '#f5f0e0', r: r.chance(0.5) ? 'hammer' : 'basket', hat: 'headband', hatC: '#1e66c8' }),
  egyptPriest: (r) => ({ skin: '#a86f43', top: '#fafafa', robe: '#fafafa', hat: 'nemes', r: 'staff', rc: '#f4d03f', belt: '#f4d03f' }),
  druid: (r) => ({ top: '#eceff1', robe: '#eceff1', hat: 'hood', hatC: '#eceff1', beard: '#fafafa', r: 'staff' }),
  indusTrader: (r) => ({ skin: '#a86f43', top: '#e8d8b8', robe: '#c62828', r: 'pot', l: 'basket', hair: '#212121' }),
  shangPeople: (r) => ({ top: '#5d4037', robe: '#3e2723', belt: '#c62828', hair: '#212121', r: r.chance(0.5) ? 'spear' : 'basket' }),
  babylonian: (r) => ({ top: '#1e4a9a', robe: '#c8a070', beard: '#212121', hair: '#212121', hat: 'kufi', hatC: '#f4d03f', r: 'scroll' }),
  hoplite: (r) => ({ top: '#c62828', armor: '#c9a227', bot: '#c9a227', hat: 'corinth', r: 'spear', l: 'roundShield', lc: '#c9a227', cape: '#c62828' }),
  trojan: (r) => ({ top: '#6a1b9a', armor: '#b0883a', hat: 'corinth', hatC: '#b0883a', r: 'sword', l: 'roundShield', lc: '#6a1b9a' }),
  phoenician: (r) => ({ top: '#7a2a6a', robe: '#7a2a6a', hat: 'kufi', hatC: '#7a2a6a', beard: '#212121', r: 'pot', rc: '#c8a070' }),
  greekMuse: (r) => ({ skin: sk(r), top: '#fafafa', robe: '#fafafa', hat: 'laurel', r: r.pick(['scroll', 'flower']), hair: '#8d5524' }),
  athlete: (r) => ({ skin: sk(r), top: '#e0a875', bot: '#e0a875', hat: 'laurel', belt: '#fafafa' }),
  athleteRun: (r) => PEOPLE.athlete(r),
  persianGuard: (r) => ({ top: '#1e6a8a', robe: '#1e6a8a', belt: '#f4d03f', hat: 'turban', hatC: '#f4d03f', beard: '#212121', r: 'spear', l: 'roundShield', lc: '#c9a227' }),
  monk: (r) => ({ skin: '#c68e5d', top: '#ff8f00', robe: '#ff8f00', r: 'staff' }),
  scholar: (r) => ({ top: '#2e3a3a', robe: '#3e4a4a', hat: 'kufi', hatC: '#212121', beard: '#212121', r: 'scroll' }),
  philosopher: (r) => ({ top: '#fafafa', robe: '#f0ece0', beard: '#9e9e9e', hair: '#9e9e9e', r: 'scroll' }),
  athenian: (r) => ({ skin: sk(r), top: r.pick(['#fafafa', '#90caf9', '#ffcc80']), robe: '#f0ece0', r: r.chance(0.5) ? 'scroll' : null, hair: '#5d4037' }),
  phalanx: (r) => ({ top: '#c62828', armor: '#c9a227', hat: 'corinth', r: 'spear', l: 'roundShield', lc: '#c62828' }),
  qinSoldier: (r) => ({ skin: '#c68e5d', top: '#5d4037', armor: '#3e2723', bot: '#3e2723', hat: 'kufi', hatC: '#3e2723', r: 'spear' }),
  silkTrader: (r) => ({ skin: sk(r), top: '#c62828', robe: '#1e88e5', hat: 'turban', hatC: '#fafafa', r: 'sack', rc: '#e0b070' }),
  romanCitizen: (r) => ({ skin: sk(r), top: '#fafafa', robe: '#f0ece0', belt: '#7a2a6a', hair: '#5d4037', r: r.chance(0.4) ? 'scroll' : null }),
  gladiator: (r) => ({ skin: sk(r), top: '#e0a875', armor: '#b0883a', hat: 'galea', hatC: '#c9a227', r: 'gladius', l: 'roundShield', lc: '#c62828', belt: '#5d4037' }),
  romanMessenger: (r) => ({ top: '#c62828', bot: '#8d6e63', belt: '#5d4037', r: 'scroll', hat: 'headband', hatC: '#c62828' }),
  legionary: (r) => ({ top: '#c62828', armor: '#9aa3ad', sleeve: '#c62828', bot: '#c62828', hat: 'galea', r: 'gladius', l: 'scutum', lc: '#c62828', belt: '#5d4037' }),
  pompeiiCitizen: (r) => ({ skin: sk(r), top: '#c8a888', robe: '#b03a2e', hair: '#3e2723', r: 'pot' }),
  germanicWarrior: (r) => ({ top: '#6d4c41', bot: '#5d4037', cape: '#8d6e63', beard: '#d8a050', hair: '#d8a050', r: 'axe', l: 'roundShield', lc: '#2e7d32' }),
  byzantine: (r) => ({ skin: sk(r), top: '#6a1b9a', robe: '#6a1b9a', belt: '#f4d03f', hat: 'crown', r: 'staff', rc: '#f4d03f' }),
  tangCitizen: (r) => ({ skin: '#f2c28a', top: r.pick(['#c62828', '#2e7d32', '#ffca28', '#ff80ab']), robe: r.pick(['#c62828', '#2e7d32', '#1565c0']), hair: '#212121', r: r.chance(0.5) ? 'lantern' : 'flower' }),
  abbasidScholar: (r) => ({ skin: sk(r), top: '#fafafa', robe: '#1e88e5', hat: 'turban', hatC: '#fafafa', beard: '#212121', r: 'book', rc: '#1e88e5' }),
  mayan: (r) => ({ skin: '#a86f43', top: '#fafafa', bot: '#a86f43', hat: 'feather', belt: '#26a69a', r: r.chance(0.5) ? 'spear' : 'basket' }),
  viking: (r) => ({ skin: '#ffd8b0', top: '#6d4c41', bot: '#5d4037', cape: '#c62828', hat: 'round', beard: r.pick(['#d8a050', '#8d5524', '#c62828']), hair: '#d8a050', r: 'axe', l: 'roundShield', lc: r.pick(['#c62828', '#1565c0', '#ffca28']) }),
  crusader: (r) => ({ top: '#fafafa', armor: '#cfd8dc', bot: '#9e9e9e', hat: 'knight', r: 'sword', l: 'kite', cape: '#fafafa' }),
  saracen: (r) => ({ skin: '#c68e5d', top: '#2e7d32', robe: '#fafafa', hat: 'turban', hatC: '#fafafa', beard: '#212121', r: 'sword', l: 'roundShield', lc: '#2e7d32' }),
  mongolWarrior: (r) => ({ skin: '#e0a875', top: '#8d2a1c', bot: '#5d4037', belt: '#ffca28', hat: 'mongol', r: 'bow' }),
  plagueDoctor: (r) => ({ top: '#212121', robe: '#1a1a1a', hat: 'beak', r: 'staff', rc: '#3e2723', l: 'lantern' }),
  aztec: (r) => ({ skin: '#a86f43', top: '#fafafa', bot: '#a86f43', hat: 'feather', hatC: '#26a69a', belt: '#c62828', r: r.chance(0.5) ? 'spear' : 'basket' }),
  eagleWarrior: (r) => ({ skin: '#a86f43', top: '#8d6e63', bot: '#5d4037', hat: 'feather', hatC: '#5d4037', r: 'club', l: 'roundShield', lc: '#26a69a' }),
  inca: (r) => ({ skin: '#a86f43', top: '#c62828', robe: '#c62828', belt: '#ffca28', hat: 'headband', hatC: '#ffca28', r: 'staff' }),
  mingSailor: (r) => ({ skin: '#f2c28a', top: '#1565c0', bot: '#212121', hat: 'coolie', r: r.chance(0.5) ? 'net' : 'sack' }),
  renaissanceArtist: (r) => ({ skin: sk(r), top: '#8a2a1a', bot: '#3e2723', hat: 'beret', hatC: '#8a2a1a', beard: '#5d4037', r: 'quill', l: 'book', lc: '#c9a227' }),
  florentine: (r) => ({ skin: sk(r), top: r.pick(['#1565c0', '#c62828', '#2e7d32']), bot: '#3e2723', hat: 'beret', hatC: '#212121', r: null }),
  printer: (r) => ({ top: '#f5f0e0', bot: '#5d4037', belt: '#3e2723', hat: 'cap', hatC: '#5d4037', r: 'book' }),
  reader: (r) => ({ skin: sk(r), top: '#5d4037', robe: '#3e2723', r: 'book', rc: '#c62828' }),
  paperBoy: (r) => ({ skin: sk(r), top: '#fafafa', bot: '#5d4037', hat: 'cap', hatC: '#5d4037', r: 'book', rc: '#fff8e1', s: 0.85 }),
  sailor: (r) => ({ skin: sk(r), top: '#fafafa', bot: '#1565c0', hat: 'headband', hatC: '#c62828', r: 'net' }),
  reformer: (r) => ({ top: '#212121', robe: '#212121', hat: 'beret', hatC: '#212121', r: 'book', rc: '#3e2723' }),
  townsfolk: (r) => ({ skin: sk(r), top: r.pick(['#8d6e63', '#558b2f', '#c62828', '#1565c0']), bot: '#5d4037', hat: r.chance(0.4) ? 'hood' : null, r: r.pick(['basket', 'sack', null]) }),
  peasantMed: (r) => PEOPLE.townsfolk(r),
  astronomer: (r) => ({ top: '#1a237e', robe: '#283593', beard: '#9e9e9e', hat: 'beret', hatC: '#1a237e', r: 'telescope' }),
  musketeer: (r) => ({ top: '#1565c0', bot: '#3e2723', hat: 'tricorne', r: 'musket', belt: '#fafafa' }),
  pikeman: (r) => ({ top: '#c62828', armor: '#9aa3ad', bot: '#3e2723', hat: 'round', hatC: '#9aa3ad', r: 'spear' }),
  newtonian: (r) => ({ skin: sk(r), top: '#5d4037', bot: '#3e2723', hair: '#eceff1', r: 'book' }),
  enlightened: (r) => ({ skin: sk(r), top: '#1565c0', bot: '#fafafa', hair: '#fafafa', r: 'book', rc: '#c62828' }),
  ladyWig: (r) => ({ skin: sk(r), top: '#f48fb1', robe: '#f48fb1', hair: '#fafafa', r: 'flower' }),
  factoryWorker: (r) => ({ skin: sk(r), top: '#5d6d7e', bot: '#3e2723', hat: 'cap', hatC: '#3e3e3e', r: r.pick(['hammer', 'wrench', 'pick']) }),
  gentleman: (r) => ({ skin: sk(r), top: '#212121', bot: '#212121', hat: 'tophat', r: 'staff', rc: '#212121' }),
  colonist: (r) => ({ skin: sk(r), top: '#5d4037', bot: '#f5f0e0', hat: 'tricorne', r: r.chance(0.5) ? 'scroll' : 'flag', rc: '#b22234' }),
  minuteman: (r) => ({ skin: sk(r), top: '#3c3b6e', bot: '#f5f0e0', hat: 'tricorne', r: 'musket' }),
  revolutionary: (r) => ({ skin: sk(r), top: '#0055a4', bot: '#f5f5f5', hat: 'phrygian', r: 'flag', rc: '#ef4135' }),
  sansCulotte: (r) => ({ skin: sk(r), top: '#f5f5f5', bot: '#0055a4', hat: 'phrygian', r: 'pitchfork' }),
  drummerBoy: (r) => ({ skin: sk(r), top: '#0055a4', bot: '#f5f5f5', hat: 'shako', s: 0.85, r: 'staff', rc: '#fafafa' }),
  grenadier: (r) => ({ skin: sk(r), top: '#1a3a8a', bot: '#f5f5f5', belt: '#f5f5f5', hat: 'shako', r: 'musket' }),
  freedPerson: (r) => ({ skin: r.pick(['#8a5634', '#6d4c41', '#a86f43']), top: r.pick(['#fafafa', '#ffca28', '#90caf9']), bot: '#5d4037', r: 'flower', rc: '#ffca28' }),
  naturalist: (r) => ({ skin: '#ffd8b0', top: '#8d6e63', bot: '#5d4037', hat: 'straw', beard: '#9e9e9e', r: 'book', rc: '#2e7d32', l: 'net' }),
  inventor: (r) => ({ skin: sk(r), top: '#5d4037', bot: '#3e2723', belt: '#3e2723', hair: '#eceff1', r: 'wrench' }),
  victorian: (r) => ({ skin: sk(r), top: r.pick(['#6a1b9a', '#2e7d32', '#212121']), robe: r.pick(['#6a1b9a', '#3e2723']), hat: 'tophat', r: 'staff', rc: '#212121' }),
  aviator: (r) => ({ skin: sk(r), top: '#5d4037', bot: '#3e2723', hat: 'cap', hatC: '#5d4037', r: null }),
  ww1Soldier: (r) => ({ skin: sk(r), top: '#6b6b3a', bot: '#5a5a30', hat: 'brodie', r: 'rifle' }),
  depressionMan: (r) => ({ skin: sk(r), top: '#5a5a5a', bot: '#3a3a3a', hat: 'cap', hatC: '#4a4a4a', r: 'sack' }),
  newsboy: (r) => ({ skin: sk(r), top: '#8d6e63', bot: '#5d4037', hat: 'cap', hatC: '#5d4037', r: 'book', rc: '#f5f5f5', s: 0.85 }),
  ww2Soldier: (r) => ({ skin: sk(r), top: '#5a6a3a', bot: '#4a5a30', hat: 'm1', r: 'rifle' }),
  diplomat: (r) => ({ skin: sk(r), top: '#263238', bot: '#263238', r: 'book', rc: '#4b92db' }),
  celebrant: (r) => ({ skin: r.pick(SKINS), top: r.pick(['#ff9933', '#138808', '#ffca28', '#e53935', '#1e88e5']), bot: '#5d4037', r: 'flag', rc: r.pick(['#ff9933', '#138808', '#e53935', '#ffca28']) }),
  engineer: (r) => ({ skin: sk(r), top: '#eceff1', bot: '#455a64', hat: 'hardhat', hatC: '#fafafa', r: 'wrench' }),
  astronaut: (r) => ({ skin: '#fafafa', top: '#f5f5f5', bot: '#eceff1', hat: 'astro', belt: '#90a4ae' }),
  astronautHop: (r) => PEOPLE.astronaut(r),
  programmer: (r) => ({ skin: sk(r), top: r.pick(['#ff7043', '#42a5f5', '#66bb6a']), bot: '#1565c0', hair: '#5d4037', r: 'book', rc: '#5d4037' }),
  berliner: (r) => ({ skin: sk(r), top: r.pick(['#e53935', '#1e88e5', '#fdd835', '#8e24aa']), bot: '#1565c0', r: r.pick(['hammer', 'flag', 'flower']), rc: '#fdd835' }),
  netizen: (r) => ({ skin: sk(r), top: r.pick(['#40c4ff', '#69f0ae', '#ffeb3b']), bot: '#263238', r: 'phone' }),
  scientist: (r) => ({ skin: sk(r), top: '#fafafa', robe: '#fafafa', bot: '#455a64', r: 'pot', rc: '#80deea' }),
  phoneUser: (r) => ({ skin: sk(r), top: r.pick(['#ff7043', '#42a5f5', '#66bb6a', '#ab47bc', '#fafafa']), bot: r.pick(['#1565c0', '#263238']), r: 'phone' }),
  maskedPerson: (r) => ({ skin: sk(r), top: r.pick(['#90caf9', '#fafafa', '#ffab91', '#a5d6a7']), bot: '#455a64', hat: 'mask', r: r.chance(0.4) ? 'phone' : null }),
  marsColonist: (r) => ({ skin: '#fafafa', top: '#ff7043', bot: '#eceff1', hat: 'astro', hatC: '#fafafa', belt: '#455a64', r: 'wrench' }),
  jellyScout: (r) => ({ skin: r.pick(['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f', '#b388ff']), top: '#2e7d32', bot: '#5d4037', hat: 'headband', hatC: '#76ff03', r: 'lantern', rc: '#ccff90' }),
  jellyWarrior: (r) => ({ skin: r.pick(['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f', '#b388ff']), top: r.pick(['#ff4081', '#40c4ff', '#ffeb3b']), bot: '#7c4dff', hat: 'visor', hatC: '#ff4081', r: 'candyGun', l: 'roundShield', lc: '#ffeb3b' }),
  jellyGardener: (r) => ({ skin: r.pick(['#ff80ab', '#80d8ff', '#ccff90', '#ffe57f']), top: '#81c784', bot: '#8d6e63', hat: 'straw', r: 'flower', rc: r.pick(['#ff80ab', '#ffeb3b', '#e1bee7']) }),
  jellyAstronaut: (r) => ({ skin: r.pick(['#ff80ab', '#80d8ff', '#ccff90']), top: '#e0e0f0', bot: '#b0bec5', hat: 'astro', belt: '#7c4dff' }),
  peasant: (r) => PEOPLE.farmer(r), citizen: (r) => PEOPLE.townsfolk(r), hunter: (r) => ({ top: '#8d6e63', bot: '#5d4037', r: 'spear' }),
};
export const makePerson = (name, r, extra) => person(r, { skin: sk(r), ...PEOPLE[name](r), ...extra });
// 돌 · 청동 동상 (사람 모양을 한 색으로)
export function statue(r, name, col = '#d8d0c0', s = 1.4) { const p = still(makePerson(name, r)); p.traverse((c) => { if (c.isMesh && !c.material.isMeshBasicMaterial) c.material = MAT(col); }); p.scale.setScalar(s); const g = g0(); add(g, G.box(), MAT(shadeHex(col, 0.85)), 0, 0.3, 0, 1.0, 0.6, 1.0); p.position.y = 0.6; g.add(p); return g; }
const MATS = new Map(); export const MAT = (c) => { if (!MATS.has(c)) MATS.set(c, new THREE.MeshToonMaterial({ color: c })); return MATS.get(c); };

// ---------- 동물 (추가) ----------
export const ANIMALS = {
  sheep: (r) => { const g = quad(r, { c: '#fafafa', c2: '#3e2723', L: 0.9, H: 0.4, W: 0.6, neck: 0.15, head: 0.25, tail: 0.15, legC: '#3e2723', earC: '#3e2723', gait: 8, fur: '#f5f5f5' }); return g; },
  goat: (r) => quad(r, { c: r.pick(['#fafafa', '#8d6e63', '#3e2723']), c2: '#d7ccc8', L: 0.9, H: 0.5, W: 0.4, neck: 0.3, head: 0.25, tail: 0.15, horns: 1.3, hornC: '#5d4037', gait: 9 }),
  ox: (r) => quad(r, { c: r.pick(['#6d4c41', '#8d6e63', '#3e2723']), c2: '#d7ccc8', L: 2.2, H: 0.8, W: 1.1, neck: 0.25, head: 0.5, tail: 0.5, horns: 0.6, gait: 4, thickLegs: true }),
  zebu: (r) => quad(r, { c: '#e0d8c8', c2: '#bcaaa4', L: 2, H: 0.8, W: 1, neck: 0.25, head: 0.45, tail: 0.5, horns: 0.6, hump: true, gait: 4 }),
  donkey: (r) => quad(r, { c: '#8d8d8d', c2: '#e0e0e0', L: 1.2, H: 0.6, W: 0.5, neck: 0.4, head: 0.35, tail: 0.4, bigEars: false, earC: '#5a5a5a', mane: '#3a3a3a', gait: 8 }),
  horse: (r) => quad(r, { c: r.pick(['#8d6e63', '#3e2723', '#fafafa', '#a1887f', '#5d4037']), c2: '#d7ccc8', L: 1.9, H: 1.0, W: 0.7, neck: 0.75, head: 0.4, tail: 0.5, mane: '#3e2723', gait: 8, tilt: 0.75 }),
  camel: (r) => quad(r, { c: '#d8b070', c2: '#f0d8a8', L: 2.2, H: 1.3, W: 0.9, neck: 1.0, head: 0.4, tail: 0.3, hump: true, gait: 4, tilt: 1.1 }),
  llama: (r) => quad(r, { c: r.pick(['#fafafa', '#d7ccc8', '#8d6e63']), c2: '#f5f5f5', L: 1.2, H: 0.8, W: 0.5, neck: 0.9, head: 0.25, tail: 0.2, gait: 6, tilt: 0.25, fur: '#f5f5f5' }),
  yak: (r) => quad(r, { c: '#3e2723', c2: '#5d4037', L: 2, H: 0.7, W: 1.1, neck: 0.25, head: 0.45, tail: 0.5, horns: 0.6, hump: true, fur: '#2b1d16', gait: 4 }),
  deer: (r) => quad(r, { c: '#a1662f', c2: '#f5e6d0', L: 1.3, H: 0.8, W: 0.45, neck: 0.5, head: 0.25, tail: 0.15, antlers: true, gait: 9, spots: '#f5e6d0' }),
  fox: (r) => quad(r, { c: '#e65100', c2: '#fafafa', L: 0.8, H: 0.35, W: 0.3, neck: 0.2, head: 0.25, tail: 0.9, tailC: '#e65100', gait: 10 }),
  cat: (r) => quad(r, { c: r.pick(['#d7a86e', '#3e2723', '#8d8d8d']), c2: '#f5f5f5', L: 0.5, H: 0.25, W: 0.2, neck: 0.15, head: 0.18, tail: 0.9, gait: 9 }),
  jaguar: (r) => quad(r, { c: '#f0b040', c2: '#fff3d0', L: 1.8, H: 0.6, W: 0.65, neck: 0.3, head: 0.4, tail: 0.7, spots: '#3e2723', gait: 7 }),
  rat: (r) => quad(r, { c: '#5a5a5a', c2: '#9e9e9e', L: 0.3, H: 0.08, W: 0.15, neck: 0.06, head: 0.12, tail: 1.5, gait: 14 }),
  tortoise: (r) => { const g = quad(r, { c: '#7a7a5a', c2: '#9a9a7a', L: 1.2, H: 0.25, W: 1.0, neck: 0.4, head: 0.25, tail: 0.1, ears: false, thickLegs: true, gait: 2, tilt: 1.2 }); add(g.userData.parts.body, G.hemi(), '#5a5a3a', 0, 0.55, 0, 0.62, 0.55, 0.72); return g; },
  elephant: (r) => quad(r, { c: '#8a8a8a', c2: '#aaaaaa', L: 3.6, H: 1.4, W: 2, neck: 0.3, head: 0.9, tail: 0.25, bigEars: true, trunk: true, tusks: 0.5, thickLegs: true, gait: 3 }),
  giraffeA: (r) => quad(r, { c: '#e0a050', c2: '#f5e0b0', L: 2, H: 1.8, W: 0.8, neck: 2.2, head: 0.35, tail: 0.4, horns: 0.6, hornC: '#5d4037', spots: '#8a4a20', gait: 4, tilt: 0.3 }),
  pegasus: (r) => { const g = ANIMALS.horse(r); g.traverse((c) => { if (c.isMesh) c.material = MAT('#fafafa'); }); const wings = [-1, 1].map((sx) => { const w = g0(); w.position.set(sx * 0.3, 1.5, 0.2); g.userData.parts.body.add(w); add(w, shapeG('pgw', [[0, 0], [1.4, 0.6], [1.6, 0.1], [1.0, -0.3], [0, -0.2]], 0.04), '#fff8e1', 0, 0, 0, sx, 1, 1, Math.PI / 2); return w; }); const a0 = g.userData.anim; return anim(g, (q, t) => { a0(q, t); wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 5) * 0.5 * (i ? -1 : 1); }); }); },
};
export const BIRD = (r, c = '#37474f', s = 1) => { const g = g0(); add(g, G.sphereLow(), c, 0, 0, 0, 0.15 * s, 0.13 * s, 0.35 * s); add(g, G.cone(), '#ffb300', 0, 0, 0.38 * s, 0.05 * s, 0.14 * s, 0.05 * s, Math.PI / 2); const ws = [-1, 1].map((sx) => add(g, G.box(), c, sx * 0.4 * s, 0, 0, 0.75 * s, 0.03 * s, 0.25 * s)); return anim(g, (q, t) => { ws.forEach((w, i) => { w.rotation.z = Math.sin(t * 7 + q.id) * 0.5 * (i ? -1 : 1); }); }); };
// 하늘을 빙빙 도는 새 (풍경)
export const circling = (r, c, s, R = 8, sp = 0.3) => { const b = BIRD(r, c, s), w = g0(); w.add(b); return anim(w, (q, t) => { b.userData.anim(b, t); const a = t * sp + q.id; b.position.set(Math.cos(a) * R, Math.sin(t * 0.7 + q.id) * 1.2, Math.sin(a) * R); b.rotation.y = -a; b.rotation.z = 0.25; }); };

// ---------- 탈것 ----------
const wheel = (p, x, y, z, R, c = '#5d4037', spokes = true) => { const w = add(p, G.cylLow(), c, x, y, z, R, 0.12, R, 0, 0, Math.PI / 2); if (spokes) for (let i = 0; i < 3; i++) add(p, G.box(), shadeHex(c, 0.7), x, y, z, 0.13, R * 1.9, 0.06, i * 1.05); return w; };
// 짐승이 끄는 수레 · 전차: animal(이름) × n 이 앞에서 끌고, 뒤에 상자(box) + 짐(cargo)
export function cart(r, o = {}) {
  const g = g0(), n = o.n ?? 1, an = [], A = ANIMALS[o.animal || 'ox'];
  for (let i = 0; i < n; i++) { const a = A(r); a.position.set((i - (n - 1) / 2) * (o.gap ?? 0.9), 0, o.az ?? 1.6); g.add(a); an.push(a); }
  const bz = o.bz ?? -0.6, bw = o.bw ?? 1.4, bl = o.bl ?? 1.6;
  add(g, G.box(), o.c || '#8d6e63', 0, 0.8, bz, bw, 0.18, bl); for (const sx of [-1, 1]) add(g, G.box(), shadeHex(o.c || '#8d6e63', 0.85), sx * bw / 2, 1.05, bz, 0.08, 0.4, bl);
  add(g, G.cylLow(), '#5d4037', 0, 0.75, bz + bl / 2 + 0.6, 0.04, 1.4, 0.04, Math.PI / 2);
  const ws = [-1, 1].map((sx) => wheel(g, sx * (bw / 2 + 0.08), o.wr ?? 0.5, bz, o.wr ?? 0.5, o.wc));
  if (o.cargo) CARGO[o.cargo]?.(g, r, bz, bw, bl);
  if (o.rider) { const p = makePerson(o.rider, r); p.position.set(0, 0.9, bz + (o.chariot ? 0.1 : 0.3)); if (!o.chariot) p.scale.setScalar(0.9); g.add(p); g.userData.rider = p; }
  return anim(g, (q, t) => { const w = q.userData.walk ?? t; an.forEach((a, i) => { a.userData.walk = w + i * 0.3; a.userData.anim(a, t); }); ws.forEach((m) => { m.rotation.x = w * 3; }); });
}
const CARGO = {
  pots: (g, r, bz) => { for (let i = 0; i < 4; i++) add(g, latheG('amph', AMPH), '#bf6b3c', (i % 2 ? 0.3 : -0.3), 0.9, bz + (i < 2 ? 0.35 : -0.35), 0.8, 0.8, 0.8); },
  hay: (g, r, bz, bw, bl) => { add(g, G.box(), '#e6c97a', 0, 1.25, bz, bw * 0.9, 0.7, bl * 0.9); },
  crates: (g, r, bz) => { for (let i = 0; i < 3; i++) add(g, G.box(), '#a1887f', (i - 1) * 0.42, 1.12, bz, 0.4, 0.4, 0.4, 0, i * 0.3); },
  stone: (g, r, bz) => { add(g, G.box(), '#d8c8a0', 0, 1.3, bz, 1.2, 0.8, 1.4); },
  sacks: (g, r, bz) => { for (let i = 0; i < 4; i++) add(g, G.sphereLow(), '#c8a878', (i % 2 ? 0.3 : -0.3), 1.1, bz + (i < 2 ? 0.35 : -0.35), 0.3, 0.25, 0.35); },
  books: (g, r, bz) => { for (let i = 0; i < 5; i++) add(g, G.box(), ['#8a2a1a', '#1565c0', '#2e7d32', '#5d4037', '#c9a227'][i], (i - 2) * 0.24, 1.05, bz, 0.2, 0.35, 0.8); },
  flowers: (g, r, bz) => { for (let i = 0; i < 8; i++) add(g, G.sphereLow(), r.pick(['#ff80ab', '#ffeb3b', '#e1bee7', '#ff8a65']), r.range(-0.5, 0.5), 1.05, bz + r.range(-0.6, 0.6), 0.16); },
  cannon: (g, r, bz) => { add(g, G.cylLow(), '#3a3a3a', 0, 1.2, bz + 0.3, 0.2, 1.8, 0.2, Math.PI / 2 - 0.15); },
};
const AMPH = [[0, 0], [0.08, 0.02], [0.16, 0.18], [0.18, 0.35], [0.12, 0.55], [0.07, 0.62], [0.09, 0.7], [0.08, 0.72]];
// 바퀴 넷 자동차 · 트럭 · 버스 (o: body 색 · L 길이 · H 높이 · cab 앞 지붕 · round 둥근 옛 차 · lamps)
export function car(r, o = {}) {
  const g = g0(), L = o.L ?? 4.2, W = o.W ?? 1.7, H = o.H ?? 1.3, c = o.c || r.pick(['#c62828', '#1565c0', '#2e7d32', '#212121', '#fafafa', '#f9a825']);
  add(g, o.round ? G.sphereLow() : G.box(), c, 0, 0.45 + H * 0.25, 0, W * (o.round ? 0.5 : 1), H * (o.round ? 0.28 : 0.5), L * (o.round ? 0.5 : 1));
  add(g, G.box(), o.top || shadeHex(c, 0.9), 0, 0.45 + H * 0.68, -(o.cabZ ?? 0.1) * L, W * 0.88, H * 0.42, L * (o.cabL ?? 0.5));
  add(g, G.box(), glow('#90caf9', 0.85), 0, 0.45 + H * 0.68, -(o.cabZ ?? 0.1) * L + L * (o.cabL ?? 0.5) * 0.5 + 0.01, W * 0.8, H * 0.32, 0.03);
  for (const sx of [-1, 1]) { add(g, G.box(), glow('#90caf9', 0.75), sx * (W * 0.445), 0.45 + H * 0.68, -(o.cabZ ?? 0.1) * L, 0.02, H * 0.3, L * (o.cabL ?? 0.5) * 0.85); add(g, G.sphereLow(), glow('#fff8e1'), sx * W * 0.32, 0.55 + H * 0.2, L / 2, 0.12); }
  const ws = []; for (const sz of [-1, 1]) for (const sx of [-1, 1]) ws.push(wheel(g, sx * W / 2, 0.38, sz * L * 0.33, 0.38, '#212121', false));
  if (o.extra) o.extra(g, L, W, H, c);
  return anim(g, (q, t) => { ws.forEach((m) => { m.rotation.x = (q.userData.walk ?? t) * 6; }); });
}
// 탱크 (궤도 + 포탑 + 포)
export function tank(r, c = '#5b6b3c', ww1 = false) {
  const g = g0();
  if (ww1) { add(g, shapeG('ww1t', [[-2.4, 0], [-2.6, 0.9], [-1.8, 1.6], [1.8, 1.6], [2.6, 0.9], [2.4, 0]], 2.2), c, 0, 0, 0, 1, 1, 1, 0, Math.PI / 2); for (const sx of [-1, 1]) add(g, G.box(), shadeHex(c, 0.8), sx * 1.2, 1.0, 0, 0.5, 0.6, 0.9); add(g, G.box(), shadeHex(c, 0.9), 0, 1.9, 0.2, 1.0, 0.6, 1.2); }
  else { for (const sx of [-1, 1]) { add(g, G.box(), '#3a3a3a', sx * 1.0, 0.45, 0, 0.55, 0.9, 4.2); for (let i = 0; i < 5; i++) add(g, G.cylLow(), '#5a5a5a', sx * 1.0, 0.4, -1.6 + i * 0.8, 0.35, 0.58, 0.35, 0, 0, Math.PI / 2); } add(g, G.box(), c, 0, 1.05, 0, 1.6, 0.6, 3.8); add(g, G.cylLow(), shadeHex(c, 0.9), 0, 1.6, -0.2, 0.75, 0.5, 0.75); add(g, G.cylLow(), shadeHex(c, 0.8), 0, 1.6, 1.4, 0.09, 2.6, 0.09, Math.PI / 2); add(g, G.box(), '#fafafa', 0.81, 1.1, 0, 0.02, 0.35, 0.35); }
  return g;
}
// 배 (o: L 길이 · c 몸 · sail 돛 색 · masts 돛대 수 · oars 노 · prow 뱃머리 장식 · junk 정크선)
export function ship(r, o = {}) {
  const g = g0(), L = o.L ?? 8, W = o.W ?? L * 0.28, c = o.c || '#6d4c41';
  add(g, latheG('hull', [[0, 0], [0.5, 0.15], [0.9, 0.55], [1, 1]], 10), c, 0, 0, 0, W / 2, L * 0.09, L / 2).rotation.x = 0;
  add(g, G.box(), shadeHex(c, 1.15), 0, L * 0.09, 0, W * 0.92, 0.12, L * 0.92);
  const masts = o.masts ?? 1;
  for (let i = 0; i < masts; i++) { const z = masts === 1 ? 0 : (i / (masts - 1) - 0.5) * L * 0.55, h = L * (o.mastH ?? 0.7) * (i === Math.floor(masts / 2) ? 1 : 0.8); add(g, G.cylLow(), '#5d4037', 0, L * 0.09 + h / 2, z, 0.08, h, 0.08); if (o.junk) { for (let k = 0; k < 5; k++) add(g, G.box(), o.sail || '#c62828', 0, L * 0.09 + h * (0.35 + k * 0.12), z, 0.04, h * 0.11, L * 0.22); } else { const s = add(g, G.box(), o.sail || '#f5f0e0', 0, L * 0.09 + h * 0.6, z, 0.06, h * 0.55, L * 0.25); s.userData.sail = true; if (o.stripe) add(g, G.box(), o.stripe, 0.04, L * 0.09 + h * 0.6, z, 0.02, h * 0.15, L * 0.25); } }
  if (o.oars) for (const sx of [-1, 1]) for (let i = 0; i < o.oars; i++) add(g, G.cylLow(), '#8d6e63', sx * W * 0.6, L * 0.06, (i / (o.oars - 1) - 0.5) * L * 0.7, 0.03, W * 0.9, 0.03, 0, 0, sx * 1.1);
  if (o.shields) for (const sx of [-1, 1]) for (let i = 0; i < o.shields; i++) add(g, G.cylLow(), ['#c62828', '#ffca28', '#1565c0'][i % 3], sx * W * 0.47, L * 0.1, (i / (o.shields - 1) - 0.5) * L * 0.6, 0.28, 0.05, 0.28, 0, 0, Math.PI / 2);
  if (o.prow === 'dragon') { add(g, G.cylLow(), c, 0, L * 0.18, L * 0.5, 0.12, L * 0.2, 0.12, 0.4); add(g, G.sphereLow(), '#c62828', 0, L * 0.27, L * 0.56, 0.25, 0.2, 0.35); }
  if (o.cabin) add(g, G.box(), shadeHex(c, 1.25), 0, L * 0.09 + L * 0.06, -L * 0.33, W * 0.8, L * 0.12, L * 0.2);
  return ranim(g, (q, t) => { q.rotation.z = Math.sin(t * 0.8 + q.id) * 0.04; q.position.y = (q.userData.y0 ?? 0) + Math.sin(t * 1.1 + q.id) * 0.1; });
}

// ---------- 건물 ----------
// 집: w 폭 · d 깊이 · h 높이 · wall 벽 · roof 지붕 색 · type: flat 평지붕 · gable 박공 · hip 사방 · dome 돔 · thatch 초가 · tile 기와 · pagoda 탑
export function house(r, o = {}) {
  const g = g0(), w = o.w ?? r.range(3, 5), d = o.d ?? r.range(3, 5), h = o.h ?? r.range(2.4, 3.6), wall = o.wall || '#e0d4bc', roof = o.roof || '#b0522d', fl = o.floors ?? 1;
  add(g, G.box(), wall, 0, h * fl / 2, 0, w, h * fl, d);
  const top = h * fl;
  switch (o.type || 'gable') {
    case 'flat': add(g, G.box(), shadeHex(wall, 0.85), 0, top + 0.1, 0, w + 0.2, 0.2, d + 0.2); if (o.parapet) for (const sx of [-1, 1]) add(g, G.box(), shadeHex(wall, 0.9), sx * w / 2, top + 0.4, 0, 0.2, 0.6, d); break;
    case 'gable': { const pr = add(g, shapeG('gab', [[-0.55, 0], [0, 0.45], [0.55, 0]], 1), roof, 0, top, 0, w * 1.08, w * 0.9, d * 1.08); void pr; break; }
    case 'hip': add(g, G.cone(), roof, 0, top + w * 0.25, 0, Math.max(w, d) * 0.78, w * 0.5, Math.max(w, d) * 0.78).rotation.y = Math.PI / 4; break;
    case 'dome': add(g, G.hemi(), roof, 0, top, 0, Math.min(w, d) * 0.45, Math.min(w, d) * 0.45, Math.min(w, d) * 0.45); break;
    case 'thatch': add(g, G.cone(), roof, 0, top + h * 0.45, 0, Math.max(w, d) * 0.8, h * 0.9, Math.max(w, d) * 0.8); break;
    case 'tile': { add(g, G.box(), roof, 0, top + 0.25, 0, w * 1.25, 0.25, d * 1.25); add(g, shapeG('tile', [[-0.6, 0], [-0.5, 0.06], [0, 0.4], [0.5, 0.06], [0.6, 0]], 1), roof, 0, top + 0.35, 0, w * 1.2, w * 0.7, d * 1.15); add(g, G.box(), shadeHex(roof, 0.8), 0, top + 0.35 + w * 0.28, 0, 0.18, 0.18, d * 1.15); break; }
    case 'pagoda': for (let i = 0; i < (o.tiers ?? 3); i++) { const k = 1 - i * 0.18; add(g, G.box(), wall, 0, top + i * h * 0.8 + h * 0.35, 0, w * k * 0.75, h * 0.7, d * k * 0.75); add(g, shapeG('pag', [[-0.65, 0], [-0.5, 0.08], [0, 0.32], [0.5, 0.08], [0.65, 0]], 1), roof, 0, top + i * h * 0.8 + h * 0.7, 0, w * k * 1.1, w * k * 0.7, d * k * 1.1); } break;
  }
  // 문 · 창
  const door = o.doorC || shadeHex(wall, 0.45);
  add(g, G.box(), door, 0, 0.75, d / 2 + 0.01, Math.min(1.1, w * 0.25), 1.5, 0.05);
  const win = o.winC ? (o.lit ? glow(o.winC) : o.winC) : shadeHex(wall, 0.5);
  for (let f = 0; f < fl; f++) for (const sx of [-1, 1]) { if (f === 0 && Math.abs(sx * w * 0.3) < 0.8) continue; add(g, G.box(), win, sx * w * 0.3, h * f + h * 0.6, d / 2 + 0.01, 0.6, 0.7, 0.05); }
  if (o.awning) add(g, G.box(), o.awning, 0, 2.0, d / 2 + 0.5, w * 0.9, 0.08, 1.0, 0, -0.25);
  return g;
}
// 기둥 신전: cols 앞 기둥 수 · w · d · h · col 기둥 색 · roof · pediment 삼각 지붕 · round 둥근 신전
export function temple(r, o = {}) {
  const g = g0(), w = o.w ?? 10, d = o.d ?? 14, h = o.h ?? 6, col = o.col || '#f2eee4', n = o.cols ?? 6;
  for (let i = 0; i < 3; i++) add(g, G.box(), shadeHex(col, 0.9 - i * 0.03), 0, 0.2 + i * 0.4, 0, w + 2 - i * 0.6, 0.4, d + 2 - i * 0.6);
  const base = 1.2;
  add(g, G.box(), shadeHex(col, 0.85), 0, base + h / 2, 0, w * 0.7, h, d * 0.75);
  const colAt = (x, z) => { add(g, G.cyl(), col, x, base + h / 2, z, 0.36, h, 0.36); add(g, G.box(), col, x, base + h + 0.1, z, 0.9, 0.2, 0.9); add(g, G.box(), col, x, base + 0.1, z, 0.85, 0.2, 0.85); };
  for (let i = 0; i < n; i++) { const x = (i / (n - 1) - 0.5) * w; colAt(x, d / 2); colAt(x, -d / 2); }
  const side = Math.max(2, Math.round(n * d / w)); for (let i = 1; i < side - 1; i++) { const z = (i / (side - 1) - 0.5) * d; colAt(-w / 2, z); colAt(w / 2, z); }
  add(g, G.box(), col, 0, base + h + 0.5, 0, w + 1, 0.8, d + 1);
  if (o.frieze) add(g, G.box(), o.frieze, 0, base + h + 0.5, d / 2 + 0.51, w + 0.9, 0.5, 0.02);
  if (o.pediment !== false) add(g, shapeG('ped', [[-0.5, 0], [0, 0.18], [0.5, 0]], 1), o.roof || col, 0, base + h + 0.9, 0, w + 1.2, w + 1.2, d + 1.1);
  return g;
}
// 계단 피라미드 · 지구라트: steps 층 · w 바닥 폭 · h 층 높이 · c 색 · top 꼭대기 사당
export function stepped(r, o = {}) {
  const g = g0(), n = o.steps ?? 5, w = o.w ?? 20, sh = o.h ?? 2.5, c = o.c || '#c8a070';
  for (let i = 0; i < n; i++) { const k = 1 - i / (n + 0.6); add(g, G.box(), i % 2 ? shadeHex(c, 0.93) : c, 0, sh * i + sh / 2, 0, w * k, sh, w * k); }
  if (o.stair !== false) add(g, G.box(), shadeHex(c, 1.08), 0, sh * n / 2, w * 0.36, w * 0.16, sh * n, w * 0.3, 0).rotation.x = -0.6;
  if (o.top) add(g, G.box(), o.top, 0, sh * n + 1.2, 0, w * 0.2, 2.4, w * 0.2);
  if (o.topRoof) add(g, G.box(), o.topRoof, 0, sh * n + 2.6, 0, w * 0.24, 0.5, w * 0.24);
  return g;
}
// 탑 · 망루 (o: h · r 반지름 · c · roof 원뿔 지붕 색 · crenel 톱니)
export function tower(r, o = {}) {
  const g = g0(), h = o.h ?? 8, R = o.r ?? 1.5, c = o.c || '#bdb5a8';
  add(g, o.square ? G.box() : G.cylLow(), c, 0, h / 2, 0, R * (o.square ? 2 : 1), h, R * (o.square ? 2 : 1));
  if (o.crenel !== false) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(g, G.box(), c, Math.cos(a) * R * 0.9, h + 0.3, Math.sin(a) * R * 0.9, R * 0.5, 0.6, R * 0.5, 0, -a); }
  if (o.roof) add(g, G.cone(), o.roof, 0, h + R * 0.9, 0, R * 1.2, R * 1.8, R * 1.2);
  for (let i = 0; i < Math.floor(h / 3); i++) add(g, G.box(), '#2a2420', 0, 2 + i * 3, R + 0.01, 0.3, 0.8, 0.05);
  return g;
}
// 성벽 한 칸 (톱니 · 망루 사이): L 길이 · h · c
export function wallSeg(r, o = {}) { const g = g0(), L = o.L ?? 16, h = o.h ?? 6, c = o.c || '#bdb5a8', t = o.t ?? 2; add(g, G.box(), c, 0, h / 2, 0, L, h, t); for (let i = 0; i < Math.floor(L / 1.6); i++) add(g, G.box(), c, -L / 2 + 0.8 + i * 1.6, h + 0.35, t * 0.35, 0.8, 0.7, t * 0.3); if (o.towers !== false) for (const sx of [-1, 1]) { const tw = tower(r, { h: h + 2.5, r: t * 0.9, c, square: o.square }); tw.position.x = sx * L / 2; g.add(tw); } return g; }
// 천막 · 게르 (o: c · r · h · stripe)
export function tent(r, o = {}) { const g = g0(), R = o.r ?? 1.6, h = o.h ?? 2.4, c = o.c || '#f5f0e6'; if (o.ger) { add(g, G.cylLow(), c, 0, h * 0.35, 0, R, h * 0.7, R); add(g, G.cone(), o.roof || shadeHex(c, 0.92), 0, h * 0.85, 0, R * 1.05, h * 0.35, R * 1.05); add(g, G.box(), o.door || '#c62828', 0, h * 0.3, R + 0.01, 0.6, h * 0.55, 0.05); for (let i = 0; i < 3; i++) add(g, G.cylLow(), o.band || '#8d2a1c', 0, h * (0.15 + i * 0.22), 0, R + 0.01, 0.06, R + 0.01); } else { add(g, G.cone(), c, 0, h / 2, 0, R, h, R); if (o.stripe) add(g, G.cone(), o.stripe, 0, h * 0.75, 0, R * 0.5, h * 0.5, R * 0.5); add(g, G.box(), shadeHex(c, 0.5), 0, h * 0.25, R * 0.7, 0.6, h * 0.5, 0.05); if (o.flag) { add(g, G.cylLow(), '#5d4037', 0, h + 0.5, 0, 0.03, 1, 0.03); add(g, G.box(), o.flag, 0.3, h + 0.8, 0, 0.6, 0.35, 0.02); } } return g; }
// 깃발 (장대 + 펄럭이는 천)
export function flag(r, o = {}) { const g = g0(), h = o.h ?? 4, c = o.c || '#c62828'; add(g, G.cylLow(), o.pole || '#9e9e9e', 0, h / 2, 0, 0.05, h, 0.05); const f = add(g, G.box(), c, 0.55, h - 0.4, 0, 1.1, 0.7, 0.03); if (o.c2) add(g, G.box(), o.c2, 0.55, h - 0.4, 0.02, o.c2w ?? 0.37, 0.7, 0.01).position.x = o.c2x ?? 0.18; if (o.c3) add(g, G.box(), o.c3, 0.92, h - 0.4, 0.02, 0.37, 0.7, 0.01); if (o.emblem) add(g, G.sphereLow(), o.emblem, 0.55, h - 0.4, 0.03, 0.16, 0.16, 0.02); return anim(g, (q, t) => { f.rotation.y = Math.sin(t * 3 + q.id) * 0.25; }); }

// ---------- 서 있는 장애물 (판정 폭 · 높이에 맞춤) ----------
export const fitRow = (unit, build) => { const g = g0(); g.userData.fit = (o, w, h) => { const k = Math.max(1, Math.round(w / unit)); for (let i = 0; i < k; i++) { const x = -w / 2 + (i + 0.5) * (w / k); build(o, x, w / k, h, i); } }; return g; };
export const fitBar = (build) => { const g = g0(); g.userData.fit = (o, w, h) => build(o, w, h); return g; };
export const posts = (o, w, h, c = '#5d4037') => { for (const sx of [-1, 1]) add(o, G.cylLow(), c, sx * (w / 2 + 0.1), -1.0 + (h + 1) / 2, 0, 0.1, h + 1, 0.1); };
// 벽(wall, 높이 1.4): 단위 모양 종류
export const WALL = {
  brick: (c = '#b07a50') => fitRow(1.2, (o, x, w, h) => { add(o, G.box(), c, x, h / 2, 0, w - 0.04, h, 0.6); for (let k = 0; k < 4; k++) add(o, G.box(), shadeHex(c, 0.8), x, (k + 0.5) * h / 4, 0.31, w - 0.04, 0.03, 0.01); }),
  block: (c = '#d8c8a0') => fitRow(1.4, (o, x, w, h) => { add(o, G.box(), c, x, h / 2, 0, w - 0.08, h, 0.9); add(o, G.box(), shadeHex(c, 1.08), x, h + 0.05, 0, w - 0.06, 0.1, 0.95); }),
  crate: (c = '#a1887f') => fitRow(1.0, (o, x, w, h, i) => { const s = Math.min(w - 0.06, h * 0.55); for (let k = 0; k < 2; k++) { add(o, G.box(), c, x, s / 2 + k * s, 0, s, s, s, 0, (i + k) * 0.1); add(o, G.box(), shadeHex(c, 0.75), x, s / 2 + k * s, s / 2 + 0.01, s * 0.9, 0.06, 0.01, 0, (i + k) * 0.1); } }),
  shields: (c = '#c62828', kind = 'scutum', c2 = '#ffca28') => fitRow(0.75, (o, x, w, h) => { if (kind === 'round') { add(o, G.cylLow(), c, x, h * 0.55, 0, w * 0.5, 0.1, w * 0.5, Math.PI / 2); add(o, G.sphereLow(), c2, x, h * 0.55, 0.08, 0.12); } else if (kind === 'kite') { add(o, shapeG('kite', [[-0.5, 0.6], [0.5, 0.6], [0.4, 0], [0, -0.6], [-0.4, 0]], 0.08), c, x, h * 0.5, 0, w * 0.9, h * 0.8, 1); add(o, G.box(), c2, x, h * 0.55, 0.06, 0.08, h * 0.6, 0.01); } else { add(o, G.box(), c, x, h / 2, 0, w - 0.05, h, 0.12); add(o, G.sphereLow(), c2, x, h / 2, 0.08, 0.1); add(o, G.box(), c2, x, h / 2, 0.065, w * 0.7, 0.05, 0.01); add(o, G.box(), c2, x, h / 2, 0.065, 0.05, h * 0.8, 0.01); } }),
  sandbag: (c = '#b39d77') => fitRow(0.8, (o, x, w, h, i) => { for (let k = 0; k < 4; k++) add(o, G.sphereLow(), shadeHex(c, 0.95 + (k % 2) * 0.08), x + (k % 2 ? 0.1 : -0.1), 0.18 + k * h / 4.2, 0, w * 0.55, h / 7, 0.35); }),
  hedge: (c = '#3f7a3a') => fitRow(1.0, (o, x, w, h) => { add(o, G.box(), c, x, h / 2, 0, w, h, 0.8); for (let k = 0; k < 3; k++) add(o, G.sphereLow(), shadeHex(c, 1.1), x + (k - 1) * w * 0.3, h, 0, w * 0.25, 0.2, 0.4); }),
  books: () => fitRow(1.2, (o, x, w, h, i) => { add(o, G.box(), '#6d4c41', x, h / 2, 0, w - 0.04, h, 0.5); for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) add(o, G.box(), ['#8a2a1a', '#1565c0', '#2e7d32', '#c9a227', '#5d4037'][(i + j + k) % 5], x - w / 2 + 0.15 + j * (w - 0.2) / 5, 0.25 + k * h / 3, 0.2, 0.15, h / 3 - 0.12, 0.1); }),
  server: (c = '#263238', l = '#00e5ff') => fitRow(0.9, (o, x, w, h, i) => { add(o, G.box(), c, x, h / 2, 0, w - 0.06, h, 0.8); for (let k = 0; k < 6; k++) add(o, G.box(), glow(k % 2 ? l : '#76ff03'), x - w * 0.25 + (k % 3) * 0.12, 0.2 + k * h / 6.5, 0.41, 0.06, 0.04, 0.01); }),
  barrel: (c = '#8d6e63') => fitRow(0.8, (o, x, w, h) => { for (let k = 0; k < 2; k++) { add(o, latheG('barrel', [[0.3, 0], [0.36, 0.25], [0.3, 0.5]]), c, x, k * h / 2, 0, w * 1.2, h * 1.0, w * 1.2); add(o, G.cylLow(), '#5a5a5a', x, k * h / 2 + h * 0.12, 0, w * 0.44, 0.04, w * 0.44); } }),
  ice: () => fitRow(1.2, (o, x, w, h) => { add(o, G.box(), toonT('#dceefc', 0.9), x, h / 2, 0, w - 0.05, h, 0.7); }),
  laser: (c = '#ff1744') => fitRow(1.2, (o, x, w, h) => { add(o, G.box(), '#37474f', x - w / 2 + 0.06, h / 2, 0, 0.12, h + 0.2, 0.3); for (let k = 0; k < 4; k++) add(o, G.box(), glow(c), x, 0.2 + k * h / 3.5, 0, w - 0.1, 0.05, 0.05); }),
  candy: () => fitRow(0.75, (o, x, w, h, i) => { add(o, G.cylLow(), ['#ff4081', '#40c4ff', '#ffeb3b'][i % 3], x, h * 0.55, 0, w * 0.48, 0.12, w * 0.48, Math.PI / 2); add(o, G.sphereLow(), glow('#ffffff'), x, h * 0.55, 0.08, 0.12); T(o, '#ffffff', x, h * 0.55, 0.07, w * 0.33, 0.04); }),
  flowers: () => fitRow(0.9, (o, x, w, h) => { add(o, G.box(), '#8d6e63', x, h * 0.25, 0, w - 0.05, h * 0.5, 0.6); for (let k = 0; k < 5; k++) add(o, G.sphereLow(), ['#ff80ab', '#ffeb3b', '#e1bee7', '#ff8a65', '#fff'][k], x + (k - 2) * w * 0.18, h * 0.6 + (k % 2) * 0.2, 0, 0.16); add(o, G.box(), '#4caf50', x, h * 0.55, 0, w - 0.1, 0.15, 0.5); }),
};
// 뛰어넘을 줄(hurdle, 높이 0.6)
export const ROW = {
  pots: (c = '#bf6b3c') => fitRow(0.55, (o, x, w, h) => { add(o, latheG('amph', AMPH), c, x, 0, 0, w * 2.2, h * 1.3, w * 2.2); }),
  logs: (c = '#5d4037') => fitBar((o, w, h) => { add(o, G.cylLow(), c, 0, h * 0.5, 0, h * 0.5, w, h * 0.5, 0, 0, Math.PI / 2); }),
  books: () => fitRow(0.5, (o, x, w, h, i) => { for (let k = 0; k < 3; k++) add(o, G.box(), ['#8a2a1a', '#1565c0', '#2e7d32', '#c9a227'][(i + k) % 4], x, h * (k + 0.5) / 3, 0, w * 0.9, h / 3 - 0.02, 0.45, 0, (k - 1) * 0.15); }),
  barrels: (c = '#8d6e63') => fitRow(0.6, (o, x, w, h) => { add(o, G.cylLow(), c, x, h * 0.5, 0, h * 0.45, w * 0.95, h * 0.45, 0, 0, Math.PI / 2); add(o, G.cylLow(), '#5a5a5a', x, h * 0.5, 0, h * 0.47, 0.05, h * 0.47, 0, 0, Math.PI / 2); }),
  spikes: (c = '#8d6e63', tip = '#cfd8dc') => fitRow(0.5, (o, x, w, h) => { add(o, G.cylLow(), c, x, h * 0.4, 0, 0.04, h * 0.9, 0.04, 0.5); add(o, G.cylLow(), c, x, h * 0.4, 0, 0.04, h * 0.9, 0.04, -0.5); add(o, G.cone(), tip, x, h * 0.85, 0.2, 0.05, 0.15, 0.05, 0.5); }),
  cables: (c = '#212121', l = '#ffeb3b') => fitBar((o, w, h) => { for (let k = 0; k < 3; k++) add(o, G.cylLow(), k === 1 ? l : c, 0, h * 0.3 + k * h * 0.2, (k - 1) * 0.12, 0.07, w, 0.07, 0, 0, Math.PI / 2); add(o, G.box(), '#37474f', 0, h * 0.4, 0, 0.5, h * 0.8, 0.5); }),
  drums: (c = '#c62828') => fitRow(0.6, (o, x, w, h) => { add(o, G.cylLow(), c, x, h * 0.45, 0, w * 0.42, h * 0.9, w * 0.42); add(o, G.cylLow(), '#f5f0e0', x, h * 0.9, 0, w * 0.43, 0.03, w * 0.43); }),
  candles: () => fitRow(0.4, (o, x, w, h) => { add(o, G.cylLow(), '#fff8e1', x, h * 0.35, 0, 0.07, h * 0.7, 0.07); flame(o, x, h * 0.7, 0, 0.25); liven(o); }),
  crates: (c = '#a1887f') => fitRow(0.7, (o, x, w, h, i) => { add(o, G.box(), c, x, h * 0.45, 0, w * 0.85, h * 0.9, 0.6, 0, i * 0.2); }),
  sacks: (c = '#c8a878') => fitRow(0.6, (o, x, w, h) => { add(o, G.sphereLow(), c, x, h * 0.4, 0, w * 0.5, h * 0.5, 0.35); }),
  stones: (c = '#8a8070') => fitRow(0.7, (o, x, w, h, i) => { Rock(o, c, x, h * 0.45, 0, w * 0.45, h * 0.5, 0.35, i); }),
  barbed: () => fitBar((o, w, h) => { for (let i = 0; i < Math.round(w / 1.2) + 1; i++) { const x = -w / 2 + i * w / Math.round(w / 1.2); add(o, G.cylLow(), '#5d4037', x, h / 2, 0, 0.04, h, 0.04, 0.4); add(o, G.cylLow(), '#5d4037', x, h / 2, 0, 0.04, h, 0.04, -0.4); } for (let k = 0; k < 2; k++) add(o, G.cylLow(), '#9e9e9e', 0, h * (0.4 + k * 0.4), 0, 0.015, w, 0.015, 0, 0, Math.PI / 2); }),
  hedgehog: () => fitRow(0.9, (o, x, w, h) => { for (let k = 0; k < 3; k++) add(o, G.box(), '#5a5a5a', x, h * 0.45, 0, 0.08, h * 1.1, 0.08, k * 1.05, k * 0.6, 0.6); }),
  planters: () => fitRow(0.8, (o, x, w, h) => { add(o, G.box(), '#bcaaa4', x, h * 0.3, 0, w * 0.85, h * 0.6, 0.5); for (let k = 0; k < 3; k++) add(o, G.sphereLow(), ['#ff80ab', '#ffeb3b', '#e1bee7'][k], x + (k - 1) * w * 0.25, h * 0.75, 0, 0.13); }),
  cones: () => fitRow(0.7, (o, x, w, h) => { add(o, G.cone(), '#ff6d00', x, h / 2, 0, 0.22, h, 0.22); add(o, G.cylLow(), glow('#ffffff'), x, h * 0.55, 0, 0.15, 0.08, 0.15); }),
  icons: () => fitRow(0.6, (o, x, w, h, i) => { add(o, G.box(), ['#ff4081', '#40c4ff', '#ffeb3b', '#69f0ae'][i % 4], x, h * 0.5, 0, w * 0.8, h * 0.8, 0.15); add(o, G.box(), glow('#ffffff'), x, h * 0.5, 0.08, w * 0.35, h * 0.35, 0.01); }),
  bots: () => fitRow(0.9, (o, x, w, h, i) => { add(o, G.box(), '#5a5a62', x, h * 0.3, 0, w * 0.7, h * 0.5, 0.5, 0, i * 0.5); add(o, G.sphereLow(), glow('#ff1744', 0.8), x, h * 0.6, 0.1, 0.1); add(o, G.cylLow(), '#3a3a42', x + 0.2, h * 0.3, 0, 0.05, 0.5, 0.05, 0, 0, 1); }),
};
// 숙여 지날 가로대(bar, y 1.0 ~ 2.2): 천 · 깃발 · 들보 · 빛
export const BAR = {
  banner: (c = '#c62828', c2 = '#ffca28', pole = '#5d4037') => fitBar((o, w, h) => { add(o, G.cylLow(), pole, 0, h, 0, 0.06, w + 0.4, 0.06, 0, 0, Math.PI / 2); const n = Math.max(2, Math.round(w / 1.3)); for (let i = 0; i < n; i++) { const x = (i / (n - 1) - 0.5) * (w - 0.8); add(o, G.box(), c, x, h * 0.45, 0, w / n * 0.8, h * 0.9, 0.03); add(o, G.box(), c2, x, h * 0.45, 0.02, w / n * 0.5, 0.12, 0.01); } posts(o, w, h, pole); }),
  cloth: (cols = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fafafa']) => fitBar((o, w, h) => { add(o, G.cylLow(), '#8d6e63', 0, h, 0, 0.02, w + 0.4, 0.02, 0, 0, Math.PI / 2); const n = Math.max(3, Math.round(w / 0.8)); for (let i = 0; i < n; i++) add(o, G.box(), cols[i % cols.length], (i / (n - 1) - 0.5) * (w - 0.5), h * 0.55, 0, 0.6, h * 0.8, 0.02); posts(o, w, h, '#8d6e63'); }),
  beam: (c = '#5d4037', fire = false) => fitBar((o, w, h) => { add(o, G.box(), c, 0, h / 2, 0, w + 0.6, h * 0.7, 0.45); if (fire) { for (let i = 0; i < Math.round(w / 1.5); i++) flame(o, -w / 2 + 0.75 + i * 1.5, h * 0.8, 0, 0.6); liven(o); } posts(o, w, h, shadeHex(c, 0.8)); }),
  laser: (c = '#ff1744') => fitBar((o, w, h) => { add(o, G.box(), glow(c), 0, h / 2, 0, w, h * 0.25, 0.12); add(o, G.box(), glow(c, 0.35), 0, h / 2, 0, w, h * 0.7, 0.3); for (const sx of [-1, 1]) add(o, G.box(), '#37474f', sx * (w / 2 + 0.15), -1 + (h + 1) / 2, 0, 0.3, h + 1, 0.3); }),
  garland: (c = '#43a047', f = '#ff80ab') => fitBar((o, w, h) => { for (let i = 0; i <= 12; i++) { const k = i / 12, x = (k - 0.5) * w; add(o, G.sphereLow(), c, x, h * (0.7 - Math.sin(k * Math.PI) * 0.35), 0, 0.22); if (i % 2) add(o, G.sphereLow(), f, x, h * (0.7 - Math.sin(k * Math.PI) * 0.35) - 0.15, 0.1, 0.12); } posts(o, w, h, '#8d6e63'); }),
  arch: (c = '#f2eee4') => fitBar((o, w, h) => { add(o, G.box(), c, 0, h * 0.65, 0, w + 1, h * 0.7, 0.6); for (const sx of [-1, 1]) add(o, G.box(), c, sx * (w / 2 + 0.3), -1 + (h + 1) / 2, 0, 0.6, h + 1, 0.6); }),
  lanterns: (c = '#c62828') => fitBar((o, w, h) => { add(o, G.cylLow(), '#3e2723', 0, h, 0, 0.03, w + 0.4, 0.03, 0, 0, Math.PI / 2); const n = Math.max(3, Math.round(w / 0.9)); for (let i = 0; i < n; i++) { const x = (i / (n - 1) - 0.5) * (w - 0.4); add(o, G.sphereLow(), glow(c), x, h * 0.55, 0, 0.28, 0.38, 0.28); add(o, G.cylLow(), '#ffca28', x, h * 0.25, 0, 0.03, 0.2, 0.03); } posts(o, w, h, '#3e2723'); }),
};

// ---------- 소품 · 장면 ----------
export const amphora = (c = '#bf6b3c', s = 1.6) => { const g = g0(); add(g, latheG('amph', AMPH), c, 0, 0, 0, s, s, s); for (const sx of [-1, 1]) add(g, new THREE.TorusGeometry(0.06 * s, 0.015 * s, 4, 8, Math.PI), c, sx * 0.1 * s, 0.6 * s, 0, 1, 1, 1, 0, 0, sx * Math.PI / 2); return g; };
export const crowd = (r, names, n, R = 2.5) => { const g = g0(); for (let i = 0; i < n; i++) { const p = still(makePerson(r.pick(names), r)); p.position.set(r.range(-R, R), 0, r.range(-R, R)); p.rotation.y = r.range(0, 6.28); g.add(p); } return g; };
// 환호하는 무리 (팔을 흔든다)
export const cheering = (r, names, n, R = 2.5) => { const g = g0(), ps = []; for (let i = 0; i < n; i++) { const p = makePerson(r.pick(names), r); p.position.set(r.range(-R, R), 0, r.range(-R, R)); p.rotation.y = r.range(-0.6, 0.6); g.add(p); ps.push(p); } return anim(g, (q, t) => ps.forEach((p, i) => { const k = Math.sin(t * 4 + i); p.userData.parts.armR.rotation.x = -2.6 + k * 0.4; p.userData.parts.armL.rotation.x = -2.4 - k * 0.4; p.userData.parts.body.position.y = Math.max(0, k) * 0.12; })); };
// 둘이 맞붙어 싸운다 (휘두르기 · 막기)
export const duel = (r, a, b) => { const g = g0(), A = makePerson(a, r), Bq = makePerson(b, r); A.position.x = -0.75; Bq.position.x = 0.75; A.rotation.y = Math.PI / 2; Bq.rotation.y = -Math.PI / 2; g.add(A, Bq); return anim(g, (q, t) => { const k = Math.sin(t * 3.2 + q.id); A.userData.parts.armR.rotation.x = -1.4 + k * 1.0; Bq.userData.parts.armR.rotation.x = -1.4 - k * 1.0; A.userData.parts.armL.rotation.x = -0.9; Bq.userData.parts.armL.rotation.x = -0.9; A.position.x = -0.75 + Math.max(0, k) * 0.2; Bq.position.x = 0.75 + Math.min(0, k) * 0.2; A.userData.parts.body.rotation.z = k * 0.08; Bq.userData.parts.body.rotation.z = -k * 0.08; }); };
// 줄지어 행진 (제자리에서 발맞춤 · 앞뒤로 조금)
export const march = (r, name, rows = 2, cols = 3, gap = 1.1) => { const g = g0(), ps = []; for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const p = makePerson(name, r); p.position.set((j - (cols - 1) / 2) * gap, 0, (i - (rows - 1) / 2) * gap); g.add(p); ps.push(p); } return anim(g, (q, t) => ps.forEach((p) => { p.userData.walk = t * 0.8; p.userData.anim(p, t); })); };
// 일하는 사람: 소품(prop) 옆에서 팔을 움직인다
export const atWork = (r, name, prop, arm = 'armR') => { const g = g0(), p = makePerson(name, r); g.add(p); if (prop) { prop.position.set(0, 0, 1.0); g.add(prop); } return anim(g, (q, t) => { p.userData.parts[arm].rotation.x = -1.3 + Math.sin(t * 3 + q.id) * 0.5; p.userData.parts.head.rotation.x = 0.2; prop?.userData.anim?.(prop, t); }); };
export { add, B, C, S, Sh, K, T, hemi, Oct, Rock, glow, G, flame, smoke, liven, person, quad, shadeHex, latheG, shapeG, dotsInst, THREE, AMPH };
