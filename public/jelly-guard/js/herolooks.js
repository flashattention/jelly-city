// 젤리워치 영웅 겉모습: 곰돌이 몸에 영웅마다 다른 장비를 입힌다 (오버워치 원작의 실루엣 · 색 · 상징을 젤리식으로)
//   머리(bear.head) 기준: 가운데 (0,0,0) · 반지름 약 0.5 · 얼굴 = +z
//   몸통(bear.torso) 기준: 몸 가운데 y 1.02 · 어깨 y 1.4 · 등 = -z
import * as THREE from 'three';

const M = new Map();
const toon = (c, o = {}) => { const k = c + JSON.stringify(o); if (!M.has(k)) M.set(k, new THREE.MeshToonMaterial({ color: c, ...o })); return M.get(k); };
const glow = (c, op = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op });
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 18, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 14),
  hemi: new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), tor: new THREE.TorusGeometry(1, 0.12, 8, 24), half: new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI),
};
function p(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); parent.add(o); return o; }
// 양쪽 어깨 (s = -1 · 1)
const both = (f) => { f(-1); f(1); };

const LOOKS = {
  // 젤리하르트: 은빛 판금 갑옷 · 사자 투구(금빛 테 · 눈 틈) · 커다란 어깨 갑옷 · 빨간 망토
  rein(b) {
    const steel = toon('#c3cad6'), dark = toon('#6b7384'), gold = toon('#e8b84a');
    p(b.head, G.sph, steel, 0, 0.04, 0, 0.6, 0.58, 0.6);
    // T 자 눈 틈 (가로 · 세로) · 사자 이마
    p(b.head, G.box, toon('#1a1c22'), 0, 0.1, 0.58, 0.46, 0.07, 0.06);
    p(b.head, G.box, toon('#1a1c22'), 0, -0.05, 0.58, 0.07, 0.26, 0.06);
    p(b.head, G.box, gold, 0, 0.2, 0.57, 0.5, 0.05, 0.05);
    both((s) => p(b.head, G.sph, glow('#7cd8ff', 0.8), s * 0.13, 0.1, 0.6, 0.06, 0.03, 0.02));
    p(b.head, G.box, gold, 0, 0.38, 0.1, 0.08, 0.3, 0.75);
    both((s) => { p(b.head, G.cone, gold, s * 0.42, 0.42, -0.05, 0.08, 0.32, 0.08, 0, 0, -s * 0.5); });
    p(b.head, G.box, steel, 0, -0.22, 0.42, 0.42, 0.22, 0.2);
    p(b.torso, G.sph, steel, 0, 1.05, 0.02, 0.64, 0.66, 0.54);
    p(b.torso, G.box, gold, 0, 1.25, 0.5, 0.5, 0.08, 0.06);
    p(b.torso, G.sph, toon('#7cb8ff', { emissive: '#3a7ab0' }), 0, 1.05, 0.52, 0.1, 0.1, 0.06);
    both((s) => { p(b.torso, G.sph, steel, s * 0.6, 1.45, 0, 0.36, 0.3, 0.36); p(b.torso, G.tor, gold, s * 0.6, 1.4, 0, 0.32, 0.32, 0.6, Math.PI / 2); p(b.torso, G.cone, steel, s * 0.72, 1.7, 0, 0.08, 0.22, 0.08); });
    p(b.torso, G.box, toon('#c0392b'), 0, 0.9, -0.5, 0.8, 1.0, 0.05, 0.12);
    p(b.torso, G.box, dark, 0, 0.68, 0, 1.02, 0.12, 0.92);
  },
  // 젤리스턴: 동그란 안경 · 흰 과학자 갑옷 · 등에 점프 팩(파란 불)
  winston(b) {
    const plate = toon('#e6e9ef'), dark = toon('#4a4f5c');
    both((s) => { p(b.head, G.tor, toon('#2b2b33'), s * 0.17, 0.08, 0.46, 0.14, 0.14, 0.3); p(b.head, G.cyl, glow('#d8f3ff', 0.4), s * 0.17, 0.08, 0.47, 0.12, 0.01, 0.12, Math.PI / 2); });
    p(b.head, G.box, toon('#2b2b33'), 0, 0.1, 0.48, 0.12, 0.03, 0.03);
    p(b.torso, G.sph, plate, 0, 1.12, 0.12, 0.5, 0.5, 0.42);
    p(b.torso, G.box, toon('#ffb347'), 0, 1.15, 0.52, 0.3, 0.06, 0.04);
    both((s) => { p(b.torso, G.sph, plate, s * 0.56, 1.45, 0, 0.28, 0.24, 0.3); p(b.torso, G.cyl, dark, s * 0.25, 1.15, -0.55, 0.14, 0.6, 0.14); p(b.torso, G.cone, glow('#7cd8ff', 0.8), s * 0.25, 0.75, -0.55, 0.12, 0.2, 0.12, Math.PI); });
    p(b.torso, G.box, dark, 0, 1.2, -0.48, 0.5, 0.5, 0.18);
  },
  // 디젤바: 분홍 헤드셋 · 볼에 수염 무늬 3줄 · 파랑 · 흰 줄무늬 전투복 · 가슴 토끼
  dva(b) {
    both((s) => {
      p(b.head, G.cyl, toon('#ff7ab8'), s * 0.5, 0.05, 0, 0.18, 0.12, 0.18, 0, 0, Math.PI / 2);
      p(b.head, G.box, toon('#ffffff'), s * 0.56, 0.05, 0.12, 0.04, 0.05, 0.28);
      for (let i = 0; i < 3; i++) p(b.head, G.box, toon('#ff5fa2'), s * 0.28, -0.05 + i * 0.05, 0.42, 0.12, 0.018, 0.02, 0, 0, s * 0.1);
    });
    p(b.head, G.tor, toon('#ff7ab8'), 0, 0.35, 0, 0.5, 0.5, 0.6, Math.PI / 2 + 0.3);
    p(b.torso, G.sph, toon('#3d6fd8'), 0, 1.04, 0.02, 0.54, 0.62, 0.48);
    both((s) => p(b.torso, G.box, toon('#ffffff'), s * 0.25, 1.05, 0.44, 0.06, 0.8, 0.04));
    p(b.torso, G.box, toon('#ffffff'), 0, 1.25, 0.47, 0.22, 0.2, 0.03);
    both((s) => p(b.torso, G.cone, toon('#ff7ab8'), s * 0.05, 1.37, 0.49, 0.03, 0.1, 0.02));
  },
  // 젤리호그: 돼지 코 방독면 · 갈고리를 등에 · 배 문신 · 멜빵 · 사슬
  hog(b) {
    const mask = toon('#5a5f4a'), rust = toon('#a8743f'), chain = toon('#8f97a6');
    p(b.head, G.sph, mask, 0, -0.05, 0.25, 0.42, 0.4, 0.3);
    p(b.head, G.cyl, toon('#3a3d32'), 0, -0.1, 0.55, 0.16, 0.18, 0.16, Math.PI / 2);
    both((s) => { p(b.head, G.cyl, rust, s * 0.28, -0.18, 0.46, 0.1, 0.2, 0.1, Math.PI / 2 + 0.3, 0, s * 0.4); p(b.head, G.sph, glow('#ffcc66', 0.7), s * 0.16, 0.12, 0.47, 0.07, 0.07, 0.03); });
    p(b.torso, G.sph, toon('#e8b98f'), 0, 0.98, 0.18, 0.5, 0.52, 0.38);
    p(b.torso, G.sph, toon('#3a4a6a'), 0, 1.0, 0.5, 0.14, 0.14, 0.03);
    both((s) => p(b.torso, G.box, toon('#4a3a2a'), s * 0.22, 1.2, 0.42, 0.08, 0.8, 0.06, 0, 0, s * 0.25));
    for (let i = 0; i < 6; i++) p(b.torso, G.tor, chain, -0.4 + i * 0.13, 1.45 - i * 0.12, 0.38, 0.06, 0.06, 0.06, 0, Math.PI / 2, 0);
    p(b.torso, G.box, chain, 0.1, 1.3, -0.55, 0.12, 0.6, 0.06, 0, 0, 0.4); p(b.torso, G.box, chain, 0.25, 1.62, -0.55, 0.32, 0.08, 0.06, 0, 0, 0.4);
    p(b.torso, G.box, toon('#4a3a2a'), 0, 0.72, 0, 1.0, 0.12, 0.9);
  },
  // 자리젤리: 분홍 삐죽 머리 · 커다란 빨간 어깨 갑옷 · 가슴 끈
  zarya(b) {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; p(b.head, G.cone, toon('#ff5fa2'), Math.cos(a) * 0.22, 0.44, Math.sin(a) * 0.2 - 0.05, 0.1, 0.32, 0.1, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    p(b.head, G.hemi, toon('#ff5fa2'), 0, 0.15, -0.04, 0.5, 0.36, 0.48);
    both((s) => { p(b.torso, G.box, toon('#c0283a'), s * 0.62, 1.45, 0, 0.42, 0.26, 0.5, 0, 0, -s * 0.2); p(b.torso, G.box, toon('#3a3d46'), s * 0.62, 1.32, 0, 0.44, 0.06, 0.52, 0, 0, -s * 0.2); });
    p(b.torso, G.box, toon('#3a3d46'), 0, 1.1, 0.45, 0.1, 0.9, 0.05, 0, 0, 0.6);
    p(b.torso, G.sph, toon('#ff8fd0', { emissive: '#ff5fa2' }), 0, 1.2, 0.5, 0.1, 0.1, 0.05);
  },
  // 파라젤리: 파란 매 투구(옆 날개 · 금빛 눈) · 갑옷 · 등에 로켓 추진기 · 어깨 미사일 통
  pharah(b) {
    const blue = toon('#2f6fd0'), gold = toon('#f0c04a'), dark = toon('#2a3448');
    p(b.head, G.sph, blue, 0, 0.05, 0, 0.56, 0.55, 0.56);
    p(b.head, G.box, gold, 0, 0.08, 0.5, 0.42, 0.08, 0.1);
    both((s) => { p(b.head, G.box, blue, s * 0.55, 0.15, -0.1, 0.06, 0.18, 0.5, 0.4, 0, 0); p(b.head, G.box, gold, s * 0.58, 0.22, -0.2, 0.04, 0.08, 0.42, 0.4, 0, 0); });
    p(b.head, G.box, gold, 0, 0.5, 0.05, 0.06, 0.1, 0.6);
    p(b.torso, G.sph, blue, 0, 1.06, 0.03, 0.56, 0.62, 0.5);
    p(b.torso, G.box, gold, 0, 1.2, 0.5, 0.36, 0.12, 0.04);
    both((s) => { p(b.torso, G.box, blue, s * 0.58, 1.48, 0, 0.36, 0.22, 0.42); p(b.torso, G.cyl, dark, s * 0.7, 1.68, 0, 0.12, 0.3, 0.12); p(b.torso, G.cyl, dark, s * 0.3, 1.0, -0.55, 0.13, 0.7, 0.13); p(b.torso, G.cone, glow('#9fd8ff', 0.8), s * 0.3, 0.58, -0.55, 0.11, 0.16, 0.11, Math.PI); p(b.torso, G.box, blue, s * 0.55, 1.15, -0.6, 0.5, 0.06, 0.25, 0, 0, s * 0.3); });
  },
  // 리퍼젤리: 검은 후드 · 흰 해골 가면 · 검은 망토 자락 · 탄띠
  reaper(b) {
    const black = toon('#1f1b26'), bone = toon('#f2efe6');
    p(b.head, G.sph, black, 0, 0.08, -0.06, 0.62, 0.62, 0.62);
    p(b.head, G.cone, black, 0, 0.55, -0.15, 0.25, 0.3, 0.25, -0.4);
    const mask = p(b.head, G.sph, bone, 0, -0.02, 0.32, 0.36, 0.42, 0.22); void mask;
    both((s) => p(b.head, G.sph, toon('#111'), s * 0.13, 0.06, 0.52, 0.08, 0.06, 0.03));
    for (let i = 0; i < 4; i++) p(b.head, G.box, toon('#111'), -0.09 + i * 0.06, -0.22, 0.5, 0.02, 0.06, 0.02);
    p(b.torso, G.cone, black, 0, 0.95, 0, 0.72, 1.2, 0.6, Math.PI);
    p(b.torso, G.box, toon('#5a4a3a'), 0, 0.95, 0.38, 0.1, 0.9, 0.05, 0, 0, 0.6);
    for (let i = 0; i < 5; i++) p(b.torso, G.cyl, toon('#c0392b'), -0.2 + i * 0.1, 1.05 - i * 0.07, 0.44, 0.025, 0.08, 0.025, 0, 0, 0.6);
  },
  // 젤리크리: 넓은 챙 카우보이 모자 · 빨간 망토(세라페) · 별 버클 · 로봇 팔
  cassidy(b) {
    const hat = toon('#7a4f2d');
    p(b.head, G.cyl, hat, 0, 0.36, 0, 0.82, 0.04, 0.78);
    p(b.head, G.cyl, hat, 0, 0.55, 0, 0.36, 0.36, 0.34);
    p(b.head, G.cyl, toon('#3a2a1a'), 0, 0.42, 0, 0.37, 0.07, 0.35);
    p(b.head, G.cyl, toon('#c9a27a'), 0.12, -0.18, 0.52, 0.02, 0.18, 0.02, Math.PI / 2 - 0.2, 0.3, 0);
    p(b.head, G.sph, glow('#ff7a3d', 0.9), 0.17, -0.2, 0.62, 0.025, 0.025, 0.025);
    p(b.torso, G.cone, toon('#b23a3a'), 0, 1.25, 0, 0.78, 0.55, 0.7);
    for (let i = 0; i < 4; i++) p(b.torso, G.tor, toon('#f0d080'), 0, 1.06 - i * 0.04, 0, 0.6 - i * 0.01, 0.6 - i * 0.01, 0.15, Math.PI / 2);
    p(b.torso, G.box, toon('#4a3a2a'), 0, 0.72, 0, 1.0, 0.1, 0.9);
    p(b.torso, G.cyl, toon('#e8b84a'), 0, 0.72, 0.47, 0.09, 0.03, 0.09, Math.PI / 2);
    p(b.arms[1], G.cyl, toon('#9aa0ab'), 0, -0.3, 0, 0.1, 0.4, 0.1);
  },
  // 솔저젤리: 빨간 띠 바이저 · 은빛 머리 · 흰 별 재킷 · 높은 깃
  soldier(b) {
    p(b.head, G.box, toon('#3a3d46'), 0, 0.1, 0.4, 0.62, 0.16, 0.24);
    p(b.head, G.box, glow('#ff3a3a', 0.95), 0, 0.1, 0.52, 0.5, 0.06, 0.02);
    p(b.head, G.box, toon('#5a5f6a'), 0, -0.16, 0.44, 0.42, 0.16, 0.12);
    p(b.head, G.hemi, toon('#c9ccd2'), 0, 0.2, -0.05, 0.46, 0.3, 0.44);
    p(b.torso, G.sph, toon('#3c4a6a'), 0, 1.06, 0.02, 0.56, 0.62, 0.5);
    p(b.torso, G.box, toon('#e6e9ef'), 0, 1.15, 0.49, 0.18, 0.22, 0.02);
    p(b.torso, G.cyl, toon('#e6e9ef'), 0, 1.58, 0, 0.36, 0.14, 0.34);
    both((s) => { p(b.torso, G.box, toon('#e6e9ef'), s * 0.5, 1.12, 0.3, 0.08, 0.6, 0.05); p(b.torso, G.box, toon('#c0392b'), s * 0.55, 1.4, 0.05, 0.24, 0.06, 0.4); });
  },
  // 젤리겐지: 은빛 사이보그 투구(초록 눈 틈) · 초록 빛 줄 · 등에 칼 두 자루
  genji(b) {
    const metal = toon('#d4dbe3'), dark = toon('#3a3f4a'), green = glow('#7dff5a', 0.95);
    p(b.head, G.sph, metal, 0, 0.03, 0, 0.56, 0.54, 0.55);
    p(b.head, G.box, dark, 0, 0.06, 0.5, 0.46, 0.12, 0.1);
    p(b.head, G.box, green, 0, 0.06, 0.56, 0.38, 0.04, 0.02);
    both((s) => p(b.head, G.box, green, s * 0.4, -0.12, 0.3, 0.03, 0.2, 0.12));
    p(b.torso, G.sph, metal, 0, 1.05, 0.02, 0.55, 0.62, 0.49);
    for (const y of [0.9, 1.15]) p(b.torso, G.box, green, 0, y, 0.48, 0.42, 0.025, 0.02);
    p(b.torso, G.box, dark, 0, 0.72, 0, 1.0, 0.12, 0.9);
    p(b.torso, G.box, toon('#3a3f4a'), 0.15, 1.25, -0.52, 0.06, 1.2, 0.06, 0, 0, -0.5);
    p(b.torso, G.box, toon('#7dff5a'), 0.48, 1.62, -0.52, 0.08, 0.14, 0.08, 0, 0, -0.5);
    p(b.torso, G.box, toon('#3a3f4a'), -0.2, 0.9, -0.52, 0.05, 0.7, 0.05, 0, 0, 0.8);
  },
  // 젤리메이커: 보라 피부 · 길게 묶은 머리 · 붉은 눈 고글 · 검은 옷 · 등의 거미
  widow(b) {
    const hair = toon('#2a1a40');
    p(b.head, G.hemi, hair, 0, 0.12, -0.04, 0.52, 0.42, 0.5);
    p(b.head, G.cyl, hair, 0, -0.2, -0.55, 0.08, 1.1, 0.08, 0.35);
    p(b.head, G.sph, hair, 0, 0.32, -0.42, 0.14, 0.14, 0.14);
    p(b.head, G.box, toon('#2b2b33'), 0, 0.12, 0.42, 0.56, 0.12, 0.1);
    for (const x of [-0.2, -0.08, 0.08, 0.2]) p(b.head, G.sph, glow('#ff3a7a', 0.95), x, 0.13, 0.48, 0.045, 0.045, 0.02);
    p(b.torso, G.sph, toon('#26203a'), 0, 1.05, 0.02, 0.54, 0.62, 0.48);
    both((s) => p(b.torso, G.box, toon('#8a5ad8'), s * 0.2, 1.05, 0.46, 0.06, 0.8, 0.02, 0, 0, s * 0.2));
    p(b.torso, G.sph, toon('#c02a4a'), 0, 1.15, -0.5, 0.1, 0.13, 0.04);
    for (let i = 0; i < 4; i++) both((s) => p(b.torso, G.box, toon('#c02a4a'), s * 0.14, 1.22 - i * 0.06, -0.5, 0.16, 0.02, 0.02, 0, 0, s * (0.4 - i * 0.25)));
  },
  // 트레이젤리: 가슴의 파란 시간 가속기(빛나는 원판 · 멜빵) · 주황 고글 · 삐죽 갈색 머리 · 가죽 재킷
  tracer(b) {
    for (let i = 0; i < 6; i++) { const a = -1 + i * 0.4; p(b.head, G.cone, toon('#5a3a22'), Math.sin(a) * 0.3, 0.42, Math.cos(a) * 0.1 - 0.08, 0.1, 0.32, 0.1, 0.3 + Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.6); }
    p(b.head, G.box, toon('#ff8a1f'), 0, 0.1, 0.44, 0.58, 0.14, 0.08);
    both((s) => p(b.head, G.sph, glow('#ffd27a', 0.7), s * 0.16, 0.1, 0.49, 0.1, 0.07, 0.02));
    p(b.torso, G.sph, toon('#7a4a2a'), 0, 1.06, 0.02, 0.55, 0.6, 0.49);
    p(b.torso, G.cyl, toon('#d8dde6'), 0, 1.12, 0.46, 0.22, 0.08, 0.22, Math.PI / 2);
    p(b.torso, G.cyl, glow('#5ad8ff', 0.95), 0, 1.12, 0.51, 0.16, 0.04, 0.16, Math.PI / 2);
    both((s) => { p(b.torso, G.box, toon('#d8dde6'), s * 0.3, 1.3, 0.38, 0.08, 0.5, 0.04, 0, 0, s * 0.5); p(b.torso, G.box, toon('#d8dde6'), s * 0.3, 0.92, 0.38, 0.08, 0.5, 0.04, 0, 0, -s * 0.5); });
    p(b.torso, G.box, toon('#ff8a1f'), 0, 0.7, 0, 1.0, 0.1, 0.9);
  },
  // 젤리시: 금빛 머리 묶음 · 머리띠 후광 · 흰 발키리 옷 · 금빛 기계 날개
  mercy(b) {
    const gold = toon('#f2cf5a'), white = toon('#fbf8ee');
    p(b.head, G.hemi, toon('#ffe08a'), 0, 0.14, -0.04, 0.52, 0.42, 0.5);
    p(b.head, G.sph, toon('#ffe08a'), 0, 0.15, -0.5, 0.16, 0.2, 0.16);
    p(b.head, G.box, gold, 0, 0.3, 0.38, 0.4, 0.05, 0.04);
    p(b.head, G.tor, glow('#fff3b0', 0.85), 0, 0.68, 0, 0.32, 0.32, 0.4, Math.PI / 2);
    p(b.torso, G.sph, white, 0, 1.05, 0.02, 0.55, 0.62, 0.49);
    p(b.torso, G.box, gold, 0, 1.18, 0.49, 0.12, 0.34, 0.02); p(b.torso, G.box, gold, 0, 1.24, 0.49, 0.3, 0.1, 0.02);
    both((s) => { for (let i = 0; i < 4; i++) p(b.torso, G.box, i % 2 ? gold : white, s * (0.45 + i * 0.16), 1.55 + i * 0.12, -0.5, 0.12, 0.7 - i * 0.08, 0.04, 0, 0, -s * (0.6 + i * 0.12)); });
  },
  // 젤리아나: 파란 두건 · 안대 · 오른눈 아래 호루스 문신 · 긴 코트
  ana(b) {
    const blue = toon('#3b5b7c');
    p(b.head, G.sph, blue, 0, 0.1, -0.05, 0.56, 0.52, 0.56);
    p(b.head, G.box, blue, 0, -0.2, -0.3, 0.6, 0.4, 0.3);
    p(b.head, G.box, toon('#e8dcc4'), 0, 0.42, 0.25, 0.5, 0.06, 0.08);
    p(b.head, G.box, toon('#1a1a1a'), -0.16, 0.1, 0.46, 0.18, 0.12, 0.03);
    p(b.head, G.box, toon('#1a1a1a'), 0, 0.2, 0.42, 0.62, 0.025, 0.02, 0, 0, -0.35);
    p(b.head, G.box, toon('#2a5a9a'), 0.17, -0.02, 0.47, 0.03, 0.12, 0.01);
    p(b.torso, G.cone, toon('#4a6382'), 0, 0.95, 0, 0.66, 1.0, 0.56, Math.PI);
    p(b.torso, G.box, toon('#c8b48a'), 0, 1.1, 0.42, 0.1, 0.9, 0.04, 0, 0, -0.6);
  },
  // 젤리우: 초록 · 노랑 레게 머리 · 헤드폰 · 개구리 무늬 · 롤러스케이트
  lucio(b) {
    for (let i = 0; i < 8; i++) { const a = -1.2 + i * 0.34; p(b.head, G.cyl, toon(i % 3 ? '#4a3a22' : '#a6e04a'), Math.sin(a) * 0.3, 0.25, -0.35 + Math.cos(a) * 0.05, 0.06, 0.6, 0.06, -1.0, 0, -Math.sin(a) * 0.3); }
    p(b.head, G.tor, toon('#86d957'), 0, 0.15, 0, 0.5, 0.5, 0.5, 0, Math.PI / 2, 0);
    both((s) => p(b.head, G.cyl, toon('#ffd84d'), s * 0.52, 0.05, 0, 0.17, 0.12, 0.17, 0, 0, Math.PI / 2));
    p(b.torso, G.sph, toon('#ffd84d'), 0, 1.06, 0.02, 0.55, 0.6, 0.49);
    p(b.torso, G.sph, toon('#3fa04a'), 0, 1.1, 0.5, 0.14, 0.1, 0.03);
    both((s) => p(b.torso, G.box, toon('#3fa04a'), s * 0.3, 1.0, 0.44, 0.05, 0.7, 0.04));
    for (const leg of b.legs) { p(leg, G.box, toon('#86d957'), 0, -0.6, 0.06, 0.26, 0.12, 0.42); for (const z of [-0.12, 0.22]) p(leg, G.cyl, glow('#d6ff9a', 0.9), 0, -0.68, z, 0.07, 0.24, 0.07, 0, 0, Math.PI / 2); }
  },
  // 젤리라: 붉은 귤빛 넘긴 머리 · 높은 깃 어두운 코트 · 양손 노랑 · 보라 빛
  moira(b) {
    const hair = toon('#e0642a');
    p(b.head, G.hemi, hair, 0.04, 0.14, -0.04, 0.54, 0.44, 0.52);
    p(b.head, G.box, hair, 0.28, 0.32, 0.18, 0.3, 0.2, 0.36, 0, 0, -0.4);
    p(b.head, G.box, hair, -0.2, 0.0, -0.3, 0.2, 0.5, 0.3);
    p(b.head, G.sph, glow('#c07bff', 0.8), -0.16, 0.1, 0.47, 0.06, 0.05, 0.02);
    p(b.torso, G.cone, toon('#2a1f3a'), 0, 0.95, 0, 0.66, 1.05, 0.56, Math.PI);
    p(b.torso, G.cyl, toon('#2a1f3a'), 0, 1.6, -0.08, 0.38, 0.3, 0.36);
    p(b.torso, G.box, toon('#8a2a4a'), 0, 1.1, 0.43, 0.14, 0.8, 0.04);
    const hands = [b.arms[0], b.arms[1]];
    hands.forEach((a, i) => p(a, G.sph, glow(i ? '#c07bff' : '#ffe48a', 0.9), 0, -0.45, 0, 0.12, 0.12, 0.12));
  },
};
// 투구 · 후드 · 두건을 쓰는 영웅은 곰돌이 귀를 숨긴다 (머리 위로 삐져나오지 않게)
const NO_EARS = new Set(['rein', 'pharah', 'genji', 'reaper', 'ana']);
export function dressHero(bear, id) {
  const f = LOOKS[id]; if (!f) return false;
  if (NO_EARS.has(id)) for (const o of bear.head.children) if (o.position.y > 0.4 && Math.abs(o.position.x) > 0.12) o.visible = false;
  f(bear); bear.detailsDirty = true; return true;
}
export const hasLook = (id) => !!LOOKS[id];
