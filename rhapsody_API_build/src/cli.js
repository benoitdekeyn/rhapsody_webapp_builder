#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const log = require('./logger');
const { loadConfig, findConfig, CONFIG_NAME } = require('./config');
const { build } = require('./builder');

const HELP = `rhapsody-api-build

Usage: node src/cli.js [command] [options]

Commands:
  build    Generate the executable (default)
  schema   Analyze the code and write the timestamped schema only
  run      Start the last built executable
  clean    Remove the working copy

Options:
  --config <file>   Configuration file (default: ./${CONFIG_NAME})
  --no-smoke        Skip the smoke test
  --verbose         Show compiler warnings and details
  --keep-work       Keep the working copy (default from config)
  --copy-to <dir>   Also copy the executable folder (exe, web UIs, schemas, assets) to <dir> (repeatable)
  --api-host <h>    Override the API host (takes precedence over custom_web_interface/site.json)
  --api-port <n>    Override the API port (takes precedence over custom_web_interface/site.json)
  --set <k>=<v>     Override any config key (dotted path, JSON value), e.g. --set codeDir=C:/x --set web.route=/simple
  -h, --help        This help
`;

function parseArgs(argv) {
  const o = { command: 'build', config: null, smoke: undefined, verbose: false, keepWork: undefined, copyTo: [], host: undefined, port: undefined, set: {} };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) o.command = rest.shift();
  const value = (name) => {
    const v = rest.shift();
    if (v === undefined || v.startsWith('--')) throw new Error(`Option ${name} needs a value`);
    return v;
  };
  while (rest.length) {
    const a = rest.shift();
    if (a === '--config') o.config = value(a);
    else if (a === '--no-smoke') o.smoke = false;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--keep-work') o.keepWork = true;
    else if (a === '--copy-to') o.copyTo.push(value(a));
    else if (a === '--api-host') o.host = value(a);
    else if (a === '--set') {
      const kv = value(a);
      const eq = kv.indexOf('=');
      if (eq < 1) throw new Error('--set expects key=value (e.g. --set web.route=/simple)');
      const raw = kv.slice(eq + 1);
      let v = raw;
      try { v = JSON.parse(raw); } catch { /* plain string */ }
      o.set[kv.slice(0, eq)] = v;
    } else if (a === '--api-port') {
      o.port = Number(value(a));
      if (!Number.isInteger(o.port)) throw new Error('--api-port must be an integer');
    } else if (a === '-h' || a === '--help') o.command = 'help';
    else throw new Error(`Unknown option ${a}`);
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === 'help') return console.log(HELP);
  log.setVerbose(opts.verbose);
  const configPath = opts.config || findConfig(process.cwd()) || findConfig(path.join(__dirname, '..'));
  if (!configPath) throw new Error(`${CONFIG_NAME} not found (use --config)`);
  const config = loadConfig(configPath, { smokeTest: opts.smoke, keepWork: opts.keepWork, copyTo: opts.copyTo, host: opts.host, port: opts.port, set: opts.set });

  if (opts.command === 'build' || opts.command === 'schema') {
    const r = await build(config, { analyzeOnly: opts.command === 'schema', verbose: opts.verbose });
    process.exitCode = r.success ? 0 : 1;
  } else if (opts.command === 'run') {
    if (!fs.existsSync(config.exe)) throw new Error(`Executable not found, build first: ${config.exe}`);
    log.info(`Starting ${config.exe} (http://localhost:${config.server.port}/)`);
    const child = spawn(config.exe, config.run.args, { cwd: config.run.cwd, stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
  } else if (opts.command === 'clean') {
    fs.rmSync(config.build.workDir, { recursive: true, force: true });
    log.ok(`removed ${config.build.workDir}`);
  } else throw new Error(`Unknown command "${opts.command}"\n${HELP}`);
}

main().catch((e) => {
  log.error(e.message);
  process.exitCode = 2;
});
