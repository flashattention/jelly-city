// 가로등·나무 같은 소품을 인스턴스 메쉬로 그린다 (수천 개도 가볍게).
// 차로 들이받으면 쓰러지고, 1분 뒤 서버 신호로 다시 선다.
import * as THREE from 'three';
import { toon } from '../../shared/js/utils.js';

const TILE = 460; // 화면 밖 타일은 통째로 안 그린다

export class Props {
  constructor(parent) {
    this.parent = parent;
    this.types = {};      // name → { parts: [{ geo, mat, local: Matrix4 }] }
    this.list = [];       // id → { type, x, y, z, s, ry, color, slots: [[bucketKey, index]], broken }
    this.buckets = new Map(); // `${type}:${part}:${tile}` → { mesh, mats: [], colors: [] }
    this.meshes = [];
  }

  defineType(name, parts) {
    this.types[name] = { parts: parts.map((p) => ({ ...p, local: new THREE.Matrix4().compose(new THREE.Vector3(...(p.pos || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))), new THREE.Vector3(...(p.scale || [1, 1, 1]))) })) };
  }

  add(type, x, y, z, s = 1, ry = 0, color = null) {
    const id = this.list.length;
    this.list.push({ type, x, y, z, s, ry, color, slots: [], broken: false });
    return id;
  }

  baseMatrix(p) {
    return new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry), new THREE.Vector3(p.s, p.s, p.s));
  }

  // 모든 소품을 모아 인스턴스 메쉬를 만든다
  build({ castShadow = false } = {}) {
    const groups = new Map();
    this.list.forEach((p, id) => {
      const tile = `${Math.floor((p.x + 5000) / TILE)},${Math.floor((p.z + 5000) / TILE)}`;
      this.types[p.type].parts.forEach((part, pi) => {
        const key = `${p.type}:${pi}:${tile}`;
        if (!groups.has(key)) groups.set(key, { part, items: [] });
        const g = groups.get(key);
        p.slots.push([key, g.items.length]);
        g.items.push(id);
      });
    });
    const tmp = new THREE.Matrix4(), col = new THREE.Color();
    for (const [key, g] of groups) {
      const mesh = new THREE.InstancedMesh(g.part.geo, g.part.mat, g.items.length);
      mesh.castShadow = castShadow && !g.part.noShadow;
      mesh.receiveShadow = true;
      g.items.forEach((id, i) => {
        const p = this.list[id];
        tmp.multiplyMatrices(this.baseMatrix(p), g.part.local);
        mesh.setMatrixAt(i, tmp);
        if (g.part.tint) mesh.setColorAt(i, col.set(p.color || g.part.tint));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.frustumCulled = true;
      this.parent.add(mesh);
      this.buckets.set(key, { mesh, part: g.part });
      this.meshes.push(mesh);
    }
  }

  // 쓰러뜨리기 (dir: 쓰러지는 방향 [x,z])
  setBroken(id, broken, dir = [1, 0]) {
    const p = this.list[id];
    if (!p || p.broken === broken) return;
    p.broken = broken;
    if (p.collider) p.collider.broken = broken;
    const base = this.baseMatrix(p);
    let m = base;
    if (broken) {
      const len = Math.hypot(dir[0], dir[1]) || 1;
      const axis = new THREE.Vector3(dir[1] / len, 0, -dir[0] / len); // 진행 방향으로 넘어진다
      const fall = new THREE.Matrix4().makeRotationAxis(axis, 1.4);
      const rotOnly = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry), new THREE.Vector3(p.s, p.s, p.s));
      m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(fall).multiply(rotOnly);
    }
    const tmp = new THREE.Matrix4();
    for (const [key, i] of p.slots) {
      const b = this.buckets.get(key);
      tmp.multiplyMatrices(m, b.part.local);
      b.mesh.setMatrixAt(i, tmp);
      b.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // 멀리 있는 타일 숨기기
  cull(camPos, maxDist = 700) {
    for (const m of this.meshes) {
      const s = m.boundingSphere;
      if (!s) continue;
      m.visible = Math.hypot(s.center.x - camPos.x, s.center.z - camPos.z) - s.radius < maxDist;
    }
  }
}

// 자주 쓰는 소품 모양
export function defineCommonProps(props, mats = {}) {
  const trunk = toon('#8d6e63');
  const leafMat = new THREE.MeshToonMaterial({ color: '#ffffff' }); // 색은 인스턴스마다
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 7);
  const cone = new THREE.ConeGeometry(1, 1, 8);
  // 가로수 (기존과 같은 모양)
  props.defineType('tree', [
    { geo: cyl, mat: trunk, pos: [0, 1.1, 0], scale: [0.22, 2.2, 0.22] },
    { geo: sphere, mat: leafMat, pos: [0, 2.9, 0], scale: [1.4, 1.25, 1.4], tint: '#6cc551' },
    { geo: sphere, mat: leafMat, pos: [0.4, 3.7, -0.2], scale: [1.0, 0.9, 1.0], tint: '#86d36b' },
  ]);
  // 가로등
  const pole = toon('#4a5160');
  props.defineType('lamp', [
    { geo: cyl, mat: pole, pos: [0, 2.6, 0], scale: [0.1, 5.2, 0.1] },
    { geo: new THREE.BoxGeometry(1, 1, 1), mat: pole, pos: [0, 5.1, 0.5], scale: [0.1, 0.1, 1.1] },
    { geo: new THREE.SphereGeometry(1, 10, 7), mat: mats.lamp || toon('#fff3c4'), pos: [0, 4.98, 1.0], scale: [0.32, 0.22, 0.32], noShadow: true },
  ]);
  // 숲 나무들
  props.defineType('pine', [
    { geo: cyl, mat: trunk, pos: [0, 1.2, 0], scale: [0.35, 2.4, 0.35] },
    { geo: cone, mat: leafMat, pos: [0, 4.2, 0], scale: [2.4, 4.4, 2.4], tint: '#2e7d32' },
    { geo: cone, mat: leafMat, pos: [0, 6.6, 0], scale: [1.6, 3.2, 1.6], tint: '#388e3c' },
  ]);
  props.defineType('broad', [
    { geo: cyl, mat: trunk, pos: [0, 1.6, 0], scale: [0.4, 3.2, 0.4] },
    { geo: sphere, mat: leafMat, pos: [0, 4.6, 0], scale: [2.8, 2.3, 2.8], tint: '#43a047' },
  ]);
  props.defineType('palm', [
    { geo: cyl, mat: toon('#a1887f'), pos: [0, 3, 0], scale: [0.28, 6, 0.28] },
    { geo: cone, mat: leafMat, pos: [0, 6.2, 0], rot: [Math.PI, 0, 0], scale: [3.2, 1.2, 3.2], tint: '#7cb342' },
  ]);
  props.defineType('jungle', [
    { geo: cyl, mat: toon('#5d4037'), pos: [0, 3, 0], scale: [0.55, 6, 0.55] },
    { geo: sphere, mat: leafMat, pos: [0, 7.2, 0], scale: [4.2, 2.6, 4.2], tint: '#1b5e20' },
    { geo: sphere, mat: leafMat, pos: [1.6, 6.0, 0.8], scale: [2.2, 1.6, 2.2], tint: '#2e7d32' },
  ]);
  props.defineType('dead', [
    { geo: cyl, mat: toon('#6d5d4b'), pos: [0, 2.2, 0], scale: [0.3, 4.4, 0.3] },
    { geo: cyl, mat: toon('#6d5d4b'), pos: [0.6, 3.6, 0], rot: [0, 0, -0.9], scale: [0.14, 1.8, 0.14] },
    { geo: cyl, mat: toon('#6d5d4b'), pos: [-0.5, 3.0, 0], rot: [0, 0, 1.0], scale: [0.12, 1.4, 0.12] },
  ]);
  props.defineType('rock', [{ geo: new THREE.DodecahedronGeometry(1, 0), mat: leafMat, pos: [0, 0.4, 0], scale: [1.6, 1.1, 1.3], tint: '#9e9e9e' }]);
  props.defineType('bush', [{ geo: sphere, mat: leafMat, pos: [0, 0.5, 0], scale: [1.1, 0.8, 1.1], tint: '#558b2f', noShadow: true }]);
  props.defineType('reed', [
    { geo: cone, mat: leafMat, pos: [0, 0.9, 0], scale: [0.25, 1.8, 0.25], tint: '#8d9a5b', noShadow: true },
    { geo: cone, mat: leafMat, pos: [0.3, 0.7, 0.2], scale: [0.2, 1.4, 0.2], tint: '#9e9d62', noShadow: true },
  ]);
  props.defineType('fern', [{ geo: cone, mat: leafMat, pos: [0, 0.4, 0], scale: [1.4, 0.8, 1.4], tint: '#33691e', noShadow: true }]);
  props.defineType('flower', [{ geo: sphere, mat: leafMat, pos: [0, 0.25, 0], scale: [0.25, 0.25, 0.25], tint: '#ff80ab', noShadow: true }]);
}
