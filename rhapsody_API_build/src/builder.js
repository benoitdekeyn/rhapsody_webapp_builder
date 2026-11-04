'use strict';

const fs = require('fs');
const path = require('path');
const log = require('./logger');
const { parseModel } = require('./parser');
const { applyFilters, buildSchema, writeSchema, findPreviousSchema, diffSchemas, globToRegExp } = require('./schema');
const { patchHeader, generateApiCpp } = require('./codegen');
const tool = require('./toolchain');
const { smokeTest } = require('./smoke');

const VERSION = require('../package.json').version;
const RUNTIME_DIR = path.join(__dirname, '..', 'runtime');
const TOTAL_STEPS = 8;

function readSources(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.(h|hpp|c|cpp|cc|cxx)$/i.test(d.name))
    .map((d) => ({ name: d.name, text: fs.readFileSync(path.join(dir, d.name), 'latin1') }));
}

// Parses the generated code and applies the configured filters (no compilation).
function analyze(config) {
  const files = readSources(config.codeDir);
  if (!files.length) throw new Error(`No C++ source found in ${config.codeDir}`);
  const model = parseModel(files, { typeMap: config.typeMap });
  const filtered = applyFilters(model, config);
  return { files, model, filtered };
}

function logModel({ model, filtered }) {
  for (const w of model.warnings) log.warn(w);
  for (const u of model.unsupported) {
    log.warn(`Skipped ${u.kind} ${u.class ? `${u.class}.` : ''}${u.name}: ${u.reason} (${u.type}). Use "typeMap" to expose it.`);
  }
  const attrCount = filtered.classes.reduce((n, c) => n + c.attributes.length, 0);
  for (const c of filtered.classes) {
    const rw = c.attributes.filter((a) => a.writable).length;
    log.ok(`${log.c.bold(c.name)}${c.reactive ? log.c.gray(' (reactive)') : ''}: ${c.attributes.length} attributes (${rw} writable)`);
  }
  log.ok(`${filtered.events.length} events`);
  if (filtered.ignoredClasses.length) log.detail(`Ignored classes without exposed attributes: ${filtered.ignoredClasses.join(', ')}`);
  const ex = filtered.excluded;
  if (ex.attributes.length || ex.events.length || ex.classes.length) {
    log.info(`Excluded by configuration: ${ex.classes.length} classes, ${ex.attributes.length} attributes, ${ex.events.length} events`);
  }
  return attrCount;
}

