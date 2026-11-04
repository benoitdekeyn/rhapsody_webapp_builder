'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

function findVcvars(configured) {
  if (configured) {
    if (!fs.existsSync(configured)) throw new Error(`build.vcvarsPath not found: ${configured}`);
    return configured;
  }
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const vswhere = path.join(pf86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  if (fs.existsSync(vswhere)) {
    try {
      const out = execFileSync(
        vswhere,
        ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
        { encoding: 'utf8' }
      ).trim();
      const candidate = path.join(out.split(/\r?\n/)[0], 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
      if (out && fs.existsSync(candidate)) return candidate;
    } catch {
      // fall through to the error below
    }
  }
  throw new Error('Visual Studio C++ tools (vcvars64.bat) not found. Install "Desktop development with C++" or set build.vcvarsPath.');
}

// Runs vcvars64.bat once and returns the resulting environment (so cl/link can be spawned directly).
function loadVcEnv(vcvars) {
  const out = execFileSync(process.env.ComSpec || 'cmd.exe',   ['/d', '/s', '/c', `"call "${vcvars}" >nul && set"`], {
    encoding: 'utf8',
      windowsVerbatimArguments: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const env = { ...process.env };
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  env.VSLANG = '1033';
  return env;
}

function parseMakVariables(text) {
  const vars = {};
  for (const m of text.matchAll(/^\s*(\w+)\s*=\s*(.*?)\s*$/gm)) vars[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  return vars;
}

function firstExisting(list) {
  return list.find((p) => p && fs.existsSync(p)) || '';
}

// Finds the Rhapsody framework locations: configuration first, then the generated makefile, then defaults.
function locateRhapsody(config, codeDir) {
  const mak = fs.readdirSync(codeDir).find((f) => /\.mak$/i.test(f));
  const vars = mak ? parseMakVariables(fs.readFileSync(path.join(codeDir, mak), 'latin1')) : {};
  const b = config.build;
  const omroot = firstExisting([
    b.rhapsodyRoot,
    vars.OMROOT,
    'C:\\Program Files\\IBM\\Rhapsody\\9.0.2\\Share',
    'C:\\Program Files\\IBM\\Rhapsody\\9.0.1\\Share',
  ]);
  const libRoot = firstExisting([
    b.frameworkLibRoot,
    vars.FRAMEWORK_LIB_ROOT,
    path.join(process.env.USERPROFILE || '', 'IBM', 'Rhapsody', '9.0.2x64', 'UserShare'),
    omroot,
  ]);
  const mt = b.buildType === 'Release' ? 'R' : '';
  const prefix = b.libPrefix || (vars.LIB_PREFIX ? vars.LIB_PREFIX.replace(/\$\(MT_PREFIX\)/g, '') : 'MSVC15x64');
  if (!omroot) throw new Error('Rhapsody framework (OMROOT) not found. Set build.rhapsodyRoot.');
  if (!libRoot) throw new Error('Rhapsody framework libraries not found. Set build.frameworkLibRoot.');
  return { omroot, libRoot, prefix: prefix + mt, mak: mak || null, vars };
}

function frameworkLibs(config, rh) {
  const dir = path.join(rh.libRoot, 'LangCpp', 'lib');
  const names = (config.build.instrumentation === 'Animation'
    ? ['aomanim', 'oxsiminst', 'oxfinst', 'omComAppl']
    : ['oxf', 'oxsim']).map((n) => `${rh.prefix}${n}`);
  const libs = names.map((n) => path.join(dir, `${n}.lib`));
  const missing = libs.filter((l) => !fs.existsSync(l));
  return { libs, missing };
}

function run(cmd, args, { cwd, env, onLine }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env, windowsHide: true });
    let buf = '';
    const out = [];
    const feed = (d) => {
      buf += d.toString('latin1');
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const l of lines) {
        out.push(l);
        if (onLine) onLine(l);
      }
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('error', reject);
    child.on('close', (code) => {
      if (buf) {
        out.push(buf);
        if (onLine) onLine(buf);
      }
      resolve({ code, lines: out });
    });
  });
}

module.exports = { findVcvars, loadVcEnv, locateRhapsody, frameworkLibs, run, parseMakVariables };
