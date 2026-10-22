// 서버와의 WebSocket 연결
export class Net {
  constructor() {
    this.handlers = {};
    this.ws = null;
    this.onClose = null;
    this.waiter = null;
  }

  on(type, fn) { this.handlers[type] = fn; }

  // 연결하고 첫 메시지(hello/spectate)에 대한 welcome을 기다린다
  connect(hello) {
    return new Promise((resolve, reject) => {
      const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
      const ws = new WebSocket(url);
      this.ws = ws;
      let opened = false;
      this.waiter = { resolve, reject };
      ws.onopen = () => { opened = true; ws.send(JSON.stringify(hello)); };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (this.waiter && (msg.t === 'welcome' || msg.t === 'error')) {
          const w = this.waiter; this.waiter = null;
          if (msg.t === 'welcome') w.resolve(msg); else w.reject(new Error(msg.code || msg.message));
          return;
        }
        const h = this.handlers[msg.t];
        if (h) {
          try { h(msg); } catch (err) { console.error('메시지 처리 오류', msg.t, err); }
        }
      };
      ws.onclose = () => {
        if (this.waiter) { const w = this.waiter; this.waiter = null; w.reject(new Error(opened ? '연결 끊김' : '연결 실패')); }
        else this.onClose?.();
      };
      ws.onerror = () => {};
    });
  }

  // 이미 열린 연결로 요청을 보내고 welcome/error를 기다린다 (관전 → 입장)
  request(msg) {
    if (!this.ws || this.ws.readyState !== 1) return this.connect(msg);
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
      this.ws.send(JSON.stringify(msg));
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }
}
