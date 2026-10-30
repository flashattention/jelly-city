// 젤리수호대 영웅 조작: 기본 공격 종류(즉발 · 투사체 · 근접 · 줄기 · 안개) + 영웅마다 우클릭 · Shift · E · Q
//   G (main.js) 가 주는 것: me · send · hitscan · fireProj · melee · findTarget · coneTargets · has(상태) · vm · sfx · toast · ps(내 서버 상태)
import * as THREE from 'three';
import { PROJ } from './heroes.js';
import { rayBoxes, floorAt, clearLine } from '../../jelly-tactical/js/maps.js';

const GUN_SND = { cassidy: 'pistol', reaper: 'heavy', hog: 'heavy', dva: 'smg', widow: 'smg', soldier: 'pulse', tracer: 'smg', ana: 'sniper' };
export const VM_KIND = { rein: 'hammer', winston: 'tesla', dva: 'cannons', hog: 'scrap', zarya: 'particle', pharah: 'rpg', reaper: 'shotgun2', cassidy: 'revolver', soldier: 'rifle', genji: 'shuriken', widow: 'sniper', tracer: 'pistols', mercy: 'staff', ana: 'biorifle', lucio: 'sonic', moira: 'hands' };

export function makeKit(h, G) {
  const st = { mag: h.p.mag || 0, reloadEnd: 0, next: 0, nextS: 0, latch: false, latchS: false, beamT: 0, tgt: null, tgtS: null, beams: [], fuel: 1, dj: true, scopeAt: 0, acc: new Map(), hist: [], blinks: 3, blinkT: 0, mode: null };
  const K = { st, h };
  const now0 = () => performance.now();
  const spec = () => (G.has('pilot') ? h.pilot.p : h.p);
  const cdLeft = (s) => Math.max(0, (G.cd[s] || 0) - now0());
  const useCd = (s, sec) => { if (cdLeft(s) > 0) { G.sfx('cd'); return false; } G.cd[s] = now0() + sec * 1000; return true; };
  const abil = (s, extra = {}) => G.send({ t: 'abil', s, ...extra });
  const reloading = () => st.reloadEnd > now0();
  K.reload = () => { const sp = spec(); if (!sp.mag || reloading() || st.mag >= sp.mag) return; st.reloadEnd = now0() + (sp.reload || 1.4) * 1000; G.vm.reload(sp.reload || 1.4); G.sfx('reload'); };
  K.spawned = () => { st.mag = spec().mag || 0; st.reloadEnd = 0; st.mode = null; st.fuel = 1; st.blinks = 3; st.hist = []; st.acc.clear(); };
  K.vmKind = () => G.has('blade') || G.has('deflect') ? 'sword' : G.has('primal') ? 'paws' : h.id === 'dva' && G.has('pilot') ? 'pilot' : VM_KIND[h.id];
  // 지금 쏠 수 없는 상태 (기절 · 망령화 · 방벽 들고 · 돌진 …)
  const busy = () => !!st.aim || G.has('stun') || G.has('sleep') || G.has('ghost') || G.has('blossom') || G.has('hogult') || G.has('coal') || st.mode === 'charge' || st.mode === 'tp' || st.mode === 'recall' || st.mode === 'grap' || st.mode === 'ga' || (h.id === 'rein' && G.mouseR) || (h.id === 'dva' && G.mouseR && !G.has('pilot')) || G.has('deflect');

  // ---------- 기본 공격 ----------
  function fireHit(sp, a, now, opt = {}) {
    if (sp.mag) { if (st.mag <= 0) { if (!st.latch) G.sfx('dry'); st.latch = true; K.reload(); return; } st.mag--; }
    st.next = now + (opt.rate ?? sp.rate) * 1000;
    G.hitscan(sp, { a, ...opt });
    G.vm.kick(sp.dmg >= 60 || opt.charge != null ? 0.9 : sp.pellets > 4 ? 1 : 0.35);
    const rc = opt.charge != null ? sp.scoped?.recoil : sp.recoil; if (rc) G.recoil(rc * (opt.charge != null ? 0.5 + opt.charge * 0.5 : 1));
    G.sfx('gun', opt.snd || GUN_SND[h.id] || 'rifle', 0.8);
    if (sp.mag && st.mag <= 0) setTimeout(K.reload, 180);
  }
  function fireProjSpec(sp, a, now) {
    if (sp.mag) { if (st.mag <= 0) { if (!st.latch) G.sfx('dry'); st.latch = true; K.reload(); return; } st.mag -= sp.burst ? Math.min(st.mag, sp.burst) : 1; }
    st.next = now + sp.rate * 1000;
    const n = sp.burst || 1;
    for (let i = 0; i < n; i++) setTimeout(() => { if (!G.me.alive) return; G.fireProj(sp.k, { a, i }); G.vm.kick(0.35); G.sfx(sp.k === 'rocket' ? 'rocket' : sp.k === 'shuri' ? 'shuri' : 'laser', null, 0.7); }, i * (sp.burstGap || 0) * 1000);
    if (sp.mag && st.mag <= 0) setTimeout(K.reload, (n * (sp.burstGap || 0) + 0.2) * 1000);
  }
  function beamTick(now, k, list, snd) {
    st.beams = list;
    if (now - st.beamT < 100) return; st.beamT = now;
    G.send({ t: 'beam', k, to: list.map((o) => o.id) });
    if (snd) G.sfx('beam', snd, 0.6);
  }
  // 그림자 밟기 착지 자리: 조준한 곳 (벽이면 벽 앞 · 땅이면 그 자리) · 35m 안
  K.tpTarget = () => {
    const e = G.eye(), f = G.fwd();
    let t = Math.min(35, rayBoxes(G.map, e, f, 35));
    if (f.y < -0.01) t = Math.min(t, (e.y - 0.05) / -f.y);
    if (t >= 35) return { p: e.clone().addScaledVector(f, 35), ok: false };
    const p = e.clone().addScaledVector(f, Math.max(0, t - 0.6));
    const y = floorAt(G.map, p.x, p.z, p.y + 0.8);
    return { p: new THREE.Vector3(p.x, y, p.z), ok: Math.abs(y - p.y) < 3 };
  };
  K.confirmTp = (now) => {
    const T = K.tpTarget(); if (!T.ok) { G.toast('🌑 갈 수 없는 곳이에요'); G.sfx('cd'); return; }
    st.aim = null; if (!useCd('e', h.e.cd)) return;
    abil('e', { p: [T.p.x, T.p.y, T.p.z] }); st.mode = 'tp'; st.until = now + 900; st.tpTo = T.p; G.sfx('abil');
  };
  K.primary = (now, held, edge) => {
    st.beams = [];
    if (st.aim === 'tp') { if (edge) K.confirmTp(now); return; }
    if (!held) { st.latch = false; st.tgt = null; return; }
    if (busy() || reloading()) return;
    // 궁극기 · 변신 중 기본 공격
    if (G.has('blade')) { if (now < st.next) return; st.next = now + 750; G.vm.swing(0.42); G.sfx('swing'); G.melee({ range: 7, arc: 0.3, a: 'blade', cleave: true }); return; }
    if (G.has('primal')) { if (now < st.next) return; st.next = now + 550; G.vm.swing(0.3); G.sfx('thud'); G.melee({ range: 5.5, arc: 0.4, a: 'punch', cleave: true }); return; }
    if (G.has('barrage')) return;
    if (h.id === 'cassidy' && G.has('deadeye')) { if (edge) K.deadeyeFire(); return; }
    const sp = spec();
    if (h.id === 'mercy') {
      // 아군을 조준하면 치유 줄기 · 아니면 광선총
      st.tgt = G.findTarget({ range: G.has('valk') ? 30 : 15, arc: 0.95, lock: 'ally', prev: st.tgt });
      if (st.tgt) { const list = [st.tgt]; if (G.has('valk')) for (const o of G.coneTargets({ range: 12, arc: -1, ally: true, from: st.tgt.chest() })) if (o !== st.tgt && list.length < 6) list.push(o); beamTick(now, 'p', list, 760); return; }
      if (now < st.next || (!sp.alt.auto && st.latch)) return; st.latch = true; return fireProjSpec(sp.alt, 'p', now);
    }
    if (sp.type === 'hit') {
      if (now < st.next || (!sp.auto && st.latch)) return;
      st.latch = true;
      if (sp.scoped && G.mouseR) { if (!edge) return; const charge = Math.min(1, (now - st.scopeAt) / (sp.scoped.charge * 1000)); fireHit(sp, 'p', now, { charge, rate: sp.scoped.rate, snd: 'sniper', spread: 0 }); st.scopeAt = now + sp.scoped.rate * 1000; return; }
      return fireHit(sp, 'p', now);
    }
    if (sp.type === 'proj') { if (now < st.next || (!sp.auto && st.latch)) return; st.latch = true; return fireProjSpec(sp, 'p', now); }
    if (sp.type === 'melee') { if (now < st.next) return; st.next = now + sp.rate * 1000; G.vm.swing(); G.sfx('swing'); setTimeout(() => { if (G.me.alive && G.melee({ range: sp.range, arc: sp.arc, a: 'p', cleave: sp.cleave })) G.sfx('thud'); }, 140); return; }
    if (sp.type === 'beam') {
      let list;
      if (sp.chain) list = G.coneTargets({ range: sp.range, arc: sp.arc, ally: false }).slice(0, sp.chain);
      else { st.tgt = G.findTarget({ range: sp.range, arc: sp.arc, lock: 'enemy', prev: st.tgt }); list = st.tgt ? [st.tgt] : []; }
      st.beamFree = !list.length; // 대상이 없으면 허공에 쏘는 모양
      beamTick(now, 'p', list, h.id === 'zarya' ? 300 : 900);
      if (!list.length) st.beams = [];
      G.vm.kick(0.05);
      return;
    }
    if (sp.type === 'spray') {
      const res = G.ps?.[8] ?? 100; if (res <= 1) return;
      const list = G.coneTargets({ range: sp.range, arc: sp.arc, ally: true });
      st.spray = true; beamTick(now, 'p', list, null); if (now - (st.healSnd || 0) > 400) { st.healSnd = now; G.sfx('heal'); }
    }
  };
  // ---------- 우클릭 ----------
  K.secondary = (now, held, edge, released) => {
    const s = h.s; st.beamsS = [];
    if (st.aim) { if (edge) { st.aim = null; G.sfx('cd'); } return; }
    if (h.id === 'rein' || (h.id === 'dva' && !G.has('pilot'))) {
      if (edge) abil('s', { on: true }); if (released) abil('s', { on: false });
      return;
    }
    if (h.id === 'widow' || h.id === 'ana') { if (edge) st.scopeAt = now; return; }
    if (h.id === 'tracer') { if (edge) K.abil('shift', now); return; } // 쌩쌩: 우클릭도 점멸
    if (!held) { st.latchS = false; st.tgtS = null; return; }
    if (busy() || !s) return;
    if (G.has('blade') || G.has('primal') || G.has('barrage') || G.has('deadeye')) return;
    if (s.type === 'beam') {
      st.tgtS = G.findTarget({ range: s.range, arc: 0.95, lock: s.lock, prev: st.tgtS });
      st.beamsS = st.tgtS ? [st.tgtS] : [];
      if (st.tgtS && now - (st.beamTS || 0) > 100) { st.beamTS = now; G.send({ t: 'beam', k: 's', to: [st.tgtS.id] }); }
      return;
    }
    if (st.latchS) return;
    if (s.type === 'proj') {
      if (s.cd) { st.latchS = true; if (!useCd('s', s.cd)) return; abil('s'); G.fireProj(s.k, { a: 's' }); G.vm.kick(0.8); G.sfx('rocket'); return; }
      if (now < st.nextS) return; st.nextS = now + s.rate * 1000; st.latchS = !s.fan;
      if (s.fan) { st.latchS = true; if (st.mag < 3) return K.reload(); st.mag -= 3; for (let i = 0; i < 3; i++) G.fireProj(s.k, { a: 's', i, yawOff: (i - 1) * 0.11 }); G.sfx('shuri'); if (st.mag <= 0) setTimeout(K.reload, 200); return; }
      G.fireProj(s.k, { a: 's' }); G.vm.kick(0.5); G.sfx('throw'); return;
    }
    if (s.type === 'fan') { st.latchS = true; if (reloading()) return; K.fan(); return; }
    if (s.type === 'cone') { st.latchS = true; if (!useCd('s', s.cd)) return; abil('s'); G.wave(); G.sfx('boom', null, 0.5); return; }
  };
  // 빵야 난사: 남은 총알을 빠르게
  K.fan = () => {
    if (st.mode === 'fan' || st.mag <= 0) return; st.mode = 'fan';
    const tick = () => { if (!G.me.alive || st.mag <= 0 || G.has('stun')) { st.mode = null; if (st.mag <= 0) K.reload(); return; } st.mag--; G.hitscan({ ...h.s, near: 10, far: 20 }, { a: 's', spread: h.s.spread }); G.vm.kick(0.7); if (h.s.recoil) G.recoil(h.s.recoil); G.sfx('gun', 'pistol', 0.8); setTimeout(tick, h.s.rate * 1000); };
    tick();
  };
  // 황야의 무법자: 쏘면 모아 둔 만큼 한꺼번에
  K.deadeyeFire = () => {
    const list = [...st.acc.entries()].filter(([, v]) => v > 5).map(([id, v]) => [id, Math.round(v)]);
    G.send({ t: 'hit', a: 'dead', list }); st.acc.clear();
    for (const [id] of list) { const o = G.others.get(id); if (o) G.tracer(o.chest(), '#ffe08a'); }
    G.sfx('gun', 'sniper'); G.vm.kick(1); G.say('탕!');
  };

  // ---------- Shift · E · Q ----------
  K.abil = (slot, now) => {
    if (G.has('stun') || G.has('sleep')) return;
    const me = G.me, f = G.fwd(), flat = new THREE.Vector3(f.x, 0, f.z).normalize();
    if (slot === 'q') {
      if ((G.ps?.[4] ?? 0) < 100) { G.sfx('cd'); return; }
      if (h.id === 'ana') { const t = G.findTarget({ range: 45, arc: 0.93, lock: 'ally' }); if (!t) { G.toast('💉 나노 강화제: 아군을 조준하고 Q'); return; } return abil('q', { to: t.id }); }
      abil('q');
      if (h.id === 'zarya') setTimeout(() => G.fireProj('grav', { a: 'q' }), 60);
      if (h.id === 'tracer') setTimeout(() => G.fireProj('pulse', { a: 'q', stick: true }), 60);
      return;
    }
    if (G.has('blossom') || G.has('barrage') || G.has('coal') || G.has('hogult')) return;
    const sp = h[slot]; if (!sp) return;
    if (h.id === 'dva' && G.has('pilot')) return;
    switch (`${h.id}.${slot}`) {
      case 'rein.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); st.mode = 'charge'; st.until = now + 2600; st.cyaw = me.yaw; G.sfx('dash'); return;
      case 'rein.e': if (!useCd('e', sp.cd)) return; abil('e'); G.vm.swing(0.4); setTimeout(() => G.fireProj('fire', { a: 'e', pierce: true }), 250); G.sfx('swing'); return;
      case 'winston.shift': if (!useCd('shift', G.has('primal') ? 1.5 : sp.cd)) return; abil('shift'); me.vel.set(flat.x * (G.has('primal') ? 20 : 17), 9.5, flat.z * (G.has('primal') ? 20 : 17)); me.onGround = false; st.mode = 'leap'; st.until = now + 3000; st.leapT = now; G.sfx('rocket'); return;
      case 'winston.e': if (!useCd('e', sp.cd)) return; abil('e'); G.sfx('abil'); return;
      case 'dva.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); st.mode = 'boost'; st.until = now + 2000; st.bumped = new Map(); G.sfx('rocket'); return;
      case 'dva.e': if (!useCd('e', sp.cd)) return; abil('e'); for (let i = 0; i < 18; i++) setTimeout(() => { if (me.alive) G.fireProj('mini', { a: 'e', i: 1, jitter: 0.06 }); }, i * 55); G.sfx('rocket'); return;
      case 'hog.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); G.fireProj('hook', { a: 'shift' }); G.sfx('throw'); return;
      case 'hog.e': if (!useCd('e', sp.cd)) return; abil('e'); G.sfx('heal'); return;
      case 'zarya.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); G.sfx('abil'); return;
      case 'zarya.e': { if (!useCd('e', sp.cd)) return; const t = G.findTarget({ range: 30, arc: 0.95, lock: 'ally' }); abil('e', { to: t?.id }); G.sfx('abil'); return; }
      case 'pharah.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); me.vel.y = 17; me.onGround = false; G.sfx('rocket'); return;
      case 'pharah.e': if (!useCd('e', sp.cd)) return; abil('e'); G.fireProj('conc', { a: 'e' }); G.sfx('throw'); return;
      case 'reaper.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); st.mag = h.p.mag; G.sfx('abil'); return;
      case 'reaper.e': {
        // E → 착지 자리가 보이는 조준 → 클릭 · E 로 확정 / 우클릭 취소
        if (st.aim !== 'tp') { if (cdLeft('e') > 0) { G.sfx('cd'); return; } st.aim = 'tp'; G.sfx('pick'); return; }
        return K.confirmTp(now);
      }
      case 'cassidy.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); { const d = G.moveDir(); st.mode = 'roll'; st.until = now + 380; st.dir = d.lengthSq() > 0.01 ? d : flat.clone(); } G.sfx('dash'); return;
      case 'cassidy.e': if (!useCd('e', sp.cd)) return; abil('e'); G.fireProj('flash', { a: 'e' }); G.sfx('throw'); return;
      case 'soldier.e': if (!useCd('e', sp.cd)) return; abil('e'); G.sfx('heal'); return;
      case 'genji.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); st.mode = 'dash'; st.until = now + 260; st.dashed = new Set(); st.dir = f.clone(); G.sfx('dash'); return;
      case 'genji.e': if (!useCd('e', sp.cd)) return; abil('e'); G.sfx('swing'); return;
      case 'widow.shift': {
        const e = G.eye(), t = rayBoxes(G.map, e, f, 26); if (t >= 26) { G.toast('🪝 가까운 벽 · 지붕을 조준해요'); return; }
        if (!useCd('shift', sp.cd)) return; abil('shift'); st.mode = 'grap'; st.until = now + 1600; st.to = e.clone().addScaledVector(f, t - 0.5); G.sfx('throw'); return;
      }
      case 'widow.e': if (!useCd('e', sp.cd)) return; abil('e'); G.fireProj('mine', { a: 'e' }); G.sfx('throw'); return;
      case 'tracer.shift': {
        if (st.blinks < 1) { G.sfx('cd'); return; }
        st.blinks--; if (!st.blinkT) st.blinkT = now;
        abil('blink');
        const d = G.moveDir(); const dir = d.lengthSq() > 0.01 ? d : flat.clone();
        const o = me.pos.clone().setY(me.pos.y + 1), t = rayBoxes(G.map, o, dir, 7.2), L = Math.max(0, Math.min(7, t - 0.6));
        me.pos.addScaledVector(dir, L); me.pos.y = floorAt(G.map, me.pos.x, me.pos.z, me.pos.y + 0.6); me.vel.x = dir.x * 6; me.vel.z = dir.z * 6;
        G.flash('#9fe8ff'); G.sfx('blink'); return;
      }
      case 'tracer.e': if (!useCd('e', sp.cd)) return; abil('e'); st.mode = 'recall'; st.until = now + 700; st.rpath = [...st.hist].reverse(); G.sfx('blink'); return;
      case 'mercy.shift': { const t = G.findTarget({ range: 30, arc: 0.9, lock: 'ally' }); if (!t) { G.toast('🪽 날아갈 아군을 조준해요'); return; } if (!useCd('shift', G.has('valk') ? 1 : sp.cd)) return; abil('shift', { to: t.id }); st.mode = 'ga'; st.until = now + 1600; st.gaTo = t; G.sfx('dash'); return; }
      case 'mercy.e': if (cdLeft('e') > 0) { G.sfx('cd'); return; } G.cd.e = now + 1000; abil('e'); return;
      case 'ana.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); G.fireProj('sleep', { a: 'shift' }); G.sfx('laser'); return;
      case 'ana.e': if (!useCd('e', sp.cd)) return; abil('e'); G.fireProj('biotic', { a: 'e' }); G.sfx('throw'); return;
      case 'lucio.shift': if (!useCd('shift', 0.6)) return; abil('shift'); G.sfx('pick'); return;
      case 'lucio.e': if (!useCd('e', sp.cd)) return; abil('e'); G.sfx('ult'); return;
      case 'moira.shift': if (!useCd('shift', sp.cd)) return; abil('shift'); st.mode = 'fade'; st.until = now + 800; G.sfx('blink'); return;
      case 'moira.e': if (!useCd('e', sp.cd)) return; abil('e'); G.sfx('throw'); return;
      case 'soldier.shift': return;
    }
  };

  // ---------- 매 프레임: 움직임 기술 · 지속 효과 ----------
  K.tick = (dt, now, inp) => {
    const me = G.me, f = G.fwd(), flat = new THREE.Vector3(f.x, 0, f.z).normalize();
    inp.speedMul = h.speed * (G.ps?.[9] || 1);
    inp.airCtl = 1.6;
    if (st.reloadEnd && now >= st.reloadEnd) { st.mag = spec().mag || 0; st.reloadEnd = 0; }
    if (h.id === 'rein' && G.mouseR) inp.speedMul *= 0.7;
    if (h.id === 'soldier' && G.keys.has('ShiftLeft') && inp.f > 0 && !G.mouseL) inp.speedMul *= 1.5;
    if (G.has('blossom')) inp.speedMul *= 0.6;
    if (G.has('deadeye')) inp.speedMul *= 0.35;
    if (G.has('blade')) inp.speedMul *= 1.2;
    if (G.has('primal')) { inp.speedMul *= 1.25; inp.jumpV = 10; }
    if (G.has('ghost') && h.id === 'reaper') inp.speedMul *= 1.5;
    if (G.has('coal')) inp.speedMul *= 1.25;
    if (h.id === 'moira' && st.mode === 'fade') inp.speedMul *= 2.2;
    if (h.id === 'dva' && G.mouseR && !G.has('pilot')) inp.speedMul *= 0.8;
    if (st.mode && now > st.until) { if (st.mode === 'roll') { st.mag = h.p.mag; st.reloadEnd = 0; } if (st.mode === 'grap') { me.vel.y = Math.max(me.vel.y, 5); st.grapJump = now + 700; } if (st.mode === 'dash' || st.mode === 'boost') { me.vel.x *= 0.3; me.vel.z *= 0.3; } st.mode = st.mode === 'leap' && !me.onGround ? 'leap' : null; }
    // 멈춤 (기절 · 수면 · 포화 · 순간이동 준비)
    if (G.has('stun') || G.has('sleep') || st.mode === 'tp') { inp.f = 0; inp.s = 0; inp.jump = false; }
    if (st.mode === 'tp' && now >= st.until - 30) { me.pos.copy(st.tpTo); me.vel.set(0, 0, 0); st.mode = null; G.flash('#4a4356'); G.sfx('blink'); }
    if (G.has('grav') && G.gravAt) { const c = G.gravAt; inp.keepVel = true; inp.noGrav = true; me.vel.set((c.x - me.pos.x) * 4, (c.y - 1 - me.pos.y) * 4, (c.z - me.pos.z) * 4); }
    switch (st.mode) {
      case 'charge': {
        let d = me.yaw - st.cyaw; d = Math.atan2(Math.sin(d), Math.cos(d)); st.cyaw += Math.max(-1.1 * dt, Math.min(1.1 * dt, d));
        const dir = new THREE.Vector3(-Math.sin(st.cyaw), 0, -Math.cos(st.cyaw));
        inp.keepVel = true; me.vel.x = dir.x * 16; me.vel.z = dir.z * 16;
        const o = me.pos.clone().setY(me.pos.y + 1);
        if (rayBoxes(G.map, o, dir, 1.2) < 1.1) { st.mode = null; G.shake(0.6); G.sfx('thud'); }
        for (const t of G.enemies()) if (t.pos.distanceTo(me.pos) < 2.2) { abil('pin', { to: t.id }); st.mode = null; G.shake(0.8); G.sfx('thud'); break; }
        break;
      }
      case 'boost': {
        inp.keepVel = true; inp.noGrav = true; me.vel.set(f.x * 13, f.y * 9, f.z * 13); if (me.onGround && me.vel.y < 0) me.vel.y = 0;
        for (const t of G.enemies()) if (t.pos.distanceTo(me.pos) < 2.4 && now - (st.bumped.get(t.id) || 0) > 800) { st.bumped.set(t.id, now); abil('bump', { to: t.id }); G.sfx('thud'); }
        break;
      }
      case 'roll': inp.keepVel = true; me.vel.x = st.dir.x * 15; me.vel.z = st.dir.z * 15; break;
      case 'dash': {
        inp.keepVel = true; inp.noGrav = true; me.vel.set(st.dir.x * 58, st.dir.y * 30, st.dir.z * 58);
        for (const t of G.enemies()) if (!st.dashed.has(t.id) && t.pos.distanceTo(me.pos) < 2.4) { st.dashed.add(t.id); G.send({ t: 'hit', to: t.id, a: 'dash', part: 'body' }); G.puff(t.chest(), '#b6ff8a', 10); }
        break;
      }
      case 'grap': {
        const d = st.to.clone().sub(me.pos.clone().setY(me.pos.y + 1)); const L = d.length();
        if (L < 1.6) { st.mode = null; me.vel.y = 6; st.grapJump = now + 700; break; }
        if (G.jumpEdge) { st.mode = null; d.normalize(); me.vel.set(d.x * 17, Math.max(8.5, d.y * 17 + 6), d.z * 17); G.sfx('jump'); G.puff(me.pos.clone(), '#9466e0', 6, 0.3, 1); break; } // 갈고리 점프: 끌려가는 힘 그대로 날아오르기
        inp.keepVel = true; inp.noGrav = true; d.normalize(); me.vel.copy(d.multiplyScalar(22)); G.grapLine = st.to;
        break;
      }
      case 'ga': {
        const t = st.gaTo; if (!t || !t.alive) { st.mode = null; break; }
        const d = t.chest().sub(me.pos.clone().setY(me.pos.y + 1)); const L = d.length();
        if (L < 2.6) { st.mode = null; me.vel.multiplyScalar(0.4); break; }
        inp.keepVel = true; inp.noGrav = true; me.vel.copy(d.normalize().multiplyScalar(18));
        break;
      }
      case 'recall': {
        const k = 1 - (st.until - now) / 700, i = Math.min(st.rpath.length - 1, Math.floor(k * st.rpath.length));
        if (st.rpath[i]) { me.pos.copy(st.rpath[i]); me.vel.set(0, 0, 0); }
        inp.keepVel = true; inp.noGrav = true; inp.f = inp.s = 0;
        if (k >= 1) { st.mode = null; st.hist = []; }
        break;
      }
      case 'leap': if (me.onGround && now - st.leapT > 250) { st.mode = null; abil('land'); G.ring(me.pos, '#8fd8ff', 4.5); G.shake(0.5); G.sfx('thud'); } break;
    }
    // 영웅마다 움직임 특징
    if (h.id === 'pharah') {
      const hover = G.keys.has('Space') && !me.onGround && st.fuel > 0 && !G.has('barrage');
      if (hover) { me.vel.y = Math.min(4.5, me.vel.y + 34 * dt); st.fuel = Math.max(0, st.fuel - dt * 0.33); G.jets = true; }
      else { G.jets = false; if (me.onGround) st.fuel = Math.min(1, st.fuel + dt * 0.5); else st.fuel = Math.min(1, st.fuel + dt * 0.12); }
      if (G.has('barrage')) { inp.f = 0; inp.s = 0; inp.keepVel = true; inp.noGrav = true; me.vel.set(0, 0, 0); K.barrage(now); }
      inp.airCtl = 2.4;
    }
    if (h.id === 'widow' && st.grapJump) { if (me.onGround || now > st.grapJump) st.grapJump = 0; else if (G.jumpEdge) { st.grapJump = 0; const fw = flat.clone(); me.vel.x += fw.x * 5; me.vel.z += fw.z * 5; me.vel.y = 8.5; G.sfx('jump'); G.puff(me.pos.clone(), '#9466e0', 6, 0.3, 1); } }
    if (h.id === 'genji') {
      // 벽 타기: 벽을 보고 Space 를 누르고 있으면 기어오른다 (땅에 닿을 때마다 1.4초). 꼭대기에 닿으면 훌쩍 넘어간다
      const wall = [0.35, 1.2].some((y) => { const a = me.pos.clone(); a.y += y; return !clearLine(G.map, a, a.clone().addScaledVector(flat, 0.75)); });
      if (me.onGround) { st.dj = true; st.climb = 1.4; }
      if (!me.onGround && G.keys.has('Space') && wall && st.climb > 0 && !st.mode) {
        if (!st.climbing) G.sfx('jump');
        st.climbing = true; st.climb -= dt; me.vel.y = 6.5; me.vel.x *= 0.5; me.vel.z *= 0.5;
        st.climbFx = (st.climbFx || 0) - dt; if (st.climbFx <= 0) { st.climbFx = 0.12; G.puff(me.pos.clone().addScaledVector(flat, 0.45).setY(me.pos.y + 0.6), '#b6ff8a', 2, 0.2, 0.6); }
      } else if (st.climbing) {
        st.climbing = false;
        if (!wall && G.keys.has('Space')) { me.vel.y = Math.max(me.vel.y, 5.5); me.vel.x += flat.x * 3; me.vel.z += flat.z * 3; } // 벽 꼭대기: 앞으로 넘어간다
      } else if (!me.onGround && G.jumpEdge && st.dj && !(wall && st.climb > 0)) { st.dj = false; me.vel.y = 7.6; G.sfx('jump'); G.puff(me.pos.clone(), '#b6ff8a', 6, 0.3, 1); }
    }
    if (h.id === 'mercy') {
      if (G.has('valk')) { inp.noGrav = true; me.vel.y = G.keys.has('Space') ? 5 : inp.crouch ? -5 : me.vel.y * 0.85; inp.crouch = false; inp.speedMul *= 1.25; inp.airCtl = 4; }
      else if (G.keys.has('Space') && !me.onGround && me.vel.y < -2) me.vel.y = -2;
    }
    if (h.id === 'tracer') {
      if (st.blinks < 3 && st.blinkT && now - st.blinkT >= 3000) { st.blinks++; st.blinkT = st.blinks < 3 ? now : 0; }
      if (!st.hist.length || now - st.hist[st.hist.length - 1].t > 100) { st.hist.push(Object.assign(me.pos.clone(), { t: now })); }
      while (st.hist.length && now - st.hist[0].t > 3000) st.hist.shift();
    }
    if (h.id === 'cassidy' && G.has('deadeye')) {
      const el = (now - (st.deadAt || now)) / 1000;
      for (const o of G.enemies()) { if (o.onScreen && G.visible(o)) st.acc.set(o.id, (st.acc.get(o.id) || 0) + dt * (140 + 120 * el)); }
    } else st.deadAt = now;
    if (h.id === 'soldier' && G.has('visor')) G.visor = true; else G.visor = false;
    // 황야의 무법자: 6.5초가 지나면 저절로 쏜다
    if (h.id === 'cassidy' && G.has('deadeye') && now - st.deadAt > 6500 && st.acc.size) K.deadeyeFire();
    if (st.aim && (G.has('stun') || G.has('sleep') || !me.alive)) st.aim = null;
    if (h.id === 'moira' && G.has('coal')) { st.beams = []; }
  };
  // 화면에 그릴 조준 도움 (main 이 그린다)
  K.aims = () => {
    const out = [], now = performance.now(), ready = (sl) => cdLeft(sl) <= 0;
    if (st.aim === 'tp') out.push({ k: 'tp', ...K.tpTarget() });
    // 아군 대상 기술: 토닥 수호천사 · 탱글 방벽 씌우기 · 꿀잠 나노
    const allyAim = h.id === 'mercy' && ready('shift') ? { range: 30, arc: 0.9, label: '🪽 Shift' } : h.id === 'zarya' && ready('e') ? { range: 30, arc: 0.95, label: '🛡️ E' } : null;
    if (allyAim) { const t = G.findTarget({ range: allyAim.range, arc: allyAim.arc, lock: 'ally' }); if (t) out.push({ k: 'ally', o: t, label: allyAim.label, col: h.id === 'mercy' ? '#ffe48a' : '#ff8fd0' }); }
    if (h.id === 'ana' && (G.ps?.[4] ?? 0) >= 100) { const t = G.findTarget({ range: 45, arc: 0.93, lock: 'ally' }); if (t) out.push({ k: 'ally', o: t, label: '💉 Q', col: '#7cf0ff' }); }
    if (h.id === 'widow' && ready('shift')) { const e = G.eye(), tt = rayBoxes(G.map, e, G.fwd(), 26); out.push({ k: 'grap', ok: tt < 26 }); }
    if (h.id === 'cassidy' && G.has('deadeye')) for (const [id, v] of st.acc) { const o = G.others.get(id); if (o?.alive) out.push({ k: 'dead', o, v, kill: v >= o.hp + o.temp }); }
    void now; return out;
  };
  K.barrage = (now) => {
    if (now < (st.barT || 0)) return; st.barT = now + 95; st.barSide = -(st.barSide || 1);
    G.fireProj('barrage', { a: 'q', i: 1, side: st.barSide * 0.5, jitter: 0.07 }); G.sfx('rocket', null, 0.5);
  };
  // 오른쪽 아래 표시 (탄 · 자원)
  K.ammo = () => {
    const sp = spec();
    if (G.has('blade')) return { big: '🐉', small: '용검' };
    if (h.id === 'rein') return { big: Math.round(G.ps?.[8] ?? 1200), small: '방벽' };
    if (h.id === 'moira') return { big: Math.round(G.ps?.[8] ?? 100), small: '생체 자원' };
    if (h.id === 'zarya') return { big: `${Math.round(G.ps?.[6] ?? 0)}%`, small: '에너지' };
    if (h.id === 'dva' && !G.has('pilot')) return { big: '∞', small: `매트릭스 ${Math.round(G.ps?.[8] ?? 300) / 3 | 0}%` };
    if (sp.type === 'beam' || sp.type === 'melee') return { big: '∞', small: sp.name };
    if (h.id === 'mercy') return { big: st.mag, small: '/ 20' };
    return { big: reloading() ? '…' : st.mag, small: sp.mag ? `/ ${sp.mag}` : '' };
  };
  K.extra = () => {
    if (h.id === 'pharah') return { bar: st.fuel, label: '연료' };
    if (h.id === 'tracer') return { pips: st.blinks, label: '점멸' };
    if (h.id === 'widow' && G.mouseR) return { bar: Math.min(1, (performance.now() - st.scopeAt) / (h.p.scoped.charge * 1000)), label: '충전' };
    if (h.id === 'lucio') return { label: G.has('songheal') ? '🎵 치유 곡' : '🎵 속도 곡' };
    return null;
  };
  return K;
}
