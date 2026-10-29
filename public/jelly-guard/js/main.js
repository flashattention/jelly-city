// 젤리수호대: 영웅 16명이 겨루는 팀 슈팅 (점령전 · 쟁탈전 · 6 대 6 · 봇)
import '../../shared/js/renamed.js'; // 옛 이름으로 저장된 값 옮기기 (맨 먼저)
import * as THREE from 'three';
import { openSens, sensOf } from '../../shared/js/sens.js';
import { store } from '../../shared/js/account.js';
import { Shell, esc, TEAMS } from '../../shared/js/shell.js';
import { rayBoxes, floorAt, clearLine } from '../../jelly-tactical/js/maps.js';
import { buildMap } from '../../jelly-tactical/js/world.js';
import { Player } from '../../jelly-tactical/js/fps.js';
import { explosion, updateFx as updateBig } from '../../jelly-tactical/js/fx.js';
import { HEROES, ROLES, heroById, PROJ, blockBy, RESPAWN_MS } from './heroes.js';
import { WMAPS, wmapById, makeMap, openGates, inRoom } from './watchmaps.js';
import { heroBear, dvaMech, Plate, HeroVM, EntViews, puff, ring, flashSphere, line, dmgNum, updateFx, beamMesh, setBeam, projMesh, trailPuff, glowTex, TEAM_COL } from './vfx.js';
import { makeKit } from './kits.js';
import { sfx, unlock, toggleMute, sound, say } from './wsound.js';

const $ = (id) => document.getElementById(id);
const PICK_KEY = 'jellyguard.pick', HERO_KEY = 'jellyguard.hero';
const coarse = matchMedia('(pointer: coarse)').matches;
const F = { stun: 1, sleep: 2, invuln: 4, nano: 8, boost: 16, matrix: 32, deflect: 64, grav: 128, anti: 256, hboost: 512, primal: 1024, pilot: 2048, valk: 4096, bub: 8192, reveal: 16384, blossom: 32768, hogult: 65536, blade: 131072, barrage: 262144, deadeye: 524288, coal: 1 << 20, ghost: 1 << 21, spd: 1 << 22, amp: 1 << 23, visor: 1 << 24, breath: 1 << 25, songheal: 1 << 26, poison: 1 << 27, shield: 1 << 28 };
const BEAM_COL = { mercy: '#ffe48a', winston: '#9fe8ff', zarya: '#ff8fd0', moira: '#c07bff' };

// ---------- 3D ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 900);
camera.rotation.order = 'YXZ';
function resize() { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

const me = new Player();
const vm = new HeroVM();
const ents = new EntViews(scene);
const pick0 = (() => { try { return JSON.parse(store.get(PICK_KEY) || '{}'); } catch { return {}; } })();
const game = window.watch = {
  me, mode: 'title', map: null, world: null, others: new Map(), myId: 0, team: null, atk: null, mmode: 'assault', phase: null, ps: null, obj: null, h: null, kit: null,
  pick: { map: pick0.map || 'jellymura', size: pick0.size || 5 }, stats: new Map(), cd: {}, ult: 0, flags: 0, deadAt: 0, points: [], gateMeshes: [], cut: null, sel: null,
};
const keys = new Set(); let mouseL = false, mouseR = false, edgeL = false, edgeR = false, relR = false, jumpEdge = false;
const locked = () => !!game.testLock || document.pointerLockElement === $('c');
const has = (k) => !!(game.flags & F[k]);
const myTeamOf = (o) => o.team === game.team;
const enemy = (o) => o && o.team !== game.team;

// ---------- 다른 영웅 ----------
class Other {
  constructor(m) {
    this.id = m.id; this.name = m.name; this.team = m.team; this.bot = m.bot; this.look = m.look;
    this.pos = new THREE.Vector3(); this.tgt = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.flags = 0; this.alive = false; this.hp = 1; this.max = 1; this.temp = 0; this.beamTo = 0;
    this.lastPos = new THREE.Vector3(); this.hero = null; this.size = 1; this.plate = new Plate(m.name, m.team, m.team === game.team); scene.add(this.plate.s);
    this.xray = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ff3b5c', transparent: true, depthTest: false, depthWrite: false, opacity: 0.9 })); this.xray.scale.set(1.2, 2.2, 1); this.xray.renderOrder = 9; this.xray.visible = false; scene.add(this.xray);
    this.feet = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: TEAM_COL[m.team === game.team ? 'blue' : 'red'], transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })); this.feet.rotation.x = -Math.PI / 2; scene.add(this.feet);
  }
  setHero(hid) {
    if (this.hero === hid && this.bear) return;
    this.hero = hid; const h = heroById(hid);
    if (this.bear) scene.remove(this.bear.root); if (this.mech) scene.remove(this.mech);
    this.bear = heroBear(h, { name: this.name, look: this.look }); this.size = this.bear.size; scene.add(this.bear.root);
    this.mech = h.id === 'dva' ? dvaMech() : null; if (this.mech) scene.add(this.mech);
    this.bear.root.visible = this.alive;
  }
  get pilot() { return this.hero !== 'dva' || !!(this.flags & F.pilot); }
  set(st, snap) { const [x, y, z, yaw, pitch, f] = st; this.tgt.set(x, y, z); this.tyaw = yaw; this.pitch = pitch; this.sf = f; if (snap) { this.pos.copy(this.tgt); this.yaw = yaw; } }
  chest() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.mech && !this.pilot ? 1.3 : 1.1 * this.size), this.pos.z); }
  hand() { return new THREE.Vector3(this.pos.x - Math.sin(this.yaw) * 0.5 + Math.cos(this.yaw) * 0.3, this.pos.y + 1.3 * this.size, this.pos.z - Math.cos(this.yaw) * 0.5 - Math.sin(this.yaw) * 0.3); }
  update(dt, t) {
    if (!this.bear) return;
    const k = Math.min(1, dt * 14);
    if (game.cut) { this.pos.copy(this.cutPos || this.pos); this.yaw = this.cutYaw ?? this.yaw; }
    else { if (this.pos.distanceTo(this.tgt) > 8) this.pos.copy(this.tgt); else this.pos.lerp(this.tgt, k); let d = (this.tyaw ?? this.yaw) - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k; }
    const sp = this.pos.distanceTo(this.lastPos) / Math.max(dt, 1e-3); this.lastPos.copy(this.pos);
    // 쓰러짐: 죽으면(체력 0 이어도) 뒤로 넘어졌다가 2초쯤 뒤 바닥으로 스르르 사라진다 · 수면총에 맞으면 옆으로 누워 잔다
    const alive = this.alive && !(this.hp <= 0 && this.max > 0);
    if (alive || game.cut) this.deadT = -1; else if (this.deadT < 0 || this.deadT == null) this.deadT = 0; else this.deadT += dt;
    const fallen = !alive && !game.cut && this.deadT < 2.4, sleep = alive && !game.cut && !!(this.flags & F.sleep);
    this.lie = (this.lie || 0) + ((fallen || sleep ? 1 : 0) - (this.lie || 0)) * Math.min(1, dt * (fallen ? 9 : 6));
    const b = this.bear, mech = this.mech && !this.pilot && alive, ghost = this.flags & F.ghost, show = ((alive || game.cut) && !(ghost && Math.sin(t * 30) > -0.6)) || fallen;
    if (this.mech) { this.mech.visible = mech && show; this.mech.position.copy(this.pos); this.mech.rotation.y = this.yaw + Math.PI; }
    b.root.visible = show;
    b.root.position.copy(this.pos); if (mech) b.root.position.y += 1.35;
    b.root.rotation.order = 'YXZ';
    b.root.rotation.set(fallen ? -this.lie * Math.PI / 2 : 0, this.yaw + Math.PI, sleep ? this.lie * Math.PI / 2 : 0);
    if (this.lie > 0.01) b.root.position.y += this.lie * 0.35 * this.size - (fallen ? Math.max(0, this.deadT - 1.6) * 1.4 : 0); // 넘어진 몸이 바닥에 묻히지 않게 · 사라질 땐 가라앉기
    b.root.scale.setScalar(0.85 * (mech ? 0.55 : this.size) * (this.flags & F.primal ? 1.35 : 1));
    b.setSeated?.(!!mech);
    b.update(dt, mech || this.lie > 0.05 ? 0 : Math.min(9, sp), { noCrawl: true });
    if (!game.cut && !b.emote && this.lie < 0.05) {
      if (b.heldPose !== 'melee') { b.arms[1].rotation.x = -1.45 - this.pitch; b.arms[1].rotation.z = b.arms[1].userData.baseZ * 0.3; b.arms[0].rotation.x = -1.3 - this.pitch; b.arms[0].rotation.z = b.arms[0].userData.baseZ * 0.2 + 0.5; }
      if (this.flags & (F.blossom | F.hogult)) b.root.rotation.y += this.flags & F.blossom ? t * 14 : 0;
    }
    const top = this.pos.y + (mech ? 2.7 : 2.2 * this.size);
    const vis = myTeamOf(this) || this.seen || game.cut;
    this.plate.s.position.set(this.pos.x, top, this.pos.z); this.plate.s.visible = this.alive && vis && !game.cut;
    this.plate.draw(this.hp, this.max, this.temp, 0);
    this.feet.position.set(this.pos.x, this.pos.y + 0.04, this.pos.z); this.feet.visible = this.alive && !game.cut && (myTeamOf(this) || this.seen);
    // 벽 너머로 보이기 (적외선 투시 · 맹독 지뢰)
    const xr = this.alive && enemy(this) && !this.seen && (game.obj?.infra?.[game.team] || this.flags & F.reveal);
    this.xray.visible = !!xr && !game.cut; if (xr) this.xray.position.set(this.pos.x, this.pos.y + 1, this.pos.z);
    // 상태 보기
    this.fxT = (this.fxT || 0) - dt;
    if (this.fxT <= 0 && this.alive && !game.cut && this.pos.distanceTo(camera.position) > 3) {
      this.fxT = 0.12; const c = this.chest();
      if (this.flags & F.bub) puff(scene, c, '#ff9fe0', 1, 1.1, 0.2, 0.2);
      if (this.flags & F.nano) puff(scene, c, '#7cf0ff', 2, 0.5, 1.5, 0.4);
      if (this.flags & F.sleep) puff(scene, c.setY(c.y + 1.2), '#d6c2ff', 1, 0.4, 0.4, 0.8);
      if (this.flags & F.stun) puff(scene, c.setY(c.y + 1.1), '#ffe48a', 2, 0.25, 1, 0.3);
      if (this.flags & F.matrix) puff(scene, c.clone().add(new THREE.Vector3(-Math.sin(this.yaw) * 2, 0.2, -Math.cos(this.yaw) * 2)), '#ff6fd8', 3, 0.8, 1.2, 0.25);
      if (this.flags & F.deflect) puff(scene, c, '#b6ff8a', 2, 0.6, 2, 0.25);
      if (this.flags & F.blossom) for (let i = 0; i < 4; i++) puff(scene, c.clone().add(new THREE.Vector3(Math.cos(t * 9 + i * 1.6) * 3, 0, Math.sin(t * 9 + i * 1.6) * 3)), '#ff4a6a', 2, 0.5, 1, 0.3);
      if (this.flags & F.hogult) for (let i = 0; i < 3; i++) puff(scene, c.clone().add(new THREE.Vector3(-Math.sin(this.yaw) * (2 + i * 2) + (Math.random() - 0.5) * i, 0, -Math.cos(this.yaw) * (2 + i * 2) + (Math.random() - 0.5) * i)), '#d9a066', 2, 0.6, 2, 0.3);
      if (this.flags & F.valk) puff(scene, c.setY(c.y + 0.4), '#ffe48a', 3, 0.5, 2, 0.4);
      if (this.flags & F.blade) puff(scene, this.hand(), '#b6ff8a', 2, 0.35, 1, 0.3);
      if (this.flags & F.ghost) puff(scene, c, '#3a3442', 4, 1, 1.4, 0.5);
      if (this.flags & F.poison) puff(scene, c, '#c47bff', 1, 0.5, 1, 0.5);
      if (this.flags & F.amp) ring(scene, this.pos, '#a6ff5e', 3, 0.4, 0.1);
      if (this.flags & F.primal) puff(scene, c, '#9fe8ff', 1, 0.6, 1, 0.3);
    }
  }
  remove() { for (const o of [this.bear?.root, this.mech, this.plate.s, this.xray, this.feet]) if (o) scene.remove(o); }
  // 맞았나: 머리(공) · 몸(원기둥)
  hit(o, d) {
    const p = this.pos, mech = this.mech && !this.pilot, s = mech ? 1.25 : this.size * (this.flags & F.primal ? 1.3 : 1);
    const hy = p.y + (mech ? 2.0 : 1.62 * s), hr = (mech ? 0.5 : 0.34 * s);
    let best = null;
    const oc = new THREE.Vector3(o.x - p.x, o.y - hy, o.z - p.z), bq = oc.dot(d), cq = oc.lengthSq() - hr * hr, disc = bq * bq - cq;
    if (disc >= 0) { const t = -bq - Math.sqrt(disc); if (t > 0) best = { t, part: 'head' }; }
    const br = mech ? 0.95 : 0.42 * s, top = mech ? 1.9 : 1.38 * s;
    const ax = o.x - p.x, az = o.z - p.z, A = d.x * d.x + d.z * d.z, Bq = 2 * (ax * d.x + az * d.z), C = ax * ax + az * az - br * br, D = Bq * Bq - 4 * A * C;
    if (D >= 0 && A > 1e-6) { const t = (-Bq - Math.sqrt(D)) / (2 * A); const y = o.y + d.y * t; if (t > 0 && y > p.y + 0.05 && y < p.y + top && (!best || t < best.t)) best = { t, part: 'body' }; }
    return best;
  }
  near(p, r) { const c = this.chest(); return c.distanceTo(p) < r + (this.mech && !this.pilot ? 1 : 0.55 * this.size); }
}

