// 휴대폰 앱들: 퀘스트, 카메라, 갤러리, 인스타그램, 연락처, 문자, 112, 건의함
import { escapeHtml, brand } from '../../shared/js/utils.js';
import { questDef } from './quests.js';
import { expNeed, levelStats } from './level.js';
import * as THREE from 'three';
import { Roach } from '../../shared/js/roach.js';

// 캐릭터 사진 (튄더 카드용)
let thumbR = null, thumbScene = null, thumbCam = null;
const thumbCache = new Map();
export function roachThumb(pr) {
  const key = JSON.stringify([pr.color, pr.look, pr.accessories]);
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbR) {
    thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbR.setSize(240, 320); thumbR.outputColorSpace = THREE.SRGBColorSpace;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight('#fff6e8', '#c9a28a', 1.4));
    const dl = new THREE.DirectionalLight('#ffffff', 1.5); dl.position.set(2, 4, 5); thumbScene.add(dl);
    thumbCam = new THREE.PerspectiveCamera(30, 240 / 320, 0.1, 50); thumbCam.position.set(0, 1.5, 6.2); thumbCam.lookAt(0, 1.15, 0);
  }
  const r = new Roach({ own: true, seed: pr.name, color: pr.color, age: 25, gender: pr.gender, look: pr.look, accessories: pr.accessories || [] });
  r.root.rotation.y = 0.3; r.setEmotion('happy', 99); r.update(0.016, 0);
  thumbScene.add(r.root); thumbR.render(thumbScene, thumbCam); thumbScene.remove(r.root);
  const url = thumbR.domElement.toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}
const pic = (o) => (o.photo ? `/photos/${o.photo}.jpg` : roachThumb(o));

const $ = (id) => document.getElementById(id);
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};

