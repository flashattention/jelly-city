// 캐릭터 만들기 · 꾸미기 (메인 화면 · 젤리시티가 같이 쓴다): 3D 미리보기 + 탭(기본 · 색 · 얼굴 · 악세서리)
import * as THREE from 'three';
import { Roach, GUMMY_COLORS } from './roach.js';
import { LOOK_PARTS, LOOK_COLORS, SKIN_COLORS, DEFAULT_LOOK, BASIC_ACC } from './look.js';
import { PERSONALITIES } from '../../jelly-city/js/data.js';
import { ITEMS } from '../../jelly-city/js/items.js';

export const DEFAULT_CHAR_KEY = 'jelly.char'; // 메인 화면에서 고른 대표 캐릭터 (모든 게임의 기본)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLOT_NAMES = { head: '🎩 머리', face: '👓 얼굴', body: '👕 몸', acc: '🎒 장신구' };
export const starterVis = (starter) => Object.values(starter || {}).map((id) => ITEMS[id]?.vis).filter(Boolean);
// 젤리 모드에서는 젤리 색을 먼저, 바퀴 모드에서는 원래 피부색
const bodyColors = () => (Roach.style === 'roach' ? SKIN_COLORS : [...GUMMY_COLORS, ...SKIN_COLORS.filter((c) => !GUMMY_COLORS.includes(c))]);
// 캐릭터 → 곰돌이 모델에 넘길 모양
export function charLook(c) {
  const pr = c?.profile || {};
  return { name: pr.name || c?.name, color: pr.color, gender: pr.gender, age: pr.age, look: pr.look, acc: pr.accessories?.length ? pr.accessories : starterVis(c?.starter) };
}

// ---------- 썸네일 (캐릭터 사진) ----------
let T = null;
export function thumbOf(c, size = 160) {
  if (!T) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(size, size); r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff6e8', '#c9a28a', 1.4));
    const dl = new THREE.DirectionalLight('#ffffff', 1.5); dl.position.set(2, 4, 5); scene.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 1.5, 5.6); cam.lookAt(0, 1.05, 0);
    T = { r, scene, cam };
  }
  const L = charLook(c);
  const m = new Roach({ own: true, seed: L.name, color: L.color, age: 25, gender: L.gender, look: L.look, accessories: L.acc });
  m.root.rotation.y = 0.35; m.update(0.016, 0);
  T.scene.add(m.root);
  T.r.render(T.scene, T.cam);
  const url = T.r.domElement.toDataURL('image/png');
  T.scene.remove(m.root);
  return url;
}

