// 서버 스냅샷을 받아 시민/다른 플레이어를 그리는 브라우저 전용 레이어
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';
import { makeMount, updateMount } from './animals.js';
import { ANIMAL_KINDS } from './fauna.js';
import { MODES, PLAN_KINDS, NEED_KEYS } from './citizens.js';
import { angleLerp, G } from '../../shared/js/utils.js';
import { makeCarMesh } from './traffic.js';
import { itemDef, RARITY, ITEMS, shopItems } from './items.js';

const STREET_MODES = new Set(['walk', 'idle', 'park', 'chat', 'fight', 'flee', 'dead']);
const EAT_SHOPS = new Set(['seafood', 'restaurant', 'pizza', 'chicken', 'chinese', 'gukbap', 'burger', 'bunsik', 'cafe', 'bakery']);
const INSIDE_MODES = new Set(['inside', 'player', 'fight', 'flee', 'dead']);

export class CitizenView {
  constructor(scene, sim, city) {
    this.sim = sim;
    this.city = city;
    for (const c of sim.citizens) {
      c.roach = new Roach({ seed: c.name, color: c.color, age: c.age, gender: c.gender, accessories: c.accessories, lashes: c.lashes, mustache: c.mustache });
      c.roach.root.visible = false;
      scene.add(c.roach.root);
      c.target = { x: c.pos.x, z: c.pos.z, h: 0, ix: 0, iz: 0, moving: 0 };
      c.visible = false;
      c.fresh = true;
    }
  }

  applyMeta(m) {
    const c = this.sim.citizens[m[0]];
    if (!c) return;
    const B = this.city.buildings;
    c.mode = MODES[m[1]] || 'inside';
    c.location = m[2] >= 0 ? B[m[2]] : null;
    c.plan = { kind: PLAN_KINDS[m[3]] || 'none', building: m[4] >= 0 ? B[m[4]] : null };
    c.dest = m[5] >= 0 ? B[m[5]] : null;
    c.chatWith = m[6] >= 0 ? this.sim.citizens[m[6]] : null;
    c.talkingTo = m[7] >= 0 ? m[7] : null;
  }

