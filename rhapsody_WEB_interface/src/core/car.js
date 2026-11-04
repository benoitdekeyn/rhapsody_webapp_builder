// Vehicle layer: every value / action used by the interface is looked up through api-map.jsonc,
// so renaming something in Rhapsody only requires editing that file.
import { computed } from 'vue';
import map from '../../api-map.jsonc';
import { store, attributeValue, writeAttribute, fireEvent } from './store.js';

export const attributes = map.attributes;
export const events = map.events;

const readers = {
  number: (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : (d ?? 0)),
  boolean: (v) => v === true,
  string: (v) => (typeof v === 'string' ? v : ''),
  list: (v) => (Array.isArray(v) ? v : []),
};

// Steps of the Bluetooth pairing as seen from the phone (messages_appairage[] are the engine's own texts).
export function pairingStep({ phoneBluetooth, connected, message, messages }) {
  if (!phoneBluetooth) return 'phone_off';
  if (connected) return 'connected';
  const i = Array.isArray(messages) ? messages.indexOf(message) : -1;
  return ['searching', 'detected', 'password', 'wrong', 'pairing', 'failed'][i] || 'searching';
}

export function speedScaleMax(maxSpeed) {
  return Math.max(60, Math.ceil((maxSpeed + 20) / 20) * 20);
}

// One reactive ref per entry of api-map.jsonc: car.speed.value, car.contact.value, ...
export function buildCar(attributeMap, read = attributeValue) {
  const out = {};
  for (const [key, def] of Object.entries(attributeMap)) {
    const reader = readers[def.type] || readers.number;
    out[key] = computed(() => reader(read(def.api), def.default));
  }
  return out;
}

export const car = buildCar(attributes);
car.online = computed(() => store.connected);
car.mode = computed(() => (car.cruise.value ? 'cruise' : car.limiter.value ? 'limiter' : 'manual'));
car.connected = computed(() => car.vehicleConnected.value && car.phoneConnected.value);
car.distanceKm = car.distance;
car.step = computed(() =>
  pairingStep({
    phoneBluetooth: car.phoneBluetooth.value,
    connected: car.connected.value,
    message: car.pairingMessage.value,
    messages: car.messages.value,
  }),
);

const quiet = (promise) => promise.catch(() => {});
function lookup(table, key, what) {
  const found = table[key];
  if (!found) console.error(`api-map.jsonc: unknown ${what} "${key}"`);
  return found;
}

export const actions = {
  set(key, value) {
    const def = lookup(attributes, key, 'attribute');
    return def ? quiet(writeAttribute(def.api, value)) : Promise.resolve();
  },
  fire(key) {
    const name = lookup(events, key, 'event');
    return name ? quiet(fireEvent(name, {})) : Promise.resolve();
  },
  contactOn: () => actions.set('contact', true),
  contactOff: () => actions.set('contact', false),
  start: () => actions.fire('start'),
  async submitPin(pin) {
    await actions.set('pinInput', pin);
    return actions.fire('pair');
  },
};
