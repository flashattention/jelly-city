// 브라우저별 설정 (그래픽 등)
const LS_KEY = 'roachcity.settings';

function safeParse(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }

export const settings = Object.assign({ shadows: true, bugMode: false, crosshairColor: '#ffffff', music: true, musicVol: 0.6, sfx: true, sfxVol: 0.8 }, safeParse(localStorage.getItem(LS_KEY)));

export function saveSettings() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch { /* 무시 */ }
}