  applySnap(n) {
    const cs = this.sim.citizens;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], o = i * 6, t = c.target;
      t.x = n[o] / 10; t.z = n[o + 1] / 10; t.h = n[o + 2] / 100; t.moving = n[o + 3]; t.ix = n[o + 4] / 10; t.iz = n[o + 5] / 10;
      if (c.fresh) { c.pos.set(t.x, 0, t.z); c.ipos.set(t.ix, 0.1, t.iz); c.fresh = false; }
    }
  }

  applyEvent(ev) {
    const c = this.sim.citizens[ev.id];
    if (!c) return;
    if (ev.t === 'say') c.bubble = { text: ev.text, t: ev.dur || 3.5 };
    else if (ev.t === 'emo') c.roach.setEmotion(ev.e, ev.dur || 4);
    else if (ev.t === 'wave') c.roach.wave();
    else if (ev.t === 'jump') c.roach.jumpSquash = 1;
    else if (ev.t === 'talking') { c.roach.talking = true; clearTimeout(c.talkTimer); c.talkTimer = setTimeout(() => { c.roach.talking = false; }, 2200); }
    else if (ev.t === 'hurt') c.roach.hurt();
    else if (ev.t === 'punch') c.roach.attack('melee');
    else if (ev.t === 'die') { c.mode = 'dead'; c.hp = 0; }
    else if (ev.t === 'revive') { c.hp = c.maxHp; c.fresh = true; }
  }

  applyNeeds(nd) {
    const cs = this.sim.citizens;
    for (let i = 0; i < cs.length; i++) {
      const o = i * 7;
      cs[i].hp = nd[o];
      NEED_KEYS.forEach((k, j) => { cs[i].needs[k] = nd[o + 1 + j]; });
      cs[i].mood = nd[o + 6];
    }
  }

  isStreet(c) {
    if (c.location && c.location.type !== 'park' && c.mode !== 'walk' && c.mode !== 'idle' && c.mode !== 'chat') return false;
    return STREET_MODES.has(c.mode) || c.mode === 'player';
  }
  isInside(c, loc) { return loc >= 0 && c.location && c.location.id === loc && INSIDE_MODES.has(c.mode); }

  update(dt, camPos, myLoc) {
    const k = Math.min(1, dt * 10);
    for (const c of this.sim.citizens) {
      if (c.bubble) { c.bubble.t -= dt; if (c.bubble.t <= 0) c.bubble = null; }
      const t = c.target;
      const root = c.roach.root;
      let visible = false, src = null;
      if (this.isInside(c, myLoc)) {
        if (c.ipos.distanceTo(tmp.set(t.ix, 0.1, t.iz)) > 6) c.ipos.set(t.ix, 0.1, t.iz);
        c.ipos.x += (t.ix - c.ipos.x) * k; c.ipos.z += (t.iz - c.ipos.z) * k;
        visible = true; src = c.ipos;
        root.position.set(c.ipos.x, 0.1, c.ipos.z);
        c.roach.setLod(false);
      } else {
        if (Math.hypot(t.x - c.pos.x, t.z - c.pos.z) > 8) c.pos.set(t.x, 0, t.z);
        c.pos.x += (t.x - c.pos.x) * k; c.pos.z += (t.z - c.pos.z) * k;
        if (myLoc < 0 && this.isStreet(c)) {
          const dx = c.pos.x - camPos.x, dz = c.pos.z - camPos.z, d2 = dx * dx + dz * dz;
          const vd = this.viewDist || 130; // 스코프로 보면 더 멀리까지 보인다
          visible = d2 < vd * vd;
          if (visible) {
            root.position.set(c.pos.x, this.city.groundY(c.pos.x, c.pos.z), c.pos.z);
            const lod = this.lodDist || 38; c.roach.setLod(d2 > lod * lod);
          }
          src = c.pos;
        }
      }
      root.visible = visible;
      c.visible = visible;
      if (!visible) continue;
      root.rotation.y = angleLerp(root.rotation.y, t.h, Math.min(1, dt * 10));
      const sleeping = c.mode === 'inside' && c.plan?.kind === 'sleep';
      c.roach.setDead(c.mode === 'dead');
      // 기분이 얼굴에 드러난다
      c.roach.baseEmotion = c.mood < 20 ? 'angry' : c.mood < 38 ? 'sad' : c.mood > 78 ? 'happy' : 'neutral';
      if (c.roach.emotionT <= 0 && c.roach.emotion !== c.roach.baseEmotion) c.roach.setEmotion(c.roach.baseEmotion, 0);
      c.roach.dancing = c.location?.type === 'club' && c.mode === 'inside' && c.plan?.kind !== 'work';
      // 식당 손님은 가끔 음식을 먹는다
      if (c.mode === 'inside' && !t.moving && c.plan?.kind !== 'work' && EAT_SHOPS.has(c.location?.type) && !(c.roach.eatT > 0) && Math.random() < dt * 0.12) {
        const menu = shopItems(c.location.type).map((id) => ITEMS[id]).filter((d) => d.eat);
        const d = menu[(c.id + Math.floor(performance.now() / 9000)) % menu.length];
        if (d) c.roach.eat(d.eat[0], d.eat[1], 4, c.roach.root.position.distanceTo(camPos) < 25 ? d.emoji : null, true);
      }
      const sp = c.mode === 'flee' ? 7.5 : c.mode === 'fight' ? 5.5 : c.walkSpeed;
      c.roach.update(dt, sleeping || c.mode === 'dead' ? 0 : t.moving ? sp : 0, {});
      if (sleeping) for (const e of c.roach.eyes) e.scale.y = 0.1;
      void src;
    }
  }
}
const tmp = new THREE.Vector3();

