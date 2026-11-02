// 젤리 아레나: 5 대 5 라인 전략 배틀. 서버(sim.js)가 다 계산하고, 여기서는 보이는 모습을 그리고 명령을 보낸다
//   우클릭 이동 · 공격 | Q W E R 기술(누르면 범위, 떼면 발사) | D F 주문 | A 공격 이동 | B 상점 | Tab 점수판 | Y 카메라 고정
import * as THREE from 'three';
import { Shell, esc } from '../../shared/js/shell.js';
import { store } from '../../shared/js/account.js';
import { makeSound, confetti } from '../../shared/js/party.js';
import { Roach } from '../../shared/js/roach.js';
import { SIZE, CHAMPS, champById, ROLES, ROLE_IDS, ITEMS, BUILD, SPELLS, MONS, TEAMS, STRUCTS, R_LEVELS, FOUNTAIN, BUSHES } from './data.js';
import { buildWorld, makeStruct, TC } from './world.js';

const $ = (id) => document.getElementById(id);
const S = makeSound('jellyarena');
const touch = matchMedia('(pointer: coarse)').matches;
const LV_KEY = 'jellyarena.level', PICK_KEY = 'jellyarena.pick', FIRST_KEY = 'jellyarena.seen';
const game = window.arena = {
  mode: 'title', team: 'blue', me: null, myUnit: 0, roster: new Map(), level: store.get(LV_KEY) || 'normal', T: 0, sb: null, views: new Map(), shop: 'all',
  locked: true, zoom: 1, focus: new THREE.Vector3(-66, 0, 66), mouse: { x: 0, y: 0, in: false }, hover: null, aim: null, amove: false, picks: [], myPick: null, myRole: null,
};
const KEYS_SK = ['q', 'w', 'e', 'r'];
const HELD = { sword: 'sword', axe: 'halberd', club: 'rod', dagger: 'knife', staff_lightning: 'wand', wand: 'wand', bow: 'bow', pistol: 'pistol', cannon: 'rpg', crossbow: 'crossbow', staff: 'wand', lute: 'rod' };

// ---------- 그리기 준비 ----------
const canvas = $('c'), ov = $('ov'), ctx = ov.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 1, 400);
game.camera = camera; // 점검용
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); const d = Math.min(2, devicePixelRatio || 1); ov.width = innerWidth * d; ov.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', resize); resize();
const W = buildWorld(scene);
const miniBg = (() => { const c = document.createElement('canvas'); c.width = c.height = 440; c.getContext('2d').drawImage(W.gc, 0, 0, 440, 440); return c; })();
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
// 건물은 처음부터 다 보인다 (서버 id 가 오면 짝을 맞춘다)
const structViews = STRUCTS.map((s) => { const o = makeStruct(s.k, s.team, s.tier); o.position.set(s.at[0], 0, s.at[1]); scene.add(o); return { ...s, o, alive: true }; });
const structAt = (x, z) => structViews.find((v) => Math.hypot(v.at[0] - x, v.at[1] - z) < 1);

// ---------- 유닛 모습 ----------
const G = { sph: new THREE.SphereGeometry(1, 14, 10), eye: new THREE.SphereGeometry(0.16, 8, 6), ring: new THREE.RingGeometry(0.82, 1, 32), disc: new THREE.CircleGeometry(1, 40), cone: new THREE.ConeGeometry(0.3, 0.6, 6), box: new THREE.BoxGeometry(1, 1, 1) };
const mats = new Map(); const mat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, ...o })); return mats.get(k); };
const black = new THREE.MeshBasicMaterial({ color: '#201a28' });
const ringOf = (c, op = 0.8) => { const m = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.08; return m; };
function makeMinion(team, type) {
  const g = new THREE.Group(), c = TC[team === 0 ? 'blue' : 'red'], s = type === 'super' ? 1.5 : type === 'siege' ? 1.25 : type === 'caster' ? 0.82 : 1;
  const body = new THREE.Mesh(G.sph, mat(c, { transparent: true, opacity: 0.92 })); body.scale.set(0.7 * s, 0.78 * s, 0.7 * s); body.position.y = 0.72 * s; g.add(body); g.userData.body = body;
  for (const x of [-1, 1]) { const e = new THREE.Mesh(G.eye, black); e.position.set(x * 0.24 * s, 0.86 * s, 0.6 * s); g.add(e); }
  if (type === 'caster') { const h = new THREE.Mesh(G.cone, mat('#ffffff')); h.position.y = 1.5 * s; h.scale.setScalar(1.3); g.add(h); }
  if (type === 'siege') { const b = new THREE.Mesh(G.box, mat('#3b3f4a')); b.scale.set(0.34, 0.34, 1.1); b.position.set(0, 1.25, 0.2); g.add(b); }
  if (type === 'super') { const h = new THREE.Mesh(G.cone, mat('#ffd76a')); h.position.y = 1.9; h.scale.setScalar(1.8); g.add(h); }
  g.userData.s = s; return g;
}
function makeMon(mid, big) {
  const d = MONS[mid], g = new THREE.Group(), c = d.color, s = d.epic ? (mid === 'mold' ? 3 : 2.5) : big ? 1.35 : 0.8;
  const body = new THREE.Mesh(G.sph, mat(c)); body.scale.set(0.85 * s, 0.75 * s, 0.95 * s); body.position.y = 0.78 * s; g.add(body); g.userData.body = body;
  for (const x of [-1, 1]) { const e = new THREE.Mesh(G.eye, black); e.scale.setScalar(s); e.position.set(x * 0.3 * s, 1.02 * s, 0.76 * s); g.add(e); }
  if (mid === 'wolves') for (const x of [-1, 1]) { const ear = new THREE.Mesh(G.cone, mat(c)); ear.scale.setScalar(s); ear.position.set(x * 0.42 * s, 1.5 * s, 0.1); g.add(ear); }
  if (mid === 'frogs') for (const x of [-1, 1]) { const b = new THREE.Mesh(G.sph, mat(c)); b.scale.setScalar(0.28 * s); b.position.set(x * 0.36 * s, 1.34 * s, 0.4 * s); g.add(b); }
  if (mid === 'golem') for (const x of [-1, 1]) { const a = new THREE.Mesh(G.box, mat('#c9b48a')); a.scale.set(0.45 * s, 0.9 * s, 0.45 * s); a.position.set(x * 1 * s, 0.7 * s, 0); g.add(a); }
  if (mid === 'bee') { body.material = mat('#ffd23f'); for (let i = -1; i <= 1; i++) { const st = new THREE.Mesh(G.sph, black); st.scale.set(0.87 * s, 0.14 * s, 0.97 * s); st.position.y = 0.78 * s; st.rotation.x = 1.3; st.position.z = i * 0.34 * s; g.add(st); } g.userData.wings = [-1, 1].map((x) => { const w = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })); w.scale.set(0.9 * s, 0.1 * s, 0.45 * s); w.position.set(x * 0.95 * s, 1.5 * s, -0.2 * s); g.add(w); return w; }); body.position.y = 1.2 * s; }
  if (mid === 'mold') { const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, 6.3, 0, 1.7), mat('#8a5cd6')); cap.scale.set(1.5 * s, 1 * s, 1.5 * s); cap.position.y = 1.2 * s; g.add(cap); for (let i = 0; i < 6; i++) { const a = i * 1.05, dot = new THREE.Mesh(G.sph, mat('#ffe9ff')); dot.scale.setScalar(0.17 * s); dot.position.set(Math.cos(a) * 0.95 * s, 1.75 * s, Math.sin(a) * 0.95 * s); g.add(dot); } }
  g.userData.s = s; return g;
}
function makeChampView(u, r) {
  const def = champById(r.champ);
  const bear = new Roach({ own: true, seed: r.name, color: def.color, age: 25, look: { ...(r.look || {}), hat: 0, face: 0, outfit: 0, extra: 0 }, accessories: def.acc || [] });
  bear.setHeld(`${HELD[def.held] || 'sword'}:${def.color}`);
  bear.root.scale.setScalar(1.45);
  const ring = ringOf(r.id === game.myUnit ? '#ffe066' : TC[r.team], r.id === game.myUnit ? 1 : 0.75); ring.scale.setScalar(1.5);
  scene.add(bear.root, ring);
  return { bear, ring, o: bear.root, def, name: r.name, team: r.team, roster: r };
}
function viewFor(u) {
  const [id, k, t] = u;
  let v = game.views.get(id);
  if (v) return v;
  if (k === 0) { const r = game.roster.get(id); if (!r) return null; v = makeChampView(u, r); }
  else if (k === 1) { v = { o: makeMinion(t, u[7]), type: u[7], team: t === 0 ? 'blue' : 'red' }; scene.add(v.o); }
  else if (k === 3) { v = { o: makeMon(u[7], !!u[8]), mid: u[7], big: !!u[8], team: 'neutral' }; scene.add(v.o); }
  else if (k === 4) { const o = new THREE.Group(), e = new THREE.Mesh(G.sph, mat(t === 0 ? '#9fe8ff' : '#ffb3c6', { emissive: t === 0 ? '#3fa8e0' : '#e0507a' })); e.scale.setScalar(0.32); e.position.y = 0.55; o.add(e); const st = new THREE.Mesh(G.box, mat('#7a5a3f')); st.scale.set(0.09, 0.5, 0.09); st.position.y = 0.25; o.add(st); v = { o, team: t === 0 ? 'blue' : 'red', ward: true }; scene.add(o); }
  else { const s = structAt(u[3], u[4]); if (!s) return null; v = { o: s.o, struct: s, team: s.team, structKind: s.k }; }
  v.id = id; v.k = k; v.x = u[3]; v.z = u[4]; v.tx = u[3]; v.tz = u[4]; v.face = 0; v.hurtT = 0;
  v.o.position.set(v.x, 0, v.z);
  game.views.set(id, v);
  return v;
}
function dropView(v) {
  game.views.delete(v.id);
  if (v.bear) { scene.remove(v.bear.root, v.ring); return; }
  if (v.struct) return;
  scene.remove(v.o);
}
// ---------- 효과 ----------
const fx = [];
function ringFx(x, z, r, col, life = 0.5, fill = 0.25, y = 0.12) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const d = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: fill, depthWrite: false, side: THREE.DoubleSide })); d.rotation.x = -Math.PI / 2; g.add(d);
  const e = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); e.rotation.x = -Math.PI / 2; g.add(e);
  g.scale.set(r, 1, r); scene.add(g); const o = { o: g, t: life, life, d, e, kind: 'ring', fill }; fx.push(o); return o;
}
function grow(x, z, r, col, life = 0.4) { const f = ringFx(x, z, 0.1, col, life, 0.4); f.kind = 'grow'; f.r = r; return f; }
function spark(x, y, z, col, s = 1, life = 0.35) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(x, y, z); m.scale.setScalar(s); scene.add(m); const o = { o: m, t: life, life, kind: 'spark', s }; fx.push(o); return o; }
function boom(x, z, r, col) { grow(x, z, r, col, 0.4); spark(x, 1.2, z, col, r * 1.6, 0.35); for (let i = 0; i < 6; i++) { const a = i * 1.05, f = spark(x, 1, z, col, 0.8, 0.45); f.vx = Math.cos(a) * r * 1.8; f.vz = Math.sin(a) * r * 1.8; f.vy = 3; } }
const shots = new Map();
function addShot(e) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: e.col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); const s = Math.max(1.6, e.w * 1.5) * (e.big ? 1.5 : 1); m.scale.setScalar(s); m.position.set(e.x, 1.2, e.z); scene.add(m); shots.set(e.id, { m, e, x: e.x, z: e.z, left: e.L, tr: 0 }); }
function orb(fromV, toV, col, speed = 22) { if (!toV) return; const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.scale.setScalar(0.8); m.position.set(fromV.x, 1.3, fromV.z); scene.add(m); fx.push({ o: m, kind: 'orb', to: toV, speed, t: 2, life: 2, y: 1.3 }); }
const floats = [];
function floatText(x, y, z, text, col, big) { floats.push({ x, y, z, text, col, big, t: 0.9, life: 0.9 }); if (floats.length > 60) floats.shift(); }
function banner(a, b = '', ms = 2600) { const el = $('banner'); el.innerHTML = `${esc(a)}${b ? `<small>${esc(b)}</small>` : ''}`; el.classList.remove('hidden'); void el.offsetWidth; clearTimeout(banner.t); banner.t = setTimeout(() => el.classList.add('hidden'), ms); }
function feed(html, team) { const d = document.createElement('div'); d.className = team || ''; d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 5) $('feed').lastChild.remove(); setTimeout(() => d.remove(), 8000); }

