'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseJsonc } = require('../src/jsonc');
const { parseModel, maskCode } = require('../src/parser');
const { applyFilters, buildSchema, writeSchema, findPreviousSchema, diffSchemas } = require('../src/schema');
const { patchHeader, generateApiCpp } = require('../src/codegen');
const { loadConfig } = require('../src/config');
const { applyAttributeOverrides } = require('../src/attribute-overrides');

const HEADER = `
//## package Pkg
#define N_ITEMS 3
typedef enum { A, B } Mode;
//## class Car
class Car : public OMReactive {
protected:
    double speed;		//## attribute speed
    bool on;		//## attribute on
    OMString names[N_ITEMS];		//## attribute names
    Mode mode;		//## attribute mode
    char label[16];		//## attribute label
    const int fixed;		//## attribute fixed
    int* ptr;		//## attribute ptr
    int hidden;		//## attribute hidden
    // double commented;		//## attribute commented
};
//## event ev_go()
class ev_go : public OMEvent {
public:
    ev_go();
};
//## event ev_set(double,OMString)
class ev_set : public OMEvent {
public:
    ev_set(double p_value, OMString p_text);
    ev_set();
};
`;
const SOURCE = `
IOxfReactive::TakeEventStatus Car::idle_handleEvent() {
    if(IS_EVENT_TYPE_OF(ev_go_Pkg_id)) { }
    return eventNotConsumed;
}
`;

const files = [
  { name: 'Car.h', text: HEADER },
  { name: 'Car.cpp', text: SOURCE },
];

test('jsonc: comments and trailing commas', () => {
  assert.deepStrictEqual(parseJsonc('{ // c\n "a": [1,2,], /* x */ "b": "//not", }', 't'), { a: [1, 2], b: '//not' });
  assert.throws(() => parseJsonc('{ "a": }', 't'), /t/);
});

test('maskCode keeps offsets and hides comments / strings', () => {
  const src = 'a // x{\n"}" b';
  const masked = maskCode(src);
  assert.strictEqual(masked.length, src.length);
  assert.ok(!masked.includes('{') && !masked.includes('}'));
});

test('parser: classes, attributes, events', () => {
  const m = parseModel(files);
  const car = m.classes.find((c) => c.name === 'Car');
  assert.ok(car.reactive);
  const byName = Object.fromEntries(car.attributes.map((a) => [a.name, a]));
  assert.strictEqual(byName.speed.kind, 'float');
  assert.strictEqual(byName.on.kind, 'bool');
  assert.deepStrictEqual(byName.names.dims, [3]);
  assert.strictEqual(byName.names.kind, 'string');
  assert.strictEqual(byName.mode.kind, 'int');
  assert.strictEqual(byName.label.kind, 'string');
  assert.strictEqual(byName.label.maxLength, 15);
  assert.strictEqual(byName.fixed.writable, false);
  assert.ok(!byName.ptr && !byName.commented);
  assert.ok(m.unsupported.some((u) => u.name === 'ptr'));
  const set = m.events.find((e) => e.name === 'ev_set');
  assert.deepStrictEqual(set.args.map((a) => [a.name, a.kind]), [['value', 'float'], ['text', 'string']]);
  assert.deepStrictEqual(m.events.find((e) => e.name === 'ev_go').handledBy, ['Car']);
});

const baseConfig = (extra = {}) => ({
  codeDir: '/x',
  exclude: { classes: [], attributes: [], events: [], ...extra.exclude },
  readOnly: extra.readOnly || [],
  server: { host: '127.0.0.1', port: 8080, pushRateHz: 20, cors: true, token: '' },
  web: { dir: 'web', route: '/api' },
  customWeb: { dir: 'custom_web_interface', route: '/custom' },
});

test('filters: exclusion globs and readOnly', () => {
  const m = parseModel(files);
  const f = applyFilters(m, baseConfig({ exclude: { attributes: ['hidden', 'Car.na*'], events: ['ev_s?t'] }, readOnly: ['speed'] }));
  const names = f.classes[0].attributes.map((a) => a.name);
  assert.ok(!names.includes('hidden') && !names.includes('names'));
  assert.strictEqual(f.classes[0].attributes.find((a) => a.name === 'speed').writable, false);
  assert.deepStrictEqual(f.events.map((e) => e.name), ['ev_go']);
});