// 다른 플레이어
export class PlayersView {
  constructor(scene, myId) {
    this.scene = scene;
    this.myId = myId;
    this.list = new Map();
  }

  add(meta) {
    if (meta.id === this.myId) return;
    this.remove(meta.id);
    const pr = meta.profile || {};
    const roach = new Roach({ own: true, seed: meta.name, color: pr.color, age: pr.age, gender: pr.gender, look: pr.look, accessories: pr.accessories || [], lashes: !pr.look && pr.gender === '여' });
    roach.root.visible = false;
    this.scene.add(roach.root);
    roach.setHeld(pr.held || null);
    const beacon = makePlayerBeacon();
    this.scene.add(beacon);
    this.list.set(meta.id, { id: meta.id, name: meta.name, profile: pr, roach, beacon, pos: new THREE.Vector3(), target: null, heading: 0, speed: 0, loc: -1, car: -1, air: 0, sleeping: 0, bubble: null, visible: false, hp: 100, dead: 0, stars: 0 });
  }

  meta(meta) {
    const p = this.list.get(meta.id);
    if (!p) { this.add(meta); return; }
    if ((meta.profile?.color && meta.profile.color !== p.profile.color) || JSON.stringify(meta.profile?.look || null) !== JSON.stringify(p.profile.look || null)) {
      // 몸 색깔이 바뀌면 모델을 다시 만든다
      const pos = p.pos.clone(), tgt = p.target, rest = { ...p };
      this.add(meta);
      const n = this.list.get(meta.id);
      Object.assign(n, { pos, target: tgt, heading: rest.heading, loc: rest.loc, car: rest.car, hp: rest.hp, stars: rest.stars });
      return;
    }
    p.name = meta.name; p.profile = meta.profile;
    p.roach.setAccessories(meta.profile.accessories || []);
    p.roach.setHeld(meta.profile.held || null);
  }

  remove(id) {
    const p = this.list.get(id);
    if (!p) return;
    this.scene.remove(p.roach.root);
    if (p.beacon) this.scene.remove(p.beacon);
    if (p.mountObj) this.scene.remove(p.mountObj.mesh.g);
    this.list.delete(id);
  }

  applySnap(arr) {
    for (const a of arr) {
      const p = this.list.get(a[0]);
      if (!p) continue;
      const tgt = new THREE.Vector3(a[1] / 100, a[2] / 100, a[3] / 100);
      if (!p.target || p.target.distanceTo(tgt) > 15) p.pos.copy(tgt);
      p.target = tgt;
      p.heading = a[4] / 100; p.speed = a[5] / 10; p.loc = a[6]; p.car = a[7]; p.air = a[8]; p.sleeping = a[9];
      p.hp = a[10]; p.dead = a[11]; p.stars = a[12]; p.mt = a[13] ?? -1;
    }
  }

  say(id, text) {
    const p = this.list.get(id);
    if (p) p.bubble = { text, t: 5 };
  }

