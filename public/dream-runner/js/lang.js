// 🌐 드림 러너 언어 (랜딩 · 게임 같이 · docs/dream-runner/다국어-작업지시서.md)
//   저장한 선택(localStorage 'dr-lang') → 없으면 브라우저 언어 목록 첫 번째가 한국어면 한국어, 아니면 영어
//   토스 미니앱 · 젤리 서울 러너(한국 대회용)는 한국어 고정
import { TOSS } from '../../shared/js/platform.js';
const KEY = 'dr-lang';
const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
const first = ((typeof navigator !== 'undefined' && ((navigator.languages && navigator.languages[0]) || navigator.language)) || 'ko').toLowerCase();
const fixedKo = TOSS || (typeof window !== 'undefined' && window.SEOUL_WALK);
export const LANG = fixedKo ? 'ko' : saved === 'ko' || saved === 'en' ? saved : first.startsWith('ko') ? 'ko' : 'en';
export const EN = LANG === 'en';
export const t = (ko, en) => (EN ? en : ko);
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch { /* 이번만 */ } location.reload(); }
