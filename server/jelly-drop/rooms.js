// 젤리배그 방: 최대 30명(사람 + 젤리봇으로 채우기) · 젤리 비행선에서 뛰어내려 · 줍고 · 싸우고 · 줄어드는 젤리 자기장 · 마지막 한 명
//   아이템 · 가방 · 피해(방어구) · 회복 · 자기장 피해 · 순위는 서버가 정한다. 움직임은 각자 화면이 보내고, 맞힘은 서버가 벽 · 거리 · 연사로 확인
import { BaseRooms } from '../shared/rooms.js';
import { getBgMap, BG_MAPS, BG_SIZE } from '../../public/jelly-bg/js/bgmap.js';
import { clearLine } from '../../public/jelly-attack/js/maps.js';
import { weapon, NADE, nadeDmg, KNIFE, falloff } from '../../public/jelly-attack/js/weapons.js';
import { ARMOR_CUT, HEALS, DROP, makeLoot, makeZones, zoneAt, makePlane, planeAt, emptyInv, rollItem, AMMO, AMMO_OF, ATTS, fits, CAP, BOOSTS, ammoTotal, makeVehicles, VEHICLES, THROWS, throwCount, rollCrate, inWater } from '../../public/jelly-bg/js/bgrules.js';
import { rng } from '../../public/jelly-apple/js/board.js';