  update(dt, myLoc, traffic) {
    const k = Math.min(1, dt * 12);
    for (const p of this.list.values()) {
      if (p.bubble) { p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
      if (!p.target) continue;
      p.pos.lerp(p.target, k);
      const car = p.car >= 0 ? traffic.cars[p.car] : null;
      const visible = p.loc === myLoc && (!car || myLoc < 0);
      p.visible = visible && !car;
      p.roach.root.visible = visible;
      // 하늘까지 닿는 플레이어 표시 (바깥에서만)
      const showBeacon = p.loc === myLoc && myLoc < 0 && !p.dead;
      p.beacon.visible = showBeacon;
      if (showBeacon) {
        const bp = car ? car.pos : p.pos;
        p.beacon.position.set(bp.x, bp.y || 0, bp.z);
        const now = performance.now() / 1000;
        const gem = p.beacon.userData.gem;
        gem.position.y = (car ? 3.6 : p.roach.height + 1.6) + Math.sin(now * 2.5 + p.id) * 0.2;
        gem.rotation.y = now * 1.6;
        for (const [i, r] of p.beacon.userData.rings.entries()) { const u = (now * 0.25 + i / 4) % 1; r.position.y = 3 + u * 60; r.material.opacity = 0.55 * (1 - u); }
      }
      // 동물을 타고 있으면 그 동물을 보여준다
      const mk = p.mt >= 0 && !car ? ANIMAL_KINDS[p.mt] : null;
      if (p.mountObj && (p.mountObj.kind !== mk || !visible)) { this.scene.remove(p.mountObj.mesh.g); p.mountObj = null; if (p.roach.seated) unseatRoach(p.roach); }
      if (!visible) continue;
      if (car) { seatRoach(p.roach, car); p.roach.update(dt, 0, {}); continue; }
      if (mk) {
        if (!p.mountObj) { p.mountObj = makeMount(mk, p.id); this.scene.add(p.mountObj.mesh.g); }
        p.mountH = angleLerp(p.mountH ?? p.heading, p.heading, Math.min(1, dt * 10));
        updateMount(p.mountObj, p.roach, p.pos, p.mountH, dt, { speed: p.speed, flying: !!(p.air & 2) });
        continue;
      }
      if (p.roach.seated) unseatRoach(p.roach);
      p.roach.root.position.copy(p.pos);
      p.roach.root.rotation.y = angleLerp(p.roach.root.rotation.y, p.heading, Math.min(1, dt * 12));
      p.roach.setDead(!!p.dead);
      p.roach.flying = !!(p.air & 2); p.roach.flipped = !!(p.air & 4);
      if (p.roach.emote && (p.speed > 1 || p.dead)) p.roach.playEmote(null); // 움직이면 춤 끝
      p.roach.update(dt, p.dead ? 0 : p.speed, { airborne: !!(p.air & 1), noCrawl: !!(p.air & 2) });
      if (p.sleeping && !p.bubble) p.bubble = { text: '💤', t: 2 };
    }
  }
}

// 다른 플레이어 위치 표시: 보라색 빛기둥 + 떠오르는 고리 + 머리 위 다이아 (아이템 빛기둥과 다른 모양)
const beaconGeo = { beam: new THREE.CylinderGeometry(0.4, 0.4, 160, 8, 1, true), ring: new THREE.TorusGeometry(0.9, 0.08, 6, 24), gem: new THREE.OctahedronGeometry(0.42) };
function makePlayerBeacon() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(beaconGeo.beam, new THREE.MeshBasicMaterial({ color: '#d500f9', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = 82; g.add(beam);
  const core = new THREE.Mesh(beaconGeo.beam, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.scale.set(0.3, 1, 0.3); core.position.y = 82; g.add(core);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(beaconGeo.ring, new THREE.MeshBasicMaterial({ color: '#ea80fc', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    r.rotation.x = Math.PI / 2; g.add(r); rings.push(r);
  }
  const gem = new THREE.Mesh(beaconGeo.gem, new THREE.MeshBasicMaterial({ color: '#e040fb' }));
  gem.scale.set(1, 1.4, 1); g.add(gem);
  g.userData = { rings, gem };
  g.visible = false;
  g.traverse((o) => { o.frustumCulled = false; o.renderOrder = 5; });
  return g;
}

// ---------------- 차에 앉히기 ----------------
const SEAT_SCALE = { tank: 0.55, heli: 0.45, bicycle: 0.46, scooter: 0.46, motorcycle: 0.46, chopper: 0.46, sportbike: 0.46 };
export function seatRoach(roach, car, seat = 0) {
  const m = car.mesh;
  if (!m.seats?.length) return;
  roach.setSeated(true);
  // 지붕이 있는 차는 앉은 키(모자·더듬이 포함)가 지붕 아래에 들어오도록 크기를 맞춘다
  let sc = SEAT_SCALE[car.kind] || 0.42;
  if (m.roof) sc = Math.min(sc, (m.roof - m.seats[0].y) / seatedHeight(roach));
  roach.root.scale.setScalar(sc);
  // 이륜차: 핸들을 잡고, 자전거는 페달을 밟는다. 차체와 같이 기운다
  roach.riding = !!m.bike;
  roach.pedal = m.pedal ? Math.abs(car.speed || 0) : 0;
  m.body.updateMatrixWorld(true);
  const p = (m.seats[seat] || m.seats[0]).clone();
  m.body.localToWorld(p);
  roach.root.position.copy(p);
  roach.root.rotation.set(0, car.heading, m.bike ? m.body.rotation.z : 0);
}
// 앉은 자세의 키 (크기 1 기준). 액세서리가 바뀔 수 있으니 1초마다 다시 잰다
const _box = new THREE.Box3();
function seatedHeight(roach) {
  const now = performance.now();
  if (roach._seatH && now - roach._seatHT < 1000) return roach._seatH;
  const r = roach.root;
  r.updateMatrixWorld(true);
  _box.setFromObject(r);
  roach._seatH = Math.max(1, (_box.max.y - r.position.y) / r.scale.y);
  roach._seatHT = now;
  return roach._seatH;
}
export function unseatRoach(roach) {
  roach.setSeated(false);
  roach.riding = false; roach.pedal = 0; roach.root.rotation.z = 0;
  roach.root.scale.setScalar(roach.baseScale);
}

// ---------------- 경찰 · 군대 ----------------
const UNIT_KINDS = ['cop', 'soldier', 'tank', 'heli'];
export class UnitsView {
  constructor(scene) { this.scene = scene; this.list = new Map(); }

  apply(arr) {
    const seen = new Set();
    for (const a of arr) {
      const [id, ki, x, y, z, h, loc, moving, hpPct, flying] = a;
      seen.add(id);
      let u = this.list.get(id);
      if (!u) {
        const kind = UNIT_KINDS[ki];
        let obj, roach = null;
        if (kind === 'cop' || kind === 'soldier') {
          roach = new Roach({ color: kind === 'cop' ? '#6d4c41' : '#5d4037', age: 35, accessories: kind === 'cop' ? ['police', 'vest_kevlar'] : ['kevlar_helmet', 'vest_kevlar', 'goggles'] });
          roach.setHeld(kind === 'cop' ? 'pistol' : 'rifle');
          obj = roach.root;
        } else {
          const m = makeCarMesh(kind, kind === 'heli' ? '#33401a' : '#556b2f');
          obj = m.g; obj.userData.mesh = m;
        }
        this.scene.add(obj);
        u = { id, kind, obj, roach, pos: new THREE.Vector3(x / 10, y / 10, z / 10), target: new THREE.Vector3(), h: 0, loc, moving: 0, hp: 100, visible: false };
        this.list.set(id, u);
      }
      u.target.set(x / 10, y / 10, z / 10); u.h = h / 100; u.loc = loc; u.moving = moving; u.hp = hpPct; u.flying = !!flying;
    }
    for (const [id, u] of this.list) if (!seen.has(id)) { this.scene.remove(u.obj); this.list.delete(id); }
  }

  update(dt, myLoc, groundY) {
    const k = Math.min(1, dt * 10);
    for (const u of this.list.values()) {
      if (u.pos.distanceTo(u.target) > 12) u.pos.copy(u.target);
      u.pos.lerp(u.target, k);
      u.visible = u.loc === myLoc;
      u.obj.visible = u.visible;
      if (!u.visible) continue;
      // 날아서 쫓는 경찰은 서버가 준 높이 그대로 (날개를 펴고)
      const y = u.kind === 'heli' || u.flying ? u.pos.y : myLoc < 0 ? groundY(u.pos.x, u.pos.z) : 0.1;
      u.obj.position.set(u.pos.x, y, u.pos.z);
      u.obj.rotation.y = angleLerp(u.obj.rotation.y, u.h, k);
      if (u.roach) { u.roach.flying = !!u.flying; u.roach.update(dt, u.moving ? 6 : 0, { noCrawl: u.flying }); }
      else if (u.kind === 'heli') { const m = u.obj.userData.mesh; m.rotor.rotation.y += dt * 25; m.tail.rotation.x += dt * 35; }
    }
  }
}

// ---------------- 바닥에 떨어진 아이템 ----------------
function emojiSprite(emoji) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.font = '96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(emoji, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.9, 1);
  return s;
}
export class GroundView {
  constructor(scene) { this.scene = scene; this.list = new Map(); }
  add(g) {
    this.remove(g.id);
    const grp = new THREE.Group();
    const spr = emojiSprite(itemDef(g.item.id).emoji);
    spr.position.y = 0.6; grp.add(spr);
    const rar = g.world || g.item.ttlMs ? RARITY[g.item.rarity] || RARITY.common : null;
    const col = rar ? rar.color : g.item.id === 'cash' ? '#69f0ae' : '#ffd54f';
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; grp.add(ring);
    let beam = null, aura = null;
    if (rar) {
      // 멀리서도 보이는 빛기둥 + 바닥 오라 (희귀할수록 크고 밝게)
      const big = { common: 0.6, rare: 0.8, epic: 1.0, legendary: 1.3 }[g.item.rarity] || 0.6;
      beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * big, 0.55 * big, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 13; grp.add(beam);
      aura = new THREE.Mesh(new THREE.RingGeometry(0.2, 1.4 * big, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      aura.rotation.x = -Math.PI / 2; aura.position.y = 0.08; grp.add(aura);
      spr.scale.set(1.3, 1.3, 1);
      if (g.bonus) { const b = emojiSprite(itemDef(g.bonus.id).emoji); b.scale.set(0.6, 0.6, 1); b.position.set(0.7, 0.45, 0); grp.add(b); }
    }
    grp.position.set(g.x, g.y, g.z);
    this.scene.add(grp);
    this.list.set(g.id, { ...g, obj: grp, spr, beam, aura, rarity: rar, expire: performance.now() / 1000 + (g.ttl ?? 60) });
  }
  remove(id) { const g = this.list.get(id); if (g) { this.scene.remove(g.obj); this.list.delete(id); } }
  update(t, myLoc) {
    for (const g of this.list.values()) {
      g.obj.visible = g.loc === myLoc;
      g.spr.position.y = (g.rarity ? 0.9 : 0.6) + Math.sin(t * 3 + g.id) * 0.12;
      if (g.beam) { g.beam.material.opacity = 0.25 + Math.sin(t * 3 + g.id) * 0.1; g.beam.rotation.y += 0.02; }
      if (g.aura) { const k = 1 + Math.sin(t * 4 + g.id) * 0.15; g.aura.scale.set(k, k, k); }
    }
  }
  nearest(pos, myLoc, r = 2.2) {
    let best = null, bd = r;
    for (const g of this.list.values()) {
      if (g.loc !== myLoc) continue;
      const d = Math.hypot(g.x - pos.x, g.z - pos.z);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }
}

// ---------------- 차에서 뛰쳐나와 도망가는 사람들 ----------------
// 차에서 뛰어내려 도망가는 시민: 서버가 움직이고(rpos), 맞으면 쓰러진다(runnerDown)
export class Runners {
  constructor(scene, groundY) { this.scene = scene; this.groundY = groundY; this.list = new Map(); }
  spawn(arr) {
    const cols = ['#8a5634', '#9b6038', '#a86b3e', '#6e3f25', '#ff9fb2', '#7ec8a9'];
    for (const m of arr) {
      if (this.list.has(m.id)) continue;
      const r = new Roach({ color: cols[m.c % cols.length], age: 30, seed: 'runner' + m.id });
      r.setEmotion('scared', 30);
      r.root.position.set(m.x, this.groundY ? this.groundY(m.x, m.z) : 0.05, m.z);
      r.root.rotation.y = m.h;
      this.scene.add(r.root);
      this.list.set(m.id, { id: m.id, r, tx: m.x, tz: m.z, th: m.h, dead: false, bubble: m.say ? { text: m.say, t: 2.5 } : null });
    }
  }
  applyPos(a) {
    for (let i = 0; i < a.length; i += 4) { const o = this.list.get(a[i]); if (o) { o.tx = a[i + 1] / 10; o.tz = a[i + 2] / 10; o.th = a[i + 3] / 100; } }
  }
  down(id) { const o = this.list.get(id); if (!o) return; o.dead = true; o.r.setDead(true); o.bubble = null; }
  gone(id) { const o = this.list.get(id); if (!o) return; this.scene.remove(o.r.root); this.list.delete(id); }
  update(dt) {
    const k = Math.min(1, dt * 8);
    for (const o of this.list.values()) {
      const P = o.r.root.position, px = P.x, pz = P.z;
      if (!o.dead) { P.x += (o.tx - P.x) * k; P.z += (o.tz - P.z) * k; o.r.root.rotation.y = angleLerp(o.r.root.rotation.y, o.th, k); }
      P.y = this.groundY ? this.groundY(P.x, P.z) : 0.05;
      o.r.update(dt, o.dead ? 0 : Math.hypot(P.x - px, P.z - pz) / Math.max(dt, 1e-3), {});
      if (o.bubble) { o.bubble.t -= dt; if (o.bubble.t <= 0) o.bubble = null; }
    }
  }
}
void G;

// ---------------- 땅 위 길 안내 화살표 ----------------
export class RouteView {
  constructor(scene, groundY) {
    this.groundY = groundY;
    this.group = new THREE.Group();
    scene.add(this.group);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.55); shape.lineTo(0.5, -0.1); shape.lineTo(0.2, -0.1); shape.lineTo(0.2, -0.5); shape.lineTo(-0.2, -0.5); shape.lineTo(-0.2, -0.1); shape.lineTo(-0.5, -0.1); shape.closePath();
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: '#40c4ff', transparent: true, opacity: 0.85, depthWrite: false });
    this.arrows = [];
    for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(geom, this.mat); m.visible = false; m.renderOrder = 3; this.group.add(m); this.arrows.push(m); }
  }
  update(route, from, t) {
    let n = 0;
    if (route?.length) {
      // 경로를 따라 3m 간격으로 화살표 (가까운 70m만)
      let prev = from.clone(), carry = 1.5 - ((t * 2) % 3);
      for (const q of route) {
        const seg = new THREE.Vector3(q.x - prev.x, 0, q.z - prev.z);
        const len = seg.length();
        if (len > 0.01) {
          seg.divideScalar(len);
          const yaw = Math.atan2(seg.x, seg.z);
          for (let d = Math.max(0, carry); d < len && n < this.arrows.length; d += 3) {
            const a = this.arrows[n++];
            const x = prev.x + seg.x * d, z = prev.z + seg.z * d;
            a.position.set(x, this.groundY(x, z) + 0.06, z);
            a.rotation.y = yaw + Math.PI;
            a.visible = true;
          }
          carry = (carry - len) % 3; if (carry < 0) carry += 3;
        }
        prev = new THREE.Vector3(q.x, 0, q.z);
        if (n >= this.arrows.length) break;
      }
    }
    for (let i = n; i < this.arrows.length; i++) this.arrows[i].visible = false;
    this.mat.opacity = 0.6 + Math.sin(t * 5) * 0.25;
  }
}