// ---------- 서버에서 온 것 ----------
const view = (id) => game.views.get(id);
function onSnapshot(m) {
  game.T = m.T;
  const seen = new Set();
  for (const u of m.u) {
    const v = viewFor(u); if (!v) continue;
    seen.add(u[0]); v.tx = u[3]; v.tz = u[4]; v.hp = u[5]; v.max = u[6]; v.u = u;
    if (u[1] === 0) { v.mp = u[7]; v.mpMax = u[8]; v.lv = u[9]; v.f = u[10]; v.sh = u[11]; v.tface = u[12]; v.o.visible = true; v.ring.visible = true; }
    else if (u[1] === 1) { v.tface = u[8]; }
    else if (u[1] === 3) { v.tface = u[9]; }
    else if (u[1] === 2) { v.invuln = !!u[9]; v.lastHp = u[5]; }
  }
  for (const v of [...game.views.values()]) if (!seen.has(v.id)) dropView(v);
  if (m.e?.length) for (const e of m.e) onEvent(e);
}
function onEvent(e) {
  const near = (x, z) => { const d = Math.hypot(x - game.focus.x, z - game.focus.z); return Math.max(0, 1 - d / 55); };
  switch (e.k) {
    case 'cast': { const v = view(e.id); if (v?.bear) v.bear.cast?.(); if (e.id === game.myUnit) S.sfx('swish'); break; }
    case 'shot': addShot(e); if (near(e.x, e.z) > 0.2) S.sfx('zap'); break;
    case 'pop': { const s = shots.get(e.id); if (s) { scene.remove(s.m); shots.delete(e.id); } spark(e.x, 1.2, e.z, e.col, 2.2, 0.25); break; }
    case 'aoe': { const f = ringFx(e.x, e.z, e.r, e.col, e.d, 0.12); f.kind = 'charge'; break; }
    case 'boom': boom(e.x, e.z, e.r, e.col); if (near(e.x, e.z) > 0.2) S.sfx('boom'); break;
    case 'nova': boom(e.x, e.z, e.r, e.col); if (near(e.x, e.z) > 0.2) S.sfx('boom'); break;
    case 'cone': { const a = Math.atan2(e.fx, e.fz); for (let i = -2; i <= 2; i++) for (let d = 2; d <= e.r; d += 2.2) { const b = a + i * Math.acos(e.arc) / 2.2, f = spark(e.x + Math.sin(b) * d, 1, e.z + Math.cos(b) * d, e.col, 2.1, 0.3 + d * 0.012); f.delay = d * 0.012; } break; }
    case 'zone': { const f = ringFx(e.x, e.z, e.r, e.col, e.d, 0.22); f.kind = 'zone'; f.follow = e.follow; break; }
    case 'dash': { const v = view(e.id); if (v) { v.dashCol = e.col; v.dashT = 0.5; } break; }
    case 'land': boom(e.x, e.z, Math.max(1.5, e.r * 0.8), e.col); break;
    case 'blink': spark(e.x, 1, e.z, e.col, 3, 0.35); spark(e.tx, 1, e.tz, e.col, 3, 0.35); { for (let i = 0; i < 5; i++) { const k = i / 5; spark(e.x + (e.tx - e.x) * k, 1, e.z + (e.tz - e.z) * k, e.col, 1.4, 0.3); } } if (near(e.x, e.z) > 0.2) S.sfx('zap'); break;
    case 'hit': { const a = view(e.id), b = view(e.to); if (b) { spark(b.x, 1.2, b.z, e.col, 3.5, 0.3); grow(b.x, b.z, 1.8, e.col, 0.3); } if (a?.bear) a.bear.attack('melee'); break; }
    case 'buff': { const v = view(e.id); if (v) { grow(v.x, v.z, 2.2, e.col, 0.5); if (e.ic) floatText(v.x, 3, v.z, e.ic, '#fff', true); } break; }
    case 'cc': { const v = view(e.to); if (v) { floatText(v.x, 3.2, v.z, e.c === 'stun' ? '💫' : e.c === 'knock' ? '🌀' : '🌿', '#fff', true); if (e.c === 'knock') v.airT = e.d; } break; }
    case 'smite': spark(e.x, 3, e.z, '#ffe066', 7, 0.3); grow(e.x, e.z, 3, '#ffe066', 0.3); S.sfx('zap'); break;
    case 'ignite': { const v = view(e.to); if (v) { spark(v.x, 1.5, v.z, '#ff7a3c', 3, 0.5); floatText(v.x, 3, v.z, '🔥', '#fff', true); } break; }
    case 'dmg': { const v = view(e.to); if (!v) break; if (e.ty !== 'heal') v.hurtT = 0.12; const mine = e.by === game.myUnit || e.to === game.myUnit; if (!mine && e.ty !== 'heal') break; floatText(v.x + (Math.random() - 0.5), v.k === 0 ? 2.7 : 1.9, v.z, e.ty === 'heal' ? `+${e.n}` : `${e.n}${e.crit ? '!' : ''}`, e.ty === 'heal' ? '#7fe08a' : e.to === game.myUnit ? '#ff6b6b' : e.ty === 'magic' ? '#c79bff' : e.ty === 'true' ? '#ffffff' : '#ffb36b', e.crit); if (e.to === game.myUnit && e.n > 20) S.sfx('hurt'); break; }
    case 'gold': if (e.id === game.myUnit) { floatText(e.x, 1.9, e.z, `+${e.n}🪙`, '#ffd76a'); S.sfx('xp'); } break;
    case 'atk': { const v = view(e.id), t = view(e.to); if (v?.bear) v.bear.attack(e.r ? 'shoot' : 'melee'); if (e.r && t && v) orb(v, t, e.col); if (t && !e.r) spark(t.x, 1.1, t.z, '#ffffff', 1.1, 0.14); if (e.id === game.myUnit) S.sfx(e.r ? 'shoot' : 'swish'); break; }
    case 'matk': { const v = view(e.id), t = view(e.to); if (e.r && v && t) orb(v, t, v.team === 'blue' ? '#9fe8ff' : '#ffb3c6', 20); break; }
    case 'tshot': { const v = view(e.id), t = view(e.to); if (v && t) { orb({ x: v.o.position.x, z: v.o.position.z }, t, TC[e.team], 34); fx[fx.length - 1].y = 5.5; fx[fx.length - 1].o.position.y = 5.5; fx[fx.length - 1].o.scale.setScalar(1.3); } break; }
    case 'ward': grow(e.x, e.z, 2, '#9fe8ff', 0.4); S.sfx('tick'); break;
    case 'lvl': { const v = view(e.id); if (v) { grow(v.x, v.z, 3, '#ffe066', 0.6); floatText(v.x, 3.3, v.z, 'LEVEL UP', '#ffe066', true); } if (e.id === game.myUnit) S.sfx('lvl'); break; }
    case 'spawn': if (e.id === game.myUnit) banner('💪 다시 시작!', '', 1200); break;
    case 'kill': {
      const mine = game.roster.get(e.by)?.team === game.team;
      feed(`<b>${esc(e.byC)} ${esc(e.byName)}</b> ⚔️ ${esc(e.toC)} ${esc(e.toName)}${e.as ? ` <small>+${e.as}</small>` : ''}`, e.team === 'blue' ? 'red' : 'blue');
      if (!game.firstBlood && e.by) { game.firstBlood = true; banner(`🩸 첫 번째 처치!`, `${e.byName} → ${e.toName}`); }
      else if (e.by === game.myUnit) banner(e.sk >= 5 ? `🔥 ${e.sk}연속 처치!` : e.sk >= 3 ? `✨ ${e.sk}연속 처치!` : '⚔️ 적을 처치했어요!', `${e.toName}`, 1800);
      else if (e.to === game.myUnit) banner('💤 쓰러졌어요', `${e.byName}`, 1800);
      else if (e.sk >= 3) banner(`${e.byName} ${e.sk}연속 처치!`, '', 1800);
      S.sfx(mine ? 'kill' : 'hurt'); spark(e.x, 1.5, e.z, '#ff5a7a', 5, 0.5); break;
    }
    case 'fall': {
      const s = structViews.find((q) => Math.hypot(q.at[0] - e.x, q.at[1] - e.z) < 1); if (s) { s.alive = false; s.o.visible = false; const r = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.7, 8), mat('#6a6a74')); r.position.set(e.x, 0.35, e.z); scene.add(r); }
      boom(e.x, e.z, 6, TC[e.team]); spark(e.x, 3, e.z, '#ffd76a', 10, 0.6); S.sfx('boom');
      const ours = e.team === game.team, nm = e.sk === 'heart' ? '젤리 심장' : e.sk === 'gate' ? `${ROLES[e.lane === 'top' ? 'top' : e.lane === 'bot' ? 'bot' : 'mid']?.name} 수문` : `${e.lane === 'base' ? '심장 지킴이' : `${ROLES[e.lane]?.name} ${e.tier}차 포탑`}`;
      banner(ours ? `😱 우리 ${nm}이 무너졌어요` : `🎉 적 ${nm} 파괴!`, `${e.by}`, 2200); feed(`🗼 ${esc(nm)} 파괴`, e.team === 'blue' ? 'red' : 'blue'); break;
    }
    case 'epic': { const ours = e.team === game.team; banner(`${e.icon} ${ours ? '우리 팀이' : '상대 팀이'} ${e.name} 처치!`, e.buff, 3600); feed(`${e.icon} ${TEAMS[e.team].name} 처치`, e.team); S.sfx('boss'); break; }
    case 'epicUp': banner(`${e.icon} ${e.name} 등장!`, '강가에 나타났어요', 2200); S.sfx('boss'); break;
    case 'over': break;
  }
}
// ---------- HUD ----------
function buildBar(def) {
  $('b-emoji').textContent = def.emoji;
  $('b-skills').innerHTML = [['passive'], ...KEYS_SK.map((s) => [s]), ['d'], ['f']].map(([s]) => {
    if (s === 'passive') return `<button class="sk spell" data-tip="passive" title="">${def.passive ? '🌟' : ''}</button>`;
    if (s === 'd' || s === 'f') return `<button class="sk spell" data-s="${s}" data-tip="${s}"><span class="ic"></span><span class="key">${s.toUpperCase()}</span><span class="cd hidden"></span></button>`;
    const sk = def.skills[s];
    return `<button class="sk" data-s="${s}" data-tip="${s}"><span class="rk">${Array.from({ length: s === 'r' ? 3 : 5 }, () => '<u></u>').join('')}</span>${sk.icon}<span class="key">${s.toUpperCase()}</span><span class="cd hidden"></span><button class="up hidden" data-up="${s}">＋</button></button>`.replace('<button class="up', '<span class="up').replace('</button></button>', '</span></button>');
  }).join('');
  $('b-skills').querySelectorAll('[data-s]').forEach((b) => { b.onclick = (ev) => { if (ev.target.dataset.up) { game.sendLv(ev.target.dataset.up); return; } castAt(b.dataset.s, touch); }; });
  $('b-skills').querySelectorAll('[data-tip]').forEach((b) => { b.onmouseenter = () => showTip(b.dataset.tip); b.onmouseleave = () => $('tip').classList.add('hidden'); });
}
function showTip(k) {
  const me = game.me, def = game.def; if (!def) return;
  let html = '';
  if (k === 'passive') html = `<b>🌟 ${esc(def.passive.name)}</b> <small>(지속 효과)</small><div>${esc(def.passive.desc)}</div>`;
  else if (k === 'd' || k === 'f') { const sp = SPELLS[k === 'd' ? 'flash' : me?.spell || 'heal']; html = `<b>${sp.icon} ${esc(sp.name)}</b> <small>재사용 ${sp.cd}초</small><div>${esc(sp.desc)}</div>`; }
  else { const sk = def.skills[k], r = me?.rank?.[k] || 0, dmg = sk.dmg?.[Math.max(0, r - 1)]; html = `<b>${sk.icon} ${esc(sk.name)}</b> <small>${k.toUpperCase()} · 재사용 ${sk.cd}초 · 마나 ${sk.mana}</small><div>${esc(sk.desc)}</div>${dmg ? `<small>피해 <em>${dmg}</em>${sk.ad ? ` + 공격력 ×${sk.ad}` : ''}${sk.ap ? ` + 주문력 ×${sk.ap}` : ''}</small>` : ''}`; }
  $('tip').innerHTML = html; $('tip').classList.remove('hidden');
}
let meT = 0;
function onMe(m) {
  game.me = m; if (!game.def) return;
  const v = view(m.id), hp = v?.hp ?? 0, max = v?.max ?? 1, mp = v?.mp ?? 0, mpm = v?.mpMax ?? 1, sh = m.sh || 0, tot = Math.max(max, hp + sh);
  $('hp-f').style.width = `${(hp / tot) * 100}%`; $('hp-s').style.width = `${((hp + sh) / tot) * 100}%`; $('hp-t').textContent = m.alive ? `${Math.round(hp)} / ${Math.round(max)}` : ''; $('mp-f').style.width = `${(mp / mpm) * 100}%`; $('mp-t').textContent = m.alive ? `${Math.round(mp)} / ${Math.round(mpm)}` : '';
  $('xp-f').style.width = `${(m.xp / m.need) * 100}%`; $('b-lv').textContent = m.lv; $('b-gold').textContent = m.gold;
  const can = (s) => m.pts > 0 && (s === 'r' ? m.rank.r < 3 && m.lv >= R_LEVELS[m.rank.r] : m.rank[s] < 5 && m.rank[s] < Math.ceil(m.lv / 2));
  $('b-skills').querySelectorAll('[data-s]').forEach((b) => {
    const s = b.dataset.s, cd = m.cds[s] || 0, el = b.querySelector('.cd');
    el.classList.toggle('hidden', cd <= 0); if (cd > 0) el.textContent = cd >= 10 ? Math.ceil(cd) : cd.toFixed(1);
    if (s === 'd' || s === 'f') { b.querySelector('.ic').textContent = SPELLS[s === 'd' ? 'flash' : m.spell].icon; return; }
    const r = m.rank[s], sk = game.def.skills[s]; b.classList.toggle('off', r <= 0 || (v && mp < sk.mana));
    b.querySelectorAll('.rk u').forEach((u, i) => u.classList.toggle('on', i < r));
    b.querySelector('.up').classList.toggle('hidden', !can(s));
  });
  const cells = [...m.items.map((id) => `<div title="${esc(ITEMS[id].name)}">${ITEMS[id].icon}</div>`)]; while (cells.length < 6) cells.push('<div></div>');
  $('b-items').innerHTML = cells.join('');
  $('b-stats').innerHTML = [['⚔️', m.st.ad], ['🔮', m.st.ap], ['🛡️', m.st.ar], ['🌀', m.st.mr], ['⚡', m.st.as], ['👟', m.st.ms], ['🧃', m.pot], ['👁️', m.wards]].map(([a, b]) => `<span>${a} ${b}</span>`).join('');
  $('dead').classList.toggle('hidden', m.alive); if (!m.alive) $('dead-t').textContent = m.resp;
  if (!$('shop').classList.contains('hidden') && (performance.now() - meT > 400)) { meT = performance.now(); renderShop(); }
}
function onScore(m) {
  game.sb = m;
  $('s-kb').textContent = m.kills.blue; $('s-kr').textContent = m.kills.red; $('s-tb').textContent = m.towers.blue; $('s-tr').textContent = m.towers.red;
  const mine = m.list.find((x) => x.id === game.myUnit); if (mine) { $('s-kda').textContent = `⚔️ ${mine.k}/${mine.d}/${mine.a}`; $('s-cs').textContent = `🌾 ${mine.cs}`; }
  $('h-epic').innerHTML = m.camps.map((c) => `<span>${MONS[c.id].emoji} ${c.up ? '등장!' : `${Math.floor(c.inS / 60)}:${String(c.inS % 60).padStart(2, '0')}`}</span>`).join('') + (m.honey[game.team] ? `<span>🍯×${m.honey[game.team]}</span>` : '') + (m.mold[game.team] ? '<span>🍄 축복</span>' : '');
  if (!$('board').classList.contains('hidden')) renderBoard();
}
function row(x) { const c = champById(x.champ); return `<div class="bd-row${x.id === game.myUnit ? ' me' : ''}${x.alive ? '' : ' dead'}"><span>${ROLES[x.role]?.icon || ''}</span><span>${c.emoji}</span><span>${esc(x.name)}${x.alive ? '' : ` (${x.resp})`}</span><span>${x.lv}</span><span>${x.k}/${x.d}/${x.a}</span><span>🌾${x.cs}</span><span>${x.items.map((i) => ITEMS[i].icon).join(' ')}</span></div>`; }
function renderBoard() { const m = game.sb; if (!m) return; $('bd-top').innerHTML = `<b>${fmt(m.time)}</b> · ${TEAMS.blue.name} ${m.kills.blue} : ${m.kills.red} ${TEAMS.red.name}`; $('bd-list').innerHTML = ['blue', 'red'].map((t) => `<div class="bd-t ${t}">${TEAMS[t].name} · 포탑 ${m.towers[t]} · 큰 몬스터 ${m.epics[t]}</div>${m.list.filter((x) => x.team === t).map(row).join('')}`).join(''); }
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// ---------- 상점 ----------
const SHOP_TABS = { all: '전체', ad: '⚔️ 공격', ap: '🔮 주문', def: '🛡️ 방어', boots: '👟 신발' };
function renderShop() {
  const m = game.me; if (!m) return; $('sh-gold').textContent = m.gold;
  $('sh-note').textContent = m.base ? '여기서 살 수 있어요' : '🏠 기지(샘 근처)로 돌아가야 살 수 있어요';
  $('sh-tabs').innerHTML = Object.entries(SHOP_TABS).map(([k, v]) => `<button data-k="${k}" class="${game.shop === k ? 'on' : ''}">${v}</button>`).join('');
  $('sh-tabs').querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { game.shop = b.dataset.k; renderShop(); }; });
  const inTab = (it) => { const a = it.add || {}; switch (game.shop) { case 'ad': return a.ad || a.as || a.crit || a.lifesteal; case 'ap': return a.ap || a.mp; case 'def': return a.hp || a.ar || a.mr; case 'boots': return it.tag === 'boots'; default: return true; } };
  $('sh-list').innerHTML = Object.entries(ITEMS).filter(([, it]) => inTab(it)).map(([id, it]) => `<button class="it${m.gold < it.cost ? ' no' : ''}" data-buy="${id}"><i>${it.icon}</i><span>${esc(it.name)}<small>${esc(it.desc)}</small></span><b>${it.cost}</b></button>`).join('');
  $('sh-list').querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => { shell.send({ t: 'buy', it: b.dataset.buy }); S.sfx('ok'); }; });
  $('sh-rec').innerHTML = (BUILD[game.def?.cls] || []).map((id) => `<button class="${m.items.includes(id) ? 'have' : ''}" data-buy2="${id}" title="${esc(ITEMS[id].name)} ${ITEMS[id].cost}">${ITEMS[id].icon}</button>`).join('');
  $('sh-rec').querySelectorAll('[data-buy2]').forEach((b) => { b.onclick = () => shell.send({ t: 'buy', it: b.dataset.buy2 }); });
  $('sh-mine').innerHTML = m.items.map((id, i) => `<button data-sell="${i}" title="${esc(ITEMS[id].name)} 팔기">${ITEMS[id].icon}</button>`).join('') || '<small>아직 없어요</small>';
  $('sh-mine').querySelectorAll('[data-sell]').forEach((b) => { b.onclick = () => shell.send({ t: 'sell', i: +b.dataset.sell }); });
}
function toggleShop(on) { const el = $('shop'); const v = on ?? el.classList.contains('hidden'); el.classList.toggle('hidden', !v); if (v) renderShop(); }
$('b-shop').onclick = () => toggleShop(); $('sh-close').onclick = () => toggleShop(false);

