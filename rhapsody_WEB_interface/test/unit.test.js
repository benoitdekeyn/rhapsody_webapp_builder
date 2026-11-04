import { describe, it, expect } from 'vitest';
import { parseJsonc } from '../src/core/jsonc.js';
import { applyMessage } from '../src/core/api-client.js';
import { mergeSettings, resolveSettings } from '../src/core/settings.js';
import { resolveInstanceId, findStateKey, validateDashboard } from '../src/core/resolve.js';
import { mergeOptions } from '../src/core/binding.js';
import dashboard from '../src/dashboard/dashboard.config.jsonc';

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
  it('mergeOptions fusionne en profondeur', () => {
    expect(mergeOptions({ a: 1, c: { x: 1, y: 2 } }, { c: { y: 3 } })).toEqual({ a: 1, c: { x: 1, y: 3 } });
  });
  it('valide le dashboard', () => {
    const p = validateDashboard({ sections: [{ items: [{ component: 'Led', attribute: 'nope' }, { component: 'PushButton', event: 'ev_demarrer' }] }] }, schema);
    expect(p).toHaveLength(1);
    expect(p[0].name).toBe('nope');
  });
  it('la config du dashboard est valide JSONC', () => {
    expect(dashboard.sections.length).toBeGreaterThan(0);
  });
});