// ---------- 조준 · 판정 도우미 (kits 가 쓴다) ----------
const eye = () => me.eye();
const fwd = () => me.forward();
const others = () => [...game.others.values()];
const visible = (o) => o.seen;
function computeSeen() {
  const e = eye(), cf = fwd();
  for (const o of game.others.values()) {
    if (!o.alive) { o.seen = false; continue; }
    const c = o.chest(), d = c.clone().sub(e), L = d.length();
    o.onScreen = d.normalize().dot(cf) > 0.62 && L < 70;
    o.seen = (myTeamOf(o) || L < 90) && (clearLine(game.map, e, c) || clearLine(game.map, e, c.clone().setY(c.y + 0.5)));
  }
}
function findTarget({ range, arc, lock, prev }) {
  const e = eye(), cf = fwd();
  const ok = (o) => o.alive && (lock === 'ally' ? myTeamOf(o) : enemy(o) && !(o.flags & F.ghost)) && o.chest().distanceTo(e) < range && clearLine(game.map, e, o.chest());
  if (prev && ok(prev) && prev.chest().sub(e).normalize().dot(cf) > 0.55) return prev;
  let best = null, bd = arc;
  for (const o of game.others.values()) { if (!ok(o)) continue; const dt = o.chest().sub(e).normalize().dot(cf); if (dt > bd) { bd = dt; best = o; } }
  return best;
}
function coneTargets({ range, arc, ally, from }) {
  const e = from || eye(), cf = fwd(), out = [];
  for (const o of game.others.values()) {
    if (!o.alive || (ally ? !myTeamOf(o) : !enemy(o) || o.flags & F.ghost)) continue;
    const c = o.chest(); if (c.distanceTo(e) > range) continue;
    if (!from && c.clone().sub(e).normalize().dot(cf) < arc) continue;
    if (!clearLine(game.map, e, c)) continue;
    out.push(o);
  }
  return out.sort((a, b) => a.chest().distanceTo(e) - b.chest().distanceTo(e));
}
const muzzle = (i = 0) => { const m = vm.muzzles?.[i % (vm.muzzles.length || 1)] || new THREE.Vector3(0.25, -0.2, -0.8); return m.clone().multiplyScalar(0.9).applyMatrix4(camera.matrixWorld); };
let muzzleI = 0;
// 즉발 사격
function hitscan(sp, { a = 'p', spread, charge, snd } = {}) {
  const e = eye(), f = fwd(), n = sp.pellets || 1, moving = Math.hypot(me.vel.x, me.vel.z) > 1.5;
  let s = spread ?? (sp.spread || 0) + (moving ? 0.008 : 0) + (me.onGround ? 0 : 0.02);
  if (sp.bloom) { game.bloom = Math.min(0.04, (game.bloom || 0) + sp.bloom); s += game.bloom; }
  const entList = ents.list(), hits = new Map(), bars = new Map();
  let aimDir = f;
  if (game.visor) { let best = null, bd = 0.55; for (const o of game.others.values()) { if (!enemy(o) || !o.alive || !o.seen) continue; const dd = o.chest().sub(e).normalize().dot(f); if (dd > bd) { bd = dd; best = o; } } if (best) { aimDir = best.chest().sub(e).normalize(); s = 0; } }
  let firstEnd = null; const mz = muzzle(muzzleI++);
  for (let i = 0; i < n; i++) {
    const ps = n > 1 ? sp.pspread : s;
    const d = aimDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * ps, (Math.random() - 0.5) * 2 * ps, (Math.random() - 0.5) * 2 * ps)).normalize();
    const wallT = rayBoxes(game.map, e, d, 220);
    const bl = blockBy(entList, e, e.clone().addScaledVector(d, wallT), game.team), barT = bl ? bl.t * wallT : Infinity;
    let best = null;
    for (const o of game.others.values()) { if (!o.alive || o === null || (!enemy(o) && !(sp.ally && myTeamOf(o)))) continue; if (enemy(o) && o.flags & F.ghost) continue; const hh = o.hit(e, d); if (hh && hh.t < Math.min(wallT, barT) && (!best || hh.t < best.h.t)) best = { o, h: hh }; }
    const t = best ? best.h.t : Math.min(wallT, barT, 220), p = e.clone().addScaledVector(d, t);
    if (!firstEnd) firstEnd = p;
    if (i < 6) line(scene, mz, p, sp.heal && best && myTeamOf(best.o) ? '#c8ff7a' : h()?.id === 'soldier' ? '#9fe8ff' : h()?.id === 'tracer' ? '#9fe8ff' : '#fff3b0', 0.06, n > 4 ? 0.012 : 0.02);
    if (best) { const k = hits.get(best.o) || { n: 0, head: false }; k.n++; if (best.h.part === 'head') k.head = true; hits.set(best.o, k); }
    else if (bl && barT <= wallT) { bars.set(bl.e.id, (bars.get(bl.e.id) || 0) + 1); puff(scene, p, '#9fe8ff', 2, 0.2, 1.5); }
    else if (wallT < 220) puff(scene, p, '#e8dccb', 2, 0.15, 1.2);
  }
  send({ t: 'fire', o: [mz.x, mz.y, mz.z], to: [firstEnd.x, firstEnd.y, firstEnd.z], heal: !!sp.heal });
  for (const [o, k] of hits) { send({ t: 'hit', to: o.id, a, part: k.head ? 'head' : 'body', n: k.n, charge }); if (!myTeamOf(o)) puff(scene, o.chest(), heroById(o.hero).color, 4, 0.22, 2.5); else puff(scene, o.chest(), '#c8ff7a', 5, 0.3, 2); }
  for (const [id, cnt] of bars) { send({ t: 'hb', e: id, a, n: cnt, charge }); sfx('barrier', null, 0.5); }
  return hits.size;
}
// 근접 (부채꼴)
function melee({ range, arc, a, cleave }) {
  const e = eye(), f = fwd(); f.y *= 0.4; f.normalize();
  const cand = [];
  for (const o of game.others.values()) {
    if (!o.alive || !enemy(o)) continue;
    const c = o.chest(), d = c.clone().sub(e), L = d.length();
    if (L > range + 0.6 * o.size || d.normalize().dot(f) < arc || !clearLine(game.map, e, c)) continue;
    cand.push([o, L]);
  }
  const bl = blockBy(ents.list(), e, e.clone().addScaledVector(f, range), game.team);
  if (bl) { send({ t: 'hb', e: bl.e.id, a: a === 'p' ? 'p' : 'm' }); sfx('barrier'); return 1; }
  cand.sort((x, y) => x[1] - y[1]);
  for (const [o] of cleave ? cand : cand.slice(0, 1)) { send({ t: 'hit', to: o.id, a, part: 'body' }); puff(scene, o.chest(), heroById(o.hero).color, 8, 0.3, 3); }
  return cand.length;
}
// 투사체 (내 것은 판정까지)
const projs = []; let projId = 1;
function fireProj(k, { a = 'p', i = 0, yawOff = 0, jitter = 0, side = 0, pierce, stick } = {}) {
  const P = PROJ[k]; if (!P) return;
  const e = eye(), f = fwd();
  if (yawOff) f.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawOff);
  if (jitter) f.add(new THREE.Vector3((Math.random() - 0.5) * jitter * 2, (Math.random() - 0.5) * jitter * 2, (Math.random() - 0.5) * jitter * 2)).normalize();
  const T = Math.min(rayBoxes(game.map, e, f, 80), 80), aim = e.clone().addScaledVector(f, T);
  let o = muzzle(muzzleI++);
  if (side) o = o.add(new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)).multiplyScalar(side));
  if (!clearLine(game.map, e, o)) o = e.clone();
  const dir = P.grav ? f.clone() : aim.sub(o).normalize();
  const v = dir.multiplyScalar(P.speed); if (P.grav) v.y += P.speed * 0.18;
  const id = projId++;
  const pr = { k, P, mesh: projMesh(k), p: o.clone(), v, life: P.life, mine: true, a, pierce: pierce || P.pierce, stick: stick || P.stick, hitSet: new Set(), id, trailT: 0 };
  pr.mesh.position.copy(o); scene.add(pr.mesh); projs.push(pr);
  send({ t: 'proj', k, o: [o.x, o.y, o.z], v: [v.x, v.y, v.z], i, id });
}
function remoteProj(m) {
  const P = PROJ[m.k]; if (!P) return;
  const pr = { k: m.k, P, mesh: projMesh(m.k), p: new THREE.Vector3(...m.o), v: new THREE.Vector3(...m.v), life: P.life, mine: false, by: m.by, trailT: 0 };
  pr.mesh.position.copy(pr.p); scene.add(pr.mesh); projs.push(pr);
}
function updateProjs(dt) {
  const entList = ents.list();
  for (let i = projs.length - 1; i >= 0; i--) {
    const pr = projs[i], P = pr.P;
    pr.life -= dt;
    let done = pr.life <= 0, hitP = null, to = null, ent = null, head = false;
    const steps = Math.ceil((pr.v.length() * dt) / 0.8) || 1;
    for (let s = 0; s < steps && !done; s++) {
      const h2 = dt / steps;
      if (P.grav) pr.v.y -= 21 * P.grav * h2;
      const a = pr.p.clone(), b = pr.p.clone().addScaledVector(pr.v, h2), seg = b.clone().sub(a), L = seg.length(), d = seg.clone().normalize();
      let tWall = rayBoxes(game.map, a, d, L); if (b.y < 0.02) { const tf = (a.y - 0.02) / Math.max(1e-4, a.y - b.y) * L; tWall = Math.min(tWall, tf); }
      let tHit = tWall;
      if (pr.mine) {
        const bl = blockBy(entList, a, b, game.team); if (bl && bl.t * L < tHit) { tHit = bl.t * L; ent = bl.e; }
        if (P.make !== 'mine') for (const o of game.others.values()) {
          if (!o.alive || pr.hitSet?.has(o.id)) continue;
          const friendly = myTeamOf(o); if (friendly && !(pr.k === 'biotic')) continue;
          if (!friendly && o.flags & F.ghost) continue;
          const c = o.chest(), r = (o.mech && !o.pilot ? 1.1 : 0.55 * o.size) + P.size + (P.wide || 0);
          const t0 = c.clone().sub(a).dot(d); if (t0 < -r || t0 > L + r) continue;
          const cl = a.clone().addScaledVector(d, Math.max(0, Math.min(L, t0)));
          if (cl.distanceTo(c) < r && Math.max(0, t0) < tHit) {
            if (pr.pierce) { pr.hitSet.add(o.id); send({ t: 'pboom', k: pr.k, p: [c.x, c.y, c.z], to: o.id }); puff(scene, c, '#ff9a3c', 10, 0.5, 3); continue; }
            tHit = Math.max(0, t0); to = o; ent = null; head = cl.y > o.pos.y + 1.45 * o.size;
          }
        }
      }
      if (tHit < L) { hitP = a.addScaledVector(d, tHit); done = true; break; }
      pr.p.copy(b);
    }
    pr.mesh.position.copy(pr.p);
    if (pr.mesh.userData.orient) pr.mesh.lookAt(pr.p.clone().add(pr.v));
    if (pr.mesh.userData.spin) pr.mesh.userData.spin.rotation.y += dt * 30;
    if ((pr.trailT -= dt) <= 0) { pr.trailT = 0.03; trailPuff(scene, pr.p, pr.k); }
    if (pr.k === 'hook' && pr.mine) game.hookLine = pr.p.clone();
    if (!done) continue;
    scene.remove(pr.mesh); projs.splice(i, 1);
    if (pr.k === 'hook') game.hookLine = null;
    const p = hitP || pr.p;
    if (!pr.mine) { if (!P.r && !P.make) puff(scene, p, P.color, 4, 0.25, 1.5); continue; }
    if (pr.stick) { if (to) send({ t: 'stick', to: to.id }); else send({ t: 'stick', p: [p.x, p.y, p.z] }); continue; }
    if (!hitP && !(P.burst || P.make)) { continue; }
    if (pr.pierce && !to) continue;
    send({ t: 'pboom', k: pr.k, p: [p.x, p.y, p.z], to: to?.id, e: ent?.id, part: head ? 'head' : 'body' });
    boomFx(pr.k, p);
    if (to && !P.r) puff(scene, p, heroById(to.hero).color, 5, 0.25, 2);
  }
}
function boomFx(k, p) {
  const P = PROJ[k] || {}, near = Math.max(0.1, 1 - p.distanceTo(camera.position) / 60);
  if (k === 'nuke') { explosion(scene, p, 16); flashSphere(scene, p, '#ff9fcf', 22, 0.8); sfx('bigboom', null, 1); shake(1.4 * near + 0.3); return; }
  if (k === 'pulsebomb') { explosion(scene, p, 4); flashSphere(scene, p, '#7cf0ff', 4, 0.4); sfx('boom', null, near); shake(near * 0.8); return; }
  if (k === 'biotic') { flashSphere(scene, p, '#c8ff7a', P.r, 0.45); ring(scene, p, '#c8ff7a', P.r, 0.5, -p.y + 0.05); sfx('heal', null, near); return; }
  if (k === 'grav') { flashSphere(scene, p, '#c79bff', 3, 0.5); sfx('boom', null, near * 0.6); return; }
  if (k === 'flash') { flashSphere(scene, p, '#fff3a0', 3, 0.3); sfx('boom', null, near * 0.5); return; }
  if (k === 'conc') { ring(scene, p, '#bfe6ff', 5, 0.4, 0); flashSphere(scene, p, '#dff2ff', 3, 0.3); sfx('boom', null, near * 0.7); return; }
  if (P.r || P.splash) { flashSphere(scene, p, P.color, (P.r || 2) * 0.9, 0.35); puff(scene, p, '#ffd27a', 8, 0.5, 4, 0.5); puff(scene, p, '#8a8a9a', 5, 0.8, 1.5, 0.8); sfx('boom', null, near * (k === 'mini' || k === 'barrage' ? 0.35 : 0.8)); if (k === 'rocket' || k === 'helix') shake(near * 0.35); return; }
  if (P.make === 'mine') puff(scene, p, '#c47bff', 6, 0.3, 1);
}
function send(m) { shell.send(m); }
game.send = send; game.scene = scene; game.camera = camera; // 점검용
function shake(k) { game.shake = Math.max(game.shake || 0, k); }
function flash(col) { const f = $('flash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = '0.45'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = '0'; })); }
const h = () => game.h;
const G = {
  me, vm, keys, cd: game.cd, send, sfx, say, has, hitscan, fireProj, melee, findTarget, coneTargets, eye, fwd, visible, flash, shake,
  get map() { return game.map; }, get ps() { return game.ps; }, get others() { return game.others; }, get mouseL() { return mouseL; }, get mouseR() { return mouseR; }, get jumpEdge() { return jumpEdge; },
  get gravAt() { return game.gravAt; }, set visor(v) { game.visor = v; }, get visor() { return game.visor; }, set jets(v) { game.jets = v; }, set grapLine(v) { game.grapLine = v; },
  toast: (t) => shell.toast(t, 1500), enemies: () => others().filter((o) => o.alive && enemy(o)),
  puff: (p, c, n) => puff(scene, p, c, n), ring: (p, c, r) => ring(scene, p, c, r), tracer: (p, c) => line(scene, muzzle(), p, c, 0.15, 0.04),
  wave: () => { const p = me.pos.clone().addScaledVector(new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw)), 3); ring(scene, p, '#a6ff5e', 5, 0.4, 1); },
  moveDir: () => { const f2 = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s2 = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0); const v = new THREE.Vector3(-Math.sin(me.yaw) * f2 + Math.cos(me.yaw) * s2, 0, -Math.cos(me.yaw) * f2 - Math.sin(me.yaw) * s2); return v.lengthSq() > 0 ? v.normalize() : v; },
};

