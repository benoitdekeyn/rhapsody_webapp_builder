// Reactive application state shared by all components + connection lifecycle.
import { reactive, computed } from 'vue';
import { SimApi, applyMessage } from './api-client.js';
import { resolveInstanceId, findStateKey, findAttribute, findEvent } from './resolve.js';

export const store = reactive({
  connected: false,
  connecting: false,
  error: '',
  schema: null,
  instances: [],
  state: {},
  eventLog: [],
});

let api = null;
let connectionVersion = 0;

async function loadSchema(current, version) {
  try {
    const schema = await current.fetchSchema();
    if (api === current && version === connectionVersion) store.schema = schema;
  } catch (e) {
    if (api === current && version === connectionVersion) store.error = `Schéma indisponible: ${e.message}`;
  }
}

// (Re)connects to the engine. Called at startup and whenever the API settings change.
export function connect(apiSettings) {
  disconnect();
  store.error = '';
  store.connecting = true;
  const current = new SimApi(apiSettings, {
    onStatus(on) {
      if (api !== current) return;
      const version = ++connectionVersion;
      store.connected = on;
      store.connecting = !on;
      if (on) {
        store.error = '';
        loadSchema(current, version);
      } else {
        store.schema = null;
        store.state = {};
        store.instances = [];
      }
    },
    onSnapshot(msg) {
      if (api !== current) return;
      const model = { state: store.state, instances: store.instances };
      applyMessage(model, msg);
      store.state = model.state;
      store.instances = model.instances;
    },
    onDelta(msg) {
      if (api !== current) return;
      const model = { state: store.state, instances: store.instances };
      applyMessage(model, msg);
      store.instances = model.instances;
    },
    onEvent(msg) {
      if (api !== current) return;
      store.eventLog.unshift({ t: Date.now(), name: msg.name, instance: msg.instance, args: msg.args });
      if (store.eventLog.length > 100) store.eventLog.pop();
    },
    onError(e) {
      if (api !== current) return;
      store.error = e.message;
    },
  });
  api = current;
  current.connect();
}

export function disconnect() {
  ++connectionVersion;
  if (api) api.close();
  api = null;
  store.connected = false;
  store.connecting = false;
  store.schema = null;
  store.instances = [];
  store.state = {};
}

export async function testConnection(apiSettings) {
  const probe = new SimApi(apiSettings);
  const h = await probe.health();
  return `${h.instances} instance(s) suivie(s), ${h.wsClients} client(s) WebSocket`;
}

// ---- helpers used by components ----------------------------------------------------------

export function attributeValue(attribute, instanceHint = '') {
  const id = resolveInstanceId(store.schema, attribute, instanceHint);
  const key = id ? findStateKey(store.state, id) : '';
  return key ? store.state[key]?.[attribute] : undefined;
}

export function attributeInfo(attribute, instanceHint = '') {
  if (!store.schema) return { known: true, writable: false };
  const id = resolveInstanceId(store.schema, attribute, instanceHint);
  const a = findAttribute(store.schema, attribute, id);
  return { known: !!a, writable: !!a?.writable, kind: a?.kind };
}

export function eventInfo(name) {
  if (!store.schema) return { known: true };
  return { known: !!findEvent(store.schema, name) };
}

function report(promise, what) {
  return promise.catch((e) => {
    store.error = `${what}: ${e.message}`;
    throw e;
  });
}

export function writeAttribute(attribute, value, instanceHint = '') {
  if (!api) return report(Promise.reject(new Error('not connected')), `écriture ${attribute}`);
  const info = attributeInfo(attribute, instanceHint);
  if (!info.known) return report(Promise.reject(new Error("attribut absent du schéma de l'exécutable")), `écriture ${attribute}`);
  if (!info.writable) return report(Promise.reject(new Error('attribut non modifiable')), `écriture ${attribute}`);
  const id = resolveInstanceId(store.schema, attribute, instanceHint);
  return report(api.set(id, attribute, value), `écriture ${attribute}`);
}

export function fireEvent(name, args = {}, instanceHint = '') {
  if (!api) return report(Promise.reject(new Error('not connected')), `événement ${name}`);
  if (!eventInfo(name).known) return report(Promise.reject(new Error("événement absent du schéma de l'exécutable")), `événement ${name}`);
  return report(api.sendEvent(name, args, instanceHint), `événement ${name}`);
}

// Restarts the simulation from the beginning (the engine restarts itself, the WebSocket reconnects).
export function resetSimulation() {
  if (!api) return Promise.reject(new Error('not connected'));
  store.eventLog.length = 0;
  return report(api.reset(), 'reset');
}

export const isReady = computed(() => store.connected && !!store.schema);
