'use strict';

const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${url}: invalid JSON (${text.slice(0, 80)})`);
  }
  return { status: res.status, body };
}

function wsSnapshot(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') return reject(new Error('global WebSocket unavailable (Node >= 22 required)'));
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('no WebSocket snapshot received'));
    }, timeoutMs);
    ws.onmessage = (m) => {
      const msg = JSON.parse(String(m.data));
      if (msg.type === 'snapshot') {
        clearTimeout(timer);
        ws.close();
        resolve(msg);
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('WebSocket error'));
    };
  });
}

// Starts the freshly built executable on a free port and exercises the REST + WebSocket API.
async function smokeTest(config, schema, log) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const token = config.server.token ? `?token=${encodeURIComponent(config.server.token)}` : '';
  const headers = config.server.token ? { Authorization: `Bearer ${config.server.token}` } : {};
  const env = { ...process.env, RHAPSODY_API_PORT: String(port), RHAPSODY_API_HOST: '127.0.0.1' };
  const child = spawn(config.exe, config.run.args, { cwd: config.run.cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let exited = null;
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  child.on('exit', (code) => (exited = code));
  let checks = 0;
  const pass = (msg) => {
    checks++;
    log.ok(msg);
  };
  try {
    const deadline = Date.now() + config.build.smokeTestTimeoutSec * 1000;
    let health = null;
    while (Date.now() < deadline && exited === null) {
      try {
        health = (await getJson(`${base}/api/health${token}`, { headers })).body;
        break;
      } catch {
        await sleep(200);
      }
    }
    if (!health) throw new Error(exited !== null ? `executable exited early (code ${exited})\n${output.slice(-500)}` : 'API did not answer in time');
    pass(`/api/health answered (${health.instances} tracked instances)`);

    for (const [label, mount, dir] of [['simple API page', config.web, config.web.dir], ['custom website', config.customWeb, config.customWeb.dir]]) {
      if (!fs.existsSync(path.join(path.dirname(config.exe), dir, 'index.html'))) continue;
      const r = await fetch(`${base}${mount.route === '/' ? '' : mount.route}/`);
      if (!r.ok || !/html/.test(r.headers.get('content-type') || '')) throw new Error(`${label} not served at ${mount.route}/ (HTTP ${r.status})`);
      pass(`${label} served at ${mount.route}/`);
    }

    const served = (await getJson(`${base}/api/schema${token}`, { headers })).body;
    if (served.apiHash !== schema.apiHash) throw new Error(`schema served by the executable differs (${served.apiHash} vs ${schema.apiHash})`);
    pass(`/api/schema matches the generated file (hash ${served.apiHash})`);

    const state = (await getJson(`${base}/api/state${token}`, { headers })).body;
    const ids = Object.keys(state.state);
    if (!ids.length) throw new Error('no instance registered in /api/state');
    pass(`/api/state returned ${ids.length} instance(s): ${ids.join(', ')}`);

    const snap = await wsSnapshot(`ws://127.0.0.1:${port}/ws${token}`, 5000);
    if (!snap.state || !Object.keys(snap.state).length) throw new Error('empty WebSocket snapshot');
    pass('WebSocket snapshot received');

    // Write back an unchanged value: proves the write path without disturbing the simulation.
    outer: for (const id of ids) {
      const cls = schema.classes.find((c) => id === c.name || id.startsWith(`${c.name}#`));
      if (!cls) continue;
      for (const a of cls.attributes.filter((x) => x.writable && !x.dims.length)) {
        const cur = state.state[id][a.name];
        if (cur === undefined) continue;
        const r = await getJson(`${base}/api/instances/${encodeURIComponent(id)}/attrs/${a.name}${token}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: cur }),
        });
        if (r.status !== 200 || r.body.ok === false) throw new Error(`write ${id}.${a.name} failed: ${JSON.stringify(r.body)}`);
        pass(`write-back ${id}.${a.name} = ${JSON.stringify(cur)}`);
        break outer;
      }
    }
  } catch (e) {
    return { ok: false, checks, error: e.message };
  } finally {
    if (exited === null) {
      child.kill();
      await sleep(300);
    }
  }
  return { ok: true, checks };
}

module.exports = { smokeTest, freePort };