// ---------- 입력 ----------
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v2 = new THREE.Vector2(), hit = new THREE.Vector3();
function groundAt(mx, my) { v2.set((mx / innerWidth) * 2 - 1, -(my / innerHeight) * 2 + 1); ray.setFromCamera(v2, camera); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null; }
const scr = new THREE.Vector3();
function toScreen(x, y, z) { scr.set(x, y, z).project(camera); return { x: (scr.x + 1) / 2 * innerWidth, y: (1 - scr.y) / 2 * innerHeight, front: scr.z < 1 }; }
function unitUnder(mx, my, friendly = false) {
  let best = null, bd = 1e9;
  for (const v of game.views.values()) {
    if (v.ward && v.team === game.team) continue;
    const isFoe = v.team !== game.team; if (!friendly && !isFoe) continue; if (friendly && (v.k !== 0)) continue;
    const y = v.k === 0 ? 1.1 : v.k === 2 ? 2.5 : 0.8, s = toScreen(v.o.position.x, y, v.o.position.z), R = (v.k === 0 ? 42 : v.k === 2 ? 58 : v.k === 3 ? (v.big ? 42 : 26) * (MONS[v.mid]?.epic ? 1.9 : 1) : 26) / game.zoom, d = Math.hypot(s.x - mx, s.y - my);
    if (d < R && d - (v.k === 0 ? 14 : 0) < bd) { bd = d - (v.k === 0 ? 14 : 0); best = v; }
  }
  return best;
}
function mouseGround() { return groundAt(game.mouse.x, game.mouse.y) || { x: 0, z: 0 }; }
function moveOrAttack(mx, my, marker = true) {
  const u = unitUnder(mx, my);
  if (u && !(u.k === 2 && u.invuln)) { shell.send({ t: 'atk', id: u.id }); ringPing(u.o.position.x, u.o.position.z, '#ff5a7a'); return; }
  const g = groundAt(mx, my); if (!g) return;
  shell.send({ t: 'mv', x: g.x, z: g.z }); if (marker) ringPing(g.x, g.z, '#7fe08a');
}
function ringPing(x, z, c) { const f = ringFx(x, z, 1, c, 0.35, 0); f.kind = 'shrink'; }
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointermove', (e) => { game.mouse.x = e.clientX; game.mouse.y = e.clientY; game.mouse.in = true; });
canvas.addEventListener('pointerdown', (e) => {
  game.mouse.x = e.clientX; game.mouse.y = e.clientY; S.unlock?.();
  if (game.mode !== 'play') return;
  if (e.pointerType === 'touch') { moveOrAttack(e.clientX, e.clientY); return; }
  if (e.button === 2) { game.rdown = true; game.amove = false; moveOrAttack(e.clientX, e.clientY); return; }
  if (e.button === 0) { if (game.amove) { const g = groundAt(e.clientX, e.clientY); if (g) { shell.send({ t: 'amove', x: g.x, z: g.z }); ringPing(g.x, g.z, '#ff5a7a'); } game.amove = false; document.body.style.cursor = ''; } }
});
addEventListener('pointerup', (e) => { if (e.button === 2) game.rdown = false; });
canvas.addEventListener('wheel', (e) => { game.zoom = Math.max(0.65, Math.min(1.5, game.zoom + Math.sign(e.deltaY) * 0.07)); }, { passive: true });
// 기술: 대상 자리(마우스) · 대상 유닛을 함께 보낸다
function castAt(s, auto) {
  if (game.mode !== 'play' || !game.me?.alive) return;
  let g = mouseGround(), id = 0;
  const me = view(game.myUnit);
  const spec = KEYS_SK.includes(s) ? game.def.skills[s] : null;
  if (auto && me) { const foe = [...game.views.values()].filter((v) => v.k === 0 && v.team !== game.team).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]; if (foe) { g = { x: foe.x, z: foe.z }; id = foe.id; } else { g = { x: me.x + Math.sin(me.face || 0) * 10, z: me.z + Math.cos(me.face || 0) * 10 }; } }
  else { const u = unitUnder(game.mouse.x, game.mouse.y, spec?.kind === 'ally'); if (u) { id = u.id; if (spec?.kind === 'ally' || spec?.kind === 'hit') g = { x: u.x, z: u.z }; } }
  if (s === 'd' || s === 'f') shell.send({ t: 'spell', s, x: g.x, z: g.z, id });
  else shell.send({ t: 'cast', s, x: g.x, z: g.z, id });
}
game.sendLv = (s) => { shell.send({ t: 'lvl', s }); S.sfx('ok'); };
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && game.mode === 'play') { e.preventDefault(); $('board').classList.remove('hidden'); renderBoard(); return; }
  if (typing() || game.mode !== 'play') return;
  if (e.repeat) return;
  keys.add(e.code);
  const sk = { KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r' }[e.code];
  if (sk && !e.ctrlKey && !e.metaKey) e.preventDefault();
  if (sk) { if (e.altKey || e.ctrlKey || e.metaKey) { game.sendLv(sk); return; } game.aim = sk; return; }
  switch (e.code) {
    case 'KeyD': castAt('d'); break;
    case 'KeyF': castAt('f'); break;
    case 'KeyA': game.amove = true; document.body.style.cursor = 'crosshair'; break;
    case 'KeyS': shell.send({ t: 'stop' }); break;
    case 'KeyB': toggleShop(); break;
    case 'Digit1': shell.send({ t: 'potion' }); break;
    case 'Digit4': { const g = mouseGround(); shell.send({ t: 'ward', x: g.x, z: g.z }); break; }
    case 'KeyY': setLock(!game.locked); break;
    case 'KeyM': muteBtn(); break;
    case 'Space': { e.preventDefault(); const me = view(game.myUnit); if (me) game.focus.set(me.x, 0, me.z); break; }
    case 'Escape': if (!$('shop').classList.contains('hidden')) toggleShop(false); else if (!$('help').classList.contains('hidden')) $('help').classList.add('hidden'); game.aim = null; game.amove = false; document.body.style.cursor = ''; break;
  }
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Tab') { $('board').classList.add('hidden'); return; }
  const sk = { KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r' }[e.code];
  if (sk && game.aim === sk) { castAt(sk); game.aim = null; }
});
function setLock(v) { game.locked = v; $('b-lock').textContent = v ? '🔒' : '🔓'; }
$('b-lock').onclick = () => setLock(!game.locked);
function muteBtn() { S.toggleMute(); $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊'; shell.syncSound?.(); }
$('b-mute').onclick = muteBtn; $('b-mute').textContent = S.sound.muted ? '🔇' : '🔊';
$('b-help').onclick = () => $('help').classList.toggle('hidden'); $('help-close').onclick = () => $('help').classList.add('hidden');
addEventListener('beforeunload', (e) => { if (game.mode === 'play') { e.preventDefault(); e.returnValue = ''; } }); // 실수로 탭을 닫지 않게
$('b-quit').onclick = () => { if (confirm('경기를 그만둘까요? (내 자리는 봇이 이어 가요)')) { shell.send({ t: 'leave' }); toTitle(); } };
// 미니맵: 왼쪽 클릭 = 그쪽 보기 · 오른쪽 클릭 = 이동
const mini = $('mini'), mctx = mini.getContext('2d');
const miniPos = (e) => { const r = mini.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * SIZE * 2 - SIZE, z: ((e.clientY - r.top) / r.height) * SIZE * 2 - SIZE }; };
mini.addEventListener('contextmenu', (e) => e.preventDefault());
mini.addEventListener('pointerdown', (e) => { const p = miniPos(e); if (e.button === 2) { shell.send({ t: 'mv', x: p.x, z: p.z }); return; } setLock(false); game.focus.set(p.x, 0, p.z); game.miniDrag = true; });
mini.addEventListener('pointermove', (e) => { if (game.miniDrag) { const p = miniPos(e); game.focus.set(p.x, 0, p.z); } });
addEventListener('pointerup', () => { game.miniDrag = false; });

