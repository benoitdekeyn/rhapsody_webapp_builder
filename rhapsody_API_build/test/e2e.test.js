'use strict';

// End-to-end test against the executable built from the real project (run `npm run build` first).
// Skipped when the executable does not exist.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadConfig, findConfig } = require('../src/config');
const { freePort } = require('../src/smoke');

const root = path.join(__dirname, '..');
const configPath = findConfig(root);
const config = configPath ? loadConfig(configPath) : null;
const hasExe = config && fs.existsSync(config.exe);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('built simulator: REST + WebSocket', { skip: !hasExe && 'executable not built', timeout: 60000 }, async (t) => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(config.exe, [], { cwd: config.run.cwd, env: { ...process.env, RHAPSODY_API_PORT: String(port) }, windowsHide: true });
  t.after(() => child.kill());
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      await sleep(200);
    }
  }
  const j = async (url, init) => {
    const r = await fetch(base + url, init);
    return { status: r.status, body: await r.json() };
  };
  const post = (url, body) => j(url, { method: 'POST', body: JSON.stringify(body ?? {}) });
  const put = (url, body) => j(url, { method: 'PUT', body: JSON.stringify(body) });

  const schema = (await j('/api/schema')).body;
  assert.ok(Object.keys(schema)[0] === 'generatedAt');
  const cls = schema.classes.find((c) => c.attributes.length);
  const state = (await j('/api/state')).body;
  const id = Object.keys(state.state)[0];
  assert.ok(id.startsWith(cls.name));

  await t.test('write / read back a scalar', async () => {
    const attr = cls.attributes.find((a) => a.kind === 'float' && a.writable && !a.dims.length);
    assert.ok(attr, 'a writable float attribute is expected');
    const w = await put(`/api/instances/${id}/attrs/${attr.name}`, { value: 12.5 });
    assert.strictEqual(w.status, 200);
    const r = await j(`/api/instances/${id}/attrs/${attr.name}`);
    assert.strictEqual(r.body.value, 12.5);
  });

  await t.test('write one array element', async () => {
    const attr = cls.attributes.find((a) => a.dims.length === 1 && a.writable);
    if (!attr) return;
    const w = await put(`/api/instances/${id}/attrs/${attr.name}`, { value: 'zz', index: 1 });
    assert.strictEqual(w.status, 200);
    const r = await j(`/api/instances/${id}/attrs/${attr.name}`);
    assert.strictEqual(r.body.value[1], 'zz');
  });

  await t.test('rejects bad values and unknown names', async () => {
    const attr = cls.attributes.find((a) => a.kind === 'float' && a.writable && !a.dims.length);
    assert.strictEqual((await put(`/api/instances/${id}/attrs/${attr.name}`, { value: 'not a number' })).status, 400);
    assert.ok((await put(`/api/instances/${id}/attrs/nope`, { value: 1 })).status >= 400);
    assert.ok((await post('/api/events/nope')).status >= 400);
  });

  await t.test('sends events (with and without arguments)', async () => {
    const plain = schema.events.find((e) => e.args.length === 0 && e.handledBy.length);
    assert.strictEqual((await post(`/api/events/${plain.name}`)).status, 200);
    const withArg = schema.events.find((e) => e.args.length === 1 && e.handledBy.length);
    if (withArg) {
      const arg = withArg.args[0];
      const value = arg.kind === 'string' ? 'abc' : 1;
      assert.strictEqual((await post(`/api/events/${withArg.name}`, { [arg.name]: value })).status, 200);
      assert.strictEqual((await post(`/api/events/${withArg.name}`, {})).status, 400);
    }
  });

  await t.test('serves the simple page, custom site and redirects', async () => {
    const exeDir = path.dirname(config.exe);
    const noFollow = (url) => fetch(base + url, { redirect: 'manual' });
    const simple = await fetch(`${base}${config.web.route}/`);
    assert.strictEqual(simple.status, 200);
    assert.match(simple.headers.get('content-type'), /html/);
    assert.strictEqual((await fetch(`${base}${config.web.route}/sim-client.js`)).status, 200);
    assert.strictEqual((await fetch(`${base}/api/health`)).status, 200);
    assert.strictEqual((await noFollow(config.web.route)).status, 302);
    const hasCustom = fs.existsSync(path.join(exeDir, config.customWeb.dir, 'index.html'));
    const root = await noFollow('/');
    assert.strictEqual(root.status, 302);
    assert.strictEqual(root.headers.get('location'), `${hasCustom ? config.customWeb.route : config.web.route}/`);
    if (hasCustom) assert.strictEqual((await fetch(`${base}${config.customWeb.route}/`)).status, 200);
    assert.strictEqual((await fetch(`${base}${config.web.route}/..%2f..%2fsimulateur.exe`)).status >= 400, true);
  });

  await t.test('WebSocket: snapshot, set, delta', async () => {
    const attr = cls.attributes.find((a) => a.kind === 'float' && a.writable && !a.dims.length);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const msgs = [];
    ws.onmessage = (m) => msgs.push(JSON.parse(String(m.data)));
    for (let i = 0; i < 50 && !msgs.some((m) => m.type === 'snapshot'); i++) await sleep(100);
    assert.ok(msgs.some((m) => m.type === 'snapshot'));
    ws.send(JSON.stringify({ op: 'set', reqId: 7, instance: id, attr: attr.name, value: 99.25 }));
    for (let i = 0; i < 50 && !msgs.some((m) => m.type === 'result'); i++) await sleep(100);
    const res = msgs.find((m) => m.type === 'result');
    assert.ok(res && res.ok && res.reqId === 7, JSON.stringify(res));
    for (let i = 0; i < 50 && !msgs.some((m) => m.type === 'delta' && JSON.stringify(m).includes('99.25')); i++) await sleep(100);
    assert.ok(msgs.some((m) => m.type === 'delta' && JSON.stringify(m).includes('99.25')), 'delta with the new value');
    ws.close();
  });
});
