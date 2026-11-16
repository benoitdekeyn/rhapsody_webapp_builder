// Connection to the simulation engine (REST + WebSocket). Framework-free so it can be reused / tested in Node.

// Applies one WebSocket message to { state, instances }. Returns the message type that changed something.
export function applyMessage(model, msg) {
  if (msg.type === 'snapshot') {
    model.state = msg.state;
    model.instances = msg.instances;
    return 'snapshot';
  }
  if (msg.type === 'delta') {
    for (const id of msg.removed) delete model.state[id];
    for (const inst of msg.added) {
      model.instances = model.instances.filter((i) => i.id !== inst.id).concat(inst);
      model.state[inst.id] = model.state[inst.id] || {};
    }
    if (msg.removed.length) model.instances = model.instances.filter((i) => !msg.removed.includes(i.id));
    for (const [id, attrs] of Object.entries(msg.changes)) Object.assign((model.state[id] = model.state[id] || {}), attrs);
    return 'delta';
  }
  return msg.type;
}

export class SimApi {
  constructor({ url, token = '', reconnectMs = 1000 }, handlers = {}) {
    this.base = String(url || '').replace(/\/+$/, '');
    this.token = token;
    this.reconnectMs = reconnectMs;
    this.handlers = handlers; // onStatus(bool), onSnapshot(msg), onDelta(msg), onEvent(msg), onError(err)
    this.connected = false;
    this.closed = false;
    this._pending = new Map();
    this._reqId = 0;
    this._timer = null;
  }

  _query() {
    return this.token ? `?token=${encodeURIComponent(this.token)}` : '';
  }

  _headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async health() {
    const r = await fetch(`${this.base}/api/health${this._query()}`, { headers: this._headers() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async fetchSchema() {
    const r = await fetch(`${this.base}/api/schema${this._query()}`, { headers: this._headers() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  connect() {
    this.closed = false;
    let ws;
    try {
      ws = new WebSocket(`${this.base.replace(/^http/, 'ws')}/ws${this._query()}`);
    } catch (e) {
      this.handlers.onError?.(e);
      this._scheduleReconnect();
      return this;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.handlers.onStatus?.(true);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      for (const p of this._pending.values()) p.reject(new Error('connection closed'));
      this._pending.clear();
      if (was || !this.closed) this.handlers.onStatus?.(false);
      this._scheduleReconnect();
    };
    ws.onerror = () => this.handlers.onError?.(new Error('Connexion WebSocket impossible'));
    ws.onmessage = (m) => {
      let msg;
      try {
        msg = JSON.parse(m.data);
      } catch (e) {
        this.handlers.onError?.(new Error(`Message WebSocket invalide: ${e.message}`));
        return;
      }
      if (msg.type === 'result' && this._pending.has(msg.reqId)) {
        const p = this._pending.get(msg.reqId);
        this._pending.delete(msg.reqId);
        msg.ok ? p.resolve(msg) : p.reject(new Error(msg.error || 'request failed'));
      } else if (msg.type === 'snapshot') this.handlers.onSnapshot?.(msg);
      else if (msg.type === 'delta') this.handlers.onDelta?.(msg);
      else if (msg.type === 'event') this.handlers.onEvent?.(msg);
    };
    return this;
  }

  _scheduleReconnect() {
    if (this.closed) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.connect(), this.reconnectMs);
  }

  close() {
    this.closed = true;
    clearTimeout(this._timer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.connected = false;
    for (const p of this._pending.values()) p.reject(new Error('connection closed'));
    this._pending.clear();
  }

  _request(payload) {
    if (!this.connected) return Promise.reject(new Error('not connected'));
    const reqId = ++this._reqId;
    return new Promise((resolve, reject) => {
      this._pending.set(reqId, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ ...payload, reqId }));
      } catch (e) {
        this._pending.delete(reqId);
        reject(e);
      }
    });
  }

  set(instance, attr, value, index) {
    return this._request({ op: 'set', instance, attr, value, ...(index === undefined ? {} : { index }) });
  }

  sendEvent(name, args = {}, instance = '') {
    return this._request({ op: 'event', name, args, instance });
  }

  reset() {
    return this._request({ op: 'reset' });
  }
}