// ---------- 챔피언 고르기 ----------
let pv = null;
function preview(c) {
  const el = $('p-prev');
  if (!pv) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff6e8', '#9a8a9a', 1.6)); const d = new THREE.DirectionalLight('#ffffff', 1.4); d.position.set(2, 4, 5); sc.add(d);
    const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 50); cam.position.set(0, 1.5, 5.4); cam.lookAt(0, 1.05, 0);
    pv = { r, sc, cam, bear: null, on: false, t: 0 }; el.appendChild(r.domElement);
  }
  if (pv.bear) pv.sc.remove(pv.bear.root);
  const def = champById(c);
  pv.bear = new Roach({ own: true, seed: c, color: def.color, age: 25, look: { ...(shell.profile?.look || {}), hat: 0, face: 0, outfit: 0, extra: 0 }, accessories: def.acc || [] });
  pv.bear.setHeld(`${HELD[def.held] || 'sword'}:${def.color}`); pv.sc.add(pv.bear.root);
  if (!pv.on) { pv.on = true; let last = performance.now(); const loop = (now) => { if ($('pick').classList.contains('hidden')) { pv.on = false; return; } const dt = Math.min(0.05, (now - last) / 1000); last = now; const w = el.clientWidth || 280, h = el.clientHeight || 150; if (pv.w !== w) { pv.r.setSize(w, h, false); pv.cam.aspect = w / h; pv.cam.updateProjectionMatrix(); pv.w = w; } pv.t += dt; pv.bear.root.rotation.y = Math.sin(pv.t * 0.8) * 0.7; pv.bear.update(dt, 0); pv.r.render(pv.sc, pv.cam); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}
const CLS_NAME = { tank: '🛡️ 탱커', fighter: '⚔️ 전사', assassin: '🗡️ 암살자', mage: '🔮 마법사', marks: '🏹 원거리', support: '💖 서포터' };
function renderPick() {
  const myTeam = shell.members.find((m) => m.id === shell.myId)?.team || game.team;
  const mates = game.picks.filter((p) => p.team === myTeam);
  const taken = new Set(mates.filter((p) => p.id !== shell.myId && p.c).map((p) => p.c));
  $('p-team').innerHTML = `<div style="color:${TC[myTeam]}">${TEAMS[myTeam].name}</div>` + mates.map((p) => { const m = shell.members.find((q) => q.id === p.id), c = p.c && champById(p.c); return `<div class="p-slot${p.id === shell.myId ? ' me' : ''}${p.locked ? ' ok' : ''}"><span class="em">${c ? c.emoji : '❔'}</span><span>${esc(m?.name || '')}<small>${c ? esc(c.name) : '고르는 중…'}${p.role ? ` · ${ROLES[p.role].name}` : ''}</small></span></div>`; }).join('') + `<div class="p-slot" style="opacity:.6"><span class="em">🤖</span><span>빈 자리 ${Math.max(0, 5 - mates.length)}<small>젤리봇이 채워요</small></span></div>`;
  const filt = game.pFilter || 'all';
  $('p-filter').innerHTML = [['all', '전체'], ...ROLE_IDS.map((r) => [r, `${ROLES[r].icon} ${ROLES[r].name}`])].map(([k, v]) => `<button data-k="${k}" class="${filt === k ? 'on' : ''}">${v}</button>`).join('');
  $('p-filter').querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => { game.pFilter = b.dataset.k; renderPick(); }; });
  $('p-grid').innerHTML = CHAMPS.filter((c) => filt === 'all' || c.roles.includes(filt)).map((c) => `<button class="ch${game.myPick === c.id ? ' on' : ''}${taken.has(c.id) ? ' taken' : ''}" data-c="${c.id}"><i>${c.emoji}</i>${esc(c.name)}<small>${c.roles.map((r) => ROLES[r].name).join(' · ')}</small></button>`).join('');
  $('p-grid').querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => choose(b.dataset.c); });
  $('p-roles').innerHTML = ROLE_IDS.map((r) => `<button data-r="${r}" class="${game.myRole === r ? 'on' : ''}">${ROLES[r].icon} ${ROLES[r].name}</button>`).join('');
  $('p-roles').querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { game.myRole = b.dataset.r; shell.send({ t: 'role', role: game.myRole }); store.set(PICK_KEY, JSON.stringify({ c: game.myPick, role: game.myRole })); renderPick(); }; });
  const c = game.myPick && champById(game.myPick);
  $('p-lock').disabled = !c || game.locked2; $('p-lock').textContent = game.locked2 ? '✅ 다른 사람 기다리는 중…' : c ? `${c.emoji} ${c.name} 확정!` : '챔피언을 골라 주세요';
  $('p-info').innerHTML = c ? `<h3>${c.emoji} ${esc(c.name)}</h3><div class="t">${CLS_NAME[c.cls]} · ${esc(c.tip)}</div><div class="s"><i>🌟</i><div><b>${esc(c.passive.name)}</b><br>${esc(c.passive.desc)}</div></div>${KEYS_SK.map((k) => { const s = c.skills[k]; return `<div class="s"><i>${s.icon}</i><div><kbd>${k.toUpperCase()}</kbd><b>${esc(s.name)}</b> <small>${s.cd}초</small><br>${esc(s.desc)}</div></div>`; }).join('')}` : '<p>왼쪽에서 챔피언을 눌러 보세요</p>';
}
function choose(c) { game.myPick = c; game.myRole = champById(c).roles.includes(game.myRole) ? game.myRole : (game.myRole || champById(c).roles[0]); shell.send({ t: 'pick', c, role: game.myRole }); store.set(PICK_KEY, JSON.stringify({ c, role: game.myRole })); S.sfx('tick'); preview(c); renderPick(); }
$('p-lock').onclick = () => { if (!game.myPick) return; game.locked2 = true; shell.send({ t: 'lock' }); S.sfx('ok'); renderPick(); };
let pickTimer = 0;
function startPick(m) {
  game.mode = 'pick'; game.picks = shell.members.map((x) => ({ id: x.id, team: x.team, c: null, role: null })); game.locked2 = false; game.firstBlood = false;
  shell.hideScreens(); $('over').classList.add('hidden'); $('pick').classList.remove('hidden');
  const end = performance.now() + (m.pickMs || 35000); clearInterval(pickTimer);
  pickTimer = setInterval(() => { const left = Math.max(0, Math.ceil((end - performance.now()) / 1000)); $('p-time').textContent = left; if (left <= 5 && left > 0) S.sfx('tick'); if (left <= 0) clearInterval(pickTimer); }, 250);
  let saved = {}; try { saved = JSON.parse(store.get(PICK_KEY) || '{}'); } catch { /* 없음 */ }
  game.myPick = null; game.myRole = saved.role || null; game.pFilter = 'all';
  const c = champById(saved.c); if (c) choose(c.id); else { renderPick(); choose(CHAMPS[Math.floor(Math.random() * CHAMPS.length)].id); }
}
function startMatch(m) {
  clearInterval(pickTimer);
  game.roster = new Map(m.roster.map((r) => [r.id, r]));
  const mine = m.roster.find((r) => r.pid === shell.myId); game.myUnit = mine?.id || 0; game.team = mine?.team || 'blue'; game.def = mine ? champById(mine.champ) : null;
  for (const v of [...game.views.values()]) dropView(v);
  for (const s of structViews) { s.alive = true; s.o.visible = true; }
  game.mode = 'play'; game.me = null; game.sb = null; $('pick').classList.add('hidden'); $('hud').classList.remove('hidden'); W.fog.visible = true;
  const f = FOUNTAIN[game.team]; game.focus.set(f[0], 0, f[1]); setLock(true); game.zoom = 1;
  if (game.def) buildBar(game.def);
  const r = ROLES[mine?.role]; banner(`${game.def?.emoji || ''} ${game.def?.name || ''} · ${r?.icon || ''} ${r?.name || ''}`, '꼬마가 곧 나와요. 기지에서 B 로 아이템을 사고 출발!', 3500);
  S.sfx('start'); S.startMusic?.();
  if (!store.get(FIRST_KEY)) { store.set(FIRST_KEY, '1'); $('help').classList.remove('hidden'); }
}
function results(m) {
  const win = m.winner === game.team;
  game.mode = 'over'; S.stopMusic?.(); $('hud').classList.add('hidden'); $('shop').classList.add('hidden'); $('board').classList.add('hidden'); W.fog.visible = false;
  $('ov-title').textContent = win ? '🏆 승리!' : '😭 패배…';
  const s = m.score; game.sb = s;
  $('ov-sub').textContent = `${fmt(s.time)} · ${TEAMS.blue.name} ${s.kills.blue} : ${s.kills.red} ${TEAMS.red.name}`;
  $('ov-list').innerHTML = ['blue', 'red'].map((t) => `<div class="bd-t ${t}">${TEAMS[t].name}${m.winner === t ? ' 🏆' : ''}</div>${s.list.filter((x) => x.team === t).map(row).join('')}`).join('');
  $('again-btn').textContent = shell.room?.name?.includes('연습') ? '🔁 한 판 더' : '👥 방으로 돌아가기';
  if (win) { confetti(); S.sfx('win'); } else S.sfx('lose');
  shell.show('over');
}
function practice() { S.unlock?.(); shell.sendAfterHello({ t: 'practice', opts: { level: game.level } }); }
function toTitle() {
  game.mode = 'title'; clearInterval(pickTimer); S.stopMusic?.();
  for (const id of ['hud', 'pick', 'over', 'shop', 'board', 'help']) $(id).classList.add('hidden');
  for (const v of [...game.views.values()]) dropView(v);
  for (const s of structViews) { s.alive = true; s.o.visible = true; }
  W.fog.visible = false; ctx.clearRect(0, 0, innerWidth, innerHeight);
  shell.multi = false; shell.playing = false; shell.show('title');
}
const LEVEL_NAMES = { easy: '🌱 쉬움', normal: '🙂 보통', hard: '🔥 어려움' };
function levelSeg(el, cur, on, disabled) { el.innerHTML = `<div class="opt-row" style="text-align:center"><small>젤리봇 실력</small><br><div class="seg" id="lv-seg">${Object.entries(LEVEL_NAMES).map(([k, v]) => `<button data-l="${k}" class="${cur === k ? 'on' : ''}" ${disabled ? 'disabled' : ''}>${v}</button>`).join('')}</div></div>`; el.querySelectorAll('[data-l]').forEach((b) => { b.onclick = () => on(b.dataset.l); }); }
const shell = new Shell({
  sound: { muted: () => S.sound.muted, toggle: () => muteBtn() },
  key: 'jellyarena', title: '⚔️ 젤리 아레나', subtitle: '탑 · 미드 · 정글 · 바텀 · 서폿!<br>챔피언 20명, 5 대 5 로 상대의 젤리 심장을 부숴요', wsPath: '/arena-ws', max: 10,
  multiLabel: '👥 같이 하기', roomIcon: '⚔️', startLabel: '⚔️ 챔피언 고르러 가기',
  keysHelp: '우클릭 이동 · 공격 · Q W E R 기술 · D F 주문 · A 공격 이동 · B 상점 · Tab 점수판 · 빈 자리는 젤리봇이 채워요',
  buttons: [{ id: 'solo-btn', label: '🤖 젤리봇과 5 대 5 <small>혼자 연습 · 15~25분</small>', onClick: () => practice() }],
  screens: ['over'],
  describe: (o = {}) => `🤖 ${LEVEL_NAMES[o.level] || LEVEL_NAMES.normal}`,
  options: {
    title: (el) => { const draw = () => levelSeg(el, game.level, (l) => { game.level = l; store.set(LV_KEY, l); draw(); }); draw(); },
    room: (el, o, host) => levelSeg(el, o.level || 'normal', (l) => shell.send({ t: 'opts', opts: { level: l } }), !host),
  },
  teamChat: () => true,
  onStart: (m) => startPick(m),
  onFinish: (m) => results(m),
  onDisconnect: () => { if (game.mode !== 'title') toTitle(); },
  onEscape: () => { if (game.mode === 'play') return true; return false; },
});
shell.pickOpts = () => ({ level: game.level, team: true });
shell.on('picks', (m) => { game.picks = m.list; const me = m.list.find((x) => x.id === shell.myId); if (me?.role) game.myRole = me.role; renderPick(); });
shell.on('go', (m) => startMatch(m));
shell.on('s', onSnapshot);
shell.on('e', (m) => { for (const e of m.e) onEvent(e); });
shell.on('me', onMe);
shell.on('sb', onScore);
$('again-btn').onclick = () => { $('over').classList.add('hidden'); if (shell.room?.name?.includes('연습')) { shell.send({ t: 'leave' }); game.mode = 'title'; for (const v of [...game.views.values()]) dropView(v); practice(); } else { game.mode = 'room'; for (const v of [...game.views.values()]) dropView(v); for (const s of structViews) { s.alive = true; s.o.visible = true; } shell.backToRoom(); } };
$('ov-home').onclick = () => { shell.send({ t: 'leave' }); toTitle(); };

