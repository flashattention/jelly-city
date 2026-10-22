// 브라우저 전투: 조준, 타격 판정, 투사체, 이펙트
import * as THREE from 'three';
import { itemDef, weaponStats, ammoName, ITEMS, SHOPS, rarityOf } from './items.js';
import { G } from '../../shared/js/utils.js';
import { levelStats } from './level.js';
import { mouthPos } from './animals.js';
import { scream, sfx } from '../../shared/js/audio.js';

const ELEMENT_COLOR = { fire: '#ff5722', ice: '#4fc3f7', thunder: '#ffee58', wind: '#a5d6a7', poison: '#9ccc65', holy: '#fff59d', dark: '#7e57c2' };
const BASE_SPREAD = { m4: 0.022, revolver: 0.012, deagle: 0.016, uzi: 0.05, mp5: 0.028, ak47: 0.035, scar: 0.02, m249: 0.045, barrett: 0.003, plasma_smg: 0.025, hunting_rifle: 0.006, pistol: 0.018, blaster: 0.015, rifle: 0.03, blaster_rifle: 0.026, minigun: 0.045, sniper: 0.012 };

const tmpV = new THREE.Vector3();

// ---------------- 이펙트 ----------------
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.flash = new THREE.PointLight('#ffb74d', 0, 30, 1.5);
    scene.add(this.flash);
    this.flashT = 0;
    this.holes = [];
  }

  // 젤리 튀기기: 맞은 곰돌이 젤리 색 조각들이 튀어 바닥에 떨어져 잠깐 웅덩이로 남는다
  jelly(p, color, n = 9, big = false) {
    const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85, shininess: 90, specular: new THREE.Color('#ffffff'), emissive: new THREE.Color(color).multiplyScalar(0.25) });
    const ground = this.groundFn ? this.groundFn(p.x, p.z, p.y) : p.y - 1.2;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(G.sphereLow(), mat.clone());
      const s = (big ? 0.16 : 0.09) + Math.random() * 0.07;
      m.scale.setScalar(s); m.position.copy(p);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * (big ? 5 : 3);
      this.items.push({ m, t: 5.5, life: 5.5, kind: 'jelly', v: new THREE.Vector3(Math.cos(a) * sp, 2.5 + Math.random() * 3.5, Math.sin(a) * sp), ground, s });
    }
    mat.dispose();
  }

  // ---------------- 불 (드래곤·화상·화염 폭발) ----------------
  // 불꽃 한 조각: 빛나는 스프라이트가 날아가며 커지고, 노랑→주황→빨강→연기로 식는다
  flame(p, v, life, s0, s1, smokey = true) {
    // 대부분은 보통 섞기(주황·빨강이 살아 있게), 일부만 빛나는 심지(더하기 섞기)
    const glow = Math.random() < 0.22;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex(), color: '#ffd27a', transparent: true, depthWrite: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.position.copy(p); m.scale.setScalar(s0); m.material.rotation = Math.random() * 6.28;
    this.scene.add(m);
    this.items.push({ m, t: life, life, kind: 'flame', v: v.clone(), s0, s1, smokey, op: glow ? 0.7 : 1.35 });
  }
  ember(p, v) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex(), color: '#ffd54f', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.scale.setScalar(0.12 + Math.random() * 0.1);
    this.scene.add(m);
    this.items.push({ m, t: 0.9, life: 0.9, kind: 'ember', v: v.clone() });
  }
  smokePuff(p, v, s) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), color: '#5d5d5d', transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.copy(p); m.scale.setScalar(s);
    this.scene.add(m);
    this.items.push({ m, t: 1.8, life: 1.8, kind: 'puff', v: v.clone(), s0: s });
  }
  // 불 뿜기 이미터: from/dir 을 매 프레임 다시 물어봐서 드래곤이 움직여도 입에서 계속 나온다
  emitter(o) { const e = { kind: 'emit', t: 1e9, life: 1e9, m: null, acc: 0, scorchT: 0, ...o }; this.items.push(e); return e; }
  updateEmitter(e, dt) {
    const from = e.from(), dir0 = from && e.dir();
    if (!from || !dir0 || performance.now() > e.until) { e.t = 0; return; }
    const dir = dir0.clone().normalize(), len = e.len, pw = e.power ?? 1;
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    e.acc += dt * (e.rate ?? 150) * pw;
    while (e.acc >= 1) {
      e.acc -= 1;
      const a = Math.random() * 6.28, r = Math.random() * (e.spread ?? 0.16);
      const d = dir.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const life = 0.55 + Math.random() * 0.3;
      this.flame(from.clone().addScaledVector(d, Math.random() * 0.6), d.multiplyScalar(len / life * (0.3 + Math.random() * 0.85)), life, 0.7 * pw, (3.2 + Math.random() * 2.4) * pw);
      if (Math.random() < 0.18) this.ember(from.clone(), dir.clone().multiplyScalar(len * 1.4).add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4)));
    }
    // 입 앞이 이글이글 빛난다
    this.flash.position.copy(from).addScaledVector(dir, 3); this.flash.intensity = (28 + Math.random() * 22) * pw; this.flashT = Math.max(this.flashT, 0.08);
    // 불길이 땅에 닿으면 그을음 + 바닥 불
    if ((e.scorchT -= dt) <= 0 && this.groundFn) {
      e.scorchT = 0.22;
      const end = from.clone().addScaledVector(dir, len * 0.85);
      const gy = this.groundFn(end.x, end.z, end.y);
      if (end.y - gy < 3.5) {
        const gp = new THREE.Vector3(end.x, gy, end.z);
        this.hole(gp, [0, 1, 0], '__scorch');
        for (let i = 0; i < 3; i++) this.flame(gp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.2, (Math.random() - 0.5) * 2)), new THREE.Vector3(0, 2 + Math.random() * 2, 0), 0.9, 0.5 * pw, 1.6 * pw);
        if (Math.random() < 0.5) this.smokePuff(gp.clone().setY(gy + 1), new THREE.Vector3(0, 1.4, 0), 1.2 * pw);
      }
    }
  }
  // 짧은 불길 (다른 플레이어의 드래곤 등)
  breath(from, dir, len = 14, dur = 0.45) {
    const f = from.clone(), d = dir.clone();
    this.emitter({ from: () => f, dir: () => d, len, power: Math.max(0.6, len / 14), until: performance.now() + dur * 1000 });
  }
  // 화상: 몸에서 작은 불꽃이 피어오른다
  burning(getPos, secs) {
    this.emitter({ from: getPos, dir: () => new THREE.Vector3(0, 1, 0), len: 1.3, power: 0.38, rate: 40, spread: 0.5, until: performance.now() + secs * 1000 });
  }
  // 화염 폭발 (불덩이·로켓 등 큰 폭발)
  fireBlast(p, r = 5) {
    for (let i = 0; i < 26 + r * 3; i++) {
      const a = Math.random() * 6.28, el = Math.random() * 1.2;
      const v = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el) + 0.2, Math.sin(a) * Math.cos(el)).multiplyScalar(r * (1.2 + Math.random() * 1.6));
      this.flame(p.clone(), v, 0.55 + Math.random() * 0.35, 0.6, r * (0.45 + Math.random() * 0.3));
    }
    for (let i = 0; i < 14; i++) this.ember(p.clone(), new THREE.Vector3((Math.random() - 0.5) * r * 4, 3 + Math.random() * r * 2, (Math.random() - 0.5) * r * 4));
    for (let i = 0; i < 6; i++) this.smokePuff(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * r, Math.random() * r * 0.5, (Math.random() - 0.5) * r)), new THREE.Vector3(0, 1.5, 0), r * 0.5);
    if (this.groundFn) { const gy = this.groundFn(p.x, p.z, p.y); if (p.y - gy < 3) this.hole(new THREE.Vector3(p.x, gy, p.z), [0, 1, 0], '__scorch_big'); }
  }


  // 총알 자국: 맞은 면(normal)에 총 종류별 탄흔을 붙인다. 45초 뒤 서서히 사라짐
  hole(point, normal, wid, color) {
    const st = holeStyle(wid);
    const m = new THREE.Mesh(holeGeo, holeMat(st, color));
    const n = new THREE.Vector3(normal[0] ?? normal.x, normal[1] ?? normal.y, normal[2] ?? normal.z).normalize();
    m.position.copy(point).addScaledVector(n, 0.015);
    m.lookAt(m.position.clone().add(n));
    m.rotateZ(Math.random() * Math.PI * 2);
    const sz = HOLE_SIZE[st] * (0.85 + Math.random() * 0.3);
    m.scale.set(sz, sz, 1);
    m.renderOrder = 2;
    this.scene.add(m);
    this.holes.push({ m, t: 45 });
    if (this.holes.length > 160) { const old = this.holes.shift(); this.scene.remove(old.m); }
    // 맞은 자리에서 튀는 파편
    const dust = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color: st === 'energy' ? (color || '#18ffff') : '#bdbdbd', transparent: true, opacity: 0.8, depthWrite: false }));
    dust.scale.setScalar(sz * 0.8); dust.position.copy(point).addScaledVector(n, 0.08);
    this.scene.add(dust);
    this.items.push({ m: dust, t: 0.25, life: 0.25, kind: 'smoke' });
  }

  // o.life: 남는 시간, o.flicker: 번개처럼 깜빡임 (총구 불꽃 없이)
  tracer(a, b, color = '#fff59d', width = 1, o = {}) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.01) return;
    const m = new THREE.Mesh(G.cylLow(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: o.flicker ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.scale.set(0.03 * width, len, 0.03 * width);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.scene.add(m);
    this.items.push({ m, t: o.life || 0.09, life: o.life || 0.09, kind: o.flicker ? 'flicker' : 'fade' });
    if (o.flicker) return;
    // 총구 불꽃
    const f = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color: '#fff3e0', transparent: true, opacity: 0.9 }));
    f.scale.setScalar(0.15 * width); f.position.copy(a);
    this.scene.add(f);
    this.items.push({ m: f, t: 0.05, life: 0.05, kind: 'fade' });
  }

  boom(p, r = 5, small = false) {
    const ball = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color: small ? '#ffcc80' : '#ff9100', transparent: true, opacity: 0.95, depthWrite: false }));
    ball.position.copy(p); ball.scale.setScalar(0.3);
    this.scene.add(ball);
    this.items.push({ m: ball, t: 0.5, life: 0.5, kind: 'boom', r });
    for (let i = 0; i < (small ? 3 : 8); i++) {
      const s = new THREE.Mesh(G.sphereLow(), new THREE.MeshToonMaterial({ color: '#616161', transparent: true, opacity: 0.7, depthWrite: false }));
      s.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * r * 0.6, Math.random() * r * 0.3, (Math.random() - 0.5) * r * 0.6));
      s.scale.setScalar(r * 0.18);
      this.scene.add(s);
      this.items.push({ m: s, t: 1.6, life: 1.6, kind: 'smoke' });
    }
    if (!small) { this.flash.position.copy(p); this.flash.position.y += 2; this.flash.intensity = 40; this.flashT = 0.25; }
    if (!small && r >= 4) this.fireBlast(p, r * 0.8); // 큰 폭발은 불길이 치솟는다
  }

  // 지그재그 번개
  bolt(a, b, color = '#ffee58') {
    // 지그재그 번개: 색 띤 굵은 빛 + 하얀 심 + 곁가지, 끝에서 번쩍 · 불꽃
    const zig = (p0, p1, n, j) => { const pts = [p0.clone()]; for (let i = 1; i < n; i++) { const q = p0.clone().lerp(p1, i / n); q.x += (Math.random() - 0.5) * j; q.y += (Math.random() - 0.5) * j; q.z += (Math.random() - 0.5) * j; pts.push(q); } pts.push(p1.clone()); return pts; };
    const main = zig(a, b, 9, 1.1);
    const B = { life: 0.32, flicker: true };
    for (let i = 0; i < main.length - 1; i++) { this.tracer(main[i], main[i + 1], color, 5, B); this.tracer(main[i], main[i + 1], '#ffffff', 1.6, B); }
    for (let f = 0; f < 3; f++) {
      const from = main[1 + Math.floor(Math.random() * (main.length - 2))];
      const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 3));
      const br = zig(from, to, 4, 0.6);
      for (let i = 0; i < br.length - 1; i++) this.tracer(br[i], br[i + 1], color, 2, { life: 0.22, flicker: true });
    }
    this.part(b, new THREE.Vector3(), '#ffffff', 0.18, 2.6, 0.6);
    this.part(a, new THREE.Vector3(), color, 0.15, 1.2, 0.3);
    for (let i = 0; i < 14; i++) this.part(b, new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 7, (Math.random() - 0.5) * 10), Math.random() < 0.5 ? '#fff9c4' : color, 0.45, 0.22, 0, { grav: 14 });
  }
  // ---------------- 마법 효과 ----------------
  // 빛나는 알갱이: 속도 · 중력 · 공기저항 · 크기 변화 (o.normal 이면 빛나지 않는 연기)
  part(p, v, color, life = 0.6, s0 = 0.3, s1 = 0, o = {}) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.normal ? smokeTex() : glowTex(), color, transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending }));
    m.position.copy(p); m.scale.setScalar(s0);
    this.scene.add(m);
    this.items.push({ m, t: life, life, kind: 'part', v: v.clone(), s0, s1, grav: o.grav ?? 0, drag: o.drag ?? 0, op: o.op ?? 1, swirl: o.swirl || null });
  }
  // 퍼지는(또는 빨려드는) 고리. 기본은 바닥에 눕고, o.face 를 주면 그쪽을 본다
  ring(p, color, r = 3, life = 0.5, o = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(p);
    if (o.face) m.lookAt(o.face); else m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    this.items.push({ m, t: life, life, kind: 'ring', r, r0: o.r0 ?? 0.2, op: o.op ?? 0.9, implode: !!o.implode, ownGeo: true });
  }
  // 발밑 마법진 (돌면서 나타났다 사라진다)
  magicCircle(p, color, r = 2.2, life = 0.9) {
    const m = new THREE.Mesh(circleGeo, new THREE.MeshBasicMaterial({ map: circleTex(color), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += 0.06;
    this.scene.add(m);
    this.items.push({ m, t: life, life, kind: 'circle', r });
  }
  // 마법을 쓸 때: 마법진 + 손에서 빛이 터진다
  castFx(feet, hand, color) {
    this.magicCircle(feet, color);
    for (let i = 0; i < 10; i++) this.part(hand, new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), color, 0.4, 0.35, 0, { drag: 4 });
    this.part(hand, new THREE.Vector3(), '#ffffff', 0.18, 1.1, 0.2);
  }
  // 투사체 꼬리 (한 프레임 몫)
  trail(el, p, v, dt) {
    const n = Math.max(1, Math.round(dt * 50));
    const rnd = (k) => new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    for (let i = 0; i < n; i++) {
      const q = p.clone().addScaledVector(v, -dt * (i / n));
      if (el === 'fire') { this.part(q, rnd(1.5).addScaledVector(v, -0.05), Math.random() < 0.5 ? '#ffb74d' : '#ff5722', 0.35, 0.55, 0.05); if (Math.random() < 0.15) this.ember(q.clone(), rnd(3).setY(1 + Math.random() * 2)); }
      else if (el === 'ice') this.part(q, rnd(1.2), Math.random() < 0.5 ? '#e1f5fe' : '#4fc3f7', 0.55, 0.28, 0, { grav: 2 });
      else if (el === 'poison') this.part(q, rnd(0.6).setY(0.6), '#9ccc65', 0.7, 0.18, 0.45);
      else if (el === 'dark') { this.part(q, rnd(0.8), '#7e57c2', 0.6, 0.7, 0); if (Math.random() < 0.4) this.part(q, rnd(0.4), '#140024', 0.8, 0.5, 1.0, { normal: true, op: 0.6 }); }
    }
  }
  // 맞은 곳에서 터지는 모습
  elementBurst(p, el) {
    const rnd = (k) => new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    const ground = p.clone(); ground.y = Math.max(0.05, p.y - 0.8);
    if (el === 'fire') {
      for (let i = 0; i < 26; i++) this.part(p, rnd(14), Math.random() < 0.5 ? '#ffcc80' : '#ff5722', 0.55, 0.7, 0.1, { drag: 3, grav: -2 });
      for (let i = 0; i < 10; i++) this.ember(p.clone(), rnd(8).setY(3 + Math.random() * 4));
      this.ring(ground, '#ff7043', 3.8, 0.45); this.part(p, new THREE.Vector3(), '#fff3e0', 0.2, 3, 0.5);
    } else if (el === 'ice') {
      for (let i = 0; i < 22; i++) this.part(p, rnd(12).setY(2 + Math.random() * 5), Math.random() < 0.5 ? '#ffffff' : '#81d4fa', 0.8, 0.3, 0.05, { grav: 12, drag: 1 });
      this.ring(ground, '#b3e5fc', 2.8, 0.7); this.ring(ground, '#4fc3f7', 1.6, 0.5);
      this.part(p, new THREE.Vector3(), '#e1f5fe', 0.25, 2.2, 0.4);
    } else if (el === 'poison') {
      this.cloud(p, '#9ccc65');
      for (let i = 0; i < 18; i++) this.part(p.clone().add(rnd(2.5)), new THREE.Vector3(0, 0.6 + Math.random(), 0), '#c5e1a5', 1.4, 0.15, 0.5, { op: 0.8 });
      this.ring(ground, '#7cb342', 2.6, 0.8);
    } else if (el === 'dark') {
      this.ring(p, '#b388ff', 4, 0.45, { implode: true, face: p.clone().add(new THREE.Vector3(0, 1, 0)) });
      for (let i = 0; i < 24; i++) { const d = rnd(1).normalize(); this.part(p.clone().addScaledVector(d, 3), d.multiplyScalar(-7), '#7e57c2', 0.4, 0.6, 0.1); }
      setTimeout(() => { for (let i = 0; i < 18; i++) this.part(p, rnd(9), '#d1c4e9', 0.5, 0.5, 0, { drag: 2 }); this.part(p, new THREE.Vector3(), '#1a0033', 0.6, 2.5, 0.5, { normal: true, op: 0.7 }); }, 380);
    }
  }
  // 회오리 돌풍: 앞으로 밀려가며 도는 바람
  gust(p, dir) {
    const d = dir.clone().setY(0).normalize();
    for (let i = 0; i < 36; i++) {
      const h = Math.random() * 2.2, a = Math.random() * Math.PI * 2, r = 0.4 + h * 0.45;
      const q = p.clone().add(new THREE.Vector3(Math.cos(a) * r, h + 0.2, Math.sin(a) * r));
      this.part(q, d.clone().multiplyScalar(10), Math.random() < 0.5 ? '#ffffff' : '#c8e6c9', 0.6, 0.35, 0.1, { swirl: { c: p.clone(), d: d.clone(), w: 9 + Math.random() * 4, sp: 10 }, op: 0.8 });
    }
    for (let i = 0; i < 2; i++) setTimeout(() => this.ring(p.clone().addScaledVector(d, 1 + i * 2).setY(p.y + 1), '#e8f5e9', 2.2, 0.4, { face: p.clone().addScaledVector(d, 10).setY(p.y + 1), op: 0.6 }), i * 90);
  }
  // 치유의 빛: 하늘로 솟는 빛기둥 + 금가루
  holyFx(p) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#fff59d', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.position.y += 4.5;
    this.scene.add(m);
    this.items.push({ m, t: 1.1, life: 1.1, kind: 'pillar', ownGeo: true });
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 1.6; this.part(p.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.random() * 0.5, Math.sin(a) * r)), new THREE.Vector3(0, 2 + Math.random() * 4, 0), Math.random() < 0.5 ? '#fff59d' : '#ffffff', 1.2, 0.3, 0.05); }
    this.ring(p.clone().setY(p.y + 0.05), '#ffe082', 3.2, 0.8);
    this.magicCircle(p, '#ffe082', 3, 1.2);
  }
  // 떠오르는 하트·반짝이
  hearts(a, b, emoji = '💗') {
    for (let i = 0; i < 6; i++) {
      const sp = makeEmojiSprite(emoji);
      sp.position.copy(a);
      this.scene.add(sp);
      const to = b ? b.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8)) : a.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random(), (Math.random() - 0.5) * 2));
      this.items.push({ m: sp, t: 1.3 + i * 0.08, life: 1.3 + i * 0.08, kind: 'fly', from: a.clone().add(new THREE.Vector3(0, 1.4, 0)), to, delay: i * 0.08 });
    }
  }
  sparkle(p, color, n = 12, r = 1.5) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
      m.scale.setScalar(0.12);
      m.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * r, Math.random() * r, (Math.random() - 0.5) * r));
      this.scene.add(m);
      this.items.push({ m, t: 0.9, life: 0.9, kind: 'smoke' });
    }
  }
  cloud(p, color) {
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
      s.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 1.2, (Math.random() - 0.5) * 2.5));
      s.scale.setScalar(0.7 + Math.random() * 0.5);
      this.scene.add(s);
      this.items.push({ m: s, t: 3.5, life: 3.5, kind: 'smoke' });
    }
  }

  // 휘두르기 궤적: 무기 등급이 높을수록 화려하게 (일반 → 고급 → 희귀 → 전설), 광선검은 제 색으로 빛난다
  slash(p, heading, wid = 'fist') {
    const d = itemDef(wid) || {};
    const saber = SABER_COL[wid];
    const tier = wid === 'fist' ? -1 : saber ? 3 : TIER[rarityOf(wid)] ?? 0;
    const col = saber || ['#eceff1', '#40c4ff', '#e040fb', '#ffab00'][Math.max(0, tier)];
    const R = Math.max(1, Math.min(3.2, (d.range || 1.7) * 0.6));
    const arc = (radius, tube, color, op, life, add, delay = 0, tilt = 0) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 4, 24, Math.PI * 0.85), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
      m.position.copy(p); m.position.y += 1.1 + tilt * 0.3;
      const r0 = -heading + Math.PI * 0.9;
      m.rotation.set(Math.PI / 2 + tilt, 0, r0);
      m.visible = delay <= 0;
      this.scene.add(m);
      this.items.push({ m, t: life + delay, life: life + delay, delay, kind: 'sweep', r0, op });
    };
    if (tier < 0) { arc(0.8, 0.04, '#ffffff', 0.6, 0.12, false); return; }
    // 기본 궤적 (등급이 높을수록 굵고 오래)
    arc(R, 0.04 + tier * 0.02, saber ? '#ffffff' : col, 0.85, 0.16 + tier * 0.04, !!saber);
    if (tier >= 1 || saber) arc(R, 0.12 + tier * 0.04, col, 0.45, 0.2 + tier * 0.04, true); // 빛 번짐
    if (tier >= 2) arc(R * 0.82, 0.05, col, 0.6, 0.22, true, 0.04, 0.25);                  // 겹 궤적
    if (tier >= 3) {
      arc(R * 1.15, 0.06, saber ? col : '#fff8e1', 0.55, 0.26, true, 0.08, -0.25);
      // 전설: 바닥 충격파 + 반짝이 + 섬광
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 4, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = Math.PI / 2; ring.position.copy(p); ring.position.y += 0.1;
      this.scene.add(ring);
      this.items.push({ m: ring, t: 0.35, life: 0.35, kind: 'boom', r: R * 1.6, ownGeo: true });
      this.flash.position.copy(p); this.flash.position.y += 1.2; this.flashT = 0.12;
    }
    if (tier >= 2) {
      const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
      this.sparkle(p.clone().addScaledVector(fwd, R * 0.8).setY(p.y + 1.1), col, tier >= 3 ? 14 : 6, R * 0.6);
    }
  }

  // 1인칭 휘두르기: 눈앞에서 화면을 가로질러 베는 궤적 (카메라에 붙어 다녀서 빨리 날아도 보인다)
  //   젤리병단 장비(쌍검)는 두 칼이 X자로 교차한다
  fpSlash(cam, wid = 'fist') {
    const saber = SABER_COL[wid], tier = wid === 'fist' ? -1 : saber ? 3 : TIER[rarityOf(wid)] ?? 0;
    const twin = !!itemDef(wid)?.odm;
    const col = twin ? '#bfefff' : saber || ['#eceff1', '#40c4ff', '#e040fb', '#ffab00'][Math.max(0, tier)];
    const blade = (roll, dir, delay, color, tube, op, add) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.62, tube, 4, 28, Math.PI * 0.75), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, depthTest: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
      m.renderOrder = 999; m.visible = false; this.scene.add(m);
      const life = 0.28 + delay;
      this.items.push({ m, t: life, life, delay, kind: 'fpsweep', cam, roll, dir, op, ownGeo: true });
    };
    const one = (roll, dir, delay) => {
      blade(roll, dir, delay, '#ffffff', 0.022, 0.95, false);       // 칼날
      blade(roll, dir, delay, col, 0.075, 0.55, true);              // 빛 번짐
    };
    if (twin) { one(2.2, 1, 0); one(0.9, -1, 0.07); }               // 오른쪽 위 → 왼쪽 아래, 왼쪽 위 → 오른쪽 아래
    else { this.fpFlip = !this.fpFlip; if (this.fpFlip) one(2.2, 1, 0); else one(0.9, -1, 0); } // 한 손 무기: 번갈아 반대로
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t -= dt;
      const k = Math.max(0, it.t / it.life);
      if (it.kind === 'sweep') {
        const el = it.life - it.t;
        if (el < it.delay) continue;
        it.m.visible = true;
        const u = (el - it.delay) / (it.life - it.delay);
        it.m.rotation.z = it.r0 - u * 1.4; // 휙 쓸고 지나간다
        it.m.material.opacity = it.op * (1 - u);
      } else if (it.kind === 'fpsweep') {
        const el = it.life - it.t;
        if (el < it.delay) continue;
        const u = (el - it.delay) / (it.life - it.delay), c = it.cam;
        it.m.visible = true;
        it.m.position.set(0, -0.08, -1.05).applyQuaternion(c.quaternion).add(c.position);
        it.m.quaternion.copy(c.quaternion);
        it.m.rotateZ(it.roll - it.dir * u * 1.7); // 휙 가로지른다
        it.m.material.opacity = it.op * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      } else if (it.kind === 'boom') { it.m.scale.setScalar(0.3 + (1 - k) * it.r); it.m.material.opacity = k; }
      else if (it.kind === 'fly') {
        const u = Math.min(1, Math.max(0, (it.life - it.t - (it.delay || 0)) / (it.life - (it.delay || 0)) * 1.4));
        it.m.position.copy(it.from).lerp(it.to, u); it.m.position.y += Math.sin(u * Math.PI) * 0.8;
        it.m.material.opacity = Math.min(1, k * 2.5);
      } else if (it.kind === 'emit') { this.updateEmitter(it, dt); if (it.t > 0) continue; this.items.splice(i, 1); continue;
      } else if (it.kind === 'flame') {
        const u = 1 - k;
        it.v.multiplyScalar(Math.max(0, 1 - dt * 1.6)); it.v.y += 3 * dt; // 앞으로 뻗다가 위로 피어오른다
        it.m.position.addScaledVector(it.v, dt);
        it.m.scale.setScalar(it.s0 + (it.s1 - it.s0) * Math.sqrt(u));
        // 노랑 → 주황 → 짙은 빨강 (겹쳐도 하얗게 날아가지 않게 살짝 어둡게)
        it.m.material.color.setRGB(Math.max(0.55, 1 - u * 0.5), Math.max(0.08, 0.72 - u * 0.95), Math.max(0, 0.32 - u * 0.9));
        it.m.material.opacity = Math.min(1, (u < 0.55 ? 0.62 : 0.62 * (1 - u) / 0.45) * (it.op ?? 1));
        if (it.smokey && it.t - dt <= 0 && Math.random() < 0.2) this.smokePuff(it.m.position.clone(), new THREE.Vector3(0, 1.2, 0), it.s1 * 0.6);
      } else if (it.kind === 'ember') { it.v.y -= 6 * dt; it.m.position.addScaledVector(it.v, dt); it.m.material.opacity = k;
      } else if (it.kind === 'puff') { it.m.position.addScaledVector(it.v, dt); it.m.scale.setScalar(it.s0 * (1 + (1 - k) * 1.5)); it.m.material.opacity = 0.45 * k;
      } else if (it.kind === 'jelly') {
        if (!it.landed) {
          it.v.y -= 14 * dt;
          it.m.position.addScaledVector(it.v, dt);
          if (it.m.position.y <= it.ground + 0.02) { it.landed = true; it.m.position.y = it.ground + 0.02; it.m.scale.set(it.s * 2.2, it.s * 0.35, it.s * 2.2); }
        }
        it.m.material.opacity = 0.85 * Math.min(1, it.t / 1.2);
      } else if (it.kind === 'fire') {
        const el = it.life - it.t;
        if (el < it.delay) continue;
        const u = Math.min(1, (el - it.delay) / (it.life - it.delay));
        it.m.visible = true;
        it.m.position.copy(it.from).lerp(it.to, u); it.m.position.y += u * u * 0.8;
        it.m.scale.setScalar(it.s0 * (1 + u * 3));
        it.m.material.opacity = 0.85 * (1 - u) * (1 - u * 0.3);
      } else if (it.kind === 'smoke') { it.m.position.y += dt * 1.5; it.m.scale.multiplyScalar(1 + dt * 0.6); it.m.material.opacity = 0.7 * k; }
      else if (it.kind === 'flicker') it.m.material.opacity = k * (0.45 + Math.random() * 0.55); // 지직지직
      else if (it.kind === 'part') {
        if (it.swirl) {
          // 회오리: 축(중심)이 앞으로 가고, 알갱이는 그 둘레를 돈다
          const S = it.swirl; S.c.addScaledVector(S.d, S.sp * dt);
          const P = it.m.position, dx = P.x - S.c.x, dz = P.z - S.c.z, a = S.w * dt, ca = Math.cos(a), sa = Math.sin(a);
          P.x = S.c.x + dx * ca - dz * sa; P.z = S.c.z + dx * sa + dz * ca; P.y += dt * 0.8;
        } else {
          it.v.y -= it.grav * dt;
          if (it.drag) it.v.multiplyScalar(Math.max(0, 1 - it.drag * dt));
          it.m.position.addScaledVector(it.v, dt);
        }
        it.m.scale.setScalar(Math.max(0.001, it.s0 + (it.s1 - it.s0) * (1 - k)));
        it.m.material.opacity = it.op * Math.min(1, k * 2.2);
      } else if (it.kind === 'ring') {
        const u = 1 - k;
        it.m.scale.setScalar(it.implode ? Math.max(0.05, it.r * (1 - u)) : it.r0 + (it.r - it.r0) * (1 - (1 - u) * (1 - u)));
        it.m.material.opacity = it.op * (it.implode ? Math.min(1, u * 4) : k);
      } else if (it.kind === 'circle') {
        const u = 1 - k;
        it.m.rotation.z += dt * 2.4;
        it.m.scale.setScalar(it.r * (0.55 + Math.min(1, u * 5) * 0.45));
        it.m.material.opacity = Math.min(1, u * 6) * Math.min(1, k * 3) * 0.95;
      } else if (it.kind === 'pillar') { it.m.scale.x = it.m.scale.z = 0.3 + (1 - k) * 0.9; it.m.material.opacity = 0.55 * Math.min(1, k * 2); }
      else it.m.material.opacity = k;
      if (it.t <= 0) { this.scene.remove(it.m); it.m.material.dispose(); if (it.kind === 'sweep' || it.ownGeo) it.m.geometry.dispose(); this.items.splice(i, 1); }
    }
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i];
      h.t -= dt;
      if (h.t < 3) h.m.scale.multiplyScalar(1 - Math.min(1, dt * 1.2));
      if (h.t <= 0) { this.scene.remove(h.m); this.holes.splice(i, 1); }
    }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, this.flashT / 0.25) * 40; }
  }
}

