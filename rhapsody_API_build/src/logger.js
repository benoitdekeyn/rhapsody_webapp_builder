'use strict';

const useColor = !process.env.NO_COLOR && (process.env.FORCE_COLOR || process.stdout.isTTY);
const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
  bgRed: wrap('1;97;41'),
  bgGreen: wrap('1;30;42'),
};

const warnings = [];
let verbose = false;

function setVerbose(v) {
  verbose = !!v;
}

function line(s = '') {
  process.stdout.write(s + '\n');
}

function step(index, total, title) {
  line('');
  line(c.bold(c.cyan(`━━ [${index}/${total}] ${title}`)));
}

const ok = (msg) => line(`  ${c.green('✔')} ${msg}`);
const info = (msg) => line(`  ${c.blue('•')} ${msg}`);
const detail = (msg) => line(`    ${c.gray(msg)}`);
const debug = (msg) => verbose && line(`    ${c.gray(msg)}`);
const error = (msg) => line(`  ${c.red('✖')} ${c.red(msg)}`);

function warn(msg) {
  warnings.push(msg);
  line(`  ${c.yellow('⚠')} ${c.yellow(msg)}`);
}

function banner(title) {
  const text = `  ${title}  `;
  line('');
  line(c.bold(c.magenta('╔' + '═'.repeat(text.length) + '╗')));
  line(c.bold(c.magenta('║' + text + '║')));
  line(c.bold(c.magenta('╚' + '═'.repeat(text.length) + '╝')));
}

// Final block: it must stay the very last thing printed (it is what the user sees at the end).
function summary({ success, rows, errorMessage }) {
  const label = success ? c.bgGreen('  BUILD SUCCEEDED  ') : c.bgRed('  BUILD FAILED  ');
  line('');
  if (warnings.length) {
    line(c.yellow(c.bold(`Warnings (${warnings.length})`)));
    for (const w of warnings.slice(0, 20)) line(c.yellow(`  ⚠ ${w}`));
    if (warnings.length > 20) line(c.yellow(`  … ${warnings.length - 20} more`));
    line('');
  }
  line(c.bold('────────────────────────────────────────────────────────────'));
  line(label);
  if (!success && errorMessage) line(c.red(c.bold(`  ${errorMessage}`)));
  const width = Math.max(0, ...rows.map((r) => r[0].length));
  for (const [k, v, tone] of rows) {
    const colored = tone === 'good' ? c.green(v) : tone === 'bad' ? c.red(v) : tone === 'warn' ? c.yellow(v) : v;
    line(`  ${c.bold(k.padEnd(width))} : ${colored}`);
  }
  line(c.bold('────────────────────────────────────────────────────────────'));
}

module.exports = { c, step, ok, info, detail, debug, warn, error, banner, summary, line, setVerbose, warnings };
