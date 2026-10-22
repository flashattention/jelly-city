// 인벤토리 · 핫바 · 장비
import { ITEMS, itemDef, isWeapon, equipTotals, NO_AMMO } from './items.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const OLD_GIFTS = { 꽃다발: 'flowers', 빵: 'bread', 커피: 'coffee', 과자: 'snack', 책: 'book' };
export const SLOTS = { head: '머리', face: '얼굴', body: '몸', acc: '장신구' };

export class Inventory {
  constructor(game) {
    this.g = game;
    const S = game.stats;
    S.items ||= [];
    S.hotbar ||= Array(10).fill(null);
    S.equip ||= { head: null, face: null, body: null, acc: null };
    S.sel ??= 0;
    S.skills ||= [];
    // 예전 선물 목록을 아이템으로 옮김
    if (Array.isArray(S.inventory)) {
      for (const name of S.inventory) if (OLD_GIFTS[name]) this.add(OLD_GIFTS[name]);
      delete S.inventory;
    }
    S.items = S.items.filter((it) => ITEMS[it.id] && !NO_AMMO.has(it.id)); // 이제 총알·화살은 필요 없음
  }

  get S() { return this.g.stats; }
  find(u) { return this.S.items.find((it) => it.uid === u) || null; }
  selected() { const u = this.S.hotbar[this.S.sel]; return u ? this.find(u) : null; }
  count(id) { return this.S.items.filter((it) => it.id === id).reduce((a, it) => a + (it.n || 1), 0); }

  // 탄약 등 같은 종류를 n개 소모 (임시 아이템부터)
  consumeId(id, n = 1) {
    const stacks = this.S.items.filter((it) => it.id === id).sort((a, b) => (b.expiresAt ? 1 : 0) - (a.expiresAt ? 1 : 0));
    let left = n;
    for (const it of stacks) {
      const take = Math.min(left, it.n || 1);
      this.remove(it.uid, take);
      left -= take;
      if (left <= 0) break;
    }
    return left <= 0;
  }

  // 시간이 다 된 임시 아이템 제거
  expire(now = Date.now()) {
    const gone = this.S.items.filter((it) => it.expiresAt && it.expiresAt <= now);
    for (const it of gone) this.remove(it.uid);
    return gone;
  }

  // extra: { expiresAt, rarity } (맵에서 주운 임시 무기)
  add(id, n = 1, gems = [], extra = null) {
    const d = itemDef(id);
    if (id === 'cash') { this.S.money += n; return null; }
    const temp = !!extra?.expiresAt;
    let it = d.stack ? this.S.items.find((x) => x.id === id && !!x.expiresAt === temp && (!temp || x.expiresAt === extra.expiresAt)) : null;
    if (it) it.n = (it.n || 1) + n;
    else {
      it = { uid: uid(), id, n: d.stack ? n : 1, gems: [...gems], ...(temp ? { expiresAt: extra.expiresAt, rarity: extra.rarity } : {}) };
      this.S.items.push(it);
      if (!d.stack) for (let i = 1; i < n; i++) this.S.items.push({ uid: uid(), id, n: 1, gems: [] });
      // 쓸 수 있는 물건은 빈 핫바 칸에 자동 등록
      if (isWeapon(d) || ['food', 'doll', 'rod', 'carkey', 'mount'].includes(d.cat)) {
        const empty = this.S.hotbar.indexOf(null);
        if (empty >= 0) this.S.hotbar[empty] = it.uid;
      }
    }
    this.changed();
    return it;
  }

  remove(u, n = null) {
    const it = this.find(u);
    if (!it) return null;
    const take = n ?? (it.n || 1);
    if ((it.n || 1) > take) { it.n -= take; this.changed(); return { ...it, n: take, uid: undefined }; }
    this.S.items = this.S.items.filter((x) => x !== it);
    this.S.hotbar = this.S.hotbar.map((x) => (x === u ? null : x));
    for (const k of Object.keys(this.S.equip)) if (this.S.equip[k] === u) this.S.equip[k] = null;
    this.changed();
    return it;
  }

  consume(u) { return !!this.remove(u, 1); }

  setHotbar(slot, u) {
    this.S.hotbar = this.S.hotbar.map((x) => (x === u ? null : x));
    this.S.hotbar[slot] = u;
    this.changed();
  }

  select(i) { this.S.sel = i; this.changed(); }

  equip(u) {
    const it = this.find(u);
    if (!it) return;
    const d = itemDef(it.id);
    if (!d.slot) return;
    this.S.equip[d.slot] = this.S.equip[d.slot] === u ? null : u;
    this.changed();
  }

  equippedItems() { return Object.values(this.S.equip).map((u) => (u ? this.find(u) : null)).filter(Boolean); }
  isEquipped(u) { return Object.values(this.S.equip).includes(u); }
  totals() {
    const t = equipTotals(this.equippedItems());
    const sel = this.selected();
    if (sel) t.charm += itemDef(sel.id).charm || 0;
    return t;
  }

  visuals() { return this.equippedItems().map((it) => itemDef(it.id).vis).filter(Boolean); }
  heldVisual() { const it = this.selected(); return it ? itemDef(it.id).held || null : null; }

  // 외형 반영 + 다른 플레이어에게 알림
  changed() {
    const g = this.g;
    if (!g.player) return;
    const vis = this.visuals();
    const held = this.heldVisual();
    const key = vis.join(',') + '|' + held;
    if (key !== this.lastKey) {
      this.lastKey = key;
      g.player.setAccessories(vis);
      g.player.roach.setHeld(held);
    }
    const t = this.totals();
    if (t.def !== this.lastDef || t.charm !== this.lastCharm || key !== this.lastSent) {
      this.lastDef = t.def; this.lastCharm = t.charm; this.lastSent = key;
      g.sendProfile?.();
    }
    g.ui?.renderHotbar();
  }
}
