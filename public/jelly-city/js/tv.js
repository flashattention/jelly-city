// TV 방송: 캔버스에 그린 애니메이션을 화면 텍스처로 (채널 전환 가능)
import * as THREE from 'three';
import { cityText } from '../../shared/js/utils.js';

export const CHANNELS = [
  { id: 'news', name: 'JBC 9시 뉴스', emoji: '📰' },
  { id: 'cartoon', name: '꼬물이 만화동산', emoji: '🎬' },
  { id: 'sports', name: '젤리 스포츠 축구 중계', emoji: '⚽' },
  { id: 'cooking', name: '요리왕 젤리', emoji: '🍳' },
  { id: 'music', name: '말랑 뮤직쇼', emoji: '🎵' },
  { id: 'weather', name: '젤리시티 날씨', emoji: '🌦️' },
  { id: 'animal', name: '젤리 동물 탐험', emoji: '🐾' },
];

const W = 320, H = 180;
const roach = (x, cx, cy, s, col = '#8a5634', t = 0) => {
  x.fillStyle = col;
  x.beginPath(); x.ellipse(cx, cy + s * 0.9, s * 0.7, s * 0.9, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(cx, cy, s * 0.75, 0, Math.PI * 2); x.fill();
  x.strokeStyle = col; x.lineWidth = s * 0.12;
  for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(cx + sd * s * 0.3, cy - s * 0.6); x.quadraticCurveTo(cx + sd * s * 0.6, cy - s * 1.5 + Math.sin(t * 6) * s * 0.1, cx + sd * s * 1.1, cy - s * 1.4); x.stroke(); }
  for (const sd of [-1, 1]) { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + sd * s * 0.3, cy - s * 0.05, s * 0.22, 0, Math.PI * 2); x.fill(); x.fillStyle = '#1d1410'; x.beginPath(); x.arc(cx + sd * s * 0.3, cy, s * 0.12, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#ff9fb2'; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(cx + sd * s * 0.5, cy + s * 0.25, s * 0.13, s * 0.08, 0, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = '#1d1410'; x.lineWidth = s * 0.08; x.beginPath(); x.arc(cx, cy + s * 0.25, s * 0.2, 0.2, Math.PI - 0.2); x.stroke();
};

export class TVScreen {
  constructor(mesh, info = () => ({})) {
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H;
    this.x = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = mesh;
    mesh.material = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    this.info = info;
    this.ch = 0; this.on = true; this.last = 0; this.switchT = 0;
  }
  setChannel(i) { this.ch = ((i % CHANNELS.length) + CHANNELS.length) % CHANNELS.length; this.switchT = 0.4; }
  draw(t, dt = 0.05) {
    if (t - this.last < 0.05) return; // 20fps
    this.last = t;
    const x = this.x;
    if (!this.on) { x.fillStyle = '#111'; x.fillRect(0, 0, W, H); this.tex.needsUpdate = true; return; }
    const id = CHANNELS[this.ch].id;
    this[id](x, t, this.info());
    // 채널 로고
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(W - 92, 6, 86, 18);
    x.fillStyle = '#fff'; x.font = 'bold 11px sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText(`CH ${this.ch + 1} ${CHANNELS[this.ch].emoji}`, W - 10, 15);
    // 채널 바꿀 때 지지직
    if (this.switchT > 0) {
      this.switchT -= dt;
      const img = x.getImageData(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
      x.putImageData(img, 0, 0);
    }
    this.tex.needsUpdate = true;
  }
  news(x, t, info) {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d47a1'); g.addColorStop(1, '#1976d2'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e3f2fd'; x.fillRect(200, 30, 100, 70); x.fillStyle = '#1565c0'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.fillText('속보', 250, 55);
    x.font = '24px sans-serif'; x.fillText(info.newsEmoji || '🏙️', 250, 82);
    x.fillStyle = '#5d4037'; x.fillRect(40, 110, 140, 40);
    roach(x, 110, 70 + Math.sin(t * 2) * 1, 22, '#8a5634', t);
    x.fillStyle = '#fff'; x.fillRect(84, 98, 52, 8);
    // 자막
    x.fillStyle = '#c62828'; x.fillRect(0, H - 42, 64, 22); x.fillStyle = '#fff'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.fillText('JBC 뉴스', 32, H - 31);
    x.fillStyle = '#fff'; x.fillRect(64, H - 42, W - 64, 22); x.fillStyle = '#212121'; x.textAlign = 'left'; x.font = 'bold 12px sans-serif';
    x.fillText(cityText(info.headline || '젤리시티 오늘도 평화롭습니다'), 70, H - 31);
    x.fillStyle = '#263238'; x.fillRect(0, H - 20, W, 20); x.fillStyle = '#ffeb3b'; x.font = '11px sans-serif';
    const ticker = info.ticker || '';
    const tw = x.measureText(ticker).width + W;
    x.fillText(cityText(ticker), W - ((t * 50) % tw), H - 10);
  }
  cartoon(x, t) {
    x.fillStyle = '#81d4fa'; x.fillRect(0, 0, W, H); x.fillStyle = '#aed581'; x.fillRect(0, H - 45, W, 45);
    x.fillStyle = '#fff59d'; x.beginPath(); x.arc(270, 35, 20, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 3; i++) { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(((t * 15 + i * 120) % (W + 60)) - 30, 30 + i * 12, 26, 10, 0, 0, Math.PI * 2); x.fill(); }
    const ax = 60 + ((t * 60) % (W - 40)), bx = ax - 70;
    roach(x, ax, H - 75 - Math.abs(Math.sin(t * 8)) * 25, 16, '#ff9fb2', t);
    roach(x, bx, H - 75 - Math.abs(Math.sin(t * 8 + 1)) * 25, 18, '#7ec8a9', t);
    x.font = 'bold 14px sans-serif'; x.fillStyle = '#e65100'; x.textAlign = 'center'; x.fillText(Math.sin(t) > 0 ? '거기 서~!' : '메롱~ 😝', bx, 30 + Math.sin(t * 3) * 3);
  }
  sports(x, t) {
    x.fillStyle = '#2e7d32'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#388e3c' : '#2e7d32'; x.fillRect(i * 40, 0, 40, H); }
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(10, 10, W - 20, H - 20); x.beginPath(); x.moveTo(W / 2, 10); x.lineTo(W / 2, H - 10); x.stroke(); x.beginPath(); x.arc(W / 2, H / 2, 24, 0, Math.PI * 2); x.stroke();
    x.strokeRect(10, H / 2 - 30, 30, 60); x.strokeRect(W - 40, H / 2 - 30, 30, 60);
    const bx = W / 2 + Math.sin(t * 0.9) * 120, by = H / 2 + Math.sin(t * 1.7) * 55;
    for (let i = 0; i < 10; i++) { const team = i < 5; const px = (team ? W * 0.3 : W * 0.7) + Math.sin(t + i) * 50 + (bx - W / 2) * 0.3; const py = 25 + i % 5 * 32 + Math.cos(t * 1.3 + i) * 10; x.fillStyle = team ? '#e53935' : '#1e88e5'; x.beginPath(); x.arc(px, py, 6, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(bx, by, 4, 0, Math.PI * 2); x.fill();
    const sa = Math.floor(t / 23) % 4, sb = Math.floor(t / 31) % 3;
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(8, 8, 120, 20); x.fillStyle = '#fff'; x.font = 'bold 12px sans-serif'; x.textAlign = 'left';
    x.fillText(`🔴 젤리FC ${sa} : ${sb} 말랑UTD 🔵`, 12, 22);
  }
  cooking(x, t) {
    x.fillStyle = '#fff3e0'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#bcaaa4'; x.fillRect(0, H - 60, W, 60);
    x.fillStyle = '#37474f'; x.beginPath(); x.ellipse(170, H - 62, 70, 16, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#263238'; x.fillRect(235, H - 66, 60, 7);
    for (let i = 0; i < 6; i++) { x.fillStyle = ['#ff7043', '#ffca28', '#66bb6a'][i % 3]; x.beginPath(); x.arc(130 + i * 15, H - 66 - Math.abs(Math.sin(t * 9 + i)) * 18, 6, 0, Math.PI * 2); x.fill(); }
    for (let i = 0; i < 5; i++) { const k = (t * 0.6 + i * 0.2) % 1; x.fillStyle = `rgba(255,255,255,${0.7 - k * 0.7})`; x.beginPath(); x.arc(150 + i * 12 + Math.sin(t + i) * 6, H - 80 - k * 60, 6 + k * 8, 0, Math.PI * 2); x.fill(); }
    roach(x, 60, 70, 20, '#a86b3e', t);
    x.fillStyle = '#fff'; x.fillRect(42, 38, 36, 14); x.beginPath(); x.ellipse(60, 32, 20, 12, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#4e342e'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center'; x.fillText('오늘의 요리: 무지개 볶음밥 🍛', W / 2, 22);
  }
  music(x, t) {
    x.fillStyle = '#1a0033'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) { const a = Math.sin(t * 2 + i) * 0.6; x.fillStyle = ['rgba(255,64,129,.25)', 'rgba(0,229,255,.25)', 'rgba(255,235,59,.25)', 'rgba(124,77,255,.25)'][i]; x.beginPath(); x.moveTo(40 + i * 80, 0); x.lineTo(40 + i * 80 + Math.sin(a) * 160 - 40, H); x.lineTo(40 + i * 80 + Math.sin(a) * 160 + 40, H); x.fill(); }
    for (let i = 0; i < 24; i++) { const h = 10 + Math.abs(Math.sin(t * 6 + i * 0.7) * Math.cos(t * 2.3 + i)) * 60; x.fillStyle = `hsl(${(i * 15 + t * 60) % 360},90%,60%)`; x.fillRect(8 + i * 13, H - h - 8, 10, h); }
    for (let i = 0; i < 3; i++) roach(x, 90 + i * 70, 70 + Math.abs(Math.sin(t * 7 + i)) * -12, 15, ['#ff9fb2', '#ffd54f', '#9fa8ff'][i], t * 3);
    x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.textAlign = 'left'; x.fillText('🎤 걸그룹 "말랑말랑" — 젤리 댄스', 10, 18);
  }
  weather(x, t, info) {
    x.fillStyle = '#e1f5fe'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#a5d6a7'; x.fillRect(30, 30, 160, 130);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { x.fillStyle = '#eceff1'; x.fillRect(38 + i * 30, 38 + j * 30, 22, 22); }
    x.font = '30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText((info.weather || '☀️').split(' ').pop(), 110 + Math.sin(t) * 5, 95);
    roach(x, 250, 90, 18, '#8a5634', t);
    x.fillStyle = '#01579b'; x.font = 'bold 14px sans-serif'; x.fillText(info.weather || '맑음', 250, 140);
    x.font = 'bold 22px sans-serif'; x.fillText(`${info.temp ?? 21}°C`, 250, 160);
    x.textBaseline = 'alphabetic';
  }
  animal(x, t) {
    x.fillStyle = '#ffe0b2'; x.fillRect(0, 0, W, H); x.fillStyle = '#c5e1a5'; x.fillRect(0, H - 50, W, 50);
    x.fillStyle = '#ff7043'; x.beginPath(); x.arc(W - 60, H - 55, 34, Math.PI, 0); x.fill();
    x.font = '34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const list = ['🦁', '🐘', '🦒', '🐆', '🦓'];
    list.forEach((e, i) => x.fillText(e, ((t * (20 + i * 6) + i * 80) % (W + 60)) - 30, H - 40 - Math.abs(Math.sin(t * 3 + i)) * 6));
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#4e342e'; x.font = 'bold 13px sans-serif'; x.fillText('"초원에서 가장 빠른 동물은... 곰돌이 젤리?!"', W / 2, 22);
  }
}