// ---------- 입력 ----------
const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyR', 'KeyQ', 'KeyE', 'KeyF', 'KeyV', 'KeyH', 'Space', 'Tab', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'];
function lock() { unlock(); $('c').requestPointerLock?.(); navigator.keyboard?.lock?.(GAME_KEYS).catch?.(() => {}); }
window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && game.mode === 'play' && /^(Key|Digit|Space)/.test(e.code) && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) e.preventDefault(); }, true);
document.addEventListener('pointerlockchange', () => { if (game.mode === 'play') $('lockmsg').classList.toggle('hidden', locked() || !$('select').classList.contains('hidden')); });
$('c').addEventListener('click', () => { if (game.mode === 'play' && !locked() && $('select').classList.contains('hidden')) lock(); });
$('lock-btn').onclick = lock;
$('sens-btn').onclick = () => openSens('watch');
$('fs-btn').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* 무시 */ } lock(); };
$('quit-btn').onclick = () => quit();
$('swap-btn').onclick = () => openSwap();
document.addEventListener('mousemove', (e) => {
  if (!locked() || game.mode !== 'play') return;
  const zoom = scopeZoom();
  const s = 0.0022 * sensOf('watch') / Math.max(1, zoom * 0.8);
  me.yaw -= e.movementX * s; me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - e.movementY * s));
});
document.addEventListener('mousedown', (e) => { if (!locked()) return; if (e.button === 0) { mouseL = true; edgeL = true; } if (e.button === 2) { mouseR = true; edgeR = true; } });
document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseL = false; if (e.button === 2 && mouseR) { mouseR = false; relR = true; } });
document.addEventListener('contextmenu', (e) => { if (game.mode === 'play') e.preventDefault(); });
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (game.mode !== 'play') return;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') { $('scoreboard').classList.remove('hidden'); renderBoard(); return; }
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') jumpEdge = true;
  if (e.code === 'KeyH') { openSwap(); return; }
  if (e.code === 'KeyM') { muteBtn(); return; }
  if (!me.alive || !game.kit || game.phase === 'over') return;
  const now = performance.now();
  if (e.code === 'KeyR') game.kit.reload();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') game.kit.abil('shift', now);
  if (e.code === 'KeyE') game.kit.abil('e', now);
  if (e.code === 'KeyQ') game.kit.abil('q', now);
  if (e.code === 'KeyV' || e.code === 'KeyF') quickMelee(now);
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Tab') $('scoreboard').classList.add('hidden'); });
window.addEventListener('blur', () => { keys.clear(); mouseL = false; if (mouseR) relR = true; mouseR = false; });
function quickMelee(now) {
  if (now < (game.meleeT || 0) || has('stun')) return; game.meleeT = now + 900;
  vm.swing(0.3); sfx('swing'); if (melee({ range: 2.6, arc: 0.55, a: 'm' })) sfx('thud');
}
function muteBtn() { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; shell.syncSound(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = sound.muted ? '🔇' : '🔊';
$('b-quit').onclick = () => quit();
const scopeZoom = () => { if (!mouseR || !me.alive || !game.h) return 1; const s = game.h.s; return s?.type === 'scope' ? s.zoom : 1; };

// ---------- 처음 화면 · 방 ----------
const describe = (o = {}) => { const m = wmapById(o.map); return `${m.emoji} ${m.name} · ${m.mode === 'assault' ? '점령전' : '쟁탈전'} · ${o.size || 5} 대 ${o.size || 5}`; };
function optsUI(el, o, editable, set) {
  el.innerHTML = `<div class="map-pick">${WMAPS.map((m) => `<button data-m="${m.id}" class="${m.id === o.map ? 'on' : ''}" ${editable ? '' : 'disabled'}><b>${m.emoji}</b>${esc(m.name)}<small>${m.mode === 'assault' ? '점령전' : '쟁탈전'}</small></button>`).join('')}</div>
    <div class="note map-desc">${esc(wmapById(o.map).desc)}</div>
    <div class="seg">${[3, 4, 5, 6].map((n) => `<button data-s="${n}" class="${(o.size || 5) === n ? 'on' : ''}" ${editable ? '' : 'disabled'}>${n} 대 ${n}</button>`).join('')}</div>
    <div class="note">빈자리는 젤리봇이 채워요 · 역할은 돌격 · 공격 · 지원</div>`;
  el.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => set({ map: b.dataset.m }); });
  el.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => set({ size: +b.dataset.s }); });
}
function renderTitleOpts() { optsUI($('title-opts'), game.pick, true, (o) => { Object.assign(game.pick, o); store.set(PICK_KEY, JSON.stringify(game.pick)); renderTitleOpts(); loadMap(game.pick.map); }); }
const shell = new Shell({
  sound: { muted: () => sound.muted, toggle: () => { toggleMute(); $('b-mute').textContent = sound.muted ? '🔇' : '🔊'; } },
  key: 'jellyguard', title: '⚡ 젤리수호대', subtitle: '젤리 영웅 16명의 팀 대결!<br>거점을 점령하고 궁극기로 승부를 뒤집어요', wsPath: '/guard-ws', max: 12,
  multiLabel: '👥 같이 하기', roomIcon: '⚡', startLabel: '⚡ 출전!',
  keysHelp: 'WASD 이동 · 마우스 조준 · 클릭 기본 공격 · 우클릭 보조 · Shift · E 기술 · Q 궁극기 · R 장전 · V 근접 · Space 점프 · H 영웅 바꾸기 · Tab 점수판',
  buttons: [{ id: 'practice-btn', label: '🎯 연습전 <small>봇과 바로 대결</small>', onClick: () => practice() }],
  extraRow: [{ label: '📖 영웅 도감', onClick: () => openDex() }, { label: '🖱️ 마우스 감도', onClick: () => openSens('watch') }],
  screens: ['over', 'select', 'dex'],
  describe,
  teamChat: () => true,
  onChatClose: () => { if (game.mode === 'play' && $('select').classList.contains('hidden')) lock(); },
  options: { room: (el, o, host) => optsUI(el, o, host, (n) => shell.send({ t: 'opts', opts: n })) },
  onProfile: (p) => { game.color = p.color; },
  onStart: (m) => start(m),
  onFinish: (m) => results(m),
  onEscape: () => { if (!$('dex').classList.contains('hidden')) { shell.show('title'); return true; } if (!$('scoreboard').classList.contains('hidden')) { $('scoreboard').classList.add('hidden'); return true; } if (game.mode === 'play' && game.phase !== 'select' && !$('select').classList.contains('hidden')) { closeSwap(); return true; } return false; },
  onDisconnect: () => { if (game.mode !== 'title') { shell.toast('🔧 서버 업데이트 중... 잠시 뒤 다시 들어와 주세요', 5000); toTitle(); } },
});
shell.pickOpts = () => ({ map: game.pick.map, size: game.pick.size });
function practice() {
  if (coarse) shell.toast('젤리수호대는 키보드 · 마우스가 있는 PC에서 가장 잘 돼요', 2500);
  shell.sendAfterHello({ t: 'practice', opts: { map: game.pick.map, size: game.pick.size } });
}
function loadMap(id) {
  game.world?.dispose(); for (const g of game.gateMeshes) scene.remove(g); for (const p of game.points) scene.remove(p.g);
  game.map = makeMap(id); game.world = buildMap(scene, game.map);
  // 출발 문 (빛나는 벽)
  game.gateMeshes = game.map.boxes.filter((b) => b.gate).map((b) => { const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshBasicMaterial({ color: '#7cd8ff', transparent: true, opacity: 0.35, depthWrite: false })); m.position.set(b.x, b.y + b.h / 2, b.z); scene.add(m); return m; });
  // 거점 (바닥 원 · 기둥 빛 · 글자)
  game.points = game.map.points.map((pt) => {
    const g = new THREE.Group(); g.position.set(pt.x, pt.y + 0.03, pt.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(pt.r, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false })); disc.rotation.x = -Math.PI / 2; g.add(disc);
    const rim = new THREE.Mesh(new THREE.RingGeometry(pt.r - 0.25, pt.r, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.01; g.add(rim);
    const prog = new THREE.Mesh(new THREE.RingGeometry(pt.r - 0.9, pt.r - 0.35, 64, 1, Math.PI / 2, 0.001), new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); prog.rotation.x = -Math.PI / 2; prog.position.y = 0.02; g.add(prog);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(pt.r, pt.r, 3, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })); wall.position.y = 1.5; g.add(wall);
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = 'rgba(20,10,45,.6)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#fff'; x.font = 'bold 72px Jua, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(pt.id, 64, 68);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); icon.scale.set(1.6, 1.6, 1); icon.position.y = 4.4; icon.renderOrder = 8; g.add(icon);
    scene.add(g); return { pt, g, disc, rim, prog, wall, icon };
  });
}
function updatePoints(t) {
  const o = game.obj; if (!o) return;
  game.points.forEach((P, i) => {
    let col = '#ffffff', k = 0, active = true;
    if (game.mmode === 'assault') {
      active = i === o.pi; const done = i < o.pi;
      col = done ? TEAM_COL[game.atk === game.team ? 'blue' : 'red'] : '#ffffff'; k = done ? 1 : active ? o.prog / 100 : 0;
      if (active && o.prog > 0) col = game.atk === game.team ? '#7cd8ff' : '#ff6a8a';
      P.g.visible = active || done;
    } else {
      col = o.owner ? (o.owner === game.team ? '#7cd8ff' : '#ff6a8a') : '#ffffff';
      k = o.cap?.v ? o.cap.v / 100 : 0; P.prog.material.color.set(o.cap?.team === game.team ? '#7cd8ff' : '#ff6a8a');
      if (o.ph !== 'play') col = '#9a9aa8';
    }
    if (game.mmode === 'assault') P.prog.material.color.set(game.atk === game.team ? '#7cd8ff' : '#ff6a8a');
    P.rim.material.color.set(col); P.disc.material.color.set(col); P.wall.material.color.set(col);
    P.wall.material.opacity = 0.06 + (o.ct && active ? 0.08 * (1 + Math.sin(t * 10)) : 0);
    P.prog.geometry.dispose(); P.prog.geometry = new THREE.RingGeometry(P.pt.r - 0.9, P.pt.r - 0.35, 64, 1, Math.PI / 2, Math.max(0.001, k * Math.PI * 2));
    P.icon.position.y = 4.4 + Math.sin(t * 2) * 0.15;
  });
}

