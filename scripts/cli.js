#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { parseJsonc } = require('../rhapsody_API_build/src/jsonc');

const ROOT = path.join(__dirname, '..');
const CONFIG_NAME = 'rhapsody-webapp.config.jsonc';

const HELP = `rhapsody-webapp-builder

Usage: node scripts/cli.js <command> [options]

Commands:
  build        Build the website, copy it into the API project, build the executable,
               then copy the executable folder to the output folder (default)
  build:web    Only build the website and copy it into the API project (custom_web_interface)
  build:api    Only build the executable (uses the website already in custom_web_interface)
  schema       Analyze the Rhapsody code and write the API schema only
  run          Start the built executable (from the output folder)
  dev          Start the website dev server (hot reload, API address from the config)
  test         Run the tests of both projects
  install      npm install in the website project
  clean        Remove work copies and the website dist (--all: also executables and the output folder)
  api <args>   Run a command of rhapsody_API_build  (e.g. api build --verbose, api clean)
  web <args>   Run an npm script of rhapsody_WEB_interface (e.g. web test, web run preview)

Options:
  --config <file>   Root configuration (default: ./${CONFIG_NAME})
  --no-smoke        Skip the executable smoke test
  --skip-web        build: do not rebuild the website (reuse custom_web_interface as is)
  --verbose         Show compiler warnings and details
  --all             clean: also remove executables and the output folder
  -h, --help        This help
`;

const out = {
  step: (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`),
  ok: (msg) => console.log(`  ok  ${msg}`),
  info: (msg) => console.log(`  ... ${msg}`),
};

function parseArgs(argv) {
  const o = { command: 'build', config: null, smoke: undefined, skipWeb: false, verbose: false, all: false, rest: [] };
  const args = [...argv];
  if (args[0] && !args[0].startsWith('-')) o.command = args.shift();
  if (o.command === 'api' || o.command === 'web') {
    o.rest = args;
    return o;
  }
  while (args.length) {
    const a = args.shift();
    if (a === '--config') {
      o.config = args.shift();
      if (!o.config) throw new Error('Option --config needs a value');
    } else if (a === '--no-smoke') o.smoke = false;
    else if (a === '--skip-web') o.skipWeb = true;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--all') o.all = true;
    else if (a === '-h' || a === '--help') o.command = 'help';
    else throw new Error(`Unknown option ${a}`);
  }
  return o;
}

function loadConfig(file) {
  const configFile = path.resolve(file || path.join(ROOT, CONFIG_NAME));
  if (!fs.existsSync(configFile)) throw new Error(`Configuration file not found: ${configFile}`);
  const raw = parseJsonc(fs.readFileSync(configFile, 'utf8'), path.basename(configFile));
  const base = path.dirname(configFile);
  const abs = (p) => (p ? path.resolve(base, p) : '');
  const api = { host: '127.0.0.1', port: 8080, token: '', ...raw.api };
  const routes = { custom: '/custom', simple: '/api', ...raw.routes };
  const site = { title: '', reconnectMs: 1000, theme: 'dark', showDebug: false, ...raw.site };
  const apiBuild = { dir: './rhapsody_API_build', config: 'rhapsody-api.config.jsonc', ...raw.apiBuild };
  const webInterface = { dir: './rhapsody_WEB_interface', dist: 'dist', target: './rhapsody_API_build/custom_web_interface', ...raw.webInterface };

  if (!Number.isInteger(api.port) || api.port < 1 || api.port > 65535) throw new Error('"api.port" must be an integer between 1 and 65535');
  if (typeof api.host !== 'string' || !api.host) throw new Error('"api.host" must be a non-empty string');
  const exeName = raw.exeName || 'simulateur.exe';
  if (!/^[\w.-]+\.exe$/i.test(exeName)) throw new Error('"exeName" must be a file name ending with .exe');

  return {
    configFile,
    codeDir: abs(raw.codeDir),
    api,
    routes,
    site,
    exeName,
    smokeTest: raw.smokeTest !== false,
    outputDir: abs(raw.outputDir || './application'),
    apiDir: abs(apiBuild.dir),
    apiConfig: path.resolve(abs(apiBuild.dir), apiBuild.config),
    webDir: abs(webInterface.dir),
    webDist: path.resolve(abs(webInterface.dir), webInterface.dist),
    customTarget: abs(webInterface.target),
  };
}

// Address used by a browser to reach the API.
const browserHost = (host) => (host === '0.0.0.0' || host === '::' ? 'localhost' : host);

function siteOverride(cfg) {
  return JSON.stringify({
    ...(cfg.site.title ? { title: cfg.site.title } : {}),
    api: { url: `http://${browserHost(cfg.api.host)}:${cfg.api.port}`, token: cfg.api.token, reconnectMs: cfg.site.reconnectMs },
    ui: { theme: cfg.site.theme, showDebug: cfg.site.showDebug },
  });
}

function run(command, args, options) {
  const r = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (r.error) throw r.error;
  return r.status === null ? 1 : r.status;
}

// npm is a .cmd on Windows: it has to go through a shell.
const npm = (args, cwd, env) => run(`npm ${args.join(' ')}`, [], { cwd, shell: true, env: { ...process.env, ...env } });

const nodeApi = (cfg, args) => run(process.execPath, [path.join(cfg.apiDir, 'src', 'cli.js'), ...args, '--config', cfg.apiConfig], { cwd: cfg.apiDir });

function ensureWebDeps(cfg) {
  if (fs.existsSync(path.join(cfg.webDir, 'node_modules', 'vite'))) return;
  out.info('installing website dependencies (npm install)');
  if (npm(['install'], cfg.webDir) !== 0) throw new Error('npm install failed in the website project');
}

function emptyDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const e of fs.readdirSync(dir)) fs.rmSync(path.join(dir, e), { recursive: true, force: true });
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// site.json tells the API build which address the website reads: the executable listens there.
function writeSiteJson(cfg) {
  fs.mkdirSync(cfg.customTarget, { recursive: true });
  const siteJson = { api: { host: cfg.api.host, port: cfg.api.port, token: cfg.api.token } };
  fs.writeFileSync(path.join(cfg.customTarget, 'site.json'), JSON.stringify(siteJson, null, 2) + '\n');
}

function buildWeb(cfg, step, total) {
  out.step(step, total, 'Building the website and copying it into the API project');
  ensureWebDeps(cfg);
  fs.rmSync(cfg.webDist, { recursive: true, force: true });
  if (npm(['run', 'build'], cfg.webDir, { RHAPSODY_SITE_OVERRIDE: siteOverride(cfg) }) !== 0) throw new Error('Website build failed');
  if (!fs.existsSync(path.join(cfg.webDist, 'index.html'))) throw new Error(`Website build produced no index.html in ${cfg.webDist}`);
  emptyDir(cfg.customTarget);
  copyDir(cfg.webDist, cfg.customTarget);
  writeSiteJson(cfg);
  out.ok(`${cfg.webDist} -> ${cfg.customTarget} (site.json: ${cfg.api.host}:${cfg.api.port})`);
}

function codeDirArgs(cfg) {
  return cfg.codeDir ? ['--set', `codeDir=${JSON.stringify(cfg.codeDir)}`] : [];
}

function buildApi(cfg, opts, step, total) {
  out.step(step, total, 'Building the executable and copying it to the output folder');
  writeSiteJson(cfg);
  const args = [
    'build',
    '--copy-to', cfg.outputDir,
    '--set', `web.route=${JSON.stringify(cfg.routes.simple)}`,
    '--set', `customWeb.route=${JSON.stringify(cfg.routes.custom)}`,
    '--set', `exe=${JSON.stringify('./dist/' + cfg.exeName)}`,
    ...codeDirArgs(cfg),
  ];
  if (opts.smoke === false || !cfg.smokeTest) args.push('--no-smoke');
  if (opts.verbose) args.push('--verbose');
  if (nodeApi(cfg, args) !== 0) throw new Error('Executable build failed');
  const exe = path.join(cfg.outputDir, cfg.exeName);
  if (!fs.existsSync(exe)) throw new Error(`Executable not found in the output folder: ${exe}`);
  const base = `http://${browserHost(cfg.api.host)}:${cfg.api.port}`;
  console.log(`\n  Executable : ${exe}`);
  console.log(`  Website    : ${base}${cfg.routes.custom}/`);
  console.log(`  API page   : ${base}${cfg.routes.simple}/`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === 'help') return console.log(HELP);
  const cfg = loadConfig(opts.config);

  switch (opts.command) {
    case 'build': {
      const total = opts.skipWeb ? 1 : 2;
      if (!opts.skipWeb) buildWeb(cfg, 1, total);
      buildApi(cfg, opts, total, total);
      break;
    }
    case 'build:web':
      buildWeb(cfg, 1, 1);
      break;
    case 'build:api':
      buildApi(cfg, opts, 1, 1);
      break;
    case 'schema': {
      writeSiteJson(cfg);
      const args = ['schema', '--set', `exe=${JSON.stringify('./dist/' + cfg.exeName)}`, ...codeDirArgs(cfg)];
      if (opts.verbose) args.push('--verbose');
      process.exitCode = nodeApi(cfg, args);
      break;
    }
    case 'run': {
      const exe = path.join(cfg.outputDir, cfg.exeName);
      if (!fs.existsSync(exe)) throw new Error(`Executable not found, build first: ${exe}`);
      console.log(`Starting ${exe}  (http://${browserHost(cfg.api.host)}:${cfg.api.port}${cfg.routes.custom}/)`);
      const child = spawn(exe, [], { cwd: cfg.outputDir, stdio: 'inherit' });
      child.on('exit', (code) => process.exit(code || 0));
      break;
    }
    case 'dev':
      ensureWebDeps(cfg);
      process.exitCode = npm(['run', 'dev'], cfg.webDir, { RHAPSODY_SITE_OVERRIDE: siteOverride(cfg) });
      break;
    case 'test': {
      const a = run(process.execPath, ['--test', 'test/unit.test.js', 'test/e2e.test.js'], { cwd: cfg.apiDir });
      ensureWebDeps(cfg);
      const w = npm(['test'], cfg.webDir);
      process.exitCode = a || w ? 1 : 0;
      break;
    }
    case 'install':
      process.exitCode = npm(['install'], cfg.webDir);
      break;
    case 'clean':
      nodeApi(cfg, ['clean']);
      fs.rmSync(cfg.webDist, { recursive: true, force: true });
      if (opts.all) {
        fs.rmSync(path.join(cfg.apiDir, 'dist'), { recursive: true, force: true });
        fs.rmSync(cfg.outputDir, { recursive: true, force: true });
      }
      out.ok(opts.all ? 'work copies, website dist, executables and output folder removed' : 'work copy and website dist removed');
      break;
    case 'api':
      process.exitCode = run(process.execPath, [path.join(cfg.apiDir, 'src', 'cli.js'), ...opts.rest], { cwd: cfg.apiDir });
      break;
    case 'web':
      ensureWebDeps(cfg);
      process.exitCode = npm(opts.rest.length ? opts.rest : ['run'], cfg.webDir, { RHAPSODY_SITE_OVERRIDE: siteOverride(cfg) });
      break;
    default:
      throw new Error(`Unknown command "${opts.command}"\n${HELP}`);
  }
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exitCode = 2;
});