// ---------------- 총알 자국 (총 종류별) ----------------
const HOLE_STYLE = {
  pistol: 'small', revolver: 'small', uzi: 'small', mp5: 'small',
  deagle: 'big', sniper: 'big', hunting_rifle: 'big',
  rifle: 'rifle', ak47: 'rifle', m4: 'rifle', scar: 'rifle', m249: 'rifle', minigun: 'rifle',
  shotgun: 'pellet', double_barrel: 'pellet',
  barrett: 'anti',
  blaster: 'energy', blaster_rifle: 'energy', plasma_smg: 'energy',
};
const HOLE_SIZE = { pellet: 0.08, small: 0.13, rifle: 0.17, big: 0.24, anti: 0.5, energy: 0.3 };
HOLE_STYLE.__scorch = 'scorch'; HOLE_STYLE.__scorch_big = 'scorch_big';
HOLE_SIZE.scorch = 2.4; HOLE_SIZE.scorch_big = 6;
const holeStyle = (wid) => HOLE_STYLE[wid] || 'small';
let _fireTex = null, _smokeTex = null;
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTex() { return (_glowTex ||= radialTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.75)'], [0.65, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']])); }
let _glowTex = null;
// 마법진: 겹 원 + 육망성 + 룬 점 (속성 색으로)
const circleTexs = new Map();
function circleTex(color) {
  if (circleTexs.has(color)) return circleTexs.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), R = 128;
  x.strokeStyle = color; x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 12;
  for (const [r, w] of [[120, 5], [104, 2.5], [62, 3]]) { x.lineWidth = w; x.beginPath(); x.arc(R, R, r, 0, Math.PI * 2); x.stroke(); }
  x.lineWidth = 3;
  for (const off of [0, Math.PI / 3]) { x.beginPath(); for (let i = 0; i <= 3; i++) { const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2; const px = R + Math.cos(a) * 104, py = R + Math.sin(a) * 104; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; x.beginPath(); x.arc(R + Math.cos(a) * 112, R + Math.sin(a) * 112, i % 2 ? 2.5 : 4.5, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  circleTexs.set(color, t);
  return t;
}
const circleGeo = new THREE.PlaneGeometry(1, 1);
function fireTex() { return (_fireTex ||= radialTex([[0, 'rgba(255,255,240,1)'], [0.25, 'rgba(255,230,140,0.95)'], [0.55, 'rgba(255,140,40,0.55)'], [1, 'rgba(255,60,0,0)']])); }
function smokeTex() { return (_smokeTex ||= radialTex([[0, 'rgba(90,90,90,0.9)'], [0.6, 'rgba(70,70,70,0.4)'], [1, 'rgba(60,60,60,0)']])); }
const holeGeo = new THREE.PlaneGeometry(1, 1);
const holeMats = new Map();
function holeMat(st, color) {
  const key = st === 'energy' ? st + (color || '') : st;
  let m = holeMats.get(key);
  if (m) return m;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const R = 64;
  const crack = (n, len, w) => {
    x.strokeStyle = 'rgba(40,36,32,0.85)'; x.lineWidth = w;
    for (let i = 0; i < n; i++) {
      let a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = 10, px = R + Math.cos(a) * r, py = R + Math.sin(a) * r;
      x.beginPath(); x.moveTo(px, py);
      while (r < len) { r += 5 + Math.random() * 8; a += (Math.random() - 0.5) * 0.5; px = R + Math.cos(a) * r; py = R + Math.sin(a) * r; x.lineTo(px, py); }
      x.stroke();
    }
  };
  if (st === 'scorch' || st === 'scorch_big') {
    // 불에 그을린 바닥
    const gr = x.createRadialGradient(R, R, 4, R, R, R);
    gr.addColorStop(0, 'rgba(15,10,8,0.85)'); gr.addColorStop(0.5, 'rgba(30,20,15,0.6)'); gr.addColorStop(1, 'rgba(40,30,20,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(R, R, R, 0, 7); x.fill();
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(255,${80 + Math.random() * 80},0,${0.25 + Math.random() * 0.3})`; x.beginPath(); x.arc(R + (Math.random() - 0.5) * 70, R + (Math.random() - 0.5) * 70, 1 + Math.random() * 3, 0, 7); x.fill(); }
  } else if (st === 'energy') {
    // 그을린 자국 + 빛나는 중심 (총의 빔 색)
    const gr = x.createRadialGradient(R, R, 2, R, R, R);
    gr.addColorStop(0, color || '#18ffff'); gr.addColorStop(0.18, '#ffffff'); gr.addColorStop(0.3, 'rgba(20,20,20,0.95)'); gr.addColorStop(0.65, 'rgba(30,30,30,0.6)'); gr.addColorStop(1, 'rgba(30,30,30,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(R, R, R, 0, 7); x.fill();
  } else {
    const chip = { pellet: 30, small: 34, rifle: 40, big: 46, anti: 56 }[st];
    const hole = { pellet: 12, small: 13, rifle: 15, big: 18, anti: 24 }[st];
    // 깨진 벽면(밝은 테두리) → 그을음 → 검은 구멍
    const gr = x.createRadialGradient(R, R, hole, R, R, chip);
    gr.addColorStop(0, 'rgba(60,55,50,0.9)'); gr.addColorStop(0.45, 'rgba(200,195,185,0.75)'); gr.addColorStop(1, 'rgba(200,195,185,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(R, R, chip, 0, 7); x.fill();
    crack({ pellet: 0, small: 4, rifle: 6, big: 8, anti: 12 }[st], { pellet: 0, small: 40, rifle: 50, big: 58, anti: 63 }[st], st === 'anti' ? 3 : 2);
    x.fillStyle = '#0d0b0a'; x.beginPath(); x.arc(R, R, hole, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(R + 2, R + 2, hole * 0.6, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  holeMats.set(key, m);
  return m;
}

const SABER_COL = { saber_blue: '#40c4ff', saber_red: '#ff1744', saber_green: '#76ff03' };
const TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };

const spriteCache = new Map();
function makeEmojiSprite(emoji) {
  let tex = spriteCache.get(emoji);
  if (!tex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.font = '50px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 32, 36);
    tex = new THREE.CanvasTexture(c); spriteCache.set(emoji, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.setScalar(0.6);
  return sp;
}

// 수직 원기둥과 광선의 교차 (가장 가까운 t)
function rayCylinder(o, d, base, r, h) {
  let best = null;
  const take = (t) => { if (t >= 0 && (best === null || t < best)) best = t; };
  // 옆면
  const ox = o.x - base.x, oz = o.z - base.z;
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-8) {
    const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        const y = o.y + d.y * t;
        if (y >= base.y && y <= base.y + h) take(t);
      }
    }
  }
  // 윗면·아랫면 (하늘에서 내려다보고 쏠 때 머리 위로 맞는다)
  if (Math.abs(d.y) > 1e-6) {
    for (const cy of [base.y + h, base.y]) {
      const t = (cy - o.y) / d.y;
      const x = ox + d.x * t, z = oz + d.z * t;
      if (x * x + z * z <= r * r) take(t);
    }
  }
  return best;
}

// 이번 프레임에 움직인 선분이 대상에 닿았는지 (빠른 투사체가 건너뛰지 않게)
function segHits(a, b, t, pad) {
  const d = b.clone().sub(a);
  const L = d.length();
  if (L < 1e-6) return false;
  d.divideScalar(L);
  const base = { x: t.base.x, y: t.base.y - pad, z: t.base.z };
  const hit = rayCylinder(a, d, base, t.r + pad, t.h + pad * 2);
  return hit !== null && hit <= L;
}

// 머리 판정: 사람(젤리곰·바퀴)·경찰·군인은 키의 위쪽 36%가 머리
const HEAD_TT = new Set(['npc', 'player', 'unit', 'runner']);
function isHead(t, y) { return HEAD_TT.has(t.tt) && t.h < 2.9 && y > t.base.y + t.h * 0.64 && y < t.base.y + t.h * 1.08; }
// 선분이 대상 기둥에 가장 가까워지는 곳의 높이 (화살 머리 판정용)
function closestY(a, b, base) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const k = Math.max(0, Math.min(1, ((base.x - a.x) * dx + (base.z - a.z) * dz) / L2));
  return a.y + (b.y - a.y) * k;
}

function rayBox(o, d, b) {
  let tmin = 0, tmax = Infinity;
  for (const [k, mn, mx] of [['x', b.minX, b.maxX], ['y', -1, b.h ?? 10], ['z', b.minZ, b.maxZ]]) {
    if (Math.abs(d[k]) < 1e-6) { if (o[k] < mn || o[k] > mx) return null; continue; }
    let t1 = (mn - o[k]) / d[k], t2 = (mx - o[k]) / d[k];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

// ---------------- 내 공격 ----------------
export class Combat {
  constructor(game) {
    this.g = game;
    this.fx = new FX(game.scene);
    this.cool = 0;
    this.projs = [];
    this.firing = false;
  }

  // 공격 대상 목록 (보이는 것만)
  targets() {
    const g = this.g, out = [];
    for (const c of g.sim.citizens) {
      if (!c.visible || c.mode === 'dead') continue;
      out.push({ tt: 'npc', id: c.id, base: c.roach.root.position, r: 0.55, h: c.roach.height });
    }
    for (const p of g.players.list.values()) {
      if (p.dead) continue;
      if (p.visible) out.push({ tt: 'player', id: p.id, base: p.roach.root.position, r: 0.55, h: p.roach.height });
      // 차·오토바이에 탄 플레이어: 앉은 자리에서 맞는다
      else if (p.car >= 0 && p.roach.root.visible && g.traffic.cars[p.car]?.kind !== 'tank') out.push({ tt: 'player', id: p.id, base: p.roach.root.position, r: 0.45, h: Math.max(0.6, p.roach.height * p.roach.root.scale.y * 1.6), occOf: p.car });
    }
    for (const u of g.units.list.values()) {
      if (!u.visible) continue;
      const big = u.kind === 'tank' || u.kind === 'heli';
      out.push({ tt: 'unit', id: u.id, base: u.obj.position, r: big ? 2.4 : 0.55, h: big ? 3 : 2 });
    }
    // 거대 젤리 (총알·마법은 서버가 '효과 없음', 젤리병단 칼은 뒷목 판정)
    if (g.mode === 'city' && g.titans) for (const sh of g.titans.shapes()) out.push({ tt: 'titan', id: sh.id, base: sh.base, r: sh.r, h: sh.h });
    // 차에서 뛰어내려 도망가는 시민
    if (g.mode === 'city') for (const o of g.runners?.list.values() || []) if (!o.dead) out.push({ tt: 'runner', id: o.id, base: o.r.root.position, r: 0.55, h: o.r.height });
    if (g.mode === 'city') for (const a of g.animals?.list || []) {
      if (!a.visible || !a.alive || a.gone || a.def.livestock) continue;
      out.push({ tt: 'animal', id: a.id, base: a.pos, r: a.def.r * (a.mesh?.size || 1), h: a.def.h * (a.mesh?.size || 1) });
    }
    if (g.mode === 'interior') for (const t of g.interior.targets || []) if (t.up) out.push({ tt: 'rtarget', id: t.id, base: t.obj.getWorldPosition(new THREE.Vector3()).setY(t.y0 - t.r), r: t.r, h: t.r * 2, rt: t });
    if (g.mode === 'city') for (const car of g.traffic.cars) {
      if (car === g.player.inCar || car.mode === 'wreck' || car.mode === 'gone') continue;
      if (car.pos.distanceTo(g.player.pos) > 600) continue;
      out.push({ tt: 'car', id: car.id, base: car.mesh.g.position, r: car.kind === 'bus' || car.kind === 'tank' || car.kind === 'heli' ? 2.4 : 1.6, h: 2.2 });
      // AI 차·버스·오토바이에 탄 시민 (보이는 사람만)
      if (car.mode === 'ai' && car.occ > 0) {
        const occ = car.mesh.occ || [];
        for (let i = 0; i < Math.min(car.occ, occ.length); i++) {
          if (!occ[i].visible) continue;
          const b = occ[i].getWorldPosition(new THREE.Vector3()); b.y -= 0.3;
          out.push({ tt: 'occ', id: car.id, seat: i, base: b, r: car.mesh.bike ? 0.45 : 0.4, h: 1.1, occOf: car.id });
        }
      }
    }
    return out;
  }

  // 카메라 중앙 조준선이 가리키는 곳
  aimRay() {
    const cam = this.g.camera;
    const o = cam.position.clone();
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    return { o, d };
  }

  raycast(o, d, range, skipSelf = true) {
    let best = null, bt = range;
    const occHits = [];
    for (const t of this.targets()) {
      const hit = rayCylinder(o, d, t.base, t.r, t.h);
      if (hit !== null && t.occOf !== undefined && hit < range) occHits.push([t, hit]);
      if (hit !== null && hit < bt) { bt = hit; best = t; }
    }
    // 차 겉면에 먼저 닿아도, 그 차에 탄 사람에게 닿으면 사람을 맞힌다 (창문·오토바이 너머)
    if (best?.tt === 'car') {
      const o2 = occHits.filter(([t, h]) => t.occOf === best.id && h < bt + 5).sort((a, b) => a[1] - b[1])[0];
      if (o2) { best = o2[0]; bt = o2[1]; }
    }
    // 건물·벽·땅에 막힘 → 맞은 면(normal)을 기억해 총알 자국을 남긴다
    let surf = null;
    const g = this.g;
    const boxes = g.mode === 'city' ? g.city.colliders : g.mode === 'interior' ? g.interior?.colliders || [] : [];
    for (const b of boxes) {
      if (b.small || b.broken) continue;
      const t = rayBox(o, d, b);
      if (t !== null && t < bt) { bt = t; best = null; surf = b; }
    }
    if (g.mode === 'interior' && g.interior?.bounds) {
      // 방 벽(경계보다 살짝 바깥)과 바닥
      const B = g.interior.bounds, e = 0.55;
      for (const [k, v, n] of [['x', B.minX - e, [1, 0, 0]], ['x', B.maxX + e, [-1, 0, 0]], ['z', B.minZ - e, [0, 0, 1]], ['z', B.maxZ + e, [0, 0, -1]], ['y', 0.1, [0, 1, 0]]]) {
        if (Math.abs(d[k]) < 1e-6) continue;
        const t = (v - o[k]) / d[k];
        if (t > 0 && t < bt) { bt = t; best = null; surf = n; }
      }
    } else if (g.mode === 'city' && d.y < -1e-4) {
      // 땅: 지형 높이를 따라 몇 번 보정
      let t = (g.city.groundY(o.x, o.z) - o.y) / d.y;
      for (let i = 0; i < 4 && t > 0; i++) { const px = o.x + d.x * t, pz = o.z + d.z * t; t = (g.city.groundY(px, pz, o.y + d.y * t + 1) - o.y) / d.y; }
      if (t > 0 && t < bt) { bt = t; best = null; surf = [0, 1, 0]; }
    }
    void skipSelf;
    const point = o.clone().addScaledVector(d, bt);
    let normal = null;
    if (surf && !Array.isArray(surf)) {
      // 상자: 가장 가까운 면
      const b = surf, h = b.h ?? 10;
      const c = [[Math.abs(point.x - b.minX), [-1, 0, 0]], [Math.abs(point.x - b.maxX), [1, 0, 0]], [Math.abs(point.z - b.minZ), [0, 0, -1]], [Math.abs(point.z - b.maxZ), [0, 0, 1]], [Math.abs(point.y - h), [0, 1, 0]]];
      normal = c.reduce((a, x) => (x[0] < a[0] ? x : a))[1];
    } else if (surf) normal = surf;
    return { target: best, t: bt, point, normal };
  }

  handPos() {
    const p = this.g.player;
    p.roach.root.updateMatrixWorld(true);
    return p.roach.hand.getWorldPosition(new THREE.Vector3());
  }

  selectedWeapon() {
    const it = this.g.inv.selected();
    if (!it) return { id: 'fist', gems: [] };
    const d = itemDef(it.id);
    if (['melee', 'gun', 'throw', 'launcher', 'wand'].includes(d.cat)) return { id: it.id, gems: it.gems || [], item: it };
    return null;
  }

  // 마우스 누름
  trigger(down) {
    const w = this.selectedWeapon();
    const d = w ? itemDef(w.id) : null;
    // 활: 누르고 있으면 시위를 당기고, 놓으면 쏜다
    if (d && d.kind === 'arrow' && !d.auto && !d.instant && !this.g.player.inCar) {
      if (down && !this.drawing && this.cool <= 0) this.drawing = { t: 0 };
      else if (!down && this.drawing) { const k = Math.min(1, this.drawing.t / 1.1); this.drawing = null; this.g.player.roach.drawK = 0; this.drawPower = k; this.tryFire(); this.drawPower = null; }
      return;
    }
    this.drawing = null;
    this.firing = down;
    if (down) this.tryFire();
  }
  // 상대 피해 보정 (활 당긴 정도 등)
  sendHit(t, w, extra = {}) {
    if (t.tt === 'rtarget') { this.g.hitRangeTarget?.(t.rt, extra.point); return; }
    // 거대 젤리: 젤리병단 장비가 아니면 맞아도 튕겨 나간다 (맞았는지 빗나갔는지 알 수 있게 불꽃 · 문구)
    const blocked = t.tt === 'titan' && !itemDef(w.id).odm;
    this.g.ui.hitMarker(blocked);
    if (blocked) {
      const at = (extra.point || t.point)?.clone?.() || t.base.clone().setY(t.base.y + t.h * 0.5);
      for (let i = 0; i < 10; i++) this.fx.part(at, new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8), Math.random() < 0.5 ? '#ffe082' : '#ffffff', 0.35, 0.3, 0, { grav: 12 });
      if (performance.now() - (this.blockMsgT || 0) > 900) { this.blockMsgT = performance.now(); this.g.ui.floatText(at, '🛡️ 효과 없음 · 젤리병단 장비로 뒷목을!', '#ffab40'); }
    }
    const { point, ...rest } = extra;
    void point;
    this.g.net.send({ t: 'hit', tt: t.tt, id: t.id, w: w.id, gems: w.gems, ...rest });
  }

  update(dt) {
    this.cool -= dt;
    this.fbCool = (this.fbCool || 0) - dt;
    if (this.drawing) {
      this.drawing.t += dt;
      this.g.player.roach.drawK = Math.min(1, this.drawing.t / 1.1);
      this.g.ui.drawMeter(Math.min(1, this.drawing.t / 1.1));
    } else this.g.ui.drawMeter(null);
    if (this.firing) {
      const w = this.selectedWeapon();
      const car = this.g.player.inCar;
      // 연사 총·근접무기(주먹 포함)는 누르고 있으면 계속
      if ((w && (itemDef(w.id).auto || itemDef(w.id).kind === 'melee')) || (car && car.kind === 'heli') || this.g.player.mount?.ride.fly) this.tryFire();
    }
    this.updateProjs(dt);
    this.fx.update(dt);
  }

  tryFire() {
    if (this.cool > 0 || this.g.busy || this.g.dead) return;
    this.g.stopEmote?.(); // 공격하면 춤은 멈춘다
    const g = this.g;
    const car = g.player.inCar;
    if (car) {
      if (car.kind === 'tank' || car.kind === 'heli') this.vehicleFire(car);
      return;
    }
    // 드래곤을 타고 있으면 왼쪽 클릭 = 불 뿜기
    if (g.player.mount?.ride.fly) return this.dragonBreath(g.player.mount);
    const w = this.selectedWeapon();
    if (!w) return;
    const s = weaponStats(w.id, w.gems);
    // 총과 활은 탄약이 있어야 쏠 수 있다
    if (s.ammo && !g.range) {
      if (g.inv.count(s.ammo) <= 0) {
        this.cool = 0.4;
        if (performance.now() - (this.noAmmoMsg || 0) > 2500) {
          this.noAmmoMsg = performance.now();
          const a = ITEMS[s.ammo];
          g.ui.toast(`${s.ammo === 'arrow' ? '🏹 화살이' : '🔫 총알이'} 없어요! ${SHOPS[a.shop]?.title || '상점'}에서 ${ammoName(s.ammo)}을(를) 사세요 (₩${a.price}/${a.pack}발)`);
        }
        return;
      }
      g.inv.consumeId(s.ammo, 1);
    }
    this.cool = s.rate;
    const p = g.player;
    // 공격 방향으로 몸 돌리기
    const { o, d } = this.aimRay();
    p.heading = Math.atan2(d.x, d.z);
    p.roach.root.rotation.y = p.heading;
    // 반동: 연사할수록 총구가 위로 솟고 좌우로 흔들린다 (조준하면 조금 덜)
    if (s.recoil) {
      const [up, side, shake] = s.recoil;
      const k = 1 - 0.35 * (p.aim || 0);
      const climb = 1 + Math.min(1.5, (this.burst = (performance.now() - (this.lastShot || 0) < 250 ? (this.burst || 0) + 1 : 0)) * 0.08);
      this.lastShot = performance.now();
      const dy = up * k * climb, dx = (Math.random() - 0.5) * 2 * side * k;
      p.cam.pitch -= dy; p.cam.yaw += dx;
      p.recoilBack = (p.recoilBack || 0) + dy * 0.6; // 일부는 천천히 돌아온다
      if (shake) g.shake(shake * k);
      p.roach.kick = Math.min(1, (p.roach.kick || 0) + up * 8);
    }
    // 내 무기 소리
    const snd = { melee: 'swing', hitscan: 'gun', grenade: 'throw', arrow: 'bow', rocket: w.id === 'ion_cannon' ? 'ion' : 'rocket' }[s.kind];
    if (snd) sfx(snd, null, w.id);
    if (s.kind === 'melee') return this.melee(w, s);
    if (s.kind === 'hitscan') return this.shoot(w, s, o, d);
    if (s.kind === 'grenade') return this.throwGrenade(w, s, d);
    if (s.kind === 'rocket') return this.fireRocket(w, s, o, d);
    if (s.kind === 'arrow') return this.shootArrow(w, s, o, d);
    if (s.kind === 'magic') return this.castMagic(w, s, o, d);
  }

  // ---------------- 마법 ----------------
  castMagic(w, s, o, d) {
    const g = this.g, p = g.player;
    if ((g.mana ?? 0) < s.mana) { this.cool = 0.3; g.ui.toast('💧 마나가 부족해요! 잠시 기다리거나 마나 물약을 마셔요'); return; }
    g.mana -= s.mana;
    sfx('magic', null, w.id);
    g.questEvent?.('magic');
    p.roach.cast();
    const color = ELEMENT_COLOR[s.element];
    const hand = this.handPos();
    const el = s.element;
    this.fx.castFx(p.pos, hand, color);
    if (el === 'holy') {
      this.fx.holyFx(p.pos.clone());
      g.net.send({ t: 'fx', k: 'holyfx', p: [p.pos.x, p.pos.y, p.pos.z] });
      g.net.send({ t: 'holy', w: w.id });
      return;
    }
    if (el === 'wind') {
      const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
      this.fx.gust(p.pos.clone().addScaledVector(fwd, 1.2), fwd);
      g.net.send({ t: 'fx', k: 'gust', p: [p.pos.x + fwd.x * 1.2, p.pos.y, p.pos.z + fwd.z * 1.2], d: [fwd.x, 0, fwd.z] });
      let n = 0;
      for (const t of this.targets()) {
        if (t.tt === 'car') continue;
        tmpV.subVectors(t.base, p.pos); tmpV.y = 0;
        const dist = tmpV.length();
        if (dist > s.range || dist < 0.01 || tmpV.normalize().dot(fwd) < 0.5) continue;
        this.sendHit(t, w);
        if (++n >= 5) break;
      }
      return;
    }
    if (el === 'thunder') {
      const r = this.raycast(o, d, s.range + o.distanceTo(hand));
      this.fx.bolt(hand, r.point, color);
      g.net.send({ t: 'fx', k: 'bolt', a: [hand.x, hand.y, hand.z], b: [r.point.x, r.point.y, r.point.z], c: color });
      if (!r.target) return;
      this.sendHit(r.target, w, { point: r.point });
      // 주변 2명에게 연쇄
      let from = r.target.base.clone().setY(r.target.base.y + 1);
      const hitIds = new Set([r.target.tt + r.target.id]);
      for (let i = 0; i < 2; i++) {
        let best = null, bd = 7;
        for (const t of this.targets()) {
          if (t.tt === 'car' || hitIds.has(t.tt + t.id)) continue;
          const dd = t.base.distanceTo(from);
          if (dd < bd) { bd = dd; best = t; }
        }
        if (!best) break;
        hitIds.add(best.tt + best.id);
        const to = best.base.clone().setY(best.base.y + 1);
        this.fx.bolt(from, to, color);
        g.net.send({ t: 'fx', k: 'bolt', a: [from.x, from.y, from.z], b: [to.x, to.y, to.z], c: color });
        this.sendHit(best, w);
        from = to;
      }
      return;
    }
    // 투사체 마법 (화염구, 얼음 화살, 독구름, 암흑구)
    const r = this.raycast(o, d, s.range + 10);
    const start = hand.clone().addScaledVector(d, 0.6);
    const speed = { fire: 34, ice: 46, poison: 30, dark: 16 }[el] || 30;
    const v = r.point.clone().sub(start).normalize().multiplyScalar(speed);
    const type = 'm_' + el;
    this.spawnProj(type, start, v, w, true, r.target);
    g.net.send({ t: 'fx', k: 'proj', type, p: [start.x, start.y, start.z], v: [v.x, v.y, v.z], w: w.id });
  }

  melee(w, s) {
    const g = this.g, p = g.player;
    p.roach.attack('melee');
    this.fx.slash(p.pos, p.heading, w.id);
    if (p.fp && !p.inCar) this.fx.fpSlash(g.camera, w.id); // 1인칭이면 눈앞에도
    g.net.send({ t: 'fx', k: 'swing', w: w.id });
    const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    let n = 0;
    for (const t of this.targets()) {
      if (t.tt === 'car') continue;
      tmpV.subVectors(t.base, p.pos); tmpV.y = 0;
      const dist = tmpV.length();
      if (dist > s.range + t.r || dist < 0.01) continue;
      if (tmpV.normalize().dot(fwd) < 0.45) continue;
      this.sendHit(t, w);
      if (++n >= 3) break;
    }
  }

  shoot(w, s, o, d) {
    const g = this.g;
    g.player.roach.attack('shoot');
    const hand = this.handPos();
    const pellets = s.pellets || 1;
    const hits = new Map();
    // 명중률: 레벨이 높을수록, 조준(우클릭) 중일수록 덜 퍼진다
    const acc = levelStats(g.stats?.level || 1).acc * (1 - 0.7 * (g.player.aim || 0));
    const base = (BASE_SPREAD[w.id] || 0.02) * acc;
    for (let i = 0; i < pellets; i++) {
      const dd = d.clone();
      const sp = pellets > 1 ? s.spread * Math.max(0.5, acc) : base;
      dd.x += (Math.random() - 0.5) * sp * 2; dd.y += (Math.random() - 0.5) * sp * 2; dd.z += (Math.random() - 0.5) * sp * 2; dd.normalize();
      const camDist = o.distanceTo(hand);
      const r = this.raycast(o, dd, s.range + camDist);
      this.fx.tracer(hand, r.point, s.tracer || '#fff59d', w.id === 'sniper' ? 1.5 : 1);
      if (r.normal && !r.target) this.fx.hole(r.point, r.normal, w.id, s.tracer);
      if (i === 0 || r.normal) g.net.send({ t: 'fx', k: 'tracer', a: [hand.x, hand.y, hand.z], b: [r.point.x, r.point.y, r.point.z], c: s.tracer, n: !r.target && r.normal ? r.normal : undefined, w: w.id });
      if (r.target) { const k = r.target.tt + r.target.id; const prev = hits.get(k); hits.set(k, { ...r.target, n: (prev?.n || 0) + 1, point: r.point, hs: prev?.hs || isHead(r.target, r.point.y) }); }
    }
    for (const h of hits.values()) {
      if (h.hs) g.ui.floatText(h.point.clone(), '💥 헤드샷!', '#ff1744');
      this.sendHit(h, w, h.tt === 'rtarget' ? { point: h.point } : { n: h.n, hs: h.hs ? 1 : 0 });
    }
  }

  // 드래곤 타고 왼쪽 클릭(누르고 있으면 계속): 화염방사. 0.3초마다 앞쪽 원뿔 안을 태운다
  dragonBreath(mt) {
    const g = this.g, p = g.player;
    sfx('breath');
    if (performance.now() - (this.roarT || 0) > 3500) { this.roarT = performance.now(); sfx('beast', null, { kind: mt.kind, type: 'attack' }, 0.7); }
    const wid = mt.kind === 'dragon' ? 'dragon_fire' : 'baby_dragon_fire';
    const s = weaponStats(wid, []);
    this.cool = s.rate;
    const aim = () => this.aimRay().d;
    const d = aim();
    p.heading = Math.atan2(d.x, d.z);
    const from = mouthPos(mt) || p.pos.clone().setY(p.pos.y + 2);
    const until = performance.now() + 380;
    if (this.riderFlame && this.riderFlame.t > 0) this.riderFlame.until = until;
    else this.riderFlame = this.fx.emitter({ from: () => (g.player.mount === mt ? mouthPos(mt) : null), dir: aim, len: s.range, power: mt.kind === 'dragon' ? 1.2 : 0.75, until });
    p.breathT = 0.5;
    g.shake?.(0.12);
    g.net.send({ t: 'fx', k: 'breath', p: [from.x, from.y, from.z], d: [d.x, d.y, d.z], r: s.range, dur: 0.4 });
    let n = 0;
    for (const t of this.targets()) {
      const c = new THREE.Vector3(t.base.x, t.base.y + t.h / 2, t.base.z).sub(from);
      const L = c.length();
      if (L > s.range + t.r || c.normalize().dot(d) < 0.8) continue;
      this.sendHit(t, { id: wid, gems: [] });
      if (++n >= 8) break;
    }
  }
  // 드래곤 타고 오른쪽 클릭: 불덩이 (터지면 넓게 불바다)
  dragonFireball(mt) {
    sfx('rocket'); sfx('beast', null, { kind: mt.kind, type: 'attack' }, 0.7);
    const g = this.g;
    if ((this.fbCool || 0) > 0) return;
    const wid = mt.kind === 'dragon' ? 'dragon_fireball' : 'baby_fireball';
    this.fbCool = mt.kind === 'dragon' ? 2.2 : 1.6;
    const d = this.aimRay().d;
    g.player.heading = Math.atan2(d.x, d.z);
    const from = (mouthPos(mt) || g.player.pos.clone().setY(g.player.pos.y + 2)).addScaledVector(d, 1.5);
    const v = d.clone().multiplyScalar(48);
    this.spawnProj('rocket', from, v, { id: wid, gems: [] }, true);
    g.net.send({ t: 'fx', k: 'proj', type: 'rocket', p: [from.x, from.y, from.z], v: [v.x, v.y, v.z], w: wid });
    this.fx.breath(from, d, 4, 0.15);
    g.shake?.(0.35);
  }

  throwGrenade(w, s, d) {
    const g = this.g;
    if (!g.inv.consume(w.item.uid)) return;
    g.player.roach.attack('throw');
    const start = this.handPos();
    const v = d.clone().multiplyScalar(15); v.y += 6;
    this.spawnProj('grenade', start, v, w, true);
    g.net.send({ t: 'fx', k: 'proj', type: 'grenade', p: [start.x, start.y, start.z], v: [v.x, v.y, v.z], w: w.id });
  }

  fireRocket(w, s, o, d) {
    const g = this.g;
    g.player.roach.attack('shoot');
    const start = this.handPos().addScaledVector(d, 1.0);
    // 조준점으로 향하도록
    const r = this.raycast(o, d, s.range + 10);
    const dir = r.point.clone().sub(start).normalize();
    const v = dir.multiplyScalar(w.id === 'ion_cannon' ? 55 : 40);
    this.spawnProj(w.id === 'ion_cannon' ? 'ion' : 'rocket', start, v, w, true);
    g.net.send({ t: 'fx', k: 'proj', type: w.id === 'ion_cannon' ? 'ion' : 'rocket', p: [start.x, start.y, start.z], v: [v.x, v.y, v.z], w: w.id });
  }

  shootArrow(w, s, o, d) {
    const g = this.g;
    g.player.roach.attack('shoot');
    const start = this.handPos().addScaledVector(d, 0.6);
    const r = this.raycast(o, d, s.range + 10);
    // 덜 당기면 힘없이 앞에 떨어지고, 끝까지 당기면 빠르고 거의 곧게 멀리 날아간다 (쇠뇌는 더 빠르게)
    const k = this.drawPower ?? 1;
    const xbow = w.id === 'crossbow' || w.id === 'zhuge_crossbow';
    const speed = (xbow ? 25 : 15) + 70 * k;
    const grav = k > 0.85 ? 3.5 : 3.5 + (0.85 - k) * 16;
    const v = r.point.clone().sub(start).normalize().multiplyScalar(speed);
    // 조준점까지 떨어지는 만큼 살짝 위로 (끝까지 당기면 조준한 곳에 꽂힌다)
    const T = r.point.distanceTo(start) / speed;
    v.y += 0.5 * grav * T * (k > 0.85 ? 1 : 0.4);
    w = { ...w, pw: 0.25 + 0.95 * k };
    this.spawnProj('arrow', start, v, w, true).grav = grav;
    g.net.send({ t: 'fx', k: 'proj', type: 'arrow', p: [start.x, start.y, start.z], v: [v.x, v.y, v.z], w: w.id, g: grav });
  }

  vehicleFire(car) {
    sfx(car.kind === 'heli' ? 'rocket' : 'cannon');
    const g = this.g;
    this.cool = car.kind === 'tank' ? 2.2 : 0.8;
    const { o, d } = this.aimRay();
    const r = this.raycast(o, d, 200);
    const start = car.pos.clone();
    if (car.kind === 'tank') {
      const yaw = car.heading + (car.turret || 0);
      start.add(new THREE.Vector3(Math.sin(yaw) * 3.8, 2.0, Math.cos(yaw) * 3.8));
    } else start.add(new THREE.Vector3(Math.sin(car.heading) * 2.5, 0.8, Math.cos(car.heading) * 2.5));
    const v = r.point.clone().sub(start).normalize().multiplyScalar(60);
    this.spawnProj('shell', start, v, { id: 'rpg', gems: [], vehicle: car.kind }, true);
    g.net.send({ t: 'fx', k: 'proj', type: 'shell', p: [start.x, start.y, start.z], v: [v.x, v.y, v.z] });
  }

  // 투사체 (내 것이면 폭발 시 서버에 알림)
  spawnProj(type, start, v, w, mine, homing = null) {
    const color = type.startsWith('m_') ? ELEMENT_COLOR[type.slice(2)] : type === 'grenade' ? '#558b2f' : type === 'ion' ? '#18ffff' : type === 'shell' ? '#ffab00' : '#ff7043';
    let m;
    if (type.startsWith('m_')) {
      // 마법 구슬: 빛나는 심 + 속성색 후광 + 속성별 모양 (불꽃 · 얼음 결정 · 독방울 · 암흑 고리)
      const el = type.slice(2);
      m = new THREE.Group();
      const add = (mat, sc) => { const sp = new THREE.Sprite(mat); sp.scale.setScalar(sc); m.add(sp); return sp; };
      add(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), el === 'dark' ? 0.4 : 0.6);
      add(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), el === 'dark' ? 2.2 : 1.5);
      if (el === 'fire') m.userData.flame = add(new THREE.SpriteMaterial({ map: fireTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 1.2);
      else if (el === 'ice') { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#e1f5fe', transparent: true, opacity: 0.9 })); cr.scale.set(0.16, 0.5, 0.16); m.add(cr); m.userData.crystal = cr; }
      else if (el === 'poison') m.userData.bubbles = [0, 1, 2].map(() => { const b = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color: '#c5e1a5', transparent: true, opacity: 0.85 })); b.scale.setScalar(0.12); m.add(b); return b; });
      else if (el === 'dark') { const core = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color: '#0d0018' })); core.scale.setScalar(0.3); m.add(core); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: '#b388ff', transparent: true, blending: THREE.AdditiveBlending })); m.add(rg); m.userData.halo = rg; }
      m.position.copy(start);
      this.g.scene.add(m);
      const pr = { type, pos: start.clone(), v: v.clone(), m, w, mine, t: 0, loc: this.g.loc(), traveled: 0, homing, color };
      this.projs.push(pr);
      return pr;
    }
    if (type === 'arrow') {
      m = new THREE.Group();
      const shaft = new THREE.Mesh(G.cylLow(), new THREE.MeshBasicMaterial({ color: '#8d6e63' })); shaft.scale.set(0.025, 0.9, 0.025); m.add(shaft);
      const tip = new THREE.Mesh(G.cone(), new THREE.MeshBasicMaterial({ color: '#cfd8dc' })); tip.scale.set(0.06, 0.15, 0.06); tip.position.y = 0.5; m.add(tip);
      const fl = new THREE.Mesh(G.box(), new THREE.MeshBasicMaterial({ color: '#ffffff' })); fl.scale.set(0.12, 0.15, 0.01); fl.position.y = -0.4; m.add(fl);
    } else if (/fireball/.test(w?.id || '')) {
      // 드래곤 불덩이: 이글거리는 큰 불구슬
      m = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex(), color: '#ffe082', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.scale.setScalar(w.id === 'dragon_fireball' || w.id === 'wild_fireball' ? 3 : 1.8);
    } else {
      m = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color }));
      m.scale.setScalar(type === 'grenade' ? 0.15 : 0.22);
    }
    m.position.copy(start);
    this.g.scene.add(m);
    const pr = { type, pos: start.clone(), v: v.clone(), m, w, mine, t: 0, loc: this.g.loc(), traveled: 0 };
    this.projs.push(pr);
    return pr;
  }

  updateProjs(dt) {
    const g = this.g;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.t += dt;
      let boom = false;
      const ground = g.mode === 'city' ? g.city.groundY(pr.pos.x, pr.pos.z) : 0.1;
      if (pr.type.startsWith('m_')) {
        // 암흑구는 조준한 대상을 따라간다
        if (pr.homing && pr.type === 'm_dark') {
          const want = pr.homing.base.clone().setY(pr.homing.base.y + 1).sub(pr.pos).normalize().multiplyScalar(pr.v.length());
          pr.v.lerp(want, Math.min(1, dt * 2.5));
        }
        const step = pr.v.clone().multiplyScalar(dt);
        const prev = pr.pos.clone();
        pr.pos.add(step); pr.traveled += step.length();
        pr.m.position.copy(pr.pos);
        const U = pr.m.userData;
        this.fx.trail(pr.type.slice(2), pr.pos, pr.v, dt);
        if (U.flame) U.flame.scale.setScalar(1.1 + Math.random() * 0.4);
        if (U.crystal) { U.crystal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pr.v.clone().normalize()); U.crystal.rotateY(pr.t * 12); }
        if (U.bubbles) U.bubbles.forEach((b, j) => { const a = pr.t * 9 + j * 2.1; b.position.set(Math.cos(a) * 0.32, Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.32); });
        if (U.halo) { U.halo.rotation.x += dt * 7; U.halo.rotation.y += dt * 5; }
        let hit = null, stop = pr.pos.y <= ground + 0.1 || pr.traveled > (pr.w.id ? (itemDef(pr.w.id).range || 60) + 10 : 70);
        if (!stop && g.mode === 'city') for (const b of g.city.colliders) {
          if (!b.small && pr.pos.x > b.minX && pr.pos.x < b.maxX && pr.pos.z > b.minZ && pr.pos.z < b.maxZ && pr.pos.y < (b.h ?? 10)) { stop = true; break; }
        }
        if (!stop && pr.t > 0.05) for (const t of this.targets()) {
          if (t.tt === 'car') continue;
          if (segHits(prev, pr.pos, t, 0.35)) { hit = t; stop = true; break; }
        }
        if (stop) {
          g.scene.remove(pr.m);
          this.projs.splice(i, 1);
          const el = pr.type.slice(2);
          this.fx.elementBurst(pr.pos.clone(), el);
          if (el === 'fire' || el === 'dark') {
            if (pr.mine) {
              if (hit?.tt === 'rtarget') this.sendHit(hit, pr.w, { point: pr.pos.clone() });
              g.net.send({ t: 'explode', x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, loc: pr.loc, w: pr.w.id, gems: pr.w.gems });
            } else this.fx.boom(pr.pos, el === 'dark' ? 2.5 : 3.5, true);
          } else {
            if (pr.mine && hit) this.sendHit(hit, pr.w, { point: pr.pos.clone() });
          }
        }
        continue;
      }
      if (pr.type === 'arrow') {
        pr.v.y -= (pr.grav ?? (pr.w.pw && pr.w.pw < 0.6 ? 14 : 6)) * dt;
        const step = pr.v.clone().multiplyScalar(dt);
        const prev = pr.pos.clone();
        pr.pos.add(step); pr.traveled += step.length();
        pr.m.position.copy(pr.pos);
        pr.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pr.v.clone().normalize());
        let stop = pr.pos.y <= ground + 0.05 || pr.traveled > Math.max(130, (itemDef(pr.w.id).range || 130) * 1.1);
        if (!stop && g.mode === 'city') for (const b of g.city.colliders) {
          if (!b.small && pr.pos.x > b.minX && pr.pos.x < b.maxX && pr.pos.z > b.minZ && pr.pos.z < b.maxZ && pr.pos.y < (b.h ?? 10)) { stop = true; break; }
        }
        if (!stop && pr.mine && pr.t > 0.03) for (const t of this.targets()) {
          if (t.tt === 'car') continue;
          if (segHits(prev, pr.pos, t, 0.25)) {
            const hy = closestY(prev, pr.pos, t.base), hs = pr.type === 'arrow' && isHead(t, hy);
            if (hs) g.ui.floatText(pr.pos.clone(), '💥 헤드샷!', '#ff1744');
            this.sendHit(t, pr.w, t.tt === 'rtarget' ? { point: pr.pos.clone() } : { pw: pr.w.pw, hs: hs ? 1 : 0 });
            stop = true; pr.hitTarget = true; break;
          }
        }
        if (stop) {
          this.projs.splice(i, 1);
          // 벽이나 땅에 꽂힌 화살은 잠시 남는다
          if (pr.hitTarget) g.scene.remove(pr.m);
          else setTimeout(() => g.scene.remove(pr.m), 8000);
        }
        continue;
      }
      if (pr.type === 'grenade') {
        pr.v.y -= 20 * dt;
        pr.pos.addScaledVector(pr.v, dt);
        if (pr.pos.y < ground + 0.15) { pr.pos.y = ground + 0.15; pr.v.y *= -0.4; pr.v.x *= 0.6; pr.v.z *= 0.6; }
        if (pr.t > 2.2) boom = true;
      } else {
        const step = pr.v.clone().multiplyScalar(dt);
        pr.pos.add(step); pr.traveled += step.length();
        if (pr.pos.y <= ground + 0.1 || pr.traveled > Math.max(160, pr.w.id ? (itemDef(pr.w.id).range || 160) : 200)) boom = true;
        if (!boom && g.mode === 'city') for (const b of g.city.colliders) {
          if (!b.small && pr.pos.x > b.minX && pr.pos.x < b.maxX && pr.pos.z > b.minZ && pr.pos.z < b.maxZ && pr.pos.y < (b.h ?? 10)) { boom = true; break; }
        }
        if (!boom && pr.mine) for (const t of this.targets()) {
          if (pr.t < 0.08) break;
          const dx = pr.pos.x - t.base.x, dz = pr.pos.z - t.base.z;
          if (Math.hypot(dx, dz) < t.r + 0.4 && pr.pos.y > t.base.y - 0.3 && pr.pos.y < t.base.y + t.h + 0.3) { boom = true; break; }
        }
        // 불덩이는 불꼬리, 로켓은 연기 꼬리
        if (/fireball/.test(pr.w?.id || '')) {
          const back = pr.v.clone().normalize().multiplyScalar(-4);
          for (let n = 0; n < 2; n++) this.fx.flame(pr.pos.clone(), back.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)), 0.45, 0.8, 1.8, false);
        } else if (Math.random() < 0.5) {
          const s = new THREE.Mesh(G.sphereLow(), new THREE.MeshBasicMaterial({ color: '#bdbdbd', transparent: true, opacity: 0.5, depthWrite: false }));
          s.position.copy(pr.pos); s.scale.setScalar(0.25);
          g.scene.add(s);
          this.fx.items.push({ m: s, t: 0.5, life: 0.5, kind: 'smoke' });
        }
      }
      pr.m.position.copy(pr.pos);
      if (boom) {
        g.scene.remove(pr.m);
        this.projs.splice(i, 1);
        if (pr.mine) g.net.send({ t: 'explode', x: pr.pos.x, y: pr.pos.y, z: pr.pos.z, loc: pr.loc, w: pr.w.id, gems: pr.w.gems, vehicle: pr.w.vehicle });
        else this.fx.boom(pr.pos, 4);
      }
    }
  }

  // 화상 입은 대상에 불꽃 (나·다른 플레이어·시민)
  // 다른 플레이어가 마법을 쓰면 그 발밑에도 마법진 (연쇄 번개처럼 한 번에 여러 개 와도 한 번만)
  remoteCast(pid, color) {
    const pl = this.g.players.list.get(pid);
    if (!pl?.visible || performance.now() - (pl.castFxT || 0) < 400) return;
    pl.castFxT = performance.now();
    pl.roach.cast?.();
    this.fx.castFx(pl.pos.clone(), pl.pos.clone().setY(pl.pos.y + 1.3), color);
  }

  // 다른 사람·경찰·동물이 낸 연출에 맞는 소리
  remoteSound(m, v3) {
    const at = (a) => (Array.isArray(a) ? v3(a) : null);
    const pp = () => this.g.players.list.get(m.pid)?.pos || null;
    if (m.k === 'tracer') {
      // 산탄총은 알갱이마다 궤적이 와서, 같은 사람의 같은 총은 한 번만
      const key = `${m.pid}|${m.w}`, now = performance.now();
      if (now - (this.lastTr?.[key] || 0) < 45) return;
      (this.lastTr ||= {})[key] = now;
      if (typeof m.w === 'string') sfx('gun', at(m.a), m.w);
      else if (typeof m.w === 'number') sfx('cannon', at(m.a)); // 전차·헬기
      else sfx('gun', at(m.a), m.c === '#fff59d' ? 'rifle' : 'pistol'); // 경찰·군인
    }
    else if (m.k === 'proj') {
      const p = at(m.p);
      if (m.w === 'dragon_fireball' || m.w === 'baby_fireball') { sfx('rocket', p); sfx('beast', p, { kind: m.w === 'dragon_fireball' ? 'dragon' : 'baby_dragon', type: 'attack' }); }
      else sfx({ ion: 'ion', grenade: 'throw', arrow: 'bow', shell: 'cannon' }[m.type] || 'rocket', p);
    }
    else if (m.k === 'swing') sfx('swing', pp(), m.w);
    else if (m.k === 'bolt') sfx('magic', at(m.a), 'wand_thunder');
    else if (m.k === 'sparkle') sfx('magic', at(m.p), 'wand_holy');
    else if (m.k === 'cloud' || m.k === 'gust') sfx('magic', at(m.p), 'wand_wind');
    else if (m.k === 'holyfx') sfx('magic', at(m.p), 'wand_holy');
    else if (m.k === 'breath') sfx('breath', at(m.p));
    else if (m.k === 'boom') sfx('boom', at(m.p), !m.small && (m.r || 5) >= 4);
    else if (m.k === 'dball') { sfx('rocket', at(m.p)); sfx('beast', at(m.p), { kind: 'dragon', type: 'attack' }); }
    else if (m.k === 'horn') sfx('horn', at(m.p), m.big ? 'big' : null);
    else if (m.k === 'carhit') sfx('crash', at(m.p), 0.8);
  }

  burnFx(m) {
    const g = this.g;
    let r = null;
    if (m.pid !== undefined) r = m.pid === g.myId ? g.player.roach : g.players.list.get(m.pid)?.roach;
    else if (m.nid !== undefined) r = g.sim.citizens[m.nid]?.roach;
    if (!r) return;
    const until = performance.now() + Math.min(6, +m.s || 3) * 1000;
    this.fx.burning(() => (performance.now() < until && r.root.visible && r.root.parent ? r.root.getWorldPosition(new THREE.Vector3()).setY(r.root.position.y + r.height * 0.4) : null), Math.min(6, +m.s || 3));
  }

  // 다른 플레이어의 연출
  remoteFx(m) {
    const g = this.g;
    if (m.loc !== undefined && m.loc !== g.loc()) return;
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    this.remoteSound(m, v3);
    if (m.k === 'tracer') {
      this.fx.tracer(v3(m.a), v3(m.b), m.c || '#fff59d', typeof m.w === 'number' ? m.w : 1);
      if (Array.isArray(m.n) && typeof m.w === 'string') this.fx.hole(v3(m.b), m.n.map(Number), m.w, m.c);
    }
    else if (m.k === 'boom') { this.fx.boom(v3(m.p), m.r || 5, m.small); if (!m.small && g.player) g.shake(Math.max(0, 1 - g.player.pos.distanceTo(v3(m.p)) / 40)); }
    else if (m.k === 'proj') { const pr = this.spawnProj(m.type, v3(m.p), v3(m.v), { id: m.w }, false); if (pr && +m.g) pr.grav = +m.g; if (String(m.type).startsWith('m_')) this.remoteCast(m.pid, ELEMENT_COLOR[m.type.slice(2)]); }
    else if (m.k === 'bolt') { this.fx.bolt(v3(m.a), v3(m.b), m.c); this.remoteCast(m.pid, m.c || '#ffee58'); }
    else if (m.k === 'breath' && Array.isArray(m.p) && Array.isArray(m.d)) this.fx.breath(v3(m.p), v3(m.d), Math.min(20, +m.r || 14), Math.min(1, +m.dur || 0.45));
    else if (m.k === 'burn') this.burnFx(m);
    else if (m.k === 'dball' && Array.isArray(m.p) && Array.isArray(m.b)) {
      // 야생 드래곤 불덩이: 날아가는 모습만 (피해는 서버가)
      const a = v3(m.p), b = v3(m.b), t = Math.max(0.3, +m.t || 1);
      this.spawnProj('rocket', a, b.clone().sub(a).divideScalar(t), { id: 'wild_fireball' }, false);
    }
    else if (m.k === 'scream' && Array.isArray(m.p)) {
      // 총 맞은 사람 비명: 멀수록 작게, 왼쪽·오른쪽은 화면 기준으로
      const cam = g.camera, rel = v3(m.p).sub(cam.position);
      const vol = Math.max(0, 1 - rel.length() / 70) ** 1.5;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      scream(vol, rel.length() > 1 ? rel.normalize().dot(right) * 0.8 : 0, +m.s || Math.random());
    }
    else if (m.k === 'emote') { const pl = g.players.list.get(m.pid); pl?.roach.playEmote(g.isEmote?.(m.id) ? m.id : null); if (!m.id && g.mutedDancer === m.pid) g.mutedDancer = null; }
    else if (m.k === 'emotesync' && g.isEmote?.(m.id) && Number.isFinite(+m.pos)) { const pl = g.players.list.get(m.pid); if (pl && pl.roach.emote?.id !== m.id) pl.roach.playEmote(m.id); g.onEmoteSync?.(m.pid, m.id, +m.pos); }
    else if (m.k === 'sparkle') this.fx.sparkle(v3(m.p), m.c || '#fff59d', 20, 3);
    else if (m.k === 'cloud') this.fx.cloud(v3(m.p), m.c || '#e8f5e9');
    else if (m.k === 'gust' && Array.isArray(m.p) && Array.isArray(m.d)) { this.fx.gust(v3(m.p), v3(m.d)); this.remoteCast(m.pid, '#a5d6a7'); }
    else if (m.k === 'holyfx' && Array.isArray(m.p)) { this.fx.holyFx(v3(m.p)); this.remoteCast(m.pid, '#fff59d'); }
    else if (m.k === 'hearts') { const a = v3(m.a), b = m.b ? v3(m.b) : null; this.fx.hearts(a, b, m.e || '💗'); const p = g.players.list.get(m.pid); p?.roach.flirt(); }
    else if (m.k === 'eat') { const p = g.players.list.get(m.pid); if (p) p.roach.eat(m.m, m.prop, Math.min(6, +m.d || 3), typeof m.e === 'string' ? m.e.slice(0, 4) : null, !!m.tb); }
    else if (m.k === 'swing') { const p = g.players.list.get(m.pid); if (p && p.visible) { p.roach.attack('melee'); this.fx.slash(p.pos, p.heading, typeof m.w === 'string' && itemDef(m.w) ? m.w : 'fist'); } }
    else if (m.k === 'odm') g.odm?.remote(m);
    else if (m.k === 'noeffect' && Array.isArray(m.p)) g.ui.floatText(v3(m.p), `🛡️ ${m.text || '효과 없음'}`, '#ffab40');
    else if (m.k === 'napehit' && Array.isArray(m.p)) {
      // 큰 거대 젤리: 뒷목이 깊게 패였지만 아직 버틴다
      const n = v3(m.p), t = g.titans?.list.get(m.id);
      if (t) g.titans.setHp(t, +m.hp, +m.max);
      for (let i = 0; i < 18; i++) this.fx.part(n.clone(), new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6, (Math.random() - 0.5) * 9), Math.random() < 0.6 ? '#ff8fb1' : '#ffffff', 0.6, 0.7, 0.1, { grav: 10 });
      this.fx.ring(n, '#ff8fb1', 3, 0.35, { face: g.player?.pos.clone().setY(n.y) });
      sfx('napecut', n);
      t?.r.hurt?.();
      if (m.pid === g.myId) { g.ui.floatText(n.clone().setY(n.y + 2), `⚔️ 뒷목 명중! ${m.hp}번 더!`, '#ffd54f'); g.shake?.(0.3); }
    }
    else if (m.k === 'titandown' && Array.isArray(m.p)) {
      // 뒷목을 베었다! 피가 아니라 젤리 증기가 피어오른다
      const n = v3(m.p);
      for (let i = 0; i < 40; i++) this.fx.part(n.clone(), new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14), Math.random() < 0.5 ? '#ff8fb1' : '#fff59d', 1.0, 1.2, 0.2, { grav: 6 });
      for (let i = 0; i < 12; i++) setTimeout(() => this.fx.part(n.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, -n.y * Math.random(), (Math.random() - 0.5) * 8)), new THREE.Vector3(0, 3 + Math.random() * 3, 0), '#ffffff', 3, 2, 6, { normal: true, op: 0.5 }), i * 250);
      sfx('slay', n);
      if (g.player) g.shake(Math.max(0, 0.9 - g.player.pos.distanceTo(n) / 120));
    }
    else if (m.k === 'dmgnum' && m.shield) g.ui.floatText(v3(m.p), '🛡️ 무적', '#80d8ff'); // 춤추는 중이라 안 다침
    else if (m.k === 'dmgnum') {
      g.ui.floatText(v3(m.p), `${m.crit ? '💥' : ''}-${m.v}`, m.crit ? '#ffd600' : '#ff5252');
      if (m.pid !== undefined) { const p = g.players.list.get(m.pid); p?.roach.hurt(); }
    }
  }
}