// ---------- 영웅 고르기 ----------
function heroCard(hh, taken, sel) {
  return `<button class="hc ${hh.role}${sel ? ' on' : ''}${taken ? ' taken' : ''}" data-h="${hh.id}" style="--hc:${hh.color}" title="${esc(hh.name)}"><span class="em">${hh.emoji}</span><span class="nm">${esc(hh.name)}</span>${taken ? `<span class="tk">${esc(taken)}</span>` : ''}</button>`;
}
function kitHTML(hh) {
  const row = (k, a) => a ? `<div class="kr"><kbd>${k}</kbd><b>${a.icon || ''} ${esc(a.name)}</b><span>${esc(a.desc || '')}${a.cd ? ` · ${a.cd}초` : ''}</span></div>` : '';
  return `<div class="kd-top" style="--hc:${hh.color}"><span class="kd-em">${hh.emoji}</span><div><div class="kd-nm">${esc(hh.name)} <small>${ROLES[hh.role].icon} ${ROLES[hh.role].name} · 체력 ${hh.hp}</small></div><div class="kd-motto">“${esc(hh.motto)}”</div><div class="kd-desc">${esc(hh.desc)}</div></div></div>
    ${row('클릭', { icon: '🎯', name: hh.p.name, desc: hh.p.type === 'beam' ? '조준한 대상에게 줄기' : hh.p.type === 'melee' ? '앞을 크게 휘둘러요' : hh.p.type === 'spray' ? '앞의 아군을 치유' : hh.p.type === 'proj' ? '투사체 발사' : '즉발 사격' })}
    ${row('우클릭', hh.s ? { icon: hh.s.icon, name: hh.s.name, desc: hh.s.desc || (hh.s.type === 'scope' ? '조준경' : ''), cd: hh.s.cd } : null)}
    ${row('Shift', hh.shift)}${row('E', hh.e)}${row('Q', { ...hh.q, desc: `궁극기 · ${hh.q.desc}` })}`;
}
// 영웅 고르기 · 도감: 고른 영웅 3D 모습이 빙글빙글 (작은 화면 하나)
const pv = { r: null, scene: null, cam: null, bear: null, mech: null, id: null };
function showPreview(id, host) {
  if (!pv.r) {
    const c = document.createElement('canvas'); c.className = 'hero3d'; c.width = 360; c.height = 300;
    pv.r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true }); pv.r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); pv.r.setSize(360, 300, false); pv.r.outputColorSpace = THREE.SRGBColorSpace;
    pv.scene = new THREE.Scene(); pv.scene.add(new THREE.HemisphereLight('#ffffff', '#8a7a9a', 1.8)); const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 3); pv.scene.add(dl);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12 })); floor.rotation.x = -Math.PI / 2; pv.scene.add(floor);
    pv.cam = new THREE.PerspectiveCamera(34, 360 / 300, 0.1, 50); pv.cam.position.set(0, 1.6, 6.2); pv.cam.lookAt(0, 1.2, 0);
  }
  host.prepend(pv.r.domElement);
  if (pv.id === id) return; pv.id = id;
  if (pv.bear) pv.scene.remove(pv.bear.root); if (pv.mech) { pv.scene.remove(pv.mech); pv.mech = null; }
  const h = heroById(id); pv.bear = heroBear(h, { name: h.name }); pv.scene.add(pv.bear.root);
  if (id === 'dva') { pv.mech = dvaMech(); pv.scene.add(pv.mech); pv.bear.root.position.y = 1.35; pv.bear.root.scale.setScalar(0.85 * 0.55); pv.bear.setSeated?.(true); }
  pv.bear.playEmote?.(['ganbare', 'heart', 'apt'][Math.floor(Math.random() * 3)]); setTimeout(() => pv.bear?.playEmote?.(null), 1800);
}
function drawPreview(dt) {
  if (!pv.r || !pv.bear || !pv.r.domElement.isConnected || pv.r.domElement.offsetParent === null) return;
  const a = performance.now() / 1600; pv.bear.root.rotation.y = Math.sin(a) * 0.9; if (pv.mech) pv.mech.rotation.y = pv.bear.root.rotation.y;
  pv.bear.update(dt, 0, {}); pv.r.render(pv.scene, pv.cam);
}
function renderSelect(swap) {
  const mates = [...game.stats.entries()].filter(([, s]) => s.team === game.team);
  const takenBy = (hid) => mates.find(([id, s]) => s.hero === hid && id !== game.myId)?.[1].name;
  const mine = game.stats.get(game.myId)?.hero;
  game.sel = game.sel || mine || store.get(HERO_KEY) || 'soldier';
  $('sel-grid').innerHTML = ['tank', 'dps', 'sup'].map((ro) => `<div class="role"><div class="rh" style="color:${ROLES[ro].color}">${ROLES[ro].icon} ${ROLES[ro].name}</div><div class="rg">${HEROES.filter((x) => x.role === ro).map((x) => heroCard(x, takenBy(x.id), x.id === game.sel)).join('')}</div></div>`).join('');
  $('sel-grid').querySelectorAll('[data-h]').forEach((b) => {
    b.onclick = () => { if (b.classList.contains('taken')) { shell.toast('이미 우리 팀이 고른 영웅이에요'); return; } game.sel = b.dataset.h; sfx('pick'); if (!swap) send({ t: 'pick', h: game.sel }); store.set(HERO_KEY, game.sel); renderSelect(swap); };
  });
  $('sel-kit').innerHTML = kitHTML(heroById(game.sel));
  showPreview(game.sel, $('sel-kit'));
  const m = wmapById(game.map?.id);
  $('sel-head').innerHTML = `${m.emoji} ${esc(m.name)} · ${game.mmode === 'assault' ? (game.atk === game.team ? '⚔️ 공격 — A → B 거점을 점령하세요' : '🛡️ 수비 — 거점을 지키세요') : '🏛️ 쟁탈전 — 가운데 거점을 차지하세요'}`;
  $('sel-team').innerHTML = mates.map(([id, s]) => { const x = s.hero ? heroById(s.hero) : null; return `<div class="tm${id === game.myId ? ' me' : ''}"><span>${x ? x.emoji : '❔'}</span><b>${s.bot ? '🤖 ' : ''}${esc(s.name)}</b><small>${x ? `${ROLES[x.role].icon} ${esc(x.name)}` : '고르는 중…'}</small></div>`; }).join('');
  $('sel-ok').textContent = swap ? '✅ 이 영웅으로 바꾸기' : '✅ 준비 완료';
  $('sel-ok').onclick = () => { if (swap) { if (game.sel !== mine) send({ t: 'pick', h: game.sel }); closeSwap(); } else { if (!mine || mine !== game.sel) send({ t: 'pick', h: game.sel }); send({ t: 'ready' }); $('sel-ok').textContent = '⏳ 다른 사람 기다리는 중…'; } };
  $('sel-close').classList.toggle('hidden', !swap);
}
function openSwap() {
  if (game.mode !== 'play' || game.phase === 'select' || game.phase === 'over') return;
  const rm = game.map.rooms && roomOf(game.team);
  if (me.alive && !inRoom(rm, me.pos.x, me.pos.z)) { shell.toast('🔁 영웅은 출발 방이나 쓰러졌을 때 바꿀 수 있어요', 1800); return; }
  document.exitPointerLock?.(); game.sel = game.stats.get(game.myId)?.hero; renderSelect(true); $('select').classList.remove('hidden'); $('select').classList.add('swap');
}
function closeSwap() { $('select').classList.add('hidden'); $('select').classList.remove('swap'); if (game.mode === 'play') lock(); }
$('sel-close').onclick = closeSwap;
function roomOf(team) { const rm = game.map.rooms; if (game.mmode === 'assault') return team === game.atk ? (game.obj?.pi >= 1 ? rm.atk2 : rm.atk) : (!(game.obj?.pi >= 1) && rm.def1 ? rm.def1 : rm.def); return rm[team]; }
function openDex() {
  game.dexSel = game.dexSel || 'rein';
  const draw = () => { $('dex-grid').innerHTML = ['tank', 'dps', 'sup'].map((ro) => `<div class="role"><div class="rh" style="color:${ROLES[ro].color}">${ROLES[ro].icon} ${ROLES[ro].name}</div><div class="rg">${HEROES.filter((x) => x.role === ro).map((x) => heroCard(x, null, x.id === game.dexSel)).join('')}</div></div>`).join(''); $('dex-kit').innerHTML = kitHTML(heroById(game.dexSel)); showPreview(game.dexSel, $('dex-kit')); $('dex-grid').querySelectorAll('[data-h]').forEach((b) => { b.onclick = () => { game.dexSel = b.dataset.h; sfx('pick'); draw(); }; }); };
  draw(); shell.show('dex');
}
$('dex-back').onclick = () => shell.show('title');

// ---------- 시작 · 메시지 ----------
function start(m) {
  game.mode = 'play'; game.phase = 'select'; game.cut = null; game.obj = null; game.ps = null; game.flags = 0;
  for (const o of game.others.values()) o.remove();
  game.others.clear(); game.stats.clear(); ents.sync([], null);
  game.myId = shell.myId; game.atk = m.atk; game.mmode = m.mode;
  loadMap(m.map);
  for (const mem of m.members) {
    game.stats.set(mem.id, { name: mem.name, team: mem.team, bot: mem.bot, hero: null, k: 0, fb: 0, d: 0, dmg: 0, heal: 0, obj: 0 });
    if (mem.id === game.myId) game.team = mem.team;
  }
  for (const mem of m.members) if (mem.id !== game.myId) game.others.set(mem.id, new Other(mem));
  me.alive = false; game.h = null; game.kit = null; myBear?.root && scene.remove(myBear.root); myBear = null;
  game.selUntil = performance.now() + (m.until || 20000);
  game.sel = null; renderSelect(false); document.exitPointerLock?.();
  shell.hideScreens(); $('select').classList.remove('hidden', 'swap'); $('hud').classList.add('hidden'); $('death').classList.add('hidden'); $('cut').classList.add('hidden');
  if (store.get(HERO_KEY)) setTimeout(() => send({ t: 'pick', h: store.get(HERO_KEY) }), 300);
}

