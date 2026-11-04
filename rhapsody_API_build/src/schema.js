'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

// "Class.attr" patterns match the qualified name, patterns without a dot match the bare name.
function matcher(patterns) {
  const compiled = patterns.map((p) => ({ re: globToRegExp(p), qualified: p.includes('.') }));
  return (qualified, bare) => {
    const hit = compiled.find((p) => p.re.test(p.qualified ? qualified : bare));
    return hit ? hit.re.source : null;
  };
}

// Applies the exclusion / read-only rules of the configuration to the raw parsed model.
function applyFilters(model, config) {
  const excludedClass = matcher(config.exclude.classes);
  const excludedAttr = matcher(config.exclude.attributes);
  const excludedEvent = matcher(config.exclude.events);
  const readOnly = matcher(config.readOnly);

  const excluded = { classes: [], attributes: [], events: [] };
  const classes = [];
  for (const cls of model.classes) {
    if (excludedClass(cls.name, cls.name)) {
      excluded.classes.push(cls.name);
      continue;
    }
    const attributes = [];
    for (const a of cls.attributes) {
      if (excludedAttr(`${cls.name}.${a.name}`, a.name)) {
        excluded.attributes.push(`${cls.name}.${a.name}`);
        continue;
      }
      const forcedRo = readOnly(`${cls.name}.${a.name}`, a.name);
      attributes.push({ ...a, writable: a.writable && !forcedRo });
    }
    classes.push({ ...cls, attributes });
  }
  const events = [];
  for (const ev of model.events) {
    if (excludedEvent(ev.name, ev.name)) excluded.events.push(ev.name);
    else events.push(ev);
  }

  // A class is worth tracking when it exposes attributes or reacts to one of the exposed events.
  const handlers = new Set(events.flatMap((e) => e.handledBy));
  const tracked = classes.filter((c) => c.attributes.length > 0 || handlers.has(c.name));
  const dropped = classes.filter((c) => !tracked.includes(c)).map((c) => c.name);
  for (const ev of events) ev.handledBy = ev.handledBy.filter((h) => tracked.some((c) => c.name === h));
  return { classes: tracked, events, excluded, ignoredClasses: dropped };
}

function publicAttribute(a) {
  const out = { name: a.name, type: a.type, kind: a.kind, dims: a.dims, writable: a.writable };
  if (a.enumName) out.enum = a.enumName;
  if (a.maxLength !== undefined) out.maxLength = a.maxLength;
  if (a.static) out.static = true;
  if (a.const) out.const = true;
  out.access = a.access;
  return out;
}

function publicEvent(e) {
  return {
    name: e.name,
    args: e.args.map((a) => ({ name: a.name, type: a.type, kind: a.kind, ...(a.enumName ? { enum: a.enumName } : {}) })),
    handledBy: e.handledBy,
    file: e.file,
  };
}