function copyDir(src, dst, skip = new Set()) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (skip.has(path.resolve(s))) continue;
    if (e.isDirectory()) copyDir(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

function fmtSize(bytes) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

async function build(config, options = {}) {
  const started = Date.now();
  const rows = [];
  let schemaFile = null;
  let diffInfo = null;
  let attrCount = 0;
  let eventCount = 0;

  function finish(success, errorMessage) {
    const out = [];
    const exeRow = rows.find((r) => r[0] === 'Executable');
    if (success && exeRow) out.push(exeRow);
    const rest = rows.filter((r) => r[0] !== 'Executable');
    if (schemaFile) {
      out.push(['Schema', schemaFile, 'good']);
      out.push(['API', `${attrCount} attributes, ${eventCount} events`]);
      if (diffInfo) {
        const d = diffInfo;
        out.push([
          'Changes',
          d.identical
            ? 'none since previous schema'
            : `attributes +${d.attributes.added.length} -${d.attributes.removed.length} ~${d.attributes.changed.length}, events +${d.events.added.length} -${d.events.removed.length} ~${d.events.changed.length}`,
          d.identical ? 'good' : 'warn',
        ]);
      }
    }
    out.push(...rest);
    out.push(['Warnings', String(log.warnings.length), log.warnings.length ? 'warn' : 'good']);
    out.push(['Duration', `${((Date.now() - started) / 1000).toFixed(1)} s`]);
    if (success && !options.analyzeOnly) {
      out.push(['Run', `node src/cli.js run   (or ${config.exe})`]);
      if (config.server.port) {
        const base = `http://${config.server.host === '0.0.0.0' ? 'localhost' : config.server.host}:${config.server.port}`;
        out.push(['URL', `${base}${config.customWeb.source && fs.existsSync(path.join(config.exe, '..', config.customWeb.dir, 'index.html')) ? config.customWeb.route + '/' : config.web.route + '/'}`]);
        out.push(['API page', `${base}${config.web.route}/`]);
      }
    }
    log.summary({ success, rows: out, errorMessage });
    return { success, schemaFile, error: errorMessage };
  }

  try {
    log.banner(`Rhapsody API build v${VERSION}`);
    log.info(`Config : ${config.configFile}`);
    log.info(`Source : ${config.codeDir}`);
    log.info(`Target : ${config.exe}`);

    log.step(1, TOTAL_STEPS, 'Analyzing generated code');
    const analysis = analyze(config);
    log.ok(`${analysis.files.length} files read`);
    attrCount = logModel(analysis);
    const { filtered, model } = analysis;
    eventCount = filtered.events.length;
    if (!filtered.classes.length) throw new Error('No class with exposed attributes or handled events was found. Check "codeDir" and "exclude".');

    log.step(2, TOTAL_STEPS, 'Writing timestamped API schema');
    const now = new Date();
    const schema = buildSchema({
      filtered,
      model,
      config,
      generatorVersion: VERSION,
      now,
      sourceFiles: analysis.files.map((f) => f.name).sort(),
    });
    schemaFile = writeSchema(schema, config.schema.dir, config.schema.baseName, now);
    const previous = findPreviousSchema(config.schema.dir, config.schema.baseName, schemaFile);
    log.ok(`${path.relative(config.root, schemaFile)}  ${log.c.gray(`(hash ${schema.apiHash})`)}`);
    if (previous) {
      diffInfo = diffSchemas(previous.schema, schema);
      if (diffInfo.identical) log.info(`API identical to previous version (${path.basename(previous.file)})`);
      else {
        log.info(`Changes since ${path.basename(previous.file)}:`);
        for (const group of ['attributes', 'events']) {
          const g = diffInfo[group];
          for (const x of g.added) log.line(`    ${log.c.green('+')} ${group.slice(0, -1)} ${x}`);
          for (const x of g.removed) log.line(`    ${log.c.red('-')} ${group.slice(0, -1)} ${x}`);
          for (const x of g.changed) log.line(`    ${log.c.yellow('~')} ${group.slice(0, -1)} ${x}`);
        }
      }
    } else log.info('First schema for this folder (no previous version to compare with)');
    const schemaText = JSON.stringify(schema, null, 2) + '\n';

    if (options.analyzeOnly) {
      rows.push(['Mode', 'schema only (no executable built)', 'warn']);
      return finish(true);
    }

    log.step(3, TOTAL_STEPS, 'Locating toolchain');
    const vcvars = tool.findVcvars(config.build.vcvarsPath);
    log.ok(`Visual Studio: ${vcvars}`);
    const env = tool.loadVcEnv(vcvars);
    const rh = tool.locateRhapsody(config, config.codeDir);
    log.ok(`Rhapsody framework: ${rh.omroot}`);
    log.ok(`Framework libs: ${path.join(rh.libRoot, 'LangCpp', 'lib')} (${rh.prefix})`);
    const fw = tool.frameworkLibs(config, rh);
    if (fw.missing.length) {
      throw new Error(`Missing Rhapsody libraries: ${fw.missing.map((m) => path.basename(m)).join(', ')} (build type ${config.build.buildType}, instrumentation ${config.build.instrumentation})`);
    }

    log.step(4, TOTAL_STEPS, 'Preparing working copy and injecting the API');
    const work = config.build.workDir;
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    const excludeSrc = config.build.excludeSources.map(globToRegExp);
    for (const f of analysis.files) {
      if (/\.(c|cpp|cc|cxx)$/i.test(f.name) && excludeSrc.some((re) => re.test(f.name))) {
        log.detail(`excluded source: ${f.name}`);
        continue;
      }
      let text = f.text;
      // Animation-style main: initialize(argc, argv, port) does not exist without OMANIMATOR.
      if (config.build.instrumentation === 'None' && /OXF::initialize\(\s*argc\s*,\s*argv\s*,[^)]*\)/.test(text)) {
        text = text.replace(/OXF::initialize\(\s*argc\s*,\s*argv\s*,[^)]*\)/g, 'OXF::initialize()');
        log.detail(`${f.name}: animation-style OXF::initialize() adapted to a standalone build`);
      }
      fs.writeFileSync(path.join(work, f.name), text, 'latin1');
    }
    const byFile = new Map();
    for (const c of filtered.classes) byFile.set(c.file, [...(byFile.get(c.file) || []), c]);
    for (const [file, classes] of byFile) {
      const src = analysis.files.find((f) => f.name === file);
      fs.writeFileSync(path.join(work, file), patchHeader(src.text, classes), 'latin1');
      log.ok(`patched ${file}: ${classes.map((c) => c.name).join(', ')}`);
    }
    const headers = [...new Set([...filtered.classes.map((c) => c.file), ...filtered.events.map((e) => e.file)])].sort();
    fs.writeFileSync(path.join(work, 'api_gen.cpp'), generateApiCpp({ filtered, schemaText, config, headers }), 'latin1');
    for (const f of fs.readdirSync(RUNTIME_DIR)) fs.copyFileSync(path.join(RUNTIME_DIR, f), path.join(work, f));
    log.ok('api_gen.cpp generated, runtime copied');

    log.step(5, TOTAL_STEPS, 'Compiling and linking');
    const sources = fs.readdirSync(work).filter((f) => /\.(c|cpp|cc|cxx)$/i.test(f)).sort();
    const b = config.build;
    const debug = b.buildType === 'Debug';
    const anim = b.instrumentation === 'Animation';
    const objDir = path.join(work, 'obj');
    fs.mkdirSync(objDir, { recursive: true });
    const exeTmp = path.join(work, path.basename(config.exe));
    const lang = path.join(rh.omroot, 'LangCpp');
    const args = [
      '/nologo', '/std:c++17', '/MP', '/FS', '/EHa', '/W3',
      '/I.', `/I${lang}`, `/I${path.join(lang, 'oxf')}`, `/I${path.join(lang, 'osconfig', 'WIN32')}`,
      ...(anim ? ['/DOMANIMATOR', `/I${path.join(lang, 'aom')}`, `/I${path.join(lang, 'tom')}`] : []),
      '/D_CRT_SECURE_NO_DEPRECATE', '/D_CRT_SECURE_NO_WARNINGS', '/D_AFXDLL', '/DWIN32', '/D_CONSOLE', '/D_MBCS', '/D_WINDOWS',
      '/D_WINSOCK_DEPRECATED_NO_WARNINGS', '/DNOMINMAX',
      ...(debug ? ['/Zi', '/Od', '/D_DEBUG', '/MDd'] : ['/O2', '/DNDEBUG', '/MD']),
      ...b.extraDefines.map((d) => `/D${d}`),
      ...b.extraIncludes.map((i) => `/I${path.resolve(config.root, i)}`),
      ...b.extraCompilerFlags,
      `/Fo${objDir.replace(/\\/g, '/')}/`, `/Fd${path.join(work, 'vc.pdb')}`,
      ...sources,
      `/Fe${exeTmp}`,
      '/link', '/SUBSYSTEM:console', '/MACHINE:x64', ...(debug ? ['/DEBUG'] : []),
      ...fw.libs, 'winmm.lib', 'ws2_32.lib', 'wsock32.lib', ...b.extraLibs, ...b.extraLinkerFlags,
    ];
    const rsp = path.join(work, 'cl.rsp');
    fs.writeFileSync(rsp, args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join('\n'), 'latin1');
    log.info(`${sources.length} translation units, ${b.buildType}, instrumentation ${b.instrumentation}`);
    let nWarn = 0;
    let nErr = 0;
    const result = await tool.run('cl.exe', [`@${rsp}`], {
      cwd: work,
      env,
      onLine: (l) => {
        if (/\berror\s+[A-Z]*\d+|fatal error|LNK\d+/.test(l)) {
          nErr++;
          log.line(`    ${log.c.red(l)}`);
        } else if (/warning\s+[A-Z]+\d+/.test(l)) {
          nWarn++;
          if (options.verbose) log.line(`    ${log.c.yellow(l)}`);
        } else if (options.verbose && l.trim()) log.debug(l);
      },
    });
    if (result.code !== 0 || !fs.existsSync(exeTmp)) {
      throw new Error(`Compilation failed (cl exit code ${result.code}, ${nErr} errors). Working copy kept in ${work}`);
    }
    log.ok(`Compiled: ${nErr} errors, ${nWarn} compiler warnings`);
    if (nWarn && !options.verbose) log.detail('Use --verbose to display compiler warnings');

    log.step(6, TOTAL_STEPS, 'Installing executable, web UI and assets');
    fs.mkdirSync(path.dirname(config.exe), { recursive: true });
    try {
      fs.copyFileSync(exeTmp, config.exe);
    } catch (e) {
      throw new Error(`Cannot write ${config.exe} (${e.code}). Is the simulator still running?`);
    }
    const size = fs.statSync(config.exe).size;
    log.ok(`${config.exe} (${fmtSize(size)})`);
    const exeDir = path.dirname(config.exe);
    if (config.web.source && fs.existsSync(config.web.source)) {
      const webDst = path.join(exeDir, config.web.dir);
      fs.rmSync(webDst, { recursive: true, force: true });
      copyDir(config.web.source, webDst);
      log.ok(`simple API page copied to ${path.relative(config.root, webDst)} (served at ${config.web.route})`);
    } else if (config.web.source) log.warn(`web.source not found, no simple page copied: ${config.web.source}`);
    const customDst = path.join(exeDir, config.customWeb.dir);
    fs.rmSync(customDst, { recursive: true, force: true });
    if (config.customWeb.source && fs.existsSync(config.customWeb.source)) {
      const skip = config.site ? new Set([path.resolve(config.site.file)]) : new Set();
      copyDir(config.customWeb.source, customDst, skip);
      if (fs.existsSync(path.join(customDst, 'index.html'))) {
        log.ok(`custom website copied to ${path.relative(config.root, customDst)} (served at ${config.customWeb.route})`);
        rows.push(['Custom site', `${config.customWeb.route}/`, 'good']);
      } else {
        log.warn(`custom website has no index.html: ${config.customWeb.source}`);
        rows.push(['Custom site', 'no index.html found', 'warn']);
      }
      if (config.site) log.ok(`API address read by the website (${path.basename(config.site.file)}): port ${config.server.port}, host ${config.server.host}`);
    } else if (config.customWeb.source) log.info(`no custom website (${config.customWeb.source} not found)`);
    for (const a of config.assets) {
      const dst = path.join(exeDir, a.to);
      if (!fs.existsSync(a.from)) {
        log.warn(`asset not found: ${a.from}`);
        continue;
      }
      if (fs.statSync(a.from).isDirectory()) copyDir(a.from, dst);
      else {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(a.from, dst);
      }
      log.ok(`asset ${path.basename(a.from)} → ${a.to}`);
    }
    if (!b.keepWorkDir) fs.rmSync(work, { recursive: true, force: true });
    rows.push(['Executable', `${config.exe} (${fmtSize(size)})`, 'good']);

    log.step(7, TOTAL_STEPS, 'Smoke test');
    if (b.smokeTest) {
      const r = await smokeTest(config, schema, log);
      if (!r.ok) {
        rows.push(['Smoke test', `FAILED: ${r.error}`, 'bad']);
        throw new Error(`Smoke test failed: ${r.error}`);
      }
      rows.push(['Smoke test', `passed (${r.checks} checks)`, 'good']);
    } else {
      log.info('disabled (build.smokeTest = false or --no-smoke)');
      rows.push(['Smoke test', 'skipped', 'warn']);
    }

    log.step(8, TOTAL_STEPS, 'Done');
    for (const dest of config.copyTo) {
      const exeDir = path.dirname(config.exe);
      if (path.resolve(dest) === path.resolve(exeDir)) continue;
      try {
        copyDir(exeDir, dest);
      } catch (e) {
        throw new Error(`Cannot copy to ${dest} (${e.code || e.message}). Is the simulator still running from there?`);
      }
      log.ok(`copied to ${dest}`);
      rows.push(['Copy', dest, 'good']);
    }
    return finish(true);
  } catch (e) {
    log.error(e.message);
    if (options.verbose && e.stack) log.detail(e.stack);
    return finish(false, e.message);
  }
}

module.exports = { build, analyze, logModel };