// ---------- 영웅마다 다른 조준점 (오버워치처럼) ----------
const CROSS = {
  rein: '<circle r="3" fill="none" stroke-width="1.5"/>',
  winston: '<circle r="44" fill="none" stroke-dasharray="3 9" stroke-width="2"/><circle r="2.5"/>',
  dva: '<path d="M-24-26A35 35 0 0 0-24 26M24-26A35 35 0 0 1 24 26" fill="none" stroke-width="2.6"/><circle r="2.5"/>',
  hog: '<circle r="34" fill="none" stroke-width="2"/><circle r="2.5"/>',
  zarya: '<circle r="14" fill="none" stroke-width="2"/><circle r="2"/>',
  pharah: '<path d="M0-16V-7M0 7V16M-16 0H-7M7 0H16" stroke-width="2"/><circle r="11" fill="none" stroke-width="1.2" opacity=".6"/>',
  reaper: '<circle r="30" fill="none" stroke-width="2"/><circle r="2"/>',
  cassidy: '<path d="M0-12V-4M0 4V12M-12 0H-4M4 0H12" stroke-width="2"/><circle r="1.6"/>',
  soldier: '<circle r="9" fill="none" stroke-width="1.6"/><path d="M0-15V-11M0 11V15M-15 0H-11M11 0H15" stroke-width="2"/>',
  genji: '<circle cx="-10" r="2.2"/><circle r="2.2"/><circle cx="10" r="2.2"/>',
  widow: '<circle r="2.2"/><circle r="7" fill="none" stroke-width="1" opacity=".6"/>',
  tracer: '<path d="M-14-9Q-20 0-14 9M14-9Q20 0 14 9" fill="none" stroke-width="2.4"/><circle r="1.8"/>',
  mercy: '<circle r="12" fill="none" stroke-width="1.8"/><circle r="2"/>',
  ana: '<circle r="10" fill="none" stroke-width="1.6"/><circle r="2.2"/><path d="M0-16V-12M0 12V16" stroke-width="1.6"/>',
  lucio: '<rect x="-11" y="-11" width="22" height="22" rx="7" fill="none" stroke-width="2"/><circle r="2"/>',
  moira: '<path d="M-22-14A26 26 0 0 0-22 14M22-14A26 26 0 0 1 22 14" fill="none" stroke-width="2.4"/><circle r="2"/>',
  blade: '<path d="M-20 14L20-14" stroke-width="2.5"/><circle r="2"/>',
  primal: '<circle r="22" fill="none" stroke-width="3"/>',
};
function setCross(id) {
  const k = has('blade') ? 'blade' : has('primal') ? 'primal' : id; if (game.crossK === k) return; game.crossK = k;
  $('cross').innerHTML = `<svg viewBox="-50 -50 100 100" width="100" height="100" fill="#fff" stroke="#fff">${CROSS[k] || CROSS.soldier}</svg>`;
}
function setMyHero(hid) {
  const hh = heroById(hid);
  if (game.h?.id !== hid) { game.h = hh; game.kit = makeKit(hh, G); for (const k of Object.keys(game.cd)) delete game.cd[k]; renderAbils(); }
  vm.set(game.kit.vmKind(), hh.color);
}
let myBear = null;
function spawnMe(p, hid) {
  setMyHero(hid);
  me.pos.set(p[0], p[1], p[2]); me.yaw = p[3]; me.pitch = 0; me.vel.set(0, 0, 0); me.alive = true; me.onGround = true;
  game.kit.spawned(); game.flags = 0; sfx('spawn');
  $('death').classList.add('hidden');
  if (!$('select').classList.contains('swap')) $('select').classList.add('hidden');
}
shell.on('pick', (m) => {
  const st = game.stats.get(m.id); if (st) st.hero = m.h;
  const o = game.others.get(m.id); if (o && (game.phase !== 'select')) o.setHero(m.h);
  if (m.id === game.myId) { game.sel = m.h; if (game.phase !== 'select' && !me.alive) setMyHero(m.h); }
  if (!$('select').classList.contains('hidden')) renderSelect($('select').classList.contains('swap'));
});
shell.on('phase', (m) => {
  game.phase = m.ph;
  if (m.ph === 'setup') {
    $('select').classList.add('hidden'); $('hud').classList.remove('hidden');
    for (const o of game.others.values()) { const s = game.stats.get(o.id); if (s?.hero) o.setHero(s.hero); }
    if (!locked()) $('lockmsg').classList.remove('hidden');
    const atkSide = game.atk === game.team;
    banner(game.mmode === 'assault' ? (atkSide ? '⚔️ 공격 준비!' : '🛡️ 수비 준비!') : '🏛️ 거점이 곧 열려요', game.mmode === 'assault' ? (atkSide ? '문이 열리면 A 거점으로!' : '거점을 지킬 자리를 잡아요') : '가운데 거점을 먼저 차지해요');
    sfx('horn');
  }
  if (m.ph === 'play') {
    openGates(game.map); for (const g of game.gateMeshes) scene.remove(g); game.gateMeshes = [];
    banner('⚡ 전투 개시!', game.mmode === 'assault' ? (game.atk === game.team ? 'A 거점을 점령하세요' : 'A 거점을 지키세요') : '거점을 차지하세요'); sfx('horn');
  }
  if (m.ph === 'over') cutscene(m);
});
shell.on('spawn', (m) => {
  const st = game.stats.get(m.id); if (st) st.hero = m.h;
  if (m.id === game.myId) return spawnMe(m.p, m.h);
  const o = game.others.get(m.id); if (!o) return;
  o.setHero(m.h); o.alive = true; o.lie = 0; o.deadT = -1; o.set(m.p, true);
});
shell.on('snap', (m) => { for (const [id, ...st] of m.p) { if (id === game.myId) continue; game.others.get(id)?.set(st); } });
shell.on('ps', (m) => {
  game.obj = m.o;
  for (const p of m.p) {
    const [id, hp, max, temp, ult, flags] = p;
    if (id === game.myId) {
      const was = game.ps?.[4] ?? 0; game.ps = p; game.flags = flags; me.hp = hp;
      if (ult >= 100 && was < 100 && me.alive) { sfx('ultready'); flashUlt(); }
      if (game.kit) { const k = game.kit.vmKind(); if (k !== vm.kind) vm.set(k, game.h.color); }
      continue;
    }
    const o = game.others.get(id); if (!o) continue;
    o.hp = hp; o.max = max; o.temp = temp; o.flags = flags; o.beamTo = p[10] || 0; o.alive = !!p[7];
  }
  ents.sync(m.e || [], game.team);
  if (game.gravAt && !has('grav')) game.gravAt = null;
});
shell.on('sb', (m) => { for (const [id, k, fb, d, dmg, heal, obj] of m.s) { const s = game.stats.get(id); if (s) Object.assign(s, { k, fb, d, dmg, heal, obj }); } });
shell.on('dmg', (m) => {
  if (m.to === game.myId) {
    sfx('hurt', null, 0.7); $('hurt').style.opacity = String(Math.min(1, 0.4 + m.n / 120)); clearTimeout(game.hurtT); game.hurtT = setTimeout(() => { $('hurt').style.opacity = '0'; }, 220);
    if (m.p && m.by !== game.myId) dirMark(m.p);
  }
  if (m.by === game.myId && m.to !== game.myId) {
    const o = game.others.get(m.to);
    if (o) dmgNum(scene, o.chest().setY(o.pos.y + 2.1 * o.size), m.n, m.head);
    const now = performance.now(); if (now - (game.hitSnd || 0) > 70) { game.hitSnd = now; sfx(m.head ? 'head' : 'hit', null, 0.8); }
    const hm = $('hitmark'); hm.classList.toggle('head', !!m.head); hm.classList.remove('hidden'); clearTimeout(game.hitT); game.hitT = setTimeout(() => hm.classList.add('hidden'), 130);
  }
});
shell.on('kill', (m) => {
  const K = game.stats.get(m.by), V = game.stats.get(m.to);
  if (V) V.d++;
  const kh = heroById(m.bh || K?.hero), vh = heroById(m.th || V?.hero), sp = kh && m.a === 'q' ? kh.q : null;
  const icon = m.a === 'q' ? (sp?.icon || '💥') : m.a === 'shift' ? kh?.shift?.icon : m.a === 'e' ? kh?.e?.icon : m.a === 's' ? kh?.s?.icon || '🎯' : m.a === 'm' ? '👊' : m.a === 'dash' ? '⚡' : m.a === 'blade' ? '🐉' : m.a === 'deflect' ? '⚔️' : m.head ? '🎯' : '💥';
  const row = document.createElement('div');
  const col = (s) => (s?.team === game.team ? '#7cd8ff' : '#ff6a8a');
  row.className = m.by === game.myId || m.to === game.myId ? 'me' : '';
  row.innerHTML = m.by === m.to ? `<span style="color:${col(V)}">${vh?.emoji || ''} ${esc(V?.name || '?')}</span> 💫` : `<span style="color:${col(K)}">${kh?.emoji || ''} ${esc(K?.name || '?')}</span> <i>${icon || '💥'}</i> <span style="color:${col(V)}">${vh?.emoji || ''} ${esc(V?.name || '?')}</span>`;
  $('feed').prepend(row); setTimeout(() => row.remove(), 6000); while ($('feed').children.length > 6) $('feed').lastChild.remove();
  const o = game.others.get(m.to); if (o) { o.alive = false; puff(scene, o.chest(), heroById(o.hero)?.color || '#fff', 16, 0.4, 4); }
  if (m.to === game.myId) { me.alive = false; game.deadAt = performance.now(); game.respawnAt = performance.now() + (m.ms || RESPAWN_MS); game.killer = m.by; sfx('die'); showDeath(K, kh, m.by === m.to); }
  if (m.by === game.myId && m.to !== game.myId) { sfx('elim'); elimNote(`💥 처치! ${vh?.emoji || ''} ${V?.name || ''}`); }
  else if (m.as?.includes(game.myId)) elimNote(`🤝 도움 처치 · ${V?.name || ''}`);
  if (m.to !== game.myId && V?.team === game.team && K?.team !== game.team) { /* 아군 쓰러짐 */ }
});
shell.on('proj', (m) => { if (m.by !== game.myId) remoteProj(m); });
shell.on('boom', (m) => { const p = new THREE.Vector3(...m.p); if (m.by === game.myId && !['pulsebomb', 'nuke', 'grav', 'barrage', 'mini'].includes(m.k) && !(PROJ[m.k]?.friendly)) return; boomFx(m.k, p); });
shell.on('fire', (m) => {
  const o = game.others.get(m.by); if (!o) return;
  const to = new THREE.Vector3(m.to.x, m.to.y, m.to.z), from = m.o ? new THREE.Vector3(...m.o) : o.hand();
  line(scene, o.hand(), to, m.heal ? '#c8ff7a' : '#fff3b0', 0.07, 0.02);
  const d = from.distanceTo(me.eye()), hh = heroById(o.hero);
  sfx('gun', { cassidy: 'pistol', reaper: 'heavy', hog: 'heavy', ana: 'sniper', widow: 'sniper', soldier: 'pulse', tracer: 'smg', dva: 'smg' }[hh?.id] || 'rifle', Math.max(0.05, 1 - d / 80) * 0.6);
});
shell.on('fx', (m) => fxEvent(m));
shell.on('cc', (m) => {
  if (m.to !== game.myId) return;
  if (m.k === 'grav') game.gravAt = new THREE.Vector3(...m.p);
  if (m.k === 'stun') banner2('😵 기절!');
  if (m.k === 'sleep') banner2('💤 잠들었어요… (맞으면 깨요)');
  if (m.k === 'grav') banner2('🌀 중력자탄에 끌려가요!');
});
shell.on('kb', (m) => { me.vel.x += m.v[0]; me.vel.y = Math.max(me.vel.y, m.v[1]); me.vel.z += m.v[2]; me.onGround = false; });
shell.on('pull', (m) => { me.pos.set(m.p[0], m.p[1], m.p[2]); me.vel.set(0, 0, 0); banner2('⛓️ 끌려왔어요!'); });
shell.on('reset', (m) => { game.cd[m.s] = 0; sfx('ultready', null, 0.5); });
shell.on('cd', (m) => { game.cd[m.s] = performance.now() + m.ms; });
shell.on('form', (m) => {
  if (m.id === game.myId) { if (m.pilot) { banner2(m.eject ? '🤖 로봇이 부서졌어요! 꼬마 모드' : '☢️ 자폭! 로봇을 날려 보냈어요'); game.kit?.spawned(); } else { banner2('🤖 로봇 호출!'); me.vel.y = 6; } }
  const o = game.others.get(m.id); if (o) puff(scene, o.chest(), '#ff9fcf', 14, 0.5, 4);
});
shell.on('cap', (m) => {
  const mine = m.team === game.team;
  if (m.pt === 'A') { banner(mine ? '🏁 A 거점 점령!' : '⚠️ A 거점을 빼앗겼어요', mine ? 'B 거점으로 진격! 시간 추가' : 'B 거점에서 막아요!'); sfx(mine ? 'cap' : 'lost'); }
  else { banner(mine ? '🏁 거점 확보!' : '⚠️ 거점을 빼앗겼어요', mine ? '지켜 내면 승리에 가까워져요' : '다시 빼앗아요!'); sfx(mine ? 'cap' : 'lost'); }
});
shell.on('toast', (m) => shell.toast(m.text, 1800));
shell.on('gone', (m) => { game.others.get(m.id)?.remove(); game.others.delete(m.id); game.stats.delete(m.id); });