const EYE = 1.55, MAX = 30;
const BOT_NAMES = ['딸기', '소다', '푸딩', '망고', '민트', '라임', '자두', '복숭아', '포도', '레몬', '체리', '키위', '바닐라', '초코', '멜론', '유자', '코코넛', '블루베리', '귤', '수박', '자몽', '카라멜', '마카롱', '솜사탕', '모찌', '쿠키', '와플', '팝콘', '젤리빈'];
const BOT_COLORS = ['#ff8fb1', '#7cd8ff', '#ffd27a', '#ffb36b', '#9be7a7', '#c39bff', '#ff7a7a', '#ffc2d1', '#b39ddb', '#fff176', '#ef5350', '#aed581'];
const BOT_GUNS = ['m4', 'ak47', 'rifle', 'mp5', 'uzi', 'scar', 'shotgun', 'sniper', 'plasma_smg', 'hunting_rifle'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const REVIVE_MS = 8000, RED_R = 26;
// 같은 분대인가 (혼자 하기면 자기만)
const mates = (a, b) => a === b || (a.sq != null && a.sq === b.sq);

export class BgRooms extends BaseRooms {
  constructor(userOf) {
    super(userOf, { max: MAX, hz: 15, countdown: 3000, defaults: { fill: 24, map: 'random', squad: 1 } });
    this.navs = new Map();
  }
  allow(cur, n) { return { fill: Number.isFinite(Number(n.fill)) ? Math.max(2, Math.min(MAX, Math.round(Number(n.fill)))) : cur.fill, map: n.map === 'random' || BG_MAPS.some((m) => m.id === n.map) ? n.map : cur.map || 'random', squad: [1, 2, 4].includes(Number(n.squad)) ? Number(n.squad) : cur.squad || 1 }; }
  list() { return [...this.rooms.values()].filter((r) => !r.private).map((r) => this.roomInfo(r)); }
  handle(c, m) {
    if (m.t === 'practice') {
      if (!c.hi) return;
      this.leave(c);
      const r = { id: this.newCode(), name: `${c.name}의 연습`, players: [], host: c, state: 'wait', startAt: 0, private: true, opts: this.allow({ ...this.o.defaults }, m.opts || {}) };
      this.rooms.set(r.id, r); this.join(c, r);
      return super.handle(c, { t: 'start' });
    }
    return super.handle(c, m);
  }
  // ---------- 시작 ----------
  onStart(r) {
    const seed = r.seed;
    // 맵: 고른 맵 (무작위면 씨앗으로)
    const mid = r.opts.map && r.opts.map !== 'random' ? r.opts.map : BG_MAPS[seed % BG_MAPS.length].id;
    r.map = getBgMap(mid);
    r.loot = new Map(makeLoot(r.map, seed).map((it) => [it.id, it]));
    r.nextLoot = 100000;
    r.zones = makeZones(seed); r.plane = makePlane(seed);
    r.veh = makeVehicles(seed, r.map); r.smokes = []; r.vehAt = 0; r.fires = []; r.red = null; r.redNext = 150; r.drops = []; r.dropNext = [140, 320, 500]; r.dropId = 1; r.sqAt = 0;
    r.t0 = r.startAt; r.lastZone = 0; r.ended = false;
    const R = rng(seed ^ 0x77);
    let bi = 0;
    while (r.players.length < Math.min(MAX, Math.max(r.opts.fill, r.players.length))) {
      r.players.push({ id: this.nextPid++, bot: true, name: `젤리봇 ${BOT_NAMES[bi % BOT_NAMES.length]}`, color: BOT_COLORS[bi % BOT_COLORS.length], look: null, acc: [], team: null, skill: 0.5 + R() * 0.4, jumpK: 0.12 + R() * 0.75 });
      bi++;
    }
    for (const p of r.players) {
      p.hp = 100; p.alive = true; p.inv = emptyInv(); p.boost = 0; p.boostAcc = 0; p.veh = 0; p.k = 0; p.dmg = 0; p.place = 0; p.jumped = false; p.landed = false; p.lastFire = {}; p.healAt = 0;
      p.pos = { x: r.plane.a[0], y: r.plane.h, z: r.plane.a[1] }; p.st = null;
      if (p.bot) { p.path = null; p.target = null; p.react = 0; p.fireT = 0; p.lootT = 0; p.goal = null; p.scanT = 0; }
    }
    // 분대: 사람끼리 먼저 (같은 방 친구가 한 팀) · 남는 자리는 봇
    const size = r.opts.squad || 1;
    r.players.forEach((p, i) => { p.sq = Math.floor(i / size) + 1; p.knocked = false; p.knockN = 0; p.reviving = null; p.blind = 0; });
    r.alive = r.players.length; r.squadsLeft = new Set(r.players.map((p) => p.sq)).size;
    return { map: r.map.id, zones: r.zones, plane: r.plane, loot: [...r.loot.values()], total: r.players.length, veh: r.veh, squad: size, sq: Object.fromEntries(r.players.map((p) => [p.id, p.sq])), squads: r.squadsLeft };
  }
  // 봇의 눈: 벽 · 연막에 가리면 못 본다
  see(r, a, b) {
    if (!clearLine(r.map, a, b)) return false;
    for (const s of r.smokes) { const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.z - a.z) * dz) / L2)); if ((a.x + dx * t - s.x) ** 2 + (a.z + dz * t - s.z) ** 2 < 5.5 * 5.5) return false; }
    return true;
  }
  sec(r, now = Date.now()) { return (now - r.t0) / 1000; }
  // ---------- 메시지 ----------
  onMessage(c, m, r) {
    if (r.state !== 'run' || Date.now() < r.startAt || !c.alive) return;
    const now = Date.now();
    if (m.t === 'jump') { if (!c.jumped) { c.jumped = true; this.toRoom(r, { t: 'jumped', id: c.id }); } return; }
    if (c.knocked) return;
    if (m.t === 'revive') return this.startRevive(r, c, +m.id, now);
    if (m.t === 'revive-stop') { if (c.reviving) this.stopRevive(r, c); return; }
    if (m.t === 'molotov' || m.t === 'flash' || m.t === 'flare') return this.special(r, c, m, now);
    if (m.t === 'refuel') { const v = r.veh.find((x) => x.id === c.veh && x.driver === c.id); if (!v || c.inv.gas <= 0) return; c.inv.gas--; v.fuel = Math.min(100, (v.fuel ?? 0) + 60); this.send(c, { t: 'inv', inv: c.inv }); this.vehUpdate(r); return; }
    if (m.t === 'pick') return this.pick(r, c, +m.id, +m.slot);
    if (m.t === 'heal') {
      // 붕대 · 구급상자 = 바로 회복 · 에너지 음료 · 진통제 = 부스트 (조금씩 회복 + 빨라짐)
      const B = BOOSTS[m.k];
      if (B) { if (c.inv[m.k] <= 0 || now - c.healAt < B.sec * 900) return; c.healAt = now; c.inv[m.k]--; c.boost = Math.min(100, c.boost + B.add); this.send(c, { t: 'boost', v: Math.round(c.boost) }); this.send(c, { t: 'inv', inv: c.inv }); return; }
      const H = HEALS[m.k]; if (!H || c.inv[m.k] <= 0 || now - c.healAt < H.sec * 900 || c.hp >= H.cap) return;
      c.healAt = now; c.inv[m.k]--; c.hp = Math.min(H.cap, c.hp + H.hp);
      this.send(c, { t: 'hp', hp: Math.round(c.hp) }); this.send(c, { t: 'inv', inv: c.inv });
      return;
    }
    // 장전: 가방의 탄을 꺼내 쓴다
    if (m.t === 'rl') { const w = weapon(String(m.w || '')), a = w && AMMO_OF[w.id], n = Math.max(0, Math.min(200, Math.round(Number(m.n) || 0))); if (!a || !this.has(c, w.id)) return; c.inv.ammo[a] = Math.max(0, (c.inv.ammo[a] || 0) - n); this.send(c, { t: 'inv', inv: c.inv }); return; }
    if (m.t === 'drop') return this.dropItem(r, c, m);
    if (m.t === 'smoke') {
      if (!Array.isArray(m.p) || c.inv.smoke <= 0) return;
      const p = { x: +m.p[0], z: +m.p[2] }; if (![p.x, p.z].every(Number.isFinite)) return;
      c.inv.smoke--; this.send(c, { t: 'inv', inv: c.inv });
      r.smokes.push({ x: p.x, z: p.z, until: now + 19000 });
      this.toRoom(r, { t: 'smoke', p: [p.x, +m.p[1] || 0, p.z] });
      return;
    }
    if (m.t === 'enter') {
      const v = r.veh.find((x) => x.id === +m.id);
      if (!v || v.dead || v.driver || c.veh || !c.pos || Math.hypot(v.x - c.pos.x, v.z - c.pos.z) > 4.5) return;
      if (VEHICLES[v.kind].water !== inWater(r.map, v.x, v.z, -1) && v.kind === 'boat') return;
      v.driver = c.id; c.veh = v.id; this.vehUpdate(r); return;
    }
    if (m.t === 'exit') { const v = r.veh.find((x) => x.id === c.veh); if (v) { v.driver = 0; if (Array.isArray(m.v)) { const [x, y, z, yaw] = m.v.map(Number); if ([x, y, z, yaw].every(Number.isFinite)) Object.assign(v, { x, y, z, yaw }); } } c.veh = 0; this.vehUpdate(r); return; }
    if (m.t === 'vhit') {
      // 차를 쏘면 차 체력이 줄고 0 이면 폭발 (안에 있던 사람도 크게 다친다)
      const v = r.veh.find((x) => x.id === +m.id); if (!v || v.dead || now - (c.firedAt || 0) > 600) return;
      v.hp -= Math.max(0, Math.min(120, Number(m.dmg) || 0));
      if (v.hp <= 0) this.wreck(r, v, c); else this.vehUpdate(r);
      return;
    }
    if (m.t === 'fire') {
      const w = weapon(String(m.w || ''));
      if (!w || !this.has(c, w.id) || !Array.isArray(m.o) || !Array.isArray(m.d)) return;
      if (now - (c.lastFire[w.id] || 0) < w.rate * 1000 * 0.7) return;
      c.lastFire[w.id] = now; c.firedAt = now;
      const att = c.inv.pistol === w.id ? c.inv.patt : c.inv.att[c.inv.guns.indexOf(w.id)] || {};
      this.toRoom(r, { t: 'fire', by: c.id, w: w.id, o: m.o.slice(0, 3).map(Number), d: m.d.slice(0, 3).map(Number), s: att.muzzle === 'supp' ? 1 : 0 }, c);
      return;
    }
    if (m.t === 'wpn') { const w = String(m.w || ''); if (weapon(w) && this.has(c, w)) this.toRoom(r, { t: 'wpn', id: c.id, w }, c); return; }
    if (m.t === 'hit') {
      const w = weapon(String(m.w || '')), tgt = r.players.find((p) => p.id === +m.to);
      if (m.w === 'car') {
        // 차로 치기: 운전 중이어야 하고 차 가까이 · 빠르기만큼 아프다
        const v = r.veh.find((x) => x.id === c.veh && x.driver === c.id); if (!v || !tgt || !tgt.alive || tgt === c || mates(c, tgt) || !tgt.pos || Math.hypot(tgt.pos.x - v.x, tgt.pos.z - v.z) > 5) return;
        if (now - (tgt.runAt || 0) < 700) return; tgt.runAt = now;
        return this.damage(r, tgt, Math.max(12, Math.min(110, (Number(m.n) || 0) * 4.5)), c, 'car', false);
      }
      if (!w || !tgt || !tgt.alive || tgt === c || !c.st || !this.has(c, w.id)) return;
      if (w.cls !== 'knife' && now - (c.firedAt || 0) > 600) return;
      if (w.cls === 'knife') { if (now - (c.lastFire.knife || 0) < w.rate * 700) return; c.lastFire.knife = now; }
      const a = { x: c.st[0], y: c.st[1] + EYE, z: c.st[2] }, b = { x: tgt.pos.x, y: tgt.pos.y + 1.1, z: tgt.pos.z };
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d > (w.cls === 'knife' ? 3.5 : w.range * 2.2 + 8)) return;
      if (![1.6, 1.1, 0.5, 0.25].some((h) => clearLine(r.map, a, { ...b, y: tgt.pos.y + h }))) return;
      if (mates(c, tgt)) return;
      const n = Math.max(1, Math.min(w.pellets || 1, Number(m.n) || 1)), head = m.part === 'head';
      const dmg = w.cls === 'knife' ? (m.back ? w.back : w.dmg) : w.dmg * n * (head ? w.head : 1) * falloff(w, d);
      this.damage(r, tgt, dmg, c, w.id, head);
      return;
    }
    if (m.t === 'nade') {
      if (!Array.isArray(m.p) || c.inv.nade <= 0) return;
      c.inv.nade--; this.send(c, { t: 'inv', inv: c.inv });
      const p = { x: +m.p[0], y: +m.p[1] + 0.3, z: +m.p[2] };
      if (![p.x, p.y, p.z].every(Number.isFinite)) return;
      this.toRoom(r, { t: 'boom', p: [p.x, p.y, p.z], by: c.id });
      for (const t of r.players) {
        if (!t.alive || !t.pos) continue;
        const q = { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z }, dd = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
        if (dd > NADE.r || !clearLine(r.map, p, q)) continue;
        if (t !== c && mates(c, t)) continue;
        this.damage(r, t, nadeDmg(dd) * (t === c ? 0.5 : 1), c, 'nade', false);
      }
    }
  }
  has(c, id) { return id === 'knife' || c.inv.guns.includes(id) || c.inv.pistol === id; }
  // 줍기: 가까이 있는 것만 · 총은 빈 칸(없으면 지금 칸)과 바꿔 내려놓는다 · 방어구 · 가방은 더 좋으면 바꾼다 · 가방 용량 안에서만
  pick(r, c, id, slot) {
    const it = r.loot.get(id); if (!it || !c.pos) return;
    if (Math.hypot(it.x - c.pos.x, it.z - c.pos.z) > 3.2 || Math.abs(it.y - c.pos.y) > 2.5) return;
    const inv = c.inv, drop = [], bag = inv.bag, full = (msg) => this.send(c, { t: 'full', text: msg });
    let rest = null; // 일부만 주운 탄약은 남은 만큼 다시 놓는다
    if (it.k === 'gun') {
      let i = inv.guns.indexOf(null); if (i < 0) i = slot === 1 ? 1 : 0;
      if (inv.guns[i]) { drop.push({ k: 'gun', w: inv.guns[i] }); for (const a of Object.values(inv.att[i])) inv.spare.push(a); }
      inv.guns[i] = it.w; inv.att[i] = {}; this.fitSpare(inv);
    } else if (it.k === 'pistol') { if (inv.pistol) { drop.push({ k: 'pistol', w: inv.pistol }); for (const a of Object.values(inv.patt)) inv.spare.push(a); } inv.pistol = it.w; inv.patt = {}; this.fitSpare(inv); }
    else if (it.k === 'armor' || it.k === 'helmet') { if (inv[it.k] >= it.lv && inv[it.k + 'D'] > 30) return full('이미 더 좋은 걸 입고 있어요'); if (inv[it.k]) drop.push({ k: it.k, lv: inv[it.k] }); inv[it.k] = it.lv; inv[it.k + 'D'] = 100; }
    else if (it.k === 'bag') { if (inv.bag >= it.lv) return full('이미 더 큰 가방이 있어요'); if (inv.bag) drop.push({ k: 'bag', lv: inv.bag }); inv.bag = it.lv; }
    else if (it.k === 'ammo') {
      const room = CAP.ammo[bag] - ammoTotal(inv); if (room <= 0) return full('🎒 가방이 꽉 찼어요 (탄약)');
      const take = Math.min(room, it.n); inv.ammo[it.a] = (inv.ammo[it.a] || 0) + take; if (take < it.n) rest = { k: 'ammo', a: it.a, n: it.n - take };
    } else if (it.k === 'att') {
      // 맞는 총에 바로 끼운다 (빈자리 먼저) · 없으면 가방에
      if (inv.spare.length >= 6 + bag * 2) return full('🎒 가방이 꽉 찼어요 (부착물)');
      inv.spare.push(it.a); this.fitSpare(inv);
    } else if (it.k === 'band') { const room = CAP.band[bag] - inv.band; if (room <= 0) return full('🎒 붕대를 더 못 넣어요'); const take = Math.min(room, it.n || 1); inv.band += take; if (take < (it.n || 1)) rest = { k: 'band', n: (it.n || 1) - take }; }
    else if (it.k === 'med') { if (inv.med >= CAP.med[bag]) return full('🎒 구급상자를 더 못 넣어요'); inv.med++; }
    else if (it.k === 'drink' || it.k === 'pill' || it.k === 'adren') { if (inv.drink + inv.pill + inv.adren >= CAP.boost[bag]) return full('🎒 부스트 아이템을 더 못 넣어요'); inv[it.k]++; }
    else if (['nade', 'smoke', 'molotov', 'flash'].includes(it.k)) { if (throwCount(inv) >= CAP.throw[bag]) return full('🎒 투척 무기를 더 못 넣어요'); inv[it.k]++; }
    else if (it.k === 'flare') { if (inv.flare >= 2) return full('🎆 신호탄 총은 2개까지'); inv.flare++; }
    else if (it.k === 'gas') { if (inv.gas >= CAP.gas[bag]) return full('🎒 기름통을 더 못 넣어요'); inv.gas++; }
    r.loot.delete(id);
    const add = [];
    if (rest) drop.push(rest);
    for (const d of drop) { const n = { id: r.nextLoot++, ...d, x: d === rest ? it.x : c.pos.x + (Math.random() - 0.5), y: d === rest ? it.y : c.pos.y + 0.05, z: d === rest ? it.z : c.pos.z + (Math.random() - 0.5) }; r.loot.set(n.id, n); add.push(n); }
    this.toRoom(r, { t: 'loot', rm: [id], add });
    this.send(c, { t: 'inv', inv });
    if (['armor', 'helmet', 'bag'].includes(it.k)) this.gear(r, c);
  }
  // 가방 속 부착물을 맞는 총의 빈자리에 끼운다 (더 좋은 스코프면 바꾼다)
  fitSpare(inv) {
    const rankScope = { red: 1, x2: 2, x4: 3, x8: 4 };
    const guns = [[inv.guns[0], inv.att[0]], [inv.guns[1], inv.att[1]], [inv.pistol, inv.patt]];
    for (let k = inv.spare.length - 1; k >= 0; k--) {
      const a = inv.spare[k], A = ATTS[a];
      for (const [g, att] of guns) {
        const w = g && weapon(g); if (!w || !fits(a, w)) continue;
        if (!att[A.slot]) { att[A.slot] = a; inv.spare.splice(k, 1); break; }
        if (A.slot === 'scope' && rankScope[a] > rankScope[att.scope] && w.cls === 'sniper') { inv.spare[k] = att.scope; att.scope = a; break; }
      }
    }
  }
  dropItem(r, c, m) {
    const inv = c.inv, P = c.pos; if (!P || !c.alive) return;
    let d = null;
    if (m.k === 'ammo' && inv.ammo[m.a] > 0) { d = { k: 'ammo', a: m.a, n: inv.ammo[m.a] }; inv.ammo[m.a] = 0; }
    else if (['band', 'med', 'drink', 'pill', 'adren', 'nade', 'smoke', 'molotov', 'flash', 'flare', 'gas'].includes(m.k) && inv[m.k] > 0) { const n = m.k === 'band' ? inv.band : 1; d = { k: m.k, n }; inv[m.k] -= n; }
    else if (m.k === 'att') { const i = inv.spare.indexOf(m.a); if (i < 0) return; inv.spare.splice(i, 1); d = { k: 'att', a: m.a }; }
    else if (m.k === 'detach') { const att = m.g === 2 ? inv.patt : inv.att[m.g | 0]; if (!att?.[m.slot]) return; inv.spare.push(att[m.slot]); delete att[m.slot]; }
    else if (m.k === 'gun' && inv.guns[m.g | 0]) { const g = m.g | 0; d = { k: 'gun', w: inv.guns[g] }; for (const a of Object.values(inv.att[g])) inv.spare.push(a); inv.guns[g] = null; inv.att[g] = {}; }
    else if (m.k === 'pistol' && inv.pistol) { d = { k: 'pistol', w: inv.pistol }; for (const a of Object.values(inv.patt)) inv.spare.push(a); inv.pistol = null; inv.patt = {}; }
    else return;
    if (d) { const n = { id: r.nextLoot++, ...d, x: P.x + (Math.random() - 0.5), y: Math.max(0.05, P.y + 0.05), z: P.z + (Math.random() - 0.5) }; r.loot.set(n.id, n); this.toRoom(r, { t: 'loot', rm: [], add: [n] }); }
    this.send(c, { t: 'inv', inv });
  }
  gear(r, c) { this.toRoom(r, { t: 'gear', id: c.id, a: c.inv.armor, h: c.inv.helmet, b: c.inv.bag }); }
  vehUpdate(r) { r.vehAt = Date.now(); this.toRoom(r, { t: 'veh', v: r.veh.map((v) => [v.id, v.kind, +v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2), +v.yaw.toFixed(3), Math.max(0, Math.round(v.hp)), v.driver, v.dead ? 1 : 0, Math.round(v.fuel ?? 100)]) }); }
  wreck(r, v, by) {
    v.dead = true; v.hp = 0;
    this.toRoom(r, { t: 'boom', p: [v.x, v.y + 0.8, v.z], by: by?.id || 0, car: 1 });
    for (const t of r.players) {
      if (!t.alive || !t.pos) continue;
      const d = t.veh === v.id ? 0 : Math.hypot(t.pos.x - v.x, t.pos.z - v.z);
      if (d < 7) this.damage(r, t, t.veh === v.id ? 90 : nadeDmg(d) * 0.8, by, 'car', false);
      if (t.veh === v.id) t.veh = 0;
    }
    v.driver = 0; this.vehUpdate(r);
  }
  damage(r, t, dmg, by, w, head) {
    if (!t.alive || dmg <= 0) return;
    if (by && by !== t && mates(by, t)) return;
    if (t.knocked) {
      // 기절한 사람: 기절 체력이 줄고 0 이면 쓰러진다 (방어구 없음)
      t.hp -= dmg;
      if (by && by !== t && w !== 'zone') by.dmg += dmg;
      this.toRoom(r, { t: 'dmg', to: t.id, hp: Math.max(0, Math.round(t.hp)), by: by?.id || 0, head: !!head, zone: w === 'zone', knocked: 1, p: by?.pos ? [by.pos.x, by.pos.z] : null });
      if (t.hp <= 0) this.kill(r, t, by || t.knockBy, w, head);
      return;
    }
    if (by && w !== 'zone' && w !== 'car' && w !== 'molotov' && w !== 'red') {
      // 조끼 · 헬멧: 막은 만큼 닳고 0 이 되면 부서진다
      const k = head ? 'helmet' : 'armor', lv = t.inv[k];
      if (lv) { const cut = dmg * ARMOR_CUT[lv]; dmg -= cut; t.inv[k + 'D'] = (t.inv[k + 'D'] || 100) - cut * 1.6 - 2; if (t.inv[k + 'D'] <= 0) { t.inv[k] = 0; t.inv[k + 'D'] = 0; this.gear(r, t); if (!t.bot) this.send(t, { t: 'broke', k }); } if (!t.bot) this.send(t, { t: 'inv', inv: t.inv }); }
    }
    t.hp -= dmg;
    if (by && by !== t && w !== 'zone') by.dmg += Math.min(dmg, t.hp + dmg);
    this.toRoom(r, { t: 'dmg', to: t.id, hp: Math.max(0, Math.round(t.hp)), by: by?.id || 0, head: !!head, zone: w === 'zone', p: by?.pos ? [by.pos.x, by.pos.z] : null });
    if (t.hp <= 0) {
      // 분대에 서 있는 동료가 있으면 기절 (동료가 살려 줄 수 있다) · 없으면 쓰러짐
      const up = r.players.some((q) => q !== t && q.alive && !q.knocked && mates(q, t) && (r.opts.squad || 1) > 1);
      if (up && w !== 'zone') return this.knock(r, t, by, w, head);
      this.kill(r, t, by, w, head);
    } else if (t.bot && by && by !== t && w !== 'zone') { t.target = by; t.react = Math.min(t.react, 0.3); }
  }
  knock(r, t, by, w, head) {
    t.knocked = true; t.knockN++; t.hp = 100; t.knockBy = by; t.knockAt = Date.now(); t.reviving = null;
    if (t.veh) { const v = r.veh.find((x) => x.id === t.veh); if (v) v.driver = 0; t.veh = 0; this.vehUpdate(r); }
    for (const q of r.players) if (q.reviving?.id === t.id) this.stopRevive(r, q);
    this.toRoom(r, { t: 'knock', id: t.id, by: by?.id || 0, w, head: !!head });
    this.squadCheck(r, t.sq);
  }
  // 분대에 서 있는 사람이 없으면 기절한 사람들도 모두 쓰러진다
  squadCheck(r, sq) {
    const team = r.players.filter((q) => q.sq === sq && q.alive);
    if (team.length && team.every((q) => q.knocked)) for (const q of team) this.kill(r, q, q.knockBy, 'bleed', false);
  }
  startRevive(r, c, id, now) {
    const t = r.players.find((q) => q.id === id);
    if (!t || !t.alive || !t.knocked || !mates(c, t) || t === c || !c.pos || !t.pos || dist(c.pos, t.pos) > 2.8) return;
    c.reviving = { id, until: now + REVIVE_MS };
    this.toRoom(r, { t: 'reviving', by: c.id, to: id, ms: REVIVE_MS });
  }
  stopRevive(r, c) { const id = c.reviving?.id; c.reviving = null; this.toRoom(r, { t: 'revive-stop', by: c.id, to: id }); }
  kill(r, t, by, w, head) {
    if (!t.alive) return;
    const wasKnocked = t.knocked;
    t.alive = false; t.knocked = false; t.reviving = null; r.alive--;
    for (const q of r.players) if (q.reviving?.id === t.id) this.stopRevive(r, q);
    // 분대가 모두 쓰러지면 그 분대 순위 = 남은 분대 수
    const sqAlive = r.players.some((q) => q.alive && q.sq === t.sq);
    t.place = r.squadsLeft;
    if (!sqAlive) { for (const q of r.players) if (q.sq === t.sq) q.place = r.squadsLeft; r.squadsLeft--; }
    void wasKnocked;
    if (by && by !== t) by.k++;
    // 가방에 있던 것들을 그 자리에 떨군다 (젤리 상자)
    const add = [], inv = t.inv, P = t.pos || { x: 0, y: 0, z: 0 };
    const atts = [...inv.spare, ...inv.att.flatMap((a) => Object.values(a)), ...Object.values(inv.patt || {})];
    const items = [...inv.guns.filter(Boolean).map((g) => ({ k: 'gun', w: g })), ...(inv.pistol ? [{ k: 'pistol', w: inv.pistol }] : []), ...(inv.armor ? [{ k: 'armor', lv: inv.armor }] : []), ...(inv.helmet ? [{ k: 'helmet', lv: inv.helmet }] : []), ...(inv.bag ? [{ k: 'bag', lv: inv.bag }] : []), ...(inv.band ? [{ k: 'band', n: inv.band }] : []), ...['med', 'drink', 'pill', 'adren', 'nade', 'smoke', 'molotov', 'flash', 'flare', 'gas'].flatMap((k) => Array.from({ length: inv[k] || 0 }, () => ({ k, n: 1 }))), ...Object.entries(inv.ammo || {}).filter(([, n]) => n > 0).map(([a, n]) => ({ k: 'ammo', a, n })), ...atts.map((a) => ({ k: 'att', a }))];
    items.forEach((d, i) => { const a = (i / Math.max(1, items.length)) * Math.PI * 2; const n = { id: r.nextLoot++, ...d, x: P.x + Math.cos(a) * 0.9, y: Math.max(0.05, P.y + 0.05), z: P.z + Math.sin(a) * 0.9 }; r.loot.set(n.id, n); add.push(n); });
    t.inv = emptyInv(); this.gear(r, t);
    if (t.veh) { const v = r.veh.find((x) => x.id === t.veh); if (v) v.driver = 0; t.veh = 0; this.vehUpdate(r); }
    this.toRoom(r, { t: 'kill', by: by?.id || 0, to: t.id, w, head: !!head, place: t.place, alive: r.alive, squads: r.squadsLeft, out: !sqAlive });
    this.squadCheck(r, t.sq);
    if (add.length) this.toRoom(r, { t: 'loot', rm: [], add });
    const humansAlive = r.players.some((p) => !p.bot && p.alive);
    if (r.squadsLeft <= 1 || !humansAlive) setTimeout(() => this.finishBg(r), humansAlive ? 1200 : 2500);
  }
  onLeave(r, c) { if (c.alive && r.state === 'run' && r.squadsLeft != null) { r.players.push(c); this.kill(r, c, null, 'leave', false); r.players = r.players.filter((p) => p !== c); if (r.squadsLeft <= 1 || !r.players.some((p) => !p.bot && p.alive)) setTimeout(() => this.finishBg(r), 1000); } }
  finishBg(r) {
    if (r.ended || r.state !== 'run') return;
    r.ended = true;
    // 남은 사람: 킬 많은 순으로 위에
    // 남은 분대: 처치 많은 분대가 위
    const left = [...new Set(r.players.filter((p) => p.alive).map((p) => p.sq))].sort((a, b) => r.players.filter((p) => p.sq === b).reduce((s, p) => s + p.k, 0) - r.players.filter((p) => p.sq === a).reduce((s, p) => s + p.k, 0));
    left.forEach((sq, i) => { for (const p of r.players) if (p.sq === sq) p.place = i + 1; });
    const rank = [...r.players].sort((a, b) => a.place - b.place || a.sq - b.sq).map((p) => ({ rank: p.place, id: p.id, name: p.name, color: p.color, look: p.look, acc: p.acc, bot: !!p.bot, k: p.k, dmg: Math.round(p.dmg), sq: p.sq }));
    if (r.private) { r.state = 'wait'; r.players = r.players.filter((p) => !p.bot); this.toRoom(r, { t: 'finish', rank, practice: true }); return; }
    this.end(r, { rank });
  }
  // ---------- 매 틱 ----------
  onTick(r, now) {
    if (now < r.startAt || r.ended) return;
    const sec = this.sec(r, now), dt = 1 / this.o.hz;
    for (const p of r.players) if (!p.bot && p.st) p.pos = { x: p.st[0], y: p.st[1], z: p.st[2] };
    // 운전 중이면 차도 그 자리 (flags 16 = 운전)
    for (const p of r.players) { if (!p.veh || !p.st) continue; const v = r.veh.find((x) => x.id === p.veh); if (v && v.driver === p.id) { v.x = p.st[0]; v.y = p.st[1]; v.z = p.st[2]; v.yaw = p.st[3]; if (Number.isFinite(p.st[7])) v.fuel = Math.max(0, Math.min(100, p.st[7])); } }
    this.specialTick(r, now, sec, dt);
    if (now - r.vehAt > 1500) this.vehUpdate(r);
    r.smokes = r.smokes.filter((s) => s.until > now);
    // 부스트: 조금씩 회복 (부스트가 높을수록 빠르게) · 서서히 줄어든다
    for (const p of r.players) {
      if (!p.alive || p.boost <= 0) continue;
      p.boostAcc += dt * (p.boost >= 60 ? 1.6 : p.boost >= 20 ? 1.1 : 0.7);
      p.boost = Math.max(0, p.boost - dt * 2.4);
      if (p.boostAcc >= 1) { const h = Math.floor(p.boostAcc); p.boostAcc -= h; if (p.hp < 100) { p.hp = Math.min(100, p.hp + h); if (!p.bot) this.send(p, { t: 'hp', hp: Math.round(p.hp) }); } }
      if (!p.bot && now - (p.boostSent || 0) > 1000) { p.boostSent = now; this.send(p, { t: 'boost', v: Math.round(p.boost) }); }
    }
    // 비행선 끝: 아직 안 뛴 사람은 자동으로
    if (sec > r.plane.dur + 1) for (const p of r.players) if (!p.jumped && !p.bot && p.alive) { p.jumped = true; this.toRoom(r, { t: 'jumped', id: p.id }); }
    // 젤리 자기장 피해 (1초마다)
    if (sec - r.lastZone >= 1) {
      r.lastZone = Math.floor(sec);
      const Z = zoneAt(r.zones, sec);
      for (const p of r.players) if (p.alive && (p.landed || p.jumped) && p.pos && Math.hypot(p.pos.x - Z.x, p.pos.z - Z.z) > Z.r) this.damage(r, p, Z.dps, null, 'zone', false);
    }
    for (const b of r.players) if (b.bot && b.alive) this.botThink(r, b, dt, now, sec);
  }
  // ---------- 화염병 · 섬광탄 · 신호탄 ----------
  special(r, c, m, now) {
    const k = m.t, p = Array.isArray(m.p) ? { x: +m.p[0], y: +m.p[1], z: +m.p[2] } : null;
    if (!p || ![p.x, p.y, p.z].every(Number.isFinite) || !(c.inv[k] > 0) || !c.pos || dist(p, c.pos) > 60) return;
    c.inv[k]--; this.send(c, { t: 'inv', inv: c.inv });
    if (k === 'molotov') { const y = Math.max(0, p.y); r.fires.push({ x: p.x, y, z: p.z, until: now + THROWS.molotov.sec * 1000, by: c }); this.toRoom(r, { t: 'fire', p: [p.x, y, p.z], ms: THROWS.molotov.sec * 1000, r: THROWS.molotov.r }); return; }
    if (k === 'flash') {
      this.toRoom(r, { t: 'flash', p: [p.x, p.y, p.z] });
      // 봇: 가까이서 그쪽을 보고 있으면 눈부셔서 잠깐 못 쏜다
      for (const b of r.players) if (b.bot && b.alive && b.pos && dist(b.pos, p) < 18 && clearLine(r.map, { x: b.pos.x, y: b.pos.y + EYE, z: b.pos.z }, { ...p, y: p.y + 0.3 })) { b.blind = now + 3200; b.react = 2; }
      return;
    }
    if (k === 'flare') { this.dropCrate(r, c.pos.x, c.pos.z, 13000, c); return; }
  }
  // 보급상자: 하늘에서 낙하산으로 → 땅에 닿으면 좋은 아이템
  dropCrate(r, x, z, ms, by) {
    const lim = BG_SIZE / 2 - 6, id = r.dropId++;
    x = Math.max(-lim, Math.min(lim, x)); z = Math.max(-lim, Math.min(lim, z));
    if (inWater(r.map, x, z, -2)) { x += 0; z -= 20; }
    const d = { id, x, z, at: Date.now() + ms };
    r.drops.push(d);
    this.toRoom(r, { t: 'drop', id, x, z, ms, flare: by ? by.id : 0 });
  }
  specialTick(r, now, sec, dt) {
    // 기절: 피가 계속 줄어든다 (여러 번 기절할수록 빨리)
    for (const p of r.players) {
      if (!p.alive || !p.knocked) continue;
      p.hp -= (4 + 3 * (p.knockN - 1)) * dt;
      if (p.hp <= 0) this.kill(r, p, p.knockBy, 'bleed', false);
      else if (!p.bot && now - (p.knockSent || 0) > 500) { p.knockSent = now; this.send(p, { t: 'hp', hp: Math.round(p.hp), knocked: 1 }); }
    }
    // 살리기: 8초 동안 곁에 있어야 한다
    for (const c of r.players) {
      const rv = c.reviving; if (!rv) continue;
      const t = r.players.find((q) => q.id === rv.id);
      if (!c.alive || c.knocked || !t || !t.alive || !t.knocked || !c.pos || !t.pos || dist(c.pos, t.pos) > 3.2) { this.stopRevive(r, c); continue; }
      if (now >= rv.until) { c.reviving = null; t.knocked = false; t.hp = 20; t.reviveAt = now; this.toRoom(r, { t: 'revived', id: t.id, by: c.id }); if (!t.bot) this.send(t, { t: 'hp', hp: 20 }); }
    }
    // 화염병 불: 1초에 12
    r.fires = r.fires.filter((f) => f.until > now);
    if ((r.fireT = (r.fireT || 0) + dt) >= 0.25) {
      r.fireT = 0;
      for (const f of r.fires) for (const t of r.players) if (t.alive && t.pos && dist(t.pos, f) < THROWS.molotov.r && Math.abs(t.pos.y - f.y) < 2 && !t.veh) this.damage(r, t, THROWS.molotov.dps / 4, f.by === t ? null : f.by, 'molotov', false);
    }
    // 레드존: 자기장 안 아무 곳에 경고 → 폭격 (지붕 밑은 안전)
    const Z = zoneAt(r.zones, sec);
    if (!r.red && sec >= r.redNext && Z.phase < 4) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * Math.max(0, Z.r * 0.7 - RED_R * 0.5);
      r.red = { x: Z.x + Math.cos(a) * d, z: Z.z + Math.sin(a) * d, r: RED_R, start: now + 8000, end: now + 22000, nextBomb: now + 8000 };
      this.toRoom(r, { t: 'red', x: r.red.x, z: r.red.z, r: RED_R, in: 8000, dur: 14000 });
    }
    if (r.red) {
      if (now >= r.red.end) { r.red = null; r.redNext = sec + 80 + Math.random() * 40; }
      else if (now >= r.red.start && now >= r.red.nextBomb) {
        r.red.nextBomb = now + 300 + Math.random() * 250;
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r.red.r, bp = { x: r.red.x + Math.cos(a) * d, y: 0, z: r.red.z + Math.sin(a) * d };
        bp.y = this.groundAt(r, bp.x, bp.z);
        this.toRoom(r, { t: 'boom', p: [bp.x, bp.y + 0.3, bp.z], by: 0, red: 1 });
        for (const t of r.players) {
          if (!t.alive || !t.pos || this.underRoof(r, t.pos)) continue;
          const dd = Math.hypot(t.pos.x - bp.x, t.pos.y - bp.y, t.pos.z - bp.z); if (dd > 5) continue;
          this.damage(r, t, Math.max(15, 110 * (1 - dd / 5)), null, 'red', false);
        }
      }
    }
    // 보급상자 시간
    if (r.dropNext.length && sec >= r.dropNext[0]) { r.dropNext.shift(); const N = Z.next || Z, a = Math.random() * Math.PI * 2, d = Math.random() * N.r * 0.6; this.dropCrate(r, N.x + Math.cos(a) * d, N.z + Math.sin(a) * d, 20000); }
    for (const d of r.drops) if (!d.landed && now >= d.at) {
      d.landed = true;
      const items = rollCrate(Math.random), add = [];
      items.forEach((it, i) => { const a = (i / items.length) * Math.PI * 2; const n = { id: r.nextLoot++, ...it, x: d.x + Math.cos(a) * 0.9, y: this.groundAt(r, d.x, d.z) + 0.05, z: d.z + Math.sin(a) * 0.9, crate: d.id }; r.loot.set(n.id, n); add.push(n); });
      this.toRoom(r, { t: 'loot', rm: [], add }); this.toRoom(r, { t: 'landed', id: d.id });
    }
    // 분대 정보 (1초마다 · 우리 분대만): 체력 · 기절
    if ((r.opts.squad || 1) > 1 && now - r.sqAt > 700) {
      r.sqAt = now;
      for (const c of r.players) { if (c.bot || !c.ws) continue; this.send(c, { t: 'sq', m: r.players.filter((q) => q.sq === c.sq).map((q) => [q.id, Math.round(q.hp), q.knocked ? 1 : 0, q.alive ? 1 : 0, q.pos ? Math.round(q.pos.x) : 0, q.pos ? Math.round(q.pos.z) : 0]) }); }
    }
  }
  groundAt(r, x, z) { let top = 0; for (const b of r.map.boxes) if (!b.k.startsWith('outer') && !b.hide && x > b.x - b.w / 2 && x < b.x + b.w / 2 && z > b.z - b.d / 2 && z < b.z + b.d / 2 && b.y + b.h < 12) top = Math.max(top, b.y + b.h); return top; }
  // 지붕 · 2층 바닥 아래면 폭격에 안전
  underRoof(r, p) { return r.map.boxes.some((b) => !b.hide && b.y > p.y + 1.5 && b.y < p.y + 12 && p.x > b.x - b.w / 2 && p.x < b.x + b.w / 2 && p.z > b.z - b.d / 2 && p.z < b.z + b.d / 2); }
  // ---------- 젤리봇 ----------
  navOf(MAP) {
    if (this.navs.has(MAP.id)) return this.navs.get(MAP.id);
    const S = 4, nodes = [], idx = new Map(), H = BG_SIZE / 2 - 4;
    for (let x = -H; x <= H; x += S) for (let z = -H; z <= H; z += S) {
      if (inWater(MAP, x, z, -1) || MAP.boxes.some((b) => b.y < 1.8 && !b.k.startsWith('outer') && x > b.x - b.w / 2 - 0.6 && x < b.x + b.w / 2 + 0.6 && z > b.z - b.d / 2 - 0.6 && z < b.z + b.d / 2 + 0.6)) continue;
      idx.set(`${x},${z}`, nodes.length); nodes.push({ x, z, n: [] });
    }
    for (let i = 0; i < nodes.length; i++) { const a = nodes[i]; for (const [dx, dz] of [[S, 0], [0, S], [S, S], [S, -S]]) { const j = idx.get(`${a.x + dx},${a.z + dz}`); if (j == null) continue; const b = nodes[j]; if (!clearLine(MAP, { x: a.x, y: 0.5, z: a.z }, { x: b.x, y: 0.5, z: b.z })) continue; a.n.push(j); b.n.push(i); } }
    const near = (p) => { let best = 0, bd = Infinity; for (let i = 0; i < nodes.length; i++) { const n = nodes[i], d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    const nav = { nodes, near }; this.navs.set(MAP.id, nav); return nav;
  }
  pathTo(nav, from, to) {
    const prev = new Map([[from, -1]]), q = [from];
    for (let h = 0; h < q.length; h++) { const c = q[h]; if (c === to) break; for (const n of nav.nodes[c].n) if (!prev.has(n)) { prev.set(n, c); q.push(n); } }
    if (!prev.has(to)) return null;
    const out = []; for (let c = to; c !== -1; c = prev.get(c)) out.unshift(nav.nodes[c]);
    return out;
  }
  botThink(r, b, dt, now, sec) {
    // 1) 비행선 · 낙하
    if (!b.jumped) {
      const P = planeAt(r.plane, sec); b.pos = { x: P.x, y: P.y, z: P.z };
      if (P.k >= b.jumpK) { b.jumped = true; this.toRoom(r, { t: 'jumped', id: b.id }); b.fallTo = { x: P.x + (Math.random() - 0.5) * 30, z: P.z + (Math.random() - 0.5) * 30 }; }
      b.st = [b.pos.x, b.pos.y, b.pos.z, P.yaw, 0, 8]; return;
    }
    if (!b.landed) {
      const vy = b.pos.y > DROP.openAt ? DROP.free : DROP.chute;
      b.pos.y -= vy * dt;
      const d = dist(b.pos, b.fallTo); if (d > 0.5) { b.pos.x += ((b.fallTo.x - b.pos.x) / d) * DROP.glide * dt; b.pos.z += ((b.fallTo.z - b.pos.z) / d) * DROP.glide * dt; }
      b.pos.x = Math.max(-BG_SIZE / 2 + 3, Math.min(BG_SIZE / 2 - 3, b.pos.x)); b.pos.z = Math.max(-BG_SIZE / 2 + 3, Math.min(BG_SIZE / 2 - 3, b.pos.z));
      if (b.pos.y <= 0) { b.pos.y = 0; b.landed = true; b.lootT = 3 + Math.random() * 7; const nav = this.navOf(r.map), n = nav.nodes[nav.near(b.pos)]; if (n) { b.pos.x = n.x; b.pos.z = n.z; } } // 건물 · 바위 속에 내리지 않게 가까운 길로
      b.st = [b.pos.x, b.pos.y, b.pos.z, b.yaw || 0, 0, b.pos.y > DROP.openAt ? 8 : 4]; return;
    }
    // 2) 줍는 시간이 지나면 무기 · 방어구를 챙긴 것으로
    if (b.lootT > 0) { b.lootT -= dt; if (b.lootT <= 0) { b.inv.guns[0] = BOT_GUNS[Math.floor(Math.random() * BOT_GUNS.length)]; if (Math.random() < 0.5) { b.inv.armor = 1 + Math.floor(Math.random() * 2); b.inv.armorD = 100; } if (Math.random() < 0.4) { b.inv.helmet = 1 + Math.floor(Math.random() * 2); b.inv.helmetD = 100; } if (Math.random() < 0.35) b.inv.bag = 1 + Math.floor(Math.random() * 2); b.inv.band = 2; this.gear(r, b); this.toRoom(r, { t: 'wpn', id: b.id, w: b.inv.guns[0] }); } }
    // 기절: 엎드려 천천히 기어서 동료 쪽으로
    if (b.knocked) {
      const m = r.players.find((q) => q !== b && q.alive && !q.knocked && mates(q, b) && q.pos);
      if (m && dist(m.pos, b.pos) > 1.5) { const d = dist(m.pos, b.pos); b.pos.x += ((m.pos.x - b.pos.x) / d) * 1.1 * dt; b.pos.z += ((m.pos.z - b.pos.z) / d) * 1.1 * dt; }
      b.st = [b.pos.x, 0, b.pos.z, b.yaw || 0, 0, 64]; return;
    }
    // 기절한 동료가 가까우면 살리러 간다
    const down = r.players.find((q) => q !== b && q.alive && q.knocked && mates(q, b) && q.pos && dist(q.pos, b.pos) < 30);
    if (down && !(b.target && b.target.alive && dist(b.target.pos, b.pos) < 25)) {
      const d = dist(down.pos, b.pos);
      if (d > 2) { b.pos.x += ((down.pos.x - b.pos.x) / d) * 5.4 * dt; b.pos.z += ((down.pos.z - b.pos.z) / d) * 5.4 * dt; b.yaw = Math.atan2(-(down.pos.x - b.pos.x), -(down.pos.z - b.pos.z)); }
      else if (!b.reviving) this.startRevive(r, b, down.id, now);
      b.st = [b.pos.x, 0, b.pos.z, b.yaw || 0, 0, b.reviving ? 1 : 0]; return;
    }
    // 레드존 폭격 중이면 밖으로 (지붕 밑이면 버틴다)
    if (r.red && Date.now() > r.red.start - 3000 && dist(b.pos, r.red) < r.red.r + 2 && !this.underRoof(r, b.pos)) {
      const d = dist(b.pos, r.red) || 1; b.pos.x += ((b.pos.x - r.red.x) / d) * 6.5 * dt; b.pos.z += ((b.pos.z - r.red.z) / d) * 6.5 * dt; b.path = null;
    }
    const gun = b.inv.guns[0] && weapon(b.inv.guns[0]);
    const eye = { x: b.pos.x, y: EYE, z: b.pos.z };
    // 3) 보이는 적 (0.5초마다 확인 · 50m 안). 봇끼리는 덜 싸워서 판이 너무 빨리 끝나지 않게
    b.scanT -= dt;
    if (b.scanT <= 0) {
      b.scanT = 0.5;
      let tgt = null, td = 50;
      for (const p of r.players) { if (p === b || !p.alive || !p.pos || mates(p, b) || (p.bot && !p.landed) || (!p.bot && (!p.st || (p.st[5] & 12)))) continue; if (p.bot && b.target !== p && Math.random() < 0.55) continue; /* 하늘에 있는 사람은 아직 */ const d = dist(b.pos, p.pos); if (d < td && this.see(r, eye, { x: p.pos.x, y: p.pos.y + 1.2, z: p.pos.z })) { td = d; tgt = p; } }
      if (tgt !== b.target) { b.target = tgt; b.react = 0.4 + Math.random() * 0.5 * (1.3 - b.skill); }
    }
    const tgt = b.target && b.target.alive ? b.target : null;
    let moving = false;
    if (tgt && gun) {
      const td = dist(b.pos, tgt.pos);
      const want = Math.atan2(-(tgt.pos.x - b.pos.x), -(tgt.pos.z - b.pos.z));
      let dy = want - (b.yaw || 0); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      b.yaw = (b.yaw || 0) + Math.max(-6 * dt, Math.min(6 * dt, dy));
      b.pitch = Math.atan2((tgt.pos.y + 1.1) - EYE, td) * 0.8;
      b.react -= dt;
      if (b.react <= 0 && Math.abs(dy) < 0.25 && now >= b.fireT && td < gun.range * 2 && !(b.blind > now)) {
        b.fireT = now + gun.rate * 1000 * (gun.auto ? 1.1 : 1.6 + Math.random());
        const pHit = Math.max(0.08, Math.min(0.75, 0.85 - td * (gun.cls === 'sniper' ? 0.004 : 0.015))) * b.skill;
        const hitIt = Math.random() < pHit;
        const aim = { x: tgt.pos.x + (hitIt ? 0 : (Math.random() - 0.5) * 3), y: tgt.pos.y + 1.2 + (hitIt ? 0 : (Math.random() - 0.3) * 1.4), z: tgt.pos.z + (hitIt ? 0 : (Math.random() - 0.5) * 3) };
        const L = Math.hypot(aim.x - eye.x, aim.y - eye.y, aim.z - eye.z) || 1;
        this.toRoom(r, { t: 'fire', by: b.id, w: gun.id, o: [eye.x, eye.y, eye.z], d: [(aim.x - eye.x) / L, (aim.y - eye.y) / L, (aim.z - eye.z) / L] });
        if (hitIt && this.see(r, eye, { x: tgt.pos.x, y: tgt.pos.y + 1.2, z: tgt.pos.z })) {
          const head = Math.random() < 0.1 * b.skill, n = gun.pellets > 1 ? Math.max(1, Math.round(gun.pellets * Math.max(0.2, 1 - td / 18))) : 1;
          this.damage(r, tgt, gun.dmg * n * (head ? gun.head : 1) * falloff(gun, td) * (tgt.bot ? 0.55 : 1), b, gun.id, head);
        }
      }
      if (b.hp < 45 && b.inv.band > 0 && now - b.healAt > 4000) { b.healAt = now; b.inv.band--; b.hp = Math.min(75, b.hp + 15); }
    } else {
      // 4) 자기장 안쪽으로 · 아니면 이리저리
      const Z = zoneAt(r.zones, sec), goalZ = Z.next || Z;
      const outside = Math.hypot(b.pos.x - goalZ.x, b.pos.z - goalZ.z) > goalZ.r * 0.85;
      if (!b.path || !b.path.length || (b.repath = (b.repath || 0) - dt) <= 0 || (outside && !b.goingIn)) {
        b.repath = 8 + Math.random() * 6; b.goingIn = outside;
        const nav = this.navOf(r.map);
        const a = Math.random() * Math.PI * 2, rr = Math.random() * goalZ.r * 0.6;
        const goal = outside || Math.random() < 0.6 ? { x: goalZ.x + Math.cos(a) * rr, z: goalZ.z + Math.sin(a) * rr } : { x: b.pos.x + (Math.random() - 0.5) * 40, z: b.pos.z + (Math.random() - 0.5) * 40 };
        b.path = this.pathTo(nav, nav.near(b.pos), nav.near(goal)) || [];
      }
      const n = b.path[0];
      if (n) {
        const want = Math.atan2(-(n.x - b.pos.x), -(n.z - b.pos.z));
        let dy = want - (b.yaw || 0); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        b.yaw = (b.yaw || 0) + Math.max(-5 * dt, Math.min(5 * dt, dy)); b.pitch = 0;
        const step = (outside ? 6.8 : 5.4) * dt, d = dist(b.pos, n);
        if (d <= step + 0.2) { b.pos.x = n.x; b.pos.z = n.z; b.path.shift(); } else { b.pos.x += ((n.x - b.pos.x) / d) * step; b.pos.z += ((n.z - b.pos.z) / d) * step; }
        moving = true;
      }
    }
    b.st = [b.pos.x, 0, b.pos.z, b.yaw || 0, b.pitch || 0, moving ? 0 : 0];
  }
}
export { rollItem };