export async function api(g, path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${g.session}` },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const PHONE_APPS = {
  quests(ui, body, g) {
    const S = g.stats;
    const L = S.level || 1, ls = levelStats(L);
    const list = S.quests?.list || [];
    body.innerHTML = `<div class="profile-big">
      <h3>⭐ Lv.${L} <small style="font-size:13px;color:var(--ink-soft)">경험치 ${S.exp || 0} / ${expNeed(L)}</small></h3>
      <div class="xpbig"><div style="width:${Math.min(100, ((S.exp || 0) / expNeed(L)) * 100)}%"></div></div>
      ❤️ 최대 체력 <b>${ls.maxHp}</b> · 💪 파워 <b>×${ls.dmg.toFixed(2)}</b> · 🎯 명중 <b>+${Math.round((1 - ls.acc) * 100)}%</b> · 💥 치명타 <b>+${Math.round(ls.crit * 100)}%</b> · 💧 마나 <b>${ls.mana}</b><br>
      <small>레벨에 끝은 없어요. 대신 올라갈수록 필요한 경험치가 많아져요. 일하기 · 퀘스트 · 무릉도장 · 사격장 · 플레이어 쓰러뜨리기로 경험치를 얻어요.</small>
    </div>
    <div class="profile-big" style="margin-top:12px"><h3>📋 오늘의 퀘스트 <small style="font-size:12px;color:var(--ink-soft)">${g.day() + 1}일차 · 날이 바뀌면 새 퀘스트</small></h3>
      ${list.map((q) => { const d = questDef(q.id); return `<div class="qrow ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '⬜'} ${escapeHtml(d.text)}</span><span class="qr">${q.done ? '완료' : `${Math.floor(q.p)}/${d.n}`} · +${d.xp}EXP ₩${d.money}</span></div>`; }).join('')}
    </div>`;
  },

  camera(ui, body, g) {
    body.innerHTML = `<div class="profile-big" style="text-align:center">
      <h3>📷 카메라</h3>
      <p>지금 화면 그대로 사진을 찍어 갤러리에 저장해요. 게임 중에도 <kbd>P</kbd> 키로 바로 찍을 수 있어요.</p>
      <button class="btn" id="cam-shot">📸 지금 찍기</button>
      <button class="btn" id="cam-selfie">🤳 셀카 모드로 찍기</button>
      <button class="btn ghost" id="cam-fp">👀 1인칭으로 찍기</button>
    </div>`;
    $('cam-shot').onclick = () => { ui.closePhone(); setTimeout(() => g.takePhoto(), 250); };
    $('cam-selfie').onclick = () => { ui.closePhone(); g.selfie(); };
    $('cam-fp').onclick = () => { ui.closePhone(); const was = g.player.fp; g.player.fp = true; setTimeout(() => g.takePhoto().finally(() => { g.player.fp = was; }), 300); };
  },

  async gallery(ui, body, g) {
    body.innerHTML = '<div class="profile-big">불러오는 중...</div>';
    try {
      const { list } = await api(g, `/api/photos?char=${g.char}`);
      body.innerHTML = `<div class="gallery-head">🖼️ 내 사진 ${list.length}장 <small>사진을 누르면 크게 보고 인스타에 올릴 수 있어요</small></div>
        <div class="gallery">${list.map((p) => `<div class="ph" data-id="${p.id}"><img loading="lazy" src="/photos/${p.id}.jpg">${p.posted ? `<span class="tagp">📸 ❤️${p.likes}</span>` : ''}</div>`).join('') || '<p>아직 사진이 없어요. 📷 카메라로 찍어보세요!</p>'}</div>`;
      body.querySelectorAll('.ph').forEach((el) => { el.onclick = () => PHONE_APPS.viewPhoto(ui, body, g, list.find((p) => p.id === el.dataset.id)); });
    } catch (e) { body.innerHTML = `<div class="profile-big">사진을 불러오지 못했어요 (${escapeHtml(e.message)})</div>`; }
  },
  viewPhoto(ui, body, g, p) {
    body.innerHTML = `<div class="photo-view"><img src="/photos/${p.id}.jpg"><div class="pv-meta">${new Date(p.t).toLocaleString('ko-KR')}${p.posted ? ` · 📸 인스타 게시됨 · ❤️ ${p.likes}` : ''}</div>
      ${p.posted ? '' : '<input id="pv-cap" class="search" maxlength="150" placeholder="인스타그램에 쓸 글 (해시태그도 좋아요 #젤리시티)">'}
      <div>${p.posted ? '' : '<button class="btn" id="pv-post">📸 인스타에 올리기</button>'}<a class="btn ghost" href="/photos/${p.id}.jpg" download="roachcity-${p.id}.jpg">⬇️ 저장</a><button class="btn ghost" id="pv-del">🗑️ 삭제</button><button class="btn ghost" id="pv-back">← 갤러리</button></div></div>`;
    $('pv-cap')?.addEventListener('keydown', (e) => e.stopPropagation());
    $('pv-back').onclick = () => PHONE_APPS.gallery(ui, body, g);
    $('pv-del').onclick = async () => { if (!(await ui.confirm('이 사진을 지울까요?', '🗑️ 삭제'))) return; await api(g, `/api/photo/${p.id}?char=${g.char}`, { method: 'DELETE' }); PHONE_APPS.gallery(ui, body, g); };
    if ($('pv-post')) $('pv-post').onclick = async () => {
      try { await api(g, '/api/insta', { method: 'POST', body: { char: g.char, id: p.id, caption: $('pv-cap').value } }); g.questEvent('insta'); ui.toast('📸 인스타그램에 올렸어요!'); ui.openPhone('insta'); } catch (e) { ui.toast(e.message); }
    };
  },

  // ---------------- 인스타그램: 피드 · 팔로잉 · DM · 프로필 · 댓글 ----------------
  async insta(ui, body, g) {
    const tab = ui.igTab || 'all';
    const av = brand.bug ? '🪳' : '🐻';
    const tabs = `<div class="td-tabs ig-tabs"><button class="${tab === 'all' ? 'on' : ''}" data-ig="all">🏠 피드</button><button class="${tab === 'following' ? 'on' : ''}" data-ig="following">👥 팔로잉</button><button class="${tab === 'dm' ? 'on' : ''}" data-ig="dm">✉️ DM${g.igUnread ? ` (${g.igUnread})` : ''}</button><button class="${tab === 'me' ? 'on' : ''}" data-ig="me">👤 나</button></div>`;
    const head = `<div class="insta-head">📸 <b>Jellystagram</b> <small>젤리시티 사람들의 사진</small></div>`;
    const go = (t, extra = {}) => { Object.assign(ui, { igTab: t, igUser: null, igDm: null, igList: null }, extra); PHONE_APPS.insta(ui, body, g); };
    const bindTabs = () => body.querySelectorAll('[data-ig]').forEach((b) => { b.onclick = () => go(b.dataset.ig); });
    const noKeys = (el) => el.addEventListener('keydown', (e) => e.stopPropagation());
    const fail = (e) => { body.innerHTML = head + tabs + `<div class="profile-big">불러오지 못했어요 (${escapeHtml(e.message)})</div>`; bindTabs(); };
    body.innerHTML = head + tabs + '<div class="profile-big">불러오는 중...</div>';
    bindTabs();
    // 안 읽은 DM 수 (탭 배지용)
    if (tab !== 'dm') api(g, `/api/dm?char=${g.char}`).then(({ threads }) => { const n = threads.reduce((a, x) => a + x.unread, 0); if (n !== (g.igUnread || 0)) { g.igUnread = n; const b = body.querySelector('[data-ig="dm"]'); if (b) b.textContent = `✉️ DM${n ? ` (${n})` : ''}`; } }).catch(() => {});

    const comment = (c, pid) => `<div class="ig-c"><b data-user="${c.by}">${escapeHtml(c.name)}</b> ${escapeHtml(c.text)} <small>${ago(c.t)}</small>${c.canDel ? ` <button class="ig-x" data-cdel="${c.id}" data-pid="${pid}" title="댓글 삭제">✕</button>` : ''}</div>`;
    const followBtn = (tok, on) => `<button class="ig-follow ${on ? 'on' : ''}" data-follow="${tok}">${on ? '팔로잉' : '팔로우'}</button>`;
    const post = (p) => `<div class="post"><div class="ph-h"><span class="av">${av}</span><b class="ig-name" data-user="${p.owner}">${escapeHtml(p.name)}</b> <small>Lv.${p.level} · ${ago(p.t)}</small>${p.mine ? '' : followBtn(p.owner, p.following)}</div>
      <img loading="lazy" src="/photos/${p.id}.jpg">
      <div class="ph-a"><button class="like ${p.liked ? 'on' : ''}" data-id="${p.id}">${p.liked ? '❤️' : '🤍'} <span>${p.likes}</span></button><button class="like" data-cfocus="${p.id}" title="댓글">💬 <span id="cn-${p.id}">${p.commentCount}</span></button>${p.mine ? '' : `<button class="like" data-dm="${p.owner}" title="DM 보내기">✉️</button>`}</div>
      ${p.caption ? `<div class="ph-c"><b>${escapeHtml(p.name)}</b> ${escapeHtml(p.caption)}</div>` : ''}
      <div class="ig-cmts" id="cm-${p.id}">${p.commentCount > p.comments.length ? `<button class="ig-more" data-more="${p.id}">댓글 ${p.commentCount}개 모두 보기</button>` : ''}${p.comments.map((c) => comment(c, p.id)).join('')}</div>
      <div class="addrow ig-cadd"><input data-cin="${p.id}" maxlength="200" placeholder="댓글 달기..."><button class="btn mini" data-csend="${p.id}">게시</button></div></div>`;
    const showComments = (pid, list) => {
      const box = $(`cm-${pid}`); if (box) box.innerHTML = list.map((c) => comment(c, pid)).join('');
      const n = $(`cn-${pid}`); if (n) n.textContent = list.length;
      bindPosts(box);
    };
    // 게시물 안의 버튼들 (피드·프로필 공용)
    const bindPosts = (root) => {
      if (!root) return;
      root.querySelectorAll('[data-user]').forEach((el) => { el.onclick = () => go(el.dataset.user === g.char ? 'me' : 'profile', { igUser: el.dataset.user, igBack: tab === 'profile' ? ui.igBack : tab }); });
      root.querySelectorAll('[data-dm]').forEach((el) => { el.onclick = () => go('dm', { igDm: el.dataset.dm }); });
      root.querySelectorAll('.like[data-id]').forEach((b) => {
        b.onclick = async () => {
          try {
            const r = await api(g, '/api/insta/like', { method: 'POST', body: { char: g.char, id: b.dataset.id } });
            const on = !b.classList.contains('on');
            b.classList.toggle('on', on);
            b.innerHTML = `${on ? '❤️' : '🤍'} <span>${r.likes}</span>`;
          } catch (e) { ui.toast(e.message); }
        };
      });
      root.querySelectorAll('[data-follow]').forEach((b) => {
        b.onclick = async () => {
          try {
            const r = await api(g, '/api/insta/follow', { method: 'POST', body: { char: g.char, target: b.dataset.follow } });
            body.querySelectorAll(`[data-follow="${b.dataset.follow}"]`).forEach((x) => { x.classList.toggle('on', r.following); x.textContent = r.following ? '팔로잉' : '팔로우'; });
            const fc = $('ig-followers'); if (fc && ui.igUser === b.dataset.follow) fc.textContent = r.followers;
            ui.toast(r.following ? '👥 팔로우했어요' : '팔로우를 취소했어요');
          } catch (e) { ui.toast(e.message); }
        };
      });
      root.querySelectorAll('[data-cfocus]').forEach((b) => { b.onclick = () => body.querySelector(`[data-cin="${b.dataset.cfocus}"]`)?.focus(); });
      root.querySelectorAll('[data-more]').forEach((b) => { b.onclick = async () => { try { showComments(b.dataset.more, (await api(g, `/api/insta/comments?char=${g.char}&id=${b.dataset.more}`)).comments); } catch (e) { ui.toast(e.message); } }; });
      root.querySelectorAll('[data-cdel]').forEach((b) => {
        b.onclick = async () => {
          if (!(await ui.confirm('이 댓글을 지울까요?', '🗑️ 삭제'))) return;
          try { showComments(b.dataset.pid, (await api(g, '/api/insta/comment/del', { method: 'POST', body: { char: g.char, id: b.dataset.pid, cid: b.dataset.cdel } })).comments); } catch (e) { ui.toast(e.message); }
        };
      });
      root.querySelectorAll('[data-cin]').forEach((inp) => {
        const pid = inp.dataset.cin;
        const send = async () => {
          const text = inp.value.trim(); if (!text) return;
          try { showComments(pid, (await api(g, '/api/insta/comment', { method: 'POST', body: { char: g.char, id: pid, text } })).comments); inp.value = ''; } catch (e) { ui.toast(e.message); }
        };
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) send(); });
        root.querySelector(`[data-csend="${pid}"]`).onclick = send;
      });
    };

    try {
      // 피드 (전체 / 팔로잉)
      if (tab === 'all' || tab === 'following') {
        const { feed } = await api(g, `/api/insta?char=${g.char}&mode=${tab}`);
        const empty = tab === 'following' ? '<p>아직 팔로우한 사람의 게시물이 없어요. 🏠 피드에서 마음에 드는 사람을 팔로우해 보세요!</p>' : '<p>아직 게시물이 없어요. 갤러리에서 사진을 올려보세요!</p>';
        body.innerHTML = head + tabs + `<div class="feed">${feed.map(post).join('') || empty}</div>`;
        bindTabs(); bindPosts(body);
        return;
      }
      // 프로필 (나 / 다른 사람)
      if (tab === 'me' || tab === 'profile') {
        const user = tab === 'me' ? g.char : ui.igUser;
        if (ui.igList) {
          const { list } = await api(g, `/api/insta/follows?user=${user}&which=${ui.igList}`);
          body.innerHTML = head + `<div class="insta-head"><button class="btn mini ghost" id="ig-back">←</button> <b>${ui.igList === 'followers' ? '팔로워' : '팔로잉'}</b> <small>${list.length}명</small></div>
            <div class="itemlist">${list.map((u) => `<div class="item thread" data-user="${u.token}"><div class="ic">${av}</div><div class="info"><b>${escapeHtml(u.name)}</b><small>Lv.${u.level}</small></div></div>`).join('') || '<div style="padding:12px">아직 아무도 없어요</div>'}</div>`;
          $('ig-back').onclick = () => { ui.igList = null; PHONE_APPS.insta(ui, body, g); };
          body.querySelectorAll('[data-user]').forEach((el) => { el.onclick = () => go(el.dataset.user === g.char ? 'me' : 'profile', { igUser: el.dataset.user, igBack: tab === 'profile' ? ui.igBack : tab }); });
          return;
        }
        const pr = await api(g, `/api/insta/profile?char=${g.char}&user=${user}`);
        body.innerHTML = head + (tab === 'me' ? tabs : `<div class="insta-head"><button class="btn mini ghost" id="ig-back">←</button></div>`) + `<div class="profile-big ig-prof">
            <div class="ig-ph"><span class="ig-big">${av}</span><div><b>${escapeHtml(pr.name)}</b> ${pr.online ? '<span style="color:#4cd964">● 접속 중</span>' : ''}<br><small>⭐ Lv.${pr.level} · ${escapeHtml(pr.job || '무직')}</small></div></div>
            <div class="ig-stats"><div><b>${pr.posts.length}</b><small>게시물</small></div><div class="ig-link" data-list="followers"><b id="ig-followers">${pr.followers}</b><small>팔로워</small></div><div class="ig-link" data-list="following"><b>${pr.followingCount}</b><small>팔로잉</small></div></div>
            ${pr.mine ? '' : `<div class="ig-acts">${followBtn(pr.token, pr.following)}<button class="btn mini" data-dm="${pr.token}">✉️ 메시지</button></div>`}
          </div>
          <div class="feed" style="margin-top:10px">${pr.posts.map(post).join('') || `<p>${pr.mine ? '아직 올린 사진이 없어요. 📷 카메라로 찍고 갤러리에서 올려보세요!' : '아직 올린 사진이 없어요.'}</p>`}</div>`;
        if (tab === 'me') bindTabs();
        else $('ig-back').onclick = () => go(ui.igBack || 'all');
        body.querySelectorAll('[data-list]').forEach((el) => { el.onclick = () => { ui.igList = el.dataset.list; PHONE_APPS.insta(ui, body, g); }; });
        bindPosts(body);
        return;
      }
      // DM 목록
      if (!ui.igDm) {
        const { threads } = await api(g, `/api/dm?char=${g.char}`);
        g.igUnread = threads.reduce((a, x) => a + x.unread, 0);
        const { list: fol } = await api(g, `/api/insta/follows?user=${g.char}&which=following`);
        const fresh = fol.filter((u) => !threads.some((t) => t.token === u.token));
        body.innerHTML = head + tabs + `<div class="itemlist">${threads.map((t) => `<div class="item thread" data-dm="${t.token}"><div class="ic">${av}</div><div class="info"><b>${escapeHtml(t.name)}${t.unread ? ` <span class="badge">${t.unread}</span>` : ''}</b><small>${t.lastMine ? '나: ' : ''}${escapeHtml(t.last.slice(0, 40))} · ${ago(t.t)}</small></div></div>`).join('') || '<div style="padding:12px">아직 주고받은 DM이 없어요. 게시물이나 프로필의 ✉️ 를 눌러 보내보세요</div>'}</div>
          ${fresh.length ? `<div class="profile-big" style="margin-top:10px"><b>새 메시지</b> <small>팔로우한 사람</small><div style="margin-top:6px">${fresh.map((u) => `<button class="btn mini" data-dm="${u.token}">✉️ ${escapeHtml(u.name)}</button>`).join(' ')}</div></div>` : ''}`;
        bindTabs();
        body.querySelectorAll('[data-dm]').forEach((el) => { el.onclick = () => go('dm', { igDm: el.dataset.dm }); });
        return;
      }
      // DM 대화
      const th = await api(g, `/api/dm/thread?char=${g.char}&with=${ui.igDm}`);
      body.innerHTML = `<div class="insta-head"><button class="btn mini ghost" id="dm-back">←</button> ${av} <b class="ig-name" data-user="${th.other.token}">${escapeHtml(th.other.name)}</b> <small>Lv.${th.other.level}</small></div>
        <div class="smslog" id="dmlog">${th.msgs.map((m) => `<div class="sm ${m.mine ? 'me' : ''}">${escapeHtml(m.text)}<small>${ago(m.t)}</small></div>`).join('') || '<small>첫 메시지를 보내보세요 ✉️</small>'}</div>
        <div class="addrow"><input id="dm-in" maxlength="300" placeholder="메시지 보내기..."><button class="btn" id="dm-send">전송</button></div>`;
      $('dmlog').scrollTop = 1e9;
      $('dm-back').onclick = () => go('dm');
      body.querySelector('[data-user]').onclick = () => go('profile', { igUser: th.other.token, igBack: 'dm' });
      const send = async () => {
        const text = $('dm-in').value.trim(); if (!text) return;
        try { await api(g, '/api/dm', { method: 'POST', body: { char: g.char, to: ui.igDm, text } }); PHONE_APPS.insta(ui, body, g); } catch (e) { ui.toast(e.message); }
      };
      noKeys($('dm-in'));
      $('dm-in').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) send(); });
      $('dm-send').onclick = send;
      $('dm-in').focus();
    } catch (e) { fail(e); }
  },

  contacts(ui, body, g) {
    const near = [...g.players.list.values()].filter((o) => o.visible && o.pos.distanceTo(g.player.pos) < 15);
    body.innerHTML = `<div class="profile-big"><h3>📞 내 번호 <span class="mynum">${escapeHtml(g.phone || '')}</span></h3>
      <div class="addrow"><input id="ct-num" placeholder="010-0000-0000" maxlength="13"><input id="ct-name" placeholder="이름 (비우면 자동)" maxlength="12"><button class="btn" id="ct-add">저장</button></div>
      ${near.length ? `<div style="margin-top:8px">📡 근처 플레이어와 번호 교환: ${near.map((o) => `<button class="btn mini" data-req="${o.id}">${escapeHtml(o.name)}</button>`).join('')}</div>` : '<small>근처에 있는 플레이어와 번호를 교환할 수도 있어요</small>'}
    </div>
    <div class="itemlist" style="margin-top:10px">${(g.contacts || []).map((c) => `<div class="item"><div class="ic">👤</div><div class="info"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.num)}</small></div><div class="acts"><button class="btn mini" data-sms="${escapeHtml(c.num)}">💬 문자</button><button class="btn mini ghost" data-del="${escapeHtml(c.num)}">삭제</button></div></div>`).join('') || '<div style="padding:12px">저장한 연락처가 없어요</div>'}</div>`;
    for (const id of ['ct-num', 'ct-name']) $(id).addEventListener('keydown', (e) => e.stopPropagation());
    $('ct-num').oninput = (e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 11); e.target.value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d; };
    $('ct-add').onclick = () => { g.net.send({ t: 'contactAdd', num: $('ct-num').value.trim(), name: $('ct-name').value.trim() }); };
    body.querySelectorAll('[data-req]').forEach((b) => { b.onclick = () => g.net.send({ t: 'numReq', id: +b.dataset.req }); });
    body.querySelectorAll('[data-sms]').forEach((b) => { b.onclick = () => { ui.smsThread = b.dataset.sms; ui.openPhone('sms'); }; });
    body.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => g.net.send({ t: 'contactDel', num: b.dataset.del }); });
  },

  sms(ui, body, g) {
    const name = (num) => g.contacts?.find((c) => c.num === num)?.name || num;
    const threads = new Map();
    for (const m of g.sms || []) { const other = m.mine ? m.to : m.from; if (!threads.has(other)) threads.set(other, []); threads.get(other).push(m); }
    const cur = ui.smsThread;
    if (!cur) {
      const rows = [...threads.entries()].sort((a, b) => b[1].at(-1).t - a[1].at(-1).t);
      body.innerHTML = `<div class="insta-head">💬 <b>문자</b> <small>연락처에서 💬 문자를 눌러 새 대화를 시작하세요</small></div>
        <div class="itemlist">${rows.map(([num, list]) => { const last = list.at(-1); const unread = list.filter((m) => !m.mine && !m.read).length; return `<div class="item thread" data-num="${escapeHtml(num)}"><div class="ic">💬</div><div class="info"><b>${escapeHtml(name(num))}${unread ? ` <span class="badge">${unread}</span>` : ''}</b><small>${escapeHtml(last.text.slice(0, 40))} · ${ago(last.t)}</small></div></div>`; }).join('') || '<div style="padding:12px">주고받은 문자가 없어요</div>'}</div>`;
      body.querySelectorAll('.thread').forEach((el) => { el.onclick = () => { ui.smsThread = el.dataset.num; PHONE_APPS.sms(ui, body, g); }; });
      return;
    }
    const list = threads.get(cur) || [];
    for (const m of list) if (!m.mine) m.read = true;
    g.net.send({ t: 'smsRead', num: cur });
    body.innerHTML = `<div class="insta-head"><button class="btn mini ghost" id="sms-back">←</button> 💬 <b>${escapeHtml(name(cur))}</b> <small>${escapeHtml(cur)}</small></div>
      <div class="smslog" id="smslog">${list.map((m) => `<div class="sm ${m.mine ? 'me' : ''}">${escapeHtml(m.text)}<small>${ago(m.t)}</small></div>`).join('') || '<small>첫 문자를 보내보세요</small>'}</div>
      <div class="addrow"><input id="sms-in" maxlength="200" placeholder="문자 보내기..."><button class="btn" id="sms-send">전송</button></div>`;
    $('smslog').scrollTop = 1e9;
    $('sms-back').onclick = () => { ui.smsThread = null; PHONE_APPS.sms(ui, body, g); };
    const send = () => { const t = $('sms-in').value.trim(); if (!t) return; g.net.send({ t: 'sms', to: cur, text: t }); $('sms-in').value = ''; g.questEvent('sms'); };
    $('sms-in').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) send(); });
    $('sms-send').onclick = send;
    $('sms-in').focus();
  },

  // ---------------- 튄더 ----------------
  tinder(ui, body, g) {
    const tab = ui.tdTab || 'swipe';
    const tabs = `<div class="td-tabs"><button class="${tab === 'swipe' ? 'on' : ''}" data-td="swipe">💘 둘러보기</button><button class="${tab === 'matches' ? 'on' : ''}" data-td="matches">💬 매칭${g.tdUnread ? ` (${g.tdUnread})` : ''}</button><button class="${tab === 'profile' ? 'on' : ''}" data-td="profile">👤 내 프로필</button></div>`;
    const bindTabs = () => body.querySelectorAll('[data-td]').forEach((b) => { b.onclick = () => { ui.tdTab = b.dataset.td; ui.tdChat = null; PHONE_APPS.tinder(ui, body, g); }; });
    if (tab === 'swipe') {
      if (!g.tdCards) { g.net.send({ t: 'tdCards' }); body.innerHTML = tabs + '<p>불러오는 중...</p>'; bindTabs(); return; }
      const c = g.tdCards[0];
      if (!c) { body.innerHTML = tabs + `<div class="profile-big" style="text-align:center">🔥<br>지금은 더 볼 사람이 없어요.<br><small>새 플레이어가 오면 다시 떠요</small><br><button class="btn" id="td-reload">새로고침</button></div>`; bindTabs(); $('td-reload').onclick = () => { g.tdCards = null; PHONE_APPS.tinder(ui, body, g); }; return; }
      body.innerHTML = tabs + `<div class="td-card" id="td-card"><img class="td-img" src="${pic(c)}"><span class="stamp like">LIKE</span><span class="stamp nope">NOPE</span>
        <div class="td-info"><b>${escapeHtml(c.name)}</b> ${c.age} ${c.online ? '<span style="color:#4cd964">● 접속 중</span>' : ''}<small>⭐ Lv.${c.level} · ${c.gender === '남' ? '♂' : '♀'} · ${escapeHtml(c.job || '무직')} · ${escapeHtml(c.personality || '')}</small>${c.bio ? `<small>“${escapeHtml(c.bio)}”</small>` : ''}<small>${(c.badges || []).slice(0, 4).map(escapeHtml).join(' ')}</small></div></div>
        <div class="td-btns"><button id="td-no" title="넘기기">✖️</button><button id="td-yes" title="좋아요">💚</button></div>`;
      bindTabs();
      const card = $('td-card');
      const swipe = (like) => { card.style.transform = `translateX(${like ? 420 : -420}px) rotate(${like ? 25 : -25}deg)`; g.net.send({ t: 'tdSwipe', token: c.token, like }); setTimeout(() => { g.tdCards.shift(); PHONE_APPS.tinder(ui, body, g); }, 230); };
      $('td-no').onclick = () => swipe(false); $('td-yes').onclick = () => swipe(true);
      let sx = null;
      card.onpointerdown = (e) => { sx = e.clientX; card.style.transition = 'none'; card.setPointerCapture(e.pointerId); };
      card.onpointermove = (e) => { if (sx === null) return; const dx = e.clientX - sx; card.style.transform = `translateX(${dx}px) rotate(${dx / 12}deg)`; card.querySelector('.like').style.opacity = Math.max(0, dx / 90); card.querySelector('.nope').style.opacity = Math.max(0, -dx / 90); };
      card.onpointerup = (e) => { const dx = e.clientX - sx; sx = null; card.style.transition = ''; if (Math.abs(dx) > 90) swipe(dx > 0); else { card.style.transform = ''; card.querySelectorAll('.stamp').forEach((x) => { x.style.opacity = 0; }); } };
      return;
    }
    if (tab === 'matches' && !ui.tdChat) {
      g.net.send({ t: 'tdMatches' });
      const list = g.tdMatches || [];
      body.innerHTML = tabs + (list.map((m) => `<div class="td-match" data-mid="${m.mid}"><img src="${pic(m.other)}"><div><b>${escapeHtml(m.other.name)}</b> ${m.other.online ? '<span style="color:#4cd964">●</span>' : ''}<br><small>${escapeHtml(m.last || '매칭됐어요! 먼저 인사해 보세요 👋')}</small></div>${m.unread ? `<span class="unread">${m.unread}</span>` : ''}</div>`).join('') || '<div class="profile-big" style="text-align:center">아직 매칭이 없어요.<br>서로 💚를 누르면 매칭돼요!</div>');
      bindTabs();
      body.querySelectorAll('[data-mid]').forEach((el) => { el.onclick = () => { ui.tdChat = el.dataset.mid; g.tdMsgs = null; g.net.send({ t: 'tdMsgs', mid: el.dataset.mid }); PHONE_APPS.tinder(ui, body, g); }; });
      return;
    }
    if (tab === 'matches') {
      const other = g.tdOther;
      const msgs = g.tdMsgs || [];
      body.innerHTML = `<div class="insta-head"><button class="btn mini ghost" id="tdc-back">←</button> ${other ? `<b>${escapeHtml(other.name)}</b> <small>Lv.${other.level}</small>` : ''}</div>
        <div class="smslog" id="tdlog">${msgs.map((m) => { const mine = m.from === g.char; if (m.contact) return `<div class="sm ${mine ? 'me' : ''}"><div class="td-contact">📇 <b>${escapeHtml(m.contact.name)}</b><br>${escapeHtml(m.contact.num)}${mine ? '' : `<br><button class="btn mini" data-save="${escapeHtml(m.contact.num)}" data-nm="${escapeHtml(m.contact.name)}">📲 연락처 저장</button>`}</div><small>${ago(m.t)}</small></div>`; return `<div class="sm ${mine ? 'me' : ''}">${escapeHtml(m.text)}<small>${ago(m.t)}</small></div>`; }).join('') || '<small>💘 매칭됐어요! 대화를 시작해 보세요</small>'}</div>
        <div class="addrow"><input id="td-in" maxlength="300" placeholder="메시지..."><button class="btn" id="td-send">전송</button></div>
        <button class="btn ghost" id="td-card-send" style="margin-top:6px;width:100%">📇 내 연락처 보내기</button>`;
      $('tdlog').scrollTop = 1e9;
      $('tdc-back').onclick = () => { ui.tdChat = null; PHONE_APPS.tinder(ui, body, g); };
      const send = () => { const t = $('td-in').value.trim(); if (!t) return; g.net.send({ t: 'tdSend', mid: ui.tdChat, text: t }); $('td-in').value = ''; };
      $('td-in').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) send(); });
      $('td-send').onclick = send;
      $('td-card-send').onclick = () => g.net.send({ t: 'tdSend', mid: ui.tdChat, contact: true });
      body.querySelectorAll('[data-save]').forEach((b) => { b.onclick = () => { g.net.send({ t: 'contactAdd', num: b.dataset.save, name: b.dataset.nm }); b.textContent = '✅ 저장됨'; b.disabled = true; }; });
      return;
    }
    // 내 프로필
    const me = g.tdMe || {};
    body.innerHTML = tabs + `<div class="td-card"><img class="td-img" src="${pic({ ...g.profile, photo: me.photo })}"><div class="td-info"><b>${escapeHtml(g.profile.name)}</b> ${g.profile.age}<small>⭐ Lv.${g.stats.level || 1} · ${escapeHtml(g.profile.jobName || '무직')}</small></div></div>
      <div class="profile-big" style="margin-top:10px"><b>한 줄 소개</b><textarea id="td-bio" maxlength="120" rows="3" placeholder="예) 치킨 좋아하는 무릉도장 고수 🍗">${escapeHtml(me.bio || '')}</textarea>
      <b>프로필 사진</b><div class="gallery" id="td-photos"><div class="ph" data-ph="">${brand.bug ? '🪳' : '🐻'}<small>캐릭터</small></div></div>
      <button class="btn" id="td-save" style="margin-top:8px">저장</button></div>`;
    bindTabs();
    $('td-bio').addEventListener('keydown', (e) => e.stopPropagation());
    let photo = me.photo || null;
    api(g, `/api/photos?char=${g.char}`).then(({ list }) => {
      $('td-photos').innerHTML = `<div class="ph ${!photo ? 'on' : ''}" data-ph="" style="display:grid;place-items:center;font-size:34px;background:#ffe0e8">${brand.bug ? '🪳' : '🐻'}</div>` + list.map((p) => `<div class="ph ${photo === p.id ? 'on' : ''}" data-ph="${p.id}"><img src="/photos/${p.id}.jpg"></div>`).join('');
      body.querySelectorAll('[data-ph]').forEach((el) => { el.onclick = () => { photo = el.dataset.ph || null; body.querySelectorAll('[data-ph]').forEach((x) => x.classList.toggle('on', x === el)); }; });
    }).catch(() => {});
    $('td-save').onclick = () => { g.net.send({ t: 'tdProfile', bio: $('td-bio').value, photo }); ui.toast('🔥 튄더 프로필을 저장했어요'); };
  },

  police(ui, body, g) {
    const list = g.reportable || [];
    body.innerHTML = `<div class="profile-big"><h3>🚨 112 신고</h3>
      <p>경찰은 누군가 신고해야만 출동해요. 시민(NPC)은 맞거나 화나면 스스로 112에 전화하고, 플레이어는 여기서 나를 공격한 사람을 신고할 수 있어요 (최근 10분).</p>
      ${list.length ? list.map((r) => `<div class="item"><div class="ic">😠</div><div class="info"><b>${escapeHtml(r.name)}</b><small>사유: ${escapeHtml(r.reason)}</small></div><div class="acts"><button class="btn mini" data-rep="${r.token}">🚓 신고하기</button></div></div>`).join('') : '<div style="padding:10px">최근에 나를 공격한 플레이어가 없어요 🙂</div>'}
    </div>`;
    body.querySelectorAll('[data-rep]').forEach((b) => { b.onclick = () => { g.net.send({ t: 'report112', token: b.dataset.rep }); g.reportable = (g.reportable || []).filter((r) => r.token !== b.dataset.rep); PHONE_APPS.police(ui, body, g); }; });
  },

  feedback(ui, body, g) {
    body.innerHTML = `<div class="profile-big"><h3>💡 개발자에게 건의하기</h3>
      <p>버그, 원하는 기능, 불편한 점 무엇이든 적어주세요. 개발자가 모두 모아서 확인해요 🙏</p>
      <textarea id="fb-text" maxlength="2000" rows="7" placeholder="예) 사격장 표적이 너무 빨라요 / 고양이 귀 모자 더 만들어주세요!"></textarea>
      <button class="btn" id="fb-send">보내기 📮</button></div>`;
    $('fb-text').addEventListener('keydown', (e) => e.stopPropagation());
    $('fb-send').onclick = async () => {
      try { await api(g, '/api/feedback', { method: 'POST', body: { char: g.char, text: $('fb-text').value } }); ui.toast('📮 건의가 전달됐어요. 고마워요!'); $('fb-text').value = ''; } catch (e) { ui.toast(e.message); }
    };
  },

  async admin(ui, body, g) {
    body.innerHTML = '<div class="profile-big">불러오는 중...</div>';
    try {
      const { list } = await api(g, '/api/feedback');
      body.innerHTML = `<div class="insta-head">📮 <b>건의함</b> <small>총 ${list.length}건 · 미처리 ${list.filter((f) => !f.done).length}건</small></div>
        <div class="itemlist">${list.map((f) => `<div class="item ${f.done ? 'fbdone' : ''}"><div class="info"><b>${escapeHtml(f.char || f.user)} <small>${escapeHtml(f.email)} · ${new Date(f.t).toLocaleString('ko-KR')}</small></b><div class="fbtext">${escapeHtml(f.text)}</div></div><div class="acts"><button class="btn mini ${f.done ? 'ghost' : ''}" data-done="${f.id}">${f.done ? '되돌리기' : '✅ 처리'}</button></div></div>`).join('') || '<div style="padding:12px">아직 건의가 없어요</div>'}</div>`;
      body.querySelectorAll('[data-done]').forEach((b) => { b.onclick = async () => { await api(g, `/api/feedback/${b.dataset.done}`, { method: 'POST' }); PHONE_APPS.admin(ui, body, g); }; });
    } catch (e) { body.innerHTML = `<div class="profile-big">${escapeHtml(e.message)}</div>`; }
  },
};