// The API hash only depends on what a client can see (not on timestamps or file names).
function computeHash(classes, events) {
  const stable = {
    classes: classes.map((c) => ({
      name: c.name,
      reactive: c.reactive,
      attributes: c.attributes.map((a) => [a.name, a.kind, a.type, a.dims, a.writable]),
    })),
    events: events.map((e) => [e.name, e.args.map((a) => [a.name, a.kind]), e.handledBy]),
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 16);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function localTimestamp(date = new Date()) {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const off = `${sign}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`;
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return {
    iso: `${day}T${time}${off}`,
    stamp: `${day.replace(/-/g, '')}-${time.replace(/:/g, '')}`,
  };
}

function buildSchema({ filtered, model, config, generatorVersion, now = new Date(), sourceFiles = [] }) {
  const { iso } = localTimestamp(now);
  const classes = filtered.classes.map((c) => ({
    name: c.name,
    reactive: c.reactive,
    file: c.file,
    attributes: c.attributes.map(publicAttribute),
  }));
  const events = filtered.events.map(publicEvent);
  // generatedAt must stay the first key of the document.
  return {
    generatedAt: iso,
    schemaVersion: SCHEMA_VERSION,
    apiHash: computeHash(filtered.classes, filtered.events),
    generator: { name: 'rhapsody-api-build', version: generatorVersion },
    server: { host: config.server.host, port: config.server.port, pushRateHz: config.server.pushRateHz },
    source: { codeDir: config.codeDir, files: sourceFiles },
    protocol: {
      rest: {
        schema: 'GET /api/schema',
        state: 'GET /api/state',
        instances: 'GET /api/instances',
        readAttribute: 'GET /api/instances/{instance}/attrs/{attr}',
        writeAttribute: 'PUT /api/instances/{instance}/attrs/{attr}  {"value": ..., "index"?: n}',
        writeAttributes: 'PATCH /api/instances/{instance}/attrs  {"attr": value, ...}',
        writeState: 'PATCH /api/state  {"instance": {"attr": value}}',
        sendEvent: 'POST /api/instances/{instance}/events/{event}  {args}   |   POST /api/events/{event}  {"instance"?: ..., "args"?: ...}',
      },
      websocket: {
        url: '/ws',
        serverMessages: ['snapshot', 'delta', 'event', 'result', 'schema'],
        clientOps: ['set', 'event', 'snapshot', 'schema', 'ping'],
      },
    },
    classes,
    events,
    excluded: filtered.excluded,
    skipped: model.unsupported,
  };
}

function schemaFileName(baseName, stamp, counter = 0) {
  return `${baseName}.${stamp}${counter ? `-${counter}` : ''}.json`;
}

function writeSchema(schema, dir, baseName, now = new Date()) {
  fs.mkdirSync(dir, { recursive: true });
  const { stamp } = localTimestamp(now);
  let counter = 0;
  let file;
  do {
    file = path.join(dir, schemaFileName(baseName, stamp, counter++));
  } while (fs.existsSync(file));
  fs.writeFileSync(file, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  return file;
}

function findPreviousSchema(dir, baseName, exceptFile) {
  if (!fs.existsSync(dir)) return null;
  const re = new RegExp(`^${baseName.replace(/[.+^${}()|[\]\\]/g, '\\$&')}\\.\\d{8}-\\d{6}(-\\d+)?\\.json$`);
  const names = fs.readdirSync(dir).filter((n) => re.test(n)).sort();
  for (let i = names.length - 1; i >= 0; i--) {
    const full = path.join(dir, names[i]);
    if (exceptFile && path.resolve(full) === path.resolve(exceptFile)) continue;
    try {
      return { file: full, schema: JSON.parse(fs.readFileSync(full, 'utf8')) };
    } catch {
      // unreadable / foreign file: try the next one
    }
  }
  return null;
}

function attributeSignature(a) {
  return `${a.kind} ${a.type}${a.writable ? '' : ' (read-only)'}`;
}

function eventSignature(e) {
  return `(${e.args.map((a) => `${a.type} ${a.name}`).join(', ')})`;
}

// Compares two schemas and lists what changed for the API clients.
function diffSchemas(previous, current) {
  const flat = (s) => {
    const attrs = new Map();
    for (const c of s.classes) for (const a of c.attributes) attrs.set(`${c.name}.${a.name}`, attributeSignature(a));
    const events = new Map(s.events.map((e) => [e.name, eventSignature(e)]));
    return { attrs, events };
  };
  const p = flat(previous);
  const c = flat(current);
  const result = { attributes: { added: [], removed: [], changed: [] }, events: { added: [], removed: [], changed: [] } };
  for (const [key, group] of [['attrs', 'attributes'], ['events', 'events']]) {
    for (const [name, sig] of c[key]) {
      if (!p[key].has(name)) result[group].added.push(name);
      else if (p[key].get(name) !== sig) result[group].changed.push(`${name}: ${p[key].get(name)} → ${sig}`);
    }
    for (const name of p[key].keys()) if (!c[key].has(name)) result[group].removed.push(name);
  }
  const count = (g) => g.added.length + g.removed.length + g.changed.length;
  result.identical = count(result.attributes) + count(result.events) === 0;
  return result;
}

module.exports = {
  applyFilters,
  buildSchema,
  writeSchema,
  findPreviousSchema,
  diffSchemas,
  localTimestamp,
  globToRegExp,
  computeHash,
  SCHEMA_VERSION,
};