test('schema: timestamped, never overwritten, diff with previous', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapi-'));
  const cfg = baseConfig();
  const m = parseModel(files);
  const f1 = applyFilters(m, cfg);
  const now = new Date(2026, 0, 2, 3, 4, 5);
  const s1 = buildSchema({ filtered: f1, model: m, config: cfg, generatorVersion: 't', now });
  assert.strictEqual(Object.keys(s1)[0], 'generatedAt');
  const a = writeSchema(s1, dir, 'api', now);
  const b = writeSchema(s1, dir, 'api', now);
  assert.notStrictEqual(a, b);
  assert.match(path.basename(a), /^api\.20260102-030405\.json$/);
  const f2 = applyFilters(m, baseConfig({ exclude: { attributes: ['speed'], events: ['ev_go'] } }));
  const s2 = buildSchema({ filtered: f2, model: m, config: cfg, generatorVersion: 't', now });
  const prev = findPreviousSchema(dir, 'api', null);
  const d = diffSchemas(prev.schema, s2);
  assert.deepStrictEqual(d.attributes.removed, ['Car.speed']);
  assert.deepStrictEqual(d.events.removed, ['ev_go']);
  assert.strictEqual(diffSchemas(s1, s1).identical, true);
  assert.notStrictEqual(s1.apiHash, s2.apiHash);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('codegen: header patch and api_gen.cpp', () => {
  const m = parseModel(files);
  const cfg = baseConfig();
  const f = applyFilters(m, cfg);
  const patched = patchHeader(HEADER, f.classes);
  assert.ok(patched.includes('rhapsody_api_track.h'));
  assert.ok(patched.includes('_rhapi_tracker{"Car"'));
  assert.ok(patched.indexOf('_rhapi_tracker') < patched.indexOf('//## event ev_go'));
  assert.strictEqual(patchHeader(patched, f.classes), patched, 'patching twice is a no-op');
  const cpp = generateApiCpp({ filtered: f, schemaText: '{"a":1}', config: cfg, headers: ['Car.h'] });
  assert.ok(cpp.includes('static_cast<Car*>(o)->speed'));
  assert.ok(cpp.includes('GEN(ev_set(p0, p1))'));
  assert.ok(!/s0_\d+.*->fixed/.test(cpp), 'const attribute has no setter');
});

test('attribute overrides replace only configured constructor initializers', () => {
  const header = `
//## class Car
class Car {
  OMString soundDir; //## attribute soundDir
  int speed; //## attribute speed
};
//## class Other
class Other {
  OMString soundDir; //## attribute soundDir
};
`;
  const source = String.raw`
Car::Car() : soundDir("..\\..\\sons\\"), speed(compute(1, 2)) { speed = 3; }
Other::Other() : soundDir("unchanged") {}
`;
  const input = [{ name: 'Car.h', text: header }, { name: 'Car.cpp', text: source }];
  const model = parseModel(input);
  const changed = applyAttributeOverrides(input, model, [
    { class: 'Car', attribute: 'soundDir', type: 'OMString', value: 'sons\\' },
    { class: 'Car', attribute: 'speed', type: 'int', value: 42 },
  ]);
  assert.ok(changed.get('Car.cpp').includes(String.raw`soundDir("sons\\"), speed(42) { speed = 3; }`));
  assert.ok(changed.get('Car.cpp').includes('Other::Other() : soundDir("unchanged")'));
  assert.ok(input[1].text.includes(String.raw`soundDir("..\\..\\sons\\")`));
  assert.throws(() => applyAttributeOverrides(input, model, [{ attribute: 'soundDir', type: 'OMString', value: '' }]), /ambiguous/);
  assert.throws(() => applyAttributeOverrides(input, model, [{ class: 'Car', attribute: 'speed', type: 'bool', value: true }]), /type bool/);
  assert.throws(() => applyAttributeOverrides(input, model, [{ class: 'Car', attribute: 'speed', type: 'int', value: 1.5 }]), /32-bit integer/);
});

test('attribute overrides fail if a constructor does not initialize the attribute', () => {
  const header = '//## class Car\nclass Car {\n bool enabled; //## attribute enabled\n};\n';
  const source = 'Car::Car() : enabled(false) {}\nCar::Car(int n) : other(n) {}\n';
  const input = [{ name: 'Car.h', text: header }, { name: 'Car.cpp', text: source }];
  assert.throws(() => applyAttributeOverrides(input, parseModel(input), [
    { attribute: 'enabled', type: 'bool', value: true },
  ]), /has no initializer for enabled/);
});

test('attribute overrides support empty std::string values', () => {
  const header = '//## class Car\nclass Car {\n std::string name; //## attribute name\n};\n';
  const input = [{ name: 'Car.h', text: header }, { name: 'Car.cpp', text: 'Car::Car() : name("old") {}' }];
  const changed = applyAttributeOverrides(input, parseModel(input), [
    { attribute: 'name', type: 'std::string', value: '' },
  ]);
  assert.strictEqual(changed.get('Car.cpp'), 'Car::Car() : name("") {}');
});

test('config: unknown keys rejected, paths resolved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapi-'));
  fs.mkdirSync(path.join(dir, 'code'));
  const file = path.join(dir, 'c.jsonc');
  fs.writeFileSync(file, '{ "codeDir": "./code", "server": { "port": 9000 }, }');
  const cfg = loadConfig(file);
  assert.strictEqual(cfg.codeDir, path.join(dir, 'code'));
  assert.strictEqual(cfg.server.port, 9000);
  assert.strictEqual(cfg.server.pushRateHz, 20);
  fs.writeFileSync(file, '{ "codeDir": "./code", "bogus": 1 }');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('config: generated code and assets resolve from the project directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapi-'));
  try {
    const project = path.join(dir, 'project');
    fs.mkdirSync(path.join(project, 'CodesGeneres', 'ModeAnimation'), { recursive: true });
    const file = path.join(dir, 'c.jsonc');
    fs.writeFileSync(file, JSON.stringify({
      projectDir: 'project',
      codeDir: 'CodesGeneres/ModeAnimation',
      assets: [{ from: 'sons', to: 'sons' }],
      run: { useExeDir: true },
    }));
    const cfg = loadConfig(file);
    assert.strictEqual(cfg.codeDir, path.join(project, 'CodesGeneres', 'ModeAnimation'));
    assert.strictEqual(cfg.assets[0].from, path.join(project, 'sons'));
    assert.strictEqual(cfg.run.useExeDir, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('config: custom site.json drives host/port/token, routes validated', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapi-'));
  fs.mkdirSync(path.join(dir, 'code'));
  fs.mkdirSync(path.join(dir, 'custom_web_interface'));
  fs.writeFileSync(path.join(dir, 'custom_web_interface', 'site.json'), '{ "api": { "host": "localhost", "port": 9123, "token": "t" } }');
  const file = path.join(dir, 'c.jsonc');
  fs.writeFileSync(file, '{ "codeDir": "./code", "copyTo": ["./out"] }');
  const cfg = loadConfig(file, { copyTo: [path.join(dir, 'other')] });
  assert.strictEqual(cfg.server.port, 9123);
  assert.strictEqual(cfg.server.host, '127.0.0.1');
  assert.strictEqual(cfg.server.token, 't');
  assert.deepStrictEqual(cfg.copyTo, [path.join(dir, 'out'), path.join(dir, 'other')]);
  assert.strictEqual(loadConfig(file, { port: 9500 }).server.port, 9500);
  assert.strictEqual(cfg.customWeb.route, '/custom');
  fs.writeFileSync(file, '{ "codeDir": "./code", "customWeb": { "route": "/api" } }');
  assert.throws(() => loadConfig(file), /different/);
  fs.writeFileSync(file, '{ "codeDir": "./code", "web": { "route": "api/" } }');
  assert.throws(() => loadConfig(file), /route/);
  fs.rmSync(dir, { recursive: true, force: true });
});
