// Minimal client for the Rhapsody simulator API (no dependencies, works from any page).
//
//   const sim = new SimClient();            // same origin as the page, or new SimClient({ url: "http://localhost:8080" })
//   sim.onState((state, changes) => ...);   // state = { instanceId: { attr: value } }, changes = last delta (or null)
//   sim.set("MaClasse", "vitesse", 42);     // sim.set(inst, attr, value, index?)
//   sim.sendEvent("ev_demarrer");           // sim.sendEvent("ev_action", { param: "valeur" }, instance?)
//   sim.reset();                            // restarts the simulation from the beginning
//   await sim.schema;                       // API description (classes / attributes / events)
class SimClient {
  constructor({ url = location.origin, token = '' } = {}) {
    this.base = url.replace(/\/$/, '');
    this.token = token;
    this.state = {};
    this.instances = [];
    this.connected = false;
    this._pending = new Map();
    this._reqId = 0;
    this._handlers = { state: [], event: [], status: [], instances: [] };
    this.schema = this.fetchSchema();
    this._open();
  }

  _query() {
    return this.token ? `?token=${encodeURIComponent(this.token)}` : '';
  }

  async fetchSchema() {
    const r = await fetch(`${this.base}/api/schema${this._query()}`);
    if (!r.ok) throw new Error(`schema: HTTP ${r.status}`);
    this.schemaData = await r.json();
    return this.schemaData;
  }

  onState(fn) { this._handlers.state.push(fn); return this; }
  onEvent(fn) { this._handlers.event.push(fn); return this; }
  onStatus(fn) { this._handlers.status.push(fn); return this; }
  onInstances(fn) { this._handlers.instances.push(fn); return this; }
  _emit(kind, ...args) { for (const fn of this._handlers[kind]) fn(...args); }

  _open() {
    const ws = new WebSocket(`${this.base.replace(/^http/, 'ws')}/ws${this._query()}`);
    this.ws = ws;
    ws.onopen = () => { this.connected = true; this._emit('status', true); };
    ws.onclose = () => {
      this.connected = false;
      this._emit('status', false);
      for (const p of this._pending.values()) p.reject(new Error('connection closed'));
      this._pending.clear();
      setTimeout(() => this._open(), 1000);
    };
    ws.onmessage = (m) => this._onMessage(JSON.parse(m.data));
  }

  _onMessage(msg) {
    if (msg.type === 'snapshot') {
      this.state = msg.state;
      this.instances = msg.instances;
      this._emit('instances', this.instances);
      this._emit('state', this.state, null);
    } else if (msg.type === 'delta') {
      for (const id of msg.removed) delete this.state[id];
      if (msg.added.length) {
        this.instances = this.instances.filter((i) => !msg.added.some((a) => a.id === i.id)).concat(msg.added);
        for (const i of msg.added) this.state[i.id] = this.state[i.id] || {};
      }
      if (msg.removed.length) this.instances = this.instances.filter((i) => !msg.removed.includes(i.id));
      for (const [id, attrs] of Object.entries(msg.changes)) Object.assign((this.state[id] = this.state[id] || {}), attrs);
      if (msg.added.length || msg.removed.length) this._emit('instances', this.instances);
      this._emit('state', this.state, msg.changes);
    } else if (msg.type === 'event') {
      this._emit('event', msg);
    } else if (msg.type === 'result' && this._pending.has(msg.reqId)) {
      const p = this._pending.get(msg.reqId);
      this._pending.delete(msg.reqId);
      msg.ok ? p.resolve(msg) : p.reject(new Error(msg.error || 'request failed'));
    }
  }

  _request(payload) {
    if (!this.connected) return Promise.reject(new Error('not connected'));
    const reqId = ++this._reqId;
    return new Promise((resolve, reject) => {
      this._pending.set(reqId, { resolve, reject });
      this.ws.send(JSON.stringify({ ...payload, reqId }));
    });
  }

  set(instance, attr, value, index) {
    return this._request({ op: 'set', instance, attr, value, ...(index === undefined ? {} : { index }) });
  }

  setMany(changes) {
    return this._request({ op: 'set', changes });
  }

  sendEvent(name, args = {}, instance = '') {
    return this._request({ op: 'event', name, args, instance });
  }

  // Restarts the simulation from its initial state. The executable restarts itself, so the
  // connection drops for a moment and then reconnects automatically.
  reset() {
    return this._request({ op: 'reset' });
  }
}

if (typeof module !== 'undefined') module.exports = SimClient;
