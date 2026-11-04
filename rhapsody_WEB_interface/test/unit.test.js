import { describe, it, expect } from 'vitest';
import { parseJsonc } from '../src/core/jsonc.js';
import { applyMessage } from '../src/core/api-client.js';
import { mergeSettings, resolveSettings } from '../src/core/settings.js';
import { resolveInstanceId, findStateKey, validateMap } from '../src/core/resolve.js';
import apiMap from '../api-map.jsonc';

const schema = {
  classes: [{ name: '_SysVehicule', attributes: [{ name: 'speed', kind: 'int', writable: true }, { name: 'accelPedal', kind: 'float', writable: true }] }],
  events: [{ name: 'ev_demarrer', args: [] }],
};

describe('jsonc', () => {
  it('ignore commentaires et virgules finales', () => {
    expect(parseJsonc('{ // c\n "a": "x//y", /* b */ "b": [1,2,], }')).toEqual({ a: 'x//y', b: [1, 2] });
  });
});

describe('applyMessage', () => {
  it('snapshot puis delta', () => {
    const m = { state: {}, instances: [] };
    applyMessage(m, { type: 'snapshot', instances: ['A'], state: { A: { x: 1 } } });
    applyMessage(m, { type: 'delta', added: ['B'], removed: [], changes: { A: { x: 2 }, B: { y: 3 } } });
    expect(m.state.A.x).toBe(2);
    expect(m.state.B.y).toBe(3);
    applyMessage(m, { type: 'delta', added: [], removed: ['B'], changes: {} });
    expect(m.state.B).toBeUndefined();
  });
});

describe('settings', () => {
  const defaults = { api: { url: 'http://a', token: '', reconnectMs: 1000 }, ui: { theme: 'dark', showDebug: false } };
  it('ne garde que les clés connues', () => {
    expect(mergeSettings(defaults, { api: { url: 'http://b', foo: 1 }, bar: 2 })).toEqual({ ...defaults, api: { ...defaults.api, url: 'http://b' } });
  });
  it('resolveSettings tolère un stockage vide ou invalide', () => {
    expect(resolveSettings(defaults, { getItem: () => null })).toEqual(defaults);
    expect(resolveSettings(defaults, { getItem: () => '{oops' })).toEqual(defaults);
    expect(resolveSettings(defaults, { getItem: () => '{"ui":{"theme":"light"}}' }).ui.theme).toBe('light');
  });
});

describe('résolution', () => {
  it('trouve la classe et la clé d\'état', () => {
    expect(resolveInstanceId(schema, 'speed')).toBe('_SysVehicule');
    expect(findStateKey({ '_SysVehicule#2': {} }, '_SysVehicule')).toBe('_SysVehicule#2');
  });
  it('valide api-map.jsonc contre le schéma', () => {
    const p = validateMap({ attributes: { a: { api: 'nope' }, b: { api: 'speed' } }, events: { c: 'ev_demarrer', d: 'ev_nope' } }, schema);
    expect(p.map((x) => x.name)).toEqual(['nope', 'ev_nope']);
  });
  it('api-map.jsonc est cohérent', () => {
    for (const g of apiMap.parameters) for (const it of g.items) expect(apiMap.attributes[it.key], it.key).toBeTruthy();
    for (const def of Object.values(apiMap.attributes)) expect(['number', 'boolean', 'string', 'list']).toContain(def.type);
  });
});
import { pairingStep, speedScaleMax, buildCar } from '../src/core/car.js';
describe('car', () => {
  const messages = ['a', 'b', 'c', 'd', 'e', 'f'];
  it('pairingStep follows the statechart messages', () => {
    expect(pairingStep({ phoneBluetooth: false, connected: false, message: 'a', messages })).toBe('phone_off');
    expect(pairingStep({ phoneBluetooth: true, connected: false, message: 'c', messages })).toBe('password');
    expect(pairingStep({ phoneBluetooth: true, connected: true, message: 'e', messages })).toBe('connected');
  });
  it('speedScaleMax rounds up', () => {
    expect(speedScaleMax(120)).toBe(140);
    expect(speedScaleMax(10)).toBe(60);
  });
  it('buildCar lit les valeurs via le nom d\'API du JSON', () => {
    const values = { float_speed: 42, cmd_contact: true, messages_appairage: ['x'] };
    const c = buildCar(apiMap.attributes, (name) => values[name]);
    expect(c.speed.value).toBe(42);
    expect(c.contact.value).toBe(true);
    expect(c.engine.value).toBe(false);
    expect(c.messages.value).toEqual(['x']);
    expect(c.maxSpeed.value).toBe(120);
  });
});
