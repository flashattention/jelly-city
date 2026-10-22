// 혼자 달리기의 AI 카트: 앞쪽 길을 보고 핸들 · 굽은 길에선 감속 · 드리프트 · 니트로 · 아이템
export class Bot {
  constructor(kart, skill) {
    this.k = kart; this.skill = skill; kart.o.skill = skill;
    this.lane = (Math.random() - 0.5) * 6; this.laneT = 0;
    this.driftHold = 0; this.useT = 1 + Math.random() * 3;
  }
  // rank: 지금 순위(1부터) · leader: 1등과의 진행 차이 · player: 플레이어 진행도
  input(dt, track, playerProg) {
    const k = this.k, M = track.M;
    // 고무줄: 플레이어보다 많이 앞서면 살짝 늦추고, 뒤처지면 살짝 힘을 낸다
    const gap = k.progress(M) - playerProg;
    k.o.skill = this.skill * (gap > 0.25 ? 0.94 : gap < -0.2 ? 1.05 : 1);
    // 달리는 줄을 천천히 바꾼다
    this.laneT -= dt;
    if (this.laneT <= 0) { this.laneT = 2 + Math.random() * 3; this.lane = (Math.random() - 0.5) * 7; }
    const look = 8 + Math.floor(Math.abs(k.v) * 0.55);
    const target = track.at(k.idx + look, this.lane);
    const want = Math.atan2(target.x - k.pos.x, target.z - k.pos.z);
    let d = want - k.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    const bend = Math.abs(track.curve(k.idx, 18));
    const inp = { up: true, down: false, dir: Math.max(-1, Math.min(1, d * 2.4)), drift: false, use: false };
    // 굽은 길 앞에선 속도를 줄인다
    const safe = 33 * (1 - Math.min(0.55, bend * 0.9));
    if (Math.abs(k.v) > safe + 4) { inp.up = false; if (Math.abs(k.v) > safe + 9) inp.down = true; }
    // 큰 굽이: 드리프트
    if (this.driftHold > 0) { this.driftHold -= dt; inp.drift = true; }
    else if (bend > 0.45 && Math.abs(k.v) > 18 && Math.random() < dt * 3) this.driftHold = 0.6 + Math.random() * 0.8;
    // 곧은 길에서 니트로 · 아이템
    this.useT -= dt;
    if (this.useT <= 0 && bend < 0.25) { inp.use = true; this.useT = 1.5 + Math.random() * 3; }
    return inp;
  }
}