// 기술 · 궁극기 보이기
function fxEvent(m) {
  const by = m.by === game.myId ? null : game.others.get(m.by), p = m.p ? new THREE.Vector3(...m.p) : by?.pos;
  const hh = m.h ? heroById(m.h) : null;
  if (m.k === 'ult') {
    const mineSide = m.team === game.team;
    if (m.by === game.myId) { sfx('ult'); say(hh?.motto); banner2(`${hh.q.icon} ${hh.q.name}!`); }
    else if (hh) {
      sfx(mineSide ? 'ult' : 'enemyult', null, 0.6);
      if (!mineSide && p && p.distanceTo(me.pos) < 40) say(hh.motto, { vol: 0.6 });
      ultNote(`${mineSide ? '🔵' : '🔴'} ${hh.emoji} ${hh.q.icon} ${hh.q.name}`, mineSide);
    }
    if (hh?.id === 'cassidy') { banner2('🌅 해가 진다…'); }
    if (hh?.id === 'rein' && p) { const f = new THREE.Vector3(-Math.sin(m.yaw), 0, -Math.cos(m.yaw)); for (let i = 1; i <= 10; i++) setTimeout(() => { for (const s of [-1, 0, 1]) { const q = p.clone().addScaledVector(f, i * 2).add(new THREE.Vector3(Math.cos(m.yaw) * s * i * 0.35, 0.2, -Math.sin(m.yaw) * s * i * 0.35)); puff(scene, q, '#c9a27a', 3, 0.9, 3, 0.6); } }, i * 40); shake(Math.max(0, 1 - p.distanceTo(me.pos) / 25)); sfx('bigboom', null, 0.5); }
    if (hh?.id === 'lucio' && p) setTimeout(() => ring(scene, p, '#a6ff5e', 30, 0.8, 0.2), 500);
    if (hh?.id === 'winston' && p) puff(scene, p.clone().setY(p.y + 1), '#9fe8ff', 20, 0.6, 4);
    if (hh?.id === 'widow') banner2(mineSide ? '👁️ 적외선 투시! 벽 너머 적이 보여요' : '👁️ 적이 우리를 보고 있어요');
    return;
  }
  if (m.k === 'abil' && by && hh) {
    const c = by.chest();
    if (m.s === 'shift' && ['reaper', 'moira', 'tracer'].includes(hh.id)) puff(scene, c, hh.id === 'reaper' ? '#3a3442' : hh.id === 'moira' ? '#c07bff' : '#9fe8ff', 12, 0.6, 2);
    else if (m.s === 'e' && hh.id === 'reaper' && m.dst) { puff(scene, c, '#3a3442', 14, 0.8, 1.5, 1); puff(scene, new THREE.Vector3(...m.dst).setY(m.dst[1] + 1), '#4a4356', 14, 0.8, 1.5, 1.2); }
    else if (m.s === 's' && hh.id === 'lucio') ring(scene, by.pos.clone().addScaledVector(new THREE.Vector3(-Math.sin(by.yaw), 0, -Math.cos(by.yaw)), 3), '#a6ff5e', 5, 0.4, 1);
    else if (m.s === 'e' && hh.id === 'hog') puff(scene, c, '#ffe0a0', 10, 0.4, 2);
    else puff(scene, c, hh.color, 6, 0.4, 2);
    const d = by.pos.distanceTo(me.pos); if (d < 40) sfx('abil', null, Math.max(0.1, 1 - d / 40) * 0.5);
    return;
  }
  if (m.k === 'land' && p) { ring(scene, p, '#8fd8ff', 4.5, 0.45); sfx('thud', null, 0.6); return; }
  if (m.k === 'swing' && by) { by.bear?.attack('melee'); return; }
  if (m.k === 'break') { const q = new THREE.Vector3(...m.p).setY(m.p[1] + 1.5); puff(scene, q, '#9fe8ff', 20, 0.5, 4); sfx('boom', null, 0.4); return; }
  if (m.k === 'rez') { const t = m.to === game.myId ? me.pos : game.others.get(m.to)?.pos; if (t) { flashSphere(scene, t.clone().setY(t.y + 1), '#ffe48a', 3, 0.8); puff(scene, t.clone().setY(t.y + 2), '#fff3c4', 20, 0.4, 3); } if (m.to === game.myId) banner2('✝️ 되살아났어요!'); sfx('ultready', null, 0.6); return; }
  if (m.k === 'nano') { const t = m.to === game.myId ? me.pos : game.others.get(m.to)?.pos; if (t) flashSphere(scene, t.clone().setY(t.y + 1), '#7cf0ff', 2.5, 0.6); if (m.to === game.myId) banner2('💉 나노 강화! 공격 ↑ 받는 피해 ↓'); return; }
  if (m.k === 'drop') { const t = m.to === game.myId ? me.pos : game.others.get(m.to)?.pos; if (t) puff(scene, t.clone().setY(t.y + 1), '#a6ff5e', 8, 0.5, 2); if (m.to === game.myId) banner2('🎶 소리 방벽!'); return; }
  if (m.k === 'hooked') { if (m.to === game.myId) shake(0.5); return; }
  if (m.k === 'mine') { const q = new THREE.Vector3(...m.p); puff(scene, q, '#c47bff', 16, 0.5, 2); if (m.to === game.myId) banner2('☠️ 맹독 지뢰!'); return; }
}

