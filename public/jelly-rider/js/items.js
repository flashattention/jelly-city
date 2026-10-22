// 젤리라이더 아이템전: ? 상자 · 아이템 8가지 · 함정 · 물폭탄 · 미사일 · 번개
//   맞았는지는 '내 화면에서 움직이는 카트'(나 · 혼자 할 땐 AI)만 판정한다 → 같이 할 때 각자 자기 카트를 책임진다
import * as THREE from 'three';
import { makeBox, makeTrap, glowTex } from '../../dream-runner/js/items.js';

export const ITEMS = {
  boost: { emoji: '🚀', name: '부스터' },
  shield: { emoji: '🛡️', name: '방어막' },
  trap: { emoji: '🍯', name: '젤리 함정' },
  bomb: { emoji: '💣', name: '물폭탄' },
  missile: { emoji: '🎯', name: '미사일' },
  zap: { emoji: '⚡', name: '번개' },
  magnet: { emoji: '🧲', name: '자석' },
  ghost: { emoji: '👻', name: '유령' },
};
export const ITEM_IDS = Object.keys(ITEMS);
// 순위가 낮을수록 센 아이템이 잘 나온다
export function randomItem(rank, n) {
  const back = n > 1 ? (rank - 1) / (n - 1) : 0.5; // 0 = 1등 … 1 = 꼴찌
  const w = { boost: 1 + back * 2, shield: 2 - back, trap: 2 - back, bomb: 1.5, missile: 0.5 + back * 2, zap: back * 1.4, magnet: 0.5 + back * 1.5, ghost: 1 };
  let sum = 0; for (const k in w) sum += w[k];
  let x = Math.random() * sum;
  for (const k in w) { x -= w[k]; if (x <= 0) return k; }
  return 'boost';
}

export class RiderItems {
  constructor(scene, track) {
    this.scene = scene; this.track = track;
    this.group = new THREE.Group(); scene.add(this.group);
    this.traps = []; this.shots = []; this.boxes = [];
  }
  dispose() { this.scene.remove(this.group); }
  // ? 상자 줄 (먹으면 2초 뒤 다시 생긴다)
  makeBoxes() {
    for (const i of this.track.boxRows) for (const off of [-5, -1.7, 1.7, 5]) {
      const m = makeBox(); m.scale.setScalar(1.6);
      const p = this.track.at(i, off); m.position.set(p.x, p.y + 1.3, p.z);
      this.group.add(m); this.boxes.push({ m, p, back: 0 });
    }
  }
  // 상자 먹기 (local 카트들)
  takeBoxes(k) {
    for (const b of this.boxes) {
      if (b.back > 0 || (b.p.x - k.pos.x) ** 2 + (b.p.z - k.pos.z) ** 2 > 2.4 ** 2) continue;
      b.back = 2; b.m.visible = false;
      return true;
    }
    return false;
  }
  addTrap(x, y, z, owner) {
    const m = makeTrap(); m.scale.setScalar(1.5); m.position.set(x, y, z);
    this.group.add(m); this.traps.push({ m, x, z, owner, t: 0 });
  }
  // 물폭탄: 트랙을 따라 앞으로 날아가다 터진다
  addBomb(fromIdx, off, owner) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), new THREE.MeshToonMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.9 }));
    this.group.add(m);
    this.shots.push({ kind: 'bomb', m, idx: fromIdx + 3, off, owner, t: 0, life: 1.4 });
  }
  // 미사일: 바로 앞 카트를 따라간다 (도착하면 맞음)
  addMissile(from, target, owner) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 10), new THREE.MeshToonMaterial({ color: '#ff5252' })); body.rotation.x = Math.PI / 2; g.add(body);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb36b', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.setScalar(1.4); fl.position.z = -0.8; g.add(fl);
    g.position.copy(from.pos); g.position.y += 1.2;
    this.group.add(g);
    this.shots.push({ kind: 'missile', m: g, target, owner, t: 0, life: 4 });
  }
  // locals: 내 화면에서 판정할 카트들 · all: 모든 카트 (미사일 목표 찾기)  onHit(kart, kind)
  update(dt, t, locals, onHit) {
    for (const b of this.boxes) {
      if (b.back > 0) { b.back -= dt; if (b.back <= 0) b.m.visible = true; }
      if (b.m.visible) { b.m.children[0].rotation.set(t * 1.2, t * 1.7, 0); b.m.position.y = b.p.y + 1.3 + Math.sin(t * 2 + b.p.x) * 0.2; }
    }
    this.traps = this.traps.filter((tr) => {
      tr.t += dt;
      for (const k of locals) {
        if ((tr.owner === k.id && tr.t < 1.2) || (tr.x - k.pos.x) ** 2 + (tr.z - k.pos.z) ** 2 > 1.8 ** 2) continue;
        onHit(k, 'trap'); this.group.remove(tr.m); return false;
      }
      if (tr.t > 30) { this.group.remove(tr.m); return false; }
      return true;
    });
    this.shots = this.shots.filter((s) => {
      s.t += dt;
      if (s.kind === 'bomb') {
        s.idx += 45 * dt / 2;
        const p = this.track.at(s.idx, s.off);
        s.m.position.set(p.x, p.y + 1 + Math.sin(Math.min(1, s.t / s.life) * Math.PI) * 4, p.z);
        let hit = s.t >= s.life;
        for (const k of locals) if (k.id !== s.owner && (k.pos.x - p.x) ** 2 + (k.pos.z - p.z) ** 2 < 2.2 ** 2) hit = true;
        if (hit) {
          this.splash(p, '#4fc3f7');
          for (const k of locals) if (k.id !== s.owner && (k.pos.x - p.x) ** 2 + (k.pos.z - p.z) ** 2 < 5 ** 2) onHit(k, 'bomb');
          this.group.remove(s.m); return false;
        }
        return true;
      }
      // 미사일
      const tgt = s.target;
      if (!tgt) { this.group.remove(s.m); return false; }
      const to = tgt.pos.clone(); to.y += 0.8;
      const d = to.clone().sub(s.m.position), L = d.length();
      const step = (40 + s.t * 25) * dt;
      if (L < step + 0.8 || s.t > s.life) {
        this.splash(to, '#ff7043');
        if (locals.includes(tgt)) onHit(tgt, 'missile');
        this.group.remove(s.m); return false;
      }
      s.m.position.addScaledVector(d.normalize(), step); s.m.lookAt(to);
      return true;
    });
    this.sparks?.forEach((p) => { p.life -= dt; p.m.position.addScaledVector(p.v, dt); p.v.y -= 9 * dt; p.m.material.opacity = Math.max(0, p.life / 0.6); });
    if (this.sparks) this.sparks = this.sparks.filter((p) => { if (p.life <= 0) { this.group.remove(p.m); return false; } return true; });
  }
  splash(p, color) {
    this.sparks ||= [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.scale.setScalar(0.8 + Math.random()); m.position.copy(p);
      this.group.add(m);
      this.sparks.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 8, (Math.random() - 0.5) * 10), life: 0.6 });
    }
  }
}