// ---------- 만들기 · 꾸미기 ----------
//   els = { preview, tabs, body }   opts.edit = true 면 이름 · 성별 · 나이 · 성격은 못 바꾼다 (모양만)
export class Creator {
  constructor(els) { this.els = els; this.pvOn = false; }
  open(draft, opts = {}) {
    this.edit = !!opts.edit;
    this.draft = draft || {
      name: '', gender: Math.random() < 0.5 ? '여' : '남', age: 25, personality: PERSONALITIES[0].name,
      color: Roach.style === 'roach' ? SKIN_COLORS[0] : GUMMY_COLORS[Math.floor(Math.random() * GUMMY_COLORS.length)], look: { ...DEFAULT_LOOK }, starter: { head: null, face: null, body: null, acc: null },
    };
    this.draft.look = { ...DEFAULT_LOOK, ...(this.draft.look || {}) };
    this.draft.starter ||= { head: null, face: null, body: null, acc: null };
    this.tab = this.edit ? 'body' : 'basic';
    this.startPreview();
    this.renderTabs();
  }
  close() { this.pvOn = false; }
  randomize() {
    const d = this.draft, pick = (a) => a[Math.floor(Math.random() * a.length)];
    d.color = pick(bodyColors());
    for (const [k, p] of Object.entries(LOOK_PARTS)) d.look[k] = Math.floor(Math.random() * p.options.length);
    for (const [k, p] of Object.entries(LOOK_COLORS)) d.look[k] = pick(p.options);
    if (!this.edit) for (const [slot, list] of Object.entries(BASIC_ACC)) d.starter[slot] = Math.random() < 0.7 ? pick(list)[0] : null;
    this.renderTabs(); this.updatePreview();
  }
  // 서버에 보낼 값
  profile() { const d = this.draft; return { name: (d.name || '').trim(), gender: d.gender, age: d.age, personality: d.personality, color: d.color, look: d.look }; }
  renderTabs() {
    const all = Roach.style === 'roach' ? { basic: '📝 기본', body: '🎨 몸·날개', face: '😊 얼굴', antenna: '📡 더듬이', acc: '🎀 악세서리' } : { basic: '📝 기본', body: '🎨 젤리 색·날개', face: '😊 얼굴', acc: '🎀 악세서리' };
    const tabs = this.edit ? Object.fromEntries(Object.entries(all).filter(([k]) => k !== 'basic' && k !== 'acc')) : all;
    const { tabs: tabsEl, body } = this.els;
    tabsEl.innerHTML = Object.entries(tabs).map(([k, v]) => `<button class="${k === this.tab ? 'active' : ''}" data-tab="${k}">${v}</button>`).join('');
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.renderTabs(); }; });
    const d = this.draft;
    const chips = (key, part) => `<div class="opt-row"><div class="opt-label">${part.label}</div><div class="chips">${part.options.map((o, i) => `<button class="chip ${d.look[key] === i ? 'sel' : ''}" data-look="${key}" data-v="${i}">${o}</button>`).join('')}</div></div>`;
    const colors = (key, part) => `<div class="opt-row"><div class="opt-label">${part.label}</div><div class="chips">${part.options.map((c) => `<span class="swatch ${d.look[key] === c ? 'sel' : ''} ${c === 'auto' || c === 'none' ? 'sw-word' : ''}" data-lookc="${key}" data-v="${c}" style="${c.startsWith('#') ? `background:${c}` : ''}">${c === 'auto' ? '자동' : c === 'none' ? '없음' : ''}</span>`).join('')}</div></div>`;
    let html = '';
    if (this.tab === 'basic') {
      html = `<div class="opt-row"><div class="opt-label">이름</div><input id="c-name" maxlength="8" placeholder="8글자까지" value="${esc(d.name)}"></div>
        <div class="opt-row"><div class="opt-label">성별</div><div class="chips">${['여', '남'].map((g) => `<button class="chip ${d.gender === g ? 'sel' : ''}" data-gender="${g}">${g === '여' ? '♀ 여자' : '♂ 남자'}</button>`).join('')}</div></div>
        <div class="opt-row"><div class="opt-label">나이 <b id="c-age-v">${d.age}</b>살</div><input id="c-age" type="range" min="18" max="80" value="${d.age}"></div>
        <div class="opt-row"><div class="opt-label">성격 (젤리시티 이웃들과 대화할 때)</div><select id="c-pers">${PERSONALITIES.map((p) => `<option ${p.name === d.personality ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
    } else if (this.tab === 'body') {
      html = `<div class="opt-row"><div class="opt-label">${Roach.style === 'roach' ? '피부색' : '젤리 색'}</div><div class="chips">${bodyColors().map((c) => `<span class="swatch ${d.color === c ? 'sel' : ''}" data-skin="${c}" style="background:${c}"></span>`).join('')}</div></div>`
        + colors('belly', LOOK_COLORS.belly) + chips('wings', LOOK_PARTS.wings) + chips('tail', LOOK_PARTS.tail);
    } else if (this.tab === 'face') {
      html = chips('eyes', LOOK_PARTS.eyes) + colors('pupil', LOOK_COLORS.pupil) + (Roach.style === 'roach' ? '' : chips('ears', LOOK_PARTS.ears)) + chips('nose', LOOK_PARTS.nose) + chips('mouth', LOOK_PARTS.mouth) + colors('cheek', LOOK_COLORS.cheek);
    } else if (this.tab === 'antenna') {
      html = chips('antenna', LOOK_PARTS.antenna);
    } else {
      html = Object.entries(BASIC_ACC).map(([slot, list]) => `<div class="opt-row"><div class="opt-label">${SLOT_NAMES[slot]}</div><div class="chips">
        <button class="chip ${!d.starter[slot] ? 'sel' : ''}" data-acc="${slot}" data-v="">없음</button>
        ${list.map(([id, name, emoji]) => `<button class="chip ${d.starter[slot] === id ? 'sel' : ''}" data-acc="${slot}" data-v="${id}">${emoji} ${esc(name)}</button>`).join('')}</div></div>`).join('')
        + '<p class="hint">기본 악세서리는 젤리시티 가방에 들어 있어서 언제든 바꿔 낄 수 있어요. 더 멋진 건 시내 모자·안경·옷 가게에서!</p>';
    }
    body.innerHTML = html;
    const re = () => { this.renderTabs(); this.updatePreview(); };
    body.querySelectorAll('[data-look]').forEach((b) => { b.onclick = () => { d.look[b.dataset.look] = +b.dataset.v; re(); }; });
    body.querySelectorAll('[data-lookc]').forEach((b) => { b.onclick = () => { d.look[b.dataset.lookc] = b.dataset.v; re(); }; });
    body.querySelectorAll('[data-skin]').forEach((b) => { b.onclick = () => { d.color = b.dataset.skin; re(); }; });
    body.querySelectorAll('[data-gender]').forEach((b) => { b.onclick = () => { d.gender = b.dataset.gender; re(); }; });
    body.querySelectorAll('[data-acc]').forEach((b) => { b.onclick = () => { d.starter[b.dataset.acc] = b.dataset.v || null; re(); }; });
    const nm = body.querySelector('#c-name'), ag = body.querySelector('#c-age'), ps = body.querySelector('#c-pers');
    if (nm) nm.oninput = (e) => { d.name = e.target.value; };
    if (ag) ag.oninput = (e) => { d.age = +e.target.value; body.querySelector('#c-age-v').textContent = d.age; this.updatePreview(); };
    if (ps) ps.onchange = (e) => { d.personality = e.target.value; };
    this.zoom = this.tab === 'face' || this.tab === 'antenna' ? 1 : 0; // 얼굴 탭에서는 얼굴이 잘 보이도록 가까이
  }
  startPreview() {
    const el = this.els.preview;
    if (!this.pv) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio));
      r.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#fff6e8', '#c9a28a', 1.4));
      const dl = new THREE.DirectionalLight('#ffffff', 1.6); dl.position.set(2, 4, 5); scene.add(dl);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshToonMaterial({ color: '#ffe0ec' }));
      floor.rotation.x = -Math.PI / 2; scene.add(floor);
      const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
      this.pv = { r, scene, cam, rotY: 0.3, drag: null };
      const c = r.domElement;
      c.addEventListener('pointerdown', (e) => { this.pv.drag = e.clientX; c.setPointerCapture(e.pointerId); });
      c.addEventListener('pointermove', (e) => { if (this.pv.drag != null) { this.pv.rotY += (e.clientX - this.pv.drag) * 0.012; this.pv.drag = e.clientX; } });
      c.addEventListener('pointerup', () => { this.pv.drag = null; });
    }
    el.innerHTML = '';
    el.appendChild(this.pv.r.domElement);
    this.zoom = 0; this.zoomK = 0;
    this.updatePreview();
    if (this.pvOn) return;
    let last = performance.now();
    const loop = (now) => {
      if (!this.pvOn) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = el.clientWidth || 300, h = el.clientHeight || 300;
      if (this.pv.w !== w || this.pv.h !== h) { this.pv.r.setSize(w, h, false); this.pv.cam.aspect = w / h; this.pv.cam.updateProjectionMatrix(); this.pv.w = w; this.pv.h = h; }
      this.zoomK += (this.zoom - this.zoomK) * Math.min(1, dt * 5);
      const z = this.zoomK;
      if (this.pv.drag == null) {
        if (this.zoom) { const want = 0.35 * Math.sin(now / 1400); const d = ((want - this.pv.rotY) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; this.pv.rotY += d * Math.min(1, dt * 4); }
        else this.pv.rotY += dt * 0.5;
      }
      this.pv.cam.position.set(0, 1.45 + z * 0.6, 5.4 - z * 1.9);
      this.pv.cam.lookAt(0, 1.0 + z * 0.95, 0);
      if (this.pvRoach) { this.pvRoach.root.rotation.y = this.pv.rotY; this.pvRoach.update(dt, 0); if (Math.random() < 0.003) this.pvRoach.wave(); }
      this.pv.r.render(this.pv.scene, this.pv.cam);
      requestAnimationFrame(loop);
    };
    this.pvOn = true;
    requestAnimationFrame(loop);
  }
  updatePreview() {
    if (!this.pv) return;
    const d = this.draft;
    if (this.pvRoach) this.pv.scene.remove(this.pvRoach.root);
    this.pvRoach = new Roach({ own: true, seed: d.name, color: d.color, age: d.age, gender: d.gender, look: d.look, accessories: this.edit ? d.accessories || starterVis(d.starter) : starterVis(d.starter) });
    this.pv.scene.add(this.pvRoach.root);
  }
}