// ---------- 화면 표시 ----------
function banner(text, sub) { const b = $('banner'); b.classList.add('hidden'); void b.offsetWidth; b.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`; b.classList.remove('hidden'); clearTimeout(game.bannerT); game.bannerT = setTimeout(() => b.classList.add('hidden'), 2600); }
function banner2(text) { const b = $('banner2'); b.classList.add('hidden'); void b.offsetWidth; b.textContent = text; b.classList.remove('hidden'); clearTimeout(game.b2T); game.b2T = setTimeout(() => b.classList.add('hidden'), 1800); }
function elimNote(text) { const d = document.createElement('div'); d.textContent = text; $('elims').prepend(d); setTimeout(() => d.remove(), 2600); while ($('elims').children.length > 3) $('elims').lastChild.remove(); }
function ultNote(text, mine) { const d = document.createElement('div'); d.className = mine ? 'mine' : 'enemy'; d.textContent = text; $('ults').prepend(d); setTimeout(() => d.remove(), 3500); while ($('ults').children.length > 3) $('ults').lastChild.remove(); }
function flashUlt() { const u = $('ult'); u.classList.remove('pop'); void u.offsetWidth; u.classList.add('pop'); }
function dirMark(p) {
  const ang = Math.atan2(-(p[0] - me.pos.x), -(p[1] - me.pos.z)) - me.yaw;
  const i = document.createElement('i'); i.style.transform = `translate(-50%, -50%) rotate(${-ang}rad) translateY(-130px)`;
  $('dirs').appendChild(i); setTimeout(() => i.remove(), 1000);
}
function showDeath(K, kh, self) {
  $('death').classList.remove('hidden');
  $('death-by').innerHTML = self || !K ? '💫 쓰러졌어요' : `💀 <b style="color:#ff6a8a">${kh?.emoji || ''} ${esc(K.name)}</b> 에게 처치당했어요`;
}
function renderAbils() {
  const hh = game.h; if (!hh) return;
  const slot = (k, key, a) => a ? `<div class="ab" data-s="${k}"><span class="ic">${a.icon}</span><kbd>${key}</kbd><b class="cdn"></b><i class="sw"></i></div>` : '';
  const sAbil = hh.s && (hh.s.cd || hh.s.type === 'hold') ? hh.s : null;
  $('abils').innerHTML = slot('s', '우클릭', sAbil) + slot('shift', 'Shift', hh.shift) + slot('e', 'E', hh.e);
  $('hero-em').textContent = hh.emoji; $('hero-nm').textContent = hh.name;
  $('ult-ic').textContent = hh.q.icon;
}
function hud(now) {
  const hh = game.h, ps = game.ps;
  if (hh && ps) {
    const [, hp, max, temp, ult] = ps;
    $('hp-n').textContent = `${Math.round(hp)}`; $('hp-max').textContent = `/ ${max}`;
    const segs = Math.min(30, Math.ceil(max / 25)), k = hp / max, kt = Math.min(1 - k, temp / max);
    if ($('hp-segs').childElementCount !== segs) $('hp-segs').innerHTML = '<i></i>'.repeat(segs);
    [...$('hp-segs').children].forEach((el, i) => { const s0 = i / segs, s1 = (i + 1) / segs; const f = Math.max(0, Math.min(1, (k - s0) / (s1 - s0))), ft = Math.max(0, Math.min(1, (k + kt - s0) / (s1 - s0))); el.style.setProperty('--f', f); el.style.setProperty('--t', ft); });
    $('hp').classList.toggle('low', k < 0.35);
    $('ult').style.setProperty('--u', ult); $('ult').classList.toggle('ready', ult >= 100); $('ult-n').textContent = ult >= 100 ? 'Q' : `${ult}%`;
    for (const el of $('abils').children) {
      const s = el.dataset.s, left = Math.max(0, (game.cd[s] || 0) - now), cdS = (s === 's' ? hh.s?.cd : hh[s]?.cd) || 1;
      el.classList.toggle('cool', left > 0); el.querySelector('.cdn').textContent = left > 0 ? Math.ceil(left / 1000) : '';
      el.querySelector('.sw').style.height = `${Math.min(100, (left / 1000 / cdS) * 100)}%`;
      if (s === 'shift' && hh.id === 'tracer') el.querySelector('.cdn').textContent = `${game.kit.st.blinks}`;
      el.classList.toggle('on', (s === 's' && mouseR && hh.s?.type === 'hold') || (s === 'shift' && hh.id === 'lucio' && !has('songheal')));
    }
    const a = game.kit.ammo(); $('ammo-n').textContent = a.big; $('ammo-r').textContent = a.small;
    const ex = game.kit.extra(); $('extra').classList.toggle('hidden', !ex);
    if (ex) $('extra').innerHTML = `${esc(ex.label || '')}${ex.bar != null ? `<span class="bar"><i style="width:${Math.round(ex.bar * 100)}%"></i></span>` : ''}${ex.pips != null ? `<span class="pips">${'●'.repeat(ex.pips)}${'○'.repeat(3 - ex.pips)}</span>` : ''}`;
    // 상태
    const tags = []; if (has('nano')) tags.push('💉 나노'); if (has('boost')) tags.push('💛 공격력 강화'); if (has('anti')) tags.push('🚫 치유 차단'); if (has('hboost')) tags.push('💚 치유 증가'); if (has('spd')) tags.push('💨 속도'); if (has('poison')) tags.push('☠️ 독'); if (has('bub')) tags.push('🫧 보호막'); if (has('grav')) tags.push('🌀 중력');
    $('tags').innerHTML = tags.map((t) => `<span>${t}</span>`).join('');
  }
  // 거점 · 시간
  const o = game.obj;
  if (o) {
    const left = Math.max(0, o.left / 1000), tt = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const atkSide = game.atk === game.team;
    if (game.mmode === 'assault') {
      const circ = (id, i) => { const done = i < o.pi, act = i === o.pi, k = done ? 100 : act ? o.prog : 0; return `<div class="pt${act ? ' act' : ''}${done ? ' done' : ''}${act && o.ct ? ' ct' : ''}" style="--k:${k};--c:${atkSide ? '#7cd8ff' : '#ff6a8a'}"><b>${done ? '✔' : id}</b></div>`; };
      $('obj').innerHTML = `<div class="ob-row">${circ('A', 0)}<div class="ob-mid"><div class="ob-t">${o.ph === 'setup' ? `준비 ${tt}` : tt}</div><div class="ob-s">${o.ot ? '⏱️ 연장전!' : o.ct ? '⚔️ 경합 중!' : o.ph === 'setup' ? (atkSide ? '곧 문이 열려요' : '수비 자리를 잡아요') : atkSide ? (o.atkN ? `점령 중 ×${o.atkN}` : '거점을 점령하세요') : (o.atkN ? '⚠️ 적이 점령 중!' : '거점을 지키세요')}</div></div>${circ('B', 1)}</div><div class="ob-role">${atkSide ? '⚔️ 공격' : '🛡️ 수비'}</div>`;
    } else {
      const us = o.pct[game.team] || 0, them = o.pct[game.team === 'red' ? 'blue' : 'red'] || 0;
      const ownCol = o.owner ? (o.owner === game.team ? '#7cd8ff' : '#ff6a8a') : '#ffffff';
      $('obj').innerHTML = `<div class="ob-row"><div class="pc us">${us}%</div><div class="pt act${o.ct ? ' ct' : ''}" style="--k:${o.cap?.v || 0};--c:${o.cap?.team === game.team ? '#7cd8ff' : '#ff6a8a'};border-color:${ownCol}"><b>${o.ph === 'setup' ? '🔒' : 'C'}</b></div><div class="pc them">${them}%</div></div><div class="ob-s">${o.ph === 'setup' ? `거점 열림까지 ${tt}` : o.ot ? '⏱️ 연장전!' : o.ct ? '⚔️ 경합 중!' : o.owner ? (o.owner === game.team ? '🔵 우리 팀 거점' : '🔴 적 팀 거점') : '거점을 차지하세요'}${o.ph === 'setup' ? '' : ` · ${tt}`}</div>`;
    }
  }
  // 위쪽 영웅 목록 (우리 팀 왼쪽 · 적 팀 오른쪽)
  if ((game.teamT = (game.teamT || 0) - 1) <= 0) {
    game.teamT = 10;
    const rows = (team) => [...game.stats.entries()].filter(([, s]) => s.team === team).map(([id, s]) => { const x = s.hero ? heroById(s.hero) : null, o = game.others.get(id), alive = id === game.myId ? me.alive : o?.alive; return `<span class="th${alive ? '' : ' dead'}${id === game.myId ? ' me' : ''}" title="${esc(s.name)}">${x?.emoji || '❔'}</span>`; }).join('');
    $('tm-us').innerHTML = rows(game.team); $('tm-them').innerHTML = rows(game.team === 'red' ? 'blue' : 'red');
  }
  // 죽었을 때 부활 시간
  if (!me.alive && game.phase !== 'over' && game.phase !== 'select') $('death-t').textContent = Math.max(0, Math.ceil((game.respawnAt - now) / 1000)) || '';
  // 조준점
  const c = $('cross'); c.classList.toggle('hidden', !me.alive || scopeZoom() > 2);
  $('scope').classList.toggle('hidden', !(me.alive && scopeZoom() > 2));
  if (game.h) setCross(game.h.id);
  c.classList.toggle('lock', !!(game.kit?.st.beams?.length || game.kit?.st.beamsS?.length));
  c.classList.toggle('heal', !!(game.kit?.st.beams?.length && ['mercy', 'moira'].includes(game.h?.id)));
  // 화면 테두리: 내 상태 (망령화 · 보호막 · 나노 · 강화 · 용검 · 발키리 · 원시 · 무법자 · 조준경 · 튕겨내기 · 기절 · 수면 · 중력 · 시간 역행)
  const ov = $('ov');
  for (const k of ['ghost', 'bub', 'nano', 'boost', 'blade', 'valk', 'primal', 'deadeye', 'visor', 'deflect', 'stun', 'sleep', 'grav', 'anti', 'amp', 'coal', 'blossom', 'hogult', 'breath', 'barrage']) ov.classList.toggle(k, me.alive && has(k));
  ov.classList.toggle('recall', game.kit?.st.mode === 'recall'); ov.classList.toggle('dash', ['charge', 'boost', 'dash', 'roll', 'ga', 'grap', 'leap'].includes(game.kit?.st.mode)); ov.classList.toggle('tp', game.kit?.st.mode === 'tp' || game.kit?.st.aim === 'tp');
  drawAims(now);
}

// ---------- 기술 조준 도움: 그림자 밟기 착지 자리 · 아군 대상 · 갈고리 · 황야의 무법자 해골 · 전술 조준경 ----------
const tpMark = new THREE.Group();
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 40), new THREE.MeshBasicMaterial({ color: '#b07cff', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 6; tpMark.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: '#2a1440', transparent: true, opacity: 0.45, depthTest: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; disc.renderOrder = 5; tpMark.add(disc);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#7a4cc0', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); col.position.y = 1; tpMark.add(col);
  tpMark.userData = { ring, col }; tpMark.visible = false; scene.add(tpMark);
}
// 방어 매트릭스: 앞으로 뻗는 분홍 그물 부채꼴 (면 + 격자 선)
const matrixFan = new THREE.Group();
{
  const geo = new THREE.CylinderGeometry(2.2, 0.35, 10, 16, 4, true); geo.rotateX(Math.PI / 2); geo.translate(0, -0.25, -6);
  matrixFan.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff5fd0', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })));
  matrixFan.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff9fe8', transparent: true, opacity: 0.28, wireframe: true, depthWrite: false })));
  matrixFan.visible = false; scene.add(matrixFan);
}
const auraRing = new THREE.Mesh(new THREE.RingGeometry(11.6, 12, 64), new THREE.MeshBasicMaterial({ color: '#a6ff5e', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); auraRing.rotation.x = -Math.PI / 2; auraRing.visible = false; scene.add(auraRing);
const scr = (v) => { const p = v.clone().project(camera); return p.z < 1 ? [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight] : null; };
function drawAims(now) {
  const list = me.alive && game.kit ? game.kit.aims() : [];
  const tp = list.find((a) => a.k === 'tp');
  tpMark.visible = !!tp;
  if (tp) { tpMark.position.copy(tp.p); const c = tp.ok ? '#b07cff' : '#ff5a6e'; tpMark.userData.ring.material.color.set(c); tpMark.userData.col.material.color.set(tp.ok ? '#7a4cc0' : '#c03a4a'); tpMark.userData.ring.scale.setScalar(1 + Math.sin(now / 120) * 0.06); }
  $('aimhint').classList.toggle('hidden', !tp); if (tp) $('aimhint').textContent = tp.ok ? '🌑 클릭 · E: 그림자 밟기   우클릭: 취소' : '🌑 여기는 갈 수 없어요';
  // 화면 위 표시 (아군 대상 · 해골 · 조준경 고정)
  const html = [];
  for (const a of list) {
    if (a.k === 'ally') { const q = scr(a.o.chest().setY(a.o.pos.y + 2.4 * a.o.size)); if (q) html.push(`<div class="mk ally" style="left:${q[0]}px;top:${q[1]}px;--c:${a.col}"><i></i><span>${esc(a.label)} ${esc(a.o.name)}</span></div>`); }
    if (a.k === 'dead') { const q = scr(a.o.chest().setY(a.o.pos.y + 1.7 * a.o.size)); if (q) html.push(`<div class="mk skull${a.kill ? ' kill' : ''}" style="left:${q[0]}px;top:${q[1]}px;--k:${Math.min(1, a.v / Math.max(1, a.o.hp + a.o.temp))}">💀</div>`); }
  }
  if (game.visor && me.alive) { let best = null, bd = 0.55; const e = eye(), f = fwd(); for (const o of game.others.values()) { if (!enemy(o) || !o.alive || !o.seen) continue; const dd = o.chest().sub(e).normalize().dot(f); if (dd > bd) { bd = dd; best = o; } } if (best) { const q = scr(best.chest()); if (q) html.push(`<div class="mk lockon" style="left:${q[0]}px;top:${q[1]}px"></div>`); } }
  $('marks').innerHTML = html.join('');
  const g = list.find((a) => a.k === 'grap'); $('grap').classList.toggle('hidden', !g); if (g) $('grap').classList.toggle('ok', g.ok);
  // 디바 방어 매트릭스: 앞에 분홍 부채꼴 · 둥둥: 곡이 닿는 범위
  matrixFan.visible = me.alive && game.h?.id === 'dva' && has('matrix');
  if (matrixFan.visible) { matrixFan.position.copy(camera.position); matrixFan.quaternion.copy(camera.quaternion); matrixFan.children[0].material.opacity = 0.18 + Math.sin(now / 60) * 0.05; }
  auraRing.visible = me.alive && game.h?.id === 'lucio';
  if (auraRing.visible) { auraRing.position.set(me.pos.x, me.pos.y + 0.06, me.pos.z); auraRing.material.color.set(has('songheal') ? '#a6ff5e' : '#ffd84d'); auraRing.material.opacity = has('amp') ? 0.7 : 0.3; }
}
function renderBoard() {
  const rows = (team) => [...game.stats.entries()].filter(([, s]) => s.team === team).map(([id, s]) => { const x = s.hero ? heroById(s.hero) : null; return `<tr class="${id === game.myId ? 'me' : ''}"><td>${x?.emoji || '❔'} ${s.bot ? '🤖 ' : ''}${esc(s.name)}</td><td>${s.k}</td><td>${s.fb}</td><td>${s.d}</td><td>${s.dmg}</td><td>${s.heal}</td><td>${s.obj}s</td></tr>`; }).join('');
  const table = (team, title) => `<h3 style="color:${team === game.team ? '#7cd8ff' : '#ff6a8a'}">${title}</h3><table><tr><th>영웅</th><th>처치</th><th>결정타</th><th>죽음</th><th>피해</th><th>치유</th><th>거점</th></tr>${rows(team)}</table>`;
  $('scoreboard').innerHTML = table(game.team, `🔵 우리 팀 · ${TEAMS[game.team]?.name || ''}`) + table(game.team === 'red' ? 'blue' : 'red', '🔴 적 팀');
}

// ---------- 승리 · 패배 컷신 ----------
const EMOTES = ['ganbare', 'apt', 'heart', 'shuffle', 'slickback', 'creamcheese'];
function cutscene(m) {
  const win = m.winner === game.team, draw = m.winner === 'draw';
  document.exitPointerLock?.(); game.mode = 'cut';
  for (const id of ['hud', 'death', 'lockmsg', 'scoreboard', 'scope', 'select']) $(id).classList.add('hidden');
  // 이긴 팀(비기면 우리 팀)이 거점 앞에 줄을 서서 춤춘다
  const team = draw ? game.team : m.winner;
  const pt = game.map.points[Math.min(game.obj?.pi ?? 0, game.map.points.length - 1)];
  const lineup = [...game.stats.entries()].filter(([, s]) => s.team === team);
  const mvp = m.mvp;
  lineup.sort((a, b) => (a[0] === mvp ? -1 : b[0] === mvp ? 1 : 0));
  const base = new THREE.Vector3(pt.x, floorAt(game.map, pt.x, pt.z, pt.y + 1), pt.z), face = 0;
  const slots = lineup.map((_, i) => { const row = i === 0 ? 0 : 1, col = i === 0 ? 0 : ((i - 1) % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.7; return new THREE.Vector3(base.x + col, base.y, base.z + row * 1.6); });
  lineup.forEach(([id, s], i) => {
    let o = id === game.myId ? null : game.others.get(id);
    if (id === game.myId) { myBear = heroBear(heroById(s.hero || 'soldier'), { name: s.name }); scene.add(myBear.root); o = { bear: myBear, me: true }; }
    if (!o?.bear) return;
    const p = slots[i]; p.y = floorAt(game.map, p.x, p.z, p.y + 1.5);
    if (o.me) { myBear.root.position.copy(p); myBear.root.rotation.y = face + Math.PI; myBear.root.scale.setScalar(0.85 * myBear.size); } else { o.cutPos = p; o.cutYaw = face; o.alive = true; o.flags = 0; }
    o.bear.playEmote(EMOTES[i % EMOTES.length]); o.bear.setSeated?.(false);
  });
  for (const o of game.others.values()) if (o.team !== team) { o.cutPos = o.pos.clone().setY(-50); }
  game.cut = { t: 0, base, win, draw, mvp };
  for (const P of game.points) P.icon.visible = false;
  $('cut').classList.remove('hidden');
  $('cut-big').className = draw ? 'draw' : win ? 'win' : 'lose';
  $('cut-big').textContent = draw ? '무승부' : win ? '승리!' : '패배';
  $('cut-sub').textContent = `${wmapById(game.map.id).emoji} ${wmapById(game.map.id).name} · ${m.why || ''}`;
  $('cut-mvp').classList.add('hidden');
  const ms = m.stats?.find((s) => s.id === mvp);
  if (ms) setTimeout(() => {
    if (!game.cut) return;
    const x = heroById(ms.hero);
    $('cut-mvp').innerHTML = `<div class="mv-t">⭐ 최고의 플레이어</div><div class="mv-em" style="--hc:${x.color}">${x.emoji}</div><div class="mv-nm">${ms.bot ? '🤖 ' : ''}${esc(ms.name)}<small>${esc(x.name)}</small></div><div class="mv-st"><span>💥 ${ms.k}<small>처치</small></span><span>🔥 ${ms.dmg}<small>피해</small></span><span>💚 ${ms.heal}<small>치유</small></span><span>🏁 ${ms.obj}s<small>거점</small></span></div>`;
    $('cut-mvp').classList.remove('hidden'); sfx('cap');
  }, 4200);
  sfx(win || draw ? 'win' : 'lose'); say(draw ? '무승부' : win ? '승리!' : '패배', { pitch: win ? 1.4 : 0.9 });
}
function updateCut(dt) {
  const c = game.cut; c.t += dt;
  const k = Math.min(1, c.t / 4), ease = 1 - (1 - k) ** 3;
  const R = 16 - ease * 6.5, a = -Math.PI / 2 - 0.5 + ease * 0.5 + Math.max(0, c.t - 4) * 0.08;
  camera.position.set(c.base.x + Math.cos(a) * R * 0.6, c.base.y + 3.2 - ease * 1.4, c.base.z - Math.sin(a) * R);
  camera.lookAt(c.base.x, c.base.y + 1.2, c.base.z + 0.6);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  if (myBear) myBear.update(dt, 0, { noCrawl: true });
  if (c.win && Math.random() < dt * 6) puff(scene, c.base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 3, (Math.random() - 0.5) * 4)), ['#ff8fc4', '#ffd84d', '#7cd8ff', '#9be7a7'][Math.floor(Math.random() * 4)], 3, 0.3, 3, 1.2);
}

// ---------- 결과 · 나가기 ----------
function results(m) {
  game.mode = 'over';
  const win = m.winner === game.team, draw = m.winner === 'draw';
  $('ov-title').innerHTML = draw ? '🤝 무승부' : win ? '🏆 승리!' : '💧 패배';
  $('ov-title').className = draw ? 'draw' : win ? 'win' : 'lose';
  const mm = wmapById(m.map);
  $('ov-me').textContent = `${mm.emoji} ${mm.name} · ${m.mode === 'assault' ? (m.atk === game.team ? '공격' : '수비') : `쟁탈전 ${m.pct?.[game.team] ?? 0}% : ${m.pct?.[game.team === 'red' ? 'blue' : 'red'] ?? 0}%`} · ${m.why || ''}`;
  const tbl = (team, title) => `<h3 style="color:${team === game.team ? '#7cd8ff' : '#ff6a8a'}">${title}</h3><table><tr><th>영웅</th><th>처치</th><th>죽음</th><th>피해</th><th>치유</th><th>거점</th></tr>${m.stats.filter((s) => s.team === team).map((s) => { const x = heroById(s.hero); return `<tr class="${s.id === game.myId ? 'me' : ''}${s.id === m.mvp ? ' mvp' : ''}"><td>${x.emoji} ${s.id === m.mvp ? '⭐ ' : ''}${s.bot ? '🤖 ' : ''}${esc(s.name)}</td><td>${s.k}</td><td>${s.d}</td><td>${s.dmg}</td><td>${s.heal}</td><td>${s.obj}s</td></tr>`; }).join('')}</table>`;
  $('ov-rank').innerHTML = tbl(game.team, '🔵 우리 팀') + tbl(game.team === 'red' ? 'blue' : 'red', '🔴 적 팀');
  $('cut').classList.add('hidden');
  shell.show('over');
}
$('again-btn').onclick = () => { endCut(); game.mode = 'room'; shell.backToRoom(); };
$('home-btn').onclick = () => quit();
function endCut() { game.cut = null; for (const P of game.points) P.icon.visible = true; if (myBear) { scene.remove(myBear.root); myBear = null; } for (const o of game.others.values()) { o.bear?.playEmote(null); o.cutPos = null; } }
function quit() { send({ t: 'leave' }); shell.room = null; toTitle(); }
function toTitle() {
  endCut(); game.mode = 'title'; shell.multi = false; shell.playing = false; document.exitPointerLock?.();
  for (const id of ['hud', 'death', 'lockmsg', 'scoreboard', 'scope', 'select', 'cut']) $(id).classList.add('hidden');
  for (const o of game.others.values()) o.remove(); game.others.clear(); ents.sync([], null);
  for (const p of projs) scene.remove(p.mesh); projs.length = 0;
  shell.show('title'); renderTitleOpts(); loadMap(game.pick.map);
}

// ---------- 줄기 그리기 ----------
const beamPool = []; let beamUsed = 0;
function beam(a, b, col, w = 0.06, wob = 0) { let g = beamPool[beamUsed]; if (!g) { g = beamMesh(col, w); beamPool.push(g); scene.add(g); } beamUsed++; g.visible = true; g.children[0].material.color.set(col); g.userData.w = w; setBeam(g, a, b, wob); }
// 번개 (통통박사 테슬라): 꺾인 줄 몇 가닥
function bolt(a, b, col = '#bfefff') {
  for (let k = 0; k < 2; k++) {
    let prev = a.clone(); const n = 7;
    for (let i = 1; i <= n; i++) { const p = a.clone().lerp(b, i / n); if (i < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)); line(scene, prev, p, col, 0.05, 0.02); prev = p; }
  }
}
function drawBeams(t) {
  beamUsed = 0;
  const kit = game.kit;
  if (kit && me.alive && game.mode === 'play') {
    // 내 줄기: 총구 조금 앞에서 · 가늘게 (화면 앞을 가리지 않게)
    const mz = muzzle(0).addScaledVector(fwd(), 0.5), col = game.h.id === 'mercy' ? '#ffe48a' : BEAM_COL[game.h.id] || '#ffffff';
    for (const o of kit.st.beams || []) { if (game.h.id === 'winston') bolt(mz, o.chest()); else beam(mz, o.chest(), col, 0.035, 0.2); }
    for (const o of kit.st.beamsS || []) beam(mz, o.chest(), game.h.id === 'mercy' ? '#ffb347' : '#c07bff', 0.035, 0.2);
    if (mouseL && kit.st.beamFree && game.h.id === 'zarya') beam(mz, eye().addScaledVector(fwd(), Math.min(15, rayBoxes(game.map, eye(), fwd(), 15))), '#ff8fd0', 0.035, 0.3);
    if (mouseL && game.h.id === 'winston' && !kit.st.beams?.length && !has('primal')) for (let i = 0; i < 2; i++) { const d = fwd().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.5)); bolt(mz, eye().addScaledVector(d, 7)); }
    if (mouseL && game.h.id === 'moira' && kit.st.spray && Math.random() < 0.6) puff(scene, eye().addScaledVector(fwd(), 2 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2)), '#ffe48a', 1, 0.6, 0.5, 0.4);
    kit.st.spray = false;
    if (has('coal')) { const e = eye(), end = e.clone().addScaledVector(fwd(), 30); beam(mz, end, '#c07bff', 0.07, 0.15); beam(muzzle(1).addScaledVector(fwd(), 0.5), end, '#ffe48a', 0.05, 0.15); }
    if (game.hookLine) beam(mz, game.hookLine, '#8a8a99', 0.03);
    if (game.grapLine && kit.st.mode === 'grap') beam(mz, game.grapLine, '#9466e0', 0.02);
    if (game.jets) puff(scene, me.pos.clone().setY(me.pos.y + 0.2), '#9fd8ff', 1, 0.4, 0.5, 0.3);
    // 내 궁극기 입자: 죽음의 꽃(빙글) · 돼지우리(앞으로 고철) · 발키리(금빛 날개)
    if (has('blossom') && Math.random() < 0.8) for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; puff(scene, me.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3.5, 1.2, Math.sin(a) * 3.5)), '#ff4a6a', 1, 0.6, 1, 0.3); }
    if (has('hogult')) { const f = fwd(); for (let i = 0; i < 2; i++) puff(scene, eye().addScaledVector(f, 2 + Math.random() * 10).add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4)), '#d9a066', 1, 0.5, 2, 0.3); }
    if (has('valk') && Math.random() < 0.5) puff(scene, eye().add(new THREE.Vector3(Math.cos(me.yaw) * (Math.random() < 0.5 ? -1 : 1) * 1.2, -0.3, -Math.sin(me.yaw) * 0.5)), '#ffe48a', 1, 0.35, 1, 0.5);
  }
  for (const o of game.others.values()) {
    if (!o.alive || !o.bear?.root.visible) continue;
    const hh = heroById(o.hero);
    if (o.beamTo) {
      const t2 = o.beamTo === game.myId ? me.pos.clone().setY(me.pos.y + 1.1) : game.others.get(o.beamTo)?.chest();
      const tTeam = o.beamTo === game.myId ? game.team : game.others.get(o.beamTo)?.team;
      if (t2 && hh.id === 'winston') bolt(o.hand(), t2);
      else if (t2) beam(o.hand(), t2, hh.id === 'mercy' ? '#ffe48a' : hh.id === 'moira' ? (tTeam === o.team ? '#ffe48a' : '#c07bff') : BEAM_COL[hh.id] || '#ffffff', 0.06, 0.2);
    }
    if (o.flags & F.coal) { const d = new THREE.Vector3(-Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), -Math.cos(o.yaw) * Math.cos(o.pitch)); beam(o.hand(), o.hand().addScaledVector(d, 30), '#c07bff', 0.16, 0.15); }
  }
  for (let i = beamUsed; i < beamPool.length; i++) beamPool[i].visible = false;
}

// ---------- 매 프레임 ----------
const clock = new THREE.Clock();
let t = 0, sendT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()), now = performance.now();
  t += dt;
  if (game.mode === 'play' && game.phase !== 'select') {
    computeSeen();
    const typing = !locked();
    const inp = { f: typing ? 0 : (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s: typing ? 0 : (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), jump: !typing && keys.has('Space'), crouch: keys.has('KeyC') || keys.has('ControlLeft'), sprint: false, ads: false };
    if (me.alive && game.kit) {
      game.kit.tick(dt, now, inp);
      for (const e of me.update(dt, inp, game.map)) sfx(e, null, e === 'step' ? 0.5 : 0.8);
      if (me.pos.y < -20) me.pos.y = 5;
      if (!typing) { game.kit.primary(now, mouseL, edgeL); game.kit.secondary(now, mouseR, edgeR, relR); }
      else if (relR) game.kit.secondary(now, false, false, true);
      game.bloom = Math.max(0, (game.bloom || 0) - dt * 0.06);
    }
    edgeL = edgeR = relR = jumpEdge = false;
    updateProjs(dt);
    for (const o of game.others.values()) o.update(dt, t);
    ents.update(dt);
    updatePoints(t);
    // 카메라: 살아 있으면 눈 · 죽으면 쓰러진 자리 위에서 천천히
    // 잠들면 내 눈도 바닥으로 · 옆으로 기울어진다
    game.zz = (game.zz || 0) + ((me.alive && has('sleep') ? 1 : 0) - (game.zz || 0)) * Math.min(1, dt * 5);
    if (me.alive) { camera.position.copy(me.viewEye()); camera.position.y -= game.zz * 1.15; camera.rotation.set(me.pitch * (1 - game.zz), me.yaw, game.zz * 1.25); }
    else { const a = t * 0.25, c = me.pos; camera.position.set(c.x + Math.cos(a) * 7, c.y + 5, c.z + Math.sin(a) * 7); camera.lookAt(c.x, c.y + 1, c.z); }
    if (game.shake > 0) { game.shake = Math.max(0, game.shake - dt * 1.8); const k = game.shake * game.shake * 0.3; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; camera.rotation.z += (Math.random() - 0.5) * k * 0.3; }
    const fov = 78 / scopeZoom();
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
    vm.update(dt, camera.aspect, Math.hypot(me.vel.x, me.vel.z) > 1.5 && me.onGround, mouseR && game.h?.s?.type === 'scope', game.h?.id === 'moira' ? (mouseL ? 'L' : mouseR ? 'R' : null) : mouseL && !!game.kit?.st.beams?.length);
    sendT -= dt;
    if (sendT <= 0 && me.alive) { sendT = 0.05; shell.send({ t: 'st', p: [me.pos.x, me.pos.y, me.pos.z, me.yaw, me.pitch, (me.crouch > 0.5 ? 1 : 0) | (Math.hypot(me.vel.x, me.vel.z) > 1 ? 2 : 0)] }); }
    hud(now);
  } else if (game.cut) {
    for (const o of game.others.values()) o.update(dt, t);
    updateCut(dt);
  } else if (game.map && game.mode !== 'look') {
    const a = t * 0.05, R = Math.max(game.map.W, game.map.D) * 0.5;
    camera.position.set(Math.cos(a) * R, 30, Math.sin(a) * R); camera.lookAt(0, 0, 0);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    if (game.phase === 'select') { const left = Math.max(0, Math.ceil((game.selUntil - now) / 1000)); $('sel-time').textContent = `⏱️ ${left}`; }
  }
  drawBeams(t);
  drawPreview(dt);
  updateFx(dt, scene); updateBig(dt, camera);
  renderer.clear();
  renderer.render(scene, camera);
  if (game.mode === 'play' && me.alive && game.phase !== 'select' && !has('ghost')) vm.render(renderer);
}

// ---------- 시작 ----------
renderTitleOpts(); loadMap(game.pick.map);
shell.boot();
frame();