// ---------- 조준 표시 ----------
const aimG = new THREE.Group(); aimG.visible = false; scene.add(aimG);
const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); aimRing.rotation.x = -Math.PI / 2; aimRing.position.y = 0.15;
const aimDisc = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); aimDisc.rotation.x = -Math.PI / 2; aimDisc.position.y = 0.16;
const aimLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })); aimLine.rotation.x = -Math.PI / 2; aimLine.position.y = 0.17;
aimG.add(aimRing, aimDisc, aimLine);
const hoverRing = ringOf('#ff5a7a', 0.95); hoverRing.visible = false; scene.add(hoverRing);
function updateAim(me) {
  const s = game.aim; if (!s || !me || !game.me?.alive || !game.def) { aimG.visible = false; return; }
  const sk = game.def.skills[s], g = mouseGround(), dx = g.x - me.x, dz = g.z - me.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L;
  aimG.visible = true; aimG.position.set(me.x, 0, me.z);
  const col = sk.color || '#7fd8ff'; aimDisc.material.color.set(col); aimLine.material.color.set(col);
  const R = Math.min(sk.range || sk.radius || 8, 60); aimRing.visible = sk.range < 100 && sk.kind !== 'nova' && sk.kind !== 'buff' && !sk.follow; aimRing.scale.setScalar(R);
  aimLine.visible = sk.kind === 'shot' || sk.kind === 'dash'; aimDisc.visible = false;
  if (aimLine.visible) { aimLine.rotation.set(-Math.PI / 2, 0, Math.atan2(-fx, -fz)); aimLine.scale.set((sk.width || 1.2) * 1.6, Math.min(sk.range, 60), 1); }
  if (sk.kind === 'aoe' || (sk.kind === 'zone' && !sk.follow)) { const d = Math.min(R, L); aimDisc.visible = true; aimDisc.position.set(fx * d, 0.16, fz * d); aimDisc.scale.setScalar(sk.radius); }
  if (sk.kind === 'nova' || (sk.kind === 'zone' && sk.follow)) { aimDisc.visible = true; aimDisc.position.set(0, 0.16, 0); aimDisc.scale.setScalar(sk.radius); }
  if (sk.kind === 'blink') { const d = Math.min(R, L); aimDisc.visible = true; aimDisc.position.set(fx * d, 0.16, fz * d); aimDisc.scale.setScalar(0.9); }
  if (sk.kind === 'cone') { aimDisc.visible = true; aimDisc.position.set(fx * sk.range * 0.55, 0.16, fz * sk.range * 0.55); aimDisc.scale.setScalar(sk.range * 0.55); }
  if (sk.kind === 'ally' && sk.radius) { aimRing.visible = true; aimRing.scale.setScalar(sk.radius); }
}
// ---------- 안개 · 미니맵 ----------
let fogT = 0, miniT = 0;
function drawFog() {
  const c = W.fogC, x = c.getContext('2d'), k = c.width / (SIZE * 2);
  x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height); x.fillStyle = 'rgba(8,12,28,.62)'; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-out';
  const hole = (px, pz, r) => { const X = (px + SIZE) * k, Z = (pz + SIZE) * k, R = r * k, g = x.createRadialGradient(X, Z, R * 0.7, X, Z, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(X, Z, R, 0, 7); x.fill(); };
  for (const v of game.views.values()) if (v.team === game.team) hole(v.x, v.z, v.k === 0 ? 16 : v.k === 1 ? 10 : v.ward ? 12 : 12);
  for (const s of structViews) if (s.team === game.team && s.alive) hole(s.at[0], s.at[1], s.k === 'heart' ? 22 : s.k === 'gate' ? 12 : 17);
  W.fogT.needsUpdate = true;
}
function drawMini() {
  const x = mctx, S2 = mini.width, k = S2 / (SIZE * 2), P = (a) => (a + SIZE) * k;
  x.drawImage(miniBg, 0, 0, S2, S2); x.drawImage(W.fogC, 0, 0, S2, S2);
  for (const s of structViews) if (s.alive) { x.fillStyle = TC[s.team]; x.strokeStyle = '#0008'; x.lineWidth = 3; const r = s.k === 'heart' ? 13 : s.k === 'gate' ? 7 : 8; x.beginPath(); if (s.k === 'tower') { x.moveTo(P(s.at[0]), P(s.at[1]) - r); x.lineTo(P(s.at[0]) + r, P(s.at[1]) + r * 0.7); x.lineTo(P(s.at[0]) - r, P(s.at[1]) + r * 0.7); x.closePath(); } else x.arc(P(s.at[0]), P(s.at[1]), r, 0, 7); x.fill(); x.stroke(); }
  for (const v of game.views.values()) {
    if (v.k === 1) { x.fillStyle = TC[v.team]; x.fillRect(P(v.x) - 3, P(v.z) - 3, 6, 6); }
    else if (v.k === 3) { x.fillStyle = MONS[v.mid]?.epic ? '#ffd23f' : '#f2e6c8'; x.beginPath(); x.arc(P(v.x), P(v.z), MONS[v.mid]?.epic ? 9 : 5, 0, 7); x.fill(); }
    else if (v.ward) { x.fillStyle = '#ffffff'; x.fillRect(P(v.x) - 3, P(v.z) - 3, 6, 6); }
  }
  x.font = '22px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const v of game.views.values()) if (v.k === 0) { x.fillStyle = v.id === game.myUnit ? '#ffe066' : TC[v.team]; x.beginPath(); x.arc(P(v.x), P(v.z), 15, 0, 7); x.fill(); x.fillStyle = '#000'; x.fillText(v.def.emoji, P(v.x), P(v.z) + 1); }
  // 지금 보는 곳
  const a = groundAt(0, 0), b = groundAt(innerWidth, innerHeight), a2 = groundAt(innerWidth, 0), b2 = groundAt(0, innerHeight);
  if (a && b && a2 && b2) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(P(a.x), P(a.z)); x.lineTo(P(a2.x), P(a2.z)); x.lineTo(P(b.x), P(b.z)); x.lineTo(P(b2.x), P(b2.z)); x.closePath(); x.stroke(); }
}
// ---------- 체력 막대 · 글자 ----------
function drawOverlay(dt) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  if (game.mode !== 'play') return;
  const zk = 1 / game.zoom;
  for (const v of game.views.values()) {
    if (v.hp == null || v.ward) continue;
    const pos = v.o.position;
    if (v.k === 0) {
      const s = toScreen(pos.x, 3.05, pos.z), w = 68 * zk, h = 8, x0 = s.x - w / 2, y0 = s.y, tot = Math.max(v.max, v.hp + (v.sh || 0)), me = v.id === game.myUnit, ally = v.team === game.team;
      ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 8);
      ctx.fillStyle = me ? '#7fe08a' : ally ? '#4cc3ff' : '#ff5a7a'; ctx.fillRect(x0, y0, w * (v.hp / tot), h);
      if (v.sh) { ctx.fillStyle = '#e8eef5'; ctx.fillRect(x0 + w * (v.hp / tot), y0, w * (v.sh / tot), h); }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 300; i < tot; i += 300) ctx.fillRect(x0 + w * (i / tot), y0, 1, h);
      ctx.fillStyle = '#5ea6ff'; ctx.fillRect(x0, y0 + h + 1, w * ((v.mp || 0) / (v.mpMax || 1)), 3);
      ctx.fillStyle = '#1b1e2c'; ctx.beginPath(); ctx.arc(x0 - 9, y0 + 5, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe9a8'; ctx.font = "12px Jua, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v.lv, x0 - 9, y0 + 5.5);
      ctx.font = "13px Jua, sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = me ? '#ffe9a8' : '#fff'; ctx.strokeText(v.name, s.x, y0 - 10); ctx.fillText(v.name, s.x, y0 - 10);
      if (v.f & 1) { ctx.font = '16px sans-serif'; ctx.fillText('💫', s.x, y0 - 25); } else if (v.f & 2) { ctx.font = '16px sans-serif'; ctx.fillText('🌿', s.x, y0 - 25); } else if (v.f & 4) { ctx.font = '13px sans-serif'; ctx.fillText('🐌', x0 + w + 12, y0 + 5); }
    } else if (v.k === 2) {
      const dead = v.struct && !v.struct.alive; if (dead) continue;
      const top = (v.o.userData.top || 4) + 1.5, s = toScreen(pos.x, top, pos.z), w = (v.structKind === 'heart' ? 110 : 76) * zk, h = 7, x0 = s.x - w / 2;
      ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 2, s.y - 2, w + 4, h + 4); ctx.fillStyle = v.invuln ? '#9aa3b5' : TC[v.team]; ctx.fillRect(x0, s.y, w * (v.hp / v.max), h);
      if (v.invuln) { ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x0 + w + 11, s.y + 3); }
    } else if (v.hp < v.max || v === game.hover) {
      const epic = v.k === 3 && MONS[v.mid]?.epic, s = toScreen(pos.x, (v.o.userData.s || 1) * 1.9 + 0.5, pos.z), w = (epic ? 96 : v.big ? 46 : 30) * zk, x0 = s.x - w / 2, h = epic ? 7 : 4;
      ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x0 - 1, s.y - 1, w + 2, h + 2); ctx.fillStyle = v.k === 3 ? '#ffb347' : v.team === game.team ? '#7fd8ff' : '#ff7a95'; ctx.fillRect(x0, s.y, w * (v.hp / v.max), h);
      if (epic) { ctx.font = "13px Jua, sans-serif"; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.fillStyle = '#fff'; ctx.strokeText(MONS[v.mid].name, s.x, s.y - 9); ctx.fillText(MONS[v.mid].name, s.x, s.y - 9); }
      // 막타 표시: 내 공격 한 대로 잡힐 꼬마
      if (v.k === 1 && v.team !== game.team && game.me && v.hp < game.me.st.ad) { ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 2, s.y - 2, w + 4, h + 4); }
    }
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t -= dt; if (f.t <= 0) { floats.splice(i, 1); continue; }
    const k = 1 - f.t / f.life, s = toScreen(f.x, f.y + k * 1.4, f.z);
    ctx.globalAlpha = Math.min(1, f.t * 2.5); ctx.font = `${f.big ? 22 : 15}px Jua, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = f.col; ctx.strokeText(f.text, s.x, s.y); ctx.fillText(f.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
}
// ---------- 매 프레임 ----------
let last = performance.now(), titleA = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const k = Math.min(1, dt * 13);
  // 시계는 초 단위로 돈다
  if (game.mode === 'play') $('s-time').textContent = fmt(game.T);
  for (const v of game.views.values()) {
    if (v.struct) { v.x = v.tx; v.z = v.tz; continue; }
    const dx = v.tx - v.x, dz = v.tz - v.z, moved = Math.hypot(dx, dz);
    if (moved > 14) { v.x = v.tx; v.z = v.tz; } else { v.x += dx * k; v.z += dz * k; }
    let d = (v.tface ?? v.face) - v.face; d = Math.atan2(Math.sin(d), Math.cos(d)); v.face += d * Math.min(1, dt * 12);
    v.hurtT = Math.max(0, v.hurtT - dt);
    if (v.k === 0) {
      const air = v.f & 16 ? 1.2 : 0, moving = v.f & 128;
      v.yy = (v.yy || 0) + (air - (v.yy || 0)) * Math.min(1, dt * 8);
      v.o.position.set(v.x, v.yy, v.z); v.o.rotation.y = v.face; v.ring.position.set(v.x, 0.08, v.z); v.bear.update(dt, moving ? 7 : 0, { noCrawl: true });
      v.o.visible = !(v.f & 8 && v.team !== game.team);
      if (v.dashT > 0) { v.dashT -= dt; spark(v.x, 1, v.z, v.dashCol, 1.5, 0.25); }
    } else {
      v.o.position.set(v.x, 0, v.z); v.o.rotation.y = v.face;
      if (v.o.userData.body) { const s = v.o.userData.s || 1, b = Math.sin(now / 130 + v.id) * 0.06; v.o.userData.body.position.y = (v.mid === 'bee' ? 1.2 : 0.74) * s * (1 + b * 0.5); v.o.userData.body.scale.y = (v.mid ? 0.75 : 0.78) * s * (1 + b); }
      if (v.o.userData.wings) v.o.userData.wings.forEach((w, i) => { w.rotation.z = Math.sin(now / 28) * 0.5 * (i ? 1 : -1); });
    }
  }
  for (const s of structViews) { const g = s.o.userData.gem; if (!g) continue; g.rotation.y = now / 700; g.position.y = s.o.userData.top + Math.sin(now / 500 + s.at[0]) * 0.18; }
  // 투사체
  for (const [id, s] of shots) { const st = s.e.v * dt; s.x += s.e.fx * st; s.z += s.e.fz * st; s.left -= st; s.m.position.set(s.x, 1.2, s.z); if ((s.tr -= dt) <= 0) { s.tr = 0.035; spark(s.x, 1.2, s.z, s.e.col, s.e.w * 0.9, 0.22); } if (s.left <= 0) { scene.remove(s.m); shots.delete(id); } }
  // 효과
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    if (f.delay > 0) { f.delay -= dt; f.o.visible = false; continue; }
    f.o.visible = true; f.t -= dt;
    const q = Math.max(0, f.t / f.life);
    if (f.kind === 'spark') { f.o.material.opacity = q; f.o.scale.setScalar(f.s * (0.5 + q * 0.7)); if (f.vx) { f.o.position.x += f.vx * dt; f.o.position.z += f.vz * dt; f.o.position.y += f.vy * dt; f.vy -= 10 * dt; } }
    else if (f.kind === 'grow') { const r = f.r * (1 - q * q); f.o.scale.set(r, 1, r); f.d.material.opacity = 0.4 * q; f.e.material.opacity = q; }
    else if (f.kind === 'charge') { f.d.material.opacity = 0.12 + (1 - q) * 0.35; f.e.material.opacity = 0.9; }
    else if (f.kind === 'zone') { if (f.follow) { const v = view(f.follow); if (v) f.o.position.set(v.x, 0.12, v.z); } f.d.material.opacity = 0.2 + Math.sin(now / 90) * 0.06; f.e.material.opacity = Math.min(1, q * 4); }
    else if (f.kind === 'shrink') { const r = 0.3 + q * 1.1; f.o.scale.set(r, 1, r); f.e.material.opacity = q; f.d.material.opacity = 0; }
    else if (f.kind === 'orb') { const to = f.to, tx = to.o?.position.x ?? to.x, tz = to.o?.position.z ?? to.z, dx = tx - f.o.position.x, dz = tz - f.o.position.z, L = Math.hypot(dx, dz), st = f.speed * dt; if (L <= st + 0.3) f.t = 0; else { f.o.position.x += (dx / L) * st; f.o.position.z += (dz / L) * st; f.o.position.y += (1.1 - f.o.position.y) * Math.min(1, dt * 7); } }
    else { f.d.material.opacity = (f.fill || 0) * q; f.e.material.opacity = q; }
    if (f.t <= 0) { scene.remove(f.o); fx.splice(i, 1); }
  }
  // 카메라
  const me = view(game.myUnit);
  if (game.mode === 'play') {
    if (game.locked && me) { game.focus.x += (me.x - game.focus.x) * Math.min(1, dt * 7); game.focus.z += (me.z - game.focus.z) * Math.min(1, dt * 7); }
    else if (!game.locked) {
      const m = game.mouse, sp = 42 * dt, E = 14; let dx = 0, dz = 0;
      if (m.in) { if (m.x < E) dx = -1; if (m.x > innerWidth - E) dx = 1; if (m.y < E) dz = -1; if (m.y > innerHeight - E) dz = 1; }
      if (keys.has('ArrowLeft')) dx = -1; if (keys.has('ArrowRight')) dx = 1; if (keys.has('ArrowUp')) dz = -1; if (keys.has('ArrowDown')) dz = 1;
      game.focus.x = Math.max(-SIZE, Math.min(SIZE, game.focus.x + dx * sp)); game.focus.z = Math.max(-SIZE, Math.min(SIZE, game.focus.z + dz * sp));
    }
    if (keys.has('Space') && me) game.focus.set(me.x, 0, me.z);
    const h = 38 * game.zoom, b = 24 * game.zoom;
    camera.position.set(game.focus.x, h, game.focus.z + b); camera.lookAt(game.focus.x, 0, game.focus.z);
    updateAim(me);
    game.hover = unitUnder(game.mouse.x, game.mouse.y);
    hoverRing.visible = !!game.hover && game.hover.k !== 2;
    if (hoverRing.visible) { hoverRing.position.set(game.hover.x, 0.1, game.hover.z); hoverRing.scale.setScalar((game.hover.k === 0 ? 1.5 : game.hover.k === 3 ? (game.hover.o.userData.s || 1) * 1.05 : 0.95) * (1 + Math.sin(now / 120) * 0.05)); }
    canvas.style.cursor = game.amove ? 'crosshair' : game.hover ? 'pointer' : 'default';
    if ((fogT -= dt) <= 0) { fogT = 0.2; drawFog(); }
    if ((miniT -= dt) <= 0) { miniT = 0.1; drawMini(); }
    // 꾹 누르면 계속 이동
    if (game.rdown && (game.rdownT = (game.rdownT || 0) - dt) <= 0) { game.rdownT = 0.22; if (!game.hover) moveOrAttack(game.mouse.x, game.mouse.y, false); }
  } else {
    // 처음 화면: 맵 위를 천천히
    titleA += dt * 0.06; const r = 40;
    camera.position.set(Math.cos(titleA) * r, 34, Math.sin(titleA) * r + 34); camera.lookAt(Math.cos(titleA) * r * 0.6, 0, Math.sin(titleA) * r * 0.6);
  }
  drawOverlay(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
shell.boot();
